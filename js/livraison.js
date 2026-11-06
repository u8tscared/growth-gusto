/* Growth Gusto — area: livraison (route « livraison »). Prefix « lv ».
   Uber Eats, Deliveroo, Just Eat : PAS de liaison directe (réservée aux logiciels agréés par les plateformes, ou payante via un
   agrégateur). Le restaurant télécharge son relevé (CSV ou Excel) dans son espace plateforme et le dépose ici :
   - chiffre d'affaires du jour : une vente « sales/{plateforme}_csv_{jour} » (même forme que js/caisse.js), donc un ticket Z
     « tickets/pos_{plateforme}_{jour} » : compté dans Finances et le Tableau de bord, stock déduit selon les fiches recettes reliées
     (même liaison article → fiche que la caisse, posMap / tkLinks) ;
   - commissions : une charge « expenses/lv_{plateforme}_{jour} » (cat « commissions ») dans Finances ;
   - la vraie marge de chaque plat vendu en livraison, commission retirée, comparée à la salle.
   Si les commandes arrivent déjà dans la caisse (caisse reliée à la plateforme), « inPos » : on ne crée pas de ventes (sinon le
   chiffre compterait deux fois), on garde les commissions.
   Données (sous restos/{rid}/) :
     lvDays/{plateforme}_{jour}  { provider, day, at, gross (TTC client), commission (HT), net (versé), orders, items:[{name,qty,amount}], file, importedAt, uid }
     livraison/{plateforme}      { provider, inPos, lastImport, file, from, to }
   Commandes en direct sur l'écran de la cuisine : bientôt, en option (agrégateur payant par restaurant). */
"use strict";

TAB_OF.livraison = "more";
(function lvNav() { if (NAV.some((n) => n[0] === "livraison")) return; const i = NAV.findIndex((n) => n[0] === "caisse"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["livraison", "lvBike", "Livraison"]); })();
try { if (typeof AB_GATE !== "undefined") Object.assign(AB_GATE, { livraison: ["pro", "Livraison"] }); } catch (e) {}
try { if (typeof FIN_CATS !== "undefined" && !FIN_CATS.some((c) => c.k === "commissions")) FIN_CATS.splice(FIN_CATS.length - 1, 0, { k: "commissions", t: "Commissions livraison", ic: "lvBike" }); } catch (e) {}
Object.assign(IC, {
  lvBike: ["c:5.5,17.5,2.5", "c:18.5,17.5,2.5", "M8 17.5h7.5l2.5-6.5", "M14 6.5h2.5l2 5", "M3 11.5h7l2 3", "f:M3 11.5h7l2 3H8a3 3 0 0 0-5 0z"],
  lvBag: ["M5 8h14l-1 12H6L5 8Z", "M9 8V6.5a3 3 0 0 1 6 0V8", "M9.5 13h5", "f:M5 8h14l-1 12H6z"],
  lvSoon: ["c:12,12,9", "M12 7v5l3 2"],
});

/* ───────── les plateformes ───────── */
const LV_PF = [
  { id: "ubereats", name: "Uber Eats", mono: "U", well: "w-sa", rate: 0.3,
    steps: ["Sur ordinateur, ouvrez Uber Eats Manager (merchants.ubereats.com).", "Rapports → Détails des paiements, ou Ventes par article. Choisissez les dates, puis Télécharger en CSV.", "Déposez le fichier ici : jours, commandes et commissions sont lus."] },
  { id: "deliveroo", name: "Deliveroo", mono: "D", well: "w-sk", rate: 0.3,
    steps: ["Sur ordinateur, ouvrez le Partner Hub Deliveroo.", "Factures ou Commandes → choisissez la période → téléchargez le CSV des commandes.", "Déposez le fichier ici."] },
  { id: "justeat", name: "Just Eat", mono: "J", well: "w-to", rate: 0.28,
    steps: ["Sur ordinateur, ouvrez le Partner Centre Just Eat.", "Commandes ou Factures → choisissez la période → Exporter en CSV.", "Déposez le fichier ici."] },
];
const LV_IDS = new Set(LV_PF.map((p) => p.id));
const lvPf = (id) => LV_PF.find((p) => p.id === id) || LV_PF[0];
const lvWell = (p, cls = "") => `<span class="cx-mono ${p.well} ${cls}">${esc(p.mono)}</span>`;
const lvR2 = (v) => Math.round(v * 100) / 100;
const lvEur = (v, d = 2) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const lvEur0 = (v) => lvEur(v, Math.abs(v) >= 1000 ? 0 : 2);
const lvPct = (v) => (v == null || !isFinite(v) ? "–" : Math.round(v * 100) + " %");
const lvPl = (n, w, p) => `${Math.round(n).toLocaleString("fr-FR")} ${Math.abs(n) >= 2 ? p || w + "s" : w}`;
const lvCanWrite = () => (typeof cxCanWrite === "function" ? cxCanWrite() : true);

/* ───────── données ───────── */
let lvRid = null;
const lvRe = () => { if (S.route === "livraison") refresh(); };
function lvEnsure() {
  if (!S.rid || !S.resto) return;
  if (typeof cxEnsure === "function") cxEnsure();
  if (lvRid === S.rid && DB.mode !== "db" && !(DB.listeners[DB.path("lvDays")] || []).length) lvRid = null;
  if (lvRid === S.rid) return; lvRid = S.rid; S.lvDays = []; S.lvStat = [];
  if (DB.mode === "demo") lvDemoSeed();
  DB.watch("lvDays", { order: "at", dir: "desc", limit: 3000 }, (rows) => { S.lvDays = rows; lvRe(); });
  DB.watch("livraison", {}, (rows) => { S.lvStat = rows; lvRe(); });
}
window.addEventListener("gg:ready", () => setTimeout(() => { try { lvEnsure(); } catch (e) { console.warn(e); } }, 600));
const lvStatOf = (id) => (S.lvStat || []).find((x) => x.id === id) || null;
const lvInPos = (id) => !!(lvStatOf(id) || {}).inPos;
const lvDayOf = (prov, day) => (S.lvDays || []).find((x) => x.provider === prov && x.day === day) || null;

function lvStats(days, prov) {
  const from = addDays(dayKey(), -(days - 1)); const L = (S.lvDays || []).filter((x) => (x.day || "") >= from && (!prov || x.provider === prov));
  const o = { gross: 0, commission: 0, net: 0, orders: 0, days: new Set(), by: {} };
  L.forEach((x) => {
    const g = num(x.gross) || 0, c = num(x.commission) || 0, n = num(x.net) != null ? num(x.net) : g - c;
    o.gross += g; o.commission += c; o.net += n; o.orders += num(x.orders) || 0; o.days.add(x.day);
    const b = (o.by[x.provider] ||= { gross: 0, commission: 0, net: 0, orders: 0 }); b.gross += g; b.commission += c; b.net += n; b.orders += num(x.orders) || 0;
  });
  o.rate = o.gross ? o.commission / o.gross : null;
  return o;
}
/* each dish sold on the platforms: what it really earns once the commission is taken, vs the same dish in the dining room */
function lvDishes(days) {
  const from = addDays(dayKey(), -(days - 1)); const st = lvStats(days); const m = new Map();
  const rate = (p) => { const b = st.by[p]; return b && b.gross && b.commission ? b.commission / b.gross : lvPf(p).rate; };
  (S.lvDays || []).filter((x) => (x.day || "") >= from).forEach((x) => (x.items || []).forEach((it) => {
    const k = typeof cxKey === "function" ? cxKey(it.name) : String(it.name).toLowerCase(); const q = num(it.qty) || 0; if (!k || !q) return;
    const e = m.get(k) || { label: String(it.name).trim(), q: 0, amt: 0, com: 0 }; const a = num(it.amount) || 0;
    e.q += q; e.amt += a; e.com += a * rate(x.provider); m.set(k, e);
  }));
  return [...m.values()].map((e) => {
    const s = typeof cxState === "function" ? cxState(e.label) : { st: "todo" }; let cost = null, room = null;
    if (s.st === "rec" && s.r && typeof mgDish === "function") {
      try { const d = mgDish(s.r); const per = num(s.per) || 1; if (d.known > 0) cost = d.cost * per; if (per === 1 && d.margin != null && d.known > 0) room = d.margin; } catch (err) {}
    }
    const price = e.amt / e.q; const earn = cost != null && e.amt ? (e.amt / 1.1 - e.com) / e.q - cost : null;
    return { ...e, st: s.st, price, earn, room, cost };
  }).sort((a, b) => b.amt - a.amt || b.q - a.q);
}

/* ───────── vue ───────── */
VIEWS.livraison = {
  render() {
    lvEnsure(); const per = S.ui.lvPer || 30; const st = lvStats(per); const has = (S.lvDays || []).length > 0;
    const seg = [[7, "7 jours"], [30, "30 jours"], [90, "3 mois"]];
    return `<div class="inner cx lv">${topBar("Livraison")}
      ${has ? `<div class="seg cx-seg st" style="--i:1">${seg.map(([k, t]) => `<button class="${per === k ? "on" : ""}" data-act="lvPer" data-v="${k}">${t}</button>`).join("")}</div>` : ""}
      <div class="cols"><div>${has ? lvHeroHtml(st, per) : lvIntroHtml()}${has ? lvDishCardHtml(per) : ""}</div>
      <div>${lvPfCardHtml(st)}${lvHonestHtml()}</div></div></div>`;
  },
};

function lvIntroHtml() {
  return `<div class="glass wall cx-intro st" style="--i:1"><span class="cx-introic">${ico("lvBike")}</span><b>Vos ventes en livraison</b><span>Déposez le relevé Uber Eats, Deliveroo ou Just Eat : chiffre, commissions, stock et vraie marge de chaque plat.</span></div>`;
}
function lvHeroHtml(st, per) {
  const pm = st.orders ? st.gross / st.orders : null; const P = LV_PF.filter((p) => st.by[p.id] && st.by[p.id].gross);
  const bar = (p) => { const b = st.by[p.id]; const w = st.gross ? Math.max(4, Math.round((b.gross / st.gross) * 100)) : 0;
    return `<div class="lv-pr"><span class="lv-pn">${esc(p.name)}</span><span class="lv-bar"><i class="${p.well}" style="width:${w}%"></i></span><b class="mono">${lvEur0(b.gross)}</b><em>${b.commission ? `${lvPct(b.commission / b.gross)} de commission` : "commission non lue"}</em></div>`; };
  return `<div class="glass wall cx-hero lv-hero st" style="--i:2">
    <div class="cx-ca"><span>${per === 7 ? "7 derniers jours" : per === 90 ? "3 derniers mois" : "30 derniers jours"}</span><b class="mono">${Math.round(st.gross).toLocaleString("fr-FR")}<small> € TTC</small></b><em>${st.orders ? `${lvPl(st.orders, "commande")} · panier moyen ${lvEur(pm)}` : `${lvPl(st.days.size, "jour")} importé${st.days.size > 1 ? "s" : ""}`}</em></div>
    <div class="lv-kpi"><div><span>Commissions</span><b class="mono">${lvEur0(st.commission)}</b><em>${st.rate != null ? lvPct(st.rate) + " du chiffre" : "–"}</em></div><div><span>Versé sur votre compte</span><b class="mono">${lvEur0(st.net)}</b><em>après commissions</em></div></div>
    ${P.length ? `<div class="lv-prs">${P.map(bar).join("")}</div>` : ""}
    <div class="cx-hb"><span class="cx-feeds"><button data-go="tickets">${ico("receipt")}Tickets</button><button data-go="finance">${ico("euro")}Finances</button><button data-go="stock">${ico("box")}Stock</button></span></div></div>`;
}
function lvDishCardHtml(per) {
  const L = lvDishes(per); if (!L.length) return `<div class="glass pad st lv-dish" style="--i:3"><b class="h3">Ce que rapporte chaque plat</b><div class="sub">Importez aussi le rapport des ventes par article pour voir chaque plat et déduire le stock.</div></div>`;
  const row = (a, i) => {
    const right = a.earn != null ? `<b class="mono ${a.earn < 0 ? "bad" : ""}">${lvEur(a.earn)}</b><em>${a.room != null ? `en salle ${lvEur(a.room)}` : "par plat vendu"}</em>`
      : a.st === "rec" ? `<em class="lv-miss">Coût de la fiche à compléter</em>` : `<button class="btn soft sm" data-act="cxMap" data-v="${esc(a.label)}">${ico("tklink")}Relier</button>`;
    return `<div class="lv-drow st" style="--i:${Math.min(i, 8) + 4}"><div class="tx"><b>${esc(a.label)}</b><span>×${Math.round(a.q)} · ${lvEur(a.price)} en moyenne</span></div><div class="lv-dr">${right}</div></div>`;
  };
  return `<div class="glass pad st lv-dish" style="--i:3"><div class="row"><div><b class="h3">Ce que rapporte chaque plat</b><div class="sub">Après commission et coût matière</div></div></div>
    <div class="lv-drows">${L.slice(0, 8).map(row).join("")}</div>
    <p class="note" style="margin:8px 0 0">Prix TTC du client, TVA à 10 % retirée, commission de la plateforme retirée, puis coût de la fiche recette. Reliez un plat une fois : chaque vente sort aussi du stock.</p></div>`;
}
function lvPfCardHtml(st) {
  const row = (p, i) => { const s = lvStatOf(p.id); const b = st.by[p.id];
    const sub = s && s.lastImport ? `Relevé importé ${typeof cxAgo === "function" ? cxAgo(s.lastImport) : shortDate(dayKey(new Date(s.lastImport)))}${s.inPos ? " · déjà dans la caisse" : ""}` : "Pas encore de relevé";
    return `<button class="cx-opt st" style="--i:${i + 3}" data-act="lvPf" data-v="${p.id}">${lvWell(p)}<span class="tx"><b>${esc(p.name)}</b><em>${esc(sub)}</em></span>${b && b.gross ? `<span class="mono lv-pg">${lvEur0(b.gross)}</span>` : ""}${ico("chev")}</button>`; };
  return `<div class="glass pad st cx-moreb lv-pfs" style="--i:2"><span class="lbl">Vos plateformes</span>${LV_PF.map(row).join("")}</div>`;
}
function lvHonestHtml() {
  return `<div class="glass pad st lv-honest" style="--i:6">
    <div class="lv-hrow"><span class="ic">${ico("cxFile")}</span><div><b>Par import, pas en direct</b><em>Uber Eats, Deliveroo et Just Eat ne sont pas reliés en direct à Growth Gusto : vous déposez le relevé téléchargé dans votre espace plateforme, quand vous voulez.</em></div></div>
    <div class="lv-hrow"><span class="ic neu">${ico("lvSoon")}</span><div><b>Bientôt : les commandes en direct en cuisine</b><em>Les commandes arriveront toutes seules sur l'écran de la cuisine, et la carte et les ruptures se mettront à jour sur les plateformes. Ce sera une option.</em></div></div></div>`;
}

/* ───────── fiche d'une plateforme ───────── */
function lvPfHtml(id) {
  const p = lvPf(id); const s = lvStatOf(id); const inPos = !!(s && s.inPos);
  return `<div class="cx-pos"><div class="cx-ph">${lvWell(p, "lg")}<div><div class="h2">${esc(p.name)}</div><div class="sub">Import du relevé · pas de liaison directe</div></div></div>
    ${s && s.lastImport ? `<div class="cx-stat"><span class="cx-sic">${ico("cxFile")}</span><span><b>Relevé importé</b><em>${esc(s.file || "")}${s.from ? ` · du ${shortDate(s.from)} au ${shortDate(s.to)}` : ""}</em></span></div>` : ""}
    <ol class="cx-steps">${p.steps.map((t, i) => `<li class="st" style="--i:${i + 1}"><span class="cx-n mono">${i + 1}</span><span>${esc(t)}</span></li>`).join("")}</ol>
    <p class="note" style="margin:0">Le nom des menus change parfois : cherchez l'export CSV de vos commandes ou de vos paiements. Un relevé par article permet en plus de déduire le stock.</p>
    <button class="cm-tog${inPos ? " on" : ""}" data-act="lvInPos" data-v="${p.id}" aria-pressed="${inPos}"><span class="cm-tt"><b>Ces commandes arrivent déjà dans ma caisse</b><em>Alors on ne garde que les commissions, pour ne pas compter les ventes deux fois.</em></span><span class="cm-sw${inPos ? " on" : ""}"><i></i></span></button>
    <button class="btn acc block" data-act="lvImport" data-v="${p.id}">${ico("cxFile")}Importer un relevé ${esc(p.name)}</button></div>`;
}

/* ───────── import ───────── */
const LV_COLS = [["day", "Date"], ["ref", "N° de commande"], ["name", "Article"], ["qty", "Quantité"], ["gross", "Ventes TTC"], ["commission", "Commission"], ["net", "Versé"]];
const LV_NOT = /\bht\b|hors taxe|excl|tva|vat|taxe|tax\b|taux|rate|pourcent/;
const LV_RX = {
  day: [/^(date|jour|day)$|date (de )?(la )?commande|order date|date de la vente|date et heure|created|placed|horodatage|^date\b/],
  gross: [/ventes? ttc|ventes? incl|sales incl|valeur (de )?(la )?commande|order value|montant (de la )?commande|montant ttc|total ttc|total commande|order total|total des ventes|food sales|gross|sous total|subtotal|^ventes?$|^sales$|chiffre/, /^total$|^montant$|^amount$|prix total|total price/],
  commission: [/commission|frais (de )?(service|plateforme|marketplace)|frais uber|marketplace fee|service fee|platform fee|uber fee/],
  net: [/versement|paiement total|paiement net|total payout|payout|a vous verser|montant verse|total payable|a percevoir|earnings|revenus? nets?|^net\b|\bnet$/],
  name: [/article|produit|item|plat|designation|libelle|product|^nom$|^name$/],
  qty: [/^(qte|qt|qty|quantite|quantity|nb|nombre)$|quantite|quantity|items sold|articles vendus|vendus?$/],
  ref: [/order id|id (de )?(la )?commande|numero (de )?(la )?commande|n commande|order number|order ref|^commande$|^order$|reference|^ref|^id$/],
};
function lvGuessCols(head) {
  const H = head.map((h) => (typeof cxNorm === "function" ? cxNorm(h) : String(h).toLowerCase())); const used = new Set(); const pick = {};
  const bad = { gross: (h) => LV_NOT.test(h) || /commission|frais|fee|net\b|versement|payout|verse/.test(h), commission: (h) => /tva|vat|taux|rate|pourcent/.test(h), net: (h) => /tva|vat/.test(h), ref: (h) => /date|valeur|montant|total|prix|commission|frais/.test(h), qty: (h) => /commande/.test(h) };
  ["day", "gross", "commission", "net", "name", "qty", "ref"].forEach((k) => {
    for (const rx of LV_RX[k]) { const i = H.findIndex((h, j) => !used.has(j) && h && rx.test(h) && !(bad[k] && bad[k](h))); if (i >= 0) { pick[k] = i; used.add(i); break; } }
  });
  return pick;
}
const lvNum = (v) => (typeof cxNum === "function" ? cxNum(v) : num(v));
function lvParse(I) {
  const c = I.cols; const days = {};
  I.rows.forEach((r) => {
    if (r.some((x) => typeof x === "string" && /^(total|sous total|totaux|grand total)\b/.test(cxNorm(x)))) return;
    const day = c.day != null ? cxDay(r[c.day]) : I.day; if (!day) return;
    const g = c.gross != null ? lvNum(r[c.gross]) : null, cm = c.commission != null ? lvNum(r[c.commission]) : null, nt = c.net != null ? lvNum(r[c.net]) : null;
    const name = c.name != null ? String(r[c.name] ?? "").trim() : ""; let q = c.qty != null ? lvNum(r[c.qty]) : null; if (name && q == null) q = 1;
    if (g == null && cm == null && nt == null && !name) return;
    const D = (days[day] ||= { gross: 0, commission: 0, net: 0, hasG: false, hasC: false, hasN: false, refs: new Set(), rows: 0, items: new Map() });
    D.rows++;
    if (g != null) { D.gross += g; D.hasG = true; } if (cm != null) { D.commission += Math.abs(cm); D.hasC = true; } if (nt != null) { D.net += nt; D.hasN = true; }
    if (c.ref != null && r[c.ref] !== "" && r[c.ref] != null) D.refs.add(String(r[c.ref]));
    if (name && q) { const k = cxKey(name); const e = D.items.get(k) || { name, qty: 0, amount: null }; e.qty += q; if (g != null) e.amount = (e.amount || 0) + g; D.items.set(k, e); }
  });
  Object.values(days).forEach((D) => {
    if (!D.hasC && D.hasG && D.hasN) { D.commission = Math.max(0, D.gross - D.net); D.hasC = true; }
    if (!D.hasN && D.hasG && D.hasC) { D.net = D.gross - D.commission; D.hasN = true; }
    D.orders = D.refs.size || (c.name == null && c.ref == null ? D.rows : null);
  });
  return days;
}
function lvImportHtml() {
  const I = S.ui.lvI; if (!I) return ""; const p = lvPf(I.provider); const D = lvParse(I); const dk = Object.keys(D).sort();
  const sum = (k) => dk.reduce((a, d) => a + (D[d][k] || 0), 0); const orders = dk.reduce((a, d) => a + (D[d].orders || 0), 0);
  const arts = new Set(); dk.forEach((d) => D[d].items.forEach((_, k) => arts.add(k)));
  const sel = (k, t) => `<label class="cx-col"><span>${t}</span><select class="input" data-lvcol="${k}" aria-label="Colonne ${t}"><option value="">Aucune</option>${I.head.map((h, i) => `<option value="${i}" ${I.cols[k] === i ? "selected" : ""}>${esc(h || "Colonne " + (i + 1))}</option>`).join("")}</select></label>`;
  const ok = dk.length && (I.cols.gross != null || I.cols.commission != null || I.cols.net != null || I.cols.name != null);
  const inPos = lvInPos(I.provider);
  return `<div class="cx-imp"><div class="cx-ph">${lvWell(p)}<div style="min-width:0"><div class="h2">Relevé ${esc(p.name)}</div><div class="sub cx-file">${esc(I.file)}</div></div></div>
    <div class="cx-isum"><div><b class="mono">${lvEur0(sum("gross"))}</b><em>ventes TTC</em></div><div><b class="mono">${lvEur0(sum("commission"))}</b><em>commissions</em></div><div><b class="mono">${orders ? Math.round(orders) : dk.length}</b><em>${orders ? (orders > 1 ? "commandes" : "commande") : dk.length > 1 ? "jours" : "jour"}</em></div></div>
    ${I.cols.day == null ? `<div class="cx-iday"><span class="lbl">Relevé du</span><div class="cx-chips">${[[dayKey(), "Aujourd'hui"], [addDays(dayKey(), -1), "Hier"]].map(([d, t]) => `<button class="chip ${I.day === d ? "on" : ""}" data-act="lvIDay" data-v="${d}">${t}</button>`).join("")}<input type="date" class="input cx-date" id="lvIDate" value="${esc(I.day || "")}" max="${dayKey()}" aria-label="Autre jour"></div></div>` : `<p class="sub" style="margin:0">${dk.length ? (dk.length > 1 ? `Du ${shortDate(dk[0])} au ${shortDate(dk[dk.length - 1])} · ${dk.length} jours` : shortDate(dk[0])) : "Aucune date lisible dans la colonne choisie."}${arts.size ? ` · ${lvPl(arts.size, "plat")}` : ""}</p>`}
    <details class="cx-cols" ${ok ? "" : "open"}><summary>${ico("sliders")}Colonnes du fichier</summary><div class="cx-colg">${LV_COLS.map(([k, t]) => sel(k, t)).join("")}</div></details>
    ${!ok ? `<div class="cx-hint">${ico("alert")}<span>Choisissez au moins la colonne des ventes, de la commission ou des articles.</span></div>` : ""}
    <p class="note" style="margin:0">${inPos ? "Ces commandes passent déjà par votre caisse : seules les commissions sont ajoutées." : "Les ventes vont dans Tickets et Finances, les commissions dans vos charges."} Un nouvel import complète les mêmes jours.</p>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="lvImportGo" ${ok ? "" : "disabled"}>${ico("check")}Importer</button></div></div>`;
}
function lvImportAfter(b) {
  $$("select[data-lvcol]", b).forEach((sel) => sel.addEventListener("change", () => {
    const I = S.ui.lvI; if (!I) return; const v = sel.dataset.lvcol; const n = sel.value === "" ? null : +sel.value;
    Object.keys(I.cols).forEach((k) => { if (I.cols[k] === n && k !== v) delete I.cols[k]; }); if (n == null) delete I.cols[v]; else I.cols[v] = n;
    SFX.tick(); openSheet(lvImportHtml(), (b2) => { lvImportAfter(b2); const d = $(".cx-cols", b2); if (d) d.open = true; });
  }));
  const d = $("#lvIDate", b); if (d) d.addEventListener("change", () => { if (/^\d{4}-\d{2}-\d{2}$/.test(d.value) && S.ui.lvI) { S.ui.lvI.day = d.value; openSheet(lvImportHtml(), lvImportAfter); } });
}

/* the day's sale (→ ticket Z via js/caisse.js) and the day's commission (→ Finances) */
async function lvWriteDay(doc) {
  const p = lvPf(doc.provider); const d = doc.day; const sid = `${doc.provider}_csv_${d}`; const eid = `lv_${doc.provider}_${d}`;
  if (num(doc.commission) > 0) await safe(DB.set("expenses", eid, { day: d, cat: "commissions", supplier: p.name, label: `Commissions ${p.name}`, amountHT: lvR2(num(doc.commission)), vat: 20, auto: "lv", at: doc.at, by: S.me.name || "" }));
  else await DB.del("expenses", eid).catch(() => {});
  if (!lvInPos(doc.provider) && num(doc.gross) > 0) await safe(DB.set("sales", sid, { provider: doc.provider, source: "csv", channel: "livraison", day: d, at: doc.at, total: lvR2(num(doc.gross)), count: doc.orders || null, items: doc.items || [], file: doc.file || "", importedAt: doc.importedAt, uid: S.me.id }));
  else await lvDropSale(doc.provider, d);
}
async function lvDropSale(prov, d) {
  await DB.del("sales", `${prov}_csv_${d}`).catch(() => {});
  const tid = `pos_${prov}_${d}`;
  if (typeof tkMovesOf === "function") for (const m of tkMovesOf(tid)) await DB.del("moves", m.id).catch(() => {});
  await DB.del("tickets", tid).catch(() => {});
}
/* js/caisse.js only rolls the last 14 days into tickets: older imported days get their ticket here */
async function lvOldTickets(prov, days) {
  if (lvInPos(prov) || typeof cxDayTicket !== "function" || typeof tkSyncStock !== "function") return;
  const lim = addDays(dayKey(), -13);
  for (const doc of days) {
    if (doc.day >= lim || !(num(doc.gross) > 0)) continue;
    const L = (doc.items || []).map((it) => { const o = { libelle: it.name, quantite: lvR2(num(it.qty) || 0), montant: it.amount != null ? lvR2(num(it.amount)) : null }; const m = typeof cxMapOf === "function" ? cxMapOf(cxKey(it.name)) : null; if (m && m.noteId) { o.noteId = m.noteId; o.per = num(m.per) || 1; } return o; });
    const t = { date: doc.day, total: lvR2(num(doc.gross)), ht: null, vat: [], covers: null, lines: L, source: "caisse", provider: prov, nbTickets: doc.orders || 1, recipeStock: true, at: doc.at, photoIds: [], photoUrls: [], photos: [], posHash: "lv", uid: S.me.id, updatedAt: Date.now() };
    const id = `pos_${prov}_${doc.day}`;
    try { await DB.set("tickets", id, t); await tkSyncStock({ ...t, id }); } catch (e) { console.warn(e); }
  }
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  lvPer: (a, id, v) => { S.ui.lvPer = +v || 30; SFX.tick(); buzz(4); rerender(); },
  lvPf: (a, id, v) => { SFX.tap(); openSheet(lvPfHtml(v)); },
  lvInPos: async (a, id, v) => {
    if (!lvCanWrite()) { SFX.err(); return; }
    const on = !lvInPos(v); const s = lvStatOf(v) || {}; const keep = { ...s }; delete keep.id;
    try { await safe(DB.set("livraison", v, { ...keep, provider: v, inPos: on })); } catch (e) { return; }
    S.lvStat = [...(S.lvStat || []).filter((x) => x.id !== v), { id: v, ...keep, provider: v, inPos: on }];
    const L = (S.lvDays || []).filter((x) => x.provider === v);
    for (const d of L) { try { await lvWriteDay(d); } catch (e) { break; } }
    if (!on) await lvOldTickets(v, L);
    if (typeof cxRoll === "function") cxRoll();
    SFX.ok(); buzz(6); toast(on ? "Compris : seules les commissions sont comptées" : "Les ventes sont comptées dans vos tickets", "info"); openSheet(lvPfHtml(v)); rerender();
  },
  lvImport: async (a, id, v) => {
    if (!lvCanWrite()) { SFX.err(); toast("Votre accès ne permet pas d'importer les ventes.", "err"); return; }
    const f = await cxPickFile(); if (!f) return;
    let rows; try { rows = await cxReadFile(f); } catch (e) { SFX.err(); toast(e && e.code === "xls" ? "Ancien format Excel : enregistrez le fichier en .xlsx ou .csv." : "Fichier illisible : exportez en CSV ou Excel (.xlsx).", "err"); return; }
    const T = cxTable(rows); if (!T.rows.length) { SFX.err(); toast("Ce fichier ne contient aucune vente.", "err"); return; }
    const nm = cxNorm(f.name); const guess = /uber/.test(nm) ? "ubereats" : /deliveroo|roo/.test(nm) ? "deliveroo" : /just ?eat|takeaway/.test(nm) ? "justeat" : null;
    S.ui.lvI = { provider: guess && !v ? guess : v || guess || "ubereats", file: f.name, head: T.head, rows: T.rows, cols: lvGuessCols(T.head), day: dayKey() };
    SFX.ok(); openSheet(lvImportHtml(), lvImportAfter);
  },
  lvIDay: (a, id, v) => { const I = S.ui.lvI; if (!I) return; I.day = v; SFX.tick(); openSheet(lvImportHtml(), lvImportAfter); },
  lvImportGo: async (a) => {
    const I = S.ui.lvI; if (!I || I.saving) return; const D = lvParse(I); const dk = Object.keys(D).sort(); if (!dk.length) return;
    I.saving = true; a.disabled = true; const now = Date.now(); const prov = I.provider; const out = [];
    try {
      for (const d of dk) {
        const x = D[d]; const ex = lvDayOf(prov, d) || {};
        const items = [...x.items.values()].map((e) => ({ name: e.name, qty: lvR2(e.qty), ...(e.amount != null ? { amount: lvR2(e.amount) } : {}) }));
        const pick = (has, v, k) => (has ? lvR2(v) : ex[k] != null ? ex[k] : null);
        const doc = { provider: prov, day: d, at: d === dayKey() ? now : parseDay(d).getTime() + 22 * 36e5, gross: pick(x.hasG, x.gross, "gross"), commission: pick(x.hasC, x.commission, "commission"), net: pick(x.hasN, x.net, "net"),
          orders: x.orders || ex.orders || null, items: items.length ? items : ex.items || [], file: I.file, importedAt: now, uid: S.me.id };
        await safe(DB.set("lvDays", `${prov}_${d}`, doc)); await lvWriteDay(doc); out.push(doc);
      }
      const s = lvStatOf(prov) || {}; const keep = { ...s }; delete keep.id;
      await safe(DB.set("livraison", prov, { ...keep, provider: prov, inPos: !!keep.inPos, lastImport: now, file: I.file, from: dk[0], to: dk[dk.length - 1] }));
    } catch (e) { I.saving = false; a.disabled = false; return; }
    await lvOldTickets(prov, out);
    logEvent("caisse", `a importé le relevé ${lvPf(prov).name} (${dk.length > 1 ? lvPl(dk.length, "jour") : shortDate(dk[0])})`);
    S.ui.lvI = null; closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst(); toast(`Relevé ${lvPf(prov).name} importé · ${lvPl(dk.length, "jour")}`);
    if (S.route !== "livraison") go("livraison"); else rerender(); if (typeof cxRoll === "function") cxRoll();
  },
});

/* ───────── démo : 4 semaines d'Uber Eats et de Deliveroo ───────── */
function lvDemoSeed() {
  const P = (c) => `restos/${S.rid}/${c}`; if (DB.local[P("lvDays")]) return;
  const menu = [["Bœuf bourguignon", 22, 5], ["Croquettes de jambon", 9, 4], ["Planche de charcuterie", 19, 3], ["Formule midi", 18.5, 3]];
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const days = {}, sales = {}, exp = (DB.local[P("expenses")] ||= {}); const now = Date.now();
  [["ubereats", 0.3, 6], ["deliveroo", 0.28, 4]].forEach(([prov, rate, base]) => {
    for (let k = 27; k >= 1; k--) {
      const d = addDays(dayKey(), -k); const n = Math.max(1, Math.round(base * (0.6 + rnd() * 0.9) * ([5, 6].includes(parseDay(d).getDay()) ? 1.5 : 1)));
      const items = new Map();
      for (let o = 0; o < n; o++) { const c = 1 + Math.floor(rnd() * 2.4); for (let j = 0; j < c; j++) { const tot = menu.reduce((a, m) => a + m[2], 0); let r = rnd() * tot; const m = menu.find((x) => (r -= x[2]) < 0) || menu[0]; const e = items.get(m[0]) || { name: m[0], qty: 0, amount: 0 }; e.qty++; e.amount = lvR2(e.amount + m[1] * 1.15); items.set(m[0], e); } }
      const it = [...items.values()]; const gross = lvR2(it.reduce((a, x) => a + x.amount, 0)); const com = lvR2(gross * rate); const at = parseDay(d).getTime() + 22 * 36e5;
      days[`${prov}_${d}`] = { provider: prov, day: d, at, gross, commission: com, net: lvR2(gross - com), orders: n, items: it, file: `${prov}-octobre.csv`, importedAt: now - 864e5, uid: "demo-camille" };
      if (k <= 13) sales[`${prov}_csv_${d}`] = { provider: prov, source: "csv", channel: "livraison", day: d, at, total: gross, count: n, items: it, file: `${prov}-octobre.csv`, importedAt: now - 864e5, uid: "demo-camille" };
      exp[`lv_${prov}_${d}`] = { day: d, cat: "commissions", supplier: lvPf(prov).name, label: `Commissions ${lvPf(prov).name}`, amountHT: com, vat: 20, auto: "lv", at, by: "Camille Laurent" };
    }
  });
  DB.local[P("lvDays")] = days;
  const pm = (DB.local[P("posMap")] ||= {}); [["Bœuf bourguignon", "n-bourgui"], ["Croquettes de jambon", "n-croq"], ["Planche de charcuterie", "n-planche"]].forEach(([l, n]) => { const k = cxKey(l); if (!pm[cxLinkId(k)]) pm[cxLinkId(k)] = { key: k, label: l, kind: "recipe", noteId: n, per: 1, at: now - 20 * 864e5, uid: "demo-camille" }; });
  DB.local[P("livraison")] = { ubereats: { provider: "ubereats", inPos: false, lastImport: now - 864e5, file: "ubereats-octobre.csv", from: addDays(dayKey(), -27), to: addDays(dayKey(), -1) }, deliveroo: { provider: "deliveroo", inPos: false, lastImport: now - 2 * 864e5, file: "deliveroo-octobre.csv", from: addDays(dayKey(), -27), to: addDays(dayKey(), -1) } };
  const so = (DB.local[P("sales")] ||= {}); Object.assign(so, sales);
  ["lvDays", "livraison", "sales", "expenses", "posMap"].forEach((c) => DB.emit(P(c)));
}
