/* Growth Gusto — area: reception
   Flow, one hand at the back door: 1 Fournisseur → 2 Produits (one focused card at a time) → 3 Contrôle → 4 Validé.
   Data: receptions docs { supplier, bl, at, uid, lines[] } + one lot per accepted line (same shape as before). */

Object.assign(IC, {
  recHist: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  recTag: ["M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z", "c:7.5,7.5,1"],
  recCal: ["r:3,4,18,18,3", "M16 2v4", "M8 2v4", "M3 10h18"],
  recSpark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"],
});
TAB_OF.reception = "more";

const REC_UNITS = ["kg", "pièce", "carton", "L"];
const REC_TYPES = [
  { k: "frais", t: "Frais", max: 4 },
  { k: "ultra", t: "Ultra-frais", max: 2 },
  { k: "surg", t: "Surgelé", max: -18 },
  { k: "sec", t: "Sec", max: null },
];
const REC_DLC = [1, 3, 5, 7, 14];
const REC_REASONS_BAD = ["Température trop haute", "DLC dépassée", "Emballage abîmé", "DLC trop courte", "Produit non conforme"];
const REC_REASONS_RES = ["Température limite", "Emballage abîmé", "DLC courte", "Livré en retard"];

/* ───────── state ───────── */
function recState() {
  if (S.rec && S.rec.rid && S.rec.rid !== S.rid) S.rec = null; /* switched restaurant: that draft stays saved under its own key */
  if (!S.rec) S.rec = { step: 1, supplier: "", bl: "", lines: [], done: null, open: 0 };
  const R = S.rec; if (!R.rid) R.rid = S.rid;
  R.lines = R.lines || []; if (R.edit == null) R.edit = -1; if (!R.view) R.view = "flow";
  if (!R.cur) R.cur = recBlank();
  return R;
}
/* ───────── draft: an unfinished reception survives a reload, a closed app or a dead battery ───────── */
const recDraftKey = () => `gg-rec-draft-${S.rid || ""}`;
const REC_DRAFT_KEEP = ["step", "supplier", "bl", "lines", "cur", "edit", "stash", "lastFridge", "lastUnit", "back3", "rid"];
function recDraftClear() { try { localStorage.removeItem(recDraftKey()); } catch (e) {} }
const recDraftSave = debounce(() => {
  const R = S.rec; if (!S.rid || (R && R.rid && R.rid !== S.rid)) return;
  if (!R || R.done || !((R.supplier || "").trim() || (R.lines || []).length || (R.cur && String(R.cur.name || "").trim()))) return recDraftClear();
  const d = { at: Date.now() }; REC_DRAFT_KEEP.forEach((k) => { if (R[k] !== undefined) d[k] = R[k]; });
  try { localStorage.setItem(recDraftKey(), JSON.stringify(d)); } catch (e) {}
}, 250);
(function recDraftLoad() {
  if (S.rec || !S.rid) return;
  try {
    const d = JSON.parse(localStorage.getItem(recDraftKey()) || "null");
    if (!d || !Array.isArray(d.lines) || Date.now() - (d.at || 0) > 18 * 36e5) { recDraftClear(); return; }
    delete d.at; S.rec = { supplier: "", bl: "", done: null, open: 0, ...d, step: Math.min(3, Math.max(1, +d.step || 1)) };
    [S.rec.cur, S.rec.stash].forEach((L) => { if (L && L.ocr === "busy") L.ocr = null; });
  } catch (e) {}
})();
function recFridgeFor(tmax, pref) {
  const fr = S.fridges; if (!fr.length) return "";
  const cold = tmax != null && tmax <= -15;
  const fits = (f) => (cold ? f.max <= -15 : f.max > -15);
  const p = fr.find((f) => f.id === pref); if (p && fits(p)) return p.id;
  return (fr.find(fits) || fr[0]).id;
}
function recBlank() {
  const R = S.rec || {};
  return { name: "", qty: "", unit: R.lastUnit || "kg", temp: "", tmax: 4, type: "frais", dlc: "", lot: "", fridgeId: recFridgeFor(4, R.lastFridge), photoId: "", photoUrl: "", photoData: "", sanitary: "", peche: "", ocr: null, decision: "", reason: "", memo: null };
}
/* « 6 pièces », « 2 cartons », « 1,5 kg », « 3 L » */
function recQtyTx(qty, unit) {
  const q = String(qty ?? "").trim(); if (!q) return ""; const n = num(q); const u = String(unit || "").trim();
  const qs = n != null ? String(+n.toFixed(3)).replace(".", ",") : q;
  const pl = n != null && Math.abs(n) >= 2 && u.length > 2 && !/[sxz]$/i.test(u) && !/^(kg|g|l|cl|ml)$/i.test(u);
  return `${esc(qs)}${u ? ` ${esc(u)}${pl ? "s" : ""}` : ""}`;
}
/* « BL-4501 », « bl 4501 », « BL n°4501 » → « 4501 » (the label already says BL) */
const recBl = (bl) => String(bl || "").trim().replace(/^B\.?L\.?(?=[\s:°.\-#]|\d|$)[\s:°n.\-#]*/i, "");
const recFrIco = (f) => (typeof relTypeOf === "function" ? ico(relTypeOf(f).ic) : ico(f.max <= -15 ? "snow" : "fridge"));
const recNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const recTypeOf = (L) => L.type || (L.tmax == null ? "sec" : L.tmax <= -15 ? "surg" : L.tmax <= 2 ? "ultra" : "frais");
const recCold = (L) => recTypeOf(L) !== "sec";
const recNeedDlc = (L) => ["frais", "ultra"].includes(recTypeOf(L));
function recIssues(L) {
  const out = []; const t = num(L.temp);
  if (recCold(L)) {
    if (t == null) out.push({ k: "temp", t: "Température non notée" });
    else if (L.tmax != null && t > L.tmax) out.push({ k: "temp", t: `${fmt(t)} °C pour ${fmt(L.tmax, 0)} °C max` });
  }
  if (L.dlc && daysUntil(L.dlc) < 0) out.push({ k: "dlc", t: "DLC dépassée" });
  return out;
}
const recOk = (L) => !recIssues(L).length;
const recTempState = (L) => { const t = num(L.temp); if (!recCold(L) || t == null) return "none"; return t <= L.tmax ? "ok" : "bad"; };

/* ───────── memory: suppliers + products seen before ───────── */
function recSuppliers() {
  const m = new Map();
  S.receptions.forEach((r) => { const s = (r.supplier || "").trim(); if (!s) return; const k = recNorm(s); const e = m.get(k) || { name: s, n: 0, at: 0 }; e.n++; if (r.at > e.at) { e.at = r.at; e.name = s; } m.set(k, e); });
  return [...m.values()].sort((a, b) => b.at - a.at);
}
function recLast(name, sup) {
  const k = recNorm(name); if (!k) return null; let any = null;
  for (const r of S.receptions.slice().sort((a, b) => b.at - a.at)) {
    for (const L of r.lines || []) {
      if (recNorm(L.name) !== k || L.refused) continue;
      if (recNorm(r.supplier) === recNorm(sup)) return { L, at: r.at, same: true };
      if (!any) any = { L, at: r.at, same: false };
    }
  }
  return any;
}
function recCatalog() {
  const R = recState(); const sup = recNorm(R.supplier); const m = new Map();
  const add = (n, w, at) => { const s = String(n || "").trim(); if (!s) return null; const k = recNorm(s); const e = m.get(k) || { name: s, w: 0, at: 0, mine: false }; e.w += w; e.at = Math.max(e.at, at || 0); m.set(k, e); return e; };
  S.receptions.forEach((r) => (r.lines || []).forEach((L) => { const e = add(L.name, 2, r.at); if (e && sup && recNorm(r.supplier) === sup) { e.mine = true; e.w += 5; } }));
  S.products.forEach((p) => add(p.name, 1, 0));
  return [...m.values()];
}
function recSuggest(q) {
  const R = recState(); const have = new Set(R.lines.map((L) => recNorm(L.name)));
  const all = recCatalog().filter((e) => !have.has(recNorm(e.name)));
  const k = recNorm(q);
  if (!k) { const mine = all.filter((e) => e.mine); return { title: mine.length ? `Habituels chez ${R.supplier}` : "Produits fréquents", list: (mine.length ? mine : all).sort((a, b) => b.w - a.w || b.at - a.at).slice(0, 8) }; }
  const hits = all.filter((e) => recNorm(e.name).includes(k) && recNorm(e.name) !== k)
    .sort((a, b) => (recNorm(b.name).startsWith(k) - recNorm(a.name).startsWith(k)) || (b.mine - a.mine) || b.w - a.w).slice(0, 6);
  return { title: "Suggestions", list: hits };
}
function recGuessType(name) {
  const n = recNorm(name);
  if (/surgel|congel|\b(glaces?|sorbets?|creme glacee)\b/.test(n)) return "surg";
  if (/\b(poissons?|saumon|cabillaud|thon|bar|daurade|dorade|lieu|merlu|sole|truite|maquereau|sardines?|crevettes?|moules?|huitres?|saint[- ]jacques|st[- ]jacques|langoustines?|hache|tartare|volaille|poulet|abats?)\b/.test(n)) return "ultra";
  if (/\b(farine|sucre|sel|huile|riz|pates|vin|biere|cafe|the|conserves?|epices?|chocolat|levure)\b/.test(n)) return "sec";
  return "frais";
}
function recSetType(L, k) {
  const T = REC_TYPES.find((x) => x.k === k) || REC_TYPES[0];
  L.type = T.k; L.tmax = T.max; if (T.k === "sec") L.temp = "";
  L.fridgeId = recFridgeFor(T.max, L.fridgeId);
}
/* Smart defaults from the last delivery of this product (same supplier first). Never invents a temperature. */
function recApply(L, name) {
  const R = recState(); L.name = name;
  const last = recLast(name, R.supplier);
  if (last) {
    const P = last.L;
    if (P.qty) L.qty = String(P.qty); if (P.unit) L.unit = P.unit;
    L.type = P.type || recTypeOf(P); L.tmax = L.type === "sec" ? null : (P.tmax ?? 4);
    L.fridgeId = S.fridges.some((f) => f.id === P.fridgeId) ? P.fridgeId : recFridgeFor(L.tmax, L.fridgeId);
    let off = null; if (P.dlc) { off = daysUntil(P.dlc) - daysUntil(dayKey(new Date(last.at))); if (off > 0 && off < 120) L.dlc = addDays(dayKey(), off); else off = null; }
    L.memo = { at: last.at, same: last.same, off };
  } else {
    const p = S.products.find((x) => recNorm(x.name) === recNorm(name));
    if (p && p.unit && REC_UNITS.includes(p.unit)) L.unit = p.unit;
    recSetType(L, recGuessType(name)); L.memo = null;
  }
}

/* ───────── view ───────── */
VIEWS.reception = {
  live: false,
  render() {
    const R = recState(); R.dirty = false;
    const anim = R.anim || ""; R.anim = "";
    if (R.view === "hist") return recHistView(anim);
    if (R.done) return recDoneView(anim);
    const body = R.step === 1 ? recStep1() : R.step === 2 ? recStep2() : recStep3();
    return `<div class="inner narrow rec rec-s${R.step}">${body.top}${recProg(R.step)}<div class="rec-stage ${anim}">${body.main}</div>${body.cta}</div>`;
  },
  after(v) {
    const R = S.rec; if (!R) return; recDraftSave();
    if (R.scrollTo) { const sel = R.scrollTo; R.scrollTo = null; setTimeout(() => { const el = $(sel, v); if (!el) return; let top = -14; for (let n = el; n && n !== v; n = n.offsetParent) top += n.offsetTop; v.scrollTo({ top: Math.max(0, top), behavior: "smooth" }); }, 40); }
    if (R.celebrate) { R.celebrate = false; setTimeout(() => { const s = $(".rec-seal", v); const b = s && s.getBoundingClientRect(); b ? burst(b.left + b.width / 2, b.top + b.height / 2) : burst(); }, 280); }
  },
};

const recTop = (title, right = "") => `<div class="top"><button class="iconbtn" data-act="recBack" aria-label="Retour">${ico("back")}</button><span class="h2">${title}</span>${right}</div>`;
function recProg(step) {
  const n = recState().lines.length; const live = step < 4;
  return `<div class="rec-prog ${step > 3 ? "all" : ""}" role="progressbar" aria-label="Étape ${Math.min(step, 3)} sur 3" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${Math.min(step, 3)}">${["Fournisseur", "Produits", "Contrôle"].map((t, i) => {
    const s = i + 1; const c = s < step ? "done" : s === step ? "on" : "";
    return `<button class="s ${c}" ${s < step && live ? `data-act="recGo" data-v="${s}"` : `tabindex="-1"`}><i></i><span>${s < step ? ico("check") : `<b>${s}</b>`}${t}${s === 2 && n ? `<em class="mono">${n}</em>` : ""}</span></button>`;
  }).join("")}</div>`;
}
function recAgo(ts) { const d = -daysUntil(dayKey(new Date(ts))); return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : d < 7 ? `il y a ${d} j` : `le ${shortDate(dayKey(new Date(ts)))}`; }
const recAv = (name) => `<span class="av" style="background:${colorFor(recNorm(name))}">${esc(initials(name || "?"))}</span>`;

/* step 1 — fournisseur */
function recStep1() {
  const R = recState(); const sups = recSuppliers().slice(0, 8);
  const hist = S.receptions.length ? `<button class="btn soft sm rec-histbtn" data-act="recHist">${ico("recHist")}Historique</button>` : "";
  const known = sups.some((s) => recNorm(s.name) === recNorm(R.supplier));
  const tiles = sups.length ? `<div class="rec-sups">${sups.map((s, i) => `<button class="rec-sup ${recNorm(R.supplier) === recNorm(s.name) ? "on" : ""}" style="--i:${i}" data-act="recSup" data-v="${esc(s.name)}">${recAv(s.name)}<b>${esc(s.name)}</b><em>${recAgo(s.at)} · ${s.n} livraison${s.n > 1 ? "s" : ""}</em></button>`).join("")}</div>` : "";
  const sup = R.supplier.trim();
  return {
    top: recTop("Réception", hist),
    main: `<div class="rec-q"><div class="title">Qui livre&nbsp;?</div><p class="sub">${sups.length ? "Touchez le fournisseur, c'est parti." : "Tapez le nom du fournisseur pour commencer."}</p></div>
      ${tiles}
      <div class="glass pad rec-new">
        <label class="field"><span>${sups.length ? "Nouveau fournisseur" : "Fournisseur"}</span><input class="input" id="recSupIn" data-bind="rec.supplier" data-recsup="1" value="${known ? "" : esc(R.supplier)}" placeholder="Ex. Marée Atlantique" autocomplete="off" autocapitalize="words" enterkeyhint="go"></label>
        <label class="field"><span>N° de bon de livraison <i class="rec-opt">facultatif</i></span><input class="input mono" data-bind="rec.bl" value="${esc(R.bl)}" placeholder="Ex. 4501" autocomplete="off" enterkeyhint="done"></label>
      </div>`,
    cta: `<div class="ctabar rec-cta one" id="recSupCta" ${sups.length && !sup ? "hidden" : ""}><button class="btn acc block" data-act="recSupGo" id="recSupGo" ${sup ? "" : `data-off="1"`}>${sup ? `Continuer avec ${esc(sup)}` : "Continuer"}${ico("chev")}</button></div>`,
  };
}

/* step 2 — produits */
function recStep2() {
  const R = recState();
  const rows = R.lines.map((L, i) => (i === R.edit ? recCard(R.cur, i) : recRow(L, i))).join("");
  const fresh = R.edit < 0 ? recCard(R.cur, -1) : "";
  const n = R.lines.length;
  const supBar = `<button class="rec-supbar" data-act="recGo" data-v="1">${recAv(R.supplier)}<span class="tx"><b>${esc(R.supplier)}</b><em>${recBl(R.bl) ? `BL ${esc(recBl(R.bl))} · ` : ""}${n ? `${n} produit${n > 1 ? "s" : ""} noté${n > 1 ? "s" : ""}` : "Un produit à la fois"}</em></span><span class="pill neu">Changer</span></button>`;
  return {
    top: recTop("Réception"),
    main: `${supBar}${n ? `<div class="rec-lines">${rows}</div>` : ""}${fresh}`,
    cta: R.edit >= 0
      ? `<div class="ctabar rec-cta"><button class="btn soft" data-act="recCancel">Annuler</button><button class="btn acc" data-act="recSaveLine">${ico("check")}Enregistrer</button></div>`
      : `<div class="ctabar rec-cta"><button class="btn soft" data-act="recFinish">Terminer${n ? `<span class="rec-n mono">${n}</span>` : ""}</button><button class="btn acc" data-act="recNextLine">Produit suivant${ico("chev")}</button></div>`,
  };
}
function recRow(L, i) {
  const t = num(L.temp); const st = recTempState(L); const R = recState();
  return `<button class="rec-row ${R.justAdded === i ? "pop" : ""} ${recOk(L) ? "" : "warn"}" data-act="recEdit" data-i="${i}" aria-label="Modifier ${esc(L.name)}">
    ${L.photoUrl ? `<span class="th"><img src="${esc(L.photoUrl)}" alt=""></span>` : `<span class="th n mono">${i + 1}</span>`}
    <span class="tx"><b>${esc(L.name)}</b><em>${L.qty ? `${recQtyTx(L.qty, L.unit)} · ` : ""}${esc(fridgeName(L.fridgeId))}${L.dlc ? ` · DLC ${shortDate(L.dlc)}` : ""}</em></span>
    <span class="t mono ${st}">${recCold(L) ? (t == null ? "–°" : fmt(t) + "°") : "sec"}</span>${ico("edit", "ed")}</button>`;
}
function recCard(L, i) {
  const R = recState(); const editing = i >= 0; const n = editing ? i + 1 : R.lines.length + 1;
  const today = dayKey(); const ty = recTypeOf(L); const st = recTempState(L);
  const dlcCustom = L.dlc && !REC_DLC.some((d) => addDays(today, d) === L.dlc);
  const dd = L.dlc ? daysUntil(L.dlc) : null;
  const units = REC_UNITS.includes(L.unit) || !L.unit ? REC_UNITS : [...REC_UNITS, L.unit];
  const memo = L.memo ? `<div class="rec-memo">${ico("recSpark")}<span>${L.memo.same ? "Comme la dernière livraison" : "Déjà reçu"} (${recAgo(L.memo.at)}) : quantité, frigo${L.memo.off ? ` et DLC J+${L.memo.off}` : ""} pré-remplis.</span></div>` : "";
  return `<div class="glass rec-card ${R.anim2 === "slide" && !editing ? "slide" : ""} ${editing ? "editing" : ""}" id="recCard" data-line="${i}">
    <div class="row rec-card-h"><span class="lbl">${editing ? `Modifier · produit ${n}` : `Produit ${n}`}</span>${editing ? `<button class="btn ghost sm" style="color:var(--bad)" data-act="recRm" data-i="${i}">${ico("trash")}Retirer</button>` : ""}</div>
    <div class="rec-f rec-name">
      <input class="input rec-big" id="recName" data-bind="rec.cur.name" data-recname="1" value="${esc(L.name)}" placeholder="Quel produit ?" autocomplete="off" autocapitalize="sentences" enterkeyhint="next" aria-label="Nom du produit">
      <div class="rec-sugs" id="recSugs">${L.memo ? "" : recSugsHtml(recSuggest(L.name))}</div>
      ${memo}
    </div>
    <div class="rec-cgrid"><div class="rec-ccol">
    <div class="rec-f"><span class="lbl">Quantité</span><div class="rec-qty"><input class="input mono" id="recQty" data-bind="rec.cur.qty" value="${esc(L.qty)}" inputmode="decimal" placeholder="0" enterkeyhint="done" aria-label="Quantité"><div class="rec-units">${units.map((u) => `<button class="chip ${L.unit === u ? "on" : ""}" data-act="recUnit" data-v="${esc(u)}">${esc(u)}</button>`).join("")}</div></div></div>
    <div class="rec-f rec-temp ${st}" id="recTemp">
      <div class="row"><span class="lbl">Température à cœur</span>${recCold(L) ? `<span class="pill ${st === "bad" ? "bad" : st === "ok" ? "ok" : "neu"}" id="recTmax">seuil ${fmt(L.tmax, 0)} °C</span>` : ""}</div>
      <div class="chips rec-types">${REC_TYPES.map((T) => `<button class="chip ${ty === T.k ? "on" : ""}" data-act="recType" data-v="${T.k}">${T.t}</button>`).join("")}</div>
      ${recCold(L) ? `<div class="rec-tv"><button class="step" data-rst="-1" aria-label="Moins 0,1 degré">${ico("minus")}</button>
        <label class="rec-tnum"><input id="recT" class="mono" data-bind="rec.cur.temp" data-rect="1" value="${esc(L.temp)}" style="${recTStyle(L.temp)}" inputmode="decimal" placeholder="–" enterkeyhint="done" aria-label="Température en °C"><small>°C</small></label>
        <button class="step" data-rst="1" aria-label="Plus 0,1 degré">${ico("plus")}</button></div>
        <div class="rec-tst" id="recTst">${recTstHtml(L)}</div>
        <div class="chips rec-qt" id="recQt">${recQuick(L)}</div>` : `<p class="note rec-dry">Produit sec : pas de température à relever.</p>`}
    </div></div><div class="rec-ccol">
    <div class="rec-f" id="recDlc"><div class="row"><span class="lbl">DLC${recNeedDlc(L) ? "" : ` <i class="rec-opt">facultatif</i>`}</span><span class="sub mono" id="recDlcTx">${L.dlc ? `${shortDate(L.dlc)} · ${dd < 0 ? "dépassée" : dd === 0 ? "aujourd'hui" : dd === 1 ? "demain" : `dans ${dd} j`}` : "à choisir"}</span></div>
      <div class="rec-dlc">${REC_DLC.map((d) => { const k = addDays(today, d); return `<button class="chip ${L.dlc === k ? "on" : ""}" data-act="recDlc" data-v="${k}">J+${d}</button>`; }).join("")}<label class="chip ${dlcCustom ? "on" : ""} rec-date" title="Autre date">${ico("recCal")}${dlcCustom ? `<span class="mono">${shortDate(L.dlc)}</span>` : ""}<input type="date" data-bind="rec.cur.dlc" data-rer="1" value="${esc(L.dlc)}" aria-label="Choisir la date de DLC"></label></div></div>
    <div class="rec-f"><span class="lbl">Ranger dans</span>${ty === "surg" && S.fridges.length && !S.fridges.some((f) => f.max <= -15) ? `<p class="note rec-dry">Aucun congélateur dans Frigos : choisissez où le ranger.</p>` : ""}<div class="chips rec-fr">${S.fridges.map((f) => `<button class="chip ${L.fridgeId === f.id ? "on" : ""}" data-act="recFr" data-v="${f.id}">${recFrIco(f)}${esc(f.name)}</button>`).join("") || `<span class="note">Aucun frigo : ajoutez-en dans Frigos.</span>`}</div></div>
    <div class="rec-f rec-proof">
      ${L.photoUrl ? `<div class="rec-ph has"><span class="th ${L.ocr === "busy" ? "scan" : ""}"><img src="${esc(L.photoUrl)}" alt="Étiquette sanitaire"></span><span class="tx"><b>Photo prise</b><em>${L.ocr === "busy" ? "Lecture de l'étiquette…" : L.ocr === "fail" ? "Lecture impossible, la photo reste en preuve." : "Preuve gardée au registre."}</em></span><button class="iconbtn rec-x" data-act="recPhoto" aria-label="Reprendre la photo">${ico("camera")}</button><button class="iconbtn rec-x" data-act="recPhotoRm" aria-label="Retirer la photo">${ico("x")}</button></div>`
        : `<button class="rec-ph" data-act="recPhoto"><span class="ic">${ico("camera")}</span><span class="tx"><b>Photo de l'étiquette</b><em>${S.cap.sample ? "Lot et DLC lus automatiquement" : "Facultatif · preuve sanitaire"}</em></span>${ico("chev")}</button>`}
      ${L.ocr && typeof L.ocr === "object" ? `<div class="ocr">${Object.entries(L.ocr).filter(([, v]) => v).map(([k, v], j) => `<span style="--i:${j}">${esc(k)} : ${esc(v)}</span>`).join("")}</div>` : ""}
      <label class="rec-lot"><span class="lbl">N° de lot</span><input class="input mono" data-bind="rec.cur.lot" value="${esc(L.lot)}" placeholder="facultatif" autocomplete="off" enterkeyhint="done"></label>
    </div>
  </div></div></div>`;
}
function recSugsHtml(sug) {
  if (!sug.list.length) return "";
  return `<span class="lbl">${esc(sug.title)}</span><div class="chips">${sug.list.map((e) => `<button class="chip ${e.mine ? "mine" : ""}" data-act="recPick" data-v="${esc(e.name)}">${e.mine ? ico("recHist") : ""}${esc(e.name)}</button>`).join("")}</div>`;
}
function recTstHtml(L) {
  const t = num(L.temp); const st = recTempState(L);
  if (st === "none") return `${ico("therm")}<span>Sondez le produit, puis touchez la valeur.</span>`;
  if (st === "ok") return `${ico("check")}<span>Conforme · ${fmt(L.tmax - t)} °C sous le seuil</span>`;
  return `${ico("alert")}<span>Trop chaud · ${fmt(t - L.tmax)} °C au-dessus du seuil</span>`;
}
function recQuick(L) {
  const m = L.tmax ?? 4; const t = num(L.temp); const vals = []; for (let v = m - 3; v <= m + 2; v++) vals.push(v);
  return vals.map((v) => `<button class="chip mono ${v > m ? "hot" : ""} ${t === v ? "on" : ""}" data-act="recTq" data-v="${v}">${v}°</button>`).join("");
}

/* step 3 — contrôle */
function recStep3() {
  const R = recState();
  const bad = R.lines.filter((L) => !recOk(L)); const refused = R.lines.filter((L) => L.decision === "refuse");
  const kept = R.lines.length - refused.length; const good = R.lines.length - bad.length;
  const head = `<div class="glass pad rec-sum">
      <div class="rec-sum-h">${recAv(R.supplier)}<div><b class="h3">${esc(R.supplier)}</b><div class="sub">${R.lines.length} produit${R.lines.length > 1 ? "s" : ""} · ${hm(Date.now())}</div></div></div>
      <div class="rec-stats"><span class="ok"><b class="mono">${good}</b>conforme${good > 1 ? "s" : ""}</span><span class="${bad.length ? "bad" : ""}"><b class="mono">${bad.length}</b>non conforme${bad.length > 1 ? "s" : ""}</span><span><b class="mono">${kept}</b>à ranger</span></div>
      <label class="field"><span>N° de bon de livraison <i class="rec-opt">facultatif</i></span><input class="input mono" data-bind="rec.bl" value="${esc(R.bl)}" placeholder="Ex. 4501" autocomplete="off" enterkeyhint="done"></label>
    </div>`;
  const order = R.lines.map((L, i) => [L, i]).sort((a, b) => recOk(a[0]) - recOk(b[0]));
  const undecided = bad.filter((L) => !L.decision).length;
  return {
    top: recTop("Contrôle"),
    main: `${head}${bad.length ? `<div class="rec-callout">${ico("alert")}<span>${bad.length === 1 ? "1 produit n'est pas conforme : décidez avant de valider." : `${bad.length} produits ne sont pas conformes : décidez avant de valider.`}</span></div>` : `<div class="rec-callout ok">${ico("check")}<span>Tout est conforme. Validez pour ranger.</span></div>`}<div class="rec-ctls">${order.map(([L, i]) => recCtl(L, i)).join("")}</div>`,
    cta: `<div class="ctabar rec-cta"><button class="btn soft" data-act="recGo" data-v="2">Modifier</button><button class="btn acc" data-act="recSave" ${undecided ? `data-off="1"` : ""}>${undecided ? `${ico("alert")}Décider (${undecided})` : `${ico("check")}Valider la réception`}</button></div>`,
  };
}
function recCtl(L, i) {
  const R = recState(); const iss = recIssues(L); const ok = !iss.length; const t = num(L.temp);
  const d = L.decision || (ok ? "ok" : "");
  const open = !ok || R.ctlOpen === i || d === "refuse";
  const meta = `${L.qty ? `${recQtyTx(L.qty, L.unit)} · ` : ""}${recCold(L) ? (t == null ? "– °C" : fmt(t) + " °C") : "sec"} · DLC ${L.dlc ? shortDate(L.dlc) : "–"} · ${esc(fridgeName(L.fridgeId))}`;
  const expired = iss.some((x) => x.k === "dlc"); /* a past DLC can't enter the kitchen: fix the entry or refuse */
  const opts = ok ? [["ok", "Accepter"], ["refuse", "Refuser"]] : expired ? [["fix", "Corriger la DLC"], ["refuse", "Refuser"]] : [["reserve", "Accepter avec réserve"], ["refuse", "Refuser"]];
  const di = opts.findIndex((o) => o[0] === d);
  const reasons = d === "refuse" ? REC_REASONS_BAD : REC_REASONS_RES;
  return `<div class="glass rec-ctl ${ok ? "" : "issue"} ${d === "refuse" ? "refused" : d === "reserve" ? "reserve" : ""} ${open ? "open" : ""}" data-ctl="${i}">
    <button class="rec-ctl-h" data-act="recCtl" data-i="${i}">
      <span class="ic ${d === "refuse" ? "bad" : ok ? "ok" : "warn"}">${ico(d === "refuse" ? "x" : ok ? "check" : "alert")}</span>
      <span class="tx"><b>${esc(L.name)}</b><em>${meta}</em></span>
      ${L.photoUrl ? `<span class="th"><img src="${esc(L.photoUrl)}" alt=""></span>` : ""}
      ${d === "ok" ? `<span class="pill ok">OK</span>` : d === "refuse" ? `<span class="pill bad">Refusé</span>` : d === "reserve" ? `<span class="pill warn">Réserve</span>` : `<span class="pill bad"><span class="dot"></span>À décider</span>`}
    </button>
    ${open ? `<div class="rec-ctl-b">
      ${iss.length ? `<div class="rec-iss">${iss.map((x) => `<span class="pill bad">${ico(x.k === "temp" ? "therm" : "recCal")}${esc(x.t)}</span>`).join("")}</div>` : ""}
      ${expired && d !== "refuse" ? `<p class="note" style="margin:0">DLC dépassée : ce produit ne peut pas entrer en cuisine.</p>` : ""}
      <div class="seg rec-seg ${di < 0 ? "none" : ""}"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${di === 1 ? "100%" : "0"})"></span>${opts.map(([k, tx]) => `<button class="${d === k ? "on" : ""} ${k}" data-act="recDecide" data-i="${i}" data-v="${k}">${tx}</button>`).join("")}</div>
      ${d === "refuse" || d === "reserve" ? `<div class="rec-why"><span class="lbl">${d === "refuse" ? "Motif du refus" : "Motif de la réserve"}</span><div class="chips">${reasons.map((r) => `<button class="chip ${L.reason === r ? "on" : ""}" data-act="recReason" data-i="${i}" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div>
        <input class="input" data-bind="rec.lines.${i}.reason" value="${esc(reasons.includes(L.reason) ? "" : L.reason)}" placeholder="Autre motif…" autocomplete="off" enterkeyhint="done"></div>
        <p class="note" style="margin:0">${d === "refuse" ? "Repart avec le livreur : noté au registre, n'entre pas en frigo." : "Entre en frigo, la réserve est notée au registre."}</p>` : ""}
      ${!ok && !expired ? `<button class="btn ghost sm rec-fix" data-act="recFix" data-i="${i}">${ico("edit")}Corriger la saisie</button>` : ""}
    </div>` : ""}
  </div>`;
}

/* step 4 — validé */
function recDoneView(anim) {
  const R = recState(); const lots = R.done.map((id) => S.lots.find((l) => l.id === id)).filter(Boolean);
  const ref = R.lines.filter((L) => L.decision === "refuse"); const res = R.lines.filter((L) => L.decision === "reserve");
  return `<div class="inner narrow rec rec-donev"><div class="top"><button class="iconbtn" data-go="home" aria-label="Accueil">${ico("x")}</button><span class="h2">Réception validée</span></div>${recProg(4)}
    <div class="rec-stage ${anim}">
      <div class="rec-hero"><div class="rec-seal"><span class="r1"></span><span class="r2"></span><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></div>
        <div class="title">C'est rangé&nbsp;!</div><p class="sub">${esc(R.supplier)} · ${R.lines.length} produit${R.lines.length > 1 ? "s" : ""} contrôlé${R.lines.length > 1 ? "s" : ""} à ${hm(R.savedAt || Date.now())}</p></div>
      <div class="rec-tiles"><div class="ok"><b class="mono">${lots.length}</b><span>en frigo</span></div><div class="${res.length ? "warn" : ""}"><b class="mono">${res.length}</b><span>avec réserve</span></div><div class="${ref.length ? "bad" : ""}"><b class="mono">${ref.length}</b><span>refusé${ref.length > 1 ? "s" : ""}</span></div></div>
      ${lots.length ? `<div class="glass pad"><div class="row"><span class="lbl">Étiquettes QR à coller</span><span class="pill acc">${lots.length}</span></div>${lotList(lots, true)}</div>` : ""}
      ${ref.length ? `<div class="glass pad rec-refl"><span class="lbl">Repart avec le livreur</span>${ref.map((L) => `<div class="li"><span class="ic bad">${ico("x")}</span><div class="tx"><b>${esc(L.name)}</b><em>${esc(L.reason || "Refusé")}</em></div></div>`).join("")}</div>` : ""}
    </div>
    <div class="ctabar rec-cta ${lots.length ? "done2" : "one"}"><button class="btn soft" data-act="recAgain">${ico("truck")}<span>Nouvelle réception</span></button>${lots.length ? `<button class="btn acc" data-act="recLabels">${ico("printer")}<span>Étiquettes</span><span class="rec-n mono">${lots.length}</span></button>` : ""}</div>
  </div>`;
}

/* historique */
function recHistView(anim) {
  const list = S.receptions.slice().sort((a, b) => b.at - a.at);
  const groups = []; list.forEach((r) => { const k = dayKey(new Date(r.at)); const g = groups[groups.length - 1]; if (g && g.k === k) g.items.push(r); else groups.push({ k, items: [r] }); });
  const dayLbl = (k) => { const d = daysUntil(k); if (d === 0) return "Aujourd'hui"; if (d === -1) return "Hier"; const x = parseDay(k); return `${DAYS[x.getDay()]} ${shortDate(k)}`; };
  return `<div class="inner narrow rec">${recTop("Historique", `<span class="pill acc">${list.length}</span>`)}
    <div class="rec-stage ${anim}">${groups.length ? groups.map((g) => `<div class="rec-day"><span class="lbl">${dayLbl(g.k)}</span><div class="glass rec-hlist">${g.items.map((r) => {
      const ls = r.lines || []; const nref = ls.filter((L) => L.refused).length; const nres = ls.filter((L) => !L.refused && (L.reserve || L.ok === false)).length; const ph = ls.some((L) => L.photoUrl);
      return `<button class="rec-h" data-act="recHistOpen" data-id="${r.id}">${recAv(r.supplier)}<span class="tx"><b>${esc(r.supplier || "Livraison")}</b><em>${hm(r.at)} · ${ls.length} produit${ls.length > 1 ? "s" : ""}${recBl(r.bl) ? ` · BL ${esc(recBl(r.bl))}` : ""} · ${esc(firstName(nameOf(r.uid)))}</em></span>${ph ? ico("camera", "phi") : ""}${nref ? `<span class="pill bad">${nref} refusé${nref > 1 ? "s" : ""}</span>` : nres ? `<span class="pill warn">${nres} réserve${nres > 1 ? "s" : ""}</span>` : `<span class="pill ok">Conforme</span>`}${ico("chev", "chv")}</button>`;
    }).join("")}</div></div>`).join("") : `<div class="glass empty"><span class="ic">${ico("truck")}</span><b>Aucune réception</b>Les livraisons validées apparaîtront ici.</div>`}</div></div>`;
}
function recHistSheet(r) {
  const ls = r.lines || []; const lots = S.lots.filter((l) => l.receptionId === r.id); const d = new Date(r.at);
  openSheet(`<div class="rec-hs-h">${recAv(r.supplier)}<div><div class="h2" style="font-size:20px">${esc(r.supplier || "Livraison")}</div><div class="sub">${DAYS[d.getDay()]} ${shortDate(dayKey(d))} à ${hm(r.at)} · ${esc(nameOf(r.uid))}${recBl(r.bl) ? ` · BL ${esc(recBl(r.bl))}` : ""}</div></div></div>
    <div class="rec-hs">${ls.map((L) => { const t = L.temp; const hot = t != null && L.tmax != null && t > L.tmax; const state = L.refused ? "bad" : L.ok === false || L.reserve ? "warn" : "ok";
      return `<div class="li"><span class="ic ${state}">${ico(L.refused ? "x" : state === "warn" ? "alert" : "check")}</span><div class="tx"><b>${esc(L.name)}${L.qty ? ` · ${recQtyTx(L.qty, L.unit)}` : ""}</b><em><span class="mono" style="color:${hot ? "var(--bad)" : "inherit"}">${t != null ? `${fmt(t)} °C` : L.type === "sec" || L.tmax == null ? "sec" : "– °C"}</span> · DLC ${L.dlc ? shortDate(L.dlc) : "–"}${L.refused ? "" : ` · ${esc(fridgeName(L.fridgeId))}`}${L.lot ? ` · lot ${esc(L.lot)}` : ""}</em>${L.refused || L.reason ? `<em style="color:${L.refused ? "var(--bad)" : "var(--warn)"};font-weight:700">${L.refused ? "Refusé" : "Réserve"}${L.reason ? ` : ${esc(L.reason)}` : ""}</em>` : ""}</div>${L.photoUrl ? `<a class="thumb" style="width:46px;height:46px;border-radius:12px" href="${esc(L.photoUrl)}" target="_blank" rel="noopener"><img src="${esc(L.photoUrl)}" alt="Étiquette"></a>` : ""}</div>`; }).join("")}</div>
    ${lots.length ? `<button class="btn acc block" data-act="recHistLabels" data-id="${r.id}">${ico("printer")}Étiquettes (${lots.length})</button>` : ""}
    <button class="btn soft block" data-act="sheetClose">Fermer</button>`);
}

/* ───────── in-place updates (no re-render while typing) ───────── */
/* the big temperature must never clip ("-19,5" on a 320px phone): width in em of its own font-size, font-size shrinks with length and screen */
const recTEm = (n) => n * 0.56 + 0.12;
const recTStyle = (v) => { const n = String(v || "").length; return `width:${recTEm(Math.max(1, n))}em;font-size:min(58px,calc((100vw - 272px) / ${recTEm(Math.max(3, n)).toFixed(2)}))`; };
const recTFit = (inp) => { inp.style.cssText = recTStyle(inp.value); };
function recPaintTemp() {
  const L = S.rec?.cur; if (!L) return; const st = recTempState(L);
  const box = $("#recTemp"); if (box) { box.classList.remove("ok", "bad", "none"); box.classList.add(st); }
  const p = $("#recTmax"); if (p) p.className = `pill ${st === "bad" ? "bad" : st === "ok" ? "ok" : "neu"}`;
  const s = $("#recTst"); if (s) s.innerHTML = recTstHtml(L);
  const q = $("#recQt"); if (q) q.innerHTML = recQuick(L);
}
function recSetTemp(v) {
  const L = S.rec.cur; const was = recTempState(L); L.temp = v == null ? "" : fmt(v);
  const inp = $("#recT"); if (inp) { inp.value = L.temp; recTFit(inp); const lb = inp.parentElement; lb.classList.remove("bump"); void lb.offsetWidth; lb.classList.add("bump"); }
  recPaintTemp(); const now = recTempState(L);
  if (now !== was && now === "bad") { SFX.err(); buzz([15, 40, 15]); }
}
let recHold = null, recHoldI = null, recPtr = false;
document.addEventListener("pointerdown", (e) => {
  recPtr = true;
  const b = e.target.closest("[data-rst]"); if (!b || !S.rec) return; e.preventDefault(); SFX.init();
  const dir = +b.dataset.rst;
  const stepIt = () => { const L = S.rec.cur; const t = num(L.temp); recSetTemp(t == null ? (L.tmax ?? 4) - 1 : Math.round((t + dir * 0.1) * 10) / 10); SFX.tick(); buzz(4); };
  stepIt(); clearTimeout(recHold); clearInterval(recHoldI);
  recHold = setTimeout(() => { recHoldI = setInterval(stepIt, 70); }, 380);
}, true);
["pointerup", "pointercancel"].forEach((ev) => document.addEventListener(ev, () => { recPtr = false; clearTimeout(recHold); clearInterval(recHoldI); }, true));
document.addEventListener("pointerleave", (e) => { if (e.target.closest && e.target.matches("[data-rst]")) { clearTimeout(recHold); clearInterval(recHoldI); } }, true);
document.addEventListener("click", () => { if (S.rec && S.route === "reception") recDraftSave(); });
document.addEventListener("input", (e) => {
  const el = e.target; if (!S.rec || S.route !== "reception") return; recDraftSave();
  if (el.dataset.recname) { S.rec.cur.memo = null; const s = $("#recSugs"); if (s) s.innerHTML = recSugsHtml(recSuggest(el.value)); const m = $(".rec-memo"); m && m.remove(); }
  else if (el.dataset.rect) { if (el.value.includes(".")) { const c = el.selectionStart; el.value = el.value.replace(/\./g, ","); S.rec.cur.temp = el.value; try { el.setSelectionRange(c, c); } catch (x) {} } recTFit(el); recPaintTemp(); }
  else if (el.dataset.recsup) { const b = $("#recSupGo"); const v = el.value.trim(); if (b) { b.innerHTML = `${v ? `Continuer avec ${esc(v)}` : "Continuer"}${ico("chev")}`; v ? b.removeAttribute("data-off") : b.setAttribute("data-off", "1"); } const cb = $("#recSupCta"); if (cb) cb.hidden = !v && !!$(".rec-sup"); $$(".rec-sup.on").forEach((x) => x.classList.remove("on")); }
});
/* typed a frozen reading (≤ −12 °C) on a chilled type: it is a frozen product, switch the type so the threshold is right */
document.addEventListener("change", (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.rect || !S.rec || S.route !== "reception") return;
  const L = S.rec.cur; const t = num(L.temp); if (t == null || t > -12 || recTypeOf(L) === "surg") return;
  recSetType(L, "surg"); L.temp = fmt(t); SFX.tick(); rerender();
});
/* typed a known product name and left the field: apply its smart defaults */
document.addEventListener("change", (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.recname || !S.rec) return;
  const R = S.rec; const L = R.cur; const v = el.value.trim(); if (!v || L.applied === recNorm(v)) return;
  const hit = recCatalog().find((x) => recNorm(x.name) === recNorm(v)); L.applied = recNorm(v);
  const was = { qty: L.qty, dlc: L.dlc }; recApply(L, hit ? hit.name : v); if (was.qty) L.qty = was.qty; if (was.dlc) L.dlc = was.dlc;
  R.dirty = true;
  const paint = () => { if (!R.dirty || S.rec !== R) return; const a = document.activeElement; const keep = a && a.dataset && a.dataset.bind ? `[data-bind="${a.dataset.bind}"]` : null; rerender(); if (keep) { const k = $(keep); k && k.focus(); } };
  if (recPtr) document.addEventListener("click", () => setTimeout(paint, 0), { once: true }); else setTimeout(paint, 0);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !S.rec || S.route !== "reception") return; const el = e.target; if (el.tagName !== "INPUT") return;
  if (el.dataset.recname) { e.preventDefault(); const first = $("#recSugs [data-act=recPick]"); if (!el.value.trim() && first) { first.click(); return; } el.blur(); setTimeout(() => { const q = $("#recQty"); q && q.focus(); }, 30); return; }
  if (el.dataset.recsup) { e.preventDefault(); el.blur(); ACT.recSupGo(); return; }
  e.preventDefault(); el.blur();
});
/* keyboard: keep the sticky CTA above the on-screen keyboard, and the focused field in view */
(function recKeyboard() {
  const vv = window.visualViewport; if (!vv) return;
  const fit = () => { const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)); document.documentElement.style.setProperty("--rec-kb", kb + "px"); document.body.classList.toggle("rec-kb", kb > 80); };
  vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
})();
document.addEventListener("focusin", (e) => {
  const el = e.target; if (S.route !== "reception" || !el.matches || !el.matches(".rec input:not([type=date])")) return;
  setTimeout(() => { if (document.activeElement === el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 320);
});

/* ───────── actions ───────── */
/* a double tap on « Valider » must not land on the buttons that replace it */
const recGhost = (R) => !!(R && R.doneAt && Date.now() - R.doneAt < 700);
function recNudge(sel, msg) { SFX.err(); buzz([20, 40, 20]); if (msg) toast(msg, "err"); const el = $(sel); if (el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }
const recBlur = () => { const a = document.activeElement; a && a.blur && a.blur(); };
function recStep(n) { const R = recState(); R.anim = n > R.step ? "fwd" : "bwd"; R.step = n; R.ctlOpen = -1; recBlur(); rerender(); const v = $("#viewport .view:not(.leave)"); v && v.scrollTo({ top: 0 }); }
function recCommitCur() {
  const R = recState(); const L = R.cur;
  if (!L.name.trim()) { recNudge("#recName", "Quel produit ? Tapez son nom."); return false; }
  if (recCold(L) && num(L.temp) == null) { recNudge("#recTemp", "Il manque la température."); return false; }
  if (recNeedDlc(L) && !L.dlc) { recNudge("#recDlc", "Choisissez la DLC."); return false; }
  L.name = L.name.trim(); L.temp = num(L.temp) == null ? "" : fmt(num(L.temp));
  const clean = { ...L, memo: null, applied: null };
  if (R.edit >= 0) R.lines[R.edit] = clean; else R.lines.push(clean);
  R.lastFridge = L.fridgeId; R.lastUnit = L.unit;
  R.justAdded = R.edit >= 0 ? R.edit : R.lines.length - 1;
  return true;
}
Object.assign(ACT, {
  recBack: () => { const R = recState(); SFX.tap(); if (R.view === "hist") return ACT.recHistClose(); if (!R.done && R.step > 1) { if (R.edit >= 0) return ACT.recCancel(); return recStep(R.step - 1); } goBack(); },
  recGo: (a, id, v) => { const n = +v; if (n === recState().step) return; if (n === 3) return ACT.recFinish(); SFX.tap(); recStep(n); },
  recHist: () => { SFX.sheet(); const R = recState(); R.view = "hist"; R.anim = "fwd"; rerender(); },
  recHistClose: () => { const R = recState(); R.view = "flow"; R.anim = "bwd"; rerender(); },
  recHistOpen: (a, id) => { const r = S.receptions.find((x) => x.id === id); if (r) recHistSheet(r); },
  recHistLabels: (a, id) => { const ids = S.lots.filter((l) => l.receptionId === id).map((l) => l.id); closeSheet(true); setTimeout(() => openLabel(ids), 220); },
  recSup: (a, id, v) => {
    const R = recState(); R.supplier = v; SFX.tap(); buzz(6);
    $$(".rec-sup").forEach((x) => x.classList.toggle("on", x === a)); const inp = $("#recSupIn"); if (inp) inp.value = "";
    if (!R.lines.length && !R.cur.name) R.cur = recBlank();
    setTimeout(() => recStep(2), 200);
  },
  recSupGo: () => {
    const R = recState(); R.supplier = (R.supplier || "").trim();
    if (!R.supplier) { recNudge("#recSupIn", "Qui livre ? Tapez le fournisseur."); return; }
    const k = recSuppliers().find((s) => recNorm(s.name) === recNorm(R.supplier)); if (k) R.supplier = k.name;
    SFX.tap(); recStep(2);
  },
  recPick: (a, id, v) => { const R = recState(); recApply(R.cur, v); R.cur.applied = recNorm(v); SFX.tick(); buzz(5); R.scrollTo = "#recCard"; rerender(); },
  recUnit: (a, id, v) => { recState().cur.unit = v; SFX.tick(); $$(".rec-units .chip").forEach((b) => b.classList.toggle("on", b === a)); },
  recType: (a, id, v) => { recSetType(recState().cur, v); SFX.tick(); rerender(); },
  recTq: (a, id, v) => { recSetTemp(+v); SFX.tick(); buzz(5); },
  recDlc: (a, id, v) => { const L = recState().cur; L.dlc = L.dlc === v ? "" : v; SFX.tick(); rerender(); },
  recFr: (a, id, v) => { recState().cur.fridgeId = v; SFX.tick(); $$(".rec-fr .chip").forEach((b) => b.classList.toggle("on", b === a)); },
  recPhotoRm: () => { const L = recState().cur; L.photoUrl = ""; L.photoId = ""; L.photoData = ""; L.ocr = null; SFX.close(); rerender(); },
  recPhoto: async () => {
    const R = recState(); const L = R.cur; const [f] = await pickImage(); if (!f) return;
    let sh; try { sh = await shrink(f, 1280, 0.8); } catch (e) { toast("Photo illisible, réessayez.", "err"); return; }
    L.photoUrl = URL.createObjectURL(sh.blob); L.photoId = ""; L.photoData = ""; L.ocr = S.cap.sample ? "busy" : null; SFX.scan(); buzz(8); rerender();
    const up = upload(sh.blob);
    if (S.cap.sample) {
      try {
        const res = await S.cap.sample.json(`Tu lis la photo d'une étiquette sanitaire de produit alimentaire reçue par un restaurant en France. Réponds uniquement en JSON avec ces clés (chaîne vide si absent) : {"produit":"","fournisseur":"","lot":"","dlc":"AAAA-MM-JJ","date_peche":"AAAA-MM-JJ","numero_sanitaire":"","poids":"nombre en kg ou vide"}. La DLC est la date limite de consommation (ou DLUO/DDM si c'est la seule). Le numéro sanitaire est dans l'ovale (ex. FR 85.194.001 CE).`, { images: [sh.blob], modelTier: "default" });
        const r = res || {};
        if (r.lot) L.lot = r.lot; if (!L.name && r.produit) recApply(L, r.produit); if (/^\d{4}-\d{2}-\d{2}$/.test(r.dlc || "")) L.dlc = r.dlc; if (!L.qty && r.poids) { L.qty = String(r.poids).replace(".", ","); L.unit = "kg"; }
        L.sanitary = r.numero_sanitaire || ""; L.peche = r.date_peche || "";
        L.ocr = { Lot: r.lot, DLC: r.dlc ? shortDate(r.dlc) : "", "N° sanitaire": r.numero_sanitaire, Pêche: r.date_peche ? shortDate(r.date_peche) : "" };
        SFX.ok(); buzz(10);
      } catch (e) { console.warn(e); L.ocr = "fail"; SFX.err(); }
    }
    const u = await up;
    if (u.id) { L.photoId = u.id; L.photoUrl = u.url; }
    else { try { const c = sh.canvas; const k = Math.min(1, 560 / Math.max(c.width, c.height)); const t = document.createElement("canvas"); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height); L.photoData = t.toDataURL("image/jpeg", 0.55); } catch (e) {} }
    if (R.cur === L && S.route === "reception") rerender();
  },
  recNextLine: () => {
    const R = recState(); if (!recCommitCur()) return;
    R.cur = recBlank(); R.edit = -1; R.anim2 = "slide"; SFX.ok(); buzz(10); recBlur();
    R.scrollTo = `[data-act=recEdit][data-i="${R.justAdded}"]`; rerender(); R.anim2 = ""; R.justAdded = -1;
  },
  recSaveLine: () => {
    const R = recState(); const i = R.edit; if (!recCommitCur()) return;
    R.cur = R.stash || recBlank(); R.stash = null; R.edit = -1; SFX.ok(); buzz(8); recBlur(); R.justAdded = -1;
    if (R.back3) { R.back3 = false; return recStep(3); }
    R.scrollTo = `[data-act=recEdit][data-i="${i}"]`; rerender();
  },
  recEdit: (a) => {
    const R = recState(); const i = +a.dataset.i; if (R.edit === i) return; R.back3 = false;
    if (R.edit < 0) R.stash = R.cur;
    R.edit = i; R.cur = { ...R.lines[i], applied: recNorm(R.lines[i].name) }; SFX.tap(); R.scrollTo = "#recCard"; rerender();
  },
  recCancel: () => { const R = recState(); const i = R.edit; R.edit = -1; R.cur = R.stash || recBlank(); R.stash = null; SFX.close(); recBlur(); if (R.back3) { R.back3 = false; return recStep(3); } R.scrollTo = `[data-act=recEdit][data-i="${i}"]`; rerender(); },
  recRm: (a) => {
    const R = recState(); const i = +a.dataset.i; const L = R.lines[i]; R.lines.splice(i, 1); R.edit = -1; R.cur = R.stash || recBlank(); R.stash = null; SFX.close(); buzz(8);
    R.undoRm = { L, i }; const back3 = R.back3; R.back3 = false; rerender();
    const t = $("#toast"); toast(`${L.name} retiré`); $("#toastTx").innerHTML = `${esc(L.name)} retiré <button class="rec-undo" data-act="recUndoRm">Annuler</button>`; t.style.pointerEvents = "auto";
    clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; if (R.undoRm && R.undoRm.L === L) R.undoRm = null; }, 4500);
    if (back3 && R.lines.length) recStep(3);
  },
  recUndoRm: () => {
    const R = S.rec; const u = R && R.undoRm; if (!u) return; R.undoRm = null; R.lines.splice(Math.min(u.i, R.lines.length), 0, u.L); R.justAdded = Math.min(u.i, R.lines.length - 1);
    const t = $("#toast"); t.classList.remove("on"); t.style.pointerEvents = ""; SFX.ok(); buzz(6);
    if (S.route === "reception") { if (R.step === 3) rerender(); else { R.scrollTo = `[data-act=recEdit][data-i="${R.justAdded}"]`; rerender(); } } R.justAdded = -1;
  },
  /* from Contrôle: reopen that line in Produits, and come straight back after saving */
  recFix: (a) => {
    const R = recState(); const i = +a.dataset.i; if (!R.lines[i]) return;
    if (R.edit < 0) R.stash = R.cur; R.edit = i; R.cur = { ...R.lines[i], decision: "", reason: "", applied: recNorm(R.lines[i].name) }; R.back3 = true; R.scrollTo = "#recCard"; SFX.tap(); recStep(2);
  },
  recFinish: () => {
    const R = recState(); const L = R.cur;
    if (R.edit >= 0) { if (!recCommitCur()) return; R.cur = R.stash || recBlank(); R.stash = null; R.edit = -1; }
    else if (L.name.trim() || num(L.temp) != null) { if (!recCommitCur()) return; R.cur = recBlank(); }
    if (!R.lines.length) { recNudge("#recName", "Ajoutez au moins un produit."); return; }
    R.justAdded = -1; SFX.tap(); recStep(3);
  },
  recCtl: (a) => { const R = recState(); const i = +a.dataset.i; const L = R.lines[i]; if (!recOk(L) || L.decision === "refuse") return; R.ctlOpen = R.ctlOpen === i ? -1 : i; SFX.tap(); rerender(); },
  recDecide: (a) => {
    const R = recState(); const L = R.lines[+a.dataset.i]; const v = a.dataset.v; const iss = recIssues(L);
    if (v === "fix") return ACT.recFix(a);
    L.decision = v;
    if (v === "refuse") { if (!REC_REASONS_BAD.includes(L.reason)) L.reason = iss.some((x) => x.k === "dlc") ? "DLC dépassée" : iss.some((x) => x.k === "temp" && num(L.temp) != null) ? "Température trop haute" : ""; SFX.close(); buzz(12); }
    else if (v === "reserve") { if (!REC_REASONS_RES.includes(L.reason)) L.reason = iss.some((x) => x.k === "temp" && num(L.temp) != null) ? "Température limite" : ""; SFX.tick(); buzz(6); }
    else { L.reason = ""; L.decision = ""; R.ctlOpen = -1; SFX.tick(); }
    rerender();
  },
  recReason: (a) => { const L = recState().lines[+a.dataset.i]; L.reason = L.reason === a.dataset.v ? "" : a.dataset.v; SFX.tick(); $$(`[data-act=recReason][data-i="${a.dataset.i}"]`).forEach((b) => b.classList.toggle("on", b.dataset.v === L.reason)); const inp = a.closest(".rec-why")?.querySelector("input"); if (inp) inp.value = ""; },
  recLabels: () => { const R = recState(); if (recGhost(R)) return; if (R.done && R.done.length) openLabel(R.done); },
  recAgain: () => { if (recGhost(S.rec)) return; S.rec = null; const R = recState(); R.anim = "fwd"; SFX.tap(); rerender(); const v = $("#viewport .view:not(.leave)"); v && v.scrollTo({ top: 0 }); },
  recSave: async (a) => {
    const R = recState();
    const und = R.lines.findIndex((L) => !recOk(L) && !L.decision);
    if (und >= 0) { recNudge(`[data-ctl="${und}"]`, `${R.lines[und].name} : à décider.`); return; }
    if (R.saving) return; R.saving = true; a.setAttribute("disabled", "");
    const now = Date.now();
    const lines = R.lines.map((L) => { const refused = L.decision === "refuse"; const reserve = L.decision === "reserve"; const out = {
      name: L.name, qty: L.qty, unit: L.unit, temp: recCold(L) ? num(L.temp) : null, tmax: recCold(L) ? L.tmax : null, type: recTypeOf(L), dlc: L.dlc, lot: L.lot, fridgeId: L.fridgeId,
      photoId: L.photoId || "", photoUrl: L.photoId ? L.photoUrl : L.photoData || "", sanitary: L.sanitary || "", peche: L.peche || "",
      ok: recOk(L), refused, reserve, reason: refused || reserve ? String(L.reason || "").trim() : "" };
      const p = S.products.find((x) => recNorm(x.name) === recNorm(L.name)); out.productId = p ? p.id : ""; if (!p) out.newProduct = L.name;
      return out; });
    const rid = await safe(DB.add("receptions", { supplier: R.supplier, bl: recBl(R.bl), at: now, uid: S.me.id, lines })).catch(() => null);
    if (!rid) { R.saving = false; a.removeAttribute("disabled"); return; }
    const ids = [];
    for (const [i, L] of lines.entries()) {
      if (L.refused) continue;
      const p = S.products.find((x) => recNorm(x.name) === recNorm(L.name));
      const lot = { name: L.name, productId: p?.id || "", qty: L.qty, unit: L.unit, lot: L.lot, dlc: L.dlc, supplier: R.supplier, receptionId: rid, fridgeId: L.fridgeId, status: "in", receivedTemp: L.temp, code: "GG-" + rid6(), photoId: L.photoId, photoUrl: L.photoId ? L.photoUrl : "", createdAt: now + i, uid: S.me.id };
      if (L.reserve) lot.reserve = L.reason || "Avec réserve";
      if (!p) lot.newProduct = L.name;
      const id = await DB.add("lots", lot).catch(() => null); if (id) ids.push(id);
    }
    const refused = lines.filter((L) => L.refused); const nres = lines.filter((L) => L.reserve).length;
    await logEvent("reception", `a réceptionné ${R.supplier || "une livraison"} · ${ids.length} produit${ids.length > 1 ? "s" : ""}${nres ? ` · ${nres} avec réserve` : ""}${refused.length ? ` · refusé : ${refused.map((L) => L.name + (L.reason ? ` (${L.reason.toLowerCase()})` : "")).join(", ")}` : ""}`, { ref: rid, photoUrl: lines.find((L) => L.photoUrl)?.photoUrl || "" });
    R.saving = false; R.done = ids; R.savedAt = now; R.anim = "fwd"; R.celebrate = true; SFX.done(); buzz([10, 30, 10, 30, 20]);
    R.doneAt = Date.now(); recDraftClear(); rerender(); const v = $("#viewport .view:not(.leave)"); v && v.scrollTo({ top: 0 });
  },
});
