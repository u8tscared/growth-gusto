/* Growth Gusto — area: releve */
VIEWS.releve = {
  render() {
    const day = dayKey(), slot = S.slot;
    if (!S.fridges.length) return `<div class="inner narrow">${topBar("Relevé des frigos")}<div class="glass st empty" style="--i:1"><div class="ic">${ico("snow")}</div><b>Aucun frigo</b>Ajoutez vos frigos et chambres froides avec leurs seuils.<div style="margin-top:14px"><button class="btn acc" data-act="fridgeEdit">Ajouter un frigo</button></div></div></div>`;
    const rs = readingsFor(day, slot);
    if (S.open == null || rs.find((r) => r.fridgeId === S.open)) S.open = S.fridges.find((f) => !rs.find((r) => r.fridgeId === f.id))?.id || null;
    const cards = S.fridges.map((f, i) => {
      const r = rs.find((x) => x.fridgeId === f.id);
      if (r) return `<div class="glass fr st" style="--i:${i + 2}"><div class="head"><span class="ic ${r.ok ? "" : "bad"}">${ico("snow")}</span><div style="flex:1;min-width:0"><b class="h3">${esc(f.name)}</b><div class="who">${avatar(r.uid, true)}${esc(firstName(nameOf(r.uid)))} · ${hm(r.at)}${r.ok ? "" : ` · <span style="color:var(--bad)">${esc(r.action || "hors seuil")}</span>`}</div></div><span class="t" style="color:${r.ok ? "var(--ok)" : "var(--bad)"}">${fmt(r.value)}°</span>${r.ok ? `<span class="check ${S.ui.justDone === f.id ? "draw" : ""}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : `<span class="check" style="background:var(--bad);box-shadow:0 6px 14px -6px rgba(212,42,72,.6)">${ico("alert").replace('class="ico ', 'style="width:15px;height:15px;color:#fff" class="ico ')}</span>`}</div></div>`;
      const last = S.readings.find((x) => x.fridgeId === f.id);
      const t = S.temp[f.id] ?? (last ? last.value : Math.round(((f.min + f.max) / 2) * 10) / 10);
      S.temp[f.id] = t; const isOpen = S.open === f.id; const bad = t > f.max || t < f.min;
      const lo = Math.min(-2, f.min - 2), hi = Math.max(8, f.max + 4); const pos = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
      return `<div class="glass fr ${isOpen ? "open" : ""} st" style="--i:${i + 2}" data-fr="${f.id}"><div class="head" data-act="frOpen" data-id="${f.id}"><span class="ic">${ico("snow")}</span><div style="flex:1;min-width:0"><b class="h3">${esc(f.name)}</b><div class="who">Seuil ${fmt(f.min, f.min % 1 ? 1 : 0)} à ${fmt(f.max, f.max % 1 ? 1 : 0)} °C${last ? ` · dernier ${fmt(last.value)}°` : ""}</div></div><span class="pend"></span></div>
        <div class="dial"><div><div class="dz">
          <div class="big"><button class="step" data-step="-1" data-id="${f.id}" aria-label="Moins 0,1 degré">${ico("minus")}</button><div class="v" id="tv-${f.id}" style="color:${bad ? "var(--bad)" : "inherit"}">${fmt(t)}<small>°C</small></div><button class="step" data-step="1" data-id="${f.id}" aria-label="Plus 0,1 degré">${ico("plus")}</button></div>
          <div><div class="scale" data-scale="${f.id}" data-lo="${lo}" data-hi="${hi}"><span class="safe" style="left:${pos(f.min)}%;right:${100 - pos(f.max)}%"></span><i id="tk-${f.id}" style="left:${pos(t)}%" data-lo="${lo}" data-hi="${hi}"></i></div><div class="scale-l"><span>${lo}°</span><span>${fmt(f.min, f.min % 1 ? 1 : 0)}°</span><span>${fmt(f.max, f.max % 1 ? 1 : 0)}°</span><span>${hi}°</span></div></div>
          <button class="btn acc block" data-act="saveReading" data-id="${f.id}">${ico("check")}Valider ${fmt(t)} °C</button>
        </div></div></div></div>`;
    }).join("");
    const doneN = new Set(rs.map((r) => r.fridgeId)).size;
    return `<div class="inner narrow">${topBar("Relevé des frigos", { right: `<span class="pill ${doneN === S.fridges.length ? "ok" : "acc"}">${doneN} / ${S.fridges.length}</span>` })}
      <div class="seg st" style="--i:1" id="slotSeg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${slot === "soir" ? "100%" : "0"})"></span><button class="${slot === "midi" ? "on" : ""}" data-act="slot" data-v="midi">Midi</button><button class="${slot === "soir" ? "on" : ""}" data-act="slot" data-v="soir">Soir</button></div>
      ${cards}
      <p class="note st" style="--i:9;text-align:center">Chaque relevé est daté et signé par la personne connectée. Il rejoint le registre automatiquement.</p></div>`;
  },
  after() { S.ui.justDone = null; },
};

VIEWS.frigos = {
  render() {
    const lots = activeLots();
    const list = S.fridges.map((f, i) => {
      const last = S.readings.find((r) => r.fridgeId === f.id); const fl = lots.filter((l) => l.fridgeId === f.id).sort((a, b) => (dlcOf(a) || "9").localeCompare(dlcOf(b) || "9"));
      const ok = last ? last.value >= f.min && last.value <= f.max : null;
      return `<div class="glass pad st" style="--i:${i + 1};cursor:pointer" data-go="frigo" data-id="${f.id}"><div class="row"><div class="hstack" style="min-width:0"><span class="ic ${ok === false ? "bad" : ""}">${ico("snow")}</span><div style="min-width:0"><b class="h3">${esc(f.name)}</b><div class="sub">${fl.length} produit${fl.length > 1 ? "s" : ""}${fl[0] ? ` · prochaine DLC ${shortDate(dlcOf(fl[0]))}` : ""}</div></div></div><div style="text-align:right"><div class="mono" style="font-size:24px;font-weight:700;color:${ok === false ? "var(--bad)" : "inherit"}">${last ? fmt(last.value) + "°" : "–"}</div><div class="sub" style="font-size:11.5px">${last ? when(last.at) : "jamais relevé"}</div></div></div></div>`;
    }).join("");
    return `<div class="inner wide">${topBar("Frigos", { noBack: true, right: `<button class="btn soft sm" data-act="fridgeEdit">${ico("plus")}Ajouter</button>` })}
      ${S.fridges.length ? `<div class="fgrid">${list}</div>` : `<div class="glass empty st" style="--i:1"><div class="ic">${ico("snow")}</div><b>Aucun frigo</b>Ajoutez vos frigos et chambres froides.</div>`}
      <div class="glass pad st" style="--i:8"><div class="row"><span class="lbl">Tous les produits en frigo</span><span class="sub">${lots.length}</span></div>${lotList(lots.sort((a, b) => (dlcOf(a) || "9").localeCompare(dlcOf(b) || "9")).slice(0, 30), true)}</div></div>`;
  },
};
function lotList(lots, showFridge) {
  if (!lots.length) return `<div class="empty" style="padding:16px 0 4px">Aucun produit. Ils arrivent ici à chaque réception, ou en scannant une étiquette.</div>`;
  return `<div style="margin-top:4px">${lots.map((l, i) => `<div class="li tap" data-act="lot" data-id="${l.id}"><span class="rank ${(daysUntil(dlcOf(l)) ?? 9) <= 1 ? "hot" : ""}">${i + 1}</span><div class="tx"><b>${esc(l.name)}${l.qty ? ` · ${fmt(num(l.qty), num(l.qty) % 1 ? 2 : 0)} ${esc(l.unit || "")}` : ""}</b><em>${l.status === "opened" ? `Ouvert le ${shortDate(dayKey(new Date(l.openedAt)))} par ${esc(firstName(nameOf(l.openedBy)))}` : `Entré le ${shortDate(dayKey(new Date(l.createdAt)))}`}${showFridge ? ` · ${esc(fridgeName(l.fridgeId))}` : ""}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</em></div>${dlcPill(dlcOf(l))}</div>`).join("")}</div>`;
}

VIEWS.frigo = {
  render({ id }) {
    const f = S.fridges.find((x) => x.id === id); if (!f) return `<div class="inner narrow">${topBar("Frigo")}<div class="glass empty">Ce frigo n'existe plus.</div></div>`;
    const rs = S.readings.filter((r) => r.fridgeId === id).slice(0, 14).reverse(); const last = rs[rs.length - 1];
    const ok = last ? last.value >= f.min && last.value <= f.max : null;
    const lots = activeLots().filter((l) => l.fridgeId === id).sort((a, b) => (dlcOf(a) || "9").localeCompare(dlcOf(b) || "9"));
    let chart = `<p class="note" style="margin-top:10px">La courbe apparaît après deux relevés.</p>`;
    if (rs.length >= 2) {
      const lo = Math.min(f.min - 1, ...rs.map((r) => r.value)) - 0.5, hi = Math.max(f.max + 1, ...rs.map((r) => r.value)) + 0.5;
      const W = 300, H = 100, x = (i) => (i / (rs.length - 1)) * W, y = (v) => H - ((v - lo) / (hi - lo)) * H;
      let d = `M${x(0)} ${y(rs[0].value)}`; for (let i = 1; i < rs.length; i++) { const cx = (x(i - 1) + x(i)) / 2; d += ` C${cx} ${y(rs[i - 1].value)} ${cx} ${y(rs[i].value)} ${x(i)} ${y(rs[i].value)}`; }
      chart = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Températures des 14 derniers relevés"><defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4A1FE6" stop-opacity=".28"/><stop offset="1" stop-color="#4A1FE6" stop-opacity="0"/></linearGradient></defs>
        <rect x="0" y="${y(f.max)}" width="${W}" height="${y(f.min) - y(f.max)}" fill="#2FB985" opacity=".1"/><line x1="0" x2="${W}" y1="${y(f.max)}" y2="${y(f.max)}" stroke="#D42A48" stroke-dasharray="3 5" opacity=".5"/>
        <path class="ar" d="${d} L${W} ${H} L0 ${H}Z" fill="url(#sg)"/><path class="ln" d="${d}" fill="none" stroke="#4A1FE6" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        ${rs.map((r, i) => (r.value > f.max || r.value < f.min ? `<circle class="pt" cx="${x(i)}" cy="${y(r.value)}" r="4" fill="#D42A48"/>` : "")).join("")}<circle class="pt" cx="${x(rs.length - 1)}" cy="${y(last.value)}" r="5" fill="#4A1FE6" stroke="#fff" stroke-width="2"/></svg>
        <div class="row" style="font-family:var(--mono);font-size:11px;color:var(--faint);margin-top:6px"><span>${shortDate(rs[0].day)} ${rs[0].slot}</span><span>${rs.length} derniers relevés</span><span>${shortDate(last.day)} ${last.slot}</span></div>`;
    }
    return `<div class="inner narrow">${topBar(esc(f.name), { right: `<button class="iconbtn" data-act="fridgeEdit" data-id="${f.id}" aria-label="Modifier">${ico("edit")}</button>` })}
      <div class="glass pad st" style="--i:1"><div class="row"><div><span class="lbl">Dernier relevé</span><div class="mono" style="font-size:46px;font-weight:700;letter-spacing:-.07em;line-height:1.05;margin-top:2px">${last ? fmt(last.value) : "–"}<span style="font-size:20px;color:var(--faint)">°C</span></div></div>${ok == null ? `<span class="pill neu">Pas de relevé</span>` : ok ? `<span class="pill ok"><span class="dot"></span>Conforme</span>` : `<span class="pill bad"><span class="dot"></span>Hors seuil</span>`}</div>${chart}</div>
      <div class="grid2 st" style="--i:2"><button class="btn soft" data-go="releve">${ico("therm")}Relever</button><button class="btn soft" data-go="scan">${ico("into")}Ranger un produit</button></div>
      <div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">À sortir en premier</span><span class="sub">${lots.length} produit${lots.length > 1 ? "s" : ""}</span></div>${lotList(lots, false)}</div></div>`;
  },
};


/* ───────────────────────── stepper long-press ───────────────────────── */
let holdT = null, holdI = null;
function stepTemp(id, dir) { setTemp(id, Math.round(((S.temp[id] ?? 3) + dir * 0.1) * 10) / 10); }
function setTemp(id, t) {
  const f = S.fridges.find((x) => x.id === id); if (!f) return; if (S.temp[id] === t) return;
  S.temp[id] = t;
  const v = $("#tv-" + id); if (v) { v.innerHTML = `${fmt(t)}<small>°C</small>`; v.style.color = t > f.max || t < f.min ? "var(--bad)" : ""; v.classList.remove("bump"); void v.offsetWidth; v.classList.add("bump"); }
  const k = $("#tk-" + id); if (k) { const lo = +k.dataset.lo, hi = +k.dataset.hi; k.style.left = Math.max(0, Math.min(100, ((t - lo) / (hi - lo)) * 100)) + "%"; }
  const b = $(`[data-act="saveReading"][data-id="${id}"]`); if (b) b.innerHTML = `${ico("check")}Valider ${fmt(t)} °C`;
  SFX.tick(); buzz(4);
}
document.addEventListener("pointerdown", (e) => {
  SFX.init();
  const sc = e.target.closest("[data-scale]");
  if (sc) {
    e.preventDefault(); const id = sc.dataset.scale, lo = +sc.dataset.lo, hi = +sc.dataset.hi; const r = sc.getBoundingClientRect();
    const at = (x) => setTemp(id, Math.round((lo + Math.max(0, Math.min(1, (x - r.left) / r.width)) * (hi - lo)) * 10) / 10);
    at(e.clientX); const k = $("#tk-" + id); k && (k.style.transition = "none");
    const mv = (ev) => at(ev.clientX); const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); k && (k.style.transition = ""); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); return;
  }
  const s = e.target.closest("[data-step]"); if (!s) return; e.preventDefault();
  const id = s.dataset.id, dir = +s.dataset.step; stepTemp(id, dir);
  holdT = setTimeout(() => { holdI = setInterval(() => stepTemp(id, dir), 70); }, 380);
});
["pointerup", "pointercancel", "pointerleave"].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(holdT); clearInterval(holdI); }, true));

async function commitReading(id, t, ok, action) {
  const f = S.fridges.find((x) => x.id === id);
  await safe(DB.add("readings", { fridgeId: id, value: t, slot: S.slot, day: dayKey(), at: Date.now(), uid: S.me.id, ok, action }));
  await logEvent("reading", `a relevé ${f.name} · ${fmt(t)} °C${ok ? "" : ` · hors seuil, ${action.toLowerCase()}`}`, { ref: id });
  S.ui.justDone = id; delete S.temp[id]; S.open = null;
  const allDone = S.fridges.every((fr) => fr.id === id || readingsFor(dayKey(), S.slot).find((r) => r.fridgeId === fr.id));
  if (allDone) { SFX.done(); buzz([12, 40, 12]); setTimeout(() => burst(), 120); toast(`Relevé du ${S.slot} complet`); }
  else { SFX.ok(); buzz(12); toast(`${f.name} · ${fmt(t)} °C, signé ${firstName(S.me.name) || ""}`.trim()); }
}

Object.assign(ACT, {
  slot: (a, id, v) => { S.slot = v; S.open = null; SFX.tick(); rerender(); },
  frOpen: (a, id) => { S.open = S.open === id ? "__none" : id; SFX.tap(); $$(".fr[data-fr]").forEach((el) => el.classList.toggle("open", el.dataset.fr === S.open)); },
  saveReading: async (a, id) => {
    const f = S.fridges.find((x) => x.id === id); const t = S.temp[id];
    if (!f || t == null || isNaN(t)) return; if (a && a.disabled) return; if (a && a.tagName === "BUTTON") { a.disabled = true; setTimeout(() => { a.disabled = false; }, 900); } const ok = t >= f.min && t <= f.max;
    if (!ok) {
      openSheet(`<div style="text-align:center"><span class="ic bad" style="width:56px;height:56px;border-radius:20px;margin:0 auto">${ico("alert")}</span><div class="h2" style="margin-top:10px;font-size:21px">${fmt(t)} °C, hors seuil</div><p class="sub" style="margin:4px 0 0">${esc(f.name)} doit être entre ${fmt(f.min, f.min % 1 ? 1 : 0)} et ${fmt(f.max, f.max % 1 ? 1 : 0)} °C. Qu'avez-vous fait ?</p></div>
        <div style="display:flex;flex-direction:column;gap:8px">${ACTIONS.map((x, i) => `<button class="chip" style="text-align:left;padding:13px 16px;border-radius:16px" data-act="corr" data-v="${esc(x)}" data-id="${id}">${esc(x)}</button>`).join("")}</div>`);
      SFX.err(); buzz([20, 40, 20]); return;
    }
    await commitReading(id, t, true, "");
  },
  corr: async (a, id, v) => { closeSheet(true); await commitReading(id, S.temp[id], false, v); },

  fridgeEdit: (a, id) => {
    const f = S.fridges.find((x) => x.id === id) || { name: "", min: 0, max: 4 };
    openSheet(`<div class="h2" style="font-size:20px">${id ? "Modifier le frigo" : "Nouveau frigo"}</div>
      <label class="field"><span>Nom</span><input class="input" id="fName" value="${esc(f.name)}" placeholder="Chambre froide 3"></label>
      <div class="grid2"><label class="field"><span>Minimum °C</span><input class="input mono" id="fMin" inputmode="decimal" value="${fmt(f.min, f.min % 1 ? 1 : 0)}"></label><label class="field"><span>Maximum °C</span><input class="input mono" id="fMax" inputmode="decimal" value="${fmt(f.max, f.max % 1 ? 1 : 0)}"></label></div>
      <div class="chips">${[["Froid positif", 0, 4], ["Produits de la mer", 0, 2], ["Bar / boissons", 2, 8], ["Congélateur", -25, -18]].map(([n, lo, hi]) => `<button class="chip" data-act="fPreset" data-lo="${lo}" data-hi="${hi}">${n}</button>`).join("")}</div>
      <button class="btn acc block" data-act="fridgeSave" data-id="${id || ""}">Enregistrer</button>${id ? `<button class="btn ghost block" style="color:var(--bad)" data-act="fridgeDel" data-id="${id}">Supprimer ce frigo</button>` : ""}`);
  },
  fPreset: (a) => { $("#fMin").value = a.dataset.lo; $("#fMax").value = a.dataset.hi; SFX.tick(); },
  fridgeSave: async (a, id) => {
    const name = $("#fName").value.trim(), min = num($("#fMin").value), max = num($("#fMax").value);
    if (!name || min == null || max == null || min >= max) { SFX.err(); toast("Indiquez un nom et un minimum plus bas que le maximum.", "err"); return; }
    if (id) await safe(DB.update("fridges", id, { name, min, max })); else await safe(DB.add("fridges", { name, min, max, order: S.fridges.length, createdAt: Date.now() }));
    closeSheet(true); SFX.ok(); toast(id ? "Frigo mis à jour" : "Frigo ajouté");
  },
  fridgeDel: (a, id) => { openSheet(`<div class="h2" style="font-size:20px">Supprimer ${esc(fridgeName(id))} ?</div><p class="sub" style="margin:0">Les relevés passés restent dans le registre.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="fridgeDelOk" data-id="${id}">Supprimer</button></div>`); },
  fridgeDelOk: async (a, id) => { await safe(DB.del("fridges", id)); closeSheet(true); toast("Frigo supprimé"); if (S.route === "frigo") goBack(); },
});
