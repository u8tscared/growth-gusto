/* Growth Gusto — area: home ("Aujourd'hui", le cockpit du cuisinier) */
Object.assign(IC, {
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  activity: ["M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"],
});

/* ── data helpers (guarded: other areas own these globals and may change them) ── */
function homeChoresDue() {
  if (typeof choresDue === "function") { try { return choresDue() || []; } catch (e) {} }
  const now = Date.now(); const span = { jour: 0, semaine: 7, mois: 30 };
  return S.chores.filter((c) => { const last = S.choreLogs.find((l) => l.choreId === c.id); if (!last) return true; if (c.freq === "jour") return last.day !== dayKey(); return now - last.at > (span[c.freq] || 0) * 864e5 - 36e5; });
}
function homeChoreStats() {
  const due = homeChoresDue(); const today = dayKey();
  const doneIds = new Set(S.choreLogs.filter((l) => l.day === today).map((l) => l.choreId));
  const done = S.chores.filter((c) => doneIds.has(c.id) && !due.includes(c)).length;
  const total = done + due.length; return { due, done, total, pct: total ? Math.round((done / total) * 100) : null };
}
function homeInv() {
  if (typeof invProgress === "function") { try { return invProgress(); } catch (e) {} }
  return { n: 0, total: S.products.length, pct: 0 };
}
function homeRecLive() { const R = S.rec; return !!(R && !R.done && (R.step > 1 || (R.supplier || "").trim() || (R.lines || []).some((l) => (l.name || "").trim()))); }
const homePlural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
function homeDismissed() { try { return localStorage.getItem("gg-home-steps-" + S.rid) === "off"; } catch (e) { return false; } }

/* ── "À faire maintenant": one prioritised list ── */
function homeTodo(slot, pend) {
  const T = []; const lots = activeLots().map((l) => ({ l, d: daysUntil(dlcOf(l)) })).filter((x) => x.d != null && x.d <= 1).sort((a, b) => a.d - b.d);
  const qty = (l) => (l.qty ? ` · ${fmt(num(l.qty), num(l.qty) % 1 ? 1 : 0)} ${esc(l.unit || "")}` : "");
  // fridge out of range today
  S.fridges.forEach((f) => { const r = readingsFor(dayKey()).find((x) => x.fridgeId === f.id); if (r && r.ok === false) T.push({ p: 0, tone: "bad", icon: "alert", title: `${esc(f.name)} · ${fmt(r.value)} °C`, sub: `Hors seuil · ${esc(r.action || "action corrective à noter")}`, btn: "Voir", attrs: `data-go="frigo" data-id="${f.id}"` }); });
  // expired lots
  lots.filter((x) => x.d < 0).forEach(({ l, d }) => T.push({ p: 1, tone: "bad", icon: "trash", title: `${esc(l.name)}${qty(l)}`, sub: `DLC dépassée de ${homePlural(-d, "jour")} · ${esc(fridgeName(l.fridgeId))}`, btn: "Traiter", attrs: `data-act="lot" data-id="${l.id}"` }));
  // readings due now
  if (pend.length) T.push({ p: 2, tone: "warn", icon: "therm", title: `Relevé du ${slot} · ${homePlural(pend.length, "frigo")}`, sub: esc(pend.map((f) => f.name).join(", ")), btn: "Relever", attrs: `data-act="homeFridge" data-id="${pend[0].id}"` });
  // DLC today / tomorrow
  lots.filter((x) => x.d >= 0).forEach(({ l, d }) => T.push({ p: d === 0 ? 3 : 5, tone: d === 0 ? "bad" : "warn", icon: "clock", title: `${esc(l.name)}${qty(l)}`, sub: `${d === 0 ? "DLC aujourd'hui" : "DLC demain"}${l.status === "opened" ? " · ouvert" : ""} · ${esc(fridgeName(l.fridgeId))}`, btn: "Voir", attrs: `data-act="lot" data-id="${l.id}"` }));
  // reception in progress
  if (homeRecLive()) { const n = S.rec.lines.filter((l) => (l.name || "").trim()).length; T.push({ p: 4, tone: "acc", icon: "truck", title: `Réception en cours${S.rec.supplier ? ` · ${esc(S.rec.supplier)}` : ""}`, sub: n ? `${homePlural(n, "produit")} saisi${n > 1 ? "s" : ""}, à valider` : "À terminer", btn: "Reprendre", attrs: `data-go="reception"` }); }
  // cleaning due now
  const due = homeChoresDue();
  due.slice(0, due.length > 3 ? 2 : 3).forEach((c) => T.push({ p: 6, tone: "ok", icon: "spray", title: esc(c.name), sub: `${c.zone ? `${esc(c.zone)} · ` : ""}${c.freq === "jour" ? "chaque jour" : c.freq === "semaine" ? "cette semaine" : "ce mois-ci"}`, chore: c.id, attrs: `data-act="homeChore" data-id="${c.id}"` }));
  if (due.length > 3) T.push({ p: 6.5, tone: "ok", icon: "spray", title: `Ménage · ${homePlural(due.length - 2, "autre tâche")}`, sub: esc(due.slice(2, 5).map((c) => c.name).join(", ")), btn: "Tout voir", attrs: `data-go="menage"` });
  // monthly inventory near month end
  const inv = homeInv(); const d = new Date(); const left = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
  if (left <= 4 && inv.total && inv.pct < 100) T.push({ p: 7, tone: "acc", icon: "list", title: `Inventaire de ${MONTHS[d.getMonth()]} · ${inv.pct}%`, sub: `${left ? `Fin du mois dans ${homePlural(left, "jour")}` : "Dernier jour du mois"} · ${inv.total - inv.n} à compter`, btn: "Compter", attrs: `data-go="stock"` });
  return T.sort((a, b) => a.p - b.p);
}
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
    return `<div class="li hm-ev ${tap ? "tap" : ""}" ${tap ? `data-act="homeEv" data-id="${e.id}" role="button" tabindex="0"` : ""} style="--j:${k}"><span class="hm-av">${avatar(e.uid)}<span class="bd" style="background:${col}">${ico(ic)}</span></span><div class="tx"><b>${esc(said(e.uid, e.text))}</b></div><span class="hm-when mono">${when(e.at)}</span></div>`; };
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
    const fresh = homeSteps().filter((x) => x.done).length < 3;

    const ringC = +(2 * Math.PI * 42).toFixed(2);
    const hero = `<section class="hero hm-hero st" style="--i:1" data-go="releve" role="button" tabindex="0" aria-label="Ouvrir les relevés">
      <div class="in">
        <div class="ring"><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="42" fill="none" stroke-width="9"/><circle class="br" id="ringBar" cx="50" cy="50" r="42" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${ringC}" stroke-dashoffset="${ringC}" data-to="${ringC * (1 - (exp ? done / exp : 0))}"/></svg><div class="num"><div><b id="ringPct" data-to="${pct}">0</b><b class="pc">%</b><small>${done} / ${exp}</small></div></div></div>
        <div class="meta"><span class="hm-kick">${ico("therm")}Relevé du ${slot}</span>
          <b>${!exp ? "Ajoutez vos frigos" : pend.length ? `${homePlural(pend.length, "frigo")} à relever` : slot === "midi" ? "Bouclé pour ce midi" : "Bouclé pour aujourd'hui"}</b>
          <span>${!exp ? "Pour démarrer les relevés" : pend.length ? `Prochain : ${esc(pend[0].name)}` : slot === "midi" ? "Prochain relevé ce soir" : "Tous les frigos sont signés"}</span>
        </div>
      </div>
      ${exp ? `<div class="hm-frs">${S.fridges.map((f) => { const r = rsSlot.find((x) => x.fridgeId === f.id); return `<span class="hm-fr ${r ? (r.ok === false ? "bad" : "ok") : ""}">${r ? (r.ok === false ? ico("alert") : ico("check")) : "<i></i>"}${esc(f.name)}${r ? `<em class="mono">${fmt(r.value)}°</em>` : ""}</span>`; }).join("")}</div>` : ""}
      ${!exp ? `<button class="hm-cta-w" data-go="frigos">${ico("plus")}Ajouter un frigo</button>` : pend.length ? `<button class="hm-cta-w" data-act="homeFridge" data-id="${pend[0].id}"><span>Relever ${esc(pend[0].name)}</span>${ico("arrow")}</button>` : `<span class="hm-cta-w done">${ico("check")}Tout est signé</span>`}
    </section>`;

    const QA = [["releve", "therm", "Relevé", "c1", pend.length], ["reception", "truck", "Réception", "c2", homeRecLive() ? "•" : 0], ["scan", "scan", "Scanner", "c3", 0], ["menage", "spray", "Ménage", "c4", ch.due.length], ["stock", "list", "Inventaire", "c5", 0]];
    const qa = `<nav class="hm-qa st" style="--i:2" aria-label="Actions rapides">${QA.map(([r, ic, t, c, n]) => `<button class="${c}" ${r === "releve" && pend.length ? `data-act="homeFridge" data-id="${pend[0].id}"` : `data-go="${r}"`}${r === "reception" && !homeRecLive() ? ' data-fresh="1"' : ""}><span class="qi">${ico(ic)}${n ? `<span class="bdg mono">${n}</span>` : ""}</span><span class="ql">${t}</span></button>`).join("")}</nav>`;

    const stat = (lbl, val, sub, go, tone, bar) => `<button class="hm-stat ${tone || ""}" data-go="${go}"><span class="sl">${lbl}</span><span class="sv mono">${val == null ? "–" : `<span class="hm-n" data-to="${val}">0</span>${bar != null ? "<small>%</small>" : ""}`}</span>${bar != null ? `<span class="sb"><i style="--w:${bar}%"></i></span>` : ""}<span class="ss">${sub}</span></button>`;
    const stats = `<section class="hm-stats st" style="--i:4" aria-label="Chiffres du jour">
      ${stat("En frigo", lots.length, lots.length > 1 ? "produits" : "produit", "frigos")}
      ${stat("DLC", watch, "à surveiller", "frigos", watch ? "warn" : "")}
      ${stat("Ménage", ch.pct, ch.total ? `${ch.done} / ${ch.total} du jour` : "à configurer", "menage", ch.pct === 100 ? "ok" : "", ch.pct ?? 0)}
      ${stat("Inventaire", inv.total ? inv.pct : null, inv.total ? MONTHS[now.getMonth()] : "aucun produit", "stock", inv.total && inv.pct === 100 ? "ok" : "", inv.total ? inv.pct : 0)}
    </section>`;

    const todoCard = `<section class="glass pad hm-todo st" style="--i:3" aria-label="À faire maintenant">
      <div class="row"><span class="lbl">À faire maintenant</span>${todo.length ? `<span class="pill ${urgent ? "bad" : "acc"}">${urgent ? `<span class="dot"></span>${homePlural(urgent, "urgence")}` : homePlural(todo.length, "tâche")}</span>` : ""}</div>
      ${todo.length ? `<div class="hm-list">${todo.slice(0, 9).map(homeTodoRow).join("")}</div>${todo.length > 9 ? `<p class="note" style="margin:6px 0 0;text-align:center">+ ${todo.length - 9} autres</p>` : ""}` : `<div class="hm-zen"><span class="check draw"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span><b>Tout est à jour</b><span>Relevés, DLC et ménage : rien ne presse.</span></div>`}
    </section>`;

    const stepsCard = homeStepsCard(fresh ? 3 : 5);
    return `<div class="inner hm">
      <header class="row st hm-head" style="--i:0"><div style="min-width:0"><button class="hm-date" data-act="restoSwitch">${DAYS[now.getDay()].replace(/^./, (c) => c.toUpperCase())} ${now.getDate()} ${MONTHS[now.getMonth()]} · ${esc(S.resto.name)}${ico("down")}</button><div class="title">${greet}${S.me.name ? " " + esc(firstName(S.me.name)) : ""}</div></div><button class="iconbtn" data-go="reglages" aria-label="Réglages" style="padding:0">${avatar(S.me.id)}</button></header>
      ${banner()}
      <div class="hm-grid ${fresh ? "fresh" : ""}">
        <div class="hm-col hm-l">${hero}${fresh ? stepsCard : ""}${todoCard}${fresh ? "" : stepsCard}</div>
        <div class="hm-col hm-r">${qa}${stats}${homeFeed(6)}</div>
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
    const row = a.closest(".hm-row"); if (row) row.classList.add("leaving");
    if (typeof ACT.choreDo === "function") return ACT.choreDo(a, id);
    const c = S.chores.find((x) => x.id === id); if (!c) return;
    await safe(DB.add("choreLogs", { choreId: id, at: Date.now(), day: dayKey(), uid: S.me.id })); await logEvent("chore", `a fait « ${c.name} »`, { ref: id }); SFX.ok(); buzz(10);
  },
  homeStarter: async (a) => {
    if (typeof ACT.choreStarter !== "function") return go("menage");
    a.style.pointerEvents = "none"; await ACT.choreStarter(a);
  },
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
