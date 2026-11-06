/* Growth Gusto — area: gaspillage (route « gaspillage », replaces the simple list of js/hygiene.js). Prefix « gp ».
   Every loss in euros, from wherever it was noted, without double counting:
     · waste/{id}   (js/hygiene.js, kept and extended here) { name, productId?, noteId?, lotId?, qty, unit, reason, cost, kind:"perte"|"invendu",
                    service:"midi"|"soir", moveId?, month, day, at, uid, by }
     · moves (kind « perte », js/stock.js « Perte / casse »), unless a waste doc already points to it,
     · lots thrown away from their label (js/labels.js, status « lost »), unless a waste doc already points to it.
   Products thrown away also leave the stock (a « perte » move). Unsold dishes (« invendus ») are valued at their recipe cost
   (mgDishCost from js/marge.js when present, else ingredients × purchase price); they do not touch the stock, their ingredients
   already left it when the dish was made.
   Shows: the month in euros and as a share of purchases, the yearly projection, what to throw now (lots past their DLC),
   money-saving leads (product, dish × weekday, cause), breakdowns, a journal and a CSV export.
   Exposed: gpEntries(fromMs, toMs) → normalized entries (read by js/achats.js to order less of what is often thrown away),
            gpMonthCost(monthKey) → € HT. */
"use strict";

TAB_OF.gaspillage = "more";
Object.assign(IC, {
  gpBin: ["M4 6.5h16", "M9.5 6.5V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2", "M6 6.5l1 13a1.6 1.6 0 0 0 1.6 1.5h6.8a1.6 1.6 0 0 0 1.6-1.5l1-13", "f:M6 6.5h12l-1 13a1.6 1.6 0 0 1-1.6 1.5H8.6A1.6 1.6 0 0 1 7 19.5z", "M10 10.5v6.5", "M14 10.5v6.5"],
  gpPlate: ["c:12,13,7.5", "f:M12 5.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z", "c:12,13,4", "M3 4v4.5a2 2 0 0 0 2 2", "M5 4v16", "M21 4c-1.7 0-2.5 1.6-2.5 4.5V11H21", "M21 4v16"],
  gpLeaf: ["M5 20c0-8.5 5.5-14.5 15-16-.5 9.5-6.5 15-15 16z", "f:M5 20c0-8.5 5.5-14.5 15-16-.5 9.5-6.5 15-15 16z", "M5 20l7.5-7.5"],
  gpSpark: ["M12 3.5l1.9 5.4 5.6 1.6-5.6 1.6L12 17.5l-1.9-5.4-5.6-1.6 5.6-1.6z", "f:M12 3.5l1.9 5.4 5.6 1.6-5.6 1.6L12 17.5l-1.9-5.4-5.6-1.6 5.6-1.6z", "M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],
  gpCrack: ["M8 3.5h8l3.5 6-7.5 11-7.5-11z", "f:M8 3.5h8l3.5 6-7.5 11-7.5-11z", "M10.5 3.5l1.5 4-2 2.5 2 3"],
  gpChef: ["f:M7 13.5h10V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19z", "M7 13.5a4 4 0 0 1-1.2-7.8A4.5 4.5 0 0 1 12 3.6a4.5 4.5 0 0 1 6.2 2.1A4 4 0 0 1 17 13.5", "M7 13.5V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19v-5.5", "M7 17h10"],
  gpStack: ["M4 8.5 12 4.5l8 4-8 4z", "f:M4 8.5 12 4.5l8 4-8 4z", "m4 12.5 8 4 8-4", "m4 16.5 8 4 8-4"],
  gpBack: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  gpBell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "f:M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  gpDl: ["M12 4v11", "m7 10 5 5 5-5", "M5 20h14"],
});
(function gpNav() { if (NAV.some((n) => n[0] === "gaspillage")) return; const i = NAV.findIndex((n) => n[0] === "hygiene"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["gaspillage", "gpBin", "Gaspillage"]); })();
try { if (typeof PM_ROUTE !== "undefined") PM_ROUTE.gaspillage = PM_ROUTE.gaspillage || "stock"; } catch (e) {}

/* causes: [label, icon, colour]. The first five are js/hygiene.js's (same keys), two more for the kitchen. */
const GP_R = {
  dlc: ["DLC dépassée", "clock", "#C8432A"],
  abime: ["Abîmé", "alert", "#E08A12"],
  casse: ["Casse, chute", "gpCrack", "#8A5A2B"],
  surprod: ["Surproduction", "gpStack", "#5B2BFF"],
  prep: ["Raté en cuisine", "gpChef", "#C2337A"],
  retour: ["Retour client", "gpBack", "#2F6FD8"],
  rappel: ["Rappel produit", "gpBell", "#1B1530"],
};
try { if (typeof HY_R !== "undefined") { Object.entries(GP_R).forEach(([k, v]) => { if (!HY_R[k]) HY_R[k] = v; }); } } catch (e) {}
const GP_UNITS = ["kg", "g", "L", "cl", "pièce", "portion"];
const gpEur = (n, d) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d ?? (Math.abs(n) >= 100 ? 0 : 2), maximumFractionDigits: d ?? (Math.abs(n) >= 100 ? 0 : 2) }) + " €");
const gpN = (n) => (n == null || isNaN(n) ? "–" : String(Math.round(n * 100) / 100).replace(".", ","));
const gpU = (q, u) => (typeof stkU === "function" ? stkU(q, u) : u === "pièce" && q >= 2 ? "pièces" : u === "portion" && q >= 2 ? "portions" : u || "");
const gpPl = (n, s, p) => `${n} ${n > 1 ? p || s + "s" : s}`;
const gpMoney = () => { try { return typeof PERMS === "undefined" || !PERMS.cap ? true : PERMS.cap("seeMoney") !== false; } catch (e) { return true; } };
const gpKey = (s) => (typeof stkNorm === "function" ? stkNorm(s) : String(s || "").toLowerCase()).trim();
const gpConv = (q, f, t) => (typeof acConv === "function" ? acConv(q, f, t) : f === t ? q : null);
const gpPrice = (p) => (typeof acPrice === "function" ? acPrice(p) : p && p.price > 0 ? +p.price : null);
const gpProd = (id, name) => (id && S.products.find((p) => p.id === id)) || (name ? S.products.find((p) => gpKey(p.name) === gpKey(name)) : null) || null;
const gpWaste = () => (typeof hyArr === "function" ? hyArr("waste") : []);
function gpReasonOf(txt) {
  const t = gpKey(txt); if (!t) return "abime"; if (GP_R[txt]) return txt;
  if (/dlc|date|perime/.test(t)) return "dlc"; if (/casse|tombe|chute|contamin/.test(t)) return "casse"; if (/surprod|trop|reste|invendu/.test(t)) return "surprod";
  if (/rate|brule|erreur|cuisson/.test(t)) return "prep"; if (/retour|client/.test(t)) return "retour"; if (/rappel/.test(t)) return "rappel"; return "abime";
}
/* cost of `qty unit` of a product */
function gpCost(p, qty, unit) { if (!p || !(qty > 0)) return null; const pr = gpPrice(p); if (!(pr > 0)) return null; const q = gpConv(qty, unit || p.unit, p.unit); return q == null ? null : Math.round(q * pr * 100) / 100; }
/* cost of one portion of a dish */
function gpDishCost(n) {
  if (!n) return null;
  if (typeof mgDishCost === "function") {
    try { const r = mgDishCost(n.id); const v = r && typeof r === "object" ? (r.perPortion ?? r.portion ?? r.unit ?? (r.total != null && r.portions ? r.total / r.portions : r.cost)) : r; if (v > 0) return Math.round(v * 100) / 100; } catch (e) {}
  }
  const por = Math.max(1, +n.portions || 1); let c = 0, any = false;
  (n.ingredients || []).forEach((g) => { const p = gpProd(g.productId, g.name); const v = p ? gpCost(p, num(g.qty), g.unit) : null; if (v != null) { c += v; any = true; } });
  return any ? Math.round((c / por) * 100) / 100 : null;
}

/* ───────── every loss, normalized ───────── */
let gpIx = null;
function gpAll() {
  const W = gpWaste();
  if (gpIx && gpIx.w === W && gpIx.m === S.moves && gpIx.l === S.lots && gpIx.p === S.products) return gpIx.list;
  const out = []; const moveIds = new Set(), lotIds = new Set();
  W.forEach((w) => {
    if (w.moveId) moveIds.add(w.moveId); if (w.lotId) lotIds.add(w.lotId);
    const p = gpProd(w.productId, w.kind === "invendu" ? "" : w.name);
    const cost = w.cost > 0 ? +w.cost : w.kind !== "invendu" ? gpCost(p, +w.qty || 0, w.unit) : null;
    out.push({ id: w.id, src: "waste", kind: w.kind === "invendu" ? "invendu" : "perte", name: w.name || "Produit", productId: w.productId || (p && p.id) || "", noteId: w.noteId || "", qty: +w.qty || 0, unit: w.unit || "", reason: GP_R[w.reason] ? w.reason : gpReasonOf(w.reason), cost, at: w.at || 0, day: w.day || (w.at ? dayKey(new Date(w.at)) : ""), by: w.by || "", uid: w.uid || "", service: w.service || "" });
  });
  (S.moves || []).forEach((m) => {
    if (m.kind !== "perte" || moveIds.has(m.id) || m.refType === "waste") return; const p = gpProd(m.productId, m.name); const q = Math.abs(+m.qty || 0);
    out.push({ id: m.id, src: "move", kind: "perte", name: m.name || (p && p.name) || "Produit", productId: (p && p.id) || "", qty: q, unit: m.unit || (p && p.unit) || "", reason: gpReasonOf(m.reason), cost: m.value > 0 ? +m.value : gpCost(p, q, m.unit), at: m.at || 0, day: m.at ? dayKey(new Date(m.at)) : "", by: m.by || "", uid: m.uid || "" });
  });
  S.lots.forEach((l) => {
    if (l.status !== "lost" || l.test || lotIds.has(l.id) || !l.outAt) return; const p = gpProd(l.productId, l.name); const q = num(l.qty) || 0;
    out.push({ id: l.id, src: "lot", kind: "perte", name: l.name || "Produit", productId: (p && p.id) || "", qty: q, unit: l.unit || "", reason: gpReasonOf(l.lostReason), cost: gpCost(p, q, l.unit), at: l.outAt, day: dayKey(new Date(l.outAt)), by: "", uid: l.outBy || "" });
  });
  out.sort((a, b) => b.at - a.at);
  gpIx = { w: W, m: S.moves, l: S.lots, p: S.products, list: out }; return out;
}
function gpEntries(from = 0, to = Infinity) { return gpAll().filter((e) => e.at >= from && e.at < to); }
const gpMonthRange = (m) => { const [y, mo] = m.split("-").map(Number); return [new Date(y, mo - 1, 1).getTime(), new Date(y, mo, 1).getTime()]; };
const gpOfMonth = (m) => { const [a, b] = gpMonthRange(m); return gpEntries(a, b); };
const gpSum = (L) => Math.round(L.reduce((a, e) => a + (e.cost > 0 ? e.cost : 0), 0) * 100) / 100;
function gpMonthCost(m = monthKey()) { return gpSum(gpOfMonth(m)); }
/* purchases of a month: received goods × their price (js/marge.js invoices win when it is there) */
function gpBuys(m) {
  if (typeof mgPurchases === "function") { try { const v = mgPurchases(m); if (v > 0) return v; } catch (e) {} }
  const [a, b] = gpMonthRange(m); let t = 0;
  S.lots.forEach((l) => { if (l.test || !l.createdAt || l.createdAt < a || l.createdAt >= b || l.supplier === "Fait maison") return; const p = gpProd(l.productId, l.name); const v = gpCost(p, num(l.qty) || 0, l.unit); if (v) t += v; });
  return Math.round(t);
}
const gpShift = (m, k) => { const [y, mo] = m.split("-").map(Number); return monthKey(new Date(y, mo - 1 + k, 1)); };
const gpMonthName = (m) => MONTHS[+m.split("-")[1] - 1];
const GP_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const GP_DOW = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/* demo (in memory only): eight weeks of unsold dishes, with a pattern worth finding (too much bourguignon on Tuesdays) */
const GP_SEEDED = {};
async function gpSeedDemo() {
  if (DB.mode !== "demo" || !S.rid || GP_SEEDED[S.rid] || typeof HY === "undefined" || !HY.seeded[S.rid] || HY.waste == null) return;
  GP_SEEDED[S.rid] = true; if (gpWaste().some((w) => w.kind === "invendu")) return;
  const note = (t) => S.notes.find((n) => (n.title || "").toLowerCase().includes(t)); const today = dayKey();
  const plan = [["bourguignon", 2, [3, 5, 4, 6, 4, 5, 3, 4], "soir"], ["croquettes", 6, [5, 0, 5, 0, 0, 5, 0, 0], "soir"], ["planche", 5, [1, 2, 0, 1, 2, 1, 0, 1], "midi"], ["bourguignon", 4, [1, 0, 2, 1, 0, 1, 1, 0], "midi"]];
  for (const [t, wday, qs, svc] of plan) {
    const n = note(t); if (!n) continue; const c = gpDishCost(n);
    for (let wk = 0; wk < qs.length; wk++) {
      const q = qs[wk]; if (!q) continue; let d = parseDay(today); d.setDate(d.getDate() - ((d.getDay() - wday + 7) % 7 || 7) - wk * 7); const k = dayKey(d); d.setHours(svc === "soir" ? 23 : 15, 10 + wk, 0, 0);
      await DB.add("waste", { kind: "invendu", name: n.title, noteId: n.id, qty: q, unit: "portion", reason: "surprod", service: svc, cost: c ? Math.round(c * q * 100) / 100 : null, at: d.getTime(), day: k, month: k.slice(0, 7), uid: "demo-ines", by: "Inès Benali" }).catch(() => {});
    }
  }
}

/* lots still in a fridge after their DLC: to throw now */
function gpExpired() { const t = dayKey(); return activeLots().filter((l) => !l.test && dlcOf(l) && dlcOf(l) < t).sort((a, b) => (dlcOf(a) > dlcOf(b) ? 1 : -1)); }

/* ───────── money-saving leads ───────── */
function gpLeads() {
  const now = Date.now(), from = now - 28 * 864e5; const L = gpEntries(from, now); const out = [];
  const tot = gpSum(L); if (!L.length) return out;
  /* 1. the product that costs the most, with its main cause */
  const byP = {}; L.filter((e) => e.kind === "perte").forEach((e) => { const k = e.productId || gpKey(e.name); const x = (byP[k] ||= { name: e.name, pid: e.productId, cost: 0, n: 0, r: {} }); x.cost += e.cost || 0; x.n++; x.r[e.reason] = (x.r[e.reason] || 0) + (e.cost || 1); });
  const topP = Object.values(byP).sort((a, b) => b.cost - a.cost || b.n - a.n)[0];
  if (topP && (topP.cost >= 5 || topP.n >= 2)) {
    const r = Object.entries(topP.r).sort((a, b) => b[1] - a[1])[0][0]; const p = topP.pid && S.products.find((x) => x.id === topP.pid);
    const sup = p && (p.supplier || "").trim();
    const tip = r === "dlc" || r === "surprod" ? (sup ? `Les prochaines commandes chez ${sup} en tiennent compte : on commande au plus juste.` : "Commandez plus petit et plus souvent.") : r === "abime" ? "Vérifiez le rangement et la température à la réception." : r === "casse" ? "Un contenant plus solide ou un rangement plus bas peut suffire." : "Regardez avec l'équipe d'où ça vient.";
    out.push({ ic: GP_R[r][1], c: GP_R[r][2], t: `${topP.name} : ${gpMoney() && topP.cost ? gpEur(topP.cost, 0) + " jetés" : gpPl(topP.n, "perte")} en 4 semaines`, s: `${gpPl(topP.n, "fois", "fois")}, surtout pour « ${GP_R[r][0].toLowerCase()} ». ${tip}`, act: sup && typeof acKey === "function" ? ["acOpen", acKey(sup), "Voir la commande"] : null });
  }
  /* 2. the dish left over on the same weekday, week after week */
  const W8 = gpEntries(now - 56 * 864e5, now).filter((e) => e.kind === "invendu" && e.noteId);
  const byD = {}; W8.forEach((e) => { const w = parseDay(e.day || dayKey(new Date(e.at))).getDay(); const k = e.noteId + "|" + w; const x = (byD[k] ||= { name: e.name, w, q: 0, days: new Set(), cost: 0 }); x.q += e.qty; x.days.add(e.day); x.cost += e.cost || 0; });
  const topD = Object.values(byD).filter((x) => x.days.size >= 2).sort((a, b) => (b.cost - a.cost) / Math.max(1, b.days.size) || b.q / b.days.size - a.q / a.days.size)[0];
  if (topD) { const avg = Math.round(topD.q / topD.days.size); if (avg >= 1) out.push({ ic: "gpPlate", c: "#5B2BFF", t: `${topD.name} : ${gpPl(avg, "portion")} de trop le ${GP_DOW[topD.w]}`, s: `En moyenne sur ${topD.days.size} ${GP_DOW[topD.w]}s. Préparez-en ${avg} de moins ce jour-là${gpMoney() && topD.cost ? ` : ${gpEur((topD.cost / topD.days.size) * 52, 0)} d'économie par an` : ""}.` }); }
  /* 3. over-production is the main cause: tie the mise en place to the bookings */
  const sp = L.filter((e) => e.reason === "surprod").reduce((a, e) => a + (e.cost || 0), 0);
  if (tot > 0 && sp / tot >= 0.35 && typeof acCovers === "function") { const c = acCovers(dayKey()); out.push({ ic: "gpStack", c: "#5B2BFF", t: `La surproduction fait ${Math.round((sp / tot) * 100)} % des pertes`, s: c.n ? `Aujourd'hui : ${gpPl(c.booked, "couvert")} réservé${c.booked > 1 ? "s" : ""}, environ ${c.n} attendus. Calez la mise en place là-dessus.` : "Calez la mise en place sur les réservations du jour.", act: ["go", "resa", "Voir les réservations"] }); }
  /* 4. DLC dépassée dominates */
  const dl = L.filter((e) => e.reason === "dlc").reduce((a, e) => a + (e.cost || 0), 0);
  if (out.length < 3 && tot > 0 && dl / tot >= 0.35) out.push({ ic: "clock", c: "#C8432A", t: `Les DLC dépassées font ${Math.round((dl / tot) * 100)} % des pertes`, s: "Chaque matin, l'écran Frigos montre ce qui arrive à date : utilisez-le en premier dans le plat du jour.", act: ["go", "frigos", "Voir les DLC"] });
  return out.slice(0, 3);
}

/* ───────── view ───────── */
function gpRing(pct, size = 92) {
  const r = 38, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
  return `<svg class="gp-ring" viewBox="0 0 92 92" width="${size}" height="${size}" aria-hidden="true"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--cream-3)" stroke-width="9"/><circle class="gp-ringv" cx="46" cy="46" r="${r}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" style="--c0:${c}" transform="rotate(-90 46 46)"/></svg>`;
}
function gpBars(rows, money, empty) {
  if (!rows.length) return `<p class="note gp-empty">${empty}</p>`;
  const mx = Math.max(...rows.map((x) => (money ? x.cost : x.n)), 0.01);
  return `<div class="gp-bars">${rows.map((x, i) => `<div class="gp-br" style="--j:${i}">${x.ic ? `<span class="gp-dot" style="--c:${x.c}">${ico(x.ic)}</span>` : ""}<div class="tx"><div class="row"><b>${esc(x.t)}</b><span class="mono">${money && x.cost ? gpEur(x.cost) : x.n}</span></div><div class="gp-bt"><i style="width:${Math.max(3, ((money ? x.cost : x.n) / mx) * 100)}%;--c:${x.c || "var(--accent)"}"></i></div>${x.s ? `<em>${x.s}</em>` : ""}</div></div>`).join("")}</div>`;
}
function gpRow(e, money) {
  const R = GP_R[e.reason] || GP_R.abime; const inv = e.kind === "invendu";
  return `<div class="li tap gp-li" data-act="gpOpen" data-id="${esc(e.src + ":" + e.id)}" role="button" tabindex="0"><span class="gp-dot" style="--c:${inv ? "#5B2BFF" : R[2]}">${ico(inv ? "gpPlate" : R[1])}</span><div class="tx"><b>${esc(e.name)}</b><em>${e.qty ? `${gpN(e.qty)} ${esc(gpU(e.qty, e.unit))} · ` : ""}${inv ? "Invendu" : R[0]} · ${when(e.at)}</em></div>${money && e.cost > 0 ? `<span class="mono gp-c">${gpEur(e.cost)}</span>` : ""}</div>`;
}

VIEWS.gaspillage = {
  render() {
    if (typeof hyWatch === "function") hyWatch(); gpSeedDemo();
    const money = gpMoney(); const cur = monthKey(); const m = S.ui.gpM && S.ui.gpM <= cur ? S.ui.gpM : cur; const isCur = m === cur;
    const L = gpOfMonth(m); const cost = gpSum(L); const prevL = gpOfMonth(gpShift(m, -1)); const prev = gpSum(prevL);
    const d = new Date(); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); const dom = d.getDate();
    /* compare like with like: this month so far vs the same days of last month */
    const prevSame = isCur ? gpSum(prevL.filter((e) => new Date(e.at).getDate() <= dom)) : prev;
    const delta = prevSame > 0 ? (cost - prevSame) / prevSame : null;
    const proj = isCur && dom >= 3 ? (cost / dom) * dim : cost;
    const t28 = gpSum(gpEntries(Date.now() - 28 * 864e5, Date.now())); const year = (t28 / 28) * 365;
    const buys = gpBuys(m); const share = buys > 0 ? cost / buys : null;
    const inv = L.filter((e) => e.kind === "invendu"); const lost = L.filter((e) => e.kind !== "invendu");
    const unpriced = L.filter((e) => !(e.cost > 0)).length;
    const big = money ? gpEur(cost, 0) : String(L.length);
    const months = Array.from({ length: 6 }, (_, i) => gpShift(cur, i - 5)).map((k) => ({ k, v: money ? gpMonthCost(k) : gpOfMonth(k).length }));
    const mx = Math.max(1, ...months.map((x) => x.v));
    const hero = `<div class="glass gp-hero st" style="--i:1">
      <div class="gp-mnav"><button class="iconbtn sm" data-act="gpMon" data-v="-1" aria-label="Mois précédent">${ico("back")}</button><span class="lbl">${isCur ? "Ce mois-ci" : gpMonthName(m)[0].toUpperCase() + gpMonthName(m).slice(1) + " " + m.slice(0, 4)}</span><button class="iconbtn sm" data-act="gpMon" data-v="1" ${isCur ? "disabled" : ""} aria-label="Mois suivant">${ico("chev")}</button></div>
      <div class="gp-hn"><div><b class="mono gp-big${L.length ? "" : " zero"}" ${money && cost > 0 ? `data-count="${cost}"` : ""}>${big}</b><span class="gp-hs">${money ? `jetés en ${gpMonthName(m)}` : gpPl(L.length, "perte") + ` en ${gpMonthName(m)}`}</span>
        ${delta != null && money ? `<span class="gp-delta ${delta > 0.05 ? "up" : delta < -0.05 ? "down" : ""}">${delta > 0.05 ? ico("stkUp") : delta < -0.05 ? ico("stkDn") : ico("stkEq")}${Math.abs(Math.round(delta * 100))} % ${isCur ? `vs ${dom > 1 ? "1-" + dom : "1er"} ${GP_MS[+gpShift(m, -1).slice(5) - 1]}` : "vs " + gpMonthName(gpShift(m, -1))}</span>` : ""}</div>
        ${money && share != null ? `<div class="gp-share" style="color:${share > 0.06 ? "var(--bad)" : share > 0.03 ? "var(--warn)" : "var(--ok)"}">${gpRing(share / 0.1)}<span><b class="mono">${(Math.round(share * 1000) / 10).toString().replace(".", ",")} %</b><em>des achats</em></span></div>` : ""}</div>
      <div class="gp-split"><div><span class="gp-sw" style="--c:var(--tomato)"></span><b class="mono">${money ? gpEur(gpSum(lost), 0) : lost.length}</b><em>Produits jetés · ${lost.length}</em></div><div><span class="gp-sw" style="--c:var(--accent)"></span><b class="mono">${money ? gpEur(gpSum(inv), 0) : inv.reduce((a, e) => a + e.qty, 0)}</b><em>Invendus · ${gpPl(Math.round(inv.reduce((a, e) => a + e.qty, 0)), "portion")}</em></div></div>
      ${money && isCur && (proj > 0 || year > 0) ? `<div class="gp-proj">${ico("gpSpark")}<span>À ce rythme : <b>${gpEur(proj, 0)}</b> ce mois, <b>${gpEur(year, 0)}</b> sur un an.</span></div>` : ""}
      <div class="gp-chart">${months.map(({ k, v }, i) => `<div class="gp-cb${k === m ? " now" : ""}" style="--j:${i}" data-act="gpMonGo" data-v="${k}" role="button" tabindex="0"><span class="mono">${v ? (money ? gpEur(v, 0) : v) : ""}</span><i style="height:${Math.max(4, (v / mx) * 100)}%"></i><em>${GP_MS[+k.slice(5) - 1].replace(".", "")}</em></div>`).join("")}</div>
      ${money && unpriced ? `<p class="gp-unp">${gpPl(unpriced, "perte")} sans prix : ajoutez le prix d'achat des produits dans Stock › Catalogue.</p>` : ""}
    </div>`;
    const acts = `<div class="grid2 gp-acts st" style="--i:2"><button class="btn gp-go1" data-act="gpNew">${ico("gpBin")}Produit jeté</button><button class="btn acc gp-go2" data-act="gpUnsold">${ico("gpPlate")}Invendus du service</button></div>`;
    const ex = isCur ? gpExpired() : [];
    const exH = ex.length ? `<div class="glass pad gp-exp st" style="--i:3"><div class="row"><div><span class="lbl gp-lb">${ico("clock")}À jeter maintenant</span><em class="sub">${gpPl(ex.length, "produit")} encore en frigo après leur DLC${money ? ` · ${gpEur(ex.reduce((a, l) => a + (gpCost(gpProd(l.productId, l.name), num(l.qty) || 0, l.unit) || 0), 0))}` : ""}</em></div></div>
      ${ex.slice(0, 5).map((l) => { const c = gpCost(gpProd(l.productId, l.name), num(l.qty) || 0, l.unit); const n = -daysUntil(dlcOf(l)); return `<div class="li gp-exl"><div class="tx"><b>${esc(l.name)}</b><em>${l.qty ? `${esc(String(l.qty))} ${esc(gpU(num(l.qty), l.unit))} · ` : ""}${esc(fridgeName(l.fridgeId))} · DLC ${n === 1 ? "hier" : `dépassée de ${n} j`}</em></div>${money && c ? `<span class="mono gp-c">${gpEur(c)}</span>` : ""}<button class="btn danger sm" data-act="gpThrowLot" data-id="${l.id}">Jeter</button></div>`; }).join("")}
      ${ex.length > 1 ? `<button class="btn soft sm block" data-act="gpThrowAll">${ico("gpBin")}Tout noter jeté (${ex.length})</button>` : ""}</div>` : "";
    const leads = isCur ? gpLeads() : [];
    const leadsH = leads.length ? `<div class="glass pad gp-leads st" style="--i:4"><span class="lbl gp-lb">${ico("gpSpark")}Pistes d'économie</span>${leads.map((x, i) => `<div class="gp-lead" style="--j:${i}"><span class="gp-dot lg" style="--c:${x.c}">${ico(x.ic)}</span><div class="tx"><b>${esc(x.t)}</b><em>${esc(x.s)}</em>${x.act ? `<button class="btn ghost sm gp-la" ${x.act[0] === "go" ? `data-go="${x.act[1]}"` : `data-act="${x.act[0]}" data-v="${esc(x.act[1])}"`}>${x.act[2]}${ico("chev")}</button>` : ""}</div></div>`).join("")}</div>` : "";
    /* breakdowns */
    const tab = S.ui.gpTab || "motifs"; const TABS = [["motifs", "Motifs"], ["produits", "Produits"], ["plats", "Plats"], ["jours", "Jours"]]; const ti = TABS.findIndex((t) => t[0] === tab);
    let rows = [], emptyTx = "Rien de noté ce mois-ci.";
    if (tab === "motifs") { const by = {}; L.forEach((e) => { const k = e.kind === "invendu" ? "_inv" : e.reason; (by[k] ||= { n: 0, cost: 0 }).n++; by[k].cost += e.cost || 0; }); rows = Object.entries(by).map(([k, v]) => k === "_inv" ? { t: "Invendus", ic: "gpPlate", c: "#7A4DFF", ...v } : { t: GP_R[k][0], ic: GP_R[k][1], c: GP_R[k][2], ...v }); }
    else if (tab === "produits") { const by = {}; lost.forEach((e) => { const k = e.productId || gpKey(e.name); const x = (by[k] ||= { t: e.name, n: 0, cost: 0, q: 0, u: e.unit }); x.n++; x.cost += e.cost || 0; x.q += e.qty; }); rows = Object.values(by).map((x) => ({ ...x, c: "var(--tomato)", s: `${gpN(x.q)} ${esc(gpU(x.q, x.u))} · ${gpPl(x.n, "fois", "fois")}` })); emptyTx = "Aucun produit jeté ce mois-ci."; }
    else if (tab === "plats") { const by = {}; inv.forEach((e) => { const k = e.noteId || gpKey(e.name); const x = (by[k] ||= { t: e.name, n: 0, cost: 0, q: 0 }); x.n++; x.cost += e.cost || 0; x.q += e.qty; }); rows = Object.values(by).map((x) => ({ ...x, c: "var(--accent)", s: `${gpPl(Math.round(x.q), "portion")} sur ${gpPl(x.n, "service")}` })); emptyTx = "Aucun invendu noté ce mois-ci. En fin de service, touchez « Invendus du service »."; }
    else { const by = Array.from({ length: 7 }, (_, w) => ({ t: GP_DOW[w][0].toUpperCase() + GP_DOW[w].slice(1), n: 0, cost: 0, w })); L.forEach((e) => { const w = parseDay(e.day || dayKey(new Date(e.at))).getDay(); by[w].n++; by[w].cost += e.cost || 0; }); rows = [1, 2, 3, 4, 5, 6, 0].map((w) => by[w]).filter((x) => x.n).map((x) => ({ ...x, c: "var(--saffron)" })); }
    if (tab !== "jours") rows.sort((a, b) => (money ? b.cost - a.cost : 0) || b.n - a.n);
    rows = rows.slice(0, 8);
    const brk = `<div class="glass pad gp-brk st" style="--i:5"><div class="seg gp-seg" role="tablist"><span class="knob" style="width:calc(25% - 2px);transform:translateX(${ti * 100}%)"></span>${TABS.map(([k, t]) => `<button class="${k === tab ? "on" : ""}" data-act="gpTab" data-v="${k}" role="tab" aria-selected="${k === tab}">${t}</button>`).join("")}</div>${gpBars(rows, money, emptyTx)}</div>`;
    const J = L.slice(0, S.ui.gpN || 12);
    const journal = `<div class="glass pad gp-jr st" style="--i:6"><div class="row"><span class="lbl">Journal</span>${L.length ? `<button class="btn ghost sm" data-act="gpCsv">${ico("gpDl")}Exporter</button>` : ""}</div>${J.length ? J.map((e) => gpRow(e, money)).join("") + (L.length > J.length ? `<button class="btn ghost sm block" data-act="gpMore">Voir plus</button>` : "") : `<div class="gp-zero">${ico("gpLeaf")}<b>Zéro perte notée</b><em>${isCur ? "Un produit à jeter ? Deux touches et c'est chiffré." : "Rien n'a été noté ce mois-là."}</em></div>`}</div>`;
    return `<div class="inner gp">${topBar("Gaspillage")}
      <div class="cols"><div>${hero}${acts}${exH}${leadsH}</div><div>${brk}${journal}</div></div></div>`;
  },
  after(v) {
    if (v.classList.contains("nost") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    $$("[data-count]", v).forEach((el) => { const to = +el.dataset.count; const t0 = performance.now(); const f = (t) => { const x = Math.min(1, (t - t0) / 900); el.textContent = gpEur(to * (1 - Math.pow(1 - x, 4)), 0); if (x < 1 && el.isConnected) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  },
};

/* ───────── « Produit jeté » sheet ───────── */
function gpNewSheet() {
  const F = S.ui.gpF; const money = gpMoney(); const p = F.productId && S.products.find((x) => x.id === F.productId);
  const recent = []; gpAll().forEach((e) => { if (e.kind === "perte" && recent.length < 6 && !recent.some((r) => gpKey(r.name) === gpKey(e.name))) recent.push(e); });
  const q = (F.q || "").trim(); const found = q ? S.products.filter((x) => gpKey(x.name).includes(gpKey(q))).slice(0, 8) : [];
  const cost = gpFormCost(F, p);
  const chip = (x) => `<button class="chip" data-act="gpPick" data-id="${esc(x.productId || x.id || "")}" data-v="${esc(x.name)}" data-u="${esc(x.unit || "")}">${esc(x.name)}</button>`;
  return `<div class="gp-sh">
    <div class="gp-shh"><span class="gp-dot lg" style="--c:var(--tomato)">${ico("gpBin")}</span><div><b class="h3">Produit jeté</b><em>Le stock et les euros se calculent tout seuls</em></div></div>
    ${F.name ? `<div class="gp-picked"><span>${ico("acBox")}</span><b>${esc(F.name)}</b>${p ? `<em>${(() => { const s = typeof stockLevel === "function" ? stockLevel(p.id) : null; return s != null ? `${gpN(Math.max(0, s))} ${esc(gpU(s, p.unit))} en stock` : ""; })()}</em>` : `<em>Hors catalogue</em>`}<button class="iconbtn sm" data-act="gpUnpick" aria-label="Changer de produit">${ico("x")}</button></div>`
      : `<label class="field"><span>Quoi ?</span><input class="input" id="gpQ" value="${esc(F.q || "")}" placeholder="Chercher un produit…" autocomplete="off" enterkeyhint="done"></label><div class="gp-sug" id="gpSug">${q ? found.map(chip).join("") + (found.some((x) => gpKey(x.name) === gpKey(q)) ? "" : `<button class="chip gp-free" data-act="gpFree">${ico("plus")}« ${esc(q)} »</button>`) : recent.map(chip).join("")}</div>`}
    <div class="field"><span>Combien ?</span><div class="gp-qty"><button class="ac-sb" data-act="gpQ" data-v="-1" aria-label="Moins">${ico("minus")}</button><input class="input mono" id="gpQty" inputmode="decimal" value="${esc(F.qty)}" aria-label="Quantité"><button class="ac-sb" data-act="gpQ" data-v="1" aria-label="Plus">${ico("plus")}</button>
      <div class="gp-units">${[...new Set([...(p ? [p.unit] : []), ...GP_UNITS])].slice(0, 6).map((u) => `<button class="chip${F.unit === u ? " on" : ""}" data-act="gpUnit" data-v="${esc(u)}">${esc(u)}</button>`).join("")}</div></div></div>
    <div class="field"><span>Pourquoi ?</span><div class="gp-rs">${Object.entries(GP_R).map(([k, [t, ic, c]]) => `<button class="gp-r${F.reason === k ? " on" : ""}" data-act="gpReason" data-v="${k}" style="--c:${c}">${ico(ic)}<span>${t}</span></button>`).join("")}</div></div>
    ${money ? `<div class="gp-cost"><span>Coût</span><b class="mono" id="gpCostV">${cost != null ? gpEur(cost) : "–"}</b><em id="gpCostH">${cost != null && F.cost == null ? "d'après le prix d'achat" : F.cost != null ? "saisi à la main" : p ? "prix d'achat inconnu" : ""}</em><button class="btn ghost sm" data-act="gpCostEdit">${ico("edit")}Modifier</button></div>` : ""}
    <button class="btn acc block" data-act="gpSave" ${F.name && F.reason ? "" : "disabled"}>${ico("check")}Noter la perte</button>
  </div>`;
}
function gpPaint() {
  openSheet(gpNewSheet(), (b) => {
    const F = S.ui.gpF; const q = $("#gpQ", b);
    if (q) { q.addEventListener("input", () => { F.q = q.value; const s = $("#gpSug", b); const t = q.value.trim(); const fd = t ? S.products.filter((x) => gpKey(x.name).includes(gpKey(t))).slice(0, 8) : [];
      if (s) s.innerHTML = t ? fd.map((x) => `<button class="chip" data-act="gpPick" data-id="${x.id}" data-v="${esc(x.name)}" data-u="${esc(x.unit)}">${esc(x.name)}</button>`).join("") + (fd.some((x) => gpKey(x.name) === gpKey(t)) ? "" : `<button class="chip gp-free" data-act="gpFree">${ico("plus")}« ${esc(t)} »</button>`) : ""; });
      q.addEventListener("keydown", (e) => { if (e.key === "Enter" && q.value.trim()) { e.preventDefault(); ACT.gpFree(); } }); }
    const qty = $("#gpQty", b); if (qty) qty.addEventListener("input", () => { F.qty = qty.value; gpCostPaint(); });
  });
}
/* the cost shown while typing: typed by hand, else purchase price × quantity, else (a dish thrown away) its recipe cost per portion */
function gpFormCost(F, p) {
  if (F.cost != null) return F.cost; const q = num(F.qty); const c = gpCost(p, q, F.unit); if (c != null || p) return c;
  const n = F.name && S.notes.find((x) => (x.cat || "") === "Recettes" && gpKey(x.title) === gpKey(F.name)); const pc = n ? gpDishCost(n) : null;
  return pc && q > 0 && (F.unit === "portion" || F.unit === "pièce") ? Math.round(pc * q * 100) / 100 : null;
}
function gpCostPaint() {
  const F = S.ui.gpF; if (!F) return; const p = F.productId && S.products.find((x) => x.id === F.productId); const c = gpFormCost(F, p);
  const v = $("#gpCostV"); if (v) { v.textContent = c != null ? gpEur(c) : "–"; v.classList.remove("pop"); void v.offsetWidth; v.classList.add("pop"); }
  const h = $("#gpCostH"); if (h) h.textContent = c != null && F.cost == null ? "d'après le prix d'achat" : F.cost != null ? "saisi à la main" : p ? "prix d'achat inconnu" : "";
}

/* ───────── « Invendus du service » sheet ───────── */
function gpDishes() {
  const R = S.notes.filter((n) => (n.cat || "") === "Recettes" && (n.title || "").trim());
  const carte = R.filter((n) => n.carte); const base = carte.length ? carte : R;
  const cnt = {}; (S.tkAll && S.tkAll.length ? S.tkAll : S.tickets || []).slice(0, 60).forEach((t) => (t.lines || []).forEach((L) => { if (L.noteId) cnt[L.noteId] = (cnt[L.noteId] || 0) + (+L.quantite || 1); }));
  return base.slice().sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || a.title.localeCompare(b.title, "fr"));
}
function gpUnsoldSheet() {
  const U = S.ui.gpU; const money = gpMoney(); const D = gpDishes();
  const tot = D.reduce((a, n) => a + (U.q[n.id] || 0) * (gpDishCost(n) || 0), 0); const nq = Object.values(U.q).reduce((a, b) => a + b, 0);
  return `<div class="gp-sh">
    <div class="gp-shh"><span class="gp-dot lg" style="--c:var(--accent)">${ico("gpPlate")}</span><div><b class="h3">Invendus du service</b><em>Les portions préparées et pas vendues</em></div></div>
    <div class="seg gp-svc"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${U.svc === "soir" ? "100%" : "0"})"></span><button class="${U.svc === "midi" ? "on" : ""}" data-act="gpSvc" data-v="midi">Midi</button><button class="${U.svc === "soir" ? "on" : ""}" data-act="gpSvc" data-v="soir">Soir</button></div>
    ${D.length ? `<div class="gp-dl">${D.map((n) => { const c = gpDishCost(n); const q = U.q[n.id] || 0; return `<div class="gp-di${q ? " on" : ""}" data-dish="${n.id}"><div class="tx"><b>${esc(n.title)}</b><em>${money && c ? `${gpEur(c)} la portion` : n.portions ? `Recette pour ${gpPl(+n.portions, "portion")}` : "Recette"}</em></div><div class="ac-step"><button class="ac-sb" data-act="gpDish" data-id="${n.id}" data-v="-1" aria-label="Moins">${ico("minus")}</button><span class="ac-sq mono"><b>${q}</b><small>${q > 1 ? "portions" : "portion"}</small></span><button class="ac-sb" data-act="gpDish" data-id="${n.id}" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>`; }).join("")}</div>`
      : `<div class="gp-zero">${ico("book")}<b>Aucune recette</b><em>Ajoutez vos plats dans Recettes : leur coût se calcule depuis les ingrédients.</em></div>`}
    <button class="btn acc block" data-act="gpUnsoldSave" ${nq ? "" : "disabled"}>${nq ? `${ico("check")}Noter ${gpPl(nq, "portion")}${money && tot ? ` · ${gpEur(tot)}` : ""}` : "Touchez + sur un plat"}</button>
  </div>`;
}

/* ───────── writing ───────── */
async function gpWrite(d, opt = {}) {
  const now = Date.now(); const doc = { kind: "perte", month: monthKey(), day: dayKey(), at: now, uid: S.me.id, by: S.me.name || "", service: slotNow(), ...d };
  Object.keys(doc).forEach((k) => (doc[k] === undefined || doc[k] === null) && delete doc[k]);
  let moveId = null;
  if (doc.kind === "perte" && doc.productId && typeof stockMove === "function" && !opt.noStock) {
    const p = S.products.find((x) => x.id === doc.productId); const q = p ? gpConv(+doc.qty || 0, doc.unit, p.unit) : null;
    if (q != null && q > 0) { try { moveId = await stockMove({ productId: p.id, qty: -q, kind: "perte", reason: (GP_R[doc.reason] || GP_R.abime)[0], refType: "waste", ...(doc.cost > 0 ? { value: doc.cost } : {}), noLog: true }); } catch (e) {} }
  }
  if (moveId) doc.moveId = moveId;
  const id = await safe(DB.add("waste", doc));
  logEvent("waste", doc.kind === "invendu" ? `a noté ${gpN(doc.qty)} ${gpU(doc.qty, "portion")} invendue${doc.qty > 1 ? "s" : ""} de ${doc.name}` : `a jeté ${gpN(doc.qty)} ${gpU(doc.qty, doc.unit)} de ${doc.name} · ${(GP_R[doc.reason] || GP_R.abime)[0].toLowerCase()}`, { ref: id });
  return id;
}
async function gpUndo(ids) { for (const id of ids) { const w = gpWaste().find((x) => x.id === id); await DB.del("waste", id).catch(() => {}); if (w && w.moveId) await DB.del("moves", w.moveId).catch(() => {}); if (w && w.lotId && w.lotWas) await DB.update("lots", w.lotId, { status: w.lotWas, outAt: null, outBy: null, lostReason: null }).catch(() => {}); } }
function gpToastUndo(msg, ids) { toast(msg); const t = $("#toast"); $("#toastTx").innerHTML = `<span class="tx">${esc(msg)}</span><button data-act="gpUndo" data-v="${esc(ids.join(","))}">Annuler</button>`; t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 5000); }
async function gpThrowLot(l) {
  const p = gpProd(l.productId, l.name); const q = num(l.qty) || 0; const cost = gpCost(p, q, l.unit);
  await DB.update("lots", l.id, { status: "lost", outAt: Date.now(), outBy: S.me.id, lostReason: "DLC dépassée" });
  return gpWrite({ name: l.name, productId: p ? p.id : undefined, lotId: l.id, lotWas: l.status, qty: q || 1, unit: l.unit || (p && p.unit) || "pièce", reason: "dlc", cost: cost != null ? cost : undefined });
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  gpMon: (a, id, v) => { const cur = monthKey(); const m = gpShift(S.ui.gpM || cur, +v); if (m > cur) return; S.ui.gpM = m; SFX.tick(); refresh(true); },
  gpMonGo: (a, id, v) => { S.ui.gpM = v; SFX.tick(); refresh(true); },
  gpTab: (a, id, v) => { S.ui.gpTab = v; SFX.tick(); refresh(true); },
  gpMore: () => { S.ui.gpN = (S.ui.gpN || 12) + 20; refresh(true); },
  gpNew: (a, id, v) => { SFX.tap(); S.ui.gpF = { q: "", name: "", productId: "", qty: "1", unit: "kg", reason: null, cost: null }; gpPaint(); setTimeout(() => { const e = $("#gpQ"); if (e && DESK_MQ.matches) e.focus(); }, 380); },
  gpPick: (a, id, v) => { const F = S.ui.gpF; if (!F) return; const p = id && S.products.find((x) => x.id === id); F.name = v; F.productId = p ? p.id : ""; F.unit = (p && p.unit) || a.dataset.u || F.unit; F.qty = p && typeof acPack === "function" ? String(gpN(acPack(p))) : F.qty; F.cost = null; SFX.tick(); buzz(4); gpPaint(); },
  gpFree: () => { const F = S.ui.gpF; if (!F) return; const n = (($("#gpQ") || {}).value || F.q || "").trim(); if (!n) return; const p = S.products.find((x) => gpKey(x.name) === gpKey(n)); F.name = p ? p.name : n; F.productId = p ? p.id : ""; if (p) F.unit = p.unit; SFX.tick(); gpPaint(); },
  gpUnpick: () => { const F = S.ui.gpF; if (!F) return; F.name = ""; F.productId = ""; F.q = ""; F.cost = null; SFX.tap(); gpPaint(); },
  gpQ: (a, id, v) => { const F = S.ui.gpF; if (!F) return; const p = F.productId && S.products.find((x) => x.id === F.productId); const st = p && p.unit === F.unit && typeof acPack === "function" ? Math.min(1, acPack(p)) : ["g", "cl"].includes(F.unit) ? 50 : ["kg", "L"].includes(F.unit) ? 0.5 : 1; const n = Math.max(0, Math.round(((num(F.qty) || 0) + +v * st) * 1000) / 1000); F.qty = gpN(n); const i = $("#gpQty"); if (i) i.value = F.qty; SFX.tick(); buzz(3); gpCostPaint(); },
  gpUnit: (a, id, v) => { const F = S.ui.gpF; if (!F) return; F.unit = v; F.qty = ($("#gpQty") || {}).value ?? F.qty; $$(".gp-units .chip").forEach((c) => c.classList.toggle("on", c === a)); SFX.tick(); gpCostPaint(); },
  gpReason: (a, id, v) => { const F = S.ui.gpF; if (!F) return; F.reason = v; F.qty = ($("#gpQty") || {}).value ?? F.qty; $$(".gp-r").forEach((b) => b.classList.toggle("on", b === a)); a.classList.remove("bump"); void a.offsetWidth; a.classList.add("bump"); SFX.tick(); buzz(4); const s = $("[data-act=gpSave]"); if (s) s.disabled = !F.name; },
  gpCostEdit: (a) => {
    const F = S.ui.gpF; if (!F) return; const box = a.closest(".gp-cost"); if (!box || $("input", box)) return; SFX.tap();
    const v = $("#gpCostV", box); const i = document.createElement("input"); i.className = "input mono gp-ci"; i.inputMode = "decimal"; i.placeholder = "€"; i.value = v.textContent === "–" ? "" : v.textContent.replace(/[^\d,.]/g, ""); v.replaceWith(i); a.remove(); i.focus(); i.select();
    i.addEventListener("input", () => { const n = num(i.value); F.cost = n != null && n >= 0 ? n : null; const h = $("#gpCostH"); if (h) h.textContent = F.cost != null ? "saisi à la main" : ""; });
  },
  gpSave: async (a) => {
    const F = S.ui.gpF; if (!F || !F.name || !F.reason) return; const qty = num(($("#gpQty") || {}).value ?? F.qty) || 1; const p = F.productId && S.products.find((x) => x.id === F.productId);
    const cost = gpFormCost({ ...F, qty }, p); a.disabled = true; let id;
    try { id = await gpWrite({ name: F.name, productId: p ? p.id : undefined, qty, unit: F.unit, reason: F.reason, cost: cost != null ? Math.round(cost * 100) / 100 : undefined }); } catch (e) { a.disabled = false; return; }
    S.ui.gpF = null; closeSheet(true); SFX.ok(); buzz(8); gpToastUndo(`${F.name} noté${gpMoney() && cost ? ` · ${gpEur(cost)}` : ""}`, [id]);
  },
  gpUnsold: () => { SFX.tap(); S.ui.gpU = { svc: slotNow(), q: {} }; openSheet(gpUnsoldSheet()); },
  gpSvc: (a, id, v) => { const U = S.ui.gpU; if (!U) return; U.svc = v; SFX.tick(); openSheet(gpUnsoldSheet()); },
  gpDish: (a, id, v) => {
    const U = S.ui.gpU; if (!U) return; const q = Math.max(0, (U.q[id] || 0) + +v); if (q) U.q[id] = q; else delete U.q[id]; SFX[+v > 0 ? "tick" : "tap"](); buzz(3);
    const row = a.closest(".gp-di"); if (row) { row.classList.toggle("on", q > 0); const b = $(".ac-sq b", row); if (b) { b.textContent = q; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } const s = $(".ac-sq small", row); if (s) s.textContent = q > 1 ? "portions" : "portion"; }
    const D = gpDishes(); const nq = Object.values(U.q).reduce((x, y) => x + y, 0); const tot = D.reduce((x, n) => x + (U.q[n.id] || 0) * (gpDishCost(n) || 0), 0);
    const btn = $("[data-act=gpUnsoldSave]"); if (btn) { btn.disabled = !nq; btn.innerHTML = nq ? `${ico("check")}Noter ${gpPl(nq, "portion")}${gpMoney() && tot ? ` · ${gpEur(tot)}` : ""}` : "Touchez + sur un plat"; }
  },
  gpUnsoldSave: async (a) => {
    const U = S.ui.gpU; if (!U) return; const ids = []; a.disabled = true;
    try { for (const [nid, q] of Object.entries(U.q)) { const n = S.notes.find((x) => x.id === nid); if (!n || !q) continue; const c = gpDishCost(n); ids.push(await gpWrite({ kind: "invendu", name: n.title, noteId: n.id, qty: q, unit: "portion", reason: "surprod", service: U.svc, cost: c ? Math.round(c * q * 100) / 100 : undefined })); } }
    catch (e) { a.disabled = false; return; }
    S.ui.gpU = null; closeSheet(true); SFX.ok(); buzz(8); gpToastUndo(`${gpPl(ids.length, "plat")} noté${ids.length > 1 ? "s" : ""}`, ids);
  },
  gpThrowLot: async (a, id) => { const l = S.lots.find((x) => x.id === id); if (!l) return; a.disabled = true; let wid; try { wid = await gpThrowLot(l); } catch (e) { a.disabled = false; return; } const row = a.closest(".li"); if (row) row.classList.add("gp-gone"); SFX.close(); buzz([10, 30, 10]); gpToastUndo(`${l.name} jeté`, [wid]); },
  gpThrowAll: async (a) => { const L = gpExpired(); if (!L.length) return; if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = `Confirmer : ${L.length} produits jetés`; SFX.tap(); return; } a.disabled = true; const ids = []; for (const l of L) { try { ids.push(await gpThrowLot(l)); } catch (e) {} } SFX.close(); buzz([10, 30, 10]); gpToastUndo(`${gpPl(ids.length, "produit")} noté${ids.length > 1 ? "s" : ""} jeté${ids.length > 1 ? "s" : ""}`, ids); },
  gpUndo: async (a, id, v) => { await gpUndo(String(v || "").split(",").filter(Boolean)); $("#toast").classList.remove("on"); SFX.close(); },
  gpOpen: (a, id) => {
    const [src, eid] = String(id).split(":"); const e = gpAll().find((x) => x.src === src && x.id === eid); if (!e) return; SFX.tap(); const R = GP_R[e.reason] || GP_R.abime; const inv = e.kind === "invendu"; const money = gpMoney();
    openSheet(`<div class="gp-sh"><div class="gp-shh"><span class="gp-dot lg" style="--c:${inv ? "#5B2BFF" : R[2]}">${ico(inv ? "gpPlate" : R[1])}</span><div><b class="h3">${esc(e.name)}</b><em>${inv ? `Invendu${e.service ? " du " + e.service : ""}` : R[0]} · ${when(e.at)}</em></div></div>
      <div class="gp-kv">${[["Quantité", `${gpN(e.qty)} ${esc(gpU(e.qty, e.unit))}`], money ? ["Coût", e.cost > 0 ? gpEur(e.cost) : "Prix inconnu"] : null, ["Noté par", esc(e.by || nameOf(e.uid))], ["Origine", e.src === "waste" ? (inv ? "Fin de service" : "Gaspillage") : e.src === "move" ? "Stock › Perte / casse" : "Étiquette du produit"]].filter(Boolean).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
      ${e.src === "waste" ? `<button class="btn danger block" data-act="gpDel" data-id="${esc(e.id)}">${ico("trash")}Supprimer</button>` : `<p class="note" style="margin:0">Pour la modifier, ouvrez-la depuis ${e.src === "move" ? "le stock" : "le produit scanné"}.</p>`}</div>`);
  },
  gpDel: async (a, id) => { if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Toucher encore pour supprimer"; SFX.tap(); return; } await gpUndo([id]); closeSheet(); SFX.close(); toast("Supprimé"); },
  gpCsv: async () => {
    const m = S.ui.gpM || monthKey(); const L = gpOfMonth(m).slice().reverse();
    const rows = [["Date", "Heure", "Type", "Produit ou plat", "Quantité", "Unité", "Motif", "Coût HT (€)", "Noté par"]].concat(L.map((e) => [e.day ? e.day.split("-").reverse().join("/") : "", hm(e.at), e.kind === "invendu" ? "Invendu" : "Perte", e.name, gpN(e.qty), e.unit, e.kind === "invendu" ? "Invendu" : (GP_R[e.reason] || GP_R.abime)[0], e.cost > 0 ? gpN(e.cost) : "", e.by || nameOf(e.uid)]));
    if (typeof stkDownload === "function") return stkDownload(`gaspillage-${m}.csv`, rows); return saveCsv(`gaspillage-${m}.csv`, rows);
  },
});

/* menu Plus: « Gaspillage » next to Hygiène (the hygiene hub links here too) */
(function gpMoreTile() {
  const prev = typeof window.pzMoreGroups === "function" ? window.pzMoreGroups : null;
  window.pzMoreGroups = function (groups) {
    const g = groups.map(([t, its, ...r]) => { if (!its.some((x) => x[0] === "hygiene") || its.some((x) => x[0] === "gaspillage")) return [t, its, ...r]; const i = its.findIndex((x) => x[0] === "hygiene"); const o = its.slice(); o.splice(i + 1, 0, ["gaspillage", "gpBin", "Gaspillage", 0, "", "w-to"]); return [t, o, ...r]; });
    return prev ? prev(g) : g;
  };
})();
