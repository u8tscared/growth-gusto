/* Growth Gusto — area: planif (« Planning intelligent »). Prefix « pf ».
   L'app propose le planning d'une semaine : couverts prévus par service → besoin par poste → les bonnes personnes,
   selon leurs dispos, leurs congés, leur contrat, les repères HCR et le coût chargé. Le gérant ajuste puis publie :
   les créneaux arrivent dans le Planning (js/rh.js, collection shifts) et dans « Mon planning » de chacun.

   Prévision des couverts, dans l'ordre :
     1. prevCovers(day) si un module la fournit (ventes N-1 de la caisse + tendance) → nombre ou { n, midi?, soir?, label? } ;
     2. acCovers(day) de js/achats.js (réservations × clients sans réservation, médiane du même jour sur 8 semaines) ;
     3. la moyenne des tickets Z, sinon rien (le gérant tape ses couverts jour par jour).
   Données : restos/{rid}.pfCfg = { posts: { cuisine: { per, min, midi:[début, fin], soir:[début, fin] }, … }, split } ;
             staff.off = { "<getDay>": ["midi","soir"] } (indisponible), staff.alsoPosts = ["plonge", …] (peut aussi faire) ;
             congés, arrêts, absences et indisponibilités acceptés : esRequests (js/demandes.js). Les créneaux publiés portent src:"auto". */
"use strict";

TAB_OF.planif = "more";
Object.assign(IC, {
  pfWand: ["M4 20 15 9", "M14 4l1 2.2 2.2 1-2.2 1L14 10.4 13 8.2 10.8 7.2 13 6.2z", "f:M14 4l1 2.2 2.2 1-2.2 1L14 10.4 13 8.2 10.8 7.2 13 6.2z", "M19.5 12.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z", "M7 3.5l.5 1.1 1.1.5-1.1.5L7 6.7l-.5-1.1-1.1-.5 1.1-.5z"],
  pfCov: ["M4 11h16", "M6 11a6 6 0 0 1 12 0", "M12 5V3.5", "M3 15h18", "M6 15v4", "M18 15v4"],
  pfTune: ["M4 7h9", "M17 7h3", "c:15,7,2", "M4 17h3", "M11 17h9", "c:9,17,2"],
  pfAvail: ["r:3.5,5,17,15,2.5", "M3.5 10h17", "M8 3v4", "M16 3v4", "m9 15 2 2 4-4"],
  pfGap: ["c:9,8,3.2", "M3.5 19.5a5.5 5.5 0 0 1 11 0", "M17 9v5", "M17 16.6v.4"],
});

/* menu: right after « Planning » (no core edit); the phone and tablet « Plus » menu copies NAV (js/compte.js ccMoreFill) */
(function pfNav() {
  if (NAV.some((n) => n[0] === "planif")) return;
  const i = NAV.findIndex((n) => n[0] === "planning"); NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["planif", "pfWand", "Planning intelligent"]);
})();
try { if (typeof PM_ROUTE !== "undefined") PM_ROUTE.planif = "planning"; } catch (e) {}
try { if (typeof AB_GATE !== "undefined") AB_GATE.planif = ["complet", "Planning intelligent"]; } catch (e) {}
if (typeof PC_LECONS === "object") PC_LECONS.planif = {
  t: "Planning intelligent", who: ["boss"],
  d: "L'app prépare le planning de la semaine d'après les couverts prévus, les dispos de chacun et le coût de l'équipe. Vous ajustez, vous publiez.",
  steps: ["Choisissez la semaine : la proposition est prête", "Touchez un prénom pour changer la personne ou l'horaire", "Publiez : chacun le voit dans Mon planning"],
  q: ["Samedi soir, 90 couverts sont prévus. Que fait l'app ?", ["Elle met assez de monde en cuisine et en salle", "Elle copie la semaine d'avant", "Rien, il faut tout faire à la main"], 0],
  tip: "Indiquez une fois les indisponibilités de chacun : la proposition les respecte toutes les semaines.",
  sc: { k: "list", t: "Samedi 21 · 90 couverts", rows: [["pfCov", "Soir · 58 couverts", "3 cuisine · 2 salle", "acc"], ["pfGap", "Plonge", "il manque 1 personne", "warn"], ["euro", "Masse salariale", "29 % du CA", "ok"]] },
};

/* ───────────── settings ───────────── */
const PF_SVCS = [["midi", "Midi"], ["soir", "Soir"]];
const PF_DEF = {
  cuisine: { per: 24, min: 1, midi: ["10:00", "15:00"], soir: ["18:00", "23:00"] },
  salle: { per: 25, min: 1, midi: ["11:30", "15:00"], soir: ["18:30", "23:30"] },
  plonge: { per: 70, min: 0, from: 30, midi: ["11:30", "15:30"], soir: ["19:00", "23:30"] },
  bar: { per: 60, min: 0, from: 25, midi: ["11:30", "15:00"], soir: ["18:00", "00:00"] },
};
function pfCfg() {
  const c = (S.resto && S.resto.pfCfg) || {}; const posts = {};
  Object.entries(PF_DEF).forEach(([k, d]) => { const x = (c.posts && c.posts[k]) || {}; posts[k] = { ...d, ...x, midi: Array.isArray(x.midi) ? x.midi : d.midi, soir: Array.isArray(x.soir) ? x.soir : d.soir }; });
  return { posts, split: num(c.split) != null ? Math.max(0.1, Math.min(0.9, num(c.split))) : null, target: num(c.target) || 32 };
}
const pfIsMgr = () => (typeof rhIsMgr === "function" ? rhIsMgr() : ["gerant", "chef"].includes(myRole()));
const pfDow = (k) => parseDay(k).getDay();
const pfPl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

/* ───────────── forecast ───────────── */
function pfSvcOpen(k) { /* services open that day, from the bookings settings when they exist */
  try { if (typeof rsCfg === "function" && typeof rsSvcsOn === "function" && S.resto && S.resto.resaCfg) { const on = rsSvcsOn(rsCfg(), k).map((s) => (/soir|dîner|diner/i.test(s.id + " " + s.name) ? "soir" : "midi")); return { midi: on.includes("midi"), soir: on.includes("soir") }; } } catch (e) {}
  return null;
}
let pfSplitIx = null;
function pfSplit(k) { /* share of the day's covers at lunch: settings, else past bookings of that weekday, else 45 % */
  const c = pfCfg(); if (c.split != null) return c.split;
  const rows = typeof rsRows === "function" ? rsRows() : [];
  if (!pfSplitIx || pfSplitIx.r !== rows || pfSplitIx.d !== dayKey()) {
    const by = {}; const from = addDays(dayKey(), -84);
    rows.forEach((b) => { if (!b.date || b.date < from || !(typeof rsLive === "function" ? rsLive(b) : true)) return; const w = pfDow(b.date); const m = rhT2m(b.time) || 0; const o = (by[w] ||= { m: 0, s: 0 }); if (m < 16 * 60) o.m += +b.covers || 0; else o.s += +b.covers || 0; });
    pfSplitIx = { r: rows, d: dayKey(), by };
  }
  const o = pfSplitIx.by[pfDow(k)]; if (o && o.m + o.s >= 20) return Math.max(0.1, Math.min(0.9, o.m / (o.m + o.s)));
  return 0.45;
}
let pfAvgIx = null;
function pfAvgCovers() {
  const T = S.tickets || []; if (pfAvgIx && pfAvgIx.t === T) return pfAvgIx;
  const by = {}; const from = addDays(dayKey(), -84); T.forEach((t) => { if (t.date && t.date >= from && t.date < dayKey() && +t.covers > 0) by[t.date] = (by[t.date] || 0) + +t.covers; });
  const w = {}; Object.entries(by).forEach(([k, c]) => (w[pfDow(k)] ||= []).push(c));
  let sum = 0, n = 0, ttc = 0, cov = 0; T.forEach((t) => { if (t.date && t.date >= from && +t.covers > 0 && +t.total > 0) { ttc += +t.total; cov += +t.covers; } });
  Object.values(by).forEach((c) => { sum += c; n++; });
  return (pfAvgIx = { t: T, w, avg: n ? sum / n : 0, n, basket: cov >= 20 ? ttc / cov : 0 });
}
/* expected covers of a day → { n, midi, soir, src, label, open, booked } (the manager's own figure wins) */
function pfForecast(k, mon) {
  const man = (S.ui.pf && S.ui.pf.mon === mon && S.ui.pf.cov && S.ui.pf.cov[k]);
  const open = pfSvcOpen(k); let r = null;
  if (typeof prevCovers === "function") {
    try { const x = prevCovers(k); if (x != null) { const o = typeof x === "number" ? { n: x } : x; if (num(o.n) != null) r = { n: Math.round(num(o.n)), midi: num(o.midi), soir: num(o.soir), src: "n1", label: o.label || "ventes de l'an dernier + tendance", booked: +o.booked || 0 }; } } catch (e) {}
  }
  if (!r && typeof acCovers === "function") {
    try { const x = acCovers(k); if (x && (x.n || x.open === false)) r = { n: x.open === false ? 0 : x.n, src: "histo", label: "8 dernières semaines + réservations", booked: x.booked || 0, closed: x.open === false }; } catch (e) {}
  }
  if (!r) { const A = pfAvgCovers(); const L = A.w[pfDow(k)]; if (L && L.length) { const s = L.slice().sort((a, b) => a - b); r = { n: s[Math.floor(s.length / 2)], src: "tickets", label: "vos tickets Z" }; } else if (A.n >= 7) r = { n: 0, src: "tickets", label: "vos tickets Z", closed: true }; else r = { n: 0, src: "none", label: "" }; }
  if (man != null) r = { ...r, n: man, src: "manuel", label: "votre chiffre", midi: null, soir: null, closed: false };
  let sp = pfSplit(k); if (open && !open.midi) sp = 0; if (open && !open.soir) sp = 1;
  if (open && !open.midi && !open.soir && man == null) r.n = 0;
  let midi = r.midi != null && r.soir != null ? Math.round(r.midi) : Math.round(r.n * sp); let soir = r.midi != null && r.soir != null ? Math.round(r.soir) : r.n - midi;
  if (r.midi != null && r.soir != null && Math.abs(midi + soir - r.n) > 1) { midi = Math.round(r.n * sp); soir = r.n - midi; }
  return { ...r, midi, soir, open: r.n > 0 };
}

/* ───────────── availability ───────────── */
function pfLeave(p, k, svc) { /* an approved leave, sick leave, absence or unavailability that day (js/demandes.js) → its label; a pending one → "attente:<label>" */
  const rows = typeof ES_REQS === "function" ? ES_REQS() : [];
  for (const r of rows) {
    if (!["conge", "absence", "maladie", "dispo"].includes(r.kind) || !r.from) continue;
    if (typeof drCovers === "function" ? !drCovers(r, k, svc) : k < r.from || k > (r.to || r.from)) continue;
    if (!(r.staffId === p.id || (p.memberId && r.memberId === p.memberId))) continue;
    const t = typeof drShort === "function" ? drShort(r) : r.kind === "conge" ? "congé" : "absence";
    if (r.status === "ok") return t; if (r.status === "attente") return "attente:" + t;
  }
  return "";
}
const pfOffOf = (p, k) => ((p.off && p.off[String(pfDow(k))]) || []);
function pfCanWork(p, k, svc) { const l = pfLeave(p, k, svc); if (l && !l.startsWith("attente")) return false; return !pfOffOf(p, k).includes(svc); }
/* the team that can be planned: active files, minus temporary accesses that have ended (js/relais.js members.until) */
function pfPeople() { const now = Date.now(); return rhPeople().filter((p) => { const m = p.memberId && (S.members || []).find((x) => x.id === p.memberId); return !(m && m.until && m.until < now); }); }
const pfPostsOf = (p) => [p.post || "", ...(Array.isArray(p.alsoPosts) ? p.alsoPosts : [])].filter(Boolean);
const pfExtra = (p) => /extra/i.test(p.contract || "");

/* ───────────── the proposal ───────────── */
function pfNeed(cov, post, P, has) {
  if (!cov) return 0; const c = P[post]; if (!c) return 0; if (c.from && cov < c.from && !c.min) return 0;
  if (post !== "cuisine" && post !== "salle" && !has) return 0;
  return Math.max(c.min || 0, Math.ceil(cov / Math.max(1, c.per)));
}
function pfBuild(mon) {
  const C = pfCfg(); const P = C.posts; const days = rhWeekDays(mon); const ppl = pfPeople();
  const hasPost = {}; ppl.forEach((p) => pfPostsOf(p).forEach((x) => (hasPost[x] = true)));
  const fc = {}; days.forEach((d) => (fc[d] = pfForecast(d, mon)));
  /* demand: one slot per person needed, the busiest services first so the best-fitting people go where it counts */
  const slots = [];
  days.forEach((d) => PF_SVCS.forEach(([svc]) => { const cov = fc[d][svc]; Object.keys(P).forEach((post) => { const n = pfNeed(cov, post, P, hasPost[post]); for (let i = 0; i < n; i++) slots.push({ day: d, svc, post, cov, rank: i }); }); }));
  slots.sort((a, b) => a.rank - b.rank || b.cov - a.cov || a.day.localeCompare(b.day));
  const st = {}; ppl.forEach((p) => (st[p.id] = { min: 0, days: new Set(), iv: [], cap: pfExtra(p) ? Math.max(rhNum(p.weeklyHours, 0), 0) * 60 || 20 * 60 : rhNum(p.weeklyHours, 35) * 60 }));
  const shifts = [], gaps = [];
  const ivOf = (d, a, b) => rhIv({ day: d, start: a, end: b, breakMin: 0 });
  const fits = (p, d, svc, post) => {
    if (!pfCanWork(p, d, svc)) return false; const s = st[p.id]; const [a, b] = P[post][svc]; const iv = ivOf(d, a, b);
    if (s.iv.some((x) => x.day === d && x.svc === svc)) return false;
    if (!s.days.has(d) && s.days.size >= 5) return false; /* 2 days off a week */
    if (s.min + iv.w > Math.min(48 * 60, s.cap + (pfExtra(p) ? 0 : 6 * 60))) return false;
    const dayMin = s.iv.filter((x) => x.day === d).reduce((m, x) => m + x.w, 0) + iv.w; if (dayMin > (post === "cuisine" ? 660 : 690)) return false;
    for (const x of s.iv) { if (x.day === d) { if (iv.s < x.e && x.s < iv.e) return false; continue; } const gap = x.s > iv.e ? x.s - iv.e : iv.s - x.e; if (gap >= 0 && gap < 11 * 60) return false; }
    return true;
  };
  const score = (p, d, post) => {
    const s = st[p.id]; const left = s.cap - s.min; let v = left / 60; /* hours still owed on the contract */
    if (pfPostsOf(p)[0] !== post) v -= 60; /* a second post only when nobody of that post is free */
    if (pfExtra(p)) v -= 4;
    if (s.days.has(d)) v += 6; /* a split shift the same day spares a day off */
    if (left <= 0) v -= 20;
    if (pfLeave(p, d)) v -= 25; /* pending leave request */
    v -= rhLoadedRate(p) / 10; return v;
  };
  slots.forEach((sl) => {
    const cand = ppl.filter((p) => pfPostsOf(p).includes(sl.post) && fits(p, sl.day, sl.svc, sl.post)).sort((a, b) => score(b, sl.day, sl.post) - score(a, sl.day, sl.post));
    const p = cand[0]; if (!p) { const g = gaps.find((x) => x.day === sl.day && x.svc === sl.svc && x.post === sl.post); if (g) g.n++; else gaps.push({ day: sl.day, svc: sl.svc, post: sl.post, n: 1 }); return; }
    const [a, b] = P[sl.post][sl.svc]; const iv = ivOf(sl.day, a, b); const s = st[p.id];
    s.min += iv.w; s.days.add(sl.day); s.iv.push({ ...iv, svc: sl.svc });
    shifts.push({ k: rid6(), staffId: p.id, day: sl.day, svc: sl.svc, start: a, end: b, breakMin: 0, post: sl.post });
  });
  return { mon, shifts, gaps, fc, cov: S.ui.pf && S.ui.pf.mon === mon ? S.ui.pf.cov || {} : {}, at: Date.now(), edited: false };
}
function pfDraft(mon) { const D = S.ui.pf; if (D && D.mon === mon && D.shifts) return D; S.ui.pf = { mon, cov: {} }; return (S.ui.pf = pfBuild(mon)); }
function pfRebuild(keepCov = true) { const D = S.ui.pf; const mon = D ? D.mon : pfMonDef(); const cov = keepCov && D ? D.cov : {}; S.ui.pf = { mon, cov }; S.ui.pf = pfBuild(mon); S.ui.pf.cov = cov; }
const pfMonDef = () => addDays(rhMonday(), 7);

/* numbers of a draft: hours, loaded cost, expected sales, labour share, people under / over their contract */
function pfStats(D) {
  const ppl = pfPeople(); const per = ppl.map((p) => { const sh = D.shifts.filter((s) => s.staffId === p.id); const min = sh.reduce((x, s) => x + rhShiftMin(s), 0); const g = rhWeekGross(min, p); return { p, sh, min, gross: g, loaded: g * (1 + rhCh(p) / 100), days: new Set(sh.map((s) => s.day)).size }; });
  const covers = Object.values(D.fc).reduce((x, f) => x + (f.n || 0), 0); const A = pfAvgCovers(); const basket = A.basket || 32;
  const salesHT = covers * basket / 1.1; const loaded = per.reduce((x, r) => x + r.loaded, 0); const min = per.reduce((x, r) => x + r.min, 0);
  const noRate = per.filter((r) => r.min && !rhRate(r.p)).length; const gaps = D.gaps.reduce((x, g) => x + g.n, 0);
  const under = per.filter((r) => !pfExtra(r.p) && rhNum(r.p.weeklyHours, 35) * 60 - r.min >= 240 && r.p.post).map((r) => ({ p: r.p, miss: rhNum(r.p.weeklyHours, 35) * 60 - r.min }));
  const cur = S.shifts.filter((s) => s.day >= D.mon && s.day <= addDays(D.mon, 6)); let curCost = 0, curMin = 0;
  ppl.forEach((p) => { const m = cur.filter((s) => s.staffId === p.id).reduce((x, s) => x + rhShiftMin(s), 0); curMin += m; curCost += rhWeekGross(m, p) * (1 + rhCh(p) / 100); });
  return { per, covers, basket, salesHT, loaded, min, pct: salesHT ? loaded / salesHT * 100 : null, noRate, gaps, under, cur: cur.length, curCost, curMin, boss: rhIsBoss() };
}

/* ───────────── screen ───────────── */
const pfEur = (n) => rhEur(Math.round(n || 0));
function pfChip(s, i) {
  const p = rhStaff(s.staffId); const P = RH_POSTS[s.post] || {};
  return `<button class="pf-ch" style="--pc:${P.c || "#B8AC98"};--pb:${P.bg || "#F4EDE0"};--pi:${P.ink || "#615B74"};--j:${i}" data-act="pfShift" data-id="${s.k}" aria-label="${esc(`${rhFirst(p)}, ${P.t || ""}, ${s.start} à ${s.end}`)}">${rhAva(p, 24)}<span><b>${esc(rhFirst(p))}</b><em class="mono">${esc(s.start)}–${esc(s.end)}</em></span></button>`;
}
function pfDayCard(D, d, i, st) {
  const f = D.fc[d]; const today = dayKey(); const sh = D.shifts.filter((s) => s.day === d); const max = Math.max(1, ...Object.values(D.fc).map((x) => Math.max(x.midi, x.soir)));
  const svc = ([k, t]) => {
    const l = sh.filter((s) => s.svc === k).sort((a, b) => Object.keys(RH_POSTS).indexOf(a.post) - Object.keys(RH_POSTS).indexOf(b.post) || a.start.localeCompare(b.start)); const g = D.gaps.filter((x) => x.day === d && x.svc === k); const cov = f[k];
    if (!cov && !l.length) return `<div class="pf-svc off"><div class="pf-svh"><b>${t}</b><em>fermé</em></div></div>`;
    return `<div class="pf-svc"><div class="pf-svh"><b>${t}</b><span class="pf-cbar"><i style="width:${Math.round(cov / max * 100)}%"></i></span><em class="mono">${cov} couv.</em></div>
      <div class="pf-chs">${l.map((s, j) => pfChip(s, j)).join("")}${g.map((x) => `<button class="pf-gap" data-act="pfAdd" data-v="${d}|${k}|${x.post}">${ico("pfGap")}<span><b>Il manque ${x.n}</b><em>${(RH_POSTS[x.post] || {}).t || x.post}</em></span></button>`).join("")}<button class="pf-plus" data-act="pfAdd" data-v="${d}|${k}|" aria-label="Ajouter quelqu'un ${t.toLowerCase()} ${rhDayLbl(d, true)}">${ico("plus")}</button></div></div>`;
  };
  const cost = st.boss ? sh.reduce((x, s) => x + rhShiftMin(s) / 60 * rhLoadedRate(rhStaff(s.staffId)), 0) : 0;
  const src = f.src === "manuel" ? "votre chiffre" : f.booked ? `dont ${f.booked} réservés` : "";
  return `<div class="glass pf-day st${d === today ? " today" : ""}" style="--i:${4 + i}">
    <div class="pf-dh"><div class="pf-dl"><em>${RH_DLONG[i]}</em><b>${parseDay(d).getDate()} ${RH_MS[parseDay(d).getMonth()]}</b></div>
      <button class="pf-cov${f.src === "manuel" ? " man" : ""}" data-act="pfCov" data-v="${d}" aria-label="Modifier les couverts prévus le ${rhDayLbl(d, true)}"><b class="mono">${f.n}</b><span>couverts${src ? `<i>${esc(src)}</i>` : ""}</span>${ico("edit")}</button></div>
    ${PF_SVCS.map(svc).join("")}
    ${sh.length ? `<div class="pf-df"><span class="mono">${rhHh(sh.reduce((x, s) => x + rhShiftMin(s), 0))}</span>${st.boss && cost ? `<span class="mono">${pfEur(cost)}</span>` : ""}</div>` : ""}
  </div>`;
}
VIEWS.planif = {
  render() {
    if (!pfIsMgr()) return `<div class="inner">${topBar("Planning intelligent")}<div class="glass empty st" style="--i:1"><span class="ic">${ico("pfWand")}</span><b>Réservé au gérant et au chef</b>Votre planning arrive dans « Mon planning » dès qu'il est publié.<div style="margin-top:14px"><button class="btn soft" data-go="planning">${ico("cal")}Voir le planning</button></div></div></div>`;
    const ppl = pfPeople();
    if (!ppl.length) return `<div class="inner">${topBar("Planning intelligent")}<div class="glass empty st" style="--i:1"><span class="ic">${ico("pfWand")}</span><b>Il faut d'abord votre équipe</b>Créez une fiche par personne avec son poste et son contrat : l'app pourra alors préparer la semaine.${rhCanStaff() ? `<div style="margin-top:14px"><button class="btn acc" data-go="staff">${ico("plus")}Ajouter un employé</button></div>` : ""}</div></div>`;
    const mon = (S.ui.pf && S.ui.pf.mon) || pfMonDef(); const D = pfDraft(mon); const st = pfStats(D); const days = rhWeekDays(mon);
    const srcs = [...new Set(Object.values(D.fc).map((f) => f.src))]; const lab = Object.values(D.fc).find((f) => f.label && f.src !== "manuel");
    const srcTxt = srcs.includes("none") && srcs.length === 1 ? "Pas encore d'historique : touchez les couverts d'un jour pour les indiquer." : `Couverts prévus d'après ${lab ? lab.label : "vos chiffres"}${srcs.includes("manuel") ? ", corrigés par vous" : ""}.`;
    const pctCls = st.pct == null ? "" : st.pct > C_PFMAX() ? "bad" : st.pct > pfCfg().target ? "warn" : "ok";
    const rel = mon === rhMonday() ? "cette semaine" : mon === addDays(rhMonday(), 7) ? "semaine prochaine" : mon < rhMonday() ? "semaine passée" : "à venir";
    const hero = `<div class="pf-hero wall st" style="--i:1">
      <div class="pf-ht"><button class="iconbtn pf-wk" data-act="pfWeek" data-v="-7" aria-label="Semaine précédente">${ico("back")}</button><div class="pf-wl"><em>${rel}</em><b>${rhWeekLbl(mon)}</b></div><button class="iconbtn pf-wk" data-act="pfWeek" data-v="7" aria-label="Semaine suivante">${ico("rhfwd")}</button></div>
      <div class="pf-kp">
        <span><b class="mono">${st.covers}</b><em>couverts prévus</em></span>
        <span><b class="mono">${rhHh(st.min)}</b><em>${pfPl(st.per.filter((r) => r.min).length, "personne")}</em></span>
        ${st.boss ? `<span><b class="mono">${pfEur(st.loaded)}</b><em>${st.cur && Math.abs(st.curCost - st.loaded) >= 20 ? `${pfEur(Math.abs(st.curCost - st.loaded))} ${st.curCost > st.loaded ? "de moins" : "de plus"} qu'au planning actuel` : "coût chargé"}</em></span><span class="pf-pct ${pctCls}"><b class="mono">${st.pct == null ? "–" : Math.round(st.pct) + " %"}</b><em>du CA prévu</em></span>` : ""}
      </div>
      <p class="pf-src">${ico("sparkle")}<span>${esc(srcTxt)}</span></p>
      <div class="pf-ha"><button class="btn sm pf-hb" data-act="pfRedo">${ico("pfWand")}<span>Recalculer</span></button><button class="btn sm pf-hb" data-act="pfAvail">${ico("pfAvail")}<span>Dispos</span></button><button class="btn sm pf-hb" data-act="pfTune">${ico("pfTune")}<span>Réglages</span></button></div>
    </div>`;
    const notes = [];
    if (st.gaps) notes.push(`<div class="pf-n bad">${ico("pfGap")}<span><b>${pfPl(st.gaps, "créneau")} sans personne.</b> Touchez « Il manque » pour choisir quelqu'un, ou prévoyez un extra.</span></div>`);
    if (st.under.length) { const L = st.under.map((u) => `<b>${esc(rhFirst(u.p))}</b> (−${rhHh(u.miss)})`); const who = L.length > 1 ? L.slice(0, -1).join(", ") + " et " + L[L.length - 1] : L[0]; notes.push(`<div class="pf-n">${ico("clock")}<span>${who} ${L.length > 1 ? "restent" : "reste"} sous ${L.length > 1 ? "leur" : "son"} contrat : de quoi renforcer un service ou la mise en place.</span></div>`); }
    if (st.cur) notes.push(`<div class="pf-n">${ico("cal")}<span>${pfPl(st.cur, "créneau")} déjà au planning cette semaine-là${st.boss ? ` (${pfEur(st.curCost)})` : ""} : publier les remplace.</span></div>`);
    if (st.boss && st.noRate) notes.push(`<div class="pf-n">${ico("euro")}<span>${pfPl(st.noRate, "personne")} sans taux horaire : coût incomplet.</span></div>`);
    const body = `<div class="pf-days">${days.map((d, i) => pfDayCard(D, d, i, st)).join("")}</div>`;
    const n = D.shifts.length;
    const cta = `<div class="ctabar pf-cta st" style="--i:12"><button class="btn acc block" data-act="pfPublish" ${n ? "" : "disabled"}>${ico("check")}Publier le planning · ${pfPl(n, "créneau")}</button></div>`;
    return `<div class="inner wide pf">${topBar("Planning intelligent", { right: `<button class="btn soft sm" data-go="planning">${ico("cal")}<span>Planning</span></button>` })}${hero}${notes.length ? `<div class="pf-ns st" style="--i:3">${notes.join("")}</div>` : ""}${body}
      <p class="note st" style="--i:11">Besoin par service : ${Object.entries(pfCfg().posts).filter(([k]) => k === "cuisine" || k === "salle" || ppl.some((p) => pfPostsOf(p).includes(k))).map(([k, c]) => `${(RH_POSTS[k] || {}).t} 1 pour ${c.per} couverts`).join(", ")}. Respecte les dispos, les congés acceptés, 2 jours de repos, 11 h entre deux journées et les heures du contrat. Rien n'est envoyé avant « Publier ».</p>${cta}</div>`;
  },
};
const C_PFMAX = () => pfCfg().target + 6;

/* ───────────── sheets ───────────── */
function pfShiftSheet(s) {
  const p = rhStaff(s.staffId); const D = S.ui.pf; const P = RH_POSTS[s.post] || {};
  const cand = pfPeople().filter((x) => x.id !== s.staffId && pfPostsOf(x).includes(s.post)).map((x) => ({ x, ok: pfCanWork(x, s.day, s.svc), busy: D.shifts.some((y) => y.staffId === x.id && y.day === s.day && y.svc === s.svc), min: D.shifts.filter((y) => y.staffId === x.id).reduce((m, y) => m + rhShiftMin(y), 0) }));
  return `<div class="pf-sh">
    <div class="rh-act-hd">${rhAva(p, 48)}<div><div class="h2">${esc(p ? p.name : "")}</div><div class="sub">${rhDayLbl(s.day, true)} · ${s.svc === "midi" ? "midi" : "soir"} · ${P.t || ""}</div></div></div>
    <div class="grid2"><label class="field"><span>Début</span><input class="input mono" type="time" id="pfSs" value="${esc(s.start)}" step="900"></label><label class="field"><span>Fin</span><input class="input mono" type="time" id="pfSe" value="${esc(s.end)}" step="900"></label></div>
    ${cand.length ? `<div class="field"><span>Mettre quelqu'un d'autre</span><div class="pf-cands">${cand.map((c) => `<button class="pf-cand" data-act="pfSwap" data-id="${s.k}" data-v="${esc(c.x.id)}" ${c.ok && !c.busy ? "" : "disabled"}>${rhAva(c.x, 30)}<span><b>${esc(rhFirst(c.x))}</b><em>${!c.ok ? (pfLeave(c.x, s.day) ? "en congé" : "indisponible") : c.busy ? "déjà là" : `${rhHh(c.min)} / ${rhHh(rhNum(c.x.weeklyHours, 35) * 60)}`}</em></span></button>`).join("")}</div></div>` : ""}
    <div class="hstack rh-shb"><button class="btn danger" data-act="pfDel" data-id="${s.k}" aria-label="Retirer ce créneau">${ico("trash")}</button><button class="btn acc block" data-act="pfShiftSave" data-id="${s.k}">${ico("check")}Garder</button></div>
  </div>`;
}
function pfAddSheet(d, svc, post) {
  const D = S.ui.pf; const C = pfCfg();
  const ppl = pfPeople().filter((x) => !post || pfPostsOf(x).includes(post)).map((x) => ({ x, ok: pfCanWork(x, d, svc), busy: D.shifts.some((y) => y.staffId === x.id && y.day === d && y.svc === svc), min: D.shifts.filter((y) => y.staffId === x.id).reduce((m, y) => m + rhShiftMin(y), 0) }));
  ppl.sort((a, b) => (b.ok && !b.busy) - (a.ok && !a.busy) || (pfExtra(a.x) - pfExtra(b.x)) || a.min - b.min);
  S.ui.pfAdd = { d, svc, post };
  return `<div class="pf-sh"><div class="h2">${post ? `${(RH_POSTS[post] || {}).t} · ` : ""}${svc === "midi" ? "Midi" : "Soir"}</div><p class="sub">${rhDayLbl(d, true)} · ${D.fc[d][svc]} couverts prévus</p>
    <div class="pf-cands">${ppl.map((c) => { const ps = post || pfPostsOf(c.x)[0] || "cuisine"; const [a, b] = C.posts[ps] ? C.posts[ps][svc] : ["10:00", "15:00"]; return `<button class="pf-cand" data-act="pfAddGo" data-v="${esc(c.x.id)}" ${c.busy ? "disabled" : ""}>${rhAva(c.x, 30)}<span><b>${esc(rhFirst(c.x))}${!c.ok ? ` <i class="pf-warn">${pfLeave(c.x, d) ? "congé" : "indispo"}</i>` : ""}</b><em>${c.busy ? "déjà là" : `${(RH_POSTS[ps] || {}).t || ""} ${a}–${b} · ${rhHh(c.min)} / ${rhHh(rhNum(c.x.weeklyHours, 35) * 60)}`}</em></span></button>`; }).join("") || `<p class="sub">Personne à ce poste : ajoutez un poste dans « Dispos ».</p>`}</div></div>`;
}
function pfAvailSheet() {
  const ppl = pfPeople(); const sel = S.ui.pfAv || (ppl[0] && ppl[0].id); const p = rhStaff(sel); S.ui.pfAv = sel;
  const W = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="pf-sh pf-av"><div class="h2">Disponibilités</div><p class="sub">Touchez un service pour le marquer indisponible. Les congés acceptés sont déjà pris en compte.</p>
    <div class="pf-avp">${ppl.map((x) => `<button class="${x.id === sel ? "on" : ""}" data-act="pfAvWho" data-v="${esc(x.id)}">${rhAva(x, 34)}<span>${esc(rhFirst(x))}</span></button>`).join("")}</div>
    ${p ? `<div class="pf-avg"><span></span>${PF_SVCS.map(([, t]) => `<em>${t}</em>`).join("")}${W.map((w) => { const off = (p.off && p.off[String(w)]) || []; return `<b>${RH_DLONG[(w + 6) % 7]}</b>${PF_SVCS.map(([k]) => `<button class="${off.includes(k) ? "no" : "yes"}" data-act="pfAvT" data-v="${w}|${k}" aria-pressed="${!off.includes(k)}" aria-label="${RH_DLONG[(w + 6) % 7]} ${k}">${off.includes(k) ? "Indispo" : ico("check")}</button>`).join("")}`; }).join("")}</div>
    <div class="field"><span>Peut aussi tenir</span><div class="rh-posts">${Object.entries(RH_POSTS).filter(([k]) => k !== p.post).map(([k, v]) => `<button class="${(p.alsoPosts || []).includes(k) ? "on" : ""}" style="--pc:${v.c};--pb:${v.bg};--pi:${v.ink}" data-act="pfAvPost" data-v="${k}"><i></i>${v.t}</button>`).join("")}</div></div>` : ""}
    <button class="btn acc block" data-act="pfAvDone">${ico("check")}Terminé</button></div>`;
}
function pfTuneSheet() {
  const C = S.ui.pfT; const has = {}; pfPeople().forEach((p) => pfPostsOf(p).forEach((x) => (has[x] = true)));
  return `<div class="pf-sh"><div class="h2">Réglages de la proposition</div><p class="sub">Combien de couverts une personne tient par service, et les horaires de chaque poste.</p>
    ${Object.entries(C.posts).filter(([k]) => k === "cuisine" || k === "salle" || has[k]).map(([k, c]) => { const v = RH_POSTS[k]; return `<div class="pf-tp" style="--pc:${v.c};--pb:${v.bg};--pi:${v.ink}"><div class="pf-tph"><i></i><b>${v.t}</b><span class="pf-step"><button class="step" data-act="pfTPer" data-v="${k}|-1" aria-label="Moins">${ico("minus")}</button><b class="mono">1 / ${c.per}</b><button class="step" data-act="pfTPer" data-v="${k}|1" aria-label="Plus">${ico("plus")}</button></span></div>
      <div class="pf-tpt">${PF_SVCS.map(([s, t]) => `<label><em>${t}</em><input class="input mono" type="time" step="900" data-pft="${k}|${s}|0" value="${esc(c[s][0])}"><input class="input mono" type="time" step="900" data-pft="${k}|${s}|1" value="${esc(c[s][1])}"></label>`).join("")}</div>
      <div class="pf-tmin"><em>Minimum par service ouvert</em><div class="rh-opts">${[0, 1, 2, 3].map((n) => `<button class="${(c.min || 0) === n ? "on" : ""}" data-act="pfTMin" data-v="${k}|${n}">${n}</button>`).join("")}</div></div></div>`; }).join("")}
    <div class="pf-tp"><div class="pf-tph"><b>Masse salariale visée</b><span class="pf-step"><button class="step" data-act="pfTTarget" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${C.target} %</b><button class="step" data-act="pfTTarget" data-v="1" aria-label="Plus">${ico("plus")}</button></span></div></div>
    <button class="btn acc block" data-act="pfTuneSave">${ico("check")}Enregistrer et recalculer</button></div>`;
}
function pfCovSheet(d) {
  const f = S.ui.pf.fc[d]; S.ui.pfCovD = d; S.ui.pfCovN = f.n;
  return `<div class="pf-sh"><div class="h2">Couverts prévus</div><p class="sub">${rhDayLbl(d, true)}${f.src !== "manuel" && f.label ? ` · d'après ${esc(f.label)}` : ""}${f.booked ? ` · ${f.booked} déjà réservés` : ""}</p>
    <div class="pf-covk"><button class="step" data-act="pfCovStep" data-v="-5" aria-label="5 de moins">${ico("minus")}</button><input class="mono" id="pfCovN" inputmode="numeric" value="${f.n}" aria-label="Couverts"><button class="step" data-act="pfCovStep" data-v="5" aria-label="5 de plus">${ico("plus")}</button></div>
    <div class="chips pf-covq">${[["Fermé", 0], ["Calme", Math.round(f.n * 0.8)], ["Normal", f.n], ["Événement", Math.round(f.n * 1.3) || 60]].map(([t, n]) => `<button class="chip" data-act="pfCovSet" data-v="${n}">${t}<span class="mono rh-pm">${n}</span></button>`).join("")}</div>
    <div class="hstack rh-shb">${f.src === "manuel" ? `<button class="btn soft" data-act="pfCovReset">Prévision de l'app</button>` : ""}<button class="btn acc block" data-act="pfCovSave">${ico("check")}Recalculer ce jour</button></div></div>`;
}

/* ───────────── actions ───────────── */
const pfFind = (k) => (S.ui.pf ? S.ui.pf.shifts.find((s) => s.k === k) : null);
function pfRegaps(D) { /* after a manual change: recompute what is still missing per service and post */
  const C = pfCfg(); const has = {}; pfPeople().forEach((p) => pfPostsOf(p).forEach((x) => (has[x] = true))); const gaps = [];
  Object.keys(D.fc).forEach((d) => PF_SVCS.forEach(([svc]) => Object.keys(C.posts).forEach((post) => { const need = pfNeed(D.fc[d][svc], post, C.posts, has[post]); const got = D.shifts.filter((s) => s.day === d && s.svc === svc && s.post === post).length; if (need > got) gaps.push({ day: d, svc, post, n: need - got }); })));
  D.gaps = gaps; D.edited = true;
}
Object.assign(ACT, {
  pfWeek: (a, id, v) => { SFX.tick(); buzz(4); const mon = addDays((S.ui.pf && S.ui.pf.mon) || pfMonDef(), +v); S.ui.pf = { mon, cov: {} }; S.ui.pf = pfBuild(mon); rerender(); },
  pfRedo: () => {
    if (S.ui.pf && S.ui.pf.edited) { openSheet(`<div class="h2">Recalculer la semaine ?</div><p class="sub">Vos changements à la main seront remplacés par une nouvelle proposition. Les couverts que vous avez tapés sont gardés.</p><button class="btn acc block" data-act="pfRedoGo">${ico("pfWand")}Recalculer</button><button class="btn ghost" data-act="sheetClose">Annuler</button>`); return; }
    ACT.pfRedoGo();
  },
  pfRedoGo: () => { closeSheet(true); pfRebuild(true); SFX.done(); buzz([6, 30, 6]); rerender(); $$(".pf-ch").forEach((c) => c.classList.add("pf-pop")); toast("Nouvelle proposition prête"); },
  pfShift: (a, k) => { const s = pfFind(k); if (!s) return; SFX.tap(); openSheet(pfShiftSheet(s)); },
  pfShiftSave: (a, k) => {
    const s = pfFind(k); if (!s) return; const st = $("#pfSs")?.value, en = $("#pfSe")?.value;
    if (rhT2m(st) == null || rhT2m(en) == null || st === en) { SFX.err(); toast("Indiquez le début et la fin.", "err"); return; }
    if (st !== s.start || en !== s.end) { s.start = st; s.end = en; S.ui.pf.edited = true; }
    closeSheet(true); SFX.ok(); rerender();
  },
  pfSwap: (a, k, v) => { const s = pfFind(k); if (!s) return; const was = rhFirst(rhStaff(s.staffId)); s.staffId = v; S.ui.pf.edited = true; closeSheet(true); SFX.ok(); buzz(8); rerender(); toast(`${rhFirst(rhStaff(v))} remplace ${was}`); },
  pfDel: (a, k) => { const D = S.ui.pf; const i = D.shifts.findIndex((s) => s.k === k); if (i < 0) return; const [x] = D.shifts.splice(i, 1); pfRegaps(D); closeSheet(true); SFX.close(); buzz(6); rerender(); toast(`${rhFirst(rhStaff(x.staffId))} retiré du ${x.svc}`); },
  pfAdd: (a, id, v) => { const [d, svc, post] = String(v).split("|"); SFX.tap(); openSheet(pfAddSheet(d, svc, post || "")); },
  pfAddGo: (a, id, v) => {
    const A = S.ui.pfAdd; const p = rhStaff(v); if (!A || !p) return; const C = pfCfg(); const post = A.post || pfPostsOf(p)[0] || "cuisine"; const [st, en] = C.posts[post] ? C.posts[post][A.svc] : ["10:00", "15:00"];
    S.ui.pf.shifts.push({ k: rid6(), staffId: p.id, day: A.d, svc: A.svc, start: st, end: en, breakMin: 0, post }); pfRegaps(S.ui.pf);
    closeSheet(true); SFX.ok(); buzz(8); rerender(); if (!pfCanWork(p, A.d, A.svc)) toast(`${rhFirst(p)} avait dit être indisponible : pensez à le prévenir.`, "info");
  },
  pfCov: (a, id, d) => { SFX.tap(); openSheet(pfCovSheet(d)); },
  pfCovStep: (a, id, v) => { const i = $("#pfCovN"); if (!i) return; const n = Math.max(0, Math.min(999, Math.round(num(i.value) || 0) + +v)); i.value = n; SFX.tick(); buzz(4); i.classList.remove("bump"); void i.offsetWidth; i.classList.add("bump"); },
  pfCovSet: (a, id, v) => { const i = $("#pfCovN"); if (i) i.value = v; SFX.tick(); ACT.pfCovSave(); },
  pfCovSave: () => { const d = S.ui.pfCovD; const n = Math.max(0, Math.round(num($("#pfCovN")?.value) || 0)); S.ui.pf.cov = { ...(S.ui.pf.cov || {}), [d]: n }; pfRebuild(true); closeSheet(true); SFX.done(); rerender(); toast(`${rhDayLbl(d, true)} : ${n} couverts, équipe recalculée`); },
  pfCovReset: () => { const d = S.ui.pfCovD; const c = { ...(S.ui.pf.cov || {}) }; delete c[d]; S.ui.pf.cov = c; pfRebuild(true); closeSheet(true); SFX.ok(); rerender(); },
  pfAvail: () => { SFX.tap(); openSheet(pfAvailSheet()); },
  pfAvWho: (a, id, v) => { S.ui.pfAv = v; SFX.tick(); openSheet(pfAvailSheet()); },
  pfAvT: async (a, id, v) => {
    const [w, svc] = String(v).split("|"); const p = rhStaff(S.ui.pfAv); if (!p) return; const off = { ...(p.off || {}) }; const l = new Set(off[w] || []); l.has(svc) ? l.delete(svc) : l.add(svc);
    if (l.size) off[w] = [...l]; else delete off[w]; SFX.tick(); buzz(4); a.classList.toggle("no", l.has(svc)); a.classList.toggle("yes", !l.has(svc));
    const sid = await rhEnsure(p); await safe(DB.update("staff", sid, { off })); S.ui.pfAvDirty = true; setTimeout(() => openSheet(pfAvailSheet()), 30);
  },
  pfAvPost: async (a, id, v) => { const p = rhStaff(S.ui.pfAv); if (!p) return; const l = new Set(p.alsoPosts || []); l.has(v) ? l.delete(v) : l.add(v); SFX.tick(); const sid = await rhEnsure(p); await safe(DB.update("staff", sid, { alsoPosts: [...l] })); S.ui.pfAvDirty = true; setTimeout(() => openSheet(pfAvailSheet()), 30); },
  pfAvDone: () => { closeSheet(true); if (S.ui.pfAvDirty) { S.ui.pfAvDirty = false; pfRebuild(true); SFX.done(); rerender(); toast("Dispos enregistrées, proposition recalculée"); } else SFX.close(); },
  pfTune: () => { const C = pfCfg(); S.ui.pfT = JSON.parse(JSON.stringify(C)); SFX.tap(); openSheet(pfTuneSheet()); },
  pfTPer: (a, id, v) => { pfTRead(); const [k, d] = String(v).split("|"); const c = S.ui.pfT.posts[k]; const steps = [8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40, 50, 60, 70, 80, 100]; let i = steps.findIndex((x) => x >= c.per); if (i < 0) i = steps.length - 1; c.per = steps[Math.max(0, Math.min(steps.length - 1, i + +d))]; SFX.tick(); openSheet(pfTuneSheet()); },
  pfTMin: (a, id, v) => { pfTRead(); const [k, n] = String(v).split("|"); S.ui.pfT.posts[k].min = +n; SFX.tick(); openSheet(pfTuneSheet()); },
  pfTTarget: (a, id, v) => { pfTRead(); S.ui.pfT.target = Math.max(15, Math.min(50, S.ui.pfT.target + +v)); SFX.tick(); openSheet(pfTuneSheet()); },
  pfTuneSave: () => rhOnce("pfTune", async () => {
    pfTRead(); const C = S.ui.pfT; const posts = {}; Object.entries(C.posts).forEach(([k, c]) => (posts[k] = { per: c.per, min: c.min || 0, midi: c.midi, soir: c.soir }));
    const pfCfgDoc = { posts, target: C.target, ...(C.split != null ? { split: C.split } : {}) }; if (S.resto) S.resto.pfCfg = pfCfgDoc;
    await safe(DB.update("restos", S.rid, { pfCfg: pfCfgDoc })); closeSheet(true); pfRebuild(true); SFX.done(); rerender(); toast("Réglages enregistrés, proposition recalculée");
  }),
  pfPublish: () => {
    const D = S.ui.pf; if (!D || !D.shifts.length) return; const cur = S.shifts.filter((s) => s.day >= D.mon && s.day <= addDays(D.mon, 6));
    SFX.tap(); openSheet(`<div class="h2">Publier la semaine du ${rhWeekLbl(D.mon)} ?</div><p class="sub">${pfPl(D.shifts.length, "créneau")} pour ${pfPl(new Set(D.shifts.map((s) => s.staffId)).size, "personne")}. ${cur.length ? `Les ${pfPl(cur.length, "créneau")} déjà prévus cette semaine-là sont remplacés.` : ""} Chacun le voit aussitôt dans « Mon planning ».</p>${D.gaps.length ? `<div class="pf-n bad">${ico("pfGap")}<span>Il reste ${pfPl(D.gaps.reduce((x, g) => x + g.n, 0), "créneau")} sans personne.</span></div>` : ""}<button class="btn acc block" data-act="pfPublishGo">${ico("check")}Publier</button><button class="btn ghost" data-act="sheetClose">Pas encore</button>`);
  },
  pfPublishGo: () => rhOnce("pfPub", async () => {
    const D = S.ui.pf; const mon = D.mon; const cur = S.shifts.filter((s) => s.day >= mon && s.day <= addDays(mon, 6));
    const restore = cur.map((s) => { const { id, ...doc } = s; return [id, doc]; }); const ids = [];
    for (const p of new Set(D.shifts.map((s) => s.staffId))) await rhEnsure(rhStaff(p));
    for (const s of cur) await DB.del("shifts", s.id).catch(() => {});
    let t = Date.now(); for (const s of D.shifts) ids.push(await safe(DB.add("shifts", { staffId: s.staffId, day: s.day, start: s.start, end: s.end, breakMin: s.breakMin || 0, post: s.post || "", note: "", src: "auto", at: t++, by: S.me.id })));
    try { logEvent("rh", `a publié le planning de la semaine du ${rhWeekLbl(mon)} (planning intelligent, ${pfPl(ids.length, "créneau")})`); } catch (e) {}
    closeSheet(true); SFX.done(); buzz([8, 40, 8]); try { burst(); } catch (e) {}
    RH.undo = { ids, restore }; S.ui.rhPlanWeek = mon; S.ui.rhDay = null; S.ui.pf = null; go("planning");
    setTimeout(() => { rhUndoToast(`Planning publié · ${pfPl(ids.length, "créneau")}`); setTimeout(() => { if (S.route === "planning") openSheet(`<div class="h2">C'est en ligne</div><p class="sub">L'équipe voit ses horaires dans « Mon planning ». Vous pouvez aussi l'envoyer au groupe.</p><button class="btn acc block" data-act="rhSend">${ico("rhsend")}Envoyer à l'équipe</button><button class="btn ghost" data-act="sheetClose">Plus tard</button>`); }, 1400); }, 250);
  }),
});
function pfTRead() { const C = S.ui.pfT; if (!C) return; $$("[data-pft]").forEach((i) => { const [k, s, j] = i.dataset.pft.split("|"); if (i.value && C.posts[k]) C.posts[k][s][+j] = i.value; }); }
