/* Growth Gusto — core: utils, icons, logo, sound, data layer, state, boot, chrome, router, sheets, toast, binding, click dispatch. */
/* Growth Gusto · V1 · direction B2 Aurore */
"use strict";

/* ───────────────────────── utils ───────────────────────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 1) => (n == null || isNaN(n) ? "–" : Number(n).toFixed(d).replace(".", ","));
const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".").replace(/\s/g, "")); return isNaN(n) ? null : n; };
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const prevMonthKey = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthKey(d); };
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const monthLabel = (k) => { const [y, m] = k.split("-"); return `${MONTHS[+m - 1]} ${y}`; };
const parseDay = (k) => { if (!k) return null; const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const daysUntil = (k) => { const d = parseDay(k); if (!d) return null; const t = parseDay(dayKey()); return Math.round((d - t) / 864e5); };
const shortDate = (k) => { const d = parseDay(k); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : "–"; };
const hm = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const when = (ts) => { const d = new Date(ts); const k = dayKey(d); const t = dayKey(); if (k === t) return hm(ts); const y = new Date(); y.setDate(y.getDate() - 1); if (k === dayKey(y)) return `hier ${hm(ts)}`; return `${shortDate(k)} ${hm(ts)}`; };
const addDays = (k, n) => { const d = parseDay(k) || new Date(); d.setDate(d.getDate() + n); return dayKey(d); };
const rid6 = () => { const a = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; let s = ""; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const slotNow = () => (new Date().getHours() < 16 ? "midi" : "soir");
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "";
const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const PALETTE = ["#5B2BFF", "#1E7F55", "#E0582F", "#C2337A", "#3B6FD8", "#8A4DFF", "#0E8C9E", "#B97D0E"];
const colorFor = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ───────────────────────── icons (hand-drawn set, 24 grid, 1.8 stroke) ───────────────────────── */
const IC = {
  star: ["M11.52 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"],
  cal: ["M8 2v4", "M16 2v4", "r:3,4,18,18,2", "M3 10h18"],
  calcheck: ["M8 2v4", "M16 2v4", "r:3,4,18,18,2", "M3 10h18", "m9 16 2 2 4-4"],
  euro: ["M4 10h12", "M4 14h9", "M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"],
  dash: ["r:3,3,7,9,1", "r:14,3,7,5,1", "r:14,12,7,9,1", "r:3,16,7,5,1"],
  home: ["M15 21v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7", "M3 10a2 2 0 0 1 .7-1.53l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  snow: ["M2 12h20", "M12 2v20", "m20 16-4-4 4-4", "m4 8 4 4-4 4", "m16 4-4 4-4-4", "m8 20 4-4 4 4"],
  therm: ["M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z", "M12 9v6.5", "f:M12 14.5a3 3 0 1 0 .01 0z"],
  truck: ["M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2", "M15 18H9", "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14", "c:17,18,2", "c:7,18,2", "f:M14 9h3.5l3.5 4.5V17h-7z"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M7 12h10"],
  qr: ["r:3,3,7,7,1.5", "r:14,3,7,7,1.5", "r:3,14,7,7,1.5", "M14 14h3v3h-3z", "M20 14v.01", "M14 20h.01", "M17 20h4v-3"],
  box: ["M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z", "M12 22V12", "m3.3 7 7.7 4.73a2 2 0 0 0 2 0L20.7 7", "m7.5 4.27 9 5.15", "f:M12 12 3.6 7.2 12 2.5l8.4 4.7z"],
  list: ["r:8,2,8,4,1", "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M12 11h4", "M12 16h4", "M8 11h.01", "M8 16h.01"],
  receipt: ["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", "M8 7h8", "M8 11h8", "M8 15h5"],
  book: ["M12 7v14", "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"],
  spray: ["M9 3h5l3 2-3 1H9z", "M11 6v3", "M8 9h6a2 2 0 0 1 2 2v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9a2 2 0 0 1 2-2z", "M19 4.5h.01", "M21 2.5h.01", "M21 6.5h.01", "f:M7 14h8v6H7z"],
  sparkle: ["M13.5 2.75 5.25 13.5h6l-1.25 7.75 8.75-11h-6.25z"],
  shield: ["f:M12 3c2 1.4 4.5 2.6 7 2.6V13c0 4.4-3 6.6-7 8-4-1.4-7-3.6-7-8V5.6C7.5 5.6 10 4.4 12 3z", "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "c:9,7,4", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  printer: ["M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6", "r:6,14,12,8,1"],
  camera: ["M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z", "c:12,13,3"],
  plus: ["M5 12h14", "M12 5v14"],
  minus: ["M5 12h14"],
  back: ["m15 18-6-6 6-6"],
  chev: ["m9 18 6-6-6-6"],
  down: ["m6 9 6 6 6-6"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  check: ["M20 6 9 17l-5-5"],
  sliders: ["M20 7h-9", "M14 17H5", "c:17,17,3", "c:7,7,3"],
  search: ["c:11,11,8", "m21 21-4.3-4.3"],
  grid: ["r:3,3,7,7,2", "r:14,3,7,7,2", "r:14,14,7,7,2", "r:3,14,7,7,2"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  alert: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
  clock: ["c:12,12,10", "M12 6v6l4 2"],
  trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"],
  out: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  into: ["M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", "m10 17 5-5-5-5", "M15 12H3"],
  scissors: ["c:6,6,3", "c:6,18,3", "M20 4 8.12 15.88", "M14.47 14.48 20 20", "M8.12 8.12 12 12"],
  sound: ["M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z", "M16 9a5 5 0 0 1 0 6", "M19.4 18.4a9 9 0 0 0 0-12.8"],
  store: ["m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7", "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4", "M2 7h20", "M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2 2 0 0 1-2-2V7"],
  keyboard: ["r:2,5,20,14,2", "M6 9h.01", "M10 9h.01", "M14 9h.01", "M18 9h.01", "M8 13h.01", "M12 13h.01", "M16 13h.01", "M7 17h10"],
  image: ["r:3,3,18,18,2", "c:9,9,2", "m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"],
  edit: ["M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"],
  trend: ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
  move: ["m5 9-3 3 3 3", "m9 5 3-3 3 3", "m15 19-3 3-3-3", "m19 9 3 3-3 3", "M2 12h20", "M12 2v20"],
  wifi: ["M12 20h.01", "M2 8.82a15 15 0 0 1 20 0", "M5 12.86a10 10 0 0 1 14 0", "M8.5 16.43a5 5 0 0 1 7 0"],
  bt: ["m7 7 10 10-5 5V2l5 5L7 17"],
  logout: ["M16 17l5-5-5-5", "M21 12H9"],
  share: ["M12 3v12", "m8 7 4-4 4 4", "M8 11H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"],
  addsq: ["r:3,3,18,18,5", "M12 8v8", "M8 12h8"],
  dots: ["M12 5h.01", "M12 12h.01", "M12 19h.01"],
};
function ico(name, cls = "") {
  const parts = (IC[name] || []).map((p) => {
    if (p.startsWith("f:")) return `<path d="${p.slice(2)}" fill="currentColor" stroke="none" opacity=".2"/>`;
    if (p.startsWith("c:")) { const [cx, cy, r] = p.slice(2).split(","); return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`; }
    if (p.startsWith("r:")) { const [x, y, w, h, rx] = p.slice(2).split(","); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`; }
    return `<path d="${p}"/>`;
  }).join("");
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts}</svg>`;
}

/* ───────────────────────── logo (redrawn: geometric G + growth arrow on one 8-unit grid) ─────────────────────────
   The drawn ink spans x 9–88.25, y 9–87.92: the <g> shifts it so its box sits dead centre in the 100×100 viewBox. */
let gidN = 0;
function logoMark({ mono = null, grad = false } = {}) {
  const id = "lg" + gidN++;
  const paint = mono || (grad ? `url(#${id})` : "#5B2BFF");
  return `<svg viewBox="0 0 100 100" class="mk" aria-hidden="true"><defs><linearGradient id="${id}" x1="12" y1="10" x2="88" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8F63FF"/><stop offset="1" stop-color="#3B16D9"/></linearGradient></defs>
  <g transform="translate(1.375 1.54)"><path d="M86 16H50A34 34 0 0 0 25.96 74.04" fill="none" stroke="${paint}" stroke-width="14"/>
  <path d="M40.5 83.5 80 44M52 42h30v30" fill="none" stroke="${paint}" stroke-width="12.5" stroke-linejoin="miter" stroke-miterlimit="4"/></g></svg>`;
}
function appIcon(size = 40) {
  /* « Crème et violet »: cream tile, soft rim, violet G, sitting on a sand edge */
  return `<span class="gg-appic" style="width:${size}px;height:${size}px;border-radius:${size * 0.28}px;display:grid;place-items:center;background:#FFFDF8;box-shadow:0 0 0 ${size > 60 ? 2 : 1.5}px #DCCFB8 inset,0 ${Math.max(2, Math.round(size / 18))}px 0 #E2D6C2;flex:none"><span style="width:${size * 0.62}px;height:${size * 0.62}px;display:block">${logoMark({ mono: "#5B2BFF" }).replace('class="mk"', 'class="mk" style="width:100%;height:100%;display:block"')}</span></span>`;
}

/* the restaurant's own logo (r.logo: data:image or http(s) URL, set in onboarding or Réglages › Logo), "" when none */
const restoLogo = (r) => { if (r === undefined) r = typeof S !== "undefined" ? S.resto : null; const l = r && typeof r.logo === "string" ? r.logo.trim() : ""; return /^(data:image\/|https?:\/\/)/i.test(l) ? l : ""; };
/* a restaurant's initials skip the articles: « Le Comptoir » and « La Cantine » must not both read « LC » */
const restoIni = (n) => { const w = String(n || "R").replace(/[’']/g, " ").split(/\s+/).filter((x) => x && !/^(le|la|les|l|du|de|des|d|au|aux|à|chez|et|&)$/i.test(x)); return w.length ? w.slice(0, 2).map((x) => x[0]).join("").toUpperCase() : initials(n); };
/* the logo as a small rounded tile (.rlogo, css/base.css); without one: `fb` when given, else the initials tile. A logo that fails to load falls back to the initials. */
function restoMark(size = 28, r, fb) {
  if (r === undefined) r = typeof S !== "undefined" ? S.resto : null;
  const l = restoLogo(r), ini = restoIni((r && r.name) || "R").replace(/[^\p{L}\p{N}]/gu, "") || "R";
  if (!l) return fb != null ? fb : `<span class="rlogo ini" style="--s:${size}px">${esc(ini)}</span>`;
  return `<span class="rlogo" style="--s:${size}px"><img src="${esc(l)}" alt="" referrerpolicy="no-referrer" onerror="var p=this.parentNode;p.classList.add('ini');p.textContent='${ini}'"></span>`;
}

/* ───────────────────────── sound + haptics ───────────────────────── */
const SFX = {
  ctx: null, on: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; } } if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  tone(f, d, type = "sine", v = 0.05, at = 0, f2 = null) {
    if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, v = 0.03, from = 2400, to = 400, at = 0) {
    if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + at; const len = Math.floor(c.sampleRate * d);
    const b = c.createBuffer(1, len, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + d);
  },
  /* volumes kept low on purpose: a kitchen app should feel, not shout. Mute lives in Réglages (ACT.sound). */
  tap() { this.tone(2200, 0.022, "triangle", 0.011); },
  tick() { this.tone(3000, 0.01, "triangle", 0.007); },
  ok() { this.tone(784, 0.1, "sine", 0.038); this.tone(1175, 0.16, "sine", 0.03, 0.07); },
  done() { [659, 880, 1109, 1319].forEach((f, i) => this.tone(f, 0.2, "sine", 0.028, i * 0.07)); this.tone(2637, 0.45, "sine", 0.007, 0.3); },
  scan() { this.tone(1900, 0.05, "triangle", 0.03); this.tone(2850, 0.07, "triangle", 0.024, 0.06); },
  err() { this.tone(330, 0.12, "triangle", 0.04, 0, 240); this.tone(240, 0.15, "triangle", 0.034, 0.11, 180); },
  sheet() { this.noise(0.2, 0.012, 700, 2400); },
  close() { this.noise(0.16, 0.009, 2200, 600); },
  print() { for (let i = 0; i < 9; i++) this.tone(140 + (i % 2) * 30, 0.09, "triangle", 0.01, i * 0.16); this.noise(1.4, 0.005, 3000, 1800); this.tone(1568, 0.12, "sine", 0.028, 1.55); },
};
const buzz = (p = 8) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ───────────────────────── data layer ─────────────────────────
   DB.mode: "local" (this device, localStorage gg-local), "demo" (in memory, never persisted, seeded by js/demo.js),
   or "db" (Firestore through js/auth.js, offline cache on; or the Claude runtime db). Same API in every mode:
   DB.watch(col, {order, dir, limit}, cb) · DB.add · DB.set · DB.update · DB.del, data under restos/{rid}/{col}. */
const DB = {
  mode: "local", db: null, uid: null, subs: [],
  local: (() => { try { return JSON.parse(localStorage.getItem("gg-local") || "{}"); } catch (e) { return {}; } })(),
  listeners: {},
  dirty: false,
  flush() { if (!DB.dirty || DB.mode === "demo") return; DB.dirty = false; try { localStorage.setItem("gg-local", JSON.stringify(DB.local)); } catch (e) {} },
  saveLocal: (() => { const d = debounce(() => DB.flush(), 60); return () => { if (DB.mode === "demo") return; DB.dirty = true; d(); }; })(),
  emit(path) { const all = Object.entries(this.local[path] || {}).map(([id, d]) => ({ id, ...d })); (this.listeners[path] || []).forEach((l) => { const o = l.opts || {}; let rows = all.slice(); if (o.order) { const k = o.order, m = o.dir === "desc" ? -1 : 1; rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * m); } if (o.limit) rows = rows.slice(0, o.limit); l(rows); }); this.saveLocal(); },
  path(col) { return col === "restos" ? "restos" : `restos/${S.rid}/${col}`; },
  /* Firestore refuses undefined values and class instances: plain JSON only */
  clean: (d) => JSON.parse(JSON.stringify(d ?? {})),
  /* a Firestore write promise only settles when the server acknowledges it, which never happens offline (the kitchen cellar):
     the local cache already has the write, so callers wait at most 1.5 s online, not at all offline. A late refusal still shows. */
  dbw(p, m) {
    let late = false;
    /* js/horsligne.js: every write joins the visible « en attente » queue until the server acknowledges it */
    if (typeof NET !== "undefined" && m) NET.track(p, m);
    p.catch((e) => { console.warn("db write", e); if (late) { SFX.err(); toast(e && e.code === "permission-denied" ? "Modification refusée : votre rôle ne le permet pas." : "Une modification n'a pas pu être enregistrée.", "err"); } });
    /* NET.off also knows the Wi-Fi that is connected but reaches nothing (js/horsligne.js probes it) */
    const wait = (typeof navigator !== "undefined" && navigator.onLine === false) || (typeof NET !== "undefined" && NET.off) ? 0 : 1500;
    return Promise.race([p, new Promise((r) => setTimeout(() => { late = true; r(); }, wait))]);
  },
  watch(col, opts, cb) {
    const path = this.path(col);
    if (this.mode === "db") {
      if (col === "restos" && this.uid) return this.watchMyRestos(cb);
      let q = this.db.collection(path); if (opts.order) q = q.orderBy(opts.order, opts.dir || "asc"); if (opts.limit) q = q.limit(opts.limit);
      const timer = setTimeout(() => { if (S.slow) return; S.slow = true; refresh(); }, 10000); /* one banner + one re-render for all the watches, not one each */
      /* a listener opened a moment before a new membership reaches the server is refused once: retry a few times, then report */
      let un = null, dead = false; const t0 = Date.now();
      const start = (n) => { un = q.onSnapshot((snap) => { if (!snap.metadata.fromCache) { clearTimeout(timer); S.slow = false; } cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); }, (e) => {
        if (!dead && e && e.code === "permission-denied" && n < 4 && Date.now() - t0 < 30000) { setTimeout(() => { if (!dead) start(n + 1); }, 1200 * (n + 1)); return; }
        clearTimeout(timer); console.warn("db", col, e); S.dbErr = e && e.code; refresh(); }); };
      start(0);
      this.subs.push(() => { dead = true; clearTimeout(timer); try { un && un(); } catch (e) {} }); return;
    }
    cb.opts = opts || {}; (this.listeners[path] ||= []).push(cb); setTimeout(() => this.emit(path), 0);
  },
  /* accounts (js/auth.js): a user may only read the restaurants they belong to, so the list comes from users/{uid}.restos
     and each restos/{rid} doc is watched on its own. The callback waits until every listed doc has answered. */
  watchMyRestos(cb) {
    const fs = this.db, subs = {}, docs = {}, seen = new Set(); let ids = [];
    const emit = () => { if (ids.every((id) => seen.has(id))) cb(ids.filter((id) => docs[id]).map((id) => ({ id, ...docs[id] }))); };
    const un = fs.collection("users").doc(this.uid).onSnapshot((s) => {
      const d = s.exists ? s.data() || {} : {}; ids = Array.isArray(d.restos) ? d.restos.filter((x) => typeof x === "string") : [];
      Object.keys(subs).forEach((id) => { if (!ids.includes(id)) { try { subs[id](); } catch (e) {} delete subs[id]; delete docs[id]; seen.delete(id); } });
      ids.forEach((id) => {
        if (subs[id]) return;
        const sub = (n) => { subs[id] = fs.collection("restos").doc(id).onSnapshot((x) => { seen.add(id); if (x.exists) docs[id] = x.data(); else delete docs[id]; emit(); },
          (e) => { console.warn("resto", id, e && e.code); seen.add(id); delete docs[id]; emit(); delete subs[id]; if (n < 4) setTimeout(() => { if (ids.includes(id) && !subs[id]) sub(n + 1); }, 1500 * (n + 1));
            /* still refused after the retries while online: removed from that team (or the restaurant was deleted), so drop it from my list for good */
            else if (e && e.code === "permission-denied" && navigator.onLine !== false && ids.includes(id)) fs.collection("users").doc(this.uid).set({ restos: firebase.firestore.FieldValue.arrayRemove(id) }, { merge: true }).catch(() => {}); }); };
        sub(0);
      });
      emit();
    }, (e) => { console.warn("users", e && e.code); S.dbErr = e && e.code; ids = []; emit(); });
    this.subs.push(() => { try { un(); } catch (e) {} Object.values(subs).forEach((u) => { try { u(); } catch (e) {} }); });
  },
  /* a new restaurant with accounts: the resto, its owner's gérant membership and the owner's list, in one atomic batch (works offline) */
  createResto(id, data) {
    const fs = this.db, FV = firebase.firestore.FieldValue, u = (typeof authUser === "function" && authUser()) || {};
    const b = fs.batch();
    b.set(fs.collection("restos").doc(id), this.clean({ ...this.restoDefaults(data), owner: this.uid, createdAt: data.createdAt || Date.now() }));
    b.set(fs.doc(`restos/${id}/members/${this.uid}`), this.clean({ name: S.me.name || u.name || "", email: u.email || "", photo: u.photo || "", role: "gerant", joinedAt: Date.now() }));
    b.set(fs.collection("users").doc(this.uid), { restos: FV.arrayUnion(id) }, { merge: true });
    return b.commit();
  },
  /* commercial fields on a new restaurant (js/abo.js reads them): a 14-day trial of the pack chosen on the site, Complet by default */
  restoDefaults(d) {
    const now = Date.now(); let pack = "complet"; try { const g = localStorage.getItem("gg-plan"); if (g === "essentiel" || g === "pro") pack = g; localStorage.removeItem("gg-plan"); } catch (e) {}
    return { plan: "essai", pack, trialEnds: ((d && d.createdAt) || now) + 14 * 864e5, ...(d || {}) };
  },
  /* the subscription gate (js/abo.js): once the trial is over, the app stays readable but a write opens the « essai terminé » sheet */
  gate(col) { return typeof abBlocked === "function" && typeof abRefuse === "function" && abBlocked(col) ? abRefuse(col) : null; },
  unsubAll() { this.subs.forEach((u) => { try { u(); } catch (e) {} }); this.subs = []; this.listeners = {}; },
  async add(col, data) { const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)); await this.set(col, id, data); return id; },
  async set(col, id, data) {
    const path = this.path(col); const g = this.gate(col); if (g) return g;
    if (col === "restos" && !(this.mode === "db" ? S.restos.find((r) => r.id === id) : (this.local[path] || {})[id]) && data && typeof data === "object") Object.assign(data, this.restoDefaults(data));
    if (this.mode === "db") {
      const m = { col, id, op: "set", data };
      if (this.uid && col === "restos" && !S.restos.find((r) => r.id === id)) return this.dbw(this.createResto(id, data), m);
      /* members: merge, so an area writing {role, name, color} keeps the account's e-mail and photo */
      const ref = this.db.collection(path).doc(id);
      return this.dbw(this.uid && col === "members" ? ref.set(this.clean(data), { merge: true }) : ref.set(this.clean(data)), m);
    }
    (this.local[path] ||= {})[id] = JSON.parse(JSON.stringify(data)); this.emit(path);
  },
  async update(col, id, patch) {
    const path = this.path(col); const g = this.gate(col); if (g) return g;
    if (this.mode === "db") return this.dbw(this.db.collection(path).doc(id).update(this.clean(patch)), { col, id, op: "update", data: patch });
    const cur = (this.local[path] ||= {})[id] || {}; this.local[path][id] = { ...cur, ...JSON.parse(JSON.stringify(patch)) }; this.emit(path);
  },
  async del(col, id) {
    const path = this.path(col); const g = this.gate(col); if (g) return g;
    if (this.mode === "db") return this.dbw(this.db.collection(path).doc(id).delete(), { col, id, op: "del" });
    if (this.local[path]) delete this.local[path][id]; this.emit(path);
  },
};
/* never lose a write to the debounce: flush when the page is hidden, frozen or unloaded */
["pagehide", "beforeunload"].forEach((ev) => window.addEventListener(ev, () => DB.flush()));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") DB.flush(); });
async function safe(p, msg = "Impossible d'enregistrer. Vérifiez la connexion et réessayez.") {
  try { return await p; } catch (e) {
    if (e && e.code === "ab/blocked") throw e; /* the subscription sheet is already on screen (js/abo.js) */
    console.warn(e); SFX.err();
    if (e && e.code === "quota_exceeded") toast("Espace de stockage plein : supprimez d'anciennes photos dans le registre.", "err");
    else if (e && (e.code === "not_granted" || e.code === "revoked")) toast("Vous n'avez pas le droit de modifier. Demandez l'accès « Peut modifier ».", "err");
    else toast(msg, "err");
    throw e;
  }
}

/* ───────────────────────── state ───────────────────────── */
const S = {
  me: { id: "local", name: "" }, isOwner: true, cap: {}, rid: null, restos: [], resto: null, ready: false,
  fridges: [], readings: [], lots: [], products: [], counts: [], receptions: [], events: [], notes: [], chores: [], choreLogs: [], tickets: [], members: [],
  moves: [], staff: [], shifts: [], punches: [], obligations: [], oblLogs: [], feedback: [], expenses: [], invoices: [], prices: [],
  profiles: {}, route: "home", params: {}, history: [], slot: slotNow(), open: null, temp: {}, ui: {},
  rec: null, tz: null, zone: null, stockTab: "inv", noteCat: "Toutes", noteQ: "", regFilter: "all", slow: false, dbErr: null,
};
try { S.me.name = localStorage.getItem("gg-name") || ""; S.rid = localStorage.getItem("gg-rid"); SFX.on = localStorage.getItem("gg-sound") !== "off"; } catch (e) {}

/* the 14 regulated allergens (EU 1169/2011, annex II), shared by recipes, products, reception and stock */
const ALLERGENS = [
  { id: "gluten", t: "Gluten", s: "Céréales contenant du gluten (blé, seigle, orge, avoine…)" },
  { id: "crustaces", t: "Crustacés", s: "Crevettes, crabes, homard, langoustines…" },
  { id: "oeufs", t: "Œufs", s: "Œufs et produits à base d'œufs" },
  { id: "poissons", t: "Poissons", s: "Poissons et produits à base de poisson" },
  { id: "arachides", t: "Arachides", s: "Cacahuètes et produits dérivés" },
  { id: "soja", t: "Soja", s: "Soja et produits à base de soja" },
  { id: "lait", t: "Lait", s: "Lait et produits laitiers (y compris lactose)" },
  { id: "fruitscoque", t: "Fruits à coque", s: "Amandes, noisettes, noix, cajou, pécan, pistaches…" },
  { id: "celeri", t: "Céleri", s: "Céleri et produits à base de céleri" },
  { id: "moutarde", t: "Moutarde", s: "Moutarde et produits à base de moutarde" },
  { id: "sesame", t: "Sésame", s: "Graines de sésame et produits dérivés" },
  { id: "sulfites", t: "Sulfites", s: "Anhydride sulfureux et sulfites > 10 mg/kg (vin, vinaigre…)" },
  { id: "lupin", t: "Lupin", s: "Lupin et produits à base de lupin" },
  { id: "mollusques", t: "Mollusques", s: "Huîtres, moules, coquillages, calamars…" },
];
const allergenOf = (id) => ALLERGENS.find((a) => a.id === id);
const ROLES = { gerant: "Gérant", chef: "Chef", equipe: "Équipe" };
const ZONES = ["Réserve sèche", "Chambre froide 1", "Chambre froide 2", "Bar", "Congélateur"];
const UNITS = ["kg", "g", "L", "PCE", "DZ", "pièce", "bourriche", "colis", "botte"];
/* units: base list of a picker + PCE/DZ + the restaurant's own units (resto.units) + any unit already used; « + Autre » adds a custom one */
const UNIT_NAMES = { PCE: "pièce", DZ: "douzaine" };
function unitsFor(base, cur) {
  const own = (S.resto && Array.isArray(S.resto.units) ? S.resto.units : []); let loc = []; try { loc = JSON.parse(localStorage.getItem("gg-units-" + (S.rid || "")) || "[]"); } catch (e) {}
  const used = (S.products || []).map((p) => p.unit).filter(Boolean);
  const all = [...base, "PCE", "DZ", ...own, ...loc, ...used, cur].filter((u) => u && String(u).trim());
  const seen = new Set(); return all.filter((u) => { const k = String(u).trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
function unitSave(u) {
  u = String(u || "").trim().slice(0, 16); if (!u) return "";
  try { const k = "gg-units-" + (S.rid || ""); const l = JSON.parse(localStorage.getItem(k) || "[]"); if (!l.includes(u)) { l.push(u); localStorage.setItem(k, JSON.stringify(l)); } } catch (e) {}
  if (S.resto && S.rid && myRole() === "gerant") { const units = [...new Set([...(S.resto.units || []), u])]; S.resto.units = units; try { DB.update("restos", S.rid, { units }).catch(() => {}); } catch (e) {} }
  return u;
}
/* « + Autre » chip in a unit picker: data-pick = the action the unit chips use; an inline field appears, Enter/OK adds the chip and selects it */
const ACTIONS = ["Produits déplacés dans un autre frigo", "Thermostat réglé", "Porte mal fermée, refermée", "Technicien appelé", "Produits jetés"];
const nameOf = (uid, r) => (uid === "sonde" ? ((r && r.by) || "Sonde") : uid === S.me.id ? (S.me.name || "Vous") : (S.profiles[uid]?.name || S.members.find((m) => m.id === uid)?.name || "Quelqu'un"));
const said = (uid, text) => (uid === S.me.id ? `Vous avez ${String(text).replace(/^a /, "")}` : `${firstName(nameOf(uid))} ${text}`);
const avatar = (uid, sm = false) => { const p = S.profiles[uid] || (uid === S.me.id ? S.me : null); const n = p?.name || S.members.find((m) => m.id === uid)?.name || ""; if (!n && !p?.avatarUrl) return `<span class="ava${sm ? " sm" : ""}" style="background:rgba(14,19,48,.08);color:var(--muted)">${ico("users").replace('class="ico ', `style="width:${sm ? 11 : 15}px;height:${sm ? 11 : 15}px" class="ico `)}</span>`; const img = p?.avatarUrl ? `<img src="${esc(p.avatarUrl)}" alt="">` : esc(initials(n)); return `<span class="ava${sm ? " sm" : ""}" style="background:${p?.color && !p.avatarUrl ? esc(p.color) : colorFor(uid)}" title="${esc(n)}">${img}</span>`; };
const fridgeName = (id) => S.fridges.find((f) => f.id === id)?.name || "—";
const dlcOf = (l) => (l.status === "opened" && l.dlcOpen ? l.dlcOpen : l.dlc);
const activeLots = () => S.lots.filter((l) => l.status === "in" || l.status === "opened");
const myRole = () => (S.isOwner ? "gerant" : (S.members.find((m) => m.id === S.me.id)?.role || "equipe"));

function readingsFor(day, slot) { return S.readings.filter((r) => r.day === day && (!slot || r.slot === slot) && S.fridges.some((f) => f.id === r.fridgeId)); }
function todayStats(slot) {
  const day = dayKey(); if (slot) { const exp = S.fridges.length; const set = new Set(readingsFor(day, slot).map((r) => r.fridgeId)); return { done: Math.min(set.size, exp), exp }; }
  const exp = S.fridges.length * 2; const set = new Set(readingsFor(day).map((r) => r.fridgeId + r.slot));
  return { done: Math.min(set.size, exp), exp };
}
function dlcPill(k) {
  const d = daysUntil(k); if (d == null) return `<span class="pill neu">Sans DLC</span>`;
  if (d < 0) return `<span class="pill bad"><span class="dot"></span>Dépassée</span>`;
  if (d === 0) return `<span class="pill bad"><span class="dot"></span>Aujourd'hui</span>`;
  if (d === 1) return `<span class="pill bad">Demain</span>`;
  if (d <= 3) return `<span class="pill warn">${shortDate(k)}</span>`;
  return `<span class="pill ok">${shortDate(k)}</span>`;
}
async function logEvent(type, text, extra = {}) { try { await DB.add("events", { type, text, at: Date.now(), uid: S.me.id, ...extra }); } catch (e) {} }

/* ───────────────────────── capabilities boot ───────────────────────── */
async function boot() {
  const C = window.claude;
  const use = async (n) => { try { return C && C.use ? await C.use(n) : null; } catch (e) { return null; } };
  const [db, user, sample, assets, downloads] = await Promise.all([use("db"), use("user"), use("sample"), use("assets"), use("downloads")]);
  S.cap = { db, user, sample, assets, downloads: downloads || LOCAL_DOWNLOADS };
  registerSW(); PHOTOS.persist();
  if (!assets) await Promise.race([PHOTOS.warm(), new Promise((r) => setTimeout(r, 1500))]);
  if (user) {
    try { const me = await user.me(); const id = await user.id(); S.me = { id: id || me.id || "anon", name: me.name || "", avatarUrl: me.avatarUrl, color: me.color }; S.isOwner = !!me.isOwner; S.profiles[S.me.id] = { ...S.me }; } catch (e) {}
  }
  if (db && S.me.id && S.me.id !== "local") { DB.mode = "db"; DB.db = db; }
  else if (typeof AUTH !== "undefined" && AUTH.gate) {
    /* js/auth.js decides: welcome screen, demo, this device only, or a signed-in account (Firestore) */
    const g = (await AUTH.gate()) || { mode: "local" };
    if (g.mode === "db") {
      DB.mode = "db"; DB.db = g.fs; DB.uid = g.user.uid; memberChecked = true; S.isOwner = false;
      S.me = { id: g.user.uid, name: g.user.name || "", email: g.user.email || "", avatarUrl: g.user.photo || undefined }; S.profiles[S.me.id] = { ...S.me };
      S.rid = g.rid || lsGet("gg-rid-c") || null;
    } else if (g.mode === "demo") {
      DB.mode = "demo"; DB.local = g.data; S.rid = g.rid; S.me = { ...g.me }; S.isOwner = true; S.profiles[S.me.id] = { ...S.me };
    } else S.isOwner = true;
  } else { S.isOwner = true; }
  DB.watch("restos", {}, (rows) => {
    S.restos = rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!S.rid || !S.restos.find((r) => r.id === S.rid)) { S.rid = S.restos[0]?.id || null; if (S.rid) attachResto(); }
    S.resto = S.restos.find((r) => r.id === S.rid) || null;
    if (!S.ready) { S.ready = true; finishBoot(); } else refresh();
    /* removed from every team (or the last restaurant deleted): back to « créer ou rejoindre » */
    if (S.ready && DB.uid && !S.restos.length && typeof AUTH !== "undefined" && AUTH.noResto) AUTH.noResto();
  });
  if (S.rid) attachResto();
  setTimeout(() => { if (!S.ready) { S.ready = true; finishBoot(); } }, 10000);
}
function finishBoot() {
  renderChrome();
  go(S.resto ? "home" : "onboarding", {}, { replace: true });
  /* deep link from a home-screen shortcut (manifest "shortcuts"): ./?go=releve — Accueil stays underneath, so Retour lands there */
  try { const u = new URL(location.href), t = u.searchParams.get("go"); if (t) { u.searchParams.delete("go"); history.replaceState(null, "", u.pathname + u.search + u.hash); if (S.resto && VIEWS[t] && t !== "home" && t !== "onboarding") go(t, t === "reception" ? { fresh: true } : {}); } } catch (e) {}
  window.bootOut ? bootOut(250) : setTimeout(() => $("#boot").classList.add("out"), 250);
  /* hook for js/compte.js (PIN lock) and others: the app is on screen, mode and person are known */
  try { window.dispatchEvent(new CustomEvent("gg:ready", { detail: { mode: DB.mode, uid: DB.uid, rid: S.rid } })); } catch (e) {}
}
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
let attachedRid = null;
function attachResto() {
  if (!S.rid || attachedRid === S.rid) return; attachedRid = S.rid;
  /* the last open restaurant, per mode (the demo never touches this device's choice) */
  if (DB.mode !== "demo") { try { localStorage.setItem(DB.uid ? "gg-rid-c" : "gg-rid", S.rid); } catch (e) {} }
  const keep = DB.subs.length ? DB.subs.shift() : null; DB.subs.forEach((u) => { try { u(); } catch (e) {} }); DB.subs = keep ? [keep] : [];
  if (DB.mode === "local") { Object.keys(DB.listeners).forEach((k) => { if (k !== "restos") delete DB.listeners[k]; }); }
  const w = (col, opts, key, after) => DB.watch(col, opts, (rows) => { S[key] = rows; after && after(); onData(); });
  w("fridges", {}, "fridges", () => S.fridges.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0)));
  w("readings", { order: "at", dir: "desc", limit: 3000 }, "readings");
  w("lots", { order: "createdAt", dir: "desc", limit: 2000 }, "lots");
  w("products", {}, "products", () => S.products.sort((a, b) => a.name.localeCompare(b.name, "fr")));
  w("counts", {}, "counts");
  w("receptions", { order: "at", dir: "desc", limit: 1000 }, "receptions");
  w("events", { order: "at", dir: "desc", limit: 250 }, "events");
  w("notes", {}, "notes");
  w("chores", {}, "chores");
  w("choreLogs", { order: "at", dir: "desc", limit: 400 }, "choreLogs");
  w("tickets", { order: "at", dir: "desc", limit: 60 }, "tickets");
  w("members", {}, "members", () => { syncAccountMembers(); ensureMember(); });
  /* V3 shared collections (see tools/BRIEF.md « V3 data contract ») */
  w("moves", { order: "at", dir: "desc", limit: 5000 }, "moves");
  w("staff", {}, "staff");
  w("shifts", {}, "shifts");
  w("punches", { order: "at", dir: "desc", limit: 4000 }, "punches");
  w("obligations", {}, "obligations");
  w("oblLogs", { order: "at", dir: "desc", limit: 1000 }, "oblLogs");
  w("feedback", { order: "at", dir: "desc", limit: 1000 }, "feedback");
  w("expenses", { order: "at", dir: "desc", limit: 3000 }, "expenses");
  /* js/marge.js: supplier invoices + purchase price history */
  w("invoices", { order: "at", dir: "desc", limit: 500 }, "invoices");
  w("prices", { order: "at", dir: "desc", limit: 4000 }, "prices");
}
let memberChecked = false;
/* accounts: role and profile come from restos/{rid}/members/{uid}; names and photos of the team from their member docs */
function syncAccountMembers() {
  if (!DB.uid) return;
  S.members.forEach((m) => { S.profiles[m.id] = { ...(S.profiles[m.id] || {}), name: m.name || S.profiles[m.id]?.name || "", ...(m.photo ? { avatarUrl: m.photo } : {}), ...(m.color ? { color: m.color } : {}) }; });
  const me = S.members.find((m) => m.id === DB.uid);
  if (me) { S.isOwner = me.role === "gerant"; if (me.name && !S.me.name) S.me.name = me.name; }
}
function ensureMember() {
  const mine = S.members.find((m) => m.id === S.me.id); if (mine && mine.name && !S.me.name) { S.me.name = mine.name; }
  if (memberChecked || DB.mode !== "db" || DB.uid) return; memberChecked = true; /* accounts: memberships are written by js/auth.js (create, invite) */
  if (!S.members.find((m) => m.id === S.me.id)) {
    const role = S.isOwner || !S.members.length ? "gerant" : "equipe";
    DB.set("members", S.me.id, { role, joinedAt: Date.now(), ...(S.me.name ? { name: S.me.name } : {}) }).then(() => logEvent("team", `a rejoint ${S.resto?.name || "le restaurant"}`)).catch(() => {});
  }
}
const loadProfiles = debounce(async () => {
  if (!S.cap.user) return;
  const ids = new Set(); [S.events, S.readings.slice(0, 80), S.members, S.lots.slice(0, 80), S.choreLogs.slice(0, 40), S.notes].forEach((arr) => arr.forEach((x) => x.uid && ids.add(x.uid))); S.members.forEach((m) => ids.add(m.id));
  const need = [...ids].filter((i) => i && !S.profiles[i]); if (!need.length) return;
  try { const ps = await S.cap.user.profiles(need); Object.assign(S.profiles, ps); refresh(); } catch (e) {}
}, 400);
const onData = debounce(() => { loadProfiles(); refresh(); renderChrome(); }, 60);

/* ───────────────────────── chrome: side nav + tab bar ───────────────────────── */
const NAV = [
  ["home", "home", "Aujourd'hui"], ["releve", "therm", "Relevés"], ["frigos", "snow", "Frigos"], ["sondes", "sdProbe", "Sondes connectées"], ["scan", "scan", "Scanner"], ["reception", "truck", "Réception"],
  ["sep", "", "Cuisine"], ["notes", "book", "Recettes & allergènes"], ["menage", "spray", "Planning ménage"], ["hygiene", "hygPot", "Hygiène"],
  ["sep", "", "Gestion"], ["dashboard", "dash", "Tableau de bord"], ["finance", "euro", "Finances"], ["stock", "box", "Stock & inventaire"], ["tickets", "receipt", "Tickets de caisse"], ["caisse", "cxPlug", "Caisse connectée"], ["pennylane", "pnyBook", "Comptabilité"], ["registre", "shield", "Registre HACCP"], ["documents", "hygVault", "Coffre-fort documents"], ["controle", "ctBadge", "Contrôle sanitaire"], ["rappel", "ctRecall", "Rappel de lot"], ["obligations", "calcheck", "Obligations & contrôles"],
  ["sep", "", "Équipe"], ["pointeuse", "clock", "Pointeuse"], ["planning", "cal", "Planning"], ["formation", "book", "Formation HACCP"], ["equipe", "users", "Équipe & salaires"], ["avis", "star", "Votre avis"],
  ["sep", "", "Restaurant"], ["resa", "resa", "Réservations"], ["plan", "plZone", "Plan de salle"], ["alertes", "alBell", "Alertes"], ["sites", "store", "Mes établissements"], ["import", "upload", "Importer"], ["imprimante", "printer", "Imprimante"], ["reglages", "sliders", "Réglages"],
];
const TABS = [["home", "home", "Accueil"], ["frigos", "snow", "Frigos"], ["scan", "scan", ""], ["stock", "box", "Stock"], ["more", "grid", "Plus"]];
const TAB_OF = { home: "home", frigos: "frigos", frigo: "frigos", releve: "home", scan: "scan", stock: "stock", reception: "more", tickets: "more", registre: "more", notes: "more", note: "more", menage: "more", equipe: "more", imprimante: "more", reglages: "more", more: "more", dashboard: "more", finance: "more", obligations: "more", pointeuse: "more", planning: "more", avis: "more", import: "more" };
/* employee access (js/perms.js): a route the gérant switched off for this person is hidden everywhere and guarded in go() */
const permOk = (r) => { try { return typeof PERMS === "undefined" || !PERMS.routeAllowed ? true : PERMS.routeAllowed(r) !== false; } catch (e) { return true; } };
const navAllowed = () => { const out = []; NAV.forEach((n) => { if (n[0] !== "sep" && !permOk(n[0])) return; if (n[0] === "sep" && out.length && out[out.length - 1][0] === "sep") out.pop(); out.push(n); }); while (out.length && out[out.length - 1][0] === "sep") out.pop(); return out; };
/* Growth Gusto admins (js/config.js GG_ADMINS) get their own section at the bottom of the sidebar */
const navAdmin = () => { try { if (typeof avisIsAdmin !== "function" || !avisIsAdmin()) return []; return [["sep", "", "Admin"], ...(VIEWS.admin ? [["admin", "shield", "Admin · clients"]] : []), ...(VIEWS.avisAdmin ? [["avisAdmin", "star", "Retours reçus"]] : [])]; } catch (e) { return []; } };
function urgentCount() { return activeLots().filter((l) => (daysUntil(dlcOf(l)) ?? 99) <= 1).length; }
function renderChrome() {
  const side = $("#side");
  const navOn = (NAV.some((n) => n[0] === S.route) && S.route) || (VIEWS[S.route] && VIEWS[S.route].nav) || (TAB_OF[S.route] === "frigos" ? "frigos" : { note: "notes", fiche: "notes", tzEdit: "tickets", regReport: "registre" }[S.route] || S.route);
  const pend = S.fridges.length - todayStats(S.slot || slotNow()).done; /* current service only */
  side.innerHTML = `<div class="brand">${appIcon(36)}<span>Growth <span class="gg-b">Gusto</span></span></div>
    ${S.resto ? `<button class="nav" data-act="restoSwitch" style="background:var(--glass-2);margin-bottom:10px">${restoMark(28, S.resto, `<span style="width:28px;height:28px;flex:none;border-radius:9px;display:grid;place-items:center;background:#F6B93B;color:#1B1530;box-shadow:0 2px 0 #D99A1E;font-size:11px;font-weight:800">${esc(restoIni(S.resto.name))}</span>`)}<span style="flex:1;min-width:0;text-align:left"><b style="display:block;color:var(--ink);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.resto.name)}</b><span style="font-size:11.5px">${S.restos.length} établissement${S.restos.length > 1 ? "s" : ""}</span></span>${ico("down")}</button>` : ""}
    <div class="navs">${(typeof pzNav === "function" ? pzNav() : navAllowed()).concat(navAdmin()).map(([r, i, t, c]) => r === "sep" ? `<div class="sep">${esc(t)}</div>` : `<button class="nav ${navOn === r ? "on" : ""}${c ? " pz-c " + c : ""}" data-go="${r}">${ico(i)}<span class="nt">${esc(t)}</span>${r === "home" && urgentCount() ? `<span class="count">${urgentCount()}</span>` : ""}${r === "consignes" && typeof csUnread === "function" && csUnread() ? `<span class="count" style="background:var(--accent)">${csUnread()}</span>` : ""}${r === "alertes" && typeof ALERTES !== "undefined" && ALERTES.count() ? `<span class="count" style="background:var(--bad)">${ALERTES.count()}</span>` : ""}${r === "releve" && pend > 0 && S.fridges.length ? `<span class="count" style="background:var(--warn)">${pend}</span>` : ""}</button>`).join("")}</div>
    <div class="me" data-go="reglages" role="button" tabindex="0" title="Réglages">${avatar(S.me.id)}<div style="min-width:0;flex:1"><b>${esc(S.me.name || "Vous")}</b><em>${ROLES[myRole()]}</em></div>${ico("sliders")}</div>`;
  const sv = $(".navs", side);
  if (sv) {
    sv.scrollTop = side._st || 0;
    /* the active item is always visible (short screens: the list scrolls), and the edge fades only show where there is more to scroll */
    const act = $(".nav.on", sv);
    if (act && sv.scrollHeight > sv.clientHeight) { const pad = 14, top = act.offsetTop - sv.offsetTop, bot = top + act.offsetHeight; if (top - pad < sv.scrollTop) sv.scrollTop = Math.max(0, top - pad); else if (bot + pad > sv.scrollTop + sv.clientHeight) sv.scrollTop = bot + pad - sv.clientHeight; side._st = sv.scrollTop; }
    const fades = () => { const more = sv.scrollHeight - sv.clientHeight; sv.classList.toggle("ft", more > 1 && sv.scrollTop > 2); sv.classList.toggle("fb", more > 1 && sv.scrollTop < more - 2); };
    fades(); sv.addEventListener("scroll", () => { side._st = sv.scrollTop; fades(); }, { passive: true });
  }
  if (typeof pzApplyTabs === "function") { try { pzApplyTabs(); } catch (e) {} } /* js/perso.js: the person's 2 free tabs */
  const tb = $("#tabbar"); const on = TAB_OF[S.route] || "more"; const tsig = TABS.map((t) => t.join(",")).join("|");
  if (tb.dataset.built !== tsig) {
    tb.dataset.built = tsig;
    tb.innerHTML = `<span class="ind" id="ind"></span>` + TABS.map(([r, i, t], k) => `<button class="tab" data-tab="${r}" aria-label="${esc(t || "Scanner")}">${k === 2 ? `<span class="fab">${ico(i || "scan")}</span>` : `${ico(i)}${esc(t)}`}</button>`).join("");
  }
  $$(".tab", tb).forEach((b) => { const r = b.dataset.tab; b.style.display = r === "home" || r === "more" || permOk(r) ? "" : "none"; });
  $$(".tab", tb).forEach((b) => { const was = b.classList.contains("on"), now = b.dataset.tab === on; b.classList.toggle("on", now); if (now && !was && tb.dataset.on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } });
  tb.dataset.on = on;
  const vis = TABS.filter((t) => t[0] === "home" || t[0] === "more" || permOk(t[0])); const idx = vis.findIndex((t) => t[0] === on); const ind = $("#ind");
  if (ind) { ind.style.opacity = on === TABS[2][0] ? 0 : 1; ind.style.transform = `translateX(calc(${idx} * (100% + 12px)))`; }
  const noTabs = ["onboarding", "reception", "note", "tzEdit"].includes(S.route) || !!(VIEWS[S.route] && VIEWS[S.route].hideTabs) || !S.resto;
  tb.classList.toggle("hide", noTabs); document.documentElement.classList.toggle("tabs", !noTabs);
  const sd = $("#side"); if (sd) sd.classList.toggle("off", !S.resto || S.route === "onboarding");
}

/* ───────────────────────── router ───────────────────────── */
/* Navigation never drops a tap: a new view can start while the previous one is still leaving (it is removed when its exit ends).
   The current view is always the FIRST .view in #viewport, so $("#viewport .view") keeps meaning "the visible screen".
   A repeat of the same navigation within 450ms (double tap) is ignored. Tab switches crossfade, pushes slide. */
let lastNav = { k: "", t: 0 };
function go(route, params = {}, { back = false, replace = false, tab = false } = {}) {
  const key = route + "|" + JSON.stringify(params || {}), now = Date.now();
  if (!back && key === lastNav.k && now - lastNav.t < 450 && route === S.route) return;
  lastNav = { k: key, t: now };
  if (route !== "home" && route !== "locked" && !permOk(route)) { params = { from: route }; route = "locked"; }
  if (!replace && !back) { S.history.push({ route: S.route, params: S.params }); if (S.history.length > 40) S.history.shift(); }
  if (route === "reception" && (!S.rec || S.rec.done || (params.fresh && !(S.rec.lines || []).length))) S.rec = { step: 1, supplier: "", bl: "", lines: [], done: null, open: 0 };
  if (route === "stock") { S.zone = S.zone || null; }
  S.route = route; S.params = params; closeSheet(true);
  const vp = $("#viewport"); const olds = $$(".view", vp);
  const v = document.createElement("section"); v.className = "view enter" + (back ? " back" : "") + (tab ? " fade" : ""); v.dataset.route = route;
  v.innerHTML = renderRoute(); vp.insertBefore(v, vp.firstChild);
  void v.offsetWidth; v.classList.remove("enter", "back");
  olds.forEach((o) => {
    if (o.classList.contains("leave")) { o.remove(); return; }
    o.classList.add("leave"); if (back) o.classList.add("back"); if (tab) o.classList.add("fade");
    setTimeout(() => o.remove(), 420);
  });
  setTimeout(() => v.classList.remove("fade"), 450);
  afterRender(v); renderChrome(); navSync();
}
function goBack() { const h = S.history.pop(); if (h) go(h.route, h.params, { back: true }); else go("home", {}, { back: true }); }
/* Browser / Android back button and back swipe: one guard entry above the app. Back closes the open sheet first, then walks S.history,
   then returns to Accueil; on Accueil with nothing left, back leaves the app as usual. */
let navGuard = false;
function navGuardPush() { if (navGuard || !S.resto) return; try { history.pushState({ gg: 1 }, ""); navGuard = true; } catch (e) {} }
function navSync() { if (S.route !== "home" || S.history.length > 0) navGuardPush(); }
window.addEventListener("popstate", () => {
  navGuard = false;
  if ($("#sheet").classList.contains("open")) { closeSheet(); navGuardPush(); return; }
  if (!S.resto || S.route === "onboarding") return;
  if (S.history.length || S.route !== "home") { SFX.tap(); goBack(); }
});
let pendingRefresh = false;
/* Scroll guard: re-rendering a list while a finger is on it (or during momentum) kills iOS scrolling and makes the page jump.
   Data/photo refreshes that land mid-scroll wait until the scroll settles, then run once. */
const SCRL = { touch: 0, last: 0, pend: false, t: 0 };
/* busy = a finger is on the screen (removing the touched node would cancel the gesture on iOS), or the page moved in the last 350 ms (momentum).
   Taps are unaffected: the click that acts on them arrives after touchend. */
function scrollBusy() { return SCRL.touch > 0 || performance.now() - SCRL.last < 350; }
function scrollSettle() { clearTimeout(SCRL.t); SCRL.t = setTimeout(() => { if (scrollBusy()) return scrollSettle(); if (SCRL.pendR) { SCRL.pendR = false; rerender(); } else if (SCRL.pend) { SCRL.pend = false; refresh(); } }, 380); }
document.addEventListener("touchstart", (e) => { SCRL.touch = e.touches.length; const t = e.touches[0]; if (e.touches.length === 1) SCRL.touch = 1; if (e.touches.length === 1 && t) { SCRL.x0 = t.clientX; SCRL.y0 = t.clientY; SCRL.dist = 0; SCRL.scrolled = performance.now() - SCRL.last < 120; SCRL.t0 = performance.now(); } }, { passive: true, capture: true });
document.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t && SCRL.x0 != null) SCRL.dist = Math.max(SCRL.dist || 0, Math.hypot(t.clientX - SCRL.x0, t.clientY - SCRL.y0)); }, { passive: true, capture: true });
/* a finger that scrolled (or stopped a momentum scroll) must never "tap" what was under it: iOS can still send a click after such a gesture */
document.addEventListener("click", (e) => {
  if (!SCRL.t0 || performance.now() - SCRL.t0 > 1500) return;
  if ((SCRL.dist || 0) > 12 || SCRL.scrolled) { const tgt = e.target.closest && e.target.closest("[data-go],[data-act],[data-tab],a,button,[role=button]"); if (tgt && !tgt.closest("input,textarea,select,label")) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } }
  SCRL.t0 = 0;
}, true);
const scrlEnd = (e) => { SCRL.touch = e && e.touches ? e.touches.length : 0; if (SCRL.pend || SCRL.pendR) scrollSettle(); };
/* a re-render can detach the touched node (its touchend then never reaches document): pointerup/cancel and a fresh single touch also reset */
window.addEventListener("pointerup", () => { SCRL.touch = 0; if (SCRL.pend || SCRL.pendR) scrollSettle(); }, { passive: true, capture: true }); window.addEventListener("pointercancel", () => { SCRL.touch = 0; }, { passive: true, capture: true });
document.addEventListener("touchend", scrlEnd, { passive: true, capture: true }); document.addEventListener("touchcancel", scrlEnd, { passive: true, capture: true });
document.addEventListener("scroll", () => { SCRL.last = performance.now(); if (SCRL.touch > 0) SCRL.scrolled = true; if (SCRL.pend) scrollSettle(); }, { passive: true, capture: true });
function refresh(force) {
  if (!S.ready) return;
  if (!force && scrollBusy()) { SCRL.pend = true; scrollSettle(); return; }
  SCRL.pend = false;
  const v = $("#viewport .view:not(.leave)"); if (!v) return;
  const VIEW = VIEWS[S.route]; if (VIEW && VIEW.live === false) return;
  const a = document.activeElement; if (a && v.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { pendingRefresh = true; return; }
  const st = v.scrollTop; v.classList.add("nost"); v.innerHTML = renderRoute(); v.scrollTop = st; afterRender(v);
}
document.addEventListener("focusout", () => { if (pendingRefresh) { pendingRefresh = false; setTimeout(refresh, 50); } });
function renderRoute() {
  const V = VIEWS[S.route] || VIEWS.home;
  if (S.route !== "onboarding" && !S.resto && !V.noResto) return VIEWS.onboarding.render();
  return photoFix(V.render(S.params));
}
function afterRender(v) { const V = VIEWS[S.route]; V && V.after && V.after(v); }
/* desktop / iPad landscape: a top-level route (one of the side nav entries) opened from the side nav has nowhere to go back to, so no « Retour » */
const DESK_MQ = window.matchMedia("(min-width:960px)");
const isTopLevel = () => DESK_MQ.matches && !S.history.length && NAV.some((n) => n[0] === S.route);
const topBar = (title, opts = {}) => `<div class="top st" style="--i:0">${opts.noBack || isTopLevel() ? "" : `<button class="iconbtn" data-act="back" aria-label="Retour">${ico("back")}</button>`}<span class="h2">${title}</span>${opts.right || ""}${typeof thTopBtn === "function" ? thTopBtn() : ""}${typeof bigBtn === "function" && !opts.noBig ? bigBtn() : ""}</div>`;
try { DESK_MQ.addEventListener("change", () => { if (S.ready && S.resto) rerender(); }); } catch (e) {}
/* banner(): nothing in the standalone build except, on Accueil, the one-time « Installer l'app » card. */
const banner = () => (S.slow && DB.mode === "db" ? (typeof NET !== "undefined" && NET.off ? `<div class="banner st tap" data-act="hlOpen">${ico("wifi")}<span>Hors ligne : vous voyez les dernières données de cet appareil. Tout ce que vous faites est gardé et partira au retour du réseau.</span></div>` : `<div class="banner st">${ico("clock")}<span>Connexion lente : les données affichées peuvent ne pas être à jour.</span></div>`) : "") + (S.route === "home" ? installHint() : "");

/* ───────────────────────── views ───────────────────────── */
const VIEWS = {};
VIEWS.locked = { render() { return `<div class="inner narrow">${topBar("Accès réservé")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("lock")}</div><b>Cet espace n'est pas ouvert pour vous</b>Demandez au gérant du restaurant si vous devez y accéder.<div style="margin-top:14px"><button class="btn acc" data-go="home">Retour à l'accueil</button></div></div></div>`; } };

/* ───────────────────────── sheets ───────────────────────── */
/* Focus: opening moves focus into the sheet (the dialog itself, so no keyboard pops up on phones), Tab stays inside it while it is open
   (the page behind is inert), and closing gives focus back to what opened it, when that is still on screen. */
let sheetOpener = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable=true]';
const sheetFocusables = () => $$(FOCUSABLE, $("#sheetBody")).filter((e) => !e.closest("[hidden],[inert]") && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
function sheetInert(on) { ["#app", "#tabbar", "#skip"].forEach((s) => { const e = $(s); if (!e) return; if (on) e.setAttribute("inert", ""); else e.removeAttribute("inert"); }); }
function openSheet(html, after) {
  const b = $("#sheetBody"), sh = $("#sheet"); const was = sh.classList.contains("open");
  const a = document.activeElement; if (!was && a && a !== document.body && !sh.contains(a)) sheetOpener = a;
  b.innerHTML = photoFix(html); if (!was) b.scrollTop = 0; sh.style.transform = ""; $("#scrim").style.opacity = "";
  $("#scrim").classList.add("on"); sh.classList.add("open"); sheetInert(true); if (!was) { SFX.sheet(); buzz(4); navGuardPush(); }
  const h = $("h1,h2,h3,.h2,.h3", b); if (h) { h.id = h.id || "sheetTitle"; sh.setAttribute("aria-labelledby", h.id); } else sh.removeAttribute("aria-labelledby");
  if (!sh.contains(document.activeElement)) { try { sh.focus({ preventScroll: true }); } catch (e) {} }
  after && after(b);
}
function closeSheet(silent) {
  const sh = $("#sheet"); if (!sh.classList.contains("open")) return;
  sh.classList.remove("open", "drag"); sh.style.transform = ""; $("#scrim").style.opacity = ""; $("#scrim").classList.remove("on"); sheetInert(false); sh.removeAttribute("aria-labelledby");
  const had = document.activeElement && sh.contains(document.activeElement); if (had) document.activeElement.blur();
  const o = sheetOpener; sheetOpener = null;
  if (o && o.isConnected && !o.closest(".view.leave") && (had || document.activeElement === document.body)) { try { o.focus({ preventScroll: true }); } catch (e) {} }
  if (!silent) SFX.close();
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || !$("#sheet").classList.contains("open")) return;
  const f = sheetFocusables(), sh = $("#sheet"), a = document.activeElement;
  if (!f.length) { e.preventDefault(); sh.focus({ preventScroll: true }); return; }
  const first = f[0], last = f[f.length - 1];
  if (!sh.contains(a) || a === sh) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
  if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
});
/* drag-to-dismiss on touch phones: pull the grab handle, or pull down while the sheet body is scrolled to the top */
(function sheetDrag() {
  const sh = $("#sheet"), scrim = $("#scrim"), body = $("#sheetBody");
  let y0 = null, x0 = 0, dy = 0, drag = false, lastY = 0, lastT = 0, vel = 0;
  const phone = () => window.matchMedia("(max-width:959px)").matches;
  sh.addEventListener("touchstart", (e) => {
    y0 = null; if (!sh.classList.contains("open") || e.touches.length > 1 || !phone()) return;
    const onGrab = !!e.target.closest(".grab");
    if (!onGrab && (body.scrollTop > 0 || e.target.closest("input,textarea,select,canvas,video,[data-nodrag]"))) return;
    y0 = lastY = e.touches[0].clientY; x0 = e.touches[0].clientX; lastT = performance.now(); dy = 0; vel = 0; drag = false;
  }, { passive: true });
  sh.addEventListener("touchmove", (e) => {
    if (y0 == null) return; const y = e.touches[0].clientY, d = y - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (!drag) {
      if (d > 8 && d > dx) { drag = true; sh.classList.add("drag"); y0 = y - 1; }
      else { if (d < -6 || dx > 12) y0 = null; return; }
    }
    e.preventDefault();
    const raw = y - y0; dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2; /* rubber band when pulled upward */
    const now = performance.now(); vel = (y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now;
    sh.style.transform = `translateY(${dy}px)`;
    scrim.style.opacity = String(Math.max(0.15, 1 - Math.max(0, dy) / (sh.offsetHeight * 1.1)));
  }, { passive: false });
  const end = () => {
    if (y0 == null) return; y0 = null; if (!drag) return; drag = false; sh.classList.remove("drag");
    if (dy > Math.min(150, sh.offsetHeight * 0.32) || (vel > 0.55 && dy > 24)) { buzz(6); closeSheet(); }
    else { sh.style.transform = ""; scrim.style.opacity = ""; }
  };
  sh.addEventListener("touchend", end); sh.addEventListener("touchcancel", end);
})();
/* iOS home-screen app with a black-translucent status bar: WebKit draws from the very top of the screen but sizes the layout viewport
   (100vh, 100dvh, fixed positioning) to the screen MINUS the status bar, leaving an empty band at the bottom. Measure the real screen
   height (screen.* never rotates on iOS, so pick the side that matches the orientation) and size body to it; body is the containing block
   of every fixed layer in standalone (see base.css). Only a 1..100px shortfall is corrected: Stage Manager / split windows stay as they are. */
const APPH = { px: 0 };
function appHeight() {
  const de = document.documentElement; if (!de.classList.contains("standalone")) { de.style.removeProperty("--appH"); APPH.px = 0; return; }
  const ih = window.innerHeight, portrait = ih >= window.innerWidth;
  const sh = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const gap = sh - ih; const h = gap > 0 && gap <= 100 ? sh : ih;
  APPH.px = h; de.style.setProperty("--appH", h + "px");
}
appHeight();
window.addEventListener("resize", appHeight); window.addEventListener("orientationchange", () => setTimeout(appHeight, 250));
/* on-screen keyboard (iOS): lift the sheet above it and keep the focused field visible */
(function kbLift() {
  const vv = window.visualViewport; if (!vv) return;
  const upd = () => { const de = document.documentElement; const kb = Math.max(0, (document.body.clientHeight || APPH.px || window.innerHeight) - vv.height - vv.offsetTop); const ae = document.activeElement; const typing = !!(ae && ae.matches && ae.matches("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea,select,[contenteditable]")); const on = kb > 80 && typing; /* iOS 26 Safari also shrinks visualViewport when its toolbar moves: only a focused field means a keyboard */ de.style.setProperty("--kb", (on ? kb : 0) + "px"); de.style.setProperty("--vvh", vv.height + "px"); de.classList.toggle("kb", on); };
  upd();
  vv.addEventListener("resize", upd); vv.addEventListener("scroll", upd); document.addEventListener("focusin", () => setTimeout(upd, 50)); document.addEventListener("focusout", () => setTimeout(upd, 50));
  document.addEventListener("focusin", (e) => { const t = e.target; if (t.matches && t.matches("input,textarea,select") && t.closest("#sheet")) setTimeout(() => { try { t.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (x) {} }, 320); });
})();
$("#scrim").addEventListener("click", () => closeSheet());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

/* ───────────────────────── image helpers ───────────────────────── */
/* resolves the picked files, or [] when the picker is dismissed (callers destructure: const [f] = await pickImage()) */
function pickImage(multi = false) {
  return new Promise((res) => {
    const inp = multi ? $("#filePickMulti") : $("#filePick"); inp.value = "";
    let done = false;
    const end = (files) => { if (done) return; done = true; inp.removeEventListener("change", onChange); inp.removeEventListener("cancel", onCancel); window.removeEventListener("focus", onFocus); res(files); };
    const onChange = () => end([...(inp.files || [])]);
    const onCancel = () => end([]);
    /* browsers without the input "cancel" event: the window gets focus back with no file chosen */
    const onFocus = () => setTimeout(() => { if (!(inp.files && inp.files.length)) end([]); }, 1200);
    inp.addEventListener("change", onChange); inp.addEventListener("cancel", onCancel);
    if (!("oncancel" in inp)) setTimeout(() => window.addEventListener("focus", onFocus, { once: true }), 300);
    inp.click();
  });
}
async function shrink(file, max = 1600, q = 0.85) {
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q)); return { blob, canvas: c };
}
/* upload(blob) → {id, url}. With the Claude runtime: assets capability. Standalone: compressed JPEG kept on the device (IndexedDB). */
async function upload(blob) {
  if (DB.mode === "demo") return { id: "", url: URL.createObjectURL(blob) }; /* demo: nothing is kept, not even photos */
  if (S.cap.assets) { try { const r = await S.cap.assets.upload(blob); return { id: r.id, url: r.url }; } catch (e) { console.warn(e); return { id: "", url: URL.createObjectURL(blob) }; } }
  try { return await PHOTOS.save(blob); } catch (e) { console.warn("photo", e); return { id: "", url: URL.createObjectURL(blob) }; }
}

/* ───────────────────────── standalone: on-device photo store ─────────────────────────
   Photos live in IndexedDB "gg-photos" as compressed JPEG (≤1280px, q .72), ids "loc-…".
   Object URLs die on reload, so: every URL handed out is remembered (url → id, localStorage "gg-photo-map"),
   blobs are re-opened at boot (warm), and any stale blob: URL in rendered HTML is swapped for the live one.
   photoUrl(id) gives a usable URL for an id (or a URL) synchronously; <img data-photo="id"> also resolves. */
const PHOTOS = {
  _db: null, urls: {}, live: {}, missing: {},
  map: (() => { try { return JSON.parse(localStorage.getItem("gg-photo-map") || "{}"); } catch (e) { return {}; } })(),
  isLocal: (id) => typeof id === "string" && id.startsWith("loc-"),
  saveMap: debounce(() => { try { localStorage.setItem("gg-photo-map", JSON.stringify(PHOTOS.map)); } catch (e) {} }, 200),
  open() {
    if (this._db) return this._db;
    this._db = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no indexedDB"));
      const r = indexedDB.open("gg-photos", 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("photos")) r.result.createObjectStore("photos"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("indexedDB blocked"));
    });
    this._db.catch(() => { this._db = null; });
    return this._db;
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction("photos", mode); const r = fn(t.objectStore("photos")); let out;
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted"));
    });
  },
  async compress(blob) {
    if (blob.type && !/^image\//.test(blob.type)) return blob;
    try { const { blob: b } = await shrink(blob, 1280, 0.72); return b || blob; } catch (e) { return blob; }
  },
  toBlob: (rec) => (!rec ? null : rec.blob instanceof Blob ? rec.blob : rec.buf ? new Blob([rec.buf], { type: rec.type || "image/jpeg" }) : null),
  remember(id, url, persist) { this.urls[id] = url; this.live[url] = id; if (persist) { this.map[url] = id; this.saveMap(); } },
  async save(blob) {
    const b = await this.compress(blob);
    const id = "loc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const meta = { type: b.type || "image/jpeg", at: Date.now(), size: b.size };
    try { await this.tx("readwrite", (st) => st.put({ ...meta, blob: b }, id)); }
    catch (e) { await this.tx("readwrite", (st) => st.put({ ...meta, buf: null }, id)).catch(() => {}); const buf = await b.arrayBuffer(); await this.tx("readwrite", (st) => st.put({ ...meta, buf }, id)); } /* old Safari: no Blob in IDB */
    const url = URL.createObjectURL(b); this.remember(id, url, true); delete this.missing[id];
    return { id, url };
  },
  async get(id) { return this.toBlob(await this.tx("readonly", (st) => st.get(id))); },
  /* re-open every stored photo as an object URL (file-backed blobs: cheap) so rendering stays synchronous */
  async warm() {
    if (!window.indexedDB) return;
    try {
      await this.tx("readonly", (st) => { const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return; const id = cur.key; if (!this.urls[id]) { const b = this.toBlob(cur.value); if (b) this.remember(id, URL.createObjectURL(b)); } cur.continue(); }; return null; });
      Object.values(this.map).forEach((id) => { if (!this.urls[id]) this.missing[id] = true; });
    } catch (e) { console.warn("photos warm", e); }
  },
  load(id) {
    if (this.urls[id]) return Promise.resolve(this.urls[id]);
    if (!this.isLocal(id) || this.missing[id]) return Promise.resolve("");
    return this.get(id).then((b) => { if (!b) { this.missing[id] = true; return ""; } const u = URL.createObjectURL(b); this.remember(id, u); return u; }).catch(() => "");
  },
  /* same shape as the assets capability, so a purge screen can use either */
  async list() {
    const out = [];
    await this.tx("readonly", (st) => { const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return; out.push({ id: cur.key, createdAt: new Date(cur.value.at || 0).toISOString(), size: cur.value.size || 0 }); cur.continue(); }; return null; });
    return { assets: out };
  },
  async delete(id) {
    await this.tx("readwrite", (st) => st.delete(id));
    const u = this.urls[id]; if (u) { delete this.live[u]; try { URL.revokeObjectURL(u); } catch (e) {} } delete this.urls[id]; this.missing[id] = true;
    Object.keys(this.map).forEach((k) => { if (this.map[k] === id) delete this.map[k]; }); this.saveMap();
  },
  persist() { try { if (isStandalone() && navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {}); } catch (e) {} },
};
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
/* photoUrl(idOrUrl): a URL that works now. Accepts a stored id, an http(s)/data URL, or a stale blob: URL. "" when unknown. */
function photoUrl(x) {
  if (!x) return ""; x = String(x);
  if (x.startsWith("blob:")) { const id = PHOTOS.map[x] || PHOTOS.live[x]; return id ? photoUrl(id) || "" : x; }
  if (/^(https?:|data:|\.\/|\/)/.test(x)) return x;
  if (PHOTOS.urls[x]) return PHOTOS.urls[x];
  if (PHOTOS.isLocal(x) && !PHOTOS.missing[x]) PHOTOS.load(x).then((u) => { if (u) photoRefresh(); });
  return "";
}
const photoRefresh = debounce(() => { refresh(); photoFixDom(document.body); }, 80);
/* swap stale blob: URLs in an HTML string for live ones (stale + unknown → transparent pixel, never a broken request) */
function photoFix(html) {
  if (typeof html !== "string" || html.indexOf("blob:") < 0) return html;
  return html.replace(/blob:[^"'\s<>)]+/g, (u) => {
    if (PHOTOS.live[u]) return u; const id = PHOTOS.map[u]; if (!id) return u;
    if (PHOTOS.urls[id]) return PHOTOS.urls[id];
    PHOTOS.load(id).then((v) => { if (v) photoRefresh(); }); return PIXEL;
  });
}
/* same for DOM the areas insert themselves, plus <img data-photo="id"> */
function photoFixEl(el) {
  const attr = el.tagName === "A" ? "href" : "src"; const cur = el.getAttribute(attr) || "";
  const id = el.dataset.photo || (cur.startsWith("blob:") ? PHOTOS.map[cur] || PHOTOS.live[cur] : "");
  if (!id) return;
  const set = (u) => { if (u && el.getAttribute(attr) !== u) el.setAttribute(attr, u); };
  if (PHOTOS.urls[id]) set(PHOTOS.urls[id]); else PHOTOS.load(id).then(set);
}
function photoFixDom(root) { if (root && root.querySelectorAll) root.querySelectorAll('img[src^="blob:"],a[href^="blob:"],img[data-photo],a[data-photo]').forEach(photoFixEl); }
try {
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === "attributes") { if (m.target.matches && m.target.matches('img,a')) photoFixEl(m.target); } else m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches('img[src^="blob:"],a[href^="blob:"],[data-photo]')) photoFixEl(n); photoFixDom(n); } }); } })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "href", "data-photo"] });
} catch (e) {}

/* ───────────────────────── standalone: file download fallback (same API as the downloads capability) ───────────────────────── */
const LOCAL_DOWNLOADS = {
  async save({ filename, data, mimeType } = {}) {
    const name = String(filename || "fichier").replace(/[\\/:*?"<>|]+/g, "-");
    const blob = data instanceof Blob ? data : new Blob([data ?? ""], { type: mimeType || "application/octet-stream" });
    /* iPhone home-screen app: <a download> opens a dead-end preview, the share sheet can save, print or AirDrop */
    if (IS_IOS && isStandalone() && navigator.canShare && window.File) {
      try {
        const f = new File([blob], name, { type: blob.type || "application/octet-stream" });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return { ok: true }; }
      } catch (e) { if (e && e.name === "AbortError") { const d = new Error("declined"); d.code = "declined"; throw d; } /* NotAllowed (no gesture left) → link below */ }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
    return { ok: true };
  },
};

/* ───────────────────────── standalone: install (PWA) ───────────────────────── */
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_IPAD = IS_IOS && !/iPhone|iPod/.test(navigator.userAgent);
/* Safari 26+ on iPhone: « Partager » lives in the ••• menu at the bottom right */
const IOS_MENU = IS_IOS && !IS_IPAD && (+((navigator.userAgent.match(/Version\/(\d+)/) || [])[1] || 0) >= 26);
const isStandalone = () => { try { return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true; } catch (e) { return false; } };
document.documentElement.classList.toggle("standalone", isStandalone()); appHeight();
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (S.route === "home") refresh(); });
window.addEventListener("appinstalled", () => { installEvt = null; try { localStorage.setItem("gg-install-off", "1"); } catch (e) {} if (S.route === "home") refresh(); });
const installOff = () => { try { return localStorage.getItem("gg-install-off") === "1"; } catch (e) { return false; } };
function installHint() {
  if (isStandalone() || installOff() || !S.resto) return "";
  const step = (n, html) => `<li><span class="n mono">${n}</span><span>${html}</span></li>`;
  let body;
  if (IS_IOS && IOS_MENU) body = `<ol class="inst-steps">${step(1, `Touchez <span class="key">${ico("dots").replace("<svg ", '<svg style="transform:rotate(90deg)" ')}</span> en bas, puis <b>Partager</b>`)}${step(2, `Choisissez <span class="key">${ico("addsq")}</span> <b>Sur l'écran d'accueil</b>`)}${step(3, `Laissez <b>Ouvrir comme app web</b> activé, puis <b>Ajouter</b>`)}</ol>`;
  else if (IS_IOS) body = `<ol class="inst-steps">${step(1, `Touchez <span class="key">${ico("share")}</span> <b>Partager</b>${IS_IPAD ? " en haut" : ""}`)}${step(2, `Choisissez <span class="key">${ico("addsq")}</span> <b>Sur l'écran d'accueil</b>`)}</ol>`;
  else if (installEvt) body = "";
  else if (IS_ANDROID) body = `<ol class="inst-steps">${step(1, `Touchez <span class="key">${ico("dots")}</span> <b>Menu</b> du navigateur`)}${step(2, `Choisissez <b>Ajouter à l'écran d'accueil</b>`)}</ol>`;
  else return "";
  /* compact: one row (icon, title, one button, ×), the steps unfold on « Comment ? », so the relevé hero stays above the fold */
  const open = !!S.ui.instOpen;
  const cta = installEvt ? `<button class="btn acc sm" data-act="installApp">${ico("download")}Installer</button>` : `<button class="btn soft sm inst-how" data-act="installHow" aria-expanded="${open}" aria-controls="instMore">${open ? "Masquer" : "Comment ?"}</button>`;
  return `<div class="glass inst st${open ? " open" : ""}" style="--i:1" id="instCard">
    <div class="inst-hd">${appIcon(38)}<div class="inst-t"><b>Installez Gusto</b><span>Plein écran, même sans réseau</span></div>${cta}<button class="inst-x" data-act="installDismiss" aria-label="Ne plus afficher">${ico("x")}</button></div>
    ${body ? `<div class="inst-more" id="instMore"><div>${body}${IS_IOS && !IS_IPAD ? `<div class="inst-arrow${IOS_MENU ? " end" : ""}" aria-hidden="true">${ico("down")}</div>` : ""}</div></div>` : ""}</div>`;
}

/* ───────────────────────── standalone: service worker (offline) ───────────────────────── */
function registerSW() {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (!(location.protocol === "https:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))) return;
    const reg = () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((r) => {
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") r.update().catch(() => {}); });
    }).catch((e) => console.warn("sw", e && e.message));
    if (document.readyState === "complete") reg(); else window.addEventListener("load", reg, { once: true });
  } catch (e) {}
  freshness();
}
/* ───────────────────────── auto-update (version.json) ─────────────────────────
   version.json {"v": "<build id>"} is bumped on every push. It is fetched (no-store) at launch and each time the app comes back
   to the foreground. A new v means the code running here is old: with nothing in progress the app reloads silently (caches dropped,
   so the reload is guaranteed fresh); otherwise a toast offers « Mettre à jour ». sessionStorage guards against reload loops:
   one reload attempt per version per session, after which the version is simply adopted. */
const APP_V = "2026-11-07.21";
/* logos of the tools Growth Gusto connects to (img/logos/<id>.svg|png): caisses, réservations, comptabilité, banque, paiement */
const BRAND_LOGOS = { sumup: "svg", zelty: "png", lightspeed: "svg", tiller: "svg", square: "svg", innovorder: "svg", popina: "png", zenchef: "svg", thefork: "png", sevenrooms: "png", guestonline: "png", resy: "svg", opentable: "svg", formitable: "svg", google: "svg", pennylane: "svg", qonto: "svg", quickbooks: "svg", sage: "svg", odoo: "svg", stripe: "svg", zebra: "svg" };
const brandLogo = (id) => BRAND_LOGOS[id] ? `<img class="brand-logo" src="img/logos/${id}.${BRAND_LOGOS[id]}" alt="" loading="lazy" decoding="async" draggable="false">` : "";
const UPD = {
  running: null, offered: null,
  get: (k, store) => { try { return store.getItem(k); } catch (e) { return null; } },
  set: (k, v, store) => { try { store.setItem(k, v); } catch (e) {} },
  async fetchV() { try { const r = await fetch("version.json?ts=" + Date.now(), { cache: "no-store" }); if (!r.ok) return null; const j = await r.json(); return j && j.v ? String(j.v) : null; } catch (e) { return null; } },
  quiet() {
    const a = document.activeElement;
    return !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) && !$("#sheet").classList.contains("open") && ["home", "onboarding", "more", "cuisine"].includes(S.route) && !(S.rec && (S.rec.lines || []).length && !S.rec.done);
  },
  async check() {
    const v = await this.fetchV(); if (!v) return;
    if (!this.running) {
      /* launch: the code is current if it says so (APP_V) or if this device already updated to v */
      /* only the code itself (APP_V) says it is current: a stored "gg-v" could belong to a stale cached copy */
      if (v === APP_V) { this.running = v; this.set("gg-v", v, localStorage); return; }
      this.running = APP_V;
    }
    if (v === this.running) return;
    if (this.get("gg-upd", sessionStorage) === v) { this.running = v; this.set("gg-v", v, localStorage); return; } /* already reloaded once for v: adopt it, never loop */
    if (this.quiet()) return this.apply(v);
    /* busy right now: offer the update, and apply it by itself at the next calm moment (back on Accueil, menu Plus, no sheet open) */
    if (!this.wait) this.wait = setInterval(() => { if (this.quiet() && document.visibilityState === "visible") { clearInterval(this.wait); this.apply(v); } }, 3000);
    if (this.offered === v) return; this.offered = v;
    toast("Nouvelle version disponible", "info"); const t = $("#toast");
    $("#toastTx").innerHTML = `<span class="tx">Nouvelle version disponible</span><button data-act="appUpdate" data-v="${esc(v)}">Mettre à jour</button>`; toastPlace(t);
    t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 12000);
  },
  async apply(v) {
    this.set("gg-upd", v, sessionStorage); this.set("gg-v", v, localStorage);
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.filter((k) => k.startsWith("gg-")).map((k) => caches.delete(k))); } } catch (e) {}
    try { const r = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()); if (r) await Promise.race([r.update(), new Promise((ok) => setTimeout(ok, 1500))]); } catch (e) {}
    location.reload();
  },
};
function freshness() {
  if (location.protocol === "file:") return;
  UPD.check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") UPD.check(); });
  /* an app left open all service (kitchen tablet, phone in a pocket) still picks up a deploy within 5 minutes */
  setInterval(() => { if (document.visibilityState === "visible") UPD.check(); }, 5 * 60000);
  window.addEventListener("online", () => UPD.check());
}

function toastUndo(msg) { toast(msg); const t = $("#toast"); $("#toastTx").innerHTML = `<span class="tx">${esc(msg)}</span><button data-act="undo">Annuler</button>`; toastPlace(t); t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; S.ui.undo = null; }, 4000); }
/* ───────────────────────── toast + burst ───────────────────────── */
const TOAST_CHECK = `<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>`;
const TOAST_ICONS = { info: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>`, err: `<svg viewBox="0 0 24 24"><path d="M12 6.5v7"/><path d="M12 17.5h.01"/></svg>` };
/* Phone: toasts live at the bottom, just above the tab bar, the sticky CTA or an open sheet (thumb reach for « Annuler »).
   They switch to the top of the screen when there is no room above a tall sheet, or when the bottom spot would cover what the person is
   working on: any element marked [data-toast-avoid] / .toast-avoid in the current screen or sheet (toastAvoid(el) marks one).
   uiBottomInset() tells an area how many pixels at the bottom are covered by the tab bar, sticky CTA and a bottom toast, so it can scroll
   the next card fully above them. */
const PHONE_MQ = window.matchMedia("(max-width:959px)");
const safeTop = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat")); return isNaN(v) ? 0 : v; };
function bottomEdge() {
  const H = document.body.clientHeight || APPH.px || window.innerHeight; let edge = H; /* the app box, not Safari's moving viewport */
  const tb = $("#tabbar"); if (tb && !tb.classList.contains("hide") && !document.documentElement.classList.contains("kb")) edge = Math.min(edge, tb.getBoundingClientRect().top);
  const v = $("#viewport .view:not(.leave)"); if (v) $$(".ctabar", v).forEach((c) => { const r = c.getBoundingClientRect(); if (r.height && r.top < H && r.bottom > 0) edge = Math.min(edge, r.top); });
  return { H, edge };
}
function uiBottomInset(withToast = true) {
  if (!PHONE_MQ.matches) return 0;
  const { H, edge } = bottomEdge(); const th = Math.max(46, $("#toast").offsetHeight || 0);
  return Math.round(H - edge + (withToast ? th + 20 : 0));
}
function toastAvoid(el) {
  $$("[data-toast-avoid]").forEach((e) => { if (e !== el) e.removeAttribute("data-toast-avoid"); });
  if (el) el.setAttribute("data-toast-avoid", "");
  const t = $("#toast"); if (t.classList.contains("on")) toastPlace(t);
}
function toastPlace(t) {
  t.classList.remove("top");
  if (!PHONE_MQ.matches) { t.style.removeProperty("--toastB"); return; }
  let { H, edge } = bottomEdge();
  const sh = $("#sheet"), sheetOn = sh.classList.contains("open"); if (sheetOn) edge = Math.min(edge, sh.getBoundingClientRect().top);
  const th = Math.max(46, t.offsetHeight || 0), topY = safeTop() + 10;
  const bottomBox = [edge - 10 - th, edge - 10], topBox = [topY, topY + th];
  const scope = sheetOn ? sh : $("#viewport .view:not(.leave)");
  const avoid = scope ? $$("[data-toast-avoid],.toast-avoid", scope).map((e) => e.getBoundingClientRect()).filter((r) => r.height && r.bottom > 0 && r.top < H) : [];
  const hit = (b) => avoid.reduce((n, r) => n + Math.max(0, Math.min(b[1], r.bottom) - Math.max(b[0], r.top)), 0);
  const noRoom = bottomBox[0] < topY + 4;
  if (noRoom || (hit(bottomBox) > 0 && hit(topBox) < hit(bottomBox))) { t.classList.add("top"); t.style.removeProperty("--toastB"); return; }
  if (edge < H) t.style.setProperty("--toastB", Math.round(H - edge + 10) + "px"); else t.style.removeProperty("--toastB");
}
function toast(msg, kind) { const t = $("#toast"); t.style.pointerEvents = ""; t.classList.toggle("info", kind === "info"); $(".check", t).innerHTML = TOAST_ICONS[kind] || TOAST_CHECK; $("#toastTx").textContent = msg; toastPlace(t); t.classList.toggle("err", kind === "err"); const c = $(".check", t); c.classList.remove("draw"); void c.offsetWidth; c.classList.add("draw"); t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), kind === "err" ? 3800 : 2300); }
function burst(x = window.innerWidth / 2, y = window.innerHeight / 3) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const b = document.createElement("div"); b.className = "burst"; const cols = ["#5B2BFF", "#F6B93B", "#EF5A3C", "#9EF5C4", "#9EC5FF", "#4C1FEA"];
  for (let i = 0; i < 34; i++) { const s = document.createElement("i"); const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170; s.style.left = x + "px"; s.style.top = y + "px"; s.style.background = cols[i % cols.length]; s.style.setProperty("--x", Math.cos(a) * d + "px"); s.style.setProperty("--y", Math.sin(a) * d + 60 + "px"); s.style.setProperty("--r", Math.random() * 540 + "deg"); s.style.animationDelay = Math.random() * 80 + "ms"; if (i % 3 === 0) s.style.borderRadius = "50%"; b.appendChild(s); }
  document.body.appendChild(b); setTimeout(() => b.remove(), 1500);
}

/* ───────────────────────── binding ───────────────────────── */
function setPath(path, value) { const ks = path.split("."); let o = S; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = value; }
document.addEventListener("input", (e) => {
  const el = e.target; if (el.dataset.bind) { setPath(el.dataset.bind, el.value); if (/rec\.lines\.\d+\.temp/.test(el.dataset.bind)) { const i = +el.dataset.bind.split(".")[2]; const L = S.rec.lines[i]; const t = num(L.temp); el.style.color = t == null ? "" : t <= L.tmax ? "var(--ok)" : "var(--bad)"; } }
  if (el.dataset.cnt) saveCount(el.dataset.cnt, el.value);
});
document.addEventListener("change", (e) => { const el = e.target; if (el.tagName === "SELECT" && el.dataset.bind) setPath(el.dataset.bind, el.value); if (el.dataset.rer) { setPath(el.dataset.bind, el.value); el.blur(); setTimeout(rerender, 30); } });
const rerender = () => { if (scrollBusy()) { SCRL.pendR = true; scrollSettle(); return; } SCRL.pendR = false; const v = $("#viewport .view:not(.leave)"); if (!v) return; const st = v.scrollTop; v.classList.add("nost"); v.innerHTML = renderRoute(); v.scrollTop = st; afterRender(v); };

/* ───────────────────────── actions ───────────────────────── */
document.addEventListener("submit", (e) => { const f = e.target; if (f.dataset.form === "code") { e.preventDefault(); lookupCode($("#codeIn").value); } });
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button][data-go],[role=button][data-act]")) { e.preventDefault(); e.target.click(); } });
document.addEventListener("click", async (e) => {
  SFX.init();
  const tab = e.target.closest("[data-tab]");
  if (tab) { const r = tab.dataset.tab; SFX.tap(); buzz(5); if (r !== S.route) { S.history = []; go(r, {}, { replace: true, tab: true }); } else { const v = $("#viewport .view"); v && v.scrollTo({ top: 0, behavior: "smooth" }); } return; }
  const g = e.target.closest("[data-go]");
  if (g && !e.target.closest("[data-act]")) {
    SFX.tap(); const p = g.dataset.id ? { id: g.dataset.id } : {}; if (g.dataset.fresh) p.fresh = true;
    /* the side nav switches sections like the phone tab bar: a fresh history, so the section opens without a « Retour » */
    if (g.closest("#side")) { if (g.dataset.go === S.route && JSON.stringify(p) === JSON.stringify(S.params || {})) { const v = $("#viewport .view"); v && v.scrollTo({ top: 0, behavior: "smooth" }); return; } S.history = []; go(g.dataset.go, p, { replace: true, tab: true }); return; }
    go(g.dataset.go, p); return;
  }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act, id = a.dataset.id, v = a.dataset.v;
  const H = ACT[act]; if (H) { try { await H(a, id, v, e); } catch (err) { console.warn(err); } }
});
const ACT = {
  back: () => { SFX.tap(); goBack(); },
  sheetClose: () => closeSheet(),
  /* « Aller au contenu » (first Tab stop): focus lands on the current screen's first control */
  skipMain: () => { const v = $("#viewport .view:not(.leave)"); if (!v) return; const f = $$(FOCUSABLE, v).find((e) => e.getClientRects().length && !e.closest("[hidden]")); if (f) f.focus(); else { v.tabIndex = -1; v.focus(); } },
  undo: async () => {
    const u = S.ui.undo; if (!u) return; S.ui.undo = null;
    /* the audit-trail line that went with it: given explicitly (u.evId), or, for a chore log, the "chore" event with the same chore ref, author and time (±5 s) */
    let evId = u.evId || null;
    if (!evId && u.col === "choreLogs") { const log = S.choreLogs.find((l) => l.id === u.id); if (log) { const ev = S.events.filter((e) => e.type === "chore" && e.ref === log.choreId && e.uid === log.uid && Math.abs((e.at || 0) - (log.at || 0)) < 5000).sort((a, b) => Math.abs(a.at - log.at) - Math.abs(b.at - log.at))[0]; if (ev) evId = ev.id; } }
    await DB.del(u.col, u.id).catch(() => {}); if (evId) await DB.del("events", evId).catch(() => {});
    $("#toast").classList.remove("on"); SFX.close();
  },

  sound: () => { SFX.on = !SFX.on; try { localStorage.setItem("gg-sound", SFX.on ? "on" : "off"); } catch (e) {} if (SFX.on) SFX.ok(); rerender(); },

};

async function saveCsv(name, rows) {
  const csv = "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\n");
  if (!S.cap.downloads) { toast("Export indisponible dans cette vue.", "err"); return; }
  try { await S.cap.downloads.save({ filename: name, data: new Blob([csv], { type: "text/csv" }) }); SFX.ok(); toast("Fichier téléchargé"); } catch (e) { if (e && e.code !== "declined") toast("Export impossible.", "err"); }
}

/* install card + update toast actions */
Object.assign(ACT, {
  unitNew: (a) => {
    const wrap = a.parentElement; if (!wrap || $(".unit-new", wrap)) { const i = wrap && $(".unit-new input", wrap); i && i.focus(); return; }
    const box = document.createElement("span"); box.className = "unit-new";
    box.innerHTML = `<input class="input" maxlength="16" placeholder="Ex. barquette" aria-label="Nouvelle unité" autocomplete="off" enterkeyhint="done"><button class="btn acc sm" type="button">OK</button>`;
    a.after(box); a.hidden = true; const inp = $("input", box); setTimeout(() => inp.focus(), 30); SFX.tick();
    const done = () => {
      const u = unitSave(inp.value); box.remove(); a.hidden = false; if (!u) return;
      let chip = [...wrap.querySelectorAll(".chip")].find((c) => c !== a && (c.dataset.v || "").toLowerCase() === u.toLowerCase());
      if (!chip) { const tpl = [...wrap.querySelectorAll(".chip")].find((c) => c !== a && c.dataset.act); if (!tpl) return; chip = tpl.cloneNode(false); chip.classList.remove("on"); chip.dataset.v = u; chip.textContent = u; a.before(chip); chip.classList.add("pop"); }
      chip.click(); toast(`Unité « ${u} » ajoutée`);
    };
    $("button", box).addEventListener("click", (e) => { e.stopPropagation(); done(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(); } else if (e.key === "Escape") { e.stopPropagation(); box.remove(); a.hidden = false; } });
  },
  appUpdate: (a) => { SFX.tap(); $("#toast").classList.remove("on"); UPD.apply(a.dataset.v); },
  installApp: async () => {
    if (!installEvt) return; SFX.tap(); const ev = installEvt;
    try { ev.prompt(); const r = await ev.userChoice; if (r && r.outcome === "accepted") { installEvt = null; SFX.done(); toast("Gusto est installée"); try { localStorage.setItem("gg-install-off", "1"); } catch (e) {} } } catch (e) {}
    refresh();
  },
  installHow: (a) => {
    if (typeof ACT.auInstall === "function") return ACT.auInstall(a); /* the illustrated, device-specific guide (auth.js) */
    SFX.tap(); buzz(4); S.ui.instOpen = !S.ui.instOpen; const c = $("#instCard"); if (!c) return refresh();
    c.classList.toggle("open", S.ui.instOpen); a.textContent = S.ui.instOpen ? "Masquer" : "Comment ?"; a.setAttribute("aria-expanded", String(S.ui.instOpen));
  },
  installDismiss: () => {
    try { localStorage.setItem("gg-install-off", "1"); } catch (e) {} SFX.close(); buzz(4);
    const c = $("#instCard"); if (!c) return refresh();
    c.style.height = c.offsetHeight + "px"; void c.offsetWidth; c.classList.add("bye"); setTimeout(() => { c.remove(); }, 420);
  },
});

/* ───────────────────────── diagnostics (?debug=1) ─────────────────────────
   A small live readout for a screen recording on a real phone: viewport sizes, what scrolls, where the tab bar is, and how many
   re-renders and navigations happened. Turn on with ?debug=1, off with ?debug=0 (remembered on this device). */
(function ggDebug() {
  let on = false; try { const q = new URLSearchParams(location.search).get("debug"); if (q === "1") localStorage.setItem("gg-debug", "1"); if (q === "0") localStorage.removeItem("gg-debug"); on = localStorage.getItem("gg-debug") === "1"; } catch (e) {}
  if (!on) return;
  const C = { r: 0, g: 0, rs: 0, vv: 0, ws: 0 }; window.GGDBG = C;
  const wrap = (n) => { const f = window[n]; if (typeof f !== "function") return; window[n] = function (...a) { C[n === "refresh" ? "r" : "g"]++; return f.apply(this, a); }; };
  setTimeout(() => { wrap("refresh"); wrap("go"); }, 0);
  addEventListener("resize", () => C.rs++); window.visualViewport && visualViewport.addEventListener("resize", () => C.vv++);
  addEventListener("scroll", () => C.ws++, { passive: true });
  const el = document.createElement("div"); el.className = "ggdbg"; document.body.appendChild(el);
  const r = (x) => Math.round(x);
  const tick = () => {
    const vv = window.visualViewport || {}, tb = $("#tabbar"), v = $("#viewport .view:not(.leave)"), b = document.body.getBoundingClientRect(), t = tb ? tb.getBoundingClientRect() : { top: 0 };
    el.textContent = `v ${APP_V} ${document.documentElement.classList.contains("standalone") ? "app" : "safari"}
ih ${innerHeight} vv ${r(vv.height || 0)}/${r(vv.offsetTop || 0)} sy ${r(scrollY)}
body ${r(b.top)}/${r(b.height)} tab ${r(t.top)} view ${v ? r(v.scrollTop) : "-"}
refresh ${C.r} go ${C.g} rs ${C.rs} vvrs ${C.vv} wscroll ${C.ws}
${S.route} ${[...document.documentElement.classList].filter((c) => /kb|tabs|au-/.test(c)).join(" ")}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
