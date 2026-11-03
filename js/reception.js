/* Growth Gusto — area: reception */
VIEWS.reception = {
  live: false,
  render() {
    const R = S.rec;
    if (R.done) {
      const lots = S.lots.filter((l) => R.done.includes(l.id));
      return `<div class="inner narrow">${topBar("Réception validée")}
        <div class="glass pad st" style="--i:1;text-align:center"><div style="display:flex;justify-content:center;margin:6px 0 10px"><span class="check draw" style="width:64px;height:64px"><svg viewBox="0 0 24 24" style="width:30px;height:30px"><path d="M6 12.5l4 4 8-9"/></svg></span></div><div class="h2">${esc(R.supplier || "Livraison")} est rangé</div><p class="sub" style="margin:6px 0 0">${R.done.length} produit${R.done.length > 1 ? "s" : ""} ajouté${R.done.length > 1 ? "s" : ""} aux frigos, registre mis à jour.</p></div>
        <div class="glass pad st" style="--i:2"><div class="row"><span class="lbl">Étiquettes QR à coller</span></div>${lotList(lots, true)}</div>
        <button class="btn soft block st" style="--i:3" data-act="labelsAll">${ico("printer")}Préparer toutes les étiquettes</button>
        <button class="btn acc block st" style="--i:4" data-go="home">Terminé</button></div>`;
    }
    const steps = `<div class="hstack st" style="--i:1;gap:6px">${[1, 2].map((n) => `<span style="flex:1;height:5px;border-radius:5px;background:${n <= R.step ? "linear-gradient(90deg,#7A4DFF,#4A1FE6)" : "rgba(14,19,48,.08)"};transition:background .4s"></span>`).join("")}</div>`;
    const sups = [...new Set(S.receptions.map((r) => r.supplier).filter(Boolean))].slice(0, 8);
    if (R.step === 1) {
      if (!R.lines.length) { R.lines.push(newLine()); R.open = 0; }
      return `<div class="inner narrow">${topBar("Réception", { right: `<span class="pill acc">${R.lines.length} produit${R.lines.length > 1 ? "s" : ""}</span>` })}${steps}
        <div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:10px">
          <div class="grid2" style="grid-template-columns:1.6fr 1fr"><label class="field"><span>Fournisseur</span><input class="input" data-bind="rec.supplier" value="${esc(R.supplier)}" placeholder="Marée Atlantique" autocomplete="off"></label><label class="field"><span>N° BL</span><input class="input mono" data-bind="rec.bl" value="${esc(R.bl)}" placeholder="facultatif" autocomplete="off"></label></div>
          ${sups.length ? `<div class="chips">${sups.map((s) => `<button class="chip ${R.supplier === s ? "on" : ""}" data-act="recSup" data-v="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
        </div>
        <datalist id="prodList">${[...new Set([...S.products.map((p) => p.name), ...S.lots.map((l) => l.name)])].slice(0, 200).map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        ${R.lines.map((L, i) => (i === R.open ? lineCard(L, i) : lineRow(L, i))).join("")}
        <button class="btn soft block st" style="--i:6" data-act="recAdd">${ico("plus")}Ajouter un produit</button>
        <div class="ctabar"><button class="btn acc block" data-act="recNext">Vérifier et valider</button></div></div>`;
    }
    const issues = R.lines.filter((L) => !lineOk(L));
    return `<div class="inner narrow">${topBar("Vérification", { right: `<span class="pill acc">2 / 2</span>` })}${steps}
      <div class="glass pad st" style="--i:2"><div class="row"><div><span class="lbl">Fournisseur</span><div class="h3" style="margin-top:2px">${esc(R.supplier || "Non précisé")}</div></div><span class="mono sub">${esc(R.bl)}</span></div></div>
      <div class="glass pad st" style="--i:3">${R.lines.map((L, i) => `<div class="li" style="flex-wrap:wrap"><span class="ic ${L.refused ? "bad" : lineOk(L) ? "ok" : "warn"}">${ico(L.refused ? "x" : lineOk(L) ? "check" : "alert")}</span><div class="tx"><b>${esc(L.name || "Sans nom")}${L.qty ? ` · ${esc(L.qty)} ${esc(L.unit)}` : ""}</b><em>${L.temp !== "" ? `${esc(L.temp)} °C (max ${L.tmax})` : "Température non notée"} · DLC ${L.dlc ? shortDate(L.dlc) : "–"} · ${esc(fridgeName(L.fridgeId))}${L.photoId || L.photoUrl ? " · photo ✓" : ""}</em></div>
        ${lineOk(L) ? "" : `<div class="seg" style="width:100%;margin-top:4px"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${L.refused ? "100%" : "0"})"></span><button class="${L.refused ? "" : "on"}" data-act="recRefuse" data-i="${i}" data-v="0">Accepter avec réserve</button><button class="${L.refused ? "on" : ""}" data-act="recRefuse" data-i="${i}" data-v="1">Refuser</button></div>`}</div>`).join("")}</div>
      ${issues.length ? `<p class="note st" style="--i:4;margin:0">Un produit refusé repart avec le livreur : il est noté au registre mais n'entre pas en frigo.</p>` : ""}
      <div class="ctabar grid2"><button class="btn soft" data-act="recPrev">Modifier</button><button class="btn acc" data-act="recSave">${ico("check")}Valider</button></div></div>`;
  },
};
function newLine() { const f = S.fridges[0]; return { name: "", qty: "", unit: "kg", temp: "", tmax: f ? f.max : 4, dlc: "", lot: "", fridgeId: f ? f.id : "", photoId: "", photoUrl: "", sanitary: "", peche: "", ocr: null, refused: false }; }
function lineOk(L) { const t = num(L.temp); return t != null && t <= L.tmax; }
function lineRow(L, i) {
  const t = num(L.temp);
  return `<div class="glass st" style="--i:${i + 3};padding:12px 16px;cursor:pointer" data-act="recOpen" data-i="${i}"><div class="row"><div class="hstack" style="min-width:0">${L.photoUrl ? `<span class="thumb" style="width:40px;height:40px;border-radius:11px"><img src="${esc(L.photoUrl)}" alt=""></span>` : `<span class="ic">${ico("box")}</span>`}<div style="min-width:0"><b class="h3" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(L.name || "Produit sans nom")}</b><span class="sub">${L.qty ? `${esc(L.qty)} ${esc(L.unit)} · ` : ""}${esc(fridgeName(L.fridgeId))}</span></div></div><div class="hstack" style="gap:8px"><span class="mono" style="font-weight:700;color:${t == null ? "var(--faint)" : t <= L.tmax ? "var(--ok)" : "var(--bad)"}">${t == null ? "–°" : fmt(t) + "°"}</span>${L.dlc ? dlcPill(L.dlc) : `<span class="pill neu">DLC ?</span>`}</div></div></div>`;
}
function lineCard(L, i) {
  const t = num(L.temp); const today = dayKey();
  return `<div class="glass pad st" style="--i:${i + 3};display:flex;flex-direction:column;gap:12px" data-line="${i}">
    <div class="row"><span class="lbl">Produit ${i + 1}</span>${R_rm(i)}</div>
    <div class="hstack" style="align-items:stretch">${L.photoUrl ? `<span class="thumb ${L.ocr === "busy" ? "scan" : ""}"><img src="${esc(L.photoUrl)}" alt="Étiquette sanitaire"></span>` : ""}
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;justify-content:center"><button class="btn ${L.photoUrl ? "soft sm" : "acc"}" data-act="recPhoto" data-i="${i}">${ico("camera")}${L.photoUrl ? "Reprendre la photo" : "Photographier l'étiquette"}</button>
      ${L.ocr === "busy" ? `<span class="note">Lecture de l'étiquette…</span>` : L.ocr && typeof L.ocr === "object" ? `<div class="ocr">${Object.entries(L.ocr).filter(([, v]) => v).map(([k, v], j) => `<span style="--i:${j}">${esc(k)} : ${esc(v)}</span>`).join("")}</div>` : L.ocr === "fail" ? `<span class="note">Lecture impossible, complétez à la main. La photo est gardée 6 mois.</span>` : L.photoUrl ? "" : `<span class="note" style="text-align:center">Le lot, la DLC et le fournisseur se remplissent tout seuls.</span>`}</div></div>
    <input class="input" list="prodList" data-bind="rec.lines.${i}.name" value="${esc(L.name)}" placeholder="Nom du produit" autocomplete="off">
    <div class="grid2"><label class="field"><span>Quantité</span><div class="hstack" style="gap:6px"><input class="input mono" inputmode="decimal" data-bind="rec.lines.${i}.qty" value="${esc(L.qty)}" placeholder="2,4" style="flex:1;width:auto;min-width:0"><select class="input" data-bind="rec.lines.${i}.unit" style="flex:none;width:auto;min-width:84px;padding:0 8px">${UNITS.map((u) => `<option ${u === L.unit ? "selected" : ""}>${u}</option>`).join("")}</select></div></label>
      <label class="field"><span>Température <button class="pill acc" style="border:0;cursor:pointer;margin-left:4px" data-act="recTcycle" data-i="${i}">max ${L.tmax} °C</button></span><input class="input mono" inputmode="decimal" data-bind="rec.lines.${i}.temp" value="${esc(L.temp)}" placeholder="°C" style="color:${t == null ? "inherit" : t <= L.tmax ? "var(--ok)" : "var(--bad)"}"></label></div>
    <div class="field"><span>DLC${L.dlc ? ` · ${shortDate(L.dlc)}` : ""}</span><div class="chips">${[1, 3, 5, 7, 14].map((d) => { const k = addDays(today, d); return `<button class="chip ${L.dlc === k ? "on" : ""}" data-act="recDlc" data-i="${i}" data-v="${k}">J+${d}</button>`; }).join("")}<label class="chip ${L.dlc && ![1, 3, 5, 7, 14].some((d) => addDays(today, d) === L.dlc) ? "on" : ""}" style="position:relative">Autre date<input type="date" data-bind="rec.lines.${i}.dlc" data-rer="1" value="${esc(L.dlc)}" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Autre date de DLC"></label></div></div>
    <div class="grid2"><label class="field"><span>N° de lot</span><input class="input mono" data-bind="rec.lines.${i}.lot" value="${esc(L.lot)}" placeholder="85-194"></label><div class="field"><span>Ranger dans</span><div class="chips">${S.fridges.map((f) => `<button class="chip ${L.fridgeId === f.id ? "on" : ""}" data-act="recFr" data-i="${i}" data-v="${f.id}">${esc(f.name)}</button>`).join("")}</div></div></div>
  </div>`;
}
const R_rm = (i) => (S.rec.lines.length > 1 ? `<button class="btn ghost sm" data-act="recRm" data-i="${i}" style="color:var(--bad)">Retirer</button>` : "");


Object.assign(ACT, {
  recSup: (a, id, v) => { S.rec.supplier = v; SFX.tick(); rerender(); },
  recNext: () => {
    const R = S.rec;
    const bad = R.lines.findIndex((L) => !L.name.trim()); if (bad >= 0) { SFX.err(); toast("Donnez un nom à chaque produit.", "err"); if (R.open !== bad) { R.open = bad; rerender(); } const el = $(`[data-line="${bad}"]`); el && (el.classList.add("shake"), el.scrollIntoView({ behavior: "smooth", block: "center" })); return; }
    R.step = 2; SFX.tap(); rerender(); $("#viewport .view").scrollTo({ top: 0, behavior: "smooth" });
  },
  recPrev: () => { S.rec.step = Math.max(1, S.rec.step - 1); SFX.tap(); rerender(); },
  recAdd: () => { const last = S.rec.lines[S.rec.lines.length - 1]; const L = newLine(); if (last) { L.fridgeId = last.fridgeId; L.tmax = last.tmax; L.unit = last.unit; } S.rec.lines.push(L); S.rec.open = S.rec.lines.length - 1; SFX.tap(); rerender(); setTimeout(() => { const el = $(`[data-line="${S.rec.lines.length - 1}"]`); el && el.scrollIntoView({ behavior: "smooth", block: "center" }); el && $("input", el).focus(); }, 60); },
  recRm: (a, id, v) => { S.rec.lines.splice(+a.dataset.i, 1); S.rec.open = -1; SFX.close(); rerender(); },
  recOpen: (a) => { S.rec.open = +a.dataset.i; SFX.tap(); rerender(); setTimeout(() => { const el = $(`[data-line="${S.rec.open}"]`); el && el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); },
  recTcycle: (a, id, v, e) => { e.preventDefault(); const L = S.rec.lines[+a.dataset.i]; const opts = [0, 2, 3, 4, 6, 8]; L.tmax = opts[(opts.indexOf(L.tmax) + 1) % opts.length] ?? 4; SFX.tick(); rerender(); },
  recDlc: (a) => { S.rec.lines[+a.dataset.i].dlc = a.dataset.v; SFX.tick(); rerender(); },
  recRefuse: (a) => { S.rec.lines[+a.dataset.i].refused = a.dataset.v === "1"; SFX.tick(); rerender(); },
  recTmax: (a) => { S.rec.lines[+a.dataset.i].tmax = +a.dataset.v; SFX.tick(); rerender(); },
  recFr: (a) => { const L = S.rec.lines[+a.dataset.i]; L.fridgeId = a.dataset.v; const f = S.fridges.find((x) => x.id === a.dataset.v); if (f && f.max < L.tmax) L.tmax = f.max; SFX.tick(); rerender(); },
  recPhoto: async (a) => {
    const i = +a.dataset.i; const [f] = await pickImage(); if (!f) return; const L = S.rec.lines[i];
    const { blob } = await shrink(f); L.photoUrl = URL.createObjectURL(blob); L.ocr = S.cap.sample ? "busy" : null; rerender();
    const up = upload(blob);
    if (S.cap.sample) {
      try {
        const res = await S.cap.sample.json(`Tu lis la photo d'une étiquette sanitaire de produit alimentaire reçue par un restaurant en France. Réponds uniquement en JSON avec ces clés (chaîne vide si absent) : {"produit":"","fournisseur":"","lot":"","dlc":"AAAA-MM-JJ","date_peche":"AAAA-MM-JJ","numero_sanitaire":"","poids":"nombre en kg ou vide"}. La DLC est la date limite de consommation (ou DLUO/DDM si c'est la seule). Le numéro sanitaire est dans l'ovale (ex. FR 85.194.001 CE).`, { images: [blob], modelTier: "default" });
        const r = res || {};
        if (r.lot) L.lot = r.lot; if (/^\d{4}-\d{2}-\d{2}$/.test(r.dlc || "")) L.dlc = r.dlc; if (!L.name && r.produit) L.name = r.produit; if (!S.rec.supplier && r.fournisseur) S.rec.supplier = r.fournisseur; if (!L.qty && r.poids) { L.qty = String(r.poids).replace(".", ","); L.unit = "kg"; }
        L.sanitary = r.numero_sanitaire || ""; L.peche = r.date_peche || "";
        L.ocr = { Lot: r.lot, DLC: r.dlc ? shortDate(r.dlc) : "", "N° sanitaire": r.numero_sanitaire, Pêche: r.date_peche ? shortDate(r.date_peche) : "", Fournisseur: r.fournisseur };
        SFX.ok(); buzz(10);
      } catch (e) { console.warn(e); L.ocr = "fail"; SFX.err(); }
    }
    const u = await up; L.photoId = u.id; if (u.id) L.photoUrl = u.url; rerender();
  },
  recSave: async (a) => {
    const R = S.rec; a.setAttribute("disabled", ""); const now = Date.now(); const rid = await safe(DB.add("receptions", { supplier: R.supplier, bl: R.bl, at: now, uid: S.me.id, lines: R.lines.map((L) => ({ name: L.name, qty: L.qty, unit: L.unit, temp: num(L.temp), tmax: L.tmax, dlc: L.dlc, lot: L.lot, fridgeId: L.fridgeId, photoId: L.photoId, photoUrl: L.photoId ? L.photoUrl : "", sanitary: L.sanitary, peche: L.peche, ok: lineOk(L), refused: !!(L.refused && !lineOk(L)) })) })).catch(() => null);
    if (!rid) { a.removeAttribute("disabled"); return; }
    const ids = [];
    for (const L of R.lines.filter((x) => !(x.refused && !lineOk(x)))) {
      const p = S.products.find((x) => x.name.toLowerCase() === L.name.trim().toLowerCase());
      const id = await DB.add("lots", { name: L.name.trim(), productId: p?.id || "", qty: L.qty, unit: L.unit, lot: L.lot, dlc: L.dlc, supplier: R.supplier, receptionId: rid, fridgeId: L.fridgeId, status: "in", receivedTemp: num(L.temp), code: "GG-" + rid6(), photoId: L.photoId, photoUrl: L.photoId ? L.photoUrl : "", createdAt: now, uid: S.me.id });
      ids.push(id);
    }
    const refused = R.lines.filter((L) => L.refused && !lineOk(L)); const issues = R.lines.filter((L) => !lineOk(L)).length - refused.length;
    await logEvent("reception", `a réceptionné ${R.supplier || "une livraison"} · ${ids.length} produit${ids.length > 1 ? "s" : ""}${issues ? ` · ${issues} avec réserve` : ""}${refused.length ? ` · refusé : ${refused.map((L) => L.name).join(", ")}` : ""}`, { ref: rid, photoUrl: R.lines.find((L) => L.photoId)?.photoUrl || "" });
    R.done = ids; SFX.ok(); buzz([10, 30, 10]); setTimeout(() => { rerender(); if (ids.length) setTimeout(() => openLabel(ids), 500); }, 300);
  },

});
