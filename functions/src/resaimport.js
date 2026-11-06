/* Growth Gusto — the bookings of another tool (Zenchef first, TheFork Manager and any tool that e-mails the restaurant), at zero cost.
   How: every restaurant gets its own address <slug>.<token>@in.growthgusto.fr. The restaurant adds it in Zenchef › Paramètres ›
   Général & équipe › Notifications (Zenchef lets a restaurant add several notification addresses), or forwards the e-mails from its
   mailbox. Brevo's inbound parsing (same Brevo account as our e-mails, MX of in.growthgusto.fr → inbound1/2.sendinblue.com) posts each
   e-mail to resaInbound; js/rzparse.js (copied here as rzparse.js) reads the booking; it lands in restos/{rid}/bookings like any other.
   No partner API, no paid plan, nothing per restaurant: one free Brevo webhook, one free HTTPS function.
   Exports (functions/index.js picks them up):
     resaInbox        callable (gérant): { rid, renew? } → { addr } — creates (or renews) the restaurant's address.
     resaInbound      HTTPS, called by Brevo only (secret token in the URL): one or more e-mails → bookings + a log line each.
     resaImportTick   plain async function for the single 15-min job: registers the Brevo inbound webhook once (retries every 6 h).
   Data:
     resaInbox/{token}               { rid, at }                      server only (no client rule: denied)
     restos/{rid}.resaIn             { addr, token, at, last?, n? }    the address and the last e-mail received (read by the app)
     restos/{rid}/resaMails/{id}     { at, subj, from, prov, kind, ok, sum{name,covers,date,time}, bid?, why?, links? }   the last 40 e-mails, for the app's screen
     restos/{rid}/bookings/{id}      + { source: "zenchef"|"thefork"|…|"mail", ext: { p, id?, by: "mail" } }
                                     ext marks a booking owned by another tool: functions/src/resa.js never e-mails its client. */
"use strict";
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { rzParse } = require("./rzparse");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const BREVO_KEY = defineSecret("BREVO_KEY");
const REGION = "europe-west9";
const DOMAIN = "in.growthgusto.fr";
const HOOK_URL = "https://europe-west9-growth-gusto.cloudfunctions.net/resaInbound";
const TZ = "Europe/Paris";
const LIVE = ["avenir", "en ligne", "confirme", "avalider", "arrive"];

const pad = (n) => String(n).padStart(2, "0");
function parisAt(k, t) {
  const guess = Date.parse(`${k}T${t}:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const day = `${p.year}-${p.month}-${p.day}`, min = (+p.hour % 24) * 60 + +p.minute, want = +t.slice(0, 2) * 60 + +t.slice(3, 5);
  return guess - (min + (day === k ? 0 : day > k ? 1440 : -1440) - want) * 60e3;
}
const today = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const slug = (s) => String(s || "resto").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "resto";
const nameKey = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const phoneKey = (s) => String(s || "").replace(/\D/g, "").slice(-9);
const safeId = (s) => String(s || "").replace(/[^\w-]/g, "").slice(0, 40);

/* ───────── the restaurant's address ───────── */
const resaInbox = onCall({ region: REGION, cors: true, maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "auth");
  const rid = String((req.data || {}).rid || ""); if (!/^[\w-]{1,64}$/.test(rid)) throw new HttpsError("invalid-argument", "rid");
  const mem = await db().doc(`restos/${rid}/members/${req.auth.uid}`).get();
  const md = mem.exists ? mem.data() || {} : null;
  if (!md || !(md.role === "gerant" || (md.perms && md.perms.level === "admin"))) throw new HttpsError("permission-denied", "gerant");
  const rref = db().doc(`restos/${rid}`), rs = await rref.get(); if (!rs.exists) throw new HttpsError("not-found", "resto");
  const r = rs.data() || {}, cur = r.resaIn || {};
  if (cur.addr && cur.token && !(req.data || {}).renew) return { addr: cur.addr };
  const token = crypto.randomBytes(5).toString("hex"), addr = `${slug(r.name)}.${token}@${DOMAIN}`;
  const batch = db().batch();
  if (cur.token) batch.delete(db().doc(`resaInbox/${cur.token}`));
  batch.set(db().doc(`resaInbox/${token}`), { rid, at: Date.now() });
  batch.set(rref, { resaIn: { addr, token, at: Date.now(), n: cur.n || 0, last: cur.last || 0 } }, { merge: true });
  await batch.commit();
  return { addr };
});

/* ───────── one e-mail → one booking ───────── */
async function findBooking(rid, p, bk) {
  const col = db().collection(`restos/${rid}/bookings`);
  if (bk.ref) { const s = await col.where("ext.id", "==", `${p}:${bk.ref}`).limit(1).get(); if (!s.empty) return s.docs[0]; }
  /* no reference: the same client (phone, else name) on that day, or on any coming day for a change / cancellation */
  const pk = phoneKey(bk.phone), nk = nameKey(bk.name);
  const same = (d) => { const b = d.data(); return (pk && phoneKey(b.phone) === pk) || (nk && nameKey(b.name) === nk); };
  const day = await col.where("date", "==", bk.date).get();
  const hit = day.docs.find(same); if (hit) return hit;
  if (bk.kind === "new") return null;
  const next = await col.where("date", ">=", today()).orderBy("date").limit(400).get();
  return next.docs.filter((d) => (d.data().ext || {}).p === p && LIVE.includes(d.data().status)).find(same) || null;
}
async function apply(rid, mail) {
  const bk = rzParse(mail), p = bk.provider, now = Date.now();
  const log = { at: now, subj: String(mail.subject || "").slice(0, 200), from: String(mail.from || "").slice(0, 120), prov: p, kind: bk.kind, ok: false,
    sum: { name: bk.name || "", covers: bk.covers || 0, date: bk.date || "", time: bk.time || "" } };
  const gmail = /forwarding-noreply@google\.com/i.test(mail.from || "") || /confirmation de transfert|forwarding confirmation/i.test(mail.subject || "");
  if (gmail || !bk.ok) {
    /* not a booking (or not readable): kept with its links, so the restaurant can e.g. confirm a Gmail forwarding in one tap */
    log.why = gmail ? "gmail" : bk.why || "illisible";
    log.links = (String(mail.text || "") + " " + String(mail.html || "")).match(/https:\/\/[^\s"'<>)]+/g)?.filter((u) => gmail ? /google\.com/.test(u) : true).slice(0, 4) || [];
    if (bk.kind === "cancel" && bk.date && (bk.name || bk.phone)) { /* a cancellation without time or covers: still enough to find it */
      const d = await findBooking(rid, p, bk); if (d) { await d.ref.set({ status: "annule", cancelledBy: "outil", cancelledAt: now, ext: { ...(d.data().ext || {}), p, by: "mail" } }, { merge: true }); log.ok = true; log.bid = d.id; delete log.why; }
    }
    return log;
  }
  const at = parisAt(bk.date, bk.time);
  const fields = { date: bk.date, time: bk.time, covers: bk.covers, at };
  if (bk.name) fields.name = bk.name; if (bk.phone) fields.phone = bk.phone; if (bk.email) fields.email = bk.email; if (bk.notes) fields.notes = bk.notes;
  const ext = { p, by: "mail", ...(bk.ref ? { id: `${p}:${bk.ref}` } : {}) };
  const d = await findBooking(rid, p, bk);
  if (bk.kind === "cancel") {
    if (d) { await d.ref.set({ status: "annule", cancelledBy: "outil", cancelledAt: now, ext: { ...(d.data().ext || {}), ...ext } }, { merge: true }); log.ok = true; log.bid = d.id; }
    else log.why = "introuvable";
    return log;
  }
  if (d) {
    const old = d.data(); const patch = { ...fields, ext: { ...(old.ext || {}), ...ext } };
    if (old.date !== bk.date || old.time !== bk.time) { patch.table = null; patch.tableAuto = true; } /* the floor plan places it again */
    if (old.status === "annule" && bk.kind !== "cancel") patch.status = "avenir";
    await d.ref.set(patch, { merge: true }); log.ok = true; log.bid = d.id; log.kind = "modify"; return log;
  }
  const ref = await db().collection(`restos/${rid}/bookings`).add({ name: p === "mail" ? "Client" : "Client " + p.charAt(0).toUpperCase() + p.slice(1), phone: "", ...fields, status: "avenir", source: p, ext, createdAt: now, seen: false });
  log.ok = true; log.bid = ref.id; return log;
}

/* Brevo's payload: { items: [ { Subject, From:{Name,Address}, To:[…], Recipients:[…], RawTextBody, RawHtmlBody, SentAtDate, … } ] } */
const resaInbound = onRequest({ region: REGION, maxInstances: 5, timeoutSeconds: 60, memory: "256MiB" }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("method"); return; }
  const meta = await db().doc("_meta/inbound").get(); const tok = meta.exists ? String(meta.get("token") || "") : "";
  const t = String(req.query.t || "");
  if (!tok || t.length !== tok.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(tok))) { res.status(403).send("token"); return; }
  const items = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 20) : [];
  for (const it of items) {
    try {
      const rcpts = [...(it.Recipients || []), ...((it.To || []).map((x) => x && x.Address)), ...((it.Cc || []).map((x) => x && x.Address))].map((x) => String(x || "").toLowerCase());
      const tokens = [...new Set(rcpts.map((a) => (/^[^@]*?([a-f0-9]{10})@in\.growthgusto\.fr$/.exec(a) || [])[1]).filter(Boolean))];
      for (const k of tokens) {
        const m = await db().doc(`resaInbox/${k}`).get(); if (!m.exists) continue; const rid = m.get("rid");
        const mail = { subject: it.Subject || "", from: it.From ? `${it.From.Name || ""} <${it.From.Address || ""}>` : "", text: it.RawTextBody || "", html: it.RawHtmlBody || "", sentAt: it.SentAtDate || "" };
        const log = await apply(rid, mail);
        const lref = db().collection(`restos/${rid}/resaMails`);
        await lref.add(log);
        await db().doc(`restos/${rid}`).set({ resaIn: { last: Date.now(), n: admin.firestore.FieldValue.increment(log.ok ? 1 : 0) } }, { merge: true });
        const old = await lref.orderBy("at", "desc").offset(40).limit(20).get(); /* keep the last 40 */
        if (!old.empty) { const b = db().batch(); old.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
        logger.info("resaInbound", rid, log.prov, log.kind, log.ok ? "ok" : log.why);
      }
    } catch (e) { logger.error("resaInbound item", e); }
  }
  res.json({ ok: true });
});

/* ───────── the Brevo inbound webhook, registered by the server itself (nothing to click in Brevo) ───────── */
async function resaImportTick() {
  const ref = db().doc("_meta/inbound"), s = await ref.get(), m = s.exists ? s.data() : {};
  if (m.hookId) return;
  if (m.tried && Date.now() - m.tried < 6 * 3600e3) return;
  const token = m.token || crypto.randomBytes(16).toString("hex");
  await ref.set({ token, tried: Date.now() }, { merge: true });
  const key = BREVO_KEY.value(); if (!key) return;
  const H = { "api-key": key, "content-type": "application/json", accept: "application/json" }, url = `${HOOK_URL}?t=${token}`;
  try {
    const l = await fetch("https://api.brevo.com/v3/webhooks?type=inbound", { headers: H }); const lj = await l.json().catch(() => ({}));
    const have = (lj.webhooks || []).find((w) => String(w.url || "").startsWith(HOOK_URL));
    if (have && have.url === url) { await ref.set({ hookId: have.id, hookAt: Date.now(), err: null }, { merge: true }); return; }
    if (have) await fetch(`https://api.brevo.com/v3/webhooks/${have.id}`, { method: "DELETE", headers: H });
    const r = await fetch("https://api.brevo.com/v3/webhooks", { method: "POST", headers: H, body: JSON.stringify({ type: "inbound", events: ["inboundEmailProcessed"], url, domain: DOMAIN, description: "Growth Gusto · réservations Zenchef & co" }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.id) { await ref.set({ hookId: j.id, hookAt: Date.now(), err: null }, { merge: true }); logger.info("resaImport: Brevo inbound webhook", j.id); }
    else { await ref.set({ err: `${r.status} ${String(j.message || j.code || "").slice(0, 200)}` }, { merge: true }); logger.warn("resaImport: webhook", r.status, j); }
  } catch (e) { await ref.set({ err: String(e.message || e).slice(0, 200) }, { merge: true }); logger.warn("resaImport: webhook", e); }
}

module.exports = { resaInbox, resaInbound, resaImportTick, BREVO_KEY, _apply: apply, _parisAt: parisAt };
