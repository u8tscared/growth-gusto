/* Growth Gusto — account e-mails (js/auth.js). Firebase Functions, Node 22, region europe-west9. Few e-mails on purpose:
     1. the 6-digit code that validates an e-mail/password account   (mailSendCode / mailVerifyCode, HTTPS callables)
     2. « Bienvenue » once per account                                  (mailOnUserCreated, v1 auth trigger: free, no scheduler)
     3. « Plus que 3 jours d'essai » and 4. « Dernier jour d'essai »    (mailsTick, called by the lead's single 15-min job)
   Welcome: a Google account (or one already verified) gets it as soon as it is created; an e-mail/password account gets it right
   after its code is validated (so the code mail is never buried under it), or 24 h later from mailsTick if it never validated.
   Server-only top-level collections (default-deny in firestore.rules, the Admin SDK bypasses rules):
     _codes/{uid}  { hash, salt, exp, tries, sends: [ms] }   the current code, hashed (sha256 of salt + code), 10 min, 5 tries, 5 sends / hour
     _mails/{uid}  { welcome: ms, welcomePending: ms }        one welcome per account
     _mails/r_{rid} { j3: ms, last: ms }                      trial reminders, once per restaurant and per kind
   E-mail: Brevo transactional API, secret BREVO_KEY, sender bonjour@growthgusto.fr « Growth Gusto », same shared daily counter
   _meta/brevo (stop at 290 a day) as functions/src/alertes.js and functions/src/resa.js. When the cap is reached the code call
   answers « unavailable » and the app falls back to Firebase's own verification link: nobody is ever blocked. */
"use strict";
const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const functionsV1 = require("firebase-functions/v1");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const BREVO_KEY = defineSecret("BREVO_KEY");
const REGION = "europe-west9";
const SENDER = { name: "Growth Gusto", email: "bonjour@growthgusto.fr" };
const REPLY_TO = { name: "Growth Gusto", email: "contact@growthgusto.fr" };
const APP = "https://app.growthgusto.fr/";
const DAILY_CAP = 290, TZ = "Europe/Paris", DAY = 864e5;
const CODE_TTL = 10 * 60e3, MAX_TRIES = 5, MAX_SENDS = 5, RESEND_GAP = 55e3;

/* ───────── time ───────── */
const parisDay = (ts = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
const parisHour = (ts = Date.now()) => +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(ts)) % 24;
const longDate = (ts) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(ts));

/* ───────── Brevo (daily cap shared with alertes.js and resa.js: same document, same transaction) ───────── */
async function quota(n) {
  const ref = db().doc("_meta/brevo"), day = parisDay();
  return db().runTransaction(async (t) => { const s = await t.get(ref); const d = s.exists ? s.data() : {}; const used = d.day === day ? d.n || 0 : 0; if (used + n > DAILY_CAP) return false; t.set(ref, { day, n: used + n }); return true; });
}
async function send(to, m) {
  if (!to || !to.email) return false;
  if (!(await quota(1))) { logger.warn("mails: Brevo daily cap reached"); return false; }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: SENDER, replyTo: REPLY_TO, to: [to.name ? { email: to.email, name: to.name } : { email: to.email }], subject: m.subject, htmlContent: m.html, textContent: m.text, tags: [m.kind] }),
  });
  if (!r.ok) { logger.error("mails: Brevo", r.status, await r.text().catch(() => "")); return false; }
  return true;
}

/* ───────── templates (V2: cream paper, ink, one violet; real tables and inline styles for every mail client).
   Same output as auMailHTML() in js/auth.js (the admin preview): keep both in step. ───────── */
/* ── templates: start (copied verbatim into js/auth.js auMailHTML) ── */
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const F = "'Instrument Sans','Helvetica Neue',Helvetica,Arial,sans-serif", FD = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif", FM = "'JetBrains Mono',Menlo,Consolas,monospace";
function shell({ title, pre, hero, body, cta, href, foot }) {
  const btn = cta ? `<tr><td style="padding:6px 26px 28px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:14px;background:#5B2BFF;border-bottom:4px solid #2A0BA6"><a href="${esc(href || APP)}" style="display:inline-block;padding:15px 26px;font-family:${F};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:14px">${esc(cta)}&nbsp;&nbsp;&rarr;</a></td></tr></table></td></tr>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@500;600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#FBF6EC;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#FBF6EC">${esc(pre)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF6EC"><tr><td align="center" style="padding:28px 14px 36px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px">
<tr><td style="padding:0 6px 18px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;background:#5B2BFF;border-radius:10px;border-bottom:3px solid #2A0BA6;font-family:${FD};font-size:19px;font-weight:800;line-height:34px;color:#FFFFFF">G</td>
<td style="padding-left:10px;font-family:${FD};font-size:20px;font-weight:800;letter-spacing:-.5px;color:#1B1530">Growth <span style="color:#5B2BFF">Gusto</span></td></tr></table></td></tr>
<tr><td style="background:#FFFDF8;border:1.5px solid #E9DFCD;border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${hero || ""}${body}${btn}</table></td></tr>
<tr><td style="padding:16px 8px 0;font-family:${F};font-size:12.5px;line-height:19px;color:#6E6880">${foot}</td></tr>
<tr><td style="padding:10px 8px 0;font-family:${F};font-size:12px;line-height:18px;color:#9A93A8">Growth Gusto · le cahier HACCP qui se remplit tout seul · <a href="${APP}" style="color:#6E6880">app.growthgusto.fr</a></td></tr>
</table></td></tr></table></body></html>`.replace(/(>[^<]*)\be-mail/g, (m, a) => a + "e&#8209;mail"); /* « e-mail » never breaks at its hyphen */
}
const P = (t, pad = "0 26px 16px") => `<tr><td style="padding:${pad};font-family:${F};font-size:15.5px;line-height:23px;color:#4A4560">${t}</td></tr>`;
const H = (t, pad = "26px 26px 8px") => `<tr><td style="padding:${pad};font-family:${FD};font-size:28px;line-height:31px;font-weight:800;letter-spacing:-.8px;color:#1B1530">${t}</td></tr>`;
/* coloured band at the top of the card (solid: no gradient survives Outlook) */
const band = (bg, edge, eyebrow, eyeCol, big, bigCol, sub, subCol) => `<tr><td style="background:${bg};border-bottom:1.5px solid ${edge};padding:26px 26px 24px">
<div style="font-family:${F};font-size:13px;font-weight:700;color:${eyeCol}">${eyebrow}</div>
<div style="font-family:${FD};font-size:32px;line-height:35px;font-weight:800;letter-spacing:-1px;color:${bigCol};padding-top:6px">${big}</div>
${sub ? `<div style="font-family:${F};font-size:15px;line-height:22px;color:${subCol};padding-top:8px">${sub}</div>` : ""}</td></tr>`;
const step = (n, bg, fg, t, s) => `<tr><td style="padding:0 26px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF;border:1.5px solid #E9DFCD;border-radius:16px"><tr>
<td width="58" valign="top" style="padding:14px 0 14px 14px"><div style="width:36px;height:36px;border-radius:18px;background:${bg};color:${fg};font-family:${FD};font-size:17px;font-weight:800;line-height:36px;text-align:center">${n}</div></td>
<td style="padding:13px 14px 13px 4px;font-family:${F}"><div style="font-size:15.5px;font-weight:700;color:#1B1530">${t}</div><div style="font-size:13.5px;line-height:19px;color:#615B74;padding-top:2px">${s}</div></td></tr></table></td></tr>`;

/* kind: "code" | "welcome" | "invite" | "trial3" | "last" | "ended" · d: { name, code, resto, ends, pack, from, roleT, link } */
function mailHTML(kind, d = {}) {
  const me = firstName(d.name), resto = esc(d.resto || "votre restaurant"), packT = d.pack === "essentiel" ? "Commis" : d.pack === "pro" ? "Second" : "Chef";
  if (kind === "code") {
    const c = String(d.code || "000000").replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
    const box = (x) => `<td width="15%" align="center" style="padding:0 3px"><div style="background:#FFFFFF;border:1.5px solid #DCCFB8;border-bottom:4px solid #E2D6C2;border-radius:14px;font-family:${FM};font-size:30px;font-weight:700;line-height:58px;height:58px;color:#1B1530;text-align:center">${x}</div></td>`;
    const cells = c.slice(0, 3).split("").map(box).join("") + `<td width="10%" align="center" style="font-family:${F};font-size:22px;font-weight:700;color:#CDBEA4">&ndash;</td>` + c.slice(3).split("").map(box).join("");
    return {
      subject: `${c} est votre code Growth Gusto`, kind,
      text: `Votre code Growth Gusto : ${c}\n\nTapez-le dans l'app pour valider votre adresse. Il expire dans 10 minutes.\n\nVous n'avez rien demandé ? Ignorez cet e-mail.`,
      html: shell({ title: "Votre code", pre: `${c} · valable 10 minutes`,
        body: H(me ? `${esc(me)}, voici votre code.` : "Voici votre code.") + P("Tapez-le dans Growth Gusto pour valider votre adresse e-mail.", "0 26px 22px")
          + `<tr><td style="padding:0 20px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:420px"><tr>${cells}</tr></table></td></tr>`
          + `<tr><td style="padding:0 26px 28px"><span style="display:inline-block;background:#FFF3D6;color:#7A5A1A;border-radius:999px;padding:7px 13px;font-family:${F};font-size:13px;font-weight:700">Valable 10 minutes</span></td></tr>`,
        foot: "Vous n'avez rien demandé ? Ignorez cet e-mail : sans ce code, personne ne peut valider l'adresse." }),
    };
  }
  if (kind === "welcome") {
    return {
      subject: me ? `Bienvenue sur Growth Gusto, ${me}` : "Bienvenue sur Growth Gusto", kind,
      text: `Bienvenue${me ? ", " + me : ""} !\n\nVotre compte Growth Gusto est créé. Trois premiers pas :\n1. Ajoutez vos frigos : le relevé prend 30 secondes.\n2. Imprimez une étiquette : la DLC se calcule toute seule.\n3. Invitez votre équipe : un lien, chacun son compte.\n\nOuvrir Growth Gusto : ${APP}\n\nUne question ? Répondez simplement à cet e-mail.`,
      html: shell({ title: "Bienvenue", pre: "Votre compte est créé. Trois pas, et votre cahier HACCP se remplit tout seul.",
        hero: band("#5B2BFF", "#2A0BA6", "Votre compte est créé", "#D9D0FF", me ? `Bienvenue, ${esc(me)}.` : "Bienvenue en cuisine.", "#FFFFFF", "Votre cahier HACCP va se remplir tout seul.", "#EFE9FF"),
        body: `<tr><td style="padding:22px 26px 12px;font-family:${F};font-size:13px;font-weight:700;color:#3A10D8">Trois premiers pas</td></tr>`
          + step(1, "#EFE9FF", "#3A10D8", "Ajoutez vos frigos", "Le relevé du matin prend 30 secondes.")
          + step(2, "#FFF3D6", "#7A5A1A", "Imprimez une étiquette", "La DLC se calcule, la traçabilité suit.")
          + step(3, "#E6F0FF", "#2F5FBF", "Invitez votre équipe", "Un lien, et chacun a son compte.")
          + `<tr><td style="height:12px;line-height:12px;font-size:0">&nbsp;</td></tr>`,
        cta: "Ouvrir Growth Gusto", href: APP,
        foot: "14 jours d'essai, sans carte bancaire. Une question ? Répondez simplement à cet e-mail, on lit tout." }),
    };
  }
  if (kind === "trial3") {
    const ends = d.ends ? longDate(d.ends) : "dans 3 jours";
    return {
      subject: `Plus que 3 jours d'essai · ${d.resto || "Growth Gusto"}`, kind,
      text: `Votre essai de Growth Gusto (${d.resto || "votre restaurant"}) se termine ${ends}.\nChoisissez votre formule pour continuer sans interruption : Commis 59 €, Second 109 € ou Chef 169 € HT / mois.\n${APP}?go=abonnement\n\nRien n'est effacé à la fin de l'essai.`,
      html: shell({ title: "Plus que 3 jours", pre: `Votre essai se termine ${ends}. Vos données restent à vous.`,
        hero: band("#FFF3D6", "#F1D9A0", resto, "#7A5A1A", `Plus que <span style="color:#C88A12">3&nbsp;jours</span> d'essai.`, "#1B1530", `Il se termine ${esc(ends)}.`, "#7A5A1A"),
        body: P(`${me ? esc(me) + ", c" : "C"}hoisissez votre formule pour que vos relevés, étiquettes et votre registre continuent sans interruption.`, "22px 26px 16px")
          + `<tr><td style="padding:0 22px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="33%" style="padding:0 4px"><div style="background:#FFFFFF;border:1.5px solid ${(d.pack === "essentiel") ? "#5B2BFF" : "#E9DFCD"};border-radius:16px;padding:14px"><div style="font-family:${F};font-size:13px;font-weight:700;color:#615B74">Commis</div><div style="font-family:${FD};font-size:20px;font-weight:800;letter-spacing:-.5px;color:#1B1530;padding-top:2px">59&nbsp;€&nbsp;<span style="font-family:${F};font-size:12.5px;font-weight:600;color:#6E6880">HT/mois</span></div></div></td>
<td width="33%" style="padding:0 4px"><div style="background:#FFFFFF;border:1.5px solid ${(d.pack === "pro") ? "#5B2BFF" : "#E9DFCD"};border-radius:16px;padding:14px"><div style="font-family:${F};font-size:13px;font-weight:700;color:#615B74">Second</div><div style="font-family:${FD};font-size:20px;font-weight:800;letter-spacing:-.5px;color:#1B1530;padding-top:2px">109&nbsp;€&nbsp;<span style="font-family:${F};font-size:12.5px;font-weight:600;color:#6E6880">HT/mois</span></div></div></td>
<td width="33%" style="padding:0 4px"><div style="background:#FFFFFF;border:1.5px solid ${(d.pack !== "essentiel" && d.pack !== "pro") ? "#5B2BFF" : "#E9DFCD"};border-radius:16px;padding:14px"><div style="font-family:${F};font-size:13px;font-weight:700;color:#615B74">Chef</div><div style="font-family:${FD};font-size:20px;font-weight:800;letter-spacing:-.5px;color:#1B1530;padding-top:2px">169&nbsp;€&nbsp;<span style="font-family:${F};font-size:12.5px;font-weight:600;color:#6E6880">HT/mois</span></div></div></td>
</tr></table></td></tr>`,
        cta: "Choisir ma formule", href: APP + "?go=abonnement",
        foot: `Vous essayez le pack ${packT}. Rien n'est effacé à la fin de l'essai : vos données restent à vous.` }),
    };
  }
  if (kind === "invite") {
    const from = firstName(d.from), raw = String(d.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8), code = raw.slice(0, 4) + "-" + raw.slice(4);
    const link = d.link || APP + "?invite=" + raw, roleT = esc(d.roleT || "Équipe");
    return {
      subject: `${from ? from + " vous invite" : "Vous êtes invité"} à rejoindre ${d.resto || "l'équipe"} sur Growth Gusto`, kind,
      text: `Bonjour${me ? " " + me : ""},\n\n${from || "Votre gérant"} vous invite à rejoindre ${d.resto || "l'équipe"} sur Growth Gusto (${d.roleT || "Équipe"}).\n\nOuvrez ce lien sur votre téléphone : ${link}\nOu tapez le code ${code} dans l'app (${APP}).\n\nL'invitation est valable 7 jours.`,
      html: shell({ title: "Invitation", pre: `Code ${code} · valable 7 jours`,
        hero: band("#5B2BFF", "#2A0BA6", resto, "#D9D0FF", me ? `${esc(me)}, on vous attend.` : "On vous attend en cuisine.", "#FFFFFF", `${from ? esc(from) + " vous invite" : "Vous êtes invité"} à rejoindre l'équipe sur Growth Gusto.`, "#EFE9FF"),
        body: `<tr><td style="padding:22px 26px 6px"><span style="display:inline-block;background:#EFE9FF;color:#3A10D8;border-radius:999px;padding:7px 13px;font-family:${F};font-size:13px;font-weight:700">${roleT}</span></td></tr>`
          + P("Touchez le bouton sur votre téléphone : vous créez votre compte (Google ou e-mail) et vous arrivez directement dans l'équipe.", "12px 26px 6px"),
        cta: "Rejoindre l'équipe", href: link,
        foot: `Ou tapez le code <b style="font-family:${FM};color:#1B1530">${code}</b> dans Growth Gusto. L'invitation est valable 7 jours. Vous ne connaissez pas ${d.resto ? esc(d.resto) : "ce restaurant"} ? Ignorez cet e-mail.` }),
    };
  }
  /* last day (still a few hours) or already over (the tick missed the last day) */
  const over = kind === "ended", at = d.ends ? new Date(d.ends) : null;
  const hm = at ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(at).replace(":", " h ").replace(/ h 00$/, " h") : "";
  const when = at ? `${parisDay(+at) === parisDay() ? "aujourd'hui" : "demain"} à ${hm}` : "bientôt";
  return {
    subject: over ? `Votre essai est terminé · ${d.resto || "Growth Gusto"}` : `Dernier jour d'essai · ${d.resto || "Growth Gusto"}`, kind,
    text: `${over ? "Votre essai de Growth Gusto est terminé." : "C'est le dernier jour de votre essai de Growth Gusto."}\nL'app reste consultable, mais n'enregistre plus rien sans abonnement. Activez-le en une minute : ${APP}?go=abonnement\n\nRien n'est effacé.`,
    html: shell({ title: over ? "Essai terminé" : "Dernier jour", pre: over ? "Activez votre abonnement pour reprendre là où vous en étiez." : "Activez votre abonnement pour continuer demain sans coupure.",
      hero: band("#FFE9DE", "#F6C9B8", resto, "#C8432A", over ? "Votre essai est terminé." : "Dernier jour d'essai.", "#1B1530", over ? "Tout est gardé, rien n'est effacé." : `L'essai s'arrête ${when}.`, "#C8432A"),
      body: P(over ? `${me ? esc(me) + ", v" : "V"}os relevés et étiquettes restent consultables. Pour en enregistrer de nouveaux, activez votre abonnement : une minute suffit.` : "Ensuite, l'app reste consultable mais n'enregistre plus rien. Activez votre abonnement pour continuer sans coupure.", "22px 26px 18px"),
      cta: "Activer mon abonnement", href: APP + "?go=abonnement",
      foot: `Pack ${packT} : ${d.pack === "essentiel" ? "59" : d.pack === "pro" ? "109" : "169"} € HT par mois, sans engagement. Une question ? Répondez à cet e&#8209;mail.` }),
  };
}

/* ── templates: end ── */

/* ───────── helpers ───────── */
const hash = (salt, code) => crypto.createHash("sha256").update(salt + ":" + code).digest("hex");
const isGoogle = (u) => (u.providerData || []).some((p) => p.providerId === "google.com");
async function welcome(uid, user) {
  const ref = db().doc(`_mails/${uid}`);
  const go = await db().runTransaction(async (t) => { const s = await t.get(ref); if (s.exists && s.get("welcome")) return false; t.set(ref, { welcome: Date.now(), welcomePending: admin.firestore.FieldValue.delete() }, { merge: true }); return true; });
  if (!go) return false;
  const u = user || (await admin.auth().getUser(uid));
  if (!u.email) return false;
  const ok = await send({ email: u.email, name: u.displayName || "" }, mailHTML("welcome", { name: u.displayName || "" }));
  if (!ok) await ref.set({ welcome: admin.firestore.FieldValue.delete(), welcomePending: Date.now() - DAY + 3600e3 }, { merge: true }); /* retry from the tick in about an hour */
  return ok;
}
function authed(req) { if (!req.auth || !req.auth.uid) throw new HttpsError("unauthenticated", "Connexion requise."); return req.auth.uid; }

/* ───────── callables ───────── */
/* sends a new 6-digit code (or says the account is already verified / a Google account). Errors: resource-exhausted (5 per hour),
   unavailable (Brevo cap or failure: the app switches to the link). Returns { ok, sent, verified, wait, email } */
const mailSendCode = onCall({ region: REGION, secrets: [BREVO_KEY], cors: true }, async (req) => {
  const uid = authed(req); const u = await admin.auth().getUser(uid);
  if (u.emailVerified || isGoogle(u) || !u.email) return { ok: true, verified: true };
  const ref = db().doc(`_codes/${uid}`), now = Date.now(), force = !!(req.data && req.data.force);
  const s = await ref.get(); const d = s.exists ? s.data() : {};
  const sends = (d.sends || []).filter((t) => now - t < 3600e3);
  /* a code still fresh: reuse it unless the person asked « Renvoyer » (then at most one every minute) */
  if (d.exp > now + 60e3 && sends.length && (!force || now - sends[sends.length - 1] < RESEND_GAP)) return { ok: true, sent: false, wait: Math.max(0, Math.ceil((RESEND_GAP - (now - sends[sends.length - 1])) / 1000)), email: u.email };
  if (sends.length >= MAX_SENDS) throw new HttpsError("resource-exhausted", "Trop de codes envoyés. Réessayez dans une heure.");
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0"), salt = crypto.randomBytes(12).toString("hex");
  await ref.set({ hash: hash(salt, code), salt, exp: now + CODE_TTL, tries: 0, sends: [...sends, now], email: u.email });
  const ok = await send({ email: u.email, name: u.displayName || "" }, mailHTML("code", { code, name: u.displayName || "" }));
  if (!ok) { await ref.set({ exp: 0 }, { merge: true }); throw new HttpsError("unavailable", "Envoi impossible pour l'instant."); }
  return { ok: true, sent: true, wait: Math.ceil(RESEND_GAP / 1000), email: u.email };
});
/* checks the code. Wrong: invalid-argument with details { left }. Expired or none: deadline-exceeded. 5 wrong tries: resource-exhausted
   (the code is burnt, ask for a new one). Right: the account becomes verified, the code is deleted, the welcome e-mail leaves. */
const mailVerifyCode = onCall({ region: REGION, secrets: [BREVO_KEY], cors: true }, async (req) => {
  const uid = authed(req); const code = String((req.data && req.data.code) || "").replace(/\D/g, "");
  if (code.length !== 6) throw new HttpsError("invalid-argument", "Code incomplet.", { left: null });
  const ref = db().doc(`_codes/${uid}`), now = Date.now();
  const res = await db().runTransaction(async (t) => {
    const s = await t.get(ref); if (!s.exists) return { err: "deadline-exceeded" };
    const d = s.data(); if (!d.exp || d.exp < now) return { err: "deadline-exceeded" };
    if ((d.tries || 0) >= MAX_TRIES) return { err: "resource-exhausted" };
    const a = Buffer.from(hash(d.salt, code), "hex"), b = Buffer.from(String(d.hash || ""), "hex");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) { t.delete(ref); return { ok: true }; }
    const tries = (d.tries || 0) + 1; t.update(ref, { tries, ...(tries >= MAX_TRIES ? { exp: 0 } : {}) });
    return { err: tries >= MAX_TRIES ? "resource-exhausted" : "invalid-argument", left: MAX_TRIES - tries };
  });
  if (res.err === "deadline-exceeded") throw new HttpsError("deadline-exceeded", "Code expiré. Demandez-en un nouveau.");
  if (res.err === "resource-exhausted") throw new HttpsError("resource-exhausted", "Trop d'essais. Demandez un nouveau code.");
  if (res.err) throw new HttpsError("invalid-argument", "Code incorrect.", { left: res.left });
  const u = await admin.auth().updateUser(uid, { emailVerified: true });
  try { await welcome(uid, u); } catch (e) { logger.error("mails: welcome after code", uid, e); }
  return { ok: true, verified: true };
});

/* ───────── v1 auth trigger: every new account (Google, e-mail). Free (no Cloud Scheduler). 1st gen functions do not exist in europe-west9 (Paris), so this one runs in europe-west1. ───────── */
const mailOnUserCreated = functionsV1.region("europe-west1").runWith({ secrets: [BREVO_KEY] }).auth.user().onCreate(async (u) => {
  if (!u.email) return;
  if (isGoogle(u) || u.emailVerified) { try { await welcome(u.uid, u); } catch (e) { logger.error("mails: welcome", u.uid, e); } return; }
  /* e-mail/password: wait for the code (mailVerifyCode sends it); mailsTick sends it anyway after 24 h */
  await db().doc(`_mails/${u.uid}`).set({ welcomePending: Date.now() }, { merge: true });
});

/* ───────── every 15 min, from the lead's single scheduled job (declare secrets: [BREVO_KEY] there) ───────── */
async function mailsTick() {
  const now = Date.now(), h = parisHour(now);
  /* 1. welcome still pending after 24 h (never validated the code): send it anyway, at a decent hour */
  if (h >= 8 && h < 21) {
    const pend = await db().collection("_mails").where("welcomePending", "<", now - DAY).limit(40).get();
    for (const s of pend.docs) { try { await welcome(s.id); } catch (e) { logger.error("mails: pending welcome", s.id, e); if (e && e.code === "auth/user-not-found") await s.ref.delete().catch(() => {}); } }
  }
  /* 2. trial reminders, between 9:00 and 19:00 Paris only */
  if (h < 9 || h >= 19) return;
  const restos = await db().collection("restos").where("plan", "==", "essai").get();
  for (const s of restos.docs) {
    const r = s.data(); if (r.demo || !r.owner) continue;
    const ends = +r.trialEnds || 0; if (!ends) continue;
    const left = ends - now;
    let kind = null;
    if (left > DAY && left <= 3 * DAY) kind = "j3";
    else if (left > 0 && left <= DAY) kind = "last";
    else if (left <= 0 && left > -3 * DAY) kind = "last"; /* the last day went by unseen (quiet hours, cap): say it is over, once */
    if (!kind) continue;
    const ref = db().doc(`_mails/r_${s.id}`);
    try {
      const claim = await db().runTransaction(async (t) => { const m = await t.get(ref); const d = m.exists ? m.data() : {}; if (d[kind] || (kind === "j3" && d.last)) return false; t.set(ref, { [kind]: now, rid: s.id }, { merge: true }); return true; });
      if (!claim) continue;
      let email = "", name = "";
      const us = await db().doc(`users/${r.owner}`).get(); if (us.exists) { email = us.get("email") || ""; name = us.get("name") || ""; }
      if (!email) { try { const u = await admin.auth().getUser(r.owner); email = u.email || ""; name = name || u.displayName || ""; } catch (e) {} }
      if (!email) continue;
      const ok = await send({ email, name }, mailHTML(kind === "j3" ? "trial3" : left > 0 ? "last" : "ended", { name, resto: r.name, ends, pack: r.pack }));
      if (!ok) await ref.set({ [kind]: admin.firestore.FieldValue.delete() }, { merge: true }); /* cap reached: try again on a later tick */
    } catch (e) { logger.error("mailsTick", s.id, e); }
  }
}


/* team invitation by e-mail: a gérant of the invite's restaurant sends invites/{code} to one address. 40 per restaurant and per day.
   Returns { ok, email }. Errors: permission-denied (not a gérant), not-found (invite gone/expired), invalid-argument (bad address),
   resource-exhausted (daily limit), unavailable (Brevo cap or failure: the app keeps the code and the link to share by hand). */
const ROLE_T = { gerant: "Gérant", chef: "Second", equipe: "Équipe" };
const POSTE_T = { cuisine: "Cuisine", salle: "Salle", plonge: "Plonge", bar: "Bar", second: "Second" };
const mailInvite = onCall({ region: REGION, secrets: [BREVO_KEY], cors: true }, async (req) => {
  const uid = authed(req); const data = req.data || {};
  const code = String(data.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const email = String(data.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpsError("invalid-argument", "Adresse e-mail invalide.");
  const iref = db().doc(`invites/${code}`); const is = await iref.get();
  if (code.length !== 8 || !is.exists) throw new HttpsError("not-found", "Invitation introuvable.");
  const inv = is.data(); const now = Date.now();
  if (inv.expiresAt && inv.expiresAt < now) throw new HttpsError("not-found", "Invitation expirée.");
  const [ms, rs] = await Promise.all([db().doc(`restos/${inv.rid}/members/${uid}`).get(), db().doc(`restos/${inv.rid}`).get()]);
  const isG = (ms.exists && ms.data().role === "gerant") || (rs.exists && rs.data().owner === uid);
  if (!isG) throw new HttpsError("permission-denied", "Seul un gérant peut inviter.");
  const cref = db().doc(`_mails/r_${inv.rid}`), day = parisDay();
  const okDay = await db().runTransaction(async (t) => { const c = await t.get(cref); const d = c.exists ? c.data() : {}; const n = d.invDay === day ? d.invN || 0 : 0; if (n >= 40) return false; t.set(cref, { invDay: day, invN: n + 1 }, { merge: true }); return true; });
  if (!okDay) throw new HttpsError("resource-exhausted", "Limite d'invitations par e-mail atteinte aujourd'hui.");
  const from = (ms.exists && ms.data().name) || inv.createdByName || "";
  const roleT = inv.role === "gerant" ? "Gérant · accès à tout" : POSTE_T[inv.poste] || ROLE_T[inv.role] || "Équipe";
  const ok = await send({ email, name: inv.name || "" }, mailHTML("invite", { name: inv.name || "", from, resto: inv.restoName || (rs.exists && rs.data().name) || "", code, roleT, link: APP + "?invite=" + code }));
  if (!ok) throw new HttpsError("unavailable", "Envoi impossible pour l'instant.");
  await iref.set({ email, mailedAt: now }, { merge: true });
  return { ok: true, email };
});

module.exports = { mailSendCode, mailVerifyCode, mailInvite, mailOnUserCreated, mailsTick, BREVO_KEY, _mailHTML: mailHTML };
