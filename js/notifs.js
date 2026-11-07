/* Growth Gusto — area: notifications par rôle (route « notifs », NAV Équipe). Prefix « pu ».
   Each person gets what concerns their job: the kitchen « Table 4 envoyée », the waiter « Table 4 prête », the boss the takings of the
   service and the fridge alerts. Each person changes theirs, for the whole account or for one device (a phone can ring for everything,
   the computer of the office only for the takings).
   Data:
     restos/{rid}/push/{memberId}  (own doc only, firestore.rules)
       tokens:[…]                                  every device token (kept for functions/src/equipe.js)
       devs:{ <devId>: { t, name, at, kinds?:{k:bool}, mute? } }   one entry per device; kinds = this device's own list (else the account's)
       prefs:{ kinds:{k:bool}, readyAll, ca:"both"|"midi"|"soir", quiet:{on,from,to}, shiftOnly }
     restos/{rid}/notifs/{id}      a notification asked by the app (« Envoyer un essai »), sent then deleted by the server
   Sending: functions/src/notifs.js (Firestore triggers on tickets, tables, alerts, bookings; the 15-min job for the takings),
   delivered by Firebase Cloud Messaging (free), shown by sw.js. Defaults per role: PU_DEF here = DEF there.
   App open: sw.js hands the push to the page, which shows it as a banner at the top (puBanner) instead of a system notification.
   Demo: nothing leaves the device. Tickets sent, ready, claimed… in the demo ring the person chosen in « Voir comme » as banners,
   with the same rules as the server; the lock-screen preview plays the person's notifications.
   Limits (said on the screen): iPhone and iPad need iOS 16.4 or later and the app added to the home screen; a computer rings while
   the browser runs; a Focus mode or « Ne pas déranger » on the phone holds them back. */
"use strict";

TAB_OF.notifs = "more";
(function puNav() { if (NAV.some((n) => n[0] === "notifs")) return; const i = NAV.findIndex((n) => n[0] === "consignes"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["notifs", "puBell", "Notifications"]); })();
Object.assign(IC, {
  puBell: ["M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z", "f:M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z", "M10.2 20.5a2 2 0 0 0 3.6 0", "M19.5 3.5a7 7 0 0 1 2 4", "M4.5 3.5a7 7 0 0 0-2 4"],
  puPhone: ["r:6.5,2.5,11,19,2.6", "f:M8.5 2.5h7a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z", "M10.5 18.5h3"],
  puTablet: ["r:3.5,3,17,18,2.6", "f:M6 3h12a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21H6a2.5 2.5 0 0 1-2.5-2.5v-13A2.5 2.5 0 0 1 6 3z", "M11 18h2"],
  puLaptop: ["r:4,4.5,16,11,1.8", "f:M5.8 4.5h12.4A1.8 1.8 0 0 1 20 6.3v9.2H4V6.3a1.8 1.8 0 0 1 1.8-1.8z", "M2 19h20", "M2.5 19l1.5-3.5h16l1.5 3.5"],
  puGift: ["r:3.5,8,17,4,1.2", "M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12", "f:M5 12h14v7.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z", "M12 8v12.5", "M12 8S10.5 3.5 8 3.5A2.2 2.2 0 0 0 8 8", "M12 8s1.5-4.5 4-4.5A2.2 2.2 0 0 1 16 8"],
  puEuro: ["c:12,12,9", "f:M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z", "M15.5 8.6A4 4 0 0 0 9 10.5v3a4 4 0 0 0 6.5 1.9", "M7.5 11h5", "M7.5 13.5h5"],
  puMoon: ["f:M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z", "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  puSpark: ["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "m5.6 5.6 2.1 2.1", "m16.3 16.3 2.1 2.1", "m5.6 18.4 2.1-2.1", "m16.3 7.7 2.1-2.1", "c:12,12,2.5"],
  puPlay: ["c:12,12,9", "f:M10 8.5v7l6-3.5z", "M10 8.5v7l6-3.5z"],
});

/* [id, group, icon, well, title, what it is] */
const PU_KINDS = [
  ["k_new", "cuisine", "slHat", "w-to", "Nouveau bon", "Une table envoyée, une commande QR ou à emporter"],
  ["k_rush", "cuisine", "slFire", "bad", "Table qui réclame", "Le serveur relance une table qui attend"],
  ["k_mod", "cuisine", "slRedo", "warn", "Bon modifié ou annulé", "Une ligne changée ou retirée après l'envoi"],
  ["b_new", "bar", "pmGlass", "w-sk", "Boissons à préparer", "Les bons qui partent au bar"],
  ["s_ready", "salle", "cmBell", "w-mi", "Plat prêt", "La cuisine a fini une table"],
  ["s_call", "salle", "slCall", "bad", "La cuisine m'appelle", "Un plat prêt attend depuis trop longtemps"],
  ["qr", "salle", "cmQr", "w-vi", "Commande en ligne", "QR à table et à emporter"],
  ["resa", "salle", "resa", "w-in", "Réservation", "Nouvelle réservation, demande à valider, annulation"],
  ["ca", "patron", "puEuro", "ok", "Chiffre du service", "À la fin du midi et du soir"],
  ["haccp", "patron", "therm", "bad", "Alertes frigos et hygiène", "Température, relevé oublié, DLC, sondes"],
  ["geste", "patron", "puGift", "w-sa", "Offerts et annulations", "Un plat offert ou annulé après l'envoi"],
  ["consigne", "equipe", "csMega", "w-vi", "Consignes", "Plat du jour, rupture, info"],
  ["chat", "equipe", "csChat", "w-sk", "Discussion", "Les messages de vos groupes"],
];
const PU_K = Object.fromEntries(PU_KINDS.map((k) => [k[0], k]));
const PU_GROUPS = [["cuisine", "En cuisine"], ["bar", "Au bar"], ["salle", "En salle"], ["patron", "Pour le patron"], ["equipe", "Toute l'équipe"]];
/* same table as DEF in functions/src/notifs.js */
const PU_DEF = {
  patron: ["qr", "resa", "ca", "haccp", "geste", "consigne", "chat"],
  chef: ["k_new", "k_rush", "k_mod", "haccp", "consigne", "chat"],
  cuisine: ["k_new", "k_rush", "k_mod", "consigne", "chat"],
  salle: ["s_ready", "s_call", "qr", "resa", "consigne", "chat"],
  bar: ["b_new", "s_ready", "s_call", "consigne", "chat"],
  plonge: ["consigne", "chat"],
};
/* the four presets shown as cards: [profile, icon, title, line] */
const PU_PRESETS = [["cuisine", "pmToque", "Cuisine", "Les bons, ce qui est réclamé, ce qui change"], ["salle", "pmCloche", "Salle", "Plats prêts, commandes en ligne, résas"], ["bar", "pmGlass", "Bar", "Les boissons à préparer, les plats prêts"], ["patron", "puEuro", "Patron", "Le chiffre, les alertes, les gestes"]];
const PU_POSTE = { cuisine: "cuisine", second: "cuisine", salle: "salle", bar: "bar", plonge: "plonge" };
const PU = { doc: null, rid: null, mid: null, un: null, mem: {}, demo: { rid: null, st: new Map(), tabs: new Map(), init: false, log: [] }, log: [], logAt: 0, phoneT: null, play: null, scope: "all", busy: false };

/* ───────── who am I ───────── */
function puMember(mid = S.me.id) { return (S.members || []).find((m) => m.id === mid) || null; }
function puProfile(mid = S.me.id) {
  const m = puMember(mid); if (!m) return S.isOwner ? "patron" : "cuisine";
  if (m.role === "gerant") return "patron";
  if (m.role === "chef") return "chef";
  const st = (S.staff || []).find((s) => s.memberId === mid);
  return PU_POSTE[m.poste || (st && st.post) || ""] || "cuisine";
}
const puProfileT = (p) => ({ patron: "Patron", chef: "Chef", cuisine: "Cuisine", salle: "Salle", bar: "Bar", plonge: "Plonge" }[p] || "Équipe");

/* ───────── device ───────── */
function puDevId() {
  let v = ""; try { v = localStorage.getItem("gg-pu-dev") || ""; } catch (e) {}
  if (!/^[a-z0-9]{8,16}$/.test(v)) { v = "d" + Math.random().toString(36).slice(2, 11); try { localStorage.setItem("gg-pu-dev", v); } catch (e) {} }
  return v;
}
function puDevKind(ua = navigator.userAgent) {
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (/iPhone|iPod/.test(ua)) return { k: "phone", t: "iPhone", ios: true };
  if (ipad) return { k: "tablet", t: "iPad", ios: true };
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? { k: "phone", t: "Téléphone Android" } : { k: "tablet", t: "Tablette Android" };
  if (/Macintosh|Mac OS X/.test(ua)) return { k: "laptop", t: "Mac" };
  if (/Windows/.test(ua)) return { k: "laptop", t: "PC" };
  return { k: "laptop", t: "Ordinateur" };
}
const puDevIc = (k) => (k === "phone" ? "puPhone" : k === "tablet" ? "puTablet" : "puLaptop");
const puStandalone = () => { try { return matchMedia("(display-mode: standalone)").matches || !!navigator.standalone; } catch (e) { return false; } };
const puPerm = () => { try { return "Notification" in window ? Notification.permission : "none"; } catch (e) { return "none"; } };
/* what this device can do: demo | local | ios-home | none | denied | off | ready (allowed but not on this account) | on */
function puSupport() {
  if (DB.mode === "demo") return "demo";
  if (DB.mode !== "db" || !DB.uid) return "local";
  const d = puDevKind();
  if (d.ios && !puStandalone()) return "ios-home";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return d.ios ? "ios-old" : "none";
  const p = puPerm(); if (p === "denied") return "denied"; if (p !== "granted") return "off";
  return puMyDev() ? "on" : "ready";
}

/* ───────── my settings (own push doc; demo and local: on this device) ───────── */
const puLsKey = () => `gg-pu-${S.rid}-${S.me.id}`;
function puWatchDoc() {
  if (!S.rid || !S.me.id) return;
  if (PU.rid === S.rid && PU.mid === S.me.id) return;
  if (PU.un) { try { PU.un(); } catch (e) {} PU.un = null; }
  PU.rid = S.rid; PU.mid = S.me.id; PU.doc = null;
  if (DB.mode === "db" && DB.db) {
    const rid = S.rid, mid = S.me.id;
    try { PU.un = DB.db.doc(`restos/${rid}/push/${mid}`).onSnapshot((s) => { if (PU.rid !== rid || PU.mid !== mid) return; PU.doc = s.exists ? s.data() || {} : {}; if (S.route === "notifs") puPaint(); }, () => { PU.doc = PU.doc || {}; }); } catch (e) { PU.doc = {}; }
  } else if (DB.mode === "demo") { PU.doc = PU.mem[S.me.id] || {}; }
  else { try { PU.doc = JSON.parse(localStorage.getItem(puLsKey()) || "{}") || {}; } catch (e) { PU.doc = {}; } }
}
const puDoc = () => { puWatchDoc(); return PU.doc || {}; };
const puPrefs = () => { const p = puDoc().prefs || {}; return { kinds: p.kinds || {}, readyAll: !!p.readyAll, ca: p.ca || "both", quiet: Object.assign({ on: false, from: "23:30", to: "08:00" }, p.quiet || {}), shiftOnly: !!p.shiftOnly }; };
const puMyDev = () => ((puDoc().devs || {})[puDevId()] || null);
async function puWrite(patch, fields) {
  const d = puDoc();
  if (DB.mode === "db" && DB.db) {
    Object.assign(d, patch); PU.doc = d;
    await DB.db.doc(`restos/${S.rid}/push/${S.me.id}`).set({ ...patch, at: Date.now() }, { mergeFields: [...fields, "at"] });
    return;
  }
  Object.assign(d, patch); PU.doc = d;
  if (DB.mode === "demo") PU.mem[S.me.id] = d; else { try { localStorage.setItem(puLsKey(), JSON.stringify(d)); } catch (e) {} }
}
const puSavePrefs = (p) => puWrite({ prefs: p }, ["prefs"]).catch((e) => { console.warn("notifs", e); toast("Pas enregistré, réessayez.", "err"); });
function puSaveDev(dev) {
  const id = puDevId(); const devs = { ...(puDoc().devs || {}), [id]: dev };
  if (DB.mode === "db") return puWrite({ devs }, [`devs.${id}`]).catch((e) => { console.warn("notifs", e); toast("Pas enregistré, réessayez.", "err"); });
  return puWrite({ devs }, ["devs"]);
}

/* is a kind on, for the account (scope all) or on this device (scope dev) */
function puAccountOn(k, prof = puProfile()) { const p = puPrefs().kinds; return typeof p[k] === "boolean" ? p[k] : PU_DEF[prof].includes(k); }
function puDevOn(k) { const d = puMyDev(); if (d && d.mute) return false; if (d && d.kinds && typeof d.kinds[k] === "boolean") return d.kinds[k]; return puAccountOn(k); }
/* the kinds this person sees on the screen: the ones of their job first, then « Autres » */
function puVisibleGroups(prof = puProfile()) {
  const mine = new Set(PU_DEF[prof]);
  return PU_GROUPS.map(([g, t]) => [g, t, PU_KINDS.filter((k) => k[1] === g)]).filter(([, , L]) => L.length).sort((a, b) => b[2].filter((k) => mine.has(k[0])).length - a[2].filter((k) => mine.has(k[0])).length);
}

/* ───────── register this device (Firebase Cloud Messaging) ───────── */
async function puRegister(ask) {
  if (DB.mode !== "db" || !DB.uid || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  if (puPerm() === "default" && ask) { try { await Notification.requestPermission(); } catch (e) {} }
  if (puPerm() !== "granted") return false;
  try {
    if (!(window.firebase && firebase.messaging)) { if (typeof AUTH === "undefined" || !AUTH.script) return false; await AUTH.script(AU_SDK_BASE + "firebase-messaging-compat.js"); }
    const reg = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ serviceWorkerRegistration: reg });
    if (!token) return false;
    const id = puDevId(); const dk = puDevKind(); const cur = puMyDev();
    let last = ""; try { last = localStorage.getItem(`gg-push-${S.rid}-${S.me.id}`) || ""; } catch (e) {}
    if (last !== token || !cur || cur.t !== token || Date.now() - (cur.at || 0) > 7 * 864e5) {
      const dev = { ...(cur || {}), t: token, name: (cur && cur.name) || dk.t, k: dk.k, at: Date.now() };
      await DB.db.doc(`restos/${S.rid}/push/${S.me.id}`).set({ tokens: firebase.firestore.FieldValue.arrayUnion(token), devs: { [id]: dev }, at: Date.now() }, { merge: true });
      try { localStorage.setItem(`gg-push-${S.rid}-${S.me.id}`, token); } catch (e) {}
    }
    return true;
  } catch (e) { console.warn("push", e); return false; }
}
/* js/consignes.js « Être prévenu sur ce téléphone » goes through here too, so the device is listed with its own settings */
if (typeof csPushRegister === "function") csPushRegister = puRegister; /* eslint-disable-line no-global-assign */
window.addEventListener("gg:ready", () => setTimeout(() => { try { puWatchDoc(); if (DB.mode === "db" && puPerm() === "granted" && "PushManager" in window) puRegister(false); } catch (e) {} }, 4500));

/* ───────── examples, from the restaurant's own carte and team ───────── */
function puEx() {
  const dishes = (S.notes || []).filter((n) => n.carte && n.title && !/boisson|vin|bière|café|cocktail|soft/i.test(String(n.carteCat || n.cat || ""))).map((n) => n.title);
  const D = dishes.length >= 3 ? dishes : ["Bœuf bourguignon", "Dos de cabillaud", "Tarte Tatin", "Risotto aux cèpes"];
  const waiter = (S.members || []).find((m) => m.poste === "salle" && m.role !== "gerant");
  const w = firstName(waiter && waiter.name) || "Sarah";
  const sh = (s) => String(s).length > 22 ? String(s).slice(0, 21) + "…" : s;
  return {
    k_new: ["Table 4 · Plats", `3 assiettes : 2 ${sh(D[0])}, 1 ${sh(D[1])} · ${w}`],
    k_rush: ["Table 12 réclame ses plats", `Envoyé il y a 19 min · 2 ${sh(D[0])}`],
    k_mod: ["Table 7 · bon modifié", `1 ${sh(D[1])} sans sauce`],
    b_new: ["Table 4 · Boissons", "4 boissons : 2 Spritz, 1 Coca, 1 Badoit"],
    s_ready: ["Table 4 · Plats · prêt", `3 assiettes à envoyer : 2 ${sh(D[0])}, 1 ${sh(D[1])}`],
    s_call: ["La cuisine vous appelle", "Table 9 · Desserts · prêt depuis 4 min"],
    qr: ["Commande à emporter n°12", `38,50 € · retrait 19:45 · payée en ligne`],
    resa: ["Nouvelle réservation", "Martin · 4 pers. · samedi à 20:30"],
    ca: ["Aujourd'hui : 2 340 € TTC", "68 couverts · ticket moyen 34,40 € · +12 % vs la semaine dernière"],
    haccp: ["Chambre froide à 6,2 °C", "Au-dessus de 4 °C depuis 25 min"],
    geste: ["Offert · Table 8", `1 ${sh(D[2])} (7,50 €) · « anniversaire »`],
    consigne: ["Rupture · Thomas", `Plus de ${sh(D[1])} ce soir, proposez le ${sh(D[3] || D[0])}`],
    chat: ["Inès · Cuisine", "Je passe chez le primeur à 16h, il vous faut quelque chose ?"],
  };
}

/* ───────── banner (app open, and the demo) ───────── */
function puBanner(n) {
  if (!n || !n.title) return;
  let host = $("#puBans"); if (!host) { host = document.createElement("div"); host.id = "puBans"; host.className = "pu-bans"; host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
  const k = PU_K[n.kind] || ["", "", "puBell", "w-vi"];
  const el = document.createElement("div"); el.className = "pu-ban"; el.setAttribute("role", "status"); if (n.url) el.dataset.url = n.url;
  el.innerHTML = `<span class="pu-bi ${k[3]}">${ico(k[2])}</span><div class="pu-bt"><span class="pu-bh"><b>${esc(n.title)}</b><em>${n.demo ? "démo · " : ""}maintenant</em></span>${n.body ? `<span class="pu-bb">${esc(n.body)}</span>` : ""}</div>`;
  host.prepend(el); while (host.children.length > 3) host.lastElementChild.remove();
  requestAnimationFrame(() => el.classList.add("on"));
  try { SFX.init(); SFX.tone(1175, 0.12, "sine", 0.045); SFX.tone(1568, 0.28, "sine", 0.04, 0.09); buzz([12, 50, 12]); } catch (e) {}
  const out = () => { if (el._out) return; el._out = true; el.classList.remove("on"); el.classList.add("out"); setTimeout(() => el.remove(), 420); };
  let y0 = null; el._t = setTimeout(out, 6200);
  el.addEventListener("pointerdown", (e) => { y0 = e.clientY; clearTimeout(el._t); });
  el.addEventListener("pointermove", (e) => { if (y0 == null) return; const dy = Math.min(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
  el.addEventListener("pointerup", (e) => { const dy = y0 == null ? 0 : e.clientY - y0; y0 = null; el.style.transform = ""; if (dy < -24) { out(); return; } out(); const r = puRouteOf(n.url); if (r && VIEWS[r] && r !== S.route) go(r); });
  el.addEventListener("pointercancel", () => { y0 = null; el.style.transform = ""; el._t = setTimeout(out, 3000); });
  PU.log.unshift({ ...n, at: Date.now() }); PU.log = PU.log.slice(0, 30);
  if (S.route === "notifs") puPaintLog();
}
const puRouteOf = (url) => { const m = /[?&]go=([\w-]+)/.exec(String(url || "")) || /#([\w-]+)/.exec(String(url || "")); return m ? m[1] : null; };

/* service worker → page: a push that arrived while the app is open, or a tap on a notification */
try {
  navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.gg === "notif" && d.n) { puBanner(d.n); return; }
    if (d.gg === "open") { const r = puRouteOf(d.url); if (r && r !== "consignes" && VIEWS[r] && S.resto) { try { go(r); } catch (x) {} } }
  });
} catch (e) {}
/* what the service worker kept (last 30 notifications received on this device) */
async function puReadLog() {
  if (!("caches" in window)) return [];
  try { const c = await caches.open("gg-pu-log"); const r = await c.match("./__pu-log"); return r ? (await r.json()) || [] : []; } catch (e) { return []; }
}

/* ───────── demo: the same rules as the server, on this device ───────── */
const puPlates = (o) => (o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0);
const puLines = (o, n = 3) => { const L = (o.items || []).filter((x) => !x.off); const s = L.slice(0, n).map((x) => `${+x.q > 1 ? x.q + " " : ""}${x.name || "Plat"}`).join(", "); return L.length > n ? s + "…" : s; };
const puWho = (o) => (o.src === "salle" ? `Table ${o.table}` : o.mode === "table" && o.table ? `Commande QR · Table ${o.table}` : `À emporter n°${o.n || "?"}`);
function puOrderEvents(a, b) {
  const out = []; if (!b) return out; const st0 = a ? a.status : null, st = b.status, bar = b.station === "bar"; const course = b.courseT ? ` · ${b.courseT}` : "";
  if (st === "nouvelle" && st0 !== "nouvelle" && !["prep", "prete", "servie"].includes(st0)) {
    const n = puPlates(b); out.push({ kind: bar ? "b_new" : "k_new", title: `${b.refire ? "À refaire · " : ""}${puWho(b)}${course}`, body: `${n} ${bar ? "boisson" : "assiette"}${n > 1 ? "s" : ""} : ${puLines(b)}${b.waiterName ? " · " + firstName(b.waiterName) : ""}`, url: "./?go=cuisine", by: b.waiter });
    if (b.src === "qr") out.push({ kind: "qr", title: b.mode === "table" ? `Nouvelle commande · Table ${b.table}` : `Commande à emporter n°${b.n || "?"}`, body: puLines(b), url: "./?go=commandes" });
  }
  if (!a) return out;
  if (b.push && b.push !== a.push && ["nouvelle", "prep"].includes(st)) out.push({ kind: bar ? "b_new" : "k_rush", title: `${puWho(b)} réclame`, body: puLines(b), url: "./?go=cuisine", by: b.waiter });
  if (b.mod && b.mod !== a.mod && ["nouvelle", "prep"].includes(st)) out.push({ kind: "k_mod", title: `${puWho(b)}${course} · bon modifié`, body: puLines(b), url: "./?go=cuisine", by: b.waiter });
  if (st === "annulee" && st0 && !["annulee", "attente", "servie", "apayer"].includes(st0)) out.push({ kind: "k_mod", title: `${puWho(b)}${course} · bon annulé`, body: puLines(b), url: "./?go=cuisine", by: b.cancelledBy });
  if (st === "prete" && st0 !== "prete") { const n = puPlates(b); out.push({ kind: "s_ready", title: `${puWho(b)}${course} · prêt`, body: `${n} assiette${n > 1 ? "s" : ""} à envoyer : ${puLines(b)}`, url: b.src === "salle" ? "./?go=salle" : "./?go=commandes", waiter: b.src === "salle" ? b.waiter : null, by: b.by }); }
  if (b.call && b.call !== a.call && st === "prete") out.push({ kind: "s_call", title: "La cuisine vous appelle", body: `${puWho(b)}${course}`, url: "./?go=salle", waiter: b.waiter });
  return out;
}
/* would the server ring me for this? (demo, and the « aperçu ») */
function puWouldRing(ev) {
  if (ev.by && ev.by === S.me.id) return false; /* never for what I did myself */
  if (ev.waiter && (ev.kind === "s_ready" || ev.kind === "s_call") && ev.waiter !== S.me.id && !puPrefs().readyAll) return false;
  return puDevOn(ev.kind);
}
/* the screen that already shows it: no banner on top */
const puOnScreen = (ev) => { const r = puRouteOf(ev.url); return r === S.route || (S.route === "coupdefeu" && ["k_new", "s_ready", "s_call", "k_rush"].includes(ev.kind)); };
function puDemoWatch() {
  if (DB.mode !== "demo" || !S.rid || PU.demo.rid === S.rid) return;
  PU.demo.rid = S.rid; PU.demo.st = new Map(); PU.demo.tabs = new Map(); PU.demo.init = false; const rid = S.rid;
  DB.watch("clientOrders", { order: "at", dir: "desc", limit: 200 }, (rows) => {
    if (S.rid !== rid || DB.mode !== "demo") return;
    rows.forEach((o) => { const prev = PU.demo.st.get(o.id); PU.demo.st.set(o.id, JSON.parse(JSON.stringify(o))); if (!PU.demo.init) return; puOrderEvents(prev || null, o).forEach((ev) => { if (puWouldRing(ev) && !puOnScreen(ev)) puBanner({ ...ev, demo: true }); }); });
    PU.demo.init = true;
  });
}
window.addEventListener("gg:ready", () => setTimeout(() => { try { puDemoWatch(); } catch (e) {} }, 1200));

/* ───────── screen ───────── */
function puHero(sup) {
  const dk = puDevKind(); const prof = puProfile();
  const st = {
    demo: ["Démo", "Les notifications s'affichent en haut de l'écran, comme sur le téléphone. Rien ne part ailleurs."],
    local: ["Sans compte", "Créez un compte pour recevoir les notifications sur votre téléphone, même app fermée."],
    "ios-home": [`Sur cet ${dk.t}`, "Ajoutez d'abord l'app à l'écran d'accueil : c'est là qu'Apple autorise les notifications."],
    "ios-old": [`Sur cet ${dk.t}`, "Il faut iOS 16.4 ou plus récent. Mettez l'appareil à jour dans Réglages › Général."],
    none: ["Ce navigateur", "Il ne sait pas recevoir de notifications. Ouvrez l'app dans Chrome, Edge ou Safari."],
    denied: ["Bloquées", `Vous les avez refusées sur ${dk.k === "laptop" ? "ce navigateur" : `ce ${dk.t}`}. Réautorisez-les dans les réglages, puis revenez ici.`],
    off: ["Pas encore activées", `Un geste et votre ${dk.k === "laptop" ? "ordinateur" : dk.t} sonne pour ce qui vous concerne, même app fermée.`],
    ready: ["Presque", "Les notifications sont autorisées. Touchez « Activer » pour relier cet appareil à votre compte."],
    on: [`Activées sur ce${dk.k === "phone" ? " téléphone" : dk.k === "tablet" ? "tte tablette" : "t ordinateur"}`, puMyDev() && puMyDev().mute ? "Coupées pour le moment sur cet appareil." : "Vous êtes prévenu même quand l'app est fermée."],
  }[sup] || ["", ""];
  const cta = sup === "off" || sup === "ready" ? `<button class="btn pu-cta" data-act="puEnable">${ico("puBell")}Activer sur cet appareil</button>`
    : sup === "ios-home" ? `<button class="btn pu-cta" data-act="puHowHome">${ico("download")}Comment faire</button>`
    : sup === "denied" ? `<button class="btn pu-cta" data-act="puHowDenied">${ico("sliders")}Les réautoriser</button>`
    : sup === "demo" ? `<button class="btn pu-cta" data-act="puPlay">${ico("puPlay")}Jouer un service</button>`
    : sup === "on" ? `<button class="btn pu-cta ghosty" data-act="puTest">${ico("puSpark")}Envoyer un essai</button>` : "";
  return `<div class="pu-hero wall st" style="--i:1"><div class="pu-sky" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="pu-hl">
      <span class="pu-kick">${ico("puBell")}Notifications · ${esc(puProfileT(prof))}</span>
      <h2>Chacun reçoit ce qui le concerne.</h2>
      <p>La cuisine voit partir les bons, la salle sait quand c'est prêt, le patron a son chiffre à la fin du service.</p>
      <div class="pu-state ${sup === "on" ? "on" : ""}"><b>${esc(st[0])}</b><span>${esc(st[1])}</span></div>
      ${cta ? `<div class="pu-ctas">${cta}${sup === "on" || sup === "demo" ? "" : ""}</div>` : ""}
    </div>
    <div class="pu-phone" aria-hidden="true"><div class="pu-ph"><div class="pu-isl"></div><div class="pu-lt"><b class="pu-clock">${hm(Date.now())}</b><span>${esc(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()))}</span></div><div class="pu-stack" id="puStack"></div></div></div>
  </div>`;
}
function puPresetCards() {
  const prof = puProfile(); const cur = PU_KINDS.map((k) => k[0]).filter((k) => puAccountOn(k));
  const same = (p) => { const L = PU_DEF[p]; return L.length === cur.length && L.every((k) => cur.includes(k)); };
  return `<div class="lbl st cc-sec" style="--i:2">Partir d'un poste</div>
    <div class="pu-presets st" style="--i:2">${PU_PRESETS.map(([p, i, t, d]) => { const mineP = p === prof || (prof === "chef" && p === "cuisine"); return `<button class="pu-pre ${same(p) || (prof === "chef" && p === "cuisine" && same("chef")) ? "on" : ""}" data-act="puPreset" data-v="${p}" aria-pressed="${same(p)}"><span class="pu-pi">${ico(i)}</span><b>${t}</b><em>${d}</em>${mineP ? `<span class="pu-mine">Votre poste</span>` : ""}</button>`; }).join("")}</div>`;
}
function puKindsHTML() {
  const ex = puEx(); const dev = PU.scope === "dev"; const d = puMyDev(); const prof = puProfile();
  const mine = new Set(PU_DEF[prof]);
  return puVisibleGroups(prof).map(([g, t, L], gi) => `<div class="pu-grp"><div class="pu-gt">${esc(t)}${L.every((k) => !mine.has(k[0])) ? `<span>autres postes</span>` : ""}</div>
    ${L.map(([k, , i, w, tt, dd]) => { const on = dev ? puDevOn(k) : puAccountOn(k); const own = dev && d && d.kinds && typeof d.kinds[k] === "boolean"; return `<div class="li tap pu-k ${on ? "on" : ""}" data-act="puToggle" data-v="${k}" role="switch" aria-checked="${on}"><span class="ic ${w}">${ico(i)}</span><div class="tx"><b>${esc(tt)}</b><em>${esc(dd)}</em><span class="pu-ex"><i>${esc(ex[k][0])}</i> ${esc(ex[k][1])}</span>${dev && !own ? `<span class="pu-inh">comme le compte</span>` : ""}</div>${ccSw(on)}</div>`; }).join("")}</div>`).join("");
}
function puOptionsHTML() {
  const p = puPrefs(); const show = (k) => puAccountOn(k);
  const caT = { both: "Midi et soir", soir: "Le soir seulement", midi: "Le midi seulement" }[p.ca] || "Midi et soir";
  const slots = (S.resto && S.resto.alertCfg && S.resto.alertCfg.slots) || { midi: "14:30", soir: "22:30" };
  return `<div class="glass pad st" style="--i:5">
    ${show("s_ready") || show("s_call") ? `<div class="li tap" data-act="puReadyAll" role="switch" aria-checked="${p.readyAll}"><span class="ic w-mi">${ico("cmBell")}</span><div class="tx"><b>Plats prêts de toutes les tables</b><em>${p.readyAll ? "Toutes les tables, pas seulement les vôtres" : "Seulement les tables que vous avez envoyées"}</em></div>${ccSw(p.readyAll)}</div>` : ""}
    ${show("ca") ? `<div class="li tap" data-act="puCaSheet"><span class="ic ok">${ico("puEuro")}</span><div class="tx"><b>Chiffre du service</b><em>${esc(caT)} · vers ${esc(slots.midi || "14:30")} et ${esc(slots.soir || "22:30")}, l'heure de fin de service des alertes</em></div>${ico("chev")}</div>` : ""}
    <div class="li tap" data-act="puQuietSheet"><span class="ic w-in">${ico("puMoon")}</span><div class="tx"><b>Heures calmes</b><em>${p.quiet.on ? `Rien entre ${esc(p.quiet.from)} et ${esc(p.quiet.to)}, sauf les urgences` : "Aucune : les notifications arrivent à toute heure"}</em></div>${p.quiet.on ? `<span class="pill">${esc(p.quiet.from)}–${esc(p.quiet.to)}</span>` : ico("chev")}</div>
    <div class="li tap" data-act="puShiftOnly" role="switch" aria-checked="${p.shiftOnly}"><span class="ic w-sk">${ico("clock")}</span><div class="tx"><b>Seulement quand j'ai pointé</b><em>${p.shiftOnly ? "En repos, rien ne sonne (sauf le chiffre et les alertes frigos)" : "Même les jours de repos"}</em></div>${ccSw(p.shiftOnly)}</div>
  </div>`;
}
function puDevicesHTML(sup) {
  const devs = Object.entries(puDoc().devs || {}).sort((a, b) => (b[0] === puDevId()) - (a[0] === puDevId()) || (b[1].at || 0) - (a[1].at || 0));
  const me = puMyDev(); const dk = puDevKind();
  const here = `<div class="li"><span class="ic w-vi">${ico(puDevIc(dk.k))}</span><div class="tx"><b>${esc((me && me.name) || dk.t)} · cet appareil</b><em>${sup === "on" ? (me && me.mute ? "Coupé pour le moment" : me && me.kinds ? "Sa propre liste" : "Suit les réglages du compte") : sup === "demo" ? "Démo : les notifications s'affichent dans l'app" : "Pas encore relié"}</em></div>${sup === "on" ? `<button class="btn ghost sm" data-act="puMute">${me && me.mute ? "Réactiver" : "Couper"}</button>` : ""}</div>`;
  const others = devs.filter(([id]) => id !== puDevId()).map(([id, d]) => `<div class="li"><span class="ic">${ico(puDevIc(d.k))}</span><div class="tx"><b>${esc(d.name || "Appareil")}</b><em>${d.mute ? "Coupé" : d.kinds ? "Sa propre liste" : "Suit le compte"} · vu ${d.at ? esc(when(d.at)) : "—"}</em></div><button class="iconbtn sm" data-act="puDevDel" data-id="${esc(id)}" aria-label="Retirer ${esc(d.name || "cet appareil")}">${ico("x")}</button></div>`).join("");
  return `<div class="glass pad st" style="--i:6">${here}${others}</div>`;
}
function puLogHTML() {
  const L = [...PU.log, ...(PU.swLog || [])].sort((a, b) => (b.at || 0) - (a.at || 0)).filter((x, i, A) => i === 0 || !(A[i - 1].title === x.title && Math.abs((A[i - 1].at || 0) - (x.at || 0)) < 4000)).slice(0, 8);
  if (!L.length) return `<p class="note" style="margin:2px 4px">Les dernières notifications reçues sur cet appareil s'afficheront ici.</p>`;
  return `<div class="glass pad">${L.map((n) => { const k = PU_K[n.kind] || ["", "", "puBell", "w-vi"]; return `<div class="li"><span class="ic ${k[3]}">${ico(k[2])}</span><div class="tx"><b>${esc(n.title)}</b><em>${esc(n.body || "")}</em></div><span class="pu-at">${esc(alAgoSafe(n.at))}</span></div>`; }).join("")}</div>`;
}
const alAgoSafe = (at) => { const m = Math.round((Date.now() - (at || 0)) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `${m} min`; return dayKey(new Date(at)) === dayKey() ? hm(at) : when(at); };
function puPaintLog() { const b = $("#puLog"); if (b) b.innerHTML = puLogHTML(); }
function puPaint() { if (S.route === "notifs" && !PU.busy) rerender(); }

VIEWS.notifs = {
  render() {
    puWatchDoc(); puDemoWatch();
    const sup = puSupport(); const devOk = sup === "on";
    if (typeof esShared === "function" && esShared()) return `<div class="inner cc-wide pu-page">${topBar("Notifications")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("puBell")}</div><b>Appareil du restaurant</b>Les notifications sont personnelles : chacun les active sur son propre téléphone. Ici, l'écran sonne de lui-même quand il est ouvert.</div></div>`;
    const seg = devOk || DB.mode === "demo" ? `<div class="pu-scope st" style="--i:4" role="tablist"><button class="chip ${PU.scope !== "dev" ? "on" : ""}" data-act="puScope" data-v="all" role="tab" aria-selected="${PU.scope !== "dev"}">${ico("users")}Tous mes appareils</button><button class="chip ${PU.scope === "dev" ? "on" : ""}" data-act="puScope" data-v="dev" role="tab" aria-selected="${PU.scope === "dev"}">${ico(puDevIc(puDevKind().k))}Seulement ${puDevKind().k === "laptop" ? "cet ordinateur" : `ce${puDevKind().k === "tablet" ? "tte tablette" : " téléphone"}`}</button></div>` : "";
    const devNote = PU.scope === "dev" ? `<p class="note st" style="--i:4;margin:-2px 4px 0">Ce que vous changez ici ne touche que cet appareil. ${puMyDev() && puMyDev().kinds ? `<button class="linkbtn" data-act="puDevReset">Revenir aux réglages du compte</button>` : ""}</p>` : "";
    const facts = `<div class="pu-facts st" style="--i:8">
      <div><span class="ic w-vi">${ico("puPhone")}</span><p><b>iPhone et iPad :</b> iOS 16.4 ou plus, avec l'app ajoutée à l'écran d'accueil. Android : Chrome, même app fermée.</p></div>
      <div><span class="ic w-sk">${ico("puLaptop")}</span><p><b>Ordinateur :</b> elles arrivent tant que le navigateur est ouvert, même dans un autre onglet.</p></div>
      <div><span class="ic w-in">${ico("puMoon")}</span><p><b>Mode Concentration ou Ne pas déranger :</b> le téléphone les garde pour plus tard. L'écran cuisine, lui, sonne toujours quand il est ouvert.</p></div></div>`;
    return `<div class="inner cc-wide pu-page">${topBar("Notifications")}${puHero(sup)}${puPresetCards()}
      <div class="lbl st cc-sec" style="--i:3">Ce que je reçois</div>${seg}${devNote}
      <div class="glass pad st pu-kinds" style="--i:4">${puKindsHTML()}</div>
      <div class="lbl st cc-sec" style="--i:5">Quand</div>${puOptionsHTML()}
      <div class="lbl st cc-sec" style="--i:6">Mes appareils</div>${puDevicesHTML(sup)}
      <div class="lbl st cc-sec" style="--i:7">Reçues récemment</div><div class="st" style="--i:7" id="puLog">${puLogHTML()}</div>
      ${facts}</div>`;
  },
  after(v) {
    puPhoneStart(v);
    if (Date.now() - PU.logAt > 4000) { PU.logAt = Date.now(); puReadLog().then((L) => { PU.swLog = L; puPaintLog(); }); }
  },
};

/* ───────── the lock-screen preview: the person's own notifications, one after the other ───────── */
function puPhoneKinds() { return PU_KINDS.map((k) => k[0]).filter((k) => (PU.scope === "dev" ? puDevOn(k) : puAccountOn(k))); }
function puPhoneCard(k, ago) {
  const ex = puEx()[k]; const K = PU_K[k];
  return `<div class="pu-pc"><span class="pu-pa">${appIcon(22)}</span><div><span class="pu-ph1"><b>Growth Gusto</b><em>${ago}</em></span><b class="pu-pt">${esc(ex[0])}</b><span class="pu-pb">${esc(ex[1])}</span></div><span class="pu-pk ${K[3]}">${ico(K[2])}</span></div>`;
}
function puPhoneStart(v) {
  clearInterval(PU.phoneT); const st = $("#puStack", v); if (!st) return;
  const L = puPhoneKinds();
  if (!L.length) { st.innerHTML = `<div class="pu-pempty">${ico("puMoon")}<span>Rien ne sonnera</span></div>`; return; }
  let i = 0; const agos = ["maintenant", "il y a 2 min", "il y a 6 min"];
  st.innerHTML = L.slice(0, 3).map((k, j) => puPhoneCard(k, agos[j] || "")).join(""); i = Math.min(3, L.length) % L.length;
  const step = () => {
    if (!document.body.contains(st)) { clearInterval(PU.phoneT); return; }
    if (document.hidden) return;
    const k = L[i % L.length]; i++;
    const w = document.createElement("div"); w.innerHTML = puPhoneCard(k, "maintenant"); const c = w.firstElementChild; c.classList.add("in");
    $$(".pu-pc em", st).forEach((e, j) => { e.textContent = j === 0 ? "il y a 1 min" : `il y a ${j * 3 + 2} min`; });
    st.prepend(c); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove("in")));
    while (st.children.length > 3) st.lastElementChild.remove();
    const cl = $(".pu-clock", v); if (cl) cl.textContent = hm(Date.now());
  };
  if (L.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) PU.phoneT = setInterval(step, 2800);
}

/* ───────── sheets ───────── */
function puQuietHTML() {
  const q = puPrefs().quiet; const H = []; for (let h = 0; h < 24; h++) for (const m of ["00", "30"]) H.push(`${String(h).padStart(2, "0")}:${m}`);
  const sel = (id, v) => `<select class="input pu-sel" id="${id}">${H.map((x) => `<option ${x === v ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  return `<div class="h2" style="margin-bottom:4px">Heures calmes</div><p class="sub" style="margin:0 0 14px">Pendant ces heures, rien ne sonne. Les urgences (frigo hors seuil, table qui réclame) passent quand même.</p>
    <div class="pu-qrow"><label>De ${sel("puQf", q.from)}</label><label>à ${sel("puQt", q.to)}</label></div>
    <div class="pu-qpre">${[["23:30", "08:00"], ["00:00", "09:00"], ["15:30", "18:00"]].map(([a, b]) => `<button class="chip" data-act="puQuietPre" data-v="${a}|${b}">${a} → ${b}${a === "15:30" ? " · la coupure" : ""}</button>`).join("")}</div>
    <div class="ctabar" style="margin-top:16px"><button class="btn acc block" data-act="puQuietOk">${ico("puMoon")}Activer les heures calmes</button>${q.on ? `<button class="btn ghost block" data-act="puQuietOff">Désactiver</button>` : ""}</div>`;
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  async puEnable(a) {
    if (DB.mode !== "db") { toast("Créez un compte pour recevoir les notifications.", "info"); return; }
    if (a) a.disabled = true; PU.busy = true;
    const ok = await puRegister(true); PU.busy = false;
    if (ok) { SFX.done(); buzz([10, 30, 10]); burst(); toast("Notifications activées sur cet appareil"); setTimeout(() => ACT.puTest(null, null, null, null, true), 900); }
    else if (puPerm() === "denied") { SFX.err(); toast("Refusées : réautorisez-les dans les réglages de l'appareil.", "err"); }
    else { SFX.err(); toast("Pas activées. Réessayez dans un instant.", "err"); }
    rerender();
  },
  async puTest(a, id, v, e, quiet) {
    const p = puProfile(); const first = PU_DEF[p].find((k) => puDevOn(k)) || "consigne"; const ex = puEx()[first];
    const title = "C'est réglé pour vous"; const body = `Par exemple : « ${ex[0]} ». ${puPhoneKinds().length} type${puPhoneKinds().length > 1 ? "s" : ""} de notifications activé${puPhoneKinds().length > 1 ? "s" : ""}.`;
    if (DB.mode === "db" && puMyDev() && DB.db) {
      try { await DB.db.collection(`restos/${S.rid}/notifs`).add({ kind: "test", uid: DB.uid, title, body, url: "./?go=notifs", at: Date.now() }); if (!quiet) { SFX.ok(); toast("Essai envoyé : il arrive dans quelques secondes"); } return; }
      catch (x) { console.warn("notifs test", x); }
    }
    puBanner({ kind: first, title, body, url: "./?go=notifs", demo: DB.mode === "demo" });
  },
  puPlay() {
    if (PU.play) { PU.play.forEach(clearTimeout); PU.play = null; }
    const ex = puEx(); const L = puPhoneKinds().slice(0, 5);
    if (!L.length) { toast("Aucune notification activée pour l'instant.", "info"); return; }
    SFX.tap(); PU.play = L.map((k, i) => setTimeout(() => puBanner({ kind: k, title: ex[k][0], body: ex[k][1], url: "", demo: true }), 400 + i * 2600));
  },
  puScope: (a, id, v) => { PU.scope = v === "dev" ? "dev" : "all"; SFX.tap(); rerender(); },
  async puToggle(a, id, k) {
    if (!PU_K[k]) return; SFX.tick(); buzz(5);
    if (PU.scope === "dev") {
      const d = { ...(puMyDev() || { name: puDevKind().t, k: puDevKind().k, at: Date.now() }) }; const kinds = { ...(d.kinds || {}) };
      kinds[k] = !puDevOn(k); if (kinds[k] === puAccountOn(k)) delete kinds[k];
      if (Object.keys(kinds).length) d.kinds = kinds; else delete d.kinds;
      await puSaveDev(d);
    } else {
      const p = puPrefs(); const kinds = { ...p.kinds }; const now = !puAccountOn(k);
      if (now === PU_DEF[puProfile()].includes(k)) delete kinds[k]; else kinds[k] = now;
      await puSavePrefs({ ...p, kinds });
    }
    rerender();
  },
  async puPreset(a, id, prof) {
    if (!PU_DEF[prof]) return; const p = puPrefs(); const old = { ...p.kinds };
    const mine = PU_DEF[puProfile()]; const want = new Set(PU_DEF[prof === "cuisine" && puProfile() === "chef" ? "chef" : prof]); const kinds = {};
    PU_KINDS.forEach(([k]) => { const on = want.has(k); if (on !== mine.includes(k)) kinds[k] = on; });
    await puSavePrefs({ ...p, kinds }); SFX.ok(); buzz(8);
    S.ui.undo = null; toast(`Réglé comme ${{ cuisine: "en cuisine", salle: "en salle", bar: "au bar", patron: "le patron" }[prof]}`);
    PU.undo = old; rerender();
  },
  async puReadyAll() { const p = puPrefs(); SFX.tick(); await puSavePrefs({ ...p, readyAll: !p.readyAll }); rerender(); },
  async puShiftOnly() { const p = puPrefs(); SFX.tick(); await puSavePrefs({ ...p, shiftOnly: !p.shiftOnly }); rerender(); },
  puCaSheet() {
    const p = puPrefs(); SFX.tap();
    openSheet(`<div class="h2" style="margin-bottom:4px">Chiffre du service</div><p class="sub" style="margin:0 0 12px">Le total du service, les couverts, le ticket moyen et l'écart avec la semaine dernière. D'après le ticket Z ou la caisse connectée, sinon d'après les additions de la salle.</p>
      ${[["both", "Midi et soir"], ["soir", "Le soir seulement"], ["midi", "Le midi seulement"]].map(([v, t]) => `<button class="chip cc-opt-row ${p.ca === v ? "on" : ""}" data-act="puCa" data-v="${v}">${t}${p.ca === v ? ico("check") : ""}</button>`).join("")}
      <p class="note" style="margin:12px 2px 0">L'heure suit la fin de service réglée dans Alertes (par défaut 14:30 et 22:30).</p>`);
  },
  async puCa(a, id, v) { const p = puPrefs(); closeSheet(); SFX.ok(); await puSavePrefs({ ...p, ca: v }); rerender(); },
  puQuietSheet() { SFX.tap(); openSheet(puQuietHTML()); },
  puQuietPre(a, id, v) { const [f, t] = String(v).split("|"); const A = $("#puQf"), B = $("#puQt"); if (A) A.value = f; if (B) B.value = t; SFX.tick(); },
  async puQuietOk() { const p = puPrefs(); const f = ($("#puQf") || {}).value || p.quiet.from, t = ($("#puQt") || {}).value || p.quiet.to; if (f === t) { SFX.err(); toast("Choisissez deux heures différentes.", "err"); return; } closeSheet(); SFX.ok(); await puSavePrefs({ ...p, quiet: { on: true, from: f, to: t } }); toast(`Heures calmes : ${f} → ${t}`); rerender(); },
  async puQuietOff() { const p = puPrefs(); closeSheet(); SFX.ok(); await puSavePrefs({ ...p, quiet: { ...p.quiet, on: false } }); rerender(); },
  async puMute() { const d = puMyDev(); if (!d) return; SFX.tick(); await puSaveDev({ ...d, mute: !d.mute }); toast(d.mute ? "Réactivées sur cet appareil" : "Coupées sur cet appareil"); rerender(); },
  async puDevReset() { const d = puMyDev(); if (!d) return; const x = { ...d }; delete x.kinds; SFX.ok(); await puSaveDev(x); rerender(); },
  async puDevDel(a, id) {
    const d = (puDoc().devs || {})[id]; if (!d) return; SFX.tap();
    if (DB.mode === "db" && DB.db) {
      const FV = firebase.firestore.FieldValue;
      try { await DB.db.doc(`restos/${S.rid}/push/${S.me.id}`).update({ [`devs.${id}`]: FV.delete(), ...(d.t ? { tokens: FV.arrayRemove(d.t) } : {}) }); } catch (e) { toast("Pas retiré, réessayez.", "err"); return; }
    } else { const devs = { ...(puDoc().devs || {}) }; delete devs[id]; await puWrite({ devs }, ["devs"]); }
    toast(`${d.name || "Appareil"} ne recevra plus rien`); rerender();
  },
  puHowHome() {
    SFX.tap(); const dk = puDevKind();
    openSheet(`<div class="h2" style="margin-bottom:6px">Ajouter l'app à l'écran d'accueil</div><p class="sub" style="margin:0 0 14px">Apple n'envoie les notifications qu'aux apps posées sur l'écran d'accueil. C'est gratuit et ça prend 10 secondes.</p>
      <div class="vr-steps"><div><span class="vr-n">1</span><span>Dans Safari, touchez le bouton Partager <b>⬆︎</b> en bas${dk.t === "iPad" ? " (en haut sur iPad)" : ""}</span></div><div><span class="vr-n">2</span><span>Choisissez « Sur l'écran d'accueil », puis « Ajouter »</span></div><div><span class="vr-n">3</span><span>Ouvrez Growth Gusto depuis l'icône et revenez ici : le bouton « Activer » apparaît</span></div></div>
      <button class="btn acc block" style="margin-top:16px" data-act="sheetClose">J'ai compris</button>`);
  },
  puHowDenied() {
    SFX.tap(); const dk = puDevKind();
    const how = dk.ios ? "Réglages de l'iPhone › Notifications › Growth Gusto › Autoriser les notifications." : /Android/.test(navigator.userAgent) ? "Appui long sur l'icône Growth Gusto › Infos sur l'appli › Notifications, ou le cadenas à gauche de l'adresse dans Chrome." : "Cliquez sur le cadenas à gauche de l'adresse, puis Notifications › Autoriser.";
    openSheet(`<div class="h2" style="margin-bottom:6px">Réautoriser les notifications</div><p class="sub" style="margin:0 0 14px">${esc(how)}</p><p class="note" style="margin:0 2px 14px">Revenez ensuite sur cet écran : le bouton « Activer » apparaît.</p><button class="btn acc block" data-act="sheetClose">J'ai compris</button>`);
  },
});

/* Réglages (js/compte.js): one row */
function puRow() {
  if (typeof esShared === "function" && esShared()) return "";
  const sup = puSupport(); const n = puPhoneKinds().length;
  const em = sup === "on" ? `${n} type${n > 1 ? "s" : ""} activé${n > 1 ? "s" : ""} · ${esc(puProfileT(puProfile()).toLowerCase())}` : sup === "demo" ? "Choisir ce que chacun reçoit" : sup === "denied" ? "Bloquées sur cet appareil" : "Plats prêts, bons, chiffre du soir…";
  return `<div class="li tap" data-go="notifs"><span class="ic w-vi">${ico("puBell")}</span><div class="tx"><b>Notifications</b><em>${em}</em></div>${sup === "on" ? `<span class="pill acc">Activées</span>` : ico("chev")}</div>`;
}
