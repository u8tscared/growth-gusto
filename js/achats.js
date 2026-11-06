/* Growth Gusto — area: commandes fournisseurs (routes « achats », « achat »). Prefix « ac ».
   The app prepares one purchase order per supplier, on its own: for every product it estimates what the kitchen will use until the
   delivery AFTER the next one (so the stock never runs dry between two deliveries), from:
     · the covers expected each day: bookings (js/resa.js) × the usual share of walk-ins, never below the usual covers of that weekday
       (Z tickets, js/tickets.js),
     · what one cover uses of the product, over the last 28 days: stock moves of the Z ticket and of recipes (S.moves, kind vente/recette),
       else the dishes sold on the Z tickets × their recipe, else what was delivered,
   then removes the theoretical stock (stockLevel, js/stock.js) and what is already ordered, adds a small safety margin (smaller when the
   product is often thrown away, see js/gaspi.js), and rounds up to the pack size.
   Data (restos/{rid}/…):
     suppliers/{id}  (created by js/import.js) + deliveryDays:[0..6], cutoff:"HH:MM", leadDays, minOrderHT, email, phone, channel, contact
     orders/{id}     { supplierId?, supplier, supKey, status:"brouillon"|"envoyee"|"recue"|"annulee", lines:[{productId?, name, qty, unit, price}],
                       totalHT, deliveryDay, deadline?, note?, channel?, sentAt?, receivedAt?, receptionId?, at, uid, by, auto:true }
                     a « brouillon » has id "br-<supKey>" and only stores the person's changes: { edits:{productId:qty}, extra:[line], removed:[productId] }
     products        + pack (colisage, in the product's unit)
   Exposed: acPlan() → [{ key, name, cfg, next, lines, total }], acPending(productId) → qty already ordered and not delivered yet. */
"use strict";

TAB_OF.achats = "stock"; TAB_OF.achat = "stock";
Object.assign(IC, {
  acCart: ["M3 4h2.2l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 8H6.1", "f:M6.1 8H21l-1.9 7.3a1.6 1.6 0 0 1-1.6 1.2H9.1a1.6 1.6 0 0 1-1.6-1.3z", "c:9.5,20.5,1.3", "c:17.5,20.5,1.3"],
  acSend: ["M21.5 2.5 10.5 13.5", "M21.5 2.5 15 21l-4.5-7.5L3 9z", "f:M21.5 2.5 15 21l-4.5-7.5L3 9z"],
  acMail: ["r:2.5,4.5,19,15,2.5", "m3 6.5 9 6.5 9-6.5", "f:M2.5 7 12 13.5 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17z"],
  acSms: ["M21 12a8.5 8.5 0 0 1-12.4 7.6L3.5 21l1.4-4.8A8.5 8.5 0 1 1 21 12z", "f:M21 12a8.5 8.5 0 0 1-12.4 7.6L3.5 21l1.4-4.8A8.5 8.5 0 1 1 21 12z", "M8.5 12h.01", "M12.5 12h.01", "M16.5 12h.01"],
  acWa: ["M3.5 20.5l1.3-4.3A8.5 8.5 0 1 1 8 19.4z", "M9 8.6c0 3.4 2.9 6.4 6.4 6.4l1.1-1.6-1.9-1-1 .9a4.4 4.4 0 0 1-2.9-2.9l.9-1-1-1.9z"],
  acCopy: ["r:8.5,8.5,12.5,12.5,2.5", "M15.5 8.5V5.5A2.5 2.5 0 0 0 13 3H5.5A2.5 2.5 0 0 0 3 5.5V13a2.5 2.5 0 0 0 2.5 2.5h3", "f:M8.5 11A2.5 2.5 0 0 1 11 8.5h7.5A2.5 2.5 0 0 1 21 11v7.5a2.5 2.5 0 0 1-2.5 2.5H11a2.5 2.5 0 0 1-2.5-2.5z"],
  acPrint: ["M6.5 9V3.5h11V9", "r:3,9,18,8,2.5", "M6.5 14h11v6.5h-11z", "f:M6.5 14h11v6.5h-11z", "M17.5 12h.01"],
  acCal: ["r:3,4.5,18,16.5,3", "M8 2.5v4", "M16 2.5v4", "M3 9.5h18", "f:M3 9.5h18v8.5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z", "M8 14h3v3H8z"],
  acBrain: ["M12 5a3 3 0 1 0-5.9.8A3 3 0 0 0 4.6 11a3 3 0 0 0 1.9 5.2A3 3 0 0 0 12 18z", "M12 5a3 3 0 1 1 5.9.8 3 3 0 0 1 1.5 5.2 3 3 0 0 1-1.9 5.2A3 3 0 0 1 12 18z", "M12 5v13", "f:M12 5a3 3 0 1 1 5.9.8 3 3 0 0 1 1.5 5.2 3 3 0 0 1-1.9 5.2A3 3 0 0 1 12 18z"],
  acBox: ["M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z", "M3.5 8 12 12.5 20.5 8", "M12 12.5v8", "f:M3.5 8 12 12.5v8L3.5 16z"],
  acDone: ["c:12,12,9.5", "f:M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z", "m7.8 12.3 2.8 2.8 5.6-5.8"],
});

/* side nav: right after « Stock & inventaire » (no core edit) */
(function acNav() {
  if (NAV.some((n) => n[0] === "achats")) return;
  const i = NAV.findIndex((n) => n[0] === "stock"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["achats", "acCart", "Achats"]);
})();
try { if (typeof PM_ROUTE !== "undefined") Object.assign(PM_ROUTE, { achats: "stock", achat: "stock" }); } catch (e) {}
/* pack Second and up, like the stock (js/abo.js; open to everyone during the trial) */
try { if (typeof AB_GATE !== "undefined") Object.assign(AB_GATE, { achats: ["pro", "Commandes fournisseurs"], achat: ["pro", "Commandes fournisseurs"] }); } catch (e) {}

/* ───────── state + own subscriptions (suppliers, orders), guarded per restaurant ───────── */
const AC = { rid: null, sup: null, ord: null, subs: {}, tick: null, now: Date.now() };
function acAlive(k) { const s = AC.subs[k]; if (!s) return false; if (DB.mode === "db") return DB.subs.includes(s); return (DB.listeners[DB.path(s.col)] || []).includes(s.cb); }
function acWatch() {
  if (!S.rid) return;
  if (AC.rid !== S.rid) { AC.rid = S.rid; AC.subs = {}; AC.sup = null; AC.ord = null; }
  const rid = S.rid;
  if (DB.mode === "demo") acSeedDemo();
  [["sup", "suppliers", {}], ["ord", "orders", { order: "at", dir: "desc", limit: 400 }]].forEach(([k, col, opts]) => {
    if (acAlive(k)) return;
    const cb = (rows) => { if (S.rid !== rid) return; AC[k] = rows; onData(); };
    const n = DB.subs.length; DB.watch(col, opts, cb);
    AC.subs[k] = DB.mode === "db" ? DB.subs[DB.subs.length - 1] || DB.subs[n] : { col, cb };
  });
  if (typeof rsWatch === "function") { try { rsWatch(); } catch (e) {} }
  if (typeof stkEnsureMoves === "function") { try { stkEnsureMoves(); } catch (e) {} }
}
const acSupDocs = () => { acWatch(); return AC.sup || []; };
const acOrders = () => { acWatch(); return AC.ord || []; };

/* demo (in memory only): the suppliers' delivery days and contacts, one order on its way, one delivered with a missing product */
function acSeedDemo() {
  const ps = DB.path("suppliers"), po = DB.path("orders"); if (DB.local[ps] || DB.local[po]) return;
  const now = Date.now(), today = dayKey(), H = 36e5;
  const SUP = [["Marée Atlantique", [2, 5], "16:00", 1, 150, "commandes@maree-atlantique.fr", "05 46 12 33 08", "Julien"], ["Charcuterie Ripert", [2], "12:00", 2, 120, "contact@ripert-charcuterie.fr", "04 77 21 40 11", "Sylvie"],
    ["Boucherie Durand", [1, 4], "17:00", 1, 0, "", "06 71 22 84 19", "Marc"], ["Metro", [3, 6], "20:00", 1, 0, "", "", ""], ["Ferme des Collines", [3], "18:00", 2, 0, "", "06 14 92 77 30", "Élodie"],
    ["Boulangerie Gaspard", [1, 2, 3, 4, 5, 6], "19:00", 1, 0, "", "04 78 30 55 12", ""], ["Domaine Rion", [4], "12:00", 3, 300, "cave@domaine-rion.fr", "03 80 61 05 31", ""], ["Primeur du Marché", [1, 2, 3, 4, 5, 6], "21:00", 1, 40, "", "06 33 18 47 92", "Karim"]];
  const S1 = {}; SUP.forEach(([name, days, cutoff, lead, min, email, phone, contact], i) => { S1["sp" + i] = { name, deliveryDays: days, cutoff, leadDays: lead, minOrderHT: min || null, email, phone, contact, createdAt: now - 300 * 864e5 }; });
  const pr = (id) => S.products.find((p) => p.id === id) || {};
  const line = (id, qty) => { const p = pr(id); return { productId: id, name: p.name || id, unit: p.unit || "kg", qty, price: p.price || null }; };
  const tot = (L) => Math.round(L.reduce((a, x) => a + x.qty * (x.price || 0), 0) * 100) / 100;
  const O = {};
  const metroRec = S.receptions.filter((r) => r.supplier === "Metro").sort((a, b) => b.at - a.at)[0];
  if (metroRec) { const L = [line("p-beurre", 3), line("p-creme", 5), line("p-lait", 8), line("p-comte", 1.5)]; O.od1 = { supplier: "Metro", supKey: acKey("Metro"), supplierId: "sp3", status: "recue", lines: L, totalHT: tot(L), deliveryDay: dayKey(new Date(metroRec.at)), channel: "email", sentAt: metroRec.at - 15 * H, at: metroRec.at - 15 * H, receivedAt: metroRec.at, receptionId: metroRec.id, uid: "demo-thomas", by: "Thomas Girard", auto: true }; }
  const L2 = [line("p-carotte", 5), line("p-oignon", 4), line("p-champi", 2), line("p-echalote", 1)]; O.od2 = { supplier: "Primeur du Marché", supKey: acKey("Primeur du Marché"), supplierId: "sp7", status: "envoyee", lines: L2, totalHT: tot(L2), deliveryDay: today, channel: "sms", sentAt: now - 14 * H, at: now - 14 * H, uid: "demo-thomas", by: "Thomas Girard", auto: true };
  DB.local[ps] = S1; DB.local[po] = O;
}

/* ───────── small helpers ───────── */
const AC_DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const AC_DL = ["D", "L", "M", "M", "J", "V", "S"];
const AC_WEEK = [1, 2, 3, 4, 5, 6, 0];
const acKey = (s) => (typeof stkNorm === "function" ? stkNorm(s) : String(s || "").toLowerCase()).trim();
const acN = (n) => (n == null || isNaN(n) ? "–" : String(Math.round(n * 1000) / 1000).replace(".", ","));
const acEur = (n, d = 2) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const acU = (n, u) => (typeof stkU === "function" ? stkU(n, u) : u || "");
/* quantities shown to a person: whole pieces, else one decimal (two under 1) */
const AC_WHOLE = /^(pi[eè]ce|pce|pc|dz|douzaine|bouteille|f[uû]t|botte|bo[iî]te|colis|bourriche|plateau|barquette|sac|carton|pot|paquet|bocal|unit[ée]|portion|sachet|bidon|caisse)s?$/i;
const acNice = (n, u) => (n == null || isNaN(n) ? n : AC_WHOLE.test(String(u || "").trim()) ? Math.ceil(n - 1e-6) : Math.abs(n) < 1 ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10);
const acQty = (n, u) => `${acN(acNice(n, u))} ${esc(acU(acNice(n, u), u))}`;
const acDay = (k) => { const d = parseDay(k); return `${AC_DOW[d.getDay()]} ${d.getDate()}`; };
const acDayLong = (k) => { const n = daysUntil(k); const d = parseDay(k); return n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const acMoney = () => { try { return typeof PERMS === "undefined" || !PERMS.cap ? true : PERMS.cap("seeMoney") !== false; } catch (e) { return true; } };
const acLeft = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return `${h} h ${pad(m % 60)}`; const d = Math.floor(h / 24); return `${d} j ${h % 24} h`; };
const acColor = (k) => ["#5B2BFF", "#1E7F55", "#E0582F", "#C2337A", "#2F6FD8", "#B97D0E", "#0E8C9E", "#7A4DFF"][[...String(k)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 8];
function acConv(q, from, to) {
  if (q == null) return null; const f = String(from || "").trim(), t = String(to || "").trim(); if (!f || !t || f.toLowerCase() === t.toLowerCase()) return q;
  const k = { g: ["kg", 0.001], kg: ["kg", 1], mg: ["kg", 1e-6], ml: ["L", 0.001], cl: ["L", 0.01], dl: ["L", 0.1], l: ["L", 1], L: ["L", 1], "pièce": ["pc", 1], PCE: ["pc", 1], pce: ["pc", 1], DZ: ["pc", 12], dz: ["pc", 12] };
  const a = k[f] || k[f.toLowerCase()], b = k[t] || k[t.toLowerCase()]; if (!a || !b || a[0] !== b[0]) return null; return (q * a[1]) / b[1];
}
/* the current purchase price: js/marge.js knows the latest invoice price, else the catalogue price */
function acPrice(p) {
  if (!p) return null;
  if (typeof mgPriceOf === "function") { try { const v = mgPriceOf(p.id); const n = v && typeof v === "object" ? v.price : v; if (n > 0) return +n; } catch (e) {} }
  return p.price > 0 ? +p.price : null;
}
const acPack = (p) => (p && p.pack > 0 ? +p.pack : p && p.step > 0 ? +p.step : typeof stkDefStep === "function" ? stkDefStep(p && p.unit) : 1);
const acRound = (q, pack) => (q <= 0 ? 0 : Math.round(Math.ceil(q / pack - 1e-9) * pack * 1000) / 1000);
const acStock = (p) => { try { return typeof stockLevel === "function" ? stockLevel(p.id) : null; } catch (e) { return null; } };
const acTickets = () => { const a = S.tkAll && S.tkAll.length > (S.tickets || []).length ? S.tkAll : S.tickets || []; return a; };

/* ───────── suppliers: the restaurant's file + every name used on a product ───────── */
function acSuppliers() {
  const out = new Map();
  acSupDocs().forEach((d) => { if (!d.name || d.archived) return; const k = acKey(d.name); if (!out.has(k)) out.set(k, { key: k, name: d.name.trim(), doc: d, products: [] }); });
  S.products.forEach((p) => { const n = (p.supplier || "").trim(); if (!n) return; const k = acKey(n); if (!out.has(k)) out.set(k, { key: k, name: n, doc: null, products: [] }); out.get(k).products.push(p); });
  return [...out.values()];
}
const acSupOf = (k) => acSuppliers().find((s) => s.key === k) || null;
/* delivery weekdays: what the person set, else learnt from the receptions of the last 10 weeks, else Monday to Saturday */
function acLearnDays(name) {
  const k = acKey(name), since = Date.now() - 70 * 864e5, c = {};
  S.receptions.forEach((r) => { if (r.at > since && acKey(r.supplier) === k) { const w = new Date(r.at).getDay(); c[w] = (c[w] || 0) + 1; } });
  const tot = Object.values(c).reduce((a, b) => a + b, 0); if (!tot) return null;
  const days = Object.keys(c).map(Number).filter((w) => c[w] >= Math.max(1, tot * 0.12)); return days.length ? days.sort() : null;
}
function acCfg(sup) {
  const d = (sup && sup.doc) || {}; const set = Array.isArray(d.deliveryDays) && d.deliveryDays.length;
  const learnt = !set ? acLearnDays(sup ? sup.name : "") : null;
  return {
    days: set ? d.deliveryDays.map(Number) : learnt || [1, 2, 3, 4, 5, 6], daysFrom: set ? "set" : learnt ? "learnt" : "default",
    cutoff: /^\d{1,2}:\d{2}$/.test(d.cutoff || "") ? d.cutoff : "18:00", lead: d.leadDays != null && d.leadDays !== "" ? Math.max(0, Math.min(7, +d.leadDays || 0)) : 1,
    minHT: +d.minOrderHT > 0 ? +d.minOrderHT : 0, email: d.email || "", phone: d.phone || "", channel: d.channel || (d.email ? "email" : d.phone ? "sms" : ""), contact: d.contact || "",
  };
}
/* next delivery that can still be ordered, and the one after it */
function acNext(cfg, now = Date.now()) {
  const today = dayKey(new Date(now)); let d1 = null, dl = null, d2 = null;
  for (let i = 0; i < 28 && !d2; i++) {
    const k = addDays(today, i); if (!cfg.days.includes(parseDay(k).getDay())) continue;
    if (!d1) { const o = parseDay(addDays(k, -cfg.lead)); const [h, m] = cfg.cutoff.split(":").map(Number); o.setHours(h, m, 0, 0); if (o.getTime() > now) { d1 = k; dl = o.getTime(); } }
    else d2 = k;
  }
  if (!d1) { d1 = addDays(today, 1); dl = now + 864e5; }
  return { d1, d2: d2 || addDays(d1, 7), deadline: dl };
}

/* ───────── covers: history (Z tickets, bookings) and forecast ───────── */
let acCovIx = null;
function acCoverIndex() {
  const T = acTickets(); const bk = typeof rsRows === "function" ? rsRows() : [];
  if (acCovIx && acCovIx.t === T && acCovIx.b === bk && acCovIx.d === dayKey()) return acCovIx;
  const today = dayKey(), from = addDays(today, -56);
  const hist = {}; T.forEach((t) => { if (t.date && t.date >= from && t.date < today && +t.covers > 0) hist[t.date] = (hist[t.date] || 0) + +t.covers; });
  const booked = (k) => (typeof rsCovers === "function" && typeof rsOfDay === "function" ? rsCovers(rsOfDay(k)) : 0);
  /* bookings that came: per day */
  const byW = {}; Object.entries(hist).forEach(([k, c]) => { (byW[parseDay(k).getDay()] ||= []).push(c); });
  const base = {}; Object.entries(byW).forEach(([w, L]) => { const s = L.slice().sort((a, b) => a - b); base[w] = s[Math.floor(s.length / 2)]; });
  const ratios = []; Object.entries(hist).forEach(([k, c]) => { const b = booked(k); if (b >= 4) ratios.push(c / b); });
  ratios.sort((a, b) => a - b); let walk = ratios.length >= 3 ? ratios[Math.floor(ratios.length / 2)] : 1.3; walk = Math.max(1, Math.min(4, walk));
  const histN = Object.keys(hist).length;
  return (acCovIx = { t: T, b: bk, d: dayKey(), hist, base, walk, booked, histN });
}
/* expected covers of a day: bookings × walk-ins, never below the usual covers of that weekday; today counts what is left of it */
function acCovers(k) {
  const X = acCoverIndex(); const w = parseDay(k).getDay(); const b = X.booked(k);
  let open = true; try { if (typeof rsCfg === "function" && typeof rsSvcsOn === "function" && S.resto && S.resto.resaCfg) open = rsSvcsOn(rsCfg(), k).length > 0; } catch (e) {}
  if (X.histN >= 7 && X.base[w] == null && !b) open = false; /* never open that weekday */
  if (!open && !b) return { n: 0, booked: 0, est: 0, open: false };
  const usual = X.base[w] || 0; let n = Math.max(Math.round(b * X.walk), usual);
  if (!usual && !b) n = X.histN ? Math.round(Object.values(X.hist).reduce((a, c) => a + c, 0) / X.histN) : 0;
  if (k === dayKey()) { const h = new Date().getHours(); n = Math.round(n * (h >= 22 ? 0 : h >= 15 ? 0.5 : 1)); }
  return { n, booked: b, est: Math.max(0, n - b), open: true, usual };
}

/* ───────── usage of a product (last 28 days) ───────── */
let acUseIx = null;
function acUseIndex() {
  const T = acTickets();
  if (acUseIx && acUseIx.m === S.moves && acUseIx.t === T && acUseIx.n === S.notes && acUseIx.l === S.lots && acUseIx.d === dayKey()) return acUseIx;
  const today = dayKey(), from = addDays(today, -28), t0 = parseDay(from).getTime(), t1 = parseDay(today).getTime();
  const mv = {}, rc = {}, ls = {}, wa = {};
  (S.moves || []).forEach((m) => {
    if (!m.at || m.at < t0 || m.at >= t1 || !m.productId) return; const q = +m.qty || 0;
    if (q < 0 && (m.kind === "vente" || m.kind === "recette")) mv[m.productId] = (mv[m.productId] || 0) - q;
  });
  /* dishes sold on the Z tickets × their recipe */
  const notes = {}; S.notes.forEach((n) => (notes[n.id] = n));
  T.forEach((t) => {
    if (!t.date || t.date < from || t.date >= today) return;
    (t.lines || []).forEach((L) => {
      const n = L.noteId && notes[L.noteId]; if (!n || !Array.isArray(n.ingredients)) return; const por = Math.max(1, +n.portions || 1); const sold = +L.quantite || +L.qty || 0; if (!sold) return;
      n.ingredients.forEach((g) => { if (!g.productId) return; const p = S.products.find((x) => x.id === g.productId); if (!p) return; const q = acConv(num(g.qty), g.unit, p.unit); if (q == null) return; rc[p.id] = (rc[p.id] || 0) + (q / por) * sold; });
    });
  });
  S.lots.forEach((l) => { if (l.test || !l.createdAt || l.createdAt < t0 || l.createdAt >= t1 || !l.productId) return; ls[l.productId] = (ls[l.productId] || 0) + (num(l.qty) || 0); });
  /* waste of the same window (DLC passed, over-production): js/gaspi.js keeps the list */
  if (typeof gpEntries === "function") { try { gpEntries(t0, t1).forEach((w) => { if (w.productId && w.kind !== "invendu" && (w.reason === "dlc" || w.reason === "surprod" || w.reason === "abime")) { const p = S.products.find((x) => x.id === w.productId); const q = p ? acConv(+w.qty || 0, w.unit, p.unit) : null; if (q != null) wa[w.productId] = (wa[w.productId] || 0) + q; } }); } catch (e) {} }
  const X = acCoverIndex(); let cov = 0, covDays = 0; Object.entries(X.hist).forEach(([k, c]) => { if (k >= from) { cov += c; covDays++; } });
  return (acUseIx = { m: S.moves, t: T, n: S.notes, l: S.lots, d: dayKey(), mv, rc, ls, wa, cov, covDays });
}
function acUsage(p) {
  const X = acUseIndex(); let total = 0, src = "";
  if (X.mv[p.id] > 0) { total = X.mv[p.id]; src = "ventes"; }
  else if (X.rc[p.id] > 0) { total = X.rc[p.id]; src = "recettes"; }
  else if (X.ls[p.id] > 0) { total = X.ls[p.id]; src = "livraisons"; }
  const waste = X.wa[p.id] || 0;
  return { total, src, perDay: total / 28, perCover: X.cov > 0 && total > 0 ? total / X.cov : null, waste, wasteRatio: total > 0 ? waste / (total + waste) : 0 };
}

/* ───────── orders already placed ───────── */
const acLive = (o) => o.status === "envoyee";
/* a sent order is delivered once a reception from that supplier is saved on or after its delivery day (or after it was sent) */
function acDelivery(o) {
  if (o.status === "recue") return S.receptions.find((r) => r.id === o.receptionId) || { at: o.receivedAt, lines: [] };
  if (o.status !== "envoyee") return null; const k = o.supKey || acKey(o.supplier);
  return S.receptions.filter((r) => acKey(r.supplier) === k && r.at >= (o.sentAt || o.at)).sort((a, b) => a.at - b.at)[0] || null;
}
function acPending(pid) {
  let q = 0; acOrders().forEach((o) => { if (!acLive(o) || acDelivery(o)) return; (o.lines || []).forEach((L) => { if (L.productId === pid) q += +L.qty || 0; }); }); return q;
}
const acDraft = (k) => acOrders().find((o) => o.id === "br-" + k) || null;

/* ───────── the plan: one proposed order per supplier ───────── */
function acLineFor(p, next, now) {
  const u = acUsage(p); const today = dayKey(new Date(now));
  let need = 0, covers = 0, days = 0;
  for (let k = today; k < next.d2; k = addDays(k, 1)) {
    const c = acCovers(k); if (!c.open) continue; days++; covers += c.n;
    need += u.perCover != null ? c.n * u.perCover : u.perDay * (7 / 6) * (k === today ? (c.n ? 1 : 0.5) : 1);
  }
  const stock = acStock(p); const pend = acPending(p.id); const pack = acPack(p);
  const wasteHigh = u.wasteRatio >= 0.12;
  const safety = wasteHigh ? (p.minQty > 0 ? +p.minQty * 0.5 : 0) : Math.max(p.minQty > 0 ? +p.minQty : 0, need * 0.15);
  let raw = need + safety - Math.max(0, stock || 0) - pend; let qty = acRound(raw, pack);
  const low = p.minQty > 0 && stock != null && stock <= p.minQty;
  if (!qty && low && !pend) qty = acRound(Math.max(pack, p.minQty * 2 - Math.max(0, stock)), pack);
  if (!u.total && !low) qty = 0; /* nothing known about this product: never invent an order */
  return { p, productId: p.id, name: p.name, unit: p.unit, qty, sug: qty, need: Math.round(need * 1000) / 1000, safety, stock, pend, pack, covers, days, u, wasteHigh, low, price: acPrice(p) };
}
function acPlanFor(sup, now = Date.now()) {
  const cfg = acCfg(sup); const next = acNext(cfg, now); const dr = acDraft(sup.key);
  const lines = sup.products.map((p) => acLineFor(p, next, now));
  if (dr) {
    const ed = dr.edits || {}, rm = new Set(dr.removed || []);
    lines.forEach((L) => { if (ed[L.productId] != null) { L.qty = +ed[L.productId]; L.edited = true; } if (rm.has(L.productId)) { L.qty = 0; L.removed = true; } });
    (dr.extra || []).forEach((x, i) => lines.push({ name: x.name, unit: x.unit || "", qty: +x.qty || 0, sug: 0, extra: true, xi: i, price: x.price > 0 ? +x.price : null, pack: 1, productId: x.productId || "" }));
  }
  const on = lines.filter((L) => L.qty > 0).sort((a, b) => (b.qty * (b.price || 0)) - (a.qty * (a.price || 0)) || a.name.localeCompare(b.name, "fr"));
  const total = on.reduce((a, L) => a + L.qty * (L.price || 0), 0);
  return { key: sup.key, name: sup.name, sup, cfg, next, lines, on, total: Math.round(total * 100) / 100, draft: dr, unpriced: on.some((L) => !(L.price > 0)) };
}
function acPlan() {
  const now = Date.now();
  return acSuppliers().map((s) => acPlanFor(s, now)).sort((a, b) => (b.on.length ? 1 : 0) - (a.on.length ? 1 : 0) || a.next.deadline - b.next.deadline || a.name.localeCompare(b.name, "fr"));
}
const acNoSup = () => S.products.filter((p) => !(p.supplier || "").trim());

/* ───────── text of an order (e-mail, SMS, WhatsApp, copy) ───────── */
function acText(pl, note) {
  const r = S.resto || {}; const me = S.me.name || "";
  const L = pl.on.map((x) => `- ${x.name} : ${acN(x.qty)} ${acU(x.qty, x.unit)}`).join("\n");
  return `Bonjour${pl.cfg.contact ? " " + pl.cfg.contact : ""},\n\nVoici notre commande pour une livraison ${acDayLong(pl.next.d1)} :\n\n${L}\n${note ? `\n${note}\n` : ""}\nMerci de nous confirmer.\n${me ? me + "\n" : ""}${r.name || ""}${r.resaCfg && r.resaCfg.address ? "\n" + r.resaCfg.address : ""}${r.resaCfg && r.resaCfg.phone ? "\n" + r.resaCfg.phone : ""}`;
}
const acPhoneIntl = (ph) => { let d = String(ph || "").replace(/[^\d+]/g, ""); if (d.startsWith("+")) return d.slice(1); if (d.startsWith("00")) return d.slice(2); if (d.startsWith("0")) return "33" + d.slice(1); return d; };

/* ───────── views ───────── */
function acWell(ic, c) { return `<span class="ac-well" style="--c:${c}">${ico(ic)}</span>`; }
function acSupMark(name, size = 44) { const c = acColor(acKey(name)); return `<span class="ac-mark" style="--c:${c};--s:${size}px">${esc(initials(name).replace(/[^\p{L}\p{N}]/gu, "") || "?")}</span>`; }
function acDeadlinePill(pl) {
  const ms = pl.next.deadline - Date.now(); const cls = ms < 3 * 3600e3 ? "hot" : ms < 20 * 3600e3 ? "warm" : "";
  const d = new Date(pl.next.deadline); const same = dayKey(d) === dayKey(); const tom = dayKey(d) === addDays(dayKey(), 1);
  return `<span class="ac-dl ${cls}" data-acdl="${pl.next.deadline}">${ico("clock")}<span>${ms < 20 * 3600e3 ? `Avant ${hm(pl.next.deadline)} · ${acLeft(ms)}` : `Avant ${same ? "" : tom ? "demain " : AC_DOW[d.getDay()] + " "}${hm(pl.next.deadline)}`}</span></span>`;
}
function acForecast(n = 7) {
  const today = dayKey(); const D = Array.from({ length: n }, (_, i) => { const k = addDays(today, i); return { k, ...acCovers(k) }; });
  const mx = Math.max(10, ...D.map((d) => d.n)); const tot = D.reduce((a, d) => a + d.n, 0), bk = D.reduce((a, d) => a + d.booked, 0);
  return { D, mx, tot, bk, html: `<div class="ac-fc">${D.map((d, i) => `<div class="ac-fcd${d.open ? "" : " off"}${i === 0 ? " now" : ""}" style="--j:${i}" title="${d.booked} réservés · ${d.n} attendus"><span class="ac-fcv mono">${d.open ? d.n : ""}</span><div class="ac-fcb"><i class="est" style="height:${(d.n / mx) * 100}%"></i><i class="bk" style="height:${(Math.min(d.booked, d.n || d.booked) / mx) * 100}%"></i></div><em>${i === 0 ? "auj." : AC_DOW[parseDay(d.k).getDay()].replace(".", "")}</em></div>`).join("")}</div>` };
}

VIEWS.achats = {
  render() {
    acWatch(); const plan = acPlan(); const todo = plan.filter((p) => p.on.length); const calm = plan.filter((p) => !p.on.length && p.sup.products.length);
    const money = acMoney(); const total = todo.reduce((a, p) => a + p.total, 0); const fc = acForecast(7);
    const sent = acOrders().filter((o) => o.status === "envoyee" || o.status === "recue").sort((a, b) => (b.sentAt || b.at) - (a.sentAt || a.at));
    const waiting = sent.filter((o) => o.status === "envoyee" && !acDelivery(o)); const done = sent.filter((o) => !waiting.includes(o)).slice(0, S.ui.acHist || 6);
    const first = todo[0]; const noSup = acNoSup();
    const known = S.products.some((p) => acStock(p) != null || acUsage(p).total > 0); const cold = !todo.length && !known && plan.length;
    const hero = `<div class="ac-hero wall st" style="--i:1">
      <div class="ac-hero-t"><span class="ac-hero-l">${ico("acBrain")}Préparé pour vous</span>${todo.length ? acDeadlinePill(first) : ""}</div>
      <div class="ac-hero-n">${todo.length ? (money ? `<b class="mono" data-count="${total}" data-eur="1">${acEur(total, 0)}</b><span>HT à commander</span>` : `<b class="mono">${todo.reduce((a, p) => a + p.on.length, 0)}</b><span>produits à commander</span>`) : `<b class="ac-hero-ok">${cold ? "Un inventaire, et c'est parti" : "Tout est en stock"}</b>`}</div>
      <p class="ac-hero-s">${todo.length ? `${todo.length} fournisseur${todo.length > 1 ? "s" : ""} · la première commande part chez <b>${esc(first.name)}</b> pour une livraison ${acDayLong(first.next.d1)}.` : cold ? "Comptez votre stock une fois et saisissez vos tickets Z : ensuite, les commandes se préparent toutes seules." : "Rien à commander pour l'instant : on vous prévient dès qu'un produit va manquer."}</p>
      ${cold ? `<button class="btn soft ac-hero-b" data-go="stock">${ico("acBox")}Faire l'inventaire</button>` : ""}
      ${fc.tot ? `<div class="ac-hero-fc"><div class="ac-hero-fh"><span>Couverts attendus · 7 jours</span><b class="mono">${fc.tot}</b></div>${fc.html}<div class="ac-leg"><span><i class="bk"></i>Réservés ${fc.bk}</span><span><i class="est"></i>Sans réservation, estimés ${Math.max(0, fc.tot - fc.bk)}</span></div></div>` : ""}
    </div>`;
    const cards = todo.map((pl, i) => {
      const prev = pl.on.slice(0, 4).map((L) => esc(L.name)).join(", ") + (pl.on.length > 4 ? ` +${pl.on.length - 4}` : "");
      const fr = pl.cfg.minHT && money ? Math.min(1, pl.total / pl.cfg.minHT) : null;
      return `<button class="glass ac-card st" style="--i:${i + 3}" data-act="acOpen" data-v="${esc(pl.key)}">
        <div class="ac-card-h">${acSupMark(pl.name)}<div class="tx"><b>${esc(pl.name)}</b><em>${ico("truck")}Livraison ${acDayLong(pl.next.d1)}</em></div>${money ? `<span class="ac-card-t mono">${acEur(pl.total, 0)}</span>` : ""}</div>
        <div class="ac-card-p"><span class="ac-cnt mono">${pl.on.length}</span><span class="ac-prev">${prev}</span></div>
        ${fr != null ? `<div class="ac-fr${fr >= 1 ? " ok" : ""}"><i style="width:${fr * 100}%"></i></div><span class="ac-frt">${fr >= 1 ? "Franco de port atteint" : `Encore ${acEur(pl.cfg.minHT - pl.total, 0)} pour le franco de port`}</span>` : ""}
        <div class="ac-card-f">${acDeadlinePill(pl)}${pl.draft ? `<span class="ac-tag">Modifiée</span>` : ""}<span class="ac-go">Vérifier et envoyer${ico("chev")}</span></div>
      </button>`;
    }).join("");
    const empty = !S.products.length ? `<div class="glass empty st" style="--i:3"><div class="ic">${ico("acBox")}</div><b>Ajoutez vos produits d'abord</b>Avec leur fournisseur et leur prix, Growth Gusto prépare vos commandes tout seul.<div style="margin-top:14px"><button class="btn acc" data-go="stock">Ouvrir le stock</button></div></div>`
      : !plan.length ? `<div class="glass empty st" style="--i:3"><div class="ic">${ico("truck")}</div><b>Indiquez le fournisseur de vos produits</b>Dans Stock › Catalogue, touchez un produit et choisissez son fournisseur.<div style="margin-top:14px"><button class="btn acc" data-act="acNoSupGo">Compléter le catalogue</button></div></div>` : "";
    const calmH = calm.length ? `<div class="glass pad st ac-calm" style="--i:${todo.length + 3}"><span class="lbl">Rien à commander</span>${calm.map((pl) => `<div class="li tap" data-act="acOpen" data-v="${esc(pl.key)}" role="button" tabindex="0">${acSupMark(pl.name, 34)}<div class="tx"><b>${esc(pl.name)}</b><em>${pl.lines.every((L) => L.stock == null && !L.u.total) ? "En attente d'un premier inventaire" : `Stock suffisant jusqu'à la livraison ${acDayLong(pl.next.d2)}`}</em></div>${ico("chev")}</div>`).join("")}</div>` : "";
    const ordRow = (o) => { const del = acDelivery(o); const miss = del ? acMissing(o, del) : []; const k = o.supKey || acKey(o.supplier);
      return `<div class="li tap ac-ord" data-act="acOrd" data-id="${o.id}" role="button" tabindex="0">${acSupMark(o.supplier, 36)}<div class="tx"><b>${esc(o.supplier)}</b><em>${del ? `Livrée ${when(del.at)}${miss.length ? ` · <span class="ac-miss">${miss.length} manquant${miss.length > 1 ? "s" : ""}</span>` : ""}` : `Envoyée ${when(o.sentAt || o.at)} · livraison ${acDayLong(o.deliveryDay)}`}</em></div>${del ? `<span class="ac-st ok">${ico("check")}</span>` : `<span class="ac-st wait"><i></i></span>`}${money && o.totalHT ? `<span class="mono ac-ordt">${acEur(o.totalHT, 0)}</span>` : ""}</div>`; };
    const waitH = waiting.length ? `<div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">En route</span><span class="sub">${waiting.length} commande${waiting.length > 1 ? "s" : ""}</span></div>${waiting.map(ordRow).join("")}<p class="note ac-wnote">Quand vous réceptionnez la livraison, Growth Gusto compare avec la commande.</p></div>` : "";
    const histH = done.length ? `<div class="glass pad st" style="--i:4"><span class="lbl">Dernières commandes</span>${done.map(ordRow).join("")}${sent.length - waiting.length > done.length ? `<button class="btn ghost sm block" data-act="acMore">Voir plus</button>` : ""}</div>` : "";
    const how = `<div class="glass pad st ac-how" style="--i:5"><span class="lbl">Comment c'est calculé</span><ol>
      <li><span>1</span><div><b>Les couverts à venir</b><em>Vos réservations, plus les clients sans réservation que vous avez d'habitude ce jour-là.</em></div></li>
      <li><span>2</span><div><b>Ce que consomme un couvert</b><em>D'après vos tickets Z, vos recettes et vos livraisons des 4 dernières semaines.</em></div></li>
      <li><span>3</span><div><b>Jusqu'à la livraison suivante</b><em>Moins votre stock et ce qui est déjà commandé, arrondi au colis. Les produits souvent jetés sont commandés au plus juste.</em></div></li></ol></div>`;
    const nsH = noSup.length && plan.length ? `<button class="glass pad st ac-nosup" style="--i:6" data-act="acNoSupGo"><span class="ic warn">${ico("alert")}</span><span class="tx"><b>${noSup.length} produit${noSup.length > 1 ? "s" : ""} sans fournisseur</b><em>${esc(noSup.slice(0, 3).map((p) => p.name).join(", "))}${noSup.length > 3 ? "…" : ""} : ils ne sont dans aucune commande.</em></span>${ico("chev")}</button>` : "";
    return `<div class="inner ac">${topBar("Commandes fournisseurs", { right: `<button class="iconbtn" data-act="acSupList" aria-label="Fournisseurs">${ico("truck")}</button>` })}
      <div class="cols"><div>${hero}${empty}${todo.length ? `<div class="lbl st ac-sec" style="--i:2">À envoyer</div>` : ""}${cards}${calmH}${nsH}</div>
      <div>${waitH}${histH}${how}</div></div></div>`;
  },
  after(v) { acAnimate(v); acTicker(); },
};

/* missing or short lines of a delivered order */
function acMissing(o, rec) {
  const got = {}; (rec.lines || []).forEach((L) => { if (L.refused) return; const k = L.productId || acKey(L.name); got[k] = (got[k] || 0) + (num(L.qty) || 0); });
  return (o.lines || []).filter((L) => { const g = got[L.productId || acKey(L.name)] || got[acKey(L.name)] || 0; return g + 1e-9 < (+L.qty || 0) * 0.95; }).map((L) => ({ ...L, got: got[L.productId || acKey(L.name)] || got[acKey(L.name)] || 0 }));
}

/* one supplier: the proposed order, line by line */
VIEWS.achat = {
  nav: "achats",
  render(P) {
    acWatch(); const sup = acSupOf(P.k);
    if (!sup) return `<div class="inner narrow">${topBar("Commande")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("truck")}</div><b>Fournisseur introuvable</b><div style="margin-top:14px"><button class="btn acc" data-go="achats">Retour aux commandes</button></div></div></div>`;
    const pl = acPlanFor(sup); const money = acMoney(); const lines = pl.lines.filter((L) => L.qty > 0 || L.edited || L.removed || L.extra || L.low).sort((a, b) => (b.qty > 0) - (a.qty > 0) || a.name.localeCompare(b.name, "fr"));
    const rest = pl.lines.filter((L) => !lines.includes(L)); const open = S.ui.acLine;
    const row = (L, i) => {
      const id = L.extra ? "x" + L.xi : L.productId; const on = L.qty > 0; const sx = open === id;
      const why = L.extra ? "Ajouté à la main" : L.removed ? "Retiré de cette commande" : acWhy(L, pl);
      return `<div class="ac-line${on ? "" : " off"}${sx ? " open" : ""} st" style="--i:${Math.min(i + 3, 14)}" data-line="${esc(id)}">
        <button class="ac-lx" data-act="acLine" data-v="${esc(id)}" aria-expanded="${sx}"><span class="tx"><b>${esc(L.name)}${L.edited ? `<i class="ac-ed">modifié</i>` : ""}</b><em>${why}</em></span></button>
        <span class="mono ac-lt">${money && L.price > 0 && on ? acEur(L.qty * L.price) : ""}</span>
        <div class="ac-step"><button class="ac-sb" data-act="acQty" data-v="${esc(id)}" data-d="-1" aria-label="Moins">${ico("minus")}</button><span class="ac-sq mono"><b>${acN(L.qty)}</b><small>${esc(acU(L.qty, L.unit))}</small></span><button class="ac-sb" data-act="acQty" data-v="${esc(id)}" data-d="1" aria-label="Plus">${ico("plus")}</button></div>
        ${sx && !L.extra ? acDetail(L, pl) : ""}
      </div>`;
    };
    const fr = pl.cfg.minHT && money ? Math.min(1, pl.total / pl.cfg.minHT) : null;
    const head = `<div class="glass ac-sh st" style="--i:1">${acSupMark(pl.name, 52)}<div class="tx"><b>Livraison ${acDayLong(pl.next.d1)}</b><em>${pl.cfg.daysFrom === "set" ? "Jours de livraison" : pl.cfg.daysFrom === "learnt" ? "Jours appris de vos réceptions" : "Jours de livraison à confirmer"} : ${AC_WEEK.filter((w) => pl.cfg.days.includes(w)).map((w) => AC_DOW[w].replace(".", "")).join(", ")}</em><div class="ac-sh-p">${acDeadlinePill(pl)}</div></div><button class="iconbtn" data-act="acSupEdit" data-v="${esc(pl.key)}" aria-label="Réglages du fournisseur">${ico("sliders")}</button></div>`;
    const tot = `<div class="glass pad ac-tot st" style="--i:2"><div><span class="lbl">Total</span><b class="mono">${money ? acEur(pl.total) : pl.on.length}</b><em>${money ? `HT · ${pl.on.length} produit${pl.on.length > 1 ? "s" : ""}${pl.unpriced ? " · prix manquants" : ""}` : "produits"}</em></div>${fr != null ? `<div class="ac-totf"><div class="ac-fr${fr >= 1 ? " ok" : ""}"><i style="width:${fr * 100}%"></i></div><span class="ac-frt">${fr >= 1 ? "Franco atteint" : `Franco : encore ${acEur(pl.cfg.minHT - pl.total, 0)}`}</span></div>` : ""}</div>`;
    const note = `<label class="field ac-note st" style="--i:${Math.min(lines.length + 4, 15)}"><span>Message au fournisseur <em class="ac-opt">facultatif</em></span><textarea class="input" id="acNote" rows="2" placeholder="Ex. : livrer avant 10 h, merci">${esc(S.ui.acNote && S.ui.acNote.k === pl.key ? S.ui.acNote.v : "")}</textarea></label>`;
    return `<div class="inner narrow ac">${topBar(esc(pl.name), { right: pl.draft ? `<button class="btn ghost sm" data-act="acReset" data-v="${esc(pl.key)}">Recalculer</button>` : "" })}
      ${head}${tot}
      <div class="glass ac-lines st" style="--i:3">${lines.length ? lines.map(row).join("") : `<div class="ac-none">${ico("acDone")}<b>Rien à commander</b><em>Le stock suffit jusqu'à la livraison ${acDayLong(pl.next.d2)}.</em></div>`}
        <button class="ac-add" data-act="acAdd" data-v="${esc(pl.key)}">${ico("plus")}Ajouter un produit</button></div>
      ${rest.length ? `<details class="glass pad ac-rest st" style="--i:4"><summary><span class="lbl">Aussi chez ${esc(pl.name)}</span><span class="sub">${rest.length} produit${rest.length > 1 ? "s" : ""} en stock suffisant</span>${ico("down")}</summary>${rest.map((L) => `<div class="li"><div class="tx"><b>${esc(L.name)}</b><em>${acWhy(L, pl)}</em></div><button class="btn soft sm" data-act="acQty" data-v="${esc(L.productId)}" data-d="1">${ico("plus")}${acN(L.pack)} ${esc(acU(L.pack, L.unit))}</button></div>`).join("")}</details>` : ""}
      ${note}
      <div class="ctabar ac-cta"><button class="btn acc block" data-act="acSendAsk" data-v="${esc(pl.key)}" ${pl.on.length ? "" : "disabled"}>${ico("acSend")}Envoyer la commande</button></div>
    </div>`;
  },
  after(v) { acTicker(); const t = $("#acNote", v); if (t) t.addEventListener("input", () => { S.ui.acNote = { k: S.params.k, v: t.value }; }); },
};
function acWhy(L, pl) {
  if (L.stock == null && !L.u.total) return "Pas encore d'historique : faites un inventaire";
  const parts = [];
  parts.push(L.stock == null ? "Stock inconnu" : `En stock ${acQty(Math.max(0, L.stock), L.unit)}`);
  if (L.u.total) parts.push(`besoin ${acQty(L.need, L.unit)} d'ici ${acDay(pl.next.d2)}`);
  if (L.pend) parts.push(`déjà commandé ${acQty(L.pend, L.unit)}`);
  return parts.join(" · ");
}
/* small amounts read better in grams or centilitres */
const acSmall = (n, u) => (u === "kg" && n < 0.1 ? `${Math.max(1, Math.round(n * 1000))} g` : u === "L" && n < 0.1 ? `${Math.max(1, Math.round(n * 100))} cl` : AC_WHOLE.test(String(u || "")) && n < 1 ? `${acN(Math.round(n * 100) / 100)} ${esc(u)}` : acQty(n, u));
function acDetail(L, pl) {
  const src = { ventes: "les ventes du ticket Z et les recettes utilisées", recettes: "les plats vendus × leurs recettes", livraisons: "ce qui a été livré" }[L.u.src] || "";
  const money = acMoney();
  return `<div class="ac-det">
    <div class="ac-kv">
      <div><span>Couverts d'ici ${acDay(pl.next.d2)}</span><b class="mono">${L.covers}</b></div>
      <div><span>${L.u.perCover != null ? "Par couvert" : "Par jour"}</span><b class="mono">${acSmall(L.u.perCover != null ? L.u.perCover : L.u.perDay, L.unit)}</b></div>
      <div><span>Marge de sécurité</span><b class="mono">${acQty(Math.round(L.safety * 100) / 100, L.unit)}</b></div>
      <div><span>Vendu par</span><b class="mono"><button class="ac-pack" data-act="acPack" data-v="${esc(L.productId)}">${acQty(L.pack, L.unit)}${ico("edit")}</button></b></div>
      ${money ? `<div><span>Prix</span><b class="mono">${L.price > 0 ? `${acEur(L.price)}<small>/${esc(L.unit)}</small>` : "?"}</b></div>` : ""}
      <div><span>Proposé</span><b class="mono">${acQty(L.sug, L.unit)}</b></div>
    </div>
    ${src ? `<p class="ac-src">${ico("acBrain")}Calculé d'après ${src} des 4 dernières semaines.</p>` : ""}
    ${L.wasteHigh ? `<p class="ac-src warn">${ico("trash")}${acQty(Math.round(L.u.waste * 100) / 100, L.unit)} jetés en 4 semaines : on commande au plus juste.</p>` : ""}
  </div>`;
}

/* a sent (or delivered) order */
function acOrderSheet(o) {
  const del = acDelivery(o); const miss = del ? acMissing(o, del) : []; const money = acMoney(); const k = o.supKey || acKey(o.supplier);
  return `<div class="ac-os">
    <div class="ac-os-h">${acSupMark(o.supplier, 48)}<div><b class="h3">${esc(o.supplier)}</b><em>${del ? `Livrée ${when(del.at)}` : o.status === "annulee" ? "Annulée" : `Envoyée ${when(o.sentAt || o.at)}${o.channel ? ` par ${{ email: "e-mail", sms: "SMS", whatsapp: "WhatsApp", copie: "message", print: "bon imprimé" }[o.channel] || o.channel}` : ""}`}</em></div></div>
    <div class="ac-tl">${[["Commandée", true, when(o.sentAt || o.at)], ["Livraison prévue", !!del || daysUntil(o.deliveryDay) <= 0, acDayLong(o.deliveryDay)], ["Réceptionnée", !!del, del ? when(del.at) : ""]].map(([t, ok, s]) => `<div class="${ok ? "on" : ""}"><i></i><b>${t}</b><em>${s}</em></div>`).join("")}</div>
    ${miss.length ? `<div class="ac-misbox">${ico("alert")}<div><b>${miss.length} produit${miss.length > 1 ? "s" : ""} pas livré${miss.length > 1 ? "s" : ""} en entier</b>${miss.map((L) => `<em>${esc(L.name)} : ${acQty(L.got, L.unit)} reçu${L.got > 1 ? "s" : ""} sur ${acQty(L.qty, L.unit)}</em>`).join("")}</div></div>` : ""}
    <div class="ac-osl">${(o.lines || []).map((L) => `<div class="li"><div class="tx"><b>${esc(L.name)}</b></div><span class="mono">${acQty(L.qty, L.unit)}</span>${money && L.price > 0 ? `<span class="mono ac-lt">${acEur(L.qty * L.price)}</span>` : ""}</div>`).join("")}</div>
    ${money && o.totalHT ? `<div class="row ac-ost"><span>Total HT</span><b class="mono">${acEur(o.totalHT)}</b></div>` : ""}
    ${!del && o.status === "envoyee" ? `<button class="btn acc block" data-act="acRecv" data-id="${o.id}">${ico("truck")}Réceptionner la livraison</button><div class="grid2"><button class="btn soft" data-act="acResend" data-id="${o.id}">${ico("acSend")}Renvoyer</button><button class="btn soft" data-act="acCancel" data-id="${o.id}">${ico("x")}Annuler</button></div>`
      : `<button class="btn soft block" data-act="acAgain" data-id="${o.id}">${ico("acCopy")}Recommander la même chose</button>`}
  </div>`;
}

/* supplier settings sheet */
function acSupSheet(k) {
  const sup = acSupOf(k) || { key: k, name: S.ui.acSupNew || "", doc: null, products: [] }; const c = acCfg(sup); const F = (S.ui.acSF ||= { k, days: c.days.slice(), lead: c.lead, ch: c.channel });
  return `<div class="ac-sf">
    <div class="ac-os-h">${acSupMark(sup.name || "?", 48)}<div><b class="h3">${esc(sup.name || "Nouveau fournisseur")}</b><em>${sup.products.length ? `${sup.products.length} produit${sup.products.length > 1 ? "s" : ""}` : "Fournisseur"}</em></div></div>
    ${sup.name ? "" : `<label class="field"><span>Nom</span><input class="input" id="acSName" placeholder="Ex. : Metro" autocomplete="off"></label>`}
    <div class="field"><span>Jours de livraison</span><div class="ac-days">${AC_WEEK.map((w) => `<button class="ac-day${F.days.includes(w) ? " on" : ""}" data-act="acSDay" data-v="${w}" aria-pressed="${F.days.includes(w)}">${AC_DL[w]}</button>`).join("")}</div>${c.daysFrom === "learnt" && !sup.doc?.deliveryDays ? `<em class="ac-hint">${ico("acBrain")}Déduits de vos dernières réceptions</em>` : ""}</div>
    <div class="grid2"><label class="field"><span>Commander avant</span><input class="input mono" id="acSCut" type="time" value="${esc(c.cutoff)}"></label>
      <div class="field"><span>Délai</span><div class="seg ac-seg">${[[0, "Jour même"], [1, "La veille"], [2, "2 jours"]].map(([v, t]) => `<button class="${F.lead === v ? "on" : ""}" data-act="acSLead" data-v="${v}">${t}</button>`).join("")}</div></div></div>
    <div class="grid2"><label class="field"><span>E-mail</span><input class="input" id="acSMail" type="email" inputmode="email" value="${esc(c.email)}" placeholder="commandes@…" autocomplete="off"></label>
      <label class="field"><span>Téléphone</span><input class="input mono" id="acSPh" type="tel" inputmode="tel" value="${esc(c.phone)}" placeholder="06…" autocomplete="off"></label></div>
    <div class="grid2"><label class="field"><span>Contact <em class="ac-opt">prénom</em></span><input class="input" id="acSCt" value="${esc(c.contact)}" placeholder="Ex. : Julien" autocomplete="off"></label>
      ${acMoney() ? `<label class="field"><span>Franco de port <em class="ac-opt">€ HT</em></span><input class="input mono" id="acSMin" inputmode="decimal" value="${c.minHT ? acN(c.minHT) : ""}" placeholder="Aucun"></label>` : ""}</div>
    <button class="btn acc block" data-act="acSupSave" data-v="${esc(k)}">Enregistrer</button>
  </div>`;
}

/* ───────── motion: count-up on the hero number, live countdowns ───────── */
function acAnimate(v) {
  if (v.classList.contains("nost")) return; const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$("[data-count]", v).forEach((el) => {
    const to = +el.dataset.count; if (!(to > 0) || reduce) return; const eur = el.dataset.eur; const t0 = performance.now(), d = 900;
    const f = (t) => { const x = Math.min(1, (t - t0) / d); const e = 1 - Math.pow(1 - x, 4); el.textContent = eur ? acEur(to * e, 0) : String(Math.round(to * e)); if (x < 1 && el.isConnected) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}
function acTicker() {
  if (AC.tick) return;
  AC.tick = setInterval(() => {
    const els = $$("[data-acdl]"); if (!els.length) { clearInterval(AC.tick); AC.tick = null; return; }
    els.forEach((el) => { const dl = +el.dataset.acdl, ms = dl - Date.now(); if (ms >= 20 * 3600e3) return; const s = $("span", el); if (s) s.textContent = ms > 0 ? `Avant ${hm(dl)} · ${acLeft(ms)}` : "Délai dépassé"; el.classList.toggle("hot", ms < 3 * 3600e3); el.classList.toggle("warm", ms >= 3 * 3600e3); });
  }, 30000);
}

/* ───────── drafts: what the person changed on a proposed order ───────── */
async function acDraftPatch(k, fn) {
  const sup = acSupOf(k); if (!sup) return; const cur = acDraft(k) || { edits: {}, extra: [], removed: [] };
  const d = { edits: { ...(cur.edits || {}) }, extra: (cur.extra || []).map((x) => ({ ...x })), removed: (cur.removed || []).slice() }; fn(d);
  const empty = !Object.keys(d.edits).length && !d.extra.length && !d.removed.length;
  if (empty) { if (acDraft(k)) await DB.del("orders", "br-" + k).catch(() => {}); return; }
  await safe(DB.set("orders", "br-" + k, { supplier: sup.name, supKey: k, ...(sup.doc ? { supplierId: sup.doc.id } : {}), status: "brouillon", ...d, at: Date.now(), uid: S.me.id, by: S.me.name || "" })).catch(() => {});
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  acOpen: (a, id, v) => { SFX.tap(); S.ui.acLine = null; go("achat", { k: v }); },
  acLine: (a, id, v) => { SFX.tick(); S.ui.acLine = S.ui.acLine === v ? null : v; refresh(true); },
  acQty: async (a, id, v) => {
    const k = S.params.k; const pl = acPlanFor(acSupOf(k)); const d = +a.dataset.d;
    const L = v.startsWith("x") ? pl.lines.find((x) => x.extra && "x" + x.xi === v) : pl.lines.find((x) => x.productId === v); if (!L) return;
    const step = L.pack || 1; const q = Math.max(0, Math.round((L.qty + d * step) * 1000) / 1000);
    SFX[d > 0 ? "tick" : "tap"](); buzz(3);
    const box = a.closest(".ac-line"); if (box) { const b = $(".ac-sq b", box); if (b) { b.textContent = acN(q); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } }
    await acDraftPatch(k, (D) => {
      if (L.extra) { if (q <= 0) D.extra.splice(L.xi, 1); else D.extra[L.xi].qty = q; return; }
      D.removed = D.removed.filter((x) => x !== L.productId);
      if (Math.abs(q - L.sug) < 1e-9) delete D.edits[L.productId]; else D.edits[L.productId] = q;
    });
  },
  acReset: async (a, id, v) => { SFX.tap(); await DB.del("orders", "br-" + v).catch(() => {}); toast("Commande recalculée"); },
  acAdd: (a, id, v) => {
    SFX.tap(); const sup = acSupOf(v); S.ui.acAddQ = "";
    const list = (q) => { const n = acKey(q); const mine = new Set(sup.products.map((p) => p.id)); return S.products.filter((p) => !n || acKey(p.name).includes(n)).sort((x, y) => (mine.has(y.id) ? 1 : 0) - (mine.has(x.id) ? 1 : 0) || x.name.localeCompare(y.name, "fr")).slice(0, 12); };
    const items = (q) => list(q).map((p) => `<div class="li tap" data-act="acAddPick" data-id="${p.id}" data-v="${esc(v)}" role="button" tabindex="0"><div class="tx"><b>${esc(p.name)}</b><em>${esc(p.unit)}${p.supplier ? ` · ${esc(p.supplier)}` : ""}</em></div>${ico("plus")}</div>`).join("") + (q && !list(q).some((p) => acKey(p.name) === acKey(q)) ? `<div class="li tap" data-act="acAddFree" data-v="${esc(v)}" role="button" tabindex="0"><span class="ic">${ico("plus")}</span><div class="tx"><b>« ${esc(q)} »</b><em>Produit hors catalogue</em></div></div>` : "");
    openSheet(`<div class="ac-addsh"><div class="h2" style="font-size:21px">Ajouter un produit</div><label class="field"><input class="input" id="acAddQ" type="search" placeholder="Chercher…" autocomplete="off"></label><div id="acAddL">${items("")}</div></div>`, (b) => {
      const q = $("#acAddQ", b); q.addEventListener("input", () => { S.ui.acAddQ = q.value; $("#acAddL", b).innerHTML = items(q.value.trim()); });
    });
  },
  acAddPick: async (a, id, v) => {
    const p = S.products.find((x) => x.id === id); if (!p) return; closeSheet(); SFX.ok();
    const pl = acPlanFor(acSupOf(v)); const L = pl.lines.find((x) => x.productId === id);
    if (L) { const q = Math.max(L.qty, 0) + L.pack; await acDraftPatch(v, (D) => { D.removed = D.removed.filter((x) => x !== id); D.edits[id] = q; }); }
    else await acDraftPatch(v, (D) => { D.extra.push({ productId: p.id, name: p.name, unit: p.unit, qty: acPack(p), price: acPrice(p) || null }); });
    toast(`${p.name} ajouté`);
  },
  acAddFree: async (a, id, v) => { const n = (S.ui.acAddQ || "").trim(); if (!n) return; closeSheet(); SFX.ok(); await acDraftPatch(v, (D) => { D.extra.push({ name: n, unit: "colis", qty: 1 }); }); toast(`${n} ajouté`); },
  acPack: (a, id, v) => {
    const p = S.products.find((x) => x.id === v); if (!p) return; SFX.tap();
    openSheet(`<div class="ac-addsh"><div class="h2" style="font-size:21px">${esc(p.name)}</div><p class="sub" style="margin:-4px 0 4px">Le fournisseur le vend par combien ? La commande sera toujours un multiple.</p>
      <label class="field"><span>Colisage</span><div class="stk-inu"><input class="input mono" id="acPackV" inputmode="decimal" value="${acN(acPack(p))}"><span>${esc(p.unit)}</span></div></label>
      <button class="btn acc block" data-act="acPackSave" data-v="${esc(v)}">Enregistrer</button></div>`, (b) => setTimeout(() => { const i = $("#acPackV", b); i && i.select(); }, 300));
  },
  acPackSave: async (a, id, v) => { const n = num(($("#acPackV") || {}).value); if (!(n > 0)) return; await safe(DB.update("products", v, { pack: n })).catch(() => {}); closeSheet(); SFX.ok(); toast("Colisage enregistré"); },
  acSendAsk: (a, id, v) => {
    const pl = acPlanFor(acSupOf(v)); if (!pl.on.length) return; SFX.tap(); const c = pl.cfg;
    const opt = (k, ic, t, s, ok = true) => `<button class="ac-ch${c.channel === k ? " pref" : ""}" data-act="acSend" data-v="${esc(v)}" data-ch="${k}" ${ok ? "" : "disabled"}><span class="ac-chi ${k}">${ico(ic)}</span><span class="tx"><b>${t}</b><em>${s}</em></span>${ico("chev")}</button>`;
    openSheet(`<div class="ac-send"><div class="h2" style="font-size:21px">Envoyer à ${esc(pl.name)}</div><p class="sub" style="margin:-4px 0 8px">${pl.on.length} produit${pl.on.length > 1 ? "s" : ""}${acMoney() ? ` · ${acEur(pl.total)} HT` : ""} · livraison ${acDayLong(pl.next.d1)}</p>
      ${opt("email", "acMail", "Par e-mail", c.email || "Ajoutez l'adresse dans les réglages", true)}
      ${opt("sms", "acSms", "Par SMS", c.phone || "Ajoutez le numéro dans les réglages", true)}
      ${opt("whatsapp", "acWa", "Par WhatsApp", c.phone || "Ajoutez le numéro dans les réglages", true)}
      ${opt("copie", "acCopy", "Copier le texte", "À coller où vous voulez")}
      ${opt("print", "acPrint", "Bon de commande PDF", "À imprimer ou à partager")}</div>`);
  },
  acSend: async (a, id, v) => {
    const sup = acSupOf(v); const pl = acPlanFor(sup); if (!pl.on.length) return; const ch = a.dataset.ch; const note = S.ui.acNote && S.ui.acNote.k === v ? S.ui.acNote.v.trim() : "";
    const txt = acText(pl, note); const subj = `Commande ${S.resto ? S.resto.name : ""} · livraison ${acDayLong(pl.next.d1)}`;
    if (ch === "email") location.href = `mailto:${encodeURIComponent(pl.cfg.email)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(txt)}`;
    else if (ch === "sms") location.href = `sms:${(pl.cfg.phone || "").replace(/\s/g, "")}${IS_IOS ? "&" : "?"}body=${encodeURIComponent(txt)}`;
    else if (ch === "whatsapp") window.open(`https://wa.me/${pl.cfg.phone ? acPhoneIntl(pl.cfg.phone) : ""}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
    else if (ch === "copie") { try { await navigator.clipboard.writeText(txt); } catch (e) { const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (x) {} t.remove(); } }
    else if (ch === "print") acPrintOrder(pl, note);
    const doc = { supplier: pl.name, supKey: pl.key, ...(sup.doc ? { supplierId: sup.doc.id } : {}), status: "envoyee", lines: pl.on.map((L) => ({ ...(L.productId ? { productId: L.productId } : {}), name: L.name, qty: L.qty, unit: L.unit, price: L.price > 0 ? L.price : null, sug: L.sug })), totalHT: pl.total, deliveryDay: pl.next.d1, deadline: pl.next.deadline, ...(note ? { note } : {}), channel: ch, sentAt: Date.now(), at: Date.now(), uid: S.me.id, by: S.me.name || "", auto: true };
    let oid; try { oid = await safe(DB.add("orders", doc)); } catch (e) { return; }
    if (pl.draft) DB.del("orders", "br-" + pl.key).catch(() => {});
    logEvent("order", `a commandé chez ${pl.name} (${pl.on.length} produit${pl.on.length > 1 ? "s" : ""}${acMoney() ? `, ${acEur(pl.total, 0)} HT` : ""})`, { ref: oid });
    S.ui.acNote = null; closeSheet(true); SFX.done(); buzz([8, 40, 12]); burst();
    toast(ch === "copie" ? "Texte copié, commande notée" : "Commande envoyée"); setTimeout(() => go("achats", {}, { replace: true }), 500);
  },
  acOrd: (a, id) => { const o = acOrders().find((x) => x.id === id); if (!o) return; SFX.tap(); openSheet(acOrderSheet(o)); },
  acRecv: (a, id) => {
    const o = acOrders().find((x) => x.id === id); if (!o) return; closeSheet(true); SFX.tap();
    go("reception", { fresh: true }); try { if (S.rec && !(S.rec.lines || []).length) { S.rec.supplier = o.supplier; S.rec.orderId = o.id; refresh(true); } } catch (e) {}
  },
  acResend: (a, id) => { const o = acOrders().find((x) => x.id === id); if (!o) return; closeSheet(true); go("achat", { k: o.supKey || acKey(o.supplier) }); },
  acCancel: async (a, id) => { if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Confirmer"; SFX.tap(); return; } await safe(DB.update("orders", id, { status: "annulee", cancelledAt: Date.now() })).catch(() => {}); closeSheet(); toast("Commande annulée"); },
  acAgain: async (a, id) => {
    const o = acOrders().find((x) => x.id === id); if (!o) return; const k = o.supKey || acKey(o.supplier); closeSheet(true);
    await acDraftPatch(k, (D) => { D.edits = {}; D.extra = []; (o.lines || []).forEach((L) => { if (L.productId && S.products.some((p) => p.id === L.productId && acKey(p.supplier) === k)) D.edits[L.productId] = +L.qty; else D.extra.push({ ...L }); }); D.removed = []; });
    go("achat", { k });
  },
  acMore: () => { S.ui.acHist = (S.ui.acHist || 6) + 10; refresh(true); },
  acNoSupGo: () => { SFX.tap(); S.stockTab = "cat"; go("stock"); },
  acSupList: () => {
    SFX.tap(); const L = acSuppliers().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    openSheet(`<div class="ac-addsh"><div class="h2" style="font-size:21px">Fournisseurs</div><p class="sub" style="margin:-4px 0 6px">Jours de livraison, heure limite et coordonnées : la commande part au bon moment.</p>
      ${L.map((s) => { const c = acCfg(s); return `<div class="li tap" data-act="acSupEdit" data-v="${esc(s.key)}" role="button" tabindex="0">${acSupMark(s.name, 36)}<div class="tx"><b>${esc(s.name)}</b><em>${AC_WEEK.filter((w) => c.days.includes(w)).map((w) => AC_DL[w]).join(" ")} · avant ${c.cutoff}${c.email || c.phone ? "" : " · coordonnées manquantes"}</em></div>${ico("chev")}</div>`; }).join("") || `<p class="note">Aucun fournisseur pour l'instant.</p>`}
      <button class="btn soft block" data-act="acSupEdit" data-v="">${ico("plus")}Nouveau fournisseur</button></div>`);
  },
  acSupEdit: (a, id, v) => { SFX.tap(); S.ui.acSF = null; openSheet(acSupSheet(v || "")); },
  acSDay: (a, id, v) => { const F = S.ui.acSF; if (!F) return; const w = +v; F.days = F.days.includes(w) ? F.days.filter((x) => x !== w) : [...F.days, w].sort(); a.classList.toggle("on"); a.setAttribute("aria-pressed", F.days.includes(w)); a.classList.remove("bump"); void a.offsetWidth; a.classList.add("bump"); SFX.tick(); buzz(3); },
  acSLead: (a, id, v) => { const F = S.ui.acSF; if (!F) return; F.lead = +v; $$(".ac-seg button").forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); },
  acSupSave: async (a, id, v) => {
    const F = S.ui.acSF; if (!F) return; const sup = v ? acSupOf(v) : null; const name = sup ? sup.name : (($("#acSName") || {}).value || "").trim();
    if (!name) { const e = $("#acSName"); if (e) { e.focus(); SFX.err(); } return; }
    if (!F.days.length) { SFX.err(); toast("Choisissez au moins un jour de livraison.", "err"); return; }
    const val = (s) => (($(s) || {}).value || "").trim();
    const d = { name, deliveryDays: F.days, cutoff: val("#acSCut") || "18:00", leadDays: F.lead, email: val("#acSMail"), phone: val("#acSPh"), contact: val("#acSCt"), updatedAt: Date.now() };
    const mn = $("#acSMin") ? num(val("#acSMin")) : undefined; if (mn !== undefined) d.minOrderHT = mn > 0 ? mn : null;
    a.disabled = true;
    try { if (sup && sup.doc) await safe(DB.update("suppliers", sup.doc.id, d)); else await safe(DB.add("suppliers", { ...d, createdAt: Date.now() })); } catch (e) { a.disabled = false; return; }
    S.ui.acSF = null; closeSheet(); SFX.ok(); toast(`${name} enregistré`);
  },
});

/* Stock › « À commander » opens the prepared orders (stock.js keeps its own sheet for products under their threshold) */
(function acHook() {
  const old = ACT.stkLowOpen; ACT.stkLowOpen = (...x) => { if (S.products.some((p) => (p.supplier || "").trim())) { SFX.tap(); go("achats"); } else if (old) old(...x); };
})();

/* the reception linked to an order: once saved, the order is « reçue » (the reception flow is js/reception.js; we only listen) */
let acRecSeen = null;
function acLinkReceptions() {
  if (!S.receptions.length || acRecSeen === S.receptions) return; acRecSeen = S.receptions; if (!AC.ord) return;
  AC.ord.filter((o) => o.status === "envoyee").forEach((o) => { const r = acDelivery(o); if (r && r.id && Date.now() - r.at < 864e5 * 3) DB.update("orders", o.id, { status: "recue", receivedAt: r.at, receptionId: r.id }).catch(() => {}); });
}
window.addEventListener("gg:ready", () => { setInterval(() => { try { if (S.rid && AC.rid === S.rid) acLinkReceptions(); } catch (e) {} }, 15000); });

/* printable purchase order (PDF through the system print dialog) */
function acPrintOrder(pl, note) {
  const r = S.resto || {}; const money = acMoney(); const now = new Date();
  const rows = pl.on.map((L) => `<tr><td>${esc(L.name)}</td><td class="n">${acN(L.qty)} ${esc(acU(L.qty, L.unit))}</td>${money ? `<td class="n">${L.price > 0 ? acEur(L.price) : ""}</td><td class="n">${L.price > 0 ? acEur(L.qty * L.price) : ""}</td>` : ""}</tr>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon de commande · ${esc(pl.name)}</title><style>
    @page{margin:16mm}body{font:14px/1.45 -apple-system,"Segoe UI",system-ui,sans-serif;color:#1B1530;margin:0}
    .h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5B2BFF;padding-bottom:14px;margin-bottom:18px}
    h1{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}.m{color:#615B74;font-size:13px}.b{font-weight:700}
    table{width:100%;border-collapse:collapse;margin-top:8px}th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#615B74;border-bottom:1.5px solid #E9DFCD;padding:8px 6px}
    td{padding:10px 6px;border-bottom:1px solid #F1E9DA}.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    .t{margin-top:14px;text-align:right;font-size:17px;font-weight:800}.note{margin-top:18px;padding:12px 14px;background:#F4EDE0;border-radius:10px}
    .f{margin-top:30px;color:#615B74;font-size:11.5px}</style></head><body>
    <div class="h"><div><h1>Bon de commande</h1><div class="m">${esc(r.name || "")}${r.resaCfg && r.resaCfg.address ? "<br>" + esc(r.resaCfg.address) : ""}${r.resaCfg && r.resaCfg.phone ? "<br>" + esc(r.resaCfg.phone) : ""}</div></div>
    <div style="text-align:right"><div class="b">${esc(pl.name)}</div><div class="m">Le ${now.toLocaleDateString("fr-FR")}<br>Livraison souhaitée : <span class="b">${esc(acDayLong(pl.next.d1))}</span></div></div></div>
    <table><thead><tr><th>Produit</th><th class="n">Quantité</th>${money ? `<th class="n">Prix HT</th><th class="n">Total HT</th>` : ""}</tr></thead><tbody>${rows}</tbody></table>
    ${money && pl.total ? `<div class="t">Total HT : ${acEur(pl.total)}</div>` : ""}${note ? `<div class="note">${esc(note)}</div>` : ""}
    <div class="f">Commande préparée avec Growth Gusto${S.me.name ? " · " + esc(S.me.name) : ""}</div></body></html>`;
  const f = document.createElement("iframe"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
  const d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 250);
}

/* menu Plus (compte.js): add « Commandes » next to Stock, without touching compte.js */
(function acMore() {
  const inject = (groups) => groups.map(([g, its, ...r]) => { if (!its.some((x) => x[0] === "stock") || its.some((x) => x[0] === "achats")) return [g, its, ...r]; const i = its.findIndex((x) => x[0] === "stock"); const o = its.slice(); o.splice(i + 1, 0, ["achats", "acCart", "Achats", 0]); return [g, o, ...r]; });
  const prev = typeof pzMoreGroups === "function" ? pzMoreGroups : null;
  window.pzMoreGroups = function (groups) { const g = inject(groups); return prev ? prev(g) : g; };
})();
