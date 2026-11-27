/* Nazar-e-Aalam — admin panel */
"use strict";

// Auth guard — must run first
if (!api.isAuthenticated()) {
  api.redirectLogin();
  throw new Error("REDIRECT");
}

// ============================================================================
// Helpers
// ============================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const toast = api.toast;

const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const pad = (n) => String(n).padStart(2, "0");
const cap = (s) => {
  const t = String(s || "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

function localISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

async function apiCall(promise, { success = null, errorPrefix = "" } = {}) {
  try {
    const r = await promise;
    if (success) toast(success);
    return r;
  } catch (e) {
    toast(
      (errorPrefix ? errorPrefix + ": " : "") + (e.message || "Request failed"),
      true,
    );
    throw e;
  }
}

async function readError(res) {
  try {
    return (await res.json()).detail || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function postForm(path, form) {
  const res = await api.request(path, {
    method: "POST",
    body: form,
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

async function loadCached(key, ttl, fetcher, fallback) {
  const hit = api.cache.get(key, ttl);
  if (hit) return hit;
  try {
    const value = await fetcher();
    api.cache.set(key, value);
    return value;
  } catch {
    return fallback;
  }
}

// ---- 12/24-hour display preference ----------------------------------------
const TIME_FMT_KEY = "nea:time_fmt_v1";
let timeFmt = store.get(TIME_FMT_KEY) === "24" ? "24" : "12";

function setTimeFmt(v) {
  if (v !== "12" && v !== "24") return;
  timeFmt = v;
  store.set(TIME_FMT_KEY, v);
}

// "HH:MM" (24h) → HTML honouring the preference, with a muted AM/PM badge.
function fmtTimeHtml(hhmm) {
  if (!hhmm) return "—";
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return esc(hhmm);
  let h = parseInt(m[1], 10);
  if (timeFmt === "24") return `${pad(h)}:${m[2]}`;
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]}<span class="ampm">${suffix}</span>`;
}

// ============================================================================
// Icons
// ============================================================================
const ICONS = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h8l2 2-2 2-2-2-2 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  head: '<path d="M4 15v-3a8 8 0 0116 0v3"/><path d="M3 14h4v6H3zM17 14h4v6h-4z"/>',
  heart:
    '<path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/>',
  beads:
    '<circle cx="6" cy="9" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="18" cy="16" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="6" cy="16" r="2"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  set: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  book: '<path d="M5 4h14v16H7a2 2 0 01-2-2z"/><path d="M9 8h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  down: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh:
    '<path d="M4 4v6h6M20 20v-6h-6"/><path d="M20 10a8 8 0 10-8 8 8 8 0 006-3"/>',
  mobile:
    '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
  roles:
    '<circle cx="9" cy="7" r="3"/><path d="M2 21v-2a5 5 0 0110 0v2"/><circle cx="17" cy="9" r="2.2"/><path d="M14 21v-1.5a4 4 0 017.5-1.5"/>',
};

const ic = (name) => {
  const path = ICONS[name];
  return path
    ? `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`
    : "";
};

// ============================================================================
// Modal, forms, confirm
// ============================================================================
let modalCtx = null;
let lastFocus = null;
const modalOpen = () => $("#modal").classList.contains("on");

function openModal(html, size = "") {
  lastFocus = document.activeElement;
  const m = $("#modal");
  m.innerHTML = `<div class="mb glass ${size}" role="dialog" aria-modal="true" aria-labelledby="mt">${html}</div>`;
  m.classList.add("on");
  m.setAttribute("aria-hidden", "false");
  document.body.classList.add("noscroll");
  setTimeout(() => {
    m.querySelector(
      "input:not([type=hidden]):not([type=file]):not([type=checkbox]),textarea,select,.btn",
    )?.focus();
  }, 30);
}

function closeModal() {
  const m = $("#modal");
  m.classList.remove("on");
  m.innerHTML = "";
  m.setAttribute("aria-hidden", "true");
  document.body.classList.remove("noscroll");
  modalCtx = null;
  if (lastFocus && lastFocus.focus && document.contains(lastFocus))
    lastFocus.focus();
}

const modalHeader = (title) =>
  `<div class="mh"><h3 id="mt">${esc(title)}</h3>
     <button type="button" class="x" data-act="close" aria-label="Close">${ic("x")}</button></div>`;

function confirmBox({ title, msg, ok = "Delete", onOk }) {
  openModal(
    `${modalHeader(title)}
     <p class="msg">${esc(msg)}</p>
     <div class="mfoot">
       <button type="button" class="b3" data-act="close">Cancel</button>
       <button type="button" class="btn danger" data-act="confirm">${esc(ok)}</button>
     </div>`,
    "sm",
  );
  modalCtx = { onOk };
}

function fieldHtml(f, v) {
  if (f.sec) return `<div class="sec full">${esc(f.sec)}</div>`;
  const id = "f_" + f.k;
  const val = v ?? f.def ?? "";
  const dir = f.ar ? ' dir="rtl"' : "";
  const cls = "in" + (f.ar ? " ar" : "");
  let control;
  if (f.t === "area") {
    control = `<textarea class="${cls}" id="${id}" name="${f.k}" rows="${f.rows || 3}"${dir}>${esc(val)}</textarea>`;
  } else if (f.t === "select") {
    control = `<select class="${cls}" id="${id}" name="${f.k}">${f.o
      .map((o) => `<option${o === val ? " selected" : ""}>${esc(o)}</option>`)
      .join("")}</select>`;
  } else {
    control = `<input class="${cls}" id="${id}" name="${f.k}" type="${f.t || "text"}" value="${esc(val)}"${dir}${
      f.min != null ? ` min="${f.min}"` : ""
    }${f.max != null ? ` max="${f.max}"` : ""}${f.t === "number" ? ' step="1"' : ""} autocomplete="off">`;
  }
  return `<div class="${f.full ? "full" : ""}">
      <label for="${id}">${esc(f.l)}${f.req ? '<span class="rq" aria-hidden="true">*</span>' : ""}</label>
      ${control}
      ${f.h ? `<div class="hint">${esc(f.h)}</div>` : ""}
    </div>`;
}

function formModal({
  title,
  fields,
  data = {},
  okLabel = "Save",
  size = "",
  onOpen,
  onSubmit,
}) {
  openModal(
    `<form id="mform" novalidate>
       ${modalHeader(title)}
       <div class="mf">${fields.map((f) => fieldHtml(f, data[f.k])).join("")}</div>
       <div class="err" id="merr" role="alert"></div>
       <div class="mfoot">
         <button type="button" class="b3" data-act="close">Cancel</button>
         <button class="btn" type="submit"><span class="bt">${esc(okLabel)}</span><span class="sp2"></span></button>
       </div>
     </form>`,
    size,
  );

  const form = $("#mform");
  const showError = (el, msg) => {
    if (el) el.setAttribute("aria-invalid", "true");
    $("#merr").textContent = msg;
    if (el) el.focus();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $(".btn", form);
    const vals = {};
    let bad = null;
    $$(".in", form).forEach((i) => i.removeAttribute("aria-invalid"));

    for (const f of fields) {
      if (f.sec) continue;
      const el = form.querySelector(`[name="${f.k}"]`);
      if (!el) continue;
      let v = String(el.value).trim();
      const fail = (msg) => {
        if (!bad) bad = { el, msg };
      };

      if (f.req && !v) {
        fail(`${f.l} is required.`);
        continue;
      }
      if (v && f.t === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        fail("Enter a valid email address.");
      }
      if (f.t === "number") {
        if (!v) v = f.def != null ? f.def : null;
        else {
          const n = Number(v);
          if (!Number.isInteger(n)) fail(`${f.l} must be a whole number.`);
          else if (f.min != null && n < f.min)
            fail(`${f.l} must be ≥ ${f.min}.`);
          else if (f.max != null && n > f.max)
            fail(`${f.l} must be ≤ ${f.max}.`);
          else v = n;
        }
      }
      vals[f.k] = v === "" ? null : v;
    }
    if (bad) return showError(bad.el, bad.msg);

    $("#merr").textContent = "";
    btn.classList.add("load");
    btn.disabled = true;
    try {
      const err = await onSubmit(vals);
      if (err) showError(null, err);
      else closeModal();
    } catch (err) {
      showError(null, err.message || "Request failed");
    } finally {
      btn.classList.remove("load");
      btn.disabled = false;
    }
  };

  if (onOpen) onOpen(form);
}

// ============================================================================
// Navigation + state
// ============================================================================
// [page, icon, read-permission]
const NAV = [
  ["Dashboard", "dash", null],
  ["Administrators", "shield", "administrators:read"],
  ["Roles", "roles", "roles:read"],
  ["Invitations", "key", "invitations:read"],
  ["Prayer Times", "clock", "prayer-times:read"],
  ["Reciters", "head", "reciters:read"],
  ["Duas", "heart", "duas:read"],
  ["Dhikrs", "beads", "dhikrs:read"],
  ["Wallpapers", "img", "wallpapers:read"],
  ["Uploads", "upload", "uploads:read"],
  ["Backup", "down", "backup:read"],
  ["Sync", "refresh", "sync:read"],
  ["Dhikr Campaigns", "check", "dhikr-campaigns:read"],
  ["Devices", "mobile", "devices:read"],
  ["Settings", "set", "settings:read"],
];
const isPage = (name) => NAV.some(([n]) => n === name);
const readPermission = (name) => NAV.find(([n]) => n === name)?.[2] || null;

const state = {
  page: "Dashboard",
  user: api.user,
  me: null,
  settings: null,
  roles: null,
  cities: null,
  permissions: null, // Set, or null = not restricted client-side
  tick: null,
  prayerTimes: null,
  prayerCity: null, // dashboard city
  prayerCityPage: null, // prayer-times page city
  prayerYear: null,
  prayerMonth: null,
  reciterSlug: null,
  surahPlayer: null,
  detected: null,
  detectedToastShown: false,
  dashboardReady: null,
  navToken: 0,
};

// ---- Permissions ------------------------------------------------------------
// Permissions come from the roles returned by GET /me. If the API exposes none,
// the UI isn't restricted client-side (the server still enforces everything).
function loadPermissions(me) {
  const codes = ((me && me.roles) || []).flatMap((r) => r.permissions || []);
  state.permissions = codes.length ? new Set(codes) : null;
}
const can = (perm) =>
  !state.permissions ||
  state.permissions.has("*") ||
  state.permissions.has(perm);

// ---- Cached loaders -----------------------------------------------------------
async function ensureRoles(force = false) {
  if (force) {
    state.roles = null;
    api.cache.invalidate("roles");
  }
  if (!state.roles)
    state.roles = await loadCached(
      "roles",
      5 * 60_000,
      () => api.get("/roles"),
      [],
    );
  return state.roles;
}

async function ensureSettings() {
  if (state.settings) return state.settings;
  state.settings = await loadCached(
    "settings",
    5 * 60_000,
    async () => (await api.get("/settings/map?context=app")).values || {},
    {},
  );
  return state.settings;
}

async function ensureCities() {
  if (state.cities) return state.cities;
  state.cities = await loadCached(
    "cities",
    60 * 60_000,
    () => api.get("/prayer-times/cities"),
    [],
  );
  return state.cities;
}

async function refreshMe() {
  try {
    state.me = await api.get("/me");
  } catch {
    state.me = state.user;
  }
  return state.me;
}

// ============================================================================
// Shell
// ============================================================================
function renderNav() {
  $("#nav").innerHTML = NAV.filter(([, , perm]) => !perm || can(perm))
    .map(
      ([
        n,
        i,
      ]) => `<a href="#${encodeURIComponent(n)}" class="${n === state.page ? "act" : ""}"
          ${n === state.page ? 'aria-current="page"' : ""} data-act="go" data-p="${esc(n)}">${ic(i)}${esc(n)}</a>`,
    )
    .join("");
}

function applyUserHeader() {
  const u = state.me || state.user;
  if (!u) return;
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  const name = full || (u.email || "admin").split("@")[0];
  $("#un").textContent = name;

  const ini = $("#ini");
  if (u.avatar) {
    ini.innerHTML = `<img src="${esc(u.avatar)}" alt="">`;
  } else {
    ini.textContent =
      name
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "A";
  }
}

function applyBrand() {
  const s = state.settings || {};
  $("#brandName").textContent = s.company || "Nazar-e-Aalam";
  const img = $("#brandImg");
  if (img) img.src = s.logo || "assets/img/logo.png";
}

const isMobile = () => matchMedia("(max-width: 900px)").matches;
const menuIsOpen = () =>
  document.body.classList.contains(isMobile() ? "open" : "rail");

function setMenu(on) {
  const mobile = isMobile();
  document.body.classList.toggle(mobile ? "open" : "rail", on);
  if (!mobile) store.set("nea:rail", on ? "1" : "0");
  $('[data-act="menu"].chip')?.setAttribute("aria-expanded", String(on));
}

const loadingCard = () =>
  `<div class="card glass s12"><div class="empty">${ic("refresh")} Loading…</div></div>`;

async function go(page) {
  if (!isPage(page)) page = "Dashboard";
  const token = ++state.navToken;
  state.page = page;

  if (state.tick) {
    clearInterval(state.tick);
    state.tick = null;
  }
  syncStopTimers();
  if (page !== "Reciters") state.reciterSlug = null;

  const perm = readPermission(page);
  if (perm && !can(perm)) {
    $("#page").innerHTML = `<div class="card glass s12">
      <div class="empty">
        ${ic("lock")}
        <b style="display:block;margin:12px 0 6px">You don't have permission to view this page.</b>
        <small>Ask an administrator to grant you the <code>${esc(perm)}</code> permission.</small>
      </div></div>`;
    renderNav();
    return;
  }

  stopAudio();
  $("#pt").textContent = page;
  document.title = `${page} · Nazar-e-Aalam Admin`;
  try {
    history.replaceState(null, "", "#" + encodeURIComponent(page));
  } catch {}
  renderNav();
  if (isMobile()) setMenu(false);

  const container = $("#page");
  container.innerHTML = loadingCard();
  try {
    const html = await PAGE_RENDERERS[page]();
    if (token !== state.navToken) return; // a newer navigation took over
    container.innerHTML = html;
    enhanceAllSelects(container);

    if (page === "Dashboard") startDashboard();
    else if (page === "Uploads") initUploadsPage();
    else if (page === "Sync") syncStartPolling();
  } catch (e) {
    if (token !== state.navToken) return;
    container.innerHTML = `<div class="card glass s12">
      <div class="empty">${ic("x")} ${esc(e.message || "Failed to load")}
        <button type="button" class="b3" data-act="reload">${ic("refresh")}Retry</button></div></div>`;
    toast(e.message || "Failed to load", true);
  }
  container.scrollTop = 0;
  container.focus({ preventScroll: true });
}

// ============================================================================
// Dashboard
// ============================================================================
function startDashboard() {
  requestAnimationFrame(() =>
    setTimeout(() => {
      $$(".dfg").forEach((el) => {
        el.style.strokeDashoffset = el.dataset.target ?? 0;
      });
    }, 200),
  );
  if (!state.tick) {
    state.tick = setInterval(dashboardTick, 1000);
    dashboardTick();
  }
}

// Placeholder numbers until an analytics endpoint exists.
const DEMO_PLATFORM = { android: 180, ios: 60 };

async function platformCard() {
  const data = await api.get("/administrators/devices/stats");
  const android = data.android;
  const ios = data.ios;
  const total = android + ios;
  const aPct = Math.round((android / total) * 100);
  const iPct = 100 - aPct;
  const iRot = -90 + aPct * 3.6;

  return `<div class="card glass s4 plat">
    <div class="lbl">Platform breakdown</div>
    <div class="dn">
      <div class="pdonut">
        <svg viewBox="0 0 42 42" role="img" aria-label="Android ${android}, iOS ${ios}">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(130,60,10,.12)" stroke-width="4"/>
          <circle class="dfg" cx="21" cy="21" r="15.9" fill="none" stroke="url(#gr)" stroke-width="4"
                  stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"
                  data-target="${100 - aPct}" transform="rotate(-90 21 21)"/>
          <circle class="dfg" cx="21" cy="21" r="15.9" fill="none" stroke="#f6c9ab" stroke-width="4"
                  stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"
                  data-target="${100 - iPct}" transform="rotate(${iRot} 21 21)"/>
          <g text-anchor="middle" font-family="Manrope,system-ui,sans-serif">
            <text x="21" y="20" font-size="9" font-weight="800" fill="#2b1608" dominant-baseline="middle">${total}</text>
            <text x="21" y="26" font-size="2.2" font-weight="700" fill="#7d5a42" letter-spacing=".35">TOTAL</text>
          </g>
        </svg>
      </div>
      <div class="lg2">
        <span><i class="k-and"></i><b>Android</b><em>${android}</em></span>
        <span><i class="k-ios"></i><b>iOS</b><em>${ios}</em></span>
      </div>
    </div>
  </div>`;
}

const dashboardSvgDefs = () =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="gr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffa03f"/><stop offset="1" stop-color="#e4530b"/>
    </linearGradient></defs></svg>`;

const PRAYER_ORDER = [
  ["fajr", "Fajr"],
  ["sunrise", "Sunrise"],
  ["zuhr", "Dhuhr"],
  ["asr", "Asr"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
];

function nextPrayerNow(times) {
  const parsed = [];
  for (const [key, label] of PRAYER_ORDER) {
    const t = times[key];
    if (!t) continue;
    const [h, m] = t.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    parsed.push({ key, label, min: h * 60 + m, display: t });
  }
  if (!parsed.length) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  let next = parsed.find((p) => p.min > nowMin);
  let prev;
  if (next) {
    prev = [...parsed].reverse().find((p) => p.min <= nowMin);
    if (!prev) {
      const last = parsed[parsed.length - 1];
      prev = { ...last, min: last.min - 24 * 60 };
    }
  } else {
    next = { ...parsed[0], min: parsed[0].min + 24 * 60 };
    prev = parsed[parsed.length - 1];
  }

  const span = next.min - prev.min;
  const progress =
    span > 0 ? Math.min(1, Math.max(0, (nowMin - prev.min) / span)) : 0;
  return {
    name: next.label,
    secondsLeft: Math.max(0, Math.round((next.min - nowMin) * 60)),
    progress,
  };
}

function dashboardTick() {
  if (state.page !== "Dashboard") {
    clearInterval(state.tick);
    state.tick = null;
    return;
  }
  const cd = $("#cd");
  if (!state.prayerTimes || !cd) return;
  const np = nextPrayerNow(state.prayerTimes);
  if (!np) return;

  cd.textContent = fmtDuration(np.secondsLeft);
  const rg = $("#rg");
  if (rg) rg.style.strokeDashoffset = String(100 * (1 - np.progress));
  const name = $("#np-name");
  if (name) name.textContent = np.name;
  $$("#np-list div").forEach((el) =>
    el.classList.toggle("nx", el.dataset.prayer === np.name.toLowerCase()),
  );
}

function matchCity(cityName) {
  if (!cityName || !state.cities) return null;
  const needle = cityName.toLowerCase().trim();
  return (
    state.cities.find((c) => {
      const key = c.key.toLowerCase();
      const name = c.name.toLowerCase();
      return (
        key === needle ||
        name === needle ||
        name.startsWith(needle) ||
        needle.startsWith(name)
      );
    }) || null
  );
}

async function loadTodayPrayerTimes(city) {
  if (!city) return null;
  const today = localISODate();
  try {
    const r = await api.get(
      `/prayer-times?city=${encodeURIComponent(city)}&from=${today}&to=${today}&limit=5`,
    );
    const row = (r.items || [])[0];
    if (!row) return null;
    return {
      city,
      times: {
        imsak: row.imsak,
        fajr: row.fajr_start,
        sunrise: row.sunrise,
        zuhr: row.zuhr_start,
        asr: row.asr_start,
        maghrib: row.maghrib_start,
        isha: row.isha_start,
      },
      isFriday: !!row.is_friday,
    };
  } catch {
    return null;
  }
}

async function loadLocationPrayerTimes(d) {
  try {
    const r = await api.get(
      `/prayer-times/for-location?lat=${d.lat}&lon=${d.lon}`,
    );
    const t = r.timings || {};
    return {
      city: r.city_name || d.city || "detected",
      times: {
        imsak: t.imsak,
        fajr: t.fajr,
        sunrise: t.sunrise,
        zuhr: t.dhuhr,
        asr: t.asr,
        maghrib: t.maghrib,
        isha: t.isha,
      },
      isFriday: !!r.is_friday,
    };
  } catch {
    return null;
  }
}

function alertCard(icon, title, note, actionsHtml) {
  return `<div class="card glass s4 np alert">
    <div class="np-head"><div class="ic bad">${ic(icon)}</div><b>${esc(title)}</b></div>
    <p class="np-note">${note}</p>
    <div class="np-actions">${actionsHtml}</div>
  </div>`;
}

function renderNextPrayer(todayTimes, cities, detectedLabel = null) {
  if (!todayTimes) {
    return `<div class="card glass s4 np empty-state">
      <small>Next prayer</small>
      <p class="np-note" style="margin:20px 0">No prayer times seeded for today.</p>
      <button type="button" class="b3" data-act="go" data-p="Prayer Times">${ic("clock")}Set up</button>
    </div>`;
  }

  const options = cities.map(
    (c) =>
      `<option value="${esc(c.key)}"${c.key === state.prayerCity && !detectedLabel ? " selected" : ""}>${esc(c.name)}</option>`,
  );
  if (detectedLabel) {
    options.unshift(
      `<option value="__detected__" selected>${esc(detectedLabel)} (detected)</option>`,
    );
  }

  const t = todayTimes.times;
  const list = [
    ["fajr", "Fajr", t.fajr],
    ["sunrise", "Sunrise", t.sunrise],
    ["zuhr", "Dhuhr", t.zuhr],
    ["asr", "Asr", t.asr],
    ["maghrib", "Maghrib", t.maghrib],
    ["isha", "Isha", t.isha],
  ].filter(([, , v]) => v);

  return `<div class="card glass s4 np">
    <div class="np-top">
      <small>Next prayer</small>
      <div class="np-tools">
        <button type="button" class="tool" data-act="toggle-time-fmt" title="Switch between 12-hour and 24-hour"
                aria-label="Switch time format">${timeFmt === "12" ? "12h" : "24h"}</button>
        <button type="button" class="tool" data-act="dash-refresh-loc" title="Refresh location"
                aria-label="Refresh location">${ic("refresh")}</button>
        <select class="in sm" data-change="np-city" aria-label="City">${options.join("")}</select>
      </div>
    </div>
    <div class="rg">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle class="bg" cx="18" cy="18" r="15.9"/>
        <circle id="rg" class="fg" cx="18" cy="18" r="15.9" pathLength="100"/>
      </svg>
      <div><b id="np-name">—</b><em id="cd">--:--:--</em></div>
    </div>
    <div class="pr" id="np-list">
      ${list.map(([key, label, time]) => `<div data-prayer="${key}"><span>${esc(label)}</span><b>${fmtTimeHtml(time)}</b></div>`).join("")}
    </div>
  </div>`;
}

async function dashboardPage() {
  const u = state.me || state.user;
  const name =
    (u && (u.first_name || (u.email || "").split("@")[0])) || "admin";
  const greet = "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ ٱللَّهِ وَبَرَكاتُهُ";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const quick = [
    can("duas:write") &&
      `<button type="button" data-act="go" data-p="Duas" data-then="add">${ic("plus")}Add dua</button>`,
    can("dhikrs:write") &&
      `<button type="button" data-act="go" data-p="Dhikrs" data-then="add">${ic("beads")}Add dhikr</button>`,
    can("wallpapers:write") &&
      `<button type="button" class="g" data-act="go" data-p="Wallpapers" data-then="add">${ic("img")}Add wallpaper</button>`,
  ].filter(Boolean);

  const cities = await ensureCities();

  // Resolve which city to use: explicit choice → detected location matched to a curated city
  let resolvedCity =
    state.prayerCity === "__detected__" ? null : state.prayerCity;
  if (!resolvedCity && state.detected?.city)
    resolvedCity = matchCity(state.detected.city)?.key || null;

  const hasCoords =
    typeof state.detected?.lat === "number" &&
    typeof state.detected?.lon === "number";
  const kind = resolvedCity ? "curated" : hasCoords ? "detected" : "unresolved";

  let todayTimes = null;
  if (kind === "curated") {
    state.prayerCity = resolvedCity;
    todayTimes = await loadTodayPrayerTimes(resolvedCity);
  } else if (kind === "detected") {
    todayTimes = await loadLocationPrayerTimes(state.detected);
  }
  state.prayerTimes = todayTimes ? todayTimes.times : null;

  const hijriCity =
    resolvedCity || state.detected?.city?.toLowerCase().trim() || "nadiad";
  const hijri = await api
    .get("/hijri/now?city=" + encodeURIComponent(hijriCity))
    .catch(() => null);
  let hijriLine = "";
  if (hijri) {
    hijriLine = `${hijri.hijri_day} ${hijri.hijri_month_name} ${hijri.hijri_year} AH`;
    if (hijri.is_tentative) hijriLine += " · tentative";
  }

  // Stat counters fill in asynchronously; init() waits on state.dashboardReady
  const stats = [
    {
      key: "wallpapers",
      icon: "img",
      label: "Wallpapers",
      endpoint: "/wallpapers?limit=1",
    },
    { key: "duas", icon: "heart", label: "Duas", endpoint: "/duas?limit=1" },
    {
      key: "dhikrs",
      icon: "beads",
      label: "Dhikrs",
      endpoint: "/dhikrs?limit=1",
    },
    {
      key: "dhikr campaigns",
      icon: "book",
      label: "Dhikr Campaigns",
      endpoint: "/admin/dhikr/campaigns?limit=1",
    },
    {
      key: "admins",
      icon: "shield",
      label: "Administrators",
      endpoint: "/administrators?limit=1",
    },
  ];
  const dashboardToken = state.navToken;

  state.dashboardReady = Promise.allSettled(
    stats.map((s) => api.get(s.endpoint))
  ).then((results) => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (
          state.page !== "Dashboard" ||
          state.navToken !== dashboardToken
        ) {
          resolve();
          return;
        }

        results.forEach((r, i) => {
          const el = $(`[data-count="${stats[i].key}"]`);
          if (!el) return;

          if (r.status === "fulfilled") {
            const total =
              r.value?.meta?.total ??
              r.value?.total ??
              (Array.isArray(r.value) ? r.value.length : null);

            el.textContent = total ?? "—";
          } else {
            el.textContent = "—";
            console.error(
              "Dashboard counter failed:",
              stats[i].endpoint,
              r.reason
            );
          }
        });

        resolve();
      });
    });
  });

  const detectedLabel =
    kind === "detected"
      ? [state.detected.city, state.detected.country].filter(Boolean).join(", ")
      : null;

  let npCard;
  if (kind === "unresolved") {
    npCard = alertCard(
      "globe",
      "Location not detected",
      "We can't show prayer times without knowing your location. Allow browser location or pick a city manually.",
      `<button type="button" class="btn" data-act="dash-detect-loc">${ic("globe")}Detect my location</button>
       <button type="button" class="b3" data-act="go" data-p="Prayer Times">${ic("clock")}Pick a city manually</button>`,
    );
  } else if (kind === "detected" && !todayTimes) {
    npCard = alertCard(
      "clock",
      "Couldn't load prayer times",
      `We detected "${esc(state.detected.city || "your location")}" but the prayer time service didn't respond.`,
      `<button type="button" class="btn" data-act="dash-refresh-loc">${ic("refresh")}Retry</button>`,
    );
  } else {
    npCard = renderNextPrayer(todayTimes, cities, detectedLabel);
  }

  if (kind === "detected" && todayTimes && !state.detectedToastShown) {
    state.detectedToastShown = true;
    const label =
      detectedLabel ||
      `${state.detected.lat.toFixed(3)}, ${state.detected.lon.toFixed(3)}`;
    setTimeout(() => toast(`📍 Using computed prayer times for ${label}`), 400);
  }

  return `
    ${dashboardSvgDefs()}
    <div class="card glass hero s8">
      <svg class="wv" viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 35C50 5 150 65 200 35S350 5 400 35 550 65 600 35 750 5 800 35V70H0Z"/>
      </svg>
      <h2>${esc(greet)}, ${esc(cap(name))} 👋</h2>
      ${hijriLine ? `<p>${esc(hijriLine)}</p>` : ""}
      <div class="hrow"><span>${ic("clock")}${esc(today)}</span></div>
      ${quick.length ? `<div class="qa">${quick.join("")}</div>` : ""}
    </div>
    ${npCard}
    ${stats
      .map(
        (s) => `<div class="card glass s4 stat">
          <div class="top"><div class="ic">${ic(s.icon)}</div></div>
          <div class="num" data-count="${s.key}">…</div>
          <div class="lbl">${esc(s.label)}</div>
        </div>`,
      )
      .join("")}
    ${await platformCard()}`;
}

// ---- Location detection -------------------------------------------------------
const LOCATION_CACHE_KEY = "nea:detected_v1";
const LOCATION_ASKED_KEY = "nea:loc_asked";
const CITY_PREF_KEY = "nea:prayer_city_v1";
const LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function savePrayerCityPref(key) {
  if (key && key !== "__detected__") store.set(CITY_PREF_KEY, key);
}

function persistDetected(detected) {
  if (!detected) return store.del(LOCATION_CACHE_KEY);
  store.set(
    LOCATION_CACHE_KEY,
    JSON.stringify({ ...detected, _cachedAt: Date.now() }),
  );
}

function loadPersistedDetected() {
  try {
    const raw = store.get(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d._cachedAt || Date.now() - d._cachedAt > LOCATION_MAX_AGE_MS) {
      store.del(LOCATION_CACHE_KEY);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function browserGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error("Browser geolocation is not supported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied. Enable it in your browser settings."
              : err.code === err.POSITION_UNAVAILABLE
                ? "Location unavailable. Check your network or GPS."
                : "Location request timed out.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 },
    );
  });
}

async function detectLocationFromBrowser() {
  try {
    const coords = await browserGeolocation();
    const d = await api.get(
      `/location/get?lat=${coords.lat}&lon=${coords.lon}`,
    );
    await ensureCities();

    state.detected = {
      lat: coords.lat,
      lon: coords.lon,
      city: d.city,
      state: d.state,
      country: d.country,
      country_code: d.country_code,
      postcode: d.postcode,
      formatted_address: d.formatted_address,
      source: "browser",
      cached: d.cached,
    };
    persistDetected(state.detected);

    const match = matchCity(d.city);
    state.prayerCity = match ? match.key : null;
    state.prayerCityPage = match ? match.key : null;
    if (match) toast(`Location detected: ${d.city}, ${d.country}`);
    else
      toast(
        `Detected ${d.city || "your area"} — using computed prayer times for these coordinates.`,
      );

    return { coords, data: d, match };
  } catch (e) {
    toast(e.message || "Could not detect location", true);
    throw e;
  }
}

async function autoPromptLocationIfNeeded() {
  if (store.get(LOCATION_ASKED_KEY) === "1" || !navigator.geolocation) return;
  store.set(LOCATION_ASKED_KEY, "1"); // ask once per browser

  let permission = null;
  try {
    permission = (await navigator.permissions.query({ name: "geolocation" }))
      .state;
  } catch {}
  if (permission === "denied") return;

  try {
    await detectLocationFromBrowser();
  } catch {}
}

// ============================================================================
// Generic CRUD
// ============================================================================
const LANGS = [
  ["en", "English"],
  ["guj", "Gujarati"],
  ["hin", "Hindi"],
  ["ur", "Urdu", true],
  ["ar", "Arabic", true],
  ["sw", "Swahili"],
];
const LANG_PARTS = ["short_name", "full_name", "fazilat"];

const langFields = () => [
  { sec: "General" },
  { k: "position", l: "Position", t: "number" },
  ...LANGS.flatMap(([c, name, rtl]) => [
    { sec: name },
    { k: `${c}_short_name`, l: "Short name", ar: rtl, full: 1 },
    {
      k: `${c}_full_name`,
      l: "Full text",
      t: "area",
      rows: c === "ar" ? 4 : 3,
      ar: rtl,
      full: 1,
    },
    {
      k: `${c}_fazilat`,
      l: "Fazilat / Benefit",
      t: "area",
      rows: 2,
      ar: rtl,
      full: 1,
    },
  ]),
];

const langColumns = () => [
  { label: "Position", get: (x) => x.position },
  {
    label: "Title",
    html: true,
    wrap: true,
    get: (x) =>
      `<strong>${esc(x.en_short_name || "Untitled")}</strong><div class="content-secondary" dir="rtl">${esc(x.ar_short_name || "")}</div><small class="content-secondary">${esc(x.guj_short_name || "")}</small>`,
  },
  {
    label: "Languages",
    get: (x) =>
      `${LANGS.filter(([c]) => x[c + "_short_name"]?.trim() && x[c + "_full_name"]?.trim()).length}/6`,
  },
  { label: "Fazilat", get: (x) => (x.en_fazilat ? "Available" : "—") },
];
function tabLanguageEditor(form) {
  const fields = $(".mf", form);
  const tabs = document.createElement("div");
  tabs.className = "content-tabs full";
  tabs.innerHTML = LANGS.map(
    ([k, l]) =>
      `<button type="button" data-lang="${k}" class="b3">${l}</button>`,
  ).join("");
  const first = fields.querySelector('[name="en_short_name"]')?.closest("div");
  if (!first) return;
  const heading = first.previousElementSibling;
  heading.before(tabs);
  const show = (k) => {
    for (const [c] of LANGS) {
      const start = fields
        .querySelector(`[name="${c}_short_name"]`)
        ?.closest("div");
      if (start?.previousElementSibling?.classList.contains("sec"))
        start.previousElementSibling.hidden = c !== k;
      for (const part of LANG_PARTS) {
        const el = fields.querySelector(`[name="${c}_${part}"]`);
        if (el) el.closest("div").hidden = c !== k;
      }
    }
    const tr = fields.querySelector(".tr-btn");
    if (tr) tr.parentElement.hidden = k !== "en";
    for (const b of tabs.children) {
      b.className = b.dataset.lang === k ? "b2" : "b3";
      b.setAttribute("aria-pressed", String(b.dataset.lang === k));
    }
  };
  tabs.onclick = (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) show(b.dataset.lang);
  };
  show("en");
}

// Adds an "Auto-translate English → all languages" button under the English fields.
function autoTranslateHook(endpoint) {
  return (form) => {
    const en = LANG_PARTS.map((k) => form.querySelector(`[name="en_${k}"]`));
    if (en.some((el) => !el)) return;

    const label = `${ic("globe")}Auto-translate English → all languages`;
    const wrap = document.createElement("div");
    wrap.className = "full";
    wrap.innerHTML = `<button type="button" class="b3 tr-btn">${label}</button>`;
    const btn = wrap.firstElementChild;
    en[2].closest("div").after(wrap);

    btn.onclick = async () => {
      const [short, full, fazilat] = en.map((el) => el.value.trim());
      if (!short && !full && !fazilat)
        return toast("Enter English text first", true);
      btn.disabled = true;
      btn.textContent = "Translating…";
      try {
        const data = await api.post(endpoint, {
          en_short_name: short || null,
          en_full_name: full || null,
          en_fazilat: fazilat || null,
        });
        LANGS.slice(1).forEach(([c]) =>
          LANG_PARTS.forEach((k) => {
            const el = form.querySelector(`[name="${c}_${k}"]`);
            if (el && data[`${c}_${k}`] != null) el.value = data[`${c}_${k}`];
          }),
        );
        toast("Translated — review before saving");
      } catch (e) {
        toast(e.message || "Auto-translate failed", true);
      } finally {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    };
  };
}

const contentCrud = (endpoint, singular, title, sub, icon) => ({
  endpoint,
  singular,
  title,
  sub,
  icon,
  perm: endpoint.slice(1),
  size: "lg",
  label: (x) => x.en_short_name || `#${x.id}`,
  columns: langColumns(),
  fields: langFields(),
  onOpen: (form) => {
    autoTranslateHook(`${endpoint}/auto-translate`)(form);
    tabLanguageEditor(form);
  },
});

const roleChip = (r, checked) =>
  `<label class="role-chip"><input type="checkbox" name="__role_${r.id}" value="${r.id}"${checked ? " checked" : ""}><span>${esc(r.name)}</span></label>`;

const CRUD = {
  Duas: contentCrud(
    "/duas",
    "Dua",
    "Dua List",
    "Supplications shown in the app · 6 languages + fazilat",
    "heart",
  ),
  Dhikrs: contentCrud(
    "/dhikrs",
    "Dhikr",
    "Dhikr List",
    "Remembrances for the tasbih counter · 6 languages + fazilat",
    "beads",
  ),
  Administrators: {
    endpoint: "/administrators",
    singular: "Administrator",
    title: "Administrators",
    sub: "People who can sign in — new admins come in via Invitations",
    icon: "shield",
    perm: "administrators",
    label: (x) =>
      `${x.first_name || ""} ${x.last_name || ""}`.trim() || x.email,
    primaryAction: {
      label: "Invite admin",
      icon: "key",
      act: "invite-open",
      perm: "invitations:write",
    },
    hideDelete: true,
    reinvite: true,
    columns: [
      {
        label: "Name",
        get: (x) => `${x.first_name || ""} ${x.last_name || ""}`.trim() || "—",
      },
      { label: "Email", get: (x) => x.email },
      {
        label: "Roles",
        html: true,
        get: (x) => {
          const roles = x.roles || [];
          const pills = roles.length
            ? roles.map((r) => `<span class="pill">${esc(r.name)}</span>`)
            : [
                x.is_admin
                  ? `<span class="pill">Admin</span>`
                  : `<span class="pill off">User</span>`,
              ];
          if (x.has_pending_invite) {
            pills.push(
              `<span class="pill warn" title="Re-invite pending — waiting for acceptance">pending</span>`,
            );
          }
          return pills.join(" ");
        },
      },
    ],
    fields: [
      { k: "first_name", l: "First name" },
      { k: "last_name", l: "Last name" },
    ],
    async onOpen(form, existing) {
      const roles = await ensureRoles();
      if (!form.isConnected) return; // modal closed while loading
      const current = new Set((existing?.roles || []).map((r) => r.id));
      const block = document.createElement("div");
      block.className = "form-block";
      block.innerHTML = `<span class="cap">Roles</span>
        <div class="perm-box">${
          roles.length
            ? roles.map((r) => roleChip(r, current.has(r.id))).join("")
            : `<small class="hint">No roles exist yet — create one on the Roles page.</small>`
        }</div>`;
      form.querySelector(".mf").appendChild(block);
    },
    collect: (form) => ({
      role_ids: $$('input[name^="__role_"]:checked', form).map((cb) =>
        parseInt(cb.value, 10),
      ),
    }),
  },
};

function renderCell(c, x) {
  const v = c.get(x);
  const text = v == null || v === "" ? "—" : String(v);
  const cls = [c.rtl && "rtl", c.wrap && "wrap"].filter(Boolean).join(" ");
  return `<td${cls ? ` class="${cls}"` : ""}>${c.html ? text : esc(text)}</td>`;
}

async function crudPage(key) {
  const cfg = CRUD[key];
  if (!cfg)
    return `<div class="card glass s12"><div class="empty">Unknown page: ${esc(key)}</div></div>`;
  const list = await apiCall(api.get(cfg.endpoint + "?limit=500"), {
    errorPrefix: `Load ${key}`,
  });
  const items = list.items || [];

  let headAction = "";
  if (cfg.primaryAction) {
    if (can(cfg.primaryAction.perm || `${cfg.perm}:write`)) {
      headAction = `<button type="button" class="b2" data-act="${esc(cfg.primaryAction.act)}">${ic(cfg.primaryAction.icon || "plus")}${esc(cfg.primaryAction.label)}</button>`;
    }
  } else if (can(`${cfg.perm}:write`)) {
    headAction = `<button type="button" class="b2" data-act="crud-add" data-key="${esc(key)}">${ic("plus")}Add ${esc(cfg.singular.toLowerCase())}</button>`;
  }

  const head = `<div class="eh">
      <div class="ic">${ic(cfg.icon)}</div>
      <div><h3>${esc(cfg.title)}</h3><p>${esc(cfg.sub)}</p></div>
      ${headAction}
    </div>`;

  if (!items.length) {
    const hint = cfg.primaryAction
      ? `Nothing here yet. Use the <b>${esc(cfg.primaryAction.label)}</b> button above to send the first one.`
      : "Nothing here yet. Use the button above to add the first one.";
    return `<div class="card glass s12">${head}<div class="empty">${hint}</div></div>`;
  }

  const canWrite = can(`${cfg.perm}:write`);
  const actionsFor = (x) => {
    const out = [];
    if (canWrite) {
      out.push(
        `<button type="button" title="Edit" data-act="crud-edit" data-key="${esc(key)}" data-id="${x.id}">${ic("edit")}</button>`,
      );
    }
    if (cfg.reinvite && can("invitations:write")) {
      const pending = x.has_pending_invite === true;
      out.push(
        `<button type="button" title="${pending ? "Resend invite" : "Re-invite admin"}" data-act="admin-reinvite"
           data-id="${x.id}" data-email="${esc(x.email)}" data-pending="${pending}"
           ${pending ? 'class="bad"' : ""}>${ic("refresh")}</button>`,
      );
    }
    if (!cfg.hideDelete && canWrite) {
      out.push(
        `<button type="button" class="d" title="Delete" data-act="crud-del" data-key="${esc(key)}" data-id="${x.id}"
           data-label="${esc(cfg.label(x))}">${ic("trash")}</button>`,
      );
    }
    return out.join("") || "—";
  };

  const header =
    cfg.columns.map((c) => `<th>${esc(c.label)}</th>`).join("") +
    "<th>Action</th>";
  const rows = items
    .map(
      (
        x,
      ) => `<tr data-id="${x.id}">${cfg.columns.map((c) => renderCell(c, x)).join("")}
        <td><span class="act-b">${actionsFor(x)}</span></td></tr>`,
    )
    .join("");

  return `<div class="card glass s12">${head}
    <div class="tb"><div class="fld">${ic("search")}<input type="search" placeholder="Search…" aria-label="Search" data-filter></div></div>
    <div class="tw"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="foot">${items.length} total</div>
  </div>`;
}

async function openCrudForm(key, id) {
  const cfg = CRUD[key];
  if (!cfg) return;
  if (!can(`${cfg.perm}:write`))
    return toast("You don't have permission to edit this resource", true);

  let existing = null;
  if (id != null) {
    try {
      existing = await api.get(`${cfg.endpoint}/${id}`);
    } catch (e) {
      return toast("Load failed: " + e.message, true);
    }
  }

  formModal({
    title: `${id != null ? "Edit" : "Add"} ${cfg.singular.toLowerCase()}`,
    fields: cfg.fields,
    data: existing || {},
    size: cfg.size || "",
    onOpen: (form) => cfg.onOpen?.(form, existing),
    onSubmit: async (vals) => {
      if (cfg.collect) Object.assign(vals, cfg.collect($("#mform")));
      try {
        if (id != null) await api.patch(`${cfg.endpoint}/${id}`, vals);
        else await api.post(cfg.endpoint, vals);
        api.cache.invalidate("roles");
        toast(id != null ? "Saved" : "Created");
        await go(state.page);
        return null;
      } catch (e) {
        return e.message || "Save failed";
      }
    },
  });
}

function confirmDelete(key, id, label) {
  const cfg = CRUD[key];
  if (!cfg) return;
  confirmBox({
    title: `Delete ${cfg.singular.toLowerCase()}?`,
    msg: `"${label}" will be permanently deleted.`,
    onOk: async () => {
      try {
        await api.del(`${cfg.endpoint}/${id}`);
        toast("Deleted");
        await go(state.page);
      } catch (e) {
        toast(e.message || "Delete failed", true);
      }
    },
  });
}

// ============================================================================
// Invitations
// ============================================================================
async function invitationsPage() {
  let invites = [];
  try {
    invites = await api.get("/admin/invitations");
  } catch (e) {
    return `<div class="card glass s12"><div class="empty">${ic("x")} ${esc(e.message || "Failed to load invitations")}</div></div>`;
  }

  const count = (s) => invites.filter((x) => x.status === s).length;
  const head = `<div class="eh">
      <div class="ic">${ic("key")}</div>
      <div><h3>Invitations</h3><p>Pending, accepted, and revoked admin invitations</p></div>
      ${can("invitations:write") ? `<button type="button" class="b2" data-act="invite-open">${ic("plus")}Invite admin</button>` : ""}
    </div>`;

  const statCard = (icon, n, label) =>
    `<div class="card glass s4 stat"><div class="top"><div class="ic">${ic(icon)}</div></div>
       <div class="num">${n}</div><div class="lbl">${label}</div></div>`;
  const stats =
    statCard("clock", count("pending"), "Pending") +
    statCard("check", count("accepted"), "Accepted") +
    statCard("x", count("revoked"), "Revoked");

  if (!invites.length) {
    return `<div class="card glass s12">${head}</div>${stats}
      <div class="card glass s12"><div class="empty">No invitations yet. Click <b>Invite admin</b> to send the first one.</div></div>`;
  }

  const pill = (s) =>
    ({
      pending: `<span class="pill warn">pending</span>`,
      accepted: `<span class="pill ok">accepted</span>`,
      revoked: `<span class="pill off">revoked</span>`,
      expired: `<span class="pill off">expired</span>`,
    })[s] || `<span class="pill off">${esc(s)}</span>`;
  const when = (v) => esc((v || "").replace("T", " ").slice(0, 16));
  const canWrite = can("invitations:write");

  const rows = invites
    .map((inv) => {
      const actions = [];
      if (canWrite && (inv.status === "pending" || inv.status === "expired")) {
        actions.push(
          `<button type="button" title="Resend" data-act="invite-resend" data-id="${inv.id}">${ic("refresh")}</button>`,
        );
      }
      if (canWrite && inv.status === "pending") {
        actions.push(
          `<button type="button" class="d" title="Revoke" data-act="invite-revoke" data-id="${inv.id}" data-email="${esc(inv.email)}">${ic("trash")}</button>`,
        );
      }
      return `<tr>
        <td>#${inv.id}</td><td>${esc(inv.email)}</td><td>${esc(inv.role_name || "—")}</td>
        <td>${esc(inv.inviter_name || "—")}</td><td>${pill(inv.status)}</td>
        <td>${when(inv.expires_at)}</td><td>${when(inv.created_at)}</td>
        <td><span class="act-b">${actions.join("") || "—"}</span></td>
      </tr>`;
    })
    .join("");

  return `<div class="card glass s12">${head}</div>${stats}
    <div class="card glass s12">
      <div class="tb"><div class="fld">${ic("search")}<input type="search" placeholder="Search invitations…" data-filter></div></div>
      <div class="tw"><table>
        <thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Invited by</th><th>Status</th><th>Expires</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="foot">${invites.length} total</div>
    </div>`;
}

async function openInviteForm() {
  if (!can("invitations:write"))
    return toast("You don't have permission to invite admins", true);

  const roles = await ensureRoles();
  formModal({
    title: "Invite a new administrator",
    okLabel: "Send invite",
    fields: [
      {
        k: "email",
        l: "Email",
        t: "email",
        req: 1,
        full: 1,
        h: "They'll receive an invite email with a link to set their password.",
      },
      {
        k: "role_id",
        l: "Role",
        t: "select",
        o: ["", ...roles.map((r) => r.name)],
        full: 1,
        h: "Optional. The role the new admin will get.",
      },
    ],
    onSubmit: async (vals) => {
      const role = vals.role_id
        ? roles.find((r) => r.name === vals.role_id)
        : null;
      try {
        await api.post("/admin/invitations", {
          email: vals.email,
          role_id: role ? role.id : null,
        });
        toast("Invitation sent");
        await go("Invitations");
        return null;
      } catch (e) {
        return e.message || "Invite failed";
      }
    },
  });
}

// ============================================================================
// Roles
// ============================================================================
const titleCase = (s) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function permGridHtml(catalog, selectedCodes) {
  const selected = new Set(selectedCodes || []);
  return Object.keys(catalog.groups || {})
    .sort()
    .map((group) => {
      const codes = catalog.groups[group];
      return `<div class="perm-group">
        <div class="perm-head">
          <input type="checkbox" id="pg_${esc(group)}" data-group-toggle="${esc(group)}"${codes.every((c) => selected.has(c)) ? " checked" : ""}>
          <label for="pg_${esc(group)}">${esc(titleCase(group))}</label>
        </div>
        <div class="perm-list">
          ${codes
            .map(
              (code) => `<label class="role-chip">
                <input type="checkbox" name="__perm" value="${esc(code)}" data-group="${esc(group)}"${selected.has(code) ? " checked" : ""}>
                <span>${esc(code.split(":")[1] || code)}</span></label>`,
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("");
}

function wirePermGrid(form) {
  const perms = () => $$('input[name="__perm"]', form);
  const toggles = () => $$("input[data-group-toggle]", form);
  const updateCount = () => {
    const el = $("#perm-count", form);
    if (el)
      el.textContent = `${perms().filter((c) => c.checked).length} selected`;
  };
  const setAll = (on) => {
    perms().forEach((c) => (c.checked = on));
    toggles().forEach((c) => (c.checked = on));
    updateCount();
  };

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.groupToggle) {
      perms()
        .filter((c) => c.dataset.group === t.dataset.groupToggle)
        .forEach((c) => (c.checked = t.checked));
    } else if (t.name === "__perm") {
      const group = perms().filter((c) => c.dataset.group === t.dataset.group);
      const toggle = toggles().find(
        (c) => c.dataset.groupToggle === t.dataset.group,
      );
      if (toggle) toggle.checked = group.every((c) => c.checked);
    } else return;
    updateCount();
  });
  $("[data-perm-all]", form).onclick = () => setAll(true);
  $("[data-perm-none]", form).onclick = () => setAll(false);
  updateCount();
}

async function openRoleForm(existing) {
  if (!can("roles:write"))
    return toast("You don't have permission to manage roles", true);

  let catalog;
  try {
    catalog = await api.get("/roles/permissions/catalog");
  } catch (e) {
    return toast("Could not load permission catalogue: " + e.message, true);
  }

  const isEdit = !!existing;
  formModal({
    title: isEdit ? `Edit role: ${existing.name}` : "Create role",
    okLabel: isEdit ? "Save changes" : "Create role",
    size: "lg",
    data: existing || {},
    fields: [
      {
        k: "name",
        l: "Role name",
        req: 1,
        full: 1,
        h: "e.g. Content Manager, Moderator",
      },
      {
        k: "description",
        l: "Description",
        full: 1,
        h: "Optional. Short summary shown on the Roles page.",
      },
    ],
    onOpen: (form) => {
      const block = document.createElement("div");
      block.className = "form-block";
      block.innerHTML = `<span class="cap">Permissions <em id="perm-count"></em></span>
        <div class="perm-box">${permGridHtml(catalog, existing?.permissions)}</div>
        <div class="row-btns">
          <button type="button" class="b3" data-perm-all>${ic("check")}Select all</button>
          <button type="button" class="b3" data-perm-none>${ic("x")}Clear</button>
        </div>`;
      form.querySelector(".mf").appendChild(block);
      wirePermGrid(form);
    },
    onSubmit: async (vals) => {
      const permissions = $$('#mform input[name="__perm"]:checked').map(
        (cb) => cb.value,
      );
      if (!permissions.length) return "Pick at least one permission.";
      const body = {
        name: vals.name,
        description: vals.description || null,
        permissions,
      };
      try {
        if (isEdit) await api.patch(`/roles/${existing.id}`, body);
        else
          await api.post("/roles", {
            ...body,
            is_admin: true,
            is_default: false,
          });
        toast(
          `Role "${vals.name}" ${isEdit ? "updated" : "created"} (${permissions.length} permissions)`,
        );
        await ensureRoles(true);
        await go("Roles");
        return null;
      } catch (e) {
        return e.message || "Save failed";
      }
    },
  });
}

function confirmDeleteRole(id, name, userCount) {
  if (!can("roles:write"))
    return toast("You don't have permission to delete roles", true);
  confirmBox({
    title: `Delete role "${name}"?`,
    msg:
      userCount > 0
        ? `This role is assigned to ${plural(userCount, "admin")}. They will lose these permissions on their next request. This cannot be undone.`
        : "This role has no assigned users. Deletion is safe.",
    onOk: async () => {
      try {
        await api.del(`/roles/${id}`);
        toast(`Role "${name}" deleted`);
        await ensureRoles(true);
        await go("Roles");
      } catch (e) {
        toast(e.message || "Delete failed", true);
      }
    },
  });
}

async function rolesPage() {
  let roles = [];
  let catalog = { groups: {}, all: [] };
  try {
    [roles, catalog] = await Promise.all([
      api.get("/roles"),
      api.get("/roles/permissions/catalog"),
    ]);
  } catch (e) {
    return `<div class="card glass s12"><div class="empty">${ic("x")} ${esc(e.message || "Failed to load roles")}</div></div>`;
  }

  const canWrite = can("roles:write");
  const head = `<div class="eh">
      <div class="ic">${ic("roles")}</div>
      <div><h3>Roles</h3><p>${plural(roles.length, "role")} · permissions granted to admins</p></div>
      ${canWrite ? `<button type="button" class="b2" data-act="role-create">${ic("plus")}New role</button>` : ""}
    </div>`;

  if (!roles.length) {
    return `<div class="card glass s12">${head}<div class="empty">No roles yet. ${
      canWrite
        ? "Click <b>New role</b> to create the first one."
        : "Ask a Super Admin to create one."
    }</div></div>`;
  }

  const rows = roles
    .map((r) => {
      const type = r.is_default
        ? `<span class="pill ok">default</span>`
        : r.is_admin
          ? `<span class="pill">admin</span>`
          : `<span class="pill off">user</span>`;
      const actions = [
        canWrite &&
          `<button type="button" title="Edit permissions" data-act="role-edit-perms" data-id="${r.id}">${ic("edit")}</button>`,
        canWrite &&
          !r.is_default &&
          `<button type="button" class="d" title="Delete" data-act="role-delete" data-id="${r.id}" data-name="${esc(r.name)}" data-users="${r.user_count || 0}">${ic("trash")}</button>`,
      ].filter(Boolean);
      return `<tr data-id="${r.id}">
        <td>#${r.id}</td><td><b>${esc(r.name)}</b></td>
        <td>${r.description ? esc(r.description) : "—"}</td><td>${type}</td>
        <td><b>${(r.permissions || []).length}</b> / ${catalog.all.length}</td>
        <td>${r.user_count || 0}</td>
        <td><span class="act-b">${actions.join("") || "—"}</span></td>
      </tr>`;
    })
    .join("");

  return `<div class="card glass s12">${head}
    <div class="tb"><div class="fld">${ic("search")}<input type="search" placeholder="Search roles…" data-filter></div></div>
    <div class="tw"><table>
      <thead><tr><th>ID</th><th>Name</th><th>Description</th><th>Type</th><th>Permissions</th><th>Users</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="foot">${roles.length} total</div>
  </div>`;
}

// ============================================================================
// Wallpapers
// ============================================================================
async function wallpapersPage() {
  const r = await apiCall(api.get("/wallpapers?limit=500"), {
    errorPrefix: "Load wallpapers",
  });
  const items = r.items || [];
  const canWrite = can("wallpapers:write");

  const head = `<div class="eh">
      <div class="ic">${ic("img")}</div>
      <div><h3>Wallpapers</h3><p>Backgrounds people can set from the app</p></div>
      ${canWrite ? `<button type="button" class="b2" data-act="wall-add">${ic("plus")}Add wallpaper</button>` : ""}
    </div>`;

  if (!items.length) {
    return `<div class="card glass s12">${head}<div class="empty">No wallpapers yet. Use the button above to add the first one.</div></div>`;
  }

  const tiles = items
    .map(
      (
        w,
      ) => `<div class="wp" data-act="wall-preview" data-id="${w.id}" role="button" tabindex="0" title="Preview ${esc(w.name)}">
        ${w.image ? `<img src="${esc(w.image)}" alt="${esc(w.name)}" loading="lazy">` : ""}
        ${
          canWrite
            ? `<span class="act-b">
                <button type="button" title="Edit" data-act="wall-edit" data-id="${w.id}">${ic("edit")}</button>
                <button type="button" class="d" title="Delete" data-act="wall-del" data-id="${w.id}" data-label="${esc(w.name)}">${ic("trash")}</button>
              </span>`
            : ""
        }
        <span class="n">${esc(w.name)}</span>
      </div>`,
    )
    .join("");

  return `<div class="card glass s12">${head}<div class="wg">${tiles}</div><div class="foot">${items.length} total</div></div>`;
}

async function wallPreview(id) {
  try {
    const w = await api.get(`/wallpapers/${id}`);
    openModal(
      `${modalHeader(w.name)}
       <div class="mbody"><div class="wprev"><img src="${esc(w.image)}" alt="${esc(w.name)}"></div></div>
       <div class="mfoot split">
         <small>${esc(w.image)}</small>
         <a href="${esc(w.image)}" target="_blank" rel="noopener" class="b3">${ic("down")}Open original</a>
       </div>`,
    );
  } catch (e) {
    toast("Preview failed: " + e.message, true);
  }
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function openWallForm(existing) {
  if (!can("wallpapers:write"))
    return toast("You don't have permission to edit wallpapers", true);

  const isEdit = !!existing;
  openModal(`
    <form id="wallform" novalidate>
      ${modalHeader(`${isEdit ? "Edit" : "Add"} wallpaper`)}
      <div class="mf">
        <div class="full">
          <label for="wf_name">Name <span class="rq">*</span></label>
          <input class="in" id="wf_name" name="name" value="${esc(existing?.name || "")}" autocomplete="off">
        </div>
        <div class="full">
          <label>Image source</label>
          <div class="seg" id="wf_modes">
            <button type="button" class="on" data-mode="url">${ic("globe")}Paste URL</button>
            <button type="button" data-mode="file">${ic("upload")}Upload file</button>
          </div>
        </div>
        <div class="full" id="wf_mode_url">
          <label for="wf_url">Image URL <span class="rq">*</span></label>
          <input class="in" id="wf_url" value="${esc(existing?.image || "")}" placeholder="https://…" autocomplete="off">
          <div class="hint">${isEdit ? "Change to update the image, or leave as-is" : "Public image URL — from R2, imgbb, or any host"}</div>
        </div>
        <div class="full" id="wf_mode_file" hidden>
          <label>Image file</label>
          <input type="file" id="wf_file" accept="${IMAGE_TYPES.join(",")}" hidden>
          <div class="dz" id="wf_dz" role="button" tabindex="0">
            <div class="ic">${ic("upload")}</div>
            <b>Click to pick a file</b>
            <small>JPEG, PNG or WebP · max 10 MB</small>
          </div>
          <div class="dz-preview" id="wf_preview">
            <img id="wf_preview_img" alt="">
            <small id="wf_preview_meta"></small>
          </div>
        </div>
        <div class="full hint" id="wf_status"></div>
      </div>
      <div class="err" id="wf_err" role="alert"></div>
      <div class="mfoot">
        <button type="button" class="b3" data-act="close">Cancel</button>
        <button class="btn" type="submit"><span class="bt">${isEdit ? "Save" : "Create"}</span><span class="sp2"></span></button>
      </div>
    </form>`);

  const form = $("#wallform");
  const errEl = $("#wf_err");
  const status = $("#wf_status");
  const fileInput = $("#wf_file");
  const dz = $("#wf_dz");
  const preview = $("#wf_preview");
  let mode = "url";
  let previewUrl = null;

  $$("#wf_modes button").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      $$("#wf_modes button").forEach((x) => x.classList.toggle("on", x === b));
      $("#wf_mode_url").hidden = mode !== "url";
      $("#wf_mode_file").hidden = mode !== "file";
    }),
  );

  function showPreview(f) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    preview.style.display = "none";
    if (!IMAGE_TYPES.includes(f.type))
      return void (errEl.textContent = "Only JPEG, PNG, or WebP allowed");
    if (f.size > MAX_IMAGE_BYTES)
      return void (errEl.textContent = "Max file size is 10 MB");
    errEl.textContent = "";
    previewUrl = URL.createObjectURL(f);
    $("#wf_preview_img").src = previewUrl;
    $("#wf_preview_meta").textContent =
      `${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
    preview.style.display = "block";
  }

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("drag");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag");
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    fileInput.files = dt.files;
    showPreview(f);
  });
  fileInput.addEventListener(
    "change",
    () => fileInput.files?.[0] && showPreview(fileInput.files[0]),
  );

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $(".btn", form);
    errEl.textContent = "";
    status.textContent = "";

    const name = $("#wf_name").value.trim();
    if (!name) {
      errEl.textContent = "Name is required";
      return $("#wf_name").focus();
    }

    btn.classList.add("load");
    btn.disabled = true;
    try {
      let image;
      if (mode === "url") {
        image = $("#wf_url").value.trim();
        if (!image) throw new Error("Image URL is required");
        if (!/^https?:\/\//i.test(image))
          throw new Error("Image URL must start with http:// or https://");
      } else {
        const f = fileInput.files?.[0];
        if (!f) throw new Error("Choose a file to upload");
        status.textContent = "Uploading…";
        const fd = new FormData();
        fd.append("file", f);
        image = (await postForm("/wallpapers/upload-image", fd)).url;
        status.textContent = "Uploaded — saving…";
      }

      if (isEdit)
        await api.patch(`/wallpapers/${existing.id}`, { name, image });
      else await api.post("/wallpapers", { name, image });

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      closeModal();
      toast(isEdit ? "Saved" : "Created");
      await go("Wallpapers");
    } catch (err) {
      errEl.textContent = err.message || "Save failed";
      status.textContent = "";
    } finally {
      btn.classList.remove("load");
      btn.disabled = false;
    }
  };
}

// ============================================================================
// Reciters (list + surah playback)
// ============================================================================
function stopAudio() {
  stopSurahAudio();
  resetSurahButtons();
}

function resetSurahButtons() {
  $$('[data-act="reciter-play-surah"]').forEach((b) => {
    b.innerHTML = ic("play");
    b.title = "Play surah";
  });
}

async function recitersPage() {
  if (state.reciterSlug) return reciterDetailPage(state.reciterSlug);

  const r = await apiCall(api.get("/reciters?limit=500"), {
    errorPrefix: "Load reciters",
  });
  const items = r.items || [];

  const head = `<div class="eh">
      <div class="ic">${ic("head")}</div>
      <div><h3>Reciters</h3><p>Quran audio — open a reciter to browse and play surahs</p></div>
    </div>`;

  if (!items.length)
    return `<div class="card glass s12">${head}<div class="empty">No reciters yet.</div></div>`;

  const rows = items
    .map(
      (x) => `<tr data-id="${x.id}">
        <td>${esc(x.position ?? "—")}</td>
        <td>${esc(x.name)}</td>
        <td class="wrap">${esc(x.slug)}</td>
        <td>${esc(x.bitrate || "—")}</td>
        <td>${esc(x.total_ayahs ?? "—")}</td>
        <td><span class="act-b">
          <button type="button" title="View surahs" data-act="reciter-view" data-slug="${esc(x.slug)}">${ic("book")}</button>
        </span></td>
      </tr>`,
    )
    .join("");

  return `<div class="card glass s12">${head}
    <div class="tb"><div class="fld">${ic("search")}<input type="search" placeholder="Search reciters…" data-filter></div></div>
    <div class="tw"><table>
      <thead><tr><th>Position</th><th>Name</th><th>Slug</th><th>Bitrate</th><th>Ayahs</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="foot">${items.length} total</div>
  </div>`;
}

async function reciterDetailPage(slug) {
  let data;
  try {
    data = await api.get(`/reciters/${encodeURIComponent(slug)}/surahs`);
  } catch (e) {
    return `<div class="card glass s12"><div class="empty">
      Could not load surahs: ${esc(e.message || "request failed")}
      <button type="button" class="b3" data-act="reciter-back">← Back to reciters</button></div></div>`;
  }

  const reciter = data.reciter || {};
  const surahs = data.surahs || [];
  const subtitle = [
    reciter.bitrate ? `${reciter.bitrate} kbps` : null,
    `${surahs.length} surahs`,
    reciter.total_ayahs
      ? `${reciter.total_ayahs.toLocaleString()} ayahs`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows = surahs
    .map(
      (s) => `<tr>
        <td><b>${s.number}</b></td>
        <td class="rtl">${esc(s.arabic_name || `Surah ${s.number}`)}</td>
        <td>${s.verses_count}</td>
        <td><span class="act-b">
          <button type="button" title="Play surah" data-act="reciter-play-surah" data-slug="${esc(slug)}" data-n="${s.number}">${ic("play")}</button>
        </span></td>
      </tr>`,
    )
    .join("");

  return `<div class="card glass s12">
    <div class="eh">
      <button type="button" class="b3" data-act="reciter-back" aria-label="Back to reciters">← Back</button>
      <div class="ic">${ic("head")}</div>
      <div><h3>${esc(reciter.name || slug)}</h3><p>${esc(subtitle)}</p></div>
    </div>
    <div class="tb"><div class="fld">${ic("search")}<input type="search" placeholder="Search surah…" data-filter></div></div>
    <div class="tw"><table>
      <thead><tr><th>#</th><th>Surah</th><th>Verses</th><th>Play</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="foot">${surahs.length} surahs · press ▶ to play sequentially</div>
  </div>`;
}

// ---- Gapless surah playback (Web Audio) -----------------------------------------
let audioCtx = null;
const getAudioCtx = () =>
  (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());

async function fetchAyahBuffer(sp, i) {
  const resp = await fetch(`${sp.host}/${sp.ayahList[i]}`, { mode: "cors" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ayah ${i + 1}`);
  return getAudioCtx().decodeAudioData(await resp.arrayBuffer());
}

function stopSurahAudio() {
  const sp = state.surahPlayer;
  if (!sp) return;
  sp.cancelled = true;
  sp.sources.forEach((s) => {
    try {
      s.stop();
    } catch {}
  });
  state.surahPlayer = null;
}

async function playReciterSurah(slug, surahNum, btn) {
  // Same surah → pause / resume
  const current = state.surahPlayer;
  if (current && current.slug === slug && current.surah === surahNum) {
    if (current.ctx.state === "running") {
      await current.ctx.suspend();
      btn.innerHTML = ic("play");
      btn.title = "Resume";
    } else {
      await current.ctx.resume();
      btn.innerHTML = ic("pause");
      btn.title = "Pause";
    }
    return;
  }

  stopSurahAudio();
  resetSurahButtons();
  btn.textContent = "…";
  btn.disabled = true;

  try {
    const r = await api.get(
      `/reciters/${encodeURIComponent(slug)}/surah/${surahNum}`,
    );
    if (!r.ayah_list || !r.ayah_list.length) {
      toast("No audio for this surah", true);
      btn.innerHTML = ic("play");
      return;
    }

    const ctx = getAudioCtx();
    await ctx.resume(); // must follow a user gesture

    const sp = {
      slug,
      surah: surahNum,
      host: r.host.replace(/\/$/, ""),
      ayahList: r.ayah_list,
      ctx,
      sources: [],
      nextStartTime: ctx.currentTime + 0.08,
      btn,
      cancelled: false,
    };
    state.surahPlayer = sp;
    btn.innerHTML = ic("pause");
    btn.title = "Loading…";
    scheduleSurah(sp);
  } catch (e) {
    toast(e.message || "Play failed", true);
    btn.innerHTML = ic("play");
  } finally {
    btn.disabled = false;
  }
}

// Fetch ayahs one by one and schedule each to start exactly when the previous ends.
async function scheduleSurah(sp) {
  const { ctx } = sp;
  const alive = () => state.surahPlayer === sp && !sp.cancelled;

  for (let i = 0; i < sp.ayahList.length; i++) {
    if (!alive()) return;

    let buffer;
    try {
      buffer = await fetchAyahBuffer(sp, i);
    } catch (e) {
      if (alive()) toast(`Ayah ${i + 1} failed: ${e.message}`, true);
      return;
    }
    if (!alive()) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // If the network fell behind the playback clock, snap forward instead of stacking.
    const startAt = Math.max(sp.nextStartTime, ctx.currentTime + 0.02);
    source.start(startAt);
    sp.nextStartTime = startAt + buffer.duration;
    sp.sources.push(source);

    setTimeout(
      () => {
        if (alive() && sp.btn)
          sp.btn.title = `Playing ayah ${i + 1} of ${sp.ayahList.length}`;
      },
      Math.max(0, (startAt - ctx.currentTime) * 1000),
    );

    if (i === sp.ayahList.length - 1) {
      setTimeout(
        () => {
          if (state.surahPlayer !== sp) return;
          state.surahPlayer = null;
          sp.btn.innerHTML = ic("play");
          sp.btn.title = "Play surah";
        },
        Math.max(0, (sp.nextStartTime - ctx.currentTime) * 1000),
      );
    }
  }
}

// ============================================================================
// Prayer Times
// ============================================================================
const PRAYER_FIELDS = [
  "imsak",
  "fajr_start",
  "sunrise",
  "zuhr_start",
  "asr_start",
  "maghrib_start",
  "isha_start",
];
const PRAYER_LABELS = {
  imsak: "Imsak",
  fajr_start: "Fajr",
  sunrise: "Sunrise",
  zuhr_start: "Zuhr",
  asr_start: "Asr",
  maghrib_start: "Maghrib",
  isha_start: "Isha",
};

async function prayerTimesPage() {
  const cities = await ensureCities();
  if (!cities.length) {
    return `<div class="card glass s12"><div class="empty">${ic("x")} No prayer time cities are configured on the server.
      <small style="display:block;margin-top:8px">Ask an admin to seed cities or check <code>tools/cities.py</code>.</small></div></div>`;
  }

  // Priority: explicit selection → detected location → dashboard selection → first city (flagged)
  let city =
    state.prayerCityPage ||
    matchCity(state.detected?.city)?.key ||
    state.prayerCity ||
    null;
  const usedFallback = !city;
  if (!city) city = cities[0].key;

  const cityName = cities.find((c) => c.key === city)?.name || city;
  const year = state.prayerYear || new Date().getFullYear();
  const month = state.prayerMonth ?? new Date().getMonth();
  const canWrite = can("prayer-times:write");

  const banner = usedFallback
    ? `<div class="card glass s12" style="border-left:4px solid var(--bad)">
        <div class="ch">
          <div class="ic bad">${ic("x")}</div>
          <div><b>Showing "${esc(cityName)}" — not your detected location</b><small>We couldn't match your location to a known city.</small></div>
        </div>
        <div class="row-btns" style="margin-top:0"><button type="button" class="b3" data-act="dash-detect-loc">${ic("globe")}Detect my location</button></div>
      </div>`
    : "";

  const years = [];
  for (let y = 2000; y <= 2030; y++) years.push(y);
  if (!years.includes(year)) (years.push(year), years.sort((a, b) => a - b));

  const head = `<div class="eh">
      <div class="ic">${ic("clock")}</div>
      <div><h3>Prayer Times</h3><p>${esc(cityName)} · ${year}</p></div>
      ${canWrite ? `<button type="button" class="b2" data-act="prayer-seed">${ic("plus")}Generate year</button>` : ""}
    </div>
    <div class="tb">
      <div class="tb-field grow">
        <label for="pt-city">City</label>
        <select class="in" id="pt-city" data-change="prayer-city">
          ${cities.map((c) => `<option value="${esc(c.key)}"${c.key === city ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="tb-field">
        <label for="pt-year">Year</label>
        <select class="in" id="pt-year" data-change="prayer-year">
          ${years.map((y) => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="months" role="tablist">
      ${Array.from(
        { length: 12 },
        (
          _,
          i,
        ) => `<button type="button" role="tab" class="${i === month ? "on" : ""}" data-act="prayer-month" data-m="${i}">
          ${new Date(2000, i, 1).toLocaleDateString("en-IN", { month: "short" })}</button>`,
      ).join("")}
    </div>`;

  let items = [];
  try {
    const r = await api.get(
      `/prayer-times?city=${encodeURIComponent(city)}&from=${year}-01-01&to=${year}-12-31&limit=400`,
    );
    items = (r.items || []).filter(
      (it) => parseInt((it.date || "").split("-")[1], 10) - 1 === month,
    );
  } catch (e) {
    toast("Load failed: " + e.message, true);
  }

  const coordCard = `<div class="card glass s12">
      <div class="ch">
        <div class="ic">${ic("globe")}</div>
        <div><b>Prayer times by coordinate</b><small>Any location — auto-computed &amp; cached</small></div>
      </div>
      <div class="fg2">
        <div><label for="ptc-lat">Latitude</label><input class="in" id="ptc-lat" type="number" step="any" placeholder="22.689772"></div>
        <div><label for="ptc-lon">Longitude</label><input class="in" id="ptc-lon" type="number" step="any" placeholder="72.855056"></div>
      </div>
      <div class="row-btns">
        <button type="button" class="b3" data-act="pt-by-coord">${ic("clock")}Get times</button>
        <button type="button" class="b3" data-act="pt-use-my-loc">${ic("globe")}Use my location</button>
      </div>
      <div id="pt-coord-result" style="margin-top:12px"></div>
    </div>`;

  if (!items.length) {
    return `${banner}<div class="card glass s12">${head}
      <div class="empty">No prayer times for this month.
        ${canWrite ? `<button type="button" class="b3" data-act="prayer-seed">${ic("plus")}Generate year ${year}</button>` : ""}
      </div></div>${coordCard}`;
  }

  const rows = items
    .map((it) => {
      const isFriday =
        it.is_friday === true || new Date(it.date + "T12:00:00").getDay() === 5;
      const zuhr = isFriday
        ? `<td><span class="pill warn">Jummah</span> ${fmtTimeHtml(it.zuhr_start)}</td>`
        : `<td>${fmtTimeHtml(it.zuhr_start)}</td>`;
      return `<tr${isFriday ? ' class="today"' : ""}>
        <td>${esc(it.date)}</td>
        <td>${fmtTimeHtml(it.imsak)}</td><td>${fmtTimeHtml(it.fajr_start)}</td><td>${fmtTimeHtml(it.sunrise)}</td>
        ${zuhr}
        <td>${fmtTimeHtml(it.asr_start)}</td><td>${fmtTimeHtml(it.maghrib_start)}</td><td>${fmtTimeHtml(it.isha_start)}</td>
        <td>${canWrite ? `<span class="act-b"><button type="button" title="Edit" data-act="prayer-edit" data-id="${it.id}">${ic("edit")}</button></span>` : ""}</td>
      </tr>`;
    })
    .join("");

  return `${banner}<div class="card glass s12">${head}
    <div class="tw"><table>
      <thead><tr><th>Date</th><th>Imsak</th><th>Fajr</th><th>Sunrise</th><th>Zuhr / Jummah</th><th>Asr</th><th>Maghrib</th><th>Isha</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="foot">${items.length} days · edit on Fridays to override the Jummah time</div>
  </div>${coordCard}`;
}

async function prayerEdit(id) {
  if (!can("prayer-times:write"))
    return toast("You don't have permission to edit prayer times", true);
  const it = await apiCall(api.get(`/prayer-times/${id}`), {
    errorPrefix: "Load",
  });
  formModal({
    title: `Edit ${it.date}`,
    fields: PRAYER_FIELDS.map((k) => ({
      k,
      l: PRAYER_LABELS[k],
      h: "HH:MM (24-hour)",
    })),
    data: it,
    onSubmit: async (vals) => {
      try {
        await api.patch(`/prayer-times/${id}`, vals);
        toast("Saved");
        await go("Prayer Times");
        return null;
      } catch (e) {
        return e.message || "Save failed";
      }
    },
  });
}

async function prayerSeed() {
  if (!can("prayer-times:write"))
    return toast("You don't have permission to generate prayer times", true);
  await ensureCities();
  const city = state.prayerCityPage || state.prayerCity;
  const year = state.prayerYear || new Date().getFullYear();
  if (!city)
    return toast(
      "Pick a city first — we can't seed times for a location we don't know.",
      true,
    );

  confirmBox({
    title: "Generate full year?",
    msg: `Generate a full year of prayer times for ${city} in ${year}? Existing rows will be replaced.`,
    ok: "Generate",
    onOk: async () => {
      try {
        const r = await api.post("/prayer-times/seed", {
          city,
          year,
          replace: true,
        });
        toast(`Seeded ${r.inserted} days, skipped ${r.skipped}`);
        await go("Prayer Times");
      } catch (e) {
        toast(e.message || "Seed failed", true);
      }
    },
  });
}

async function prayerByCoordinate() {
  const latEl = $("#ptc-lat");
  const lonEl = $("#ptc-lon");
  const out = $("#pt-coord-result");
  if (!latEl || !lonEl || !out) return;

  const lat = parseFloat(latEl.value);
  const lon = parseFloat(lonEl.value);
  if (Number.isNaN(lat) || Number.isNaN(lon))
    return toast("Enter valid coordinates", true);

  out.innerHTML = `<div class="empty">${ic("refresh")} Fetching…</div>`;
  try {
    const d = await api.get(`/prayer-times/for-location?lat=${lat}&lon=${lon}`);
    const t = d.timings || {};
    const row = (label, v, bold) =>
      `<tr><td>${label}</td><td>${bold ? "<b>" : ""}${fmtTimeHtml(v)}${bold ? "</b>" : ""}</td></tr>`;
    out.innerHTML = `<div class="tw"><table class="kv-table">
        ${row("Fajr", t.fajr, 1)}${row("Sunrise", t.sunrise)}${row("Dhuhr", t.dhuhr, 1)}
        ${row("Asr", t.asr)}${row("Maghrib", t.maghrib, 1)}${row("Isha", t.isha, 1)}
      </table></div>
      <div class="foot">${esc(d.city_name || "")} · ${esc(d.source)}${d.cached ? " (cached)" : ""}</div>`;
  } catch (e) {
    out.innerHTML = `<div class="empty">${ic("x")} ${esc(e.message)}</div>`;
  }
}

// ============================================================================
// Settings / profile
// ============================================================================
async function settingsAvatarUpload(file) {
  if (!file) return;
  const ind = $("#autosave-ind");
  const setInd = (text, cls = "") => {
    if (!ind) return;
    ind.textContent = text;
    ind.className = "autosave " + cls;
  };
  setInd("Uploading…");
  try {
    const fd = new FormData();
    fd.append("file", file);
    state.me = await postForm("/me/avatar", fd);
    applyUserHeader();
    toast("Avatar updated");
    await go("Settings");
  } catch (e) {
    toast(e.message || "Avatar upload failed", true);
    setInd("Upload failed", "bad");
  }
}

function settingsAvatarClear() {
  confirmBox({
    title: "Remove avatar?",
    msg: "Your profile picture will be removed. You can upload a new one anytime.",
    onOk: async () => {
      try {
        state.me = await api.del("/me/avatar");
        applyUserHeader();
        toast("Avatar removed");
        await go("Settings");
      } catch (e) {
        toast(e.message, true);
      }
    },
  });
}

function openPasswordModal() {
  formModal({
    title: "Change password",
    okLabel: "Change password",
    fields: [
      {
        k: "current_password",
        l: "Current password",
        t: "password",
        req: 1,
        full: 1,
      },
      {
        k: "new_password",
        l: "New password",
        t: "password",
        req: 1,
        full: 1,
        h: "Minimum 6 characters",
      },
      {
        k: "confirm",
        l: "Confirm new password",
        t: "password",
        req: 1,
        full: 1,
      },
    ],
    onSubmit: async (vals) => {
      if (vals.new_password.length < 6)
        return "New password must be at least 6 characters.";
      if (vals.new_password !== vals.confirm) return "Passwords do not match.";
      try {
        await api.post("/me/password", {
          current_password: vals.current_password,
          new_password: vals.new_password,
        });
        toast("Password changed — please log in again");
        setTimeout(() => api.logout(), 1200);
        return null;
      } catch (e) {
        return e.message || "Change failed";
      }
    },
  });
}

let profileSaveTimer = null;
const scheduleProfileSave = () => {
  clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(flushProfileSave, 800);
};

async function flushProfileSave() {
  const ind = $("#autosave-ind");
  const setInd = (text, cls = "") => {
    if (!ind) return;
    ind.textContent = text;
    ind.className = "autosave " + cls;
  };
  setInd("Saving…");
  try {
    state.me = await api.patch("/me", {
      first_name: $("#pn")?.value?.trim() || null,
      last_name: $("#pln")?.value?.trim() || null,
    });
    applyUserHeader();
    setInd("Saved", "ok");
    setTimeout(() => setInd(""), 1200);
  } catch (e) {
    toast(e.message || "Save failed", true);
    setInd("Save failed", "bad");
  }
}

const twoFaCopy = (on) =>
  on
    ? "A 6-digit code will be emailed on every sign-in."
    : "Admins sign in with just a password. Not recommended.";

async function settingsPage() {
  await refreshMe();
  const me = state.me || state.user || {};

  // Default "on" matches the backend default when the setting isn't stored yet.
  let twoFa = "true";
  try {
    const r = await api.get("/settings/2fa_enabled");
    if (r && r.value != null) twoFa = String(r.value).toLowerCase();
  } catch {}
  const twoFaOn = ["1", "true", "yes", "on"].includes(twoFa);
  const isProd = api.config && api.config.env === "production";
  const canWriteSettings = can("settings:write");

  const fullName = [me.first_name, me.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const initials =
    (fullName || me.email || "A")
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A";

  return `<div class="card glass s12">
      <div class="eh">
        <div class="ic">${ic("user")}</div>
        <div><h3>Profile</h3><p>Your account settings</p></div>
        <small id="autosave-ind" class="autosave"></small>
      </div>
      <div class="pav">
        <div class="big">${me.avatar ? `<img src="${esc(me.avatar)}" alt="">` : esc(initials)}</div>
        <div>
          <b>Profile photo</b>
          <small>PNG, JPG or WebP · max 5 MB</small>
          <div class="row-btns" style="margin-top:10px">
            <button type="button" class="b3" data-act="avatar-pick">${ic("upload")}Upload</button>
            ${me.avatar ? `<button type="button" class="b3" data-act="avatar-clear">${ic("trash")}Remove</button>` : ""}
            <input type="file" id="avatar-input" accept="${IMAGE_TYPES.join(",")}" hidden>
          </div>
        </div>
      </div>
      <div class="fg2">
        <div><label for="pn">First name</label>
          <input class="in" id="pn" value="${esc(me.first_name || "")}" autocomplete="given-name"></div>
        <div><label for="pln">Last name</label>
          <input class="in" id="pln" value="${esc(me.last_name || "")}" autocomplete="family-name"></div>
        <div class="full"><label for="pe">Email</label>
          <input class="in" id="pe" type="email" value="${esc(me.email || "")}" disabled>
          <div class="hint">Email cannot be changed from the panel</div></div>
      </div>
      <div class="row-btns end">
        <button type="button" class="b3" data-act="password-open">${ic("shield")}Change password</button>
      </div>
    </div>

    <div class="card glass s12">
      <div class="eh">
        <div class="ic">${ic("lock")}</div>
        <div><h3>Security</h3><p>Controls for admin logins</p></div>
      </div>
      <label>Require 2FA for admin logins</label>
      <div class="tf-row">
        <button type="button" id="tf-toggle" class="tf-switch ${twoFaOn ? "on" : "off"}" data-act="toggle-2fa"
                aria-pressed="${twoFaOn}" aria-label="Toggle 2FA"${canWriteSettings ? "" : " disabled"}>
          <span class="tf-knob"></span>
        </button>
        <div>
          <b id="tf-label">${twoFaOn ? "Enabled" : "Disabled"}</b>
          <small><span id="tf-copy">${twoFaCopy(twoFaOn)}</span>
            ${isProd ? '<span class="lock">Locked in production — this toggle will not disable 2FA.</span>' : ""}</small>
        </div>
      </div>
      <div class="hint">Changing this takes effect on the <b>next login</b>. Existing sessions are not affected.</div>
      <div class="err" id="tf-err" role="alert"></div>
    </div>`;
}

async function toggleTwoFa(btn) {
  const errEl = $("#tf-err");
  errEl.textContent = "";
  if (!can("settings:write"))
    return toast("You don't have permission to change this setting", true);

  const enable = !btn.classList.contains("on");
  btn.disabled = true;
  try {
    await api.put("/settings/2fa_enabled", {
      value: enable ? "true" : "false",
    });
    btn.classList.toggle("on", enable);
    btn.classList.toggle("off", !enable);
    btn.setAttribute("aria-pressed", String(enable));
    $("#tf-label").textContent = enable ? "Enabled" : "Disabled";
    $("#tf-copy").textContent = twoFaCopy(enable);
    api.cache.invalidate("settings");
    toast(enable ? "2FA enabled" : "2FA disabled");
  } catch (e) {
    // The backend refuses changes that the production lock forbids.
    const msg = e.message || "Could not update 2FA setting";
    errEl.textContent = msg;
    toast(msg, true);
  } finally {
    btn.disabled = false;
  }
}

// ============================================================================
// Uploads
// ============================================================================
const uploadQueue = [];

async function uploadsPage() {
  let existing = [];
  try {
    existing = (await api.get("/wallpapers?limit=24")).items || [];
  } catch {}

  return `<div class="card glass s12">
      <div class="eh">
        <div class="ic">${ic("upload")}</div>
        <div><h3>Uploads</h3><p>Upload images directly to R2 — they appear immediately in the app</p></div>
      </div>
      <div class="dz" id="upload-zone" role="button" tabindex="0">
        <div class="ic">${ic("upload")}</div>
        <b>Drop files here or click to browse</b>
        <small>JPEG, PNG or WebP · max 10 MB each · multiple files allowed</small>
        <input type="file" id="upload-input" accept="${IMAGE_TYPES.join(",")}" multiple hidden>
      </div>

      <div id="upload-queue" hidden style="margin-top:18px">
        <div class="ch">
          <div class="ic">${ic("check")}</div>
          <div><b>Upload queue</b><small id="queue-summary"></small></div>
          <button type="button" class="b2" data-act="upload-start" id="upload-start">${ic("upload")}Upload all</button>
        </div>
        <div class="queue" id="upload-list"></div>
      </div>

      <div class="ch" style="margin:24px 0 14px">
        <div class="ic">${ic("img")}</div>
        <div><b>Recent uploads</b><small>${plural(existing.length, "image")} in library</small></div>
        <button type="button" class="b3" style="margin-inline-start:auto" data-act="go" data-p="Wallpapers">${ic("img")}Manage wallpapers</button>
      </div>
      ${
        existing.length
          ? `<div class="wg">${existing
              .map(
                (w) => `<div class="wp">
                  ${w.image ? `<img src="${esc(w.image)}" alt="${esc(w.name)}" loading="lazy">` : ""}
                  <span class="n">${esc(w.name)}</span></div>`,
              )
              .join("")}</div>`
          : `<div class="empty">No wallpapers yet. Upload the first one above.</div>`
      }
    </div>`;
}

function initUploadsPage() {
  const zone = $("#upload-zone");
  const input = $("#upload-input");
  if (!zone || !input) return;

  zone.onclick = () => input.click();
  zone.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  };
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  };
  zone.ondragleave = () => zone.classList.remove("drag");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    if (e.dataTransfer?.files?.length) enqueueFiles([...e.dataTransfer.files]);
  };
  input.onchange = () => {
    if (input.files?.length) enqueueFiles([...input.files]);
    input.value = "";
  };
  renderUploadQueue();
}

function enqueueFiles(files) {
  for (const f of files) {
    if (!IMAGE_TYPES.includes(f.type)) {
      toast(`${f.name}: only JPEG, PNG, WebP allowed`, true);
      continue;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      toast(`${f.name}: max 10 MB`, true);
      continue;
    }
    uploadQueue.push({
      file: f,
      status: "pending",
      id: Math.random().toString(36).slice(2, 8),
    });
  }
  renderUploadQueue();
}

function renderUploadQueue() {
  const wrap = $("#upload-queue");
  const list = $("#upload-list");
  if (!wrap || !list) return;

  const count = (s) => uploadQueue.filter((x) => x.status === s).length;
  wrap.hidden = !uploadQueue.length;
  $("#queue-summary").textContent =
    `${uploadQueue.length} file(s) · ${count("done")} done · ${count("error")} failed · ${count("pending")} pending`;
  $("#upload-start").style.display = count("pending") ? "" : "none";

  const badges = {
    pending: `<span class="pill off">pending</span>`,
    uploading: `<span class="pill">uploading…</span>`,
    done: `<span class="pill ok">done</span>`,
    error: `<span class="pill bad">error</span>`,
  };
  list.innerHTML = uploadQueue
    .map(
      (item) => `<div class="q-item">
        <div>
          <b>${esc(item.file.name)}</b>
          <small>${(item.file.size / 1024).toFixed(0)} KB</small>
          ${item.error ? `<small class="bad">${esc(item.error)}</small>` : ""}
        </div>
        ${badges[item.status]}
        ${
          item.status === "pending"
            ? `<span class="act-b"><button type="button" class="d" title="Remove" data-act="upload-remove" data-id="${item.id}">${ic("x")}</button></span>`
            : ""
        }
      </div>`,
    )
    .join("");
}

async function uploadStart() {
  const pending = uploadQueue.filter((x) => x.status === "pending");
  if (!pending.length) return toast("Nothing to upload", true);

  let ok = 0;
  let fail = 0;
  for (const item of pending) {
    item.status = "uploading";
    renderUploadQueue();
    try {
      const fd = new FormData();
      fd.append("file", item.file);
      fd.append("name", item.file.name.replace(/\.[^.]+$/, ""));
      await postForm("/wallpapers/upload", fd);
      item.status = "done";
      ok++;
    } catch (e) {
      item.status = "error";
      item.error = e.message || "Upload failed";
      fail++;
    }
    renderUploadQueue();
  }

  toast(`${ok} uploaded${fail ? `, ${fail} failed` : ""}`, fail > 0);
  if (ok > 0) setTimeout(() => state.page === "Uploads" && go("Uploads"), 600);
}

// ============================================================================
// Backup
// ============================================================================
async function backupPage() {
  const [status, list] = await Promise.all([
    api.get("/admin/backup/status").catch(() => null),
    api.get("/admin/backup").catch(() => ({ backups: [] })),
  ]);
  const backups = list.backups || [];
  const canWrite = can("backup:write");

  const head = `<div class="eh">
      <div class="ic">${ic("down")}</div>
      <div><h3>Backup</h3><p>Server-side database backups — MySQL dump + logs, stored on R2 for 30 days</p></div>
      ${canWrite ? `<button type="button" class="b2" data-act="backup-run">${ic("refresh")}Run backup now</button>` : ""}
    </div>`;

  const statusCard = status
    ? `<div class="card glass s12">
        <div class="ch"><div class="ic">${ic("check")}</div><div><b>Backup status</b><small>Scheduler and latest run</small></div></div>
        <div class="kv">
          <div><label>Auto backup</label><b>${status.scheduler_enabled ? `Enabled · ${esc(status.scheduled_time)} IST` : "Disabled"}</b></div>
          <div><label>Next run</label><b>${esc(status.next_run_at || "—")}</b></div>
          <div><label>Last run</label><b>${esc(status.last_run_at || "Never")}
            ${status.last_run_status ? `<span class="pill ${status.last_run_status === "success" ? "ok" : "bad"}">${esc(status.last_run_status)}</span>` : ""}</b></div>
          <div><label>Total backups</label><b>${status.total_local_backups} local · ${status.total_r2_backups} on R2</b></div>
          ${status.newest_local_backup ? `<div class="full"><label>Newest</label><code>${esc(status.newest_local_backup)}</code></div>` : ""}
          ${status.oldest_local_backup ? `<div class="full"><label>Oldest</label><code>${esc(status.oldest_local_backup)}</code></div>` : ""}
        </div>
      </div>`
    : "";

  const locationPill = (s) =>
    `<span class="pill ${s === "r2" ? "ok" : s === "both" ? "" : "off"}">${esc(s)}</span>`;
  const listCard = `<div class="card glass s12">
      <div class="ch"><div class="ic">${ic("book")}</div><div><b>Backup history</b><small>${plural(backups.length, "file")}</small></div></div>
      ${
        backups.length
          ? `<div class="tw"><table>
              <thead><tr><th>Filename</th><th>Size</th><th>Created</th><th>Location</th><th>Actions</th></tr></thead>
              <tbody>${backups
                .map(
                  (b) => `<tr>
                    <td><code>${esc(b.filename)}</code></td>
                    <td>${Number(b.size_mb).toFixed(2)} MB</td>
                    <td>${esc(b.created_at || "")}</td>
                    <td>${locationPill(b.source)}</td>
                    <td>${
                      canWrite
                        ? `<span class="act-b"><button type="button" title="Restore" data-act="backup-restore" data-filename="${esc(b.filename)}">${ic("refresh")}</button></span>`
                        : "—"
                    }</td>
                  </tr>`,
                )
                .join("")}</tbody>
            </table></div>`
          : `<div class="empty">No backups yet. Click "Run backup now" to create one.</div>`
      }
    </div>`;

  return `<div class="card glass s12">${head}</div>${statusCard}${listCard}`;
}

function backupRunNow() {
  if (!can("backup:write"))
    return toast("You don't have permission to run backups", true);
  confirmBox({
    title: "Run database backup?",
    msg: "This runs scripts/backup.sh on the server and uploads the SQL dump to R2. It takes 5–15 seconds.",
    ok: "Run",
    onOk: async () => {
      try {
        const r = await api.post("/admin/backup");
        toast(
          `Backup created: ${r.filename} (${(r.size_bytes / 1024).toFixed(0)} KB)`,
        );
        await go("Backup");
      } catch (e) {
        toast(e.message || "Backup failed", true);
      }
    },
  });
}

function backupRestoreConfirm(filename) {
  if (!can("backup:write"))
    return toast("You don't have permission to restore backups", true);
  formModal({
    title: "Restore database backup?",
    okLabel: "Restore",
    fields: [
      {
        k: "confirm",
        l: "Type RESTORE to confirm",
        req: 1,
        full: 1,
        h: `"${filename}" will replace ALL current data. This cannot be undone.`,
      },
    ],
    onSubmit: async (vals) => {
      if (vals.confirm !== "RESTORE")
        return "Type RESTORE exactly to continue.";
      try {
        const r = await api.post("/admin/backup/restore", {
          filename,
          confirm: "RESTORE",
        });
        toast(`Restore started: ${r.status}`);
        return null;
      } catch (e) {
        return e.message || "Restore failed";
      }
    },
  });
}

// ============================================================================
// Sync — Quran audio → R2 (background job with live log tail)
// ============================================================================
const syncState = { jobId: null, logOffset: 0, timer: null, buffer: "" };
const SYNC_BUFFER_MAX = 200_000;

function syncStopTimers() {
  if (syncState.timer) {
    clearInterval(syncState.timer);
    syncState.timer = null;
  }
}

function syncReset() {
  syncState.jobId = null;
  syncState.logOffset = 0;
  syncState.buffer = "";
  const pre = $("#sync-log");
  if (pre) pre.textContent = "";
}

function syncFmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 ** 2) return (n / 1024).toFixed(0) + " KB";
  if (n < 1024 ** 3) return (n / 1024 ** 2).toFixed(1) + " MB";
  return (n / 1024 ** 3).toFixed(2) + " GB";
}

function syncStatusBadge(status) {
  return (
    {
      queued: `<span class="pill off">queued</span>`,
      running: `<span class="pill">running</span>`,
      stopping: `<span class="pill warn">stopping…</span>`,
      stopped: `<span class="pill off">stopped</span>`,
      done: `<span class="pill ok">done</span>`,
      failed: `<span class="pill bad">failed</span>`,
      interrupted: `<span class="pill warn">interrupted</span>`,
    }[status] || `<span class="pill off">${esc(status)}</span>`
  );
}

function syncRenderStatus(job) {
  const el = $("#sync-status-body");
  if (!el) return;
  if (!job) {
    el.innerHTML = `<div class="empty">No job yet. Click <b>Start sync</b> to download and upload every ayah for all reciters.</div>`;
    return;
  }

  const total = job.total || 0;
  const done = job.processed || 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const live = ["queued", "running", "stopping"].includes(job.status);

  el.innerHTML = `
    <div class="sync-head">
      <b>Job #${job.id}</b> ${syncStatusBadge(job.status)}
      <small>${job.started_at ? "started " + esc(job.started_at) : ""}${job.finished_at ? " · finished " + esc(job.finished_at) : ""}</small>
    </div>
    ${live ? `<div class="sync-progress"><i style="width:${pct}%"></i></div>` : ""}
    <div class="kv">
      <div><label>Progress</label><b>${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)</b></div>
      <div><label>Uploaded</label><b>${(job.uploaded || 0).toLocaleString()}</b></div>
      <div><label>Skipped</label><b>${(job.skipped || 0).toLocaleString()}</b></div>
      <div><label>Failed</label><b>${(job.failed || 0).toLocaleString()}</b></div>
      <div><label>Bytes</label><b>${syncFmtBytes(job.bytes_done)}</b></div>
      <div><label>Current</label><b>${esc(job.current_file || "—")}</b></div>
      ${job.reciters ? `<div class="full"><label>Reciters</label><b>${esc((job.reciters || []).join(", ") || "(all)")}</b></div>` : ""}
      ${job.message ? `<div class="full"><label>Message</label><b>${esc(job.message)}</b></div>` : ""}
      ${job.error ? `<div class="full"><label>Error</label><b style="color:var(--bad)">${esc(job.error)}</b></div>` : ""}
    </div>`;
}

function syncSetButtons(active, stopping) {
  const start = $("#sync-btn-start");
  const stop = $("#sync-btn-stop");
  if (start) start.disabled = active;
  if (stop) stop.style.display = active && !stopping ? "inline-flex" : "none";
}

// Terminal semantics: "\n" starts a new line, "\r" rewinds to the start of the line.
function syncAppendLog(text) {
  const pre = $("#sync-log");
  if (!text || !pre) return;

  const atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 24;
  syncState.buffer = (syncState.buffer + text).slice(-SYNC_BUFFER_MAX);

  const rendered = syncState.buffer
    .split("\n")
    .map((line) => (line.includes("\r") ? line.split("\r").pop() : line))
    .join("\n");

  if (pre.textContent !== rendered) {
    pre.textContent = rendered;
    if (atBottom) pre.scrollTop = pre.scrollHeight;
  }
}

async function syncTick() {
  let r;
  try {
    r = await api.get("/admin/sync/ayah/status");
  } catch {
    return;
  }
  const active = r.active || null;
  const job = active || r.last || null;

  if (job && job.id !== syncState.jobId) {
    syncState.jobId = job.id;
    syncState.logOffset = 0;
    syncState.buffer = "";
    const pre = $("#sync-log");
    if (pre) pre.textContent = "";
  }

  syncRenderStatus(job);
  syncSetButtons(!!active, active?.status === "stopping");

  if (job) {
    try {
      const logs = await api.get(
        `/admin/sync/ayah/logs?job_id=${job.id}&offset=${syncState.logOffset}`,
      );
      if (logs.exists && logs.chunk) syncAppendLog(logs.chunk);
      syncState.logOffset = logs.next_offset;
    } catch {}
  }
  if (!active) syncStopTimers();
}

function syncStartPolling() {
  syncStopTimers();
  syncTick();
  syncState.timer = setInterval(syncTick, 2000);
}

async function syncPage() {
  syncStopTimers();
  syncState.jobId = null;
  syncState.logOffset = 0;
  syncState.buffer = "";
  const canWrite = can("sync:write");

  return `<div class="card glass s12">
      <div class="eh">
        <div class="ic">${ic("refresh")}</div>
        <div style="flex:1">
          <h3>Sync Quran audio</h3>
          <p>Download every ayah from EveryAyah and upload to R2. Safe to stop — it resumes where it left off.</p>
        </div>
        <div class="row-btns" style="margin:0">
          ${canWrite ? `<button type="button" class="b2" id="sync-btn-start" data-act="sync-start" style="margin:0">${ic("play")}Start sync</button>` : ""}
          ${canWrite ? `<button type="button" class="b3 danger" id="sync-btn-stop" data-act="sync-stop" style="display:none">${ic("pause")}Stop</button>` : ""}
          <button type="button" class="b3" data-act="sync-refresh" title="Refresh status" aria-label="Refresh status">${ic("refresh")}</button>
        </div>
      </div>

      <div class="ch"><div class="ic">${ic("clock")}</div><div><b>Job status</b><small>Auto-refreshes while a job is running</small></div></div>
      <div class="panel" id="sync-status-body" style="min-height:100px"><div class="empty">Loading…</div></div>

      <div class="ch" style="margin-top:22px">
        <div class="ic">${ic("book")}</div>
        <div><b>Log</b><small>Live tail of the runner output</small></div>
        <button type="button" class="b3" style="margin-inline-start:auto" data-act="sync-scroll-bottom">↓ Follow</button>
      </div>
      <pre id="sync-log"></pre>
    </div>`;
}

async function syncStartAction() {
  if (!can("sync:write"))
    return toast("You don't have permission to start sync jobs", true);
  const r = await api.post("/admin/sync/ayah/start", {});
  toast(
    r.attached ? `Attached to job #${r.job_id}` : `Started job #${r.job_id}`,
  );
  syncReset();
  syncStartPolling();
}

async function syncStopAction() {
  if (!can("sync:write"))
    return toast("You don't have permission to stop sync jobs", true);
  await api.post("/admin/sync/ayah/stop", {});
  toast("Stop requested — the job will halt after the current ayah");
  syncStartPolling();
}

// ============================================================================
// Devices
// ============================================================================
async function devicesPage() {
  let users = [];
  try {
    users =
      (await api.get("/administrators?include_guests=true&limit=500")).items ||
      [];
  } catch (e) {
    return `<div class="card glass s12"><div class="empty">${esc(e.message || "Failed to load users")}</div></div>`;
  }

  const head = `<div class="eh">
      <div class="ic">${ic("mobile")}</div>
      <div><h3>Devices</h3><p>${plural(users.length, "registered account")} · admins + guests</p></div>
      <button type="button" class="b3" style="margin-inline-start:auto" data-act="reload">${ic("refresh")}Reload</button>
    </div>`;

  if (!users.length)
    return `<div class="card glass s12">${head}<div class="empty">No users registered yet.</div></div>`;

  const rows = users
    .map(
      (u) => `<tr>
        <td>#${u.id}</td><td>${esc(u.email || "—")}</td>
        <td>${u.is_admin ? `<span class="pill">admin</span>` : `<span class="pill off">guest</span>`}</td>
        <td><button type="button" class="b3" data-act="device-view" data-uid="${u.id}">${ic("mobile")}View devices</button></td>
      </tr>`,
    )
    .join("");

  return `<div class="card glass s12">${head}
    <div class="tb"><div class="fld">${ic("search")}<input type="search" placeholder="Search…" data-filter></div></div>
    <div class="tw"><table>
      <thead><tr><th>ID</th><th>Email</th><th>Type</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="foot">${users.length} total</div>
  </div>`;
}

async function showUserDevices(userId) {
  try {
    const devices = await api.get(`/administrators/${userId}/devices`);
    const canWrite = can("devices:write");
    const rows = devices
      .map(
        (d) => `<tr>
          <td><code>${esc((d.device_uuid || "").slice(0, 16))}…</code></td>
          <td>${esc(d.platform || "—")}</td><td>${esc(d.device_model || "—")}</td>
          <td>${esc(d.os_version || "—")}</td><td>${esc(d.app_version || "—")}</td>
          <td>${d.revoked ? `<span class="pill off">revoked</span>` : `<span class="pill ok">active</span>`}</td>
          <td>${esc(d.last_seen_at || "—")}</td>
          <td>${
            !d.revoked && canWrite
              ? `<button type="button" class="b3 danger" data-act="device-revoke" data-uid="${userId}" data-uuid="${esc(d.device_uuid)}">Revoke</button>`
              : "—"
          }</td>
        </tr>`,
      )
      .join("");

    openModal(
      `${modalHeader(`Devices for user #${userId}`)}
       <div class="mbody">${
         devices.length
           ? `<div class="tw"><table>
               <thead><tr><th>UUID</th><th>Platform</th><th>Model</th><th>OS</th><th>App</th><th>Status</th><th>Last seen</th><th></th></tr></thead>
               <tbody>${rows}</tbody></table></div>`
           : `<div class="empty">No devices for this user.</div>`
       }</div>`,
      "lg",
    );
  } catch (e) {
    toast(e.message || "Failed to load devices", true);
  }
}

// ============================================================================
// Dhikr Campaigns
// ============================================================================
const dhikrState = {
  tab: "campaigns",
  activeCampaignId: null,
  statusFilter: "pending",
};

async function dhikrCampaignsPage() {
  let campaigns = [];
  try {
    campaigns = await api.get("/admin/dhikr/campaigns");
  } catch (e) {
    return `<div class="card glass s12"><div class="empty">${esc(e.message || "Failed to load campaigns")}</div></div>`;
  }

  const statsMap = {};
  await Promise.all(
    campaigns.map(async (c) => {
      statsMap[c.id] = await api
        .get(`/admin/dhikr/campaigns/${c.id}/stats`)
        .catch(() => null);
    }),
  );
  const sum = (field) =>
    Object.values(statsMap).reduce((n, s) => n + (s?.[field] || 0), 0);
  const totalSubmissions = sum("total_submissions");
  const totalDhikrs = sum("total_dhikrs");
  const totalPending = sum("pending");

  const head = `<div class="eh">
      <div class="ic">${ic("beads")}</div>
      <div><h3>Dhikr Campaigns</h3><p>Manage submission windows and review user submissions</p></div>
      ${can("dhikr-campaigns:write") ? `<button type="button" class="b2" data-act="dhikr-add">${ic("plus")}New campaign</button>` : ""}
    </div>`;

  const statCard = (icon, value, label, bad = false) =>
    `<div class="card glass s4 stat"><div class="top"><div class="ic">${ic(icon)}</div></div>
       <div class="num${bad ? " bad" : ""}">${value.toLocaleString()}</div><div class="lbl">${label}</div></div>`;

  const tab = (id, label) =>
    `<button type="button" class="${dhikrState.tab === id ? "on" : ""}" data-act="dhikr-tab" data-tab="${id}">${label}</button>`;

  const content =
    dhikrState.tab === "campaigns"
      ? renderCampaignsList(campaigns, statsMap)
      : await renderSubmissionsTab(campaigns);

  return `<div class="card glass s12">${head}</div>
    ${statCard("check", totalDhikrs, "Total dhikrs")}
    ${statCard("beads", totalSubmissions, "Submissions")}
    ${statCard("clock", totalPending, "Pending review", totalPending > 0)}
    <div class="card glass s12">
      <div class="seg" style="margin-bottom:14px">
        ${tab("campaigns", `Campaigns (${campaigns.length})`)}${tab("submissions", `Submissions (${totalSubmissions})`)}
      </div>
      ${content}
    </div>`;
}

function renderCampaignsList(campaigns, statsMap) {
  if (!campaigns.length)
    return `<div class="empty">No campaigns yet. Click "New campaign" to create one.</div>`;

  const today = localISODate();
  const canWrite = can("dhikr-campaigns:write");

  const rows = campaigns
    .map((c) => {
      const stats = statsMap[c.id];
      const live = today >= c.starts_on && today <= c.ends_on;
      const badge = !c.is_active
        ? `<span class="pill off">disabled</span>`
        : live
          ? `<span class="pill ok">active today</span>`
          : `<span class="pill warn">scheduled</span>`;
      return `<tr>
        <td>#${c.id}</td><td><b>${esc(c.title)}</b></td><td><code>${esc(c.slug)}</code></td>
        <td>${esc(c.starts_on)}</td><td>${esc(c.ends_on)}</td><td>${badge}</td>
        <td>${(stats?.total_submissions || 0).toLocaleString()}</td>
        <td>${(stats?.total_dhikrs || 0).toLocaleString()}</td>
        <td>${
          canWrite
            ? `<span class="act-b">
                <button type="button" data-act="dhikr-toggle" data-id="${c.id}" title="${c.is_active ? "Deactivate" : "Activate"}">${ic(c.is_active ? "pause" : "play")}</button>
                <button type="button" data-act="dhikr-edit" data-id="${c.id}" title="Edit">${ic("edit")}</button>
                <button type="button" class="d" data-act="dhikr-delete" data-id="${c.id}" data-title="${esc(c.title)}" title="Delete">${ic("trash")}</button>
              </span>`
            : "—"
        }</td>
      </tr>`;
    })
    .join("");

  return `<div class="tw"><table>
    <thead><tr><th>ID</th><th>Title</th><th>Slug</th><th>Starts</th><th>Ends</th><th>Status</th><th>Submissions</th><th>Dhikrs</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function renderSubmissionsTab(campaigns) {
  if (!campaigns.length) return `<div class="empty">No campaigns yet.</div>`;

  const cid = dhikrState.activeCampaignId || campaigns[0].id;
  dhikrState.activeCampaignId = cid;

  const campaignOpts = campaigns
    .map(
      (c) =>
        `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${esc(c.title)}</option>`,
    )
    .join("");
  const statusOpts = [
    ["pending", "Pending"],
    ["handled", "Handled"],
    ["rejected", "Rejected"],
    ["", "All statuses"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}"${dhikrState.statusFilter === v ? " selected" : ""}>${l}</option>`,
    )
    .join("");

  let data = { total: 0, items: [] };
  try {
    const q = dhikrState.statusFilter
      ? `&status_filter=${dhikrState.statusFilter}`
      : "";
    data = await api.get(
      `/admin/dhikr/campaigns/${cid}/submissions?limit=500${q}`,
    );
  } catch (e) {
    return `<div class="empty">${esc(e.message)}</div>`;
  }

  const canWrite = can("dhikr-campaigns:write");
  const pills = {
    pending: `<span class="pill warn">pending</span>`,
    handled: `<span class="pill ok">handled</span>`,
    rejected: `<span class="pill off">rejected</span>`,
  };
  const rows = (data.items || [])
    .map(
      (s) => `<tr>
        <td>#${s.id}</td><td>${esc(s.full_name || "—")}</td><td>${esc(s.phone || "—")}</td>
        <td><b>${s.count.toLocaleString()}</b></td>
        <td>${pills[s.status] || esc(s.status)}</td>
        <td><code>${esc((s.device_uuid || "").slice(0, 10))}…</code></td>
        <td>${esc(s.created_at || "")}</td>
        <td>${
          s.status === "pending" && canWrite
            ? `<span class="act-b">
                <button type="button" class="good" data-act="dhikr-handle" data-id="${s.id}" title="Mark handled">${ic("check")}</button>
                <button type="button" class="d" data-act="dhikr-reject" data-id="${s.id}" title="Reject">${ic("x")}</button>
              </span>`
            : "—"
        }</td>
      </tr>`,
    )
    .join("");

  return `<div class="tb">
      <div class="tb-field grow"><label for="dc-campaign">Campaign</label>
        <select class="in" id="dc-campaign" data-change="dhikr-campaign">${campaignOpts}</select></div>
      <div class="tb-field"><label for="dc-status">Filter</label>
        <select class="in" id="dc-status" data-change="dhikr-status">${statusOpts}</select></div>
      <div class="tb-meta">${plural(data.total, "submission")}</div>
    </div>
    ${
      data.items?.length
        ? `<div class="tw"><table>
            <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Count</th><th>Status</th><th>Device</th><th>Submitted</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody></table></div>`
        : `<div class="empty">No submissions${dhikrState.statusFilter ? ` with status "${esc(dhikrState.statusFilter)}"` : ""}.</div>`
    }`;
}

function openCampaignForm(existing) {
  if (!can("dhikr-campaigns:write"))
    return toast("You don't have permission to edit dhikr campaigns", true);

  const isEdit = !!existing;
  formModal({
    title: isEdit ? `Edit: ${existing.title}` : "New dhikr campaign",
    data: existing || {},
    fields: [
      { k: "title", l: "Title", req: 1, full: 1, h: "e.g. 19th Chand Dhikr" },
      { k: "slug", l: "Slug", req: 1, full: 1, h: "lowercase, hyphens only" },
      { k: "description", l: "Description", t: "area", full: 1 },
      { k: "starts_on", l: "Starts on", req: 1, t: "date" },
      { k: "ends_on", l: "Ends on", req: 1, t: "date" },
    ],
    onSubmit: async (vals) => {
      if (vals.ends_on < vals.starts_on)
        return "End date must be on or after the start date.";
      try {
        if (isEdit)
          await api.patch(`/admin/dhikr/campaigns/${existing.id}`, vals);
        else await api.post("/admin/dhikr/campaigns", vals);
        toast(isEdit ? "Updated" : "Created");
        await go("Dhikr Campaigns");
        return null;
      } catch (e) {
        return e.message || "Save failed";
      }
    },
  });
}

function confirmDeleteCampaign(id, title) {
  confirmBox({
    title: `Delete "${title}"?`,
    msg: "This is permanent. If the campaign has submissions it cannot be deleted — disable it instead.",
    onOk: async () => {
      try {
        await api.del(`/admin/dhikr/campaigns/${id}`);
        toast("Campaign deleted");
        await go("Dhikr Campaigns");
      } catch (e) {
        const msg = String(e.message || "Delete failed");
        if (/submission/i.test(msg)) {
          openModal(
            `${modalHeader("Cannot delete this campaign")}
             <p class="msg">${esc(msg)}<br><br>You can still <b>disable</b> it to stop new submissions while keeping all existing records intact.</p>
             <div class="mfoot">
               <button type="button" class="b3" data-act="close">Cancel</button>
               <button type="button" class="btn" data-act="dhikr-disable" data-id="${id}">${ic("pause")}Disable instead</button>
             </div>`,
            "sm",
          );
        } else {
          toast(msg, true);
        }
      }
    },
  });
}

// ============================================================================
// Page registry
// ============================================================================
const PAGE_RENDERERS = {
  Dashboard: dashboardPage,
  Administrators: () => crudPage("Administrators"),
  Roles: rolesPage,
  Invitations: invitationsPage,
  "Prayer Times": prayerTimesPage,
  Reciters: recitersPage,
  Duas: duasPage,
  Dhikrs: () => crudPage("Dhikrs"),
  Wallpapers: wallpapersPage,
  Uploads: uploadsPage,
  Backup: backupPage,
  Sync: syncPage,
  "Dhikr Campaigns": dhikrCampaignsPage,
  Devices: devicesPage,
  Settings: settingsPage,
};

// ============================================================================
// Click actions (event delegation)
// ============================================================================
async function detectAndRefresh() {
  try {
    await detectLocationFromBrowser();
    await go(state.page);
  } catch {}
}

let duaTab = "masnoon";
let masCategory = "";
const MAS_LANGS = [
  ["en", "English"],
  ["gu", "Gujarati"],
  ["hi", "Hindi"],
  ["ur", "Urdu"],
  ["ar", "Arabic"],
  ["sw", "Swahili"],
];
const statusPill = (active, yes = "Published", no = "Draft") =>
  `<span class="pill ${active ? "" : "off"}">${active ? yes : no}</span>`;
async function duasPage() {
  const tabs = `<div class="card glass s12 content-tabs" aria-label="Dua collections">${[
    ["masnoon", "Masnoon Duas"],
    ["general", "General Duas"],
    ["categories", "Categories"],
  ]
    .map(
      ([k, l]) =>
        `<button class="${duaTab === k ? "b2" : "b3"}" aria-pressed="${duaTab === k}" data-act="mas-tab" data-tab="${k}">${l}</button>`,
    )
    .join("")}</div>`;
  if (duaTab === "general") return tabs + (await crudPage("Duas"));
  const cats = await api.get("/admin/masnoon/categories");
  const writable = can("duas:write");
  if (duaTab === "categories")
    return (
      tabs +
      `<div class="card glass s12"><div class="eh"><div><h3>Categories</h3><p>Organize supplications by occasion.</p></div>${writable ? '<button class="b2" data-act="mas-edit-cat">Add category</button>' : ""}</div><div class="category-grid">${cats.map((c) => `<button class="category-tile" data-act="mas-edit-cat" data-id="${c.id}"><small>Category ${c.position}</small><strong>${esc(c.title.en)}</strong><span>${esc(c.title.gu)}</span>${statusPill(c.is_active, "Active", "Inactive")}</button>`).join("") || '<p class="empty">No categories yet.</p>'}</div></div>`
    );
  const result = await api.get(
    "/admin/masnoon/duas?limit=500" +
      (masCategory ? "&category_id=" + encodeURIComponent(masCategory) : ""),
  );
  const items = result.items || [];
  const published = items.filter((d) => d.is_published).length;
  return (
    tabs +
    `<div class="card glass s12"><div class="eh"><div><h3>Masnoon Duas</h3><p>Manage multilingual supplications, recitations and publishing.</p></div>${writable ? '<button class="b2" data-act="mas-edit">Add entry</button>' : ""}</div><div class="content-metrics"><div><small>Loaded entries</small><strong>${items.length}</strong></div><div><small>Published</small><strong>${published}</strong></div><div><small>Drafts</small><strong>${items.length - published}</strong></div><div><small>Categories</small><strong>${cats.length}</strong></div></div><div class="tb"><div class="tb-field grow"><label for="mas-category">Category</label><select class="in" id="mas-category"><option value="">All categories</option>${cats.map((c) => `<option value="${c.id}" ${String(c.id) === masCategory ? "selected" : ""}>${esc(c.title.en)}</option>`).join("")}</select></div><button class="b3" data-act="mas-filter">Apply filter</button><div class="fld">${ic("search")}<input type="search" data-filter aria-label="Search loaded entries" placeholder="Search entries…"></div></div><div class="tw"><table><thead><tr><th>Order</th><th>Supplication</th><th>Category</th><th>Status</th><th>Action</th></tr></thead><tbody>${items.map((d) => `<tr><td>${d.position}</td><td class="wrap"><strong>${esc(d.title.en)}</strong><div class="content-secondary" dir="rtl">${esc(d.title.ar)}</div><small class="content-secondary">${esc(d.title.gu)}</small></td><td class="wrap">${esc(cats.find((c) => c.id === d.category_id)?.title.en || "Unknown")}</td><td>${statusPill(d.is_published)}</td><td><button class="b3" data-act="mas-edit" data-id="${d.id}">${writable ? "Edit" : "View"}</button></td></tr>`).join("")}</tbody></table>${items.length ? "" : '<div class="empty">No entries in this selection.</div>'}</div><div class="foot">${items.length} loaded · ${result.meta.total} matching</div>${writable ? '<details class="seed-tools"><summary>Dataset import tools</summary><p>Preview before applying. Manual edits are protected by the importer.</p><button class="b3" data-act="mas-preview">Preview seed</button> <button class="b3" data-act="mas-apply">Apply seed</button></details>' : ""}</div>`
  );
}
async function masEdit(id, category = false) {
  const base = "/admin/masnoon/" + (category ? "categories" : "duas");
  const cats = await api.get("/admin/masnoon/categories");
  const data = id
    ? category
      ? cats.find((c) => c.id === Number(id))
      : await api.get(base + "/" + id)
    : category
      ? { slug: "", position: 1, title: {}, description: null, is_active: true }
      : {
          seed_key: "",
          category_id: cats[0]?.id,
          position: 1,
          title: {},
          content: { recitations: [] },
          is_published: false,
        };
  if (!data) throw new Error("Entry not found");
  const writable = can("duas:write");
  const draft = JSON.parse(JSON.stringify(data));
  let lang = "en";
  const field = (label, key, value, area = false, rtl = false) =>
    `<label class="editor-field"><span>${esc(label)}</span>${area ? `<textarea class="in" data-field="${key}" rows="4" ${rtl ? 'dir="rtl"' : ""} ${writable ? "" : "readonly"}>${esc(value ?? "")}</textarea>` : `<input class="in" data-field="${key}" value="${esc(value ?? "")}" ${rtl ? 'dir="rtl"' : ""} ${writable ? "" : "readonly"}>`}</label>`;
  openModal(
    `${modalHeader((writable ? (id ? "Edit " : "Add ") : "View ") + (category ? "category" : "supplication"))}<div class="mf content-editor"><div class="editor-meta">${!id ? field(category ? "Category slug" : "Seed key", "key", "") : ""}${field("Position", "position", draft.position)}${category ? "" : `<label class="editor-field"><span>Category</span><select id="mas-edit-category" class="in" ${writable ? "" : "disabled"}>${cats.map((c) => `<option value="${c.id}" ${c.id === draft.category_id ? "selected" : ""}>${esc(c.title.en)}</option>`).join("")}</select></label>`}<label class="editor-check"><input id="mas-published" type="checkbox" ${draft[category ? "is_active" : "is_published"] ? "checked" : ""} ${writable ? "" : "disabled"}>${category ? "Active category" : "Published in app"}</label></div><div id="mas-languages" class="content-tabs"></div><div id="mas-fields"></div>${category ? "" : `<details class="seed-tools"><summary>Advanced structured content (JSON)</summary><p>References, nested sections, instructions and source metadata. Apply JSON changes before saving.</p><textarea id="mas-json" class="in" rows="12" ${writable ? "" : "readonly"}></textarea>${writable ? '<button id="mas-json-apply" class="b3">Apply JSON changes</button>' : ""}</details>`}<div id="mas-error" class="err" role="alert"></div></div><div class="mfoot"><button class="b3" data-act="close">Close</button>${writable ? '<button class="btn" id="mas-save">Save changes</button>' : ""}</div>`,
    "lg content-modal",
  );
  const error = $("#mas-error");
  const render = () => {
    $("#mas-languages").innerHTML = MAS_LANGS.map(
      ([k, l]) =>
        `<button type="button" class="${k === lang ? "b2" : "b3"}" data-lang="${k}" aria-pressed="${k === lang}">${l}</button>`,
    ).join("");
    const rtl = ["ar", "ur"].includes(lang);
    let html = field("Title", "title", draft.title?.[lang], false, rtl);
    if (category)
      html += field(
        "Description",
        "description",
        draft.description?.[lang],
        true,
        rtl,
      );
    else {
      html += field(
        "Occasion",
        "occasion",
        draft.content.occasion?.[lang],
        true,
        rtl,
      );
      html += (draft.content.recitations || [])
        .map(
          (r, i) =>
            `<section class="recitation-editor"><h4>Recitation ${i + 1}</h4>${field("Arabic text", `arabic-${i}`, r.arabic, true, true)}${lang === "ar" ? "" : field("Pronunciation", `transliteration-${i}`, r.transliteration?.[lang], true, rtl)}${field("Meaning", `meaning-${i}`, r.meaning?.[lang], true, rtl)}${writable ? `<button class="b3" data-remove-rec="${i}">Remove recitation</button>` : ""}</section>`,
        )
        .join("");
      if (writable)
        html += '<button class="b3" id="mas-add-rec">Add recitation</button>';
    }
    $("#mas-fields").innerHTML = html;
    if (!category)
      $("#mas-json").value = JSON.stringify(draft.content, null, 2);
  };
  const collect = () => {
    if (!writable) return;
    for (const el of $$("[data-field]", $("#mas-fields"))) {
      const k = el.dataset.field,
        v = el.value;
      if (k === "title") (draft.title ??= {})[lang] = v;
      else if (k === "description") {
        if (v || draft.description) (draft.description ??= {})[lang] = v;
      } else if (k === "occasion") {
        if (v || draft.content.occasion)
          (draft.content.occasion ??= {})[lang] = v;
      } else {
        const [part, i] = k.split("-");
        const r = draft.content.recitations[Number(i)];
        if (part === "arabic") r.arabic = v;
        else (r[part] ??= {})[lang] = v;
      }
    }
  };
  if (!category) {
    const advanced = $("#mas-json").closest("details");
    advanced.addEventListener("toggle", () => {
      if (advanced.open) {
        collect();
        $("#mas-json").value = JSON.stringify(draft.content, null, 2);
      }
    });
  }
  $("#mas-languages").onclick = (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    collect();
    lang = b.dataset.lang;
    render();
  };
  $("#mas-fields").onclick = (e) => {
    if (!writable) return;
    const b = e.target.closest("[data-remove-rec]");
    if (e.target.id === "mas-add-rec") {
      collect();
      (draft.content.recitations ??= []).push({
        order: (draft.content.recitations || []).length + 1,
        arabic: "",
        transliteration: {},
        meaning: {},
      });
      render();
    } else if (b && window.confirm("Remove this recitation?")) {
      collect();
      draft.content.recitations.splice(Number(b.dataset.removeRec), 1);
      render();
    }
  };
  if (!category && writable)
    $("#mas-json-apply").onclick = () => {
      try {
        const x = JSON.parse($("#mas-json").value);
        if (
          !x ||
          Array.isArray(x) ||
          typeof x !== "object" ||
          (x.recitations != null && !Array.isArray(x.recitations))
        )
          throw new Error(
            "Expected a content object with a recitations array.",
          );
        draft.content = x;
        render();
        error.textContent = "";
      } catch (e) {
        error.textContent = e.message;
      }
    };
  render();
  const btn = $("#mas-save");
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    error.textContent = "";
    try {
      collect();
      const position = Number($('[data-field="position"]').value);
      if (!Number.isInteger(position) || position < 1)
        throw new Error("Position must be a positive integer.");
      for (const [k, l] of MAS_LANGS)
        if (!draft.title?.[k]?.trim())
          throw new Error(l + " title is required.");
      const body = { title: draft.title, position };
      if (!id) {
        const key = $('[data-field="key"]').value.trim();
        if (!/^[a-z0-9_]+$/.test(key))
          throw new Error(
            "Use lowercase letters, digits and underscores for the identifier.",
          );
        body[category ? "slug" : "seed_key"] = key;
      }
      if (category) {
        body.description = draft.description;
        body.is_active = $("#mas-published").checked;
      } else {
        body.category_id = Number($("#mas-edit-category").value);
        if (!body.category_id) throw new Error("Choose a category.");
        body.is_published = $("#mas-published").checked;
        body.content = {
          ...draft.content,
          id: id ? data.seed_key : body.seed_key,
          title: draft.title,
          entry_number: position,
          category_slug: cats.find((c) => c.id === body.category_id)?.slug,
        };
        if (
          body.is_published &&
          !window.confirm(
            "Confirm religious review is complete before publishing this content.",
          )
        )
          return;
      }
      if (id) await api.patch(base + "/" + id, body);
      else await api.post(base, body);
      closeModal();
      toast("Saved");
      await go("Duas");
    } catch (e) {
      error.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  };
}

const ACTIONS = {
  "mas-tab": async (el) => {
    duaTab = el.dataset.tab;
    await go("Duas");
  },
  "mas-filter": async () => {
    masCategory = $("#mas-category").value;
    await go("Duas");
  },
  "mas-edit": (el) => masEdit(el.dataset.id),
  "mas-edit-cat": (el) => masEdit(el.dataset.id, true),
  "mas-preview": async () => {
    const r = await api.post("/admin/masnoon/seed/preview", {});
    openModal(
      `${modalHeader("Seed preview")}<div class="mf"><pre>${esc(JSON.stringify(r, null, 2))}</pre></div><div class="mfoot"><button class="b3" data-act="close">Close</button></div>`,
    );
  },
  "mas-apply": async () => {
    if (!window.confirm("Import bundled dataset? Manual edits are preserved."))
      return;
    const r = await api.post("/admin/masnoon/seed/apply", {});
    toast(JSON.stringify(r));
    await go("Duas");
  },
  // Navigation / shell
  go: async (el) => {
    const page = el.dataset.p;
    if (page === "Duas" && el.dataset.then === "add") duaTab = "general";
    await go(page);
    if (el.dataset.then !== "add") return;
    if (CRUD[page]) await openCrudForm(page, null);
    else if (page === "Wallpapers") openWallForm(null);
  },
  menu: () => setMenu(!menuIsOpen()),
  logout: () => api.logout(),
  reload: () => go(state.page),
  close: () => closeModal(),
  confirm: async () => {
    const cb = modalCtx?.onOk;
    closeModal();
    if (cb) await cb();
  },
  "toggle-time-fmt": async () => {
    const next = timeFmt === "12" ? "24" : "12";
    setTimeFmt(next);
    toast(`Time format: ${next}-hour`);
    await go(state.page);
  },

  // Location
  "dash-detect-loc": detectAndRefresh,
  "dash-refresh-loc": async () => {
    store.del(LOCATION_CACHE_KEY);
    state.detected = null;
    await detectAndRefresh();
  },

  // Generic CRUD
  "crud-add": (el) => openCrudForm(el.dataset.key, null),
  "crud-edit": (el) =>
    openCrudForm(el.dataset.key, parseInt(el.dataset.id, 10)),
  "crud-del": (el) =>
    confirmDelete(
      el.dataset.key,
      parseInt(el.dataset.id, 10),
      el.dataset.label || "item",
    ),

  // Administrators / invitations
  "invite-open": () => openInviteForm(),
  "invite-resend": async (el) => {
    await api.post(`/admin/invitations/${el.dataset.id}/resend`, {});
    toast("Invitation resent");
    await go("Invitations");
  },
  "invite-revoke": (el) => {
    const { id, email } = el.dataset;
    confirmBox({
      title: "Revoke this invitation?",
      msg: `The invitation sent to "${email || "this email"}" will be cancelled. They will get a cancellation email and won't be able to use the link.`,
      ok: "Revoke",
      onOk: async () => {
        try {
          await api.del(`/admin/invitations/${id}`);
          toast("Invitation revoked");
          await go("Invitations");
        } catch (e) {
          toast(e.message || "Revoke failed", true);
        }
      },
    });
  },
  "admin-reinvite": (el) => {
    const id = parseInt(el.dataset.id, 10);
    const email = el.dataset.email || "this admin";
    const pending = el.dataset.pending === "true";
    confirmBox({
      title: pending ? "Resend invitation?" : "Re-invite this admin?",
      msg: pending
        ? `A fresh invitation will be sent to "${email}". Their current pending invite will be replaced.`
        : `A new invitation will be sent to "${email}". Their current sessions will be invalidated until they accept the invite and set a password again.`,
      ok: pending ? "Resend" : "Re-invite",
      onOk: async () => {
        try {
          await api.post(`/admin/invitations/reinvite/${id}`, {});
          toast(
            pending
              ? "Invitation resent"
              : "Re-invite sent — status set to pending",
          );
          await go("Administrators");
        } catch (e) {
          toast(e.message || "Re-invite failed", true);
        }
      },
    });
  },

  // Roles
  "role-create": () => openRoleForm(null),
  "role-edit-perms": async (el) => {
    const id = parseInt(el.dataset.id, 10);
    const role = (await api.get("/roles")).find((r) => r.id === id);
    if (!role) return toast("Role not found", true);
    await openRoleForm(role);
  },
  "role-delete": (el) =>
    confirmDeleteRole(
      parseInt(el.dataset.id, 10),
      el.dataset.name || "role",
      parseInt(el.dataset.users || "0", 10),
    ),

  // Wallpapers / uploads
  "wall-add": () => openWallForm(null),
  "wall-preview": (el) => wallPreview(parseInt(el.dataset.id, 10)),
  "wall-edit": async (el) =>
    openWallForm(await api.get(`/wallpapers/${parseInt(el.dataset.id, 10)}`)),
  "wall-del": (el) =>
    confirmBox({
      title: "Delete wallpaper?",
      msg: `"${el.dataset.label}" will be permanently deleted.`,
      onOk: async () => {
        try {
          await api.del(`/wallpapers/${el.dataset.id}`);
          toast("Deleted");
          await go("Wallpapers");
        } catch (e) {
          toast(e.message, true);
        }
      },
    }),
  "upload-start": () => uploadStart(),
  "upload-remove": (el) => {
    const idx = uploadQueue.findIndex((x) => x.id === el.dataset.id);
    if (idx >= 0) uploadQueue.splice(idx, 1);
    renderUploadQueue();
  },

  // Reciters
  "reciter-view": async (el) => {
    state.reciterSlug = el.dataset.slug;
    await go("Reciters");
  },
  "reciter-back": async () => {
    state.reciterSlug = null;
    stopAudio();
    await go("Reciters");
  },
  "reciter-play-surah": (el) =>
    playReciterSurah(el.dataset.slug, parseInt(el.dataset.n, 10), el),

  // Prayer times
  "prayer-edit": (el) => prayerEdit(parseInt(el.dataset.id, 10)),
  "prayer-seed": () => prayerSeed(),
  "prayer-month": async (el) => {
    state.prayerMonth = parseInt(el.dataset.m, 10);
    await go("Prayer Times");
  },
  "pt-by-coord": () => prayerByCoordinate(),
  "pt-use-my-loc": async () => {
    try {
      const { coords } = await detectLocationFromBrowser();
      await go("Prayer Times");
      $("#ptc-lat").value = coords.lat;
      $("#ptc-lon").value = coords.lon;
      await prayerByCoordinate();
    } catch {}
  },

  // Profile / settings
  "avatar-pick": () => $("#avatar-input")?.click(),
  "avatar-clear": () => settingsAvatarClear(),
  "password-open": () => openPasswordModal(),
  "toggle-2fa": (el) => toggleTwoFa(el),

  // Backup
  "backup-run": () => backupRunNow(),
  "backup-restore": (el) => backupRestoreConfirm(el.dataset.filename),

  // Sync
  "sync-start": () => syncStartAction(),
  "sync-stop": () => syncStopAction(),
  "sync-refresh": () => {
    syncReset();
    syncStartPolling();
  },
  "sync-scroll-bottom": () => {
    const pre = $("#sync-log");
    if (pre) pre.scrollTop = pre.scrollHeight;
  },

  // Devices
  "device-view": (el) => showUserDevices(parseInt(el.dataset.uid, 10)),
  "device-revoke": (el) => {
    const uid = parseInt(el.dataset.uid, 10);
    const uuid = el.dataset.uuid;
    confirmBox({
      title: "Revoke this device?",
      msg: "It will be blocked from re-registering. Its existing token stays valid until it expires.",
      ok: "Revoke",
      onOk: async () => {
        try {
          await api.post(`/administrators/${uid}/devices/${uuid}/revoke`);
          toast("Device revoked");
          await showUserDevices(uid);
        } catch (e) {
          toast(e.message || "Revoke failed", true);
        }
      },
    });
  },

  // Dhikr campaigns
  "dhikr-tab": async (el) => {
    dhikrState.tab = el.dataset.tab;
    await go("Dhikr Campaigns");
  },
  "dhikr-add": () => openCampaignForm(null),
  "dhikr-edit": async (el) => {
    const all = await api.get("/admin/dhikr/campaigns");
    const found = all.find((x) => x.id === parseInt(el.dataset.id, 10));
    if (found) openCampaignForm(found);
  },
  "dhikr-toggle": async (el) => {
    await api.post(`/admin/dhikr/campaigns/${el.dataset.id}/toggle`);
    toast("Campaign toggled");
    await go("Dhikr Campaigns");
  },
  "dhikr-delete": (el) =>
    confirmDeleteCampaign(el.dataset.id, el.dataset.title),
  "dhikr-disable": async (el) => {
    const id = parseInt(el.dataset.id, 10);
    closeModal();
    const all = await api.get("/admin/dhikr/campaigns");
    const found = all.find((c) => c.id === id);
    if (found && found.is_active)
      await api.post(`/admin/dhikr/campaigns/${id}/toggle`);
    toast("Campaign disabled — submissions preserved");
    await go("Dhikr Campaigns");
  },
  "dhikr-handle": (el) => setSubmissionStatus(el.dataset.id, "handled"),
  "dhikr-reject": (el) => setSubmissionStatus(el.dataset.id, "rejected"),
};

async function setSubmissionStatus(id, status) {
  await api.patch(`/admin/dhikr/submissions/${parseInt(id, 10)}`, { status });
  toast(`Marked as ${status}`);
  await go("Dhikr Campaigns");
}

document.addEventListener("click", async (e) => {
  if (e.target.id === "modal") return closeModal();

  // Close any open custom select when clicking elsewhere
  if (!e.target.closest(".csel")) closeAllSelects();

  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const action = ACTIONS[el.dataset.act];
  if (!action) return;
  if (el.tagName === "A") e.preventDefault();

  try {
    await action(el, e);
  } catch (err) {
    toast(err.message || "Action failed", true);
  }
});

// Wallpaper tiles act as buttons — make them keyboard accessible
document.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches?.('.wp[data-act="wall-preview"]')
  ) {
    e.preventDefault();
    e.target.click();
  }
});

// ---- Input: autosave + table filter -----------------------------------------------
document.addEventListener("input", (e) => {
  const x = e.target;
  if (x.id === "pn" || x.id === "pln") return scheduleProfileSave();
  if (!x.matches("[data-filter]")) return;

  const card = x.closest(".card");
  const q = x.value.toLowerCase().trim();
  const rows = $$("tbody tr", card);
  let shown = 0;
  rows.forEach((tr) => {
    const ok = tr.textContent.toLowerCase().includes(q);
    tr.hidden = !ok;
    if (ok) shown++;
  });
  const foot = $(".foot", card);
  if (foot)
    foot.textContent = q
      ? `${shown} of ${rows.length} shown`
      : `${rows.length} total`;
});

// ---- Change: selects + avatar -------------------------------------------------------
document.addEventListener("change", async (e) => {
  const x = e.target;

  if (x.id === "avatar-input") {
    const file = x.files?.[0];
    x.value = "";
    if (file) await settingsAvatarUpload(file);
    return;
  }

  switch (x.dataset.change) {
    case "np-city":
    case "prayer-city": {
      if (x.value === "__detected__") return;
      state.prayerCity = x.value;
      state.prayerCityPage = x.value;
      savePrayerCityPref(x.value);
      toast(
        `📍 Prayer city set to ${x.options[x.selectedIndex]?.text || x.value}`,
      );
      await go(x.dataset.change === "np-city" ? "Dashboard" : "Prayer Times");
      break;
    }
    case "prayer-year":
      state.prayerYear = parseInt(x.value, 10);
      await go("Prayer Times");
      break;
    case "dhikr-campaign":
      dhikrState.activeCampaignId = parseInt(x.value, 10);
      await go("Dhikr Campaigns");
      break;
    case "dhikr-status":
      dhikrState.statusFilter = x.value;
      await go("Dhikr Campaigns");
      break;
  }
});

// ---- Keyboard ---------------------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  const mod = navigator.platform.toUpperCase().includes("MAC")
    ? e.metaKey
    : e.ctrlKey;
  if (mod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    paletteOpen ? closePalette() : openPalette();
    return;
  }
  if (e.key !== "Escape") return;
  if (paletteOpen) closePalette();
  else if (modalOpen()) closeModal();
  else if (document.body.classList.contains("open")) setMenu(false);
});

// ============================================================================
// Command palette — Ctrl/⌘ + K
// ============================================================================
let paletteOpen = false;
let paletteDebounce = null;
let paletteIndex = 0;

const PALETTE_COMMANDS = [
  { title: "Dashboard", icon: "dash", run: () => go("Dashboard") },
  { title: "Settings", icon: "set", run: () => go("Settings") },
  {
    title: "Backup",
    icon: "down",
    perm: "backup:read",
    run: () => go("Backup"),
  },
  {
    title: "Sync Quran audio",
    icon: "refresh",
    perm: "sync:read",
    run: () => go("Sync"),
  },
  { title: "Change password", icon: "shield", run: () => openPasswordModal() },
  {
    title: "Run backup now",
    icon: "refresh",
    perm: "backup:write",
    run: () => backupRunNow(),
  },
  {
    title: "New dua",
    icon: "plus",
    perm: "duas:write",
    run: async () => (await go("Duas"), openCrudForm("Duas", null)),
  },
  {
    title: "New dhikr",
    icon: "plus",
    perm: "dhikrs:write",
    run: async () => (await go("Dhikrs"), openCrudForm("Dhikrs", null)),
  },
  {
    title: "New wallpaper",
    icon: "plus",
    perm: "wallpapers:write",
    run: async () => (await go("Wallpapers"), openWallForm(null)),
  },
  {
    title: "Create role",
    icon: "plus",
    perm: "roles:write",
    run: () => openRoleForm(null),
  },
];

const HIT_ICONS = {
  dua: "heart",
  dhikr: "beads",
  wallpaper: "img",
  reciter: "head",
  translator: "globe",
  admin: "shield",
};

function openPalette() {
  if (paletteOpen) return;
  paletteOpen = true;
  const overlay = document.createElement("div");
  overlay.id = "palette-overlay";
  overlay.innerHTML = `<div class="palette-box">
      <input id="palette-input" class="in" placeholder="Search… or type a command" autocomplete="off" aria-label="Search">
      <div id="palette-results" class="palette-results"></div>
      <div class="palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>esc</kbd> close</span>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input = $("#palette-input");
  input.focus();
  renderPaletteResults("");

  input.addEventListener("input", () => {
    clearTimeout(paletteDebounce);
    paletteDebounce = setTimeout(() => renderPaletteResults(input.value), 150);
  });
  input.addEventListener("keydown", (e) => {
    const items = $$("#palette-results .palette-item");
    if (!items.length) return;
    const move = (delta) => {
      e.preventDefault();
      paletteIndex = (paletteIndex + delta + items.length) % items.length;
      items.forEach((el, i) =>
        el.classList.toggle("active", i === paletteIndex),
      );
      items[paletteIndex].scrollIntoView({ block: "nearest" });
    };
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter") {
      e.preventDefault();
      items[paletteIndex]?.click();
    }
  });
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "palette-overlay") closePalette();
  });
}

function closePalette() {
  paletteOpen = false;
  paletteIndex = 0;
  $("#palette-overlay")?.remove();
}

async function renderPaletteResults(query) {
  const results = $("#palette-results");
  if (!results) return;
  paletteIndex = 0;

  const q = query.trim().toLowerCase();
  const commands = PALETTE_COMMANDS.filter(
    (c) =>
      (!c.perm || can(c.perm)) && (!q || c.title.toLowerCase().includes(q)),
  );

  let hits = [];
  if (q.length >= 2) {
    try {
      hits =
        (await api.get(`/search?q=${encodeURIComponent(q)}`)).results || [];
    } catch {}
  }
  if (!$("#palette-results")) return; // closed while searching

  const html = [];
  if (commands.length) {
    html.push(`<div class="palette-group">Commands</div>`);
    commands.forEach((c, i) =>
      html.push(`<div class="palette-item${i === 0 ? " active" : ""}" data-kind="cmd" data-idx="${i}">
        <span class="pi-ic">${ic(c.icon)}</span><span class="pi-title">${esc(c.title)}</span></div>`),
    );
  }
  if (hits.length) {
    html.push(`<div class="palette-group">Results</div>`);
    hits.forEach((h, i) =>
      html.push(`<div class="palette-item${!commands.length && i === 0 ? " active" : ""}" data-kind="hit" data-idx="${i}">
        <span class="pi-ic">${ic(HIT_ICONS[h.type] || "search")}</span>
        <span class="pi-title">${esc(h.title)}</span>
        ${h.subtitle ? `<span class="pi-sub">${esc(h.subtitle)}</span>` : ""}
        <span class="pi-tag">${esc(h.page)}</span></div>`),
    );
  }
  if (!commands.length && !hits.length)
    html.push(
      `<div class="palette-empty">No results for "${esc(query)}"</div>`,
    );

  results.innerHTML = html.join("");
  $$(".palette-item", results).forEach((el) =>
    el.addEventListener("click", async () => {
      closePalette();
      const idx = parseInt(el.dataset.idx, 10);
      if (el.dataset.kind === "cmd") await commands[idx]?.run();
      else if (hits[idx]) await go(hits[idx].page);
    }),
  );
}

// ============================================================================
// Custom select (replaces the native popup)
// ============================================================================
function closeAllSelects(except = null) {
  $$(".csel.open").forEach((w) => {
    if (w === except) return;
    w.classList.remove("open");
    w.querySelector(".csel-trigger")?.setAttribute("aria-expanded", "false");
  });
}

function enhanceSelect(sel) {
  if (sel.dataset.enhanced === "1") return;
  sel.dataset.enhanced = "1";

  const wrap = document.createElement("div");
  wrap.className = "csel" + (sel.classList.contains("sm") ? " sm" : "");
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.style.display = "none";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "csel-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  wrap.appendChild(trigger);

  const popup = document.createElement("div");
  popup.className = "csel-pop";
  popup.setAttribute("role", "listbox");
  wrap.appendChild(popup);

  const render = () => {
    const cur = sel.options[sel.selectedIndex];
    trigger.innerHTML = `<span class="csel-val">${esc(cur ? cur.text : "")}</span>
      <svg class="csel-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
    popup.innerHTML = [...sel.options]
      .map(
        (o) =>
          `<button type="button" class="csel-opt${o.selected ? " on" : ""}" role="option" data-v="${esc(o.value)}">${esc(o.text)}</button>`,
      )
      .join("");
  };
  const close = () => {
    wrap.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    closeAllSelects(wrap);
    wrap.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    popup.querySelector(".csel-opt.on")?.scrollIntoView({ block: "nearest" });
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.classList.contains("open") ? close() : open();
  });
  popup.addEventListener("click", (e) => {
    const btn = e.target.closest(".csel-opt");
    if (!btn) return;
    if (sel.value !== btn.dataset.v) {
      sel.value = btn.dataset.v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    render();
    close();
  });

  if (sel.id) {
    document
      .querySelector(`label[for="${sel.id}"]`)
      ?.addEventListener("click", () => trigger.focus());
  }
  render();
}

const enhanceAllSelects = (root = document) =>
  $$("select.in", root).forEach(enhanceSelect);

// ============================================================================
// Init
// ============================================================================
async function init() {
  const boot = $("#boot-overlay");
  const bootStatus = $("#boot-status");
  const setBoot = (msg) => bootStatus && (bootStatus.textContent = msg);
  const finishBoot = () => {
    if (!boot) return;
    boot.classList.add("hide");
    setTimeout(() => boot.remove(), 550);
  };
  const failBoot = (msg) => {
    if (!boot) return;
    boot.innerHTML = `<div class="boot-card glass">
        <div class="boot-brand">
          <img src="assets/img/logo.png" alt="">
          <b class="bad">Cannot reach server</b>
        </div>
        <p>${esc(msg)}</p>
        <button type="button" class="btn" style="margin:0;width:auto;padding:0 24px" onclick="location.reload()">Retry</button>
      </div>`;
  };

  const minVisible = new Promise((r) => setTimeout(r, 450));

  try {
    setBoot("Connecting to server…");
    await api.ready();
  } catch (err) {
    return failBoot(err.message || "Network error");
  }

  try {
    $('[data-act="lang"]')?.remove(); // language switcher is unused

    // Restore sidebar state (desktop)
    if (!isMobile() && store.get("nea:rail") === "1")
      document.body.classList.add("rail");

    // City catalogue first — needed to match the detected location
    setBoot("Loading cities…");
    await ensureCities();

    setBoot("Restoring preferences…");
    const cached = loadPersistedDetected();
    if (cached) {
      state.detected = cached;
      const match = matchCity(cached.city);
      if (match) state.prayerCity = state.prayerCityPage = match.key;
    }
    const savedCity = store.get(CITY_PREF_KEY); // an explicit choice overrides detection
    if (savedCity && state.cities.some((c) => c.key === savedCity)) {
      state.prayerCity = state.prayerCityPage = savedCity;
    }

    setBoot("Loading settings…");
    await ensureSettings();

    setBoot("Loading profile…");
    await refreshMe();
    loadPermissions(state.me);
    applyBrand();
    applyUserHeader();
    renderNav();

    setBoot("Rendering…");
    const hash = decodeURIComponent(location.hash.slice(1));
    await go(isPage(hash) ? hash : "Dashboard");

    setBoot("Finishing up…");
    if (state.dashboardReady) {
      await Promise.race([
        state.dashboardReady,
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    }
    await minVisible;
    finishBoot();

    // Ask for location after first paint (once per browser)
    setTimeout(async () => {
      if (state.detected) return;
      await autoPromptLocationIfNeeded();
      if (state.page === "Dashboard" && state.detected) go("Dashboard");
    }, 500);
  } catch (err) {
    console.error("[init]", err);
    failBoot(err.message || "Initialization failed");
    toast(err.message || "Initialization failed", true);
  }
}

init();




/* ULTRA GLASS — Unified Spotlight Engine */
(() => {
    "use strict";

    if (window.__neaSpotlight) return;
    window.__neaSpotlight = true;

    const selector = [
        ".card:not(.hero)",
        ".category-tile",
        "nav a:not(.act)",
        ".seg button:not(.on)",
        ".chip",
        ".csel-opt",
        ".qa button",
        ".b3:not(.danger)",
        ".tool"
    ].join(",");

    let active = null;
    let pending = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    function clear() {
        active?.classList.remove("spotlight-active");
        active = null;
        pending = null;
    }

    document.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        if (!(e.target instanceof Element)) return;

        pending = e.target.closest(selector);

        if (pending?.closest("[disabled], [aria-disabled='true']")) {
            pending = null;
        }

        x = e.clientX;
        y = e.clientY;

        if (frame) return;

        frame = requestAnimationFrame(() => {
            frame = 0;

            if (active !== pending) {
                active?.classList.remove("spotlight-active");
                active = pending;
            }

            if (!active?.isConnected) {
                clear();
                return;
            }

            const rect = active.getBoundingClientRect();

            active.style.setProperty("--mx", `${x - rect.left}px`);
            active.style.setProperty("--my", `${y - rect.top}px`);

            active.classList.add(
                "glass-spotlight",
                "spotlight-active"
            );
        });
    }, { passive: true });

    document.addEventListener("pointerout", (e) => {
        if (!e.relatedTarget) clear();
    });

    window.addEventListener("blur", clear);
})();
