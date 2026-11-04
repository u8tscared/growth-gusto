/* Growth Gusto — area: avis = « Votre avis sur Growth Gusto » (feedback from the restaurants to the Growth Gusto team) + admin inbox.
   Storage:
   · Firebase configured (DB.mode "db" + window.GG_FIREBASE + firebase): TOP-LEVEL collection "appFeedback"
     { rid, restoName, uid, name, email, role, type, area, text, nps?, shot?{id,url}, ctx{v,route,ua,w,h}, at, status:"recu"|"en_cours"|"fait", replies:[{by,at,text}] }
   · local: the same doc kept in the resto "feedback" collection with source:"app", sent to the team by e-mail (mailto).
   · demo (DB.mode "demo"): sending is simulated.
   Helpers for other areas: avisOpen(area?) opens the composer about a screen; avisUnread() → envois with a reply not seen yet; avisIsAdmin(). */

Object.assign(IC, {
  avBulb: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4", "f:M12 2a6 6 0 0 0-4.5 9.5c.7.7 1.3 1.5 1.5 2.5h6c.2-1 .7-1.7 1.5-2.5A6 6 0 0 0 12 2z"],
  avHeart: ["M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z", "f:M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"],
  avHelp: ["c:12,12,10", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  avBug: ["M12 20v-9", "M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z", "M14.12 3.88 16 2", "M21 21a4 4 0 0 0-3.81-4", "M21 5a4 4 0 0 1-3.55 3.97", "M22 13h-4", "M3 21a4 4 0 0 1 3.81-4", "M3 5a4 4 0 0 0 3.55 3.97", "M6 13H2", "m8 2 1.88 1.88", "M9 7.13V6a3 3 0 1 1 6 0v1.13"],
  avSend: ["M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z", "m21.85 2.15-10.94 10.94"],
  avInbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  avMail: ["r:2,4,20,16,2", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  avMsg: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  avDevice: ["r:5,2,14,20,2", "M12 18h.01"],
  avLock: ["r:3,11,18,11,2", "M7 11V7a5 5 0 0 1 10 0v4"],
});
TAB_OF.avis = "more"; TAB_OF.avisAdmin = "more";
if (typeof window.GG_ADMINS === "undefined") window.GG_ADMINS = ["marceau.ruis@gmail.com"];
const AV_MAIL = "marceau.ruis@gmail.com";

const AV_TYPES = [
  ["idee", "Idée", "avBulb", "Une fonction en plus, une façon plus simple de faire…"],
  ["probleme", "Problème", "avBug", "Ce qui bloque, ce qui bugue, ce qui n'est pas clair…"],
  ["jadore", "J'adore", "avHeart", "Ce qui vous fait gagner du temps, ce qu'il faut garder…"],
  ["question", "Question", "avHelp", "Comment faire… ? Est-ce que l'app peut… ?"],
];
const AV_ST = { recu: ["Reçu", "neu"], en_cours: ["En cours", "acc"], fait: ["Fait", "ok"] };
const avType = (k) => AV_TYPES.find((t) => t[0] === k) || AV_TYPES[0];
const AV_ALIAS = { fiche: "notes", note: "notes", noteProc: "notes", noteDoc: "notes", frigo: "frigos", tzEdit: "tickets", regReport: "registre", staff: "equipe", more: "general", onboarding: "general", avis: "general", avisAdmin: "general" };
const avAreas = () => [["general", "sparkle", "Général"], ...NAV.filter((n) => n[0] !== "sep" && n[0] !== "avis")];
const avAreaOf = (r) => { const k = AV_ALIAS[r] || r; return avAreas().some((a) => a[0] === k) ? k : "general"; };
const avAreaLabel = (k) => (avAreas().find((a) => a[0] === k) || [k, "", k || "Général"])[2];
const avLS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const avPlural = (n, w, p) => `${n} ${n > 1 ? p || w + "s" : w}`;

/* where the person was before opening the composer: recorded in the capture phase, before core navigates */
let avPrev = "home";
document.addEventListener("click", (e) => { if (S.route !== "avis" && S.route !== "avisAdmin" && e.target.closest && e.target.closest("[data-go],[data-tab],[data-act]")) avPrev = S.route; }, true);

/* ───────── modes ───────── */
const avFbOn = () => { try { return DB.mode === "db" && !!window.GG_FIREBASE && !!window.firebase && typeof window.firebase.firestore === "function"; } catch (e) { return false; } };
const avFs = () => window.firebase.firestore().collection("appFeedback");
const avMode = () => (avFbOn() ? "fb" : DB.mode === "demo" ? "demo" : "local");
function avEmail() { try { const u = window.firebase && window.firebase.auth && window.firebase.auth().currentUser; if (u && u.email) return u.email; } catch (e) {} return S.me.email || ""; }
function avisIsAdmin() { const e = avEmail().trim().toLowerCase(); return !!e && (window.GG_ADMINS || []).map((x) => String(x).trim().toLowerCase()).includes(e); }
const avRole = () => { try { return ROLES[myRole()] || ""; } catch (e) { return ""; } };

/* remote mirrors (Firebase): this restaurant's envois, and for admins the whole inbox */
const AVR = { mine: null, mineRid: null, all: null, unMine: null, unAll: null };
function avWatchMine() {
  if (!avFbOn() || AVR.mineRid === S.rid) return; if (AVR.unMine) { try { AVR.unMine(); } catch (e) {} }
  AVR.mineRid = S.rid; AVR.mine = null;
  try { AVR.unMine = avFs().where("rid", "==", S.rid).onSnapshot((snap) => { AVR.mine = snap.docs.map((d) => ({ id: d.id, ...d.data() })); if (S.route === "avis") refresh(); }, (e) => { console.warn("appFeedback", e); AVR.mine = []; if (S.route === "avis") refresh(); }); } catch (e) { console.warn(e); AVR.mine = []; }
}
function avWatchAll() {
  if (!avFbOn() || AVR.unAll) return;
  try { AVR.unAll = avFs().orderBy("at", "desc").limit(800).onSnapshot((snap) => { AVR.all = snap.docs.map((d) => ({ id: d.id, ...d.data() })); if (S.route === "avisAdmin") refresh(); }, (e) => { console.warn("appFeedback admin", e); AVR.all = []; if (S.route === "avisAdmin") refresh(); }); } catch (e) { console.warn(e); AVR.all = []; }
}
const avMine = () => (avFbOn() ? AVR.mine || [] : S.feedback.filter((f) => f.source === "app")).slice().sort((a, b) => b.at - a.at);
const avAll = () => (avFbOn() ? AVR.all || [] : S.feedback.filter((f) => f.source === "app")).slice().sort((a, b) => b.at - a.at);
const avLastReply = (f) => (f.replies || []).reduce((m, r) => Math.max(m, r.at || 0), 0);
function avisUnread() { const seen = avLS.get("gg-afb-seen", 0); return avMine().filter((f) => avLastReply(f) > seen).length; }

/* NPS: asked at most once a month, per person */
const avNpsDue = () => { const m = avLS.get("gg-nps", {}); return Date.now() - (m[S.me.id] || 0) > 30 * 864e5; };

/* ───────── context ───────── */
function avUaShort(u) {
  u = String(u || ""); if (!u) return "–";
  const os = /iPad/.test(u) ? "iPad" : /iPhone/.test(u) ? "iPhone" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "Appareil";
  const br = /Edg\//.test(u) ? "Edge" : /CriOS|Chrome\//.test(u) ? "Chrome" : /FxiOS|Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "navigateur";
  return `${os} · ${br}`;
}
const avStandalone = () => { try { return matchMedia("(display-mode: standalone)").matches || !!navigator.standalone; } catch (e) { return false; } };
function avCtx(area) { return { v: typeof APP_V !== "undefined" ? APP_V : "", route: area, ua: String(navigator.userAgent || "").slice(0, 300), w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, app: avStandalone() }; }

/* ───────── composer state ───────── */
const avF = () => (S.ui.afb ||= { type: "idee", area: "general", areaFor: null, text: "", nps: null, shot: null, busy: false, done: null, ctxOpen: false });
function avisOpen(area) { const F = avF(); const r = area || S.route; F.area = avAreaOf(r); F.areaFor = "__open"; F.done = null; avPrev = r; SFX.tap(); go("avis"); }

/* ───────── view: composer + vos envois ───────── */
VIEWS.avis = {
  render() {
    const F = avF(); avWatchMine();
    if (F.areaFor !== "__open" && F.areaFor !== avPrev && !F.text) F.area = avAreaOf(avPrev);
    F.areaFor = avPrev;
    const right = avisIsAdmin() ? `<button class="btn soft sm" data-go="avisAdmin">${ico("avInbox")}Boîte admin</button>` : "";
    return `<div class="inner narrow av-wrap">${topBar("Votre avis", { right })}
      ${F.done ? avThanksHTML(F.done) : avComposerHTML()}
      ${avMineHTML()}</div>`;
  },
  after() { setTimeout(() => avLS.set("gg-afb-seen", Date.now()), 1500); },
};

function avComposerHTML() {
  const F = avF(); const T = avType(F.type); const mode = avMode(); const areas = avAreas();
  const sel = areas.find((a) => a[0] === F.area) || areas[0]; const rest = areas.filter((a) => a !== sel);
  return `<div class="av-hero st" style="--i:1"><div class="av-hico">${ico("avMsg")}</div><div><b>Votre avis sur Growth Gusto</b><span>Une idée, un souci, un coup de cœur : Marceau lit chaque message${mode === "fb" ? " et vous répond ici" : ""}.</span></div></div>
    <div class="glass av-cap st" style="--i:2">
      <div class="av-types" role="radiogroup" aria-label="Type de message">${AV_TYPES.map(([k, t, ic]) => `<button class="av-type ${k} ${F.type === k ? "on" : ""}" data-act="avType" data-v="${k}" role="radio" aria-checked="${F.type === k}"><span class="av-tic ${k}">${ico(ic)}</span><b>${t}</b></button>`).join("")}</div>
      <div class="field"><span>Ça concerne</span><div class="chips av-areas" id="avAreas">${[sel, ...rest].map(([k, ic, t]) => `<button class="chip ${k === F.area ? "on" : ""}" data-act="avArea" data-v="${k}">${ico(ic)}${esc(t)}</button>`).join("")}</div></div>
      <div class="field"><span id="avMsgLbl">Votre message</span><textarea class="input av-ta" id="avText" rows="4" data-bind="ui.afb.text" placeholder="${esc(T[3])}" aria-labelledby="avMsgLbl">${esc(F.text)}</textarea></div>
      <div class="av-shotrow" id="avShot">${avShotHTML()}</div>
      ${avNpsDue() ? `<div class="av-nps" id="avNps"><div class="av-npsq">Recommanderiez-vous Growth Gusto à un autre restaurateur ?<em>Facultatif · une fois par mois</em></div>
        <div class="av-npsg" role="radiogroup" aria-label="Note de 0 à 10">${Array.from({ length: 11 }, (_, i) => `<button class="av-n ${F.nps === i ? "on" : ""} ${i <= 6 ? "lo" : i <= 8 ? "mid" : "hi"}" data-act="avNps" data-v="${i}" role="radio" aria-checked="${F.nps === i}">${i}</button>`).join("")}</div>
        <div class="av-npsl"><span>Pas du tout</span><span>Absolument</span></div></div>` : ""}
      <button class="av-ctx ${F.ctxOpen ? "on" : ""}" data-act="avCtxToggle" aria-expanded="${F.ctxOpen}">${ico("avDevice")}<span>Infos jointes automatiquement</span>${ico("down")}</button>
      <div class="av-ctxd" ${F.ctxOpen ? "" : "hidden"}>${F.ctxOpen ? avCtxRows(avCtxSelf(F.area)) : ""}</div>
      <button class="btn acc block av-send" data-act="avSend" ${F.busy ? "disabled" : ""}>${F.busy ? `<span class="av-spin"></span>Envoi…` : mode === "local" ? `${ico("avMail")}Envoyer par e-mail` : `${ico("avSend")}Envoyer à l'équipe`}</button>
      ${mode === "local" ? `<p class="note av-mnote">Votre messagerie s'ouvre avec le message prêt : il ne reste qu'à appuyer sur Envoyer. Une copie reste ici.</p>` : ""}
    </div>`;
}
const avCtxSelf = (area) => ({ restoName: S.resto?.name, name: S.me.name, role: avRole(), area, ctx: avCtx(area) });
function avCtxRows(f) {
  const c = f.ctx || {};
  const rows = [["Restaurant", f.restoName || "–"], ["Envoyé par", `${f.name || "–"}${f.role ? ` · ${f.role}` : ""}`], ["Écran", avAreaLabel(f.area)], ["Version", c.v || "–"], ["Appareil", `${avUaShort(c.ua)}${c.app ? " · app installée" : ""}`], ["Taille d'écran", c.w ? `${c.w} × ${c.h} px` : "–"]];
  return `<dl class="av-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
}
function avShotHTML() {
  const s = avF().shot;
  if (!s) return `<button class="btn soft block av-addshot" data-act="avShotAdd">${ico("camera")}Joindre une capture ou une photo</button>`;
  return `<div class="av-thumb"><img src="${esc(s.url)}" alt="Capture jointe"><button class="av-thx" data-act="avShotDel" aria-label="Retirer la capture">${ico("x")}</button></div><span class="note">Capture jointe : elle aide beaucoup à comprendre.</span>`;
}
function avThanksHTML(d) {
  const mail = d.mail;
  return `<div class="glass av-thanks st" style="--i:1">
    <div class="av-tk ${d.type}"><span class="av-tkr"></span><span class="av-tkr r2"></span>${ico(d.type === "jadore" ? "avHeart" : "check")}</div>
    <b class="h2">Merci${firstName(S.me.name) ? `, ${esc(firstName(S.me.name))}` : ""} !</b>
    <p class="sub">${mail ? "Votre messagerie s'est ouverte avec le message prêt. Si ce n'est pas le cas, touchez « Ouvrir l'e-mail »." : d.demo ? "Mode démo : l'envoi est simulé, rien n'est parti pour de vrai." : "Votre message est bien arrivé chez l'équipe Growth Gusto. La réponse s'affichera juste en dessous."}</p>
    <div class="av-tkb">${mail ? `<button class="btn acc" data-act="avMailAgain">${ico("avMail")}Ouvrir l'e-mail</button>` : ""}<button class="btn soft" data-act="avAgain">${ico("plus")}Écrire autre chose</button></div></div>`;
}
function avMineHTML() {
  const L = avMine(); const loading = avFbOn() && AVR.mine === null; const seen = avLS.get("gg-afb-seen", 0);
  const head = `<div class="av-lh st" style="--i:4"><span class="h3">Vos envois</span>${L.length ? `<span class="note">${avPlural(L.length, "message")}</span>` : ""}</div>`;
  if (loading) return `${head}<div class="glass empty st" style="--i:5"><span class="av-spin dark"></span></div>`;
  if (!L.length) return `${head}<div class="glass empty st" style="--i:5"><div class="ic">${ico("avSend")}</div><b>Rien envoyé pour l'instant</b>Vos messages et les réponses de l'équipe Growth Gusto apparaîtront ici, avec leur avancement.</div>`;
  return `${head}<div class="av-list">${L.slice(0, 60).map((f, i) => avMineItem(f, i, seen)).join("")}</div>`;
}
function avStatusPill(f) { const R = (f.replies || []).length; const st = AV_ST[f.status] || AV_ST.recu; return R && f.status !== "fait" ? `<span class="pill acc">${ico("avMsg")}Réponse</span>` : `<span class="pill ${st[1]}">${f.status === "fait" ? ico("check") : ""}${st[0]}</span>`; }
const avRepHTML = (r) => `<div class="av-rep"><span class="av-repa">${appIcon(26)}</span><div><b>${esc(r.by || "Équipe Growth Gusto")}<em>${when(r.at)}</em></b><p>${esc(r.text)}</p></div></div>`;
function avMineItem(f, i, seen) {
  const T = avType(f.type); const fresh = avLastReply(f) > seen;
  return `<div class="glass av-mi st ${fresh ? "fresh" : ""}" style="--i:${Math.min(5 + i, 14)}">
    <div class="av-mih"><span class="av-tic sm ${f.type}">${ico(T[2])}</span><span class="av-mit"><b>${T[1]} · ${esc(avAreaLabel(f.area))}</b><em>${when(f.at)}${f.name && f.uid !== S.me.id ? ` · ${esc(firstName(f.name))}` : ""}${f.nps != null ? ` · recommandation ${f.nps}/10` : ""}</em></span>${avStatusPill(f)}</div>
    <p class="av-mtx">${esc(f.text)}</p>
    ${f.shot && f.shot.url ? `<img class="av-mshot" src="${esc(f.shot.url)}" alt="Capture jointe" loading="lazy">` : ""}
    ${(f.replies || []).map(avRepHTML).join("")}
  </div>`;
}

/* ───────── admin inbox ───────── */
VIEWS.avisAdmin = {
  nav: "avis",
  render() {
    if (!avisIsAdmin()) return `<div class="inner narrow">${topBar("Boîte admin")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("avLock")}</div><b>Accès réservé</b>Cette boîte est réservée à l'équipe Growth Gusto.</div></div>`;
    avWatchAll();
    const A = (S.ui.afa ||= { type: "all", st: "open", resto: "all", area: "all" });
    const all = avAll(); const loading = avFbOn() && AVR.all === null;
    const restos = [...new Set(all.map((f) => f.restoName || "Sans nom"))].sort((a, b) => a.localeCompare(b, "fr"));
    const areasUsed = [...new Set(all.map((f) => f.area || "general"))];
    const L = all.filter((f) => (A.type === "all" || f.type === A.type) && (A.st === "all" || (A.st === "open" ? f.status !== "fait" : (f.status || "recu") === A.st)) && (A.resto === "all" || (f.restoName || "Sans nom") === A.resto) && (A.area === "all" || (f.area || "general") === A.area));
    /* NPS over the last 90 days, one answer per person (the latest) */
    const per = {}; all.filter((f) => f.nps != null && Date.now() - f.at < 90 * 864e5).forEach((f) => { const k = (f.rid || "") + "|" + (f.uid || f.name); if (!per[k] || per[k].at < f.at) per[k] = f; });
    const N = Object.values(per).map((f) => f.nps); const pro = N.filter((n) => n >= 9).length, det = N.filter((n) => n <= 6).length; const nps = N.length ? Math.round(((pro - det) / N.length) * 100) : null;
    const open = all.filter((f) => (f.status || "recu") === "recu").length;
    const kpi = `<div class="av-kpis st" style="--i:2">
      <div class="glass av-kpi"><span class="lbl">À lire</span><b class="mono ${open ? "warn" : ""}">${open}</b><span class="note">sur ${avPlural(all.length, "message")}</span></div>
      <div class="glass av-kpi"><span class="lbl">NPS · 90 jours</span><b class="mono ${nps == null ? "" : nps >= 30 ? "ok" : nps >= 0 ? "warn" : "bad"}">${nps == null ? "–" : (nps > 0 ? "+" : "") + nps}</b><span class="note">${N.length ? `${pro} promoteur${pro > 1 ? "s" : ""} · ${det} détracteur${det > 1 ? "s" : ""}` : "aucune réponse"}</span></div>
      <div class="glass av-kpi"><span class="lbl">Restaurants</span><b class="mono">${restos.length}</b><span class="note">ont écrit</span></div>
      <div class="glass av-kpi"><span class="lbl">Par type</span><span class="av-mix">${AV_TYPES.map(([k, t, ic]) => `<span class="av-tic sm ${k}" title="${t}">${ico(ic)}</span><b class="mono">${all.filter((f) => f.type === k).length}</b>`).join("")}</span></div></div>`;
    const sel = (v, label, opts) => `<label class="av-fs"><span>${label}</span><select class="input av-sel" data-bind="ui.afa.${v}" data-rer="1">${opts.map(([k, t]) => `<option value="${esc(k)}" ${A[v] === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
    const filters = `<div class="glass pad av-filt st" style="--i:3">
      <div class="chips">${[["all", "Tout", ""], ...AV_TYPES].map(([k, t, ic]) => `<button class="chip ${A.type === k ? "on" : ""}" data-act="avaF" data-id="type" data-v="${k}">${ic ? ico(ic) : ""}${t}</button>`).join("")}</div>
      <div class="av-fsel">${sel("st", "Statut", [["open", "À traiter"], ["recu", "Reçu"], ["en_cours", "En cours"], ["fait", "Fait"], ["all", "Tous"]])}${sel("resto", "Restaurant", [["all", "Tous"], ...restos.map((r) => [r, r])])}${sel("area", "Écran", [["all", "Tous"], ...areasUsed.map((a) => [a, avAreaLabel(a)])])}</div></div>`;
    const list = loading ? `<div class="glass empty"><span class="av-spin dark"></span></div>` : !L.length ? `<div class="glass empty st" style="--i:4"><div class="ic ok">${ico("check")}</div><b>${all.length ? "Rien avec ces filtres" : "Aucun message pour l'instant"}</b>${all.length ? "Élargissez les filtres." : "Les retours des restaurants arriveront ici."}</div>`
      : `<div class="av-list av-alist">${L.slice(0, 200).map((f, i) => avAdminItem(f, i)).join("")}</div>`;
    return `<div class="inner wide av-wrap">${topBar("Boîte admin", { right: all.length ? `<button class="iconbtn" data-act="avaCsv" aria-label="Exporter en CSV" title="Exporter en CSV">${ico("download")}</button>` : "" })}
      <p class="sub st" style="--i:1;margin:-6px 0 0">Tous les retours, tous restaurants confondus${avFbOn() ? "" : " (copie locale de cet appareil)"}.</p>${kpi}${filters}${list}</div>`;
  },
};
function avAdminItem(f, i) {
  const T = avType(f.type); const R = (f.replies || []).length;
  return `<button class="glass av-ai st ${(f.status || "recu") === "recu" ? "unread" : ""}" style="--i:${Math.min(4 + i, 14)}" data-act="avaOpen" data-id="${esc(f.id)}">
    <span class="av-tic ${f.type}">${ico(T[2])}</span>
    <span class="av-aib"><span class="av-aih"><b>${esc(f.restoName || "Sans nom")}</b>${avStatusPill(f)}</span>
      <span class="av-aitx">${esc(f.text)}</span>
      <span class="av-meta"><span class="pill neu">${esc(avAreaLabel(f.area))}</span>${f.nps != null ? `<span class="pill ${f.nps >= 9 ? "ok" : f.nps >= 7 ? "warn" : "bad"}">NPS ${f.nps}</span>` : ""}${f.shot && f.shot.url ? ico("image") : ""}<span>${esc(firstName(f.name) || "?")}${f.role ? ` · ${esc(f.role)}` : ""} · ${when(f.at)}${R ? ` · ${avPlural(R, "réponse")}` : ""}</span></span></span></button>`;
}
function avAdminSheet(f) {
  const T = avType(f.type); const st = f.status || "recu";
  return `<div class="av-sh"><div class="av-shh"><span class="av-tic ${f.type}">${ico(T[2])}</span><div style="min-width:0;flex:1"><div class="lbl">${T[1]} · ${esc(avAreaLabel(f.area))}</div><div class="h2" style="font-size:19px;margin-top:2px">${esc(f.restoName || "Sans nom")}</div><div class="sub">${esc(f.name || "")}${f.role ? ` · ${esc(f.role)}` : ""} · ${when(f.at)}${f.email ? ` · <a class="av-link" href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : ""}</div></div></div>
    <blockquote class="av-quote">${esc(f.text)}</blockquote>
    ${f.shot && f.shot.url ? `<img class="av-mshot big" src="${esc(f.shot.url)}" alt="Capture jointe">` : ""}
    ${f.nps != null ? `<div class="note">Recommandation : <b class="mono">${f.nps}/10</b></div>` : ""}
    <details class="av-det"><summary>Contexte technique</summary>${avCtxRows(f)}<p class="note av-ua">${esc(f.ctx?.ua || "")}</p></details>
    <div class="seg av-sseg"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${Object.keys(AV_ST).indexOf(st) * 100}%)"></span>${Object.entries(AV_ST).map(([k, [t]]) => `<button class="${k === st ? "on" : ""}" data-act="avaStatus" data-id="${esc(f.id)}" data-v="${k}">${t}</button>`).join("")}</div>
    ${(f.replies || []).map(avRepHTML).join("")}
    <label class="field"><span>Répondre (visible dans l'app du restaurant)</span><textarea class="input av-ta" id="avaReply" rows="4" placeholder="Merci pour ce retour ! …"></textarea></label>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Fermer</button><button class="btn acc" data-act="avaReply" data-id="${esc(f.id)}">${ico("avSend")}Répondre</button></div></div>`;
}

/* ───────── writes ───────── */
async function avFbAdd(doc) { const r = await avFs().add(doc); return r && r.id; }
async function avFbUpdate(id, patch, reply) {
  const ref = avFs().doc(id); const FV = window.firebase.firestore.FieldValue;
  if (reply && FV && FV.arrayUnion) return ref.update({ ...patch, replies: FV.arrayUnion(reply) });
  if (reply) { const cur = avAll().find((f) => f.id === id); return ref.update({ ...patch, replies: [...((cur && cur.replies) || []), reply] }); }
  return ref.update(patch);
}
/* the screenshot: on Firebase it must be reachable by the team, so Storage when there is one, else a small inline JPEG */
async function avShotFor(mode) {
  const s = avF().shot; if (!s) return null;
  if (mode !== "fb") return { id: s.id || "", url: s.url };
  try { if (window.firebase.storage) { const ref = window.firebase.storage().ref(`appFeedback/${S.rid || "x"}/${Date.now()}.jpg`); await ref.put(s.blob, { contentType: "image/jpeg" }); return { id: ref.fullPath, url: await ref.getDownloadURL() }; } } catch (e) { console.warn("storage", e); }
  try { const c = s.canvas; const k = Math.min(1, 900 / Math.max(c.width, c.height)); const c2 = document.createElement("canvas"); c2.width = Math.round(c.width * k); c2.height = Math.round(c.height * k); c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height); return { id: "inline", url: c2.toDataURL("image/jpeg", 0.62) }; } catch (e) { return null; }
}
function avMailUrl(d) {
  const T = avType(d.type);
  const body = `${d.text}\n\n— — —\nType : ${T[1]}\nÉcran : ${avAreaLabel(d.area)}\nRestaurant : ${d.restoName || "–"}\nDe : ${d.name || "–"}${d.role ? ` (${d.role})` : ""}${d.nps != null ? `\nRecommandation : ${d.nps}/10` : ""}${d.hasShot ? "\nCapture : prise sur l'appareil (joignez-la à ce mail si besoin)" : ""}\nVersion ${d.ctx.v} · ${avUaShort(d.ctx.ua)} · ${d.ctx.w}×${d.ctx.h}${d.ctx.app ? " · app installée" : ""}`;
  const subject = `[Growth Gusto] ${T[1]} · ${avAreaLabel(d.area)}${d.restoName ? ` · ${d.restoName}` : ""}`;
  return `mailto:${AV_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function avMailGo(url) { const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
async function avLog(text, ref) { try { await DB.add("events", { type: "feedback", text, at: Date.now(), uid: S.me.id, ref: ref || "" }); } catch (e) {} }

/* ───────── actions ───────── */
Object.assign(ACT, {
  avType: (a, id, v) => {
    const F = avF(); if (F.type === v) return; F.type = v; SFX.tick(); buzz(4);
    $$(".av-type").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } });
    const t = $("#avText"); if (t) t.placeholder = avType(v)[3];
    if (v === "jadore") SFX.tone(1047, 0.12, "sine", 0.022, 0.03);
  },
  avArea: (a, id, v) => { const F = avF(); F.area = v; SFX.tick(); buzz(3); $$("#avAreas .chip").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); const d = $(".av-ctxd"); if (d && !d.hidden) d.innerHTML = avCtxRows(avCtxSelf(v)); },
  avNps: (a, id, v) => { const F = avF(); const n = +v; F.nps = F.nps === n ? null : n; SFX.tone(400 + n * 70, 0.08, "sine", 0.024); buzz(4); $$(".av-n").forEach((b) => { const on = +b.dataset.v === F.nps; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } }); },
  avCtxToggle: (a) => { const F = avF(); F.ctxOpen = !F.ctxOpen; SFX.tap(); a.classList.toggle("on", F.ctxOpen); a.setAttribute("aria-expanded", String(F.ctxOpen)); const d = $(".av-ctxd"); if (d) { d.hidden = !F.ctxOpen; d.innerHTML = avCtxRows(avCtxSelf(F.area)); } },
  avShotAdd: async () => {
    SFX.tap(); const [file] = await pickImage(); if (!file) return;
    try { const { blob, canvas } = await shrink(file, 1400, 0.8); const up = await upload(blob); avF().shot = { id: up.id, url: up.url, blob, canvas }; } catch (e) { console.warn(e); SFX.err(); toast("Image illisible, essayez une autre.", "err"); return; }
    const s = $("#avShot"); if (s) s.innerHTML = avShotHTML(); SFX.ok(); buzz(5);
  },
  avShotDel: () => { avF().shot = null; SFX.close(); const s = $("#avShot"); if (s) s.innerHTML = avShotHTML(); },
  avSend: async (a) => {
    const F = avF(); const ta = $("#avText"); const text = String((ta ? ta.value : F.text) || "").trim();
    if (text.length < 3) { SFX.err(); buzz([20, 40, 20]); if (ta) { ta.classList.remove("shake"); void ta.offsetWidth; ta.classList.add("shake"); ta.focus(); } toast("Écrivez quelques mots avant d'envoyer", "err"); return; }
    const mode = avMode(); F.text = text;
    const d = { rid: S.rid || "", restoName: S.resto?.name || "", uid: S.me.id, name: S.me.name || "", email: avEmail(), role: avRole(), type: F.type, area: F.area, text, ctx: avCtx(F.area), at: Date.now(), status: "recu", replies: [] };
    if (F.nps != null) d.nps = F.nps;
    /* mailto must open inside the tap (popup rules): open it before any await */
    if (mode === "local") avMailGo(avMailUrl({ ...d, hasShot: !!F.shot }));
    F.busy = true; a.disabled = true; a.innerHTML = `<span class="av-spin"></span>Envoi…`; let fid = null;
    try {
      const shot = await avShotFor(mode); if (shot) d.shot = shot;
      if (mode === "fb") fid = await avFbAdd(d);
      else { if (mode === "demo") await new Promise((r) => setTimeout(r, 900)); try { fid = await DB.add("feedback", { source: "app", ...d }); } catch (e) { if (mode !== "demo") throw e; } }
    } catch (e) { console.warn(e); F.busy = false; SFX.err(); toast(mode === "fb" ? "Envoi impossible. Vérifiez la connexion et réessayez." : "Impossible d'enregistrer.", "err"); rerender(); return; }
    if (d.nps != null) { const m = avLS.get("gg-nps", {}); m[S.me.id] = Date.now(); avLS.set("gg-nps", m); }
    avLog(`a envoyé un avis sur l'app (${avType(d.type)[1]} · ${avAreaLabel(d.area)})`, fid);
    Object.assign(F, { busy: false, text: "", nps: null, shot: null, ctxOpen: false, done: { type: d.type, mail: mode === "local", demo: mode === "demo", d: { ...d, hasShot: !!d.shot } } });
    if (ta) ta.blur(); SFX.done(); buzz([8, 40, 12]); rerender();
    const v = $("#viewport .view:not(.leave)"); if (v) v.scrollTop = 0;
    setTimeout(() => { const t = $(".av-tk"); if (t) { const b = t.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2); } }, 260);
  },
  avMailAgain: () => { const D = avF().done; if (!D || !D.d) return; SFX.tap(); avMailGo(avMailUrl(D.d)); },
  avAgain: () => { const F = avF(); F.done = null; SFX.tap(); rerender(); setTimeout(() => { const t = $("#avText"); t && t.focus({ preventScroll: true }); }, 120); },
  /* admin */
  avaF: (a, id, v) => { const A = S.ui.afa; if (!A) return; A[id] = v; SFX.tick(); rerender(); },
  avaOpen: (a, id) => { const f = avAll().find((x) => x.id === id); if (!f) return; SFX.tap(); openSheet(avAdminSheet(f)); },
  avaStatus: async (a, id, v) => {
    const f = avAll().find((x) => x.id === id); if (!f || (f.status || "recu") === v) return;
    const seg = a.closest(".seg"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); const k = $(".knob", seg); if (k) k.style.transform = `translateX(${Object.keys(AV_ST).indexOf(v) * 100}%)`; }
    SFX.tick(); buzz(4);
    try { if (avFbOn()) await avFbUpdate(id, { status: v }); else await DB.update("feedback", id, { status: v }); } catch (e) { console.warn(e); SFX.err(); toast("Modification impossible.", "err"); return; }
    if (v === "fait") { SFX.ok(); toast("Marqué fait"); }
  },
  avaReply: async (a, id) => {
    const f = avAll().find((x) => x.id === id); const ta = $("#avaReply"); if (!f || !ta) return; const text = ta.value.trim();
    if (!text) { SFX.err(); ta.classList.remove("shake"); void ta.offsetWidth; ta.classList.add("shake"); ta.focus(); return; }
    const r = { by: `${firstName(S.me.name) || "L'équipe"} · Growth Gusto`, at: Date.now(), text }; const patch = (f.status || "recu") === "recu" ? { status: "en_cours" } : {};
    a.disabled = true;
    try { if (avFbOn()) await avFbUpdate(id, patch, r); else await DB.update("feedback", id, { ...patch, replies: [...(f.replies || []), r] }); } catch (e) { console.warn(e); a.disabled = false; SFX.err(); toast("Réponse non envoyée. Réessayez.", "err"); return; }
    closeSheet(true); SFX.done(); buzz([8, 30, 8]); toast("Réponse envoyée");
  },
  avaCsv: () => {
    const rows = [["Date", "Restaurant", "Nom", "E-mail", "Rôle", "Type", "Écran", "Message", "NPS", "Statut", "Réponses", "Version", "Appareil", "Écran px"]];
    avAll().slice().sort((a, b) => a.at - b.at).forEach((f) => rows.push([`${dayKey(new Date(f.at))} ${hm(f.at)}`, f.restoName || "", f.name || "", f.email || "", f.role || "", avType(f.type)[1], avAreaLabel(f.area), f.text || "", f.nps ?? "", (AV_ST[f.status] || AV_ST.recu)[0], (f.replies || []).map((r) => r.text).join(" | "), f.ctx?.v || "", avUaShort(f.ctx?.ua), f.ctx?.w ? `${f.ctx.w}x${f.ctx.h}` : ""]));
    saveCsv(`growth-gusto-retours-${dayKey()}.csv`, rows);
  },
});
