/* Growth Gusto — « Comment nous avez-vous trouvés ? » : the client's feedback after the meal (public page avis/, js/avisclients.js in the app).
   Loaded by resa.js (module « resa », on by default), so nothing to add to GG_MODULES.
   Export:
     avisClient  callable, no account. Who may write:
                 · a booking:  ?r=&b=&k=  checked against resaKeys/{rid}/keys/{bid} (the same private key as the « gérer » link of the e-mails);
                 · a QR order: ?r=&o=&k=  checked against orderKeys/{rid}_{oid} (functions/src/commande.js) or avisKeys/{rid}_o_{oid};
                 · a bill paid online: ?r=&p=&k=  checked against avisKeys/{rid}_p_{id} (the « Merci de votre visite » e-mail);
                 · the table card QR: ?r= alone (anonymous), capped at 40 a day per restaurant.
                 ops: "get"    → { name, logo, first, meal, google, done? }
                      "send"   { rating 1-5, tags[], text, recontact } → writes restos/{rid}/feedback/{c_<kind>_<id>} (one per booking or order,
                               changeable for 48 h), and when rating ≤ 3 an alert (restos/{rid}/alerts, type « avis »): the team sees it in
                               Alertes and, once notifications are on, gets a push (onAlertNotif). Returns { google }.
                      "google" → marks googleAt on the feedback (how many clients went on to Google).
   Google: there is no API to post a review in someone's name. The page copies the client's text and opens the restaurant's Google review
   form (restos/{rid}.resaCfg.googleReview), where they paste it. Every client gets that button, happy or not: Google forbids asking only
   happy clients (« review gating »). Unhappy clients are also offered to write to the restaurant privately, first. */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const REGION = "europe-west9", TZ = "Europe/Paris";
const ANON_CAP = 40;
const TAGS = ["cuisine", "service", "accueil", "ambiance", "prix", "attente", "proprete", "bruit", "quantite", "temperature"];

const okId = (s) => /^[\w-]{1,64}$/.test(s);
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, n);
const first = (n) => clean(n, 40).split(/\s+/)[0] || "";
function parisDay(ts = Date.now()) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ts)).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; }
const parisHour = (ts = Date.now()) => +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(ts)) % 24;
const meal = (time) => { const h = parseInt(String(time || "").slice(0, 2), 10); return h && h < 16 ? "déjeuner" : "dîner"; };
/* the restaurant's Google review link: same rule as resa.js googleUrl (Place ID or an https link on a Google domain) */
function googleUrl(v) { try { return require("./resa")._googleUrl(v); } catch (e) { return ""; } }

/* who is writing: { kind, id, src, contact } or an HttpsError */
async function who(d) {
  const rid = String(d.rid || ""); if (!okId(rid)) throw new HttpsError("invalid-argument", "lien");
  const k = String(d.k || "").toLowerCase(), bid = String(d.bid || ""), oid = String(d.oid || ""), pid = String(d.pid || "");
  if (bid) {
    if (!okId(bid) || !/^[a-f0-9]{32}$/.test(k)) throw new HttpsError("invalid-argument", "lien");
    const ks = await db().doc(`resaKeys/${rid}/keys/${bid}`).get(); if (!ks.exists || !same(ks.get("k"), k)) throw new HttpsError("permission-denied", "lien");
    const s = await db().doc(`restos/${rid}/bookings/${bid}`).get(); if (!s.exists) throw new HttpsError("not-found", "absente");
    const b = s.data();
    return { rid, kind: "b", id: bid, channel: "resa", name: clean(b.name, 60), email: clean(b.email, 120), phone: clean(b.phone, 30), meal: meal(b.time), day: b.date || parisDay(), ref: { bookingId: bid } };
  }
  if (oid) {
    if (!okId(oid) || !/^[a-f0-9]{32}$/.test(k)) throw new HttpsError("invalid-argument", "lien");
    /* the order's status key (lives 2 days), or the key of the « Merci de votre visite » e-mail (avisKeys, 30 days) */
    const ks = await db().doc(`orderKeys/${rid}_${oid}`).get();
    if (!ks.exists || !same(ks.get("k"), k)) { const ak = await db().doc(`avisKeys/${rid}_o_${oid}`).get(); if (!ak.exists || !same(ak.get("k"), k)) throw new HttpsError("permission-denied", "lien"); }
    const s = await db().doc(`restos/${rid}/clientOrders/${oid}`).get(); if (!s.exists) throw new HttpsError("not-found", "absente");
    const o = s.data(); const h = parisHour(o.at || Date.now());
    return { rid, kind: "o", id: oid, channel: o.mode === "emporter" ? "emporter" : "qr", name: clean(o.name, 60), email: clean(o.email, 120), phone: clean(o.phone, 30), meal: o.mode === "emporter" ? "repas" : h < 16 ? "déjeuner" : "dîner", day: parisDay(o.at || Date.now()), table: clean(o.table, 4), ref: { orderId: oid, ...(o.table ? { table: String(o.table) } : {}) } };
  }
  if (pid) {
    /* the bill (or a share) paid from the table's QR: the link of the « Merci de votre visite » e-mail, avisKeys/{rid}_p_{id} */
    if (!okId(pid) || !/^[a-f0-9]{32}$/.test(k)) throw new HttpsError("invalid-argument", "lien");
    const ak = await db().doc(`avisKeys/${rid}_p_${pid}`).get(); if (!ak.exists || !same(ak.get("k"), k)) throw new HttpsError("permission-denied", "lien");
    const s = await db().doc(`restos/${rid}/billPays/${pid}`).get(); if (!s.exists) throw new HttpsError("not-found", "absente");
    const p = s.data(); const at = +p.paidAt || +p.at || Date.now();
    return { rid, kind: "p", id: pid, channel: "table", name: "", email: clean(p.email, 120), phone: "", meal: parisHour(at) < 16 ? "déjeuner" : "dîner", day: parisDay(at), table: clean(p.table, 4), ref: { billPayId: pid, ...(p.table ? { table: String(p.table) } : {}) } };
  }
  return { rid, kind: "a", id: "", channel: "table", name: "", email: "", phone: "", meal: parisHour() < 16 ? "déjeuner" : "dîner", day: parisDay(), ref: {} };
}

const avisClient = onCall({ region: REGION, cors: true, maxInstances: 10 }, async (req) => {
  const d = req.data || {}, op = String(d.op || "get");
  const w = await who(d);
  const rs = await db().doc(`restos/${w.rid}`).get(); if (!rs.exists) throw new HttpsError("not-found", "resto");
  const resto = rs.data(), c = resto.resaCfg || {}, google = googleUrl(c.googleReview);
  const fid = w.kind === "a" ? "" : `c_${w.kind}_${w.id}`;
  const fref = fid ? db().doc(`restos/${w.rid}/feedback/${fid}`) : null;

  if (op === "get") {
    const prev = fref ? await fref.get() : null; const p = prev && prev.exists ? prev.data() : null;
    return { name: clean(resto.name, 80) || "Restaurant", logo: typeof resto.logo === "string" && /^(data:image\/|https:\/\/)/.test(resto.logo) && resto.logo.length < 400000 ? resto.logo : "",
      first: first(w.name), meal: w.meal, google, phone: clean(c.phone, 30), done: p ? { rating: p.rating, text: p.text || "", tags: p.tags || [] } : null };
  }

  if (op === "google") {
    if (fref) await fref.set({ googleAt: Date.now() }, { merge: true }).catch(() => {});
    else if (d.fid && /^a_[a-f0-9]{18}$/.test(String(d.fid))) await db().doc(`restos/${w.rid}/feedback/${d.fid}`).set({ googleAt: Date.now() }, { merge: true }).catch(() => {});
    return { ok: true };
  }

  if (op !== "send") throw new HttpsError("invalid-argument", "op");
  const rating = Math.round(+d.rating); if (!(rating >= 1 && rating <= 5)) throw new HttpsError("invalid-argument", "note");
  const tags = (Array.isArray(d.tags) ? d.tags : []).map(String).filter((t) => TAGS.includes(t)).slice(0, 8);
  const text = clean(d.text, 1500), recontact = !!d.recontact && rating <= 3;
  const contact = w.kind === "a" ? { email: clean(d.email, 120), phone: clean(d.phone, 30), name: clean(d.name, 60) } : { email: w.email, phone: w.phone, name: w.name };
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) contact.email = "";
  const now = Date.now();

  let ref = fref, prev = null;
  if (ref) {
    const s = await ref.get(); prev = s.exists ? s.data() : null;
    if (prev && now - (+prev.at || now) > 48 * 3600e3) throw new HttpsError("failed-precondition", "tard");
  } else {
    /* the anonymous table card: a daily cap per restaurant keeps it from being flooded */
    const day = parisDay(), cref = db().doc(`restos/${w.rid}/feedbackMeta/anon`);
    const ok = await db().runTransaction(async (t) => { const s = await t.get(cref); const n = s.exists && s.get("day") === day ? +s.get("n") || 0 : 0; if (n >= ANON_CAP) return false; t.set(cref, { day, n: n + 1 }); return true; });
    if (!ok) throw new HttpsError("resource-exhausted", "trop");
    ref = db().doc(`restos/${w.rid}/feedback/a_${crypto.randomBytes(9).toString("hex")}`);
  }
  const low = rating <= 3;
  const doc = { source: "client", channel: w.channel, rating, tags, text, at: prev ? prev.at : now, editedAt: prev ? now : null, day: w.day, by: contact.name || "Client",
    ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { phone: contact.phone } : {}), recontact, private: low, ...w.ref,
    status: prev && prev.status && (+prev.rating <= 3) === low ? prev.status : low ? "a_traiter" : "clos", srv: true };
  await ref.set(doc, { merge: true });
  if (w.kind === "b") await db().doc(`restos/${w.rid}/bookings/${w.id}`).set({ reviewRating: rating, reviewAt: now }, { merge: true }).catch(() => {});

  /* unhappy client: the team hears about it now, in Alertes (and by push once notifications are on) */
  if (low && !(prev && prev.rating <= 3)) {
    const key = `avis_${ref.id}`; const who2 = contact.name || "Un client";
    await db().doc(`restos/${w.rid}/alerts/${key}`).set({ key, type: "avis", level: rating <= 2 ? "bad" : "warn", at: now, day: parisDay(), seen: false, mailed: false, src: "serveur", feedbackId: ref.id,
      text: `${who2} a mis ${rating}/5${w.table ? ` (table ${w.table})` : ""}`, sub: (text || "Pas de commentaire").slice(0, 140) + (recontact ? " · souhaite être recontacté" : "") }).catch((e) => logger.warn("avis: alert", e));
  }
  logger.info("avis: feedback", w.rid, w.channel, rating);
  return { ok: true, google, fid: ref.id };
});

module.exports = { avisClient, _avisTags: TAGS };
