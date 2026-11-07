/* Growth Gusto — area: espaces (« les vues » de l'app selon la personne et l'appareil). Prefix « es ».
   Trois espaces, tirés du MÊME menu (NAV, js/core.js) : un espace n'invente aucune entrée, il choisit lesquelles montrer.
     service   « En service »  au restaurant : les outils du poste (cuisine, salle, bar, plonge), gros, en direct.
     moi       « Mon espace »  chez soi : mon planning, mes heures, ce que j'ai fait, mes demandes (congé, échange…).
     pilotage  « Pilotage »    le bureau : tout le restaurant (l'app complète d'avant, sans les pages « Mon espace »).
   Qui voit quoi : gérant et chef = les trois ; équipe = service + moi. Le gérant change ça par personne (Vues & appareils),
   champ members/{id}.esAllow = ["service","moi","pilotage"]. Un espace est une VUE : les droits restent ceux de js/perms.js.
   Cet appareil (localStorage gg-es-dev) : { kind: "perso" | "partage", station: "service" | "cuisine" | "salle" | "pointeuse",
     start: "auto" | espace }. Appareil du restaurant = seulement « En service », jamais « Mon espace » ; un équipier « prend la
     main » (avec son code s'il en a un) et son prénom signe les commandes. Station = l'écran ouvert au lancement.
   Ce compte sur cet appareil (localStorage gg-es-<rid>-<memberId>) : { sp, poste, tiles: { cuisine: [route…] } }.
   Données : collection esRequests (demandes : congé, absence, échange, disponibilités), règles « membres » génériques.
   Démo : « Voir comme » (bouton dans la barre démo, le menu Plus et Vues & appareils) : on devient Camille, Thomas, Sarah,
   Lucas, Hugo ou un appareil partagé (tablette cuisine, téléphone de salle, pointeuse murale), et tout l'app suit. */
"use strict";

Object.assign(IC, {
  esServ: ["f:M4.5 16a7.5 7.5 0 0 1 15 0z", "M4.5 16a7.5 7.5 0 0 1 15 0", "M3 16h18", "M12 8.5V7", "M10.5 7h3", "M4 19.5h16", "M19.6 5.4 21 4", "M4.4 5.4 3 4"],
  esMoi: ["f:M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "c:12,8.5,4", "M4.5 20.5c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5"],
  esPilot: ["f:M3.5 8A4.5 4.5 0 0 1 8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16z", "r:3.5,3.5,17,17,4.5", "M8 16v-3", "M12 16V8", "M16 16v-5"],
  esLayers: ["f:M12 3.5 21 8l-9 4.5L3 8z", "M12 3.5 21 8l-9 4.5L3 8z", "M3 12l9 4.5 9-4.5", "M3 16l9 4.5 9-4.5"],
  esSun: ["f:M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", "c:12,12,4", "M12 2.8v2", "M12 19.2v2", "M2.8 12h2", "M19.2 12h2", "M5.5 5.5l1.4 1.4", "M17.1 17.1l1.4 1.4", "M5.5 18.5l1.4-1.4", "M17.1 6.9l1.4-1.4"],
  esSwap: ["M4 8h14", "m14.5 4.5 3.5 3.5-3.5 3.5", "M20 16H6", "m9.5 12.5-3.5 3.5 3.5 3.5"],
  esBand: ["f:M7.8 3.9 20.1 16.2a2.8 2.8 0 0 1-3.9 3.9L3.9 7.8a2.8 2.8 0 0 1 3.9-3.9z", "M7.8 3.9 20.1 16.2a2.8 2.8 0 0 1-3.9 3.9L3.9 7.8a2.8 2.8 0 0 1 3.9-3.9z", "M10.5 11.5h.01", "M12.5 13.5h.01", "M12.5 10.5h.01", "M10.5 13.5h.01"],
  esHand: ["M8 13V5.5a1.5 1.5 0 0 1 3 0V12", "M11 11V4.5a1.5 1.5 0 0 1 3 0V12", "M14 11.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7-2.8 0-4.2-1.4-5.6-3.6l-2.3-3.3a1.5 1.5 0 0 1 2.4-1.8L8 14"],
  esInbox: ["f:M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z", "M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5", "M3.5 13.5 6 5.5A1.5 1.5 0 0 1 7.4 4.5h9.2A1.5 1.5 0 0 1 18 5.5l2.5 8V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"],
  esHist: ["M3.5 12a8.5 8.5 0 1 0 2.5-6", "M3.5 3.5V8H8", "M12 7.5V12l3 2"],
  esEye: ["M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", "c:12,12,3", "f:M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"],
  esHand2: ["M7 11.5 10.5 8a2 2 0 0 1 2.8 0l.2.2", "M3 12.5l3.5-3.5 4 1 3.5-2 7 7", "M14 18.5l-1.5 1.5a1.5 1.5 0 0 1-2.1 0l-5-5", "M17 16l-2.5 2.5"],
});

/* ───────────── the single definition of the spaces ───────────── */
const ES_SP = {
  service: { t: "En service", short: "Service", kick: "Au restaurant", ic: "esServ", c: "#1B1530", c2: "#EF5A3C", d: "Les outils de votre poste, en grand, en direct." },
  moi: { t: "Mon espace", short: "Moi", kick: "Pour moi", ic: "esMoi", c: "#2F5FBF", c2: "#9EC5FF", d: "Mon planning, mes heures, mes demandes." },
  pilotage: { t: "Pilotage", short: "Pilotage", kick: "Le bureau", ic: "esPilot", c: "#5B2BFF", c2: "#9A7BFF", d: "Tout le restaurant : chiffres, équipe, stock." },
};
const ES_ORDER = ["service", "moi", "pilotage"];
/* service by poste: the tools (routes of NAV, in this order) and the 3 middle tabs [t1, fab, t3] */
const ES_POSTES = {
  cuisine: { t: "Cuisine", ic: "pmToque", tools: ["cuisine", "coupdefeu", "releve", "service", "scan", "reception", "notes", "menage", "gaspillage", "hygiene", "frigos", "stock"], tabs: [["cuisine", "slHat", "Bons"], ["scan", "scan", "Scanner"], ["releve", "therm", "Relevés"]], cta: ["cuisine", "slHat", "Ouvrir l'écran cuisine"] },
  salle: { t: "Salle", ic: "pmCloche", tools: ["salle", "plan", "resa", "coupdefeu", "commandes", "cuisine", "clients", "notes", "menage", "livraison"], tabs: [["plan", "plZone", "Salle"], ["salle", "slPad", "Commande"], ["resa", "resa", "Résas"]], cta: ["salle", "slPad", "Prendre une commande"] },
  bar: { t: "Bar", ic: "pmGlass", tools: ["salle", "plan", "coupdefeu", "releve", "scan", "stock", "reception", "notes", "menage"], tabs: [["salle", "slPad", "Commandes"], ["scan", "scan", "Scanner"], ["stock", "box", "Stock"]], cta: ["salle", "slPad", "Prendre une commande"] },
  plonge: { t: "Plonge", ic: "pmDrop", tools: ["menage", "hygiene", "gaspillage", "releve", "notes", "scan"], tabs: [["menage", "spray", "Ménage"], ["scan", "scan", "Scanner"], ["hygiene", "hygPot", "Hygiène"]], cta: ["menage", "spray", "Cocher le ménage"] },
};
const ES_POSTE_OF = { cuisine: "cuisine", second: "cuisine", salle: "salle", bar: "bar", plonge: "plonge" };
const ES_ALWAYS = ["consignes", "pointeuse", "espaces", "reglages"];
const ES_MOI = ["moiPlanning", "moiHeures", "moiActivite", "moiDemandes"];
const ES_MOI_SET = ["home", ...ES_MOI, "pointeuse", "consignes", "frais", "formation", "avis", "espaces", "reglages"];
const ES_TABS_MOI = [["moiPlanning", "cal", "Planning"], ["pointeuse", "clock", "Pointer"], ["moiHeures", "esHist", "Heures"]];
/* request kinds: [id, icon, title, verb] */
const ES_REQ = [["conge", "esSun", "Congé", "un congé"], ["absence", "esBand", "Absence", "une absence"], ["echange", "esSwap", "Échange de service", "un échange"], ["dispo", "esHand", "Disponibilités", "mes disponibilités"]];
const ES_REQ_OF = Object.fromEntries(ES_REQ.map((r) => [r[0], r]));
/* demo personas: [memberId, what they see, device preset] */
const ES_PERSONAS = [
  ["demo-camille", "Gérante : pilotage, service et son espace", null],
  ["demo-thomas", "Chef de cuisine : service cuisine et pilotage", null],
  ["demo-sarah", "Serveuse : prise de commande et son planning", null],
  ["demo-lucas", "Commis : écran cuisine, relevés, ses heures", null],
  ["demo-hugo", "Plongeur extra : ménage, hygiène, ses heures", null],
];
const ES_DEVICES = [
  ["cuisine", "slHat", "Tablette de la cuisine", "Partagée, s'ouvre sur l'écran cuisine"],
  ["salle", "slPad", "Téléphone de salle prêté", "Partagé, chacun prend la main avec son code"],
  ["pointeuse", "clock", "Pointeuse murale", "Une tablette à l'entrée pour pointer"],
];

const ES = { sp: null, demoDev: null, kioskDone: false, edit: false, wk: 0, mo: 0, hm: 0, view: "week", act: "all", unlock: false, F: null, pin: null, tabs0: null };

/* ───────────── storage ───────────── */
const esLSget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : d; } catch (e) { return d; } };
const esLSset = (k, v) => { if (DB.mode === "demo") return; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ES_DEV0 = { kind: "perso", station: "service", start: "auto" };
function esDev() { if (DB.mode === "demo") return { ...ES_DEV0, ...(ES.demoDev || {}) }; return { ...ES_DEV0, ...esLSget("gg-es-dev", {}) }; }
function esDevSet(patch) { const d = { ...esDev(), ...patch }; if (DB.mode === "demo") ES.demoDev = d; else esLSset("gg-es-dev", d); return d; }
const esUKey = () => `gg-es-${S.rid || ""}-${(S.me && S.me.id) || ""}`;
const ES_UMEM = {};
function esUser() { if (DB.mode === "demo") return (ES_UMEM[esUKey()] ||= {}); return esLSget(esUKey(), {}); }
function esUserSet(fn) { const u = { ...esUser() }; fn(u); if (DB.mode === "demo") ES_UMEM[esUKey()] = u; else esLSset(esUKey(), u); return u; }
const esShared = () => esDev().kind === "partage";

/* ───────────── who am I, what may I see ───────────── */
const esMember = (id = S.me.id) => (S.members || []).find((m) => m.id === id) || null;
const esRole = () => (typeof myRole === "function" ? myRole() : "gerant");
const esIsMgr = () => ["gerant", "chef"].includes(esRole());
function esAllowedFor(m, role) {
  if (m && Array.isArray(m.esAllow)) { const a = ES_ORDER.filter((k) => m.esAllow.includes(k)); if (a.length) return a; }
  return role === "equipe" ? ["service", "moi"] : ES_ORDER.slice();
}
function esAllowed() {
  if (!S.resto) return ["pilotage"];
  if (esShared()) return ES.unlock ? ["service", "pilotage"] : ["service"];
  return esAllowedFor(esMember(), esRole());
}
function esStaff(mid = S.me.id) { return (S.staff || []).find((s) => s.memberId === mid && s.active !== false) || null; }
function esPoste() {
  const u = esUser(); if (ES_POSTES[u.poste]) return u.poste;
  const d = esDev(); if (esShared() && ES_POSTES[d.station]) return d.station;
  const m = esMember(); return ES_POSTE_OF[(m && m.poste) || ""] || (m && m.role === "gerant" ? "salle" : "cuisine");
}
/* now on shift (clocked in, or a planned shift from 45 min before to its end) */
function esOnShift() {
  const st = esStaff(); if (!st) return false;
  try { if (typeof rhState === "function" && rhState(st.id).state !== "off") return true; } catch (e) {}
  if (typeof rhShiftsOf !== "function") return false; const now = Date.now() / 60000;
  return rhShiftsOf(st.id, addDays(dayKey(), -1), dayKey()).map(rhIv).some((iv) => now >= iv.s - 45 && now < iv.e);
}
function esAuto() {
  const al = esAllowed(); if (esShared()) return "service";
  const d = esDev(); if (d.start && d.start !== "auto" && al.includes(d.start)) return d.start;
  const m = esMember(); if (m && m.esDef && al.includes(m.esDef)) return m.esDef;
  if (al.includes("pilotage") && esIsMgr()) return "pilotage";
  if (al.includes("service") && esOnShift()) return "service";
  return al.includes("moi") ? "moi" : al[0];
}
function esCur() {
  const al = esAllowed();
  if (ES.sp && al.includes(ES.sp)) return ES.sp;
  const sp = esAuto(); /* each launch: the device's choice, else the context (on shift → service, manager → pilotage) */
  if (DB.mode !== "db" || esMember()) ES.sp = sp; /* signed in: wait for the team to load before settling (the role decides) */
  return sp;
}
const esIs = (sp) => esCur() === sp;

/* ───────────── the menu: one NAV, filtered per space ───────────── */
(function esNavInit() {
  if (NAV.some((n) => n[0] === "moiPlanning")) return;
  const at = (r) => NAV.findIndex((n) => n[0] === r);
  const p = at("planning"); NAV.splice(p >= 0 ? p + 1 : NAV.length, 0, ["esDemandes", "esInbox", "Demandes de l'équipe"]);
  const s = NAV.findIndex((n) => n[0] === "sep" && n[2] === "Restaurant");
  NAV.splice(s >= 0 ? s : NAV.length, 0, ["sep", "", "Mon espace"], ["moiPlanning", "cal", "Mon planning"], ["moiHeures", "esHist", "Mes heures"], ["moiActivite", "activity", "Mon activité"], ["moiDemandes", "esSun", "Mes demandes"]);
  const r = at("reglages"); NAV.splice(r >= 0 ? r : NAV.length, 0, ["espaces", "esLayers", "Vues & appareils"]);
  Object.assign(TAB_OF, { moiPlanning: "more", moiHeures: "more", moiActivite: "more", moiDemandes: "more", esDemandes: "more", espaces: "more" });
})();
/* the routes of the current space (null = every route, pilotage) */
function esSet(sp = esCur()) {
  if (sp === "pilotage") return null;
  if (sp === "moi") return new Set(ES_MOI_SET);
  const u = esUser(); const ps = esPoste(); const tools = (u.tiles && Array.isArray(u.tiles[ps]) ? u.tiles[ps] : ES_POSTES[ps].tools);
  return new Set(["home", ...tools, ...ES_POSTES[ps].tabs.map((t) => t[0]), ...ES_ALWAYS]);
}
const esHomeLbl = (sp = esCur()) => (sp === "pilotage" ? null : ES_SP[sp].t);
/* the groups of a space: [title, routes]; pilotage keeps NAV's own sections */
function esPlan(sp = esCur()) {
  if (sp === "moi") return [["Mon espace", [...ES_MOI, "pointeuse", "consignes", "frais", "formation", "avis"]], ["Réglages", ["espaces", "reglages"]]];
  const ps = esPoste(); const u = esUser(); const tools = u.tiles && Array.isArray(u.tiles[ps]) ? u.tiles[ps] : ES_POSTES[ps].tools;
  return [[`Mes outils · ${ES_POSTES[ps].t}`, [...ES_POSTES[ps].tabs.map((t) => t[0]), ...tools]], ["Équipe", ["consignes", "pointeuse"]], ["Réglages", ["espaces", "reglages"]]];
}
function esFilterNav(list) {
  const sp = esCur(); const out = [];
  if (sp === "pilotage") {
    list.forEach((n) => { const r = n[0]; if (r !== "sep") { if (ES_MOI.includes(r) || (r === "esDemandes" && !esIsMgr())) return; } else if (out.length && out[out.length - 1][0] === "sep") out.pop(); out.push(n); });
    while (out.length && out[out.length - 1][0] === "sep") out.pop();
    return out;
  }
  /* En service / Mon espace: the same NAV rows (with the person's names, icons, colours), in the order of the space */
  const row = {}; list.forEach((n) => { if (n[0] !== "sep") row[n[0]] = n; });
  const home = row.home ? row.home.slice() : ["home", "home", ""]; home[1] = ES_SP[sp].ic; home[2] = ES_SP[sp].t; out.push(home);
  const used = new Set(["home"]);
  esPlan(sp).forEach(([t, rs]) => { const its = rs.filter((r) => row[r] && !used.has(r) && used.add(r)).map((r) => row[r]); if (its.length) out.push(["sep", "", t], ...its); });
  return out;
}
/* every route the current space shows (used by tools/nav-test.js) */
function esNavRoutes() { return esFilterNav(NAV.filter((n) => n[0] === "sep" || (VIEWS[n[0]] && (typeof canSee !== "function" || canSee(n[0]))))).filter((n) => n[0] !== "sep").map((n) => n[0]); }

(function esHooks() {
  /* side nav */
  const pz0 = typeof pzNav === "function" ? pzNav : null;
  window.pzNav = function () { return esFilterNav(pz0 ? pz0() : navAllowed()); };
  /* menu Plus (phone, tablet): same entries as the side nav, in its sections */
  const pm0 = typeof pzMoreGroups === "function" ? pzMoreGroups : null;
  window.pzMoreGroups = function (groups) {
    const g = pm0 ? pm0(groups) : groups; const sp = esCur();
    if (sp === "pilotage") return g.map(([t, its]) => [t, its.filter((it) => !ES_MOI.includes(it[0]) && (it[0] !== "esDemandes" || esIsMgr()))]).filter(([, its]) => its.length);
    /* exactly the side nav of the space (NAV, filtered and grouped by esFilterNav), with Plus's badges */
    const by = {}; g.forEach(([, its]) => its.forEach((it) => { by[it[0]] = it; }));
    const out = []; let cur = null;
    esFilterNav(pzNav0()).forEach(([r, i, t, c]) => { if (r === "sep") { cur = [t, []]; out.push(cur); return; } if (r === "home" || !cur) return; cur[1].push(by[r] || [r, i, t, 0, "", c || ""]); });
    return out.filter(([, its]) => its.length);
  };
  function pzNav0() { return pz0 ? pz0() : navAllowed(); }
  /* tab bar: each space has its own five tabs */
  ES.tabs0 = TABS.map((t) => t.slice());
  const pt0 = typeof pzApplyTabs === "function" ? pzApplyTabs : null;
  window.pzApplyTabs = function () {
    ES.tabs0.forEach((t, i) => { TABS[i] = t.slice(); });
    if (pt0) pt0();
    const sp = esCur(); if (sp === "pilotage") return;
    const mid = sp === "moi" ? ES_TABS_MOI : ES_POSTES[esPoste()].tabs;
    TABS[0] = ["home", ES_SP[sp].ic, ES_SP[sp].short]; TABS[1] = mid[0].slice(); TABS[2] = mid[1].slice(); TABS[3] = mid[2].slice();
    const on = new Set(TABS.map((t) => t[0]));
    Object.keys(TAB_OF).forEach((k) => { const v = TAB_OF[k]; TAB_OF[k] = on.has(k) ? k : on.has(v) && v !== "home" ? v : k === "home" ? "home" : "more"; });
  };
  /* sidebar: the space switcher under the restaurant */
  const rc0 = renderChrome;
  window.renderChrome = function () {
    rc0();
    try {
      const side = $("#side"); const sp = esCur(); document.documentElement.dataset.es = sp;
      if (side && S.resto && !$(".es-sw", side)) { const nav = $(".navs", side); if (nav) nav.insertAdjacentHTML("beforebegin", esSwitch("side")); }
    } catch (e) {}
  };
  /* « Aujourd'hui » becomes the home of the space */
  const H = VIEWS.home; const r0 = H.render, a0 = H.after;
  H.render = function (p) {
    const sp = esCur();
    if (sp === "service") return esServiceView();
    if (sp === "moi") return esMoiView();
    const html = r0.call(this, p); const strip = esPilotStrip();
    return html.replace(/(<\/header>)/, `$1${esSwitch("hd")}${strip}`);
  };
  H.after = function (v) {
    const sp = esCur();
    if (sp !== "pilotage") { esCount(v); esKiosk(); return; }
    if (a0) a0.call(this, v);
  };
  /* Plus: the switcher at the top */
  const M = VIEWS.more; const m0 = M.render;
  M.render = function (p) { const h = m0.call(this, p); const k = '<div class="lbl st cc-sec"'; return h.includes(k) ? h.replace(k, esSwitch("more") + k) : h; };
  /* « Mon espace »: the DLC alarm count belongs to the kitchen, not to my personal home */
  const uc0 = urgentCount; window.urgentCount = function () { return esCur() === "moi" ? 0 : uc0(); };
  /* shared device: the person who took over signs the audit trail */
  const lg0 = logEvent;
  window.logEvent = function (type, text, extra = {}) { const a = esActor(); return lg0(type, text, a ? { actor: a.name, actorId: a.id, ...extra } : extra); };
})();

/* ───────────── the switcher (sidebar, home headers, Plus) ───────────── */
function esSwitch(where) {
  const al = esAllowed(); if (al.length < 2 && !(DB.mode === "demo")) return "";
  const sp = esCur(); const k = Math.max(0, al.indexOf(sp));
  const seg = al.length > 1 ? `<div class="es-sw es-${where}" role="tablist" aria-label="Changer d'espace" style="--n:${al.length};--k:${k};--c:${ES_SP[sp].c}">
    <span class="es-kn" aria-hidden="true"></span>${al.map((x) => `<button role="tab" aria-selected="${x === sp}" class="${x === sp ? "on" : ""}" data-act="esGo" data-v="${x}">${ico(ES_SP[x].ic)}<span>${where === "side" ? ES_SP[x].short : ES_SP[x].short}</span></button>`).join("")}</div>` : "";
  const demo = DB.mode === "demo" && where !== "side" ? esDemoChip(where) : "";
  return where === "more" ? `<div class="es-morew st" style="--i:1">${seg}${demo}</div>` : where === "side" ? seg + (DB.mode === "demo" ? esDemoChip("side") : "") : `<div class="es-hdw st${seg ? "" : " solo"}" style="--i:1">${seg}${demo}</div>`;
}
function esDemoChip(where) {
  const m = esMember(); const d = esDev();
  const who = esShared() ? (ES_DEVICES.find((x) => x[0] === d.station) || ES_DEVICES[0])[2] : `${firstName(S.me.name || (m && m.name) || "Camille")} · ${esJob(S.me.id)}`;
  return `<button class="es-asb es-as-${where}" data-act="esDemoPick">${esShared() ? `<span class="es-asd">${ico("pmTablet")}</span>` : avatar(S.me.id, true)}<span><em>Voir comme</em><b>${esc(who)}</b></span>${ico("down")}</button>`;
}
function esJob(mid) { const s = (S.staff || []).find((x) => x.memberId === mid); const m = esMember(mid); return (s && s.role) || (m && ROLES[m.role]) || ""; }

/* ───────────── switching, with the morph ───────────── */
function esApply(sp, ev, opts = {}) {
  const al = esAllowed(); if (!al.includes(sp)) return;
  const from = esCur(); if (sp === from && !opts.force) { if (S.route !== "home") go("home", {}, { replace: true }); return; }
  esUserSet((u) => { u.sp = sp; });
  const swap = () => {
    ES.sp = sp; ES.edit = false; document.documentElement.dataset.es = sp;
    try { if (typeof PZ !== "undefined") PZ.cache = null; } catch (e) {}
    const tb = $("#tabbar"); if (tb) delete tb.dataset.built;
    $$(".es-sw").forEach((w) => w.remove());
    S.history = []; go("home", {}, { replace: true, tab: true }); renderChrome();
  };
  /* the knob slides first, then the colour of the space floods from the tap */
  $$(".es-sw").forEach((w) => { const i = al.indexOf(sp); w.style.setProperty("--k", i); w.style.setProperty("--c", ES_SP[sp].c); $$("button", w).forEach((b) => b.classList.toggle("on", b.dataset.v === sp)); });
  SFX.tap(); buzz(8);
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || opts.quiet) { swap(); return; }
  esMorph(sp, ev, swap);
}
function esMorph(sp, ev, mid) {
  const D = ES_SP[sp]; const x = ev && ev.clientX ? ev.clientX : innerWidth / 2, y = ev && ev.clientY ? ev.clientY : innerHeight / 3;
  $$(".es-morph").forEach((e) => e.remove());
  const el = document.createElement("div"); el.className = `es-morph es-m-${sp}`; el.setAttribute("aria-hidden", "true");
  el.style.cssText = `--x:${x}px;--y:${y}px;--c:${D.c};--c2:${D.c2}`;
  el.innerHTML = `<i class="es-mg"></i><div class="es-mc"><span class="es-mi">${ico(D.ic)}</span><b>${esc(D.t)}</b><em>${esc(D.d)}</em></div>`;
  document.body.appendChild(el); setTimeout(() => { try { SFX.sheet(); } catch (e) {} }, 60);
  setTimeout(() => { mid(); }, 520);
  setTimeout(() => { el.classList.add("out"); try { SFX.ok(); } catch (e) {} buzz(10); }, 820);
  setTimeout(() => el.remove(), 1350);
}

/* ───────────── shared device: who took over ───────────── */
const esActKey = () => `gg-es-actor-${S.rid || ""}`;
function esActor() {
  if (!esShared() || !S.rid) return null;
  const a = DB.mode === "demo" ? ES.demoActor : esLSget(esActKey(), null);
  return a && a.id && Date.now() - (a.at || 0) < 14 * 36e5 ? a : null;
}
function esActorName() { const a = esActor(); return a ? a.name : ""; }
function esSetActor(m) {
  const a = m ? { id: m.id, name: m.name || "", color: m.color || "", at: Date.now() } : null;
  if (DB.mode === "demo") ES.demoActor = a; else { try { a ? localStorage.setItem(esActKey(), JSON.stringify(a)) : localStorage.removeItem(esActKey()); } catch (e) {} }
}
function esTeam() { return (S.members || []).filter((m) => m.role !== "kiosk" && m.name).sort((a, b) => (a.name || "").localeCompare(b.name || "")); }
function esActorSheet() {
  const team = esTeam(); const cur = esActor();
  openSheet(`<div class="es-sh"><div class="es-shh"><span class="h2">Qui prend la main ?</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Ce téléphone appartient au restaurant. Votre prénom signera les commandes et ce que vous faites.</p>
    <div class="es-team">${team.map((m, i) => `<button class="es-tm${cur && cur.id === m.id ? " on" : ""}" style="--i:${i}" data-act="esActorPick" data-id="${esc(m.id)}">${avatar(m.id)}<b>${esc(firstName(m.name))}</b><em>${esc(esJob(m.id))}</em>${typeof ccHasPin === "function" && ccHasPin(m) ? `<i class="es-lk">${ico("lock")}</i>` : ""}</button>`).join("")}</div>
    ${cur ? `<button class="btn ghost block" data-act="esActorOff">${ico("out")}Rendre l'appareil</button>` : ""}</div>`);
}
function esPinSheet() {
  const P = ES.pin; const m = esMember(P.id); const dots = [0, 1, 2, 3].map((i) => `<i class="${i < P.code.length ? "on" : ""}"></i>`).join("");
  openSheet(`<div class="es-sh es-pin"><div class="es-pinw">${avatar(P.id)}<div class="h2">${esc(firstName(m && m.name))}</div><div class="sub">${P.err ? `<span style="color:var(--bad)">${esc(P.err)}</span>` : "Tapez votre code"}</div></div>
    <div class="es-dots${P.err ? " err" : ""}">${dots}</div>
    <div class="keypad es-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="esKey" data-v="${d}">${d}</button>`).join("")}<button data-act="sheetClose" aria-label="Annuler">${ico("x")}</button><button data-act="esKey" data-v="0">0</button><button data-act="esKey" data-v="del" aria-label="Effacer">${ico("back")}</button></div></div>`);
}
function esTookOver(m) { esSetActor(m); closeSheet(); SFX.ok(); buzz([8, 30, 8]); toast(`${firstName(m.name)} prend la main`); rerender(); renderChrome(); }
/* kiosk stations: the screen the device opens on, once per launch */
function esKiosk() {
  if (ES.kioskDone || !esShared()) return; ES.kioskDone = true;
  const st = esDev().station; if (["cuisine", "salle", "pointeuse"].includes(st) && VIEWS[st]) setTimeout(() => { if (S.route === "home") go(st, {}, { replace: true }); }, 60);
}

/* ───────────── small bits ───────────── */
const esPl = (n, w, ws) => `${n} ${n > 1 ? ws || w + "s" : w}`;
const esH = (min) => { min = Math.max(0, Math.round(min || 0)); const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${pad(m)}` : `${h}h`; };
const esDayLbl = (k) => { const d = parseDay(k); return `${DAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase())} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const esDow = (k) => ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][parseDay(k).getDay()];
const esMonday = (k = dayKey()) => { const d = parseDay(k); return addDays(k, -((d.getDay() + 6) % 7)); };
const esTry = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
function esGreet() { const h = new Date().getHours(); return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour"; }
function esDateBtn() { const now = new Date(); return `<button class="hm-date" data-act="restoSwitch">${typeof restoLogo === "function" && restoLogo() ? restoMark(22) : ""}<span>${DAYS[now.getDay()].replace(/^./, (c) => c.toUpperCase())} ${now.getDate()} ${MONTHS[now.getMonth()]} · ${esc(S.resto?.name || "")}</span>${ico("down")}</button>`; }
const esNavRow = (r) => NAV.find((n) => n[0] === r);
const ES_WELLS = ["w-vi", "w-sa", "w-sk", "w-to", "w-mi", "w-in", "w-nd"];
const ES_WELL = { cuisine: "w-to", salle: "w-vi", plan: "w-sk", resa: "w-sa", coupdefeu: "w-to", releve: "w-vi", service: "w-sa", scan: "w-in", reception: "w-sa", notes: "w-to", menage: "w-sk", gaspillage: "w-mi", hygiene: "w-sk", frigos: "w-sk", stock: "w-to", commandes: "w-vi", clients: "w-mi", livraison: "w-sa", consignes: "w-vi", pointeuse: "w-mi" };
function esCount(v) { $$("[data-to]", v).forEach((el, i) => { const to = +el.dataset.to; if (!isFinite(to)) return; if (typeof countTo === "function") setTimeout(() => countTo(el, 0, to, 800), 120 + i * 70); else el.textContent = to; }); $$(".es-ring i, .es-bar i", v).forEach((el) => requestAnimationFrame(() => setTimeout(() => el.classList.add("on"), 160))); }

/* ═══════════════════════════ EN SERVICE ═══════════════════════════ */
function esLive(ps) {
  try { if (typeof slWatch === "function") slWatch(); } catch (e) {}
  const K = esTry(() => (typeof slKitchen === "function" ? slKitchen() : []), []);
  const ready = K.filter((o) => o.status === "prete").length, cook = K.filter((o) => o.status !== "prete" && o.status !== "attente").length;
  const tabs = esTry(() => (typeof slOpenTabs === "function" ? slOpenTabs().length : 0), 0);
  const covers = esTry(() => (typeof slOpenTabs === "function" ? slOpenTabs().reduce((a, t) => a + (+t.covers || 0), 0) : 0), 0);
  const resa = esTry(() => (typeof rsOfDay === "function" ? rsOfDay(dayKey()).filter((b) => (typeof rsLive === "function" ? rsLive(b) : !["noshow", "annule"].includes(b.status))) : []), []);
  const ts = esTry(() => todayStats(S.slot || slotNow()), { done: 0, exp: 0 }); const rel = Math.max(0, ts.exp - ts.done);
  const ch = esTry(() => homeChoreStats(), { due: [], done: 0, total: 0 });
  const web = esTry(() => (typeof CMD !== "undefined" && CMD.unseen ? CMD.unseen() : 0), 0);
  const cs = esTry(() => (typeof csUnread === "function" ? csUnread() : 0), 0);
  /* [value, label, sub, route, tone] */
  const S_ = {
    cook: [cook, "En cuisine", cook > 1 ? "bons en cours" : "bon en cours", "cuisine", cook ? "hot" : ""],
    ready: [ready, "Au passe", ready ? "à envoyer" : "rien n'attend", ps === "cuisine" ? "cuisine" : "salle", ready ? "warn" : ""],
    tabs: [tabs, "Tables", covers ? `${covers} couverts` : "ouvertes", "salle", ""],
    resa: [resa.length, "Réservations", `${resa.reduce((a, b) => a + (+b.covers || 0), 0)} couverts aujourd'hui`, "resa", ""],
    rel: [rel, "Relevés", rel ? `à faire ce ${S.slot || slotNow()}` : "tout est fait", "releve", rel ? "warn" : "ok"],
    men: [ch.due.length, "Ménage", ch.total ? `${ch.done} / ${ch.total} faites` : "à configurer", "menage", ch.due.length ? "" : "ok"],
    web: [web, "En ligne", web ? "nouvelles commandes" : "commandes", "commandes", web ? "warn" : ""],
    cs: [cs, "Consignes", cs ? "à lire" : "tout est lu", "consignes", cs ? "acc" : "ok"],
  };
  const pick = { cuisine: ["cook", "ready", "rel", "men"], salle: ["tabs", "ready", "resa", "web"], bar: ["tabs", "ready", "rel", "men"], plonge: ["men", "rel", "cs"] }[ps];
  return { stats: pick.map((k) => S_[k]).filter((s) => VIEWS[s[3]] && permOk(s[3])), cook, ready, tabs, resa: resa.length, rel, men: ch.due.length };
}
function esTiles(ps) {
  const u = esUser(); const list = u.tiles && Array.isArray(u.tiles[ps]) ? u.tiles[ps] : ES_POSTES[ps].tools;
  return list.filter((r) => VIEWS[r] && esNavRow(r) && permOk(r));
}
function esServiceView() {
  const ps = esPoste(); const P = ES_POSTES[ps]; const L = esLive(ps); const sh = esShared(); const actor = esActor();
  const now = new Date(); const slot = S.slot || slotNow(); const st = esStaff();
  const head = P.cta; const big = ps === "cuisine" ? (L.cook ? esPl(L.cook, "bon") + " en cuisine" : "Cuisine calme") : ps === "plonge" ? (L.men ? esPl(L.men, "tâche") + " de ménage" : "Tout est propre") : L.tabs ? esPl(L.tabs, "table") + " ouverte" + (L.tabs > 1 ? "s" : "") : "Salle prête";
  const sub = ps === "cuisine" ? (L.ready ? `${esPl(L.ready, "assiette")} au passe` : "Rien n'attend au passe") : ps === "plonge" ? (L.rel ? `${esPl(L.rel, "relevé")} à faire` : "Relevés à jour") : L.ready ? `${esPl(L.ready, "plat")} prêt${L.ready > 1 ? "s" : ""} à servir` : L.resa ? `${esPl(L.resa, "réservation")} aujourd'hui` : "Aucune réservation pour l'instant";
  const postes = Object.entries(ES_POSTES).map(([k, x]) => `<button class="${k === ps ? "on" : ""}" data-act="esPoste" data-v="${k}" aria-pressed="${k === ps}">${ico(x.ic)}<span>${x.t}</span></button>`).join("");
  const hero = `<section class="es-hero es-hs st" style="--i:2">
    <span class="es-glow" aria-hidden="true"><i></i><i></i></span>
    <div class="es-hk"><span class="es-live"><i></i>Service du ${esc(slot)}</span><span class="mono es-clock" data-es-clock>${pad(now.getHours())}:${pad(now.getMinutes())}</span></div>
    <div class="es-hb">${esc(big)}</div><div class="es-hsub">${esc(sub)}</div>
    <div class="es-postes" role="group" aria-label="Mon poste sur cet appareil">${postes}</div>
    <div class="es-ctas">${VIEWS[head[0]] && permOk(head[0]) ? `<button class="es-cta" data-go="${head[0]}"><span class="es-ctai">${ico(head[1])}</span><span>${esc(head[2])}</span>${ico("arrow")}</button>` : ""}
    ${VIEWS.coupdefeu && permOk("coupdefeu") ? `<button class="es-cf" data-act="esCf" aria-label="Mode coup de feu">${ico("cfFlame")}<span>Coup de feu</span></button>` : ""}</div>
  </section>`;
  /* who is on this device / my clock-in */
  let who = "";
  if (sh) who = `<button class="es-who st${actor ? " on" : ""}" style="--i:3" data-act="esActor">${actor ? avatar(actor.id) : `<span class="es-whoq">${ico("users")}</span>`}<span><b>${actor ? `${esc(firstName(actor.name))} a la main` : "Qui prend la main ?"}</b><em>${actor ? "Touchez pour passer à quelqu'un d'autre" : "Appareil du restaurant · touchez votre prénom"}</em></span>${ico("esSwap")}</button>`;
  else if (st && VIEWS.pointeuse && permOk("pointeuse")) {
    const s = esTry(() => rhState(st.id), { state: "off" }); const on = s.state !== "off";
    who = `<button class="es-who st${on ? " on" : ""}" style="--i:3" data-act="homePunch"><span class="es-whoq ${on ? "ok" : ""}">${ico("clock")}</span><span><b>${on ? (s.state === "pause" ? `En pause depuis ${hm(s.since)}` : `En service depuis ${hm(s.since)}`) : "Pas encore pointé"}</b><em>${on ? "Pause ou départ : un geste" : "Arrivée : un geste, avec votre code"}</em></span><span class="pill ${on ? "ok" : "acc"}">${on ? "Pointé" : "Je pointe"}</span></button>`;
  }
  const stats = L.stats.length ? `<section class="es-stats st n${L.stats.length}" style="--i:4">${L.stats.map(([v, t, s, r, tone]) => `<button class="es-stat ${tone || ""}" data-go="${r}"><span class="es-sl">${esc(t)}</span><b class="mono" data-to="${+v || 0}">${+v || 0}</b><em>${esc(s)}</em></button>`).join("")}</section>` : "";
  const tiles = esTiles(ps); const ed = ES.edit;
  const others = ed ? [...new Set(Object.values(ES_POSTES).flatMap((x) => x.tools).concat(["frigos", "stock", "registre", "alertes", "consignes", "pointeuse", "planning"]))].filter((r) => !tiles.includes(r) && VIEWS[r] && esNavRow(r) && permOk(r)) : [];
  const tile = (r, i, on) => { const n = esNavRow(r); const b = esTileBadge(r, L); return `<div class="es-tw" style="--i:${i}">${ed && on ? `<div class="es-tctl"><button data-act="esTileMove" data-id="${r}" data-v="-1" aria-label="Avancer">${ico("back")}</button><button data-act="esTileMove" data-id="${r}" data-v="1" aria-label="Reculer" class="r">${ico("back")}</button></div>` : ""}
    <button class="es-tile ${ES_WELL[r] || ES_WELLS[i % ES_WELLS.length]}${ed ? (on ? " ed" : " off") : ""}" ${ed ? `data-act="esTileToggle" data-id="${r}"` : `data-go="${r}"`}><span class="ic">${ico(IC[n[1]] ? n[1] : "grid")}${b ? `<i class="es-tb mono">${b}</i>` : ""}${ed ? `<i class="es-tx">${ico(on ? "minus" : "plus")}</i>` : ""}</span><span class="t">${esc(n[2])}</span></button></div>`; };
  const grid = `<section class="es-tools st" style="--i:5"><div class="es-tlh"><span class="lbl">Mes outils · ${esc(P.t)}</span><button class="btn ghost sm es-edb" data-act="esEdit">${ed ? `${ico("check")}Terminé` : `${ico("pzBrush")}Personnaliser`}</button></div>
    ${ed ? `<p class="es-edn">Touchez un outil pour le retirer, les flèches pour le déplacer. Gardé pour vous, sur cet appareil.</p>` : ""}
    <div class="es-grid${ed ? " editing" : ""}">${tiles.map((r, i) => tile(r, i, true)).join("")}</div>
    ${ed && others.length ? `<span class="lbl es-addl">Ajouter</span><div class="es-grid editing add">${others.map((r, i) => tile(r, i, false)).join("")}</div><button class="btn ghost sm" data-act="esTileReset">${ico("pzReset")}Revenir aux outils du poste</button>` : ""}
  </section>`;
  const team = esTry(() => homeOnShift(), []);
  const crew = team.length ? `<section class="glass es-crew st" style="--i:6"><span class="lbl">En service maintenant</span><div class="es-crw">${team.slice(0, 8).map((x) => `<span class="es-cm">${typeof homeShiftAva === "function" ? homeShiftAva(x) : ""}<b>${esc(firstName(x.name))}</b><em>${x.st === "pause" ? "pause" : hm(x.since)}</em></span>`).join("")}</div></section>` : "";
  const cs = esTry(() => (typeof csHomeCard === "function" ? csHomeCard() : ""), "");
  return `<div class="inner es-home es-svc">
    <div class="es-head es-hcol"><div class="row st es-head" style="--i:0"><div style="min-width:0">${esDateBtn()}<h1 class="title">${sh ? "En service" : `${esGreet()} ${esc(firstName(S.me.name) || "")}`.trim()}</h1></div>${sh ? `<span class="es-shared">${ico("pmTablet")}Appareil du resto</span>` : DB.mode === "demo" ? "" : `<button class="iconbtn es-me" data-go="reglages" aria-label="Réglages">${avatar(S.me.id, true)}</button>`}</div>${esSwitch("hd")}</div>
    <div class="es-cols"><div class="es-col">${hero}${who}${stats}${cs}</div><div class="es-col">${grid}${crew}</div></div>
  </div>`;
}
function esTileBadge(r, L) {
  if (r === "cuisine") return L.cook || 0; if (r === "releve") return L.rel || 0; if (r === "menage") return L.men || 0;
  if (r === "salle") return L.ready || 0; if (r === "consignes") return esTry(() => csUnread(), 0);
  if (r === "commandes") return esTry(() => CMD.unseen(), 0); return 0;
}

/* ═══════════════════════════ MON ESPACE ═══════════════════════════ */
function esShiftsMine(from, to) { const st = esStaff(); return st && typeof rhShiftsOf === "function" ? rhShiftsOf(st.id, from, to) : []; }
function esNext() {
  const st = esStaff(); if (!st || typeof rhIv !== "function") return {};
  const now = Date.now() / 60000; const ivs = esShiftsMine(addDays(dayKey(), -1), addDays(dayKey(), 30)).map(rhIv);
  return { cur: ivs.find((iv) => now >= iv.s && now < iv.e) || null, next: ivs.find((iv) => iv.s > now) || null };
}
const esCoworkers = (day) => { const me = esStaff(); const ids = new Set((S.shifts || []).filter((s) => s.day === day && (!me || s.staffId !== me.id)).map((s) => s.staffId)); return (S.staff || []).filter((s) => ids.has(s.id)); };
const esStAva = (s, sz = 26) => `<span class="es-sa" style="--s:${sz}px;background:${esc(s.color || colorFor(s.id))}" title="${esc(s.name)}">${esc(initials(s.name))}</span>`;
function esWeekMin(sid, mon) { if (typeof rhDayMin !== "function") return 0; return Object.values(rhDayMin(sid, mon, addDays(mon, 6))).reduce((a, v) => a + (v.min || 0), 0); }
function esPlanMin(sid, from, to) { return typeof rhShiftsOf === "function" ? rhShiftsOf(sid, from, to).reduce((a, s) => a + rhShiftMin(s), 0) : 0; }
function esMyReqs() { return (ES_REQS() || []).filter((r) => r.memberId === S.me.id).sort((a, b) => (b.at || 0) - (a.at || 0)); }
function esLeaveOn(day, mid = S.me.id) { return (ES_REQS() || []).find((r) => r.memberId === mid && r.status === "ok" && (r.kind === "conge" || r.kind === "absence") && r.from <= day && (r.to || r.from) >= day) || null; }
function esMyEvents(days = 30) { const t0 = Date.now() - days * 864e5; return (S.events || []).filter((e) => (e.uid === S.me.id || (e.actorId && e.actorId === S.me.id)) && (e.at || 0) >= t0); }
const ES_EVK = { reading: ["therm", "Relevés", "w-vi"], reception: ["truck", "Réceptions", "w-sa"], chore: ["spray", "Ménage", "w-sk"], lot: ["tag", "Étiquettes", "w-to"], open: ["tag", "Étiquettes", "w-to"], out: ["tag", "Étiquettes", "w-to"], lost: ["tag", "Étiquettes", "w-to"], move: ["move", "Mise en place", "w-mi"], ticket: ["receipt", "Caisse", "w-nd"], note: ["book", "Recettes", "w-to"], salle: ["slPad", "Service en salle", "w-vi"], request: ["esSun", "Demandes", "w-sa"] };
const esEvK = (t) => ES_EVK[t] || ["activity", "Divers", "w-nd"];

function esMoiView() {
  const st = esStaff(); const nm = firstName(S.me.name) || ""; const today = dayKey();
  const head = `<div class="row st es-head" style="--i:0"><div style="min-width:0">${esDateBtn()}<h1 class="title">${esGreet()}${nm ? " " + esc(nm) : ""}</h1></div>${DB.mode === "demo" ? "" : `<button class="iconbtn es-me" data-go="reglages" aria-label="Réglages">${avatar(S.me.id, true)}</button>`}</div>`;
  if (!st) {
    return `<div class="inner es-home es-moi">${head}${esSwitch("hd")}
      <section class="es-hero es-hm st" style="--i:2"><span class="es-glow" aria-hidden="true"><i></i><i></i></span><div class="es-hk"><span class="es-live">Mon espace</span></div>
      <div class="es-hb">Votre fiche équipe n'existe pas encore</div><div class="es-hsub">${esIsMgr() ? "Créez-la dans Équipe : votre planning et vos heures arriveront ici." : "Le gérant la crée dans Équipe : votre planning et vos heures arriveront ici."}</div>
      ${esIsMgr() && VIEWS.staff ? `<button class="es-cta" data-go="staff"><span class="es-ctai">${ico("users")}</span><span>Ouvrir l'équipe</span>${ico("arrow")}</button>` : ""}</section>
      ${esMoiQuick()}${esReqCard()}</div>`;
  }
  const { cur, next } = esNext(); const nowM = Date.now() / 60000;
  const ivTx = (iv) => `${hm(iv.s * 60000)} → ${hm(iv.e * 60000)}`;
  const rel = (iv) => { const d = Math.round(iv.s - nowM); if (d < 60) return `dans ${d} min`; if (d < 24 * 60) return `dans ${Math.round(d / 60)} h`; const days = Math.round((parseDay(iv.day) - parseDay(today)) / 864e5); return days === 1 ? "demain" : `dans ${days} jours`; };
  let hero;
  if (cur) {
    const pct = Math.min(100, Math.max(0, Math.round(((nowM - cur.s) / (cur.e - cur.s)) * 100)));
    hero = `<div class="es-hk"><span class="es-live on"><i></i>En service</span><span class="mono">${esc(cur.sh.post || "")}</span></div><div class="es-hb">Jusqu'à ${hm(cur.e * 60000)}</div><div class="es-hsub">Commencé à ${hm(cur.s * 60000)} · ${esH(cur.e - nowM)} restantes</div><div class="es-bar big"><i style="--p:${pct}%"></i></div>
      <button class="es-cta" data-act="esSpGo" data-v="service"><span class="es-ctai">${ico("esServ")}</span><span>Passer en mode service</span>${ico("arrow")}</button>`;
  } else if (next) {
    const co = esCoworkers(next.day);
    hero = `<div class="es-hk"><span class="es-live">Prochain service</span><span class="mono">${esc(rel(next))}</span></div><div class="es-hb">${esc(parseDay(next.day) && next.day === today ? "Aujourd'hui" : next.day === addDays(today, 1) ? "Demain" : esDayLbl(next.day))}</div>
      <div class="es-hsub mono">${ivTx(next)}${next.sh.post ? ` · ${esc(next.sh.post)}` : ""}</div>
      ${co.length ? `<div class="es-co"><span class="es-cos">${co.slice(0, 6).map((s) => esStAva(s, 28)).join("")}</span><em>avec ${esc(co.slice(0, 3).map((s) => firstName(s.name)).join(", "))}${co.length > 3 ? ` et ${co.length - 3} autres` : ""}</em></div>` : ""}`;
  } else hero = `<div class="es-hk"><span class="es-live">Mon planning</span></div><div class="es-hb">Rien de prévu</div><div class="es-hsub">Pas de service dans les 30 prochains jours.</div>`;
  const heroH = `<section class="es-hero es-hm st" style="--i:2" ${cur ? "" : `data-go="moiPlanning" role="button" tabindex="0"`}><span class="es-glow" aria-hidden="true"><i></i><i></i></span>${hero}</section>`;
  /* this week */
  const mon = esMonday(); const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i)); const planW = esPlanMin(st.id, mon, addDays(mon, 6));
  const week = `<section class="glass es-week st" style="--i:3" data-go="moiPlanning" role="button" tabindex="0" aria-label="Ma semaine">
    <div class="row"><span class="lbl">Ma semaine</span><span class="pill neu mono">${esH(planW)} prévues</span></div>
    <div class="es-wk">${days.map((d, i) => { const sh = esShiftsMine(d, d); const lv = esLeaveOn(d); return `<div class="es-wd${d === today ? " today" : ""}${d < today ? " past" : ""}" style="--j:${i}"><span class="es-wdn">${esDow(d)}</span><b class="mono">${parseDay(d).getDate()}</b><div class="es-wbars">${lv ? `<i class="leave" title="Congé"></i>` : sh.map((s) => { const a = rhT2m(s.start) || 0; let b = rhT2m(s.end) || a; if (b <= a) b += 1440; return `<i style="--a:${Math.max(0, (a - 360) / 1080)};--b:${Math.min(1, (b - 360) / 1080)}"></i>`; }).join("")}</div><em class="mono">${lv ? "congé" : sh.length ? esc(sh[0].start) : "repos"}</em></div>`; }).join("")}</div>
  </section>`;
  /* hours */
  const p = typeof rhStaff === "function" ? rhStaff(st.id) : st; const wMin = esWeekMin(st.id, mon); const target = (+((p && p.weeklyHours) || 35)) * 60;
  const m0 = today.slice(0, 7) + "-01"; const mMin = typeof rhDayMin === "function" ? Object.values(rhDayMin(st.id, m0, today)).reduce((a, v) => a + (v.min || 0), 0) : 0;
  const pct = target ? Math.min(100, Math.round((wMin / target) * 100)) : 0; const R = 34, C = 2 * Math.PI * R;
  const ot = typeof rhOT === "function" ? rhOT(wMin) : { h: 0 };
  const hours = `<section class="glass es-hours st" style="--i:4" data-go="moiHeures" role="button" tabindex="0" aria-label="Mes heures">
    <div class="es-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" class="bg"/><circle cx="40" cy="40" r="${R}" class="fg" style="stroke-dasharray:${C};--off:${C * (1 - pct / 100)};stroke-dashoffset:${C}"/></svg><span><b class="mono" data-to="${Math.floor(wMin / 60)}">${Math.floor(wMin / 60)}</b><small>h</small></span></div>
    <div class="es-hrs"><span class="lbl">Mes heures</span><b>${esH(wMin)} pointées cette semaine</b><em>${esc(p && p.contract ? p.contract + " · " : "")}${esH(target)} au contrat${ot.h > 0 ? ` · <span class="es-ot">+${esH(ot.h * 60)} sup.</span>` : ""}</em><em>${esc(MONTHS[new Date().getMonth()])} : <b class="mono">${esH(mMin)}</b></em></div>${ico("chev")}
  </section>`;
  /* activity */
  const ev = esMyEvents(7); const cnt = {}; ev.forEach((e) => { const k = esEvK(e.type)[1]; cnt[k] = (cnt[k] || 0) + 1; });
  const act = `<section class="glass es-act st" style="--i:6" data-go="moiActivite" role="button" tabindex="0">
    <div class="row"><span class="lbl">Ce que j'ai fait · 7 jours</span><span class="pill acc mono">${ev.length}</span></div>
    ${ev.length ? `<div class="es-chips">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => { const e = Object.values(ES_EVK).find((x) => x[1] === k) || ["activity", k, "w-nd"]; return `<span class="es-chip ${e[2]}">${ico(e[0])}<b class="mono">${n}</b>${esc(k.toLowerCase())}</span>`; }).join("")}</div>
      <div class="es-evl">${ev.slice(0, 3).map((e) => `<div class="es-ev"><span class="es-evi ${esEvK(e.type)[2]}">${ico(esEvK(e.type)[0])}</span><span>${esc(String(e.text || "").replace(/^a /, "J'ai ").replace(/^./, (c) => c.toUpperCase()))}</span><em class="mono">${esc(when(e.at))}</em></div>`).join("")}</div>`
      : `<p class="sub">Vos relevés, réceptions, tâches et commandes s'afficheront ici.</p>`}
  </section>`;
  const cs = esTry(() => (typeof csHomeCard === "function" ? csHomeCard() : ""), "");
  return `<div class="inner es-home es-moi">${head}${esSwitch("hd")}
    <div class="es-cols"><div class="es-col">${heroH}${week}${hours}</div><div class="es-col">${esMoiQuick()}${esReqCard()}${cs}${act}</div></div></div>`;
}
function esMoiQuick() {
  const q = [["pointeuse", "clock", "Pointer", "w-mi"], ["moiDemandes", "esSun", "Poser un congé", "w-sa", "esReqNew"], ["frais", "nfNote", "Note de frais", "w-sk"], ["consignes", "csMega", "Consignes", "w-vi"]]
    .filter(([r]) => VIEWS[r] && permOk(r));
  const csN = esTry(() => csUnread(), 0);
  return `<nav class="es-quick st" style="--i:5" aria-label="Raccourcis">${q.map(([r, i, t, w, a]) => `<button class="es-q ${w}" ${a ? `data-act="${a}"` : `data-go="${r}"`}><span class="ic">${ico(IC[i] ? i : "grid")}${r === "consignes" && csN ? `<i class="es-tb mono">${csN}</i>` : ""}</span><span class="t">${esc(t)}</span></button>`).join("")}</nav>`;
}
function esReqPill(r) { return r.status === "ok" ? `<span class="pill ok">Accepté</span>` : r.status === "refus" ? `<span class="pill bad">Refusé</span>` : `<span class="pill warn"><span class="dot"></span>En attente</span>`; }
const ES_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function esReqDates(r) { const a = parseDay(r.from), b = parseDay(r.to || r.from); if (!a) return ""; const f = (d) => `${d.getDate()} ${ES_MS[d.getMonth()]}`; return r.to && r.to !== r.from ? `du ${f(a)} au ${f(b)}` : `le ${f(a)}`; }
function esReqRow(r, mgr) {
  const k = ES_REQ_OF[r.kind] || ES_REQ[0]; const n = r.to && r.to !== r.from ? Math.round((parseDay(r.to) - parseDay(r.from)) / 864e5) + 1 : 1;
  return `<div class="es-rq k-${esc(r.kind)}"><span class="es-rqi">${ico(k[1])}</span><div class="es-rqt"><b>${mgr ? `${esc(firstName(r.name))} · ` : ""}${esc(k[2])}</b><em>${esc(esReqDates(r))}${r.kind === "conge" || r.kind === "absence" ? ` · ${esPl(n, "jour")}` : ""}${r.note ? ` · ${esc(r.note)}` : ""}</em>${r.answer ? `<em class="es-rqa">« ${esc(r.answer)} »</em>` : ""}</div>
    ${mgr && r.status === "attente" ? `<div class="es-rqb"><button class="btn sm soft" data-act="esReqAns" data-id="${esc(r.id)}" data-v="refus" aria-label="Refuser">${ico("x")}</button><button class="btn sm acc" data-act="esReqAns" data-id="${esc(r.id)}" data-v="ok">${ico("check")}Accepter</button></div>` : esReqPill(r)}</div>`;
}
function esReqCard() {
  const mine = esMyReqs();
  return `<section class="glass es-reqc st" style="--i:6"><div class="row"><span class="lbl">Mes demandes</span><button class="btn ghost sm" data-act="esReqNew">${ico("plus")}Demander</button></div>
    ${mine.length ? `<div class="es-rql">${mine.slice(0, 3).map((r) => esReqRow(r)).join("")}</div>${mine.length > 3 ? `<button class="btn ghost sm" data-go="moiDemandes">Tout voir</button>` : ""}`
      : `<div class="es-rqe">${ES_REQ.map(([k, i, t]) => `<button class="es-rqk" data-act="esReqNew" data-v="${k}">${ico(i)}<span>${esc(t)}</span></button>`).join("")}</div>`}
  </section>`;
}

/* ── requests: data ── */
const ES_RQ = { rid: null, rows: null };
function ES_REQS() {
  if (!S.rid) return [];
  if (ES_RQ.rid !== S.rid) {
    ES_RQ.rid = S.rid; ES_RQ.rows = []; const rid = S.rid;
    try { DB.watch("esRequests", { order: "at", dir: "desc", limit: 300 }, (rows) => { if (S.rid !== rid) return; ES_RQ.rows = rows || []; try { onData(); } catch (e) {} }); } catch (e) {}
  }
  return ES_RQ.rows || [];
}
function esReqPending() { return ES_REQS().filter((r) => r.status === "attente"); }
function esPilotStrip() {
  if (!esIsMgr() || !VIEWS.esDemandes) return ""; const n = esReqPending().length; if (!n) return "";
  return `<button class="es-pstrip st" style="--i:1" data-go="esDemandes"><span class="es-rqi">${ico("esInbox")}</span><span><b>${esPl(n, "demande")} de l'équipe</b><em>${esc(esReqPending().slice(0, 2).map((r) => `${firstName(r.name)} : ${(ES_REQ_OF[r.kind] || ES_REQ[0])[2].toLowerCase()}`).join(" · "))}</em></span>${ico("chev")}</button>`;
}
function esReqSheet() {
  const F = ES.F; const k = ES_REQ_OF[F.kind] || ES_REQ[0]; const team = (S.staff || []).filter((s) => s.active !== false && s.memberId !== S.me.id);
  openSheet(`<div class="es-sh"><div class="es-shh"><span class="h2">Demander ${esc(k[3])}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="es-kinds">${ES_REQ.map(([id, i, t]) => `<button class="${id === F.kind ? "on" : ""}" data-act="esReqKind" data-v="${id}">${ico(i)}<span>${esc(t)}</span></button>`).join("")}</div>
    <div class="grid2"><label class="field"><span class="lbl">${F.kind === "dispo" || F.kind === "echange" ? "Le" : "Du"}</span><input class="input" type="date" id="esRf" value="${esc(F.from)}"></label>
    ${F.kind === "echange" ? `<label class="field"><span class="lbl">Avec</span><select class="input" id="esRw"><option value="">Quelqu'un</option>${team.map((s) => `<option value="${esc(s.name)}"${F.with === s.name ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : `<label class="field"><span class="lbl">Au</span><input class="input" type="date" id="esRt" value="${esc(F.to)}"></label>`}</div>
    <label class="field"><span class="lbl">Un mot pour le gérant</span><input class="input" id="esRn" maxlength="140" value="${esc(F.note || "")}" placeholder="${F.kind === "conge" ? "Mariage de ma sœur" : F.kind === "dispo" ? "Libre les lundis midi" : F.kind === "absence" ? "Rendez-vous médical" : "Je prends son soir, il prend mon midi"}"></label>
    <button class="btn acc block" data-act="esReqSend">${ico("check")}Envoyer la demande</button>
    <p class="es-fine">Le gérant reçoit la demande dans Pilotage. Vous voyez sa réponse ici.</p></div>`);
}

/* ═══════════════════════════ pages of « Mon espace » ═══════════════════════════ */
const esNoStaff = () => `<div class="glass empty st" style="--i:1"><div class="ic">${ico("users")}</div><b>Pas encore de fiche équipe</b>${esIsMgr() ? "Créez votre fiche dans Équipe pour voir planning et heures." : "Le gérant crée votre fiche dans Équipe."}</div>`;
VIEWS.moiPlanning = {
  render() {
    const st = esStaff(); const sw = `<div class="seg es-seg" role="tablist">${[["week", "Semaine"], ["month", "Mois"]].map(([k, t]) => `<button class="${ES.view === k ? "on" : ""}" data-act="esPlView" data-v="${k}">${t}</button>`).join("")}</div>`;
    if (!st) return `<div class="inner narrow">${topBar("Mon planning")}${esNoStaff()}</div>`;
    const today = dayKey(); let body;
    if (ES.view === "month") {
      const d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() + ES.mo); const m0 = dayKey(d0); const mon = esMonday(m0); const ml = MONTHS[d0.getMonth()] + " " + d0.getFullYear();
      const cells = []; for (let i = 0; i < 42; i++) { const d = addDays(mon, i); if (i >= 35 && d.slice(0, 7) !== m0.slice(0, 7)) break; cells.push(d); }
      const tot = esPlanMin(st.id, m0, addDays(addDays(m0, 31).slice(0, 7) + "-01", -1));
      body = `<div class="es-nav st" style="--i:2"><button class="iconbtn" data-act="esPlStep" data-v="-1" aria-label="Mois précédent">${ico("back")}</button><b>${esc(ml.replace(/^./, (c) => c.toUpperCase()))}</b><span class="pill neu mono">${esH(tot)}</span><button class="iconbtn r" data-act="esPlStep" data-v="1" aria-label="Mois suivant">${ico("back")}</button></div>
        <div class="glass es-cal st" style="--i:3"><div class="es-calh">${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<span>${x}</span>`).join("")}</div><div class="es-calg">${cells.map((d, i) => { const sh = esShiftsMine(d, d); const lv = esLeaveOn(d); const out = d.slice(0, 7) !== m0.slice(0, 7); return `<button class="es-cd${d === today ? " today" : ""}${out ? " out" : ""}${sh.length ? " on" : ""}${lv ? " leave" : ""}" style="--j:${i}" data-act="esDay" data-v="${d}"><b class="mono">${parseDay(d).getDate()}</b>${lv ? `<em>congé</em>` : sh.length ? `<em class="mono">${esc(sh[0].start)}</em><i></i>` : ""}</button>`; }).join("")}</div></div>`;
    } else {
      const mon = addDays(esMonday(), ES.wk * 7); const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i)); const tot = esPlanMin(st.id, mon, addDays(mon, 6));
      const lbl = typeof rhWeekLbl === "function" ? rhWeekLbl(mon) : esDayLbl(mon);
      body = `<div class="es-nav st" style="--i:2"><button class="iconbtn" data-act="esPlStep" data-v="-1" aria-label="Semaine précédente">${ico("back")}</button><b>${ES.wk === 0 ? "Cette semaine" : ES.wk === 1 ? "La semaine prochaine" : esc(lbl)}</b><span class="pill neu mono">${esH(tot)}</span><button class="iconbtn r" data-act="esPlStep" data-v="1" aria-label="Semaine suivante">${ico("back")}</button></div>
        <div class="es-days">${days.map((d, i) => { const sh = esShiftsMine(d, d); const lv = esLeaveOn(d); const co = esCoworkers(d); return `<div class="glass es-day st${d === today ? " today" : ""}${d < today ? " past" : ""}" style="--i:${3 + i}"><div class="es-dd"><span>${esDow(d)}</span><b class="mono">${parseDay(d).getDate()}</b></div>
          <div class="es-dsh">${lv ? `<span class="es-shp leave">${ico("esSun")}${esc((ES_REQ_OF[lv.kind] || ES_REQ[0])[2])}</span>` : sh.length ? sh.map((s) => `<span class="es-shp"><b class="mono">${esc(s.start)} → ${esc(s.end)}</b>${s.post ? `<em>${esc(s.post)}</em>` : ""}${+s.breakMin ? `<em>pause ${+s.breakMin} min</em>` : ""}</span>`).join("") : `<span class="es-rest">Repos</span>`}</div>
          ${sh.length && co.length ? `<span class="es-cos">${co.slice(0, 4).map((s) => esStAva(s, 24)).join("")}</span>` : ""}</div>`; }).join("")}</div>`;
    }
    return `<div class="inner narrow es-pl">${topBar("Mon planning", { right: `<button class="iconbtn" data-act="esIcs" aria-label="Ajouter à mon agenda">${ico("download")}</button>` })}
      <div class="st es-plsw" style="--i:1">${sw}</div>${body}
      <button class="btn soft block st es-icsb" style="--i:11" data-act="esIcs">${ico("cal")}Ajouter mes services à mon agenda</button>
      <p class="es-fine st" style="--i:12">Le planning est fait par le gérant. Un empêchement ? <button class="es-lnk" data-act="esReqNew" data-v="echange">Demandez un échange</button>.</p></div>`;
  },
  after(v) { $$(".es-cd,.es-day", v).forEach((el) => el.classList.add("in")); },
};
VIEWS.moiHeures = {
  render() {
    const st = esStaff(); if (!st) return `<div class="inner narrow">${topBar("Mes heures")}${esNoStaff()}</div>`;
    const p = typeof rhStaff === "function" ? rhStaff(st.id) : st; const target = (+(p.weeklyHours || 35)) * 60; const today = dayKey();
    const d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() + ES.hm); const m0 = dayKey(d0); const mEnd = addDays(addDays(m0, 31).slice(0, 7) + "-01", -1); const last = mEnd < today ? mEnd : today;
    const dm = typeof rhDayMin === "function" ? rhDayMin(st.id, m0, last) : {}; const worked = Object.values(dm).reduce((a, v) => a + (v.min || 0), 0); const plan = esPlanMin(st.id, m0, last);
    const weeks = []; for (let mon = esMonday(m0); mon <= mEnd; mon = addDays(mon, 7)) weeks.push(mon);
    let gross = 0; let otH = 0;
    const wk = weeks.map((mon, i) => {
      const w = esWeekMin(st.id, mon); const pl = esPlanMin(st.id, mon, addDays(mon, 6)); const ot = typeof rhOT === "function" ? rhOT(w) : { h: 0 }; otH += ot.h;
      gross += typeof rhWeekGross === "function" ? rhWeekGross(w, p) : 0;
      const dd = typeof rhDayMin === "function" ? rhDayMin(st.id, mon, addDays(mon, 6)) : {}; const open = ES.wOpen === mon;
      const pct = Math.min(100, target ? Math.round((w / target) * 100) : 0), ppct = Math.min(100, target ? Math.round((pl / target) * 100) : 0);
      const fut = mon > today;
      return `<div class="glass es-wkr st${open ? " open" : ""}${fut ? " fut" : ""}" style="--i:${4 + i}"><button class="es-wkh" data-act="esWkOpen" data-v="${mon}"><div><b>${typeof rhWeekLbl === "function" ? esc(rhWeekLbl(mon)) : esc(mon)}</b><em>${fut ? `À venir · ${esH(pl)} prévues` : `${esH(w)} pointées · ${esH(pl)} prévues`}${ot.h > 0 ? ` · <span class="es-ot">+${esH(ot.h * 60)} sup.</span>` : ""}</em></div><span class="mono es-wkv">${fut ? "–" : esH(w)}</span>${ico("down")}</button>
        <div class="es-bar dual"><i class="p" style="--p:${ppct}%"></i><i style="--p:${pct}%"></i></div>
        ${open ? `<div class="es-wkd">${[0, 1, 2, 3, 4, 5, 6].map((j) => addDays(mon, j)).filter((d) => dm[d] || dd[d] || esShiftsMine(d, d).length).map((d) => { const x = dd[d] || { min: 0, sessions: [], anomalies: [] }; const sh = esShiftsMine(d, d); return `<div class="es-wdr"><span class="es-wdl">${esc(esDow(d))} ${parseDay(d).getDate()}</span><span class="es-wds">${(x.sessions || []).map((s) => `<b class="mono">${hm(s.in)} → ${s.open ? "…" : hm(s.out)}</b>`).join("") || `<em>${d >= today ? "" : "non pointé"}${sh.length ? `${d >= today ? "" : " · "}prévu ${esc(sh[0].start)} → ${esc(sh[sh.length - 1].end)}` : ""}</em>`}${(x.anomalies || []).length ? `<span class="pill warn">${esc(x.anomalies[0].t)}</span>` : ""}</span><b class="mono">${x.min ? esH(x.min) : "–"}</b></div>`; }).join("") || `<p class="sub">Aucun pointage cette semaine.</p>`}</div>` : ""}</div>`;
    }).join("");
    const ml = MONTHS[d0.getMonth()] + " " + d0.getFullYear();
    return `<div class="inner narrow es-hr">${topBar("Mes heures")}
      <div class="es-nav st" style="--i:1"><button class="iconbtn" data-act="esHrStep" data-v="-1" aria-label="Mois précédent">${ico("back")}</button><b>${esc(ml.replace(/^./, (c) => c.toUpperCase()))}</b><span></span><button class="iconbtn r" data-act="esHrStep" data-v="1" aria-label="Mois suivant"${ES.hm >= 0 ? " disabled" : ""}>${ico("back")}</button></div>
      <section class="es-hero es-hm es-hrh st" style="--i:2"><span class="es-glow" aria-hidden="true"><i></i><i></i></span>
        <div class="es-hk"><span class="es-live">Pointées ce mois</span><span class="mono">${esc(p.contract || "")}${p.weeklyHours ? ` · ${p.weeklyHours} h / sem.` : ""}</span></div>
        <div class="es-hb mono">${esH(worked)}</div><div class="es-hsub">${esH(plan)} prévues au planning · ${worked >= plan ? `<b>+${esH(worked - plan)}</b> de plus` : `${esH(plan - worked)} de moins`}</div>
        <div class="es-kpis"><span><b class="mono">${esH(otH * 60)}</b>heures sup.</span><span><b class="mono">${Object.keys(dm).length}</b>jours travaillés</span>${p.hourlyGross ? `<span><b class="mono">${Math.round(gross).toLocaleString("fr-FR")} €</b>brut estimé</span>` : ""}</div>
      </section>
      <div class="es-lgd st" style="--i:3"><span><i class="p"></i>Prévu</span><span><i></i>Pointé</span></div>
      ${wk}
      <p class="es-fine st" style="--i:${5 + weeks.length}">Estimation indicative, d'après vos pointages. Votre fiche de paie fait foi. Une erreur ? Le gérant corrige un pointage dans la Pointeuse.</p></div>`;
  },
};
VIEWS.moiActivite = {
  render() {
    const all = esMyEvents(60); const kinds = [...new Set(all.map((e) => esEvK(e.type)[1]))];
    const list = ES.act === "all" ? all : all.filter((e) => esEvK(e.type)[1] === ES.act);
    const byDay = {}; list.forEach((e) => { (byDay[dayKey(new Date(e.at))] ||= []).push(e); });
    const days = Object.keys(byDay).sort().reverse();
    return `<div class="inner narrow es-av">${topBar("Mon activité")}
      <div class="es-sum st" style="--i:1"><b class="mono">${all.length}</b><span>actions sur 60 jours, signées à votre nom</span></div>
      ${kinds.length > 1 ? `<div class="es-filt st" style="--i:2"><button class="chip${ES.act === "all" ? " on" : ""}" data-act="esActF" data-v="all">Tout</button>${kinds.map((k) => `<button class="chip${ES.act === k ? " on" : ""}" data-act="esActF" data-v="${esc(k)}">${esc(k)}</button>`).join("")}</div>` : ""}
      ${days.length ? days.slice(0, 30).map((d, i) => `<section class="glass es-avd st" style="--i:${3 + Math.min(i, 8)}"><span class="lbl">${esc(d === dayKey() ? "Aujourd'hui" : d === addDays(dayKey(), -1) ? "Hier" : esDayLbl(d))}</span>${byDay[d].map((e) => `<div class="es-ev"><span class="es-evi ${esEvK(e.type)[2]}">${ico(esEvK(e.type)[0])}</span><span>${esc(String(e.text || "").replace(/^a /, "J'ai ").replace(/^./, (c) => c.toUpperCase()))}</span><em class="mono">${hm(e.at)}</em></div>`).join("")}</section>`).join("")
        : `<div class="glass empty st" style="--i:3"><div class="ic">${ico("activity")}</div><b>Rien pour l'instant</b>Chaque relevé, réception, tâche ou commande que vous faites s'ajoute ici.</div>`}</div>`;
  },
};
VIEWS.moiDemandes = {
  render() {
    const mine = esMyReqs();
    return `<div class="inner narrow es-rqp">${topBar("Mes demandes")}
      <div class="es-rqe big st" style="--i:1">${ES_REQ.map(([k, i, t]) => `<button class="es-rqk" data-act="esReqNew" data-v="${k}">${ico(i)}<span>${esc(t)}</span></button>`).join("")}</div>
      ${mine.length ? `<section class="glass es-rql pad st" style="--i:2">${mine.map((r) => esReqRow(r)).join("")}</section>` : `<div class="glass empty st" style="--i:2"><div class="ic">${ico("esSun")}</div><b>Aucune demande</b>Un congé, une absence, un échange de service : le gérant répond ici.</div>`}</div>`;
  },
};
VIEWS.esDemandes = {
  render() {
    if (!esIsMgr()) return VIEWS.noaccess ? VIEWS.noaccess.render({ route: "esDemandes" }) : "";
    const all = ES_REQS().slice().sort((a, b) => (a.status === "attente" ? 0 : 1) - (b.status === "attente" ? 0 : 1) || (b.at || 0) - (a.at || 0));
    const pend = all.filter((r) => r.status === "attente"), done = all.filter((r) => r.status !== "attente");
    return `<div class="inner narrow es-rqp">${topBar("Demandes de l'équipe")}
      <p class="sub st" style="--i:1">Congés, absences, échanges et disponibilités. Votre réponse s'affiche aussitôt dans « Mon espace » de la personne.</p>
      ${pend.length ? `<span class="lbl st" style="--i:2">À traiter · ${pend.length}</span><section class="glass es-rql pad st" style="--i:3">${pend.map((r) => esReqRow(r, true)).join("")}</section>` : `<div class="glass empty st" style="--i:2"><div class="ic">${ico("esInbox")}</div><b>Rien à traiter</b>Les demandes de l'équipe arrivent ici.</div>`}
      ${done.length ? `<span class="lbl st" style="--i:4">Déjà répondu</span><section class="glass es-rql pad st" style="--i:5">${done.slice(0, 30).map((r) => esReqRow(r, true)).join("")}</section>` : ""}
      ${VIEWS.planning ? `<button class="btn soft block st" style="--i:6" data-go="planning">${ico("cal")}Ouvrir le planning</button>` : ""}</div>`;
  },
};

/* ═══════════════════════════ Vues & appareils (réglages) ═══════════════════════════ */
VIEWS.espaces = {
  render() {
    const d = esDev(); const al = esAllowed(); const u = esUser(); const ps = esPoste(); const g = esRole() === "gerant";
    const card = (on, act, v, ic, t, s) => `<button class="es-opt${on ? " on" : ""}" data-act="${act}" data-v="${v}" aria-pressed="${on}"><span class="es-oi">${ico(ic)}</span><span><b>${esc(t)}</b><em>${esc(s)}</em></span><i class="es-radio"></i></button>`;
    const dev = `<span class="lbl st" style="--i:2">Cet appareil</span>
      <section class="glass pad es-sec st" style="--i:3"><div class="es-opts">${card(d.kind === "perso", "esDevKind", "perso", "pmPhone", "Mon téléphone", "À moi : mon espace, mon planning, mes heures")}${card(d.kind === "partage", "esDevKind", "partage", "pmTablet", "Appareil du restaurant", "Prêté ou fixe : seulement le service, chacun prend la main")}</div>
      ${d.kind === "partage" ? `<span class="lbl">S'ouvre sur</span><div class="es-opts g2">${[["service", "esServ", "En service", "Les outils du poste"], ...ES_DEVICES.map(([k, i, t]) => [k, i, k === "cuisine" ? "Écran cuisine" : k === "salle" ? "Prise de commande" : "Pointeuse", t])].map(([k, i, t, s]) => card(d.station === k, "esDevStation", k, i, t, s)).join("")}</div>`
        : `<span class="lbl">Au lancement</span><div class="seg es-seg">${[["auto", "Auto"], ...al.map((k) => [k, ES_SP[k].short])].map(([k, t]) => `<button class="${d.start === k ? "on" : ""}" data-act="esDevStart" data-v="${k}">${esc(t)}</button>`).join("")}</div>
        <p class="es-fine">Automatique : ${esIsMgr() ? "Pilotage au bureau, " : ""}« En service » quand vous êtes pointé ou que votre service commence, « Mon espace » le reste du temps.</p>`}
      </section>`;
    const mine = `<span class="lbl st" style="--i:4">Mon compte</span>
      <section class="glass pad es-sec st" style="--i:5"><div class="es-myl">${ES_ORDER.map((k) => `<div class="es-myr${al.includes(k) ? "" : " off"}"><span class="es-oi sp-${k}">${ico(ES_SP[k].ic)}</span><span><b>${ES_SP[k].t}</b><em>${esc(ES_SP[k].d)}</em></span>${al.includes(k) ? `<button class="btn sm soft" data-act="esGo" data-v="${k}">Ouvrir</button>` : `<span class="pill neu">${ico("lock")}Fermé</span>`}</div>`).join("")}</div>
      <span class="lbl">Mon poste en service</span><div class="es-postes light">${Object.entries(ES_POSTES).map(([k, x]) => `<button class="${k === ps ? "on" : ""}" data-act="esPoste" data-v="${k}">${ico(x.ic)}<span>${x.t}</span></button>`).join("")}</div>
      <p class="es-fine">Gardé sur cet appareil${u.tiles && u.tiles[ps] ? " · vos outils sont personnalisés" : ""}. Menu, onglets et accueil se personnalisent aussi dans <button class="es-lnk" data-go="perso">Personnaliser l'app</button>.</p></section>`;
    const team = g ? esTeamMatrix() : "";
    return `<div class="inner narrow es-set">${topBar("Vues & appareils")}
      <p class="sub st" style="--i:1">Chacun voit l'app qui lui sert : le service au resto, son espace à la maison, le pilotage au bureau.</p>
      ${DB.mode === "demo" ? `<button class="es-demob st" style="--i:1" data-act="esDemoPick">${ico("esEye")}<span><b>Démo : voir l'app comme…</b><em>la gérante, le chef, une serveuse, un commis, le plongeur ou une tablette partagée</em></span>${ico("chev")}</button>` : ""}
      ${dev}${mine}${team}</div>`;
  },
};
function esTeamMatrix() {
  const ms = esTeam(); if (!ms.length) return "";
  return `<span class="lbl st" style="--i:6">L'équipe</span>
    <section class="glass es-mx st" style="--i:7"><div class="es-mxh"><span></span>${ES_ORDER.map((k) => `<span title="${ES_SP[k].t}">${ico(ES_SP[k].ic)}<em>${ES_SP[k].short}</em></span>`).join("")}</div>
    ${ms.map((m) => { const a = esAllowedFor(m, m.role); const own = S.resto && m.id === S.resto.owner; return `<div class="es-mxr">${avatar(m.id, true)}<span class="es-mxn"><b>${esc(m.name)}</b><em>${esc(esJob(m.id) || ROLES[m.role] || "")}</em></span>${ES_ORDER.map((k) => `<button class="es-tg${a.includes(k) ? " on" : ""}" data-act="esMx" data-id="${esc(m.id)}" data-v="${k}" aria-pressed="${a.includes(k)}" aria-label="${esc(ES_SP[k].t)} pour ${esc(firstName(m.name))}"${own && k === "pilotage" ? " disabled" : ""}><i></i></button>`).join("")}</div>`; }).join("")}
    <p class="es-fine">Une vue, pas un droit : ce que chacun peut ouvrir reste réglé dans Équipe (accès de chaque personne).</p></section>`;
}

/* ═══════════════════════════ démo : voir comme ═══════════════════════════ */
function esDemoSheet() {
  const cur = S.me.id; const dv = esShared() ? esDev().station : null;
  openSheet(`<div class="es-sh es-demo"><div class="es-shh"><span class="h2">Voir l'app comme…</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Chaque personne a ses vues. Choisissez quelqu'un, l'app entière se met à sa place.</p>
    <span class="lbl">Une personne, sur son téléphone</span>
    <div class="es-pers">${ES_PERSONAS.filter(([id]) => esMember(id)).map(([id, d], i) => `<button class="es-per${!dv && cur === id ? " on" : ""}" style="--i:${i}" data-act="esDemoAs" data-id="${id}">${avatar(id)}<span><b>${esc(esMember(id).name)}</b><em>${esc(esJob(id))}</em><small>${esc(d)}</small></span></button>`).join("")}</div>
    <span class="lbl">Un appareil du restaurant</span>
    <div class="es-pers dev">${ES_DEVICES.map(([k, i, t, s], j) => `<button class="es-per${dv === k ? " on" : ""}" style="--i:${j + 5}" data-act="esDemoDev" data-v="${k}"><span class="es-asd big">${ico(i)}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></button>`).join("")}</div></div>`);
}
function esDemoBecome(mid, dev) {
  const m = esMember(mid); if (!m) return;
  S.me = { id: mid, name: m.name || "", color: m.color }; S.profiles[mid] = { ...(S.profiles[mid] || {}), ...S.me };
  S.isOwner = m.role === "gerant"; S.demoAs = m.role === "gerant" ? null : mid;
  ES.demoDev = dev ? { kind: "partage", station: dev, start: "auto" } : null; ES.demoActor = null; ES.unlock = false; ES.kioskDone = false; ES.sp = null; ES.edit = false;
  try { if (typeof PZ !== "undefined") PZ.cache = null; } catch (e) {}
}
function esDemoBar() {
  const b = $("#auDemo"); if (!b || $(".es-dbb", b)) return;
  const btn = document.createElement("button"); btn.className = "es-dbb"; btn.dataset.act = "esDemoPick"; btn.setAttribute("aria-label", "Voir l'app comme…");
  btn.innerHTML = `${ico("esEye")}<span>Voir comme</span>`; const cta = $(".au-demo-cta", b); b.insertBefore(btn, cta || null); b.classList.add("es-has");
}
setInterval(() => { if (DB.mode === "demo" && $("#auDemo") && !$("#auDemo .es-dbb")) esDemoBar(); }, 700);

/* ═══════════════════════════ ICS: my shifts in my calendar ═══════════════════════════ */
function esIcs() {
  const st = esStaff(); if (!st) return; const list = esShiftsMine(dayKey(), addDays(dayKey(), 60)); if (!list.length) { toast("Aucun service à venir.", "info"); return; }
  const z = (k, t) => `${k.replace(/-/g, "")}T${String(t || "00:00").replace(":", "")}00`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Growth Gusto//Planning//FR", "CALSCALE:GREGORIAN"];
  list.forEach((s) => { let endDay = s.day; if ((rhT2m(s.end) || 0) <= (rhT2m(s.start) || 0)) endDay = addDays(s.day, 1);
    lines.push("BEGIN:VEVENT", `UID:${s.id || s.day + s.start}@growthgusto.fr`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART:${z(s.day, s.start)}`, `DTEND:${z(endDay, s.end)}`, `SUMMARY:${(S.resto?.name || "Service").replace(/[,;]/g, " ")}${s.post ? " · " + s.post : ""}`, "END:VEVENT"); });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mon-planning.ics"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  SFX.ok(); toast(`${esPl(list.length, "service")} prêt${list.length > 1 ? "s" : ""} pour votre agenda`);
}

/* ═══════════════════════════ actions ═══════════════════════════ */
Object.assign(ACT, {
  esGo: (a, id, v, e) => { if (S.route !== "home" && esCur() === v) { go("home", {}, { replace: true }); return; } esApply(v, e); },
  esSpGo: (a, id, v, e) => esApply(v, e),
  esPoste: (a, id, v) => {
    if (!ES_POSTES[v] || v === esPoste()) return; esUserSet((u) => { u.poste = v; }); SFX.tick(); buzz(6);
    try { localStorage.setItem("gg-cf-role-" + S.rid, v === "salle" || v === "bar" ? "salle" : "cuisine"); } catch (e) {}
    const tb = $("#tabbar"); if (tb) delete tb.dataset.built; ES.edit = false; renderChrome(); rerender();
  },
  esEdit: () => { ES.edit = !ES.edit; SFX.tick(); buzz(5); rerender(); },
  esTileToggle: (a, r) => { const ps = esPoste(); esUserSet((u) => { u.tiles = { ...(u.tiles || {}) }; const l = (u.tiles[ps] || ES_POSTES[ps].tools).slice(); const i = l.indexOf(r); if (i >= 0) l.splice(i, 1); else l.push(r); u.tiles[ps] = l; }); SFX.tick(); buzz(5); const tb = $("#tabbar"); if (tb) delete tb.dataset.built; renderChrome(); rerender(); },
  esTileMove: (a, r, v) => { const ps = esPoste(); esUserSet((u) => { u.tiles = { ...(u.tiles || {}) }; const l = (u.tiles[ps] || ES_POSTES[ps].tools).slice(); const i = l.indexOf(r), j = i + (+v || 0); if (i < 0 || j < 0 || j >= l.length) return; l.splice(i, 1); l.splice(j, 0, r); u.tiles[ps] = l; }); SFX.tick(); rerender(); renderChrome(); },
  esTileReset: () => { const ps = esPoste(); esUserSet((u) => { if (u.tiles) { u.tiles = { ...u.tiles }; delete u.tiles[ps]; } }); SFX.close(); rerender(); renderChrome(); },
  esActor: () => { SFX.sheet ? SFX.sheet() : SFX.tap(); esActorSheet(); },
  esActorPick: (a, id) => { const m = esMember(id); if (!m) return; if (DB.mode !== "demo" && typeof ccHasPin === "function" && ccHasPin(m)) { ES.pin = { id, code: "", err: "" }; esPinSheet(); return; } esTookOver(m); },
  esActorOff: () => { esSetActor(null); closeSheet(); SFX.close(); toast("Appareil rendu"); rerender(); },
  esKey: (a, id, v) => {
    const P = ES.pin; if (!P) return; P.err = ""; if (v === "del") P.code = P.code.slice(0, -1); else if (P.code.length < 4) P.code += v; SFX.tick(); buzz(4);
    if (P.code.length === 4) { const ok = typeof ccVerifyPin === "function" ? ccVerifyPin(P.id, P.code) : true; if (ok) { const m = esMember(P.id); ES.pin = null; return esTookOver(m); } P.err = "Ce n'est pas le bon code"; P.code = ""; SFX.err(); buzz([20, 40, 20]); }
    esPinSheet();
  },
  esReqNew: (a, id, v) => { const t = addDays(dayKey(), 14); ES.F = { kind: ES_REQ_OF[v] ? v : "conge", from: t, to: t, note: "", with: "" }; SFX.tap(); esReqSheet(); },
  esReqKind: (a, id, v) => { const F = ES.F; if (!F) return; esReqRead(); F.kind = v; SFX.tick(); esReqSheet(); },
  esReqSend: async (a) => {
    const F = ES.F; if (!F) return; esReqRead(); if (!F.from) { SFX.err(); toast("Choisissez une date.", "err"); return; }
    if (F.to && F.to < F.from) { const x = F.to; F.to = F.from; F.from = x; }
    const st = esStaff(); a.disabled = true;
    const doc = { kind: F.kind, from: F.from, to: F.kind === "echange" || F.kind === "dispo" ? F.from : F.to || F.from, note: [F.with ? `avec ${F.with}` : "", F.note].filter(Boolean).join(" · ").slice(0, 160), memberId: S.me.id, name: S.me.name || "", staffId: st ? st.id : "", status: "attente", at: Date.now(), uid: S.me.id };
    try { await safe(DB.add("esRequests", doc)); } catch (e) { a.disabled = false; return; }
    ES.F = null; closeSheet(); SFX.done ? SFX.done() : SFX.ok(); buzz([10, 40, 10]); try { burst(); } catch (e) {} toast("Demande envoyée au gérant");
    logEvent("request", `a demandé ${(ES_REQ_OF[doc.kind] || ES_REQ[0])[3]} (${esReqDates(doc)})`);
  },
  esReqAns: async (a, id, v) => {
    const r = ES_REQS().find((x) => x.id === id); if (!r || !esIsMgr()) return; a.disabled = true;
    const row = a.closest(".es-rq"); if (row) row.classList.add(v === "ok" ? "yes" : "no");
    await safe(DB.update("esRequests", id, { status: v === "ok" ? "ok" : "refus", answeredBy: S.me.id, answeredByName: S.me.name || "", answeredAt: Date.now() }));
    v === "ok" ? (SFX.ok(), buzz(10)) : SFX.close(); toast(v === "ok" ? `Accepté pour ${firstName(r.name)}` : `Refusé pour ${firstName(r.name)}`);
    logEvent("request", `a ${v === "ok" ? "accepté" : "refusé"} la demande de ${firstName(r.name)}`);
  },
  esPlView: (a, id, v) => { ES.view = v === "month" ? "month" : "week"; SFX.tick(); rerender(); },
  esPlStep: (a, id, v) => { if (ES.view === "month") ES.mo += +v; else ES.wk += +v; SFX.tick(); rerender(); },
  esHrStep: (a, id, v) => { ES.hm = Math.min(0, ES.hm + (+v || 0)); ES.wOpen = null; SFX.tick(); rerender(); },
  esWkOpen: (a, id, v) => { ES.wOpen = ES.wOpen === v ? null : v; SFX.tick(); rerender(); },
  esActF: (a, id, v) => { ES.act = v; SFX.tick(); rerender(); },
  esDay: (a, id, v) => {
    const sh = esShiftsMine(v, v); const co = esCoworkers(v); const lv = esLeaveOn(v); SFX.tap();
    openSheet(`<div class="es-sh"><div class="es-shh"><span class="h2">${esc(esDayLbl(v))}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      ${lv ? `<div class="es-shp leave big">${ico("esSun")}${esc((ES_REQ_OF[lv.kind] || ES_REQ[0])[2])} accepté</div>` : sh.length ? sh.map((s) => `<div class="es-shp big"><b class="mono">${esc(s.start)} → ${esc(s.end)}</b>${s.post ? `<em>${esc(s.post)}</em>` : ""}</div>`).join("") : `<p class="sub">Repos.</p>`}
      ${co.length ? `<span class="lbl">Aussi ce jour-là</span><div class="es-cowl">${co.map((s) => { const x = rhShiftsDay(s.id, v)[0]; return `<div class="es-cow">${esStAva(s, 32)}<b>${esc(s.name)}</b><em class="mono">${x ? `${esc(x.start)} → ${esc(x.end)}` : ""}</em></div>`; }).join("")}</div>` : ""}
      ${v >= dayKey() ? `<button class="btn soft block" data-act="esReqNew" data-v="${sh.length ? "echange" : "dispo"}">${ico(sh.length ? "esSwap" : "esHand")}${sh.length ? "Demander un échange" : "Proposer ma disponibilité"}</button>` : ""}</div>`);
  },
  esIcs: () => esIcs(),
  esCf: () => { const ps = esPoste(); SFX.tap(); buzz(8); if (typeof cfEnter === "function") { try { return cfEnter(ps === "salle" || ps === "bar" ? "salle" : "cuisine", false); } catch (e) {} } go("coupdefeu"); },
  esDevKind: (a, id, v) => { esDevSet({ kind: v === "partage" ? "partage" : "perso" }); ES.sp = null; ES.kioskDone = true; SFX.tick(); buzz(6); const tb = $("#tabbar"); if (tb) delete tb.dataset.built; renderChrome(); rerender(); toast(v === "partage" ? "Cet appareil est celui du restaurant" : "Cet appareil est le vôtre"); },
  esDevStation: (a, id, v) => { esDevSet({ station: v }); if (ES_POSTES[v]) esUserSet((u) => { u.poste = v; }); SFX.tick(); const tb = $("#tabbar"); if (tb) delete tb.dataset.built; renderChrome(); rerender(); },
  esDevStart: (a, id, v) => { esDevSet({ start: v }); ES.sp = null; SFX.tick(); const tb = $("#tabbar"); if (tb) delete tb.dataset.built; renderChrome(); rerender(); },
  esMx: async (a, id, v) => {
    if (esRole() !== "gerant") return; const m = esMember(id); if (!m) return;
    const cur = esAllowedFor(m, m.role); const next = cur.includes(v) ? cur.filter((k) => k !== v) : ES_ORDER.filter((k) => cur.includes(k) || k === v);
    if (!next.length) { SFX.err(); toast("Gardez au moins une vue.", "err"); return; }
    a.classList.toggle("on", next.includes(v)); SFX.tick(); buzz(5);
    m.esAllow = next; await safe(DB.update("members", id, { esAllow: next })); if (id === S.me.id) { ES.sp = null; renderChrome(); } rerender();
  },
  esDemoPick: () => { if (DB.mode !== "demo") return; SFX.sheet ? SFX.sheet() : SFX.tap(); esDemoSheet(); },
  esDemoAs: (a, id, v, e) => { esDemoBecome(id); closeSheet(); const sp = esCur(); ES.sp = null; esMorph(sp, e, () => { esCur(); const tb = $("#tabbar"); if (tb) delete tb.dataset.built; $$(".es-sw").forEach((w) => w.remove()); S.history = []; go("home", {}, { replace: true, tab: true }); renderChrome(); }); toast(`Vous voyez l'app comme ${firstName(S.me.name)}`); },
  esDemoDev: (a, id, v, e) => {
    const owner = (S.members || []).find((m) => m.role === "gerant"); esDemoBecome(owner ? owner.id : S.me.id, v); closeSheet();
    esMorph("service", e, () => { const tb = $("#tabbar"); if (tb) delete tb.dataset.built; $$(".es-sw").forEach((w) => w.remove()); S.history = []; go("home", {}, { replace: true, tab: true }); renderChrome(); });
  },
});
function esReqRead() { const F = ES.F; if (!F) return; const g = (i) => { const el = $("#" + i); return el ? el.value : null; }; F.from = g("esRf") ?? F.from; F.to = g("esRt") ?? F.to; F.note = g("esRn") ?? F.note; F.with = g("esRw") ?? F.with; }

/* live clock on the service home */
setInterval(() => { const c = $("[data-es-clock]"); if (c) { const d = new Date(); c.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; } }, 15000);
