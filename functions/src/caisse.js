/* Growth Gusto — « Caisse connectée », server part (Firebase Cloud Functions v2, Node 22, region europe-west9).
 *
 *   caisseApi   HTTPS (POST JSON, Authorization: Bearer <Firebase ID token>) called by js/caisse.js:
 *               op "start"      → { url }  OAuth 2 authorization URL (SumUp, Square, Lightspeed K-Series), state saved in caisseStates/{state}
 *               op "finish"     → exchanges the code (the app comes back on https://app.growthgusto.fr/?caisse=<provider>&code=…&state=…),
 *                                 stores the tokens ENCRYPTED in caisseTokens/{rid}_{provider} (top-level, no client access), first sync
 *               op "key"        → Zelty: checks the API key typed by the gérant, stores it encrypted, first sync
 *               op "sync"       → syncs one caisse now → { added }
 *               op "disconnect" → forgets the tokens, status « off »
 *   caisseTick() plain async function, NOT scheduled here (cost rule): the lead's single scheduled job calls it every 15 min.
 *               It syncs every connected caisse whose last sync is older than 10 min. The scheduled job must declare
 *               `secrets: CAISSE_SECRETS` (exported below) so the tokens can be refreshed and decrypted.
 *
 * Writes (the app reads them, see js/caisse.js):
 *   restos/{rid}/sales/{provider}_{extId}  { provider, source:"api", extId, at, day (Europe/Paris), total TTC € (tips excluded), ht?, count:1, items:[{name, qty, amount}], payment?, status }
 *   restos/{rid}/caisse/{provider}         { provider, mode:"api", status:"connected"|"error"|"off", merchant, connectedAt, lastSync, lastError, active }
 * The app turns each day of sales into a Z ticket (tickets/pos_{provider}_{day}) and deducts the stock: nothing else to do here.
 *
 * Secrets (firebase functions:secrets:set NAME): SUMUP_CLIENT_ID, SUMUP_CLIENT_SECRET, SQUARE_CLIENT_ID, SQUARE_CLIENT_SECRET,
 *   LIGHTSPEED_CLIENT_ID, LIGHTSPEED_CLIENT_SECRET, CAISSE_ENC_KEY (any long random string: encrypts the stored tokens).
 *   A provider whose client id is missing simply answers « not_configured »: SumUp alone is enough to start.
 * Every third-party API used here is free for the developer (SumUp, Square, Lightspeed K-Series once the partner app is approved, Zelty API key). */
"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const S_ = (n) => defineSecret(n);
const SEC = {
  SUMUP_CLIENT_ID: S_("SUMUP_CLIENT_ID"), SUMUP_CLIENT_SECRET: S_("SUMUP_CLIENT_SECRET"),
  SQUARE_CLIENT_ID: S_("SQUARE_CLIENT_ID"), SQUARE_CLIENT_SECRET: S_("SQUARE_CLIENT_SECRET"),
  LIGHTSPEED_CLIENT_ID: S_("LIGHTSPEED_CLIENT_ID"), LIGHTSPEED_CLIENT_SECRET: S_("LIGHTSPEED_CLIENT_SECRET"),
  CAISSE_ENC_KEY: S_("CAISSE_ENC_KEY"),
};
const CAISSE_SECRETS = Object.values(SEC);
const sec = (k) => { try { return SEC[k].value() || ""; } catch (e) { return ""; } };

const APP = "https://app.growthgusto.fr/";
const REGION = "europe-west9";
const TZ = "Europe/Paris";
const dayOf = (ms) => new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const r2 = (v) => Math.round(v * 100) / 100;
const n = (v) => { const x = typeof v === "string" ? parseFloat(v) : v; return typeof x === "number" && isFinite(x) ? x : null; };
const first = (...v) => { for (const x of v) if (n(x) != null) return n(x); return null; };
class CxErr extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }

/* ───────── token encryption (AES-256-GCM) ───────── */
const encKey = () => { const k = sec("CAISSE_ENC_KEY"); if (!k) throw new CxErr("not_configured", 500); return crypto.createHash("sha256").update(k).digest(); };
function seal(obj) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
function open(s) {
  const [iv, tag, data] = String(s || "").split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), iv); d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
}

/* ───────── http helpers ───────── */
async function http(url, { method = "GET", headers = {}, json, form, token, basic } = {}) {
  const h = { accept: "application/json", ...headers };
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) { h["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  if (token) h.authorization = "Bearer " + token;
  if (basic) h.authorization = "Basic " + Buffer.from(basic).toString("base64");
  const r = await fetch(url, { method, headers: h, body });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text.slice(0, 300) }; }
  if (!r.ok) { const e = new CxErr(r.status === 401 || r.status === 403 ? "unauthorized" : "upstream", 502); e.detail = { url: url.split("?")[0], status: r.status, data }; throw e; }
  return data;
}

/* ───────── providers ─────────
 * Each: authorize(state) → url · exchange(code) → tokens · refresh(tokens) → tokens · merchant(tokens) → name
 *       fetchSales(tokens, sinceMs, ctx) → { sales:[…], cursor } (cursor = newest timestamp seen). */
const P = {};

/* SumUp — https://developer.sumup.com (OAuth 2 authorization code). Tokens: access 1 h, refresh token returned on exchange.
 * History: GET /v0.1/me/transactions/history (newest_time/oldest_time, order, limit, statuses[]) → { items, links[rel=next] }.
 * Products are not in the history list: GET /v0.1/me/transactions?id=… gives products[] (name, quantity, price, total_price,
 * vat_rate, price_with_vat / total_with_vat), vat_amount, tip_amount. */
P.sumup = {
  id: "sumup", redirect: APP + "?caisse=sumup", configured: () => !!(sec("SUMUP_CLIENT_ID") && sec("SUMUP_CLIENT_SECRET")),
  authorize(state) {
    const q = new URLSearchParams({ response_type: "code", client_id: sec("SUMUP_CLIENT_ID"), redirect_uri: this.redirect, scope: "transactions.history user.profile_readonly", state });
    return "https://api.sumup.com/authorize?" + q.toString();
  },
  async exchange(code) {
    const t = await http("https://api.sumup.com/token", { method: "POST", form: { grant_type: "authorization_code", client_id: sec("SUMUP_CLIENT_ID"), client_secret: sec("SUMUP_CLIENT_SECRET"), code, redirect_uri: this.redirect } });
    return tok(t);
  },
  async refresh(T) {
    const t = await http("https://api.sumup.com/token", { method: "POST", form: { grant_type: "refresh_token", client_id: sec("SUMUP_CLIENT_ID"), client_secret: sec("SUMUP_CLIENT_SECRET"), refresh_token: T.refresh } });
    return tok(t, T);
  },
  async merchant(T) {
    const me = await http("https://api.sumup.com/v0.1/me", { token: T.access }).catch(() => null);
    const mp = (me && me.merchant_profile) || {};
    return mp.company_name || mp.business_name || (mp.doing_business_as && mp.doing_business_as.business_name) || (me && me.account && me.account.username) || "SumUp";
  },
  async fetchSales(T, since) {
    const out = []; let cursor = since; let details = 0;
    const q = new URLSearchParams({ oldest_time: new Date(since).toISOString(), order: "ascending", limit: "100" });
    ["SUCCESSFUL", "REFUNDED"].forEach((s) => q.append("statuses[]", s));
    let url = "https://api.sumup.com/v0.1/me/transactions/history?" + q.toString();
    for (let page = 0; url && page < 20; page++) {
      const r = await http(url, { token: T.access });
      for (const it of (r && r.items) || []) {
        const at = Date.parse(it.timestamp); if (!at) continue; cursor = Math.max(cursor, at);
        if (it.type && it.type !== "PAYMENT") continue;
        let d = null;
        if (details < 150) { details++; d = await http("https://api.sumup.com/v0.1/me/transactions?id=" + encodeURIComponent(it.id), { token: T.access }).catch(() => null); }
        const tip = first(d && d.tip_amount, it.tip_amount) || 0;
        const total = r2((first(d && d.amount, it.amount) || 0) - tip);
        const vat = first(d && d.vat_amount);
        const items = ((d && d.products) || []).map((p) => ({
          name: String(p.name || p.description || "Article").trim(),
          qty: first(p.quantity) || 1,
          amount: r2(first(p.total_with_vat, p.price_with_vat != null ? p.price_with_vat * (first(p.quantity) || 1) : null, p.total_price, (first(p.price) || 0) * (first(p.quantity) || 1)) || 0),
        }));
        out.push({ extId: it.transaction_code || it.id, at, total, ht: vat != null ? r2(total - vat) : null, items, payment: it.payment_type || "", status: it.status === "REFUNDED" ? "refunded" : "successful" });
      }
      const next = ((r && r.links) || []).find((l) => l.rel === "next");
      url = next && next.href ? (next.href.startsWith("http") ? next.href : "https://api.sumup.com/v0.1/me/transactions/history" + (next.href.startsWith("?") ? "" : "?") + next.href) : null;
    }
    return { sales: out, cursor };
  },
};

/* Square — https://developer.squareup.com (OAuth: /oauth2/authorize, /oauth2/token; access 30 days, refresh token).
 * Sales: POST /v2/orders/search on every location, COMPLETED orders closed since the cursor. Money is in cents. */
const SQ = "https://connect.squareup.com"; const SQV = { "Square-Version": "2024-10-17" };
P.square = {
  id: "square", redirect: APP + "?caisse=square", configured: () => !!(sec("SQUARE_CLIENT_ID") && sec("SQUARE_CLIENT_SECRET")),
  authorize(state) {
    const q = new URLSearchParams({ client_id: sec("SQUARE_CLIENT_ID"), scope: "ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ ITEMS_READ", session: "false", state, redirect_uri: this.redirect });
    return SQ + "/oauth2/authorize?" + q.toString();
  },
  async exchange(code) { return tok(await http(SQ + "/oauth2/token", { method: "POST", headers: SQV, json: { client_id: sec("SQUARE_CLIENT_ID"), client_secret: sec("SQUARE_CLIENT_SECRET"), code, grant_type: "authorization_code", redirect_uri: this.redirect } })); },
  async refresh(T) { return tok(await http(SQ + "/oauth2/token", { method: "POST", headers: SQV, json: { client_id: sec("SQUARE_CLIENT_ID"), client_secret: sec("SQUARE_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: T.refresh } }), T); },
  async merchant(T) { const r = await http(SQ + "/v2/merchants/me", { token: T.access, headers: SQV }).catch(() => null); return (r && r.merchant && r.merchant.business_name) || "Square"; },
  async fetchSales(T, since) {
    const loc = await http(SQ + "/v2/locations", { token: T.access, headers: SQV }); const ids = ((loc && loc.locations) || []).filter((l) => l.status !== "INACTIVE").map((l) => l.id).slice(0, 10);
    const out = []; let cursor = since; let c = null;
    if (!ids.length) return { sales: out, cursor };
    for (let page = 0; page < 20; page++) {
      const r = await http(SQ + "/v2/orders/search", { method: "POST", token: T.access, headers: SQV, json: { location_ids: ids, limit: 200, ...(c ? { cursor: c } : {}), query: { filter: { date_time_filter: { closed_at: { start_at: new Date(since).toISOString() } }, state_filter: { states: ["COMPLETED"] } }, sort: { sort_field: "CLOSED_AT", sort_order: "ASC" } } } });
      for (const o of (r && r.orders) || []) {
        const at = Date.parse(o.closed_at || o.updated_at || o.created_at); if (!at) continue; cursor = Math.max(cursor, at);
        const cents = (m) => (m && n(m.amount) != null ? n(m.amount) / 100 : null);
        const total = r2((cents(o.total_money) || 0) - (cents(o.total_tip_money) || 0)); const tax = cents(o.total_tax_money);
        const items = (o.line_items || []).map((l) => ({ name: [l.name, l.variation_name && l.variation_name !== "Regular" ? l.variation_name : ""].filter(Boolean).join(" ").trim() || "Article", qty: n(l.quantity) || 1, amount: r2(cents(l.total_money) || 0) }));
        out.push({ extId: o.id, at, total, ht: tax != null ? r2(total - tax) : null, items, payment: "", status: "successful" });
      }
      c = r && r.cursor; if (!c) break;
    }
    return { sales: out, cursor };
  },
};

/* Lightspeed Restaurant K-Series — partner API (OAuth 2, Basic client auth on /oauth/token, scope financial-api).
 * UNCERTAIN, check against the current docs once the partner app is approved: hosts (api.lsk.lightspeed.app, trial: api.trial.lsk.lightspeed.app),
 * GET /f/data/businesses (businesses[].businessLocations[].blId), GET /f/v2/business-location/{blId}/sales?from&to&pageSize&nextPageToken. */
const LSK = "https://api.lsk.lightspeed.app";
P.lightspeed = {
  id: "lightspeed", redirect: APP + "?caisse=lightspeed", configured: () => !!(sec("LIGHTSPEED_CLIENT_ID") && sec("LIGHTSPEED_CLIENT_SECRET")),
  authorize(state) { const q = new URLSearchParams({ response_type: "code", client_id: sec("LIGHTSPEED_CLIENT_ID"), scope: "financial-api", redirect_uri: this.redirect, state }); return LSK + "/oauth/authorize?" + q.toString(); },
  async exchange(code) { return tok(await http(LSK + "/oauth/token", { method: "POST", basic: sec("LIGHTSPEED_CLIENT_ID") + ":" + sec("LIGHTSPEED_CLIENT_SECRET"), form: { grant_type: "authorization_code", code, redirect_uri: this.redirect } })); },
  async refresh(T) { return tok(await http(LSK + "/oauth/token", { method: "POST", basic: sec("LIGHTSPEED_CLIENT_ID") + ":" + sec("LIGHTSPEED_CLIENT_SECRET"), form: { grant_type: "refresh_token", refresh_token: T.refresh } }), T); },
  async locations(T) { const r = await http(LSK + "/f/data/businesses", { token: T.access }); const L = []; ((r && (r.businesses || r)) || []).forEach((b) => (b.businessLocations || []).forEach((l) => L.push({ id: l.blId || l.id, name: l.blName || b.businessName }))); return L; },
  async merchant(T) { const L = await this.locations(T).catch(() => []); return (L[0] && L[0].name) || "Lightspeed"; },
  async fetchSales(T, since) {
    const out = []; let cursor = since; const to = new Date().toISOString();
    for (const bl of (await this.locations(T)).slice(0, 5)) {
      let next = null;
      for (let page = 0; page < 20; page++) {
        const q = new URLSearchParams({ from: new Date(since).toISOString(), to, pageSize: "100", ...(next ? { nextPageToken: next } : {}) });
        const r = await http(`${LSK}/f/v2/business-location/${encodeURIComponent(bl.id)}/sales?` + q.toString(), { token: T.access });
        for (const s of (r && r.sales) || []) {
          const at = Date.parse(s.timeClosed || s.timeOfOpening || s.date); if (!at) continue; cursor = Math.max(cursor, at);
          const items = (s.salesLines || []).map((l) => ({ name: String(l.name || l.itemName || "Article").trim(), qty: first(l.quantity) || 1, amount: r2(first(l.totalNetAmountWithTax, l.totalAmount, l.amountWithTax) || 0) }));
          const total = r2(first(s.totalAmountWithTax, s.totalAmount) ?? items.reduce((a, x) => a + x.amount, 0));
          out.push({ extId: `${bl.id}_${s.accountReference || s.id || at}`, at, total, ht: first(s.totalAmountWithoutTax, s.totalNetAmount), items, payment: "", status: s.cancelled ? "refunded" : "successful" });
        }
        next = r && r.nextPageToken; if (!next) break;
      }
    }
    return { sales: out, cursor };
  },
};

/* Zelty — API key typed by the gérant (back-office → API). UNCERTAIN, check against the current Zelty API v2.x docs:
 * base https://api.zelty.fr/2.7, header Authorization: Bearer <key>, GET /orders?from&to&limit&offset → { orders:[…] }, amounts in cents. */
const ZB = "https://api.zelty.fr/2.7";
P.zelty = {
  id: "zelty", key: true, configured: () => true,
  async check(T) { await http(ZB + "/restaurants", { token: T.access }); },
  async merchant(T) { const r = await http(ZB + "/restaurants", { token: T.access }).catch(() => null); const L = (r && (r.restaurants || r)) || []; return (Array.isArray(L) && L[0] && L[0].name) || "Zelty"; },
  async fetchSales(T, since) {
    const out = []; let cursor = since; const cents = (v) => (n(v) != null ? n(v) / 100 : null);
    for (let off = 0, page = 0; page < 20; page++, off += 200) {
      const q = new URLSearchParams({ from: new Date(since).toISOString(), to: new Date().toISOString(), limit: "200", offset: String(off) });
      const r = await http(ZB + "/orders?" + q.toString(), { token: T.access }); const L = (r && r.orders) || [];
      for (const o of L) {
        const at = Date.parse(o.closed_at || o.created_at || o.date); if (!at) continue; cursor = Math.max(cursor, at);
        const pr = o.price || {};
        const items = (o.items || o.contents || []).map((x) => ({ name: String(x.name || (x.dish && x.dish.name) || "Article").trim(), qty: first(x.quantity) || 1, amount: r2(cents(first(x.price && x.price.final_amount_inc_tax, x.final_price, x.price)) || 0) }));
        const total = r2(cents(first(pr.final_amount_inc_tax, o.final_price, o.price_inc_tax)) ?? items.reduce((a, x) => a + x.amount, 0));
        out.push({ extId: String(o.id), at, total, ht: cents(first(pr.final_amount_exc_tax)), items, payment: "", status: o.status === "cancelled" ? "refunded" : "successful" });
      }
      if (L.length < 200) break;
    }
    return { sales: out, cursor };
  },
};

function tok(t, old = {}) {
  if (!t || !t.access_token) throw new CxErr("upstream", 502);
  const exp = n(t.expires_in) ? Date.now() + n(t.expires_in) * 1000 : t.expires_at ? Date.parse(t.expires_at) : Date.now() + 3500 * 1000;
  return { access: t.access_token, refresh: t.refresh_token || old.refresh || "", expiresAt: exp };
}

/* ───────── storage ───────── */
const tokRef = (rid, prov) => db.collection("caisseTokens").doc(`${rid}_${prov}`);
const statRef = (rid, prov) => db.doc(`restos/${rid}/caisse/${prov}`);
async function setStatus(rid, prov, patch) { await statRef(rid, prov).set({ provider: prov, mode: "api", ...patch }, { merge: true }); }
async function activate(rid, prov) {
  const all = await db.collection(`restos/${rid}/caisse`).get(); const b = db.batch();
  all.docs.forEach((d) => { if (d.id !== prov && d.data().active) b.set(d.ref, { active: false }, { merge: true }); }); await b.commit();
}

/* one caisse: refresh the token if needed, fetch since the cursor (10 min overlap: ids make it idempotent), write the sales */
async function syncOne(rid, prov) {
  const ref = tokRef(rid, prov); const snap = await ref.get(); if (!snap.exists) throw new CxErr("not_connected", 404);
  const D = snap.data(); const p = P[prov]; if (!p) throw new CxErr("provider", 400);
  let T = open(D.enc);
  try {
    if (!p.key && T.expiresAt && T.expiresAt < Date.now() + 120000 && T.refresh) { T = await p.refresh(T); await ref.set({ enc: seal(T) }, { merge: true }); }
    const since = Math.max((D.cursor || Date.now() - 36 * 36e5) - 10 * 6e4, Date.now() - 7 * 864e5);
    let r;
    try { r = await p.fetchSales(T, since); }
    catch (e) { if (e.code !== "unauthorized" || p.key || !T.refresh) throw e; T = await p.refresh(T); await ref.set({ enc: seal(T) }, { merge: true }); r = await p.fetchSales(T, since); }
    let added = 0;
    for (let i = 0; i < r.sales.length; i += 400) {
      const b = db.batch();
      r.sales.slice(i, i + 400).forEach((s) => {
        if (s.at > (D.cursor || 0)) added++;
        b.set(db.doc(`restos/${rid}/sales/${prov}_${String(s.extId).replace(/[\/#?\s]+/g, "_").slice(0, 120)}`), { provider: prov, source: "api", extId: String(s.extId), at: s.at, day: dayOf(s.at), total: s.total, ht: s.ht ?? null, count: 1, items: s.items.slice(0, 200), payment: s.payment || "", status: s.status || "successful", syncedAt: Date.now() });
      });
      await b.commit();
    }
    await ref.set({ cursor: Math.max(r.cursor || 0, D.cursor || 0), lastSync: Date.now(), status: "connected", fails: 0 }, { merge: true });
    await setStatus(rid, prov, { status: "connected", lastSync: Date.now(), lastError: null });
    return { added };
  } catch (e) {
    logger.warn("caisse sync", rid, prov, e.code || e.message, e.detail || "");
    const fails = (D.fails || 0) + 1; const lost = e.code === "unauthorized";
    await ref.set({ fails, lastFail: Date.now() }, { merge: true });
    if (lost || fails >= 3) await setStatus(rid, prov, { status: "error", lastError: lost ? "Accès retiré par la caisse : reconnectez-la." : "La caisse ne répond pas. Nouvel essai dans 15 min." });
    throw e;
  }
}

/* ───────── auth: Firebase ID token + membership ───────── */
async function caller(req, rid, needAdmin) {
  const h = req.get("authorization") || ""; const m = h.match(/^Bearer (.+)$/); if (!m) throw new CxErr("auth", 401);
  let u; try { u = await admin.auth().verifyIdToken(m[1]); } catch (e) { throw new CxErr("auth", 401); }
  if (!rid || typeof rid !== "string" || rid.includes("/")) throw new CxErr("rid", 400);
  const mem = await db.doc(`restos/${rid}/members/${u.uid}`).get(); if (!mem.exists) throw new CxErr("forbidden", 403);
  const md = mem.data() || {}; const admin_ = md.role === "gerant" || (md.perms && md.perms.level === "admin");
  if (needAdmin && !admin_) throw new CxErr("forbidden", 403);
  return u.uid;
}

/* ───────── HTTPS endpoint ───────── */
const caisseApi = onRequest({ region: REGION, cors: [/growthgusto\.fr$/, /growth-gusto\.web\.app$/, /growth-gusto\.firebaseapp\.com$/], secrets: CAISSE_SECRETS, timeoutSeconds: 120, memory: "256MiB", maxInstances: 5 }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  const b = req.body || {}; const { op, rid } = b; const prov = String(b.provider || "");
  try {
    const p = P[prov]; if (!p) throw new CxErr("provider", 400);
    if (op === "start") {
      const uid = await caller(req, rid, true); if (p.key) throw new CxErr("provider", 400); if (!p.configured()) throw new CxErr("not_configured", 503);
      const state = crypto.randomBytes(24).toString("hex");
      await db.collection("caisseStates").doc(state).set({ rid, uid, provider: prov, at: Date.now() });
      res.json({ url: p.authorize(state) }); return;
    }
    if (op === "finish") {
      const sref = db.collection("caisseStates").doc(String(b.state || "")); const st = b.state ? await sref.get() : null;
      if (!st || !st.exists) throw new CxErr("state", 400); const S = st.data(); await sref.delete();
      if (S.provider !== prov || Date.now() - S.at > 20 * 6e4) throw new CxErr("state", 400);
      const uid = await caller(req, S.rid, true); if (uid !== S.uid) throw new CxErr("state", 400);
      const T = await p.exchange(String(b.code || "")); const merchant = await p.merchant(T).catch(() => "");
      await tokRef(S.rid, prov).set({ rid: S.rid, provider: prov, enc: seal(T), cursor: Date.now() - 36 * 36e5, status: "connected", by: uid, connectedAt: Date.now(), fails: 0 });
      await activate(S.rid, prov);
      await setStatus(S.rid, prov, { status: "connected", merchant, connectedAt: Date.now(), lastSync: null, lastError: null, active: true });
      const r = await syncOne(S.rid, prov).catch(() => ({ added: 0 }));
      res.json({ ok: true, merchant, added: r.added }); return;
    }
    if (op === "key") {
      const uid = await caller(req, rid, true); if (!p.key) throw new CxErr("provider", 400);
      const key = String(b.apiKey || "").trim(); if (key.length < 8 || key.length > 500) throw new CxErr("badkey", 400);
      const T = { access: key };
      try { await p.check(T); } catch (e) { throw new CxErr("badkey", 400); }
      const merchant = await p.merchant(T).catch(() => "");
      await tokRef(rid, prov).set({ rid, provider: prov, enc: seal(T), cursor: Date.now() - 36 * 36e5, status: "connected", by: uid, connectedAt: Date.now(), fails: 0 });
      await activate(rid, prov);
      await setStatus(rid, prov, { status: "connected", merchant, connectedAt: Date.now(), lastSync: null, lastError: null, active: true });
      const r = await syncOne(rid, prov).catch(() => ({ added: 0 }));
      res.json({ ok: true, merchant, added: r.added }); return;
    }
    if (op === "sync") { await caller(req, rid, false); res.json({ ok: true, ...(await syncOne(rid, prov)) }); return; }
    if (op === "disconnect") {
      await caller(req, rid, true); await tokRef(rid, prov).delete();
      await setStatus(rid, prov, { status: "off", active: false, offAt: Date.now() }); res.json({ ok: true }); return;
    }
    throw new CxErr("op", 400);
  } catch (e) {
    const code = e instanceof CxErr ? e.code : "server"; if (!(e instanceof CxErr)) logger.error("caisseApi", e);
    res.status(e.status || 500).json({ error: code });
  }
});

/* ───────── every 15 min (called by the lead's single scheduled job) ───────── */
async function caisseTick({ budgetMs = 8 * 60 * 1000 } = {}) {
  const t0 = Date.now(); const q = await db.collection("caisseTokens").where("status", "==", "connected").get();
  const due = q.docs.map((d) => d.data()).filter((d) => !d.lastSync || Date.now() - d.lastSync > 10 * 6e4).sort((a, b) => (a.lastSync || 0) - (b.lastSync || 0));
  let ok = 0, ko = 0;
  for (const d of due) {
    if (Date.now() - t0 > budgetMs) break;
    try { await syncOne(d.rid, d.provider); ok++; } catch (e) { ko++; }
  }
  /* forgotten OAuth states */
  const old = await db.collection("caisseStates").where("at", "<", Date.now() - 3600e3).limit(200).get().catch(() => null);
  if (old && !old.empty) { const b = db.batch(); old.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
  logger.info("caisseTick", { due: due.length, ok, ko, ms: Date.now() - t0 });
  return { due: due.length, ok, ko };
}

module.exports = { caisseApi, caisseTick, CAISSE_SECRETS };
