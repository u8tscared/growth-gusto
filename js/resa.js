/* Growth Gusto — area: réservations (route « resa »). Prefix « rs ».
   Day view per service (timeline of covers per slot + list grouped by time), week strip, one-tap « arrivé », a 10-second « Nouvelle
   réservation » sheet made for a phone call, an optional floor plan (tables, zones, free / booked / seated), capacity settings and
   the public booking link (copy, QR poster, website snippet). The public page lives in reserver/ (no account needed).
   Data:
     restos/{rid}/bookings/{id}  { date:"YYYY-MM-DD", time:"HH:MM", covers, name, phone?, email?, notes?, table?, status, source, createdAt, by?, at?, seen? }
                                 status: "avenir" | "en ligne" (created by the public page) | "arrive" | "noshow" | "annule"
                                 source: "tel" (in the app) | "web" (public page) | "zenchef", "thefork"… (js/resaimport.js, with ext { p, id?, by })
     restos/{rid}.resaCfg        { services:[{id,name,from,to,days:[0..6]}], slot, maxPerSlot, maxService, closures:[{from,to}], online, lead, maxOnline,
                                   horizon, msg, address, phone, photo, tables:[{id,n,seats,zone}] }   (gérant)
     restos/{rid}/public/resa    projection read by the public page, written here by any member (see rsSync): name, address, cfg,
                                 per-day booked covers per slot { days: { "2026-11-06": { "12:30": 6 } } } — never a client's personal data.
   Server (functions/src/resa.js, optional): e-mail confirmation through Brevo once S.resto.server.resa is true.
   Exposed: window.RESA = { today() → {covers, count}, unseen() → n, cfg() }, rsCfg(), rsSlots(). */
"use strict";

TAB_OF.resa = "more";
Object.assign(IC, {
  resa: ["M8 2v4", "M16 2v4", "r:3,4,18,18,2", "M3 10h18", "f:M3 10h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M8 15.5h8", "M10 15.5v3", "M14 15.5v3"],
  rsPhone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"],
  rsTable: ["f:M3 8h18v3H3z", "M3 8h18v3H3z", "M6 11v9", "M18 11v9", "M8 4h8"],
  rsLink: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  rsCopy: ["r:8,8,14,14,2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  rsCode: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  rsWeb: ["c:12,12,10", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  rsBell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0", "f:M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"],
  rsNote: ["M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z", "M15 3v6h6"],
  rsSeat: ["c:12,7,4", "M5 21v-2a7 7 0 0 1 14 0v2", "f:M5 21v-2a7 7 0 0 1 14 0v2z"],
  rsMail: ["r:2,4,20,16,2", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  rsHelp: ["c:12,12,10", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  rsStar: ["M11.52 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z", "f:M11.52 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"],
});

/* ───────── constants + config ───────── */
/* stored values (old ones keep working): "avenir" / "en ligne" / "confirme" = confirmée, "avalider" = demande à valider,
   "attente" = liste d'attente, "arrive", "noshow", "annule" (+ cancelledBy "client" | "resto"), "refuse" */
const RS_ST = {
  avenir: { t: "Confirmée", k: "av" },
  "en ligne": { t: "Confirmée", k: "av" },
  confirme: { t: "Confirmée", k: "av" },
  avalider: { t: "À valider", k: "va" },
  attente: { t: "Liste d'attente", k: "wl" },
  arrive: { t: "Arrivée", k: "ok" },
  noshow: { t: "No-show", k: "ns" },
  annule: { t: "Annulée", k: "an" },
  refuse: { t: "Refusée", k: "an" },
};
const RS_DSH = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const RS_DL = ["D", "L", "M", "M", "J", "V", "S"];
const RS_WEEK = [1, 2, 3, 4, 5, 6, 0];
const RS_ZONES = { salle: "Salle", terrasse: "Terrasse" };
const rsLive = (b) => b && !["annule", "noshow", "refuse", "attente"].includes(b.status);
const rsConf = (b) => b && ["avenir", "en ligne", "confirme"].includes(b.status || "avenir");
const rsSrv = () => !!(S.resto && S.resto.server && S.resto.server.resa);
/* client file key: the phone's last 9 digits (06 12 34 56 78, +33 6 12 34 56 78 and 0612345678 are the same person) */
const rsPk = (ph) => { const d = String(ph || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-9) : ""; };
const rsWeb = (b) => b && (b.source === "web" || b.status === "en ligne");
const rsDefCfg = () => ({
  services: [{ id: "midi", name: "Midi", from: "12:00", to: "13:45", days: [1, 2, 3, 4, 5, 6] }, { id: "soir", name: "Soir", from: "19:00", to: "21:45", days: [2, 3, 4, 5, 6] }],
  slot: 15, maxPerSlot: 16, maxService: 0, closures: [], online: false, validate: false, waitlist: true, lead: 2, maxOnline: 8, horizon: 60, msg: "", address: "", phone: "", photo: "", tables: [],
});
function rsCfg() {
  const c = (S.resto && S.resto.resaCfg) || {}, d = rsDefCfg();
  const o = { ...d, ...c };
  o.services = Array.isArray(c.services) && c.services.length ? c.services.map((s) => ({ ...s, days: Array.isArray(s.days) ? s.days : [0, 1, 2, 3, 4, 5, 6] })) : d.services;
  o.tables = Array.isArray(c.tables) ? c.tables : []; o.closures = Array.isArray(c.closures) ? c.closures : [];
  ["slot", "maxPerSlot", "maxService", "lead", "maxOnline", "horizon"].forEach((k) => { o[k] = +o[k] || 0; });
  if (![15, 30, 60].includes(o.slot)) o.slot = 15; if (o.maxOnline < 1) o.maxOnline = 8; if (o.horizon < 1) o.horizon = 60;
  return o;
}
const R = { clients: [], cc: {}, rows: null, rid: null, pub: null, pubSeen: false, day: null, svc: null, view: "list", known: null, fresh: new Set(), ed: null, ce: null, ctab: "h", pick: null, flash: null, demoPing: false, seenT: null };

/* ───────── time helpers ───────── */
const rsMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
const rsHm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const rsDow = (k) => parseDay(k).getDay();
const rsLong = (k) => { const d = parseDay(k); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const rsRel = (k) => { const n = daysUntil(k); return n === 0 ? "Aujourd'hui" : n === 1 ? "Demain" : n === -1 ? "Hier" : ""; };
const rsShort = (k) => { const d = parseDay(k); return `${RS_DSH[d.getDay()]} ${d.getDate()}`; };
const rsMonday = (k) => addDays(k, -((rsDow(k) + 6) % 7));
const rsPl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
function rsClosed(cfg, k) { return (cfg.closures || []).some((c) => c && c.from && k >= c.from && k <= (c.to || c.from)); }
/* services open that day (weekday + no closure) */
function rsSvcsOn(cfg, k) { if (rsClosed(cfg, k)) return []; const w = rsDow(k); return cfg.services.filter((s) => (s.days || []).includes(w)); }
/* slot start times of a service: from … to (last seating), every cfg.slot minutes */
function rsSlots(cfg, s) { const out = [], a = rsMin(s.from), b = Math.max(a, rsMin(s.to)), st = cfg.slot || 15; for (let m = a; m <= b; m += st) out.push(rsHm(m)); return out; }
/* the service a time belongs to (the open ones of the day first, else any) */
function rsSvcOf(cfg, k, time) {
  const list = rsSvcsOn(cfg, k).length ? rsSvcsOn(cfg, k) : cfg.services, m = rsMin(time);
  let best = list[0], bd = 1e9;
  list.forEach((s) => { const a = rsMin(s.from), b = rsMin(s.to) + (cfg.slot || 15); const d = m >= a && m < b ? 0 : Math.min(Math.abs(m - a), Math.abs(m - b)); if (d < bd) { bd = d; best = s; } });
  return best;
}
/* the slot key a booking counts in (a phone booking at 12:40 counts in the 12:30 slot) */
function rsBucket(cfg, k, time) { const s = rsSvcOf(cfg, k, time); if (!s) return time; const a = rsMin(s.from), st = cfg.slot || 15, m = rsMin(time); return rsHm(m < a ? a : a + Math.floor((m - a) / st) * st); }

/* ───────── data ───────── */
const rsRows = () => (R.rid === S.rid && R.rows) || [];
const rsOfDay = (k) => rsRows().filter((b) => b.date === k).sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : (a.createdAt || 0) - (b.createdAt || 0)));
const rsCovers = (list) => list.filter(rsLive).reduce((n, b) => n + (+b.covers || 0), 0);
function rsUsed(cfg, k, exceptId) { const m = {}; rsOfDay(k).forEach((b) => { if (!rsLive(b) || b.id === exceptId) return; const t = rsBucket(cfg, k, b.time); m[t] = (m[t] || 0) + (+b.covers || 0); }); return m; }
function rsWatch() {
  if (!S.rid || R.rid === S.rid) return; R.rid = S.rid; R.rows = null; R.known = null; R.pub = null; R.pubSeen = false; R.fresh = new Set(); R.clients = []; R.cc = {};
  const rid = S.rid;
  if (DB.mode === "demo") rsSeedDemo();
  DB.watch("bookings", { order: "date", dir: "desc", limit: 3000 }, (rows) => { if (S.rid !== rid) return; rsOnRows(rows); });
  DB.watch("clients", {}, (rows) => { if (S.rid !== rid) return; R.clients = rows; onData(); });
  if (DB.mode === "db") DB.watch("public", {}, (rows) => { if (S.rid !== rid) return; R.pub = rows.find((r) => r.id === "resa") || null; R.pubSeen = true; rsSync(); });
}
function rsOnRows(rows) {
  const first = !R.known; R.rows = rows;
  if (first) { R.known = new Set(rows.map((r) => r.id)); rows.forEach((b) => { if (b.clientChange) R.cc[b.id] = b.clientChange.at; }); }
  else rows.forEach((b) => {
    const cc = b.clientChange && b.clientChange.at; if (cc && R.cc[b.id] !== cc) { const was = R.cc[b.id]; R.cc[b.id] = cc; if (was !== undefined || R.known.has(b.id)) rsClientAlert(b); }
    if (R.known.has(b.id)) return; R.known.add(b.id); if (rsWeb(b) && !b.seen) rsAlert(b);
  });
  rsSync(); rsBadge(); onData();
  if (typeof plOnRows === "function") plOnRows(); /* js/plan.js: new bookings take the best table */
  if (S.route === "resa") rsMarkSeen();
}
/* a new online booking: chime, toast, the app-wide alert feed (js/alertes.js when present), badge in the side nav */
function rsAlert(b) {
  R.fresh.add(b.id);
  const txt = `${b.name || "Client"} · ${+b.covers || 0} pers. · ${(rsRel(b.date) || rsShort(b.date)).toLowerCase()} ${b.time}`;
  try { SFX.init(); SFX.tone(1319, 0.32, "sine", 0.05); SFX.tone(1047, 0.5, "sine", 0.045, 0.24); buzz([18, 60, 18]); } catch (e) {}
  const head = b.status === "avalider" ? "Demande à valider" : b.status === "attente" ? "Liste d'attente" : "Réservation en ligne";
  toast(`${head} : ${txt}`, "info");
  try { if (window.ALERTES && typeof window.ALERTES.push === "function") window.ALERTES.push({ type: "resa", key: "resa_" + b.id, level: "warn", text: b.status === "avalider" ? "Nouvelle demande de réservation à valider" : b.status === "attente" ? "Nouvelle inscription sur liste d'attente" : "Nouvelle réservation en ligne", sub: txt, day: b.date, route: "resa" }); } catch (e) {}
}
/* the client changed or cancelled from their own page (the server already raised the alert) */
function rsClientAlert(b) {
  R.fresh.add(b.id);
  try { SFX.init(); SFX.tone(1047, 0.3, "sine", 0.045); SFX.tone(784, 0.45, "sine", 0.04, 0.22); buzz([18, 60, 18]); } catch (e) {}
  toast(`${firstName(b.name) || "Un client"} a ${b.status === "annule" ? "annulé" : "modifié"} sa réservation · ${b.covers} pers. ${(rsRel(b.date) || rsShort(b.date)).toLowerCase()} ${b.time}`, "info");
}
const rsPending = () => { const t = dayKey(); return rsRows().filter((b) => b.status === "avalider" && b.date >= t).sort((a, b) => (a.date + a.time > b.date + b.time ? 1 : -1)); };
const rsUnseen = () => rsRows().filter((b) => (rsWeb(b) && !b.seen && (rsLive(b) || b.status === "attente")) || (b.status === "avalider" && b.date >= dayKey())).length;
function rsMarkSeen() {
  clearTimeout(R.seenT);
  R.seenT = setTimeout(() => { if (S.route !== "resa") return; rsRows().filter((b) => rsWeb(b) && !b.seen).forEach((b) => { R.fresh.add(b.id); DB.update("bookings", b.id, { seen: true }).catch(() => {}); }); }, 1800);
}
/* side nav badge: re-applied after every chrome render */
function rsBadge() {
  const n = rsUnseen(); const el = document.querySelector('#side .nav[data-go="resa"]'); if (!el) return;
  let c = el.querySelector(".rs-cnt"); if (!n) { if (c) c.remove(); return; }
  if (!c) { c = document.createElement("span"); c.className = "count rs-cnt"; el.appendChild(c); } if (c.textContent !== String(n)) c.textContent = n;
}
try { const sd = document.getElementById("side"); if (sd) new MutationObserver(() => { if (R.rows) rsBadge(); rsBrandSync(); }).observe(sd, { childList: true }); } catch (e) {}

/* ───────── public projection (restos/{rid}/public/resa), written by any member's app ───────── */
/* the restaurant logo shown on the booking page: Réglages › Logo (data: or https URL), kept to a sane size for the public doc */
const rsLogo = () => { const l = typeof restoLogo === "function" ? restoLogo(S.resto) : (S.resto && S.resto.logo) || ""; return typeof l === "string" && /^(data:image\/|https:\/\/)/.test(l) && l.length <= 200000 ? l : ""; };
/* the logo or the name changed (Réglages, onboarding, another device) while the Réservations screen is not open:
   patch just those two keys of the public doc, so the booking page follows without waiting for the next full sync */
const rsBrandSync = debounce(() => {
  if (DB.mode !== "db" || !DB.db || !S.rid || !S.resto || !S.resto.resaCfg) return;
  const sig = S.rid + "|" + (S.resto.name || "") + "|" + rsLogo();
  if (R.brandRid !== S.rid) { R.brandRid = S.rid; R.brandSig = sig; return; } /* first look at this restaurant: nothing changed yet */
  if (sig === R.brandSig) return; R.brandSig = sig;
  if (R.rid === S.rid && R.pubSeen && R.rows) { rsSync(); return; }
  DB.db.doc(`restos/${S.rid}/public/resa`).update({ name: S.resto.name || "", logo: rsLogo(), updatedAt: Date.now() }).catch((e) => console.warn("resa public brand", e && e.code));
}, 1500);
function rsPubDoc() {
  const cfg = rsCfg(), today = dayKey(), end = addDays(today, cfg.horizon + 1), days = {};
  rsRows().forEach((b) => { if (!rsLive(b) || !b.date || b.date < today || b.date > end) return; const t = rsBucket(cfg, b.date, b.time); (days[b.date] ||= {})[t] = (days[b.date][t] || 0) + (+b.covers || 0); });
  return {
    v: 1, name: (S.resto && S.resto.name) || "", logo: rsLogo(), address: cfg.address || "", phone: cfg.phone || "", photo: cfg.photo || "", msg: cfg.msg || "",
    mail: !!(S.resto && S.resto.server && S.resto.server.resa),
    cfg: { services: cfg.services.map((s) => ({ id: s.id, name: s.name, from: s.from, to: s.to, days: s.days })), slot: cfg.slot, maxPerSlot: cfg.maxPerSlot, maxService: cfg.maxService,
      closures: cfg.closures.filter((c) => c && (c.to || c.from) >= today), online: !!cfg.online, validate: !!cfg.validate, waitlist: cfg.waitlist !== false, lead: cfg.lead, maxOnline: cfg.maxOnline, horizon: cfg.horizon },
    days,
    ...(typeof plPubFit === "function" ? plPubFit(cfg) : {}), /* js/plan.js: biggest party each slot can still seat */
  };
}
const rsSig = (d) => { if (!d) return ""; const { updatedAt, last, id, ...x } = d; const norm = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o).sort().reduce((a, k) => { a[k] = norm(o[k]); return a; }, {}) : Array.isArray(o) ? o.map(norm) : o); return JSON.stringify(norm(x)); };
const rsSync = debounce(() => {
  if (DB.mode !== "db" || !DB.db || !S.rid || !S.resto || !S.resto.resaCfg || !R.pubSeen || !R.rows) return;
  const doc = rsPubDoc(); if (rsSig(doc) === rsSig(R.pub)) return;
  doc.updatedAt = Date.now(); R.pub = { id: "resa", ...doc };
  DB.db.doc(`restos/${S.rid}/public/resa`).set(DB.clean(doc)).catch((e) => console.warn("resa public", e && e.code));
}, 1200);

/* ───────── link ───────── */
function rsBase() { const h = location.hostname; if (/growthgusto\.fr$|github\.io$/.test(h) || location.protocol === "file:") return "https://app.growthgusto.fr/reserver/"; return new URL("reserver/", location.href.split("?")[0].split("#")[0]).href; }
const rsUrl = () => rsBase() + "?r=" + encodeURIComponent(DB.mode === "demo" ? "demo" : S.rid || "");
const rsCanOnline = () => DB.mode === "db" || DB.mode === "demo";
const rsMgr = () => { try { if (DB.mode === "demo") return true; if (typeof PERMS !== "undefined" && PERMS.isAdmin) return !!PERMS.isAdmin(); } catch (e) {} return myRole() === "gerant"; };
async function rsCopy(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) {}
  try { const t = document.createElement("textarea"); t.value = txt; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0;left:-9999px"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch (e) { return false; }
}
const rsQr = (txt) => (typeof qrSvg === "function" ? qrSvg(txt) : "");

/* ───────── view ───────── */
VIEWS.resa = {
  render() {
    rsWatch();
    const cfg = rsCfg(), today = dayKey();
    if (!R.day) R.day = (S.params && S.params.day) || today;
    const day = R.day, svcs = rsDaySvcs(cfg, day), all = rsOfDay(day);
    if (!R.svc || !svcs.find((s) => s.id === R.svc)) R.svc = rsDefaultSvc(cfg, day, svcs);
    const svc = svcs.find((s) => s.id === R.svc) || null;
    const mine = svc ? all.filter((b) => rsSvcOf(cfg, day, b.time).id === svc.id) : all;
    const mgr = rsMgr();
    const right = `<button class="btn acc sm rs-newtop" data-act="rsNew">${ico("plus")}<span>Nouvelle réservation</span></button>` + (mgr ? `<button class="iconbtn" data-act="rsCfgOpen" aria-label="Réglages des réservations" title="Réglages">${ico("sliders")}</button>` : "");
    const loading = !R.rows;
    const body = loading ? `<div class="glass rs-skel st" style="--i:3"><i></i><i></i><i></i></div>` : R.view === "plan" && (cfg.tables.length || (mgr && typeof plLive === "function")) ? rsPlan(cfg, day, svc, mine) : rsList(cfg, day, svc, mine);
    const liveM = mine.filter(rsLive), arr = liveM.filter((b) => b.status === "arrive").length;
    const sw = cfg.tables.length || (mgr && typeof plLive === "function") ? `<div class="rs-sw" role="tablist">
        <button class="${R.view !== "plan" ? "on" : ""}" data-act="rsView" data-v="list" role="tab" aria-selected="${R.view !== "plan"}">${ico("list")}Liste</button>
        <button class="${R.view === "plan" ? "on" : ""}" data-act="rsView" data-v="plan" role="tab" aria-selected="${R.view === "plan"}">${ico("rsTable")}Plan de salle</button></div>` : "";
    const prog = liveM.length ? `<span class="rs-prog" aria-label="${arr} tables arrivées sur ${liveM.length}"><i style="--p:${Math.round((arr / liveM.length) * 100)}%"></i><b>${arr}/${liveM.length}</b> arrivé${arr > 1 ? "s" : ""}</span>` : "";
    const tools = sw || prog ? `<div class="rs-tools st" style="--i:3">${sw}${prog}</div>` : "";
    return `<div class="inner wide rs">${topBar("Réservations", { right })}
      <div class="rs-grid"><div class="rs-main">
        ${loading ? "" : rsReqPanel(cfg)}
        ${rsStrip(cfg, day)}
        ${rsHero(cfg, day, svcs, svc, all, mine)}
        ${tools}
        ${body}
      </div><aside class="rs-side">${rsLinkCard(cfg)}${typeof rzCardHTML === "function" ? rzCardHTML(cfg) : ""}</aside></div>
      <div class="ctabar rs-cta"><button class="btn acc block rs-new" data-act="rsNew">${ico("plus")}Nouvelle réservation</button></div>
    </div>`;
  },
  after(v) {
    rsMarkSeen();
    if (R.flash) { const el = v.querySelector(`[data-card="${R.flash}"]`); R.flash = null; if (el) { el.classList.add("rs-flash"); setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }, 120); } }
    const st = v.querySelector(".rs-strip .on"); if (st && st.parentElement.scrollWidth > st.parentElement.clientWidth) st.parentElement.scrollLeft = st.offsetLeft - 60;
    if (DB.mode === "demo" && !R.demoPing) { R.demoPing = true; setTimeout(rsDemoPing, 16000); }
  },
};
function rsDaySvcs(cfg, k) { const open = rsSvcsOn(cfg, k); const ids = new Set(open.map((s) => s.id)); rsOfDay(k).forEach((b) => ids.add(rsSvcOf(cfg, k, b.time).id)); return cfg.services.filter((s) => ids.has(s.id)); }
function rsDefaultSvc(cfg, k, svcs) {
  if (!svcs.length) return null;
  if (k === dayKey()) { const m = new Date().getHours() * 60 + new Date().getMinutes(); const s = svcs.find((x) => m < rsMin(x.to) + 90); return (s || svcs[svcs.length - 1]).id; }
  return svcs[0].id;
}
function rsStrip(cfg, day) {
  const mon = rsMonday(day), today = dayKey();
  const cells = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).map((k) => {
    const n = rsCovers(rsOfDay(k)), closed = !rsSvcsOn(cfg, k).length;
    return `<button class="${k === day ? "on" : ""}${k === today ? " today" : ""}${closed && !n ? " closed" : ""}" data-act="rsDay" data-v="${k}" aria-label="${esc(rsLong(k))}${n ? `, ${n} couverts` : ""}">
      <em>${RS_DSH[parseDay(k).getDay()].replace(".", "")}</em><b>${parseDay(k).getDate()}</b><i>${n ? n : closed ? "fermé" : "–"}</i></button>`;
  }).join("");
  const wk = mon === rsMonday(today);
  return `<div class="rs-week st" style="--i:1">
    <button class="iconbtn" data-act="rsWeek" data-v="-7" aria-label="Semaine précédente">${ico("back")}</button>
    <div class="rs-strip">${cells}</div>
    <button class="iconbtn" data-act="rsWeek" data-v="7" aria-label="Semaine suivante">${ico("chev")}</button>
  </div>${wk || day === today ? "" : `<button class="rs-today st" style="--i:1" data-act="rsDay" data-v="${today}">Revenir à aujourd'hui</button>`}`;
}
function rsHero(cfg, day, svcs, svc, all, mine) {
  const n = rsCovers(all), cnt = all.filter(rsLive).length, rel = rsRel(day);
  const tabs = svcs.length ? `<div class="rs-svcs" role="tablist">${svcs.map((s) => { const c = rsCovers(all.filter((b) => rsSvcOf(cfg, day, b.time).id === s.id)); return `<button class="${svc && s.id === svc.id ? "on" : ""}" data-act="rsSvc" data-v="${esc(s.id)}" role="tab" aria-selected="${svc && s.id === svc.id}"><span>${esc(s.name)}</span><b>${c}</b></button>`; }).join("")}</div>` : "";
  let tl = "";
  if (svc) {
    const slots = rsSlots(cfg, svc), used = rsUsed(cfg, day), max = Math.max(cfg.maxPerSlot || 1, ...slots.map((t) => used[t] || 0), 1);
    const now = day === dayKey() ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
    tl = `<div class="rs-tl" style="--n:${slots.length}">${cfg.maxPerSlot ? `<span class="rs-cap" style="bottom:calc(20px + ${(cfg.maxPerSlot / max).toFixed(3)} * (100% - 20px))"><i>${cfg.maxPerSlot}</i></span>` : ""}${slots.map((t, i) => {
      const c = used[t] || 0, over = cfg.maxPerSlot && c > cfg.maxPerSlot, h = c ? Math.max(8, (c / max) * 100) : 0, past = now >= 0 && rsMin(t) + (cfg.slot || 15) <= now;
      return `<button class="rs-bar${c ? "" : " z"}${over ? " over" : ""}${past ? " past" : ""}" data-act="rsJump" data-v="${t}" data-rsdrop="${t}" style="--h:${h}%;--j:${i}" aria-label="${t} : ${c} couverts"><span class="rs-bv">${c ? `<b>${c}</b>` : ""}<i></i></span><em>${t.endsWith(":00") || i === 0 ? t.replace(":00", "h") : ""}</em></button>`;
    }).join("")}</div>`;
  }
  const closedNote = !rsSvcsOn(cfg, day).length ? `<div class="rs-closed">${rsClosed(cfg, day) ? "Fermeture exceptionnelle" : "Fermé ce jour-là"}</div>` : "";
  return `<div class="rs-hero wall st" style="--i:2">
    <div class="rs-ht"><span>${esc(rel || rsLong(day).replace(/^./, (c) => c.toUpperCase()))}</span>${rel ? `<em>${esc(rsLong(day))}</em>` : ""}</div>
    <div class="rs-big"><b class="rs-n" data-n="${n}">${n}</b><span>couvert${n > 1 ? "s" : ""}<em>${cnt ? rsPl(cnt, "réservation") : "aucune réservation"}</em></span></div>
    ${closedNote}${tabs}${tl}
  </div>`;
}
function rsNoteKind(t) { return /allerg|intol[ée]r|sans gluten|c[œoe]liaq|arachide|fruits? [àa] coque|lactose|crustac|vegan|v[ée]g[ée]/i.test(t || "") ? "al" : ""; }
function rsCard(b, cfg, i) {
  const st = RS_ST[b.status] || RS_ST.avenir, tb = b.table && cfg.tables.find((t) => t.id === b.table);
  const nk = rsNoteKind(b.notes), web = rsWeb(b), fresh = web && (R.fresh.has(b.id) || !b.seen);
  const live = rsLive(b) && b.status !== "avalider", cs = rsStatOf(b.phone), cl = rsClientOf(b.phone);
  const btn = b.status === "avalider" ? `<span class="rs-stp va">À valider</span>` : live ? `<button class="rs-arr ${b.status === "arrive" ? "on" : ""}" data-act="rsArr" data-id="${esc(b.id)}" aria-pressed="${b.status === "arrive"}" aria-label="${b.status === "arrive" ? "Arrivé, toucher pour annuler" : "Marquer arrivé"}">${ico("check")}<span>${b.status === "arrive" ? "Arrivé" : "Arrivé ?"}</span></button>`
    : `<span class="rs-stp ${st.k}">${st.t}</span>`;
  return `<div class="rs-card s-${st.k}${fresh ? " fresh" : ""} st" style="--i:${Math.min(i + 4, 14)}" data-card="${esc(b.id)}" data-rsdrag="${esc(b.id)}" draggable="true">
    <button class="rs-hit" data-act="rsOpen" data-id="${esc(b.id)}" aria-label="${esc(b.name || "Réservation")}, ${+b.covers || 0} personnes à ${b.time}"></button>
    <span class="rs-cv"><b>${+b.covers || 0}</b><i>pers.</i></span>
    <span class="rs-tx"><b>${esc(b.name || "Sans nom")}</b>
      <em>${cl && cl.vip ? `<span class="rs-vip">VIP</span>` : ""}${cs && cs.noshow ? `<span class="rs-nsw">${rsPl(cs.noshow, "no-show")}</span>` : ""}${tb ? `<span class="rs-tbl">T${esc(typeof plLabel === "function" ? plLabel(b, cfg) || tb.n : tb.n)}</span>` : ""}${web ? `<span class="rs-web">${fresh ? "Nouveau · " : ""}en ligne</span>` : ""}${typeof rzBadge === "function" ? rzBadge(b) : ""}${b.phone ? `<span>${esc(b.phone)}</span>` : ""}</em>
      ${b.notes ? `<span class="rs-note ${nk}">${nk ? ico("alert") : ""}${esc(b.notes)}</span>` : ""}</span>
    ${btn}
  </div>`;
}
function rsList(cfg, day, svc, all) {
  const mine = all.filter((b) => b.status !== "attente"), wait = all.filter((b) => b.status === "attente");
  const wl = wait.length ? `<section class="glass rs-wait st" style="--i:6"><div class="rs-wh">${ico("clock")}<b>Liste d'attente</b><span>${rsPl(wait.length, "demande")}</span></div>
    ${wait.map((b) => { const cs = rsStatOf(b.phone); return `<div class="rs-wr"><button class="rs-wn" data-act="rsOpen" data-id="${esc(b.id)}"><b>${b.time} · ${esc(b.name || "")}</b><em>${+b.covers || 0} pers.${b.phone ? ` · ${esc(b.phone)}` : ""}${cs && cs.visits ? ` · ${rsPl(cs.visits, "visite")}` : ""}</em></button>
      <button class="btn acc sm" data-act="rsPromote" data-id="${esc(b.id)}">Proposer la table</button></div>`; }).join("")}</section>` : "";
  if (!mine.length) {
    if (wait.length) return wl;
    const closed = !rsSvcsOn(cfg, day).length;
    return `<div class="glass rs-empty st" style="--i:4">${rsEmptyArt()}<b>${closed ? "Pas de service ce jour-là" : `Aucune réservation${svc ? ` ${svc.name.toLowerCase() === "midi" ? "ce midi" : svc.name.toLowerCase() === "soir" ? "ce soir" : "pour ce service"}` : ""}`}</b><span>${closed ? "Vous pouvez quand même noter une table." : "Le téléphone sonne ? Un bouton, dix secondes."}</span></div>`;
  }
  const groups = []; mine.forEach((b) => { const t = b.time; let g = groups.find((x) => x.t === t); if (!g) groups.push((g = { t, list: [] })); g.list.push(b); });
  let i = 0;
  return `<div class="rs-list">${groups.map((g) => { const c = rsCovers(g.list); return `<section class="rs-grp" id="rs-g-${g.t.replace(":", "")}" data-rsdrop="${g.t}">
    <div class="rs-gh st" style="--i:${Math.min(i + 4, 14)}"><b>${g.t}</b><span>${c ? rsPl(c, "couvert") : "—"}</span></div>
    ${g.list.map((b) => rsCard(b, cfg, i++)).join("")}</section>`; }).join("")}</div>${wl}`;
}
/* requests waiting for the restaurant's answer (validation mode), always on top, every date */
function rsReqPanel(cfg) {
  const L = rsPending(); if (!L.length) return "";
  return `<section class="rs-reqs st" style="--i:1"><div class="rs-rqh"><span class="rs-rqn">${L.length}</span><b>${L.length > 1 ? "Demandes à valider" : "Demande à valider"}</b></div>
    ${L.slice(0, 6).map((b) => { const cs = rsStatOf(b.phone), cl = rsClientOf(b.phone), nk = rsNoteKind(b.notes); return `<div class="rs-req" data-card="${esc(b.id)}">
      <button class="rs-rqi" data-act="rsOpen" data-id="${esc(b.id)}"><span class="rs-cv"><b>${+b.covers || 0}</b><i>pers.</i></span>
        <span class="rs-tx"><b>${esc(b.name || "")}</b><em><span class="rs-rqd">${esc((rsRel(b.date) || rsShort(b.date)))} · ${b.time}</span>${cl && cl.vip ? `<span class="rs-vip">VIP</span>` : ""}${cs && cs.visits ? `<span>${rsPl(cs.visits, "visite")}</span>` : ""}${cs && cs.noshow ? `<span class="rs-nsw">${rsPl(cs.noshow, "no-show")}</span>` : ""}${rsFdTags(b)}</em>
        ${b.notes ? `<span class="rs-note ${nk}">${nk ? ico("alert") : ""}${esc(b.notes)}</span>` : ""}</span></button>
      <div class="rs-rqb"><button class="btn soft" data-act="rsRefuse" data-id="${esc(b.id)}">${ico("x")}Refuser</button><button class="btn acc" data-act="rsAccept" data-id="${esc(b.id)}">${ico("check")}Accepter</button></div>
    </div>`; }).join("")}${L.length > 6 ? `<p class="rs-lp">+ ${L.length - 6} autres demandes</p>` : ""}</section>`;
}
/* client file: restos/{rid}/clients/{phone key} { name, phone, email?, vip?, notes? } + what the bookings say */
const rsClientOf = (ph) => { const k = rsPk(ph); return k ? R.clients.find((c) => c.id === k) || null : null; };
let rsStatMemo = { src: null, map: null };
function rsStats() {
  const rows = rsRows(); if (rsStatMemo.src === rows && rsStatMemo.map) return rsStatMemo.map;
  const m = {}, today = dayKey();
  rows.forEach((b) => { const k = rsPk(b.phone); if (!k) return; const x = (m[k] ||= { visits: 0, noshow: 0, cancel: 0, next: 0, last: "", list: [], name: b.name, phone: b.phone, email: "" });
    if (b.status === "arrive") { x.visits++; if (b.date > x.last) x.last = b.date; } else if (b.status === "noshow") x.noshow++; else if (b.status === "annule") x.cancel++; else if (rsLive(b) && b.date >= today) x.next++;
    if (!x.email && b.email) x.email = b.email; x.list.push(b); });
  Object.values(m).forEach((x) => x.list.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)));
  rsStatMemo = { src: rows, map: m }; return m;
}
const rsStatOf = (ph) => { const k = rsPk(ph); return k ? rsStats()[k] || null : null; };
function rsEmptyArt() {
  return `<svg class="rs-art" viewBox="0 0 160 92" aria-hidden="true"><ellipse cx="80" cy="84" rx="62" ry="6" fill="#EFE6D6"/>
    <rect x="34" y="40" width="92" height="10" rx="5" fill="#5B2BFF"/><rect x="44" y="50" width="6" height="32" rx="3" fill="#2A0BA6"/><rect x="110" y="50" width="6" height="32" rx="3" fill="#2A0BA6"/>
    <g class="rs-art-p"><circle cx="66" cy="33" r="6" fill="#fff" stroke="#1B1530" stroke-width="2.2"/><circle cx="94" cy="33" r="6" fill="#fff" stroke="#1B1530" stroke-width="2.2"/></g>
    <path d="M80 18v10" stroke="#F6B93B" stroke-width="3" stroke-linecap="round"/><path class="rs-art-f" d="M80 10c3 3 3 6 0 8-3-2-3-5 0-8z" fill="#F6B93B"/>
    <rect x="14" y="34" width="14" height="46" rx="6" fill="#FFFDF8" stroke="#DCCFB8" stroke-width="2"/><rect x="132" y="34" width="14" height="46" rx="6" fill="#FFFDF8" stroke="#DCCFB8" stroke-width="2"/></svg>`;
}
/* floor plan: tables of each zone, free / booked / seated for the selected service; tap a booking chip then a table to seat it */
function rsPlan(cfg, day, svc, mine) {
  if (typeof plLive === "function") return plLive(cfg, day, svc, mine); /* js/plan.js: the drawn floor plan + rotation */
  const live = mine.filter(rsLive); const noTable = live.filter((b) => !b.table || !cfg.tables.find((t) => t.id === b.table));
  const zones = Object.keys(RS_ZONES).filter((z) => cfg.tables.some((t) => (t.zone || "salle") === z));
  const pick = R.pick && live.find((b) => b.id === R.pick) ? R.pick : (R.pick = null);
  const tables = (z) => cfg.tables.filter((t) => (t.zone || "salle") === z).sort((a, b) => String(a.n).localeCompare(String(b.n), "fr", { numeric: true }));
  const cell = (t, j) => {
    const on = live.filter((b) => b.table === t.id).sort((a, b) => (a.time > b.time ? 1 : -1));
    const seated = on.find((b) => b.status === "arrive"), nxt = seated || on[0];
    const cls = seated ? "seated" : nxt ? "booked" : "free";
    const shape = (+t.seats || 2) <= 2 ? "r2" : (+t.seats || 2) >= 6 ? "r6" : "r4";
    return `<button class="rs-t ${cls} ${shape}${pick ? " can" : ""}" style="--j:${j}" data-act="rsTable" data-id="${esc(t.id)}" data-rsdropt="${esc(t.id)}" aria-label="Table ${esc(t.n)}, ${+t.seats || 0} places${nxt ? `, ${esc(nxt.name || "")} ${nxt.time}` : ", libre"}">
      <span class="rs-tn">${esc(t.n)}</span><span class="rs-ts">${+t.seats || 0} pl.</span>
      ${nxt ? `<span class="rs-tw"><b>${esc(firstName(nxt.name) || nxt.name || "")}</b><i>${nxt.time} · ${+nxt.covers || 0}p</i></span>` : ""}${on.length > 1 ? `<span class="rs-tplus">+${on.length - 1}</span>` : ""}
    </button>`;
  };
  let j = 0;
  return `<div class="glass rs-plan st" style="--i:4">
    <div class="rs-legend"><span class="l-free">Libre</span><span class="l-booked">Réservée</span><span class="l-seated">Installée</span></div>
    ${zones.map((z) => `<div class="rs-zone"><div class="rs-zh">${RS_ZONES[z]}</div><div class="rs-tables">${tables(z).map((t) => cell(t, j++)).join("")}</div></div>`).join("")}
    ${noTable.length ? `<div class="rs-unas"><div class="rs-zh">${pick ? "Touchez une table" : "Sans table"}</div><div class="rs-chips">${noTable.map((b) => `<button class="rs-chip${pick === b.id ? " on" : ""}" data-act="rsPick" data-id="${esc(b.id)}" data-rsdrag="${esc(b.id)}" draggable="true"><b>${b.time}</b>${esc(firstName(b.name) || b.name || "")}<i>${+b.covers || 0}p</i></button>`).join("")}</div></div>` : ""}
  </div>`;
}
function rsLinkCard(cfg) {
  const url = rsUrl(), on = cfg.online, mgr = rsMgr();
  if (!rsCanOnline()) {
    return `<div class="glass rs-link st" style="--i:5"><div class="rs-lh"><span class="ic">${ico("rsLink")}</span><div><b>Réservation en ligne</b><em>Vos clients réservent seuls, depuis votre site ou Instagram.</em></div></div>
      <p class="rs-lp">Disponible avec un compte Growth Gusto : vos réservations arrivent sur tous vos appareils.</p>
      <button class="btn soft sm block" data-act="auOpen">Créer mon compte</button></div>`;
  }
  return `<div class="glass rs-link st" style="--i:5">
    <div class="rs-lh"><span class="ic">${ico("rsLink")}</span><div><b>Votre lien de réservation</b><em>${on ? `<span class="rs-on y">Ouvert</span> vos clients réservent 24 h/24` : `<span class="rs-on">Fermé</span> la réservation en ligne est coupée`}</em></div></div>
    ${on ? `<button class="rs-url" data-act="rsCopyLink" title="Copier le lien"><span>${esc(url.replace(/^https?:\/\//, ""))}</span>${ico("rsCopy")}</button>
    <div class="rs-lb">
      <button class="rs-lbb" data-act="rsCopyLink">${ico("rsCopy")}<span>Copier</span></button>
      <button class="rs-lbb" data-act="rsQrOpen">${ico("qr")}<span>QR code</span></button>
      <button class="rs-lbb" data-act="rsSnip">${ico("rsCode")}<span>Votre site</span></button>
      <a class="rs-lbb" href="${esc(url)}" target="_blank" rel="noopener">${ico("rsWeb")}<span>Voir</span></a>
    </div>
    <div class="rs-tip">${ico("sparkle")}<span><b>Instagram</b> : collez le lien dans votre bio ou un bouton « Réserver ». <b>Google</b> : fiche d'établissement › Réservations › ajoutez le lien.</span></div>`
    : mgr ? `<button class="btn acc sm block" data-act="rsCfgOpen" data-v="w">${ico("rsWeb")}Ouvrir la réservation en ligne</button>` : `<p class="rs-lp">Le gérant peut l'ouvrir dans les réglages.</p>`}
  </div>`;
}

/* ───────── new / edit booking (made for a phone call) ───────── */
function rsEdOpen(b, preset = {}) {
  const cfg = rsCfg(), day = (b && b.date) || preset.date || R.day || dayKey();
  R.ed = b ? { id: b.id, date: b.date, time: b.time, covers: +b.covers || 2, name: b.name || "", phone: b.phone || "", email: b.email || "", notes: b.notes || "", table: b.table || "", svc: rsSvcOf(cfg, b.date, b.time).id, more: !!(b.notes || b.table || b.email) }
    : { id: null, date: day, time: preset.time || "", covers: 2, name: "", phone: "", email: "", notes: "", table: preset.table || "", svc: preset.svc || R.svc || (rsSvcsOn(cfg, day)[0] || cfg.services[0] || {}).id, more: !!preset.table };
  rsEdPaint(true);
}
function rsEdPaint(first) {
  const e = R.ed, cfg = rsCfg(); if (!e) return;
  const today = dayKey(); const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)); const custom = !dates.includes(e.date);
  let svcs = rsSvcsOn(cfg, e.date); if (!svcs.length) svcs = cfg.services;
  if (!svcs.find((s) => s.id === e.svc)) e.svc = svcs[0] && svcs[0].id;
  const svc = svcs.find((s) => s.id === e.svc) || svcs[0];
  const used = rsUsed(cfg, e.date, e.id), cap = cfg.maxPerSlot;
  const slots = svc ? rsSlots(cfg, svc) : []; if (e.time && svc && rsSvcOf(cfg, e.date, e.time).id === svc.id && !slots.includes(e.time)) slots.push(e.time), slots.sort();
  const nowM = e.date === today ? new Date().getHours() * 60 + new Date().getMinutes() - 30 : -1;
  const closed = !rsSvcsOn(cfg, e.date).length;
  const ok = e.name.trim().length >= 1 && !!e.time && e.covers >= 1;
  const tabs = cfg.tables.slice().sort((a, b) => String(a.n).localeCompare(String(b.n), "fr", { numeric: true }));
  const busyT = new Set(rsOfDay(e.date).filter((b) => rsLive(b) && b.id !== e.id && b.table && svc && rsSvcOf(cfg, e.date, b.time).id === svc.id).map((b) => b.table));
  const html = `<div class="rs-ed">
    <div class="rs-edh"><span class="h2">${e.id ? "Modifier la réservation" : "Nouvelle réservation"}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="rs-dates" role="group" aria-label="Jour">${dates.map((k, i) => `<button class="rs-dc${e.date === k ? " on" : ""}" data-act="rsEdDate" data-v="${k}"><em>${i === 0 ? "Auj." : i === 1 ? "Demain" : RS_DSH[parseDay(k).getDay()]}</em><b>${parseDay(k).getDate()}</b></button>`).join("")}
      <label class="rs-dc rs-dpick${custom ? " on" : ""}"><em>${custom ? RS_DSH[parseDay(e.date).getDay()] : "Autre"}</em><b>${custom ? parseDay(e.date).getDate() + "/" + pad(parseDay(e.date).getMonth() + 1) : ico("cal")}</b><input type="date" data-rsed="date" value="${e.date}" min="${addDays(today, -1)}" aria-label="Choisir une date"></label></div>
    ${closed ? `<div class="rs-warn">${ico("alert")}<span>${rsClosed(cfg, e.date) ? "Fermeture exceptionnelle ce jour-là" : "Normalement fermé ce jour-là"}</span></div>` : ""}
    <div class="rs-cov">
      <button class="rs-step" data-act="rsEdCov" data-v="-1" aria-label="Une personne de moins" ${e.covers <= 1 ? "disabled" : ""}>${ico("minus")}</button>
      <div class="rs-covn"><b class="${R.edCov !== e.covers ? "rs-pop" : ""}">${e.covers}</b><span>personne${e.covers > 1 ? "s" : ""}</span></div>
      <button class="rs-step" data-act="rsEdCov" data-v="1" aria-label="Une personne de plus">${ico("plus")}</button>
    </div>
    <div class="rs-qcov">${[1, 2, 3, 4, 5, 6, 8, 10].map((n) => `<button class="${e.covers === n ? "on" : ""}" data-act="rsEdCovSet" data-v="${n}">${n}</button>`).join("")}</div>
    ${svcs.length > 1 ? `<div class="rs-esvc">${svcs.map((s) => `<button class="${s.id === e.svc ? "on" : ""}" data-act="rsEdSvc" data-v="${esc(s.id)}">${esc(s.name)}</button>`).join("")}</div>` : ""}
    <div class="rs-times">${slots.map((t) => { const u = used[rsBucket(cfg, e.date, t)] || 0, left = cap ? cap - u : null, full = cap && left < e.covers, past = nowM >= 0 && rsMin(t) < nowM;
      return `<button class="rs-tc${e.time === t ? " on" : ""}${full ? " full" : ""}${past ? " past" : ""}" data-act="rsEdTime" data-v="${t}"><b>${t}</b><i>${cap ? (left > 0 ? `${left} pl.` : "complet") : u ? `${u} couv.` : ""}</i></button>`; }).join("") || `<div class="rs-lp">Aucun service ce jour-là.</div>`}</div>
    <label class="rs-big-in"><span>Nom</span><input class="input" data-rsed="name" value="${esc(e.name)}" placeholder="Nom du client" autocomplete="off" autocapitalize="words" enterkeyhint="next" maxlength="60"></label>
    <div id="rsSug" class="rs-sug" aria-live="polite">${rsSugHtml()}</div>
    <label class="rs-big-in"><span>Téléphone</span><input class="input" data-rsed="phone" value="${esc(e.phone)}" placeholder="06 12 34 56 78" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" maxlength="25"></label>
    <label class="rs-big-in sm"><span>E-mail <i class="rs-opt">${rsSrv() ? "il reçoit la confirmation" : "facultatif"}</i></span><input class="input" data-rsed="email" value="${esc(e.email || "")}" placeholder="client@mail.fr" type="email" inputmode="email" autocomplete="off" autocapitalize="off" enterkeyhint="done" maxlength="120"></label>
    ${e.more ? `<label class="rs-big-in sm"><span>Note, allergies, occasion</span><textarea class="input" data-rsed="notes" rows="2" maxlength="300" placeholder="Allergie fruits à coque, anniversaire, chaise bébé…">${esc(e.notes)}</textarea></label>
      ${tabs.length ? `<div class="rs-etab"><span>Table</span><div>${["", ...tabs.map((t) => t.id)].map((id) => { const t = tabs.find((x) => x.id === id); return `<button class="${(e.table || "") === id ? "on" : ""}${t && busyT.has(id) ? " busy" : ""}" data-act="rsEdTable" data-v="${esc(id)}">${t ? `${esc(t.n)}<i>${+t.seats || 0}</i>` : "Aucune"}</button>`; }).join("")}</div></div>` : ""}`
      : `<button class="rs-more" data-act="rsEdMore">${ico("plus")}Note, allergies${tabs.length ? ", table" : ""}</button>`}
    <div class="rs-edf">
      ${e.id ? `<button class="btn soft" data-act="rsDelAsk" data-id="${esc(e.id)}" aria-label="Supprimer">${ico("trash")}</button>` : ""}
      <button class="btn acc block rs-save" data-act="rsEdSave" ${ok ? "" : "disabled"}>${ok ? `Enregistrer · ${e.covers} pers. · ${e.time}` : !e.time ? "Choisissez l'heure" : "Indiquez le nom"}</button>
    </div>
  </div>`;
  R.edCov = e.covers;
  openSheet(html, (b) => { if (first && !e.id && !PHONE_MQ.matches) { const n = b.querySelector('[data-rsed="name"]'); n && setTimeout(() => n.focus({ preventScroll: true }), 300); } });
}
/* typing in the form: keep R.ed in sync and refresh only the save button (no repaint, the keyboard stays) */
document.addEventListener("input", (ev) => {
  const el = ev.target; const k = el && el.dataset && el.dataset.rsed; if (!k || !R.ed) return;
  if (k === "date") { if (el.value) { R.ed.date = el.value; R.ed.time = ""; SFX.tick(); rsEdPaint(); } return; }
  R.ed[k] = el.value; rsEdBtn();
  if (k === "name" || k === "phone") { const g = document.getElementById("rsSug"); if (g) g.innerHTML = rsSugHtml(); }
});
document.addEventListener("keydown", (ev) => {
  const el = ev.target; if (ev.key !== "Enter" || !el || !el.dataset || !el.dataset.rsed || el.tagName === "TEXTAREA") return;
  ev.preventDefault(); if (el.dataset.rsed === "name" || el.dataset.rsed === "phone") { const p = document.querySelector(`[data-rsed="${el.dataset.rsed === "name" ? "phone" : "email"}"]`); p && p.focus(); } else { el.blur(); const s = document.querySelector(".rs-save"); s && !s.disabled && s.click(); }
});
function rsEdBtn() {
  const e = R.ed, b = document.querySelector(".rs-save"); if (!e || !b) return;
  const ok = e.name.trim().length >= 1 && !!e.time && e.covers >= 1; b.disabled = !ok;
  b.textContent = ok ? `Enregistrer · ${e.covers} pers. · ${e.time}` : !e.time ? "Choisissez l'heure" : "Indiquez le nom";
}
/* known clients while typing a name or a phone: tap one to fill the form; a known phone shows its file */
const rsNorm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
function rsPeople() {
  const m = {}; Object.entries(rsStats()).forEach(([k, x]) => { m[k] = { id: k, name: x.name, phone: x.phone, email: x.email, visits: x.visits, noshow: x.noshow }; });
  R.clients.forEach((c) => { if (!c || !c.id) return; m[c.id] = { visits: 0, noshow: 0, ...(m[c.id] || {}), ...c, id: c.id }; });
  return Object.values(m);
}
function rsSugHtml() {
  const e = R.ed; if (!e) return ""; const pk = rsPk(e.phone);
  const info = (c) => [c.vip ? `<span class="rs-vip">VIP</span>` : "", `<span>${c.visits ? rsPl(c.visits, "visite") : "Pas encore venu"}</span>`, c.noshow ? `<span class="rs-nsw">${rsPl(c.noshow, "no-show")}</span>` : "", c.notes ? `<span class="rs-cn${rsNoteKind(c.notes) ? " al" : ""}">${esc(c.notes)}</span>` : ""].join("");
  const ppl = rsPeople(), hit = pk && ppl.find((c) => c.id === pk);
  if (hit) return `<button class="rs-sugi" data-act="rsEdSug" data-v="${esc(hit.id)}">${ico("rsSeat")}<span><b>${esc(hit.name || "Client connu")}</b>${info(hit)}</span></button>`;
  const q = rsNorm(e.name), d = String(e.phone || "").replace(/\D/g, "");
  if (q.length < 2 && d.length < 3) return "";
  const L = ppl.filter((c) => (d.length >= 3 ? String(c.phone || "").replace(/\D/g, "").includes(d.replace(/^0/, "")) : true) && (q.length >= 2 ? rsNorm(c.name).split(/\s+/).some((w) => w.startsWith(q)) || rsNorm(c.name).startsWith(q) : true))
    .sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || (b.visits || 0) - (a.visits || 0)).slice(0, 3);
  if (!L.length) return "";
  return `<div class="rs-sugl">${L.map((c) => `<button class="rs-sugc" data-act="rsEdSug" data-v="${esc(c.id)}"><b>${c.vip ? `<span class="rs-vip">VIP</span>` : ""}${esc(c.name || "")}</b><em>${esc(c.phone || "")}${c.visits ? ` · ${rsPl(c.visits, "visite")}` : ""}${c.noshow ? ` · ${rsPl(c.noshow, "no-show")}` : ""}</em></button>`).join("")}</div>`;
}
/* re-render the sheet after a chip tap, keeping what was typed */
function rsEdKeep() { document.querySelectorAll("#sheetBody [data-rsed]").forEach((el) => { if (el.dataset.rsed !== "date" && R.ed) R.ed[el.dataset.rsed] = el.value; }); }

/* ───────── booking sheet (status, call, quick table, edit) ───────── */
function rsOpenSheet(id) {
  const b = rsRows().find((x) => x.id === id); if (!b) return; const cfg = rsCfg();
  const tb = b.table && cfg.tables.find((t) => t.id === b.table), nk = rsNoteKind(b.notes), cs = rsStatOf(b.phone), cl = rsClientOf(b.phone);
  const sts = [["avenir", "Confirmée", "check"], ["arrive", "Arrivée", "rsSeat"], ["noshow", "No-show", "x"], ["annule", "Annulée", "trash"]];
  const cur = rsConf(b) ? "avenir" : b.status || "avenir";
  const svc = rsSvcOf(cfg, b.date, b.time);
  const busyT = new Set(rsOfDay(b.date).filter((x) => rsLive(x) && x.id !== b.id && x.table && rsSvcOf(cfg, b.date, x.time).id === svc.id).flatMap((x) => (typeof plTblOf === "function" ? plTblOf(x) : [x.table])));
  const tabs = cfg.tables.slice().sort((a, c) => String(a.n).localeCompare(String(c.n), "fr", { numeric: true }));
  const srv = rsSrv(), log = Array.isArray(b.mailLog) ? b.mailLog : [], lastMail = log[log.length - 1];
  const KN = { demande: "demande reçue", confirme: "confirmation", modifie: "modification", rappel: "rappel", refuse: "refus", annule: "annulation", annule_client: "annulation", avis: "demande d'avis" };
  const main = b.status === "avalider"
    ? `<div class="rs-rqb big"><button class="btn soft" data-act="rsRefuse" data-id="${esc(b.id)}">${ico("x")}Refuser</button><button class="btn acc" data-act="rsAccept" data-id="${esc(b.id)}">${ico("check")}Accepter</button></div>`
    : b.status === "attente"
    ? `<div class="rs-rqb big"><button class="btn soft" data-act="rsSetSt" data-id="${esc(b.id)}" data-v="annule">${ico("trash")}Retirer</button><button class="btn acc" data-act="rsPromote" data-id="${esc(b.id)}">${ico("check")}Proposer la table</button></div>`
    : `<div class="rs-sts">${sts.map(([k, t, ic]) => `<button class="rs-sb k-${k}${cur === k ? " on" : ""}" data-act="rsSetSt" data-id="${esc(b.id)}" data-v="${k}" aria-pressed="${cur === k}">${ico(ic)}<span>${b.status === "refuse" && k === "annule" ? "Refusée" : t}</span></button>`).join("")}</div>`;
  openSheet(`<div class="rs-bk">
    <div class="rs-bkh"><span class="rs-cv big"><b>${+b.covers || 0}</b><i>pers.</i></span><div><button class="rs-who" data-act="rsClient" data-id="${esc(b.id)}" ${rsPk(b.phone) ? "" : "disabled"}><span class="h2">${esc(b.name || "Sans nom")}</span>${rsPk(b.phone) ? ico("chev") : ""}</button><em>${esc(rsLong(b.date))} · <b>${b.time}</b>${tb ? ` · table ${esc(typeof plLabel === "function" ? plLabel(b, cfg) || tb.n : tb.n)}` : ""}</em></div></div>
    ${cs && (cs.visits || cs.noshow || (cl && (cl.vip || cl.notes || (cl.allergens || []).length))) ? `<button class="rs-cline" data-act="rsClient" data-id="${esc(b.id)}">${cl && cl.vip ? `<span class="rs-vip">VIP</span>` : ""}<span>${cs.visits ? rsPl(cs.visits, "visite") : "Première visite"}</span>${cs.noshow ? `<span class="rs-nsw">${rsPl(cs.noshow, "no-show")}</span>` : ""}${rsFdTags(b)}${cl && cl.notes ? `<span class="rs-cn">${esc(cl.notes)}</span>` : ""}</button>` : ""}
    ${rsWeb(b) ? `<div class="rs-from">${ico("rsWeb")}<span>Réservé en ligne${b.createdAt ? ` le ${shortDate(dayKey(new Date(+b.createdAt || Date.now())))} à ${hm(+b.createdAt || Date.now())}` : ""}</span></div>` : ""}
    ${b.clientChange ? `<div class="rs-from cc">${ico("edit")}<span>${b.clientChange.what === "annule" ? "Annulée" : "Modifiée"} par le client ${when(b.clientChange.at)}</span></div>` : ""}
    ${b.notes ? `<div class="rs-note big ${nk}">${nk ? ico("alert") : ico("rsNote")}<span>${esc(b.notes)}</span></div>` : ""}
    ${b.resaMsg && (b.status === "refuse" || b.status === "annule") ? `<div class="rs-note big">${ico("rsMail")}<span>Votre message : « ${esc(b.resaMsg)} »</span></div>` : ""}
    ${main}
    ${tabs.length && rsLive(b) ? (() => {
      /* one table, or several pushed together (« Assembler »: each tap adds or removes a table) */
      const mine = typeof plTblOf === "function" ? plTblOf(b) : [b.table].filter(Boolean), join = R.join === b.id, cap = mine.reduce((n, id) => n + (+(tabs.find((t) => t.id === id) || {}).seats || 0), 0), cv = +b.covers || 0;
      return `<div class="rs-etab${join ? " join" : ""}"><span>${mine.length > 1 ? "Tables assemblées" : "Table"}</span><div>${(join ? tabs.map((t) => t.id) : ["", ...tabs.map((t) => t.id)]).map((tid) => { const t = tabs.find((x) => x.id === tid); return `<button class="${(tid ? mine.includes(tid) : !mine.length) ? "on" : ""}${t && busyT.has(tid) ? " busy" : ""}" data-act="${join ? "rsJoinT" : "rsSetTable"}" data-id="${esc(b.id)}" data-v="${esc(tid)}">${t ? `${esc(t.n)}<i>${+t.seats || 0}</i>` : "Aucune"}</button>`; }).join("")}</div>
        <div class="rs-ejoin"><em>${mine.length ? `${cap} place${cap > 1 ? "s" : ""} pour ${cv} pers.${cap < cv ? " : il manque des places" : ""}` : "Pas de table"}</em><button class="btn ${join ? "acc" : "soft"} sm" data-act="rsJoinTog" data-id="${esc(b.id)}">${join ? `${ico("check")}Terminé` : `${ico("plus")}Assembler des tables`}</button></div></div>`;
    })() : ""}
    ${b.email ? `<div class="rs-mailr">${ico("rsMail")}<span><b>${esc(b.email)}</b><em>${lastMail ? `E-mail de ${KN[lastMail.k] || "réservation"} envoyé ${when(lastMail.at)}` : srv ? "Le client reçoit les e-mails de sa réservation" : "E-mails au client : bientôt actif"}</em></span>${srv && (rsConf(b) || b.status === "avalider") ? `<button class="btn soft sm" data-act="rsResend" data-id="${esc(b.id)}">Renvoyer</button>` : ""}</div>` : ""}
    ${rsRevLine(b)}
    <div class="rs-bkf">${b.phone ? `<a class="btn soft" href="tel:${esc(String(b.phone).replace(/[^\d+]/g, ""))}">${ico("rsPhone")}Appeler</a>` : ""}<button class="btn ${b.phone ? "soft" : "soft block"}" data-act="rsEdit" data-id="${esc(b.id)}">${ico("edit")}Modifier</button></div>
  </div>`);
}
/* booking sheet: where the « Votre repas s'est bien passé ? » stands for this guest */
function rsRevLine(b) {
  if (b.status !== "arrive" || b.ext) return ""; const c = rsCfg(), url = rsGoogleUrl(c.googleReview); if (!url || c.reviewAsk === false && !b.phone) return "";
  const sms = rsRevSms(b), asked = +b.reviewAskAt > 0, smsAt = +b.reviewSmsAt > 0;
  const txt = asked ? `Avis demandé par e-mail ${when(b.reviewAskAt)}` : smsAt ? `Avis demandé par SMS ${when(b.reviewSmsAt)}` : b.email && c.reviewAsk !== false ? `L'e-mail d'avis part ${c.reviewWhen === "lendemain" ? "demain à 11 h" : "après le repas"}` : "Pas d'e-mail : demandez l'avis par SMS";
  return `<div class="rs-mailr rs-revl">${ico("rsStar")}<span><b>Avis Google</b><em>${esc(txt)}</em></span>${sms && !asked ? `<a class="btn soft sm" href="${esc(sms)}" data-act="rsRevSent" data-id="${esc(b.id)}">Demander un avis</a>` : ""}</div>`;
}

/* cancel / refuse with an optional message to the client */
function rsMsgSheet(id, kind) {
  const b = rsRows().find((x) => x.id === id); if (!b) return;
  const ref = kind === "refuse", chips = ref ? ["Complet ce soir-là, désolés !", "Nous sommes fermés ce jour-là.", "Groupe trop nombreux pour nous, appelez-nous."] : ["Fermeture exceptionnelle, toutes nos excuses.", "Un imprévu en cuisine, désolés !", "Appelez-nous pour trouver une autre date."];
  R.msg = { id, kind, text: "" };
  openSheet(`<div class="rs-ed">
    <div class="rs-edh"><span class="h2">${ref ? "Refuser la demande" : "Annuler la réservation"}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub" style="margin:0">${esc(b.name || "")} · ${+b.covers || 0} pers. · ${esc(rsLong(b.date))} à ${b.time}</p>
    <label class="rs-big-in sm"><span>Un mot pour le client <i class="rs-opt">facultatif</i></span><textarea class="input" id="rsMsgTx" rows="3" maxlength="300" placeholder="${esc(chips[0])}"></textarea></label>
    <div class="rs-mchips">${chips.map((c, i) => `<button data-act="rsMsgChip" data-v="${i}">${esc(c)}</button>`).join("")}</div>
    <div class="rs-mail">${ico("rsMail")}<span>${b.email ? (rsSrv() ? "Le client est prévenu par e-mail, avec votre message." : "E-mail au client : bientôt actif. Pensez à le prévenir par téléphone.") : "Pas d'e-mail pour ce client : prévenez-le par téléphone."}</span></div>
    <div class="grid2"><button class="btn soft" data-act="rsOpen" data-id="${esc(id)}">Retour</button><button class="btn danger" data-act="rsMsgOk">${ref ? "Refuser" : "Annuler"}</button></div>
  </div>`, (el) => { el.querySelectorAll(".rs-mchips button").forEach((x, i) => { x.dataset.txt = chips[i]; }); });
}
/* js/clients.js: allergies from the client file, and the loyalty reward waiting on this table */
function rsFdTags(b) {
  try { const p = typeof fdPerson === "function" ? fdPerson(b.phone) : null; if (!p) return ""; const al = (p.allergens || []).map((x) => (allergenOf(x) || {}).t).filter(Boolean);
    return (al.length ? `<span class="rs-nsw">${ico("alert")}${esc(al.join(", "))}</span>` : "") + (typeof fdReward === "function" && fdReward(p) ? `<span class="rs-vip">${esc(fdCfg().reward)}</span>` : ""); } catch (e) { return ""; }
}
function rsClientSheet(b) {
  const k = rsPk(b.phone); if (!k) return; const cs = rsStatOf(b.phone) || { visits: 0, noshow: 0, cancel: 0, list: [] }, cl = rsClientOf(b.phone) || {};
  R.cl = { id: k, name: cl.name || b.name || "", phone: cl.phone || b.phone || "", email: cl.email || cs.email || b.email || "", vip: !!cl.vip, notes: cl.notes || "" };
  const past = cs.list.slice(0, 8);
  openSheet(`<div class="rs-cf">
    <div class="rs-edh"><span class="h2">${esc(R.cl.name || "Client")}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="rs-cfs"><div><b>${cs.visits}</b><em>visite${cs.visits > 1 ? "s" : ""}</em></div><div class="${cs.noshow ? "bad" : ""}"><b>${cs.noshow}</b><em>no-show</em></div><div><b>${cs.cancel}</b><em>annulée${cs.cancel > 1 ? "s" : ""}</em></div><div><b>${cs.last ? shortDate(cs.last) : "–"}</b><em>dernière</em></div></div>
    <button class="rs-tog${R.cl.vip ? " on" : ""}" data-act="rsClVip" aria-pressed="${R.cl.vip}"><span><b>Client VIP</b><em>Un badge VIP sur chacune de ses réservations.</em></span><i></i></button>
    <label class="rs-big-in sm"><span>Notes (allergies, préférences)</span><textarea class="input" id="rsClNotes" rows="2" maxlength="300" placeholder="Allergie arachides, aime la table près de la fenêtre…">${esc(R.cl.notes)}</textarea></label>
    <div class="rs-cfc">${R.cl.phone ? `<a href="tel:${esc(String(R.cl.phone).replace(/[^\d+]/g, ""))}">${ico("rsPhone")}${esc(R.cl.phone)}</a>` : ""}${R.cl.email ? `<span>${ico("rsMail")}${esc(R.cl.email)}</span>` : ""}</div>
    ${past.length ? `<div class="rs-cfh"><b>Historique</b>${past.map((x) => `<div class="rs-cfr"><span>${shortDate(x.date)} · ${x.time}</span><span>${+x.covers || 0} pers.</span><span class="rs-stp ${(RS_ST[x.status] || RS_ST.avenir).k}">${(RS_ST[x.status] || RS_ST.avenir).t}</span></div>`).join("")}</div>` : ""}
    <button class="btn acc block" data-act="rsClSave">Enregistrer</button>
    ${typeof fdOpenSheet === "function" && VIEWS.clients ? `<button class="btn soft block" data-act="rsClFull" data-id="${esc(k)}">Fiche complète : allergies, fidélité</button>` : ""}
  </div>`);
}

/* ── client e-mails (identical copy in js/resa.js rsMailHtml and functions/src/resa.js mailHtml: keep both in sync) ── */
const RS_MAIL_KINDS = {
  demande: { t: "Demande bien reçue", s: (r) => `Demande reçue · ${r.name}` },
  confirme: { t: "Votre table est réservée", s: (r, b, d) => `Table réservée chez ${r.name} · ${d} à ${b.time}` },
  modifie: { t: "Réservation modifiée", s: (r) => `Réservation modifiée · ${r.name}` },
  rappel: { t: "À demain !", s: (r, b) => `À demain chez ${r.name} · ${b.time}` },
  refuse: { t: "Réservation impossible", s: (r) => `Votre demande chez ${r.name}` },
  annule: { t: "Réservation annulée", s: (r) => `Réservation annulée · ${r.name}` },
  annule_client: { t: "Annulation confirmée", s: (r) => `Annulation confirmée · ${r.name}` },
  avis: { t: "Votre dîner s'est bien passé ?", s: (r, b) => `Votre ${rsMeal(b)} chez ${r.name} s'est bien passé ?` },
};
const rsMeal = (b) => (rsMin(b && b.time) < 16 * 60 ? "déjeuner" : "dîner");
/* the restaurant's Google review link: a Place ID (ChIJ…) or an https link on a Google domain (g.page/r/…/review, maps.app.goo.gl…).
   Same function in functions/src/resa.js (googleUrl): keep both in sync. */
function rsGoogleUrl(v) {
  const s = String(v || "").trim(); if (!s || s.length > 600) return "";
  if (/^ChIJ[\w-]{10,}$/.test(s)) return "https://search.google.com/local/writereview?placeid=" + s;
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const h = u.hostname.toLowerCase();
  if (!/(^|\.)(google\.[a-z.]{2,6}|g\.page|goo\.gl)$/.test(h)) return "";
  u.protocol = "https:"; return u.toString();
}
function rsMailDay(k) { const D = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], M = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]; const [y, m, d] = String(k || "").split("-").map(Number); if (!y) return ""; const dt = new Date(Date.UTC(y, m - 1, d, 12)); return `${D[dt.getUTCDay()]} ${d} ${M[m - 1]}`; }
function rsMailHtml(kind, b, r, L) {
  const e = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  if (kind === "avis") return rsAvisHtml(b, r, L, e);
  const K = RS_MAIL_KINDS[kind] || RS_MAIL_KINDS.confirme, nm = e(String(b.name || "").trim().split(/\s+/)[0] || ""), rn = e(r.name || "le restaurant");
  /* the restaurant logo, only as an https URL: most mail clients block data: images */
  const lg = typeof r.logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.logo) && r.logo.length <= 2000 ? r.logo : "";
  const lead = {
    demande: `Bonjour ${nm}, votre demande est bien arrivée chez <b>${rn}</b>. Le restaurant la valide au plus vite et vous recevrez un e-mail de confirmation.`,
    confirme: `Bonjour ${nm}, c'est confirmé : <b>${rn}</b> vous attend.`,
    modifie: `Bonjour ${nm}, votre réservation chez <b>${rn}</b> a bien été modifiée. Voici les nouveaux détails.`,
    rappel: `Bonjour ${nm}, petit rappel : <b>${rn}</b> vous attend demain.`,
    refuse: `Bonjour ${nm}, <b>${rn}</b> ne peut malheureusement pas vous accueillir à cette date.`,
    annule: `Bonjour ${nm}, <b>${rn}</b> a dû annuler votre réservation. Toutes nos excuses.`,
    annule_client: `Bonjour ${nm}, votre réservation chez <b>${rn}</b> est bien annulée. À bientôt, on l'espère !`,
  }[kind] || "";
  const off = kind === "refuse" || kind === "annule" || kind === "annule_client";
  const row = (k, v) => `<tr><td style="padding:9px 0;border-top:1px solid #F1E9DA;color:#6E6880;font-size:14px">${k}</td><td style="padding:9px 0;border-top:1px solid #F1E9DA;font-weight:700;font-size:16px;text-align:right;color:#1B1530">${v}</td></tr>`;
  const btn = (href, label, main) => `<a href="${e(href)}" style="display:block;text-align:center;text-decoration:none;font-weight:700;font-size:16px;padding:15px 18px;border-radius:16px;margin-top:10px;${main ? "background:#5B2BFF;color:#ffffff;box-shadow:0 4px 0 #2A0BA6" : "background:#FFFDF8;color:#1B1530;border:1.5px solid #DCCFB8"}">${label}</a>`;
  const msg = b.resaMsg && (kind === "refuse" || kind === "annule") ? `<div style="margin:16px 0 0;padding:13px 15px;background:#FFF3D6;border-radius:14px;color:#7A5A1A;font-size:15px;line-height:1.45">« ${e(b.resaMsg)} »<div style="font-size:12.5px;margin-top:4px">${rn}</div></div>` : "";
  const acts = off ? (L.book ? btn(L.book, "Réserver une autre date", true) : "")
    : (kind !== "demande" && L.ics ? btn(L.ics, "Ajouter à mon agenda", true) : "") + (L.manage ? btn(L.manage, "Modifier ou annuler", kind === "demande") : "");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(K.t)}</title></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B1530">
<div style="max-width:500px;margin:0 auto;padding:24px 14px 32px">
 <div style="background:#4C1FEA;border-radius:26px 26px 0 0;padding:26px 24px 30px;color:#ffffff">
  ${lg ? `<img src="${e(lg)}" width="52" height="52" alt="${rn}" style="display:block;width:52px;height:52px;border-radius:15px;background:#ffffff;object-fit:contain;margin:0 0 14px;border:0">` : ""}
  <div style="font-size:14px;color:#D9D2FF;font-weight:600">${rn}</div>
  <div style="font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-.5px;margin-top:6px">${e(K.t)}</div>
 </div>
 <div style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-top:0;border-radius:0 0 26px 26px;padding:22px 22px 24px;box-shadow:0 3px 0 #E2D6C2">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#4A4560">${lead}</p>
  <table role="presentation" style="width:100%;border-collapse:collapse;${off ? "opacity:.6;text-decoration:line-through" : ""}">${row("Jour", e(rsMailDay(b.date)))}${row("Heure", e(b.time))}${row("Personnes", e(b.covers))}${row("Au nom de", e(b.name))}</table>
  ${b.notes && !off ? `<div style="margin-top:12px;font-size:14px;color:#4A4560">Votre précision : ${e(b.notes)}</div>` : ""}
  ${msg}
  ${r.address ? `<div style="margin-top:16px;font-size:14px;color:#4A4560">Adresse : <b style="color:#1B1530">${e(r.address)}</b></div>` : ""}
  <div style="margin-top:8px">${acts}</div>
  ${r.phone ? `<div style="margin-top:16px;font-size:14px;color:#4A4560;text-align:center">Une question ? Appelez le <a href="tel:${e(String(r.phone).replace(/[^\d+]/g, ""))}" style="color:#3A10D8;font-weight:700;text-decoration:none">${e(r.phone)}</a></div>` : ""}
 </div>
 <div style="text-align:center;font-size:12px;color:#6E6880;margin-top:18px">Réservation en ligne par Growth Gusto</div>
</div></body></html>`;
}

/* « Votre dîner s'est bien passé ? » — every guest gets the same Google button (no filtering of unhappy guests: Google forbids it) */
function rsAvisHtml(b, r, L, e) {
  const nm = e(String(b.name || "").trim().split(/\s+/)[0] || ""), rn = e(r.name || "le restaurant"), m = rsMeal(b);
  const lg = typeof r.logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.logo) && r.logo.length <= 2000 ? r.logo : "";
  const g = e(L.review || "#"), star = `<a href="${g}" style="text-decoration:none;color:#F5B700;font-size:38px;line-height:1;padding:0 3px">&#9733;</a>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Votre ${m} s'est bien passé ?</title></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B1530">
<div style="max-width:500px;margin:0 auto;padding:24px 14px 32px">
 <div style="background:#4C1FEA;border-radius:26px 26px 0 0;padding:26px 24px 30px;color:#ffffff">
  ${lg ? `<img src="${e(lg)}" width="52" height="52" alt="${rn}" style="display:block;width:52px;height:52px;border-radius:15px;background:#ffffff;object-fit:contain;margin:0 0 14px;border:0">` : ""}
  <div style="font-size:14px;color:#D9D2FF;font-weight:600">${rn}</div>
  <div style="font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-.5px;margin-top:6px">Votre ${m} s'est bien passé ?</div>
 </div>
 <div style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-top:0;border-radius:0 0 26px 26px;padding:22px 22px 24px;box-shadow:0 3px 0 #E2D6C2">
  <p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#4A4560">Bonjour ${nm}, merci d'être venu${+b.covers > 1 ? "s" : ""} chez <b>${rn}</b>. Toute l'équipe espère que vous vous êtes régalé${+b.covers > 1 ? "s" : ""} !</p>
  <p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:#4A4560">Votre avis compte énormément pour nous. Trente secondes sur Google aident d'autres gourmands à nous découvrir.</p>
  <div style="text-align:center;margin:18px 0 6px">${star}${star}${star}${star}${star}</div>
  <a href="${g}" style="display:block;text-align:center;text-decoration:none;font-weight:700;font-size:16px;padding:15px 18px;border-radius:16px;margin-top:10px;background:#5B2BFF;color:#ffffff;box-shadow:0 4px 0 #2A0BA6">Laisser un avis sur Google</a>
  ${r.phone ? `<div style="margin-top:16px;font-size:14px;color:#4A4560;text-align:center;line-height:1.45">Quelque chose ne vous a pas plu ? Dites-le nous aussi, on veut s'améliorer : <a href="tel:${e(String(r.phone).replace(/[^\d+]/g, ""))}" style="color:#3A10D8;font-weight:700;text-decoration:none">${e(r.phone)}</a></div>` : ""}
  ${L.book ? `<div style="margin-top:14px;text-align:center"><a href="${e(L.book)}" style="color:#3A10D8;font-weight:700;font-size:14px;text-decoration:none">Réserver à nouveau</a></div>` : ""}
 </div>
 <div style="text-align:center;font-size:12px;color:#6E6880;margin-top:18px;line-height:1.5">Un seul message après votre venue, pas plus d'une fois tous les 4 mois.<br>Réservation par Growth Gusto</div>
</div></body></html>`;
}

/* ───────── settings (gérant) ───────── */
const RS_MAIL_LIST = [["demande", "Demande reçue", "Mode validation : avant votre réponse"], ["confirme", "Table réservée", "Jour, heure, adresse, agenda, lien pour modifier"], ["modifie", "Réservation modifiée", "Quand l'heure, le jour ou le nombre change"], ["rappel", "Rappel la veille", "Envoyé la veille au matin"], ["refuse", "Demande refusée", "Avec votre message"], ["annule", "Annulée par le restaurant", "Avec votre message"]];
function rsCfgPaint() {
  const c = R.ce; if (!c) return; const t = R.ctab;
  const tabs = [["h", "Horaires"], ["w", "En ligne"], ["a", "Avis"], ["t", "Tables"]];
  const step = (k, v, min, max, unit) => `<div class="rs-stp2"><button data-act="rsCeStep" data-v="${k}:-1" aria-label="Moins" ${v <= min ? "disabled" : ""}>${ico("minus")}</button><b>${v}${unit ? `<i>${unit}</i>` : ""}</b><button data-act="rsCeStep" data-v="${k}:1" aria-label="Plus" ${v >= max ? "disabled" : ""}>${ico("plus")}</button></div>`;
  const seg = (k, opts) => `<div class="rs-seg">${opts.map(([v, l]) => `<button class="${String(c[k]) === String(v) ? "on" : ""}" data-act="rsCeSet" data-v="${k}:${v}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (t === "h") {
    body = `${c.services.map((s, i) => `<div class="rs-svc">
        <div class="rs-svch"><input class="input rs-sn" data-rsce="services.${i}.name" value="${esc(s.name)}" maxlength="20" aria-label="Nom du service">${c.services.length > 1 ? `<button class="iconbtn sm" data-act="rsCeSvcDel" data-v="${i}" aria-label="Supprimer ce service">${ico("trash")}</button>` : ""}</div>
        <div class="rs-hrs"><label><span>Première table</span><input class="input" type="time" step="900" data-rsce="services.${i}.from" value="${esc(s.from)}"></label><label><span>Dernière table</span><input class="input" type="time" step="900" data-rsce="services.${i}.to" value="${esc(s.to)}"></label></div>
        <div class="rs-days">${RS_WEEK.map((w) => `<button class="${(s.days || []).includes(w) ? "on" : ""}" data-act="rsCeDay" data-v="${i}:${w}" aria-pressed="${(s.days || []).includes(w)}" aria-label="${DAYS[w]}">${RS_DL[w]}</button>`).join("")}</div>
      </div>`).join("")}
      ${c.services.length < 4 ? `<button class="rs-more" data-act="rsCeSvcAdd">${ico("plus")}Ajouter un service</button>` : ""}
      <div class="rs-row"><div><b>Un créneau toutes les</b></div>${seg("slot", [[15, "15 min"], [30, "30 min"], [60, "1 h"]])}</div>
      <div class="rs-row"><div><b>Couverts max par créneau</b><em>Au-delà, le créneau est complet en ligne.</em></div>${step("maxPerSlot", c.maxPerSlot, 1, 200)}</div>
      <div class="rs-cl"><b>Fermetures exceptionnelles</b>
        ${c.closures.map((x, i) => `<div class="rs-clr"><span>${x.to && x.to !== x.from ? `du ${shortDate(x.from)} au ${shortDate(x.to)}` : `le ${shortDate(x.from)}`}</span><button class="iconbtn sm" data-act="rsCeClDel" data-v="${i}" aria-label="Retirer">${ico("x")}</button></div>`).join("")}
        <div class="rs-hrs"><label><span>Du</span><input class="input" type="date" id="rsClF" min="${dayKey()}"></label><label><span>Au</span><input class="input" type="date" id="rsClT" min="${dayKey()}"></label></div>
        <button class="btn soft sm block" data-act="rsCeClAdd">${ico("plus")}Ajouter la fermeture</button></div>`;
  } else if (t === "w") {
    const can = rsCanOnline();
    body = `<button class="rs-tog${c.online ? " on" : ""}" data-act="rsCeOnline" ${can ? "" : "disabled"} aria-pressed="${!!c.online}"><span><b>Réservation en ligne</b><em>${can ? (c.online ? "Vos clients réservent seuls sur votre lien." : "Coupée : le lien affiche votre téléphone.") : "Avec un compte Growth Gusto."}</em></span><i></i></button>${can ? "" : `<button class="btn soft sm block" data-act="auOpen">Créer mon compte pour l'activer</button>`}
      <div class="rs-vm"><b>Les demandes en ligne</b>
        <div class="rs-vmo">${[[0, "Confirmation automatique", "La table est réservée tout de suite."], [1, "Je valide chaque demande", "Vous acceptez ou refusez, le client est prévenu."]].map(([v, t, d]) => `<button class="${!!c.validate === !!v ? "on" : ""}" data-act="rsCeVal" data-v="${v}" aria-pressed="${!!c.validate === !!v}"><b>${t}</b><em>${d}</em></button>`).join("")}</div></div>
      <button class="rs-tog${c.waitlist !== false ? " on" : ""}" data-act="rsCeWl" aria-pressed="${c.waitlist !== false}"><span><b>Liste d'attente</b><em>Créneau complet : le client peut s'inscrire, vous le rappelez si une table se libère.</em></span><i></i></button>
      <div class="rs-row"><div><b>Au plus tard</b><em>Avant l'heure de la table.</em></div>${seg("lead", [[1, "1 h"], [2, "2 h"], [4, "4 h"], [24, "la veille"]])}</div>
      <div class="rs-row"><div><b>Personnes max en ligne</b><em>Au-delà, le client vous appelle.</em></div>${step("maxOnline", c.maxOnline, 1, 30)}</div>
      <div class="rs-row"><div><b>Réservable jusqu'à</b></div>${seg("horizon", [[30, "1 mois"], [60, "2 mois"], [90, "3 mois"]])}</div>
      <div class="rs-pubh"><b>Votre page</b></div>
      <div class="rs-photo"><button class="rs-ph" data-act="rsCePhoto" aria-label="Photo du restaurant">${c.photo ? `<img src="${esc(c.photo)}" alt="">` : `<span>${esc(initials((S.resto && S.resto.name) || "R"))}</span>`}<i>${ico("camera")}</i></button>
        <div class="rs-phf"><label class="rs-big-in sm"><span>Adresse</span><input class="input" data-rsce="address" value="${esc(c.address)}" maxlength="120" placeholder="12 rue des Vignes, Lyon"></label>
        <label class="rs-big-in sm"><span>Téléphone</span><input class="input" type="tel" data-rsce="phone" value="${esc(c.phone)}" maxlength="25" placeholder="04 78 00 00 00"></label></div></div>
      <label class="rs-big-in sm"><span>Un mot pour vos clients</span><textarea class="input" rows="2" data-rsce="msg" maxlength="240" placeholder="Terrasse ouverte dès les beaux jours. Au-delà de 8, appelez-nous.">${esc(c.msg)}</textarea></label>
      <div class="rs-pubh"><b>E-mails à vos clients</b>${rsSrv() ? "" : `<span class="rs-soon">bientôt actif</span>`}</div>
      <p class="sub rs-mlp">${rsSrv() ? "Envoyés tout seuls dès qu'un client laisse son e-mail. Touchez pour voir." : "En attendant, la page de réservation confirme que la table est enregistrée. Touchez pour voir les e-mails."}</p>
      <div class="rs-mls">${RS_MAIL_LIST.filter(([k]) => k !== "demande" || c.validate).map(([k, t, d]) => `<div class="rs-ml"><button class="rs-mlb" data-act="rsMailPrev" data-v="${k}">${ico("rsMail")}<span><b>${t}</b><em>${d}</em></span>${ico("chev")}</button>${k === "rappel" ? `<button class="rs-swi${c.reminder !== false ? " on" : ""}" data-act="rsCeRem" aria-pressed="${c.reminder !== false}" aria-label="Rappel la veille"><i></i></button>` : ""}</div>`).join("")}</div>`;
  } else if (t === "a") {
    body = rsRevCard(c);
  } else if (typeof plCfgCard === "function") {
    body = plCfgCard(c);
  } else {
    const zs = Object.entries(RS_ZONES);
    body = `${c.tables.length ? `<div class="rs-tlist">${c.tables.map((x, i) => `<div class="rs-tr">
        <input class="input rs-tni" data-rsce="tables.${i}.n" value="${esc(x.n)}" maxlength="6" aria-label="Numéro de table">
        <div class="rs-stp2 sm"><button data-act="rsCeSeat" data-v="${i}:-1" aria-label="Une place de moins" ${(+x.seats || 1) <= 1 ? "disabled" : ""}>${ico("minus")}</button><b>${+x.seats || 1}<i>pl.</i></b><button data-act="rsCeSeat" data-v="${i}:1" aria-label="Une place de plus">${ico("plus")}</button></div>
        <div class="rs-seg sm">${zs.map(([z, l]) => `<button class="${(x.zone || "salle") === z ? "on" : ""}" data-act="rsCeZone" data-v="${i}:${z}">${l}</button>`).join("")}</div>
        <button class="iconbtn sm" data-act="rsCeTDel" data-v="${i}" aria-label="Supprimer la table">${ico("trash")}</button></div>`).join("")}</div>`
      : `<div class="rs-tempty">${ico("rsTable")}<span>Facultatif : créez vos tables pour les attribuer et voir la salle d'un coup d'œil.</span></div>`}
      <div class="grid2"><button class="btn soft sm" data-act="rsCeTAdd" data-v="salle">${ico("plus")}Table en salle</button><button class="btn soft sm" data-act="rsCeTAdd" data-v="terrasse">${ico("plus")}En terrasse</button></div>
      ${c.tables.length ? "" : `<button class="rs-more" data-act="rsCeTQuick">${ico("sparkle")}Créer 10 tables d'un coup</button>`}`;
  }
  openSheet(`<div class="rs-cfg">
    <div class="rs-edh"><span class="h2">Réservations</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="rs-ctab" role="tablist">${tabs.map(([k, l]) => `<button class="${t === k ? "on" : ""}" data-act="rsCeTab" data-v="${k}" role="tab" aria-selected="${t === k}">${l}</button>`).join("")}</div>
    <div class="rs-cb">${body}</div>
    <button class="btn acc block" data-act="rsCeSave">Enregistrer</button>
  </div>`);
}
/* ── « Votre dîner s'est bien passé ? » settings: Google link, when, on/off, how many sent (server: functions/src/resa.js reviewTick) ── */
const RS_REV_WHEN = [["soir", "Le soir même", "2 h 30 après l'heure de la table (le lendemain 10 h si c'est tard)"], ["lendemain", "Le lendemain", "À 11 h, le jour d'après"]];
function rsRevSent(days) { const from = Date.now() - days * 864e5; return rsRows().filter((b) => +b.reviewAskAt > from).length; }
function rsRevCard(c) {
  const url = rsGoogleUrl(c.googleReview), on = c.reviewAsk !== false, bad = String(c.googleReview || "").trim() && !url, w = c.reviewWhen === "lendemain" ? "lendemain" : "soir";
  const n = rsRevSent(30);
  return `<div class="rs-rev">
    <div class="rs-revh"><span class="rs-revs" aria-hidden="true">${ico("rsStar").repeat(5)}</span><div><b>Plus d'avis Google, sans y penser</b><em>Après le repas, chaque client venu reçoit « Votre ${"dîner"} s'est bien passé ? » avec un bouton vers votre fiche Google.</em></div></div>
    <button class="rs-tog${on ? " on" : ""}" data-act="rsCeRevAsk" aria-pressed="${on}"><span><b>Demander un avis après le repas</b><em>${on ? (url ? "Actif : envoyé tout seul aux clients marqués Arrivé." : "Il manque votre lien Google, juste en dessous.") : "Coupé : aucun e-mail d'avis."}</em></span><i></i></button>
    <label class="rs-big-in sm"><span>Votre lien d'avis Google</span><input class="input${bad ? " rs-bad" : ""}" data-rsce="googleReview" id="rsGr" value="${esc(c.googleReview || "")}" maxlength="600" placeholder="https://g.page/r/…/review" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
    ${bad ? `<p class="rs-revbad">${ico("alert")}Ce lien ne mène pas à Google. Copiez celui que Google vous donne (il commence souvent par g.page).</p>` : ""}
    <div class="rs-revb">${url ? `<a class="btn soft sm" href="${esc(url)}" target="_blank" rel="noopener">${ico("rsWeb")}Tester mon lien</a>` : ""}<button class="btn soft sm" data-act="rsRevHelp">${ico("rsHelp")}Où trouver mon lien ?</button></div>
    ${R.revHelp ? `<ol class="rs-revhelp"><li>Sur Google, cherchez le nom de votre restaurant (connecté au compte de votre fiche).</li><li>Touchez <b>Demander des avis</b> (ou <b>Recevoir plus d'avis</b>).</li><li>Copiez le lien et collez-le ici. C'est tout.</li></ol>` : ""}
    <div class="rs-row"><div><b>Quand l'envoyer</b><em>${esc((RS_REV_WHEN.find((x) => x[0] === w) || RS_REV_WHEN[0])[2])}</em></div><div class="rs-seg">${RS_REV_WHEN.map(([v, l]) => `<button class="${w === v ? "on" : ""}" data-act="rsCeRevWhen" data-v="${v}">${l}</button>`).join("")}</div></div>
    <div class="rs-ml"><button class="rs-mlb" data-act="rsMailPrev" data-v="avis">${ico("rsMail")}<span><b>Voir l'e-mail</b><em>Le même pour tous les clients, avec vos étoiles et votre téléphone</em></span>${ico("chev")}</button></div>
    <ul class="rs-revrules"><li>Une seule fois par réservation, et pas plus d'une fois tous les 4 mois pour un même client.</li><li>Seulement les clients qui ont laissé leur e-mail et qui sont marqués <b>Arrivé</b> (ou dont vous avez ouvert la table en salle).</li><li>Sans e-mail ? Dans la fiche de la réservation, « Demander un avis » ouvre un SMS tout prêt.</li></ul>
    ${n ? `<div class="rs-revn"><b>${n}</b><span>${n > 1 ? "demandes d'avis envoyées" : "demande d'avis envoyée"} ces 30 derniers jours</span></div>` : ""}
    ${rsSrv() || DB.mode === "demo" ? "" : `<div class="rs-mail">${ico("rsMail")}<span>Bientôt actif : ces e-mails partiront tout seuls dès que l'envoi sera branché.</span></div>`}
  </div>`;
}
/* the SMS a waiter can send from the phone (free) when the client left no e-mail */
function rsRevSms(b) {
  const url = rsGoogleUrl(rsCfg().googleReview); if (!url || !b.phone) return "";
  const rn = (S.resto && S.resto.name) || "le restaurant";
  const txt = `Bonjour ${firstName(b.name) || ""}, merci d'être venu chez ${rn} ! Votre ${rsMeal(b)} s'est bien passé ? Un petit avis nous aiderait beaucoup : ${url}`;
  return `sms:${String(b.phone).replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(txt)}`;
}

function rsCeKeep() {
  document.querySelectorAll("#sheetBody [data-rsce]").forEach((el) => rsSetPath(R.ce, el.dataset.rsce, el.value));
}
function rsSetPath(o, p, v) { const ks = p.split("."); let x = o; for (let i = 0; i < ks.length - 1; i++) { x = x[/^\d+$/.test(ks[i]) ? +ks[i] : ks[i]]; if (!x) return; } x[ks[ks.length - 1]] = v; }
document.addEventListener("input", (ev) => { const el = ev.target; if (el && el.dataset && el.dataset.rsce && R.ce) rsSetPath(R.ce, el.dataset.rsce, el.value); });

/* ───────── print the QR poster (hidden iframe, nothing to install) ───────── */
function rsPrintPoster() {
  const url = rsUrl(), name = (S.resto && S.resto.name) || "", q = rsQr(url);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Réserver · ${esc(name)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,600..800&family=Instrument+Sans:wght@500;600&display=swap">
  <style>@page{size:A5;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"Instrument Sans",system-ui,sans-serif;color:#1B1530;background:#FBF6EC;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .p{width:148mm;height:209mm;padding:16mm 14mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7mm}
  .k{font:700 15pt "Instrument Sans";color:#5B2BFF}.n{font:780 30pt/1.02 "Bricolage Grotesque";letter-spacing:-.03em}
  .q{width:86mm;height:86mm;padding:5mm;background:#fff;border:2px solid #E9DFCD;border-radius:9mm;box-shadow:0 2mm 0 #E2D6C2}
  .t{font:760 21pt/1.1 "Bricolage Grotesque";letter-spacing:-.02em}.u{font:600 10.5pt "Instrument Sans";color:#4A4560;word-break:break-all}</style></head>
  <body><div class="p"><div class="k">Réservez votre table</div><div class="n">${esc(name)}</div><div class="q">${q}</div><div class="t">Scannez, choisissez l'heure,<br>c'est réservé.</div><div class="u">${esc(url.replace(/^https?:\/\//, ""))}</div></div></body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  const go2 = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); };
  try { (d.fonts && d.fonts.ready ? Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve()).then(() => setTimeout(go2, 150)); } catch (e) { setTimeout(go2, 600); }
}

/* ───────── actions ───────── */
async function rsSave(id, patch) { try { await safe(DB.update("bookings", id, patch)); return true; } catch (e) { return false; } }
Object.assign(ACT, {
  rsDay: (a, id, v) => { SFX.tick(); buzz(4); R.day = v; R.svc = null; R.pick = null; rerender(); },
  rsWeek: (a, id, v) => { SFX.tick(); R.day = addDays(R.day || dayKey(), +v); R.svc = null; R.pick = null; rerender(); },
  rsSvc: (a, id, v) => { SFX.tick(); buzz(4); R.svc = v; R.pick = null; rerender(); },
  rsView: (a, id, v) => { SFX.tap(); R.view = v; R.pick = null; rerender(); },
  rsJump: (a, id, v) => {
    const g = document.getElementById("rs-g-" + v.replace(":", ""));
    if (g) { SFX.tick(); try { g.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) {} g.classList.remove("rs-flash"); void g.offsetWidth; g.classList.add("rs-flash"); }
    else { SFX.tap(); rsEdOpen(null, { date: R.day, time: v, svc: R.svc }); }
  },
  rsNew: () => { SFX.tap(); rsEdOpen(null, { date: R.day, svc: R.svc }); },
  rsOpen: (a, id) => { SFX.tap(); rsOpenSheet(id); },
  rsEdit: (a, id) => { const b = rsRows().find((x) => x.id === id); if (!b) return; SFX.tap(); rsEdOpen(b); },
  rsArr: async (a, id) => {
    const b = rsRows().find((x) => x.id === id); if (!b) return; const on = b.status !== "arrive";
    if (on) { SFX.ok(); buzz(10); a.classList.add("on", "pop"); } else { SFX.tap(); buzz(4); a.classList.remove("on"); }
    await rsSave(id, { status: on ? "arrive" : rsWeb(b) ? "en ligne" : "avenir", ...(on ? { arrivedAt: Date.now() } : {}) });
  },
  rsSetSt: async (a, id, v) => {
    const b = rsRows().find((x) => x.id === id); if (!b) return;
    if (v === "annule" && b.status !== "attente" && b.status !== "annule") { SFX.tap(); rsMsgSheet(id, "annule"); return; }
    const st = v === "avenir" && rsWeb(b) ? "en ligne" : v;
    if (v === "arrive") { SFX.ok(); buzz(10); } else if (v === "noshow" || v === "annule") { SFX.close(); buzz(6); } else SFX.tap();
    closeSheet(true);
    if (await rsSave(id, { status: st, ...(v === "arrive" ? { arrivedAt: Date.now() } : {}) })) toast(v === "arrive" ? `${firstName(b.name) || "Client"} est arrivé` : v === "noshow" ? "Noté : no-show" : v === "annule" ? "Réservation annulée" : "Remis à venir");
  },
  rsSetTable: async (a, id, v) => { SFX.tick(); buzz(4); const ok = await rsSave(id, { table: v || "", tableWith: "", tableAuto: false }); if (ok) rsOpenSheet(id); },
  rsJoinTog: (a, id) => { SFX.tick(); buzz(4); R.join = R.join === id ? null : id; rsOpenSheet(id); },
  /* « Assembler »: tap a table to add it to the booking or take it off; the first one stays the main table */
  rsJoinT: async (a, id, v) => {
    const b = rsRows().find((x) => x.id === id); if (!b || !v) return; const L = typeof plTblOf === "function" ? plTblOf(b) : [b.table].filter(Boolean);
    const next = L.includes(v) ? L.filter((x) => x !== v) : [...L, v].slice(0, 4); SFX.tick(); buzz(4);
    const ok = await rsSave(id, { table: next[0] || "", tableWith: next.slice(1).join(","), tableAuto: false }); if (ok) rsOpenSheet(id);
  },
  rsPick: (a, id) => { SFX.tick(); buzz(4); R.pick = R.pick === id ? null : id; rerender(); },
  rsTable: async (a, id) => {
    const cfg = rsCfg(); const t = cfg.tables.find((x) => x.id === id); if (!t) return;
    if (R.pick) { const pid = R.pick; R.pick = null; SFX.ok(); buzz(10); if (await rsSave(pid, { table: id, tableWith: "", tableAuto: false })) toast(`Installé table ${t.n}`); return; }
    const day = R.day || dayKey(); const on = rsOfDay(day).filter((b) => rsLive(b) && b.table === id && rsSvcOf(cfg, day, b.time).id === R.svc).sort((x, y) => (x.time > y.time ? 1 : -1));
    SFX.tap(); if (on.length) rsOpenSheet((on.find((b) => b.status === "arrive") || on[0]).id); else rsEdOpen(null, { date: day, svc: R.svc, table: id });
  },
  /* form */
  rsEdDate: (a, id, v) => { rsEdKeep(); SFX.tick(); buzz(3); if (R.ed.date !== v) R.ed.time = ""; R.ed.date = v; rsEdPaint(); },
  rsEdCov: (a, id, v) => { rsEdKeep(); SFX.tick(); buzz(3); R.ed.covers = Math.max(1, Math.min(99, R.ed.covers + +v)); rsEdPaint(); },
  rsEdCovSet: (a, id, v) => { rsEdKeep(); SFX.tick(); buzz(3); R.ed.covers = +v; rsEdPaint(); },
  rsEdSvc: (a, id, v) => { rsEdKeep(); SFX.tick(); R.ed.svc = v; R.ed.time = ""; rsEdPaint(); },
  rsEdTime: (a, id, v) => {
    rsEdKeep(); SFX.tick(); buzz(4); R.ed.time = v; R.ed.svc = rsSvcOf(rsCfg(), R.ed.date, v).id; rsEdPaint();
    if (!R.ed.name) setTimeout(() => { const n = document.querySelector('[data-rsed="name"]'); if (n) { n.focus({ preventScroll: true }); try { n.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} } }, 60);
  },
  rsEdTable: (a, id, v) => { rsEdKeep(); SFX.tick(); R.ed.table = v; R.ed.tman = true; rsEdPaint(); },
  rsEdMore: () => { rsEdKeep(); SFX.tap(); R.ed.more = true; rsEdPaint(); setTimeout(() => { const n = document.querySelector('[data-rsed="notes"]'); n && n.focus(); }, 80); },
  rsEdSave: async (a) => {
    rsEdKeep(); const e = R.ed; if (!e || !e.time || !e.name.trim()) return;
    const em = String(e.email || "").trim().slice(0, 120); if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { SFX.err(); toast("E-mail invalide", "err"); const x = document.querySelector('[data-rsed="email"]'); x && x.focus(); return; }
    const doc = { date: e.date, time: e.time, covers: +e.covers || 1, name: e.name.trim().slice(0, 60), phone: e.phone.trim().slice(0, 25), email: em, notes: (e.notes || "").trim().slice(0, 300), table: e.table || "", ...(e.tman || (!e.id && e.table) ? { tableWith: "", tableAuto: false } : {}) };
    a.disabled = true;
    try {
      if (e.id) await safe(DB.update("bookings", e.id, doc));
      else { const id = await safe(DB.add("bookings", { ...doc, status: "avenir", source: "tel", createdAt: Date.now(), by: S.me.id })); R.flash = id; }
    } catch (err) { a.disabled = false; return; }
    if (e.id) R.flash = e.id;
    R.day = e.date; R.svc = e.svc; R.ed = null; closeSheet(true); SFX.done(); buzz([10, 40, 14]);
    const r = a.getBoundingClientRect(); burst(r.left + r.width / 2, r.top);
    toast((e.id ? "Réservation modifiée" : `Réservation notée · ${doc.covers} pers. à ${doc.time}`) + (em && rsSrv() ? " · e-mail envoyé" : ""));
    if (S.route !== "resa") go("resa"); else rerender();
  },
  rsDelAsk: (a, id) => { SFX.tap(); openSheet(`<div class="h2" style="font-size:20px">Supprimer cette réservation ?</div><p class="sub" style="margin:0">Pour un client qui ne vient pas, préférez « Annulé » ou « No-show » : l'historique reste juste.</p><div class="grid2"><button class="btn soft" data-act="rsEdit" data-id="${esc(id)}">Retour</button><button class="btn danger" data-act="rsDelOk" data-id="${esc(id)}">${ico("trash")}Supprimer</button></div>`); },
  rsDelOk: async (a, id) => { closeSheet(true); R.ed = null; try { await safe(DB.del("bookings", id)); } catch (e) { return; } SFX.close(); toast("Réservation supprimée"); },
  /* link */
  rsCopyLink: async () => { const ok = await rsCopy(rsUrl()); if (ok) { SFX.ok(); buzz(6); toast("Lien copié"); } else toast(rsUrl(), "info"); },
  rsQrOpen: () => {
    SFX.tap(); const url = rsUrl();
    openSheet(`<div class="rs-qrs"><div class="rs-edh"><span class="h2">QR code de réservation</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <div class="rs-qr">${rsQr(url)}</div><p class="sub">À poser sur les tables, la vitrine ou l'addition : on scanne, on réserve.</p>
      <button class="btn acc block" data-act="rsPrint">${ico("printer")}Imprimer l'affichette</button></div>`);
  },
  rsPrint: () => { SFX.print ? SFX.print() : SFX.tap(); rsPrintPoster(); },
  rsSnip: () => {
    SFX.tap(); const url = rsUrl();
    const btn = `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;border-radius:14px;background:#5B2BFF;color:#fff;font:600 16px system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 0 #2A0BA6">Réserver une table</a>`;
    const ifr = `<iframe src="${url}&embed=1" title="Réserver une table" style="width:100%;max-width:460px;height:760px;border:0;border-radius:20px" loading="lazy"></iframe>`;
    R.snips = [btn, ifr];
    openSheet(`<div class="rs-snp"><div class="rs-edh"><span class="h2">Sur votre site</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <p class="sub">Copiez un de ces codes et collez-le dans votre site (Wix, WordPress, Squarespace : bloc « HTML » ou « Code »).</p>
      <div class="rs-sn"><div class="rs-snh"><b>Un bouton « Réserver »</b><span class="rs-demo-b">Réserver une table</span></div><pre>${esc(btn)}</pre><button class="btn soft sm block" data-act="rsSnipCopy" data-v="0">${ico("rsCopy")}Copier le bouton</button></div>
      <div class="rs-sn"><div class="rs-snh"><b>Le formulaire dans votre page</b></div><pre>${esc(ifr)}</pre><button class="btn soft sm block" data-act="rsSnipCopy" data-v="1">${ico("rsCopy")}Copier le formulaire</button></div>
    </div>`);
  },
  rsSnipCopy: async (a, id, v) => { const ok = await rsCopy((R.snips || [])[+v] || ""); if (ok) { SFX.ok(); toast("Code copié"); } },
  /* settings */
  rsCfgOpen: (a, id, v) => { if (!rsMgr()) return; SFX.tap(); R.ce = JSON.parse(JSON.stringify(rsCfg())); R.ctab = v || "h"; rsCfgPaint(); },
  rsCeTab: (a, id, v) => { rsCeKeep(); SFX.tick(); R.ctab = v; rsCfgPaint(); const b = $("#sheetBody"); if (b) b.scrollTop = 0; },
  rsCeSet: (a, id, v) => { rsCeKeep(); SFX.tick(); const [k, x] = v.split(":"); R.ce[k] = +x; rsCfgPaint(); },
  rsCeStep: (a, id, v) => { rsCeKeep(); SFX.tick(); const [k, d] = v.split(":"); const lim = { maxPerSlot: [1, 200], maxOnline: [1, 30] }[k] || [0, 999]; R.ce[k] = Math.max(lim[0], Math.min(lim[1], (+R.ce[k] || 0) + +d * (k === "maxPerSlot" && R.ce[k] >= 20 ? 2 : 1))); rsCfgPaint(); },
  rsCeDay: (a, id, v) => { rsCeKeep(); SFX.tick(); buzz(3); const [i, w] = v.split(":").map(Number); const s = R.ce.services[i]; const d = new Set(s.days || []); d.has(w) ? d.delete(w) : d.add(w); s.days = [...d].sort(); rsCfgPaint(); },
  rsCeSvcAdd: () => { rsCeKeep(); SFX.tap(); R.ce.services.push({ id: "s" + Date.now().toString(36), name: "Brunch", from: "11:00", to: "14:00", days: [0] }); rsCfgPaint(); },
  rsCeSvcDel: (a, id, v) => { rsCeKeep(); SFX.close(); R.ce.services.splice(+v, 1); rsCfgPaint(); },
  rsCeClAdd: () => {
    rsCeKeep(); const f = ($("#rsClF") || {}).value, t = ($("#rsClT") || {}).value || f; if (!f) { SFX.err(); toast("Choisissez une date", "err"); return; }
    SFX.tap(); R.ce.closures.push({ from: f <= t ? f : t, to: f <= t ? t : f }); R.ce.closures.sort((x, y) => (x.from > y.from ? 1 : -1)); rsCfgPaint();
  },
  rsCeClDel: (a, id, v) => { rsCeKeep(); SFX.close(); R.ce.closures.splice(+v, 1); rsCfgPaint(); },
  rsCeOnline: () => { rsCeKeep(); if (!rsCanOnline()) return; R.ce.online = !R.ce.online; R.ce.online ? SFX.ok() : SFX.tap(); buzz(6); rsCfgPaint(); },
  rsCePhoto: async () => {
    rsCeKeep(); const [f] = await pickImage(); if (!f) return;
    try { const { canvas } = await shrink(f, 520, 0.8); R.ce.photo = canvas.toDataURL("image/jpeg", 0.74); SFX.ok(); rsCfgPaint(); } catch (e) { SFX.err(); toast("Photo illisible", "err"); }
  },
  rsCeSeat: (a, id, v) => { rsCeKeep(); SFX.tick(); const [i, d] = v.split(":").map(Number); const t = R.ce.tables[i]; t.seats = Math.max(1, Math.min(30, (+t.seats || 1) + d)); rsCfgPaint(); },
  rsCeZone: (a, id, v) => { rsCeKeep(); SFX.tick(); const [i, z] = v.split(":"); R.ce.tables[+i].zone = z; rsCfgPaint(); },
  rsCeTDel: (a, id, v) => { rsCeKeep(); SFX.close(); R.ce.tables.splice(+v, 1); rsCfgPaint(); },
  rsCeTAdd: (a, id, v) => {
    rsCeKeep(); SFX.tap(); const ns = R.ce.tables.map((t) => parseInt(t.n, 10)).filter((n) => !isNaN(n)); const base = v === "terrasse" ? 20 : 0;
    const n = Math.max(base, ...ns.filter((x) => (v === "terrasse" ? x >= 20 : x < 20))) + 1;
    R.ce.tables.push({ id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), n: String(n), seats: 4, zone: v }); rsCfgPaint();
    setTimeout(() => { const b = $("#sheetBody"); if (b) b.scrollTop = b.scrollHeight; }, 30);
  },
  rsCeTQuick: () => { rsCeKeep(); SFX.ok(); const s = [2, 2, 4, 4, 4, 4, 4, 6, 6, 8]; R.ce.tables = s.map((seats, i) => ({ id: "t" + Date.now().toString(36) + i, n: String(i + 1), seats, zone: "salle" })); rsCfgPaint(); },
  rsCeSave: async (a) => {
    rsCeKeep(); const c = R.ce; if (!c || !S.resto) return;
    c.services = c.services.filter((s) => s.from && s.to).map((s, i) => ({ id: s.id || "s" + i, name: (s.name || "").trim() || `Service ${i + 1}`, from: s.from, to: rsMin(s.to) < rsMin(s.from) ? s.from : s.to, days: s.days || [] }));
    c.tables = c.tables.map((t) => ({ ...t, id: t.id, n: String(t.n || "").trim() || "?", seats: +t.seats || 2, zone: t.zone || "salle" }));
    ["address", "phone", "msg", "googleReview"].forEach((k) => { c[k] = String(c[k] || "").trim(); });
    if (c.googleReview && !rsGoogleUrl(c.googleReview)) { SFX.err(); R.ctab = "a"; rsCfgPaint(); toast("Ce lien d'avis ne mène pas à Google", "err"); return; }
    if (!rsCanOnline()) c.online = false;
    a.disabled = true;
    try { await safe(DB.update("restos", S.rid, { resaCfg: DB.clean(c) })); } catch (e) { a.disabled = false; return; }
    if (S.resto) S.resto.resaCfg = DB.clean(c); /* the restos snapshot follows; the projection uses it at once */
    R.ce = null; closeSheet(true); SFX.done(); toast("Réglages enregistrés"); rsSync(); rerender();
  },
});

/* ───────── validation, waitlist, messages, client file, e-mails ───────── */
Object.assign(ACT, {
  rsAccept: async (a, id) => {
    const b = rsRows().find((x) => x.id === id); if (!b) return; SFX.ok(); buzz([10, 40, 14]);
    const card = a.closest(".rs-req"); if (card) card.classList.add("rs-gone");
    if (document.querySelector("#sheetBody .rs-bk")) closeSheet(true);
    if (await rsSave(id, { status: rsWeb(b) ? "en ligne" : "avenir", seen: true, decidedAt: Date.now(), by: S.me.id })) {
      const r = a.getBoundingClientRect(); burst(r.left + r.width / 2, r.top);
      toast(`Table confirmée pour ${firstName(b.name) || "le client"}${b.email ? (rsSrv() ? " · e-mail envoyé" : " · pensez à le prévenir") : ""}`);
    } else if (card) card.classList.remove("rs-gone");
  },
  rsRefuse: (a, id) => { SFX.tap(); rsMsgSheet(id, "refuse"); },
  rsPromote: async (a, id) => {
    const b = rsRows().find((x) => x.id === id); if (!b) return; const cfg = rsCfg();
    const used = rsUsed(cfg, b.date)[rsBucket(cfg, b.date, b.time)] || 0;
    SFX.ok(); buzz(10); closeSheet(true);
    if (await rsSave(id, { status: rsWeb(b) ? "en ligne" : "avenir", seen: true, promotedAt: Date.now() }))
      toast(`${firstName(b.name) || "Client"} passe en réservation${cfg.maxPerSlot && used + (+b.covers || 0) > cfg.maxPerSlot ? " (au-delà du maximum du créneau)" : ""}${b.email && rsSrv() ? " · e-mail envoyé" : b.phone ? " · appelez-le pour lui dire" : ""}`);
  },
  rsResend: async (a, id) => { a.disabled = true; SFX.tap(); if (await rsSave(id, { resendAt: Date.now() })) { SFX.ok(); toast("Confirmation renvoyée"); } else a.disabled = false; },
  rsMsgChip: (a) => { const t = $("#rsMsgTx"); if (!t) return; SFX.tick(); t.value = a.dataset.txt || a.textContent; if (R.msg) R.msg.text = t.value; t.focus(); },
  rsMsgOk: async (a) => {
    const m = R.msg; if (!m) return; const b = rsRows().find((x) => x.id === m.id); if (!b) return;
    const text = String(($("#rsMsgTx") || {}).value || "").trim().slice(0, 300);
    a.disabled = true; SFX.close(); buzz(6);
    if (await rsSave(m.id, { status: m.kind === "refuse" ? "refuse" : "annule", cancelledBy: "resto", resaMsg: text, seen: true, decidedAt: Date.now(), by: S.me.id })) {
      R.msg = null; closeSheet(true);
      toast(`${m.kind === "refuse" ? "Demande refusée" : "Réservation annulée"}${b.email ? (rsSrv() ? " · le client est prévenu par e-mail" : " · pensez à prévenir le client") : ""}`);
    } else a.disabled = false;
  },
  rsClFull: (a, id) => { SFX.tap(); R.cl = null; if (typeof fdWatch === "function") fdWatch(); fdOpenSheet(id); },
  rsClient: (a, id) => { const b = rsRows().find((x) => x.id === id); if (!b || !rsPk(b.phone)) return; SFX.tap(); rsClientSheet(b); },
  rsClVip: (a) => { if (!R.cl) return; R.cl.vip = !R.cl.vip; R.cl.vip ? SFX.ok() : SFX.tap(); buzz(4); a.classList.toggle("on", R.cl.vip); a.setAttribute("aria-pressed", R.cl.vip); },
  rsClSave: async (a) => {
    const c = R.cl; if (!c) return; c.notes = String(($("#rsClNotes") || {}).value || "").trim().slice(0, 300);
    a.disabled = true;
    /* keep what js/clients.js keeps in the same file (allergies, birthday, consent, loyalty stamps) */
    const { id: _cid, ...was } = R.clients.find((x) => x.id === c.id) || {};
    try { await safe(DB.set("clients", c.id, DB.clean({ ...was, name: String(c.name || "").slice(0, 60), phone: String(c.phone || "").slice(0, 25), email: String(c.email || "").slice(0, 120), vip: !!c.vip, notes: c.notes, updatedAt: Date.now() }))); } catch (e) { a.disabled = false; return; }
    R.cl = null; closeSheet(true); SFX.done(); toast("Fiche client enregistrée");
  },
  rsEdSug: (a, id, v) => {
    rsEdKeep(); const c = rsPeople().find((x) => x.id === v); if (!c || !R.ed) return; SFX.tick(); buzz(4);
    R.ed.name = c.name || R.ed.name; R.ed.phone = c.phone || R.ed.phone; if (c.email && !R.ed.email) R.ed.email = c.email; rsEdPaint();
  },
  /* settings: validation mode, waitlist, reminder, e-mail previews */
  rsCeVal: (a, id, v) => { rsCeKeep(); SFX.tick(); buzz(4); R.ce.validate = v === "1"; rsCfgPaint(); },
  rsCeWl: () => { rsCeKeep(); R.ce.waitlist = R.ce.waitlist === false; R.ce.waitlist ? SFX.ok() : SFX.tap(); rsCfgPaint(); },
  rsCeRem: () => { rsCeKeep(); R.ce.reminder = R.ce.reminder === false; R.ce.reminder ? SFX.ok() : SFX.tap(); rsCfgPaint(); },
  rsCeRevAsk: () => { rsCeKeep(); R.ce.reviewAsk = R.ce.reviewAsk === false; R.ce.reviewAsk ? SFX.ok() : SFX.tap(); buzz(6); rsCfgPaint(); },
  rsCeRevWhen: (a, id, v) => { rsCeKeep(); SFX.tick(); buzz(3); R.ce.reviewWhen = v === "lendemain" ? "lendemain" : "soir"; rsCfgPaint(); },
  rsRevHelp: () => { rsCeKeep(); SFX.tap(); R.revHelp = !R.revHelp; rsCfgPaint(); },
  rsRevSent: (a, id) => { const b = rsRows().find((x) => x.id === id); if (!b) return; SFX.ok(); rsSave(id, { reviewSmsAt: Date.now() }); },
  rsMailPrev: (a, id, v) => {
    rsCeKeep(); SFX.tap(); const c = R.ce || rsCfg(), d = addDays(dayKey(), 3);
    const b = { name: "Camille Martin", date: d, time: "20:00", covers: 4, notes: "Anniversaire", resaMsg: v === "refuse" ? "Complet ce soir-là, désolés ! Le lendemain nous avons encore de la place." : v === "annule" ? "Fermeture exceptionnelle, toutes nos excuses." : "" };
    const html = rsMailHtml(v, b, { name: (S.resto && S.resto.name) || "Votre restaurant", address: c.address || "", phone: c.phone || "", logo: rsLogo() }, { manage: "#", ics: "#", book: "#", review: "#" });
    const K = RS_MAIL_KINDS[v] || RS_MAIL_KINDS.confirme;
    openSheet(`<div class="rs-mpv"><div class="rs-edh"><span class="h2">Aperçu</span><button class="iconbtn" data-act="rsMailBack" aria-label="Retour">${ico("x")}</button></div>
      <div class="rs-mpo"><span>Objet</span><b>${esc(K.s({ name: (S.resto && S.resto.name) || "Votre restaurant" }, b, rsMailDay(d)))}</b></div>
      <iframe class="rs-mpf" sandbox="" title="Aperçu de l'e-mail"></iframe>
      ${rsSrv() ? "" : `<div class="rs-mail">${ico("rsMail")}<span>Bientôt actif : ces e-mails partiront tout seuls dès que l'envoi sera branché.</span></div>`}
      <button class="btn soft block" data-act="rsMailBack">Retour aux réglages</button></div>`, (el) => { const f = el.querySelector(".rs-mpf"); if (f) f.srcdoc = html; const sb = $("#sheetBody"); if (sb) sb.scrollTop = 0; });
  },
  rsMailBack: () => { SFX.tap(); if (R.ce) { R.ctab = R.ctab === "a" ? "a" : "w"; rsCfgPaint(); setTimeout(() => { const m = document.querySelector("#sheetBody .rs-mls"); if (m) m.scrollIntoView({ block: "center" }); }, 30); } else closeSheet(); },
});

/* drag & drop (mouse): a card onto a time (group header or timeline bar) moves it; a booking onto a table seats it */
(function rsDnD() {
  let drag = null;
  document.addEventListener("dragstart", (e) => { const el = e.target.closest && e.target.closest("[data-rsdrag]"); if (!el || S.route !== "resa") return; drag = el.dataset.rsdrag; try { e.dataTransfer.setData("text/plain", drag); e.dataTransfer.effectAllowed = "move"; } catch (x) {} el.classList.add("rs-drag"); document.documentElement.classList.add("rs-dragging"); });
  document.addEventListener("dragend", () => { drag = null; document.querySelectorAll(".rs-drag,.rs-over").forEach((x) => x.classList.remove("rs-drag", "rs-over")); document.documentElement.classList.remove("rs-dragging"); });
  const tgt = (e) => e.target.closest && e.target.closest("[data-rsdrop],[data-rsdropt]");
  document.addEventListener("dragover", (e) => { if (!drag) return; const t = tgt(e); if (!t) return; e.preventDefault(); document.querySelectorAll(".rs-over").forEach((x) => x !== t && x.classList.remove("rs-over")); t.classList.add("rs-over"); });
  document.addEventListener("drop", async (e) => {
    if (!drag) return; const t = tgt(e); if (!t) return; e.preventDefault(); const id = drag; drag = null;
    const b = rsRows().find((x) => x.id === id); if (!b) return;
    if (t.dataset.rsdropt) { const tb = rsCfg().tables.find((x) => x.id === t.dataset.rsdropt); SFX.ok(); if (await rsSave(id, { table: t.dataset.rsdropt, tableWith: "", tableAuto: false })) toast(`Installé table ${tb ? tb.n : ""}`); return; }
    const time = t.dataset.rsdrop; if (time === b.time) return; SFX.ok(); R.flash = id; if (await rsSave(id, { time })) toast(`${firstName(b.name) || "Réservation"} déplacé à ${time}`);
  });
})();

/* ───────── demo: a believable week, and one online booking that drops in while you look ───────── */
function rsSeedDemo() {
  const path = `restos/${S.rid}/bookings`; const rs = DB.local.restos && DB.local.restos[S.rid];
  if (rs && !rs.resaCfg) {
    rs.resaCfg = { ...rsDefCfg(), online: true, validate: true, maxPerSlot: 14, address: "8 place du Marché, Lyon 2e", phone: "04 78 42 18 90", msg: "Terrasse chauffée. Au-delà de 8 personnes, appelez-nous.",
      googleReview: "https://g.page/r/CbistrotDemoGG/review", reviewAsk: true, reviewWhen: "soir",
      tables: [["1", 2], ["2", 2], ["3", 4], ["4", 4], ["5", 4], ["6", 4], ["7", 6], ["8", 6], ["9", 8], ["20", 2, "terrasse"], ["21", 4, "terrasse"], ["22", 4, "terrasse"], ["23", 6, "terrasse"]].map(([n, seats, zone], i) => ({ id: "dt" + i, n, seats, zone: zone || "salle" })) };
    try { DB.emit("restos"); } catch (e) {}
  }
  if (rs && rs.resaCfg && rs.resaCfg.googleReview == null) rs.resaCfg.googleReview = "https://g.page/r/CbistrotDemoGG/review";
  if (DB.local[path]) return;
  let seed = 61106; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const names = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand", "Garnier", "Faure", "Rousseau", "Blanc", "Guerin", "Muller", "Henry", "Roussel", "Nicolas", "Perrin"];
  const first = ["Sophie", "Julien", "Claire", "Antoine", "Camille", "Nicolas", "Léa", "Mathieu", "Emma", "Pierre", "Chloé", "Hugo", "Manon", "Louis", "Sarah", "Paul"];
  const notes = ["Allergie fruits à coque", "Anniversaire, prévoir une bougie", "Chaise bébé", "Terrasse si possible", "Sans gluten", "Allergie crustacés", "Client fidèle, table près de la fenêtre", "Repas d'affaires", "Arrivera un peu en retard", "Végétarien ×2"];
  const D = {}; const today = dayKey(), cfg = rsCfg(), nowM = new Date().getHours() * 60 + new Date().getMinutes();
  let n = 0; const tables = cfg.tables;
  for (let i = -3; i < 11; i++) {
    const k = addDays(today, i); const svcs = rsSvcsOn(cfg, k); const w = rsDow(k);
    svcs.forEach((s) => {
      const busy = (s.id === "soir" ? 1 : 0.7) * (w === 5 || w === 6 ? 1.35 : w === 4 ? 1.1 : 0.85) * (i > 5 ? 0.45 : i > 2 ? 0.7 : 1);
      const count = Math.round((7 + rnd() * 6) * busy); const slots = rsSlots(cfg, s); const usedT = new Set();
      for (let j = 0; j < count; j++) {
        const time = slots[Math.min(slots.length - 1, Math.floor(Math.pow(rnd(), 0.9) * slots.length * 0.85))];
        const covers = pick([2, 2, 2, 2, 3, 4, 4, 4, 2, 5, 6, 2, 3, 8]);
        const web = rnd() < 0.32; const nm = rnd() < 0.55 ? `${pick(first)} ${pick(names)}` : pick(names);
        let status = "avenir";
        const past = i < 0 || (i === 0 && rsMin(time) + 20 < nowM);
        if (past) status = rnd() < 0.06 ? "noshow" : rnd() < 0.05 ? "annule" : "arrive"; else if (rnd() < 0.04) status = "annule";
        if (web && status === "avenir") status = "en ligne";
        let table = "";
        if (i === 0 && rnd() < 0.8) { const fit = tables.filter((t) => t.seats >= covers && !usedT.has(t.id)); if (fit.length) { table = fit[0].id; usedT.add(table); } }
        const id = "bk" + (++n).toString(36).padStart(3, "0");
        D[id] = { date: k, time, covers, name: nm, phone: `06 ${pad(Math.floor(rnd() * 90 + 10))} ${pad(Math.floor(rnd() * 90 + 10))} ${pad(Math.floor(rnd() * 90 + 10))} ${pad(Math.floor(rnd() * 90 + 10))}`, notes: rnd() < 0.2 ? pick(notes) : "", status, source: web ? "web" : "tel", table, createdAt: Date.now() - Math.floor(rnd() * 9 * 864e5) - 3600e3, seen: true, ...(web && rnd() < 0.6 ? { email: `${nm.split(" ").pop().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@mail.fr` } : {}) };
      }
    });
  }
  /* two online bookings not seen yet, so the « Nouveau » badge shows on first open */
  Object.values(D).filter((b) => b.source === "web" && b.date >= today && b.status === "en ligne").slice(0, 2).forEach((b) => { b.seen = false; b.createdAt = Date.now() - 40 * 60e3; });
  /* validation mode: requests waiting for an answer, a waitlist on a full evening, regulars with a file */
  const soir = (i) => { for (let j = i; j < i + 7; j++) { const k = addDays(today, j); if (rsSvcsOn(cfg, k).some((x) => x.id === "soir")) return k; } return addDays(today, i); };
  const reg = [["Sophie Laurent", "06 12 48 77 31", "sophie.laurent@mail.fr", true, "Allergie fruits à coque · aime la table 7"], ["Hugo Mercier", "06 33 90 12 54", "hugo.mercier@mail.fr", false, "Toujours en terrasse"], ["Manon Girard", "07 61 05 44 18", "", false, ""]];
  const add = (o) => { D["bk" + (++n).toString(36).padStart(3, "0")] = { notes: "", table: "", seen: true, createdAt: Date.now() - 5 * 864e5, ...o }; };
  /* past visits of the regulars (and Manon's two no-shows) */
  [[-30, 0, 2], [-21, 0, 4], [-12, 0, 2], [-5, 0, 2], [-26, 1, 3], [-9, 1, 2], [-40, 2, 2], [-18, 2, 4]].forEach(([d, r, c], i) => { const [nm, ph, em] = reg[r]; add({ date: addDays(today, d), time: i % 2 ? "12:30" : "20:00", covers: c, name: nm, phone: ph, email: em, status: r === 2 ? "noshow" : "arrive", source: i % 3 ? "tel" : "web" }); });
  const k1 = soir(1), k2 = soir(2), k0 = soir(0);
  add({ date: k1, time: "20:00", covers: 2, name: reg[0][0], phone: reg[0][1], email: reg[0][2], status: "avalider", source: "web", seen: false, createdAt: Date.now() - 25 * 60e3, notes: "Notre anniversaire de mariage" });
  add({ date: k2, time: "19:30", covers: 6, name: "Thomas Bertrand", phone: "06 58 21 73 40", email: "t.bertrand@mail.fr", status: "avalider", source: "web", seen: false, createdAt: Date.now() - 2 * 3600e3 });
  add({ date: k0, time: "20:30", covers: 3, name: reg[2][0], phone: reg[2][1], status: "attente", source: "web", seen: false, createdAt: Date.now() - 50 * 60e3 });
  add({ date: k0, time: "20:00", covers: 2, name: "Paul Henry", phone: "06 47 19 82 66", email: "paul.henry@mail.fr", status: "attente", source: "web", seen: true, createdAt: Date.now() - 3 * 3600e3 });
  add({ date: k1, time: "12:30", covers: 4, name: reg[1][0], phone: reg[1][1], email: reg[1][2], status: "en ligne", source: "web", mailLog: [{ k: "confirme", at: Date.now() - 864e5 }] });
  /* « Votre dîner s'est bien passé ? »: already asked to the guests who came and left an e-mail, a few by SMS */
  Object.values(D).filter((b) => b.status === "arrive" && b.date < today).forEach((b, i) => { const t = new Date(`${b.date}T${b.time}:00`).getTime() + 150 * 60e3; if (b.email) { b.reviewAskAt = t; b.mailLog = [...(b.mailLog || []), { k: "avis", at: t }]; } else if (i % 5 === 0) b.reviewSmsAt = t - 60 * 60e3; });
  Object.values(D).filter((b) => b.email && rsConf(b) && b.date >= today && !b.mailLog).slice(0, 12).forEach((b) => { b.mailLog = [{ k: "confirme", at: (+b.createdAt || Date.now()) + 4000 }]; });
  DB.local[`restos/${S.rid}/clients`] = Object.fromEntries(reg.slice(0, 2).map(([nm, ph, em, vip, notes]) => [rsPk(ph), { name: nm, phone: ph, email: em, vip, notes, updatedAt: Date.now() - 6 * 864e5 }]));
  DB.local[path] = D;
}
function rsDemoPing() {
  if (DB.mode !== "demo" || !S.rid) return;
  const cfg = rsCfg(); let k = dayKey(), s = null, t = null;
  for (let i = 0; i < 6 && !t; i++) { k = addDays(dayKey(), i); const sv = rsSvcsOn(cfg, k).filter((x) => x.id === "soir"); if (sv.length) { s = sv[0]; const sl = rsSlots(cfg, s); t = sl[Math.min(sl.length - 1, 4)]; if (i === 0 && rsMin(t) < new Date().getHours() * 60 + 60) t = null; } }
  if (!t) return;
  DB.add("bookings", { date: k, time: t, covers: 4, name: "Élodie Marchand", phone: "06 71 22 48 09", email: "elodie.marchand@mail.fr", notes: "Anniversaire de ma mère", status: cfg.validate ? "avalider" : "en ligne", source: "web", createdAt: Date.now(), at: parseDay(k).getTime() + rsMin(t) * 6e4 }).catch(() => {});
}

/* ───────── public API (home screen, alerts) ───────── */
window.RESA = {
  today() { rsWatch(); const l = rsOfDay(dayKey()).filter(rsLive); return { covers: rsCovers(l), count: l.length, loaded: !!R.rows }; },
  unseen() { rsWatch(); return rsUnseen(); },
  cfg: () => rsCfg(),
  open(day) { if (day) R.day = day; go("resa"); },
};
/* keep listening (new online bookings, projection) once the restaurant uses reservations, whatever the screen */
window.addEventListener("gg:ready", () => { if (S.resto && S.resto.resaCfg) rsWatch(); });
setInterval(() => { if (S.ready && S.rid && ((S.resto && S.resto.resaCfg) || R.rid)) rsWatch(); }, 4000);
