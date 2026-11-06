/* Growth Gusto — server side of the client file & loyalty (js/clients.js). Firebase Functions v2, Node 22, region europe-west9.
   Exports (functions/index.js picks them up):
     clientsApi    callable, members only (gérant or chef): op « send » { rid, cid } sends the e-mail campaign restos/{rid}/campaigns/{cid}
                   to the clients who said yes. Consent is checked HERE, from the client file and the bookings (optin ticked on the
                   booking page), never trusted from the app. What does not fit today's quota waits in clientsQueue and leaves the next morning.
     clientsUnsub  HTTPS GET/POST https://europe-west9-growth-gusto.cloudfunctions.net/clientsUnsub?r=&c=&t= — the unsubscribe link of every
                   e-mail (GET shows a confirm button so link scanners cannot unsubscribe anyone; POST = one-click, RFC 8058). Sets optEmail false.
     clientsTick   plain async function for the lead's single 15-min job: drains the queue (from 9 h) and sends the birthday e-mail
                   (restos with fidCfg.bday, around 10 h Paris time, once a year per client: bdaySent = "YYYY").
   Cost: Brevo free plan (300 e-mails a day for the whole of Growth Gusto). The counter _meta/brevo is shared with alertes.js, resa.js and
   mails.js (cap 290); campaigns only use it while it stays under CAMPAIGN_CAP, so the transactional e-mails (alerts, booking
   confirmations, account codes) always keep room. Each restaurant: MONTH_CAP campaign e-mails a month.
   Server-only collections (no rule = no client access): clientsQueue/{rid_cid} { rid, cid, left:[key], at }, _meta/clients { salt },
   clientsQuota/{rid} { month, n }. */
"use strict";
const crypto = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const BREVO_KEY = defineSecret("BREVO_KEY");
const REGION = "europe-west9", TZ = "Europe/Paris";
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "growth-gusto";
const UNSUB = `https://${REGION}-${PROJECT}.cloudfunctions.net/clientsUnsub`;
const BOOK = "https://app.growthgusto.fr/reserver/";
const SENDER_EMAIL = "nouvelles@growthgusto.fr";
const DAILY_CAP = 290, CAMPAIGN_CAP = 200, MONTH_CAP = 600;
const okId = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s);
const mailOk = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m || "").trim());
const pk = (ph) => { const d = String(ph || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-9) : ""; };
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const fill = (t, name) => { const fn = firstName(name); return String(t || "").replace(/(,?\s?)\{pr[ée]nom\}/gi, (m, s) => (fn ? s + fn : "")); };
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function paris(ts = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, md: `${p.month}-${p.day}`, year: p.year, month: `${p.year}-${p.month}`, min: (+p.hour % 24) * 60 + +p.minute };
}

/* ───────── unsubscribe token: HMAC of rid|key with a server-only salt ───────── */
let SALT = null;
async function salt() {
  if (SALT) return SALT; const ref = db().doc("_meta/clients");
  SALT = await db().runTransaction(async (t) => { const s = await t.get(ref); if (s.exists && s.get("salt")) return s.get("salt"); const v = crypto.randomBytes(32).toString("hex"); t.set(ref, { salt: v }, { merge: true }); return v; });
  return SALT;
}
const tokenOf = (sl, rid, k) => crypto.createHmac("sha256", sl).update(`${rid}|${k}`).digest("hex").slice(0, 32);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* ───────── quotas ───────── */
/* n e-mails, if the shared counter stays under the campaign cap and the restaurant under its monthly cap: how many may leave now */
async function take(rid, want) {
  const g = db().doc("_meta/brevo"), r = db().doc(`clientsQuota/${rid}`), now = paris();
  return db().runTransaction(async (t) => {
    const [gs, rs] = await Promise.all([t.get(g), t.get(r)]); const gd = gs.exists ? gs.data() : {}, rd = rs.exists ? rs.data() : {};
    const used = gd.day === now.day ? +gd.n || 0 : 0, mine = rd.month === now.month ? +rd.n || 0 : 0;
    const n = Math.max(0, Math.min(want, CAMPAIGN_CAP - used, DAILY_CAP - used, MONTH_CAP - mine)); if (!n) return 0;
    t.set(g, { day: now.day, n: used + n }); t.set(r, { month: now.month, n: mine + n }); return n;
  });
}

/* ───────── who may receive: the client file says yes, or ticked « oui » on a booking made after the last choice ───────── */
async function audience(rid, keys) {
  const [cs, bs] = await Promise.all([db().collection(`restos/${rid}/clients`).get(), db().collection(`restos/${rid}/bookings`).where("optin", "==", true).get()]);
  const B = {}; bs.forEach((d) => { const b = d.data(), k = pk(b.phone); if (!k) return; const x = (B[k] ||= { at: 0, email: "", name: "" }); const at = +b.createdAt || 1; if (at > x.at) { x.at = at; x.name = b.name || x.name; } if (b.email && !x.email) x.email = b.email; });
  const C = {}; cs.forEach((d) => { C[d.id] = d.data(); });
  const out = [];
  for (const k of keys) {
    if (!okId(k)) continue; const c = C[k] || {}, b = B[k] || { at: 0 };
    const has = c.optEmail != null || c.optSms != null, newer = b.at > Math.max(+c.optAt || 0, +c.unsubAt || 0);
    const yes = newer || (!has && b.at > 0) || (has && c.optEmail === true);
    const email = String(c.email || b.email || "").trim();
    if (yes && mailOk(email)) out.push({ k, email, name: c.name || b.name || "" });
  }
  return out;
}

/* ───────── the e-mail (V2: cream paper, the restaurant's violet header, one button, the unsubscribe line) ───────── */
function campaignHtml(r, subject, text, link, unsub) {
  const lg = typeof r.logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.logo) && r.logo.length <= 2000 ? r.logo : "";
  const paras = String(text || "").split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#4A4560">${esc(p)}</p>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B1530">
<div style="max-width:500px;margin:0 auto;padding:24px 14px 32px">
 <div style="background:#4C1FEA;border-radius:26px 26px 0 0;padding:26px 24px 28px;color:#ffffff">
  ${lg ? `<img src="${esc(lg)}" width="52" height="52" alt="${esc(r.name)}" style="display:block;width:52px;height:52px;border-radius:15px;background:#ffffff;object-fit:contain;margin:0 0 14px;border:0">` : ""}
  <div style="font-size:14px;color:#D9D2FF;font-weight:600">${esc(r.name)}</div>
  <div style="font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.5px;margin-top:6px">${esc(subject)}</div>
 </div>
 <div style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-top:0;border-radius:0 0 26px 26px;padding:24px 22px 22px;box-shadow:0 3px 0 #E2D6C2">
  ${paras}
  ${link ? `<a href="${esc(link)}" style="display:block;text-align:center;text-decoration:none;font-weight:700;font-size:16px;padding:15px 18px;border-radius:16px;margin-top:8px;background:#5B2BFF;color:#ffffff;box-shadow:0 4px 0 #2A0BA6">Réserver une table</a>` : ""}
  ${r.address ? `<div style="margin-top:18px;font-size:14px;color:#4A4560">${esc(r.address)}</div>` : ""}
  ${r.phone ? `<div style="margin-top:6px;font-size:14px;color:#4A4560"><a href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ""))}" style="color:#3A10D8;font-weight:700;text-decoration:none">${esc(r.phone)}</a></div>` : ""}
 </div>
 <div style="text-align:center;font-size:12px;line-height:1.5;color:#6E6880;margin-top:18px">Vous recevez cet e-mail car vous avez accepté les nouvelles de ${esc(r.name)}.<br><a href="${esc(unsub)}" style="color:#6E6880">Ne plus recevoir ces e-mails</a></div>
</div></body></html>`;
}
async function restoInfo(rid) {
  const s = await db().doc(`restos/${rid}`).get(); if (!s.exists) return null; const R = s.data() || {}, c = R.resaCfg || {};
  let reply = ""; try { if (R.owner) { const m = await db().doc(`restos/${rid}/members/${R.owner}`).get(); reply = (m.exists && m.get("email")) || ""; } } catch (e) {}
  return { name: String(R.name || "Votre restaurant").slice(0, 60), address: c.address || "", phone: c.phone || "", logo: typeof R.logo === "string" ? R.logo : "", online: !!c.online, reply: mailOk(reply) ? reply : "", fid: R.fidCfg || {} };
}
async function sendOne(rid, r, to, subject, body, sl, tag) {
  const unsub = `${UNSUB}?r=${encodeURIComponent(rid)}&c=${encodeURIComponent(to.k)}&t=${tokenOf(sl, rid, to.k)}`;
  const subj = fill(subject, to.name).slice(0, 120), text = fill(body, to.name);
  const msg = { sender: { name: r.name, email: SENDER_EMAIL }, to: [{ email: to.email, ...(to.name ? { name: String(to.name).slice(0, 60) } : {}) }], subject: subj,
    htmlContent: campaignHtml(r, subj, text, r.online ? `${BOOK}?r=${encodeURIComponent(rid)}` : "", unsub),
    textContent: `${text}\n\n${r.name}${r.address ? "\n" + r.address : ""}${r.phone ? "\n" + r.phone : ""}\n\nNe plus recevoir ces e-mails : ${unsub}`,
    headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, tags: [tag] };
  if (r.reply) msg.replyTo = { email: r.reply, name: r.name };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(msg) });
    if (!res.ok) { logger.error("clients: Brevo", res.status, await res.text().catch(() => "")); return false; } return true;
  } catch (e) { logger.error("clients: Brevo", e); return false; }
}
/* send what today's quota allows; the rest stays in the queue */
async function drain(rid, cid, list) {
  const camp = db().doc(`restos/${rid}/campaigns/${cid}`); const cs = await camp.get(); if (!cs.exists) return { sent: 0, left: 0 };
  const c = cs.data(); const r = await restoInfo(rid); if (!r) return { sent: 0, left: 0 };
  const n = await take(rid, list.length); const now = list.slice(0, n), later = list.slice(n); const sl = await salt();
  let ok = 0; const done = [];
  for (let i = 0; i < now.length; i += 5) { const part = now.slice(i, i + 5); const res = await Promise.all(part.map((to) => sendOne(rid, r, to, c.subject || c.title || r.name, c.body, sl, "campagne"))); res.forEach((x, j) => { if (x) { ok++; done.push(part[j].k); } }); }
  const q = db().doc(`clientsQueue/${rid}_${cid}`);
  if (later.length) await q.set({ rid, cid, left: later, at: Date.now() }); else await q.delete().catch(() => {});
  await camp.set({ sent: admin.firestore.FieldValue.increment(ok), ...(done.length ? { done: admin.firestore.FieldValue.arrayUnion(...done) } : {}), status: later.length ? "envoi" : "envoyee", queued: later.length, via: "server", sentAt: Date.now() }, { merge: true });
  return { sent: ok, left: later.length };
}

const clientsApi = onCall({ region: REGION, cors: true, secrets: [BREVO_KEY], timeoutSeconds: 300, maxInstances: 5, memory: "256MiB" }, async (req) => {
  const d = req.data || {}, op = String(d.op || ""), rid = String(d.rid || ""), uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "compte");
  if (!okId(rid)) throw new HttpsError("invalid-argument", "rid");
  const m = await db().doc(`restos/${rid}/members/${uid}`).get();
  if (!m.exists || !["gerant", "chef"].includes(m.get("role"))) throw new HttpsError("permission-denied", "gerant");
  if (op === "send") {
    const cid = String(d.cid || ""); if (!okId(cid)) throw new HttpsError("invalid-argument", "cid");
    const ref = db().doc(`restos/${rid}/campaigns/${cid}`); const s = await ref.get(); if (!s.exists) throw new HttpsError("not-found", "campagne");
    const c = s.data(); if (c.ch !== "email") throw new HttpsError("failed-precondition", "canal");
    if (c.serverAt) throw new HttpsError("already-exists", "deja");
    await ref.set({ serverAt: Date.now() }, { merge: true });
    const to = await audience(rid, Array.isArray(c.to) ? c.to.slice(0, 2000) : []);
    if (!to.length) { await ref.set({ status: "envoyee", sent: 0, n: 0 }, { merge: true }); return { sent: 0, queued: 0 }; }
    await ref.set({ n: to.length }, { merge: true });
    const r = await drain(rid, cid, to); return { sent: r.sent, queued: r.left };
  }
  throw new HttpsError("invalid-argument", "op");
});

/* ───────── unsubscribe page ───────── */
function page(title, text, form) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;background:#FBF6EC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B1530;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box">
<div style="max-width:420px;width:100%;background:#FFFDF8;border:1.5px solid #E9DFCD;border-radius:26px;padding:28px 24px;box-shadow:0 3px 0 #E2D6C2;text-align:center">
<div style="font-size:26px;font-weight:800;letter-spacing:-.5px;line-height:1.15">${esc(title)}</div><p style="font-size:16px;line-height:1.5;color:#4A4560;margin:14px 0 0">${text}</p>${form || ""}</div></body></html>`;
}
const clientsUnsub = onRequest({ region: REGION, cors: false, maxInstances: 3, memory: "256MiB", timeoutSeconds: 30 }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const q = { ...(req.query || {}), ...(typeof req.body === "object" && req.body ? req.body : {}) };
  const rid = String(q.r || ""), k = String(q.c || ""), t = String(q.t || "");
  if (!okId(rid) || !okId(k) || !/^[a-f0-9]{32}$/.test(t) || !same(tokenOf(await salt(), rid, k), t)) { res.status(400).send(page("Lien invalide", "Ce lien de désinscription n'est pas valable. Répondez simplement à l'e-mail reçu pour ne plus rien recevoir.")); return; }
  const rs = await db().doc(`restos/${rid}`).get(); const name = esc((rs.exists && rs.get("name")) || "ce restaurant");
  if (req.method === "POST") {
    const now = Date.now();
    await db().doc(`restos/${rid}/clients/${k}`).set({ optEmail: false, unsubAt: now, optAt: now, optSrc: "désinscription par e-mail", updatedAt: now }, { merge: true });
    res.status(200).send(page("C'est fait", `Vous ne recevrez plus les e-mails de <b>${name}</b>. Vos réservations, elles, restent confirmées par e-mail.`)); return;
  }
  const act = `${UNSUB}?r=${encodeURIComponent(rid)}&c=${encodeURIComponent(k)}&t=${t}`;
  res.status(200).send(page("Ne plus recevoir ces e-mails ?", `Vous ne recevrez plus les nouvelles et offres de <b>${name}</b>.`,
    `<form method="post" action="${esc(act)}" style="margin:22px 0 0"><button type="submit" style="all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;text-align:center;font-weight:700;font-size:16px;padding:15px 18px;border-radius:16px;background:#5B2BFF;color:#fff;box-shadow:0 4px 0 #2A0BA6">Me désinscrire</button></form>`));
});

/* ───────── 15-min tick: the queue (from 9 h), the birthdays (around 10 h) ───────── */
async function clientsTick() {
  const now = paris(); if (now.min < 9 * 60 || now.min > 20 * 60) return;
  const qs = await db().collection("clientsQueue").limit(20).get();
  for (const d of qs.docs) { const x = d.data(); if (!okId(x.rid) || !okId(x.cid) || !Array.isArray(x.left)) { await d.ref.delete().catch(() => {}); continue; } try { await drain(x.rid, x.cid, x.left); } catch (e) { logger.error("clients: drain", e); } }
  if (now.min < 10 * 60 || now.min >= 10 * 60 + 15) return;
  const rs = await db().collection("restos").where("fidCfg.bday", "==", true).get();
  for (const R of rs.docs) {
    try {
      const rid = R.id; const cs = await db().collection(`restos/${rid}/clients`).where("bday", "==", now.md).get(); if (cs.empty) continue;
      const keys = cs.docs.filter((c) => c.get("bdaySent") !== now.year).map((c) => c.id); if (!keys.length) continue;
      const to = await audience(rid, keys); const r = await restoInfo(rid); if (!r || !to.length) continue;
      const n = await take(rid, to.length); const sl = await salt(); const msg = (r.fid && r.fid.bdayMsg) || "Joyeux anniversaire {prénom} ! Pour fêter ça, le dessert vous est offert ce mois-ci. À très vite !";
      for (const x of to.slice(0, n)) { if (await sendOne(rid, r, x, "Joyeux anniversaire {prénom} !", msg, sl, "anniversaire")) await db().doc(`restos/${rid}/clients/${x.k}`).set({ bdaySent: now.year }, { merge: true }); }
    } catch (e) { logger.error("clients: birthdays", e); }
  }
}

module.exports = { clientsApi, clientsUnsub, clientsTick, BREVO_KEY, _audienceRule: { pk, fill } };
