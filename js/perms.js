/* Growth Gusto — area: perms (access and obligations of each person, the « Nouvel équipier » flow). Prefix « pm ».
   Model, on restos/{rid}/members/{id} (and on invites/{code}, copied exactly on join):
     role: "gerant" | "chef" | "equipe"        role "gerant" ⇔ admin: everything, team and subscription included
     poste: "cuisine" | "salle" | "plonge" | "bar" | "second" (display, presets)
     perms: { level: "admin" | "staff",
              modules: { releve, frigos, service, reception, scan, menage, notes, registre, obligations, stock, tickets, dashboard, finance, pointeuse, planning, staff: bool },
              require: { readingPhoto, receptionPhoto, chorePhoto, pin: bool },
              caps:    { editSettings, correctReadings, seeMoney: bool } }
   Backwards compatible: a member WITHOUT perms keeps today's behaviour: gérant = everything; chef and équipe = every module
   except the money ones (tableau de bord, finances, salaires), may correct readings and edit settings, nothing required.
   Demo mode and admins: can() is always true, must() always false.
   API: window.PERMS = { of(id), me(), isAdmin(id?), can(moduleOrRoute), routeAllowed(route), must(key), cap(key), moduleOf(route),
                         summary(id), flow({ from, connect }), edit(id), GROUPS, POSTES } */
"use strict";

Object.assign(IC, {
  pmToque: ["f:M7 13.5h10V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19z", "M7 13.5a4 4 0 0 1-1.2-7.8A4.5 4.5 0 0 1 12 3.6a4.5 4.5 0 0 1 6.2 2.1A4 4 0 0 1 17 13.5", "M7 13.5V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19v-5.5", "M7 17h10"],
  pmCloche: ["f:M4 16.5a8 8 0 0 1 16 0z", "M3 16.5h18", "M4 16.5a8 8 0 0 1 16 0", "M12 8.5V6.5", "M10.5 6.5h3", "M2.5 19.5h19"],
  pmDrop: ["f:M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z", "M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z", "M9.5 15a2.5 2.5 0 0 0 2.5 2.5"],
  pmGlass: ["f:M6 4.5h12l-1 6a5 5 0 0 1-10 0z", "M6 4.5h12l-1 6a5 5 0 0 1-10 0z", "M12 15.5v5", "M8.5 20.5h7", "M6.6 8h10.8"],
  pmCrown: ["f:M4 8l4 4 4-6 4 6 4-4-1.5 10h-13z", "M4 8l4 4 4-6 4 6 4-4-1.5 10h-13z", "M5.5 21h13"],
  pmCam: ["M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z", "c:12,13,3.4"],
  pmPhone: ["r:7,2.5,10,19,2.5", "M11 18.5h2"],
  pmTablet: ["r:3.5,4,17,16,2.5", "M11 17h2"],
  pmKey: ["c:8,15,4", "M11 12l8.5-8.5", "M16 7l2.5 2.5", "M14 9l2 2"],
});

const PM_MONEY = new Set(["dashboard", "finance", "staff"]);
/* [module, icon, title, one line, what the recap says « X pourra … », well colour] */
const PM_GROUPS = [
  ["Tous les jours", [
    ["releve", "therm", "Relevés", "Noter la température des frigos", "faire les relevés de température", "w-vi"],
    ["frigos", "snow", "Frigos", "Voir chaque frigo et son historique", "voir les frigos", "w-sk"],
    ["service", "move", "Mise en place", "Sortir et ranger les produits du service", "faire la mise en place", "w-sa"],
    ["reception", "truck", "Réception", "Contrôler les livraisons", "réceptionner les livraisons", "w-sa"],
    ["scan", "scan", "Scanner et étiquettes", "Ouvrir, sortir, étiqueter les produits", "scanner et étiqueter", "w-in"],
    ["menage", "spray", "Ménage", "Cocher les tâches de nettoyage", "cocher le ménage", "w-sk"],
  ]],
  ["Cuisine", [["notes", "book", "Recettes et procédures", "Fiches, allergènes, méthodes", "lire les recettes et procédures", "w-to"]]],
  ["Contrôles", [
    ["registre", "shield", "Registre HACCP", "Tout l'historique sanitaire", "consulter le registre", "w-sk"],
    ["obligations", "calcheck", "Obligations", "Contrôles et visites à prévoir", "suivre les contrôles", "w-nd"],
  ]],
  ["Bureau", [
    ["stock", "box", "Stock", "Inventaire et quantités", "gérer le stock", "w-to"],
    ["tickets", "receipt", "Tickets de caisse", "Saisir les tickets Z", "saisir les tickets de caisse", "w-sa"],
    ["dashboard", "dash", "Tableau de bord", "Chiffre d'affaires et marges", "voir le tableau de bord", "w-vi"],
    ["finance", "euro", "Finances", "Achats, coûts, résultat", "voir les finances", "w-mi"],
  ]],
  ["Équipe", [
    ["pointeuse", "clock", "Pointeuse", "Pointer ses heures", "pointer", "w-sk"],
    ["planning", "cal", "Planning", "Voir les horaires de chacun", "voir le planning", "w-vi"],
    ["staff", "users", "Salaires", "Fiches employés et salaires", "voir les salaires", "w-mi"],
  ]],
];
const PM_MODS = PM_GROUPS.flatMap(([, it]) => it);
const PM_MOD = Object.fromEntries(PM_MODS.map((m) => [m[0], m]));
/* routes that belong to a module; any other route (accueil, équipe, réglages, plus…) is open to everyone */
const PM_ROUTE = { frigo: "frigos", note: "notes", fiche: "notes", noteProc: "notes", noteDoc: "notes", noteCarte: "notes", regReport: "registre", obl: "obligations", oblCat: "obligations", tzEdit: "tickets",
  finances: "finance", salaires: "staff", salaries: "staff" };
const PM_REQ = [
  ["readingPhoto", "therm", "Photo pour valider un relevé", "Le thermomètre en photo, à chaque frigo", "prendre une photo à chaque relevé"],
  ["receptionPhoto", "truck", "Photo de l'étiquette sanitaire", "À chaque produit reçu en livraison", "photographier l'étiquette sanitaire à la réception"],
  ["chorePhoto", "spray", "Photo de preuve pour le ménage", "Avant de cocher une tâche", "prendre une photo de preuve pour le ménage"],
  ["pin", "lock", "Code personnel", "4 chiffres pour signer et pointer", "signer avec son code personnel"],
];
const PM_CAPS = [
  ["correctReadings", "edit", "Peut corriger un relevé", "Changer une température déjà signée", "corriger un relevé"],
  ["editSettings", "sliders", "Peut modifier les réglages", "Frigos, seuils, tâches, recettes", "modifier les réglages"],
  ["seeMoney", "euro", "Voit les chiffres", "Chiffre d'affaires, coûts, salaires", "voir les chiffres"],
];
const PM_ALLMODS = PM_MODS.map((m) => m[0]);
const pmMods = (on) => Object.fromEntries(PM_ALLMODS.map((k) => [k, on.includes(k)]));
/* job presets: [label, icon, role, modules, require, caps] */
const PM_POSTES = {
  cuisine: ["Cuisine", "pmToque", "equipe", ["releve", "frigos", "service", "reception", "scan", "menage", "notes", "pointeuse", "planning"], { readingPhoto: false, receptionPhoto: true, chorePhoto: false, pin: true }, {}],
  salle: ["Salle", "pmCloche", "equipe", ["scan", "menage", "notes", "pointeuse", "planning"], { pin: true }, {}],
  plonge: ["Plonge", "pmDrop", "equipe", ["menage", "pointeuse", "planning"], { chorePhoto: true, pin: true }, {}],
  bar: ["Bar", "pmGlass", "equipe", ["releve", "frigos", "reception", "scan", "menage", "notes", "stock", "pointeuse", "planning"], { receptionPhoto: true, pin: true }, {}],
  second: ["Second", "pmCrown", "chef", PM_ALLMODS.filter((k) => !PM_MONEY.has(k)), { pin: true }, { correctReadings: true, editSettings: true }],
};
const PM_REQ0 = { readingPhoto: false, receptionPhoto: false, chorePhoto: false, pin: false };
const PM_CAP0 = { editSettings: false, correctReadings: false, seeMoney: false };
function pmPreset(poste) {
  const p = PM_POSTES[poste] || PM_POSTES.cuisine;
  return { level: "staff", modules: pmMods(p[3]), require: { ...PM_REQ0, ...p[4] }, caps: { ...PM_CAP0, ...p[5] } };
}

/* ───────────── model ───────────── */
const pmMember = (id) => (S.members || []).find((m) => m.id === id);
function pmNorm(m) {
  if (!m) return { level: "admin", legacy: true, modules: pmMods(PM_ALLMODS), require: { ...PM_REQ0 }, caps: { editSettings: true, correctReadings: true, seeMoney: true } };
  if (m.role === "gerant") return { level: "admin", legacy: !m.perms, modules: pmMods(PM_ALLMODS), require: { ...PM_REQ0 }, caps: { editSettings: true, correctReadings: true, seeMoney: true }, poste: m.poste || "" };
  const p = m.perms && typeof m.perms === "object" ? m.perms : null;
  if (!p || p.level === "admin") {
    /* legacy chef / équipe: every module but the money ones, may correct and edit, nothing required */
    return { level: "staff", legacy: true, modules: pmMods(PM_ALLMODS.filter((k) => !PM_MONEY.has(k))), require: { ...PM_REQ0 }, caps: { editSettings: true, correctReadings: true, seeMoney: false }, poste: m.poste || "" };
  }
  const mods = {}; PM_ALLMODS.forEach((k) => { mods[k] = !!(p.modules && p.modules[k]); });
  const caps = { ...PM_CAP0, ...(p.caps || {}) }; if (!caps.seeMoney) PM_MONEY.forEach((k) => { mods[k] = false; });
  return { level: "staff", legacy: false, modules: mods, require: { ...PM_REQ0, ...(p.require || {}) }, caps, poste: m.poste || "" };
}
function pmIsAdminMe() {
  if (DB.mode === "demo" || !S.resto) return true;
  if (typeof myRole === "function" && myRole() === "gerant") return true;
  return !pmMember(S.me.id) && !(S.members || []).length; /* members not loaded yet: never flash a refusal */
}
const pmMe = () => (pmIsAdminMe() ? pmNorm(null) : pmNorm(pmMember(S.me.id) || { role: "equipe" }));
const pmModuleOf = (route) => { route = String(route || ""); return PM_MOD[route] ? route : PM_ROUTE[route] || null; };
function pmRouteAllowed(route) {
  if (pmIsAdminMe()) return true;
  const r = String(route || ""); const p = pmMe();
  if (["marges", "expenses", "couts"].includes(r)) return !!p.caps.seeMoney;
  const k = pmModuleOf(r); if (!k) return r !== "abonnementAdmin";
  return !!p.modules[k] && (!PM_MONEY.has(k) || !!p.caps.seeMoney);
}
function pmSummary(id) {
  const m = pmMember(id); const p = pmNorm(m); const fn = firstName((m && m.name) || "") || "Il";
  if (p.level === "admin") return { admin: true, can: ["tout voir et tout gérer, y compris l'équipe et l'abonnement"], must: [], short: "Accès à tout", name: fn };
  const mods = PM_MODS.filter((x) => p.modules[x[0]]);
  const can = mods.map((x) => x[4]).concat(PM_CAPS.filter((c) => p.caps[c[0]] && c[0] !== "seeMoney").map((c) => c[4]));
  const must = PM_REQ.filter((r) => p.require[r[0]]).map((r) => r[4]);
  const short = p.legacy ? "Accès habituel · sans les chiffres" : `${mods.length} module${mods.length > 1 ? "s" : ""}${must.length ? ` · ${must.length} obligation${must.length > 1 ? "s" : ""}` : ""}`;
  return { admin: false, can, must, short, mods, name: fn, p };
}

window.PERMS = {
  GROUPS: PM_GROUPS, POSTES: PM_POSTES, REQUIRE: PM_REQ, CAPS: PM_CAPS,
  of: (id) => pmNorm(pmMember(id)),
  me: pmMe,
  isAdmin: (id) => (id == null || id === S.me.id ? pmIsAdminMe() : pmNorm(pmMember(id)).level === "admin"),
  moduleOf: pmModuleOf,
  routeAllowed: pmRouteAllowed,
  can: (x) => pmRouteAllowed(x),
  must: (k) => !pmIsAdminMe() && !!pmMe().require[k],
  cap: (k) => pmIsAdminMe() || !!pmMe().caps[k],
  summary: pmSummary,
  preset: pmPreset,
  flow: (o) => pmFlowOpen(o || {}),
  edit: (id) => pmEditOpen(id),
};

/* ───────────── guards: forbidden screen + forbidden actions (whatever renders the button) ───────────── */
TAB_OF.noaccess = "more";
VIEWS.noaccess = {
  render(p) {
    const k = pmModuleOf(p && p.route); const t = k ? PM_MOD[k][2] : "Cette page";
    const g = (S.members || []).find((m) => m.role === "gerant");
    return `<div class="inner narrow pm-na"><div class="pm-na-card st" style="--i:0"><span class="pm-na-ic">${ico("lock")}</span>
      <div class="h2">Pas d'accès ici</div><p class="sub">${esc(t)} n'est pas ouvert pour vous. ${g ? `${esc(firstName(g.name) || "Le gérant")} peut vous l'ouvrir` : "Le gérant peut vous l'ouvrir"} dans Équipe.</p>
      <button class="btn acc block" data-go="home">${ico("home")}Retour à l'accueil</button></div></div>`;
  },
};
const PM_ACT_CAP = {
  correctReadings: ["relFix", "relFixBack", "relFixSave", "relFixCorr", "relFixSvc", "relSlot", "relDel", "relDelOk"],
  editSettings: ["fridgeEdit", "fridgeSave", "fridgeDel", "fridgeDelOk", "fridgeOrder", "menEdit", "menSave", "menDel", "menDelOk", "choreEdit", "menStarter", "choreStarter", "noteNew", "noteEdit", "noteSave", "noteDel", "noteDelOk", "npEdit", "npSave", "npDel", "npAdd", "npGen", "npGenGo"],
};
const PM_CAP_TX = { correctReadings: "Corriger un relevé est réservé", editSettings: "Modifier les réglages est réservé" };
const PM_BY_ACT = {}; Object.entries(PM_ACT_CAP).forEach(([c, acts]) => acts.forEach((a) => { PM_BY_ACT[a] = c; }));
function pmDeny(msg) { SFX.err(); buzz([20, 40, 20]); toast(msg, "err"); }
const pmPhotoOf = (key) => { try { const p = typeof relPhOf === "function" ? relPhOf(key) : null; return !!(p && !p.busy && (p.photoId || p.photoUrl || p.src)); } catch (e) { return true; } };
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("[data-act]"); if (!a || !S.resto || pmIsAdminMe()) return;
  const act = a.dataset.act; const stop = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  const c = PM_BY_ACT[act];
  if (c && !PERMS.cap(c)) { stop(); pmDeny(`${PM_CAP_TX[c]} : demandez au gérant.`); return; }
  if (PERMS.must("readingPhoto")) {
    if (act === "relAll" || act === "relAllOk") { stop(); pmDeny("Photo obligatoire : validez frigo par frigo."); return; }
    const key = act === "saveReading" ? a.dataset.id : act === "relSvcSave" ? "s-" + a.dataset.id : null;
    if (key && !pmPhotoOf(key)) { stop(); pmDeny("Photo obligatoire : prenez le thermomètre en photo."); if (ACT.relPhoto) setTimeout(() => ACT.relPhoto(a, key), 350); }
  }
}, true);

/* ───────────── the flow ───────────── */
const PM = { F: null };
const pmColorFree = () => { const used = (S.members || []).map((m) => m.color); return PALETTE.find((c) => !used.includes(c)) || PALETTE[(S.members || []).length % PALETTE.length]; };
const pmCloud = () => !!DB.uid;
const pmCanInvite = () => !!DB.uid || DB.mode === "demo";
function pmSteps(F) {
  const s = ["who", "admin"]; if (!F.admin) s.push("access", "rules");
  if (F.mode === "new") s.push("connect"); s.push("recap"); if (F.done) s.push("done"); return s;
}
function pmFlowOpen(o) {
  if (!pmIsAdminMe()) { pmDeny("Seul un gérant peut ajouter quelqu'un."); return; }
  const p = pmPreset("cuisine");
  PM.F = { mode: "new", id: null, from: o.from || "", step: "who", dir: "fwd", name: o.name || "", photo: "", poste: "", admin: null, ...p, connect: o.connect || (pmCanInvite() ? "" : "local"), pin: "", color: pmColorFree(), touched: false };
  pmMount(); SFX.sheet && SFX.sheet();
}
function pmEditOpen(id) {
  const m = pmMember(id); if (!m) return;
  if (!pmIsAdminMe()) { pmDeny("Seul un gérant peut changer les accès."); return; }
  if (id === S.me.id) { pmDeny("Vos propres accès se règlent par un autre gérant."); return; }
  if (typeof ccIsOwner === "function" && ccIsOwner(id)) { pmDeny("Le propriétaire a toujours accès à tout."); return; }
  const n = pmNorm(m); const admin = m.role === "gerant";
  const base = admin ? pmPreset(m.poste || "cuisine") : n;
  PM.F = { mode: "edit", id, step: "who", dir: "fwd", name: m.name || "", photo: m.photo || "", poste: m.poste || "", admin, level: "staff", modules: { ...base.modules }, require: { ...base.require }, caps: { ...base.caps }, connect: "", pin: "", color: m.color || colorFor(id), touched: true };
  pmMount(); SFX.sheet && SFX.sheet();
}
function pmMount() {
  let el = $("#pmFlow");
  if (!el) { el = document.createElement("div"); el.id = "pmFlow"; el.className = "pm-flow"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Nouvel équipier"); document.body.appendChild(el); }
  el.hidden = false; pmPaint(); void el.offsetWidth; el.classList.add("on");
  try { ["#app", "#tabbar"].forEach((s) => $(s) && $(s).setAttribute("inert", "")); } catch (e) {}
}
function pmClose() {
  const el = $("#pmFlow"); if (!el) return; el.classList.remove("on"); PM.F = null;
  try { ["#app", "#tabbar"].forEach((s) => $(s) && $(s).removeAttribute("inert")); } catch (e) {}
  setTimeout(() => { if (!PM.F) { el.hidden = true; el.innerHTML = ""; } }, 380);
}
const pmFirst = (F) => esc(firstName(F.name) || "Il");
const pmAvaHTML = (F, s) => F.photo ? `<span class="cc-ava img" style="--s:${s}px"><img src="${esc(F.photo)}" alt=""></span>` : `<span class="cc-ava" style="--s:${s}px;--c:${esc(F.color)}">${esc(initials(F.name || "") || "?")}</span>`;
const pmSw = (on) => `<span class="pm-sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span>`;
function pmRow(act, k, ic, t, s, on, well) {
  return `<button class="pm-row ${on ? "on" : ""}" data-act="${act}" data-v="${k}" role="switch" aria-checked="${on}"><span class="pm-wl ${well || "w-vi"}">${ico(IC[ic] ? ic : "grid")}</span><span class="tx"><b>${t}</b><em>${s}</em></span>${pmSw(on)}</button>`;
}
function pmPane(F) {
  const nm = pmFirst(F);
  if (F.step === "who") return `<div class="pm-q"><span class="pm-kick">${F.mode === "edit" ? "Modifier" : "Nouvel équipier"}</span><h2 class="pm-h">${F.mode === "edit" ? "Son prénom et son poste" : "Qui arrive dans l'équipe ?"}</h2></div>
    <div class="pm-who"><button class="pm-photo" data-act="pmPhoto" aria-label="Ajouter une photo">${pmAvaHTML(F, 84)}<span class="pm-photo-b">${ico("pmCam")}</span></button>
      <input class="input pm-name" id="pmName" value="${esc(F.name)}" placeholder="Son prénom" autocomplete="off" autocapitalize="words" maxlength="40" enterkeyhint="next" aria-label="Prénom"></div>
    <div class="lbl pm-lbl">Son poste</div>
    <div class="pm-postes">${Object.entries(PM_POSTES).map(([k, p], i) => `<button class="pm-poste ${F.poste === k ? "on" : ""}" style="--i:${i}" data-act="pmPoste" data-v="${k}" aria-pressed="${F.poste === k}"><span class="pm-pi">${ico(p[1])}</span><b>${p[0]}</b></button>`).join("")}</div>`;
  if (F.step === "admin") return `<div class="pm-q"><span class="pm-kick">${nm}</span><h2 class="pm-h">Gère-t-il le restaurant avec vous ?</h2></div>
    <div class="pm-opts">
      <button class="pm-opt ${F.admin === true ? "on" : ""}" data-act="pmAdmin" data-v="1"><span class="pm-oi w-in">${ico("pmCrown")}</span><span class="tx"><b>Oui, il gère avec moi</b><em>Accès à tout : équipe, chiffres, abonnement</em></span></button>
      <button class="pm-opt ${F.admin === false ? "on" : ""}" data-act="pmAdmin" data-v="0"><span class="pm-oi w-vi">${ico("users")}</span><span class="tx"><b>Non, c'est un équipier</b><em>Vous choisissez ce qu'il voit et doit faire</em></span></button>
    </div>`;
  if (F.step === "access") { const pl = F.poste ? PM_POSTES[F.poste][0].toLowerCase() : "";
    return `<div class="pm-q"><span class="pm-kick">${nm}</span><h2 class="pm-h">À quoi a-t-il accès ?</h2><p class="pm-s">${pl ? `Préréglé pour la ${pl === "second" ? "fonction de second" : pl}. ` : ""}Touchez pour changer.</p></div>
    <div class="pm-grps">${PM_GROUPS.map(([g, items]) => `<div class="pm-grp"><div class="lbl pm-lbl">${g}</div><div class="pm-list">${items.filter(([k]) => VIEWS[k] || k === "staff").map(([k, ic, t, s, , w]) => pmRow("pmMod", k, ic, t, s, !!F.modules[k], w)).join("")}</div></div>`).join("")}</div>`; }
  if (F.step === "rules") return `<div class="pm-q"><span class="pm-kick">${nm}</span><h2 class="pm-h">Qu'est-ce qui est obligatoire ?</h2></div>
    <div class="pm-grps"><div class="pm-grp"><div class="lbl pm-lbl">Il doit</div><div class="pm-list">${PM_REQ.map(([k, ic, t, s]) => pmRow("pmReq", k, ic, t, s, !!F.require[k], "w-sa")).join("")}</div></div>
    <div class="pm-grp"><div class="lbl pm-lbl">Il peut aussi</div><div class="pm-list">${PM_CAPS.map(([k, ic, t, s]) => pmRow("pmCap", k, ic, t, s, !!F.caps[k], "w-vi")).join("")}</div></div></div>`;
  if (F.step === "connect") { const inv = pmCanInvite();
    return `<div class="pm-q"><span class="pm-kick">${nm}</span><h2 class="pm-h">Comment se connecte-t-il ?</h2></div>
    <div class="pm-opts">
      ${inv ? `<button class="pm-opt ${F.connect === "invite" ? "on" : ""}" data-act="pmConn" data-v="invite"><span class="pm-oi w-vi">${ico("pmPhone")}</span><span class="tx"><b>Sur son téléphone</b><em>Il reçoit une invitation : code, lien ou QR</em></span></button>` : ""}
      <button class="pm-opt ${F.connect === "local" ? "on" : ""}" data-act="pmConn" data-v="local"><span class="pm-oi w-sa">${ico("pmTablet")}</span><span class="tx"><b>Sur cet appareil</b><em>Il touche son visage, puis tape son code</em></span></button>
    </div>
    ${F.connect === "local" ? `<label class="pm-pin"><span class="lbl pm-lbl">Son code à 4 chiffres <em class="pm-opt-t">facultatif</em></span><input class="input mono pm-pinin" id="pmPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" value="${esc(F.pin)}" placeholder="Sinon, il le crée à sa première connexion"></label>` : ""}`; }
  if (F.step === "recap") { const can = F.admin ? ["tout voir et tout gérer, y compris l'équipe et l'abonnement"] : PM_MODS.filter((x) => F.modules[x[0]] && (VIEWS[x[0]] || x[0] === "staff")).map((x) => x[4]).concat(PM_CAPS.filter((c) => F.caps[c[0]] && c[0] !== "seeMoney").map((c) => c[4]));
    const must = F.admin ? [] : PM_REQ.filter((r) => F.require[r[0]]).map((r) => r[4]);
    const how = F.mode === "edit" ? "" : F.connect === "invite" ? "se connecter sur son téléphone avec une invitation" : "se connecter sur cet appareil";
    return `<div class="pm-q pm-rq"><span class="pm-rava">${pmAvaHTML(F, 72)}</span><h2 class="pm-h">${esc(F.name || "Nouvel équipier")}</h2><p class="pm-s">${F.admin ? "Gère le restaurant" : F.poste ? PM_POSTES[F.poste][0] : "Équipier"}</p></div>
    <div class="pm-rec"><div class="pm-rc"><b class="pm-rt">${nm} pourra</b><ul>${can.length ? can.map((t) => `<li><span class="pm-b ok"></span>${esc(t)}</li>`).join("") : `<li><span class="pm-b"></span>pointer et signer, sans autre module</li>`}${how ? `<li><span class="pm-b ok"></span>${how}</li>` : ""}</ul></div>
    ${must.length ? `<div class="pm-rc must"><b class="pm-rt">${nm} devra</b><ul>${must.map((t) => `<li><span class="pm-b sa"></span>${esc(t)}</li>`).join("")}</ul></div>` : ""}</div>`; }
  if (F.step === "done") { const c = F.done; const link = typeof AUTH !== "undefined" && AUTH.invLink ? AUTH.invLink(c.code) : c.code;
    return `<div class="pm-q"><span class="pm-kick">Invitation prête</span><h2 class="pm-h">Envoyez-la à ${nm}</h2></div>
    <div class="pm-inv"><div class="pm-qr">${typeof AUTH !== "undefined" && AUTH.qr ? AUTH.qr(link) : ""}</div><b class="pm-code">${esc(typeof auFmtCode === "function" ? auFmtCode(c.code) : c.code)}</b><em>Pour ${nm} seul · valable 7 jours</em></div>
    ${DB.mode === "demo" ? `<div class="banner">${ico("alert")}<span>Démo : ce code est un exemple.</span></div>` : ""}`; }
  return "";
}
function pmCta(F) {
  const st = F.step; const steps = pmSteps(F);
  if (st === "admin" && F.admin == null) return `<p class="pm-hint">Touchez une réponse</p>`;
  if (st === "recap") return `<button class="btn acc block pm-go" data-act="pmSave">${F.mode === "edit" ? `${ico("check")}Enregistrer` : F.connect === "invite" ? `${ico("auLink")}Créer l'invitation` : `${ico("plus")}Créer ${pmFirst(F)}`}</button>`;
  if (st === "done") return `<div class="pm-ctas">${navigator.share ? `<button class="btn acc" data-act="pmShare">${ico("share")}Partager</button>` : ""}<button class="btn ${navigator.share ? "soft" : "acc"}" data-act="pmCopy">${ico("auCopy")}Copier le lien</button></div><button class="btn ghost block" data-act="pmClose">Terminé</button>`;
  const skip = (st === "access" || st === "rules") ? `<button class="btn ghost block pm-skip" data-act="pmNext">Garder ces réglages</button>` : "";
  return `<button class="btn acc block pm-go" data-act="pmNext">Continuer${ico("chev")}</button>${st === "access" || st === "rules" ? "" : skip}`;
}
function pmPaint() {
  const F = PM.F; const el = $("#pmFlow"); if (!F || !el) return;
  const steps = pmSteps(F); const i = steps.indexOf(F.step);
  const first = i === 0 || F.step === "done";
  el.innerHTML = `<div class="pm-card">
    <div class="pm-top">${first ? `<span class="pm-sp"></span>` : `<button class="iconbtn" data-act="pmBack" aria-label="Retour">${ico("back")}</button>`}
      <div class="pm-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${i + 1}">${steps.map((s, k) => `<i class="${k < i ? "done" : k === i ? "on" : ""}"></i>`).join("")}</div>
      <button class="iconbtn" data-act="pmClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="pm-body"><div class="pm-pane ${F.dir === "bwd" ? "bwd" : "fwd"}" data-step="${F.step}">${pmPane(F)}</div></div>
    <div class="pm-cta">${pmCta(F)}</div></div>`;
  if (F.step === "who" && !F.name) setTimeout(() => { const n = $("#pmName"); if (n && window.matchMedia("(min-width:700px)").matches) n.focus({ preventScroll: true }); }, 320);
}
function pmGo(step, dir) { const F = PM.F; F.dir = dir || "fwd"; F.step = step; pmPaint(); SFX.tap(); buzz(5); }
function pmNext() {
  const F = PM.F; if (!F) return; const steps = pmSteps(F); const i = steps.indexOf(F.step);
  if (F.step === "who") { const n = $("#pmName"); F.name = (n ? n.value : F.name).trim(); if (!F.name) { if (typeof ccShake === "function") ccShake(n); else SFX.err(); n && n.focus(); return; }
    if ((S.members || []).some((m) => m.id !== F.id && (m.name || "").trim().toLowerCase() === F.name.toLowerCase())) { if (typeof ccShake === "function") ccShake(n); toast(`Il y a déjà un ${F.name} : ajoutez une initiale.`, "err"); return; } }
  if (F.step === "admin" && F.admin == null) return;
  if (F.step === "connect") { if (!F.connect) { SFX.err(); toast("Choisissez comment il se connecte.", "err"); return; }
    if (F.connect === "local") { const pin = ($("#pmPin")?.value || "").trim(); if (pin && (!/^\d{4}$/.test(pin) || (typeof ccWeakPin === "function" && ccWeakPin(pin)))) { if (typeof ccShake === "function") ccShake($("#pmPin")); toast(/^\d{4}$/.test(pin) ? "Code trop facile à deviner." : "Le code doit faire 4 chiffres.", "err"); return; } F.pin = pin; } }
  if (i < steps.length - 1) pmGo(steps[i + 1], "fwd");
}
function pmPerms(F) {
  if (F.admin) return { level: "admin" };
  const caps = { ...F.caps }; const modules = { ...F.modules }; if (!caps.seeMoney) PM_MONEY.forEach((k) => { modules[k] = false; });
  return { level: "staff", modules, require: { ...F.require }, caps };
}
const pmRole = (F) => (F.admin ? "gerant" : F.poste === "second" ? "chef" : "equipe");
async function pmSave() {
  const F = PM.F; if (!F || F.busy) return; F.busy = true; const btn = $(".pm-go"); btn && btn.setAttribute("disabled", "");
  const role = pmRole(F), perms = pmPerms(F); const fn = firstName(F.name);
  try {
    if (F.mode === "edit") {
      const m = pmMember(F.id); if (!m) throw new Error("gone");
      if (m.role === "gerant" && role !== "gerant" && (S.members || []).filter((x) => x.role === "gerant").length < 2) { SFX.err(); toast("Il faut au moins un gérant dans l'équipe.", "err"); F.busy = false; btn && btn.removeAttribute("disabled"); return; }
      const patch = { name: F.name, role, perms, poste: F.poste || "", ...(F.photo !== (m.photo || "") ? { photo: F.photo || "" } : {}) };
      await safe(DB.update("members", F.id, patch));
      S.profiles[F.id] = { ...(S.profiles[F.id] || {}), name: F.name, ...(F.photo ? { avatarUrl: F.photo } : {}) };
      await logEvent("team", `a changé les accès de ${fn}`);
      pmClose(); SFX.ok(); buzz(8); toast(`Accès de ${fn} enregistrés`); renderChrome(); rerender(); return;
    }
    if (F.connect === "invite") {
      const code = typeof auCode === "function" ? auCode(8) : Math.random().toString(36).slice(2, 10).toUpperCase(); const now = Date.now();
      const doc = { rid: S.rid, restoName: S.resto?.name || "", role, perms, name: F.name, poste: F.poste || "", ...(F.photo ? { photo: F.photo } : {}), createdBy: S.me.id, createdByName: S.me.name || "", createdAt: now, expiresAt: now + 7 * 864e5, uses: 0, maxUses: 1 };
      if (DB.uid && typeof AUTH !== "undefined" && AUTH.fs) await AUTH.timeout(AUTH.fs.collection("invites").doc(code).set(doc), 12000);
      if (S.ui.auInv && S.ui.auInv.list) S.ui.auInv.list.unshift({ code, ...doc });
      await logEvent("team", `a invité ${fn}`).catch(() => {});
      F.done = { code, ...doc }; F.busy = false; SFX.done(); buzz([10, 30, 10]); pmGo("done", "fwd"); return;
    }
    const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const pinP = F.pin && typeof ccPinPatch === "function" ? ccPinPatch(id, F.pin) : {};
    await safe(DB.set("members", id, { role, name: F.name, color: F.color, joinedAt: Date.now(), by: S.me.id, poste: F.poste || "", perms, ...(F.photo ? { photo: F.photo } : {}), ...pinP }));
    S.profiles[id] = { name: F.name, color: F.color, ...(F.photo ? { avatarUrl: F.photo } : {}) };
    await logEvent("team", `a ajouté ${F.name} à l'équipe`);
    const from = F.from; pmClose(); SFX.done(); buzz([10, 30, 10]); burst(window.innerWidth / 2, window.innerHeight / 2); toast(`${fn} fait partie de l'équipe`);
    renderChrome(); if (S.route === "equipe" || from === "equipe") rerender();
    try { window.dispatchEvent(new CustomEvent("gg:member", { detail: { id, from } })); } catch (e) {}
  } catch (e) { console.warn("perms", e); F.busy = false; btn && btn.removeAttribute("disabled"); SFX.err(); toast(e && e.code === "permission-denied" ? "Seul un gérant peut faire ça." : "Enregistrement impossible, réessayez.", "err"); }
}
Object.assign(ACT, {
  pmNext: () => pmNext(),
  pmBack: () => { const F = PM.F; if (!F) return; const steps = pmSteps(F); const i = steps.indexOf(F.step); if (F.step === "who") { const n = $("#pmName"); if (n) F.name = n.value; } if (i > 0) pmGo(steps[i - 1], "bwd"); else pmClose(); },
  pmClose: () => { SFX.close && SFX.close(); pmClose(); },
  pmPoste: (a, id, v) => { const F = PM.F; const n = $("#pmName"); if (n) F.name = n.value; F.poste = F.poste === v ? "" : v; if (!F.touched || F.mode === "new") Object.assign(F, pmPreset(F.poste || "cuisine")); if (v === "second" && F.admin == null) F.admin = false;
    $$(".pm-poste").forEach((b) => { const on = b.dataset.v === F.poste; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); a.classList.remove("bump"); void a.offsetWidth; a.classList.add("bump"); SFX.tick(); buzz(5); },
  pmAdmin: (a, id, v) => { const F = PM.F; F.admin = v === "1"; $$(".pm-opt").forEach((b) => b.classList.toggle("on", b === a)); SFX.ok(); buzz(6); setTimeout(() => { if (PM.F === F && F.step === "admin") pmNext(); }, 260); },
  pmMod: (a, id, v) => { const F = PM.F; F.touched = true; F.modules[v] = !F.modules[v]; if (F.modules[v] && PM_MONEY.has(v)) F.caps.seeMoney = true; pmToggleEl(a, F.modules[v]); },
  pmReq: (a, id, v) => { const F = PM.F; F.touched = true; F.require[v] = !F.require[v]; pmToggleEl(a, F.require[v]); },
  pmCap: (a, id, v) => { const F = PM.F; F.touched = true; F.caps[v] = !F.caps[v]; if (v === "seeMoney" && !F.caps[v]) PM_MONEY.forEach((k) => { F.modules[k] = false; }); pmToggleEl(a, F.caps[v]); },
  pmConn: (a, id, v) => { const F = PM.F; const p = $("#pmPin"); if (p) F.pin = p.value; F.connect = v; SFX.tick(); buzz(5); F.dir = "none"; pmPaint(); if (v === "local") setTimeout(() => $("#pmPin")?.focus({ preventScroll: true }), 200); },
  pmPhoto: async () => { const F = PM.F; const n = $("#pmName"); if (n) F.name = n.value; const [f] = await pickImage(); if (!f || !PM.F) return;
    try { const sh = await shrink(f, 200, 0.8); const c = sh.canvas; const s = Math.min(c.width, c.height); const t = document.createElement("canvas"); t.width = t.height = Math.min(160, s); t.getContext("2d").drawImage(c, (c.width - s) / 2, (c.height - s) / 2, s, s, 0, 0, t.width, t.height); F.photo = t.toDataURL("image/jpeg", 0.72); SFX.ok(); F.dir = "none"; pmPaint(); } catch (e) { toast("Photo illisible, réessayez.", "err"); } },
  pmSave: () => pmSave(),
  pmShare: async () => { const c = PM.F && PM.F.done; if (!c) return; const url = AUTH.invLink(c.code); try { await navigator.share({ title: `Rejoignez ${S.resto?.name || "l'équipe"} sur Growth Gusto`, text: `${S.me.name ? firstName(S.me.name) + " vous invite" : "Vous êtes invité"} à rejoindre ${S.resto?.name || "l'équipe"} sur Growth Gusto. Code : ${auFmtCode(c.code)}`, url }); SFX.ok(); } catch (e) { if (e && e.name !== "AbortError") ACT.pmCopy(); } },
  pmCopy: async () => { const c = PM.F && PM.F.done; if (!c) return; const t = AUTH.invLink(c.code); let ok = false; try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {} if (ok) { SFX.ok(); toast("Lien copié"); } else toast(t, "info"); },
  pmEdit: (a, id) => { closeSheet(true); setTimeout(() => pmEditOpen(id), 120); },
  pmNew: () => pmFlowOpen({ from: "equipe" }),
});
function pmToggleEl(a, on) {
  a.classList.toggle("on", on); a.setAttribute("aria-checked", on); const sw = $(".pm-sw", a); if (sw) sw.classList.toggle("on", on); SFX.tick(); buzz(4);
  /* money modules and « Voit les chiffres » move together */
  const F = PM.F; $$("#pmFlow .pm-row").forEach((b) => { const k = b.dataset.v; const v = b.dataset.act === "pmMod" ? F.modules[k] : b.dataset.act === "pmReq" ? F.require[k] : F.caps[k]; if (!!v !== b.classList.contains("on")) { b.classList.toggle("on", !!v); b.setAttribute("aria-checked", !!v); $(".pm-sw", b)?.classList.toggle("on", !!v); } });
}
document.addEventListener("input", (e) => { if (e.target.id === "pmName" && PM.F) { PM.F.name = e.target.value; const av = $("#pmFlow .pm-photo .cc-ava:not(.img)"); if (av) av.textContent = initials(e.target.value) || "?"; } if (e.target.id === "pmPin") e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
document.addEventListener("keydown", (e) => {
  if (!PM.F || !$("#pmFlow.on")) return;
  if (e.key === "Escape") { e.stopPropagation(); pmClose(); return; }
  if (e.key === "Enter" && (e.target.id === "pmName" || e.target.id === "pmPin")) { e.preventDefault(); pmNext(); }
}, true);
