/* cd functions && node ../tools/rzserver.test.js — functions/src/resaimport.js apply() against an in-memory Firestore */
const path = require("path"), assert = require("assert");
const admin = require(path.join(process.cwd(), "node_modules/firebase-admin"));
const store = {}; let seq = 0;
const snap = (p) => ({ id: p.split("/").pop(), ref: docRef(p), exists: !!store[p], data: () => store[p] && { ...store[p] }, get: (k) => store[p] && store[p][k] });
const getIn = (o, k) => k.split(".").reduce((a, x) => (a == null ? a : a[x]), o);
function docRef(p) { return { id: p.split("/").pop(), path: p, get: async () => snap(p), set: async (d, o) => { store[p] = o && o.merge ? deep(store[p] || {}, d) : { ...d }; }, delete: async () => { delete store[p]; } }; }
function deep(a, b) { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" ? deep(o[k], v) : v; return o; }
function query(col, fs = []) {
  return { where: (k, op, v) => query(col, [...fs, [k, op, v]]), orderBy: () => query(col, fs), limit: () => query(col, fs), offset: () => query(col, fs),
    get: async () => { const docs = Object.keys(store).filter((p) => p.startsWith(col + "/") && p.split("/").length === col.split("/").length + 1).filter((p) => fs.every(([k, op, v]) => op === "==" ? getIn(store[p], k) === v : getIn(store[p], k) >= v)).map(snap); return { empty: !docs.length, docs }; },
    add: async (d) => { const p = `${col}/id${++seq}`; store[p] = { ...d }; return docRef(p); } };
}
const fake = { doc: docRef, collection: query, batch: () => ({ set: () => {}, delete: () => {}, commit: async () => {} }) };
const real = admin.firestore; Object.defineProperty(admin, "firestore", { configurable: true, value: Object.assign(() => fake, real) }); admin.apps.length || admin.initializeApp({ projectId: "demo" });
const { _apply: apply } = require(path.join(process.cwd(), "src/resaimport.js"));
const sent = "Fri, 6 Nov 2026 10:12:00 +0100", B = () => Object.entries(store).filter(([p]) => p.includes("/bookings/"));
(async () => {
  let L = await apply("r1", { from: "Zenchef <no-reply@zenchef.com>", subject: "Nouvelle réservation", sentAt: sent, text: "Nom : Jean Dupont\nDate : 14/11/2026\nHeure : 20:30\nCouverts : 4\nTéléphone : 06 12 34 56 78" });
  assert(L.ok && B().length === 1); let b = B()[0][1]; assert.strictEqual(b.source, "zenchef"); assert.strictEqual(b.status, "avenir"); assert(b.ext && b.ext.p === "zenchef"); assert.strictEqual(b.covers, 4);
  L = await apply("r1", { from: "Zenchef <no-reply@zenchef.com>", subject: "Réservation modifiée", sentAt: sent, text: "Nom : Jean Dupont\nDate : 15/11/2026\nHeure : 21:00\nCouverts : 5\nTéléphone : 06 12 34 56 78" });
  assert(L.ok && B().length === 1, "modify updates"); b = B()[0][1]; assert.strictEqual(b.date, "2026-11-15"); assert.strictEqual(b.covers, 5);
  L = await apply("r1", { from: "Zenchef <no-reply@zenchef.com>", subject: "Réservation annulée", sentAt: sent, text: "Nom : Jean Dupont\nDate : 15/11/2026\nTéléphone : 06 12 34 56 78" });
  assert(L.ok, "cancel without time still found"); b = B()[0][1]; assert.strictEqual(b.status, "annule");
  L = await apply("r1", { from: "Zenchef <no-reply@zenchef.com>", subject: "Nouvelle réservation", sentAt: sent, text: "Nom : Jean Dupont\nDate : 14/11/2026\nHeure : 20:30\nCouverts : 4\nTéléphone : 06 12 34 56 78\nRéférence : ZC-1234" });
  assert(L.ok && B().length === 2, "a new booking on another day");
  L = await apply("r1", { from: "forwarding-noreply@google.com", subject: "Confirmation de transfert Gmail", text: "Cliquez https://mail-settings.google.com/mail/vf-xyz" });
  assert(!L.ok && L.why === "gmail" && L.links[0].includes("google.com"));
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
