/* Growth Gusto — area: tickets (tickets Z : ventes du jour → consommation théorique, déduction du stock, chiffres pour la finance)
   Modèle :
   - tickets/{id} = { date, total (TTC), ht?, vat?:[{rate,ttc,ht,tva}], covers?, lines:[{libelle,quantite,montant?,noteId?}] (ticket complet, fusionné),
                      parts?:[{lines:[…, keep?], picIdx:[…]}] (ticket saisi en plusieurs photos/pages), photos?, photoIds?, photoUrls?, stockOff?, at, uid, updatedAt }
   - tkLinks/{k_…} = { key, label, productId, factor (unité du produit pour 1 vendu), soldUnit, inUnit, inFactor, ignore?, at, uid } : lien mémorisé article de caisse → produit de stock
   - moves (contrat V3) : une vente liée écrit { kind:"vente", qty<0, ref: ticketId, refType:"ticket", … } via stockMove() quand il existe. */
TAB_OF.tzEdit = "more";
Object.assign(IC, {
  pot: ["M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6Z", "M2 10h20", "M9 6c0-1 1-1 1-2", "M14 6c0-1 1-1 1-2"],
  tklink: ["M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7", "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"],
  tkundo: ["M9 14 4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-3"],
  tkl: ["M15 18l-6-6 6-6"],
  tkr: ["M9 18l6-6-6-6"],
  tkdel: ["M21 5H9l-7 7 7 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z", "m12 9 6 6", "m18 9-6 6"],
  tkparts: ["M6 3h12v6H6z", "M6 11h12v4H6z", "M6 17h12v4H6z"],
});

/* ───────── helpers ───────── */
const tkNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tkSing = (s) => s.split(" ").map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w)).join(" ");
const tkKey = (s) => tkSing(tkNorm(s));
const tkTrim = (s) => (s.includes(",") ? s.replace(/0+$/, "").replace(/,$/, "") : s);
const tkN = (v, d = 1) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d }));
const tkPl = (n, w) => `${tkN(n)} ${w}${Math.abs(n) >= 2 ? "s" : ""}`;
const tkCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const TK_MAXQ = 9999;
const tkCoarse = () => { try { return window.matchMedia("(pointer:coarse)").matches; } catch (e) { return false; } };
/* « 1 234,50 », « 1.234,50 », « 1234.5 » → nombre */
function tkNum(v) {
  let s = String(v ?? "").replace(/[\s  €]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, ""); else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return num(s);
}
const tkR2 = (v) => Math.round(v * 100) / 100;
const tkEur = (v, d = 2) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const tkMoney = (v) => (v == null ? "" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const tkPhotos = (t) => [...(t.photos || []), ...(t.photoUrls || [])].filter(Boolean);
function tkDayLabel(k, long) {
  const d = parseDay(k); if (!d) return "?";
  if (k === dayKey()) return "Aujourd'hui"; if (k === addDays(dayKey(), -1)) return "Hier";
  return long ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : `${DAYS[d.getDay()].slice(0, 3)}. ${shortDate(k)}`;
}
const tkRecipes = () => S.notes.filter((n) => n.cat === "Recettes" && (n.title || "").trim());
function tkRecipeFor(l) {
  const R = tkRecipes(); if (l.noteId) { const r = R.find((n) => n.id === l.noteId); if (r) return r; }
  const k = tkKey(l.libelle); if (!k) return null;
  return R.find((n) => tkKey(n.title) === k) || R.find((n) => { const t = tkKey(n.title); return t.length >= 5 && k.length >= 5 && (k.includes(t) || t.includes(k)); }) || null;
}
const tkHasRecipe = (l) => ((tkRecipeFor(l) || {}).ingredients || []).length > 0;
const TK_U = { g: ["g", 1], gr: ["g", 1], gramme: ["g", 1], grammes: ["g", 1], kg: ["g", 1000], mg: ["g", 0.001], ml: ["ml", 1], cl: ["ml", 10], dl: ["ml", 100], l: ["ml", 1000], litre: ["ml", 1000], litres: ["ml", 1000] };
const tkUnit = (u) => TK_U[tkNorm(u)] || [String(u || "").trim() || "pièce", 1];
function tkQty(v, base) {
  if (base === "g") return v >= 1000 ? tkN(v / 1000, v >= 10000 ? 1 : 2) + " kg" : Math.round(v) + " g";
  if (base === "ml") return v >= 1000 ? tkN(v / 1000, v >= 10000 ? 1 : 2) + " L" : Math.round(v) + " ml";
  const u = base === "pièce" && v >= 2 ? "pièces" : base; return tkN(v, v < 10 ? 2 : 1) + " " + u;
}
/* pluriel d'une unité (« douzaine » → « douzaines », « plateau » → « plateaux ») */
const TK_PLU = { "pièce": "pièces", douzaine: "douzaines", "demi-douzaine": "demi-douzaines", portion: "portions", assiette: "assiettes", verre: "verres", bouteille: "bouteilles", "lanière": "lanières", plateau: "plateaux", bourriche: "bourriches", botte: "bottes", "boîte": "boîtes", colis: "colis", "fût": "fûts", pot: "pots", carafe: "carafes", "unité": "unités", tranche: "tranches", barquette: "barquettes", sachet: "sachets", carton: "cartons", vendu: "vendus" };
const tkU = (n, u) => (n != null && Math.abs(n) >= 2 ? TK_PLU[u] || (/[sx]$|^(kg|g|l|cl|ml)$/i.test(u || "") ? u : (u || "") + "s") : u || "");
const tkQU = (n, u) => `${tkN(n, 2)} ${tkU(n, u)}`;

/* ───────── abonnements propres (liens + tous les tickets pour la finance) ───────── */
let tkRid = null;
S.tkLinks = S.tkLinks || []; S.tkAll = S.tkAll || null;
const tkCbL = (rows) => { S.tkLinks = rows; if (S.route === "tickets") refresh(); };
const tkCbT = (rows) => { S.tkAll = rows; };
function tkEnsure() {
  if (!S.rid) return;
  /* en local, core vide les écouteurs quand il rattache un restaurant : on se réabonne si le nôtre a disparu */
  if (tkRid === S.rid && DB.mode === "local" && !(DB.listeners[DB.path("tkLinks")] || []).includes(tkCbL)) tkRid = null;
  if (tkRid === S.rid) return; tkRid = S.rid; S.tkLinks = []; S.tkAll = null;
  DB.watch("tkLinks", {}, tkCbL);
  DB.watch("tickets", { order: "at", dir: "desc" }, tkCbT);
}
const tkAllTickets = () => (S.tkAll && S.tkAll.length >= S.tickets.length ? S.tkAll : S.tickets);
const tkLinkId = (key) => "k_" + key.replace(/[^a-z0-9]+/g, "_").slice(0, 90);
const tkLinkOf = (libelle) => { const k = tkKey(libelle); return k ? S.tkLinks.find((x) => x.key === k) || null : null; };
const tkProd = (id) => (id && S.products.find((p) => p.id === id)) || null;

/* ───────── finance ───────── */
/* salesBetween(from, to) : bornes incluses, « AAAA-MM-JJ », Date ou horodatage. HT : saisi, sinon somme des taux, sinon estimé à 10 % (htEstimated = la part estimée). */
function tkHtOf(t) { if (num(t.ht) != null) return num(t.ht); const v = (t.vat || []).filter((x) => num(x.ht) != null); return v.length ? v.reduce((s, x) => s + num(x.ht), 0) : null; }
function salesBetween(from, to) {
  tkEnsure();
  const k = (x) => (x == null || x === "" ? null : typeof x === "string" ? x.slice(0, 10) : dayKey(new Date(x)));
  const a = k(from) || "0000-00-00", b = k(to) || "9999-99-99";
  const L = tkAllTickets().filter((t) => t.date && t.date >= a && t.date <= b);
  let ttc = 0, ht = 0, covers = 0, est = 0; const days = new Set();
  L.forEach((t) => {
    days.add(t.date); const T = num(t.total) || 0; ttc += T; covers += num(t.covers) || 0;
    const h = tkHtOf(t); if (h != null) ht += h; else if (T) { ht += T / 1.1; est += T / 1.1; }
  });
  return { ttc: tkR2(ttc), ht: tkR2(ht), covers, days: days.size, tickets: L.length, htEstimated: tkR2(est) };
}
window.salesBetween = salesBetween;

/* Consommation théorique : Σ plats vendus × (ingrédients de la fiche ÷ portions) */
function tkConsumption(tickets) {
  const m = new Map(), miss = new Map(); let dishes = 0, matched = 0;
  tickets.forEach((t) => (t.lines || []).forEach((l) => {
    const q = num(l.quantite) || 0; if (q <= 0 || !l.libelle) return; dishes += q;
    const r = tkRecipeFor(l); const ings = ((r && r.ingredients) || []).filter((g) => g.name && num(g.qty));
    if (!ings.length) { const ln = tkLinkOf(l.libelle); if (!ln || (!ln.ignore && !tkProd(ln.productId))) miss.set(l.libelle, (miss.get(l.libelle) || 0) + q); return; }
    matched += q; const por = num(r.portions) || 1;
    ings.forEach((g) => { const [b, f] = tkUnit(g.unit); const k = tkNorm(g.name) + "|" + b; const e = m.get(k) || { name: g.name.trim(), base: b, v: 0, from: new Set() }; e.v += (num(g.qty) * f * q) / por; e.from.add(r.title.trim()); m.set(k, e); });
  }));
  let cost = 0, costed = 0;
  const rows = [...m.values()].map((e) => {
    const p = S.products.find((x) => tkNorm(x.name) === tkNorm(e.name)); let c = null;
    if (p && num(p.price)) { const [pb, pf] = tkUnit(p.unit); if (pb === e.base) { c = (e.v / pf) * num(p.price); cost += c; costed++; } }
    return { ...e, from: [...e.from], cost: c };
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { rows, miss: [...miss].sort((a, b) => b[1] - a[1]), dishes, matched, cost: costed ? cost : null, costed };
}
function tkByDay() { const m = {}; S.tickets.forEach((t) => { if (!t.date) return; const d = (m[t.date] ||= { total: 0, has: false, covers: 0, list: [] }); if (num(t.total) != null) { d.total += num(t.total); d.has = true; } d.covers += num(t.covers) || 0; d.list.push(t); }); return m; }
function tkDishes() {
  const m = new Map();
  tkRecipes().forEach((r) => m.set(tkKey(r.title), { name: r.title.trim(), noteId: r.id, recipe: (r.ingredients || []).length > 0, n: 0 }));
  S.tickets.forEach((t) => (t.lines || []).forEach((l) => { if (!l.libelle) return; const r = tkRecipeFor(l); const k = r ? tkKey(r.title) : tkKey(l.libelle); const e = m.get(k) || { name: l.libelle.trim(), noteId: "", recipe: false, n: 0 }; e.n += num(l.quantite) || 1; m.set(k, e); }));
  S.tkLinks.forEach((x) => { if (x.label && x.key && !m.has(x.key)) m.set(x.key, { name: x.label, noteId: "", recipe: false, n: 0 }); });
  return [...m.values()];
}
function tkTop(days = 14) {
  const from = addDays(dayKey(), -(days - 1)); const m = new Map();
  S.tickets.filter((t) => (t.date || "") >= from).forEach((t) => (t.lines || []).forEach((l) => { const q = num(l.quantite) || 0; if (!l.libelle || q <= 0) return; const r = tkRecipeFor(l); const k = r ? "#" + r.id : tkKey(l.libelle); const e = m.get(k) || { name: r ? r.title.trim() : l.libelle.trim(), q: 0 }; e.q += q; m.set(k, e); }));
  return [...m.values()].sort((a, b) => b.q - a.q);
}
/* dernières valeurs connues d'un article (quantité, montant, prix unitaire) */
function tkLast(libelle, exceptId) {
  const k = tkKey(libelle); if (!k) return null;
  const L = [...S.tickets].filter((t) => t.id !== exceptId).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.at || 0) - (a.at || 0));
  let pu = null, last = null;
  for (const t of L) { const l = (t.lines || []).find((x) => tkKey(x.libelle) === k); if (!l) continue; if (!last) last = { q: num(l.quantite), m: num(l.montant), date: t.date }; if (pu == null && num(l.montant) && num(l.quantite)) pu = num(l.montant) / num(l.quantite); if (pu != null) break; }
  return last ? { ...last, pu } : null;
}
const tkCount = (list) => tkPl(list.reduce((a, t) => a + (t.lines || []).reduce((b, l) => b + (num(l.quantite) || 0), 0), 0), "plat");
function tkReadout(k, by) { const d = by[k]; return `<b>${tkCap(tkDayLabel(k, true))}</b><span class="mono">${d && d.has ? tkEur(d.total) : d ? "CA non saisi" : "pas de ticket"}${d && d.covers ? ` · ${tkN(d.covers)} couv.` : ""}</span>`; }

/* ───────── ticket en plusieurs parties : fusion + doublons ─────────
   Une ligne identique (même article, même quantité, même montant) sur la partie précédente = chevauchement de deux photos :
   elle est signalée et comptée une seule fois, sauf si l'utilisateur dit « compter aussi » (keep). */
function tkMerge(parts) {
  const map = new Map(), flags = parts.map(() => ({})); let dups = 0;
  parts.forEach((p, pi) => p.lines.forEach((l, li) => {
    const k = tkKey(l.libelle); const q = num(l.quantite) || 0; if (!k || q <= 0) return; const m = tkNum(l.montant);
    const e = map.get(k);
    if (e) {
      const prev = pi > 0 && e.src.find((s) => s.pi === pi - 1 && s.q === q && s.m === m);
      if (prev) { flags[pi][li] = { of: pi - 1, kept: !!l.keep }; if (!l.keep) { dups++; return; } }
      e.q += q; if (m != null) e.m = (e.m || 0) + m; e.src.push({ pi, q, m }); if (!e.noteId && l.noteId) e.noteId = l.noteId; return;
    }
    map.set(k, { libelle: l.libelle.trim(), q, m, noteId: l.noteId || "", src: [{ pi, q, m }] });
  }));
  const lines = [...map.values()].map((e) => ({ libelle: e.libelle, quantite: Math.min(TK_MAXQ, tkR2(e.q)), montant: e.m != null ? tkR2(e.m) : null, noteId: e.noteId, parts: [...new Set(e.src.map((s) => s.pi))] }));
  return { lines, flags, dups };
}

/* ───────── ventes → stock ───────── */
const tkMovesOf = (tid) => (tid ? S.moves.filter((m) => m.ref === tid && m.kind === "vente") : []);
/* écrit (ou réécrit) les sorties de stock d'un ticket. Idempotent : efface d'abord les anciennes ventes du ticket. */
async function tkSyncStock(t) {
  for (const m of tkMovesOf(t.id)) await DB.del("moves", m.id).catch(() => {});
  const res = { done: [], unlinked: [] }; if (t.stockOff) return res;
  for (const l of t.lines || []) {
    const q = num(l.quantite) || 0; if (q <= 0) continue; const ln = tkLinkOf(l.libelle);
    if (ln && ln.ignore) continue;
    const p = ln && tkProd(ln.productId);
    if (!p) { if (!tkHasRecipe(l)) res.unlinked.push({ libelle: l.libelle, q }); continue; }
    const qty = -Math.round(q * (num(ln.factor) || 1) * 1000) / 1000;
    const doc = { productId: p.id, name: p.name, qty, unit: p.unit || "", kind: "vente", ref: t.id, refType: "ticket", day: t.date, at: t.at || Date.now(), uid: S.me.id, by: S.me.name || "", libelle: l.libelle, soldQty: q, soldUnit: ln.soldUnit || "" };
    try { if (typeof stockMove === "function") await stockMove(doc); else await DB.add("moves", doc); res.done.push(doc); } catch (e) { console.warn(e); }
  }
  if (res.done.length && typeof stockMove !== "function") logEvent("stock", `ventes du ${shortDate(t.date)} déduites du stock (${tkPl(res.done.length, "produit")})`, { ref: t.id });
  return res;
}
const tkSoldTx = (d) => `${d.soldUnit ? tkQU(d.soldQty, d.soldUnit) : "×" + tkN(d.soldQty)} · ${esc(d.libelle)}`;
function tkDoneRow(d) { return `<div class="tk-mv"><div class="tx"><b>${tkSoldTx(d)}</b><em>${esc(d.name)}</em></div><span class="mono tk-mq">−${tkQU(Math.abs(d.qty), d.unit)}</span></div>`; }
function tkUnlinkedRows(list, tid) { return list.map((u) => `<div class="tk-unl"><div class="tx"><b>${esc(u.libelle)}</b><em>×${tkN(u.q)} · pas encore lié</em></div><button class="btn soft sm" data-act="tkLink" data-v="${esc(u.libelle)}" data-t="${tid || ""}">${ico("tklink")}Lier à un produit</button></div>`).join(""); }
function tkUnlinkedFor(tickets) {
  const m = new Map();
  tickets.filter((t) => !t.stockOff).forEach((t) => (t.lines || []).forEach((l) => { const q = num(l.quantite) || 0; if (q <= 0 || !l.libelle) return; const ln = tkLinkOf(l.libelle); if (ln && (ln.ignore || tkProd(ln.productId))) return; if (tkHasRecipe(l)) return; const k = tkKey(l.libelle); const e = m.get(k) || { libelle: l.libelle.trim(), q: 0 }; e.q += q; m.set(k, e); }));
  return [...m.values()].sort((a, b) => b.q - a.q);
}
function tkRecapHtml(t, res) {
  const done = res ? res.done : tkMovesOf(t.id); const unl = res ? res.unlinked : tkUnlinkedFor([t]);
  const head = `<div class="hstack"><span class="ic ${done.length && !t.stockOff ? "ok" : ""}">${ico("box")}</span><div style="min-width:0"><div class="h2" style="font-size:20px">${t.stockOff ? "Stock non déduit" : done.length ? "Sorti du stock" : "Ventes et stock"}</div><div class="sub">Ticket Z · ${tkDayLabel(t.date, true)}</div></div></div>`;
  const body = t.stockOff ? `<p class="sub" style="margin:0">Les ventes de ce ticket ne sont pas retirées du stock.</p><button class="btn acc block" data-act="tkStockRedo" data-id="${t.id}">${ico("box")}Déduire du stock</button>`
    : `${done.length ? `<div class="tk-mvs">${done.map(tkDoneRow).join("")}</div>` : ""}
      ${unl.length ? `<div class="tk-unls"><span class="lbl">${done.length ? "Pas encore liés au stock" : "Liez ces articles à vos produits"}</span>${tkUnlinkedRows(unl, t.id)}<p class="note" style="margin:2px 0 0">Une seule fois : le lien est mémorisé pour les prochains tickets.</p></div>` : ""}
      ${!done.length && !unl.length ? `<p class="sub" style="margin:0">Aucun article de ce ticket n'est relié à un produit du stock.</p>` : ""}`;
  const foot = t.stockOff ? `<button class="btn soft block" data-act="sheetClose">Fermer</button>` : done.length ? `<div class="grid2"><button class="btn soft" data-act="tkStockUndo" data-id="${t.id}">${ico("tkundo")}Annuler</button><button class="btn acc" data-act="sheetClose">${ico("check")}OK</button></div>` : `<button class="btn acc block" data-act="sheetClose">${ico("check")}OK</button>`;
  return `${head}${body}${foot}`;
}
function tkShowRecap(tid, res) { const t = tkAllTickets().find((x) => x.id === tid) || S.tickets.find((x) => x.id === tid); if (!t) return; openSheet(`<div class="tk-recap">${tkRecapHtml(t, res)}</div>`); }

/* ───────── vue principale ───────── */
VIEWS.tickets = {
  render() {
    tkEnsure();
    const today = dayKey(); const by = tkByDay(); const tT = by[today];
    const days = [...Array(14)].map((_, i) => addDays(today, i - 13));
    const sum14 = days.reduce((a, d) => a + (by[d]?.total || 0), 0); const open14 = days.filter((d) => by[d]?.has).length;
    const cov14 = days.reduce((a, d) => a + (by[d]?.covers || 0), 0); const caCov = days.reduce((a, d) => a + (by[d]?.covers ? by[d].total : 0), 0);
    if (!S.ui.tkDay || (!by[S.ui.tkDay] && !days.includes(S.ui.tkDay))) S.ui.tkDay = tT ? today : (S.tickets.map((t) => t.date).filter(Boolean).sort().pop() || today);
    const sel = S.ui.tkDay; const per = S.ui.tkPer || "jour";
    const range = per === "jour" ? [sel] : [...Array(7)].map((_, i) => addDays(sel, i - 6));
    const C = tkConsumption(S.tickets.filter((t) => range.includes(t.date)));
    const caR = range.reduce((a, d) => a + (by[d]?.total || 0), 0);
    const top = tkTop(14).slice(0, 6);

    const tParts = tT ? Math.max(...tT.list.map((t) => (t.parts || []).length || 1)) : 0;
    const todayCard = tT ? `<div class="glass pad st tk-today" style="--i:1"><div class="hstack"><span class="ic ok">${ico("check")}</span><div style="flex:1;min-width:0"><b class="h3">Ticket du jour saisi</b><div class="sub"><span class="mono tk-nw">${tT.has ? tkEur(tT.total) : "CA non saisi"}</span> <span class="tk-nw">· ${tkCount(tT.list)}</span>${tT.covers ? ` <span class="tk-nw">· ${tkN(tT.covers)} couverts</span>` : ""}${tParts > 1 ? ` <span class="tk-nw">· ${tParts} parties</span>` : ""}</div></div><button class="btn soft sm" data-act="tzOpen" data-id="${tT.list[0].id}">${ico("edit")}Modifier</button></div><div class="tk-today-b"><button class="btn ghost sm" data-act="tzAddPart" data-id="${tT.list[0].id}">${ico("tkparts")}Ajouter une partie</button><button class="btn ghost sm" data-act="tzOther">${ico("plus")}Autre jour</button></div></div>`
      : `<div class="glass pad st tk-today" style="--i:1"><div class="hstack"><span class="ic">${ico("receipt")}</span><div style="min-width:0"><b class="h3">Ticket Z du jour</b><div class="sub">Plats vendus, chiffre d'affaires et couverts, en 30 secondes.</div></div></div>
        <button class="btn acc block" data-act="tzManual">${ico("edit")}Saisir le ticket du jour</button>
        ${S.cap.sample ? `<button class="btn soft block" data-act="tzPick">${ico("camera")}Scanner le ticket (photos)</button>` : ""}
        <div class="tk-tip">${ico("tkparts")}<span>Ticket trop long pour une photo ? Saisissez-le en plusieurs parties : les lignes en double sont repérées.</span></div></div>`;

    const chart = `<div class="glass pad st" style="--i:2"><div class="row"><span class="lbl">Chiffre d'affaires · 14 jours</span><span class="sub">${open14 ? `${open14} jour${open14 > 1 ? "s" : ""} saisi${open14 > 1 ? "s" : ""}` : "aucun jour saisi"}</span></div>
      <div class="tk-kpi"><b class="mono">${tkN(sum14, 0)}<small> €</small></b><span class="sub">${open14 ? `moy. <span class="mono tk-nw">${tkEur(sum14 / open14, 0)}</span> / jour` : "aucune vente saisie"}</span></div>
      ${cov14 ? `<div class="tk-kpis"><span><b class="mono">${tkN(cov14, 0)}</b> couverts</span><span><b class="mono">${tkEur(caCov / cov14)}</b> par couvert</span></div>` : ""}
      <div class="tk-read" id="tkRead">${tkReadout(sel, by)}</div>
      <div class="tk-chart" id="tkChart" data-days="${days.join(",")}"></div>${open14 ? "" : `<div class="tk-chart-empty">Saisissez votre premier ticket Z : vos ventes s'afficheront ici, jour après jour.</div>`}</div>`;

    const cons = `<div class="glass pad st" style="--i:4;display:flex;flex-direction:column;gap:10px">
      <div class="hstack" style="min-width:0"><span class="ic">${ico("pot")}</span><div style="min-width:0"><b class="h3">Consommation théorique</b><div class="sub">${per === "jour" ? tkDayLabel(sel, true) : `7 jours jusqu'au ${shortDate(sel)}`}</div></div></div>
      <div class="seg tk-seg"><button class="${per === "jour" ? "on" : ""}" data-act="tkPer" data-v="jour">Jour</button><button class="${per === "sem" ? "on" : ""}" data-act="tkPer" data-v="sem">7 jours</button></div>
      ${tkConsHtml(C, caR)}</div>`;

    const topCard = `<div class="glass pad st" style="--i:5"><div class="row"><span class="lbl">Plats les plus vendus · 14 jours</span></div>${top.length ? top.map((d, i) => `<div class="li tk-top"><span class="rank ${i === 0 ? "hot" : ""}">${i + 1}</span><div class="tx"><b>${esc(d.name)}</b><i class="tk-bar"><i style="width:${Math.max(4, (d.q / top[0].q) * 100)}%"></i></i></div><span class="mono" style="font-weight:700">${tkN(d.q)}</span></div>`).join("") : `<div class="empty" style="padding:14px 0 4px">Les plats vendus apparaîtront ici.</div>`}</div>`;

    const hist = [...S.tickets].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.at || 0) - (a.at || 0));
    const histCard = `<div class="glass pad st" style="--i:6"><div class="row"><span class="lbl">Historique</span><span class="sub">${S.tickets.length ? tkPl(S.tickets.length, "ticket") : ""}</span></div>${hist.map((t) => `<div class="li tap" data-act="ticket" data-id="${t.id}" role="button" tabindex="0"><span class="ic">${ico("receipt")}</span><div class="tx"><b>${t.date ? tkDayLabel(t.date) : "Date inconnue"}</b><em>${tkCount([t])}${t.covers ? ` · ${tkN(t.covers)} couv.` : ""}${(t.parts || []).length > 1 ? ` · ${t.parts.length} parties` : ""} · ${esc(firstName(nameOf(t.uid)))}</em></div>${tkPhotos(t).length || (t.photoIds || []).length ? `<span class="tk-cam" aria-label="Photo jointe">${ico("camera")}</span>` : ""}<span class="mono tk-nw" style="font-weight:700">${t.total != null ? tkEur(t.total) : "–"}</span></div>`).join("") || `<div class="empty" style="padding:16px 0 4px">Aucun ticket enregistré.</div>`}</div>`;

    return `<div class="inner">${topBar("Tickets de caisse")}<div class="cols"><div>${todayCard}${chart}${tkStockCard(sel, by)}${cons}</div><div>${topCard}${histCard}</div></div></div>`;
  },
  after(v) { tkDrawChart(v); if (!tkResizeBound) { tkResizeBound = true; window.addEventListener("resize", debounce(() => { if (S.route === "tickets") tkDrawChart($("#viewport .view:not(.leave)")); }, 150)); } },
};
let tkResizeBound = false;

/* carte « Ventes → stock » du jour choisi */
function tkStockCard(sel, by) {
  const list = by[sel]?.list || []; const links = S.tkLinks.filter((x) => !x.ignore && x.productId).length;
  const head = `<div class="hstack" style="min-width:0"><span class="ic">${ico("box")}</span><div style="min-width:0;flex:1"><b class="h3">Ventes → stock</b><div class="sub">${tkDayLabel(sel, true)}</div></div>${S.tkLinks.length ? `<button class="btn ghost sm" data-act="tkLinks">${ico("tklink")}${tkPl(links, "lien")}</button>` : ""}</div>`;
  let body;
  if (!S.products.length) body = `<div class="tk-hint">${ico("box")}<span>Le ticket Z peut retirer du stock ce que vous vendez : « 12 douzaines de fines de claire → −144 huîtres ». Créez d'abord vos produits dans Stock.</span></div><button class="btn soft sm" data-go="stock" style="align-self:flex-start">${ico("box")}Ouvrir le stock</button>`;
  else if (!list.length) body = `<div class="empty" style="padding:8px 0 2px">Pas de ticket ce jour-là.</div>`;
  else {
    const mv = list.flatMap((t) => tkMovesOf(t.id)); const unl = tkUnlinkedFor(list); const off = list.filter((t) => t.stockOff);
    body = `${mv.length ? `<div class="tk-mvs">${mv.map(tkDoneRow).join("")}</div>` : ""}
      ${off.length ? `<div class="tk-hint">${ico("alert")}<span>Déduction annulée pour ce ticket.</span></div><button class="btn soft sm" data-act="tkStockRedo" data-id="${off[0].id}" style="align-self:flex-start">${ico("box")}Déduire du stock</button>` : ""}
      ${unl.length ? `<div class="tk-unls">${mv.length ? `<span class="lbl">Pas encore liés</span>` : `<p class="sub" style="margin:0">Liez chaque article vendu à un produit du stock, une seule fois : les tickets suivants le déduiront tout seuls.</p>`}${tkUnlinkedRows(unl.slice(0, 6), list.length === 1 ? list[0].id : "")}${unl.length > 6 ? `<span class="note">et ${unl.length - 6} autre${unl.length - 6 > 1 ? "s" : ""}…</span>` : ""}</div>` : ""}
      ${!mv.length && !unl.length && !off.length ? `<div class="empty" style="padding:8px 0 2px">Rien à déduire : aucun article lié au stock.</div>` : ""}`;
  }
  return `<div class="glass pad st tk-stock" style="--i:3">${head}${body}</div>`;
}

function tkConsHtml(C, ca) {
  if (!C.dishes) return `<div class="empty" style="padding:10px 0 2px">Aucun plat vendu sur cette période.</div>`;
  if (!C.rows.length) return `<div class="tk-hint">${ico("book")}<span>Aucun plat vendu n'est relié à une fiche recette avec ingrédients. Créez la fiche (même nom que sur le ticket) pour voir ce qui sort du stock.</span></div><button class="btn soft sm" data-go="note" data-id="new" style="align-self:flex-start">${ico("plus")}Créer une fiche recette</button>${tkMissHtml(C)}`;
  return `<div class="tk-cons">${C.rows.map((r) => `<div class="li"><div class="tx"><b>${esc(r.name)}</b><em>${esc(r.from.join(", "))}${r.cost != null ? ` · ≈ ${tkEur(r.cost)}` : ""}</em></div><span class="mono tk-q">${tkQty(r.v, r.base)}</span></div>`).join("")}</div>
    ${C.cost != null ? (C.costed === C.rows.length ? `<div class="tk-cost"><span>Coût matière estimé</span><b class="mono">${tkEur(C.cost)}${ca ? ` <small>· ${tkN((C.cost / ca) * 100, 0)} % du CA</small>` : ""}</b></div>` : `<div class="tk-cost part"><span>Coût matière partiel<small>prix connu pour ${C.costed} ingrédient${C.costed > 1 ? "s" : ""} sur ${C.rows.length} (Stock)</small></span><b class="mono">${tkEur(C.cost)}</b></div>`) : ""}
    <div class="note">${tkPl(C.matched, "plat")} sur ${tkN(C.dishes)} relié${C.matched >= 2 ? "s" : ""} à une fiche recette. Quantité = ingrédients de la fiche ÷ portions × plats vendus.</div>${tkMissHtml(C)}`;
}
function tkMissHtml(C) { if (!C.miss.length) return ""; return `<div class="tk-miss"><span class="lbl">Sans fiche recette</span><div class="tk-pills">${C.miss.slice(0, 8).map(([n, q]) => `<span class="pill neu">${esc(n)} ×${tkN(q)}</span>`).join("")}</div></div>`; }

/* Barres SVG, dessinées à la largeur réelle du conteneur */
function tkDrawChart(v) {
  const el = v && $("#tkChart", v); if (!el) return;
  const days = el.dataset.days.split(","); const by = tkByDay(); const W = Math.max(240, el.clientWidth || 320), H = 150, top = 16, bot = 26, ch = H - top - bot;
  const vals = days.map((d) => by[d]?.total || 0); const any = vals.some((x) => x > 0); const max = Math.max(...vals, 1); const band = W / days.length; const bw = Math.min(28, band - 6); const sel = S.ui.tkDay; const today = dayKey();
  const bars = days.map((d, i) => {
    const x = i * band + (band - bw) / 2, val = vals[i], h = val > 0 ? Math.max(4, (val / max) * ch) : 0, y = top + ch - h, r = Math.min(4, bw / 2, h);
    const lab = "DLMMJVS"[parseDay(d).getDay()];
    const mark = h ? `<path class="tk-b ${d === sel ? "on" : ""}" d="M${x},${top + ch} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + ch} Z"/>` : by[d] ? `<rect class="tk-b0 has" x="${x}" y="${top + ch - 3}" width="${bw}" height="3" rx="1.5"/>` : `<rect class="tk-b0" x="${x + bw / 2 - 2}" y="${top + ch - 4}" width="4" height="4" rx="2"/>`;
    return `${mark}<text class="tk-x ${d === sel ? "on" : ""} ${d === today ? "td" : ""}" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${lab}</text><rect class="tk-hit" data-act="tkDay" data-v="${d}" tabindex="0" role="button" aria-label="${tkCap(tkDayLabel(d, true))}" x="${i * band}" y="0" width="${band}" height="${H}"><title>${tkCap(tkDayLabel(d, true))} : ${by[d]?.has ? tkEur(by[d].total) : "–"}</title></rect>`;
  }).join("");
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiffre d'affaires des 14 derniers jours">${any ? `<line class="tk-grid" x1="0" x2="${W}" y1="${top}" y2="${top}"/>` : ""}${any ? `<text class="tk-y" x="${W}" y="${top - 5}" text-anchor="end">${tkEur(max, 0)}</text>` : ""}<line class="tk-base" x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}"/>${bars}</svg>`;
  const rd = $("#tkRead", v);
  $$(".tk-hit", el).forEach((h) => {
    const show = () => { rd.innerHTML = tkReadout(h.dataset.v, by); }; const back = () => { rd.innerHTML = tkReadout(S.ui.tkDay, by); };
    h.addEventListener("mouseenter", show); h.addEventListener("mouseleave", back); h.addEventListener("focus", show); h.addEventListener("blur", back);
    /* SVG has no .click(): handle Enter/Space here, before core's [role=button] handler */
    h.addEventListener("keydown", (e) => { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); e.stopPropagation(); S.ui.tkFocus = h.dataset.v; ACT.tkDay(h, null, h.dataset.v); });
  });
  if (S.ui.tkFocus) { const f = el.querySelector(`.tk-hit[data-v="${S.ui.tkFocus}"]`); S.ui.tkFocus = null; if (f) f.focus({ preventScroll: true }); }
}

/* ───────── saisie ───────── */
const TK_RATES = [["r55", 5.5], ["r10", 10], ["r20", 20]];
function tkVatCalc(T) {
  const rows = TK_RATES.map(([k, r]) => { const ttc = tkNum(T.vat?.[k]); return ttc != null && ttc > 0 ? { rate: r, ttc: tkR2(ttc), ht: tkR2(ttc / (1 + r / 100)), tva: tkR2(ttc - ttc / (1 + r / 100)) } : null; }).filter(Boolean);
  const htIn = String(T.ht ?? "").trim() ? tkNum(T.ht) : null; const sumHt = rows.length ? tkR2(rows.reduce((a, x) => a + x.ht, 0)) : null; const sumTtc = rows.length ? tkR2(rows.reduce((a, x) => a + x.ttc, 0)) : null;
  return { rows, ht: htIn != null && htIn >= 0 ? htIn : sumHt, sumHt, sumTtc };
}
function tkFinHtml(T) {
  const tot = tkNum(T.total), cov = num(T.covers); const V = tkVatCalc(T);
  const avg = tot && cov ? `Panier moyen <b class="mono">${tkEur(tot / cov)}</b>` : cov ? `Saisissez le CA pour le panier moyen` : `Pour le panier moyen par couvert`;
  const ttc = tot ?? V.sumTtc;
  const vs = V.ht != null ? `<span>HT <b class="mono">${tkEur(V.ht)}</b></span>${ttc ? `<span>TVA <b class="mono">${tkEur(ttc - V.ht)}</b></span>` : ""}${V.sumTtc && tot && Math.abs(V.sumTtc - tot) > 0.05 ? `<span class="warn">Total des taux ${tkEur(V.sumTtc)} ≠ CA</span>` : ""}` : `<span>Le TTC par taux, ou directement le total HT.</span>`;
  return { avg, vs, V };
}
const tkPn = (i) => `Partie ${i + 1}`;
VIEWS.tzEdit = {
  live: false,
  render() {
    tkEnsure();
    if (!S.tz) tkNew();
    const T = S.tz; tkUsePart(T); const by = tkByDay(); const dup = (by[T.date]?.list || []).find((t) => t.id !== T.id);
    const M = tkMerge(T.parts); const multi = T.parts.length > 1; const all = multi && T.cur === -1;
    const n = M.lines.reduce((a, l) => a + l.quantite, 0); const lineSum = M.lines.reduce((a, l) => a + (num(l.montant) || 0), 0);
    const C = tkConsumption([{ lines: M.lines }]);
    const F = tkFinHtml(T); const lastCov = tkAllTickets().find((t) => t.id !== T.id && num(t.covers));
    const busy = T.busy ? `<div class="glass pad st" style="--i:1;display:flex;flex-direction:column;gap:10px"><div class="thumbs">${T.pics.map((p) => `<span class="thumb scan"><img src="${esc(p.src)}" alt=""></span>`).join("")}</div><span class="note">Lecture du ticket… cela prend quelques secondes.</span></div>` : "";
    const partsBar = multi ? `<div class="tk-parts" role="tablist" aria-label="Parties du ticket">${T.parts.map((p, i) => `<button class="tk-part ${T.cur === i ? "on" : ""}" data-act="tzPart" data-v="${i}" role="tab" aria-selected="${T.cur === i}"><b>${tkPn(i)}</b><em>${tkPl(p.lines.length, "ligne")}${p.pics.length ? ` · ${ico("camera")}` : ""}</em></button>`).join("")}<button class="tk-part all ${all ? "on" : ""}" data-act="tzPart" data-v="-1" role="tab" aria-selected="${all}"><b>Ticket complet</b><em>${tkPl(M.lines.length, "ligne")}</em></button><button class="tk-part add" data-act="tzPartAdd" aria-label="Ajouter une partie">${ico("plus")}</button></div>` : "";
    const partTools = multi && !all ? `<div class="tk-ptools"><button class="btn ghost sm" data-act="tzPartMove" data-v="-1" ${T.cur === 0 ? "disabled" : ""} aria-label="Placer cette partie avant">${ico("tkl")}Avant</button><button class="btn ghost sm" data-act="tzPartMove" data-v="1" ${T.cur === T.parts.length - 1 ? "disabled" : ""} aria-label="Placer cette partie après">Après${ico("tkr")}</button><span style="flex:1"></span><button class="btn ghost sm" data-act="tzPhoto" aria-label="Photo de la ${tkPn(T.cur).toLowerCase()}">${ico("camera")}</button><button class="btn ghost sm tk-pdel" data-act="tzPartDel" aria-label="Supprimer la ${tkPn(T.cur).toLowerCase()}">${ico("trash")}</button></div>` : "";
    const dupNote = M.dups ? `<div class="tk-dupnote">${ico("alert")}<span><b>${tkPl(M.dups, "ligne")} en double</b> entre deux photos : compté${M.dups > 1 ? "es" : "e"} une seule fois.</span></div>` : "";
    const linesHtml = all
      ? `<div class="tk-lines">${M.lines.map((l) => `<div class="tk-line tap" data-act="tzPart" data-v="${l.parts[0]}" role="button" tabindex="0"><div class="tx"><b>${esc(l.libelle)}</b><em>${l.parts.map((p) => `<span class="tk-pb">P${p + 1}</span>`).join("")}${l.montant != null ? ` ${tkEur(l.montant)}` : ""}</em></div><span class="mono tk-mq">×${tkN(l.quantite)}</span></div>`).join("") || `<div class="empty" style="padding:8px 0 4px;font-size:13px">Aucune ligne pour l'instant.</div>`}</div>`
      : `<div class="tk-search"><span class="tk-sico">${ico("search")}</span><input class="input" id="tzQ" placeholder="${multi ? `Ajouter à la ${tkPn(T.cur).toLowerCase()}…` : "Ajouter un plat…"}" autocomplete="off" enterkeyhint="done" value="${esc(S.ui.tzQ || "")}"></div>
        <div id="tzSug" class="tk-sug">${tkSugHtml()}</div>
        <div class="tk-lines">${T.lines.map((l, i) => tkLineHtml(l, i, M.flags[T.cur]?.[i])).join("") || `<div class="empty" style="padding:8px 0 4px;font-size:13px">${multi ? `Ajoutez les lignes de la ${tkPn(T.cur).toLowerCase()}, dans l'ordre du ticket.` : tkDishes().length ? "Touchez un plat ci-dessus, ou tapez son nom." : "Tapez le nom d'un plat vendu, puis touchez « Ajouter »."}</div>`}</div>`;
    const addPart = multi ? "" : `<button class="tk-addpart" data-act="tzPartAdd">${ico("tkparts")}<span><b>Ticket long ? Ajouter une partie</b><em>Une photo ou une page de plus, fusionnées en un seul ticket.</em></span>${ico("plus")}</button>`;
    const pics = all ? T.parts.flatMap((p) => p.pics) : T.pics;

    return `<div class="inner narrow tk-edit">${topBar(T.id ? "Modifier le ticket" : "Nouveau ticket Z", { right: T.id ? `<button class="iconbtn" data-act="tzDel" aria-label="Supprimer" style="color:var(--bad)">${ico("trash")}</button>` : "" })}
      ${busy}${T.err ? `<div class="banner st" style="--i:1">${ico("alert")}<span>${esc(T.err)}</span></div>` : ""}
      <div class="tk-ed-grid"><div class="tk-ed-l">
      <div class="glass pad st" style="--i:1;display:flex;flex-direction:column;gap:10px"><span class="lbl">Date du ticket</span>
        <div class="tk-dates"><button class="chip ${T.date === dayKey() ? "on" : ""}" data-act="tzDate" data-v="${dayKey()}">Aujourd'hui</button><button class="chip ${T.date === addDays(dayKey(), -1) ? "on" : ""}" data-act="tzDate" data-v="${addDays(dayKey(), -1)}">Hier</button><input class="input mono" type="date" data-bind="tz.date" data-rer="1" value="${esc(T.date)}" max="${dayKey()}" aria-label="Autre date"></div>
        ${dup ? `<div class="banner tk-dup">${ico("alert")}<span style="flex:1">Un ticket existe déjà pour ${tkDupLabel(T.date)}.</span><button class="btn soft sm" data-act="tzOpen" data-id="${dup.id}">Ouvrir</button></div>` : ""}</div>

      <div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:10px"><div class="row"><span class="lbl">${multi ? "Ticket en plusieurs parties" : "Plats vendus"}</span><span class="sub mono" id="tzN">${n ? tkN(n) : ""}</span></div>
        ${partsBar}${partTools}${dupNote}${linesHtml}${addPart}</div>
      </div><div class="tk-ed-r">

      <div class="glass pad st tk-fin" style="--i:3"><label class="tk-cal"><span class="lbl">Chiffre d'affaires TTC</span><div class="tk-ca"><input class="input mono" id="tzTotal" inputmode="decimal" autocomplete="off" data-bind="tz.total" value="${esc(T.total ?? "")}" placeholder="0,00"><b>€</b></div></label>
        ${lineSum > 0 && tkNum(T.total) !== tkR2(lineSum) ? `<button class="btn ghost sm" data-act="tzUseSum" data-v="${lineSum}" style="align-self:flex-start">Utiliser la somme des lignes : ${tkEur(lineSum)}</button>` : ""}
        <div class="tk-covrow"><div class="tk-covl"><span class="lbl">Couverts</span><div class="tk-avg" id="tzAvg">${F.avg}</div></div><div class="tk-step"><button class="step" data-act="tzCov" data-v="-1" aria-label="Un couvert de moins">${ico("minus")}</button><input class="mono" id="tzCov" inputmode="numeric" autocomplete="off" data-bind="tz.covers" value="${esc(T.covers ?? "")}" placeholder="${lastCov ? tkN(lastCov.covers) : "0"}" aria-label="Nombre de couverts"><button class="step" data-act="tzCov" data-v="1" aria-label="Un couvert de plus">${ico("plus")}</button></div></div>
        <button class="tk-vatt ${T.vatOpen ? "on" : ""}" data-act="tzVat" aria-expanded="${!!T.vatOpen}"><span class="tk-vtl">TVA et total HT <em>facultatif</em></span><span class="tk-vsum" id="tzVsum">${F.V.ht != null ? `HT <b class="mono">${tkEur(F.V.ht)}</b>` : ""}</span>${ico("down")}</button>
        ${T.vatOpen ? `<div class="tk-vat">${TK_RATES.map(([k, r]) => `<label class="tk-vr"><span>TTC à ${tkN(r)} %</span><input class="input mono" inputmode="decimal" autocomplete="off" data-bind="tz.vat.${k}" data-vat="1" value="${esc(T.vat?.[k] ?? "")}" placeholder="0,00"></label>`).join("")}
          <label class="tk-vr ht"><span>Total HT</span><input class="input mono" id="tzHt" inputmode="decimal" autocomplete="off" data-bind="tz.ht" data-vat="1" value="${esc(T.ht ?? "")}" placeholder="${F.V.sumHt != null ? tkMoney(F.V.sumHt) : "0,00"}"></label>
          <div class="tk-vline" id="tzVline">${F.vs}</div></div>` : ""}</div>

      <div class="glass pad st" style="--i:4;display:flex;flex-direction:column;gap:10px"><div class="row"><span class="lbl">Photo · ${multi ? (all ? "toutes les parties" : tkPn(T.cur).toLowerCase()) : "preuve"}</span><span class="sub">facultatif</span></div>
        ${pics.length && !T.busy ? `<div class="thumbs">${pics.map((p, i) => `<span class="thumb"><img src="${esc(p.src)}" alt="Ticket Z">${all ? "" : `<button class="tk-px" data-act="tzPhotoDel" data-v="${i}" aria-label="Retirer la photo">${ico("x")}</button>`}</span>`).join("")}</div>` : ""}
        ${all ? (pics.length ? "" : `<span class="note">Aucune photo.</span>`) : `<button class="btn soft" data-act="tzPhoto" ${T.busy ? "disabled" : ""}>${ico("camera")}${T.pics.length ? "Ajouter une photo" : multi ? `Photographier la ${tkPn(T.cur).toLowerCase()}` : "Photographier le ticket Z"}</button>`}</div>

      ${C.rows.length ? `<div class="glass pad st" style="--i:5;display:flex;flex-direction:column;gap:6px"><div class="hstack"><span class="ic">${ico("pot")}</span><div><b class="h3">Ce que ce ticket consomme</b><div class="sub">Selon vos fiches recettes</div></div></div><div class="tk-cons">${C.rows.map((r) => `<div class="li"><div class="tx"><b>${esc(r.name)}</b><em>${esc(r.from.join(", "))}</em></div><span class="mono tk-q">${tkQty(r.v, r.base)}</span></div>`).join("")}</div></div>` : ""}

      <div class="ctabar"><button class="btn acc block" data-act="tzSave" ${T.busy ? "disabled" : ""}>${ico("check")}<span id="tzCta">${tkCtaLabel(n)}</span></button></div></div></div></div>`;
  },
  after(v) {
    setTimeout(() => { if (S.route === "tzEdit") $("#tabbar").classList.add("hide"); }, 0);
    const pb = $(".tk-parts", v), po = pb && $(".tk-part.on", pb); if (po) pb.scrollLeft = Math.max(0, po.offsetLeft - pb.clientWidth / 2 + po.offsetWidth / 2);
    const fin = () => { if (!S.tz) return; const F = tkFinHtml(S.tz); const a = $("#tzAvg", v); if (a) a.innerHTML = F.avg; const s = $("#tzVline", v); if (s) s.innerHTML = F.vs; const h = $("#tzVsum", v); if (h) h.innerHTML = F.V.ht != null ? `HT <b class="mono">${tkEur(F.V.ht)}</b>` : ""; const hi = $("#tzHt", v); if (hi) hi.placeholder = F.V.sumHt != null ? tkMoney(F.V.sumHt) : "0,00"; };
    $$("[data-vat], #tzCov", v).forEach((i) => i.addEventListener("input", () => setTimeout(fin, 0)));
    $$("[data-vat]", v).forEach((i) => i.addEventListener("blur", () => { if (!S.tz) return; const x = tkNum(i.value); if (x != null && x >= 0 && i.value.trim()) { i.value = tkMoney(x); setPath(i.dataset.bind, i.value); } }));
    const tot = $("#tzTotal", v); tot.addEventListener("input", () => setTimeout(fin, 0)); tot.addEventListener("blur", () => { if (!S.tz) return; const x = tkNum(tot.value); if (x != null && x >= 0) { tot.value = tkMoney(x); S.tz.total = tot.value; } });
    const q = $("#tzQ", v);
    if (q) {
      q.addEventListener("input", () => { S.ui.tzQ = q.value; $("#tzSug", v).innerHTML = tkSugHtml(); });
      q.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; e.preventDefault(); const f = $("#tzSug [data-act=tzAdd]", v); if (f && q.value.trim()) f.click(); else q.blur(); });
      if (S.ui.tzFocus) { S.ui.tzFocus = false; q.focus({ preventScroll: true }); }
    }
    $$("[data-qi]", v).forEach((inp) => {
      tkFitQ(inp); if (inp.readOnly) return;
      inp.addEventListener("input", () => { const i = +inp.dataset.qi; if (S.tz.lines[i]) S.tz.lines[i].quantite = inp.value; let q = num(inp.value); if (q != null && q > TK_MAXQ) { inp.value = String(TK_MAXQ); S.tz.lines[i].quantite = inp.value; buzz(8); toast(`${tkN(TK_MAXQ)} au maximum par plat`, "err"); } tkFitQ(inp); tkLive(v); });
      inp.addEventListener("focus", () => inp.select());
    });
    if (S.ui.tzBump != null) { const b = $(`[data-qi="${S.ui.tzBump}"]`, v); S.ui.tzBump = null; if (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } }
    if (S.ui.tzKpOpen != null) { const i = S.ui.tzKpOpen; S.ui.tzKpOpen = null; setTimeout(() => { if (S.route === "tzEdit") ACT.tzKp(null, null, String(i)); }, 80); }
  },
};
function tkUsePart(T) {
  if (!T.parts || !T.parts.length) T.parts = [{ lines: T.lines || [], pics: T.pics || [] }];
  if (T.cur === -1 && T.parts.length < 2) T.cur = 0;
  if (T.cur == null || T.cur < -1 || T.cur >= T.parts.length) T.cur = Math.max(0, Math.min(T.cur || 0, T.parts.length - 1));
  const p = T.parts[T.cur === -1 ? T.parts.length - 1 : T.cur]; T.lines = p.lines; T.pics = p.pics;
}
const tkLinesN = (T) => tkMerge(T.parts || [{ lines: T.lines }]).lines.reduce((a, l) => a + l.quantite, 0);
const tkCtaLabel = (n) => `Enregistrer${n ? ` · ${tkPl(n, "plat")}` : ""}`;
const tkDupLabel = (k) => (k === dayKey() ? "aujourd'hui" : k === addDays(dayKey(), -1) ? "hier" : `le ${shortDate(k)}`);
function tkFitQ(inp) { const n = String(inp.value).length; inp.classList.toggle("l4", n >= 4); inp.classList.toggle("l3", n === 3); }
/* quantité tapée au clavier : met à jour compteur, bouton et icône sans tout redessiner */
function tkLive(v) {
  const n = tkLinesN(S.tz); const a = $("#tzN", v); if (a) a.textContent = n ? tkN(n) : ""; const c = $("#tzCta", v); if (c) c.textContent = tkCtaLabel(n);
  $$("[data-act=tzDec]", v).forEach((b) => { const q = num(S.tz.lines[+b.dataset.v]?.quantite) || 0; const want = q > 1 ? "minus" : "trash"; if (b.dataset.ic !== want) { b.dataset.ic = want; b.innerHTML = ico(want); b.setAttribute("aria-label", q > 1 ? "Moins" : "Retirer"); } });
}
function tkLineHtml(l, i, flag) {
  const r = tkRecipeFor(l); const ok = r && (r.ingredients || []).length; const ln = tkLinkOf(l.libelle); const lp = ln && !ln.ignore && tkProd(ln.productId);
  const tag = ok ? `<span class="tk-ok">${ico("check")}fiche recette</span>` : lp ? `<span class="tk-ok">${ico("box")}${esc(lp.name)}</span>` : r ? "fiche sans ingrédients" : ln?.ignore ? "hors stock" : "sans fiche recette";
  const coarse = tkCoarse(); const last = tkLast(l.libelle, S.tz && S.tz.id);
  const df = flag ? `<div class="tk-dupf ${flag.kept ? "kept" : ""}">${ico("alert")}<span>${flag.kept ? `Aussi sur la partie ${flag.of + 1} · compté 2 fois` : `Déjà sur la partie ${flag.of + 1} · compté une fois`}</span><button data-act="tzDupKeep" data-v="${i}">${flag.kept ? "Compter une fois" : "Compter aussi"}</button></div>` : "";
  return `<div class="tk-line ${flag && !flag.kept ? "dup" : ""}"><div class="tx" ${coarse ? `data-act="tzKp" data-v="${i}"` : ""}><b>${esc(l.libelle)}</b><em>${tag}${tkNum(l.montant) != null ? ` · ${tkEur(tkNum(l.montant))}` : last && last.q ? ` · <span class="tk-lastq">dernier : ${tkN(last.q)}</span>` : ""}</em></div>
    <div class="tk-step"><button class="step" data-act="tzDec" data-v="${i}" data-ic="${num(l.quantite) > 1 ? "minus" : "trash"}" aria-label="${num(l.quantite) > 1 ? "Moins" : "Retirer"}">${ico(num(l.quantite) > 1 ? "minus" : "trash")}</button><input class="mono" data-qi="${i}" inputmode="decimal" data-bind="tz.lines.${i}.quantite" value="${esc(l.quantite ?? "")}" aria-label="Quantité ${esc(l.libelle)}" ${coarse ? `readonly data-act="tzKp" data-v="${i}"` : ""}><button class="step" data-act="tzInc" data-v="${i}" aria-label="Plus">${ico("plus")}</button></div>${df}</div>`;
}
function tkSugHtml() {
  const T = S.tz; const raw = (S.ui.tzQ || "").trim(); const q = tkNorm(raw); const have = new Set(T.lines.map((l) => tkKey(l.libelle))); const ids = new Set(T.lines.map((l) => tkRecipeFor(l)?.id).filter(Boolean));
  const all = tkDishes().filter((d) => !have.has(tkKey(d.name)) && !(d.noteId && ids.has(d.noteId)));
  if (!q) {
    const pick = all.sort((a, b) => b.n - a.n || b.recipe - a.recipe || a.name.localeCompare(b.name, "fr")).slice(0, 10);
    return pick.length ? `<div class="tk-quick">${pick.map((d) => `<button class="chip" data-act="tzAdd" data-v="${esc(d.name)}" data-id="${d.noteId}">${ico("plus")}${esc(d.name)}</button>`).join("")}</div>` : "";
  }
  const hits = all.map((d) => { const k = tkNorm(d.name); const s = k.startsWith(q) ? 3 : k.split(" ").some((w) => w.startsWith(q)) ? 2 : k.includes(q) ? 1 : 0; return { ...d, s }; }).filter((d) => d.s).sort((a, b) => b.s - a.s || b.n - a.n).slice(0, 6);
  const exact = hits.some((d) => tkNorm(d.name) === q) || have.has(tkSing(q));
  return `<div class="tk-ac">${hits.map((d) => `<button class="tk-opt" data-act="tzAdd" data-v="${esc(d.name)}" data-id="${d.noteId}"><span>${esc(d.name)}</span>${d.recipe ? `<span class="pill acc">fiche</span>` : d.n ? `<span class="sub">vendu ${tkN(d.n)}×</span>` : ""}</button>`).join("")}${exact ? "" : `<button class="tk-opt new" data-act="tzAdd" data-v="${esc(raw)}">${ico("plus")}<span>Ajouter « ${esc(raw)} »</span></button>`}</div>`;
}
function tkNew(date = dayKey()) { S.tz = { id: null, busy: false, parts: [{ lines: [], pics: [] }], cur: 0, date, total: "", covers: "", ht: "", vat: {} }; tkUsePart(S.tz); S.ui.tzQ = ""; }
function tkEditFrom(t) {
  const urls = t.photoUrls || [];
  const all = [...(t.photos || []).map((s) => ({ src: s, data: s })), ...urls.map((s, i) => ({ src: s, id: (t.photoIds || [])[i] || "", url: s }))];
  const ln = (l) => ({ libelle: l.libelle || "", quantite: l.quantite != null ? String(l.quantite).replace(".", ",") : "", montant: l.montant != null ? String(l.montant).replace(".", ",") : "", noteId: l.noteId || "", ...(l.keep ? { keep: true } : {}) });
  let parts;
  if ((t.parts || []).length > 1) {
    const used = new Set(); parts = t.parts.map((p) => ({ lines: (p.lines || []).map(ln), pics: (p.picIdx || []).map((j) => { used.add(j); return all[j]; }).filter(Boolean) }));
    all.forEach((p, j) => { if (!used.has(j)) parts[0].pics.push(p); });
  } else parts = [{ lines: (t.lines || []).map(ln), pics: all }];
  const vat = {}; (t.vat || []).forEach((x) => { const k = TK_RATES.find(([, r]) => r === num(x.rate)); if (k && x.ttc != null) vat[k[0]] = tkMoney(x.ttc); });
  const htTyped = t.ht != null && !(t.vat || []).length;
  S.tz = { id: t.id, busy: false, at: t.at, uid: t.uid, date: t.date || dayKey(), total: t.total != null ? tkMoney(t.total) : "", covers: t.covers != null ? String(t.covers) : "", ht: htTyped ? tkMoney(t.ht) : "", vat, vatOpen: t.ht != null || (t.vat || []).length > 0, stockOff: !!t.stockOff,
    parts, cur: 0, keepIds: (t.photoIds || []).slice(urls.length) };
  tkUsePart(S.tz); S.ui.tzQ = "";
}

/* ───────── pavé numérique (téléphone) : quantité ou montant, dernières valeurs ───────── */
const TK_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"];
function tkKpHtml() {
  const K = S.ui.tzKp; const T = S.tz; const l = K && T && T.lines[K.i]; if (!l) return "";
  const last = tkLast(l.libelle, T.id); const q = num(l.quantite); const isQ = K.f === "q";
  const chips = [];
  if (isQ && last && last.q) chips.push(`<button class="chip" data-act="tzKpSet" data-v="${last.q}">Comme le dernier ticket · ${tkN(last.q)}</button>`);
  if (!isQ && last && last.pu && q) chips.push(`<button class="chip" data-act="tzKpSet" data-v="${tkR2(last.pu * q)}">${tkN(q)} × ${tkEur(last.pu)}</button>`);
  const val = K.buf === "" ? (isQ ? "0" : "0,00") : K.buf; const next = K.i < T.lines.length - 1;
  return `<div class="tk-kp"><div style="min-width:0"><div class="h2 tk-kpt" style="font-size:20px">${esc(l.libelle)}</div><div class="sub">Ligne ${K.i + 1} sur ${T.lines.length}${last ? ` · dernier ticket : ${tkN(last.q)}${last.m != null ? ` · ${tkEur(last.m)}` : ""}` : ""}</div></div>
    <div class="seg tk-seg"><button class="${isQ ? "on" : ""}" data-act="tzKpF" data-v="q">Quantité</button><button class="${!isQ ? "on" : ""}" data-act="tzKpF" data-v="m">Montant €</button></div>
    <div class="tk-kpv ${K.buf === "" ? "empty" : ""}" id="tkKpV"><span class="mono">${esc(val)}</span><small>${isQ ? tkU(num(K.buf) || 0, "vendu") : "€"}</small></div>
    <div class="tk-kpc">${chips.join("")}</div>
    <div class="keypad tk-keys">${TK_KEYS.map((k) => `<button data-act="tzKpKey" data-v="${k}" aria-label="${k === "del" ? "Effacer" : k}">${k === "del" ? ico("tkdel") : k}</button>`).join("")}</div>
    <div class="grid2"><button class="btn soft" data-act="tzKpOk">${ico("check")}OK</button><button class="btn acc" data-act="tzKpNext">${next ? `Suivant${ico("tkr")}` : `${ico("check")}Terminer`}</button></div></div>`;
}
function tkKpPaint() { const b = $("#sheetBody"); if (b && S.ui.tzKp) b.innerHTML = tkKpHtml(); }
function tkKpLoad(i, f = "q") { const l = S.tz.lines[i]; S.ui.tzKp = { i, f, buf: String((f === "q" ? l.quantite : l.montant) ?? ""), fresh: true }; }
function tkKpCommit() {
  const K = S.ui.tzKp; if (!K || !S.tz) return; const l = S.tz.lines[K.i]; if (!l) return;
  if (K.f === "q") {
    let v = num(K.buf); if (v != null && v > TK_MAXQ) v = TK_MAXQ; l.quantite = K.buf === "" ? "" : tkTrim(fmt(v ?? 0, 2));
    const last = tkLast(l.libelle, S.tz.id); if (last && last.pu && v && (!String(l.montant || "").trim() || l.mAuto)) { l.montant = tkMoney(last.pu * v); l.mAuto = true; }
  } else { l.montant = K.buf; l.mAuto = false; }
}
/* clavier commun (pavé de quantité et pavé de conversion) */
function tkKeyIn(b, k, maxLen = 7) {
  if (k === "del") return b.slice(0, -1);
  if (k === ",") return b.includes(",") ? null : (b || "0") + ",";
  if (b === "0") b = ""; const dec = b.split(",")[1]; if (dec != null && dec.length >= 2) return null; if (b.replace(",", "").length >= maxLen) return null; return b + k;
}

Object.assign(ACT, {
  tkPer: (a, id, v) => { S.ui.tkPer = v; SFX.tick(); rerender(); },
  tkDay: (a, id, v) => { S.ui.tkDay = v; SFX.tick(); buzz(4); rerender(); },
  tzManual: () => { const t = S.tickets.find((x) => x.date === dayKey()); if (t) tkEditFrom(t); else tkNew(); SFX.tap(); go("tzEdit"); },
  tzOther: () => { tkNew(addDays(dayKey(), -1)); if (S.tickets.some((x) => x.date === S.tz.date)) S.tz.date = ""; SFX.tap(); go("tzEdit"); },
  tzOpen: (a, id) => { const t = S.tickets.find((x) => x.id === id); if (!t) return; closeSheet(true); tkEditFrom(t); SFX.tap(); if (S.route === "tzEdit") rerender(); else go("tzEdit"); },
  /* compléter plus tard : ouvre le ticket sur une nouvelle partie vide */
  tzAddPart: (a, id) => { const t = S.tickets.find((x) => x.id === id); if (!t) return; closeSheet(true); tkEditFrom(t); S.tz.parts.push({ lines: [], pics: [] }); S.tz.cur = S.tz.parts.length - 1; tkUsePart(S.tz); SFX.tap(); if (S.route === "tzEdit") rerender(); else go("tzEdit"); toast(`Partie ${S.tz.parts.length} : ajoutez la suite du ticket`, "info"); },
  tzDate: (a, id, v) => { S.tz.date = v; SFX.tick(); rerender(); },
  tzPart: (a, id, v) => { const T = S.tz; T.cur = +v; S.ui.tzQ = ""; tkUsePart(T); SFX.tick(); buzz(4); rerender(); },
  tzPartAdd: () => { const T = S.tz; if (T.parts.length >= 8) { SFX.err(); toast("8 parties au maximum", "err"); return; } T.parts.push({ lines: [], pics: [] }); T.cur = T.parts.length - 1; tkUsePart(T); S.ui.tzQ = ""; SFX.ok(); buzz(6); rerender(); toast(`Partie ${T.parts.length} ajoutée : saisissez la suite`, "info"); },
  tzPartMove: (a, id, v) => { const T = S.tz; const i = T.cur, j = i + +v; if (i < 0 || j < 0 || j >= T.parts.length) return; [T.parts[i], T.parts[j]] = [T.parts[j], T.parts[i]]; T.cur = j; tkUsePart(T); SFX.tick(); buzz(4); rerender(); },
  tzPartDel: (a, id, v) => {
    const T = S.tz; const p = T.parts[T.cur]; if (!p) return;
    if ((p.lines.length || p.pics.length) && v !== "ok") { openSheet(`<div class="h2" style="font-size:20px">Supprimer la partie ${T.cur + 1} ?</div><p class="sub" style="margin:0">${tkPl(p.lines.length, "ligne")}${p.pics.length ? ` et ${tkPl(p.pics.length, "photo")}` : ""} disparaissent de ce ticket.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="tzPartDel" data-v="ok">Supprimer</button></div>`); return; }
    closeSheet(true); T.parts.splice(T.cur, 1); if (!T.parts.length) T.parts.push({ lines: [], pics: [] }); T.cur = Math.max(0, T.cur - 1); tkUsePart(T); SFX.close(); buzz(6); rerender();
  },
  tzDupKeep: (a, id, v) => { const l = S.tz.lines[+v]; if (!l) return; l.keep = !l.keep; SFX.tick(); buzz(4); rerender(); },
  tzAdd: (a, id, v) => {
    const name = (v || "").trim(); if (!name) return; const T = S.tz; const k = tkKey(name);
    let i = T.lines.findIndex((l) => tkKey(l.libelle) === k); const fromSearch = !!(S.ui.tzQ || "").trim();
    if (i >= 0) T.lines[i].quantite = tkTrim(fmt(Math.min(TK_MAXQ, (num(T.lines[i].quantite) || 0) + 1), 1)); else { T.lines.push({ libelle: name, quantite: "1", montant: "", noteId: id || "" }); i = T.lines.length - 1; }
    S.ui.tzBump = i; S.ui.tzQ = "";
    /* saisie rapide au téléphone : après une recherche, le pavé s'ouvre directement sur la quantité */
    if (fromSearch && tkCoarse()) S.ui.tzKpOpen = i; else S.ui.tzFocus = fromSearch;
    SFX.tap(); buzz(6); rerender();
  },
  tzInc: (a, id, v) => { const L = S.tz.lines[+v]; if (!L) return; if ((num(L.quantite) || 0) >= TK_MAXQ) { SFX.err(); return; } L.quantite = tkTrim(fmt((num(L.quantite) || 0) + 1, 1)); S.ui.tzBump = +v; SFX.tick(); buzz(4); rerender(); },
  tzDec: (a, id, v) => { const T = S.tz; const L = T.lines[+v]; if (!L) return; const q = num(L.quantite) || 0; if (q <= 1) { T.lines.splice(+v, 1); SFX.close(); } else { L.quantite = tkTrim(fmt(q - 1, 1)); S.ui.tzBump = +v; SFX.tick(); } buzz(4); rerender(); },
  tzUseSum: (a, id, v) => { S.tz.total = tkMoney(+v); SFX.tick(); rerender(); },
  tzCov: (a, id, v) => { const T = S.tz; const c = Math.max(0, Math.min(9999, Math.round(num(T.covers) || 0) + +v)); T.covers = c ? String(c) : ""; SFX.tick(); buzz(4); const i = $("#tzCov"); if (i) { i.value = T.covers; i.classList.remove("bump"); void i.offsetWidth; i.classList.add("bump"); } const g = $("#tzAvg"); if (g) g.innerHTML = tkFinHtml(T).avg; },
  tzVat: () => { S.tz.vatOpen = !S.tz.vatOpen; SFX.tick(); rerender(); },
  tzKp: (a, id, v) => { if (!S.tz || !S.tz.lines[+v]) return; tkKpLoad(+v, "q"); SFX.tap(); openSheet(tkKpHtml()); },
  tzKpF: (a, id, v) => { if (!S.ui.tzKp) return; tkKpCommit(); tkKpLoad(S.ui.tzKp.i, v); SFX.tick(); tkKpPaint(); },
  tzKpKey: (a, id, v) => {
    const K = S.ui.tzKp; if (!K) return; const b = tkKeyIn(K.fresh && v !== "del" ? "" : K.buf, v);
    if (b == null || (K.f === "q" && (num(b) || 0) > TK_MAXQ)) { SFX.err(); buzz(8); return; }
    K.buf = b; K.fresh = false; SFX.tick(); buzz(3); tkKpCommit();
    const el = $("#tkKpV"); if (el) { el.classList.toggle("empty", b === ""); $(".mono", el).textContent = b === "" ? (K.f === "q" ? "0" : "0,00") : b; $("small", el).textContent = K.f === "q" ? tkU(num(b) || 0, "vendu") : "€"; }
  },
  tzKpSet: (a, id, v) => { const K = S.ui.tzKp; if (!K) return; K.buf = String(v).replace(".", ","); K.fresh = true; tkKpCommit(); SFX.tick(); buzz(4); tkKpPaint(); },
  tzKpOk: () => { tkKpCommit(); const i = S.ui.tzKp?.i; S.ui.tzKp = null; closeSheet(true); SFX.ok(); S.ui.tzBump = i; rerender(); },
  tzKpNext: () => { tkKpCommit(); const K = S.ui.tzKp; if (!K) return; if (K.i < S.tz.lines.length - 1) { tkKpLoad(K.i + 1, "q"); SFX.tick(); buzz(4); tkKpPaint(); } else ACT.tzKpOk(); },
  tzPhoto: async () => {
    const [f] = await pickImage(); if (!f) return; const T = S.tz;
    try {
      const { blob, canvas } = await shrink(f, 1100, 0.62); const u = await upload(blob);
      if (u.id) T.pics.push({ src: u.url, id: u.id, url: u.url }); else { const d = canvas.toDataURL("image/jpeg", 0.6); T.pics.push({ src: d, data: d }); }
      SFX.ok(); buzz(8); rerender();
    } catch (e) { console.warn(e); SFX.err(); toast("Photo illisible, réessayez.", "err"); }
  },
  tzPhotoDel: (a, id, v) => { S.tz.pics.splice(+v, 1); SFX.close(); rerender(); },
  tzPick: async () => {
    const files = await pickImage(true); if (!files.length) return;
    const shr = await Promise.all(files.slice(0, 6).map((f) => shrink(f, 1800, 0.85)));
    tkNew(); S.tz.busy = true; S.tz.parts[0].pics.push(...shr.map((s) => ({ src: URL.createObjectURL(s.blob) }))); tkUsePart(S.tz);
    if (S.route === "tzEdit") rerender(); else go("tzEdit");
    const ups = Promise.all(shr.map((s) => upload(s.blob)));
    try {
      const r = await S.cap.sample.json(`Ces photos montrent, dans l'ordre, un ticket Z (clôture de caisse) d'un restaurant français, éventuellement en plusieurs morceaux qui se suivent. Extrais les ventes. Réponds uniquement en JSON : {"date":"AAAA-MM-JJ","total_ttc":nombre,"couverts":nombre,"lignes":[{"libelle":"","quantite":nombre,"montant":nombre}]}. Une ligne par article ou famille vendue, sans les totaux, taxes ni moyens de paiement. Nombres avec un point décimal.`, { images: shr.map((s) => s.blob), modelTier: "complex" });
      S.tz.date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : dayKey(); S.tz.total = r.total_ttc != null ? String(r.total_ttc).replace(".", ",") : ""; if (r.couverts) S.tz.covers = String(r.couverts);
      S.tz.parts[0].lines.push(...(r.lignes || []).map((l) => ({ libelle: l.libelle || "", quantite: l.quantite != null ? String(l.quantite).replace(".", ",") : "1", montant: l.montant != null ? String(l.montant).replace(".", ",") : "", noteId: "" })).filter((l) => l.libelle));
      SFX.ok();
    } catch (e) { S.tz.err = "Lecture automatique impossible. Ajoutez les plats à la main, ou reprenez les photos."; SFX.err(); }
    const u = await ups; const small = await Promise.all(shr.map((s) => shrink(s.blob, 1100, 0.6)));
    S.tz.parts[0].pics.splice(0, shr.length, ...shr.map((s, i) => (u[i] && u[i].id ? { src: u[i].url, id: u[i].id, url: u[i].url } : (() => { const d = small[i].canvas.toDataURL("image/jpeg", 0.6); return { src: d, data: d }; })())));
    S.tz.busy = false; tkUsePart(S.tz); if (S.route === "tzEdit") rerender();
  },
  tzSave: async (a, id, v) => {
    const T = S.tz; if (!T || T.saving) return; tkUsePart(T);
    const parts = T.parts.filter((p) => p.lines.some((l) => l.libelle.trim()) || p.pics.length);
    const lines = tkMerge(parts).lines;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(T.date || "")) { SFX.err(); toast("Choisissez la date du ticket.", "err"); return; }
    const tot = tkNum(T.total);
    if (String(T.total ?? "").trim() && (tot == null || tot < 0)) { SFX.err(); toast("Chiffre d'affaires illisible : tapez par exemple 1 234,50", "err"); $("#tzTotal")?.focus(); return; }
    const cov = String(T.covers ?? "").trim() ? Math.round(num(T.covers)) : null;
    if (cov != null && (isNaN(cov) || cov < 0)) { SFX.err(); toast("Nombre de couverts illisible.", "err"); return; }
    if (!lines.length && tot == null) { SFX.err(); toast("Ajoutez au moins un plat ou le chiffre d'affaires.", "err"); return; }
    const dup = v === "dup" ? null : S.tickets.find((t) => t.date === T.date && t.id !== T.id);
    if (dup && v !== "dup") { SFX.err(); openSheet(`<div class="h2" style="font-size:20px">Un ticket existe déjà pour ${tkDupLabel(T.date)}</div><p class="sub" style="margin:0">Ouvrez-le pour le corriger ou lui ajouter une partie, ou ajoutez ce ticket en plus (deuxième service, par exemple).</p><div class="grid2"><button class="btn soft" data-act="tzSave" data-v="dup">Ajouter en plus</button><button class="btn acc" data-act="tzOpen" data-id="${dup.id}">Ouvrir l'existant</button></div>`); return; }
    if (v === "dup") closeSheet(true);
    T.saving = true; const btn = $("#viewport .view:not(.leave) [data-act=tzSave]"); btn && btn.setAttribute("disabled", "");
    const V = tkVatCalc(T);
    /* photos : données d'abord, puis liens ; chaque partie retient l'indice de ses photos */
    const allPics = parts.flatMap((p) => p.pics); const dataPics = allPics.filter((p) => p.data); const urlPics = allPics.filter((p) => !p.data && p.url && p.id);
    const idxOf = (p) => (p.data ? dataPics.indexOf(p) : urlPics.includes(p) ? dataPics.length + urlPics.indexOf(p) : -1);
    const clean = (l) => { const o = { libelle: l.libelle.trim(), quantite: Math.min(TK_MAXQ, num(l.quantite)), montant: tkNum(l.montant) }; const r = tkRecipeFor(l); if (r) o.noteId = r.id; return o; };
    const d = { date: T.date, total: tot, ht: V.ht != null ? tkR2(V.ht) : null, vat: V.rows, covers: cov,
      lines: lines.map(clean),
      parts: parts.length > 1 ? parts.map((p) => ({ lines: p.lines.filter((l) => l.libelle.trim() && (num(l.quantite) || 0) > 0).map((l) => ({ ...clean(l), ...(l.keep ? { keep: true } : {}) })), picIdx: p.pics.map(idxOf).filter((j) => j >= 0) })) : null,
      photoIds: [...urlPics.map((p) => p.id), ...(T.keepIds || [])], photoUrls: urlPics.map((p) => p.url), photos: dataPics.map((p) => p.data),
      at: T.at || Date.now(), uid: T.uid || S.me.id, updatedAt: Date.now() };
    let tid = T.id;
    try {
      if (T.id) { await safe(DB.update("tickets", T.id, d)); await logEvent("ticket", `a modifié le ticket Z du ${shortDate(T.date)}`, { ref: T.id }); }
      else { tid = await safe(DB.add("tickets", d)); await logEvent("ticket", `a enregistré le ticket Z du ${shortDate(T.date)}${d.total != null ? ` · ${tkEur(d.total)}` : ""}`, { ref: tid }); }
    } catch (e) { T.saving = false; btn && btn.removeAttribute("disabled"); return; }
    const res = await tkSyncStock({ ...d, id: tid, stockOff: T.stockOff });
    S.tz = null; S.ui.tkDay = d.date; SFX.done(); buzz([10, 40, 10]); burst(); goBack();
    if (res.done.length || (res.unlinked.length && S.products.length)) setTimeout(() => tkShowRecap(tid, res), 420);
    else toast(T.id ? "Ticket modifié" : "Ticket Z enregistré");
  },
  tzDel: () => openSheet(`<div class="h2" style="font-size:20px">Supprimer ce ticket ?</div><p class="sub" style="margin:0">Le ticket Z du ${shortDate(S.tz.date)} et sa photo disparaissent de l'historique${tkMovesOf(S.tz.id).length ? ", et ses ventes reviennent dans le stock" : ""}.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="tzDelOk">Supprimer</button></div>`),
  tzDelOk: async () => {
    const T = S.tz; if (!T || !T.id || T.deleting) return; T.deleting = true; closeSheet(true);
    const old = S.tickets.find((t) => t.id === T.id); const copy = old ? JSON.parse(JSON.stringify(old)) : null; if (copy) delete copy.id;
    const mv = tkMovesOf(T.id).map((m) => { const c = { ...m }; delete c.id; return { id: m.id, data: c }; });
    try { await safe(DB.del("tickets", T.id)); } catch (e) { T.deleting = false; return; }
    for (const m of mv) await DB.del("moves", m.id).catch(() => {});
    await logEvent("ticket", `a supprimé le ticket Z du ${shortDate(T.date)}`, { ref: T.id }); S.tz = null; SFX.close(); buzz(8); goBack();
    S.ui.tkUndo = copy ? { id: T.id, data: copy, mv } : null; toast("Ticket supprimé");
    if (copy) { $("#toastTx").innerHTML = `Ticket supprimé <button data-act="tkUndoDel" class="tk-undo">Annuler</button>`; const t = $("#toast"); t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); S.ui.tkUndo = null; }, 5000); }
  },
  tkUndoDel: async () => { const u = S.ui.tkUndo; if (!u) return; S.ui.tkUndo = null; $("#toast").classList.remove("on"); try { await safe(DB.set("tickets", u.id, u.data)); for (const m of u.mv || []) await DB.set("moves", m.id, m.data).catch(() => {}); SFX.ok(); buzz(6); toast("Ticket restauré"); } catch (e) {} },
  ticket: (a, id) => {
    const t = S.tickets.find((x) => x.id === id); if (!t) return; const C = tkConsumption([t]); const ph = tkPhotos(t); const hasM = (t.lines || []).some((l) => l.montant != null);
    const mv = tkMovesOf(t.id); const unl = S.products.length ? tkUnlinkedFor([t]) : []; const ht = tkHtOf(t); const np = (t.parts || []).length;
    openSheet(`<div class="row" style="align-items:flex-start"><div style="min-width:0"><div class="h2" style="font-size:20px">Ticket Z · ${t.date ? tkDayLabel(t.date, true) : "?"}</div><div class="sub">par ${esc(firstName(nameOf(t.uid)))} · ${when(t.at)}${np > 1 ? ` · ${np} parties` : ""}</div></div><button class="btn soft sm" data-act="tzOpen" data-id="${t.id}">${ico("edit")}Modifier</button></div>
      <div class="tk-sheetca"><span class="lbl">Chiffre d'affaires TTC</span><b class="mono">${t.total != null ? tkEur(t.total) : "–"}</b></div>
      ${t.covers || ht != null ? `<div class="tk-sfin">${t.covers ? `<span><em>Couverts</em><b class="mono">${tkN(t.covers)}</b></span>${t.total ? `<span><em>Panier moyen</em><b class="mono">${tkEur(t.total / t.covers)}</b></span>` : ""}` : ""}${ht != null ? `<span><em>HT</em><b class="mono">${tkEur(ht)}</b></span>${t.total ? `<span><em>TVA</em><b class="mono">${tkEur(t.total - ht)}</b></span>` : ""}` : ""}</div>` : ""}
      ${(t.lines || []).length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Plat</th><th class="n">Qté</th>${hasM ? `<th class="n">Montant</th>` : ""}</tr></thead><tbody>${t.lines.map((l) => `<tr><td>${esc(l.libelle)}</td><td class="n">${l.quantite != null ? tkN(l.quantite) : ""}</td>${hasM ? `<td class="n">${l.montant != null ? tkEur(l.montant) : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : ""}
      ${mv.length || unl.length || t.stockOff ? `<div class="tk-sstock"><span class="lbl">Stock</span>${t.stockOff ? `<div class="tk-hint">${ico("alert")}<span>Déduction annulée.</span></div><button class="btn soft sm" data-act="tkStockRedo" data-id="${t.id}" style="align-self:flex-start">${ico("box")}Déduire du stock</button>` : `${mv.length ? `<div class="tk-mvs">${mv.map(tkDoneRow).join("")}</div>` : ""}${unl.length ? tkUnlinkedRows(unl, t.id) : ""}${mv.length ? `<button class="btn ghost sm" data-act="tkStockUndo" data-id="${t.id}" style="align-self:flex-start">${ico("tkundo")}Annuler la déduction</button>` : ""}`}</div>` : ""}
      ${ph.length ? `<div class="tk-shots">${ph.map((s) => `<img src="${esc(s)}" alt="Photo du ticket Z">`).join("")}</div>` : ""}
      ${C.rows.length ? `<div><span class="lbl">Consommation théorique</span><div class="tk-cons">${C.rows.map((r) => `<div class="li"><div class="tx"><b>${esc(r.name)}</b></div><span class="mono tk-q">${tkQty(r.v, r.base)}</span></div>`).join("")}</div></div>` : ""}
      <div class="grid2 tk-sfoot"><button class="btn soft" data-act="tzAddPart" data-id="${t.id}">${ico("tkparts")}Ajouter une partie</button><button class="btn soft" data-act="sheetClose">Fermer</button></div>`);
  },

  /* ventes → stock */
  tkStockUndo: async (a, id) => {
    for (const m of tkMovesOf(id)) await DB.del("moves", m.id).catch(() => {});
    await DB.update("tickets", id, { stockOff: true }).catch(() => {}); logEvent("stock", `a annulé la déduction du stock du ticket Z`, { ref: id });
    SFX.close(); buzz(8); closeSheet(true); toast("Déduction annulée : le stock est remis"); refresh();
  },
  tkStockRedo: async (a, id) => {
    await DB.update("tickets", id, { stockOff: false }).catch(() => {}); const t = tkAllTickets().find((x) => x.id === id) || S.tickets.find((x) => x.id === id); if (!t) return;
    const res = await tkSyncStock({ ...t, stockOff: false }); SFX.ok(); buzz(8); tkShowRecap(id, res); refresh();
  },
  tkGoStock: () => { closeSheet(true); S.ui.tkL = null; go("stock"); },
  tkLink: (a, id, v) => {
    const label = (v || "").trim(); if (!label) return; const ex = tkLinkOf(label); const has = ex && !ex.ignore && tkProd(ex.productId);
    S.ui.tkL = { label, key: tkKey(label), tid: (a && a.dataset.t) || "", pid: has ? ex.productId : "", step: has ? "conv" : "prod", soldUnit: has ? ex.soldUnit || "" : "", inUnit: has ? ex.inUnit || "" : "", buf: has && ex.inFactor != null ? String(ex.inFactor).replace(".", ",") : "", fresh: true };
    if (has) tkLDefaults(); SFX.tap(); openSheet(tkLinkHtml(), tkLinkAfter);
  },
  tkLPick: (a, id) => { const L = S.ui.tkL; if (!L) return; L.pid = id; L.step = "conv"; L.inUnit = ""; L.buf = ""; tkLDefaults(); SFX.tick(); buzz(4); openSheet(tkLinkHtml(), tkLinkAfter); },
  tkLBack: () => { const L = S.ui.tkL; if (!L) return; L.step = "prod"; SFX.tick(); openSheet(tkLinkHtml(), tkLinkAfter); },
  tkLSold: (a, id, v) => { const L = S.ui.tkL; if (!L) return; L.soldUnit = v; if (L.fresh) L.buf = String(tkGuessFactor(v, L.inUnit)).replace(".", ","); SFX.tick(); openSheet(tkLinkHtml(), tkLinkAfter); },
  tkLUnit: (a, id, v) => { const L = S.ui.tkL; if (!L) return; L.inUnit = v; if (L.fresh) L.buf = String(tkGuessFactor(L.soldUnit, v)).replace(".", ","); SFX.tick(); openSheet(tkLinkHtml(), tkLinkAfter); },
  tkLKey: (a, id, v) => {
    const L = S.ui.tkL; if (!L) return; const b = tkKeyIn(L.fresh && v !== "del" ? "" : L.buf, v, 6); if (b == null) { SFX.err(); buzz(8); return; }
    L.buf = b; L.fresh = false; SFX.tick(); buzz(3); const el = $("#tkLv"); if (el) { el.querySelector(".mono").textContent = b || "0"; el.classList.toggle("empty", !b); } const ex = $("#tkLex"); if (ex) ex.innerHTML = tkLExample();
  },
  tkLSave: async () => {
    const L = S.ui.tkL; if (!L || L.saving) return; const p = tkProd(L.pid); const f = num(L.buf); if (!p) return; if (!f || f <= 0) { SFX.err(); toast("Indiquez combien sort du stock pour 1 vendu.", "err"); return; }
    const conv = tkAltUnits(p.unit).find((x) => x.u === (L.inUnit || p.unit))?.k || 1;
    const doc = { key: L.key, label: L.label, productId: p.id, factor: Math.round(f * conv * 10000) / 10000, soldUnit: L.soldUnit || "", inUnit: L.inUnit || p.unit, inFactor: f, at: Date.now(), uid: S.me.id };
    L.saving = true; try { await safe(DB.set("tkLinks", tkLinkId(L.key), doc)); } catch (e) { L.saving = false; return; }
    tkLinkLocal(doc); logEvent("stock", `a lié « ${L.label} » au produit ${p.name}`);
    /* appliquer tout de suite : le ticket d'où l'on vient, sinon les tickets des 7 derniers jours qui contiennent l'article */
    const since = addDays(dayKey(), -6);
    const list = L.tid ? tkAllTickets().filter((t) => t.id === L.tid) : tkAllTickets().filter((t) => (t.date || "") >= since && !t.stockOff && (t.lines || []).some((l) => tkKey(l.libelle) === L.key));
    let last = null; for (const t of list) last = await tkSyncStock(t);
    S.ui.tkL = null; SFX.done(); buzz([8, 30, 8]);
    if (L.tid && last) tkShowRecap(L.tid, last); else { closeSheet(true); toast(list.length ? `Lié · déduit de ${tkPl(list.length, "ticket")} récent${list.length > 1 ? "s" : ""}` : "Lien enregistré"); }
    refresh();
  },
  tkLIgnore: async () => {
    const L = S.ui.tkL; if (!L) return; const doc = { key: L.key, label: L.label, ignore: true, at: Date.now(), uid: S.me.id };
    try { await safe(DB.set("tkLinks", tkLinkId(L.key), doc)); } catch (e) { return; } tkLinkLocal(doc);
    const tid = L.tid; S.ui.tkL = null; SFX.close();
    if (tid) tkShowRecap(tid); else closeSheet(true); toast(`« ${L.label} » ne sera plus proposé`, "info"); refresh();
  },
  tkLinks: () => { SFX.tap(); openSheet(tkLinksHtml()); },
  tkLinkDel: async (a, id) => { if (!S.tkLinks.some((l) => l.id === id)) return; await DB.del("tkLinks", id).catch(() => {}); S.tkLinks = S.tkLinks.filter((l) => l.id !== id); SFX.close(); buzz(6); openSheet(tkLinksHtml()); refresh(); },
});
/* mise à jour immédiate de S.tkLinks (en base partagée, la souscription suit) */
function tkLinkLocal(doc) { const id = tkLinkId(doc.key); S.tkLinks = [...S.tkLinks.filter((x) => x.id !== id), { id, ...doc }]; }

/* ───────── lier un article de caisse à un produit de stock ───────── */
const TK_SOLD = ["douzaine", "demi-douzaine", "pièce", "portion", "assiette", "verre", "bouteille", "lanière", "plateau"];
function tkAltUnits(pu) {
  const n = tkNorm(pu);
  const alt = n === "piece" ? [{ u: "douzaine", k: 12 }] : n === "douzaine" ? [{ u: "pièce", k: 1 / 12 }] : n === "kg" ? [{ u: "g", k: 0.001 }] : n === "g" ? [{ u: "kg", k: 1000 }] : n === "l" ? [{ u: "cl", k: 0.01 }] : n === "cl" ? [{ u: "L", k: 100 }] : [];
  return [{ u: pu || "pièce", k: 1 }, ...alt];
}
function tkGuessFactor(sold, unit) { const s = tkNorm(sold), u = tkNorm(unit); if (u === "piece") return s === "douzaine" ? 12 : s === "demi douzaine" ? 6 : 1; if (u === "douzaine") return s === "demi douzaine" ? 0.5 : 1; return 1; }
function tkLDefaults() {
  const L = S.ui.tkL; const p = tkProd(L.pid); if (!p) return;
  if (!L.soldUnit) { const lab = tkNorm(L.label), n = tkNorm(L.label + " " + p.name); L.soldUnit = /douz|\bdz\b/.test(lab) ? (/\bdemi\b|1 2/.test(lab) ? "demi-douzaine" : "douzaine") : /huitre|fine de claire|speciale|oyster/.test(n) ? "douzaine" : /verre|pression/.test(n) ? "verre" : /bouteille/.test(n) ? "bouteille" : "portion"; }
  if (!L.inUnit) L.inUnit = p.unit || "pièce";
  if (!L.buf) { L.buf = String(tkGuessFactor(L.soldUnit, L.inUnit)).replace(".", ","); L.fresh = true; }
}
function tkLExample() {
  const L = S.ui.tkL; const p = tkProd(L.pid); const f = num(L.buf) || 0; const n = 12;
  return `Exemple : ${tkQU(n, L.soldUnit)} au ticket → <b class="mono">−${tkQU(n * f, L.inUnit || p.unit)}</b> de ${esc(p.name)}`;
}
function tkLinkHtml() {
  const L = S.ui.tkL; if (!L) return "";
  if (L.step === "prod") {
    if (!S.products.length) return `<div class="tk-lsh"><div class="h2" style="font-size:20px">Lier « ${esc(L.label)} »</div><div class="empty" style="padding:6px 0">Votre stock n'a encore aucun produit. Créez-les dans Stock (par exemple « Huîtres fines de claire n°3 », à la pièce), puis revenez lier vos ventes.</div><div class="grid2"><button class="btn soft" data-act="sheetClose">Plus tard</button><button class="btn acc" data-act="tkGoStock">${ico("box")}Ouvrir le stock</button></div></div>`;
    const k = tkKey(L.label).split(" ").filter((w) => w.length > 2);
    const score = (p) => { const n = tkKey(p.name); return k.reduce((a, w) => a + (n.includes(w) ? w.length : 0), 0); };
    const ps = [...S.products].map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, "fr"));
    const best = ps[0] && ps[0].s >= 4 ? ps[0].p : null;
    const row = (p, sug) => `<button class="tk-prod ${sug ? "sug" : ""}" data-act="tkLPick" data-id="${p.id}" data-q="${esc(tkNorm(p.name + " " + (p.supplier || "")))}"><span class="tx"><b>${esc(p.name)}</b><em>${sug ? "<i>Suggestion</i> · " : ""}compté en ${esc(p.unit || "pièce")}</em></span>${ico("chev")}</button>`;
    return `<div class="tk-lsh"><div><div class="sub">Article de caisse</div><div class="h2" style="font-size:20px">${esc(L.label)}</div></div>
      <span class="lbl">Quel produit du stock sort quand il est vendu ?</span>
      <div class="tk-search"><span class="tk-sico">${ico("search")}</span><input class="input" id="tkLq" placeholder="Chercher un produit…" autocomplete="off"></div>
      <div class="tk-prods" id="tkLlist">${best ? row(best, true) : ""}${ps.filter((x) => x.p !== best).map((x) => row(x.p)).join("")}</div>
      <div class="grid2"><button class="btn ghost" data-act="tkLIgnore">Pas en stock</button><button class="btn soft" data-act="sheetClose">Plus tard</button></div></div>`;
  }
  const p = tkProd(L.pid); const units = tkAltUnits(p.unit);
  return `<div class="tk-lsh"><div class="row" style="align-items:flex-start"><div style="min-width:0"><div class="sub tk-lpath">${esc(L.label)} ${ico("tkr")} ${esc(p.name)}</div><div class="h2" style="font-size:20px">Pour 1 vendu, combien sort du stock ?</div></div><button class="btn ghost sm" data-act="tkLBack">Changer</button></div>
    <span class="lbl">Vendu à la…</span><div class="tk-chips">${TK_SOLD.map((u) => `<button class="chip ${L.soldUnit === u ? "on" : ""}" data-act="tkLSold" data-v="${u}">${u}</button>`).join("")}</div>
    <div class="tk-eq"><span>1 ${esc(L.soldUnit)} =</span><div class="tk-kpv ${L.buf ? "" : "empty"}" id="tkLv"><span class="mono">${esc(L.buf || "0")}</span></div></div>
    ${units.length > 1 ? `<div class="seg tk-seg">${units.map((x) => `<button class="${(L.inUnit || p.unit) === x.u ? "on" : ""}" data-act="tkLUnit" data-v="${esc(x.u)}">${esc(tkU(2, x.u))}</button>`).join("")}</div>` : `<div class="tk-unit1">${esc(tkU(2, p.unit || "pièce"))} <em>· unité du produit</em></div>`}
    <div class="keypad tk-keys sm">${TK_KEYS.map((k) => `<button data-act="tkLKey" data-v="${k}" aria-label="${k === "del" ? "Effacer" : k}">${k === "del" ? ico("tkdel") : k}</button>`).join("")}</div>
    <div class="tk-lex" id="tkLex">${tkLExample()}</div>
    <button class="btn acc block" data-act="tkLSave">${ico("tklink")}Lier et déduire</button></div>`;
}
/* au clavier (ordinateur) : chiffres, virgule, effacer, Entrée dans les pavés */
document.addEventListener("keydown", (e) => {
  if (!$("#sheet").classList.contains("open") || e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; if (t && /INPUT|TEXTAREA/.test(t.tagName)) return;
  const k = /^[0-9]$/.test(e.key) ? e.key : e.key === "," || e.key === "." ? "," : e.key === "Backspace" ? "del" : e.key === "Enter" ? "enter" : null; if (!k) return;
  if (S.ui.tkL && S.ui.tkL.step === "conv" && $("#tkLv")) { e.preventDefault(); if (k === "enter") ACT.tkLSave(); else ACT.tkLKey(null, null, k); }
  else if (S.ui.tzKp && $("#tkKpV")) { e.preventDefault(); if (k === "enter") ACT.tzKpNext(); else ACT.tzKpKey(null, null, k); }
});
function tkLinkAfter(b) {
  const q = $("#tkLq", b); if (!q) return;
  q.addEventListener("input", () => { const n = tkNorm(q.value); $$(".tk-prod", b).forEach((r) => { r.hidden = !!n && !r.dataset.q.includes(n); }); });
}
function tkLinksHtml() {
  const L = [...S.tkLinks].sort((a, b) => (a.label || "").localeCompare(b.label || "", "fr"));
  return `<div class="h2" style="font-size:20px">Liens caisse → stock</div><p class="sub" style="margin:0">Chaque article de caisse lié sort du stock à chaque ticket Z. Touchez un lien pour le modifier.</p>
    <div class="tk-lks">${L.map((x) => { const p = tkProd(x.productId); return `<div class="tk-lk"><button class="tx" data-act="tkLink" data-v="${esc(x.label)}"><b>${esc(x.label)}</b><em>${x.ignore ? "hors stock" : p ? `1 ${esc(x.soldUnit || "vendu")} = ${tkQU(x.inFactor ?? x.factor, x.inUnit || p.unit)} · ${esc(p.name)}` : "produit supprimé"}</em></button><button class="iconbtn" data-act="tkLinkDel" data-id="${x.id}" aria-label="Supprimer le lien ${esc(x.label)}">${ico("trash")}</button></div>`; }).join("") || `<div class="empty">Aucun lien pour l'instant.</div>`}</div>
    <button class="btn soft block" data-act="sheetClose">Fermer</button>`;
}
