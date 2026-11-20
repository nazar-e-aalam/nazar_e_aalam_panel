"""
Translation service shared by dua and dhikr routes.

Public API:
    translate_dua_fields(en_short, en_full, en_fazilat) -> dict[str, str | None]

Returns all 15 translated field names:
    guj_short_name, guj_full_name, guj_fazilat,
    hin_short_name, hin_full_name, hin_fazilat,
    ur_short_name,  ur_full_name,  ur_fazilat,
    ar_short_name,  ar_full_name,  ar_fazilat,
    sw_short_name,  sw_full_name,  sw_fazilat
"""

from __future__ import annotations

import logging
from functools import lru_cache

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

_TARGET_LANGS: dict[str, str] = {
    "guj": "gu",
    "hin": "hi",
    "ur": "ur",
    "ar": "ar",
    "sw": "sw",
}

_FIELD_SUFFIXES = ("short_name", "full_name", "fazilat")


@lru_cache(maxsize=1)
def _get_translator():
    """One shared SyncTranslator for the whole process."""
    from googletrans import SyncTranslator

    return SyncTranslator()


def _translate_one(text: str | None, target_code: str) -> str | None:
    if not text or not text.strip():
        return None

    cleaned = text.strip()
    try:
        result = _get_translator().translate(cleaned, dest=target_code)
        if result and result.text and result.text.strip():
            return result.text.strip()
    except Exception:
        logger.exception("translation to %s failed", target_code)

    return cleaned


def _translate_sync(
    en_short: str | None,
    en_full: str | None,
    en_fazilat: str | None,
) -> dict[str, str | None]:
    sources = {
        "short_name": en_short,
        "full_name": en_full,
        "fazilat": en_fazilat,
    }
    out: dict[str, str | None] = {}
    for prefix, target_code in _TARGET_LANGS.items():
        for suffix in _FIELD_SUFFIXES:
            out[f"{prefix}_{suffix}"] = _translate_one(sources[suffix], target_code)
    return out


async def translate_dua_fields(
    en_short: str | None,
    en_full: str | None,
    en_fazilat: str | None,
) -> dict[str, str | None]:
    """Async entry point — runs blocking translations in a threadpool."""
    return await run_in_threadpool(_translate_sync, en_short, en_full, en_fazilat)
