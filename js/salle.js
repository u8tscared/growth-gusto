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
                                       note, booking?, total, items:[{ k, id, name, price, q, note, allergy:[id], course:0..3, cat, sent:ticketId|null, off? }] }
     restos/{rid}/clientOrders/{id}  the kitchen tickets, same collection as the QR orders so one kitchen screen shows both:
                                     { src:"salle", mode:"table", table, tableId, tabId, course, courseT, station:"cuisine"|"bar", covers,
                                       items:[{ k, id, name, price, q, note, allergy, ok? }], total, n, day, at, firedAt?, waiter, waiterName,
                                       status: attente (« à suivre ») → nouvelle → prep → prete → servie | annulee, call? (rappel), add? (ajout),
                                       pay:"place", paid:false }
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
  slCall: ["M4 13a8 8 0 0 1 16 0", "M2.5 13h19", "M12 5V3", "M10 3h4", "M5 17h14", "M7 21h10", "f:M4 13a8 8 0 0 1 16 0z"],
});

/* ───────── config ───────── */
const SL_COURSES = [[0, "Boissons", "slGlass"], [1, "Entrées", "slFire"], [2, "Plats", "slFire"], [3, "Desserts", "slFire"]];
const slCourseT = (c) => (SL_COURSES.find((x) => x[0] === +c) || SL_COURSES[2])[1];
const slCourseOf = (cat) => (cat === "boisson" ? 0 : cat === "plat" ? 2 : cat === "dessert" ? 3 : 1);
const SL_NOTES = ["Saignant", "À point", "Bien cuit", "Sans sauce", "Sauce à part", "Sans sel", "Sans oignon", "Portion enfant", "Pour partager"];
const SL_ST = { attente: "À suivre", nouvelle: "Envoyé", prep: "En cuisine", prete: "Prêt", servie: "Servi", annulee: "Annulé" };
const SL = { rid: null, tabs: null, st: new Map(), stInit: false, mine: new Set(), cat: "tout", pane: null, paneTab: null, ed: null, pickT: null, station: "tout", wake: null, busy: {}, kTick: null, fTick: null,
  print: (() => { try { return localStorage.getItem("gg-sl-print") === "1"; } catch (e) { return false; } })() };
const slEur = (v) => (typeof cmEur === "function" ? cmEur(v) : (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €");
const slAgo = (at) => { const m = Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4)); return m < 1 ? "à l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
const slMin = (at) => Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4));
const slId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slAl = (id) => (typeof allergenOf === "function" && allergenOf(id)) || { t: id };
const slDishAl = (id) => { const n = (S.notes || []).find((x) => x.id === id); if (!n) return []; try { return typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || []; } catch (e) { return n.allergens || []; } };

/* ───────── data ───────── */
function slWatch() {
  if (!S.rid) return;
  if (typeof cmWatch === "function") cmWatch(); /* the kitchen tickets (clientOrders) and the carte config */
  if (typeof rsWatch === "function") rsWatch(); /* today's bookings (names on the tables) and, in the demo, the floor plan */
  if (SL.rid === S.rid) return; SL.rid = S.rid; SL.tabs = null; SL.st = new Map(); SL.stInit = false; SL.mine = new Set();
  const rid = S.rid;
  if (DB.mode === "demo") slSeedDemo();
  DB.watch("salleTabs", { order: "openedAt", dir: "desc", limit: 300 }, (rows) => { if (S.rid !== rid) return; SL.tabs = rows; onData(); });
  try { localStorage.setItem("gg-sl-on-" + rid, "1"); } catch (e) {}
}
/* a waiter who already uses this screen keeps getting « c'est prêt » on any screen after a restart */
window.addEventListener("gg:ready", () => { setTimeout(() => { try { if (S.rid && DB.mode === "db" && localStorage.getItem("gg-sl-on-" + S.rid) === "1" && (typeof abHas !== "function" || abHas("salle"))) slWatch(); } catch (e) {} }, 1500); });

const slOpenTabs = () => (SL.tabs || []).filter((t) => t.status === "open");
const slTabOf = (id) => (SL.tabs || []).find((t) => t.id === id) || null;
const slTickets = (tabId) => (CM.orders || []).filter((o) => o.src === "salle" && o.tabId === tabId && o.status !== "annulee");
const slLive = (o) => ["attente", "nouvelle", "prep", "prete"].includes(o.status) && Date.now() - (o.at || 0) < 20 * 3600e3;
const slKitchen = () => (CM.orders || []).filter(slLive);
const slItemsOk = (t) => (t.items || []).filter((x) => !x.off);
const slTotal = (items) => Math.round(items.filter((x) => !x.off).reduce((a, x) => a + (+x.price || 0) * (+x.q || 0), 0) * 100) / 100;
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
    return rsOfDay(dayKey()).filter((b) => (typeof rsLive !== "function" || rsLive(b)) && [b.table, b.tableWith].includes(tid)).map((b) => ({ b, d: rsMin(b.time) - now })).filter((x) => x.d > -100 && x.d < 60).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0]?.b || null;
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
        if (SL.mine.has(o.id) || !["cuisine", "commandes"].includes(S.route)) return;
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
function slOnRows(rows) {
  rows.forEach((o) => {
    if (o.src !== "salle") return; const k = o.status + "|" + (o.call || 0), p = SL.st.get(o.id); SL.st.set(o.id, k);
    if (!SL.stInit || !p || p === k) return;
    if (o.status === "prete" && !p.startsWith("prete")) slReady(o, false); else if (o.status === "prete" && o.call) slReady(o, true);
  });
  SL.stInit = true;
}
function slReady(o, recall) {
  if (S.route === "cuisine" || S.route === "commandes") return;
  if (o.waiter !== S.me.id && S.route !== "salle") return;
  try { SFX.init(); SFX.tone(784, 0.18, "triangle", 0.06); SFX.tone(1175, 0.2, "triangle", 0.055, 0.12); SFX.tone(1568, 0.5, "sine", 0.05, 0.24); buzz(recall ? [80, 60, 80, 60, 160] : [60, 40, 60, 40, 120]); } catch (e) {}
  toast(`Table ${o.table} · ${o.courseT || "commande"} ${recall ? ": la cuisine vous appelle" : "prêt à servir"}`, "info");
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
function slFloor() {
  const { plan, cfg, T } = slTables(), open = slOpenTabs(), by = new Map(open.map((t) => [t.tableId, t]));
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
  const readyHtml = ready.length ? `<div class="sl-ready-l st" style="--i:2">${ready.map((o) => `<div class="sl-rd"><span class="sl-rdi">${ico("cmBell")}</span><div><b>Table ${esc(o.table)} · ${esc(o.courseT || "")}</b><em>${(o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0)} assiette${(o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0) > 1 ? "s" : ""} · prêt depuis <span class="sl-ago" data-at="${o.readyAt || o.at}">${slAgo(o.readyAt || o.at)}</span>${o.waiter && o.waiter !== S.me.id && o.waiterName ? ` · ${esc(firstName(o.waiterName))}` : ""}</em></div><button class="btn sm sl-servb" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}Servi</button></div>`).join("")}</div>` : "";
  const list = open.slice().sort((a, b) => ["ready", "draft", "hold", "cook", "open"].indexOf(slTabState(a).k) - ["ready", "draft", "hold", "cook", "open"].indexOf(slTabState(b).k) || (a.openedAt || 0) - (b.openedAt || 0));
  const right = `<button class="iconbtn" data-go="cuisine" aria-label="Écran cuisine" title="Écran cuisine">${ico("slHat")}</button>`;
  return `<div class="inner wide sl">${topBar("Prise de commande", { right })}
    <div class="sl-kpi st" style="--i:1"><div><b class="mono">${open.length}</b><span>table${open.length > 1 ? "s" : ""}</span></div><div><b class="mono">${covers}</b><span>couvert${covers > 1 ? "s" : ""}</span></div><div><b class="mono">${cook}</b><span>en cuisine</span></div>${ready.length ? `<div class="hot"><b class="mono">${ready.length}</b><span>prêt${ready.length > 1 ? "s" : ""}</span></div>` : ""}</div>
    ${readyHtml}
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
    <div class="sl-tsub st" style="--i:1">${tab.zone && tab.zone !== "salle" ? `<span>${esc((typeof plZones === "function" ? plZones(slTables().cfg) : []).find((z) => z.id === tab.zone)?.name || tab.zone)}</span>` : ""}<span>Ouverte <span class="sl-ago" data-at="${tab.openedAt}">${slAgo(tab.openedAt)}</span></span>${tab.byName ? `<span>${esc(firstName(tab.byName))}</span>` : ""}${tab.note ? `<span class="sl-tnote">${ico("rsNote")}${esc(tab.note)}</span>` : ""}</div>
    ${seg}
    <div class="sl-cols">${wide || SL.pane === "carte" ? `<div class="sl-c1">${carte}</div>` : ""}${wide || SL.pane === "cmd" ? `<div class="sl-c2">${cmd}${wide && cta ? `<div class="sl-wcta">${cta}</div>` : ""}</div>` : ""}</div>
    ${!wide && cta ? `<div class="ctabar sl-cta">${cta}</div>` : ""}
  </div>`;
}
function slDishes() { return typeof cmDishes === "function" ? cmDishes() : (S.notes || []).filter((n) => n.cat === "Recettes" && n.carte); }
function slCarte(tab) {
  const D = slDishes(), out = typeof cmCfg === "function" ? cmCfg().out || {} : {}, today = dayKey();
  const cats = (typeof CM_CATS !== "undefined" ? CM_CATS : []).filter(([k]) => D.some((n) => (n.carteCat || "plat") === k));
  if (SL.cat !== "tout" && !cats.some(([k]) => k === SL.cat)) SL.cat = "tout";
  const qty = {}; (tab.items || []).filter((x) => !x.off && !x.sent).forEach((x) => { qty[x.id] = (qty[x.id] || 0) + (+x.q || 0); });
  const L = SL.cat === "tout" ? D : D.filter((n) => (n.carteCat || "plat") === SL.cat);
  if (!D.length) return `<div class="glass sl-empty"><div class="sl-ill">${ico("book")}</div><b class="h3">La carte est vide</b><p class="sub">Les plats viennent des fiches de Recettes & allergènes cochées « à la carte », avec leur prix.</p><div class="hstack" style="justify-content:center;flex-wrap:wrap"><button class="btn acc sm" data-act="slGoCarte">${ico("plus")}Ajouter des plats</button><button class="btn soft sm" data-act="slFree">${ico("edit")}Article libre</button></div></div>`;
  const tile = (n, i) => {
    const o = out[n.id] === today, al = slDishAl(n.id), q = qty[n.id] || 0, hay = (typeof noteNorm === "function" ? noteNorm(n.title || "") : String(n.title || "").toLowerCase());
    return `<button class="sl-d${o ? " out" : ""}${q ? " has" : ""}" style="--i:${Math.min(i, 18)}" data-act="slAdd" data-id="${esc(n.id)}" data-hay="${esc(hay)}" ${o ? "disabled" : ""}>
      <b>${esc(n.title || "Sans nom")}</b><span class="sl-dp mono">${num(n.price) > 0 ? slEur(num(n.price)) : "—"}</span>
      ${o ? `<em class="sl-dout">Épuisé</em>` : al.length ? `<em class="sl-dal">${ico("slWarn")}${al.length}</em>` : ""}${q ? `<i class="sl-dq mono">${q}</i>` : ""}</button>`;
  };
  return `<div class="sl-carte">
    <label class="sl-search">${ico("search")}<input class="input" id="slQ" type="search" placeholder="Chercher un plat" autocomplete="off" enterkeyhint="search"></label>
    <div class="sl-cats" role="tablist"><button class="${SL.cat === "tout" ? "on" : ""}" data-act="slCat" data-v="tout">Tout</button>${cats.map(([k, t]) => `<button class="${SL.cat === k ? "on" : ""}" data-act="slCat" data-v="${k}">${esc(t)}</button>`).join("")}</div>
    <div class="sl-dg">${L.map(tile).join("")}<button class="sl-d free" data-act="slFree" data-hay="autre article libre">${ico("plus")}<b>Article libre</b><span class="sl-dp">Plat du jour, supplément…</span></button></div>
  </div>`;
}
function slFilter() {
  const q = typeof noteNorm === "function" ? noteNorm(SL.q || "") : String(SL.q || "").toLowerCase().trim();
  $$(".sl-dg .sl-d").forEach((b) => { b.style.display = !q || (b.dataset.hay || "").includes(q) ? "" : "none"; });
}
function slOrder(tab, T) {
  const items = slItemsOk(tab);
  if (!items.length) return `<div class="glass sl-empty sl-oempty"><div class="sl-ill">${ico("slPad")}</div><b class="h3">Rien pour l'instant</b><p class="sub">Touchez les plats de la carte : ils se rangent tout seuls en boissons, entrées, plats et desserts.</p></div>`;
  const tkSt = (c) => { const L = T.filter((o) => o.course === c); if (!L.length) return null; const pr = ["prete", "nouvelle", "prep", "attente", "servie"]; return L.map((o) => o.status).sort((a, b) => pr.indexOf(a) - pr.indexOf(b))[0]; };
  const blocks = SL_COURSES.map(([c, t, ic]) => {
    const L = items.filter((x) => +x.course === c); if (!L.length) return "";
    const s = tkSt(c), unsent = L.some((x) => !x.sent), ready = T.filter((o) => o.course === c && o.status === "prete"), heldHere = T.some((o) => o.course === c && o.status === "attente");
    const pill = unsent && !s ? `<span class="pill neu">À envoyer</span>` : s ? `<span class="pill sl-p-${s}">${SL_ST[s]}${unsent ? " · + ajout" : ""}</span>` : "";
    const act = ready.length ? `<button class="btn sm sl-servb" data-act="slServed" data-id="${esc(ready[0].id)}">${ico("check")}Servi</button>` : heldHere && !unsent ? `<button class="btn acc sm" data-act="slFire" data-v="${c}">${ico("slFire")}Envoyer</button>` : "";
    return `<section class="sl-cb${s === "prete" ? " rdy" : ""}"><header>${ico(ic)}<b>${t}</b>${pill}${act}</header>
      ${L.map((x) => { const al = (x.allergy || []), dal = slDishAl(x.id), clash = al.filter((a) => dal.includes(a));
        return `<button class="sl-it${x.sent ? " sent" : ""}" data-act="slItem" data-id="${esc(x.k)}"><b class="sl-q mono">${x.q}</b><span class="sl-in"><b>${esc(x.name)}</b>${x.note ? `<em>${esc(x.note)}</em>` : ""}${al.length ? `<i class="sl-ial${clash.length ? " clash" : ""}">${ico("slWarn")}Allergie : ${esc(al.map((a) => slAl(a).t).join(", "))}${clash.length ? " · le plat en contient" : ""}</i>` : ""}</span><span class="mono sl-ip">${slEur((+x.price || 0) * (+x.q || 0))}</span></button>`; }).join("")}
    </section>`;
  }).join("");
  return `<div class="glass sl-order">${blocks}<div class="sl-tot"><span>Total</span><b class="mono">${slEur(slTotal(items))}</b></div></div>
    <p class="note sl-nf">${ico("slBill")}<span>L'addition se règle sur votre caisse : Growth Gusto prend la commande, votre caisse encaisse.</span></p>`;
}

/* ───────── sheets ───────── */
function slOpenSheet(t) {
  const b = slBookingAt(t.id), seats = Math.max(2, +t.seats || 2), max = Math.max(8, seats + 2), def = b ? +b.covers || seats : seats;
  SL.pickT = t.id;
  openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Table ${esc(t.n)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${b ? `<div class="sl-bk">${ico("resa")}<span>Réservation <b>${esc(b.name || "")}</b> · ${esc(b.time)} · ${+b.covers || 0} pers.${b.notes ? `<em>${esc(b.notes)}</em>` : ""}</span></div>` : ""}
    <div class="lbl">Combien de couverts ?</div>
    <div class="sl-covg">${Array.from({ length: max }, (_, i) => i + 1).map((n) => `<button class="${n === def ? "on" : ""}" data-act="slOpen" data-v="${n}">${n}</button>`).join("")}</div>
  </div>`);
}
function slItemOpen(tab, x) {
  SL.ed = { tab: tab.id, k: x.k, q: +x.q || 1, note: x.note || "", al: [...(x.allergy || [])], course: +x.course };
  slItemPaint();
}
function slItemPaint() {
  const e = SL.ed, tab = slTabOf(e.tab), x = tab && (tab.items || []).find((y) => y.k === e.k); if (!x) { closeSheet(); return; }
  const dal = slDishAl(x.id), clash = e.al.filter((a) => dal.includes(a)), sent = !!x.sent;
  const html = `<div class="sl-sh"><div class="sl-shh"><span class="h2">${esc(x.name)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub" style="margin:0">${slEur(+x.price || 0)}${dal.length ? ` · contient : ${esc(dal.map((a) => slAl(a).t).join(", "))}` : x.id ? " · aucun allergène sur la fiche" : ""}</p>
    ${sent ? `<div class="sl-bk">${ico("slSend")}<span>Déjà envoyé en cuisine. Pour le changer, annulez-le et ajoutez-le à nouveau.</span></div>` : `
    <div class="sl-row"><span class="lbl">Quantité</span><div class="cm-step"><button data-act="slEdQ" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${e.q}</b><button data-act="slEdQ" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>
    <div class="field"><span class="lbl">Suite</span><div class="sl-segs">${SL_COURSES.map(([c, t]) => `<button class="${e.course === c ? "on" : ""}" data-act="slEdC" data-v="${c}">${t}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Note pour la cuisine</span><div class="sl-chips">${SL_NOTES.map((n) => `<button class="chip${e.note.split(", ").includes(n) ? " on" : ""}" data-act="slEdN" data-v="${esc(n)}">${esc(n)}</button>`).join("")}</div>
      <input class="input" id="slEdNote" maxlength="80" placeholder="Autre précision" value="${esc(e.note.split(", ").filter((n) => !SL_NOTES.includes(n)).join(", "))}"></div>
    <div class="field"><span class="lbl">Allergie du client</span><div class="sl-chips">${ALLERGENS.map((a) => `<button class="chip${e.al.includes(a.id) ? " on al" : ""}" data-act="slEdA" data-v="${a.id}">${esc(a.t)}</button>`).join("")}</div>
      ${clash.length ? `<div class="sl-clash">${ico("slWarn")}<span><b>Attention :</b> ce plat contient ${esc(clash.map((a) => slAl(a).t.toLowerCase()).join(", "))}. Vérifiez avec la cuisine.</span></div>` : ""}</div>`}
    <div class="grid2">${sent ? `<button class="btn danger" data-act="slEdDel">${ico("x")}Annuler le plat</button><button class="btn soft" data-act="sheetClose">Fermer</button>` : `<button class="btn soft" data-act="slEdDel">${ico("trash")}Retirer</button><button class="btn acc" data-act="slEdSave">Enregistrer</button>`}</div>
  </div>`;
  if ($(".sl-sh.ed")) { const s = $(".sl-sh.ed"); s.outerHTML = html.replace('class="sl-sh"', 'class="sl-sh ed"'); } else openSheet(html.replace('class="sl-sh"', 'class="sl-sh ed"'));
}
function slBillSheet(tab) {
  const items = slItemsOk(tab), agg = new Map();
  items.forEach((x) => { const k = x.name + "|" + (+x.price || 0); const a = agg.get(k) || { name: x.name, price: +x.price || 0, q: 0 }; a.q += +x.q || 0; agg.set(k, a); });
  const tot = slTotal(items), cov = +tab.covers || 0, held = slTickets(tab.id).filter((o) => o.status === "attente").length, cook = slTickets(tab.id).filter((o) => ["nouvelle", "prep", "prete"].includes(o.status)).length;
  openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Addition · Table ${esc(tab.table)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="sl-bill">${[...agg.values()].map((a) => `<div><b class="mono">${a.q}</b><span>${esc(a.name)}</span><em class="mono">${slEur(a.price * a.q)}</em></div>`).join("")}
      <div class="sl-btot"><span>Total TTC</span><b class="mono">${slEur(tot)}</b></div>${cov ? `<p>${cov} couvert${cov > 1 ? "s" : ""} · ${slEur(tot / cov)} par personne</p>` : ""}</div>
    <div class="sl-bk">${ico("slBill")}<span>Encaissez sur votre caisse habituelle : c'est elle qui édite la note et le ticket.</span></div>
    ${held || cook ? `<div class="sl-clash">${ico("slWarn")}<span>${held ? `${held} suite${held > 1 ? "s" : ""} pas encore envoyée${held > 1 ? "s" : ""} : elle${held > 1 ? "s" : ""} sera annulée${held > 1 ? "s" : ""} en cuisine.` : `Un bon est encore en cuisine.`}</span></div>` : ""}
    <button class="btn acc block" data-act="slClose">${ico("check")}Table réglée, libérer la table</button>
  </div>`);
}

/* ───────── kitchen tickets ───────── */
async function slSend(tab) {
  const un = slItemsOk(tab).filter((x) => !x.sent); if (!un.length) return;
  const T = slTickets(tab.id), food = T.filter((o) => o.course > 0);
  let firedMax = Math.max(0, ...food.filter((o) => o.status !== "attente").map((o) => o.course));
  const courses = [...new Set(un.map((x) => +x.course))].sort((a, b) => a - b), now = Date.now();
  let n = slNextN(), firedNew = false, sentFood = [];
  for (const c of courses) {
    const L = un.filter((x) => +x.course === c);
    const lower = food.some((o) => o.course < c) || sentFood.some((x) => x < c);
    const fire = c === 0 || c <= firedMax || (!lower && !firedNew);
    if (c > 0) { sentFood.push(c); if (fire) { firedNew = true; firedMax = Math.max(firedMax, c); } }
    const lines = L.map((x) => ({ k: x.k, id: x.id || "", name: x.name, price: +x.price || 0, q: +x.q || 1, note: x.note || "", allergy: x.allergy || [] }));
    const held = !fire && T.find((o) => o.course === c && o.status === "attente");
    if (held) {
      const items = [...(held.items || []), ...lines];
      await safe(DB.update("clientOrders", held.id, { items, total: slTotal(items) }));
      L.forEach((x) => { x.sent = held.id; });
      continue;
    }
    const id = slId("sl"); SL.mine.add(id);
    const doc = { src: "salle", mode: "table", table: String(tab.table), tableId: tab.tableId || "", tabId: tab.id, course: c, courseT: slCourseT(c), station: c === 0 ? "bar" : "cuisine", covers: +tab.covers || 0,
      items: lines, total: slTotal(lines), n: n++, day: dayKey(), at: now, waiter: S.me.id, waiterName: S.me.name || "", status: fire ? "nouvelle" : "attente", pay: "place", paid: false, name: "", phone: "", slot: "", note: tab.note || "",
      ...(fire ? { firedAt: now } : {}), ...(T.some((o) => o.course === c) ? { add: true } : {}) };
    await safe(DB.set("clientOrders", id, doc));
    L.forEach((x) => { x.sent = id; });
    if (DB.mode === "demo" && fire) slDemoCook(id);
  }
  await slSaveTab(tab);
  SFX.done(); buzz([16, 40, 16]); if (typeof burst === "function") try { burst(); } catch (e) {}
  const heldNow = slTickets(tab.id).some((o) => o.status === "attente");
  toast(heldNow ? "Envoyé en cuisine · la suite attend votre signal" : "Envoyé en cuisine");
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
const slCurTab = () => (S.route === "salle" && S.params && S.params.id ? slTabOf(S.params.id) : null);

/* ───────── view: écran cuisine ───────── */
VIEWS.cuisine = {
  render() {
    slWatch();
    const all = slKitchen(), st = SL.station;
    const inSt = (o) => st === "tout" || (st === "bar" ? o.station === "bar" : o.station !== "bar");
    const live = all.filter((o) => ["nouvelle", "prep"].includes(o.status) && inSt(o)).sort((a, b) => (a.firedAt || a.at || 0) - (b.firedAt || b.at || 0));
    const ready = all.filter((o) => o.status === "prete" && inSt(o)).sort((a, b) => (a.readyAt || 0) - (b.readyAt || 0));
    const held = all.filter((o) => o.status === "attente" && inSt(o)).sort((a, b) => (a.at || 0) - (b.at || 0));
    const hasBar = all.some((o) => o.station === "bar");
    const sound = SFX.ctx && SFX.ctx.state === "running";
    const right = `<span class="sl-clock mono" id="slClock">${hm(Date.now())}</span><button class="iconbtn${SL.print ? " on" : ""}" data-act="slPrintTog" aria-pressed="${SL.print}" aria-label="Imprimer chaque nouveau bon" title="Imprimer chaque nouveau bon">${ico("printer")}</button><button class="iconbtn sl-fullb" data-act="cmFull" aria-label="Plein écran" title="Plein écran">${ico("cmFull")}</button>`;
    const pas = (o) => `${(o.items || []).reduce((a, x) => a + (x.off ? 0 : +x.q || 0), 0)}`;
    return `<div class="inner wide sl sl-k">${topBar("Écran cuisine", { right })}
      ${sound ? "" : `<button class="sl-snd st" style="--i:1" data-act="slSound">${ico("sound")}<span><b>Touchez pour activer le carillon</b><em>La tablette sonne à chaque nouveau bon.</em></span></button>`}
      <div class="sl-kbar st" style="--i:1"><div class="sl-segs sm">${[["tout", "Tout"], ["cuisine", "Cuisine"], ...(hasBar || st === "bar" ? [["bar", "Bar"]] : [])].map(([k, t]) => `<button class="${st === k ? "on" : ""}" data-act="slStation" data-v="${k}">${t}</button>`).join("")}</div>
        <span class="sl-kc"><b class="mono">${live.length}</b> en cours</span>${held.length ? `<span class="sl-kc"><b class="mono">${held.length}</b> à suivre</span>` : ""}</div>
      <div class="sl-kwrap">
        <div class="sl-kgrid">${live.map((o, i) => slKCard(o, i)).join("") || `<div class="glass sl-empty sl-kempty st" style="--i:2"><div class="cm-rail-ill" aria-hidden="true"><i></i><i></i><i></i></div><b class="h3">Rien sur le feu</b><p class="sub">Les bons de la salle et du menu QR arrivent ici, le plus ancien en premier.</p></div>`}</div>
        <aside class="sl-kside">
          <div class="glass sl-ks"><header>${ico("cmBell")}<b>Prêts</b><span class="mono">${ready.length}</span></header>${ready.map((o) => `<div class="sl-kr${o.call ? " call" : ""}"><div><b>${o.src === "salle" ? `Table ${esc(o.table)}` : o.mode === "table" ? `n° ${o.n} · Table ${esc(o.table)}` : `n° ${o.n} · ${esc(o.name || "À emporter")}`}</b><em>${esc(o.courseT || "Commande QR")} · ${pas(o)} · <span class="cm-ago" data-at="${o.readyAt || o.at}">${slAgo(o.readyAt || o.at)}</span></em></div>
            ${o.src === "salle" ? `<button class="iconbtn sm" data-act="slCall" data-id="${esc(o.id)}" aria-label="Rappeler le serveur" title="Rappeler le serveur">${ico("slCall")}</button>` : ""}<button class="btn sm sl-servb" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}${o.src === "salle" ? "Parti" : "Remis"}</button></div>`).join("") || `<p class="sl-ksn">Rien en attente au passe.</p>`}</div>
          <div class="glass sl-ks hold"><header>${ico("clock")}<b>À suivre</b><span class="mono">${held.length}</span></header>${held.map((o) => `<div class="sl-kh"><b>Table ${esc(o.table)} · ${esc(o.courseT)}</b><em>${(o.items || []).map((x) => `${x.q} ${esc(x.name)}`).join(", ")}</em>${(o.items || []).some((x) => (x.allergy || []).length) ? `<i class="sl-ial clash">${ico("slWarn")}Allergie</i>` : ""}</div>`).join("") || `<p class="sl-ksn">Les suites annoncées par la salle s'affichent ici avant d'être lancées.</p>`}</div>
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
  const t0 = o.firedAt || o.at, m = slMin(t0), salle = o.src === "salle";
  const later = salle ? slTickets(o.tabId).filter((x) => x.status === "attente" && x.id !== o.id) : [];
  const head = salle ? `<b class="sl-ktab">Table <span class="mono">${esc(o.table)}</span></b><span class="sl-kcrs">${esc(o.courseT || "")}</span>`
    : `<b class="sl-ktab">${o.mode === "table" ? `Table <span class="mono">${esc(o.table)}</span>` : `${ico("cmBag")}<span class="mono">${esc(o.slot || "")}</span>`}</b><span class="sl-kcrs qr">QR n° ${o.n}</span>`;
  const meta = [salle && o.waiterName ? firstName(o.waiterName) : "", salle && o.covers ? `${o.covers} couv.` : "", !salle && o.name ? o.name : "", !salle ? (o.paid ? "payée" : "à encaisser") : ""].filter(Boolean);
  return `<article class="sl-kcard s-${o.status}${m >= 20 ? " late" : m >= 10 ? " warm" : ""}${CM.fresh.has(o.id) ? " fresh" : ""}${o.station === "bar" ? " bar" : ""}" style="--i:${Math.min(i, 10)}" data-id="${esc(o.id)}">
    <header>${head}<span class="sl-kt mono" data-at="${t0}">${slAgo(t0)}</span></header>
    <div class="sl-kmeta">${o.add ? `<span class="sl-add">Ajout</span>` : ""}${meta.map((x) => `<span>${esc(x)}</span>`).join("")}${o.status === "prep" ? `<span class="sl-fire">${ico("slFire")}Sur le feu</span>` : ""}</div>
    <ul class="sl-kit">${(o.items || []).map((x, j) => `<li class="${x.ok ? "ok" : ""}${x.off ? " off" : ""}" data-act="slKItem" data-id="${esc(o.id)}" data-v="${j}"><b class="mono">${x.q}</b><span>${esc(x.name)}${x.off ? `<i class="sl-ial">Annulé</i>` : ""}${x.note ? `<em>${esc(x.note)}</em>` : ""}${(x.allergy || []).length ? `<i class="sl-ial clash">${ico("slWarn")}ALLERGIE ${esc(x.allergy.map((a) => slAl(a).t).join(", ").toUpperCase())}</i>` : ""}</span></li>`).join("")}</ul>
    ${o.note ? `<div class="cm-onote">${ico("rsNote")}<span>${esc(o.note)}</span></div>` : ""}
    ${later.length ? `<div class="sl-later">${ico("clock")}<span>À suivre : ${later.map((x) => `${esc(x.courseT)} (${x.items.reduce((a, y) => a + (+y.q || 0), 0)})`).join(", ")}</span></div>` : ""}
    <footer>${o.status === "nouvelle" ? `<button class="btn soft sl-kgo" data-act="slKNext" data-id="${esc(o.id)}" data-v="prep">${ico("slFire")}Lancer</button>` : ""}<button class="btn acc sl-kgo rdy" data-act="slKNext" data-id="${esc(o.id)}" data-v="prete">${ico("cmBell")}Prêt</button><button class="iconbtn sm" data-act="slPrintOne" data-id="${esc(o.id)}" aria-label="Imprimer le bon">${ico("printer")}</button></footer>
  </article>`;
}
async function slWake(on) {
  try {
    if (on) { if (!("wakeLock" in navigator) || (SL.wake && !SL.wake.released)) return; SL.wake = await navigator.wakeLock.request("screen"); }
    else if (SL.wake) { await SL.wake.release(); SL.wake = null; }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.route === "cuisine") { SL.wake = null; slWake(true); } });

/* kitchen ticket on the label printer (62 mm roll, AirPrint / print dialog) */
function slPrint(o) {
  const name = (S.resto && S.resto.name) || "", salle = o.src === "salle";
  const css = `@page{size:62mm auto;margin:3mm}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;color:#000;width:56mm}
  h1{font-size:22pt;margin:0 0 1mm;letter-spacing:-.02em}.c{font-size:13pt;font-weight:800;text-transform:uppercase;margin-bottom:1mm}.m{font-size:9pt;margin-bottom:2mm;border-bottom:1px dashed #000;padding-bottom:2mm}
  .i{display:flex;gap:2mm;font-size:13pt;font-weight:700;margin:1.5mm 0}.i b{min-width:7mm}.n{display:block;font-size:10pt;font-weight:600;font-style:italic}.a{display:block;font-size:10pt;font-weight:900;border:1.5px solid #000;padding:.5mm 1mm;margin-top:.5mm}
  .f{border-top:1px dashed #000;margin-top:2mm;padding-top:1.5mm;font-size:9pt}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon ${esc(o.table || o.n)}</title><style>${css}</style></head><body>
    <h1>${salle || o.mode === "table" ? `Table ${esc(o.table)}` : `À emporter ${esc(o.slot || "")}`}</h1><div class="c">${esc(salle ? o.courseT || "" : `QR n° ${o.n}`)}${o.add ? " · ajout" : ""}</div>
    <div class="m">${hm(o.firedAt || o.at)} · ${esc([o.waiterName && firstName(o.waiterName), o.covers ? `${o.covers} couverts` : "", o.name].filter(Boolean).join(" · "))}</div>
    ${(o.items || []).filter((x) => !x.off).map((x) => `<div class="i"><b>${x.q}</b><span>${esc(x.name)}${x.note ? `<span class="n">${esc(x.note)}</span>` : ""}${(x.allergy || []).length ? `<span class="a">ALLERGIE ${esc(x.allergy.map((a) => slAl(a).t).join(", ").toUpperCase())}</span>` : ""}</span></div>`).join("")}
    ${o.note ? `<div class="f">${esc(o.note)}</div>` : ""}<div class="f">${esc(name)}</div></body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 250);
}

/* ───────── demo: a lunch service in full swing, and a kitchen that answers ───────── */
function slSeedDemo() {
  const tp = `restos/${S.rid}/salleTabs`; if (DB.local[tp]) return;
  const D = slDishes().filter((n) => num(n.price) > 0), by = (cat) => D.filter((n) => (n.carteCat || "plat") === cat);
  const pick = (cat, i, fb) => { const L = by(cat); const n = L[i]; return n ? { id: n.id, name: n.title, price: num(n.price), cat } : { id: "", name: fb[0], price: fb[1], cat }; };
  const drink = pick("boisson", 0, ["Limonade maison", 4.5]), ent = pick("entree", 0, ["Velouté de potimarron", 8.5]), sh = pick("partage", 0, ["Croquettes de jambon", 9]), sh2 = pick("partage", 1, ["Planche de charcuterie", 18]);
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
  tab("dst7", "dt6", "7", "salle", 6, 14, sarah, [it(sh, 2, 1), it(sh2, 1, 1), it(p1, 4, 2), it(p2, 2, 2, { allergy: ["lait"], note: "Sans beurre blanc" })], [[1, "prep", 11, { prepAt: now - 6 * 6e4 }], [2, "attente", 12]]);
  tab("dst21", "dt10", "21", "terrasse", 2, 5, mine, [it(drink, 2, 0), it(ent, 1, 1), it(p2, 1, 2)], [[0, "prete", 4, { readyAt: now - 2 * 6e4 }], [1, "nouvelle", 3], [2, "attente", 3]]);
  tab("dst5", "dt4", "5", "salle", 2, 58, sarah, [it(p1, 1, 2), it(p2, 1, 2), it(ds, 2, 3)], [[2, "servie", 50], [3, "servie", 9]]);
  DB.local[tp] = tabs;
  try { DB.emit(op); } catch (e) {}
}
/* demo: the kitchen launches and finishes what the visitor sends (so the « prêt » alert can be felt) */
function slDemoCook(id) {
  setTimeout(() => { if (DB.mode !== "demo") return; const o = (CM.orders || []).find((x) => x.id === id); if (o && o.status === "nouvelle") DB.update("clientOrders", id, { status: "prep", prepAt: Date.now() }); }, 7000);
  setTimeout(() => { if (DB.mode !== "demo") return; const o = (CM.orders || []).find((x) => x.id === id); if (o && ["nouvelle", "prep"].includes(o.status)) DB.update("clientOrders", id, { status: "prete", readyAt: Date.now() }); }, 20000);
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  slTable: (a, id) => {
    const t = slTableBy(id); if (!t) return; const tab = slOpenTabs().find((x) => x.tableId === id);
    if (SL.move) { const m = SL.move; SL.move = null; if (tab) { SFX.err(); toast("Cette table est déjà occupée.", "err"); return; } return ACT.slMoveTo(a, m, id); }
    SFX.tap(); buzz(5); if (tab) go("salle", { id: tab.id }); else slOpenSheet(t);
  },
  slOpen: async (a, id, v) => {
    const t = slTableBy(SL.pickT); if (!t) return; const ex = slOpenTabs().find((x) => x.tableId === t.id); if (ex) { closeSheet(); go("salle", { id: ex.id }); return; }
    const b = slBookingAt(t.id), tid = slId("st");
    const doc = { table: String(t.n), tableId: t.id, zone: t.zone || "", covers: +v, status: "open", day: dayKey(), openedAt: Date.now(), by: S.me.id, byName: S.me.name || "", items: [], total: 0, note: b && b.notes ? String(b.notes).slice(0, 140) : "", ...(b ? { booking: b.id } : {}) };
    SFX.ok(); buzz(8); closeSheet(); SL.paneTab = null;
    try { await safe(DB.set("salleTabs", tid, doc)); if (b && b.status !== "arrive" && typeof rsSave === "function") rsSave(b.id, { status: "arrive" }); } catch (e) { return; }
    go("salle", { id: tid });
  },
  slGoCarte: () => { SFX.tap(); if (typeof CM !== "undefined") CM.tab = "carte"; go("commandes", { tab: "carte" }); },
  slPane: (a, id, v) => { if (SL.pane === v) return; SL.pane = v; SFX.tick(); buzz(3); rerender(); },
  slCat: (a, id, v) => { SL.cat = v; SFX.tick(); rerender(); },
  slAdd: (a, id) => {
    const tab = slCurTab(), n = (S.notes || []).find((x) => x.id === id); if (!tab || !n) return;
    const c = slCourseOf(n.carteCat || "plat"); tab.items = tab.items || [];
    const ex = tab.items.find((x) => !x.sent && !x.off && x.id === id && +x.course === c && !x.note && !(x.allergy || []).length);
    if (ex) ex.q = (+ex.q || 0) + 1; else tab.items.push({ k: slId("i"), id, name: n.title || "Article", price: num(n.price), q: 1, note: "", allergy: [], course: c, cat: n.carteCat || "plat", sent: null });
    SFX.tick(); buzz(6);
    const q = (tab.items || []).filter((x) => !x.sent && !x.off && x.id === id).reduce((s, x) => s + (+x.q || 0), 0);
    let badge = a.querySelector(".sl-dq"); if (!badge) { badge = document.createElement("i"); badge.className = "sl-dq mono"; a.appendChild(badge); } badge.textContent = q; a.classList.add("has"); badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
    slSaveTab(tab);
  },
  slFree: () => {
    if (!slCurTab()) return; SFX.tap();
    openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Article libre</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <label class="field"><span class="lbl">Nom</span><input class="input" id="slFrN" maxlength="60" placeholder="Plat du jour, supplément frites…"></label>
      <label class="field"><span class="lbl">Prix TTC</span><input class="input mono" id="slFrP" inputmode="decimal" placeholder="0,00"></label>
      <div class="field"><span class="lbl">Suite</span><div class="sl-segs">${SL_COURSES.map(([c, t]) => `<button class="${c === 2 ? "on" : ""}" data-act="slFrC" data-v="${c}">${t}</button>`).join("")}</div></div>
      <button class="btn acc block" data-act="slFrOk">${ico("plus")}Ajouter</button></div>`);
    SL.frC = 2; setTimeout(() => { const i = document.getElementById("slFrN"); if (i) i.focus(); }, 300);
  },
  slFrC: (a, id, v) => { SL.frC = +v; $$(".sl-sh .sl-segs button").forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); },
  slFrOk: () => {
    const tab = slCurTab(); if (!tab) return; const name = (document.getElementById("slFrN") || {}).value.trim(), price = num((document.getElementById("slFrP") || {}).value);
    if (name.length < 2) { SFX.err(); toast("Donnez un nom à l'article.", "err"); return; }
    tab.items = tab.items || []; tab.items.push({ k: slId("i"), id: "", name: name.slice(0, 60), price: Math.max(0, Math.round(price * 100) / 100), q: 1, note: "", allergy: [], course: SL.frC == null ? 2 : SL.frC, cat: "libre", sent: null });
    closeSheet(); SFX.ok(); slSaveTab(tab);
  },
  slItem: (a, id) => { const tab = slCurTab(); const x = tab && (tab.items || []).find((y) => y.k === id); if (!x) return; SFX.tap(); slItemOpen(tab, x); },
  slEdQ: (a, id, v) => { SL.ed.q = Math.max(1, Math.min(40, SL.ed.q + +v)); SL.ed.note = slEdNoteNow(); SFX.tick(); slItemPaint(); },
  slEdC: (a, id, v) => { SL.ed.course = +v; SL.ed.note = slEdNoteNow(); SFX.tick(); slItemPaint(); },
  slEdN: (a, id, v) => { const L = slEdNoteNow().split(", ").filter(Boolean); const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.unshift(v); SL.ed.note = L.join(", "); SFX.tick(); slItemPaint(); },
  slEdA: (a, id, v) => { const L = SL.ed.al, i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); SL.ed.note = slEdNoteNow(); i >= 0 ? SFX.tick() : (SFX.err(), buzz(10)); slItemPaint(); },
  slEdSave: () => {
    const e = SL.ed, tab = slTabOf(e.tab), x = tab && tab.items.find((y) => y.k === e.k); if (!x) return;
    Object.assign(x, { q: e.q, note: slEdNoteNow().slice(0, 120), allergy: e.al.slice(), course: e.course }); closeSheet(); SFX.ok(); slSaveTab(tab);
  },
  slEdDel: async () => {
    const e = SL.ed, tab = slTabOf(e.tab), x = tab && tab.items.find((y) => y.k === e.k); if (!x) return;
    if (!x.sent) { tab.items = tab.items.filter((y) => y.k !== e.k); closeSheet(); SFX.tap(); await slSaveTab(tab); return; }
    const b = $(".sl-sh [data-act=slEdDel]"); if (b && b.dataset.sure !== "1") { b.dataset.sure = "1"; b.innerHTML = `${ico("slWarn")}Touchez encore`; SFX.err(); buzz([20, 40, 20]); return; }
    x.off = true; const o = (CM.orders || []).find((y) => y.id === x.sent);
    if (o) { const items = (o.items || []).map((y) => (y.k === x.k ? { ...y, off: true } : y)); const left = items.some((y) => !y.off); await safe(DB.update("clientOrders", o.id, { items, total: slTotal(items), ...(left ? {} : { status: "annulee", cancelledAt: Date.now(), cancelledBy: S.me.id }) })); }
    closeSheet(); SFX.close(); await slSaveTab(tab); toast(`${x.name} annulé, la cuisine est prévenue`);
  },
  slSend: async (a) => { const tab = slCurTab(); if (!tab || SL.busy.send) return; SL.busy.send = true; a.disabled = true; try { await slSend(tab); } catch (e) { console.warn(e); } SL.busy.send = false; onData(); },
  slFire: async (a, id, v) => { const tab = slCurTab(); if (!tab || SL.busy.fire) return; SL.busy.fire = true; a.disabled = true; try { await slFire(tab, v === "" || v == null ? null : +v); } catch (e) { console.warn(e); } SL.busy.fire = false; onData(); },
  slServed: async (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.ok(); buzz(8);
    const row = a.closest(".sl-rd,.sl-kr,.sl-cb"); if (row) row.classList.add("go");
    await safe(DB.update("clientOrders", id, { status: "servie", doneAt: Date.now(), by: S.me.id }));
    S.ui.undo = () => DB.update("clientOrders", id, { status: "prete", doneAt: null }); toastUndo(o.src === "salle" ? `Table ${o.table} · ${o.courseT} servi` : `Commande n° ${o.n} remise`);
  },
  slBill: () => { const tab = slCurTab(); if (!tab) return; SFX.sheet ? SFX.sheet() : SFX.tap(); slBillSheet(tab); },
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
  slTabMenu: () => {
    const tab = slCurTab(); if (!tab) return; SFX.tap();
    openSheet(`<div class="sl-sh"><div class="sl-shh"><span class="h2">Table ${esc(tab.table)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <label class="field"><span class="lbl">Note pour toute la table</span><input class="input" id="slTNote" maxlength="140" placeholder="Anniversaire : bougie au dessert" value="${esc(tab.note || "")}"></label>
      <button class="btn soft block" data-act="slTNoteOk">${ico("check")}Enregistrer la note</button>
      <button class="btn soft block" data-act="slMove">${ico("slMove")}Changer de table</button>
      <button class="btn soft block" data-act="slBill">${ico("slBill")}Addition et libérer la table</button>
      ${slItemsOk(tab).length ? "" : `<button class="btn ghost block" data-act="slDrop">${ico("x")}Annuler l'ouverture</button>`}</div>`);
  },
  slTNoteOk: async () => { const tab = slCurTab(); if (!tab) return; const v = ((document.getElementById("slTNote") || {}).value || "").trim().slice(0, 140); closeSheet(); SFX.ok(); await safe(DB.update("salleTabs", tab.id, { note: v })); },
  slDrop: async () => { const tab = slCurTab(); if (!tab) return; closeSheet(); await safe(DB.update("salleTabs", tab.id, { status: "closed", closedAt: Date.now(), closedBy: S.me.id, total: 0 })); SFX.close(); go("salle", {}, { replace: true }); },
  slMove: () => { const tab = slCurTab(); if (!tab) return; closeSheet(); SL.move = tab.id; go("salle", {}); setTimeout(() => toast("Touchez la nouvelle table", "info"), 300); },
  slMoveTo: async (a, tabId, tid) => {
    const tab = slTabOf(tabId), t = slTableBy(tid); if (!tab || !t) return; SFX.ok(); buzz(8);
    await safe(DB.update("salleTabs", tabId, { table: String(t.n), tableId: t.id, zone: t.zone || "" }));
    for (const o of slTickets(tabId)) if (slLive(o)) await safe(DB.update("clientOrders", o.id, { table: String(t.n), tableId: t.id }));
    toast(`Table ${tab.table} → table ${t.n}`); go("salle", { id: tabId }, { replace: true });
  },
  /* kitchen */
  slSound: () => { SFX.init(); try { SFX.tone(1047, 0.2, "sine", 0.05); SFX.tone(1568, 0.35, "sine", 0.045, 0.12); } catch (e) {} buzz(8); setTimeout(rerender, 120); },
  slStation: (a, id, v) => { SL.station = v; SFX.tick(); rerender(); },
  slPrintTog: () => { SL.print = !SL.print; try { localStorage.setItem("gg-sl-print", SL.print ? "1" : "0"); } catch (e) {} SFX.tick(); toast(SL.print ? "Chaque nouveau bon s'imprime sur cet appareil" : "Impression automatique coupée"); rerender(); },
  slPrintOne: (a, id) => { const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.print ? SFX.print() : SFX.tap(); slPrint(o); },
  slKItem: async (a, id, v) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; const i = +v; const items = (o.items || []).map((x, j) => (j === i ? { ...x, ok: !x.ok } : x));
    a.classList.toggle("ok", !!items[i].ok); SFX.tick(); buzz(4); await safe(DB.update("clientOrders", id, { items }));
  },
  slKNext: async (a, id, v) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o || SL.busy[id]) return; SL.busy[id] = true;
    const patch = { status: v, by: S.me.id }; if (v === "prep") patch.prepAt = Date.now(); if (v === "prete") patch.readyAt = Date.now();
    const card = a.closest(".sl-kcard"); if (v === "prete" && card) card.classList.add("go");
    v === "prete" ? (SFX.done(), buzz([14, 40, 14])) : (SFX.ok(), buzz(8));
    setTimeout(async () => {
      try { await safe(DB.update("clientOrders", id, patch)); if (v === "prete") { S.ui.undo = () => DB.update("clientOrders", id, { status: o.status, readyAt: null }); toastUndo(o.src === "salle" ? `Table ${o.table} · ${o.courseT} : le serveur est prévenu` : `Commande n° ${o.n} prête`); } } catch (e) {}
      delete SL.busy[id]; onData();
    }, v === "prete" && card ? 280 : 0);
  },
  slCall: async (a, id) => { SFX.tap(); buzz(8); await safe(DB.update("clientOrders", id, { call: Date.now() })); toast("Le serveur est rappelé"); },
});
function slEdNoteNow() {
  const chips = $$(".sl-sh.ed .sl-chips .chip.on").map((b) => b.dataset.v).filter((v) => SL_NOTES.includes(v));
  const free = (document.getElementById("slEdNote") || {}).value; const e = SL.ed;
  const base = chips.length || free != null ? chips : (e.note || "").split(", ").filter((n) => SL_NOTES.includes(n));
  const extra = free != null ? free.trim() : (e.note || "").split(", ").filter((n) => !SL_NOTES.includes(n)).join(", ");
  return [...base, ...(extra ? [extra] : [])].join(", ");
}
