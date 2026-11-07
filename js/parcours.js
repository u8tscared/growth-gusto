/* Growth Gusto — area: parcours (« Prise en main » : onboarding du patron, formation de chaque personne à l'app). Prefix « pc ».
   1) Fonctionnalités du restaurant : restos/{rid}.modsOff = [routes du menu coupées] (gérant seulement, firestore.rules).
      Une route coupée disparaît partout (menu, Plus, onglets, go) parce que PERMS.routeAllowed est enveloppé ici.
      restos/{rid}.profil = { services:[], offre:[], taille, equipe, multi } : ce que le patron a dit de sa maison.
      Les familles (js/lecons.js PC_FAMILLES) regroupent les routes ; tout écran du menu hors famille apparaît sous « Autres ».
   2) Onboarding : deux étapes ajoutées à js/onboard.js, « Votre maison » (profil) et « Vos fonctions » (choix par pack),
      puis « C'est prêt » lance la prise en main des modules activés. Les étapes Frigos / Étiquettes / Imprimante sautent
      quand leur fonctionnalité est coupée.
   3) Formation : PC.play({ mid }) joue le parcours d'une personne, calculé à la volée (pcPlan) depuis le menu de l'app,
      les leçons (js/lecons.js), son rôle, son poste, ses droits (js/perms.js), ses vues et son appareil (js/espaces.js).
      Chaque leçon : la scène animée + « Pourquoi », « Comment » (les gestes, la scène les montre), « À vous » (une question).
   4) Suivi : restos/{rid}/prise/{memberId} = { memberId, name, done:{clé:ts}, miss:{clé:n}, startedAt, finishedAt?, updatedAt }.
      Route « priseEnMain » (menu Équipe, Plus, toutes les vues) : ma formation + celle de l'équipe pour le gérant et le chef.
      Route « fonctions » (Réglages) : activer ou couper une fonctionnalité plus tard.
   Démo : rien n'est enregistré pour de vrai (DB démo), l'équipe de la démo a des formations à différents stades. */
"use strict";

Object.assign(IC, {
  pcCap: ["M2 9.5 12 5l10 4.5-10 4.5z", "M6 11.4v4.1c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.1", "M22 9.5v5"],
  pcPlay: ["f:M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z"],
  pcSpark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "m6 6 2.5 2.5", "m15.5 15.5 2.5 2.5", "m6 18 2.5-2.5", "m15.5 8.5 2.5-2.5"],
  pcToggles: ["r:2,5,20,6,3", "c:8,8,1.6", "r:2,13,20,6,3", "c:16,16,1.6"],
  pcHome: ["M3 10.5 12 4l9 6.5", "M5.5 9v10.5h13V9", "M10 19.5v-5h4v5"],
});
TAB_OF.priseEnMain = "more"; TAB_OF.fonctions = "more";
/* the menu: « Prise en main » right after « Formation HACCP » (Équipe) */
(function pcNav() {
  if (NAV.some((n) => n[0] === "priseEnMain")) return;
  const i = NAV.findIndex((n) => n[0] === "formation"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["priseEnMain", "pcCap", "Prise en main"]);
  try { if (typeof ES_ALWAYS !== "undefined" && !ES_ALWAYS.includes("priseEnMain")) ES_ALWAYS.push("priseEnMain"); if (typeof ES_MOI_SET !== "undefined" && !ES_MOI_SET.includes("priseEnMain")) ES_MOI_SET.push("priseEnMain"); } catch (e) {}
})();

const PC = { rows: null, rid: null, seeded: {}, run: null, demoOff: null, demoProfil: null, who: null, F: null, hiT: 0 };
const pcReduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const pcDesk = () => { try { return matchMedia("(min-width:960px)").matches; } catch (e) { return false; } };
const pcIco = (n, fb = "pcSpark") => ico(IC[n] ? n : fb);
const pcDemo = () => DB.mode === "demo";
const pcPl = (n, w, ws) => `${n} ${n > 1 ? ws || w + "s" : w}`;
const pcLS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { if (pcDemo()) return; try { localStorage.setItem(k, v); } catch (e) {} } };
const pcRole = () => (typeof myRole === "function" ? myRole() : "gerant");
const pcIsBoss = () => pcRole() === "gerant" && !(pcDemo() && S.demoAs && S.demoAs !== "demo-camille");
const pcIsMgr = () => ["gerant", "chef"].includes(pcRole());

/* ═══════════════════════ 1. fonctionnalités du restaurant ═══════════════════════ */
const PC_PARENT = { frigo: "frigos", note: "notes", fiche: "notes", noteProc: "notes", noteDoc: "notes", noteCarte: "notes", tzEdit: "tickets", regReport: "registre", obl: "obligations", oblCat: "obligations",
  margeFiche: "marges", facture: "factures", factureScan: "factures", caisseMap: "caisse", achat: "achats", refroid: "hygiene", friture: "hygiene", staff: "equipe", ctVue: "controle", ctDossier: "controle", pms: "controle" };
function pcOffSet() {
  const v = pcDemo() ? PC.demoOff : S.resto && Array.isArray(S.resto.modsOff) ? S.resto.modsOff : null;
  return new Set(v || []);
}
function pcRouteOff(r) {
  r = String(r || ""); if (!r || PC_TOUJOURS.has(r)) return false;
  const off = pcOffSet(); if (!off.size) return false;
  return off.has(r) || (PC_PARENT[r] ? off.has(PC_PARENT[r]) : false);
}
window.pcRouteOff = pcRouteOff;
(function pcWrapPerms() {
  if (typeof PERMS === "undefined" || PERMS._pc) return; const ra = PERMS.routeAllowed, can = PERMS.can;
  PERMS.routeAllowed = (r) => (pcRouteOff(r) ? false : ra(r)); PERMS.can = (x) => (pcRouteOff(x) ? false : can(x)); PERMS._pc = true;
})();
/* the screens of the menu, in menu order (the single source: NAV) */
const pcNavRoutes = () => NAV.filter((n) => n[0] !== "sep" && VIEWS[n[0]]).map((n) => n[0]);
const pcNavOf = (r) => NAV.find((n) => n[0] === r);
/* families of the feature picker: PC_FAMILLES for the screens that exist, then every other screen of the menu on its own (« Autres ») */
function pcFams() {
  const routes = pcNavRoutes(), have = new Set(routes), used = new Set();
  const out = PC_FAMILLES.map(([k, t, d, ic, rs, ch]) => { const r = rs.filter((x) => have.has(x)); r.forEach((x) => used.add(x)); return { k, t, d, ic, routes: r, ch }; }).filter((f) => f.routes.length);
  routes.forEach((r) => { if (used.has(r) || PC_TOUJOURS.has(r)) return; const n = pcNavOf(r); out.push({ k: "r:" + r, t: n[2], d: (PC_LECONS[r] && PC_LECONS[r].d.split(/[.:]/)[0]) || "", ic: n[1], routes: [r], ch: "Autres" }); });
  return out;
}
const PC_CHAPS = ["Hygiène", "Salle", "Gestion", "Équipe", "Restaurant", "Autres"];
const pcPackOf = (routes) => { let lv = 1; try { routes.forEach((r) => { const g = typeof AB_GATE !== "undefined" && AB_GATE[r]; if (g && AB_LVL[g[0]] > lv) lv = AB_LVL[g[0]]; }); } catch (e) {} return ["", "essentiel", "pro", "complet"][lv]; };
const pcFamOn = (f, off = pcOffSet()) => f.routes.some((r) => !off.has(r));
const pcChapOf = (r) => { const f = pcFams().find((x) => x.routes.includes(r)); return f ? f.ch : "Autres"; };

/* the restaurant profile → the families we recommend */
const PC_Q = {
  services: [["midi", "Le midi", "pcSun"], ["soir", "Le soir", "pcMoon"], ["brunch", "Brunch", "pcCup"], ["continu", "Non-stop", "clock"]],
  offre: [["place", "Sur place", "slPad"], ["terrasse", "Terrasse", "pcLeaf"], ["bar", "Un bar", "pmGlass"], ["emporter", "À emporter", "pcBag"], ["livraison", "Livraison", "lvBike"], ["traiteur", "Traiteur & événements", "pcStar"]],
  taille: [["s", "Moins de 30", 1], ["m", "30 à 60", 2], ["l", "60 à 120", 3], ["xl", "Plus de 120", 4]],
  equipe: [["solo", "Seul·e", 1], ["petite", "2 à 5", 2], ["moyenne", "6 à 15", 3], ["grande", "Plus de 15", 4]],
};
Object.assign(IC, {
  pcSun: ["c:12,12,4", "M12 2.5v2", "M12 19.5v2", "M4.6 4.6 6 6", "M18 18l1.4 1.4", "M2.5 12h2", "M19.5 12h2", "M4.6 19.4 6 18", "M18 6l1.4-1.4"],
  pcMoon: ["M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.6 6.6 0 0 0 11 11z"],
  pcCup: ["M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z", "M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16", "M8 3v2", "M11 3v2"],
  pcLeaf: ["M5 19c0-9 6-14 15-14 0 9-5 15-14 15", "M5 19 13 11"],
  pcBag: ["M5 8h14l-1 12.5H6z", "M9 8a3 3 0 0 1 6 0"],
  pcStar: ["m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
});
const pcProfil = () => (pcDemo() ? PC.demoProfil : S.resto && S.resto.profil) || {};
function pcReco(p = pcProfil()) {
  const has = (k, v) => Array.isArray(p[k]) && p[k].includes(v), lv = (k) => ((PC_Q[k].find((x) => x[0] === p[k]) || [])[2] || 0);
  const s = new Set(["temp", "etiq", "recep", "menage", "hyg", "recettes", "haccp", "oblig", "formhaccp", "consignes", "alertes", "caisse", "gaspi", "marges"]);
  const place = has("offre", "place") || has("offre", "terrasse") || !(p.offre || []).length;
  if (place) ["resa", "commande", "clients"].forEach((k) => s.add(k));
  if (has("offre", "terrasse") || lv("taille") >= 2) s.add("plan");
  if (has("offre", "bar") || has("offre", "traiteur") || lv("taille") >= 2) s.add("stock");
  if (has("offre", "emporter")) s.add("enligne");
  if (has("offre", "livraison")) s.add("livraison");
  if (lv("equipe") >= 3) { s.add("pointeuse"); s.add("planning"); s.add("salaires"); }
  if (lv("taille") >= 2 || lv("equipe") >= 3) s.add("dash");
  if (lv("taille") >= 3 || p.multi) s.add("finance");
  if (p.multi) s.add("sites");
  return s;
}
/* the draft of the picker: family key → on */
function pcDraft(fromReco) {
  const fams = pcFams(), off = pcOffSet(), reco = pcReco(), d = {};
  fams.forEach((f) => { d[f.k] = fromReco ? reco.has(f.k) || f.ch === "Autres" : pcFamOn(f, off); });
  return d;
}
function pcDraftPack(d) { const on = pcFams().filter((f) => d[f.k]); return pcPackOf(on.flatMap((f) => f.routes)) || "essentiel"; }
function pcOffFrom(d) { return pcFams().filter((f) => !d[f.k]).flatMap((f) => f.routes); }
async function pcSaveFeatures(d, profil) {
  const modsOff = pcOffFrom(d);
  if (pcDemo()) { PC.demoOff = modsOff; if (profil) PC.demoProfil = profil; }
  else if (S.rid && S.resto) {
    const patch = { modsOff }; if (profil) patch.profil = profil;
    Object.assign(S.resto, patch); try { await safe(DB.update("restos", S.rid, patch)); } catch (e) { console.warn("pc features", e); }
    logEvent("team", `a choisi les fonctionnalités du restaurant (${pcFams().length - pcFams().filter((f) => !d[f.k]).length} activées)`);
  }
  const tb = $("#tabbar"); if (tb) delete tb.dataset.built; try { renderChrome(); } catch (e) {}
}

/* ── the picker (onboarding step « Vos fonctions » and route « fonctions ») ── */
function pcMeter(d) {
  const pk = pcDraftPack(d), lv = (typeof AB_LVL !== "undefined" && AB_LVL[pk]) || 1, P = typeof AB_PACKS !== "undefined" ? AB_PACKS[pk] : { t: "", price: "" };
  const n = pcFams().filter((f) => d[f.k]).length;
  return `<div class="pc-meter" data-lv="${lv}" id="pcMeter">
    <div class="pc-mt"><b><span class="pc-mn mono">${n}</span> ${n > 1 ? "fonctionnalités" : "fonctionnalité"}</b><span>Pack <b>${esc(P.t)}</b> · ${esc(String(P.price))} € HT/mois après l'essai</span></div>
    <div class="pc-mbar" aria-hidden="true">${["essentiel", "pro", "complet"].map((k, i) => `<i class="${i < lv ? "on" : ""}"><em>${esc(typeof AB_PACKS !== "undefined" ? AB_PACKS[k].t : k)}</em></i>`).join("")}</div>
  </div>`;
}
function pcPickerHTML(d, opts = {}) {
  const fams = pcFams(), reco = pcReco(), i0 = opts.i0 || 2;
  const chaps = PC_CHAPS.filter((c) => fams.some((f) => f.ch === c));
  return `<div class="pc-pick">
    ${pcMeter(d)}
    <div class="pc-quick st" style="--i:${i0}"><button type="button" class="onb-chip pc-chip" data-act="pcPickAll" data-v="reco">${pcIco("pcSpark")}<span>Ce qu'on vous conseille</span></button><button type="button" class="onb-chip pc-chip" data-act="pcPickAll" data-v="all">Tout activer</button><button type="button" class="onb-chip pc-chip" data-act="pcPickAll" data-v="hyg">Juste l'hygiène</button></div>
    ${chaps.map((c, ci) => `<section class="pc-ch st" style="--i:${i0 + 1 + ci}"><h3 class="pc-cht">${esc(c)}</h3><div class="pc-grid">${fams.filter((f) => f.ch === c).map((f, j) => {
      const pk = pcPackOf(f.routes), on = !!d[f.k];
      return `<button type="button" class="pc-fam${on ? " on" : ""}" data-act="pcFam" data-v="${esc(f.k)}" aria-pressed="${on}" style="--j:${j}"><span class="pc-fic">${pcIco(f.ic)}</span><span class="pc-ftx"><b>${esc(f.t)}</b><em>${esc(f.d)}</em></span><span class="pc-fside">${pk && pk !== "essentiel" && typeof AB_PACKS !== "undefined" ? `<small>${esc(AB_PACKS[pk].t)}</small>` : ""}<span class="pc-sw" aria-hidden="true"><i></i></span></span></button>`;
    }).join("")}</div></section>`).join("")}
    <p class="onb-fine st" style="--i:${i0 + 8}">Pendant les 14 jours d'essai, tout reste ouvert. Ce choix range l'app et la formation de l'équipe : il se change à tout moment dans Réglages.</p>
  </div>`;
}
function pcPickPaint(root, d, f) {
  const b = root && root.querySelector(`[data-act=pcFam][data-v="${CSS.escape(f)}"]`);
  if (b) { const on = !!d[f]; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); if (on && !pcReduce()) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } }
  const m = root && root.querySelector("#pcMeter"); if (m) { const t = document.createElement("div"); t.innerHTML = pcMeter(d); const nu = t.firstElementChild; const lv0 = m.dataset.lv; m.innerHTML = nu.innerHTML; m.dataset.lv = nu.dataset.lv; if (lv0 !== nu.dataset.lv && !pcReduce()) { m.classList.remove("bump"); void m.offsetWidth; m.classList.add("bump"); } }
}

/* ── onboarding hooks (called from js/onboard.js) ── */
Object.assign(PC, {
  obInit(st) { const d = st.d; if (!d.pcProfil) d.pcProfil = JSON.parse(JSON.stringify(pcProfil() || {})); if (!d.pcFams) d.pcFams = S.resto && Array.isArray(S.resto.modsOff) ? pcDraft(false) : null; },
  obHas(k, st) { const d = st.d; if (k === "maison") return Object.keys(d.pcProfil || {}).some((x) => { const v = d.pcProfil[x]; return Array.isArray(v) ? v.length : !!v; }); if (k === "fonctions") return !!d.pcFamsSet || !!(S.resto && Array.isArray(S.resto.modsOff)); return true; },
  obPane(k, st, ob) {
    this.obInit(st); const d = st.d, p = d.pcProfil;
    if (k === "maison") {
      const multi = (key, i) => `<div class="pc-q st" style="--i:${i}"><span class="onb-lbl">${{ services: "Vos services", offre: "Ce que vous proposez" }[key]}</span><div class="pc-tiles">${PC_Q[key].map(([v, t, ic], j) => { const on = Array.isArray(p[key]) && p[key].includes(v); return `<button type="button" class="pc-tile${on ? " on" : ""}" data-act="pcQ" data-k="${key}" data-v="${v}" aria-pressed="${on}" style="--j:${j}"><span class="pc-tic">${pcIco(ic)}</span><b>${t}</b></button>`; }).join("")}</div></div>`;
      const one = (key, lbl, unit, i) => `<div class="pc-q st" style="--i:${i}"><span class="onb-lbl">${lbl}</span><div class="pc-seg" role="radiogroup">${PC_Q[key].map(([v, t, n]) => { const on = p[key] === v; return `<button type="button" class="pc-sg${on ? " on" : ""}" role="radio" aria-checked="${on}" data-act="pcQ1" data-k="${key}" data-v="${v}"><span class="pc-dots" aria-hidden="true">${Array.from({ length: 4 }, (_, x) => `<i class="${x < n ? "on" : ""}"></i>`).join("")}</span><b>${t}</b>${unit ? `<em>${unit}</em>` : ""}</button>`; }).join("")}</div></div>`;
      return `${ob.head("Parlez-nous de votre maison.", "Quatre touches, et l'app se range comme votre restaurant.")}
        ${multi("services", 2)}${multi("offre", 3)}${one("taille", "Couverts par service", "couverts", 4)}${one("equipe", "Votre équipe", "personnes", 5)}
        <button type="button" class="pc-multi st${p.multi ? " on" : ""}" style="--i:6" data-act="pcMulti" aria-pressed="${!!p.multi}"><span class="pc-tic">${pcIco("store")}</span><span><b>J'ai plusieurs restaurants</b><em>Comparer, transférer du stock</em></span><span class="pc-sw" aria-hidden="true"><i></i></span></button>`;
    }
    if (k === "fonctions") {
      if (!d.pcFams) d.pcFams = pcDraft(true);
      const n = pcFams().length;
      return `${ob.head("Choisissez vos fonctionnalités.", `On a coché ce qui ressemble à votre maison. ${n} fonctionnalités au choix, rangées par usage.`)}${pcPickerHTML(d.pcFams)}`;
    }
    return "";
  },
  async obSave(k, st) {
    const d = st.d; if (k === "maison") { if (S.resto && !pcDemo()) { S.resto.profil = d.pcProfil; try { await safe(DB.update("restos", S.rid, { profil: d.pcProfil })); } catch (e) {} } else PC.demoProfil = d.pcProfil; if (!d.pcFamsSet) d.pcFams = null; }
    if (k === "fonctions" && d.pcFams) { d.pcFamsSet = true; await pcSaveFeatures(d.pcFams, d.pcProfil); }
  },
  /* steps whose feature is switched off are jumped over */
  obStepOn(k) { if (k === "frigos") return !pcRouteOff("releve") || !pcRouteOff("frigos"); if (k === "etiquettes" || k === "imprimante") return !pcRouteOff("scan"); return true; },
  obFiche(st) { const d = st.d; const f = d.pcFams || (S.resto && Array.isArray(S.resto.modsOff) ? pcDraft(false) : null); if (!f) return ""; const n = Object.values(f).filter(Boolean).length; return `${n} activées · pack ${esc(typeof AB_PACKS !== "undefined" ? AB_PACKS[pcDraftPack(f)].t : "")}`; },
  obPretHTML() {
    const plan = pcPlan(S.me.id); if (!plan.length) return "";
    const mins = Math.max(2, pcMins(plan.length));
    return `<button type="button" class="pc-hero st" style="--i:4" data-act="pcObStart"><span class="pc-hero-ic">${pcIco("pcCap")}</span><span class="pc-hero-tx"><em>Prise en main</em><b>Apprenez l'app en ${mins} minutes</b><span>${pcPl(plan.length, "leçon")} sur vos fonctionnalités, avec une petite question à chaque fois.</span></span><span class="pc-hero-go">${pcIco("pcPlay")}</span></button>`;
  },
});

/* ═══════════════════════ 2. le parcours d'une personne ═══════════════════════ */
const pcMember = (mid) => (S.members || []).find((m) => m.id === mid) || (mid === S.me.id ? { id: S.me.id, name: S.me.name, role: pcRole() } : null);
function pcCan(m, r) {
  if (!m || m.role === "gerant") return !pcRouteOff(r);
  if (pcRouteOff(r)) return false;
  try {
    const p = PERMS.of(m.id); if (p.level === "admin") return true;
    if (["marges", "factures"].includes(r)) return !!p.caps.seeMoney;
    const k = PERMS.moduleOf(r); if (!k) return true;
    return !!p.modules[k] && (!["dashboard", "finance", "staff"].includes(k) || !!p.caps.seeMoney);
  } catch (e) { return true; }
}
const pcPosteOf = (m) => (m && (typeof ES_POSTE_OF !== "undefined" ? ES_POSTE_OF[m.poste] : m.poste)) || (m && m.role === "chef" ? "cuisine" : "");
function pcWho(r) {
  const L = PC_LECONS[r]; if (L && typeof L.who === "string") L.who = [L.who]; if (L && Array.isArray(L.who)) return L.who;
  const out = []; try { Object.entries(ES_POSTES).forEach(([k, v]) => { if (v.tools.includes(r)) out.push(k); }); } catch (e) {}
  return out.length ? out : ["boss"];
}
function pcSpaces(m) { try { return typeof esAllowedFor === "function" ? esAllowedFor(m, m && m.role) : ["pilotage"]; } catch (e) { return ["pilotage"]; } }
/* the ordered plan of a person: [{ k, ch }] (k = a route of the menu or a « @meta » lesson) */
function pcPlanFull(mid) {
  const m = pcMember(mid) || { id: mid, role: "equipe" }, boss = m.role === "gerant", poste = pcPosteOf(m), sp = pcSpaces(m);
  const out = [{ k: "@bases", ch: "Les bases" }];
  if (boss) { out.push({ k: "@fonctions", ch: "Les bases" }); if (VIEWS.equipe) out.push({ k: "@equipe", ch: "Les bases" }); }
  const routes = pcNavRoutes().filter((r) => r !== "priseEnMain" && r !== "home" && PC_LECONS[r] && pcCan(m, r)).filter((r) => (typeof ES_MOI === "undefined" || !ES_MOI.includes(r) || sp.includes("moi")));
  if (boss) {
    /* the gérant learns one screen per feature (the first of its family, in the family's order), chapter by chapter;
       the other screens wait in « Pour aller plus loin » */
    const fams = pcFams(), have = new Set(routes), used = new Set();
    PC_CHAPS.forEach((ch) => fams.filter((f) => f.ch === ch).forEach((f) => { const rs = f.routes.filter((r) => have.has(r)); if (!rs.length) return; out.push({ k: rs[0], ch }); rs.forEach((r) => used.add(r)); rs.slice(1).forEach((r) => out.push({ k: r, ch: "Pour aller plus loin", extra: true })); }));
    ["espaces", "import"].forEach((r) => { if (have.has(r) && !used.has(r)) { out.push({ k: r, ch: "Restaurant" }); used.add(r); } });
    routes.forEach((r) => { if (!used.has(r)) out.push({ k: r, ch: "Pour aller plus loin", extra: true }); });
  }
  else {
    const mine = routes.filter((r) => { const w = pcWho(r); return w.includes(poste) || (m.role === "chef" && PC_CHEF.includes(r)) || (!poste && !w.includes("boss")); });
    const order = poste && typeof ES_POSTES !== "undefined" && ES_POSTES[poste] ? ES_POSTES[poste].tools : [];
    const isMoi = (r) => typeof ES_MOI !== "undefined" && ES_MOI.includes(r);
    mine.filter((r) => !isMoi(r)).sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).forEach((r) => out.push({ k: r, ch: "Votre poste" }));
    /* Mon espace: the planning and the requests; the hours and the activity speak for themselves */
    mine.filter(isMoi).forEach((r) => out.push({ k: r, ch: "Mon espace", extra: !["moiPlanning", "moiDemandes"].includes(r) }));
  }
  const vues = sp.filter((s) => PC_META["@" + s] && !(s === "moi" && out.some((x) => x.ch === "Mon espace"))); if (sp.length > 1 || !boss) vues.forEach((s) => out.push({ k: "@" + s, ch: "Vos vues" }));
  if (!boss && poste) out.push({ k: "@partage", ch: "Votre appareil" });
  let pin = false; try { pin = !boss && PERMS.of(m.id).require.pin; } catch (e) {} if (pin) out.push({ k: "@code", ch: "Votre appareil" });
  if (boss || m.role === "chef") out.push({ k: "@kiosque", ch: "Les appareils du restaurant" });
  const seen = new Set(); const u = out.filter((x) => (seen.has(x.k) ? false : seen.add(x.k)));
  return u.filter((x) => !x.extra).concat(u.filter((x) => x.extra));
}
const pcPlan = (mid) => pcPlanFull(mid).filter((x) => !x.extra).map((x) => x.k);
const pcMins = (n) => Math.max(1, Math.round(n * 0.4));
const pcL = (k) => (k[0] === "@" ? PC_META[k] : PC_LECONS[k]) || null;
function pcLTitle(k) { const L = pcL(k); if (L) return L.t; const n = pcNavOf(k); return n ? n[2] : k; }
function pcLIc(k) { const n = pcNavOf(k); return (n && n[1]) || { "@bases": "grid", "@service": "esServ", "@moi": "esMoi", "@pilotage": "esPilot", "@partage": "users", "@kiosque": "lock", "@code": "lock", "@fonctions": "pcToggles", "@equipe": "users" }[k] || "pcSpark"; }

/* ── progress ── */
function pcWatch() {
  if (!S.rid || PC.rid === S.rid) return; PC.rid = S.rid; PC.rows = null; const rid = S.rid;
  DB.watch("prise", {}, (rows) => { if (S.rid !== rid) return; PC.rows = rows; pcSeed(); if (["priseEnMain", "home"].includes(S.route) && !PC.run) { try { rerender(); } catch (e) {} } });
}
const pcRow = (mid) => ((PC.rid === S.rid && PC.rows) || []).find((r) => r.id === mid || r.memberId === mid) || null;
function pcProg(mid) {
  const plan = pcPlan(mid), r = pcRow(mid) || {}, done = r.done || {};
  const n = plan.filter((k) => done[k]).length, next = plan.find((k) => !done[k]) || null;
  return { plan, n, total: plan.length, pct: plan.length ? Math.round((n * 100) / plan.length) : 0, next, finished: plan.length > 0 && n >= plan.length, row: r, last: r.updatedAt || 0, started: !!r.startedAt };
}
window.pcProg = pcProg;
async function pcMark(mid, k, ok, miss) {
  const r = pcRow(mid); const name = (pcMember(mid) || {}).name || S.me.name || "";
  const done = { ...((r && r.done) || {}) }, misses = { ...((r && r.miss) || {}) };
  if (ok) done[k] = Date.now(); if (miss) misses[k] = (misses[k] || 0) + miss;
  const doc = { memberId: mid, name, done, miss: misses, updatedAt: Date.now(), startedAt: (r && r.startedAt) || Date.now() };
  const plan = pcPlan(mid); if (plan.every((x) => done[x]) && !(r && r.finishedAt)) doc.finishedAt = Date.now(); else if (r && r.finishedAt) doc.finishedAt = r.finishedAt;
  const local = { id: mid, ...doc }; PC.rows = (PC.rows || []).filter((x) => x.id !== mid).concat([local]);
  try { await safe(DB.set("prise", mid, doc)); } catch (e) { console.warn("pc mark", e); }
  if (doc.finishedAt && !(r && r.finishedAt)) logEvent("team", "a terminé sa prise en main de l'app");
}
/* demo: Camille has done the bases, Thomas finished, Sarah halfway, Lucas started, Hugo not yet */
function pcSeed() {
  if (!pcDemo() || !S.rid || PC.seeded[S.rid] || !PC.rows) return; PC.seeded[S.rid] = true; if (PC.rows.length) return;
  const share = { "demo-thomas": 1, "demo-ines": 0.8, "demo-sarah": 0.55, "demo-lucas": 0.25, "demo-camille": 0.15 }; const t0 = Date.now();
  Object.entries(share).forEach(([mid, f], i) => {
    if (!pcMember(mid)) return; const plan = pcPlan(mid); const n = Math.round(plan.length * f); const done = {};
    plan.slice(0, n).forEach((k, j) => { done[k] = t0 - (6 - i) * 864e5 + j * 41e3; });
    const doc = { memberId: mid, name: pcMember(mid).name, done, miss: j0(plan, i), startedAt: t0 - (6 - i) * 864e5, updatedAt: t0 - (5 - i) * 36e5, ...(n >= plan.length ? { finishedAt: t0 - 2 * 864e5 } : {}) };
    DB.set("prise", mid, doc);
  });
  function j0(plan, i) { const m = {}; if (plan[2 + i]) m[plan[2 + i]] = 1; return m; }
}

/* ═══════════════════════ 3. les scènes animées ═══════════════════════ */
const pcTone = (t) => (["ok", "warn", "bad", "acc"].includes(t) ? t : "");
function pcScene(sc) {
  sc = sc || { k: "list", rows: [] }; const k = PC_SCENES.includes(sc.k) ? sc.k : "list";
  const head = `<div class="pcs-hd"><i></i><b>${esc(sc.t || "")}</b><i></i></div>`;
  let body = "";
  if (k === "list") body = `<div class="pcs-list">${(sc.rows || []).slice(0, 4).map(([ic, l, v, t], i) => `<div class="pcs-row" data-s="${i}" style="--j:${i}"><span class="pcs-ic">${pcIco(ic, "list")}</span><b>${esc(l)}</b>${v ? `<span class="pcs-pill ${pcTone(t)}">${esc(v)}</span>` : ""}<span class="pcs-ck">${ico("check")}</span></div>`).join("")}</div>`;
  else if (k === "keypad") body = `<div class="pcs-kp"><div class="pcs-disp" data-s="0"><span class="pcs-val mono" data-type="${esc(sc.v || "")}"></span><em>${esc(sc.unit || "")}</em></div><div class="pcs-keys" data-s="1">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "−", "0", ","].map((x) => `<i>${x}</i>`).join("")}</div><div class="pcs-okb" data-s="2">${ico("check")}<span>${esc(sc.ok || "Valider")}</span></div></div>`;
  else if (k === "scan") body = `<div class="pcs-scan"><div class="pcs-vf" data-s="0"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><span class="pcs-laser"></span><span class="pcs-qr">${Array.from({ length: 16 }, (_, i) => `<i class="${(i * 7) % 3 ? "on" : ""}"></i>`).join("")}</span></div>
      <div class="pcs-lab" data-s="1"><b>${esc((sc.label || [])[0] || "")}</b><span>${esc((sc.label || [])[1] || "")}</span><em>${esc((sc.label || [])[2] || "")}</em></div>
      <div class="pcs-acts" data-s="2"><i>Ouvert</i><i>Entamé</i><i>Jeté</i></div></div>`;
  else if (k === "chart") { const b = sc.bars || [40, 60, 50, 80]; const mx = Math.max(...b, 1); body = `<div class="pcs-ch"><div class="pcs-kpi" data-s="0"><b class="mono">${esc(sc.kpi || "")}</b><span>${esc(sc.sub || "")}</span></div><div class="pcs-bars" data-s="1">${b.map((v, i) => `<i style="--h:${Math.max(4, Math.round((v * 100) / mx))}%;--j:${i}"></i>`).join("")}</div><div class="pcs-chips" data-s="2"><i>7 j</i><i class="on">30 j</i><i>Mois</i></div></div>`; }
  else if (k === "board") body = `<div class="pcs-bd">${(sc.cols || []).slice(0, 3).map(([t, cards], i) => `<div class="pcs-col" data-s="${i}"><b>${esc(t)}</b>${(cards || []).map((c, j) => `<span class="pcs-card" style="--j:${i * 2 + j}">${esc(c)}</span>`).join("")}</div>`).join("")}</div>`;
  else if (k === "plan") body = `<div class="pcs-plan">${(sc.tables || []).slice(0, 6).map(([st, l], i) => `<span class="pcs-tb ${esc(st)} ${i % 3 === 1 ? "sq" : ""}" ${i < 3 ? `data-s="${i}"` : ""} style="--j:${i}"><b>${esc(l)}</b></span>`).join("")}<div class="pcs-leg"><i class="free">Libre</i><i class="booked">Réservée</i><i class="seated">Installée</i></div></div>`;
  else if (k === "cal") body = `<div class="pcs-cal"><div class="pcs-days" data-s="0">${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<i>${x}</i>`).join("")}</div><div class="pcs-grid">${(sc.shifts || []).map(([d, s, l, c, n], i) => `<span class="pcs-sh c${c % 3}" ${i === 0 ? 'data-s="1"' : ""} style="--d:${d};--s:${s};--l:${l};--j:${i}">${esc(n)}</span>`).join("")}</div><div class="pcs-pub" data-s="2">${ico("check")}Publier</div></div>`;
  else if (k === "chat") body = `<div class="pcs-chat">${(sc.msgs || []).slice(0, 3).map(([me, t], i) => `<span class="pcs-msg ${me ? "me" : ""}" data-s="${i}" style="--j:${i}">${esc(t)}</span>`).join("")}<div class="pcs-inp"><i></i>${ico("send")}</div></div>`;
  else if (k === "toggles") body = `<div class="pcs-list">${(sc.rows || []).slice(0, 4).map(([ic, l, on], i) => `<div class="pcs-row tg${on ? " was" : ""}" data-s="${i}" style="--j:${i}"><span class="pcs-ic">${pcIco(ic, "sliders")}</span><b>${esc(l)}</b><span class="pcs-sw"><i></i></span></div>`).join("")}</div>`;
  else if (k === "check") body = `<div class="pcs-list">${(sc.rows || []).slice(0, 4).map(([l, d], i) => `<div class="pcs-row ck${d ? " was" : ""}" data-s="${i}" style="--j:${i}"><span class="pcs-box">${ico("check")}</span><b>${esc(l)}</b></div>`).join("")}</div>`;
  else if (k === "doc") body = `<div class="pcs-doc"><div class="pcs-page"><b data-s="0">${esc(sc.title || "")}</b><div class="pcs-lines" data-s="1">${Array.from({ length: sc.lines || 5 }, (_, i) => `<i style="--j:${i};--w:${60 + ((i * 37) % 38)}%"></i>`).join("")}</div><span class="pcs-stamp" data-s="2">${esc(sc.stamp || "PDF")}</span></div></div>`;
  else if (k === "clock") body = `<div class="pcs-clk"><div class="pcs-who" data-s="0"><span class="pcs-ava">${esc(initials(sc.name || "?"))}</span><b>${esc(sc.name || "")}</b></div><b class="pcs-time mono" data-s="1">${esc(sc.time || "")}</b><div class="pcs-okb" data-s="2">${ico("check")}<span>${esc(sc.act || "")}</span></div></div>`;
  else if (k === "ticket") body = `<div class="pcs-tk"><div class="pcs-rc">${(sc.lines || []).map(([l, v], i) => `<span class="pcs-tl" ${i === 0 ? 'data-s="0"' : ""} style="--j:${i}"><b>${esc(l)}</b><em class="mono">${esc(v)}</em></span>`).join("")}<span class="pcs-tl sep" data-s="1"></span><span class="pcs-tl tot" data-s="2"><b>Total</b><em class="mono">${esc(sc.total || "")}</em></span></div></div>`;
  const tabs = `<div class="pcs-tabs" aria-hidden="true"><i>${ico("home")}</i><i>${ico("snow")}</i><i class="fab">${ico("scan")}</i><i>${ico("box")}</i><i>${ico("grid")}</i></div>`;
  return `<div class="pcs pcs--${k}" data-k="${k}">${head}<div class="pcs-bd0">${body}</div>${tabs}<span class="pcs-fing" aria-hidden="true"><i></i></span></div>`;
}

/* ═══════════════════════ 4. le lecteur ═══════════════════════ */
/* PC.play({ mid, keys?, title?, from? }) : the plan of mid from its first lesson not done (or keys) */
function pcPlay(o = {}) {
  if (PC_VIEW) return;
  const mid = o.mid || S.me.id; const full = pcPlanFull(mid).filter((x) => !x.extra || (o.keys && o.keys.includes(x.k))); const r = pcRow(mid) || {}; const done = r.done || {};
  let list = o.keys ? full.filter((x) => o.keys.includes(x.k)).concat(o.keys.filter((k) => !full.some((x) => x.k === k)).map((k) => ({ k, ch: pcChapOf(k) }))) : full;
  list = list.filter((x) => pcL(x.k)); if (!list.length) { toast("Rien à apprendre ici pour l'instant"); return; }
  let i = o.keys ? 0 : Math.max(0, list.findIndex((x) => !done[x.k])); if (i < 0 || (!o.keys && list.every((x) => done[x.k]))) i = 0;
  PC.run = { mid, list, i, slide: o.keys || i === 0 || list[i - 1].ch !== list[i].ch ? "chap" : "intro", step: 0, ans: null, tries: 0, from: o.from || "", done: { ...done }, firstOpen: !r.startedAt, stepT: 0, typeT: 0 };
  if (PC.run.slide === "chap" && i === 0 && !o.keys && !r.startedAt) PC.run.slide = "hello";
  try { if (typeof closeSheet === "function" && $("#sheet.open")) closeSheet(true); } catch (e) {}
  let root = $("#pcp"); if (!root) { root = document.createElement("div"); root.id = "pcp"; document.body.appendChild(root); }
  root.className = "pcp"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Prise en main");
  root.innerHTML = `<div class="pcp-aur" aria-hidden="true"><i></i><i></i><i></i></div><div class="pcp-in"><header class="pcp-top"><div class="pcp-bars" id="pcpBars"></div><button class="pcp-x" data-act="pcClose" aria-label="Fermer">${ico("x")}</button></header><div class="pcp-body"><div class="pcp-stage" id="pcpStage" aria-hidden="true"><div class="pcp-dev" id="pcpDev"><div class="pcp-scr" id="pcpScr"><div class="pcp-fake" id="pcpFake"></div></div></div></div><main class="pcp-main" id="pcpMain"></main></div><footer class="pcp-foot" id="pcpFoot"></footer></div>`;
  document.documentElement.classList.add("pcp-open");
  requestAnimationFrame(() => root.classList.add("on")); SFX.sheet && SFX.sheet(); buzz(8);
  pcPaint(true); pcSwipe(root); pcMirror(root);
}
PC.play = pcPlay;
const pcCur = () => PC.run && PC.run.list[PC.run.i];
function pcBars() {
  const R = PC.run; const ch = pcCur().ch; const long = R.list.length > 14 && !["hello"].includes(R.slide);
  const items = R.list.map((x, j) => [x, j]).filter(([x]) => !long || x.ch === ch);
  return items.map(([x, j]) => `<i class="${R.done[x.k] ? "done" : ""}${j === R.i ? " cur" : ""}" title="${esc(pcLTitle(x.k))}"><b style="--p:${j === R.i ? ({ chap: 0, hello: 0, intro: 0.34, steps: 0.67, quiz: 0.9, won: 1 }[R.slide] || 0) : R.done[x.k] ? 1 : 0}"></b></i>`).join("") + (long ? `<span class="pcp-cnt mono">${R.i + 1}/${R.list.length}</span>` : "");
}
function pcPaint(first) {
  const R = PC.run, root = $("#pcp"); if (!R || !root) return; clearTimeout(R.stepT); clearInterval(R.typeT);
  const main = $("#pcpMain", root), foot = $("#pcpFoot", root), cur = pcCur(), L = pcL(cur.k), m = pcMember(R.mid) || {};
  $("#pcpBars", root).innerHTML = pcBars();
  const nInCh = R.list.filter((x) => x.ch === cur.ch).length, chI = [...new Set(R.list.map((x) => x.ch))].indexOf(cur.ch) + 1;
  let html = "", cta = "";
  if (R.slide === "hello") {
    const plan = R.list.length, mins = Math.max(2, pcMins(plan));
    html = `<section class="pcp-hello"><div class="pcp-logo">${typeof appIcon === "function" ? appIcon(72) : ""}</div><span class="pcp-kick">Prise en main</span><h2 class="pcp-h">${m.role === "gerant" ? "Votre restaurant est prêt." : `Bienvenue${S.resto ? " chez " + esc(S.resto.name) : ""}${m.name ? ", " + esc(firstName(m.name)) : ""}.`}</h2>
      <p class="pcp-p">${m.role === "gerant" ? "Faisons le tour de ce que vous avez activé, une leçon à la fois." : "Votre formation est prête : juste ce qu'il faut pour votre poste, rien de plus."}</p>
      <div class="pcp-facts"><span><b class="mono">${plan}</b>leçons</span><span><b class="mono">${mins}</b>minutes</span><span><b class="mono">${[...new Set(R.list.map((x) => x.ch))].length}</b>chapitres</span></div>
      <ol class="pcp-chs">${[...new Set(R.list.map((x) => x.ch))].map((c, j) => `<li style="--j:${j}"><i>${j + 1}</i>${esc(c)}<em>${R.list.filter((x) => x.ch === c).length}</em></li>`).join("")}</ol></section>`;
    cta = `<button class="pcp-go" data-act="pcNext">${ico("pcPlay")}C'est parti</button><button class="pcp-later" data-act="pcClose">Plus tard</button>`;
  } else if (R.slide === "chap") {
    html = `<section class="pcp-chap"><span class="pcp-chn mono">${String(chI).padStart(2, "0")}</span><span class="pcp-kick">Chapitre ${chI}</span><h2 class="pcp-h">${esc(cur.ch)}</h2><p class="pcp-p">${pcPl(nInCh, "leçon")} · environ ${pcMins(nInCh)} min</p>
      <div class="pcp-chips">${R.list.filter((x) => x.ch === cur.ch).map((x, j) => `<span style="--j:${j}" class="${R.done[x.k] ? "done" : ""}">${pcIco(pcLIc(x.k))}${esc(pcLTitle(x.k))}</span>`).join("")}</div></section>`;
    cta = `<button class="pcp-go" data-act="pcNext">Commencer${ico("arrow")}</button>${R.list.some((x, j) => j > R.i && x.ch !== cur.ch) ? `<button class="pcp-later" data-act="pcSkipCh">Passer ce chapitre</button>` : ""}`;
  } else {
    const slide = R.slide; const pos = `${R.list.filter((x) => x.ch === cur.ch).findIndex((x) => x.k === cur.k) + 1}/${nInCh}`;
    const stage = "";
    let card = "";
    if (slide === "intro") card = `<span class="pcp-kick">${esc(cur.ch)} · ${pos}</span><h2 class="pcp-h sm"><span class="pcp-hic">${pcIco(pcLIc(cur.k))}</span>${esc(L.t)}</h2><p class="pcp-p">${esc(L.d)}</p>`;
    else if (slide === "steps") card = `<span class="pcp-kick">Comment faire</span><h2 class="pcp-h sm">${esc(L.t)}</h2><ol class="pcp-steps">${L.steps.map((s, j) => `<li class="${j === R.step ? "on" : j < R.step ? "past" : ""}" data-act="pcStep" data-v="${j}" style="--j:${j}"><i class="mono">${j + 1}</i><span>${esc(s)}</span></li>`).join("")}</ol><div class="pcp-dots">${L.steps.map((_, j) => `<i class="${j === R.step ? "on" : ""}" data-act="pcStep" data-v="${j}"></i>`).join("")}</div>${L.tip ? `<p class="pcp-tip">${pcIco("pcSpark")}${esc(L.tip)}</p>` : ""}`;
    else if (slide === "quiz") { const [q, ans] = L.q; const ord = R.ord || (R.ord = pcShuffle(ans.map((_, j) => j))); card = `<span class="pcp-kick">À vous</span><h2 class="pcp-h sm">${esc(q)}</h2><div class="pcp-ans" role="group">${ord.map((j, n) => `<button type="button" class="pcp-a${R.ans === j ? (j === L.q[2] ? " ok" : " ko") : ""}${R.ans != null && R.ans !== L.q[2] && j === L.q[2] && R.tries > 1 ? " hint" : ""}" data-act="pcAns" data-v="${j}" style="--j:${n}"><i>${"ABC"[n]}</i><span>${esc(ans[j])}</span></button>`).join("")}</div>`; }
    else if (slide === "won") { const n = R.list.filter((x) => R.done[x.k]).length; card = `<span class="pcp-kick ok">Leçon validée</span><h2 class="pcp-h sm">${esc(L.t)}</h2><p class="pcp-p">${n} sur ${R.list.length} · ${R.list.length - n ? `encore ${pcPl(R.list.length - n, "leçon")}` : "tout est fait"}</p>`; }
    html = `<section class="pcp-les" data-slide="${slide}">${stage}<div class="pcp-card" id="pcpCard">${card}</div></section>`;
    cta = slide === "intro" ? `<button class="pcp-go" data-act="pcNext">Voir comment${ico("arrow")}</button>`
      : slide === "steps" ? `<button class="pcp-go" data-act="pcNext">J'ai compris${ico("arrow")}</button>${R.from !== "lecon" && VIEWS[cur.k] && cur.k[0] !== "@" && R.mid === S.me.id && !(typeof esKioskOn === "function" && esKioskOn()) ? `<button class="pcp-later" data-act="pcTry">${ico("pcPlay")}Essayer pour de vrai</button>` : ""}`
      : slide === "quiz" ? `<span class="pcp-qhint">${R.ans != null && R.ans !== L.q[2] ? (R.tries > 1 ? "La bonne réponse est en surbrillance." : "Pas tout à fait. Encore un essai ?") : "Touchez la bonne réponse."}</span>`
      : `<button class="pcp-go" data-act="pcNext">${R.i >= R.list.length - 1 ? "Terminer" : "Leçon suivante"}${ico("arrow")}</button>`;
  }
  /* the card slides, the old one leaves */
  const reduce = pcReduce();
  $$(".pcp-leave", main).forEach((x) => x.remove());
  if (!first && !reduce && main.lastElementChild) { while (main.children.length > 1) main.firstElementChild.remove(); const old = main.lastElementChild; old.classList.add("pcp-leave"); old.removeAttribute("id"); setTimeout(() => old.remove(), 340); const t = document.createElement("div"); t.innerHTML = html; const nu = t.firstElementChild; nu.classList.add("pcp-enter"); main.appendChild(nu); }
  else main.innerHTML = html;
  foot.innerHTML = cta;
  pcStage(root, R, cur, L);
  if (R.slide === "intro" || R.slide === "steps" || R.slide === "won" || R.slide === "quiz") pcSceneRun();
  if (R.slide === "won") { setTimeout(() => { const s = $(".pcp-seal", root); if (s) { const b = s.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2); } }, reduce ? 0 : 260); }
}
function pcShuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
/* the scene plays the gestures: the finger moves to the step's element, taps, it lights up */
/* the phone plays the gestures: on the real screen (the app itself, in the demo, see « vrais écrans » below) the finger goes to
   the button the step talks about; on the drawn scene (before the real one is ready, or a lesson with no screen) as before */
function pcSceneRun() {
  const R = PC.run, root = $("#pcp"); if (!R || !root) return; clearTimeout(R.stepT);
  const L = pcL(pcCur().k), real = root.classList.contains("pcp-real"), V = pcMirrorWin();
  const sc = real ? null : $("#pcpFake .pcs", root);
  const typeIt = () => { const v = sc && $(".pcs-val", sc); if (!v) return; const s = v.dataset.type || ""; let n = 0; v.textContent = ""; clearInterval(R.typeT); if (pcReduce()) { v.textContent = s; return; } R.typeT = setInterval(() => { n++; v.textContent = s.slice(0, n); if (n >= s.length) clearInterval(R.typeT); }, 170); };
  const at = (j) => {
    if (real) { try { V.pcView.step(j, L.steps[j] || "", (L.tap || [])[j]); } catch (e) {} return; }
    if (!sc) return;
    $$("[data-s]", sc).forEach((e) => e.classList.toggle("on", +e.dataset.s === j));
    $$("[data-s]", sc).forEach((e) => e.classList.toggle("past", +e.dataset.s < j));
    const el = $(`[data-s="${j}"]`, sc), f = $(".pcs-fing", sc); if (!el || !f) return;
    const a = sc.getBoundingClientRect(), b = el.getBoundingClientRect(); const z = a.width / (sc.offsetWidth || a.width) || 1;
    f.style.transform = `translate(${(b.left - a.left + b.width * 0.62) / z}px, ${(b.top - a.top + b.height * 0.55) / z}px)`; f.classList.add("show");
    f.classList.remove("tap"); void f.offsetWidth; setTimeout(() => f.classList.add("tap"), pcReduce() ? 0 : 420);
    if (j === 0 && sc.dataset.k === "keypad") typeIt();
  };
  if (real) { try { V.pcView.clear(); } catch (e) {} }
  if (sc) { sc.classList.remove("live", "dim", "all"); sc.classList.add("play"); }
  if (R.slide === "intro") { if (sc) { setTimeout(() => sc.classList.add("live"), 60); if (sc.dataset.k === "keypad") setTimeout(typeIt, 500); } return; }
  if (R.slide === "quiz" || R.slide === "won") { if (sc) { sc.classList.add("live", R.slide === "quiz" ? "dim" : "all"); if (R.slide === "won") $$("[data-s]", sc).forEach((e) => e.classList.add("past")); const v = $(".pcs-val", sc); if (v) v.textContent = v.dataset.type || ""; } return; }
  if (sc) sc.classList.add("live");
  const n = real ? L.steps.length : Math.min(L.steps.length, 3);
  const loop = () => { if (!PC.run || PC.run.slide !== "steps") return; at(Math.min(R.step, n - 1)); $$("#pcp .pcp-steps li").forEach((li, j) => { li.classList.toggle("on", j === R.step); li.classList.toggle("past", j < R.step); }); $$("#pcp .pcp-dots i").forEach((d, j) => d.classList.toggle("on", j === R.step)); R.stepT = setTimeout(() => { R.step = (R.step + 1) % L.steps.length; SFX.tick && SFX.tick(); loop(); }, pcReduce() ? 3200 : 2800); };
  R.stepT = setTimeout(loop, real ? 520 : 380);
}

/* ═══════════════════════ vrais écrans ═══════════════════════
   The phone of the player shows the real app: index.html?demo=1&pcview=1 in an iframe (the demo of « Le Bistrot Démo », kept in
   memory only, nothing saved, its own sessionStorage), 390 px wide like a phone and scaled down into the device. Touches never reach
   it (pointer-events: none): it is driven from here through window.pcView of the iframe. Lessons may name the element of each
   step (L.tap: [selector, …]); otherwise the element whose words match the step, else the first buttons of the screen. */
const PC_VIEW = /[?&]pcview\b/.test(location.search);
if (PC_VIEW) { document.documentElement.classList.add("gg-pcview"); try { SFX.on = false; } catch (e) {} }
const PC_META_ROUTE = { "@bases": "home", "@service": "home", "@moi": "moiPlanning", "@pilotage": "dashboard", "@partage": "espaces", "@kiosque": "cuisine", "@code": "pointeuse", "@fonctions": "fonctions", "@equipe": "priseEnMain" };
function pcMirrorWin() { try { return (PC.mirror && PC.mirror.contentWindow) || null; } catch (e) { return null; } }
function pcMirrorReady() { try { const w = pcMirrorWin(); return !!(w && w.pcView && w.pcView.ready()); } catch (e) { return false; } }
function pcRealRoute(k) { const r = k[0] === "@" ? PC_META_ROUTE[k] : k; const w = pcMirrorWin(); try { return r && w && w.pcView.has(r) ? r : ""; } catch (e) { return ""; } }
function pcMirror(root) {
  if (PC_VIEW) return; const scr = $("#pcpScr", root); if (!scr) return;
  const f = document.createElement("iframe"); f.className = "pcp-ifr"; f.tabIndex = -1; f.setAttribute("aria-hidden", "true"); f.title = "Aperçu";
  f.src = "index.html?demo=1&nointro&pcview=1"; PC.mirror = f; scr.prepend(f); pcFit();
  /* the stage grows with an animation: refit at every size it goes through */
  try { new ResizeObserver(() => pcFit()).observe(scr); } catch (e) {}
  const t0 = Date.now();
  const poll = () => {
    if (!PC.run || PC.mirror !== f || !document.contains(f)) return;
    if (!pcMirrorReady()) { if (Date.now() - t0 < 25000) setTimeout(poll, 200); return; }
    try { pcMirrorWin().pcView.prep(); } catch (e) {}
    const R = PC.run, cur = pcCur(); pcFit(); pcStage(root, R, cur, pcL(cur.k));
    if (root.classList.contains("pcp-real") && ["steps", "intro"].includes(R.slide)) pcSceneRun();
  };
  poll();
}
function pcFit() {
  const f = PC.mirror, scr = $("#pcpScr"); if (!f || !scr) return; const W = scr.clientWidth, H = scr.clientHeight; if (!W || !H) return;
  const vw = 390, z = W / vw; f.style.width = vw + "px"; f.style.height = Math.round(H / z) + "px"; f.style.transform = `scale(${z})`;
}
window.addEventListener("resize", () => { if (PC.run) pcFit(); });
/* what the device shows for this slide: nothing on « bonjour » and chapters (the phone folds away), the real screen of the lesson,
   or the drawn scene */
function pcStage(root, R, cur, L) {
  const les = ["intro", "steps", "quiz", "won"].includes(R.slide);
  root.dataset.stage = les ? "on" : "off"; root.dataset.slide = R.slide;
  const dev = $("#pcpDev", root), st = $("#pcpStage", root); if (!dev || !st) return;
  dev.classList.toggle("won", R.slide === "won");
  let seal = $(".pcp-seal", st);
  if (R.slide === "won") { if (!seal) { seal = document.createElement("span"); seal.className = "pcp-seal"; seal.innerHTML = ico("check"); st.appendChild(seal); } } else if (seal) seal.remove();
  if (!les) return;
  { const fk = $("#pcpFake", root); if (fk && fk.dataset.k !== cur.k && !root.classList.contains("pcp-real")) { fk.dataset.k = cur.k; fk.innerHTML = pcScene(L.sc); } }
  const route = pcMirrorReady() ? pcRealRoute(cur.k) : "";
  /* the first real screen appears once it has drawn itself (the drawn scene stays until then) */
  if (route && !root.classList.contains("pcp-real") && !R.realOk) { R.realOk = true; R.shown = cur.k; try { pcMirrorWin().pcView.show(route); } catch (e) {} setTimeout(() => { if (PC.run !== R) return; root.classList.add("pcp-real"); if (R.slide === "steps") pcSceneRun(); }, 650); return; }
  root.classList.toggle("pcp-real", !!route);
  if (route) { if (R.shown !== cur.k) { R.shown = cur.k; try { pcMirrorWin().pcView.show(route); } catch (e) {} } }
  else { const fk = $("#pcpFake", root); if (fk && fk.dataset.k !== cur.k) { fk.dataset.k = cur.k; fk.innerHTML = pcScene(L.sc); } }
  requestAnimationFrame(pcFit);
}
/* inside the iframe: the app being shown */
const PCV_STOP = new Set(["dans", "pour", "avec", "votre", "vous", "puis", "elle", "elles", "tout", "toute", "tous", "touchez", "ouvrez", "choisissez", "regardez", "faites", "comme", "chaque", "plus", "sans", "sont", "cette", "leur", "quand", "besoin", "fois", "seul", "geste", "gestes"]);
window.pcView = {
  used: [],
  ready() { try { return PC_VIEW && DB.mode === "demo" && !!S.resto && !!document.querySelector("#viewport > *"); } catch (e) { return false; } },
  has(r) { try { return !!VIEWS[r] && (typeof canSee !== "function" || canSee(r)); } catch (e) { return false; } },
  prep() { try { SFX.on = false; } catch (e) {} try { if (typeof closeSheet === "function" && document.querySelector("#sheet.open")) closeSheet(true); } catch (e) {} },
  show(route) {
    this.clear(); this.used = [];
    try { if (typeof closeSheet === "function" && document.querySelector("#sheet.open")) closeSheet(true); } catch (e) {}
    try { S.history = []; go(route, {}, { replace: true }); } catch (e) {}
    setTimeout(() => this.top(), 40); setTimeout(() => this.top(), 300);
  },
  top() { try { (document.scrollingElement || document.documentElement).scrollTo(0, 0); const m = document.getElementById("main"); if (m && m.scrollTo) m.scrollTo(0, 0); } catch (e) {} },
  dots() {
    let r = document.getElementById("pcvR"), f = document.getElementById("pcvF");
    if (!r) { r = document.createElement("div"); r.id = "pcvR"; r.className = "pcv-ring"; document.body.appendChild(r); }
    if (!f) { f = document.createElement("div"); f.id = "pcvF"; f.className = "pcv-fing"; f.innerHTML = "<i></i>"; document.body.appendChild(f); }
    return [r, f];
  },
  clear() { ["pcvR", "pcvF"].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.remove("show", "tap"); }); },
  target(j, txt, sel) {
    const vp = document.getElementById("viewport") || document.body;
    if (sel) { const e = vp.querySelector(sel) || document.querySelector(sel); if (e) return e; }
    const H = innerHeight;
    const all = [...vp.querySelectorAll("[data-act],[data-go],button,a[href],input,select,.li,.card,.tile")].filter((e) => {
      const r = e.getBoundingClientRect(); if (r.width < 36 || r.height < 22 || r.height > H * 0.6) return false;
      const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity !== 0;
    });
    const leaf = all.filter((e) => !all.some((o) => o !== e && e.contains(o) && !o.matches(".card,.tile")));
    const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const words = norm(txt).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !PCV_STOP.has(w));
    let best = null, bs = 0;
    leaf.forEach((e, i) => {
      const t = norm(e.textContent + " " + (e.getAttribute("aria-label") || "") + " " + (e.getAttribute("title") || ""));
      let s = 0; words.forEach((w) => { if (t.includes(w.slice(0, Math.max(4, w.length - 2)))) s++; });
      if (!s) return; s -= i * 0.003 + (this.used.includes(e) ? 0.5 : 0); if (s > bs) { bs = s; best = e; }
    });
    if (best && bs >= 0.9) return best;
    const free = leaf.filter((e) => !this.used.includes(e)).slice(0, 8);
    return free[Math.min(free.length - 1, j * 2)] || leaf[0] || null;
  },
  step(j, txt, sel) {
    const e = this.target(j, txt, sel); if (!e) { this.clear(); return; } this.used.push(e);
    const [ring, fing] = this.dots(); const r0 = e.getBoundingClientRect();
    const tb = document.getElementById("tabbar"), bottom = tb && tb.getBoundingClientRect().height ? tb.getBoundingClientRect().top : innerHeight;
    const off = r0.top < 64 || r0.bottom > bottom - 10;
    if (off) { try { e.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (x) { e.scrollIntoView(); } }
    setTimeout(() => {
      const r = e.getBoundingClientRect();
      ring.style.width = r.width + 8 + "px"; ring.style.height = r.height + 8 + "px"; ring.style.transform = `translate(${r.left - 4}px, ${r.top - 4}px)`;
      const fx = r.left + Math.min(r.width * 0.62, r.width - 18), fy = r.top + r.height * 0.6;
      fing.style.transform = `translate(${fx}px, ${fy}px)`; ring.classList.add("show"); fing.classList.add("show");
      fing.classList.remove("tap"); void fing.offsetWidth; setTimeout(() => { fing.classList.add("tap"); e.classList.add("pcv-hit"); setTimeout(() => e.classList.remove("pcv-hit"), 600); }, 560);
    }, off ? 520 : 60);
  },
};
function pcClose(silent) {
  const R = PC.run, root = $("#pcp"); if (R) { clearTimeout(R.stepT); clearInterval(R.typeT); }
  PC.run = null; PC.mirror = null; document.documentElement.classList.remove("pcp-open");
  if (root) { root.id = ""; root.classList.remove("on"); root.classList.add("off"); setTimeout(() => root.remove(), pcReduce() ? 0 : 380); }
  if (!silent) { SFX.close && SFX.close(); buzz(4); }
  try { if (["priseEnMain", "home"].includes(S.route)) rerender(); } catch (e) {}
}
PC.close = pcClose;
async function pcAdvance() {
  const R = PC.run; if (!R) return; const cur = pcCur();
  const order = ["hello", "chap", "intro", "steps", "quiz", "won"];
  if (R.slide === "hello") { R.slide = "chap"; }
  else if (R.slide === "chap") { R.slide = "intro"; }
  else if (R.slide === "intro") { R.slide = "steps"; R.step = 0; }
  else if (R.slide === "steps") { R.slide = "quiz"; R.ans = null; R.tries = 0; R.ord = null; }
  else if (R.slide === "won") {
    if (R.i >= R.list.length - 1) return pcEnd();
    R.i++; R.slide = R.list[R.i].ch !== cur.ch ? "chap" : "intro"; R.step = 0; R.ord = null;
  } else return;
  void order; SFX.tap(); buzz(5); pcPaint(false);
}
function pcEnd() {
  const R = PC.run, root = $("#pcp"); if (!R || !root) return; const m = pcMember(R.mid) || {};
  const all = R.list.every((x) => R.done[x.k]); const n = R.list.filter((x) => R.done[x.k]).length;
  $("#pcpBars", root).innerHTML = pcBars();
  $("#pcpMain", root).innerHTML = `<section class="pcp-end pcp-enter"><div class="pcp-medal">${ico(all ? "pcCap" : "check")}<i></i><i></i><i></i></div><span class="pcp-kick">${all ? "Prise en main terminée" : "Bien joué"}</span><h2 class="pcp-h">${all ? `Vous connaissez Growth Gusto${m.name ? ", " + esc(firstName(m.name)) : ""}.` : `${n} leçon${n > 1 ? "s" : ""} sur ${R.list.length}.`}</h2>
    <p class="pcp-p">${all ? (m.role === "gerant" ? "Chaque personne que vous ajoutez recevra sa propre formation, selon son poste. Vous suivez tout dans Prise en main." : "Votre gérant voit que c'est fait. Les leçons restent dans Prise en main si besoin.") : "Vous reprendrez où vous en êtes, depuis l'accueil ou Prise en main."}</p></section>`;
  $("#pcpFoot", root).innerHTML = `<button class="pcp-go" data-act="pcClose">${all ? "Ouvrir l'app" : "Continuer plus tard"}${ico("arrow")}</button>`;
  SFX.done && SFX.done(); buzz([12, 40, 12, 40, 30]);
  setTimeout(() => { const s = $(".pcp-medal", root); if (s) { const b = s.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2); setTimeout(() => burst(b.left + b.width / 2, b.top + b.height / 3), 260); } }, pcReduce() ? 0 : 300);
}
function pcSwipe(root) {
  let x0 = null, y0 = 0;
  root.addEventListener("touchstart", (e) => { if (e.target.closest("button")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  root.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0 && PC.run && PC.run.slide !== "quiz") pcAdvance(); else if (dx > 0) pcBack(); } }, { passive: true });
}
function pcBack() {
  const R = PC.run; if (!R) return;
  const prev = { intro: "chap", steps: "intro", quiz: "steps", won: "quiz" }[R.slide];
  if (R.slide === "chap" || (R.slide === "intro" && R.i > 0 && R.list[R.i - 1].ch === pcCur().ch)) { if (R.i === 0) return; R.i--; R.slide = "intro"; }
  else if (prev && !(prev === "chap" && R.i > 0 && R.list[R.i - 1].ch === pcCur().ch)) R.slide = prev === "quiz" ? "steps" : prev;
  else return;
  R.step = 0; R.ans = null; SFX.tap(); pcPaint(false);
}
document.addEventListener("keydown", (e) => {
  if (!PC.run || !$("#pcp.on")) return;
  if (e.key === "Escape") { e.preventDefault(); pcClose(); }
  else if (e.key === "ArrowRight" && PC.run.slide !== "quiz") { e.preventDefault(); pcAdvance(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); pcBack(); }
  else if (/^[1-3abcABC]$/.test(e.key) && PC.run.slide === "quiz") { const n = "123".includes(e.key) ? +e.key - 1 : "abc".indexOf(e.key.toLowerCase()); const b = $$("#pcp .pcp-a")[n]; if (b) b.click(); }
});

/* ═══════════════════════ 5. écrans ═══════════════════════ */
function pcRing(pct, size = 56, cls = "") {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return `<span class="pc-ring ${cls}" style="--s:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" style="--c:${c};--o:${c * (1 - pct / 100)}"/></svg><b class="mono">${pct}<small>%</small></b></span>`;
}
const pcAva = (m, s = 40) => (typeof avatar === "function" && m && m.id ? avatar(m.id, s) : `<span class="pc-ava" style="--s:${s}px">${esc(initials((m && m.name) || "?"))}</span>`);
function pcTeam() { return (S.members || []).filter((m) => m.role !== "kiosk" && m.name); }
function pcWhen(ts) { if (!ts) return "pas encore commencé"; const d = Math.floor((Date.now() - ts) / 864e5); return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`; }

/* home card: my training (until it is done) + for a manager, who is not done yet */
function pcHomeCard() {
  try {
    if (!S.resto || (typeof esKioskOn === "function" && esKioskOn())) return ""; pcWatch(); if (!PC.rows) return "";
    const p = pcProg(S.me.id); const team = pcIsMgr() ? pcTeam().filter((m) => m.id !== S.me.id).map((m) => [m, pcProg(m.id)]).filter(([, x]) => !x.finished) : [];
    const mine = !p.finished && p.total ? `<button class="pc-hc glass st" style="--i:1" data-act="pcGo">${pcRing(p.pct, 52)}<span class="pc-hct"><em>Prise en main</em><b>${p.n ? `Reprendre : ${esc(pcLTitle(p.next))}` : "Apprenez l'app en quelques minutes"}</b><span>${p.n} sur ${pcPl(p.total, "leçon")} · environ ${pcMins(p.total - p.n)} min</span></span><span class="pc-hcgo">${pcIco("pcPlay")}</span></button>` : "";
    const tm = team.length ? `<button class="pc-hteam st" style="--i:1" data-go="priseEnMain"><span class="pc-htav">${team.slice(0, 4).map(([m]) => pcAva(m, 26)).join("")}</span><span><b>${team.length === 1 ? `${esc(firstName(team[0][0].name))} n'a pas fini sa formation` : `${team.length} personnes n'ont pas fini leur formation`}</b><em>Voir la progression</em></span>${ico("chev")}</button>` : "";
    return mine || tm ? `<div class="pc-home">${mine}${tm}</div>` : "";
  } catch (e) { console.warn("pc home", e); return ""; }
}
(function pcHomeWrap() {
  const H = VIEWS.home; if (!H || H._pc) return; const r0 = H.render; H._pc = true;
  H.render = function (p) { const h = r0.call(this, p); const c = pcHomeCard(); if (!c) return h; const i = h.indexOf("</header>"); return i >= 0 ? h.slice(0, i + 9) + c + h.slice(i + 9) : c + h; };
})();

VIEWS.priseEnMain = {
  render() {
    pcWatch(); const me = pcProg(S.me.id), mgr = pcIsMgr();
    const full = pcPlanFull(S.me.id), r = me.row.done || {};
    const chs = [...new Set(full.map((x) => x.ch))];
    const team = mgr ? pcTeam().filter((m) => m.id !== S.me.id) : [];
    return `<div class="inner pc-v">${topBar("Prise en main")}
      <section class="pc-me glass st" style="--i:1">${pcRing(me.pct, 92, "lg")}<div class="pc-metx"><span class="lbl">Ma formation</span><b>${me.finished ? "Terminée, bravo." : me.n ? `${me.n} sur ${pcPl(me.total, "leçon")}` : `${pcPl(me.total, "leçon")} pour vous`}</b><em>${me.finished ? "Revoyez une leçon quand vous voulez." : `Environ ${pcMins(me.total - me.n)} min · taillée pour ${pcRole() === "gerant" ? "votre restaurant" : "votre poste"}`}</em>
        <button class="btn acc" data-act="pcGo">${ico("pcPlay")}${me.finished ? "Tout revoir" : me.n ? "Reprendre" : "Commencer"}</button></div></section>
      ${mgr ? `<span class="lbl st" style="--i:2">L'équipe · ${team.length}</span>
      <section class="glass pc-team st" style="--i:3">${team.length ? team.map((m) => { const p = pcProg(m.id); return `<div class="li tap" data-act="pcPerson" data-id="${esc(m.id)}">${pcAva(m, 40)}<div class="tx"><b>${esc(m.name)}</b><em>${p.finished ? "Terminé" : p.n ? `${p.n} sur ${p.total} · ${esc(pcWhen(p.last))}` : `${pcPl(p.total, "leçon")} prêtes · pas encore commencé`}</em></div>${pcRing(p.pct, 40, p.finished ? "ok" : "")}</div>`; }).join("") : `<div class="pc-empty"><b>Ajoutez votre équipe</b><span>Chaque personne reçoit sa formation, selon son poste.</span>${VIEWS.equipe ? `<button class="btn soft sm" data-go="equipe">${ico("users")}Équipe</button>` : ""}</div>`}</section>` : ""}
      <span class="lbl st" style="--i:4">Mes leçons</span>
      ${chs.map((c, ci) => `<section class="glass pc-lessons st" style="--i:${5 + ci}"><h3 class="pc-lch">${esc(c)}<em>${full.filter((x) => x.ch === c && r[x.k]).length}/${full.filter((x) => x.ch === c).length}</em></h3>${full.filter((x) => x.ch === c).map((x) => `<div class="li tap${r[x.k] ? " pc-ok" : ""}" data-act="pcLecon" data-v="${esc(x.k)}"><span class="ic">${pcIco(pcLIc(x.k))}</span><div class="tx"><b>${esc(pcLTitle(x.k))}</b><em>${esc(((pcL(x.k) || {}).d || "").split(/(?<=[.!?])\s/)[0])}</em></div>${r[x.k] ? `<span class="pc-done">Faite</span>` : ico("chev")}</div>`).join("")}</section>`).join("")}
      ${pcIsBoss() ? `<button class="btn soft block st" style="--i:12" data-go="fonctions">${pcIco("pcToggles")}Fonctionnalités du restaurant</button>` : ""}
    </div>`;
  },
};
function pcPersonSheet(mid) {
  const m = pcMember(mid); if (!m) return; const full = pcPlanFull(mid), p = pcProg(mid), done = p.row.done || {}, miss = p.row.miss || {};
  const hard = Object.keys(miss).filter((k) => pcL(k));
  openSheet(`<div class="pc-ps"><div class="pc-psh">${pcAva(m, 52)}<div><b>${esc(m.name)}</b><em>${esc((typeof ROLES !== "undefined" && ROLES[m.role]) || "")}${m.poste ? " · " + esc(m.poste) : ""}</em></div>${pcRing(p.pct, 56, p.finished ? "ok" : "")}</div>
    <p class="sub">${p.finished ? `Terminé ${esc(pcWhen(p.row.finishedAt))}.` : p.started ? `${p.n} leçon${p.n > 1 ? "s" : ""} sur ${p.total}, dernière activité ${esc(pcWhen(p.last))}.` : `Sa formation est prête : ${pcPl(p.total, "leçon")}, environ ${pcMins(p.total)} min.`}</p>
    ${hard.length ? `<div class="pc-hard">${pcIco("pcSpark")}<span>À revoir avec ${esc(firstName(m.name))} : ${hard.map((k) => esc(pcLTitle(k))).join(", ")}</span></div>` : ""}
    <div class="pc-pslist">${full.map((x) => `<span class="${done[x.k] ? "ok" : ""}">${esc(pcLTitle(x.k))}</span>`).join("")}</div>
    ${!p.finished ? `<button class="btn acc block" data-act="pcNudge" data-id="${esc(mid)}">${ico("send")}Lui rappeler sa formation</button>` : ""}
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`);
}

VIEWS.fonctions = {
  render() {
    if (!PC.F) PC.F = pcDraft(false);
    const boss = pcIsBoss() || pcDemo();
    return `<div class="inner narrow pc-fv">${topBar("Fonctionnalités")}
      <p class="sub st" style="--i:1">Ce qui est coupé disparaît du menu, des écrans et de la formation de toute l'équipe. Les données restent gardées.</p>
      ${boss ? pcPickerHTML(PC.F, { i0: 2 }) : `<div class="glass empty st" style="--i:2">Seul le gérant choisit les fonctionnalités du restaurant.</div>`}
      ${boss ? `<div class="ctabar"><button class="btn acc block" data-act="pcFeatSave">${ico("check")}Enregistrer</button></div>` : ""}</div>`;
  },
};
/* Réglages: « Fonctionnalités » and « Prise en main » rows */
(function pcReglages() {
  const V = VIEWS.reglages; if (!V || V._pc) return; const r0 = V.render; V._pc = true;
  V.render = function (p) {
    const h = r0.call(this, p); if (!S.resto) return h;
    const off = pcOffSet().size; const pr = pcProg(S.me.id);
    const rows = `${pcIsBoss() || pcDemo() ? `<div class="li tap" data-go="fonctions"><span class="ic w-vi">${ico("pcToggles")}</span><div class="tx"><b>Fonctionnalités</b><em>${off ? `${pcFams().filter((f) => pcFamOn(f)).length} activées sur ${pcFams().length}` : "Toutes activées"}</em></div>${ico("chev")}</div>` : ""}<div class="li tap" data-go="priseEnMain"><span class="ic w-sa">${ico("pcCap")}</span><div class="tx"><b>Prise en main</b><em>${pr.finished ? "Terminée · revoir une leçon" : `${pr.n} sur ${pcPl(pr.total, "leçon")}`}</em></div>${ico("chev")}</div>`;
    const k = h.indexOf('<div class="li tap" data-act="tourStart"'); if (k >= 0) return h.slice(0, k) + rows + h.slice(k);
    const k2 = h.indexOf('<div class="li tap" data-go="imprimante"'); return k2 >= 0 ? h.slice(0, k2) + rows + h.slice(k2) : h;
  };
})();
/* a switched-off screen reached by a link: say so, and let the gérant switch it back on */
(function pcNoAccess() {
  const V = VIEWS.noaccess; if (!V || V._pc) return; const r0 = V.render; V._pc = true;
  V.render = function (p) {
    const r = (p && p.route) || (S.params && S.params.route); if (!r || !pcRouteOff(r)) return r0.apply(this, arguments);
    const f = pcFams().find((x) => x.routes.includes(r) || x.routes.includes(PC_PARENT[r])); const n = pcNavOf(r) || pcNavOf(PC_PARENT[r]) || [r, "pcToggles", r];
    return `<div class="inner narrow">${topBar(n[2])}<div class="glass pc-offc st" style="--i:1"><span class="pc-fic lg">${pcIco(n[1])}</span><b>${esc(n[2])} n'est pas activé</b><p class="sub">${esc((PC_LECONS[r] || PC_LECONS[PC_PARENT[r]] || {}).d || "Cette fonctionnalité est coupée pour ce restaurant.")}</p>
      ${pcIsBoss() && f ? `<button class="btn acc block" data-act="pcFamOn" data-v="${esc(f.k)}">${ico("pcToggles")}Activer ${esc(f.t)}</button>` : `<p class="note">Demandez au gérant de l'activer.</p>`}</div></div>`;
  };
})();

/* the first time someone (not the gérant: he had it at the end of the onboarding) opens the app: their training is ready */
function pcHello() {
  try {
    if (!S.ready || !S.resto || pcDemo() || PC.run || S.route !== "home" || $("#sheet.open") || $(".au.on") || $(".cc-lock.on") || (typeof esKioskOn === "function" && esKioskOn()) || (typeof esShared === "function" && esShared())) return;
    if (pcRole() === "gerant" || !PC.rows) return; const key = `gg-pc-hi-${S.rid}-${S.me.id}`; if (pcLS.get(key)) return;
    const p = pcProg(S.me.id); if (p.started || !p.total) return; pcLS.set(key, "1"); pcPlay({ mid: S.me.id, from: "hello" });
  } catch (e) {}
}
window.addEventListener("load", () => { setInterval(pcHello, 4000); });
/* the gérant leaving the onboarding with « Prise en main »: skip the old guided tour, this one covers it */
window.addEventListener("gg:onboarded", () => { if (PC.wantStart) { PC.wantStart = false; try { if (window.TOUR && TOUR.done) TOUR.done(); } catch (e) {} setTimeout(() => { pcWatch(); pcPlay({ mid: S.me.id, from: "onboarding" }); }, pcReduce() ? 200 : 900); } });

Object.assign(ACT, {
  pcGo: () => { pcWatch(); pcPlay({ mid: S.me.id }); },
  pcLecon: (a, id, v) => { pcWatch(); pcPlay({ mid: S.me.id, keys: [v], from: "lecon" }); },
  pcClose: () => pcClose(),
  pcNext: () => pcAdvance(),
  pcSkipCh: () => { const R = PC.run; if (!R) return; const ch = pcCur().ch; const j = R.list.findIndex((x, n) => n > R.i && x.ch !== ch); if (j < 0) return pcEnd(); R.i = j; R.slide = "chap"; SFX.tap(); pcPaint(false); },
  pcStep: (a, id, v) => { const R = PC.run; if (!R) return; R.step = +v; clearTimeout(R.stepT); SFX.tick && SFX.tick(); pcSceneRun(); },
  pcTry: () => { const R = PC.run; if (!R) return; const k = pcCur().k; pcMark(R.mid, k, true); pcClose(true); setTimeout(() => { go(k); toast("À vous : la leçon est validée, la suite vous attend dans Prise en main"); }, 120); },
  pcAns: (a, id, v) => {
    const R = PC.run; if (!R || R.slide !== "quiz") return; const L = pcL(pcCur().k); const j = +v; if (R.ans === L.q[2]) return;
    R.ans = j; R.tries++;
    if (j === L.q[2]) {
      a.classList.add("ok"); SFX.ok(); buzz([8, 30, 8]); const b = a.getBoundingClientRect(); burst(b.right - 30, b.top + b.height / 2);
      R.done[pcCur().k] = Date.now(); pcMark(R.mid, pcCur().k, true, R.tries > 1 ? R.tries - 1 : 0);
      setTimeout(() => { if (PC.run === R) { R.slide = "won"; pcPaint(false); } }, pcReduce() ? 200 : 650);
    } else { SFX.err(); buzz([20, 40, 20]); a.classList.remove("ko"); void a.offsetWidth; pcPaint(false); }
  },
  pcObStart: () => { PC.wantStart = true; if (typeof OB !== "undefined" && OB.st) OB.leave(); else pcPlay({ mid: S.me.id }); },
  pcPerson: (a, id) => { SFX.tap(); pcPersonSheet(id); },
  pcNudge: (a, id) => {
    const m = pcMember(id); if (!m) return; const tx = `${firstName(m.name)}, ta formation Growth Gusto t'attend : Prise en main, environ ${pcMins(pcProg(id).total - pcProg(id).n)} minutes.`;
    if (typeof csPost === "function" && !pcDemo()) { try { csPost({ kind: "info", text: tx }); } catch (e) {} }
    if (navigator.share && !pcDemo()) navigator.share({ text: tx + " " + location.origin }).catch(() => {}); else { try { navigator.clipboard.writeText(tx).catch(() => {}); } catch (e) {} }
    closeSheet(); toast(pcDemo() ? "Rappel envoyé (démo)" : "Message prêt à envoyer"); SFX.ok();
  },
  /* onboarding questions */
  pcQ: (a) => {
    const st = typeof OB !== "undefined" && OB.st; if (!st) return; PC.obInit(st); const p = st.d.pcProfil, k = a.dataset.k, v = a.dataset.v;
    const L = Array.isArray(p[k]) ? p[k] : (p[k] = []); const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else L.push(v);
    const on = i < 0; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); if (on && !pcReduce()) { a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); }
    on ? SFX.tick() : SFX.tap(); buzz(on ? 6 : 3); delete st.d.skipped.maison; st.d.pcFams = null;
  },
  pcQ1: (a) => {
    const st = typeof OB !== "undefined" && OB.st; if (!st) return; PC.obInit(st); const p = st.d.pcProfil, k = a.dataset.k, v = a.dataset.v;
    p[k] = p[k] === v ? "" : v; $$(`[data-act=pcQ1][data-k="${k}"]`).forEach((b) => { const on = b.dataset.v === p[k]; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    SFX.tick(); buzz(5); delete st.d.skipped.maison; st.d.pcFams = null;
  },
  pcMulti: (a) => { const st = typeof OB !== "undefined" && OB.st; if (!st) return; PC.obInit(st); const p = st.d.pcProfil; p.multi = !p.multi; a.classList.toggle("on", p.multi); a.setAttribute("aria-pressed", p.multi); SFX.tick(); buzz(5); st.d.pcFams = null; },
  pcFam: (a, id, v) => {
    const inOb = typeof OB !== "undefined" && !!OB.st && (S.route === "onboard" || S.route === "onboarding"); const d = inOb ? OB.st.d.pcFams : PC.F; if (!d) return;
    d[v] = !d[v]; if (inOb) delete OB.st.d.skipped.fonctions;
    pcPickPaint(a.closest(".pc-pick"), d, v); d[v] ? SFX.tick() : SFX.tap(); buzz(d[v] ? 6 : 3); try { OB.st && OB.fiche && OB.fiche(); } catch (e) {}
  },
  pcPickAll: (a, id, v) => {
    const inOb = typeof OB !== "undefined" && OB.st && (S.route === "onboard" || S.route === "onboarding"); const d = inOb ? OB.st.d.pcFams : PC.F; if (!d) return;
    const reco = pcReco(inOb ? OB.st.d.pcProfil : pcProfil());
    pcFams().forEach((f) => { d[f.k] = v === "all" ? true : v === "hyg" ? f.ch === "Hygiène" || ["consignes", "alertes"].includes(f.k) : reco.has(f.k) || f.ch === "Autres"; });
    const root = a.closest(".pc-pick"); pcFams().forEach((f) => { const b = root && root.querySelector(`[data-act=pcFam][data-v="${CSS.escape(f.k)}"]`); if (b) { b.classList.toggle("on", !!d[f.k]); b.setAttribute("aria-pressed", !!d[f.k]); } });
    pcPickPaint(root, d, ""); SFX.ok(); buzz([6, 20, 6]); try { OB.st && OB.fiche && OB.fiche(); } catch (e) {}
  },
  pcFeatSave: async () => { if (!PC.F) return; await pcSaveFeatures(PC.F); PC.F = null; SFX.done(); buzz([10, 30, 10]); toast("Fonctionnalités enregistrées"); goBack ? goBack() : go("reglages"); },
  pcFamOn: async (a, id, v) => { const d = pcDraft(false); d[v] = true; await pcSaveFeatures(d); SFX.done(); toast("Activé"); const r = S.params && S.params.route; S.history = []; go(r && !pcRouteOff(r) ? r : "home", {}, { replace: true }); },
});
/* leaving « fonctions » without saving forgets the draft */
(function pcGoWrap() { const g0 = go; go = function (route) { if (S.route === "fonctions" && route !== "fonctions") PC.F = null; if (PC.run && route !== S.route && !["priseEnMain"].includes(route)) { /* a link inside the app while the player is open (tests, deep links) */ } return g0.apply(this, arguments); }; })();
window.PC = PC;
