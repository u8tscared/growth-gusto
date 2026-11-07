/* Growth Gusto — team notifications (js/consignes.js). Firebase Functions v2, Node 22, region europe-west9.
   equipeNotify({ rid, kind: "consigne"|"chat"|"passation", id }): after someone publishes a consigne or a message, every other member of the
   restaurant who switched notifications on (restos/{rid}/push/{memberId}.tokens) gets a push through Firebase Cloud Messaging.
   Free: FCM costs nothing, and this runs once per message. Dead tokens are removed.
   Groups (restos/{rid}/chatGroups, js/consignes.js): a message or a consigne for a group rings only the people of that group.
   A group shared by several restaurants (kind « multi »): the message is copied into each of them (same id, from:{rid,name}) when
   that restaurant has the same group listing this one, and their teams are notified too. */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const NF = require("./notifs");
const REGION = "europe-west9";
const KINDS = { plat: "Plat du jour", rupture: "Rupture", info: "Info" };
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "Quelqu'un";
/* the three groups that exist without a doc (same as CS_GDEF in js/consignes.js) */
const GDEF = { tous: { kind: "all" }, cuisine: { kind: "poste", postes: ["cuisine", "second", "plonge"] }, salle: { kind: "poste", postes: ["salle", "bar"] } };
async function groupOf(rid, gid) {
  if (!gid || gid === "tous") return null;
  const d = await db().doc(`restos/${rid}/chatGroups/${gid}`).get();
  const g = d.exists ? d.data() || {} : null;
  if (GDEF[gid]) return g && g.off ? null : { ...(g || {}), ...GDEF[gid] };
  return g && !g.off ? g : null;
}
/* the member ids of a group in one restaurant (null = everyone) */
async function peopleOf(rid, g) {
  if (!g || g.kind === "all") return null;
  const add = Array.isArray(g.add) ? g.add : [], rm = Array.isArray(g.remove) ? g.remove : [];
  if (g.kind === "multi") return { rm };
  const [mem, staff] = await Promise.all([db().collection(`restos/${rid}/members`).get(), db().collection(`restos/${rid}/staff`).get()]);
  const post = {}; staff.docs.forEach((x) => { const s = x.data() || {}; if (s.memberId && s.post) post[s.memberId] = s.post; });
  const ids = new Set();
  mem.docs.forEach((x) => {
    const m = x.data() || {}; const id = x.id; if (rm.includes(id)) return;
    if (add.includes(id)) { ids.add(id); return; }
    if (g.kind === "poste") { const p = m.poste || post[id] || (m.role === "chef" ? "cuisine" : ""); if (m.role === "gerant" || (g.postes || []).includes(p)) ids.add(id); }
  });
  return { only: ids };
}
async function tokensOf(rid, uid, who, kind) {
  const push = await db().collection(`restos/${rid}/push`).get(); const out = [];
  push.docs.forEach((x) => {
    if (x.id === uid) return;
    if (who && who.only && !who.only.has(x.id)) return;
    if (who && who.rm && who.rm.includes(x.id)) return;
    /* each person's choice (js/notifs.js): consignes and discussion can be switched off, for the account or for one device */
    const p = x.data() || {}; const k = kind === "chat" ? "chat" : "consigne"; const seen = new Set();
    Object.values(p.devs || {}).forEach((dv) => { if (dv && typeof dv.t === "string" && dv.t) { seen.add(dv.t); if (NF._wants(null, null, p, dv, k)) out.push({ t: dv.t, rid, mid: x.id }); } });
    if (!NF._wants(null, null, p, null, k)) return;
    (Array.isArray(p.tokens) ? p.tokens : []).slice(-5).forEach((t) => { if (typeof t === "string" && t && !seen.has(t)) out.push({ t, rid, mid: x.id }); });
  });
  return out;
}
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

const equipeNotify = onCall({ region: REGION, cors: true, timeoutSeconds: 30, memory: "256MiB", maxInstances: 5 }, async (req) => {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError("unauthenticated", "Connectez-vous.");
  const d = req.data || {}; const rid = String(d.rid || ""); const id = String(d.id || ""); const kind = d.kind === "chat" ? "chat" : d.kind === "passation" ? "passation" : "consigne";
  if (!/^[\w-]{1,80}$/.test(rid) || !/^[\w-]{1,80}$/.test(id)) throw new HttpsError("invalid-argument", "Requête invalide.");
  const me = await db().doc(`restos/${rid}/members/${uid}`).get();
  if (!me.exists) throw new HttpsError("permission-denied", "Vous ne faites pas partie de ce restaurant.");
  const snap = await db().doc(`restos/${rid}/${kind === "chat" ? "chat" : kind === "passation" ? "handovers" : "consignes"}/${id}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Message introuvable.");
  const m = snap.data() || {};
  if (m.uid !== uid) throw new HttpsError("permission-denied", "Seul l'auteur peut prévenir l'équipe.");
  if (m.notified) return { ok: true, sent: 0, again: true };
  await snap.ref.update({ notified: Date.now() });

  const resto = (await db().doc(`restos/${rid}`).get()).data() || {};
  const SLOT = { midi: "du midi", soir: "du soir" };
  const title = kind === "passation" ? `Passation ${SLOT[m.slot] || "de service"} · ${first(m.by)}` : kind === "chat" ? `${first(m.by)} · ${cut(resto.name || "Équipe", 30)}` : `${KINDS[m.kind] || "Consigne"} · ${first(m.by)}`;
  const body = cut(m.text || (kind === "passation" ? "Rien à signaler, bon service !" : ""), 180);
  const g = kind === "passation" ? null : await groupOf(rid, m.g);
  const all = await tokensOf(rid, uid, await peopleOf(rid, g), kind);
  let title2 = title;
  if (g && g.name && kind === "chat") title2 = `${first(m.by)} · ${cut(g.name, 30)}`;
  /* a group shared with other restaurants: copy the message there, then ring their teams */
  if (kind === "chat" && g && g.kind === "multi" && !m.from) {
    const sites = (Array.isArray(g.sites) ? g.sites : []).map((x) => x && String(x.rid || "")).filter((x) => x && x !== rid && /^[\w-]{1,80}$/.test(x)).slice(0, 20);
    for (const sr of sites) {
      try {
        const tg = await groupOf(sr, m.g);
        if (!tg || tg.kind !== "multi" || !(tg.sites || []).some((x) => x && x.rid === rid)) continue;
        const ref = db().doc(`restos/${sr}/chat/${id}`);
        await ref.set({ text: String(m.text || "").slice(0, 1000), at: m.at || Date.now(), uid, by: String(m.by || ""), g: m.g, from: { rid, name: String(resto.name || "") }, notified: Date.now() }, { merge: true });
        (await tokensOf(sr, uid, await peopleOf(sr, tg), kind)).forEach((x) => all.push(x));
      } catch (e) { logger.warn("equipeNotify mirror", sr, e && e.message); }
    }
  }
  const tokens = all.map((x) => x.t); const owners = all.map((x) => x);
  if (!tokens.length) return { ok: true, sent: 0 };

  let sent = 0; const dead = {};
  for (let i = 0; i < tokens.length; i += 500) {
    const part = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: part,
      data: { title: title2, body, url: kind === "passation" ? "./?go=passation" : "./#consignes", tag: `gg-${kind}` },
      webpush: { headers: { Urgency: "high", TTL: String(kind === "chat" ? 6 * 3600 : 18 * 3600) } },
    });
    res.responses.forEach((r, k) => {
      if (r.success) { sent++; return; }
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument") { const o = owners[i + k]; (dead[`${o.rid}|${o.mid}`] ||= []).push(part[k]); }
      else logger.warn("equipeNotify", code);
    });
  }
  await Promise.all(Object.entries(dead).map(([k, t]) => db().doc(`restos/${k.split("|")[0]}/push/${k.split("|")[1]}`).update({ tokens: admin.firestore.FieldValue.arrayRemove(...t) }).catch(() => {})));
  return { ok: true, sent };
});

module.exports = { equipeNotify };
