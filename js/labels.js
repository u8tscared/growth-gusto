/* Growth Gusto — area: labels (scan caméra, fiche produit, étiquettes QR, imprimante) */

Object.assign(IC, {
  lbFlash: ["M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z", "M6 6h12", "M12 12v2"],
  lbUndo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"],
  lbLayers: ["m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z", "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65", "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"],
  lbFull: ["M8 3H5a2 2 0 0 0-2 2v3", "M21 8V5a2 2 0 0 0-2-2h-3", "M3 16v3a2 2 0 0 0 2 2h3", "M16 21h3a2 2 0 0 0 2-2v-3"],
  lbDone: ["c:12,12,10", "m8.5 12 2.5 2.5 4.5-5"],
  lbLock: ["r:4,11,16,10,2", "M8 11V7a4 4 0 0 1 8 0v4"],
  lbOne: ["r:5,5,14,14,3", "M12 9v6"],
});

/* ───────────── helpers ───────────── */
const lbLot = (id) => S.lots.find((x) => x.id === id);
const lbTestMode = () => S.resto?.printTest !== false;
const lbDate = (k) => { const d = parseDay(k); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}` : "–"; };
function lbParseCode(raw) { const s = String(raw || "").trim(); const m = s.toUpperCase().match(/GG-[0-9A-Z]{4,8}/); return m ? m[0] : s.toUpperCase(); }
function lbFind(raw) { const code = lbParseCode(raw); const t = String(raw || "").trim(); return S.lots.find((x) => (x.code || "").toUpperCase() === code || x.id === t) || null; }
/* "2.5" or "2,5" -> "2,5 kg"; empty when no quantity */
function lbQty(l) { if (l.qty == null || l.qty === "") return ""; const n = num(l.qty); const q = n == null ? String(l.qty) : fmt(n, n % 1 ? (Math.round(n * 10) === n * 10 ? 1 : 2) : 0); return `${q}${l.unit ? ` ${l.unit}` : ""}`; }
function lbDays(k) {
  const d = daysUntil(k);
  if (d == null) return { d: null, txt: "Sans DLC", cls: "neu" };
  if (d < 0) return { d, txt: `Dépassée depuis ${-d} jour${d < -1 ? "s" : ""}`, cls: "bad" };
  if (d === 0) return { d, txt: "À consommer aujourd'hui", cls: "bad" };
  if (d === 1) return { d, txt: "À consommer demain", cls: "bad" };
  return { d, txt: `Encore ${d} jours`, cls: d <= 3 ? "warn" : "ok" };
}
function qrSvg(text) {
  try { const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(); let r = ""; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) r += `M${x} ${y}h1v1h-1z`; return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;background:#fff"><path d="${r}" fill="#000"/></svg>`; } catch (e) { return ""; }
}
function lbSheet(html) {
  const sh = $("#sheet");
  if (sh && sh.classList.contains("open")) { const b = $("#sheetBody"); b.innerHTML = html; sh.scrollTop = 0; b.classList.remove("lb-swap"); void b.offsetWidth; b.classList.add("lb-swap"); }
  else openSheet(html);
}
function lbToastUndo(msg) {
  toast(msg); S.ui.undo = null;
  $("#toastTx").innerHTML = `${esc(msg)} <button data-act="lbUndo" style="all:unset;cursor:pointer;margin-left:10px;font-weight:800;color:#B9A6FF">Annuler</button>`;
  const t = $("#toast"); t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 5000);
}
/* every lot change goes through here, so the last one can be undone */
async function lbDo(id, patch, type, text, label, undoTxt) {
  const l = lbLot(id); if (!l) return; const prev = { ...l }; delete prev.id;
  await safe(DB.update("lots", id, patch));
  let evId = null; try { evId = await DB.add("events", { type, text, at: Date.now(), uid: S.me.id, ref: id }); } catch (e) {}
  S.ui.lbUndo = { id, prev, evId, label, undoTxt: undoTxt || `a annulé une action sur ${l.name}`, at: Date.now() };
}
/* one write at a time: a double tap (wet fingers, laggy phone) must never log twice */
let lbBusy = false;
const lbOnce = (fn) => async (...a) => { if (lbBusy) return; lbBusy = true; try { await fn(...a); } catch (e) { console.warn(e); } finally { lbBusy = false; } };

/* ───────────── live camera scanner ───────────── */
const LB = { stream: null, track: null, raf: 0, state: "off", starting: false, torch: false, torchOk: false, hold: false, cv: null, last: 0, lotsRef: null, mode: "one", batch: [], seen: {}, sheetWas: false, resumeAt: 0, lastCode: "", lastSeen: 0 };
const lbStageEl = () => $("#viewport .view:not(.leave) #lbStage");

function lbStageMsg() {
  const st = LB.state;
  const photo = `<button class="btn soft sm" data-act="scanPhoto">${ico("image")}Prendre une photo</button>`;
  if (st === "denied") return `<div class="lb-msg"><span class="lb-mi bad">${ico("lbLock")}</span><b>Caméra bloquée</b><p>Autorisez la caméra pour Growth Gusto dans les réglages du navigateur (le cadenas ou « aA » à côté de l'adresse), puis touchez Réessayer.</p><div class="hstack lb-mb"><button class="btn acc sm" data-act="lbRetry">Réessayer</button>${photo}</div></div>`;
  if (st === "nocam") return `<div class="lb-msg"><span class="lb-mi">${ico("camera")}</span><b>Pas de caméra disponible</b><p>Prenez une photo du QR, ou tapez le code juste en dessous. Une douchette Bluetooth marche aussi.</p><div class="hstack lb-mb">${photo}<button class="btn ghost sm" style="color:#fff" data-act="lbRetry">Réessayer</button></div></div>`;
  if (st === "busy") return `<div class="lb-msg"><span class="lb-mi">${ico("camera")}</span><b>Caméra déjà utilisée</b><p>Fermez l'autre application qui filme, puis réessayez.</p><div class="hstack lb-mb"><button class="btn acc sm" data-act="lbRetry">Réessayer</button>${photo}</div></div>`;
  if (st === "off") return `<div class="lb-msg"><button class="lb-start" data-act="lbRetry"><span class="camico">${ico("camera")}</span><b>Activer la caméra</b></button></div>`;
  if (st === "starting") return `<div class="lb-msg"><span class="lb-spin"></span><b style="margin-top:6px">Ouverture de la caméra…</b></div>`;
  return "";
}
function lbSetState(st) {
  LB.state = st; const stage = lbStageEl(); if (!stage) return;
  stage.dataset.state = st; $(".lb-msgw", stage).innerHTML = lbStageMsg();
  const tb = $("[data-act=lbTorch]", stage); if (tb) { tb.hidden = !(st === "live" && LB.torchOk); tb.classList.toggle("on", LB.torch); }
}
async function lbStart() {
  if (LB.stream || LB.starting) { if (LB.stream) lbSetState("live"); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { lbSetState("nocam"); return; }
  LB.starting = true; lbSetState("starting");
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (S.route !== "scan" || document.hidden) { s.getTracks().forEach((t) => t.stop()); LB.state = "off"; return; }
    LB.stream = s; LB.track = s.getVideoTracks()[0]; LB.torch = false;
    let caps = {}; try { caps = (LB.track.getCapabilities && LB.track.getCapabilities()) || {}; } catch (e) {}
    LB.torchOk = !!caps.torch;
    const st = lbStageEl(); const v = st && $("video", st); if (v) { v.srcObject = s; v.play().catch(() => {}); }
    lbSetState("live");
  } catch (e) {
    const n = e && e.name;
    lbSetState(n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError" ? "denied" : n === "NotReadableError" || n === "TrackStartError" ? "busy" : "nocam");
  } finally { LB.starting = false; }
}
function lbStop() {
  if (LB.stream) LB.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
  LB.stream = null; LB.track = null; LB.torch = false; if (["live", "starting"].includes(LB.state)) LB.state = "off";
  cancelAnimationFrame(LB.raf); LB.raf = 0;
}
function lbLoop() {
  LB.raf = requestAnimationFrame(lbLoop);
  const stage = lbStageEl();
  if (S.route !== "scan" || !stage || document.hidden) { lbStop(); return; }
  if (S.lots !== LB.lotsRef) { LB.lotsRef = S.lots; lbPatchLists(); }
  if (LB.state !== "live" || !LB.stream) return;
  const video = $("video", stage);
  if (video.srcObject !== LB.stream) { video.srcObject = LB.stream; video.play().catch(() => {}); }
  const now = performance.now();
  if (LB.hold || $("#sheet").classList.contains("open") || $("#lbQr")) { LB.sheetWas = true; return; }
  if (LB.sheetWas) { LB.sheetWas = false; LB.resumeAt = now; lbResetVf(); }
  if (now - LB.last < 90 || video.readyState < 2 || !video.videoWidth || !window.jsQR) return;
  LB.last = now;
  const vw = video.videoWidth, vh = video.videoHeight, side = Math.min(vw, vh) * 0.86, sx = (vw - side) / 2, sy = (vh - side) / 2, N = 420;
  const cv = LB.cv || (LB.cv = document.createElement("canvas")); if (cv.width !== N) { cv.width = N; cv.height = N; }
  const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(video, sx, sy, side, side, 0, 0, N, N);
  let r = null; try { r = jsQR(g.getImageData(0, 0, N, N).data, N, N, { inversionAttempts: "dontInvert" }); } catch (e) {}
  if (!r || !r.data) return;
  const k = side / N, L = r.location; const pts = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map((p) => [sx + p.x * k, sy + p.y * k]);
  lbDetected(r.data, pts, stage, video, now);
}
function lbDetected(raw, pts, stage, video, now) {
  const code = lbParseCode(raw);
  if (LB.mode === "multi") {
    if (LB.seen[code] && now - LB.seen[code] < 3500) { LB.seen[code] = now; return; }
    LB.seen[code] = now; lbFlash(stage, lbFind(raw) ? "hit" : "miss"); lbBatchAdd(raw); return;
  }
  /* the same label still in front of the lens after closing its sheet: ignore it until it leaves the frame */
  const same = code === LB.lastCode && (now - LB.lastSeen < 1200 || now - LB.resumeAt < 1500);
  if (code === LB.lastCode) LB.lastSeen = now;
  if (same) return;
  LB.lastCode = code; LB.lastSeen = now; LB.hold = true;
  const l = lbFind(raw); lbVfTo(stage, video, pts); stage.classList.add(l ? "hit" : "miss");
  const still = () => S.route === "scan" && lbStageEl() === stage;
  if (l) { SFX.scan(); buzz(18); setTimeout(() => { stage.classList.remove("hit"); LB.hold = false; LB.sheetWas = true; LB.lastSeen = performance.now(); if (still()) openLot(l.id); }, 520); }
  else { SFX.err(); buzz([30, 40, 30]); toast(/^GG-/.test(code) ? `Aucun produit avec le code ${code}` : "Ce QR n'est pas une étiquette Growth Gusto", "err"); setTimeout(() => { stage.classList.remove("miss"); lbResetVf(); LB.hold = false; LB.resumeAt = LB.lastSeen = performance.now(); }, 1300); }
}
function lbVfTo(stage, video, pts) {
  const vf = $(".lb-vf", stage); if (!vf) return;
  const W = stage.clientWidth, H = stage.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
  const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  const xs = pts.map((p) => p[0] * s + ox), ys = pts.map((p) => p[1] * s + oy);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), m = 14;
  const w = Math.max(70, x1 - x0 + m * 2), h = Math.max(70, y1 - y0 + m * 2);
  Object.assign(vf.style, { left: `${(x0 + x1) / 2 - w / 2}px`, top: `${(y0 + y1) / 2 - h / 2}px`, width: `${w}px`, height: `${h}px`, margin: "0" });
}
function lbResetVf() { const vf = $("#viewport .view:not(.leave) .lb-vf"); if (vf) vf.removeAttribute("style"); }
function lbFlash(stage, kind) { stage.classList.remove("hit", "miss"); void stage.offsetWidth; stage.classList.add(kind); setTimeout(() => stage.classList.remove(kind), 650); }

/* continuous mode: each scan puts the lot in the chosen fridge (or just checks it) */
const lbTarget = () => (S.ui.lbTarget ?? (S.fridges[0]?.id || ""));
async function lbBatchAdd(raw) {
  const code = lbParseCode(raw); const l = lbFind(raw); const tgt = lbTarget();
  let row;
  if (!l) { SFX.err(); buzz([30, 40, 30]); row = { code, name: "Code inconnu", txt: code, cls: "bad" }; }
  else if (LB.batch.find((b) => b.id === l.id && !b.undone)) { SFX.tick(); const el = $(`#lbBatch [data-id="${l.id}"]`); if (el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } return; }
  else if (l.status === "out" || l.status === "lost") { SFX.err(); buzz([30, 40, 30]); row = { id: l.id, code, name: l.name, txt: l.status === "lost" ? "Déjà noté jeté" : "Déjà sorti du stock", cls: "bad" }; }
  else if (tgt && l.fridgeId !== tgt) {
    SFX.scan(); buzz(15); const from = fridgeName(l.fridgeId);
    await lbDo(l.id, { fridgeId: tgt }, "lot", `a rangé ${l.name} dans ${fridgeName(tgt)} (scan, venait de ${from})`, "rangé", `a annulé le rangement de ${l.name} dans ${fridgeName(tgt)}`);
    row = { id: l.id, code, name: l.name, txt: `Rangé dans ${fridgeName(tgt)}`, cls: "ok", undo: true };
  } else {
    SFX.scan(); buzz(15); const fn = fridgeName(l.fridgeId);
    await lbDo(l.id, { checkedAt: Date.now(), checkedBy: S.me.id }, "lot", `a contrôlé ${l.name} dans ${fn} (scan)`, "contrôlé", `a annulé le contrôle de ${l.name}`);
    row = { id: l.id, code, name: l.name, txt: `Bien dans ${fn}`, cls: "ok", undo: true };
  }
  if (l) row.dlc = dlcOf(l);
  LB.batch.unshift(row); lbRenderBatch(true);
  const i = $("#codeIn"); if (i) i.value = "";
}
function lbRenderBatch(fresh) {
  const n = LB.batch.filter((b) => b.cls === "ok" && !b.undone).length;
  const cnt = $("#lbCount"); if (cnt) { cnt.textContent = n; cnt.parentElement.hidden = !LB.batch.length || LB.mode !== "multi"; if (fresh) { cnt.parentElement.classList.remove("bump"); void cnt.offsetWidth; cnt.parentElement.classList.add("bump"); } }
  const box = $("#lbBatch"); if (!box) return;
  const u = S.ui.lbUndo; const canUndo = !!(u && LB.batch.find((b) => b.undo && !b.undone && b.id === u.id));
  box.innerHTML = LB.batch.length ? `<div class="row" style="margin-bottom:2px;min-height:40px"><span class="lbl">${n} produit${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""}</span>${canUndo ? `<button class="btn ghost sm" data-act="lbUndo" style="white-space:nowrap">${ico("lbUndo")}Annuler</button>` : ""}</div>
    ${LB.batch.slice(0, 40).map((b, i) => `<div class="li lb-brow ${i === 0 && fresh ? "lb-new" : ""} ${b.undone ? "undone" : ""}" ${b.id ? `data-id="${b.id}"` : ""}><span class="ic ${b.cls}">${ico(b.cls === "ok" ? "check" : "alert")}</span><div class="tx"><b>${esc(b.name)}</b><em>${b.undone ? "Annulé" : esc(b.txt)}</em></div>${b.dlc && !b.undone ? dlcPill(b.dlc) : ""}</div>`).join("")}
    <button class="btn soft block" data-act="lbBatchEnd" style="margin-top:10px">${ico("check")}Terminer</button>`
    : `<div class="lb-bempty"><span class="ic">${ico("lbLayers")}</span><div><b>Scannez les produits à la suite</b><span>${lbTarget() ? `Chaque produit est rangé dans ${esc(fridgeName(lbTarget()))}` : "Chaque produit est contrôlé"} dès le bip. Rien à valider.</span></div></div>`;
}
function lbPatchLists() { const r = $("#viewport .view:not(.leave) #lbRecent"); if (r) r.innerHTML = lotList(activeLots().slice(0, 6), true); }
function lbPanelHtml() {
  const multi = LB.mode === "multi"; const tgt = lbTarget();
  return `<div class="seg lb-seg st" style="--i:2"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${multi ? "100%" : "0"})"></span><button class="${multi ? "" : "on"}" data-act="lbMode" data-v="one">${ico("qr")}Un produit</button><button class="${multi ? "on" : ""}" data-act="lbMode" data-v="multi">${ico("lbLayers")}Scanner plusieurs</button></div>
    ${multi ? `<div class="glass pad st" style="--i:3"><span class="lbl">Ranger dans</span><div class="chips" style="margin-top:8px;flex-wrap:wrap">${S.fridges.map((f) => `<button class="chip ${tgt === f.id ? "on" : ""}" data-act="lbTarget" data-v="${f.id}">${esc(f.name)}</button>`).join("")}<button class="chip ${tgt === "" ? "on" : ""}" data-act="lbTarget" data-v="">Juste vérifier</button></div>
      <div id="lbBatch" style="margin-top:12px"></div></div>` : ""}
    <div class="glass pad st" style="--i:4;display:flex;flex-direction:column;gap:10px"><div class="hstack"><span class="ic">${ico("keyboard")}</span><div><b class="h3">Douchette ou code</b><div class="sub">Une douchette Bluetooth tape le code ici toute seule</div></div></div>
      <form class="hstack" data-form="code"><input class="input mono" id="codeIn" placeholder="GG-7K3F2" autocomplete="off" autocapitalize="characters" enterkeyhint="go" style="flex:1"><button class="btn acc sm" style="height:50px">OK</button></form></div>
    ${multi ? "" : `<div class="glass pad st" style="--i:5"><div class="row"><span class="lbl">Récents</span><button class="btn ghost sm" data-act="scanPhoto">${ico("image")}Depuis une photo</button></div><div id="lbRecent">${lotList(activeLots().slice(0, 6), true)}</div></div>`}`;
}
VIEWS.scan = {
  live: false,
  render() {
    return `<div class="inner narrow lb-scan">
      <div class="lb-stage st ${LB.mode === "multi" ? "multi" : ""}" style="--i:0" id="lbStage" data-state="${LB.state === "live" && !LB.stream ? "off" : LB.state}">
        <video playsinline muted autoplay></video>
        <div class="lb-vf"><i></i><i></i><i></i><i></i><b class="lb-las"></b></div>
        <div class="lb-msgw">${lbStageMsg()}</div>
        <div class="lb-top"><span class="lb-title">Scanner</span><span class="lb-cnt" hidden>${ico("check")}<b id="lbCount">0</b></span><button class="lb-rb" data-act="lbTorch" aria-label="Lampe" hidden>${ico("lbFlash")}</button></div>
        <div class="lb-hint">${LB.mode === "multi" ? "Passez les étiquettes une par une" : "Visez le QR de l'étiquette"}</div>
      </div>
      <div class="lb-panel" id="lbPanel">${lbPanelHtml()}</div></div>`;
  },
  after(v) {
    LB.lotsRef = S.lots; LB.hold = false; lbRenderBatch();
    if (!LB.raf) LB.raf = requestAnimationFrame(lbLoop);
    if (LB.state === "denied" || LB.state === "nocam" || LB.state === "busy") LB.state = "off";
    lbStart(); /* always retry: the user may have allowed the camera in the settings meanwhile */
    const i = $("#codeIn", v); if (i && window.matchMedia("(min-width:960px)").matches) setTimeout(() => i.focus({ preventScroll: true }), 400);
  },
};
document.addEventListener("visibilitychange", () => { if (document.hidden) lbStop(); else if (S.route === "scan" && lbStageEl()) { if (!LB.raf) LB.raf = requestAnimationFrame(lbLoop); if (LB.state !== "denied") lbStart(); } else if (lbWake && $("#lbQr")) lbWakeLock(); });

function lookupCode(raw) {
  const code = lbParseCode(raw); if (!code) return;
  if (S.route === "scan" && LB.mode === "multi") { LB.seen[code] = performance.now(); lbBatchAdd(raw); return; }
  const l = lbFind(raw);
  if (l) { SFX.scan(); buzz(15); openLot(l.id); const i = $("#codeIn"); if (i) { i.value = ""; i.blur(); } } else { SFX.err(); toast(`Aucun produit avec le code ${code}`, "err"); }
}

/* ───────────── fiche produit (après scan) ───────────── */
const LB_ST = { in: ["En frigo", "snow"], opened: ["Ouvert", "scissors"], out: ["Utilisé", "lbDone"], lost: ["Jeté", "trash"] };
function lbTimeline(l) {
  const evs = S.events.filter((e) => e.ref === l.id).map((e) => ({ at: e.at, uid: e.uid, type: e.undoOf != null ? "undo" : e.type, text: e.text, cancelled: !!e.cancelled }));
  const has = (t) => evs.some((e) => e.type === t && !e.cancelled);
  const rows = [...evs];
  if (l.createdAt) rows.push({ at: l.createdAt, uid: l.uid, type: "in", text: `a rentré ${l.name} dans ${fridgeName(l.fridgeId)}${l.receivedTemp != null && l.receivedTemp !== "" ? ` · ${fmt(num(l.receivedTemp))}°C à réception` : ""}` });
  if (l.openedAt && !has("open")) rows.push({ at: l.openedAt, uid: l.openedBy, type: "open", text: `a ouvert ${l.name}` });
  if (l.outAt && !has(l.status)) rows.push({ at: l.outAt, uid: l.outBy, type: l.status === "lost" ? "lost" : "out", text: l.status === "lost" ? `a jeté ${l.name}` : `a sorti ${l.name}` });
  rows.sort((a, b) => b.at - a.at);
  const icon = { in: "into", open: "scissors", out: "lbDone", lost: "trash", lot: "move", undo: "lbUndo" };
  return rows.map((e, i) => `<div class="lb-ev ${i === 0 ? "first" : ""} ${e.cancelled ? "cancelled" : ""}"><span class="lb-evi t-${e.type}">${ico(icon[e.type] || "check")}</span><div class="tx"><b>${esc(said(e.uid, e.text))}</b><em>${esc(when(e.at))}${e.cancelled ? `<span class="lb-x">Annulé</span>` : ""}</em></div></div>`).join("");
}
function openLot(id) {
  const l = lbLot(id); if (!l) { toast("Produit introuvable.", "err"); return; }
  const k = dlcOf(l); const D = lbDays(k); const [stT, stI] = LB_ST[l.status] || LB_ST.in; const active = l.status === "in" || l.status === "opened";
  const at = (ts) => (ts ? `${shortDate(dayKey(new Date(ts)))} à ${hm(ts)}` : "–");
  const sub = l.status === "in" ? `${esc(fridgeName(l.fridgeId))} · depuis le ${l.createdAt ? shortDate(dayKey(new Date(l.createdAt))) : "–"}`
    : l.status === "opened" ? `Le ${at(l.openedAt)} par ${esc(firstName(nameOf(l.openedBy)))} · ${esc(fridgeName(l.fridgeId))}`
    : `Le ${at(l.outAt)} par ${esc(firstName(nameOf(l.outBy)))}${l.status === "lost" && l.lostReason ? ` · ${esc(l.lostReason)}` : ""}`;
  const big = active && D.d != null ? `<div class="lb-cd ${D.cls}"><b class="mono">${D.d < 0 ? "!" : D.d}</b><small>${D.d < 0 ? "dépassée" : D.d === 0 ? "auj." : D.d === 1 ? "jour" : "jours"}</small></div>` : "";
  const u = S.ui.lbUndo; const undo = u && u.id === id && Date.now() - u.at < 15 * 60e3;
  const tile = (act, icon, label, cls = "") => `<button class="lb-tile ${cls}" data-act="${act}" data-id="${id}">${ico(icon)}<span>${label}</span></button>`;
  lbSheet(`<div class="lb-lot">
    <div class="hstack" style="gap:14px;align-items:flex-start"><button class="lb-qthumb" data-act="lbQr" data-id="${id}" aria-label="Afficher le QR en grand">${qrSvg(l.code || l.id)}<span>${ico("lbFull")}</span></button><div style="flex:1;min-width:0"><div class="h2" style="font-size:21px">${esc(l.name)}</div>${(() => { const m = [lbQty(l), l.supplier, l.lot ? `lot ${l.lot}` : ""].filter((x) => x && String(x).trim()); return m.length ? `<div class="sub lb-meta" style="margin-top:3px">${m.map(esc).join(" · ")}</div>` : ""; })()}<div class="mono lb-code">${esc(l.code || "")}</div></div></div>
    <div class="lb-status s-${l.status || "in"}"><span class="lb-si">${ico(stI)}</span><div class="tx"><b>${stT}</b><em>${sub}</em>${active ? `<span class="pill ${D.cls}">${l.status === "opened" ? `Nouvelle DLC ${shortDate(k)} · ` : `DLC ${shortDate(k)} · `}${D.txt}</span>` : ""}</div>${big}</div>
    ${undo ? `<div class="lb-undo"><span>Vous avez ${esc(u.label)} ce produit.</span><button class="btn soft sm" data-act="lbUndo">${ico("lbUndo")}Annuler</button></div>` : ""}
    ${active ? `<div class="grid2">${l.status === "in" ? `<button class="btn soft lb-big" data-act="lotOpen" data-id="${id}">${ico("scissors")}Ouvrir</button>` : `<button class="btn soft lb-big" data-act="lotLabel" data-id="${id}">${ico("printer")}Étiquette</button>`}<button class="btn acc lb-big" data-act="lotOut" data-id="${id}">${ico("lbDone")}Utilisé</button></div>
      <div class="lb-tiles">${tile("lotMoveAsk", "move", "Déplacer")}${l.status === "in" ? tile("lotLabel", "printer", "Étiquette") : ""}${tile("lbQr", "qr", "Voir le QR")}${tile("lotLost", "trash", "Jeter", "bad")}</div>`
      : `<div class="lb-tiles">${tile("lotLabel", "printer", "Étiquette")}${tile("lbQr", "qr", "Voir le QR")}</div>`}
    <div class="lb-tl"><span class="lbl">Historique</span><div style="margin-top:8px">${lbTimeline(l)}</div></div></div>`);
}

/* ───────────── étiquette 57 × 32 mm ───────────── */
function lbTagHtml(l) {
  const op = l.status === "opened";
  return `<div class="lb-tag"><span class="q">${qrSvg(l.code || l.id)}</span><div class="t"><b class="n ${(l.name || "").length > 24 ? "n3" : ""}">${esc(l.name || "")}</b>
    <span class="d"><small>${op ? "DLC OUVERT" : "DLC"}</small>${lbDate(dlcOf(l))}</span>
    <span class="m">${op ? `Ouvert ${shortDate(dayKey(new Date(l.openedAt)))} ${hm(l.openedAt)}` : `Reçu ${l.createdAt ? shortDate(dayKey(new Date(l.createdAt))) : "–"}${l.lot ? ` · L.${esc(l.lot)}` : ""}`}</span>
    <span class="c">${esc(l.code || "")}</span></div></div>`;
}
function labelHtml(l) { return `<div class="lb-roll">${lbTagHtml(l)}</div>`; }
function openLabel(ids) {
  const lots = ids.map((i) => lbLot(i)).filter(Boolean); if (!lots.length) return;
  const test = lbTestMode(); const one = lots.length === 1; const pr = S.resto?.printer;
  lbSheet(`${one ? `<button class="btn ghost sm lb-back" data-act="lot" data-id="${lots[0].id}">${ico("back")}<span class="lb-bk">${esc(lots[0].name)}</span></button>` : ""}
    <div style="text-align:center"><div class="h2" style="font-size:20px">${one ? "Étiquette QR" : `${lots.length} étiquettes`}</div><div class="sub">Étiquette thermique 57 × 32 mm</div></div>
    <div class="lb-feed go" id="prAnim"><div class="lb-mouth"><i></i></div><div class="lb-paper">${lots.map((l) => lbTagHtml(l)).join("")}</div></div>
    ${test ? `<div class="lb-testnote">${ico("sparkle")}<span><b>Mode test sans imprimante.</b> ${one ? "Affichez le QR en grand : un autre téléphone peut le scanner. " : ""}Ou enregistrez l'image pour l'imprimer plus tard, sur n'importe quelle imprimante.</span></div>` : ""}
    ${one && test ? `<button class="btn acc block" data-act="lbQr" data-id="${lots[0].id}">${ico("lbFull")}Afficher le QR en grand</button>` : ""}
    <button class="btn ${one && test ? "soft" : "acc"} block" data-act="labelSave" data-ids="${ids.join(",")}">${ico("download")}${test ? "Enregistrer l'image" : "Enregistrer pour imprimer"}</button>
    ${one && !test ? `<button class="btn ghost block" data-act="lbQr" data-id="${lots[0].id}">${ico("lbFull")}Afficher le QR en grand</button>` : ""}
    <p class="note" style="margin:0;text-align:center">${pr && !test ? `Imprimante : ${esc(pr)}. Envoi direct bientôt. ` : ""}L'image s'imprime depuis le téléphone (Partager, puis Imprimer) ou l'ordinateur.</p>`);
}
async function labelPng(lots) {
  const PX = 12, W = 57 * PX, H = 32 * PX, GAP = lots.length > 1 ? 24 : 0;
  const c = document.createElement("canvas"); c.width = W; c.height = H * lots.length + GAP * (lots.length - 1); const g = c.getContext("2d");
  try { await document.fonts.ready; } catch (e) {}
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  const SANS = "Manrope, 'Helvetica Neue', Arial, sans-serif", MONO = "'JetBrains Mono', Menlo, monospace";
  const fit = (s, maxW) => { while (g.measureText(s).width > maxW && s.length > 1) s = s.slice(0, -2) + "…"; return s; };
  const wrap = (t, maxW, maxL) => { const out = []; let cur = ""; for (const w of String(t).split(/\s+/)) { const nx = cur ? cur + " " + w : w; if (g.measureText(nx).width <= maxW || !cur) cur = nx; else { out.push(cur); cur = w; } } if (cur) out.push(cur); if (out.length > maxL) { out.length = maxL; out[maxL - 1] += "…"; } return out.map((s) => fit(s, maxW)); };
  lots.forEach((l, i) => {
    const y0 = i * (H + GAP);
    if (i) { g.fillStyle = "#e6e6e6"; g.fillRect(0, y0 - GAP, W, GAP); }
    g.fillStyle = "#fff"; g.fillRect(0, y0, W, H);
    const q = qrcode(0, "M"); q.addData(l.code || l.id); q.make(); const n = q.getModuleCount(); const qs = H - 5 * PX; const s = Math.floor(qs / n); const qx = 2.5 * PX + Math.floor((qs - s * n) / 2), qy = y0 + Math.floor((H - s * n) / 2);
    g.fillStyle = "#000"; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect(qx + x * s, qy + y * s, s, s);
    const tx = 5 * PX + qs, tw = W - tx - 2.5 * PX; let y = y0 + 3 * PX;
    g.textBaseline = "top"; const nm = (l.name || "").toUpperCase(); let fs = 3, maxL = 2;
    for (const f of [3, 2.6, 2.25, 2]) { fs = f; maxL = f <= 2.25 ? 3 : 2; g.font = `800 ${f * PX}px ${SANS}`; const w = wrap(nm, tw, 9); if (w.length <= maxL && !w.some((t) => t.endsWith("…"))) break; }
    wrap(nm, tw, maxL).forEach((t) => { g.fillText(t, tx, y); y += fs * 1.13 * PX; });
    y = y0 + 12.4 * PX; g.font = `700 ${1.7 * PX}px ${SANS}`; g.fillText(l.status === "opened" ? "DLC OUVERT" : "DLC", tx, y);
    g.font = `800 ${4.4 * PX}px ${MONO}`; g.fillText(fit(lbDate(dlcOf(l)), tw), tx, y + 2.1 * PX);
    g.font = `600 ${1.8 * PX}px ${MONO}`; const meta = l.status === "opened" ? `Ouvert ${shortDate(dayKey(new Date(l.openedAt)))} ${hm(l.openedAt)}` : `Reçu ${l.createdAt ? shortDate(dayKey(new Date(l.createdAt))) : "–"}${l.lot ? ` · L.${l.lot}` : ""}`;
    g.fillText(fit(meta, tw), tx, y0 + 21.2 * PX);
    g.fillRect(tx, y0 + 24.3 * PX, tw, 2);
    g.font = `800 ${2.3 * PX}px ${MONO}`; g.fillText(fit(l.code || "", tw), tx, y0 + 25.5 * PX);
  });
  return new Promise((r) => c.toBlob(r, "image/png"));
}
async function lbSaveBlob(blob, filename) {
  if (S.cap.downloads) { try { await S.cap.downloads.save({ filename, data: blob }); return "ok"; } catch (e) { if (e && e.code === "declined") return "declined"; } }
  try {
    const f = new File([blob], filename, { type: "image/png" });
    if (window.matchMedia("(pointer:coarse)").matches && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: filename }); return "ok"; } catch (e) { if (e && e.name === "AbortError") return "declined"; } }
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = filename; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); return "ok";
  } catch (e) { return "err"; }
}

/* ───────────── QR plein écran (test sans imprimante) ───────────── */
let lbWake = null, lbQrFrom = null;
function lbWakeLock() { try { navigator.wakeLock && navigator.wakeLock.request("screen").then((w) => (lbWake = w)).catch(() => {}); } catch (e) {} }
function lbQrOpen(id, fromSheet) {
  const l = lbLot(id); if (!l) return; lbQrClose(true); lbQrFrom = fromSheet ? id : null;
  const D = lbDays(dlcOf(l)); const o = document.createElement("div"); o.id = "lbQr"; o.className = "lb-qr"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "QR en plein écran");
  o.innerHTML = `<button class="lb-qx" data-act="lbQrClose" aria-label="Fermer">${ico("x")}</button>
    <div class="lb-qbox"><div class="lb-qcode">${qrSvg(l.code || l.id)}</div>
    <div class="lb-qname">${esc(l.name)}</div>
    <div class="lb-qmeta"><span>${l.status === "opened" ? "DLC ouvert" : "DLC"} <b class="mono">${lbDate(dlcOf(l))}</b></span><span class="pill ${D.cls}">${D.txt}</span></div>
    <div class="lb-qid mono">${esc(l.code || "")}</div></div>
    <p class="lb-qhint">Scannez ce QR avec un autre téléphone, comme une vraie étiquette.</p>
    <div class="lb-qact"><button class="btn soft" data-act="lotLabel" data-id="${l.id}">${ico("printer")}Étiquette</button><button class="btn" data-act="lbQrClose">Fermer</button></div>`;
  document.body.appendChild(o); requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add("on"))); SFX.sheet(); buzz(8);
  lbWakeLock();
}
function lbQrClose(silent) {
  const o = $("#lbQr"); if (!o) return; o.id = ""; o.classList.remove("on"); setTimeout(() => o.remove(), 320); if (!silent) SFX.close();
  try { lbWake && lbWake.release(); } catch (e) {} lbWake = null;
  const back = lbQrFrom; lbQrFrom = null; if (!silent && back && lbLot(back)) setTimeout(() => openLot(back), 120);
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#lbQr")) lbQrClose(); });

function minDay(a, b) { if (!b) return a; return a < b ? a : b; }
const LB_REASONS = ["DLC dépassée", "Abîmé, odeur, aspect", "Rupture de froid", "Tombé ou contaminé", "Autre raison"];

Object.assign(ACT, {
  lot: (a, id) => { SFX.tap(); openLot(id); },
  lbQr: (a, id) => { const from = $("#sheet").classList.contains("open"); closeSheet(true); lbQrOpen(id, from); },
  lbQrClose: () => lbQrClose(),
  lotOpen: (a, id) => {
    const l = lbLot(id); if (!l) return;
    lbSheet(`<button class="btn ghost sm lb-back" data-act="lot" data-id="${id}">${ico("back")}<span class="lb-bk">${esc(l.name)}</span></button>
      <div class="h2" style="font-size:21px">Ouvrir ${esc(l.name)}</div><p class="sub" style="margin:0">À consommer dans combien de jours une fois ouvert ?</p>
      <div class="chips" style="flex-wrap:wrap">${[1, 2, 3, 4, 5, 7].map((d) => `<button class="chip ${d === 3 ? "on" : ""}" data-act="openDays" data-v="${d}">${d} jour${d > 1 ? "s" : ""}</button>`).join("")}</div>
      <div class="lb-status s-opened"><span class="lb-si">${ico("clock")}</span><div class="tx"><b>Nouvelle DLC</b><em>Jamais après la DLC d'origine (${shortDate(l.dlc)})</em></div><div class="lb-cd warn"><b class="mono" id="openDlc" style="font-size:24px">${shortDate(minDay(addDays(dayKey(), 3), l.dlc))}</b></div></div>
      <button class="btn soft block" data-act="openPhoto">${ico("camera")}<span id="opPh">Photo de l'étiquette d'origine</span></button>
      <button class="btn acc block lb-big" data-act="openOk" data-id="${id}">${ico("scissors")}Confirmer l'ouverture</button>`);
    S.ui.openDays = 3; S.ui.openPhoto = null;
  },
  openDays: (a, id, v) => { S.ui.openDays = +v; $$("[data-act=openDays]").forEach((b) => b.classList.toggle("on", b === a)); const l = lbLot($("[data-act=openOk]").dataset.id); const el = $("#openDlc"); el.textContent = shortDate(minDay(addDays(dayKey(), +v), l.dlc)); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); SFX.tick(); },
  openPhoto: async () => { const [f] = await pickImage(); if (!f) return; $("#opPh").textContent = "Envoi…"; const { blob } = await shrink(f); S.ui.openPhoto = await upload(blob); $("#opPh").textContent = "Photo ajoutée ✓"; SFX.ok(); },
  openOk: lbOnce(async (a, id) => {
    const l = lbLot(id); if (!l || l.status !== "in") return openLot(id); const dlcOpen = minDay(addDays(dayKey(), S.ui.openDays || 3), l.dlc);
    await lbDo(id, { status: "opened", openedAt: Date.now(), openedBy: S.me.id, dlcOpen, openPhotoId: S.ui.openPhoto?.id || "", openPhotoUrl: S.ui.openPhoto?.url || "" }, "open", `a ouvert ${l.name} · à consommer avant le ${shortDate(dlcOpen)}`, "ouvert", `a annulé l'ouverture de ${l.name}`);
    SFX.ok(); buzz(12); openLot(id); lbToastUndo(`Ouvert · DLC ${shortDate(dlcOpen)}`);
  }),
  lotOut: lbOnce(async (a, id) => {
    const l = lbLot(id); if (!l || !["in", "opened"].includes(l.status)) return;
    await lbDo(id, { status: "out", outAt: Date.now(), outBy: S.me.id }, "out", `a utilisé ${l.name} (sorti de ${fridgeName(l.fridgeId)})`, "utilisé", `a annulé la sortie de ${l.name}`);
    SFX.ok(); buzz(12); openLot(id); lbToastUndo("Utilisé, sorti du stock");
  }),
  lotLost: (a, id) => {
    const l = lbLot(id); if (!l) return; const pre = (daysUntil(dlcOf(l)) ?? 9) < 0 ? LB_REASONS[0] : "";
    S.ui.lbReason = pre;
    lbSheet(`<button class="btn ghost sm lb-back" data-act="lot" data-id="${id}">${ico("back")}<span class="lb-bk">${esc(l.name)}</span></button>
      <div class="h2" style="font-size:21px">Jeter ${esc(l.name)} ?</div><p class="sub" style="margin:0">Pourquoi ? C'est noté dans le registre des pertes.</p>
      <div class="lb-reasons">${LB_REASONS.map((r) => `<button class="lb-reason ${r === pre ? "on" : ""}" data-act="lbReason" data-v="${esc(r)}"><span class="rd"></span>${r}</button>`).join("")}</div>
      <button class="btn block lb-big lb-trash" data-act="lostOk" data-id="${id}" ${pre ? "" : "disabled"}>${ico("trash")}Jeter le produit</button>`);
  },
  lbReason: (a, id, v) => { S.ui.lbReason = v; $$(".lb-reason").forEach((b) => b.classList.toggle("on", b === a)); $("[data-act=lostOk]").disabled = false; SFX.tick(); },
  lostOk: lbOnce(async (a, id) => {
    const l = lbLot(id); if (!l || !S.ui.lbReason || !["in", "opened"].includes(l.status)) return; const r = S.ui.lbReason;
    await lbDo(id, { status: "lost", outAt: Date.now(), outBy: S.me.id, lostReason: r }, "lost", `a jeté ${l.name}${lbQty(l) ? ` (${lbQty(l)})` : ""} · ${r}`, "jeté", `a annulé la mise en perte de ${l.name}`);
    SFX.close(); buzz([10, 30, 10]); openLot(id); lbToastUndo("Jeté, noté en perte");
  }),
  lotMoveAsk: (a, id) => {
    const l = lbLot(id); if (!l) return;
    lbSheet(`<button class="btn ghost sm lb-back" data-act="lot" data-id="${id}">${ico("back")}<span class="lb-bk">${esc(l.name)}</span></button>
      <div class="h2" style="font-size:21px">Ranger dans…</div>
      <div>${S.fridges.map((f) => { const n = activeLots().filter((x) => x.fridgeId === f.id).length; const on = l.fridgeId === f.id; return `<div class="li tap lb-fr ${on ? "on" : ""}" data-act="lotMove" data-id="${id}" data-v="${f.id}"><span class="ic">${ico("snow")}</span><div class="tx"><b>${esc(f.name)}</b><em>${on ? "Il est ici" : `${n} produit${n > 1 ? "s" : ""}`}</em></div>${on ? `<span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : ico("chev")}</div>`; }).join("") || `<div class="empty">Aucun frigo. Ajoutez-en depuis l'onglet Frigos.</div>`}</div>`);
  },
  lotMove: lbOnce(async (a, id, v) => {
    const l = lbLot(id); if (!l) return; if (l.fridgeId === v) { openLot(id); return; }
    await lbDo(id, { fridgeId: v }, "lot", `a rangé ${l.name} dans ${fridgeName(v)}`, "déplacé", `a annulé le déplacement de ${l.name} vers ${fridgeName(v)}`); SFX.ok(); buzz(10); openLot(id); lbToastUndo("Déplacé");
  }),
  /* HACCP: an undo never erases the trace. The original entry stays, marked cancelled, and the undo itself is logged. */
  lbUndo: lbOnce(async () => {
    const u = S.ui.lbUndo; if (!u) return; S.ui.lbUndo = null;
    try {
      await DB.set("lots", u.id, u.prev);
      const now = Date.now();
      if (u.evId) await DB.update("events", u.evId, { cancelled: true, cancelledAt: now, cancelledBy: S.me.id }).catch(() => {});
      await DB.add("events", { type: "lot", text: u.undoTxt, at: now, uid: S.me.id, ref: u.id, undoOf: u.evId || "" }).catch(() => {});
    } catch (e) { S.ui.lbUndo = u; SFX.err(); toast("Impossible d'annuler.", "err"); return; }
    const t = $("#toast"); t.classList.remove("on"); t.style.pointerEvents = ""; SFX.close(); buzz(8);
    const b = LB.batch.find((x) => x.id === u.id && !x.undone); if (b) { b.undone = true; lbRenderBatch(); }
    if ($("#sheet").classList.contains("open") && $("#sheetBody .lb-lot")) openLot(u.id);
    setTimeout(() => toast("Annulé, c'est noté dans l'historique"), 60);
  }),
  lotLabel: (a, id) => { lbQrClose(true); SFX.tap(); openLabel([id]); },
  labelsAll: () => openLabel(S.rec.done),
  labelSave: async (a) => {
    const lots = a.dataset.ids.split(",").map((i) => lbLot(i)).filter(Boolean); if (!lots.length) return;
    const p = $("#prAnim"); if (p) { p.classList.remove("go"); void p.offsetWidth; p.classList.add("go"); } SFX.print();
    const blob = await labelPng(lots);
    const r = await lbSaveBlob(blob, lots.length > 1 ? `etiquettes-${dayKey()}.png` : `etiquette-${(lots[0].code || "produit").toLowerCase()}.png`);
    if (r === "ok") toast(lots.length > 1 ? "Étiquettes enregistrées" : "Étiquette enregistrée"); else if (r === "err") toast("Enregistrement impossible sur cet appareil.", "err");
  },
  scanPhoto: async () => {
    const [f] = await pickImage(); if (!f) return; const st = lbStageEl(); st && st.classList.add("busy");
    try {
      const { canvas } = await shrink(f, 1400, 0.9); const g = canvas.getContext("2d"); const d = g.getImageData(0, 0, canvas.width, canvas.height);
      const r = window.jsQR ? jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" }) : null;
      if (r && r.data) lookupCode(r.data); else { SFX.err(); toast("QR illisible : rapprochez-vous et évitez les reflets.", "err"); }
    } catch (e) { SFX.err(); toast("Photo illisible.", "err"); }
    st && st.classList.remove("busy");
  },
  lbRetry: () => { SFX.tap(); LB.state = "off"; lbStart(); },
  lbTorch: async (a) => {
    if (!LB.track) return; const on = !LB.torch;
    try { await LB.track.applyConstraints({ advanced: [{ torch: on }] }); LB.torch = on; a.classList.toggle("on", on); SFX.tick(); buzz(6); } catch (e) { toast("Lampe indisponible sur cet appareil.", "err"); }
  },
  lbMode: (a, id, v) => {
    if (LB.mode === v) return; LB.mode = v; LB.seen = {}; SFX.tick(); buzz(5);
    const seg = a.closest(".seg"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${v === "multi" ? "100%" : "0"})`; }
    setTimeout(() => { const p = $("#lbPanel"); if (p) { p.innerHTML = lbPanelHtml(); p.classList.add("nost"); lbRenderBatch(); } }, 180);
    const st = lbStageEl(); if (st) { st.classList.toggle("multi", v === "multi"); $(".lb-hint", st).textContent = v === "multi" ? "Passez les étiquettes une par une" : "Visez le QR de l'étiquette"; }
  },
  lbTarget: (a, id, v) => { S.ui.lbTarget = v; $$("[data-act=lbTarget]").forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); lbRenderBatch(); },
  lbBatchEnd: () => {
    const n = LB.batch.filter((b) => b.cls === "ok" && !b.undone).length; LB.batch = []; LB.seen = {};
    if (n) { SFX.done(); burst(); toast(`${n} produit${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""}`); }
    lbRenderBatch();
  },

  printerSet: async (a, id, v) => { await safe(DB.update("restos", S.rid, { printer: v })); SFX.ok(); buzz(8); toast(`${v} choisie`); },
  lbTestMode: async () => { const on = !lbTestMode(); await safe(DB.update("restos", S.rid, { printTest: on })); SFX.tick(); buzz(6); },
  lbTestLabel: async () => {
    const demos = [["Crème fraîche 35 %", "1", "L", 6], ["Saumon fumé", "0,8", "kg", 4], ["Fond de veau maison", "2", "L", 3], ["Beurre doux AOP", "1", "kg", 12]];
    const [name, qty, unit, d] = demos[S.lots.filter((l) => l.test).length % demos.length];
    const id = await safe(DB.add("lots", { name: `${name} (test)`, productId: "", qty, unit, lot: "TEST", dlc: addDays(dayKey(), d), supplier: "Étiquette test", receptionId: "", fridgeId: S.fridges[0]?.id || "", status: "in", receivedTemp: null, code: "GG-" + rid6(), createdAt: Date.now(), uid: S.me.id, test: true }));
    await logEvent("lot", `a créé une étiquette test (${name})`, { ref: id });
    SFX.ok(); buzz([10, 30, 10]); setTimeout(() => lbQrOpen(id), 120);
  },
});

/* ───────────── imprimante ───────────── */
VIEWS.imprimante = {
  render() {
    const pr = S.resto?.printer; const test = lbTestMode();
    const P = [["Zebra ZD421d", "Recommandée", "La référence des cuisines pro. Solide, rapide, sans encre : elle imprime sur papier thermique.", "≈ 400 à 550 € HT"], ["Brother QL-820NWB", "Petit budget", "Compacte et simple, parfaite pour démarrer. Sans encre elle aussi.", "≈ 200 à 280 € HT"]];
    const steps = [["Branchez et chargez", "Allumez l'imprimante et mettez le rouleau d'étiquettes."], ["Connectez-la", "Avec l'appli gratuite du fabricant (Zebra Printer Setup ou Brother iPrint&Label), reliez-la au Wi-Fi du restaurant, ou au téléphone en Bluetooth."], ["Choisissez-la ici", "Touchez son nom plus haut. Ensuite, enregistrez l'image de l'étiquette et imprimez-la depuis le téléphone ou l'ordinateur."]];
    return `<div class="inner narrow lb-print">${topBar("Imprimante")}<div class="lb-pgrid"><div class="lb-pcol">
      <div class="glass pad st lb-testcard ${test ? "on" : ""}" style="--i:1">
        <div class="li tap" data-act="lbTestMode" style="padding:0" role="switch" aria-checked="${test}" tabindex="0"><span class="ic">${ico("sparkle")}</span><div class="tx"><b>Mode test sans imprimante</b><em>${test ? "Activé" : "Désactivé"}</em></div><span class="lb-sw ${test ? "on" : ""}"><i></i></span></div>
        <p class="note" style="margin:12px 0 0">Pas encore d'imprimante ? Aucun souci. Les étiquettes s'affichent <b>à l'écran</b> : un autre téléphone peut scanner le QR directement. Vous pouvez aussi <b>les enregistrer en image</b> et les imprimer plus tard, sur n'importe quelle imprimante.</p>
        <button class="btn acc block" style="margin-top:14px" data-act="lbTestLabel">${ico("qr")}Créer une étiquette test</button></div>
      <div class="lbl st" style="--i:2;margin:8px 4px -4px">Quelle imprimante choisir ?</div>
      ${P.map(([n, tag, d, p], i) => `<div class="glass pad st lb-pr ${pr === n ? "on" : ""}" style="--i:${3 + i}" data-act="printerSet" data-v="${n}" role="button" tabindex="0"><div class="row"><div class="hstack"><span class="ic">${ico("printer")}</span><div><b class="h3">${n}</b><div><span class="pill ${i ? "neu" : "acc"}" style="margin-top:3px">${tag}</span></div></div></div>${pr === n ? `<span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : `<span class="lb-radio"></span>`}</div><p class="note" style="margin:10px 0 8px">${d}</p><div class="hstack" style="gap:6px;flex-wrap:wrap"><span class="pill neu">${ico("wifi")}Wi-Fi</span><span class="pill neu">${ico("bt")}Bluetooth</span><span class="pill neu mono">${p}</span></div></div>`).join("")}
      </div><div class="lb-pcol">
      <div class="glass pad st" style="--i:5"><span class="lbl">Brancher l'imprimante en 3 étapes</span><div class="lb-steps">${steps.map(([t, d], i) => `<div class="lb-step"><span class="mono">${i + 1}</span><div><b>${t}</b><p class="note" style="margin:2px 0 0">${d}</p></div></div>`).join("")}</div>
        <div class="lb-soon">${ico("clock")}<span><b>Envoi direct depuis Growth Gusto : bientôt.</b> Pour l'instant, l'application n'envoie pas encore l'étiquette toute seule à l'imprimante. Enregistrez l'image, puis imprimez-la.</span></div></div>
      <div class="glass pad st" style="--i:6"><span class="lbl">Aperçu de l'étiquette 57 × 32 mm</span><div class="lb-roll" style="margin-top:12px">${lbTagHtml({ name: "Crème fraîche 35 %", status: "in", dlc: addDays(dayKey(), 6), createdAt: Date.now(), lot: "A1234", code: "GG-DEMO1" })}</div></div></div></div></div>`;
  },
};
