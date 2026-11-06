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
     restos/{rid}/qrMenu/cfg         { on, table, takeaway, payOnline, payPlace, prepMin, tables, pickup:{days,windows:[{from,to}],step}, msg,
                                       hidden:[noteId], out:{noteId:"YYYY-MM-DD"}, desc:{noteId:text}, veg:[noteId], setupAt }
     restos/{rid}/qrPay/link         Stripe account of the restaurant (server-written, members read)
     restos/{rid}/public/menu        projection read by the public page commande/ (cmPubDoc): never a client's data, never a cost price.
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
  return o;
}
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
  DB.watch("qrMenu", {}, (rows) => { if (S.rid !== rid) return; CM.cfgDoc = (rows.find((r) => r.id === "cfg") || null); CM.cfgSeen = true; cmSyncSoon(); onData(); });
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
function cmOrdersToday() { const k = dayKey(); return (CM.orders || []).filter((o) => o.day === k || (cmLiveSt(o) && Date.now() - (o.at || 0) < 36 * 3600e3)); }
function cmAlert(o) {
  CM.fresh.add(o.id);
  try { SFX.init(); SFX.tone(1319, 0.28, "sine", 0.055); SFX.tone(1568, 0.3, "sine", 0.05, 0.16); SFX.tone(2093, 0.5, "sine", 0.04, 0.32); buzz([22, 50, 22, 50, 40]); } catch (e) {}
  const where = o.mode === "table" ? `Table ${o.table}` : `À emporter ${o.slot || ""}`.trim();
  if (S.route !== "commandes" || CM.tab !== "live") toast(`Nouvelle commande n° ${o.n} · ${where} · ${cmEur(o.total)}`, "info");
  try { if (window.ALERTES && typeof window.ALERTES.push === "function") window.ALERTES.push({ type: "commande", key: "cmd_" + o.id, level: "info", text: `Nouvelle commande en ligne n° ${o.n}`, sub: `${where} · ${cmEur(o.total)}${o.paid ? " · payée" : ""}`, day: o.day, route: "commandes" }); } catch (e) {}
}
window.CMD = { unseen: () => (CM.orders || []).filter((o) => o.status === "nouvelle").length };

/* ───────── public projection (restos/{rid}/public/menu), written by any member's app ───────── */
const cmLogo = () => { const l = typeof restoLogo === "function" ? restoLogo(S.resto) : (S.resto && S.resto.logo) || ""; return typeof l === "string" && /^(data:image\/|https:\/\/)/.test(l) && l.length <= 200000 ? l : ""; };
function cmDishes() {
  return (S.notes || []).filter((n) => (typeof noteKind === "function" ? noteKind(n) === "Recettes" : n.cat === "Recettes") && n.carte)
    .sort((a, b) => CM_CATS.findIndex((c) => c[0] === (a.carteCat || "plat")) - CM_CATS.findIndex((c) => c[0] === (b.carteCat || "plat")) || String(a.title || "").localeCompare(String(b.title || ""), "fr"));
}
const cmAllergens = (n) => { try { return typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || []; } catch (e) { return n.allergens || []; } };
const cmPhoto = (n) => { const p = typeof n.photo === "string" ? n.photo : ""; return /^https:\/\//.test(p) && p.length < 2000 ? p : /^data:image\//.test(p) && p.length <= 70000 ? p : ""; };
/* best sellers of the last 30 days (top 3, at least 3 sold) */
function cmPopular() { const since = Date.now() - 30 * 864e5, n = {}; (CM.orders || []).forEach((o) => { if (o.at < since || !["nouvelle", "prep", "prete", "servie"].includes(o.status)) return; (o.items || []).forEach((x) => { n[x.id] = (n[x.id] || 0) + (+x.q || 0); }); });
  return new Set(Object.entries(n).filter((x) => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0])); }
function cmPubDoc() {
  const c = cmCfg(), today = dayKey(), pop = cmPopular();
  const items = cmDishes().filter((n) => num(n.price) > 0 && !c.hidden.includes(n.id)).map((n) => {
    const it = { id: n.id, t: String(n.title || "").slice(0, 80), p: Math.round(num(n.price) * 100) / 100, c: CM_CATS.some((x) => x[0] === n.carteCat) ? n.carteCat : "plat", al: cmAllergens(n) };
    const d = c.desc[n.id]; if (d) it.d = String(d).slice(0, 220); const ph = cmPhoto(n); if (ph) it.ph = ph;
    if (c.out[n.id] === today) it.out = true; if (c.veg.includes(n.id)) it.veg = true; if (pop.has(n.id)) it.pop = true; return it;
  });
  /* Firestore caps a document at 1 MB: drop the heaviest inline photos first */
  let size = JSON.stringify(items).length; items.slice().sort((a, b) => (b.ph || "").length - (a.ph || "").length).forEach((it) => { if (size > 700000 && it.ph && it.ph.startsWith("data:")) { size -= it.ph.length; delete it.ph; } });
  const rs = typeof rsCfg === "function" ? rsCfg() : {};
  return { v: 1, name: (S.resto && S.resto.name) || "", logo: cmLogo(), address: rs.address || "", phone: rs.phone || "", msg: c.msg || "",
    cfg: { on: !!c.on, table: !!c.table, takeaway: !!c.takeaway, payOnline: !!(c.payOnline && CM.link && CM.link.charges), payPlace: c.payPlace !== false || !(CM.link && CM.link.charges), prepMin: c.prepMin, tables: cmTablesN(), pickup: c.pickup },
    cats: CM_CATS.map(([id, t]) => ({ id, t })), items, day: today };
}
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
    const right = `${c.on ? `<span class="cm-onp"><i></i>Ouvert</span>` : `<span class="cm-onp off"><i></i>Fermé</span>`}<button class="iconbtn cm-fullb" data-act="cmFull" aria-label="Écran cuisine plein écran" title="Plein écran">${ico("cmFull")}</button>`;
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
  </div>`;
  const nLive = cols.reduce((a, [s]) => a + by(s).length, 0);
  const rail = nLive ? `<div class="cm-colnav st" style="--i:3">${cols.map(([s, t]) => `<button class="${CM.col === s ? "on" : ""}" data-act="cmCol" data-v="${s}">${t}<b class="mono">${by(s).length}</b></button>`).join("")}</div>
    <div class="cm-rail st" style="--i:3">${cols.map(([s, t, i]) => { const L = by(s); return `<section class="cm-col c-${s}" data-col="${s}"><header>${ico(i)}<b>${t}</b><span class="mono">${L.length}</span></header>
      <div class="cm-col-in">${L.map((o, k) => cmCard(o, k)).join("") || `<div class="cm-col-empty">${s === "nouvelle" ? "Rien de neuf" : s === "prep" ? "Rien sur le feu" : "Rien à servir"}</div>`}</div></section>`; }).join("")}</div>`
    : `<div class="glass cm-empty st" style="--i:3"><div class="cm-rail-ill" aria-hidden="true"><i></i><i></i><i></i></div><b class="h3">${c.on ? "Aucune commande en cours" : "La commande en ligne est fermée"}</b>
      <p class="sub">${c.on ? "Les nouvelles commandes arrivent ici avec un carillon. Gardez cet écran ouvert en cuisine." : "Ouvrez-la quand le service commence : vos clients pourront commander depuis les QR codes."}</p>
      <div class="cm-erow">${c.on ? `<a class="btn soft sm" href="${esc(cmUrl(DB.mode === "demo" ? "12" : ""))}" target="_blank" rel="noopener">${ico("cmEye")}Voir la page client</a>` : `<button class="btn acc sm" data-act="cmOpenNow">Ouvrir maintenant</button>`}</div></div>`;
  const doneL = done.length ? `<button class="cm-donet st" style="--i:4" data-act="cmDoneTog" aria-expanded="${CM.showDone}">${ico("check")}Terminées aujourd'hui<b class="mono">${done.length}</b>${ico("down", CM.showDone ? "rot" : "")}</button>
    ${CM.showDone ? `<div class="glass cm-done">${done.map((o) => `<div class="cm-dr${o.status === "annulee" ? " off" : ""}"><b class="mono">n° ${o.n}</b><span>${o.mode === "table" ? `Table ${esc(o.table)}` : `À emporter${o.name ? ` · ${esc(o.name)}` : ""}`}</span><em>${(o.items || []).reduce((a, x) => a + x.q, 0)} art.</em><b class="mono">${cmEur(o.total)}</b><span class="pill ${o.status === "annulee" ? "bad" : o.paid ? "ok" : "neu"}">${o.status === "annulee" ? (o.refunded ? "Remboursée" : "Annulée") : o.paid ? "Payée en ligne" : "Sur place"}</span></div>`).join("")}</div>` : ""}` : "";
  return head + rail + doneL;
}
function cmCard(o, k) {
  const next = { nouvelle: ["prep", "Lancer", "cmChef"], prep: ["prete", "C'est prêt", "cmBell"], prete: ["servie", o.mode === "table" ? "Servie" : "Remise au client", "check"] }[o.status];
  const late = o.status === "nouvelle" ? 5 : o.status === "prep" ? 25 : 15;
  const at = o.status === "prep" ? o.prepAt || o.at : o.status === "prete" ? o.readyAt || o.at : o.at;
  const busy = CM.busy[o.id];
  return `<article class="cm-o${CM.fresh.has(o.id) ? " fresh" : ""} m-${o.mode}" style="--i:${Math.min(k, 8)}" data-id="${esc(o.id)}">
    <div class="cm-o-h"><b class="cm-n mono">${o.n}</b>
      ${o.mode === "table" ? `<span class="cm-where t">${ico("rsTable")}Table <b>${esc(o.table)}</b></span>` : `<span class="cm-where e">${ico("cmBag")}${esc(o.slot || "")}</span>`}
      <span class="cm-ago mono${(Date.now() - at) / 6e4 > late ? " late" : ""}" data-at="${at}" data-late="${late}">${cmAgo(at)}</span></div>
    ${o.mode === "emporter" && o.name ? `<div class="cm-who">${esc(o.name)}${o.phone ? ` · <a href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}">${esc(o.phone)}</a>` : ""}</div>` : o.name ? `<div class="cm-who">${esc(o.name)}</div>` : ""}
    <ul class="cm-items">${(o.items || []).map((x) => `<li><b class="mono">${x.q}</b><span>${esc(x.name)}${x.note ? `<em>${esc(x.note)}</em>` : ""}</span></li>`).join("")}</ul>
    ${o.note ? `<div class="cm-onote">${ico("rsNote")}<span>${esc(o.note)}</span></div>` : ""}
    <div class="cm-o-f"><span class="cm-pay ${o.paid ? "ok" : ""}">${o.paid ? `${ico("check")}Payée` : `${ico("cmCard")}À encaisser`}</span><b class="mono">${cmEur(o.total)}</b>
      <button class="cm-more" data-act="cmMenu" data-id="${esc(o.id)}" aria-label="Plus d'actions">${ico("dots")}</button></div>
    ${next ? `<button class="btn ${o.status === "prete" ? "" : "acc"} block cm-next" data-act="cmNext" data-id="${esc(o.id)}" data-v="${next[0]}" ${busy ? "disabled" : ""}>${ico(next[2])}${next[1]}</button>` : ""}
  </article>`;
}

/* ── la carte ── */
function cmCarte() {
  const c = cmCfg(), D = cmDishes(), today = dayKey();
  const groups = CM_CATS.map(([k, t]) => [k, t, D.filter((n) => (CM_CATS.some((x) => x[0] === n.carteCat) ? n.carteCat : "plat") === k)]).filter((g) => g[2].length);
  const online = D.filter((n) => num(n.price) > 0 && !c.hidden.includes(n.id)).length, noPrice = D.filter((n) => !(num(n.price) > 0)).length;
  const row = (n, i) => {
    const hid = c.hidden.includes(n.id), out = c.out[n.id] === today, np = !(num(n.price) > 0), ph = n.photo, al = cmAllergens(n);
    return `<div class="cm-dish st${hid || np ? " hid" : ""}${out ? " out" : ""}" style="--i:${Math.min(i, 14)}">
      <button class="cm-dthumb" data-act="cmDish" data-id="${esc(n.id)}" aria-label="Modifier ${esc(n.title)}">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy">` : `<span>${esc(initials(n.title || "?"))}</span>`}</button>
      <button class="cm-dtx" data-act="cmDish" data-id="${esc(n.id)}"><b>${esc(n.title || "Sans nom")}</b>
        <em>${np ? `<span class="cm-warnt">Sans prix : pas affiché</span>` : `<span class="mono">${cmEur(num(n.price))}</span>`}${c.veg.includes(n.id) ? `<span class="cm-veg">${ico("cmLeaf")}Végé</span>` : ""}${al.length ? `<span class="cm-al">${al.length} allergène${al.length > 1 ? "s" : ""}</span>` : ""}</em>
        ${c.desc[n.id] ? `<i>${esc(c.desc[n.id])}</i>` : `<i class="none">Ajoutez une description pour donner envie</i>`}</button>
      <div class="cm-dact">
        <button class="cm-chipb${out ? " on" : ""}" data-act="cmOut" data-id="${esc(n.id)}" ${np || hid ? "disabled" : ""} aria-pressed="${out}">${out ? "Épuisé" : "Dispo"}</button>
        <button class="cm-sw${!hid && !np ? " on" : ""}" data-act="cmHide" data-id="${esc(n.id)}" ${np ? "disabled" : ""} aria-pressed="${!hid}" aria-label="Afficher en ligne"><i></i></button>
      </div></div>`;
  };
  let k = 0;
  return `<div class="cm-carte">
    <div class="cm-chead st" style="--i:2"><div><b class="h3">${online} article${online > 1 ? "s" : ""} en ligne</b><p class="sub">Vos plats viennent des fiches de <b>Recettes & allergènes</b> cochées « à la carte » : prix, photo et allergènes sont repris tout seuls.${noPrice ? ` ${noPrice} sans prix.` : ""}</p></div>
      <div class="cm-chb"><button class="btn acc sm" data-act="cmAdd">${ico("plus")}Ajouter un plat ou une boisson</button><a class="btn soft sm" href="${esc(cmUrl(DB.mode === "demo" ? "12" : ""))}" target="_blank" rel="noopener">${ico("cmEye")}Aperçu client</a></div></div>
    ${groups.length ? groups.map(([key, t, L]) => `<div class="lbl st cm-glbl" style="--i:${3 + k++}">${esc(t)}<span>${L.length}</span></div><div class="glass cm-dlist">${L.map((n) => row(n, k++)).join("")}</div>`).join("")
      : `<div class="glass cm-empty st" style="--i:3"><div class="cm-ill">${ico("book")}</div><b class="h3">Votre carte est vide</b><p class="sub">Ajoutez vos plats et vos boissons. Ils apparaissent aussi dans le tableau des allergènes.</p><button class="btn acc" data-act="cmAdd">${ico("plus")}Ajouter un plat</button></div>`}
    <p class="note cm-cnote">« Épuisé » ne vaut que pour aujourd'hui : demain, le plat revient tout seul.</p>
  </div>`;
}

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
      ${tog("cmPayOnline", c.payOnline, "Proposer « payer maintenant »", "Carte, Apple Pay ou Google Pay au moment de commander.")}
      ${tog("cmPayPlace", c.payPlace !== false || !c.payOnline, "Proposer « payer sur place »", "À la fin du repas ou au retrait.", !c.payOnline)}`
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
    <div class="glass cm-blk st" style="--i:5"><div class="lbl">Message sur la carte</div>
      <input class="input" id="cmMsg" maxlength="140" value="${esc(c.msg || "")}" placeholder="Produits frais du marché, cuisinés sur place.">
      <p class="note">Une phrase affichée en haut de la carte. Le logo vient de Réglages › Logo.</p></div>
  </div>`;
}

/* ───────── dish sheet (edit the online bits, or create a dish) ───────── */
function cmDishOpen(n) {
  const c = cmCfg();
  CM.ed = n ? { id: n.id, title: n.title || "", price: n.price ?? "", cat: n.carteCat || "plat", desc: c.desc[n.id] || "", veg: c.veg.includes(n.id), al: [...(n.allergens || [])], isNew: false }
    : { id: null, title: "", price: "", cat: "plat", desc: "", veg: false, al: [], isNew: true };
  cmDishPaint();
}
function cmDishPaint() {
  const e = CM.ed; if (!e) return; const n = e.id && S.notes.find((x) => x.id === e.id); const fromRec = n ? cmAllergens(n) : [];
  openSheet(`<div class="cm-ed"><div class="cm-edh"><span class="h2">${e.isNew ? "Nouvel article" : "Sur la carte en ligne"}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="field"><span class="lbl">Nom</span><input class="input" id="cmEdT" maxlength="80" value="${esc(e.title)}" placeholder="Bœuf bourguignon" ${e.isNew ? "" : "readonly"}></label>
    <div class="cm-g2"><label class="field"><span class="lbl">Prix TTC</span><div class="cm-eur"><input class="input mono" id="cmEdP" inputmode="decimal" value="${esc(e.price)}" placeholder="12,50"><span>€</span></div></label>
      <div class="field"><span class="lbl">Rubrique</span><div class="cm-chips">${CM_CATS.map(([k, t]) => `<button class="chip${e.cat === k ? " on" : ""}" data-act="cmEdCat" data-v="${k}">${t}</button>`).join("")}</div></div></div>
    <label class="field"><span class="lbl">Description pour les clients</span><textarea class="input" id="cmEdD" maxlength="220" rows="2" placeholder="Mijoté sept heures, carottes fondantes, purée maison.">${esc(e.desc)}</textarea></label>
    <button class="cm-tog${e.veg ? " on" : ""}" data-act="cmEdVeg" aria-pressed="${e.veg}"><span class="cm-tt"><b>Végétarien</b><em>Une petite feuille verte sur la carte.</em></span><span class="cm-sw${e.veg ? " on" : ""}"><i></i></span></button>
    ${e.isNew ? `<div class="field"><span class="lbl">Allergènes</span><div class="cm-als">${ALLERGENS.map((a) => `<button class="chip${e.al.includes(a.id) ? " on" : ""}" data-act="cmEdAl" data-v="${a.id}">${esc(a.t)}</button>`).join("")}</div></div>`
      : `<div class="cm-alinfo">${ico("alert")}<span>${fromRec.length ? `Allergènes repris de la fiche : <b>${esc(fromRec.map((x) => (allergenOf(x) || { t: x }).t).join(", "))}</b>.` : "Aucun allergène sur la fiche."} <button class="cm-lnk" data-act="cmEdFiche">Ouvrir la fiche</button></span></div>`}
    <button class="btn acc block" data-act="cmEdSave">${e.isNew ? "Ajouter à la carte" : "Enregistrer"}</button>
  </div>`);
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
  mk("dm4", 6, 22, { table: "2", items: [it(0, 1), it(2, 1)], status: "prep", prepAt: now - 18 * 6e4 });
  mk("dm5", 5, 31, { mode: "emporter", slot: "12:30", name: "Hugo", phone: "07 22 18 40 11", items: [it(3, 2)], status: "prete", readyAt: now - 3 * 6e4, paid: true, pay: "stripe" });
  [4, 3, 2, 1].forEach((n, i) => mk("dmd" + n, n, 60 + i * 25, { table: String(3 + i * 2), items: [it(i, 2), it(i + 1, 1)], status: "servie", paid: i % 2 === 0, pay: i % 2 === 0 ? "stripe" : "place" }));
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
    setTimeout(async () => { try { await safe(DB.update("clientOrders", id, patch)); if (v === "servie") toastUndo(`Commande n° ${o.n} terminée`), S.ui.undo = () => DB.update("clientOrders", id, { status: "prete", doneAt: null }); } catch (e) {} delete CM.busy[id]; onData(); }, card ? 260 : 0);
  },
  cmMenu: (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.tap();
    const back = { prep: ["nouvelle", "Remettre en « nouvelle »"], prete: ["prep", "Remettre en préparation"] }[o.status];
    openSheet(`<div class="cm-ed"><div class="cm-edh"><span class="h2">Commande n° ${o.n}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
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
  cmEdCat: (a, id, v) => { CM.ed.title = cmVal("cmEdT"); CM.ed.price = cmVal("cmEdP"); CM.ed.desc = cmVal("cmEdD"); CM.ed.cat = v; SFX.tick(); cmDishPaint(); },
  cmEdVeg: (a) => { CM.ed.veg = !CM.ed.veg; a.classList.toggle("on", CM.ed.veg); a.querySelector(".cm-sw").classList.toggle("on", CM.ed.veg); a.setAttribute("aria-pressed", CM.ed.veg); SFX.tick(); buzz(4); },
  cmEdAl: (a, id, v) => { const L = CM.ed.al; const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); a.classList.toggle("on", i < 0); SFX.tick(); },
  cmEdFiche: () => { const id = CM.ed && CM.ed.id; closeSheet(); if (id) go("fiche", { id }); },
  cmEdSave: async () => {
    const e = CM.ed; if (!e) return; const title = cmVal("cmEdT").trim(), pr = num(cmVal("cmEdP")), desc = cmVal("cmEdD").trim();
    if (e.isNew && title.length < 2) { SFX.err(); toast("Donnez un nom à l'article.", "err"); return; }
    if (!(pr > 0)) { SFX.err(); toast("Indiquez un prix.", "err"); return; }
    const c = cmCfg(); let id = e.id;
    try {
      if (e.isNew) { const t = Date.now(); id = await safe(DB.add("notes", { title, cat: "Recettes", body: "", ingredients: [], steps: [], portions: 1, allergens: e.al, alNo: [], carte: true, carteCat: e.cat, price: Math.round(pr * 100) / 100, photo: "", uid: S.me.id, at: t, updatedAt: t, src: "commande" })); }
      else await safe(DB.update("notes", id, { price: Math.round(pr * 100) / 100, carteCat: e.cat, updatedAt: Date.now() }));
      const desc2 = { ...c.desc }; if (desc) desc2[id] = desc.slice(0, 220); else delete desc2[id];
      const veg = e.veg ? [...new Set([...c.veg, id])] : c.veg.filter((x) => x !== id);
      await cmSaveCfg({ desc: desc2, veg });
      closeSheet(); SFX.ok(); toast(e.isNew ? `${title} ajouté à la carte` : "Enregistré");
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
  const el = e.target; if (!el || !el.closest || !el.closest(".cm")) return;
  if (el.dataset.act === "cmWin") { const c = cmCfg(); const w = c.pickup.windows.map((x) => ({ ...x })); const i = +el.dataset.i; if (w[i] && /^\d{2}:\d{2}$/.test(el.value)) { w[i][el.dataset.k] = el.value; cmSaveCfg({ pickup: { ...c.pickup, windows: w } }); } }
  if (el.id === "cmMsg") { cmSaveCfg({ msg: el.value.trim().slice(0, 140) }); SFX.ok(); toast("Message enregistré"); }
});
/* back from Stripe onboarding: ?cmStripe=<rid> → Réglages of this screen, status refreshed */
(function cmReturn() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return; } const rid = q.get("cmStripe"); if (!rid) return;
  try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
  let n = 0; const t = setInterval(() => { n++; if (n > 60) { clearInterval(t); return; } if (!S.ready || S.rid !== rid) return; clearInterval(t); CM.tab = "cfg"; go("commandes", { tab: "cfg" }); cmCall("check").then((r) => { if (r.link && r.link.charges) { SFX.done(); toast("Stripe est relié : vos clients peuvent payer en ligne"); } }).catch(() => {}); }, 500);
})();
