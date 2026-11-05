/* Growth Gusto — admin actions (js/abo.js « Espace admin »). Firebase Functions v2, Node 22, region europe-west9.
   adminDeleteUser({ uid } | { email }): deletes an account for good. Only for the Growth Gusto admins (same list as
   firestore.rules isAdmin() and js/config.js GG_ADMINS). What goes:
     · every restaurant the account OWNS, with everything under it (relevés, équipe, réservations…), its invites and public docs
     · its membership in the other restaurants
     · users/{uid}, _codes/{uid}, _mails/{uid}
     · the Firebase Authentication account (Google or e-mail)
   Returns { ok, email, restos: [names], left: n }. An admin cannot delete their own account here. */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const REGION = "europe-west9";
const ADMINS = ["marceau.ruis@gmail.com"];

function isAdmin(req) {
  const t = req.auth && req.auth.token; if (!t) return false;
  return ADMINS.includes(String(t.email || "").toLowerCase()) && (t.email_verified === true || (t.firebase && t.firebase.sign_in_provider === "google.com"));
}

const adminDeleteUser = onCall({ region: REGION, cors: true, timeoutSeconds: 300, memory: "512MiB" }, async (req) => {
  if (!isAdmin(req)) throw new HttpsError("permission-denied", "Réservé aux administrateurs Growth Gusto.");
  const d = req.data || {}; let uid = String(d.uid || "").trim(); let email = String(d.email || "").trim().toLowerCase(); let user = null;
  try { user = uid ? await admin.auth().getUser(uid) : email ? await admin.auth().getUserByEmail(email) : null; } catch (e) { if (e.code !== "auth/user-not-found") throw e; }
  if (user) { uid = user.uid; email = String(user.email || email).toLowerCase(); }
  if (!uid && email) { const q = await db().collection("users").where("email", "==", email).limit(1).get(); if (!q.empty) uid = q.docs[0].id; }
  if (!uid) throw new HttpsError("not-found", "Aucun compte avec cette adresse.");
  if (uid === req.auth.uid) throw new HttpsError("failed-precondition", "Vous ne pouvez pas supprimer votre propre compte ici.");

  const udoc = await db().doc(`users/${uid}`).get(); const ud = udoc.exists ? udoc.data() : {};
  if (!email) email = String(ud.email || "").toLowerCase();
  const owned = await db().collection("restos").where("owner", "==", uid).get();
  const names = [];
  for (const r of owned.docs) {
    names.push(r.data().name || r.id);
    const inv = await db().collection("invites").where("rid", "==", r.id).get(); const b = db().batch(); inv.docs.forEach((x) => b.delete(x.ref)); if (!inv.empty) await b.commit();
    await db().recursiveDelete(r.ref); await db().recursiveDelete(db().doc(`resaKeys/${r.id}`)).catch(() => {});
    /* the other members lose this restaurant from their list */
    const others = await db().collection("users").where("restos", "array-contains", r.id).get();
    const b2 = db().batch(); others.docs.forEach((x) => b2.update(x.ref, { restos: admin.firestore.FieldValue.arrayRemove(r.id) })); if (!others.empty) await b2.commit();
  }
  /* memberships elsewhere */
  let left = 0;
  for (const rid of Array.isArray(ud.restos) ? ud.restos : []) { const ref = db().doc(`restos/${rid}/members/${uid}`); const s = await ref.get(); if (s.exists) { await ref.delete(); left++; } }
  await Promise.all([`users/${uid}`, `_codes/${uid}`, `_mails/${uid}`].map((p) => db().doc(p).delete().catch(() => {})));
  if (user) await admin.auth().deleteUser(uid);
  logger.info("adminDeleteUser", { by: req.auth.token.email, uid, email, restos: names.length, left });
  return { ok: true, email, restos: names, left, auth: !!user };
});

module.exports = { adminDeleteUser };
