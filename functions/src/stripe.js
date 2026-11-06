/* Growth Gusto — paiement en ligne Stripe (Firebase Cloud Functions v2, Node 22, region europe-west9). No npm dependency:
 * Stripe's REST API is called with fetch, the webhook signature is checked with crypto.
 *
 * Setup, once, from the app (Espace admin › Paiement en ligne): the admin pastes the Stripe secret key (sk_live_… or sk_test_…).
 *   op "setup" checks it, then creates on the Stripe account, if missing: one product + monthly price per pack (lookup_key
 *   gg_<pack>_<cents>_m, prices HT), the tax rate « TVA 20 % » (added on top), the customer portal configuration and the
 *   webhook endpoint (its signing secret comes back only at creation, so an existing one is replaced).
 *   Everything is stored ENCRYPTED in ggPrivate/stripe (no client access, key PL_ENC_KEY), and ggPublic/billing { stripe, live }
 *   tells the app that online payment is on. Changing a price in AB_PRICES creates a new Stripe price the next time « setup » runs.
 *
 *   stripeApi (callable)
 *     op "status"    admin only → { on, live, account, at }
 *     op "setup"     admin only { key } → { ok, live, account }
 *     op "off"       admin only → online payment off (nothing deleted at Stripe)
 *     op "checkout"  gérant { rid, pack } → { url } Stripe Checkout (subscription). During the free trial the card is saved and
 *                    the first payment is taken the day the trial ends (subscription_data.trial_end).
 *                    A restaurant that already pays changes pack in place (prorated) → { changed: true }
 *     op "confirm"   gérant { rid, session } → applies the Checkout result at once (the webhook does it too)
 *     op "portal"    gérant { rid } → { url } Stripe customer portal: invoices, card, billing address, cancel
 *   stripeWebhook (HTTPS, public, signed): checkout.session.completed, customer.subscription.created|updated|deleted,
 *     invoice.paid, invoice.payment_failed → restos/{rid} { plan, pack, paidAt, paidUntil, stripe: { customer, sub, status, pack,
 *     periodEnd, cancelAt, live, lastInvoice, failedAt, at } }. paidUntil = end of the paid period + 3 days of grace (7 when a
 *     payment failed and Stripe retries), so a late webhook never locks a paying restaurant.
 * Cost: Stripe takes its fee per payment only (no monthly fee); a few function calls per restaurant per month. */
"use strict";
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const REGION = "europe-west9";
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "growth-gusto";
const APP = "https://app.growthgusto.fr/";
const HOOK_URL = `https://${REGION}-${PROJECT}.cloudfunctions.net/stripeWebhook`;
const API = "https://api.stripe.com/v1";
const VERSION = "2024-06-20"; /* pinned: same payload shape whatever the account's default version */
const ADMINS = ["marceau.ruis@gmail.com"];
const DAY = 864e5;
/* keep in step with js/abo.js AB_PACKS (display names Commis / Second / Chef) */
const AB_PRICES = { essentiel: { t: "Commis", cents: 5900, d: "L'hygiène carrée, sans y penser" }, pro: { t: "Second", cents: 10900, d: "La salle et la caisse en plus" }, complet: { t: "Chef", cents: 16900, d: "Toute la maison tourne" } };
const LVL = { essentiel: 1, pro: 2, complet: 3 };
/* events of the restaurants' own Stripe accounts (Connect, QR-menu orders: functions/src/commande.js) */
const CONNECT_EVENTS = ["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "account.updated", "charge.refunded"];
const EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"];

const SEC = { PL_ENC_KEY: defineSecret("PL_ENC_KEY") };
const STRIPE_SECRETS = Object.values(SEC);
const privRef = () => db.doc("ggPrivate/stripe");
const pubRef = () => db.doc("ggPublic/billing");

/* ───────── encryption (AES-256-GCM, same key as the Pennylane tokens) ───────── */
const encKey = () => { let k = ""; try { k = String(SEC.PL_ENC_KEY.value() || "").trim(); } catch (e) {} if (!k) throw new HttpsError("failed-precondition", "not_configured"); return crypto.createHash("sha256").update("stripe:" + k).digest(); };
function seal(obj) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
function unseal(s) {
  const [iv, tag, data] = String(s || "").split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), iv); d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
}

/* ───────── Stripe HTTP ───────── */
/* nested params → Stripe's bracket form encoding: { a: { b: [1, 2] } } → a[b][0]=1&a[b][1]=2 */
function form(obj, pre = "", out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue; const key = pre ? `${pre}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x && typeof x === "object" ? form(x, `${key}[${i}]`, out) : out.push([`${key}[${i}]`, String(x)])));
    else if (typeof v === "object") form(v, key, out);
    else out.push([key, String(v)]);
  }
  return out;
}
class StripeErr extends Error { constructor(msg, status, body) { super(msg); this.status = status; this.body = body; } }
async function st(key, path, { method = "GET", body, query, idem, account } = {}) {
  const qs = query ? "?" + new URLSearchParams(form(query)).toString() : "";
  const headers = { authorization: "Bearer " + key, "stripe-version": VERSION };
  if (body) headers["content-type"] = "application/x-www-form-urlencoded";
  if (idem) headers["idempotency-key"] = idem;
  if (account) headers["stripe-account"] = account;
  const r = await fetch(API + path + qs, { method, headers, body: body ? new URLSearchParams(form(body)).toString() : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new StripeErr((j.error && j.error.message) || "stripe " + r.status, r.status, j.error);
  return j;
}

/* ───────── who is calling ───────── */
const isAdmin = (req) => { const t = req.auth && req.auth.token; return !!t && ADMINS.includes(String(t.email || "").toLowerCase()) && (t.email_verified === true || (t.firebase && t.firebase.sign_in_provider === "google.com")); };
async function gerantOf(req, rid) {
  if (!req.auth) throw new HttpsError("unauthenticated", "auth");
  if (!rid || typeof rid !== "string" || rid.includes("/")) throw new HttpsError("invalid-argument", "rid");
  const [m, r] = await Promise.all([db.doc(`restos/${rid}/members/${req.auth.uid}`).get(), db.doc(`restos/${rid}`).get()]);
  if (!r.exists) throw new HttpsError("not-found", "resto");
  if (!(m.exists && m.data().role === "gerant") && !isAdmin(req)) throw new HttpsError("permission-denied", "gerant");
  return { id: rid, ...r.data() };
}
async function conf() {
  const s = await privRef().get(); if (!s.exists || !s.data().on) throw new HttpsError("failed-precondition", "stripe_off");
  const d = s.data(); return { ...d, ...unseal(d.enc) };
}

/* ───────── setup (admin) ───────── */
async function setup(key, by, tva) {
  if (!/^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/.test(key)) throw new HttpsError("invalid-argument", "badkey");
  const live = /_live_/.test(key);
  let account = "";
  try { const a = await st(key, "/account"); account = (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || (a.business_profile && a.business_profile.name) || a.email || a.id; }
  catch (e) { if (e.status === 401) throw new HttpsError("invalid-argument", "badkey"); /* a restricted key may not read the account: fine */ }
  /* one monthly price per pack */
  const prices = {};
  for (const [k, P] of Object.entries(AB_PRICES)) {
    const lk = `gg_${k}_${P.cents}_m`;
    const found = await st(key, "/prices", { query: { lookup_keys: [lk], active: true, limit: 1 } });
    if (found.data && found.data[0]) { prices[k] = found.data[0].id; continue; }
    const prod = await st(key, "/products", { method: "POST", idem: "gg-prod-" + lk, body: { name: `Growth Gusto · Pack ${P.t}`, description: P.d, metadata: { gg: k }, statement_descriptor: "GROWTH GUSTO" } });
    const pr = await st(key, "/prices", { method: "POST", idem: "gg-price-" + lk, body: { product: prod.id, currency: "eur", unit_amount: P.cents, recurring: { interval: "month" }, tax_behavior: "exclusive", lookup_key: lk, nickname: `${P.t} mensuel`, metadata: { gg: k } } });
    prices[k] = pr.id;
  }
  /* TVA 20 % on top of the HT price, only when the business charges VAT (a micro-entreprise under the threshold does not:
     its invoices carry « TVA non applicable, art. 293 B du CGI » instead) */
  let tax = null;
  if (tva) {
    const tr = await st(key, "/tax_rates", { query: { active: true, limit: 100 } });
    const tx = (tr.data || []).find((x) => x.metadata && x.metadata.gg === "tva20");
    tax = tx ? tx.id : (await st(key, "/tax_rates", { method: "POST", body: { display_name: "TVA", description: "TVA française 20 %", percentage: 20, inclusive: false, country: "FR", jurisdiction: "France", metadata: { gg: "tva20" } } })).id;
  }
  /* customer portal: invoices, card, billing details, cancel at the end of the month */
  const portal = (await st(key, "/billing_portal/configurations", { method: "POST", body: {
    business_profile: { headline: "Growth Gusto · votre abonnement" },
    default_return_url: APP + "?abo=retour",
    features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true }, customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] }, subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] } } },
  } })).id;
  /* webhook: replace ours, so its signing secret is known */
  const hooks = await st(key, "/webhook_endpoints", { query: { limit: 100 } });
  for (const h of hooks.data || []) if (h.url.split("?")[0] === HOOK_URL) await st(key, "/webhook_endpoints/" + h.id, { method: "DELETE" });
  const hook = await st(key, "/webhook_endpoints", { method: "POST", body: { url: HOOK_URL, enabled_events: EVENTS, api_version: VERSION, description: "Growth Gusto · abonnements" } });
  /* a second endpoint for the restaurants' connected accounts (Connect must be on for the platform; skipped otherwise) */
  let hookC = null;
  try { hookC = await st(key, "/webhook_endpoints", { method: "POST", body: { url: HOOK_URL + "?c=1", enabled_events: CONNECT_EVENTS, connect: true, api_version: VERSION, description: "Growth Gusto · commandes des restaurants (Connect)" } }); }
  catch (e) { logger.warn("stripe connect webhook not created", e.message); }
  const now = Date.now();
  await privRef().set({ on: true, live, account, prices, tax, tva: !!tva, portal, hookId: hook.id, hookCId: hookC ? hookC.id : null, connect: !!hookC, enc: seal({ key, whsec: hook.secret, whsecC: hookC ? hookC.secret : null }), at: now, by });
  await pubRef().set({ stripe: true, live, tva: !!tva, at: now });
  return { ok: true, live, account, tva: !!tva, connect: !!hookC };
}

/* ───────── shared with the other Stripe modules (functions/src/commande.js) ─────────
   stripeCall(path, { method, body, query, idem, account })  same Stripe account and pinned version; account = a connected account id
   onStripeEvent(kind, fn)  kind "order": every event from a connected account, or with metadata.kind === "order"; fn(event, { call }) */
const HANDLERS = {};
const onStripeEvent = (kind, fn) => { (HANDLERS[kind] ||= []).push(fn); };
async function stripeCall(path, opts = {}) { const C = await conf(); return st(C.key, path, opts); }

/* ───────── restaurant state from a subscription ───────── */
const packOfPrice = (C, price) => { if (!price) return null; for (const [k, id] of Object.entries(C.prices || {})) if (id === price.id) return k; const m = /^gg_(essentiel|pro|complet)_/.exec(price.lookup_key || ""); return m ? m[1] : (price.metadata && LVL[price.metadata.gg] ? price.metadata.gg : null); };
async function applySub(C, sub, ridHint, extra = {}) {
  const rid = (sub.metadata && sub.metadata.rid) || ridHint; if (!rid) { logger.warn("stripe sub without rid", sub.id); return null; }
  const ref = db.doc(`restos/${rid}`); const snap = await ref.get(); if (!snap.exists) { logger.warn("stripe sub for unknown resto", rid, sub.id); return null; }
  const r = snap.data(); const cur = r.stripe || {};
  if (cur.sub && cur.sub !== sub.id && ["active", "trialing", "past_due"].includes(cur.status) && sub.status === "canceled") return null; /* an old subscription ending: the current one stands */
  const item = sub.items && sub.items.data && sub.items.data[0];
  const pack = packOfPrice(C, item && item.price) || (sub.metadata && sub.metadata.pack) || r.pack || "complet";
  const end = ((item && item.current_period_end) || sub.current_period_end || 0) * 1000;
  const now = Date.now();
  const stripe = { ...cur, customer: typeof sub.customer === "string" ? sub.customer : sub.customer && sub.customer.id, sub: sub.id, status: sub.status, pack, periodEnd: end || null,
    cancelAt: sub.cancel_at_period_end ? end : (sub.cancel_at ? sub.cancel_at * 1000 : null), trialEnd: sub.trial_end ? sub.trial_end * 1000 : null, live: !!sub.livemode, at: now, ...extra };
  const patch = { stripe, pack };
  if (sub.status === "trialing" && r.plan !== "essai" && LVL[r.plan]) { patch.plan = pack; patch.paidUntil = Math.max(+r.paidUntil || 0, (sub.trial_end * 1000 || end) + 3 * DAY); }
  else if (sub.status === "trialing") { if (sub.trial_end) patch.trialEnds = Math.max(+r.trialEnds || 0, sub.trial_end * 1000); }
  else if (sub.status === "active" || sub.status === "past_due") {
    patch.plan = pack; patch.paidAt = r.paidAt || now; patch.paidUntil = end + (sub.status === "past_due" ? 7 : 3) * DAY;
    if (r.plan === "suspendu") delete patch.plan; /* a suspension by Growth Gusto is lifted by hand only */
  } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
    if (LVL[r.plan] && (!r.paidUntil || +r.paidUntil > now)) patch.paidUntil = Math.min(now, end || now); /* back to the « échu » state: read only */
    stripe.endedAt = now;
  }
  await ref.set(patch, { merge: true });
  return { rid, pack, status: sub.status };
}

/* ───────── callable ───────── */
const stripeApi = onCall({ region: REGION, cors: true, secrets: STRIPE_SECRETS, timeoutSeconds: 120, maxInstances: 5 }, async (req) => {
  const d = req.data || {}; const op = String(d.op || "");
  try {
    if (op === "status" || op === "setup" || op === "off") {
      if (!isAdmin(req)) throw new HttpsError("permission-denied", "admin");
      if (op === "setup") return await setup(String(d.key || "").trim(), req.auth.token.email, !!d.tva);
      if (op === "off") { await privRef().set({ on: false, offAt: Date.now() }, { merge: true }); await pubRef().set({ stripe: false, at: Date.now() }); return { ok: true }; }
      const s = await privRef().get(); const x = s.exists ? s.data() : {};
      return { on: !!x.on, live: !!x.live, tva: !!x.tva, account: x.account || "", at: x.at || null, by: x.by || "" };
    }
    if (op === "checkout") {
      const pack = String(d.pack || ""); if (!AB_PRICES[pack]) throw new HttpsError("invalid-argument", "pack");
      const r = await gerantOf(req, d.rid); const C = await conf(); const s0 = r.stripe || {};
      if (r.plan === "suspendu") throw new HttpsError("failed-precondition", "suspendu");
      /* already subscribed: change the pack in place */
      if (s0.sub && ["active", "trialing", "past_due"].includes(s0.status)) {
        const sub = await st(C.key, "/subscriptions/" + s0.sub);
        if (["active", "trialing", "past_due"].includes(sub.status)) {
          const item = sub.items.data[0]; const up = LVL[pack] > LVL[packOfPrice(C, item.price) || "essentiel"];
          const nsub = await st(C.key, "/subscriptions/" + sub.id, { method: "POST", body: { items: [{ id: item.id, price: C.prices[pack], tax_rates: C.tax ? [C.tax] : "" }], proration_behavior: sub.status === "trialing" ? "none" : up ? "always_invoice" : "create_prorations", cancel_at_period_end: false, metadata: { rid: r.id, pack, app: "growth-gusto" } } });
          await applySub(C, nsub, r.id); return { changed: true, pack };
        }
      }
      let customer = s0.customer;
      if (customer) { try { const c = await st(C.key, "/customers/" + customer); if (c.deleted) customer = null; } catch (e) { customer = null; } }
      if (!customer) {
        const email = req.auth.token.email || undefined;
        customer = (await st(C.key, "/customers", { method: "POST", body: { email, name: String(r.name || "").slice(0, 200) || undefined, preferred_locales: ["fr"], metadata: { rid: r.id, uid: req.auth.uid, app: "growth-gusto" }, invoice_settings: C.tva ? undefined : { footer: "TVA non applicable, art. 293 B du CGI" } } })).id;
        await db.doc(`restos/${r.id}`).set({ stripe: { ...s0, customer, live: !!C.live } }, { merge: true });
      }
      const now = Date.now(); const trialEnd = r.plan === "essai" && +r.trialEnds > now + 49 * 36e5 ? Math.floor(+r.trialEnds / 1000) : undefined;
      const P = AB_PRICES[pack];
      const ses = await st(C.key, "/checkout/sessions", { method: "POST", body: {
        mode: "subscription", customer, client_reference_id: r.id, locale: "fr",
        line_items: [{ price: C.prices[pack], quantity: 1, tax_rates: C.tax ? [C.tax] : undefined }],
        allow_promotion_codes: true, billing_address_collection: "required", tax_id_collection: { enabled: true }, customer_update: { name: "auto", address: "auto" },
        subscription_data: { metadata: { rid: r.id, pack, app: "growth-gusto" }, trial_end: trialEnd, description: `Growth Gusto · Pack ${P.t} · ${String(r.name || "").slice(0, 80)}` },
        metadata: { rid: r.id, pack, app: "growth-gusto" },
        custom_text: { submit: { message: trialEnd ? `Rien n'est prélevé avant la fin de votre essai, le ${new Date(trialEnd * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })}. Sans engagement, résiliable à tout moment.` : "Mensuel, sans engagement : résiliable à tout moment depuis l'application." } },
        success_url: APP + "?abo=ok&session={CHECKOUT_SESSION_ID}", cancel_url: APP + "?abo=annule",
      } });
      return { url: ses.url };
    }
    if (op === "confirm") {
      const r = await gerantOf(req, d.rid); const C = await conf();
      const ses = await st(C.key, "/checkout/sessions/" + encodeURIComponent(String(d.session || "x")), { query: { expand: ["subscription"] } });
      if ((ses.metadata && ses.metadata.rid) !== r.id && ses.client_reference_id !== r.id) throw new HttpsError("permission-denied", "session");
      if (!ses.subscription || typeof ses.subscription !== "object") return { ok: false, status: ses.status };
      return { ok: true, ...(await applySub(C, ses.subscription, r.id)) };
    }
    if (op === "portal") {
      const r = await gerantOf(req, d.rid); const C = await conf(); const cu = r.stripe && r.stripe.customer;
      if (!cu) throw new HttpsError("failed-precondition", "no_customer");
      const s = await st(C.key, "/billing_portal/sessions", { method: "POST", body: { customer: cu, return_url: APP + "?abo=retour", configuration: C.portal, locale: "fr" } });
      return { url: s.url };
    }
    throw new HttpsError("invalid-argument", "op");
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error("stripeApi", op, e.message, e.body && JSON.stringify(e.body).slice(0, 400));
    throw new HttpsError("internal", e instanceof StripeErr ? "stripe: " + e.message : "server");
  }
});

/* ───────── webhook ───────── */
function verifySig(raw, header, secret) {
  const parts = {}; String(header || "").split(",").forEach((p) => { const [k, v] = p.split("="); (parts[k] ||= []).push(v); });
  const t = +(parts.t && parts.t[0]); if (!t || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const want = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return (parts.v1 || []).some((v) => v && v.length === want.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(want)));
}
const stripeWebhook = onRequest({ region: REGION, secrets: STRIPE_SECRETS, timeoutSeconds: 60, maxInstances: 5, memory: "256MiB" }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("method"); return; }
  let C; try { C = await conf(); } catch (e) { res.status(503).send("off"); return; }
  const raw = req.rawBody ? req.rawBody.toString("utf8") : "";
  const isC = req.query && req.query.c === "1";
  if (!verifySig(raw, req.get("stripe-signature"), isC ? C.whsecC : C.whsec)) { res.status(400).send("signature"); return; }
  let ev; try { ev = JSON.parse(raw); } catch (e) { res.status(400).send("json"); return; }
  const o = (ev.data && ev.data.object) || {};
  try {
    if (isC || ev.account || (o.metadata && o.metadata.kind === "order")) {
      const hs = HANDLERS.order || []; if (!hs.length) { res.json({ received: true, ignored: true }); return; }
      for (const h of hs) await h(ev, { call: (path, opts = {}) => st(C.key, path, { account: ev.account, ...opts }) });
    } else if (ev.type === "checkout.session.completed" && o.mode === "subscription" && o.subscription && o.metadata && o.metadata.rid) {
      await applySub(C, await st(C.key, "/subscriptions/" + o.subscription), (o.metadata && o.metadata.rid) || o.client_reference_id);
    } else if (ev.type === "checkout.session.completed" || (ev.type.startsWith("customer.subscription.") && !(o.metadata && o.metadata.rid)) || (ev.type.startsWith("invoice.") && !(o.subscription_details && o.subscription_details.metadata && o.subscription_details.metadata.rid))) {
      res.json({ received: true, ignored: true }); return; /* the same Stripe account sells other things: not a Growth Gusto subscription */
    } else if (ev.type.startsWith("customer.subscription.")) {
      await applySub(C, o, null);
    } else if ((ev.type === "invoice.paid" || ev.type === "invoice.payment_failed") && o.subscription) {
      const sub = await st(C.key, "/subscriptions/" + o.subscription);
      const inv = { number: o.number || "", url: o.hosted_invoice_url || "", pdf: o.invoice_pdf || "", ttc: (o.amount_paid || o.amount_due || 0) / 100, at: Date.now() };
      await applySub(C, sub, null, ev.type === "invoice.paid" ? { lastInvoice: inv, failedAt: null } : { failedAt: Date.now(), failedInvoice: inv });
    }
    res.json({ received: true });
  } catch (e) {
    logger.error("stripeWebhook", ev.type, ev.id, e.message);
    res.status(500).send("retry"); /* Stripe retries for 3 days */
  }
});

module.exports = { stripeApi, stripeWebhook, STRIPE_SECRETS, _form: form, _verifySig: verifySig, _onStripeEvent: onStripeEvent, _stripeCall: stripeCall };
