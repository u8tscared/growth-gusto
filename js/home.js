/* Growth Gusto — area: home */
VIEWS.home = {
  render() {
    const { done, exp } = todayStats(slotNow()); const pct = exp ? Math.round((done / exp) * 100) : 0;
    const now = new Date(); const greet = now.getHours() < 18 ? "Bonjour" : "Bonsoir";
    const slot = slotNow(); const pendSlot = S.fridges.filter((f) => !readingsFor(dayKey(), slot).find((r) => r.fridgeId === f.id));
    const urgent = activeLots().map((l) => ({ l, d: daysUntil(dlcOf(l)) })).filter((x) => x.d != null && x.d <= 1).sort((a, b) => a.d - b.d);
    const dueChores = choresDue();
    const todo = [
      ...urgent.slice(0, 4).map(({ l }) => `<div class="li tap" data-act="lot" data-id="${l.id}"><span class="ic bad">${ico("snow")}</span><div class="tx"><b>${esc(l.name)}${l.qty ? ` · ${fmt(num(l.qty), num(l.qty) % 1 ? 1 : 0)} ${esc(l.unit || "")}` : ""}</b><em>${l.status === "opened" ? "Ouvert · " : ""}${esc(fridgeName(l.fridgeId))}</em></div>${dlcPill(dlcOf(l))}</div>`),
      pendSlot.length ? `<div class="li tap" data-go="releve"><span class="ic warn">${ico("therm")}</span><div class="tx"><b>Relevé du ${slot} · ${pendSlot.length} frigo${pendSlot.length > 1 ? "s" : ""}</b><em>${esc(pendSlot.map((f) => f.name).join(", "))}</em></div><span class="pill warn">À faire</span></div>` : "",
      dueChores.length ? `<div class="li tap" data-go="menage"><span class="ic">${ico("spray")}</span><div class="tx"><b>Ménage · ${dueChores.length} tâche${dueChores.length > 1 ? "s" : ""}</b><em>${esc(dueChores.slice(0, 3).map((c) => c.name).join(", "))}</em></div><span class="pill acc">Aujourd'hui</span></div>` : "",
    ].filter(Boolean);
    const feed = S.events.slice(0, 8);
    const next = pendSlot.length ? `Relevé du ${slot} à faire` : slot === "midi" ? "Prochain relevé ce soir" : "Tout est à jour";
    const left = `
      <div class="hero st" style="--i:1" data-go="releve" role="button" tabindex="0" aria-label="Ouvrir les relevés"><div class="in">
        <div class="ring"><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="42" fill="none" stroke-width="9"/><circle class="br" id="ringBar" cx="50" cy="50" r="42" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="263.9" stroke-dashoffset="263.9" data-to="${263.9 * (1 - (exp ? done / exp : 0))}"/></svg><div class="num"><div><b id="ringPct" data-to="${pct}">0</b><b style="font-size:16px">%</b><small>${done} / ${exp} frigo${exp > 1 ? "s" : ""}</small></div></div></div>
        <div class="meta"><b>Relevé du ${slotNow()}</b><span>${exp ? (exp - done ? `${exp - done} frigo${exp - done > 1 ? "s" : ""} à relever` : `Bouclé${slotNow() === "midi" ? ", prochain ce soir" : " pour aujourd'hui"}`) : "Ajoutez vos frigos pour commencer"}</span><div class="nx">${exp - done > 0 ? `Relever ${esc(pendSlot[0]?.name || "")} →` : `${ico("check")}À jour`}</div></div>
      </div></div>
      <div class="qa st" style="--i:2">
        <button data-go="releve"><span class="ic">${ico("therm")}</span>Relevé</button>
        <button data-go="reception" data-fresh="1"><span class="ic">${ico("truck")}</span>Réception</button>
        <button data-go="scan"><span class="ic">${ico("scan")}</span>Scanner</button>
        <button data-go="stock"><span class="ic">${ico("list")}</span>Inventaire</button>
      </div>
      <div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">À traiter</span>${urgent.length ? `<span class="pill bad"><span class="dot"></span>${urgent.length} urgent${urgent.length > 1 ? "s" : ""}</span>` : ""}</div>
        ${todo.length ? `<div style="margin-top:4px">${todo.join("")}</div>` : `<div class="li"><span class="check">${'<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>'}</span><div class="tx"><b>Tout est en ordre</b><em>Aucune DLC proche, relevés et ménage à jour</em></div></div>`}
      </div>`;
    const lots = activeLots();
    const right = `
      <div class="glass pad st" style="--i:4"><div class="row"><span class="lbl">Activité de l'équipe</span><span class="avs">${S.members.slice(0, 4).map((m) => avatar(m.id)).join("")}</span></div>
        ${feed.length ? `<div style="margin-top:4px">${feed.map((e) => `<div class="li">${avatar(e.uid)}<div class="tx"><b>${esc(said(e.uid, e.text))}</b><em>${when(e.at)}</em></div></div>`).join("")}</div>` : `<div class="empty" style="padding:18px 0 6px"><b>Rien pour l'instant</b>Chaque relevé, réception ou ouverture apparaîtra ici avec son auteur.</div>`}
      </div>
      <div class="grid3 st" style="--i:5">
        <div class="glass pad" data-go="frigos" role="button" tabindex="0" style="cursor:pointer"><span class="lbl">En frigo</span><div class="h2 mono" style="margin-top:4px">${lots.length}</div><span class="sub">produits</span></div>
        <div class="glass pad" data-go="frigos" role="button" tabindex="0" style="cursor:pointer"><span class="lbl">DLC 3 j</span><div class="h2 mono" style="margin-top:4px;color:${lots.filter((l) => (daysUntil(dlcOf(l)) ?? 99) <= 3).length ? "var(--warn)" : "inherit"}">${lots.filter((l) => (daysUntil(dlcOf(l)) ?? 99) <= 3).length}</div><span class="sub">à surveiller</span></div>
        <div class="glass pad" data-go="stock" role="button" tabindex="0" style="cursor:pointer"><span class="lbl">Inventaire</span><div class="h2 mono" style="margin-top:4px">${invProgress().pct}%</div><span class="sub">${MONTHS[new Date().getMonth()]}</span></div>
      </div>`;
    return `<div class="inner">
      <div class="row st" style="--i:0"><div style="min-width:0"><button class="sub" data-act="restoSwitch" style="all:unset;cursor:pointer;font-size:13px;color:var(--muted);font-weight:650;display:inline-flex;align-items:center;gap:4px">${DAYS[now.getDay()].replace(/^./, (c) => c.toUpperCase())} ${now.getDate()} ${MONTHS[now.getMonth()]} · ${esc(S.resto.name)} ${ico("down", "").replace('class="ico ', 'style="width:14px;height:14px" class="ico ')}</button><div class="title" style="margin-top:4px">${greet}${S.me.name ? " " + esc(firstName(S.me.name)) : ""}</div></div><button class="iconbtn" data-go="reglages" aria-label="Réglages" style="padding:0">${avatar(S.me.id)}</button></div>
      ${banner()}
      <div class="cols"><div>${left}</div><div>${right}</div></div></div>`;
  },
  after(v) {
    requestAnimationFrame(() => setTimeout(() => {
      const b = $("#ringBar", v); if (b) b.style.strokeDashoffset = b.dataset.to;
      const p = $("#ringPct", v); if (p) countTo(p, v.classList.contains("nost") ? +p.dataset.to : 0, +p.dataset.to, 1100);
    }, v.classList.contains("nost") ? 0 : 180));
  },
};
function countTo(el, from, to, ms) { const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }


Object.assign(ACT, {
});
