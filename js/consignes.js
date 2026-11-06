/* Growth Gusto — area: consignes (route « consignes »). Prefix « cs ».
   What the team must know today, and a simple team wall. Hyper simple on purpose:
     · Consignes: three kinds, « Plat du jour », « Rupture » (plus de…), « Info ». A gérant or a chef writes one in two taps (or dictates it).
       Each person taps « Lu » ; the writer sees who read it and who has not yet. A rupture stays until someone taps « De retour ».
     · Discussion: one wall for the whole team, newest first. Everyone can write, dictate, read.
   Data (restos/{rid}/…, members only, see firestore.rules):
     consignes/{id} { kind:"plat"|"rupture"|"info", text, day:"YYYY-MM-DD", keep:bool, endedAt?, endedBy?, at, uid, by }
     csReads/{cid~pid} { cid, pid, name, at }      pid = member id, or "st:<staffId>" for a staff file without an account
     chat/{id} { text, at, uid, by }
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
(function csNav() { if (NAV.some((n) => n[0] === "consignes")) return; const i = NAV.findIndex((n) => n[0] === "pointeuse"); NAV.splice(i >= 0 ? i : NAV.length, 0, ["consignes", "csMega", "Consignes & messages"]); })();

/* [label, icon, colour class, placeholder] */
const CS_K = {
  plat: ["Plat du jour", "csPlate", "plat", "Ex. : Blanquette de veau, riz pilaf · 16 €"],
  rupture: ["Rupture", "csOff", "rupt", "Ex. : Plus de bar, plus de tarte tatin"],
  info: ["Info", "csInfo", "info", "Ex. : Livraison Metro à 10 h, contrôle hygiène jeudi"],
};
const CS_ORDER = ["plat", "rupture", "info"];
const CS = { rid: null, subs: {}, consignes: null, reads: null, chat: null, tab: "consignes", F: null, rec: null, notified: {} };
const CS_COLS = [["consignes", "consignes", { order: "at", dir: "desc", limit: 200 }], ["reads", "csReads", {}], ["chat", "chat", { order: "at", dir: "desc", limit: 120 }]];

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
function csList() { return csArr("consignes").filter(csLive).sort((a, b) => CS_ORDER.indexOf(a.kind) - CS_ORDER.indexOf(b.kind) || b.at - a.at); }
const csCanWrite = () => { const r = myRole(); return r === "gerant" || r === "chef" || DB.mode === "local"; };
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
function csUnreadC() { if (!S.rid) return 0; return csList().filter((c) => !csMine(c) && !csReadBy(c.id, S.me.id)).length; }
const csSeenKey = () => `gg-chat-seen-${S.rid}-${S.me.id}`;
function csChatSeen() { try { return +localStorage.getItem(csSeenKey()) || 0; } catch (e) { return 0; } }
function csChatNew() { if (!S.rid) return 0; const t = csChatSeen(); return csArr("chat").filter((m) => m.at > t && m.uid !== S.me.id).length; }
function csUnread() { try { return csUnreadC() + csChatNew(); } catch (e) { return 0; } }

/* something new from someone else while the app is open: a soft sound, a toast, a system notification if the tab is hidden */
function csPing(k, prev, rows) {
  if (k === "reads" || !prev) return;
  const ids = new Set(prev.map((x) => x.id));
  const fresh = rows.filter((x) => !ids.has(x.id) && x.uid !== S.me.id && Date.now() - (x.at || 0) < 120000 && !CS.notified[x.id]);
  if (!fresh.length) return;
  fresh.forEach((x) => (CS.notified[x.id] = 1));
  const x = fresh[0]; const who = firstName(x.by || nameOf(x.uid));
  const title = k === "consignes" ? `${CS_K[x.kind] ? CS_K[x.kind][0] : "Consigne"} · ${who}` : `${who} a écrit`;
  if (document.hidden) { csNotifyLocal(title, x.text); return; }
  if (S.route === "consignes" && ((k === "chat" && CS.tab === "chat") || (k === "consignes" && CS.tab === "consignes"))) { SFX.tick(); return; }
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
  const team = csTeam().filter((p) => p.pid !== c.uid); const rd = csReadersOf(c.id).filter((r) => r.pid !== c.uid);
  const showWho = mine || csCanWrite();
  const old = c.day !== csToday() ? ` · depuis ${c.day === dayKey(new Date(Date.now() - 864e5)) ? "hier" : shortDate(c.day)}` : "";
  return `<article class="cs-card ${K[2]} ${read || mine ? "" : "new"} st" style="--i:${i}">
    <div class="cs-ch"><span class="cs-k">${ico(K[1])}${K[0]}</span><span class="cs-by">${esc(firstName(c.by || nameOf(c.uid)))} · ${hm(c.at)}${old}</span></div>
    <p class="cs-tx">${esc(c.text)}</p>
    ${showWho ? `<button class="cs-who" data-act="csWho" data-id="${c.id}" aria-label="Qui a lu">${rd.slice(0, 5).map((r) => { const p = team.find((t) => t.pid === r.pid); return csAva(r.pid, r.name, p && p.color, 24); }).join("")}<span>${team.length ? (rd.length >= team.length ? "Lu par toute l'équipe" : `Lu par ${rd.length} / ${team.length}`) : "Personne d'autre dans l'équipe"}</span>${ico("chev")}</button>` : ""}
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
  return write + allRead + `<div class="cs-list">${body}</div>` + kiosk;
}
function csChatHTML(k0) {
  let k = k0; const M = csArr("chat"); const seen = csChatSeen();
  const comp = `<div class="glass cs-comp st" style="--i:${k++}"><textarea class="input cs-ta" id="csChatTx" rows="2" maxlength="1000" placeholder="Écrire à toute l'équipe…" aria-label="Message">${esc(S.ui.csDraft || "")}</textarea>
    <div class="cs-cb">${csMicBtn("csChatTx")}<button class="btn acc sm cs-send" data-act="csSend">${ico("csSend")}Envoyer</button></div></div>`;
  let lastDay = ""; const rows = M.map((m) => {
    const d = dayKey(new Date(m.at)); const sep = d !== lastDay ? `<div class="cs-day">${d === csToday() ? "Aujourd'hui" : d === dayKey(new Date(Date.now() - 864e5)) ? "Hier" : shortDate(d)}</div>` : ""; lastDay = d;
    const me = m.uid === S.me.id; const p = (S.members || []).find((x) => x.id === m.uid);
    return `${sep}<div class="cs-msg ${me ? "me" : ""} ${!me && m.at > seen ? "new" : ""}">${me ? "" : csAva(m.uid, m.by || nameOf(m.uid), p && p.color, 32)}<div class="cs-bub"><span class="cs-mh"><b>${me ? "Vous" : esc(firstName(m.by || nameOf(m.uid)))}</b><em>${hm(m.at)}</em></span><p>${esc(m.text)}</p></div>${me ? `<button class="cs-mdel" data-act="csDelMsg" data-id="${m.id}" aria-label="Supprimer">${ico("trash")}</button>` : ""}</div>`;
  }).join("");
  return comp + (M.length ? `<div class="glass pad cs-wall st" style="--i:${k++}">${rows}</div>` : `<div class="glass empty st" style="--i:${k++}"><div class="ic">${ico("csChat")}</div><b>Pas encore de message</b>Un mot pour toute l'équipe : un changement d'horaire, un merci, une question.</div>`);
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
    return `<div class="inner narrow cs">${topBar("Consignes & messages")}
      <p class="sub cs-date st" style="--i:1">${DAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase())} ${d.getDate()} ${MONTHS[d.getMonth()]}</p>
      ${seg}${csPushCard(2)}
      ${tab === "chat" ? csChatHTML(3) : csConsignesHTML(3)}
    </div>`;
  },
  after() {
    if (CS.tab === "chat") { const n = csArr("chat").find((m) => m.uid !== S.me.id); const top = Math.max(n ? n.at : 0, csChatSeen()); if (top > csChatSeen()) { try { localStorage.setItem(csSeenKey(), String(top)); } catch (e) {} setTimeout(() => renderChrome(), 0); } }
    const ta = $("#csChatTx"); if (ta) { ta.addEventListener("input", () => { S.ui.csDraft = ta.value; }); if (S.ui.csFocus) { S.ui.csFocus = false; try { ta.focus({ preventScroll: true }); } catch (e) {} } }
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
function csNewSheet() {
  const F = CS.F; const K = CS_K[F.kind];
  return `<div class="cs-sheet">
    <div class="h2">Nouvelle consigne</div>
    <div class="cs-kinds">${CS_ORDER.map((kd) => `<button class="cs-nb ${CS_K[kd][2]} ${F.kind === kd ? "on" : ""}" data-act="csKind" data-v="${kd}">${ico(CS_K[kd][1])}<span>${CS_K[kd][0]}</span></button>`).join("")}</div>
    <textarea class="input cs-ta" id="csNewTx" rows="3" maxlength="600" placeholder="${esc(K[3])}" aria-label="Texte de la consigne">${esc(F.text || "")}</textarea>
    <div class="cs-cb">${csMicBtn("csNewTx")}<label class="cs-keep"><input type="checkbox" id="csKeep" ${F.keep ? "checked" : ""}><span>${F.kind === "rupture" ? "Jusqu'à « De retour »" : "Garder les jours suivants"}</span></label></div>
    <button class="btn acc block" data-act="csPublish">${ico("csSend")}Envoyer à l'équipe</button>
    <button class="btn ghost block" data-act="sheetClose">Annuler</button>
  </div>`;
}
function csWhoSheet(c) {
  const team = csTeam().filter((p) => p.pid !== c.uid); const rd = csReadersOf(c.id);
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
    <div class="cs-ppl">${team.map((p) => { const left = L.filter((c) => c.uid !== p.pid && !csReadBy(c.id, p.pid)).length; return `<button class="cs-pp ${left ? "" : "ok"}" data-act="csKioskWho" data-v="${esc(p.pid)}">${csAva(p.pid, p.name, p.color, 46)}<b>${esc(firstName(p.name))}</b><em>${left ? `${left} à lire` : "Tout lu"}</em></button>`; }).join("")}</div>
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`;
}
function csKioskRead(pid) {
  const p = csTeam().find((t) => t.pid === pid); if (!p) return;
  const L = csList(); L.forEach((c) => { if (c.uid !== pid && !csReadBy(c.id, pid)) csMark(c.id, pid, p.name); });
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

/* ───────── actions ───────── */
Object.assign(ACT, {
  csTab(el, id, v) { csMicStop(); CS.tab = v === "chat" ? "chat" : "consignes"; SFX.tap(); buzz(4); rerender(); },
  csNew(el, id, v) { CS.F = { kind: CS_K[v] ? v : "info", text: "", keep: v === "rupture" }; openSheet(csNewSheet(), (b) => { const t = $("#csNewTx", b); if (t) setTimeout(() => { try { t.focus(); } catch (e) {} }, 280); }); },
  csKind(el, id, v) { const F = CS.F; if (!F) return; const t = $("#csNewTx"); F.text = t ? t.value : F.text; const was = F.kind; F.kind = v; if (was !== v) F.keep = v === "rupture" ? true : $("#csKeep") && was !== "rupture" ? $("#csKeep").checked : false; SFX.tap(); openSheet(csNewSheet()); },
  async csPublish() {
    const t = $("#csNewTx"); const text = (t ? t.value : "").trim(); const F = CS.F || { kind: "info" };
    if (!text) { SFX.err(); buzz([20, 40, 20]); if (t) { t.focus(); t.classList.add("shake"); setTimeout(() => t.classList.remove("shake"), 500); } return; }
    csMicStop(); const keep = !!($("#csKeep") && $("#csKeep").checked);
    const doc = { kind: F.kind, text, day: csToday(), keep, at: Date.now(), uid: S.me.id, by: S.me.name || "" };
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
    csMicStop(); if (t) { t.value = ""; t.blur(); } S.ui.csDraft = ""; S.ui.csFocus = true;
    SFX.ok(); buzz(6);
    const id = await DB.add("chat", { text, at: Date.now(), uid: S.me.id, by: S.me.name || "" });
    csNotify("chat", id); refresh(true);
  },
  async csDelMsg(el, id) { const m = csArr("chat").find((x) => x.id === id); if (!m) return; await DB.del("chat", id); SFX.ok(); toastUndo("Message supprimé"); S.ui.undo = async () => { const { id: _x, ...rest } = m; await DB.set("chat", id, rest); }; },
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
    r.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const tx = e.results[i][0].transcript; if (e.results[i].isFinal) finalTx += tx; else interim += tx; } let v = (base + finalTx + interim).replace(/\s+/g, " ").trimStart(); v = v.charAt(0).toUpperCase() + v.slice(1); ta.value = v; if (target === "csChatTx") S.ui.csDraft = v; };
    r.onerror = (e) => { csMicStop(); if (e && e.error === "not-allowed") toast("Autorisez le micro pour dicter.", "err"); };
    r.onend = () => { if (CS.rec === r) csMicStop(); };
    try { r.start(); CS.rec = r; el.classList.add("on"); SFX.tap(); buzz(8); } catch (e) { CS.rec = null; }
  },
});

/* a notification tap opens the app on #consignes */
try { if (location.hash === "#consignes") window.addEventListener("gg:ready", () => setTimeout(() => { try { go("consignes"); } catch (e) {} }, 300), { once: true }); } catch (e) {}
try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.gg === "open" && /consignes/.test(e.data.url || "")) { try { go("consignes"); } catch (x) {} } }); } catch (e) {}
