/* Growth Gusto — area: prise de commande en salle (route « salle ») + écran cuisine (route « cuisine »). Prefix « sl ».
   - Prise de commande : le serveur touche une table sur le plan de salle (ou dans la grille des numéros sans plan), indique les
     couverts, ajoute les plats de la carte (fiches « à la carte » de Recettes & allergènes), une note par plat (cuisson, sans sel…)
     et les allergies de la table. Les plats sont rangés par suite : boissons, entrées, plats, desserts.
     « Envoyer en cuisine » part tout de suite pour les boissons (bar) et la première suite ; les suites suivantes arrivent en cuisine
     « à suivre » (le chef voit ce qui vient) jusqu'à « Envoyer la suite ». Le serveur est prévenu quand c'est prêt (carillon, vibration).
   - Écran cuisine : tous les bons du service, ceux de la salle et ceux du menu QR (js/commande.js), le plus ancien d'abord, avec
     un minuteur, les allergies en rouge, « Lancer », « Prêt », « Rappeler le serveur », impression du bon sur l'imprimante d'étiquettes.
   - Pas d'encaissement ici : l'addition se fait sur la caisse du restaurant (logiciel de caisse certifié NF525). On affiche le
     récapitulatif à taper sur la caisse, puis on libère la table. Le stock est déjà déduit par les ventes de la caisse (tickets Z).
   Data (members read/write, no rules change):
     restos/{rid}/salleTabs/{id}     { table, tableId, zone, covers, status:"open"|"closed", day, openedAt, by, byName, closedAt?, closedBy?,
                                       note, booking?, client?, clientName?, pass?:{k,at} (the counter visit it noted), total, items:[{ k, id, name, price, q, note, allergy:[id], course:0..3, cat, sent:ticketId|null, off? }] }
     restos/{rid}/clientOrders/{id}  the kitchen tickets, same collection as the QR orders so one kitchen screen shows both:
                                     { src:"salle", mode:"table", table, tableId, tabId, course, courseT, station:"cuisine"|"bar", covers,
                                       items:[{ k, id, name, price, q, note, allergy, ok? }], total, n, day, at, firedAt?, waiter, waiterName,
                                       status: attente (« à suivre ») → nouvelle → prep → prete → servie | annulee, call? (rappel), add? (ajout),
                                       pay:"place", paid:false }
   Client de la table (sans réservation) : « Qui est à table ? » à l'ouverture, ou plus tard depuis la table. Choisir une fiche client
   (ou en créer une) note tout seul un passage dans le fichier clients (js/clients.js), donc un tampon de fidélité et une visite
   comptée pour le VIP. « Invité » ne note rien. Changer de client déplace le passage. Avec une réservation, c'est elle qui compte.
   Hooks into js/commande.js (loaded before): cmOnRows and cmAlert are wrapped (no edit of their bodies). */
"use strict";

TAB_OF.salle = "more"; TAB_OF.cuisine = "more";
(function slNav() {
  if (NAV.some((n) => n[0] === "salle")) return;
  const i = NAV.findIndex((n) => n[0] === "commandes"), j = i >= 0 ? i : NAV.findIndex((n) => n[0] === "resa");
  NAV.splice(j >= 0 ? j + 1 : NAV.length, 0, ["salle", "slPad", "Prise de commande"], ["cuisine", "slHat", "Écran cuisine"]);
})();
try { if (typeof AB_GATE !== "undefined") { AB_GATE.salle = ["pro", "Prise de commande"]; AB_GATE.cuisine = ["pro", "Écran cuisine"]; } } catch (e) {}
Object.assign(IC, {
  slPad: ["r:5,3.5,14,17.5,2.5", "M9 2.5v2", "M15 2.5v2", "M9 10h6", "M9 14h6", "M9 18h3", "f:M5 6h14v15H5z"],
  slHat: ["M17 21a1 1 0 0 0 1-1v-5.35c0-.46.31-.85.74-1.03A4 4 0 0 0 17 6a5 5 0 0 0-10 0 4 4 0 0 0-1.74 7.62c.43.18.74.57.74 1.03V20a1 1 0 0 0 1 1Z", "M6 17h12", "f:M6 17h12v3a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"],
  slSend: ["M21.5 2.5 10.5 13.5", "M21.5 2.5l-7 19-4-8-8-4 19-7Z", "f:M21.5 2.5l-7 19-4-8-8-4z"],
  slFire: ["M12 2.5c1 3.2 5 5.4 5 10.2a5 5 0 0 1-10 0c0-2.2 1-3.9 2.4-5.1.2 1.7 1 2.8 2.1 3.3C11 8.1 11 5 12 2.5Z", "f:M12 2.5c1 3.2 5 5.4 5 10.2a5 5 0 0 1-10 0c0-2.2 1-3.9 2.4-5.1.2 1.7 1 2.8 2.1 3.3C11 8.1 11 5 12 2.5Z"],
  slGlass: ["M6 3h12l-1.4 8.2a4.7 4.7 0 0 1-9.2 0Z", "M12 15.8V21", "M8.5 21h7", "M6.6 7h10.8", "f:M6.6 7h10.8l-.8 4.2a4.7 4.7 0 0 1-9.2 0z"],
  slMove: ["M7 7l-4 4 4 4", "M3 11h12a5 5 0 0 1 0 10h-2", "M17 3l4 4-4 4"],
  slBill: ["M6 2.5h12v19l-2.5-1.6L13 21.5l-2.5-1.6L8 21.5l-2-1.3Z", "M9 7.5h6", "M9 11.5h6", "M9 15.5h3", "f:M6 2.5h12v19l-2.5-1.6L13 21.5l-2.5-1.6L8 21.5l-2-1.3z"],
  slWarn: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z", "M12 9v4", "M12 17h.01", "f:M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  slBolt: ["M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z", "f:M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"],
  slGift: ["r:3,8,18,4.5,1.2", "M12 8v13.5", "M19.5 12.5v7.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-7.5", "M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5", "f:M4.5 12.5h15v7.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z"],
  slRedo: ["M20 4v5h-5", "M20 9a8.5 8.5 0 1 0 1.2 6"],
  slBan: ["c:12,12,9", "M5.6 5.6l12.8 12.8"],
  slList: ["M9 6h11", "M9 12h11", "M9 18h11", "M4.5 6h.01", "M4.5 12h.01", "M4.5 18h.01"],
  slMerge: ["M6 3v5a6 6 0 0 0 6 6h0a6 6 0 0 1 6 6v1", "M18 3v5a6 6 0 0 1-3.5 5.5", "M15 18l3 3 3-3"],
  slCall: ["M4 13a8 8 0 0 1 16 0", "M2.5 13h19", "M12 5V3", "M10 3h4", "M5 17h14", "M7 21h10", "f:M4 13a8 8 0 0 1 16 0z"],
});

/* ───────── config ───────── */
const SL_COURSES = [[0, "Boissons", "slGlass"], [1, "Entrées", "slFire"], [2, "Plats", "slFire"], [3, "Desserts", "slFire"]];
const slCourseT = (c) => (SL_COURSES.find((x) => x[0] === +c) || SL_COURSES[2])[1];
const slCourseOf = (cat) => (cat === "boisson" ? 0 : cat === "plat" ? 2 : cat === "dessert" ? 3 : 1);
const SL_NOTES = ["Saignant", "À point", "Bien cuit", "Sans sauce", "Sauce à part", "Sans sel", "Sans oignon", "Portion enfant", "Pour partager"];
const SL_OFFER_WHY = ["Geste commercial", "Anniversaire", "Attente trop longue", "Erreur cuisine", "Repas du personnel"];
const SL_CANCEL_WHY = ["Erreur de saisie", "Le client a changé d'avis", "Rupture", "Trop d'attente"];
const SL_REFIRE_WHY = ["Retour client", "Assiette tombée", "Mauvaise cuisson", "Autre"];
const SL_ST = { attente: "À suivre", nouvelle: "Envoyé", prep: "En cuisine", prete: "Prêt", servie: "Servi", annulee: "Annulé" };
const SL = { rid: null, tabs: null, st: new Map(), stInit: false, mine: new Set(), cat: "tout", pane: null, paneTab: null, ed: null, pickT: null, station: "tout", wake: null, busy: {}, kTick: null, fTick: null, fr: null, bill: null, oq: "", q: "", move: null, merge: null, cl: null,
  print: (() => { try { return localStorage.getItem("gg-sl-print") === "1"; } catch (e) { return false; } })() };
const slEur = (v) => (typeof cmEur === "function" ? cmEur(v) : (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €");
const slAgo = (at) => { const m = Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4)); return m < 1 ? "à l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
const slMin = (at) => Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4));
/* what a kitchen ticket is called: the table, and where it comes from. A QR order at a table has no number (the table says it all);
   a takeaway keeps its number, the one the customer shows at the counter. */
const slWho = (o) => (o.src === "salle" ? `Table ${o.table}` : o.mode === "table" ? `Commande QR · Table ${o.table}` : `À emporter n° ${o.n}${o.name ? ` · ${o.name}` : ""}`);
const slId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slAl = (id) => (typeof allergenOf === "function" && allergenOf(id)) || { t: id };
const slDishAl = (id, x) => { const n = (S.notes || []).find((y) => y.id === id); if (!n) return (x && x.dishAl) || []; try { return typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || []; } catch (e) { return n.allergens || []; } };

/* ───────── data ───────── */
function slWatch() {
  if (!S.rid) return;
  if (typeof cmWatch === "function") cmWatch(); /* the kitchen tickets (clientOrders) and the carte config */
  if (typeof rsWatch === "function") rsWatch(); /* today's bookings (names on the tables) and, in the demo, the floor plan */
  if (SL.rid === S.rid) return; SL.rid = S.rid; SL.tabs = null; SL.stockSeen = null; SL.st = new Map(); SL.stInit = false; SL.mine = new Set();
  const rid = S.rid;
  if (DB.mode === "demo") slSeedDemo();
  DB.watch("salleTabs", { order: "openedAt", dir: "desc", limit: 300 }, (rows) => { if (S.rid !== rid) return; SL.tabs = rows; slStockSync(); onData(); });
  try { localStorage.setItem("gg-sl-on-" + rid, "1"); } catch (e) {}
}
/* a waiter who already uses this screen keeps getting « c'est prêt » on any screen after a restart */
window.addEventListener("gg:ready", () => { setTimeout(() => { try { if (S.rid && DB.mode === "db" && localStorage.getItem("gg-sl-on-" + S.rid) === "1" && (typeof abHas !== "function" || abHas("salle"))) slWatch(); } catch (e) {} }, 1500); });

const slOpenTabs = () => (SL.tabs || []).filter((t) => t.status === "open");
/* the tables of an open tab: its own, and the ones pushed against it (« Accoler une table », a booking on joined tables, « Réunir ») */
const slTabTables = (t) => [t.tableId, ...(Array.isArray(t.joined) ? t.joined : [])].filter(Boolean);
const slTabAt = (tid) => slOpenTabs().find((x) => slTabTables(x).includes(tid)) || null;
const slTabMap = () => { const m = new Map(); slOpenTabs().forEach((t) => slTabTables(t).forEach((id) => m.set(id, t))); return m; };
const slJoinLbl = (ids) => ids.map((id) => (slTableBy(id) || {}).n).filter(Boolean).join("+");
const slTabOf = (id) => (SL.tabs || []).find((t) => t.id === id) || null;
const slTickets = (tabId) => (CM.orders || []).filter((o) => o.src === "salle" && o.tabId === tabId && o.status !== "annulee");
const slLive = (o) => ["attente", "nouvelle", "prep", "prete"].includes(o.status) && Date.now() - (o.at || 0) < 20 * 3600e3;
const slKitchen = () => (CM.orders || []).filter(slLive);
const slItemsOk = (t) => (t.items || []).filter((x) => !x.off);
const slUnit = (x) => (+x.price || 0) + (x.extras || []).reduce((a, e) => a + (+e.p || 0), 0);
const slTotal = (items) => Math.round(items.filter((x) => !x.off && !x.free).reduce((a, x) => a + slUnit(x) * (+x.q || 0), 0) * 100) / 100;
function slNextN() { const k = dayKey(); return Math.max(100, ...(CM.orders || []).filter((o) => o.src === "salle" && o.day === k).map((o) => +o.n || 0)) + 1; }

/* the tables: from the floor plan (js/plan.js), else the numbers 1…N */
function slTables() {
  const cfg = typeof rsCfg === "function" ? rsCfg() : {};
  if ((cfg.tables || []).length && typeof plTables === "function") return { plan: true, cfg, T: plTables(cfg) };
  const n = typeof cmTablesN === "function" ? cmTablesN() : 12;
  return { plan: false, cfg, T: Array.from({ length: n }, (_, i) => ({ id: "n" + (i + 1), n: String(i + 1), seats: 4, zone: "salle" })) };
}
const slTableBy = (id) => slTables().T.find((t) => t.id === id) || null;
/* the booking sitting (or about to sit) at this table now */
function slBookingAt(tid) {
  try {
    if (typeof rsOfDay !== "function") return null; const now = new Date().getHours() * 60 + new Date().getMinutes();
    return rsOfDay(dayKey()).filter((b) => (typeof rsLive !== "function" || rsLive(b)) && (typeof plTblOf === "function" ? plTblOf(b) : [b.table, b.tableWith]).includes(tid)).map((b) => ({ b, d: rsMin(b.time) - now })).filter((x) => x.d > -100 && x.d < 60).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0]?.b || null;
  } catch (e) { return null; }
}
/* the state of an open table, from its kitchen tickets */
function slTabState(tab) {
  const T = slTickets(tab.id), un = slItemsOk(tab).filter((x) => !x.sent).length;
  if (T.some((o) => o.status === "prete")) return { k: "ready", t: "Prêt !" };
  if (T.some((o) => o.status === "nouvelle" || o.status === "prep")) return { k: "cook", t: "En cuisine" };
  if (un) return { k: "draft", t: `${un} à envoyer` };
  if (T.some((o) => o.status === "attente")) return { k: "hold", t: "Suite ?" };
  return { k: "open", t: "À table" };
}
const slCovers = (tab) => `${+tab.covers || 0} couv.`;

/* ───────── wrap js/commande.js: kitchen chime only on kitchen screens, « prêt » to the waiter ───────── */
(function slHook() {
  if (typeof cmOnRows === "function") { const f0 = cmOnRows; cmOnRows = function (rows) { try { slOnRows(rows); } catch (e) { console.warn("salle", e); } return f0(rows); }; }
  if (typeof cmAlert === "function") {
    const a0 = cmAlert;
    cmAlert = function (o) {
      if (o && o.src === "salle") {
        if (SL.mine.has(o.id) || !slKRoute(true)) return;
        CM.fresh.add(o.id);
        try { SFX.init(); SFX.tone(1047, 0.22, "sine", 0.055); SFX.tone(1319, 0.24, "sine", 0.05, 0.13); SFX.tone(1568, 0.42, "sine", 0.045, 0.26); buzz([22, 50, 22]); } catch (e) {}
        if (SL.print && S.route === "cuisine") slPrint(o);
        return;
      }
      a0(o);
      if (S.route === "cuisine" && SL.print) slPrint(o);
    };
  }
})();
/* a kitchen screen is on: the écran cuisine, or the « coup de feu » mode in its Cuisine role (js/rush.js); qr = the Commandes en ligne screen counts too */
const slKRoute = (qr) => S.route === "cuisine" || (qr && S.route === "commandes") || (S.route === "coupdefeu" && typeof cfRole === "function" && cfRole() === "cuisine");
function slOnRows(rows) {
  slStockSync();
  rows.forEach((o) => {
    if (o.src !== "salle") return; const k = o.status + "|" + (o.call || 0) + "|" + (o.mod || 0) + "|" + (o.push || 0), p = SL.st.get(o.id); SL.st.set(o.id, k);
    if (!SL.stInit || !p || p === k) return;
    const [ps, pc, pm, pp] = p.split("|");
    if (slKRoute(false) && slLive(o) && (String(o.mod || 0) !== pm || String(o.push || 0) !== pp)) { try { if (typeof CM !== "undefined" && CM.fresh) CM.fresh.add(o.id); SFX.init(); SFX.tone(660, 0.16, "square", 0.04); SFX.tone(990, 0.22, "square", 0.04, 0.14); buzz([50, 40, 50]); } catch (e) {} }
    if (pc === undefined) return;
    if (o.status === "prete" && ps !== "prete") slReady(o, false); else if (o.status === "prete" && o.call && String(o.call) !== pc) slReady(o, true);
  });
  SL.stInit = true;
}
function slReady(o, recall) {
  if (slKRoute(true)) return;
  if (o.waiter !== S.me.id && S.route !== "salle" && !(S.route === "coupdefeu" && typeof cfRole === "function" && !["cuisine", "bar"].includes(cfRole()))) return;
  try { SFX.init(); SFX.tone(784, 0.18, "triangle", 0.06); SFX.tone(1175, 0.2, "triangle", 0.055, 0.12); SFX.tone(1568, 0.5, "sine", 0.05, 0.24); buzz(recall ? [80, 60, 80, 60, 160] : [60, 40, 60, 40, 120]); } catch (e) {}
  toast(`Table ${o.table} · ${o.courseT || "commande"} ${recall ? ": la cuisine vous appelle" : "prêt à servir"}`, "info");
  /* a recall also lands in the bell (Alertes) of the waiter who sent the ticket, so it is still there when the phone comes out of the pocket */
  if (recall && o.waiter === S.me.id) try { if (window.ALERTES && typeof window.ALERTES.push === "function") window.ALERTES.push({ type: "service", key: "slcall_" + o.id + "_" + o.call, level: "warn", text: `Table ${o.table} · ${o.courseT || "commande"} : la cuisine vous appelle`, sub: "Les assiettes attendent au passe", day: o.day, route: "salle" }); } catch (e) {}
  if (S.route === "salle") onData();
}

/* ───────── view: prise de commande ───────── */
VIEWS.salle = {
  render(p) {
    slWatch();
    const tab = p && p.id ? slTabOf(p.id) : null;
    if (p && p.id && SL.tabs && (!tab || tab.status !== "open")) return slGone();
    if (tab) return slTabView(tab);
    return slFloor();
  },
  after(v) {
    clearInterval(SL.fTick); SL.fTick = setInterval(() => { if (S.route !== "salle") { clearInterval(SL.fTick); return; } $$(".sl-ago[data-at]").forEach((el) => { el.textContent = slAgo(+el.dataset.at); }); }, 20000);
    const q = v.querySelector("#slQ"); if (q) { q.value = SL.q || ""; slFilter(); q.addEventListener("input", () => { SL.q = q.value; slFilter(); }); }
    const cats = v.querySelector(".sl-cats .on"); if (cats) try { cats.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
  },
};
function slGone() {
  return `<div class="inner">${topBar("Prise de commande")}<div class="glass sl-empty st" style="--i:1"><div class="sl-ill">${ico("check")}</div><b class="h3">Cette table est libérée</b><p class="sub">La commande a été clôturée.</p><button class="btn acc" data-go="salle">${ico("slPad")}Retour à la salle</button></div></div>`;
}

/* ── the floor ── */
/* QR orders at a table not paid yet (pay at the end of the meal): the waiter sees them on the floor until « Réglé » */
function slDueHtml() {
  if (typeof cmDue !== "function" || typeof cmDueBand !== "function") return "";
  const L = (CM.orders || []).filter((o) => cmDue(o) && o.day === dayKey()).sort((a, b) => (a.at || 0) - (b.at || 0));
  return L.length ? `<div class="sl-due-l st" style="--i:2">${L.map((o) => cmDueBand(o)).join("")}</div>` : "";
}
function slFloor() {
  const { plan, cfg, T } = slTables(), open = slOpenTabs(), by = slTabMap();
  const ready = slKitchen().filter((o) => o.src === "salle" && o.status === "prete").sort((a, b) => (a.waiter === S.me.id ? -1 : 0) - (b.waiter === S.me.id ? -1 : 0) || (a.readyAt || 0) - (b.readyAt || 0));
  const covers = open.reduce((a, t) => a + (+t.covers || 0), 0), cook = open.filter((t) => slTabState(t).k === "cook").length;
  const st = (t) => {
    const tab = by.get(t.id);
    if (!tab) { const b = slBookingAt(t.id); return b ? { cls: "soon", a: b.time, b: `${firstName(b.name) || ""} · ${+b.covers || 0}p` } : { cls: "free" }; }
    const s = slTabState(tab); return { cls: { ready: "sl-ready", cook: "seated", hold: "booked", draft: "sl-draft", open: "sl-open" }[s.k], a: s.t, b: `${slCovers(tab)} · ${slMin(tab.openedAt)} min` };
  };
  let floor;
  if (plan) {
    const Z = plZones(cfg), D = (cfg.decor || []).filter((d) => d && PL_DECOR[d.kind]);
    floor = Z.filter((z) => T.some((t) => t.zone === z.id)).map((z) => `<div class="pl-zone"><div class="pl-zh">${z.out ? ico("plSun") : ""}<b>${esc(z.name)}</b><span>${T.filter((t) => t.zone === z.id && by.has(t.id)).length}/${T.filter((t) => t.zone === z.id).length} tables</span></div>
      ${plSvg(z.id, T.filter((t) => t.zone === z.id), D.filter((d) => d.zone === z.id), { mode: "live", st, zoneObj: z }).replace(/data-act="plTap"/g, 'data-act="slTable"').replace(/ data-rsdropt="[^"]*"/g, "")}</div>`).join("");
    floor = `<div class="glass sl-plan st" style="--i:3"><div class="pl-zones">${floor}</div>
      <div class="rs-legend sl-legend"><span class="l-free">Libre</span><span class="l-seated">En cuisine</span><span class="l-hold">Suite à envoyer</span><span class="l-ready">Prêt</span></div></div>`;
  } else {
    floor = `<div class="glass sl-grid st" style="--i:3">${T.map((t, i) => { const s = st(t); return `<button class="sl-gt ${s.cls}" style="--j:${i}" data-act="slTable" data-id="${esc(t.id)}"><b class="mono">${esc(t.n)}</b><span>${esc(s.a || "Libre")}</span>${s.b ? `<em>${esc(s.b)}</em>` : ""}</button>`; }).join("")}</div>
      <p class="note sl-pnote">${ico("plZone")}<span>Dessinez votre salle dans <button class="sl-lnk" data-go="plan">Plan de salle</button> : les tables s'affichent à leur place.</span></p>`;
  }
  const readyHtml = ready.length ? `<div class="sl-ready-l st" style="--i:2">${ready.map((o) => `<div class="sl-rd${o.call ? " call" : ""}"><span class="sl-rdi">${ico(o.call ? "slCall" : "cmBell")}</span><div><b>Table ${esc(o.table)} · ${esc(o.courseT || "")}</b>${o.call ? `<strong class="sl-rdc">La cuisine vous appelle · ${slAgo(o.call)}</strong>` : ""}<em>${(o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0)} assiette${(o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0) > 1 ? "s" : ""} · prêt depuis <span class="sl-ago" data-at="${o.readyAt || o.at}">${slAgo(o.readyAt || o.at)}</span>${o.waiter && o.waiter !== S.me.id && o.waiterName ? ` · ${esc(firstName(o.waiterName))}` : ""}</em></div><button class="btn sm sl-servb" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}Servi</button></div>`).join("")}</div>` : "";
  const list = open.slice().sort((a, b) => ["ready", "draft", "hold", "cook", "open"].indexOf(slTabState(a).k) - ["ready", "draft", "hold", "cook", "open"].indexOf(slTabState(b).k) || (a.openedAt || 0) - (b.openedAt || 0));
  const right = `<button class="iconbtn" data-go="cuisine" aria-label="Écran cuisine" title="Écran cuisine">${ico("slHat")}</button>`;
  return `<div class="inner wide sl">${topBar("Prise de commande", { right })}
    <div class="sl-kpi st" style="--i:1"><div><b class="mono">${open.length}</b><span>table${open.length > 1 ? "s" : ""}</span></div><div><b class="mono">${covers}</b><span>couvert${covers > 1 ? "s" : ""}</span></div><div><b class="mono">${cook}</b><span>en cuisine</span></div>${ready.length ? `<div class="hot"><b class="mono">${ready.length}</b><span>prêt${ready.length > 1 ? "s" : ""}</span></div>` : ""}</div>
    ${slStockBar()}
    ${readyHtml}${slDueHtml()}
    ${floor}
    ${list.length ? `<div class="lbl st" style="--i:4">Tables ouvertes</div><div class="glass sl-open st" style="--i:4">${list.map((t) => { const s = slTabState(t); return `<button class="sl-or k-${s.k}" data-go="salle" data-id="${esc(t.id)}"><b class="sl-ort mono">${esc(t.table)}</b><span class="sl-ortx"><b>${esc(s.t)}</b><em>${slCovers(t)} · ${slItemsOk(t).reduce((a, x) => a + (+x.q || 0), 0)} articles · <span class="sl-ago" data-at="${t.openedAt}">${slAgo(t.openedAt)}</span>${t.byName && t.by !== S.me.id ? ` · ${esc(firstName(t.byName))}` : ""}</em></span><b class="mono sl-ortot">${slEur(slTotal(t.items || []))}</b>${ico("chev")}</button>`; }).join("")}</div>` : `<p class="note sl-pnote st" style="--i:4">${ico("slPad")}<span>Touchez une table pour prendre la commande. Elle part en cuisine d'un geste, et vous êtes prévenu quand c'est prêt.</span></p>`}
  </div>`;
}

/* ── one table ── */
function slTabView(tab) {
  const T = slTickets(tab.id), items = slItemsOk(tab), un = items.filter((x) => !x.sent);
  const wide = DESK_MQ.matches || window.matchMedia("(min-width:900px)").matches;
  if (SL.paneTab !== tab.id) { SL.paneTab = tab.id; SL.pane = items.length ? "cmd" : "carte"; }
  const held = T.filter((o) => o.status === "attente").sort((a, b) => a.course - b.course);
  const nextHeld = held[0] ? held[0].course : null;
  const right = `<button class="sl-cov" data-act="slCovers" aria-label="Couverts">${ico("users")}<b class="mono">${+tab.covers || 0}</b></button><button class="iconbtn" data-act="slTabMenu" aria-label="Plus d'actions">${ico("dots")}</button>`;
  const seg = wide ? "" : `<div class="sl-seg st" style="--i:1" role="tablist"><button class="${SL.pane === "carte" ? "on" : ""}" data-act="slPane" data-v="carte" role="tab">${ico("book")}La carte</button><button class="${SL.pane === "cmd" ? "on" : ""}" data-act="slPane" data-v="cmd" role="tab">${ico("slPad")}La commande${items.length ? `<b class="mono">${items.reduce((a, x) => a + (+x.q || 0), 0)}</b>` : ""}</button></div>`;
  const cta = un.length ? `<button class="btn acc block sl-send" data-act="slSend">${ico("slSend")}Envoyer en cuisine<b class="mono">${un.reduce((a, x) => a + (+x.q || 0), 0)}</b></button>`
    : nextHeld != null ? `<button class="btn acc block sl-send fire" data-act="slFire" data-v="${nextHeld}">${ico("slFire")}Envoyer la suite : ${esc(slCourseT(nextHeld))}</button>`
    : items.length ? `<button class="btn soft block sl-send" data-act="slBill">${ico("slBill")}Addition · ${slEur(slTotal(items))}</button>` : "";
  const carte = slCarte(tab), cmd = slOrder(tab, T);
  return `<div class="inner wide sl sl-t">${topBar(`Table ${esc(tab.table)}`, { right })}
    <div class="sl-tsub st" style="--i:1">${tab.zone && tab.zone !== "salle" ? `<span>${esc((typeof plZones === "function" ? plZones(slTables().cfg) : []).find((z) => z.id === tab.zone)?.name || tab.zone)}</span>` : ""}<span>Ouverte <span class="sl-ago" data-at="${tab.openedAt}">${slAgo(tab.openedAt)}</span></span>${tab.byName ? `<span>${esc(firstName(tab.byName))}</span>` : ""}${slClOn() ? slClChip(tab) : ""}${tab.note ? `<span class="sl-tnote">${ico("rsNote")}${esc(tab.note)}</span>` : ""}</div>
    ${slStockBar()}
    ${seg}
    <div class="sl-cols">${wide || SL.pane === "carte" ? `<div class="sl-c1">${carte}</div>` : ""}${wide || SL.pane === "cmd" ? `<div class="sl-c2">${cmd}${wide && cta ? `<div class="sl-wcta">${cta}</div>` : ""}</div>` : ""}</div>
    ${!wide && cta ? `<div class="ctabar sl-cta">${cta}</div>` : ""}
  </div>`;
}
function slClChip(tab) { const p = tab.client && fdById(tab.client); const nm = (p && p.name) || tab.clientName || "";
  return `<button class="sl-tcl${nm ? " on" : ""}" data-act="slClient" aria-label="Client de la table">${nm && p && p.vip ? `<b class="fd-vip">VIP</b>` : ico("users")}${nm ? esc(nm) : "Invité"}${p && p.allergens && p.allergens.length ? `<em>${ico("alert")}allergies</em>` : ""}</button>`; }
function slDishes() { return typeof cmDishes === "function" ? cmDishes() : (S.notes || []).filter((n) => n.cat === "Recettes" && n.carte); }
function slCarte(tab) {
  const D = slDishes(), today = dayKey();
  const cats = (typeof CM_CATS !== "undefined" ? CM_CATS : []).filter(([k]) => D.some((n) => (n.carteCat || "plat") === k));
  if (SL.cat !== "tout" && !cats.some(([k]) => k === SL.cat)) SL.cat = "tout";
  const qty = {}; (tab.items || []).filter((x) => !x.off && !x.sent).forEach((x) => { qty[x.id] = (qty[x.id] || 0) + (+x.q || 0); });
  const L = SL.cat === "tout" ? D : D.filter((n) => (n.carteCat || "plat") === SL.cat);
  if (!D.length) return `<div class="glass sl-empty"><div class="sl-ill">${ico("book")}</div><b class="h3">La carte est vide</b><p class="sub">Les plats viennent des fiches de Recettes & allergènes cochées « à la carte », avec leur prix. En attendant, ajoutez ce que vous voulez à la main.</p><div class="hstack" style="justify-content:center;flex-wrap:wrap"><button class="btn acc sm" data-act="slFree">${ico("plus")}Article hors carte</button><button class="btn soft sm" data-act="slGoCarte">${ico("book")}Remplir la carte</button></div></div>`;
  const tile = (n, i) => {
    const left0 = slAvail(n.id), o = slOut(n.id) || left0 === 0, left = left0, al = slDishAl(n.id), q = qty[n.id] || 0, hay = slNorm(n.title || "");
    return `<button class="sl-d${o ? " out" : ""}${q ? " has" : ""}${left != null && left <= 3 && !o ? " low" : ""}" style="--i:${Math.min(i, 18)}" data-act="slAdd" data-id="${esc(n.id)}" data-hay="${esc(hay)}" ${o ? "disabled" : ""}>
      <b>${esc(n.title || "Sans nom")}</b><span class="sl-dp mono">${num(n.price) > 0 ? (() => { const dl = typeof pxNowDeal === "function" ? pxNowDeal(n) : null; return dl && dl.pct > 0 ? `<s class="sl-dpo">${slEur(num(n.price))}</s> ${slEur(pxNowPrice(n))}` : slEur(num(n.price)); })() : "—"}</span>
      ${o ? `<em class="sl-dout">${slOut(n.id) ? "Épuisé" : "Plus rien à vendre"}</em>` : left != null ? `<em class="sl-dleft">Plus que ${left}</em>` : al.length ? `<em class="sl-dal">${ico("slWarn")}${al.length}</em>` : ""}${q ? `<i class="sl-dq mono">${q}</i>` : ""}</button>`;
  };
  void today;
  return `<div class="sl-carte">
    <label class="sl-search">${ico("search")}<input class="input" id="slQ" type="search" placeholder="Chercher, ou taper un plat hors carte" autocomplete="off" enterkeyhint="done"></label>
    <div class="sl-cats" role="tablist"><button class="${SL.cat === "tout" ? "on" : ""}" data-act="slCat" data-v="tout">Tout</button>${cats.map(([k, t]) => `<button class="${SL.cat === k ? "on" : ""}" data-act="slCat" data-v="${k}">${esc(t)}</button>`).join("")}</div>
    <div class="sl-dg"><button class="sl-d qadd" data-act="slFree" hidden>${ico("plus")}<b class="sl-qt"></b><span class="sl-dp">Pas sur la carte : l'ajouter</span></button>${L.map(tile).join("")}<button class="sl-d free" data-act="slFree" data-hay="autre article libre hors carte">${ico("plus")}<b>Hors carte</b><span class="sl-dp">Plat du jour, nouveauté, supplément…</span></button></div>
  </div>`;
}
const slNorm = (s) => (typeof noteNorm === "function" ? noteNorm(s) : String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")).trim();
function slFilter() {
  const raw = (SL.q || "").trim(), q = slNorm(raw); let n = 0;
  $$(".sl-dg .sl-d:not(.qadd)").forEach((b) => { const ok = !q || (b.dataset.hay || "").includes(q); b.style.display = ok ? "" : "none"; if (ok && !b.classList.contains("free")) n++; });
  const qa = $(".sl-dg .qadd"); if (qa) { qa.hidden = !q; const t = qa.querySelector(".sl-qt"); if (t) t.textContent = `« ${raw.slice(0, 40)} »`; qa.classList.toggle("solo", !n); }
  const fr = $(".sl-dg .sl-d.free"); if (fr && q) fr.style.display = "none";
}
/* ───────── stock of the day (ruptures) ─────────
   Lives in qrMenu/cfg (js/commande.js), so the QR menu follows too:
     out[dishId]  = dayKey            « Épuisé » : nobody can sell it today (waiters' pads and the QR menu)
     left[dishId] = { d, n, at, by }  « Limité » : the kitchen counted n portions at time `at`
     stockWhen    = "commande" | "envoi" | "pret" | "paye"   when a portion comes off the count (the restaurant chooses)
   The count is never decremented by hand: what is left is n minus what was sold since `at`, recomputed from the tables (salleTabs)
   and the QR orders on every device, so two phones can't count the same plate twice. What is ordered but not yet counted
   (still on a pad, not sent, not paid…) is « en cours » and is already kept aside for the waiters. Everything comes back tomorrow. */
const SL_WHEN = [["commande", "Dès que c'est commandé", "Le serveur l'ajoute sur son téléphone ou le client commande au QR code"], ["envoi", "À l'envoi en cuisine", "Le serveur touche « Envoyer en cuisine » (une commande QR part tout de suite)"], ["pret", "Quand la cuisine dit « Prêt »", "L'assiette est faite"], ["paye", "À l'encaissement", "La table est réglée et libérée, la commande QR est payée ou remise"]];
const slCfg = () => (typeof cmCfg === "function" ? cmCfg() : { out: {}, left: {} });
const slWhen = () => { const w = slCfg().stockWhen; return SL_WHEN.some((x) => x[0] === w) ? w : "envoi"; };
const slLeftE = (id) => { const e = id && (slCfg().left || {})[id]; return e && e.d === dayKey() && isFinite(+e.n) ? e : null; };
/* when the moment chosen in stockWhen happened for a line, or null if not yet */
function slStockCount(id, since) {
  const mode = slWhen(), today = dayKey(); let used = 0, pend = 0;
  const tk = new Map((CM.orders || []).map((o) => [o.id, o]));
  (SL.tabs || []).forEach((t) => {
    if (t.day !== today || t.mergedInto) return; const open = t.status === "open";
    (t.items || []).forEach((x) => {
      if (x.off || x.id !== id) return; const q = +x.q || 0, o = x.sent ? tk.get(x.sent) : null;
      const ev = mode === "commande" ? x.at || t.openedAt || 0
        : mode === "envoi" ? (x.sent ? x.sentAt || (o && o.at) || 0 : null)
        : mode === "pret" ? (o && ["prete", "servie"].includes(o.status) ? o.readyAt || o.at || 0 : null)
        : !open ? t.closedAt || 0 : null;
      if (ev == null) { if (open && !(o && o.status === "annulee")) pend += q; } else if (ev >= since) used += q;
    });
  });
  (CM.orders || []).forEach((o) => {
    if (o.src === "salle" || o.day !== today || ["annulee", "abandonnee"].includes(o.status)) return;
    const q = (o.items || []).filter((x) => x.id === id).reduce((a, x) => a + (+x.q || 0), 0); if (!q) return;
    const ev = mode === "commande" || mode === "envoi" ? o.at || 0 : mode === "pret" ? (["prete", "servie"].includes(o.status) ? o.readyAt || o.at || 0 : null) : o.paid ? o.paidAt || o.at || 0 : o.status === "servie" ? o.doneAt || o.at || 0 : null;
    if (ev == null) pend += q; else if (ev >= since) used += q;
  });
  return { used, pend };
}
/* portions left on the count (kitchen view), or null when the dish isn't counted */
const slLeft = (id) => { const e = slLeftE(id); if (!e) return null; const c = slStockCount(id, +e.at || Infinity); return Math.max(0, +e.n - c.used); };
/* what a waiter may still sell: left minus what is already ordered and not yet counted */
const slAvail = (id) => { const e = slLeftE(id); if (!e) return null; const c = slStockCount(id, +e.at || Infinity); return Math.max(0, +e.n - c.used - c.pend); };
const slPend = (id) => { const e = slLeftE(id); return e ? slStockCount(id, +e.at || Infinity).pend : 0; };
const slOut = (id) => !!id && ((slCfg().out || {})[id] === dayKey() || slLeft(id) === 0);
async function slStockSave(patch) { if (typeof cmSaveCfg === "function") await cmSaveCfg(patch); }
/* a counted dish reaching zero is written « épuisé » so the public QR menu (published from the cfg) hides it too; idempotent */
const slStockSync = debounce(async () => {
  try {
    if (!S.rid || typeof cmCfg !== "function" || !CM.cfgSeen || !SL.tabs) return; const c = slCfg(), today = dayKey(), out = { ...(c.out || {}) }; let ch = false;
    Object.keys(c.left || {}).forEach((id) => { if (out[id] !== today && slLeft(id) === 0) { out[id] = today; ch = true; } });
    if (ch) await slStockSave({ out });
  } catch (e) { console.warn("stock", e); }
}, 1200);
/* the kitchen declares a rupture or a limit: every waiter's phone rings and the pad shows it (see slStockBar) */
function slStockSeen() {
  try {
    const c = slCfg(), today = dayKey(), cur = {};
    Object.entries(c.out || {}).forEach(([id, d]) => { if (d === today) cur[id] = "out"; });
    Object.entries(c.left || {}).forEach(([id, e]) => { if (e && e.d === today && !cur[id]) cur[id] = "n" + (+e.n) + "@" + (+e.at || 0); });
    const prev = SL.stockSeen; SL.stockSeen = cur; if (!prev) return;
    const news = Object.keys(cur).filter((id) => cur[id] !== prev[id]).map((id) => ({ id, out: cur[id] === "out", e: (c.left || {})[id] })).filter((x) => x.out || (x.e && x.e.by !== S.me.id));
    if (!news.length) return;
    const waiter = S.route === "salle" || (S.route === "coupdefeu" && typeof cfRole === "function" && !["cuisine", "bar"].includes(cfRole())) || (!slKRoute(true) && SL.rid === S.rid && typeof cfRole === "function" && cfRole() === "salle");
    if (!waiter) return;
    const name = (id) => ((slDishes().find((n) => n.id === id) || {}).title || "Un plat");
    const txt = news.map((x) => (x.out ? `${name(x.id)} : épuisé` : `${name(x.id)} : plus que ${slAvail(x.id)}`)).join(" · ");
    SFX.init(); SFX.tone(880, 0.16, "triangle", 0.05); SFX.tone(660, 0.3, "triangle", 0.05, 0.14); buzz([40, 40, 40]);
    toast(`Cuisine · ${txt}`, "info");
  } catch (e) {}
}
/* the strip on top of the waiter's pad: what is limited or gone today, so the floor stops selling it */
function slStockBar() {
  const D = slDishes(), outs = D.filter((n) => slOut(n.id)), lim = D.filter((n) => !slOut(n.id) && slLeftE(n.id));
  if (!outs.length && !lim.length) return "";
  return `<div class="sl-stk st" style="--i:1" role="status"><span class="sl-stki">${ico("slBan")}</span><div class="sl-stkl"><em class="sl-stkt">${lim.length ? "Il reste" : "Épuisé"}</em>${lim.map((n) => { const v = slAvail(n.id); return `<span class="lim${v <= 3 ? " low" : ""}"><b class="mono">${v}</b>${esc(n.title || "")}</span>`; }).join("")}${outs.map((n) => `<span class="out">${esc(n.title || "")}</span>`).join("")}</div><button class="sl-stkb" data-act="slOuts">Voir</button></div>`;
}

function slOrder(tab, T) {
  const all = tab.items || [], items = all.filter((x) => !x.off);
  if (!items.length && !all.length) return `<div class="glass sl-empty sl-oempty"><div class="sl-ill">${ico("slPad")}</div><b class="h3">Rien pour l'instant</b><p class="sub">Touchez les plats de la carte : ils se rangent tout seuls en boissons, entrées, plats et desserts. Un plat qui n'est pas sur la carte ? Tapez son nom dans la recherche.</p></div>`;
  const tkSt = (c) => { const L = T.filter((o) => o.course === c); if (!L.length) return null; const pr = ["prete", "nouvelle", "prep", "attente", "servie"]; return L.map((o) => o.status).sort((a, b) => pr.indexOf(a) - pr.indexOf(b))[0]; };
  const blocks = SL_COURSES.map(([c, t, ic]) => {
    const L = all.filter((x) => +x.course === c); if (!L.length) return "";
    const live = L.filter((x) => !x.off), s = tkSt(c), unsent = live.some((x) => !x.sent), ready = T.filter((o) => o.course === c && o.status === "prete"), heldHere = T.some((o) => o.course === c && o.status === "attente");
    const cooking = T.filter((o) => o.course === c && ["nouvelle", "prep"].includes(o.status)), rushed = cooking.some((o) => o.rush);
    const pill = unsent && !s ? `<span class="pill neu">À envoyer</span>` : s ? `<span class="pill sl-p-${s}">${SL_ST[s]}${unsent ? " · + ajout" : ""}</span>` : "";
    const act = ready.length ? `<button class="btn sm sl-servb" data-act="slServed" data-id="${esc(ready[0].id)}">${ico("check")}Servi</button>`
      : heldHere && !unsent ? `<button class="btn acc sm" data-act="slFire" data-v="${c}">${ico("slFire")}Envoyer</button>`
      : cooking.length ? `<button class="btn ${rushed ? "soft" : "ghost"} sm sl-rushb${rushed ? " on" : ""}" data-act="slRush" data-v="${c}" ${rushed ? "disabled" : ""}>${ico("slBolt")}${rushed ? "Réclamé" : "Réclamer"}</button>` : "";
    return `<section class="sl-cb${s === "prete" ? " rdy" : ""}"><header>${ico(ic)}<b>${t}</b>${pill}${act}</header>
      ${L.map((x) => slLine(x)).join("")}
    </section>`;
  }).join("");
  const free = items.filter((x) => x.free), freeT = free.reduce((a, x) => a + slUnit(x) * (+x.q || 0), 0);
  return `<div class="glass sl-order">${blocks}
      ${freeT ? `<div class="sl-sub"><span>Offert</span><b class="mono">− ${slEur(freeT)}</b></div>` : ""}
      <div class="sl-tot"><span>Total</span><b class="mono">${slEur(slTotal(items))}</b></div></div>
    <p class="note sl-nf">${ico("slBill")}<span>L'addition se règle sur votre caisse : Growth Gusto prend la commande, votre caisse encaisse.</span></p>`;
}
const slMods = (x) => [...(x.without || []).map((w) => ["w", "Sans " + String(w).toLowerCase()]), ...(x.extras || []).map((e) => ["x", `+ ${e.t}${+e.p ? ` (${slEur(+e.p)})` : ""}`]), ...(x.note ? [["n", x.note]] : [])];
function slLine(x) {
  const al = x.allergy || [], dal = slDishAl(x.id), clash = al.filter((a) => dal.includes(a)), lt = slUnit(x) * (+x.q || 0);
  const tags = [x.seat ? `<i class="sl-tag seat">P${x.seat}</i>` : "", x.rush ? `<i class="sl-tag rush">${ico("slBolt")}Prioritaire</i>` : "", x.refire ? `<i class="sl-tag refire">${ico("slRedo")}Refait</i>` : "", x.free && !x.refire && !x.off ? `<i class="sl-tag free">${ico("slGift")}Offert${x.free.why ? ` · ${esc(x.free.why)}` : ""}</i>` : "", x.off ? `<i class="sl-tag off">Annulé${x.offReason ? ` · ${esc(x.offReason)}` : ""}</i>` : ""].join("");
  const qty = x.sent || x.off ? `<b class="sl-q mono">${x.q}</b>` : `<span class="sl-stp"><button data-act="slQ" data-id="${esc(x.k)}" data-v="-1" aria-label="Un de moins">${ico(+x.q > 1 ? "minus" : "trash")}</button><b class="mono">${x.q}</b><button data-act="slQ" data-id="${esc(x.k)}" data-v="1" aria-label="Un de plus">${ico("plus")}</button></span>`;
  return `<div class="sl-it${x.sent ? " sent" : ""}${x.off ? " off" : ""}${x.free ? " gift" : ""}">${qty}
    <button class="sl-in" data-act="slItem" data-id="${esc(x.k)}"><b>${esc(x.name)}${x.id ? "" : ` <i class="sl-hc">hors carte</i>`}</b>
      ${tags ? `<span class="sl-tags">${tags}</span>` : ""}
      ${slMods(x).map(([k, t]) => `<em class="m-${k}">${esc(t)}</em>`).join("")}
      ${al.length ? `<i class="sl-ial${clash.length ? " clash" : ""}">${ico("slWarn")}Allergie : ${esc(al.map((a) => slAl(a).t).join(", "))}${clash.length ? " · le plat en contient" : ""}</i>` : ""}</button>
    <button class="sl-ip mono" data-act="slItem" data-id="${esc(x.k)}">${x.free || x.off ? `<s>${slEur(lt)}</s>${x.free && !x.off ? "<b>0,00 €</b>" : ""}` : slEur(lt)}${ico("dots")}</button></div>`;
}

/* ───────── sheets ───────── */
function slOpenSheet(t) {
  const b = slBookingAt(t.id), seats = Math.max(2, +t.seats || 2), max = Math.max(8, seats + 2), def = b ? +b.covers || seats : seats;
  SL.pickT = t.id; SL.cl = b || !slClOn() ? null : { mode: "open", sel: null, q: "", nw: null };
  openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Table ${esc(t.n)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${b ? `<div class="sl-bk">${ico("resa")}<span>Réservation <b>${esc(b.name || "")}</b> · ${esc(b.time)} · ${+b.covers || 0} pers.${b.notes ? `<em>${esc(b.notes)}</em>` : ""}</span></div>` : ""}
    ${SL.cl ? `<div class="lbl">Qui est à table ?</div><div id="slCl">${slClHTML()}</div>` : ""}
    <div class="lbl">Combien de couverts ?</div>
    <div class="sl-covg">${Array.from({ length: max }, (_, i) => i + 1).map((n) => `<button class="${n === def ? "on" : ""}" data-act="slOpen" data-v="${n}">${n}</button>`).join("")}</div>
  </div>`, slClBind);
}
/* ── client de la table : choisir une fiche, en créer une, ou « Invité » ── */
const slClOn = () => typeof fdPeople === "function" && typeof fdWrite === "function" && !!VIEWS.clients;
function slClHits(q) {
  if (typeof fdWatch === "function") fdWatch(); const L = fdPeople(), t = q.trim();
  return (t ? L.filter((p) => fdMatch(p, t)) : L.filter((p) => p.visits)).sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || (b.visits || 0) - (a.visits || 0) || (b.last || "").localeCompare(a.last || "")).slice(0, 5);
}
function slClRow(p, on) {
  const cfg = typeof fdCfg === "function" ? fdCfg() : { goal: 10 };
  return `<button class="sl-clr${on ? " on" : ""}" data-act="slClPick" data-id="${esc(p.id)}" aria-pressed="${on}">${fdAva(p, 36)}<span class="tx"><b>${esc(p.name || p.phone)}${p.vip ? `<span class="fd-vip">VIP</span>` : ""}</b><em>${p.visits ? `${p.visits} visite${p.visits > 1 ? "s" : ""}` : "Pas encore venu"}${cfg.on !== false ? ` · ${Math.min(p.stamps, cfg.goal)}/${cfg.goal} tampons` : ""}${p.allergens && p.allergens.length ? ` · allergies` : ""}</em></span><i class="sl-clc">${on ? ico("check") : ""}</i></button>`;
}
function slClHTML() {
  const C = SL.cl; if (!C) return ""; const sel = C.sel && (fdById(C.sel) || (C.pend && C.pend.k === C.sel ? { id: C.sel, name: C.pend.name, visits: 0, stamps: 0, allergens: [] } : null));
  if (C.nw) return `<div class="sl-clnew"><input class="input" id="slClN" maxlength="60" placeholder="Nom du client" value="${esc(C.nw.name)}" autocomplete="off"><input class="input" id="slClP" type="tel" inputmode="tel" maxlength="25" placeholder="Téléphone" value="${esc(C.nw.phone)}" autocomplete="off">
    <div class="sl-clna"><button class="btn soft sm" data-act="slClNew" data-v="0">Annuler</button><button class="btn acc sm" data-act="slClNewOk">${ico("check")}${C.mode === "tab" ? "Créer la fiche" : "C'est lui"}</button></div><p class="sl-cle" id="slClE" role="alert"></p></div>`;
  const hits = slClHits(C.q).filter((p) => !sel || p.id !== sel.id);
  return `<div class="sl-cl">
    <button class="sl-clr guest${!C.sel ? " on" : ""}" data-act="slClPick" data-id="" aria-pressed="${!C.sel}"><span class="sl-clg">${ico("users")}</span><span class="tx"><b>Invité</b><em>Rien n'est noté dans le fichier clients</em></span><i class="sl-clc">${!C.sel ? ico("check") : ""}</i></button>
    ${sel ? slClRow(sel, true) : ""}
    <input class="input sl-clq" id="slClQ" type="search" placeholder="Nom ou téléphone du client" value="${esc(C.q)}" autocomplete="off" enterkeyhint="search">
    <div id="slClR">${slClResHTML(hits)}</div></div>`;
}
function slClResHTML(hits) { const C = SL.cl; return hits.map((p) => slClRow(p, false)).join("") + (C.q.trim() ? `<button class="sl-clr add" data-act="slClNew" data-v="1"><span class="sl-clg">${ico("plus")}</span><span class="tx"><b>Nouveau client</b><em>Créer sa fiche : son premier tampon</em></span></button>` : ""); }
function slClBind(b) {
  const q = b && $("#slClQ", b); if (q) q.addEventListener("input", () => { if (!SL.cl) return; SL.cl.q = q.value; const sel = SL.cl.sel; const r = $("#slClR", b); if (r) r.innerHTML = slClResHTML(slClHits(q.value).filter((p) => p.id !== sel)); });
  ["slClN", "slClP"].forEach((id) => { const i = b && $("#" + id, b); if (i) i.addEventListener("input", () => { if (SL.cl && SL.cl.nw) SL.cl.nw[id === "slClN" ? "name" : "phone"] = i.value; }); });
}
function slClPaint() { const w = $("#slCl"); if (!w) return; w.innerHTML = slClHTML(); slClBind(w); }
/* the counter visit: one stamp in the client file, at that time (so it can be moved if the waiter picked the wrong person) */
async function slClStamp(k, extra) {
  const d = fdDocs().find((x) => x.id === k) || {}; const at = Date.now();
  await fdWrite(k, { ...(extra || {}), passes: (Array.isArray(d.passes) ? d.passes : []).concat(at).slice(-120) });
  logEvent("client", `a noté la venue de ${(extra && extra.name) || (fdById(k) || {}).name || "un client"} à table`); return at;
}
async function slClUnstamp(ps) { if (!ps || !ps.k) return; const d = fdDocs().find((x) => x.id === ps.k); if (!d || !Array.isArray(d.passes)) return; const passes = d.passes.filter((t) => +t !== +ps.at); if (passes.length !== d.passes.length) await fdWrite(ps.k, { passes }); }
/* the chosen client (or a new one) → { k, name } ; null for a guest ; false when the new client is not complete */
async function slClResolve() {
  const C = SL.cl; if (!C) return null;
  if (C.nw) { const name = C.nw.name.trim(), phone = C.nw.phone.trim(), k = fdKey(phone), e = $("#slClE");
    if (name.length < 2) { SFX.err(); if (e) e.textContent = "Le nom du client, s'il vous plaît."; return false; }
    if (!k) { SFX.err(); if (e) e.textContent = phone ? "Ce numéro semble incomplet." : "Son téléphone, pour le retrouver la prochaine fois."; return false; }
    const ex = fdById(k); return ex && ex.doc ? { k, name: ex.name || name } : { k, name: name.slice(0, 60), fresh: { name: name.slice(0, 60), phone: phone.slice(0, 25), src: "salle" } }; }
  if (!C.sel) return null; if (C.pend && C.pend.k === C.sel) return C.pend; const p = fdById(C.sel); return p ? { k: p.id, name: p.name || p.phone || "" } : null;
}
function slClToast(k) { const p = fdById(k), cfg = typeof fdCfg === "function" ? fdCfg() : null; if (!p) return; const full = cfg && typeof fdReward === "function" && fdReward(p, cfg);
  toast(full ? `${firstName(p.name) || "Ce client"} : carte pleine, ${String(cfg.reward).toLowerCase()} à offrir` : `Venue notée pour ${firstName(p.name) || p.name}${cfg && cfg.on !== false ? ` · ${Math.min(p.stamps, cfg.goal)}/${cfg.goal}` : ""}`, full ? "info" : undefined); }
/* one line of the order: everything a waiter may need, in one sheet */
function slItemOpen(tab, x, mode) {
  SL.ed = { tab: tab.id, k: x.k, mode: mode || "edit", q: +x.q || 1, n: 1, note: x.note || "", al: [...(x.allergy || [])], course: +x.course, without: [...(x.without || [])], extras: (x.extras || []).map((e) => ({ ...e })),
    seat: +x.seat || 0, rush: !!x.rush, free: x.free ? { ...x.free } : null, why: "", xt: "", xp: "" };
  slItemPaint(true);
}
function slEdItem() { const e = SL.ed, tab = e && slTabOf(e.tab); return { e, tab, x: tab && (tab.items || []).find((y) => y.k === e.k) }; }
/* read the free fields before a repaint */
function slEdRead() {
  const e = SL.ed; if (!e) return; const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  const f = v("slEdNote"); if (f != null) e.note = [...e.note.split(", ").filter((n) => SL_NOTES.includes(n)), ...(f.trim() ? [f.trim()] : [])].join(", ");
  const xt = v("slEdXt"), xp = v("slEdXp"); if (xt != null) e.xt = xt; if (xp != null) e.xp = xp;
}
function slItemPaint(first) {
  const { e, tab, x } = slEdItem(); if (!x) { closeSheet(); return; }
  const dal = slDishAl(x.id), clash = e.al.filter((a) => dal.includes(a)), sent = !!x.sent, n = (S.notes || []).find((y) => y.id === x.id);
  const T = sent ? (CM.orders || []).find((o) => o.id === x.sent) : null, cov = Math.min(12, +tab.covers || 0);
  const head = `<div class="sl-shh"><span class="h2">${esc(x.name)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub sl-shs">${slEur(slUnit(x))}${dal.length ? ` · contient : ${esc(dal.map((a) => slAl(a).t).join(", "))}` : x.id ? " · aucun allergène sur la fiche" : " · hors carte"}${T ? ` · <b>${SL_ST[T.status] || ""}</b>` : ""}</p>`;
  const seg = (L, cur, act) => `<div class="sl-segs">${L.map(([v, t]) => `<button class="${String(cur) === String(v) ? "on" : ""}" data-act="${act}" data-v="${v}">${t}</button>`).join("")}</div>`;
  const chips = (L, on, act, cls) => `<div class="sl-chips">${L.map((v) => `<button class="chip${on(v) ? " on" + (cls ? " " + cls : "") : ""}" data-act="${act}" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div>`;
  const why = (L) => chips(L, (v) => e.why === v, "slEdWhy");
  const qn = (max) => max > 1 ? `<div class="sl-row"><span class="lbl">Combien ?</span><div class="cm-step"><button data-act="slEdN" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${e.n} / ${max}</b><button data-act="slEdN" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>` : "";
  let body;
  if (e.mode === "cancel") {
    body = `<div class="sl-mh">${ico("x")}<b>Annuler ${sent ? "ce plat envoyé" : "ce plat"}</b></div>${qn(+x.q)}
      <div class="field"><span class="lbl">Pourquoi ?</span>${why(SL_CANCEL_WHY)}</div>
      ${sent ? `<div class="sl-bk">${ico("slHat")}<span>La cuisine voit le plat barré « annulé », avec un signal sonore.</span></div>` : ""}
      <div class="grid2"><button class="btn soft" data-act="slEdMode" data-v="edit">Retour</button><button class="btn danger" data-act="slEdCancel">${ico("x")}Annuler${e.n > 1 ? " " + e.n + " plats" : ""}</button></div>`;
  } else if (e.mode === "offer") {
    body = `<div class="sl-mh gift">${ico("slGift")}<b>Offrir ${e.q > 1 || +x.q > 1 ? "" : "ce plat"}</b></div>${qn(+x.q)}
      <div class="field"><span class="lbl">Pourquoi ?</span>${why(SL_OFFER_WHY)}</div>
      <div class="sl-bk">${ico("slBill")}<span>Le plat reste en cuisine. Sur l'addition, il passe à 0 € : faites de même sur la caisse (offert / remise).</span></div>
      <div class="grid2"><button class="btn soft" data-act="slEdMode" data-v="edit">Retour</button><button class="btn acc" data-act="slEdOffer">${ico("slGift")}Offrir</button></div>`;
  } else if (e.mode === "refire") {
    body = `<div class="sl-mh">${ico("slRedo")}<b>Refaire en cuisine</b></div>${qn(+x.q)}
      <div class="field"><span class="lbl">Pourquoi ?</span>${why(SL_REFIRE_WHY)}</div>
      <div class="sl-bk">${ico("slBolt")}<span>Part tout de suite en cuisine, en priorité. Le plat refait n'est pas compté deux fois sur l'addition.</span></div>
      <div class="grid2"><button class="btn soft" data-act="slEdMode" data-v="edit">Retour</button><button class="btn acc" data-act="slEdRefire">${ico("slRedo")}Refaire</button></div>`;
  } else if (e.mode === "move") {
    const others = slOpenTabs().filter((t) => t.id !== tab.id), used = new Set(slTabMap().keys()), freeT = slTables().T.filter((t) => !used.has(t.id));
    body = `<div class="sl-mh">${ico("slMove")}<b>Déplacer vers une autre table</b></div>${qn(+x.q)}
      ${others.length ? `<div class="lbl">Tables ouvertes</div><div class="sl-tchips">${others.map((t) => `<button data-act="slEdMoveTo" data-id="${esc(t.id)}"><b class="mono">${esc(t.table)}</b><em>${slCovers(t)}</em></button>`).join("")}</div>` : ""}
      ${freeT.length ? `<div class="lbl">Tables libres</div><div class="sl-tchips">${freeT.map((t) => `<button class="free" data-act="slEdMoveNew" data-id="${esc(t.id)}"><b class="mono">${esc(t.n)}</b><em>libre</em></button>`).join("")}</div>` : ""}
      ${sent ? `<p class="note">Le bon déjà en cuisine garde sa table : seul le compte change.</p>` : ""}
      <button class="btn soft block" data-act="slEdMode" data-v="edit">Retour</button>`;
  } else if (sent || x.off) {
    const can = !x.off;
    body = `${x.off ? `<div class="sl-clash">${ico("x")}<span>Annulé${x.offReason ? ` : ${esc(x.offReason)}` : ""}.</span></div>` : `<div class="sl-bk">${ico("slSend")}<span>Déjà envoyé en cuisine. Le plat ne se modifie plus : annulez-le et ajoutez-le à nouveau si besoin.</span></div>`}
      ${slMods(x).length || (x.allergy || []).length ? `<div class="sl-mods">${slMods(x).map(([k, t]) => `<em class="m-${k}">${esc(t)}</em>`).join("")}${(x.allergy || []).map((a) => `<i class="sl-ial clash">${ico("slWarn")}${esc(slAl(a).t)}</i>`).join("")}</div>` : ""}
      ${can ? `<div class="sl-acts">
        <button data-act="slEdMode" data-v="refire">${ico("slRedo")}<b>Refaire</b><em>Retour, assiette tombée</em></button>
        <button data-act="${x.free ? "slEdUnoffer" : "slEdMode"}" data-v="offer" class="${x.free ? "on" : ""}">${ico("slGift")}<b>${x.free ? "Ne plus offrir" : "Offrir"}</b><em>${x.free ? esc(x.free.why || "Offert") : "Geste, anniversaire"}</em></button>
        <button data-act="slEdMode" data-v="move">${ico("slMove")}<b>Déplacer</b><em>Vers une autre table</em></button>
        <button class="bad" data-act="slEdMode" data-v="cancel">${ico("x")}<b>Annuler</b><em>Prévient la cuisine</em></button></div>` : ""}
      <button class="btn soft block" data-act="sheetClose">Fermer</button>`;
  } else {
    const ings = n ? [...new Set((n.ingredients || []).map((g) => String((g && g.name) || "").trim()).filter((s) => s && s.length < 32))].slice(0, 12) : [];
    body = `<div class="sl-row"><span class="lbl">Quantité</span><div class="cm-step"><button data-act="slEdQ" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${e.q}</b><button data-act="slEdQ" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>
    <div class="field"><span class="lbl">Suite</span>${seg(SL_COURSES.map(([c, t]) => [c, t]), e.course, "slEdC")}</div>
    ${cov > 1 ? `<div class="field"><span class="lbl">Pour qui ?</span><div class="sl-chips seats"><button class="chip${!e.seat ? " on" : ""}" data-act="slEdSeat" data-v="0">Table</button>${Array.from({ length: cov }, (_, i) => `<button class="chip${e.seat === i + 1 ? " on" : ""}" data-act="slEdSeat" data-v="${i + 1}">P${i + 1}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span class="lbl">Préparation</span>${chips(SL_NOTES, (v) => e.note.split(", ").includes(v), "slEdNt")}
      <input class="input" id="slEdNote" maxlength="80" placeholder="Note libre pour la cuisine" value="${esc(e.note.split(", ").filter((v) => !SL_NOTES.includes(v)).join(", "))}"></div>
    ${ings.length ? `<div class="field"><span class="lbl">Sans…</span>${chips(ings, (v) => e.without.includes(v), "slEdW", "w")}</div>` : ""}
    <div class="field"><span class="lbl">Suppléments</span>
      ${e.extras.length ? `<div class="sl-xl">${e.extras.map((x2, i) => `<span class="sl-x"><b>+ ${esc(x2.t)}</b><em class="mono">${+x2.p ? slEur(+x2.p) : "inclus"}</em><button data-act="slEdXDel" data-v="${i}" aria-label="Retirer">${ico("x")}</button></span>`).join("")}</div>` : ""}
      <div class="sl-xadd"><input class="input" id="slEdXt" maxlength="40" placeholder="Frites, œuf, sauce…" value="${esc(e.xt)}"><input class="input mono" id="slEdXp" inputmode="decimal" placeholder="0,00 €" value="${esc(e.xp)}"><button class="btn soft sm" data-act="slEdXAdd" aria-label="Ajouter le supplément">${ico("plus")}</button></div></div>
    <div class="field"><span class="lbl">Allergie du client</span>${chips(ALLERGENS.map((a) => a.id), (v) => e.al.includes(v), "slEdA", "al").replace(/data-v="([^"]+)">\1</g, (m, id) => `data-v="${id}">${esc(slAl(id).t)}<`)}
      ${clash.length ? `<div class="sl-clash">${ico("slWarn")}<span><b>Attention :</b> ce plat contient ${esc(clash.map((a) => slAl(a).t.toLowerCase()).join(", "))}. Vérifiez avec la cuisine.</span></div>` : ""}</div>
    <div class="sl-togs"><button class="cm-tog${e.rush ? " on" : ""}" data-act="slEdRush" aria-pressed="${e.rush}"><span class="cm-tt"><b>Prioritaire</b><em>La cuisine le sort en premier.</em></span><span class="cm-sw${e.rush ? " on" : ""}"><i></i></span></button>
      <button class="cm-tog${e.free ? " on" : ""}" data-act="slEdFree" aria-pressed="${!!e.free}"><span class="cm-tt"><b>Offert</b><em>${e.free ? esc(e.free.why || "Geste commercial") : "Passe à 0 € sur l'addition."}</em></span><span class="cm-sw${e.free ? " on" : ""}"><i></i></span></button></div>
    ${e.free ? chips(SL_OFFER_WHY, (v) => (e.free.why || "") === v, "slEdFreeWhy") : ""}
    <div class="sl-shf"><button class="btn soft" data-act="slEdMode" data-v="move" aria-label="Déplacer">${ico("slMove")}</button><button class="btn soft" data-act="slEdDel">${ico("trash")}Retirer</button><button class="btn acc" data-act="slEdSave">${ico("check")}Enregistrer</button></div>`;
  }
  const html = `<div class="sl-sh ed m-${e.mode}">${head}${body}</div>`;
  const cur = $(".sl-sh.ed"); if (cur && !first) { cur.outerHTML = html; } else openSheet(html);
}
function slBillSheet(tab) {
  SL.bill = SL.bill && SL.bill.tab === tab.id ? SL.bill : { tab: tab.id, mode: "tout", n: Math.max(1, +tab.covers || 1), sel: [] };
  slBillPaint(true);
}
function slBillPaint(first) {
  const b = SL.bill, tab = slTabOf(b.tab); if (!tab) { closeSheet(); return; }
  const items = slItemsOk(tab), agg = new Map();
  items.forEach((x) => { const k = [x.name, slUnit(x), x.free ? 1 : 0, (x.extras || []).map((e) => e.t).join("+")].join("|"); const a = agg.get(k) || { k, name: x.name, unit: slUnit(x), free: !!x.free, extras: x.extras || [], q: 0 }; a.q += +x.q || 0; agg.set(k, a); });
  const rows = [...agg.values()], tot = slTotal(items), cov = +tab.covers || 0, held = slTickets(tab.id).filter((o) => o.status === "attente").length, cook = slTickets(tab.id).filter((o) => ["nouvelle", "prep", "prete"].includes(o.status)).length;
  const freeRows = rows.filter((a) => a.free), paid = rows.filter((a) => !a.free), sel = new Set(b.sel), selT = paid.filter((a) => sel.has(a.k)).reduce((s, a) => s + a.unit * a.q, 0);
  const line = (a, pick) => `<div class="${pick ? "pick" + (sel.has(a.k) ? " on" : "") : ""}"${pick ? ` data-act="slBillPick" data-v="${esc(a.k)}" role="button"` : ""}>${pick ? `<i class="sl-ck">${ico("check")}</i>` : ""}<b class="mono">${a.q}</b><span>${esc(a.name)}${a.extras.length ? `<small>${esc(a.extras.map((e) => "+ " + e.t).join(", "))}</small>` : ""}</span><em class="mono">${a.free ? "0,00 €" : slEur(a.unit * a.q)}</em></div>`;
  const seg = `<div class="sl-segs sm">${[["tout", "Tout"], ["pers", "Par personne"], ["plats", "Au détail"]].map(([k, t]) => `<button class="${b.mode === k ? "on" : ""}" data-act="slBillMode" data-v="${k}">${t}</button>`).join("")}</div>`;
  const split = b.mode === "pers" ? `<div class="sl-split"><span>En</span><div class="cm-step"><button data-act="slBillN" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${b.n}</b><button data-act="slBillN" data-v="1" aria-label="Plus">${ico("plus")}</button></div><span>parts de</span><b class="mono sl-big">${slEur(Math.ceil((tot / b.n) * 100) / 100)}</b></div>`
    : b.mode === "plats" ? `<div class="sl-split"><span>Sélection</span><b class="mono sl-big">${slEur(selT)}</b>${sel.size ? `<button class="btn ghost sm" data-act="slBillClear">Effacer</button>` : `<em>Touchez ce que règle ce client</em>`}</div>` : "";
  const html = `<div class="sl-sh bill"><div class="sl-shh"><span class="h2">Addition · Table ${esc(tab.table)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${seg}
    <div class="sl-bill">${paid.map((a) => line(a, b.mode === "plats")).join("")}
      ${freeRows.length ? `<div class="sl-bgrp">${ico("slGift")}Offert</div>${freeRows.map((a) => line(a, false)).join("")}` : ""}
      <div class="sl-btot"><span>Total TTC</span><b class="mono">${slEur(tot)}</b></div>${cov ? `<p>${cov} couvert${cov > 1 ? "s" : ""} · ${slEur(tot / cov)} par personne</p>` : ""}</div>
    ${split}
    <div class="sl-bk">${ico("slBill")}<span>Encaissez sur votre caisse habituelle : c'est elle qui édite la note et le ticket.${freeRows.length ? " Passez les plats offerts en « offert » sur la caisse." : ""}</span></div>
    ${held || cook ? `<div class="sl-clash">${ico("slWarn")}<span>${held ? `${held} suite${held > 1 ? "s" : ""} pas encore envoyée${held > 1 ? "s" : ""} : elle${held > 1 ? "s" : ""} sera annulée${held > 1 ? "s" : ""} en cuisine.` : `Un bon est encore en cuisine.`}</span></div>` : ""}
    <button class="btn acc block" data-act="slClose">${ico("check")}Table réglée, libérer la table</button>
  </div>`;
  const cur = $(".sl-sh.bill"); if (cur && !first) cur.outerHTML = html; else openSheet(html);
}

/* ───────── kitchen tickets ───────── */
const slLineOut = (x) => ({ k: x.k, id: x.id || "", name: x.name, price: +x.price || 0, q: +x.q || 1, note: x.note || "", allergy: x.allergy || [],
  ...(x.without && x.without.length ? { without: x.without } : {}), ...(x.extras && x.extras.length ? { extras: x.extras } : {}), ...(x.seat ? { seat: +x.seat } : {}), ...(x.rush ? { rush: true } : {}), ...(x.refire ? { refire: x.refire } : {}) });
async function slSend(tab) {
  const un = slItemsOk(tab).filter((x) => !x.sent); if (!un.length) return;
  const T = slTickets(tab.id), food = T.filter((o) => o.course > 0);
  let firedMax = Math.max(0, ...food.filter((o) => o.status !== "attente").map((o) => o.course));
  const courses = [...new Set(un.map((x) => +x.course))].sort((a, b) => a - b), now = Date.now();
  let n = slNextN(), firedNew = false; const sentFood = [];
  for (const c of courses) {
    const L = un.filter((x) => +x.course === c);
    const lower = food.some((o) => o.course < c) || sentFood.some((x) => x < c);
    const fire = c === 0 || c <= firedMax || (!lower && !firedNew);
    if (c > 0) { sentFood.push(c); if (fire) { firedNew = true; firedMax = Math.max(firedMax, c); } }
    const lines = L.map(slLineOut), rush = L.some((x) => x.rush);
    const held = !fire && T.find((o) => o.course === c && o.status === "attente");
    if (held) {
      const items = [...(held.items || []), ...lines];
      await safe(DB.update("clientOrders", held.id, { items, total: slTotal(items), ...(rush ? { rush: true } : {}) }));
      L.forEach((x) => { x.sent = held.id; x.sentAt = now; });
      continue;
    }
    const id = slId("sl"); SL.mine.add(id);
    const doc = { src: "salle", mode: "table", table: String(tab.table), tableId: tab.tableId || "", tabId: tab.id, course: c, courseT: slCourseT(c), station: c === 0 ? "bar" : "cuisine", covers: +tab.covers || 0,
      items: lines, total: slTotal(lines), n: n++, day: dayKey(), at: now, waiter: S.me.id, waiterName: (typeof esActorName === "function" && esActorName()) || S.me.name || "", status: fire ? "nouvelle" : "attente", pay: "place", paid: false, name: "", phone: "", slot: "", note: tab.note || "",
      ...(fire ? { firedAt: now } : {}), ...(T.some((o) => o.course === c) ? { add: true } : {}), ...(rush ? { rush: true } : {}) };
    await safe(DB.set("clientOrders", id, doc));
    L.forEach((x) => { x.sent = id; x.sentAt = now; });
    if (DB.mode === "demo" && fire) slDemoCook(id);
  }
  await slSaveTab(tab);
  /* counted dishes: the count follows by itself (slStockCount); tell the waiter when that was the last one */
  const zero = [...new Set(un.filter((x) => x.id && slAvail(x.id) === 0).map((x) => x.name))]; slStockSync();
  SFX.done(); buzz([16, 40, 16]); if (typeof burst === "function") try { burst(); } catch (e) {}
  const heldNow = slTickets(tab.id).some((o) => o.status === "attente");
  toast(zero.length ? `Envoyé · ${zero.join(", ")} : plus rien, épuisé` : heldNow ? "Envoyé en cuisine · la suite attend votre signal" : "Envoyé en cuisine");
  SL.pane = "cmd";
}
async function slFire(tab, c) {
  const L = slTickets(tab.id).filter((o) => o.status === "attente" && (c == null || o.course === +c)); if (!L.length) return;
  const now = Date.now();
  for (const o of L) { SL.mine.add(o.id); await safe(DB.update("clientOrders", o.id, { status: "nouvelle", firedAt: now, at: now })); if (DB.mode === "demo") slDemoCook(o.id); }
  SFX.done(); buzz([16, 40, 16]); toast(`${slCourseT(c != null ? c : L[0].course)} : la cuisine lance la suite`);
}
async function slSaveTab(tab) {
  const items = (tab.items || []).map((x) => ({ ...x })); tab.total = slTotal(items);
  await safe(DB.update("salleTabs", tab.id, { items, total: tab.total, updatedAt: Date.now() }));
}
/* a sent line changes (cancelled): the kitchen ticket follows, with a « modifié » signal */
async function slTicketOff(x, n, why) {
  const o = (CM.orders || []).find((y) => y.id === x.sent); if (!o) return;
  const items = []; (o.items || []).forEach((y) => {
    if (y.k !== x.k) { items.push(y); return; }
    if (n >= +y.q) items.push({ ...y, off: true, offReason: why || "" });
    else { items.push({ ...y, q: +y.q - n }); items.push({ ...y, k: y.k + "x", q: n, off: true, offReason: why || "" }); }
  });
  const left = items.some((y) => !y.off);
  await safe(DB.update("clientOrders", o.id, { items, total: slTotal(items), mod: Date.now(), ...(left ? {} : { status: "annulee", cancelledAt: Date.now(), cancelledBy: S.me.id }) }));
}
/* split a line: n of q go elsewhere (cancel, offer, move, refire) */
function slSplit(tab, x, n) {
  if (n >= +x.q) return x;
  x.q = +x.q - n; const y = { ...x, k: slId("i"), q: n }; const i = tab.items.indexOf(x); tab.items.splice(i + 1, 0, y); return y;
}
const slCurTab = () => (S.route === "salle" && S.params && S.params.id ? slTabOf(S.params.id) : null);

/* ───────── view: écran cuisine ───────── */
VIEWS.cuisine = {
  render() {
    slWatch();
    const all = slKitchen(), st = SL.station, today = dayKey();
    const barAway = typeof brOn === "function" && brOn(); /* the bar has its own screen (js/bar.js): its tickets leave « Tout » */
    const inSt = (o) => (st === "tout" ? !(barAway && o.station === "bar") : st === "bar" ? o.station === "bar" : o.station !== "bar");
    const live = all.filter((o) => ["nouvelle", "prep"].includes(o.status) && inSt(o)).sort((a, b) => (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || (a.firedAt || a.at || 0) - (b.firedAt || b.at || 0));
    const ready = all.filter((o) => o.status === "prete" && inSt(o)).sort((a, b) => (a.readyAt || 0) - (b.readyAt || 0));
    const held = all.filter((o) => o.status === "attente" && inSt(o)).sort((a, b) => (a.at || 0) - (b.at || 0));
    const done = (CM.orders || []).filter((o) => o.day === today && o.readyAt && inSt(o) && ["prete", "servie"].includes(o.status));
    const times = done.filter((o) => (o.firedAt || o.at) && o.readyAt > (o.firedAt || o.at)).map((o) => (o.readyAt - (o.firedAt || o.at)) / 6e4);
    const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, late = live.filter((o) => slMin(o.firedAt || o.at) >= 20).length;
    const hist = (CM.orders || []).filter((o) => o.day === today && inSt(o) && o.readyAt && o.status === "servie").sort((a, b) => (b.doneAt || b.readyAt || 0) - (a.doneAt || a.readyAt || 0)).slice(0, 6);
    const allDay = new Map(), later = new Map();
    live.forEach((o) => (o.items || []).forEach((x) => { if (x.off || x.ok) return; allDay.set(x.name, (allDay.get(x.name) || 0) + (+x.q || 0)); }));
    held.forEach((o) => (o.items || []).forEach((x) => { if (x.off) return; later.set(x.name, (later.get(x.name) || 0) + (+x.q || 0)); }));
    const dayRows = [...new Set([...allDay.keys(), ...later.keys()])].map((k) => [k, allDay.get(k) || 0, later.get(k) || 0]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
    const outs = slDishes().filter((n) => slOut(n.id) || slLeft(n.id) != null);
    const hasBar = all.some((o) => o.station === "bar");
    const sound = SFX.ctx && SFX.ctx.state === "running";
    const right = `<span class="sl-clock mono" id="slClock">${hm(Date.now())}</span><button class="iconbtn${SL.print ? " on" : ""}" data-act="slPrintTog" aria-pressed="${SL.print}" aria-label="Imprimer chaque nouveau bon" title="Imprimer chaque nouveau bon">${ico("printer")}</button>`;
    const pas = (o) => `${(o.items || []).reduce((a, x) => a + (x.off ? 0 : +x.q || 0), 0)}`;
    return `<div class="inner wide sl sl-k">${topBar("Écran cuisine", { right })}
      ${sound ? "" : `<button class="sl-snd st" style="--i:1" data-act="slSound">${ico("sound")}<span><b>Touchez pour activer le carillon</b><em>La tablette sonne à chaque nouveau bon et à chaque changement.</em></span></button>`}
      <div class="sl-kbar st" style="--i:1"><div class="sl-segs sm">${[["tout", "Tout"], ["cuisine", "Cuisine"], ...(hasBar || st === "bar" ? [["bar", "Bar"]] : [])].map(([k, t]) => `<button class="${st === k ? "on" : ""}" data-act="slStation" data-v="${k}">${t}</button>`).join("")}</div>
        <div class="sl-kst"><span><b class="mono">${live.length}</b>en cours</span><span><b class="mono">${held.length}</b>à suivre</span><span class="${late ? "bad" : ""}"><b class="mono">${late}</b>en retard</span><span><b class="mono">${avg != null ? avg + "'" : "–"}</b>temps moyen</span><span><b class="mono">${done.length}</b>envoyés</span></div>
        ${barAway ? `<button class="btn ghost sm sl-tobar" data-go="bar" title="Les boissons partent sur l'écran bar">${ico("slGlass")}Écran bar</button>` : ""}<button class="btn soft sm sl-86b" data-act="slOuts">${ico("slBan")}Ruptures${outs.length ? `<b class="mono">${outs.length}</b>` : ""}</button></div>
      <div class="sl-kwrap">
        <div class="sl-kgrid">${live.map((o, i) => slKCard(o, i)).join("") || `<div class="glass sl-empty sl-kempty st" style="--i:2"><div class="cm-rail-ill" aria-hidden="true"><i></i><i></i><i></i></div><b class="h3">Rien sur le feu</b><p class="sub">Les bons de la salle et du menu QR arrivent ici, le plus ancien en premier, les prioritaires devant.</p></div>`}</div>
        <aside class="sl-kside">
          ${dayRows.length ? `<div class="glass sl-ks day"><header>${ico("slList")}<b>Total par plat</b></header>${dayRows.map(([k, a, b]) => `<div class="sl-kd"><b class="mono">${a || "–"}</b><span>${esc(k)}</span>${b ? `<em class="mono">+${b} à suivre</em>` : ""}</div>`).join("")}</div>` : ""}
          <div class="glass sl-ks"><header>${ico("cmBell")}<b>Prêts</b><span class="mono">${ready.length}</span></header>${ready.map((o) => `<div class="sl-kr${o.call ? " call" : ""}"><div><b>${esc(slWho(o))}</b><em>${o.src === "salle" ? `${esc(o.courseT || "")} · ` : ""}${pas(o)} · <span class="cm-ago" data-at="${o.readyAt || o.at}">${slAgo(o.readyAt || o.at)}</span>${o.call ? ` · serveur rappelé ${slAgo(o.call)}` : ""}</em></div>
            ${o.src === "salle" ? `<button class="btn ghost sm sl-callb${o.call ? " on" : ""}" data-act="slCall" data-id="${esc(o.id)}" title="Fait sonner le téléphone du serveur et l'écran Prise de commande">${ico("slCall")}${o.call ? "Rappelé" : "Rappeler"}</button>` : ""}<button class="btn sm sl-servb" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}${o.src === "salle" ? "Parti" : "Remis"}</button></div>`).join("") || `<p class="sl-ksn">Rien en attente au passe.</p>`}</div>
          <div class="glass sl-ks hold"><header>${ico("clock")}<b>À suivre</b><span class="mono">${held.length}</span></header>${held.map((o) => `<div class="sl-kh"><b>Table ${esc(o.table)} · ${esc(o.courseT)}${o.rush ? ` <i class="sl-tag rush">${ico("slBolt")}</i>` : ""}</b><em>${(o.items || []).filter((x) => !x.off).map((x) => `${x.q} ${esc(x.name)}`).join(", ")}</em>${(o.items || []).some((x) => (x.allergy || []).length) ? `<i class="sl-ial clash">${ico("slWarn")}Allergie</i>` : ""}</div>`).join("") || `<p class="sl-ksn">Les suites annoncées par la salle s'affichent ici avant d'être lancées.</p>`}</div>
          ${hist.length ? `<div class="glass sl-ks hist"><header>${ico("slRedo")}<b>Envoyés</b></header>${hist.map((o) => `<div class="sl-kr"><div><b>${esc(slWho(o))}${o.src === "salle" ? ` · ${esc(o.courseT || "")}` : ""}</b><em>${pas(o)} · parti ${slAgo(o.doneAt || o.readyAt)}</em></div><button class="btn ghost sm" data-act="slRecall" data-id="${esc(o.id)}">Rappeler</button></div>`).join("")}</div>` : ""}
        </aside>
      </div>
    </div>`;
  },
  after(v) {
    clearInterval(SL.kTick);
    SL.kTick = setInterval(() => {
      if (S.route !== "cuisine") { clearInterval(SL.kTick); slWake(false); return; }
      const c = document.getElementById("slClock"); if (c) c.textContent = hm(Date.now());
      $$(".sl-kt[data-at]").forEach((el) => { const m = slMin(+el.dataset.at); const k = el.closest(".sl-kcard"); el.textContent = slAgo(+el.dataset.at); if (k) { k.classList.toggle("warm", m >= 10 && m < 20); k.classList.toggle("late", m >= 20); } });
      $$(".sl-kr .cm-ago[data-at]").forEach((el) => { el.textContent = slAgo(+el.dataset.at); });
    }, 10000);
    slWake(true);
    $$(".sl-kcard.fresh", v).forEach((el) => setTimeout(() => el.classList.remove("fresh"), 2600)); setTimeout(() => CM.fresh.clear(), 2700);
  },
};
function slKCard(o, i) {
  const t0 = o.firedAt || o.at, m = slMin(t0), salle = o.src === "salle", modNew = o.mod && Date.now() - o.mod < 5 * 6e4;
  const later = salle ? slTickets(o.tabId).filter((x) => x.status === "attente" && x.id !== o.id) : [];
  const head = salle ? `<b class="sl-ktab">Table <span class="mono">${esc(o.table)}</span></b><span class="sl-kcrs">${esc(o.courseT || "")}</span>`
    : `<b class="sl-ktab">${o.mode === "table" ? `Table <span class="mono">${esc(o.table)}</span>` : `${ico("cmBag")}<span class="mono">${esc(o.slot || "")}</span>`}</b><span class="sl-kcrs qr">${o.mode === "table" ? "Commande QR" : `À emporter n° ${o.n}`}</span>`;
  const meta = [salle && o.waiterName ? firstName(o.waiterName) : "", salle && o.covers ? `${o.covers} couv.` : "", !salle && o.name ? o.name : "", !salle ? (o.paid ? "payée" : o.settled ? "réglée" : o.mode === "table" ? "" : "à encaisser") : ""].filter(Boolean);
  const flags = [o.rush ? `<span class="sl-flag rush">${ico("slBolt")}Prioritaire</span>` : "", o.items && o.items.some((x) => x.refire) ? `<span class="sl-flag refire">${ico("slRedo")}À refaire</span>` : "", modNew ? `<span class="sl-flag mod">${ico("slWarn")}Modifié</span>` : "", o.add ? `<span class="sl-add">Ajout</span>` : "", o.status === "prep" ? `<span class="sl-fire">${ico("slFire")}Sur le feu</span>` : ""].join("");
  return `<article class="sl-kcard s-${o.status}${m >= 20 ? " late" : m >= 10 ? " warm" : ""}${CM.fresh.has(o.id) ? " fresh" : ""}${o.station === "bar" ? " bar" : ""}${o.rush ? " rush" : ""}" style="--i:${Math.min(i, 10)}" data-id="${esc(o.id)}">
    <header>${head}<span class="sl-kt mono" data-at="${t0}">${slAgo(t0)}</span></header>
    ${!salle && typeof cmDue === "function" && cmDue(o) ? cmDueBand(o, true) : ""}
    <div class="sl-kmeta">${flags}${meta.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
    <ul class="sl-kit">${(o.items || []).map((x, j) => `<li class="${x.ok ? "ok" : ""}${x.off ? " off" : ""}" data-act="slKItem" data-id="${esc(o.id)}" data-v="${j}"><b class="mono">${x.q}</b><span><span class="sl-kn">${esc(x.name)}${x.seat ? ` <i class="sl-tag seat">P${x.seat}</i>` : ""}${x.rush && !o.rush ? ` <i class="sl-tag rush">${ico("slBolt")}</i>` : ""}${typeof brLineTag === "function" ? brLineTag(o, x) : ""}${typeof rpBtn === "function" ? rpBtn(o, x, j) : ""}</span>${x.off ? `<i class="sl-ial">ANNULÉ${x.offReason ? ` · ${esc(x.offReason)}` : ""}</i>` : ""}${x.refire ? `<i class="sl-tag refire">${ico("slRedo")}À refaire · ${esc(x.refire)}</i>` : ""}${(x.without || []).map((w) => `<em class="m-w">SANS ${esc(String(w).toUpperCase())}</em>`).join("")}${(x.extras || []).map((e) => `<em class="m-x">+ ${esc(e.t)}</em>`).join("")}${x.note ? `<em>${esc(x.note)}</em>` : ""}${(x.allergy || []).length ? `<i class="sl-ial clash">${ico("slWarn")}ALLERGIE ${esc(x.allergy.map((a) => slAl(a).t).join(", ").toUpperCase())}</i>` : ""}</span></li>`).join("")}</ul>
    ${o.note ? `<div class="cm-onote">${ico("rsNote")}<span>${esc(o.note)}</span></div>` : ""}
    ${later.length ? `<div class="sl-later">${ico("clock")}<span>À suivre : ${later.map((x) => `${esc(x.courseT)} (${(x.items || []).filter((y) => !y.off).reduce((a, y) => a + (+y.q || 0), 0)})`).join(", ")}</span></div>` : ""}
    <footer>${o.status === "nouvelle" ? `<button class="btn soft sl-kgo" data-act="slKNext" data-id="${esc(o.id)}" data-v="prep">${ico("slFire")}Lancer</button>` : ""}<button class="btn acc sl-kgo rdy" data-act="slKNext" data-id="${esc(o.id)}" data-v="prete">${ico("cmBell")}Prêt</button><button class="iconbtn sm" data-act="slPrintOne" data-id="${esc(o.id)}" aria-label="Imprimer le bon">${ico("printer")}</button></footer>
  </article>`;
}
/* ruptures: per dish, for today: Disponible · Limité (N portions) · Épuisé; and when the count goes down */
function slOutsSheet(first) {
  const D = slDishes(), q = slNorm(SL.oq || ""), w = slWhen();
  const rank = (n) => (slOut(n.id) ? 2 : slLeftE(n.id) ? 1 : 0);
  const L = D.filter((n) => !q || slNorm(n.title || "").includes(q)).sort((a, b) => rank(b) - rank(a));
  const row = (n) => {
    const man = (slCfg().out || {})[n.id] === dayKey(), e = slLeftE(n.id), st = man ? "out" : e ? "lim" : "dispo", l = e ? slLeft(n.id) : null, pend = e ? slPend(n.id) : 0, av = e ? slAvail(n.id) : null;
    return `<div class="sl-or3 s-${st}${l === 0 ? " zero" : ""}"><div class="sl-or3h"><b>${esc(n.title || "")}</b>
      <div class="sl-st3" role="radiogroup" aria-label="${esc(n.title || "")}">${[["dispo", "Disponible"], ["lim", "Limité"], ["out", "Épuisé"]].map(([k, t]) => `<button class="${st === k ? "on" : ""}" role="radio" aria-checked="${st === k}" data-act="slStk" data-id="${esc(n.id)}" data-v="${k}">${t}</button>`).join("")}</div></div>
      ${st === "lim" ? `<div class="sl-or3c"><div class="cm-step sm"><button data-act="slLeftStep" data-id="${esc(n.id)}" data-v="-1" aria-label="Une portion de moins">${ico("minus")}</button><b class="mono">${l}</b><button data-act="slLeftStep" data-id="${esc(n.id)}" data-v="1" aria-label="Une portion de plus">${ico("plus")}</button></div>
        <span>${l === 0 ? "Plus aucune portion : épuisé pour les serveurs et le QR" : `portion${l > 1 ? "s" : ""} en cuisine${pend ? ` · <b>${pend}</b> déjà commandée${pend > 1 ? "s" : ""}, pas encore décomptée${pend > 1 ? "s" : ""}` : ""} · <b>${av}</b> encore à vendre`}</span>
        <div class="sl-or3q">${[5, 10, 15, 20].map((v) => `<button data-act="slLeftSet" data-id="${esc(n.id)}" data-v="${v}">${v}</button>`).join("")}</div></div>` : ""}
    </div>`;
  };
  const html = `<div class="sl-sh outs"><div class="sl-shh"><span class="h2">Ruptures du jour</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="sl-oexp"><div><b>Disponible</b><span>On vend sans compter.</span></div><div><b>Limité</b><span>Il reste N portions : les serveurs voient « Plus que N » en haut de leur prise de commande, leur téléphone sonne, et on ne peut plus vendre au-delà.</span></div><div><b>Épuisé</b><span>Grisé chez les serveurs et retiré du menu QR.</span></div><p>Tout redevient disponible demain matin.</p></div>
    <div class="sl-when"><b>Le compteur baisse…</b><div class="sl-whl">${SL_WHEN.map(([k, t, d]) => `<button class="${w === k ? "on" : ""}" role="radio" aria-checked="${w === k}" data-act="slWhen" data-v="${k}"><b>${t}</b><em>${d}</em></button>`).join("")}</div>
      <p class="sub">Quel que soit votre choix, ce qui est déjà commandé et pas encore décompté est mis de côté : un serveur ne peut jamais vendre la portion qui n'existe plus.</p></div>
    ${D.length > 8 ? `<label class="sl-search sm">${ico("search")}<input class="input" id="slOq" type="search" placeholder="Chercher un plat" value="${esc(SL.oq || "")}" autocomplete="off"></label>` : ""}
    <div class="sl-ol">${L.map(row).join("") || `<p class="sl-ksn">La carte est vide.</p>`}</div></div>`;
  const cur = $(".sl-sh.outs"); if (cur && !first) { cur.outerHTML = html; } else openSheet(html);
  const qi = document.getElementById("slOq"); if (qi && !qi._b) { qi._b = 1; qi.addEventListener("input", () => { SL.oq = qi.value; const p = qi.selectionStart; slOutsSheet(); const n = document.getElementById("slOq"); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} } }); }
}

/* kitchen ticket on the label printer (62 mm roll, AirPrint / print dialog) */
function slPrint(o) {
  const name = (S.resto && S.resto.name) || "", salle = o.src === "salle";
  const css = `@page{size:62mm auto;margin:3mm}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;color:#000;width:56mm}
  h1{font-size:22pt;margin:0 0 1mm;letter-spacing:-.02em}.c{font-size:13pt;font-weight:800;text-transform:uppercase;margin-bottom:1mm}.m{font-size:9pt;margin-bottom:2mm;border-bottom:1px dashed #000;padding-bottom:2mm}
  .i{display:flex;gap:2mm;font-size:13pt;font-weight:700;margin:1.5mm 0}.i b{min-width:7mm}.n{display:block;font-size:10pt;font-weight:600;font-style:italic}.a{display:block;font-size:10pt;font-weight:900;border:1.5px solid #000;padding:.5mm 1mm;margin-top:.5mm}
  .o{text-decoration:line-through}.r{font-size:12pt;font-weight:900;border:2px solid #000;padding:.5mm 1.5mm;display:inline-block;margin-bottom:1mm}.f{border-top:1px dashed #000;margin-top:2mm;padding-top:1.5mm;font-size:9pt}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon ${esc(o.table || o.slot || "")}</title><style>${css}</style></head><body>
    <h1>${salle || o.mode === "table" ? `Table ${esc(o.table)}` : `À emporter ${esc(o.slot || "")}`}</h1><div class="c">${esc(salle ? o.courseT || "" : o.mode === "table" ? "Commande QR" : `n° ${o.n}`)}${o.add ? " · ajout" : ""}</div>
    ${o.rush ? `<div class="r">PRIORITAIRE</div>` : ""}
    <div class="m">${hm(o.firedAt || o.at)} · ${esc([o.waiterName && firstName(o.waiterName), o.covers ? `${o.covers} couverts` : "", o.name].filter(Boolean).join(" · "))}</div>
    ${(o.items || []).map((x) => `<div class="i${x.off ? " o" : ""}"><b>${x.q}</b><span>${esc(x.name)}${x.seat ? ` (P${x.seat})` : ""}${x.off ? `<span class="n">ANNULÉ</span>` : ""}${x.refire ? `<span class="a">À REFAIRE : ${esc(x.refire)}</span>` : ""}${(x.without || []).map((w) => `<span class="n">SANS ${esc(String(w).toUpperCase())}</span>`).join("")}${(x.extras || []).map((e) => `<span class="n">+ ${esc(e.t)}</span>`).join("")}${x.note ? `<span class="n">${esc(x.note)}</span>` : ""}${(x.allergy || []).length ? `<span class="a">ALLERGIE ${esc(x.allergy.map((a) => slAl(a).t).join(", ").toUpperCase())}</span>` : ""}</span></div>`).join("")}
    ${o.note ? `<div class="f">${esc(o.note)}</div>` : ""}<div class="f">${esc(name)}</div></body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 250);
}
async function slWake(on) {
  try {
    if (on) { if (!("wakeLock" in navigator) || (SL.wake && !SL.wake.released)) return; SL.wake = await navigator.wakeLock.request("screen"); }
    else if (SL.wake) { await SL.wake.release(); SL.wake = null; }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.route === "cuisine") { SL.wake = null; slWake(true); } });

/* ───────── demo: a lunch service in full swing, and a kitchen that answers ───────── */
function slSeedDemo() {
  const tp = `restos/${S.rid}/salleTabs`; if (DB.local[tp]) return;
  const D = slDishes().filter((n) => num(n.price) > 0), by = (cat) => D.filter((n) => (n.carteCat || "plat") === cat);
  const pick = (cat, i, fb) => { const L = by(cat); const n = L[i]; return n ? { id: n.id, name: n.title, price: num(n.price), cat } : { id: "", name: fb[0], price: fb[1], cat }; };
  const byT = (t, cat, fb) => { const n = D.find((x) => x.title === t); return n ? { id: n.id, name: n.title, price: num(n.price), cat: n.carteCat || cat } : pick(cat, 0, fb); };
  const spritz = byT("Spritz maison", "boisson", ["Spritz maison", 9]), limo = byT("Limonade maison", "boisson", ["Limonade maison", 4.5]), moj = byT("Mojito sans alcool", "boisson", ["Mojito sans alcool", 7]), vin = byT("Verre de Côtes-du-Rhône", "boisson", ["Verre de Côtes-du-Rhône", 6]), cafe = byT("Café", "boisson", ["Café", 2.5]);
  const drink = limo, ent = pick("entree", 0, ["Velouté de potimarron", 8.5]), sh = pick("partage", 0, ["Croquettes de jambon", 9]), sh2 = pick("partage", 1, ["Planche de charcuterie", 18]);
  const p1 = pick("plat", 0, ["Bœuf bourguignon", 22]), p2 = pick("plat", 1, ["Filet de bar, beurre blanc", 24]), ds = pick("dessert", 0, ["Mousse au chocolat", 7]);
  const me = S.me.id, meN = S.me.name || "Camille Laurent", sarah = ["demo-sarah", "Sarah Lemoine"];
  const now = Date.now(), day = dayKey(), tabs = {}, op = `restos/${S.rid}/clientOrders`; DB.local[op] = DB.local[op] || {};
  let n = 101, k = 0;
  const it = (d, q, c, o = {}) => ({ k: "dk" + k++, id: d.id, name: d.name, price: d.price, q, note: "", allergy: [], course: c, cat: d.cat, sent: null, ...o });
  const tab = (id, tid, table, zone, covers, minAgo, w, items, tickets) => {
    tabs[id] = { table, tableId: tid, zone, covers, status: "open", day, openedAt: now - minAgo * 6e4, by: w[0], byName: w[1], note: "", items, total: slTotal(items) };
    tickets.forEach(([c, status, ago, extra]) => {
      const tid2 = id + "c" + c, L = items.filter((x) => x.course === c); L.forEach((x) => { x.sent = tid2; });
      DB.local[op][tid2] = { src: "salle", mode: "table", table, tableId: tid, tabId: id, course: c, courseT: slCourseT(c), station: c === 0 ? "bar" : "cuisine", covers, items: L.map(({ k, id: i2, name, price, q, note, allergy }) => ({ k, id: i2, name, price, q, note, allergy })),
        total: slTotal(L), n: n++, day, at: now - ago * 6e4, ...(status !== "attente" ? { firedAt: now - ago * 6e4 } : {}), waiter: w[0], waiterName: w[1], status, pay: "place", paid: false, name: "", phone: "", slot: "", note: "", seenAt: now, ...(extra || {}) };
    });
    tabs[id].total = slTotal(items);
  };
  const mine = [me, meN];
  tab("dst3", "dt2", "3", "salle", 4, 41, mine, [it(drink, 2, 0), it(ent, 2, 1), it(p1, 2, 2, { note: "À point" }), it(p2, 2, 2)], [[0, "servie", 39], [1, "servie", 34], [2, "prete", 13, { readyAt: now - 50e3, prepAt: now - 11 * 6e4 }]]);
  tab("dst7", "dt6", "7", "salle", 6, 14, sarah, [it(spritz, 2, 0), it(moj, 1, 0, { note: "Peu de sucre" }), it(vin, 2, 0), it(limo, 1, 0), it(sh, 2, 1), it(sh2, 1, 1), it(p1, 4, 2), it(p2, 2, 2, { allergy: ["lait"], note: "Sans beurre blanc" })], [[0, "nouvelle", 3], [1, "prep", 11, { prepAt: now - 6 * 6e4 }], [2, "attente", 12]]);
  tab("dst21", "dt10", "21", "terrasse", 2, 5, mine, [it(drink, 2, 0), it(ent, 1, 1), it(p2, 1, 2)], [[0, "prete", 4, { readyAt: now - 2 * 6e4 }], [1, "nouvelle", 3], [2, "attente", 3]]);
  tab("dst5", "dt4", "5", "salle", 2, 58, sarah, [it(cafe, 2, 0), it(p1, 1, 2), it(p2, 1, 2), it(ds, 2, 3)], [[0, "nouvelle", 1], [2, "servie", 50], [3, "servie", 9]]);
  tab("dst22", "dt11", "22", "terrasse", 3, 47, mine, [it(spritz, 3, 0), it(p1, 2, 2), it(p2, 1, 2), it(ds, 3, 3)], [[0, "servie", 45], [2, "servie", 24], [3, "prep", 4, { prepAt: now - 3 * 6e4 }]]);
  DB.local[tp] = tabs;
  /* a dish counted by the kitchen (12 croquettes at the start, 2 already sent: « plus que 10 » on every pad) */
  try { const qp = `restos/${S.rid}/qrMenu`, c = DB.local[qp] && DB.local[qp].cfg; if (c && sh.id && !(c.left || {})[sh.id]) c.left = { ...(c.left || {}), [sh.id]: { d: day, n: 12, at: now - 30 * 6e4, by: "demo-chef" } }; if (c && c.barScreen == null) c.barScreen = true; DB.emit(qp); } catch (e) {}
  try { DB.emit(op); } catch (e) {}
}
/* demo: the kitchen launches and finishes what the visitor sends (so the « prêt » alert can be felt) */
function slDemoCook(id) {
  setTimeout(() => { if (DB.mode !== "demo") return; const o = (CM.orders || []).find((x) => x.id === id); if (o && o.status === "nouvelle") DB.update("clientOrders", id, { status: "prep", prepAt: Date.now() }); }, 7000);
  setTimeout(() => { if (DB.mode !== "demo") return; const o = (CM.orders || []).find((x) => x.id === id); if (o && ["nouvelle", "prep"].includes(o.status)) DB.update("clientOrders", id, { status: "prete", readyAt: Date.now() }); }, 20000);
}


/* ───────── actions ───────── */
const slCatOfCourse = (c) => ["boisson", "entree", "plat", "dessert"][+c] || "plat";
function slFreeSheet() {
  const name = (SL.q || "").trim(), f = SL.fr;
  openSheet(`<div class="sl-sh fr"><div class="sl-shh"><span class="h2">Hors carte</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub sl-shs">Un plat du jour, une nouveauté, un supplément : il part en cuisine comme les autres.</p>
    <div class="sl-frg"><label class="field"><span class="lbl">Nom</span><input class="input" id="slFrN" maxlength="60" placeholder="Pavé de cabillaud, purée" value="${esc(name)}" autocomplete="off"></label>
      <label class="field"><span class="lbl">Prix TTC</span><input class="input mono" id="slFrP" inputmode="decimal" placeholder="0,00"></label></div>
    <div class="field"><span class="lbl">Suite</span><div class="sl-segs" data-grp="c">${SL_COURSES.map(([c, t]) => `<button class="${c === f.c ? "on" : ""}" data-act="slFrC" data-v="${c}">${t}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Allergènes du plat</span><div class="sl-chips">${ALLERGENS.map((a) => `<button class="chip${f.al.includes(a.id) ? " on" : ""}" data-act="slFrA" data-v="${a.id}">${esc(a.t)}</button>`).join("")}</div></div>
    <button class="cm-tog${f.keep ? " on" : ""}" data-act="slFrKeep" aria-pressed="${f.keep}"><span class="cm-tt"><b>Garder dans la carte</b><em>Il sera proposé la prochaine fois, avec son prix et ses allergènes.</em></span><span class="cm-sw${f.keep ? " on" : ""}"><i></i></span></button>
    <button class="btn acc block" data-act="slFrOk">${ico("plus")}Ajouter à la commande</button></div>`);
  setTimeout(() => { const i = document.getElementById(name ? "slFrP" : "slFrN"); if (i) i.focus(); }, 320);
}
async function slAfterEd(tab, msg) { closeSheet(); await slSaveTab(tab); if (msg) toast(msg); }

Object.assign(ACT, {
  slTable: (a, id) => {
    const t = slTableBy(id); if (!t) return; const tab = slTabAt(id);
    if (SL.join) { const j = slTabOf(SL.join); SL.join = null; if (!j) return; if (tab) { SFX.err(); toast(tab.id === j.id ? "Cette table fait déjà partie de la tablée." : "Cette table est occupée. Pour réunir deux tablées, passez par « Réunir ».", "err"); return; } return ACT.slJoinTo(a, j.id, id); }
    if (SL.move) { const m = SL.move; SL.move = null; if (tab) { SFX.err(); toast("Cette table est déjà occupée. Pour réunir deux tables, passez par « Réunir ».", "err"); return; } return ACT.slMoveTo(a, m, id); }
    if (SL.merge) { const m = SL.merge; SL.merge = null; if (!tab) return ACT.slMoveTo(a, m, id); if (tab.id === m) return; return ACT.slMergeTo(a, m, tab.id); }
    SFX.tap(); buzz(5); if (tab) go("salle", { id: tab.id }); else slOpenSheet(t);
  },
  slOpen: async (a, id, v) => {
    const t = slTableBy(SL.pickT); if (!t) return; const ex = slTabAt(t.id); if (ex) { closeSheet(); go("salle", { id: ex.id }); return; }
    const b = slBookingAt(t.id), tid = slId("st"); const who = !b && SL.cl ? await slClResolve() : null; if (who === false) return;
    /* a booking on joined tables opens on all of them */
    const bt = b && typeof plTblOf === "function" ? plTblOf(b).filter((id) => slTableBy(id) && !slTabAt(id)) : [], ids = bt.includes(t.id) && bt.length > 1 ? [t.id, ...bt.filter((x) => x !== t.id)] : [t.id];
    const doc = { table: ids.length > 1 ? slJoinLbl(ids) : String(t.n), tableId: t.id, ...(ids.length > 1 ? { joined: ids.slice(1) } : {}), zone: t.zone || "", covers: +v, status: "open", day: dayKey(), openedAt: Date.now(), by: S.me.id, byName: (typeof esActorName === "function" && esActorName()) || S.me.name || "", items: [], total: 0, note: b && b.notes ? String(b.notes).slice(0, 140) : "", ...(b ? { booking: b.id } : {}), ...(who ? { client: who.k, clientName: who.name } : {}) };
    SFX.ok(); buzz(8); closeSheet(); SL.paneTab = null; SL.q = ""; SL.cl = null;
    try { await safe(DB.set("salleTabs", tid, doc)); if (b && b.status !== "arrive" && typeof rsSave === "function") rsSave(b.id, { status: "arrive" }); } catch (e) { return; }
    if (who) { try { const at = await slClStamp(who.k, who.fresh); await safe(DB.update("salleTabs", tid, { pass: { k: who.k, at } })); slClToast(who.k); } catch (e) {} }
    go("salle", { id: tid });
  },
  slGoCarte: () => { SFX.tap(); if (typeof CM !== "undefined") CM.tab = "carte"; go("commandes", { tab: "carte" }); },
  slPane: (a, id, v) => { if (SL.pane === v) return; SL.pane = v; SFX.tick(); buzz(3); rerender(); },
  slCat: (a, id, v) => { SL.cat = v; SFX.tick(); rerender(); },
  slAdd: (a, id) => {
    const tab = slCurTab(), n = (S.notes || []).find((x) => x.id === id); if (!tab || !n) return;
    if (slOut(id)) { SFX.err(); toast(`${n.title} : épuisé aujourd'hui`, "err"); return; }
    const inOrder = (tab.items || []).filter((x) => !x.sent && !x.off && x.id === id).reduce((s, x) => s + (+x.q || 0), 0), av = slAvail(id), le = slLeftE(id);
    if (av != null && av < 1) { SFX.err(); buzz([20, 40, 20]); toast(`${n.title} : plus rien à vendre (${slPend(id)} déjà commandé${slPend(id) > 1 ? "s" : ""})`, "err"); return; }
    const c = slCourseOf(n.carteCat || "plat"); tab.items = tab.items || [];
    const ex = tab.items.find((x) => !x.sent && !x.off && x.id === id && (+x.price || 0) === (typeof pxNowPrice === "function" ? pxNowPrice(n) : num(n.price)) && +x.course === c && !x.note && !(x.allergy || []).length && !(x.without || []).length && !(x.extras || []).length && !x.seat && !x.free && !x.rush && (!le || (x.at || 0) >= (+le.at || 0)));
    if (ex) ex.q = (+ex.q || 0) + 1; else tab.items.push({ k: slId("i"), id, name: n.title || "Article", price: typeof pxNowPrice === "function" ? pxNowPrice(n) : num(n.price), q: 1, note: "", allergy: [], course: c, cat: n.carteCat || "plat", sent: null, at: Date.now() });
    if (av != null && av - 1 <= 3) setTimeout(() => toast(av - 1 ? `${n.title} : plus que ${av - 1} à vendre` : `${n.title} : c'était le dernier`, av - 1 ? "info" : "warn"), 60);
    SFX.tick(); buzz(6);
    let badge = a.querySelector(".sl-dq"); if (!badge) { badge = document.createElement("i"); badge.className = "sl-dq mono"; a.appendChild(badge); } badge.textContent = inOrder + 1; a.classList.add("has"); badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
    if (SL.q) { SL.q = ""; const q = document.getElementById("slQ"); if (q) q.value = ""; slFilter(); }
    slSaveTab(tab);
  },
  slFree: () => { if (!slCurTab()) return; SFX.tap(); SL.fr = { c: 2, keep: false, al: [] }; slFreeSheet(); },
  slFrC: (a, id, v) => { SL.fr.c = +v; $$('.sl-sh.fr [data-grp="c"] button').forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); },
  slFrA: (a, id, v) => { const L = SL.fr.al, i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); a.classList.toggle("on", i < 0); SFX.tick(); },
  slFrKeep: (a) => { SL.fr.keep = !SL.fr.keep; a.classList.toggle("on", SL.fr.keep); a.querySelector(".cm-sw").classList.toggle("on", SL.fr.keep); a.setAttribute("aria-pressed", SL.fr.keep); SFX.tick(); buzz(4); },
  slFrOk: async () => {
    const tab = slCurTab(); if (!tab) return; const f = SL.fr, name = ((document.getElementById("slFrN") || {}).value || "").trim(), price = Math.max(0, Math.round(num((document.getElementById("slFrP") || {}).value) * 100) / 100);
    if (name.length < 2) { SFX.err(); toast("Donnez un nom au plat.", "err"); return; }
    let id = "";
    if (f.keep) { const t = Date.now(); try { id = await safe(DB.add("notes", { title: name.slice(0, 60), cat: "Recettes", body: "", ingredients: [], steps: [], portions: 1, allergens: f.al.slice(), alNo: [], carte: true, carteCat: slCatOfCourse(f.c), price, photo: "", uid: S.me.id, at: t, updatedAt: t, src: "salle" })); } catch (e) { id = ""; } }
    tab.items = tab.items || []; tab.items.push({ k: slId("i"), id: id || "", name: name.slice(0, 60), price, q: 1, note: "", allergy: [], dishAl: f.al.slice(), course: f.c, cat: id ? slCatOfCourse(f.c) : "libre", sent: null, at: Date.now() });
    SL.q = ""; closeSheet(); SFX.ok(); buzz(8); await slSaveTab(tab); toast(f.keep ? `${name} ajouté, et gardé dans la carte` : `${name} ajouté`);
  },
  slItem: (a, id) => { const tab = slCurTab(); const x = tab && (tab.items || []).find((y) => y.k === id); if (!x) return; SFX.tap(); slItemOpen(tab, x); },
  slQ: async (a, id, v) => {
    const tab = slCurTab(); const x = tab && (tab.items || []).find((y) => y.k === id); if (!x || x.sent) return;
    if (+v > 0 && x.id) { const av = slAvail(x.id); if (av != null && av < 1) { SFX.err(); buzz([20, 40, 20]); toast(`${x.name} : plus rien à vendre`, "err"); return; } }
    x.q = (+x.q || 0) + +v; SFX.tick(); buzz(4);
    if (x.q <= 0) { const i = tab.items.indexOf(x), keep = { ...x, q: 1 }; tab.items.splice(i, 1); S.ui.undo = () => { tab.items.splice(i, 0, keep); slSaveTab(tab); }; toastUndo(`${x.name} retiré`); }
    await slSaveTab(tab);
  },
  /* the line sheet */
  slEdMode: (a, id, v) => { slEdRead(); SL.ed.mode = v; SL.ed.why = ""; SL.ed.n = v === "edit" ? 1 : Math.max(1, Math.min(SL.ed.n || 1, +(slEdItem().x || {}).q || 1)); if (v !== "edit") { const x = slEdItem().x; SL.ed.n = x && +x.q > 1 && (v === "move") ? +x.q : 1; } SFX.tick(); slItemPaint(); },
  slEdN: (a, id, v) => { const x = slEdItem().x; if (!x) return; SL.ed.n = Math.max(1, Math.min(+x.q || 1, SL.ed.n + +v)); SFX.tick(); slItemPaint(); },
  slEdWhy: (a, id, v) => { SL.ed.why = SL.ed.why === v ? "" : v; SFX.tick(); slItemPaint(); },
  slEdQ: (a, id, v) => { slEdRead(); SL.ed.q = Math.max(1, Math.min(40, SL.ed.q + +v)); SFX.tick(); slItemPaint(); },
  slEdC: (a, id, v) => { slEdRead(); SL.ed.course = +v; SFX.tick(); slItemPaint(); },
  slEdSeat: (a, id, v) => { slEdRead(); SL.ed.seat = +v; SFX.tick(); slItemPaint(); },
  slEdNt: (a, id, v) => { slEdRead(); const L = SL.ed.note.split(", ").filter(Boolean); const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.unshift(v); SL.ed.note = L.join(", "); SFX.tick(); slItemPaint(); },
  slEdW: (a, id, v) => { slEdRead(); const L = SL.ed.without, i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); SFX.tick(); slItemPaint(); },
  slEdXAdd: () => { slEdRead(); const e = SL.ed, t = (e.xt || "").trim(); if (t.length < 2) { SFX.err(); toast("Nommez le supplément.", "err"); const i = document.getElementById("slEdXt"); if (i) i.focus(); return; } e.extras.push({ t: t.slice(0, 40), p: Math.max(0, Math.round(num(e.xp) * 100) / 100) }); e.xt = ""; e.xp = ""; SFX.ok(); buzz(5); slItemPaint(); },
  slEdXDel: (a, id, v) => { slEdRead(); SL.ed.extras.splice(+v, 1); SFX.tap(); slItemPaint(); },
  slEdA: (a, id, v) => { slEdRead(); const L = SL.ed.al, i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); i >= 0 ? SFX.tick() : (SFX.err(), buzz(10)); slItemPaint(); },
  slEdRush: () => { slEdRead(); SL.ed.rush = !SL.ed.rush; SFX.tick(); buzz(4); slItemPaint(); },
  slEdFree: () => { slEdRead(); SL.ed.free = SL.ed.free ? null : { why: "Geste commercial" }; SFX.tick(); buzz(4); slItemPaint(); },
  slEdFreeWhy: (a, id, v) => { slEdRead(); SL.ed.free = { why: v }; SFX.tick(); slItemPaint(); },
  slEdSave: async () => {
    slEdRead(); const { e, tab, x } = slEdItem(); if (!x) return;
    Object.assign(x, { q: e.q, note: e.note.slice(0, 120), allergy: e.al.slice(), course: e.course, without: e.without.slice(), extras: e.extras.map((y) => ({ ...y })), seat: e.seat || 0, rush: !!e.rush });
    if (e.free) x.free = { why: e.free.why || "Geste commercial", by: S.me.id, at: Date.now() }; else delete x.free;
    SFX.ok(); await slAfterEd(tab);
  },
  slEdDel: async () => { const { e, tab, x } = slEdItem(); if (!x || x.sent) return; const i = tab.items.indexOf(x); tab.items.splice(i, 1); S.ui.undo = () => { tab.items.splice(i, 0, x); slSaveTab(tab); }; SFX.tap(); closeSheet(); await slSaveTab(tab); toastUndo(`${x.name} retiré`); void e; },
  slEdCancel: async (a) => {
    const { e, tab, x } = slEdItem(); if (!x) return; if (!e.why) { SFX.err(); toast("Choisissez un motif.", "err"); return; }
    a.disabled = true; const k0 = x.k, sent = x.sent, amt = Math.round(slUnit(x) * e.n * 100) / 100, y = slSplit(tab, x, e.n); y.off = true; y.offReason = e.why; y.offBy = S.me.id; y.offAt = Date.now();
    if (sent) await slTicketOff({ k: k0, sent }, e.n, e.why);
    logEvent && logEvent("salle", `a annulé ${e.n} × ${x.name} (table ${tab.table}, ${e.why}${sent ? ", déjà en cuisine" : ""})`, { ref: tab.id, k: "annul", ...(amt ? { amt } : {}) });
    SFX.close(); buzz([20, 40, 20]); await slAfterEd(tab, sent ? `${x.name} annulé, la cuisine est prévenue` : `${x.name} annulé`);
  },
  slEdOffer: async () => {
    const { e, tab, x } = slEdItem(); if (!x) return; const amt = Math.round(slUnit(x) * e.n * 100) / 100; const y = slSplit(tab, x, e.n); y.free = { why: e.why || "Geste commercial", by: S.me.id, at: Date.now() };
    SFX.done(); buzz([12, 30, 12]); logEvent && logEvent("salle", `a offert ${e.n} × ${x.name} (table ${tab.table}, ${y.free.why})`, { ref: tab.id, k: "offert", ...(amt ? { amt } : {}) }); await slAfterEd(tab, `${x.name} offert`);
  },
  slEdUnoffer: async () => { const { tab, x } = slEdItem(); if (!x) return; delete x.free; SFX.tap(); logEvent && logEvent("salle", `a remis ${x.q} × ${x.name} sur l'addition (table ${tab.table}, n'est plus offert)`, { ref: tab.id, k: "modif" }); await slAfterEd(tab, `${x.name} n'est plus offert`); },
  slEdRefire: async (a) => {
    const { e, tab, x } = slEdItem(); if (!x) return; if (!e.why) { SFX.err(); toast("Choisissez un motif.", "err"); return; } a.disabled = true;
    const id = slId("sl"), now = Date.now(), k = slId("i"); SL.mine.add(id);
    const line = { ...slLineOut(x), k, q: e.n, price: 0, refire: e.why, rush: true };
    await safe(DB.set("clientOrders", id, { src: "salle", mode: "table", table: String(tab.table), tableId: tab.tableId || "", tabId: tab.id, course: +x.course, courseT: slCourseT(x.course), station: +x.course === 0 ? "bar" : "cuisine", covers: +tab.covers || 0,
      items: [line], total: 0, n: slNextN(), day: dayKey(), at: now, firedAt: now, waiter: S.me.id, waiterName: (typeof esActorName === "function" && esActorName()) || S.me.name || "", status: "nouvelle", pay: "place", paid: false, name: "", phone: "", slot: "", note: "", rush: true, refire: true, add: true }));
    tab.items.splice(tab.items.indexOf(x) + 1, 0, { ...x, k, q: e.n, refire: e.why, rush: true, free: { why: "Refait" }, sent: id });
    if (DB.mode === "demo") slDemoCook(id);
    SFX.done(); buzz([16, 40, 16]); logEvent && logEvent("salle", `a fait refaire ${e.n} × ${x.name} (table ${tab.table}, ${e.why})`, { ref: tab.id, k: "annul" }); await slAfterEd(tab, `${x.name} : la cuisine refait, en priorité`);
  },
  slEdMoveTo: async (a, id) => {
    const { e, tab, x } = slEdItem(), to = slTabOf(id); if (!x || !to) return; const y = slSplit(tab, x, e.n); tab.items.splice(tab.items.indexOf(y), 1);
    to.items = [...(to.items || []), { ...y, movedFrom: tab.table }]; SFX.ok(); buzz(8); closeSheet(); await slSaveTab(tab); await slSaveTab(to); toast(`${y.q} × ${y.name} → table ${to.table}`);
  },
  slEdMoveNew: async (a, tid) => {
    const { e, tab, x } = slEdItem(), t = slTableBy(tid); if (!x || !t) return; const y = slSplit(tab, x, e.n); tab.items.splice(tab.items.indexOf(y), 1);
    const nid = slId("st"); await safe(DB.set("salleTabs", nid, { table: String(t.n), tableId: t.id, zone: t.zone || "", covers: 1, status: "open", day: dayKey(), openedAt: Date.now(), by: S.me.id, byName: (typeof esActorName === "function" && esActorName()) || S.me.name || "", items: [{ ...y, movedFrom: tab.table }], total: slTotal([y]), note: "" }));
    SFX.ok(); buzz(8); closeSheet(); await slSaveTab(tab); toast(`${y.q} × ${y.name} → table ${t.n}`);
  },
  slSend: async (a) => { const tab = slCurTab(); if (!tab || SL.busy.send) return; SL.busy.send = true; a.disabled = true; try { await slSend(tab); } catch (e) { console.warn(e); } SL.busy.send = false; onData(); },
  slFire: async (a, id, v) => { const tab = slCurTab(); if (!tab || SL.busy.fire) return; SL.busy.fire = true; a.disabled = true; try { await slFire(tab, v === "" || v == null ? null : +v); } catch (e) { console.warn(e); } SL.busy.fire = false; onData(); },
  slRush: async (a, id, v) => {
    const tab = slCurTab(); if (!tab) return; const L = slTickets(tab.id).filter((o) => o.course === +v && ["nouvelle", "prep"].includes(o.status)); if (!L.length) return;
    a.disabled = true; for (const o of L) await safe(DB.update("clientOrders", o.id, { rush: true, push: Date.now() }));
    SFX.ok(); buzz([12, 30, 12]); toast(`${slCourseT(v)} réclamés : la cuisine les passe devant`);
  },
  slServed: async (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.ok(); buzz(8);
    const row = a.closest(".sl-rd,.sl-kr,.sl-cb"); if (row) row.classList.add("go");
    await safe(DB.update("clientOrders", id, { status: "servie", doneAt: Date.now(), by: S.me.id, doneBy: S.me.id }));
    S.ui.undo = () => DB.update("clientOrders", id, { status: "prete", doneAt: null }); toastUndo(o.src === "salle" ? `Table ${o.table} · ${o.courseT} servi` : `${slWho(o)} remise`);
  },
  slBill: () => { const tab = slCurTab(); if (!tab) return; SFX.sheet ? SFX.sheet() : SFX.tap(); SL.bill = null; slBillSheet(tab); },
  slBillMode: (a, id, v) => { SL.bill.mode = v; SFX.tick(); slBillPaint(); },
  slBillN: (a, id, v) => { SL.bill.n = Math.max(1, Math.min(30, SL.bill.n + +v)); SFX.tick(); slBillPaint(); },
  slBillPick: (a, id, v) => { const s = SL.bill.sel, i = s.indexOf(v); i >= 0 ? s.splice(i, 1) : s.push(v); SFX.tick(); buzz(3); slBillPaint(); },
  slBillClear: () => { SL.bill.sel = []; SFX.tap(); slBillPaint(); },
  slClose: async () => {
    const tab = slCurTab(); if (!tab) return;
    for (const o of slTickets(tab.id)) { if (o.status === "attente") await safe(DB.update("clientOrders", o.id, { status: "annulee", cancelledAt: Date.now(), cancelledBy: S.me.id })); }
    await safe(DB.update("salleTabs", tab.id, { status: "closed", closedAt: Date.now(), closedBy: S.me.id, total: slTotal(tab.items || []) }));
    closeSheet(); SFX.done(); if (typeof burst === "function") try { burst(); } catch (e) {}
    logEvent && logEvent("salle", `a libéré la table ${tab.table} (${slEur(slTotal(tab.items || []))})`, { ref: tab.id });
    S.ui.undo = () => DB.update("salleTabs", tab.id, { status: "open", closedAt: null }); go("salle", {}, { replace: true }); setTimeout(() => toastUndo(`Table ${tab.table} libérée`), 350);
  },
  slCovers: () => { const tab = slCurTab(); if (!tab) return; SFX.tap(); openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Couverts · Table ${esc(tab.table)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div><div class="sl-covg">${Array.from({ length: 12 }, (_, i) => i + 1).map((n) => `<button class="${n === +tab.covers ? "on" : ""}" data-act="slCovSet" data-v="${n}">${n}</button>`).join("")}</div></div>`); },
  slCovSet: async (a, id, v) => { const tab = slCurTab(); if (!tab) return; closeSheet(); SFX.ok(); await safe(DB.update("salleTabs", tab.id, { covers: +v })); },
  slClPick: (a, id) => { const C = SL.cl; if (!C) return; C.sel = id || null; C.q = ""; SFX.tick(); buzz(3); if (C.mode === "tab") return ACT.slClSave(); slClPaint(); },
  slClNew: (a, id, v) => { const C = SL.cl; if (!C) return; SFX.tap(); if (v === "1") { const q = C.q.trim(), dg = q.replace(/[^\d+ ]/g, "").trim(); const isPh = q.replace(/\D/g, "").length >= 6 && dg.length >= q.length - 1; C.nw = { name: isPh ? "" : q, phone: isPh ? q : "" }; } else C.nw = null; slClPaint(); if (C.nw) setTimeout(() => { const i = $(C.nw.name ? "#slClP" : "#slClN"); i && i.focus(); }, 60); },
  slClNewOk: async () => { const C = SL.cl; if (!C || !C.nw) return; const who = await slClResolve(); if (!who) return; if (C.mode === "tab") return ACT.slClSave(null, null, null, who); C.sel = who.k; C.pend = who; C.nw = null; SFX.ok(); slClPaint(); },
  /* from an open table: « Client de la table » */
  slClient: () => { const tab = slCurTab(); if (!tab || !slClOn()) return; SFX.tap(); SL.cl = { mode: "tab", tab: tab.id, sel: tab.client || null, q: "", nw: null };
    openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Qui est à table ${esc(tab.table)} ?</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      ${tab.booking ? `<div class="sl-bk">${ico("resa")}<span>Table réservée : la visite compte déjà avec la réservation.</span></div>` : `<p class="sub">Choisissez sa fiche : sa venue est notée toute seule, avec un tampon sur sa carte de fidélité.</p>`}
      <div id="slCl">${slClHTML()}</div></div>`, slClBind); },
  slClSave: async (a, id, v, who0) => {
    const C = SL.cl, tab = C && slTabOf(C.tab); if (!tab) return; const who = who0 || (C.sel ? await slClResolve() : null); if (who === false) return;
    const same = (who && who.k) === (tab.client || null) || (!who && !tab.client); SL.cl = null; closeSheet(true); if (same) return;
    try {
      if (!tab.booking) await slClUnstamp(tab.pass);
      let pass = null; if (who && !tab.booking) pass = { k: who.k, at: await slClStamp(who.k, who.fresh) };
      await safe(DB.update("salleTabs", tab.id, { client: who ? who.k : null, clientName: who ? who.name : null, pass, updatedAt: Date.now() }));
    } catch (e) { return; }
    SFX.ok(); buzz(5); if (who && !tab.booking) slClToast(who.k); else toast(who ? `Table ${tab.table} : ${who.name}` : `Table ${tab.table} : invité`);
  },
  slTabMenu: () => {
    const tab = slCurTab(); if (!tab) return; SFX.tap();
    openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Table ${esc(tab.table)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <label class="field"><span class="lbl">Note pour toute la table</span><input class="input" id="slTNote" maxlength="140" placeholder="Anniversaire : bougie au dessert" value="${esc(tab.note || "")}"></label>
      <button class="btn soft block" data-act="slTNoteOk">${ico("check")}Enregistrer la note</button>
      <div class="sl-acts">
        <button data-act="slMove">${ico("slMove")}<b>Changer de table</b><em>Les clients se déplacent</em></button>
        <button data-act="slMerge">${ico("slMerge")}<b>Réunir</b><em>Avec une autre table</em></button>
        <button data-act="slJoin">${ico("plus")}<b>Accoler une table</b><em>${(tab.joined || []).length ? `Tables ${esc(tab.table)}` : "Une table libre à côté"}</em></button>
        ${(tab.joined || []).length ? `<button data-act="slUnjoin">${ico("x")}<b>Séparer</b><em>Garder la table ${esc((slTableBy(tab.tableId) || {}).n || tab.table)}</em></button>` : ""}
        <button data-act="slCovers">${ico("users")}<b>Couverts</b><em>${slCovers(tab)}</em></button>
        <button data-act="slBill">${ico("slBill")}<b>Addition</b><em>Partager, libérer</em></button></div>
      ${slItemsOk(tab).length ? "" : `<button class="btn ghost block" data-act="slDrop">${ico("x")}Annuler l'ouverture</button>`}</div>`);
  },
  slTNoteOk: async () => { const tab = slCurTab(); if (!tab) return; const v = ((document.getElementById("slTNote") || {}).value || "").trim().slice(0, 140); closeSheet(); SFX.ok(); await safe(DB.update("salleTabs", tab.id, { note: v })); },
  slDrop: async () => { const tab = slCurTab(); if (!tab) return; closeSheet(); await safe(DB.update("salleTabs", tab.id, { status: "closed", closedAt: Date.now(), closedBy: S.me.id, total: 0 })); SFX.close(); go("salle", {}, { replace: true }); },
  slMove: () => { const tab = slCurTab(); if (!tab) return; closeSheet(); SL.move = tab.id; SL.merge = null; SL.join = null; go("salle", {}); setTimeout(() => toast("Touchez la nouvelle table", "info"), 300); },
  slMerge: () => { const tab = slCurTab(); if (!tab) return; closeSheet(); SL.merge = tab.id; SL.move = null; SL.join = null; go("salle", {}); setTimeout(() => toast(`Touchez la table qui accueille la table ${tab.table}`, "info"), 300); },
  slJoin: () => { const tab = slCurTab(); if (!tab) return; closeSheet(); SL.join = tab.id; SL.move = null; SL.merge = null; go("salle", {}); setTimeout(() => toast(`Touchez la table libre à accoler à la table ${tab.table}`, "info"), 300); },
  slJoinTo: async (a, tabId, tid) => {
    const tab = slTabOf(tabId), t = slTableBy(tid); if (!tab || !t) return; SFX.ok(); buzz(8);
    const ids = [...slTabTables(tab), tid], lbl = slJoinLbl(ids);
    await safe(DB.update("salleTabs", tabId, { joined: ids.slice(1), table: lbl }));
    for (const o of slTickets(tabId)) if (slLive(o)) await safe(DB.update("clientOrders", o.id, { table: lbl }));
    toast(`Tables ${lbl} assemblées`); go("salle", { id: tabId }, { replace: true });
  },
  slUnjoin: async () => {
    const tab = slCurTab(); if (!tab) return; closeSheet(); SFX.tap(); const lbl = String((slTableBy(tab.tableId) || {}).n || tab.table).split("+")[0];
    await safe(DB.update("salleTabs", tab.id, { joined: [], table: lbl }));
    for (const o of slTickets(tab.id)) if (slLive(o)) await safe(DB.update("clientOrders", o.id, { table: lbl }));
    toast(`Table ${lbl} seule, les autres sont libres`);
  },
  slMoveTo: async (a, tabId, tid) => {
    const tab = slTabOf(tabId), t = slTableBy(tid); if (!tab || !t) return; SFX.ok(); buzz(8);
    await safe(DB.update("salleTabs", tabId, { table: String(t.n), tableId: t.id, zone: t.zone || "", joined: [] }));
    for (const o of slTickets(tabId)) if (slLive(o)) await safe(DB.update("clientOrders", o.id, { table: String(t.n), tableId: t.id, mod: Date.now() }));
    toast(`Table ${tab.table} → table ${t.n}`); go("salle", { id: tabId }, { replace: true });
  },
  slMergeTo: async (a, fromId, toId) => {
    const from = slTabOf(fromId), to = slTabOf(toId); if (!from || !to) return; SFX.ok(); buzz(8);
    to.items = [...(to.items || []), ...(from.items || []).map((x) => ({ ...x, movedFrom: from.table }))];
    /* the two tables stay together on the floor: the guests were moved next to each other */
    const ids = [...new Set([...slTabTables(to), ...slTabTables(from)])], lbl = slJoinLbl(ids) || String(to.table);
    await safe(DB.update("salleTabs", toId, { items: to.items, total: slTotal(to.items), covers: (+to.covers || 0) + (+from.covers || 0), joined: ids.slice(1), table: lbl, updatedAt: Date.now() }));
    for (const o of slTickets(toId)) if (slLive(o)) await safe(DB.update("clientOrders", o.id, { table: lbl }));
    for (const o of slTickets(fromId)) if (slLive(o)) await safe(DB.update("clientOrders", o.id, { tabId: toId, table: lbl, tableId: to.tableId || "", mod: Date.now() }));
    await safe(DB.update("salleTabs", fromId, { status: "closed", closedAt: Date.now(), closedBy: S.me.id, mergedInto: toId, total: 0 }));
    toast(`Tables ${from.table} et ${to.table} réunies`); go("salle", { id: toId }, { replace: true });
  },
  /* kitchen */
  slSound: () => { SFX.init(); try { SFX.tone(1047, 0.2, "sine", 0.05); SFX.tone(1568, 0.35, "sine", 0.045, 0.12); } catch (e) {} buzz(8); setTimeout(rerender, 120); },
  slStation: (a, id, v) => { SL.station = v; SFX.tick(); rerender(); },
  slPrintTog: () => { SL.print = !SL.print; try { localStorage.setItem("gg-sl-print", SL.print ? "1" : "0"); } catch (e) {} SFX.tick(); toast(SL.print ? "Chaque nouveau bon s'imprime sur cet appareil" : "Impression automatique coupée"); rerender(); },
  slPrintOne: (a, id) => { const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.print ? SFX.print() : SFX.tap(); slPrint(o); },
  slKItem: async (a, id, v) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; const i = +v; if ((o.items || [])[i] && o.items[i].off) return; const items = (o.items || []).map((x, j) => (j === i ? { ...x, ok: !x.ok } : x));
    a.classList.toggle("ok", !!items[i].ok); SFX.tick(); buzz(4); await safe(DB.update("clientOrders", id, { items }));
  },
  slKNext: async (a, id, v) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o || SL.busy[id]) return; SL.busy[id] = true;
    const patch = { status: v, by: S.me.id }; if (v === "prep") { patch.prepAt = Date.now(); patch.prepBy = S.me.id; } if (v === "prete") { patch.readyAt = Date.now(); patch.readyBy = S.me.id; }
    const card = a.closest(".sl-kcard"); if (v === "prete" && card) card.classList.add("go");
    v === "prete" ? (SFX.done(), buzz([14, 40, 14])) : (SFX.ok(), buzz(8));
    setTimeout(async () => {
      try { await safe(DB.update("clientOrders", id, patch)); if (v === "prete") { S.ui.undo = () => DB.update("clientOrders", id, { status: o.status, readyAt: null }); toastUndo(o.src === "salle" ? `Table ${o.table} · ${o.courseT} : ${o.waiterName ? firstName(o.waiterName) + " est prévenu sur son téléphone" : "le serveur est prévenu"}` : `${slWho(o)} prête`); } } catch (e) {}
      delete SL.busy[id]; onData();
    }, v === "prete" && card ? 280 : 0);
  },
  slCall: async (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); SFX.tap(); buzz(8); await safe(DB.update("clientOrders", id, { call: Date.now() }));
    toast(`Rappel envoyé${o && o.waiterName ? ` à ${firstName(o.waiterName)}` : " au serveur"} : son téléphone sonne`);
  },
  slRecall: async (a, id) => { SFX.tap(); buzz(8); await safe(DB.update("clientOrders", id, { status: "prep", readyAt: null, doneAt: null })); toast("Bon remis sur le feu"); },
  slOuts: () => { SFX.tap(); SL.oq = ""; slOutsSheet(true); },
  /* one dish, three states: Disponible (no count) · Limité (N portions) · Épuisé */
  slStk: async (a, id, v) => {
    const c = slCfg(), out = { ...(c.out || {}) }, left = { ...(c.left || {}) }, today = dayKey();
    delete out[id]; if (v !== "lim") delete left[id];
    if (v === "out") out[id] = today;
    if (v === "lim" && !slLeftE(id)) left[id] = { d: today, n: 10, at: Date.now(), by: S.me.id };
    Object.keys(out).forEach((k) => { if (out[k] !== today) delete out[k]; }); Object.keys(left).forEach((k) => { if (!left[k] || left[k].d !== today) delete left[k]; });
    v === "out" ? SFX.tap() : SFX.ok(); buzz(5);
    await slStockSave({ out, left }); slOutsSheet();
  },
  slLeftSet: async (a, id, v) => {
    const c = slCfg(), left = { ...(c.left || {}) }, out = { ...(c.out || {}) }, today = dayKey();
    if (v === "") delete left[id]; else { left[id] = { d: today, n: +v, at: Date.now(), by: S.me.id }; if (+v > 0 && out[id] === today) delete out[id]; }
    Object.keys(left).forEach((k) => { if (!left[k] || left[k].d !== today) delete left[k]; }); SFX.tick();
    await slStockSave({ left, out }); slOutsSheet();
  },
  /* +/- : a new count from what is left now (n = left, at = now), so nothing sold before is counted twice */
  slLeftStep: async (a, id, v) => {
    const c = slCfg(), left = { ...(c.left || {}) }, out = { ...(c.out || {}) }, today = dayKey(), n = Math.max(0, (slLeft(id) || 0) + +v);
    left[id] = { d: today, n, at: Date.now(), by: S.me.id }; if (!n) out[id] = today; else if (out[id] === today) delete out[id]; SFX.tick(); buzz(3);
    await slStockSave({ left, out }); slOutsSheet();
  },
  slWhen: async (a, id, v) => {
    if (slWhen() === v) return; SFX.tick(); buzz(4);
    /* changing the moment restarts every count from what is left now, so the switch doesn't move any number */
    const c = slCfg(), left = { ...(c.left || {}) }, now = Date.now(), cur = {}; Object.keys(left).forEach((k) => { const l = slLeft(k); if (l != null) cur[k] = l; });
    Object.keys(cur).forEach((k) => { left[k] = { ...left[k], n: cur[k], at: now }; });
    await slStockSave({ stockWhen: v, left }); slOutsSheet(); toast(`Le compteur baisse désormais ${({ commande: "dès que c'est commandé", envoi: "à l'envoi en cuisine", pret: "quand la cuisine dit « Prêt »", paye: "à l'encaissement" })[v]}`);
  },
});
