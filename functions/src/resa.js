/* Growth Gusto — server side of the reservations (js/resa.js, reserver/). Firebase Functions v2, Node 20, region europe-west9.
   One Firestore trigger: onResaBooking (new restos/{rid}/bookings/{bid}).
   For an online booking (source "web") that left an e-mail address, it sends the client a short confirmation through Brevo
   (transactional API, free plan; same secret BREVO_KEY and same shared daily counter _meta/brevo as functions/src/alertes.js).
   The first run sets restos/{rid}.server.resa = true: the app then shows « e-mail de confirmation actif » and writes mail:true in the
   public projection, so the booking page offers the e-mail field « pour recevoir la confirmation ». Without this function everything
   works the same, the page simply says the booking is registered. No SMS, nothing else is sent. */
"use strict";
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const BREVO_KEY = defineSecret("BREVO_KEY");
const REGION = "europe-west9";
const SENDER_EMAIL = "reservations@growthgusto.fr";
const DAILY_CAP = 290, TZ = "Europe/Paris";
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const longDay = (k) => { const [y, m, d] = String(k).split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d, 12)); return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`; };
const parisDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/* daily cap shared with the alert e-mails (Brevo free plan: 300 a day) */
async function quota(n) {
  const ref = db().doc("_meta/brevo"), day = parisDay();
  return db().runTransaction(async (t) => { const s = await t.get(ref); const d = s.exists ? s.data() : {}; const used = d.day === day ? d.n || 0 : 0; if (used + n > DAILY_CAP) return false; t.set(ref, { day, n: used + n }); return true; });
}
function mailHtml(r, b) {
  const c = r.resaCfg || {}, name = r.name || "le restaurant";
  const row = (k, v) => `<tr><td style="padding:6px 0;color:#6E6880;font-size:14px">${k}</td><td style="padding:6px 0;font-weight:700;font-size:16px;text-align:right">${v}</td></tr>`;
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#FBF6EC;font-family:Helvetica,Arial,sans-serif;color:#1B1530">
  <div style="max-width:480px;margin:0 auto;padding:28px 16px">
    <div style="background:#4C1FEA;color:#fff;border-radius:24px 24px 0 0;padding:24px 22px"><div style="font-size:14px;color:#D9D2FF">Votre table est réservée</div><div style="font-size:26px;font-weight:800;margin-top:4px">${esc(name)}</div></div>
    <div style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-top:0;border-radius:0 0 24px 24px;padding:20px 22px">
      <p style="margin:0 0 14px;font-size:15px">Bonjour ${esc(b.name)}, c'est noté, nous vous attendons.</p>
      <table style="width:100%;border-collapse:collapse">${row("Jour", esc(longDay(b.date)))}${row("Heure", esc(b.time))}${row("Personnes", esc(b.covers))}${b.notes ? row("Votre précision", esc(b.notes)) : ""}</table>
      ${c.address ? `<p style="margin:16px 0 0;font-size:14px;color:#4A4560">${esc(c.address)}</p>` : ""}
      ${c.phone ? `<p style="margin:6px 0 0;font-size:14px;color:#4A4560">Un changement, un empêchement ? Appelez-nous au <b>${esc(c.phone)}</b>.</p>` : ""}
    </div>
    <p style="text-align:center;font-size:12px;color:#6E6880;margin-top:16px">Réservation en ligne par Growth Gusto</p>
  </div></body></html>`;
}

const onResaBooking = onDocumentCreated({ document: "restos/{rid}/bookings/{bid}", region: REGION, secrets: [BREVO_KEY] }, async (ev) => {
  const b = ev.data && ev.data.data(); const { rid, bid } = ev.params;
  if (!b || b.source !== "web") return;
  const rs = await db().doc(`restos/${rid}`).get(); if (!rs.exists) return; const r = rs.data();
  if (!(r.server && r.server.resa)) await db().doc(`restos/${rid}`).set({ server: { resa: true } }, { merge: true });
  const email = String(b.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  if (!(await quota(1))) { logger.warn("resa: Brevo daily cap reached"); return; }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: String(r.name || "Réservation").slice(0, 60), email: SENDER_EMAIL }, to: [{ email, name: String(b.name || "").slice(0, 60) }],
      subject: `Votre table chez ${r.name || "nous"} : ${longDay(b.date)} à ${b.time}`, htmlContent: mailHtml(r, b) }),
  });
  if (!res.ok) { logger.error("resa: Brevo", res.status, await res.text().catch(() => "")); return; }
  await ev.data.ref.set({ mailedAt: Date.now() }, { merge: true }).catch(() => {});
  logger.info("resa: confirmation sent", rid, bid);
});

module.exports = { onResaBooking };
