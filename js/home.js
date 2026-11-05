/* Growth Gusto — area: home ("Aujourd'hui", le cockpit du cuisinier) */
Object.assign(IC, {
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  up: ["m18 15-6-6-6 6"],
  activity: ["M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"],
});

/* ── data helpers (guarded: other areas own these globals and may change them) ── */
function homeChoresDue() {
  if (typeof choresDue === "function") { try { return choresDue() || []; } catch (e) {} }
  const now = Date.now(); const span = { jour: 0, semaine: 7, mois: 30 };
  return S.chores.filter((c) => { const last = S.choreLogs.find((l) => l.choreId === c.id); if (!last) return true; if (c.freq === "jour") return last.day !== dayKey(); return now - last.at > (span[c.freq] || 0) * 864e5 - 36e5; });
}
function homeChoreStats() {
  const due = homeChoresDue();
  if (typeof menDayStats === "function") {
    try {
      const m = menDayStats();
      if (m && m.total != null && m.done != null) { const total = +m.total || 0, done = Math.min(+m.done || 0, total); return { due, done, total, pct: m.pct != null ? Math.round(m.pct) : total ? Math.round((done / total) * 100) : null }; }
    } catch (e) {}
  } const dueIds = new Set(due.map((c) => c.id)); let doneIds;
  if (typeof menToday === "function") {
    // same source as menage: today's moments + this week's / month's items, so a weekly task done on Monday still counts
    try { const { groups, week } = menToday(); doneIds = new Set([...groups.ouverture, ...groups.midi, ...groups.fermeture, ...week].filter((o) => o.st === "done" || o.st === "late").map((o) => o.c.id)); } catch (e) {}
  }
  if (!doneIds) { const today = dayKey(); doneIds = new Set(S.choreLogs.filter((l) => l.day === today).map((l) => l.choreId)); }
  const done = S.chores.filter((c) => doneIds.has(c.id) && !dueIds.has(c.id)).length;
  const total = done + due.length; return { due, done, total, pct: total ? Math.round((done / total) * 100) : null };
}
function homeInv() {
  if (typeof invProgress === "function") { try { return invProgress(); } catch (e) {} }
  return { n: 0, total: S.products.length, pct: 0 };
}
/* reception in progress: the live S.rec, or the draft reception.js keeps per restaurant (gg-rec-draft-<rid>, 18 h) */
function homeRecDraft() {
  const R = S.rec; if (R && (!R.rid || R.rid === S.rid)) return R.done ? null : R;
  try { const d = JSON.parse(localStorage.getItem("gg-rec-draft-" + (S.rid || "")) || "null"); return d && Array.isArray(d.lines) && Date.now() - (d.at || 0) <= 18 * 36e5 ? d : null; } catch (e) { return null; }
}
function homeRecLive() { const R = homeRecDraft(); return !!(R && (R.step > 1 || (R.supplier || "").trim() || (R.lines || []).some((l) => (l.name || "").trim()))); }
const homePlural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
function homeDismissed() { try { return localStorage.getItem("gg-home-steps-" + S.rid) === "off"; } catch (e) { return false; } }


/* ── équipe en service (pointeuse) ── */
/* who is clocked in right now, from S.punches (newest first): [{ id, memberId, name, color, st: "in"|"pause", since }] */
function homeOnShift() {
  if (typeof rhOnShift === "function") { try { const r = rhOnShift(); if (Array.isArray(r)) return r; } catch (e) {} }
  const seen = new Set(), out = [], now = Date.now();
  for (const p of S.punches) {
    if (!p || !p.staffId || now - (p.at || 0) > 18 * 36e5) continue;
    if (seen.has(p.staffId)) continue; seen.add(p.staffId);
    if (p.kind === "out") continue;
    const s = S.staff.find((x) => x.id === p.staffId) || {}; const m = S.members.find((x) => x.id === (s.memberId || p.staffId));
    const inP = S.punches.find((x) => x.staffId === p.staffId && x.kind === "in" && x.at <= p.at);
    out.push({ id: p.staffId, memberId: s.memberId || (m && m.id) || null, name: s.name || (m && m.name) || "?", color: s.color || (m && m.color) || colorFor(p.staffId), st: p.kind === "breakStart" ? "pause" : "in", since: inP ? inP.at : p.at });
  }
  return out;
}
function homeMyStaffId() { const s = S.staff.find((x) => x.memberId === S.me.id && x.active !== false); return s ? s.id : null; }
function homeShiftAva(x) { return x.memberId && (S.profiles[x.memberId] || S.members.some((m) => m.id === x.memberId)) ? avatar(x.memberId, true) : `<span class="ava sm" style="background:${esc(x.color || "#4A1FE6")}">${esc(initials(x.name || "?"))}</span>`; }
function homeShiftCard() {
  if (!VIEWS.pointeuse) return "";
  const on = homeOnShift(); const work = on.filter((x) => x.st === "in"), pause = on.filter((x) => x.st === "pause");
  const myId = homeMyStaffId(); const mine = on.find((x) => x.id === myId || (x.memberId && x.memberId === S.me.id));
  const names = (a) => a.slice(0, 3).map((x) => esc(firstName(x.name))).join(", ") + (a.length > 3 ? ` +${a.length - 3}` : "");
  const sub = mine ? `Vous : ${mine.st === "pause" ? "en pause" : "pointé"} depuis ${hm(mine.since)}${on.length > 1 ? ` · ${names(on.filter((x) => x !== mine))}` : ""}`
    : on.length ? `${names(work)}${pause.length ? `${work.length ? " · " : ""}${names(pause)} en pause` : ""}` : "Arrivée, pause, départ : un geste chacun";
  return `<section class="glass hm-shift st" style="--i:4" aria-label="Équipe en service">
    <span class="hm-shift-avs">${on.length ? on.slice(0, 4).map((x) => `<span class="hm-sa ${x.st}">${homeShiftAva(x)}</span>`).join("") + (on.length > 4 ? `<span class="hm-sa more mono">+${on.length - 4}</span>` : "") : `<span class="ic">${ico("clock")}</span>`}</span>
    <div class="tx"><b>${on.length ? (work.length ? `${work.length} en service` : `${pause.length} en pause`) : "Personne n'est pointé"}</b><em>${sub}</em></div>
    <button class="btn ${mine ? "soft" : "acc"} sm hm-punch" data-act="homePunch">${ico("clock")}${mine ? "Pointer" : "Je pointe"}</button>
  </section>`;
}

/* ── service: chambre froide ⇄ frigos de service ── */
function homeSvcCard() {
  if (!VIEWS.scan || S.fridges.length < 2) return "";
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const back = (h >= 14.5 && h < 17) || h >= 22.5 || h < 6;
  const b = (v, ic, t, s, on) => `<button class="hm-svb ${on ? "on" : ""}" data-act="homeSvc" data-v="${v}"><span class="qi">${ico(ic)}</span><span class="tx"><b>${t}</b><em>${s}</em></span></button>`;
  return `<section class="hm-svc st" style="--i:3" aria-label="Service">
    ${b("mep", "move", "Mise en place", "Chambre froide → frigos", !back)}
    ${b("retour", "snow", "Fin de service", "Frigos → chambre froide", back)}
  </section>`;
}

/* ── tableau de bord (gérant) ── */
function homeDashLink() {
  if (!VIEWS.dashboard || myRole() !== "gerant" || (typeof canSee === "function" && !canSee("dashboard"))) return "";
  let sub = "Ventes, coûts et marges en un coup d'œil";
  if (typeof salesBetween === "function") {
    try { const t = new Date(); const mon = addDays(dayKey(), -((t.getDay() + 6) % 7)); const r = salesBetween(mon, dayKey()); if (r && +r.ttc > 0) sub = `Cette semaine : ${Math.round(+r.ttc).toLocaleString("fr-FR")} € TTC${r.covers ? ` · ${r.covers} couverts` : ""}`; } catch (e) {}
  }
  return `<button class="glass hm-dash st" style="--i:5" data-go="dashboard"><span class="ic">${ico("dash")}</span><span class="tx"><b>Tableau de bord</b><em>${sub}</em></span>${ico("chev")}</button>`;
}

/* ── obligations (oblig.js) in « À faire maintenant » ── */
function homeOblTodo(T) {
  if (typeof oblDue !== "function") return;
  let list = []; try { list = oblDue(30) || []; } catch (e) { return; }
  const rows = list.map((o) => ({ o, d: o && o.nextDue ? daysUntil(String(o.nextDue).slice(0, 10)) : null })).sort((a, b) => (a.d ?? 99) - (b.d ?? 99));
  rows.slice(0, rows.length > 2 ? 1 : 2).forEach(({ o, d }) => {
    const late = d != null && d < 0;
    T.push({ p: late ? 0.8 : d != null && d <= 7 ? 6.8 : 7.5, tone: late ? "bad" : d != null && d <= 7 ? "warn" : "acc", icon: "calcheck", title: esc(o.name || "Obligation"),
      sub: `${d == null ? "À programmer" : late ? `En retard de ${homePlural(-d, "jour")}` : d === 0 ? "À faire aujourd'hui" : `Avant le ${shortDate(String(o.nextDue).slice(0, 10))}`}${o.provider ? ` · ${esc(o.provider)}` : ""}`,
      btn: late ? "Planifier" : "Voir", attrs: `data-go="obligations"${o.id ? ` data-id="${esc(o.id)}"` : ""}` });
  });
  if (rows.length > 2) T.push({ p: 7.6, tone: "acc", icon: "calcheck", title: `Obligations · ${rows.length - 1} autres`, sub: esc(rows.slice(1, 4).map((x) => x.o.name).join(", ")), btn: "Tout voir", attrs: `data-go="obligations"` });
}

/* ── "À faire maintenant": one prioritised list ── */
function homeTodo(slot, pend) {
  const T = []; const lots = activeLots().map((l) => ({ l, d: daysUntil(dlcOf(l)) })).filter((x) => x.d != null && x.d <= 1).sort((a, b) => a.d - b.d);
  const qty = (l) => { const q = num(l.qty); return q ? ` · ${homeQty(q)}${l.unit ? " " + esc(l.unit) : ""}` : ""; };
  const where = (l) => (S.fridges.some((f) => f.id === l.fridgeId) ? ` · ${esc(fridgeName(l.fridgeId))}` : "");
  // fridge out of range today
  S.fridges.forEach((f) => { const r = readingsFor(dayKey()).find((x) => x.fridgeId === f.id); if (r && r.ok === false) T.push({ p: r.action ? 0.5 : 0, tone: r.action ? "warn" : "bad", icon: "alert", title: `${esc(f.name)} · ${fmt(r.value)} °C`, sub: r.action ? `Hors seuil · ${esc(r.action)}` : "Hors seuil · action corrective à noter", btn: r.action ? "Voir" : "Agir", attrs: `data-go="frigo" data-id="${f.id}"` }); });
  // expired lots
  lots.filter((x) => x.d < 0).forEach(({ l, d }) => T.push({ p: 1, tone: "bad", icon: "trash", title: esc(l.name), sub: `${d === -1 ? "DLC dépassée depuis hier" : `DLC dépassée depuis ${-d} jours`}${qty(l)}${where(l)}`, btn: "Traiter", attrs: `data-act="lot" data-id="${l.id}"` }));
  // DLC today / tomorrow
  lots.filter((x) => x.d >= 0).forEach(({ l, d }) => T.push({ p: d === 0 ? 3 : 5, tone: d === 0 ? "bad" : "warn", icon: "clock", title: esc(l.name), sub: `${d === 0 ? "DLC aujourd'hui" : "DLC demain"}${qty(l)}${l.status === "opened" ? " · ouvert" : ""}${where(l)}`, btn: "Voir", attrs: `data-act="lot" data-id="${l.id}"` }));
  // reception in progress
  if (homeRecLive()) { const R = homeRecDraft(); const n = (R.lines || []).filter((l) => (l.name || "").trim()).length; T.push({ p: -1, tone: "acc", icon: "truck", title: `Réception en cours${R.supplier ? ` · ${esc(R.supplier)}` : ""}`, sub: n ? `${homePlural(n, "produit")} saisi${n > 1 ? "s" : ""}, à valider` : "À terminer", btn: "Reprendre", attrs: `data-go="reception"` }); }
  // cleaning due now
  const due = homeChoresDue();
  due.slice(0, due.length > 3 ? 2 : 3).forEach((c) => T.push({ p: 6, tone: "ok", icon: "spray", title: esc(c.name), sub: `${c.zone ? `${esc(c.zone)} · ` : ""}${homeFreqTx(c)}`, chore: c.id, attrs: `data-act="homeChore" data-id="${c.id}"` }));
  if (due.length > 3) T.push({ p: 6.5, tone: "ok", icon: "spray", title: `Ménage · ${due.length - 2} autres tâches`, sub: esc(due.slice(2, 5).map((c) => c.name).join(", ")), btn: "Tout voir", attrs: `data-go="menage"` });
  // monthly inventory near month end
  const inv = homeInv(); const d = new Date(); const left = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
  if (left <= 4 && inv.total && inv.pct < 100) T.push({ p: 7, tone: "acc", icon: "list", title: `Inventaire de ${MONTHS[d.getMonth()]} · ${inv.pct}%`, sub: `${left ? `Fin du mois dans ${homePlural(left, "jour")}` : "Dernier jour du mois"} · ${inv.total - inv.n} à compter`, btn: "Compter", attrs: `data-go="stock"` });
  homeOblTodo(T);
  return T.sort((a, b) => a.p - b.p);
}
function homeFreqTx(c) {
  if (c.freq === "service") {
    let slot = slotNow();
    if (typeof menToday === "function") { try { const o = menToday().groups; const open = (x) => x.c.id === c.id && (x.st === "todo" || x.st === "overdue"); slot = o.midi.some(open) ? "midi" : o.fermeture.some(open) ? "soir" : slot; } catch (e) {} }
    return slot === "midi" ? "après le service du midi" : "après le service du soir";
  }
  if (c.freq === "jours") return "aujourd'hui";
  if (c.freq === "semaine") return "cette semaine";
  if (c.freq === "mois") return "ce mois-ci";
  return "chaque jour";
}
function homeQty(q) { return String(+q.toFixed(2)).replace(".", ","); }
function homeTodoRow(t, i) {
  const ic = `<span class="ic ${t.tone === "acc" ? "" : t.tone}">${ico(t.icon)}</span>`;
  if (t.chore) return `<div class="li hm-row ${t.tone}" style="--j:${i}">${ic}<div class="tx"><b>${t.title}</b><em>${t.sub}</em></div><button class="hm-do" ${t.attrs} aria-label="Marquer « ${t.title} » comme fait"><span class="pend"></span>Fait</button></div>`;
  return `<div class="li tap hm-row ${t.tone}" ${t.attrs} role="button" tabindex="0" style="--j:${i}">${ic}<div class="tx"><b>${t.title}</b><em>${t.sub}</em></div><span class="hm-go ${t.tone}">${t.btn}${ico("chev")}</span></div>`;
}

/* ── premiers pas ── */
function homeSteps() {
  return [
    { done: S.fridges.length > 0, t: "Ajouter vos frigos", s: "Avec leurs seuils de température", attrs: `data-go="frigos"` },
    { done: S.readings.length > 0, t: "Faire le premier relevé", s: "Une température par frigo, en 10 secondes", attrs: S.fridges.length ? `data-act="homeFridge" data-id="${S.fridges[0].id}"` : `data-go="frigos"` },
    { done: S.receptions.length > 0, t: "Enregistrer une réception", s: "Température, DLC et photo de l'étiquette", attrs: `data-go="reception" data-fresh="1"` },
    { done: S.chores.length > 0, t: "Charger le plan de nettoyage", s: "Un plan type prêt à l'emploi, en un geste", attrs: `data-act="homeStarter"` },
    { done: S.members.length > 1, t: "Ajouter l'équipe", s: "Chaque action porte le nom de son auteur", attrs: `data-go="equipe"` },
    ...(DB.mode === "local" && typeof ccHasPin === "function" && typeof ACT.ccPinChange === "function" && S.members.some((m) => m.id === S.me.id)
      ? [{ done: ccHasPin(S.members.find((m) => m.id === S.me.id)), t: "Créer votre code", s: "4 chiffres pour entrer dans votre session", attrs: `data-act="ccPinChange"` }] : []),
  ];
}
function homeStepsCard(i) {
  const st = homeSteps(); const n = st.filter((x) => x.done).length;
  if (n === st.length || homeDismissed()) return "";
  const next = st.findIndex((x) => !x.done);
  return `<section class="glass pad hm-steps st" style="--i:${i}" aria-label="Premiers pas">
    <div class="row" style="align-items:flex-start"><div><span class="lbl">Premiers pas</span><div class="h3" style="margin-top:3px">Prêt pour le contrôle sanitaire</div></div><button class="hm-x" data-act="homeStepsOff" aria-label="Masquer les premiers pas">${ico("x")}</button></div>
    <div class="hm-prog"><i style="--w:${(n / st.length) * 100}%"></i></div><div class="sub" style="font-size:12.5px;margin-top:7px">${n} sur ${st.length} · ${st.length - n === 1 ? "plus qu'une étape" : `encore ${st.length - n} étapes`}</div>
    <div style="margin-top:6px">${st.map((x, k) => `<div class="li ${x.done ? "" : "tap"} hm-step ${x.done ? "ok" : ""} ${k === next ? "next" : ""}" ${x.done ? "" : `${x.attrs} role="button" tabindex="0"`}>${x.done ? `<span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : `<span class="hm-num">${k + 1}</span>`}<div class="tx"><b>${x.t}</b><em>${x.done ? "Fait" : x.s}</em></div>${x.done ? "" : k === next ? `<span class="btn acc sm hm-cta">Commencer</span>` : ico("chev")}</div>`).join("")}</div>
  </section>`;
}

/* ── activity feed ── */
const HOME_EV = { reading: ["therm", "#1F7AE0"], reception: ["truck", "#E0752F"], open: ["scissors", "#8A4DFF"], out: ["out", "#0E8C9E"], lost: ["trash", "#D42A48"], lot: ["move", "#4A1FE6"], chore: ["spray", "#0B9B6A"], ticket: ["receipt", "#B85C00"], note: ["book", "#D63A7A"], team: ["users", "#4A1FE6"] };
function homeEvTarget(e) {
  const r = e.ref;
  if (e.type === "reading") return !!(r && S.fridges.some((f) => f.id === r));
  if (["open", "out", "lost", "lot"].includes(e.type)) return !!(r && typeof ACT.lot === "function" && S.lots.some((l) => l.id === r));
  if (e.type === "ticket") return !!(r && typeof ACT.ticket === "function" && S.tickets.some((t) => t.id === r));
  if (e.type === "note") return !!(r && S.notes.some((n) => n.id === r));
  return ["chore", "reception", "team"].includes(e.type);
}
function homeFeed(i) {
  const feed = S.events.slice(0, 8);
  const row = (e, k) => { const [ic, col] = HOME_EV[e.type] || ["activity", "#5A6386"]; const tap = homeEvTarget(e);
    const cx = !!e.cancelled;
    return `<div class="li hm-ev ${tap ? "tap" : ""} ${cx ? "cx" : ""}" ${tap ? `data-act="homeEv" data-id="${e.id}" role="button" tabindex="0"` : ""} style="--j:${k}"><span class="hm-av">${avatar(e.uid)}<span class="bd" style="background:${col}">${ico(ic)}</span></span><div class="tx"><b>${esc(said(e.uid, e.text))}</b>${cx ? `<span class="pill neu hm-cx">Annulé</span>` : ""}</div><span class="hm-when mono">${when(e.at)}</span></div>`; };
  return `<section class="glass pad hm-feedc st" style="--i:${i}" aria-label="Activité de l'équipe"><div class="row"><span class="lbl">Activité de l'équipe</span><span class="avs">${S.members.slice(0, 4).map((m) => avatar(m.id, true)).join("")}</span></div>
    ${feed.length ? `<div class="hm-feed">${feed.map(row).join("")}</div>${S.events.length > 8 ? `<button class="btn ghost sm block" data-go="registre" style="margin-top:4px">Tout le registre${ico("chev")}</button>` : ""}` : `<div class="empty" style="padding:20px 0 8px"><div class="ic">${ico("activity")}</div><b>Rien pour l'instant</b>Chaque relevé, réception ou ouverture apparaîtra ici avec son auteur.</div>`}
  </section>`;
}

/* ── view ── */
VIEWS.home = {
  render() {
    const now = new Date(); const slot = slotNow();
    const greet = now.getHours() < 5 || now.getHours() >= 18 ? "Bonsoir" : "Bonjour";
    const { done, exp } = todayStats(slot); const pct = exp ? Math.round((done / exp) * 100) : 0;
    const rsSlot = readingsFor(dayKey(), slot);
    const pend = S.fridges.filter((f) => !rsSlot.find((r) => r.fridgeId === f.id));
        const lots = activeLots(); const watch = lots.filter((l) => (daysUntil(dlcOf(l)) ?? 99) <= 3).length;
    const ch = homeChoreStats(); const inv = homeInv();
    const todo = homeTodo(slot, pend); const urgent = todo.filter((t) => t.tone === "bad").length;
    const TODO_MAX = 6; const cap = S.ui.hmAll ? todo.length : todo.length > TODO_MAX ? TODO_MAX - 1 : TODO_MAX;
    const fresh = homeSteps().filter((x) => x.done).length < 3; const recNow = homeRecLive();

    // the kitchen, drawn: one fridge per appliance on the violet wall, the next one to read is circled in saffron
    const frRank = (f) => { const r = rsSlot.find((x) => x.fridgeId === f.id); return r ? (r.ok === false ? 0 : 2) : 1; };
    const FR_MAX = 6; const frAll = S.fridges.slice(0, FR_MAX);
    const frKind = (f) => { const k = typeof relTypeOf === "function" ? (relTypeOf(f) || {}).k : ""; return k === "congel" || f.max <= -10 ? "cg" : k === "cfp" || /chambre/i.test(f.name || "") ? "cf" : "st"; };
    const nextId = pend[0] ? pend[0].id : null;
    const drawn = frAll.map((f, i) => { const r = rsSlot.find((x) => x.fridgeId === f.id); const k = frKind(f); const st = r ? (r.ok === false ? "bad" : "ok") : "todo";
      return `<button class="hm-dfr ${k} ${st} ${f.id === nextId ? "next" : ""}" style="--j:${i}" ${r ? `data-go="frigo" data-id="${f.id}"` : `data-act="homeFridge" data-id="${f.id}"`} aria-label="${esc(f.name)}${r ? ` : ${fmt(r.value)} °C` : " : à relever"}"><span class="bx"><span class="lcd">${r ? `${fmt(r.value)}°` : "--,-"}</span>${k === "cg" ? "" : `<span class="hd"></span>`}</span><span class="nm">${esc(f.name)}</span></button>`; }).join("") + (S.fridges.length > FR_MAX ? `<button class="hm-dfr plus" data-go="releve" aria-label="Tous les frigos"><span class="bx">+${S.fridges.length - FR_MAX}</span><span class="nm">Autres</span></button>` : "");
    const hero = `<section class="hero hm-hero wall st" style="--i:1" data-go="releve" role="button" tabindex="0" aria-label="Ouvrir les relevés">
      <div class="hm-ht"><span class="hm-kick">Relevé du ${slot}</span><span class="hm-cnt mono">${done} / ${exp}</span></div>
      <div class="hm-big">${!exp ? "Ajoutez vos frigos" : pend.length ? `${homePlural(pend.length, "frigo")} à relever` : slot === "midi" ? "Bouclé pour ce midi" : "Tout est relevé"}</div>
      ${exp ? `<div class="hm-kitchen"><div class="hm-drawn">${drawn}</div><i class="hm-floor"></i></div>` : ""}
      ${!exp ? `<button class="hm-cta-w" data-go="frigos">${ico("plus")}Ajouter un frigo</button>` : pend.length ? `<button class="hm-cta-w" data-act="homeFridge" data-id="${pend[0].id}"><span>Relever ${esc(pend[0].name)}</span>${ico("arrow")}</button>` : `<span class="hm-cta-w done">${slot === "midi" ? "Prochain relevé ce soir" : "Tous les frigos sont signés"}</span>`}
    </section>`;

    const QA = [["releve", "therm", "Relevé", "c1", pend.length], ["reception", "truck", "Réception", "c2", homeRecLive() ? "•" : 0], ["scan", "scan", "Scanner", "c3", 0], ["menage", "spray", "Ménage", "c4", ch.due.length], ["stock", "list", "Inventaire", "c5", 0]];
    const qa = `<nav class="hm-qa st" style="--i:2" aria-label="Actions rapides">${QA.filter((q) => typeof permOk !== "function" || permOk(q[0])).map(([r, ic, t, c, n]) => `<button class="${c}" ${r === "releve" && pend.length ? `data-act="homeFridge" data-id="${pend[0].id}"` : `data-go="${r}"`}${r === "reception" && !homeRecLive() ? ' data-fresh="1"' : ""}><span class="qi">${ico(ic)}${n ? `<span class="bdg mono">${n}</span>` : ""}</span><span class="ql">${t}</span></button>`).join("")}</nav>`;

    const stat = (lbl, val, sub, go, tone, bar) => `<button class="hm-stat ${tone || ""}" data-go="${go}"><span class="sl">${lbl}</span><span class="sv mono">${val == null ? "–" : `<span class="hm-n" data-to="${val}">0</span>${bar != null ? "<small>%</small>" : ""}`}</span>${bar != null ? `<span class="sb"><i style="--w:${bar}%"></i></span>` : ""}<span class="ss">${sub}</span></button>`;
    const stats = `<section class="hm-stats st" style="--i:4" aria-label="Chiffres du jour">
      ${stat("En frigo", lots.length, lots.length > 1 ? "produits" : "produit", "frigos")}
      ${stat("DLC", watch, "à surveiller", "frigos", watch ? "warn" : "")}
      ${stat("Ménage", ch.pct, ch.total ? `${ch.done} / ${ch.total} faites` : "à configurer", "menage", ch.pct === 100 ? "ok" : "", ch.pct ?? 0)}
      ${stat("Inventaire", inv.total ? inv.pct : null, inv.total ? MONTHS[now.getMonth()] : "à configurer", "stock", inv.total && inv.pct === 100 ? "ok" : "", inv.total ? inv.pct : 0)}
    </section>`;

    const todoCard = `<section class="glass pad hm-todo st" style="--i:3" aria-label="À faire maintenant">
      <div class="row"><span class="lbl">À faire maintenant</span>${todo.length ? `<span class="pill ${urgent ? "bad" : "acc"}">${urgent ? `<span class="dot"></span>${homePlural(urgent, "urgence")}` : homePlural(todo.length, "tâche")}</span>` : ""}</div>
      ${todo.length ? `<div class="hm-list">${todo.slice(0, cap).map(homeTodoRow).join("")}</div>${todo.length > TODO_MAX ? `<button class="hm-more" data-act="homeMore">${S.ui.hmAll ? `Réduire la liste${ico("up")}` : `Voir ${todo.length - cap === 1 ? "la tâche restante" : `les ${todo.length - cap} autres tâches`}${ico("down")}`}</button>` : ""}` : `<div class="hm-zen"><span class="check draw"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span><b>${pend.length ? "Rien d'autre pour l'instant" : "Tout est à jour"}</b><span>${pend.length ? "À part le relevé, rien ne presse." : "Relevés, DLC et ménage : rien ne presse."}</span></div>`}
    </section>`;

    const stepsCard = homeStepsCard(fresh ? 3 : 5);
    const inst = typeof installHint === "function" ? installHint() : ""; let bn; { const r = S.route; S.route = "home-noinst"; try { bn = banner(); } finally { S.route = r; } } /* banner() without its install card: it goes under the hero */
    const instCard = inst ? `<div class="hm-inst">${inst}</div>` : "";
    return `<div class="inner hm">
      <header class="row st hm-head" style="--i:0"><div style="min-width:0"><button class="hm-date" data-act="restoSwitch"><span>${DAYS[now.getDay()].replace(/^./, (c) => c.toUpperCase())} ${now.getDate()} ${MONTHS[now.getMonth()]} · ${esc(S.resto.name)}</span>${ico("down")}</button><div class="title">${greet}${S.me.name ? " " + esc(firstName(S.me.name)) : ""}</div></div><button class="iconbtn" ${typeof ACT.whoami === "function" ? `data-act="whoami" aria-label="Qui êtes-vous ? Changer d'utilisateur"` : `data-go="reglages" aria-label="Réglages"`} style="padding:0">${avatar(S.me.id)}</button></header>
      ${bn}
      <div class="hm-grid ${fresh ? "fresh" : ""} ${recNow ? "rec" : ""}">
        <div class="hm-col hm-l">${hero}${instCard}${homeSvcCard()}${fresh && !recNow ? stepsCard : ""}${todoCard}${fresh && !recNow ? "" : stepsCard}</div>
        <div class="hm-col hm-r">${qa}${homeShiftCard()}${stats}${homeDashLink()}${homeFeed(6)}</div>
      </div></div>`;
  },
  after(v) {
    const still = v.classList.contains("nost");
    requestAnimationFrame(() => setTimeout(() => {
      const b = $("#ringBar", v); if (b) b.style.strokeDashoffset = b.dataset.to;
      const p = $("#ringPct", v); if (p) countTo(p, still ? +p.dataset.to : 0, +p.dataset.to, 1100);
      $$(".hm-stat .hm-n", v).forEach((el, i) => { const to = +el.dataset.to; if (still) el.textContent = to; else setTimeout(() => countTo(el, 0, to, 900), 140 + i * 80); });
      $$(".hm-prog i, .hm-stat .sb i", v).forEach((el) => el.classList.add("on"));
    }, still ? 0 : 180));
  },
};
function countTo(el, from, to, ms) { const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }

Object.assign(ACT, {
  homeFridge: (a, id) => { SFX.tap(); buzz(6); S.slot = slotNow(); S.open = id || null; go("releve"); },
  homeChore: async (a, id) => {
    // one tap = one log, even on a frantic double tap (the row re-renders while the write is in flight)
    const busy = (S.ui.hmBusy ||= {}); if (busy[id] || !homeChoresDue().some((c) => c.id === id)) return; busy[id] = 1; setTimeout(() => { delete busy[id]; }, 1500);
    const row = a.closest(".hm-row"); if (row) row.classList.add("leaving");
    if (typeof ACT.choreDo === "function") return ACT.choreDo(a, id);
    const c = S.chores.find((x) => x.id === id); if (!c) return;
    await safe(DB.add("choreLogs", { choreId: id, at: Date.now(), day: dayKey(), uid: S.me.id })); await logEvent("chore", `a fait « ${c.name} »`, { ref: id }); SFX.ok(); buzz(10);
  },
  homeStarter: async (a) => {
    if (typeof ACT.choreStarter !== "function") return go("menage");
    if (S.ui.hmStarting || S.chores.length) return; S.ui.hmStarting = 1; a.style.pointerEvents = "none";
    try { await ACT.choreStarter(a); } finally { S.ui.hmStarting = 0; }
  },
  homePunch: () => { SFX.tap(); buzz(6); const id = homeMyStaffId(); go("pointeuse", id ? { id } : {}); },
  /* service: « Mise en place » (chambre froide → frigos de service) / « Retour en chambre froide ». labels.js reads params.mode on « scan » */
  homeSvc: (a, id, v) => {
    SFX.tap(); buzz(6); const mode = v === "retour" ? "retour" : "mep";
    if (typeof lbServiceMode === "function") { try { return lbServiceMode(mode); } catch (e) {} }
    /* labels.js « Service » scan mode (LB.mode "svc", direction svcPref().dir "mep" | "ret"), when present */
    if (typeof svcSave === "function" && typeof LB === "object" && LB) { try { svcSave({ dir: mode === "retour" ? "ret" : "mep" }); LB.mode = "svc"; LB.seen = {}; LB.batch = []; } catch (e) {} }
    go("scan", { mode });
  },
  homeMore: () => { S.ui.hmAll = !S.ui.hmAll; SFX.tick(); rerender(); },
  homeStepsOff: () => { try { localStorage.setItem("gg-home-steps-" + S.rid, "off"); } catch (e) {} SFX.close(); rerender(); },
  homeEv: (a, id) => {
    const e = S.events.find((x) => x.id === id); if (!e) return; SFX.tap();
    if (e.type === "reading") return go("frigo", { id: e.ref });
    if (["open", "out", "lost", "lot"].includes(e.type) && ACT.lot) return ACT.lot(a, e.ref);
    if (e.type === "ticket" && ACT.ticket) return ACT.ticket(a, e.ref);
    if (e.type === "note") return go("note", { id: e.ref });
    if (e.type === "chore") return go("menage");
    if (e.type === "reception") return go("registre");
    if (e.type === "team") return go("equipe");
  },
});
