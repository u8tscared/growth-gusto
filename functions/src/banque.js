/* Growth Gusto — « Banque connectée », server part (Firebase Cloud Functions v2, Node 22, region europe-west9).
 *
 * Provider: Enable Banking (https://enablebanking.com/docs/api/reference/), licensed AISP, 2 700+ European banks.
 *   Free « restricted » mode: the app reads only the accounts its owner linked in the Enable Banking Control Panel
 *   (fine for our own restaurant). Customers' accounts need the Enable Banking contract: no code change, the same calls work.
 *   Auth: every call carries a JWT signed RS256 with the app's private key, header kid = application id,
 *   claims iss "enablebanking.com", aud "api.enablebanking.com", exp ≤ 24 h.
 *
 *   banqueApi   HTTPS (POST JSON, Authorization: Bearer <Firebase ID token>) called by js/banque.js:
 *               op "banks"      → { banks:[{ name, logo, beta }] }  French banks (cached 12 h)
 *               op "start"      → { url }  bank login page; state "bq_…" saved in bankStates/{state}
 *               op "finish"     → the bank sends the gérant back to https://app.growthgusto.fr/?code=…&state=bq_…:
 *                                 opens the session, stores it in bankLinks/{rid}_{sessionId} (top-level, no client access), first sync
 *               op "sync"       → syncs every bank link of the restaurant now → { added }
 *               op "disconnect" → closes the consent at the bank, forgets the link
 *   banqueTick() plain async function, NOT scheduled here (cost rule): the single ggTick job calls it every 15 min;
 *               it syncs a link at most every 6 h (banks allow 4 unattended reads a day under PSD2).
 *
 * Writes (the app reads them, see js/banque.js):
 *   restos/{rid}/bankTx/{id}   { src:"banque", link, account, day, amount (positive €, TTC), dir:"out"|"in", label, who, ref, at, syncedAt }
 *                              the app adds its own fields (cat, ht, st, rule…) with merge: the server never overwrites them.
 *   restos/{rid}/bank/{linkId} { kind:"api", bank, accounts:[{ uid, name, iban (last 4), currency, balance? }], validUntil, status, lastSync, lastError, connectedAt }
 *
 * Secrets (firebase functions:secrets:set NAME): EB_APP_ID (application id), EB_PRIVATE_KEY (the .pem file, --data-file). */
"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SEC = { EB_APP_ID: defineSecret("EB_APP_ID"), EB_PRIVATE_KEY: defineSecret("EB_PRIVATE_KEY") };
const BANQUE_SECRETS = Object.values(SEC);
const sec = (k) => { try { return String(SEC[k].value() || "").trim(); } catch (e) { return ""; } };

const API = "https://api.enablebanking.com";
const APP = "https://app.growthgusto.fr/";
const REGION = "europe-west9";
const ADMINS = ["marceau.ruis@gmail.com"]; /* keep in sync with js/config.js GG_ADMINS */
const SYNC_EVERY = 6 * 36e5; /* PSD2: 4 reads a day without the user */
const FIRST_DAYS = 90; /* history read at the first connection (most banks give 90 days without a new login) */
class BqErr extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
const configured = () => !!(sec("EB_APP_ID") && sec("EB_PRIVATE_KEY"));

/* ───────── JWT RS256 ───────── */
const b64u = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
let jwtCache = { t: "", exp: 0 };
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache.t && jwtCache.exp - now > 300) return jwtCache.t;
  if (!configured()) throw new BqErr("not_configured", 503);
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "RS256", kid: sec("EB_APP_ID") }));
  const body = b64u(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const s = crypto.createSign("RSA-SHA256"); s.update(head + "." + body);
  const key = sec("EB_PRIVATE_KEY").replace(/\\n/g, "\n");
  const t = head + "." + body + "." + b64u(s.sign(key));
  jwtCache = { t, exp: now + 3600 };
  return t;
}
async function eb(path, { method = "GET", json } = {}) {
  const h = { accept: "application/json", authorization: "Bearer " + jwt() };
  if (json !== undefined) h["content-type"] = "application/json";
  const r = await fetch(API + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text.slice(0, 300) }; }
  if (!r.ok) {
    const code = r.status === 401 || r.status === 403 ? "unauthorized" : r.status === 429 ? "rate" : r.status === 422 || r.status === 400 ? "refused" : "upstream";
    const e = new BqErr(code, 502); e.detail = { path: path.split("?")[0], status: r.status, data }; throw e;
  }
  return data;
}

/* ───────── banks ───────── */
let banksCache = { at: 0, list: [] };
async function banks() {
  if (banksCache.list.length && Date.now() - banksCache.at < 12 * 36e5) return banksCache.list;
  const r = await eb("/aspsps?country=FR&service=AIS");
  const list = ((r && r.aspsps) || []).map((a) => ({ name: a.name, logo: a.logo || "", beta: !!a.beta, max: +a.maximum_consent_validity || 0, psu: a.psu_types || null }))
    .filter((a) => a.name).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  banksCache = { at: Date.now(), list };
  return list;
}

/* ───────── transactions ───────── */
const r2 = (v) => Math.round(v * 100) / 100;
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
function mapTx(t, link, acc) {
  const amt = parseFloat(t.transaction_amount && t.transaction_amount.amount);
  if (!isFinite(amt) || !amt) return null;
  const out = t.credit_debit_indicator ? t.credit_debit_indicator === "DBIT" : amt < 0;
  const day = String(t.booking_date || t.value_date || t.transaction_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const who = clean(out ? t.creditor && t.creditor.name : t.debtor && t.debtor.name);
  const rem = Array.isArray(t.remittance_information) ? t.remittance_information.join(" ") : t.remittance_information;
  const label = clean(rem || (t.bank_transaction_code && t.bank_transaction_code.description) || t.note || who || "Opération");
  const ext = t.transaction_id || t.entry_reference || "";
  const id = "eb_" + crypto.createHash("sha1").update([link, acc, ext || [day, amt, label, t.reference_number || ""].join("|")].join("#")).digest("hex").slice(0, 28);
  return { id, doc: { src: "banque", link, account: acc, day, amount: r2(Math.abs(amt)), dir: out ? "out" : "in", label: label.slice(0, 200), who: who.slice(0, 100), ref: clean(t.reference_number || "").slice(0, 60), currency: (t.transaction_amount && t.transaction_amount.currency) || "EUR" } };
}
async function fetchTx(uid, from) {
  const out = []; let ck = null;
  for (let page = 0; page < 30; page++) {
    const q = new URLSearchParams({ date_from: from, ...(ck ? { continuation_key: ck } : {}) });
    const r = await eb(`/accounts/${encodeURIComponent(uid)}/transactions?` + q.toString());
    for (const t of (r && r.transactions) || []) if (!t.status || t.status === "BOOK") out.push(t);
    ck = r && r.continuation_key; if (!ck) break;
  }
  return out;
}
async function balance(uid) {
  const r = await eb(`/accounts/${encodeURIComponent(uid)}/balances`).catch(() => null);
  const L = (r && r.balances) || []; const pick = L.find((b) => ["CLBD", "ITBD", "CLAV", "ITAV", "XPCD"].includes(b.balance_type)) || L[0];
  const v = pick && parseFloat(pick.balance_amount && pick.balance_amount.amount);
  return isFinite(v) ? r2(v) : null;
}

/* ───────── storage ───────── */
const linkRef = (rid, sid) => db.collection("bankLinks").doc(`${rid}_${sid}`);
const statRef = (rid, sid) => db.doc(`restos/${rid}/bank/eb_${sid}`);
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

async function syncLink(L) {
  const { rid, sessionId: sid } = L; const link = "eb_" + sid;
  if (L.validUntil && Date.parse(L.validUntil) < Date.now()) {
    await linkRef(rid, sid).set({ status: "expired" }, { merge: true });
    await statRef(rid, sid).set({ status: "expired", lastError: "L'autorisation de la banque a expiré (180 jours) : reconnectez le compte." }, { merge: true });
    return { added: 0 };
  }
  try {
    let added = 0; const accounts = [];
    for (const a of L.accounts || []) {
      const from = a.cursor ? dayStr(Date.parse(a.cursor) - 5 * 864e5) : dayStr(Date.now() - FIRST_DAYS * 864e5);
      const list = await fetchTx(a.uid, from);
      const rows = list.map((t) => mapTx(t, link, a.uid)).filter(Boolean);
      const known = new Set();
      for (let i = 0; i < rows.length; i += 300) {
        const chunk = rows.slice(i, i + 300);
        const snaps = await db.getAll(...chunk.map((x) => db.doc(`restos/${rid}/bankTx/${x.id}`)));
        snaps.forEach((s) => { if (s.exists) known.add(s.id); });
        const b = db.batch();
        chunk.forEach((x) => { if (!known.has(x.id)) { added++; b.set(db.doc(`restos/${rid}/bankTx/${x.id}`), { ...x.doc, at: Date.now(), syncedAt: Date.now() }, { merge: true }); } });
        await b.commit();
      }
      const newest = rows.reduce((m, x) => (x.doc.day > m ? x.doc.day : m), a.cursor || "");
      accounts.push({ ...a, cursor: newest || a.cursor || null, balance: await balance(a.uid) });
    }
    await linkRef(rid, sid).set({ accounts, lastSync: Date.now(), status: "connected", fails: 0 }, { merge: true });
    await statRef(rid, sid).set({ status: "connected", lastSync: Date.now(), lastError: null, accounts: accounts.map(pub) }, { merge: true });
    return { added };
  } catch (e) {
    logger.warn("banque sync", rid, sid, e.code || e.message, e.detail || "");
    const fails = (L.fails || 0) + 1; const lost = e.code === "unauthorized" || e.code === "refused";
    await linkRef(rid, sid).set({ fails, lastFail: Date.now(), ...(lost ? { status: "error" } : {}) }, { merge: true });
    if (lost || fails >= 3) await statRef(rid, sid).set({ status: "error", lastError: lost ? "La banque a refusé l'accès : reconnectez le compte." : "La banque ne répond pas. Nouvel essai dans quelques heures." }, { merge: true });
    throw e;
  }
}
const pub = (a) => ({ uid: a.uid, name: a.name || "", iban: a.iban || "", currency: a.currency || "EUR", balance: a.balance ?? null });

/* ───────── auth: Firebase ID token + gérant ───────── */
async function caller(req, rid) {
  const h = req.get("authorization") || ""; const m = h.match(/^Bearer (.+)$/); if (!m) throw new BqErr("auth", 401);
  let u; try { u = await admin.auth().verifyIdToken(m[1]); } catch (e) { throw new BqErr("auth", 401); }
  if (!rid || typeof rid !== "string" || rid.includes("/")) throw new BqErr("rid", 400);
  const mem = await db.doc(`restos/${rid}/members/${u.uid}`).get(); if (!mem.exists) throw new BqErr("forbidden", 403);
  if ((mem.data() || {}).role !== "gerant") throw new BqErr("forbidden", 403); /* money: gérant only */
  return u.uid;
}

/* ───────── HTTPS endpoint ───────── */
const banqueApi = onRequest({ region: REGION, cors: [/growthgusto\.fr$/, /growth-gusto\.web\.app$/, /growth-gusto\.firebaseapp\.com$/], secrets: BANQUE_SECRETS, timeoutSeconds: 120, memory: "256MiB", maxInstances: 5 }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  const b = req.body || {}; const { op, rid } = b;
  try {
    if (op === "banks") { await caller(req, rid); res.json({ banks: (await banks()).map((x) => ({ name: x.name, logo: x.logo, beta: x.beta })) }); return; }
    if (op === "start") {
      const uid = await caller(req, rid); if (!configured()) throw new BqErr("not_configured", 503);
      /* each linked account is billed by Enable Banking: paying Chef (complet) restaurants only, plus the Growth Gusto team */
      const R = (await db.doc(`restos/${rid}`).get()).data() || {};
      const paid = R.plan === "complet" && (!R.paidUntil || +R.paidUntil > Date.now());
      const team = await admin.auth().getUser(uid).then((u) => ADMINS.includes(String(u.email || "").toLowerCase())).catch(() => false);
      if (!paid && !team) throw new BqErr("plan", 402);
      const name = String(b.bank || "").slice(0, 120); const bank = (await banks()).find((x) => x.name === name); if (!bank) throw new BqErr("bank", 400);
      const psu = b.psu === "personal" ? "personal" : "business";
      const days = Math.max(1, Math.min(180, bank.max ? Math.floor(bank.max / 86400) : 90));
      const state = "bq_" + crypto.randomBytes(20).toString("hex");
      await db.collection("bankStates").doc(state).set({ rid, uid, bank: bank.name, psu, at: Date.now() });
      const r = await eb("/auth", { method: "POST", json: { access: { valid_until: new Date(Date.now() + days * 864e5 - 6e4).toISOString() }, aspsp: { name: bank.name, country: "FR" }, state, redirect_url: APP, psu_type: psu, language: "fr" } });
      if (!r || !r.url) throw new BqErr("upstream", 502);
      res.json({ url: r.url }); return;
    }
    if (op === "finish") {
      const st = String(b.state || ""); const sref = db.collection("bankStates").doc(st); const snap = st.startsWith("bq_") ? await sref.get() : null;
      if (!snap || !snap.exists) throw new BqErr("state", 400); const S = snap.data(); await sref.delete();
      if (Date.now() - S.at > 30 * 6e4) throw new BqErr("state", 400);
      const uid = await caller(req, S.rid); if (uid !== S.uid) throw new BqErr("state", 400);
      const r = await eb("/sessions", { method: "POST", json: { code: String(b.code || "") } });
      if (!r || !r.session_id) throw new BqErr("upstream", 502);
      const iban = (a) => { const s = String((a.account_id && a.account_id.iban) || "").replace(/\s/g, ""); return s ? s.slice(-4) : ""; };
      const accounts = (r.accounts || []).filter((a) => a && a.uid).slice(0, 10).map((a) => ({ uid: a.uid, name: clean(a.name || a.product || a.details || "Compte").slice(0, 80), iban: iban(a), currency: a.currency || "EUR", cursor: null }));
      if (!accounts.length) throw new BqErr("no_account", 400);
      const validUntil = (r.access && r.access.valid_until) || null;
      const L = { rid: S.rid, sessionId: r.session_id, bank: S.bank, psu: S.psu, accounts, validUntil, status: "connected", by: uid, connectedAt: Date.now(), fails: 0 };
      await linkRef(S.rid, r.session_id).set(L);
      await statRef(S.rid, r.session_id).set({ kind: "api", bank: S.bank, accounts: accounts.map(pub), validUntil, status: "connected", connectedAt: Date.now(), lastSync: null, lastError: null, by: uid });
      const s = await syncLink(L).catch(() => ({ added: 0 }));
      res.json({ ok: true, bank: S.bank, accounts: accounts.length, added: s.added }); return;
    }
    if (op === "sync") {
      await caller(req, rid); const q = await db.collection("bankLinks").where("rid", "==", rid).get();
      let added = 0; for (const d of q.docs) { const L = d.data(); if (L.status === "off") continue; if (L.lastSync && Date.now() - L.lastSync < 15 * 6e4) continue; added += (await syncLink(L)).added; }
      res.json({ ok: true, added }); return;
    }
    if (op === "disconnect") {
      await caller(req, rid); const sid = String(b.link || "").replace(/^eb_/, ""); if (!sid || sid.includes("/")) throw new BqErr("link", 400);
      const ref = linkRef(rid, sid); const s = await ref.get();
      if (s.exists) { await eb(`/sessions/${encodeURIComponent(sid)}`, { method: "DELETE" }).catch((e) => logger.warn("banque delete session", e.code)); await ref.delete(); }
      await statRef(rid, sid).set({ status: "off", offAt: Date.now() }, { merge: true });
      res.json({ ok: true }); return;
    }
    throw new BqErr("op", 400);
  } catch (e) {
    const code = e instanceof BqErr ? e.code : "server"; if (!(e instanceof BqErr)) logger.error("banqueApi", e); else if (e.detail) logger.warn("banqueApi", code, e.detail);
    res.status(e.status || 500).json({ error: code });
  }
});

/* ───────── every 15 min (called by the single ggTick job) ───────── */
async function banqueTick({ budgetMs = 6 * 60 * 1000 } = {}) {
  if (!configured()) return { due: 0 };
  const t0 = Date.now(); const q = await db.collection("bankLinks").where("status", "==", "connected").get();
  const due = q.docs.map((d) => d.data()).filter((d) => !d.lastSync || Date.now() - d.lastSync > SYNC_EVERY).sort((a, b) => (a.lastSync || 0) - (b.lastSync || 0));
  let ok = 0, ko = 0;
  for (const L of due) { if (Date.now() - t0 > budgetMs) break; try { await syncLink(L); ok++; } catch (e) { ko++; } }
  const old = await db.collection("bankStates").where("at", "<", Date.now() - 3600e3).limit(200).get().catch(() => null);
  if (old && !old.empty) { const b = db.batch(); old.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
  if (due.length) logger.info("banqueTick", { due: due.length, ok, ko, ms: Date.now() - t0 });
  return { due: due.length, ok, ko };
}

module.exports = { banqueApi, banqueTick, BANQUE_SECRETS, _mapTx: mapTx };
