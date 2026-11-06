/* Growth Gusto — online ordering, server side (QR menu at the table, takeaway). Firebase Functions v2, Node 22, europe-west9.
 *
 * The public page commande/?r=<rid>&t=<table> reads restos/{rid}/public/menu (written by the app, js/commande.js) and calls:
 *   orderApi (callable, no account for the client ops)
 *     op "create"   { rid, mode:"table"|"emporter", table?, items:[{id,q,note?}], name?, phone?, slot?, note?, pay:"stripe"|"place", back }
 *                   → checks every dish and price against public/menu (the client's numbers are never trusted), numbers the order of the day,
 *                   writes restos/{rid}/clientOrders/{id} and its private key orderKeys/{rid_id}, and for « payer maintenant » opens a
 *                   Stripe Checkout on the restaurant's OWN Stripe account (Connect, direct charge) → { oid, k, order, url? }
 *     op "status"   { rid, oid, k, check?, cancel? } → { order } the client's own order (live status page). check=1 asks Stripe right away
 *                   when the payment is still pending (back from Checkout); cancel=1 (« retour » from Checkout) expires the session.
 *   and, for the restaurant's team (signed in, member):
 *     op "connect"  gérant → { url } Stripe onboarding link for the restaurant's own Stripe account (created once, type Standard)
 *     op "check"    gérant → refreshes restos/{rid}/qrPay/link from Stripe → { link }
 *     op "cancel"   member { oid } → cancels an order; a paid one is refunded on the restaurant's Stripe account
 *
 * Stripe: one shared module, functions/src/stripe.js (Growth Gusto's Stripe account, key stored encrypted by the admin). Restaurants are
 *   connected accounts; Growth Gusto takes no commission (COMMANDE_FEE_BPS in functions/.env, default 0). Webhook events from connected
 *   accounts reach `onOrderEvent` through S._onStripeEvent("order"). The platform account is shared with another business: only accounts
 *   listed in qrAccts/{acct} (created here) and sessions with metadata.kind === "order" are ever touched; everything else is ignored.
 *
 * Data (server-written; no client can read the private ones: firestore.rules)
 *   restos/{rid}/clientOrders/{id}  { n, day, at, mode, table, slot, name, phone, note, items:[{id,name,price,q,note}], total, pay, paid, paidAt,
 *                                     status: apayer|nouvelle|prep|prete|servie|annulee|abandonnee, sid, pi, refunded, src:"qr", by? }
 *   restos/{rid}/qrPay/link         { acct, status: "pending"|"active"|"restricted", charges, payouts, name, live, at }   (members read)
 *   orderKeys/{rid}_{id}            { k, rid, oid, at }            the client's private status link
 *   orderSeq/{rid}                  { day, n, min, cnt }           order numbers of the day + a per-minute flood cap
 *   qrAccts/{acct}                  { rid, at }                    connected accounts we created (filters the shared webhook)
 *   payPending/{rid_id}             { rid, oid, acct, sid, at }    online payments not confirmed yet: the 15-min tick asks Stripe
 * Cost: Stripe's fee per payment, paid by the restaurant on its own account. A few function calls per order. */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const S = require("./stripe");

const REGION = "europe-west9";
const TZ = "Europe/Paris";
const APP = "https://app.growthgusto.fr/";
const PAGE = APP + "commande/";
const BACKS = [/^https:\/\/app\.growthgusto\.fr\/commande\/$/, /^https:\/\/growth-gusto\.web\.app\/commande\/$/, /^https:\/\/growth-gusto\.firebaseapp\.com\/commande\/$/];
const FEE_BPS = Math.max(0, Math.min(2000, +process.env.COMMANDE_FEE_BPS || 0)); /* Growth Gusto's cut in basis points (0 = none) */
const PER_MIN = 30;
const ADMINS = ["marceau.ruis@gmail.com"];

const err = (code, msg) => new HttpsError(code, msg);
const r2 = (v) => Math.round((+v || 0) * 100) / 100;
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const parisNow = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) }; };
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : -1; };
const same = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const okId = (x) => typeof x === "string" && /^[\w-]{1,64}$/.test(x);

/* what the client sees of an order (no phone, no Stripe ids) */
const pubView = (id, o) => ({ id, n: o.n, mode: o.mode, table: o.table || "", slot: o.slot || "", name: o.name || "", items: (o.items || []).map((x) => ({ name: x.name, price: x.price, q: x.q, note: x.note || "" })),
  total: o.total, pay: o.pay, paid: !!o.paid, status: o.status, at: o.at, readyAt: o.readyAt || null, payUrl: o.status === "apayer" && o.payUrl && o.payExp > Date.now() ? o.payUrl : "" });

async function linkOf(rid) { const s = await db.doc(`restos/${rid}/qrPay/link`).get(); return s.exists ? s.data() : null; }
const canCharge = (l) => !!(l && l.acct && l.charges);

/* ───────── create ───────── */
async function create(d) {
  const rid = String(d.rid || ""); if (!okId(rid)) throw err("invalid-argument", "lien");
  const ps = await db.doc(`restos/${rid}/public/menu`).get(); if (!ps.exists) throw err("not-found", "ferme");
  const P = ps.data(), c = P.cfg || {};
  if (!c.on) throw err("failed-precondition", "ferme");
  const mode = d.mode === "emporter" ? "emporter" : "table";
  if (mode === "table" && !c.table) throw err("failed-precondition", "ferme");
  if (mode === "emporter" && !c.takeaway) throw err("failed-precondition", "ferme");
  const table = mode === "table" ? clean(d.table, 4).replace(/\D/g, "") : "";
  if (mode === "table" && !table) throw err("invalid-argument", "table");
  const name = clean(d.name, 40), phone = clean(d.phone, 20), note = clean(d.note, 200);
  let slot = "";
  const now = parisNow();
  if (mode === "emporter") {
    if (name.length < 2 || phone.replace(/\D/g, "").length < 8) throw err("invalid-argument", "contact");
    slot = clean(d.slot, 5); const m = toMin(slot), pk = c.pickup || {};
    const inWin = (pk.windows || []).some((w) => m >= toMin(w.from) && m <= toMin(w.to));
    if (m < 0 || !inWin || (Array.isArray(pk.days) && !pk.days.includes(now.wd)) || m < now.min + Math.max(0, (+c.prepMin || 20) - 5)) throw err("failed-precondition", "creneau");
  }
  const raw = Array.isArray(d.items) ? d.items.slice(0, 60) : []; if (!raw.length) throw err("invalid-argument", "plat");
  const items = []; let total = 0, count = 0;
  for (const x of raw) {
    const it = (P.items || []).find((i) => i.id === x.id); const q = Math.floor(+x.q || 0);
    if (!it || it.out || !(+it.p > 0) || q < 1 || q > 30) throw err("failed-precondition", "plat");
    items.push({ id: it.id, name: clean(it.t, 80), price: r2(it.p), q, note: clean(x.note, 140) }); total += r2(it.p) * q; count += q;
  }
  if (count > 80) throw err("invalid-argument", "plat");
  total = r2(total);
  let pay = d.pay === "stripe" ? "stripe" : "place";
  let link = null;
  if (pay === "stripe") { link = await linkOf(rid); if (!c.payOnline || !canCharge(link)) throw err("failed-precondition", "paiement"); if (total < 0.5) pay = "place"; }
  if (pay === "place" && c.payPlace === false && c.payOnline) throw err("failed-precondition", "paiement");

  /* number of the day + flood cap, in one transaction */
  const seqRef = db.doc(`orderSeq/${rid}`), ref = db.collection(`restos/${rid}/clientOrders`).doc(), k = crypto.randomBytes(16).toString("hex"), at = Date.now();
  const n = await db.runTransaction(async (t) => {
    const s = await t.get(seqRef); const q = s.exists ? s.data() : {}; const minute = Math.floor(at / 6e4);
    const cnt = q.min === minute ? (q.cnt || 0) + 1 : 1; if (cnt > PER_MIN) throw err("resource-exhausted", "trop");
    const nn = q.day === now.day ? (q.n || 0) + 1 : 1;
    t.set(seqRef, { day: now.day, n: nn, min: minute, cnt });
    const o = { n: nn, day: now.day, at, mode, table, slot, name, phone, note, items, total, pay, paid: false, status: pay === "stripe" ? "apayer" : "nouvelle", src: "qr" };
    t.set(ref, o); t.set(db.doc(`orderKeys/${rid}_${ref.id}`), { k, rid, oid: ref.id, at });
    return nn;
  });
  const order = (await ref.get()).data();
  if (pay !== "stripe") return { oid: ref.id, k, order: pubView(ref.id, order) };

  /* Stripe Checkout on the restaurant's own account */
  const back = BACKS.some((re) => re.test(String(d.back || ""))) ? String(d.back) : PAGE;
  const q = `?r=${encodeURIComponent(rid)}&o=${ref.id}&k=${k}`;
  const exp = Math.floor(at / 1000) + 31 * 60;
  const cents = Math.round(total * 100);
  try {
    const ses = await S._stripeCall("/checkout/sessions", { method: "POST", account: link.acct, idem: "gg-order-" + ref.id, body: {
      mode: "payment", locale: "fr", expires_at: exp, client_reference_id: ref.id,
      line_items: items.map((x) => ({ quantity: x.q, price_data: { currency: "eur", unit_amount: Math.round(x.price * 100), product_data: { name: x.name.slice(0, 120) } } })),
      metadata: { kind: "order", rid, oid: ref.id, app: "growth-gusto" },
      payment_intent_data: { description: `Commande n° ${n} · ${mode === "table" ? "table " + table : "à emporter " + slot}`, metadata: { kind: "order", rid, oid: ref.id, app: "growth-gusto" },
        ...(FEE_BPS ? { application_fee_amount: Math.floor((cents * FEE_BPS) / 10000) } : {}) },
      custom_text: { submit: { message: mode === "table" ? `Table ${table} · la cuisine reçoit votre commande dès le paiement.` : `À emporter · prête vers ${slot}.` } },
      success_url: back + q + "&paid=1", cancel_url: back + q + "&cancel=1",
    } });
    await ref.update({ sid: ses.id, acct: link.acct, payUrl: ses.url, payExp: exp * 1000 });
    await db.doc(`payPending/${rid}_${ref.id}`).set({ rid, oid: ref.id, acct: link.acct, sid: ses.id, at });
    return { oid: ref.id, k, order: pubView(ref.id, { ...order, payUrl: ses.url, payExp: exp * 1000 }), url: ses.url };
  } catch (e) {
    logger.error("order checkout", rid, e.message);
    await ref.update({ status: "abandonnee", err: String(e.message || "").slice(0, 200) }).catch(() => {});
    throw err("failed-precondition", "paiement");
  }
}

/* ───────── payment state ───────── */
async function settle(rid, oid, ses) {
  const ref = db.doc(`restos/${rid}/clientOrders/${oid}`);
  const paid = ses.payment_status === "paid" || ses.payment_status === "no_payment_required";
  const dead = ses.status === "expired";
  await db.runTransaction(async (t) => {
    const s = await t.get(ref); if (!s.exists) return; const o = s.data();
    if (o.sid && ses.id && o.sid !== ses.id) return;
    if (paid && !o.paid) t.update(ref, { paid: true, paidAt: Date.now(), pi: typeof ses.payment_intent === "string" ? ses.payment_intent : (ses.payment_intent && ses.payment_intent.id) || null, status: o.status === "apayer" || o.status === "abandonnee" ? "nouvelle" : o.status, payUrl: null });
    else if (dead && !o.paid && o.status === "apayer") t.update(ref, { status: "abandonnee", payUrl: null });
  });
  if (paid || dead) await db.doc(`payPending/${rid}_${oid}`).delete().catch(() => {});
}
async function askStripe(rid, oid, o) {
  if (!o.sid || !o.acct) return;
  try { const ses = await S._stripeCall("/checkout/sessions/" + encodeURIComponent(o.sid), { account: o.acct }); await settle(rid, oid, ses); }
  catch (e) { logger.warn("order ask stripe", rid, oid, e.message); }
}

/* webhook: events of the restaurants' connected accounts (shared platform account: filter strictly) */
async function onOrderEvent(ev) {
  const o = (ev.data && ev.data.object) || {};
  if (ev.type === "account.updated") {
    const a = await db.doc(`qrAccts/${o.id}`).get(); if (!a.exists) return; /* not one of ours */
    await saveLink(a.data().rid, o); return;
  }
  const md = o.metadata || {};
  if (ev.type.startsWith("checkout.session.")) {
    if (md.kind !== "order" || md.app !== "growth-gusto" || !okId(md.rid) || !okId(md.oid)) return;
    const s = await db.doc(`restos/${md.rid}/clientOrders/${md.oid}`).get(); if (!s.exists) return;
    if (ev.account && s.data().acct && s.data().acct !== ev.account) return;
    await settle(md.rid, md.oid, o); return;
  }
  if (ev.type === "charge.refunded") {
    if (md.kind !== "order" || md.app !== "growth-gusto" || !okId(md.rid) || !okId(md.oid)) return;
    await db.doc(`restos/${md.rid}/clientOrders/${md.oid}`).set({ refunded: r2((o.amount_refunded || 0) / 100), refundedAt: Date.now() }, { merge: true });
  }
}
if (typeof S._onStripeEvent === "function") S._onStripeEvent("order", (ev) => onOrderEvent(ev));

/* ───────── restaurant: Stripe account ───────── */
async function member(req, rid, boss) {
  if (!req.auth) throw err("unauthenticated", "auth");
  if (!okId(rid)) throw err("invalid-argument", "rid");
  const m = await db.doc(`restos/${rid}/members/${req.auth.uid}`).get();
  const t = req.auth.token || {}; const adm = ADMINS.includes(String(t.email || "").toLowerCase()) && (t.email_verified === true || (t.firebase && t.firebase.sign_in_provider === "google.com"));
  if (!m.exists && !adm) throw err("permission-denied", "membre");
  const md = m.exists ? m.data() : {}; if (boss && !adm && !(md.role === "gerant" || (md.perms && md.perms.level === "admin"))) throw err("permission-denied", "gerant");
  return md;
}
async function saveLink(rid, a) {
  const name = (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || (a.business_profile && a.business_profile.name) || a.email || "";
  const due = (a.requirements && a.requirements.currently_due) || [];
  const link = { acct: a.id, charges: !!a.charges_enabled, payouts: !!a.payouts_enabled, details: !!a.details_submitted, due: due.length,
    status: a.charges_enabled ? "active" : a.details_submitted ? "restricted" : "pending", name: String(name).slice(0, 80), live: a.livemode !== false, at: Date.now() };
  await db.doc(`restos/${rid}/qrPay/link`).set(link, { merge: true }); return link;
}
async function connect(req, rid) {
  await member(req, rid, true);
  const pv = await db.doc("ggPrivate/stripe").get();
  if (!pv.exists || !pv.data().on) throw err("failed-precondition", "stripe_off");
  if (pv.data().connect === false) throw err("failed-precondition", "connect_off");
  const r = (await db.doc(`restos/${rid}`).get()).data() || {};
  let link = await linkOf(rid);
  if (!link || !link.acct) {
    let a;
    try {
      a = await S._stripeCall("/accounts", { method: "POST", idem: "gg-acct-" + rid, body: { type: "standard", country: "FR", email: req.auth.token.email || undefined,
        business_profile: { name: String(r.name || "").slice(0, 100) || undefined, mcc: "5812", product_description: "Restaurant : commandes à table et à emporter" }, metadata: { rid, app: "growth-gusto" } } });
    } catch (e) { if (/connect/i.test(e.message || "")) throw err("failed-precondition", "connect_off"); throw e; }
    await db.doc(`qrAccts/${a.id}`).set({ rid, at: Date.now() });
    link = await saveLink(rid, a);
  }
  const ret = APP + "?cmStripe=" + encodeURIComponent(rid);
  const al = await S._stripeCall("/account_links", { method: "POST", body: { account: link.acct, type: "account_onboarding", refresh_url: ret + "&again=1", return_url: ret } });
  return { url: al.url };
}

/* ───────── callable ───────── */
const orderApi = onCall({ region: REGION, cors: true, secrets: S.STRIPE_SECRETS, timeoutSeconds: 60, maxInstances: 10, memory: "256MiB" }, async (req) => {
  const d = req.data || {}; const op = String(d.op || "");
  try {
    if (op === "create") return await create(d);
    if (op === "status") {
      const rid = String(d.rid || ""), oid = String(d.oid || ""), k = String(d.k || "");
      if (!okId(rid) || !okId(oid) || !/^[a-f0-9]{32}$/.test(k)) throw err("invalid-argument", "lien");
      const ks = await db.doc(`orderKeys/${rid}_${oid}`).get(); if (!ks.exists || !same(ks.get("k"), k)) throw err("permission-denied", "lien");
      const ref = db.doc(`restos/${rid}/clientOrders/${oid}`); let s = await ref.get(); if (!s.exists) throw err("not-found", "lien");
      let o = s.data();
      if (o.status === "apayer" && d.cancel && o.sid && o.acct) {
        try { await S._stripeCall(`/checkout/sessions/${encodeURIComponent(o.sid)}/expire`, { method: "POST", account: o.acct }); } catch (e) { /* already paid or expired: askStripe settles it */ }
        await askStripe(rid, oid, o); s = await ref.get(); o = s.data();
      } else if (o.status === "apayer" && (d.check || Date.now() - (o.checkedAt || 0) > 20000)) {
        await ref.update({ checkedAt: Date.now() }).catch(() => {}); await askStripe(rid, oid, o); s = await ref.get(); o = s.data();
      }
      return { order: pubView(oid, o) };
    }
    if (op === "connect") return await connect(req, String(d.rid || ""));
    if (op === "check") {
      const rid = String(d.rid || ""); await member(req, rid, false); const l = await linkOf(rid); if (!l || !l.acct) return { link: null };
      return { link: await saveLink(rid, await S._stripeCall("/accounts/" + encodeURIComponent(l.acct))) };
    }
    if (op === "cancel") {
      const rid = String(d.rid || ""), oid = String(d.oid || ""); await member(req, rid, false); if (!okId(oid)) throw err("invalid-argument", "oid");
      const ref = db.doc(`restos/${rid}/clientOrders/${oid}`); const s = await ref.get(); if (!s.exists) throw err("not-found", "oid"); const o = s.data();
      let refunded = 0;
      if (o.paid && o.pi && o.acct && !o.refunded) { const rf = await S._stripeCall("/refunds", { method: "POST", account: o.acct, idem: "gg-refund-" + oid, body: { payment_intent: o.pi, metadata: { kind: "order", rid, oid, app: "growth-gusto" } } }); refunded = r2((rf.amount || 0) / 100); }
      await ref.update({ status: "annulee", cancelledAt: Date.now(), cancelledBy: req.auth.uid, ...(refunded ? { refunded, refundedAt: Date.now() } : {}) });
      return { ok: true, refunded };
    }
    throw err("invalid-argument", "op");
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error("orderApi", op, e.message, e.body && JSON.stringify(e.body).slice(0, 300));
    throw err("internal", "server");
  }
});

/* ───────── every 15 min (the single scheduled job): online payments the webhook did not confirm ───────── */
async function commandeTick() {
  const q = await db.collection("payPending").where("at", "<", Date.now() - 2 * 6e4).limit(100).get().catch(() => null); if (!q || q.empty) return;
  for (const doc of q.docs) {
    const p = doc.data();
    if (Date.now() - p.at > 26 * 3600e3) { await doc.ref.delete().catch(() => {}); continue; }
    const s = await db.doc(`restos/${p.rid}/clientOrders/${p.oid}`).get(); if (!s.exists) { await doc.ref.delete().catch(() => {}); continue; }
    const o = s.data(); if (o.status !== "apayer") { await doc.ref.delete().catch(() => {}); continue; }
    await askStripe(p.rid, p.oid, o);
  }
  /* old private keys: the status link lives two days */
  const old = await db.collection("orderKeys").where("at", "<", Date.now() - 2 * 864e5).limit(300).get().catch(() => null);
  if (old && !old.empty) { const b = db.batch(); old.docs.forEach((x) => b.delete(x.ref)); await b.commit().catch(() => {}); }
}

module.exports = { orderApi, commandeTick, _pubView: pubView, _onOrderEvent: onOrderEvent };
