/* node tools/rz.test.js — the booking e-mail reader (js/rzparse.js, same file as functions/src/rzparse.js) */
const fs = require("fs"), path = require("path"), assert = require("assert");
const A = path.join(__dirname, "../js/rzparse.js"), B = path.join(__dirname, "../functions/src/rzparse.js");
if (fs.existsSync(B)) assert.strictEqual(fs.readFileSync(A, "utf8"), fs.readFileSync(B, "utf8"), "js/rzparse.js and functions/src/rzparse.js must be identical");
const { rzParse } = require(A);
const sent = "Fri, 6 Nov 2026 10:12:00 +0100";
const cases = [
  ["Zenchef, label lines", { from: "Zenchef <no-reply@zenchef.com>", subject: "Nouvelle réservation - Jean Dupont", sentAt: sent,
    text: "Bonjour,\nVous avez une nouvelle réservation.\nNom : M. Jean Dupont\nDate : samedi 14 novembre 2026\nHeure : 20h30\nNombre de personnes : 4\nTéléphone : +33 6 12 34 56 78\nEmail : jean.dupont@gmail.com\nCommentaire : Anniversaire, sans gluten\nRéférence : ZC-88231\n" },
    { ok: true, kind: "new", provider: "zenchef", date: "2026-11-14", time: "20:30", covers: 4, name: "Jean Dupont", phone: "+33 6 12 34 56 78", email: "jean.dupont@gmail.com", notes: "Anniversaire, sans gluten", ref: "ZC-88231" }],
  ["HTML table, label and value on two cells", { from: "reservations@zenchef.com", subject: "Réservation annulée", sentAt: sent,
    html: "<table><tr><td>Client</td><td>Marie Curie</td></tr><tr><td>Date</td><td>12/11/2026</td></tr><tr><td>Heure</td><td>12:15</td></tr><tr><td>Couverts</td><td>2</td></tr><tr><td>Téléphone</td><td>06 11 22 33 44</td></tr></table>" },
    { ok: true, kind: "cancel", date: "2026-11-12", time: "12:15", covers: 2, name: "Marie Curie", phone: "06 11 22 33 44" }],
  ["Sentence style, forwarded by Gmail", { from: "chef@resto.fr", subject: "Fwd: Réservation de Paul Martin pour 3 personnes", sentAt: sent,
    text: "---------- Forwarded message ---------\nDe : Zenchef <no-reply@zenchef.com>\nDate: ven. 6 nov. 2026 à 09:58\nObjet : Réservation de Paul Martin pour 3 personnes\n\nPaul Martin a réservé une table pour 3 personnes le jeudi 19 novembre à 19h45.\nTél. 07 88 99 00 11\n" },
    { ok: true, kind: "new", provider: "zenchef", date: "2026-11-19", time: "19:45", covers: 3, name: "Paul Martin", phone: "07 88 99 00 11" }],
  ["Modification, English", { from: "TheFork Manager <noreply@thefork.com>", subject: "Booking modified: Anna Smith", sentAt: sent,
    text: "Guest name: Anna Smith\nDate and time: November 21, 2026 at 7:30 pm\nParty size: 6\nPhone: +44 7700 900123\n" },
    { ok: true, kind: "modify", provider: "thefork", date: "2026-11-21", time: "19:30", covers: 6, name: "Anna Smith" }],
  ["Not a booking", { from: "forwarding-noreply@google.com", subject: "(#123456) Confirmation de transfert Gmail - Recevoir des e-mails de chef@resto.fr", sentAt: sent, text: "Pour autoriser, cliquez sur https://mail.google.com/mail/vf-abc" },
    { ok: false }],
];
let fail = 0;
for (const [t, mail, exp] of cases) {
  const r = rzParse(mail); const bad = Object.entries(exp).filter(([k, v]) => r[k] !== v);
  if (bad.length) { fail++; console.log("FAIL", t, bad.map(([k, v]) => `${k}: ${JSON.stringify(r[k])} ≠ ${JSON.stringify(v)}`).join(" · ")); } else console.log("ok  ", t);
}
if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("ALL OK");
