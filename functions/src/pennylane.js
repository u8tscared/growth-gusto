/* Growth Gusto — « Pennylane », server part (Firebase Cloud Functions v2, Node 22, region europe-west9).
 *
 * Pennylane Company API v2 — https://pennylane.readme.io  (base https://app.pennylane.com/api/external/v2, Bearer token,
 *   cursor pagination { items, has_more, next_cursor }, filter=[{field,operator,value}], 25 requests / 5 s per token).
 * Two ways to connect a restaurant, same code afterwards:
 *   · « jeton »  the gérant generates a company API token in Pennylane (plan Essentiel or more: Paramètres › Connectivité ›
 *                Développeurs › Générer un token, « Lecture et écriture », durée illimitée) and pastes it in the app. Free, works today.
 *   · « OAuth »  « Se connecter avec Pennylane » once Growth Gusto is a Pennylane partner app (free application:
 *                https://www.pennylane.com/fr/contact-demande-de-partenariat/). Switched on by PL_OAUTH=1 in functions/.env
 *                and the secrets PL_CLIENT_ID / PL_CLIENT_SECRET. Access 24 h, refresh token 90 days, rotates on each use.
 *
 *   pennylaneApi  HTTPS (POST JSON, Authorization: Bearer <Firebase ID token>) called by js/pennylane.js:
 *     op "info"        → { oauth }   is « Se connecter avec Pennylane » available
 *     op "key"         { token }  → checks GET /me, stores the token ENCRYPTED in plTokens/{rid} (top-level, no client access), first sync
 *     op "start"       → { url }  OAuth authorize URL, state in plStates/{state}
 *     op "finish"      { code, state } → the app comes back on https://app.growthgusto.fr/?pennylane=1&code=…&state=…
 *     op "sync"        → syncs now → { tx, inv, sent }
 *     op "disconnect"  → forgets the token (revoked at Pennylane for OAuth)
 *   pennylaneTick()  plain async function called by the single ggTick job (cost rule): each link at most every 3 h.
 *
 * What one sync does
 *   1. Bank (Pennylane already reads the restaurant's banks for free): GET /transactions since the last sync (first time: 90 days)
 *      → restos/{rid}/bankTx/pl_{id}  { src:"pennylane", link:"pennylane", account, day, amount (positive € TTC), dir:"out"|"in",
 *        label, who, ref, at, syncedAt }  = the shape of functions/src/banque.js, so js/banque.js sorts them into Finances.
 *      The app's own fields (cat, ht, sure) are never overwritten (merge).
 *   2. Supplier invoices: GET /supplier_invoices since (date) → restos/{rid}/plInv/{id} { day, due, number, supplier, label, ttc, ht, tva,
 *      paid, status, url, at }  shown in the Pennylane sheet (the accountant's truth, not counted twice in Finances).
 *   3. Z tickets → Pennylane (accountant no longer types the sales): one balanced ledger entry per ticket in the sales journal
 *      (POS integration guide): debit cash/payment account TTC, credit sales HT per VAT rate, credit VAT collected, rounding 658/758.
 *      Accounts are found by number (created if missing), numbers can be changed by the gérant (restos/{rid}/pennylane/cfg.acc).
 *      Sent log restos/{rid}/plSent/{ticketId} { entryId, hash, day, ttc, at, err? }: a ticket edited afterwards is updated (PUT).
 *      Only tickets from cfg.from (default: 1st of the month of the connection) and older than 45 min are sent; cfg.pushZ=false stops it.
 *   Status: restos/{rid}/pennylane/link { mode, company, status:"connected"|"error"|"off", canWrite, connectedAt, lastSync, lastError, counts }
 *
 * Secrets: PL_ENC_KEY (any long random string: encrypts the stored tokens). With PL_OAUTH=1 also PL_CLIENT_ID, PL_CLIENT_SECRET.
 * Cost: nothing at Pennylane for us (the restaurant pays its own Pennylane), a few Firestore writes per restaurant every 3 h. */
"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const OAUTH = String(process.env.PL_OAUTH || "") === "1";
const SEC = { PL_ENC_KEY: defineSecret("PL_ENC_KEY") };
if (OAUTH) { SEC.PL_CLIENT_ID = defineSecret("PL_CLIENT_ID"); SEC.PL_CLIENT_SECRET = defineSecret("PL_CLIENT_SECRET"); }
const PENNYLANE_SECRETS = Object.values(SEC);
const sec = (k) => { try { return SEC[k] ? String(SEC[k].value() || "").trim() : ""; } catch (e) { return ""; } };

const API = "https://app.pennylane.com/api/external/v2";
const OA = "https://app.pennylane.com/oauth";
const APP = "https://app.growthgusto.fr/";
const REDIRECT = APP + "?pennylane=1";
const SCOPES = "transactions:readonly bank_accounts:readonly supplier_invoices:readonly journals:all ledger_accounts:all ledger_entries:all file_attachments:all";
const REGION = "europe-west9";
const TZ = "Europe/Paris";
const SYNC_EVERY = 3 * 36e5;
const FIRST_DAYS = 90;
const MAX_PUSH = 40; /* tickets sent per sync (rate limit: 25 calls / 5 s) */
class PlErr extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
const r2 = (v) => Math.round((+v || 0) * 100) / 100;
const money = (v) => r2(v).toFixed(2);
const nOf = (v) => { if (v == null || v === "") return null; const x = typeof v === "string" ? parseFloat(v.replace(",", ".")) : +v; return isFinite(x) ? x : null; };
const first = (...v) => { for (const x of v) { const y = nOf(x); if (y != null) return y; } return null; };
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const dayOf = (ms) => new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ───────── token encryption (AES-256-GCM) ───────── */
const encKey = () => { const k = sec("PL_ENC_KEY"); if (!k) throw new PlErr("not_configured", 503); return crypto.createHash("sha256").update(k).digest(); };
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

/* ───────── Pennylane HTTP (rate limit aware) ───────── */
async function pl(T, path, { method = "GET", json, form, query } = {}) {
  let url = path.startsWith("http") ? path : API + path;
  if (query) { const q = new URLSearchParams(); for (const [k, v] of Object.entries(query)) if (v != null && v !== "") q.set(k, typeof v === "string" ? v : JSON.stringify(v)); const s = q.toString(); if (s) url += (url.includes("?") ? "&" : "?") + s; }
  for (let attempt = 0; ; attempt++) {
    const h = { accept: "application/json", authorization: "Bearer " + T.access };
    let body;
    if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
    if (form) body = form;
    const r = await fetch(url, { method, headers: h, body });
    if (r.status === 429 && attempt < 4) { const ra = +(r.headers.get("retry-after") || 0); await sleep(Math.min(10, Math.max(1, ra || 2 ** attempt)) * 1000); continue; }
    if (r.status === 409 && attempt < 3 && /file_attachment/.test(JSON.stringify(json || ""))) { await sleep(1500); continue; }
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text.slice(0, 300) }; }
    if (!r.ok) {
      const code = r.status === 401 ? "unauthorized" : r.status === 403 ? "scope" : r.status === 404 ? "notfound" : r.status === 422 || r.status === 400 ? "refused" : "upstream";
      const e = new PlErr(code, 502); e.detail = { path: path.split("?")[0], status: r.status, data }; throw e;
    }
    /* keep under 25 calls / 5 s */
    const left = +(r.headers.get("ratelimit-remaining") || 99); if (left < 3) await sleep(2000);
    return data;
  }
}
async function plAll(T, path, query = {}, max = 2000) {
  const out = []; let cursor = null;
  for (let page = 0; page < 60; page++) {
    const r = await pl(T, path, { query: { ...query, limit: "100", cursor } });
    const items = (r && (r.items || r.data)) || (Array.isArray(r) ? r : []);
    out.push(...items); if (out.length >= max) break;
    if (!r || !r.has_more || !r.next_cursor) break; cursor = r.next_cursor;
  }
  return out;
}

/* ───────── OAuth ───────── */
const oauthOn = () => OAUTH && !!(sec("PL_CLIENT_ID") && sec("PL_CLIENT_SECRET"));
async function oaPost(path, form) {
  const r = await fetch(OA + path, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!r.ok) { const e = new PlErr(data && data.error === "invalid_grant" ? "unauthorized" : "upstream", 502); e.detail = { path, status: r.status, data }; throw e; }
  return data || {};
}
const tok = (t, old = {}) => ({ access: t.access_token, refresh: t.refresh_token || old.refresh || "", exp: Date.now() + ((+t.expires_in || 86400) - 300) * 1000, oauth: true });
async function fresh(rid, D) {
  let T = unseal(D.enc);
  if (T.oauth && T.exp && Date.now() > T.exp) {
    if (!oauthOn()) throw new PlErr("not_configured", 503);
    T = tok(await oaPost("/token", { grant_type: "refresh_token", client_id: sec("PL_CLIENT_ID"), client_secret: sec("PL_CLIENT_SECRET"), refresh_token: T.refresh }), T);
    await tokRef(rid).set({ enc: seal(T) }, { merge: true }); /* the refresh token rotates: save it at once */
  }
  return T;
}

/* ───────── Firestore refs ───────── */
const tokRef = (rid) => db.collection("plTokens").doc(rid);
const linkRef = (rid) => db.doc(`restos/${rid}/pennylane/link`);
const cfgRef = (rid) => db.doc(`restos/${rid}/pennylane/cfg`);
const setLink = (rid, o) => linkRef(rid).set(o, { merge: true });

/* ───────── 1. bank transactions ───────── */
function mapTx(t) {
  const amt = first(t.amount, t.currency_amount, t.amount_cents != null ? t.amount_cents / 100 : null);
  if (amt == null || !amt) return null;
  const day = String(t.date || t.emitted_at || t.value_date || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ba = t.bank_account || {}; const tp = t.thirdparty || t.third_party || t.supplier || t.customer || {};
  return {
    src: "pennylane", link: "pennylane", account: String(ba.name || ba.id || t.bank_account_id || ""),
    day, amount: r2(Math.abs(amt)), dir: amt < 0 ? "out" : "in",
    label: clean(t.label || t.description || t.name || "Opération"), who: clean(tp.name || tp.label || ""),
    ref: String(t.id), at: Date.parse(day + "T12:00:00Z"), syncedAt: Date.now(),
  };
}
async function syncTx(rid, T, since) {
  const items = await plAll(T, "/transactions", { filter: [{ field: "date", operator: "gteq", value: since }] }, 5000);
  let n = 0; let b = db.batch(); let inBatch = 0;
  for (const t of items) {
    const m = t && t.id != null ? mapTx(t) : null; if (!m) continue;
    b.set(db.doc(`restos/${rid}/bankTx/pl_${t.id}`), m, { merge: true }); n++;
    if (++inBatch >= 400) { await b.commit(); b = db.batch(); inBatch = 0; }
  }
  if (inBatch) await b.commit();
  return n;
}

/* ───────── 2. supplier invoices ───────── */
function mapInv(v) {
  const day = String(v.date || v.invoice_date || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const sup = v.supplier || v.thirdparty || {};
  const ttc = first(v.currency_amount, v.amount, v.total);
  const ht = first(v.currency_amount_before_tax, v.amount_before_tax, ttc != null && v.currency_tax != null ? ttc - nOf(v.currency_tax) : null);
  const out = {
    day, due: String(v.deadline || "").slice(0, 10) || null, number: clean(v.invoice_number || ""),
    supplier: clean(v.supplier_name || sup.name || sup.label || ""), label: clean(v.label || ""),
    ttc: ttc != null ? r2(ttc) : null, ht: ht != null ? r2(ht) : null, tva: first(v.currency_tax, v.tax),
    paid: v.paid === true || v.payment_status === "fully_paid" || v.payment_status === "paid",
    status: String(v.status || v.payment_status || ""), url: String(v.public_file_url || v.file_url || ""), at: Date.now(),
  };
  if (out.tva != null) out.tva = r2(out.tva);
  return out;
}
async function syncInv(rid, T, since) {
  const items = await plAll(T, "/supplier_invoices", { filter: [{ field: "date", operator: "gteq", value: since }], sort: "-date" }, 3000);
  let n = 0; let b = db.batch(); let inBatch = 0;
  for (const v of items) {
    const m = v && v.id != null ? mapInv(v) : null; if (!m) continue;
    b.set(db.doc(`restos/${rid}/plInv/${v.id}`), m, { merge: true }); n++;
    if (++inBatch >= 400) { await b.commit(); b = db.batch(); inBatch = 0; }
  }
  if (inBatch) await b.commit();
  return n;
}

/* ───────── 3. Z tickets → ledger entries ───────── */
/* default chart of accounts (Plan comptable général), changeable in the app */
const ACC = {
  cash: { number: "530000", label: "Caisse" },
  sales: { 20: { number: "706200", label: "Ventes restauration TVA 20 %" }, 10: { number: "706100", label: "Ventes restauration TVA 10 %" }, 5.5: { number: "706055", label: "Ventes à emporter TVA 5,5 %" }, 2.1: { number: "706021", label: "Ventes TVA 2,1 %" }, 0: { number: "706000", label: "Ventes" } },
  vat: { 20: { number: "445712", label: "TVA collectée 20 %" }, 10: { number: "445711", label: "TVA collectée 10 %" }, 5.5: { number: "445713", label: "TVA collectée 5,5 %" }, 2.1: { number: "445714", label: "TVA collectée 2,1 %" }, 0: { number: "445710", label: "TVA collectée" } },
  roundD: { number: "658000", label: "Charges diverses de gestion courante (arrondis)" },
  roundC: { number: "758000", label: "Produits divers de gestion courante (arrondis)" },
};
const RATES = [20, 10, 5.5, 2.1];
const rateKey = (r) => { const x = nOf(r); if (x == null) return 0; const p = x > 0 && x < 1 ? x * 100 : x; return RATES.find((k) => Math.abs(k - p) < 0.05) ?? 0; };
const accNo = (cfg, kind, rate) => { const o = (cfg.acc && cfg.acc[kind]) || {}; const v = rate == null ? o : o[String(rate)]; const def = rate == null ? ACC[kind] : (ACC[kind][rate] || ACC[kind][0]); return { number: String((typeof v === "string" && /^\d{3,12}$/.test(v) ? v : "") || def.number), label: def.label }; };

/* the ticket's split by VAT rate: from vat[] when the Z gives it, else the whole HT at 10 % (sur place) */
function zSplit(t) {
  const ttc = r2(first(t.total) || 0); if (!(ttc > 0)) return null;
  const rows = [];
  for (const v of Array.isArray(t.vat) ? t.vat : []) {
    const k = rateKey(v.rate); const vt = first(v.ttc); let ht = first(v.ht); let tva = first(v.tva);
    if (ht == null && vt != null) ht = vt / (1 + k / 100); if (tva == null && ht != null) tva = vt != null ? vt - ht : ht * k / 100;
    if (ht == null || !(ht > 0)) continue; rows.push({ k, ht: r2(ht), tva: r2(tva || 0) });
  }
  if (!rows.length) { const htT = first(t.totalHT, t.ht); const ht = htT != null ? htT : ttc / 1.1; rows.push({ k: htT != null ? rateKey(r2(((ttc - ht) / ht) * 100)) || 10 : 10, ht: r2(ht), tva: r2(ttc - ht) }); }
  return { ttc, rows };
}
const zHash = (t) => crypto.createHash("sha1").update(JSON.stringify([t.date, r2(first(t.total) || 0), t.vat || null, t.totalHT ?? t.ht ?? null])).digest("hex").slice(0, 16);

const accCache = new Map(); /* rid|number → id, per instance */
async function ledgerAccount(rid, T, a) {
  const k = rid + "|" + a.number; if (accCache.has(k)) return accCache.get(k);
  const r = await pl(T, "/ledger_accounts", { query: { filter: [{ field: "number", operator: "eq", value: a.number }], limit: "5" } });
  let it = ((r && r.items) || [])[0];
  if (!it) it = await pl(T, "/ledger_accounts", { method: "POST", json: { number: a.number, label: a.label } });
  const id = it && it.id; if (!id) throw new PlErr("refused", 502);
  accCache.set(k, id); return id;
}
async function salesJournal(rid, T, cfg) {
  if (cfg.journalId) return cfg.journalId;
  const all = await plAll(T, "/journals", {}, 500);
  const want = String((cfg.journal || "VT")).toUpperCase();
  let j = all.find((x) => String(x.code || "").toUpperCase() === want) || all.find((x) => ["VT", "VE", "VTE"].includes(String(x.code || "").toUpperCase())) || all.find((x) => /sale|vente/i.test(String(x.type || "") + " " + String(x.label || "")));
  if (!j) j = await pl(T, "/journals", { method: "POST", json: { code: want, label: "Ventes" } });
  if (!j || !j.id) throw new PlErr("refused", 502);
  await cfgRef(rid).set({ journalId: j.id, journalCode: j.code || want }, { merge: true });
  return j.id;
}
async function zPhoto(T, t) {
  const url = [...(t.photoUrls || [])].find((u) => /^https:\/\//.test(u)); if (!url) return null;
  try {
    const r = await fetch(url); if (!r.ok) return null; const type = r.headers.get("content-type") || "image/jpeg";
    if (!/^(image\/(png|jpeg|tiff|bmp|gif)|application\/pdf)/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 15e6) return null;
    const fd = new FormData(); fd.append("file", new Blob([buf], { type }), `ticket-z-${t.date}.${type.includes("pdf") ? "pdf" : type.split("/")[1].replace("jpeg", "jpg")}`); fd.append("filename", `ticket-z-${t.date}`);
    const a = await pl(T, "/file_attachments", { method: "POST", form: fd });
    return a && a.id ? a.id : null;
  } catch (e) { return null; }
}
async function zEntry(rid, T, cfg, jid, t, fileId) {
  const S = zSplit(t); if (!S) return null;
  const cash = await ledgerAccount(rid, T, accNo(cfg, "cash"));
  const lines = [{ debit: money(S.ttc), credit: "0.00", ledger_account_id: cash, label: `Ticket Z du ${t.date}` }];
  let credit = 0;
  for (const x of S.rows) {
    lines.push({ debit: "0.00", credit: money(x.ht), ledger_account_id: await ledgerAccount(rid, T, accNo(cfg, "sales", x.k)), label: `Ventes ${x.k ? String(x.k).replace(".", ",") + " %" : ""}`.trim() });
    if (x.tva > 0) lines.push({ debit: "0.00", credit: money(x.tva), ledger_account_id: await ledgerAccount(rid, T, accNo(cfg, "vat", x.k)), label: `TVA ${x.k ? String(x.k).replace(".", ",") + " %" : ""}`.trim() });
    credit += x.ht + x.tva;
  }
  const diff = r2(S.ttc - credit);
  if (diff > 0) lines.push({ debit: "0.00", credit: money(diff), ledger_account_id: await ledgerAccount(rid, T, accNo(cfg, "roundC")), label: "Écart d'arrondi" });
  if (diff < 0) lines.push({ debit: money(-diff), credit: "0.00", ledger_account_id: await ledgerAccount(rid, T, accNo(cfg, "roundD")), label: "Écart d'arrondi" });
  const body = { date: t.date, label: `Ventes du ${t.date.split("-").reverse().join("/")} (ticket Z)`, journal_id: jid, piece_number: `Z-${t.date}`, ledger_entry_lines: lines };
  if (fileId) body.file_attachment_id = fileId;
  return { body, ttc: S.ttc };
}
async function pushZ(rid, T, cfg, link) {
  if (cfg.pushZ === false || link.canWrite === false) return { sent: 0, failed: 0 };
  const from = cfg.from || dayOf(link.connectedAt || Date.now()).slice(0, 8) + "01";
  const q = await db.collection(`restos/${rid}/tickets`).where("date", ">=", from).get();
  const sent = new Map(); (await db.collection(`restos/${rid}/plSent`).where("day", ">=", from).get()).docs.forEach((d) => sent.set(d.id, d.data()));
  const today = dayOf(Date.now()); const cutoff = Date.now() - 45 * 6e4;
  /* several tickets the same day (a Z in parts is one ticket, but a caisse may roll a separate one): each is its own entry */
  const todo = q.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.date && t.date <= today && (first(t.total) || 0) > 0 && (+(t.updatedAt || t.at || 0) < cutoff))
    .filter((t) => { const s = sent.get(t.id); return !s || (s.hash !== zHash(t) && !(s.tries >= 3 && s.hash === "err:" + zHash(t))); })
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_PUSH);
  if (!todo.length) return { sent: 0, failed: 0 };
  const jid = await salesJournal(rid, T, cfg);
  let ok = 0, ko = 0;
  for (const t of todo) {
    const prev = sent.get(t.id); const h = zHash(t); const ref = db.doc(`restos/${rid}/plSent/${t.id}`);
    try {
      const fileId = prev && prev.entryId ? null : cfg.photos === false ? null : await zPhoto(T, t);
      const E = await zEntry(rid, T, cfg, jid, t, fileId); if (!E) continue;
      let entryId = prev && prev.entryId;
      /* edited after sending: update the same entry; if Pennylane refuses (entry locked, period closed), never post a second one */
      if (entryId) { try { await pl(T, `/ledger_entries/${entryId}`, { method: "PUT", json: E.body }); } catch (e) { if (e.code === "unauthorized") throw e; if (e.code !== "notfound") throw new PlErr("edited", 502); entryId = null; } }
      if (!entryId) { const r = await pl(T, "/ledger_entries", { method: "POST", json: E.body }); entryId = r && r.id; }
      await ref.set({ entryId: entryId || null, hash: h, day: t.date, ttc: E.ttc, at: Date.now(), err: null, tries: 0 }, { merge: true }); ok++;
    } catch (e) {
      ko++; logger.warn("pennylane zpush", rid, t.id, e.code, e.detail && JSON.stringify(e.detail).slice(0, 400));
      const tries = (prev && prev.hash === "err:" + h ? prev.tries || 0 : 0) + 1;
      await ref.set({ day: t.date, hash: "err:" + h, tries, err: ["scope", "refused", "edited"].includes(e.code) ? e.code : "upstream", errAt: Date.now(), ...(prev && prev.entryId ? {} : { entryId: null }) }, { merge: true });
      if (e.code === "scope") { await setLink(rid, { canWrite: false }); break; }
      if (e.code === "unauthorized") throw e;
    }
  }
  return { sent: ok, failed: ko };
}

/* ───────── one restaurant ───────── */
async function syncOne(rid) {
  const snap = await tokRef(rid).get(); if (!snap.exists) throw new PlErr("not_connected", 404);
  const D = snap.data(); const T = await fresh(rid, D);
  const link = (await linkRef(rid).get()).data() || {}; const cfg = (await cfgRef(rid).get()).data() || {};
  const since = D.lastSync ? dayOf(D.lastSync - 10 * 864e5) : dayOf(Date.now() - FIRST_DAYS * 864e5);
  try {
    const tx = cfg.pullBank === false ? 0 : await syncTx(rid, T, since).catch((e) => { if (e.code === "scope") return -1; throw e; });
    const inv = await syncInv(rid, T, since).catch((e) => { if (e.code === "scope") return -1; throw e; });
    const z = await pushZ(rid, T, cfg, link);
    const now = Date.now();
    await tokRef(rid).set({ lastSync: now, fails: 0 }, { merge: true });
    await setLink(rid, { status: "connected", lastSync: now, lastError: null, last: { tx: Math.max(0, tx), inv: Math.max(0, inv), sent: z.sent, failed: z.failed, noBank: tx < 0, noInv: inv < 0 } });
    return { tx: Math.max(0, tx), inv: Math.max(0, inv), sent: z.sent, failed: z.failed };
  } catch (e) {
    const fails = (D.fails || 0) + 1; const lost = e.code === "unauthorized";
    await tokRef(rid).set({ fails, lastFail: Date.now(), lastSync: Date.now() }, { merge: true });
    if (lost || fails >= 3) await setLink(rid, { status: "error", lastError: lost ? "lost" : "down" });
    if (lost) await tokRef(rid).set({ status: "error" }, { merge: true });
    throw e;
  }
}
async function connect(rid, uid, T, mode) {
  let me; try { me = await pl(T, "/me"); } catch (e) { throw new PlErr(e.code === "unauthorized" || e.code === "scope" ? "badkey" : "upstream", 400); }
  const company = clean((me && me.company && me.company.name) || "");
  /* can it write? (a « Lecture seule » token is refused here, the bank and invoices still come in) */
  let canWrite = true; try { await pl(T, "/journals", { query: { limit: "1" } }); } catch (e) { if (e.code === "scope") canWrite = false; }
  const now = Date.now();
  await tokRef(rid).set({ rid, mode, enc: seal(T), status: "connected", by: uid, connectedAt: now, lastSync: null, fails: 0, company });
  await setLink(rid, { mode, company, status: "connected", canWrite, connectedAt: now, by: uid, lastSync: null, lastError: null, last: null });
  const c = (await cfgRef(rid).get()).data() || {}; if (!c.from) await cfgRef(rid).set({ from: dayOf(now).slice(0, 8) + "01", pushZ: true }, { merge: true });
  const r = await syncOne(rid).catch((e) => { logger.warn("pennylane first sync", rid, e.code); return { tx: 0, inv: 0, sent: 0 }; });
  return { company, canWrite, ...r };
}

/* ───────── auth: Firebase ID token + gérant ───────── */
async function caller(req, rid, needAdmin) {
  const h = req.get("authorization") || ""; const m = h.match(/^Bearer (.+)$/); if (!m) throw new PlErr("auth", 401);
  let u; try { u = await admin.auth().verifyIdToken(m[1]); } catch (e) { throw new PlErr("auth", 401); }
  if (!rid || typeof rid !== "string" || rid.includes("/")) throw new PlErr("rid", 400);
  const mem = await db.doc(`restos/${rid}/members/${u.uid}`).get(); if (!mem.exists) throw new PlErr("forbidden", 403);
  const md = mem.data() || {}; const boss = md.role === "gerant" || (md.perms && md.perms.level === "admin");
  if (needAdmin && !boss) throw new PlErr("forbidden", 403);
  return u.uid;
}

/* ───────── HTTPS endpoint ───────── */
const pennylaneApi = onRequest({ region: REGION, cors: [/growthgusto\.fr$/, /growth-gusto\.web\.app$/, /growth-gusto\.firebaseapp\.com$/], secrets: PENNYLANE_SECRETS, timeoutSeconds: 300, memory: "256MiB", maxInstances: 5 }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  const b = req.body || {}; const { op, rid } = b;
  try {
    if (op === "info") { res.json({ oauth: oauthOn() }); return; }
    if (op === "key") {
      const uid = await caller(req, rid, true);
      const key = String(b.token || "").trim(); if (key.length < 16 || key.length > 600 || /\s/.test(key)) throw new PlErr("badkey", 400);
      res.json({ ok: true, ...(await connect(rid, uid, { access: key }, "jeton")) }); return;
    }
    if (op === "start") {
      const uid = await caller(req, rid, true); if (!oauthOn()) throw new PlErr("not_configured", 503);
      const state = "pl_" + crypto.randomBytes(24).toString("hex");
      await db.collection("plStates").doc(state).set({ rid, uid, at: Date.now() });
      const q = new URLSearchParams({ response_type: "code", client_id: sec("PL_CLIENT_ID"), redirect_uri: REDIRECT, scope: SCOPES, state });
      res.json({ url: OA + "/authorize?" + q.toString() }); return;
    }
    if (op === "finish") {
      if (!oauthOn()) throw new PlErr("not_configured", 503);
      const sref = db.collection("plStates").doc(String(b.state || "x")); const st = await sref.get();
      if (!st.exists) throw new PlErr("state", 400); const S = st.data(); await sref.delete();
      if (Date.now() - S.at > 20 * 6e4) throw new PlErr("state", 400);
      const uid = await caller(req, S.rid, true); if (uid !== S.uid) throw new PlErr("state", 400);
      const T = tok(await oaPost("/token", { grant_type: "authorization_code", client_id: sec("PL_CLIENT_ID"), client_secret: sec("PL_CLIENT_SECRET"), code: String(b.code || ""), redirect_uri: REDIRECT }));
      res.json({ ok: true, ...(await connect(S.rid, uid, T, "oauth")) }); return;
    }
    if (op === "sync") { await caller(req, rid, false); res.json({ ok: true, ...(await syncOne(rid)) }); return; }
    if (op === "disconnect") {
      await caller(req, rid, true);
      const snap = await tokRef(rid).get();
      if (snap.exists && oauthOn()) { try { const T = unseal(snap.data().enc); if (T.oauth) await oaPost("/revoke", { client_id: sec("PL_CLIENT_ID"), client_secret: sec("PL_CLIENT_SECRET"), token: T.refresh || T.access }); } catch (e) {} }
      await tokRef(rid).delete();
      await setLink(rid, { status: "off", offAt: Date.now() }); res.json({ ok: true }); return;
    }
    throw new PlErr("op", 400);
  } catch (e) {
    const code = e instanceof PlErr ? e.code : "server"; if (!(e instanceof PlErr)) logger.error("pennylaneApi", e); else if (e.detail) logger.warn("pennylaneApi", op, code, JSON.stringify(e.detail).slice(0, 500));
    res.status(e.status || 500).json({ error: code });
  }
});

/* ───────── every 15 min (called by the single scheduled job) ───────── */
async function pennylaneTick({ budgetMs = 6 * 60 * 1000 } = {}) {
  const t0 = Date.now(); const q = await db.collection("plTokens").where("status", "==", "connected").get();
  const due = q.docs.map((d) => d.data()).filter((d) => !d.lastSync || Date.now() - d.lastSync > SYNC_EVERY).sort((a, b) => (a.lastSync || 0) - (b.lastSync || 0));
  let ok = 0, ko = 0;
  for (const d of due) { if (Date.now() - t0 > budgetMs) break; try { await syncOne(d.rid); ok++; } catch (e) { ko++; } }
  const old = await db.collection("plStates").where("at", "<", Date.now() - 3600e3).limit(200).get().catch(() => null);
  if (old && !old.empty) { const b = db.batch(); old.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
  if (due.length) logger.info("pennylaneTick", { due: due.length, ok, ko, ms: Date.now() - t0 });
}

module.exports = { pennylaneApi, pennylaneTick, PENNYLANE_SECRETS, _zSplit: zSplit, _mapTx: mapTx, _mapInv: mapInv };
