/* Growth Gusto — area: rh (pointeuse, planning, fiches employés & coûts).
   Data (V3 contract): staff, shifts, punches. A member (compte.js) with no staff file is shown as a « virtual » employee
   with the deterministic id "m_<memberId>"; the file is written the first time it is needed (punch, edit), so no duplicates. */

/* ───────────── constants + small helpers ───────────── */
const RH = { kiosk: false, pin: null, idleT: null, wake: null, doneT: null, undo: null };
// c = solid swatch (legend, print, image), bg / ink = the pastel shift block and its readable text (design V2)
const RH_POSTS = { cuisine: { t: "Cuisine", c: "#5B2BFF", bg: "#EFE9FF", ink: "#3A10D8" }, salle: { t: "Salle", c: "#6FA3F5", bg: "#E6F0FF", ink: "#2F5FBF" }, plonge: { t: "Plonge", c: "#F6B93B", bg: "#FFF3D6", ink: "#7A5A1A" }, bar: { t: "Bar", c: "#EF5A3C", bg: "#FFE9DE", ink: "#C8432A" } };
const RH_CONTRACTS = { CDI: "CDI", CDD: "CDD", extra: "Extra", apprenti: "Apprenti" };
const RH_ROLES = ["Chef de cuisine", "Second", "Commis", "Pâtissier", "Plongeur", "Responsable de salle", "Serveur", "Barman", "Apprenti", "Gérant"];
const RH_KIND = {
  in: { t: "Arrivée", ic: "into", c: "#5B2BFF", msg: (n) => `Bon service, ${n} !` },
  breakStart: { t: "Pause", ic: "rhcoffee", c: "#D99A1E", msg: () => "Bonne pause !" },
  breakEnd: { t: "Fin de pause", ic: "rhplay", c: "#5B2BFF", msg: () => "C'est reparti !" },
  out: { t: "Départ", ic: "out", c: "#1B1530", msg: (n) => `Merci ${n}, à bientôt !` },
};
const RH_DSHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const RH_DLONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const RH_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const RH_PRESETS = [["Midi", "10:00", "15:00", 0], ["Soir", "18:00", "23:30", 0], ["Journée", "09:00", "17:00", 30], ["Coupure", "10:00", "15:00", 0, "18:00", "23:00"]];
Object.assign(IC, {
  rhcoffee: ["M10 2v2", "M14 2v2", "M6 2v2", "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"],
  rhplay: ["f:M6 3l14 9-14 9z", "M6 3l14 9-14 9z"],
  rhcopy: ["r:8,8,14,14,2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  rhexpand: ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"],
  rhsend: ["M14.5 9.5 21 3", "M21 3l-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1z"],
  rhid: ["r:2,5,20,14,2", "c:8,12,2", "M14 10h4", "M14 14h4"],
  rhfwd: ["m9 18 6-6-6-6"],
});

const rhHash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
const rhPinHash = (id, code) => (typeof ccHash === "function" ? ccHash : rhHash)(id + ":" + code);
const rhIsMgr = () => ["gerant", "chef"].includes(myRole());
/* salaires, coûts et export paie : pack Chef. Avec Second, la pointeuse et le planning restent complets, sans les euros. */
const rhPaid = () => typeof abHas !== "function" || abHas("salaires");
const rhCanEdit = () => (typeof canSee === "function" ? canSee("salaires") : myRole() === "gerant");
const rhIsBoss = () => rhPaid() && rhCanEdit();
const rhCanStaff = () => (typeof canSee === "function" ? canSee("staff") : myRole() === "gerant");
const rhT2m = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const rhDur = (min) => { min = Math.max(0, Math.round(min || 0)); if (min < 60) return `${min} min`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${pad(m)}` : `${h} h`; };
const rhHh = (min) => { min = Math.max(0, Math.round(min || 0)); const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${pad(m)}` : `${h}h`; };
const rhDec = (min) => (Math.round((min || 0) / 60 * 100) / 100).toFixed(2).replace(".", ",");
const rhEur = (n, d = 0) => `${(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
const rhMonday = (k = dayKey()) => { const d = parseDay(k); return addDays(k, -((d.getDay() + 6) % 7)); };
const rhWeekDays = (mon) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i));
const rhDayLbl = (k, long) => { const d = parseDay(k); const i = (d.getDay() + 6) % 7; return `${long ? RH_DLONG[i] : RH_DSHORT[i]} ${d.getDate()}${long ? " " + RH_MS[d.getMonth()] : ""}`; };
const rhWeekLbl = (mon) => { const a = parseDay(mon), b = parseDay(addDays(mon, 6)); return a.getMonth() === b.getMonth() ? `${a.getDate()} au ${b.getDate()} ${RH_MS[b.getMonth()]}` : `${a.getDate()} ${RH_MS[a.getMonth()]} au ${b.getDate()} ${RH_MS[b.getMonth()]}`; };
const rhAt = (day, t) => { const d = parseDay(day); const m = rhT2m(t) || 0; d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };
const rhKey = (x) => (x == null ? dayKey() : typeof x === "string" ? x.slice(0, 10) : dayKey(new Date(x)));
const rhNum = (v, d) => { const n = num(v); return n == null ? d : n; };

/* ───────────── people ───────────── */
function rhNorm(s) {
  const m = s.memberId ? S.members.find((x) => x.id === s.memberId) : null;
  return { contract: "CDI", weeklyHours: 35, chargesPct: 42, active: true, ...s, name: s.name || m?.name || "Sans nom", color: s.color || m?.color || colorFor(s.id) };
}
function rhPeople({ all = false } = {}) {
  const linked = new Set(S.staff.map((s) => s.memberId).filter(Boolean)); const ids = new Set(S.staff.map((s) => s.id));
  const names = new Set(S.staff.filter((s) => !s.memberId && s.name).map((s) => s.name.trim().toLowerCase()));
  const virt = S.members.filter((m) => !linked.has(m.id) && !ids.has("m_" + m.id) && !names.has((m.name || "").trim().toLowerCase())).map((m) => ({
    id: "m_" + m.id, memberId: m.id, name: m.name || "Sans nom", color: m.color || colorFor(m.id),
    role: m.role === "gerant" ? "Gérant" : m.role === "chef" ? "Chef de cuisine" : "", post: m.role === "chef" ? "cuisine" : "", _virtual: true,
  }));
  return [...S.staff, ...virt].map(rhNorm).filter((p) => all || p.active !== false).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
const rhStaff = (id) => rhPeople({ all: true }).find((p) => p.id === id);
const rhFirst = (p) => firstName(p?.name) || "—";
const rhAva = (p, s = 44, ring) => `<span class="rh-ava${ring ? " " + ring : ""}" style="--s:${s}px;--c:${esc(p?.color || "#5A6386")}">${esc(initials(p?.name || "?"))}</span>`;
async function rhEnsure(p) {
  if (!p || !p._virtual) return p?.id;
  const { _virtual, ...doc } = p; await DB.set("staff", p.id, { ...doc, start: dayKey(), createdAt: Date.now() }); return p.id;
}

/* ───────────── punches → worked time ───────────── */
const rhPunchList = (sid, from, to) => S.punches.filter((p) => p.staffId === sid && !p.void && (!from || p.day >= from) && (!to || p.day <= to)).sort((a, b) => a.at - b.at);
/* one person's punches (ascending) → sessions, work minutes, current state. An open session counts up to now only when recent (< 16 h). */
function rhCalc(list, now = Date.now()) {
  let st = "off", cur = null, bs = 0, work = 0, brk = 0, last = 0; const anomalies = [], sessions = [];
  const close = (end, forgot) => { if (!cur) return; if (st === "pause") { brk += end - bs; cur.br += end - bs; } cur.out = end; cur.forgot = forgot; cur.w = Math.max(0, end - cur.in - cur.br); work += cur.w; sessions.push(cur); cur = null; st = "off"; };
  for (const p of list) {
    if (p.kind === "in") { if (st !== "off") { anomalies.push({ day: p.day, t: "Arrivée sans départ avant" }); close(last, true); } cur = { in: p.at, br: 0, day: p.day }; st = "in"; }
    else if (p.kind === "breakStart") { if (st === "in") { bs = p.at; st = "pause"; } }
    else if (p.kind === "breakEnd") { if (st === "pause") { brk += p.at - bs; cur.br += p.at - bs; st = "in"; } }
    else if (p.kind === "out") { if (st !== "off") close(p.at); else anomalies.push({ day: p.day, t: "Départ sans arrivée" }); }
    last = p.at;
  }
  let open = false, since = 0;
  if (cur) {
    if (now - last < 16 * 3600e3) { open = true; since = st === "pause" ? bs : cur.in; const extraBr = st === "pause" ? now - bs : 0; const w = Math.max(0, now - cur.in - cur.br - extraBr); work += w; brk += extraBr; sessions.push({ ...cur, w, open: true }); }
    else { anomalies.push({ day: cur.day, t: "Départ oublié" }); close(last, true); }
  }
  return { work: work / 60000, brk: brk / 60000, state: open ? st : "off", since, sessions, anomalies, last };
}
function rhState(sid) {
  const today = dayKey(), list = rhPunchList(sid, addDays(today, -1), today); const c = rhCalc(list);
  const todayMin = c.sessions.filter((s) => s.day === today || s.open).reduce((x, s) => x + s.w, 0) / 60000;
  return { ...c, todayMin, todayList: list.filter((p) => p.day === today) };
}
function rhDayMin(sid, from, to) { /* {day: {min, brk, anomalies, sessions}} from punches */
  const out = {}; const by = {}; rhPunchList(sid, from, to).forEach((p) => (by[p.day] ||= []).push(p));
  Object.entries(by).forEach(([d, l]) => { const c = rhCalc(l); out[d] = { min: c.work, anomalies: c.anomalies, brk: c.brk, sessions: c.sessions }; });
  return out;
}

/* ───────────── shifts ───────────── */
function rhIv(s) { const base = parseDay(s.day).getTime() / 60000; const a = rhT2m(s.start) ?? 0; let b = rhT2m(s.end) ?? a; if (b <= a) b += 1440; return { s: base + a, e: base + b, w: Math.max(0, b - a - (+s.breakMin || 0)), day: s.day, sh: s }; }
const rhShiftMin = (s) => rhIv(s).w;
const rhShiftsOf = (sid, from, to) => S.shifts.filter((s) => s.staffId === sid && s.day >= from && s.day <= to).sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start));
const rhShiftsDay = (sid, day) => rhShiftsOf(sid, day, day);

/* ───────────── HCR overtime + costs (indicative) ───────────── */
function rhOT(min) { const h = (min || 0) / 60; const b10 = Math.min(4, Math.max(0, h - 35)), b20 = Math.min(4, Math.max(0, h - 39)), b50 = Math.max(0, h - 43); return { b10, b20, b50, h: b10 + b20 + b50, bonus: b10 * 0.1 + b20 * 0.2 + b50 * 0.5 }; }
const rhRate = (p) => rhNum(p?.hourlyGross, 0);
const rhCh = (p) => rhNum(p?.chargesPct, 42);
const rhWeekGross = (min, p) => ((min || 0) / 60 + rhOT(min).bonus) * rhRate(p);
const rhLoadedRate = (p) => rhRate(p) * (1 + rhCh(p) / 100);
const rhMonthGross = (p) => rhWeekGross(rhNum(p.weeklyHours, 35) * 60, p) * 52 / 12;

/* Cross-area helper (V3 contract): labour cost between two days (inclusive, "YYYY-MM-DD", Date or timestamp),
   from punches, falling back to planned shifts for a person with no punch in the range. → { hours, gross, loaded, byStaff, source, noRate } */
function staffCost(from, to) {
  const a = rhKey(from), b = rhKey(to ?? from); const res = { hours: 0, gross: 0, loaded: 0, from: a, to: b, byStaff: [], noRate: 0, source: "" }; const srcs = new Set();
  rhPeople({ all: true }).forEach((p) => {
    const dm = rhDayMin(p.id, a, b); let perDay = Object.fromEntries(Object.entries(dm).map(([d, v]) => [d, v.min])); let src = "pointage";
    if (!Object.keys(perDay).length) { perDay = {}; rhShiftsOf(p.id, a, b).forEach((s) => { perDay[s.day] = (perDay[s.day] || 0) + rhShiftMin(s); }); src = "planning"; }
    const tot = Object.values(perDay).reduce((x, y) => x + y, 0); if (!tot) return;
    const weeks = {}; Object.entries(perDay).forEach(([d, m]) => { const w = rhMonday(d); weeks[w] = (weeks[w] || 0) + m; });
    const gross = Object.values(weeks).reduce((x, m) => x + rhWeekGross(m, p), 0); const loaded = gross * (1 + rhCh(p) / 100);
    if (!rhRate(p)) res.noRate++; srcs.add(src);
    res.hours += tot / 60; res.gross += gross; res.loaded += loaded; res.byStaff.push({ id: p.id, name: p.name, hours: tot / 60, gross, loaded, source: src });
  });
  res.source = srcs.size > 1 ? "mixte" : [...srcs][0] || "";
  res.hours = Math.round(res.hours * 100) / 100; res.gross = Math.round(res.gross * 100) / 100; res.loaded = Math.round(res.loaded * 100) / 100;
  return res;
}
window.staffCost = staffCost;

/* ───────────── legal reminders (HCR, indicative, never blocking) ─────────────
   Convention collective HCR (avenant n° 1 du 13 juillet 2004 et suivants), from memory, to be confirmed by the accountant:
   max. per day 11 h for cooks, 11 h 30 for the other staff, 12 h for night watchmen (Code du travail default: 10 h); 11 h of rest
   in a row between two days (so 13 h of amplitude at most); 48 h max. in one week, 46 h on average over 12 weeks; 2 days off a week
   (not necessarily in a row). Overtime counted from the 36th hour: +10 % up to 39 h, +20 % from 40 to 43 h, +50 % beyond. */
const rhIsNight = (p) => /veill/i.test(p?.role || "");
function rhDayCap(p, cuis) { return rhIsNight(p) ? [720, "12 h max. pour un veilleur de nuit"] : cuis ? [660, "11 h max. en cuisine"] : [690, "11 h 30 max."]; }
/* intervals of one person: planned shifts, or worked sessions from the time clock */
/* une personne sur plusieurs établissements (pack Chef, plusieurs restaurants) : la même fiche, avec le même id, dans chaque restaurant
   (staff.sites = [rid…]). Ses créneaux prévus ailleurs comptent pour les repères HCR (48 h, repos, amplitude) et les heures sup. de la semaine. */
const rhSitesOf = (sid) => { const p = rhStaff(sid); return (p && Array.isArray(p.sites) ? p.sites : []).filter((r) => r && r !== S.rid); };
const rhSiteName = (rid) => ((S.restos || []).find((r) => r.id === rid) || {}).name || "un autre restaurant";
function rhElsewhere(sid, from, to) {
  const sites = rhSitesOf(sid); if (!sites.length || typeof mrBundle !== "function") return [];
  const out = [];
  sites.forEach((rid) => { let B = null; try { B = mrBundle(rid); } catch (e) {} if (!B || !Array.isArray(B.shifts)) return; B.shifts.filter((x) => x.staffId === sid && x.day >= from && x.day <= to && x.start && x.end).forEach((x) => out.push({ ...x, _rid: rid })); });
  return out;
}
const rhIvAway = (x) => { const v = rhIv(x); v.away = x._rid; return v; };
function rhIvsPlan(sid, from, to) { return [...rhShiftsOf(sid, from, to).map(rhIv), ...rhElsewhere(sid, from, to).map(rhIvAway)].sort((x, y) => x.s - y.s); }
function rhLegalOf(sid, mon, ivs) {
  const days = rhWeekDays(mon); const out = { day: {}, week: [] }; const add = (d, lvl, t, k) => (out.day[d] ||= []).push({ lvl, t, k });
  let total = 0, worked = 0; const p = rhStaff(sid); const defPost = p?.post;
  days.forEach((d) => {
    const l = ivs.filter((v) => v.day === d); if (!l.length) return; worked++;
    const w = l.reduce((x, v) => x + v.w, 0); total += w;
    const cuis = l.some((v) => (v.sh.post || defPost) === "cuisine"); const [lim, lt] = rhDayCap(p, cuis);
    if (w > lim) add(d, "bad", `${rhDur(w)} de travail ce jour : ${lt} (HCR)`, `${rhDur(w)} de travail`);
  });
  /* daily rest: 11 h in a row, so one note per day at most: the short night first, otherwise the day's amplitude (13 h max.) */
  for (let i = 1; i < ivs.length; i++) { const a = ivs[i - 1], c = ivs[i]; if (c.day !== a.day && days.includes(c.day)) { const gap = c.s - a.e; if (gap < 660) add(c.day, "bad", `Repos de ${rhDur(Math.max(0, gap))} depuis la veille : 11 h minimum`, `Repos ${rhDur(Math.max(0, gap))}`); } }
  days.forEach((d) => {
    const l = ivs.filter((v) => v.day === d); if (!l.length || (out.day[d] || []).some((x) => x.t.startsWith("Repos"))) return;
    const amp = Math.max(...l.map((v) => v.e)) - Math.min(...l.map((v) => v.s)); if (amp > 780) add(d, "bad", `Amplitude de ${rhDur(amp)} : 13 h max. (11 h de repos)`, `Amplitude ${rhDur(amp)}`);
  });
  if (total > 48 * 60) out.week.push({ lvl: "bad", t: `${rhDur(total)} sur la semaine : 48 h maximum`, k: `${rhDur(total)} > 48 h` });
  if (worked >= 7) out.week.push({ lvl: "bad", t: "Aucun jour de repos dans la semaine : 2 jours en HCR", k: "Aucun jour off" });
  else if (worked === 6) out.week.push({ lvl: "warn", t: "Un seul jour de repos : 2 jours en HCR", k: "1 seul jour off" });
  out.total = total; out.worked = worked;
  out.count = out.week.length + Object.values(out.day).reduce((x, l) => x + l.length, 0);
  out.bad = out.week.some((x) => x.lvl === "bad") || Object.values(out.day).some((l) => l.some((x) => x.lvl === "bad"));
  return out;
}
const rhLegal = (sid, mon) => rhLegalOf(sid, mon, rhIvsPlan(sid, addDays(mon, -1), addDays(mon, 6)));
/* hours of one week: planned, clocked, and the hours that count: a day with punches counts what was clocked; once someone clocks in
   that week, a past day without punch counts 0 and today / the days to come count what is planned. No punch at all = the planning. */
function rhWeekPlan(sid, mon) {
  const sun = addDays(mon, 6), today = dayKey(); const sh = rhShiftsOf(sid, addDays(mon, -1), sun); const dm = rhDayMin(sid, addDays(mon, -1), sun);
  const has = Object.keys(dm).some((d) => d >= mon); const keep = (d) => !(dm[d] && dm[d].sessions.length) && (!has || d >= today);
  const ivs = [];
  Object.values(dm).forEach((v) => v.sessions.forEach((x) => { const e = x.open ? Date.now() : x.out; if (e) ivs.push({ s: x.in / 60000, e: e / 60000, w: x.w / 60000, day: x.day, sh: {} }); }));
  sh.filter((x) => keep(x.day)).forEach((x) => ivs.push(rhIv(x)));
  rhElsewhere(sid, addDays(mon, -1), sun).forEach((x) => ivs.push(rhIvAway(x)));
  return { ivs: ivs.sort((a, b) => a.s - b.s), dm, sh, has, keep };
}
function rhWeekHours(sid, mon) {
  const W = rhWeekPlan(sid, mon); const days = rhWeekDays(mon); const today = dayKey();
  const plan = W.sh.filter((s) => s.day >= mon).reduce((x, s) => x + rhShiftMin(s), 0);
  const punch = days.reduce((x, d) => x + (W.dm[d]?.min || 0), 0);
  const used = W.ivs.filter((v) => v.day >= mon).reduce((x, v) => x + v.w, 0);
  const src = !W.has ? "prévu" : days[6] < today ? "pointé" : "pointé + prévu";
  const away = W.ivs.filter((v) => v.away && v.day >= mon).reduce((x, v) => x + v.w, 0);
  return { plan, punch, has: W.has, used, away, src, days: new Set(W.ivs.filter((v) => v.day >= mon).map((v) => v.day)).size, ivs: W.ivs };
}
/* 46 h on average over 12 consecutive weeks (the weeks with hours; the shown week is the last one) */
function rhAvg12(sid, mon) {
  const ws = []; for (let i = 11; i >= 0; i--) { const h = rhWeekHours(sid, addDays(mon, -7 * i)).used; if (h) ws.push(h); }
  return { avg: ws.length ? ws.reduce((x, y) => x + y, 0) / ws.length : 0, n: ws.length };
}
const W_SRC = (h, d) => (h.ivs.some((v) => v.day === d && !v.sh.id) ? "pointé" : "prévu");
/* everything the hours card and the export need for one person and one week */
function rhHoursOf(p, mon) {
  const h = rhWeekHours(p.id, mon); const ot = rhOT(h.used); const a12 = rhAvg12(p.id, mon);
  const lg = rhLegalOf(p.id, mon, h.ivs); const alerts = [];
  lg.week.forEach((x) => alerts.push({ ...x, src: h.src })); Object.entries(lg.day).sort().forEach(([d, l]) => l.forEach((x) => alerts.push({ ...x, src: W_SRC(h, d), d })));
  if (a12.n >= 2 && a12.avg > 46 * 60) alerts.push({ lvl: "bad", t: `${rhHh(a12.avg)} en moyenne sur ${a12.n} semaines : 46 h maximum`, k: `Moyenne ${rhDur(a12.avg)} > 46 h`, src: "moyenne" });
  return { ...h, ot, a12, alerts, bad: alerts.some((x) => x.lvl === "bad") };
}

/* ═══════════════════════ POINTEUSE ═══════════════════════ */
const rhClockIn = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}<small>:${pad(d.getSeconds())}</small>`; };
function rhTile(p, i) {
  const s = rhState(p.id); const today = dayKey(); const plan = rhShiftsDay(p.id, today);
  const late = s.state === "off" && !s.todayList.length && plan.length && Date.now() > rhAt(today, plan[0].start) + 10 * 60000 && Date.now() < rhAt(today, plan[0].end);
  const ring = s.state === "in" ? "on" : s.state === "pause" ? "pz" : "";
  let line;
  if (s.state === "in") line = `<span class="rh-st on"><i></i>En service · <span class="mono" data-rh-run="${s.since}" data-rh-base="${s.todayMin - (Date.now() - s.since) / 60000}">${rhDur(s.todayMin)}</span></span>`;
  else if (s.state === "pause") line = `<span class="rh-st pz"><i></i>En pause · <span class="mono" data-rh-pz="${s.since}">${rhDur((Date.now() - s.since) / 60000)}</span></span>`;
  else if (s.todayList.length) line = `<span class="rh-st">Parti · ${rhDur(s.todayMin)}</span>`;
  else if (late) line = `<span class="rh-st late"><i></i>Attendu à ${esc(plan[0].start)}</span>`;
  else line = `<span class="rh-st">${plan.length ? `Prévu ${esc(plan[0].start)}–${esc(plan[plan.length - 1].end)}` : "Pas encore arrivé"}</span>`;
  return `<button class="rh-tile st ${ring}${late ? " late" : ""}" style="--i:${i + 3}" data-act="rhTile" data-id="${esc(p.id)}" aria-label="Pointer : ${esc(p.name)}">${rhAva(p, 66, ring)}<b>${esc(rhFirst(p))}</b>${line}</button>`;
}
function rhTimesheet() {
  const mon = S.ui.rhTsWeek || rhMonday(); const days = rhWeekDays(mon); const ppl = rhPeople(); const thisW = mon === rhMonday();
  let sumMin = 0, sumOT = 0;
  const rows = ppl.map((p) => {
    const dm = rhDayMin(p.id, mon, days[6]); const tot = days.reduce((x, d) => x + (dm[d]?.min || 0), 0); sumMin += tot; const ot = rhOT(tot); sumOT += ot.h;
    const planned = rhShiftsOf(p.id, mon, days[6]).reduce((x, s) => x + rhShiftMin(s), 0);
    const contract = rhNum(p.weeklyHours, 35) * 60; const over = tot - contract; const anom = days.some((d) => (dm[d]?.anomalies || []).length);
    const max = Math.max(600, ...days.map((d) => dm[d]?.min || 0));
    return `<button class="rh-ts-row" data-act="rhTsOpen" data-id="${esc(p.id)}">
      <span class="rh-ts-who">${rhAva(p, 34)}<span><b>${esc(p.name)}</b><em>${planned ? `prévu ${rhHh(planned)}` : "rien de prévu"}${anom ? ` · <span class="rh-anom">${ico("alert")}à corriger</span>` : ""}</em></span></span>
      <span class="rh-ts-days">${days.map((d) => { const m = dm[d]?.min || 0; const bad = (dm[d]?.anomalies || []).length; return `<span class="rh-ts-d${d === dayKey() ? " today" : ""}${bad ? " bad" : ""}"><u>${RH_DSHORT[days.indexOf(d)][0]}</u><i style="--h:${Math.round(m / max * 100)}%"></i><em class="mono">${m ? rhHh(m) : "·"}</em></span>`; }).join("")}</span>
      <span class="rh-ts-tot"><b class="mono">${rhHh(tot)}</b>${over > 0 && contract ? `<span class="pill warn">+${rhHh(over)}</span>` : `<em>sur ${rhHh(contract)}</em>`}</span>
      ${ot.h > 0 ? `<span class="rh-otb">Heures sup. : ${[ot.b10 ? `${fmt(ot.b10, 1)} h à +10 %` : "", ot.b20 ? `${fmt(ot.b20, 1)} h à +20 %` : "", ot.b50 ? `${fmt(ot.b50, 1)} h à +50 %` : ""].filter(Boolean).join(" · ")}</span>` : ""}
    </button>`;
  }).join("");
  return `<div class="glass rh-card st" style="--i:20">
    <div class="row rh-hd"><div><div class="lbl">Feuille de temps</div><div class="h3">Semaine du ${rhWeekLbl(mon)}</div></div>
      <div class="hstack rh-wnav"><button class="iconbtn" data-act="rhTsWeek" data-v="-7" aria-label="Semaine précédente">${ico("back")}</button>${thisW ? "" : `<button class="chip" data-act="rhTsWeek" data-v="0">Cette semaine</button>`}<button class="iconbtn" data-act="rhTsWeek" data-v="7" aria-label="Semaine suivante">${ico("rhfwd")}</button></div></div>
    <div class="rh-ts-head"><span></span><span class="rh-ts-days">${days.map((d, i) => `<em class="${d === dayKey() ? "today" : ""}">${RH_DSHORT[i]}</em>`).join("")}</span><span></span></div>
    <div class="rh-ts">${rows}</div>
    <div class="rh-ts-foot"><span><b class="mono">${rhHh(sumMin)}</b> pointées${sumOT ? ` · <b class="mono">${fmt(sumOT, 1)} h</b> sup.` : ""}</span><button class="btn soft sm" data-act="rhExport">${ico("download")}Export comptable</button></div>
    <p class="note">Touchez une ligne pour corriger ou ajouter un pointage oublié. Heures sup. indicatives (HCR) : dès la 36e heure, +10 % jusqu'à 39 h, +20 % de 40 à 43 h, +50 % au-delà.</p>
  </div>`;
}
VIEWS.pointeuse = {
  get hideTabs() { return RH.kiosk; },
  render() {
    const ppl = rhPeople(); const states = ppl.map((p) => rhState(p.id)); const present = states.filter((s) => s.state !== "off").length;
    const d = new Date(); const dl = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    const right = `<button class="iconbtn" data-act="rhKiosk" aria-label="${RH.kiosk ? "Quitter le mode borne" : "Mode borne"}" title="${RH.kiosk ? "Quitter le mode borne" : "Mode borne (tablette à l'entrée)"}">${ico(RH.kiosk ? "x" : "rhexpand")}</button>`;
    const empty = !ppl.length ? `<div class="glass empty st" style="--i:3"><span class="ic">${ico("users")}</span><b>Personne à pointer</b>Ajoutez vos employés : chacun pointera avec son prénom et un code à 4 chiffres.${rhCanStaff() ? `<div style="margin-top:14px"><button class="btn acc" data-go="staff">${ico("plus")}Ajouter un employé</button></div>` : " Demandez au gérant de créer les fiches."}</div>` : "";
    return `<div class="inner rh-pt${RH.kiosk ? " kiosk" : ""}">${topBar("Pointeuse", { right, noBack: RH.kiosk })}
      <div class="rh-hero st" style="--i:1"><div class="rh-hero-l"><b class="mono rh-clock" id="rhClock">${rhClockIn()}</b><span class="rh-date">${dl}</span></div>
        <div class="rh-hero-r"><b class="mono">${present}</b><span>présent${present > 1 ? "s" : ""}</span><div class="rh-avs">${ppl.filter((p, i) => states[i].state !== "off").slice(0, 6).map((p) => rhAva(p, 26)).join("")}</div></div></div>
      ${ppl.length ? `<div class="lbl st" style="--i:2">Touchez votre prénom pour pointer</div><div class="rh-tiles">${ppl.map(rhTile).join("")}</div>` : empty}
      ${rhIsMgr() && !RH.kiosk && ppl.length ? rhTimesheet() : ""}
      ${!RH.kiosk && rhIsMgr() ? `<div class="rh-links st" style="--i:24"><button class="btn soft sm" data-go="planning">${ico("cal")}Planning</button>${rhCanStaff() ? `<button class="btn soft sm" data-go="staff">${ico("rhid")}Employés</button>` : ""}<button class="btn soft sm" data-act="rhPdf" data-id="all">${ico("download")}Relevés PDF</button><button class="btn soft sm rh-tkt${rhTicketOn() ? " on" : ""}" data-act="rhTicketSet" aria-pressed="${rhTicketOn()}">${ico("printer")}Ticket au départ : ${rhTicketOn() ? "proposé" : "non"}</button></div>` : ""}
    </div>`;
  },
  after() { rhTickStart(); },
};
/* the clock + running timers tick without a re-render */
let rhTickH = null;
function rhTickStart() {
  if (rhTickH) return;
  rhTickH = setInterval(() => {
    if (S.route !== "pointeuse") return;
    const c = $("#rhClock"); if (c) c.innerHTML = rhClockIn();
    $$("[data-rh-run]").forEach((e) => { e.textContent = rhDur(+e.dataset.rhBase + (Date.now() - +e.dataset.rhRun) / 60000); });
    $$("[data-rh-pz]").forEach((e) => { e.textContent = rhDur((Date.now() - +e.dataset.rhPz) / 60000); });
  }, 1000);
}

/* ── PIN + punch sheet ── */
function rhPinHTML() {
  const P = RH.pin, p = rhStaff(P.sid); const dots = [0, 1, 2, 3].map((i) => `<i class="${i < P.code.length ? "on" : ""}"></i>`).join("");
  const msg = P.err ? `<span style="color:var(--bad)">${esc(P.err)}</span>` : P.mode === "new" ? "Première fois : choisissez votre code à 4 chiffres" : P.mode === "confirm" ? "Tapez-le une deuxième fois" : "Tapez votre code";
  return `<div class="rh-pin">
    <div class="rh-pin-who">${rhAva(p, 84)}<div class="h2">${esc(rhFirst(p))}</div><div class="sub">${msg}</div></div>
    <div class="rh-dots${P.err ? " err shake" : ""}">${dots}</div>
    <div class="keypad rh-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="rhKey" data-v="${d}">${d}</button>`).join("")}<button data-act="sheetClose" aria-label="Annuler" class="rh-kx">${ico("x")}</button><button data-act="rhKey" data-v="0">0</button><button data-act="rhKey" data-v="del" aria-label="Effacer">${ico("back")}</button></div>
  </div>`;
}
function rhActHTML(sid) {
  const p = rhStaff(sid), s = rhState(sid), today = dayKey(); const plan = rhShiftsDay(sid, today);
  const mon = rhMonday(); const wk = Object.values(rhDayMin(sid, mon, addDays(mon, 6))).reduce((x, v) => x + v.min, 0);
  const acts = s.state === "off" ? ["in"] : s.state === "in" ? ["breakStart", "out"] : ["breakEnd", "out"];
  const h = new Date().getHours(); const hi = s.state === "off" ? (h < 18 ? "Bonjour" : "Bonsoir") : "Re-bonjour";
  const stl = s.state === "in" ? `<span class="pill ok"><span class="dot"></span>En service depuis ${hm(s.since)}</span>` : s.state === "pause" ? `<span class="pill warn">En pause depuis ${hm(s.since)}</span>` : `<span class="pill neu">Pas en service</span>`;
  return `<div class="rh-act">
    <div class="rh-act-hd">${rhAva(p, 60, s.state === "in" ? "on" : s.state === "pause" ? "pz" : "")}<div><div class="h2">${hi} ${esc(rhFirst(p))}</div>${stl}</div></div>
    <div class="rh-act-kpi"><span><b class="mono">${rhHh(s.todayMin)}</b>aujourd'hui</span><span><b class="mono">${rhHh(wk)}</b>cette semaine</span><span><b class="mono">${plan.length ? esc(plan[0].start) : "—"}</b>${plan.length ? `prévu → ${esc(plan[plan.length - 1].end)}` : "rien de prévu"}</span></div>
    <div class="rh-bigs n${acts.length}">${acts.map((k) => `<button class="rh-big k-${k}" data-act="rhPunch" data-id="${esc(sid)}" data-v="${k}">${ico(RH_KIND[k].ic)}<b>${RH_KIND[k].t}</b><em class="mono">${hm(Date.now())}</em></button>`).join("")}</div>
    ${s.todayList.length ? `<div class="rh-tl">${s.todayList.map((x) => `<span class="k-${x.kind}">${ico(RH_KIND[x.kind].ic)}<b class="mono">${hm(x.at)}</b>${RH_KIND[x.kind].t}${x.edited ? " · corrigé" : ""}</span>`).join("")}</div>` : ""}
    <div class="rh-act-x">${s.todayList.length ? `<button class="btn soft sm" data-act="rhTicket" data-id="${esc(sid)}" data-v="${today}">${ico("printer")}Ticket du jour</button>` : ""}<button class="btn soft sm" data-act="rhPdf" data-id="${esc(sid)}" data-v="self">${ico("download")}Mes heures en PDF</button></div>
    <button class="btn ghost" data-act="sheetClose">Ce n'est pas moi</button>
  </div>`;
}
function rhIdle() { clearTimeout(RH.idleT); RH.idleT = setTimeout(() => { if ($("#sheet").classList.contains("open") && $("#sheetBody .rh-act,#sheetBody .rh-pin")) { closeSheet(); RH.pin = null; } }, 40000); }
function rhPinOk(p, code) {
  const m = p.memberId ? S.members.find((x) => x.id === p.memberId) : null;
  if (m && rhMemberHasPin(m)) return typeof ccVerifyPin === "function" ? ccVerifyPin(m.id, code) : typeof ccPinOk === "function" ? ccPinOk(m, code) : m.pinH === rhPinHash(m.id, code);
  return !!p.pinHash && p.pinHash === rhPinHash(p.id, code);
}
const rhMemberHasPin = (m) => (typeof ccHasPin === "function" ? ccHasPin(m) : !!(m && m.pinH));
const rhHasPin = (p) => { const m = p.memberId ? S.members.find((x) => x.id === p.memberId) : null; return rhMemberHasPin(m) || !!p.pinHash; };
function rhDone(kind, p, extra, ask) {
  let el = $("#rhDone"); if (!el) { el = document.createElement("div"); el.id = "rhDone"; el.className = "rh-done"; el.setAttribute("role", "status"); document.body.appendChild(el); el.addEventListener("click", () => el.classList.remove("on")); }
  const K = RH_KIND[kind]; el.style.setProperty("--k", K.c);
  el.innerHTML = `<div class="rh-done-c"><span class="rh-done-ic"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15 27l7 7 15-16"/></svg></span>
    <span class="rh-done-k">${ico(K.ic)}${K.t}</span><b class="mono">${hm(Date.now())}</b><div class="h2">${esc(K.msg(rhFirst(p)))}</div>${extra ? `<span class="sub${ask ? " rh-done-x" : ""}">${esc(extra)}</span>` : ""}
    ${ask ? `<div class="rh-done-q"><span>Voulez-vous imprimer un ticket ?</span><div class="rh-done-b"><button class="btn ghost" data-act="rhTicketNo">Non merci</button><button class="btn acc" data-act="rhTicket" data-id="${esc(p.id)}" data-v="${esc(ask)}">${ico("printer")}Imprimer le ticket</button></div></div>` : ""}</div>`;
  el.classList.toggle("ask", !!ask);
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); clearTimeout(RH.doneT); RH.doneT = setTimeout(() => el.classList.remove("on"), ask ? 15000 : 2600);
}
async function rhWakeLock(on) {
  try { if (on && navigator.wakeLock) RH.wake = await navigator.wakeLock.request("screen"); else if (!on && RH.wake) { await RH.wake.release(); RH.wake = null; } } catch (e) {}
}

/* timesheet sheet: one person, one week: punches by day, correct / void / add (audit: edited, editedBy, origAt, note) */
function rhTsSheetHTML(sid) {
  const p = rhStaff(sid); const mon = S.ui.rhTsWeek || rhMonday(); const days = rhWeekDays(mon); const E = S.ui.rhEdit || null;
  const dm = rhDayMin(sid, mon, days[6]); const tot = days.reduce((x, d) => x + (dm[d]?.min || 0), 0); const ot = rhOT(tot);
  const all = S.punches.filter((x) => x.staffId === sid && x.day >= mon && x.day <= days[6]).sort((a, b) => a.at - b.at);
  const form = (pu) => `<div class="rh-ed">
      <div class="lbl">${pu ? `Corriger : ${RH_KIND[pu.kind].t.toLowerCase()} du ${rhDayLbl(pu.day, true)}` : "Ajouter un pointage oublié"}</div>
      ${pu ? "" : `<div class="chips rh-wrap">${Object.entries(RH_KIND).map(([k, v]) => `<button class="chip ${(E.kind || "in") === k ? "on" : ""}" data-act="rhEdKind" data-v="${k}">${v.t}</button>`).join("")}</div>`}
      <div class="grid2">${pu ? `<label class="field"><span>Jour</span><input class="input" value="${esc(rhDayLbl(pu.day, true))}" disabled></label>` : `<label class="field"><span>Jour</span><input class="input" type="date" id="rhEdDay" value="${esc(E.day || dayKey())}" min="${mon}" max="${days[6]}"></label>`}
      <label class="field"><span>Heure</span><input class="input mono" type="time" id="rhEdTime" value="${pu ? hm(pu.at) : esc(E.time || hm(Date.now()))}"></label></div>
      <label class="field"><span>Motif (gardé dans l'historique)</span><input class="input" id="rhEdNote" maxlength="80" placeholder="Ex. oubli de pointage, erreur de bouton" value="${esc(pu?.note || "")}"></label>
      ${pu && pu.origAt ? `<p class="note">Heure d'origine : ${hm(pu.origAt)} · corrigé par ${esc(nameOf(pu.editedBy))}</p>` : ""}
      <button class="btn acc block" data-act="rhEdSave" data-id="${pu ? pu.id : ""}">${ico("check")}Enregistrer</button>
      <div class="hstack rh-ed-b">${pu ? `<button class="btn ghost rh-del" data-act="rhEdVoid" data-id="${pu.id}">${ico("trash")}Supprimer ce pointage</button>` : ""}<span style="flex:1"></span><button class="btn ghost" data-act="rhEdCancel">Fermer</button></div>
    </div>`;
  const dayBlocks = days.map((d) => {
    const l = all.filter((x) => x.day === d); const plan = rhShiftsDay(sid, d); if (!l.length && !plan.length) return "";
    const an = dm[d]?.anomalies || [];
    return `<div class="rh-sd"><div class="row"><b>${rhDayLbl(d, true)}</b><span class="mono rh-sd-t">${rhHh(dm[d]?.min || 0)}${plan.length ? `<em> / prévu ${rhHh(plan.reduce((x, s) => x + rhShiftMin(s), 0))}</em>` : ""}</span></div>
      ${an.map((a) => `<div class="rh-anom-l">${ico("alert")}${esc(a.t)} : ajoutez ou corrigez le pointage</div>`).join("")}
      <div class="rh-pl">${l.map((x) => `<button class="rh-pr k-${x.kind}${x.void ? " void" : ""}${E && E.id === x.id ? " on" : ""}" data-act="rhEdOpen" data-id="${x.id}" ${x.void ? "disabled" : ""}>${ico(RH_KIND[x.kind].ic)}<span class="mono">${hm(x.at)}</span><span class="t">${RH_KIND[x.kind].t}</span>${x.edited ? `<span class="pill ${x.void ? "neu" : "acc"}" title="${esc(`Par ${nameOf(x.editedBy)}${x.origAt ? `, à l'origine ${hm(x.origAt)}` : ""}${x.note ? ` : ${x.note}` : ""}`)}">${x.void ? "annulé" : x.added ? "ajouté" : "corrigé"}</span>` : ""}</button>`).join("") || `<span class="sub">Aucun pointage${plan.length ? ` · prévu ${plan.map((s) => `${s.start}–${s.end}`).join(", ")}` : ""}</span>`}</div></div>`;
  }).join("");
  const editP = E && E.id ? all.find((x) => x.id === E.id) : null;
  return `<div class="rh-tss">
    <div class="rh-act-hd">${rhAva(p, 52)}<div><div class="h2">${esc(p.name)}</div><div class="sub">Semaine du ${rhWeekLbl(mon)} · ${rhHh(tot)} pointées${ot.h ? ` · ${fmt(ot.h, 1)} h sup.` : ""}</div></div></div>
    ${E ? form(editP) : `<button class="btn soft block" data-act="rhEdNew">${ico("plus")}Ajouter un pointage oublié</button><div class="rh-act-x"><button class="btn soft sm" data-act="rhPdf" data-id="${esc(sid)}">${ico("download")}Relevé PDF</button>${all.some((x) => x.day === dayKey() && !x.void) ? `<button class="btn soft sm" data-act="rhTicket" data-id="${esc(sid)}" data-v="${dayKey()}">${ico("printer")}Ticket du jour</button>` : ""}</div>`}
    ${dayBlocks || `<div class="empty"><b>Aucun pointage cette semaine</b>Ajoutez un pointage oublié si besoin.</div>`}
    <p class="note">Chaque correction garde l'heure d'origine, son auteur et le motif.</p>
  </div>`;
}
function rhTsPaint() { const sid = S.ui.rhTsSid; if (sid) openSheet(rhTsSheetHTML(sid)); }

/* CSV for the accountant */
function rhCsv(from, to) {
  const rows = [["Employé", "Contrat", "Date", "Arrivée", "Départ", "Pauses (min)", "Heures (décimal)", "Heures (h:min)", "Remarque"]];
  const boss = rhIsBoss();
  const sum = [["Récapitulatif par semaine"], ["Employé", "Semaine du", "Heures", "Contrat (h)", "HS +10 % (h)", "HS +20 % (h)", "HS +50 % (h)", ...(boss ? ["Taux horaire brut", "Brut estimé"] : [])]];
  rhPeople({ all: true }).forEach((p) => {
    const dm = rhDayMin(p.id, from, to); const days = Object.keys(dm).sort(); if (!days.length) return;
    const weeks = {};
    days.forEach((d) => {
      const v = dm[d]; const ss = v.sessions; weeks[rhMonday(d)] = (weeks[rhMonday(d)] || 0) + v.min;
      const edited = S.punches.some((x) => x.staffId === p.id && x.day === d && x.edited);
      const lastS = ss[ss.length - 1];
      rows.push([p.name, RH_CONTRACTS[p.contract] || p.contract || "", `${shortDate(d)}/${d.slice(0, 4)}`, ss.length ? hm(ss[0].in) : "", lastS ? (lastS.open ? "en cours" : hm(lastS.out)) : "", Math.round(v.brk), rhDec(v.min), rhHh(v.min), [v.anomalies.map((a) => a.t).join(", "), edited ? "pointage corrigé" : ""].filter(Boolean).join(" ; ")]);
    });
    Object.entries(weeks).sort().forEach(([w, m]) => { const o = rhOT(m); sum.push([p.name, `${shortDate(w)}/${w.slice(0, 4)}`, rhDec(m), rhNum(p.weeklyHours, 35), fmt(o.b10, 2), fmt(o.b20, 2), fmt(o.b50, 2), ...(boss ? [rhRate(p) ? fmt(rhRate(p), 2) : "", rhRate(p) ? fmt(rhWeekGross(m, p), 2) : ""] : [])]); });
  });
  return [...rows, [], ...sum, [], ["Heures supplémentaires indicatives (convention HCR) : +10 % de la 36e à la 39e heure, +20 % de la 40e à la 43e, +50 % au-delà."]];
}

/* ═══════════════════════ TICKET D'HEURES + RELEVÉ PDF ═══════════════════════
   At « Départ », the person is asked « Voulez-vous imprimer un ticket ? »: a small receipt of the day goes to the restaurant's printer
   (the label printer of js/labels.js, through the system print dialog: AirPrint, Android, desktop). On a continuous roll (62 mm) it is a
   full receipt; on die-cut labels (62 × 29 mm by default) a compact one that fits a single label.
   At any time, the person (Mes heures, or the punch sheet after the code) and the manager (Pointeuse) export a « Relevé d'heures » as an
   A4 document: the print dialog offers « Enregistrer au format PDF ». The estimated gross pay shows on one's own statement (as in Mes
   heures) and, for someone else's, only to whoever can see salaries. */
const rhTicketOn = () => S.resto?.rhTicket !== false;
const rhDayLong = (k) => { const d = parseDay(k); return `${DAYS[d.getDay()]} ${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const rhPerLbl = (a, b) => {
  const A = parseDay(a), B = parseDay(b); const m0 = a.slice(8) === "01" && addDays(b, 1).slice(8) === "01" && a.slice(0, 7) === b.slice(0, 7);
  if (m0) return `${MONTHS[A.getMonth()]} ${A.getFullYear()}`.replace(/^./, (c) => c.toUpperCase());
  if (a.slice(8) === "01" && a.slice(0, 7) === b.slice(0, 7) && b === dayKey()) return `${MONTHS[A.getMonth()]} ${A.getFullYear()}, au ${B.getDate()}`.replace(/^./, (c) => c.toUpperCase());
  if (a === b) return rhDayLong(a).replace(/^./, (c) => c.toUpperCase());
  return `Du ${A.getDate() === 1 ? "1er" : A.getDate()} ${MONTHS[A.getMonth()]}${A.getFullYear() !== B.getFullYear() ? " " + A.getFullYear() : ""} au ${B.getDate()} ${MONTHS[B.getMonth()]} ${B.getFullYear()}`;
};
const rhSlug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/* everything one statement needs: days (sessions, breaks, planned), weeks with overtime, totals, gross when allowed */
function rhPeriod(sid, from, to, pay) {
  const p = rhStaff(sid); const dm = rhDayMin(sid, from, to); const today = dayKey();
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) { const v = dm[d]; const pl = rhShiftsDay(sid, d); if (!v && !pl.length) continue; days.push({ d, v: v || { min: 0, brk: 0, sessions: [], anomalies: [] }, plan: pl.reduce((x, s) => x + rhShiftMin(s), 0), pl, edited: S.punches.some((x) => x.staffId === sid && x.day === d && x.edited) }); }
  const wk = {}; days.forEach((x) => { const w = rhMonday(x.d); (wk[w] ||= { mon: w, min: 0, plan: 0, n: 0 }); wk[w].min += x.v.min; wk[w].plan += x.plan; if (x.v.min) wk[w].n++; });
  const weeks = Object.values(wk).sort((a, b) => a.mon.localeCompare(b.mon)).map((w) => ({ ...w, ot: rhOT(w.min) }));
  const min = days.reduce((x, y) => x + y.v.min, 0), brk = days.reduce((x, y) => x + (y.v.brk || 0), 0), plan = days.filter((x) => x.d <= today).reduce((x, y) => x + y.plan, 0);
  const ot = weeks.reduce((x, w) => ({ b10: x.b10 + w.ot.b10, b20: x.b20 + w.ot.b20, b50: x.b50 + w.ot.b50, h: x.h + w.ot.h }), { b10: 0, b20: 0, b50: 0, h: 0 });
  const rate = rhRate(p); const showPay = !!(pay && rate); const gross = showPay ? weeks.reduce((x, w) => x + rhWeekGross(w.min, p), 0) : 0;
  return { p, from, to, days, weeks, min, brk, plan, ot, worked: days.filter((x) => x.v.min > 0).length, anomalies: days.reduce((x, y) => x + y.v.anomalies.length, 0), showPay, rate, gross };
}

/* ── the ticket ── */
function rhTicketData(sid, day = dayKey()) {
  const p = rhStaff(sid); const d = rhDayMin(sid, addDays(day, -1), day)[day] || { min: 0, brk: 0, sessions: [], anomalies: [] };
  const mon = rhMonday(day); const wk = Object.values(rhDayMin(sid, mon, addDays(mon, 6))).reduce((x, v) => x + v.min, 0);
  const m0 = day.slice(0, 8) + "01"; const mo = Object.values(rhDayMin(sid, m0, day)).reduce((x, v) => x + v.min, 0);
  const plan = rhShiftsDay(sid, day);
  return { p, day, d, wk, mo, plan, planMin: plan.reduce((x, s) => x + rhShiftMin(s), 0), contract: rhNum(p?.weeklyHours, 35) * 60, month: MONTHS[parseDay(day).getMonth()] };
}
const RH_TK_CSS = `*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Manrope",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}
.tk{padding:3mm 3.5mm 4mm;font-size:3.1mm;line-height:1.3}.tk .hd{display:flex;align-items:center;gap:2mm;justify-content:center;text-align:center}.tk .hd img{width:8mm;height:8mm;object-fit:contain;border-radius:1.5mm}
.tk .rn{font-weight:800;font-size:3.8mm;letter-spacing:-.01em}.tk .k{text-align:center;font-weight:800;font-size:2.6mm;letter-spacing:.16em;text-transform:uppercase;margin-top:1mm}
.tk hr{border:0;border-top:.3mm dashed #000;margin:2.2mm 0}.tk .who{font-weight:800;font-size:4.2mm;text-align:center}.tk .dt{text-align:center;font-size:2.9mm}
.tk .r{display:flex;justify-content:space-between;gap:2mm}.tk .r b{font-weight:800}.tk .big{text-align:center;margin:1.5mm 0 .5mm}.tk .big em{display:block;font-style:normal;font-weight:800;font-size:2.5mm;letter-spacing:.14em;text-transform:uppercase}
.tk .big b{display:block;font-size:9.5mm;font-weight:800;letter-spacing:-.04em;line-height:1.05}.tk .sm{text-align:center;font-size:2.5mm}.tk .ft{text-align:center;font-size:2.4mm;margin-top:2mm}
.tc{height:100%;padding:1.6mm 2.4mm;display:flex;flex-direction:column;justify-content:space-between;font-size:2.55mm;line-height:1.18;overflow:hidden}
.tc .l1{display:flex;justify-content:space-between;gap:1.5mm;font-weight:800;font-size:2.9mm;white-space:nowrap}.tc .l1 span:first-child{overflow:hidden;text-overflow:ellipsis}
.tc .bg{display:flex;align-items:baseline;gap:1.6mm}.tc .bg b{font-size:6.6mm;font-weight:800;letter-spacing:-.04em;line-height:1}.tc .bg span{font-weight:700}
.tc .l3{display:flex;justify-content:space-between;gap:1.5mm;white-space:nowrap}.tc .l4{font-size:2.15mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
function rhTicketHTML(T, roll) {
  const r = S.resto || {}; const logo = typeof restoLogo === "function" ? restoLogo() : ""; const ss = T.d.sessions;
  const span = ss.length ? `${hm(ss[0].in)} → ${ss[ss.length - 1].open ? "en cours" : hm(ss[ss.length - 1].out)}` : "pas de pointage";
  if (roll && roll.h) { /* one die-cut label (62 × 29 mm, or 90 × 29 mm) */
    return `<div class="tc"><div class="l1"><span>${esc(T.p.name)}</span><span>${esc(rhDayLbl(T.day, true))}</span></div>
      <div class="bg"><b>${rhDur(T.d.min)}</b><span>de travail</span></div>
      <div class="l3"><span>${esc(span)}${T.d.brk >= 1 ? ` · pause ${rhDur(T.d.brk)}` : ""}</span></div>
      <div class="l3"><span>Semaine <b>${rhHh(T.wk)}</b> / ${rhHh(T.contract)}</span><span>${esc(T.month.replace(/^./, (c) => c.toUpperCase()))} <b>${rhHh(T.mo)}</b></span></div>
      <div class="l4">${esc(r.name || "Restaurant")} · imprimé à ${hm(Date.now())}</div></div>`;
  }
  const rows = ss.map((s, i) => `${ss.length > 1 ? `<div class="sm" style="text-align:left;font-weight:800;margin-top:${i ? 1.5 : 0}mm">Service ${i + 1}</div>` : ""}
      <div class="r"><span>Arrivée</span><b>${hm(s.in)}</b></div>${s.br >= 60000 ? `<div class="r"><span>Pause</span><b>${rhDur(s.br / 60000)}</b></div>` : ""}<div class="r"><span>Départ</span><b>${s.open ? "en cours" : hm(s.out)}</b></div>`).join("");
  return `<div class="tk"><div class="hd">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<span class="rn">${esc(r.name || "Restaurant")}</span></div><div class="k">Ticket d'heures</div><hr>
    <div class="who">${esc(T.p.name)}</div><div class="dt">${esc(rhDayLong(T.day).replace(/^./, (c) => c.toUpperCase()))}</div><hr>
    ${rows || `<div class="sm">Aucun pointage ce jour</div>`}
    <hr><div class="big"><em>Travail aujourd'hui</em><b>${rhDur(T.d.min)}</b></div>
    ${T.plan.length ? `<div class="sm">Prévu : ${T.plan.map((s) => `${esc(s.start)} → ${esc(s.end)}`).join(", ")} (${rhDur(T.planMin)})</div>` : ""}
    ${T.d.anomalies.length ? `<div class="sm"><b>À vérifier : ${esc(T.d.anomalies[0].t)}</b></div>` : ""}<hr>
    <div class="r"><span>Cette semaine</span><b>${rhHh(T.wk)} / ${rhHh(T.contract)}</b></div><div class="r"><span>${esc(T.month.replace(/^./, (c) => c.toUpperCase()))}</span><b>${rhHh(T.mo)}</b></div>
    <div class="ft">Imprimé le ${shortDate(dayKey())}/${dayKey().slice(0, 4)} à ${hm(Date.now())}<br>Heures d'après la pointeuse · Growth Gusto</div></div>`;
}
function rhTicketH(T) { const n = T.d.sessions.length; return Math.round(72 + n * 11 + (n > 1 ? n * 4 : 0) + (T.plan.length ? 4 : 0) + (T.d.anomalies.length ? 4 : 0) + (restoLogo() ? 2 : 0)); }
function rhTicketDoc(T) {
  const roll = typeof lbRoll === "function" ? lbRoll() : { w: 62, h: 0 }; const W = roll.w || 62, H = roll.h || rhTicketH(T);
  const fonts = document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ticket d'heures</title>${fonts ? `<link rel="stylesheet" href="${esc(fonts.href)}">` : ""}
<style>@page{size:${W}mm ${H}mm;margin:0}${RH_TK_CSS}.pg{width:${W}mm;height:${H}mm;overflow:hidden}</style></head><body><div class="pg">${rhTicketHTML(T, roll)}</div></body></html>`;
}
/* a print-only document in a hidden iframe (same technique as the labels: Safari prints a blank page with display:none) */
const RHP = { f: null, t: 0 };
function rhPrintClean() { clearTimeout(RHP.t); if (RHP.f) { try { RHP.f.remove(); } catch (e) {} RHP.f = null; } }
async function rhPrintDoc(html, title, opts = {}) {
  rhPrintClean(); const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.title = title || "Impression"; f.className = "rh-pframe";
  f.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none"; f.srcdoc = html;
  const loaded = new Promise((r) => { f.addEventListener("load", r, { once: true }); setTimeout(r, 3000); });
  document.body.appendChild(f); RHP.f = f; await loaded;
  const w = f.contentWindow, d = f.contentDocument; if (!w || !d) { rhPrintClean(); return false; }
  try { await Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  if (opts.dry) { const n = d.body.innerText.length; rhPrintClean(); return n; }
  const t0 = document.title; if (title) document.title = String(title).replace(/[\/\\:]/g, "-");
  w.addEventListener("afterprint", () => { document.title = t0; setTimeout(rhPrintClean, 400); });
  RHP.t = setTimeout(() => { document.title = t0; rhPrintClean(); }, 180000);
  try { w.focus(); w.print(); } catch (e) { document.title = t0; rhPrintClean(); return false; }
  return true;
}
async function rhPrintTicket(sid, day) {
  const T = rhTicketData(sid, day); if (!T.p) return;
  SFX.print ? SFX.print() : SFX.tap(); buzz(8);
  const ok = await rhPrintDoc(rhTicketDoc(T), `Ticket d'heures ${firstName(T.p.name) || ""} ${T.day}`);
  if (!ok) { toast("Impression impossible sur cet appareil.", "err"); return; }
  const c = typeof lbPrinterCfg === "function" ? lbPrinterCfg() : {}; toast(c.model && c.model !== "other" ? `Ticket prêt : choisissez ${c.short}` : "Ticket prêt : choisissez votre imprimante");
}
window.rhPrintTicket = rhPrintTicket;

/* ── the A4 statement (« Enregistrer au format PDF ») ── */
const RH_PDF_CSS = `@page{size:A4;margin:12mm 12mm 14mm}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#14122B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Manrope",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:9.5pt;line-height:1.35;font-variant-numeric:tabular-nums}
.rp{break-after:page;page-break-after:always}.rp:last-child{break-after:auto;page-break-after:auto}
.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm;padding-bottom:4mm;border-bottom:.6mm solid #4A1FE6}
.br{display:flex;align-items:center;gap:3mm}.br img{width:12mm;height:12mm;object-fit:contain;border-radius:2.5mm}.br .ini{width:12mm;height:12mm;border-radius:2.5mm;background:#4A1FE6;color:#fff;display:grid;place-items:center;font-weight:800;font-size:11pt}
.br b{display:block;font-size:13pt;font-weight:800;letter-spacing:-.01em}.br em{font-style:normal;color:#5A6386;font-size:8.5pt}
.ti{text-align:right}.ti b{display:block;font-size:17pt;font-weight:800;letter-spacing:-.02em;color:#4A1FE6}.ti span{font-weight:700}
.who{display:flex;justify-content:space-between;gap:6mm;margin:5mm 0 4mm;padding:3.5mm 4mm;border-radius:3mm;background:#F3F0FF}
.who b{font-size:12pt;font-weight:800}.who em{display:block;font-style:normal;color:#5A6386;font-size:8.5pt}.who .r{text-align:right}
.kp{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:3mm;margin-bottom:5mm}.kp div{border:.3mm solid #DAD6EE;border-radius:3mm;padding:3mm 3.5mm}
.kp b{display:block;font-size:15pt;font-weight:800;letter-spacing:-.02em}.kp span{color:#5A6386;font-size:8pt}.kp .acc{background:#4A1FE6;border-color:#4A1FE6;color:#fff}.kp .acc span{color:#E4DCFF}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:7.5pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5A6386;padding:1.8mm 1.5mm;border-bottom:.4mm solid #14122B}
td{padding:1.6mm 1.5mm;border-bottom:.25mm solid #E6E3F2;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}td small{display:block;color:#5A6386;font-size:7.5pt}
tr.wk td{background:#F6F4FC;font-weight:800;border-bottom:.4mm solid #DAD6EE}tr.wk td small{display:inline;font-weight:600;margin-left:2mm}
tr.tot td{font-weight:800;font-size:10.5pt;border-top:.5mm solid #14122B;border-bottom:0;padding-top:2.5mm}.nc{color:#B4232F;font-weight:700}.off{color:#9A9EB8}
.ft{margin-top:6mm;font-size:7.8pt;color:#5A6386}.sg{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm}.sg div{border:.3mm solid #DAD6EE;border-radius:3mm;height:22mm;padding:2.5mm 3mm;font-size:8pt;color:#5A6386}
.empty{padding:10mm;text-align:center;color:#5A6386;border:.3mm dashed #DAD6EE;border-radius:3mm}`;
function rhPdfPage(R) {
  const r = S.resto || {}; const p = R.p; const logo = typeof restoLogo === "function" ? restoLogo() : "";
  const ini = typeof restoIni === "function" ? restoIni(r.name) : initials(r.name || "R");
  const kp = [[rhDur(R.min), "heures travaillées", "acc"], [String(R.worked), R.worked > 1 ? "jours travaillés" : "jour travaillé"], [R.ot.h ? rhDur(R.ot.h * 60) : "0 h", "heures sup. (indicatif)"], ...(R.showPay ? [[rhEur(R.gross), "brut estimé"]] : [[rhDur(R.brk), "de pauses"]])];
  let body = "";
  R.weeks.forEach((w) => {
    const ds = R.days.filter((x) => rhMonday(x.d) === w.mon);
    body += ds.map((x) => {
      const ss = x.v.sessions; const note = [...x.v.anomalies.map((a) => `<span class="nc">${esc(a.t)}</span>`), x.edited ? "corrigé par le gérant" : ""].filter(Boolean).join(" · ");
      return `<tr><td><b>${esc(rhDayLbl(x.d, true))}</b></td><td>${ss.length ? ss.map((s) => `${hm(s.in)} → ${s.open ? "en cours" : hm(s.out)}`).join("<br>") : `<span class="off">${x.d > dayKey() ? "à venir" : "non pointé"}</span>`}</td>
        <td class="n">${x.v.brk >= 1 ? rhDur(x.v.brk) : "–"}</td><td class="n">${x.plan ? rhHh(x.plan) : "–"}</td><td class="n"><b>${x.v.min ? rhHh(x.v.min) : "–"}</b></td><td>${note}</td></tr>`;
    }).join("");
    const o = w.ot; const otx = [o.b10 ? `${fmt(o.b10, 2)} h à +10 %` : "", o.b20 ? `${fmt(o.b20, 2)} h à +20 %` : "", o.b50 ? `${fmt(o.b50, 2)} h à +50 %` : ""].filter(Boolean).join(", ");
    body += `<tr class="wk"><td colspan="3">Semaine du ${esc(rhWeekLbl(w.mon))}${otx ? `<small>dont ${otx}</small>` : ""}</td><td class="n">${w.plan ? rhHh(w.plan) : "–"}</td><td class="n">${rhHh(w.min)}</td><td>${R.showPay ? `<small>brut estimé ${rhEur(rhWeekGross(w.min, p), 2)}</small>` : ""}</td></tr>`;
  });
  const tbl = R.days.length ? `<table><thead><tr><th>Jour</th><th>Arrivée → départ</th><th class="n">Pauses</th><th class="n">Prévu</th><th class="n">Travaillé</th><th>Remarque</th></tr></thead><tbody>${body}
    <tr class="tot"><td colspan="3">Total de la période</td><td class="n">${R.plan ? rhHh(R.plan) : "–"}</td><td class="n">${rhHh(R.min)}</td><td>${rhDec(R.min)} h en décimal</td></tr></tbody></table>`
    : `<div class="empty">Aucun pointage ni service prévu sur cette période.</div>`;
  return `<section class="rp"><header class="hd"><div class="br">${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="ini">${esc(ini)}</span>`}<div><b>${esc(r.name || "Restaurant")}</b><em>${esc([r.address, r.siret ? "SIRET " + r.siret : ""].filter(Boolean).join(" · ") || "Relevé établi avec Growth Gusto")}</em></div></div>
    <div class="ti"><b>Relevé d'heures</b><span>${esc(rhPerLbl(R.from, R.to))}</span></div></header>
    <div class="who"><div><b>${esc(p.name)}</b><em>${esc([p.role, RH_POSTS[p.post]?.t].filter(Boolean).join(" · ") || "Employé")}</em></div><div class="r"><b>${esc(RH_CONTRACTS[p.contract] || p.contract || "")}</b><em>${rhNum(p.weeklyHours, 35)} h par semaine au contrat${R.showPay ? ` · ${fmt(R.rate, 2)} € brut / h` : ""}</em></div></div>
    <div class="kp" style="--n:${kp.length}">${kp.map(([v, l, c]) => `<div class="${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>
    ${tbl}
    <p class="ft">Heures d'après la pointeuse : chaque correction garde l'heure d'origine, son auteur et le motif. Heures sup. indicatives (convention HCR) : +10 % de la 36e à la 39e heure, +20 % de la 40e à la 43e, +50 % au-delà.${R.showPay ? " Brut estimé hors primes, avantages en nature et absences : la fiche de paie fait foi." : ""}${R.anomalies ? ` <b class="nc">${R.anomalies} pointage${R.anomalies > 1 ? "s" : ""} à vérifier.</b>` : ""}</p>
    <div class="sg"><div>Signature du salarié</div><div>Signature de l'employeur</div></div>
    <p class="ft">Document établi le ${shortDate(dayKey())}/${dayKey().slice(0, 4)} à ${hm(Date.now())} par ${esc(nameOf(S.me.id) || "—")} avec Growth Gusto.</p></section>`;
}
function rhPdfDoc(list, title) {
  const fonts = document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>${fonts ? `<link rel="stylesheet" href="${esc(fonts.href)}">` : ""}<style>${RH_PDF_CSS}</style></head><body>${list.map(rhPdfPage).join("")}</body></html>`;
}
/* who: a staff id, or "all" (manager: one page per person with hours in the period). self = the person exports their own hours */
async function rhPdfGo(who, from, to, self) {
  const pay = self || rhIsBoss();
  const ids = who === "all" ? rhPeople({ all: true }).map((p) => p.id) : [who];
  let list = ids.map((id) => rhPeriod(id, from, to, pay)).filter((R) => R.p);
  if (who === "all") list = list.filter((R) => R.min > 0 || R.days.some((x) => x.d <= dayKey()));
  if (!list.length) { SFX.err(); toast("Aucune heure sur cette période.", "err"); return false; }
  const title = `Relevé d'heures ${who === "all" ? S.resto?.name || "" : list[0].p.name} ${rhPerLbl(from, to)}`.replace(/\s+/g, " ").trim();
  SFX.print ? SFX.print() : SFX.tap(); buzz(8);
  const ok = await rhPdfPrint(rhPdfDoc(list, title), title);
  if (!ok) toast("Impression impossible sur cet appareil.", "err"); else toast("Choisissez « Enregistrer en PDF » dans la fenêtre d'impression");
  return ok;
}
const rhPdfPrint = (html, title) => rhPrintDoc(html, title);
window.rhPdfGo = rhPdfGo;
/* the period picker: this month, last month, this week, last week, or two dates */
function rhPdfOpts() {
  const t = dayKey(); const m0 = t.slice(0, 8) + "01"; const pm = parseDay(m0); pm.setMonth(pm.getMonth() - 1); const pm0 = dayKey(pm), pm1 = addDays(m0, -1); const mon = rhMonday();
  return [["month", `Ce mois-ci`, m0, t, MONTHS[parseDay(m0).getMonth()]], ["prev", "Mois dernier", pm0, pm1, MONTHS[pm.getMonth()]], ["week", "Cette semaine", mon, addDays(mon, 6), rhWeekLbl(mon)], ["pweek", "Semaine dernière", addDays(mon, -7), addDays(mon, -1), rhWeekLbl(addDays(mon, -7))]];
}
function rhPdfSheetHTML() {
  const U = S.ui.rhPdf; const all = U.who === "all"; const p = all ? null : rhStaff(U.who); const o = rhPdfOpts();
  const hrs = (a, b) => all ? staffCost(a, b).hours * 60 : Object.values(rhDayMin(U.who, a, b)).reduce((x, v) => x + v.min, 0);
  return `<div class="rh-pdf">
    <div class="rh-act-hd">${all ? `<span class="rh-pdf-ic">${ico("users")}</span>` : rhAva(p, 52)}<div><div class="h2">${all ? "Relevés d'heures" : U.self ? "Mes heures en PDF" : `Relevé de ${esc(rhFirst(p))}`}</div><div class="sub">${all ? "Une page par employé, prête à signer" : "Jour par jour, semaines, heures sup." + (U.self || rhIsBoss() ? " et brut estimé" : "")}</div></div></div>
    <div class="rh-pdf-l">${o.map(([k, l, a, b, s]) => { const m = hrs(a, b); return `<button class="rh-pdf-o" data-act="rhPdfPick" data-v="${k}"><span class="ic">${ico("download")}</span><span class="tx"><b>${esc(l)}</b><em>${esc(s)} · ${m ? rhDur(m) : "aucune heure"}</em></span>${ico("chev")}</button>`; }).join("")}</div>
    <div class="lbl">Ou choisissez les dates</div>
    <div class="grid2"><label class="field"><span>Du</span><input class="input" type="date" id="rhPdfA" value="${esc(U.a || o[0][2])}" max="${dayKey()}"></label><label class="field"><span>Au</span><input class="input" type="date" id="rhPdfB" value="${esc(U.b || dayKey())}"></label></div>
    <button class="btn acc block" data-act="rhPdfPick" data-v="custom">${ico("download")}Exporter ces dates en PDF</button>
    <p class="note">La fenêtre d'impression s'ouvre : choisissez « Enregistrer au format PDF » (ou « Enregistrer dans Fichiers » sur iPhone), ou imprimez-le directement.</p>
  </div>`;
}
function rhPdfOpen(who, self) { S.ui.rhPdf = { who, self: !!self }; SFX.tap(); openSheet(rhPdfSheetHTML()); }
window.rhPdfOpen = rhPdfOpen;

/* ═══════════════════════ PLANNING ═══════════════════════ */
const RH_WIDE = window.matchMedia("(min-width:760px)");
try { RH_WIDE.addEventListener("change", () => { if (S.ready && S.route === "planning") rerender(); }); } catch (e) {}
function rhShiftChip(s, drag) {
  const P = RH_POSTS[s.post] || null;
  return `<button class="rh-sh${P ? "" : " nopost"}" style="--pc:${P ? P.c : "#B8AC98"};--pb:${P ? P.bg : "#F4EDE0"};--pi:${P ? P.ink : "#615B74"}" data-act="rhShift" data-id="${s.id}"${drag ? ' draggable="true"' : ""} title="${esc(`${s.start}–${s.end}${s.breakMin ? `, pause ${s.breakMin} min` : ""}${P ? ` · ${P.t}` : ""}${s.note ? ` · ${s.note}` : ""}`)}"><b class="mono">${esc(s.start)}–${esc(s.end)}</b><em>${P ? P.t : "Poste ?"}${s.breakMin ? ` · p. ${s.breakMin}′` : ""}${s.note ? ` · ${esc(s.note)}` : ""}</em></button>`;
}
function rhPlanStats(mon) {
  const days = rhWeekDays(mon); const ppl = rhPeople(); const boss = rhIsBoss();
  const per = ppl.map((p) => {
    const sh = rhShiftsOf(p.id, mon, days[6]); const min = sh.reduce((x, s) => x + rhShiftMin(s), 0);
    const worked = Object.values(rhDayMin(p.id, mon, days[6])).reduce((x, v) => x + v.min, 0); const gross = rhWeekGross(min, p);
    return { p, sh, min, worked, legal: rhLegal(p.id, mon), h: rhHoursOf(p, mon), gross, loaded: gross * (1 + rhCh(p) / 100) };
  });
  const dayMin = days.map((d) => per.reduce((x, r) => x + r.sh.filter((s) => s.day === d).reduce((y, s) => y + rhShiftMin(s), 0), 0));
  const dayCost = days.map((d) => per.reduce((x, r) => x + r.sh.filter((s) => s.day === d).reduce((y, s) => y + rhShiftMin(s) / 60 * rhLoadedRate(r.p), 0), 0));
  const tot = per.reduce((x, r) => x + r.min, 0), worked = per.reduce((x, r) => x + r.worked, 0), loaded = per.reduce((x, r) => x + r.loaded, 0), gross = per.reduce((x, r) => x + r.gross, 0);
  const alerts = per.filter((r) => r.h.alerts.length).length, alBad = per.some((r) => r.h.bad); const noRate = per.filter((r) => r.min && !rhRate(r.p)).length;
  let sales = null; if (boss && typeof salesBetween === "function") { try { sales = salesBetween(mon, days[6]); } catch (e) {} }
  return { days, per, dayMin, dayCost, tot, worked, loaded, gross, alerts, alBad, boss, noRate, sales };
}
VIEWS.planning = {
  render() {
    const mon = S.ui.rhPlanWeek || (S.ui.rhPlanWeek = rhMonday()); const st = rhPlanStats(mon); const { days, per } = st; const thisW = mon === rhMonday(); const mgr = rhIsMgr();
    const wide = RH_WIDE.matches; const today = dayKey();
    const right = per.length ? `<button class="btn soft sm rh-sendb" data-act="rhSend" aria-label="Envoyer ou imprimer le planning">${ico("rhsend")}<span>Envoyer</span></button>` : "";
    if (!per.length) return `<div class="inner">${topBar("Planning")}<div class="glass empty st" style="--i:1"><span class="ic">${ico("cal")}</span><b>Pas encore d'employés</b>Créez les fiches de votre équipe, puis touchez une case du planning pour ajouter un créneau.${rhCanStaff() ? `<div style="margin-top:14px"><button class="btn acc" data-go="staff">${ico("plus")}Ajouter un employé</button></div>` : ""}</div></div>`;
    const nPl = per.filter((r) => r.min).length;
    const kpi = `<div class="rh-kpis st" style="--i:2">
      <div class="glass"><span class="lbl">Prévu</span><b class="mono">${rhHh(st.tot)}</b><em>${nPl} personne${nPl > 1 ? "s" : ""}</em></div>
      <div class="glass"><span class="lbl">Pointé</span><b class="mono">${rhHh(st.worked)}</b><em>${st.tot ? `${Math.round(st.worked / st.tot * 100)} % du prévu` : "rien de prévu"}</em></div>
      ${st.boss ? `<div class="glass"><span class="lbl">Coût estimé</span><b class="mono">${rhEur(st.loaded)}</b><em>${rhEur(st.gross)} brut${st.sales && st.sales.ht ? ` · <b class="${st.loaded / st.sales.ht > 0.38 ? "rh-bad" : "rh-ok"}">${Math.round(st.loaded / st.sales.ht * 100)} % du CA</b>` : ""}</em></div>` : ""}
      <div class="glass ${st.alerts ? (st.alBad ? "rh-kbad" : "rh-kwarn") : "rh-kok"}${mgr ? " rh-ktap" : ""}"${mgr && st.alerts ? ` data-act="rhHrJump" role="button" tabindex="0"` : ""}><span class="lbl">Règles HCR</span><b class="mono">${st.alerts ? `${st.alerts}` : "OK"}</b><em>${st.alerts ? `personne${st.alerts > 1 ? "s" : ""} à vérifier` : "repos et durées respectés"}</em></div>
    </div>`;
    const nav = `<div class="rh-bar st" style="--i:1"><div class="hstack rh-wnav"><button class="iconbtn" data-act="rhPlanWeek" data-v="-7" aria-label="Semaine précédente">${ico("back")}</button><div class="rh-wl"><b>${rhWeekLbl(mon)}</b><em>${thisW ? "cette semaine" : mon < rhMonday() ? "semaine passée" : "à venir"}</em></div><button class="iconbtn" data-act="rhPlanWeek" data-v="7" aria-label="Semaine suivante">${ico("rhfwd")}</button>${thisW ? "" : `<button class="chip" data-act="rhPlanWeek" data-v="0">Aujourd'hui</button>`}</div>
      ${mgr && VIEWS.planif ? `<button class="btn acc sm rh-propb" data-act="rhPropose" aria-label="Proposer la semaine">${ico("pfWand")}<span>Proposer la semaine</span></button>` : ""}
      ${mgr ? `<button class="btn soft sm rh-copyb" data-act="rhCopyWeek" aria-label="Copier la semaine d'avant" title="Copier la semaine d'avant">${ico("rhcopy")}<span>Copier la semaine d'avant</span></button>` : ""}</div>`;
    const hint = !st.tot && mgr ? `<div class="banner rh-hint st" style="--i:3">${ico("sparkle")}<span>${wide ? "Cliquez sur une case pour ajouter un créneau, glissez-le pour le déplacer (Alt pour le copier)." : "Touchez « + » à côté d'un prénom pour ajouter un créneau."} Ou laissez l'app proposer la semaine d'après les couverts prévus.</span></div>` : "";
    let body;
    if (wide) {
      const head = `<div class="rh-g-h"><span></span>${days.map((d, i) => `<span class="${d === today ? "today" : ""}"><b>${RH_DSHORT[i]}</b> ${parseDay(d).getDate()}</span>`).join("")}<span>Total</span></div>`;
      const rows = per.map((r) => {
        const c = rhNum(r.p.weeklyHours, 35) * 60; const pct = Math.min(100, Math.round(r.min / Math.max(c, 1) * 100));
        return `<div class="rh-g-r${r.legal.bad ? " bad" : ""}"><span class="rh-g-p">${rhAva(r.p, 32)}<span><b>${esc(rhFirst(r.p))}</b><em>${esc(r.p.role || RH_CONTRACTS[r.p.contract] || "")}</em></span></span>
          ${days.map((d) => { const l = r.sh.filter((s) => s.day === d); const lg = r.legal.day[d] || []; return `<div class="rh-cell${d === today ? " today" : ""}${lg.length ? " " + (lg.some((x) => x.lvl === "bad") ? "lbad" : "lwarn") : ""}"${mgr ? ` data-act="rhCell" data-id="${esc(r.p.id)}" data-v="${d}" data-cell="${esc(r.p.id)}|${d}"` : ""}>${l.map((s) => rhShiftChip(s, mgr)).join("")}${lg.length ? `<span class="rh-lg" title="${esc(lg.map((x) => x.t).join("\n"))}">${ico("alert")}<span>${esc(lg[0].k || lg[0].t.split(" : ")[0])}</span></span>` : ""}${mgr && !l.length ? `<span class="rh-add">${ico("plus")}</span>` : ""}</div>`; }).join("")}
          <span class="rh-g-t"><b class="mono">${rhHh(r.min)}</b><i class="rh-bar-c"><i style="width:${pct}%" class="${r.min > c && c ? "over" : ""}"></i></i><em>${r.worked ? `pointé ${rhHh(r.worked)}` : `contrat ${rhHh(c)}`}</em></span></div>`;
      }).join("");
      const foot = `<div class="rh-g-f"><span>Par jour</span>${days.map((d, i) => `<span><b class="mono">${st.dayMin[i] ? rhHh(st.dayMin[i]) : "–"}</b>${st.boss && st.dayCost[i] ? `<em class="mono">${rhEur(st.dayCost[i])}</em>` : ""}</span>`).join("")}<span><b class="mono">${rhHh(st.tot)}</b>${st.boss ? `<em class="mono">${rhEur(st.loaded)}</em>` : ""}</span></div>`;
      body = `<div class="glass rh-grid st" style="--i:4">${head}${rows}${foot}</div>`;
    } else {
      const di = S.ui.rhDay != null ? S.ui.rhDay : Math.max(0, days.indexOf(today)); const d = days[di];
      const strip = `<div class="rh-strip st" style="--i:3">${days.map((x, i) => `<button class="${i === di ? "on" : ""}${x === today ? " today" : ""}" data-act="rhDay" data-v="${i}" aria-label="${rhDayLbl(x, true)}"><em>${RH_DSHORT[i]}</em><b>${parseDay(x).getDate()}</b><i class="mono">${st.dayMin[i] ? rhHh(st.dayMin[i]) : "·"}</i>${per.some((r) => (r.legal.day[x] || []).some((l) => l.lvl === "bad")) ? `<span class="rh-sdot"></span>` : ""}</button>`).join("")}</div>`;
      const list = per.map((r) => {
        const l = r.sh.filter((s) => s.day === d); const lg = r.legal.day[d] || []; const dm = l.reduce((x, s) => x + rhShiftMin(s), 0);
        return `<div class="rh-dr${l.length ? "" : " off"}"><div class="rh-dr-top"><span class="rh-dr-p">${rhAva(r.p, 40)}<span><b>${esc(rhFirst(r.p))}</b><em>${l.length ? rhHh(dm) : "Repos"} · semaine ${rhHh(r.min)}${r.h.away ? ` <span class="rh-away" title="Prévu dans les autres établissements">+ ${rhHh(r.h.away)} ailleurs</span>` : ""}</em></span></span>
          ${mgr ? `<button class="rh-plus" data-act="rhCell" data-id="${esc(r.p.id)}" data-v="${d}" aria-label="Ajouter un créneau à ${esc(rhFirst(r.p))}">${ico("plus")}</button>` : ""}</div>
          ${l.length ? `<div class="rh-dr-s">${l.map((s) => rhShiftChip(s)).join("")}</div>` : ""}
          ${lg.map((x) => `<div class="rh-lgl ${x.lvl}">${ico("alert")}${esc(x.t)}</div>`).join("")}</div>`;
      }).join("");
      body = `${strip}<div class="glass rh-dayv st" style="--i:4" id="rhDayV"><div class="row rh-dv-h"><b>${rhDayLbl(d, true)}</b><span class="mono">${rhHh(st.dayMin[di])}${st.boss && st.dayCost[di] ? ` · ${rhEur(st.dayCost[di])}` : ""}</span></div>${list}<p class="note rh-swipe">Glissez vers la gauche ou la droite pour changer de jour.</p></div>`;
    }
    const hrs = mgr ? rhHoursCard(st, mon) : "";
    const legend = `<div class="rh-legend st" style="--i:6">${Object.values(RH_POSTS).map((p) => `<span><i style="background:${p.c}"></i>${p.t}</span>`).join("")}</div>`;
    return `<div class="inner wide rh-plan">${topBar("Planning", { right })}${nav}${kpi}${hint}${body}${hrs}${legend}
      ${st.boss && st.noRate ? `<p class="note st" style="--i:7">${st.noRate} personne${st.noRate > 1 ? "s" : ""} sans taux horaire : coût incomplet. <button class="btn ghost" data-go="staff">Compléter les fiches</button></p>` : ""}
      <p class="note st" style="--i:8">Repères HCR (indicatifs, jamais bloquants) : 11 h de travail par jour en cuisine, 11 h 30 en salle, 11 h de repos entre deux journées, 48 h par semaine, 46 h en moyenne sur 12 semaines, 2 jours de repos.${st.boss ? " Coût chargé estimé avec les charges de chaque fiche." : ""}</p></div>`;
  },
  after(v) {
    /* phone: swipe between days */
    const dv = $("#rhDayV", v); if (dv) {
      let x0 = null, y0 = 0;
      dv.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      dv.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dy) < 50) rhDayStep(dx < 0 ? 1 : -1); }, { passive: true });
    }
    /* desktop: drag a shift to another cell (Alt / Ctrl / ⌘ = copy) */
    $$(".rh-sh[draggable]", v).forEach((c) => {
      c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "copyMove"; c.classList.add("drag"); setTimeout(() => v.classList.add("rh-dragging"), 0); });
      c.addEventListener("dragend", () => { c.classList.remove("drag"); v.classList.remove("rh-dragging"); $$(".rh-cell.over", v).forEach((x) => x.classList.remove("over")); });
    });
    $$(".rh-cell[data-cell]", v).forEach((cell) => {
      cell.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.altKey || e.ctrlKey || e.metaKey ? "copy" : "move"; cell.classList.add("over"); });
      cell.addEventListener("dragleave", () => cell.classList.remove("over"));
      cell.addEventListener("drop", (e) => { e.preventDefault(); cell.classList.remove("over"); const [sid, day] = cell.dataset.cell.split("|"); rhDrop(e.dataTransfer.getData("text/plain"), sid, day, e.altKey || e.ctrlKey || e.metaKey); });
    });
  },
};
async function rhDrop(id, sid, day, copy) {
  const s = S.shifts.find((x) => x.id === id); if (!s) return; if (!copy && s.staffId === sid && s.day === day) return;
  const p = rhStaff(sid); await rhEnsure(p); const { id: _i, ...doc } = s;
  if (copy) { const nid = await DB.add("shifts", { ...doc, staffId: sid, day, at: Date.now(), by: S.me.id }); RH.undo = { ids: [nid] }; rhUndoToast("Créneau copié"); }
  else { RH.undo = { restore: [[id, s.staffId === sid && s.day === day ? doc : { ...doc }]] }; await DB.update("shifts", id, { staffId: sid, day }); rhUndoToast(`Déplacé : ${rhFirst(p)}, ${rhDayLbl(day, true)}`); }
  buzz(8); rhLegalToast(sid, day);
}
function rhDayStep(n) {
  const cur = S.ui.rhDay != null ? S.ui.rhDay : Math.max(0, rhWeekDays(S.ui.rhPlanWeek || rhMonday()).indexOf(dayKey()));
  let i = cur + n; if (i < 0) { S.ui.rhPlanWeek = addDays(S.ui.rhPlanWeek, -7); i = 6; } else if (i > 6) { S.ui.rhPlanWeek = addDays(S.ui.rhPlanWeek, 7); i = 0; }
  S.ui.rhDay = i; SFX.tick(); buzz(4); rerender();
  const dv = $("#rhDayV"); if (dv) dv.classList.add(n > 0 ? "rh-in-r" : "rh-in-l");
}
function rhUndoToast(msg) { toast(msg); const t = $("#toast"); $("#toastTx").innerHTML = `<span class="tx">${esc(msg)}</span><button data-act="rhUndo">Annuler</button>`; if (typeof toastPlace === "function") toastPlace(t); t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 4500); SFX.ok(); }
function rhLegalToast(sid, day) { setTimeout(() => { const lg = rhLegal(sid, rhMonday(day)); const l = (lg.day[day] || []).concat(lg.week).filter((x) => x.lvl === "bad"); if (l.length) { SFX.err(); toast(`${rhFirst(rhStaff(sid))} : ${l[0].t}`, "err"); } }, 1600); }

/* shift sheet */
function rhShiftSheet() {
  const F = S.ui.rhF; const p = rhStaff(F.staffId); const ex = F.id ? S.shifts.find((s) => s.id === F.id) : null; const mon = rhMonday(F.day);
  return `<div class="rh-shs">
    <div class="rh-act-hd">${rhAva(p, 48)}<div><div class="h2">${ex ? "Modifier le créneau" : "Nouveau créneau"}</div><div class="sub">${esc(p?.name || "")} · ${rhDayLbl(F.day, true)}</div></div></div>
    ${ex ? "" : `<div class="chips rh-wrap">${RH_PRESETS.map((x, i) => `<button class="chip${F.preset === i ? " on" : ""}" data-act="rhPreset" data-v="${i}">${x[0]}<span class="mono rh-pm">${x[1]}–${x[5] || x[2]}</span></button>`).join("")}</div>`}
    <div class="grid2"><label class="field"><span>Début</span><input class="input mono" type="time" id="rhFs" value="${esc(F.start)}" step="900"></label><label class="field"><span>Fin</span><input class="input mono" type="time" id="rhFe" value="${esc(F.end)}" step="900"></label></div>
    ${F.split ? `<div class="grid2"><label class="field"><span>Reprise le soir</span><input class="input mono" type="time" id="rhFs2" value="${esc(F.split[0])}"></label><label class="field"><span>Fin du soir</span><input class="input mono" type="time" id="rhFe2" value="${esc(F.split[1])}"></label></div>` : ""}
    <div class="field"><span>Pause</span><div class="rh-opts">${[0, 15, 30, 45, 60].map((m) => `<button class="${+F.breakMin === m ? "on" : ""}" data-act="rhFBreak" data-v="${m}">${m ? `${m} min` : "Aucune"}</button>`).join("")}</div></div>
    <div class="field"><span>Poste</span><div class="rh-posts">${Object.entries(RH_POSTS).map(([k, v]) => `<button class="${F.post === k ? "on" : ""}" style="--pc:${v.c};--pb:${v.bg};--pi:${v.ink}" data-act="rhFPost" data-v="${k}"><i></i>${v.t}</button>`).join("")}</div></div>
    <label class="field"><span>Note <em class="rh-opt">facultatif</em></span><input class="input" id="rhFn" maxlength="60" value="${esc(F.note || "")}" placeholder="Ex. livraison, mise en place, fermeture"></label>
    <div class="rh-sum" id="rhFsum">${rhFSum()}</div>
    ${ex ? `<div class="rh-dup"><span class="lbl">Dupliquer aussi sur</span><div class="rh-dupd">${rhWeekDays(mon).map((d, i) => `<button class="chip ${(F.dup || []).includes(d) ? "on" : ""}" data-act="rhFDup" data-v="${d}" ${d === F.day ? "disabled" : ""}>${RH_DSHORT[i]} ${parseDay(d).getDate()}</button>`).join("")}</div></div>` : ""}
    <div class="hstack rh-shb">${ex ? `<button class="btn danger" data-act="rhShiftDel" data-id="${ex.id}" aria-label="Supprimer le créneau">${ico("trash")}</button>` : ""}<button class="btn acc block" data-act="rhShiftSave">${ico("check")}${ex ? ((F.dup || []).length ? `Enregistrer et dupliquer (${F.dup.length})` : "Enregistrer") : F.split ? "Ajouter les 2 créneaux" : "Ajouter au planning"}</button></div>
  </div>`;
}
function rhFSum() {
  const F = S.ui.rhF; if (!F) return ""; const p = rhStaff(F.staffId);
  let m = rhIv({ day: F.day, start: F.start, end: F.end, breakMin: F.breakMin }).w; if (F.split) m += rhIv({ day: F.day, start: F.split[0], end: F.split[1], breakMin: 0 }).w;
  return `<span>${ico("clock")}<b class="mono">${rhDur(m)}</b>de travail</span>${rhIsBoss() && rhRate(p) ? `<span>${ico("euro")}<b class="mono">${rhEur(m / 60 * rhLoadedRate(p))}</b>coût chargé</span>` : ""}`;
}
function rhFRead() { const F = S.ui.rhF; if (!F) return; const g = (id) => $("#" + id)?.value; F.start = g("rhFs") || F.start; F.end = g("rhFe") || F.end; F.note = g("rhFn") ?? F.note; if (F.split) F.split = [g("rhFs2") || F.split[0], g("rhFe2") || F.split[1]]; }
document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest(".rh-shs")) { rhFRead(); const s = $("#rhFsum"); if (s) s.innerHTML = rhFSum(); } });

/* hours card (managers): planned vs clocked, overtime bands, 12-week average, HCR chips. Never blocks anything. */
const rhAlShort = (a) => `${a.d ? RH_DSHORT[(parseDay(a.d).getDay() + 6) % 7] + " · " : ""}${a.k || a.t.split(" : ")[0]}`;
function rhHoursCard(st, mon) {
  const rows = st.per.filter((r) => r.min || r.h.punch || r.h.alerts.length).map((r, i) => {
    const h = r.h; const c = rhNum(r.p.weeklyHours, 35) * 60; const al = h.alerts; const bad = al.filter((x) => x.lvl === "bad");
    const chips = al.slice(0, 2).map((a) => `<span class="rh-wchip ${a.lvl}">${ico("alert")}<span>${esc(rhAlShort(a))}</span></span>`).join("") + (al.length > 2 ? `<span class="rh-wchip more">+${al.length - 2}</span>` : "");
    return `<button class="rh-hr${bad.length ? " bad" : al.length ? " warn" : ""}" data-act="rhHrOpen" data-id="${esc(r.p.id)}">
      <span class="rh-hr-p">${rhAva(r.p, 36)}<span><b>${esc(rhFirst(r.p))}</b><em>contrat ${rhHh(c)}</em></span></span>
      <span class="rh-hr-n"><span><em>Prévu</em><b class="mono">${rhHh(h.plan)}</b></span><span><em>Pointé</em><b class="mono">${h.has ? rhHh(h.punch) : "–"}</b></span><span class="${h.ot.h ? "sup" : ""}"><em>Sup.</em><b class="mono">${h.ot.h ? rhHh(h.ot.h * 60) : "0"}</b></span></span>
      ${chips ? `<span class="rh-hr-c">${chips}</span>` : ""}</button>`;
  }).join("");
  const nAl = st.per.filter((r) => r.h.alerts.length).length;
  return `<div class="glass rh-hrs st" style="--i:5">
    <div class="row rh-hd"><div><div class="h3">Heures de la semaine</div><div class="sub">${nAl ? `${nAl} personne${nAl > 1 ? "s" : ""} à vérifier` : "Rien à signaler côté durées et repos"}</div></div><button class="btn soft sm" data-act="rhPayExport">${ico("download")}<span>Export paie</span></button></div>
    <div class="rh-hrl">${rows || `<p class="sub">Rien de prévu ni de pointé cette semaine.</p>`}</div>
    <p class="note">Heures sup. calculées sur le pointé dès qu'il existe, sinon sur le prévu. Repères HCR, à vérifier avec votre comptable.</p>
  </div>`;
}
function rhHrSheet(sid) {
  const p = rhStaff(sid); const mon = S.ui.rhPlanWeek || rhMonday(); const h = rhHoursOf(p, mon); const c = rhNum(p.weeklyHours, 35) * 60; const boss = rhIsBoss();
  const band = (lbl, v) => `<span class="${v ? "on" : ""}"><em>${lbl}</em><b class="mono">${v ? rhHh(v * 60) : "–"}</b></span>`;
  return `<div class="rh-hrs-s">
    <div class="rh-act-hd">${rhAva(p, 52)}<div><div class="h2">${esc(p.name)}</div><div class="sub">Semaine du ${rhWeekLbl(mon)} · contrat ${rhHh(c)}</div></div></div>
    <div class="rh-act-kpi"><span><b class="mono">${rhHh(h.plan)}</b>prévu</span><span><b class="mono">${h.has ? rhHh(h.punch) : "–"}</b>pointé</span><span><b class="mono">${h.a12.n ? rhHh(h.a12.avg) : "–"}</b>moy. ${h.a12.n || 12} sem.</span></div>
    ${h.away ? `<p class="note rh-awayn">${ico("users")}<span>Plus <b class="mono">${rhHh(h.away)}</b> prévues ${esc(rhSitesOf(sid).map((r) => (typeof mrA === "function" ? mrA : (n) => "à " + n)(rhSiteName(r))).join(" et "))}, comptées dans les heures sup. et les repères HCR.</span></p>` : ""}
    <div><div class="lbl">Heures sup. (sur le ${h.src})</div><div class="rh-bands">${band("+10 %", h.ot.b10)}${band("+20 %", h.ot.b20)}${band("+50 %", h.ot.b50)}</div>${boss && rhRate(p) && h.ot.h ? `<p class="note">Majoration estimée : ${rhEur(h.ot.bonus * rhRate(p), 2)} brut.</p>` : ""}</div>
    ${h.alerts.length ? `<div><div class="lbl">Repères HCR</div>${h.alerts.map((a) => `<div class="rh-lgl ${a.lvl}">${ico("alert")}<span>${a.d ? `<b>${rhDayLbl(a.d, true)}</b> · ` : ""}${esc(a.t)} <em>(${esc(a.src)})</em></span></div>`).join("")}</div>` : `<div class="rh-allok">${ico("check")}<span>Durées, repos et jours off dans les clous.</span></div>`}
    <p class="note">Indicatif, jamais bloquant. Max. ${rhDayCap(p, p.post === "cuisine")[1].replace(" max.", "").replace("max. ", "")} par jour, 11 h de repos entre deux journées, 48 h par semaine, 46 h en moyenne sur 12 semaines, 2 jours de repos.</p>
  </div>`;
}
/* monthly CSV for payroll: weeks belong to the month of their Sunday (full weeks, so overtime stays weekly) */
function rhPayWeeks(m0) {
  const end = dayKey(new Date(parseDay(m0).getFullYear(), parseDay(m0).getMonth() + 1, 0)); let mon = rhMonday(m0); if (addDays(mon, 6) < m0) mon = addDays(mon, 7);
  const out = []; while (addDays(mon, 6) <= end) { out.push(mon); mon = addDays(mon, 7); } return out;
}
function rhPayCsv(m0) {
  const boss = rhIsBoss(); const weeks = rhPayWeeks(m0); const d = parseDay(m0); const ml = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const head = ["Employé", "Contrat", "Heures contrat / sem.", "Semaine du", "au", "Heures prévues", "Heures pointées", "Heures retenues", "Dont autres établissements", "Source", "HS +10 % (h)", "HS +20 % (h)", "HS +50 % (h)", "Jours travaillés", "Moyenne 12 sem. (h)", "Repères HCR", ...(boss ? ["Taux horaire brut", "Brut estimé"] : [])];
  const rows = [[`Heures et heures supplémentaires · ${ml} · ${S.resto?.name || ""}`], [], head];
  const totals = [];
  rhPeople({ all: true }).forEach((p) => {
    let tP = 0, tC = 0, tU = 0, t10 = 0, t20 = 0, t50 = 0, tG = 0, any = false;
    weeks.forEach((mon) => {
      const h = rhHoursOf(p, mon); if (!h.plan && !h.punch) return; any = true; const g = rhWeekGross(h.used, p);
      tP += h.plan; tC += h.punch; tU += h.used; t10 += h.ot.b10; t20 += h.ot.b20; t50 += h.ot.b50; tG += g;
      rows.push([p.name, RH_CONTRACTS[p.contract] || p.contract || "", fmt(rhNum(p.weeklyHours, 35), 2), `${shortDate(mon)}/${mon.slice(0, 4)}`, `${shortDate(addDays(mon, 6))}/${addDays(mon, 6).slice(0, 4)}`, rhDec(h.plan), h.has ? rhDec(h.punch) : "", rhDec(h.used), h.away ? rhDec(h.away) : "", h.src, fmt(h.ot.b10, 2), fmt(h.ot.b20, 2), fmt(h.ot.b50, 2), h.days, h.a12.n ? rhDec(h.a12.avg) : "", h.alerts.map((a) => `${a.d ? shortDate(a.d) + " " : ""}${a.t} (${a.src})`).join(" ; "), ...(boss ? [rhRate(p) ? fmt(rhRate(p), 2) : "", rhRate(p) ? fmt(g, 2) : ""] : [])]);
    });
    if (any) totals.push([p.name, RH_CONTRACTS[p.contract] || p.contract || "", rhDec(tP), rhDec(tC), rhDec(tU), fmt(t10, 2), fmt(t20, 2), fmt(t50, 2), ...(boss ? [rhRate(p) ? fmt(tG, 2) : ""] : [])]);
  });
  return [...rows, [], [`Total ${ml}`], ["Employé", "Contrat", "Heures prévues", "Heures pointées", "Heures retenues", "HS +10 % (h)", "HS +20 % (h)", "HS +50 % (h)", ...(boss ? ["Brut estimé"] : [])], ...totals, [],
    ["Semaines complètes rattachées au mois de leur dimanche. Heures retenues = pointées dès qu'il existe un pointage dans la semaine, sinon prévues."],
    ["Heures supplémentaires (convention HCR) : +10 % de la 36e à la 39e heure, +20 % de la 40e à la 43e, +50 % au-delà. Repères indicatifs à valider par le cabinet de paie."],
    ...(rhPeople({ all: true }).some((p) => rhSitesOf(p.id).length) ? [["Personnes partagées entre plusieurs établissements : les heures prévues ailleurs sont additionnées pour les heures sup. de la semaine. Le même total figure dans l'export de chaque établissement : à ne payer qu'une fois."]] : [])];
}

/* send / print */
function rhPlanText(mon) {
  const days = rhWeekDays(mon); const ppl = rhPeople(); const lines = [`Planning ${S.resto?.name || ""} · semaine du ${rhWeekLbl(mon)}`, ""];
  days.forEach((d) => { const l = ppl.map((p) => ({ p, sh: rhShiftsDay(p.id, d) })).filter((x) => x.sh.length); lines.push(rhDayLbl(d, true)); if (!l.length) lines.push("  personne"); l.forEach((x) => lines.push(`  • ${rhFirst(x.p)} : ${x.sh.map((s) => `${s.start}–${s.end}${RH_POSTS[s.post] ? ` (${RH_POSTS[s.post].t.toLowerCase()})` : ""}`).join(" + ")}`)); lines.push(""); });
  ppl.forEach((p) => { const m = rhShiftsOf(p.id, mon, days[6]).reduce((x, s) => x + rhShiftMin(s), 0); if (m) lines.push(`${rhFirst(p)} : ${rhHh(m)}`); });
  return lines.join("\n");
}
function rhPlanCanvas(mon) {
  const days = rhWeekDays(mon); const ppl = rhPeople(); const W = 1800, top = 150, rowH = 100, x0 = 290, colW = (W - x0 - 150) / 7;
  const rows = ppl.map((p) => ({ p, d: days.map((d) => rhShiftsDay(p.id, d)) })); const H = top + 56 + rows.length * rowH + 90;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const F = (w, s) => `${Math.min(w, 700)} ${s}px "Instrument Sans", system-ui, sans-serif`; const M = (s) => `600 ${s}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillStyle = "#FBF6EC"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#4C1FEA"; g.fillRect(0, 0, W, 112);
  g.fillStyle = "#fff"; g.font = F(800, 44); g.fillText(`Planning · semaine du ${rhWeekLbl(mon)}`, 40, 64); g.font = F(600, 22); g.globalAlpha = 0.85; g.fillText(S.resto?.name || "", 40, 96); g.globalAlpha = 1;
  g.font = F(800, 22); g.fillStyle = "#5A6386"; days.forEach((d, i) => g.fillText(`${RH_DSHORT[i]} ${parseDay(d).getDate()}`, x0 + i * colW + 12, top + 28)); g.fillText("Total", W - 135, top + 28);
  rows.forEach((r, k) => {
    const y = top + 50 + k * rowH; g.fillStyle = k % 2 ? "rgba(255,255,255,.6)" : "#fff"; g.fillRect(20, y, W - 40, rowH - 8);
    g.fillStyle = r.p.color; g.beginPath(); g.arc(62, y + rowH / 2 - 4, 24, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = F(800, 18); g.textAlign = "center"; g.fillText(initials(r.p.name), 62, y + rowH / 2 + 2); g.textAlign = "left";
    g.fillStyle = "#1B1530"; g.font = F(800, 24); g.fillText(rhFirst(r.p), 100, y + rowH / 2 + 4);
    let tot = 0;
    r.d.forEach((l, i) => l.slice(0, 2).forEach((s, j) => { tot += rhShiftMin(s); const x = x0 + i * colW + 6, yy = y + 8 + j * 42, w = colW - 12, col = RH_POSTS[s.post]?.c || "#5A6386"; g.fillStyle = RH_POSTS[s.post]?.bg || "#F4EDE0"; g.fillRect(x, yy, w, 36); g.fillStyle = col; g.fillRect(x, yy, 5, 36); g.fillStyle = "#1B1530"; g.font = M(19); g.fillText(`${s.start}-${s.end}`, x + 13, yy + 25); }));
    r.d.forEach((l) => l.slice(2).forEach((s) => (tot += rhShiftMin(s))));
    g.fillStyle = "#1B1530"; g.font = M(24); g.fillText(rhHh(tot), W - 135, y + rowH / 2 + 4);
  });
  let lx = 40; g.font = F(700, 18); Object.values(RH_POSTS).forEach((p) => { g.fillStyle = p.c; g.fillRect(lx, H - 50, 18, 18); g.fillStyle = "#5A6386"; g.fillText(p.t, lx + 26, H - 35); lx += 150; });
  g.fillText("Growth Gusto", W - 175, H - 35);
  return c;
}
function rhPrintPlan(mon) { rhPrintBuild(mon); SFX.print ? SFX.print() : SFX.tap(); setTimeout(() => { try { window.print(); } catch (e) {} }, 80); }
function rhPrintBuild(mon) {
  const days = rhWeekDays(mon); const ppl = rhPeople(); let el = $("#rhPrint"); if (!el) { el = document.createElement("div"); el.id = "rhPrint"; document.body.appendChild(el); }
  el.innerHTML = `<div class="rhp"><div class="rhp-h"><b>Planning · semaine du ${rhWeekLbl(mon)} ${parseDay(mon).getFullYear()}</b><span>${esc(S.resto?.name || "")}</span></div>
    <table><thead><tr><th></th>${days.map((d, i) => `<th>${RH_DLONG[i]} ${parseDay(d).getDate()}</th>`).join("")}<th>Total</th></tr></thead><tbody>
    ${ppl.map((p) => { let t = 0; return `<tr><th>${esc(p.name)}</th>${days.map((d) => { const l = rhShiftsDay(p.id, d); l.forEach((s) => (t += rhShiftMin(s))); return `<td>${l.map((s) => `<div class="rhp-s" style="border-color:${RH_POSTS[s.post]?.c || "#999"}"><b>${esc(s.start)}–${esc(s.end)}</b>${RH_POSTS[s.post] ? ` ${RH_POSTS[s.post].t}` : ""}${s.breakMin ? ` · p. ${s.breakMin}′` : ""}</div>`).join("") || "<span class='rhp-r'>repos</span>"}</td>`; }).join("")}<td class="rhp-t">${rhHh(t)}</td></tr>`; }).join("")}
    </tbody></table><div class="rhp-f">Imprimé le ${shortDate(dayKey())} à ${hm(Date.now())} · Growth Gusto</div></div>`;
  document.documentElement.classList.add("rh-printing");
}
window.addEventListener("afterprint", () => document.documentElement.classList.remove("rh-printing"));
/* Ctrl+P on the planning screen prints the clean sheet too */
window.addEventListener("beforeprint", () => { if (S.route === "planning" && !document.documentElement.classList.contains("rh-printing")) rhPrintBuild(S.ui.rhPlanWeek || rhMonday()); });

/* ═══════════════════════ EMPLOYÉS ═══════════════════════ */
TAB_OF.staff = "more";
VIEWS.staff = {
  nav: "equipe",
  render() {
    const boss = rhIsBoss(); const all = rhPeople({ all: true }); const act = all.filter((p) => p.active !== false), old = all.filter((p) => p.active === false);
    let money = "";
    if (boss) {
      const mGross = act.reduce((x, p) => x + rhMonthGross(p), 0), mLoaded = act.reduce((x, p) => x + rhMonthGross(p) * (1 + rhCh(p) / 100), 0);
      const t = dayKey(), from30 = addDays(t, -29); const c30 = staffCost(from30, t); const cm = staffCost(t.slice(0, 8) + "01", t);
      let sales = null; if (typeof salesBetween === "function") { try { sales = salesBetween(from30, t); } catch (e) {} }
      const ratio = sales && sales.ht && c30.loaded ? c30.loaded / sales.ht : null;
      const missing = act.filter((p) => !rhRate(p)).length;
      money = `<div class="rh-money st" style="--i:1">
        <div class="glass rh-mh"><span class="lbl">Masse salariale / mois</span><b class="mono">${rhEur(mLoaded)}</b><em>${rhEur(mGross)} brut · estimation chargée des contrats</em></div>
        <div class="glass"><span class="lbl">Ce mois-ci</span><b class="mono">${rhEur(cm.loaded)}</b><em>${fmt(cm.hours, 0)} h ${cm.source === "planning" ? "prévues" : cm.source === "mixte" ? "pointées ou prévues" : "pointées"}</em></div>
        <div class="glass ${ratio != null ? (ratio > 0.38 ? "rh-kbad" : "rh-kok") : ""}"><span class="lbl">Coût / CA 30 j</span><b class="mono">${ratio != null ? `${Math.round(ratio * 100)} %` : "–"}</b><em>${ratio != null ? `${rhEur(c30.loaded)} pour ${rhEur(sales.ht)} HT · repère 30 à 35 %` : "Saisissez vos tickets Z pour comparer au chiffre d'affaires"}</em></div>
      </div>${missing ? `<div class="banner st" style="--i:2">${ico("alert")}<span>${missing} fiche${missing > 1 ? "s" : ""} sans taux horaire : touchez-la pour la compléter, sinon le coût est sous-estimé.</span></div>` : ""}`;
    }
    const card = (p, i) => {
      const rate = rhRate(p), lr = rhLoadedRate(p), mg = rhMonthGross(p);
      return `<button class="glass rh-emp st${p.active === false ? " old" : ""}" style="--i:${i + 3}" data-act="rhEmp" data-id="${esc(p.id)}">${rhAva(p, 48)}
        <span class="rh-emp-t"><b>${esc(p.name)}</b><em>${esc(p.role || "Poste à préciser")} · ${RH_CONTRACTS[p.contract] || esc(p.contract)} · ${fmt(rhNum(p.weeklyHours, 35), 0)} h/sem.</em>
        ${boss ? (rate ? `<span class="rh-emp-m"><span><b class="mono">${fmt(rate, 2)} €</b>brut / h</span><span><b class="mono">${fmt(lr, 2)} €</b>chargé / h</span><span><b class="mono">${rhEur(mg)}</b>brut / mois</span><span><b class="mono">${rhEur(mg * (1 + rhCh(p) / 100))}</b>chargé / mois</span></span>` : `<span class="pill warn">Taux horaire à saisir</span>`) : ""}</span>${ico("chev")}</button>`;
    };
    return `<div class="inner rh-staff">${topBar("Employés", { right: rhCanEdit() ? `<button class="btn soft sm" data-act="rhBulk" aria-label="Ajouter plusieurs personnes">${ico("users")}<span class="rh-bt">Plusieurs</span></button><button class="btn acc sm" data-act="rhEmpNew">${ico("plus")}Ajouter</button>` : "" })}
      ${money}
      ${act.length ? `<div class="rh-emps">${act.map(card).join("")}</div>` : `<div class="glass empty st" style="--i:3"><span class="ic">${ico("rhid")}</span><b>Aucun employé</b>Créez une fiche par personne : poste, contrat, heures et taux horaire. Le planning et la pointeuse s'en servent.</div>`}
      ${old.length ? `<div class="lbl st" style="--i:30">Anciens employés</div><div class="rh-emps">${old.map((p, i) => card(p, i + 30)).join("")}</div>` : ""}
      <div class="rh-links st" style="--i:38"><button class="btn soft sm" data-go="planning">${ico("cal")}Planning</button><button class="btn soft sm" data-go="pointeuse">${ico("clock")}Pointeuse</button></div>
      ${boss ? `<p class="note st" style="--i:40">Coûts indicatifs : brut mensuel = taux × heures du contrat × 52 / 12, avec la majoration HCR des heures au-delà de 35 h ; chargé = brut × (1 + charges patronales). Seul le gérant voit les salaires.</p>` : `<p class="note st" style="--i:40">${rhCanEdit() && !rhPaid() ? "Salaires, coûts du personnel et export paie : pack Chef." : "Les salaires et les coûts ne sont visibles que par le gérant."}</p>`}
    </div>`;
  },
};
function rhSitesPick(F) {
  const others = (S.restos || []).filter((r) => r.id !== S.rid); if (!others.length || !rhCanEdit() || (typeof abHas === "function" && !abHas("sites"))) return "";
  const on = new Set((F.sites || []).filter((r) => r !== S.rid));
  return `<div class="field rh-sites"><span>Travaille aussi dans</span><div class="chips" style="flex-wrap:wrap">${others.map((r) => `<button class="chip ${on.has(r.id) ? "on" : ""}" data-act="rhESite" data-v="${esc(r.id)}" aria-pressed="${on.has(r.id)}">${esc(r.name || "Restaurant")}</button>`).join("")}</div>
    <p class="note" style="margin-top:6px">${on.size ? `Une seule fiche : ${esc(firstName(F.name || "Cette personne"))} apparaît au planning et à la pointeuse de chaque établissement coché, avec le même code. Ses heures s'additionnent pour les repères HCR et les heures sup.` : "Pour une personne partagée entre vos restaurants : ses heures s'additionnent pour les repères HCR et les heures sup."}</p></div>`;
}
function rhEmpSheet() {
  const F = S.ui.rhE; const boss = rhIsBoss(); const linkable = S.members.filter((m) => !S.staff.some((s) => s.memberId === m.id && s.id !== F.id));
  return `<div class="rh-es">
    <div class="rh-act-hd"><span id="rhEava">${rhAva({ name: F.name || "?", color: F.color }, 60)}</span><div><div class="h2">${F.id && !F._new ? "Fiche employé" : F._virtual ? "Compléter la fiche" : "Nouvel employé"}</div><div class="sub">${F.memberId ? "Compte lié : même code pour pointer" : "Pointe avec un code à 4 chiffres"}</div></div></div>
    <label class="field"><span>Prénom et nom</span><input class="input" id="rhEn" value="${esc(F.name || "")}" maxlength="40" placeholder="Ex. Léa Martin" autocomplete="off"></label>
    <label class="field"><span>Poste</span><input class="input" id="rhEr" value="${esc(F.role || "")}" list="rhRoles" maxlength="40" placeholder="Ex. Commis de cuisine"><datalist id="rhRoles">${RH_ROLES.map((r) => `<option value="${esc(r)}">`).join("")}</datalist></label>
    <div class="field"><span>Poste habituel au planning</span><div class="rh-posts">${Object.entries(RH_POSTS).map(([k, v]) => `<button class="${F.post === k ? "on" : ""}" style="--pc:${v.c};--pb:${v.bg};--pi:${v.ink}" data-act="rhEPost" data-v="${k}"><i></i>${v.t}</button>`).join("")}</div></div>
    <div class="field"><span>Contrat</span><div class="rh-opts">${Object.entries(RH_CONTRACTS).map(([k, v]) => `<button class="${F.contract === k ? "on" : ""}" data-act="rhEContract" data-v="${k}">${v}</button>`).join("")}</div></div>
    <div class="grid2"><label class="field"><span>Heures / semaine</span><input class="input mono" id="rhEh" inputmode="decimal" value="${esc(String(F.weeklyHours ?? 35).replace(".", ","))}"></label>
      <div class="field"><span>Couleur</span><div class="rh-cols">${PALETTE.map((c) => `<button class="${F.color === c ? "on" : ""}" style="background:${c}" data-act="rhEColor" data-v="${c}" aria-label="Couleur ${c}"></button>`).join("")}</div></div></div>
    ${boss ? `<div class="rh-esm"><div class="lbl">${ico("lock")}Salaire · visible par le gérant seulement</div>
      <div class="grid2"><label class="field"><span>Taux horaire brut (€)</span><input class="input mono" id="rhEw" inputmode="decimal" value="${esc(String(F.hourlyGross ?? "").replace(".", ","))}" placeholder="Ex. 12,50"></label>
      <label class="field"><span>Charges patronales (%)</span><input class="input mono" id="rhEc" inputmode="decimal" value="${esc(String(F.chargesPct ?? 42).replace(".", ","))}"></label></div>
      <div class="rh-sum" id="rhEsum">${rhESum()}</div>${F.contract === "apprenti" ? `<p class="note">Apprenti : charges très réduites (souvent moins de 10 %), à ajuster.</p>` : ""}</div>` : ""}
    ${rhSitesPick(F)}
    <div class="grid2"><label class="field"><span>Entrée</span><input class="input" type="date" id="rhEs" value="${esc(F.start || "")}"></label><label class="field"><span>${F.contract === "CDD" ? "Fin du CDD" : "Sortie"}</span><input class="input" type="date" id="rhEe" value="${esc(F.end || "")}"></label></div>
    <label class="field"><span>Compte de l'app</span><select class="input" id="rhEm"><option value="">Aucun</option>${linkable.map((m) => `<option value="${esc(m.id)}" ${F.memberId === m.id ? "selected" : ""}>${esc(m.name || "Sans nom")} · ${ROLES[m.role] || "Équipe"}</option>`).join("")}</select></label>
    ${F.id && (!F._new || F._virtual) ? `<div class="hstack rh-esx">${F.pinHash ? `<button class="btn soft sm" data-act="rhEPinReset">${ico("lock")}Effacer le code de pointage</button>` : ""}${F._virtual ? "" : `<button class="btn soft sm" data-act="rhEArchive">${F.active === false ? "Réactiver" : "Départ de l'entreprise"}</button>`}</div>` : ""}
    <button class="btn acc block" data-act="rhEmpSave">${ico("check")}Enregistrer</button>
  </div>`;
}
function rhESum() {
  const F = S.ui.rhE; if (!F) return ""; const p = { ...F, hourlyGross: rhNum(F.hourlyGross, 0), chargesPct: rhNum(F.chargesPct, 42), weeklyHours: rhNum(F.weeklyHours, 35) };
  if (!p.hourlyGross) return `<span class="sub">Saisissez le taux horaire pour voir le coût.</span>`;
  const mg = rhMonthGross(p); const ot = rhOT(p.weeklyHours * 60);
  return `<span><b class="mono">${fmt(rhLoadedRate(p), 2)} €</b>coût / heure</span><span><b class="mono">${rhEur(mg)}</b>brut / mois</span><span><b class="mono">${rhEur(mg * (1 + p.chargesPct / 100))}</b>chargé / mois</span>${ot.h ? `<em>dont ${fmt(ot.h, 0)} h sup. par semaine, majorées</em>` : ""}`;
}
function rhERead() { const F = S.ui.rhE; if (!F) return; const g = (id) => $("#" + id)?.value; F.name = g("rhEn") ?? F.name; F.role = g("rhEr") ?? F.role; F.weeklyHours = g("rhEh") ?? F.weeklyHours; if ($("#rhEw")) F.hourlyGross = g("rhEw"); if ($("#rhEc")) F.chargesPct = g("rhEc"); F.start = g("rhEs") ?? F.start; F.end = g("rhEe") ?? F.end; F.memberId = g("rhEm") ?? F.memberId; }
document.addEventListener("input", (e) => {
  if (!e.target.closest || !e.target.closest(".rh-es")) return; rhERead();
  const s = $("#rhEsum"); if (s) s.innerHTML = rhESum(); if (e.target.id === "rhEn") { const a = $("#rhEava"); if (a) a.innerHTML = rhAva({ name: S.ui.rhE.name || "?", color: S.ui.rhE.color }, 60); }
});

/* ───────────── compte.js menus: add the RH entries (workaround: compte owns these views) ───────────── */
(function rhHooks() {
  if (VIEWS.more && VIEWS.more.render) {
    const r0 = VIEWS.more.render;
    VIEWS.more.render = function () {
      const h = r0.apply(this, arguments); if (h.includes('data-go="pointeuse"')) return h;
      const items = [["pointeuse", "clock", "Pointeuse"], ["planning", "cal", "Planning"], ...(rhCanStaff() ? [["staff", "rhid", "Employés"]] : [])];
      const pres = rhPeople().filter((p) => rhState(p.id).state !== "off").length;
      const blk = `<div class="lbl st cc-sec" style="--i:6">Équipe</div><div class="cc-grid st" style="--i:7">${items.map(([r, i, t]) => `<button class="cc-gt" data-go="${r}"><span class="ic">${ico(i)}</span><span class="t">${t}</span>${r === "pointeuse" && pres ? `<span class="cc-gb mono" style="background:var(--ok)">${pres}</span>` : ""}</button>`).join("")}</div>`;
      const i = h.lastIndexOf('<div class="lbl st cc-sec"'); return i > 0 ? h.slice(0, i) + blk + h.slice(i) : h;
    };
  }
  if (VIEWS.equipe && VIEWS.equipe.render) {
    const r1 = VIEWS.equipe.render;
    VIEWS.equipe.render = function () {
      const h = r1.apply(this, arguments); if (h.includes("rh-eqlink")) return h;
      const link = `<div class="glass pad rh-eqlink st" style="--i:3">${rhCanStaff() ? `<div class="li tap" data-go="staff"><span class="ic">${ico("rhid")}</span><div class="tx"><b>${rhPaid() ? "Fiches employés et salaires" : "Fiches employés"}</b><em>${rhPaid() ? "Contrats, heures, coût chargé" : "Contrats, heures, postes"}</em></div>${ico("chev")}</div>` : ""}${rhCanEdit() ? `<div class="li tap" data-act="rhBulk"><span class="ic">${ico("users")}</span><div class="tx"><b>Ajouter des extras ou saisonniers</b><em>Collez une liste de noms, en une fois</em></div>${ico("chev")}</div>` : ""}<div class="li tap" data-go="planning"><span class="ic">${ico("cal")}</span><div class="tx"><b>Planning</b><em>Créneaux de la semaine</em></div>${ico("chev")}</div><div class="li tap" data-go="pointeuse"><span class="ic">${ico("clock")}</span><div class="tx"><b>Pointeuse</b><em>Arrivées, pauses, départs</em></div>${ico("chev")}</div></div>`;
      const i = h.lastIndexOf("</div>"); return i > 0 ? h.slice(0, i) + link + h.slice(i) : h + link;
    };
  }
})();

/* keyboard on the PIN pad (tablet with keyboard, desktop) */
document.addEventListener("keydown", (e) => {
  if (!$("#sheet").classList.contains("open") || !$("#sheetBody .rh-pin")) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); ACT.rhKey(null, null, e.key); } else if (e.key === "Backspace") { e.preventDefault(); ACT.rhKey(null, null, "del"); }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && RH.kiosk) rhWakeLock(true); });
/* one run at a time per action (rapid double taps), through compte's helper when present */
function rhOnce(k, fn) { return typeof ccOnce === "function" ? ccOnce(k, fn, 300) : fn(); }

/* ═══════════════════════ actions ═══════════════════════ */
Object.assign(ACT, {
  /* pointeuse */
  rhTile: (a, id) => {
    const p = rhStaff(id); if (!p) return; SFX.tap(); buzz(5);
    RH.pin = { sid: id, code: "", err: "", mode: rhHasPin(p) ? "check" : "new", first: "" }; openSheet(rhPinHTML()); rhIdle();
  },
  rhKey: (a, id, v) => {
    const P = RH.pin; if (!P || !$("#sheetBody .rh-pin") || P.busy) return; rhIdle();
    if (v === "del") P.code = P.code.slice(0, -1); else if (P.code.length < 4) P.code += v; else return; P.err = "";
    SFX.tick(); buzz(4); $("#sheetBody").innerHTML = rhPinHTML();
    if (P.code.length < 4) return;
    const p = rhStaff(P.sid); P.busy = true;
    setTimeout(async () => {
      P.busy = false;
      if (P.mode === "check") {
        if (rhPinOk(p, P.code)) { $("#sheetBody .rh-dots")?.classList.add("ok"); SFX.ok(); P.busy = true; setTimeout(() => { if (RH.pin === P) { openSheet(rhActHTML(P.sid)); rhIdle(); } }, 240); }
        else { P.code = ""; P.err = "Code incorrect, réessayez"; SFX.err(); buzz([30, 50, 30]); $("#sheetBody").innerHTML = rhPinHTML(); }
      } else if (P.mode === "new") { P.first = P.code; P.code = ""; P.mode = "confirm"; SFX.tap(); $("#sheetBody").innerHTML = rhPinHTML(); }
      else if (P.mode === "confirm") {
        if (P.code !== P.first) { P.code = ""; P.first = ""; P.mode = "new"; P.err = "Les deux codes sont différents, recommencez"; SFX.err(); buzz([30, 50, 30]); $("#sheetBody").innerHTML = rhPinHTML(); return; }
        const sid = await rhEnsure(p); await safe(DB.update("staff", sid, { pinHash: rhPinHash(sid, P.code) })); SFX.ok(); toast("Code enregistré : retenez-le bien");
        setTimeout(() => { openSheet(rhActHTML(P.sid)); rhIdle(); }, 200);
      }
    }, 140);
  },
  rhPunch: (a, sid, kind) => rhOnce("rhPunch", async () => {
    const p = rhStaff(sid); if (!p) return; const s = rhState(sid);
    const ok = { off: ["in"], in: ["breakStart", "out"], pause: ["breakEnd", "out"] }[s.state]; if (!ok.includes(kind)) { toast("Ce pointage a déjà été fait.", "err"); return; }
    await rhEnsure(p);
    const now = Date.now(); const openS = s.state !== "off" ? s.sessions[s.sessions.length - 1] : null; const day = openS ? openS.day : dayKey();
    await safe(DB.add("punches", { staffId: sid, kind, at: now, day, by: p.memberId || S.me.id, src: "pin" }));
    closeSheet(true); RH.pin = null; clearTimeout(RH.idleT);
    const after = rhState(sid); const plan = rhShiftsDay(sid, dayKey());
    const extra = kind === "out" ? `${rhDur(after.todayMin)} de travail aujourd'hui` : kind === "in" && plan.length ? `Prévu jusqu'à ${plan[plan.length - 1].end}` : "";
    rhDone(kind, p, extra, kind === "out" && rhTicketOn() ? day : ""); kind === "in" || kind === "out" ? SFX.done() : SFX.ok(); buzz(kind === "out" ? [10, 40, 10, 40, 20] : [10, 40, 18]);
    if (kind === "in") burst(window.innerWidth / 2, window.innerHeight / 2.6);
  }),
  rhTicket: (a, sid, day) => { const el = $("#rhDone"); if (el) el.classList.remove("on"); clearTimeout(RH.doneT); rhPrintTicket(sid, day || dayKey()); },
  rhTicketNo: () => { const el = $("#rhDone"); if (el) el.classList.remove("on"); clearTimeout(RH.doneT); SFX.close ? SFX.close() : SFX.tap(); },
  rhTicketSet: () => rhOnce("rhTicketSet", async () => { const on = !rhTicketOn(); await safe(DB.update("restos", S.rid, { rhTicket: on })); if (S.resto) S.resto.rhTicket = on; SFX.tick(); buzz(5); toast(on ? "Au départ, chacun pourra imprimer son ticket d'heures" : "Plus de ticket proposé au départ"); rerender(); }),
  rhPdf: (a, sid, v) => { if (sid !== "all" && v !== "self" && !rhIsMgr()) return; if (sid === "all" && !rhIsMgr()) return; RH.pin = null; clearTimeout(RH.idleT); rhPdfOpen(sid, v === "self"); },
  rhPdfPick: (a, id, v) => {
    const U = S.ui.rhPdf; if (!U) return; let A, B;
    if (v === "custom") { A = $("#rhPdfA")?.value; B = $("#rhPdfB")?.value; if (!A || !B) { SFX.err(); toast("Choisissez les deux dates.", "err"); return; } if (B < A) [A, B] = [B, A]; U.a = A; U.b = B; }
    else { const o = rhPdfOpts().find((x) => x[0] === v); if (!o) return; A = o[2]; B = o[3]; }
    closeSheet(true); rhPdfGo(U.who, A, B, U.self);
  },
  rhKiosk: async () => {
    RH.kiosk = !RH.kiosk; SFX.tap(); buzz(6); document.documentElement.classList.toggle("rh-kiosk", RH.kiosk);
    if (RH.kiosk) { try { const de = document.documentElement; if (de.requestFullscreen && !document.fullscreenElement) await de.requestFullscreen(); } catch (e) {} rhWakeLock(true); toast("Mode borne : posez la tablette à l'entrée"); }
    else { try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch (e) {} rhWakeLock(false); }
    rerender(); renderChrome();
  },
  rhTsWeek: (a, id, v) => { SFX.tick(); S.ui.rhTsWeek = +v === 0 ? rhMonday() : addDays(S.ui.rhTsWeek || rhMonday(), +v); rerender(); },
  rhTsOpen: (a, id) => { if (!rhIsMgr()) return; SFX.tap(); S.ui.rhTsSid = id; S.ui.rhEdit = null; rhTsPaint(); },
  rhEdNew: () => { SFX.tap(); const mon = S.ui.rhTsWeek || rhMonday(); const t = dayKey(); S.ui.rhEdit = { id: null, kind: "in", day: t >= mon && t <= addDays(mon, 6) ? t : mon, time: hm(Date.now()) }; rhTsPaint(); },
  rhEdOpen: (a, id) => { SFX.tap(); S.ui.rhEdit = { id }; rhTsPaint(); },
  rhEdCancel: () => { SFX.tap(); S.ui.rhEdit = null; rhTsPaint(); },
  rhEdKind: (a, id, v) => { const E = S.ui.rhEdit; if (!E) return; E.day = $("#rhEdDay")?.value || E.day; E.time = $("#rhEdTime")?.value || E.time; E.kind = v; SFX.tick(); rhTsPaint(); },
  rhEdSave: (a, id) => rhOnce("rhEdSave", async () => {
    const sid = S.ui.rhTsSid; const p = rhStaff(sid); const time = $("#rhEdTime")?.value; const note = ($("#rhEdNote")?.value || "").trim();
    if (!time) { SFX.err(); toast("Indiquez l'heure.", "err"); return; }
    if (id) {
      const pu = S.punches.find((x) => x.id === id); if (!pu) return; let at = rhAt(pu.day, time);
      if (pu.kind !== "in" && rhT2m(time) < 360 && S.punches.some((x) => x.staffId === sid && x.day === pu.day && x.kind === "in" && !x.void && x.at > at)) at += 864e5;
      if (at === pu.at && note === (pu.note || "")) { S.ui.rhEdit = null; rhTsPaint(); return; }
      await safe(DB.update("punches", id, { at, edited: true, editedBy: S.me.id, editedAt: Date.now(), origAt: pu.origAt || pu.at, note }));
      logEvent("pointage", `a corrigé le pointage de ${rhFirst(p)} (${RH_KIND[pu.kind].t.toLowerCase()} ${hm(pu.at)} → ${time})`, { ref: id });
    } else {
      const E = S.ui.rhEdit; const day = $("#rhEdDay")?.value || E.day; const kind = E.kind || "in"; await rhEnsure(p);
      let at = rhAt(day, time); if (kind !== "in" && rhT2m(time) < 360 && S.punches.some((x) => x.staffId === sid && x.day === day && x.kind === "in" && !x.void && x.at > at)) at += 864e5;
      const nid = await safe(DB.add("punches", { staffId: sid, kind, at, day, by: S.me.id, src: "manager", edited: true, added: true, editedBy: S.me.id, editedAt: Date.now(), note }));
      logEvent("pointage", `a ajouté un pointage oublié pour ${rhFirst(p)} (${RH_KIND[kind].t.toLowerCase()} ${time}, ${shortDate(day)})`, { ref: nid });
    }
    SFX.ok(); buzz(8); toast("Pointage enregistré"); S.ui.rhEdit = null; setTimeout(rhTsPaint, 90);
  }),
  rhEdVoid: (a, id) => rhOnce("rhEdVoid", async () => {
    const pu = S.punches.find((x) => x.id === id); if (!pu) return; const p = rhStaff(pu.staffId); const note = ($("#rhEdNote")?.value || "").trim() || "annulé";
    await safe(DB.update("punches", id, { void: true, edited: true, editedBy: S.me.id, editedAt: Date.now(), note }));
    logEvent("pointage", `a annulé un pointage de ${rhFirst(p)} (${RH_KIND[pu.kind].t.toLowerCase()} ${hm(pu.at)})`, { ref: id });
    SFX.close(); toast("Pointage annulé, gardé dans l'historique"); S.ui.rhEdit = null; setTimeout(rhTsPaint, 90);
  }),
  rhExport: () => {
    SFX.tap(); const t = dayKey(); const mon = S.ui.rhTsWeek || rhMonday(); const m0 = t.slice(0, 8) + "01"; const pm = parseDay(m0); pm.setMonth(pm.getMonth() - 1); const pm0 = dayKey(pm), pm1 = addDays(m0, -1);
    const opt = [["week", `Semaine du ${rhWeekLbl(mon)}`, mon, addDays(mon, 6)], ["month", `Ce mois-ci (${MONTHS[parseDay(m0).getMonth()]})`, m0, t], ["prev", `Mois dernier (${MONTHS[pm.getMonth()]})`, pm0, pm1]];
    S.ui.rhExp = opt;
    openSheet(`<div class="h2">Export pour le comptable</div><p class="sub">Fichier CSV (Excel) : heures par jour, pauses et corrections, puis un récapitulatif par semaine avec les heures sup.</p>
      <div>${opt.map(([k, l, a, b]) => { const c = staffCost(a, b); return `<div class="li tap" role="button" tabindex="0" data-act="rhExportGo" data-v="${k}"><span class="ic">${ico("download")}</span><div class="tx"><b>${l}</b><em>${shortDate(a)} → ${shortDate(b)} · ${fmt(c.hours, 1)} h</em></div>${ico("chev")}</div>`; }).join("")}</div>
      <div class="lbl" style="margin-top:14px">Relevés à signer</div><div class="li tap" role="button" tabindex="0" data-act="rhPdf" data-id="all"><span class="ic">${ico("printer")}</span><div class="tx"><b>Relevés d'heures en PDF</b><em>Une page par employé : jours, semaines, heures sup.</em></div>${ico("chev")}</div>`);
  },
  rhExportGo: (a, id, v) => { const o = (S.ui.rhExp || []).find((x) => x[0] === v); if (!o) return; closeSheet(true); const slug = (S.resto?.name || "resto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(); saveCsv(`pointages-${slug}-${o[2]}-au-${o[3]}.csv`, rhCsv(o[2], o[3])); },

  /* planning */
  rhPlanWeek: (a, id, v) => { SFX.tick(); buzz(4); S.ui.rhPlanWeek = +v === 0 ? rhMonday() : addDays(S.ui.rhPlanWeek || rhMonday(), +v); if (+v === 0) S.ui.rhDay = null; rerender(); },
  rhDay: (a, id, v) => { const cur = S.ui.rhDay != null ? S.ui.rhDay : Math.max(0, rhWeekDays(S.ui.rhPlanWeek || rhMonday()).indexOf(dayKey())); S.ui.rhDay = +v; SFX.tick(); buzz(4); rerender(); const dv = $("#rhDayV"); if (dv && cur !== +v) dv.classList.add(+v > cur ? "rh-in-r" : "rh-in-l"); },
  rhCell: (a, sid, day, e) => {
    if (!rhIsMgr() || (e && e.target.closest && e.target.closest(".rh-sh"))) return; const p = rhStaff(sid);
    const last = S.shifts.filter((s) => s.staffId === sid).sort((x, y) => (y.at || 0) - (x.at || 0))[0];
    S.ui.rhF = { id: null, staffId: sid, day, start: last?.start || "10:00", end: last?.end || "15:00", breakMin: last ? +last.breakMin || 0 : 0, post: last?.post || p?.post || "cuisine", note: "" };
    SFX.tap(); openSheet(rhShiftSheet());
  },
  rhShift: (a, id) => {
    const s = S.shifts.find((x) => x.id === id); if (!s) return;
    if (!rhIsMgr()) { const p = rhStaff(s.staffId); toast(`${rhFirst(p)} · ${s.start}–${s.end}${RH_POSTS[s.post] ? " · " + RH_POSTS[s.post].t : ""}`, "info"); return; }
    S.ui.rhF = { id, staffId: s.staffId, day: s.day, start: s.start, end: s.end, breakMin: +s.breakMin || 0, post: s.post || "", note: s.note || "", dup: [] }; SFX.tap(); openSheet(rhShiftSheet());
  },
  rhPreset: (a, id, v) => { const F = S.ui.rhF; const x = RH_PRESETS[+v]; rhFRead(); F.start = x[1]; F.end = x[2]; F.breakMin = x[3]; F.split = x[4] ? [x[4], x[5]] : null; F.preset = +v; SFX.tick(); buzz(4); openSheet(rhShiftSheet()); },
  rhFBreak: (a, id, v) => { rhFRead(); S.ui.rhF.breakMin = +v; SFX.tick(); openSheet(rhShiftSheet()); },
  rhFPost: (a, id, v) => { rhFRead(); S.ui.rhF.post = S.ui.rhF.post === v ? "" : v; SFX.tick(); openSheet(rhShiftSheet()); },
  rhFDup: (a, id, v) => { rhFRead(); const F = S.ui.rhF; F.dup = F.dup || []; const i = F.dup.indexOf(v); i >= 0 ? F.dup.splice(i, 1) : F.dup.push(v); SFX.tick(); openSheet(rhShiftSheet()); },
  rhShiftSave: () => rhOnce("rhShiftSave", async () => {
    rhFRead(); const F = S.ui.rhF; if (!F) return;
    if (rhT2m(F.start) == null || rhT2m(F.end) == null) { SFX.err(); toast("Indiquez le début et la fin.", "err"); return; }
    if (F.start === F.end) { SFX.err(); toast("Le début et la fin sont identiques.", "err"); return; }
    const p = rhStaff(F.staffId); await rhEnsure(p);
    const doc = { staffId: F.staffId, day: F.day, start: F.start, end: F.end, breakMin: +F.breakMin || 0, post: F.post || "", note: (F.note || "").trim() };
    const ids = [];
    if (F.id) { await safe(DB.update("shifts", F.id, doc)); for (const d of F.dup || []) ids.push(await DB.add("shifts", { ...doc, day: d, at: Date.now(), by: S.me.id })); }
    else { ids.push(await safe(DB.add("shifts", { ...doc, at: Date.now(), by: S.me.id }))); if (F.split) ids.push(await DB.add("shifts", { ...doc, start: F.split[0], end: F.split[1], breakMin: 0, at: Date.now() + 1, by: S.me.id })); }
    closeSheet(true); buzz(8);
    if (!F.id) { RH.undo = { ids }; rhUndoToast(`${rhFirst(p)} · ${rhDayLbl(F.day)} : ${F.start}–${F.split ? F.split[1] : F.end}`); }
    else if (ids.length) { RH.undo = { ids }; rhUndoToast(`Copié sur ${ids.length} jour${ids.length > 1 ? "s" : ""}`); }
    else { SFX.ok(); toast("Créneau enregistré"); RH.undo = null; }
    rhLegalToast(F.staffId, F.day);
  }),
  rhShiftDel: async (a, id) => {
    const s = S.shifts.find((x) => x.id === id); if (!s) return; const { id: _i, ...doc } = s; await safe(DB.del("shifts", id)); closeSheet(true); SFX.close(); buzz(6);
    RH.undo = { restore: [[id, doc]] }; rhUndoToast("Créneau supprimé");
  },
  rhUndo: async () => {
    const u = RH.undo; RH.undo = null; if (!u) return; $("#toast").classList.remove("on");
    for (const id of u.ids || []) await DB.del("shifts", id).catch(() => {});
    for (const [id, doc] of u.restore || []) await DB.set("shifts", id, doc).catch(() => {});
    SFX.close();
  },
  rhPropose: () => { const mon = S.ui.rhPlanWeek || rhMonday(); SFX.tap(); if (!S.ui.pf || S.ui.pf.mon !== mon) S.ui.pf = { mon, cov: {} }; go("planif"); },
  rhCopyWeek: () => {
    const mon = S.ui.rhPlanWeek || rhMonday(); const prev = addDays(mon, -7); const src = S.shifts.filter((s) => s.day >= prev && s.day <= addDays(prev, 6));
    if (!src.length) { SFX.err(); toast("La semaine d'avant est vide.", "err"); return; }
    const todo = src.filter((s) => !S.shifts.some((x) => x.staffId === s.staffId && x.day === addDays(s.day, 7) && x.start === s.start && x.end === s.end));
    if (!todo.length) { toast("Déjà copiée : rien de nouveau à ajouter.", "info"); return; }
    if (!S.shifts.some((s) => s.day >= mon && s.day <= addDays(mon, 6))) return ACT.rhCopyGo();
    openSheet(`<div class="h2">Copier la semaine d'avant ?</div><p class="sub">${todo.length} créneau${todo.length > 1 ? "x" : ""} de la semaine du ${rhWeekLbl(prev)} ${todo.length > 1 ? "seront ajoutés" : "sera ajouté"}. Les créneaux déjà prévus cette semaine sont gardés.</p><button class="btn acc block" data-act="rhCopyGo">${ico("rhcopy")}Copier ${todo.length} créneau${todo.length > 1 ? "x" : ""}</button><button class="btn ghost" data-act="sheetClose">Annuler</button>`);
  },
  rhCopyGo: () => rhOnce("rhCopy", async () => {
    const mon = S.ui.rhPlanWeek || rhMonday(); const prev = addDays(mon, -7); const src = S.shifts.filter((s) => s.day >= prev && s.day <= addDays(prev, 6));
    const todo = src.filter((s) => !S.shifts.some((x) => x.staffId === s.staffId && x.day === addDays(s.day, 7) && x.start === s.start && x.end === s.end));
    const ids = []; for (const s of todo) { const { id, ...doc } = s; ids.push(await DB.add("shifts", { ...doc, day: addDays(s.day, 7), at: Date.now(), by: S.me.id })); }
    closeSheet(true); RH.undo = { ids }; buzz([8, 30, 8]); rhUndoToast(`${ids.length} créneau${ids.length > 1 ? "x" : ""} copié${ids.length > 1 ? "s" : ""}`); SFX.done();
  }),
  rhSend: () => {
    SFX.tap(); const mon = S.ui.rhPlanWeek || rhMonday();
    openSheet(`<div class="h2">Partager le planning</div><p class="sub">Semaine du ${rhWeekLbl(mon)}</p><div>
      <div class="li tap" role="button" tabindex="0" data-act="rhSendImg"><span class="ic">${ico("image")}</span><div class="tx"><b>Envoyer en image</b><em>Pour le groupe de l'équipe (WhatsApp, SMS…)</em></div>${ico("chev")}</div>
      <div class="li tap" role="button" tabindex="0" data-act="rhSendTxt"><span class="ic">${ico("list")}</span><div class="tx"><b>Envoyer en texte</b><em>Lisible sur tous les téléphones</em></div>${ico("chev")}</div>
      <div class="li tap" role="button" tabindex="0" data-act="rhPrint"><span class="ic">${ico("printer")}</span><div class="tx"><b>Imprimer</b><em>A4 paysage, à afficher en cuisine</em></div>${ico("chev")}</div></div>`);
  },
  rhSendImg: async () => {
    const mon = S.ui.rhPlanWeek || rhMonday(); const c = rhPlanCanvas(mon); const blob = await new Promise((r) => c.toBlob(r, "image/png")); const name = `planning-${mon}.png`;
    try { if (navigator.canShare && window.File) { const f = new File([blob], name, { type: "image/png" }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: `Planning ${rhWeekLbl(mon)}` }); closeSheet(true); SFX.ok(); return; } } } catch (e) { if (e && e.name === "AbortError") return; }
    closeSheet(true); try { await S.cap.downloads.save({ filename: name, data: blob, mimeType: "image/png" }); SFX.ok(); toast("Image du planning enregistrée"); } catch (e) { if (!e || e.code !== "declined") toast("Partage impossible.", "err"); }
  },
  rhSendTxt: async () => {
    const txt = rhPlanText(S.ui.rhPlanWeek || rhMonday());
    try { if (navigator.share && PHONE_MQ.matches) { await navigator.share({ text: txt }); closeSheet(true); SFX.ok(); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(txt); closeSheet(true); SFX.ok(); toast("Planning copié : collez-le dans votre message"); } catch (e) { closeSheet(true); toast("Copie impossible sur cet appareil.", "err"); }
  },
  rhPrint: () => { closeSheet(true); rhPrintPlan(S.ui.rhPlanWeek || rhMonday()); },
  rhHrOpen: (a, id) => { if (!rhIsMgr() || !rhStaff(id)) return; SFX.tap(); openSheet(rhHrSheet(id)); },
  rhHrJump: () => { const c = $(".rh-hrs"); if (!c) return; SFX.tap(); c.scrollIntoView({ behavior: "smooth", block: "start" }); c.classList.remove("rh-flash"); void c.offsetWidth; c.classList.add("rh-flash"); },
  rhPayExport: () => {
    if (!rhIsMgr()) return; if (!rhPaid()) { SFX.tap(); toast("L'export paie fait partie du pack Chef.", "info"); if (typeof abGerant === "function" && abGerant()) go("abonnement"); return; } SFX.tap(); const t = dayKey(); const m0 = t.slice(0, 8) + "01"; const pm = parseDay(m0); pm.setMonth(pm.getMonth() - 1); const pm0 = dayKey(pm);
    const opt = [[m0, `Ce mois-ci (${MONTHS[parseDay(m0).getMonth()]})`], [pm0, `Mois dernier (${MONTHS[pm.getMonth()]})`]];
    openSheet(`<div class="h2">Export paie du mois</div><p class="sub">Un fichier CSV (Excel) pour le comptable : heures prévues et pointées, heures sup. par taux, repères HCR, par semaine et par personne.</p>
      <div>${opt.map(([k, l]) => { const w = rhPayWeeks(k); return `<div class="li tap" role="button" tabindex="0" data-act="rhPayGo" data-v="${k}"><span class="ic">${ico("download")}</span><div class="tx"><b>${l}</b><em>${w.length} semaine${w.length > 1 ? "s" : ""}${w.length ? ` · du ${shortDate(w[0])} au ${shortDate(addDays(w[w.length - 1], 6))}` : ""}</em></div>${ico("chev")}</div>`; }).join("")}</div>`);
  },
  rhPayGo: (a, id, v) => { if (!v) return; closeSheet(true); const slug = (S.resto?.name || "resto").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(); saveCsv(`heures-paie-${slug}-${v.slice(0, 7)}.csv`, rhPayCsv(v)); },

  /* employés */
  rhEmp: (a, id) => {
    const p = rhStaff(id); if (!p) return;
    if (!rhCanEdit()) { toast("Seul le gérant peut modifier les fiches.", "info"); return; }
    const { _virtual, ...doc } = p; S.ui.rhE = { ...doc, _new: !!_virtual, _virtual: !!_virtual }; SFX.tap(); openSheet(rhEmpSheet());
  },
  rhEmpNew: () => {
    if (!rhCanEdit()) return; const used = rhPeople().map((p) => p.color);
    S.ui.rhE = { id: null, _new: true, name: "", role: "", post: "cuisine", contract: "CDI", weeklyHours: 35, hourlyGross: "", chargesPct: 42, color: PALETTE.find((c) => !used.includes(c)) || PALETTE[used.length % PALETTE.length], start: dayKey(), active: true };
    SFX.tap(); openSheet(rhEmpSheet());
  },
  rhEPost: (a, id, v) => { rhERead(); S.ui.rhE.post = S.ui.rhE.post === v ? "" : v; SFX.tick(); openSheet(rhEmpSheet()); },
  rhEContract: (a, id, v) => { rhERead(); const F = S.ui.rhE; F.contract = v; if (v === "extra" && rhNum(F.weeklyHours, 35) === 35) F.weeklyHours = 0; if (v === "apprenti" && rhNum(F.chargesPct, 42) === 42) F.chargesPct = 10; SFX.tick(); openSheet(rhEmpSheet()); },
  rhESite: (a, id, v) => { rhERead(); const F = S.ui.rhE; const l = new Set((F.sites || []).filter((r) => r !== S.rid)); l.has(v) ? l.delete(v) : l.add(v); F.sites = [...l]; SFX.tick(); const y = ($("#sheetBody") || {}).scrollTop; openSheet(rhEmpSheet()); const b = $("#sheetBody"); if (b && y) b.scrollTop = y; },
  rhEColor: (a, id, v) => { rhERead(); S.ui.rhE.color = v; SFX.tick(); openSheet(rhEmpSheet()); },
  rhEPinReset: () => rhOnce("rhPinR", async () => { const F = S.ui.rhE; await safe(DB.update("staff", F.id, { pinHash: "" })); F.pinHash = ""; SFX.ok(); toast(`${firstName(F.name)} choisira un nouveau code au prochain pointage`); openSheet(rhEmpSheet()); }),
  rhEArchive: () => rhOnce("rhArch", async () => { rhERead(); const F = S.ui.rhE; const on = F.active === false; await safe(DB.update("staff", F.id, { active: on, end: on ? "" : (F.end || dayKey()) })); closeSheet(true); SFX.ok(); toast(on ? "Employé réactivé" : `${firstName(F.name)} est passé dans les anciens employés`); }),
  rhEmpSave: () => rhOnce("rhEmpSave", async () => {
    rhERead(); const F = S.ui.rhE; const name = (F.name || "").trim(); if (!name) { const i = $("#rhEn"); if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); i.focus(); } SFX.err(); toast("Indiquez le prénom.", "err"); return; }
    const doc = { name, role: (F.role || "").trim(), post: F.post || "", color: F.color, contract: F.contract || "CDI", weeklyHours: rhNum(F.weeklyHours, 35), chargesPct: rhNum(F.chargesPct, 42), start: F.start || "", end: F.end || "", active: F.active !== false, memberId: F.memberId || "" };
    if (rhIsBoss()) doc.hourlyGross = rhNum(F.hourlyGross, null);
    const was = (rhStaff(F.id) || {}).sites || []; const want = (F.sites || []).filter((r) => r !== S.rid && (S.restos || []).some((x) => x.id === r));
    if (want.length || was.length) { doc.sites = want.length ? [S.rid, ...want] : []; if (!F.id) F.id = typeof mrNewId === "function" ? mrNewId() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    if (F.id && !F._new) await safe(DB.update("staff", F.id, doc));
    else if (F.id) await safe(DB.set("staff", F.id, { ...doc, createdAt: Date.now() }));
    else await safe(DB.add("staff", { ...doc, createdAt: Date.now(), by: S.me.id }));
    if ((want.length || was.length) && typeof mrPut === "function") {
      const copy = { ...doc, pinHash: F.pinHash || "", sharedFrom: { rid: S.rid, name: (S.resto && S.resto.name) || "" } };
      for (const rid of want) await mrPut(rid, "staff", F.id, { ...copy, active: doc.active, createdAt: Date.now() }, true).catch(() => toast(`${rhSiteName(rid)} : fiche pas partagée, réessayez.`, "err"));
      for (const rid of was.filter((r) => r !== S.rid && !want.includes(r))) await mrPut(rid, "staff", F.id, { sites: [], active: false, end: dayKey() }, true).catch(() => {});
    }
    const isNew = F._new && !F._virtual; closeSheet(true); SFX.done(); buzz([8, 30, 8]); toast(isNew ? `${firstName(name)} a rejoint l'équipe` : "Fiche enregistrée");
    logEvent("rh", isNew ? `a créé la fiche de ${firstName(name)}` : `a modifié la fiche de ${firstName(name)}`);
  }),
});

/* ───────────── ajout groupé : extras et saisonniers (trouvé par la simulation de 15 restaurants : une crêperie qui embauche 8 saisonniers d'un coup) ───────────── */
const rhBulkNames = (t) => { const seen = new Set(); return String(t || "").split(/[\n;]+|,(?=\s*[A-ZÀ-Ý])/).map((x) => x.replace(/^[\s\-•*\d.)]+/, "").replace(/\s+/g, " ").trim().slice(0, 40)).filter((x) => x.length > 1 && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())); };
function rhBulkSheet() {
  const B = S.ui.rhB; const n = rhBulkNames(B.text); const have = new Set(rhPeople({ all: true }).map((p) => p.name.toLowerCase())); const dup = n.filter((x) => have.has(x.toLowerCase()));
  return `<div class="rh-es rh-bulk">
    <div class="h2">Ajouter plusieurs personnes</div>
    <p class="sub">Un nom par ligne, ou collez la liste reçue par SMS ou e-mail. Chacun a sa fiche, apparaît au planning et pointe avec son code.</p>
    <label class="field"><span>Les noms</span><textarea class="input" id="rhBt" rows="6" placeholder="Léa Martin&#10;Hugo Bernard&#10;Inès Diallo">${esc(B.text)}</textarea></label>
    <p class="note" id="rhBn">${n.length ? `${n.length} personne${n.length > 1 ? "s" : ""}${dup.length ? ` · déjà dans l'équipe : ${esc(dup.slice(0, 3).join(", "))}${dup.length > 3 ? "…" : ""} (ignoré${dup.length > 1 ? "s" : ""})` : ""}` : "Aucun nom pour l'instant."}</p>
    <div class="field"><span>Contrat</span><div class="rh-opts">${[["extra", "Extra"], ["CDD", "Saisonnier (CDD)"]].map(([k, v]) => `<button class="${B.contract === k ? "on" : ""}" data-act="rhBC" data-v="${k}">${v}</button>`).join("")}</div></div>
    <div class="field"><span>Poste habituel au planning</span><div class="rh-posts">${Object.entries(RH_POSTS).map(([k, v]) => `<button class="${B.post === k ? "on" : ""}" style="--pc:${v.c};--pb:${v.bg};--pi:${v.ink}" data-act="rhBP" data-v="${k}"><i></i>${v.t}</button>`).join("")}</div></div>
    <div class="grid2"><label class="field"><span>Poste</span><input class="input" id="rhBr" value="${esc(B.role)}" list="rhRoles" maxlength="40" placeholder="Ex. Serveur"><datalist id="rhRoles">${RH_ROLES.map((r) => `<option value="${esc(r)}">`).join("")}</datalist></label>
      <label class="field"><span>Heures / semaine</span><input class="input mono" id="rhBh" inputmode="decimal" value="${esc(String(B.weeklyHours).replace(".", ","))}"></label></div>
    <div class="grid2"><label class="field"><span>Début</span><input class="input" type="date" id="rhBs" value="${esc(B.start)}"></label><label class="field"><span>${B.contract === "CDD" ? "Fin de saison" : "Fin (facultatif)"}</span><input class="input" type="date" id="rhBe" value="${esc(B.end)}"></label></div>
    ${rhIsBoss() ? `<label class="field"><span>Taux horaire brut (€), le même pour tous</span><input class="input mono" id="rhBw" inputmode="decimal" value="${esc(String(B.hourlyGross || "").replace(".", ","))}" placeholder="Ex. 12,10"></label>` : ""}
    <button class="btn acc block" data-act="rhBulkSave" ${n.length - dup.length > 0 ? "" : "disabled"}>${ico("check")}${n.length - dup.length > 0 ? `Ajouter ${n.length - dup.length} personne${n.length - dup.length > 1 ? "s" : ""}` : "Ajouter"}</button>
  </div>`;
}
function rhBRead() { const B = S.ui.rhB; if (!B) return; const g = (id) => $("#" + id)?.value; B.text = g("rhBt") ?? B.text; B.role = g("rhBr") ?? B.role; B.weeklyHours = g("rhBh") ?? B.weeklyHours; B.start = g("rhBs") ?? B.start; B.end = g("rhBe") ?? B.end; B.hourlyGross = g("rhBw") ?? B.hourlyGross; }
const rhBRedraw = () => { const y = ($("#sheetBody") || {}).scrollTop; openSheet(rhBulkSheet()); const b = $("#sheetBody"); if (b && y) b.scrollTop = y; };
document.addEventListener("input", (e) => { if (e.target && e.target.id === "rhBt" && S.ui.rhB) { rhBRead(); const n = $("#rhBn"), btn = $("[data-act=rhBulkSave]"); if (!n || !btn) return; const tmp = document.createElement("div"); tmp.innerHTML = rhBulkSheet(); n.innerHTML = $("#rhBn", tmp).innerHTML; btn.outerHTML = $("[data-act=rhBulkSave]", tmp).outerHTML; } });
Object.assign(ACT, {
  rhBulk: () => { if (!rhCanEdit()) { toast("Seul le gérant ajoute des fiches.", "info"); return; } SFX.tap(); const t = dayKey(); S.ui.rhB = S.ui.rhB && S.ui.rhB.text ? S.ui.rhB : { text: "", contract: "extra", post: "salle", role: "", weeklyHours: 0, start: t, end: "", hourlyGross: "" }; openSheet(rhBulkSheet()); },
  rhBC: (a, id, v) => { const B = S.ui.rhB; if (!B) return; rhBRead(); B.contract = v; if (v === "CDD" && !rhNum(B.weeklyHours, 0)) B.weeklyHours = 35; if (v === "extra" && rhNum(B.weeklyHours, 0) === 35) B.weeklyHours = 0; SFX.tick(); rhBRedraw(); },
  rhBP: (a, id, v) => { const B = S.ui.rhB; if (!B) return; rhBRead(); B.post = B.post === v ? "" : v; if (!B.role) B.role = { cuisine: "Commis", salle: "Serveur", plonge: "Plongeur", bar: "Barman" }[B.post] || ""; SFX.tick(); rhBRedraw(); },
  rhBulkSave: () => rhOnce("rhBulkSave", async () => {
    rhBRead(); const B = S.ui.rhB; if (!B || !rhCanEdit()) return;
    const have = new Set(rhPeople({ all: true }).map((p) => p.name.toLowerCase())); const names = rhBulkNames(B.text).filter((x) => !have.has(x.toLowerCase()));
    if (!names.length) { toast("Ajoutez au moins un nom.", "err"); return; }
    if (B.end && B.start && B.end < B.start) { toast("La fin est avant le début.", "err"); return; }
    const used = rhPeople().map((p) => p.color); const free = PALETTE.filter((c) => !used.includes(c)); const pal = free.length ? free : PALETTE;
    const role = (B.role || "").trim() || (B.contract === "CDD" ? "Saisonnier" : "Extra");
    let i = 0;
    for (const name of names) {
      const doc = { name, role, post: B.post || "", color: pal[i % pal.length], contract: B.contract === "CDD" ? "CDD" : "extra", weeklyHours: rhNum(B.weeklyHours, 0), chargesPct: 42, start: B.start || "", end: B.end || "", active: true, memberId: "", createdAt: Date.now(), by: S.me.id, bulk: true };
      if (rhIsBoss() && rhNum(B.hourlyGross, 0)) doc.hourlyGross = rhNum(B.hourlyGross, 0);
      await safe(DB.add("staff", doc)); i++;
    }
    S.ui.rhB = null; closeSheet(true); SFX.done(); buzz([8, 30, 8]);
    toast(`${i} personne${i > 1 ? "s" : ""} ajoutée${i > 1 ? "s" : ""} à l'équipe`);
    try { Promise.resolve(logEvent("staff", `a ajouté ${i} ${B.contract === "CDD" ? "saisonnier" : "extra"}${i > 1 ? "s" : ""} : ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}`)).catch(() => {}); } catch (e) {}
    rerender();
  }),
});
