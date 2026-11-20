from __future__ import annotations

import logging
import re
import threading
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from hijridate import Gregorian
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import db
from database.models import PrayerTime, Setting

log = logging.getLogger("chand")

_CITY_TZ = ZoneInfo("Asia/Kolkata")
_GUJCHAND_URL = "https://gujchand.com/"
_INDIAN_CITIES = [
    "nadiad",
    "ahmedabad",
    "surat",
    "vadodara",
    "rajkot",
    "bhavnagar",
    "jamnagar",
    "gandhinagar",
    "junagadh",
    "anand",
    "mumbai",
]
_POLL_SEC = 120
_FETCH_TIMEOUT = 15
_MAGHRIB_GRACE = timedelta(minutes=15)
_MAGHRIB_WINDOW = timedelta(hours=6)
_FALLBACK_MAGHRIB_HOUR = 18
_FALLBACK_MAGHRIB_MIN = 30
_CONTEXT = "hijri_override"
_HEALTH_CONTEXT = "hijri_health"
_HEALTH_NAME = "scraper"
_USER_AGENT = "nazar-e-alam-chand/2.0"

_FOOTER_RE = re.compile(r"(\d{1,2})\s+([A-Za-z][A-Za-z\s\-']*?)\s+(\d{4})")

_state_lock = threading.Lock()
_state = {
    "last_success_at": None,
    "last_attempt_at": None,
    "last_error": None,
    "consecutive_failures": 0,
    "last_scraped_day": None,
    "last_applied_at": None,
}


def _state_update(**kwargs) -> None:
    with _state_lock:
        _state.update(kwargs)


def get_health() -> dict:
    with _state_lock:
        return dict(_state)


def to_hijri(greg: date) -> dict:
    h = Gregorian(greg.year, greg.month, greg.day).to_hijri()
    return {
        "hijri_year": h.year,
        "hijri_month": h.month,
        "hijri_day": h.day,
        "hijri_month_name": h.month_name(),
    }


def _next_hijri_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def _prev_hijri_month(year: int, month: int) -> tuple[int, int]:
    return (year - 1, 12) if month == 1 else (year, month - 1)


def _normalize_month(year: int, month: int) -> tuple[int, int]:
    while month > 12:
        month -= 12
        year += 1
    while month < 1:
        month += 12
        year -= 1
    return year, month


def _key(city: str, year: int, month: int) -> str:
    return f"{city}_{year}_{month:02d}"


def get_override(session: Session, city: str, year: int, month: int) -> str | None:
    try:
        row = session.execute(
            select(Setting).where(
                Setting.context == _CONTEXT,
                Setting.name == _key(city, year, month),
            )
        ).scalar_one_or_none()
    except Exception as exc:
        log.warning("get_override failed for %s %s-%s: %s", city, year, month, exc)
        return None
    return row.value if row else None


def save_override(
    session: Session, city: str, year: int, month: int, start_iso: str
) -> None:
    name = _key(city, year, month)
    try:
        row = session.execute(
            select(Setting).where(
                Setting.context == _CONTEXT,
                Setting.name == name,
            )
        ).scalar_one_or_none()
        if row:
            if row.value != start_iso:
                row.value = start_iso
        else:
            session.add(Setting(name=name, value=start_iso, context=_CONTEXT))
        session.commit()
    except Exception as exc:
        session.rollback()
        log.error("save_override failed for %s: %s", name, exc)
        raise


def delete_override(session: Session, city: str, year: int, month: int) -> bool:
    name = _key(city, year, month)
    try:
        row = session.execute(
            select(Setting).where(
                Setting.context == _CONTEXT,
                Setting.name == name,
            )
        ).scalar_one_or_none()
        if not row:
            return False
        session.delete(row)
        session.commit()
        return True
    except Exception as exc:
        session.rollback()
        log.error("delete_override failed for %s: %s", name, exc)
        return False


def _persist_health(session: Session) -> None:
    try:
        payload = get_health()
        value = (
            f"success={payload['last_success_at'] or ''}|"
            f"attempt={payload['last_attempt_at'] or ''}|"
            f"failures={payload['consecutive_failures']}|"
            f"error={(payload['last_error'] or '').replace('|', ' ')[:200]}"
        )
        row = session.execute(
            select(Setting).where(
                Setting.context == _HEALTH_CONTEXT,
                Setting.name == _HEALTH_NAME,
            )
        ).scalar_one_or_none()
        if row:
            row.value = value
        else:
            session.add(
                Setting(name=_HEALTH_NAME, value=value, context=_HEALTH_CONTEXT)
            )
        session.commit()
    except Exception as exc:
        session.rollback()
        log.debug("persist_health skipped: %s", exc)


def _maghrib_dt(session: Session, now: datetime) -> datetime:
    h, m = _FALLBACK_MAGHRIB_HOUR, _FALLBACK_MAGHRIB_MIN
    try:
        row = session.execute(
            select(PrayerTime).where(
                PrayerTime.city == "ahmedabad",
                PrayerTime.date == now.date(),
            )
        ).scalar_one_or_none()
        if row and row.maghrib_start:
            parsed = _parse_hhmm(row.maghrib_start)
            if parsed:
                h, m = parsed
    except Exception as exc:
        log.debug("maghrib lookup failed, using fallback: %s", exc)
    return now.replace(hour=h, minute=m, second=0, microsecond=0)


def _parse_hhmm(value: str) -> tuple[int, int] | None:
    try:
        parts = value.strip().split(":")
        if len(parts) < 2:
            return None
        h, m = int(parts[0]), int(parts[1])
        if 0 <= h <= 23 and 0 <= m <= 59:
            return h, m
    except (ValueError, AttributeError):
        return None
    return None


def is_after_maghrib(session: Session, now: datetime) -> bool:
    return now >= _maghrib_dt(session, now)


def is_in_window(session: Session, baseline: dict, now: datetime) -> bool:
    if baseline["hijri_day"] not in (28, 29, 30):
        return False
    mg = _maghrib_dt(session, now)
    return mg + _MAGHRIB_GRACE <= now <= mg + _MAGHRIB_WINDOW


def parse_gujchand(html: str) -> dict | None:
    if not html:
        return None
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as exc:
        log.warning("gujchand html parse error: %s", exc)
        return None
    if soup.find("div", class_="coming_soon", string=True):
        return None
    footer = soup.find("div", class_="footer")
    if not footer:
        log.warning("gujchand footer div not found")
        return None
    text = footer.get_text(" ", strip=True)
    m = _FOOTER_RE.search(text)
    if not m:
        log.warning("gujchand footer regex miss: %r", text[:300])
        return None
    day = int(m.group(1))
    if not 1 <= day <= 30:
        log.warning("gujchand day out of range: %s", day)
        return None
    return {"day": day, "year": int(m.group(3)), "raw_text": text[:300]}


def fetch_gujchand() -> dict | None:
    now_iso = datetime.now(_CITY_TZ).isoformat()
    _state_update(last_attempt_at=now_iso)
    try:
        r = requests.get(
            _GUJCHAND_URL,
            timeout=_FETCH_TIMEOUT,
            headers={"User-Agent": _USER_AGENT, "Cache-Control": "no-cache"},
        )
        r.raise_for_status()
    except requests.RequestException as exc:
        with _state_lock:
            _state["consecutive_failures"] += 1
            fails = _state["consecutive_failures"]
            _state["last_error"] = f"fetch: {exc}"
        if fails in (1, 3, 10) or fails % 50 == 0:
            log.warning("gujchand fetch fail #%s: %s", fails, exc)
        return None
    parsed = parse_gujchand(r.text)
    if parsed is None:
        with _state_lock:
            _state["consecutive_failures"] += 1
            _state["last_error"] = "parse: no day detected"
        return None
    _state_update(
        last_success_at=now_iso,
        consecutive_failures=0,
        last_error=None,
        last_scraped_day=parsed["day"],
    )
    return parsed


def _candidate_months(raw: dict, radius: int = 3) -> list[tuple[int, int]]:
    seen: list[tuple[int, int]] = []
    base_y, base_m = raw["hijri_year"], raw["hijri_month"]
    for delta in range(-radius, radius + 1):
        ym = _normalize_month(base_y, base_m + delta)
        if ym not in seen:
            seen.append(ym)
    return seen


def _pick_target_month(raw: dict, scraped_day: int) -> tuple[int, int]:
    raw_day = raw["hijri_day"]
    if scraped_day == 1 and raw_day >= 29:
        return _next_hijri_month(raw["hijri_year"], raw["hijri_month"])
    if scraped_day > raw_day + 1:
        return _prev_hijri_month(raw["hijri_year"], raw["hijri_month"])
    return raw["hijri_year"], raw["hijri_month"]


def resolve_hijri(session: Session, city: str, effective: date) -> dict:
    raw = to_hijri(effective)
    for y, m in _candidate_months(raw):
        val = get_override(session, city, y, m)
        if not val:
            continue
        try:
            start = date.fromisoformat(val)
        except (ValueError, TypeError):
            log.warning("bad override value for %s %s-%s: %r", city, y, m, val)
            continue
        delta = (effective - start).days
        if 0 <= delta <= 29:
            return {
                "hijri_year": y,
                "hijri_month": m,
                "hijri_day": delta + 1,
                "hijri_month_name": to_hijri(start)["hijri_month_name"],
                "gregorian_date": effective.isoformat(),
                "source": "confirmed",
                "is_tentative": False,
                "message": None,
            }
    health = get_health()
    recent_failure = health["consecutive_failures"] > 0

    if recent_failure:
        adjusted = to_hijri(effective - timedelta(days=1))
        return {
            **adjusted,
            "gregorian_date": effective.isoformat(),
            "source": "baseline_india_adjusted",
            "is_tentative": True,
            "message": "Calculated using India local calendar (Gujchand unavailable)",
        }
    else:
        return {
            **raw,
            "gregorian_date": effective.isoformat(),
            "source": "baseline",
            "is_tentative": False,
            "message": None,
        }


def _maybe_mark_tentative(
    session: Session, city: str, result: dict, now: datetime
) -> dict:
    if result["source"] == "confirmed":
        return result
    today = now.date()
    baseline = to_hijri(today)
    ambiguous_day = baseline["hijri_day"] in (28, 29, 30, 1, 2)
    if not ambiguous_day:
        return result
    if baseline["hijri_day"] in (28, 29, 30):
        ny, nm = _next_hijri_month(baseline["hijri_year"], baseline["hijri_month"])
        needs_next = get_override(session, city, ny, nm) is None
        in_window = is_in_window(session, baseline, now)
        if not needs_next:
            return result
        if not in_window and baseline["hijri_day"] != 30:
            return result
    result["is_tentative"] = True
    result["source"] = "tentative"
    result["message"] = "Awaiting moon sighting confirmation"
    return result


def _apply_scraped(session: Session, now: datetime, scraped: dict) -> bool:
    today = now.date()
    raw = to_hijri(today)
    scraped_day = scraped["day"]
    ty, tm = _pick_target_month(raw, scraped_day)
    start = today - timedelta(days=scraped_day - 1)
    changed = False
    for city in _INDIAN_CITIES:
        existing = get_override(session, city, ty, tm)
        if existing == start.isoformat():
            continue
        save_override(session, city, ty, tm, start.isoformat())
        changed = True
    if changed:
        _state_update(last_applied_at=datetime.now(_CITY_TZ).isoformat())
        log.info(
            "override applied ty=%s tm=%02d start=%s day=%s",
            ty,
            tm,
            start.isoformat(),
            scraped_day,
        )
    return changed


def _ensure_roll_forward(session: Session, now: datetime) -> None:
    today = now.date()
    baseline = to_hijri(today)
    if baseline["hijri_day"] != 30:
        return
    if not is_after_maghrib(session, now):
        return
    ny, nm = _next_hijri_month(baseline["hijri_year"], baseline["hijri_month"])
    start = today + timedelta(days=1)
    wrote = False
    for city in _INDIAN_CITIES:
        if get_override(session, city, ny, nm) is None:
            save_override(session, city, ny, nm, start.isoformat())
            wrote = True
    if wrote:
        log.info("pre-roll %s-%02d -> %s", ny, nm, start.isoformat())


def _apply_month_start_fallback(session: Session, now: datetime) -> None:
    today = now.date()
    baseline = to_hijri(today)
    if baseline["hijri_day"] != 1:
        return
    if not is_after_maghrib(session, now):
        return
    start = today
    py, pm = _prev_hijri_month(baseline["hijri_year"], baseline["hijri_month"])
    wrote = False
    for city in _INDIAN_CITIES:
        if (
            get_override(session, city, baseline["hijri_year"], baseline["hijri_month"])
            is None
        ):
            save_override(
                session,
                city,
                baseline["hijri_year"],
                baseline["hijri_month"],
                start.isoformat(),
            )
            wrote = True
    if wrote:
        log.info(
            "month-start seed %s-%02d start=%s (prev=%s-%02d)",
            baseline["hijri_year"],
            baseline["hijri_month"],
            start.isoformat(),
            py,
            pm,
        )


def run_cycle() -> None:
    now = datetime.now(_CITY_TZ)
    with db.session() as session:
        try:
            _ensure_roll_forward(session, now)
        except Exception as exc:
            log.warning("roll-forward skipped: %s", exc)
        try:
            _apply_month_start_fallback(session, now)
        except Exception as exc:
            log.warning("month-start seed skipped: %s", exc)

        scraped = fetch_gujchand()
        if scraped:
            try:
                _apply_scraped(session, now, scraped)
            except Exception as exc:
                log.error("apply scraped failed: %s", exc)
        else:
            today_baseline = to_hijri(now.date())
            if is_in_window(session, today_baseline, now):
                log.info("in window, no confirmation from source")
        try:
            _persist_health(session)
        except Exception:
            pass


def loop() -> None:
    log.info("scheduler loop started")
    backoff = 0
    while True:
        try:
            run_cycle()
            backoff = 0
        except Exception as exc:
            backoff = min(backoff + 1, 6)
            log.error("cycle error (backoff=%ss): %s", backoff * _POLL_SEC, exc)
        time.sleep(_POLL_SEC + backoff * _POLL_SEC)


_scheduler_started = False
_scheduler_lock = threading.Lock()


def start() -> None:
    global _scheduler_started
    with _scheduler_lock:
        if _scheduler_started:
            return
        _scheduler_started = True
    threading.Thread(target=loop, name="chand-scheduler", daemon=True).start()


def get_effective_hijri(session: Session, city: str) -> dict:
    now = datetime.now(_CITY_TZ)
    effective = now.date()
    try:
        result = resolve_hijri(session, city, effective)
        result = _maybe_mark_tentative(session, city, result, now)
    except Exception as exc:
        log.error("resolve failed for %s: %s — returning baseline", city, exc)
        result = {
            **to_hijri(effective),
            "gregorian_date": effective.isoformat(),
            "source": "baseline",
            "is_tentative": True,
            "message": "Calendar service degraded — using calculated calendar",
        }
    return result


def force_refresh_now() -> dict:
    now = datetime.now(_CITY_TZ)
    scraped = fetch_gujchand()
    if not scraped:
        return {"status": "no_data", "health": get_health()}
    with db.session() as session:
        try:
            changed = _apply_scraped(session, now, scraped)
            _persist_health(session)
        except Exception as exc:
            log.error("force refresh apply failed: %s", exc)
            return {"status": "error", "error": str(exc)}
    return {
        "status": "applied" if changed else "no_change",
        "scraped_day": scraped["day"],
        "health": get_health(),
    }


def force_apply_day(
    hijri_day: int, when: date | None = None, cities: list[str] | None = None
) -> dict:
    if not 1 <= hijri_day <= 30:
        return {"status": "error", "error": "hijri_day must be 1..30"}
    when = when or datetime.now(_CITY_TZ).date()
    raw = to_hijri(when)
    ty, tm = _pick_target_month(raw, hijri_day)
    start = when - timedelta(days=hijri_day - 1)
    targets = cities or _INDIAN_CITIES
    with db.session() as session:
        for city in targets:
            save_override(session, city, ty, tm, start.isoformat())
        _persist_health(session)
    return {
        "status": "applied",
        "hijri_day": hijri_day,
        "target_year": ty,
        "target_month": tm,
        "start": start.isoformat(),
        "cities": targets,
    }


def force_clear_override(
    year: int, month: int, cities: list[str] | None = None
) -> dict:
    targets = cities or _INDIAN_CITIES
    cleared = []
    with db.session() as session:
        for city in targets:
            if delete_override(session, city, year, month):
                cleared.append(city)
    return {"status": "cleared", "year": year, "month": month, "cities": cleared}


def health_report() -> dict:
    now = datetime.now(_CITY_TZ)
    with db.session() as session:
        out = {"now": now.isoformat(), "health": get_health(), "cities": {}}
        for city in _INDIAN_CITIES:
            try:
                out["cities"][city] = get_effective_hijri(session, city)
            except Exception as exc:
                out["cities"][city] = {"error": str(exc)}
        return out


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    print(force_refresh_now())
    with db.session() as s:
        print(get_effective_hijri(s, "nadiad"))
