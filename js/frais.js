/* Growth Gusto — area: note de frais (facture au client professionnel), intégrée à l'addition. Prefix « nf ».
   Pas de module à part ni de saisie libre : une note de frais ne naît que d'une table de la prise de commande (js/salle.js).
   - Dans l'addition : « Le client veut une note de frais » → société (+ adresse, n° TVA), présentation, moyen de paiement.
     « Table réglée » enregistre alors la facture, puis l'affiche : imprimer / PDF / e-mail.
   - Après coup : sur la prise de commande, « Réglées aujourd'hui » liste les tables réglées : « Note de frais » ou « Voir la facture ».
   - Le montant vient toujours de la table (jamais tapé à la main) et une table n'a qu'une facture en vigueur.
   - Pourquoi une facture : en France, un client professionnel qui veut récupérer la TVA d'un repas doit avoir une facture à son nom
     (art. 289 et 242 nonies A annexe II du CGI) : numéro unique et continu, date, vendeur (SIRET, n° TVA), client, désignation,
     quantité, prix unitaire HT, taux et montant de TVA par taux, totaux HT et TTC. Une facture ne s'annule pas : on fait un avoir.
     « 4 repas complets » est une désignation admise si le prix par couvert apparaît ; les boissons alcoolisées (20 %) sont sur une
     ligne à part, car un même article ne peut pas porter deux taux.
   - L'encaissement reste sur la caisse certifiée (NF525) : la facture reprend la vente, avec le n° du ticket de caisse si on le note.
   Data (members read/write, règle générique, pas de changement de firestore.rules) :
     restos/{rid}/fraisNotes/{id} { kind:"facture"|"avoir", year, seq, no:"2026-0001", day, at, uid, by, tabId?, table?, covers,
                                    mode:"repas"|"detail", label, lines:[{ t, q, u (TTC), r, uht, tot (TTC), pp? }], rates:[{ r, ht, tva, ttc }],
                                    total, company, address?, vatNo?, pay?, ticket?, refId?/refNo? (avoir), avoirId?/avoirNo? (facture annulée), why? }
     restos/{rid}/fraisCfg/main   { legal, address, siret, tva, footer, at, by } */
"use strict";

Object.assign(IC, {
  nfNote: ["f:M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z", "M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z", "M9 7h6", "M9 10.5h6", "M9 14h3.5", "M14 14.5l1 1 2-2.2"],
  nfMail: ["r:3,5,18,14,2.5", "f:M3 7.5a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z", "M3.8 7l8.2 6 8.2-6"],
  nfPrint: ["M7 8V3.5h10V8", "r:3,8,18,9,2.5", "f:M5.5 8h13A2.5 2.5 0 0 1 21 10.5v4a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 14.5v-4A2.5 2.5 0 0 1 5.5 8z", "M7 14h10v6.5H7z", "M17 11h.01"],
  nfShare: ["M12 3v12", "M7.5 7.5 12 3l4.5 4.5", "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"],
  nfPen: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z", "f:M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z", "M13.5 6.5l4 4"],
  nfUndo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
});
/* the old standalone screen is gone: an old link lands on the order taking */
VIEWS.frais = VIEWS.fraisNote = { nav: "salle", render() { setTimeout(() => go("salle", {}, { replace: true }), 0); return `<div class="inner"></div>`; } };
TAB_OF.frais = TAB_OF.fraisNote = "more";
try { const i = NAV.findIndex((n) => n[0] === "frais"); if (i >= 0) NAV.splice(i, 1); } catch (e) {}

/* ───────── config ───────── */
const NF_LABELS = [["Repas complet", "Repas complets"], ["Menu", "Menus"], ["Déjeuner", "Déjeuners"], ["Dîner", "Dîners"], ["Formule", "Formules"]];
const NF_PAY = ["Carte bancaire", "Espèces", "Titre-restaurant", "Chèque", "Virement"];
const NF_WHY = ["Erreur de montant", "Mauvaise société", "Doublon", "Le client n'en veut plus"];
const NF_ALC = /\b(vin|vins|rouge|blanc|ros[ée]|champagne|cr[ée]mant|prosecco|bi[èe]re|pinte|demi|ap[ée]ritif|ap[ée]ro|cocktail|spritz|mojito|kir|pastis|ricard|whisky|rhum|gin|vodka|cognac|armagnac|calvados|digestif|liqueur|cidre|porto|chablis|bordeaux|bourgogne|beaujolais|c[ôo]tes?|sancerre|muscadet|chinon|graves|m[ée]doc|pinot|chardonnay|merlot|syrah|sauvignon|riesling)\b/i;
const NF = { rid: null, subs: {}, notes: null, cfg: null, B: {} };
const NF_COLS = [["notes", "fraisNotes", { order: "at", dir: "desc", limit: 500 }], ["cfg", "fraisCfg", {}]];
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
  if (NF.rid !== S.rid) { NF.rid = S.rid; NF.subs = {}; NF.notes = null; NF.cfg = null; NF.B = {}; }
  if (DB.mode === "demo") nfSeedDemo();
  const rid = S.rid;
  NF_COLS.forEach(([k, col, opts]) => {
    if (nfAlive(k)) return;
    const cb = (rows) => { if (S.rid !== rid) return; NF[k] = k === "cfg" ? rows.find((r) => r.id === "main") || {} : rows; onData(); };
    const n = DB.subs.length; DB.watch(col, opts, cb);
    NF.subs[k] = DB.mode === "db" ? DB.subs[DB.subs.length - 1] || DB.subs[n] : { col, cb };
  });
}
const nfNotes = () => { nfWatch(); return NF.notes || []; };
const nfById = (id) => nfNotes().find((n) => n.id === id);
/* the invoice in force for a table (not cancelled by a credit note) */
const nfOfTab = (tabId) => nfNotes().find((n) => n.tabId === tabId && (n.kind || "facture") === "facture" && !n.avoirId) || null;
function nfCfg() {
  nfWatch(); const c = NF.cfg || {}, rs = typeof rsCfg === "function" ? (() => { try { return rsCfg() || {}; } catch (e) { return {}; } })() : {};
  return { legal: c.legal || (S.resto && S.resto.name) || "", address: c.address || rs.address || "", siret: c.siret || "", tva: c.tva || "", footer: c.footer || "", phone: rs.phone || "", set: !!(c.siret && c.address) };
}
const nfNextSeq = (year) => Math.max(0, ...nfNotes().filter((n) => n.year === year).map((n) => +n.seq || 0)) + 1;

/* ───────── the maths ───────── */
/* VAT rate of one order line: the recipe's own rate (js/marge.js), else 20 % for an alcoholic drink, else 10 % (food on site) */
function nfRateOf(x) {
  const n = x.id ? (S.notes || []).find((y) => y.id === x.id) : null;
  if (n && num(n.vat) != null) return num(n.vat);
  const cat = x.cat || (n && n.carteCat) || "";
  return cat === "boisson" && NF_ALC.test(x.name || "") ? 20 : 10;
}
const nfHT = (ttc, r) => nfR2(ttc / (1 + r / 100));
/* VAT per rate from the lines (TTC of each rate is what was paid; HT and TVA derived once per rate) */
function nfRates(lines) {
  const by = {}; lines.forEach((l) => { by[l.r] = (by[l.r] || 0) + l.tot; });
  return Object.entries(by).map(([r, ttc]) => ({ r: +r, ttc: nfR2(ttc) })).filter((x) => x.ttc !== 0).sort((a, b) => a.r - b.r)
    .map((x) => { const ht = nfHT(x.ttc, x.r); return { r: x.r, ht, tva: nfR2(x.ttc - ht), ttc: x.ttc }; });
}
/* a table → its paid lines per dish, total, covers */
function nfTabData(tab) {
  const unit = (x) => (+x.price || 0) + (x.extras || []).reduce((a, e) => a + (+e.p || 0), 0);
  const agg = new Map();
  (tab.items || []).filter((x) => !x.off && !x.free && (+x.q || 0) > 0).forEach((x) => {
    const u = unit(x), q = +x.q || 0, r = nfRateOf(x), k = [x.name, u, r].join("|");
    const a = agg.get(k) || { t: x.name, q: 0, u, r }; a.q += q; agg.set(k, a);
  });
  const lines = [...agg.values()].map((a) => ({ ...a, uht: nfHT(a.u, a.r), tot: nfR2(a.u * a.q) }));
  return { lines, total: nfR2(lines.reduce((s, l) => s + l.tot, 0)), covers: Math.max(1, +tab.covers || 1) };
}
/* « N repas complets » at 10 %: when the amount doesn't divide to the cent, two lines whose sum is exactly the amount.
   Alcoholic drinks (20 %) stay on their own line: one line, one rate. */
function nfMealLines(d, label) {
  const food = nfR2(d.lines.filter((l) => l.r !== 20).reduce((s, l) => s + l.tot, 0)), alc = nfR2(d.lines.filter((l) => l.r === 20).reduce((s, l) => s + l.tot, 0));
  const N = d.covers, cents = Math.round(food * 100), out = [], L = NF_LABELS.find((l) => l[0] === label) || NF_LABELS[0];
  const pp = nfR2(d.total / N);
  if (cents > 0) {
    const base = Math.floor(cents / N), rest = cents - base * N;
    const ln = (q, c) => ({ t: (q > 1 ? L[1] : L[0]).toLowerCase() + (alc ? " (hors boissons alcoolisées)" : ""), q, u: c / 100, r: 10, uht: nfHT(c / 100, 10), tot: (c * q) / 100 });
    (rest ? [ln(N - rest, base), ln(rest, base + 1)] : [ln(N, base)]).filter((l) => l.q > 0).forEach((l) => out.push(l));
  }
  if (alc > 0) out.push({ t: "Boissons alcoolisées", q: 1, u: alc, r: 20, uht: nfHT(alc, 20), tot: alc });
  if (out[0]) out[0].pp = pp;
  return out;
}
/* the invoice as it will be saved for a table, from the bill options */
function nfBuild(tab, B) {
  const d = nfTabData(tab), mode = B.mode === "detail" ? "detail" : "repas";
  const lines = mode === "detail" ? d.lines.map((l) => ({ t: l.t, q: l.q, u: l.u, r: l.r, uht: l.uht, tot: l.tot })) : nfMealLines(d, B.label);
  return { kind: "facture", mode, label: B.label, lines, rates: nfRates(lines), total: d.total, covers: d.covers, tabId: tab.id, table: String(tab.table || ""), day: tab.day || dayKey(),
    company: (B.company || "").trim(), address: (B.address || "").trim(), vatNo: (B.vatNo || "").replace(/\s+/g, "").toUpperCase(), pay: B.pay || "", ticket: (B.ticket || "").trim() };
}
const nfB = (tabId) => (NF.B[tabId] ||= { on: false, company: "", address: "", vatNo: "", mode: "repas", label: "Repas complet", pay: "Carte bancaire", ticket: "" });

/* ───────── the document (preview, print, e-mail) ───────── */
function nfPaper(n, cfg, opts = {}) {
  const e = esc, av = n.kind === "avoir";
  const lines = (n.lines || []).map((l) => `<tr><td class="q">${l.q}</td><td>${e(l.t)}${l.pp ? `<small>soit ${nfEur(l.pp)} TTC par personne</small>` : ""}</td><td class="m">${nfPct(l.r)}</td><td class="m">${nfEur(l.uht)}</td><td class="m">${nfEur(l.tot)}</td></tr>`).join("");
  const rates = (n.rates || []).map((x) => `<tr><td>TVA ${nfPct(x.r)}</td><td class="m">${nfEur(x.ht)}</td><td class="m">${nfEur(x.tva)}</td><td class="m">${nfEur(x.ttc)}</td></tr>`).join("");
  const ht = nfR2((n.rates || []).reduce((a, x) => a + x.ht, 0)), tva = nfR2((n.rates || []).reduce((a, x) => a + x.tva, 0));
  return `<div class="nf-paper${n.avoirId ? " void" : ""}${opts.cls ? " " + opts.cls : ""}">
    ${n.avoirId ? `<div class="nf-void">Annulée</div>` : ""}
    <header><b>${e(cfg.legal || "Restaurant")}</b>${cfg.address ? `<span>${e(cfg.address)}</span>` : ""}${cfg.phone ? `<span>${e(cfg.phone)}</span>` : ""}
      ${cfg.siret ? `<span>SIRET ${e(cfg.siret)}</span>` : `<span class="miss">SIRET à renseigner</span>`}${cfg.tva ? `<span>N° TVA ${e(cfg.tva)}</span>` : ""}</header>
    <div class="nf-pt"><b>${av ? "Avoir" : "Facture"}</b><span>N° ${e(n.no || "attribué à l'édition")}</span></div>
    <div class="nf-meta"><span>Le ${e(nfDayLong(n.day))}${n.at ? " à " + hm(n.at) : ""}${n.table ? ` · table ${e(n.table)}` : ""}</span>
      ${av ? `<span>Annule la facture n° ${e(n.refNo || "")}${n.why ? ` (${e(n.why.toLowerCase())})` : ""}</span>` : ""}</div>
    <div class="nf-client"><em>Client</em><b>${e(n.company || "Société à indiquer")}</b>${n.address ? `<span>${e(n.address)}</span>` : ""}${n.vatNo ? `<span>N° TVA ${e(n.vatNo)}</span>` : ""}</div>
    <table class="nf-l"><thead><tr><th class="q">Qté</th><th>Désignation</th><th class="m">TVA</th><th class="m">P.U. HT</th><th class="m">Total TTC</th></tr></thead><tbody>${lines}</tbody></table>
    <table class="nf-r"><thead><tr><th>Taux</th><th class="m">Base HT</th><th class="m">TVA</th><th class="m">TTC</th></tr></thead><tbody>${rates}</tbody></table>
    <div class="nf-tots"><div><span>Total HT</span><b>${nfEur(ht)}</b></div><div><span>Total TVA</span><b>${nfEur(tva)}</b></div><div class="big"><span>Total TTC</span><b>${nfEur(n.total)}</b></div></div>
    <div class="nf-foot">${av ? `<span>Montant remboursé ou déduit de la facture d'origine.</span>` : `<span>Facture acquittée${n.pay ? ` par ${e(n.pay.toLowerCase())}` : ""}${n.ticket ? ` · ticket de caisse n° ${e(n.ticket)}` : ""}.</span>`}
      ${cfg.footer ? `<span>${e(cfg.footer)}</span>` : ""}<span>Merci de votre visite</span></div>
  </div>`;
}
const NF_PRINT_CSS = `@page{size:A5;margin:12mm}*{box-sizing:border-box}body{margin:0;font:400 9.5pt/1.45 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111}
  .nf-paper{max-width:128mm;margin:0 auto;position:relative}header{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.5mm;padding-bottom:4mm;border-bottom:1px dashed #999}
  header b{font-size:14pt}header span{font-size:8.5pt;color:#444}header .miss{color:#b00}.nf-pt{display:flex;justify-content:space-between;align-items:baseline;margin:5mm 0 1mm}.nf-pt b{font-size:14pt}
  .nf-pt span,.nf-meta{font-size:9pt;color:#444}.nf-meta{display:flex;flex-direction:column;margin-bottom:3mm}.nf-client{display:flex;flex-direction:column;padding:2.5mm 3mm;border:1px solid #ccc;border-radius:2mm;margin-bottom:4mm}
  .nf-client em{font-style:normal;font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;color:#666}.nf-client span{font-size:9pt;color:#444}
  table{width:100%;border-collapse:collapse;font-size:9pt}th{font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;color:#555;text-align:left;border-bottom:1px solid #333;padding:1.5mm 1mm}
  td{padding:1.5mm 1mm;border-bottom:1px solid #e3e3e3;vertical-align:top}td small{display:block;color:#666;font-size:8pt}.m{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.q{width:9mm}
  .nf-r{margin-top:4mm}.nf-tots{margin:3mm 0 0 auto;width:60mm}.nf-tots div{display:flex;justify-content:space-between;padding:.8mm 0;font-variant-numeric:tabular-nums}.nf-tots .big{font-size:12pt;font-weight:700;border-top:1px solid #333;margin-top:1mm;padding-top:1.5mm}
  .nf-foot{display:flex;flex-direction:column;align-items:center;gap:.5mm;text-align:center;margin-top:6mm;padding-top:3mm;border-top:1px dashed #999;font-size:8.5pt;color:#444}
  .nf-void{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font:800 32pt sans-serif;color:rgba(200,20,40,.28);border:4px solid rgba(200,20,40,.28);padding:2mm 6mm;border-radius:4mm}`;
function nfPrint(n) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${n.kind === "avoir" ? "Avoir" : "Facture"} ${esc(n.no || "")}</title><style>${NF_PRINT_CSS}</style></head><body>${nfPaper(n, nfCfg())}</body></html>`;
  const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Impression impossible sur cet appareil.", "err"); } setTimeout(() => f.remove(), 60000); }, 250);
}
function nfText(n) {
  const c = nfCfg(), L = [c.legal]; if (c.address) L.push(c.address); if (c.siret) L.push("SIRET " + c.siret); if (c.tva) L.push("N° TVA " + c.tva);
  L.push("", `${n.kind === "avoir" ? "Avoir" : "Facture"} n° ${n.no} · ${nfDayLong(n.day)}${n.table ? " · table " + n.table : ""}`);
  if (n.kind === "avoir") L.push(`Annule la facture n° ${n.refNo}`);
  L.push(`Client : ${n.company}${n.address ? ", " + n.address : ""}${n.vatNo ? " · N° TVA " + n.vatNo : ""}`, "");
  (n.lines || []).forEach((l) => L.push(`${l.q} ${l.t} · TVA ${nfPct(l.r)} · P.U. HT ${nfEur(l.uht)} · ${nfEur(l.tot)} TTC${l.pp ? ` (soit ${nfEur(l.pp)} TTC par personne)` : ""}`));
  L.push(""); (n.rates || []).forEach((x) => L.push(`TVA ${nfPct(x.r)} : base HT ${nfEur(x.ht)} · TVA ${nfEur(x.tva)} · TTC ${nfEur(x.ttc)}`));
  L.push(`Total TTC : ${nfEur(n.total)}`);
  if (n.kind !== "avoir") L.push("", `Facture acquittée${n.pay ? " par " + n.pay.toLowerCase() : ""}${n.ticket ? " · ticket de caisse n° " + n.ticket : ""}.`);
  if (c.footer) L.push(c.footer);
  return L.join("\n");
}

/* ───────── the « note de frais » block inside the bill (and the after-the-fact sheet) ───────── */
function nfFields(tab, B, opts = {}) {
  const chip = (act, v, on, t) => `<button class="chip${on ? " on" : ""}" data-act="${act}" data-id="${esc(tab.id)}" data-v="${esc(v)}">${esc(t || v)}</button>`;
  const inp = (k, label, ph, extra = "") => `<label class="field"><span>${label}</span><input class="input" data-nfb="${esc(tab.id)}" data-k="${k}" value="${esc(B[k] || "")}" placeholder="${ph}" autocomplete="off" ${extra}></label>`;
  return `<div class="nf-fields">
    ${inp("company", "Société *", "Ex. : Atelier Lumière SAS", 'maxlength="80" autocomplete="organization"')}
    ${inp("address", "Adresse de la société", "Ex. : 4 quai Saint-Antoine, 69002 Lyon", 'maxlength="140"')}
    <div class="grid2">${inp("vatNo", "N° TVA du client", "Facultatif", 'maxlength="20"')}${inp("ticket", "N° ticket de caisse", "Facultatif", 'maxlength="30"')}</div>
    <div class="field"><span>Sur la facture</span><div class="nf-chips">${chip("nfBMode", "repas", B.mode === "repas", `${nfTabData(tab).covers} ${(NF_LABELS.find((l) => l[0] === B.label) || NF_LABELS[0])[nfTabData(tab).covers > 1 ? 1 : 0].toLowerCase()}`)}${chip("nfBMode", "detail", B.mode === "detail", "Le détail des plats")}</div></div>
    ${B.mode === "repas" ? `<div class="nf-chips sm">${NF_LABELS.map(([l]) => chip("nfBLabel", l, B.label === l)).join("")}</div>` : ""}
    <div class="field"><span>Réglé par</span><div class="nf-chips">${NF_PAY.map((p) => chip("nfBPay", p, B.pay === p)).join("")}</div></div>
    ${opts.preview ? `<div class="nf-mini">${nfMini(nfBuild(tab, B))}</div>` : ""}
  </div>`;
}
/* the VAT lines shown in the bill once it's a « note de frais » */
function nfMini(n) {
  return `<div class="nf-vat">${(n.rates || []).map((x) => `<div><span>TVA ${nfPct(x.r)}</span><em class="mono">HT ${nfEur(x.ht)}</em><b class="mono">${nfEur(x.tva)}</b></div>`).join("")}</div>`;
}
function nfBillBlock(tab) {
  const ex = nfOfTab(tab.id), B = nfB(tab.id);
  if (ex) return `<button class="nf-done" data-act="nfOpen" data-id="${esc(ex.id)}">${ico("nfNote")}<span><b>Note de frais faite</b><em>Facture n° ${esc(ex.no)} · ${esc(ex.company)}</em></span>${ico("chev")}</button>`;
  return `<div class="nf-bill${B.on ? " on" : ""}">
    <button class="nf-tg" data-act="nfBToggle" data-id="${esc(tab.id)}" role="switch" aria-checked="${B.on}"><span class="nf-tgi">${ico("nfNote")}</span><span class="nf-tgt"><b>Note de frais</b><em>Le client paie pour son entreprise : facture à son nom, TVA détaillée</em></span><i class="nf-sw"><i></i></i></button>
    ${B.on ? nfFields(tab, B, { preview: true }) : ""}
  </div>`;
}
/* after the table is settled: the same form in a sheet */
function nfTabSheet(tab) {
  const ex = nfOfTab(tab.id); if (ex) { nfSheet(ex); return; }
  const B = nfB(tab.id); B.on = true;
  openSheet(`<div class="nf-sh" data-nftab="${esc(tab.id)}"><div class="row"><span class="h2">Note de frais · table ${esc(tab.table)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Réglée ${tab.closedAt ? "à " + hm(tab.closedAt) : ""} · ${nfEur(nfTabData(tab).total)} · ${nfTabData(tab).covers} couvert${nfTabData(tab).covers > 1 ? "s" : ""}</p>
    ${nfFields(tab, B, { preview: true })}
    <button class="btn acc block" data-act="nfIssue" data-id="${esc(tab.id)}">${ico("nfNote")}Éditer la facture</button></div>`);
}
function nfRepaintTab(tabId) {
  const tab = nfTabById(tabId); if (!tab) return;
  if ($(".sl-sh.bill")) { slBillPaint(); return; }
  const sh = $(`.nf-sh[data-nftab="${CSS.escape(tabId)}"]`); if (sh) { const f = sh.querySelector(".nf-fields"); if (f) f.outerHTML = nfFields(tab, nfB(tabId), { preview: true }); }
}
const nfTabById = (id) => ((typeof SL !== "undefined" && SL.tabs) || []).find((t) => t.id === id) || null;
/* typed values survive the repaints of the bill */
document.addEventListener("input", (e) => { const el = e.target; if (!el || !el.dataset || !el.dataset.nfb) return; nfB(el.dataset.nfb)[el.dataset.k] = el.value; });

/* save the invoice of a table (once) */
async function nfIssue(tab) {
  const B = nfB(tab.id);
  if (!(B.company || "").trim()) { SFX.err(); toast("Indiquez le nom de la société.", "err"); const i = $(`[data-nfb="${CSS.escape(tab.id)}"][data-k=company]`); i && i.focus(); return null; }
  const ex = nfOfTab(tab.id); if (ex) return ex;
  const doc = nfBuild(tab, B); if (!(doc.total > 0)) { SFX.err(); toast("Cette table n'a rien à facturer.", "err"); return null; }
  const y = +doc.day.slice(0, 4), seq = nfNextSeq(y);
  Object.assign(doc, { year: y, seq, no: `${y}-${String(seq).padStart(4, "0")}`, at: Date.now(), uid: S.me.id, by: S.me.name || "" });
  const id = await DB.add("fraisNotes", doc);
  if (typeof logEvent === "function") logEvent("frais", `a édité la facture n° ${doc.no} (note de frais, ${nfEur(doc.total)})`, { ref: id });
  delete NF.B[tab.id];
  return { id, ...doc };
}

/* ───────── sheets ───────── */
function nfSheet(n) {
  const can = typeof navigator !== "undefined" && navigator.share, cfg = nfCfg(), av = n.avoirId ? nfById(n.avoirId) : null;
  openSheet(`<div class="nf-sh"><div class="row"><span class="h2">${n.kind === "avoir" ? "Avoir" : "Facture"} n° ${esc(n.no)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${cfg.set ? "" : `<button class="nf-set" data-act="nfCfgOpen">${ico("nfPen")}<span><b>Ajoutez votre SIRET et votre adresse</b><em>Obligatoires sur une facture, à faire une seule fois.</em></span>${ico("chev")}</button>`}
    <div class="nf-prev">${nfPaper(n, cfg, { cls: "in-app" })}</div>
    <div class="nf-acts"><button class="btn acc" data-act="nfPrint" data-id="${esc(n.id)}">${ico("nfPrint")}Imprimer ou PDF</button>
      <button class="btn soft" data-act="nfMail" data-id="${esc(n.id)}">${ico("nfMail")}E-mail</button>
      ${can ? `<button class="btn soft" data-act="nfShare" data-id="${esc(n.id)}">${ico("nfShare")}Partager</button>` : ""}</div>
    ${n.kind === "avoir" ? "" : av ? `<button class="btn ghost block" data-act="nfOpen" data-id="${esc(av.id)}">Voir l'avoir n° ${esc(av.no)}</button>`
      : `<button class="btn ghost block nf-cxb" data-act="nfAvoirAsk" data-id="${esc(n.id)}">${ico("nfUndo")}Erreur ? Faire un avoir</button>`}
  </div>`);
}
function nfListSheet() {
  const L = nfNotes();
  openSheet(`<div class="nf-sh"><div class="row"><span class="h2">Notes de frais</span><span class="row" style="gap:8px"><button class="iconbtn" data-act="nfCfgOpen" aria-label="En-tête des factures">${ico("sliders")}</button><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></span></div>
    <p class="sub">Toutes les factures faites pour des clients professionnels, de la plus récente à la plus ancienne.</p>
    <div class="nf-list">${L.length ? L.map((n) => `<button class="nf-row${n.avoirId ? " void" : ""}" data-act="nfOpen" data-id="${esc(n.id)}"><span class="nf-ic">${ico(n.kind === "avoir" ? "nfUndo" : "nfNote")}</span>
      <span class="nf-rt"><b>${esc(n.company || "")}</b><em>${n.kind === "avoir" ? "Avoir" : "Facture"} n° ${esc(n.no)} · ${esc(shortDate(n.day))}${n.table ? " · table " + esc(n.table) : ""}</em></span>
      <span class="nf-rv">${n.avoirId ? "<i>Annulée</i>" : ""}<b class="mono">${nfEur(n.total)}</b></span></button>`).join("") : `<div class="empty">Aucune note de frais pour l'instant. Elle se fait dans l'addition d'une table.</div>`}</div></div>`);
}
function nfCfgSheet() {
  const c = nfCfg();
  openSheet(`<div class="nf-sh"><div class="row"><span class="h2">En-tête de vos factures</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Obligatoire sur une facture. Le SIRET est sur votre Kbis, le numéro de TVA sur vos déclarations.</p>
    <label class="field"><span>Raison sociale ou enseigne</span><input class="input" id="nfcL" maxlength="80" value="${esc(c.legal)}"></label>
    <label class="field"><span>Adresse</span><input class="input" id="nfcA" maxlength="140" placeholder="12 rue des Vignes, 69002 Lyon" value="${esc(c.address)}" autocomplete="street-address"></label>
    <div class="grid2"><label class="field"><span>SIRET</span><input class="input mono" id="nfcS" inputmode="numeric" maxlength="20" placeholder="14 chiffres" value="${esc(c.siret)}"></label>
    <label class="field"><span>N° de TVA</span><input class="input mono" id="nfcT" maxlength="20" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="FR12345678901" value="${esc(c.tva)}"></label></div>
    <label class="field"><span>Mention en bas (forme, capital, RCS)</span><input class="input" id="nfcF" maxlength="140" placeholder="SAS au capital de 10 000 € · RCS Lyon 912 345 678" value="${esc(c.footer)}"></label>
    <button class="btn acc block" data-act="nfCfgSave">${ico("check")}Enregistrer</button></div>`);
}

/* ───────── actions ───────── */
const nfRe = (id) => { SFX.tick(); buzz(3); nfRepaintTab(id); };
Object.assign(ACT, {
  nfBToggle: (a, id) => { const B = nfB(id); B.on = !B.on; nfRe(id); if (B.on) setTimeout(() => { const i = $(`[data-nfb="${CSS.escape(id)}"][data-k=company]`); if (i && !i.value) try { i.focus({ preventScroll: true }); } catch (e) {} }, 60); },
  nfBMode: (a, id, v) => { nfB(id).mode = v; nfRe(id); },
  nfBLabel: (a, id, v) => { nfB(id).label = v; nfRe(id); },
  nfBPay: (a, id, v) => { const B = nfB(id); B.pay = B.pay === v ? "" : v; nfRe(id); },
  nfTab: (a, id) => { const t = nfTabById(id); if (!t) return; SFX.sheet ? SFX.sheet() : SFX.tap(); nfTabSheet(t); },
  nfIssue: async (a, id) => {
    const t = nfTabById(id); if (!t) return; a && a.setAttribute("disabled", "");
    try { const n = await nfIssue(t); if (!n) { a && a.removeAttribute("disabled"); return; } SFX.done(); nfSheet(n); } catch (e) { console.warn("frais", e); a && a.removeAttribute("disabled"); if (!(e && e.code === "ab/blocked")) { SFX.err(); toast("Impossible d'éditer la facture, réessayez.", "err"); } }
  },
  nfOpen: (a, id) => { const n = nfById(id); if (!n) return; SFX.sheet ? SFX.sheet() : SFX.tap(); nfSheet(n); },
  nfList: () => { SFX.sheet ? SFX.sheet() : SFX.tap(); nfListSheet(); },
  nfPrint: (a, id) => { const n = nfById(id); if (!n) return; SFX.print ? SFX.print() : SFX.tap(); nfPrint(n); },
  nfMail: (a, id) => { const n = nfById(id); if (!n) return; SFX.tap(); location.href = `mailto:?subject=${encodeURIComponent(`${n.kind === "avoir" ? "Avoir" : "Facture"} n° ${n.no} · ${nfCfg().legal}`)}&body=${encodeURIComponent(nfText(n))}`; },
  nfShare: async (a, id) => { const n = nfById(id); if (!n) return; SFX.tap(); try { await navigator.share({ title: `Facture n° ${n.no}`, text: nfText(n) }); } catch (e) {} },
  nfAvoirAsk: (a, id) => {
    const n = nfById(id); if (!n) return; SFX.tap();
    openSheet(`<div class="nf-sh"><span class="h2">Annuler la facture n° ${esc(n.no)} ?</span><p class="sub">Une facture ne se supprime pas : on édite un avoir du même montant, qui l'annule. Vous pourrez ensuite refaire une note de frais pour cette table.</p>
      <div class="nf-chips col">${NF_WHY.map((w) => `<button class="chip" data-act="nfAvoir" data-id="${esc(n.id)}" data-v="${esc(w)}">${esc(w)}</button>`).join("")}</div>
      <button class="btn ghost block" data-act="nfOpen" data-id="${esc(n.id)}">Garder la facture</button></div>`);
  },
  nfAvoir: async (a, id, v) => {
    const n = nfById(id); if (!n || n.avoirId) return;
    const y = +dayKey().slice(0, 4), seq = nfNextSeq(y), neg = (x) => -x;
    const av = { kind: "avoir", year: y, seq, no: `${y}-${String(seq).padStart(4, "0")}`, day: dayKey(), at: Date.now(), uid: S.me.id, by: S.me.name || "", refId: n.id, refNo: n.no, why: v || "",
      tabId: n.tabId || "", table: n.table || "", covers: n.covers, mode: n.mode, label: n.label, company: n.company, address: n.address || "", vatNo: n.vatNo || "",
      lines: (n.lines || []).map((l) => ({ ...l, tot: neg(l.tot), pp: undefined })).map((l) => { delete l.pp; return l; }), rates: (n.rates || []).map((x) => ({ r: x.r, ht: neg(x.ht), tva: neg(x.tva), ttc: neg(x.ttc) })), total: neg(n.total) };
    try { const aid = await DB.add("fraisNotes", av); await DB.update("fraisNotes", id, { avoirId: aid, avoirNo: av.no }); if (typeof logEvent === "function") logEvent("frais", `a fait l'avoir n° ${av.no} (annule la facture n° ${n.no})`, { ref: aid }); SFX.ok ? SFX.ok() : SFX.tap(); nfSheet({ id: aid, ...av }); toast(`Avoir n° ${av.no} édité`); } catch (e) {}
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

/* ───────── hooks into js/salle.js (no edit of its bodies) ───────── */
(function nfHooks() {
  if (typeof slBillPaint !== "function") return;
  /* the bill: the « note de frais » switch just above « Table réglée » */
  const paint = slBillPaint;
  slBillPaint = function () {
    nfWatch(); const r = paint.apply(this, arguments);
    try {
      const sh = $(".sl-sh.bill"), b = SL.bill, tab = b && slTabOf(b.tab); if (!sh || !tab || sh.querySelector(".nf-bill,.nf-done")) return r;
      const close = sh.querySelector("[data-act=slClose]"); if (!close) return r;
      close.insertAdjacentHTML("beforebegin", nfBillBlock(tab));
      const B = nfB(tab.id); if (B.on && !nfOfTab(tab.id)) close.innerHTML = `${ico("check")}Table réglée · éditer la facture`;
    } catch (e) { console.warn("frais", e); }
    return r;
  };
  /* « Table réglée » with the switch on: the invoice is saved first, then shown */
  const close = ACT.slClose;
  ACT.slClose = async function (...args) {
    const tab = typeof slCurTab === "function" ? slCurTab() : null, B = tab && NF.B[tab.id];
    if (!tab || !B || !B.on || nfOfTab(tab.id)) return close.apply(this, args);
    let n; try { n = await nfIssue(tab); } catch (e) { console.warn("frais", e); if (!(e && e.code === "ab/blocked")) { SFX.err(); toast("Impossible d'éditer la facture, réessayez.", "err"); } return; }
    if (!n) return;
    await close.apply(this, args);
    setTimeout(() => nfSheet(nfById(n.id) || n), 700);
  };
  /* the floor: tables settled today, to make (or reprint) a note de frais after the fact */
  if (typeof slFloor !== "function") return;
  const floor = slFloor;
  slFloor = function () {
    const h = floor.apply(this, arguments);
    try {
      nfWatch(); const today = dayKey();
      const done = (SL.tabs || []).filter((t) => t.status === "closed" && !t.mergedInto && t.day === today && slTotal(t.items || []) > 0).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, 12);
      const all = nfNotes().length;
      const rows = done.map((t) => { const n = nfOfTab(t.id); return `<div class="nf-dr"><b class="sl-ort mono">${esc(t.table)}</b><span class="nf-drt"><b>${nfEur(slTotal(t.items || []))}</b><em>${slCovers(t)} · réglée à ${hm(t.closedAt || t.openedAt)}</em></span>
        ${n ? `<button class="btn soft sm" data-act="nfOpen" data-id="${esc(n.id)}">${ico("nfNote")}Facture ${esc(n.no)}</button>` : `<button class="btn ghost sm" data-act="nfTab" data-id="${esc(t.id)}">${ico("nfNote")}Note de frais</button>`}</div>`; }).join("");
      const block = done.length || all ? `<div class="row nf-flh st" style="--i:5"><span class="lbl">Réglées aujourd'hui</span>${all ? `<button class="nf-lnk" data-act="nfList">Toutes les notes de frais (${all})</button>` : ""}</div>
        ${done.length ? `<div class="glass nf-done-l st" style="--i:5">${rows}</div>` : ""}` : "";
      return block ? h.replace(/<\/div>\s*$/, block + "</div>") : h;
    } catch (e) { console.warn("frais", e); return h; }
  };
})();

/* ───────── demo: a few invoices already made, and one table settled today ───────── */
function nfSeedDemo() {
  const p = `restos/${S.rid}/fraisNotes`; if (DB.local[p]) return;
  DB.local[p] = {};
  DB.local[`restos/${S.rid}/fraisCfg`] = { main: { legal: "SAS Le Bistrot Démo", address: "12 rue des Vignes, 69002 Lyon", siret: "91234567800018", tva: "FR41912345678", footer: "SAS au capital de 10 000 € · RCS Lyon 912 345 678", at: Date.now() } };
  const today = dayKey(), y = +today.slice(0, 4), now = Date.now();
  /* a table settled an hour ago (no note yet) and one settled with its note */
  const tp = `restos/${S.rid}/salleTabs`; if (!DB.local[tp] && typeof slSeedDemo === "function") try { slSeedDemo(); } catch (e) {} DB.local[tp] = DB.local[tp] || {};
  const it = (name, price, q, cat) => ({ k: "nf" + name.length + q, id: "", name, price, q, note: "", allergy: [], course: cat === "boisson" ? 0 : 2, cat, sent: "x" });
  const t8 = [it("Bœuf bourguignon", 22, 3, "plat"), it("Filet de bar, beurre blanc", 24, 1, "plat"), it("Mousse au chocolat", 7, 4, "dessert"), it("Bouteille de Côtes-du-Rhône", 28, 1, "boisson"), it("Café", 2.5, 4, "boisson")];
  const t12 = [it("Menu du midi", 32, 4, "plat"), it("Carafe d'eau", 0, 1, "boisson"), it("Verre de Chablis", 7.5, 2, "boisson"), it("Café", 2.5, 4, "boisson")];
  const tab = (id, table, covers, ago, items) => { DB.local[tp][id] = { table, tableId: "nf" + table, zone: "salle", covers, status: "closed", day: today, openedAt: now - (ago + 80) * 6e4, closedAt: now - ago * 6e4, by: "demo-sarah", byName: "Sarah Lemoine", note: "", items, total: nfR2(items.reduce((a, x) => a + x.price * x.q, 0)) }; return { id, ...DB.local[tp][id] }; };
  tab("nfd-t8", "8", 4, 55, t8); const T12 = tab("nfd-t12", "12", 4, 95, t12);
  let seq = 0;
  const put = (o, ago) => { seq++; const day = addDays(today, -ago), dt = parseDay(day); dt.setHours(ago ? 14 : new Date().getHours(), ago ? 30 : 0, 0, 0); const d = { year: y, seq, no: `${y}-${String(seq).padStart(4, "0")}`, day, at: ago ? dt.getTime() : now - 90 * 6e4, uid: "demo-sarah", by: "Sarah Lemoine", ...o }; DB.local[p]["nfd" + seq] = d; return "nfd" + seq; };
  const fake = (items, covers) => ({ items, covers });
  const mk = (src, B, extra = {}) => { const n = nfBuild({ id: "", table: extra.table || "", day: today, ...src }, { mode: "repas", label: "Repas complet", pay: "Carte bancaire", ...B }); delete n.day; return { ...n, ...extra }; };
  put(mk(fake([it("Plat du jour", 17, 2, "plat"), it("Café", 2.5, 2, "boisson")], 2), { company: "Cabinet Marchand", address: "8 rue de la République, 69001 Lyon", ticket: "1842" }, { table: "4", tabId: "" }), 12);
  const f2 = put(mk(fake([it("Entrecôte, frites maison", 26, 3, "plat"), it("Pichet de vin rouge", 18, 1, "boisson")], 3), { company: "Atelier Lumière", address: "4 quai Saint-Antoine, 69002 Lyon" }, { table: "6" }), 9);
  const a2 = put({ ...mk(fake([it("Entrecôte, frites maison", 26, 3, "plat"), it("Pichet de vin rouge", 18, 1, "boisson")], 3), { company: "Atelier Lumière", address: "4 quai Saint-Antoine, 69002 Lyon" }, { table: "6" }), kind: "avoir", refId: "nfd2", refNo: `${y}-0002`, why: "Mauvaise société" }, 9);
  const av = DB.local[p][a2]; av.total = -av.total; av.lines = av.lines.map((l) => ({ ...l, tot: -l.tot })); av.lines.forEach((l) => delete l.pp); av.rates = av.rates.map((x) => ({ r: x.r, ht: -x.ht, tva: -x.tva, ttc: -x.ttc }));
  Object.assign(DB.local[p][f2], { avoirId: a2, avoirNo: av.no });
  put(mk(fake([it("Entrecôte, frites maison", 26, 3, "plat"), it("Pichet de vin rouge", 18, 1, "boisson")], 3), { company: "Atelier Lumière SAS", address: "4 quai Saint-Antoine, 69002 Lyon", vatNo: "FR23884512376" }, { table: "6" }), 9);
  put(mk(T12, { company: "Groupe Vénus Immobilier", address: "21 cours Lafayette, 69003 Lyon", ticket: "2031" }, { table: "12", tabId: "nfd-t12" }), 0);
  setTimeout(() => { try { DB.emit(tp); } catch (e) {} }, 0);
}
