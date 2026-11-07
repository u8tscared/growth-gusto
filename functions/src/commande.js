/* Growth Gusto — online ordering, server side (QR menu at the table, takeaway). Firebase Functions v2, Node 22, europe-west9.
 *
 * The public page commande/?r=<rid>&t=<table> reads restos/{rid}/public/menu (written by the app, js/commande.js) and calls:
 *   orderApi (callable, no account for the client ops)
 *     op "create"   { rid, mode:"table"|"emporter", table?, items:[{id,q,note?}], name?, phone?, slot?, note?, pay:"stripe"|"place", back, rq? }
 *                   rq: the client's request id (js/reseau-client.js): the same rq sent again answers with the same order (orderReqs/{rid}_{rq}).
 *                   → checks every dish and price against public/menu (the client's numbers are never trusted), numbers the order of the day,
 *                   writes restos/{rid}/clientOrders/{id} and its private key orderKeys/{rid_id}, and for « payer maintenant » opens a
 *                   Stripe Checkout on the restaurant's OWN Stripe account (Connect, direct charge) → { oid, k, order, url? }
 *     op "status"   { rid, oid, k, check?, cancel? } → { order } the client's own order (live status page). check=1 asks Stripe right away
 *                   when the payment is still pending (back from Checkout); cancel=1 (« retour » from Checkout) expires the session.
 *   and, for the restaurant's team (signed in, member):
 *     op "connect"  gérant → { url } Stripe onboarding link for the restaurant's own Stripe account (created once, type Standard)
 *     op "check"    gérant → refreshes restos/{rid}/qrPay/link from Stripe → { link }
 *     op "cancel"   member { oid } → cancels an order; a paid one is refunded on the restaurant's Stripe account
 *     op "site"     member { url } → reads the restaurant's own website to import its menu (js/cmimport.js parses it on the device):
 *                   { kind:"ld", items } (schema.org Menu), { kind:"text", text, imgs }, { kind:"pdf", b64 } (a PDF menu linked from the site)
 *                   or { kind:"img", b64 } (a menu posted as a picture, read by OCR on the device). Public http(s) only, 25 reads a day.
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
 *   siteSeq/{rid}                   { day, n }                     website reads for the menu import (25 a day)
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

  /* the same request sent again (the client's network dropped before our answer reached it: js/reseau-client.js tries again with the
     same `rq`): answer with the order already created, never a second one */
  const rq = /^[a-f0-9]{12,40}$/.test(String(d.rq || "")) ? String(d.rq) : "";
  const rqRef = rq ? db.doc(`orderReqs/${rid}_${rq}`) : null;
  const again = async (prev) => {
    const ref0 = db.doc(`restos/${rid}/clientOrders/${prev.oid}`); const o0 = (await ref0.get()).data(); if (!o0) throw err("not-found", "lien");
    const pv = pubView(prev.oid, o0); return { oid: prev.oid, k: prev.k, order: pv, again: true, ...(pv.payUrl ? { url: pv.payUrl } : {}) };
  };
  if (rqRef) { const p0 = await rqRef.get(); if (p0.exists) return again(p0.data()); }

  /* number of the day + flood cap, in one transaction */
  const seqRef = db.doc(`orderSeq/${rid}`), ref = db.collection(`restos/${rid}/clientOrders`).doc(), k = crypto.randomBytes(16).toString("hex"), at = Date.now();
  let dup = null;
  const n = await db.runTransaction(async (t) => {
    dup = null;
    if (rqRef) { const p1 = await t.get(rqRef); if (p1.exists) { dup = p1.data(); return 0; } }
    const s = await t.get(seqRef); const q = s.exists ? s.data() : {}; const minute = Math.floor(at / 6e4);
    const cnt = q.min === minute ? (q.cnt || 0) + 1 : 1; if (cnt > PER_MIN) throw err("resource-exhausted", "trop");
    const nn = q.day === now.day ? (q.n || 0) + 1 : 1;
    t.set(seqRef, { day: now.day, n: nn, min: minute, cnt });
    const o = { n: nn, day: now.day, at, mode, table, slot, name, phone, note, items, total, pay, paid: false, status: pay === "stripe" ? "apayer" : "nouvelle", src: "qr" };
    t.set(ref, o); t.set(db.doc(`orderKeys/${rid}_${ref.id}`), { k, rid, oid: ref.id, at });
    if (rqRef) t.set(rqRef, { oid: ref.id, k, rid, at });
    return nn;
  });
  if (dup) return again(dup);
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

/* ───────── restaurant: read its own website to import the menu (free: plain fetch, parsing happens on the device) ───────── */
const dns = require("dns").promises;
const net = require("net");
const SITE_MAX = 6 * 1024 * 1024;
function privIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split(".").map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const x = ip.toLowerCase(); return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:") && privIp(x.slice(7));
}
async function safeUrl(u) {
  let url; try { url = new URL(u); } catch (e) { throw err("invalid-argument", "url"); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw err("invalid-argument", "url");
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(url.hostname)) throw err("invalid-argument", "url");
  const ips = await dns.lookup(url.hostname, { all: true }).catch(() => []); if (!ips.length) throw err("not-found", "site");
  if (ips.some((x) => privIp(x.address))) throw err("invalid-argument", "url");
  return url;
}
/* GET with manual redirects (each hop re-checked), a 12 s budget and a size cap */
async function grab(u, accept) {
  let url = await safeUrl(u);
  for (let hop = 0; hop < 5; hop++) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    let r; try { r = await fetch(url.href, { redirect: "manual", signal: ac.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; GrowthGustoMenu/1.0; +https://growthgusto.fr)", accept: accept || "text/html,application/pdf,*/*;q=0.8", "accept-language": "fr-FR,fr;q=0.9" } }); }
    catch (e) { clearTimeout(t); throw err("unavailable", "site"); }
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { clearTimeout(t); url = await safeUrl(new URL(r.headers.get("location"), url).href); continue; }
    if (!r.ok) { clearTimeout(t); throw err("not-found", "site"); }
    const len = +r.headers.get("content-length") || 0; if (len > SITE_MAX) { clearTimeout(t); ac.abort(); throw err("out-of-range", "lourd"); }
    const chunks = []; let n = 0; const rd = r.body.getReader();
    try { for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > SITE_MAX) { ac.abort(); throw err("out-of-range", "lourd"); } chunks.push(value); } } finally { clearTimeout(t); }
    return { url: url.href, type: String(r.headers.get("content-type") || "").toLowerCase(), buf: Buffer.concat(chunks.map((c) => Buffer.from(c))) };
  }
  throw err("not-found", "site");
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï", euml: "ë", oelig: "œ", euro: "€", rsquo: "’", lsquo: "‘", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", deg: "°", Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç" };
const unent = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] != null ? ENT[e] : m);
function htmlText(h) {
  let s = h.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|head|iframe|template|form|nav|footer)\b[\s\S]*?<\/\1\s*>/gi, " ");
  s = s.replace(/<\/(td|th)\s*>/gi, "   ").replace(/<(br|hr)\b[^>]*>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|dt|dd|table|ul|ol|figcaption|blockquote)\s*>/gi, "\n").replace(/<(p|div|li|tr|h[1-6]|section|article|dt|dd)\b[^>]*>/gi, "\n");
  s = unent(s.replace(/<[^>]+>/g, " ")).replace(/[ \t\u00a0]{4,}/g, "   ").replace(/[ \t\u00a0]{1,3}(?=\S)/g, (m) => (m.length >= 3 ? "   " : " "));
  return s.split(/\n/).map((l) => l.trim()).filter((l, i, a) => l || (a[i - 1] || "").trim()).join("\n").replace(/\n{3,}/g, "\n\n").slice(0, 120000);
}
/* schema.org Menu in JSON-LD (Wix, Squarespace, TheFork pages, many themes) */
function ldItems(h) {
  const out = []; const blocks = h.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  const walk = (o, sec) => {
    if (!o || typeof o !== "object" || out.length > 400) return; if (Array.isArray(o)) return o.forEach((x) => walk(x, sec));
    const ty = [].concat(o["@type"] || []).join(" ");
    if (/MenuItem/.test(ty)) { const of = [].concat(o.offers || [])[0] || {}; const p = parseFloat(String(of.price || o.price || "").replace(",", ".")); out.push({ s: sec || "", t: clean(o.name, 80), d: clean(o.description, 220), p: p > 0 && p < 1000 ? p : 0, img: typeof o.image === "string" && /^https:\/\//.test(o.image) ? o.image : "" }); return; }
    const nsec = /MenuSection/.test(ty) ? clean(o.name, 40) : sec;
    for (const k of Object.keys(o)) if (k !== "@context") walk(o[k], nsec);
  };
  blocks.forEach((b) => { try { walk(JSON.parse(unent(b.replace(/^<script[^>]*>|<\/script>$/gi, "").trim())), ""); } catch (e) {} });
  return out.filter((x) => x.t);
}
const priceLines = (t) => (t.match(/(?<![\d.,])\d{1,3}(?:[.,]\d{1,2})?\s*(?:€|eur)?\s*$/gim) || []).length;
function links(h, base) {
  const L = []; const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(h)) && L.length < 400) { let u; try { u = new URL(unent(m[1]), base); } catch (e) { continue; } if (!/^https?:$/.test(u.protocol)) continue; const tx = unent(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().toLowerCase(); L.push({ u: u.href, tx, pdf: /\.pdf($|\?)/i.test(u.pathname) }); }
  const host = new URL(base).hostname.replace(/^www\./, "");
  const score = (l) => { const s = (l.u.toLowerCase() + " " + l.tx); let v = 0; if (/carte|menu|ardoise|plats|nos-plats|la-carte|food|boissons|vins/.test(s)) v += 3; if (l.pdf) v += 2; if (new URL(l.u).hostname.replace(/^www\./, "") === host) v += 1; else if (!l.pdf) v -= 3; if (/facebook|instagram|tripadvisor|google|thefork|lafourchette|ubereats|deliveroo|mailto|tel:|reserv|booking|privacy|mentions|cgv|cookies|login|panier|\/cart\b|checkout/.test(s)) v -= 5; return v; };
  const seen = new Set(); return L.filter((l) => { if (seen.has(l.u) || l.u === base) return false; seen.add(l.u); return true; }).map((l) => ({ ...l, v: score(l) })).filter((l) => l.v >= 3).sort((a, b) => b.v - a.v).slice(0, 4);
}
function imgs(h, base) {
  const out = []; const re = /<img\b[^>]*>/gi; let m;
  while ((m = re.exec(h)) && out.length < 80) {
    const tag = m[0]; const src = (/\s(?:data-src|data-lazy-src|src)\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1]; if (!src || /^data:/.test(src)) continue;
    let u; try { u = new URL(unent(src), base); } catch (e) { continue; } if (u.protocol !== "https:" || /\.svg($|\?)/i.test(u.pathname) || /logo|icon|sprite|pixel|avatar|badge/i.test(u.pathname)) continue;
    out.push({ u: u.href.slice(0, 1500), alt: clean(unent((/\salt\s*=\s*["']([^"']*)["']/i.exec(tag) || [])[1] || ""), 120) });
  }
  return out;
}
async function readSite(req, d) {
  const rid = String(d.rid || ""); await member(req, rid, false);
  const day = parisNow().day; const qref = db.doc(`siteSeq/${rid}`);
  await db.runTransaction(async (tx) => { const s = await tx.get(qref); const v = s.exists ? s.data() : {}; const n = v.day === day ? v.n || 0 : 0; if (n >= 25) throw err("resource-exhausted", "trop"); tx.set(qref, { day, n: n + 1 }); });
  let u = clean(d.url, 500); if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const page = await grab(u);
  const asPdf = (g) => ({ kind: "pdf", b64: g.buf.toString("base64"), src: g.url });
  const asImg = (g) => ({ kind: "img", b64: g.buf.toString("base64"), mime: g.type.split(";")[0], src: g.url });
  if (/pdf/.test(page.type) || page.buf.slice(0, 5).toString() === "%PDF-") return asPdf(page);
  if (/^image\/(jpeg|png|webp)/.test(page.type)) return asImg(page);
  const h = page.buf.toString("utf8"); const title = clean(unent((/<title[^>]*>([^<]*)/i.exec(h) || [])[1] || ""), 80);
  const og = (/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(h) || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(h) || [])[1] || "";
  const cover = /^https:\/\//.test(og) ? og.slice(0, 1500) : "";
  let best = { kind: "text", text: htmlText(h), imgs: imgs(h, page.url), src: page.url };
  const ld = ldItems(h); if (ld.filter((x) => x.p > 0).length >= 3) return { kind: "ld", items: ld.slice(0, 300), src: page.url, title, cover };
  let score = priceLines(best.text);
  if (score < 8) {
    for (const l of links(h, page.url)) {
      let g; try { g = await grab(l.u); } catch (e) { continue; }
      if (/pdf/.test(g.type) || g.buf.slice(0, 5).toString() === "%PDF-") return { ...asPdf(g), title, cover };
      if (/^image\//.test(g.type)) continue;
      const hh = g.buf.toString("utf8"); const ld2 = ldItems(hh); if (ld2.filter((x) => x.p > 0).length >= 3) return { kind: "ld", items: ld2.slice(0, 300), src: g.url, title, cover };
      const tx = htmlText(hh); const sc = priceLines(tx); if (sc > score) { score = sc; best = { kind: "text", text: tx, imgs: imgs(hh, g.url), src: g.url }; }
      if (score >= 8) break;
    }
  }
  /* no prices in the text: the menu is often a picture on the page */
  if (score < 4) {
    const pic = (best.imgs || []).find((i) => /carte|menu|ardoise/i.test(i.u + " " + i.alt));
    if (pic) { try { const g = await grab(pic.u, "image/*"); if (/^image\/(jpeg|png|webp)/.test(g.type)) return { ...asImg(g), title, cover }; } catch (e) {} }
  }
  return { ...best, title, cover };
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
    if (op === "site") return await readSite(req, d);
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
  /* request ids of orders sent again after a network cut: only useful for a few hours */
  const rqs = await db.collection("orderReqs").where("at", "<", Date.now() - 864e5).limit(300).get().catch(() => null);
  if (rqs && !rqs.empty) { const b = db.batch(); rqs.docs.forEach((x) => b.delete(x.ref)); await b.commit().catch(() => {}); }
}

module.exports = { orderApi, commandeTick, _pubView: pubView, _onOrderEvent: onOrderEvent, _site: { htmlText, ldItems, links, imgs, priceLines, privIp } };
