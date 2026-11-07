/* Growth Gusto — area: heures sup. et temps de travail (prefix « hs »). No route of its own: a card in Planning and in Employés
   (managers), a settings sheet, and a push notification « heures » to the managers chosen by the gérant.
   What is watched, per active employee, from the time clock (punches) and the planning (shifts), with the same maths as js/rh.js:
     - the manager's thresholds of overtime (hours beyond 35 h a week, HCR): per week, per month (weeks whose Sunday is in the month,
       like the payroll export), per year (civil year, same rule);
     - the legal frame (HCR, indicative): 48 h in a week, 46 h on average over 12 weeks, the daily maximum (11 h in the kitchen,
       11 h 30 otherwise, 12 h night watch), 11 h of rest between two days, the annual quota of 360 overtime hours.
   Each finding is « done » (already clocked) or « ahead » (it will happen if the planning is followed: clocked + what is planned for the
   rest of the period), plus an « approaching » note (44 h clocked in the week, 44 h on average, 90 % of the annual quota).
   Data:
     restos/{rid}.hsCfg  { on, week:{on,h}, month:{on,h}, year:{on,h}, legal, soon, to:[memberId]|null }   (gérant writes it)
     restos/{rid}/hsAlerts/{key}  { staffId, name, rule, lvl:"warn"|"bad", fut, period, title, body, at, by, seen, seenBy?, seenAt? }
       key is deterministic (person + rule + period + done/ahead), so a finding is written once: the server sends the notification on
       creation only (functions/src/notifs.js onHsAlertNotif), to hsCfg.to (gérants and chefs only) or, by default, every gérant.
   Who computes: every signed-in device of the restaurant (the time-clock tablet too), a few seconds after the data changes (at most
   every 30 s, and every 10 min anyway for a session that is running). Demo and no-account mode: banners on this device. */
"use strict";

Object.assign(IC, {
  hsGauge: ["M12 14l4-4", "M3.3 19a10 10 0 1 1 17.4 0", "f:M3.3 19a10 10 0 1 1 17.4 0z", "c:12,14,1.6"],
  hsScale: ["M12 3v18", "M7 21h10", "M5 7h14", "M5 7l-3 7a3.5 3.5 0 0 0 6 0z", "M19 7l-3 7a3.5 3.5 0 0 0 6 0z", "f:M2 14a3.5 3.5 0 0 0 6 0z", "f:M16 14a3.5 3.5 0 0 0 6 0z"],
});

const HS_DEF = { on: true, week: { on: true, h: 8 }, month: { on: true, h: 30 }, year: { on: true, h: 300 }, legal: true, soon: true, to: null };
/* HCR repères (minutes or hours), see the « legal reminders » block of js/rh.js */
const HS_L = { week: 48 * 60, weekSoon: 44 * 60, avg: 46 * 60, avgSoon: 44 * 60, quota: 360 * 60, quotaSoon: 0.9 };
const HS_STEP = { week: [1, 1, 30], month: [5, 5, 150], year: [10, 20, 500] };
const HS = { rid: null, docs: [], ready: false, sig: "", lastRun: 0, stat: {}, statAt: 0, busy: false, t: null };

function hsCfg(r = S.resto) {
  const c = (r && r.hsCfg) || {};
  return { ...HS_DEF, ...c, week: { ...HS_DEF.week, ...(c.week || {}) }, month: { ...HS_DEF.month, ...(c.month || {}) }, year: { ...HS_DEF.year, ...(c.year || {}) } };
}
const hsMgr = () => typeof rhIsMgr === "function" && rhIsMgr();
const hsCanEdit = () => myRole() === "gerant";
const hsMonthName = (k) => MONTHS[parseDay(k).getMonth()];

/* ───────── periods ───────── */
/* weeks of a civil year (their Sunday is in the year), up to `last` */
function hsYearWeeks(y, last) {
  const a = `${y}-01-01`, b = `${y}-12-31`; let mon = rhMonday(a); if (addDays(mon, 6) < a) mon = addDays(mon, 7);
  const out = []; while (addDays(mon, 6) <= b && mon <= last) { out.push(mon); mon = addDays(mon, 7); } return out;
}
/* the weeks where this person has something (a punch or a shift): the others count 0, no need to compute them */
function hsBusyWeeks() {
  const m = {}; const add = (sid, d) => { if (!sid || !d) return; (m[sid] ||= new Set()).add(rhMonday(d)); };
  S.punches.forEach((p) => { if (!p.void) add(p.staffId, p.day); }); S.shifts.forEach((s) => add(s.staffId, s.day));
  return m;
}
/* one week: overtime already clocked (done) and with the rest of the planning (ahead), in minutes */
function hsWeek(sid, mon, busy) {
  if (busy && !busy.has(mon)) return { done: 0, ahead: 0, work: 0, proj: 0, has: false };
  const h = rhWeekHours(sid, mon); const work = h.has ? h.punch : 0;
  return { done: rhOT(work).h * 60, ahead: rhOT(h.used).h * 60, work, proj: h.used, has: h.has };
}
/* everything the card and the checks need for one person */
function hsStatOf(p, busyAll) {
  const busy = busyAll[p.id] || new Set(); const today = dayKey(); const mon = rhMonday(today); const y = +today.slice(0, 4);
  const sum = (weeks) => weeks.reduce((o, w) => { const x = hsWeek(p.id, w, busy); o.done += x.done; o.ahead += x.ahead; return o; }, { done: 0, ahead: 0 });
  const week = hsWeek(p.id, mon, busy);
  const m0 = today.slice(0, 8) + "01"; const month = sum(typeof rhPayWeeks === "function" ? rhPayWeeks(m0) : [mon]);
  /* the year: every week until the next five (the planning rarely goes further) */
  const year = sum(hsYearWeeks(y, addDays(mon, 35)));
  return { p, mon, m0, y, week, month, year };
}

/* ───────── findings ───────── */
const hsDur = (m) => rhDur(m);
function hsFindings(st, cfg) {
  const { p, mon, m0, y } = st; const sid = p.id; const fn = rhFirst(p); const out = [];
  const push = (rule, per, lvl, fut, title, body) => out.push({ key: `${sid}_${rule}_${per}_${fut ? "p" : "r"}`.replace(/[^\w-]/g, "-"), staffId: sid, name: p.name, rule, period: per, lvl, fut, title, body });
  /* the manager's thresholds */
  const TH = [["week", st.week, "cette semaine", mon], ["month", st.month, `en ${hsMonthName(m0)}`, m0.slice(0, 7)], ["year", st.year, `depuis janvier ${y}`, String(y)]];
  TH.forEach(([k, v, when, per]) => {
    const c = cfg[k]; if (!c || !c.on || !(+c.h > 0)) return; const lim = +c.h * 60;
    if (v.done > lim) push("s" + k, per, "warn", false, `${fn} a dépassé votre seuil d'heures sup.`, `${hsDur(v.done)} sup. ${when} (seuil ${hsDur(lim)})`);
    else if (cfg.soon && v.ahead > lim) push("s" + k, per, "warn", true, `${fn} va dépasser votre seuil d'heures sup.`, `D'après le planning : ${hsDur(v.ahead)} sup. ${when} (seuil ${hsDur(lim)})`);
  });
  if (!cfg.legal) return out;
  /* the legal frame, this week and the next one (planning ahead) */
  [mon, addDays(mon, 7)].forEach((w, wi) => {
    const h = rhHoursOf(p, w); const lbl = wi ? `la semaine du ${rhWeekLbl(w)}` : "cette semaine";
    const work = h.has ? h.punch : 0;
    if (work > HS_L.week) push("l48", w, "bad", false, `${fn} sort du cadre légal`, `${hsDur(work)} pointées ${lbl} : 48 h maximum (HCR)`);
    else if (cfg.soon && h.used > HS_L.week) push("l48", w, "bad", true, `${fn} va sortir du cadre légal`, `D'après le planning : ${hsDur(h.used)} ${lbl}, 48 h maximum (HCR)`);
    else if (cfg.soon && !wi && work >= HS_L.weekSoon) push("l48s", w, "warn", false, `${fn} approche des 48 h`, `${hsDur(work)} pointées cette semaine : plus que ${hsDur(HS_L.week - work)} avant le maximum légal`);
    /* what is clocked: one alert per day; what is only planned: one alert per week and rule, naming the days */
    const ahead = { lrest: [], lday: [] };
    h.alerts.forEach((a) => {
      if (a.lvl !== "bad") return; const fut = a.src === "prévu";
      const rule = /^Repos/.test(a.t) ? "lrest" : / de travail ce jour/.test(a.t) ? "lday" : / en moyenne /.test(a.t) ? "lavg" : null; if (!rule) return;
      if (rule === "lavg") { if (!wi) push(rule, w, "bad", false, `${fn} sort du cadre légal`, a.t); return; }
      if (fut) { if (cfg.soon && a.d) ahead[rule].push(a.d); return; }
      push(rule, a.d || w, "bad", false, `${fn} sort du cadre légal`, `${a.d ? `${rhDayLbl(a.d, true)} · ` : ""}${a.t}`);
    });
    const days = (L) => L.sort().map((d) => RH_DLONG[(parseDay(d).getDay() + 6) % 7].toLowerCase()).join(", ").replace(/, ([^,]*)$/, " et $1");
    if (ahead.lrest.length) push("lrest", w, "bad", true, `${fn} va sortir du cadre légal`, `D'après le planning ${lbl} : moins de 11 h de repos avant ${days(ahead.lrest)}`);
    if (ahead.lday.length) push("lday", w, "bad", true, `${fn} va sortir du cadre légal`, `D'après le planning ${lbl} : journée trop longue ${days(ahead.lday)} (${rhDayCap(p, p.post === "cuisine")[1]})`);
    if (!wi && cfg.soon && h.a12.n >= 4 && h.a12.avg >= HS_L.avgSoon && h.a12.avg <= HS_L.avg) push("lavgs", w, "warn", false, `${fn} approche de 46 h en moyenne`, `${rhHh(h.a12.avg)} en moyenne sur ${h.a12.n} semaines : 46 h maximum sur 12 semaines (HCR)`);
  });
  /* the annual quota of overtime (contingent HCR) */
  const q = st.year;
  if (q.done > HS_L.quota) push("lq", String(y), "bad", false, `${fn} dépasse le contingent annuel`, `${hsDur(q.done)} sup. depuis janvier : 360 h par an (HCR), au-delà il faut une contrepartie en repos`);
  else if (cfg.soon && q.ahead > HS_L.quota) push("lq", String(y), "bad", true, `${fn} va dépasser le contingent annuel`, `D'après le planning : ${hsDur(q.ahead)} sup. sur l'année, 360 h maximum (HCR)`);
  else if (cfg.soon && q.done >= HS_L.quota * HS_L.quotaSoon) push("lqs", String(y), "warn", false, `${fn} approche du contingent annuel`, `${hsDur(q.done)} sup. depuis janvier : plus que ${hsDur(HS_L.quota - q.done)} avant 360 h`);
  return out;
}
/* a finding already sent (or its « done » version when this one is only « ahead ») */
function hsKnown(have, f) { return have.has(f.key) || (f.fut && have.has(f.key.replace(/_p$/, "_r"))); }

/* ───────── run ───────── */
function hsAttach() {
  if (!S.rid || !S.resto || HS.rid === S.rid) return;
  const rid = S.rid; HS.rid = rid; HS.ready = false; HS.docs = []; HS.sig = ""; HS.stat = {};
  DB.watch("hsAlerts", { order: "at", dir: "desc", limit: 300 }, (rows) => {
    if (S.rid !== rid) return; const was = HS.ready; HS.docs = rows; HS.ready = true;
    if (!was) hsSoon(1500); if (["planning", "staff"].includes(S.route)) refresh();
  });
}
function hsSig() {
  let h = 0; const mix = (s) => { for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; };
  S.punches.forEach((p) => mix(`${p.id}${p.at}${p.void ? 1 : 0}`)); S.shifts.forEach((s) => mix(`${s.id}${s.staffId}${s.day}${s.start}${s.end}${s.breakMin || 0}`));
  S.staff.forEach((s) => mix(`${s.id}${s.active}${s.post}${s.role}`)); mix(JSON.stringify(hsCfg())); mix(dayKey());
  return String(h);
}
function hsStats() {
  const busy = hsBusyWeeks(); const st = {};
  rhPeople().forEach((p) => { try { st[p.id] = hsStatOf(p, busy); } catch (e) { console.warn("hs", p.id, e); } });
  HS.stat = st; HS.statAt = Date.now(); return st;
}
async function hsRun(force) {
  hsAttach();
  if (HS.busy || !S.rid || !S.resto || !HS.ready || HS.rid !== S.rid || typeof rhPeople !== "function") return;
  const cfg = hsCfg(); if (!cfg.on) return;
  const sig = hsSig(); if (!force && sig === HS.sig && Date.now() - HS.lastRun < 10 * 60e3) return;
  HS.busy = true; HS.sig = sig; HS.lastRun = Date.now();
  try {
    const st = hsStats(); const have = new Set(HS.docs.map((d) => d.id)); const fresh = [];
    Object.values(st).forEach((x) => hsFindings(x, cfg).forEach((f) => { if (!hsKnown(have, f)) { have.add(f.key); fresh.push(f); } }));
    /* legal first, then the thresholds; a burst (first run on a busy month) stays readable */
    fresh.sort((a, b) => (a.lvl === "bad" ? 0 : 1) - (b.lvl === "bad" ? 0 : 1) || (a.fut ? 1 : 0) - (b.fut ? 1 : 0));
    /* one push per person and per run: the most serious finding carries « et N autres », the others are written quiet */
    const now = Date.now(); const list = fresh.slice(0, 40); const lead = {};
    list.forEach((f) => { if (!lead[f.staffId]) lead[f.staffId] = f; else { f.quiet = true; lead[f.staffId].more = (lead[f.staffId].more || 0) + 1; } });
    for (const f of list) {
      const { key, ...doc } = f;
      await DB.set("hsAlerts", key, { ...doc, at: now, by: S.me.id || "", seen: false });
    }
    /* no server here (demo, no account): the managers of this device see it as a banner */
    const L = Object.values(lead);
    if (L.length && DB.mode !== "db" && hsMgr() && typeof puBanner === "function") {
      const f = L[0]; const n = list.length - 1;
      puBanner({ kind: "heures", title: f.title, body: n ? `${f.body} · et ${n} autre${n > 1 ? "s" : ""} alerte${n > 1 ? "s" : ""}` : f.body, url: "./?go=planning", demo: DB.mode === "demo" });
    }
  } catch (e) { console.warn("hs run", e); }
  finally { HS.busy = false; }
}
function hsSoon(ms = 4000) { clearTimeout(HS.t); HS.t = setTimeout(() => { hsAttach(); hsRun(); }, ms); }
window.addEventListener("gg:ready", () => hsSoon(5000));
setInterval(() => { try { hsAttach(); hsRun(); } catch (e) {} }, 30000);

/* ───────── card (Planning, Employés) ───────── */
const hsOpen = () => HS.docs.filter((d) => !d.seen).sort((a, b) => (b.at || 0) - (a.at || 0));
function hsBar(v, lim, lbl, sub) {
  const pct = lim ? Math.min(100, Math.round(v / lim * 100)) : 0; const proj = lim && sub > v ? Math.min(100, Math.round(sub / lim * 100)) : 0;
  const cls = lim && v > lim ? "over" : lim && v >= lim * 0.8 ? "near" : "";
  return `<span class="hs-m ${cls}"><em>${lbl}</em><span class="hs-bar"><i class="hs-proj" style="width:${proj}%"></i><i style="width:${pct}%"></i></span><b class="mono">${rhHh(v)}${lim ? `<small>/${rhHh(lim)}</small>` : ""}${sub > v + 1 ? `<small class="hs-ah"> → ${rhHh(sub)}</small>` : ""}</b></span>`;
}
const hsRank = (d) => (d.lvl === "bad" ? 0 : 2) + (d.fut ? 1 : 0);
/* unseen alerts grouped by person, most serious first */
function hsByPerson(open = hsOpen()) {
  const g = {}; open.forEach((d) => (g[d.staffId] ||= []).push(d));
  return Object.entries(g).map(([sid, L]) => ({ sid, L: L.sort((a, b) => hsRank(a) - hsRank(b) || (b.at || 0) - (a.at || 0)) })).sort((a, b) => hsRank(a.L[0]) - hsRank(b.L[0]) || (b.L[0].at || 0) - (a.L[0].at || 0));
}
const hsIc = (d) => `<span class="al-ic sm ${d.lvl === "bad" ? "bad" : "warn"}">${ico(d.rule && d.rule[0] === "l" ? "hsScale" : "hsGauge")}</span>`;
const hsAgo = (d) => `${d.fut ? "Prévu au planning · " : ""}${typeof alAgo === "function" ? alAgo(d.at) : when(d.at)}`;
function hsAlertRow({ sid, L }, i) {
  const d = L[0];
  return `<div class="hs-al ${d.lvl === "bad" ? "bad" : "warn"} st" style="--i:${i + 6}">
    ${hsIc(d)}
    <button class="hs-al-t" data-act="hsPerson" data-id="${esc(sid)}"><b>${esc(d.title)}</b><em>${esc(d.body || "")}</em><u>${hsAgo(d)}${L.length > 1 ? ` · <span class="hs-plus">et ${L.length - 1} autre${L.length > 2 ? "s" : ""}</span>` : ""}</u></button>
    <button class="hs-seen" data-act="hsSeenP" data-id="${esc(sid)}" aria-label="Marquer comme vu">${ico("check")}<span>Vu</span></button>
  </div>`;
}
/* one person's alerts, then their hours of the week */
function hsPersonHTML(sid) {
  const p = rhStaff(sid) || { name: (HS.docs.find((d) => d.staffId === sid) || {}).name || "?" }; const L = (hsByPerson().find((x) => x.sid === sid) || { L: [] }).L;
  const seen = HS.docs.filter((d) => d.staffId === sid && d.seen).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6);
  const row = (d) => `<div class="hs-pa ${d.seen ? "seen" : ""}">${hsIc(d)}<div><b>${esc(d.title)}</b><em>${esc(d.body || "")}</em><u>${hsAgo(d)}${d.seen ? " · vu" : ""}</u></div></div>`;
  return `<div class="hs-person">
    <div class="rh-act-hd">${rhAva(p, 52)}<div><div class="h2">${esc(p.name)}</div><div class="sub">${L.length ? `${L.length} alerte${L.length > 1 ? "s" : ""} à voir` : "Rien de nouveau"}</div></div></div>
    ${L.length ? `<div class="hs-pas">${L.map(row).join("")}</div>` : ""}
    ${seen.length ? `<div class="lbl">Déjà vues</div><div class="hs-pas">${seen.map(row).join("")}</div>` : ""}
    <div class="hs-pbtn">${rhStaff(sid) ? `<button class="btn soft" data-act="rhHrOpen" data-id="${esc(sid)}">${ico("clock")}Ses heures de la semaine</button>` : ""}${L.length ? `<button class="btn acc" data-act="hsSeenP" data-id="${esc(sid)}" data-v="sheet">${ico("check")}Marquer comme vu</button>` : ""}</div>
  </div>`;
}
function hsCard() {
  if (!hsMgr() || !S.resto) return "";
  hsAttach(); const cfg = hsCfg();
  if (!cfg.on) return `<div class="glass hs-card off st" style="--i:5"><div class="hs-hd"><span class="al-ic sm vio">${ico("hsGauge")}</span><div><div class="h3">Heures sup. et temps de travail</div><div class="sub">Surveillance coupée</div></div><button class="btn soft sm" data-act="hsCfgOpen">${ico("sliders")}<span>Réglages</span></button></div></div>`;
  const st = Date.now() - HS.statAt < 60e3 && Object.keys(HS.stat).length ? HS.stat : hsStats();
  const open = hsOpen(); const nBad = open.filter((d) => d.lvl === "bad").length; const grp = hsByPerson(open);
  const ppl = Object.values(st).filter((x) => x.week.ahead || x.month.ahead || x.year.done || x.week.proj >= HS_L.weekSoon)
    .sort((a, b) => b.month.ahead - a.month.ahead || b.year.done - a.year.done).slice(0, S.ui.hsAll ? 40 : 4);
  const nPpl = Object.values(st).filter((x) => x.week.ahead || x.month.ahead || x.year.done).length;
  const lim = (k) => (cfg[k].on ? +cfg[k].h * 60 : 0);
  const rows = ppl.map((x, i) => `<button class="hs-p st" style="--i:${i + 12}" data-act="rhHrOpen" data-id="${esc(x.p.id)}">
      <span class="hs-pw">${rhAva(x.p, 34)}<span><b>${esc(rhFirst(x.p))}</b><em>${rhHh(x.week.proj)} cette semaine${x.week.proj > x.week.work && x.week.has ? ` · ${rhHh(x.week.work)} pointées` : ""}</em></span></span>
      <span class="hs-ms">${hsBar(x.week.done, lim("week"), "Semaine", x.week.ahead)}${hsBar(x.month.done, lim("month"), hsMonthName(x.m0).replace(/^./, (c) => c.toUpperCase()), x.month.ahead)}${hsBar(x.year.done, lim("year") || HS_L.quota, String(x.y), x.year.ahead)}</span>
    </button>`).join("");
  return `<div class="glass hs-card${open.length ? (nBad ? " bad" : " warn") : ""} st" style="--i:5" id="hsCard">
    <div class="hs-hd"><span class="al-ic sm ${open.length ? (nBad ? "bad" : "warn") : "ok"}">${ico("hsGauge")}</span>
      <div><div class="h3">Heures sup. et temps de travail</div><div class="sub">${open.length ? `${grp.length} personne${grp.length > 1 ? "s" : ""} à surveiller${nBad ? ` · ${nBad} alerte${nBad > 1 ? "s" : ""} légale${nBad > 1 ? "s" : ""}` : ""}` : nPpl ? `Rien qui dépasse vos seuils ni le cadre légal` : "Pas encore d'heures sup. cette année"}</div></div>
      <button class="btn soft sm" data-act="hsCfgOpen">${ico("sliders")}<span>Réglages</span></button></div>
    ${grp.length ? `<div class="hs-als">${grp.slice(0, S.ui.hsAllAl ? 40 : 3).map(hsAlertRow).join("")}</div>
      <div class="hs-more">${grp.length > 3 ? `<button class="btn ghost sm" data-act="hsAllAl">${S.ui.hsAllAl ? "Réduire" : `Voir les ${grp.length} personnes`}</button>` : ""}${open.length > 1 ? `<button class="btn ghost sm" data-act="hsSeenAll">Tout marquer comme vu</button>` : ""}</div>` : ""}
    ${rows ? `<div class="hs-ps"><div class="hs-leg"><b>Heures sup.</b><span><i></i>pointées</span><span><i class="p"></i>avec le planning</span><span class="r">/ ${cfg.year.on ? "votre seuil" : "seuil, 360 h par an (HCR)"}</span></div>${rows}</div>
      ${nPpl > 4 ? `<button class="btn ghost sm hs-all" data-act="hsAll">${S.ui.hsAll ? "Réduire" : `Voir les ${nPpl} personnes`}</button>` : ""}` : ""}
    <p class="note">Heures sup. comptées au-delà de 35 h par semaine (HCR). Vous êtes prévenu une fois par alerte${cfg.soon ? ", et à l'avance quand le planning y mène" : ""}. Indicatif, à vérifier avec votre comptable.</p>
  </div>`;
}

/* ───────── settings sheet ───────── */
function hsManagers() { return (S.members || []).filter((m) => m.role === "gerant" || m.role === "chef").sort((a, b) => (a.role === "gerant" ? 0 : 1) - (b.role === "gerant" ? 0 : 1) || String(a.name || "").localeCompare(String(b.name || ""), "fr")); }
function hsTo(cfg = hsCfg()) { const mg = hsManagers(); const ids = mg.map((m) => m.id); const to = Array.isArray(cfg.to) && cfg.to.length ? cfg.to.filter((x) => ids.includes(x)) : null; return to && to.length ? to : mg.filter((m) => m.role === "gerant").map((m) => m.id); }
function hsCfgHTML() {
  const c = hsCfg(); const ed = hsCanEdit(); const dis = ed ? "" : ' aria-disabled="true"';
  const sw = (on) => (typeof alSw === "function" ? alSw(on) : `<span class="al-sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span>`);
  const th = (k, t, sub) => { const v = c[k]; return `<div class="hs-th${v.on ? "" : " off"}">
      <div class="li tap" data-act="hsTog" data-v="${k}" role="switch" aria-checked="${!!v.on}"${dis}><div class="tx"><b>${t}</b><em>${sub(v.h)}</em></div>${sw(v.on)}</div>
      ${v.on ? `<div class="hs-step"><button class="iconbtn" data-act="hsStep" data-v="${k}" data-d="-1" aria-label="Moins"${ed ? "" : " disabled"}>${ico("minus")}</button><b class="mono">${v.h} h</b><button class="iconbtn" data-act="hsStep" data-v="${k}" data-d="1" aria-label="Plus"${ed ? "" : " disabled"}>${ico("plus")}</button><em>d'heures sup.</em></div>` : ""}
    </div>`; };
  const to = new Set(hsTo(c)); const mg = hsManagers();
  return `<div class="hs-cfg">
    <div class="rh-act-hd"><span class="al-ic">${ico("hsGauge")}</span><div><div class="h2">Heures sup.</div><div class="sub">Vous êtes prévenu avant que ça déborde</div></div></div>
    ${ed ? "" : `<div class="banner">${ico("lock")}<span>Seul le gérant change ces réglages.</span></div>`}
    <div class="li tap" data-act="hsTog" data-v="on" role="switch" aria-checked="${c.on}"${dis}><span class="al-ic sm vio">${ico("puBell")}</span><div class="tx"><b>Surveiller les heures de l'équipe</b><em>${c.on ? "Pointeuse et planning vérifiés en continu" : "Coupé : aucune alerte"}</em></div>${sw(c.on)}</div>
    ${c.on ? `<div class="lbl">Vos seuils, par personne</div>
    ${th("week", "Par semaine", (h) => `Au-delà de ${35 + h} h de travail dans la semaine`)}
    ${th("month", "Par mois", () => "Les semaines du mois, comme l'export paie")}
    ${th("year", "Par an", (h) => `Depuis janvier · le contingent légal HCR est de 360 h${h >= 360 ? " : votre seuil est au-delà" : ""}`)}
    <div class="lbl">Cadre légal</div>
    <div class="li tap" data-act="hsTog" data-v="legal" role="switch" aria-checked="${c.legal}"${dis}><span class="al-ic sm bad">${ico("hsScale")}</span><div class="tx"><b>Prévenir avant de sortir du cadre légal</b><em>48 h par semaine, 46 h en moyenne sur 12 semaines, 11 h ou 11 h 30 par jour, 11 h de repos, 360 h sup. par an</em></div>${sw(c.legal)}</div>
    <div class="li tap" data-act="hsTog" data-v="soon" role="switch" aria-checked="${c.soon}"${dis}><span class="al-ic sm warn">${ico("cal")}</span><div class="tx"><b>Prévenir à l'avance</b><em>${c.soon ? "Dès que le planning y mène, et à l'approche des 48 h" : "Seulement quand c'est pointé"}</em></div>${sw(c.soon)}</div>
    <div class="lbl">Qui est prévenu</div>
    ${mg.map((m) => `<div class="li tap" data-act="hsTo" data-id="${esc(m.id)}" role="switch" aria-checked="${to.has(m.id)}"${dis}>${typeof avatar === "function" ? avatar(m.id) : ""}<div class="tx"><b>${esc(m.name || m.email || "Sans nom")}</b><em>${ROLES[m.role] || ""}</em></div>${sw(to.has(m.id))}</div>`).join("") || `<p class="sub">Aucun gérant ni chef dans l'équipe.</p>`}
    <p class="note">Une notification par alerte, sur les téléphones où les notifications sont activées (catégorie « Heures sup. »). <button class="btn ghost sm" data-act="hsNotifs">Mes notifications</button></p>` : ""}
    <p class="note">Repères de la convention HCR, donnés à titre indicatif : l'app ne bloque jamais un pointage ni un créneau.</p>
  </div>`;
}
async function hsSave(patch) {
  if (!hsCanEdit()) { toast("Seul le gérant change ces réglages.", "err"); return; }
  const c = { ...hsCfg(), ...patch }; const doc = { on: !!c.on, week: c.week, month: c.month, year: c.year, legal: !!c.legal, soon: !!c.soon, to: Array.isArray(c.to) ? c.to : null };
  if (S.resto) S.resto.hsCfg = doc; await safe(DB.update("restos", S.rid, { hsCfg: doc }));
  HS.sig = ""; HS.statAt = 0; SFX.tick(); buzz(5); openSheet(hsCfgHTML()); rerender(); hsSoon(2500);
}

Object.assign(ACT, {
  hsCfgOpen: () => { SFX.tap(); openSheet(hsCfgHTML()); },
  hsTog: (a, id, v) => { const c = hsCfg(); if (["week", "month", "year"].includes(v)) return hsSave({ [v]: { ...c[v], on: !c[v].on } }); if (["on", "legal", "soon"].includes(v)) return hsSave({ [v]: !c[v] }); },
  hsStep: (a, id, v) => { const c = hsCfg(); const [st, mn, mx] = HS_STEP[v] || [1, 1, 99]; const d = +((a && a.dataset && a.dataset.d) || 1); const h = Math.max(mn, Math.min(mx, Math.round((+c[v].h || 0) / st) * st + d * st)); if (h === c[v].h) return; hsSave({ [v]: { ...c[v], h } }); },
  hsTo: (a, id) => { const cur = new Set(hsTo()); if (cur.has(id)) { if (cur.size === 1) { toast("Gardez au moins une personne prévenue.", "info"); return; } cur.delete(id); } else cur.add(id); hsSave({ to: [...cur] }); },
  hsNotifs: () => { closeSheet(); go("notifs"); },
  hsPerson: (a, id) => { SFX.tap(); openSheet(hsPersonHTML(id)); },
  hsSeenP: async (a, id, v) => { const L = hsOpen().filter((d) => d.staffId === id); if (!L.length) return; L.forEach((d) => { d.seen = true; }); SFX.tick(); buzz(5); if (v === "sheet") closeSheet(); rerender(); for (const d of L) await safe(DB.update("hsAlerts", d.id, { seen: true, seenBy: S.me.id || "", seenAt: Date.now() })); },
  hsSeenAll: async () => { const L = hsOpen(); L.forEach((d) => { d.seen = true; }); SFX.tick(); rerender(); for (const d of L) await DB.update("hsAlerts", d.id, { seen: true, seenBy: S.me.id || "", seenAt: Date.now() }); toast(`${L.length} alerte${L.length > 1 ? "s" : ""} marquée${L.length > 1 ? "s" : ""} comme vue${L.length > 1 ? "s" : ""}`); },
  hsAll: () => { S.ui.hsAll = !S.ui.hsAll; rerender(); },
  hsAllAl: () => { S.ui.hsAllAl = !S.ui.hsAllAl; rerender(); },
});
