/* Growth Gusto — area: commande en ligne (route « commandes »). Prefix « cm ».
   QR menu at the table and takeaway ordering, paid online (Stripe, on the restaurant's own account) or on site.
   - En cuisine : live ticket rail (nouvelles → en préparation → prêtes), chime on a new order, one tap to move an order on,
     cancel (a paid order is refunded by the server), kitchen screen in full screen.
   - La carte : the dishes of « Recettes & allergènes » marked « à la carte » with a price (js/notes.js: carte, carteCat, price,
     photo, allergens through recipeAllergens). Here: shown online or not, sold out today, a short description for clients,
     « végétarien ». A quick « ajouter un plat ou une boisson » creates the recipe card itself (cat Recettes, carte:true).
   - QR codes : one QR per table (A4 sheet of cut-out cards with the restaurant's logo) + a takeaway poster, link to copy.
   - Réglages : open/closed, à table, à emporter (days, hours, preparation time), payment (Stripe Connect link, on site).
   Data:
     restos/{rid}/clientOrders/{id}  written by the server (functions/src/commande.js orderApi); the team moves status on:
                                     nouvelle → prep → prete → servie (+ prepAt, readyAt, doneAt, by). Read by js/achats.js for forecasts.
     restos/{rid}/qrMenu/cfg         { on, table, takeaway, payOnline, payPlace, tablePay: avant|choix|apres (à table), tips (pourboire proposé au paiement en ligne, js/pourboires.js), prepMin, tables, pickup:{days,windows:[{from,to}],step}, msg,
                                       hidden:[noteId], out:{noteId:"YYYY-MM-DD"}, desc:{noteId:text}, veg:[noteId], setupAt }
     restos/{rid}/qrPay/link         Stripe account of the restaurant (server-written, members read)
     restos/{rid}/public/menu        projection read by the public page commande/ (cmPubDoc): never a client's data, never a cost price.
                                     + promos (js/prix.js pxPubPromos): happy hours and plat du jour, applied by the page and by orderApi.
   Exposed: cmOrdersToday() → orders of the day (live ones first), CMD.unseen(). */
"use strict";

TAB_OF.commandes = "more";
(function cmNav() { /* side nav: after « Réservations » (no edit of the shared NAV list) */
  if (NAV.some((n) => n[0] === "commandes")) return; const i = NAV.findIndex((n) => n[0] === "resa");
  NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["commandes", "cmQr", "Commandes en ligne"]);
})();
Object.assign(IC, {
  cmQr: ["r:3,3,7,7,1.5", "r:14,3,7,7,1.5", "r:3,14,7,7,1.5", "M14 14h3v3", "M21 14v.01", "M14 21h3", "M21 18v3h-1", "M6 6h.01", "M17 6h.01", "M6 17h.01", "f:M3 3h7v7H3z"],
  cmBag: ["M6 7h12l1 14H5L6 7Z", "M9 10V6a3 3 0 0 1 6 0v4", "f:M6 7h12l1 14H5z"],
  cmChef: ["M17 21a1 1 0 0 0 1-1v-5.35c0-.46.31-.85.74-1.03A4 4 0 0 0 17 6a5 5 0 0 0-10 0 4 4 0 0 0-1.74 7.62c.43.18.74.57.74 1.03V20a1 1 0 0 0 1 1Z", "M6 17h12"],
  cmBell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0", "f:M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"],
  cmCard: ["r:2,5,20,14,3", "M2 10h20", "M6 15h4"],
  cmFull: ["M8 3H5a2 2 0 0 0-2 2v3", "M21 8V5a2 2 0 0 0-2-2h-3", "M3 16v3a2 2 0 0 0 2 2h3", "M16 21h3a2 2 0 0 0 2-2v-3"],
  cmLeaf: ["M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z", "M2 21c0-3 1.85-5.36 5.08-6"],
  cmEye: ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z", "c:12,12,3"],
  cmOff: ["M9.88 9.88a3 3 0 1 0 4.24 4.24", "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68", "M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61", "M2 2l20 20"],
  cmSpark: ["M12 3l1.7 4.6a2 2 0 0 0 1.2 1.2L19.5 10.5l-4.6 1.7a2 2 0 0 0-1.2 1.2L12 18l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 10.5l4.6-1.7a2 2 0 0 0 1.2-1.2Z", "M19 3v3", "M20.5 4.5h-3", "M5 18v3", "M6.5 19.5h-3", "f:M12 3l1.7 4.6a2 2 0 0 0 1.2 1.2L19.5 10.5l-4.6 1.7a2 2 0 0 0-1.2 1.2L12 18l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 10.5l4.6-1.7a2 2 0 0 0 1.2-1.2Z"],
  cmDoc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5", "M9 13h6", "M9 17h4", "f:M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8h-5z"],
  cmGlobe: ["c:12,12,9", "M3 12h18", "M12 3a14 14 0 0 1 0 18", "M12 3a14 14 0 0 0 0 18"],
  cmPrintI: ["M7 9V3h10v6", "r:3,9,18,8,2", "M7 14h10v7H7z", "M17 12.5h.01", "f:M3 11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  cmStripe: ["M13.5 7.5c-1-.6-2.2-.9-3.2-.9-1.8 0-3 .9-3 2.3 0 3.2 6.4 2.2 6.4 5.6 0 1.6-1.4 2.8-3.6 2.8-1.3 0-2.8-.4-3.9-1.1", "M10.5 3v3.6", "M10.5 17.4V21"],
});

/* ───────── config ───────── */
const CM_ST = {
  apayer: { t: "Paiement en cours", k: "pay" }, nouvelle: { t: "Nouvelle", k: "new" }, prep: { t: "En préparation", k: "prep" },
  prete: { t: "Prête", k: "ready" }, servie: { t: "Terminée", k: "done" }, annulee: { t: "Annulée", k: "off" }, abandonnee: { t: "Non payée", k: "off" },
};
const CM_CATS = [["partage", "À partager"], ["entree", "Entrées"], ["plat", "Plats"], ["dessert", "Desserts"], ["boisson", "Boissons"]];
const CM_DAYS = [[1, "L"], [2, "M"], [3, "M"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const cmDefCfg = () => ({ on: false, table: true, takeaway: true, payOnline: true, payPlace: true, prepMin: 20, tables: 0, msg: "",
  pickup: { days: [1, 2, 3, 4, 5, 6], windows: [{ from: "11:45", to: "14:00" }, { from: "18:30", to: "21:30" }], step: 15 }, hidden: [], out: {}, desc: {}, veg: [] });
const CM = { rid: null, orders: null, cfgDoc: null, cfgSeen: false, link: null, pub: null, pubSeen: false, known: null, fresh: new Set(), tab: "live", col: "nouvelle", busy: {}, ed: null, tick: null, pubT: null, showDone: false, demoPing: false };
function cmCfg() {
  const d = cmDefCfg(), c = CM.cfgDoc || {}; const o = { ...d, ...c };
  o.pickup = { ...d.pickup, ...(c.pickup || {}) }; if (!Array.isArray(o.pickup.windows) || !o.pickup.windows.length) o.pickup.windows = d.pickup.windows; if (!Array.isArray(o.pickup.days)) o.pickup.days = d.pickup.days;
  o.hidden = Array.isArray(c.hidden) ? c.hidden : []; o.veg = Array.isArray(c.veg) ? c.veg : []; o.out = c.out && typeof c.out === "object" ? c.out : {}; o.desc = c.desc && typeof c.desc === "object" ? c.desc : {};
  o.prepMin = +o.prepMin || 20; o.tables = +o.tables || 0;
  o.look = { ...CM_LOOK0, ...(c.look && typeof c.look === "object" ? c.look : {}) };
  return o;
}
/* paiement à table (cfg.tablePay): « avant » required when ordering (Stripe), « choix » the client picks, « apres » at the end of the meal.
   Without Stripe, only « apres ». Older configs had only payOnline / payPlace: read them the same way the public page does. */
const CM_TPAY = [["avant", "Obligatoire à la commande", "Le client paie en ligne avant que la commande parte en cuisine. Aucun oubli possible."],
  ["choix", "Au choix du client", "Payer tout de suite en ligne, ou à la fin du repas."], ["apres", "À la fin du repas", "Pas de paiement en ligne à table : le serveur encaisse. La table est marquée « À régler »."]];
function cmTablePay(c) { c = c || cmCfg(); const on = !!(CM.link && CM.link.charges) || DB.mode === "demo"; const v = ["avant", "choix", "apres"].includes(c.tablePay) ? c.tablePay : !c.payOnline ? "apres" : c.payPlace === false ? "avant" : "choix"; return on ? v : "apres"; }
/* a QR order at a table that nobody has collected yet: big red « À régler » on the kitchen, the rail and the floor */
const cmDue = (o) => !!o && o.src === "qr" && o.mode === "table" && !o.paid && !o.settled && !["apayer", "annulee", "abandonnee"].includes(o.status);
/* the menu's sections: the 5 base kinds, renamed / reordered / completed by the gérant or by an import (cfg.secs [{id,t,k}]) */
const CM_LOOK0 = { style: "moderne", acc: "violet", photos: true, cover: "" };
const CM_ACCS = [["violet", "#5B2BFF", "Violet"], ["tomate", "#E5482A", "Tomate"], ["safran", "#E39A12", "Safran"], ["sauge", "#2F8F5B", "Sauge"], ["ocean", "#1F6FD1", "Océan"], ["encre", "#1B1530", "Encre"]];
const CM_STYLES = [["moderne", "Moderne", "Cartes avec photos, comme une appli"], ["bistrot", "Bistrot", "Une ardoise : nom, pointillés, prix"], ["elegant", "Élégant", "Sobre et centré, typographie fine"]];
function cmSecs() {
  const c = CM.cfgDoc || {}; const L = Array.isArray(c.secs) ? c.secs.filter((x) => x && x.id && x.t) : [];
  if (!L.length) return CM_CATS.map(([id, t]) => ({ id, t, k: id }));
  return L.map((x) => ({ id: String(x.id), t: String(x.t).slice(0, 40), k: CM_CATS.some((y) => y[0] === x.k) ? x.k : "plat" }));
}
function cmSecOf(n, S2) { const L = S2 || cmSecs(); if (n.carteSec && L.some((x) => x.id === n.carteSec)) return n.carteSec; const k = CM_CATS.some((x) => x[0] === n.carteCat) ? n.carteCat : "plat"; const b = L.find((x) => x.id === k) || L.find((x) => x.k === k); return b ? b.id : (L[0] || {}).id || "plat"; }
const cmCanOnline = () => DB.mode === "db" || DB.mode === "demo";
const cmMgr = () => { try { if (DB.mode === "demo") return true; if (typeof PERMS !== "undefined" && PERMS.isAdmin) return !!PERMS.isAdmin(); } catch (e) {} return myRole() === "gerant"; };
function cmBase() { const h = location.hostname; if (/growthgusto\.fr$|github\.io$/.test(h) || location.protocol === "file:") return "https://app.growthgusto.fr/commande/"; return new URL("commande/", location.href.split("?")[0].split("#")[0]).href; }
const cmUrl = (t) => cmBase() + "?r=" + encodeURIComponent(DB.mode === "demo" ? "demo" : S.rid || "") + (t ? "&t=" + encodeURIComponent(t) : "");
const cmEur = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const cmTablesN = () => { const c = cmCfg(); if (c.tables) return c.tables; try { const t = (typeof rsCfg === "function" ? rsCfg().tables : []) || []; const n = t.map((x) => parseInt(x.n, 10)).filter((x) => x > 0); if (n.length) return Math.min(99, Math.max(...n)); } catch (e) {} return 12; };

/* ───────── data ───────── */
function cmWatch() {
  if (!S.rid || CM.rid === S.rid) return; CM.rid = S.rid; CM.orders = null; CM.known = null; CM.cfgDoc = null; CM.cfgSeen = false; CM.link = null; CM.pub = null; CM.pubSeen = false; CM.fresh = new Set();
  const rid = S.rid;
  if (DB.mode === "demo") cmSeedDemo();
  DB.watch("clientOrders", { order: "at", dir: "desc", limit: 400 }, (rows) => { if (S.rid !== rid) return; cmOnRows(rows); });
  DB.watch("qrMenu", {}, (rows) => { if (S.rid !== rid) return; CM.cfgDoc = (rows.find((r) => r.id === "cfg") || null); CM.cfgSeen = true; cmSyncSoon(); try { if (typeof slStockSeen === "function") slStockSeen(); } catch (e) {} onData(); });
  DB.watch("qrPay", {}, (rows) => { if (S.rid !== rid) return; CM.link = rows.find((r) => r.id === "link") || null; cmSyncSoon(); onData(); });
  if (DB.mode === "db") DB.watch("public", {}, (rows) => { if (S.rid !== rid) return; CM.pub = rows.find((r) => r.id === "menu") || null; CM.pubSeen = true; cmSyncSoon(); });
}
function cmOnRows(rows) {
  const first = !CM.known; CM.orders = rows;
  if (first) CM.known = new Set(rows.map((r) => r.id + ":" + r.status));
  else rows.forEach((o) => { const k = o.id + ":" + o.status; if (CM.known.has(k)) return; CM.known.add(k); if (o.status === "nouvelle" && !o.seenAt) cmAlert(o); });
  onData();
}
const cmLiveSt = (o) => ["nouvelle", "prep", "prete"].includes(o.status);
function cmOrdersToday() { const k = dayKey(); return (CM.orders || []).filter((o) => o.src !== "salle").filter((o) => o.day === k || (cmLiveSt(o) && Date.now() - (o.at || 0) < 36 * 3600e3)); }
function cmAlert(o) {
  CM.fresh.add(o.id);
  if (!(typeof window.evLiveOn === "function" && window.evLiveOn())) try { SFX.init(); SFX.tone(1319, 0.28, "sine", 0.055); SFX.tone(1568, 0.3, "sine", 0.05, 0.16); SFX.tone(2093, 0.5, "sine", 0.04, 0.32); buzz([22, 50, 22, 50, 40]); } catch (e) {}
  const where = o.mode === "table" ? `Table ${o.table}` : `À emporter ${o.slot || ""}`.trim();
  if (S.route !== "commandes" || CM.tab !== "live") toast(`${o.mode === "table" ? "Nouvelle commande QR" : `Nouvelle commande n° ${o.n}`} · ${where} · ${cmEur(o.total)}`, "info");
  try { if (window.ALERTES && typeof window.ALERTES.push === "function") window.ALERTES.push({ type: "commande", key: "cmd_" + o.id, level: "info", text: o.mode === "table" ? `Nouvelle commande QR · Table ${o.table}` : `Nouvelle commande à emporter n° ${o.n}`, sub: `${where} · ${cmEur(o.total)}${o.paid ? " · payée" : ""}`, day: o.day, route: "commandes" }); } catch (e) {}
}
window.CMD = { unseen: () => (CM.orders || []).filter((o) => o.status === "nouvelle" && o.src !== "salle").length };

/* ───────── public projection (restos/{rid}/public/menu), written by any member's app ───────── */
const cmLogo = () => { const l = typeof restoLogo === "function" ? restoLogo(S.resto) : (S.resto && S.resto.logo) || ""; return typeof l === "string" && /^(data:image\/|https:\/\/)/.test(l) && l.length <= 200000 ? l : ""; };
function cmDishes() {
  const L = cmSecs(), ix = (n) => L.findIndex((x) => x.id === cmSecOf(n, L));
  return (S.notes || []).filter((n) => (typeof noteKind === "function" ? noteKind(n) === "Recettes" : n.cat === "Recettes") && n.carte)
    .sort((a, b) => ix(a) - ix(b) || (num(a.carteOrd) || 0) - (num(b.carteOrd) || 0) || String(a.title || "").localeCompare(String(b.title || ""), "fr"));
}
/* a recipe with its own ingredients computes its allergens; an imported or quick dish carries them itself (editable here) */
const cmOwnAl = (n) => !n || !(n.ingredients || []).some((g) => String(g.name || g.pid || "").trim());
const cmAllergens = (n) => { try { return typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || []; } catch (e) { return n.allergens || []; } };
const cmPhoto = (n) => { const p = typeof n.photo === "string" ? n.photo : ""; return /^https:\/\//.test(p) && p.length < 2000 ? p : /^data:image\//.test(p) && p.length <= 70000 ? p : ""; };
/* best sellers of the last 30 days (top 3, at least 3 sold) */
function cmPopular() { const since = Date.now() - 30 * 864e5, n = {}; (CM.orders || []).forEach((o) => { if (o.at < since || !["nouvelle", "prep", "prete", "servie"].includes(o.status)) return; (o.items || []).forEach((x) => { n[x.id] = (n[x.id] || 0) + (+x.q || 0); }); });
  return new Set(Object.entries(n).filter((x) => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0])); }
function cmPubDoc() {
  const c = cmCfg(), today = dayKey(), pop = cmPopular(), SECS = cmSecs();
  const items = cmDishes().filter((n) => num(n.price) > 0 && !c.hidden.includes(n.id)).map((n) => {
    const it = { id: n.id, t: String(n.title || "").slice(0, 80), p: Math.round(num(n.price) * 100) / 100, c: cmSecOf(n, SECS), al: cmAllergens(n) };
    const d = c.desc[n.id]; if (d) it.d = String(d).slice(0, 220); const ph = cmPhoto(n); if (ph) it.ph = ph; if (n.alCheck) it.alu = true;
    if (c.out[n.id] === today) it.out = true; if (c.veg.includes(n.id)) it.veg = true; if (pop.has(n.id)) it.pop = true; return it;
  });
  /* Firestore caps a document at 1 MB: drop the heaviest inline photos first */
  let size = JSON.stringify(items).length; items.slice().sort((a, b) => (b.ph || "").length - (a.ph || "").length).forEach((it) => { if (size > 700000 && it.ph && it.ph.startsWith("data:")) { size -= it.ph.length; delete it.ph; } });
  const rs = typeof rsCfg === "function" ? rsCfg() : {};
  return { v: 1, name: (S.resto && S.resto.name) || "", logo: cmLogo(), address: rs.address || "", phone: rs.phone || "", msg: c.msg || "",
    cfg: { on: !!c.on, table: !!c.table, calls: c.calls !== false, takeaway: !!c.takeaway, payOnline: !!(c.payOnline && CM.link && CM.link.charges), payPlace: c.payPlace !== false || !(CM.link && CM.link.charges), tablePay: cmTablePay(c), tips: c.tips !== false, prepMin: c.prepMin, tables: cmTablesN(), pickup: c.pickup },
    cats: SECS.map(({ id, t }) => ({ id, t })), items, day: today, look: cmLookPub(c.look),
    /* prix dynamiques (js/prix.js): happy hours and the plat du jour, discounts already capped by the margin floor */
    promos: (() => { try { return typeof pxPubPromos === "function" ? pxPubPromos(items) : []; } catch (e) { return []; } })(),
    review: (typeof rsGoogleUrl === "function" && rsGoogleUrl(rs.googleReview)) || "" };
}
const cmLookPub = (l) => ({ style: CM_STYLES.some((x) => x[0] === l.style) ? l.style : "moderne", acc: CM_ACCS.some((x) => x[0] === l.acc) ? l.acc : "violet", photos: l.photos !== false, cover: typeof l.cover === "string" && (/^https:\/\//.test(l.cover) && l.cover.length < 2000 || /^data:image\//.test(l.cover) && l.cover.length <= 170000) ? l.cover : "" });
const cmSig = (d) => { if (!d) return ""; const { updatedAt, ...x } = d; return JSON.stringify(x); };
function cmSyncSoon() { clearTimeout(CM.pubT); CM.pubT = setTimeout(cmSync, 400); }
function cmSync() {
  if (DB.mode !== "db" || !S.rid || !CM.cfgSeen || !CM.pubSeen || !CM.cfgDoc || !CM.cfgDoc.setupAt) return;
  const doc = cmPubDoc(); if (cmSig(doc) === cmSig(CM.pub)) return;
  CM.pub = { ...doc };
  DB.db.doc(`restos/${S.rid}/public/menu`).set(DB.clean({ ...doc, updatedAt: Date.now() })).catch((e) => console.warn("menu public", e && e.code));
}
/* the carte, the logo or the name changed while this screen is closed: keep the public menu right (cheap signature check) */
setInterval(() => { if (CM.rid && CM.rid === S.rid) cmSync(); }, 20000);
async function cmSaveCfg(patch) {
  const cur = CM.cfgDoc || {}; const next = { ...cur, ...patch, setupAt: cur.setupAt || Date.now() };
  CM.cfgDoc = next; onData(); cmSyncSoon();
  await safe(DB.set("qrMenu", "cfg", DB.clean(next)));
}

/* ───────── server ───────── */
async function cmCall(op, data) {
  if (DB.mode !== "db") throw Object.assign(new Error("local"), { code: "local" });
  if (!(window.firebase && firebase.functions)) await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  const r = await firebase.app().functions("europe-west9").httpsCallable("orderApi", { timeout: 30000 })({ op, rid: S.rid, ...(data || {}) }); return (r && r.data) || {};
}
const cmErr = (e) => { const m = String((e && e.message) || ""); return { stripe_off: "Le paiement en ligne n'est pas encore branché chez Growth Gusto. Il arrive très vite.", connect_off: "Le paiement en ligne n'est pas encore ouvert aux restaurants. Il arrive très vite.", gerant: "Seul le gérant peut relier le compte Stripe.", local: "Disponible avec un compte Growth Gusto." }[m] || (navigator.onLine === false ? "Pas de connexion internet." : "Ça n'a pas marché. Réessayez dans un instant."); };

/* ───────── view ───────── */
VIEWS.commandes = {
  render() {
    cmWatch();
    if (S.params && S.params.tab && CM.tabFrom !== S.params) { CM.tab = S.params.tab; CM.tabFrom = S.params; }
    const c = cmCfg(), live = cmOrdersToday().filter(cmLiveSt), mgr = cmMgr();
    const setup = !(CM.cfgDoc && CM.cfgDoc.setupAt);
    const right = `${c.on ? `<span class="cm-onp"><i></i>Ouvert</span>` : `<span class="cm-onp off"><i></i>Fermé</span>`}`;
    const tabs = [["live", "cmChef", "En cuisine", live.length], ["carte", "book", "La carte", 0], ["qr", "cmQr", "QR codes", 0], ["cfg", "sliders", "Réglages", 0]];
    let body = "";
    if (!cmCanOnline()) body = cmLocalCard();
    else if (setup && CM.cfgSeen && CM.tab === "live") body = cmWelcome();
    else body = CM.tab === "carte" ? cmCarte() : CM.tab === "qr" ? cmQrTab() : CM.tab === "cfg" ? cmCfgTab() : cmLive();
    return `<div class="inner wide cm${CM.tab === "live" ? " cm-k" : ""}">${topBar("Commandes en ligne", { right })}
      <div class="cm-tabs st" style="--i:1" role="tablist">${tabs.map(([k, i, t, n]) => `<button class="${CM.tab === k ? "on" : ""}" data-act="cmTab" data-v="${k}" role="tab" aria-selected="${CM.tab === k}">${ico(i)}<span>${t}</span>${n ? `<b class="mono">${n}</b>` : ""}</button>`).join("")}<i class="cm-tabi"></i></div>
      ${body}
    </div>`;
  },
  after(v) {
    const on = v.querySelector(".cm-tabs .on"), ind = v.querySelector(".cm-tabi");
    if (on && ind) { ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft}px)`; }
    clearInterval(CM.tick); CM.tick = setInterval(() => { if (S.route !== "commandes") { clearInterval(CM.tick); return; } $$(".cm-ago[data-at]").forEach((el) => { const a = +el.dataset.at; el.textContent = cmAgo(a); const m = (Date.now() - a) / 6e4; el.classList.toggle("late", m > +(el.dataset.late || 20)); }); }, 15000);
    if (CM.tab === "live") { $$(".cm-o.fresh", v).forEach((el) => setTimeout(() => el.classList.remove("fresh"), 2600)); setTimeout(() => CM.fresh.clear(), 2700); cmMarkSeen(); }
    const strip = v.querySelector(".cm-rail"); if (strip && window.matchMedia("(max-width:899px)").matches) { const col = strip.querySelector(`[data-col="${CM.col}"]`); if (col) strip.scrollLeft = col.offsetLeft - 14; }
    if (strip) strip.addEventListener("scroll", debounce(() => { const cols = $$("[data-col]", strip); let best = CM.col, bd = 1e9; cols.forEach((c) => { const d = Math.abs(c.offsetLeft - 14 - strip.scrollLeft); if (d < bd) { bd = d; best = c.dataset.col; } }); if (best !== CM.col) { CM.col = best; $$(".cm-colnav button").forEach((b) => b.classList.toggle("on", b.dataset.v === best)); } }, 80), { passive: true });
    if (DB.mode === "demo" && !CM.demoPing) { CM.demoPing = true; setTimeout(cmDemoPing, 9000); }
  },
};
function cmMarkSeen() { if (!CM.orders || DB.mode !== "db") return; CM.orders.filter((o) => o.status === "nouvelle" && !o.seenAt).slice(0, 20).forEach((o) => DB.update("clientOrders", o.id, { seenAt: Date.now() }).catch(() => {})); }
function cmAgo(at) { const m = Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4)); return m < 1 ? "à l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; }

function cmLocalCard() {
  return `<div class="glass cm-empty st" style="--i:3"><div class="cm-ill">${ico("cmQr")}</div><b class="h3">Vos clients commandent depuis leur table</b>
    <p class="sub">Le menu QR et la commande en ligne marchent avec un compte Growth Gusto : les commandes arrivent en cuisine sur tous vos appareils.</p>
    <button class="btn acc" data-act="auOpen">Créer mon compte</button></div>`;
}
/* first visit: the three steps, with what is already done */
function cmWelcome() {
  const d = cmDishes(), priced = d.filter((n) => num(n.price) > 0).length;
  const step = (i, done, t, s, act) => `<div class="cm-wstep st${done ? " ok" : ""}" style="--i:${4 + i}"><span class="cm-wn">${done ? ico("check") : i + 1}</span><div><b>${t}</b><em>${s}</em></div>${act || ""}</div>`;
  return `<div class="cm-welcome">
    <div class="cm-wall st" style="--i:2"><div class="cm-wall-tx"><span class="cm-kick">Menu QR · à table et à emporter</span><h2>Vos clients commandent et paient depuis leur table.</h2>
      <p>Ils scannent le QR code, choisissent, paient par carte ou Apple Pay. La commande arrive ici, en cuisine, avec un petit carillon.</p></div>
      <div class="cm-phone" aria-hidden="true"><div class="cm-ph-top">${restoMark(26)}<b>${esc((S.resto && S.resto.name) || "Votre restaurant")}</b></div>
        ${(d.slice(0, 3).length ? d.slice(0, 3) : [{ title: "Bœuf bourguignon", price: 22 }, { title: "Croquettes de jambon", price: 9 }, { title: "Mousse au chocolat", price: 7 }]).map((n, i) => `<div class="cm-ph-it" style="--i:${i}"><span><b>${esc(n.title || "")}</b><em class="mono">${cmEur(num(n.price))}</em></span><i>+</i></div>`).join("")}
        <div class="cm-ph-bar"><span>2</span>Voir la commande<b class="mono">31,00 €</b></div></div></div>
    <div class="glass cm-wsteps">
      ${step(0, priced > 0, "Votre carte", priced ? `${priced} plat${priced > 1 ? "s" : ""} avec un prix, repris de vos fiches recettes.` : "Ajoutez vos plats et boissons avec leur prix.", `<button class="btn soft sm" data-act="cmTab" data-v="carte">${priced ? "Vérifier" : "Ajouter"}</button>`)}
      ${step(1, !!(CM.link && CM.link.charges), "Le paiement en ligne", CM.link && CM.link.charges ? "Votre compte Stripe est relié." : "Facultatif : reliez Stripe pour que les clients paient en ligne. Sinon, ils paient sur place.", `<button class="btn soft sm" data-act="cmTab" data-v="cfg">Régler</button>`)}
      ${step(2, false, "Les QR codes", "Une carte à poser sur chaque table, avec votre logo. Prête à imprimer.", "")}
      <button class="btn acc block cm-wgo" data-act="cmStart" ${priced ? "" : "disabled"}>${ico("cmQr")}Ouvrir la commande en ligne</button>
      ${priced ? "" : `<p class="note" style="text-align:center;margin:0">Il faut au moins un plat avec un prix.</p>`}
    </div></div>`;
}

/* ── live ticket rail ── */
function cmLive() {
  const all = cmOrdersToday(), c = cmCfg();
  const cols = [["nouvelle", "Nouvelles", "cmBell"], ["prep", "En préparation", "cmChef"], ["prete", "Prêtes", "check"]];
  const by = (s) => all.filter((o) => o.status === s).sort((a, b) => (a.mode === "emporter" && b.mode === "emporter" ? String(a.slot).localeCompare(String(b.slot)) : 0) || (a.at || 0) - (b.at || 0));
  const done = all.filter((o) => ["servie", "annulee"].includes(o.status));
  const pay = all.filter((o) => o.status === "apayer");
  const ok = all.filter((o) => ["nouvelle", "prep", "prete", "servie"].includes(o.status));
  const ca = ok.reduce((a, o) => a + (+o.total || 0), 0), online = ok.filter((o) => o.paid).length;
  const head = `<div class="cm-stats st" style="--i:2">
    <div><em>Aujourd'hui</em><b class="mono">${ok.length}</b><span>commande${ok.length > 1 ? "s" : ""}</span></div>
    <div><em>Chiffre</em><b class="mono">${cmEur(ca)}</b><span>TTC</span></div>
    <div><em>Payées en ligne</em><b class="mono">${online}</b><span>sur ${ok.length}</span></div>
    ${pay.length ? `<div class="pay"><em>Paiement en cours</em><b class="mono">${pay.length}</b><span>pas encore en cuisine</span></div>` : ""}
    ${!c.on ? `<button class="cm-closed" data-act="cmOpenNow">${ico("cmOff")}<span><b>Commande en ligne fermée</b><em>Touchez pour ouvrir</em></span></button>` : ""}
    ${VIEWS.cuisine ? `<button class="cm-kds" data-go="cuisine">${ico("slHat")}<span><b>Écran cuisine</b><em>Salle et QR ensemble</em></span></button>` : ""}
  </div>`;
  const nLive = cols.reduce((a, [s]) => a + by(s).length, 0);
  const rail = nLive ? `<div class="cm-colnav st" style="--i:3">${cols.map(([s, t]) => `<button class="${CM.col === s ? "on" : ""}" data-act="cmCol" data-v="${s}">${t}<b class="mono">${by(s).length}</b></button>`).join("")}</div>
    <div class="cm-rail st" style="--i:3">${cols.map(([s, t, i]) => { const L = by(s); return `<section class="cm-col c-${s}" data-col="${s}"><header>${ico(i)}<b>${t}</b><span class="mono">${L.length}</span></header>
      <div class="cm-col-in">${L.map((o, k) => cmCard(o, k)).join("") || `<div class="cm-col-empty">${s === "nouvelle" ? "Rien de neuf" : s === "prep" ? "Rien sur le feu" : "Rien à servir"}</div>`}</div></section>`; }).join("")}</div>`
    : `<div class="glass cm-empty st" style="--i:3"><div class="cm-rail-ill" aria-hidden="true"><i></i><i></i><i></i></div><b class="h3">${c.on ? "Aucune commande en cours" : "La commande en ligne est fermée"}</b>
      <p class="sub">${c.on ? "Les nouvelles commandes arrivent ici avec un carillon. Gardez cet écran ouvert en cuisine." : "Ouvrez-la quand le service commence : vos clients pourront commander depuis les QR codes."}</p>
      <div class="cm-erow">${c.on ? `<a class="btn soft sm" href="${esc(cmUrl(DB.mode === "demo" ? "12" : ""))}" target="_blank" rel="noopener">${ico("cmEye")}Voir la page client</a>` : `<button class="btn acc sm" data-act="cmOpenNow">Ouvrir maintenant</button>`}</div></div>`;
  const doneL = done.length ? `<button class="cm-donet st" style="--i:4" data-act="cmDoneTog" aria-expanded="${CM.showDone}">${ico("check")}Terminées aujourd'hui<b class="mono">${done.length}</b>${ico("down", CM.showDone ? "rot" : "")}</button>
    ${CM.showDone ? `<div class="glass cm-done">${done.map((o) => `<div class="cm-dr${o.status === "annulee" ? " off" : ""}"><b class="mono">${o.mode === "table" ? "QR" : `n° ${o.n}`}</b><span>${o.mode === "table" ? `Table ${esc(o.table)}` : `À emporter${o.name ? ` · ${esc(o.name)}` : ""}`}</span><em>${(o.items || []).reduce((a, x) => a + x.q, 0)} art.</em><b class="mono">${cmEur(o.total)}</b><span class="pill ${o.status === "annulee" ? "bad" : o.paid ? "ok" : "neu"}">${o.status === "annulee" ? (o.refunded ? "Remboursée" : "Annulée") : o.paid ? "Payée en ligne" : "Sur place"}</span></div>`).join("")}</div>` : ""}` : "";
  return head + rail + doneL;
}
function cmCard(o, k) {
  const next = { nouvelle: ["prep", "Lancer", "cmChef"], prep: ["prete", "C'est prêt", "cmBell"], prete: ["servie", o.mode === "table" ? "Servie" : "Remise au client", "check"] }[o.status];
  const late = o.status === "nouvelle" ? 5 : o.status === "prep" ? 25 : 15;
  const at = o.status === "prep" ? o.prepAt || o.at : o.status === "prete" ? o.readyAt || o.at : o.at;
  const busy = CM.busy[o.id];
  return `<article class="cm-o${CM.fresh.has(o.id) ? " fresh" : ""} m-${o.mode}" style="--i:${Math.min(k, 8)}" data-id="${esc(o.id)}">
    <div class="cm-o-h">${o.mode === "table" ? "" : `<b class="cm-n mono">${o.n}</b>`}
      ${o.mode === "table" ? `<span class="cm-where t">${ico("rsTable")}Table <b>${esc(o.table)}</b></span>` : `<span class="cm-where e">${ico("cmBag")}${esc(o.slot || "")}</span>`}
      <span class="cm-ago mono${(Date.now() - at) / 6e4 > late ? " late" : ""}" data-at="${at}" data-late="${late}">${cmAgo(at)}</span></div>
    ${o.mode === "emporter" && o.name ? `<div class="cm-who">${esc(o.name)}${o.phone ? ` · <a href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}">${esc(o.phone)}</a>` : ""}</div>` : o.name ? `<div class="cm-who">${esc(o.name)}</div>` : ""}
    <ul class="cm-items">${(o.items || []).map((x) => `<li><b class="mono">${x.q}</b><span>${esc(x.name)}${x.note ? `<em>${esc(x.note)}</em>` : ""}</span></li>`).join("")}</ul>
    ${o.note ? `<div class="cm-onote">${ico("rsNote")}<span>${esc(o.note)}</span></div>` : ""}
    ${cmDue(o) ? cmDueBand(o) : ""}
    <div class="cm-o-f"><span class="cm-pay ${o.paid || o.settled ? "ok" : ""}">${o.paid ? `${ico("check")}Payée` : o.settled ? `${ico("check")}Réglée` : `${ico("cmCard")}À encaisser`}</span><b class="mono">${cmEur(o.total)}</b>
      <button class="cm-more" data-act="cmMenu" data-id="${esc(o.id)}" aria-label="Plus d'actions">${ico("dots")}</button></div>
    ${next ? `<button class="btn ${o.status === "prete" ? "" : "acc"} block cm-next" data-act="cmNext" data-id="${esc(o.id)}" data-v="${next[0]}" ${busy ? "disabled" : ""}>${ico(next[2])}${next[1]}</button>` : ""}
  </article>`;
}

/* the red band, shared with the kitchen screen (js/salle.js) and the floor: the waiter taps « Réglé » once the table has paid */
function cmDueBand(o, big) {
  return `<div class="cm-due${big ? " big" : ""}" role="status"><span class="cm-due-i">${ico("cmCard")}</span><span class="cm-due-t"><b>À régler</b><em>${big ? "" : `Table ${esc(o.table)} · `}${cmEur(o.total)} · non payée</em></span>
    <button class="cm-due-b" data-act="cmSettle" data-id="${esc(o.id)}" aria-label="Table ${esc(o.table)} réglée">${ico("check")}Réglé</button></div>`;
}

/* ── la carte ── */
function cmCarte() {
  const c = cmCfg(), D = cmDishes(), today = dayKey(), SECS = cmSecs();
  const groups = SECS.map((x) => [x.id, x.t, D.filter((n) => cmSecOf(n, SECS) === x.id)]).filter((g) => g[2].length);
  const online = D.filter((n) => num(n.price) > 0 && !c.hidden.includes(n.id)).length, noPrice = D.filter((n) => !(num(n.price) > 0)).length, toCheck = D.filter((n) => n.alCheck).length;
  const row = (n, i) => {
    const hid = c.hidden.includes(n.id), out = c.out[n.id] === today, np = !(num(n.price) > 0), ph = cmPhoto(n) || n.photo, al = cmAllergens(n);
    return `<div class="cm-dish st${hid || np ? " hid" : ""}${out ? " out" : ""}" style="--i:${Math.min(i, 14)}">
      <button class="cm-dthumb" data-act="cmDish" data-id="${esc(n.id)}" aria-label="Modifier ${esc(n.title)}">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${esc(initials(n.title || "?"))}</span>`}</button>
      <button class="cm-dtx" data-act="cmDish" data-id="${esc(n.id)}"><b>${esc(n.title || "Sans nom")}</b>
        <em>${np ? `<span class="cm-warnt">Sans prix : pas affiché</span>` : `<span class="mono">${cmEur(num(n.price))}</span>`}${c.veg.includes(n.id) ? `<span class="cm-veg">${ico("cmLeaf")}Végé</span>` : ""}${n.alCheck ? `<span class="cm-alchk">${ico("alert")}Allergènes à vérifier</span>` : al.length ? `<span class="cm-al">${al.length} allergène${al.length > 1 ? "s" : ""}</span>` : ""}</em>
        ${c.desc[n.id] ? `<i>${esc(c.desc[n.id])}</i>` : `<i class="none">Ajoutez une description pour donner envie</i>`}</button>
      <div class="cm-dact">
        <button class="cm-chipb${out ? " on" : ""}" data-act="cmOut" data-id="${esc(n.id)}" ${np || hid ? "disabled" : ""} aria-pressed="${out}">${out ? "Épuisé" : "Dispo"}</button>
        <button class="cm-sw${!hid && !np ? " on" : ""}" data-act="cmHide" data-id="${esc(n.id)}" ${np ? "disabled" : ""} aria-pressed="${!hid}" aria-label="Afficher en ligne"><i></i></button>
      </div></div>`;
  };
  let k = 0;
  const L = c.look, acc = (CM_ACCS.find((x) => x[0] === L.acc) || CM_ACCS[0])[1];
  return `<div class="cm-carte">
    <div class="cm-chead st" style="--i:2"><div><b class="h3">${online} article${online > 1 ? "s" : ""} en ligne</b><p class="sub">Vos plats viennent des fiches de <b>Recettes & allergènes</b> cochées « à la carte ».${noPrice ? ` ${noPrice} sans prix.` : ""}</p></div>
      <div class="cm-chb"><button class="btn acc sm" data-act="ciOpen">${ico("cmSpark")}Importer ma carte</button><button class="btn soft sm" data-act="cmAdd">${ico("plus")}Ajouter</button><a class="btn soft sm" href="${esc(cmUrl(DB.mode === "demo" ? "12" : "") + cmLookQ())}" target="_blank" rel="noopener">${ico("cmEye")}Aperçu client</a></div></div>
    <div class="cm-tools st" style="--i:3">
      <button class="cm-tool" data-act="cmLook"><span class="cm-tsw" style="--a:${acc}"><i></i><i></i><i></i></span><span><b>Apparence</b><em>${esc((CM_STYLES.find((x) => x[0] === L.style) || CM_STYLES[0])[1])} · ${esc((CM_ACCS.find((x) => x[0] === L.acc) || CM_ACCS[0])[2])}${L.cover ? " · couverture" : ""}</em></span>${ico("chev")}</button>
      <button class="cm-tool" data-act="cmSecsOpen"><span class="cm-tic">${ico("list")}</span><span><b>Rubriques</b><em>${groups.length} sur la carte · renommer, ordre</em></span>${ico("chev")}</button>
      <button class="cm-tool" data-act="cmPrintMenu" ${D.length ? "" : "disabled"}><span class="cm-tic">${ico("cmPrintI")}</span><span><b>Imprimer la carte</b><em>Votre carte mise en page, format A4</em></span>${ico("chev")}</button>
    </div>
    ${toCheck ? `<button class="cm-chkbar st" style="--i:4" data-act="cmAlNext">${ico("alert")}<span><b>${toCheck} plat${toCheck > 1 ? "s" : ""} à vérifier</b><em>Les allergènes ont été devinés à l'import. Vos clients voient « demandez au personnel » tant que vous ne les avez pas confirmés.</em></span><b class="cm-chkgo">Vérifier</b></button>` : ""}
    ${groups.length ? groups.map(([key, t, L2]) => `<div class="lbl st cm-glbl" style="--i:${4 + k++}">${esc(t)}<span>${L2.length}</span></div><div class="glass cm-dlist">${L2.map((n) => row(n, k++)).join("")}</div>`).join("")
      : `<div class="glass cm-empty cm-impty st" style="--i:4"><div class="cm-ill">${ico("book")}</div><b class="h3">Votre carte en une minute</b><p class="sub">Donnez-nous votre carte en PDF, en photo, ou l'adresse de votre site : on lit tout, vous vérifiez, c'est en ligne.</p>
        <div class="cm-impo"><button class="cm-imp" data-act="ciOpen" data-v="file">${ico("cmDoc")}<b>PDF ou photo</b><em>Votre carte actuelle</em></button><button class="cm-imp" data-act="ciOpen" data-v="site">${ico("cmGlobe")}<b>Votre site</b><em>On récupère tout</em></button><button class="cm-imp" data-act="cmAdd">${ico("edit")}<b>À la main</b><em>Plat par plat</em></button></div></div>`}
    <p class="note cm-cnote">« Épuisé » ne vaut que pour aujourd'hui : demain, le plat revient tout seul.</p>
  </div>`;
}
/* the look in the preview link (the public page applies it at once, before the menu is synced) */
const cmLookQ = () => { const l = cmCfg().look; return `&look=${encodeURIComponent(l.style)}&acc=${encodeURIComponent(l.acc)}${l.photos === false ? "&ph=0" : ""}`; };

/* ── QR codes ── */
function cmQrTab() {
  const n = cmTablesN(), c = cmCfg();
  return `<div class="cm-qrw">
    <div class="glass cm-qrprev st" style="--i:2">
      <div class="cm-tent">${cmTentHtml("7", true)}</div>
      <div class="cm-qrtx"><b class="h3">Une carte par table</b><p class="sub">Chaque QR code connaît le numéro de sa table : la commande arrive en cuisine avec le bon numéro, sans rien demander au client.</p>
        <div class="cm-tn"><span>Nombre de tables</span><div class="cm-step"><button data-act="cmTables" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${n}</b><button data-act="cmTables" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>
        <button class="btn acc block" data-act="cmPrintTables">${ico("printer")}Imprimer les ${n} cartes (A4)</button>
        <p class="note">Six cartes par page, à découper. Plastifiez-les ou glissez-les dans un chevalet.</p></div></div>
    <div class="cm-qr2">
      <div class="glass cm-qrc st" style="--i:3"><div class="cm-qrs">${typeof qrSvg === "function" ? qrSvg(cmUrl("e")) : ""}</div><div><b>À emporter</b><p class="sub">Pour la vitrine, le comptoir ou Instagram : on commande, on choisit l'heure, on passe prendre.</p>
        <div class="cm-lb"><button class="btn soft sm" data-act="cmPrintTake">${ico("printer")}Affiche</button><button class="btn soft sm" data-act="cmCopy" data-v="e">${ico("rsCopy")}Copier le lien</button></div></div></div>
      <div class="glass cm-qrc st" style="--i:4"><div class="cm-qrs">${typeof qrSvg === "function" ? qrSvg(cmUrl("")) : ""}</div><div><b>Lien de la carte</b><p class="sub">Le client choisit « à table » ou « à emporter ». À mettre sur votre site, Google ou Instagram.</p>
        <div class="cm-lb"><button class="btn soft sm" data-act="cmCopy" data-v="">${ico("rsCopy")}Copier</button><a class="btn soft sm" href="${esc(cmUrl(""))}" target="_blank" rel="noopener">${ico("cmEye")}Voir</a></div></div></div>
    </div>
    ${!c.on ? `<p class="note cm-cnote">La commande est fermée : un client qui scanne voit la carte, sans pouvoir commander.</p>` : ""}
  </div>`;
}
function cmTentHtml(t, preview) {
  const name = (S.resto && S.resto.name) || "Restaurant", lg = cmLogo(), url = cmUrl(t);
  return `<div class="cm-card${preview ? " pv" : ""}"><div class="cm-card-h">${lg ? `<img src="${esc(lg)}" alt="">` : `<span>${esc(initials(name))}</span>`}<b>${esc(name)}</b></div>
    <div class="cm-card-t">${t === "e" ? "À emporter" : `Table <b>${esc(t)}</b>`}</div>
    <div class="cm-card-q">${typeof qrSvg === "function" ? qrSvg(url) : ""}</div>
    <div class="cm-card-c"><b>Scannez pour commander</b><span>La carte, les allergènes, le paiement : tout est là.</span></div></div>`;
}
function cmPrint(title, cards, poster) {
  const name = (S.resto && S.resto.name) || "", lg = cmLogo();
  const css = `@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:"Instrument Sans",system-ui,sans-serif;color:#1B1530;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.g>div{break-inside:avoid}
  .c{height:90mm;border:1.4px dashed #CDBFAA;border-radius:6mm;padding:6mm 7mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;background:#FBF6EC;position:relative;overflow:hidden}
  .c::before{content:"";position:absolute;left:0;right:0;top:0;height:21mm;background-color:#4C1FEA;background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px);background-size:3mm 3mm}
  .h{position:relative;display:flex;align-items:center;gap:3mm;color:#fff;font:780 13pt/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;max-width:100%}
  .h img,.h span{width:10mm;height:10mm;border-radius:3mm;background:#fff;object-fit:contain;padding:.6mm;flex:none;display:grid;place-items:center;color:#5B2BFF;font-size:10pt}
  .h b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .t{margin-top:4mm;font:700 11pt "Instrument Sans";color:#4A4560}.t b{font:800 22pt/1 "Bricolage Grotesque";color:#1B1530;margin-left:1mm}
  .q{width:38mm;height:38mm;padding:2mm;background:#fff;border-radius:3mm;border:1px solid #E9DFCD}
  .s{font:780 12pt "Bricolage Grotesque";letter-spacing:-.01em}.s span{display:block;font:500 7.5pt "Instrument Sans";color:#615B74;margin-top:1mm}
  .p{height:275mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9mm;text-align:center;background:#FBF6EC;border-radius:8mm}
  .p .lg{width:30mm;height:30mm;border-radius:9mm;background:#fff;object-fit:contain;padding:2mm;box-shadow:0 2mm 0 #E2D6C2}
  .p .k{font:700 16pt "Instrument Sans";color:#5B2BFF}.p .n{font:800 40pt/1 "Bricolage Grotesque";letter-spacing:-.03em}
  .p .q{width:95mm;height:95mm;padding:5mm;border-radius:9mm;border:2px solid #E9DFCD}.p .tt{font:780 24pt/1.1 "Bricolage Grotesque";letter-spacing:-.02em}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,600..800&family=Instrument+Sans:wght@500;600;700&display=swap"><style>${css}</style></head><body>
    ${poster ? `<div class="p">${lg ? `<img class="lg" src="${esc(lg)}" alt="">` : ""}<div class="k">Commandez en ligne</div><div class="n">${esc(name)}</div><div class="q">${qrSvg(cmUrl("e"))}</div><div class="tt">Scannez, choisissez l'heure,<br>passez prendre.</div></div>`
      : `<div class="g">${cards.map((t) => `<div class="c"><div class="h">${lg ? `<img src="${esc(lg)}" alt="">` : `<span>${esc(initials(name))}</span>`}<b>${esc(name)}</b></div><div class="t">${t === "e" ? "<b>À emporter</b>" : `Table<b>${esc(t)}</b>`}</div><div class="q">${qrSvg(cmUrl(t))}</div><div class="s">Scannez pour commander<span>La carte, les allergènes et le paiement en ligne</span></div></div>`).join("")}</div>`}
  </body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  const go2 = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); };
  try { (d.fonts && d.fonts.ready ? Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve()).then(() => setTimeout(go2, 200)); } catch (e) { setTimeout(go2, 600); }
}

/* ── réglages ── */
function cmCfgTab() {
  const c = cmCfg(), l = CM.link, mgr = cmMgr(), P = c.pickup;
  const tog = (act, on, t, s, dis) => `<button class="cm-tog${on ? " on" : ""}" data-act="${act}" aria-pressed="${on}" ${dis ? "disabled" : ""}><span class="cm-tt"><b>${t}</b><em>${s}</em></span><span class="cm-sw${on ? " on" : ""}"><i></i></span></button>`;
  const pay = !l || !l.acct ? `<div class="cm-stripe"><div class="cm-sl">${ico("cmCard")}</div><div><b>Paiement en ligne</b><em>Reliez votre compte Stripe : l'argent arrive directement sur votre compte, sans intermédiaire. Carte, Apple Pay, Google Pay.</em></div></div>
      <ul class="cm-sbul"><li>${ico("check")}Aucun abonnement Stripe : environ 1,5 % + 0,25 € par paiement (tarif Stripe).</li><li>${ico("check")}Virement automatique sur votre compte bancaire.</li><li>${ico("check")}Vous pouvez aussi garder le paiement sur place.</li></ul>
      ${mgr ? `<button class="btn acc block" data-act="cmConnect" ${CM.busy.connect ? "disabled" : ""}>${CM.busy.connect ? "Un instant…" : `${ico("cmStripe")}Relier mon compte Stripe`}</button>` : `<p class="note">Le gérant peut relier le compte Stripe.</p>`}`
    : l.charges ? `<div class="cm-stripe ok"><div class="cm-sl">${ico("check")}</div><div><b>Stripe relié${l.name ? ` · ${esc(l.name)}` : ""}</b><em>Les paiements arrivent sur votre compte Stripe.${l.live === false ? " Mode test." : ""}</em></div></div>
      ${c.takeaway ? `<div class="cm-sub">${ico("cmBag")}À emporter</div>
      ${tog("cmPayOnline", c.payOnline, "Proposer « payer maintenant »", "Carte, Apple Pay ou Google Pay au moment de commander.")}
      ${tog("cmPayPlace", c.payPlace !== false || !c.payOnline, "Proposer « payer au retrait »", "Le client paie en venant chercher sa commande.", !c.payOnline)}` : ""}`
    : `<div class="cm-stripe wait"><div class="cm-sl">${ico("clock")}</div><div><b>Inscription Stripe à terminer</b><em>${l.details ? "Stripe vérifie vos informations. Ça prend en général quelques minutes." : "Il manque quelques informations (identité, IBAN) pour recevoir les paiements."}</em></div></div>
      ${mgr ? `<div class="cm-erow"><button class="btn acc sm" data-act="cmConnect">${l.details ? "Voir chez Stripe" : "Terminer chez Stripe"}</button><button class="btn soft sm" data-act="cmCheck">Actualiser</button></div>` : ""}`;
  return `<div class="cm-cfg">
    <div class="glass cm-blk st" style="--i:2"><div class="lbl">Commande en ligne</div>
      ${tog("cmOnTog", c.on, c.on ? "Ouverte" : "Fermée", c.on ? "Vos clients peuvent commander maintenant." : "Les clients voient la carte, sans pouvoir commander.")}
      ${tog("cmTableTog", c.table, "À table", "Le QR code de chaque table envoie la commande avec le bon numéro.")}
      ${tog("cmTakeTog", c.takeaway, "À emporter", "Le client choisit son heure de retrait.")}
    </div>
    ${c.takeaway ? `<div class="glass cm-blk st" style="--i:3"><div class="lbl">À emporter</div>
      <div class="cm-f"><span>Temps de préparation</span><div class="cm-chips">${[10, 15, 20, 30, 45].map((m) => `<button class="chip${c.prepMin === m ? " on" : ""}" data-act="cmPrep" data-v="${m}">${m} min</button>`).join("")}</div></div>
      <div class="cm-f"><span>Jours</span><div class="cm-days">${CM_DAYS.map(([d, t]) => `<button class="${P.days.includes(d) ? "on" : ""}" data-act="cmDay" data-v="${d}" aria-pressed="${P.days.includes(d)}">${t}</button>`).join("")}</div></div>
      <div class="cm-f"><span>Heures de retrait</span>${P.windows.map((w, i) => `<div class="cm-win"><em>${i === 0 ? "Midi" : "Soir"}</em><input class="input mono" type="time" step="900" value="${esc(w.from)}" data-act="cmWin" data-i="${i}" data-k="from" aria-label="Début"><span>à</span><input class="input mono" type="time" step="900" value="${esc(w.to)}" data-act="cmWin" data-i="${i}" data-k="to" aria-label="Fin">${P.windows.length > 1 ? `<button class="iconbtn sm" data-act="cmWinDel" data-i="${i}" aria-label="Retirer">${ico("x")}</button>` : ""}</div>`).join("")}
        ${P.windows.length < 2 ? `<button class="btn ghost sm" data-act="cmWinAdd">${ico("plus")}Ajouter un service</button>` : ""}</div>
    </div>` : ""}
    <div class="glass cm-blk st" style="--i:4"><div class="lbl">Paiement</div>${pay}</div>
    ${c.table ? cmTablePayBlk(c) : ""}
    <div class="glass cm-blk st" style="--i:5"><div class="lbl">Message sur la carte</div>
      <input class="input" id="cmMsg" maxlength="140" value="${esc(c.msg || "")}" placeholder="Produits frais du marché, cuisinés sur place.">
      <p class="note">Une phrase affichée en haut de la carte. Le logo vient de Réglages › Logo.</p></div>
  </div>`;
}

/* « Paiement à table » : three big choices; the two online ones need the Stripe account */
function cmTablePayBlk(c) {
  const on = !!(CM.link && CM.link.charges) || DB.mode === "demo", cur = cmTablePay(c);
  return `<div class="glass cm-blk st" style="--i:5"><div class="lbl">Paiement des commandes à table</div>
    <div class="cm-tpay" role="radiogroup" aria-label="Paiement des commandes à table">${CM_TPAY.map(([k, t, d]) => { const dis = k !== "apres" && !on; return `<button class="cm-tp${cur === k ? " on" : ""}" role="radio" aria-checked="${cur === k}" data-act="cmTablePay" data-v="${k}" ${dis ? "disabled" : ""}>
      <span class="cm-tp-r"></span><span class="cm-tp-x"><b>${t}</b><em>${dis ? "Reliez d'abord votre compte Stripe, juste au-dessus." : d}</em></span></button>`; }).join("")}</div>
    <p class="note">${cur === "avant" ? "La commande n'arrive en cuisine qu'une fois payée." : "Tant qu'une commande QR n'est pas payée, la cuisine et la salle voient un gros « À régler » rouge sur la table. Le serveur touche « Réglé » quand il a encaissé."}</p></div>`;
}

/* ───────── dish sheet (edit the online bits, or create a dish) ───────── */
function cmDishOpen(n) {
  const c = cmCfg();
  CM.ed = n ? { id: n.id, title: n.title || "", price: n.price ?? "", sec: cmSecOf(n), desc: c.desc[n.id] || "", veg: c.veg.includes(n.id), al: [...(n.allergens || [])], photo: n.photo || "", photoId: n.photoId || "", own: cmOwnAl(n), alCheck: !!n.alCheck, isNew: false }
    : { id: null, title: "", price: "", sec: cmSecOf({ carteCat: "plat" }), desc: "", veg: false, al: [], photo: "", photoId: "", own: true, alCheck: false, isNew: true };
  cmDishPaint();
}
function cmDishPaint() {
  const e = CM.ed; if (!e) return; const n = e.id && S.notes.find((x) => x.id === e.id); const fromRec = n ? cmAllergens(n) : [];
  const SECS = cmSecs();
  openSheet(`<div class="cm-ed"><div class="cm-edh"><span class="h2">${e.isNew ? "Nouvel article" : "Sur la carte en ligne"}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="cm-edph${e.photo ? " has" : ""}">${e.photo ? `<img src="${esc(e.photo)}" alt="" referrerpolicy="no-referrer">` : `<span>${ico("image")}<b>Une photo donne envie</b><em>Prise au téléphone, c'est parfait.</em></span>`}
      ${e.busy ? `<div class="cm-edphl"><i></i></div>` : ""}
      <div class="cm-edphb"><label class="btn soft sm">${ico("camera")}${e.photo ? "Changer" : "Ajouter une photo"}<input type="file" accept="image/*" data-cm-photo="1" hidden></label>${e.photo ? `<button class="btn soft sm" data-act="cmEdPhDel" aria-label="Retirer la photo">${ico("trash")}</button>` : ""}</div></div>
    <label class="field"><span class="lbl">Nom</span><input class="input" id="cmEdT" maxlength="80" value="${esc(e.title)}" placeholder="Bœuf bourguignon"></label>
    <label class="field"><span class="lbl">Prix TTC</span><div class="cm-eur"><input class="input mono" id="cmEdP" inputmode="decimal" value="${esc(e.price)}" placeholder="12,50"><span>€</span></div></label>
    <div class="field"><span class="lbl">Rubrique</span><div class="cm-chips">${SECS.map((x) => `<button class="chip${e.sec === x.id ? " on" : ""}" data-act="cmEdCat" data-v="${esc(x.id)}">${esc(x.t)}</button>`).join("")}<button class="chip cm-chipadd" data-act="cmSecsOpen">${ico("plus")}Rubrique</button></div></div>
    <label class="field"><span class="lbl">Description pour les clients</span><textarea class="input" id="cmEdD" maxlength="220" rows="2" placeholder="Mijoté sept heures, carottes fondantes, purée maison.">${esc(e.desc)}</textarea></label>
    <button class="cm-tog${e.veg ? " on" : ""}" data-act="cmEdVeg" aria-pressed="${e.veg}"><span class="cm-tt"><b>Végétarien</b><em>Une petite feuille verte sur la carte.</em></span><span class="cm-sw${e.veg ? " on" : ""}"><i></i></span></button>
    ${e.own ? `<div class="field"><span class="lbl">Allergènes${e.alCheck ? ` <span class="cm-alchk">à vérifier</span>` : ""}</span>${e.alCheck ? `<p class="note cm-alnote">Devinés d'après le nom et la description. Corrigez si besoin puis enregistrez : vos clients les verront.</p>` : ""}<div class="cm-als">${ALLERGENS.map((a) => `<button class="chip${e.al.includes(a.id) ? " on" : ""}" data-act="cmEdAl" data-v="${a.id}">${esc(a.t)}</button>`).join("")}</div></div>`
      : `<div class="cm-alinfo">${ico("alert")}<span>${fromRec.length ? `Allergènes repris de la fiche : <b>${esc(fromRec.map((x) => (allergenOf(x) || { t: x }).t).join(", "))}</b>.` : "Aucun allergène sur la fiche."} <button class="cm-lnk" data-act="cmEdFiche">Ouvrir la fiche</button></span></div>`}
    <button class="btn acc block" data-act="cmEdSave">${e.isNew ? "Ajouter à la carte" : e.alCheck && e.own ? "Enregistrer, allergènes vérifiés" : "Enregistrer"}</button>
    ${e.isNew ? "" : `<button class="btn ghost block cm-edrm" data-act="cmEdOff">${ico("cmOff")}Retirer de la carte</button>`}
  </div>`);
}
/* a dish photo: the app's own uploader (Storage), else a small inline copy that fits the public menu */
async function cmPhotoOf(file, max = 70000) {
  let url = "", id = "";
  try { if (typeof notePhotoUrl === "function" && DB.mode === "db") { const r = await notePhotoUrl(file); url = r.url; id = r.id; } } catch (e) {}
  if (/^https:\/\//.test(url)) return { url, id };
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
  for (const [px, q] of [[640, 0.78], [520, 0.72], [420, 0.66], [340, 0.6], [260, 0.55]]) {
    const k = Math.min(1, px / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); const d = c.toDataURL("image/jpeg", q); if (d.length <= max) return { url: d, id: "" };
  }
  throw new Error("photo");
}
document.addEventListener("change", async (ev) => {
  const inp = ev.target; if (!inp || !inp.dataset) return;
  if (inp.dataset.cmPhoto && CM.ed) { const f = inp.files && inp.files[0]; if (!f) return; CM.ed.busy = true; CM.ed.title = cmVal("cmEdT"); CM.ed.price = cmVal("cmEdP"); CM.ed.desc = cmVal("cmEdD"); cmDishPaint();
    try { const r = await cmPhotoOf(f); CM.ed.photo = r.url; CM.ed.photoId = r.id; SFX.ok(); } catch (e) { SFX.err(); toast("Photo illisible. Essayez une autre image.", "err"); } CM.ed.busy = false; if (CM.ed) cmDishPaint(); }
  if (inp.dataset.cmCover) { const f = inp.files && inp.files[0]; if (!f) return; toast("Photo de couverture…");
    try { const r = await cmPhotoOf(f, 160000); await cmSaveCfg({ look: { ...cmCfg().look, cover: r.url } }); SFX.ok(); cmLookPaint(); } catch (e) { SFX.err(); toast("Photo illisible. Essayez une autre image.", "err"); } }
});

/* ── apparence: style, colour, photos, cover; live preview of the client page ── */
function cmLookPaint() {
  const l = cmCfg().look; const src = cmUrl(DB.mode === "demo" ? "12" : "") + cmLookQ() + "&pv=1";
  const html = `<div class="cm-ed cm-look"><div class="cm-edh"><span class="h2">Apparence de la carte</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="cm-lookg"><div class="cm-lookc">
      <span class="lbl">Style</span><div class="cm-styles">${CM_STYLES.map(([k, t, d]) => `<button class="cm-sty${l.style === k ? " on" : ""}" data-act="cmLookSet" data-k="style" data-v="${k}" aria-pressed="${l.style === k}"><span class="cm-stymini ${k}"><i></i><i></i><i></i></span><b>${t}</b><em>${d}</em></button>`).join("")}</div>
      <span class="lbl">Couleur</span><div class="cm-accs">${CM_ACCS.map(([k, hex, t]) => `<button class="cm-acc${l.acc === k ? " on" : ""}" style="--a:${hex}" data-act="cmLookSet" data-k="acc" data-v="${k}" aria-label="${t}" aria-pressed="${l.acc === k}" title="${t}"><i></i></button>`).join("")}</div>
      <span class="lbl">Couverture</span><div class="cm-cover${l.cover ? " has" : ""}">${l.cover ? `<img src="${esc(l.cover)}" alt="" referrerpolicy="no-referrer">` : `<span>Une photo de votre salle ou de vos plats, en haut de la carte.</span>`}
        <div class="cm-edphb"><label class="btn soft sm">${ico("camera")}${l.cover ? "Changer" : "Ajouter"}<input type="file" accept="image/*" data-cm-cover="1" hidden></label>${l.cover ? `<button class="btn soft sm" data-act="cmLookSet" data-k="cover" data-v="" aria-label="Retirer la couverture">${ico("trash")}</button>` : ""}</div></div>
      <button class="cm-tog${l.photos ? " on" : ""}" data-act="cmLookSet" data-k="photos" data-v="${l.photos ? "0" : "1"}" aria-pressed="${l.photos}"><span class="cm-tt"><b>Photos des plats</b><em>Sans photos, la carte est plus compacte.</em></span><span class="cm-sw${l.photos ? " on" : ""}"><i></i></span></button>
      ${DB.mode === "db" ? `<p class="note">Les changements sont en ligne tout de suite.</p>` : ""}
    </div>
    <div class="cm-lookp"><div class="cm-lookph"><iframe id="cmLookFr" title="Aperçu de la carte" src="${esc(src)}" loading="lazy"></iframe></div><a class="cm-lnk" href="${esc(src.replace("&pv=1", ""))}" target="_blank" rel="noopener">${ico("cmEye")}Ouvrir en grand</a></div></div></div>`;
  openSheet(html);
}
/* the look changed while the sheet is open: buttons in place, the preview restyles itself (no reload) */
function cmLookLive() {
  const l = cmCfg().look; if (!document.querySelector(".cm-look")) return;
  $$(".cm-look [data-act=cmLookSet]").forEach((b) => { const k = b.dataset.k; if (k === "style" || k === "acc") { const on = l[k] === b.dataset.v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); } if (k === "photos") { b.classList.toggle("on", l.photos); b.dataset.v = l.photos ? "0" : "1"; b.setAttribute("aria-pressed", l.photos); const sw = b.querySelector(".cm-sw"); if (sw) sw.classList.toggle("on", l.photos); } });
  const fr = document.getElementById("cmLookFr"); try { fr && fr.contentWindow.postMessage({ ggLook: { style: l.style, acc: l.acc, photos: l.photos, cover: l.cover } }, "*"); } catch (e) {}
}

/* ── rubriques: rename, reorder, add, remove (empty ones) ── */
function cmSecsPaint() {
  const L = cmSecs(), D = cmDishes(), cnt = (id) => D.filter((n) => cmSecOf(n, L) === id).length;
  openSheet(`<div class="cm-ed"><div class="cm-edh"><span class="h2">Rubriques de la carte</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">L'ordre ici est celui de votre carte. Le type sert au tableau des allergènes et aux marges.</p>
    <div class="cm-secl">${L.map((x, i) => `<div class="cm-secr" data-id="${esc(x.id)}"><div class="cm-secm"><button class="iconbtn sm" data-act="cmSecMv" data-id="${esc(x.id)}" data-v="-1" ${i ? "" : "disabled"} aria-label="Monter">${ico("up")}</button><button class="iconbtn sm" data-act="cmSecMv" data-id="${esc(x.id)}" data-v="1" ${i < L.length - 1 ? "" : "disabled"} aria-label="Descendre">${ico("down")}</button></div>
      <input class="input cm-secin" data-sec="${esc(x.id)}" maxlength="40" value="${esc(x.t)}" aria-label="Nom de la rubrique">
      <select class="input cm-seck" data-seck="${esc(x.id)}" aria-label="Type">${CM_CATS.map(([k, t]) => `<option value="${k}"${x.k === k ? " selected" : ""}>${t}</option>`).join("")}</select>
      <span class="cm-secn mono">${cnt(x.id)}</span>
      <button class="iconbtn sm" data-act="cmSecDel" data-id="${esc(x.id)}" ${cnt(x.id) || L.length <= 1 ? "disabled" : ""} aria-label="Supprimer">${ico("trash")}</button></div>`).join("")}</div>
    <div class="cm-secadd"><input class="input" id="cmSecNew" maxlength="40" placeholder="Nouvelle rubrique : Pizzas, Nos vins…"><button class="btn acc" data-act="cmSecAdd">${ico("plus")}Ajouter</button></div>
  </div>`);
}
async function cmSecsSave(L) { await cmSaveCfg({ secs: L.map(({ id, t, k }) => ({ id, t: String(t).slice(0, 40), k })) }); }

/* ── printed menu: the carte laid out on A4, in the chosen style and colour ── */
function cmPrintMenu() {
  const c = cmCfg(), l = c.look, SECS = cmSecs(), D = cmDishes().filter((n) => num(n.price) > 0 && !c.hidden.includes(n.id));
  const acc = (CM_ACCS.find((x) => x[0] === l.acc) || CM_ACCS[0])[1], name = (S.resto && S.resto.name) || "", lg = cmLogo();
  const serif = l.style !== "moderne";
  const css = `@page{size:A4;margin:14mm 16mm}*{box-sizing:border-box}body{margin:0;color:#1B1530;font-family:${serif ? `"Fraunces",Georgia,serif` : `"Instrument Sans",system-ui,sans-serif`};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    header{text-align:center;padding:4mm 0 8mm;border-bottom:${l.style === "elegant" ? "0.4mm solid " + acc : "1.2mm solid " + acc};margin-bottom:6mm}
    header img{width:22mm;height:22mm;object-fit:contain;margin-bottom:3mm}
    h1{margin:0;font:${l.style === "elegant" ? "italic 400 30pt" : "800 32pt"}/1 ${serif ? `"Fraunces",Georgia,serif` : `"Bricolage Grotesque",sans-serif`};letter-spacing:-.02em}
    header p{margin:2mm 0 0;font:500 9.5pt "Instrument Sans",sans-serif;color:#615B74;letter-spacing:.08em;text-transform:uppercase}
    .cols{columns:${D.length > 14 ? 2 : 1};column-gap:12mm}
    section{break-inside:avoid;margin:0 0 7mm}
    h2{margin:0 0 3mm;font:${l.style === "elegant" ? "500 11pt" : "800 15pt"} ${l.style === "elegant" ? `"Instrument Sans",sans-serif` : serif ? `"Fraunces",Georgia,serif` : `"Bricolage Grotesque",sans-serif`};color:${acc};${l.style === "elegant" ? "letter-spacing:.22em;text-transform:uppercase;text-align:center" : "letter-spacing:-.01em"}}
    .it{margin:0 0 3.2mm;break-inside:avoid${l.style === "elegant" ? ";text-align:center" : ""}}
    .r{display:flex;align-items:baseline;gap:2mm;font-weight:${serif ? 600 : 700};font-size:11.5pt}
    .r .d{flex:1;border-bottom:${l.style === "bistrot" ? "0.5mm dotted #B8AE9C" : "0"};transform:translateY(-1mm)}
    .r b{font-weight:${serif ? 600 : 700}}.r .p{font-family:"JetBrains Mono",monospace;font-size:10.5pt;font-weight:700;white-space:nowrap}
    ${l.style === "elegant" ? ".r{display:block}.r .d{display:none}.r .p{display:block;margin-top:.8mm;color:" + acc + "}" : ""}
    .ds{margin:.8mm 0 0;font:400 9pt/1.35 "Instrument Sans",sans-serif;color:#615B74;${l.style === "elegant" ? "" : "padding-right:14mm"}}
    .ic{font:600 7.5pt "Instrument Sans",sans-serif;color:${acc};margin-left:1.5mm}
    footer{margin-top:8mm;padding-top:4mm;border-top:0.3mm solid #E2D6C2;text-align:center;font:500 8pt/1.4 "Instrument Sans",sans-serif;color:#615B74}`;
  const sec = SECS.map((x) => [x, D.filter((n) => cmSecOf(n, SECS) === x.id)]).filter((g) => g[1].length);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>La carte · ${esc(name)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,600..800&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@700&display=swap"><style>${css}</style></head><body>
    <header>${lg ? `<img src="${esc(lg)}" alt="">` : ""}<h1>${esc(name)}</h1><p>La carte</p></header>
    <div class="cols">${sec.map(([x, L]) => `<section><h2>${esc(x.t)}</h2>${L.map((n) => `<div class="it"><div class="r"><b>${esc(n.title)}${c.veg.includes(n.id) ? `<span class="ic">végétarien</span>` : ""}</b><span class="d"></span><span class="p">${cmEur(num(n.price)).replace(",00", "")}</span></div>${c.desc[n.id] ? `<p class="ds">${esc(c.desc[n.id])}</p>` : ""}</div>`).join("")}</section>`).join("")}</div>
    <footer>Prix nets, service compris. Les allergènes de chaque plat sont indiqués dans notre tableau des allergènes, consultable en salle, et sur notre carte en ligne.</footer></body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  const go2 = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); };
  try { (d.fonts && d.fonts.ready ? Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 1800))]) : Promise.resolve()).then(() => setTimeout(go2, 250)); } catch (e) { setTimeout(go2, 700); }
}

/* ───────── demo ───────── */
function cmSeedDemo() {
  const p = `restos/${S.rid}/qrMenu`; if (!DB.local[p]) DB.local[p] = { cfg: { ...cmDefCfg(), on: true, setupAt: Date.now(), tables: 18, desc: {}, veg: [] } };
  const q = `restos/${S.rid}/qrPay`; if (!DB.local[q]) DB.local[q] = { link: { acct: "acct_demo", charges: true, status: "active", name: "Le Bistrot Démo", live: true } };
  /* a demo carte when the demo restaurant has none (photos are drawn, nothing is fetched) */
  const np = `restos/${S.rid}/notes`; const has = Object.values(DB.local[np] || {}).some((n) => n.carte && num(n.price) > 0);
  if (!has) {
    const ph = (h1, h2, e) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${h1}"/><stop offset="1" stop-color="${h2}"/></radialGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="76" font-size="46" text-anchor="middle">${e}</text></svg>`)}`;
    const L = [["Croquettes de jambon", 9, "partage", ["gluten", "lait", "oeufs"], ph("#F6C97A", "#C9822E", "🥘")], ["Planche de charcuterie", 18, "partage", ["sulfites", "lait", "gluten"], ph("#F3A29A", "#B8473C", "🥓")],
      ["Velouté de potimarron", 8.5, "entree", ["lait"], ph("#FFC37A", "#E07B22", "🎃")], ["Bœuf bourguignon", 22, "plat", ["sulfites", "lait", "celeri"], ph("#C98A6B", "#6E2E1E", "🍲")],
      ["Filet de bar, beurre blanc", 24, "plat", ["poissons", "lait"], ph("#BFE3F0", "#4E8FB0", "🐟")], ["Mousse au chocolat", 7, "dessert", ["oeufs", "lait"], ph("#B98A6E", "#4A2A1C", "🍫")],
      ["Tarte fine aux pommes", 8, "dessert", ["gluten", "lait", "oeufs"], ph("#F7D99B", "#C98F33", "🥧")], ["Limonade maison", 4.5, "boisson", [], ph("#E6F5B8", "#9CC23E", "🍋")]];
    const t = Date.now(); DB.local[np] = DB.local[np] || {};
    L.forEach(([title, price, carteCat, allergens, photo], i) => { DB.local[np]["cmd" + i] = { title, cat: "Recettes", body: "", ingredients: [], steps: [], portions: 1, allergens, alNo: [], carte: true, carteCat, price, photo, uid: S.me.id, at: t - i, updatedAt: t - i, src: "commande" }; });
    const c = DB.local[p].cfg; c.desc = { cmd0: "Béchamel crémeuse, jambon ibérique. Par six.", cmd3: "Mijoté sept heures, carottes fondantes, purée maison.", cmd4: "Poisson de ligne, poireaux crayon.", cmd5: "Chocolat noir 70 %, fleur de sel." }; c.veg = ["cmd2", "cmd7"];
    try { DB.emit(np); } catch (e) {}
  }
  const path = `restos/${S.rid}/clientOrders`; if (DB.local[path]) return;
  const D = Object.entries(DB.local[np] || {}).map(([id, n]) => ({ id, ...n })).filter((n) => n.carte && num(n.price) > 0); const pick = (i) => D[i % Math.max(1, D.length)];
  const it = (i, q, note) => { const n = pick(i); return n ? { id: n.id, name: n.title, price: num(n.price), q, note: note || "" } : { id: "x" + i, name: ["Bœuf bourguignon", "Croquettes de jambon", "Mousse au chocolat", "Limonade maison"][i % 4], price: [22, 9, 7, 4.5][i % 4], q, note: note || "" }; };
  const now = Date.now(), day = dayKey(), rows = {};
  const mk = (id, n, minAgo, o) => { const items = o.items; rows[id] = { n, day, at: now - minAgo * 6e4, mode: "table", table: "", slot: "", name: "", phone: "", note: "", items, total: items.reduce((a, x) => a + x.price * x.q, 0), pay: "place", paid: false, status: "nouvelle", src: "qr", seenAt: now, ...o }; };
  mk("dm1", 9, 2, { table: "4", items: [it(0, 2), it(1, 1, "Sans oignons")], paid: true, pay: "stripe" });
  mk("dm2", 8, 6, { mode: "emporter", slot: "12:45", name: "Camille", phone: "06 12 34 56 78", items: [it(2, 1), it(3, 2)], status: "nouvelle" });
  mk("dm3", 7, 14, { table: "11", items: [it(1, 3), it(4, 2)], status: "prep", prepAt: now - 9 * 6e4, paid: true, pay: "stripe", note: "Les desserts plus tard, merci" });
  mk("dm4", 6, 22, { table: "5", items: [it(0, 1), it(2, 1)], status: "prep", prepAt: now - 18 * 6e4 });
  mk("dm5", 5, 31, { mode: "emporter", slot: "12:30", name: "Hugo", phone: "07 22 18 40 11", items: [it(3, 2)], status: "prete", readyAt: now - 3 * 6e4, paid: true, pay: "stripe" });
  [4, 3, 2, 1].forEach((n, i) => mk("dmd" + n, n, 60 + i * 25, { table: String(3 + i * 2), items: [it(i, 2), it(i + 1, 1)], status: "servie", paid: i % 2 === 0, pay: i % 2 === 0 ? "stripe" : "place", settled: i % 2 !== 0 }));
  DB.local[path] = rows;
}
function cmDemoPing() {
  if (DB.mode !== "demo" || !S.rid) return; const D = cmDishes().filter((n) => num(n.price) > 0); if (!D.length) return;
  const items = [{ id: D[0].id, name: D[0].title, price: num(D[0].price), q: 2, note: "" }, ...(D[2] ? [{ id: D[2].id, name: D[2].title, price: num(D[2].price), q: 1, note: "Bien cuit" }] : [])];
  const n = Math.max(0, ...(CM.orders || []).map((o) => +o.n || 0)) + 1;
  DB.set("clientOrders", "dmp" + Date.now().toString(36), { n, day: dayKey(), at: Date.now(), mode: "table", table: "8", slot: "", name: "", phone: "", note: "", items, total: items.reduce((a, x) => a + x.price * x.q, 0), pay: "stripe", paid: true, status: "nouvelle", src: "qr" });
}

/* ───────── actions ───────── */
const cmVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
Object.assign(ACT, {
  cmTab: (a, id, v) => { if (CM.tab === v) return; CM.tab = v; SFX.tick(); buzz(4); rerender(); },
  cmCol: (a, id, v) => { CM.col = v; SFX.tick(); const r = $(".cm-rail"), col = r && r.querySelector(`[data-col="${v}"]`); if (col) r.scrollTo({ left: col.offsetLeft - 14, behavior: "smooth" }); $$(".cm-colnav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); },
  cmFull: () => { SFX.tap(); try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) {} if (!document.fullscreenEnabled) toast("Plein écran : utilisez le menu du navigateur."); },
  cmDoneTog: () => { CM.showDone = !CM.showDone; SFX.tick(); rerender(); },
  cmStart: async () => { if (!cmDishes().some((n) => num(n.price) > 0)) return; SFX.done(); burst && burst(); await cmSaveCfg({ on: true }); CM.tab = "qr"; toast("Commande en ligne ouverte. Imprimez vos QR codes !"); rerender(); },
  cmOpenNow: async () => { SFX.ok(); buzz(8); await cmSaveCfg({ on: true }); toast("Commande en ligne ouverte"); },
  cmNext: async (a, id, v) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o || CM.busy[id]) return; CM.busy[id] = true;
    const patch = { status: v, by: S.me.id }; if (v === "prep") patch.prepAt = Date.now(); if (v === "prete") patch.readyAt = Date.now(); if (v === "servie") patch.doneAt = Date.now();
    const card = a.closest(".cm-o"); if (card) card.classList.add("go");
    if (v === "prete") { SFX.done(); buzz([14, 40, 14]); } else if (v === "servie") { SFX.ok(); buzz(8); } else { SFX.ok(); buzz(8); }
    setTimeout(async () => { try { await safe(DB.update("clientOrders", id, patch)); if (v === "servie") toastUndo(o.mode === "table" ? `Commande QR · Table ${o.table} terminée` : `Commande n° ${o.n} terminée`), S.ui.undo = () => DB.update("clientOrders", id, { status: "prete", doneAt: null }); } catch (e) {} delete CM.busy[id]; onData(); }, card ? 260 : 0);
  },
  cmMenu: (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.tap();
    const back = { prep: ["nouvelle", "Remettre en « nouvelle »"], prete: ["prep", "Remettre en préparation"] }[o.status];
    openSheet(`<div class="cm-ed"><div class="cm-edh"><span class="h2">${o.mode === "table" ? `Commande QR · Table ${esc(o.table)}` : `Commande n° ${o.n}`}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <p class="sub">${o.mode === "table" ? `Table ${esc(o.table)}` : `À emporter ${esc(o.slot || "")}${o.name ? ` · ${esc(o.name)}` : ""}`} · ${cmEur(o.total)} · ${o.paid ? "payée en ligne" : "à encaisser"}</p>
      ${o.phone ? `<a class="btn soft block" href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}">${ico("rsPhone")}Appeler ${esc(o.name || "le client")}</a>` : ""}
      ${back ? `<button class="btn soft block" data-act="cmBack" data-id="${esc(o.id)}" data-v="${back[0]}">${ico("back")}${back[1]}</button>` : ""}
      <button class="btn danger block" data-act="cmCancel" data-id="${esc(o.id)}">${ico("x")}${o.paid ? "Annuler et rembourser" : "Annuler la commande"}</button>
      ${o.paid ? `<p class="note">Le client est remboursé sur sa carte (sous 5 à 10 jours chez sa banque).</p>` : ""}</div>`);
  },
  cmBack: async (a, id, v) => { closeSheet(); SFX.tap(); await safe(DB.update("clientOrders", id, { status: v })); },
  cmCancel: async (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return;
    if (a.dataset.sure !== "1") { a.dataset.sure = "1"; a.innerHTML = `${ico("alert")}Touchez encore pour confirmer`; SFX.err(); buzz([20, 40, 20]); return; }
    a.disabled = true;
    try {
      if (DB.mode === "db" && o.paid) { const r = await cmCall("cancel", { oid: id }); toast(r.refunded ? `Commande annulée, ${cmEur(r.refunded)} remboursés` : "Commande annulée"); }
      else { await safe(DB.update("clientOrders", id, { status: "annulee", cancelledAt: Date.now(), cancelledBy: S.me.id })); toast("Commande annulée"); }
      closeSheet(); SFX.close();
    } catch (e) { console.warn(e); SFX.err(); a.disabled = false; toast(cmErr(e), "err"); }
  },
  cmOut: async (a, id) => { const c = cmCfg(), out = { ...c.out }; const today = dayKey(); if (out[id] === today) delete out[id]; else out[id] = today; Object.keys(out).forEach((k) => { if (out[k] !== today) delete out[k]; }); out[id] === today ? SFX.tap() : SFX.ok(); buzz(5); await cmSaveCfg({ out }); },
  cmHide: async (a, id) => { const c = cmCfg(); const h = c.hidden.includes(id) ? c.hidden.filter((x) => x !== id) : [...c.hidden, id]; h.includes(id) ? SFX.tap() : SFX.ok(); buzz(5); await cmSaveCfg({ hidden: h }); },
  cmDish: (a, id) => { const n = S.notes.find((x) => x.id === id); if (!n) return; SFX.tap(); cmDishOpen(n); },
  cmAdd: () => { SFX.tap(); cmDishOpen(null); },
  cmEdCat: (a, id, v) => { CM.ed.title = cmVal("cmEdT"); CM.ed.price = cmVal("cmEdP"); CM.ed.desc = cmVal("cmEdD"); CM.ed.sec = v; SFX.tick(); $$(".cm-ed .cm-chips .chip").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); },
  cmEdPhDel: () => { CM.ed.title = cmVal("cmEdT"); CM.ed.price = cmVal("cmEdP"); CM.ed.desc = cmVal("cmEdD"); CM.ed.photo = ""; CM.ed.photoId = ""; SFX.close(); cmDishPaint(); },
  cmEdOff: async () => { const e = CM.ed; if (!e || !e.id) return; await safe(DB.update("notes", e.id, { carte: false, updatedAt: Date.now() })); closeSheet(); SFX.close(); toastUndo(`${e.title} retiré de la carte`); S.ui.undo = () => DB.update("notes", e.id, { carte: true }); },
  cmAlNext: () => { const n = cmDishes().find((x) => x.alCheck); if (!n) return; SFX.tap(); cmDishOpen(n); },
  cmLook: () => { SFX.tap(); cmLookPaint(); },
  cmLookSet: async (a) => { const k = a.dataset.k, v = a.dataset.v; const l = { ...cmCfg().look }; l[k] = k === "photos" ? v === "1" : v; SFX.tick(); buzz(4); const p = cmSaveCfg({ look: l }); if (k === "cover") { await p; cmLookPaint(); } else { cmLookLive(); await p; } },
  cmSecsOpen: () => { if (CM.ed) { CM.ed.title = cmVal("cmEdT") || CM.ed.title; CM.ed.price = cmVal("cmEdP") || CM.ed.price; CM.ed.desc = cmVal("cmEdD") || CM.ed.desc; CM.secBack = CM.ed; } SFX.tap(); cmSecsPaint(); },
  cmSecMv: async (a, id, v) => { const L = cmSecs(); const i = L.findIndex((x) => x.id === id), j = i + +v; if (i < 0 || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; SFX.tick(); await cmSecsSave(L); cmSecsPaint(); },
  cmSecDel: async (a, id) => { const L = cmSecs().filter((x) => x.id !== id); SFX.close(); await cmSecsSave(L); cmSecsPaint(); },
  cmSecAdd: async () => { const t = cmVal("cmSecNew").trim(); if (t.length < 2) { SFX.err(); return; } const L = cmSecs(); const k = (typeof ciKindOf === "function" && ciKindOf(t)) || "plat"; const id = "s" + Date.now().toString(36); L.push({ id, t, k }); SFX.ok(); await cmSecsSave(L);
    if (CM.secBack) { const e = CM.secBack; CM.secBack = null; e.sec = id; CM.ed = e; cmDishPaint(); return; } cmSecsPaint(); },
  cmPrintMenu: () => { SFX.tap(); cmPrintMenu(); },
  cmEdVeg: (a) => { CM.ed.veg = !CM.ed.veg; a.classList.toggle("on", CM.ed.veg); a.querySelector(".cm-sw").classList.toggle("on", CM.ed.veg); a.setAttribute("aria-pressed", CM.ed.veg); SFX.tick(); buzz(4); },
  cmEdAl: (a, id, v) => { const L = CM.ed.al; const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); a.classList.toggle("on", i < 0); SFX.tick(); },
  cmEdFiche: () => { const id = CM.ed && CM.ed.id; closeSheet(); if (id) go("fiche", { id }); },
  cmEdSave: async () => {
    const e = CM.ed; if (!e || e.busy) return; const title = cmVal("cmEdT").trim(), pr = num(cmVal("cmEdP")), desc = cmVal("cmEdD").trim();
    if (title.length < 2) { SFX.err(); toast("Donnez un nom à l'article.", "err"); return; }
    if (!(pr > 0)) { SFX.err(); toast("Indiquez un prix.", "err"); return; }
    const c = cmCfg(), SECS = cmSecs(), sec = SECS.find((x) => x.id === e.sec) || SECS[0]; let id = e.id;
    const place = { carteCat: sec.k, carteSec: sec.id === sec.k ? "" : sec.id };
    try {
      if (e.isNew) { const t = Date.now(); id = await safe(DB.add("notes", { title, cat: "Recettes", body: "", ingredients: [], steps: [], portions: 1, allergens: e.al, alNo: [], carte: true, ...place, price: Math.round(pr * 100) / 100, photo: e.photo || "", photoId: e.photoId || "", uid: S.me.id, at: t, updatedAt: t, src: "commande" })); }
      else { const p = { title, price: Math.round(pr * 100) / 100, ...place, photo: e.photo || "", photoId: e.photoId || "", updatedAt: Date.now() }; if (e.own) { p.allergens = e.al; p.alCheck = false; } await safe(DB.update("notes", id, p)); }
      const desc2 = { ...c.desc }; if (desc) desc2[id] = desc.slice(0, 220); else delete desc2[id];
      const veg = e.veg ? [...new Set([...c.veg, id])] : c.veg.filter((x) => x !== id);
      await cmSaveCfg({ desc: desc2, veg });
      const wasChk = e.alCheck && e.own; CM.ed = null; closeSheet(); SFX.ok(); toast(e.isNew ? `${title} ajouté à la carte` : wasChk ? "Allergènes vérifiés" : "Enregistré");
      if (wasChk) { const nx = cmDishes().find((x) => x.alCheck && x.id !== id); if (nx) setTimeout(() => cmDishOpen(nx), 380); }
    } catch (err) {}
  },
  cmTables: async (a, id, v) => { const n = Math.max(1, Math.min(99, cmTablesN() + +v)); SFX.tick(); buzz(3); await cmSaveCfg({ tables: n }); },
  cmPrintTables: () => { SFX.print ? SFX.print() : SFX.tap(); const n = cmTablesN(); cmPrint(`QR tables · ${(S.resto && S.resto.name) || ""}`, Array.from({ length: n }, (_, i) => String(i + 1))); },
  cmPrintTake: () => { SFX.print ? SFX.print() : SFX.tap(); cmPrint(`À emporter · ${(S.resto && S.resto.name) || ""}`, [], true); },
  cmCopy: async (a, id, v) => { const ok = typeof rsCopy === "function" ? await rsCopy(cmUrl(v)) : false; ok ? (SFX.ok(), toast("Lien copié")) : toast(cmUrl(v)); },
  cmOnTog: async () => { const c = cmCfg(); if (!c.on && !cmDishes().some((n) => num(n.price) > 0)) { SFX.err(); toast("Ajoutez d'abord un plat avec un prix.", "err"); return; } c.on ? SFX.tap() : SFX.ok(); buzz(5); await cmSaveCfg({ on: !c.on }); },
  cmTableTog: async () => { const c = cmCfg(); SFX.tick(); await cmSaveCfg({ table: !c.table }); },
  cmTakeTog: async () => { const c = cmCfg(); SFX.tick(); await cmSaveCfg({ takeaway: !c.takeaway }); },
  cmPayOnline: async () => { const c = cmCfg(); SFX.tick(); await cmSaveCfg({ payOnline: !c.payOnline, ...(c.payOnline ? { payPlace: true } : {}) }); },
  cmTablePay: async (a, id, v) => { if (!CM_TPAY.some((x) => x[0] === v) || cmTablePay() === v) return; SFX.tick(); buzz(4); await cmSaveCfg({ tablePay: v });
    toast(v === "avant" ? "Paiement obligatoire à la commande" : v === "choix" ? "Le client choisit quand il paie" : "Paiement à la fin du repas"); },
  cmSettle: async (a, id) => { const o = (CM.orders || []).find((x) => x.id === id); if (!o || o.settled) return; SFX.ok(); buzz(8);
    const el = a.closest(".cm-due"); if (el) el.classList.add("out");
    setTimeout(async () => { try { await safe(DB.update("clientOrders", id, { settled: true, settledAt: Date.now(), settledBy: S.me.id })); } catch (e) {}
      S.ui.undo = () => DB.update("clientOrders", id, { settled: false, settledAt: null, settledBy: null }); toastUndo(`Table ${o.table} réglée`); if (typeof logEvent === "function") try { logEvent("commande", `Commande QR table ${o.table} réglée (${cmEur(o.total)})`); } catch (e) {} onData(); }, el ? 240 : 0); },
  cmPayPlace: async () => { const c = cmCfg(); SFX.tick(); await cmSaveCfg({ payPlace: c.payPlace === false }); },
  cmPrep: async (a, id, v) => { SFX.tick(); await cmSaveCfg({ prepMin: +v }); },
  cmDay: async (a, id, v) => { const c = cmCfg(), d = +v; const days = c.pickup.days.includes(d) ? c.pickup.days.filter((x) => x !== d) : [...c.pickup.days, d]; SFX.tick(); await cmSaveCfg({ pickup: { ...c.pickup, days } }); },
  cmWinAdd: async () => { const c = cmCfg(); SFX.tap(); await cmSaveCfg({ pickup: { ...c.pickup, windows: [...c.pickup.windows, { from: "18:30", to: "21:30" }].slice(0, 2) } }); },
  cmWinDel: async (a) => { const c = cmCfg(); SFX.tap(); await cmSaveCfg({ pickup: { ...c.pickup, windows: c.pickup.windows.filter((_, i) => i !== +a.dataset.i) } }); },
  cmConnect: async () => {
    if (DB.mode === "demo") { toast("Démo : chaque restaurant relie son propre compte Stripe ici."); return; }
    CM.busy.connect = true; rerender();
    try { const r = await cmCall("connect"); if (r.url) { location.href = r.url; return; } } catch (e) { console.warn(e); SFX.err(); toast(cmErr(e), "err"); }
    delete CM.busy.connect; rerender();
  },
  cmCheck: async () => { try { await cmCall("check"); SFX.ok(); toast("Statut Stripe actualisé"); } catch (e) { SFX.err(); toast(cmErr(e), "err"); } },
});
/* inputs: time windows (change) and the menu message (blur) */
document.addEventListener("change", (e) => {
  const el = e.target; if (!el || !el.closest || !el.closest(".cm, .cm-ed")) return;
  if (el.dataset.act === "cmWin") { const c = cmCfg(); const w = c.pickup.windows.map((x) => ({ ...x })); const i = +el.dataset.i; if (w[i] && /^\d{2}:\d{2}$/.test(el.value)) { w[i][el.dataset.k] = el.value; cmSaveCfg({ pickup: { ...c.pickup, windows: w } }); } }
  if (el.id === "cmMsg") { cmSaveCfg({ msg: el.value.trim().slice(0, 140) }); SFX.ok(); toast("Message enregistré"); }
  if (el.dataset.sec) { const L = cmSecs(); const x = L.find((y) => y.id === el.dataset.sec); const t = el.value.trim(); if (x && t.length >= 2 && t !== x.t) { x.t = t; cmSecsSave(L); SFX.ok(); } }
  if (el.dataset.seck) { const L = cmSecs(); const x = L.find((y) => y.id === el.dataset.seck); if (x) { x.k = el.value; cmSecsSave(L); SFX.tick(); } }
});
/* back from Stripe onboarding: ?cmStripe=<rid> → Réglages of this screen, status refreshed */
(function cmReturn() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return; } const rid = q.get("cmStripe"); if (!rid) return;
  try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
  let n = 0; const t = setInterval(() => { n++; if (n > 60) { clearInterval(t); return; } if (!S.ready || S.rid !== rid) return; clearInterval(t); CM.tab = "cfg"; go("commandes", { tab: "cfg" }); cmCall("check").then((r) => { if (r.link && r.link.charges) { SFX.done(); toast("Stripe est relié : vos clients peuvent payer en ligne"); } }).catch(() => {}); }, 500);
})();
