/* Growth Gusto — server side of the reservations (js/resa.js, reserver/). Firebase Functions v2, Node 22, region europe-west9.
   Exports (functions/index.js picks them up):
     onResaBooking  Firestore trigger, any write on restos/{rid}/bookings/{bid}: sends the client the right e-mail (Brevo) and makes sure
                    the booking has its private manage key. E-mails: demande reçue (validation mode), confirmée (online, phone booking with
                    an e-mail, accepted request, promoted from the waiting list, « Renvoyer » = resendAt), modifiée, refusée (+ message),
                    annulée par le restaurant (+ message), annulation confirmée (client cancel). Never twice for the same change.
     resaManage     callable (no account): the client's own page reserver/?r=&b=&k= — get / cancel / modify, checked against the key.
     resaTick       plain async function for the lead's single 15-min job: the « à demain » reminder, once per booking (remindedAt),
                    and the « Votre dîner s'est bien passé ? » e-mail with the restaurant's Google review link (reviewAskAt, see reviewTick).
                    It also sends « Merci de votre visite ! » to whoever paid online (QR order, bill paid at the table): payReviewTick.
     resaAvisTest   callable (member): sends the manager a test of the review e-mail at their own address.
     BREVO_KEY      the secret (shared with alertes.js); the daily cap _meta/brevo is shared too.
   Manage keys: resaKeys/{rid}/keys/{bid} { k } — no client can read them (firestore rules), the public page writes its own at creation.
   The first event sets restos/{rid}.server.resa = true: the app then says the e-mails are active and the public page offers « gérer ». */
"use strict";
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue, FP = admin.firestore.FieldPath;

const BREVO_KEY = defineSecret("BREVO_KEY");
const REGION = "europe-west9";
const SENDER_EMAIL = "reservations@growthgusto.fr";
const BASE = "https://app.growthgusto.fr/reserver/";
const AVIS_BASE = "https://app.growthgusto.fr/avis/";
const DAILY_CAP = 290, TZ = "Europe/Paris";
const CONF = ["avenir", "en ligne", "confirme"];
const COUNTS = ["avenir", "en ligne", "confirme", "avalider", "arrive"];

/* ───────── Paris time ───────── */
function paris(ts = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
const addDays = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const wday = (k) => new Date(k + "T12:00:00Z").getUTCDay();
/* ms of a Paris wall-clock time */
function parisAt(k, t) { const guess = Date.parse(`${k}T${t}:00Z`); const p = paris(guess); const diff = p.min + (p.day === k ? 0 : p.day > k ? 1440 : -1440) - toMin(t); return guess - diff * 60e3; }

/* ───────── availability (same rules as js/resa.js / reserver.js) ───────── */
const closedOn = (c, k) => (c.closures || []).some((x) => x && x.from && k >= x.from && k <= (x.to || x.from));
const svcsOn = (c, k) => (closedOn(c, k) ? [] : (c.services || []).filter((s) => (s.days || []).includes(wday(k))));
const slotsOf = (c, s) => { const out = [], a = toMin(s.from), b = Math.max(a, toMin(s.to)), st = +c.slot || 15; for (let m = a; m <= b; m += st) out.push(hm(m)); return out; };
function bucket(c, k, time) {
  const list = svcsOn(c, k).length ? svcsOn(c, k) : c.services || []; const m = toMin(time); let best = list[0], bd = 1e9;
  list.forEach((s) => { const a = toMin(s.from), b = toMin(s.to) + (+c.slot || 15); const d = m >= a && m < b ? 0 : Math.min(Math.abs(m - a), Math.abs(m - b)); if (d < bd) { bd = d; best = s; } });
  if (!best) return time; const a = toMin(best.from), st = +c.slot || 15; return hm(m < a ? a : a + Math.floor((m - a) / st) * st);
}

/* ───────── e-mail ───────── */
/* ── client e-mails (identical copy in js/resa.js rsMailHtml and functions/src/resa.js mailHtml: keep both in sync) ── */
const KINDS = {
  demande: { t: "Demande bien reçue", s: (r) => `Demande reçue · ${r.name}` },
  confirme: { t: "Votre table est réservée", s: (r, b, d) => `Table réservée chez ${r.name} · ${d} à ${b.time}` },
  modifie: { t: "Réservation modifiée", s: (r) => `Réservation modifiée · ${r.name}` },
  rappel: { t: "À demain !", s: (r, b) => `À demain chez ${r.name} · ${b.time}` },
  refuse: { t: "Réservation impossible", s: (r) => `Votre demande chez ${r.name}` },
  annule: { t: "Réservation annulée", s: (r) => `Réservation annulée · ${r.name}` },
  annule_client: { t: "Annulation confirmée", s: (r) => `Annulation confirmée · ${r.name}` },
  avis: { t: "Votre dîner s'est bien passé ?", s: (r, b) => `Votre ${meal(b)} chez ${r.name} s'est bien passé ?` },
  /* after an online payment (QR order, bill paid from the table): functions/src/commande.js queues it, payReviewTick sends it */
  paye: { t: "Merci de votre visite !", s: (r) => `Merci de votre visite chez ${r.name} ! Un petit avis ?` },
};
const meal = (b) => (toMin(b && b.time) < 16 * 60 ? "déjeuner" : "dîner");
/* the restaurant's Google review link: a Place ID (ChIJ…) or an https link on a Google domain (g.page/r/…/review, maps.app.goo.gl…).
   Same function in js/resa.js (rsGoogleUrl): keep both in sync. */
function googleUrl(v) {
  const s = String(v || "").trim(); if (!s || s.length > 600) return "";
  if (/^ChIJ[\w-]{10,}$/.test(s)) return "https://search.google.com/local/writereview?placeid=" + s;
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const h = u.hostname.toLowerCase();
  if (!/(^|\.)(google\.[a-z.]{2,6}|g\.page|goo\.gl)$/.test(h)) return "";
  u.protocol = "https:"; return u.toString();
}
function longDay(k) { const D = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], M = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]; const [y, m, d] = String(k || "").split("-").map(Number); if (!y) return ""; const dt = new Date(Date.UTC(y, m - 1, d, 12)); return `${D[dt.getUTCDay()]} ${d} ${M[m - 1]}`; }
function mailHtml(kind, b, r, L) {
  const e = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  if (kind === "avis" || kind === "paye") return avisHtml(b, r, L, e, kind === "paye");
  const K = KINDS[kind] || KINDS.confirme, nm = e(String(b.name || "").trim().split(/\s+/)[0] || ""), rn = e(r.name || "le restaurant");
  /* the restaurant logo, only as an https URL: most mail clients block data: images */
  const lg = typeof r.logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.logo) && r.logo.length <= 2000 ? r.logo : "";
  const lead = {
    demande: `Bonjour ${nm}, votre demande est bien arrivée chez <b>${rn}</b>. Le restaurant la valide au plus vite et vous recevrez un e-mail de confirmation.`,
    confirme: `Bonjour ${nm}, c'est confirmé : <b>${rn}</b> vous attend.`,
    modifie: `Bonjour ${nm}, votre réservation chez <b>${rn}</b> a bien été modifiée. Voici les nouveaux détails.`,
    rappel: `Bonjour ${nm}, petit rappel : <b>${rn}</b> vous attend demain.`,
    refuse: `Bonjour ${nm}, <b>${rn}</b> ne peut malheureusement pas vous accueillir à cette date.`,
    annule: `Bonjour ${nm}, <b>${rn}</b> a dû annuler votre réservation. Toutes nos excuses.`,
    annule_client: `Bonjour ${nm}, votre réservation chez <b>${rn}</b> est bien annulée. À bientôt, on l'espère !`,
  }[kind] || "";
  const off = kind === "refuse" || kind === "annule" || kind === "annule_client";
  const row = (k, v) => `<tr><td style="padding:9px 0;border-top:1px solid #F1E9DA;color:#6E6880;font-size:14px">${k}</td><td style="padding:9px 0;border-top:1px solid #F1E9DA;font-weight:700;font-size:16px;text-align:right;color:#1B1530">${v}</td></tr>`;
  const btn = (href, label, main) => `<a href="${e(href)}" style="display:block;text-align:center;text-decoration:none;font-weight:700;font-size:16px;padding:15px 18px;border-radius:16px;margin-top:10px;${main ? "background:#5B2BFF;color:#ffffff;box-shadow:0 4px 0 #2A0BA6" : "background:#FFFDF8;color:#1B1530;border:1.5px solid #DCCFB8"}">${label}</a>`;
  const msg = b.resaMsg && (kind === "refuse" || kind === "annule") ? `<div style="margin:16px 0 0;padding:13px 15px;background:#FFF3D6;border-radius:14px;color:#7A5A1A;font-size:15px;line-height:1.45">« ${e(b.resaMsg)} »<div style="font-size:12.5px;margin-top:4px">${rn}</div></div>` : "";
  const acts = off ? (L.book ? btn(L.book, "Réserver une autre date", true) : "")
    : (kind !== "demande" && L.ics ? btn(L.ics, "Ajouter à mon agenda", true) : "") + (L.manage ? btn(L.manage, "Modifier ou annuler", kind === "demande") : "");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(K.t)}</title></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B1530">
<div style="max-width:500px;margin:0 auto;padding:24px 14px 32px">
 <div style="background:#4C1FEA;border-radius:26px 26px 0 0;padding:26px 24px 30px;color:#ffffff">
  ${lg ? `<img src="${e(lg)}" width="52" height="52" alt="${rn}" style="display:block;width:52px;height:52px;border-radius:15px;background:#ffffff;object-fit:contain;margin:0 0 14px;border:0">` : ""}
  <div style="font-size:14px;color:#D9D2FF;font-weight:600">${rn}</div>
  <div style="font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-.5px;margin-top:6px">${e(K.t)}</div>
 </div>
 <div style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-top:0;border-radius:0 0 26px 26px;padding:22px 22px 24px;box-shadow:0 3px 0 #E2D6C2">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#4A4560">${lead}</p>
  <table role="presentation" style="width:100%;border-collapse:collapse;${off ? "opacity:.6;text-decoration:line-through" : ""}">${row("Jour", e(longDay(b.date)))}${row("Heure", e(b.time))}${row("Personnes", e(b.covers))}${row("Au nom de", e(b.name))}</table>
  ${b.notes && !off ? `<div style="margin-top:12px;font-size:14px;color:#4A4560">Votre précision : ${e(b.notes)}</div>` : ""}
  ${msg}
  ${r.address ? `<div style="margin-top:16px;font-size:14px;color:#4A4560">Adresse : <b style="color:#1B1530">${e(r.address)}</b></div>` : ""}
  <div style="margin-top:8px">${acts}</div>
  ${r.phone ? `<div style="margin-top:16px;font-size:14px;color:#4A4560;text-align:center">Une question ? Appelez le <a href="tel:${e(String(r.phone).replace(/[^\d+]/g, ""))}" style="color:#3A10D8;font-weight:700;text-decoration:none">${e(r.phone)}</a></div>` : ""}
 </div>
 <div style="text-align:center;font-size:12px;color:#6E6880;margin-top:18px">Réservation en ligne par Growth Gusto</div>
</div></body></html>`;
}

/* The review e-mail (« Votre dîner s'est bien passé ? » after a booking, « Merci de votre visite ! » after an online payment).
   Motion: the hero is an animated GIF (img/mail/avis-etoiles.gif, tools/gen-mail-gif.py): five stars popping in, sparkles. It is the only
   motion every mail client plays (Gmail drops CSS animations; Outlook desktop shows frame 0, the finished picture). Apple Mail and iOS
   also get CSS motion (button shine, stars bouncing in), switched off for « reduce motion ». Every guest gets the same Google button
   (no filtering of unhappy guests: Google forbids it). */
function avisHtml(b, r, L, e, pay) {
  const nm = e(String(b.name || "").trim().split(/\s+/)[0] || ""), rn = e(r.name || "le restaurant"), m = meal(b), away = pay && b.mode === "emporter", pl = !pay && +b.covers > 1 ? "s" : "";
  const lg = typeof r.logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.logo) && r.logo.length <= 2000 ? r.logo : "";
  const g = e(L.review || "#"), av = L.avis || "", sep = /\?/.test(av) ? "&" : "?", go = av ? e(av) : g;
  const title = pay ? (away ? "Merci pour votre commande !" : "Merci de votre visite !") : `Votre ${m} s'est bien passé ?`;
  const lead = pay ? (away ? `${nm ? `Bonjour ${nm}, merci` : "Merci"} d'avoir commandé chez <b style="color:#1B1530">${rn}</b>. On espère que vous vous êtes régalé !`
      : `${nm ? `Bonjour ${nm}, merci` : "Merci"} d'être passé chez <b style="color:#1B1530">${rn}</b> et merci pour votre règlement. Toute l'équipe espère que vous vous êtes régalé !`)
    : `Bonjour ${nm}, merci d'être venu${pl} chez <b style="color:#1B1530">${rn}</b>. Toute l'équipe espère que vous vous êtes régalé${pl} !`;
  const ask = pay ? "Vous avez aimé ? Pouvez-vous nous laisser un avis ?" : "Comment nous avez-vous trouvés ?";
  const HERO = "https://app.growthgusto.fr/img/mail/avis-etoiles.gif";
  const W = ["Bof", "Moyen", "Bien", "Très bien", "Parfait"];
  /* the stars open « Comment nous avez-vous trouvés ? » (avis/ page) with that note already picked; no page link (preview, test): Google */
  const sh = (n) => e(av ? av + sep + "n=" + n : L.review || "#");
  const star = (n) => `<td class="gg-s gg-s${n}" align="center" style="padding:0 3px"><a href="${sh(n)}" style="display:block;text-decoration:none;background:#F6F1FF;border:1.5px solid #E4DAFF;border-radius:16px;padding:10px 0 8px;width:58px" title="${n} sur 5"><span style="display:block;font-size:30px;line-height:1;color:#F5B700">&#9733;</span><span style="display:block;font-size:11px;font-weight:700;color:#6E6880;margin-top:5px;letter-spacing:.2px">${W[n - 1]}</span></a></td>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${e(title)}</title>
<style>
@keyframes ggUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes ggPop{0%{opacity:0;transform:scale(.4) rotate(-12deg)}70%{transform:scale(1.12) rotate(3deg)}100%{opacity:1;transform:none}}
@keyframes ggShine{0%{background-position:-180% 0}55%,100%{background-position:280% 0}}
@keyframes ggGlow{0%,100%{box-shadow:0 10px 26px -8px rgba(91,43,255,.55),0 4px 0 #2A0BA6}50%{box-shadow:0 14px 34px -6px rgba(236,72,153,.55),0 4px 0 #2A0BA6}}
.gg-up{animation:ggUp .7s cubic-bezier(.2,.8,.2,1) both}.gg-d1{animation-delay:.15s}.gg-d2{animation-delay:.3s}.gg-d3{animation-delay:.45s}
.gg-s a{animation:ggPop .55s cubic-bezier(.2,.9,.3,1.3) both}.gg-s1 a{animation-delay:.5s}.gg-s2 a{animation-delay:.6s}.gg-s3 a{animation-delay:.7s}.gg-s4 a{animation-delay:.8s}.gg-s5 a{animation-delay:.9s}
.gg-s a:hover{background:#FFF6D6!important;border-color:#F5B700!important}
.gg-cta{background-image:linear-gradient(110deg,#5B2BFF 0%,#5B2BFF 40%,#9C7BFF 50%,#5B2BFF 60%,#5B2BFF 100%)!important;background-size:250% 100%!important;animation:ggShine 3.2s ease-in-out 1.2s infinite,ggGlow 3.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.gg-up,.gg-s a,.gg-cta{animation:none!important}}
@media (max-width:480px){.gg-s a{width:50px!important}.gg-h1{font-size:27px!important}}
</style></head>
<body style="margin:0;padding:0;background:#EFE9FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B1530;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(ask)} Dix secondes, cinq étoiles, et vous aidez ${rn} à se faire connaître.</div>
<div style="max-width:520px;margin:0 auto;padding:22px 12px 34px">
 <div style="background:#1E0B63;background-image:linear-gradient(160deg,#3A10D8 0%,#24097A 55%,#14063F 100%);border-radius:28px 28px 0 0;padding:24px 24px 0;color:#ffffff;overflow:hidden">
  <table role="presentation" style="border-collapse:collapse"><tr>
   ${lg ? `<td style="padding:0 12px 0 0"><img src="${e(lg)}" width="44" height="44" alt="${rn}" style="display:block;width:44px;height:44px;border-radius:13px;background:#ffffff;object-fit:contain;border:0"></td>` : ""}
   <td><div style="display:inline-block;font-size:13px;font-weight:700;color:#E6DFFF;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:99px;padding:6px 12px">${rn}</div></td>
  </tr></table>
  <div class="gg-up gg-h1" style="font-size:31px;line-height:1.08;font-weight:800;letter-spacing:-.8px;margin:18px 0 0">${e(title)}</div>
  <div class="gg-up gg-d1" style="font-size:16px;line-height:1.45;color:#D9D2FF;margin:8px 0 0">${e(ask)}</div>
  <a href="${go}" style="display:block;margin:16px -24px 0;text-decoration:none"><img src="${HERO}" width="520" alt="★★★★★ Notez-nous en un geste" style="display:block;width:100%;max-width:520px;height:auto;border:0;background:#2A0BA6;color:#F5B700;font-size:28px;text-align:center"></a>
 </div>
 <div style="background:#FFFDF8;border:1.5px solid #E4DAFF;border-top:0;border-radius:0 0 28px 28px;padding:24px 20px 26px;box-shadow:0 18px 40px -22px rgba(42,11,166,.45)">
  <p class="gg-up gg-d2" style="margin:0 0 6px;font-size:16px;line-height:1.55;color:#4A4560">${lead}</p>
  <p class="gg-up gg-d3" style="margin:0;font-size:16px;line-height:1.55;color:#4A4560">Touchez une étoile : c'est fait en <b style="color:#1B1530">dix secondes</b>, et votre avis aide d'autres gourmands à nous découvrir.</p>
  <table role="presentation" align="center" style="border-collapse:collapse;margin:20px auto 4px"><tr>${[1, 2, 3, 4, 5].map(star).join("")}</tr></table>
  <a class="gg-cta" href="${go}" style="display:block;text-align:center;text-decoration:none;font-weight:800;font-size:17px;letter-spacing:.2px;padding:17px 18px;border-radius:18px;margin-top:18px;background:#5B2BFF;background-image:linear-gradient(135deg,#6A3BFF,#4C1FEA);color:#ffffff;box-shadow:0 10px 26px -8px rgba(91,43,255,.55),0 4px 0 #2A0BA6">${av ? "Donner mon avis" : "Laisser un avis sur Google"} &#8594;</a>
  ${av && L.review ? `<div style="margin-top:14px;text-align:center"><a href="${g}" style="color:#3A10D8;font-weight:700;font-size:14px;text-decoration:none">Ou directement sur Google</a></div>` : ""}
  ${r.phone ? `<div style="margin-top:20px;padding:14px 16px;background:#F6F1FF;border-radius:16px;font-size:14px;color:#4A4560;text-align:center;line-height:1.5">Quelque chose ne vous a pas plu ? Dites-le nous aussi, on veut s'améliorer : <a href="tel:${e(String(r.phone).replace(/[^\d+]/g, ""))}" style="color:#3A10D8;font-weight:800;text-decoration:none;white-space:nowrap">${e(r.phone)}</a></div>` : ""}
  ${L.book ? `<div style="margin-top:14px;text-align:center"><a href="${e(L.book)}" style="color:#3A10D8;font-weight:700;font-size:14px;text-decoration:none">Réserver à nouveau</a></div>` : ""}
 </div>
 <div style="text-align:center;font-size:12px;color:#7A7390;margin-top:18px;line-height:1.55">${pay ? "Un seul message après votre paiement en ligne, pas plus d'une fois tous les 4 mois." : "Un seul message après votre venue, pas plus d'une fois tous les 4 mois."}<br>${pay ? "Envoyé par Growth Gusto pour " + rn : "Réservation par Growth Gusto"}</div>
</div></body></html>`;
}

async function quota(n, cap = DAILY_CAP) {
  const ref = db().doc("_meta/brevo"), day = paris().day;
  return db().runTransaction(async (t) => { const s = await t.get(ref); const d = s.exists ? s.data() : {}; const used = d.day === day ? d.n || 0 : 0; if (used + n > cap) return false; t.set(ref, { day, n: used + n }); return true; });
}
function icsOf(b, r, bid) {
  const p = (n) => String(n).padStart(2, "0"); const s = new Date(parisAt(b.date, b.time)), e = new Date(s.getTime() + 2 * 3600e3);
  const f = (x) => `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}T${p(x.getUTCHours())}${p(x.getUTCMinutes())}00Z`;
  const c = (x) => String(x || "").replace(/[\;,]/g, (m) => "\\" + m).replace(/\n/g, " ");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Growth Gusto//Reservation//FR", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:${bid}@growthgusto.fr`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
    `SUMMARY:${c(`Table · ${r.name || "Restaurant"} (${b.covers} pers.)`)}`, ...(r.address ? [`LOCATION:${c(r.address)}`] : []), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
async function keyOf(rid, bid) {
  const ref = db().doc(`resaKeys/${rid}/keys/${bid}`); const s = await ref.get();
  if (s.exists && typeof s.get("k") === "string") return s.get("k");
  const k = crypto.randomBytes(16).toString("hex"); await ref.set({ k, at: Date.now() }); return k;
}
async function sendMail(kind, rid, bid, b, resto) {
  const email = String(b.email || "").trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const review = kind === "avis" ? googleUrl((resto.resaCfg || {}).googleReview) : ""; if (kind === "avis" && !review) return false;
  /* review requests never eat the last 50 e-mails of the day: confirmations and reminders keep room */
  if (!(await quota(1, kind === "avis" ? DAILY_CAP - 50 : DAILY_CAP))) { logger.warn("resa: Brevo daily cap reached"); return false; }
  const c = resto.resaCfg || {}, r = { name: resto.name || "Restaurant", address: c.address || "", phone: c.phone || "", logo: typeof resto.logo === "string" ? resto.logo : "" };
  const k = await keyOf(rid, bid), q = `?r=${encodeURIComponent(rid)}&b=${encodeURIComponent(bid)}&k=${k}`;
  const L = { manage: BASE + q, ics: BASE + q + "&ics=1", book: BASE + "?r=" + encodeURIComponent(rid), review, avis: kind === "avis" ? AVIS_BASE + q : "" };
  const K = KINDS[kind] || KINDS.confirme;
  const body = { sender: { name: String(r.name).slice(0, 60), email: SENDER_EMAIL }, to: [{ email, name: String(b.name || "").slice(0, 60) }], subject: K.s(r, b, longDay(b.date)), htmlContent: mailHtml(kind, b, r, L) };
  if (["confirme", "modifie", "rappel"].includes(kind)) body.attachment = [{ name: "reservation.ics", content: Buffer.from(icsOf(b, r, bid)).toString("base64") }];
  const res = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { logger.error("resa: Brevo", res.status, await res.text().catch(() => "")); return false; }
  await db().doc(`restos/${rid}/bookings/${bid}`).set({ mailLog: FV.arrayUnion({ k: kind, at: Date.now() }) }, { merge: true }).catch(() => {});
  return true;
}
/* which e-mail a change deserves (null = none) */
function mailKind(a, b) {
  if (!b) return null; const st = b.status;
  if (!a) return st === "avalider" ? "demande" : CONF.includes(st) ? "confirme" : null;
  if (b.resendAt && b.resendAt !== a.resendAt) return CONF.includes(st) ? "confirme" : st === "avalider" ? "demande" : null;
  if (a.status !== st) {
    if (CONF.includes(st)) return CONF.includes(a.status) ? null : "confirme";
    if (st === "avalider") return "demande";
    if (st === "refuse") return "refuse";
    if (st === "annule") return b.cancelledBy === "client" ? "annule_client" : [...CONF, "avalider", "attente"].includes(a.status) ? "annule" : null;
    return null;
  }
  if (CONF.includes(st) && (a.date !== b.date || a.time !== b.time || +a.covers !== +b.covers)) return "modifie";
  if (CONF.includes(st) && !a.email && b.email) return "confirme";
  return null;
}

const onResaBooking = onDocumentWritten({ document: "restos/{rid}/bookings/{bid}", region: REGION, secrets: [BREVO_KEY] }, async (ev) => {
  const { rid, bid } = ev.params; const a = ev.data.before.exists ? ev.data.before.data() : null, b = ev.data.after.exists ? ev.data.after.data() : null;
  if (!b) return;
  const rs = await db().doc(`restos/${rid}`).get(); if (!rs.exists) return; const resto = rs.data();
  if (!(resto.server && resto.server.resa)) await db().doc(`restos/${rid}`).set({ server: { resa: true } }, { merge: true });
  if (b.ext) return; /* a booking of another tool (Zenchef…, functions/src/resaimport.js): that tool e-mails its client, never us */
  const kind = mailKind(a, b); if (!kind) return;
  try { if (await sendMail(kind, rid, bid, b, resto)) logger.info("resa: mail", kind, rid, bid); } catch (e) { logger.error("resa: mail failed", e); }
});

/* ───────── the client's own page ───────── */
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const pubView = (b) => ({ date: b.date, time: b.time, covers: +b.covers || 0, name: b.name || "", status: b.status || "avenir", notes: b.notes || "", resaMsg: b.resaMsg || "", cancelledBy: b.cancelledBy || "" });
async function alertTeam(rid, bid, b, text) {
  const at = Date.now();
  await db().doc(`restos/${rid}/alerts/resa_c_${bid}_${at}`).set({ key: `resa_c_${bid}_${at}`, type: "resa", level: "warn", at, text, sub: `${b.name || "Client"} · ${b.covers} pers. · ${longDay(b.date)} ${b.time}`, day: b.date, seen: false, mailed: false, src: "serveur" }).catch(() => {});
}
const resaManage = onCall({ region: REGION, cors: true, maxInstances: 10 }, async (req) => {
  const d = req.data || {}; const rid = String(d.rid || ""), bid = String(d.bid || ""), k = String(d.k || ""), action = String(d.action || "get");
  if (!/^[\w-]{1,64}$/.test(rid) || !/^[\w-]{1,64}$/.test(bid) || !/^[a-f0-9]{32}$/.test(k)) throw new HttpsError("invalid-argument", "lien");
  const ks = await db().doc(`resaKeys/${rid}/keys/${bid}`).get();
  if (!ks.exists || !same(ks.get("k"), k)) throw new HttpsError("permission-denied", "lien");
  const bref = db().doc(`restos/${rid}/bookings/${bid}`), pref = db().doc(`restos/${rid}/public/resa`);
  if (action === "get") { const s = await bref.get(); if (!s.exists) throw new HttpsError("not-found", "absente"); return { b: pubView(s.data()) }; }
  if (action !== "cancel" && action !== "modify") throw new HttpsError("invalid-argument", "action");
  const out = await db().runTransaction(async (t) => {
    const [bs, ps] = await Promise.all([t.get(bref), t.get(pref)]); if (!bs.exists) throw new HttpsError("not-found", "absente");
    const b = bs.data(), p = ps.exists ? ps.data() : {}, c = p.cfg || {};
    if (!["avenir", "en ligne", "confirme", "avalider", "attente"].includes(b.status)) throw new HttpsError("failed-precondition", "statut");
    if (parisAt(b.date, b.time) < Date.now()) throw new HttpsError("failed-precondition", "passee");
    const counted = COUNTS.includes(b.status), oldB = bucket(c, b.date, b.time);
    if (action === "cancel") {
      t.update(bref, { status: "annule", cancelledBy: "client", cancelledAt: Date.now(), clientChange: { at: Date.now(), what: "annule" } });
      if (counted && ps.exists) t.update(pref, new FP("days", b.date, oldB), FV.increment(-(+b.covers || 0)));
      return { b: { ...b, status: "annule", cancelledBy: "client" }, text: "Réservation annulée par le client" };
    }
    const date = String(d.date || b.date), time = String(d.time || b.time), covers = Math.round(+d.covers || +b.covers);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new HttpsError("invalid-argument", "date");
    if (covers < 1 || covers > Math.max(+c.maxOnline || 8, +b.covers || 0)) throw new HttpsError("out-of-range", "couverts");
    const moved = date !== b.date || time !== b.time;
    if (moved) {
      if (date > addDays(paris().day, +c.horizon || 60)) throw new HttpsError("out-of-range", "date");
      if (!svcsOn(c, date).some((s) => slotsOf(c, s).includes(time))) throw new HttpsError("failed-precondition", "ferme");
      if (parisAt(date, time) < Date.now() + (+c.lead || 0) * 3600e3) throw new HttpsError("failed-precondition", "delai");
    }
    const newB = bucket(c, date, time), cur = +((p.days || {})[date] || {})[newB] || 0, mine = counted && newB === oldB && date === b.date ? +b.covers || 0 : 0;
    if (b.status !== "attente" && +c.maxPerSlot && cur - mine + covers > +c.maxPerSlot) throw new HttpsError("resource-exhausted", "complet");
    const status = b.status === "attente" ? "attente" : c.validate && CONF.includes(b.status) ? "avalider" : b.status;
    t.update(bref, { date, time, covers, status, at: parisAt(date, time), clientChange: { at: Date.now(), what: "modifie" } });
    if (counted && ps.exists) {
      if (newB === oldB && date === b.date) t.update(pref, new FP("days", date, newB), FV.increment(covers - (+b.covers || 0)));
      else t.update(pref, new FP("days", b.date, oldB), FV.increment(-(+b.covers || 0)), new FP("days", date, newB), FV.increment(covers));
    }
    return { b: { ...b, date, time, covers, status }, text: "Réservation modifiée par le client" };
  });
  await alertTeam(rid, bid, out.b, out.text);
  return { ok: true, b: pubView(out.b) };
});

/* ───────── « Votre dîner s'est bien passé ? » ─────────
   Who: bookings marked « Arrivé » (one tap in the list, or the table opened in Salle), with an e-mail, not imported from another tool
   (b.ext: Zenchef & co. send their own), once per booking (reviewAskAt) and at most once every 120 days per e-mail address.
   When (resaCfg.reviewWhen): "soir" (default) 2 h 30 after the table time, moved to 10:00 the next morning when that falls between
   22:30 and 9:00; "lendemain" the next day at 11:00. Never more than 36 h late (switching it on does not mail last month's guests).
   Needs resaCfg.googleReview (a valid Google link) and resaCfg.reviewAsk !== false. */
function reviewDue(b, c) {
  const base = parisAt(b.date, b.time || "20:00");
  if (c.reviewWhen === "lendemain") return parisAt(addDays(b.date, 1), "11:00");
  const t = base + 150 * 60e3, p = paris(t);
  if (p.min >= 22 * 60 + 30) return parisAt(addDays(p.day, 1), "10:00");
  if (p.min < 9 * 60) return parisAt(p.day, "10:00");
  return t;
}
const REVIEW_GAP = 120 * 864e5;
/* one review request per client and restaurant every 120 days, whatever brought it (booking, QR order, bill paid at the table):
   reviewSent/{rid}_{sha(e-mail)} { at }. Returns false when this client was asked less than 120 days ago, else books the slot. */
async function gapOk(rid, email, now = Date.now()) {
  const h = crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex").slice(0, 32);
  const ref = db().doc(`reviewSent/${rid}_${h}`);
  return db().runTransaction(async (t) => { const s = await t.get(ref); if (s.exists && +s.get("at") > now - REVIEW_GAP) return false; t.set(ref, { at: now }); return true; });
}
async function reviewTick(rid, resto, now = Date.now()) {
  const c = resto.resaCfg || {}; if (c.reviewAsk === false || !googleUrl(c.googleReview)) return 0;
  const today = paris(now).day, days = [addDays(today, -2), addDays(today, -1), today];
  const snap = await db().collection(`restos/${rid}/bookings`).where("date", "in", days).get();
  let n = 0;
  for (const s of snap.docs) {
    const b = s.data();
    if (b.ext || b.status !== "arrive" || !b.email || b.reviewAskAt) continue;
    const due = reviewDue(b, c); if (now < due || now > due + 36 * 3600e3) continue;
    const email = String(b.email).trim().toLowerCase();
    const prev = await db().collection(`restos/${rid}/bookings`).where("email", "==", b.email).get().catch(() => null);
    if (prev && prev.docs.some((d) => d.id !== s.id && +d.get("reviewAskAt") > now - REVIEW_GAP && String(d.get("email") || "").trim().toLowerCase() === email)) { await s.ref.set({ reviewAskAt: -1 }, { merge: true }); continue; }
    if (!(await gapOk(rid, email, now))) { await s.ref.set({ reviewAskAt: -1 }, { merge: true }); continue; }
    await s.ref.set({ reviewAskAt: now }, { merge: true });
    try { if (await sendMail("avis", rid, s.id, b, resto)) n++; } catch (e) { logger.error("resa: review", e); }
  }
  return n;
}

/* ───────── « Merci de votre visite ! » after an online payment ─────────
   Who: whoever paid online through Growth Gusto (QR order paid at once, the bill or a share paid from the table's QR). Stripe Checkout
   always asks their e-mail for the receipt; functions/src/commande.js queues payReviews/{rid}_{o|p}_{id} with the time it is due
   (bill: 1 h after paying; QR order at the table: 2 h; takeaway: 1 h 30), moved to 10:00 when that falls between 22:30 and 9:00.
   Same switches as the booking e-mail (resaCfg.reviewAsk, a Google link) plus resaCfg.reviewPay !== false, the same 120-day rule
   (gapOk, shared with the bookings), and never the last 50 e-mails of the day. Several people sharing a bill each get their own. */
function payDue(p) {
  const t = +p.due || +p.paidAt || Date.now(), x = paris(t);
  if (x.min >= 22 * 60 + 30) return parisAt(addDays(x.day, 1), "10:00");
  if (x.min < 9 * 60) return parisAt(x.day, "10:00");
  return t;
}
async function avisKey(rid, kind, id) {
  const ref = db().doc(`avisKeys/${rid}_${kind}_${id}`); const s = await ref.get();
  if (s.exists && typeof s.get("k") === "string") return s.get("k");
  const k = crypto.randomBytes(16).toString("hex"); await ref.set({ k, rid, at: Date.now() }); return k;
}
/* the e-mail itself (also the test sent from the settings, test=true: no key, no queue) */
async function sendPayMail(p, resto, test) {
  const email = String(p.email || "").trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const c = resto.resaCfg || {}, review = googleUrl(c.googleReview); if (!review && !test) return false;
  if (!(await quota(1, DAILY_CAP - 50))) { logger.warn("resa: Brevo daily cap reached (pay review)"); return false; }
  const r = { name: resto.name || "Restaurant", address: c.address || "", phone: c.phone || "", logo: typeof resto.logo === "string" ? resto.logo : "" };
  const q = test ? "" : `?r=${encodeURIComponent(p.rid)}&${p.kind === "p" ? "p" : "o"}=${encodeURIComponent(p.id)}&k=${await avisKey(p.rid, p.kind, p.id)}`;
  const L = { review: review || "https://www.google.com/maps", avis: test ? "" : AVIS_BASE + q, book: c.slug || resto.server && resto.server.resa ? BASE + "?r=" + encodeURIComponent(p.rid) : "" };
  const b = { name: p.name || "", mode: p.mode || "table", time: paris(+p.paidAt || Date.now()).min < 16 * 60 ? "12:30" : "20:00", covers: 1 };
  const body = { sender: { name: String(r.name).slice(0, 60), email: SENDER_EMAIL }, to: [{ email, ...(p.name ? { name: String(p.name).slice(0, 60) } : {}) }],
    subject: (test ? "[Test] " : "") + KINDS.paye.s(r), htmlContent: mailHtml("paye", b, r, L), tags: ["gg-avis-paiement"] };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { logger.error("resa: Brevo (pay review)", res.status, await res.text().catch(() => "")); return false; }
  return true;
}
async function payReviewTick(now = Date.now()) {
  const q = await db().collection("payReviews").where("due", "<=", now).limit(80).get().catch((e) => { logger.warn("resa: payReviews", e.message); return null; });
  let n = 0; const restos = {};
  if (q && !q.empty) for (const d of q.docs) {
    const p = d.data(); const due = payDue(p);
    if (due > now) { if (due !== +p.due) await d.ref.set({ due }, { merge: true }).catch(() => {}); continue; }
    await d.ref.delete().catch(() => {}); /* at most once, whatever happens next */
    if (now - due > 36 * 3600e3 || !/^[\w-]{1,64}$/.test(String(p.rid || ""))) continue;
    if (!(p.rid in restos)) restos[p.rid] = await db().doc(`restos/${p.rid}`).get().then((s) => (s.exists ? s.data() : null)).catch(() => null);
    const resto = restos[p.rid]; if (!resto) continue;
    const c = resto.resaCfg || {}; if (c.reviewAsk === false || c.reviewPay === false || !googleUrl(c.googleReview)) continue;
    if (!(await gapOk(p.rid, p.email, now))) continue;
    try {
      if (await sendPayMail(p, resto)) {
        n++; const col = p.kind === "p" ? "billPays" : "clientOrders";
        await db().doc(`restos/${p.rid}/${col}/${p.id}`).set({ reviewAskAt: now }, { merge: true }).catch(() => {});
      }
    } catch (e) { logger.error("resa: pay review", e); }
  }
  /* the review links of these e-mails live 30 days */
  const old = await db().collection("avisKeys").where("at", "<", now - 30 * 864e5).limit(200).get().catch(() => null);
  if (old && !old.empty) { const b = db().batch(); old.docs.forEach((x) => b.delete(x.ref)); await b.commit().catch(() => {}); }
  return n;
}
/* « Recevoir un e-mail de test » (Réservations › Réglages › Avis): the review e-mail, sent to the address the manager typed.
   { rid, kind: "paye"|"avis", to? } → { ok, to }. Members only, five a day per person (the address is free: the manager may test on
   another mailbox). */
const resaAvisTest = onCall({ region: REGION, cors: true, secrets: [BREVO_KEY], maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "auth");
  const d = req.data || {}, rid = String(d.rid || ""); if (!/^[\w-]{1,64}$/.test(rid)) throw new HttpsError("invalid-argument", "rid");
  const t = req.auth.token || {}, mine = String(t.email || "").trim().toLowerCase();
  const adm = mine === "marceau.ruis@gmail.com" && (t.email_verified === true || (t.firebase && t.firebase.sign_in_provider === "google.com"));
  const m = await db().doc(`restos/${rid}/members/${req.auth.uid}`).get(); if (!m.exists && !adm) throw new HttpsError("permission-denied", "membre");
  /* the address typed under « Recevoir un e-mail de test » (the account's own address by default) */
  const to = String(d.to || mine).trim().toLowerCase().slice(0, 120); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpsError("invalid-argument", "email");
  const day = paris().day, cref = db().doc(`avisTests/${req.auth.uid}`);
  const ok = await db().runTransaction(async (tx) => { const s = await tx.get(cref); const n = s.exists && s.get("day") === day ? +s.get("n") || 0 : 0; if (n >= 5) return false; tx.set(cref, { day, n: n + 1 }); return true; });
  if (!ok) throw new HttpsError("resource-exhausted", "trop");
  const rs = await db().doc(`restos/${rid}`).get(); const resto = rs.exists ? rs.data() : { name: "Votre restaurant" };
  const first = String(t.name || "").trim().split(/\s+/)[0] || "";
  let sent;
  if (String(d.kind) === "avis") {
    const c = resto.resaCfg || {}, r = { name: resto.name || "Restaurant", address: c.address || "", phone: c.phone || "", logo: typeof resto.logo === "string" ? resto.logo : "" };
    const b = { name: first, date: paris().day, time: "20:00", covers: 2 };
    if (!(await quota(1))) throw new HttpsError("unavailable", "quota");
    const res = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: String(r.name).slice(0, 60), email: SENDER_EMAIL }, to: [{ email: to }], subject: "[Test] " + KINDS.avis.s(r, b), htmlContent: mailHtml("avis", b, r, { review: googleUrl(c.googleReview) || "https://www.google.com/maps", avis: "", book: "" }) }) });
    sent = res.ok; if (!res.ok) logger.error("resa: Brevo (test)", res.status, await res.text().catch(() => ""));
  } else sent = await sendPayMail({ rid, kind: "o", id: "test", email: to, name: first, mode: "table", paidAt: Date.now() }, resto, true);
  if (!sent) throw new HttpsError("unavailable", "brevo");
  logger.info("resa: test review e-mail", rid, d.kind || "paye");
  return { ok: true, to };
});

/* ───────── the « à demain » reminder, from the lead's 15-min job ───────── */
async function resaTick() {
  try { await payReviewTick(); } catch (e) { logger.error("resa: pay reviews", e); }
  const now = paris();
  const tomorrow = addDays(now.day, 1);
  const restos = await db().collection("restos").where("server.resa", "==", true).get();
  for (const r of restos.docs) {
    const resto = r.data();
    try { await reviewTick(r.id, resto); } catch (e) { logger.error("resa: reviews", r.id, e); }
    if (now.min < 10 * 60) continue; /* the reminder: from 10:00 the day before */
    if (resto.resaCfg && resto.resaCfg.reminder === false) continue;
    const snap = await db().collection(`restos/${r.id}/bookings`).where("date", "==", tomorrow).get();
    for (const s of snap.docs) {
      const b = s.data();
      if (b.ext || !CONF.includes(b.status) || !b.email || b.remindedAt || (+b.createdAt || 0) > Date.now() - 12 * 3600e3) continue;
      await s.ref.set({ remindedAt: Date.now() }, { merge: true });
      try { await sendMail("rappel", r.id, s.id, b, resto); } catch (e) { logger.error("resa: reminder", e); }
    }
  }
}

module.exports = { onResaBooking, resaManage, resaAvisTest, resaTick, BREVO_KEY, _payDue: payDue, _mailKind: mailKind, _bucket: bucket, _parisAt: parisAt, _reviewDue: reviewDue, _googleUrl: googleUrl, _mailHtml: mailHtml };
/* « Comment nous avez-vous trouvés ? » (avis/ page): its callable rides on this module, which every install loads */
Object.assign(module.exports, require("./avisclient"));
