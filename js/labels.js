/* Growth Gusto — area: labels */
VIEWS.scan = {
  render() {
    const recent = activeLots().slice(0, 6);
    return `<div class="inner narrow">${topBar("Scanner")}
      <div class="cam st" style="--i:1" data-act="scanPhoto" role="button" tabindex="0" aria-label="Photographier un QR code"><div class="ret"><span></span><span></span><span></span><span></span></div><div class="camico">${ico("camera")}</div><div class="cta">Photographier le QR<small>Visez l'étiquette, le produit s'ouvre tout seul</small></div></div>
      <div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:10px"><div class="hstack"><span class="ic">${ico("keyboard")}</span><div><b class="h3">Douchette ou code</b><div class="sub">Une douchette Bluetooth tape le code ici toute seule</div></div></div>
        <form class="hstack" data-form="code"><input class="input mono" id="codeIn" placeholder="GG-7K3F2" autocomplete="off" autocapitalize="characters" enterkeyhint="go" style="flex:1"><button class="btn acc sm" style="height:50px">OK</button></form></div>
      <div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">Récents</span></div>${lotList(recent, true)}</div></div>`;
  },
  after(v) { const i = $("#codeIn", v); if (i && window.matchMedia("(min-width:960px)").matches && !v.classList.contains("nost")) setTimeout(() => i.focus(), 400); },
};


VIEWS.imprimante = {
  render() {
    const pr = S.resto?.printer;
    return `<div class="inner narrow">${topBar("Imprimante")}
      <div class="glass pad st" style="--i:1;text-align:center"><div class="printer" style="height:110px"><div class="body"></div></div><b class="h3">${pr ? esc(pr) : "Aucune imprimante choisie"}</b><p class="sub" style="margin:4px 0 0">${pr ? "Modèle enregistré pour le restaurant" : "Choisissez le modèle que vous allez utiliser"}</p></div>
      <div class="glass pad st" style="--i:2">${[["Zebra ZD421d", "Wi-Fi + Bluetooth · recommandée · ≈ 400 à 550 € HT", "wifi"], ["Brother QL-820NWB", "Wi-Fi + Bluetooth + Ethernet · ≈ 200 à 280 € HT", "bt"]].map(([n, d, i]) => `<div class="li tap" data-act="printerSet" data-v="${n}"><span class="ic">${ico(i)}</span><div class="tx"><b>${n}</b><em>${d}</em></div>${pr === n ? `<span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : ico("chev")}</div>`).join("")}</div>
      <div class="glass pad st" style="--i:3"><span class="lbl">Étiquettes</span><p class="note" style="margin:6px 0 0">Format 50 × 30 mm, avec QR, nom, lot et DLC. Elles s'impriment depuis le téléphone (AirPrint) ou l'ordinateur.</p><span class="pill neu" style="margin-top:10px">Envoi direct en Wi-Fi · bientôt</span></div></div>`;
  },
};


function qrSvg(text) {
  try { const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(); let r = ""; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) r += `M${x} ${y}h1v1h-1z`; return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;background:#fff"><path d="${r}" fill="#000"/></svg>`; } catch (e) { return ""; }
}
function openLot(id) {
  const l = S.lots.find((x) => x.id === id); if (!l) { toast("Produit introuvable.", "err"); return; }
  const k = dlcOf(l); const st = { in: "En frigo", opened: "Ouvert", out: "Sorti", lost: "Jeté" }[l.status] || "";
  openSheet(`<div class="hstack" style="gap:14px"><span style="width:64px;height:64px;border-radius:12px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--line)">${qrSvg(l.code || l.id)}</span><div style="flex:1;min-width:0"><div class="h2" style="font-size:20px">${esc(l.name)}</div><div class="sub">${l.qty ? `${esc(l.qty)} ${esc(l.unit || "")} · ` : ""}${esc(l.supplier || "")}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</div><div class="mono" style="font-size:11.5px;color:var(--faint);margin-top:2px">${esc(l.code || "")}</div></div>${dlcPill(k)}</div>
    <div class="grid3"><div class="glass pad" style="padding:10px 12px"><span class="lbl">Reçu</span><b style="display:block;margin-top:2px">${l.createdAt ? shortDate(dayKey(new Date(l.createdAt))) : "–"}${l.receivedTemp != null && l.receivedTemp !== "" ? ` · ${fmt(num(l.receivedTemp))}°` : ""}</b></div><div class="glass pad" style="padding:10px 12px"><span class="lbl">${l.status === "opened" ? "DLC ouvert" : "DLC"}</span><b style="display:block;margin-top:2px">${k ? shortDate(k) : "–"}</b></div><div class="glass pad" style="padding:10px 12px"><span class="lbl">${st}</span><b style="display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fridgeName(l.fridgeId))}</b></div></div>
    ${l.status === "opened" ? `<div class="note">Ouvert le ${shortDate(dayKey(new Date(l.openedAt)))} à ${hm(l.openedAt)} par ${esc(nameOf(l.openedBy))}. DLC d'origine ${shortDate(l.dlc)}.</div>` : ""}
    ${l.status === "in" || l.status === "opened" ? `
    <div class="grid2">${l.status === "in" ? `<button class="btn soft" data-act="lotOpen" data-id="${l.id}">${ico("scissors")}Ouvrir</button>` : `<button class="btn soft" data-act="lotLabel" data-id="${l.id}">${ico("printer")}Étiquette</button>`}<button class="btn acc" data-act="lotOut" data-id="${l.id}">${ico("out")}Sortir</button></div>
    <div class="field"><span>Ranger dans</span><div class="chips">${S.fridges.map((f) => `<button class="chip ${l.fridgeId === f.id ? "on" : ""}" data-act="lotMove" data-id="${l.id}" data-v="${f.id}">${esc(f.name)}</button>`).join("")}</div></div>
    <div class="grid2">${l.status === "in" ? `<button class="btn ghost" data-act="lotLabel" data-id="${l.id}">${ico("printer")}Étiquette</button>` : "<span></span>"}<button class="btn ghost" style="color:var(--bad)" data-act="lotLost" data-id="${l.id}">${ico("trash")}Jeter</button></div>` : `<div class="note">Ce produit n'est plus en stock.</div>`}`);
}
function labelHtml(l) { return `<div class="label"><span class="q">${qrSvg(l.code || l.id)}</span><div style="min-width:0"><b>${esc((l.name || "").toUpperCase())}</b>${l.qty ? `${esc(l.qty)} ${esc(l.unit || "")} · ` : ""}${esc(l.supplier || "")}<br>${l.lot ? `Lot ${esc(l.lot)}<br>` : ""}DLC ${shortDate(dlcOf(l))}${l.status === "opened" ? " (ouvert)" : ""}<br>${esc(l.code || "")}</div></div>`; }
function openLabel(ids) {
  const lots = ids.map((i) => S.lots.find((l) => l.id === i)).filter(Boolean); if (!lots.length) return;
  const l = lots[0];
  openSheet(`<div style="text-align:center"><div class="h2" style="font-size:20px">${lots.length > 1 ? `${lots.length} étiquettes` : "Étiquette QR"}</div><div class="sub">Format 50 × 30 mm</div></div>
    <div class="printer" id="prAnim"><div class="body"></div><div class="paper"><span class="q">${qrSvg(l.code || l.id)}</span><div>${esc((l.name || "").toUpperCase())}<br>DLC ${shortDate(dlcOf(l))}<br>${esc(l.code || "")}</div></div></div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto">${lots.map(labelHtml).join("")}</div>
    <button class="btn acc block" data-act="labelSave" data-ids="${ids.join(",")}">${ico("download")}Enregistrer pour imprimer</button>
    <p class="note" style="margin:0;text-align:center">${S.resto?.printer ? `Imprimante : ${esc(S.resto.printer)}. ` : ""}L'image s'ouvre ensuite dans l'impression du téléphone (AirPrint) ou de l'ordinateur.</p>`);
}
async function labelPng(lots) {
  const W = 600, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H * lots.length; const g = c.getContext("2d");
  await document.fonts.ready;
  lots.forEach((l, i) => {
    const y0 = i * H; g.fillStyle = "#fff"; g.fillRect(0, y0, W, H); g.strokeStyle = "#ddd"; g.strokeRect(0.5, y0 + 0.5, W - 1, H - 1);
    const q = qrcode(0, "M"); q.addData(l.code || l.id); q.make(); const n = q.getModuleCount(); const s = Math.floor(260 / n); g.fillStyle = "#000";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect(28 + x * s, y0 + 50 + y * s, s, s);
    g.fillStyle = "#000"; g.font = "800 34px Manrope, sans-serif"; let name = (l.name || "").toUpperCase(); while (g.measureText(name).width > 290 && name.length > 3) name = name.slice(0, -2) + "…"; g.fillText(name, 300, y0 + 86);
    g.font = "600 24px 'JetBrains Mono', monospace"; const lines = [`${l.qty ? l.qty + " " + (l.unit || "") : ""}`, l.lot ? `Lot ${l.lot}` : (l.supplier || ""), `DLC ${shortDate(dlcOf(l))}${l.status === "opened" ? " ouvert" : ""}`, l.code || ""].filter(Boolean);
    lines.forEach((t, j) => g.fillText(t.slice(0, 20), 300, y0 + 136 + j * 40));
  });
  return new Promise((r) => c.toBlob(r, "image/png"));
}


function lookupCode(raw) {
  const code = String(raw || "").trim().toUpperCase(); if (!code) return;
  const l = S.lots.find((x) => (x.code || "").toUpperCase() === code || x.id === raw.trim());
  if (l) { SFX.scan(); buzz(15); openLot(l.id); const i = $("#codeIn"); if (i) i.value = ""; } else { SFX.err(); toast(`Aucun produit avec le code ${code}`, "err"); }
}

function minDay(a, b) { if (!b) return a; return a < b ? a : b; }

Object.assign(ACT, {
  lot: (a, id) => { SFX.tap(); openLot(id); },
  lotOpen: (a, id) => {
    const l = S.lots.find((x) => x.id === id);
    openSheet(`<div class="h2" style="font-size:20px">Ouvrir ${esc(l.name)}</div><p class="sub" style="margin:0">À consommer dans combien de jours une fois ouvert ?</p>
      <div class="chips" style="flex-wrap:wrap">${[1, 2, 3, 4, 5, 7].map((d) => `<button class="chip ${d === 3 ? "on" : ""}" data-act="openDays" data-v="${d}">${d} jour${d > 1 ? "s" : ""}</button>`).join("")}</div>
      <div class="glass pad" style="padding:12px 14px"><span class="lbl">Nouvelle DLC</span><div class="h3 mono" id="openDlc" style="margin-top:2px">${shortDate(minDay(addDays(dayKey(), 3), l.dlc))}</div></div>
      <button class="btn soft block" data-act="openPhoto">${ico("camera")}<span id="opPh">Photo de l'étiquette d'origine</span></button>
      <button class="btn acc block" data-act="openOk" data-id="${id}">${ico("scissors")}Confirmer l'ouverture</button>`);
    S.ui.openDays = 3; S.ui.openPhoto = null;
  },
  openDays: (a, id, v) => { S.ui.openDays = +v; $$("[data-act=openDays]").forEach((b) => b.classList.toggle("on", b === a)); const l = S.lots.find((x) => x.id === $("[data-act=openOk]").dataset.id); $("#openDlc").textContent = shortDate(minDay(addDays(dayKey(), +v), l.dlc)); SFX.tick(); },
  openPhoto: async () => { const [f] = await pickImage(); if (!f) return; $("#opPh").textContent = "Envoi…"; const { blob } = await shrink(f); S.ui.openPhoto = await upload(blob); $("#opPh").textContent = "Photo ajoutée ✓"; SFX.ok(); },
  openOk: async (a, id) => {
    const l = S.lots.find((x) => x.id === id); const dlcOpen = minDay(addDays(dayKey(), S.ui.openDays || 3), l.dlc);
    await safe(DB.update("lots", id, { status: "opened", openedAt: Date.now(), openedBy: S.me.id, dlcOpen, openPhotoId: S.ui.openPhoto?.id || "", openPhotoUrl: S.ui.openPhoto?.url || "" }));
    await logEvent("open", `a ouvert ${l.name} · à consommer avant le ${shortDate(dlcOpen)}`, { ref: id, photoUrl: S.ui.openPhoto?.id ? S.ui.openPhoto.url : "" });
    SFX.ok(); buzz(12); toast(`Ouvert · DLC ${shortDate(dlcOpen)}`); setTimeout(() => openLabel([id]), 350);
  },
  lotOut: async (a, id) => { const l = S.lots.find((x) => x.id === id); await safe(DB.update("lots", id, { status: "out", outAt: Date.now(), outBy: S.me.id })); await logEvent("out", `a sorti ${l.name} de ${fridgeName(l.fridgeId)}`, { ref: id }); closeSheet(true); SFX.ok(); toast(`${l.name} sorti`); },
  lotLost: async (a, id) => { const l = S.lots.find((x) => x.id === id); await safe(DB.update("lots", id, { status: "lost", outAt: Date.now(), outBy: S.me.id })); await logEvent("lost", `a jeté ${l.name}${l.qty ? ` (${l.qty} ${l.unit || ""})` : ""}`, { ref: id }); closeSheet(true); SFX.close(); toast(`${l.name} noté en perte`); },
  lotMove: async (a, id, v) => { const l = S.lots.find((x) => x.id === id); if (l.fridgeId === v) return; await safe(DB.update("lots", id, { fridgeId: v })); await logEvent("lot", `a rangé ${l.name} dans ${fridgeName(v)}`, { ref: id }); $$("[data-act=lotMove]").forEach((b) => b.classList.toggle("on", b === a)); SFX.ok(); toast(`Rangé dans ${fridgeName(v)}`); },
  lotLabel: (a, id) => openLabel([id]),
  labelsAll: () => openLabel(S.rec.done),
  labelSave: async (a) => {
    const lots = a.dataset.ids.split(",").map((i) => S.lots.find((l) => l.id === i)).filter(Boolean);
    const p = $("#prAnim"); if (p) { p.classList.remove("go"); void p.offsetWidth; p.classList.add("go"); } SFX.print();
    const blob = await labelPng(lots);
    if (S.cap.downloads) { try { await S.cap.downloads.save({ filename: lots.length > 1 ? `etiquettes-${dayKey()}.png` : `etiquette-${(lots[0].code || "produit").toLowerCase()}.png`, data: blob }); toast("Étiquette prête à imprimer"); } catch (e) { if (e && e.code !== "declined") toast("Enregistrement impossible dans cette vue.", "err"); } }
    else { const u = URL.createObjectURL(blob); window.open(u, "_blank"); }
  },
  scanPhoto: async (a) => {
    const [f] = await pickImage(); if (!f) return; const cam = $(".cam"); cam && cam.classList.add("busy");
    try {
      const { canvas } = await shrink(f, 1400, 0.9); const g = canvas.getContext("2d"); const d = g.getImageData(0, 0, canvas.width, canvas.height);
      const r = window.jsQR ? jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" }) : null;
      if (r && r.data) lookupCode(r.data); else { SFX.err(); toast("QR illisible : rapprochez-vous et évitez les reflets.", "err"); }
    } catch (e) { SFX.err(); toast("Photo illisible.", "err"); }
    cam && cam.classList.remove("busy");
  },

  printerSet: async (a, id, v) => { await safe(DB.update("restos", S.rid, { printer: v })); SFX.ok(); toast(`${v} enregistrée`); },

});
