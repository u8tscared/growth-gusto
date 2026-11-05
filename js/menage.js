/* Growth Gusto — area: menage (planning de ménage / plan de nettoyage HACCP)
   Chore doc: { name, zone, moment, freq, days?, wday?, mday?, every?, start?, dates?, required?, who?, notes?, photo?, steps?, createdAt }
     moment: "ouverture" | "midi" | "fermeture"
     freq:   "jour" | "service" (midi + soir) | "jours" (days: getDay() numbers) | "semaine" (wday) | "mois" (mday)
             | "ndays" (every N days from start) | "nweeks" (every N weeks from start's week, on days) | "dates" (dates: day keys) | "once" (dates: [one day key])
     required: false = « Facultatif »: shown and checkable, never late, never counted in compliance / alerts (past ones are state "skip").
   Restaurant settings (restos/{rid}): choreZones: [zone names] (the zone list once the gérant edits it; default MEN_ZONES),
     chorePhotoStaff: bool (default true) = anyone who is not a gérant takes a photo to check any task.
     Legacy docs { name, zone, freq: "jour"|"semaine"|"mois" } keep working: no moment = fermeture,
     no wday / mday = « dans la semaine » / « dans le mois » (due by the end of the period).
   Log doc:   { choreId, at, day, uid, by?, slot? ("midi"|"soir", only for « après chaque service »), photoUrl?, photoId?, evId? } */

Object.assign(IC, {
  menSun: ["M12 2v8", "m4.93 10.93 1.41 1.41", "M2 18h2", "M20 18h2", "m19.07 10.93-1.41 1.41", "M22 22H2", "m8 6 4-4 4 4", "M16 18a4 4 0 0 0-8 0"],
  menMeal: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"],
  menMoon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z", "f:M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  menCal: ["M8 2v4", "M16 2v4", "r:3,4,18,18,2", "M3 10h18", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01"],
  menHist: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M12 7v5l4 2"],
  menUser: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "c:12,7,4"],
  menDrop: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"],
  menUndo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  menPin: ["M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0", "c:12,10,3"],
  menRepeat: ["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"],
});

const MEN_ZONES = ["Cuisine", "Plonge", "Chambre froide", "Salle", "Sanitaires", "Bar"];
const MEN_MOMENTS = {
  ouverture: { t: "Ouverture", s: "ouverture", hint: "Avant le service", ic: "menSun", due: 12 },
  midi: { t: "Après le service du midi", s: "après le midi", hint: "Dès la fin du midi", ic: "menMeal", due: 17 },
  fermeture: { t: "Fermeture", s: "fermeture", hint: "Avant de partir", ic: "menMoon", due: 24 },
};
const MEN_FREQS = [["jour", "Chaque jour"], ["service", "Après chaque service"], ["jours", "Jours de la semaine"], ["ndays", "Tous les N jours"], ["semaine", "Chaque semaine"], ["nweeks", "Toutes les N semaines"], ["mois", "Chaque mois"], ["dates", "Dates précises"], ["once", "Une seule fois"]];
const MEN_FREQ_KEYS = MEN_FREQS.map((f) => f[0]);
const MEN_MOS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const menIsKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const menDiff = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5); // whole days from a to b
const MEN_DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]; // display order, Monday first
const menDowJs = (i) => (i + 1) % 7; // display index -> getDay()
const menDow = (k) => parseDay(k).getDay();
const menWeekStart = (k) => addDays(k, -((menDow(k) + 6) % 7));
const menMonthEnd = (k) => { const d = parseDay(k); return dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const menDim = (k) => +menMonthEnd(k).slice(8);
const M = { busy: {}, tab: "jour", wk: 0, sel: null, mo: 0, msel: null, open: {}, just: null, justAt: 0, ring: 0, logs: null, logsRid: null, names: [] };
// the old free-text signer override (gg-men-signer) signed logs with someone else's name: dropped, the signer is always S.me
try { localStorage.removeItem("gg-men-signer"); M.names = JSON.parse(localStorage.getItem("gg-men-names") || "[]"); } catch (e) {}
const menSaveNames = () => { try { localStorage.setItem("gg-men-names", JSON.stringify(M.names)); } catch (e) {} };

/* ── data ── */
function menWatch() { // full log history (the core keeps only the last 400), for history + monthly compliance
  if (!S.rid || M.logsRid === S.rid) return; M.logsRid = S.rid; M.logs = null;
  const rid = S.rid; DB.watch("choreLogs", { order: "at", dir: "desc", limit: 5000 }, (rows) => { if (S.rid !== rid) return; M.logs = rows; onData(); });
}
const menLogs = () => (M.logs && M.logsRid === S.rid ? M.logs : S.choreLogs);
let menIdx = { src: null, n: -1, map: new Map() };
function menLogsOf(cid) { // logs of one chore, oldest first (cached per log snapshot)
  const L = menLogs(); if (menIdx.src !== L || menIdx.n !== L.length) { const m = new Map(); for (let i = L.length - 1; i >= 0; i--) { const l = L[i]; if (!m.has(l.choreId)) m.set(l.choreId, []); m.get(l.choreId).push(l); } menIdx = { src: L, n: L.length, map: m }; }
  return menIdx.map.get(cid) || [];
}
/* HACCP: a check is signed by the person switched in (« Qui êtes-vous ? »), so a log's `by` and `uid` always name the same person.
   Read at the moment of the check, never cached: a user switch changes the signer at once. */
const menSigner = () => (S.me && S.me.name) || "";
function menNames() {
  const set = new Set(); const add = (n) => { n = (n || "").trim(); if (n) set.add(n); };
  add(S.me.name); S.members.forEach((m) => add(m.name || S.profiles[m.id]?.name)); M.names.forEach(add); S.chores.forEach((c) => add(c.who)); menLogs().slice(0, 300).forEach((l) => add(l.by));
  return [...set];
}
const menBy = (l) => firstName(l.by || nameOf(l.uid)) || "Quelqu'un";
function menNorm(c) { // compatibility with legacy chore docs
  const freq = MEN_FREQ_KEYS.includes(c.freq) ? c.freq : "jour";
  const dates = Array.isArray(c.dates) ? [...new Set(c.dates.filter(menIsKey))].sort() : [];
  return { ...c, name: c.name || "", freq, moment: MEN_MOMENTS[c.moment] ? c.moment : "fermeture", days: Array.isArray(c.days) ? c.days.map(Number) : [], wday: c.wday ?? null, mday: c.mday ?? null,
    every: Math.max(1, Math.min(365, Math.round(+c.every) || 1)), start: menIsKey(c.start) ? c.start : null, dates: freq === "once" ? dates.slice(0, 1) : dates, required: c.required !== false };
}
const MEN_MO = Object.keys(MEN_MOMENTS);
/* zones: the restaurant's own list (resto.choreZones, once edited) else the presets, plus any zone a task still uses */
function menZoneList() {
  const base = Array.isArray(S.resto && S.resto.choreZones) ? S.resto.choreZones : MEN_ZONES;
  return [...new Set([...base, ...S.chores.map((c) => c.zone)].map((z) => String(z || "").trim()).filter(Boolean))];
}
const menZi = (z, L = menZoneList()) => { const i = L.indexOf(z); return i < 0 ? 99 : i; };
const menChores = () => { const ZL = menZoneList(); return S.chores.map(menNorm).sort((a, b) => MEN_MO.indexOf(a.moment) - MEN_MO.indexOf(b.moment) || menZi(a.zone, ZL) - menZi(b.zone, ZL) || (a.createdAt || 0) - (b.createdAt || 0) || a.name.localeCompare(b.name, "fr")); };
const menStart = (c) => (c.createdAt ? dayKey(new Date(c.createdAt)) : "2000-01-01");

/* occurrences of a chore due on day k */
function menOccOn(c, k) {
  if (k < menStart(c)) return [];
  const one = (o = {}) => [{ c, day: k, slot: "", moment: c.moment, ...o }];
  switch (c.freq) {
    case "service": return [{ c, day: k, slot: "midi", moment: "midi" }, { c, day: k, slot: "soir", moment: "fermeture" }];
    case "jours": return c.days.includes(menDow(k)) ? one() : [];
    case "semaine": return c.wday == null ? (menDow(k) === 0 ? one({ flex: true }) : []) : menDow(k) === +c.wday ? one() : [];
    case "mois": return c.mday == null ? (k === menMonthEnd(k) ? one({ flex: true }) : []) : +k.slice(8) === Math.min(+c.mday, menDim(k)) ? one() : [];
    case "ndays": { const s = c.start || menStart(c); return k >= s && menDiff(s, k) % c.every === 0 ? one() : []; }
    case "nweeks": { const s = c.start || menStart(c); if (k < s || !c.days.includes(menDow(k))) return []; return (menDiff(menWeekStart(s), menWeekStart(k)) / 7) % c.every === 0 ? one() : []; }
    case "dates": case "once": return c.dates.includes(k) ? one() : [];
    default: return one();
  }
}
function menPeriod(o) {
  if (o.c.freq === "semaine") { const s = menWeekStart(o.day); return [s, addDays(s, 6)]; }
  if (o.c.freq === "mois") return [o.day.slice(0, 8) + "01", menMonthEnd(o.day)];
  return [o.day, o.day];
}
const menKey = (o) => `${o.c.id}|${o.day}|${o.slot}`;
function menLogFor(o) { // first completion of the occurrence's period
  const [a, b] = menPeriod(o); const per = a !== b;
  const L = menLogsOf(o.c.id);
  if (o.slot) { // « après chaque service »: a log without slot (home's quick check, legacy) fills the first open service of that day
    const day = L.filter((l) => l.day === o.day); const hit = day.find((l) => l.slot === o.slot); if (hit) return hit;
    const free = day.filter((l) => !l.slot || !MEN_SLOTS.includes(l.slot)); const open = MEN_SLOTS.filter((s) => !day.some((l) => l.slot === s));
    return free[open.indexOf(o.slot)] || null;
  }
  for (const l of L) if (per ? l.day >= a && l.day <= b : l.day === o.day) return l;
  return null;
}
const MEN_SLOTS = ["midi", "soir"];
/* state: done | late | todo | overdue | missed | upcoming | skip (an optional task not done, its period over) */
function menState(o, today = dayKey(), hour = new Date().getHours()) {
  const st = menState0(o, today, hour);
  if (o.c.required !== false) return st;
  return (o.st = st === "overdue" ? "todo" : st === "missed" ? "skip" : st); // « facultatif »: never late, never missed
}
const menReq = (o) => o.c.required !== false;
function menState0(o, today, hour) {
  const l = menLogFor(o); o.log = l;
  if (l) return (o.st = l.day > o.day ? "late" : "done");
  if (o.day > today) return (o.st = "upcoming");
  if (o.day === today) { const due = MEN_MOMENTS[o.moment]?.due || 24; const born = o.c.createdAt && o.day === menStart(o.c) ? new Date(o.c.createdAt).getHours() : -1; return (o.st = hour >= due && born < due ? "overdue" : "todo"); } // a task added after its hour is not « en retard » on its first day
  return (o.st = menPeriod(o)[1] < today ? "missed" : "overdue");
}
const menIsDone = (o) => o.st === "done" || o.st === "late";
function menDay(k) { const out = []; menChores().forEach((c) => menOccOn(c, k).forEach((o) => { menState(o); out.push(o); })); return out; }

/* Today: moment groups + this week's weekly / monthly items */
function menToday() {
  const t = dayKey(); const ws = menWeekStart(t); const groups = { ouverture: [], midi: [], fermeture: [] }; const week = [];
  menDay(t).forEach((o) => (o.flex ? week : groups[o.moment]).push(o));
  const seen = new Set(week.map(menKey));
  menChores().filter((c) => c.freq === "semaine" || c.freq === "mois").forEach((c) => {
    const cand = []; for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k !== t) cand.push(...menOccOn(c, k)); }
    if (c.freq === "mois") { for (let k = t.slice(0, 8) + "01"; k < ws; k = addDays(k, 1)) cand.push(...menOccOn(c, k)); if (c.mday == null) cand.push(...menOccOn(c, menMonthEnd(t))); }
    cand.forEach((o) => {
      if (seen.has(menKey(o))) return; menState(o);
      if (o.flex && o.st === "upcoming") o.st = "todo"; // « dans la semaine / le mois » : open until the end of the period
      if (o.st === "missed" || o.st === "skip" || (o.day < ws && o.st !== "overdue" && !(o.st === "todo" && !menReq(o)))) return;
      seen.add(menKey(o)); week.push(o);
    });
  });
  const rank = { overdue: 0, todo: 1, upcoming: 2, missed: 3, skip: 3, late: 4, done: 4 };
  week.sort((a, b) => rank[a.st] - rank[b.st] || (a.day < b.day ? -1 : 1));
  return { groups, week };
}
/* Single source of truth for « today's cleaning »: exactly what the Today tab lists (today's moments + this week's / month's
   items that are open or already done this period; items only planned later in the week are not counted yet).
   Optional tasks (« facultatif ») are left out of every count.
   Global used by home and the report: menDayStats() -> { done, total, late, pct } */
function menDayStats() {
  const { groups, week } = menToday(); const L = [...groups.ouverture, ...groups.midi, ...groups.fermeture, ...week].filter((o) => menReq(o) && o.st !== "upcoming" && o.st !== "missed");
  const done = L.filter(menIsDone).length; const late = L.filter((o) => o.st === "overdue").length;
  return { done, total: L.length, late, pct: L.length ? Math.round((done / L.length) * 100) : null };
}
function menDueToday() { const { groups, week } = menToday(); const set = new Set(); [...groups.ouverture, ...groups.midi, ...groups.fermeture, ...week].forEach((o) => { if (menReq(o) && (o.st === "todo" || o.st === "overdue")) set.add(o.c.id); }); return S.chores.filter((c) => set.has(c.id)); }
// Global used by home's « À traiter »: array of chore docs still due now (today's + this week's open ones; optional tasks never nag).
function choresDue() { return menDueToday(); }

/* compliance over [a, b] (b capped at today; today's still-open tasks are not counted yet; optional tasks never count) */
function menCompliance(a, b, filter) {
  const t = dayKey(); if (b > t) b = t; let done = 0, tot = 0, late = 0; const missed = []; const cs = menChores().filter((c) => c.required && (!filter || filter(c)));
  for (let k = a; k <= b; k = addDays(k, 1)) cs.forEach((c) => menOccOn(c, k).forEach((o) => {
    const st = menState(o); if (st === "done" || st === "late") { done++; tot++; if (st === "late") late++; } else if (st === "missed" || (st === "overdue" && k < t)) { tot++; missed.push(o); }
  }));
  return { done, tot, late, missed, pct: tot ? Math.round((done / tot) * 100) : null };
}

/* ── formatting ── */
const menLongDay = (k) => { const d = parseDay(k); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const menCap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
function menFreqTx(c) {
  c = menNorm(c);
  if (c.freq === "service") return "Après chaque service";
  if (c.freq === "jours") return c.days.length ? MEN_DOW.filter((_, i) => c.days.includes(menDowJs(i))).join(", ") : "Aucun jour choisi";
  if (c.freq === "semaine") return c.wday == null ? "Chaque semaine" : `Chaque ${DAYS[c.wday]}`;
  if (c.freq === "mois") return c.mday == null ? "Chaque mois" : c.mday == 1 ? "Le 1er du mois" : `Le ${c.mday} du mois`;
  const from = c.start && c.start > dayKey() ? `, dès le ${menDateTx(c.start)}` : "";
  if (c.freq === "ndays") return `${c.every > 1 ? `Tous les ${c.every} jours` : "Chaque jour"}${from}`;
  if (c.freq === "nweeks") { const dd = MEN_DOW.filter((_, i) => c.days.includes(menDowJs(i))).map((d) => d.toLowerCase()); return `${c.every > 1 ? `Toutes les ${c.every} semaines` : "Chaque semaine"}${dd.length ? `, ${dd.length > 1 ? dd.slice(0, -1).join(", ") + " et " + dd[dd.length - 1] : dd[0]}` : ""}${from}`; }
  if (c.freq === "once") return c.dates.length ? `Une fois, le ${menDateTx(c.dates[0])}` : "Date à choisir";
  if (c.freq === "dates") { if (!c.dates.length) return "Aucune date choisie"; const t = dayKey(); const next = c.dates.filter((k) => k >= t); const L = (next.length ? next : c.dates.slice(-3)); return L.slice(0, 3).map(menDateTx).join(", ") + (L.length > 3 ? ` +${L.length - 3}` : ""); }
  return "Chaque jour";
}
/* « 12 nov », with the year when it is not this year's */
const menDateTx = (k) => { const d = parseDay(k); return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MEN_MOS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`; };
const menMomentTx = (c) => (c.freq === "service" ? "midi et soir" : MEN_MOMENTS[c.moment].s);
const menSlotTx = (s) => (s === "midi" ? "Midi" : s === "soir" ? "Soir" : "");
const menCheckSvg = `<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>`;
function menMark(st, sm) {
  const c = `men-mk ${st}${sm ? " sm" : ""}`;
  if (st === "done" || st === "late") return `<span class="${c}">${menCheckSvg}</span>`;
  if (st === "missed") return `<span class="${c}">${ico("x")}</span>`;
  if (st === "overdue") return `<span class="${c}"><b>!</b></span>`;
  return `<span class="${c}"></span>`;
}
function menRing(pct, size, sw, id) {
  const r = 50 - sw / 2 - 1, L = 2 * Math.PI * r;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="men-ring"><circle cx="50" cy="50" r="${r}" fill="none" stroke-width="${sw}" class="tr"/><circle ${id ? `id="${id}" data-to="${pct || 0}"` : ""} cx="50" cy="50" r="${r}" fill="none" stroke-width="${sw}" stroke-linecap="round" class="br" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${(L * (1 - (pct || 0) / 100)).toFixed(1)}" data-l="${L.toFixed(1)}"/></svg>`;
}
const menPctCls = (p) => (p == null ? "neu" : p >= 90 ? "ok" : p >= 70 ? "warn" : "bad");
const menWhenTx = (o) => (o.flex ? (o.c.freq === "mois" ? "dans le mois" : "dans la semaine") : o.day === dayKey() ? "aujourd'hui" : `${o.day < dayKey() ? "prévu " : ""}${DAYS[menDow(o.day)]} ${+o.day.slice(8)}`);

/* ── view ── */
VIEWS.menage = {
  render() {
    menWatch();
    const tabs = [["jour", "Aujourd'hui"], ["semaine", "Semaine"], ["mois", "Mois"], ["plan", "Plan"]]; const ti = Math.max(0, tabs.findIndex((t) => t[0] === M.tab));
    const head = `${topBar("Planning ménage", { right: S.chores.length ? `<button class="btn soft sm" data-act="menEdit">${ico("plus")}Tâche</button>` : "" })}
      ${S.chores.length ? `<div class="seg men-tabs st" style="--i:1" role="tablist"><span class="knob" style="width:calc(25% - 2px);transform:translateX(${ti * 100}%)"></span>${tabs.map(([k, t]) => `<button class="${M.tab === k ? "on" : ""}" role="tab" aria-selected="${M.tab === k}" data-act="menTab" data-v="${k}">${t}</button>`).join("")}</div>` : ""}`;
    if (!S.chores.length) return `<div class="inner narrow men">${head}${menEmpty()}</div>`;
    const body = M.tab === "semaine" ? menWeekView() : M.tab === "mois" ? menMonthView() : M.tab === "plan" ? menPlanView() : menTodayView();
    return `<div class="inner wide men men-t-${M.tab}">${head}${body}</div>`;
  },
  after(v) {
    const r = $("#menRingBar", v);
    if (r) { const L = +r.dataset.l, to = +r.dataset.to, from = M.ring; r.style.transition = "none"; r.style.strokeDashoffset = (L * (1 - from / 100)).toFixed(1); void r.getBoundingClientRect(); requestAnimationFrame(() => { r.style.transition = ""; r.style.strokeDashoffset = (L * (1 - to / 100)).toFixed(1); }); menCount($("#menRingPct", v), from, to); M.ring = to; }
    if (!v.classList.contains("nost")) $$(".men-cring .br, .men-cr .br", v).forEach((b) => { const to = b.getAttribute("stroke-dashoffset"); b.style.transition = "none"; b.style.strokeDashoffset = b.dataset.l; void b.getBoundingClientRect(); requestAnimationFrame(() => { b.style.transition = ""; b.style.strokeDashoffset = to; }); });
    const strip = $(".men-strip", v), on = strip && $(".on", strip); if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
    if (Date.now() - M.justAt > 1400) M.just = null;
  },
};
TAB_OF.menage = "more";

function menCount(el, from, to) {
  if (!el) return; if (from === to) { el.textContent = to; return; }
  const t0 = performance.now(), d = 800; const f = (t) => { const p = Math.min(1, (t - t0) / d); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f);
}

function menEmpty() {
  return `<div class="glass men-hello st" style="--i:1">
    <div class="men-hello-ic">${ico("spray")}</div>
    <b class="h2">Votre plan de nettoyage en&nbsp;un&nbsp;geste</b>
    <p class="sub">${MEN_STARTER.length} tâches HACCP pour un petit restaurant : ouverture, après le midi, fermeture, chaque semaine et chaque mois. Tout reste modifiable.</p>
    <div class="men-hello-z">${MEN_ZONES.map((z) => `<span class="pill neu">${z}</span>`).join("")}</div>
    <button class="btn acc block" data-act="menStarter">${ico("sparkle")}Charger le plan type HACCP</button>
    <button class="btn ghost block" data-act="menEdit">Créer ma propre tâche</button></div>`;
}

/* today */
function menTodayView() {
  const { groups, week } = menToday(); const all = [...groups.ouverture, ...groups.midi, ...groups.fermeture];
  const ds = menDayStats(); const ok = ds.done, tot = ds.total; const pct = ds.pct ?? 100; const late = ds.late; const left = tot - ok;
  const h = new Date().getHours(); const cur = h < 11 ? "ouverture" : h < 17 ? "midi" : "fermeture";
  // what the hero names: the moment we are in if it still has work, else « en retard » when earlier moments slipped
  const curOpen = groups[cur].some((o) => !menIsDone(o)); const nextG = MEN_MO.find((g) => groups[g].some((o) => !menIsDone(o)));
  const hWhen = !left ? "" : curOpen ? ` · maintenant : ${MEN_MOMENTS[cur].s}` : late ? " · en retard" : nextG && MEN_MO.indexOf(nextG) > MEN_MO.indexOf(cur) ? ` · prochain : ${MEN_MOMENTS[nextG].s}` : week.some((o) => !menIsDone(o) && o.st !== "upcoming") ? " · cette semaine" : "";
  const signer = menSigner();
  const hero = `<div class="hero men-hero st" style="--i:2"><div class="in">
      <div class="ring">${menRing(pct, 108, 9, "menRingBar")}<div class="num"><div><b id="menRingPct">${M.ring}</b><b style="font-size:16px">%</b><small>${ok} / ${tot}</small></div></div></div>
      <div class="meta"><b>${menCap(menLongDay(dayKey()))}</b><span>${!tot ? "Rien de prévu aujourd'hui" : left ? `${left} tâche${left > 1 ? "s" : ""} à faire${hWhen}` : "Ménage du jour terminé"}</span>
      <div class="men-hx">${late ? `<span class="nx men-late">${ico("alert")}${late} en retard</span>` : ""}<button class="nx men-signer" data-act="menSigner" aria-label="Changer d'utilisateur : les tâches cochées sont signées par la personne connectée">${ico("menUser")}${signer ? `Signé ${esc(firstName(signer))}` : "Qui signe ?"}${ico("down")}</button></div></div>
    </div></div>`;
  let i = 3;
  const sec = (g, title, hint, icn, L, showDay) => {
    if (!L.length) return ""; const R = L.some(menReq) ? L.filter(menReq) : L; const d = R.filter(menIsDone).length; const full = d === R.length; const open = M.open[g] ?? !full; const isCur = g === cur && !full;
    return `<section class="glass men-g ${full ? "full" : ""} ${isCur ? "cur" : ""} st" style="--i:${i++}">
      <button class="men-gh" data-act="menGroup" data-v="${g}" aria-expanded="${open}"><span class="ic ${full ? "ok" : ""}">${ico(icn)}</span><span class="men-gt"><b>${title}</b><em>${full ? "Tout est fait" : (isCur ? "Maintenant · " : "") + hint}</em></span><span class="men-gc mono">${d}/${R.length}</span>${ico("down", "men-chev" + (open ? " on" : ""))}</button>
      <div class="men-rows ${open ? "" : "shut"}"><div>${L.map((o) => menRow(o, showDay)).join("")}</div></div></section>`;
  };
  const wk = sec("week", "À faire cette semaine", "Tâches hebdomadaires et mensuelles", "menCal", week, true);
  const groupsHtml = MEN_MO.map((g) => sec(g, MEN_MOMENTS[g].t, MEN_MOMENTS[g].hint, MEN_MOMENTS[g].ic, groups[g])).join("");
  const nothing = !all.length && !week.length ? `<div class="glass empty st" style="--i:3"><div class="ic ok">${ico("check")}</div><b>Rien de prévu aujourd'hui</b>Les tâches apparaissent ici les jours où elles sont dues.</div>` : "";
  const wkLate = week.some((o) => o.st === "overdue");
  return `<div class="men-today"><div class="men-side">${hero}<div class="men-wk-d">${wk}</div></div><div class="men-main">${wkLate ? `<div class="men-wk-m">${wk}</div>` : ""}${groupsHtml}${wkLate ? "" : `<div class="men-wk-m">${wk}</div>`}${nothing}</div></div>`;
}
function menRow(o, showDay) {
  const c = o.c, l = o.log, k = menKey(o), dn = menIsDone(o); const just = M.just === k && Date.now() - M.justAt < 1400;
  const canDo = !dn && o.st !== "missed" && o.st !== "skip" && (o.st !== "upcoming" || showDay);
  const sub = dn ? `<span class="men-who">${esc(menBy(l))} · ${when(l.at)}${o.st === "late" ? " · en retard" : ""}</span>` : [showDay ? menWhenTx(o) : "", c.zone, c.notes].filter(Boolean).map(esc).join(" · ");
  const per = !showDay && (c.freq === "semaine" || c.freq === "mois") ? `<span class="men-tag">${c.freq === "mois" ? "Mensuel" : "Hebdo"}</span>` : "";
  const tags = `${per}${!menReq(o) ? `<span class="men-tag opt">Facultatif</span>` : ""}${o.slot ? `<span class="men-tag">${menSlotTx(o.slot)}</span>` : ""}${c.who && !dn ? `<span class="men-tag who">${esc(firstName(c.who))}</span>` : ""}${menNeedPhoto(c) && !dn ? `<span class="men-tag ph" title="Photo obligatoire">${ico("camera")}</span>` : ""}${o.st === "overdue" ? `<span class="pill bad"><span class="dot"></span>En retard</span>` : ""}`;
  const gd = !dn ? `<button class="men-ph gd" data-act="menGuide" data-id="${c.id}" aria-label="Comment faire : ${esc(c.name)}">${ico("book")}</button>` : "";
  const right = dn ? (menHasPic(l) ? `<button class="men-ph" data-act="menLog" data-id="${l.id}" aria-label="Voir la photo">${menImg(l)}</button>` : `<button class="men-ph add" data-act="menPhotoAdd" data-id="${l.id}" aria-label="Ajouter une photo de preuve">${ico("camera")}</button>`) : "";
  const act = canDo ? `data-act="menDo" data-v="${k}" aria-label="Marquer « ${esc(c.name)} » comme fait"` : dn ? `data-act="menLog" data-id="${l.id}" aria-label="Détails de « ${esc(c.name)} »"` : `data-act="menHist" data-id="${c.id}"`;
  return `<div class="men-row ${o.st} ${just ? "just" : ""}" ${act} role="button" tabindex="0">
    ${menMark(o.st)}<div class="tx"><b>${esc(c.name)}</b><em>${sub}</em></div><span class="men-tags">${tags}</span>${gd}${right}${just ? `<span class="men-fx" aria-hidden="true">${"<i></i>".repeat(8)}</span>` : ""}</div>`;
}

/* week */
function menWeekView() {
  const t = dayKey(); const ws = addDays(menWeekStart(t), M.wk * 7); const days = [...Array(7)].map((_, i) => addDays(ws, i));
  if (!M.sel || M.sel < ws || M.sel > days[6]) M.sel = M.wk === 0 ? t : ws;
  const per = days.map(menDayInfo);
  const comp = menCompliance(ws, days[6]); const sofar = per.filter((p) => p.k <= t).reduce((x, p) => ({ d: x.d + p.d, n: x.n + p.n }), { d: 0, n: 0 }); const s0 = parseDay(ws), e = parseDay(days[6]);
  const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]; const mo = (d) => MO[d.getMonth()];
  const title = M.wk === 0 ? "Cette semaine" : M.wk === -1 ? "Semaine dernière" : M.wk === 1 ? "Semaine prochaine" : `Semaine du ${shortDate(ws)}`;
  const nav = `<div class="glass men-wnav st" style="--i:2"><button class="iconbtn" data-act="menWk" data-v="-1" aria-label="Semaine précédente">${ico("back")}</button>
    <div class="men-wt"><b>${title}</b><em>${s0.getMonth() === e.getMonth() ? `${s0.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]}` : `${s0.getDate()} ${mo(s0)} – ${e.getDate()} ${mo(e)}`}</em></div>
    <div class="men-wstat">${sofar.n ? `<span class="pill ${sofar.d === sofar.n ? "ok" : M.wk < 0 ? menPctCls(Math.round((sofar.d / sofar.n) * 100)) : "neu"}">${sofar.d}/${sofar.n} fait</span>` : ""}${comp.missed.length ? `<span class="pill bad">${comp.missed.length} oubli${comp.missed.length > 1 ? "s" : ""}</span>` : ""}</div>
    <button class="iconbtn" data-act="menWk" data-v="1" aria-label="Semaine suivante">${ico("chev")}</button></div>`;
  // phone: day strip + the selected day
  const strip = `<div class="men-strip st" style="--i:3">${per.map((p, i) => `<button class="men-day ${p.k === M.sel ? "on" : ""} ${p.k === t ? "today" : ""} ${p.k > t ? "fut" : ""}" data-act="menSel" data-v="${p.k}" aria-pressed="${p.k === M.sel}"><span>${MEN_DOW[i]}</span><b>${+p.k.slice(8)}</b><span class="men-cr ${p.miss ? "bad" : p.n && p.d === p.n ? "ok" : ""}">${menRing(p.pct ?? 0, 30, 14)}</span><i class="${p.miss ? "bad" : p.n && p.d === p.n ? "ok" : ""}">${p.n ? (p.miss ? `${p.miss} oubli${p.miss > 1 ? "s" : ""}` : `${p.d}/${p.n}`) : "–"}</i></button>`).join("")}</div>`;
  const sp = per.find((p) => p.k === M.sel) || per[0];
  const list = menDayCard(sp, 4);
  // desktop: the classic plan-de-nettoyage grid
  const rows = menChores().filter((c) => days.some((k) => menOccOn(c, k).length));
  const mx = `<div class="glass men-mx st" style="--i:3"><table><thead><tr><th class="tn"><span class="lbl">Tâche</span></th>${per.map((p, i) => `<th class="${p.k === t ? "today" : ""}"><span>${MEN_DOW[i]}</span><b>${+p.k.slice(8)}</b><i class="men-bar"><i class="${p.k < t ? menPctCls(p.pct) : p.n && p.d === p.n ? "ok" : "acc"}" style="width:${p.pct ?? 0}%"></i></i></th>`).join("")}</tr></thead><tbody>
    ${MEN_MO.map((g) => { const R = rows.filter((c) => (c.freq === "service" ? g === "midi" : c.moment === g)); return R.length ? `<tr class="men-mh"><td colspan="8"><span>${ico(MEN_MOMENTS[g].ic)}${g === "midi" ? "Après le service" : MEN_MOMENTS[g].t}</span></td></tr>` + R.map((c) => `<tr><td class="tn"><button data-act="menHist" data-id="${c.id}" title="${esc(c.name)}"><b>${esc(c.name)}</b><em>${esc([c.zone, menFreqTx(c)].filter(Boolean).join(" · "))}</em></button></td>${per.map((p) => { const os = p.occ.filter((o) => o.c.id === c.id); return `<td class="${p.k === t ? "today" : ""}">${os.length ? `<span class="men-cell">${os.map((o) => `<button data-act="${o.log ? "menLog" : o.day === t && !menIsDone(o) ? "menDo" : "menHist"}" ${o.day === t && !o.log ? `data-v="${menKey(o)}"` : ""} data-id="${o.log ? o.log.id : c.id}" title="${esc(menCellTitle(o))}" aria-label="${esc(menCellTitle(o))}">${menMark(o.st, true)}</button>`).join("")}</span>` : `<span class="men-nil"></span>`}</td>`; }).join("")}</tr>`).join("") : ""; }).join("")}
    </tbody></table><div class="men-leg">${[["done", "Fait"], ["late", "Fait en retard"], ["overdue", "En retard"], ["missed", "Oublié"], ["todo", "À faire"], ["upcoming", "Prévu"]].map(([s, tx]) => `<span>${menMark(s, true)}${tx}</span>`).join("")}</div></div>`;
  return `${nav}<div class="men-wphone">${strip}${list}</div><div class="men-wdesk">${mx}</div>`;
}
/* one day's numbers (required tasks only) and its occurrences */
function menDayInfo(k) {
  const t = dayKey(); const occ = menDay(k); const R = occ.filter(menReq); const d = R.filter(menIsDone).length; const miss = R.filter((o) => o.st === "missed" || (o.st === "overdue" && k < t)).length;
  return { k, occ, d, miss, n: R.length, pct: R.length ? Math.round((d / R.length) * 100) : null };
}
/* the selected day's card (week + month tabs): today's rows can be checked, other days open the log or the history */
function menDayCard(sp, i) {
  const t = dayKey(); const byM = { ouverture: [], midi: [], fermeture: [] }; sp.occ.forEach((o) => byM[o.moment].push(o));
  const roRow = (o) => `<div class="men-row ${o.st} ro" data-act="${o.log ? "menLog" : "menHist"}" data-id="${o.log ? o.log.id : o.c.id}" role="button" tabindex="0">${menMark(o.st)}<div class="tx"><b>${esc(o.c.name)}</b><em>${o.log ? `${esc(menBy(o.log))} · ${when(o.log.at)}${o.st === "late" ? " · en retard" : ""}` : o.st === "missed" ? "Non fait" : o.st === "skip" ? "Facultatif · non fait" : o.st === "overdue" ? "En retard, encore à faire" : esc([o.c.zone, menFreqTx(o.c)].filter(Boolean).join(" · "))}</em></div><span class="men-tags">${!menReq(o) ? `<span class="men-tag opt">Facultatif</span>` : ""}${o.slot ? `<span class="men-tag">${menSlotTx(o.slot)}</span>` : ""}</span></div>`;
  return `<div class="glass pad men-dl st" style="--i:${i}"><div class="row"><span class="lbl">${menCap(menLongDay(sp.k))}</span>${sp.n ? `<span class="pill ${sp.miss ? "bad" : sp.d === sp.n ? "ok" : "neu"}">${sp.miss ? `${sp.miss} oubli${sp.miss > 1 ? "s" : ""}` : `${sp.d}/${sp.n} fait`}</span>` : ""}</div>
    ${sp.occ.length ? MEN_MO.filter((g) => byM[g].length).map((g) => `<div class="men-dlg"><span class="men-dlh">${ico(MEN_MOMENTS[g].ic)}${MEN_MOMENTS[g].t}</span>${byM[g].map((o) => (sp.k === t ? menRow(o) : roRow(o))).join("")}</div>`).join("") : `<div class="empty" style="padding:18px 0 6px">Rien de prévu ce jour-là.</div>`}</div>`;
}

/* month: a calendar of the plan. Each day shows how many tasks are due and a dot per task that is not a daily one
   (weekly, monthly, every N days, dates…); past days are tinted by the result. Tap a day to see its tasks. */
function menMonthView() {
  const t = dayKey(); const base = parseDay(t); const m0 = new Date(base.getFullYear(), base.getMonth() + M.mo, 1); const ms = dayKey(m0); const me = menMonthEnd(ms);
  if (!M.msel || M.msel < ms || M.msel > me) M.msel = M.mo === 0 ? t : ms;
  const lead = (m0.getDay() + 6) % 7; const cells = [];
  for (let k = ms; k <= me; k = addDays(k, 1)) {
    const p = menDayInfo(k); const special = p.occ.filter((o) => o.c.freq !== "jour" && o.c.freq !== "service");
    const tone = k < t || (k === t && p.n && p.d === p.n) ? (p.miss ? "bad" : p.n && p.d === p.n ? "ok" : p.n ? "warn" : "") : "";
    cells.push(`<button class="men-mc ${k === t ? "today" : ""} ${k === M.msel ? "on" : ""} ${k > t ? "fut" : ""} ${tone}" data-act="menMsel" data-v="${k}" aria-pressed="${k === M.msel}" aria-label="${esc(menLongDay(k))} : ${p.occ.length} tâche${p.occ.length > 1 ? "s" : ""}"><b>${+k.slice(8)}</b><em>${p.occ.length || ""}</em><span class="men-mcd">${special.slice(0, 4).map((o) => `<i class="${o.st} ${menReq(o) ? "" : "opt"}"></i>`).join("")}</span></button>`);
  }
  const mc = menCompliance(ms, me);
  const nav = `<div class="glass men-wnav st" style="--i:2"><button class="iconbtn" data-act="menMo" data-v="-1" aria-label="Mois précédent">${ico("back")}</button>
    <div class="men-wt"><b>${menCap(MONTHS[m0.getMonth()])} ${m0.getFullYear()}</b><em>${M.mo === 0 ? "Ce mois-ci" : M.mo === 1 ? "Mois prochain" : M.mo === -1 ? "Mois dernier" : "Plan du mois"}</em></div>
    <div class="men-wstat">${mc.tot ? `<span class="pill ${menPctCls(mc.pct)}">${mc.pct} % fait</span>` : ""}${mc.missed.length ? `<span class="pill bad">${mc.missed.length} oubli${mc.missed.length > 1 ? "s" : ""}</span>` : ""}</div>
    <button class="iconbtn" data-act="menMo" data-v="1" aria-label="Mois suivant">${ico("chev")}</button></div>`;
  const grid = `<div class="glass pad men-month st" style="--i:3"><div class="men-mgh">${MEN_DOW.map((d) => `<span>${d}</span>`).join("")}</div><div class="men-mg">${"<i></i>".repeat(lead)}${cells.join("")}</div>
    <p class="note men-mleg"><span><i class="men-mcd-k"></i>Tâche hebdo, mensuelle ou à date</span><span><b class="mono">8</b>tâches ce jour-là</span></p></div>`;
  return `${nav}<div class="men-mwrap">${grid}${menDayCard(menDayInfo(M.msel), 4)}</div>`;
}
function menCellTitle(o) {
  const s = { done: "Fait", late: "Fait en retard", overdue: "En retard", missed: "Oublié", todo: "À faire", upcoming: "Prévu", skip: "Facultatif, non fait" }[o.st];
  return `${o.c.name}${o.slot ? ` (${menSlotTx(o.slot).toLowerCase()})` : ""} · ${s}${o.log ? ` · ${menBy(o.log)} ${when(o.log.at)}` : ""}`;
}

/* plan + compliance */
function menPlanView() {
  const t = dayKey(); const ms = t.slice(0, 8) + "01"; const cm = menCompliance(ms, t);
  const pd = parseDay(ms); pd.setMonth(pd.getMonth() - 1); const pms = dayKey(pd); const pm = menCompliance(pms, menMonthEnd(pms));
  const chores = menChores(); const zones = [...new Set(chores.map((c) => c.zone || "Autre"))];
  const zc = zones.map((z) => ({ z, ...menCompliance(ms, t, (c) => (c.zone || "Autre") === z) })).filter((x) => x.tot).sort((a, b) => menZi(a.z) - menZi(b.z));
  const lastMiss = cm.missed.slice(-4).reverse();
  const card = `<div class="glass pad men-comp st" style="--i:2"><div class="men-ch">
      <div class="men-cring ${menPctCls(cm.pct)}">${menRing(cm.pct ?? 0, 96, 10)}<b class="mono">${cm.pct != null ? cm.pct + "<small>%</small>" : "–"}</b></div>
      <div style="min-width:0;flex:1"><span class="lbl">Conformité · ${monthLabel(monthKey())}</span><div class="h3" style="margin-top:4px">${cm.pct == null ? "Pas encore de données" : cm.pct >= 90 ? "Plan bien tenu" : cm.pct >= 70 ? "À surveiller" : "Plan mal suivi"}</div>
      <div class="sub">${cm.tot ? `${cm.done} tâche${cm.done > 1 ? "s" : ""} faite${cm.done > 1 ? "s" : ""} sur ${cm.tot} prévue${cm.tot > 1 ? "s" : ""}${cm.late ? ` · ${cm.late} en retard` : ""}` : "Le pourcentage apparaît après la première journée."}</div>${pm.pct != null ? `<div class="sub" style="margin-top:2px">${menCap(monthLabel(pms).split(" ")[0])} : <b class="mono">${pm.pct}%</b>${cm.pct != null ? ` <span class="men-delta ${cm.pct >= pm.pct ? "up" : "down"}">${cm.pct >= pm.pct ? "▲" : "▼"} ${Math.abs(cm.pct - pm.pct)} pts</span>` : ""}</div>` : ""}</div></div>
    ${zc.length ? `<div class="men-zones">${zc.map((x) => `<div class="men-z"><span>${esc(x.z)}</span><i class="men-bar"><i class="${menPctCls(x.pct)}" style="width:${x.pct}%"></i></i><b class="mono">${x.pct}%</b></div>`).join("")}</div>` : ""}
    ${lastMiss.length ? `<div class="men-miss"><span class="lbl">Derniers oublis</span>${lastMiss.map((o) => `<div class="li tap" data-act="menHist" data-id="${o.c.id}" role="button" tabindex="0"><span class="men-mk missed sm">${ico("x")}</span><div class="tx"><b>${esc(o.c.name)}</b><em>${menCap(menLongDay(o.day))}${o.slot ? ` · ${menSlotTx(o.slot).toLowerCase()}` : ""}</em></div></div>`).join("")}</div>` : ""}</div>`;
  const byZ = {}; chores.forEach((c) => (byZ[c.zone || "Autre"] ||= []).push(c));
  const from = addDays(t, -13); const ZL = menZoneList(); const ZO = [...ZL, ...Object.keys(byZ).filter((z) => !ZL.includes(z))].filter((z) => byZ[z]); const canEd = menCanEdit();
  const list = ZO.map((z, zi) => `<div class="glass pad men-plz st" style="--i:${3 + zi}"><div class="row"><span class="lbl">${esc(z)}</span><span class="sub">${byZ[z].length} tâche${byZ[z].length > 1 ? "s" : ""}</span></div>
    ${byZ[z].map((c) => { const dots = []; for (let k = from; k <= t; k = addDays(k, 1)) menOccOn(c, k).forEach((o) => dots.push(menState(o))); return `<div class="li tap men-pl" data-act="menHist" data-id="${c.id}" role="button" tabindex="0"><div class="tx"><b>${esc(c.name)}${c.required ? "" : ` <span class="men-tag opt">Facultatif</span>`}</b><em>${esc(menFreqTx(c))} · ${esc(menMomentTx(c))}${c.who ? ` · ${esc(firstName(c.who))}` : ""}${c.photo ? " · photo" : ""}</em>${c.notes ? `<em class="men-meth">${ico("menDrop")}${esc(c.notes)}</em>` : ""}</div><span class="men-dots" aria-hidden="true">${dots.slice(-10).map((s) => `<i class="${s}"></i>`).join("")}</span>${canEd ? `<button class="men-ph gd men-pled" data-act="menEdit" data-id="${c.id}" aria-label="Modifier « ${esc(c.name)} »">${ico("edit")}</button>` : ico("chev")}</div>`; }).join("")}</div>`).join("");
  return `<div class="men-plan"><div class="men-pside">${card}<div class="glass pad men-pact st" style="--i:3"><button class="btn acc block" data-act="menEdit">${ico("plus")}Nouvelle tâche</button><button class="btn soft block" data-act="menStarter">${ico("sparkle")}Compléter avec le plan type HACCP</button>${canEd ? `<button class="btn soft block" data-act="menZones">${ico("menPin")}Zones · ${ZL.length}</button>` : ""}${menIsBoss() ? menPhotoStaffSw() : ""}<p class="note">Les points montrent les derniers jours de chaque tâche : violet fait, rouge oublié. Touchez une tâche pour son historique${canEd ? ", le crayon pour la modifier" : ""}.</p></div></div><div class="men-plist">${list}</div></div>`;
}

/* ── sheets ── */
/* who may change the plan: gérant, or a member with « modifier les réglages » (js/perms.js) */
const menCanEdit = () => typeof PERMS === "undefined" || PERMS.cap("editSettings");
const menIsBoss = () => DB.mode === "demo" || (typeof myRole === "function" && myRole() === "gerant");
function menEditorHtml() {
  const d = S.ui.men; const names = menNames().filter((n) => n !== d.who);
  const ZL = menZoneList(); const zones = !d.zone || ZL.includes(d.zone) ? ZL : [...ZL, d.zone];
  const dowChips = (multi) => `<div class="men-dows">${MEN_DOW.map((t, i) => { const v = menDowJs(i); const on = multi ? d.days.includes(v) : d.wday === v; return `<button class="chip ${on ? "on" : ""}" data-act="${multi ? "menEdDay" : "menEdWday"}" data-v="${v}" aria-pressed="${on}">${t}</button>`; }).join("")}</div>`;
  const every = (unit, max) => `<div class="men-every"><span>${unit === "jours" ? "Tous les" : "Toutes les"}</span><button class="iconbtn" data-act="menEdEvery" data-v="-1" aria-label="Moins" ${d.every <= 2 ? "disabled" : ""}>−</button><b class="mono" aria-live="polite">${d.every}</b><button class="iconbtn" data-act="menEdEvery" data-v="1" aria-label="Plus" ${d.every >= max ? "disabled" : ""}>${ico("plus")}</button><span>${unit}</span></div>`;
  const start = (lbl) => `<label class="men-start"><span>${lbl}</span><input class="input" type="date" id="menStart" value="${esc(d.start || dayKey())}"></label>`;
  const sum = (extra = "") => `<p class="note men-fnote" id="menFsum">${ico("menRepeat")}<span>${esc(menFreqTx(menEdDoc(d)))}${extra}</span></p>`;
  const sub = d.freq === "jours" ? dowChips(true) + sum()
    : d.freq === "semaine" ? dowChips(false) + sum()
    : d.freq === "mois" ? `<div class="men-mgrid" role="group" aria-label="Jour du mois">${[...Array(31)].map((_, i) => `<button class="${+d.mday === i + 1 ? "on" : ""}" data-act="menEdMdaySet" data-v="${i + 1}" aria-pressed="${+d.mday === i + 1}">${i + 1}</button>`).join("")}</div>${sum(d.mday > 28 ? ", ou le dernier jour si le mois est plus court" : "")}`
    : d.freq === "ndays" ? `${every("jours", 90)}${start("À partir du")}${sum()}`
    : d.freq === "nweeks" ? `${every("semaines", 26)}${dowChips(true)}${start("Semaine de départ")}${sum()}`
    : d.freq === "dates" || d.freq === "once" ? `${menMiniCal(d)}${sum()}`
    : d.freq === "service" ? `<p class="note men-fnote">${ico("menMeal")}Deux pointages par jour : après le service du midi et à la fermeture.</p>` : sum();
  return `<div class="h2" style="font-size:20px">${d._id ? "Modifier la tâche" : "Nouvelle tâche"}</div>
    <label class="field"><span>Tâche</span><input class="input" id="menName" maxlength="140" data-bind="ui.men.name" value="${esc(d.name)}" placeholder="Ex. Désinfecter les plans de travail" autocomplete="off"></label>
    <div class="field"><span class="men-fl">Zone<button class="men-flink" data-act="menZones" data-v="ed">${ico("edit")}Gérer les zones</button></span><div class="chips men-wrap">${zones.map((z) => `<button class="chip ${d.zone === z ? "on" : ""}" data-act="menEdSet" data-id="zone" data-v="${esc(z)}">${esc(z)}</button>`).join("")}${d._zoneIn ? "" : `<button class="chip men-add" data-act="menEdZone">${ico("plus")}Nouvelle zone</button>`}</div>
      ${d._zoneIn ? `<div class="hstack"><input class="input" id="menZoneIn" maxlength="40" placeholder="Ex. Terrasse, Cave, Réserve" autocomplete="off" enterkeyhint="done" style="flex:1"><button class="btn acc sm" style="height:50px" data-act="menEdZoneOk">Ajouter</button></div>` : ""}</div>
    <div class="field"><span>Fréquence</span><div class="chips men-wrap">${MEN_FREQS.map(([k, t]) => `<button class="chip ${d.freq === k ? "on" : ""}" data-act="menEdFreq" data-v="${k}">${t}</button>`).join("")}</div>${sub}</div>
    ${d.freq !== "service" ? `<div class="field"><span>Moment</span><div class="men-mseg">${MEN_MO.map((k) => `<button class="${d.moment === k ? "on" : ""}" data-act="menEdSet" data-id="moment" data-v="${k}" aria-pressed="${d.moment === k}">${ico(MEN_MOMENTS[k].ic)}<span>${k === "midi" ? "Après le midi" : MEN_MOMENTS[k].t}</span></button>`).join("")}</div></div>` : ""}
    <button class="men-sw ${d.required ? "on" : ""}" data-act="menEdReq" role="switch" aria-checked="${!!d.required}"><span class="ic">${ico("alert")}</span><span class="tx"><b>${d.required ? "Tâche obligatoire" : "Tâche facultative"}</b><em>${d.required ? "Comptée dans la conformité, signalée si elle est en retard" : "À faire si possible : jamais en retard, ni alerte ni oubli"}</em></span><i></i></button>
    <label class="field"><span>Produit et méthode <i class="men-opt">facultatif</i></span><input class="input" data-bind="ui.men.notes" value="${esc(d.notes)}" placeholder="Ex. Dégraissant + rinçage à l'eau claire" autocomplete="off"></label>
    <label class="field"><span>Comment faire <i class="men-opt">une étape par ligne</i></span><textarea class="input men-steps" rows="6" data-bind="ui.men.stepsTx" placeholder="1 étape par ligne">${esc(d.stepsTx || "")}</textarea>${d._gen ? `<em class="men-gd-flag">${ico("alert")}Notice générale proposée : adaptez-la à votre méthode.</em>` : ""}</label>
    <div class="field"><span>Responsable <i class="men-opt">facultatif</i></span><div class="chips men-wrap"><button class="chip ${!d.who ? "on" : ""}" data-act="menEdSet" data-id="who" data-v="">Toute l'équipe</button>${d.who ? `<button class="chip on" data-act="menEdSet" data-id="who" data-v="${esc(d.who)}">${esc(d.who)}</button>` : ""}${names.map((n) => `<button class="chip" data-act="menEdSet" data-id="who" data-v="${esc(n)}">${esc(n)}</button>`).join("")}${d._whoIn ? "" : `<button class="chip" data-act="menEdWho">${ico("plus")}Autre</button>`}</div>
      ${d._whoIn ? `<div class="hstack"><input class="input" id="menWhoIn" placeholder="Prénom" autocomplete="off" style="flex:1"><button class="btn acc sm" style="height:50px" data-act="menEdWhoOk">Ajouter</button></div>` : ""}</div>
    <button class="men-sw ${d.photo ? "on" : ""}" data-act="menEdPhoto" role="switch" aria-checked="${!!d.photo}"><span class="ic">${ico("camera")}</span><span class="tx"><b>Photo obligatoire</b><em>${d.photo ? "Une photo de preuve est demandée à tout le monde, gérant compris" : menStaffPhotoOn() ? "Les employés prennent déjà une photo à chaque tâche (réglage du plan)" : "Une photo de preuve est demandée au pointage"}</em></span><i></i></button>
    ${d._id ? `<button class="btn ghost block" style="color:var(--bad)" data-act="menDel" data-id="${d._id}">${ico("trash")}Supprimer la tâche</button>` : ""}
    <div class="men-sfoot"><button class="btn acc block" data-act="menSave">${ico("check")}Enregistrer</button></div>`;
}
/* the editor's draft as a chore doc (also feeds the live summary line) */
function menEdDoc(d) {
  const f = d.freq; const per = f === "ndays" || f === "nweeks";
  return { name: (d.name || "").trim(), zone: d.zone || "", freq: f, moment: f === "service" ? "midi" : d.moment, days: f === "jours" || f === "nweeks" ? d.days : [], wday: f === "semaine" ? d.wday : null, mday: f === "mois" ? d.mday : null,
    every: per ? d.every : null, start: per ? d.start || dayKey() : null, dates: f === "dates" ? [...d.dates].sort() : f === "once" ? d.dates.slice(0, 1) : [], required: d.required !== false, who: d.who || "", notes: (d.notes || "").trim(), photo: !!d.photo };
}
/* small month calendar for « Dates précises » (multi) and « Une seule fois » (single) */
function menMiniCal(d) {
  const t = dayKey(); const cm = d._cm || (d.dates[0] && d.dates[0] > t ? d.dates[0] : t).slice(0, 8) + "01"; const m0 = parseDay(cm); const me = menMonthEnd(cm);
  const lead = (m0.getDay() + 6) % 7; const cells = [];
  for (let k = cm; k <= me; k = addDays(k, 1)) { const on = d.dates.includes(k); cells.push(`<button class="${on ? "on" : ""} ${k === t ? "today" : ""}" data-act="menEdDate" data-v="${k}" aria-pressed="${on}" ${k < t ? "disabled" : ""} aria-label="${esc(menLongDay(k))}">${+k.slice(8)}</button>`); }
  const chips = d.dates.length ? `<div class="men-dsel">${d.dates.slice().sort().map((k) => `<button class="chip on" data-act="menEdDate" data-v="${k}" aria-label="Retirer le ${esc(menLongDay(k))}">${menDateTx(k)}${ico("x")}</button>`).join("")}</div>` : "";
  return `<div class="men-mini"><div class="men-minih"><button class="iconbtn" data-act="menEdCm" data-v="-1" aria-label="Mois précédent" ${cm <= t.slice(0, 8) + "01" ? "disabled" : ""}>${ico("back")}</button><b>${menCap(MONTHS[m0.getMonth()])} ${m0.getFullYear()}</b><button class="iconbtn" data-act="menEdCm" data-v="1" aria-label="Mois suivant">${ico("chev")}</button></div>
    <div class="men-mgrid men-mcal" role="group" aria-label="${d.freq === "once" ? "Choisir la date" : "Choisir les dates"}">${MEN_DOW.map((x) => `<span>${x[0]}</span>`).join("")}${"<span></span>".repeat(lead)}${cells.join("")}</div>${chips}
    <p class="note" style="margin:6px 2px 0">${d.freq === "once" ? "Touchez le jour où la tâche est à faire." : "Touchez chaque jour où la tâche est à faire : plusieurs dates possibles."}</p></div>`;
}
const menEdRedraw = (focus) => { const b = $("#sheetBody"); const st = b.scrollTop; b.innerHTML = menEditorHtml(); b.scrollTop = st; if (focus) $(focus)?.focus(); };

function menLogSheet(l) {
  const c = S.chores.find((x) => x.id === l.choreId); const today = l.day === dayKey();
  return `<div class="hstack men-lh"><span class="men-mk done">${menCheckSvg}</span><div style="min-width:0"><div class="h2" style="font-size:20px">${esc(c?.name || "Tâche supprimée")}</div><div class="sub">Fait par ${esc(l.by || nameOf(l.uid))} · ${menLongDay(l.day)} à ${hm(l.at)}${l.slot ? ` · service du ${l.slot}` : ""}</div></div></div>
    ${menHasPic(l) ? menImg(l, "men-big", "Photo de preuve") : `<button class="btn soft block" data-act="menPhotoAdd" data-id="${l.id}">${ico("camera")}Ajouter une photo de preuve</button>`}
    ${c?.notes ? `<div class="note men-meth">${ico("menDrop")}${esc(c.notes)}</div>` : ""}
    <div class="grid2">${c ? `<button class="btn soft" data-act="menHist" data-id="${c.id}">${ico("menHist")}Historique</button>` : `<button class="btn soft" data-act="sheetClose">Fermer</button>`}${today ? `<button class="btn danger" data-act="menUnlog" data-id="${l.id}">${ico("menUndo")}Annuler</button>` : `<button class="btn soft" data-act="sheetClose">Fermer</button>`}</div>`;
}
/* the history sheet's primary action: check the task now when it is open today / this week */
function menHistDo(c) {
  const { groups, week } = menToday(); const L = [...groups.ouverture, ...groups.midi, ...groups.fermeture, ...week].filter((o) => o.c.id === c.id && (o.st === "overdue" || o.st === "todo"));
  const o = L.find((x) => x.st === "overdue") || L[0]; if (!o) return "";
  return `<button class="btn acc block" data-act="menHistOk" data-v="${menKey(o)}">${ico("check")}Marquer comme fait${o.slot ? ` · ${menSlotTx(o.slot).toLowerCase()}` : ""}</button>`;
}
function menHistSheet(c) {
  c = menNorm(c); const t = dayKey(); const logs = menLogsOf(c.id).slice().reverse(); const doBtn = menHistDo(c);
  const k30 = addDays(t, -29); const cp = menCompliance(k30 < menStart(c) ? menStart(c) : k30, t, (x) => x.id === c.id);
  const c0 = addDays(menWeekStart(t), -21); const cells = [];
  for (let k = c0, n = 0; n < 28; k = addDays(k, 1), n++) { const os = menOccOn(c, k); os.forEach((o) => menState(o)); const st = !os.length ? "" : os.some((o) => o.st === "missed") ? "missed" : os.every(menIsDone) ? (os.some((o) => o.st === "late") ? "late" : "done") : os.some((o) => o.st === "overdue") ? "overdue" : os.some(menIsDone) ? "part" : os[0].st; cells.push({ k, st }); }
  return `<div class="h2" style="font-size:20px">${esc(c.name)}</div>
    <div class="men-hmeta"><span class="pill neu">${esc(c.zone || "Sans zone")}</span><span class="pill neu">${esc(menFreqTx(c))}</span><span class="pill neu">${esc(menCap(menMomentTx(c)))}</span>${c.who ? `<span class="pill acc">${esc(c.who)}</span>` : ""}${c.photo ? `<span class="pill acc">Photo obligatoire</span>` : ""}${c.required ? "" : `<span class="pill neu">Facultatif</span>`}</div>
    ${c.notes ? `<div class="note men-meth">${ico("menDrop")}${esc(c.notes)}</div>` : ""}
    <div class="men-hstat"><div class="men-hs"><span class="lbl">30 derniers jours</span>${c.required ? `<b class="mono ${menPctCls(cp.pct)}">${cp.pct != null ? cp.pct + "%" : "–"}</b><em>${cp.tot ? `${cp.done}/${cp.tot} fait${cp.missed.length ? ` · ${cp.missed.length} oubli${cp.missed.length > 1 ? "s" : ""}` : ""}` : "Pas encore de données"}</em>` : `<b class="mono">${menLogsOf(c.id).filter((l) => l.day >= k30).length}</b><em>fois faite · tâche facultative, hors conformité</em>`}</div>
      <div class="men-cal" aria-label="4 dernières semaines">${MEN_DOW.map((d) => `<span>${d[0]}</span>`).join("")}${cells.map((x) => `<i class="${x.st} ${x.k === t ? "t" : ""} ${x.k > t ? "fut" : ""}" title="${shortDate(x.k)}"></i>`).join("")}</div></div>
    <div><span class="lbl">Derniers pointages</span>${logs.length ? `<div class="men-hl">${logs.slice(0, 8).map((l) => `<div class="li tap" data-act="menLog" data-id="${l.id}" role="button" tabindex="0"><span class="men-mk done sm">${menCheckSvg}</span><div class="tx"><b>${esc(l.by || nameOf(l.uid))}</b><em>${menCap(menLongDay(l.day))} · ${hm(l.at)}${l.slot ? ` · ${l.slot}` : ""}</em></div>${menHasPic(l) ? `<span class="men-ph">${menImg(l)}</span>` : ""}</div>`).join("")}</div>` : `<div class="empty" style="padding:14px 0 4px">Jamais pointée pour l'instant.</div>`}</div>
    <div class="men-sfoot">${doBtn}${menCanEdit() ? `<button class="btn ${doBtn ? "soft" : "acc"} block" data-act="menEdit" data-id="${c.id}">${ico("edit")}Modifier la tâche, sa fréquence…</button>` : ""}</div>`;
}

/* ── photo proof: stored by core's upload() (IndexedDB on the device, or the asset store), the log keeps the id.
   Older logs may hold an inline data: URL in photoUrl: still displayed. ── */
/* photo proof before a check: the task asks for one (c.photo), the gérant requires it from this person (js/perms.js chorePhoto),
   or the restaurant rule « Photo obligatoire pour les employés » (resto.chorePhotoStaff, on by default) and the person is not a gérant */
const menStaffPhotoOn = () => !(S.resto && S.resto.chorePhotoStaff === false);
const menStaffPhoto = () => !!S.resto && menStaffPhotoOn() && typeof myRole === "function" && myRole() !== "gerant";
const menMustPhoto = () => (typeof PERMS !== "undefined" && PERMS.must("chorePhoto")) || menStaffPhoto();
const menNeedPhoto = (c) => !!(c && c.photo) || menMustPhoto();
function menPhotoStaffSw() {
  const on = menStaffPhotoOn();
  return `<button class="men-sw ${on ? "on" : ""}" data-act="menPhotoStaff" role="switch" aria-checked="${on}"><span class="ic">${ico("camera")}</span><span class="tx"><b>Photo obligatoire pour les employés</b><em>${on ? "Chaque tâche cochée par un employé a sa photo de preuve" : "Seules les tâches « photo obligatoire » en demandent une"}</em></span><i></i></button>`;
}
const menPicMissing = (id) => typeof PHOTOS !== "undefined" && PHOTOS.missing && PHOTOS.missing[id];
const menHasPic = (l) => !!(l && ((l.photoId && !menPicMissing(l.photoId)) || l.photoUrl));
const menPicUrl = (l) => (typeof photoUrl === "function" ? (l.photoId && photoUrl(l.photoId)) || photoUrl(l.photoUrl) : l.photoUrl) || "";
const menImg = (l, cls, alt) => `<img${cls ? ` class="${cls}"` : ""}${l.photoId ? ` data-photo="${esc(l.photoId)}"` : ""} src="${esc(menPicUrl(l) || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")}" alt="${alt || ""}">`;
async function menPhoto() {
  const [f] = await pickImage(); if (!f) return null;
  try {
    const { blob } = await shrink(f, 1280, 0.8); const up = await upload(blob || f);
    if (up && !up.id && up.url && DB.mode === "demo") return { photoId: "", photoUrl: up.url }; // demo keeps nothing: the photo lives for the session
    if (!up || !up.id) throw new Error("photo not stored");
    return { photoId: up.id, photoUrl: /^https?:/.test(up.url || "") ? up.url : "" }; // a blob: URL dies on reload: the id is the reference
  } catch (e) { console.warn(e); SFX.err(); toast("Photo non enregistrée, réessayez.", "err"); return null; }
}

/* one check: optional photo proof, sound + haptics, log + audit event, undo toast, group / day celebration */
async function menDoIt(a, v, c, slot) {
  const cid = c.id;
  let ph = null; if (menNeedPhoto(c)) { toast("Photo de preuve obligatoire"); ph = await menPhoto(); if (!ph) { toast("Tâche non cochée : la photo est obligatoire", "err"); return; } }
    a && a.classList && a.classList.add("press"); menSfx.check(); buzz(12);
    const by = menSigner(); M.just = v; M.justAt = Date.now();
    const evId = await DB.add("events", { type: "chore", text: `a fait « ${c.name} »${slot ? ` (${slot})` : ""}`, at: Date.now(), uid: S.me.id, by, ref: cid }).catch(() => "");
    const logId = await safe(DB.add("choreLogs", { choreId: cid, at: Date.now(), day: dayKey(), uid: S.me.id, by, evId, ...(slot ? { slot } : {}), ...(ph || {}) })).catch(() => null);
    if (!logId) { M.just = null; return; }
    S.ui.menUndo = { logId, evId }; toastUndo(`${c.name.length > 34 ? c.name.slice(0, 32).trim() + "…" : c.name} : fait`); const ub = $("#toastTx button"); if (ub) ub.dataset.act = "menUndo";
    setTimeout(() => {
      const { groups } = menToday(); const occ = [...groups.ouverture, ...groups.midi, ...groups.fermeture]; const g = occ.find((o) => menKey(o) === v)?.moment;
      if (g && occ.filter(menReq).every(menIsDone)) { SFX.done(); buzz([12, 40, 12]); burst(); setTimeout(() => toast("Ménage du jour terminé, bravo !"), 1500); }
      else if (g && groups[g].filter(menReq).every(menIsDone)) { SFX.done(); buzz([8, 30, 8]); const el = $(`.men-gh[data-v="${g}"]`); const r = el?.getBoundingClientRect(); if (r) burst(r.left + r.width - 50, r.top + r.height / 2); }
    }, 380);
}

/* ── sound: a bright « squeaky clean » chirp ── */
const menSfx = { check() { SFX.tone(700, 0.08, "sine", 0.055, 0, 1400); SFX.tone(1760, 0.14, "sine", 0.035, 0.065); SFX.tone(2637, 0.24, "sine", 0.014, 0.12); SFX.noise(0.1, 0.008, 6000, 9000, 0.03); } };

Object.assign(ACT, {
  menTab: (a, id, v) => { if (M.tab === v) return; const seg = a.closest(".seg"); const i = [...$$("button", seg)].indexOf(a); $(".knob", seg).style.transform = `translateX(${i * 100}%)`; $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); buzz(4); setTimeout(() => { M.tab = v; const vw = $("#viewport .view:not(.leave)"); rerender(); if (vw) { vw.classList.remove("nost"); vw.scrollTop = 0; } }, 160); },
  menGroup: (a, id, v) => { const open = a.getAttribute("aria-expanded") === "true"; M.open[v] = !open; a.setAttribute("aria-expanded", String(!open)); a.nextElementSibling?.classList.toggle("shut", open); $(".men-chev", a)?.classList.toggle("on", !open); SFX.tick(); },
  menWk: (a, id, v) => { M.wk += +v; M.sel = null; SFX.tick(); rerender(); },
  menSel: (a, id, v) => { M.sel = v; SFX.tick(); buzz(3); rerender(); },
  menMo: (a, id, v) => { M.mo += +v; M.msel = null; SFX.tick(); rerender(); },
  menMsel: (a, id, v) => { M.msel = v; SFX.tick(); buzz(3); rerender(); },
  menDo: async (a, id, v) => {
    if (!v || Date.now() - (M.busy[v] || 0) < 1500) return; // double tap (the photo picker may never answer if cancelled: time-boxed, not a lock)
    const [cid, day, slot] = v.split("|"); const raw = S.chores.find((x) => x.id === cid); if (!raw) return; const c = menNorm(raw);
    const occ = menOccOn(c, day).find((o) => o.slot === (slot || "")); if (occ && menLogFor(occ)) return; // already checked
    if (!menSigner()) { toast("Choisissez d'abord qui signe"); ACT.menSigner(); return; }
    if (M.gdPass !== v && !menGdOff().includes(c.id)) { SFX.tap(); openSheet(menGuideSheet(c, v)); return; } // « comment faire » first, until « ne plus afficher »
    M.gdPass = null;
    M.busy[v] = Date.now();
    try { await menDoIt(a, v, c, slot); } finally { delete M.busy[v]; }
  },
  // home's « Fait » button: check the chore's open occurrence (overdue first), with the same photo, signature and slot rules
  choreDo: async (a, id) => {
    const { groups, week } = menToday(); const L = [...groups.ouverture, ...groups.midi, ...groups.fermeture, ...week].filter((o) => o.c.id === id && (o.st === "overdue" || o.st === "todo"));
    const o = L.find((x) => x.st === "overdue") || L[0]; if (!o) return; return ACT.menDo(a, null, menKey(o));
  },
  menUndo: async () => { const u = S.ui.menUndo; if (!u) return; S.ui.menUndo = null; S.ui.undo = null; M.just = null; await DB.del("choreLogs", u.logId).catch(() => {}); if (u.evId) await DB.del("events", u.evId).catch(() => {}); $("#toast").classList.remove("on"); SFX.close(); buzz(6); },
  menUnlog: async (a, id) => { const l = menLogs().find((x) => x.id === id); if (!l) return; await safe(DB.del("choreLogs", id)).catch(() => {}); if (l.evId) await DB.del("events", l.evId).catch(() => {}); closeSheet(true); SFX.close(); toast("Pointage annulé"); },
  menLog: (a, id) => { const l = menLogs().find((x) => x.id === id); if (!l) return; SFX.tap(); openSheet(menLogSheet(l)); },
  menHist: (a, id) => { const c = S.chores.find((x) => x.id === id); if (!c) return; SFX.tap(); openSheet(menHistSheet(c)); },
  menPhotoAdd: async (a, id) => { const ph = await menPhoto(); if (!ph) return; await safe(DB.update("choreLogs", id, ph)).catch(() => {}); SFX.ok(); toast("Photo ajoutée"); const l = menLogs().find((x) => x.id === id); if ($("#sheet").classList.contains("open") && l) $("#sheetBody").innerHTML = menLogSheet(l); },

  // the signer chip = the user switcher (with its codes): whoever is switched in signs, nobody can sign for someone else
  menSigner: () => { SFX.tap(); if (typeof ACT.whoami === "function") return ACT.whoami(); if (typeof ACT.meRename === "function") return ACT.meRename(); go("reglages"); },
  menHistOk: async (a, id, v) => { closeSheet(true); await ACT.menDo(a, null, v); },

  menEdit: (a, id) => {
    const c = id ? S.chores.find((x) => x.id === id) : null; const n = c ? menNorm(c) : null;
    S.ui.men = n ? { _id: n.id, name: n.name, zone: n.zone || "", freq: n.freq, moment: n.moment, days: [...n.days], wday: n.wday == null ? null : +n.wday, mday: n.mday == null ? null : +n.mday, every: Math.max(2, n.every), start: n.start || "", dates: [...n.dates], required: n.required, who: n.who || "", notes: n.notes || "", photo: !!n.photo }
      : { name: "", zone: menZoneList()[0] || "", freq: "jour", moment: "fermeture", days: [], wday: null, mday: null, every: 2, start: "", dates: [], required: true, who: "", notes: "", photo: false };
    if (n) { const g = menGuideOf(n); S.ui.men.stepsTx = g.steps.join("\n"); S.ui.men._gen = g.generic; S.ui.men._libTx = (Array.isArray(n.steps) && n.steps.length ? g.lib.steps : g.steps).join("\n"); } else { S.ui.men.stepsTx = ""; S.ui.men._libTx = ""; }
    openSheet(menEditorHtml()); if (!id) setTimeout(() => $("#menName")?.focus(), 450);
  },
  menEdSet: (a, id, v) => { S.ui.men[id] = v; SFX.tick(); menEdRedraw(); },
  menEdFreq: (a, id, v) => { const d = S.ui.men; d.freq = v; if ((v === "jours" || v === "nweeks") && !d.days.length) d.days = [menDow(dayKey())]; if (v === "semaine" && d.wday == null) d.wday = 1; if (v === "mois" && d.mday == null) d.mday = 1;
    if ((v === "ndays" || v === "nweeks") && !d.start) d.start = dayKey(); if (v === "once" && d.dates.length > 1) d.dates = d.dates.slice(0, 1); SFX.tick(); menEdRedraw(); },
  menEdEvery: (a, id, v) => { const d = S.ui.men; d.every = Math.max(2, Math.min(d.freq === "nweeks" ? 26 : 90, (+d.every || 2) + +v)); SFX.tick(); buzz(3); menEdRedraw(); },
  menEdDate: (a, id, v) => { const d = S.ui.men; if (!menIsKey(v)) return; if (d.freq === "once") d.dates = d.dates[0] === v ? [] : [v]; else d.dates = d.dates.includes(v) ? d.dates.filter((x) => x !== v) : [...d.dates, v].sort(); SFX.tick(); buzz(3); menEdRedraw(); },
  menEdCm: (a, id, v) => { const d = S.ui.men; const t = dayKey(); const cur = parseDay(d._cm || (d.dates[0] && d.dates[0] > t ? d.dates[0] : t).slice(0, 8) + "01"); cur.setMonth(cur.getMonth() + +v); const k = dayKey(cur); d._cm = k < t.slice(0, 8) + "01" ? t.slice(0, 8) + "01" : k; SFX.tick(); menEdRedraw(); },
  menEdReq: () => { S.ui.men.required = !S.ui.men.required; SFX.tick(); buzz(4); menEdRedraw(); },
  menEdZone: () => { S.ui.men._zoneIn = true; SFX.tick(); menEdRedraw("#menZoneIn"); },
  menEdZoneOk: async () => { const d = S.ui.men; const z = menZoneClean($("#menZoneIn")?.value); d._zoneIn = false; if (z) { const ex = menZoneList().find((x) => x.toLowerCase() === z.toLowerCase()); d.zone = ex || z; if (!ex) { await menZonesSave([...menZoneList(), z]); toast(`Zone « ${z} » ajoutée`); } } SFX.tick(); menEdRedraw(); },
  menEdDay: (a, id, v) => { const d = S.ui.men; v = +v; d.days = d.days.includes(v) ? d.days.filter((x) => x !== v) : [...d.days, v].sort(); SFX.tick(); buzz(3); menEdRedraw(); },
  menEdWday: (a, id, v) => { S.ui.men.wday = +v; SFX.tick(); menEdRedraw(); },
  menEdMdaySet: (a, id, v) => { S.ui.men.mday = Math.max(1, Math.min(31, +v || 1)); SFX.tick(); buzz(3); menEdRedraw(); },
  menEdMday: (a, id, v) => { const d = S.ui.men; d.mday = Math.max(1, Math.min(31, (+d.mday || 1) + +v)); SFX.tick(); menEdRedraw(); },
  menEdPhoto: () => { S.ui.men.photo = !S.ui.men.photo; SFX.tick(); buzz(4); menEdRedraw(); },
  menEdWho: () => { S.ui.men._whoIn = true; SFX.tick(); menEdRedraw("#menWhoIn"); },
  menEdWhoOk: () => { const n = ($("#menWhoIn")?.value || "").trim(); const d = S.ui.men; d._whoIn = false; if (n) { d.who = n; if (!M.names.includes(n)) { M.names.push(n); menSaveNames(); } } SFX.tick(); menEdRedraw(); },
  menSave: async () => {
    const d = S.ui.men; d.name = ($("#menName")?.value ?? d.name ?? "").trim();
    if (!d.name) { SFX.err(); const i = $("#menName"); if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); i.focus(); } return; }
    if ((d.freq === "jours" || d.freq === "nweeks") && !d.days.length) { SFX.err(); toast("Choisissez au moins un jour", "err"); return; }
    if (d.freq === "dates" && !d.dates.length) { SFX.err(); toast("Choisissez au moins une date", "err"); return; }
    if (d.freq === "once" && !d.dates.length) { SFX.err(); toast("Choisissez la date", "err"); return; }
    const doc = menEdDoc(d);
    { const tx = String(d.stepsTx || "").split("\n").map((x) => x.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean); doc.steps = tx.join("\n") === String(d._libTx || "").split("\n").map((x) => x.trim()).filter(Boolean).join("\n") ? [] : tx; }
    if (d._id) await safe(DB.update("chores", d._id, doc)); else await safe(DB.add("chores", { ...doc, createdAt: Date.now() }));
    await logEvent("chore", `a ${d._id ? "modifié" : "ajouté"} la tâche de ménage « ${d.name} »`);
    closeSheet(true); SFX.ok(); toast(d._id ? "Tâche mise à jour" : "Tâche ajoutée");
  },
  menDel: (a, id) => { const c = S.chores.find((x) => x.id === id); openSheet(`<div class="h2" style="font-size:20px">Supprimer « ${esc(c?.name || "")} » ?</div><p class="sub" style="margin:-6px 0 0">Les pointages déjà faits restent au registre.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="menDelOk" data-id="${id}">Supprimer</button></div>`); },
  menDelOk: async (a, id) => { const c = S.chores.find((x) => x.id === id); await safe(DB.del("chores", id)); if (c) await logEvent("chore", `a supprimé la tâche de ménage « ${c.name} »`); closeSheet(true); SFX.close(); toast("Tâche supprimée"); },

  menStarter: async (a) => {
    const have = new Set(S.chores.map((c) => (c.name || "").toLowerCase())); const now = Date.now(); let n = 0; a && a.setAttribute("disabled", "");
    for (const [name, zone, moment, freq, extra, notes, photo] of MEN_STARTER) { if (have.has(name.toLowerCase())) continue; await DB.add("chores", { name, zone, moment, freq, days: [], wday: null, mday: null, who: "", notes, photo: !!photo, ...extra, createdAt: now + n++ }); }
    a && a.removeAttribute("disabled");
    if (!n) { SFX.tick(); toast("Le plan type est déjà chargé"); return; }
    await logEvent("chore", `a chargé le plan de nettoyage type (${n} tâches)`);
    M.tab = "jour"; SFX.done(); buzz([10, 30, 10]); burst(); toast(`Plan de nettoyage créé · ${n} tâches`);
  },
  // legacy action names, in case another area still links to them
  choreEdit: (a, id) => ACT.menEdit(a, id),
  choreStarter: (a) => ACT.menStarter(a),
});

/* ── zones: the restaurant's list (resto.choreZones) — add, rename (every task of the zone follows), delete (its tasks go « sans zone ») ── */
const menZoneClean = (z) => String(z || "").replace(/\s+/g, " ").trim().slice(0, 40);
async function menZonesSave(list) {
  list = [...new Set(list.map(menZoneClean).filter(Boolean))];
  if (S.resto) S.resto.choreZones = list;
  if (S.rid) await safe(DB.update("restos", S.rid, { choreZones: list })).catch(() => {});
  return list;
}
function menZonesSheet() {
  const Z = S.ui.menZ || {}; const L = menZoneList(); const n = (z) => S.chores.filter((c) => (c.zone || "") === z).length;
  const row = (z, i) => {
    const k = n(z);
    if (Z.edit === z) return `<div class="men-zr ed"><input class="input" id="menZoneRen" maxlength="40" value="${esc(z)}" aria-label="Nouveau nom de la zone" autocomplete="off" enterkeyhint="done"><button class="btn soft sm" data-act="menZoneEdit" data-v="">Annuler</button><button class="btn acc sm" data-act="menZoneRenOk" data-v="${esc(z)}">OK</button></div>`;
    if (Z.del === z) return `<div class="men-zr del"><div class="tx"><b>Supprimer « ${esc(z)} » ?</b><em>${k ? `${k} tâche${k > 1 ? "s" : ""} passer${k > 1 ? "ont" : "a"} « sans zone », rien n'est effacé` : "Aucune tâche dans cette zone"}</em></div><button class="btn soft sm" data-act="menZoneDel" data-v="">Annuler</button><button class="btn danger sm" data-act="menZoneDelOk" data-v="${esc(z)}">Supprimer</button></div>`;
    return `<div class="men-zr st" style="--i:${i}"><span class="ic">${ico("menPin")}</span><div class="tx"><b>${esc(z)}</b><em>${k ? `${k} tâche${k > 1 ? "s" : ""}` : "Aucune tâche"}</em></div><button class="iconbtn" data-act="menZoneEdit" data-v="${esc(z)}" aria-label="Renommer ${esc(z)}">${ico("edit")}</button><button class="iconbtn" data-act="menZoneDel" data-v="${esc(z)}" aria-label="Supprimer ${esc(z)}">${ico("trash")}</button></div>`;
  };
  return `<div class="h2" style="font-size:20px">Zones du plan</div><p class="sub" style="margin:-6px 0 0">Renommer une zone renomme toutes ses tâches.</p>
    <div class="men-zl">${L.map(row).join("") || `<div class="empty" style="padding:14px 0">Aucune zone pour l'instant.</div>`}</div>
    <div class="hstack"><input class="input" id="menZoneNew" maxlength="40" placeholder="Nouvelle zone, ex. Terrasse" autocomplete="off" enterkeyhint="done" style="flex:1"><button class="btn acc sm" style="height:50px" data-act="menZoneAdd">${ico("plus")}Ajouter</button></div>
    <div class="men-sfoot">${Z.back ? `<button class="btn acc block" data-act="menZonesBack">${ico("back")}Retour à la tâche</button>` : `<button class="btn acc block" data-act="sheetClose">Terminé</button>`}</div>`;
}
const menZRedraw = (focus) => { const b = $("#sheetBody"); if (!b) return; const st = b.scrollTop; b.innerHTML = menZonesSheet(); b.scrollTop = st; if (focus) { const i = $(focus); if (i) { i.focus(); i.select && i.select(); } } };
Object.assign(ACT, {
  menZones: (a, id, v) => { S.ui.menZ = { back: v === "ed" && S.ui.men ? 1 : 0 }; SFX.tap(); openSheet(menZonesSheet()); },
  menZonesBack: () => { const d = S.ui.men; if (!d) return closeSheet(true); if (d.zone && !menZoneList().includes(d.zone)) d.zone = S.ui.menZ?.renamed?.[d.zone] ?? ""; SFX.tap(); openSheet(menEditorHtml()); },
  menZoneEdit: (a, id, v) => { S.ui.menZ = { ...(S.ui.menZ || {}), edit: v || null, del: null }; SFX.tick(); menZRedraw(v ? "#menZoneRen" : null); },
  menZoneDel: (a, id, v) => { S.ui.menZ = { ...(S.ui.menZ || {}), del: v || null, edit: null }; SFX.tick(); menZRedraw(); },
  menZoneAdd: async () => { const z = menZoneClean($("#menZoneNew")?.value); if (!z) { SFX.err(); $("#menZoneNew")?.focus(); return; } if (menZoneList().some((x) => x.toLowerCase() === z.toLowerCase())) { SFX.err(); toast("Cette zone existe déjà", "err"); return; } await menZonesSave([...menZoneList(), z]); SFX.ok(); toast(`Zone « ${z} » ajoutée`); menZRedraw("#menZoneNew"); },
  menZoneRenOk: async (a, id, v) => {
    const to = menZoneClean($("#menZoneRen")?.value); const from = v; if (!to || to === from) { S.ui.menZ.edit = null; return menZRedraw(); }
    const L = menZoneList(); if (L.some((x) => x !== from && x.toLowerCase() === to.toLowerCase())) { SFX.err(); toast("Une zone porte déjà ce nom", "err"); return; }
    await menZonesSave(L.map((x) => (x === from ? to : x)));
    const T = S.chores.filter((c) => (c.zone || "") === from); await Promise.all(T.map((c) => safe(DB.update("chores", c.id, { zone: to })).catch(() => {}))); T.forEach((c) => { c.zone = to; });
    if (S.ui.men && S.ui.men.zone === from) S.ui.men.zone = to; (S.ui.menZ.renamed ||= {})[from] = to;
    await logEvent("chore", `a renommé la zone de ménage « ${from} » en « ${to} »${T.length ? ` (${T.length} tâche${T.length > 1 ? "s" : ""})` : ""}`);
    S.ui.menZ.edit = null; SFX.ok(); toast("Zone renommée"); menZRedraw();
  },
  menZoneDelOk: async (a, id, v) => {
    const T = S.chores.filter((c) => (c.zone || "") === v); await Promise.all(T.map((c) => safe(DB.update("chores", c.id, { zone: "" })).catch(() => {}))); T.forEach((c) => { c.zone = ""; });
    await menZonesSave(menZoneList().filter((x) => x !== v));
    if (S.ui.men && S.ui.men.zone === v) S.ui.men.zone = "";
    await logEvent("chore", `a supprimé la zone de ménage « ${v} »`);
    S.ui.menZ.del = null; SFX.close(); toast("Zone supprimée"); menZRedraw();
  },
  // restaurant rule, gérant only (firestore.rules keeps it out of other members' writes)
  menPhotoStaff: async (a) => {
    if (!menIsBoss()) { SFX.err(); toast("Réservé au gérant", "err"); return; }
    const on = !menStaffPhotoOn(); if (S.resto) S.resto.chorePhotoStaff = on; a && a.classList && (a.classList.toggle("on", on), a.setAttribute("aria-checked", String(on))); SFX.tick(); buzz(4);
    await safe(DB.update("restos", S.rid, { chorePhotoStaff: on })).catch(() => {}); toast(on ? "Photo obligatoire pour les employés" : "Photo seulement pour les tâches qui la demandent"); rerender();
  },
});
// enter = OK in the zone fields; the start date of « tous les N jours / semaines » refreshes the summary line
document.addEventListener("keydown", (e) => { if (e.key !== "Enter" || !e.target || !e.target.id) return; const m = { menZoneIn: "menEdZoneOk", menZoneNew: "menZoneAdd", menZoneRen: "menZoneRenOk" }[e.target.id]; if (!m) return; e.preventDefault(); e.stopPropagation(); const b = $(`[data-act="${m}"]`); b ? b.click() : ACT[m](); }, true);
document.addEventListener("change", (e) => { const el = e.target; if (!el || el.id !== "menStart" || !S.ui.men) return; if (menIsKey(el.value)) S.ui.men.start = el.value; const f = $("#menFsum span"); if (f) f.textContent = menFreqTx(menEdDoc(S.ui.men)); });

/* HACCP starter plan for a small restaurant: [name, zone, moment, freq, extra, product / method, photo required] */
const MEN_STARTER = [
  ["Plans de travail désinfectés", "Cuisine", "ouverture", "jour", {}, "Détergent-désinfectant alimentaire, rinçage, séchage à l'air"],
  ["Sanitaires et lave-mains", "Sanitaires", "ouverture", "jour", {}, "Détartrant WC, désinfectant, savon et papier rechargés", true],
  ["Plans, planches et ustensiles", "Cuisine", "midi", "service", {}, "Dégraissant puis désinfectant, rinçage à l'eau claire"],
  ["Trancheuse et robot-coupe", "Cuisine", "midi", "service", {}, "Démonter, laver, désinfecter, remonter sec"],
  ["Plonge, éviers et bacs", "Plonge", "fermeture", "jour", {}, "Détergent, désinfection, détartrage si besoin"],
  ["Lave-vaisselle : filtres et bras", "Plonge", "fermeture", "jour", {}, "Vidanger, rincer les filtres, porte ouverte la nuit"],
  ["Sols cuisine et plonge", "Cuisine", "fermeture", "jour", {}, "Balayage humide, détergent sol, raclette vers le siphon"],
  ["Poubelles vidées, bacs lavés", "Cuisine", "fermeture", "jour", {}, "Sacs fermés sortis, bacs désinfectés"],
  ["Poignées, interrupteurs, boutons", "Cuisine", "fermeture", "jour", {}, "Spray désinfectant, essuyage à usage unique"],
  ["Salle : tables, chaises et sol", "Salle", "fermeture", "jour", {}, "Tables désinfectées, sol aspiré puis lavé"],
  ["Bar : comptoir, tireuse, café", "Bar", "fermeture", "jour", {}, "Purger la buse vapeur, nettoyer le groupe café et les becs"],
  ["Four et plaques dégraissés", "Cuisine", "fermeture", "jours", { days: [2, 5] }, "Dégraissant four sur surface tiède, rinçage"],
  ["Friteuse : filtrer l'huile", "Cuisine", "fermeture", "jours", { days: [3, 6] }, "Huile filtrée à froid, changée si trop foncée"],
  ["Chambre froide : parois et clayettes", "Chambre froide", "ouverture", "semaine", { wday: 1 }, "Vider, détergent-désinfectant, rinçage, séchage", true],
  ["Hotte et filtres", "Cuisine", "fermeture", "semaine", { wday: 6 }, "Filtres au lave-vaisselle ou bain dégraissant"],
  ["Dégivrage du congélateur", "Chambre froide", "ouverture", "mois", { mday: 1 }, "Produits en glacière, dégivrer, désinfecter, sécher", true],
];

/* ── « Comment faire » : one how-to notice per cleaning task ──
   Shown when a task is tapped (like a bank app's tip), with « Ne plus afficher pour cette tâche ». The text comes from the task's own
   steps (editable in the task sheet) or, failing that, from this HACCP library matched on the task name; with no match, a general
   method is shown and flagged as « à compléter ». */
const MEN_GUIDES = [
  { k: ["plan de travail", "plans de travail", "surface"], product: "Détergent-désinfectant alimentaire (norme EN 1276)", steps: ["Débarrasser le plan : aliments, ustensiles, papiers.", "Retirer miettes et déchets avec une raclette ou un papier à usage unique.", "Appliquer le détergent-désinfectant avec une lavette propre, frotter.", "Laisser agir le temps indiqué sur le bidon (souvent 5 minutes).", "Rincer à l'eau claire si l'étiquette le demande.", "Laisser sécher à l'air, ou essuyer avec un papier à usage unique."], safety: "Gants. Ne jamais mélanger la javel avec un autre produit." },
  { k: ["sanitaire", "toilette", "wc", "lave-main", "lave main"], product: "Détartrant WC + désinfectant sanitaires", steps: ["Aérer et mettre les gants réservés aux sanitaires.", "Verser le détartrant dans la cuvette et le laisser agir.", "Désinfecter du plus propre au plus sale : lavabo, robinet, poignées, chasse d'eau, cuvette en dernier.", "Frotter la cuvette à la brosse, tirer la chasse.", "Recharger savon, papier toilette et essuie-mains.", "Laver le sol, du fond vers la porte."], safety: "Le matériel des sanitaires ne va jamais en cuisine." },
  { k: ["planche", "ustensile", "couteau", "bac gn", "vaisselle"], product: "Détergent vaisselle + désinfectant, ou lave-vaisselle cycle chaud", steps: ["Retirer les restes alimentaires.", "Prélaver à l'eau chaude.", "Laver au détergent avec une brosse propre.", "Rincer à l'eau claire.", "Désinfecter en respectant le temps de contact, ou passer au lave-vaisselle.", "Rincer, puis laisser sécher à l'air sur un égouttoir.", "Ranger à l'abri de la poussière."], safety: "Une planche rayée en profondeur se remplace : les bactéries s'y logent." },
  { k: ["trancheuse", "robot", "mixeur", "cutter", "hachoir"], product: "Détergent-désinfectant alimentaire", steps: ["Débrancher l'appareil.", "Démonter les pièces amovibles : lame, protège-lame, bol, couvercle.", "Retirer les résidus.", "Laver chaque pièce au détergent, rincer.", "Désinfecter, respecter le temps de contact, rincer.", "Laisser sécher, puis remonter.", "Vérifier que tout est bien remonté avant de rebrancher."], safety: "Appareil débranché. Gants anti-coupure pour manipuler la lame." },
  { k: ["plonge", "evier", "bac", "siphon"], product: "Détergent + désinfectant, détartrant si besoin", steps: ["Vider les bacs et retirer les déchets des crépines.", "Frotter cuves, rebords et robinets au détergent.", "Rincer.", "Désinfecter, respecter le temps de contact.", "Détartrer si des traces blanches apparaissent.", "Rincer et laisser sécher."] },
  { k: ["lave-vaisselle", "lave vaisselle", "machine a laver"], product: "Eau claire + dégraissant", steps: ["Éteindre la machine et la vidanger.", "Retirer les filtres et les rincer sous l'eau.", "Dégraisser les filtres si besoin.", "Démonter les bras de lavage et déboucher les buses.", "Essuyer l'intérieur et le joint de porte.", "Tout remonter.", "Laisser la porte ouverte la nuit pour sécher."], safety: "Machine éteinte et refroidie. Gants." },
  { k: ["sol"], product: "Détergent sol dilué dans l'eau tiède", steps: ["Retirer ce qui est posé au sol.", "Faire un balayage humide (pas de balai sec en cuisine).", "Laver avec le détergent, du fond vers la sortie.", "Pousser l'eau à la raclette vers le siphon.", "Rincer la serpillière et le seau.", "Laisser sécher, poser le panneau « sol glissant »."], safety: "Jamais de sol lavé pendant la production." },
  { k: ["poubelle", "dechet"], product: "Détergent-désinfectant", steps: ["Fermer les sacs et les sortir au local poubelles.", "Laver le bac au détergent : intérieur, couvercle, pédale.", "Désinfecter, respecter le temps de contact.", "Rincer et laisser sécher.", "Mettre un sac neuf.", "Se laver les mains."] },
  { k: ["poignee", "interrupteur", "bouton", "point de contact"], product: "Spray désinfectant + papier à usage unique", steps: ["Pulvériser le désinfectant sur le papier, pas directement sur les interrupteurs.", "Essuyer les poignées : portes, frigos, placards.", "Essuyer les interrupteurs et les boutons du four et de la hotte.", "Essuyer les robinets.", "Changer de papier à chaque zone, le jeter."] },
  { k: ["salle", "table", "chaise"], product: "Désinfectant de surface + détergent sol", steps: ["Débarrasser les tables.", "Nettoyer et désinfecter les tables.", "Essuyer assises et dossiers des chaises.", "Monter les chaises sur les tables.", "Aspirer, puis laver le sol.", "Redescendre les chaises une fois le sol sec."] },
  { k: ["bar", "comptoir", "tireuse", "cafe", "machine a cafe"], product: "Nettoyant machine à café + désinfectant", steps: ["Purger la buse vapeur et l'essuyer avec un chiffon dédié.", "Retirer les porte-filtres, nettoyer le groupe (brossette ou pastille), rincer.", "Faire tremper les filtres.", "Nettoyer les becs de la tireuse à l'eau claire.", "Vider et laver les égouttoirs.", "Désinfecter le comptoir."] },
  { k: ["four", "plaque", "piano", "plancha", "grill"], product: "Dégraissant four", steps: ["Éteindre et laisser tiédir.", "Retirer grilles et plaques, les faire tremper.", "Appliquer le dégraissant sur les surfaces tièdes.", "Laisser agir le temps indiqué.", "Frotter, puis rincer abondamment à l'eau claire.", "Sécher et remettre grilles et plaques."], safety: "Gants et lunettes. Bien ventiler." },
  { k: ["friteuse", "huile"], product: "Filtre à huile + testeur d'huile", steps: ["Éteindre et laisser tiédir l'huile.", "Filtrer l'huile (filtre papier ou chinois).", "Nettoyer la cuve et les résistances.", "Contrôler l'huile : couleur, odeur, ou testeur (changer au-delà de 24 % de composés polaires).", "Remettre l'huile filtrée ou la remplacer.", "Noter la date si l'huile est changée."], safety: "Jamais d'eau dans l'huile chaude." },
  { k: ["degivr", "congel"], product: "Détergent-désinfectant, glacière", steps: ["Mettre les produits en glacière ou dans un autre congélateur.", "Débrancher, poser un bac pour l'eau.", "Laisser dégivrer, sans objet pointu.", "Laver parois et joints au détergent-désinfectant.", "Rincer et bien sécher.", "Rebrancher, attendre −18 °C.", "Remettre les produits."], safety: "Produits hors froid 30 minutes au maximum." },
  { k: ["chambre froide", "frigo", "refrigerateur", "clayette", "vitrine"], product: "Détergent-désinfectant alimentaire", steps: ["Sortir les produits dans une autre enceinte froide.", "Jeter les produits périmés ou sans étiquette.", "Retirer les clayettes.", "Laver parois, clayettes et joints au détergent-désinfectant.", "Rincer et sécher.", "Remettre les produits couverts et étiquetés, les plus anciens devant.", "Vérifier la température."], safety: "Produits hors froid 30 minutes au maximum." },
  { k: ["hotte", "filtre"], product: "Bain dégraissant chaud ou lave-vaisselle", steps: ["Éteindre la hotte.", "Démonter les filtres.", "Les passer au lave-vaisselle ou dans un bain dégraissant chaud.", "Dégraisser l'intérieur de la hotte.", "Rincer et sécher les filtres.", "Remonter les filtres."], safety: "Gants. Attention aux bords coupants." },
];
const MEN_GD_BASE = { product: "Détergent-désinfectant alimentaire", steps: ["Retirer aliments et objets de la zone.", "Nettoyer au détergent pour enlever les salissures.", "Rincer à l'eau claire.", "Désinfecter, respecter le temps de contact.", "Rincer si l'étiquette le demande.", "Laisser sécher à l'air."], generic: true };
const menNoAcc = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function menGuideOf(c) {
  const n = menNoAcc(`${c.name} ${c.zone || ""}`);
  const lib = MEN_GUIDES.find((g) => g.k.some((k) => menNoAcc(c.name).includes(k))) || MEN_GUIDES.find((g) => g.k.some((k) => n.includes(k))) || MEN_GD_BASE;
  const own = Array.isArray(c.steps) && c.steps.filter(Boolean).length ? c.steps.filter(Boolean) : null;
  return { product: c.notes || lib.product || "", steps: own || lib.steps, safety: lib.safety || "", generic: !own && !!lib.generic, lib };
}
/* « ne plus afficher » choices: per restaurant and per person, on this device */
const menGdKey = () => `${S.rid || ""}|${(S.me && S.me.id) || ""}`;
function menGdOff() { try { return JSON.parse(localStorage.getItem("gg-men-gd-off") || "{}")[menGdKey()] || []; } catch (e) { return []; } }
function menGdSetOff(cid, off) {
  try { const all = JSON.parse(localStorage.getItem("gg-men-gd-off") || "{}"); const L = new Set(all[menGdKey()] || []); off ? L.add(cid) : L.delete(cid); all[menGdKey()] = [...L]; localStorage.setItem("gg-men-gd-off", JSON.stringify(all)); } catch (e) {}
}
function menGuideSheet(c, v) {
  const g = menGuideOf(c); const off = menGdOff().includes(c.id);
  const meta = [c.zone, menFreqTx(c)].filter(Boolean).map(esc).join(" · ");
  return `<div class="men-gd">
    <div class="men-gd-hd"><span class="men-gd-ic">${ico("book")}</span><div class="tx"><span class="lbl">Comment faire</span><b>${esc(c.name)}</b>${meta ? `<em>${meta}</em>` : ""}</div></div>
    ${g.product ? `<div class="men-gd-prod">${ico("menDrop")}<div><span class="lbl">Produit</span><p>${esc(g.product)}</p></div></div>` : ""}
    <ol class="men-gd-steps">${g.steps.map((s, i) => `<li class="st" style="--i:${i}"><span class="mono">${i + 1}</span><p>${esc(s)}</p></li>`).join("")}</ol>
    ${g.safety ? `<div class="men-gd-safe">${ico("alert")}<p>${esc(g.safety)}</p></div>` : ""}
    ${g.generic ? `<div class="men-gd-gen"><p>Méthode générale : aucune notice précise pour cette tâche.</p><button class="btn soft sm" data-act="menGdEdit" data-id="${c.id}">${ico("edit")}Écrire la notice</button></div>` : ""}
    <label class="men-gd-hide"><input type="checkbox" id="menGdHide" data-act="menGdToggle" data-id="${c.id}" ${off ? "checked" : ""}><i aria-hidden="true">${menCheckSvg}</i><span>Ne plus afficher pour cette tâche</span></label>
    <div class="men-sfoot">${v ? `<div class="grid2"><button class="btn soft" data-act="sheetClose">Plus tard</button><button class="btn acc" data-act="menGdOk" data-v="${esc(v)}">${ico("check")}C'est fait</button></div>` : `<button class="btn acc block" data-act="sheetClose">J'ai compris</button>`}</div>
  </div>`;
}
Object.assign(ACT, {
  menGuide: (a, id) => { const raw = S.chores.find((x) => x.id === id); if (!raw) return; SFX.sheet ? SFX.sheet() : SFX.tap(); openSheet(menGuideSheet(menNorm(raw))); },
  menGdToggle: (a, id) => { menGdSetOff(id, !!a.checked); SFX.tick(); buzz(4); },
  menGdOk: (a, id, v) => { closeSheet(true); M.gdPass = v; const row = $(`.men-row[data-v="${CSS.escape(v)}"]`); return ACT.menDo(row || a, null, v); },
  menGdEdit: (a, id) => { closeSheet(true); setTimeout(() => ACT.menEdit(a, id), 280); },
  menGdReset: () => { try { const all = JSON.parse(localStorage.getItem("gg-men-gd-off") || "{}"); delete all[menGdKey()]; localStorage.setItem("gg-men-gd-off", JSON.stringify(all)); } catch (e) {} SFX.tick(); toast("Les notices s'afficheront à nouveau"); },
});
