/* Growth Gusto — area: notes de frais (route « frais » + éditeur « fraisNote »). Prefix « nf ».
   Le client qui paie un repas d'affaires demande une note « pour ses frais » : le restaurant la fait ici en 10 secondes.
   - Depuis une table (prise de commande, js/salle.js) ou en saisie libre (montant payé sur la caisse + nombre de couverts).
   - Deux présentations : « 4 repas complets × 37,25 € = 149,00 € » (le plus demandé) ou le détail des plats.
     Quand le total ne se divise pas au centime près (115 € pour 3), la note dit « 2 × 38,33 € » + « 1 × 38,34 € » : le total reste juste.
   - La TVA est ventilée par taux : 10 % (repas, boissons sans alcool sur place), 20 % (boissons alcoolisées). Depuis une table,
     le taux vient de la fiche recette (champ vat de js/marge.js) ou, à défaut, du nom de la boisson.
   - Numérotation continue par année (N° 2026-0001…), jamais supprimée : une note fausse est « annulée » (elle reste dans la liste).
   - Imprimer (ou PDF via l'impression), envoyer par e-mail ou partager. Les mentions (raison sociale, adresse, SIRET, TVA) sont réglées une fois.
   - L'encaissement reste sur la caisse (NF525) : la note reprend le montant réglé, avec le n° du ticket de caisse si on le note.
   Data (members read/write, règle générique, pas de changement de firestore.rules) :
     restos/{rid}/fraisNotes/{id} { year, seq, no:"2026-0001", day, at, uid, by, src:"table"|"libre", tabId?, table?, covers,
                                    mode:"repas"|"detail", label, lines:[{ t, q, u, tot }], rates:[{ r, ht, tva, ttc }], total,
                                    company?, guest?, pay?, ticket?, status:"ok"|"annulee", cancelledAt?, cancelledBy?, why? }
     restos/{rid}/fraisCfg/main   { legal, address, siret, tva, footer, at, by } */
"use strict";

TAB_OF.frais = "more"; TAB_OF.fraisNote = "more";
(function nfNav() {
  if (NAV.some((n) => n[0] === "frais")) return;
  let i = NAV.findIndex((n) => n[0] === "cuisine"); if (i < 0) i = NAV.findIndex((n) => n[0] === "tickets");
  NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["frais", "nfNote", "Notes de frais"]);
})();
try { if (typeof AB_GATE !== "undefined") { AB_GATE.frais = ["pro", "Notes de frais"]; AB_GATE.fraisNote = ["pro", "Notes de frais"]; } } catch (e) {}
Object.assign(IC, {
  nfNote: ["f:M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z", "M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z", "M9 7h6", "M9 10.5h6", "M9 14h3.5", "M14 14.5l1 1 2-2.2"],
  nfMail: ["r:3,5,18,14,2.5", "f:M3 7.5a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z", "M3.8 7l8.2 6 8.2-6"],
  nfPrint: ["M7 8V3.5h10V8", "r:3,8,18,9,2.5", "f:M5.5 8h13A2.5 2.5 0 0 1 21 10.5v4a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 14.5v-4A2.5 2.5 0 0 1 5.5 8z", "M7 14h10v6.5H7z", "M17 11h.01"],
  nfShare: ["M12 3v12", "M7.5 7.5 12 3l4.5 4.5", "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"],
  nfTable: ["M3 9h18", "M5 9v10", "M19 9v10", "M8 9V6.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 6.5V9", "f:M3 9h18v2H3z"],
  nfPen: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z", "f:M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z", "M13.5 6.5l4 4"],
  nfBan: ["c:12,12,8.5", "M6 6l12 12"],
});

/* ───────── config ───────── */
const NF_LABELS = [["Repas complet", "Repas complets"], ["Menu", "Menus"], ["Déjeuner", "Déjeuners"], ["Dîner", "Dîners"], ["Formule", "Formules"]];
const NF_PAY = ["Carte bancaire", "Espèces", "Titre-restaurant", "Chèque", "Virement"];
const NF_WHY = ["Erreur de montant", "Mauvais client", "Doublon", "Le client n'en veut plus"];
const NF_ALC = /\b(vin|vins|rouge|blanc|ros[ée]|champagne|cr[ée]mant|prosecco|bi[èe]re|pinte|demi|ap[ée]ritif|ap[ée]ro|cocktail|spritz|mojito|kir|pastis|ricard|whisky|rhum|gin|vodka|cognac|armagnac|calvados|digestif|liqueur|cidre|porto|chablis|bordeaux|bourgogne|beaujolais|c[ôo]tes?|sancerre|muscadet|saint|chinon|graves|m[ée]doc|pinot|chardonnay|merlot|syrah|sauvignon|riesling)\b/i;
const NF = { rid: null, subs: {}, notes: null, cfg: null, F: null, q: "" };
const NF_COLS = [["notes", "fraisNotes", { order: "at", dir: "desc", limit: 400 }], ["cfg", "fraisCfg", {}]];
const nfR2 = (v) => Math.round((+v || 0) * 100) / 100;
const nfEur = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const nfPct = (r) => (r % 1 ? String(r).replace(".", ",") : String(r)) + " %";
const nfDayLong = (k) => { const d = parseDay(k); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ""; };

/* ───────── data ───────── */
function nfAlive(key) {
  const s = NF.subs[key]; if (!s) return false;
  if (DB.mode === "db") return DB.subs.includes(s);
  return (DB.listeners[DB.path(s.col)] || []).includes(s.cb);
}
function nfWatch() {
  if (!S.rid || typeof DB === "undefined") return;
  if (NF.rid !== S.rid) { NF.rid = S.rid; NF.subs = {}; NF.notes = null; NF.cfg = null; }
  if (DB.mode === "demo") nfSeedDemo();
  const rid = S.rid;
  NF_COLS.forEach(([k, col, opts]) => {
    if (nfAlive(k)) return;
    const cb = (rows) => { if (S.rid !== rid) return; NF[k] = k === "cfg" ? rows.find((r) => r.id === "main") || {} : rows; onData(); };
    const n = DB.subs.length; DB.watch(col, opts, cb);
    NF.subs[k] = DB.mode === "db" ? DB.subs[DB.subs.length - 1] || DB.subs[n] : { col, cb };
  });
  if (typeof slWatch === "function") try { slWatch(); } catch (e) {}
}
const nfNotes = () => { nfWatch(); return NF.notes || []; };
function nfCfg() {
  nfWatch(); const c = NF.cfg || {}, rs = typeof rsCfg === "function" ? (() => { try { return rsCfg() || {}; } catch (e) { return {}; } })() : {};
  return { legal: c.legal || (S.resto && S.resto.name) || "", address: c.address || rs.address || "", siret: c.siret || "", tva: c.tva || "", footer: c.footer || "", phone: rs.phone || "", set: !!(c.siret || c.tva) };
}
function nfNextSeq(year) { return Math.max(0, ...nfNotes().filter((n) => n.year === year).map((n) => +n.seq || 0)) + 1; }

/* ───────── the maths ───────── */
/* VAT rate of one order line: the recipe's own rate (js/marge.js), else 20 % for an alcoholic drink, else 10 % (food on site) */
function nfRateOf(x) {
  const n = x.id ? (S.notes || []).find((y) => y.id === x.id) : null;
  if (n && num(n.vat) != null) return num(n.vat);
  const cat = x.cat || (n && n.carteCat) || "";
  return cat === "boisson" && NF_ALC.test(x.name || "") ? 20 : 10;
}
/* split a TTC amount per rate into HT + TVA, cents exact (the TTC of each rate is what was paid) */
function nfRates(byRate) {
  return Object.entries(byRate).map(([r, ttc]) => ({ r: +r, ttc: nfR2(ttc) })).filter((x) => x.ttc > 0).sort((a, b) => a.r - b.r)
    .map((x) => { const ht = nfR2(x.ttc / (1 + x.r / 100)); return { r: x.r, ht, tva: nfR2(x.ttc - ht), ttc: x.ttc }; });
}
/* « N repas complets × P » lines: when the total doesn't divide to the cent, two lines whose sum is exactly the total */
function nfMealLines(total, covers, label) {
  const N = Math.max(1, Math.round(+covers || 1)), cents = Math.round((+total || 0) * 100); if (cents <= 0) return [];
  const base = Math.floor(cents / N), rest = cents - base * N, L = NF_LABELS.find((l) => l[0] === label) || NF_LABELS[0];
  const ln = (q, c) => ({ t: (q > 1 ? L[1] : L[0]).toLowerCase(), q, u: c / 100, tot: (c * q) / 100 });
  return rest ? [ln(N - rest, base), ln(rest, base + 1)].filter((l) => l.q > 0) : [ln(N, base)];
}
/* a table → its paid lines, total, covers and VAT split */
function nfFromTab(tab) {
  const unit = (x) => (+x.price || 0) + (x.extras || []).reduce((a, e) => a + (+e.p || 0), 0);
  const items = (tab.items || []).filter((x) => !x.off && !x.free && (+x.q || 0) > 0), agg = new Map(), byRate = {};
  items.forEach((x) => {
    const u = unit(x), q = +x.q || 0, r = nfRateOf(x), k = [x.name, u, r].join("|");
    const a = agg.get(k) || { t: x.name, q: 0, u, tot: 0, r }; a.q += q; a.tot = nfR2(a.u * a.q); agg.set(k, a);
    byRate[r] = (byRate[r] || 0) + u * q;
  });
  const total = nfR2(Object.values(byRate).reduce((a, v) => a + v, 0));
  return { lines: [...agg.values()], total, covers: Math.max(1, +tab.covers || 1), byRate, alc: nfR2(byRate[20] || 0) };
}
/* the tables a note can come from: open ones and those settled in the last 36 h, newest first */
function nfTabs() {
  const T = (typeof SL !== "undefined" && SL.tabs) || [];
  return T.filter((t) => (t.status === "open" || Date.now() - (t.closedAt || t.openedAt || 0) < 36 * 3600e3) && (t.items || []).some((x) => !x.off && !x.free))
    .sort((a, b) => (b.closedAt || b.openedAt || 0) - (a.closedAt || a.openedAt || 0)).slice(0, 30);
}
const nfTabById = (id) => ((typeof SL !== "undefined" && SL.tabs) || []).find((t) => t.id === id) || null;

/* ───────── the editor state ───────── */
function nfNewForm(p = {}) {
  const F = { src: "libre", tabId: "", table: "", covers: 2, total: "", alc: "", mode: "repas", label: "Repas complet", company: "", guest: "", pay: "Carte bancaire", ticket: "", day: dayKey(), busy: false };
  const tab = p.tab ? nfTabById(p.tab) : null;
  if (tab) nfUseTab(F, tab);
  return F;
}
function nfUseTab(F, tab) {
  const d = nfFromTab(tab);
  Object.assign(F, { src: "table", tabId: tab.id, table: String(tab.table || ""), covers: d.covers, total: String(d.total).replace(".", ","), alc: d.alc ? String(d.alc).replace(".", ",") : "", day: tab.day || dayKey() });
}
/* the note as it will be saved, from the form */
function nfCompute(F) {
  const tab = F.src === "table" ? nfTabById(F.tabId) : null, fromTab = tab ? nfFromTab(tab) : null;
  const total = nfR2(num(F.total) || 0), covers = Math.max(1, Math.round(+F.covers || 1));
  let mode = F.mode === "detail" && fromTab ? "detail" : "repas", lines, byRate;
  if (mode === "detail") { lines = fromTab.lines.map((l) => ({ t: l.t, q: l.q, u: l.u, tot: l.tot })); byRate = fromTab.byRate; }
  else {
    lines = nfMealLines(total, covers, F.label);
    const alc = Math.min(total, Math.max(0, nfR2(num(F.alc) || 0)));
    byRate = { 10: total - alc, 20: alc };
  }
  const rates = nfRates(byRate), sum = nfR2(rates.reduce((a, x) => a + x.ttc, 0));
  return { mode, lines, rates, total: mode === "detail" ? sum : total, covers };
}

/* ───────── the note itself (preview, print, e-mail) ───────── */
function nfPaper(n, cfg, opts = {}) {
  const e = esc, legal = cfg.legal || "Restaurant";
  const lines = (n.lines || []).map((l) => `<tr><td class="q">${l.q}</td><td>${e(l.t)}${n.mode === "repas" ? "" : ""}</td><td class="m">${nfEur(l.u)}</td><td class="m">${nfEur(l.tot)}</td></tr>`).join("");
  const rates = (n.rates || []).map((x) => `<tr><td>TVA ${nfPct(x.r)}</td><td class="m">${nfEur(x.ht)}</td><td class="m">${nfEur(x.tva)}</td><td class="m">${nfEur(x.ttc)}</td></tr>`).join("");
  const ht = nfR2((n.rates || []).reduce((a, x) => a + x.ht, 0)), tva = nfR2((n.rates || []).reduce((a, x) => a + x.tva, 0));
  const per = n.mode === "repas" && n.covers > 1 ? `<p class="pp">${n.covers} couverts · ${nfEur(n.total / n.covers)} par personne</p>` : "";
  return `<div class="nf-paper${n.status === "annulee" ? " void" : ""}${opts.cls ? " " + opts.cls : ""}">
    ${n.status === "annulee" ? `<div class="nf-void">Annulée</div>` : ""}
    <header><b>${e(legal)}</b>${cfg.address ? `<span>${e(cfg.address)}</span>` : ""}${cfg.phone ? `<span>${e(cfg.phone)}</span>` : ""}
      ${cfg.siret ? `<span>SIRET ${e(cfg.siret)}</span>` : ""}${cfg.tva ? `<span>N° TVA ${e(cfg.tva)}</span>` : ""}</header>
    <div class="nf-pt"><b>Note de restaurant</b><span>N° ${e(n.no || "à l'enregistrement")}</span></div>
    <div class="nf-meta"><span>Le ${e(nfDayLong(n.day))}${n.at ? " à " + hm(n.at) : ""}</span>${n.table ? `<span>Table ${e(n.table)}</span>` : ""}${n.company || n.guest ? `<span>Pour : ${e([n.company, n.guest].filter(Boolean).join(" · "))}</span>` : ""}</div>
    <table class="nf-l"><thead><tr><th class="q">Qté</th><th>Désignation</th><th class="m">P.U. TTC</th><th class="m">Total TTC</th></tr></thead><tbody>${lines || `<tr><td colspan="4" class="nf-0">Indiquez le montant réglé</td></tr>`}</tbody></table>
    <div class="nf-tot"><span>Total TTC</span><b>${nfEur(n.total)}</b></div>${per}
    <table class="nf-r"><thead><tr><th>Taux</th><th class="m">HT</th><th class="m">TVA</th><th class="m">TTC</th></tr></thead><tbody>${rates}</tbody>
      ${(n.rates || []).length > 1 ? `<tfoot><tr><td>Total</td><td class="m">${nfEur(ht)}</td><td class="m">${nfEur(tva)}</td><td class="m">${nfEur(n.total)}</td></tr></tfoot>` : ""}</table>
    <div class="nf-foot">${n.pay ? `<span>Réglé par ${e(n.pay.toLowerCase())}${n.ticket ? ` · ticket de caisse n° ${e(n.ticket)}` : ""}</span>` : n.ticket ? `<span>Ticket de caisse n° ${e(n.ticket)}</span>` : ""}
      ${cfg.footer ? `<span>${e(cfg.footer)}</span>` : ""}<span>Merci de votre visite</span></div>
  </div>`;
}
const NF_PRINT_CSS = `@page{size:A5;margin:12mm}*{box-sizing:border-box}body{margin:0;font:400 10pt/1.45 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111}
  .nf-paper{max-width:128mm;margin:0 auto;position:relative}header{display:flex;flex-direction:column;align-items:center;text-align:center;gap:1mm;padding-bottom:4mm;border-bottom:1px dashed #999}
  header b{font-size:14pt;letter-spacing:-.01em}header span{font-size:8.5pt;color:#444}.nf-pt{display:flex;justify-content:space-between;align-items:baseline;margin:5mm 0 1mm}.nf-pt b{font-size:13pt}
  .nf-pt span,.nf-meta{font-size:9pt;color:#444}.nf-meta{display:flex;flex-direction:column;gap:.5mm;margin-bottom:4mm}table{width:100%;border-collapse:collapse;font-size:9.5pt}
  th{font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#555;text-align:left;border-bottom:1px solid #333;padding:1.5mm 1mm}td{padding:1.6mm 1mm;border-bottom:1px solid #e3e3e3;vertical-align:top}
  .m{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.q{width:10mm;font-variant-numeric:tabular-nums}.nf-tot{display:flex;justify-content:space-between;align-items:baseline;margin:4mm 0 1mm;font-size:12pt}
  .nf-tot b{font-size:15pt;font-variant-numeric:tabular-nums}.pp{margin:0 0 4mm;font-size:9pt;color:#444;text-align:right}.nf-r{margin-top:3mm}.nf-r tfoot td{font-weight:700;border-bottom:0}
  .nf-foot{display:flex;flex-direction:column;align-items:center;gap:1mm;text-align:center;margin-top:6mm;padding-top:4mm;border-top:1px dashed #999;font-size:8.5pt;color:#444}
  .nf-void{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font:800 34pt sans-serif;color:rgba(200,20,40,.28);border:4px solid rgba(200,20,40,.28);padding:2mm 6mm;border-radius:4mm}`;
function nfPrint(n) {
  const cfg = nfCfg(), html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Note ${esc(n.no || "")}</title><style>${NF_PRINT_CSS}</style></head><body>${nfPaper(n, cfg)}</body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Impression impossible sur cet appareil.", "err"); } setTimeout(() => f.remove(), 60000); }, 250);
}
function nfText(n) {
  const c = nfCfg(), L = [];
  L.push(c.legal); if (c.address) L.push(c.address); if (c.siret) L.push("SIRET " + c.siret); if (c.tva) L.push("N° TVA " + c.tva);
  L.push("", `Note de restaurant n° ${n.no}`, `Le ${nfDayLong(n.day)}${n.table ? " · table " + n.table : ""}`); if (n.company || n.guest) L.push("Pour : " + [n.company, n.guest].filter(Boolean).join(" · "));
  L.push(""); (n.lines || []).forEach((l) => L.push(`${l.q} ${l.t} × ${nfEur(l.u)} = ${nfEur(l.tot)}`));
  L.push("", `Total TTC : ${nfEur(n.total)}`); (n.rates || []).forEach((x) => L.push(`TVA ${nfPct(x.r)} : HT ${nfEur(x.ht)} · TVA ${nfEur(x.tva)} · TTC ${nfEur(x.ttc)}`));
  if (n.pay) L.push("", `Réglé par ${n.pay.toLowerCase()}${n.ticket ? " · ticket de caisse n° " + n.ticket : ""}`);
  if (c.footer) L.push(c.footer);
  return L.join("\n");
}

/* ───────── screen: the list ───────── */
VIEWS.frais = {
  render() {
    const all = nfNotes(), cfg = nfCfg(), q = (NF.q || "").trim().toLowerCase();
    const L = q ? all.filter((n) => [n.no, n.company, n.guest, n.table, String(n.total)].join(" ").toLowerCase().includes(q)) : all;
    const m = monthKey(), mo = all.filter((n) => n.status !== "annulee" && (n.day || "").slice(0, 7) === m);
    const moT = nfR2(mo.reduce((a, n) => a + (+n.total || 0), 0)), moV = nfR2(mo.reduce((a, n) => a + (n.rates || []).reduce((b, x) => b + x.tva, 0), 0));
    const row = (n, i) => `<button class="glass nf-row st${n.status === "annulee" ? " void" : ""}" style="--i:${Math.min(i + 4, 14)}" data-act="nfOpen" data-id="${esc(n.id)}">
        <span class="nf-ic">${ico("nfNote")}</span>
        <span class="nf-rt"><b>${esc(n.company || n.guest || (n.table ? "Table " + n.table : "Note de restaurant"))}</b><em>N° ${esc(n.no)} · ${esc(shortDate(n.day))}${n.mode === "repas" ? ` · ${n.covers} ${(NF_LABELS.find((l) => l[0] === n.label) || NF_LABELS[0])[n.covers > 1 ? 1 : 0].toLowerCase()}` : " · détail"}</em></span>
        <span class="nf-rv">${n.status === "annulee" ? `<i>Annulée</i>` : ""}<b class="mono">${nfEur(n.total)}</b></span></button>`;
    return `<div class="inner nf">${topBar("Notes de frais", { right: `<button class="iconbtn" data-act="nfCfgOpen" aria-label="Mentions de la note">${ico("sliders")}</button>` })}
      <section class="glass nf-hero st" style="--i:1">
        <div class="nf-hl"><span class="nf-hk">${ico("nfNote")}</span><div><b>Une note pour les frais du client</b><p>« 4 repas complets × 37,25 € », la TVA ventilée, numérotée. Imprimée ou envoyée par e-mail.</p></div></div>
        <div class="nf-hs"><div><b class="mono">${mo.length}</b><span>note${mo.length > 1 ? "s" : ""} ce mois</span></div><div><b class="mono">${nfEur(moT)}</b><span>TTC</span></div><div><b class="mono">${nfEur(moV)}</b><span>dont TVA</span></div></div>
        <button class="btn acc block" data-act="nfNew">${ico("plus")}Faire une note</button>
      </section>
      ${cfg.set ? "" : `<button class="glass nf-set st" style="--i:2" data-act="nfCfgOpen">${ico("nfPen")}<span><b>Ajoutez votre SIRET et votre n° de TVA</b><em>Ils s'impriment en haut de chaque note : à faire une seule fois.</em></span>${ico("chev")}</button>`}
      ${all.length > 6 ? `<div class="nf-search st" style="--i:3"><span>${ico("search")}</span><input class="input" id="nfQ" placeholder="Chercher un client, un numéro, un montant…" value="${esc(NF.q || "")}" autocomplete="off"></div>` : ""}
      <div class="nf-list">${L.length ? L.map(row).join("") : all.length ? `<div class="empty">Aucune note ne correspond.</div>`
        : `<div class="glass empty st" style="--i:4"><div class="ic">${ico("nfNote")}</div><b>Aucune note pour l'instant</b>Quand un client demande une note pour ses frais, touchez « Faire une note ».</div>`}</div>
      <p class="note nf-legal st" style="--i:15">L'encaissement se fait sur votre caisse. La note reprend le montant réglé : elle ne remplace pas le ticket de caisse. Une note n'est jamais supprimée : en cas d'erreur, annulez-la et refaites-en une.</p>
    </div>`;
  },
  after() {
    const q = $("#nfQ"); if (q) q.addEventListener("input", debounce(() => { NF.q = q.value; const p = q.selectionStart; refresh(); const n = $("#nfQ"); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} } }, 160));
  },
};

/* ───────── screen: the editor (form + live preview) ───────── */
function nfFormHTML(F) {
  const tabs = nfTabs(), tab = F.src === "table" ? nfTabById(F.tabId) : null;
  const seg = `<div class="seg nf-seg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${F.src === "table" ? "0" : "100%"})"></span>
    <button class="${F.src === "table" ? "on" : ""}" data-act="nfSrc" data-v="table">${ico("nfTable")}Une table</button><button class="${F.src === "libre" ? "on" : ""}" data-act="nfSrc" data-v="libre">${ico("nfPen")}Saisie libre</button></div>`;
  const tabList = F.src !== "table" ? "" : tabs.length
    ? `<div class="nf-tabs">${tabs.map((t) => { const d = nfFromTab(t); return `<button class="nf-tab${t.id === F.tabId ? " on" : ""}" data-act="nfPickTab" data-id="${esc(t.id)}"><b>Table ${esc(t.table)}</b><em>${d.covers} couv. · ${t.status === "open" ? "en cours" : "réglée " + hm(t.closedAt || t.openedAt)}</em><span class="mono">${nfEur(d.total)}</span></button>`; }).join("")}</div>`
    : `<div class="nf-none">${ico("nfTable")}<span>Aucune table aujourd'hui dans la prise de commande. Passez en <b>saisie libre</b> : le montant payé et le nombre de couverts suffisent.</span></div>`;
  const step = `<div class="cm-step nf-step"><button data-act="nfCov" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${F.covers}</b><button data-act="nfCov" data-v="1" aria-label="Plus">${ico("plus")}</button></div>`;
  const amount = F.src === "libre" || F.mode === "repas"
    ? `<div class="nf-amt"><label class="field"><span>Montant réglé (TTC)</span><div class="nf-eur"><input class="input mono" id="nfTotal" inputmode="decimal" placeholder="149,00" value="${esc(F.total)}" autocomplete="off"><i>€</i></div></label>
       <div class="field"><span>Couverts</span>${step}</div></div>
       <label class="field nf-alc"><span>Dont boissons alcoolisées (TVA 20 %)</span><div class="nf-eur"><input class="input mono" id="nfAlc" inputmode="decimal" placeholder="0,00" value="${esc(F.alc)}" autocomplete="off"><i>€</i></div></label>` : "";
  const modeSeg = tab ? `<div class="field"><span>Présentation</span><div class="nf-chips">${[["repas", "Repas complets"], ["detail", "Détail des plats"]].map(([k, t]) => `<button class="chip${F.mode === k ? " on" : ""}" data-act="nfMode" data-v="${k}">${t}</button>`).join("")}</div></div>` : "";
  const labels = F.mode === "repas" || !tab ? `<div class="field"><span>Libellé</span><div class="nf-chips">${NF_LABELS.map(([l]) => `<button class="chip${F.label === l ? " on" : ""}" data-act="nfLabel" data-v="${esc(l)}">${esc(l)}</button>`).join("")}</div></div>` : "";
  return `${seg}${tabList}
    <section class="glass nf-card">${modeSeg}${labels}${amount}</section>
    <section class="glass nf-card">
      <div class="grid2"><label class="field"><span>Société (facultatif)</span><input class="input" id="nfCo" maxlength="80" placeholder="Ex. : Atelier Lumière SAS" value="${esc(F.company)}" autocomplete="organization"></label>
      <label class="field"><span>Nom du client (facultatif)</span><input class="input" id="nfGu" maxlength="60" placeholder="Ex. : M. Durand" value="${esc(F.guest)}" autocomplete="off"></label></div>
      <div class="field"><span>Réglé par</span><div class="nf-chips">${NF_PAY.map((p) => `<button class="chip${F.pay === p ? " on" : ""}" data-act="nfPay" data-v="${esc(p)}">${esc(p)}</button>`).join("")}</div></div>
      <div class="grid2"><label class="field"><span>N° du ticket de caisse</span><input class="input mono" id="nfTk" maxlength="30" placeholder="Facultatif" value="${esc(F.ticket)}" autocomplete="off"></label>
      <label class="field"><span>Date du repas</span><input class="input" id="nfDay" type="date" value="${esc(F.day)}" max="${dayKey()}"></label></div>
    </section>`;
}
function nfDraft(F) {
  const c = nfCompute(F), y = +(F.day || dayKey()).slice(0, 4);
  return { ...c, no: `${y}-${String(nfNextSeq(y)).padStart(4, "0")}`, day: F.day || dayKey(), at: Date.now(), table: F.src === "table" ? F.table : "", company: F.company.trim(), guest: F.guest.trim(), pay: F.pay, ticket: F.ticket.trim(), label: F.label, status: "ok" };
}
function nfPrevHTML(F) {
  const d = nfDraft(F), ok = d.total > 0;
  return `<div class="nf-prev"><span class="lbl">Aperçu</span>${nfPaper(d, nfCfg(), { cls: "in-app" })}</div>`;
}
function nfCtaHTML(F) {
  const d = nfCompute(F), ok = d.total > 0;
  return `<button class="btn acc block" data-act="nfSave"${ok && !F.busy ? "" : " disabled"}>${ico("check")}${ok ? `Enregistrer la note · ${nfEur(d.total)}` : "Indiquez le montant réglé"}</button>`;
}
VIEWS.fraisNote = {
  nav: "frais",
  render() {
    nfWatch(); const p = S.params || {};
    if (!NF.F || NF.F._k !== (p.k || "")) { NF.F = nfNewForm(p); NF.F._k = p.k || ""; }
    return `<div class="inner nf">${topBar("Nouvelle note de frais")}
      <div class="cols nf-cols"><div class="nf-form st" style="--i:1">${nfFormHTML(NF.F)}</div><div class="nf-side st" style="--i:2" id="nfPrevBox">${nfPrevHTML(NF.F)}</div></div>
      <div class="ctabar nf-cta" id="nfCta">${nfCtaHTML(NF.F)}</div>
    </div>`;
  },
  after() {
    const F = NF.F; if (!F) return;
    const bind = (id, key, live) => { const el = $("#" + id); if (!el) return; el.addEventListener("input", () => { F[key] = el.value; if (live) nfRepaint(); }); };
    bind("nfTotal", "total", true); bind("nfAlc", "alc", true); bind("nfCo", "company", true); bind("nfGu", "guest", true); bind("nfTk", "ticket", true);
    const d = $("#nfDay"); if (d) d.addEventListener("change", () => { F.day = d.value || dayKey(); nfRepaint(); });
  },
};
const nfRepaint = debounce(() => { const b = $("#nfPrevBox"), c = $("#nfCta"); if (!NF.F) return; if (b) b.innerHTML = nfPrevHTML(NF.F); if (c) c.innerHTML = nfCtaHTML(NF.F); }, 60);
const nfRedraw = () => { const y = window.scrollY; refresh(); requestAnimationFrame(() => window.scrollTo(0, y)); };

/* ───────── sheets ───────── */
function nfSheet(n) {
  const can = typeof navigator !== "undefined" && navigator.share;
  openSheet(`<div class="nf-sh"><div class="row"><span class="h2">Note n° ${esc(n.no)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="nf-prev">${nfPaper(n, nfCfg(), { cls: "in-app" })}</div>
    <div class="nf-acts"><button class="btn acc" data-act="nfPrint" data-id="${esc(n.id)}">${ico("nfPrint")}Imprimer ou PDF</button>
      <button class="btn soft" data-act="nfMail" data-id="${esc(n.id)}">${ico("nfMail")}E-mail</button>
      ${can ? `<button class="btn soft" data-act="nfShare" data-id="${esc(n.id)}">${ico("nfShare")}Partager</button>` : ""}</div>
    ${n.status === "annulee" ? `<p class="note nf-cx">Annulée${n.why ? " : " + esc(n.why.toLowerCase()) : ""}${n.cancelledAt ? ", le " + esc(shortDate(dayKey(new Date(n.cancelledAt)))) : ""}.</p>`
      : `<button class="btn ghost block nf-cxb" data-act="nfCancelAsk" data-id="${esc(n.id)}">${ico("nfBan")}Annuler cette note</button>`}
  </div>`);
}
function nfCfgSheet() {
  const c = nfCfg();
  openSheet(`<div class="nf-sh"><div class="row"><span class="h2">En-tête de vos notes</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Imprimé en haut de chaque note. Le SIRET et le numéro de TVA figurent sur votre Kbis ou votre avis de TVA.</p>
    <label class="field"><span>Raison sociale ou enseigne</span><input class="input" id="nfcL" maxlength="80" value="${esc(c.legal)}"></label>
    <label class="field"><span>Adresse</span><input class="input" id="nfcA" maxlength="140" placeholder="12 rue des Vignes, 69002 Lyon" value="${esc(c.address)}" autocomplete="street-address"></label>
    <div class="grid2"><label class="field"><span>SIRET</span><input class="input mono" id="nfcS" inputmode="numeric" maxlength="20" placeholder="14 chiffres" value="${esc(c.siret)}"></label>
    <label class="field"><span>N° de TVA</span><input class="input mono" id="nfcT" maxlength="20" placeholder="FR12345678901" value="${esc(c.tva)}"></label></div>
    <label class="field"><span>Mention en bas (facultatif)</span><input class="input" id="nfcF" maxlength="140" placeholder="Ex. : SAS au capital de 10 000 € · RCS Lyon" value="${esc(c.footer)}"></label>
    <button class="btn acc block" data-act="nfCfgSave">${ico("check")}Enregistrer</button></div>`);
}
const nfById = (id) => nfNotes().find((n) => n.id === id);

/* ───────── actions ───────── */
Object.assign(ACT, {
  nfNew: () => { SFX.tap(); NF.F = null; go("fraisNote", { k: "n" + Date.now().toString(36) }); },
  nfFromTab: (a, id) => { SFX.tap(); NF.F = null; go("fraisNote", { tab: id, k: "t" + id + Date.now().toString(36) }); },
  nfSrc: (a, id, v) => { const F = NF.F; if (!F || F.src === v) return; SFX.tick(); F.src = v; if (v === "table") { const t = nfTabById(F.tabId) || nfTabs()[0]; if (t) nfUseTab(F, t); } else { F.tabId = ""; F.table = ""; F.mode = "repas"; } nfRedraw(); },
  nfPickTab: (a, id) => { const t = nfTabById(id); if (!t || !NF.F) return; SFX.tick(); buzz(3); nfUseTab(NF.F, t); nfRedraw(); },
  nfMode: (a, id, v) => { if (!NF.F) return; SFX.tick(); NF.F.mode = v; nfRedraw(); },
  nfLabel: (a, id, v) => { if (!NF.F) return; SFX.tick(); NF.F.label = v; nfRedraw(); },
  nfPay: (a, id, v) => { if (!NF.F) return; SFX.tick(); NF.F.pay = NF.F.pay === v ? "" : v; nfRedraw(); },
  nfCov: (a, id, v) => { if (!NF.F) return; NF.F.covers = Math.max(1, Math.min(60, (+NF.F.covers || 1) + +v)); SFX.tick(); buzz(3); const b = a.parentElement && a.parentElement.querySelector("b"); if (b) b.textContent = NF.F.covers; nfRepaint(); },
  nfSave: async (a) => {
    const F = NF.F; if (!F || F.busy) return; const d = nfDraft(F); if (!(d.total > 0)) { SFX.err(); toast("Indiquez le montant réglé.", "err"); return; }
    F.busy = true; a && a.setAttribute("disabled", "");
    const y = +d.day.slice(0, 4), seq = nfNextSeq(y);
    const doc = { year: y, seq, no: `${y}-${String(seq).padStart(4, "0")}`, day: d.day, at: Date.now(), uid: S.me.id, by: S.me.name || "", src: F.src, ...(F.src === "table" ? { tabId: F.tabId, table: F.table } : {}),
      covers: d.covers, mode: d.mode, label: F.label, lines: d.lines, rates: d.rates, total: d.total, company: d.company, guest: d.guest, pay: d.pay || "", ticket: d.ticket, status: "ok" };
    try {
      const id = await DB.add("fraisNotes", doc);
      if (typeof logEvent === "function") logEvent("frais", `a fait la note de frais n° ${doc.no} (${nfEur(doc.total)})`, { ref: id });
      SFX.done(); try { burst(); } catch (e) {}
      NF.F = null; go("frais", {}, { replace: true }); setTimeout(() => { const n = nfById(id) || { id, ...doc }; nfSheet(n); }, 380);
    } catch (e) { console.warn("frais", e); F.busy = false; a && a.removeAttribute("disabled"); if (!(e && e.code === "ab/blocked")) { SFX.err(); toast("Impossible d'enregistrer la note, réessayez.", "err"); } }
  },
  nfOpen: (a, id) => { const n = nfById(id); if (!n) return; SFX.sheet ? SFX.sheet() : SFX.tap(); nfSheet(n); },
  nfPrint: (a, id) => { const n = nfById(id); if (!n) return; SFX.print ? SFX.print() : SFX.tap(); nfPrint(n); },
  nfMail: (a, id) => { const n = nfById(id); if (!n) return; SFX.tap(); location.href = `mailto:?subject=${encodeURIComponent(`Note de restaurant n° ${n.no} · ${nfCfg().legal}`)}&body=${encodeURIComponent(nfText(n))}`; },
  nfShare: async (a, id) => { const n = nfById(id); if (!n) return; SFX.tap(); try { await navigator.share({ title: `Note n° ${n.no}`, text: nfText(n) }); } catch (e) {} },
  nfCancelAsk: (a, id) => {
    const n = nfById(id); if (!n) return; SFX.tap();
    openSheet(`<div class="nf-sh"><span class="h2">Annuler la note n° ${esc(n.no)} ?</span><p class="sub">Elle reste dans la liste, barrée, avec son numéro : la numérotation ne doit jamais avoir de trou.</p>
      <div class="nf-chips col">${NF_WHY.map((w) => `<button class="chip" data-act="nfCancel" data-id="${esc(n.id)}" data-v="${esc(w)}">${esc(w)}</button>`).join("")}</div>
      <button class="btn ghost block" data-act="nfOpen" data-id="${esc(n.id)}">Garder la note</button></div>`);
  },
  nfCancel: async (a, id, v) => {
    const n = nfById(id); if (!n) return;
    try { await DB.update("fraisNotes", id, { status: "annulee", why: v || "", cancelledAt: Date.now(), cancelledBy: S.me.id }); } catch (e) { return; }
    if (typeof logEvent === "function") logEvent("frais", `a annulé la note de frais n° ${n.no}`, { ref: id });
    SFX.ok ? SFX.ok() : SFX.tap(); closeSheet(); toast(`Note n° ${n.no} annulée`);
  },
  nfCfgOpen: () => { SFX.sheet ? SFX.sheet() : SFX.tap(); nfCfgSheet(); },
  nfCfgSave: async () => {
    const v = (id) => (($("#" + id) || {}).value || "").trim();
    const doc = { legal: v("nfcL"), address: v("nfcA"), siret: v("nfcS").replace(/\s+/g, ""), tva: v("nfcT").replace(/\s+/g, "").toUpperCase(), footer: v("nfcF"), at: Date.now(), by: S.me.id };
    if (doc.siret && !/^\d{14}$/.test(doc.siret)) { SFX.err(); toast("Le SIRET fait 14 chiffres.", "err"); return; }
    try { await DB.set("fraisCfg", "main", doc); } catch (e) { return; }
    SFX.done(); closeSheet(); toast("En-tête enregistré");
  },
});

/* ───────── hook: « Note de frais » in the table bill (js/salle.js), without editing its body ───────── */
(function nfHookBill() {
  if (typeof slBillPaint !== "function") return;
  const orig = slBillPaint;
  slBillPaint = function (first) {
    const r = orig.apply(this, arguments);
    try {
      const sh = $(".sl-sh.bill"), b = SL.bill; if (!sh || !b || sh.querySelector("[data-act=nfFromTab]")) return r;
      const close = sh.querySelector("[data-act=slClose]"); if (!close) return r;
      close.insertAdjacentHTML("beforebegin", `<button class="btn soft block nf-billbtn" data-act="nfFromTab" data-id="${esc(b.tab)}">${ico("nfNote")}Note de frais pour le client</button>`);
    } catch (e) {}
    return r;
  };
})();

/* ───────── demo: a few notes already made ───────── */
function nfSeedDemo() {
  const p = `restos/${S.rid}/fraisNotes`; if (DB.local[p]) return;
  DB.local[p] = {};
  DB.local[`restos/${S.rid}/fraisCfg`] = { main: { legal: "SAS Le Bistrot Démo", address: "12 rue des Vignes, 69002 Lyon", siret: "91234567800018", tva: "FR41912345678", footer: "SAS au capital de 10 000 € · RCS Lyon 912 345 678", at: Date.now() } };
  const today = dayKey(), y = +today.slice(0, 4), mk = (seq, ago, h, o) => {
    const day = addDays(today, -ago), dt = parseDay(day); dt.setHours(h, 40, 0, 0);
    const lines = o.lines || nfMealLines(o.total, o.covers, o.label || "Repas complet"), rates = nfRates(o.byRate || { 10: o.total - (o.alc || 0), 20: o.alc || 0 });
    DB.local[p]["nfd" + seq] = { year: y, seq, no: `${y}-${String(seq).padStart(4, "0")}`, day, at: dt.getTime(), uid: "demo-sarah", by: "Sarah Lemoine", src: o.table ? "table" : "libre", table: o.table || "",
      covers: o.covers, mode: o.lines ? "detail" : "repas", label: o.label || "Repas complet", lines, rates, total: nfR2(rates.reduce((a, x) => a + x.ttc, 0)), company: o.company || "", guest: o.guest || "", pay: o.pay || "Carte bancaire", ticket: o.ticket || "", status: o.status || "ok", ...(o.why ? { why: o.why, cancelledAt: dt.getTime() + 6e5 } : {}) };
  };
  mk(1, 12, 13, { total: 86, covers: 2, company: "Cabinet Marchand", table: "4", ticket: "1842" });
  mk(2, 9, 21, { total: 115, covers: 3, alc: 28, company: "Atelier Lumière SAS", guest: "M. Durand", table: "8" });
  mk(3, 9, 21, { total: 115, covers: 3, alc: 28, company: "Atelier Lumière", status: "annulee", why: "Doublon" });
  mk(4, 4, 13, { total: 149, covers: 4, alc: 0, company: "Groupe Vénus Immobilier", guest: "Mme Roche", table: "12", ticket: "1977" });
  mk(5, 1, 13, { covers: 2, table: "3", company: "Lyon Conseil", lines: [{ t: "Bœuf bourguignon", q: 2, u: 22, tot: 44 }, { t: "Mousse au chocolat", q: 2, u: 7, tot: 14 }, { t: "Verre de Côtes-du-Rhône", q: 2, u: 6.5, tot: 13 }, { t: "Café", q: 2, u: 2.5, tot: 5 }], byRate: { 10: 63, 20: 13 } });
}
