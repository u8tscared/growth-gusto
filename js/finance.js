/* Growth Gusto — area: finance (Tableau de bord du gérant + Finances)
   Data: reads tickets (CA), expenses (achats + charges), staff/punches/shifts (masse salariale), counts × product.price (variation de stock),
   oblLogs.cost (contrôles obligatoires payés). Writes only `expenses` docs:
   { day, cat, label, amountHT, supplier?, vat?, receptionId?, recurring?:"mois", endDay?, at, by }.
   A recurring doc is a monthly template: from its `day` (1st of the month) to `endDay`, prorated by day over any period.
   Cross-area helpers are optional (guarded): salesBetween, staffCost, stockLevel, oblDue, menDayStats. */

Object.assign(IC, {
  finLock: ["r:4,11,16,10,2", "M8 11V7a4 4 0 0 1 8 0v4", "M12 15v2"],
  finBolt: ["M13 2 4 14h7l-1 8 9-12h-7z"],
  finTool: ["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"],
  finCard: ["r:2,5,20,14,2", "M2 10h20", "M6 15h4"],
  finRepeat: ["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"],
  finUp: ["m5 12 7-7 7 7", "M12 19V5"],
  finDown: ["M12 5v14", "m19 12-7 7-7-7"],
  finCoin: ["c:8,8,6", "M18.09 10.37A6 6 0 1 1 10.34 18", "M7 6h1v4", "m16.71 13.88.7.71-2.82 2.82"],
});
TAB_OF.dashboard = "more"; TAB_OF.finance = "more";

const FIN_CATS = [
  { k: "achats", t: "Achats matières", ic: "truck" },
  { k: "loyer", t: "Loyer", ic: "home", rec: true },
  { k: "energie", t: "Énergie", ic: "finBolt", rec: true },
  { k: "assurances", t: "Assurances", ic: "shield", rec: true },
  { k: "entretien", t: "Entretien", ic: "finTool" },
  { k: "banque", t: "Frais bancaires", ic: "finCard", rec: true },
  { k: "autres", t: "Autres", ic: "dots" },
];
const finCat = (k) => FIN_CATS.find((c) => c.k === k) || FIN_CATS[FIN_CATS.length - 1];
/* HCR benchmarks (% of CA HT) */
const FIN_BENCH = { food: { lo: 25, hi: 35, max: 60, t: "Food cost" }, labour: { lo: 30, hi: 40, max: 70, t: "Masse salariale" }, prime: { lo: 0, hi: 65, max: 100, t: "Prime cost" } };
const FIN_VAT = 0.1; /* average VAT used only when the Z ticket gives no HT */
/* chart series (validated with the dataviz checker: adjacent CVD ΔE ≥ 9, normal ΔE ≥ 19; always labelled) */
const FIN_COL = { mat: "#EF5A3C", staff: "#5B2BFF", fixed: "#F6B93B", result: "#1E7F55" };

/* ───────── small utils ───────── */
const finR2 = (v) => Math.round((+v || 0) * 100) / 100;
const finEur = (v, d) => { if (v == null || isNaN(v)) return "–"; const dd = d != null ? d : Math.abs(v) >= 100 ? 0 : 2; return Number(v).toLocaleString("fr-FR", { minimumFractionDigits: dd, maximumFractionDigits: dd }) + " €"; };
const finK = (v) => { if (v == null || isNaN(v)) return "–"; const a = Math.abs(v); return a >= 10000 ? (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k€" : finEur(v, 0); };
const finPct = (v, d = 1) => (v == null || isNaN(v) || !isFinite(v) ? "–" : (v * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %");
const finCap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
const finNum = (v) => { const s = String(v ?? "").replace(/[\s  €]/g, ""); return num(s.includes(",") && s.includes(".") ? s.replace(/\./g, "") : s); };
const finDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const finMin = (a, b) => (a < b ? a : b), finMax = (a, b) => (a > b ? a : b);
const finIsGerant = () => { try { return myRole() === "gerant"; } catch (e) { return false; } };
/* full collection (S.* lists are capped, e.g. 60 tickets: a year needs everything) */
function finAll(col) {
  if (DB.mode === "local" && S.rid) { const o = DB.local[`restos/${S.rid}/${col}`]; if (o) return Object.entries(o).map(([id, d]) => ({ id, ...d })); }
  return S[col] || [];
}
const finTry = (fn, ...a) => { try { return fn(...a); } catch (e) { console.warn(e); return null; } };

/* ───────── data: sales ───────── */
function finSalesLocal(from, to) {
  let ttc = 0, ht = 0, htKnown = true, covers = 0, n = 0, nKnown = false; const days = new Set();
  finAll("tickets").forEach((t) => {
    if (!t.date || t.date < from || t.date > to) return; const v = num(t.total); if (v == null) return;
    ttc += v; days.add(t.date);
    const h = num(t.totalHT ?? t.ht); if (h != null) ht += h; else { ht += v / (1 + FIN_VAT); htKnown = false; }
    const c = num(t.covers ?? t.couverts); if (c) covers += c;
    const k = num(t.nbTickets ?? t.notes ?? t.count); if (k) { n += k; nKnown = true; }
  });
  return { ttc, ht, htEst: !htKnown, covers, days: days.size, n: nKnown ? n : 0 };
}
function finSales(from, to) {
  let r = null;
  if (typeof salesBetween === "function") r = finTry(salesBetween, from, to);
  if (!r || typeof r !== "object" || r.ttc == null) return finSalesLocal(from, to);
  const ttc = +r.ttc || 0; const htGiven = r.ht != null && !isNaN(r.ht);
  const days = Array.isArray(r.days) ? r.days.length : +r.days || 0;
  const n = +(r.nbTickets ?? r.notes ?? 0) || 0; /* number of bills (not of Z tickets) */
  return { ttc, ht: htGiven ? +r.ht : ttc / (1 + FIN_VAT), htEst: !htGiven || +r.htEstimated > 0, covers: +r.covers || 0, days, n };
}

/* ───────── data: masse salariale ───────── */
const finHm = (s) => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function finStaffLocal(from, to) {
  const staff = finAll("staff"); if (!staff.length) return null;
  const today = dayKey(); const by = {};
  finAll("punches").filter((p) => p.day >= from && p.day <= to).sort((a, b) => a.at - b.at).forEach((p) => { (by[p.staffId + "|" + p.day] ||= []).push(p); });
  const hours = {};
  Object.entries(by).forEach(([k, list]) => {
    const [sid, day] = k.split("|"); let t = 0, inAt = null, brAt = null, br = 0;
    list.forEach((p) => {
      if (p.kind === "in") inAt = p.at; else if (p.kind === "out" && inAt) { t += p.at - inAt; inAt = null; }
      else if (p.kind === "breakStart") brAt = p.at; else if (p.kind === "breakEnd" && brAt) { br += p.at - brAt; brAt = null; }
    });
    if (inAt && day === today) t += Date.now() - inAt;
    hours[sid] = (hours[sid] || 0) + Math.max(0, t - br) / 36e5;
  });
  finAll("shifts").filter((s) => s.day >= from && s.day <= to && s.day <= today && !by[s.staffId + "|" + s.day]).forEach((s) => {
    let d = finHm(s.end) - finHm(s.start); if (d < 0) d += 1440; d -= +s.breakMin || 0; hours[s.staffId] = (hours[s.staffId] || 0) + Math.max(0, d) / 60;
  });
  let H = 0, G = 0, L = 0;
  Object.entries(hours).forEach(([sid, h]) => { const st = staff.find((x) => x.id === sid); if (!st) return; const g = h * (+st.hourlyGross || 0); H += h; G += g; L += g * (1 + (st.chargesPct != null ? +st.chargesPct : 42) / 100); });
  return { hours: H, gross: G, loaded: L };
}
function finStaff(from, to) {
  if (typeof staffCost === "function") { const r = finTry(staffCost, from, to); if (r && typeof r === "object") return { hours: +r.hours || 0, gross: +r.gross || 0, loaded: +(r.loaded ?? r.gross) || 0 }; }
  return finStaffLocal(from, to);
}

/* ───────── data: achats + charges ───────── */
function finProrate(e, from, to) {
  const a = finMax(from, e.day || from), b = finMin(to, e.endDay || "9999-12-31"); if (a > b) return 0;
  let sum = 0;
  for (let k = a; k <= b;) {
    const d = parseDay(k); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const me = dayKey(new Date(d.getFullYear(), d.getMonth(), dim)); const end = finMin(me, b);
    sum += (+e.amountHT || 0) * (finDays(k, end) + 1) / dim; k = addDays(end, 1);
  }
  return sum;
}
function finExp(from, to) {
  const out = { achats: 0, fixed: 0, byCat: {}, items: [] };
  const add = (it, amt) => { if (!amt) return; out.items.push({ ...it, amt }); out.byCat[it.cat] = (out.byCat[it.cat] || 0) + amt; if (it.cat === "achats") out.achats += amt; else out.fixed += amt; };
  const E = finAll("expenses");
  E.forEach((e) => { const a = +e.amountHT || 0; if (!a) return; if (e.recurring) add(e, finProrate(e, from, to)); else if (e.day >= from && e.day <= to) add(e, a); });
  /* a paid intervention (extincteurs, nuisibles, hotte…) is a charge too, unless it was already entered as an expense */
  const linked = new Set(E.map((e) => e.oblLogId).filter(Boolean)); const obl = finAll("obligations");
  finAll("oblLogs").forEach((l) => { const c = finNum(l.cost); if (!c || !l.day || l.day < from || l.day > to || linked.has(l.id)) return; const o = obl.find((x) => x.id === l.oblId); add({ id: "obl-" + l.id, cat: "entretien", label: o ? o.name : "Contrôle obligatoire", day: l.day, supplier: l.provider || "", auto: "obl" }, c); });
  return out;
}

/* ───────── data: stock value from the monthly counts ───────── */
const finMonthShift = (m, n) => { const [y, mo] = m.split("-").map(Number); return monthKey(new Date(y, mo - 1 + n, 1)); };
function finStockAt(m) {
  const pr = {}; S.products.forEach((p) => { if (+p.price > 0) pr[p.id] = +p.price; });
  let v = 0, n = 0; finAll("counts").forEach((c) => { if (c.month !== m || c.qty == null) return; n++; if (pr[c.productId]) v += Math.max(0, +c.qty) * pr[c.productId]; });
  return n && Object.keys(pr).length ? v : null;
}
function finStockNow() {
  const pr = S.products.filter((p) => +p.price > 0); if (!pr.length) return null;
  if (typeof stockLevel === "function") {
    let v = 0, n = 0;
    pr.forEach((p) => { const q = finTry(stockLevel, p.id); const qq = q && typeof q === "object" ? q.qty ?? q.level : q; if (qq != null && !isNaN(qq)) { v += Math.max(0, +qq) * p.price; n++; } });
    if (n) return { v, est: true, n };
  }
  for (let i = 0; i < 4; i++) { const m = finMonthShift(monthKey(), -i); const v = finStockAt(m); if (v != null) return { v, est: false, m }; }
  return null;
}
/* stock variation over whole months: stock at the end of the month before − stock at the end of the last month */
function finStockVar(from, to) {
  if (from.slice(8) !== "01") return null;
  const d = parseDay(to); if (d.getDate() !== new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) return null;
  const a = finStockAt(finMonthShift(from.slice(0, 7), -1)), b = finStockAt(to.slice(0, 7));
  return a != null && b != null ? { start: a, end: b, v: a - b } : null;
}

/* ───────── the P&L of one period ───────── */
function finCompute(from, to) {
  const sales = finSales(from, to); const staff = finStaff(from, to); const exp = finExp(from, to); const sv = finStockVar(from, to);
  const mat = exp.achats + (sv ? sv.v : 0); const ht = sales.ht; const sal = staff ? staff.loaded : 0;
  const r = (x) => (ht > 0 ? x / ht : null);
  return {
    from, to, sales, staff, exp, sv, mat, sal, fixed: exp.fixed,
    food: exp.achats || sv ? r(mat) : null, labour: staff && sal ? r(sal) : null, prime: (exp.achats || sv) && sal ? r(mat + sal) : null,
    marge: ht - mat, ebe: ht - mat - sal - exp.fixed, ebeP: r(ht - mat - sal - exp.fixed),
    avg: sales.n ? sales.ttc / sales.n : null, perCover: sales.covers ? sales.ttc / sales.covers : null, perDay: sales.days ? sales.ttc / sales.days : null,
    empty: !sales.ttc && !exp.achats && !exp.fixed && !sal,
  };
}

/* ───────── periods ───────── */
function finPeriod(kind, off) {
  const t = parseDay(dayKey()); let from, to, lab;
  if (kind === "semaine") {
    const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7); from = dayKey(d); to = addDays(from, 6);
    const f = parseDay(from); lab = off === 0 ? "Cette semaine" : off === -1 ? "Semaine dernière" : `Semaine du ${f.getDate()} ${MONTHS[f.getMonth()]}`;
  } else if (kind === "annee") { const y = t.getFullYear() + off; from = `${y}-01-01`; to = `${y}-12-31`; lab = String(y); }
  else { const d = new Date(t.getFullYear(), t.getMonth() + off, 1); from = dayKey(d); to = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); lab = `${finCap(MONTHS[d.getMonth()])} ${d.getFullYear()}`; }
  return { kind, off, from, to, lab };
}
/* the comparison period, cut to the same elapsed length when the current one is still running */
function finCmpPeriod(P, mode) {
  let Q;
  if (mode === "n1") {
    if (P.kind === "semaine") Q = { from: addDays(P.from, -364), to: addDays(P.to, -364), lab: "même semaine N-1" };
    else if (P.kind === "mois") { const d = parseDay(P.from); const a = new Date(d.getFullYear() - 1, d.getMonth(), 1); Q = { from: dayKey(a), to: dayKey(new Date(a.getFullYear(), a.getMonth() + 1, 0)), lab: `${MONTHS[a.getMonth()]} ${a.getFullYear()}` }; }
    else { const y = +P.from.slice(0, 4) - 1; Q = { from: `${y}-01-01`, to: `${y}-12-31`, lab: String(y) }; }
  } else { const p = finPeriod(P.kind, P.off - 1); Q = { from: p.from, to: p.to, lab: P.kind === "semaine" ? "semaine précédente" : P.kind === "mois" ? MONTHS[parseDay(p.from).getMonth()] : p.lab }; }
  const today = dayKey(); Q.full = { from: Q.from, to: Q.to };
  if (today >= P.from && today <= P.to) { const el = finDays(P.from, finEffTo(P)); Q.to = finMin(Q.to, addDays(Q.from, el)); Q.partial = true; }
  return Q;
}
/* a running period stops at the last day that can have a Z ticket: today once it is entered, else yesterday (fair « à date » comparisons) */
function finEffTo(P) {
  const t = dayKey(); if (P.to < t) return P.to; if (P.from > t) return P.from;
  const e = finSales(t, t).ttc > 0 ? t : addDays(t, -1); return e < P.from ? P.from : e;
}
function finBuckets(P) {
  const out = [];
  if (P.kind === "annee") { const y = +P.from.slice(0, 4); for (let m = 0; m < 12; m++) { const a = new Date(y, m, 1); out.push({ from: dayKey(a), to: dayKey(new Date(y, m + 1, 0)), lab: finCap(MONTHS[m].slice(0, 3)), long: `${finCap(MONTHS[m])} ${y}` }); } }
  else { for (let k = P.from; k <= P.to; k = addDays(k, 1)) { const d = parseDay(k); out.push({ from: k, to: k, lab: P.kind === "semaine" ? finCap(DAYS[d.getDay()].slice(0, 3)) : String(d.getDate()), long: `${finCap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}` }); } }
  return out;
}

/* ───────── shared bits ───────── */
function finDelta(cur, prev, goodUp = true, pts = false) {
  if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return "";
  let d, tx;
  if (pts) { d = (cur - prev) * 100; if (Math.abs(d) < 0.05) return `<span class="fin-d eq">= stable</span>`; tx = `${d > 0 ? "+" : "−"}${Math.abs(d).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt`; }
  else if (prev < 0 || cur < 0) { /* a % across zero means nothing: show the gap in euros */
    d = cur - prev; if (Math.abs(d) < 0.5) return `<span class="fin-d eq">= stable</span>`; tx = `${d > 0 ? "+" : "−"}${finK(Math.abs(d))}`;
  } else { if (!prev) return ""; d = (cur - prev) / Math.abs(prev); if (Math.abs(d) < 0.005) return `<span class="fin-d eq">= stable</span>`; tx = `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toLocaleString("fr-FR", { maximumFractionDigits: Math.abs(d) < 0.1 ? 1 : 0 })} %`; }
  const good = d > 0 === goodUp;
  return `<span class="fin-d ${good ? "good" : "bad"}">${ico(d > 0 ? "finUp" : "finDown")}${tx}</span>`;
}
function finStatus(key, v) {
  const B = FIN_BENCH[key]; if (v == null) return { c: "neu", t: "À compléter" };
  const p = v * 100;
  if (key === "prime") return p <= B.hi ? { c: "ok", t: "Sain" } : p <= B.hi + 5 ? { c: "warn", t: "Limite" } : { c: "bad", t: "Trop élevé" };
  if (p < B.lo) return { c: "ok", t: "Sous la norme" };
  if (p <= B.hi) return { c: "ok", t: "Dans la norme" };
  return p <= B.hi + 5 ? { c: "warn", t: "Un peu élevé" } : { c: "bad", t: "Trop élevé" };
}
/* bullet bar: benchmark band (dashed, labelled), the value, and a tick for the comparison period */
function finBullet(key, v, prev) {
  const B = FIN_BENCH[key]; const x = (p) => Math.max(0, Math.min(100, (p / B.max) * 100)); const st = finStatus(key, v);
  return `<div class="fin-bul ${st.c}" role="img" aria-label="${B.t} ${finPct(v)}, repère ${B.lo ? `${B.lo} à ` : "moins de "}${B.hi} %">
    <span class="band" style="left:${x(B.lo)}%;width:${x(B.hi) - x(B.lo)}%"></span>
    ${v != null ? `<span class="bar" style="width:${x(v * 100)}%"></span>` : ""}
    ${prev != null ? `<span class="prev" style="left:${x(prev * 100)}%" title="Période comparée : ${finPct(prev)}"></span>` : ""}
  </div><div class="fin-bul-l"><span>0</span><span class="bl" style="left:${(x(B.lo) + x(B.hi)) / 2}%">repère ${B.lo ? `${B.lo}–` : "< "}${B.hi} %</span><span>${B.max} %</span></div>`;
}
function finLocked(title) {
  return `<div class="inner narrow fin">${topBar(title)}
    <div class="glass fin-lock st" style="--i:1"><span class="fin-lock-ic">${ico("finLock")}</span><b class="h3">Réservé au gérant</b>
      <p class="sub">Les chiffres du restaurant (ventes, coûts, salaires) ne sont visibles que par le gérant. Demandez-lui si vous avez besoin d'une info.</p>
      <button class="btn soft" data-go="home">${ico("home")}Retour à l'accueil</button></div></div>`;
}
const finUi = () => (S.ui.fin ||= { kind: "mois", off: 0, cmp: "prev", sel: null });

/* ═════════════════════════ FINANCES ═════════════════════════ */
VIEWS.finance = {
  render() {
    if (!finIsGerant()) return finLocked("Finances");
    const U = finUi(); const P = finPeriod(U.kind, U.off); const Q = finCmpPeriod(P, U.cmp);
    const C = finCompute(P.from, finEffTo(P)); const D = Q.to >= Q.from ? finCompute(Q.from, Q.to) : null;
    const right = `<button class="iconbtn" data-act="finCsv" aria-label="Exporter en CSV" title="Exporter en CSV">${ico("download")}</button>`;
    const ctl = `<div class="fin-ctl st" style="--i:1">
      <div class="seg fin-seg" role="tablist">${[["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]].map(([k, t]) => `<button class="${U.kind === k ? "on" : ""}" data-act="finKind" data-v="${k}" role="tab" aria-selected="${U.kind === k}">${t}</button>`).join("")}<span class="knob" style="width:calc(33.33% - 2.67px);transform:translateX(${["semaine", "mois", "annee"].indexOf(U.kind) * 100}%)"></span></div>
      <div class="fin-nav"><button class="iconbtn" data-act="finStep" data-v="-1" aria-label="Période précédente">${ico("back")}</button><b>${esc(P.lab)}</b><button class="iconbtn" data-act="finStep" data-v="1" aria-label="Période suivante" ${U.off >= 0 ? "disabled" : ""}>${ico("chev")}</button></div>
      <div class="chips fin-cmp"><button class="chip ${U.cmp === "prev" ? "on" : ""}" data-act="finCmp" data-v="prev">vs période précédente</button><button class="chip ${U.cmp === "n1" ? "on" : ""}" data-act="finCmp" data-v="n1">vs N-1</button></div></div>`;
    if (C.empty && !finAll("expenses").length && !finAll("tickets").length) return `<div class="inner wide fin">${topBar("Finances")}${finTeach()}</div>`;
    const cmpTx = D ? `vs ${esc(Q.lab)}${Q.partial ? " à date" : ""}` : "";
    const left = `${finHero(C, D, cmpTx)}${finRatios(C, D)}${finChart(P, Q, U)}${finSplit(C)}`;
    const side = `${finPnl(C, D, Q)}${finCharges(C, P)}${typeof pnyCard === "function" ? finTry(pnyCard) || "" : ""}`;
    return `<div class="inner wide fin">${topBar("Finances", { right })}${ctl}<div class="cols fin-cols"><div>${left}</div><div>${side}</div></div></div>`;
  },
  after(v) {
    /* hover on desktop moves the chart readout without a tap */
    $$(".fin-bars [data-bi]", v).forEach((b) => b.addEventListener("mouseenter", () => finPick(+b.dataset.bi, false)));
  },
};
function finTeach() {
  const st = (n, ic, t, s, go, cta) => `<div class="fin-step st" style="--i:${n + 1}"><span class="ic">${ico(ic)}</span><div class="tx"><b>${t}</b><span>${s}</span></div><button class="btn soft sm" ${go.startsWith("act:") ? `data-act="${go.slice(4)}"` : `data-go="${go}"`}>${cta}${ico("chev")}</button></div>`;
  return `<div class="glass pad fin-teach st" style="--i:1"><span class="fin-teach-ic">${ico("euro")}</span><b class="h2">Vos chiffres, sans tableur</b>
    <p class="sub">Food cost, masse salariale, résultat du mois : tout se calcule tout seul à partir de ce que vous saisissez déjà.</p>
    <div class="fin-steps">${st(1, "receipt", "Le ticket Z du soir", "Donne le chiffre d'affaires.", "tickets", "Tickets")}${st(2, "truck", "Le montant des livraisons", "À la réception, notez le total HT du bon.", "reception", "Réception")}${st(3, "home", "Vos charges fixes", "Loyer, énergie, assurances : une fois, c'est répété chaque mois.", "act:finAdd", "Ajouter")}${st(4, "clock", "La pointeuse", "Heures × taux horaire = masse salariale chargée.", "pointeuse", "Pointeuse")}</div></div>${typeof pnyCard === "function" ? finTry(pnyCard) || "" : ""}`;
}
function finHero(C, D, cmpTx) {
  const neg = C.ebe < 0; const k = (l, v, d) => `<div class="fin-k"><span class="lbl">${l}</span><b class="mono">${v}</b>${d || ""}</div>`;
  return `<div class="glass fin-hero st" style="--i:2">
    <span class="lbl">Résultat estimé (EBE)</span><div class="fin-big mono ${neg ? "neg" : ""}">${finEur(C.ebe, 0)}</div>
    <div class="fin-hero-sub">${finDelta(C.ebe, D && D.ebe, true)}<span class="sub">${cmpTx}${C.ebeP != null ? ` · ${finPct(C.ebeP)} du CA HT` : ""}</span></div>
    <div class="fin-ks">${k("CA TTC", finEur(C.sales.ttc, 0), finDelta(C.sales.ttc, D && D.sales.ttc))}${k(`CA HT${C.sales.htEst ? "*" : ""}`, finEur(C.sales.ht, 0), finDelta(C.sales.ht, D && D.sales.ht))}
      ${k("Marge brute", finEur(C.marge, 0), finDelta(C.marge, D && D.marge))}
      ${C.avg != null ? k("Ticket moyen", finEur(C.avg, 2), finDelta(C.avg, D && D.avg)) : k("CA moyen / jour", finEur(C.perDay, 0), finDelta(C.perDay, D && D.perDay))}
      ${k("CA par couvert", C.perCover != null ? finEur(C.perCover, 2) : "–", C.perCover != null ? finDelta(C.perCover, D && D.perCover) : `<span class="fin-d eq">couverts non saisis</span>`)}
      ${k("Couverts", C.sales.covers ? C.sales.covers.toLocaleString("fr-FR") : "–", C.sales.covers ? finDelta(C.sales.covers, D && D.sales.covers) : "")}</div>
    ${C.sales.htEst ? `<p class="note fin-foot">* HT estimé avec une TVA moyenne de 10 %.</p>` : ""}</div>`;
}
function finRatio(key, label, v, prev, sub, go) {
  const st = finStatus(key, v);
  return `<div class="fin-ratio"><div class="row"><span class="h3">${label}</span><span class="pill ${st.c}">${st.c === "ok" ? ico("check") : st.c === "neu" ? "" : ico("alert")}${st.t}</span></div>
    <div class="fin-rv"><b class="mono">${finPct(v)}</b>${finDelta(v, prev, false, true)}<span class="sub">${sub}</span></div>${finBullet(key, v, prev)}
    ${v == null && go ? `<button class="btn ghost sm" ${go}>${key === "labour" ? "Renseigner l'équipe" : "Saisir les achats"}${ico("chev")}</button>` : ""}</div>`;
}
function finRatios(C, D) {
  const sv = C.sv ? `achats ${finK(C.exp.achats)} ${C.sv.v >= 0 ? "+" : "−"} stock ${finK(Math.abs(C.sv.v))}` : `${finK(C.mat)} d'achats${C.food != null ? " · sans inventaire" : ""}`;
  return `<div class="glass pad fin-ratios st" style="--i:3"><div class="row"><span class="lbl">Ratios clés · % du CA HT</span><span class="fin-lg"><i class="tk"></i>comparée</span></div>
    ${finRatio("food", "Food cost", C.food, D && D.food, sv, `data-go="reception"`)}
    ${finRatio("labour", "Masse salariale", C.labour, D && D.labour, C.staff ? `${finK(C.sal)} chargés · ${Math.round(C.staff.hours)} h` : "aucune fiche employé", `data-go="${VIEWS.staff ? "staff" : "equipe"}"`)}
    ${finRatio("prime", "Prime cost", C.prime, D && D.prime, "matières + salaires", "")}</div>`;
}
function finChart(P, Q, U) {
  const B = finBuckets(P); const today = dayKey(); const qb = finBuckets({ ...P, from: Q.full.from, to: Q.full.to });
  const eff = finEffTo(P);
  const vals = B.map((b) => (b.from > today ? null : finSales(b.from, finMin(b.to, today)).ttc));
  /* the running bucket (this month in the year view) is compared to the same elapsed days */
  const prev = B.map((b, i) => { const q = qb[i]; if (!q) return null; const to = b.from <= eff && b.to > eff ? finMin(q.to, addDays(q.from, finDays(b.from, eff))) : q.to; return finSales(q.from, to).ttc; });
  const max = Math.max(1, ...vals.map((x) => x || 0), ...prev.map((x) => x || 0));
  const sel = U.sel != null && U.sel < B.length ? U.sel : (() => { let s = -1; vals.forEach((v, i) => { if (v) s = i; }); return s < 0 ? 0 : s; })();
  const every = B.length > 20 ? 5 : 1;
  S.ui.finChartData = { B, vals, prev };
  return `<div class="glass pad fin-chart st" style="--i:4"><div class="row"><span class="lbl">CA TTC</span><span class="fin-lg"><i class="sw"></i>${esc(P.lab)}<i class="tk"></i>${esc(finCap(Q.lab))}</span></div>
    <div class="fin-read" id="finRead" aria-live="polite">${finReadout(sel)}</div>
    <div class="fin-plot">${[0.5, 1].map((f) => `<span class="gl" style="bottom:calc(22px + ${f} * (100% - 22px))"><em class="mono">${finK(max * f)}</em></span>`).join("")}
    <div class="fin-bars" style="--n:${B.length}">${B.map((b, i) => {
      const v = vals[i], p = prev[i]; const h = v ? Math.max(1.5, (v / max) * 100) : 0;
      return `<button class="fb ${i === sel ? "on" : ""} ${v == null ? "fut" : ""}" data-act="finBar" data-bi="${i}" aria-label="${esc(b.long)} : ${v == null ? "à venir" : finEur(v, 0)}">
        <span class="col">${v ? `<i class="v" style="height:${h}%"></i>` : ""}${p ? `<i class="p" style="bottom:${(p / max) * 100}%"></i>` : ""}</span>
        <span class="x ${i % every && i !== B.length - 1 ? "hide" : ""} ${b.from <= today && b.to >= today ? "td" : ""}">${esc(b.lab)}</span></button>`;
    }).join("")}</div></div></div>`;
}
function finReadout(i) {
  const D = S.ui.finChartData; if (!D || !D.B[i]) return "";
  const v = D.vals[i], p = D.prev[i];
  return `<b>${esc(D.B[i].long)}</b><span class="mono">${v == null ? "à venir" : finEur(v, 0)}</span>${p != null && v != null ? `<span class="sub">vs ${finEur(p, 0)}</span>${finDelta(v, p)}` : ""}`;
}
function finPick(i, sound = true) {
  const U = finUi(); U.sel = i; const r = $("#finRead"); if (r) r.innerHTML = finReadout(i);
  $$(".fin-bars .fb").forEach((b) => b.classList.toggle("on", +b.dataset.bi === i)); if (sound) { SFX.tick(); buzz(4); }
}
function finSplit(C) {
  const ht = C.sales.ht; if (!(ht > 0)) return "";
  const parts = [["mat", "Matières", Math.max(0, C.mat)], ["staff", "Salaires chargés", C.sal], ["fixed", "Charges fixes", C.fixed]];
  const res = ht - parts.reduce((a, p) => a + p[2], 0); if (res > 0) parts.push(["result", "Résultat", res]);
  const tot = parts.reduce((a, p) => a + p[2], 0) || 1;
  return `<div class="glass pad fin-split st" style="--i:5"><div class="row"><span class="lbl">Sur 100 € de CA HT</span>${res < 0 ? `<span class="pill bad">${ico("alert")}Perte de ${finEur(-res, 0)}</span>` : ""}</div>
    <div class="fin-seg-bar" role="img" aria-label="${parts.map((p) => `${p[1]} ${Math.round((p[2] / ht) * 100)} euros`).join(", ")}">${parts.filter((p) => p[2] > 0).map((p) => `<span style="flex:${p[2] / tot};background:${FIN_COL[p[0]]}" title="${p[1]} : ${finEur(p[2], 0)}"></span>`).join("")}</div>
    <div class="fin-legend">${parts.map((p) => `<div><i style="background:${FIN_COL[p[0]]}"></i><span>${p[1]}</span><b class="mono">${Math.round((p[2] / ht) * 100)} €</b></div>`).join("")}</div>
    ${res < 0 ? `<p class="note" style="margin:0">Les coûts dépassent le chiffre d'affaires HT sur cette période.</p>` : ""}</div>`;
}
function finPnlRows(C, D) {
  const r = (t, k, cur, prev, o = {}) => ({ t, k, cur, prev, ...o });
  const rows = [
    r("Chiffre d'affaires TTC", "ttc", C.sales.ttc, D && D.sales.ttc),
    r(`Chiffre d'affaires HT${C.sales.htEst ? " (estimé)" : ""}`, "ht", C.sales.ht, D && D.sales.ht, { strong: true }),
    r("Achats matières", "ach", C.exp.achats, D && D.exp.achats, { neg: true }),
  ];
  if (C.sv || (D && D.sv)) rows.push(r("Variation de stock", "sv", C.sv ? C.sv.v : null, D && D.sv ? D.sv.v : null, { neg: true }));
  rows.push(
    r("Coût matières", "mat", C.mat, D && D.mat, { neg: true, pct: C.food, ppct: D && D.food }),
    r("Marge brute", "mb", C.marge, D && D.marge, { strong: true }),
    r("Masse salariale chargée", "sal", C.sal, D && D.sal, { neg: true, pct: C.labour, ppct: D && D.labour }),
    r("Prime cost", "pc", C.mat + C.sal, D && D.mat + D.sal, { neg: true, pct: C.prime, ppct: D && D.prime, soft: true }),
    r("Charges fixes", "fx", C.fixed, D && D.fixed, { neg: true }),
    r("Résultat estimé (EBE)", "ebe", C.ebe, D && D.ebe, { total: true, pct: C.ebeP, ppct: D && D.ebeP }),
  );
  return rows;
}
function finPnl(C, D, Q) {
  const rows = finPnlRows(C, D);
  return `<div class="glass pad fin-pnl st" style="--i:3"><div class="row"><span class="lbl">Compte de résultat</span><span class="sub">${D ? `vs ${esc(Q.lab)}` : ""}</span></div>
    <table class="fin-tbl"><thead><tr><th scope="col"><span class="fin-sr">Poste</span></th><th scope="col">Période</th><th scope="col">Comparée</th></tr></thead><tbody>${rows.map((x) => `<tr class="${x.strong ? "strong" : ""} ${x.total ? "total" : ""} ${x.soft ? "soft" : ""}"><th scope="row">${x.t}${x.pct != null ? `<em class="mono">${finPct(x.pct)}</em>` : ""}</th>
      <td class="mono">${x.cur == null ? "–" : finEur(x.cur, 0)}<span class="dl">${finDelta(x.cur, x.prev, !x.neg)}</span></td><td class="mono mut">${x.prev == null || isNaN(x.prev) ? "–" : finEur(x.prev, 0)}</td></tr>`).join("")}</tbody></table>
    <div class="fin-mini"><span>${C.sales.days} jour${C.sales.days > 1 ? "s" : ""} de ventes</span><span>${C.staff ? `${Math.round(C.staff.hours)} h travaillées` : "heures : –"}</span><span>${C.sales.covers ? `${C.sales.covers} couverts` : "couverts : –"}</span></div></div>`;
}
function finCharges(C, P) {
  const cats = FIN_CATS.map((c) => ({ ...c, v: C.exp.byCat[c.k] || 0, n: C.exp.items.filter((i) => i.cat === c.k).length })).filter((c) => c.v > 0);
  const tot = C.exp.achats + C.exp.fixed; const recs = finAll("expenses").filter((e) => e.recurring && !(e.endDay && e.endDay < dayKey()));
  const quick = FIN_CATS.filter((c) => c.k !== "achats").map((c) => `<button class="chip" data-act="finAdd" data-v="${c.k}">${ico(c.ic)}${c.t}</button>`).join("");
  return `<div class="glass pad fin-charges st" style="--i:4"><div class="row"><span class="lbl">Achats & charges</span><b class="mono">${finEur(tot, 0)}</b></div>
    ${cats.length ? `<div class="fin-cats">${cats.map((c) => `<button class="li tap fin-catrow" data-act="finCatOpen" data-v="${c.k}"><span class="ic">${ico(c.ic)}</span><span class="tx"><b>${c.t}</b><em>${c.n} ligne${c.n > 1 ? "s" : ""}${tot ? ` · ${Math.round((c.v / tot) * 100)} %` : ""}</em></span><span class="mono fin-amt">${finEur(c.v, 0)}</span>${ico("chev")}</button>`).join("")}</div>`
      : `<div class="empty fin-empty"><span class="ic">${ico("finCoin")}</span><b>Rien sur cette période</b>Ajoutez une charge, ou notez le montant HT à chaque réception.</div>`}
    <button class="btn acc block" data-act="finAdd">${ico("plus")}Ajouter une charge</button>
    <div class="chips fin-quick">${quick}</div>
    ${recs.length ? `<div class="fin-recs"><span class="lbl">${ico("finRepeat")}Chaque mois</span>${recs.map((e) => `<button class="fin-rec" data-act="finEdit" data-id="${e.id}"><span>${esc(e.label || finCat(e.cat).t)}</span><b class="mono">${finEur(e.amountHT, 0)}</b></button>`).join("")}<p class="note" style="margin:0">Réparti au jour près sur la semaine, le mois ou l'année affichés.</p></div>` : ""}</div>`;
}

/* ───────── charge sheet (add / edit) ───────── */
function finExpSheet(e) {
  S.ui.finX = { id: e.id || null, cat: e.cat || "autres", amount: e.amountHT != null ? fmt(e.amountHT, 2) : "", label: e.label || "", day: e.day || dayKey(), recurring: !!e.recurring, supplier: e.supplier || "", receptionId: e.receptionId || "", endDay: e.endDay || "" };
  const paint = () => {
    const x = S.ui.finX; const cat = finCat(x.cat);
    openSheet(`<div class="fin-sh"><div class="h2">${x.id ? "Modifier la charge" : "Nouvelle charge"}</div>
      <div class="fin-catgrid" role="radiogroup" aria-label="Catégorie">${FIN_CATS.map((c) => `<button class="fin-catb ${x.cat === c.k ? "on" : ""}" data-act="finXCat" data-v="${c.k}" role="radio" aria-checked="${x.cat === c.k}">${ico(c.ic)}<span>${c.t}</span></button>`).join("")}</div>
      <label class="fin-amtin"><span class="lbl">Montant HT</span><span class="w"><input class="input mono" id="finXAmt" inputmode="decimal" value="${esc(x.amount)}" placeholder="0,00" autocomplete="off" enterkeyhint="done"><b>€</b></span></label>
      <div class="seg fin-recseg"><button class="${x.recurring ? "" : "on"}" data-act="finXRec" data-v="0">Une fois</button><button class="${x.recurring ? "on" : ""}" data-act="finXRec" data-v="1">${ico("finRepeat")}Chaque mois</button><span class="knob" style="width:calc(50% - 4px);transform:translateX(${x.recurring ? "100%" : "0"})"></span></div>
      <div class="grid2"><label class="field"><span>${x.recurring ? "À partir de" : "Date"}</span><input class="input" type="date" id="finXDay" value="${esc(x.day)}"></label>
        <label class="field"><span>Fournisseur <i class="fin-opt">facultatif</i></span><input class="input" id="finXSup" value="${esc(x.supplier)}" placeholder="Ex. EDF" autocomplete="off"></label></div>
      <label class="field"><span>Libellé <i class="fin-opt">facultatif</i></span><input class="input" id="finXLab" value="${esc(x.label)}" placeholder="${esc(cat.t)}" autocomplete="off" enterkeyhint="done"></label>
      ${x.receptionId ? `<p class="note" style="margin:0">Liée à une réception : le montant est aussi mis à jour dans l'historique des livraisons.</p>` : ""}
      <button class="btn acc block" data-act="finXSave">${ico("check")}${x.id ? "Enregistrer" : "Ajouter"}</button>
      ${x.id ? `<div class="grid2">${x.recurring && !x.endDay ? `<button class="btn soft" data-act="finXStop">${ico("x")}Arrêter</button>` : `<span></span>`}<button class="btn danger" data-act="finXDel">${ico("trash")}Supprimer</button></div>` : ""}</div>`);
  };
  S.ui.finXPaint = paint; paint();
}
const finXGrab = () => { const x = S.ui.finX; if (!x) return; const g = (id) => $(id); if (g("#finXAmt")) x.amount = g("#finXAmt").value; if (g("#finXLab")) x.label = g("#finXLab").value; if (g("#finXDay")) x.day = g("#finXDay").value || dayKey(); if (g("#finXSup")) x.supplier = g("#finXSup").value; };
function finCatSheet(k, P) {
  const C = finCompute(P.from, finEffTo(P)); const items = C.exp.items.filter((i) => i.cat === k).sort((a, b) => (b.day || "").localeCompare(a.day || "")); const c = finCat(k);
  openSheet(`<div class="fin-sh"><div class="hstack"><span class="ic">${ico(c.ic)}</span><div><div class="h2">${c.t}</div><div class="sub">${esc(P.lab)} · ${finEur(C.exp.byCat[k] || 0, 2)} HT</div></div></div>
    <div class="fin-items">${items.map((i) => `<button class="li tap" ${i.auto ? `data-go="obligations"` : `data-act="finEdit" data-id="${i.id}"`}><span class="tx"><b>${esc(i.label || c.t)}</b><em>${i.recurring ? "chaque mois · part de la période" : esc(shortDate(i.day))}${i.supplier ? ` · ${esc(i.supplier)}` : ""}${i.receptionId ? " · réception" : ""}${i.auto ? " · contrôle obligatoire" : ""}</em></span><span class="mono fin-amt">${finEur(i.amt, 2)}</span></button>`).join("")}</div>
    <button class="btn soft block" data-act="finAdd" data-v="${k}">${ico("plus")}Ajouter</button></div>`);
}

/* ───────── CSV ───────── */
async function finCsvExport() {
  const U = finUi(); const P = finPeriod(U.kind, U.off); const Q = finCmpPeriod(P, U.cmp); const C = finCompute(P.from, finEffTo(P)); const D = finCompute(Q.from, Q.to);
  const n2 = (v) => (v == null || isNaN(v) ? "" : (Math.round(v * 100) / 100).toString().replace(".", ","));
  const p1 = (v) => (v == null ? "" : (Math.round(v * 1000) / 10).toString().replace(".", ","));
  const rows = [[`${S.resto?.name || "Restaurant"} · Finances`, `${P.lab} (${shortDate(P.from)} au ${shortDate(finEffTo(P))})`, `Comparée : ${Q.lab} (${shortDate(Q.from)} au ${shortDate(Q.to)})`], [],
    ["Poste", "Période (€)", "% CA HT", "Comparée (€)", "% CA HT"]];
  finPnlRows(C, D).forEach((x) => rows.push([x.t, n2(x.cur), p1(x.pct), n2(x.prev), p1(x.ppct)]));
  rows.push(["Couverts", C.sales.covers || "", "", D.sales.covers || "", ""], ["Ticket moyen TTC", n2(C.avg), "", n2(D.avg), ""], ["CA par couvert TTC", n2(C.perCover), "", n2(D.perCover), ""], ["Heures travaillées", n2(C.staff?.hours), "", n2(D.staff?.hours), ""]);
  rows.push([], ["Détail", "CA TTC (€)", "CA HT (€)"]);
  finBuckets(P).forEach((b) => { if (b.from > dayKey()) return; const s = finSales(b.from, finMin(b.to, dayKey())); rows.push([b.long, n2(s.ttc), n2(s.ht)]); });
  rows.push([], ["Date", "Catégorie", "Libellé", "Fournisseur", "Montant HT (€)", "Récurrent"]);
  C.exp.items.slice().sort((a, b) => (a.day || "").localeCompare(b.day || "")).forEach((i) => rows.push([i.day || "", finCat(i.cat).t, i.label || "", i.supplier || "", n2(i.amt), i.recurring ? "chaque mois (prorata)" : ""]));
  await saveCsv(`finances-${P.from}-${P.kind}.csv`, rows);
}

/* ═════════════════════════ TABLEAU DE BORD ═════════════════════════ */
function finLotsAlert() {
  const L = typeof activeLots === "function" ? activeLots() : []; let late = 0, today = 0, soon = 0;
  L.forEach((l) => { const d = daysUntil(dlcOf(l)); if (d == null) return; if (d < 0) late++; else if (d === 0) today++; else if (d <= 2) soon++; });
  return { late, today, soon, n: L.length };
}
function finHaccp() {
  const t = dayKey(), from = addDays(t, -6);
  const rd = typeof todayStats === "function" ? todayStats() : { done: 0, exp: 0 };
  const men = typeof menDayStats === "function" ? finTry(menDayStats) : null;
  const badR = S.readings.filter((r) => r.day >= from && r.ok === false).length;
  let badRec = 0; S.receptions.forEach((r) => { if (dayKey(new Date(r.at)) < from) return; (r.lines || []).forEach((L) => { if (L.refused || L.reserve || L.ok === false) badRec++; }); });
  return { rd, men, badR, badRec, nc: badR + badRec };
}
function finObl() {
  let list = typeof oblDue === "function" ? finTry(oblDue, 30) : null;
  if (!Array.isArray(list)) list = S.obligations.filter((o) => !o.archived && o.nextDue && daysUntil(o.nextDue) <= 30);
  return list.map((x) => { const o = x.obl || x.o || x; const due = x.nextDue || x.due || o.nextDue; return { name: o.name || x.name || "Obligation", due, d: daysUntil(due) }; }).sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
}
function finOnDuty() {
  const t = dayKey(); const last = {}, first = {};
  S.punches.filter((p) => p.day === t).slice().sort((a, b) => a.at - b.at).forEach((p) => { last[p.staffId] = p; if (p.kind === "in" && !first[p.staffId]) first[p.staffId] = p.at; });
  const on = Object.entries(last).filter(([, p]) => p.kind !== "out").map(([sid, p]) => ({ st: S.staff.find((s) => s.id === sid) || { name: "Employé" }, sid, pause: p.kind === "breakStart", since: first[sid] || p.at }));
  const planned = new Set(S.shifts.filter((s) => s.day === t).map((s) => s.staffId)).size;
  return { on, planned };
}
function finFeedback() {
  const since = Date.now() - 30 * 864e5; const r = S.feedback.filter((f) => f.at >= since && num(f.rating) != null);
  const avg = r.length ? r.reduce((a, f) => a + num(f.rating), 0) / r.length : null;
  const last = S.feedback.slice().sort((a, b) => b.at - a.at)[0] || null;
  return { avg, n: r.length, last, all: S.feedback.length };
}
const finStars = (v) => { const out = []; for (let i = 1; i <= 5; i++) out.push(`<i class="${v >= i - 0.25 ? "on" : v >= i - 0.75 ? "half" : ""}">${ico("star")}</i>`); return `<span class="fdb-stars" aria-label="${fmt(v, 1)} sur 5">${out.join("")}</span>`; };

VIEWS.dashboard = {
  render() {
    if (!finIsGerant()) return finLocked("Tableau de bord");
    const t = dayKey(); const d = parseDay(t);
    /* CA: today when the Z is in, else yesterday (the Z comes at closing time) */
    const sT = finSales(t, t); const useT = sT.ttc > 0; const dayK = useT ? t : addDays(t, -1); const sD = useT ? sT : finSales(dayK, dayK);
    const sW1 = finSales(addDays(dayK, -7), addDays(dayK, -7)), sN1 = finSales(addDays(dayK, -364), addDays(dayK, -364));
    const W = finPeriod("semaine", 0); const wTo = finEffTo(W); const el = finDays(W.from, wTo); const sWk = finSales(W.from, wTo);
    const sWkP = finSales(addDays(W.from, -7), addDays(W.from, -7 + el)); const sWkN = finSales(addDays(W.from, -364), addDays(W.from, -364 + el));
    const spark = []; for (let i = 6; i >= 0; i--) { const k = addDays(t, -i); spark.push({ k, v: finSales(k, k).ttc }); }
    const smax = Math.max(1, ...spark.map((x) => x.v));
    const M = finPeriod("mois", 0); const MC = finCompute(M.from, finEffTo(M)); const MQ = finCmpPeriod(M, "prev"); const MD = finCompute(MQ.from, MQ.to);
    const H = finHaccp(); const lots = finLotsAlert(); const stock = finStockNow(); const obl = finObl(); const duty = finOnDuty(); const fb = finFeedback();
    const pillCmp = (cur, prev, lab, long) => (cur > 0 && prev > 0 ? `<span class="fdb-cmp" title="${esc(long || lab)} : ${finEur(prev, 0)}">${finDelta(cur, prev)}<span>${lab}</span></span>` : "");
    const tile = (cls, go, i, inner, aria) => `<div class="glass fdb-t ${cls} st" style="--i:${i}" role="button" tabindex="0" data-go="${go}" aria-label="${esc(aria)}">${inner}<span class="fdb-go" aria-hidden="true">${ico("chev")}</span></div>`;
    const mName = MONTHS[d.getMonth()];

    const hero = `<div class="hero wall fdb-hero st" style="--i:1" role="button" tabindex="0" data-go="finance" aria-label="Voir les finances"><div class="fdb-hin">
      <div class="fdb-hl"><span class="fdb-hlbl">${useT ? "CA du jour" : "CA d'hier"} · TTC</span><b class="fdb-hbig mono">${sD.ttc ? finEur(sD.ttc, 0) : "–"}</b>
        <div class="fdb-hcmp">${pillCmp(sD.ttc, sW1.ttc, "vs S-1", `vs ${DAYS[parseDay(dayK).getDay()]} dernier`)}${pillCmp(sD.ttc, sN1.ttc, "vs N-1", "vs même jour l'an dernier")}${!sD.ttc ? `<span class="fdb-cmp"><span>Ticket Z pas encore saisi</span></span>` : ""}</div>
        <div class="fdb-wk"><span>Semaine à date</span><b class="mono">${finEur(sWk.ttc, 0)}</b>${pillCmp(sWk.ttc, sWkP.ttc, "vs S-1")}${pillCmp(sWk.ttc, sWkN.ttc, "vs N-1")}</div></div>
      <div class="fdb-spark" aria-hidden="true"><div class="b">${spark.map((x, i) => `<span class="c ${x.k === dayK ? "on" : ""} ${x.v ? "" : "z"}" style="--i:${i}"><span class="bw"><i style="height:${x.v ? Math.max(6, (x.v / smax) * 100) : 4}%"></i></span><em>${x.k === t ? "Auj." : finCap(DAYS[parseDay(x.k).getDay()].slice(0, 3))}</em></span>`).join("")}</div><span>7 derniers jours</span></div></div>
      ${!useT ? `<button class="btn fdb-z" data-go="tickets">${ico("receipt")}Saisir le ticket Z du jour</button>` : ""}</div>`;

    const ratioTile = (key, lbl, v, pv, sub, i) => { const st = finStatus(key, v); return tile("fdb-ratio", "finance", i, `<div class="row"><span class="lbl">${lbl} · ${mName}</span><span class="pill ${st.c}">${st.t}</span></div><div class="fdb-rv"><b class="mono">${finPct(v)}</b>${finDelta(v, pv, false, true)}</div>${finBullet(key, v, pv)}<span class="sub fdb-sub">${sub}</span>`, `${lbl} ${finPct(v)}`); };

    const hcPct = H.rd.exp ? Math.round((H.rd.done / H.rd.exp) * 100) : null;
    const bar = (lbl, pct, val, cls) => `<div class="fdb-hb"><div class="row"><span>${lbl}</span><b class="mono">${val}</b></div><span class="tr"><i class="${cls}" style="width:${pct == null ? 0 : Math.max(2, pct)}%"></i></span></div>`;
    const menPct = H.men && H.men.pct != null ? H.men.pct : null;
    const haccp = tile("fdb-haccp", "registre", 4, `<div class="row"><span class="lbl">HACCP aujourd'hui</span>${H.nc ? `<span class="pill warn">${ico("alert")}${H.nc} écart${H.nc > 1 ? "s" : ""} · 7 j</span>` : `<span class="pill ok">${ico("check")}0 écart · 7 j</span>`}</div>
      ${bar("Relevés de température", hcPct, H.rd.exp ? `${H.rd.done}/${H.rd.exp}` : "–", hcPct === 100 ? "ok" : "acc")}
      ${bar("Ménage", menPct, menPct != null ? `${menPct} %` : "–", menPct === 100 ? "ok" : H.men && H.men.late ? "warn" : "acc")}
      <div class="fdb-nc"><span><b class="mono">${H.badR}</b> relevé${H.badR > 1 ? "s" : ""} hors seuil</span><span><b class="mono">${H.badRec}</b> refus / réserve${H.badRec > 1 ? "s" : ""}</span></div>`, "Conformité HACCP");

    const dlc = tile("fdb-dlc", "stock", 5, `<span class="lbl">DLC & stock</span><div class="fdb-dl"><div class="${lots.late ? "bad" : ""}"><b class="mono">${lots.late}</b><span>dépassée${lots.late > 1 ? "s" : ""}</span></div><div class="${lots.today ? "bad" : ""}"><b class="mono">${lots.today}</b><span>jour J</span></div><div class="${lots.soon ? "warn" : ""}"><b class="mono">${lots.soon}</b><span>sous 48 h</span></div></div>
      <div class="fdb-sv"><span>Valeur du stock${stock && stock.est ? " (estimée)" : ""}</span><b class="mono">${stock ? finEur(stock.v, 0) : "–"}</b></div>${!stock ? `<span class="sub fdb-sub">Ajoutez les prix d'achat pour la valoriser.</span>` : ""}`, "DLC et stock");

    const late = obl.filter((o) => o.d != null && o.d < 0);
    const oblT = tile("fdb-obl", "obligations", 6, `<div class="row"><span class="lbl">Obligations</span>${late.length ? `<span class="pill bad"><span class="dot"></span>${late.length} en retard</span>` : obl.length ? `<span class="pill warn">${obl.length} sous 30 j</span>` : `<span class="pill ok">${ico("check")}À jour</span>`}</div>
      ${obl.length ? `<div class="fdb-ol">${obl.slice(0, 3).map((o) => `<div><b>${esc(o.name)}</b><span class="${o.d < 0 ? "bad" : o.d <= 7 ? "warn" : ""}">${o.d == null ? "–" : o.d < 0 ? `${-o.d} j de retard` : o.d === 0 ? "aujourd'hui" : `dans ${o.d} j`}</span></div>`).join("")}</div>` : `<p class="sub fdb-sub">${S.obligations.length ? "Rien à prévoir dans les 30 prochains jours." : "Extincteurs, hotte, nuisibles : programmez vos contrôles."}</p>`}`, "Obligations à venir");

    const team = tile("fdb-team", "pointeuse", 7, `<div class="row"><span class="lbl">En service maintenant</span><span class="pill ${duty.on.length ? "ok" : "neu"}">${duty.on.length ? `<span class="dot"></span>` : ""}${duty.on.length}${duty.planned ? ` / ${duty.planned} prévu${duty.planned > 1 ? "s" : ""}` : ""}</span></div>
      ${duty.on.length ? `<div class="fdb-ppl">${duty.on.slice(0, 6).map((p) => `<div class="fdb-p ${p.pause ? "pause" : ""}"><span class="ava" style="background:${esc(p.st.color || colorFor(p.sid))}">${esc(initials(p.st.name))}</span><span class="tx"><b>${esc(firstName(p.st.name))}</b><em>${p.pause ? "en pause" : `depuis ${hm(p.since)}`}</em></span></div>`).join("")}${duty.on.length > 6 ? `<span class="sub">+${duty.on.length - 6}</span>` : ""}</div>` : `<p class="sub fdb-sub">Personne n'a pointé${duty.planned ? ` · ${duty.planned} au planning aujourd'hui` : ""}.</p>`}`, "Équipe en service");

    const avis = tile("fdb-avis", "avis", 8, `<div class="row"><span class="lbl">Avis · 30 jours</span>${fb.n ? `<span class="sub">${fb.n} note${fb.n > 1 ? "s" : ""}</span>` : ""}</div>
      ${fb.avg != null ? `<div class="fdb-av"><b class="mono">${fmt(fb.avg, 1)}</b><span>/ 5</span>${finStars(fb.avg)}</div>` : `<p class="sub fdb-sub">${fb.all ? "Aucune note ces 30 derniers jours." : "Recueillez les retours clients et équipe."}</p>`}
      ${fb.last && fb.last.text ? `<p class="fdb-quote">« ${esc(String(fb.last.text).slice(0, 120))}${String(fb.last.text).length > 120 ? "…" : ""} »<em>${fb.last.source === "equipe" ? "Équipe" : "Client"} · ${esc(when(fb.last.at))}</em></p>` : ""}`, "Avis et retours");

    const ebeT = tile("fdb-ebe", "finance", 2, `<span class="lbl">Résultat estimé · ${mName}</span><b class="fdb-ebev mono ${MC.ebe < 0 ? "neg" : ""}">${finEur(MC.ebe, 0)}</b><div class="fdb-rv">${finDelta(MC.ebe, MD.ebe)}<span class="sub">vs ${MONTHS[parseDay(MQ.from).getMonth()]} à date</span></div><div class="fdb-mini"><span>CA HT <b class="mono">${finK(MC.sales.ht)}</b></span><span>Prime cost <b class="mono">${finPct(MC.prime, 0)}</b></span></div>`, "Résultat du mois");

    const greet = `${finCap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}${S.resto?.name ? ` · ${esc(S.resto.name)}` : ""}`;
    return `<div class="inner wide fin fdb">${topBar("Tableau de bord", { right: `<button class="iconbtn" data-go="finance" aria-label="Finances">${ico("euro")}</button>` })}
      <p class="sub fdb-greet st" style="--i:0">${greet}</p>
      <div class="fdb-grid">${hero}${ebeT}${ratioTile("food", "Food cost", MC.food, MD.food, MC.food != null ? `${finK(MC.mat)} de matières` : "Notez les montants à la réception", 3)}${ratioTile("labour", "Masse salariale", MC.labour, MD.labour, MC.staff ? `${finK(MC.sal)} chargés` : "Créez les fiches employés", 3)}${haccp}${dlc}${oblT}${team}${avis}</div></div>`;
  },
};

/* ───────── actions ───────── */
Object.assign(ACT, {
  finKind: (a, id, v) => { const U = finUi(); if (U.kind === v) return; U.kind = v; U.off = 0; U.sel = null; SFX.tick(); buzz(4); rerender(); },
  finStep: (a, id, v) => { const U = finUi(); const n = U.off + +v; if (n > 0) return; U.off = n; U.sel = null; SFX.tap(); buzz(4); rerender(); },
  finCmp: (a, id, v) => { const U = finUi(); if (U.cmp === v) return; U.cmp = v; SFX.tick(); rerender(); },
  finBar: (a) => finPick(+a.dataset.bi),
  finCsv: () => { SFX.tap(); finCsvExport(); },
  finAdd: (a, id, v) => { SFX.tap(); const c = finCat(v || "loyer"); finExpSheet({ cat: c.k, recurring: !!c.rec }); },
  finEdit: (a, id) => { const e = finAll("expenses").find((x) => x.id === id); if (!e) return; SFX.tap(); finExpSheet(e); },
  finCatOpen: (a, id, v) => { SFX.tap(); const U = finUi(); finCatSheet(v, finPeriod(U.kind, U.off)); },
  finXCat: (a, id, v) => { finXGrab(); const x = S.ui.finX; x.cat = v; if (!x.id) x.recurring = !!finCat(v).rec; SFX.tick(); buzz(4); S.ui.finXPaint(); },
  finXRec: (a, id, v) => { finXGrab(); S.ui.finX.recurring = v === "1"; SFX.tick(); S.ui.finXPaint(); },
  finXSave: async (a) => {
    finXGrab(); const x = S.ui.finX; const amt = finNum(x.amount);
    if (amt == null || amt <= 0) { SFX.err(); buzz([20, 40, 20]); toast("Indiquez le montant HT, par exemple 1 250,00", "err"); const i = $("#finXAmt"); if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); i.focus(); } return; }
    let day = x.day || dayKey(); if (x.recurring) day = day.slice(0, 8) + "01";
    const doc = { day, cat: x.cat, label: x.label.trim() || finCat(x.cat).t, amountHT: finR2(amt), at: Date.now(), by: S.me.id };
    if (x.supplier.trim()) doc.supplier = x.supplier.trim(); if (x.recurring) doc.recurring = "mois"; if (x.receptionId) doc.receptionId = x.receptionId; if (x.endDay && x.recurring) doc.endDay = x.endDay;
    a.setAttribute("disabled", "");
    try {
      if (x.id) {
        const cur = finAll("expenses").find((e) => e.id === x.id) || {}; const keep = { ...cur }; delete keep.id; delete keep.recurring; delete keep.endDay; delete keep.supplier;
        await safe(DB.set("expenses", x.id, { ...keep, ...doc, at: cur.at || doc.at, by: cur.by || doc.by, editedAt: Date.now() }));
        if (x.receptionId && S.receptions.some((r) => r.id === x.receptionId)) DB.update("receptions", x.receptionId, { amountHT: doc.amountHT }).catch(() => {});
      } else { await safe(DB.add("expenses", doc)); logEvent("expense", `a ajouté une charge : ${doc.label} · ${finEur(doc.amountHT, 2)} HT${doc.recurring ? " chaque mois" : ""}`); }
    } catch (e) { a.removeAttribute("disabled"); return; }
    closeSheet(true); SFX.ok(); buzz(10); toast(x.id ? "Charge modifiée" : doc.recurring ? "Charge ajoutée, chaque mois" : "Charge ajoutée");
  },
  finXStop: async () => { const x = S.ui.finX; if (!x || !x.id) return; try { await safe(DB.update("expenses", x.id, { endDay: dayKey() })); } catch (e) { return; } closeSheet(true); SFX.ok(); toast("Charge arrêtée à partir d'aujourd'hui"); },
  finXDel: async () => {
    const x = S.ui.finX; if (!x || !x.id) return; const cur = finAll("expenses").find((e) => e.id === x.id); if (!cur) return;
    try { await safe(DB.del("expenses", x.id)); } catch (e) { return; } closeSheet(true); SFX.close(); buzz(8);
    const data = { ...cur }; delete data.id; S.ui.finUndo = { id: cur.id, data };
    toast("Charge supprimée"); const t = $("#toast"); $("#toastTx").innerHTML = `<span class="tx">Charge supprimée</span><button data-act="finUndoDel">Annuler</button>`; t.style.pointerEvents = "auto";
    clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 4500);
  },
  finUndoDel: async () => { const u = S.ui.finUndo; if (!u) return; S.ui.finUndo = null; $("#toast").classList.remove("on"); try { await safe(DB.set("expenses", u.id, u.data)); SFX.ok(); } catch (e) {} },
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id && /^finX(Amt|Lab|Sup)$/.test(e.target.id)) { e.preventDefault(); const b = $("[data-act=finXSave]"); b && b.click(); } });
