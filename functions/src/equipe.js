/* Growth Gusto — team notifications (js/consignes.js). Firebase Functions v2, Node 22, region europe-west9.
   equipeNotify({ rid, kind: "consigne"|"chat", id }): after someone publishes a consigne or a message, every other member of the
   restaurant who switched notifications on (restos/{rid}/push/{memberId}.tokens) gets a push through Firebase Cloud Messaging.
   Free: FCM costs nothing, and this runs once per message. Dead tokens are removed. */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const REGION = "europe-west9";
const KINDS = { plat: "Plat du jour", rupture: "Rupture", info: "Info" };
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "Quelqu'un";
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

const equipeNotify = onCall({ region: REGION, cors: true, timeoutSeconds: 30, memory: "256MiB", maxInstances: 5 }, async (req) => {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError("unauthenticated", "Connectez-vous.");
  const d = req.data || {}; const rid = String(d.rid || ""); const id = String(d.id || ""); const kind = d.kind === "chat" ? "chat" : "consigne";
  if (!/^[\w-]{1,80}$/.test(rid) || !/^[\w-]{1,80}$/.test(id)) throw new HttpsError("invalid-argument", "Requête invalide.");
  const me = await db().doc(`restos/${rid}/members/${uid}`).get();
  if (!me.exists) throw new HttpsError("permission-denied", "Vous ne faites pas partie de ce restaurant.");
  const snap = await db().doc(`restos/${rid}/${kind === "chat" ? "chat" : "consignes"}/${id}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Message introuvable.");
  const m = snap.data() || {};
  if (m.uid !== uid) throw new HttpsError("permission-denied", "Seul l'auteur peut prévenir l'équipe.");
  if (m.notified) return { ok: true, sent: 0, again: true };
  await snap.ref.update({ notified: Date.now() });

  const resto = (await db().doc(`restos/${rid}`).get()).data() || {};
  const title = kind === "chat" ? `${first(m.by)} · ${cut(resto.name || "Équipe", 30)}` : `${KINDS[m.kind] || "Consigne"} · ${first(m.by)}`;
  const body = cut(m.text, 180);
  const push = await db().collection(`restos/${rid}/push`).get();
  const owners = []; const tokens = [];
  push.docs.forEach((x) => { if (x.id === uid) return; (Array.isArray(x.data().tokens) ? x.data().tokens : []).slice(-5).forEach((t) => { if (typeof t === "string" && t) { tokens.push(t); owners.push(x.id); } }); });
  if (!tokens.length) return { ok: true, sent: 0 };

  let sent = 0; const dead = {};
  for (let i = 0; i < tokens.length; i += 500) {
    const part = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: part,
      data: { title, body, url: "./#consignes", tag: `gg-${kind}` },
      webpush: { headers: { Urgency: "high", TTL: String(kind === "chat" ? 6 * 3600 : 18 * 3600) } },
    });
    res.responses.forEach((r, k) => {
      if (r.success) { sent++; return; }
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument") (dead[owners[i + k]] ||= []).push(part[k]);
      else logger.warn("equipeNotify", code);
    });
  }
  await Promise.all(Object.entries(dead).map(([mid, t]) => db().doc(`restos/${rid}/push/${mid}`).update({ tokens: admin.firestore.FieldValue.arrayRemove(...t) }).catch(() => {})));
  return { ok: true, sent };
});

module.exports = { equipeNotify };
