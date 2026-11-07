/* Growth Gusto — notifications by role (js/notifs.js). Firebase Functions v2, Node 22, region europe-west9.
   Who gets what: each person's choice (restos/{rid}/push/{memberId}.prefs), else the defaults of their role and poste (same table as
   NF_DEF in js/notifs.js). Each phone, tablet or computer can follow the account or have its own list (push/{mid}.devs[devId].kinds).
   Delivery: Firebase Cloud Messaging (free) → a standard Web Push, shown by sw.js. iPhone: iOS 16.4+, app added to the home screen.
   Exports (functions/index.js picks them up):
     onOrderNotif   Firestore trigger on restos/{rid}/clientOrders/{id}: a ticket reaches the kitchen or the bar (k_new / b_new),
                    is claimed (k_rush), changed or cancelled (k_mod), is ready (s_ready, to the waiter who sent it), the kitchen calls
                    the waiter back (s_call), a QR / takeaway order comes in (qr).
     onTabNotif     trigger on restos/{rid}/salleTabs/{id}: a line offered or cancelled after it was sent (geste, for the boss).
     onAlertNotif   trigger on a new restos/{rid}/alerts doc: fridge, DLC, sensor, obligation (haccp); a client cancels a booking (resa).
     onResaNotif    trigger on restos/{rid}/bookings/{id}: a new online or imported booking (resa).
     onHsAlertNotif trigger on a new restos/{rid}/hsAlerts doc: overtime threshold or legal frame (heures), to the chosen managers.
     onNotifCreated trigger on restos/{rid}/notifs/{id}: a notification asked by the app (the « essai » button, other modules), then deleted.
     notifsTick     plain function for the single 15-min job: the takings of the service, at the end of lunch and of dinner (ca).
     _notify(rid, ev) helper for other server modules: ev = { kind, title, body, url, tag, only?:[memberId], except?:uid }.
   Cost: every trigger leaves at once when the change is not one of the events above (no read). The team's push docs and members are
   cached 30 s per instance. Nothing is stored per notification. */
"use strict";
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const REGION = "europe-west9", TZ = "Europe/Paris";

/* ───────── what each role gets by default (same as NF_DEF in js/notifs.js) ───────── */
const KINDS = ["k_new", "k_rush", "k_mod", "b_new", "s_ready", "s_call", "qr", "resa", "ca", "haccp", "geste", "heures", "consigne", "chat", "rh"];
const DEF = {
  patron: ["qr", "resa", "ca", "haccp", "geste", "heures", "consigne", "chat", "rh"],
  chef: ["k_new", "k_rush", "k_mod", "haccp", "heures", "consigne", "chat", "rh"],
  cuisine: ["k_new", "k_rush", "k_mod", "consigne", "chat", "rh"],
  salle: ["s_ready", "s_call", "qr", "resa", "consigne", "chat", "rh"],
  bar: ["b_new", "s_ready", "s_call", "consigne", "chat", "rh"],
  plonge: ["consigne", "chat", "rh"],
};
const POSTE = { cuisine: "cuisine", second: "cuisine", salle: "salle", bar: "bar", plonge: "plonge" };
function profileOf(m, post) {
  if (!m) return "cuisine";
  if (m.role === "gerant") return "patron";
  if (m.role === "chef") return "chef";
  return POSTE[m.poste || post || ""] || "cuisine";
}
/* is this kind on for this person, on this device? */
function wants(m, post, p, dev, kind) {
  const pr = (p && p.prefs) || {};
  if (dev && dev.mute) return false;
  if (dev && dev.kinds && typeof dev.kinds[kind] === "boolean") return dev.kinds[kind];
  if (pr.kinds && typeof pr.kinds[kind] === "boolean") return pr.kinds[kind];
  return DEF[profileOf(m, post)].includes(kind);
}

/* ───────── Paris time ───────── */
function paris(ts = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, wd: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday] };
}
const hmMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
const addDays = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function quietNow(q, now = paris()) {
  if (!q || !q.on) return false; const a = hmMin(q.from), b = hmMin(q.to); if (a == null || b == null || a === b) return false;
  return a < b ? now.min >= a && now.min < b : now.min >= a || now.min < b;
}
const eur = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: (+v || 0) % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ | /g, " ") + " €";
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "";

/* ───────── the team of a restaurant (cached 30 s) ───────── */
const CACHE = new Map();
async function teamOf(rid) {
  const c = CACHE.get(rid); if (c && Date.now() - c.at < 30e3) return c;
  const [push, mem, staff] = await Promise.all([db().collection(`restos/${rid}/push`).get(), db().collection(`restos/${rid}/members`).get(), db().collection(`restos/${rid}/staff`).get()]);
  const members = {}; mem.docs.forEach((d) => { members[d.id] = d.data() || {}; });
  const post = {}, staffOf = {}; staff.docs.forEach((d) => { const s = d.data() || {}; if (s.memberId) { if (s.post) post[s.memberId] = s.post; staffOf[s.memberId] = d.id; } });
  const pushes = {}; push.docs.forEach((d) => { if (members[d.id]) pushes[d.id] = d.data() || {}; });
  const t = { at: Date.now(), members, post, staffOf, pushes };
  CACHE.set(rid, t); if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value);
  return t;
}
/* who is clocked in right now (only read when someone asked « seulement quand j'ai pointé ») */
async function onShift(rid, day) {
  const snap = await db().collection(`restos/${rid}/punches`).where("day", "in", [day, addDays(day, -1)]).get();
  const last = {}; snap.docs.map((d) => d.data() || {}).filter((p) => !p.void && p.staffId).sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((p) => { last[p.staffId] = p; });
  const on = new Set(); Object.entries(last).forEach(([sid, p]) => { if (p.kind !== "out" && Date.now() - (p.at || 0) < 16 * 3600e3) on.add(sid); });
  return on;
}
/* every device of this person that wants this kind: [{t, mid, dev}] */
function devicesOf(mid, p) {
  const out = []; const seen = new Set();
  Object.entries((p && p.devs) || {}).forEach(([id, d]) => { if (d && typeof d.t === "string" && d.t && !seen.has(d.t)) { seen.add(d.t); out.push({ t: d.t, dev: d, id }); } });
  (Array.isArray(p && p.tokens) ? p.tokens : []).slice(-5).forEach((t) => { if (typeof t === "string" && t && !seen.has(t)) { seen.add(t); out.push({ t, dev: null, id: null }); } });
  return out;
}

/* ───────── send ───────── */
async function _notify(rid, ev) {
  if (!rid || !ev || !ev.kind) return 0;
  const T = await teamOf(rid);
  const only = ev.only ? new Set(ev.only) : null; const now = paris();
  const picks = []; let needShift = false;
  for (const [mid, p] of Object.entries(T.pushes)) {
    if (ev.except && mid === ev.except) continue;
    if (only && !only.has(mid)) continue;
    const m = T.members[mid]; const pr = p.prefs || {};
    if (ev.kind !== "test" && quietNow(pr.quiet, now) && !(ev.urgent && pr.urgentInQuiet !== false)) continue;
    /* « Plats prêts » : by default only the tables I sent, unless I asked for all of them */
    if (ev.waiter && (ev.kind === "s_ready" || ev.kind === "s_call") && mid !== ev.waiter && !pr.readyAll) continue;
    const devs = devicesOf(mid, p).filter((x) => ev.kind === "test" || wants(m, T.post[mid], p, x.dev, ev.kind));
    if (!devs.length) continue;
    if (pr.shiftOnly && ev.kind !== "test" && !["ca", "haccp"].includes(ev.kind)) needShift = true;
    picks.push({ mid, pr, devs });
  }
  let on = null; if (needShift) { try { on = await onShift(rid, now.day); } catch (e) { logger.warn("notifs shift", e && e.message); } }
  const all = [];
  picks.forEach(({ mid, pr, devs }) => {
    if (on && pr.shiftOnly && ev.kind !== "test" && !["ca", "haccp"].includes(ev.kind) && !(T.staffOf[mid] && on.has(T.staffOf[mid]))) return;
    devs.forEach((x) => all.push({ ...x, mid }));
  });
  if (!all.length) return 0;
  let sent = 0; const dead = {};
  const data = { title: cut(ev.title, 80), body: cut(ev.body, 200), url: ev.url || "./", tag: ev.tag || `gg-${ev.kind}`, kind: ev.kind, at: String(Date.now()) };
  for (let i = 0; i < all.length; i += 500) {
    const part = all.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({ tokens: part.map((x) => x.t), data, webpush: { headers: { Urgency: "high", TTL: String(ev.ttl || 2 * 3600) } } });
    res.responses.forEach((r, k) => {
      if (r.success) { sent++; return; }
      const code = r.error && r.error.code;
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(code)) (dead[part[k].mid] ||= []).push(part[k]);
      else logger.warn("notifs send", code);
    });
  }
  /* dead tokens: removed from the person's doc (the device entry goes too) */
  await Promise.all(Object.entries(dead).map(([mid, L]) => {
    const patch = { tokens: admin.firestore.FieldValue.arrayRemove(...L.map((x) => x.t)) };
    L.forEach((x) => { if (x.id) patch[`devs.${x.id}`] = admin.firestore.FieldValue.delete(); });
    CACHE.delete(rid);
    return db().doc(`restos/${rid}/push/${mid}`).update(patch).catch(() => {});
  }));
  return sent;
}

/* ───────── kitchen tickets and QR orders ───────── */
const plates = (o) => (o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0);
const lines = (o, n = 4) => { const L = (o.items || []).filter((x) => !x.off); const s = L.slice(0, n).map((x) => `${+x.q > 1 ? x.q + " " : ""}${x.name || "Plat"}`).join(", "); return L.length > n ? s + "…" : s; };
const who = (o) => (o.src === "salle" ? `Table ${o.table}` : o.mode === "table" && o.table ? `Commande QR · Table ${o.table}` : `À emporter n°${o.n || "?"}${o.name ? " · " + first(o.name) : ""}`);
const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - (+t || Date.now())) / 6e4)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
function orderEvents(a, b) {
  const out = []; if (!b) return out;
  const st0 = a ? a.status : null, st = b.status; const bar = b.station === "bar";
  const course = b.courseT ? ` · ${b.courseT}` : "";
  const by = b.waiterName ? ` · ${first(b.waiterName)}` : "";
  /* reaches the kitchen (or the bar) */
  if (st === "nouvelle" && st0 !== "nouvelle" && !["prep", "prete", "servie"].includes(st0)) {
    const n = plates(b);
    out.push({ kind: bar ? "b_new" : "k_new", title: `${b.refire ? "À refaire · " : ""}${who(b)}${course}`, body: `${n} ${bar ? "boisson" : "assiette"}${n > 1 ? "s" : ""} : ${lines(b)}${by}`, url: "./?go=cuisine", tag: `gg-o-${b.n || ""}-${b.course ?? ""}`, urgent: !!b.rush });
    if (b.src === "qr") out.push({ kind: "qr", title: b.mode === "table" ? `Nouvelle commande · Table ${b.table}` : `Commande à emporter n°${b.n || "?"}`, body: `${eur(b.total)}${b.slot ? ` · retrait ${b.slot}` : ""}${b.paid ? " · payée en ligne" : ""} · ${lines(b, 3)}`, url: "./?go=commandes", tag: `gg-qr-${b.n || ""}` });
  }
  if (!a) return out;
  if (b.push && b.push !== a.push && ["nouvelle", "prep"].includes(st)) out.push({ kind: bar ? "b_new" : "k_rush", title: `${who(b)} réclame${course ? " ses " + String(b.courseT).toLowerCase() : ""}`, body: `Envoyé il y a ${ago(b.firedAt || b.at)} · ${lines(b, 3)}`, url: "./?go=cuisine", tag: `gg-rush-${b.n || ""}`, urgent: true });
  if (b.mod && b.mod !== a.mod && st !== "annulee" && ["nouvelle", "prep"].includes(st)) out.push({ kind: "k_mod", title: `${who(b)}${course} · bon modifié`, body: lines(b), url: "./?go=cuisine", tag: `gg-o-${b.n || ""}-${b.course ?? ""}` });
  if (st === "annulee" && st0 && !["annulee", "attente", "servie", "apayer"].includes(st0)) out.push({ kind: "k_mod", title: `${who(b)}${course} · bon annulé`, body: `À ne pas envoyer : ${lines(b, 3)}`, url: "./?go=cuisine", tag: `gg-o-${b.n || ""}-${b.course ?? ""}`, urgent: true });
  if (st === "prete" && st0 !== "prete") {
    const n = plates(b);
    out.push({ kind: "s_ready", title: `${who(b)}${course} · prêt`, body: b.src === "salle" ? `${n} assiette${n > 1 ? "s" : ""} à envoyer : ${lines(b, 3)}` : `À remettre au client · ${lines(b, 3)}`, url: b.src === "salle" ? `./?go=salle` : "./?go=commandes", tag: `gg-rdy-${b.n || ""}-${b.course ?? ""}`, waiter: b.src === "salle" ? b.waiter || null : null, except: b.by || null });
  }
  if (b.call && b.call !== a.call && st === "prete") out.push({ kind: "s_call", title: "La cuisine vous appelle", body: `${who(b)}${course} · prêt depuis ${ago(b.readyAt)}`, url: "./?go=salle", tag: `gg-rdy-${b.n || ""}-${b.course ?? ""}`, waiter: b.waiter || null, urgent: true });
  return out;
}
const onOrderNotif = onDocumentWritten({ document: "restos/{rid}/clientOrders/{oid}", region: REGION, memory: "256MiB", maxInstances: 10 }, async (ev) => {
  const a = ev.data.before.exists ? ev.data.before.data() : null, b = ev.data.after.exists ? ev.data.after.data() : null;
  const evs = orderEvents(a, b); if (!evs.length) return;
  for (const e of evs) { try { await _notify(ev.params.rid, e); } catch (x) { logger.error("onOrderNotif", x); } }
});

/* ───────── a line offered or cancelled after it was sent (for the boss) ───────── */
function tabEvents(a, b) {
  if (!a || !b || !Array.isArray(b.items)) return [];
  const before = {}; (a.items || []).forEach((x) => { if (x && x.k) before[x.k] = x; });
  const free = [], off = [];
  b.items.forEach((x) => {
    if (!x || !x.k) return; const y = before[x.k];
    if (x.free && !(y && y.free) && x.free.why !== "Refait") free.push(x);
    if (x.off && y && !y.off && x.sent) off.push(x);
  });
  const out = []; const by = first(b.lastByName || b.byName);
  const sum = (L) => L.reduce((s, x) => s + (+x.price || 0) * (+x.q || 1), 0);
  if (free.length) out.push({ kind: "geste", title: `Offert · Table ${b.table}`, body: `${free.map((x) => `${+x.q > 1 ? x.q + " " : ""}${x.name}`).join(", ")} (${eur(sum(free))})${free[0].free && free[0].free.why ? ` · « ${cut(free[0].free.why, 40)} »` : ""}`, url: "./?go=salle", tag: `gg-geste-${b.table}` });
  if (off.length) out.push({ kind: "geste", title: `Annulé après envoi · Table ${b.table}`, body: `${off.map((x) => `${+x.q > 1 ? x.q + " " : ""}${x.name}`).join(", ")} (${eur(sum(off))})${off[0].offReason ? ` · « ${cut(off[0].offReason, 40)} »` : ""}${by ? ` · ${by}` : ""}`, url: "./?go=salle", tag: `gg-geste-${b.table}` });
  return out;
}
const onTabNotif = onDocumentWritten({ document: "restos/{rid}/salleTabs/{tid}", region: REGION, memory: "256MiB", maxInstances: 5 }, async (ev) => {
  const a = ev.data.before.exists ? ev.data.before.data() : null, b = ev.data.after.exists ? ev.data.after.data() : null;
  const evs = tabEvents(a, b); if (!evs.length) return;
  for (const e of evs) { try { await _notify(ev.params.rid, e); } catch (x) { logger.error("onTabNotif", x); } }
});

/* ───────── HACCP alerts, client cancellations ───────── */
const onAlertNotif = onDocumentCreated({ document: "restos/{rid}/alerts/{aid}", region: REGION, memory: "256MiB", maxInstances: 5 }, async (ev) => {
  const x = ev.data && ev.data.data(); if (!x || x.seen || (x.at && Date.now() - x.at > 6 * 3600e3)) return;
  const resa = x.type === "resa";
  try { await _notify(ev.params.rid, { kind: resa ? "resa" : "haccp", title: cut(x.text || (resa ? "Réservation" : "Alerte"), 80), body: x.sub || (x.level === "bad" ? "À traiter maintenant" : ""), url: resa ? "./?go=resa" : "./?go=alertes", tag: `gg-al-${ev.params.aid}`.slice(0, 60), urgent: x.level === "bad", ttl: 12 * 3600 }); } catch (e) { logger.error("onAlertNotif", e); }
});

/* ───────── new bookings (online page, or another booking tool) ───────── */
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."], JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const dayTxt = (k) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k || ""))) return ""; const d = new Date(k + "T12:00:00Z"); const t = paris().day; return k === t ? "ce soir" : k === addDays(t, 1) ? "demain" : `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`; };
const onResaNotif = onDocumentWritten({ document: "restos/{rid}/bookings/{bid}", region: REGION, memory: "256MiB", maxInstances: 5 }, async (ev) => {
  const a = ev.data.before.exists ? ev.data.before.data() : null, b = ev.data.after.exists ? ev.data.after.data() : null;
  if (a || !b) return; /* creation only */
  const online = b.ext || ["en ligne", "avalider"].includes(b.status) || b.src === "online" || b.source === "online";
  if (!online) return;
  const ask = b.status === "avalider";
  const when = [dayTxt(b.date), b.time].filter(Boolean).join(" à ");
  try { await _notify(ev.params.rid, { kind: "resa", title: ask ? "Demande de réservation à valider" : "Nouvelle réservation", body: `${b.name || "Client"} · ${+b.covers || "?"} pers.${when ? " · " + when : ""}${b.ext ? ` · via ${b.ext}` : ""}`, url: "./?go=resa", tag: `gg-resa-${ev.params.bid}`.slice(0, 60), ttl: 12 * 3600 }); } catch (e) { logger.error("onResaNotif", e); }
});

/* ───────── overtime and working time (js/heuressup.js): one doc per finding, written once by any device of the team ─────────
   Sent on creation only, to the managers the gérant chose (restos/{rid}.hsCfg.to, gérants and chefs only), by default every gérant. */
async function hsTargets(rid, T) {
  const r = (await db().doc(`restos/${rid}`).get()).data() || {}; const cfg = r.hsCfg || {}; if (cfg.on === false) return [];
  const mgr = Object.entries(T.members).filter(([, m]) => m && (m.role === "gerant" || m.role === "chef")).map(([id]) => id);
  const to = Array.isArray(cfg.to) ? cfg.to.filter((id) => mgr.includes(id)) : [];
  return to.length ? to : Object.entries(T.members).filter(([, m]) => m && m.role === "gerant").map(([id]) => id);
}
const onHsAlertNotif = onDocumentCreated({ document: "restos/{rid}/hsAlerts/{aid}", region: REGION, memory: "256MiB", maxInstances: 5 }, async (ev) => {
  const x = ev.data && ev.data.data(); if (!x || x.seen || x.quiet || typeof x.title !== "string" || (x.at && Date.now() - x.at > 24 * 3600e3)) return;
  const more = Math.min(99, Math.max(0, Math.floor(+x.more || 0)));
  const rid = ev.params.rid;
  try {
    const T = await teamOf(rid); const only = await hsTargets(rid, T); if (!only.length) return;
    await _notify(rid, { kind: "heures", title: cut(x.title, 80), body: cut(x.body || "", 170) + (more ? ` · et ${more} autre${more > 1 ? "s" : ""} alerte${more > 1 ? "s" : ""}` : ""), url: "./?go=planning", tag: `gg-hs-${String(ev.params.aid).slice(-40)}`, only, ttl: 24 * 3600 });
  } catch (e) { logger.error("onHsAlertNotif", e); }
});

/* ───────── a notification asked by the app (essai, other modules) ───────── */
const APP_KINDS = new Set(["test", ...KINDS]);
const onNotifCreated = onDocumentCreated({ document: "restos/{rid}/notifs/{nid}", region: REGION, memory: "256MiB", maxInstances: 5 }, async (ev) => {
  const rid = ev.params.rid; const x = (ev.data && ev.data.data()) || {};
  try {
    if (!APP_KINDS.has(x.kind) || typeof x.uid !== "string") return;
    const me = await db().doc(`restos/${rid}/members/${x.uid}`).get(); if (!me.exists) return;
    const only = x.kind === "test" ? [x.uid] : Array.isArray(x.to) ? x.to.filter((v) => typeof v === "string").slice(0, 50) : null;
    await _notify(rid, { kind: x.kind, title: String(x.title || "Growth Gusto"), body: String(x.body || ""), url: /^\.\/(\?go=[\w-]+)?$/.test(String(x.url || "")) ? x.url : "./", tag: x.kind === "test" ? "gg-test" : `gg-${x.kind}`, only, except: x.kind === "test" ? null : x.uid });
  } catch (e) { logger.error("onNotifCreated", e); }
  finally { await ev.data.ref.delete().catch(() => {}); }
});

/* ───────── the takings of the service, at the end of lunch and dinner ───────── */
async function caOf(rid, day) {
  const [tk, tabs] = await Promise.all([db().collection(`restos/${rid}/tickets`).where("date", "==", day).get(), db().collection(`restos/${rid}/salleTabs`).where("day", "==", day).get()]);
  let z = 0, zc = 0, zn = 0; tk.docs.forEach((d) => { const t = d.data() || {}; const v = +t.total; if (!isNaN(v)) { z += v; zn++; } zc += +t.covers || 0; });
  let s = 0, sc = 0, sn = 0; tabs.docs.forEach((d) => { const t = d.data() || {}; if (t.status !== "closed" || t.mergedInto) return; const v = +t.total || 0; if (v <= 0) return; s += v; sc += +t.covers || 0; sn++; });
  if (zn && z > 0) return { ttc: z, covers: zc, src: "z" };
  if (sn) return { ttc: s, covers: sc, tables: sn, src: "salle" };
  return null;
}
async function notifsTick() {
  const now = paris(); const restos = await db().collection("restos").get();
  for (const d of restos.docs) {
    const r = d.data() || {}; if (r.demo) continue;
    try {
      const slots = Object.assign({ midi: "14:30", soir: "22:30" }, (r.alertCfg && r.alertCfg.slots) || {});
      const svc = ["midi", "soir"].find((k) => { const m = hmMin(slots[k]); return m != null && now.min >= m && now.min < m + 15; });
      if (!svc) continue;
      if ((r.alertCfg && Array.isArray(r.alertCfg.closed) && r.alertCfg.closed.includes(now.wd))) continue;
      const mark = `${now.day}|${svc}`; if (r.nfCa === mark) continue;
      const T = await teamOf(d.id);
      const who = Object.entries(T.pushes).filter(([mid, p]) => { const pr = (p && p.prefs) || {}; if (pr.ca === "soir" && svc === "midi") return false; if (pr.ca === "midi" && svc === "soir") return false; return devicesOf(mid, p).some((x) => wants(T.members[mid], T.post[mid], p, x.dev, "ca")); }).map(([mid]) => mid);
      if (!who.length) continue;
      await d.ref.set({ nfCa: mark }, { merge: true });
      const ca = await caOf(d.id, now.day); if (!ca) continue;
      const week = await caOf(d.id, addDays(now.day, -7)).catch(() => null);
      const avg = ca.covers ? ca.ttc / ca.covers : 0;
      const delta = week && week.ttc > 0 ? Math.round((ca.ttc / week.ttc - 1) * 100) : null;
      const body = [ca.covers ? `${ca.covers} couverts` : ca.tables ? `${ca.tables} tables` : "", avg ? `ticket moyen ${eur(avg)}` : "", delta != null ? `${delta >= 0 ? "+" : ""}${delta} % vs la semaine dernière` : "", ca.src === "salle" ? "d'après les additions" : ""].filter(Boolean).join(" · ");
      await _notify(d.id, { kind: "ca", title: `${svc === "midi" ? "Ce midi" : "Aujourd'hui"} : ${eur(ca.ttc)} TTC`, body, url: "./?go=dashboard", tag: `gg-ca-${svc}`, only: who, ttl: 10 * 3600 });
    } catch (e) { logger.error("notifsTick", d.id, e); }
  }
}

module.exports = { onOrderNotif, onTabNotif, onAlertNotif, onResaNotif, onNotifCreated, onHsAlertNotif, notifsTick, _notify, _orderEvents: orderEvents, _tabEvents: tabEvents, _wants: wants, _quietNow: quietNow };
