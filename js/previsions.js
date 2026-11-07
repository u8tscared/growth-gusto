/* Growth Gusto — area: prévisions d'activité (route « previsions »). Prefix « pv ».
   Combien de couverts et quel chiffre attendre les jours et les semaines qui viennent, d'après les ventes de l'an dernier (N-1).
   Pour chaque jour à venir :
     · le même jour l'an dernier (52 semaines plus tôt, même jour de la semaine). Un jour férié ou un événement (Saint-Valentin,
       Fête des mères, Beaujolais nouveau, 31 décembre…) se compare au même événement l'an dernier ; un jour ordinaire dont le
       jumeau N-1 était férié prend la semaine d'avant ;
     · × la tendance : les 28 derniers jours comparés aux mêmes 28 jours de l'an dernier (« +7 % sur l'an dernier ») ;
     · mêlé à l'habituel de ce jour de la semaine (médiane des 8 dernières semaines) ;
     · jamais sous les réservations déjà prises (× la part habituelle de clients sans réservation, js/achats.js).
   La précision affichée est mesurée : chaque jour des 4 dernières semaines est re-prévu avec ce qu'on savait la veille, puis
   comparé au réel (1 − écart moyen).
   Données (restos/{rid}/…) :
     history/{AAAA-MM-JJ} = { day, ttc, ht?, n? (notes), covers?, src: "sumup"|"square"|"import"|…, at }  ventes passées par jour,
                            écrites par le serveur (functions/src/caisse.js, op « history » : 13 mois de la caisse connectée) ou par
                            l'import d'un fichier ici (export « CA par jour » de n'importe quelle caisse).
     tickets (Z, js/tickets.js, y compris ceux de la caisse connectée) priment sur history le même jour ; les ventes de caisse
     (S.cxSales, js/caisse.js) plus anciennes que les tickets comptent aussi.
   Exposé (pour les commandes fournisseurs js/achats.js et le planning js/planif.js via prevCovers(k) → { n, booked, label }) :
     window.PREV = { day(k) → { k, ca, covers, lo, hi, closed, ok, n1, tr, base, bk, ev, real }, range(from, to) → [day], trend(),
                     accuracy(), sales(k) } ; salesBetween() (js/tickets.js) compte aussi l'historique (Finances, Tableau de bord « vs N-1 »).
   Rien ici ne coûte : le calcul tourne sur l'appareil. */
"use strict";

TAB_OF.previsions = "more";
Object.assign(IC, {
  pvCrystal: ["M4 19.5h16", "M7 19.5l1.2-2.5h7.6l1.2 2.5", "c:12,10,6", "f:M12 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12z", "M9.3 8.2a3 3 0 0 1 2.4-1.6"],
  pvTrend: ["M3.5 17.5 9 12l3.5 3.5L20.5 7.5", "M15 7.5h5.5V13"],
  pvSpark: ["M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z", "f:M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z", "M19 16v4", "M17 18h4"],
  pvTarget: ["c:12,12,8.5", "c:12,12,5", "c:12,12,1.6", "f:M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"],
  pvUpload: ["M12 15.5V4.5", "m7.5 9 4.5-4.5L16.5 9", "M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15"],
});

/* side nav: right after « Tableau de bord » (no core edit); the phone and tablet « Plus » menu copies NAV (js/compte.js ccMoreFill) */
(function pvNav() {
  if (NAV.some((n) => n[0] === "previsions")) return;
  const i = NAV.findIndex((n) => n[0] === "dashboard"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["previsions", "pvCrystal", "Prévisions"]);
})();
/* money: the same access as the Tableau de bord (gérant, or whoever the gérant opened it to); Second pack like the dashboard */
try { if (typeof PM_ROUTE !== "undefined") PM_ROUTE.previsions = "dashboard"; } catch (e) {}
try { if (typeof CC_GERANT_ONLY !== "undefined") CC_GERANT_ONLY.add("previsions"); } catch (e) {}
try { if (typeof AB_GATE !== "undefined") AB_GATE.previsions = ["pro", "Prévisions"]; } catch (e) {}
try { if (typeof CC_WELL !== "undefined") CC_WELL.previsions = "w-vi"; } catch (e) {}

/* the lesson of the screen (js/lecons.js, checked by tools/lecons-test.js) */
if (typeof PC_LECONS === "object") PC_LECONS.previsions = {
  t: "Prévisions", d: "Les couverts et le chiffre attendus jour par jour, d'après vos ventes de l'an dernier, la tendance du moment et vos réservations.", who: ["boss"],
  steps: ["Regardez la semaine qui vient en haut", "Touchez un jour pour voir d'où vient le chiffre", "Préparez commandes et planning en conséquence"],
  q: ["Sur quoi s'appuie la prévision d'un samedi ?", ["Le même samedi l'an dernier, la tendance et les réservations", "Le hasard", "La météo seulement"], 0],
  sc: { k: "chart", t: "7 prochains jours", kpi: "14 280 €", sub: "462 couverts · +6 % vs N-1", bars: [40, 48, 52, 61, 88, 96, 70] },
  tip: "Les commandes fournisseurs utilisent cette prévision toutes seules.",
};

/* ───────── small helpers ───────── */
const PV_DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const PV_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const pvEur = (v, d = 0) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const pvK = (v) => { if (v == null || isNaN(v)) return "–"; return Math.abs(v) >= 10000 ? (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k€" : pvEur(v); };
const pvInt = (v) => (v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString("fr-FR"));
const pvPct = (r) => { if (r == null || !isFinite(r)) return ""; const p = Math.round((r - 1) * 100); return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p) + " %"; };
const pvCap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
const pvDayS = (k) => { const d = parseDay(k); return `${PV_DOW[d.getDay()]} ${d.getDate()}`; };
const pvDayL = (k, y) => { const d = parseDay(k); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${y || d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`; };
const pvMed = (L) => { if (!L.length) return null; const s = L.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pvMoney = () => { try { return typeof PERMS === "undefined" || !PERMS.cap ? true : PERMS.cap("seeMoney") !== false; } catch (e) { return true; } };

/* ───────── calendar: French public holidays and the days restaurants know ───────── */
function pvEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return dayKey(new Date(y, mo - 1, da));
}
const pvNthDow = (y, m, dow, n) => { const d = new Date(y, m, 1); const off = (dow - d.getDay() + 7) % 7; return dayKey(new Date(y, m, 1 + off + (n - 1) * 7)); };
const pvLastDow = (y, m, dow) => { const d = new Date(y, m + 1, 0); return dayKey(new Date(y, m, d.getDate() - ((d.getDay() - dow + 7) % 7))); };
const pvEvCache = {};
function pvEvents(y) {
  if (pvEvCache[y]) return pvEvCache[y];
  const E = pvEaster(y); const ev = {};
  const put = (k, id, t, f) => { ev[k] = { id, t, ferie: !!f }; };
  [["01-01", "an", "Jour de l'an", 1], ["05-01", "travail", "Fête du Travail", 1], ["05-08", "v45", "8 mai", 1], ["07-14", "nat", "Fête nationale", 1], ["08-15", "assomption", "Assomption", 1],
    ["11-01", "toussaint", "Toussaint", 1], ["11-11", "armistice", "Armistice", 1], ["12-25", "noel", "Noël", 1], ["12-24", "reveillon", "Réveillon de Noël"], ["12-31", "stsylvestre", "Saint-Sylvestre"],
    ["02-14", "valentin", "Saint-Valentin"], ["06-21", "musique", "Fête de la musique"], ["12-08", "lumieres", "Fête des Lumières"]].forEach(([md, id, t, f]) => put(`${y}-${md}`, id, t, f));
  put(addDays(E, 1), "paques", "Lundi de Pâques", 1); put(E, "dpaques", "Dimanche de Pâques"); put(addDays(E, 39), "ascension", "Ascension", 1); put(addDays(E, 50), "pentecote", "Lundi de Pentecôte", 1);
  /* Fête des mères: last Sunday of May, a week later when it falls on Pentecost */
  let mf = pvLastDow(y, 4, 0); if (mf === addDays(E, 49)) mf = addDays(mf, 7); put(mf, "meres", "Fête des mères");
  put(pvNthDow(y, 5, 0, 3), "peres", "Fête des pères"); put(pvNthDow(y, 10, 4, 3), "beaujolais", "Beaujolais nouveau");
  return (pvEvCache[y] = ev);
}
const pvEvent = (k) => pvEvents(+k.slice(0, 4))[k] || null;
/* the day of last year to compare with */
function pvRef(k) {
  const ev = pvEvent(k);
  if (ev) { const L = pvEvents(+k.slice(0, 4) - 1); const r = Object.keys(L).find((x) => L[x].id === ev.id); if (r) return { k: r, ev: true }; }
  let r = addDays(k, -364); if (pvEvent(r)) r = pvEvent(addDays(k, -371)) ? addDays(k, -357) : addDays(k, -371);
  return { k: r, ev: false };
}

/* ───────── data: one figure per day (tickets Z first, then the caisse sales, then the history) ───────── */
const PV = { rid: null, sub: null, hist: null, ix: null, fc: {}, busy: null };
function pvAlive() { const s = PV.sub; if (!s) return false; if (DB.mode === "db") return DB.subs.includes(s); return (DB.listeners[DB.path("history")] || []).includes(s.cb); }
function pvWatch() {
  if (!S.rid) return;
  if (PV.rid !== S.rid) { PV.rid = S.rid; PV.sub = null; PV.hist = null; PV.ix = null; PV.fc = {}; }
  if (typeof tkEnsure === "function") { try { tkEnsure(); } catch (e) {} }
  if (DB.mode === "demo") pvSeedDemo();
  if (pvAlive()) return;
  const rid = S.rid; const cb = (rows) => { if (S.rid !== rid) return; PV.hist = rows; PV.ix = null; PV.fc = {}; if (S.route === "previsions" || S.route === "dashboard" || S.route === "achats") onData(); };
  const n = DB.subs.length; DB.watch("history", {}, cb);
  PV.sub = DB.mode === "db" ? DB.subs[DB.subs.length - 1] || DB.subs[n] : { cb };
}
const pvTickets = () => { const a = S.tkAll && S.tkAll.length > (S.tickets || []).length ? S.tkAll : S.tickets || []; return a; };
function pvIndex() {
  pvWatch();
  const T = pvTickets(), H = PV.hist || [], C = S.cxSales || [];
  if (PV.ix && PV.ix.t === T && PV.ix.h === H && PV.ix.c === C && PV.ix.d === dayKey()) return PV.ix;
  const m = new Map(); let hDays = 0, src = {};
  H.forEach((h) => { const k = h.day || h.id; const v = num(h.ttc); if (!k || v == null || !/^\d{4}-\d\d-\d\d$/.test(k)) return; m.set(k, { ttc: v, ht: num(h.ht), covers: num(h.covers) || null, n: num(h.n) || null, src: h.src || "import" }); hDays++; src[h.src || "import"] = (src[h.src || "import"] || 0) + 1; });
  /* the caisse sales (connected or imported file), one day at a time */
  const cx = {}; C.forEach((s) => { if (!s.day || s.status === "refunded" || s.status === "failed") return; const e = (cx[s.day] ||= { ttc: 0, n: 0 }); e.ttc += num(s.total) || 0; e.n += num(s.count) || 1; });
  Object.entries(cx).forEach(([k, e]) => m.set(k, { ttc: Math.round(e.ttc * 100) / 100, ht: null, covers: m.get(k)?.covers || null, n: e.n, src: "caisse" }));
  const tk = {}; T.forEach((t) => { if (!t.date) return; const v = num(t.total); if (v == null) return; const e = (tk[t.date] ||= { ttc: 0, ht: 0, covers: 0, n: 0, htK: true }); e.ttc += v; const h = num(t.totalHT ?? t.ht); if (h != null) e.ht += h; else e.htK = false; e.covers += num(t.covers ?? t.couverts) || 0; e.n += num(t.nbTickets) || 0; });
  Object.entries(tk).forEach(([k, e]) => m.set(k, { ttc: e.ttc, ht: e.htK ? e.ht : null, covers: e.covers || null, n: e.n || null, src: "ticket" }));
  const keys = [...m.keys()].sort();
  return (PV.ix = { t: T, h: H, c: C, d: dayKey(), m, keys, first: keys[0] || null, hDays, src });
}
const pvSales = (k) => pvIndex().m.get(k) || null;

/* ───────── the model ───────── */
/* what we knew on day `asOf` (exclusive): trend, usual figure per weekday, spend per cover */
function pvState(asOf) {
  const X = pvIndex(); const key = asOf + "|" + X.keys.length;
  if (PV.fc["s" + key]) return PV.fc["s" + key];
  /* trend: last 28 days vs the same days last year (pairs where both are known) */
  let cur = 0, prev = 0, pairs = 0, cv = 0, cc = 0;
  for (let i = 1; i <= 28; i++) {
    const k = addDays(asOf, -i); const a = X.m.get(k); if (!a || !(a.ttc > 0)) continue;
    if (a.covers > 0) { cv += a.ttc; cc += a.covers; }
    const r = pvRef(k); const b = X.m.get(r.k); if (!b || !(b.ttc > 0)) continue; cur += a.ttc; prev += b.ttc; pairs++;
  }
  const tr = pairs >= 10 && prev > 0 ? Math.max(0.5, Math.min(2, cur / prev)) : null;
  /* usual per weekday: median of the last 8 same weekdays that had sales (events left out), and how often it was open */
  const base = {}, baseC = {}, seen = {}, open = {};
  for (let i = 1; i <= 56; i++) {
    const k = addDays(asOf, -i); const w = parseDay(k).getDay(); const a = X.m.get(k);
    if (X.first && k >= X.first) seen[w] = (seen[w] || 0) + 1;
    if (!a || !(a.ttc > 0)) continue; open[w] = (open[w] || 0) + 1; if (pvEvent(k)) continue;
    (base[w] ||= []).push(a.ttc); if (a.covers > 0) (baseC[w] ||= []).push(a.covers);
  }
  const B = {}, BC = {}; for (let w = 0; w < 7; w++) { B[w] = base[w] ? pvMed(base[w]) : null; BC[w] = baseC[w] && baseC[w].length >= 2 ? pvMed(baseC[w]) : null; }
  /* spend per cover: recent days, else last year */
  let spc = cc > 0 ? cv / cc : null;
  if (!spc) { let a = 0, b = 0; for (let i = 1; i <= 120; i++) { const s = X.m.get(addDays(asOf, -i - 300)); if (s && s.covers > 0) { a += s.ttc; b += s.covers; } } spc = b > 0 ? a / b : null; }
  return (PV.fc["s" + key] = { tr, pairs, B, BC, seen, open, spc: spc || 30 });
}
const pvWalk = () => { try { return typeof acCoverIndex === "function" ? acCoverIndex().walk || 1.3 : 1.3; } catch (e) { return 1.3; } };
const pvBooked = (k) => { try { return typeof rsCovers === "function" && typeof rsOfDay === "function" ? rsCovers(rsOfDay(k)) : 0; } catch (e) { return 0; } };
function pvOpenCfg(k) { try { if (typeof rsCfg === "function" && typeof rsSvcsOn === "function" && S.resto && S.resto.resaCfg) return rsSvcsOn(rsCfg(), k).length > 0; } catch (e) {} return null; }
/* forecast of day k, made with what was known before `asOf` (default: today) */
function pvPredict(k, asOf) {
  const now = dayKey(); asOf = asOf || now; const X = pvIndex(); const st = pvState(asOf);
  const w = parseDay(k).getDay(); const ref = pvRef(k); const R = X.m.get(ref.k); const ev = pvEvent(k);
  const hasN1 = !!(R && R.ttc > 0); const n1Known = !!(X.first && ref.k >= X.first);
  const tr = st.tr || 1; const b = st.B[w]; const bk = asOf === now ? pvBooked(k) : 0;
  let ca = null, why = "";
  if (hasN1 && (ref.ev || ev)) { ca = R.ttc * tr; why = "event"; }
  else if (hasN1 && b) { ca = 0.55 * R.ttc * tr + 0.45 * b; why = "mix"; }
  else if (hasN1) { ca = R.ttc * tr; why = "n1"; }
  else if (b) { ca = b; why = "base"; }
  /* closed: nothing last year that day and rarely open that weekday lately (or the booking hours say so) */
  const cfg = pvOpenCfg(k); const seen = st.seen[w] || 0, op = st.open[w] || 0;
  let closed = (cfg === false && !hasN1 && !b) || (!ca && X.keys.length >= 7) || (!hasN1 && seen >= 3 && op / seen < 0.25) || (n1Known && !hasN1 && !(b && op / Math.max(1, seen) >= 0.5));
  if (bk > 0) closed = false;
  if (closed) return { k, ca: 0, covers: 0, lo: 0, hi: 0, closed: true, ok: X.keys.length > 0, n1: { k: ref.k, s: R }, tr: st.tr, base: b, bk, ev, why: "closed", spc: st.spc };
  if (!ca && bk) { ca = bk * pvWalk() * st.spc; why = "resa"; }
  const spc = st.spc;
  let covers = null;
  if (hasN1 && R.covers > 0) covers = (why === "mix" && st.BC[w] ? 0.55 * R.covers * tr + 0.45 * st.BC[w] : R.covers * tr);
  else if (!hasN1 && st.BC[w]) covers = st.BC[w];
  if (covers == null) covers = ca / spc;
  /* the bookings already taken: never below them × the usual walk-ins */
  const floor = bk >= 4 ? bk * pvWalk() : bk;
  if (floor > covers) { const f = floor / covers; covers = floor; ca *= f; why = why + "+resa"; }
  const spread = st.tr && hasN1 ? 0.1 : hasN1 || b ? 0.16 : 0.25;
  return { k, ca: Math.round(ca), covers: Math.round(covers), lo: Math.round(ca * (1 - spread)), hi: Math.round(ca * (1 + spread)), closed: false, ok: true, n1: { k: ref.k, s: R }, tr: st.tr, base: b, bk, ev, why, spc };
}
function pvDay(k) {
  const id = "d" + k + "|" + pvIndex().keys.length + "|" + pvBooked(k);
  const f = PV.fc[id] || (PV.fc[id] = pvPredict(k)); const real = k <= dayKey() ? pvSales(k) : null;
  return { ...f, real };
}
const pvRange = (from, n) => Array.from({ length: n }, (_, i) => pvDay(addDays(from, i)));
/* measured accuracy: each of the last 28 days forecast with what was known the day before, against what happened */
function pvAccuracy() {
  const X = pvIndex(); const id = "acc|" + X.keys.length + "|" + X.d; if (PV.fc[id]) return PV.fc[id];
  let err = 0, tot = 0, n = 0; const today = dayKey();
  for (let i = 1; i <= 28; i++) {
    const k = addDays(today, -i); const a = X.m.get(k); if (!a || !(a.ttc > 0)) continue;
    const f = pvPredict(k, k); if (f.closed || !f.ca) continue; err += Math.abs(f.ca - a.ttc); tot += a.ttc; n++;
  }
  return (PV.fc[id] = n >= 8 && tot > 0 ? { pct: Math.max(0, Math.min(0.99, 1 - err / tot)), n } : null);
}
/* totals of known sales between two days (inclusive) */
function pvSum(from, to) { const X = pvIndex(); let ttc = 0, covers = 0, days = 0; for (let k = from; k <= to; k = addDays(k, 1)) { const s = X.m.get(k); if (s && s.ttc > 0) { ttc += s.ttc; covers += s.covers || 0; days++; } } return { ttc, covers, days }; }
/* months: this year vs last year (same calendar month), the last 12 */
function pvMonths() {
  const out = []; const t = parseDay(dayKey());
  for (let i = 11; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1); const y = d.getFullYear(), m = d.getMonth();
    const from = dayKey(d), end = dayKey(new Date(y, m + 1, 0)); const to = i === 0 ? addDays(dayKey(), -1) : end;
    const cur = pvSum(from, to); const span = Math.round((parseDay(to) - parseDay(from)) / 864e5);
    const pf = dayKey(new Date(y - 1, m, 1)); const pt = addDays(pf, span); const prev = pvSum(pf, pt);
    out.push({ y, m, cur: cur.ttc, prev: prev.days >= Math.max(1, cur.days) * 0.75 ? prev.ttc : 0, part: i === 0 });
  }
  return out;
}
function pvYtd() {
  /* only the days known both years (an history that starts mid-year must not inflate the comparison) */
  const X = pvIndex(); const t = dayKey(); const y = +t.slice(0, 4); let cur = 0, prev = 0, n = 0;
  for (let k = `${y}-01-01`; k < t; k = addDays(k, 1)) { const a = X.m.get(k), b = X.m.get(`${y - 1}${k.slice(4)}`); if (a && b && a.ttc > 0 && b.ttc > 0) { cur += a.ttc; prev += b.ttc; n++; } }
  const el = Math.round((parseDay(t) - parseDay(`${y}-01-01`)) / 864e5); return n >= 20 ? { cur, prev, r: cur / prev, n, full: n >= el * 0.8 } : null;
}

window.PREV = { day: pvDay, range: (from, to) => { const L = []; for (let k = from; k <= to; k = addDays(k, 1)) L.push(pvDay(k)); return L; }, trend: () => pvState(dayKey()).tr, accuracy: pvAccuracy, sales: pvSales, event: pvEvent };

/* the staff planning (js/planif.js) reads the forecast through this one hook */
window.prevCovers = function (k) {
  try {
    const d = pvDay(k); if (!d || !d.ok) return null; if (d.closed) return { n: 0, booked: d.bk || 0, label: "l'an dernier : fermé ce jour-là" };
    const lab = { event: "le même événement l'an dernier + tendance", mix: "ventes de l'an dernier + tendance", n1: "ventes de l'an dernier + tendance", base: "vos 8 dernières semaines", resa: "vos réservations" }[d.why.replace("+resa", "")] || "prévisions";
    return { n: d.covers, booked: d.bk || 0, label: lab + (d.why.includes("+resa") ? " et réservations" : "") };
  } catch (e) { return null; }
};

/* Finances and the Tableau de bord count the history too (« vs N-1 » needs last year): days without a ticket Z */
(function pvSalesHook() {
  if (typeof salesBetween !== "function" || salesBetween.pv) return;
  const base = salesBetween;
  const wrap = function (from, to) {
    const r = base(from, to); if (!PV.hist || !PV.hist.length) return r;
    const k = (x) => (x == null || x === "" ? null : typeof x === "string" ? x.slice(0, 10) : dayKey(new Date(x)));
    const a = k(from) || "0000-00-00", b = k(to) || "9999-99-99"; const have = new Set(pvTickets().map((t) => t.date));
    let ttc = 0, ht = 0, est = 0, covers = 0, n = 0;
    PV.hist.forEach((h) => { const d = h.day || h.id; if (!d || d < a || d > b || have.has(d)) return; const v = num(h.ttc); if (v == null) return; ttc += v; const x = num(h.ht); if (x != null) ht += x; else { ht += v / 1.1; est += v / 1.1; } covers += num(h.covers) || 0; n++; });
    if (!n) return r;
    return { ...r, ttc: Math.round((r.ttc + ttc) * 100) / 100, ht: Math.round((r.ht + ht) * 100) / 100, covers: r.covers + covers, days: (r.days || 0) + n, htEstimated: Math.round(((r.htEstimated || 0) + est) * 100) / 100 };
  };
  wrap.pv = true; salesBetween = wrap; window.salesBetween = wrap;
})();

/* ───────── demo: 13 months of last year's sales, in memory only ───────── */
function pvSeedDemo() {
  const p = DB.path("history"); if (DB.local[p]) return;
  const T = pvTickets(); if (!T.length) return;
  /* this year's level per weekday, from the demo tickets */
  const byD = {}; T.forEach((t) => { if (t.date) byD[t.date] = (byD[t.date] || 0) + (num(t.total) || 0); });
  const lv = {}; Object.entries(byD).forEach(([k, v]) => { if (v < 600) return; const w = parseDay(k).getDay(); (lv[w] ||= []).push(v); });
  const L = {}; for (let w = 0; w < 7; w++) L[w] = lv[w] ? lv[w].reduce((a, b) => a + b, 0) / lv[w].length : null;
  const SEA = [0.82, 0.86, 0.95, 1.0, 1.06, 1.12, 1.16, 0.9, 1.03, 1.0, 1.0, 1.12]; const today = dayKey(); const sNow = SEA[parseDay(today).getMonth()];
  const EVF = { valentin: 1.55, meres: 1.4, peres: 1.2, reveillon: 1.35, stsylvestre: 1.7, noel: 0.55, an: 0.6, beaujolais: 1.45, lumieres: 1.35, musique: 1.25, nat: 0.85, dpaques: 1.15 };
  const have = new Set(T.map((t) => t.date)); let seed = 20251107; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const out = {};
  for (let i = 31; i <= 430; i++) {
    const k = addDays(today, -i); if (have.has(k)) continue; const d = parseDay(k); const w = d.getDay(); if (L[w] == null) continue; /* closed that weekday */
    const ev = pvEvent(k); if (k >= `${d.getFullYear()}-08-09` && k <= `${d.getFullYear()}-08-23`) continue; /* summer holidays */
    const g = Math.pow(1.07, -i / 365); const f = (SEA[d.getMonth()] / sNow) * g * (ev ? EVF[ev.id] || (ev.ferie ? 1.12 : 1) : 1) * (0.92 + rnd() * 0.16);
    const ttc = Math.round(L[w] * f * 100) / 100; const covers = Math.round(ttc / (30 - i / 120));
    out[k] = { day: k, ttc, ht: Math.round((ttc / 1.1) * 100) / 100, covers, n: Math.round(covers / 2.1), src: "sumup", at: Date.now() - i * 864e5 };
  }
  DB.local[p] = out;
}

/* ───────── views ───────── */
function pvSrcName(id) { const x = { ticket: "tickets Z", caisse: "caisse", import: "fichier importé", sumup: "SumUp", square: "Square", lightspeed: "Lightspeed", zelty: "Zelty", demo: "démo" }; return x[id] || id; }
function pvLive() { try { return typeof cxLive === "function" && cxLive() ? (typeof cxActive === "function" ? cxActive().find((c) => c.mode === "api" && ["sumup", "square"].includes(c.provider || c.id)) : null) : null; } catch (e) { return null; } }
function pvChart(D, mode) {
  const val = (d) => (mode === "cov" ? d.covers : d.ca), n1v = (d) => { const s = d.n1 && d.n1.s; return s ? (mode === "cov" ? s.covers : s.ttc) : null; };
  const mx = Math.max(1, ...D.map((d) => Math.max(val(d) || 0, d.hi && mode !== "cov" ? d.hi : 0, n1v(d) || 0, d.real ? (mode === "cov" ? d.real.covers || 0 : d.real.ttc) : 0)));
  const today = dayKey(); const wide = D.length > 14;
  return `<div class="pv-ch${wide ? " wide" : ""}${D.length > 7 ? " dense" : ""}" style="--n:${D.length}" role="list" aria-label="Prévision jour par jour">${D.map((d, i) => {
    const v = d.real && d.k < today ? (mode === "cov" ? d.real.covers : d.real.ttc) : val(d); const n1 = n1v(d); const wk = parseDay(d.k).getDay();
    const lab = d.closed ? "Fermé" : mode === "cov" ? `${pvInt(v)} couverts` : pvEur(v);
    return `<button class="pv-d${d.closed ? " off" : ""}${d.k === today ? " now" : ""}${d.ev ? " ev" : ""}${wk === 1 && i ? " wk" : ""}" style="--j:${i}" data-act="pvDay" data-v="${d.k}" role="listitem" aria-label="${esc(pvDayL(d.k))} : ${esc(lab)}${n1 ? `, l'an dernier ${mode === "cov" ? pvInt(n1) + " couverts" : pvEur(n1)}` : ""}">
      <span class="pv-v mono">${d.closed ? "" : wide ? "" : mode === "cov" ? pvInt(v) : pvK(v).replace(" €", "")}</span>
      <span class="pv-b">${d.closed ? "" : `${mode !== "cov" && d.hi && d.k >= today ? `<i class="rg" style="bottom:${(d.lo / mx) * 100}%;height:${((d.hi - d.lo) / mx) * 100}%"></i>` : ""}<i class="f${d.real && d.k < today ? " real" : ""}" style="height:${Math.max(3, ((v || 0) / mx) * 100)}%"></i>${d.bk && d.k >= today ? `<i class="bk" style="height:${Math.min(100, ((mode === "cov" ? d.bk : d.bk * d.spc) / mx) * 100)}%"></i>` : ""}`}${n1 ? `<i class="n1" style="bottom:${(n1 / mx) * 100}%"></i>` : ""}</span>
      <em>${d.k === today ? "auj." : wide ? PV_DOW[wk].charAt(0).toUpperCase() : PV_DOW[wk].replace(".", "")}<small>${parseDay(d.k).getDate()}</small></em>${d.ev ? `<span class="pv-evd" title="${esc(d.ev.t)}"></span>` : ""}
    </button>`;
  }).join("")}</div>`;
}

VIEWS.previsions = {
  render() {
    if (typeof finIsGerant === "function" && !finIsGerant() && typeof canSee === "function" && !canSee("previsions")) return typeof finLocked === "function" ? finLocked("Prévisions") : "";
    pvWatch(); const X = pvIndex(); const U = (S.ui.pv ||= { h: 14, mode: "ca" }); const today = dayKey(); const money = pvMoney(); const mode = money ? U.mode : "cov";
    const st = pvState(today); const acc = pvAccuracy(); const D = pvRange(today, U.h); const W = D.slice(0, 7);
    const wCa = W.reduce((a, d) => a + d.ca, 0), wCov = W.reduce((a, d) => a + d.covers, 0);
    const wN1 = W.reduce((a, d) => a + ((d.n1.s && d.n1.s.ttc) || 0), 0); const wN1c = W.every((d) => d.closed || (d.n1.s && d.n1.s.ttc > 0));
    const lastYear = (() => { let n = 0; for (let i = 300; i <= 430; i++) if (X.m.has(addDays(today, -i))) n++; return n; })();
    const noData = !X.keys.length; const noN1 = lastYear < 20;
    const busiest = W.filter((d) => !d.closed && d.ca > 0).slice().sort((a, b) => b.ca - a.ca)[0];
    const pill = (t, cls = "") => `<span class="pv-pill ${cls}">${t}</span>`;
    const hero = `<div class="pv-hero wall st" style="--i:1">
      <div class="pv-ht"><span class="pv-hl">${ico("pvCrystal")}Les 7 prochains jours</span>${acc ? `<span class="pv-acc" title="Mesuré sur ${acc.n} jours">${ico("pvTarget")}Fiable à ${Math.round(acc.pct * 100)} %</span>` : ""}</div>
      ${noData ? `<div class="pv-hn"><b class="pv-hok">Il nous faut vos ventes</b></div><p class="pv-hs">Connectez la caisse ou importez l'historique de l'an dernier : la prévision se calcule toute seule, jour par jour.</p>
        <div class="pv-hb"><button class="btn soft" data-go="caisse">${ico("cxPlug")}Connecter la caisse</button><button class="btn ghost pv-hghost" data-act="pvImport">${ico("pvUpload")}Importer un fichier</button></div>`
      : `<div class="pv-hn">${money ? `<b class="mono" data-count="${wCa}">${pvEur(wCa)}</b><span>attendus</span>` : `<b class="mono">${pvInt(wCov)}</b><span>couverts attendus</span>`}</div>
      <div class="pv-hp">${money ? pill(`<b class="mono">${pvInt(wCov)}</b> couverts`) : ""}${wN1 > 0 && wN1c ? pill(`<b>${pvPct(wCa / wN1)}</b> vs l'an dernier`, wCa >= wN1 ? "up" : "down") : ""}${st.tr ? pill(`${ico("pvTrend")}Tendance ${pvPct(st.tr)}`) : ""}</div>
      ${busiest ? `<p class="pv-hs">Le plus chargé : <b>${esc(pvDayL(busiest.k))}</b>${money ? `, environ <b>${pvEur(busiest.ca)}</b>` : ""} pour ${pvInt(busiest.covers)} couverts${busiest.ev ? ` (${esc(busiest.ev.t)})` : ""}.</p>` : ""}`}
    </div>`;
    const chips = `<div class="pv-tools">${money ? `<div class="chips pv-seg" aria-label="Afficher"><button class="chip ${mode === "ca" ? "on" : ""}" data-act="pvMode" data-v="ca" aria-pressed="${mode === "ca"}">Chiffre</button><button class="chip ${mode === "cov" ? "on" : ""}" data-act="pvMode" data-v="cov" aria-pressed="${mode === "cov"}">Couverts</button></div>` : ""}
      <div class="chips pv-seg" aria-label="Période">${[[7, "7 j"], [14, "14 j"], [28, "4 sem."]].map(([h, t]) => `<button class="chip ${U.h === h ? "on" : ""}" data-act="pvH" data-v="${h}" aria-pressed="${U.h === h}">${t}</button>`).join("")}</div></div>`;
    const chart = noData ? "" : `<div class="glass pad st pv-card" style="--i:2"><div class="row"><span class="lbl">Jour par jour</span><span class="sub">Touchez un jour</span></div>${chips}${pvChart(D, mode)}
      <div class="pv-leg"><span><i class="f"></i>Prévision</span><span><i class="n1"></i>L'an dernier</span>${D.some((d) => d.bk) ? `<span><i class="bk"></i>Déjà réservé</span>` : ""}${D.some((d) => d.ev) ? `<span><i class="ev"></i>Événement</span>` : ""}</div></div>`;
    /* the days to keep in mind: events and the big days */
    const marks = D.filter((d) => !d.closed && (d.ev || (st.B[parseDay(d.k).getDay()] && d.ca > st.B[parseDay(d.k).getDay()] * 1.15))).slice(0, 5);
    const marksH = marks.length ? `<div class="glass pad st pv-card" style="--i:3"><span class="lbl">Les jours à retenir</span>${marks.map((d) => { const b = st.B[parseDay(d.k).getDay()]; const r = b ? d.ca / b : null;
      return `<div class="li tap pv-mk" data-act="pvDay" data-v="${d.k}" role="button" tabindex="0"><span class="pv-cal"><em>${PV_DOW[parseDay(d.k).getDay()].replace(".", "")}</em><b>${parseDay(d.k).getDate()}</b></span><div class="tx"><b>${d.ev ? esc(d.ev.t) : "Grosse journée"}</b><em>${pvInt(d.covers)} couverts${money ? ` · ${pvEur(d.ca)}` : ""}${r && r > 1.05 ? ` · ${pvPct(r)} vs un ${DAYS[parseDay(d.k).getDay()]} habituel` : ""}</em></div>${ico("chev")}</div>`; }).join("")}</div>` : "";
    /* the year */
    const M = pvMonths(); const ytd = pvYtd(); const mmx = Math.max(1, ...M.map((x) => Math.max(x.cur, x.prev)));
    const year = !noData && M.some((x) => x.prev > 0) && money ? `<div class="glass pad st pv-card" style="--i:4"><div class="row"><span class="lbl">Cette année et l'an dernier</span>${ytd ? `<span class="pv-pill2 ${ytd.r >= 1 ? "up" : "down"}">${pvPct(ytd.r)} ${ytd.full ? "depuis janvier" : `sur ${ytd.n} jours comparés`}</span>` : ""}</div>
      <div class="pv-yr" role="list">${M.map((x, i) => `<div class="pv-m${x.part ? " part" : ""}" role="listitem" style="--j:${i}" title="${esc(MONTHS[x.m])} ${x.y} : ${pvEur(x.cur)}${x.prev ? ` · ${x.y - 1} : ${pvEur(x.prev)}` : ""}" aria-label="${esc(MONTHS[x.m])} ${x.y} : ${pvEur(x.cur)}${x.prev ? `, l'an dernier ${pvEur(x.prev)}` : ""}"><span class="pv-mb"><i class="p" style="height:${(x.prev / mmx) * 100}%"></i><i class="c" style="height:${(x.cur / mmx) * 100}%"></i></span><em>${PV_MS[x.m].charAt(0).toUpperCase()}</em></div>`).join("")}</div>
      <div class="pv-leg"><span><i class="c"></i>${new Date().getFullYear()}</span><span><i class="p"></i>L'an dernier</span>${ytd ? `<span class="pv-ytd mono">${pvK(ytd.cur)} <small>vs ${pvK(ytd.prev)}</small></span>` : ""}</div></div>` : "";
    /* what it changes */
    const tom = pvDay(addDays(today, 1));
    const uses = !noData ? `<div class="glass pad st pv-card pv-use" style="--i:5"><span class="lbl">Ce que ça prépare</span>
      ${VIEWS.achats ? `<div class="li tap" data-go="achats" role="button" tabindex="0"><span class="ic">${ico("acCart")}</span><div class="tx"><b>Commandes fournisseurs</b><em>Les quantités suivent cette prévision, jour par jour.</em></div>${ico("chev")}</div>` : ""}
      ${VIEWS.planning ? `<div class="li tap" data-go="planning" role="button" tabindex="0"><span class="ic">${ico("cal")}</span><div class="tx"><b>Planning de l'équipe</b><em>${tom.closed ? "Demain : fermé." : `Demain : ${pvInt(tom.covers)} couverts attendus${tom.bk ? `, dont ${pvInt(tom.bk)} réservés` : ""}.`}</em></div>${ico("chev")}</div>` : ""}
    </div>` : "";
    /* sources */
    const live = pvLive(); const srcs = Object.entries(X.src).sort((a, b) => b[1] - a[1]).map(([k]) => pvSrcName(k));
    const srcH = `<div class="glass pad st pv-card pv-src" style="--i:6"><span class="lbl">D'où viennent les chiffres</span>
      <div class="pv-srow"><div><b class="mono">${X.first ? pvInt(Math.max(0, Math.round((parseDay(today) - parseDay(X.first)) / (30.44 * 864e5)))) : 0}</b><em>mois d'historique</em></div><div><b class="mono">${pvInt(pvSum(addDays(today, -56), addDays(today, -1)).days)}</b><em>jours ces 8 semaines</em></div></div>
      ${noN1 ? `<p class="note">${ico("info")}Sans l'an dernier, la prévision repart des 8 dernières semaines et de vos réservations : elle sera plus fine avec l'historique.</p>` : `<p class="sub pv-sl">Historique : ${esc(srcs.join(", ") || "–")}${DB.mode === "demo" ? " (données d'exemple)" : ""}.</p>`}
      <div class="pv-sb">${live ? `<button class="btn acc" data-act="pvFetch" data-v="${esc(live.provider || live.id)}">${ico("cxSync")}Récupérer 13 mois depuis ${esc(pvSrcName(live.provider || live.id))}</button>` : `<button class="btn ${noData ? "acc" : "soft"}" data-go="caisse">${ico("cxPlug")}Caisse connectée</button>`}<button class="btn soft" data-act="pvImport">${ico("pvUpload")}Importer l'historique</button></div></div>`;
    const how = `<div class="glass pad st pv-card ac-how" style="--i:7"><span class="lbl">Comment c'est calculé</span><ol>
      <li><span>1</span><div><b>Le même jour l'an dernier</b><em>Même jour de la semaine, 52 semaines plus tôt. Les fêtes et les événements se comparent à eux-mêmes.</em></div></li>
      <li><span>2</span><div><b>La tendance du moment</b><em>Vos 4 dernières semaines face aux mêmes semaines de l'an dernier, mêlées à votre habituel du jour.</em></div></li>
      <li><span>3</span><div><b>Vos réservations</b><em>Jamais en dessous de ce qui est déjà réservé, plus les clients sans réservation.</em></div></li></ol></div>`;
    return `<div class="inner wide pv">${topBar("Prévisions", { right: `<button class="iconbtn" data-act="pvImport" aria-label="Importer l'historique">${ico("pvUpload")}</button>` })}
      <div class="cols"><div>${hero}${chart}${marksH}</div><div>${year}${uses}${srcH}${how}</div></div></div>`;
  },
  after(v) {
    const b = $(".pv-hn b[data-count]", v); if (!b || v.classList.contains("nost") || S.ui.pvCounted === dayKey() + S.rid) return; S.ui.pvCounted = dayKey() + S.rid;
    const end = +b.dataset.count; const t0 = performance.now(); const step = (t) => { const p = Math.min(1, (t - t0) / 900); const e = 1 - Math.pow(1 - p, 3); b.textContent = pvEur(end * e); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
  },
};

/* one day: where the figure comes from */
function pvDaySheet(k) {
  const d = pvDay(k); const money = pvMoney(); const st = pvState(dayKey()); const today = dayKey(); const past = k < today;
  const row = (t, s, v, cls = "") => `<div class="pv-r ${cls}"><div><b>${t}</b>${s ? `<em>${s}</em>` : ""}</div><span class="mono">${v}</span></div>`;
  const n1 = d.n1.s; const w = DAYS[parseDay(k).getDay()];
  const big = d.closed ? `<b class="pv-sbig">Fermé</b>` : money ? `<b class="pv-sbig mono">${pvEur(d.ca)}</b><span class="pv-sco">${pvInt(d.covers)} couverts${d.lo ? ` · entre ${pvEur(d.lo)} et ${pvEur(d.hi)}` : ""}</span>` : `<b class="pv-sbig mono">${pvInt(d.covers)}</b><span class="pv-sco">couverts attendus</span>`;
  return `<div class="pv-sheet"><div class="h2">${pvCap(pvDayL(k))}</div>${d.ev ? `<span class="pv-pill2 ev">${ico("pvSpark")}${esc(d.ev.t)}</span>` : ""}
    <div class="pv-shero"><span class="lbl">${past ? "Prévu la veille" : "Prévision"}</span>${big}</div>
    ${d.real ? `<div class="pv-real"><span>Réalisé</span><b class="mono">${money ? pvEur(d.real.ttc) : pvInt(d.real.covers) + " couverts"}</b>${money && d.ca ? `<em>${pvPct(d.real.ttc / d.ca)} vs la prévision</em>` : ""}</div>` : ""}
    <div class="lbl" style="margin-top:14px">Le calcul</div>
    ${row(d.n1.k && n1 ? "L'an dernier" : "L'an dernier", pvCap(pvDayL(d.n1.k, true)) + (pvEvent(d.n1.k) ? ` · ${esc(pvEvent(d.n1.k).t)}` : ""), n1 ? (money ? pvEur(n1.ttc) : "") + (n1.covers ? `${money ? " · " : ""}${pvInt(n1.covers)} couv.` : "") : "pas de ventes")}
    ${row("Tendance", st.tr ? "4 dernières semaines face à l'an dernier" : "pas encore assez de jours comparables", st.tr ? `× ${fmt(st.tr, 2)}` : "–")}
    ${row(`Un ${w} habituel`, "médiane des 8 dernières semaines", d.base ? (money ? pvEur(d.base) : "connu") : "–")}
    ${row("Déjà réservé", d.bk ? "plus les clients sans réservation habituels" : "aucune réservation pour l'instant", d.bk ? `${pvInt(d.bk)} couv.` : "0")}
    ${!d.closed ? row("Prévision", { event: "l'an dernier × la tendance (jour d'événement)", mix: "l'an dernier × la tendance, mêlé à l'habituel", n1: "l'an dernier × la tendance", base: "l'habituel de ce jour", resa: "les réservations × les clients sans réservation" }[d.why.replace("+resa", "")] + (d.why.includes("+resa") ? ", relevé par les réservations" : "") || "", money ? pvEur(d.ca) : `${pvInt(d.covers)} couv.`, "tot") : ""}
    <div class="pv-sbtn">${VIEWS.planning ? `<button class="btn soft" data-act="pvGo" data-v="planning">${ico("cal")}Planning</button>` : ""}${VIEWS.achats ? `<button class="btn soft" data-act="pvGo" data-v="achats">${ico("acCart")}Commandes</button>` : ""}</div>
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`;
}

/* ───────── import: an export « CA par jour » of any caisse (CSV or Excel) ───────── */
const PV_RX = { day: /\b(date|jour|day|journee)\b/, ttc: /\b(ca|chiffre|ttc|total|montant|ventes?|revenue|sales|net)\b/, covers: /\b(couverts?|covers|clients?|personnes|pax|guests)\b/, n: /\b(tickets?|notes?|nb|nombre|transactions?|commandes?|orders?)\b/ };
function pvGuess(head, rows) {
  const H = head.map((h) => (typeof cxNorm === "function" ? cxNorm(h) : String(h).toLowerCase())); const used = new Set(); const pick = {};
  ["day", "covers", "n", "ttc"].forEach((k) => {
    let i = H.findIndex((h, j) => !used.has(j) && h && PV_RX[k].test(h) && !(k === "ttc" && /\bht\b|tva|remise|tax/.test(h)) && !(k === "n" && PV_RX.covers.test(h)));
    if (i < 0 && k === "ttc") i = H.findIndex((h, j) => !used.has(j) && rows.slice(0, 10).filter((r) => cxNum(r[j]) != null).length >= Math.min(3, rows.length));
    if (i < 0 && k === "day") i = H.findIndex((h, j) => rows.slice(0, 10).filter((r) => cxDay(r[j])).length >= Math.min(3, rows.length));
    if (i >= 0) { pick[k] = i; used.add(i); }
  });
  return pick;
}
function pvParse(I) {
  const c = I.cols; const days = {};
  I.rows.forEach((r) => {
    if (c.day == null) return; const d = cxDay(r[c.day]); if (!d) return; const v = c.ttc != null ? cxNum(r[c.ttc]) : null; if (v == null) return;
    const e = (days[d] ||= { ttc: 0, covers: 0, n: 0 }); e.ttc += v; if (c.covers != null) e.covers += cxNum(r[c.covers]) || 0; if (c.n != null) e.n += cxNum(r[c.n]) || 0;
  });
  Object.keys(days).forEach((d) => { if (!(days[d].ttc > 0) || d >= dayKey()) delete days[d]; });
  return days;
}
function pvImportHtml() {
  const I = S.ui.pvI;
  if (!I) return `<div class="pv-sheet"><div class="h2">Importer l'historique</div><p class="sub">Un export de votre caisse avec une ligne par jour : la date et le chiffre TTC, et si possible les couverts. CSV ou Excel.</p>
    <ol class="pv-steps"><li>Dans le back-office de la caisse : <b>Rapports</b> ou <b>Statistiques</b>.</li><li>Choisissez <b>chiffre d'affaires par jour</b> sur les 13 derniers mois.</li><li>Exportez en CSV ou Excel, puis déposez le fichier ici.</li></ol>
    <button class="btn acc block" data-act="pvPick">${ico("pvUpload")}Choisir le fichier</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`;
  const D = pvParse(I); const dk = Object.keys(D).sort(); const tot = dk.reduce((a, k) => a + D[k].ttc, 0); const cov = dk.reduce((a, k) => a + D[k].covers, 0);
  const sel = (k, t) => `<label class="cx-col"><span>${t}</span><select class="input" data-pvcol="${k}" aria-label="Colonne ${t}"><option value="">Aucune</option>${I.head.map((h, i) => `<option value="${i}" ${I.cols[k] === i ? "selected" : ""}>${esc(h || "Colonne " + (i + 1))}</option>`).join("")}</select></label>`;
  return `<div class="pv-sheet"><div class="h2">Importer l'historique</div><div class="sub cx-file">${esc(I.file)}</div>
    <div class="cx-isum"><div><b class="mono">${dk.length}</b><em>jours</em></div><div><b class="mono">${pvK(tot)}</b><em>chiffre TTC</em></div><div><b class="mono">${cov ? pvInt(cov) : "–"}</b><em>couverts</em></div></div>
    ${dk.length ? `<p class="sub">Du ${esc(pvDayL(dk[0], true))} au ${esc(pvDayL(dk[dk.length - 1], true))}. Les jours qui ont déjà un ticket Z gardent le ticket.</p>` : `<p class="note">${ico("alert")}Aucun jour reconnu : choisissez la colonne de la date et celle du chiffre.</p>`}
    <div class="cx-cols">${sel("day", "Date")}${sel("ttc", "Chiffre TTC")}${sel("covers", "Couverts")}${sel("n", "Nombre de tickets")}</div>
    <button class="btn acc block" data-act="pvSave" ${dk.length ? "" : "disabled"}>${ico("check")}Importer ${dk.length} jour${dk.length > 1 ? "s" : ""}</button><button class="btn ghost block" data-act="pvPick">Un autre fichier</button></div>`;
}
const pvImportAfter = (b) => $$("[data-pvcol]", b).forEach((s) => s.addEventListener("change", () => { const I = S.ui.pvI; if (!I) return; I.cols[s.dataset.pvcol] = s.value === "" ? null : +s.value; openSheet(pvImportHtml(), pvImportAfter); }));

/* the history of the connected caisse, one month per call, the oldest first */
async function pvFetchHist(prov) {
  if (PV.busy) return; const now = Date.now(); const start = new Date(); start.setFullYear(start.getFullYear() - 1); start.setMonth(start.getMonth() - 1); start.setDate(1); start.setHours(0, 0, 0, 0);
  const wins = []; for (let a = new Date(start); a.getTime() < now; ) { const b = new Date(a.getFullYear(), a.getMonth() + 1, 1); wins.push([a.getTime(), Math.min(b.getTime(), now), a.getMonth(), a.getFullYear()]); a = b; }
  PV.busy = { i: 0, n: wins.length, days: 0 };
  const paint = () => openSheet(`<div class="pv-sheet pv-fetch"><div class="h2">Récupération de l'historique</div><p class="sub">${esc(pvSrcName(prov))} · ${PV.busy.lab || "…"}</p><div class="pv-prog"><i style="width:${(PV.busy.i / PV.busy.n) * 100}%"></i></div><p class="sub mono">${PV.busy.days} jours récupérés</p></div>`);
  try {
    for (const [a, b, m, y] of wins) {
      PV.busy.lab = `${MONTHS[m]} ${y}`; paint(); let from = a, guard = 0;
      for (;;) { const r = await cxCall("history", { provider: prov, from, to: b }); PV.busy.days += r.days || 0; if (!r.more || ++guard > 12) break; from = r.cursor; }
      PV.busy.i++;
    }
    PV.busy = null; closeSheet(true); SFX.done(); burst(); toast("Historique récupéré : la prévision s'appuie sur l'an dernier");
    logEvent("previsions", `a récupéré l'historique des ventes de ${pvSrcName(prov)}`);
  } catch (e) { PV.busy = null; closeSheet(true); SFX.err(); toast(typeof cxErr === "function" ? cxErr(e) : "Récupération impossible pour l'instant.", "err"); }
}

Object.assign(ACT, {
  pvMode: (a, id, v) => { const U = S.ui.pv; if (U.mode === v) return; U.mode = v; SFX.tick(); buzz(4); rerender(); },
  pvH: (a, id, v) => { const U = S.ui.pv; if (U.h === +v) return; U.h = +v; SFX.tick(); buzz(4); rerender(); },
  pvDay: (a, id, v) => { SFX.tap(); openSheet(pvDaySheet(v)); },
  pvGo: (a, id, v) => { closeSheet(true); go(v); },
  pvImport: () => { SFX.tap(); S.ui.pvI = null; openSheet(pvImportHtml()); },
  pvPick: async () => {
    if (typeof cxPickFile !== "function") return; const f = await cxPickFile(); if (!f) return;
    try { const rows = await cxReadFile(f); const T = cxTable(rows); S.ui.pvI = { file: f.name, head: T.head, rows: T.rows, cols: pvGuess(T.head, T.rows) }; openSheet(pvImportHtml(), pvImportAfter); }
    catch (e) { SFX.err(); toast(e && e.code === "xls" ? "Ancien format Excel : enregistrez-le en .xlsx ou en CSV." : "Fichier illisible : essayez l'export CSV.", "err"); }
  },
  pvSave: async (a) => {
    const I = S.ui.pvI; if (!I) return; const D = pvParse(I); const dk = Object.keys(D); if (!dk.length) return; a.disabled = true;
    const at = Date.now();
    for (let i = 0; i < dk.length; i += 50) await Promise.all(dk.slice(i, i + 50).map((k) => DB.set("history", k, { day: k, ttc: Math.round(D[k].ttc * 100) / 100, ht: null, covers: D[k].covers || null, n: D[k].n || null, src: "import", at }).catch(() => {})));
    S.ui.pvI = null; closeSheet(true); SFX.done(); buzz([8, 40, 12]); burst(); toast(`${dk.length} jours importés`);
    logEvent("previsions", `a importé l'historique des ventes (${dk.length} jours)`); refresh(true);
  },
  pvFetch: (a, id, v) => { SFX.tap(); pvFetchHist(v); },
});
