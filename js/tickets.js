/* Growth Gusto — area: tickets (tickets Z : ventes du jour → consommation théorique) */
TAB_OF.tzEdit = "more";
Object.assign(IC, {
  pot: ["M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6Z", "M2 10h20", "M9 6c0-1 1-1 1-2", "M14 6c0-1 1-1 1-2"],
});

/* ───────── helpers ───────── */
const tkNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tkSing = (s) => s.split(" ").map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w)).join(" ");
const tkTrim = (s) => (s.includes(",") ? s.replace(/0+$/, "").replace(/,$/, "") : s);
const tkEur = (v, d = 2) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const tkPhotos = (t) => [...(t.photos || []), ...(t.photoUrls || [])].filter(Boolean);
function tkDayLabel(k, long) {
  const d = parseDay(k); if (!d) return "?";
  if (k === dayKey()) return "Aujourd'hui"; if (k === addDays(dayKey(), -1)) return "Hier";
  return long ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : `${DAYS[d.getDay()].slice(0, 3)}. ${shortDate(k)}`;
}
const tkRecipes = () => S.notes.filter((n) => n.cat === "Recettes" && (n.title || "").trim());
function tkRecipeFor(l) {
  const R = tkRecipes(); if (l.noteId) { const r = R.find((n) => n.id === l.noteId); if (r) return r; }
  const k = tkSing(tkNorm(l.libelle)); if (!k) return null;
  return R.find((n) => tkSing(tkNorm(n.title)) === k) || R.find((n) => { const t = tkSing(tkNorm(n.title)); return t.length >= 5 && k.length >= 5 && (k.includes(t) || t.includes(k)); }) || null;
}
const TK_U = { g: ["g", 1], gr: ["g", 1], gramme: ["g", 1], grammes: ["g", 1], kg: ["g", 1000], mg: ["g", 0.001], ml: ["ml", 1], cl: ["ml", 10], dl: ["ml", 100], l: ["ml", 1000], litre: ["ml", 1000], litres: ["ml", 1000] };
const tkUnit = (u) => TK_U[tkNorm(u)] || [String(u || "").trim() || "pièce", 1];
function tkQty(v, base) {
  if (base === "g") return v >= 1000 ? tkTrim(fmt(v / 1000, v >= 10000 ? 1 : 2)) + " kg" : Math.round(v) + " g";
  if (base === "ml") return v >= 1000 ? tkTrim(fmt(v / 1000, 2)) + " L" : Math.round(v) + " ml";
  return tkTrim(fmt(v, v < 10 ? 2 : 1)) + " " + base;
}
/* Consommation théorique : Σ plats vendus × (ingrédients de la fiche ÷ portions) */
function tkConsumption(tickets) {
  const m = new Map(), miss = new Map(); let dishes = 0, matched = 0;
  tickets.forEach((t) => (t.lines || []).forEach((l) => {
    const q = num(l.quantite) || 0; if (q <= 0 || !l.libelle) return; dishes += q;
    const r = tkRecipeFor(l); const ings = ((r && r.ingredients) || []).filter((g) => g.name && num(g.qty));
    if (!ings.length) { miss.set(l.libelle, (miss.get(l.libelle) || 0) + q); return; }
    matched += q; const por = num(r.portions) || 1;
    ings.forEach((g) => { const [b, f] = tkUnit(g.unit); const k = tkNorm(g.name) + "|" + b; const e = m.get(k) || { name: g.name.trim(), base: b, v: 0, from: new Set() }; e.v += (num(g.qty) * f * q) / por; e.from.add(r.title.trim()); m.set(k, e); });
  }));
  let cost = 0, costed = 0;
  const rows = [...m.values()].map((e) => {
    const p = S.products.find((x) => tkNorm(x.name) === tkNorm(e.name)); let c = null;
    if (p && num(p.price)) { const [pb, pf] = tkUnit(p.unit); if (pb === e.base) { c = (e.v / pf) * num(p.price); cost += c; costed++; } }
    return { ...e, from: [...e.from], cost: c };
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { rows, miss: [...miss].sort((a, b) => b[1] - a[1]), dishes, matched, cost: costed ? cost : null, costed };
}
function tkByDay() { const m = {}; S.tickets.forEach((t) => { if (!t.date) return; const d = (m[t.date] ||= { total: 0, has: false, list: [] }); if (num(t.total) != null) { d.total += num(t.total); d.has = true; } d.list.push(t); }); return m; }
function tkDishes() {
  const m = new Map();
  tkRecipes().forEach((r) => m.set(tkSing(tkNorm(r.title)), { name: r.title.trim(), noteId: r.id, recipe: (r.ingredients || []).length > 0, n: 0 }));
  S.tickets.forEach((t) => (t.lines || []).forEach((l) => { if (!l.libelle) return; const r = tkRecipeFor(l); const k = r ? tkSing(tkNorm(r.title)) : tkSing(tkNorm(l.libelle)); const e = m.get(k) || { name: l.libelle.trim(), noteId: "", recipe: false, n: 0 }; e.n += num(l.quantite) || 1; m.set(k, e); }));
  return [...m.values()];
}
function tkTop(days = 14) {
  const from = addDays(dayKey(), -(days - 1)); const m = new Map();
  S.tickets.filter((t) => (t.date || "") >= from).forEach((t) => (t.lines || []).forEach((l) => { const q = num(l.quantite) || 0; if (!l.libelle || q <= 0) return; const r = tkRecipeFor(l); const k = r ? "#" + r.id : tkSing(tkNorm(l.libelle)); const e = m.get(k) || { name: r ? r.title.trim() : l.libelle.trim(), q: 0 }; e.q += q; m.set(k, e); }));
  return [...m.values()].sort((a, b) => b.q - a.q);
}
const tkCount = (list) => tkTrim(fmt(list.reduce((a, t) => a + (t.lines || []).reduce((b, l) => b + (num(l.quantite) || 0), 0), 0), 1));
function tkReadout(k, by) { const d = by[k]; return `<b>${tkDayLabel(k, true)}</b><span class="mono">${d && d.has ? tkEur(d.total) : d ? "CA non saisi" : "pas de ticket"}</span>`; }

/* ───────── vue principale ───────── */
VIEWS.tickets = {
  render() {
    const today = dayKey(); const by = tkByDay(); const tT = by[today];
    const days = [...Array(14)].map((_, i) => addDays(today, i - 13));
    const sum14 = days.reduce((a, d) => a + (by[d]?.total || 0), 0); const open14 = days.filter((d) => by[d]?.has).length;
    if (!S.ui.tkDay || (!by[S.ui.tkDay] && !days.includes(S.ui.tkDay))) S.ui.tkDay = tT ? today : (S.tickets.map((t) => t.date).filter(Boolean).sort().pop() || today);
    const sel = S.ui.tkDay; const per = S.ui.tkPer || "jour";
    const range = per === "jour" ? [sel] : [...Array(7)].map((_, i) => addDays(sel, i - 6));
    const C = tkConsumption(S.tickets.filter((t) => range.includes(t.date)));
    const caR = range.reduce((a, d) => a + (by[d]?.total || 0), 0);
    const top = tkTop(14).slice(0, 6);

    const todayCard = tT ? `<div class="glass pad st tk-today" style="--i:1"><div class="hstack"><span class="ic ok">${ico("check")}</span><div style="flex:1;min-width:0"><b class="h3">Ticket du jour saisi</b><div class="sub"><span class="mono">${tkEur(tT.total)}</span> · ${tkCount(tT.list)} plats</div></div><button class="btn soft sm" data-act="tzOpen" data-id="${tT.list[0].id}">${ico("edit")}Modifier</button></div><button class="btn ghost sm" data-act="tzOther" style="align-self:flex-start">${ico("plus")}Saisir un autre jour</button></div>`
      : `<div class="glass pad st tk-today" style="--i:1"><div class="hstack"><span class="ic">${ico("receipt")}</span><div style="min-width:0"><b class="h3">Ticket Z du jour</b><div class="sub">Plats vendus et chiffre d'affaires, en 30 secondes.</div></div></div>
        <button class="btn acc block" data-act="tzManual">${ico("edit")}Saisir le ticket du jour</button>
        ${S.cap.sample ? `<button class="btn soft block" data-act="tzPick">${ico("camera")}Scanner le ticket (photos)</button>` : ""}</div>`;

    const chart = `<div class="glass pad st" style="--i:2"><div class="row"><span class="lbl">Chiffre d'affaires · 14 jours</span><span class="sub">${open14} jour${open14 > 1 ? "s" : ""} saisi${open14 > 1 ? "s" : ""}</span></div>
      <div class="tk-kpi"><b class="mono">${tkEur(sum14, 0)}</b><span class="sub">${open14 ? `moy. <span class="mono">${tkEur(sum14 / open14, 0)}</span> / jour` : "aucune vente saisie"}</span></div>
      <div class="tk-read" id="tkRead">${tkReadout(sel, by)}</div>
      <div class="tk-chart" id="tkChart" data-days="${days.join(",")}"></div></div>`;

    const cons = `<div class="glass pad st" style="--i:3;display:flex;flex-direction:column;gap:10px">
      <div class="hstack" style="min-width:0"><span class="ic">${ico("pot")}</span><div style="min-width:0"><b class="h3">Consommation théorique</b><div class="sub">${per === "jour" ? tkDayLabel(sel, true) : `7 jours jusqu'au ${shortDate(sel)}`}</div></div></div>
      <div class="seg tk-seg"><button class="${per === "jour" ? "on" : ""}" data-act="tkPer" data-v="jour">Jour</button><button class="${per === "sem" ? "on" : ""}" data-act="tkPer" data-v="sem">7 jours</button></div>
      ${tkConsHtml(C, caR)}</div>`;

    const topCard = `<div class="glass pad st" style="--i:4"><div class="row"><span class="lbl">Plats les plus vendus · 14 jours</span></div>${top.length ? top.map((d, i) => `<div class="li tk-top"><span class="rank ${i === 0 ? "hot" : ""}">${i + 1}</span><div class="tx"><b>${esc(d.name)}</b><i class="tk-bar"><i style="width:${Math.max(4, (d.q / top[0].q) * 100)}%"></i></i></div><span class="mono" style="font-weight:700">${tkTrim(fmt(d.q, 1))}</span></div>`).join("") : `<div class="empty" style="padding:14px 0 4px">Les plats vendus apparaîtront ici.</div>`}</div>`;

    const hist = [...S.tickets].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.at || 0) - (a.at || 0));
    const histCard = `<div class="glass pad st" style="--i:5"><div class="row"><span class="lbl">Historique</span><span class="sub">${S.tickets.length}</span></div>${hist.map((t) => `<div class="li tap" data-act="ticket" data-id="${t.id}"><span class="ic">${ico("receipt")}</span><div class="tx"><b>${t.date ? tkDayLabel(t.date) : "Date inconnue"}</b><em>${tkCount([t])} plats · ${esc(firstName(nameOf(t.uid)))}${tkPhotos(t).length || (t.photoIds || []).length ? " · photo ✓" : ""}</em></div><span class="mono" style="font-weight:700">${t.total != null ? tkEur(t.total) : "–"}</span></div>`).join("") || `<div class="empty" style="padding:16px 0 4px">Aucun ticket enregistré.</div>`}</div>`;

    return `<div class="inner">${topBar("Tickets de caisse")}<div class="cols"><div>${todayCard}${chart}${cons}</div><div>${topCard}${histCard}</div></div></div>`;
  },
  after(v) { tkDrawChart(v); if (!tkResizeBound) { tkResizeBound = true; window.addEventListener("resize", debounce(() => { if (S.route === "tickets") tkDrawChart($("#viewport .view:not(.leave)")); }, 150)); } },
};
let tkResizeBound = false;

function tkConsHtml(C, ca) {
  if (!C.dishes) return `<div class="empty" style="padding:10px 0 2px">Aucun plat vendu sur cette période.</div>`;
  if (!C.rows.length) return `<div class="tk-hint">${ico("book")}<span>Aucun plat vendu n'est relié à une fiche recette avec ingrédients. Créez la fiche (même nom que sur le ticket) pour voir ce qui sort du stock.</span></div><button class="btn soft sm" data-go="note" data-id="new" style="align-self:flex-start">${ico("plus")}Créer une fiche recette</button>${tkMissHtml(C)}`;
  return `<div class="tk-cons">${C.rows.map((r) => `<div class="li"><div class="tx"><b>${esc(r.name)}</b><em>${esc(r.from.join(", "))}${r.cost != null ? ` · ≈ ${tkEur(r.cost)}` : ""}</em></div><span class="mono tk-q">${tkQty(r.v, r.base)}</span></div>`).join("")}</div>
    ${C.cost != null ? (C.costed === C.rows.length ? `<div class="tk-cost"><span>Coût matière estimé</span><b class="mono">${tkEur(C.cost)}${ca ? ` <small>· ${fmt((C.cost / ca) * 100, 0)} % du CA</small>` : ""}</b></div>` : `<div class="tk-cost part"><span>Coût matière partiel<small>prix connu pour ${C.costed} ingrédient${C.costed > 1 ? "s" : ""} sur ${C.rows.length} (Stock)</small></span><b class="mono">${tkEur(C.cost)}</b></div>`) : ""}
    <div class="note">${tkTrim(fmt(C.matched, 1))} plat${C.matched > 1 ? "s" : ""} sur ${tkTrim(fmt(C.dishes, 1))} relié${C.matched > 1 ? "s" : ""} à une fiche recette. Quantité = ingrédients de la fiche ÷ portions × plats vendus.</div>${tkMissHtml(C)}`;
}
function tkMissHtml(C) { if (!C.miss.length) return ""; return `<div class="tk-miss"><span class="lbl">Sans fiche recette</span><div class="tk-pills">${C.miss.slice(0, 8).map(([n, q]) => `<span class="pill neu">${esc(n)} ×${tkTrim(fmt(q, 1))}</span>`).join("")}</div></div>`; }

/* Barres SVG, dessinées à la largeur réelle du conteneur */
function tkDrawChart(v) {
  const el = v && $("#tkChart", v); if (!el) return;
  const days = el.dataset.days.split(","); const by = tkByDay(); const W = Math.max(240, el.clientWidth || 320), H = 150, top = 16, bot = 26, ch = H - top - bot;
  const vals = days.map((d) => by[d]?.total || 0); const max = Math.max(...vals, 1); const band = W / days.length; const bw = Math.min(28, band - 6); const sel = S.ui.tkDay; const today = dayKey();
  const bars = days.map((d, i) => {
    const x = i * band + (band - bw) / 2, val = vals[i], h = val > 0 ? Math.max(4, (val / max) * ch) : 0, y = top + ch - h, r = Math.min(4, bw / 2, h);
    const lab = "DLMMJVS"[parseDay(d).getDay()];
    const mark = h ? `<path class="tk-b ${d === sel ? "on" : ""}" d="M${x},${top + ch} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + ch} Z"/>` : by[d] ? `<rect class="tk-b0 has" x="${x}" y="${top + ch - 3}" width="${bw}" height="3" rx="1.5"/>` : `<rect class="tk-b0" x="${x + bw / 2 - 2}" y="${top + ch - 4}" width="4" height="4" rx="2"/>`;
    return `${mark}<text class="tk-x ${d === sel ? "on" : ""} ${d === today ? "td" : ""}" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${lab}</text><rect class="tk-hit" data-act="tkDay" data-v="${d}" x="${i * band}" y="0" width="${band}" height="${H}"><title>${tkDayLabel(d, true)} : ${by[d]?.has ? tkEur(by[d].total) : "–"}</title></rect>`;
  }).join("");
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiffre d'affaires des 14 derniers jours"><line class="tk-grid" x1="0" x2="${W}" y1="${top}" y2="${top}"/><text class="tk-y" x="${W}" y="${top - 5}" text-anchor="end">${tkEur(max, 0)}</text><line class="tk-base" x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}"/>${bars}</svg>`;
  const rd = $("#tkRead", v);
  $$(".tk-hit", el).forEach((h) => { h.addEventListener("mouseenter", () => { rd.innerHTML = tkReadout(h.dataset.v, by); }); h.addEventListener("mouseleave", () => { rd.innerHTML = tkReadout(S.ui.tkDay, by); }); });
}

/* ───────── saisie ───────── */
VIEWS.tzEdit = {
  live: false,
  render() {
    if (!S.tz) tkNew();
    const T = S.tz; const by = tkByDay(); const dup = (by[T.date]?.list || []).find((t) => t.id !== T.id);
    const n = T.lines.reduce((a, l) => a + (num(l.quantite) || 0), 0); const lineSum = T.lines.reduce((a, l) => a + (num(l.montant) || 0), 0);
    const C = tkConsumption([{ lines: T.lines }]);
    const busy = T.busy ? `<div class="glass pad st" style="--i:1;display:flex;flex-direction:column;gap:10px"><div class="thumbs">${T.pics.map((p) => `<span class="thumb scan"><img src="${esc(p.src)}" alt=""></span>`).join("")}</div><span class="note">Lecture du ticket… cela prend quelques secondes.</span></div>` : "";
    return `<div class="inner narrow tk-edit">${topBar(T.id ? "Modifier le ticket" : "Nouveau ticket Z", { right: T.id ? `<button class="iconbtn" data-act="tzDel" aria-label="Supprimer" style="color:var(--bad)">${ico("trash")}</button>` : "" })}
      ${busy}${T.err ? `<div class="banner st" style="--i:1">${ico("alert")}<span>${esc(T.err)}</span></div>` : ""}
      <div class="glass pad st" style="--i:1;display:flex;flex-direction:column;gap:10px"><span class="lbl">Date du ticket</span>
        <div class="tk-dates"><button class="chip ${T.date === dayKey() ? "on" : ""}" data-act="tzDate" data-v="${dayKey()}">Aujourd'hui</button><button class="chip ${T.date === addDays(dayKey(), -1) ? "on" : ""}" data-act="tzDate" data-v="${addDays(dayKey(), -1)}">Hier</button><input class="input mono" type="date" data-bind="tz.date" data-rer="1" value="${esc(T.date)}" max="${dayKey()}" aria-label="Autre date"></div>
        ${dup ? `<div class="banner">${ico("alert")}<span style="flex:1">Un ticket existe déjà pour le ${shortDate(T.date)}.</span><button class="btn ghost sm" data-act="tzOpen" data-id="${dup.id}" style="height:28px;padding:0 6px">Ouvrir</button></div>` : ""}</div>

      <div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:10px"><div class="row"><span class="lbl">Plats vendus</span><span class="sub mono">${tkTrim(fmt(n, 1))}</span></div>
        <div class="tk-search"><span class="tk-sico">${ico("search")}</span><input class="input" id="tzQ" placeholder="Ajouter un plat…" autocomplete="off" enterkeyhint="done" value="${esc(S.ui.tzQ || "")}"></div>
        <div id="tzSug" class="tk-sug">${tkSugHtml()}</div>
        <div class="tk-lines">${T.lines.map((l, i) => tkLineHtml(l, i)).join("") || `<div class="empty" style="padding:8px 0 4px;font-size:13px">Touchez un plat ci-dessus ou tapez son nom.</div>`}</div></div>

      <div class="glass pad st" style="--i:3;display:flex;flex-direction:column;gap:8px"><label class="field"><span>Chiffre d'affaires TTC</span><div class="tk-ca"><input class="input mono" id="tzTotal" inputmode="decimal" data-bind="tz.total" value="${esc(T.total ?? "")}" placeholder="0,00"><b>€</b></div></label>
        ${lineSum > 0 && num(T.total) !== Math.round(lineSum * 100) / 100 ? `<button class="btn ghost sm" data-act="tzUseSum" data-v="${lineSum}" style="align-self:flex-start">Utiliser la somme des lignes : ${tkEur(lineSum)}</button>` : ""}</div>

      <div class="glass pad st" style="--i:4;display:flex;flex-direction:column;gap:10px"><div class="row"><span class="lbl">Photo du ticket · preuve</span><span class="sub">facultatif</span></div>
        ${T.pics.length && !T.busy ? `<div class="thumbs">${T.pics.map((p, i) => `<span class="thumb"><img src="${esc(p.src)}" alt="Ticket Z"><button class="tk-px" data-act="tzPhotoDel" data-v="${i}" aria-label="Retirer la photo">${ico("x")}</button></span>`).join("")}</div>` : ""}
        <button class="btn soft" data-act="tzPhoto" ${T.busy ? "disabled" : ""}>${ico("camera")}${T.pics.length ? "Ajouter une photo" : "Photographier le ticket Z"}</button></div>

      ${C.rows.length ? `<div class="glass pad st" style="--i:5;display:flex;flex-direction:column;gap:6px"><div class="hstack"><span class="ic">${ico("pot")}</span><div><b class="h3">Ce que ce ticket consomme</b><div class="sub">Selon vos fiches recettes</div></div></div><div class="tk-cons">${C.rows.map((r) => `<div class="li"><div class="tx"><b>${esc(r.name)}</b><em>${esc(r.from.join(", "))}</em></div><span class="mono tk-q">${tkQty(r.v, r.base)}</span></div>`).join("")}</div></div>` : ""}

      <div class="ctabar"><button class="btn acc block" data-act="tzSave" ${T.busy ? "disabled" : ""}>${ico("check")}Enregistrer${n ? ` · ${tkTrim(fmt(n, 1))} plat${n > 1 ? "s" : ""}` : ""}</button></div></div>`;
  },
  after(v) {
    setTimeout(() => { if (S.route === "tzEdit") $("#tabbar").classList.add("hide"); }, 0);
    const q = $("#tzQ", v); if (!q) return;
    q.addEventListener("input", () => { S.ui.tzQ = q.value; $("#tzSug", v).innerHTML = tkSugHtml(); });
    q.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; e.preventDefault(); const f = $("#tzSug [data-act=tzAdd]", v); if (f && q.value.trim()) f.click(); else q.blur(); });
    if (S.ui.tzFocus) { S.ui.tzFocus = false; q.focus({ preventScroll: true }); }
    if (S.ui.tzBump != null) { const b = $(`[data-qi="${S.ui.tzBump}"]`, v); S.ui.tzBump = null; if (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } }
  },
};
function tkLineHtml(l, i) {
  const r = tkRecipeFor(l); const ok = r && (r.ingredients || []).length;
  return `<div class="tk-line"><div class="tx"><b>${esc(l.libelle)}</b><em>${ok ? `<span class="tk-ok">${ico("check")}fiche recette</span>` : r ? "fiche sans ingrédients" : "sans fiche recette"}${num(l.montant) != null ? ` · ${tkEur(num(l.montant))}` : ""}</em></div>
    <div class="tk-step"><button class="step" data-act="tzDec" data-v="${i}" aria-label="Moins">${ico(num(l.quantite) > 1 ? "minus" : "trash")}</button><input class="mono" data-qi="${i}" inputmode="decimal" data-bind="tz.lines.${i}.quantite" value="${esc(l.quantite ?? "")}" aria-label="Quantité ${esc(l.libelle)}"><button class="step" data-act="tzInc" data-v="${i}" aria-label="Plus">${ico("plus")}</button></div></div>`;
}
function tkSugHtml() {
  const T = S.tz; const raw = (S.ui.tzQ || "").trim(); const q = tkNorm(raw); const have = new Set(T.lines.map((l) => tkSing(tkNorm(l.libelle)))); const ids = new Set(T.lines.map((l) => tkRecipeFor(l)?.id).filter(Boolean));
  const all = tkDishes().filter((d) => !have.has(tkSing(tkNorm(d.name))) && !(d.noteId && ids.has(d.noteId)));
  if (!q) {
    const pick = all.sort((a, b) => b.n - a.n || b.recipe - a.recipe || a.name.localeCompare(b.name, "fr")).slice(0, 10);
    return pick.length ? `<div class="tk-quick">${pick.map((d) => `<button class="chip" data-act="tzAdd" data-v="${esc(d.name)}" data-id="${d.noteId}">${ico("plus")}${esc(d.name)}</button>`).join("")}</div>` : "";
  }
  const hits = all.map((d) => { const k = tkNorm(d.name); const s = k.startsWith(q) ? 3 : k.split(" ").some((w) => w.startsWith(q)) ? 2 : k.includes(q) ? 1 : 0; return { ...d, s }; }).filter((d) => d.s).sort((a, b) => b.s - a.s || b.n - a.n).slice(0, 6);
  const exact = hits.some((d) => tkNorm(d.name) === q) || have.has(tkSing(q));
  return `<div class="tk-ac">${hits.map((d) => `<button class="tk-opt" data-act="tzAdd" data-v="${esc(d.name)}" data-id="${d.noteId}"><span>${esc(d.name)}</span>${d.recipe ? `<span class="pill acc">fiche</span>` : d.n ? `<span class="sub">vendu ${tkTrim(fmt(d.n, 1))}×</span>` : ""}</button>`).join("")}${exact ? "" : `<button class="tk-opt new" data-act="tzAdd" data-v="${esc(raw)}">${ico("plus")}<span>Ajouter « ${esc(raw)} »</span></button>`}</div>`;
}
function tkNew(date = dayKey()) { S.tz = { id: null, busy: false, pics: [], lines: [], date, total: "" }; S.ui.tzQ = ""; }
function tkEditFrom(t) {
  const urls = t.photoUrls || [];
  S.tz = { id: t.id, busy: false, at: t.at, uid: t.uid, date: t.date || dayKey(), total: t.total != null ? String(t.total).replace(".", ",") : "",
    lines: (t.lines || []).map((l) => ({ libelle: l.libelle || "", quantite: l.quantite != null ? String(l.quantite).replace(".", ",") : "", montant: l.montant != null ? String(l.montant).replace(".", ",") : "", noteId: l.noteId || "" })),
    pics: [...(t.photos || []).map((s) => ({ src: s, data: s })), ...urls.map((s, i) => ({ src: s, id: (t.photoIds || [])[i] || "", url: s }))], keepIds: (t.photoIds || []).slice(urls.length) };
  S.ui.tzQ = "";
}

Object.assign(ACT, {
  tkPer: (a, id, v) => { S.ui.tkPer = v; SFX.tick(); rerender(); },
  tkDay: (a, id, v) => { S.ui.tkDay = v; SFX.tick(); buzz(4); rerender(); },
  tzManual: () => { const t = S.tickets.find((x) => x.date === dayKey()); if (t) tkEditFrom(t); else tkNew(); SFX.tap(); go("tzEdit"); },
  tzOther: () => { tkNew(addDays(dayKey(), -1)); if (S.tickets.some((x) => x.date === S.tz.date)) S.tz.date = ""; SFX.tap(); go("tzEdit"); },
  tzOpen: (a, id) => { const t = S.tickets.find((x) => x.id === id); if (!t) return; closeSheet(true); tkEditFrom(t); SFX.tap(); if (S.route === "tzEdit") rerender(); else go("tzEdit"); },
  tzDate: (a, id, v) => { S.tz.date = v; SFX.tick(); rerender(); },
  tzAdd: (a, id, v) => {
    const name = (v || "").trim(); if (!name) return; const T = S.tz; const k = tkSing(tkNorm(name));
    let i = T.lines.findIndex((l) => tkSing(tkNorm(l.libelle)) === k);
    if (i >= 0) T.lines[i].quantite = tkTrim(fmt((num(T.lines[i].quantite) || 0) + 1, 1)); else { T.lines.push({ libelle: name, quantite: "1", montant: "", noteId: id || "" }); i = T.lines.length - 1; }
    S.ui.tzBump = i; S.ui.tzFocus = !!(S.ui.tzQ || "").trim(); S.ui.tzQ = ""; SFX.tap(); buzz(6); rerender();
  },
  tzInc: (a, id, v) => { const L = S.tz.lines[+v]; L.quantite = tkTrim(fmt((num(L.quantite) || 0) + 1, 1)); S.ui.tzBump = +v; SFX.tick(); buzz(4); rerender(); },
  tzDec: (a, id, v) => { const T = S.tz; const L = T.lines[+v]; const q = num(L.quantite) || 0; if (q <= 1) { T.lines.splice(+v, 1); SFX.close(); } else { L.quantite = tkTrim(fmt(q - 1, 1)); S.ui.tzBump = +v; SFX.tick(); } buzz(4); rerender(); },
  tzUseSum: (a, id, v) => { S.tz.total = fmt(+v, 2); SFX.tick(); rerender(); },
  tzPhoto: async () => {
    const [f] = await pickImage(); if (!f) return; const T = S.tz;
    try {
      const { blob, canvas } = await shrink(f, 1100, 0.62); const u = await upload(blob);
      if (u.id) T.pics.push({ src: u.url, id: u.id, url: u.url }); else { const d = canvas.toDataURL("image/jpeg", 0.6); T.pics.push({ src: d, data: d }); }
      SFX.ok(); buzz(8); rerender();
    } catch (e) { console.warn(e); SFX.err(); toast("Photo illisible, réessayez.", "err"); }
  },
  tzPhotoDel: (a, id, v) => { S.tz.pics.splice(+v, 1); SFX.close(); rerender(); },
  tzPick: async () => {
    const files = await pickImage(true); if (!files.length) return;
    const shr = await Promise.all(files.slice(0, 6).map((f) => shrink(f, 1800, 0.85)));
    S.tz = { id: null, busy: true, pics: shr.map((s) => ({ src: URL.createObjectURL(s.blob) })), lines: [], date: dayKey(), total: "" }; S.ui.tzQ = "";
    if (S.route === "tzEdit") rerender(); else go("tzEdit");
    const ups = Promise.all(shr.map((s) => upload(s.blob)));
    try {
      const r = await S.cap.sample.json(`Ces photos montrent, dans l'ordre, un ticket Z (clôture de caisse) d'un restaurant français, éventuellement en plusieurs morceaux qui se suivent. Extrais les ventes. Réponds uniquement en JSON : {"date":"AAAA-MM-JJ","total_ttc":nombre,"lignes":[{"libelle":"","quantite":nombre,"montant":nombre}]}. Une ligne par article ou famille vendue, sans les totaux, taxes ni moyens de paiement. Nombres avec un point décimal.`, { images: shr.map((s) => s.blob), modelTier: "complex" });
      S.tz.date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : dayKey(); S.tz.total = r.total_ttc != null ? String(r.total_ttc).replace(".", ",") : "";
      S.tz.lines = (r.lignes || []).map((l) => ({ libelle: l.libelle || "", quantite: l.quantite != null ? String(l.quantite).replace(".", ",") : "1", montant: l.montant != null ? String(l.montant).replace(".", ",") : "", noteId: "" })).filter((l) => l.libelle);
      SFX.ok();
    } catch (e) { S.tz.err = "Lecture automatique impossible. Ajoutez les plats à la main, ou reprenez les photos."; SFX.err(); }
    const u = await ups; const small = await Promise.all(shr.map((s) => shrink(s.blob, 1100, 0.6)));
    S.tz.pics = shr.map((s, i) => (u[i] && u[i].id ? { src: u[i].url, id: u[i].id, url: u[i].url } : (() => { const d = small[i].canvas.toDataURL("image/jpeg", 0.6); return { src: d, data: d }; })()));
    S.tz.busy = false; if (S.route === "tzEdit") rerender();
  },
  tzSave: async (a) => {
    const T = S.tz; const lines = T.lines.filter((l) => l.libelle.trim() && (num(l.quantite) || 0) > 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(T.date || "")) { SFX.err(); toast("Choisissez la date du ticket.", "err"); return; }
    if (!lines.length && num(T.total) == null) { SFX.err(); toast("Ajoutez au moins un plat ou le chiffre d'affaires.", "err"); return; }
    a.setAttribute("disabled", "");
    const d = { date: T.date, total: num(T.total), lines: lines.map((l) => { const r = tkRecipeFor(l); const o = { libelle: l.libelle.trim(), quantite: num(l.quantite), montant: num(l.montant) }; if (r) o.noteId = r.id; return o; }),
      photoIds: [...T.pics.filter((p) => p.id).map((p) => p.id), ...(T.keepIds || [])], photoUrls: T.pics.filter((p) => p.url && p.id).map((p) => p.url), photos: T.pics.filter((p) => p.data).map((p) => p.data),
      at: T.at || Date.now(), uid: T.uid || S.me.id, updatedAt: Date.now() };
    try {
      if (T.id) { await safe(DB.update("tickets", T.id, d)); await logEvent("ticket", `a modifié le ticket Z du ${shortDate(T.date)}`, { ref: T.id }); }
      else { const id = await safe(DB.add("tickets", d)); await logEvent("ticket", `a enregistré le ticket Z du ${shortDate(T.date)}${d.total != null ? ` · ${tkEur(d.total)}` : ""}`, { ref: id }); }
    } catch (e) { a.removeAttribute("disabled"); return; }
    S.tz = null; S.ui.tkDay = d.date; SFX.done(); buzz([10, 40, 10]); burst(); toast(T.id ? "Ticket modifié" : "Ticket Z enregistré"); goBack();
  },
  tzDel: () => openSheet(`<div class="h2" style="font-size:20px">Supprimer ce ticket ?</div><p class="sub" style="margin:0">Le ticket Z du ${shortDate(S.tz.date)} et sa photo disparaissent de l'historique.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="tzDelOk">Supprimer</button></div>`),
  tzDelOk: async () => { closeSheet(true); const T = S.tz; await safe(DB.del("tickets", T.id)); await logEvent("ticket", `a supprimé le ticket Z du ${shortDate(T.date)}`, { ref: T.id }); S.tz = null; toast("Ticket supprimé"); goBack(); },
  ticket: (a, id) => {
    const t = S.tickets.find((x) => x.id === id); if (!t) return; const C = tkConsumption([t]); const ph = tkPhotos(t); const hasM = (t.lines || []).some((l) => l.montant != null);
    openSheet(`<div class="row" style="align-items:flex-start"><div style="min-width:0"><div class="h2" style="font-size:20px">Ticket Z · ${t.date ? tkDayLabel(t.date, true) : "?"}</div><div class="sub">par ${esc(firstName(nameOf(t.uid)))} · ${when(t.at)}</div></div><button class="btn soft sm" data-act="tzOpen" data-id="${t.id}">${ico("edit")}Modifier</button></div>
      <div class="tk-sheetca"><span class="lbl">Chiffre d'affaires</span><b class="mono">${t.total != null ? tkEur(t.total) : "–"}</b></div>
      ${(t.lines || []).length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Plat</th><th class="n">Qté</th>${hasM ? `<th class="n">Montant</th>` : ""}</tr></thead><tbody>${t.lines.map((l) => `<tr><td>${esc(l.libelle)}</td><td class="n">${l.quantite != null ? tkTrim(fmt(l.quantite, 1)) : ""}</td>${hasM ? `<td class="n">${l.montant != null ? fmt(l.montant, 2) : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : ""}
      ${C.rows.length ? `<div><span class="lbl">Consommation théorique</span><div class="tk-cons">${C.rows.map((r) => `<div class="li"><div class="tx"><b>${esc(r.name)}</b></div><span class="mono tk-q">${tkQty(r.v, r.base)}</span></div>`).join("")}</div></div>` : ""}
      ${ph.length ? `<div class="tk-shots">${ph.map((s) => `<img src="${esc(s)}" alt="Photo du ticket Z">`).join("")}</div>` : ""}
      <button class="btn soft block" data-act="sheetClose">Fermer</button>`);
  },
});
