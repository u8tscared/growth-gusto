/* Growth Gusto — area: alertes (centre d'alertes, réglages des alertes, e-mails) + sites (« Mes établissements »). Prefix « al ».
   Alerts come from two places, merged into one list:
     (a) computed here from S when the app is open: reading out of range, missed round (a service ended + delay with fridges not read),
         DLC today / expired, sensor offline / low battery (restos/{rid}/sensors), obligation due soon (js/oblig.js oblState);
     (b) docs in restos/{rid}/alerts written by the server or by other modules through ALERTES.push():
         { key?, type, level:"warn"|"bad", fridgeId?, sensorId?, lotId?, oblId?, slot?, day?, value?, at, text, sub?, seen:false, seenAt?, seenBy?, src, by? }
         A doc whose key (or id) equals a computed alert's key replaces it (the server uses the same keys), so nothing shows twice.
   Seen: docs are marked seen for everyone (DB.update); computed alerts are remembered on this device (localStorage gg-al-seen).
   Settings: restos/{rid}.alertCfg (gérant only), see AL_DEF. E-mail: functions/src/alertes.js (Brevo), live when S.resto.server.alertes.
   Public: window.ALERTES = { push(alert), count(), list(), cfg(), refresh() }; window event "gg:alerts" {count} when the unread count changes.
   Routes: alertes (TAB_OF more), sites (TAB_OF more). */
"use strict";

TAB_OF.alertes = "more"; TAB_OF.sites = "more";
Object.assign(IC, {
  alBell: ["f:M6 9.5a6 6 0 0 1 12 0c0 5.5 2.5 7.5 2.5 7.5h-17S6 15 6 9.5z", "M6 9.5a6 6 0 0 1 12 0c0 5.5 2.5 7.5 2.5 7.5h-17S6 15 6 9.5z", "M10.2 20.5a2 2 0 0 0 3.6 0"],
  alEye: ["M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", "c:12,12,3"],
  alWifiOff: ["M12 20h.01", "M8.5 16.4a5 5 0 0 1 7 0", "M5 12.9a10 10 0 0 1 5.2-2.8", "M19 12.9a10 10 0 0 0-2-1.5", "M2 8.8a15 15 0 0 1 4.2-2.6", "M22 8.8a15 15 0 0 0-11.2-3.8", "m3 3 18 18"],
  alBatt: ["r:2.5,7,17,10,2.5", "M22 11v2", "f:M5 9.5h3v5H5z", "M5.5 10v4"],
  alMail: ["f:M3 6.5h18v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z", "r:3,5,18,14,2.5", "m3.5 7 8.5 6 8.5-6"],
  alMoon: ["f:M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z", "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  alUp: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "c:9,7,4", "M19 16V8", "m16 11 3-3 3 3"],
  alDlc: ["f:M5 4.5h14v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z", "M5 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 5.5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V7.5z", "M8.5 2.5v3", "M15.5 2.5v3", "m9.5 12.5 5 5", "m14.5 12.5-5 5"],
  alChart: ["M3 3v18h18", "f:M7 14h3v5H7zM12 9h3v10h-3zM17 12h3v7h-3z", "M7 19v-5", "M12 19V9", "M17 19v-7"],
});

/* [group, icon, title, one line, well class] */
const AL_TYPES = [
  ["temp", "therm", "Température hors seuil", "Un frigo trop chaud ou trop froid", "bad"],
  ["missed", "clock", "Relevé oublié", "Un service fini sans relevé", "warn"],
  ["dlc", "alDlc", "DLC", "Produits à jeter", "bad"],
  ["sensor", "alWifiOff", "Sondes", "Hors ligne ou pile faible", "sky"],
  ["oblig", "calcheck", "Obligations", "Un contrôle à prévoir", "vio"],
];
const AL_TYPE = Object.fromEntries(AL_TYPES.map((t) => [t[0], t]));
const AL_DEF = {
  on: { temp: true, missed: true, dlc: true, sensor: true, oblig: true },
  slots: { midi: "14:30", soir: "22:30" }, delay: 30, closed: [],
  to: null, extra: [], quiet: { on: false, from: "23:00", to: "07:00" }, esc: { on: false, after: 30, who: "" },
  oblDays: 15, weekly: true,
};
const AL_DAYS = [[1, "L"], [2, "M"], [3, "M"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const AL = { watched: null, docs: [], sensors: [], last: -1, seeded: false, sites: {}, sitesSeeded: false };

const alGroup = (t) => (String(t || "").startsWith("sensor") ? "sensor" : t === "reading" ? "temp" : t);
const alAdmin = () => { try { return typeof PERMS !== "undefined" && PERMS.isAdmin ? !!PERMS.isAdmin() : myRole() === "gerant"; } catch (e) { return myRole() === "gerant"; } };
const alCan = (r) => { try { return typeof PERMS === "undefined" || !PERMS.can ? true : PERMS.can(r) !== false; } catch (e) { return true; } };
const alServerOn = (r = S.resto) => !!(r && r.server && r.server.alertes);
const alHm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
const alAgo = (at) => { const m = Math.round((Date.now() - at) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const k = dayKey(new Date(at)); if (k === dayKey()) return `à ${hm(at)}`; return when(at); };
const alSafeId = (k) => String(k).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 140);

function alCfg(r = S.resto) {
  const c = (r && r.alertCfg) || {};
  return { ...AL_DEF, ...c, on: { ...AL_DEF.on, ...(c.on || {}) }, slots: { ...AL_DEF.slots, ...(c.slots || {}) }, quiet: { ...AL_DEF.quiet, ...(c.quiet || {}) }, esc: { ...AL_DEF.esc, ...(c.esc || {}) }, closed: Array.isArray(c.closed) ? c.closed : [], extra: Array.isArray(c.extra) ? c.extra : [] };
}
/* who gets the e-mails: the members ticked in réglages; by default every gérant with an e-mail address */
function alRecipients(cfg = alCfg(), members = S.members) {
  const withMail = members.filter((m) => m.email);
  const mem = cfg.to ? withMail.filter((m) => cfg.to.includes(m.id)) : withMail.filter((m) => m.role === "gerant");
  return [...mem.map((m) => ({ id: m.id, name: m.name || m.email, email: m.email })), ...cfg.extra.map((e) => ({ id: "x:" + e, name: e, email: e }))];
}

/* ───────── seen, on this device (computed alerts) ───────── */
const alSeenGet = () => { try { return JSON.parse(localStorage.getItem("gg-al-seen") || "{}"); } catch (e) { return {}; } };
const alSeenMap = (rid = S.rid) => (alSeenGet()[rid] || {});
function alSeenPut(keys) {
  const all = alSeenGet(); const m = (all[S.rid] ||= {}); const now = Date.now();
  keys.forEach((k) => (m[k] = now)); Object.keys(m).forEach((k) => { if (now - m[k] > 12 * 864e5) delete m[k]; });
  if (DB.mode === "demo") { AL.demoSeen = { ...(AL.demoSeen || {}), ...Object.fromEntries(keys.map((k) => [k, now])) }; return; }
  try { localStorage.setItem("gg-al-seen", JSON.stringify(all)); } catch (e) {}
}

/* ───────── the engine: pure on a data bundle, so « Mes établissements » can run it on another restaurant ───────── */
function alCompute(D, cfg, now = Date.now()) {
  const out = []; const today = dayKey(new Date(now - GG_DAY.start * 36e5)), yday = addDays(today, -1);
  const fr = D.fridges || [], frName = (id) => (fr.find((f) => f.id === id) || {}).name || "Frigo";
  /* temperature out of range, last 48 h, not corrected since */
  if (cfg.on.temp) (D.readings || []).forEach((r) => {
    if ((r.day !== today && r.day !== yday) || r.ok !== false || !fr.some((f) => f.id === r.fridgeId)) return;
    out.push({ key: "temp_" + r.id, type: "temp", level: "bad", fridgeId: r.fridgeId, value: r.value, at: r.at || now, text: `${frName(r.fridgeId)} à ${fmt(r.value)} °C`, sub: r.action ? r.action : `Hors seuil · relevé du ${r.slot === "soir" ? "soir" : "midi"}` });
  });
  /* missed rounds: the service ended (+ delay) and some fridges were not read */
  if (cfg.on.missed && fr.length) [yday, today].forEach((day) => {
    const d = parseDay(day); if (cfg.closed.includes(d.getDay()) || (typeof ggClosed === "function" && ggClosed(day))) return;
    ["midi", "soir"].forEach((slot) => {
      let end = alHm(cfg.slots[slot]); if (end == null) return; if (end < GG_DAY.start * 60) end += 1440; /* « 02:30 » = la nuit qui suit */
      const due = d.getTime() + (end + (+cfg.delay || 0)) * 6e4; if (now < due) return;
      if (D.since && D.since > due) return; /* the restaurant did not exist yet */
      const exp = fr.filter((f) => !f.createdAt || f.createdAt < due);
      const done = new Set((D.readings || []).filter((r) => r.day === day && r.slot === slot).map((r) => r.fridgeId));
      const miss = exp.filter((f) => !done.has(f.id)); if (!miss.length) return;
      out.push({ key: `missed_${day}_${slot}`, type: "missed", level: miss.length === exp.length ? "bad" : "warn", slot, day, at: due, text: `Relevé ${slotDu(slot)} oublié${day === yday ? " hier" : ""}`, sub: miss.length === exp.length ? `Aucun frigo relevé (${miss.length})` : `${miss.map((f) => f.name).slice(0, 3).join(", ")}${miss.length > 3 ? ` +${miss.length - 3}` : ""}` });
    });
  });
  /* DLC today or past, on products still in a fridge */
  if (cfg.on.dlc) (D.lots || []).forEach((l) => {
    if (l.status !== "in" && l.status !== "opened") return; const k = dlcOf(l); const n = daysUntil(k); if (n == null || n > 0) return;
    out.push({ key: `dlc_${l.id}_${k}`, type: "dlc", noTime: true, level: n < 0 ? "bad" : "warn", lotId: l.id, fridgeId: l.fridgeId, at: Math.max(parseDay(k).getTime(), now - 864e5 * 2), text: `${l.name || "Produit"} : DLC ${n < 0 ? "dépassée" : "aujourd'hui"}`, sub: `${l.fridgeId ? frName(l.fridgeId) : "À jeter"}${n < 0 ? ` · depuis le ${shortDate(k)}` : ""}` });
  });
  /* sensors (js/sondes.js): no signal for 30 min, or a battery at 15 % or less */
  if (cfg.on.sensor) (D.sensors || []).forEach((s) => {
    if (s.active === false) return; const seen = +s.lastSeen || +s.lastAt || 0; const nm = s.name || (s.fridgeId ? frName(s.fridgeId) : "Sonde");
    if (seen && now - seen > 30 * 6e4) out.push({ key: `sensor_offline_${s.id}_${Math.floor(seen / 36e5)}`, type: "sensor_offline", level: "warn", sensorId: s.id, fridgeId: s.fridgeId, at: seen + 30 * 6e4, text: `Sonde hors ligne · ${nm}`, sub: `Dernier signal ${when(seen)}` });
    if (s.battery != null && +s.battery <= 15) out.push({ key: `sensor_battery_${s.id}`, type: "sensor_battery", level: "warn", sensorId: s.id, fridgeId: s.fridgeId, at: now - 36e5, text: `Pile faible · ${nm}`, sub: `${Math.round(+s.battery)} % restant` });
  });
  /* obligations due within N days (js/oblig.js) */
  if (cfg.on.oblig && typeof oblState === "function") (D.obligations || []).forEach((o) => {
    if (o.archived) return; let s; try { s = oblState(o); } catch (e) { return; } if (!s || !s.due || s.d > (+cfg.oblDays || 15)) return;
    out.push({ key: `obl_${o.id}_${s.due}`, type: "oblig", noTime: true, level: s.d < 0 ? "bad" : "warn", oblId: o.id, at: parseDay(today).getTime() + 60 * 6e4 - Math.max(0, s.d) * 6e4, text: o.name, sub: s.d < 0 ? s.tx : `À prévoir · ${s.tx.toLowerCase()}` });
  });
  return out;
}
/* merge the docs (server / modules) with the computed alerts; seen state; newest first, unread first */
function alMerge(D, cfg, seenMap, now = Date.now()) {
  const docs = (D.alerts || []).filter((a) => a && a.type !== "test" && cfg.on[alGroup(a.type)] !== false);
  const byKey = new Map(); docs.forEach((a) => byKey.set(a.key || a.id, a));
  const rows = [];
  docs.forEach((a) => { const seen = !!a.seen; if (seen && now - (a.seenAt || a.at || 0) > 7 * 864e5) return; rows.push({ ...a, key: a.key || a.id, docId: a.id, level: a.level === "bad" ? "bad" : "warn", seen }); });
  alCompute(D, cfg, now).forEach((c) => { if (byKey.has(c.key) || byKey.has(alSafeId(c.key))) return; rows.push({ ...c, seen: !!seenMap[c.key] }); });
  return rows.sort((a, b) => (a.seen - b.seen) || (!a.seen && a.level !== b.level ? (a.level === "bad" ? -1 : 1) : 0) || (b.at || 0) - (a.at || 0));
}
function alCurrent() {
  const D = { since: (S.resto && S.resto.createdAt) || 0, fridges: S.fridges, readings: S.readings, lots: S.lots, obligations: alCan("obligations") ? S.obligations : [], sensors: AL.sensors, alerts: AL.docs };
  return alMerge(D, alCfg(), DB.mode === "demo" ? { ...alSeenMap(), ...(AL.demoSeen || {}) } : alSeenMap());
}

/* ───────── own subscriptions (alerts, sensors), once per restaurant ───────── */
function alWatch() {
  if (!S.ready || !S.rid || AL.watched === S.rid) return; AL.watched = S.rid; AL.docs = []; AL.sensors = [];
  const rid = S.rid;
  DB.watch("alerts", { order: "at", dir: "desc", limit: 300 }, (rows) => { if (rid !== S.rid) return; AL.docs = rows; alBump(true); });
  DB.watch("sensors", {}, (rows) => { if (rid !== S.rid) return; AL.sensors = rows; alBump(true); });
  if (DB.mode === "demo") alSeedDemo();
}
/* core attachResto() drops every subscription when the restaurant changes: watch again */
function alTick() {
  if (!S.ready || !S.rid) return;
  if (AL.watched !== S.rid || (DB.mode === "local" && !(DB.listeners[DB.path("alerts")] || []).length)) { AL.watched = null; alWatch(); }
  alBump(false);
}
function alBump(data) {
  let n = 0; try { n = alCurrent().filter((a) => !a.seen).length; } catch (e) { return; }
  if (n !== AL.last) { AL.last = n; try { renderChrome(); } catch (e) {} try { window.dispatchEvent(new CustomEvent("gg:alerts", { detail: { count: n } })); } catch (e) {} if (S.route === "alertes" && !data) refresh(); }
  if (data && (S.route === "alertes" || S.route === "sites")) refresh();
}
window.addEventListener("gg:ready", () => setTimeout(alTick, 300));
setInterval(alTick, 30000);

/* ───────── public API ───────── */
window.ALERTES = {
  /* raise an alert from any module: { type, level, text, fridgeId?, sensorId?, lotId?, value?, key?, sub? } → doc in restos/{rid}/alerts */
  async push(a) {
    if (!a || !S.rid) return null; const at = +a.at || Date.now();
    const type = String(a.type || a.kind || "autre"); if (!a.text && a.title) a = { ...a, text: a.title, sub: a.sub || a.text }; const key = a.key || `${type}_${a.fridgeId || a.sensorId || a.lotId || ""}_${Math.floor(at / 6e5)}`;
    const id = alSafeId(key); if (AL.docs.some((d) => d.id === id)) return id;
    const doc = { key, type, level: a.level === "bad" ? "bad" : "warn", at, text: String(a.text || "Alerte"), seen: false, src: a.src || "app", by: S.me.id };
    ["fridgeId", "sensorId", "lotId", "oblId", "value", "sub", "slot", "day"].forEach((k) => { if (a[k] != null) doc[k] = a[k]; });
    try { await DB.set("alerts", id, doc); } catch (e) { console.warn("alerte", e); }
    if (doc.level === "bad" && S.route !== "alertes") { try { SFX.err(); buzz([20, 60, 20]); } catch (e) {} }
    return id;
  },
  count() { try { return alCurrent().filter((a) => !a.seen).length; } catch (e) { return 0; } },
  list() { try { return alCurrent(); } catch (e) { return []; } },
  cfg: () => alCfg(),
  refresh: () => alTick(),
};

/* ───────── demo seed (in memory only) ───────── */
function alSeedDemo() {
  if (AL.seeded || DB.mode !== "demo") return; AL.seeded = true;
  const P = DB.path("alerts"); if (DB.local[P] && Object.keys(DB.local[P]).length) return;
  const now = Date.now(), fs = S.fridges.length ? S.fridges : [{ id: "fr-s2", name: "Frigo de service 2" }, { id: "fr-cf", name: "Chambre froide" }];
  const f2 = fs.find((f) => f.id === "fr-s2") || fs[0], cf = fs.find((f) => f.id === "fr-cf") || fs[0];
  const put = (id, d) => ((DB.local[P] ||= {})[id] = d);
  put("demo_sonde_temp", { key: "demo_sonde_temp", type: "temp", level: "bad", fridgeId: f2.id, sensorId: "demo-sn2", value: 6.8, at: now - 22 * 6e4, text: `${f2.name} à 6,8 °C`, sub: "Mesuré par la sonde · depuis 20 min", seen: false, src: "sonde" });
  put("demo_sonde_batt", { key: "demo_sonde_batt", type: "sensor_battery", level: "warn", fridgeId: cf.id, sensorId: "demo-sn1", value: 12, at: now - 3 * 36e5, text: `Pile faible · ${cf.name}`, sub: "12 % restant", seen: false, src: "sonde" });
  put("demo_old1", { key: "demo_old1", type: "temp", level: "bad", fridgeId: cf.id, value: 5.1, at: now - 26 * 36e5, text: `${cf.name} à 5,1 °C`, sub: "Porte mal fermée, refermée", seen: true, seenAt: now - 25 * 36e5, seenBy: "demo-thomas", src: "sonde" });
  put("demo_old2", { key: "demo_old2", type: "sensor_offline", level: "warn", fridgeId: f2.id, at: now - 50 * 36e5, text: `Sonde hors ligne · ${f2.name}`, sub: "Revenue 12 min plus tard", seen: true, seenAt: now - 49 * 36e5, seenBy: "demo-ines", src: "sonde" });
  DB.emit(P);
}
/* « Mes établissements » in the demo: a second restaurant, so the screen shows what it is for */
function alSeedSites() {
  if (AL.sitesSeeded || DB.mode !== "demo" || S.restos.length > 1) return; AL.sitesSeeded = true;
  const rid = "demo2", P = (c) => `restos/${rid}/${c}`, now = Date.now(), today = dayKey(), h = new Date().getHours();
  const F = [["c-cf", "Chambre froide", 0, 4, 2.1], ["c-bar", "Frigo du bar", 0, 6, 3.6], ["c-cg", "Congélateur", -40, -18, -20.5]];
  DB.local[P("fridges")] = Object.fromEntries(F.map(([k, name, min, max], i) => [k, { name, min, max, order: i, createdAt: now - 200 * 864e5 }]));
  const R = {}; F.forEach(([k, name, min, max, v], i) => { if (h >= 10 && i < 2) R["cr" + i] = { fridgeId: k, fname: name, value: i === 1 ? 7.2 : v, slot: "midi", day: today, at: now - (h >= 12 ? 3 : 1) * 36e5, ok: i !== 1, action: i === 1 ? "Porte mal fermée, refermée" : "" }; });
  DB.local[P("readings")] = R;
  DB.local[P("lots")] = { cl1: { name: "Crème fraîche", status: "in", dlc: addDays(today, -1), fridgeId: "c-cf", createdAt: now - 5 * 864e5 } };
  DB.local[P("members")] = { "demo-camille": { name: "Camille Laurent", role: "gerant", email: "camille@bistrot-demo.fr" } };
  DB.set("restos", rid, { name: "Le Comptoir Démo", type: "bar", owner: "demo-camille", createdAt: now - 200 * 864e5, demo: true }).catch(() => {});
}

/* ───────── e-mail (same template as functions/src/alertes.js) ───────── */
function alMailHTML({ resto, logo = "", title, intro, items = [], stats = null, cta = "Ouvrir les alertes", foot = "" }) {
  /* the restaurant logo, only as an https URL: most mail clients block data: images */
  const lg = typeof logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(logo) && logo.length <= 2000 ? logo : "";
  const e = esc, col = { bad: ["#FFE9DE", "#C8432A"], warn: ["#FFF3D6", "#7A5A1A"], ok: ["#E3F5EA", "#1E7F55"], vio: ["#EFE9FF", "#3A10D8"] };
  const row = (it) => { const [bg, fg] = col[it.level] || col.vio; return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1.5px solid #E9DFCD;border-radius:16px"><tr><td width="44" style="padding:14px 0 14px 14px;vertical-align:top"><div style="width:30px;height:30px;border-radius:50%;background:${bg};color:${fg};font:800 15px/30px Arial,sans-serif;text-align:center">!</div></td><td style="padding:14px 14px 14px 10px;font-family:Arial,Helvetica,sans-serif"><div style="font-size:15px;font-weight:700;color:#1B1530">${e(it.text)}</div>${it.sub ? `<div style="font-size:13px;color:#615B74;margin-top:3px">${e(it.sub)}</div>` : ""}</td></tr></table></td></tr>`; };
  const st = stats ? `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${stats.map(([v, l, lv]) => `<td width="${Math.floor(100 / stats.length)}%" style="padding:0 4px"><div style="background:#FFFFFF;border:1.5px solid #E9DFCD;border-radius:16px;padding:12px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif"><div style="font-size:24px;font-weight:800;letter-spacing:-.5px;color:${lv ? (col[lv] || col.vio)[1] : "#1B1530"}">${e(v)}</div><div style="font-size:12px;color:#615B74;margin-top:2px">${e(l)}</div></div></td>`).join("")}</tr></table></td></tr>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(title)}</title></head><body style="margin:0;background:#FBF6EC">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FBF6EC"><tr><td align="center" style="padding:26px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;letter-spacing:-.4px;color:#1B1530">Growth <span style="color:#5B2BFF">Gusto</span></td></tr>
<tr><td style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-radius:24px;padding:22px 18px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${lg ? `<tr><td style="padding:0 0 10px"><img src="${e(lg)}" width="44" height="44" alt="${e(resto)}" style="display:block;width:44px;height:44px;border-radius:13px;object-fit:contain;background:#FFFFFF;border:1px solid #E9DFCD"></td></tr>` : ""}<tr><td style="padding:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#3A10D8">${e(resto)}</td></tr>
<tr><td style="padding:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:28px;font-weight:800;letter-spacing:-.6px;color:#1B1530">${e(title)}</td></tr>
${intro ? `<tr><td style="padding:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:21px;color:#4A4560">${e(intro)}</td></tr>` : ""}
${st}${items.map(row).join("")}
<tr><td style="padding:6px 0 12px"><a href="https://app.growthgusto.fr/?go=alertes" style="display:inline-block;background:#5B2BFF;color:#FFFFFF;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:14px 22px;border-radius:14px;border-bottom:4px solid #2A0BA6">${e(cta)}</a></td></tr>
</table></td></tr>
<tr><td style="padding:14px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6E6880">${e(foot || "Vous recevez ce message car vous suivez les alertes de ce restaurant. Réglez-les dans Growth Gusto, Alertes, Réglages.")}</td></tr>
</table></td></tr></table></body></html>`;
}
/* the Monday report, computed on a data bundle (the server runs the same rules) */
function alWeekly(D) {
  const today = dayKey(), days = Array.from({ length: 7 }, (_, i) => addDays(today, -i - 1)), set = new Set(days);
  const fr = D.fridges || [], rs = (D.readings || []).filter((r) => set.has(r.day) && fr.some((f) => f.id === r.fridgeId));
  const rounds = new Set(rs.map((r) => r.fridgeId + r.day + r.slot)).size, exp = fr.length * 14, bad = rs.filter((r) => r.ok === false).length;
  const t0 = parseDay(days[6]).getTime(), t1 = parseDay(today).getTime();
  const thrown = (D.lots || []).filter((l) => l.status === "lost" && l.outAt >= t0 && l.outAt < t1);
  let obl = []; try { if (typeof oblDue === "function" && D === S) obl = oblDue(30); } catch (e) {}
  return { conf: exp ? Math.round((Math.min(rounds, exp) - Math.min(bad, rounds)) / exp * 100) : null, rounds, exp, bad, thrown, obl, from: days[6], to: days[0] };
}

/* ───────── views ───────── */
const alWell = (a) => { const g = alGroup(a.type); const ic = g === "sensor" ? (a.type === "sensor_battery" ? "alBatt" : "alWifiOff") : (AL_TYPE[g] || [])[1] || "alBell"; return `<span class="al-ic ${a.level}">${ico(ic)}</span>`; };
function alRow(a, i) {
  return `<div class="al-row st${a.seen ? " seen" : ""}" style="--i:${Math.min(i + 3, 12)}" data-key="${esc(a.key)}">
    <div class="al-bg" aria-hidden="true">${ico("alEye")}<span>Vu</span></div>
    <div class="al-card ${a.level}" data-act="alOpen" data-id="${esc(a.key)}" role="button" tabindex="0">
      ${alWell(a)}<div class="al-tx"><b>${esc(a.text)}</b><em>${a.noTime ? esc(a.sub || "") : `${a.sub ? esc(a.sub) + " · " : ""}${alAgo(a.at || Date.now())}`}</em></div>
      ${a.seen ? `<span class="al-chev">${ico("chev")}</span>` : `<button class="al-vu" data-act="alSeen" data-id="${esc(a.key)}" aria-label="Marquer comme vu">${ico("alEye")}</button>`}
    </div></div>`;
}
VIEWS.alertes = {
  render() {
    alWatch();
    const admin = alAdmin(); const tab = admin && S.ui.alTab === "cfg" ? "cfg" : "list";
    const seg = admin ? `<div class="seg al-seg st" style="--i:1"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "cfg" ? "100%" : "0"})"></span><button class="${tab === "list" ? "on" : ""}" data-act="alTab" data-v="list">Alertes</button><button class="${tab === "cfg" ? "on" : ""}" data-act="alTab" data-v="cfg">Réglages</button></div>` : "";
    return `<div class="inner narrow al">${topBar("Alertes")}${seg}${tab === "cfg" ? alCfgView() : alListView()}</div>`;
  },
  after(v) { alSwipe(v); alCfgBind(v); },
};
function alListView() {
  const all = alCurrent(); const un = all.filter((a) => !a.seen), seen = all.filter((a) => a.seen).slice(0, 20);
  const nb = un.filter((a) => a.level === "bad").length;
  const hero = un.length
    ? `<div class="wall al-hero st" style="--i:2"><div class="al-hn"><span class="al-big">${un.length}</span><span class="al-hl"><span>${un.length > 1 ? "alertes" : "alerte"}</span><span>à voir</span>${nb ? `<em>${nb} urgente${nb > 1 ? "s" : ""}</em>` : ""}</span></div><button class="al-all" data-act="alSeenAll" aria-label="Tout marquer comme vu">${ico("alEye")}Tout vu</button></div>`
    : `<div class="glass al-calm st" style="--i:2"><span class="al-calm-ic">${ico("alBell")}</span><b class="h3">Tout est calme</b><span class="sub">Aucune alerte en cours.</span></div>`;
  return `${hero}
    ${un.length ? `<div class="al-list">${un.map(alRow).join("")}</div><p class="al-hint st" style="--i:6">Glissez une alerte pour la marquer vue</p>` : ""}
    ${seen.length ? `<div class="lbl al-lbl st" style="--i:7">Déjà vues</div><div class="al-list">${seen.map((a, i) => alRow(a, i + 6)).join("")}</div>` : ""}`;
}

/* ── réglages ── */
const alSw = (on) => `<span class="al-sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span>`;
function alCfgView() {
  const c = alCfg(), live = alServerOn(), rc = alRecipients(c); const withMail = S.members.filter((m) => m.email);
  const ticked = (m) => (c.to ? c.to.includes(m.id) : m.role === "gerant");
  const chip = (act, v, on, t) => `<button class="chip ${on ? "on" : ""}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${t}</button>`;
  const whoOpts = [["", "Personne"], ...withMail.map((m) => [m.id, m.name || m.email]), ...c.extra.map((e) => ["x:" + e, e])];
  return `
  <div class="glass al-card-s st" style="--i:2"><div class="al-h">Quand prévenir</div>
    ${AL_TYPES.map(([k, ic, t, s, w]) => `<div class="li tap" data-act="alTog" data-v="${k}" role="switch" aria-checked="${!!c.on[k]}"><span class="al-ic sm ${w}">${ico(ic)}</span><div class="tx"><b>${t}</b><em>${s}</em></div>${alSw(c.on[k])}</div>`).join("")}
  </div>
  <div class="glass al-card-s st" style="--i:3"><div class="al-h">Relevés oubliés</div>
    <div class="al-f2"><label class="field"><span>Fin du service du midi</span><input class="input" type="time" data-al="slots.midi" value="${esc(c.slots.midi)}"></label><label class="field"><span>Fin du service du soir</span><input class="input" type="time" data-al="slots.soir" value="${esc(c.slots.soir)}"></label></div>
    <div class="al-fl">Alerte après</div><div class="al-chips g4">${[15, 30, 45, 60].map((n) => chip("alDelay", n, +c.delay === n, `${n} min`)).join("")}</div>
    <div class="al-fl">Jours de fermeture</div><div class="al-chips al-days">${AL_DAYS.map(([d, t]) => chip("alClosed", d, c.closed.includes(d), t)).join("")}</div>
  </div>
  <div class="glass al-card-s st" style="--i:4"><div class="al-h">Par e-mail ${live ? `<span class="pill ok">Actif</span>` : `<span class="pill warn">Bientôt actif</span>`}</div>
    ${withMail.length ? withMail.map((m) => `<div class="li tap" data-act="alTo" data-id="${esc(m.id)}" role="switch" aria-checked="${ticked(m)}">${avatar(m.id)}<div class="tx"><b>${esc(m.name || m.email)}</b><em>${esc(m.email)}</em></div>${alSw(ticked(m))}</div>`).join("") : `<p class="sub al-pad">Personne de l'équipe n'a encore d'adresse e-mail.</p>`}
    ${c.extra.map((e) => `<div class="li"><span class="al-ic sm vio">${ico("alMail")}</span><div class="tx"><b>${esc(e)}</b><em>Adresse ajoutée</em></div><button class="iconbtn al-x" data-act="alExtraDel" data-v="${esc(e)}" aria-label="Retirer ${esc(e)}">${ico("x")}</button></div>`).join("")}
    <div class="hstack al-add"><input class="input" id="alExtraIn" type="email" inputmode="email" autocomplete="email" placeholder="Autre adresse e-mail" enterkeyhint="done"><button class="btn soft sm" data-act="alExtraAdd">${ico("plus")}Ajouter</button></div>
    <div class="al-sep"></div>
    <div class="li tap" data-act="alQuiet" role="switch" aria-checked="${c.quiet.on}"><span class="al-ic sm vio">${ico("alMoon")}</span><div class="tx"><b>Heures calmes</b><em>${c.quiet.on ? `Pas d'e-mail de ${c.quiet.from} à ${c.quiet.to}, sauf urgence` : "E-mails à toute heure"}</em></div>${alSw(c.quiet.on)}</div>
    ${c.quiet.on ? `<div class="al-f2 al-in"><label class="field"><span>De</span><input class="input" type="time" data-al="quiet.from" value="${esc(c.quiet.from)}"></label><label class="field"><span>À</span><input class="input" type="time" data-al="quiet.to" value="${esc(c.quiet.to)}"></label></div>` : ""}
    <div class="li tap" data-act="alEsc" role="switch" aria-checked="${c.esc.on}"><span class="al-ic sm warn">${ico("alUp")}</span><div class="tx"><b>Relance</b><em>${c.esc.on ? "Si personne ne regarde l'alerte" : "Prévenir une 2e personne si besoin"}</em></div>${alSw(c.esc.on)}</div>
    ${c.esc.on ? `<div class="al-in"><div class="al-fl">Après</div><div class="al-chips g3">${[15, 30, 60].map((n) => chip("alEscAfter", n, +c.esc.after === n, `${n} min`)).join("")}</div>
      <label class="field"><span>Prévenir</span><select class="input" data-al="esc.who">${whoOpts.map(([v, t]) => `<option value="${esc(v)}" ${c.esc.who === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>` : ""}
    <div class="li tap" data-act="alWeeklyTog" role="switch" aria-checked="${c.weekly}"><span class="al-ic sm ok">${ico("alChart")}</span><div class="tx"><b>Rapport du lundi</b><em>Chaque lundi à 7 h, le bilan de la semaine</em></div>${alSw(c.weekly)}</div>
    <div class="al-btns"><button class="btn acc block" data-act="alTest">${ico("alMail")}Envoyer un e-mail de test</button><button class="btn ghost block" data-act="alReport">Voir le rapport du lundi</button></div>
    ${rc.length ? "" : `<p class="note al-pad" style="margin:0">Cochez au moins une personne pour recevoir les e-mails.</p>`}
  </div>`;
}
function alSave(patch) {
  if (!alAdmin()) { toast("Seul le gérant règle les alertes.", "err"); return; }
  const c = alCfg(); const next = { ...c, ...patch }; delete next._;
  if (S.resto) S.resto.alertCfg = next; /* instant, the watch confirms */
  DB.update("restos", S.rid, { alertCfg: next }).catch(() => toast("Réglage non enregistré.", "err"));
  alBump(false); rerender();
}
function alCfgBind(v) {
  $$("[data-al]", v).forEach((el) => el.addEventListener("change", () => {
    const [a, b] = el.dataset.al.split("."); const c = alCfg(); const val = el.value;
    if (el.type === "time" && !/^\d{2}:\d{2}$/.test(val)) return;
    SFX.tick(); alSave({ [a]: { ...c[a], [b]: val } });
  }));
  const ex = $("#alExtraIn", v); if (ex) ex.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ACT.alExtraAdd(); } });
}

/* ── swipe to mark seen (phone): drag the card sideways, past 90 px it goes ── */
function alSwipe(v) {
  $$(".al-row:not(.seen)", v).forEach((row) => {
    const card = $(".al-card", row); let x0 = null, y0 = 0, dx = 0, drag = false, id = null;
    card.addEventListener("pointerdown", (e) => { if (e.button > 0 || e.target.closest(".al-vu")) return; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false; id = e.pointerId; });
    card.addEventListener("pointermove", (e) => {
      if (x0 == null || e.pointerId !== id) return; const mx = e.clientX - x0, my = e.clientY - y0;
      if (!drag) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) { drag = true; row.classList.add("drag"); try { card.setPointerCapture(id); } catch (x) {} } else if (Math.abs(my) > 10) { x0 = null; return; } else return; }
      dx = mx; card.style.transform = `translateX(${dx}px) rotate(${dx / 60}deg)`; row.classList.toggle("arm", Math.abs(dx) > 90);
    });
    const end = () => {
      if (x0 == null) return; x0 = null; if (!drag) return; row.classList.remove("drag");
      card._dragged = true; setTimeout(() => (card._dragged = false), 60);
      if (Math.abs(dx) > 90) { card.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`; buzz(8); alSeenRow(row, row.dataset.key); }
      else { card.style.transform = ""; row.classList.remove("arm"); }
    };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
    card.addEventListener("click", (e) => { if (card._dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
}
function alMark(keys) {
  const rows = alCurrent(); const loc = []; const now = Date.now();
  keys.forEach((k) => { const a = rows.find((r) => r.key === k); if (!a || a.seen) return; if (a.docId) DB.update("alerts", a.docId, { seen: true, seenAt: now, seenBy: S.me.id }).catch(() => {}); else loc.push(k); });
  if (loc.length) alSeenPut(loc);
}
function alSeenRow(row, key) {
  SFX.tick(); if (row) { row.style.height = row.offsetHeight + "px"; void row.offsetWidth; row.classList.add("bye"); }
  setTimeout(() => { alMark([key]); AL.last = -2; alBump(false); rerender(); }, row ? 380 : 0);
}
/* where an alert comes from */
function alGoCause(a) {
  const g = alGroup(a.type);
  if (g === "missed") { S.slot = a.slot || slotNow(); return go("releve"); }
  if (g === "dlc" && a.lotId && typeof openLot === "function") return openLot(a.lotId);
  if (g === "oblig" && a.oblId && VIEWS.obl) return go("obl", { id: a.oblId });
  if (g === "resa" && VIEWS.resa) return go("resa", a.day ? { day: a.day } : {});
  if (g === "sensor" && VIEWS.sondes) return go("sondes", a.sensorId ? { id: a.sensorId } : {});
  if (a.fridgeId && S.fridges.some((f) => f.id === a.fridgeId)) return go("frigo", { id: a.fridgeId });
  if (g === "temp") return go("releve");
}

Object.assign(ACT, {
  alTab: (a, id, v) => { S.ui.alTab = v; SFX.tick(); buzz(4); rerender(); },
  alOpen: (a, key) => { const r = alCurrent().find((x) => x.key === key); if (!r) return; SFX.tap(); alMark([key]); AL.last = -2; alGoCause(r); setTimeout(() => alBump(false), 50); },
  alSeen: (a, key) => { buzz(6); alSeenRow(a.closest(".al-row"), key); },
  alSeenAll: () => {
    const un = alCurrent().filter((x) => !x.seen); if (!un.length) return;
    $$(".al-row:not(.seen)").forEach((r, i) => setTimeout(() => r.classList.add("fly"), i * 50));
    SFX.ok(); buzz(10); setTimeout(() => { alMark(un.map((x) => x.key)); AL.last = -2; alBump(false); rerender(); toast(un.length > 1 ? `${un.length} alertes marquées vues` : "Alerte marquée vue"); }, 260 + un.length * 50);
  },
  alTog: (a, id, v) => { const c = alCfg(); SFX.tick(); buzz(4); alSave({ on: { ...c.on, [v]: !c.on[v] } }); },
  alDelay: (a, id, v) => { SFX.tick(); alSave({ delay: +v }); },
  alClosed: (a, id, v) => { const c = alCfg(); const d = +v; SFX.tick(); alSave({ closed: c.closed.includes(d) ? c.closed.filter((x) => x !== d) : [...c.closed, d] }); },
  alTo: (a, id) => { const c = alCfg(); const base = c.to || S.members.filter((m) => m.email && m.role === "gerant").map((m) => m.id); SFX.tick(); buzz(4); alSave({ to: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] }); },
  alExtraAdd: () => {
    const el = $("#alExtraIn"); const v = (el && el.value || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { SFX.err(); if (el) { el.classList.remove("al-shake"); void el.offsetWidth; el.classList.add("al-shake"); el.focus(); } toast("Adresse e-mail invalide.", "err"); return; }
    const c = alCfg(); if (c.extra.includes(v) || S.members.some((m) => (m.email || "").toLowerCase() === v)) { toast("Déjà dans la liste"); el.value = ""; return; }
    if (c.extra.length >= 10) { toast("10 adresses au plus.", "err"); return; }
    el.blur(); SFX.ok(); alSave({ extra: [...c.extra, v] });
  },
  alExtraDel: (a, id, v) => { const c = alCfg(); SFX.close(); alSave({ extra: c.extra.filter((x) => x !== v), esc: c.esc.who === "x:" + v ? { ...c.esc, who: "" } : c.esc }); },
  alQuiet: () => { const c = alCfg(); SFX.tick(); alSave({ quiet: { ...c.quiet, on: !c.quiet.on } }); },
  alEsc: () => { const c = alCfg(); SFX.tick(); const who = c.esc.who || (S.members.find((m) => m.email && m.id !== S.me.id) || {}).id || ""; alSave({ esc: { ...c.esc, on: !c.esc.on, who } }); },
  alEscAfter: (a, id, v) => { const c = alCfg(); SFX.tick(); alSave({ esc: { ...c.esc, after: +v } }); },
  alWeeklyTog: () => { const c = alCfg(); SFX.tick(); alSave({ weekly: !c.weekly }); },
  alTest: async () => {
    const rc = alRecipients(); if (!rc.length) { SFX.err(); toast("Cochez d'abord une personne.", "err"); return; }
    if (alServerOn()) { await ALERTES.push({ type: "test", level: "warn", key: "test_" + Date.now(), text: "E-mail de test" }); SFX.ok(); toast(`E-mail envoyé à ${rc.length} personne${rc.length > 1 ? "s" : ""}`); return; }
    const un = alCurrent().filter((x) => !x.seen).slice(0, 4);
    const items = un.length ? un.map((x) => ({ level: x.level, text: x.text, sub: x.sub })) : [{ level: "bad", text: "Chambre froide à 6,2 °C", sub: "Exemple · hors seuil depuis 15 min" }];
    alPreview("Aperçu de l'e-mail", rc, alMailHTML({ resto: S.resto.name, logo: S.resto.logo, title: un.length ? (un.length > 1 ? `${un.length} alertes à voir` : "1 alerte à voir") : "Une alerte à voir", intro: "Voici ce que vous recevrez dès qu'une alerte se déclenche.", items }));
  },
  alReport: () => {
    const W = alWeekly(S), rc = alRecipients();
    const items = [...W.obl.slice(0, 3).map((o) => ({ level: o.late ? "bad" : "warn", text: o.name, sub: o.statusTx })), ...W.thrown.slice(0, 3).map((l) => ({ level: "warn", text: `${l.name} jeté`, sub: l.lostReason || "DLC dépassée" }))];
    const html = alMailHTML({ resto: S.resto.name, logo: S.resto.logo, title: "Votre semaine", intro: `Du ${shortDate(W.from)} au ${shortDate(W.to)}.`, stats: [[W.conf == null ? "–" : W.conf + " %", "conformité", W.conf == null ? "" : W.conf >= 95 ? "ok" : W.conf >= 80 ? "warn" : "bad"], [String(W.bad), "anomalies", W.bad ? "bad" : "ok"], [String(W.thrown.length), "DLC jetées", W.thrown.length ? "warn" : "ok"]], items: items.length ? items : [{ level: "ok", text: "Rien à prévoir", sub: "Aucune obligation dans les 30 jours" }], cta: "Ouvrir Growth Gusto" });
    alPreview("Rapport du lundi", rc, html);
  },
});
function alPreview(title, rc, html) {
  const live = alServerOn();
  openSheet(`<div class="al-pv-h"><span class="al-ic vio">${ico("alMail")}</span><div><div class="h2" style="font-size:21px">${title}</div><div class="sub">Pour ${rc.length ? rc.map((r) => esc(firstName(r.name) || r.email)).join(", ") : "personne"}</div></div></div>
    ${live ? "" : `<div class="al-soon">${ico("clock")}<span><b>Bientôt actif.</b> L'envoi part tout seul dès que le serveur est en ligne.</span></div>`}
    <div class="al-pv"><iframe title="Aperçu de l'e-mail" sandbox="" loading="lazy"></iframe></div>
    <button class="btn soft block" data-act="sheetClose">Fermer</button>`, (b) => { const f = $("iframe", b); if (f) f.srcdoc = html; });
}

/* ───────── « Mes établissements » ───────── */
function alSiteBundle(r) {
  if (r.id === S.rid) return { since: r.createdAt || 0, fridges: S.fridges, readings: S.readings, lots: S.lots, obligations: S.obligations, sensors: AL.sensors, alerts: AL.docs, members: S.members };
  if (DB.mode !== "db") { const g = (c) => Object.entries(DB.local[`restos/${r.id}/${c}`] || {}).map(([id, d]) => ({ id, ...d })); return { since: r.createdAt || 0, fridges: g("fridges"), readings: g("readings"), lots: g("lots"), obligations: g("obligations"), sensors: g("sensors"), alerts: g("alerts"), members: g("members") }; }
  const c = AL.sites[r.id]; if (!c || Date.now() - c.at > 120000) alSiteFetch(r.id); return c && c.D ? { ...c.D, since: r.createdAt || 0 } : null;
}
async function alSiteFetch(rid) {
  if (!DB.db || (AL.sites[rid] && AL.sites[rid].busy)) return; AL.sites[rid] = { ...(AL.sites[rid] || {}), busy: true, at: AL.sites[rid] ? AL.sites[rid].at : 0 };
  const fs = DB.db, today = dayKey(), base = `restos/${rid}/`;
  const get = (q) => q.get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []);
  const [fridges, readings, lots, obligations, sensors, alerts] = await Promise.all([
    get(fs.collection(base + "fridges")), get(fs.collection(base + "readings").where("day", "in", [today, addDays(today, -1)])),
    get(fs.collection(base + "lots").where("status", "in", ["in", "opened"])), get(fs.collection(base + "obligations")),
    get(fs.collection(base + "sensors")), get(fs.collection(base + "alerts").where("seen", "==", false)),
  ]);
  AL.sites[rid] = { at: Date.now(), D: { fridges, readings, lots, obligations, sensors, alerts, members: [] } };
  if (S.route === "sites") refresh();
}
function alSiteStat(r) {
  const D = alSiteBundle(r); if (!D) return null;
  const today = dayKey(), fr = D.fridges || [], rs = (D.readings || []).filter((x) => x.day === today && fr.some((f) => f.id === x.fridgeId));
  const done = new Set(rs.map((x) => x.fridgeId + x.slot)).size, exp = fr.length * 2, bad = rs.filter((x) => x.ok === false).length;
  let al = 0; try { al = alMerge(D, alCfg(r), r.id === S.rid && DB.mode === "demo" ? { ...alSeenMap(r.id), ...(AL.demoSeen || {}) } : alSeenMap(r.id)).filter((a) => !a.seen).length; } catch (e) {}
  return { conf: rs.length ? Math.round((rs.length - bad) / rs.length * 100) : null, done: Math.min(done, exp), exp, al, fr: fr.length };
}
const alRing = (p, lv) => { const R = 26, C = 2 * Math.PI * R, v = p == null ? 0 : p; return `<svg class="al-ring ${lv}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${R}" class="bg"/><circle cx="32" cy="32" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - v / 100)}"/></svg>`; };
VIEWS.sites = {
  render() {
    alWatch(); if (DB.mode === "demo") alSeedSites();
    const list = S.restos.slice().sort((a, b) => (a.id === S.rid ? -1 : b.id === S.rid ? 1 : (a.name || "").localeCompare(b.name || "", "fr")));
    const card = (r, i) => {
      const st = alSiteStat(r), cur = r.id === S.rid, lv = !st || st.conf == null ? "neu" : st.conf >= 95 ? "ok" : st.conf >= 80 ? "warn" : "bad";
      return `<div class="glass al-site st${cur ? " cur" : ""}" style="--i:${i + 2}" ${cur ? `data-go="alertes"` : `data-act="alSitePick" data-id="${esc(r.id)}"`} role="button" tabindex="0" aria-label="${cur ? "Voir les alertes de" : "Ouvrir"} ${esc(r.name)}">
        <div class="al-sh">${restoMark(46, r, `<span class="al-mono">${esc(initials(r.name))}</span>`)}<div class="al-sn"><b>${esc(r.name)}</b><em>${cur ? "Ouvert en ce moment" : "Toucher pour ouvrir"}</em></div>${cur ? `<span class="pill acc">Ici</span>` : `<span class="al-open">${ico("chev")}</span>`}</div>
        ${st ? `<div class="al-sg">
          <div class="al-sk al-conf">${alRing(st.conf, lv)}<span class="al-cv">${st.conf == null ? "–" : st.conf + "<small>%</small>"}</span><em>Conformité</em></div>
          <div class="al-sk"><span class="al-num">${st.done}<small>/${st.exp}</small></span><em>Relevés</em></div>
          <div class="al-sk ${st.al ? "hot" : ""}"><span class="al-num">${st.al}</span><em>${st.al > 1 ? "Alertes" : "Alerte"}</em></div></div>`
        : `<div class="al-sg al-load"><span></span><span></span><span></span></div>`}</div>`;
    };
    const add = alAdmin() || !S.restos.length ? (S.restos.length > 1
      ? `<button class="al-addsite st" style="--i:${list.length + 2}" data-act="alSiteAdd">${ico("plus")}Ajouter un établissement</button>`
      : `<div class="glass al-invite st" style="--i:3"><span class="al-ic vio">${ico("store")}</span><b class="h3">Un deuxième restaurant ?</b><span class="sub">Suivez-les tous ici, d'un coup d'œil.</span><button class="btn acc" data-act="alSiteAdd">${ico("plus")}Ajouter un établissement</button></div>`) : "";
    return `<div class="inner narrow al">${topBar("Mes établissements")}<div class="al-sites">${list.map(card).join("")}</div>${add}</div>`;
  },
};
Object.assign(ACT, {
  alSitePick: (a, id) => { if (!id || id === S.rid) return; SFX.tap(); buzz(6); if (typeof ACT.restoPick === "function") ACT.restoPick(a, id); else if (typeof ACT.restoSwitch === "function") ACT.restoSwitch(a); AL.watched = null; setTimeout(alTick, 200); },
  alSiteAdd: (a) => { SFX.tap(); if (typeof ACT.restoSwitch === "function") { ACT.restoSwitch(a); setTimeout(() => { const i = $("#newResto"); if (i) try { i.focus(); } catch (e) {} }, 350); } },
});
