/* Growth Gusto — Marges & factures fournisseurs. Prefix mg. Owned: js/marge.js, css/marge.css, vendor/ocr/.
   1) Fiches techniques chiffrées : coût matière par portion, marge, coefficient, food cost de chaque plat de la carte (les recettes
      de notes.js, cat « Recettes »), recalculés à chaque nouveau prix d'achat. Carte en 4 cases (ventes des tickets Z × marge).
   2) Factures fournisseurs : photo ou PDF lus SUR L'APPAREIL (Tesseract.js + pdf.js, gratuits, rien n'est envoyé), lignes
      rapprochées des produits du stock, prix mis à jour, hausses détectées avec leur effet sur la marge de chaque plat.

   Data (see tools/BRIEF.md, never rename):
   invoices/{id} = { supplier, number, day:"YYYY-MM-DD", totalHT, totalTTC, vat, lines:[{ name, qty, unit, price (€ HT / unité facture),
                     total, productId?, per (unités de stock par unité facture), unitPrice (€ HT / unité de stock) }], photoId?, src, status, at, by }
   prices/{id}   = { productId, name, supplier, unit, price, prev, pct, day, at, src:"facture"|"manuel", invoiceId?, by }
   notes (Recettes) gain optional { vat (taux TVA de vente, 10 par défaut), targetFc (food cost visé, %) }.
   products gain optional { aliases:[libellés facture normalisés], packs:{ unitéFacture: unités de stock } }.
   Global helpers: mgDishCost(noteId), mgPriceOf(productId, day?), mgPriceAlerts(days). */
"use strict";

Object.assign(IC, {
  mgCoin: ["c:12,12,8.5", "f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M14.8 9.2a3.2 3.2 0 1 0 0 5.6", "M8 11h4.5", "M8 13.2h4.5"],
  mgInvoice: ["f:M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z", "M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z", "M9 8h6", "M9 11.5h6", "M9 15h3.5"],
  mgUp: ["M4 17l6-6 4 4 6-7", "M15 8h5v5"],
  mgDown: ["M4 7l6 6 4-4 6 7", "M15 16h5v-5"],
  mgScanDoc: ["M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8", "M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8", "M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16", "M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16", "f:M8 7h8v10H8z", "M8 7h8v10H8z", "M10 10h4", "M10 13h4", "M3 12h18"],
  mgPdf: ["f:M6 3h8l4 4v14H6z", "M6 3h8l4 4v14H6z", "M14 3v4h4", "M8.5 16v-4h1.3a1.2 1.2 0 0 1 0 2.4H8.5", "M12.5 12v4h.8a1.6 1.6 0 0 0 1.6-1.6v-.8a1.6 1.6 0 0 0-1.6-1.6z", "M16.5 12h-1.3v4", "M15.2 14h1.1"],
  mgGrid4: ["r:4,4,7,7,2", "r:13,4,7,7,2", "r:4,13,7,7,2", "f:M13 13h7v7h-7z", "r:13,13,7,7,2"],
  mgTag: ["f:M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z", "M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z", "c:8,8,1.4"],
  mgTarget: ["c:12,12,8.5", "c:12,12,5", "c:12,12,1.5"],
  mgLink: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"],
});

/* ───────────────────────── small helpers ───────────────────────── */
const MG_TODAY = () => dayKey();
const mgR2 = (v) => Math.round(v * 100) / 100;
const mgEur = (v, d = 2) => (v == null || isNaN(v) ? "–" : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} €`);
const mgEurS = (v) => (v > 0 && v < 0.005 ? "<\u00a00,01\u00a0€" : mgEur(v));
const mgEur0 = (v) => mgEur(v, Math.abs(v) >= 100 ? 0 : 2);
const mgPct = (v, d = 0) => (v == null || !isFinite(v) ? "–" : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
const mgSigned = (v, f = mgEur) => (v > 0 ? "+" : v < 0 ? "−" : "") + f(Math.abs(v));
const mgNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9%]+/g, " ").trim();
const mgPl = (n, one, many) => `${n} ${n > 1 ? many || one + "s" : one}`;
const mgInputNum = (v) => { const n = num(String(v ?? "").replace(/\s|€/g, "")); return n == null || !isFinite(n) ? null : n; };
const mgDayTx = (k) => { const d = parseDay(k); if (!d) return ""; const M = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]; return `${d.getDate()} ${M[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`; };
const mgMonthTx = (k) => { const d = parseDay(k + "-01"); const M = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]; return d ? `${M[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}` : k; };
const mgReduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ───────────────────────── prices: current, history, at a date ───────────────────────── */
const mgProd = (id) => S.products.find((p) => p.id === id);
function mgHist(pid) { return (S.prices || []).filter((x) => x.productId === pid && num(x.price) > 0).sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.at || 0) - (b.at || 0)); }
/* € HT per stock unit of a product, today or on a given day (from the price history; before the first known price: its « prev ») */
function mgPriceOf(pid, day) {
  const p = mgProd(pid); const cur = p && num(p.price) > 0 ? num(p.price) : null;
  if (!day || day >= MG_TODAY()) return cur;
  const H = mgHist(pid); if (!H.length) return cur;
  let v = null; for (const h of H) { if ((h.day || "") <= day) v = num(h.price); else break; }
  if (v != null) return v;
  return num(H[0].prev) > 0 ? num(H[0].prev) : num(H[0].price);
}
window.mgPriceOf = mgPriceOf;
/* the last change of a product's price within N days: { prev, price, pct, day, supplier } */
function mgLastChange(pid, days = 45) {
  const from = addDays(MG_TODAY(), -days); const H = mgHist(pid).filter((h) => num(h.prev) > 0 && (h.day || "") >= from && Math.abs(num(h.pct) || 0) >= 0.5);
  return H.length ? H[H.length - 1] : null;
}

/* ───────────────────────── recipes: cost, margin ───────────────────────── */
const MG_CATS = [["tout", "Tout"], ["entree", "Entrées"], ["plat", "Plats"], ["dessert", "Desserts"], ["partage", "À partager"], ["boisson", "Boissons"]];
const mgRecipes = () => (S.notes || []).filter((n) => (typeof noteKind === "function" ? noteKind(n) : n.cat) === "Recettes");
const mgDishes = () => mgRecipes().filter((n) => n.carte || num(n.price) > 0);
const mgTargetDefault = () => num(S.resto?.fcTarget) || 30;
const mgTarget = (n) => num(n && n.targetFc) || mgTargetDefault();
const mgVat = (n) => (n && num(n.vat) != null ? num(n.vat) : 10);
const mgQty = (q) => (typeof noteQtyVal === "function" ? noteQtyVal(q) : num(q));
const mgConv = (v, from, to) => (typeof noteConv === "function" ? noteConv(v, from, to) : from === to ? v : null);
const mgLink = (g) => (typeof noteIngLink === "function" ? noteIngLink(g) : g && g.productId ? (mgProd(g.productId) ? { t: "p", p: mgProd(g.productId) } : null) : null);

/* cost of one batch with the prices of `day` (today by default), line by line */
function mgCost(note, day, seen = new Set()) {
  const out = { batch: 0, lines: [], known: 0, missing: 0 }; if (!note) return out; seen = new Set(seen); seen.add(note.id);
  (note.ingredients || []).forEach((g, i) => {
    if (!String(g.name || "").trim()) return;
    const L = mgLink(g); const v = mgQty(g.qty); const row = { i, name: g.name, qty: g.qty, unit: g.unit || "", v, cost: null, kind: L ? L.t : null, id: L ? (L.t === "p" ? L.p.id : L.n.id) : null, why: "" };
    if (v == null) { row.why = "qty"; out.missing++; out.lines.push(row); return; }
    if (L && L.t === "p") {
      const pr = mgPriceOf(L.p.id, day); row.pu = pr; row.pUnit = L.p.unit;
      if (pr > 0) { const q = mgConv(v, g.unit, L.p.unit); if (q != null) { row.cost = q * pr; row.q = q; out.batch += row.cost; out.known++; out.lines.push(row); return; } row.why = "unit"; }
      else row.why = "price";
    } else if (L && L.t === "n" && !seen.has(L.n.id)) {
      const c = mgCost(L.n, day, seen); const sp = num(L.n.portions) || 1; const un = mgNorm(g.unit);
      const k = (typeof noteUnitKey === "function" ? noteUnitKey(g.unit)[0] === "u" : !un) || /portion/.test(un) ? v / sp : /fourn/.test(un) ? v : null;
      if (k != null && c.known) { row.cost = c.batch * k; out.batch += row.cost; out.known++; out.lines.push(row); return; } row.why = "sub";
    } else row.why = "link";
    out.missing++; out.lines.push(row);
  });
  return out;
}
/* everything about one dish: cost per portion, selling price HT, margin, food cost %, coefficient */
function mgDish(note, day) {
  const c = mgCost(note, day); const por = num(note.portions) || 1; const cost = c.batch / por;
  const ttc = num(note.price) > 0 ? num(note.price) : 0; const vat = mgVat(note); const ht = ttc ? ttc / (1 + vat / 100) : 0;
  const margin = ht ? ht - cost : null; const fc = ht && c.known ? (cost / ht) * 100 : null; const coef = cost > 0 && ttc ? ttc / cost : null;
  return { n: note, cost, batch: c.batch, lines: c.lines, known: c.known, missing: c.missing, complete: c.known > 0 && !c.missing, ttc, ht, vat, margin, fc, coef, por, target: mgTarget(note) };
}
function mgDishCost(id) { const n = typeof id === "object" ? id : S.notes.find((x) => x.id === id); if (!n) return null; const d = mgDish(n); return { portion: d.cost, batch: d.batch, margin: d.margin, fc: d.fc, coef: d.coef, ht: d.ht, ttc: d.ttc, complete: d.complete }; }
window.mgDishCost = mgDishCost;
/* suggested price TTC for a food cost target, rounded to the next 0,50 € */
const mgSuggest = (cost, target, vat) => (cost > 0 ? Math.ceil(((cost / (target / 100)) * (1 + vat / 100)) * 2) / 2 : null);
const mgFcTone = (fc, target) => (fc == null ? "neu" : fc <= target ? "ok" : fc <= target + 5 ? "warn" : "bad");

/* ───────────────────────── sales (tickets Z) ───────────────────────── */
function mgSalesMap(days = 30) {
  const from = addDays(MG_TODAY(), -days); const m = {};
  (S.tickets || []).filter((t) => (t.date || "") >= from).forEach((t) => (t.lines || []).forEach((l) => {
    const q = num(l.quantite) || 0; if (q <= 0) return;
    const r = typeof tkRecipeFor === "function" ? tkRecipeFor(l) : l.noteId ? S.notes.find((n) => n.id === l.noteId) : null; if (!r) return;
    m[r.id] = (m[r.id] || 0) + q;
  }));
  return m;
}

/* ───────────────────────── price alerts: rises and their effect on each dish ───────────────────────── */
function mgUsers(pid) { /* dishes that use a product, with the quantity of stock unit per portion */
  const out = []; mgRecipes().forEach((n) => { const d = mgCost(n); const rows = d.lines.filter((l) => l.kind === "p" && l.id === pid && l.q != null); if (!rows.length) return; const q = rows.reduce((s, l) => s + l.q, 0) / (num(n.portions) || 1); out.push({ n, q }); });
  return out;
}
function mgPriceAlerts(days = 30, min = 2) {
  const from = addDays(MG_TODAY(), -days); const last = {}; const sales = mgSalesMap(30);
  (S.prices || []).forEach((h) => { if ((h.day || "") < from || !(num(h.prev) > 0)) return; const k = h.productId; if (!last[k] || (h.day || "") > (last[k].day || "") || ((h.day || "") === (last[k].day || "") && (h.at || 0) > (last[k].at || 0))) last[k] = h; });
  return Object.values(last).filter((h) => Math.abs(num(h.pct) || 0) >= min && mgProd(h.productId)).map((h) => {
    const p = mgProd(h.productId); const dp = num(h.price) - num(h.prev);
    const dishes = mgUsers(h.productId).map(({ n, q }) => ({ n, per: q * dp, month: q * dp * (sales[n.id] || 0) })).sort((a, b) => Math.abs(b.month || b.per) - Math.abs(a.month || a.per));
    return { h, p, pct: num(h.pct), dp, dishes, month: dishes.reduce((s, d) => s + d.month, 0) };
  }).sort((a, b) => (b.pct > 0) - (a.pct > 0) || Math.abs(b.month) - Math.abs(a.month) || b.pct - a.pct);
}
window.mgPriceAlerts = mgPriceAlerts;
const mgRises = () => mgPriceAlerts(30, 2).filter((a) => a.pct > 0);

/* ───────────────────────── charts (SVG, flat fills: no gradients in V2) ───────────────────────── */
function mgRing(fc, target, size = 132) {
  const r = size / 2 - 11, C = 2 * Math.PI * r, v = fc == null ? 0 : Math.max(0, Math.min(100, fc)); const tone = mgFcTone(fc, target);
  const ta = (Math.min(100, target) / 100) * 360 - 90, tx = size / 2 + r * Math.cos((ta * Math.PI) / 180), ty = size / 2 + r * Math.sin((ta * Math.PI) / 180);
  return `<svg class="mg-ring ${tone}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" style="--c:${C.toFixed(1)};--o:${(C * (1 - v / 100)).toFixed(1)}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - v / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><circle class="tg" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="5"/></svg>`;
}
function mgSpark(vals, w = 76, h = 26, cls = "") {
  const V = vals.filter((x) => x != null); if (V.length < 2) return "";
  const lo = Math.min(...V), hi = Math.max(...V), sp = hi - lo || hi * 0.1 || 1; const X = (i) => (i / (vals.length - 1)) * (w - 4) + 2, Y = (v) => h - 3 - ((v - lo) / sp) * (h - 6);
  const pts = vals.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean); const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  const e = pts[pts.length - 1];
  return `<svg class="mg-spark ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}"/><circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="2.6"/></svg>`;
}
/* a dish's cost per portion over the last N days (one point a week) */
function mgCostSeries(n, days = 84, step = 7) { const out = []; for (let k = days; k >= 0; k -= step) { const d = addDays(MG_TODAY(), -k); out.push({ d, v: mgDish(n, k ? d : undefined).cost }); } return out; }
function mgLineChart(series, { w = 560, h = 170, fmtV = mgEur, cls = "", step = false } = {}) {
  const P = series.filter((s) => s.v != null); if (P.length < 2) return "";
  const lo0 = Math.min(...P.map((s) => s.v)), hi0 = Math.max(...P.map((s) => s.v)); const pad = (hi0 - lo0) * 0.25 || hi0 * 0.08 || 1; const lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const L = 8, R = 8, T = 18, B = 26; const ts = series.map((s) => (parseDay(s.d) || new Date()).getTime()); const t0 = ts[0], t1 = ts[ts.length - 1];
  const X = step && t1 > t0 ? (i) => L + ((ts[i] - t0) / (t1 - t0)) * (w - L - R) : (i) => L + (i / (series.length - 1)) * (w - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
  const pts = series.map((s, i) => (s.v == null ? null : [X(i), Y(s.v), s])).filter(Boolean);
  const line = pts.map((p, i) => (i ? (step ? `H${p[0].toFixed(1)}V${p[1].toFixed(1)}` : `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`) : `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`)).join("");
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)} ${h - B}L${pts[0][0].toFixed(1)} ${h - B}Z`;
  const ticks = [...new Set([0, step ? -1 : Math.floor((series.length - 1) / 2), series.length - 1])].filter((i) => i >= 0).map((i) => `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="${i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}">${i === series.length - 1 ? "Auj." : esc(mgDayTx(series[i].d))}</text>`).join("");
  const e = pts[pts.length - 1], f = pts[0];
  return `<svg class="mg-chart ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><line class="base" x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}"/><path class="area" d="${area}"/><path class="ln" d="${line}" pathLength="1"/>
    <circle class="pt0" cx="${f[0].toFixed(1)}" cy="${f[1].toFixed(1)}" r="3.5"/><circle class="pt" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="5"/>${ticks}</svg>
    <div class="mg-chart-v"><span>${fmtV(f[2].v)}</span><b>${fmtV(e[2].v)}</b></div>`;
}

/* ───────────────────────── menu engineering: the menu in 4 boxes ───────────────────────── */
const MG_QUAD = {
  star: ["Vedettes", "Très vendus et rentables : ne changez rien.", "ok"],
  horse: ["À rentabiliser", "Très vendus mais peu de marge : prix ou portion à revoir.", "warn"],
  puzzle: ["Pépites cachées", "Rentables mais peu vendus : mettez-les en avant.", "acc"],
  dog: ["À revoir", "Peu vendus et peu rentables : retravaillez ou retirez.", "bad"],
};
function mgMatrix(rows) {
  const R = rows.filter((r) => r.margin != null && r.known); const tot = R.reduce((s, r) => s + r.sold, 0); if (R.length < 3 || tot <= 0) return null;
  const popT = (tot / R.length) * 0.7; const mT = R.reduce((s, r) => s + r.margin * r.sold, 0) / tot;
  R.forEach((r) => { r.quad = r.sold >= popT ? (r.margin >= mT ? "star" : "horse") : r.margin >= mT ? "puzzle" : "dog"; });
  return { R, popT, mT, tot };
}
function mgMatrixSvg(M) {
  const w = 340, h = 250, L = 14, Rm = 14, T = 14, B = 26; const maxS = Math.max(...M.R.map((r) => r.sold)) * 1.12, lo = Math.min(0, ...M.R.map((r) => r.margin)), hi = Math.max(...M.R.map((r) => r.margin)) * 1.15;
  const X = (s) => L + (s / maxS) * (w - L - Rm), Y = (m) => T + (1 - (m - lo) / (hi - lo || 1)) * (h - T - B);
  const cx = X(M.popT), cy = Y(M.mT);
  const q = (x, y, ww, hh, c) => `<rect class="q ${c}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, ww).toFixed(1)}" height="${Math.max(0, hh).toFixed(1)}" rx="10"/>`;
  /* labels: above their dot, nudged apart when they collide, kept inside the box */
  const placed = []; const dots = M.R.slice().sort((a, b) => b.sold - a.sold).map((r, i) => {
    const rr = 7 + Math.min(9, Math.sqrt(r.sold) * 0.9); const x = X(r.sold), y = Y(r.margin); const t = mgShort(r.n.title); const tw = t.length * 5.7 + 6;
    let lx = Math.max(L + tw / 2, Math.min(w - Rm - tw / 2, x)), ly = y - rr - 6; const hit = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < 12;
    for (let k = 0; k < 8 && placed.some((b) => hit({ x: lx, y: ly, w: tw }, b)); k++) ly = k % 2 ? y - rr - 6 - 12 * Math.ceil((k + 1) / 2) : y + rr + 14 + 12 * Math.floor(k / 2);
    ly = Math.max(T + 10, Math.min(h - B - 4, ly)); placed.push({ x: lx, y: ly, w: tw });
    return `<g class="dot ${r.quad}" style="--i:${i}" data-go="margeFiche" data-id="${esc(r.n.id)}" role="button" tabindex="0" aria-label="${esc(r.n.title)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${esc(t)}</text></g>`;
  }).join("");
  return `<svg class="mg-mx" viewBox="0 0 ${w} ${h}">${q(L, T, cx - L - 3, cy - T - 3, "puzzle")}${q(cx + 3, T, w - Rm - cx - 3, cy - T - 3, "star")}${q(L, cy + 3, cx - L - 3, h - B - cy - 3, "dog")}${q(cx + 3, cy + 3, w - Rm - cx - 3, h - B - cy - 3, "horse")}
    <text class="ax" x="${w - Rm}" y="${h - 8}" text-anchor="end">Plus vendus →</text><text class="ax" x="${L}" y="${h - 8}">Marge par assiette ↑</text>${dots}</svg>`;
}
const mgShort = (t) => { const s = String(t || "").replace(/\(.*?\)/g, "").trim(); return s.length > 16 ? s.slice(0, 15).trim() + "…" : s; };

/* ───────────────────────── VIEW: marges (la carte chiffrée) ───────────────────────── */
TAB_OF.marges = "more"; TAB_OF.margeFiche = "more"; TAB_OF.factures = "more"; TAB_OF.facture = "more"; TAB_OF.factureScan = "more";
(function mgNav() {
  const i = NAV.findIndex((n) => n[0] === "stock"); const at = i >= 0 ? i + 1 : NAV.length;
  if (!NAV.some((n) => n[0] === "marges")) NAV.splice(at, 0, ["marges", "mgCoin", "Marges & fiches"], ["factures", "mgInvoice", "Factures fournisseurs"]);
  if (typeof AB_GATE !== "undefined") Object.assign(AB_GATE, { marges: ["pro", "Marges"], margeFiche: ["pro", "Marges"], factures: ["pro", "Factures fournisseurs"], facture: ["pro", "Factures fournisseurs"], factureScan: ["pro", "Factures fournisseurs"] });
})();

function mgRows() {
  const sales = mgSalesMap(30);
  return mgDishes().map((n) => { const d = mgDish(n); const old = mgDish(n, addDays(MG_TODAY(), -30)); d.sold = sales[n.id] || 0; d.fcOld = old.fc; d.marginOld = old.margin; d.cat = n.carteCat || "plat"; return d; });
}
function mgSortRows(R, k) {
  const by = { marge: (a, b) => (b.margin ?? -1e9) - (a.margin ?? -1e9), fc: (a, b) => (b.fc ?? -1) - (a.fc ?? -1), ventes: (a, b) => b.sold - a.sold || (b.margin ?? 0) - (a.margin ?? 0) }[k] || null;
  return R.slice().sort(by || ((a, b) => (b.margin ?? -1e9) - (a.margin ?? -1e9)));
}
function mgHeroHTML(R) {
  const P = R.filter((r) => r.fc != null); const target = mgTargetDefault();
  if (!P.length) return `<div class="wall mg-hero mg-hero0 st" style="--i:1"><div class="mg-h0ic">${ico("mgCoin")}</div><div><b>Chiffrez votre carte</b><span>Mettez un prix de vente à vos recettes et liez leurs ingrédients au stock : la marge de chaque plat se calcule toute seule.</span></div></div>`;
  const sold = P.reduce((s, r) => s + r.sold, 0); const w = (r) => (sold ? r.sold : 1);
  const W = P.reduce((s, r) => s + w(r), 0); const fc = P.reduce((s, r) => s + r.fc * w(r), 0) / W; const avgM = P.reduce((s, r) => s + r.margin * w(r), 0) / W;
  const monthM = P.reduce((s, r) => s + r.margin * r.sold, 0);
  const Po = P.filter((r) => r.fcOld != null); const fcOld = Po.length ? Po.reduce((s, r) => s + r.fcOld * w(r), 0) / Po.reduce((s, r) => s + w(r), 0) : null; const dFc = fcOld != null ? fc - fcOld : null;
  return `<div class="wall mg-hero st" style="--i:1">
    <div class="mg-hring">${mgRing(fc, target, 128)}<div class="mg-hrv"><b class="mono" data-mgcount="${fc.toFixed(1)}" data-d="0">${mgPct(fc)}</b><span>food cost</span></div></div>
    <div class="mg-htx"><span class="mg-hk">Votre carte</span>
      <b class="mg-hbig mono">${mgEur(avgM)}</b><span class="mg-hl">de marge par assiette${sold ? " en moyenne" : ""}</span>
      <div class="mg-hchips"><button class="mg-hchip" data-act="mgTargetSheet">${ico("mgTarget")}Objectif ${mgPct(target)}</button>${dFc != null && Math.abs(dFc) >= 0.2 ? `<span class="mg-hchip ${dFc > 0 ? "up" : "dn"}">${ico(dFc > 0 ? "mgUp" : "mgDown")}${dFc > 0 ? "+" : "−"}${fmt(Math.abs(dFc), 1)} pt en 30 j</span>` : ""}</div>
    </div>
    ${monthM > 0 ? `<div class="mg-hfoot"><span>Marge brute des 30 derniers jours sur ces plats</span><b class="mono">${mgEur0(monthM)}</b></div>` : ""}
  </div>`;
}
function mgAlertCards(A, i0 = 2, max = 6) {
  if (!A.length) return "";
  return `<div class="mg-alerts st" style="--i:${i0}"><div class="mg-sech"><span class="lbl">Hausses de prix · 30 jours</span><button class="btn ghost sm" data-go="factures">Tout voir</button></div>
    <div class="mg-acards">${A.slice(0, max).map((a, i) => { const d0 = a.dishes[0]; return `<button class="mg-acard st" style="--i:${i0 + 1 + i}" data-act="mgPriceSheet" data-id="${esc(a.p.id)}">
      <span class="mg-apct mono">+${fmt(a.pct, a.pct < 10 ? 1 : 0)} %</span><b>${esc(a.p.name)}</b><em>${mgEur(a.h.prev)} → ${mgEur(a.h.price)} / ${esc(a.p.unit)}</em>
      ${d0 ? `<span class="mg-aimp">${a.month ? `<b class="mono">−${mgEur0(Math.abs(a.month))}</b> de marge par mois` : `<b class="mono">−${mgEur(Math.abs(d0.per))}</b> par ${esc(mgShort(d0.n.title).toLowerCase())}`}</span>` : `<span class="mg-aimp quiet">Dans aucune recette</span>`}
    </button>`; }).join("")}</div></div>`;
}
function mgDishRow(r, i) {
  const tone = mgFcTone(r.fc, r.target); const bar = r.ht ? Math.min(100, (r.cost / r.ht) * 100) : 0; const d = r.fc != null && r.fcOld != null ? r.fc - r.fcOld : 0;
  const sub = !r.ttc ? "Sans prix de vente" : !r.known ? "Ingrédients sans prix" : `Coût ${mgEur(r.cost)} · vendu ${mgEur(r.ttc)}`;
  return `<button class="mg-dish st" style="--i:${i}" data-go="margeFiche" data-id="${esc(r.n.id)}">
    <span class="mg-dtx"><b>${esc(r.n.title || "Sans titre")}</b><em>${esc(sub)}${r.missing && r.known ? ` · <span class="mg-miss">estimation</span>` : ""}</em>
      ${r.ht && r.known ? `<span class="mg-dbar ${tone}"><i style="--w:${bar.toFixed(1)}%"></i><s style="--t:${Math.min(100, r.target)}%"></s></span>` : ""}</span>
    <span class="mg-dnum">${r.margin != null && r.known ? `<b class="mono">${mgEur(r.margin)}</b><span class="mg-fc ${tone}">${mgPct(r.fc)}${Math.abs(d) >= 0.5 ? `<i class="${d > 0 ? "up" : "dn"}">${ico(d > 0 ? "mgUp" : "mgDown")}</i>` : ""}</span>` : `<span class="mg-fc neu">À compléter</span>`}</span>
  </button>`;
}
VIEWS.marges = {
  render() {
    const R = mgRows(); const ui = (S.ui.mg ||= { cat: "tout", sort: "marge" });
    if (!mgRecipes().length) return `<div class="inner narrow mg">${topBar("Marges")}<div class="glass empty mg-empty st" style="--i:1"><div class="ic">${ico("mgCoin")}</div><b>Pas encore de recette</b>Écrivez vos recettes avec leurs ingrédients et leur prix de vente : Growth Gusto calcule la marge de chaque plat, et la met à jour à chaque facture.<div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn acc" data-go="notes">${ico("book")}Mes recettes</button><button class="btn soft" data-go="factures">${ico("mgInvoice")}Scanner une facture</button></div></div></div>`;
    const cats = MG_CATS.filter(([k]) => k === "tout" || R.some((r) => r.cat === k)); if (!cats.some(([k]) => k === ui.cat)) ui.cat = "tout";
    const list = mgSortRows(R.filter((r) => ui.cat === "tout" || r.cat === ui.cat), ui.sort);
    const M = mgMatrix(R); const A = mgRises();
    const todo = mgRecipes().filter((n) => !n.carte && !(num(n.price) > 0)); const incomplete = R.filter((r) => !r.known || !r.ttc);
    let k = 3 + Math.min(A.length, 6);
    const right = `<button class="btn soft sm" data-go="factures">${ico("mgInvoice")}<span class="mg-hide-s">Factures</span></button>`;
    return `<div class="inner wide mg">${topBar("Marges", { right })}
      <div class="mg-top">${mgHeroHTML(R)}${mgAlertCards(A)}</div>
      <div class="mg-cols"><div>
        <div class="mg-filt st" style="--i:${k++}"><div class="mg-chips" role="tablist">${cats.map(([c, t]) => `<button class="chip ${ui.cat === c ? "on" : ""}" data-act="mgCat" data-v="${c}" role="tab" aria-selected="${ui.cat === c}">${t}</button>`).join("")}</div>
          <div class="seg mg-sort"><span class="knob" style="width:calc(33.333% - 3px);transform:translateX(${["marge", "fc", "ventes"].indexOf(ui.sort) * 100}%)"></span>${[["marge", "Marge"], ["fc", "Food cost"], ["ventes", "Ventes"]].map(([s, t]) => `<button class="${ui.sort === s ? "on" : ""}" data-act="mgSort" data-v="${s}">${t}</button>`).join("")}</div></div>
        <div class="mg-list">${list.length ? list.map((r) => mgDishRow(r, k++)).join("") : `<div class="glass empty st" style="--i:${k++}">Aucun plat dans cette catégorie.</div>`}</div>
        ${todo.length ? `<button class="glass mg-todo st" style="--i:${k++}" data-act="mgTodo"><span class="mg-tic">${ico("mgTag")}</span><span class="tx"><b>${mgPl(todo.length, "recette")} sans prix de vente</b><em>${esc(todo.slice(0, 3).map((n) => n.title).join(", "))}${todo.length > 3 ? "…" : ""}</em></span>${ico("chev")}</button>` : ""}
      </div><div>
        ${M ? `<div class="glass pad mg-mxcard st" style="--i:${k++}"><div class="mg-sech"><span class="lbl">Votre carte en 4 cases</span><span class="sub">ventes sur 30 jours</span></div>${mgMatrixSvg(M)}
          <div class="mg-mxleg">${["star", "puzzle", "horse", "dog"].map((q) => { const N = M.R.filter((r) => r.quad === q); return `<div class="mg-mxl ${q}"><b>${MG_QUAD[q][0]}${N.length ? ` <span class="mono">${N.length}</span>` : ""}</b><span>${MG_QUAD[q][1]}</span></div>`; }).join("")}</div></div>`
          : `<div class="glass pad mg-mxcard mg-mx0 st" style="--i:${k++}"><span class="lbl">Votre carte en 4 cases</span><p class="note">Saisissez vos tickets Z : chaque plat se range alors en vedette, pépite cachée, plat à rentabiliser ou à revoir.</p><button class="btn soft sm" data-go="tickets">${ico("receipt")}Tickets de caisse</button></div>`}
        ${incomplete.length ? `<div class="glass pad mg-help st" style="--i:${k++}"><span class="lbl">Pour des marges exactes</span><p class="note">${mgPl(incomplete.length, "plat")} ${incomplete.length > 1 ? "ont" : "a"} un ingrédient sans prix ou non lié au stock. Scannez vos factures : les prix se remplissent tout seuls.</p><button class="btn acc sm" data-go="factureScan">${ico("mgScanDoc")}Scanner une facture</button></div>` : ""}
      </div></div>
    </div>`;
  },
  after(v) { mgCountUp(v); },
};
function mgCountUp(v) {
  if (mgReduce()) return;
  $$("[data-mgcount]", v).forEach((el) => { const to = +el.dataset.mgcount; if (!isFinite(to)) return; const t0 = performance.now(), D = 700; const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = mgPct(to * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}

/* ───────────────────────── VIEW: margeFiche (fiche technique chiffrée d'un plat) ───────────────────────── */
function mgIngRows(d) {
  const L = d.lines.slice().sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1)); const tot = d.batch || 1;
  return L.map((l, i) => {
    const share = l.cost != null ? (l.cost / tot) * 100 : 0; const ch = l.kind === "p" ? mgLastChange(l.id, 60) : null; const p = l.kind === "p" ? mgProd(l.id) : null;
    const why = { qty: "Quantité à préciser", price: "Prix d'achat manquant", unit: "Unité différente du stock", link: "Non lié au stock", sub: "Sous-recette sans coût" }[l.why] || "";
    const det = l.cost != null ? (l.kind === "p" ? `${esc(String(l.qty))} ${esc(l.unit)} × ${mgEur(l.pu)}/${esc(l.pUnit)}` : `${esc(String(l.qty))} ${esc(l.unit)} · sous-recette`) : why;
    const act = l.why === "price" && p ? `data-act="prodEdit" data-id="${esc(p.id)}"` : l.kind === "p" && p ? `data-act="mgPriceSheet" data-id="${esc(p.id)}"` : l.kind === "n" ? `data-go="margeFiche" data-id="${esc(l.id)}"` : `data-act="noteEdit" data-id="${esc(d.n.id)}"`;
    return `<button class="mg-ing ${l.cost == null ? "miss" : ""} st" style="--i:${6 + i};--s:${share.toFixed(1)}%" ${act}>
      <span class="mg-ibar"></span><span class="mg-itx"><b>${esc(l.name)}</b><em>${det}</em></span>
      ${ch ? `<span class="mg-ich ${ch.pct > 0 ? "up" : "dn"} mono">${ch.pct > 0 ? "+" : "−"}${fmt(Math.abs(ch.pct), Math.abs(ch.pct) < 10 ? 1 : 0)} %</span>` : ""}
      <span class="mg-inum">${l.cost != null ? `<b class="mono">${mgEurS(l.cost / d.por)}</b><em class="mono">${share < 0.5 ? "< 1\u00a0%" : mgPct(share)}</em>` : `<span class="mg-fix">${l.why === "price" ? "Ajouter" : "Voir"}</span>`}</span></button>`;
  }).join("");
}
function mgStack(d) {
  const L = d.lines.filter((l) => l.cost > 0).sort((a, b) => b.cost - a.cost); if (!L.length) return "";
  const C = ["#5B2BFF", "#F6B93B", "#EF5A3C", "#9EC5FF", "#1E7F55", "#C9B8FF", "#E9DFCD"]; const top = L.slice(0, 6); const rest = L.slice(6).reduce((s, l) => s + l.cost, 0);
  const segs = top.map((l, i) => [l.name, l.cost, C[i]]).concat(rest ? [["Autres", rest, C[6]]] : []);
  return `<div class="mg-stack" aria-hidden="true">${segs.map(([n, c, col], i) => `<i style="--w:${((c / d.batch) * 100).toFixed(2)}%;--c:${col};--i:${i}" title="${esc(n)}"></i>`).join("")}</div>`;
}
function mgSimHTML(d, M) {
  const sim = S.ui.mgSim && S.ui.mgSim.id === d.n.id ? S.ui.mgSim : (S.ui.mgSim = { id: d.n.id, p: d.ttc || mgSuggest(d.cost, d.target, d.vat) || 0 });
  const p = sim.p || 0; const ht = p / (1 + d.vat / 100); const m = ht - d.cost; const fc = ht ? (d.cost / ht) * 100 : null; const sug = mgSuggest(d.cost, d.target, d.vat);
  const dm = d.ttc ? (m - d.margin) * (d.sold || 0) : 0; const lo = Math.max(1, Math.floor(Math.min(p, d.ttc || p, sug || p) * 0.6)), hi = Math.ceil(Math.max(p, d.ttc || p, sug || p) * 1.5);
  return `<div class="glass pad mg-sim st" style="--i:4" id="mgSim"><div class="mg-sech"><span class="lbl">${d.ttc ? "Et si je changeais le prix ?" : "Quel prix de vente ?"}</span>${d.ttc && Math.abs(p - d.ttc) > 0.001 ? `<button class="btn ghost sm" data-act="mgSimReset">Prix actuel</button>` : ""}</div>
    <div class="mg-simtop"><label class="mg-simp"><input class="mono" id="mgSimIn" inputmode="decimal" value="${fmt(p, 2)}" aria-label="Prix de vente TTC" autocomplete="off"><span>€ TTC</span></label>
      <div class="mg-simk"><span><b class="mono ${mgFcTone(fc, d.target)}" id="mgSimFc">${mgPct(fc)}</b><em>food cost</em></span><span><b class="mono" id="mgSimM">${mgEur(m)}</b><em>marge HT</em></span></div></div>
    <input type="range" class="mg-range" id="mgSimR" min="${lo}" max="${hi}" step="0.5" value="${p}" aria-label="Prix de vente" style="--k:${(((p - lo) / (hi - lo || 1)) * 100).toFixed(1)}%">
    <p class="mg-simn" id="mgSimN">${mgSimNote(d, p)}</p>
    <div class="mg-simbtns">${sug ? `<button class="btn soft sm" data-act="mgSimSug" data-v="${sug}">${ico("mgTarget")}${mgPct(d.target)} : ${mgEur(sug)}</button>` : ""}<button class="btn acc sm" data-act="mgSimSave" ${d.ttc && Math.abs(p - d.ttc) < 0.001 ? "disabled" : ""} id="mgSimSave">Appliquer ce prix</button></div>
    ${dm ? "" : ""}</div>`;
}
function mgSimNote(d, p) {
  const ht = p / (1 + d.vat / 100); const m = ht - d.cost; const sug = mgSuggest(d.cost, d.target, d.vat);
  const parts = [];
  if (d.ttc && Math.abs(p - d.ttc) > 0.001 && d.sold) { const dm = (m - d.margin) * d.sold; parts.push(`${dm >= 0 ? "+" : "−"}${mgEur0(Math.abs(dm))} de marge par mois au rythme actuel (${d.sold} vendus en 30 jours).`); }
  if (sug) parts.push(`Pour ${mgPct(d.target)} de food cost : ${mgEur(sug)} TTC.`);
  return parts.join(" ") || "Coefficient " + (d.cost > 0 ? fmt(p / d.cost, 2) : "–");
}
VIEWS.margeFiche = {
  nav: "marges",
  render({ id }) {
    const n = S.notes.find((x) => x.id === id);
    if (!n) return `<div class="inner narrow mg">${topBar("Fiche technique")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("book")}</div><b>Recette introuvable</b>Elle a peut-être été supprimée.</div></div>`;
    const d = mgDish(n); d.sold = mgSalesMap(30)[n.id] || 0; const tone = mgFcTone(d.fc, d.target);
    const M = mgMatrix(mgRows()); const me = M && M.R.find((r) => r.n.id === n.id);
    const series = d.known ? mgCostSeries(n) : []; const s0 = series.length ? series[0].v : null; const dCost = s0 && d.cost ? ((d.cost - s0) / s0) * 100 : null;
    const right = `<button class="iconbtn" data-act="mgPrintFiche" data-id="${esc(n.id)}" aria-label="Exporter la fiche technique en PDF">${ico("mgPdf")}</button><button class="btn soft sm" data-act="noteEdit" data-id="${esc(n.id)}">${ico("edit")}<span class="mg-hide-s">Modifier</span></button>`;
    const kpi = (lbl, v, cls = "") => `<div class="mg-kpi ${cls}"><em>${lbl}</em><b class="mono">${v}</b></div>`;
    return `<div class="inner wide mg mg-fiche">${topBar("", { right })}
      <div class="mg-fhead st" style="--i:1"><span class="mg-fk">${ico("mgCoin")}Fiche technique · ${esc(typeof noteCarteCat === "function" ? noteCarteCat(n.carteCat) : "Plat")}${me ? ` · <span class="mg-qtag ${me.quad}">${MG_QUAD[me.quad][0]}</span>` : ""}</span><h1 class="mg-ftitle">${esc(n.title || "Sans titre")}</h1><span class="sub">${mgPl(d.por, "portion")} par fournée${d.sold ? ` · ${d.sold} vendus en 30 jours` : ""}</span></div>
      <div class="mg-fcols"><div>
        <div class="glass mg-fhero ${tone} st" style="--i:2">
          <div class="mg-fring">${mgRing(d.fc, d.target, 150)}<div class="mg-hrv"><b class="mono">${mgPct(d.fc)}</b><span>food cost</span><em>objectif ${mgPct(d.target)}</em></div></div>
          <div class="mg-kpis">${kpi("Coût par portion", d.known ? mgEur(d.cost) : "–")}${kpi("Prix de vente", d.ttc ? mgEur(d.ttc) + "<small> TTC</small>" : "–")}${kpi("Marge par portion", d.margin != null && d.known ? mgEur(d.margin) + "<small> HT</small>" : "–", "big")}${kpi("Coefficient", d.coef ? "× " + fmt(d.coef, 2) : "–")}</div>
          ${!d.complete && d.known ? `<p class="mg-fwarn">${ico("alert")}Estimation : ${mgPl(d.missing, "ingrédient")} sans prix ou non ${d.missing > 1 ? "liés" : "lié"} au stock.</p>` : ""}
          ${!d.known ? `<p class="mg-fwarn">${ico("alert")}Aucun ingrédient n'a encore de prix. Liez-les au stock ou scannez une facture.</p>` : ""}
          <div class="mg-vat"><span>TVA</span>${[5.5, 10, 20].map((v) => `<button class="chip sm ${d.vat === v ? "on" : ""}" data-act="mgVat" data-id="${esc(n.id)}" data-v="${v}">${fmt(v, v % 1 ? 1 : 0)} %</button>`).join("")}<span class="mg-vsep"></span><span>Objectif</span><button class="chip sm" data-act="mgTargetSheet" data-id="${esc(n.id)}">${mgPct(d.target)}</button></div>
        </div>
        ${d.known ? mgSimHTML(d, M) : ""}
        ${series.length > 2 && s0 != null ? `<div class="glass pad mg-hist st" style="--i:5"><div class="mg-sech"><span class="lbl">Coût par portion · 12 semaines</span>${dCost != null && Math.abs(dCost) >= 0.5 ? `<span class="mg-ich ${dCost > 0 ? "up" : "dn"} mono">${dCost > 0 ? "+" : "−"}${fmt(Math.abs(dCost), 1)} %</span>` : `<span class="sub">stable</span>`}</div>${mgLineChart(series)}</div>` : ""}
      </div><div>
        <div class="glass pad mg-ings st" style="--i:3"><div class="mg-sech"><span class="lbl">Ce qui coûte, par portion</span><span class="sub mono">${d.known ? mgEur(d.cost) : ""}</span></div>${mgStack(d)}
          <div class="mg-ilist">${d.lines.length ? mgIngRows(d) : `<p class="note">Pas encore d'ingrédients. <button class="btn ghost sm" data-act="noteEdit" data-id="${esc(n.id)}">Les ajouter</button></p>`}</div></div>
        ${me ? `<div class="glass pad mg-qcard ${me.quad} st" style="--i:${8 + d.lines.length}"><span class="lbl">Sur votre carte</span><b>${MG_QUAD[me.quad][0]}</b><p class="note">${MG_QUAD[me.quad][1]}</p></div>` : ""}
        <button class="glass mg-link st" style="--i:${9 + d.lines.length}" data-go="fiche" data-id="${esc(n.id)}"><span class="mg-tic">${ico("book")}</span><span class="tx"><b>Recette, étapes et allergènes</b><em>La fiche cuisine du plat</em></span>${ico("chev")}</button>
      </div></div>
    </div>`;
  },
  after(v) { mgSimBind(v); },
};
function mgSimBind(v) {
  const r = $("#mgSimR", v), i = $("#mgSimIn", v); if (!r || !i) return; const id = S.params.id;
  const paint = (p, from) => {
    const n = S.notes.find((x) => x.id === id); if (!n) return; const d = mgDish(n); d.sold = mgSalesMap(30)[n.id] || 0; S.ui.mgSim = { id, p };
    const ht = p / (1 + d.vat / 100), m = ht - d.cost, fc = ht ? (d.cost / ht) * 100 : null;
    const F = $("#mgSimFc"); F.textContent = mgPct(fc); F.className = `mono ${mgFcTone(fc, d.target)}`; $("#mgSimM").textContent = mgEur(m); $("#mgSimN").textContent = mgSimNote(d, p);
    if (from !== "r") { r.value = p; } r.style.setProperty("--k", (((p - r.min) / (r.max - r.min || 1)) * 100).toFixed(1) + "%"); if (from !== "i") i.value = fmt(p, 2);
    const sv = $("#mgSimSave"); if (sv) sv.disabled = !(p > 0) || (d.ttc && Math.abs(p - d.ttc) < 0.001);
  };
  let lastTick = 0;
  r.addEventListener("input", () => { const p = +r.value; paint(p, "r"); const now = Date.now(); if (now - lastTick > 60) { lastTick = now; SFX.tick(); buzz(3); } });
  i.addEventListener("input", () => { const p = mgInputNum(i.value); if (p != null && p > 0 && p < 10000) paint(p, "i"); });
  i.addEventListener("focus", () => setTimeout(() => i.select(), 0)); i.addEventListener("keydown", (e) => { if (e.key === "Enter") i.blur(); });
}

/* fiche technique imprimable (« Enregistrer en PDF ») */
function mgPrintHTML(n) {
  const d = mgDish(n); const al = typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || []; const alT = al.map((a) => (typeof allergenOf === "function" ? allergenOf(a)?.t || a : a));
  const steps = typeof noteSteps === "function" ? noteSteps(n) : n.steps || [];
  return `<div class="mgp"><header><div><span>${esc(S.resto?.name || "")}</span><h1>${esc(n.title)}</h1><em>Fiche technique · ${mgPl(d.por, "portion")} · ${esc(mgDayTx(MG_TODAY()))}</em></div>
    <div class="mgp-k"><div><em>Coût portion</em><b>${mgEur(d.cost)}</b></div><div><em>Prix TTC</em><b>${d.ttc ? mgEur(d.ttc) : "–"}</b></div><div><em>Marge HT</em><b>${d.margin != null ? mgEur(d.margin) : "–"}</b></div><div><em>Food cost</em><b>${mgPct(d.fc, 1)}</b></div><div><em>Coef.</em><b>${d.coef ? fmt(d.coef, 2) : "–"}</b></div></div></header>
    <table><thead><tr><th>Ingrédient</th><th class="r">Quantité</th><th class="r">Prix unitaire HT</th><th class="r">Coût fournée</th><th class="r">Coût portion</th></tr></thead><tbody>
    ${d.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="r">${esc(String(l.qty || ""))} ${esc(l.unit)}</td><td class="r">${l.pu ? `${mgEur(l.pu)} / ${esc(l.pUnit)}` : l.kind === "n" ? "sous-recette" : "–"}</td><td class="r">${l.cost != null ? mgEur(l.cost) : "–"}</td><td class="r">${l.cost != null ? mgEur(l.cost / d.por) : "–"}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="3">Total (TVA ${fmt(d.vat, d.vat % 1 ? 1 : 0)} %)</td><td class="r">${mgEur(d.batch)}</td><td class="r">${mgEur(d.cost)}</td></tr></tfoot></table>
    ${alT.length ? `<p class="mgp-al"><b>Allergènes :</b> ${esc(alT.join(", "))}</p>` : ""}
    ${steps.length ? `<h2>Progression</h2><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    <footer>Prix d'achat au ${esc(mgDayTx(MG_TODAY()))}, mis à jour à chaque facture. Établi avec Growth Gusto.</footer></div>`;
}
function mgPrint(html, title) {
  let root = $("#mgPrint"); if (!root) { root = document.createElement("div"); root.id = "mgPrint"; document.body.appendChild(root); }
  root.innerHTML = html; const t = document.title; document.title = String(title).replace(/[\/\\:]/g, "-"); document.documentElement.classList.add("mg-printing");
  SFX.print ? SFX.print() : SFX.tap(); buzz(8);
  setTimeout(() => { try { window.print(); } catch (e) { toast("Impression impossible sur cet appareil.", "err"); } document.title = t; }, 80);
}
window.addEventListener("afterprint", () => { if (!document.documentElement.classList.contains("mg-printing")) return; setTimeout(() => { document.documentElement.classList.remove("mg-printing"); const r = $("#mgPrint"); if (r) r.innerHTML = ""; }, 300); });

/* the cost card of the recipe screen (notes.js) gets the margin and a way into the full sheet */
function noteCostHTML(n) {
  const d = mgDish(n); if (!d.known) return "";
  const tone = mgFcTone(d.fc, d.target);
  return `<button class="glass pad st nt-cost mg-ncost" style="--i:6" data-go="margeFiche" data-id="${esc(n.id)}"><span class="lbl">${ico("euro")}Coût et marge</span>
    <div class="nt-costrow"><div><b class="mono">${mgEur(d.cost)}</b><em>par portion</em></div>${d.ttc ? `<div><b class="mono">${mgEur(d.margin)}</b><em>de marge HT</em></div><div class="${tone === "ok" ? "ok" : "warn"}"><b class="mono">${mgPct(d.fc)}</b><em>food cost</em></div>` : `<div><b class="mono">${mgEur(d.batch)}</b><em>la fournée</em></div>`}</div>
    <span class="mg-ncgo">${d.missing ? `Estimation, ${mgPl(d.missing, "ingrédient")} sans prix · ` : ""}Voir la fiche technique chiffrée ${ico("chev")}</span></button>`;
}

/* ───────────────────────── VIEW: factures ───────────────────────── */
const mgInvSorted = () => (S.invoices || []).slice().sort((a, b) => (b.day || "").localeCompare(a.day || "") || (b.at || 0) - (a.at || 0));
const mgSupWell = (s) => { const P = ["w-vi", "w-sa", "w-sk", "w-to", "w-mi"]; let h = 0; for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return P[h % P.length]; };
const mgInitials = (s) => String(s || "?").replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
function mgInvRow(f, i) {
  const ups = (S.prices || []).filter((h) => h.invoiceId === f.id && num(h.pct) >= 2).length; const n = (f.lines || []).length;
  return `<button class="mg-inv st" style="--i:${i}" data-go="facture" data-id="${esc(f.id)}"><span class="mg-sup ${mgSupWell(f.supplier)}">${esc(mgInitials(f.supplier))}</span>
    <span class="tx"><b>${esc(f.supplier || "Fournisseur")}</b><em>${esc(mgDayTx(f.day))}${f.number ? ` · n° ${esc(f.number)}` : ""} · ${mgPl(n, "ligne")}</em></span>
    ${ups ? `<span class="mg-upb">${ico("mgUp")}${ups}</span>` : ""}<span class="mono mg-invt">${num(f.totalHT) ? mgEur(f.totalHT) : ""}</span>${ico("chev")}</button>`;
}
VIEWS.factures = {
  render() {
    const F = mgInvSorted(); const A = mgPriceAlerts(30, 2); let k = 3;
    const byM = {}; F.forEach((f) => (byM[(f.day || "").slice(0, 7)] ||= []).push(f));
    const monthTot = (L) => L.reduce((s, f) => s + (num(f.totalHT) || 0), 0);
    const priced = S.products.filter((p) => num(p.price) > 0).length;
    return `<div class="inner wide mg mg-fac">${topBar("Factures", { right: `<button class="btn soft sm" data-go="marges">${ico("mgCoin")}<span class="mg-hide-s">Marges</span></button>` })}
      <div class="mg-fcols"><div>
        <div class="wall mg-scanhero st" style="--i:1"><div class="mg-shic">${ico("mgScanDoc")}</div><div class="mg-shtx"><b>Scannez une facture</b><span>Les prix d'achat se mettent à jour et la marge de chaque plat se recalcule. Lu sur votre téléphone, rien n'est envoyé.</span></div>
          <div class="mg-shbtns"><button class="mg-shb main" data-act="mgScan" data-v="camera">${ico("camera")}Photographier</button><button class="mg-shb" data-act="mgScan" data-v="file">${ico("upload")}Importer</button></div></div>
        ${A.length ? `<div class="glass pad mg-moves st" style="--i:${k++}"><div class="mg-sech"><span class="lbl">Prix qui ont bougé · 30 jours</span></div>${A.slice(0, 8).map((a, i) => `<button class="mg-mv" data-act="mgPriceSheet" data-id="${esc(a.p.id)}"><span class="mg-mvic ${a.pct > 0 ? "up" : "dn"}">${ico(a.pct > 0 ? "mgUp" : "mgDown")}</span><span class="tx"><b>${esc(a.p.name)}</b><em>${esc(a.h.supplier || a.p.supplier || "")}${a.dishes.length ? ` · ${mgPl(a.dishes.length, "plat")}` : ""}</em></span><span class="mg-mvr"><b class="mono ${a.pct > 0 ? "up" : "dn"}">${a.pct > 0 ? "+" : "−"}${fmt(Math.abs(a.pct), Math.abs(a.pct) < 10 ? 1 : 0)} %</b><em class="mono">${mgEur(a.h.price)}/${esc(a.p.unit)}</em></span></button>`).join("")}</div>` : ""}
      </div><div>
        ${F.length ? Object.entries(byM).map(([m, L]) => `<div class="mg-sech st" style="--i:${k++}"><span class="lbl">${esc(mgMonthTx(m))}</span><span class="sub mono">${mgEur0(monthTot(L))} HT</span></div><div class="glass mg-invs st" style="--i:${k++}">${L.map((f, i) => mgInvRow(f, k + i)).join("")}</div>`).join("")
          : `<div class="glass empty mg-empty st" style="--i:${k++}"><div class="ic">${ico("mgInvoice")}</div><b>Aucune facture pour l'instant</b>${priced ? `${mgPl(priced, "produit")} du stock ${priced > 1 ? "ont" : "a"} déjà un prix. ` : ""}Chaque facture scannée tient vos prix à jour, sans rien taper.</div>`}
      </div></div></div>`;
  },
};
VIEWS.facture = {
  nav: "factures",
  render({ id }) {
    const f = (S.invoices || []).find((x) => x.id === id);
    if (!f) return `<div class="inner narrow mg">${topBar("Facture")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("mgInvoice")}</div><b>Facture introuvable</b>Elle a peut-être été supprimée.</div></div>`;
    const P = (S.prices || []).filter((h) => h.invoiceId === f.id); const ph = f.photoId ? photoUrl(f.photoId) : "";
    const sum = (f.lines || []).reduce((s, l) => s + (num(l.total) || 0), 0);
    return `<div class="inner wide mg mg-fdet">${topBar("", { right: `<button class="iconbtn" data-act="mgInvDel" data-id="${esc(f.id)}" aria-label="Supprimer la facture">${ico("trash")}</button>` })}
      <div class="mg-fhead st" style="--i:1"><span class="mg-fk"><span class="mg-sup sm ${mgSupWell(f.supplier)}">${esc(mgInitials(f.supplier))}</span>Facture${f.number ? ` n° ${esc(f.number)}` : ""}</span><h1 class="mg-ftitle">${esc(f.supplier || "Fournisseur")}</h1><span class="sub">${esc(mgDayTx(f.day))} · scannée par ${esc(firstName(nameOf(f.by)))}${f.src === "pdf" ? " · PDF" : ""}</span></div>
      <div class="mg-fcols"><div>
        <div class="glass pad mg-ftot st" style="--i:2"><div><em>Total HT</em><b class="mono">${num(f.totalHT) ? mgEur(f.totalHT) : mgEur(sum)}</b></div>${num(f.totalTTC) ? `<div><em>Total TTC</em><b class="mono">${mgEur(f.totalTTC)}</b></div>` : ""}<div><em>Prix mis à jour</em><b class="mono">${P.length}</b></div></div>
        <div class="glass mg-flines st" style="--i:3">${(f.lines || []).map((l) => { const h = P.find((x) => x.productId === l.productId); const p = l.productId && mgProd(l.productId); return `<div class="mg-fl"><span class="tx"><b>${esc(l.name)}</b><em>${l.qty != null ? `${fmt(l.qty, l.qty % 1 ? 2 : 0)} ${esc(l.unit || "")} × ` : ""}${mgEur(l.price)}${p ? ` · ${ico("mgLink")}${esc(p.name)}` : ""}</em></span>${h && Math.abs(num(h.pct) || 0) >= 0.5 ? `<span class="mg-ich ${h.pct > 0 ? "up" : "dn"} mono">${h.pct > 0 ? "+" : "−"}${fmt(Math.abs(h.pct), Math.abs(h.pct) < 10 ? 1 : 0)} %</span>` : ""}<b class="mono">${mgEur(l.total)}</b></div>`; }).join("")}</div>
      </div><div>${ph ? `<button class="glass mg-fphoto st" style="--i:4" data-act="mgPhotoOpen" data-v="${esc(f.photoId)}"><img src="${esc(ph)}" alt="Facture ${esc(f.supplier || "")}"></button>` : ""}</div></div></div>`;
  },
};

/* price history of one product (sheet) */
function mgPriceSheetHTML(pid) {
  const p = mgProd(pid); if (!p) return ""; const H = mgHist(pid); const U = mgUsers(pid); const sales = mgSalesMap(30);
  const first = H.length ? addDays(H[0].day, -Math.max(7, Math.round((parseDay(MG_TODAY()) - parseDay(H[0].day)) / 864e5 / 5))) : "";
  const pts = H.length ? [{ d: first, v: num(H[0].prev) > 0 ? num(H[0].prev) : num(H[0].price) }].concat(H.map((h) => ({ d: h.day, v: num(h.price) }))) : [];
  if (pts.length) pts.push({ d: MG_TODAY(), v: num(p.price) > 0 ? num(p.price) : pts[pts.length - 1].v });
  return `<div class="mg-psh"><div class="mg-pshh"><span class="mg-sup ${mgSupWell(p.supplier)}">${esc(mgInitials(p.name))}</span><div><h2 class="h2">${esc(p.name)}</h2><span class="sub">${esc(p.supplier || "Fournisseur ?")} · ${num(p.price) > 0 ? `${mgEur(p.price)} HT / ${esc(p.unit)}` : "sans prix"}</span></div></div>
    ${pts.length >= 2 ? `<div class="mg-pchart">${mgLineChart(pts, { w: 520, h: 150, step: true })}</div>` : ""}
    ${H.length ? `<span class="lbl">Historique</span><div class="mg-phl">${H.slice().reverse().slice(0, 12).map((h) => `<div class="mg-phr"><span class="tx"><b>${esc(mgDayTx(h.day))}</b><em>${esc(h.supplier || "")}${h.src === "facture" ? " · facture" : h.src === "manuel" ? " · saisi" : ""}</em></span>${num(h.pct) ? `<span class="mg-ich ${h.pct > 0 ? "up" : "dn"} mono">${h.pct > 0 ? "+" : "−"}${fmt(Math.abs(h.pct), Math.abs(h.pct) < 10 ? 1 : 0)} %</span>` : ""}<b class="mono">${mgEur(h.price)}</b></div>`).join("")}</div>` : `<p class="note">Pas encore d'historique : il commence avec la prochaine facture.</p>`}
    ${U.length ? `<span class="lbl">Dans ${mgPl(U.length, "recette")}</span><div class="mg-phl">${U.map(({ n, q }) => { const c = q * (num(p.price) || 0); const d = mgDish(n); return `<button class="mg-phr tap" data-go="margeFiche" data-id="${esc(n.id)}"><span class="tx"><b>${esc(n.title)}</b><em>${fmt(q, q < 1 ? 3 : 2)} ${esc(p.unit)} par portion${sales[n.id] ? ` · ${sales[n.id]} vendus` : ""}</em></span><b class="mono">${mgEur(c)}</b><em class="mono mg-phs">${d.cost ? mgPct((c / d.cost) * 100) : ""}</em></button>`; }).join("")}</div>` : ""}
    <div class="grid2" style="margin-top:14px"><button class="btn soft" data-act="prodEdit" data-id="${esc(p.id)}">${ico("edit")}Modifier</button><button class="btn acc" data-act="sheetClose">OK</button></div></div>`;
}

/* ───────────────────────── OCR on the device (Tesseract.js) + PDF text (pdf.js) ───────────────────────── */
const MG_V = "vendor/ocr/";
function mgScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("load " + src)); document.head.appendChild(s); }); }
const MGOCR = {
  w: null, p: null, on: null,
  base() { return new URL(MG_V, location.href).href; },
  /* the core (≈4 Mo) and the French model (0,7 Mo) come from the free jsDelivr CDN, with a copy on our hosting as a fallback; cached by the browser after the first scan */
  async make(cdn) {
    const b = this.base(); const opt = { workerPath: b + "worker.min.js", workerBlobURL: false, corePath: cdn ? "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0" : b + "core", langPath: cdn ? "https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra/4.0.0_best_int" : b + "lang", logger: (m) => this.on && this.on(m) };
    let w; const t = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), cdn ? 25000 : 60000));
    w = await Promise.race([Tesseract.createWorker("fra", 1, opt), t]);
    await w.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "6" });
    return w;
  },
  async worker(on) {
    this.on = on; if (this.w) return this.w;
    if (!this.p) this.p = (async () => {
      if (!window.Tesseract) await mgScript(this.base() + "tesseract.min.js");
      const local = /^(localhost|127\.|\[::1\])/.test(location.hostname) || location.protocol === "file:";
      try { this.w = await this.make(!local); } catch (e) { if (local) throw e; console.warn("ocr cdn", e); this.w = await this.make(false); }
      return this.w;
    })().catch((e) => { this.p = null; throw e; });
    return this.p;
  },
  async read(canvas, on) {
    const w = await this.worker(on); const r = await w.recognize(canvas, {}, { text: true, blocks: true });
    const words = []; (r.data.blocks || []).forEach((b) => (b.paragraphs || []).forEach((pa) => (pa.lines || []).forEach((l) => (l.words || []).forEach((wd) => { if (wd.bbox && words.length < 600) words.push(wd.bbox); }))));
    return { text: r.data.text || "", conf: r.data.confidence || 0, words };
  },
};
/* photo → big, grey, contrasted canvas (Tesseract reads decimal commas far better at ~2400 px) */
async function mgPrepImage(file) {
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
  const k = Math.min(2.5, 2400 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
  try {
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data; let lo = 255, hi = 0; const H = new Uint32Array(256);
    for (let i = 0; i < a.length; i += 4) { const g = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0; a[i] = g; H[g]++; }
    const n = a.length / 4; let s = 0; for (let v = 0; v < 256; v++) { s += H[v]; if (s > n * 0.01) { lo = v; break; } } s = 0; for (let v = 255; v >= 0; v--) { s += H[v]; if (s > n * 0.01) { hi = v; break; } }
    const sp = Math.max(40, hi - lo); for (let i = 0; i < a.length; i += 4) { const v = Math.max(0, Math.min(255, ((a[i] - lo) * 255) / sp)); a[i] = a[i + 1] = a[i + 2] = v; }
    x.putImageData(d, 0, 0);
  } catch (e) {}
  return { canvas: c, url: img.src, w: img.width, h: img.height };
}
async function mgPdfLib() { if (!window.pdfjsLib) await mgScript(MGOCR.base() + "pdf.min.js"); pdfjsLib.GlobalWorkerOptions.workerSrc = MGOCR.base() + "pdf.worker.min.js"; return pdfjsLib; }
/* PDF: its own text when it has one (exact), else the pages are drawn and read like photos */
async function mgReadPdf(file, on) {
  const lib = await mgPdfLib(); const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise; const N = Math.min(doc.numPages, 4);
  let text = ""; let thumb = null;
  for (let p = 1; p <= N; p++) {
    const page = await doc.getPage(p); const tc = await page.getTextContent(); const rows = [];
    tc.items.forEach((it) => { const s = (it.str || "").trim(); if (!s) return; const x = it.transform[4], y = it.transform[5], w = it.width || s.length * 5; let r = rows.find((r) => Math.abs(r.y - y) < 3); if (!r) rows.push((r = { y, it: [] })); r.it.push({ x, w, s }); });
    rows.sort((a, b) => b.y - a.y).forEach((r) => { r.it.sort((a, b) => a.x - b.x); let line = "", end = null; r.it.forEach((t) => { if (end != null) line += t.x - end > 8 ? "   " : " "; line += t.s; end = t.x + t.w; }); text += line + "\n"; });
    if (p === 1) { const vp = page.getViewport({ scale: 2 }); const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; thumb = c; }
  }
  if (text.replace(/\s/g, "").length > 60) return { text, conf: 99, thumb, words: [], exact: true };
  /* a scanned PDF: OCR its first pages */
  let all = "", words = []; for (let p = 1; p <= Math.min(N, 2); p++) { const page = p === 1 ? null : await doc.getPage(p); let c = thumb; if (page) { const vp = page.getViewport({ scale: 2 }); c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; } const r = await MGOCR.read(c, on); all += r.text + "\n"; if (p === 1) words = r.words; }
  return { text: all, conf: 80, thumb, words, exact: false };
}

/* ───────────────────────── invoice text → supplier, number, date, totals, lines ───────────────────────── */
const MG_UNITS = { kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", g: "g", gr: "g", grs: "g", l: "L", lt: "L", ltr: "L", litre: "L", litres: "L", cl: "cl", ml: "ml", pce: "pièce", pces: "pièce", pc: "pièce", pcs: "pièce", piece: "pièce", pieces: "pièce", u: "pièce", un: "pièce", unite: "pièce", unites: "pièce", uvc: "pièce", ut: "pièce", col: "colis", colis: "colis", crt: "carton", carton: "carton", cartons: "carton", ct: "carton", bte: "boîte", btes: "boîte", boite: "boîte", bt: "bouteille", btl: "bouteille", bout: "bouteille", bouteille: "bouteille", bouteilles: "bouteille", bourriche: "bourriche", bourr: "bourriche", douz: "douzaine", dz: "douzaine", douzaine: "douzaine", sac: "sac", sacs: "sac", bq: "barquette", barq: "barquette", barquette: "barquette", fut: "fût", plq: "plaque", lot: "lot", pack: "pack", bid: "bidon", bidon: "bidon", seau: "seau", botte: "botte", bottes: "botte" };
const MG_SKIP = /\b(total|sous[- ]?total|t\.?v\.?a\.?\b|net a payer|a payer|acompte|escompte|remise globale|report|page|iban|bic|siret|siren|rcs|ape|naf|capital|tel|telephone|fax|e-?mail|www|facture|avoir|date|client|echeance|reglement|base ht|montant ht|montant ttc|frais de port|consigne|livraison|bon de|commande n|code client|conditions|penalite|indemnite|merci)\b/;
function mgTok(t) { const s = t.replace(/[€*]/g, "").replace(/^[(]|[)]$/g, ""); if (!/^\d+(?:[.,]\d{1,4})?$/.test(s)) return null; return { v: parseFloat(s.replace(",", ".")), dec: /[.,]/.test(s) }; }
/* a number read without its decimal comma may be v/100 or v/10: a unit price usually has 2 decimals, a quantity 0 or 1 */
const mgAlts = (n, role) => (n.dec ? [[n.v, 0]] : role === "q" ? [[n.v, 0], [n.v / 10, 0.9], [n.v / 100, 1.8]] : role === "p" ? [[n.v, 0], [n.v / 100, 0.6], [n.v / 10, 1.4]] : [[n.v, 0], [n.v / 100, 0.8], [n.v / 10, 1.5]]);
function mgParseLine(line) {
  const T = line.trim().split(/\s+/); if (T.length < 3) return null;
  const tail = []; let j = T.length - 1;
  for (; j >= 0; j--) { const t = T[j]; const u = MG_UNITS[mgNorm(t).replace(/\s/g, "")]; const n = mgTok(t); if (n) tail.unshift({ n }); else if (u) tail.unshift({ u }); else if (/^(€|%|eur|ht|x)$/i.test(t)) continue; else break; }
  const name = T.slice(0, j + 1).join(" ").replace(/^[A-Z]{0,3}\d{4,}[A-Z0-9]*\s+/, "").replace(/^\d{3,}\s+/, "").replace(/\s{2,}/g, " ").trim();
  const nums = tail.filter((x) => x.n).map((x) => x.n); const unit = (tail.find((x) => x.u) || {}).u || "";
  if (!/[a-zA-ZÀ-ÿ]{3,}/.test(name) || nums.length < 2) return null;
  let best = null; const last = nums.length - 1;
  for (let i = 0; i < nums.length; i++) for (let k2 = i + 2; k2 < nums.length; k2++) for (let m = i + 1; m < k2; m++) {
    for (const [q, pq] of mgAlts(nums[i], "q")) for (const [p, pp] of mgAlts(nums[m], "p")) for (const [t, pt] of mgAlts(nums[k2], "t")) {
      if (!(q > 0 && p > 0 && t > 0)) continue; const err = Math.abs(q * p - t); if (err > Math.max(0.025, t * 0.012)) continue;
      const sc = pq + pp + pt * 1.5 + (k2 === last ? 0 : 0.8) + (m - i - 1) * 0.3 + (k2 - m - 1) * 0.15 + (q > 999 ? 2 : 0);
      if (!best || sc < best.sc) best = { sc, q, p, t };
    }
  }
  if (best) return { name, qty: mgR2(best.q * 1000) / 1000, unit, price: mgR2(best.p * 10000) / 10000, total: mgR2(best.t), ok: best.sc < 1.3 };
  /* qty + total only: the unit price is deduced */
  const t = nums[last], q = nums[0]; if (nums.length >= 2 && t.dec && q.v > 0 && q.v < 1000) return { name, qty: q.v, unit, price: mgR2((t.v / q.v) * 10000) / 10000, total: t.v, ok: false };
  return null;
}
function mgParseInvoice(text) {
  const lines = String(text || "").split(/\n/).map((s) => s.replace(/[|_]{1,}/g, " ").replace(/[‘’`]/g, "'").trim()).filter(Boolean);
  const N = lines.map(mgNorm); const out = { supplier: "", number: "", day: "", totalHT: null, totalTTC: null, lines: [] };
  /* supplier: a known one in the first lines, else the first line with letters */
  const known = mgKnownSuppliers(); const head = N.slice(0, 14).join(" ");
  const hit = known.map((s) => ({ s, k: mgNorm(s) })).filter((x) => x.k.length >= 3 && (` ${head} `).includes(` ${x.k} `)).sort((a, b) => b.k.length - a.k.length)[0];
  if (hit) out.supplier = hit.s;
  else { const f = lines.slice(0, 8).find((l, i) => /[A-Za-zÀ-ÿ]{3,}/.test(l) && !MG_SKIP.test(N[i]) && !/^\d/.test(l)); if (f) out.supplier = mgTitle(f.split(/\s{3,}/)[0]); }
  /* number, date */
  for (const l of lines) { const m = l.match(/fact(?:ure)?\.?\s*(?:n\s*[°ºo]\.?|num[ée]ro|no\.?|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/.]{2,})/i); if (m && /\d/.test(m[1])) { out.number = m[1].replace(/[.]$/, ""); break; } }
  const dates = []; lines.forEach((l, i) => { const re = /\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})\b/g; let m; while ((m = re.exec(l))) { let [, d, mo, y] = m; d = +d; mo = +mo; y = +y; if (y < 100) y += 2000; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2015 && y <= 2099) dates.push({ k: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, w: /date|factur|du\b|le\b/.test(N[i]) ? 0 : 1, i }); } });
  dates.sort((a, b) => a.w - b.w || a.i - b.i); out.day = dates[0] ? dates[0].k : "";
  /* totals */
  const lastNum = (l) => { const m = l.match(/(\d{1,3}(?:[ . ]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?!.*\d[.,]\d{2})/); return m ? parseFloat(m[1].replace(/[ . ](?=\d{3}\b)/g, "").replace(",", ".")) : null; };
  lines.forEach((l, i) => { const n = N[i]; if (/total\s*h\s*t|total hors tax|montant\s*h\s*t|net\s*h\s*t|base\s*h\s*t|total ht/.test(n) && out.totalHT == null) out.totalHT = lastNum(l); if (/total\s*t\s*t\s*c|net a payer|montant\s*t\s*t\s*c|total a payer|total ttc/.test(n)) { const v = lastNum(l); if (v != null) out.totalTTC = v; } });
  /* lines */
  lines.forEach((l, i) => { if (MG_SKIP.test(N[i])) return; const r = mgParseLine(l); if (r) out.lines.push(r); });
  return out;
}
const mgTitle = (s) => String(s || "").toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()).trim();
function mgKnownSuppliers() {
  const s = new Set(); S.products.forEach((p) => p.supplier && s.add(p.supplier.trim())); (S.receptions || []).forEach((r) => r.supplier && s.add(r.supplier.trim())); (S.invoices || []).forEach((f) => f.supplier && s.add(f.supplier.trim())); (S.expenses || []).forEach((e) => e.cat === "achats" && e.supplier && s.add(e.supplier.trim()));
  return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
}

/* ───────────────────────── line ↔ stock product matching ───────────────────────── */
const MG_STOP = new Set(["de", "du", "des", "la", "le", "les", "a", "au", "aux", "et", "en", "d", "l", "pour", "avec", "sans", "x", "env", "uht", "aop", "aoc", "igp", "bio", "label", "lr", "cat", "fr", "france", "origine", "frais", "fraiche", "frais", "extra", "sup", "superieur", "superieure", "qualite", "premium", "sel", "vrac", "sachet", "kg", "g", "l", "cl", "ml", "pce", "pc", "piece", "colis", "carton", "boite", "bte", "mg", "pot", "seau", "pack"]);
const mgKeyToks = (s) => mgNorm(s).split(" ").filter((t) => t.length >= 2 && !MG_STOP.has(t) && !/\d/.test(t)).map((t) => (t.length > 4 ? t.replace(/(s|x)$/, "") : t));
function mgMatch(name, supplier) {
  const key = mgNorm(name); const A = mgKeyToks(name); if (!A.length) return null; let best = null;
  for (const p of S.products) {
    if ((p.aliases || []).includes(key)) return { p, s: 10 };
    const B = mgKeyToks(p.name); if (!B.length) continue; let hit = 0, long = 0;
    B.forEach((b) => { const ok = A.some((a) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))); if (ok) { hit += b.length; if (b.length >= 4) long++; } });
    if (!long) continue; const tot = B.reduce((s, b) => s + b.length, 0); let s = hit / tot; s += (A.length && hit / A.reduce((x, a) => x + a.length, 0)) * 0.25; if (supplier && p.supplier && mgNorm(p.supplier) === mgNorm(supplier)) s += 0.15;
    if (s >= 0.55 && (!best || s > best.s)) best = { p, s };
  }
  return best;
}
/* how many stock units one invoice unit holds (kg → kg: 1, g → kg: 0,001, colis → kg: what the product remembers) */
function mgPer(lineUnit, p) {
  if (!p) return 1; const lu = lineUnit || p.unit; const packs = p.packs || {};
  if (packs[mgNorm(lu)]) return num(packs[mgNorm(lu)]);
  const c = mgConv(1, lu, p.unit); if (c != null) return c;
  return null;
}

/* ───────────────────────── VIEW: factureScan (photo/PDF → lecture → vérification → fait) ───────────────────────── */
const mgSc = () => S.ui.mgScan;
VIEWS.factureScan = {
  nav: "factures", live: false,
  render() {
    const X = mgSc();
    if (!X) return `<div class="inner narrow mg mg-scan">${topBar("Scanner une facture")}<div class="wall mg-scanhero st" style="--i:1"><div class="mg-shic">${ico("mgScanDoc")}</div><div class="mg-shtx"><b>Une facture, une photo</b><span>Posez-la à plat, bien éclairée, et cadrez toute la page.</span></div>
      <div class="mg-shbtns"><button class="mg-shb main" data-act="mgScan" data-v="camera">${ico("camera")}Photographier</button><button class="mg-shb" data-act="mgScan" data-v="file">${ico("upload")}Importer</button></div></div>
      <button class="glass mg-link st" style="--i:2" data-act="mgManual"><span class="mg-tic">${ico("edit")}</span><span class="tx"><b>Saisir à la main</b><em>Sans photo, ligne par ligne</em></span>${ico("chev")}</button></div>`;
    return `<div class="inner ${X.phase === "review" ? "wide" : "narrow"} mg mg-scan">${topBar(X.phase === "done" ? "Facture enregistrée" : X.phase === "review" ? "Vérifiez la facture" : "Lecture de la facture", X.phase === "read" ? { right: "" } : {})}<div id="mgScan">${mgScanBody()}</div></div>`;
  },
  after(v) { mgReviewBind(v); },
};
function mgScanBody() {
  const X = mgSc(); if (!X) return "";
  if (X.phase === "read") return mgReadHTML(X);
  if (X.phase === "done") return mgDoneHTML(X);
  return mgReviewHTML(X);
}
function mgScanPaint() { const b = $("#mgScan"); if (!b) return; b.innerHTML = photoFix(mgScanBody()); mgReviewBind(b.closest(".view") || document); }
function mgReadHTML(X) {
  const pct = Math.round((X.prog || 0) * 100);
  const words = (X.words || []).map((w, i) => `<i style="left:${((w.x0 / X.W) * 100).toFixed(2)}%;top:${((w.y0 / X.H) * 100).toFixed(2)}%;width:${(((w.x1 - w.x0) / X.W) * 100).toFixed(2)}%;height:${(((w.y1 - w.y0) / X.H) * 100).toFixed(2)}%;--d:${Math.min(1.6, i * 0.004).toFixed(3)}s"></i>`).join("");
  return `<div class="mg-read st" style="--i:1"><div class="mg-paper ${X.words ? "found" : ""}">${X.img ? `<img src="${esc(X.img)}" alt="Facture">` : ""}<span class="mg-beam"></span><div class="mg-words">${words}</div></div>
    <div class="mg-rstat"><span class="mg-rdot"></span><b id="mgRTx">${esc(X.status || "Préparation…")}</b><span class="mono" id="mgRPct">${X.words ? "" : pct ? pct + " %" : ""}</span></div>
    <div class="mg-rbar"><i id="mgRBar" style="width:${pct}%"></i></div>
    <p class="note mg-rnote">Lu sur cet appareil : la facture ne quitte pas votre téléphone.</p></div>`;
}
function mgReadProgress(m) {
  const X = mgSc(); if (!X || X.phase !== "read") return;
  const st = { "loading tesseract core": "Chargement du lecteur…", "initializing tesseract": "Chargement du lecteur…", "loading language traineddata": "Chargement du français…", "initializing api": "Chargement du lecteur…", "recognizing text": "Lecture des lignes…" }[m.status];
  if (st) X.status = st; if (m.status === "recognizing text") X.prog = m.progress || 0;
  const t = $("#mgRTx"), p = $("#mgRPct"), b = $("#mgRBar"); if (t) t.textContent = X.status; if (p) p.textContent = m.status === "recognizing text" ? Math.round(X.prog * 100) + " %" : ""; if (b) b.style.width = (m.status === "recognizing text" ? Math.round(X.prog * 100) : 4) + "%";
}
/* entry: pick a file or take a photo, read it, then review */
async function mgStartScan(mode) {
  let f;
  if (mode === "camera") { [f] = await pickImage(); }
  else f = await new Promise((res) => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*,application/pdf,.pdf"; inp.hidden = true; document.body.appendChild(inp); inp.addEventListener("change", () => { res(inp.files && inp.files[0]); inp.remove(); }); inp.addEventListener("cancel", () => { res(null); inp.remove(); }); inp.click(); });
  if (!f) return; await mgReadFile(f);
}
async function mgReadFile(f) {
  const pdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name || "");
  S.ui.mgScan = { phase: "read", status: pdf ? "Ouverture du PDF…" : "Préparation de la photo…", prog: 0, img: pdf ? "" : URL.createObjectURL(f), src: pdf ? "pdf" : "photo", file: f };
  if (S.route !== "factureScan") go("factureScan"); else rerender(); SFX.scan(); buzz(8);
  const X = S.ui.mgScan; const t0 = Date.now();
  try {
    let r;
    if (pdf) { r = await mgReadPdf(f, mgReadProgress); if (r.thumb) { X.thumbBlob = await new Promise((res) => r.thumb.toBlob(res, "image/jpeg", 0.8)); X.img = URL.createObjectURL(X.thumbBlob); X.W = r.thumb.width; X.H = r.thumb.height; } }
    else { const P = await mgPrepImage(f); X.W = P.canvas.width; X.H = P.canvas.height; mgScanPaint(); r = await MGOCR.read(P.canvas, mgReadProgress); }
    if (mgSc() !== X) return; /* cancelled */
    X.text = r.text; X.exact = !!r.exact;
    const inv = mgParseInvoice(r.text); X.inv = mgPrepInv(inv);
    if (r.words && r.words.length && X.W && !mgReduce()) { X.words = r.words; X.status = `${mgPl(X.inv.lines.length, "ligne trouvée", "lignes trouvées")}`; mgScanPaint(); SFX.ok(); buzz([6, 30, 6]); await new Promise((res) => setTimeout(res, Math.max(900, 1700 - (Date.now() - t0) / 10))); }
    if (mgSc() !== X) return;
    X.phase = "review"; S.ui.mgScan = X; rerender(); if (!X.inv.lines.length) toast("Aucune ligne reconnue : ajoutez-les à la main.", "info");
  } catch (e) {
    console.warn("mg scan", e); if (mgSc() !== X) return;
    X.phase = "review"; X.inv = mgPrepInv({ supplier: "", number: "", day: MG_TODAY(), lines: [] }); X.fail = true; rerender(); SFX.err(); toast(navigator.onLine === false ? "Le lecteur se charge à la première utilisation : connectez-vous une fois." : "Lecture impossible : saisissez la facture à la main.", "err");
  }
}
/* parsed invoice → editable state, each line matched to a product */
function mgPrepInv(inv) {
  const sup = inv.supplier || "";
  const lines = (inv.lines || []).map((l) => { const m = mgMatch(l.name, sup); const p = m && m.p; return { name: l.name, qty: l.qty, unit: l.unit || (p ? p.unit : ""), price: l.price, total: l.total, ok: l.ok !== false, on: true, productId: p ? p.id : "", auto: !!p, score: m ? m.s : 0, per: p ? mgPer(l.unit || p.unit, p) : null }; });
  return { supplier: sup, number: inv.number || "", day: inv.day || MG_TODAY(), totalHT: inv.totalHT, totalTTC: inv.totalTTC, lines, expense: true };
}
/* new price per stock unit and its change, for one line */
function mgLineCalc(l) {
  const p = l.productId && mgProd(l.productId); const pr = mgInputNum(l.price); const per = num(l.per) > 0 ? num(l.per) : p ? mgPer(l.unit, p) : null;
  const unitPrice = p && pr > 0 && per > 0 ? pr / per : null; const prev = p && num(p.price) > 0 ? num(p.price) : null; const pct = unitPrice && prev ? ((unitPrice - prev) / prev) * 100 : null;
  return { p, unitPrice, prev, pct, needPer: !!(p && !(per > 0)), per };
}
function mgReviewHTML(X) {
  const I = X.inv; const sum = I.lines.filter((l) => l.on).reduce((s, l) => s + (mgInputNum(l.total) || 0), 0); const tot = mgInputNum(I.totalHT);
  const diff = tot != null ? mgR2(sum - tot) : null; const nP = I.lines.filter((l) => l.on && mgLineCalc(l).unitPrice).length; const ups = I.lines.filter((l) => l.on && (mgLineCalc(l).pct || 0) >= 2).length;
  const sups = mgKnownSuppliers();
  return `<div class="mg-rev">
    <div class="mg-rcols"><div>
      <div class="glass pad mg-rhead st" style="--i:2">
        <label class="field"><span>Fournisseur</span><input class="input" id="mgSup" list="mgSups" value="${esc(I.supplier)}" placeholder="Metro, Boucherie Durand…" autocomplete="off" data-mgh="supplier"><datalist id="mgSups">${sups.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
        <div class="grid2"><label class="field"><span>N° de facture</span><input class="input mono" value="${esc(I.number)}" placeholder="Facultatif" data-mgh="number" autocomplete="off"></label><label class="field"><span>Date</span><input class="input" type="date" value="${esc(I.day)}" data-mgh="day"></label></div>
        <div class="grid2"><label class="field"><span>Total HT</span><input class="input mono" inputmode="decimal" value="${tot != null ? fmt(tot, 2) : ""}" placeholder="0,00" data-mgh="totalHT" autocomplete="off"></label><label class="field"><span>Total TTC</span><input class="input mono" inputmode="decimal" value="${mgInputNum(I.totalTTC) != null ? fmt(mgInputNum(I.totalTTC), 2) : ""}" placeholder="0,00" data-mgh="totalTTC" autocomplete="off"></label></div>
        <div class="mg-rsum" id="mgRSum">${mgSumHTML(sum, tot, diff)}</div>
      </div>
      ${X.img ? `<button class="glass mg-rthumb st" style="--i:1" data-act="mgThumb"><img src="${esc(X.img)}" alt="Facture"><span>${X.exact ? "PDF lu à l'identique" : X.fail ? "Photo gardée en preuve" : "Lue sur l'appareil"}</span></button>` : ""}
    </div><div>
      <div class="mg-sech st" style="--i:3"><span class="lbl">${mgPl(I.lines.length, "ligne")}</span><button class="btn ghost sm" data-act="mgLineAdd">${ico("plus")}Ajouter</button></div>
      <div class="mg-rlines" id="mgRLines">${I.lines.map((l, i) => mgLineHTML(l, i)).join("") || `<div class="glass empty st" style="--i:4">Aucune ligne. Ajoutez les produits de la facture.</div>`}</div>
      <label class="mg-exp st" style="--i:${5 + I.lines.length}"><input type="checkbox" ${I.expense ? "checked" : ""} data-mgh="expense"><span class="mg-sw"></span><span class="tx"><b>Ajouter aux achats du mois</b><em>Pour vos finances et votre food cost global</em></span></label>
    </div></div>
    <div class="ctabar mg-rcta"><button class="btn acc block" data-act="mgScanSave" ${I.lines.some((l) => l.on) || tot ? "" : "disabled"}>${mgSaveLbl(nP, ups)}</button></div>
  </div>`;
}
const mgSaveLbl = (nP, ups) => `${ico("check")}${nP ? `Valider ${nP > 1 ? "les " + nP + " prix" : "le prix"}` : "Enregistrer la facture"}${ups ? `<span class="mg-cb">${ups} ${ico("mgUp")}</span>` : ""}`;
function mgSumHTML(sum, tot, diff) {
  if (!sum && tot == null) return "";
  if (tot == null) return `<span>Somme des lignes</span><b class="mono">${mgEur(sum)}</b>`;
  if (Math.abs(diff) < 0.05) return `<span class="ok">${ico("check")}Les lignes font bien ${mgEur(tot)}</span>`;
  return `<span class="warn">${ico("alert")}Lignes ${mgEur(sum)}, total ${mgEur(tot)} : écart de ${mgEur(Math.abs(diff))}</span>`;
}
function mgLineHTML(l, i) {
  const c = mgLineCalc(l); const p = c.p;
  const chg = c.pct != null && Math.abs(c.pct) >= 0.5 ? `<span class="mg-ich ${c.pct > 0 ? "up" : "dn"} mono">${c.pct > 0 ? "+" : "−"}${fmt(Math.abs(c.pct), Math.abs(c.pct) < 10 ? 1 : 0)} %</span>` : c.unitPrice && !c.prev ? `<span class="mg-ich new">Nouveau prix</span>` : c.unitPrice ? `<span class="mg-ich same">Même prix</span>` : "";
  return `<div class="glass mg-rl ${l.on ? "" : "off"} ${l.ok ? "" : "chk"} st" style="--i:${4 + i}" data-i="${i}">
    <div class="mg-rlh"><button class="mg-tick ${l.on ? "on" : ""}" data-act="mgLineOn" data-v="${i}" aria-pressed="${l.on}" aria-label="${l.on ? "Ignorer" : "Garder"} cette ligne">${ico("check")}</button>
      <input class="mg-rln" value="${esc(l.name)}" data-mgl="${i}:name" aria-label="Désignation" autocomplete="off"><b class="mono mg-rlt" data-mgt="${i}">${mgInputNum(l.total) != null ? mgEur(mgInputNum(l.total)) : ""}</b></div>
    <div class="mg-rlp"><button class="mg-pchip ${p ? (l.auto ? "auto" : "on") : "none"}" data-act="mgLinePick" data-v="${i}">${p ? `${ico("mgLink")}${esc(p.name)}` : `${ico("plus")}Lier à un produit du stock`}</button>${chg}</div>
    <div class="mg-rlq"><input class="input mono" inputmode="decimal" value="${l.qty != null ? fmt(l.qty, l.qty % 1 ? (String(l.qty).split(".")[1] || "").length > 2 ? 3 : 2 : 0) : ""}" data-mgl="${i}:qty" aria-label="Quantité" placeholder="Qté" autocomplete="off">
      <select class="input" data-mgl="${i}:unit" aria-label="Unité">${mgUnitOpts(l.unit, p)}</select><span class="mg-x">×</span>
      <label class="mg-pu"><input class="input mono" inputmode="decimal" value="${mgInputNum(l.price) != null ? fmt(mgInputNum(l.price), mgInputNum(l.price) < 1 ? 3 : 2) : ""}" data-mgl="${i}:price" aria-label="Prix unitaire HT" placeholder="0,00" autocomplete="off"><span>€</span></label></div>
    ${p && (c.needPer || (l.unit && mgConv(1, l.unit, p.unit) == null)) ? `<label class="mg-per"><span>1 ${esc(l.unit || "unité")} =</span><input class="input mono" inputmode="decimal" value="${num(l.per) > 0 ? fmt(num(l.per), num(l.per) % 1 ? 2 : 0) : ""}" data-mgl="${i}:per" placeholder="?" autocomplete="off"><span>${esc(p.unit)}</span>${c.unitPrice ? `<em class="mono">soit ${mgEur(c.unitPrice)}/${esc(p.unit)}</em>` : ""}</label>` : p && c.unitPrice && l.unit && l.unit !== p.unit ? `<p class="mg-perp mono">soit ${mgEur(c.unitPrice)} / ${esc(p.unit)}</p>` : ""}
  </div>`;
}
function mgUnitOpts(u, p) { const U = [...new Set([u, p && p.unit, "kg", "g", "L", "cl", "pièce", "colis", "carton", "boîte", "bouteille", "bourriche", "douzaine", "barquette", "sac", "botte", "lot"].filter(Boolean))]; return U.map((x) => `<option ${x === u ? "selected" : ""}>${esc(x)}</option>`).join(""); }
function mgReviewBind(v) {
  const X = mgSc(); if (!X || X.phase !== "review" || !v) return; const I = X.inv;
  $$("[data-mgh]", v).forEach((el) => el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
    const k = el.dataset.mgh; I[k] = el.type === "checkbox" ? el.checked : el.value; if (el.type === "checkbox") { SFX.tick(); buzz(4); }
    if (k === "supplier") { /* a supplier typed late can improve the matches of unlinked lines */ I.lines.forEach((l) => { if (!l.productId) { const m = mgMatch(l.name, I.supplier); if (m) { l.productId = m.p.id; l.auto = true; l.per = mgPer(l.unit || m.p.unit, m.p); } } }); }
    mgSumPaint();
  }));
  $$("[data-mgl]", v).forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
    const [i, k] = el.dataset.mgl.split(":"); const l = I.lines[+i]; if (!l) return; l[k] = el.value;
    if (k === "qty" || k === "price") { const q = mgInputNum(l.qty), p = mgInputNum(l.price); if (q != null && p != null) { l.total = mgR2(q * p); const t = $(`[data-mgt="${i}"]`); if (t) t.textContent = mgEur(l.total); } }
    if (k === "unit") { const p = l.productId && mgProd(l.productId); l.per = p ? mgPer(l.unit, p) : null; mgLinePaint(+i); }
    if (k === "per" || k === "price") mgLineMeta(+i);
    mgSumPaint();
  }));
}
function mgLineMeta(i) { /* refresh the change chip + « soit » without losing focus */ const X = mgSc(); const l = X.inv.lines[i]; const row = $(`.mg-rl[data-i="${i}"]`); if (!row) return; const tmp = document.createElement("div"); tmp.innerHTML = mgLineHTML(l, i); const n = tmp.firstElementChild; const a = $(".mg-rlp", row), b = $(".mg-rlp", n); if (a && b) a.innerHTML = b.innerHTML; const pe = $(".mg-per em, .mg-perp", row), pn = $(".mg-per em, .mg-perp", n); if (pe && pn) pe.textContent = pn.textContent; }
function mgLinePaint(i) { const X = mgSc(); const row = $(`.mg-rl[data-i="${i}"]`); if (!row) return; const tmp = document.createElement("div"); tmp.innerHTML = mgLineHTML(X.inv.lines[i], i); const n = tmp.firstElementChild; n.classList.remove("st"); row.replaceWith(n); mgReviewBind(n.parentElement); }
function mgSumPaint() {
  const X = mgSc(); const I = X.inv; const sum = I.lines.filter((l) => l.on).reduce((s, l) => s + (mgInputNum(l.total) || 0), 0); const tot = mgInputNum(I.totalHT);
  const s = $("#mgRSum"); if (s) s.innerHTML = mgSumHTML(sum, tot, tot != null ? mgR2(sum - tot) : null);
  const b = $('[data-act="mgScanSave"]'); if (b) { const nP = I.lines.filter((l) => l.on && mgLineCalc(l).unitPrice).length; const ups = I.lines.filter((l) => l.on && (mgLineCalc(l).pct || 0) >= 2).length; b.disabled = !(I.lines.some((l) => l.on) || tot); b.innerHTML = mgSaveLbl(nP, ups); }
}
/* product picker for one line */
function mgPickHTML(i, q = "") {
  const X = mgSc(); const l = X.inv.lines[i]; const nq = mgNorm(q || ""); const cur = l.productId;
  const P = S.products.map((p) => ({ p, s: nq ? (mgNorm(p.name).includes(nq) ? 2 : mgKeyToks(q).some((t) => mgNorm(p.name).includes(t)) ? 1 : 0) : mgMatch(l.name, X.inv.supplier)?.p === p ? 3 : 0.5 })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, "fr")).slice(0, 40);
  return `<div class="mg-pick"><h2 class="h2">Quel produit ?</h2><p class="sub">« ${esc(l.name)} »</p>
    <label class="mg-pks">${ico("search")}<input class="input" id="mgPickQ" value="${esc(q)}" placeholder="Chercher dans le stock" autocomplete="off" data-v="${i}"></label>
    <div class="mg-pkl" id="mgPickL">${P.map(({ p }) => `<button class="mg-pki ${p.id === cur ? "on" : ""}" data-act="mgLineSet" data-v="${i}" data-id="${esc(p.id)}"><span class="tx"><b>${esc(p.name)}</b><em>${esc(p.unit)}${p.supplier ? ` · ${esc(p.supplier)}` : ""}${num(p.price) > 0 ? ` · ${mgEur(p.price)}/${esc(p.unit)}` : ""}</em></span>${p.id === cur ? ico("check") : ""}</button>`).join("") || `<p class="note">Aucun produit trouvé.</p>`}</div>
    <div class="grid2"><button class="btn soft" data-act="mgLineNew" data-v="${i}">${ico("plus")}Créer « ${esc(mgShort(mgTitle(mgCleanName(l.name))))} »</button>${cur ? `<button class="btn ghost" data-act="mgLineSet" data-v="${i}" data-id="">Ne pas lier</button>` : `<button class="btn ghost" data-act="sheetClose">Fermer</button>`}</div></div>`;
}
const mgCleanName = (s) => String(s || "").replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|l|cl|ml|%|x)\b/gi, "").replace(/\s{2,}/g, " ").trim();
function mgDoneHTML(X) {
  const R = X.result || { n: 0, ups: [], downs: [] };
  return `<div class="mg-done"><div class="mg-dhero st" style="--i:1"><div class="mg-dck">${ico("check")}</div><b class="mono">${mgPl(R.n, "prix")}</b><span>${R.n > 1 ? "mis à jour" : "mis à jour"} chez ${esc(R.supplier || "ce fournisseur")}</span></div>
    ${R.ups.length ? `<div class="glass pad mg-dups st" style="--i:2"><span class="lbl">${mgPl(R.ups.length, "hausse")} à surveiller</span>${R.ups.map((u, i) => `<div class="mg-dup st" style="--i:${3 + i}"><div class="mg-duh"><b>${esc(u.name)}</b><span class="mg-ich up mono">+${fmt(u.pct, u.pct < 10 ? 1 : 0)} %</span></div><em>${mgEur(u.prev)} → ${mgEur(u.price)} / ${esc(u.unit)}</em>${u.dishes.length ? `<div class="mg-ddish">${u.dishes.slice(0, 3).map((d) => `<button data-go="margeFiche" data-id="${esc(d.n.id)}"><span>${esc(d.n.title)}</span><b class="mono">−${mgEur(Math.abs(d.per))}</b><em>par portion${d.month ? ` · −${mgEur0(Math.abs(d.month))}/mois` : ""}</em></button>`).join("")}</div>` : ""}</div>`).join("")}</div>` : ""}
    ${R.downs.length ? `<div class="glass pad mg-ddown st" style="--i:6"><span class="lbl">Bonne nouvelle</span>${R.downs.map((u) => `<div class="mg-dd"><b>${esc(u.name)}</b><span class="mg-ich dn mono">−${fmt(Math.abs(u.pct), Math.abs(u.pct) < 10 ? 1 : 0)} %</span></div>`).join("")}</div>` : ""}
    <div class="mg-dbtns st" style="--i:7"><button class="btn acc block" data-act="mgDoneGo" data-v="marges">${ico("mgCoin")}Voir mes marges</button><button class="btn soft block" data-act="mgDoneGo" data-v="scan">${ico("mgScanDoc")}Scanner une autre facture</button></div></div>`;
}
async function mgSaveScan() {
  const X = mgSc(); if (!X || X.saving) return; const I = X.inv; const sup = String(I.supplier || "").trim();
  if (!sup) { const el = $("#mgSup"); if (el) { el.focus(); el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 500); } toast("Indiquez le fournisseur.", "err"); SFX.err(); return; }
  X.saving = true; const b = $('[data-act="mgScanSave"]'); if (b) b.disabled = true;
  const now = Date.now(); const day = I.day || MG_TODAY(); const L = I.lines.filter((l) => l.on && String(l.name || "").trim());
  try {
    let photoId = ""; const blob = X.thumbBlob || (X.file && /^image\//.test(X.file.type) ? X.file : null);
    if (blob) { try { photoId = (await upload(blob)).id || ""; } catch (e) {} }
    const lines = L.map((l) => { const c = mgLineCalc(l); return { name: String(l.name).trim(), qty: mgInputNum(l.qty), unit: l.unit || "", price: mgInputNum(l.price), total: mgInputNum(l.total), ...(c.p ? { productId: c.p.id, per: c.per || null, unitPrice: c.unitPrice ? mgR2(c.unitPrice * 10000) / 10000 : null } : {}) }; });
    const totalHT = mgInputNum(I.totalHT) ?? mgR2(lines.reduce((s, l) => s + (l.total || 0), 0)); const totalTTC = mgInputNum(I.totalTTC);
    const invId = await safe(DB.add("invoices", { supplier: sup, number: String(I.number || "").trim(), day, totalHT, totalTTC: totalTTC ?? null, vat: totalTTC && totalHT ? mgR2(totalTTC - totalHT) : null, lines, photoId, src: X.src || "manuel", status: "validee", at: now, by: S.me.id }));
    const ups = [], downs = []; let n = 0; const seen = new Set();
    for (const l of L) {
      const c = mgLineCalc(l); if (!c.p || !c.unitPrice || seen.has(c.p.id)) continue; seen.add(c.p.id); n++;
      const price = mgR2(c.unitPrice * 10000) / 10000; const prev = c.prev; const pct = prev ? mgR2(((price - prev) / prev) * 1000) / 10 : null;
      const isLatest = !num(c.p.priceAt) || !c.p.priceDay || day >= c.p.priceDay;
      await DB.add("prices", { productId: c.p.id, name: c.p.name, supplier: sup, unit: c.p.unit, price, prev: prev || null, pct, day, at: now + n, src: "facture", invoiceId: invId, by: S.me.id });
      const key = mgNorm(l.name); const aliases = [...new Set([...(c.p.aliases || []), key])].slice(-12); const packs = { ...(c.p.packs || {}) }; if (l.unit && mgConv(1, l.unit, c.p.unit) == null && num(l.per) > 0) packs[mgNorm(l.unit)] = num(l.per);
      await DB.update("products", c.p.id, { ...(isLatest ? { price, priceAt: now, priceDay: day } : {}), aliases, packs, ...(c.p.supplier ? {} : { supplier: sup }) }).catch(() => {});
      if (pct != null && pct >= 2) ups.push({ id: c.p.id, name: c.p.name, unit: c.p.unit, prev, price, pct, dishes: mgUsers(c.p.id).map(({ n: nn, q }) => ({ n: nn, per: q * (price - prev), month: q * (price - prev) * (mgSalesMap(30)[nn.id] || 0) })).sort((a, b) => Math.abs(b.month || b.per) - Math.abs(a.month || a.per)) });
      else if (pct != null && pct <= -2) downs.push({ name: c.p.name, pct });
    }
    if (I.expense && totalHT > 0) { await DB.add("expenses", { day, cat: "achats", supplier: sup, label: I.number ? `Facture ${String(I.number).trim()}` : "Facture", amountHT: totalHT, vat: totalTTC && totalHT ? mgR2(((totalTTC - totalHT) / totalHT) * 1000) / 10 : null, invoiceId: invId, at: now, by: nameOf(S.me.id) }).catch(() => {}); }
    await logEvent("facture", `a scanné la facture ${sup}${n ? ` (${mgPl(n, "prix")} à jour${ups.length ? `, ${mgPl(ups.length, "hausse")}` : ""})` : ""}`);
    ups.sort((a, b) => b.pct - a.pct);
    X.phase = "done"; X.result = { n, ups, downs, supplier: sup, invId }; X.saving = false; mgScanPaint(); const t = $("#viewport .view:not(.leave) .top .h2"); if (t) t.textContent = "Facture enregistrée";
    SFX.done(); buzz([10, 40, 10, 40, 24]); if (!mgReduce()) { const c = $(".mg-dck"); const r = c && c.getBoundingClientRect(); burst(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined); }
  } catch (e) { console.warn(e); X.saving = false; if (b) b.disabled = false; }
}

/* ───────────────────────── actions ───────────────────────── */
Object.assign(ACT, {
  mgCat: (a, id, v) => { S.ui.mg.cat = v; SFX.tick(); buzz(4); rerender(); },
  mgSort: (a, id, v) => { S.ui.mg.sort = v; SFX.tick(); buzz(4); rerender(); },
  mgTodo: () => { SFX.tap(); go("notes"); },
  mgTargetSheet: (a, id) => {
    const n = id ? S.notes.find((x) => x.id === id) : null; const cur = n ? mgTarget(n) : mgTargetDefault();
    openSheet(`<div class="mg-tsh"><h2 class="h2">${n ? `Objectif pour ${esc(n.title)}` : "Votre objectif de food cost"}</h2><p class="sub">La part du prix de vente HT que coûtent les ingrédients. En restauration, on vise souvent 25 à 32 %.</p>
      <div class="mg-tbig"><b class="mono" id="mgTV">${mgPct(cur)}</b></div><input type="range" class="mg-range" id="mgTR" min="15" max="45" step="1" value="${cur}" style="--k:${(((cur - 15) / 30) * 100).toFixed(1)}%">
      <div class="mg-tchips">${[25, 28, 30, 33, 35].map((v) => `<button class="chip ${v === cur ? "on" : ""}" data-act="mgTPick" data-v="${v}">${v} %</button>`).join("")}</div>
      <div class="grid2">${n && num(n.targetFc) ? `<button class="btn ghost" data-act="mgTSave" data-id="${esc(n.id)}" data-v="">Objectif du restaurant</button>` : `<button class="btn ghost" data-act="sheetClose">Annuler</button>`}<button class="btn acc" data-act="mgTSave" ${n ? `data-id="${esc(n.id)}"` : ""}>Enregistrer</button></div></div>`, (b) => {
      const r = $("#mgTR", b); r.addEventListener("input", () => { $("#mgTV", b).textContent = mgPct(+r.value); r.style.setProperty("--k", (((+r.value - 15) / 30) * 100).toFixed(1) + "%"); $$(".mg-tchips .chip", b).forEach((c) => c.classList.toggle("on", +c.dataset.v === +r.value)); SFX.tick(); });
    });
  },
  mgTPick: (a, id, v) => { const r = $("#mgTR"); if (!r) return; r.value = v; r.dispatchEvent(new Event("input")); },
  mgTSave: async (a, id, v) => {
    const val = a.hasAttribute("data-v") && v === "" ? null : +($("#mgTR")?.value || 30);
    try { if (id) await safe(DB.update("notes", id, { targetFc: val })); else { await safe(DB.update("restos", S.rid, { fcTarget: val })); if (S.resto) S.resto.fcTarget = val; } } catch (e) { return; }
    closeSheet(true); SFX.ok(); buzz(6); toast(val ? `Objectif : ${val} % de food cost` : "Objectif du restaurant appliqué"); rerender();
  },
  mgVat: async (a, id, v) => { SFX.tick(); buzz(4); try { await safe(DB.update("notes", id, { vat: +v })); } catch (e) {} },
  mgSimReset: () => { const n = S.notes.find((x) => x.id === S.params.id); if (!n) return; S.ui.mgSim = { id: n.id, p: num(n.price) }; SFX.tick(); rerender(); },
  mgSimSug: (a, id, v) => { const r = $("#mgSimR"); const i = $("#mgSimIn"); if (!r) return; const p = +v; if (p > +r.max) r.max = Math.ceil(p * 1.2); if (p < +r.min) r.min = Math.floor(p * 0.8); i.value = fmt(p, 2); i.dispatchEvent(new Event("input")); SFX.ok(); buzz(6); },
  mgSimSave: async (a) => {
    const n = S.notes.find((x) => x.id === S.params.id); const p = S.ui.mgSim && S.ui.mgSim.id === n?.id ? S.ui.mgSim.p : null; if (!n || !(p > 0)) return;
    a.disabled = true; const old = num(n.price);
    try { await safe(DB.update("notes", n.id, { price: mgR2(p), carte: true, carteCat: n.carteCat || "plat" })); } catch (e) { a.disabled = false; return; }
    logEvent("note", `a changé le prix de ${n.title} : ${old ? mgEur(old) + " → " : ""}${mgEur(p)}`); SFX.done(); buzz([8, 30, 8]); toast(`${n.title} : ${mgEur(p)} TTC`);
  },
  mgPrintFiche: (a, id) => { const n = S.notes.find((x) => x.id === id); if (!n) return; mgPrint(mgPrintHTML(n), `Fiche technique - ${n.title}`); },
  mgPriceSheet: (a, id) => { const h = mgPriceSheetHTML(id); if (!h) return; openSheet(h); },
  mgScan: (a, id, v) => { SFX.tap(); buzz(5); mgStartScan(v); },
  mgManual: () => { S.ui.mgScan = { phase: "review", src: "manuel", inv: mgPrepInv({ supplier: "", day: MG_TODAY(), lines: [{ name: "", qty: 1, unit: "kg", price: null, total: null, ok: true }] }) }; SFX.tap(); rerender(); },
  mgScanCancel: () => { S.ui.mgScan = null; SFX.close(); goBack(); },
  mgScanSave: () => mgSaveScan(),
  mgDoneGo: (a, id, v) => { S.ui.mgScan = null; SFX.tap(); if (v === "scan") { rerender(); mgStartScan("camera"); } else go("marges", {}, { replace: true }); },
  mgThumb: () => { const X = mgSc(); if (!X || !X.img) return; openSheet(`<div class="mg-zoom"><img src="${esc(X.img)}" alt="Facture"></div><button class="btn soft block" data-act="sheetClose">Fermer</button>`); },
  mgPhotoOpen: (a, id, v) => { const u = photoUrl(v); if (!u) return; openSheet(`<div class="mg-zoom"><img src="${esc(u)}" alt="Facture"></div><button class="btn soft block" data-act="sheetClose">Fermer</button>`); },
  mgLineOn: (a, id, v) => { const X = mgSc(); const l = X.inv.lines[+v]; l.on = !l.on; SFX.tick(); buzz(4); mgLinePaint(+v); mgSumPaint(); },
  mgLineAdd: () => { const X = mgSc(); X.inv.lines.push({ name: "", qty: 1, unit: "kg", price: null, total: null, ok: true, on: true, productId: "", per: null }); SFX.tap(); mgScanPaint(); const r = $$(".mg-rl"); const last = r[r.length - 1]; if (last) { last.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => $(".mg-rln", last)?.focus(), 250); } },
  mgLinePick: (a, id, v) => { openSheet(mgPickHTML(+v), (b) => { const q = $("#mgPickQ", b); q.addEventListener("input", debounce(() => { const t = document.createElement("div"); t.innerHTML = mgPickHTML(+v, q.value); $("#mgPickL", b).innerHTML = $("#mgPickL", t).innerHTML; }, 120)); }); },
  mgLineSet: (a, id, v) => { const X = mgSc(); const l = X.inv.lines[+v]; l.productId = id || ""; l.auto = false; const p = id && mgProd(id); l.per = p ? mgPer(l.unit, p) : null; if (p && !l.unit) l.unit = p.unit; closeSheet(true); SFX.ok(); buzz(6); mgLinePaint(+v); mgSumPaint(); },
  mgLineNew: async (a, id, v) => {
    const X = mgSc(); const l = X.inv.lines[+v]; const name = mgTitle(mgCleanName(l.name)) || "Produit"; const unit = ["kg", "g", "L", "cl", "pièce"].includes(l.unit) ? (l.unit === "g" ? "kg" : l.unit === "cl" ? "L" : l.unit) : "pièce";
    a.disabled = true; let pid;
    try { pid = await safe(DB.add("products", { name, unit, zone: "Autre", step: unit === "kg" || unit === "L" ? 0.5 : 1, price: null, supplier: String(X.inv.supplier || "").trim(), createdAt: Date.now(), fromInvoice: true })); } catch (e) { a.disabled = false; return; }
    l.productId = pid; l.auto = false; l.unit ||= unit; l.per = mgConv(1, l.unit, unit) ?? null; closeSheet(true); SFX.ok(); toast(`« ${name} » ajouté au stock`);
    setTimeout(() => { mgLinePaint(+v); mgSumPaint(); }, 80);
  },
  mgInvDel: (a, id) => {
    const f = (S.invoices || []).find((x) => x.id === id); if (!f) return;
    openSheet(`<div class="mg-tsh"><h2 class="h2">Supprimer cette facture ?</h2><p class="sub">Les prix déjà mis à jour restent dans le stock. La dépense liée est retirée des achats.</p><div class="grid2"><button class="btn ghost" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="mgInvDelOk" data-id="${esc(id)}">${ico("trash")}Supprimer</button></div></div>`);
  },
  mgInvDelOk: async (a, id) => {
    a.disabled = true; try { await safe(DB.del("invoices", id)); for (const e of (S.expenses || []).filter((x) => x.invoiceId === id)) await DB.del("expenses", e.id).catch(() => {}); } catch (e) { a.disabled = false; return; }
    closeSheet(true); logEvent("facture", "a supprimé une facture"); SFX.close(); toast("Facture supprimée"); goBack();
  },
});
