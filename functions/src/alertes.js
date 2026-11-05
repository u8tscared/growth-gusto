/* Growth Gusto — server side of the alerts (js/alertes.js). Firebase Functions v2, Node 22, region europe-west9.
   Cost: no Cloud Scheduler job of its own. The lead's single scheduled job (functions/index.js) calls
     alertesTick()   every 15 min  → missed rounds, out-of-range readings, DLC + obligations (once a day), grouped e-mails, escalation
     alertesWeekly() Monday 07:00 Europe/Paris → the weekly report e-mail
   and must declare `secrets: [BREVO_KEY]` (exported below). One Firestore trigger: onAlertCreated (new restos/{rid}/alerts doc).
   E-mail: Brevo transactional API (free plan: 300 e-mails/day), secret BREVO_KEY, sender alertes@growthgusto.fr (domain verified in Brevo).
   Grouping: at most one alert e-mail per restaurant per 15 min (restos/{rid}.alertMail.lastAt); alerts wait with mailed:false and leave
   together in the next window. Quiet hours hold warn alerts until they end (bad ones still go). A daily counter (_meta/brevo) stops
   sending at 290 e-mails/day: alerts stay in the app either way.
   Alert docs written here use the same ids as the keys computed by the app (temp_<readingId>, missed_<day>_<slot>, dlc_<lotId>_<dlc>,
   obl_<oblId>_<due>), so the app never shows one twice. The first tick sets restos/{rid}.server.alertes = true: the app then switches
   « Envoyer un e-mail de test » from the preview to a real e-mail. Sensor offline/battery alerts are written by functions/src/sondes.js. */
"use strict";
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const BREVO_KEY = defineSecret("BREVO_KEY");
const REGION = "europe-west9";
const SENDER = { name: "Growth Gusto", email: "alertes@growthgusto.fr" };
const APP_URL = "https://app.growthgusto.fr/?go=alertes";
const WINDOW = 15 * 60e3, DAILY_CAP = 290, TZ = "Europe/Paris";

const AL_DEF = {
  on: { temp: true, missed: true, dlc: true, sensor: true, oblig: true },
  slots: { midi: "14:30", soir: "22:30" }, delay: 30, closed: [],
  to: null, extra: [], quiet: { on: false, from: "23:00", to: "07:00" }, esc: { on: false, after: 30, who: "" },
  oblDays: 15, weekly: true,
};
function cfgOf(r) {
  const c = (r && r.alertCfg) || {};
  return { ...AL_DEF, ...c, on: { ...AL_DEF.on, ...(c.on || {}) }, slots: { ...AL_DEF.slots, ...(c.slots || {}) }, quiet: { ...AL_DEF.quiet, ...(c.quiet || {}) }, esc: { ...AL_DEF.esc, ...(c.esc || {}) }, closed: Array.isArray(c.closed) ? c.closed : [], extra: Array.isArray(c.extra) ? c.extra : [] };
}
const group = (t) => (String(t || "").startsWith("sensor") ? "sensor" : t === "reading" ? "temp" : t);

/* ───────── Paris time helpers ───────── */
function paris(ts = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, wd };
}
const hmMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
const addDays = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
const addMonths = (k, n) => { const d = new Date(k + "T12:00:00Z"); const y = d.getUTCFullYear(), m = d.getUTCMonth() + n; const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), 12)).toISOString().slice(0, 10); };
const short = (k) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const fmt = (n) => (n == null || isNaN(n) ? "–" : Number(n).toFixed(1).replace(".", ","));
function inQuiet(cfg, min) {
  if (!cfg.quiet.on) return false; const a = hmMin(cfg.quiet.from), b = hmMin(cfg.quiet.to); if (a == null || b == null || a === b) return false;
  return a < b ? min >= a && min < b : min >= a || min < b;
}
const all = async (q) => (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
/* create an alert once (doc id = the app's key); an existing doc is left as it is */
async function raise(rid, id, data) {
  try { await db().doc(`restos/${rid}/alerts/${id}`).create({ key: id, seen: false, mailed: false, src: "serveur", ...data }); return true; }
  catch (e) { if (e && (e.code === 6 || /already exists/i.test(e.message || ""))) return false; throw e; }
}

/* ───────── e-mail ───────── */
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* same template as alMailHTML() in js/alertes.js (keep both in step) */
function mailHTML({ resto, title, intro, items = [], stats = null, cta = "Ouvrir les alertes", foot = "" }) {
  const e = esc, col = { bad: ["#FFE9DE", "#C8432A"], warn: ["#FFF3D6", "#7A5A1A"], ok: ["#E3F5EA", "#1E7F55"], vio: ["#EFE9FF", "#3A10D8"] };
  const row = (it) => { const [bg, fg] = col[it.level] || col.vio; return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1.5px solid #E9DFCD;border-radius:16px"><tr><td width="44" style="padding:14px 0 14px 14px;vertical-align:top"><div style="width:30px;height:30px;border-radius:50%;background:${bg};color:${fg};font:800 15px/30px Arial,sans-serif;text-align:center">!</div></td><td style="padding:14px 14px 14px 10px;font-family:Arial,Helvetica,sans-serif"><div style="font-size:15px;font-weight:700;color:#1B1530">${e(it.text)}</div>${it.sub ? `<div style="font-size:13px;color:#615B74;margin-top:3px">${e(it.sub)}</div>` : ""}</td></tr></table></td></tr>`; };
  const st = stats ? `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${stats.map(([v, l, lv]) => `<td width="${Math.floor(100 / stats.length)}%" style="padding:0 4px"><div style="background:#FFFFFF;border:1.5px solid #E9DFCD;border-radius:16px;padding:12px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif"><div style="font-size:24px;font-weight:800;letter-spacing:-.5px;color:${lv ? (col[lv] || col.vio)[1] : "#1B1530"}">${e(v)}</div><div style="font-size:12px;color:#615B74;margin-top:2px">${e(l)}</div></div></td>`).join("")}</tr></table></td></tr>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(title)}</title></head><body style="margin:0;background:#FBF6EC">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FBF6EC"><tr><td align="center" style="padding:26px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;letter-spacing:-.4px;color:#1B1530">Growth <span style="color:#5B2BFF">Gusto</span></td></tr>
<tr><td style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-radius:24px;padding:22px 18px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#3A10D8">${e(resto)}</td></tr>
<tr><td style="padding:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:28px;font-weight:800;letter-spacing:-.6px;color:#1B1530">${e(title)}</td></tr>
${intro ? `<tr><td style="padding:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:21px;color:#4A4560">${e(intro)}</td></tr>` : ""}
${st}${items.map(row).join("")}
<tr><td style="padding:6px 0 12px"><a href="${APP_URL}" style="display:inline-block;background:#5B2BFF;color:#FFFFFF;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:14px 22px;border-radius:14px;border-bottom:4px solid #2A0BA6">${e(cta)}</a></td></tr>
</table></td></tr>
<tr><td style="padding:14px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6E6880">${e(foot || "Vous recevez ce message car vous suivez les alertes de ce restaurant. Réglez-les dans Growth Gusto, Alertes, Réglages.")}</td></tr>
</table></td></tr></table></body></html>`;
}
async function recipients(rid, cfg) {
  const members = (await all(db().collection(`restos/${rid}/members`))).filter((m) => m.email);
  const mem = cfg.to ? members.filter((m) => cfg.to.includes(m.id)) : members.filter((m) => m.role === "gerant");
  const out = new Map(); mem.forEach((m) => out.set(m.email.toLowerCase(), { email: m.email, name: m.name || m.email }));
  cfg.extra.forEach((e) => out.set(String(e).toLowerCase(), { email: e }));
  return { list: [...out.values()], members };
}
/* daily cap shared by every restaurant (Brevo free plan) */
async function quota(n) {
  const ref = db().doc("_meta/brevo"), day = paris().day;
  return db().runTransaction(async (t) => { const s = await t.get(ref); const d = s.exists ? s.data() : {}; const used = d.day === day ? d.n || 0 : 0; if (used + n > DAILY_CAP) return false; t.set(ref, { day, n: used + n }); return true; });
}
async function send(to, subject, html) {
  if (!to.length) return false;
  if (!(await quota(to.length))) { logger.warn("alertes: Brevo daily cap reached"); return false; }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" },
    /* one version per person: nobody sees the others' addresses */
    body: JSON.stringify({ sender: SENDER, subject, htmlContent: html, messageVersions: to.map((p) => ({ to: [p.name ? { email: p.email, name: p.name } : { email: p.email }] })) }),
  });
  if (!r.ok) { logger.error("alertes: Brevo", r.status, await r.text().catch(() => "")); return false; }
  return true;
}

/* ───────── grouped alert e-mail, one per resto per 15 min ───────── */
async function claimWindow(rid) {
  const ref = db().doc(`restos/${rid}`); const now = Date.now();
  return db().runTransaction(async (t) => { const s = await t.get(ref); const last = (s.get("alertMail") || {}).lastAt || 0; if (now - last < WINDOW) return false; t.update(ref, { "alertMail.lastAt": now }); return true; });
}
async function sendPending(rid, resto) {
  const cfg = cfgOf(resto); const now = Date.now(), min = paris().min;
  const pend = (await all(db().collection(`restos/${rid}/alerts`).where("mailed", "==", false))).filter((a) => a.type !== "test");
  if (!pend.length) return;
  const b = db().batch(); let stale = 0;
  /* already seen in the app, switched off, or older than 12 h: never e-mailed */
  const live = pend.filter((a) => { const drop = a.seen || cfg.on[group(a.type)] === false || now - (a.at || 0) > 12 * 36e5; if (drop) { b.update(db().doc(`restos/${rid}/alerts/${a.id}`), { mailed: true, mailSkipped: true }); stale++; } return !drop; });
  if (stale) await b.commit();
  const quiet = inQuiet(cfg, min); const go = quiet ? live.filter((a) => a.level === "bad") : live;
  if (!go.length || !(await claimWindow(rid))) return;
  const { list } = await recipients(rid, cfg); if (!list.length) return;
  go.sort((a, b2) => (a.level === "bad" ? -1 : 1) - (b2.level === "bad" ? -1 : 1) || (b2.at || 0) - (a.at || 0));
  const name = resto.name || "Votre restaurant", n = go.length;
  const ok = await send(list, `${go.some((a) => a.level === "bad") ? "⚠ " : ""}${n > 1 ? `${n} alertes` : go[0].text} · ${name}`,
    mailHTML({ resto: name, title: n > 1 ? `${n} alertes à voir` : "1 alerte à voir", intro: "Ouvrez Growth Gusto pour voir le détail et marquer l'alerte comme vue.", items: go.slice(0, 8).map((a) => ({ level: a.level, text: a.text, sub: a.sub })) }));
  if (!ok) return;
  const b2 = db().batch(); go.forEach((a) => b2.update(db().doc(`restos/${rid}/alerts/${a.id}`), { mailed: true, mailedAt: now })); await b2.commit();
}
/* escalation: still unseen N minutes after the e-mail went → a second person */
async function escalate(rid, resto) {
  const cfg = cfgOf(resto); if (!cfg.esc.on || !cfg.esc.who) return;
  const now = Date.now(), after = (+cfg.esc.after || 30) * 60e3;
  const due = (await all(db().collection(`restos/${rid}/alerts`).where("seen", "==", false))).filter((a) => a.mailedAt && !a.escalatedAt && !a.mailSkipped && now - a.mailedAt >= after && a.type !== "test");
  if (!due.length) return;
  let to = null;
  if (cfg.esc.who.startsWith("x:")) to = { email: cfg.esc.who.slice(2) };
  else { const m = await db().doc(`restos/${rid}/members/${cfg.esc.who}`).get(); if (m.exists && m.get("email")) to = { email: m.get("email"), name: m.get("name") || "" }; }
  const b = db().batch(); due.forEach((a) => b.update(db().doc(`restos/${rid}/alerts/${a.id}`), { escalatedAt: now }));
  if (to) { const name = resto.name || "Votre restaurant"; await send([to], `Relance · ${due.length > 1 ? `${due.length} alertes` : due[0].text} · ${name}`, mailHTML({ resto: name, title: "Personne n'a encore regardé", intro: `Ces alertes attendent depuis plus de ${cfg.esc.after} min.`, items: due.slice(0, 8).map((a) => ({ level: a.level, text: a.text, sub: a.sub })) })); }
  await b.commit();
}

/* ───────── detection (same rules as alCompute() in js/alertes.js) ───────── */
async function detect(rid, resto) {
  const cfg = cfgOf(resto), P = paris(), today = P.day, base = `restos/${rid}/`;
  const fridges = cfg.on.temp || cfg.on.missed ? await all(db().collection(base + "fridges")) : [];
  const frName = (id) => (fridges.find((f) => f.id === id) || {}).name || "Frigo";
  const readings = fridges.length ? await all(db().collection(base + "readings").where("day", "==", today)) : [];
  if (cfg.on.temp) for (const r of readings) {
    if (r.ok !== false || !fridges.some((f) => f.id === r.fridgeId)) continue;
    await raise(rid, "temp_" + r.id, { type: "temp", level: "bad", fridgeId: r.fridgeId, value: r.value, at: r.at || Date.now(), text: `${frName(r.fridgeId)} à ${fmt(r.value)} °C`, sub: r.action || `Hors seuil · relevé du ${r.slot === "soir" ? "soir" : "midi"}` });
  }
  if (cfg.on.missed && fridges.length && !cfg.closed.includes(P.wd)) for (const slot of ["midi", "soir"]) {
    const end = hmMin(cfg.slots[slot]); if (end == null) continue; const dueMin = end + (+cfg.delay || 0);
    if (P.min < dueMin || P.min > dueMin + 6 * 60) continue; /* only during the 6 h after the deadline */
    if (resto.createdAt && resto.createdAt > Date.now() - (P.min - dueMin) * 60e3) continue; /* the restaurant did not exist yet */
    const done = new Set(readings.filter((r) => r.slot === slot).map((r) => r.fridgeId));
    const miss = fridges.filter((f) => !done.has(f.id)); if (!miss.length) continue;
    await raise(rid, `missed_${today}_${slot}`, { type: "missed", level: miss.length === fridges.length ? "bad" : "warn", slot, day: today, at: Date.now(), text: `Relevé du ${slot} oublié`, sub: miss.length === fridges.length ? `Aucun frigo relevé (${miss.length})` : miss.map((f) => f.name).slice(0, 3).join(", ") + (miss.length > 3 ? ` +${miss.length - 3}` : "") });
  }
  /* once a day, from 7:00 Paris: DLC and obligations */
  if (P.min >= 7 * 60 && (resto.alertState || {}).daily !== today) {
    await db().doc(`restos/${rid}`).update({ "alertState.daily": today });
    if (cfg.on.dlc) {
      const lots = await all(db().collection(base + "lots").where("status", "in", ["in", "opened"]));
      for (const l of lots) {
        const k = l.status === "opened" && l.dlcOpen ? l.dlcOpen : l.dlc; if (!k || k > today) continue;
        await raise(rid, `dlc_${l.id}_${k}`, { type: "dlc", level: k < today ? "bad" : "warn", lotId: l.id, fridgeId: l.fridgeId || null, at: Date.now(), text: `${l.name || "Produit"} : DLC ${k < today ? "dépassée" : "aujourd'hui"}`, sub: k < today ? `Depuis le ${short(k)}` : "À utiliser ou jeter aujourd'hui" });
      }
    }
    if (cfg.on.oblig) {
      const obls = (await all(db().collection(base + "obligations"))).filter((o) => !o.archived);
      for (const o of obls) {
        const due = o.dueManual && o.nextDue ? o.nextDue : o.lastDone ? addMonths(o.lastDone, +o.everyMonths || 12) : o.nextDue; if (!due) continue;
        const d = daysBetween(today, due); if (d > (+cfg.oblDays || 15)) continue;
        await raise(rid, `obl_${o.id}_${due}`, { type: "oblig", level: d < 0 ? "bad" : "warn", oblId: o.id, at: Date.now(), text: o.name || "Obligation", sub: d < 0 ? `En retard de ${-d} j` : d === 0 ? "Aujourd'hui" : `Dans ${d} j` });
      }
    }
  }
}

/* ───────── exports ───────── */
/* every 15 min, from the lead's scheduled job (declare secrets: [BREVO_KEY] there) */
async function alertesTick() {
  const restos = await all(db().collection("restos"));
  for (const r of restos) {
    if (r.demo) continue;
    try {
      if (!(r.server && r.server.alertes)) await db().doc(`restos/${r.id}`).set({ server: { alertes: true } }, { merge: true });
      await detect(r.id, r); await sendPending(r.id, r); await escalate(r.id, r);
    } catch (e) { logger.error("alertesTick", r.id, e); }
  }
}
/* Monday 07:00 Europe/Paris, from the lead's scheduled job */
async function alertesWeekly() {
  const today = paris().day, from = addDays(today, -7), to = addDays(today, -1);
  const t0 = new Date(from + "T00:00:00+01:00").getTime(), t1 = new Date(today + "T00:00:00+01:00").getTime();
  const restos = await all(db().collection("restos"));
  for (const r of restos) {
    if (r.demo) continue; const cfg = cfgOf(r); if (!cfg.weekly) continue;
    try {
      const base = `restos/${r.id}/`;
      const fridges = await all(db().collection(base + "fridges"));
      const rs = (await all(db().collection(base + "readings").where("day", ">=", from).where("day", "<=", to))).filter((x) => fridges.some((f) => f.id === x.fridgeId));
      const rounds = new Set(rs.map((x) => x.fridgeId + x.day + x.slot)).size, exp = fridges.length * 14, bad = rs.filter((x) => x.ok === false).length;
      const conf = exp ? Math.round((Math.min(rounds, exp) - Math.min(bad, rounds)) / exp * 100) : null;
      const thrown = (await all(db().collection(base + "lots").where("status", "==", "lost"))).filter((l) => l.outAt >= t0 && l.outAt < t1);
      const obl = (await all(db().collection(base + "obligations"))).filter((o) => !o.archived).map((o) => { const due = o.dueManual && o.nextDue ? o.nextDue : o.lastDone ? addMonths(o.lastDone, +o.everyMonths || 12) : o.nextDue; return due ? { o, d: daysBetween(today, due) } : null; }).filter((x) => x && x.d <= 30).sort((a, b) => a.d - b.d);
      const items = [...obl.slice(0, 4).map(({ o, d }) => ({ level: d < 0 ? "bad" : "warn", text: o.name, sub: d < 0 ? `En retard de ${-d} j` : `Dans ${d} j` })), ...thrown.slice(0, 3).map((l) => ({ level: "warn", text: `${l.name} jeté`, sub: l.lostReason || "DLC dépassée" }))];
      const { list } = await recipients(r.id, cfg); if (!list.length) continue;
      const name = r.name || "Votre restaurant";
      await send(list, `Votre semaine · ${name}`, mailHTML({ resto: name, title: "Votre semaine", intro: `Du ${short(from)} au ${short(to)}.`, cta: "Ouvrir Growth Gusto",
        stats: [[conf == null ? "–" : conf + " %", "conformité", conf == null ? "" : conf >= 95 ? "ok" : conf >= 80 ? "warn" : "bad"], [String(bad), "anomalies", bad ? "bad" : "ok"], [String(thrown.length), "DLC jetées", thrown.length ? "warn" : "ok"]],
        items: items.length ? items : [{ level: "ok", text: "Rien à prévoir", sub: "Aucune obligation dans les 30 jours" }] }));
    } catch (e) { logger.error("alertesWeekly", r.id, e); }
  }
}
/* a new alert (server, sensors, voice entry, test button): e-mail now if the 15-min window is free, else the next tick groups it */
const onAlertCreated = onDocumentCreated({ document: "restos/{rid}/alerts/{aid}", region: REGION, secrets: [BREVO_KEY] }, async (ev) => {
  const a = ev.data && ev.data.data(); if (!a) return; const rid = ev.params.rid;
  const rs = await db().doc(`restos/${rid}`).get(); if (!rs.exists || rs.get("demo")) return; const resto = rs.data();
  if (a.type === "test") {
    const { list } = await recipients(rid, cfgOf(resto)); const name = resto.name || "Votre restaurant";
    await send(list, `E-mail de test · ${name}`, mailHTML({ resto: name, title: "Les alertes arrivent bien", intro: "Ceci est un e-mail de test. Vous recevrez ici les alertes de votre restaurant.", items: [{ level: "ok", text: "Tout fonctionne", sub: "Envoyé depuis Alertes, Réglages" }] }));
    await ev.data.ref.update({ mailed: true, mailedAt: Date.now(), seen: true });
    return;
  }
  if (a.mailed === undefined) await ev.data.ref.update({ mailed: false }); /* written by the app: join the queue */
  await sendPending(rid, resto);
});

module.exports = { onAlertCreated, alertesTick, alertesWeekly, BREVO_KEY };
