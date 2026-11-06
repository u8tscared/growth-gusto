/* Growth Gusto — area: multi-restaurant (route « sites » = « Mes établissements », takes over the HACCP-only list of js/alertes.js). Prefix « mr ».
   For an owner with several restaurants:
     · Comparer: takings, covers, average spend, food cost, gross margin, payroll, waste and HACCP compliance, side by side,
       over 7 days, 30 days or the month, with the group total and the points that need attention;
     · Transferts: send stock from one restaurant to another (lot number and DLC kept, temperature checked at arrival), a numbered
       transfer note on both sides, printable;
     · Partager: copy recipes (with the online carte), products with their purchase price, suppliers, to the other restaurants;
     · one-tap switch: the Établissements sheet (side bar, Accueil) shows each restaurant's day at a glance + « Vue d'ensemble ».
   Data: transfers/{id} in BOTH restaurants (same id): { no, from:{rid,name}, to:{rid,name}, lines:[{ productId, name, qty, unit, price, lot?, dlc?, lotId? }],
         value, status:"envoye"|"recu"|"annule", sentAt, sentBy, sentUid, recvAt?, recvBy?, temp?, note? }.
         Stock moves kind « site » (added to STK_KIND here): −qty in the sender when sent, +qty in the receiver when received (ref = transfer id).
         A shared recipe / product / supplier carries sharedFrom: { rid, id, name, at }.
   Other restaurants are read with plain reads (this device or the demo: DB.local; an account: Firestore get, kept 2 min). No server, no new cost. */
"use strict";

TAB_OF.sites = "more";
Object.assign(IC, {
  mrShare: ["c:6,12,2.6", "c:18,5.8,2.6", "c:18,18.2,2.6", "f:M6 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z", "M8.3 10.8l7.4-3.7", "M8.3 13.2l7.4 3.7"],
  mrCmp: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2", "f:M8.5 4h3v16h-3z"],
  mrSend: ["M3.5 12h13", "m12.5 7 5 5-5 5", "M20.5 5v14", "f:M3.5 9.5h9v5h-9z"],
});
if (typeof STK_KIND !== "undefined" && !STK_KIND.site) STK_KIND.site = { t: "Entre restaurants", tp: "Entre restaurants", ic: "swap", c: "acc" };
if (typeof stkMoveText === "function" && !stkMoveText._mr) {
  const t0 = stkMoveText;
  stkMoveText = function (m) {
    if (!m || m.kind !== "site") return t0(m);
    const q = `${fmt(Math.abs(+m.qty || 0), Math.abs(+m.qty || 0) % 1 ? 1 : 0)} ${m.unit || ""}`.trim();
    return (+m.qty || 0) < 0 ? `a envoyé ${q} de ${m.name || "un produit"} ${m.toName ? mrA(m.toName) : "à un autre restaurant"}` : `a reçu ${q} de ${m.name || "un produit"} de ${m.fromName || "un autre restaurant"}`;
  };
  stkMoveText._mr = true;
}

const MR = { tab: "cmp", per: "30", cache: {}, tr: [], trRid: null, send: null, share: { kind: "notes", off: {}, to: null }, busy: false };
const MR_COLS = ["tickets", "expenses", "staff", "shifts", "readings", "fridges", "lots", "products", "moves", "waste", "notes", "transfers", "suppliers"];
const mrEur = (v, d = 0) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const mrEurK = (v) => (v == null || isNaN(v) ? "–" : Math.abs(v) >= 10000 ? (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k€" : mrEur(v));
const mrPct = (v, d = 1) => (v == null || isNaN(v) || !isFinite(v) ? "–" : (v * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %");
const mrN = (v) => { const x = Math.round((+v || 0) * 100) / 100; return x.toLocaleString("fr-FR", { maximumFractionDigits: 2 }); };
const mrKey = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const mrHm = (s) => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const mrDk = (ms) => (ms ? dayKey(new Date(ms)) : "");
const mrMgr = () => { if (DB.mode === "demo") return true; try { if (typeof PERMS !== "undefined" && PERMS.isAdmin) return !!PERMS.isAdmin(); } catch (e) {} return myRole() === "gerant"; };
const mrCook = () => mrMgr() || myRole() === "chef";
/* restaurant initials without the articles: « Le Comptoir Démo » → CD, « La Cantine du Port » → CP */
const mrIni = (n) => { const w = String(n || "R").replace(/[’']/g, " ").split(/\s+/).filter((x) => x && !/^(le|la|les|l|du|de|des|d|au|aux|chez|et|&)$/i.test(x)); return ((w.length ? w : [String(n || "R")]).slice(0, 2).map((x) => x[0]).join("") || "R").toUpperCase(); };
/* « à » + a restaurant name: « au Comptoir », « aux Halles », « à La Cantine » */
const mrA = (n) => { const x = String(n || ""); return /^le\s/i.test(x) ? "au " + x.slice(3) : /^les\s/i.test(x) ? "aux " + x.slice(4) : "à " + x; };
const mrOthers = () => S.restos.filter((r) => r.id !== S.rid);
const mrResto = (rid) => S.restos.find((r) => r.id === rid) || { id: rid, name: "Restaurant" };
const mrCanCross = () => DB.mode !== "db" || !!DB.uid;

/* ───────── transfers of the open restaurant (live) ───────── */
function mrWatch() {
  if (!S.rid || MR.trRid === S.rid) return; MR.trRid = S.rid; MR.tr = []; const rid = S.rid;
  DB.watch("transfers", { order: "sentAt", dir: "desc", limit: 300 }, (rows) => { if (S.rid !== rid) return; MR.tr = rows; if (S.route === "sites") onData(); });
}
const mrIncoming = () => { mrWatch(); return MR.tr.filter((t) => t.status === "envoye" && t.to && t.to.rid === S.rid); };

/* ───────── read any restaurant ───────── */
const mrLocal = (rid, col) => Object.entries(DB.local[`restos/${rid}/${col}`] || {}).map(([id, d]) => ({ id, ...d }));
function mrBundle(rid) {
  if (DB.mode !== "db") { const B = { rid }; MR_COLS.forEach((c) => (B[c] = mrLocal(rid, c))); return B; }
  if (rid === S.rid) {
    mrWatch();
    return { rid, tickets: S.tickets, expenses: S.expenses, staff: S.staff, shifts: S.shifts, readings: S.readings, fridges: S.fridges, lots: S.lots, products: S.products, moves: S.moves,
      waste: typeof hyArr === "function" ? hyArr("waste") : [], notes: S.notes, transfers: MR.tr, suppliers: typeof acSupDocs === "function" ? acSupDocs() : [] };
  }
  const c = MR.cache[rid]; if (!c || Date.now() - c.at > 120000) mrFetch(rid); return c && c.B ? c.B : null;
}
async function mrFetch(rid) {
  if (!DB.db || !DB.db.collection || (MR.cache[rid] && MR.cache[rid].busy)) return;
  MR.cache[rid] = { ...(MR.cache[rid] || {}), busy: true, at: MR.cache[rid] ? MR.cache[rid].at : 0 };
  const fs = DB.db, C = (c) => fs.collection(`restos/${rid}/${c}`), from = addDays(dayKey(), -62), fromMs = parseDay(from).getTime();
  const get = (q) => q.get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []);
  const R = await Promise.all([
    get(C("tickets").where("date", ">=", from)), get(C("expenses")), get(C("staff")), get(C("shifts").where("day", ">=", from)), get(C("readings").where("day", ">=", from)),
    get(C("fridges")), get(C("lots").where("status", "in", ["in", "opened"])), get(C("products")), get(C("moves").where("at", ">=", fromMs)), get(C("waste").where("at", ">=", fromMs)),
    get(C("notes")), get(C("transfers").orderBy("sentAt", "desc").limit(200)), get(C("suppliers")),
  ]);
  const B = { rid }; MR_COLS.forEach((c, i) => (B[c] = R[i])); MR.cache[rid] = { at: Date.now(), B };
  if (S.route === "sites") refresh();
}
/* write into any restaurant (the open one through DB, another one directly; same rules: members only) */
function mrPut(rid, col, id, data, merge) {
  if (rid === S.rid) return merge ? DB.update(col, id, data) : DB.set(col, id, data);
  if (DB.mode === "db") {
    if (!DB.uid || !DB.db.collection) return Promise.reject(new Error("local"));
    const ref = DB.db.collection(`restos/${rid}/${col}`).doc(id); return DB.dbw(merge ? ref.set(DB.clean(data), { merge: true }) : ref.set(DB.clean(data)));
  }
  const path = `restos/${rid}/${col}`, cur = (DB.local[path] ||= {})[id] || {};
  DB.local[path][id] = merge ? { ...cur, ...DB.clean(data) } : DB.clean(data); DB.emit(path);
  if (MR.cache[rid]) MR.cache[rid].at = 0;
  return Promise.resolve();
}
const mrNewId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ───────── the numbers of one restaurant over a period ───────── */
function mrRange() {
  const to = dayKey();
  if (MR.per === "mois") { const d = parseDay(to); return { from: dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to, t: "Ce mois-ci" }; }
  const n = MR.per === "7" ? 7 : 30; return { from: addDays(to, -(n - 1)), to, t: n === 7 ? "7 derniers jours" : "30 derniers jours" };
}
function mrStats(B, from, to) {
  if (!B) return null;
  const inR = (d) => !!d && d >= from && d <= to, today = dayKey(), rid = B.rid;
  let ttc = 0, ht = 0, cov = 0; const byDay = {};
  (B.tickets || []).forEach((t) => { if (!inR(t.date)) return; const v = +t.total || 0; if (!v) return; const h = +(t.totalHT ?? t.ht) || v / 1.1; ttc += v; ht += h; cov += +(t.covers ?? t.couverts) || 0; byDay[t.date] = (byDay[t.date] || 0) + h; });
  let ach = 0, fixed = 0;
  (B.expenses || []).forEach((e) => { const a = +e.amountHT || 0; if (!a) return; const v = e.recurring ? (typeof finProrate === "function" ? finProrate(e, from, to) : 0) : inR(e.day) ? a : 0; if (e.cat === "achats") ach += v; else fixed += v; });
  let tin = 0, tout = 0;
  (B.transfers || []).forEach((t) => { if (t.status === "annule") return; if (t.from && t.from.rid === rid && inR(mrDk(t.sentAt))) tout += +t.value || 0; if (t.to && t.to.rid === rid && t.status === "recu" && inR(mrDk(t.recvAt))) tin += +t.value || 0; });
  const mat = Math.max(0, ach + tin - tout);
  const st = Object.fromEntries((B.staff || []).map((s) => [s.id, s])); let hrs = 0, pay = 0;
  (B.shifts || []).forEach((s) => { if (!inR(s.day) || s.day > today) return; const p = st[s.staffId]; if (!p) return; let d = mrHm(s.end) - mrHm(s.start); if (d < 0) d += 1440; d -= +s.breakMin || 0; const h = Math.max(0, d) / 60; hrs += h; pay += h * (+p.hourlyGross || 0) * (1 + (p.chargesPct != null ? +p.chargesPct : 42) / 100); });
  const price = {}; (B.products || []).forEach((p) => (price[p.id] = +p.price || 0));
  let waste = 0; const wm = new Set();
  (B.waste || []).forEach((w) => { if (!inR(w.day || mrDk(w.at))) return; waste += +w.cost || 0; if (w.moveId) wm.add(w.moveId); });
  (B.moves || []).forEach((m) => { if (m.kind !== "perte" || wm.has(m.id) || m.refType === "waste" || !inR(mrDk(m.at))) return; waste += +m.value || Math.abs(+m.qty || 0) * (price[m.productId] || 0); });
  const fr = (B.fridges || []).filter((f) => !f.archived), ids = new Set(fr.map((f) => f.id));
  const rs = (B.readings || []).filter((r) => inR(r.day) && ids.has(r.fridgeId)), okN = rs.filter((r) => r.ok !== false).length;
  const nDays = Math.round((parseDay(to) - parseDay(from)) / 864e5) + 1, hr = new Date().getHours();
  const exp = fr.length * 2 * (nDays - 1) + fr.length * ((hr >= 12 ? 1 : 0) + (hr >= 19 ? 1 : 0)), done = Math.min(new Set(rs.map((r) => r.day + r.slot + r.fridgeId)).size, exp);
  const late = (B.lots || []).filter((l) => (l.status === "in" || l.status === "opened") && dlcOf(l) && dlcOf(l) < today).length;
  const r = (x) => (ht > 0 ? x / ht : null);
  return { ttc, ht, cov, avg: cov ? ttc / cov : null, mat, food: ht > 0 && mat ? mat / ht : null, marge: ht - mat, margeP: r(ht - mat), pay, labour: pay ? r(pay) : null, fixed,
    after: ht - mat - pay, afterP: r(ht - mat - pay), waste, wasteP: r(waste), conf: rs.length ? okN / rs.length : null, bad: rs.length - okN, done, exp, late,
    team: (B.staff || []).filter((s) => s.active !== false).length, hrs, byDay, tin, tout, days: Object.keys(byDay).length, from, to };
}
/* each restaurant's numbers, the open one first */
function mrAll() {
  const { from, to } = mrRange();
  return S.restos.slice().sort((a, b) => (a.id === S.rid ? -1 : b.id === S.rid ? 1 : (a.createdAt || 0) - (b.createdAt || 0)))
    .map((r, i) => ({ r, i, st: mrStats(mrBundle(r.id), from, to) }));
}

/* ───────── comparison ───────── */
const MR_KPI = [
  ["ht", "Chiffre d'affaires HT", "receipt", (s) => s.ht, (v) => mrEur(v), 1, true],
  ["cov", "Couverts", "users", (s) => s.cov || null, (v) => (v == null ? "–" : Math.round(v).toLocaleString("fr-FR")), 1, false],
  ["avg", "Ticket moyen TTC", "euro", (s) => s.avg, (v) => mrEur(v, 2), 1, false],
  ["food", "Coût matière", "box", (s) => s.food, (v) => mrPct(v), -1, true, (v) => (v > 0.35 ? "bad" : v > 0.31 ? "warn" : "")],
  ["marge", "Marge brute", "trend", (s) => (s.ht ? s.marge : null), (v) => mrEur(v), 1, true],
  ["labour", "Masse salariale", "clock", (s) => s.labour, (v) => mrPct(v), -1, true, (v) => (v > 0.42 ? "bad" : v > 0.36 ? "warn" : "")],
  ["waste", "Gaspillage", "trash", (s) => (s.waste || s.ht ? s.waste : null), (v) => mrEur(v), -1, true, (v, s) => (s.wasteP > 0.03 ? "bad" : s.wasteP > 0.015 ? "warn" : "")],
  ["conf", "Conformité HACCP", "shield", (s) => s.conf, (v) => mrPct(v, 0), 1, false, (v) => (v < 0.9 ? "bad" : v < 0.97 ? "warn" : "")],
  ["late", "DLC dépassées", "calcheck", (s) => s.late, (v) => (v == null ? "–" : String(v)), -1, false, (v) => (v > 0 ? "bad" : "")],
];
function mrKpiCard(k, L, i) {
  const [key, label, ic, get, show, dir, money, tone] = k;
  const vals = L.map((x) => (x.st ? get(x.st) : null)), have = vals.filter((v) => v != null && !isNaN(v));
  if (!have.length) return "";
  const max = Math.max(...have.map((v) => Math.abs(v)), 0.0001), best = have.length > 1 ? (dir > 0 ? Math.max(...have) : Math.min(...have)) : null;
  const bars = L.map((x, j) => {
    const v = vals[j], w = v == null ? 0 : Math.max(4, Math.round((Math.abs(v) / max) * 100)), tn = v != null && tone ? tone(v, x.st) : "", top = best != null && v === best && have.filter((y) => y === best).length === 1;
    return `<div class="mr-bar${x.r.id === S.rid ? " cur" : ""}${top ? " best" : ""}${tn ? " " + tn : ""}"><span class="mr-bn">${esc(x.r.name)}</span><span class="mr-bt"><i style="--w:${w}%;--d:${j * 70}ms"></i></span><b class="mono">${show(v, x.st)}</b></div>`;
  }).join("");
  return `<div class="glass mr-kpi st" style="--i:${i}"><div class="mr-kh"><span class="mr-ki">${ico(ic)}</span><b>${label}</b></div>${bars}</div>`;
}
function mrSpark(byDay, from, to) {
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(byDay[d] || 0); if (days.length < 2) return "";
  const W = 120, H = 30, mx = Math.max(...days, 1), pts = days.map((v, i) => `${((i / (days.length - 1)) * W).toFixed(1)},${(H - 2 - (v / mx) * (H - 6)).toFixed(1)}`).join(" ");
  return `<svg class="mr-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,${H} ${pts} ${W},${H}" class="ar"/><polyline points="${pts}" class="ln"/></svg>`;
}
function mrInsights(L) {
  const ok = L.filter((x) => x.st && x.st.ht > 0); const out = [];
  if (ok.length < 2) return out;
  const tot = ok.reduce((a, x) => ({ ht: a.ht + x.st.ht, mat: a.mat + x.st.mat, pay: a.pay + x.st.pay }), { ht: 0, mat: 0, pay: 0 });
  const gFood = tot.mat / tot.ht, gLab = tot.pay / tot.ht;
  ok.forEach((x) => {
    const s = x.st, n = x.r.name;
    if (s.food != null && s.food - gFood > 0.025) out.push(["bad", "box", `${n} : coût matière à ${mrPct(s.food)}`, `${fmt((s.food - gFood) * 100, 1)} points au-dessus du groupe, soit environ ${mrEur((s.food - gFood) * s.ht)} sur la période.`]);
    if (s.labour != null && s.labour - gLab > 0.05) out.push(["warn", "clock", `${n} : masse salariale à ${mrPct(s.labour)}`, `Le groupe est à ${mrPct(gLab)}. Regardez le planning des jours calmes.`]);
    if (s.wasteP != null && s.wasteP > 0.015) out.push(["warn", "trash", `${n} : ${mrEur(s.waste)} jetés`, `${mrPct(s.wasteP)} du chiffre d'affaires. Un transfert vers un autre restaurant évite souvent la poubelle.`]);
    if (s.conf != null && s.conf < 0.97) out.push(["bad", "shield", `${n} : ${s.bad} relevé${s.bad > 1 ? "s" : ""} hors limite`, `Conformité ${mrPct(s.conf, 0)} sur la période.`]);
    if (s.late) out.push(["bad", "calcheck", `${n} : ${s.late} DLC dépassée${s.late > 1 ? "s" : ""}`, "À jeter ou à vérifier aujourd'hui."]);
  });
  const bestAvg = ok.filter((x) => x.st.avg).sort((a, b) => b.st.avg - a.st.avg)[0];
  if (bestAvg && ok.length > 1) out.push(["ok", "star", `${bestAvg.r.name} a le meilleur ticket moyen`, `${mrEur(bestAvg.st.avg, 2)} par couvert : ses suggestions du jour peuvent servir aux autres.`]);
  return out.slice(0, 6);
}
function mrCmpTab(L) {
  const { from, to, t } = mrRange(), mgr = mrMgr(), ok = L.filter((x) => x.st);
  const tot = ok.reduce((a, x) => ({ ht: a.ht + x.st.ht, mat: a.mat + x.st.mat, pay: a.pay + x.st.pay, cov: a.cov + x.st.cov, waste: a.waste + x.st.waste, rs: a.rs + (x.st.conf != null ? 1 : 0), conf: a.conf + (x.st.conf || 0) }), { ht: 0, mat: 0, pay: 0, cov: 0, waste: 0, rs: 0, conf: 0 });
  const per = `<div class="seg mr-per st" style="--i:2" role="tablist">${[["7", "7 jours"], ["30", "30 jours"], ["mois", "Ce mois"]].map(([k, l]) => `<button class="${MR.per === k ? "on" : ""}" data-act="mrPer" data-v="${k}" role="tab" aria-selected="${MR.per === k}">${l}</button>`).join("")}<span class="knob" style="width:calc(33.333% - 2.67px);transform:translateX(${["7", "30", "mois"].indexOf(MR.per) * 100}%)"></span></div>`;
  const hero = mgr ? `<div class="mr-hero st" style="--i:3"><div class="mr-hl"><span>${esc(t)} · ${L.length} restaurants</span><b class="mono">${mrEur(tot.ht)}</b><em>chiffre d'affaires HT du groupe</em></div>
      <div class="mr-hg"><div><b class="mono">${tot.ht ? mrEurK(tot.ht - tot.mat) : "–"}</b><em>Marge brute</em></div><div><b class="mono">${tot.ht && tot.mat ? mrPct(tot.mat / tot.ht) : "–"}</b><em>Coût matière</em></div><div><b class="mono">${tot.rs ? mrPct(tot.conf / tot.rs, 0) : "–"}</b><em>Conformité</em></div></div></div>`
    : `<div class="mr-hero st" style="--i:3"><div class="mr-hl"><span>${esc(t)} · ${L.length} restaurants</span><b class="mono">${tot.rs ? mrPct(tot.conf / tot.rs, 0) : "–"}</b><em>conformité HACCP du groupe</em></div></div>`;
  const cards = L.map((x, j) => {
    const s = x.st, cur = x.r.id === S.rid;
    return `<div class="glass mr-rc st${cur ? " cur" : ""}" style="--i:${4 + j}" ${cur ? "" : `data-act="mrOpen" data-id="${esc(x.r.id)}" role="button" tabindex="0" aria-label="Ouvrir ${esc(x.r.name)}"`}>
      <div class="mr-rh">${restoMark(42, x.r, `<span class="mr-mono c${j % 4}">${esc(mrIni(x.r.name))}</span>`)}<div class="mr-rn"><b>${esc(x.r.name)}</b><em>${cur ? "Ouvert en ce moment" : "Toucher pour ouvrir"}</em></div>${cur ? `<span class="pill acc">Ici</span>` : `<span class="mr-go">${ico("chev")}</span>`}</div>
      ${s ? `${mgr ? mrSpark(s.byDay, from, to) : ""}<div class="mr-rg">${mgr ? `<div><b class="mono">${mrEurK(s.ht)}</b><em>CA HT</em></div><div><b class="mono">${mrPct(s.food, 0)}</b><em>Matière</em></div>` : `<div><b class="mono">${s.done}<small>/${s.exp}</small></b><em>Relevés</em></div><div><b class="mono">${s.team}</b><em>Équipe</em></div>`}<div class="${s.conf != null && s.conf < 0.97 ? "hot" : ""}"><b class="mono">${mrPct(s.conf, 0)}</b><em>HACCP</em></div></div>`
        : `<div class="mr-rg mr-load"><span></span><span></span><span></span></div>`}</div>`;
  }).join("");
  const ins = mgr ? mrInsights(L) : [];
  const insH = ins.length ? `<div class="glass mr-ins st" style="--i:${5 + L.length}"><div class="h3">À regarder</div>${ins.map(([tn, ic, b, e]) => `<div class="mr-in ${tn}"><span class="mr-ii">${ico(ic)}</span><div><b>${esc(b)}</b><em>${esc(e)}</em></div></div>`).join("")}</div>` : "";
  const kpis = MR_KPI.filter((k) => mgr || !k[6]).map((k, i) => mrKpiCard(k, L, 6 + L.length + i)).join("");
  const note = mgr ? `<p class="note mr-note st" style="--i:${16 + L.length}">Coût matière = achats de la période, plus ce que le restaurant a reçu des autres, moins ce qu'il leur a envoyé. Masse salariale d'après le planning, charges comprises.</p>` : "";
  return `${per}${hero}<div class="mr-rcs">${cards}</div>${insH}<div class="mr-kpis">${kpis}</div>${note}`;
}

/* ───────── transfers ───────── */
const MR_ST = { envoye: ["En route", "warn"], recu: ["Reçu", "ok"], annule: ["Annulé", "neu"] };
function mrTrRow(t, i) {
  const out = t.from && t.from.rid === S.rid, other = out ? t.to : t.from, [tx, tn] = MR_ST[t.status] || MR_ST.envoye;
  const n = (t.lines || []).length;
  return `<div class="li tap mr-tr st" style="--i:${i}" data-act="mrTrOpen" data-id="${esc(t.id)}"><span class="mr-dir ${out ? "out" : "in"}">${ico(out ? "mrSend" : "truck")}</span><div class="tx"><b>${out ? "Vers" : "Depuis"} ${esc(other ? other.name : "?")}</b><em>${esc(t.no || "")} · ${n} produit${n > 1 ? "s" : ""} · ${when(t.status === "recu" && t.recvAt ? t.recvAt : t.sentAt)}</em></div><span class="mr-trv"><b class="mono">${mrEur(t.value, 0)}</b><span class="pill ${tn}">${tx}</span></span></div>`;
}
function mrTrTab() {
  mrWatch(); const inc = mrIncoming(), all = MR.tr.slice(0, 60), cook = mrCook();
  if (MR.send) return mrSendPanel();
  const incH = inc.length ? `<div class="glass mr-inc st" style="--i:2"><div class="mr-inch"><span class="mr-ii warn">${ico("truck")}</span><div><b class="h3">${inc.length === 1 ? "Un transfert à réceptionner" : `${inc.length} transferts à réceptionner`}</b><em>Vérifiez les produits et la température en les rangeant.</em></div></div>
      ${inc.map((t) => `<div class="mr-incr"><div><b>Depuis ${esc(t.from.name)}</b><em>${(t.lines || []).map((l) => `${mrN(l.qty)} ${esc(l.unit || "")} ${esc(l.name)}`).join(" · ")}</em></div><button class="btn acc sm" data-act="mrRecv" data-id="${esc(t.id)}">Réceptionner</button></div>`).join("")}</div>` : "";
  const cta = cook && mrOthers().length ? `<button class="btn acc block st" style="--i:3" data-act="mrSendNew">${ico("mrSend")}Envoyer des produits à un autre restaurant</button>` : "";
  const mo = monthKey(), sent = MR.tr.filter((t) => t.status !== "annule" && t.from && t.from.rid === S.rid && mrDk(t.sentAt).slice(0, 7) === mo).reduce((a, t) => a + (+t.value || 0), 0),
    got = MR.tr.filter((t) => t.status === "recu" && t.to && t.to.rid === S.rid && mrDk(t.recvAt).slice(0, 7) === mo).reduce((a, t) => a + (+t.value || 0), 0);
  const sum = MR.tr.length ? `<div class="mr-trs st" style="--i:4"><div class="glass"><b class="mono">${mrEur(sent)}</b><em>Envoyé ce mois</em></div><div class="glass"><b class="mono">${mrEur(got)}</b><em>Reçu ce mois</em></div></div>` : "";
  const list = all.length ? `<div class="glass pad st" style="--i:5"><div class="h3" style="margin-bottom:4px">Historique</div>${all.map((t, i) => mrTrRow(t, 6 + Math.min(i, 8))).join("")}</div>`
    : `<div class="glass empty st" style="--i:5"><div class="ic">${ico("swap")}</div><b>Aucun transfert pour l'instant</b>Un restaurant a trop de crème, l'autre en manque : envoyez-la en deux gestes. Le lot et la DLC suivent, et chaque restaurant garde son bon.</div>`;
  return `${incH}${cta}${sum}${list}`;
}
function mrSendPanel() {
  const D = MR.send, others = mrOthers(), to = D.to && mrResto(D.to);
  const tot = D.lines.reduce((a, l) => a + (+l.qty || 0) * (+l.price || 0), 0);
  const dest = `<div class="glass pad st" style="--i:2"><div class="lbl">Vers</div><div class="mr-dests">${others.map((r, j) => `<button class="mr-dest${D.to === r.id ? " on" : ""}" data-act="mrSendTo" data-id="${esc(r.id)}" aria-pressed="${D.to === r.id}">${restoMark(30, r, `<span class="mr-mono sm c${(j + 1) % 4}">${esc(mrIni(r.name))}</span>`)}<span>${esc(r.name)}</span></button>`).join("")}</div></div>`;
  const lines = D.lines.length ? D.lines.map((l, i) => `<div class="li mr-sl"><div class="tx"><b>${esc(l.name)}</b><em>${mrN(l.qty)} ${esc(l.unit || "")}${l.lot ? ` · lot ${esc(l.lot)}` : ""}${l.dlc ? ` · DLC ${shortDate(l.dlc)}` : ""}</em></div><b class="mono">${mrEur((+l.qty || 0) * (+l.price || 0), 2)}</b><button class="iconbtn" data-act="mrSendDel" data-v="${i}" aria-label="Retirer ${esc(l.name)}">${ico("x")}</button></div>`).join("")
    : `<p class="sub" style="margin:4px 0 0">Choisissez les produits ci-dessous.</p>`;
  const lv = (p) => (typeof stockLevel === "function" ? (() => { try { return stockLevel(p.id); } catch (e) { return null; } })() : null);
  const prods = S.products.filter((p) => !D.lines.some((l) => l.productId === p.id)).map((p) => { const q = lv(p); return `<div class="li tap mr-pr" data-act="mrSendPick" data-id="${esc(p.id)}" data-k="${esc(mrKey(p.name))}"><div class="tx"><b>${esc(p.name)}</b><em>${q != null ? `En stock : ${mrN(Math.max(0, q))} ${esc(p.unit || "")}` : esc(p.zone || p.supplier || "")}</em></div>${ico("plus")}</div>`; }).join("");
  return `${dest}<div class="glass pad st" style="--i:3"><div class="mr-slh"><div class="h3">À envoyer</div>${D.lines.length ? `<b class="mono">${mrEur(tot, 2)} HT</b>` : ""}</div>${lines}</div>
    <div class="glass pad st" style="--i:4"><input class="input" id="mrQ" placeholder="Chercher un produit" autocomplete="off" enterkeyhint="search"><div class="mr-prs">${prods || `<p class="sub">Aucun produit dans le stock de ce restaurant.</p>`}</div></div>
    <div class="ctabar mr-cta"><button class="btn soft" data-act="mrSendCancel">Annuler</button><button class="btn acc" data-act="mrSendGo" ${D.lines.length && D.to ? "" : "disabled"}>${ico("mrSend")}${to ? `Envoyer ${esc(mrA(to.name))}` : "Choisir le restaurant"}</button></div>`;
}
function mrTrHTML(t) {
  const rows = (t.lines || []).map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.lot || "")}</td><td>${l.dlc ? esc(shortDate(l.dlc)) : ""}</td><td class="n">${mrN(l.qty)} ${esc(l.unit || "")}</td><td class="n">${mrEur(l.price, 2)}</td><td class="n">${mrEur((+l.qty || 0) * (+l.price || 0), 2)}</td></tr>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon de transfert ${esc(t.no || "")}</title><style>body{font:14px/1.45 Arial,Helvetica,sans-serif;color:#1B1530;margin:32px}h1{font-size:22px;margin:0 0 4px}.m{color:#615B74;font-size:12.5px}
    .h{display:flex;justify-content:space-between;gap:20px;margin-bottom:18px}.b{font-weight:700}table{width:100%;border-collapse:collapse;margin-top:8px}th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#615B74;border-bottom:1.5px solid #E9DFCD;padding:8px 6px}
    td{padding:9px 6px;border-bottom:1px solid #F1E9DA}.n{text-align:right;white-space:nowrap}.t{margin-top:14px;text-align:right;font-size:17px;font-weight:800}.s{display:flex;gap:40px;margin-top:34px}.s div{flex:1;border-top:1.5px solid #E9DFCD;padding-top:8px;font-size:12.5px;color:#615B74}</style></head><body>
    <div class="h"><div><h1>Bon de transfert</h1><div class="m">N° ${esc(t.no || "")}</div></div><div style="text-align:right"><div class="m">Envoyé le ${new Date(t.sentAt).toLocaleString("fr-FR")}</div>${t.recvAt ? `<div class="m">Reçu le ${new Date(t.recvAt).toLocaleString("fr-FR")}${t.temp != null && t.temp !== "" ? ` à ${esc(String(t.temp).replace(".", ","))} °C` : ""}</div>` : ""}</div></div>
    <div class="h"><div><div class="m">De</div><div class="b">${esc(t.from.name)}</div><div class="m">${esc(t.sentBy || "")}</div></div><div style="text-align:right"><div class="m">À</div><div class="b">${esc(t.to.name)}</div><div class="m">${esc(t.recvBy || "")}</div></div></div>
    <table><thead><tr><th>Produit</th><th>Lot</th><th>DLC</th><th class="n">Quantité</th><th class="n">Prix HT</th><th class="n">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="t">Total HT : ${mrEur(t.value, 2)}</div>${t.note ? `<p>${esc(t.note)}</p>` : ""}<div class="s"><div>Remis par</div><div>Reçu par</div></div>
    <p class="m" style="margin-top:26px">Transfert interne entre établissements, préparé avec Growth Gusto.</p></body></html>`;
}
function mrPrint(html) {
  const f = document.createElement("iframe"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
  const d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 250);
}

/* ───────── sharing ───────── */
const MR_SH = {
  notes: { t: "Recettes & carte", col: "notes", name: (x) => x.title || "", sub: (x) => [x.carte && num(x.price) > 0 ? `Carte · ${mrEur(num(x.price), 2)}` : "", x.cat || ""].filter(Boolean).join(" · "),
    copy: (x) => { const d = { ...x }; ["id", "photoId", "uid", "at", "updatedAt", "processBy", "processAt"].forEach((k) => delete d[k]); if (typeof d.photo === "string" && !/^data:/.test(d.photo)) d.photo = ""; return d; } },
  products: { t: "Produits & prix", col: "products", name: (x) => x.name || "", sub: (x) => [x.price ? `${mrEur(x.price, 2)} / ${x.unit || "u"}` : "", x.supplier || ""].filter(Boolean).join(" · "),
    copy: (x) => { const d = {}; ["name", "unit", "zone", "price", "supplier", "allergens", "alChecked", "aliases", "packs", "minQty", "step", "cat", "vat"].forEach((k) => { if (x[k] !== undefined) d[k] = x[k]; }); return d; } },
  suppliers: { t: "Fournisseurs", col: "suppliers", name: (x) => x.name || "", sub: (x) => [x.phone || x.email || "", Array.isArray(x.deliveryDays) && x.deliveryDays.length ? `${x.deliveryDays.length} livraison${x.deliveryDays.length > 1 ? "s" : ""} / semaine` : ""].filter(Boolean).join(" · "),
    copy: (x) => { const d = { ...x }; ["id", "importId"].forEach((k) => delete d[k]); return d; } },
};
function mrShareItems() {
  const K = MR_SH[MR.share.kind], B = mrBundle(S.rid);
  const L = (MR.share.kind === "notes" ? S.notes : MR.share.kind === "products" ? S.products : (B && B.suppliers) || []).filter((x) => K.name(x).trim());
  return L.slice().sort((a, b) => K.name(a).localeCompare(K.name(b), "fr"));
}
function mrShareTargets() { const others = mrOthers(); if (!MR.share.to) MR.share.to = new Set(others.map((r) => r.id)); return others.filter((r) => MR.share.to.has(r.id)); }
function mrShareTab() {
  const others = mrOthers(), K = MR_SH[MR.share.kind], items = mrShareItems(), tg = mrShareTargets();
  if (!mrCook()) return `<div class="glass empty st" style="--i:2"><div class="ic">${ico("lock")}</div><b>Réservé au gérant et au chef</b>Ils peuvent copier les recettes, les produits et les fournisseurs d'un restaurant à l'autre.</div>`;
  const kinds = `<div class="chips mr-kinds st" style="--i:2">${Object.entries(MR_SH).map(([k, v]) => `<button class="chip ${MR.share.kind === k ? "on" : ""}" data-act="mrShKind" data-v="${k}">${v.t}</button>`).join("")}</div>`;
  const dests = `<div class="glass pad st" style="--i:3"><div class="lbl">Copier vers</div><div class="mr-dests">${others.map((r, j) => `<button class="mr-dest${MR.share.to.has(r.id) ? " on" : ""}" data-act="mrShTo" data-id="${esc(r.id)}" aria-pressed="${MR.share.to.has(r.id)}">${restoMark(30, r, `<span class="mr-mono sm c${(j + 1) % 4}">${esc(mrIni(r.name))}</span>`)}<span>${esc(r.name)}</span></button>`).join("")}</div></div>`;
  const there = {}; tg.forEach((r) => { const B = mrBundle(r.id); there[r.id] = B ? new Set((B[K.col] || []).map((x) => mrKey(K.name(x)))) : null; });
  /* first look: only what is missing somewhere is ticked (« Tout prendre » ticks the rest, to push an update) */
  if (!MR.share.off[MR.share.kind] && tg.every((r) => there[r.id])) MR.share.off[MR.share.kind] = new Set(items.filter((x) => tg.every((r) => there[r.id].has(mrKey(K.name(x))))).map((x) => x.id));
  const off = MR.share.off[MR.share.kind] || new Set(), sel = items.filter((x) => !off.has(x.id));
  const rows = items.map((x) => {
    const k = mrKey(K.name(x)), on = !off.has(x.id);
    const dots = tg.map((r, j) => { const h = there[r.id]; const has = h && h.has(k); return `<span class="mr-dot${has ? " has" : ""}" title="${esc(r.name)} : ${has ? "déjà là, sera mis à jour" : "nouveau"}">${esc(mrIni(r.name))}</span>`; }).join("");
    return `<button class="mr-it${on ? " on" : ""}" data-act="mrShPick" data-id="${esc(x.id)}" aria-pressed="${on}"><span class="mr-ck">${on ? `<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>` : ""}</span><span class="mr-itx"><b>${esc(K.name(x))}</b>${K.sub(x) ? `<em>${esc(K.sub(x))}</em>` : ""}</span><span class="mr-dots">${dots}</span></button>`;
  }).join("");
  const list = items.length ? `<div class="glass pad st" style="--i:4"><div class="mr-slh"><div class="h3">${K.t} de ${esc(S.resto.name)}</div><button class="btn ghost sm" data-act="mrShAll">${sel.length === items.length ? "Tout retirer" : "Tout prendre"}</button></div>
      <p class="sub" style="margin:0 0 8px">Une pastille pleine : déjà présent là-bas, il sera mis à jour. Vide : il sera ajouté.</p><div class="mr-its">${rows}</div></div>`
    : `<div class="glass empty st" style="--i:4"><div class="ic">${ico(MR.share.kind === "notes" ? "book" : MR.share.kind === "products" ? "box" : "truck")}</div><b>Rien à partager ici</b>${esc(S.resto.name)} n'a pas encore de ${K.t.toLowerCase()}.</div>`;
  const go = items.length ? `<div class="ctabar"><button class="btn acc block" data-act="mrShGo" ${sel.length && tg.length ? "" : "disabled"}>${ico("mrShare")}${sel.length && tg.length ? `Copier ${sel.length} vers ${tg.length === 1 ? esc(tg[0].name) : `${tg.length} restaurants`}` : "Choisissez quoi et où"}</button></div>` : "";
  return `${kinds}${dests}${list}${go}`;
}

/* ───────── the view ───────── */
VIEWS.sites = {
  render() {
    if (typeof alWatch === "function") { try { alWatch(); } catch (e) {} }
    mrWatch();
    const n = S.restos.length;
    if (n < 2) {
      const add = mrMgr() || !n ? `<div class="glass mr-solo st" style="--i:2"><div class="mr-solo-art">${[0, 1, 2].map((i) => `<span class="c${i}">${ico("store")}</span>`).join("")}</div><b class="h2">Plusieurs restaurants ?</b>
        <p class="sub">Comparez-les côte à côte, envoyez du stock de l'un à l'autre avec le lot et la DLC, et partagez vos recettes, votre carte et vos fournisseurs.</p>
        <button class="btn acc block" data-act="mrAdd">${ico("plus")}Ajouter un établissement</button><span class="note">Inclus dans la formule Chef, 49 € HT par restaurant en plus.</span></div>` : "";
      return `<div class="inner narrow mr">${topBar("Mes établissements")}${add}</div>`;
    }
    const inc = mrIncoming().length;
    const tabs = `<div class="seg mr-tabs st" style="--i:1" role="tablist">${[["cmp", "Comparer"], ["tr", "Transferts"], ["sh", "Partager"]].map(([k, l]) => `<button class="${MR.tab === k ? "on" : ""}" data-act="mrTab" data-v="${k}" role="tab" aria-selected="${MR.tab === k}">${l}${k === "tr" && inc ? `<span class="mr-bdg">${inc}</span>` : ""}</button>`).join("")}<span class="knob" style="width:calc(33.333% - 2.67px);transform:translateX(${["cmp", "tr", "sh"].indexOf(MR.tab) * 100}%)"></span></div>`;
    const right = mrMgr() && !MR.send ? `<button class="iconbtn" data-act="mrAdd" aria-label="Ajouter un établissement">${ico("plus")}</button>` : "";
    const body = MR.tab === "tr" ? mrTrTab() : MR.tab === "sh" ? mrShareTab() : mrCmpTab(mrAll());
    return `<div class="inner wide mr mr-${MR.tab}">${topBar(MR.send ? "Nouveau transfert" : "Mes établissements", { right })}${MR.send ? "" : tabs}${body}</div>`;
  },
  after(v) {
    const q = $("#mrQ", v);
    if (q) q.addEventListener("input", () => { const k = mrKey(q.value); $$(".mr-pr", v).forEach((r) => (r.style.display = !k || r.dataset.k.includes(k) ? "" : "none")); });
  },
};

Object.assign(ACT, {
  mrTab: (a, id, v) => { if (MR.tab === v) return; SFX.tick(); MR.tab = v; MR.send = null; rerender(); },
  mrPer: (a, id, v) => { if (MR.per === v) return; SFX.tick(); MR.per = v; rerender(); },
  mrOpen: (a, id) => { if (!id || id === S.rid) return; SFX.tap(); buzz(6); ACT.restoPick(a, id); },
  mrAdd: (a) => { SFX.tap(); ACT.restoSwitch(a); setTimeout(() => { const i = $("#newResto"); if (i) try { i.focus(); } catch (e) {} }, 350); },

  /* transfers */
  mrSendNew: () => { if (!mrCanCross()) { toast("Disponible avec un compte Growth Gusto.", "info"); return; } SFX.tap(); const o = mrOthers(); MR.send = { to: o.length === 1 ? o[0].id : null, lines: [] }; rerender(); },
  mrSendCancel: () => { SFX.close(); MR.send = null; rerender(); },
  mrSendTo: (a, id) => { SFX.tick(); MR.send.to = id; rerender(); },
  mrSendDel: (a, id, v) => { SFX.tick(); MR.send.lines.splice(+v, 1); rerender(); },
  mrSendPick: (a, id) => {
    const p = S.products.find((x) => x.id === id); if (!p) return; SFX.sheet();
    const lots = activeLots().filter((l) => l.productId === p.id || mrKey(l.name) === mrKey(p.name)).sort((x, y) => String(dlcOf(x) || "9").localeCompare(String(dlcOf(y) || "9")));
    const lv = typeof stockLevel === "function" ? (() => { try { return stockLevel(p.id); } catch (e) { return null; } })() : null;
    openSheet(`<div class="h2" style="font-size:20px">${esc(p.name)}</div><p class="sub">${lv != null ? `En stock : ${mrN(Math.max(0, lv))} ${esc(p.unit || "")}. ` : ""}${p.price ? `${mrEur(p.price, 2)} HT / ${esc(p.unit || "u")}` : "Prix d'achat inconnu"}</p>
      <div class="field"><span class="lbl">Quantité (${esc(p.unit || "unités")})</span><input class="input mono" id="mrQty" inputmode="decimal" placeholder="0" value="${p.step && p.step < 1 ? "1" : "1"}"></div>
      ${lots.length ? `<div class="field"><span class="lbl">Lot (traçabilité)</span><div class="mr-lots">${lots.map((l, i) => `<button class="mr-lot${i === 0 ? " on" : ""}" data-act="mrLotPick" data-id="${esc(l.id)}"><b>${esc(l.lot || "Sans n°")}</b><em>DLC ${dlcOf(l) ? shortDate(dlcOf(l)) : "?"}${l.qty ? ` · ${mrN(l.qty)} ${esc(l.unit || "")}` : ""}</em></button>`).join("")}<button class="mr-lot" data-act="mrLotPick" data-id=""><b>Sans lot</b><em>Produit sec, vrac</em></button></div></div>` : ""}
      <button class="btn acc block" data-act="mrSendAdd" data-id="${esc(p.id)}">${ico("plus")}Ajouter au transfert</button>`, (b) => { const i = $("#mrQty", b); if (i) setTimeout(() => { try { i.focus(); i.select(); } catch (e) {} }, 300); });
  },
  mrLotPick: (a) => { SFX.tick(); $$(".mr-lot", a.parentNode).forEach((x) => x.classList.toggle("on", x === a)); },
  mrSendAdd: (a, id) => {
    const p = S.products.find((x) => x.id === id); const q = num(($("#mrQty") || {}).value); if (!p) return;
    if (!(q > 0)) { SFX.err(); const i = $("#mrQty"); if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); } return; }
    const lb = $(".mr-lot.on"), lot = lb && lb.dataset.id ? S.lots.find((l) => l.id === lb.dataset.id) : null;
    MR.send.lines.push({ productId: p.id, name: p.name, qty: Math.round(q * 1000) / 1000, unit: p.unit || "", price: +p.price || 0, ...(lot ? { lotId: lot.id, lot: lot.lot || "", dlc: dlcOf(lot) || "", fridgeId: lot.fridgeId || "" } : {}) });
    closeSheet(true); SFX.ok(); buzz(6); rerender();
  },
  mrSendGo: async (a) => {
    const D = MR.send; if (!D || !D.to || !D.lines.length || MR.busy) return; MR.busy = true; a.disabled = true;
    const to = mrResto(D.to), id = mrNewId(), now = Date.now();
    const no = `TR-${dayKey().slice(2).replace(/-/g, "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const t = { no, from: { rid: S.rid, name: S.resto.name }, to: { rid: to.id, name: to.name }, lines: D.lines, value: Math.round(D.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.price || 0), 0) * 100) / 100, status: "envoye", sentAt: now, sentBy: S.me.name || "", sentUid: S.me.id };
    try {
      await safe(mrPut(S.rid, "transfers", id, t)); await mrPut(to.id, "transfers", id, t);
      for (const l of D.lines) {
        if (typeof stockMove === "function") await stockMove({ productId: l.productId, name: l.name, qty: -l.qty, unit: l.unit, kind: "site", ref: id, refType: "transfer", toRid: to.id, toName: to.name, lotId: l.lotId || undefined, value: Math.round(l.qty * l.price * 100) / 100, noLog: true }).catch(() => {});
        const lt = l.lotId && S.lots.find((x) => x.id === l.lotId);
        if (lt) { const left = Math.round(((num(lt.qty) || 0) - l.qty) * 1000) / 1000; await DB.update("lots", lt.id, left > 0 ? { qty: left } : { status: "out", outAt: now, outBy: S.me.id, outReason: `Transféré à ${to.name}` }).catch(() => {}); }
      }
      logEvent("transfer", `a envoyé ${D.lines.length} produit${D.lines.length > 1 ? "s" : ""} ${mrA(to.name)} (${no})`, { ref: id });
      MR.send = null; MR.tab = "tr"; SFX.done(); burst(); toast(`Transfert ${no} envoyé ${mrA(to.name)}`); rerender();
    } catch (e) { a.disabled = false; } finally { MR.busy = false; }
  },
  mrTrOpen: (a, id) => {
    const t = MR.tr.find((x) => x.id === id); if (!t) return; SFX.sheet();
    const out = t.from.rid === S.rid, [tx, tn] = MR_ST[t.status] || MR_ST.envoye;
    openSheet(`<div class="mr-tsh"><div class="mr-tshh"><div><div class="h2" style="font-size:20px">${esc(t.no || "Transfert")}</div><div class="sub">${esc(t.from.name)} → ${esc(t.to.name)}</div></div><span class="pill ${tn}">${tx}</span></div>
      ${(t.lines || []).map((l) => `<div class="li"><div class="tx"><b>${esc(l.name)}</b><em>${l.lot ? `Lot ${esc(l.lot)}` : "Sans lot"}${l.dlc ? ` · DLC ${shortDate(l.dlc)}` : ""}</em></div><b class="mono">${mrN(l.qty)} ${esc(l.unit || "")}</b></div>`).join("")}
      <div class="mr-tmeta"><div><em>Valeur HT</em><b class="mono">${mrEur(t.value, 2)}</b></div><div><em>Envoyé</em><b>${when(t.sentAt)}${t.sentBy ? ` · ${esc(firstName(t.sentBy))}` : ""}</b></div>${t.recvAt ? `<div><em>Reçu</em><b>${when(t.recvAt)}${t.recvBy ? ` · ${esc(firstName(t.recvBy))}` : ""}${t.temp != null && t.temp !== "" ? ` · ${esc(String(t.temp).replace(".", ","))} °C` : ""}</b></div>` : ""}</div>
      ${!out && t.status === "envoye" ? `<button class="btn acc block" data-act="mrRecv" data-id="${esc(t.id)}">${ico("truck")}Réceptionner</button>` : ""}
      <button class="btn soft block" data-act="mrTrPrint" data-id="${esc(t.id)}">${ico("printer")}Imprimer le bon</button>
      ${out && t.status === "envoye" ? `<button class="btn ghost block" data-act="mrTrCancel" data-id="${esc(t.id)}">Annuler le transfert</button>` : ""}</div>`);
  },
  mrTrPrint: (a, id) => { const t = MR.tr.find((x) => x.id === id); if (!t) return; SFX.print(); mrPrint(mrTrHTML(t)); },
  mrRecv: (a, id) => {
    const t = MR.tr.find((x) => x.id === id); if (!t) return; SFX.sheet();
    const cold = (t.lines || []).some((l) => { const p = S.products.find((x) => x.id === l.productId || mrKey(x.name) === mrKey(l.name)); return !p || /froid|cong|frigo/i.test(p.zone || "") || !!l.dlc; });
    openSheet(`<div class="h2" style="font-size:20px">Réceptionner ${esc(t.no || "")}</div><p class="sub">Envoyé par ${esc(t.from.name)}. Décochez ce qui manque.</p>
      <div class="mr-rl">${(t.lines || []).map((l, i) => `<button class="mr-it on" data-act="mrRecvLine" data-v="${i}" aria-pressed="true"><span class="mr-ck"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span><span class="mr-itx"><b>${esc(l.name)}</b><em>${mrN(l.qty)} ${esc(l.unit || "")}${l.lot ? ` · lot ${esc(l.lot)}` : ""}${l.dlc ? ` · DLC ${shortDate(l.dlc)}` : ""}</em></span></button>`).join("")}</div>
      ${cold ? `<div class="field"><span class="lbl">Température à l'arrivée (°C)</span><input class="input mono" id="mrTemp" inputmode="decimal" placeholder="ex. 3,5"></div>` : ""}
      <button class="btn acc block" data-act="mrRecvOk" data-id="${esc(t.id)}">${ico("check")}Tout est rangé</button>`);
  },
  mrRecvLine: (a) => { SFX.tick(); const on = !a.classList.contains("on"); a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); $(".mr-ck", a).innerHTML = on ? `<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>` : ""; },
  mrRecvOk: async (a, id) => {
    const t = MR.tr.find((x) => x.id === id); if (!t || MR.busy) return;
    const keep = $$(".mr-rl .mr-it").map((b) => b.classList.contains("on")); const tempS = ($("#mrTemp") || {}).value || ""; const temp = tempS.trim() ? num(tempS) : null;
    if (tempS.trim() && temp == null) { SFX.err(); toast("Température illisible", "err"); return; }
    MR.busy = true; a.disabled = true; const now = Date.now();
    try {
      const lines = (t.lines || []).map((l, i) => (keep[i] === false ? { ...l, missing: true } : l)), got = lines.filter((l) => !l.missing);
      const fr = S.fridges.find((f) => f.role === "stock") || S.fridges[0];
      for (const l of got) {
        let p = S.products.find((x) => x.id === l.productId) || S.products.find((x) => mrKey(x.name) === mrKey(l.name));
        if (!p) { const pid = mrNewId(); await DB.set("products", pid, { name: l.name, unit: l.unit || "", price: +l.price || 0, createdAt: now, sharedFrom: { rid: t.from.rid, name: t.from.name, at: now } }).catch(() => {}); p = { id: pid, name: l.name, unit: l.unit }; }
        if (typeof stockMove === "function") await stockMove({ productId: p.id, name: l.name, qty: l.qty, unit: l.unit, kind: "site", ref: t.id, refType: "transfer", fromRid: t.from.rid, fromName: t.from.name, value: Math.round(l.qty * l.price * 100) / 100, noLog: true }).catch(() => {});
        if (l.lot || l.dlc) await DB.add("lots", { name: l.name, productId: p.id, qty: l.qty, unit: l.unit || "", lot: l.lot || "", dlc: l.dlc || "", supplier: t.from.name, fridgeId: fr ? fr.id : "", status: "in", receivedTemp: temp, code: "GG-" + rid6(), createdAt: now, uid: S.me.id, transferId: t.id }).catch(() => {});
      }
      const val = Math.round(got.reduce((s, l) => s + (+l.qty || 0) * (+l.price || 0), 0) * 100) / 100;
      const patch = { status: "recu", recvAt: now, recvBy: S.me.name || "", recvUid: S.me.id, lines, value: val, ...(temp != null ? { temp } : {}) };
      await safe(mrPut(S.rid, "transfers", t.id, patch, true)); await mrPut(t.from.rid, "transfers", t.id, patch, true).catch(() => {});
      logEvent("transfer", `a réceptionné le transfert ${t.no} de ${t.from.name}${temp != null ? ` (${String(temp).replace(".", ",")} °C)` : ""}`, { ref: t.id });
      closeSheet(true); SFX.done(); burst(); toast(got.length < lines.length ? `Reçu, ${lines.length - got.length} produit${lines.length - got.length > 1 ? "s" : ""} manquant${lines.length - got.length > 1 ? "s" : ""} noté${lines.length - got.length > 1 ? "s" : ""}` : "Transfert réceptionné"); rerender();
    } catch (e) { a.disabled = false; } finally { MR.busy = false; }
  },
  mrTrCancel: async (a, id) => {
    const t = MR.tr.find((x) => x.id === id); if (!t || t.status !== "envoye" || MR.busy) return; MR.busy = true;
    try {
      for (const l of t.lines || []) if (typeof stockMove === "function") await stockMove({ productId: l.productId, name: l.name, qty: l.qty, unit: l.unit, kind: "site", ref: t.id, refType: "transfer", fromRid: t.to.rid, fromName: `${t.to.name} (annulé)`, noLog: true }).catch(() => {});
      const patch = { status: "annule", cancelAt: Date.now(), cancelBy: S.me.name || "" };
      await safe(mrPut(S.rid, "transfers", t.id, patch, true)); await mrPut(t.to.rid, "transfers", t.id, patch, true).catch(() => {});
      logEvent("transfer", `a annulé le transfert ${t.no}`, { ref: t.id }); closeSheet(true); SFX.ok(); toast("Transfert annulé, le stock est revenu"); rerender();
    } finally { MR.busy = false; }
  },

  /* sharing */
  mrShKind: (a, id, v) => { if (MR.share.kind === v) return; SFX.tick(); MR.share.kind = v; rerender(); },
  mrShTo: (a, id) => { SFX.tick(); mrShareTargets(); const s = MR.share.to; s.has(id) ? s.delete(id) : s.add(id); rerender(); },
  mrShPick: (a, id) => { SFX.tick(); const off = (MR.share.off[MR.share.kind] ||= new Set()); off.has(id) ? off.delete(id) : off.add(id); rerender(); },
  mrShAll: () => { SFX.tick(); const items = mrShareItems(), off = (MR.share.off[MR.share.kind] ||= new Set()); if (off.size === 0) items.forEach((x) => off.add(x.id)); else off.clear(); rerender(); },
  mrShGo: async (a) => {
    if (MR.busy) return; if (!mrCanCross()) { toast("Disponible avec un compte Growth Gusto.", "info"); return; }
    const K = MR_SH[MR.share.kind], off = MR.share.off[MR.share.kind] || new Set(), items = mrShareItems().filter((x) => !off.has(x.id)), tg = mrShareTargets();
    if (!items.length || !tg.length) return;
    const miss = tg.filter((r) => !mrBundle(r.id)); if (miss.length) { toast("Un instant, les restaurants se chargent…", "info"); return; }
    MR.busy = true; a.disabled = true; const now = Date.now(); let nNew = 0, nUp = 0;
    try {
      for (const r of tg) {
        const ex = {}; (mrBundle(r.id)[K.col] || []).forEach((x) => { ex[mrKey(K.name(x))] = x; if (x.sharedFrom && x.sharedFrom.rid === S.rid && x.sharedFrom.id) ex["#" + x.sharedFrom.id] = x; });
        for (const x of items) {
          const cur = ex["#" + x.id] || ex[mrKey(K.name(x))], d = { ...K.copy(x), sharedFrom: { rid: S.rid, id: x.id, name: S.resto.name, at: now } };
          if (cur) { await mrPut(r.id, K.col, cur.id, { ...d, updatedAt: now }, true); nUp++; } else { await mrPut(r.id, K.col, mrNewId(), { ...d, createdAt: now, at: now, updatedAt: now, uid: S.me.id }); nNew++; }
        }
      }
      const w = K.t.toLowerCase(), names = tg.map((r) => r.name).join(", ");
      logEvent("team", `a partagé ${items.length} ${MR.share.kind === "notes" ? "recette" + (items.length > 1 ? "s" : "") : MR.share.kind === "products" ? "produit" + (items.length > 1 ? "s" : "") : "fournisseur" + (items.length > 1 ? "s" : "")} avec ${names}`);
      SFX.done(); burst(); toast(`${items.length} copié${items.length > 1 ? "s" : ""} vers ${tg.length === 1 ? tg[0].name : tg.length + " restaurants"}${nNew ? ` · ${nNew} ajout${nNew > 1 ? "s" : ""}` : ""}${nUp ? ` · ${nUp} mis à jour` : ""}`); void w; rerender();
    } catch (e) { console.warn("mr share", e); SFX.err(); toast("La copie n'a pas pu se terminer. Réessayez.", "err"); a.disabled = false; } finally { MR.busy = false; }
  },
});

/* ───────── one-tap switch: the Établissements sheet shows each restaurant's day ───────── */
(function mrSwitchSheet() {
  const sw0 = ACT.restoSwitch; if (!sw0 || sw0._mr) return;
  ACT.restoSwitch = async function () {
    const r = await sw0.apply(this, arguments);
    if (S.restos.length < 2 || !$("#sheet").classList.contains("open")) return r;
    const b = $("#sheetBody"); if (!b || $(".mr-swx", b)) return r;
    const y = addDays(dayKey(), -1), today = dayKey(), mgr = mrMgr();
    $$('[data-act="restoPick"]', b).forEach((li) => {
      const mo = $(".cc-mono", li); if (mo) mo.textContent = mrIni(mrResto(li.dataset.id).name);
      const st = mrStats(mrBundle(li.dataset.id), y, today); const em = $(".tx em", li); if (!st || !em) return;
      const bits = [mgr && st.ht ? `Hier ${mrEur(st.ht)}` : "", st.exp ? `Relevés ${st.done}/${st.exp}` : "", st.late ? `${st.late} DLC` : ""].filter(Boolean);
      if (bits.length) em.textContent = (li.dataset.id === S.rid ? "Ici · " : "") + bits.join(" · ");
    });
    const h = $(".h2", b);
    if (h) h.insertAdjacentHTML("afterend", `<button class="mr-swx" data-go="sites">${ico("mrCmp")}<span><b>Vue d'ensemble</b><em>Comparer, transférer, partager entre les ${S.restos.length} restaurants</em></span>${ico("chev")}</button>`);
    return r;
  };
  ACT.restoSwitch._mr = true;
})();
/* after a switch, the comparison follows: the transfer list of the new restaurant, a fresh read of the others */
window.addEventListener("gg:ready", () => { MR.cache = {}; });

/* ───────── demo: two sister restaurants of the same owner (called by js/demo.js) ───────── */
function mrDemoSisters(D, RID, rnd) {
  const today = dayKey(), now = Date.now(), r2 = (v) => Math.round(v * 100) / 100, base = `restos/${RID}/`;
  const SIS = [
    { rid: "demo2", name: "Le Comptoir Démo", type: "bar", city: "Lyon 4e", k: 0.6, food: 1.2, waste: 2.6, bad: 0.07, notes: 0.5, drop: ["demo-lucas", "demo-hugo"], age: 160,
      names: [["Thomas Girard", "Julien Morel"], ["Inès Benali", "Léa Fontaine"], ["Lucas Petit", "Nathan Roux"], ["Sarah Lemoine", "Chloé Vidal"], ["Hugo Martin", "Yanis Bernard"]] },
    { rid: "demo3", name: "La Cantine du Port", type: "brasserie", city: "Lyon 7e", k: 1.4, food: 0.9, waste: 0.5, bad: 0, notes: 1, drop: [], age: 80,
      names: [["Thomas Girard", "Karim Haddad"], ["Inès Benali", "Manon Leroy"], ["Lucas Petit", "Théo Garnier"], ["Sarah Lemoine", "Emma Faure"], ["Hugo Martin", "Louis Chevalier"]] },
  ];
  const SKIP = new Set(["bank", "bankTx", "feedback", "chat", "csReads", "consignes", "transfers"]);
  const cols = Object.keys(D).filter((k) => k.startsWith(base)).map((k) => k.slice(base.length));
  SIS.forEach((c) => {
    const P = (col) => `restos/${c.rid}/${col}`;
    D.restos[c.rid] = { name: c.name, type: c.type, city: c.city, owner: "demo-camille", plan: "essai", createdAt: now - c.age * 864e5, demo: true };
    cols.forEach((col) => {
      if (SKIP.has(col)) return;
      let s = JSON.stringify(D[base + col]); c.names.forEach(([a, b]) => { s = s.split(a).join(b); }); s = s.split("Le Bistrot Démo").join(c.name);
      const o = JSON.parse(s);
      Object.keys(o).forEach((id) => {
        const x = o[id];
        const gone = (col === "members" && c.drop.includes(id)) || (col === "staff" && c.drop.includes(x.memberId)) || ((col === "shifts" || col === "punches") && c.drop.some((m) => x.staffId === "s_" + m));
        if (gone) { delete o[id]; return; }
        if (col === "tickets") { const f = c.k * (0.88 + rnd() * 0.24); ["total", "ht"].forEach((k) => { if (x[k] != null) x[k] = r2(x[k] * f); }); if (x.covers) x.covers = Math.max(1, Math.round(x.covers * f)); (x.vat || []).forEach((v) => ["ttc", "ht", "tva"].forEach((k) => { if (v[k] != null) v[k] = r2(v[k] * f); })); (x.lines || []).forEach((l) => { l.quantite = Math.max(0, Math.round((l.quantite || 0) * f)); if (l.montant != null) l.montant = r2(l.montant * f); }); }
        if (col === "expenses") x.amountHT = r2((+x.amountHT || 0) * (x.cat === "achats" ? c.k * c.food * (0.92 + rnd() * 0.16) : c.k > 1 ? 1.25 : 0.75));
        if (col === "moves") { if (x.kind === "perte") x.qty = r2((+x.qty || 0) * c.waste); else if (x.kind === "vente") x.qty = r2((+x.qty || 0) * c.k); }
        if (col === "readings") {
          const fr = (D[base + "fridges"] || {})[x.fridgeId] || {};
          if (c.bad && rnd() < c.bad) { x.value = r2((fr.max != null ? fr.max : 4) + 1.4 + rnd() * 2.2); x.ok = false; x.action = "Porte mal fermée, refermée"; }
          else if (!c.bad && x.ok === false) { x.value = r2(((+fr.min || 0) + (+fr.max || 4)) / 2); x.ok = true; x.action = ""; }
        }
        if (col === "lots" && !c.bad && x.dlc && dlcOf(x) < today && (x.status === "in" || x.status === "opened")) x.status = "out";
        if (col === "notes" && c.notes < 1 && !x.carte && rnd() > c.notes) { delete o[id]; return; }
        if (col === "notes" && c.notes >= 1) x.sharedFrom = { rid: RID, id, name: "Le Bistrot Démo", at: now - 20 * 864e5 };
      });
      D[P(col)] = o;
    });
    /* the bar throws more away: a few extra losses over the month */
    if (c.waste > 1) { const PR = D[base + "products"] || {}; const ks = ["p-creme", "p-champi", "p-citron", "p-jambon", "p-lait", "p-terrine"].filter((k) => PR[k]); for (let i = 0; i < 14; i++) { const k = ks[i % ks.length], p = PR[k]; const day = addDays(today, -(1 + Math.floor(rnd() * 27))); (D[P("moves")] ||= {})["mrw" + i] = { productId: k, name: p.name, qty: -r2(1.2 + rnd() * 2.6), unit: p.unit, kind: "perte", reason: ["DLC dépassée", "Abîmé", "Surproduction"][i % 3], at: parseDay(day).getTime() + 22 * 36e5, uid: "demo-ines", by: "Léa Fontaine" }; } }
  });
  /* three transfers between them: two done, one on its way to La Cantine (to receive in the demo) */
  const PR = D[base + "products"] || {}, line = (k, qty, lot, dlcIn) => { const p = PR[k] || {}; return { productId: k, name: p.name || k, qty, unit: p.unit || "", price: +p.price || 0, ...(lot ? { lot, dlc: addDays(today, dlcIn) } : {}) }; };
  const R = { demo: "Le Bistrot Démo", demo2: "Le Comptoir Démo", demo3: "La Cantine du Port" };
  const TR = [
    ["trd1", "demo", "demo2", [line("p-jambon", 2, "J2291", 4), line("p-creme", 2, "C7710", 6)], now - 3 * 864e5 - 5 * 36e5, now - 3 * 864e5 - 3 * 36e5, "recu", 3.4, "Camille Laurent", "Julien Morel"],
    ["trd2", "demo3", "demo", [line("p-frites", 5, "F2291", 150), line("p-beurre", 1, "B4410", 12)], now - 864e5 - 6 * 36e5, now - 864e5 - 4 * 36e5, "recu", -18.6, "Karim Haddad", "Thomas Girard"],
    ["trd3", "demo", "demo3", [line("p-paleron", 3, "PA0912", 5), line("p-lardons", 1.5, "L5530", 9)], now - 2 * 36e5, null, "envoye", null, "Thomas Girard", ""],
  ];
  TR.forEach(([id, f, t, lines, sentAt, recvAt, status, temp, sentBy, recvBy], i) => {
    const doc = { no: `TR-${dayKey(new Date(sentAt)).slice(2).replace(/-/g, "")}-${310 + i * 7}`, from: { rid: f, name: R[f] }, to: { rid: t, name: R[t] }, lines, value: r2(lines.reduce((s, l) => s + l.qty * l.price, 0)), status, sentAt, sentBy, sentUid: "demo-camille", ...(recvAt ? { recvAt, recvBy, recvUid: "demo-thomas", temp } : {}) };
    [f, t].forEach((rid) => { (D[`restos/${rid}/transfers`] ||= {})[id] = JSON.parse(JSON.stringify(doc)); });
    lines.forEach((l, j) => {
      (D[`restos/${f}/moves`] ||= {})[`${id}o${j}`] = { productId: l.productId, name: l.name, qty: -l.qty, unit: l.unit, kind: "site", ref: id, refType: "transfer", toRid: t, toName: R[t], value: r2(l.qty * l.price), at: sentAt, uid: "demo-camille", by: sentBy };
      if (recvAt) (D[`restos/${t}/moves`] ||= {})[`${id}i${j}`] = { productId: l.productId, name: l.name, qty: l.qty, unit: l.unit, kind: "site", ref: id, refType: "transfer", fromRid: f, fromName: R[f], value: r2(l.qty * l.price), at: recvAt, uid: "demo-thomas", by: recvBy };
    });
  });
}
