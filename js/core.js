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
const PALETTE = ["#4A1FE6", "#0B9B6A", "#E0752F", "#D63A7A", "#1F7AE0", "#8A4DFF", "#0E8C9E", "#B85C00"];
const colorFor = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ───────────────────────── icons (hand-drawn set, 24 grid, 1.8 stroke) ───────────────────────── */
const IC = {
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
  sparkle: ["M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"],
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

/* ───────────────────────── logo (redrawn: geometric G + growth arrow on one 8-unit grid) ───────────────────────── */
let gidN = 0;
function logoMark({ mono = null, grad = false } = {}) {
  const id = "lg" + gidN++;
  const paint = mono || (grad ? `url(#${id})` : "#4A1FE6");
  return `<svg viewBox="0 0 100 100" class="mk" aria-hidden="true"><defs><linearGradient id="${id}" x1="12" y1="10" x2="88" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8F63FF"/><stop offset="1" stop-color="#3B16D9"/></linearGradient></defs>
  <path d="M86 16H50A34 34 0 0 0 25.96 74.04" fill="none" stroke="${paint}" stroke-width="14"/>
  <path d="M40.5 83.5 80 44M52 42h30v30" fill="none" stroke="${paint}" stroke-width="12.5" stroke-linejoin="miter" stroke-miterlimit="4"/></svg>`;
}
function appIcon(size = 40) {
  return `<span style="width:${size}px;height:${size}px;border-radius:${size * 0.28}px;display:grid;place-items:center;background:linear-gradient(150deg,#8F63FF,#4A1FE6 55%,#2F1BC4);box-shadow:0 8px 18px -8px rgba(74,31,230,.8),inset 0 1px 0 rgba(255,255,255,.35);flex:none"><span style="width:${size * 0.62}px;height:${size * 0.62}px;display:block">${logoMark({ mono: "#fff" })}</span></span>`;
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
  tap() { this.tone(2400, 0.025, "triangle", 0.018); },
  tick() { this.tone(3200, 0.012, "square", 0.01); },
  ok() { this.tone(784, 0.11, "sine", 0.06); this.tone(1175, 0.18, "sine", 0.05, 0.075); },
  done() { [659, 880, 1109, 1319].forEach((f, i) => this.tone(f, 0.22, "sine", 0.045, i * 0.07)); this.tone(2637, 0.5, "sine", 0.012, 0.3); },
  scan() { this.tone(1900, 0.06, "square", 0.028); this.tone(2850, 0.08, "square", 0.022, 0.065); },
  err() { this.tone(330, 0.12, "triangle", 0.06, 0, 240); this.tone(240, 0.16, "triangle", 0.05, 0.11, 180); },
  sheet() { this.noise(0.22, 0.022, 600, 2600); },
  close() { this.noise(0.18, 0.016, 2400, 500); },
  print() { for (let i = 0; i < 9; i++) this.tone(140 + (i % 2) * 30, 0.09, "sawtooth", 0.012, i * 0.16); this.noise(1.4, 0.008, 3000, 1800); this.tone(1568, 0.12, "sine", 0.04, 1.55); },
};
const buzz = (p = 8) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ───────────────────────── data layer (shared db, or local demo) ───────────────────────── */
const DB = {
  mode: "local", db: null, subs: [],
  local: (() => { try { return JSON.parse(localStorage.getItem("gg-local") || "{}"); } catch (e) { return {}; } })(),
  listeners: {},
  saveLocal: debounce(() => { try { localStorage.setItem("gg-local", JSON.stringify(DB.local)); } catch (e) {} }, 300),
  emit(path) { const all = Object.entries(this.local[path] || {}).map(([id, d]) => ({ id, ...d })); (this.listeners[path] || []).forEach((l) => { const o = l.opts || {}; let rows = all.slice(); if (o.order) { const k = o.order, m = o.dir === "desc" ? -1 : 1; rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * m); } if (o.limit) rows = rows.slice(0, o.limit); l(rows); }); this.saveLocal(); },
  path(col) { return col === "restos" ? "restos" : `restos/${S.rid}/${col}`; },
  watch(col, opts, cb) {
    const path = this.path(col);
    if (this.mode === "db") {
      let q = this.db.collection(path); if (opts.order) q = q.orderBy(opts.order, opts.dir || "asc"); if (opts.limit) q = q.limit(opts.limit);
      const timer = setTimeout(() => { S.slow = true; refresh(); }, 10000);
      const un = q.onSnapshot((snap) => { if (!snap.metadata.fromCache) { clearTimeout(timer); S.slow = false; } cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); }, (e) => { clearTimeout(timer); console.warn("db", col, e); S.dbErr = e.code; refresh(); });
      this.subs.push(un); return;
    }
    cb.opts = opts || {}; (this.listeners[path] ||= []).push(cb); setTimeout(() => this.emit(path), 0);
  },
  unsubAll() { this.subs.forEach((u) => { try { u(); } catch (e) {} }); this.subs = []; this.listeners = {}; },
  async add(col, data) { const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)); await this.set(col, id, data); return id; },
  async set(col, id, data) {
    const path = this.path(col);
    if (this.mode === "db") return this.db.collection(path).doc(id).set(data);
    (this.local[path] ||= {})[id] = JSON.parse(JSON.stringify(data)); this.emit(path);
  },
  async update(col, id, patch) {
    const path = this.path(col);
    if (this.mode === "db") return this.db.collection(path).doc(id).update(patch);
    const cur = (this.local[path] ||= {})[id] || {}; this.local[path][id] = { ...cur, ...JSON.parse(JSON.stringify(patch)) }; this.emit(path);
  },
  async del(col, id) {
    const path = this.path(col);
    if (this.mode === "db") return this.db.collection(path).doc(id).delete();
    if (this.local[path]) delete this.local[path][id]; this.emit(path);
  },
};
async function safe(p, msg = "Impossible d'enregistrer. Vérifiez la connexion et réessayez.") {
  try { return await p; } catch (e) {
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
  profiles: {}, route: "home", params: {}, history: [], slot: slotNow(), open: null, temp: {}, ui: {},
  rec: null, tz: null, zone: null, stockTab: "inv", noteCat: "Toutes", noteQ: "", regFilter: "all", slow: false, dbErr: null,
};
try { S.me.name = localStorage.getItem("gg-name") || ""; S.rid = localStorage.getItem("gg-rid"); SFX.on = localStorage.getItem("gg-sound") !== "off"; } catch (e) {}

const ROLES = { gerant: "Gérant", chef: "Chef", equipe: "Équipe" };
const ZONES = ["Réserve sèche", "Chambre froide 1", "Chambre froide 2", "Bar", "Congélateur"];
const UNITS = ["kg", "g", "L", "pièce", "bourriche", "colis", "botte"];
const ACTIONS = ["Produits déplacés dans un autre frigo", "Thermostat réglé", "Porte mal fermée, refermée", "Technicien appelé", "Produits jetés"];
const nameOf = (uid) => (uid === S.me.id ? (S.me.name || "Vous") : (S.profiles[uid]?.name || S.members.find((m) => m.id === uid)?.name || "Quelqu'un"));
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
  $("#bootMark").innerHTML = logoMark({ grad: true });
  const C = window.claude;
  const use = async (n) => { try { return C && C.use ? await C.use(n) : null; } catch (e) { return null; } };
  const [db, user, sample, assets, downloads] = await Promise.all([use("db"), use("user"), use("sample"), use("assets"), use("downloads")]);
  S.cap = { db, user, sample, assets, downloads };
  if (user) {
    try { const me = await user.me(); const id = await user.id(); S.me = { id: id || me.id || "anon", name: me.name || "", avatarUrl: me.avatarUrl, color: me.color }; S.isOwner = !!me.isOwner; S.profiles[S.me.id] = { ...S.me }; } catch (e) {}
  }
  if (db && S.me.id && S.me.id !== "local") { DB.mode = "db"; DB.db = db; } else { S.isOwner = true; }
  DB.watch("restos", {}, (rows) => {
    S.restos = rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!S.rid || !S.restos.find((r) => r.id === S.rid)) { S.rid = S.restos[0]?.id || null; if (S.rid) attachResto(); }
    S.resto = S.restos.find((r) => r.id === S.rid) || null;
    if (!S.ready) { S.ready = true; finishBoot(); } else refresh();
  });
  if (S.rid) attachResto();
  setTimeout(() => { if (!S.ready) { S.ready = true; finishBoot(); } }, 10000);
}
function finishBoot() {
  renderChrome();
  go(S.resto ? "home" : "onboarding", {}, { replace: true });
  setTimeout(() => $("#boot").classList.add("out"), 250);
}
let attachedRid = null;
function attachResto() {
  if (!S.rid || attachedRid === S.rid) return; attachedRid = S.rid;
  try { localStorage.setItem("gg-rid", S.rid); } catch (e) {}
  const keep = DB.subs.length ? DB.subs.shift() : null; DB.subs.forEach((u) => { try { u(); } catch (e) {} }); DB.subs = keep ? [keep] : [];
  if (DB.mode === "local") { Object.keys(DB.listeners).forEach((k) => { if (k !== "restos") delete DB.listeners[k]; }); }
  const w = (col, opts, key, after) => DB.watch(col, opts, (rows) => { S[key] = rows; after && after(); onData(); });
  w("fridges", {}, "fridges", () => S.fridges.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0)));
  w("readings", { order: "at", dir: "desc", limit: 600 }, "readings");
  w("lots", { order: "createdAt", dir: "desc", limit: 600 }, "lots");
  w("products", {}, "products", () => S.products.sort((a, b) => a.name.localeCompare(b.name, "fr")));
  w("counts", {}, "counts");
  w("receptions", { order: "at", dir: "desc", limit: 120 }, "receptions");
  w("events", { order: "at", dir: "desc", limit: 250 }, "events");
  w("notes", {}, "notes");
  w("chores", {}, "chores");
  w("choreLogs", { order: "at", dir: "desc", limit: 400 }, "choreLogs");
  w("tickets", { order: "at", dir: "desc", limit: 60 }, "tickets");
  w("members", {}, "members", ensureMember);
}
let memberChecked = false;
function ensureMember() {
  const mine = S.members.find((m) => m.id === S.me.id); if (mine && mine.name && !S.me.name) { S.me.name = mine.name; }
  if (memberChecked || DB.mode !== "db") return; memberChecked = true;
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
  ["home", "home", "Aujourd'hui"], ["releve", "therm", "Relevés"], ["frigos", "snow", "Frigos"], ["scan", "scan", "Scanner"], ["reception", "truck", "Réception"],
  ["sep", "", "Gestion"], ["stock", "box", "Stock & inventaire"], ["tickets", "receipt", "Tickets de caisse"], ["registre", "shield", "Registre HACCP"],
  ["sep", "", "Cuisine"], ["notes", "book", "Recettes & procédures"], ["menage", "spray", "Planning ménage"],
  ["sep", "", "Restaurant"], ["equipe", "users", "Équipe"], ["imprimante", "printer", "Imprimante"], ["reglages", "sliders", "Réglages"],
];
const TABS = [["home", "home", "Accueil"], ["frigos", "snow", "Frigos"], ["scan", "scan", ""], ["stock", "box", "Stock"], ["more", "grid", "Plus"]];
const TAB_OF = { home: "home", frigos: "frigos", frigo: "frigos", releve: "home", scan: "scan", stock: "stock", reception: "more", tickets: "more", registre: "more", notes: "more", note: "more", menage: "more", equipe: "more", imprimante: "more", reglages: "more", more: "more" };
function urgentCount() { return activeLots().filter((l) => (daysUntil(dlcOf(l)) ?? 99) <= 1).length; }
function renderChrome() {
  const side = $("#side");
  const navOn = TAB_OF[S.route] === "frigos" ? "frigos" : S.route === "note" ? "notes" : S.route;
  const pend = S.fridges.length * 2 - todayStats().done;
  side.innerHTML = `<div class="brand"><span style="width:30px;height:30px;display:block">${logoMark()}</span>Growth Gusto</div>
    ${S.resto ? `<button class="nav" data-act="restoSwitch" style="background:var(--glass-2);margin-bottom:10px"><span style="width:28px;height:28px;flex:none;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,#7A4DFF,#4A1FE6);color:#fff;font-size:11px;font-weight:800">${esc(initials(S.resto.name))}</span><span style="flex:1;min-width:0;text-align:left"><b style="display:block;color:var(--ink);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.resto.name)}</b><span style="font-size:11.5px">${S.restos.length} établissement${S.restos.length > 1 ? "s" : ""}</span></span>${ico("down")}</button>` : ""}
    ${NAV.map(([r, i, t]) => r === "sep" ? `<div class="sep">${t}</div>` : `<button class="nav ${navOn === r ? "on" : ""}" data-go="${r}">${ico(i)}${t}${r === "home" && urgentCount() ? `<span class="count">${urgentCount()}</span>` : ""}${r === "releve" && pend > 0 && S.fridges.length ? `<span class="count" style="background:var(--warn)">${pend}</span>` : ""}</button>`).join("")}
    <div class="me" style="margin-top:16px">${avatar(S.me.id)}<div style="min-width:0"><b>${esc(S.me.name || "Vous")}</b><em>${ROLES[myRole()]}${DB.mode === "local" ? " · mode démo" : ""}</em></div></div>`;
  const tb = $("#tabbar"); const on = TAB_OF[S.route] || "more";
  if (!tb.dataset.built) {
    tb.dataset.built = 1;
    tb.innerHTML = `<span class="ind" id="ind"></span>` + TABS.map(([r, i, t]) => `<button class="tab" data-tab="${r}" aria-label="${t || "Scanner"}">${r === "scan" ? `<span class="fab">${ico("scan")}</span>` : `${ico(i)}${t}`}</button>`).join("");
  }
  $$(".tab", tb).forEach((b) => b.classList.toggle("on", b.dataset.tab === on));
  const idx = TABS.findIndex((t) => t[0] === on); const ind = $("#ind");
  if (ind) { ind.style.opacity = on === "scan" ? 0 : 1; ind.style.transform = `translateX(calc(${idx} * (100% + 12px)))`; }
  tb.classList.toggle("hide", ["onboarding", "reception", "note"].includes(S.route) || !S.resto);
  const sd = $("#side"); if (sd) sd.classList.toggle("off", !S.resto || S.route === "onboarding");
}

/* ───────────────────────── router ───────────────────────── */
let navLock = false;
function go(route, params = {}, { back = false, replace = false } = {}) {
  if (navLock) return;
  if (!replace && !back) S.history.push({ route: S.route, params: S.params });
  if (route === "reception" && (!S.rec || params.fresh || S.rec.done)) S.rec = { step: 1, supplier: "", bl: "", lines: [], done: null, open: 0 };
  if (route === "stock") { S.zone = S.zone || null; }
  S.route = route; S.params = params; closeSheet(true);
  const vp = $("#viewport"); const old = $(".view", vp);
  const v = document.createElement("section"); v.className = "view enter" + (back ? " back" : ""); v.dataset.route = route;
  v.innerHTML = renderRoute(); vp.appendChild(v);
  void v.offsetWidth; v.classList.remove("enter", "back");
  if (old) { old.classList.add("leave"); if (back) old.classList.add("back"); navLock = true; setTimeout(() => { old.remove(); navLock = false; }, 380); }
  afterRender(v); renderChrome();
}
function goBack() { if (navLock) return; const h = S.history.pop(); if (h) go(h.route, h.params, { back: true }); else go("home", {}, { back: true }); }
let pendingRefresh = false;
function refresh() {
  if (!S.ready) return;
  const v = $("#viewport .view:not(.leave)"); if (!v) return;
  const VIEW = VIEWS[S.route]; if (VIEW && VIEW.live === false) return;
  const a = document.activeElement; if (a && v.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { pendingRefresh = true; return; }
  const st = v.scrollTop; v.classList.add("nost"); v.innerHTML = renderRoute(); v.scrollTop = st; afterRender(v);
}
document.addEventListener("focusout", () => { if (pendingRefresh) { pendingRefresh = false; setTimeout(refresh, 50); } });
function renderRoute() {
  const V = VIEWS[S.route] || VIEWS.home;
  if (S.route !== "onboarding" && !S.resto) return VIEWS.onboarding.render();
  return V.render(S.params);
}
function afterRender(v) { const V = VIEWS[S.route]; V && V.after && V.after(v); }
const topBar = (title, opts = {}) => `<div class="top st" style="--i:0">${opts.noBack ? "" : `<button class="iconbtn" data-act="back" aria-label="Retour">${ico("back")}</button>`}<span class="h2">${title}</span>${opts.right || ""}</div>`;
const banner = () => (DB.mode === "local" ? `<div class="banner st" style="--i:0">${ico("alert")}<span>Mode démo : les données restent sur cet appareil. Connectez-vous à claude.ai pour les partager avec l'équipe.</span></div>` : S.slow ? `<div class="banner st">${ico("clock")}<span>Connexion lente : les données affichées peuvent ne pas être à jour.</span></div>` : "");

/* ───────────────────────── views ───────────────────────── */
const VIEWS = {};

/* ───────────────────────── sheets ───────────────────────── */
function openSheet(html, after) { $("#sheetBody").innerHTML = html; $("#scrim").classList.add("on"); $("#sheet").classList.add("open"); SFX.sheet(); after && after($("#sheetBody")); }
function closeSheet(silent) { if (!$("#sheet").classList.contains("open")) return; $("#scrim").classList.remove("on"); $("#sheet").classList.remove("open"); if (!silent) SFX.close(); }
$("#scrim").addEventListener("click", () => closeSheet());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

/* ───────────────────────── image helpers ───────────────────────── */
function pickImage(multi = false) {
  return new Promise((res) => {
    const inp = multi ? $("#filePickMulti") : $("#filePick"); inp.value = "";
    const on = () => { inp.removeEventListener("change", on); res([...(inp.files || [])]); };
    inp.addEventListener("change", on); inp.click();
  });
}
async function shrink(file, max = 1600, q = 0.85) {
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q)); return { blob, canvas: c };
}
async function upload(blob) { if (!S.cap.assets) return { id: "", url: URL.createObjectURL(blob) }; try { const r = await S.cap.assets.upload(blob); return { id: r.id, url: r.url }; } catch (e) { console.warn(e); return { id: "", url: URL.createObjectURL(blob) }; } }

function toastUndo(msg) { toast(msg); const t = $("#toastTx"); t.innerHTML = `${esc(msg)} <button data-act="undo" style="all:unset;cursor:pointer;margin-left:10px;font-weight:800;color:#B9A6FF">Annuler</button>`; $("#toast").style.pointerEvents = "auto"; clearTimeout($("#toast")._h); $("#toast")._h = setTimeout(() => { $("#toast").classList.remove("on"); S.ui.undo = null; }, 4000); }
/* ───────────────────────── toast + burst ───────────────────────── */
function toast(msg, kind) { const t = $("#toast"); $("#toastTx").textContent = msg; t.classList.toggle("err", kind === "err"); const c = $(".check", t); c.classList.remove("draw"); void c.offsetWidth; c.classList.add("draw"); t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), kind === "err" ? 3800 : 2300); }
function burst(x = window.innerWidth / 2, y = window.innerHeight / 3) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const b = document.createElement("div"); b.className = "burst"; const cols = ["#7A4DFF", "#4A1FE6", "#9ED7FF", "#C8B6FF", "#2FB985", "#fff"];
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
const rerender = () => { const v = $("#viewport .view:not(.leave)"); if (!v) return; const st = v.scrollTop; v.classList.add("nost"); v.innerHTML = renderRoute(); v.scrollTop = st; afterRender(v); };

/* ───────────────────────── actions ───────────────────────── */
document.addEventListener("submit", (e) => { const f = e.target; if (f.dataset.form === "code") { e.preventDefault(); lookupCode($("#codeIn").value); } });
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button][data-go],[role=button][data-act]")) { e.preventDefault(); e.target.click(); } });
document.addEventListener("click", async (e) => {
  SFX.init();
  const tab = e.target.closest("[data-tab]");
  if (tab) { const r = tab.dataset.tab; SFX.tap(); buzz(5); if (r !== S.route) { S.history = []; go(r, {}, { replace: true }); } else { const v = $("#viewport .view"); v && v.scrollTo({ top: 0, behavior: "smooth" }); } return; }
  const g = e.target.closest("[data-go]");
  if (g && !e.target.closest("[data-act]")) { SFX.tap(); const p = g.dataset.id ? { id: g.dataset.id } : {}; if (g.dataset.fresh) p.fresh = true; go(g.dataset.go, p); return; }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act, id = a.dataset.id, v = a.dataset.v;
  const H = ACT[act]; if (H) { try { await H(a, id, v, e); } catch (err) { console.warn(err); } }
});
const ACT = {
  back: () => { SFX.tap(); goBack(); },
  sheetClose: () => closeSheet(),
  undo: async () => { const u = S.ui.undo; if (!u) return; S.ui.undo = null; await DB.del(u.col, u.id).catch(() => {}); $("#toast").classList.remove("on"); SFX.close(); },

  sound: () => { SFX.on = !SFX.on; try { localStorage.setItem("gg-sound", SFX.on ? "on" : "off"); } catch (e) {} if (SFX.on) SFX.ok(); rerender(); },

};

async function saveCsv(name, rows) {
  const csv = "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\n");
  if (!S.cap.downloads) { toast("Export indisponible dans cette vue.", "err"); return; }
  try { await S.cap.downloads.save({ filename: name, data: new Blob([csv], { type: "text/csv" }) }); SFX.ok(); toast("Fichier prêt"); } catch (e) { if (e && e.code !== "declined") toast("Export impossible.", "err"); }
}

