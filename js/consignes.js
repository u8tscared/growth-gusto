/* Growth Gusto — area: consignes (route « consignes »). Prefix « cs ».
   What the team must know today, and a simple team wall. Hyper simple on purpose:
     · Consignes: three kinds, « Plat du jour », « Rupture » (plus de…), « Info ». A gérant or a chef writes one in two taps (or dictates it).
       Each person taps « Lu » ; the writer sees who read it and who has not yet. A rupture stays until someone taps « De retour ».
     · Discussion: one wall for the whole team, newest first. Everyone can write, dictate, read.
   Data (restos/{rid}/…, members only, see firestore.rules):
     consignes/{id} { kind:"plat"|"rupture"|"info", text, day:"YYYY-MM-DD", keep:bool, endedAt?, endedBy?, at, uid, by }
     csReads/{cid~pid} { cid, pid, name, at }      pid = member id, or "st:<staffId>" for a staff file without an account
     chat/{id} { text, at, uid, by, g?, from?:{rid,name} }      g = group id (none = « tous »); from = copied from a sister restaurant
     chatGroups/{gid} { name, kind:"all"|"poste"|"custom"|"multi", postes?, add?:[pid], remove?:[pid], sites?:[{rid,name}], off?, at, by }
                     gérants only. « tous », « cuisine », « salle » exist without a doc (CS_GDEF); a doc only stores the changes.
                     A « multi » group lives in each of its restaurants under the same id; a message is copied to the others
                     (here when I belong to them, and by the server, functions/src/equipe.js, for everyone else).
     consignes/{id}.g   the group the consigne is for (none = everyone); restos/{rid}.csCfg.writers = who may publish (none = gérants + chefs)
     push/{memberId} { tokens:[…], at }            (own doc only, read by the server: functions/src/equipe.js)
   Push (free, Firebase Cloud Messaging): on a phone that allowed notifications, a new consigne or message rings even when the app
   is closed (iPhone: app added to the home screen). The server sends it (equipeNotify), the service worker shows it (sw.js « push »).
   Exposed: csUnread() → consignes not read by me today + new messages (nav badges), csHomeCard() → « Consignes du jour » card (home.js). */
"use strict";

TAB_OF.consignes = "more";
Object.assign(IC, {
  csMega: ["M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2L13 19.5V4.5L7 8.5H5A1.5 1.5 0 0 0 3.5 10z", "f:M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2L13 19.5V4.5L7 8.5H5A1.5 1.5 0 0 0 3.5 10z", "M16.5 9a4 4 0 0 1 0 6", "M19 6.5a7.5 7.5 0 0 1 0 11"],
  csPlate: ["M3 17.5h18", "M4.5 17.5a7.5 7.5 0 0 1 15 0", "f:M4.5 17.5a7.5 7.5 0 0 1 15 0z", "M12 7.5V6", "M10.5 6h3"],
  csOff: ["c:12,12,8.5", "f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M6 6l12 12"],
  csInfo: ["c:12,12,8.5", "f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M12 11v5", "M12 7.8v.01"],
  csChat: ["M4 5.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 3.5v-3.5H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z", "f:M4 5.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 3.5v-3.5H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z", "M8 10.5h8", "M8 13.5h5"],
  csMic: ["r:9,3,6,11,3", "f:M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z", "M5.5 11a6.5 6.5 0 0 0 13 0", "M12 17.5V21"],
  csSend: ["M4 12 20 4l-4 16-4.5-6.5z", "f:M4 12 20 4l-4 16-4.5-6.5z", "M11.5 13.5 20 4"],
  csEye: ["M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", "c:12,12,3"],
  csBack: ["M3.5 12a8.5 8.5 0 1 0 2.5-6", "M3.5 3.5V8H8"],
  csBell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "f:M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
});
(function csNav() { if (NAV.some((n) => n[0] === "consignes")) return; const i = NAV.findIndex((n) => n[0] === "pointeuse"); NAV.splice(i >= 0 ? i : NAV.length, 0, ["consignes", "csMega", "Consignes"]); })();

/* [label, icon, colour class, placeholder] */
const CS_K = {
  plat: ["Plat du jour", "csPlate", "plat", "Ex. : Blanquette de veau, riz pilaf · 16 €"],
  rupture: ["Rupture", "csOff", "rupt", "Ex. : Plus de bar, plus de tarte tatin"],
  info: ["Info", "csInfo", "info", "Ex. : Livraison Metro à 10 h, contrôle hygiène jeudi"],
};
const CS_ORDER = ["plat", "rupture", "info"];
const CS = { rid: null, subs: {}, consignes: null, reads: null, chat: null, groups: null, tab: "consignes", g: "tous", F: null, GF: null, rec: null, notified: {} };
const CS_COLS = [["consignes", "consignes", { order: "at", dir: "desc", limit: 200 }], ["reads", "csReads", {}], ["chat", "chat", { order: "at", dir: "desc", limit: 300 }], ["groups", "chatGroups", {}]];

/* ───────── data ───────── */
function csAlive(key) {
  const s = CS.subs[key]; if (!s) return false;
  if (DB.mode === "db") return DB.subs.includes(s);
  return (DB.listeners[DB.path(s.col)] || []).includes(s.cb);
}
function csWatch() {
  if (!S.rid || typeof DB === "undefined" || !S.ready) return;
  if (CS.rid !== S.rid) { CS.rid = S.rid; CS.subs = {}; CS_COLS.forEach(([k]) => (CS[k] = null)); CS.notified = {}; }
  const rid = S.rid;
  CS_COLS.forEach(([k, col, opts]) => {
    if (csAlive(k)) return;
    const cb = (rows) => { if (S.rid !== rid) return; const first = CS[k] === null; const prev = CS[k]; CS[k] = rows; if (!first) csPing(k, prev, rows); onData(); };
    const n = DB.subs.length; DB.watch(col, opts, cb);
    CS.subs[k] = DB.mode === "db" ? DB.subs[DB.subs.length - 1] || DB.subs[n] : { col, cb };
  });
}
const csArr = (k) => { csWatch(); return CS[k] || []; };
const csToday = () => dayKey();
const csLive = (c) => !c.endedAt && (c.day === csToday() || (c.keep && c.day <= csToday()));
function csList() { return csArr("consignes").filter((c) => csLive(c) && csForMe(c)).sort((a, b) => CS_ORDER.indexOf(a.kind) - CS_ORDER.indexOf(b.kind) || b.at - a.at); }
const csAdmin = () => myRole() === "gerant";
const csWriters = () => { const w = S.resto && S.resto.csCfg && S.resto.csCfg.writers; return Array.isArray(w) ? w : null; };
/* who may publish a consigne: a gérant always; then the people the gérant ticked, or (nothing ticked yet) the chefs */
function csCanWriteP(m) { if (!m) return false; if (m.role === "gerant" || (S.isOwner && m.id === S.me.id)) return true; const w = csWriters(); return w ? w.includes(m.id) : m.role === "chef"; }
const csCanWrite = () => { const r = myRole(); if (r === "gerant") return true; const w = csWriters(); return w ? w.includes(S.me.id) : r === "chef" || DB.mode === "local"; };
const csReadersOf = (cid) => csArr("reads").filter((r) => r.cid === cid);
const csReadBy = (cid, pid) => csArr("reads").some((r) => r.cid === cid && r.pid === pid);
const csMine = (c) => c.uid === S.me.id;
/* the people who should read: every member, plus the staff files that have no account (kitchen profiles on the shared tablet) */
function csTeam() {
  const out = []; const seen = new Set();
  (S.members || []).forEach((m) => { if (seen.has(m.id)) return; seen.add(m.id); out.push({ pid: m.id, name: m.name || "Sans nom", color: m.color || colorFor(m.id), member: m }); });
  (S.staff || []).forEach((s) => { if (s.active === false || (s.memberId && seen.has(s.memberId))) return; const pid = "st:" + s.id; if (seen.has(pid)) return; seen.add(pid); out.push({ pid, name: s.name || "Sans nom", color: s.color || colorFor(s.id), staff: s }); });
  return out;
}
/* ───────── groups (discussion and consignes) ─────────
   Three groups always exist: « Toute l'équipe », « Cuisine » (cuisine, second, plonge) and « Salle » (salle, bar). A gérant renames them,
   adds or removes people, creates others (« Ouverture », « Pâtisserie »…) and groups shared between several restaurants.
   Membership = the rule of the group (everyone, or the poste) + the people added − the people removed. A gérant sees every group.
   Note: groups sort the conversation, the restaurant's data stays readable by its members (as before). */
const CS_GDEF = {
  tous: { name: "Toute l'équipe", kind: "all", ic: "users", c: "#4A1FE6" },
  cuisine: { name: "Cuisine", kind: "poste", postes: ["cuisine", "second", "plonge"], ic: "pmToque", c: "#E0752F" },
  salle: { name: "Salle", kind: "poste", postes: ["salle", "bar"], ic: "pmCloche", c: "#1F7AE0" },
};
const CS_GC = ["#0B9B6A", "#D63A7A", "#0E8C9E", "#7A4DFF", "#C8432A", "#2F5FBF"];
const CS_POSTE_T = { cuisine: "Cuisine", second: "Second", plonge: "Plonge", salle: "Salle", bar: "Bar" };
function csGroups() {
  const docs = {}; csArr("groups").forEach((d) => (docs[d.id] = d));
  const out = [];
  Object.entries(CS_GDEF).forEach(([id, def]) => { const d = docs[id] || {}; if (d.off && id !== "tous") return; out.push({ ...def, ...d, kind: def.kind, postes: def.postes, id, builtin: true }); });
  Object.values(docs).filter((d) => !CS_GDEF[d.id] && !d.off && d.name).sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((d, i) => out.push({ ic: d.kind === "multi" ? "mrShare" : "csChat", c: CS_GC[i % CS_GC.length], ...d }));
  return out;
}
const csGroup = (id) => csGroups().find((g) => g.id === (id || "tous")) || null;
/* a person's poste: on the member (Nouvel équipier), else on the staff file (Planning), else « cuisine » for a chef */
function csPosteOf(p) {
  const m = p.member; if (m && m.poste) return m.poste;
  const st = p.staff || (m && (S.staff || []).find((s) => s.memberId === m.id));
  if (st && st.post) return st.post;
  return m && m.role === "chef" ? "cuisine" : "";
}
const csIsGerantP = (p) => !!(p && ((p.member && p.member.role === "gerant") || (S.isOwner && p.pid === S.me.id)));
/* in the group by its rule alone (no added / removed people) */
function csAuto(g, p) {
  if (!g) return true;
  if (g.kind === "all" || g.kind === "multi") return true;
  if (g.kind === "poste") return csIsGerantP(p) || (g.postes || []).includes(csPosteOf(p));
  return false;
}
function csIn(g, p) {
  if (!g) return true; if (!p) return false;
  if (g.kind === "all") return true;
  if ((g.remove || []).includes(p.pid)) return false;
  if ((g.add || []).includes(p.pid)) return true;
  return csAuto(g, p);
}
const csMeP = () => csTeam().find((p) => p.pid === S.me.id) || { pid: S.me.id, name: S.me.name || "", member: { id: S.me.id, role: myRole() } };
const csInMe = (g) => !!g && csIn(g, csMeP());
const csMyGroups = () => csGroups().filter((g) => csAdmin() || csInMe(g));
const csGMembers = (g) => csTeam().filter((p) => csIn(g, p));
const csMsgs = (gid) => csArr("chat").filter((m) => (m.g || "tous") === gid);
/* a consigne for a group: its people (the gérant and the writer always see it); a group that was deleted → everyone */
const csAud = (c) => { const g = c && c.g && c.g !== "tous" ? csGroup(c.g) : null; return g && g.kind !== "multi" ? g : null; };
function csForMe(c) { const g = csAud(c); return !g || csAdmin() || c.uid === S.me.id || csInMe(g); }
const csForP = (c, p) => { const g = csAud(c); return !g || csIn(g, p); };
const csGroupIco = (g, s = 18) => `<span class="cs-gi" style="--gc:${esc(g.c || "#4A1FE6")};--s:${s}px">${ico(g.ic || "csChat")}</span>`;
/* write / delete in any restaurant of mine (the open one through DB) */
function csPutSite(rid, col, id, data) {
  if (data && typeof mrPut === "function") return mrPut(rid, col, id, data).catch(() => {});
  if (data) return rid === S.rid ? DB.set(col, id, data) : Promise.resolve();
  if (rid === S.rid) return DB.del(col, id);
  if (DB.mode === "db") { if (!DB.uid || !DB.db.collection) return Promise.resolve(); return DB.db.collection(`restos/${rid}/${col}`).doc(id).delete().catch(() => {}); }
  const path = `restos/${rid}/${col}`; if (DB.local[path]) { delete DB.local[path][id]; DB.emit(path); if (DB.saveLocal) DB.saveLocal(); }
  return Promise.resolve();
}
const csSites = (g) => (g && Array.isArray(g.sites) ? g.sites : []).filter((x) => x && x.rid);
const csRestoName = (rid) => { const r = (S.restos || []).find((x) => x.id === rid); return (r && r.name) || "Restaurant"; };
function csUnreadC() { if (!S.rid) return 0; return csList().filter((c) => !csMine(c) && !csReadBy(c.id, S.me.id)).length; }
const csSeenKey = (g) => `gg-chat-seen-${S.rid}-${S.me.id}${g && g !== "tous" ? "-" + g : ""}`;
function csChatSeen(g) { try { return +localStorage.getItem(csSeenKey(g)) || 0; } catch (e) { return 0; } }
const csGNew = (g) => { const t = csChatSeen(g.id); return csMsgs(g.id).filter((m) => m.at > t && m.uid !== S.me.id).length; };
function csChatNew() { if (!S.rid) return 0; return csMyGroups().filter((g) => csInMe(g)).reduce((n, g) => n + csGNew(g), 0); }
function csUnread() { try { return csUnreadC() + csChatNew(); } catch (e) { return 0; } }

/* something new from someone else while the app is open: a soft sound, a toast, a system notification if the tab is hidden */
function csPing(k, prev, rows) {
  if (k === "reads" || k === "groups" || !prev) return;
  const ids = new Set(prev.map((x) => x.id));
  const fresh = rows.filter((x) => !ids.has(x.id) && x.uid !== S.me.id && Date.now() - (x.at || 0) < 120000 && !CS.notified[x.id] && (k === "chat" ? csInMe(csGroup(x.g || "tous")) : csForMe(x)));
  if (!fresh.length) return;
  fresh.forEach((x) => (CS.notified[x.id] = 1));
  const x = fresh[0]; const who = firstName(x.by || nameOf(x.uid));
  const xg = k === "chat" && x.g && x.g !== "tous" ? csGroup(x.g) : null;
  const title = k === "consignes" ? `${CS_K[x.kind] ? CS_K[x.kind][0] : "Consigne"} · ${who}` : `${who} a écrit${xg ? ` · ${xg.name}` : ""}`;
  if (document.hidden) { csNotifyLocal(title, x.text); return; }
  if (S.route === "consignes" && ((k === "chat" && CS.tab === "chat" && (x.g || "tous") === CS.g) || (k === "consignes" && CS.tab === "consignes"))) { SFX.tick(); return; }
  SFX.tick(); buzz([8, 30, 8]); toast(`${title} : ${String(x.text || "").slice(0, 60)}`, "info");
}
function csNotifyLocal(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opt = { body: String(body || "").slice(0, 160), icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "gg-consignes", data: { url: "./#consignes" } };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opt)).catch(() => {});
    else new Notification(title, opt);
  } catch (e) {}
}

/* ───────── push (Firebase Cloud Messaging, free) ───────── */
const csPushOn = () => !!(window.GG_SERVER && GG_SERVER.equipe) && DB.mode === "db" && !!DB.uid && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const csPushState = () => { try { return Notification.permission; } catch (e) { return "denied"; } };
const csPushKey = () => `gg-push-${S.rid}-${S.me.id}`;
async function csPushRegister(ask) {
  if (!csPushOn()) return false;
  if (csPushState() === "default" && ask) { try { await Notification.requestPermission(); } catch (e) {} }
  if (csPushState() !== "granted") return false;
  try {
    if (!(window.firebase && firebase.messaging)) { if (typeof AUTH === "undefined" || !AUTH.script) return false; await AUTH.script(AU_SDK_BASE + "firebase-messaging-compat.js"); }
    const reg = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ serviceWorkerRegistration: reg });
    if (!token) return false;
    let last = ""; try { last = localStorage.getItem(csPushKey()) || ""; } catch (e) {}
    if (last !== token) {
      const ref = DB.db.doc(`restos/${S.rid}/push/${S.me.id}`);
      await ref.set({ tokens: firebase.firestore.FieldValue.arrayUnion(token), at: Date.now() }, { merge: true });
      try { localStorage.setItem(csPushKey(), token); } catch (e) {}
    }
    return true;
  } catch (e) { console.warn("push", e); return false; }
}
/* every launch: refresh the token quietly if notifications are already allowed */
window.addEventListener("gg:ready", () => setTimeout(() => { try { if (csPushOn() && csPushState() === "granted") csPushRegister(false); } catch (e) {} }, 4000));
function csNotify(kind, id) {
  if (!(window.GG_SERVER && GG_SERVER.equipe) || DB.mode !== "db" || typeof AUTH === "undefined" || !AUTH.call) return;
  const send = (n) => AUTH.call("equipeNotify", { rid: S.rid, kind, id }).catch((e) => { if (n < 2 && /not-found|unavailable|deadline/.test(String((e && e.code) || ""))) setTimeout(() => send(n + 1), 3000 * (n + 1)); else console.warn("notify", e); });
  send(0);
}

/* ───────── voice: the phone's own dictation (Web Speech API, free, on the device) ───────── */
const csSR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
function csMicBtn(target) { return csSR() ? `<button class="cs-mic" data-act="csMic" data-v="${target}" aria-label="Dicter">${ico("csMic")}<span>Dicter</span></button>` : ""; }
function csMicStop() { const r = CS.rec; CS.rec = null; if (r) { try { r.stop(); } catch (e) {} } $$(".cs-mic.on").forEach((b) => b.classList.remove("on")); }

/* ───────── view ───────── */
const csAva = (pid, name, color, s = 30) => { const m = (S.members || []).find((x) => x.id === pid); const ph = m && (m.photo || m.avatarUrl); return `<span class="cs-ava" style="--s:${s}px;--c:${esc(color || colorFor(pid))}" title="${esc(name || "")}">${ph ? `<img src="${esc(ph)}" alt="">` : esc(initials(name || "?"))}</span>`; };
function csCard(c, i) {
  const K = CS_K[c.kind] || CS_K.info; const read = csReadBy(c.id, S.me.id); const mine = csMine(c);
  const team = csTeam().filter((p) => p.pid !== c.uid && csForP(c, p)); const rd = csReadersOf(c.id).filter((r) => r.pid !== c.uid && team.some((p) => p.pid === r.pid));
  const aud = csAud(c);
  const showWho = mine || csCanWrite();
  const old = c.day !== csToday() ? ` · depuis ${c.day === dayKey(new Date(Date.now() - 864e5)) ? "hier" : shortDate(c.day)}` : "";
  return `<article class="cs-card ${K[2]} ${read || mine ? "" : "new"} st" style="--i:${i}">
    <div class="cs-ch"><span class="cs-k">${ico(K[1])}${K[0]}</span><span class="cs-by">${aud ? `<i class="cs-gt" style="--gc:${esc(aud.c || "#4A1FE6")}">${esc(aud.name)}</i>` : ""}${esc(firstName(c.by || nameOf(c.uid)))} · ${hm(c.at)}${old}</span></div>
    <p class="cs-tx">${esc(c.text)}</p>
    ${showWho ? `<button class="cs-who" data-act="csWho" data-id="${c.id}" aria-label="Qui a lu">${rd.slice(0, 5).map((r) => { const p = team.find((t) => t.pid === r.pid); return csAva(r.pid, r.name, p && p.color, 24); }).join("")}<span>${team.length ? (rd.length >= team.length ? (aud ? `Lu par tout le groupe ${esc(aud.name)}` : "Lu par toute l'équipe") : `Lu par ${rd.length} / ${team.length}`) : "Personne d'autre dans l'équipe"}</span>${ico("chev")}</button>` : ""}
    <div class="cs-cf">
      <span class="cs-acts">
        ${c.kind === "rupture" && csCanWrite() ? `<button class="btn soft sm" data-act="csEnd" data-id="${c.id}">${ico("csBack")}De retour</button>` : ""}
        ${mine || myRole() === "gerant" ? `<button class="iconbtn sm cs-more" data-act="csMenu" data-id="${c.id}" aria-label="Options">${ico("dots")}</button>` : ""}
      </span>
      ${mine ? "" : read ? `<span class="cs-lu on">${ico("check")}Lu</span>` : `<button class="cs-lu" data-act="csRead" data-id="${c.id}">${ico("check")}Lu</button>`}
    </div>
  </article>`;
}
function csConsignesHTML(k0) {
  const L = csList(); const un = L.filter((c) => !csMine(c) && !csReadBy(c.id, S.me.id)); let k = k0;
  const write = csCanWrite() ? `<div class="cs-new st" style="--i:${k++}">${CS_ORDER.map((kd) => `<button class="cs-nb ${CS_K[kd][2]}" data-act="csNew" data-v="${kd}">${ico(CS_K[kd][1])}<span>${CS_K[kd][0]}</span></button>`).join("")}</div>` : "";
  const allRead = un.length >= 2 ? `<button class="btn acc block cs-all st" style="--i:${k++}" data-act="csReadAll">${ico("check")}J'ai tout lu (${un.length})</button>` : "";
  const body = L.length ? L.map((c) => csCard(c, k++)).join("")
    : `<div class="glass empty st" style="--i:${k++}"><div class="ic">${ico("csMega")}</div><b>Rien pour aujourd'hui</b>${csCanWrite() ? "Le plat du jour, une rupture, une info : choisissez ci-dessus, c'est écrit en dix secondes." : "Les consignes du chef apparaîtront ici."}</div>`;
  const kiosk = L.length && csTeam().length > 1 ? `<button class="cs-kiosk st" style="--i:${k++}" data-act="csKiosk">${ico("users")}Tablette partagée : chacun touche son prénom</button>` : "";
  const who = csAdmin() ? `<button class="cs-wr st" style="--i:${k++}" data-act="csWriters">${ico("csMega")}<span>Qui peut publier des consignes ?<em>${esc(csWritersLine())}</em></span>${ico("chev")}</button>` : "";
  return write + allRead + `<div class="cs-list">${body}</div>` + kiosk + who;
}
function csCurG() { const G = csMyGroups(); let g = G.find((x) => x.id === CS.g); if (!g) { g = G.find((x) => x.id === "tous") || G[0]; CS.g = g ? g.id : "tous"; } return g; }
function csChatHTML(k0) {
  let k = k0; const G = csMyGroups(); const g = csCurG(); if (!g) return "";
  const M = csMsgs(g.id); const seen = csChatSeen(g.id); const admin = csAdmin();
  const chips = G.length > 1 || admin ? `<div class="cs-groups st" style="--i:${k++}" role="tablist" aria-label="Groupes">${G.map((x) => { const n = x.id === g.id ? 0 : csGNew(x); const on = x.id === g.id; return `<button class="cs-gc ${on ? "on" : ""}" role="tab" aria-selected="${on}" data-act="csGroup" data-v="${esc(x.id)}" style="--gc:${esc(x.c || "#4A1FE6")}">${ico(x.ic || "csChat")}<span>${esc(x.name)}</span>${n ? `<i class="cs-n">${n}</i>` : ""}</button>`; }).join("")}${admin ? `<button class="cs-gc add" data-act="csGroupNew" aria-label="Nouveau groupe">${ico("plus")}<span>Groupe</span></button>` : ""}</div>` : "";
  const P = csGMembers(g); const sites = csSites(g).filter((x) => x.rid !== S.rid);
  const head = `<button class="cs-gh st" style="--i:${k++}" data-act="${admin ? "csGroupEdit" : "csGroupInfo"}" data-v="${esc(g.id)}">${csGroupIco(g, 20)}<span class="cs-ght"><b>${esc(g.name)}</b><em>${P.length} personne${P.length > 1 ? "s" : ""}${sites.length ? ` ici · + ${sites.map((x) => esc(x.name || csRestoName(x.rid))).join(", ")}` : ""}</em></span><span class="cs-gav">${P.slice(0, 5).map((p) => csAva(p.pid, p.name, p.color, 26)).join("")}${P.length > 5 ? `<i>+${P.length - 5}</i>` : ""}</span><span class="cs-gm">${admin ? "Membres" : "Voir"}${ico("chev")}</span></button>`;
  const to = g.id === "tous" ? "toute l'équipe" : `« ${g.name} »`;
  const comp = `<div class="glass cs-comp st" style="--i:${k++}"><textarea class="input cs-ta" id="csChatTx" rows="2" maxlength="1000" placeholder="Écrire à ${esc(to)}…" aria-label="Message">${esc((S.ui.csDrafts || {})[g.id] || "")}</textarea>
    <div class="cs-cb">${csMicBtn("csChatTx")}<button class="btn acc sm cs-send" data-act="csSend">${ico("csSend")}Envoyer</button></div></div>`;
  let lastDay = ""; const rows = M.map((m) => {
    const d = dayKey(new Date(m.at)); const sep = d !== lastDay ? `<div class="cs-day">${d === csToday() ? "Aujourd'hui" : d === dayKey(new Date(Date.now() - 864e5)) ? "Hier" : shortDate(d)}</div>` : ""; lastDay = d;
    const me = m.uid === S.me.id && !m.from; const p = (S.members || []).find((x) => x.id === m.uid);
    const where = m.from && m.from.rid !== S.rid ? `<i class="cs-from">${esc(m.from.name || csRestoName(m.from.rid))}</i>` : "";
    return `${sep}<div class="cs-msg ${me ? "me" : ""} ${!me && seen && m.at > seen ? "new" : ""}">${me ? "" : csAva(m.uid, m.by || nameOf(m.uid), p && p.color, 32)}<div class="cs-bub"><span class="cs-mh"><b>${me ? "Vous" : esc(firstName(m.by || nameOf(m.uid)))}</b>${where}<em>${hm(m.at)}</em></span><p>${esc(m.text)}</p></div>${me || (admin && !m.from) ? `<button class="cs-mdel" data-act="csDelMsg" data-id="${m.id}" aria-label="Supprimer">${ico("trash")}</button>` : ""}</div>`;
  }).join("");
  const empty = g.id === "tous" ? "Un mot pour toute l'équipe : un changement d'horaire, un merci, une question." : `Ces messages s'affichent seulement pour les personnes du groupe « ${esc(g.name)} ».`;
  return chips + head + comp + (M.length ? `<div class="glass pad cs-wall st" style="--i:${k++}">${rows}</div>` : `<div class="glass empty st" style="--i:${k++}"><div class="ic">${ico("csChat")}</div><b>Pas encore de message</b>${empty}</div>`);
}
function csPushCard(k) {
  if (!csPushOn()) return "";
  const st = csPushState(); if (st === "granted" && !S.ui.csPushShow) return "";
  if (st === "denied") return "";
  return `<div class="cs-push st" style="--i:${k}">${ico("csBell")}<span><b>Être prévenu sur ce téléphone</b>Une sonnerie à chaque nouvelle consigne, même l'app fermée.</span><button class="btn acc sm" data-act="csPush">Activer</button></div>`;
}
VIEWS.consignes = {
  render() {
    csWatch(); const tab = CS.tab === "chat" ? "chat" : "consignes";
    const nC = csUnreadC(), nM = csChatNew();
    const seg = `<div class="seg cs-seg st" style="--i:1"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "chat" ? "100%" : "0"})"></span>
      <button class="${tab === "consignes" ? "on" : ""}" data-act="csTab" data-v="consignes">Consignes${nC ? `<i class="cs-n">${nC}</i>` : ""}</button>
      <button class="${tab === "chat" ? "on" : ""}" data-act="csTab" data-v="chat">Discussion${nM && tab !== "chat" ? `<i class="cs-n">${nM}</i>` : ""}</button></div>`;
    const d = new Date();
    const right = csAdmin() ? `<button class="iconbtn cs-mg" data-act="csManage" aria-label="Groupes et membres" title="Groupes et membres">${ico("users")}</button>` : "";
    return `<div class="inner narrow cs">${topBar("Consignes & messages", { right })}
      <p class="sub cs-date st" style="--i:1">${DAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase())} ${d.getDate()} ${MONTHS[d.getMonth()]}</p>
      ${seg}${csPushCard(2)}
      ${tab === "chat" ? csChatHTML(3) : csConsignesHTML(3)}
    </div>`;
  },
  after() {
    if (CS.tab === "chat") { const g = CS.g || "tous"; const n = csMsgs(g).find((m) => m.uid !== S.me.id); const top = Math.max(n ? n.at : 0, csChatSeen(g)); if (top > csChatSeen(g)) { try { localStorage.setItem(csSeenKey(g), String(top)); } catch (e) {} setTimeout(() => renderChrome(), 0); } }
    const gc = $(".cs-gc.on"); if (gc && gc.parentElement && gc.parentElement.scrollWidth > gc.parentElement.clientWidth) { try { const P = gc.parentElement; P.scrollLeft = Math.max(0, gc.offsetLeft - (P.clientWidth - gc.offsetWidth) / 2); } catch (e) {} }
    const ta = $("#csChatTx"); if (ta) { ta.addEventListener("input", () => { (S.ui.csDrafts ||= {})[CS.g || "tous"] = ta.value; }); if (S.ui.csFocus) { S.ui.csFocus = false; try { ta.focus({ preventScroll: true }); } catch (e) {} } }
  },
};

/* ───────── home card (js/home.js) ───────── */
function csHomeCard() {
  if (!S.rid) return ""; const L = csList(); if (!L.length && !csCanWrite()) return "";
  const un = L.filter((c) => !csMine(c) && !csReadBy(c.id, S.me.id));
  if (!L.length) return `<button class="glass cs-hm empty st" style="--i:2" data-go="consignes">${ico("csMega")}<span><b>Consignes du jour</b><em>Plat du jour, ruptures, infos : prévenez l'équipe</em></span>${ico("chev")}</button>`;
  const show = L.slice(0, 4);
  return `<section class="glass cs-hm st" style="--i:2" aria-label="Consignes du jour">
    <div class="row"><span class="lbl">Consignes du jour</span>${un.length ? `<span class="pill acc"><span class="dot"></span>${un.length} à lire</span>` : `<span class="pill ok">${ico("check")}Tout lu</span>`}</div>
    <div class="cs-hl">${show.map((c) => { const K = CS_K[c.kind] || CS_K.info; const r = csMine(c) || csReadBy(c.id, S.me.id); return `<div class="cs-hi ${K[2]} ${r ? "" : "new"}" data-go="consignes" role="button" tabindex="0"><span class="cs-hk">${ico(K[1])}</span><span class="cs-ht">${esc(c.text)}</span>${r ? "" : `<i class="cs-hd" aria-label="à lire"></i>`}</div>`; }).join("")}${L.length > show.length ? `<div class="cs-hmore" data-go="consignes" role="button" tabindex="0">+ ${L.length - show.length} autre${L.length - show.length > 1 ? "s" : ""}</div>` : ""}</div>
    ${un.length ? `<button class="btn acc block sm cs-hbtn" data-act="csReadAll">${ico("check")}${un.length > 1 ? `J'ai lu les ${un.length}` : "J'ai lu"}</button>` : ""}
  </section>`;
}

/* ───────── composer sheet ───────── */
/* « Pour qui ? » in the composer: toute l'équipe, or one group of this restaurant */
function csAudPick(F) {
  const G = csGroups().filter((g) => g.kind !== "multi"); if (G.length < 2) return "";
  return `<div class="cs-aud" role="radiogroup" aria-label="Pour qui ?"><span class="lbl">Pour</span>${G.map((g) => { const on = (F.g || "tous") === g.id; return `<button class="cs-ac ${on ? "on" : ""}" role="radio" aria-checked="${on}" data-act="csAud" data-v="${esc(g.id)}" style="--gc:${esc(g.c || "#4A1FE6")}">${ico(g.ic || "csChat")}${esc(g.name)}</button>`; }).join("")}</div>`;
}
function csNewSheet() {
  const F = CS.F; const K = CS_K[F.kind];
  return `<div class="cs-sheet">
    <div class="h2">Nouvelle consigne</div>
    <div class="cs-kinds">${CS_ORDER.map((kd) => `<button class="cs-nb ${CS_K[kd][2]} ${F.kind === kd ? "on" : ""}" data-act="csKind" data-v="${kd}">${ico(CS_K[kd][1])}<span>${CS_K[kd][0]}</span></button>`).join("")}</div>
    ${csAudPick(F)}
    <textarea class="input cs-ta" id="csNewTx" rows="3" maxlength="600" placeholder="${esc(K[3])}" aria-label="Texte de la consigne">${esc(F.text || "")}</textarea>
    <div class="cs-cb">${csMicBtn("csNewTx")}<label class="cs-keep"><input type="checkbox" id="csKeep" ${F.keep ? "checked" : ""}><span>${F.kind === "rupture" ? "Jusqu'à « De retour »" : "Garder les jours suivants"}</span></label></div>
    <button class="btn acc block" data-act="csPublish">${ico("csSend")}Envoyer à l'équipe</button>
    <button class="btn ghost block" data-act="sheetClose">Annuler</button>
  </div>`;
}
function csWhoSheet(c) {
  const team = csTeam().filter((p) => p.pid !== c.uid && csForP(c, p)); const rd = csReadersOf(c.id);
  const yes = team.filter((p) => rd.some((r) => r.pid === p.pid)); const no = team.filter((p) => !rd.some((r) => r.pid === p.pid));
  const row = (p, r) => `<div class="li">${csAva(p.pid, p.name, p.color, 36)}<div class="tx"><b>${esc(p.name)}</b><em>${r ? `Lu à ${hm(r.at)}${dayKey(new Date(r.at)) !== csToday() ? ` le ${shortDate(dayKey(new Date(r.at)))}` : ""}` : "Pas encore lu"}</em></div>${r ? `<span class="pill ok">${ico("check")}Lu</span>` : `<button class="btn soft sm" data-act="csReadFor" data-id="${c.id}" data-v="${esc(p.pid)}">Marquer lu</button>`}</div>`;
  return `<div class="cs-sheet"><div class="h2">Qui a lu ?</div><p class="sub cs-q">« ${esc(c.text.length > 90 ? c.text.slice(0, 90) + "…" : c.text)} »</p>
    ${no.length ? `<div class="lbl">Pas encore lu · ${no.length}</div><div class="glass pad cs-wl">${no.map((p) => row(p, null)).join("")}</div>` : `<div class="cs-allok">${ico("check")}Toute l'équipe l'a lu</div>`}
    ${yes.length ? `<div class="lbl">Lu · ${yes.length}</div><div class="glass pad cs-wl">${yes.map((p) => row(p, rd.find((r) => r.pid === p.pid))).join("")}</div>` : ""}
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`;
}
/* shared tablet: tap your first name, then your code if you have one: every consigne of the day is marked read for you */
function csKioskSheet() {
  const L = csList(); const P = CS.kiosk || {};
  if (P.pid) {
    const p = csTeam().find((t) => t.pid === P.pid); const dots = [0, 1, 2, 3].map((i) => `<i class="${i < (P.code || "").length ? "on" : ""}"></i>`).join("");
    return `<div class="cs-sheet cs-pin">${csAva(p.pid, p.name, p.color, 64)}<div class="h2">${esc(firstName(p.name))}</div><p class="sub">${P.err ? `<span style="color:var(--bad)">${esc(P.err)}</span>` : "Votre code à 4 chiffres"}</p>
      <div class="cs-dots">${dots}</div>
      <div class="keypad cs-kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((d) => d === "" ? "<span></span>" : `<button data-act="csKey" data-v="${d}">${d}</button>`).join("")}</div>
      <button class="btn ghost block" data-act="csKiosk">Retour</button></div>`;
  }
  const team = csTeam();
  return `<div class="cs-sheet"><div class="h2">Qui êtes-vous ?</div><p class="sub">Touchez votre prénom pour lire les ${L.length} consigne${L.length > 1 ? "s" : ""} du jour.</p>
    <div class="cs-ppl">${team.map((p) => { const left = L.filter((c) => c.uid !== p.pid && csForP(c, p) && !csReadBy(c.id, p.pid)).length; return `<button class="cs-pp ${left ? "" : "ok"}" data-act="csKioskWho" data-v="${esc(p.pid)}">${csAva(p.pid, p.name, p.color, 46)}<b>${esc(firstName(p.name))}</b><em>${left ? `${left} à lire` : "Tout lu"}</em></button>`; }).join("")}</div>
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`;
}
function csKioskRead(pid) {
  const p = csTeam().find((t) => t.pid === pid); if (!p) return;
  const L = csList().filter((c) => c.uid !== pid && csForP(c, p)); L.forEach((c) => { if (!csReadBy(c.id, pid)) csMark(c.id, pid, p.name); });
  CS.kiosk = null; closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst();
  toast(`Merci ${firstName(p.name)}, c'est noté : ${L.length > 1 ? "consignes lues" : "consigne lue"}.`);
  setTimeout(() => { if (S.route === "consignes") refresh(); }, 50);
}
const csPinOf = (p) => (p.member && typeof ccHasPin === "function" && ccHasPin(p.member)) ? "member" : p.staff && p.staff.pinHash ? "staff" : "";
function csPinCheck(p, code) {
  const k = csPinOf(p);
  if (k === "member") return typeof ccVerifyPin === "function" ? !!ccVerifyPin(p.member.id, code) : true;
  if (k === "staff") return typeof rhPinHash === "function" ? p.staff.pinHash === rhPinHash(p.staff.id, code) : true;
  return true;
}
function csMark(cid, pid, name) { return DB.set("csReads", `${cid}~${pid}`.replace(/[\/]/g, "_"), { cid, pid, name: name || "", at: Date.now() }); }

/* ───────── groups & members (gérants) ───────── */
const csSw = (on, lock) => `<span class="pm-sw cs-sw ${on ? "on" : ""} ${lock ? "lock" : ""}" aria-hidden="true"><i></i></span>`;
const csPosteLine = (p) => { const r = p.member && p.member.role; const po = CS_POSTE_T[csPosteOf(p)] || ""; return [r === "gerant" || csIsGerantP(p) ? "Gérant" : r === "chef" ? "Chef" : "", po].filter(Boolean).join(" · ") || (p.staff ? "Profil cuisine" : "Équipe"); };
function csWritersLine() {
  const w = csWriters(); const M = (S.members || []).filter((m) => m.role !== "gerant");
  if (!w) { const ch = M.filter((m) => m.role === "chef"); return ch.length ? `Gérants et chefs : ${ch.map((m) => firstName(m.name)).join(", ")}` : "Les gérants"; }
  const on = M.filter((m) => w.includes(m.id)); return on.length ? `Gérants et ${on.map((m) => firstName(m.name)).join(", ")}` : "Les gérants seulement";
}
function csManageSheet() {
  const G = csGroups(); const off = Object.keys(CS_GDEF).filter((id) => id !== "tous" && !G.some((g) => g.id === id));
  const row = (g) => { const n = csGMembers(g).length; const st = csSites(g).filter((x) => x.rid !== S.rid); return `<button class="cs-gr" data-act="csGroupEdit" data-v="${esc(g.id)}">${csGroupIco(g, 20)}<span><b>${esc(g.name)}</b><em>${n} personne${n > 1 ? "s" : ""}${st.length ? ` · avec ${st.map((x) => esc(x.name || csRestoName(x.rid))).join(", ")}` : g.kind === "poste" ? ` · ${g.id === "salle" ? "salle et bar" : "cuisine et plonge"}` : ""}</em></span>${ico("chev")}</button>`; };
  return `<div class="cs-sheet">
    <div class="h2">Groupes et membres</div>
    <p class="sub cs-q0">Qui discute avec qui, et qui publie les consignes.</p>
    <div class="lbl">Groupes de discussion</div>
    <div class="glass pad cs-grl">${G.map(row).join("")}</div>
    ${off.length ? `<div class="cs-offl">${off.map((id) => `<button class="btn soft sm" data-act="csGroupOn" data-v="${id}">${ico("plus")}Remettre « ${esc(CS_GDEF[id].name)} »</button>`).join("")}</div>` : ""}
    <button class="btn acc block" data-act="csGroupNew">${ico("plus")}Nouveau groupe</button>
    <div class="lbl">Consignes</div>
    <button class="cs-gr cs-grw" data-act="csWriters">${csGroupIco({ c: "#E0752F", ic: "csMega" }, 20)}<span><b>Qui peut publier ?</b><em>${esc(csWritersLine())}</em></span>${ico("chev")}</button>
    <div class="lbl">Équipe</div>
    <div class="cs-team2">
      <button class="btn soft block" data-act="csAddPerson">${ico("plus")}Ajouter quelqu'un</button>
      <button class="btn soft block" data-act="csTeamPage">${ico("users")}Retirer ou modifier</button>
    </div>
    <button class="btn ghost block" data-act="sheetClose">Fermer</button>
  </div>`;
}
function csGroupSheet() {
  const F = CS.GF; const team = csTeam(); const all = F.kind === "all";
  const multi = (F.sites || []).length > 1; const canSites = (S.restos || []).length > 1 && F.kind !== "poste" && !all;
  const ppl = team.map((p) => { const on = csIn(F, p); return `<button class="cs-pr ${on ? "on" : ""}" role="switch" aria-checked="${on}" ${all ? "disabled" : ""} data-act="csGP" data-v="${esc(p.pid)}">${csAva(p.pid, p.name, p.color, 34)}<span><b>${esc(p.name)}</b><em>${esc(csPosteLine(p))}</em></span>${csSw(on, all)}</button>`; }).join("");
  const nIn = team.filter((p) => csIn(F, p)).length;
  const quick = !all && F.kind !== "poste" ? `<div class="cs-quick"><span class="lbl">D'un coup</span>${[["cuisine", "Toute la cuisine"], ["salle", "Toute la salle"], ["*", "Tout le monde"], ["-", "Personne"]].map(([v, t]) => `<button class="cs-qb" data-act="csGQuick" data-v="${v}">${t}</button>`).join("")}</div>` : "";
  const note = all ? "Tout le monde est dans ce groupe, les nouveaux aussi." : F.kind === "poste" ? `Les nouveaux en ${F.id === "salle" ? "salle ou au bar" : "cuisine, second ou plonge"} y entrent tout seuls. Touchez une personne pour l'ajouter ou la retirer.` : "Touchez une personne pour l'ajouter ou la retirer.";
  const sites = canSites ? `<div class="lbl">Restaurants</div><div class="glass pad cs-wl">${S.restos.map((r) => { const me = r.id === S.rid; const on = me || (F.sites || []).includes(r.id); return `<button class="cs-pr ${on ? "on" : ""}" role="switch" aria-checked="${on}" ${me ? "disabled" : ""} data-act="csGSite" data-v="${esc(r.id)}"><span class="cs-ava" style="--s:34px;--c:#F6B93B;color:#1B1530">${esc(initials(r.name || "R"))}</span><span><b>${esc(r.name || "Restaurant")}</b><em>${me ? "Ce restaurant" : on ? "Toute son équipe est dans le groupe" : "Pas dans ce groupe"}</em></span>${csSw(on, me)}</button>`; }).join("")}</div>` : "";
  return `<div class="cs-sheet">
    <div class="h2">${F.isNew ? "Nouveau groupe" : esc(F.name0 || F.name)}</div>
    <label class="field"><span>Nom du groupe</span><input class="input" id="csGName" maxlength="40" value="${esc(F.name || "")}" placeholder="Ex. : Ouverture du matin, Pâtisserie, Les deux restos"></label>
    ${sites}
    <div class="lbl">${multi ? "Dans ce restaurant" : "Membres"} · ${nIn}</div>
    <p class="sub cs-q0">${note}</p>
    ${quick}
    <div class="glass pad cs-wl">${ppl || `<p class="sub">Personne dans l'équipe pour l'instant.</p>`}</div>
    <button class="btn soft block" data-act="csAddPerson">${ico("plus")}Ajouter quelqu'un à l'équipe</button>
    <button class="btn acc block" data-act="csGSave">${ico("check")}${F.isNew ? "Créer le groupe" : "Enregistrer"}</button>
    ${!F.isNew && !all ? `<button class="btn danger block" data-act="csGDel">${ico("trash")}${F.builtin ? "Masquer ce groupe" : "Supprimer le groupe"}</button>` : ""}
    <button class="btn ghost block" data-act="${F.back ? "csManage" : "sheetClose"}">Annuler</button>
  </div>`;
}
function csGroupInfoSheet(g) {
  const P = csGMembers(g); const st = csSites(g).filter((x) => x.rid !== S.rid);
  return `<div class="cs-sheet"><div class="h2">${esc(g.name)}</div>
    <p class="sub cs-q0">${P.length} personne${P.length > 1 ? "s" : ""} ici${st.length ? `, plus l'équipe de ${st.map((x) => esc(x.name || csRestoName(x.rid))).join(", ")}` : ""}.</p>
    <div class="glass pad cs-wl">${P.map((p) => `<div class="li">${csAva(p.pid, p.name, p.color, 34)}<div class="tx"><b>${esc(p.name)}</b><em>${esc(csPosteLine(p))}</em></div></div>`).join("")}</div>
    <p class="sub cs-q0">Seul un gérant peut changer les membres d'un groupe.</p>
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`;
}
function csWritersSheet() {
  const M = []; const seen = new Set(); (S.members || []).forEach((m) => { if (!seen.has(m.id)) { seen.add(m.id); M.push(m); } });
  const rows = M.map((m) => { const gm = m.role === "gerant"; const on = csCanWriteP(m); const p = { pid: m.id, member: m }; return `<button class="cs-pr ${on ? "on" : ""}" role="switch" aria-checked="${on}" ${gm ? "disabled" : ""} data-act="csWr" data-v="${esc(m.id)}">${csAva(m.id, m.name, m.color, 34)}<span><b>${esc(m.name || "Sans nom")}</b><em>${gm ? "Gérant : toujours" : esc(csPosteLine(p))}</em></span>${csSw(on, gm)}</button>`; }).join("");
  return `<div class="cs-sheet"><div class="h2">Qui peut publier des consignes ?</div>
    <p class="sub cs-q0">Plat du jour, rupture, info. Les autres les lisent et touchent « Lu ».</p>
    <div class="glass pad cs-wl">${rows}</div>
    <button class="btn ghost block" data-act="csManage">Retour</button></div>`;
}
function csGOpen(id, back) {
  const g = id ? csGroup(id) : null;
  CS.GF = g ? { ...g, add: [...(g.add || [])], remove: [...(g.remove || [])], sites: csSites(g).map((x) => x.rid), name0: g.name, back }
    : { isNew: true, kind: "custom", name: "", add: [S.me.id], remove: [], sites: [S.rid], back, c: CS_GC[csGroups().filter((x) => !x.builtin).length % CS_GC.length], ic: "csChat" };
  if (!CS.GF.sites.length) CS.GF.sites = [S.rid];
  openSheet(csGroupSheet());
}
const csGKeepName = () => { const n = $("#csGName"); if (n && CS.GF) CS.GF.name = n.value; };

/* ───────── actions ───────── */
Object.assign(ACT, {
  csAud(el, id, v) { const F = CS.F; if (!F) return; const t = $("#csNewTx"); F.text = t ? t.value : F.text; const k = $("#csKeep"); if (k) F.keep = k.checked; F.g = v; SFX.tap(); buzz(4); openSheet(csNewSheet()); },
  csGroup(el, id, v) { csMicStop(); CS.g = v; SFX.tap(); buzz(4); rerender(); },
  csManage() { if (!csAdmin()) return; openSheet(csManageSheet()); },
  csGroupNew() { if (!csAdmin()) return; csGOpen(null, $("#sheet").classList.contains("open")); },
  csGroupEdit(el, id, v) { if (!csAdmin()) { const g = csGroup(v); if (g) openSheet(csGroupInfoSheet(g)); return; } csGOpen(v, $("#sheet").classList.contains("open")); },
  csGroupInfo(el, id, v) { const g = csGroup(v); if (g) openSheet(csGroupInfoSheet(g)); },
  csGP(el, id, pid) {
    const F = CS.GF; if (!F || F.kind === "all") return; csGKeepName(); const p = csTeam().find((t) => t.pid === pid); if (!p) return;
    const on = csIn(F, p), auto = csAuto(F, p);
    F.add = F.add.filter((x) => x !== pid); F.remove = F.remove.filter((x) => x !== pid);
    if (on && auto) F.remove.push(pid); else if (!on && !auto) F.add.push(pid);
    SFX.tick(); buzz(4); openSheet(csGroupSheet());
  },
  csGQuick(el, id, v) {
    const F = CS.GF; if (!F) return; csGKeepName(); const T = csTeam();
    const want = (p) => v === "*" ? true : v === "-" ? p.pid === S.me.id : csIsGerantP(p) || (v === "cuisine" ? ["cuisine", "second", "plonge"] : ["salle", "bar"]).includes(csPosteOf(p));
    F.add = []; F.remove = []; T.forEach((p) => { const a = csAuto(F, p), w = want(p); if (w && !a) F.add.push(p.pid); if (!w && a) F.remove.push(p.pid); });
    if (!F.name && v !== "*" && v !== "-") F.name = v === "cuisine" ? "Cuisine" : "Salle";
    SFX.tap(); buzz(4); openSheet(csGroupSheet());
  },
  csGSite(el, id, rid) { const F = CS.GF; if (!F || rid === S.rid) return; csGKeepName(); F.sites = F.sites.includes(rid) ? F.sites.filter((x) => x !== rid) : [...F.sites, rid]; if (!F.sites.includes(S.rid)) F.sites.unshift(S.rid);
    /* shared with other restaurants = everyone there; here, the same people as before the switch */
    if (!F.builtin) { const T = csTeam(); const k = F.sites.length > 1 ? "multi" : "custom"; if (k !== F.kind) { const was = T.filter((p) => csIn(F, p)).map((p) => p.pid); F.kind = k; F.add = k === "custom" ? was : []; F.remove = k === "multi" ? T.map((p) => p.pid).filter((x) => !was.includes(x)) : []; } }
    SFX.tick(); buzz(4); openSheet(csGroupSheet()); },
  async csGSave() {
    const F = CS.GF; if (!F) return; csGKeepName();
    const name = String(F.name || "").trim().slice(0, 40);
    if (!name) { SFX.err(); buzz([20, 40, 20]); const n = $("#csGName"); if (n) { n.focus(); n.classList.add("shake"); setTimeout(() => n.classList.remove("shake"), 500); } return; }
    const id = F.isNew ? "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : F.id;
    const base = { name, at: F.at || Date.now(), by: F.by || S.me.name || "", uid: F.uid || S.me.id, editedAt: Date.now() };
    const sites = F.kind === "poste" || F.kind === "all" ? [] : F.sites || [S.rid];
    const multi = sites.length > 1;
    const kind = F.builtin ? CS_GDEF[id].kind : multi ? "multi" : "custom";
    const siteList = sites.map((rid) => ({ rid, name: rid === S.rid ? (S.resto && S.resto.name) || "" : csRestoName(rid) }));
    const doc = { ...base, kind, add: F.add || [], remove: F.remove || [], ...(F.builtin ? {} : { c: F.c || "#0B9B6A", ic: multi ? "mrShare" : F.ic || "csChat" }), ...(multi ? { sites: siteList } : { sites: [] }) };
    const before = F.isNew ? [] : csSites(csGroup(id)).map((x) => x.rid).filter((r) => r !== S.rid);
    closeSheet(true); SFX.done(); buzz([10, 40, 10]);
    await DB.set("chatGroups", id, doc);
    /* the other restaurants of a shared group: the same group (their own added / removed people are kept) */
    if (multi) sites.filter((r) => r !== S.rid).forEach((rid) => csPutSite(rid, "chatGroups", id, { ...base, kind, c: doc.c, ic: doc.ic, sites: siteList }));
    before.filter((r) => !sites.includes(r)).forEach((rid) => csPutSite(rid, "chatGroups", id, null));
    logEvent("team", F.isNew ? `a créé le groupe « ${name} »` : `a modifié le groupe « ${name} »`);
    if (F.isNew) { CS.g = id; CS.tab = "chat"; }
    toast(F.isNew ? `Groupe « ${name} » créé` : "Groupe enregistré"); CS.GF = null;
    if (S.route !== "consignes") go("consignes"); else rerender();
  },
  async csGDel() {
    const F = CS.GF; if (!F || F.kind === "all") return; const g = csGroup(F.id); if (!g) return;
    closeSheet(true); SFX.ok();
    if (g.builtin) { const { id: _i, ...d0 } = csArr("groups").find((d) => d.id === g.id) || {}; await DB.set("chatGroups", g.id, { ...d0, name: g.name, off: true, editedAt: Date.now() }); }
    else { await DB.del("chatGroups", g.id); csSites(g).filter((x) => x.rid !== S.rid).forEach((x) => csPutSite(x.rid, "chatGroups", g.id, null)); }
    if (CS.g === g.id) CS.g = "tous"; CS.GF = null;
    logEvent("team", `a ${g.builtin ? "masqué" : "supprimé"} le groupe « ${g.name} »`);
    toast(g.builtin ? `« ${g.name} » est masqué` : `Groupe « ${g.name} » supprimé`); rerender();
  },
  async csGroupOn(el, id, v) { const d = csArr("groups").find((x) => x.id === v); if (d) { const { id: _i, ...rest } = d; await DB.set("chatGroups", v, { ...rest, off: false }); } SFX.ok(); openSheet(csManageSheet()); },
  csWriters() { if (!csAdmin()) return; openSheet(csWritersSheet()); },
  async csWr(el, id, mid) {
    if (!csAdmin()) return; const m = (S.members || []).find((x) => x.id === mid); if (!m || m.role === "gerant") return;
    const cur = csWriters() || (S.members || []).filter((x) => x.role === "chef").map((x) => x.id);
    const writers = cur.includes(mid) ? cur.filter((x) => x !== mid) : [...cur, mid];
    const csCfg = { ...((S.resto && S.resto.csCfg) || {}), writers };
    if (S.resto) S.resto.csCfg = csCfg; SFX.tick(); buzz(4); openSheet(csWritersSheet());
    await DB.update("restos", S.rid, { csCfg });
  },
  csAddPerson() { closeSheet(true); if (window.PERMS && PERMS.flow) PERMS.flow({ from: "consignes" }); else go("equipe"); },
  csTeamPage() { closeSheet(true); go("equipe"); },
  csTab(el, id, v) { csMicStop(); CS.tab = v === "chat" ? "chat" : "consignes"; SFX.tap(); buzz(4); rerender(); },
  csNew(el, id, v) { CS.F = { kind: CS_K[v] ? v : "info", text: "", keep: v === "rupture", g: "tous" }; openSheet(csNewSheet(), (b) => { const t = $("#csNewTx", b); if (t) setTimeout(() => { try { t.focus(); } catch (e) {} }, 280); }); },
  csKind(el, id, v) { const F = CS.F; if (!F) return; const t = $("#csNewTx"); F.text = t ? t.value : F.text; const was = F.kind; F.kind = v; if (was !== v) F.keep = v === "rupture" ? true : $("#csKeep") && was !== "rupture" ? $("#csKeep").checked : false; SFX.tap(); openSheet(csNewSheet()); },
  async csPublish() {
    const t = $("#csNewTx"); const text = (t ? t.value : "").trim(); const F = CS.F || { kind: "info" };
    if (!text) { SFX.err(); buzz([20, 40, 20]); if (t) { t.focus(); t.classList.add("shake"); setTimeout(() => t.classList.remove("shake"), 500); } return; }
    csMicStop(); const keep = !!($("#csKeep") && $("#csKeep").checked);
    const doc = { kind: F.kind, text, day: csToday(), keep, at: Date.now(), uid: S.me.id, by: S.me.name || "", ...(F.g && F.g !== "tous" && csGroup(F.g) ? { g: F.g } : {}) };
    closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst();
    const id = await DB.add("consignes", doc); CS.F = null;
    logEvent("note", `a publié une consigne : ${CS_K[F.kind][0].toLowerCase()}`);
    toast("Envoyé à l'équipe"); csNotify("consigne", id);
    if (csPushOn() && csPushState() === "default") S.ui.csPushShow = true;
  },
  async csRead(el, id) {
    if (el) { el.classList.add("on"); el.disabled = true; }
    SFX.ok(); buzz(8); await csMark(id, S.me.id, S.me.name);
    if (!csUnreadC()) { setTimeout(() => { SFX.done(); toast("Tout est lu, merci !"); }, 120); }
  },
  async csReadAll() {
    const L = csList().filter((c) => !csMine(c) && !csReadBy(c.id, S.me.id)); if (!L.length) return;
    SFX.done(); buzz([10, 40, 10]); burst(); await Promise.all(L.map((c) => csMark(c.id, S.me.id, S.me.name)));
    toast(L.length > 1 ? `${L.length} consignes lues, merci !` : "Consigne lue, merci !");
  },
  csReadFor(el, id, pid) { const p = csTeam().find((t) => t.pid === pid); if (!p) return; SFX.ok(); csMark(id, pid, p.name).then(() => { const c = csArr("consignes").find((x) => x.id === id); if (c) openSheet(csWhoSheet(c)); }); },
  csWho(el, id) { const c = csArr("consignes").find((x) => x.id === id); if (c) openSheet(csWhoSheet(c)); },
  async csEnd(el, id) { const c = csArr("consignes").find((x) => x.id === id); if (!c) return; SFX.done(); buzz(8); await DB.update("consignes", id, { endedAt: Date.now(), endedBy: S.me.name || "" }); toastUndo(`« ${c.text.slice(0, 40)} » est de retour`); S.ui.undo = async () => { await DB.update("consignes", id, { endedAt: null }); }; },
  csMenu(el, id) {
    const c = csArr("consignes").find((x) => x.id === id); if (!c) return;
    openSheet(`<div class="cs-sheet"><div class="h2">${CS_K[c.kind] ? CS_K[c.kind][0] : "Consigne"}</div><p class="sub cs-q">« ${esc(c.text)} »</p>
      <button class="btn soft block" data-act="csWho" data-id="${c.id}">${ico("csEye")}Qui a lu ?</button>
      ${c.keep ? `<button class="btn soft block" data-act="csStop" data-id="${c.id}">${ico("check")}Ne plus afficher</button>` : ""}
      <button class="btn danger block" data-act="csDel" data-id="${c.id}">${ico("trash")}Supprimer</button>
      <button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
  },
  async csStop(el, id) { closeSheet(true); await DB.update("consignes", id, { endedAt: Date.now(), endedBy: S.me.name || "" }); SFX.ok(); toast("Consigne retirée"); },
  async csDel(el, id) {
    const c = csArr("consignes").find((x) => x.id === id); if (!c) return; closeSheet(true);
    await DB.del("consignes", id); SFX.ok(); toastUndo("Consigne supprimée");
    S.ui.undo = async () => { const { id: _x, ...rest } = c; await DB.set("consignes", id, rest); };
  },
  csKiosk() { CS.kiosk = null; openSheet(csKioskSheet()); },
  csKioskWho(el, id, pid) { const p = csTeam().find((t) => t.pid === pid); if (!p) return; SFX.tap(); if (!csPinOf(p)) { csKioskRead(pid); return; } CS.kiosk = { pid, code: "", err: "" }; openSheet(csKioskSheet()); },
  csKey(el, id, v) {
    const P = CS.kiosk; if (!P || !P.pid) return; buzz(4);
    if (v === "⌫") { P.code = (P.code || "").slice(0, -1); P.err = ""; openSheet(csKioskSheet()); return; }
    P.code = ((P.code || "") + v).slice(0, 4); SFX.tick();
    if (P.code.length < 4) { openSheet(csKioskSheet()); return; }
    const p = csTeam().find((t) => t.pid === P.pid);
    if (p && csPinCheck(p, P.code)) { csKioskRead(P.pid); return; }
    SFX.err(); buzz([20, 40, 20]); P.code = ""; P.err = "Code incorrect, réessayez"; openSheet(csKioskSheet());
  },
  async csSend() {
    const t = $("#csChatTx"); const text = (t ? t.value : "").trim();
    if (!text) { SFX.err(); if (t) t.focus(); return; }
    const g = csCurG(); const gid = g ? g.id : "tous";
    csMicStop(); if (t) { t.value = ""; t.blur(); } (S.ui.csDrafts ||= {})[gid] = ""; S.ui.csFocus = true;
    SFX.ok(); buzz(6);
    const msg = { text, at: Date.now(), uid: S.me.id, by: S.me.name || "", ...(gid !== "tous" ? { g: gid } : {}) };
    const id = await DB.add("chat", msg);
    /* a group shared with other restaurants: the message goes there too (the server does it for the restaurants I do not belong to) */
    const from = { rid: S.rid, name: (S.resto && S.resto.name) || "" };
    csSites(g).filter((x) => x.rid !== S.rid && (S.restos || []).some((r) => r.id === x.rid)).forEach((x) => csPutSite(x.rid, "chat", id, { ...msg, from }));
    csNotify("chat", id); refresh(true);
  },
  async csDelMsg(el, id) { const m = csArr("chat").find((x) => x.id === id); if (!m) return; await DB.del("chat", id);
    const mg = m.g ? csGroup(m.g) : null; csSites(mg).filter((x) => x.rid !== S.rid && (S.restos || []).some((r) => r.id === x.rid)).forEach((x) => csPutSite(x.rid, "chat", id, null)); SFX.ok(); toastUndo("Message supprimé"); S.ui.undo = async () => { const { id: _x, ...rest } = m; await DB.set("chat", id, rest); }; },
  async csPush() {
    const ok = await csPushRegister(true); S.ui.csPushShow = false;
    if (ok) { SFX.done(); toast("C'est activé : ce téléphone sonnera à chaque nouvelle consigne."); }
    else if (csPushState() === "denied") { SFX.err(); toast("Les notifications sont bloquées dans les réglages du téléphone.", "err"); }
    else { SFX.err(); toast(/iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone ? "Sur iPhone : ajoutez d'abord l'app à l'écran d'accueil." : "Impossible d'activer les notifications ici.", "err"); }
    rerender();
  },
  csMic(el, id, target) {
    const SR = csSR(); if (!SR) return;
    if (CS.rec) { csMicStop(); return; }
    const ta = document.getElementById(target); if (!ta) return;
    const r = new SR(); r.lang = "fr-FR"; r.interimResults = true; r.continuous = true;
    const base = ta.value ? ta.value.replace(/\s*$/, " ") : ""; let finalTx = "";
    r.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const tx = e.results[i][0].transcript; if (e.results[i].isFinal) finalTx += tx; else interim += tx; } let v = (base + finalTx + interim).replace(/\s+/g, " ").trimStart(); v = v.charAt(0).toUpperCase() + v.slice(1); ta.value = v; if (target === "csChatTx") (S.ui.csDrafts ||= {})[CS.g || "tous"] = v; };
    r.onerror = (e) => { csMicStop(); if (e && e.error === "not-allowed") toast("Autorisez le micro pour dicter.", "err"); };
    r.onend = () => { if (CS.rec === r) csMicStop(); };
    try { r.start(); CS.rec = r; el.classList.add("on"); SFX.tap(); buzz(8); } catch (e) { CS.rec = null; }
  },
});

/* a notification tap opens the app on #consignes */
try { if (location.hash === "#consignes") window.addEventListener("gg:ready", () => setTimeout(() => { try { go("consignes"); } catch (e) {} }, 300), { once: true }); } catch (e) {}
try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.gg === "open" && /consignes/.test(e.data.url || "")) { try { go("consignes"); } catch (x) {} } }); } catch (e) {}
