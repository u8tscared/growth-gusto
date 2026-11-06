/* Growth Gusto — onboarding (area prefix « ob »): seven short screens that set the restaurant up from A to Z, after an account is created
   (js/auth.js hands off with OB.handoff), on the first run of the local mode (VIEWS.onboarding delegates here), and later from Réglages
   (« Compléter la fiche du restaurant »). One screen per step, springy transitions, a live « fiche » of the restaurant on the right (desktop).
   Steps: resto · vous · frigos (starts empty, typed tiles) · etiquettes (labels.js picker) · imprimante (labels.js wizard) · equipe ·
   outils (one question per tool, one screen each: import · réservations · caisse · sondes · « On active aussi ? » → resto.setupTodo, setupAns, resaProvider, posProvider, importFrom) · pret (to-do + « ce que fait l'app »).
   Modes: "create" (no restaurant yet: the restaurant and the gérant are written when the person leaves step 2) · "complete" (the restaurant
   exists: every step writes live). After step 2 the flow is always "complete", so back, refresh or re-entry never create a second restaurant.
   The session marker « gg-ob » ("rid" or "rid|step") resumes the first run after a refresh; it is cleared when the flow closes.
   Data: resto doc { name, site, logo, type, address, phone, covers }, fridges { name, type, min, max, order, createdAt, svcMax? },
   members { name, role, color, photo }, resto.setupTodo [tool ids] + resto.setupTodoHidden (home card « Masquer »).
   Public: OB.todoCard() → HTML of the home card « À faire pour bien démarrer » (or ""), OB.featuresHTML() / ACT.obFeatures (sheet « Tout
   ce que fait Growth Gusto »), OB.openTool(id). Hooks: OB.handoff(rid) (auth), OB.open(from) (Réglages), ACT.obCreate() (legacy test entry),
   window event « gg:onboarded » when the first run closes (guided tour). */
"use strict";

const OB_STEPS = [
  { k: "resto", t: "Le restaurant", s: "Restaurant", opt: false },
  { k: "vous", t: "Vous", s: "Vous", opt: false },
  { k: "frigos", t: "Vos équipements", s: "Équipements", opt: true },
  { k: "etiquettes", t: "Vos étiquettes", s: "Étiquettes", opt: true },
  { k: "imprimante", t: "L'imprimante", s: "Imprimante", opt: true },
  { k: "equipe", t: "L'équipe", s: "Équipe", opt: true },
  { k: "outils", t: "Vos outils", s: "Outils", opt: true },
  { k: "pret", t: "C'est prêt", s: "Prêt", opt: false },
];
const OB_LAST = OB_STEPS.length - 1;
const obIdx = (k) => OB_STEPS.findIndex((x) => x.k === k);
const OB_TYPES = [["bistrot", "Bistrot"], ["brasserie", "Brasserie"], ["gastro", "Gastronomique"], ["bar", "Bar à vin"], ["pizzeria", "Pizzeria"], ["traiteur", "Traiteur"], ["boulangerie", "Boulangerie"], ["autre", "Autre"]];
/* the equipment kinds offered on step 3, in Marceau's order (keys of REL_TYPES in js/releve.js) */
const OB_KINDS = [["frigo", "Frigo"], ["service", "Frigo de service"], ["cfp", "Chambre froide"], ["congel", "Congélateur"], ["saladette", "Saladette"], ["cave", "Cave à boissons"], ["vitrine", "Vitrine"]];
const OB_FR_FB = { frigo: [0, 4, 3], cfp: [0, 4, 2], service: [0, 4, 3], congel: [-40, -15, -18], saladette: [0, 4, 3], cave: [2, 8, 5], vitrine: [0, 4, 3] };
const OB_PRINTER = "Brother QL-810Wc";
const obSv = (d, w = 20, sw = 2) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const OB_SVG = {
  back: obSv('<path d="M19 12H5M11 6l-6 6 6 6"/>', 20, 2.2),
  arrow: obSv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  chev: obSv('<path d="m9 6 6 6-6 6"/>', 18, 2.2),
  down: obSv('<path d="m6 9 6 6 6-6"/>', 18, 2.2),
  plus: obSv('<path d="M12 5v14M5 12h14"/>', 18, 2.4),
  minus: obSv('<path d="M5 12h14"/>', 18, 2.4),
  x: obSv('<path d="M6 6l12 12M18 6 6 18"/>', 14, 2.4),
  check: obSv('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 15, 2.6),
  globe: obSv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>'),
  pin: obSv('<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>'),
  phone: obSv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  camera: obSv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>'),
  image: obSv('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-4.5-4.5L8 20"/>'),
  snow: obSv('<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>'),
  users: obSv('<circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.4 3.4 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6"/>'),
  userAdd: obSv('<circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0M19 8v6M16 11h6"/>'),
  printer: obSv('<path d="M7 9V4h10v5M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1.5"/>'),
  tag: obSv('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.6"/>'),
  copy: obSv('<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>', 18),
  share: obSv('<path d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', 18),
  store: obSv('<path d="m3 8 2-4h14l2 4M3 8h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 12v8h14v-8M10 20v-5h4v5"/>'),
  seal: `<svg class="onb-sealsvg" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><circle class="disc" cx="36" cy="36" r="30"/><circle class="ring" cx="36" cy="36" r="34" fill="none" stroke-width="3"/><path d="M24 37l8 8 16-17" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
/* drawn equipment (64×64), the V2 kitchen look: cream bodies, lilac shade, ink LCD with a mint reading */
const obArt = (() => {
  const B = 'fill="#FFFDF8" stroke="#BDB0EA" stroke-width="1.6"', SH = 'fill="#EEE9FB"', H = 'fill="#C9BFE9"';
  const lcd = (x, y, w = 13) => `<rect x="${x}" y="${y}" width="${w}" height="7" rx="2" fill="#1B1530"/><rect x="${x + 3}" y="${y + 2.6}" width="${w - 6}" height="1.8" rx=".9" fill="#9EF5C4"/>`;
  const svg = (b) => `<svg class="onb-artsvg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${b}</svg>`;
  return {
    frigo: svg(`<rect x="19" y="5" width="26" height="54" rx="6" ${B}/><rect x="38" y="6" width="6" height="52" rx="3" ${SH}/><rect x="19.8" y="29" width="24.4" height="1.6" fill="#E4DCF7"/>${lcd(23, 10)}<rect x="33" y="17" width="2.6" height="8" rx="1.3" ${H}/><rect x="33" y="34" width="2.6" height="14" rx="1.3" ${H}/>`),
    service: svg(`<rect x="4" y="20" width="56" height="6" rx="2.5" fill="#C9BFE9"/><rect x="7" y="26" width="50" height="30" rx="4" ${B}/><rect x="31.2" y="27" width="1.6" height="28" fill="#E4DCF7"/>${lcd(11, 30, 12)}<rect x="22" y="41" width="7" height="2.6" rx="1.3" ${H}/><rect x="35" y="41" width="7" height="2.6" rx="1.3" ${H}/><rect x="10" y="56" width="4" height="3" rx="1" fill="#BDB0EA"/><rect x="50" y="56" width="4" height="3" rx="1" fill="#BDB0EA"/>`),
    cfp: svg(`<rect x="7" y="6" width="50" height="53" rx="5" ${B}/><rect x="16" y="16" width="32" height="43" rx="3" fill="#F4F0FD" stroke="#BDB0EA" stroke-width="1.6"/>${lcd(25.5, 8.5)}<rect x="40" y="31" width="3.4" height="14" rx="1.7" fill="#9C8DE0"/><rect x="18.5" y="19" width="5" height="37" rx="2" ${SH}/>`),
    congel: svg(`<rect x="6" y="24" width="52" height="32" rx="5" ${B}/><rect x="6.8" y="24.8" width="50.4" height="10" rx="4" fill="#DCEAFF"/><rect x="24" y="28.4" width="16" height="2.8" rx="1.4" fill="#9EC5FF"/>${lcd(11, 41, 14)}<rect x="9" y="56" width="5" height="3" rx="1" fill="#BDB0EA"/><rect x="50" y="56" width="5" height="3" rx="1" fill="#BDB0EA"/>`),
    saladette: svg(`<rect x="6" y="22" width="52" height="34" rx="4" ${B}/><rect x="9" y="15" width="13" height="9" rx="2" fill="#7BD6A6"/><rect x="25.5" y="15" width="13" height="9" rx="2" fill="#EF5A3C"/><rect x="42" y="15" width="13" height="9" rx="2" fill="#F6B93B"/><rect x="6.8" y="22.8" width="50.4" height="4" fill="#E4DCF7"/>${lcd(10, 32, 12)}<rect x="31.2" y="27" width="1.6" height="28" fill="#E4DCF7"/><rect x="36" y="42" width="7" height="2.6" rx="1.3" ${H}/>`),
    cave: svg(`<rect x="17" y="5" width="30" height="54" rx="6" ${B}/>${lcd(25.5, 9)}<rect x="21.5" y="19" width="21" height="35" rx="3" fill="#2B2347"/><g fill="#C8432A"><rect x="24" y="24" width="4" height="7" rx="2"/><rect x="30" y="24" width="4" height="7" rx="2"/></g><rect x="36" y="24" width="4" height="7" rx="2" fill="#F6B93B"/><g fill="#9EC5FF"><rect x="24" y="36" width="4" height="7" rx="2"/></g><rect x="30" y="36" width="4" height="7" rx="2" fill="#F6B93B"/><rect x="36" y="36" width="4" height="7" rx="2" fill="#C8432A"/><rect x="22" y="33" width="20" height="1.4" fill="#5A4F7A"/><rect x="22" y="45" width="20" height="1.4" fill="#5A4F7A"/>`),
    vitrine: svg(`<rect x="8" y="14" width="48" height="24" rx="5" fill="#E6F0FF" stroke="#9EC5FF" stroke-width="1.6"/><rect x="12" y="28" width="9" height="7" rx="2" fill="#F6B93B"/><rect x="24" y="26" width="9" height="9" rx="2" fill="#EF5A3C"/><rect x="36" y="29" width="8" height="6" rx="2" fill="#7BD6A6"/><rect x="47" y="27" width="6" height="8" rx="2" fill="#F6B93B"/><rect x="9" y="35" width="46" height="1.6" fill="#9EC5FF"/><rect x="6" y="38" width="52" height="18" rx="4" ${B}/>${lcd(10, 43, 12)}<rect x="40" y="46" width="12" height="2.6" rx="1.3" ${H}/>`),
  };
})();
/* a drawn label for the placeholder of step 4 */
const OB_LABEL_ART = `<svg class="onb-labart" viewBox="0 0 120 80" aria-hidden="true" focusable="false"><rect x="6" y="6" width="108" height="68" rx="10" fill="#fff" stroke="#DCCFB8" stroke-width="1.8"/><rect x="16" y="17" width="26" height="26" rx="4" fill="#1B1530"/><rect x="21" y="22" width="6" height="6" fill="#fff"/><rect x="31" y="22" width="6" height="6" fill="#fff"/><rect x="21" y="32" width="6" height="6" fill="#fff"/><rect x="31" y="32" width="3" height="3" fill="#fff"/><rect x="50" y="17" width="50" height="7" rx="3.5" fill="#1B1530"/><rect x="50" y="30" width="34" height="11" rx="3" fill="#5B2BFF"/><rect x="50" y="47" width="42" height="5" rx="2.5" fill="#DCCFB8"/><rect x="16" y="55" width="84" height="5" rx="2.5" fill="#EEE6D6"/></svg>`;
Object.assign(IC, { obCard: ["r:3,5,18,14,2.5", "M3 10h18", "M7 15h4"] });

const obReduce = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const obDesk = () => window.matchMedia("(min-width:960px)").matches;
const obDomain = (v) => { v = String(v || "").trim().toLowerCase(); if (!v) return ""; v = v.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].split("@").pop(); return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : ""; };
const obSS = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} } };
const obDeg = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
const obPl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
/* thresholds of a kind: REL_TYPES (js/releve.js) when loaded, else the same defaults */
const obFrType = (k) => { const f = OB_FR_FB[k] ? k : "frigo"; const R = typeof REL_TYPES !== "undefined" ? REL_TYPES.find((x) => x.k === f) : null; const F = OB_FR_FB[f]; return { k: f, min: R ? R.min : F[0], max: R ? R.max : F[1], t: R && R.t != null ? R.t : F[2], svc: R && R.svc != null ? R.svc : ["service", "saladette"].includes(f) ? 8 : null }; };
const obGuessType = (name) => { const n = String(name || "").toLowerCase(); return /cong[eé]l|surg[eé]l|n[eé]gativ/.test(n) ? "congel" : /chambre froide/.test(n) ? "cfp" : /service|plan de travail|sous[- ]plan|comptoir|passe\b/.test(n) ? "service" : /saladette/.test(n) ? "saladette" : /cave|vin|boisson/.test(n) ? "cave" : /vitrine/.test(n) ? "vitrine" : "frigo"; };
const obKindOf = (f) => { if (f && OB_FR_FB[f.type]) return f.type; if (typeof relTypeOf === "function") { const t = relTypeOf(f); if (t && OB_FR_FB[t.k]) return t.k; } return f && f.max <= -10 ? "congel" : obGuessType(f && f.name); };
const obKindName = (k) => (OB_KINDS.find((x) => x[0] === k) || OB_KINDS[0])[1];
/* drawn-fridge silhouette of the V2 home (css/v2.css .hm-dfr): cg = chest, cf = cold room, sv = under the worktop, st = upright */
const obShape = (k) => (k === "congel" ? "cg" : k === "cfp" ? "cf" : k === "service" || k === "saladette" ? "sv" : "st");
/* an icon of another area when it is loaded (they register in IC), else a core one */
const obI = (n, fb) => ico(IC[n] ? n : fb);
const obPerm = (r) => { try { return typeof permOk !== "function" || permOk(r); } catch (e) { return true; } };
/* step « Vos outils »: what can be switched on after the onboarding. tone = icon well colour. done() = it is set up already. */
const OB_TOOLS = [
  { k: "import", n: "Import", ic: "imUp", fb: "upload", tone: "v", t: "Vous venez d'un autre logiciel ?", s: "Produits, recettes, relevés : on récupère tout.", todo: "Importer vos données", ts: "Excel ou CSV, en 2 minutes", r: "import", wide: true,
    ok: () => (typeof window.IMPORT !== "undefined" && window.IMPORT && typeof window.IMPORT.open === "function") || !!VIEWS.import,
    done: () => { try { if (typeof imWatch === "function") imWatch(); return typeof IM !== "undefined" && IM.wRid === S.rid && (IM.hist || []).some((h) => !h.undone); } catch (e) { return false; } } },
  { k: "sondes", n: "Sondes", ic: "sdProbe", fb: "therm", tone: "sky", t: "Sondes connectées", s: "Les frigos se relèvent seuls.", todo: "Brancher vos sondes", ts: () => (OB.ansOf("sondes").v === "buy" ? "Quand vous les aurez reçues" : "Shelly, SensorPush, Govee…"), r: "sondes",
    done: () => { try { if (typeof sdWatch === "function") sdWatch(); return !!(window.SONDES && window.SONDES.list().length); } catch (e) { return false; } } },
  { k: "caisse", n: "Caisse", ic: "cxPlug", fb: "receipt", tone: "sf", t: "Caisse connectée", s: "SumUp, Zelty, Square, Lightspeed.", todo: () => { const p = obPosName(); return p ? `Connecter ${p}` : "Connecter la caisse"; }, ts: "Ou importer un fichier de ventes", r: "caisse",
    done: () => { try { if (typeof cxEnsure === "function") cxEnsure(); } catch (e) {} return (S.cxStat || []).some((c) => c.status === "connected" || c.lastImport) || (S.cxSales || []).length > 0; } },
  /* « Une caisse classique » (question Caisse): the paper ticket Z, photographed each evening (js/tickets.js) */
  { k: "ticketz", n: "Ticket Z", ic: "receipt", fb: "receipt", tone: "sf", t: "Ticket Z en photo", s: "Le stock se déduit seul.", todo: "Photographier le ticket Z", ts: "Ce soir, après le service", r: "tickets", hide: true,
    done: () => (S.tickets || []).some((t) => t.source !== "caisse" && t.source !== "demo") },
  { k: "resa", n: "Réservations", ic: "resa", fb: "cal", tone: "tm", t: "Réservations en ligne", s: "Un lien pour réserver une table.", todo: "Ouvrir les réservations", ts: "Services, couverts, lien public", r: "resa",
    done: () => !!(S.resto && S.resto.resaCfg) },
  { k: "alertes", n: "Alertes", ic: "alBell", fb: "alert", tone: "tm", t: "Alertes par e-mail", s: "Prévenu si un frigo chauffe.", todo: "Régler vos alertes", ts: "Qui prévenir, et quand", r: "alertes",
    done: () => !!(S.resto && S.resto.alertCfg) },
  { k: "pms", n: "PMS", ic: "ctBadge", fb: "shield", tone: "v", t: "Plan de maîtrise sanitaire", s: "Votre PMS, rédigé pour vous.", todo: "Générer votre PMS", ts: "15 questions, un document prêt", r: "pms",
    done: () => { try { if (typeof ctWatch === "function") ctWatch(); } catch (e) {} return !!(S.ctDocs && S.ctDocs.pms); } },
  { k: "formation", n: "Formation", ic: "fmHand", fb: "book", tone: "sf", t: "Formation de l'équipe", s: "L'HACCP en 10 minutes, avec quiz.", todo: "Former l'équipe", ts: "Quiz et attestations", r: "formation",
    done: () => { try { if (typeof fmWatch === "function") fmWatch(); return (typeof FM !== "undefined" && FM.rid === S.rid && (FM.rows || []).length > 0) || (S.trainings || []).length > 0; } catch (e) { return false; } } },
];
const obTool = (k) => OB_TOOLS.find((x) => x.k === k);
const obTx = (v) => (typeof v === "function" ? v() : v);
const obPosName = () => { const p = S.resto && S.resto.posProvider; if (!p || p === "aucune" || p === "papier" || p === "autre") return ""; try { if (typeof cxPos === "function") return cxPos(p).name; } catch (e) {} return ""; };
const obToolOk = (x) => !!x && (x.ok ? x.ok() : !!VIEWS[x.r]) && obPerm(x.r);
/* « Ce que Growth Gusto fait pour vous »: every screen, by family (only the ones loaded and allowed are shown) */
const OB_FEATS = [
  { t: "Hygiène & HACCP", ic: "shield", tone: "v", items: [["releve", "therm", "Relevés de températures"], ["hygiene", "hygPot", "Refroidissement, friture"], ["menage", "spray", "Plan de nettoyage"], ["registre", "shield", "Registre HACCP"], ["controle", "ctBadge", "Contrôle sanitaire"], ["pms", "ctDoc", "Plan de maîtrise sanitaire"], ["rappel", "ctRecall", "Rappel de lot"], ["obligations", "calcheck", "Obligations"]] },
  { t: "Cuisine & stock", ic: "book", tone: "sf", items: [["frigos", "snow", "Frigos et DLC"], ["sondes", "sdProbe", "Sondes connectées"], ["scan", "scan", "Étiquettes et scanner"], ["reception", "truck", "Réceptions"], ["notes", "book", "Recettes et allergènes"], ["stock", "box", "Stock et inventaire"], ["gaspillage", "hygBin", "Gaspillage"]] },
  { t: "Équipe", ic: "users", tone: "sky", items: [["pointeuse", "clock", "Pointeuse"], ["planning", "cal", "Planning et paie"], ["formation", "fmHand", "Formation HACCP"], ["equipe", "users", "Équipe et accès"]] },
  { t: "Gestion & ventes", ic: "euro", tone: "ok", items: [["dashboard", "dash", "Tableau de bord"], ["finance", "euro", "Finances"], ["caisse", "cxPlug", "Caisse connectée"], ["tickets", "receipt", "Tickets de caisse"], ["alertes", "alBell", "Alertes"], ["sites", "store", "Plusieurs établissements"], ["import", "imUp", "Import d'un autre logiciel"]] },
  { t: "Clients", ic: "resa", tone: "tm", items: [["resa", "resa", "Réservations en ligne"]] },
];
const OB_FB = { hygPot: "spray", ctBadge: "shield", ctDoc: "list", ctRecall: "alert", sdProbe: "therm", hygBin: "trash", fmHand: "book", cxPlug: "receipt", alBell: "alert", imUp: "upload", resa: "cal" };

const OB = {
  st: null,
  /* ───────────── entry points ───────────── */
  /* js/auth.js, right after the restaurant doc and the gérant membership are written: the app opens on this flow */
  handoff(rid, C, name) {
    obSS.set("gg-ob", rid);
    if (typeof AUTH !== "undefined" && AUTH.celebrate) AUTH.celebrate(`Bienvenue${name ? ", " + firstName(name) : ""} !`, `${(C && C.name) || "Votre restaurant"} · on installe la cuisine`, rid);
    else if (typeof AUTH !== "undefined") AUTH.enter(rid);
  },
  /* Réglages → « Compléter la fiche du restaurant » */
  open(from) { this.start({ mode: "complete", from: from || "reglages" }); SFX.tap(); buzz(5); go("onboard"); },
  start(opts = {}) {
    const r = S.resto || {}, meDoc = (S.members || []).find((m) => m.id === S.me.id) || {};
    const mode = opts.mode || (S.rid && S.resto ? "complete" : "create");
    const d = { name: r.name || "", site: r.site || "", logo: r.logo || "", type: r.type || "", address: r.address || "", phone: r.phone || "", covers: r.covers ? String(r.covers) : "", me: meDoc.name || S.me.name || "", photo: meDoc.photo || "", more: !!(r.address || r.phone || r.covers), nw: null, added: [], gone: [], team: [], inv: null, skipped: {}, done: {}, tools: Array.isArray(r.setupTodo) ? r.setupTodo.filter((k) => obTool(k)) : [], ans: r.setupAns && typeof r.setupAns === "object" ? JSON.parse(JSON.stringify(r.setupAns)) : {}, tq: 0, tp: "q" };
    this.st = { mode, step: Math.max(0, Math.min(OB_LAST, opts.step || 0)), dir: 1, from: opts.from || "", busy: false, d, ret: false, rush: false };
  },
  ensure() { if (!this.st || (this.st.mode === "create" && S.resto)) this.start({ from: this.st ? this.st.from : "boot" }); return this.st; },
  types() { return typeof AU_TYPES !== "undefined" ? AU_TYPES : OB_TYPES; },
  typeLabel(k) { const t = this.types().find((x) => x[0] === k); return t ? t[1] : ""; },
  local() { return DB.mode === "local"; },
  cloud() { return DB.mode === "db" && !!DB.uid && typeof AUTH !== "undefined" && !!AUTH.fs; },
  live() { return !!(S.rid && S.resto); },
  cur() { return OB_STEPS[this.st.step]; },
  /* the restaurant's equipment: what the app knows, plus what this flow has just written and is not in S.fridges yet */
  frList() {
    if (!this.live()) return []; const d = this.st.d, ids = new Set(S.fridges.map((f) => f.id));
    return [...S.fridges, ...d.added.filter((f) => !ids.has(f.id))].filter((f) => !d.gone.includes(f.id));
  },
  mates() {
    if (!this.live()) return []; const d = this.st.d, ids = new Set(S.members.map((m) => m.id));
    return [...S.members, ...d.team.filter((m) => !ids.has(m.id))].filter((m) => m.id !== S.me.id && !d.gone.includes(m.id));
  },
  printerName() { try { if (typeof lbPrinterCfg === "function" && S.resto) { const c = lbPrinterCfg(); return c.model ? c.name || OB_PRINTER : ""; } } catch (e) {} const p = S.resto && S.resto.printer; return typeof p === "string" ? p : p && p.model ? OB_PRINTER : ""; },
  labelSet() { return !!(S.resto && S.resto.labelStyle); },
  /* what each step has in place (summary, CTA wording, fiche) */
  has(k) { const d = this.st.d; return k === "resto" ? !!d.name : k === "vous" ? !!d.me : k === "frigos" ? this.frList().length > 0 : k === "etiquettes" ? this.labelSet() : k === "imprimante" ? !!this.printerName() : k === "equipe" ? this.mates().length > 0 || !!d.inv : k === "outils" ? d.tools.length > 0 || Object.keys(d.ans || {}).length > 0 : true; },
  mark() { if (this.st && this.st.from === "boot" && S.rid && S.resto) obSS.set("gg-ob", `${S.rid}|${this.st.step}`); },

  /* ───────────── markup ───────────── */
  shell() {
    const st = this.ensure(); const s = this.cur();
    return `<div class="onb" data-step="${s.k}" data-mode="${st.mode}">
      <header class="onb-top">${this.topHTML()}</header>
      <div class="onb-body">
        <div class="onb-form" id="obForm"><div class="onb-pane" id="obPane">${this.paneHTML()}</div><div class="onb-cta" id="obCta">${this.ctaHTML()}</div></div>
        <aside class="onb-stage" aria-hidden="true"><div class="onb-wall" id="obStageWall">${this.stageWallHTML()}</div>${this.ficheHTML()}<div class="onb-stage-cap">Votre restaurant, en direct</div></aside>
      </div>
    </div>`;
  },
  topHTML() {
    const st = this.st, n = st.step, s = this.cur();
    const canBack = n > 0 && s.k !== "pret";
    const left = canBack ? `<button class="onb-back" data-act="obPrev" aria-label="Retour">${OB_SVG.back}</button>` : st.from === "reglages" && n === 0 ? `<button class="onb-back" data-act="obClose" aria-label="Fermer">${OB_SVG.x}</button>` : `<span class="onb-back onb-brand">${typeof appIcon === "function" ? appIcon(30) : ""}</span>`;
    const prog = `<div class="onb-pg"><div class="onb-pgt"><b>${s.s}</b><span>${n + 1} sur ${OB_STEPS.length}</span></div>
      <ol class="onb-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${OB_STEPS.length}" aria-valuenow="${n + 1}" aria-label="Étape ${n + 1} sur ${OB_STEPS.length} : ${s.t}">${OB_STEPS.map((x, i) => `<li class="${i < n ? "done" : i === n ? "cur" : ""}"><i></i><span>${x.s}</span></li>`).join("")}</ol></div>`;
    const right = s.k !== "pret" ? `<button class="onb-skip" data-act="obSkipAll">Tout passer</button>` : `<span class="onb-skip ph" aria-hidden="true"></span>`;
    return `${left}${prog}${right}`;
  },
  ctaHTML() {
    const s = this.cur(), st = this.st, d = st.d;
    const btn = (tx, act, cls = "") => `<button class="onb-go${cls}${st.busy ? " onb-busy" : ""}" data-act="${act}" id="obGo"><span class="onb-bl">${tx}</span><span class="onb-dots" aria-hidden="true"><i></i><i></i><i></i></span></button>`;
    const skip = (tx = "Passer cette étape") => `<button class="onb-later" data-act="obSkip">${tx}</button>`;
    if (s.k === "frigos" && d.nw) return `${btn(`${OB_SVG.plus}Ajouter ${esc(d.nw.name || obKindName(d.nw.k))}`, "obFrSave")}<button class="onb-later" data-act="obFrCancel">Annuler</button>`;
    if (s.k === "frigos" && !this.frList().length) return btn("Passer cette étape", "obSkip", " light");
    if (s.k === "pret") return btn(`Ouvrir Growth Gusto${OB_SVG.arrow}`, "obFinish");
    if (s.k === "outils" && this.tqList().length) return this.tqCtaHTML(btn);
    const tx = s.k === "vous" && st.mode === "create" ? "Créer mon restaurant" : st.ret ? "Enregistrer" : "Continuer";
    const sec = s.k === "imprimante" && !this.has("imprimante") ? skip("Je n'ai pas encore l'imprimante") : s.opt && !this.has(s.k) ? skip() : "";
    return `${btn(`${tx}${OB_SVG.arrow}`, "obNext")}${sec}`;
  },
  head(t, sub, i = 0) { return `<h2 class="onb-h2 st" style="--i:${i}">${t}</h2>${sub ? `<p class="onb-sub st" style="--i:${i + 1}">${sub}</p>` : ""}`; },
  field(id, label, value, attrs = "", i = 3, hint = "") { return `<label class="onb-f st" style="--i:${i}"><span class="onb-lbl">${label}</span><div class="onb-in"><input class="onb-input" id="${id}" value="${esc(value)}" ${attrs}></div>${hint ? `<em class="onb-hint">${hint}</em>` : ""}</label>`; },
  paneHTML() {
    const st = this.st, d = st.d, s = this.cur(), phone = !obDesk();
    if (s.k === "resto") {
      const dom = obDomain(d.site);
      return `${this.head(st.mode === "create" ? "Créons votre restaurant." : "Votre restaurant.", "Seul le nom est obligatoire.")}
        ${this.field("obName", "Nom du restaurant", d.name, 'autocomplete="organization" maxlength="80" placeholder="Chemin des Sarments" enterkeyhint="next"', 2)}
        <div class="onb-f st" style="--i:3"><span class="onb-lbl" id="obTypeL">Type de cuisine</span><div class="onb-chips" role="radiogroup" aria-labelledby="obTypeL">${this.types().map(([k, t]) => `<button type="button" class="onb-chip${d.type === k ? " on" : ""}" role="radio" aria-checked="${d.type === k}" data-act="obType" data-v="${k}">${t}</button>`).join("")}</div></div>
        ${this.field("obSite", "Site web", d.site, 'type="url" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="chemindessarments.fr" enterkeyhint="next"', 4, "On récupère votre logo tout seul.")}
        <div class="onb-logo st" style="--i:5" id="obLogo" data-src="${esc(d.logo ? (d.logo.startsWith("data:") ? "img" : "web") : "")}">
          <span class="onb-logo-box" id="obLogoBox">${this.logoHTML()}</span>
          <div class="onb-logo-tx"><b id="obLogoT">${d.logo ? "Logo trouvé" : dom ? "Recherche du logo…" : "Votre logo"}</b><span id="obLogoS">${d.logo ? "Vous pouvez en importer un autre." : dom ? esc(dom) : "Depuis votre site, ou une image."}</span></div>
          <button type="button" class="onb-chip onb-logo-btn" data-act="obLogoPick">${OB_SVG.image}<span>${d.logo && d.logo.startsWith("data:") ? "Changer" : "Importer"}</span></button>
        </div>
        <button type="button" class="onb-more-btn st${d.more ? " on" : ""}" style="--i:6" data-act="obMore" aria-expanded="${d.more}" aria-controls="obMoreBox"><span>Adresse, téléphone, couverts</span><em>facultatif</em>${OB_SVG.down}</button>
        <div class="onb-more${d.more ? " on" : ""}" id="obMoreBox"><div class="onb-more-in">
          ${this.field("obAddr", "Adresse", d.address, 'autocomplete="street-address" maxlength="140" placeholder="12 rue des Sarments, Bordeaux" enterkeyhint="next"', 0)}
          <div class="onb-row2">
            ${this.field("obPhone", "Téléphone", d.phone, 'type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="05 56 00 00 00" enterkeyhint="next"', 0)}
            ${this.field("obCovers", "Couverts / jour", d.covers, 'inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="42" enterkeyhint="done"', 0)}
          </div></div></div>
        ${phone ? `<div class="onb-prevwrap st" style="--i:7">${this.ficheHTML(true)}</div>` : ""}`;
    }
    if (s.k === "vous") {
      const me = firstName(d.me);
      return `${this.head(me ? `Enchanté, ${esc(me)}.` : "Et vous ?", "Votre prénom signe chaque relevé.")}
        <div class="onb-you st" style="--i:2">
          <button type="button" class="onb-ava" data-act="obPhotoPick" aria-label="Ajouter une photo" id="obAva">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : `<span class="onb-ava-ini" id="obAvaIni">${esc(initials(d.me || "?"))}</span>`}<span class="onb-ava-cam">${OB_SVG.camera}</span></button>
          <div class="onb-you-tx"><b>${d.photo ? "Photo ajoutée" : "Une photo ?"}</b><span>${d.photo ? "Touchez pour la changer." : "Facultatif."}</span></div>
        </div>
        ${this.field("obMe", "Votre prénom", d.me, 'autocomplete="given-name" maxlength="40" placeholder="Marceau" enterkeyhint="done"', 3)}
        <div class="onb-role st" style="--i:4"><span class="onb-role-ic">${OB_SVG.store}</span><div><b>Gérant</b><span>Tout voir, tout régler, inviter l'équipe.</span></div></div>`;
    }
    if (s.k === "frigos") {
      const n = this.frList().length;
      return `<div id="obFrHead">${this.frHeadHTML()}</div>
        <div class="onb-kit st${n ? "" : " empty"}" style="--i:2" id="obKit">${this.kitHTML()}</div>
        <div class="onb-frzone st" style="--i:3" id="obFrZone">${d.nw ? this.newHTML() : this.kindsHTML()}</div>
        ${VIEWS.sondes ? `<p class="onb-sdnote st" style="--i:4"><span class="onb-tool-ic">${obI("sdProbe", "therm")}</span><span><b>Vous avez des sondes ?</b> Vous les brancherez après.</span></p>` : ""}`;
    }
    if (s.k === "etiquettes") {
      let ext = ""; try { if (typeof window.lbStylePickerHTML === "function") ext = window.lbStylePickerHTML() || ""; } catch (e) { console.warn("lbStylePickerHTML", e); ext = ""; }
      return `${this.head("Le look de vos étiquettes.", "Choisissez un design. Il se change à tout moment.")}
        ${ext ? `<div class="onb-ext st" style="--i:2" id="obExt">${ext}</div>` : `<div class="onb-ph st" style="--i:2">${OB_LABEL_ART}<b>Design par défaut</b><span>Le design se choisit dans Réglages → Imprimante.</span></div>`}`;
    }
    if (s.k === "imprimante") {
      let ext = "";
      try { if (typeof window.lbWizardHTML === "function") ext = window.lbWizardHTML({ inOnboarding: true }) || ""; else if (typeof lbPrinterStepHTML === "function") ext = lbPrinterStepHTML() || ""; } catch (e) { console.warn("printer step", e); ext = ""; }
      return `${this.head("Branchons l'imprimante.", `${OB_PRINTER} : on vérifie ensemble qu'elle imprime.`)}
        ${ext ? `<div class="onb-ext st" style="--i:2" id="obExt">${ext}</div>` : `<div class="onb-ph st" style="--i:2"><span class="onb-ph-ic">${OB_SVG.printer}</span><b>${OB_PRINTER}</b><span>Se configure dans Réglages → Imprimante.</span></div>`}`;
    }
    if (s.k === "equipe") {
      const cloud = this.cloud(), perms = this.perms();
      return `${this.head("Qui travaille avec vous ?", cloud ? "Ajoutez chaque personne, choisissez ce qu'elle voit, et invitez-la par e-mail ou par code." : "Chacun signe ses relevés en touchant son prénom.")}
        <div class="onb-team st" style="--i:2"><div class="onb-mates" id="obTeamList">${this.teamHTML()}</div>
          ${perms ? `<button type="button" class="onb-addp" data-act="obPerson"><span class="onb-addp-ic">${OB_SVG.userAdd}</span><span class="onb-addp-tx"><b>Ajouter une personne</b><em>${cloud ? "Gérant ou équipier · invitation par e-mail ou code" : "Gérant ou équipier · ce qu'il voit"}</em></span>${OB_SVG.chev}</button>`
            : `<div class="onb-addrow"><div class="onb-in"><input class="onb-input" id="obTeamIn" placeholder="Son prénom" autocomplete="off" maxlength="40" enterkeyhint="done" aria-label="Prénom d'un équipier"></div><button type="button" class="onb-chip onb-addbtn" data-act="obTeamAdd">${OB_SVG.plus}<span>Ajouter</span></button></div>`}</div>
        ${cloud ? `<div class="onb-inv-h st" style="--i:3">Ou un code pour toute l'équipe</div><div class="onb-inv st" style="--i:3" id="obInv">${this.invHTML()}</div>` : ""}`;
    }
    if (s.k === "outils" && this.tqList().length) return this.tqHTML();
    if (s.k === "outils") {
      const L = OB_TOOLS.filter((x) => !x.hide && obToolOk(x)), wide = L.filter((x) => x.wide), grid = L.filter((x) => !x.wide);
      return `${this.head("Et en plus ?", "Touchez ce qui vous intéresse. On vous le prépare.")}
        ${wide.map((x) => this.toolHTML(x, 2)).join("")}
        <div class="onb-tools st" style="--i:3" role="group" aria-label="Vos outils">${grid.map((x, i) => this.toolHTML(x, i)).join("")}</div>
        <p class="onb-fine onb-tools-n st" style="--i:4" id="obToolsN">${this.toolsCount()}</p>`;
    }
    if (s.k === "pret") {
      const me = firstName(d.me || S.me.name);
      const sum = this.summary(), todo = sum.filter((r) => !r.ok).length;
      return `<div class="onb-seal st" style="--i:0">${OB_SVG.seal}</div>
        ${this.head(`C'est prêt${me ? ", " + esc(me) : ""}.`, todo ? `${esc(d.name || S.resto?.name || "Votre restaurant")} est en place. Touchez une ligne pour la finir.` : `${esc(d.name || S.resto?.name || "Votre restaurant")} est entièrement installé.`, 1)}
        <div class="onb-sum st" style="--i:3">${sum.map((r) => { const tag = r.ok ? "div" : "button"; return `<${tag} class="onb-sumr ${r.ok ? "ok" : "later"}"${r.ok ? "" : ` type="button" data-act="obGoStep" data-v="${r.k}"`}><i>${r.ic}</i><b>${r.t}</b><span>${r.s}</span>${r.ok ? "" : `<em class="onb-sumgo">${d.skipped[r.k] ? "À faire" : "Ajouter"}${OB_SVG.chev}</em>`}</${tag}>`; }).join("")}</div>
        ${this.todoListHTML()}
        <section class="onb-feats st" style="--i:5" aria-labelledby="obFeatsT"><h3 class="onb-h3" id="obFeatsT">Ce que Growth Gusto fait pour vous</h3>${this.featsHTML("obOpen")}<p class="onb-fine">Tout se retrouve dans le menu, à tout moment.</p></section>`;
    }
    return "";
  },
  frHeadHTML() {
    const n = this.frList().length;
    return n ? this.head(n === 1 ? "Votre premier frigo est là." : `${obPl(n, "équipement")}, bien rangés.`, "Ajoutez-en un autre, ou continuez.") : this.head("Ajoutez votre premier frigo.", "Choisissez son type : on règle les températures pour vous.");
  },
  /* the equipment, drawn on the violet wall like the home hero; the ones added here can be taken back */
  kitHTML() {
    const list = this.frList(), d = this.st.d;
    if (!list.length) return `<div class="onb-kit-row">${[0, 1, 2].map((i) => `<span class="onb-ghost g${i}" aria-hidden="true"></span>`).join("")}</div>`;
    return `<div class="onb-kit-row">${list.map((f, i) => { const k = obKindOf(f), t = obFrType(k), mine = d.added.some((x) => x.id === f.id), fresh = f.id === d.pop;
      const lo = isNaN(+f.min) ? t.min : +f.min, hi = isNaN(+f.max) ? t.max : +f.max, show = Math.min(Math.max(t.t, lo), hi);
      return `<div class="hm-dfr ok ${obShape(k)} onb-kf${fresh ? " pop" : ""}" style="--j:${fresh ? 0 : i}" title="${esc(f.name)} · ${obDeg(f.min)} à ${obDeg(f.max)} °C" data-fid="${esc(f.id)}"><span class="bx"><span class="lcd">${esc(obDeg(show))}°</span>${obShape(k) === "cg" ? "" : `<span class="hd"></span>`}</span><span class="nm">${esc(f.name)}</span>${mine ? `<button type="button" class="onb-kx" data-act="obFrDel" data-id="${esc(f.id)}" aria-label="Retirer ${esc(f.name)}">${OB_SVG.x}</button>` : ""}</div>`; }).join("")}
      <button type="button" class="hm-dfr plus onb-kplus" data-act="obFrMore" aria-label="Ajouter un autre équipement"><span class="bx">${OB_SVG.plus}</span><span class="nm">Ajouter</span></button></div>`;
  },
  kindsHTML() {
    const n = this.frList().length;
    return `<span class="onb-lbl onb-kinds-l">${n ? "Ajouter un autre" : "Quel type ?"}</span><div class="onb-kinds" role="list">${OB_KINDS.map(([k, t], i) => `<button type="button" class="onb-kind" role="listitem" data-act="obKind" data-v="${k}" style="--j:${i}"><span class="onb-art">${obArt[k]}</span><b>${t}</b></button>`).join("")}</div>`;
  },
  newHTML() {
    const nw = this.st.d.nw; const isCg = nw.k === "congel";
    return `<div class="onb-new" id="obNew">
      <div class="onb-new-h"><span class="onb-art lg">${obArt[nw.k]}</span><div class="onb-new-t"><span>Nouvel équipement</span><b>${obKindName(nw.k)}</b></div><button type="button" class="onb-new-x" data-act="obFrCancel" aria-label="Annuler">${OB_SVG.x}</button></div>
      <label class="onb-f"><span class="onb-lbl">Son nom</span><div class="onb-in"><input class="onb-input" id="obFrName" value="${esc(nw.name)}" maxlength="40" autocomplete="off" enterkeyhint="done"></div></label>
      <div class="onb-temps">
        ${[["min", "Minimum"], ["max", "Maximum"]].map(([w, l]) => `<div class="onb-tst"><span class="onb-lbl">${l}</span><div class="onb-stp"><button type="button" data-act="obTemp" data-v="${w}:-1" aria-label="${l} moins un degré">${OB_SVG.minus}</button><b id="obT${w}" class="onb-tv">${obDeg(nw[w])}<small>°C</small></b><button type="button" data-act="obTemp" data-v="${w}:1" aria-label="${l} plus un degré">${OB_SVG.plus}</button></div></div>`).join("")}
      </div>
      <p class="onb-fine" id="obTHint">${isCg ? `Alerte au-dessus de ${obDeg(nw.max)} °C.` : `Alerte hors de ${obDeg(nw.min)} à ${obDeg(nw.max)} °C.`}</p>
    </div>`;
  },
  /* step « Vos outils »: one card = one tap, « Plus tard » until chosen */
  toolHTML(x, i) {
    const on = this.st.d.tools.includes(x.k);
    return `<button type="button" class="onb-tool t-${x.tone}${x.wide ? " wide st" : ""}${on ? " on" : ""}" ${x.wide ? `style="--i:${i}"` : `style="--j:${i}"`} data-act="obTool" data-v="${x.k}" aria-pressed="${on}">
      <span class="onb-tool-ic">${obI(x.ic, x.fb)}</span><span class="onb-tool-tx"><b>${x.t}</b><span>${x.s}</span></span>
      <em class="onb-tool-st"><span class="no">${x.wide ? "Importer" : "Plus tard"}</span><span class="yes">${OB_SVG.check}${x.wide ? "À importer" : "Choisi"}</span></em></button>`;
  },
  toolsCount() { const n = this.st.d.tools.length; return n ? `${n} à faire après l'installation. On vous guide.` : "Rien n'est obligatoire : tout reste dans le menu."; },
  /* « À faire pour bien démarrer » on « C'est prêt »: the chosen tools not set up yet */
  todoListHTML() {
    const L = this.st.d.tools.map(obTool).filter((x) => obToolOk(x) && !x.done());
    if (!L.length) return "";
    return `<section class="onb-todo st" style="--i:4" aria-labelledby="obTodoT"><h3 class="onb-h3" id="obTodoT">À faire pour bien démarrer</h3>
      <div class="onb-todo-l">${L.map((x) => `<button type="button" class="onb-todor t-${x.tone}" data-act="obOpen" data-v="${x.k}"><span class="onb-tool-ic">${obI(x.ic, x.fb)}</span><span class="onb-tool-tx"><b>${esc(obTx(x.todo))}</b><span>${esc(obTx(x.ts))}</span></span>${OB_SVG.chev}</button>`).join("")}</div></section>`;
  },
  featsHTML(act) {
    return `<div class="onb-fgrid">${OB_FEATS.map((g) => { const it = g.items.filter(([r]) => (r === "import" ? obToolOk(obTool("import")) : !!VIEWS[r]) && obPerm(r)); if (!it.length) return "";
      return `<div class="onb-fg t-${g.tone}"><div class="onb-fg-h"><span class="onb-tool-ic">${obI(g.ic, OB_FB[g.ic] || "grid")}</span><b>${g.t}</b></div><div class="onb-fg-l">${it.map(([r, ic, t]) => `<button type="button" class="onb-fi2" data-act="${act}" data-v="r:${r}">${obI(ic, OB_FB[ic] || "grid")}<span>${t}</span></button>`).join("")}</div></div>`; }).join("")}</div>`;
  },
  logoHTML() {
    const d = this.st.d, n = d.name || "";
    if (d.logo) return `<img src="${esc(d.logo)}" alt="" referrerpolicy="no-referrer">`;
    return `<span class="onb-mono">${esc(initials(n || "R"))}</span>`;
  },
  perms() { return typeof window.PERMS !== "undefined" && window.PERMS && typeof window.PERMS.flow === "function"; },
  teamHTML() {
    const d = this.st.d, mates = this.mates(), meName = d.me || S.me.name || "Vous";
    const chip = (m, i, me) => { const mine = d.team.some((t) => t.id === m.id); return `<span class="onb-mate${m.id === d.pop ? " pop" : ""}" style="--c:${esc(m.color || PALETTE[(i + 1) % PALETTE.length])}">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : `<i>${esc(initials(m.name || "?"))}</i>`}<span class="onb-mate-n">${esc(firstName(m.name) || m.name || "?")}<em>${me ? "Gérant · vous" : esc((typeof ROLES !== "undefined" && ROLES[m.role]) || "Équipe")}</em></span>${mine ? `<button type="button" data-act="obTeamDel" data-id="${esc(m.id)}" aria-label="Retirer ${esc(m.name)}">${OB_SVG.x}</button>` : ""}</span>`; };
    const POS = { cuisine: "Cuisine", salle: "Salle", plonge: "Plonge", bar: "Bar", second: "Second" };
    const inv = (d.invs || []).map((v, i) => `<span class="onb-mate onb-mate-inv${v.code === d.pop ? " pop" : ""}" style="--c:${esc(PALETTE[(mates.length + i + 1) % PALETTE.length])}">${v.photo ? `<img src="${esc(v.photo)}" alt="">` : `<i>${esc(initials(v.name || "?"))}</i>`}<span class="onb-mate-n">${esc(firstName(v.name) || v.name || "?")}<em>${v.role === "gerant" ? "Gérant" : esc(POS[v.poste] || "Équipe")} · ${v.email ? "invité par e-mail" : "invité"}</em></span></span>`).join("");
    return chip({ id: S.me.id, name: meName, photo: d.photo, color: S.me.color || PALETTE[0] }, -1, true) + mates.map((m, i) => chip(m, i, false)).join("") + inv;
  },
  invHTML() {
    const d = this.st.d, inv = d.inv;
    if (d.invErr) return `<div class="onb-inv-in"><div class="onb-inv-tx"><b>Invitation indisponible</b><span>${esc(d.invErr)}</span></div><button type="button" class="onb-chip" data-act="obInvRetry">Réessayer</button></div>`;
    if (!inv) return `<div class="onb-inv-in"><span class="onb-qr onb-qr-wait" aria-hidden="true"></span><div class="onb-inv-tx"><b>Préparation du lien…</b><span>Un code à 8 caractères, valable 7 jours.</span></div></div>`;
    const link = typeof AUTH !== "undefined" && AUTH.invLink ? AUTH.invLink(inv.code) : `${location.origin}${location.pathname}?invite=${inv.code}`;
    const code = typeof auFmtCode === "function" ? auFmtCode(inv.code) : inv.code;
    return `<div class="onb-inv-in"><span class="onb-qr">${typeof AUTH !== "undefined" && AUTH.qr ? AUTH.qr(link) : ""}</span>
        <div class="onb-inv-tx"><span class="onb-lbl">Code d'invitation · Équipe</span><b class="onb-code">${esc(code).split("").map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</b><span>Valable 7 jours.</span></div></div>
      <div class="onb-inv-acts">${navigator.share ? `<button type="button" class="onb-chip on" data-act="obInvShare">${OB_SVG.share}<span>Partager</span></button>` : ""}<button type="button" class="onb-chip${navigator.share ? "" : " on"}" data-act="obInvCopy" data-v="link">${OB_SVG.copy}<span>Copier le lien</span></button><button type="button" class="onb-chip" data-act="obInvCopy" data-v="code">${OB_SVG.copy}<span>Copier le code</span></button></div>`;
  },
  summary() {
    const d = this.st.d, frs = this.frList(), mates = this.mates(), pr = this.printerName();
    const resto = [d.type ? this.typeLabel(d.type) : "", d.logo ? "logo" : "", d.address ? "adresse" : ""].filter(Boolean);
    return [
      { k: "resto", ic: OB_SVG.store, t: d.name || "Restaurant", s: resto.length ? resto.join(" · ") : "Nom du restaurant", ok: !!d.name },
      { k: "vous", ic: OB_SVG.users, t: d.me ? `${firstName(d.me)} · gérant` : "Vous", s: d.photo ? "Prénom et photo" : "Prénom", ok: !!d.me },
      { k: "frigos", ic: OB_SVG.snow, t: "Équipements", s: frs.length ? `${obPl(frs.length, "équipement")} à relever` : "Aucun pour l'instant", ok: frs.length > 0 },
      { k: "etiquettes", ic: OB_SVG.tag, t: "Étiquettes", s: this.labelSet() ? "Design choisi" : "Design par défaut", ok: this.labelSet() },
      { k: "imprimante", ic: OB_SVG.printer, t: "Imprimante", s: pr || "Étiquettes à l'écran en attendant", ok: !!pr },
      { k: "equipe", ic: OB_SVG.userAdd, t: "Équipe", s: [mates.length ? obPl(mates.length, "personne") : "", (d.invs || []).length ? obPl(d.invs.length, "invitation") + " envoyée" + (d.invs.length > 1 ? "s" : "") : d.inv ? "code d'équipe prêt" : ""].filter(Boolean).join(" · ") || "Vous seul pour l'instant", ok: mates.length > 0 || !!d.inv || !!(d.invs || []).length },
    ];
  },
  /* the drawn kitchen under the fiche on desktop: the real equipment, or soft outlines before the first one */
  stageWallHTML() {
    const list = this.st ? this.frList().slice(0, 5) : [];
    if (!list.length) return [0, 1, 2].map((i) => `<span class="onb-dfr ghost g${i}"></span>`).join("");
    return list.map((f, i) => { const k = obKindOf(f), t = obFrType(k); return `<span class="onb-dfr ${obShape(k)}" style="--j:${i}"><b>${esc(obDeg(t.t))}°</b></span>`; }).join("");
  },
  /* the live card of the restaurant (desktop stage; compact on the phone's first step) */
  ficheHTML(compact) {
    const st = this.ensure(), d = st.d, s = this.cur();
    const frs = this.frList(), nF = frs.length, mates = this.mates();
    const team = [d.me || S.me.name || "Vous", ...mates.map((m) => m.name || "?")];
    const row = (k, ic, t, v, ph) => `<div class="onb-frow${s.k === k ? " cur" : ""}${v ? " set" : ""}" data-k="${k}"><span class="onb-fi">${ic}</span><span class="onb-ft">${t}</span><span class="onb-fv">${v ? esc(v) : `<i>${ph}</i>`}</span></div>`;
    return `<div class="onb-fiche${compact ? " compact" : ""}" data-cur="${s.k}">
      <div class="onb-fh"><span class="onb-flogo">${this.logoHTML()}</span><div class="onb-fn"><b class="${d.name ? "" : "empty"}">${esc(d.name || "Votre restaurant")}</b><em>${esc([this.typeLabel(d.type), d.covers ? `${d.covers} couverts/jour` : ""].filter(Boolean).join(" · ") || "Registre HACCP · relevés · étiquettes")}</em></div><span class="onb-ftag">Fiche</span></div>
      <div class="onb-frows">
        ${row("resto", OB_SVG.pin, "Adresse", d.address, "À compléter")}
        ${row("vous", OB_SVG.store, "Gérant", d.me ? firstName(d.me) : "", "Votre prénom")}
        ${row("frigos", OB_SVG.snow, "Frigos", nF ? `${nF} · ${frs.slice(0, 3).map((f) => f.name).join(", ")}${nF > 3 ? "…" : ""}` : "", "Aucun pour l'instant")}
        ${row("etiquettes", OB_SVG.tag, "Étiquettes", this.labelSet() ? "Design choisi" : "", "Par défaut")}
        ${row("imprimante", OB_SVG.printer, "Imprimante", this.printerName(), "Plus tard")}
        <div class="onb-frow${s.k === "equipe" ? " cur" : ""} set" data-k="equipe"><span class="onb-fi">${OB_SVG.users}</span><span class="onb-ft">Équipe</span><span class="onb-fv onb-fteam">${team.slice(0, 5).map((n, i) => `<b style="--c:${esc(PALETTE[i % PALETTE.length])}" title="${esc(n)}">${esc(initials(n))}</b>`).join("")}${team.length > 5 ? `<span>+${team.length - 5}</span>` : ""}${d.inv ? `<span class="onb-fpill">invitation</span>` : ""}</span></div>
        ${row("outils", OB_SVG.plus, "Outils", d.tools.map((k) => (obTool(k) || {}).n).filter(Boolean).join(", "), "Plus tard")}
      </div>
    </div>`;
  },

  /* ───────────── painting ───────────── */
  root() { return $("#viewport .view:not(.leave) .onb"); },
  /* step swap: the old pane slides away while the new one rises in, line by line */
  paint(first) {
    const root = this.root(); if (!root) return;
    const pane = $("#obPane", root), form = $("#obForm", root), reduce = obReduce();
    if (!first && !reduce && pane.childElementCount) {
      const old = pane.cloneNode(true); old.removeAttribute("id"); old.className = "onb-pane onb-leave" + (this.st.dir < 0 ? " back" : ""); old.inert = true;
      $$("[id],[for]", old).forEach((n) => { n.removeAttribute("id"); n.removeAttribute("for"); });
      old.style.top = pane.offsetTop + "px"; form.appendChild(old); setTimeout(() => old.remove(), 300);
    }
    root.dataset.step = this.cur().k; pane.classList.toggle("onb-later-in", !first); pane.classList.toggle("onb-rev", this.st.dir < 0);
    pane.innerHTML = this.paneHTML(); $(".onb-top", root).innerHTML = this.topHTML(); $("#obCta", root).innerHTML = this.ctaHTML();
    if (!first) { const v = root.closest(".view"); [v, form].forEach((x) => { if (x && x.scrollTop > 0) x.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }); }
    this.fiche(); this.after(first);
  },
  after(first) {
    const s = this.cur(), root = this.root(); if (!root) return;
    if (s.k === "resto" && !this.st.d.logo && obDomain(this.st.d.site)) this.logoFetch(obDomain(this.st.d.site));
    if (s.k === "equipe" && this.cloud() && !this.st.d.inv && !this.st.d.invErr) this.invite();
    if (s.k === "etiquettes" || s.k === "imprimante") { const ex = $("#obExt", root); try { const h = s.k === "etiquettes" ? window.lbStylePickerAfter : window.lbWizardAfter; if (ex && typeof h === "function") h(ex); } catch (e) { console.warn("ob ext after", e); } }
    if (s.k === "pret") { if (!first || this.st.from !== "boot") { SFX.done(); buzz([12, 40, 12, 40, 30]); } setTimeout(() => { const r = $(".onb-seal", root); if (r) { const b = r.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2); } }, obReduce() ? 0 : 420); }
    this.mark();
    /* autofocus on desktop only: a phone keyboard must not jump up on its own */
    const f = { resto: "#obName", vous: "#obMe" }[s.k];
    if (f && obDesk()) setTimeout(() => { const i = $(f, root); if (i && !i.value) i.focus({ preventScroll: true }); }, first ? 500 : 380);
  },
  /* the fiche updates in place, row by row, so a keystroke never replays the card's animations */
  fiche() {
    const root = this.root(); if (!root || !this.st) return;
    $$(".onb-stage .onb-fiche, .onb-prevwrap .onb-fiche", root).forEach((el) => {
      const compact = el.classList.contains("compact"); const t = document.createElement("div"); t.innerHTML = this.ficheHTML(compact); const nu = t.firstElementChild;
      if (el.dataset.cur !== nu.dataset.cur) el.dataset.cur = nu.dataset.cur;
      const a = [$(".onb-fh", el), ...$$(".onb-frow", el)], b = [$(".onb-fh", nu), ...$$(".onb-frow", nu)];
      if (a.length !== b.length) { el.outerHTML = nu.outerHTML; return; }
      a.forEach((x, i) => { if (x.outerHTML !== b[i].outerHTML) x.replaceWith(b[i]); });
    });
    const w = $("#obStageWall", root); if (w) { const h = this.stageWallHTML(); if (w._h !== h) { w._h = h; w.innerHTML = h; } }
  },
  /* data arrived (fridges, members, the resto doc written by labels.js): refresh the parts that show it, nothing else */
  soft() {
    const root = this.root(); if (!root || !this.st) return; const s = this.cur();
    const cta = $("#obCta", root); if (cta && !this.st.busy) { const h = this.ctaHTML(); if (cta._h !== h) { cta._h = h; cta.innerHTML = h; } }
    if (s.k === "frigos") this.kitPaint();
    if (s.k === "outils") this.tqLivePaint();
    if (s.k === "equipe") { const L = $("#obTeamList", root); if (L) { const h = this.teamHTML(); if (L._h !== h) { L._h = h; L.innerHTML = h; } } }
    this.fiche();
  },
  kitPaint() {
    const root = this.root(); if (!root) return;
    const kit = $("#obKit", root), head = $("#obFrHead", root), n = this.frList().length;
    if (kit) { const key = this.frList().map((f) => f.id + f.name).join("|") + "#" + (this.st.d.pop || ""); if (kit._k !== key) { kit._k = key; kit.innerHTML = this.kitHTML(); kit.classList.toggle("empty", !n); } }
    if (head) { const h = this.frHeadHTML(); if (head._h !== h) { head._h = h; head.innerHTML = h; } }
    const lbl = $(".onb-kinds-l", root); if (lbl) lbl.textContent = n ? "Ajouter un autre" : "Quel type ?";
    const cta = $("#obCta", root); if (cta) { const h = this.ctaHTML(); cta._h = h; cta.innerHTML = h; }
  },
  shake(el) { if (!el) return; const t = el.closest(".onb-f") || el; t.classList.remove("onb-shake"); void t.offsetWidth; t.classList.add("onb-shake"); SFX.err(); buzz([20, 40, 20]); setTimeout(() => t.classList.remove("onb-shake"), 460); },
  setBusy(on) { this.st.busy = on; const b = $("#obGo"); if (b) { b.classList.toggle("onb-busy", on); b.toggleAttribute("disabled", on); } },

  /* ───────────── logo: favicon of the site, then DuckDuckGo, then a monogram ───────────── */
  logoFetch(dom) {
    const d = this.st.d; if (!dom || d.logo && d.logo.startsWith("data:")) return;
    const seq = this._logoSeq = (this._logoSeq || 0) + 1;
    const T = $("#obLogoT"), Sx = $("#obLogoS"); if (T) { T.textContent = "Recherche du logo…"; Sx.textContent = dom; }
    const urls = [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=256`, `https://icons.duckduckgo.com/ip3/${encodeURIComponent(dom)}.ico`];
    const tryAt = (i) => {
      if (seq !== this._logoSeq || !this.st) return;
      if (i >= urls.length) { d.logo = ""; d.logoDom = dom; this.logoPaint(); if (T) { T.textContent = "Pas de logo trouvé"; Sx.textContent = "Importez une image, ou gardez le monogramme."; } return; }
      const img = new Image(); img.referrerPolicy = "no-referrer";
      img.onload = () => { if (seq !== this._logoSeq || !this.st) return; if (img.naturalWidth < 24) return tryAt(i + 1); d.logo = urls[i]; d.logoDom = dom; this.logoPaint(true); if (T) { T.textContent = "Logo trouvé"; Sx.textContent = `Depuis ${dom}`; } SFX.tick(); buzz(4); };
      img.onerror = () => tryAt(i + 1);
      img.src = urls[i];
    };
    tryAt(0);
  },
  logoPaint(pop) {
    const box = $("#obLogoBox"); if (box) { box.innerHTML = this.logoHTML(); if (pop) { box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop"); } }
    const lg = $("#obLogo"); if (lg) { lg.dataset.src = this.st.d.logo ? (this.st.d.logo.startsWith("data:") ? "img" : "web") : ""; const b = $(".onb-logo-btn span", lg); if (b) b.textContent = this.st.d.logo && this.st.d.logo.startsWith("data:") ? "Changer" : "Importer"; }
    this.fiche();
  },
  /* a small JPEG data URL (≤ 40 KB) from a picked image */
  async smallImage(file, px) {
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
    const c = document.createElement("canvas"); c.width = c.height = px; const x = c.getContext("2d");
    const k = Math.max(px / img.width, px / img.height), w = img.width * k, h = img.height * k; x.fillStyle = "#fff"; x.fillRect(0, 0, px, px); x.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
    try { URL.revokeObjectURL(img.src); } catch (e) {}
    for (const q of [0.86, 0.72, 0.58, 0.45]) { const u = c.toDataURL("image/jpeg", q); if (u.length <= 40 * 1024) return u; }
    return c.toDataURL("image/jpeg", 0.35);
  },
  async pickInto(key, px) {
    SFX.tap(); const [f] = await pickImage(true); if (!f) return null;
    try { const u = await this.smallImage(f, px); this.st.d[key] = u; SFX.ok(); buzz(8); return u; } catch (e) { console.warn("image", e); SFX.err(); toast("Image illisible. Essayez une autre photo.", "err"); return null; }
  },

  /* ───────────── invites (accounts) ───────────── */
  async invite() {
    const d = this.st.d; if (d.invBusy || !this.cloud()) return; d.invBusy = true; d.invErr = "";
    const code = auCode(8), now = Date.now();
    const doc = { rid: S.rid, restoName: d.name || S.resto?.name || "", role: "equipe", createdBy: S.me.id, createdByName: d.me || S.me.name || "", createdAt: now, expiresAt: now + 7 * 864e5, uses: 0 };
    try { await AUTH.timeout(AUTH.fs.collection("invites").doc(code).set(doc), 12000); d.inv = { code, ...doc }; logEvent("team", "a créé une invitation (Équipe)"); SFX.ok(); }
    catch (e) { console.warn("invite", e); d.invErr = e && e.code === "permission-denied" ? "Seul un gérant peut inviter." : "Vérifiez le réseau, puis réessayez."; }
    d.invBusy = false; const box = $("#obInv"); if (box) box.innerHTML = this.invHTML(); this.soft();
  },
  invText(what) { const c = this.st.d.inv; if (!c) return ""; return what === "code" ? (typeof auFmtCode === "function" ? auFmtCode(c.code) : c.code) : (AUTH.invLink ? AUTH.invLink(c.code) : `${location.origin}${location.pathname}?invite=${c.code}`); },
  async copy(what) {
    const t = this.invText(what); if (!t) return; let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (x) {} }
    if (ok) { SFX.ok(); buzz(6); toast(what === "code" ? "Code copié" : "Lien copié"); } else toast(t, "info");
  },

  /* ───────────── reading the screen into the state ───────────── */
  collect() {
    const d = this.st.d, root = this.root(); if (!root) return;
    const g = (id) => { const e = $(id, root); return e ? e.value : null; };
    const n = g("#obName"); if (n != null) d.name = n.trim();
    const s = g("#obSite"); if (s != null) d.site = s.trim();
    const a = g("#obAddr"); if (a != null) d.address = a.trim();
    const p = g("#obPhone"); if (p != null) d.phone = p.trim();
    const c = g("#obCovers"); if (c != null) d.covers = c.replace(/\D/g, "").slice(0, 5);
    const m = g("#obMe"); if (m != null) d.me = m.trim();
  },
  restoPatch() {
    const d = this.st.d, r = S.resto || {}; const patch = {};
    const put = (k, v) => { if (v !== "" && v != null && v !== (r[k] ?? "")) patch[k] = v; };
    put("name", d.name); put("site", d.site); put("logo", d.logo); put("type", d.type); put("address", d.address); put("phone", d.phone); put("covers", d.covers ? +d.covers : "");
    return patch;
  },

  /* ───────────── writes ───────────── */
  /* steps 1 and 2 write on « Continuer » once the restaurant exists; the other steps write as they go */
  async commit(k) {
    const st = this.st, d = st.d; if (st.mode !== "complete" || !S.rid) return;
    if (k === "resto") { const p = this.restoPatch(); if (Object.keys(p).length) { await safe(DB.update("restos", S.rid, p)); if (S.resto) Object.assign(S.resto, p); const r = S.restos.find((x) => x.id === S.rid); if (r && r !== S.resto) Object.assign(r, p); } }
    if (k === "vous") {
      const patch = { name: d.me, ...(d.photo ? { photo: d.photo } : {}) };
      const mine = S.members.find((m) => m.id === S.me.id);
      await safe(mine ? DB.update("members", S.me.id, patch) : DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now(), ...patch, ...(this.local() ? { color: S.me.color || PALETTE[0] } : {}) }));
      S.me.name = d.me; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), name: d.me, ...(d.photo ? { avatarUrl: d.photo } : {}) };
      if (this.local()) { try { localStorage.setItem("gg-name", d.me); } catch (e) {} if (typeof ccSaveWho === "function") ccSaveWho(); }
      renderChrome();
    }
    d.done[k] = true;
  },
  /* "create" mode, end of step 2: the restaurant and its gérant, once. A second call (double tap, back, refresh) finds S.resto and stops. */
  finish() {
    if (this._creating) return this._creating;
    this._creating = this._create().finally(() => { this._creating = null; });
    return this._creating;
  },
  async _create() {
    const st = this.st, d = st.d; if (st.mode !== "create" || S.resto) { st.mode = "complete"; return true; }
    const name = d.name.trim(), me = d.me.trim(); if (!name || !me) return false;
    S.me.name = me; S.me.color = S.me.color || PALETTE[0]; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), ...S.me, ...(d.photo ? { avatarUrl: d.photo } : {}) }; try { localStorage.setItem("gg-name", me); } catch (e) {}
    const rid = "r" + Date.now().toString(36) + (typeof auCode === "function" ? auCode(4).toLowerCase() : Math.random().toString(36).slice(2, 6)), prev = S.rid; S.rid = rid;
    try {
      const doc = { name, createdAt: Date.now(), by: S.me.id }; const p = this.restoPatch(); delete p.name; Object.assign(doc, p);
      await safe(DB.set("restos", rid, doc)); /* accounts: DB.set writes the resto, the gérant membership and users/{uid}.restos in one batch */
      attachedRid = null; memberChecked = true; if (typeof CC !== "undefined") CC.last = Date.now(); attachResto();
      await safe(DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now(), name: me, color: S.me.color || PALETTE[0], ...(d.photo ? { photo: d.photo } : {}) }));
      await logEvent("team", `a créé ${name}`);
      if (!S.resto || S.resto.id !== rid) { const r0 = S.restos.find((r) => r.id === rid); S.resto = r0 || { id: rid, ...doc }; if (!r0) S.restos.push(S.resto); }
      if (typeof ccSaveWho === "function") ccSaveWho();
      st.mode = "complete"; d.done.resto = d.done.vous = true; st.from = st.from || "boot";
      renderChrome(); this.mark(); return true;
    } catch (e) { console.warn("ob create", e); S.rid = prev; return false; }
  },
  /* one piece of equipment, written now (same shape and ordering as js/releve.js fridgeSave) */
  async addFridge(nw) {
    const d = this.st.d, name = nw.name.trim().replace(/\s+/g, " ");
    const order = this.frList().reduce((m, f) => Math.max(m, f.order ?? 0), -1) + 1;
    const doc = { name, min: nw.min, max: nw.max, type: nw.k, order, createdAt: Date.now(), ...(["service", "saladette"].includes(nw.k) ? { svcMax: Math.max(nw.max + 1, obFrType(nw.k).svc || 8) } : {}) };
    const id = await safe(DB.add("fridges", doc));
    d.added.push({ id, ...doc }); d.pop = id;
    logEvent("fridge", `a ajouté ${name} · seuil ${obDeg(nw.min)} à ${obDeg(nw.max)} °C`);
    return id;
  },
  /* smart default name: « Frigo 1 », « Congélateur 2 »… never one already taken */
  frName(k) {
    const base = obKindName(k), list = this.frList(), names = new Set(list.map((f) => (f.name || "").toLowerCase()));
    let i = list.filter((f) => obKindOf(f) === k).length + 1; while (names.has(`${base} ${i}`.toLowerCase())) i++;
    return `${base} ${i}`;
  },

  /* ───────────── navigation ───────────── */
  async next(skip) {
    const st = this.st, s = this.cur(), root = this.root(); if (!root || st.busy) return;
    this.collect(); const d = st.d;
    if (!skip) {
      if (s.k === "resto" && d.name.length < 2) { const el = $("#obName", root); this.shake(el); el && el.focus(); return; }
      if (s.k === "vous" && d.me.length < 2) { const el = $("#obMe", root); this.shake(el); el && el.focus(); return; }
      if (s.k === "equipe") { const tm = $("#obTeamIn", root); if (tm && tm.value.trim()) await ACT.obTeamAdd(); }
      if (s.opt && !this.has(s.k)) d.skipped[s.k] = true; else delete d.skipped[s.k];
    } else d.skipped[s.k] = true;
    if (s.k === "pret") return this.leave();
    if (s.k === "outils") this.saveTools(true);
    this.setBusy(true); let made = false;
    try {
      if (s.k === "resto" || s.k === "vous") await this.commit(s.k);
      if (s.k === "vous" && st.mode === "create") { made = true;
        const ok = await this.finish(); if (!ok) { this.setBusy(false); if (!d.name) this.goTo(0); return; }
        SFX.done(); buzz([10, 30, 10]); const b = $("#obGo"); if (b && !obReduce()) { const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); }
      }
    } catch (e) { this.setBusy(false); return; }
    this.setBusy(false); if (!made) { SFX.ok(); buzz(6); }
    if (st.ret || st.rush) { st.ret = st.rush = false; this.skipRest(); this.goTo(OB_LAST); return; }
    this.goTo(st.step + 1);
  },
  skipRest() { const d = this.st.d; OB_STEPS.forEach((x) => { if (x.opt && !this.has(x.k)) d.skipped[x.k] = true; }); },
  /* « Tout passer »: straight to « C'est prêt » once the restaurant has a name and the gérant a first name */
  async skipAll() {
    const st = this.st, root = this.root(); if (!root || st.busy) return; this.collect(); const d = st.d;
    if (st.mode === "create" || st.step <= 1) {
      if (d.name.length < 2) { if (st.step !== 0) this.goTo(0); setTimeout(() => { const el = $("#obName"); this.shake(el); el && obDesk() && el.focus(); }, st.step ? 360 : 0); toast("Il faut au moins le nom du restaurant."); return; }
      if (d.me.length < 2) { st.rush = true; if (st.step === 0) { await this.commit("resto"); this.goTo(1); } setTimeout(() => { const el = $("#obMe"); this.shake(el); el && obDesk() && el.focus(); }, 360); toast("Votre prénom, et c'est fini."); return; }
    }
    this.setBusy(true);
    try {
      if (st.step === 0) await this.commit("resto");
      if (st.step === 1) await this.commit("vous");
      if (st.mode === "create") { const ok = await this.finish(); if (!ok) { this.setBusy(false); return; } }
    } catch (e) { this.setBusy(false); return; }
    this.setBusy(false); SFX.tap(); buzz([6, 30, 6]);
    st.ret = st.rush = false; this.skipRest(); this.goTo(OB_LAST);
  },
  goTo(n) {
    const st = this.st; n = Math.max(0, Math.min(OB_LAST, n));
    /* past step 2 the restaurant must exist */
    if (n >= 2 && !this.live()) n = st.step <= 1 ? st.step : 1;
    if (n === st.step && this.root() && $("#obPane", this.root()).childElementCount) return;
    if (st.step === obIdx("frigos")) st.d.nw = null;
    if (n === obIdx("outils") && st.step !== n) { st.d.tq = 0; st.d.tp = "q"; this.tqEnter(); }
    st.dir = n >= st.step ? 1 : -1; st.step = n; st.d.pop = null; this._stay = null; this.paint(false);
  },
  prev() { if (this.cur().k === "outils" && this.tqBack()) return; if (this.st.step === 0) return; this.collect(); SFX.tap(); buzz(4); this.st.ret = false; this.goTo(this.st.step - 1); },
  leave(to) {
    const st = this.st; SFX.tap(); buzz([8, 30, 8]); this.saveTools(true);
    const back = st.from === "reglages" ? "reglages" : "home", first = back === "home";
    obSS.del("gg-ob"); st.from = ""; this.st = null; this._stay = null; S.history = []; go(back, {}, { replace: true });
    if (to) setTimeout(() => this.openTool(to), obReduce() ? 60 : 420);
    if (first) {
      setTimeout(() => toast(`${S.resto?.name || "Votre restaurant"} est prêt`), 500);
      /* the guided tour (another area) starts on this */
      try { window.dispatchEvent(new CustomEvent("gg:onboarded", { detail: { rid: S.rid, mode: DB.mode } })); } catch (e) {}
    }
  },
};

/* ───────────── « Vos outils » → resto.setupTodo, the home card, the features sheet ───────────── */
Object.assign(OB, {
  _toolsT: 0,
  saveTools(now) {
    clearTimeout(this._toolsT); if (!this.st || !S.rid || !S.resto) return;
    const v = [...this.st.d.tools], cur = Array.isArray(S.resto.setupTodo) ? S.resto.setupTodo : null;
    const run = () => {
      if (cur && cur.join() === v.join()) return; if (!cur && !v.length) return;
      S.resto.setupTodo = v; const patch = { setupTodo: v }; if (v.length && S.resto.setupTodoHidden) { patch.setupTodoHidden = false; S.resto.setupTodoHidden = false; }
      DB.update("restos", S.rid, patch).catch((e) => console.warn("setupTodo", e));
    };
    if (now) run(); else this._toolsT = setTimeout(run, 500);
  },
  /* a tool id (« sondes ») or a route (« r:hygiene »): open its screen */
  openTool(v) {
    try {
      v = String(v || ""); const r = v.startsWith("r:") ? v.slice(2) : "", x = r ? (r === "import" ? obTool("import") : null) : obTool(v);
      if (x && x.k === "import" && window.IMPORT && typeof window.IMPORT.open === "function") { window.IMPORT.open(); return; }
      const route = x ? x.r : r;
      if (route && VIEWS[route]) { go(route); return; }
      toast("Bientôt disponible");
    } catch (e) { console.warn("ob open", e); }
  },
  /* home: « À faire pour bien démarrer », the tools chosen in the onboarding that are not set up yet ("" when none) */
  todoCard() {
    try {
      const r = S.resto; if (!r || r.setupTodoHidden || !Array.isArray(r.setupTodo) || !r.setupTodo.length) return "";
      const all = r.setupTodo.map(obTool).filter(obToolOk); const left = all.filter((x) => !x.done());
      if (!left.length) return "";
      const done = all.length - left.length, pct = Math.round((done / all.length) * 100);
      return `<section class="glass obt st" style="--i:3" aria-labelledby="obtT">
        <div class="obt-h"><div class="obt-ht"><b id="obtT">À faire pour bien démarrer</b><span>${done ? `${done} sur ${all.length} fait${done > 1 ? "s" : ""}` : obPl(left.length, "étape")}</span></div><button type="button" class="obt-x" data-act="obTodoHide">Masquer</button></div>
        <div class="obt-bar" aria-hidden="true"><i style="width:${Math.max(pct, 4)}%"></i></div>
        <div class="obt-l">${left.map((x) => `<button type="button" class="onb-todor t-${x.tone}" data-act="obOpen" data-v="${x.k}"><span class="onb-tool-ic">${obI(x.ic, x.fb)}</span><span class="onb-tool-tx"><b>${esc(obTx(x.todo))}</b><span>${esc(obTx(x.ts))}</span></span>${OB_SVG.chev}</button>`).join("")}</div>
      </section>`;
    } catch (e) { console.warn("ob todoCard", e); return ""; }
  },
  featuresHTML() { return `<div class="onb-fsheet"><h2 class="h2">Tout ce que fait Growth Gusto</h2><p class="onb-fsheet-s">Touchez un outil pour l'ouvrir.</p>${OB.featsHTML("obOpen")}</div>`; },
});

/* ───────────── « Vos outils »: one simple question per tool, each with its branches, everything skippable ─────────────
   Questions: import (« Vous venez d'un autre logiciel ? ») · resa · caisse · sondes · extras (alertes, PMS, formation).
   State in OB.st.d: tq (index of the question), tp (its screen: "q" = the question, then a branch), ans { <q>: {v, …} }.
   Written on the resto doc: setupTodo (as before), setupAns (the answers, to come back to them), resaProvider, posProvider, importFrom.
   « Pas de … » / « Non » takes the tool out of setupTodo, so the home card only keeps what is useful. */
const OB_TQ = ["import", "resa", "caisse", "sondes", "extras"];
const OB_EXTRAS = ["alertes", "pms", "formation"];
const OB_SRCS = [["traqfood", "Traqfood", "T"], ["octopus", "Octopus", "O"], ["epack", "ePackPro", "eP"], ["restopil", "RestoPil", "RP"], ["koust", "Koust", "K"], ["excel", "Excel", "XL"], ["autre", "Autre", ""]];
const OB_RESA = [["zenchef", "Zenchef", "Z"], ["thefork", "TheFork Manager", "TF"], ["sevenrooms", "SevenRooms", "SR"], ["guestonline", "Guestonline", "GO"], ["resy", "Resy", "R"], ["opentable", "OpenTable", "OT"], ["formitable", "Formitable", "F"], ["google", "Google Réserver", "G"], ["autre", "Autre outil", ""]];
const OB_POS_FB = [["sumup", "SumUp", "S"], ["zelty", "Zelty", "Z"], ["lightspeed", "Lightspeed", "L"], ["square", "Square", "S"], ["tiller", "Tiller", "T"], ["innovorder", "Innovorder", "I"], ["laddition", "L'Addition", "LA"], ["popina", "Popina", "P"], ["autre", "Autre caisse", ""]];
const OB_TQ_BACK = { src: "q", go: "src", ours: "q", pick: "q", offer: "pick", on: "q", keep: "offer", z: "q", brand: "pick", buy: "q" };
const OB_TICKET_ART = `<svg class="onb-zart" viewBox="0 0 120 96" aria-hidden="true" focusable="false"><path d="M34 8h52v74l-6.5-5-6.5 5-6.5-5-6.5 5-6.5-5-6.5 5-6.5-5-6.5 5z" fill="#fff" stroke="#DCCFB8" stroke-width="1.8" stroke-linejoin="round"/><rect x="44" y="18" width="32" height="6" rx="3" fill="#1B1530"/><rect x="44" y="32" width="22" height="4" rx="2" fill="#DCCFB8"/><rect x="70" y="32" width="6" height="4" rx="2" fill="#DCCFB8"/><rect x="44" y="41" width="18" height="4" rx="2" fill="#DCCFB8"/><rect x="70" y="41" width="6" height="4" rx="2" fill="#DCCFB8"/><rect x="44" y="50" width="24" height="4" rx="2" fill="#DCCFB8"/><rect x="70" y="50" width="6" height="4" rx="2" fill="#DCCFB8"/><rect x="44" y="61" width="32" height="7" rx="3" fill="#F6B93B"/><circle cx="96" cy="66" r="16" fill="#5B2BFF"/><path d="M89 63h3l1.6-2.4h4.8L100 63h3v9H89z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="96" cy="67.4" r="2.4" fill="none" stroke="#fff" stroke-width="2"/></svg>`;
const obIni = (t, ic, id) => { const lg = id && brandLogo(id); return lg ? `<span class="onb-ini logo">${lg}</span>` : `<span class="onb-ini">${t ? esc(t) : ic || OB_SVG.plus}</span>`; };

Object.assign(OB, {
  ansOf(k) { const d = this.st && this.st.d; return (d && d.ans && d.ans[k]) || (S.resto && S.resto.setupAns && S.resto.setupAns[k]) || {}; },
  /* the questions this restaurant gets (a module that is not loaded or not allowed has no question) */
  tqList() {
    return OB_TQ.filter((k) => k === "caisse" ? obToolOk(obTool("caisse")) || (!!VIEWS.tickets && obPerm("tickets")) : k === "extras" ? OB_EXTRAS.some((x) => obToolOk(obTool(x))) : obToolOk(obTool(k)));
  },
  tqCur() { const d = this.st.d, L = this.tqList(); d.tq = Math.max(0, Math.min(L.length - 1, d.tq || 0)); return { L, i: d.tq, k: L[d.tq], p: d.tp || "q", a: d.ans[L[d.tq]] || {} }; },
  /* the last question: « Alertes » is on by default the first time it shows */
  tqEnter() {
    const d = this.st.d, L = this.tqList(), k = L[d.tq];
    if (k === "extras" && !d.ans.extras) { d.ans.extras = { seen: 1 }; if (obToolOk(obTool("alertes")) && !d.tools.includes("alertes")) { d.tools.push("alertes"); d.ans.extras.dflt = 1; } this.saveTools(); }
  },
  setTool(k, on) { const d = this.st.d, i = d.tools.indexOf(k); if (on && i < 0) d.tools.push(k); if (!on && i >= 0) d.tools.splice(i, 1); delete d.skipped.outils; this.saveTools(); },
  /* the answers are written at once (and the resto fields that other areas may read) */
  saveAns(extra = {}) {
    if (!this.st || !S.rid || !S.resto) return; const d = this.st.d;
    const patch = { setupAns: JSON.parse(JSON.stringify(d.ans)), ...extra };
    Object.assign(S.resto, patch); DB.update("restos", S.rid, patch).catch((e) => console.warn("setupAns", e));
  },
  /* one sub-screen to the next, with the same slide as the steps */
  tqPaint(dir) { this.st.dir = dir; this._stay = null; this.st.d.pop = null; this.paint(false); },
  tqTo(tp) { this.st.d.tp = tp; this.tqPaint(1); },
  tqAdvance(silent) {
    const d = this.st.d, L = this.tqList();
    if (d.tq < L.length - 1) { d.tq++; d.tp = "q"; this.tqEnter(); this.mark(); if (!silent) this.tqPaint(1); return true; }
    if (!silent) this.next(false); return false;
  },
  tqBack() {
    const d = this.st.d; if (!this.tqList().length) return false;
    if (d.tp && d.tp !== "q") { d.tp = OB_TQ_BACK[d.tp] || "q"; SFX.tap(); buzz(4); this.tqPaint(-1); return true; }
    if (d.tq > 0) { d.tq--; d.tp = "q"; SFX.tap(); buzz(4); this.tqPaint(-1); return true; }
    return false;
  },

  /* ── markup ── */
  tqHTML() {
    const { L, i, k, p, a } = this.tqCur();
    const dots = `<div class="onb-tqd st" style="--i:0" role="img" aria-label="Question ${i + 1} sur ${L.length}">${L.map((x, j) => `<i class="${j < i ? "done" : j === i ? "cur" : ""}"></i>`).join("")}</div>`;
    return `${dots}<div class="onb-tq" data-q="${k}" data-p="${p}">${this.tqBody(k, p, a)}</div>`;
  },
  opt(v, label, sub, ic, tone, on, j) {
    return `<button type="button" class="onb-opt t-${tone}${on ? " on" : ""}" data-act="obTqA" data-v="${v}" style="--j:${j}" aria-pressed="${!!on}"><span class="onb-tool-ic">${ic}</span><span class="onb-opt-tx"><b>${label}</b>${sub ? `<span>${sub}</span>` : ""}</span><i class="onb-opt-go">${on ? OB_SVG.check : OB_SVG.chev}</i></button>`;
  },
  opts(list) { return `<div class="onb-opts st" style="--i:3" role="list">${list.join("")}</div>`; },
  tiles(list, on) { return `<div class="onb-tiles st" style="--i:3">${list.map(([id, n, ini, sub, ic], j) => `<button type="button" class="onb-tile${on === id ? " on" : ""}" data-act="obTqP" data-v="${esc(id)}" style="--j:${j}">${obIni(ini, ic, id)}<b>${esc(n)}</b>${sub ? `<em>${esc(sub)}</em>` : ""}</button>`).join("")}</div>`; },
  big(tx, act, v, cls = "", ic = "") { return `<button type="button" class="onb-big ${cls}" data-act="${act}" data-v="${esc(v)}">${ic}<span>${tx}</span></button>`; },
  posList() { return typeof CX_POS !== "undefined" ? CX_POS.map((p) => [p.id, p.name, p.id === "autre" ? "" : typeof cxMono === "function" ? cxMono(p) : p.name.charAt(0), p.sub || "", p.id === "autre" ? ico("receipt") : ""]) : OB_POS_FB; },
  sdList() { return typeof SD_BRANDS !== "undefined" ? (typeof SD_ORDER !== "undefined" ? SD_ORDER : Object.keys(SD_BRANDS)).map((k) => { const b = SD_BRANDS[k]; const ini = k === "gateway" || k === "csv" ? "" : k === "sensorpush" ? "SP" : b.t.charAt(0); return [k, b.t, ini, b.s, k === "csv" ? ico("upload") : k === "gateway" ? ico("wifi") : ""]; }) : []; },
  nameIn(list, id) { const x = list.find((r) => r[0] === id); return x ? x[1] : ""; },
  tqBody(k, p, a) {
    const H = (t, sub) => this.head(t, sub, 1);
    if (k === "import") {
      if (p === "src") return H("Lequel ?") + this.tiles(OB_SRCS, a.src);
      if (p === "go") { const n = a.src === "autre" || !a.src ? "votre logiciel" : this.nameIn(OB_SRCS, a.src); return H(`On récupère tout depuis ${esc(n)}.`, "Produits, recettes, relevés : en 2 minutes.") + `<div class="onb-acts st" style="--i:3">${this.big("Importer maintenant", "obTqDo", "import", "pri", obI("imUp", "upload"))}</div>`; }
      return H("Vous venez d'un autre logiciel ?") + this.opts([
        this.opt("non", "Non, je démarre", "", obI("sparkle", "plus"), "v", a.v === "non", 0),
        this.opt("oui", "Oui", "Traqfood, Octopus, Excel…", obI("imUp", "upload"), "sf", a.v === "oui", 1)]);
    }
    if (k === "resa") {
      const prov = a.prov ? this.nameIn(OB_RESA, a.prov) : "", pn = a.prov === "autre" || !prov ? "votre outil" : prov;
      if (p === "ours") return H("Le nôtre est gratuit et inclus.", "Un carnet de réservations, et un lien pour réserver en ligne.") + `<div class="onb-acts st" style="--i:3">${this.big("Activer mes réservations", "obTqDo", "resaOn", "pri", obI("resa", "cal"))}</div>`;
      if (p === "pick") return H("Lequel ?") + this.tiles(OB_RESA, a.prov);
      if (p === "offer") return H("Le nôtre est gratuit et inclus.", a.prov === "google" ? "Et votre lien marche aussi sur Google." : `Vous pouvez arrêter de payer ${esc(pn)}. On récupère vos réservations déjà prises.`) + `<div class="onb-acts st" style="--i:3">${this.big("Passer à Growth Gusto", "obTqDo", "resaOn", "pri", obI("resa", "cal"))}${this.big(`Garder ${esc(pn)}`, "obTqDo", "resaKeep", "light")}</div>`;
      if (p === "keep") return typeof rzOpen === "function" && a.prov !== "google"
        ? H(`On récupère vos réservations ${esc(pn)}.`, "Gratuit, sans rien installer : elles arrivent ici et se placent sur votre plan de salle.") + `<div class="onb-acts st" style="--i:3">${this.big(`Relier ${esc(pn)}`, "rzOpen", a.prov || "autre", "pri", obI("resa", "cal"))}</div>`
        : H(`On garde ${esc(pn)}.`, `On affichera vos réservations ${esc(pn)} dès que la connexion sera ouverte.`) + `<div class="onb-done st" style="--i:3"><span class="onb-tool-ic">${OB_SVG.check}</span><span>Rien d'autre à faire.</span></div>`;
      if (p === "salle" && typeof plQuickHTML === "function") return H("Combien de tables ?", "On dessine votre plan de salle. Les réservations s'y placent toutes seules.") + `<div class="st" style="--i:3">${plQuickHTML("ob")}</div>`;
      const plBtn = typeof plQuickHTML === "function" && !((S.resto && S.resto.resaCfg && S.resto.resaCfg.tables) || []).length ? `<div class="onb-acts st" style="--i:4">${this.big("Dessiner ma salle", "obTqDo", "plSalle", "light", obI("plZone", "plus"))}</div>` : "";
      if (p === "on") return H("Vos réservations sont ouvertes.", S.resto && S.resto.resaCfg && S.resto.resaCfg.online ? "Partagez le lien : vos clients réservent seuls." : "Notez chaque appel en 10 secondes.") + `<div class="onb-live st" style="--i:3" id="obTqLive">${this.tqLiveHTML()}</div>` + plBtn;
      return H("Vous prenez des réservations comment ?") + this.opts([
        this.opt("none", "Pas de réservation", "", OB_SVG.x, "v", a.v === "none", 0),
        this.opt("tel", "Au téléphone, sur un cahier", "", OB_SVG.phone, "tm", a.v === "tel", 1),
        this.opt("tool", "J'ai déjà un outil", "Zenchef, TheFork…", obI("resa", "cal"), "sky", a.v === "tool", 2)]);
    }
    if (k === "caisse") {
      if (p === "z") return `<div class="onb-art-z st" style="--i:0">${OB_TICKET_ART}</div>` + H("Le ticket Z suffit.", "Chaque soir, prenez le ticket Z en photo, on déduit le stock tout seul.") + `<div class="onb-acts st" style="--i:3">${this.big("Essayer maintenant", "obTqDo", "tz", "light", OB_SVG.camera)}</div>`;
      if (p === "pick") return H("Laquelle ?") + this.tiles(this.posList(), a.pos);
      if (p === "brand") {
        const P = typeof cxPos === "function" ? cxPos(a.pos) : null, row = this.posList().find((r) => r[0] === a.pos) || [a.pos, "Votre caisse", ""];
        /* no fake connection: until the server part is live, the steps are the ones of the sales export */
        const direct = P && P.kind !== "csv" && typeof cxLive === "function" && cxLive();
        const steps = direct || (P && P.kind === "csv") ? P.steps : [P ? P.csv : "Cherchez « Export » dans les rapports de votre caisse.", "Importez le fichier ici : les ventes arrivent, le stock se déduit."];
        return `<div class="onb-brandh st" style="--i:1">${obIni(row[2], row[4] || ico("receipt"))}<div><b>${esc(row[1])}</b><span>${esc(direct ? P.need : "Un export des ventes, CSV ou Excel.")}</span></div></div>
          <ol class="onb-steps st" style="--i:2">${steps.map((t, j) => `<li style="--j:${j}"><span>${j + 1}</span><b>${esc(t)}</b></li>`).join("")}</ol>
          <div class="onb-live st" style="--i:3" id="obTqLive">${this.tqLiveHTML()}</div>`;
      }
      const L = [this.opt("none", "Pas de caisse", "", OB_SVG.x, "v", a.v === "none", 0)];
      if (VIEWS.tickets && obPerm("tickets")) L.push(this.opt("z", "Une caisse classique", "Ticket Z papier", obI("receipt", "receipt"), "sf", a.v === "z", 1));
      if (obToolOk(obTool("caisse"))) L.push(this.opt("pos", "Une caisse connectée", "SumUp, Zelty, Lightspeed…", obI("cxPlug", "receipt"), "sky", a.v === "pos", 2));
      return H("Votre caisse ?") + this.opts(L);
    }
    if (k === "sondes") {
      if (p === "pick") return H("Quelle marque ?") + this.tiles(this.sdList(), a.brand);
      if (p === "brand") { const n = this.nameIn(this.sdList(), a.brand) || "votre sonde"; return H(`Branchons ${esc(n)}.`, "Trois questions, et la sonde relève seule.") + `<div class="onb-live st" style="--i:3" id="obTqLive">${this.tqLiveHTML()}</div>`; }
      if (p === "buy") {
        let g = ""; try { if (typeof sdGuideHtml === "function") { const t = document.createElement("div"); t.innerHTML = sdGuideHtml(); const gl = t.querySelector(".sd-gl"); if (gl) { gl.classList.remove("glass"); [...gl.querySelectorAll(".sd-gi")].slice(2).forEach((x) => x.remove()); g = gl.outerHTML; } } } catch (e) { g = ""; }
        return H("Quelle sonde acheter ?", "On l'ajoute à votre liste. Vous la brancherez en 2 minutes.") + (g ? `<div class="onb-sdg sd-guide st" style="--i:3">${g}</div>${typeof ACT.sdGuide === "function" ? `<button type="button" class="onb-more-link st" style="--i:4" data-act="sdGuide">Chambre froide, petit budget : tout le guide${OB_SVG.chev}</button>` : ""}` : "");
      }
      return H("Des sondes de température connectées ?") + this.opts([
        this.opt("non", "Non", "", OB_SVG.x, "v", a.v === "non", 0),
        this.opt("oui", "Oui, j'en ai", "Shelly, SensorPush, Govee…", obI("sdProbe", "therm"), "sky", a.v === "oui", 1),
        this.opt("buy", "Je veux en installer", "Nos conseils d'achat", obI("sparkle", "plus"), "sf", a.v === "buy", 2)]);
    }
    /* extras */
    const T = OB_EXTRAS.map(obTool).filter(obToolOk), on = this.st.d.tools;
    return H("On active aussi ?", "Tout se change plus tard.") + `<div class="onb-tgs st" style="--i:3" role="group" aria-label="Outils en plus">${T.map((x, j) => `<button type="button" class="onb-tg t-${x.tone}${on.includes(x.k) ? " on" : ""}" data-act="obTqTg" data-v="${x.k}" aria-pressed="${on.includes(x.k)}" style="--j:${j}"><span class="onb-tool-ic">${obI(x.ic, x.fb)}</span><span class="onb-opt-tx"><b>${x.t}</b><span>${x.s}</span></span><i class="onb-sw" aria-hidden="true"></i></button>`).join("")}</div>`;
  },
  /* the part of a branch that follows the data (import done, probes added, booking link) */
  tqLiveHTML() {
    const { k, a } = this.tqCur();
    if (k === "resa") {
      const on = !!(S.resto && S.resto.resaCfg && S.resto.resaCfg.online);
      let url = ""; try { url = typeof rsUrl === "function" ? rsUrl() : ""; } catch (e) {}
      if (on && url) return `<div class="onb-link"><button type="button" class="onb-url" data-act="rsCopyLink"><span>${esc(url.replace(/^https?:\/\//, ""))}</span>${OB_SVG.copy}</button>
        <div class="onb-acts row">${this.big("Copier le lien", "rsCopyLink", "", "light", OB_SVG.copy)}${typeof ACT.rsQrOpen === "function" ? this.big("QR code", "rsQrOpen", "", "light", ico("qr")) : ""}</div></div>`;
      return `<div class="onb-done"><span class="onb-tool-ic">${OB_SVG.check}</span><span>Votre carnet est prêt. Le lien en ligne s'ouvre avec un compte.</span></div>`;
    }
    if (k === "caisse") {
      const id = a.pos || "autre", P = typeof cxPos === "function" ? cxPos(id) : null, st = typeof cxStatOf === "function" ? cxStatOf(id) : null;
      const live = typeof cxLive === "function" && cxLive(), admin = typeof cxIsAdmin !== "function" || cxIsAdmin(), kind = P ? P.kind : "csv";
      const imp = (tx = "Importer mes ventes", cls = "pri") => this.big(tx, "obTqDo", "cxImport", cls, obI("cxFile", "upload"));
      if (st && st.status === "connected" && (st.mode !== "csv" || st.lastImport)) return `<div class="onb-done ok"><span class="onb-tool-ic">${OB_SVG.check}</span><span><b>${st.mode === "csv" ? "Ventes importées" : "Caisse connectée"}</b>${st.mode === "csv" && typeof cxAgo === "function" ? ` · ${esc(cxAgo(st.lastImport))}` : ""}</span></div>${st.mode === "csv" ? `<div class="onb-acts">${imp("Importer un autre fichier", "light")}</div>` : ""}`;
      if (kind === "csv") return `<div class="onb-acts">${imp()}</div>`;
      if (live && admin && kind === "key") return `<label class="onb-f"><span class="onb-lbl">Clé API ${esc(P.name)}</span><div class="onb-in"><input class="onb-input mono" id="cxKey" autocomplete="off" spellcheck="false" placeholder="Collez la clé ici"></div></label><div class="onb-acts">${this.big(`Connecter ${esc(P.name)}`, "obTqDo", "cxKey", "pri", obI("cxKey", "lock"))}</div>`;
      if (live && admin) return `<div class="onb-acts">${this.big(`Connecter ${esc(P.name)}`, "obTqDo", "cxGo", "pri", obI("cxPlug", "receipt"))}${imp("Importer un fichier", "light")}</div>`;
      return `<p class="onb-soon">${obI("cxBolt", "sparkle")}<span><b>Connexion directe très bientôt.</b> En attendant, importez vos ventes.</span></p><div class="onb-acts">${imp()}</div>`;
    }
    if (k === "sondes") {
      let n = 0; try { n = window.SONDES ? window.SONDES.list().length : 0; } catch (e) {}
      if (n) return `<div class="onb-done ok"><span class="onb-tool-ic">${OB_SVG.check}</span><span><b>${obPl(n, "sonde")} branchée${n > 1 ? "s" : ""}</b></span></div><div class="onb-acts">${this.big("Ajouter une autre sonde", "obTqDo", "sdOpen", "light", OB_SVG.plus)}</div>`;
      return `<div class="onb-acts">${this.big("Brancher ma sonde", "obTqDo", "sdOpen", "pri", obI("sdProbe", "therm"))}</div>`;
    }
    return "";
  },
  /* a till or a probe is set up (the branch's CTA turns from « Plus tard » to « Continuer ») */
  tqDone() {
    const { k, a } = this.tqCur();
    try { if (k === "caisse") { const st = typeof cxStatOf === "function" ? cxStatOf(a.pos || "autre") : null; return !!(st && st.status === "connected" && (st.mode !== "csv" || st.lastImport)); } if (k === "sondes") return !!(window.SONDES && window.SONDES.list().length); } catch (e) {}
    return false;
  },
  tqLivePaint() { const root = this.root(); const el = root && $("#obTqLive", root); if (!el || (document.activeElement && document.activeElement.id === "cxKey")) return; const h = this.tqLiveHTML(); if (el._h !== h && el.innerHTML !== h) { el._h = h; el.innerHTML = h; } },
  tqCtaHTML(btn) {
    const { L, i, k, p } = this.tqCur(), last = i === L.length - 1;
    const skip = (tx = "Passer") => `<button class="onb-later" data-act="obTqSkip">${tx}</button>`;
    if (k === "extras") return `${btn(`Continuer${OB_SVG.arrow}`, "obTqNext")}${skip()}`;
    if (k === "resa" && p === "salle") return `<button class="onb-go" data-act="obTqDo" data-v="plSalleOk" id="obGo"><span class="onb-bl">Continuer${OB_SVG.arrow}</span><span class="onb-dots" aria-hidden="true"><i></i><i></i><i></i></span></button><button class="onb-later" data-act="obTqDo" data-v="plSalleSkip">Pas de plan pour l'instant</button>`;
    if (p === "brand" && !this.tqDone()) return btn("Plus tard", "obTqNext", " light");
    if (["on", "keep", "z", "brand", "buy"].includes(p)) return btn(`Continuer${OB_SVG.arrow}`, "obTqNext");
    if (p === "go") return btn("Plus tard", "obTqNext", " light");
    return btn(last ? "Passer" : "Passer", "obTqSkip", " light");
  },

  /* ── actions ── */
  async resaOn() {
    const r = S.resto; if (!r || !S.rid) return false;
    if (!r.resaCfg) {
      const base = typeof rsDefCfg === "function" ? rsDefCfg() : { services: [{ id: "midi", name: "Midi", from: "12:00", to: "13:45", days: [1, 2, 3, 4, 5, 6] }, { id: "soir", name: "Soir", from: "19:00", to: "21:45", days: [2, 3, 4, 5, 6] }], slot: 15, maxPerSlot: 16, maxService: 0, closures: [], online: false, lead: 2, maxOnline: 8, horizon: 60, msg: "", address: "", phone: "", photo: "", tables: [] };
      const cov = +r.covers || 0, online = typeof rsCanOnline === "function" ? rsCanOnline() : DB.mode === "db";
      if (r.type === "bar") base.services = base.services.filter((s) => s.id === "soir");
      if (r.type === "boulangerie" || r.type === "traiteur") base.services = base.services.filter((s) => s.id === "midi");
      const cfg = DB.clean({ ...base, online, address: r.address || "", phone: r.phone || "", ...(cov ? { maxPerSlot: Math.max(6, Math.min(40, Math.round(cov / 3))) } : {}) });
      try { await safe(DB.update("restos", S.rid, { resaCfg: cfg })); } catch (e) { return false; }
      r.resaCfg = cfg; logEvent("resa", "a ouvert les réservations");
      try { if (typeof rsWatch === "function") rsWatch(); } catch (e) {}
    }
    return true;
  },
});

Object.assign(ACT, {
  /* a question's answer */
  obTqA: (a, id, v) => {
    const st = OB.st; if (!st || OB.cur().k !== "outils") return; const d = st.d, { k } = OB.tqCur();
    if (a && !obReduce()) { a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); }
    SFX.tick(); buzz(6);
    const pass = (msg) => { if (msg) toast(msg); setTimeout(() => OB.st && OB.tqAdvance(), obReduce() ? 0 : 160); };
    if (k === "import") {
      if (v === "non") { d.ans.import = { v: "non" }; OB.setTool("import", false); OB.saveAns(); return pass(); }
      return setTimeout(() => OB.tqTo("src"), obReduce() ? 0 : 140);
    }
    if (k === "resa") {
      if (v === "none") { d.ans.resa = { v: "none" }; OB.setTool("resa", false); OB.saveAns({ resaProvider: "aucun" }); return pass("Pas de souci, on passe."); }
      if (v === "tel") { d.ans.resa = { v: "tel" }; OB.saveAns({ resaProvider: S.resto && S.resto.resaCfg ? "growthgusto" : "telephone" }); return setTimeout(() => OB.tqTo(S.resto && S.resto.resaCfg ? "on" : "ours"), obReduce() ? 0 : 140); }
      return setTimeout(() => OB.tqTo("pick"), obReduce() ? 0 : 140);
    }
    if (k === "caisse") {
      if (v === "none") { d.ans.caisse = { v: "none" }; OB.setTool("caisse", false); OB.setTool("ticketz", false); OB.saveAns({ posProvider: "aucune" }); return pass("Pas de souci, on passe."); }
      if (v === "z") { d.ans.caisse = { v: "z" }; OB.setTool("ticketz", true); OB.setTool("caisse", false); OB.saveAns({ posProvider: "papier" }); return setTimeout(() => OB.tqTo("z"), obReduce() ? 0 : 140); }
      return setTimeout(() => OB.tqTo("pick"), obReduce() ? 0 : 140);
    }
    if (k === "sondes") {
      if (v === "non") { d.ans.sondes = { v: "non" }; OB.setTool("sondes", false); OB.saveAns(); return pass("Pas de souci : vous relevez à la main ou à la voix."); }
      if (v === "buy") { d.ans.sondes = { v: "buy" }; OB.setTool("sondes", true); OB.saveAns(); return setTimeout(() => OB.tqTo("buy"), obReduce() ? 0 : 140); }
      return setTimeout(() => OB.tqTo("pick"), obReduce() ? 0 : 140);
    }
  },
  /* a tile (software, booking tool, till, probe brand) */
  obTqP: (a, id, v) => {
    const st = OB.st; if (!st) return; const d = st.d, { k } = OB.tqCur(); SFX.tap(); buzz(5);
    if (a && !obReduce()) { a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); }
    const later = (fn) => setTimeout(fn, obReduce() ? 0 : 140);
    if (k === "import") { d.ans.import = { v: "oui", src: v }; OB.setTool("import", true); OB.saveAns({ importFrom: v }); return later(() => OB.tqTo("go")); }
    if (k === "resa") { d.ans.resa = { v: "tool", prov: v }; OB.saveAns(); return later(() => OB.tqTo("offer")); }
    if (k === "caisse") { d.ans.caisse = { v: "pos", pos: v }; OB.setTool("caisse", true); OB.setTool("ticketz", false); OB.saveAns({ posProvider: v }); try { if (typeof cxEnsure === "function") cxEnsure(); } catch (e) {} return later(() => OB.tqTo("brand")); }
    if (k === "sondes") { d.ans.sondes = { v: "oui", brand: v }; OB.setTool("sondes", true); OB.saveAns(); return later(() => { OB.tqTo("brand"); setTimeout(() => ACT.obTqDo(null, null, "sdOpen"), obReduce() ? 80 : 420); }); }
  },
  /* the buttons inside a branch: they call the modules' own flows */
  obTqDo: async (a, id, v) => {
    const st = OB.st; if (!st) return; const d = st.d, { k } = OB.tqCur(), ans = d.ans[k] || {};
    if (v === "import") { if (!(window.IMPORT && typeof window.IMPORT.open === "function")) { OB.openTool("import"); return; } SFX.tap(); OB.saveTools(true); OB.tqAdvance(true); window.IMPORT.open(); return; }
    if (v === "resaOn") {
      if (a) a.disabled = true; const ok = await OB.resaOn(); if (a) a.disabled = false; if (!ok) return;
      d.ans.resa = { ...ans, on: 1 }; delete d.ans.resa.keep; OB.setTool("resa", true); OB.saveAns({ resaProvider: "growthgusto" });
      SFX.done(); buzz([10, 30, 10]); OB.tqTo(typeof plQuickHTML === "function" && !((S.resto.resaCfg || {}).tables || []).length ? "salle" : "on");
      setTimeout(() => { const r = $(".onb-tq h2"); if (r && !obReduce()) { const b = r.getBoundingClientRect(); burst(b.left + Math.min(b.width, 180) / 2, b.top + 20); } }, 260);
      return;
    }
    if (v === "plSalle") { SFX.tap(); if (typeof PL !== "undefined") PL.q = null; OB.tqTo("salle"); return; }
    if (v === "plSalleOk" || v === "plSalleSkip") {
      if (v === "plSalleOk" && typeof plQSave === "function") { if (a) a.disabled = true; const ok = await plQSave(); if (a) a.disabled = false; if (!ok) return; d.ans.resa = { ...(d.ans.resa || ans), salle: 1 }; OB.saveAns(); SFX.done(); buzz([8, 30, 10]); toast("Plan de salle créé. Ajustez-le dans Réservations."); }
      else SFX.tap();
      OB.tqTo("on"); return;
    }
    if (v === "resaKeep") { d.ans.resa = { ...ans, keep: 1 }; delete d.ans.resa.on; OB.setTool("resa", false); OB.saveAns({ resaProvider: ans.prov || "autre" }); SFX.ok(); buzz(6); OB.tqTo("keep"); return; }
    if (v === "tz") { SFX.tap(); if (typeof ACT.tzPick === "function") ACT.tzPick(); else go("tickets"); return; }
    if (v === "cxImport") { OB._stay = "caisse"; if (typeof ACT.cxImport === "function") ACT.cxImport(a, null, ans.pos || "autre"); else { OB._stay = null; OB.openTool("caisse"); } return; }
    if (v === "cxGo") { if (typeof ACT.cxGo === "function") ACT.cxGo(a, null, ans.pos); return; }
    if (v === "cxKey") { if (typeof ACT.cxKeyGo === "function") ACT.cxKeyGo(a, null, ans.pos); return; }
    if (v === "sdOpen") {
      if (typeof ACT.sdAdd !== "function") { OB.openTool("sondes"); return; }
      OB._stay = "sondes"; ACT.sdAdd(); if (ans.brand && typeof ACT.sdBrand === "function" && $("#sheet.open")) ACT.sdBrand(null, null, ans.brand); return;
    }
  },
  obTqTg: (a, id, v) => {
    const st = OB.st; if (!st || !obTool(v)) return; const on = !st.d.tools.includes(v);
    OB.setTool(v, on); st.d.ans.extras = { ...(st.d.ans.extras || {}), seen: 1, touched: 1 }; OB.saveAns();
    a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); if (on && !obReduce()) { a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); }
    on ? SFX.tick() : SFX.tap(); buzz(on ? 6 : 3); OB.fiche();
  },
  obTqNext: () => { if (!OB.st) return; SFX.ok(); buzz(5); OB.tqAdvance(); },
  obTqSkip: () => {
    const st = OB.st; if (!st) return; const { k } = OB.tqCur();
    /* « Passer » on the last question takes back « Alertes » if it was only the default */
    if (k === "extras" && st.d.ans.extras && st.d.ans.extras.dflt && !st.d.ans.extras.touched) { OB.setTool("alertes", false); st.d.ans.extras = { seen: 1 }; }
    SFX.tap(); buzz(4); OB.tqAdvance();
  },
});

/* ───────────── route ───────────── */
VIEWS.onboard = {
  live: false, hideTabs: true,
  render() { if (!OB.st) OB.start({ mode: S.resto ? "complete" : "create", from: "reglages" }); return OB.shell(); },
  after() { OB.after(true); },
};
/* the local-mode first run (core routes to "onboarding" while there is no restaurant): same flow. It stays on this route after the
   restaurant is created at step 2, so the view must not re-render on data (live:false) nor restart the flow. */
(function obLegacy() {
  const V = VIEWS.onboarding; if (!V) return;
  V.live = false;
  V.render = function () { if (!OB.st || (OB.st.mode === "complete" && !S.resto)) OB.start({ mode: S.resto ? "complete" : "create", from: "boot" }); return OB.shell(); };
  V.after = function () { OB.after(true); };
})();
/* first run: after an account creates its restaurant (OB.handoff), or after a refresh in the middle of the flow, the app reopens it */
(function obBoot() {
  const f0 = finishBoot;
  finishBoot = function () {
    const want = obSS.get("gg-ob"); const [rid, step] = String(want || "").split("|");
    if (want && S.resto && rid === S.rid) { OB.start({ mode: "complete", from: "boot", step: +step || 0 }); OB._redirect = true; }
    else if (want && (!S.resto || rid !== S.rid)) obSS.del("gg-ob");
    return f0.apply(this, arguments);
  };
  const g0 = go;
  go = function (route, params, opts) {
    if (OB._redirect && route === "home") { OB._redirect = false; route = "onboard"; params = {}; }
    /* « Vos outils » opens a module's own flow (sales import, probe sheet) over the onboarding: when it ends, its jump to its screen is skipped */
    if (OB._stay && OB._stay === route && OB.st && (S.route === "onboard" || S.route === "onboarding")) { OB._stay = null; setTimeout(() => { try { OB.soft(); } catch (e) {} }, 60); return; }
    return g0.call(this, route, params, opts);
  };
  const c0 = renderChrome;
  renderChrome = function () { c0.apply(this, arguments); if (S.route === "onboard") { const sd = $("#side"); sd && sd.classList.add("off"); } };
  /* the views are not live: new fridges, members or printer settings only refresh the parts that show them */
  const r0 = refresh;
  refresh = function () { const out = r0.apply(this, arguments); try { if (OB.st && (S.route === "onboard" || S.route === "onboarding")) OB.soft(); } catch (e) { console.warn("ob soft", e); } return out; };
})();

/* ───────────── live inputs + keys ───────────── */
const obLogoDeb = debounce(() => { const d = OB.st && OB.st.d; if (!d) return; const dom = obDomain(d.site); if (!dom) { if (d.logo && !d.logo.startsWith("data:")) { d.logo = ""; OB.logoPaint(); } const T = $("#obLogoT"), Sx = $("#obLogoS"); if (T && !d.logo) { T.textContent = "Votre logo"; Sx.textContent = "Depuis votre site, ou une image."; } return; } if (dom !== d.logoDom || !d.logo) OB.logoFetch(dom); }, 450);
const obFicheDeb = debounce(() => OB.fiche(), 160);
document.addEventListener("input", (e) => {
  const t = e.target; if (!OB.st || !t.closest || !t.closest(".onb")) return; const d = OB.st.d;
  if (t.id === "obName") { d.name = t.value.trim(); if (!d.logo || !d.logo.startsWith("data:")) { const b = $("#obLogoBox .onb-mono"); if (b) b.textContent = initials(d.name || "R"); } obFicheDeb(); }
  else if (t.id === "obSite") { d.site = t.value.trim(); obLogoDeb(); }
  else if (t.id === "obAddr") { d.address = t.value.trim(); obFicheDeb(); }
  else if (t.id === "obPhone") { d.phone = t.value.trim(); obFicheDeb(); }
  else if (t.id === "obCovers") { t.value = t.value.replace(/\D/g, "").slice(0, 5); d.covers = t.value; obFicheDeb(); }
  else if (t.id === "obMe") { d.me = t.value.trim(); const i = $("#obAvaIni"); if (i) i.textContent = initials(d.me || "?"); obFicheDeb(); }
  else if (t.id === "obFrName" && d.nw) { d.nw.name = t.value; const b = $("#obGo .onb-bl"); if (b) b.innerHTML = `${OB_SVG.plus}Ajouter ${esc(t.value.trim() || obKindName(d.nw.k))}`; }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !OB.st) return; const t = e.target; if (!t || !t.closest || !t.closest(".onb") || t.tagName !== "INPUT") return;
  if (t.id === "obFrName") { e.preventDefault(); ACT.obFrSave(); return; }
  if (t.id === "obTeamIn") { e.preventDefault(); ACT.obTeamAdd(); return; }
  if (t.id === "obName") { e.preventDefault(); const nx = $("#obSite"); if (nx) nx.focus(); else ACT.obNext(); return; }
  if (["obSite", "obAddr", "obPhone", "obCovers", "obMe"].includes(t.id)) { e.preventDefault(); ACT.obNext(); }
});

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  /* « Vos outils »: a card toggles between « Plus tard » and chosen */
  obTool: (a, id, v) => {
    const st = OB.st; if (!st || !obTool(v)) return; const d = st.d, i = d.tools.indexOf(v);
    if (i >= 0) d.tools.splice(i, 1); else d.tools.push(v);
    const on = i < 0; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on);
    if (on && !obReduce()) { a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); }
    const n = $("#obToolsN"); if (n) n.textContent = OB.toolsCount();
    on ? SFX.tick() : SFX.tap(); buzz(on ? 6 : 3);
    if (on) delete d.skipped.outils; OB.soft(); OB.saveTools();
  },
  /* open a tool / a screen: from « C'est prêt » the onboarding closes first; from the home card or the sheet, straight there */
  obOpen: (a, id, v) => {
    if (OB.st && (S.route === "onboard" || S.route === "onboarding")) { if (OB.cur().k === "pret") OB.leave(v); return; }
    SFX.tap(); buzz(4); try { if ($("#sheet.open")) closeSheet(true); } catch (e) {} OB.openTool(v);
  },
  obTodoHide: () => {
    if (!S.resto || !S.rid) return; S.resto.setupTodoHidden = true; SFX.close(); buzz(4);
    DB.update("restos", S.rid, { setupTodoHidden: true }).catch((e) => console.warn(e));
    try { refresh(); } catch (e) {} toast("Masqué. Tout reste dans le menu.");
  },
  obFeatures: () => { SFX.tap(); openSheet(OB.featuresHTML()); },
  obNext: () => OB.next(false),
  obSkip: () => { SFX.tap(); buzz(4); OB.next(true); },
  obSkipAll: () => OB.skipAll(),
  obPrev: () => OB.prev(),
  obFinish: () => OB.next(false),
  obGoStep: (a, id, v) => { const i = obIdx(v); if (i < 0) return; SFX.tap(); buzz(5); OB.st.ret = true; OB.goTo(i); },
  obClose: () => { SFX.close(); OB.st = null; S.history = []; go("reglages", {}, { replace: true }); },
  obComplete: () => { if (myRole() !== "gerant") { SFX.err(); toast("Réservé au gérant", "err"); return; } OB.open("reglages"); },
  obType: (a, id, v) => { const d = OB.st.d; d.type = d.type === v ? "" : v; $$(".onb [data-act=obType]").forEach((b) => { const on = b.dataset.v === d.type; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); SFX.tick(); buzz(4); OB.fiche(); },
  obMore: (a) => { const d = OB.st.d; d.more = !d.more; a.classList.toggle("on", d.more); a.setAttribute("aria-expanded", d.more); const b = $("#obMoreBox"); if (b) b.classList.toggle("on", d.more); SFX.tick(); buzz(4); if (d.more && obDesk()) setTimeout(() => { const i = $("#obAddr"); i && i.focus({ preventScroll: true }); }, 260); },
  obLogoPick: async () => { const u = await OB.pickInto("logo", 256); if (u) { OB.logoPaint(true); const T = $("#obLogoT"), Sx = $("#obLogoS"); if (T) { T.textContent = "Logo importé"; Sx.textContent = "Il apparaît sur vos documents."; } } },
  obPhotoPick: async () => { const u = await OB.pickInto("photo", 192); if (u) { const a = $("#obAva"); if (a) { a.innerHTML = `<img src="${esc(u)}" alt=""><span class="onb-ava-cam">${OB_SVG.camera}</span>`; a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); } const tx = $(".onb-you-tx"); if (tx) tx.innerHTML = `<b>Photo ajoutée</b><span>Touchez pour la changer.</span>`; OB.fiche(); } },
  /* step 3: a type tile opens the small card, « Ajouter » writes the fridge */
  obKind: (a, id, v) => {
    if (!OB_FR_FB[v]) return; const d = OB.st.d, t = obFrType(v);
    d.nw = { k: v, name: OB.frName(v), min: t.min, max: t.max };
    const z = $("#obFrZone"); if (z) { z.innerHTML = OB.newHTML(); z.classList.remove("swap"); void z.offsetWidth; z.classList.add("swap"); }
    const cta = $("#obCta"); if (cta) { cta._h = OB.ctaHTML(); cta.innerHTML = cta._h; }
    SFX.tap(); buzz(6);
    setTimeout(() => { const c = $("#obNew"); if (c) c.scrollIntoView({ behavior: obReduce() ? "auto" : "smooth", block: "nearest" }); }, 60);
  },
  obFrMore: () => { const d = OB.st.d; if (d.nw) { const i = $("#obFrName"); i && i.focus(); return; } const z = $("#obFrZone"); if (z) { z.scrollIntoView({ behavior: obReduce() ? "auto" : "smooth", block: "center" }); z.classList.remove("hey"); void z.offsetWidth; z.classList.add("hey"); } SFX.tick(); },
  obFrCancel: () => { const d = OB.st.d; d.nw = null; const z = $("#obFrZone"); if (z) { z.innerHTML = OB.kindsHTML(); z.classList.remove("swap"); void z.offsetWidth; z.classList.add("swap"); } const cta = $("#obCta"); if (cta) { cta._h = OB.ctaHTML(); cta.innerHTML = cta._h; } SFX.close(); },
  obTemp: (a, id, v) => {
    const d = OB.st.d, nw = d.nw; if (!nw) return; const [w, s] = String(v).split(":"); const step = +s;
    let x = nw[w] + step; x = Math.max(-60, Math.min(30, x));
    if (w === "min" && x >= nw.max) { SFX.err(); buzz(12); return; }
    if (w === "max" && x <= nw.min) { SFX.err(); buzz(12); return; }
    nw[w] = x; const b = $("#obT" + w); if (b) { b.innerHTML = `${obDeg(x)}<small>°C</small>`; b.classList.remove("tick"); void b.offsetWidth; b.classList.add("tick"); }
    const h = $("#obTHint"); if (h) h.textContent = nw.k === "congel" ? `Alerte au-dessus de ${obDeg(nw.max)} °C.` : `Alerte hors de ${obDeg(nw.min)} à ${obDeg(nw.max)} °C.`;
    SFX.tick(); buzz(3);
  },
  obFrSave: async () => {
    const st = OB.st, d = st.d, nw = d.nw; if (!nw || st.busy) return;
    const el = $("#obFrName"); const name = (el ? el.value : nw.name).trim().replace(/\s+/g, " ");
    if (!name) { OB.shake(el); el && el.focus(); return; }
    if (OB.frList().some((f) => (f.name || "").toLowerCase() === name.toLowerCase())) { OB.shake(el); toast("Ce nom est déjà pris.", "err"); return; }
    nw.name = name; OB.setBusy(true);
    try { await OB.addFridge(nw); } catch (e) { OB.setBusy(false); return; }
    st.busy = false; d.nw = null; delete d.skipped.frigos; SFX.ok(); buzz([8, 30, 8]);
    const z = $("#obFrZone"); if (z) { z.innerHTML = OB.kindsHTML(); z.classList.remove("swap"); void z.offsetWidth; z.classList.add("swap"); }
    OB.kitPaint(); OB.fiche();
    const kit = $("#obKit"); if (kit && !obReduce()) kit.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
  obFrDel: async (a, id) => {
    const d = OB.st.d, f = d.added.find((x) => x.id === id); if (!f) return;
    const box = a.closest(".onb-kf"); if (box && !obReduce()) box.classList.add("out");
    d.gone.push(id); SFX.close(); buzz(6);
    setTimeout(() => { OB.kitPaint(); OB.fiche(); }, obReduce() ? 0 : 220);
    try { await safe(DB.del("fridges", id)); d.added = d.added.filter((x) => x.id !== id); logEvent("fridge", `a retiré ${f.name}`); } catch (e) { d.gone = d.gone.filter((x) => x !== id); OB.kitPaint(); }
  },
  /* step 6: the « Nouvel équipier » flow when it exists, else a quick profile by first name */
  obPerson: () => { if (OB.perms()) { SFX.tap(); try { window.PERMS.flow({ from: "onboarding" }); } catch (e) { console.warn("PERMS.flow", e); } } },
  obTeamAdd: async () => {
    const el = $("#obTeamIn"); if (!el) return; const n = el.value.trim(); if (!n) { OB.shake(el); return; } const d = OB.st.d;
    const taken = [d.me || S.me.name || "", ...OB.mates().map((m) => m.name || "")].map((x) => x.trim().toLowerCase());
    if (taken.includes(n.toLowerCase())) { OB.shake(el); toast(`Il y a déjà un ${n} : ajoutez une initiale.`, "err"); return; }
    if (d.team.length >= 20) { toast("Ajoutez les autres dans Équipe."); return; }
    const used = [...S.members.map((m) => m.color), ...d.team.map((m) => m.color)];
    const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); const color = PALETTE.find((c) => !used.includes(c)) || PALETTE[(S.members.length + d.team.length + 1) % PALETTE.length];
    const doc = { role: "equipe", name: n, color, joinedAt: Date.now(), by: S.me.id };
    el.value = "";
    try { await safe(DB.set("members", id, doc)); } catch (e) { el.value = n; return; }
    d.team.push({ id, ...doc }); d.pop = id; S.profiles[id] = { name: n, color }; logEvent("team", `a ajouté ${n} à l'équipe`);
    const L = $("#obTeamList"); if (L) { L._h = OB.teamHTML(); L.innerHTML = L._h; } SFX.ok(); buzz(6); OB.soft(); if (obDesk()) el.focus();
  },
  obTeamDel: async (a, id) => {
    const d = OB.st.d, m = d.team.find((x) => x.id === id); if (!m) return; d.gone.push(id);
    const L = $("#obTeamList"); if (L) { L._h = OB.teamHTML(); L.innerHTML = L._h; } SFX.close(); OB.soft();
    try { await safe(DB.del("members", id)); d.team = d.team.filter((x) => x.id !== id); } catch (e) { d.gone = d.gone.filter((x) => x !== id); OB.soft(); }
  },
  obInvRetry: () => { OB.st.d.invErr = ""; const box = $("#obInv"); if (box) box.innerHTML = OB.invHTML(); OB.invite(); },
  obInvShare: async () => { const c = OB.st.d.inv; if (!c) return; try { await navigator.share({ title: `Rejoignez ${OB.st.d.name || "l'équipe"} sur Growth Gusto`, text: `${OB.st.d.me ? firstName(OB.st.d.me) + " vous invite" : "Vous êtes invité"} à rejoindre ${OB.st.d.name || "l'équipe"} sur Growth Gusto. Code : ${OB.invText("code")}`, url: OB.invText("link") }); SFX.ok(); } catch (e) { if (e && e.name !== "AbortError") OB.copy("link"); } },
  obInvCopy: (a, id, v) => OB.copy(v),
  /* legacy entry (tools/smoke.js and older scripts): create the restaurant now with what has been filled, then show « C'est prêt » */
  obCreate: async () => {
    const st = OB.ensure(); OB.collect(); const d = st.d;
    if (d.name.length < 2) { OB.goTo(0); setTimeout(() => OB.shake($("#obName")), 200); return; }
    if (d.me.length < 2) { OB.goTo(1); setTimeout(() => OB.shake($("#obMe")), 200); return; }
    OB.setBusy(true); const ok = await OB.finish(); OB.setBusy(false); if (!ok) return;
    OB.skipRest(); OB.goTo(OB_LAST);
  },
});

/* a person invited from the « Nouvel équipier » flow during onboarding: shown at once as a pending chip */
window.addEventListener("gg:invite", (e) => {
  try { if (!OB.st || !OB.st.d || !e.detail) return; const d = OB.st.d, v = e.detail; d.invs = (d.invs || []).filter((x) => x.code !== v.code).concat([v]); d.pop = v.code;
    const L = $("#obTeamList"); if (L) { L._h = OB.teamHTML(); L.innerHTML = L._h; } OB.soft && OB.soft(); } catch (x) { console.warn("gg:invite", x); }
});
