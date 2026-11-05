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
/* a split lot shares its code with its parts: prefer an active one, the original first, then the biggest */
function lbFind(raw) {
  const code = lbParseCode(raw); const t = String(raw || "").trim();
  const all = S.lots.filter((x) => (x.code || "").toUpperCase() === code || x.id === t); if (all.length < 2) return all[0] || null;
  const act = all.filter((x) => x.status === "in" || x.status === "opened");
  const pool = act.length ? act : all.filter((x) => x.status !== "merged").concat(all.filter((x) => x.status === "merged"));
  return pool.slice().sort((a, b) => (a.parentLotId ? 1 : 0) - (b.parentLotId ? 1 : 0) || (num(b.qty) || 0) - (num(a.qty) || 0))[0];
}
/* "2.5" or "2,5" -> "2,5 kg"; empty when no quantity */
function lbQty(l) { if (l.qty == null || l.qty === "") return ""; const n = num(l.qty); const q = n == null ? String(l.qty) : fmt(n, n % 1 ? (Math.round(n * 10) === n * 10 ? 1 : 2) : 0); return `${q}${l.unit ? ` ${n != null && typeof relUnit === "function" ? relUnit(n, l.unit) : l.unit}` : ""}`; }
function lbDays(k) {
  const d = daysUntil(k);
  if (d == null) return { d: null, txt: "Sans DLC", cls: "neu" };
  if (d < 0) return { d, txt: `Dépassée depuis ${-d} jour${d < -1 ? "s" : ""}`, cls: "bad" };
  if (d === 0) return { d, txt: "À consommer aujourd'hui", cls: "bad" };
  if (d === 1) return { d, txt: "À consommer demain", cls: "bad" };
  return { d, txt: `Encore ${d} jours`, cls: d <= 3 ? "warn" : "ok" };
}
function qrSvg(text) {
  try { const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(); let r = ""; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) r += `M${x} ${y}h1v1h-1z`; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;background:#fff"><path d="${r}" fill="#000"/></svg>`; } catch (e) { return ""; }
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
  if (LB.stream && LB.parked && LB.track && LB.track.readyState === "live") { // reuse the parked stream: no new permission prompt
    clearTimeout(LB.parkT); LB.parked = false; LB.track.enabled = true;
    const st = lbStageEl(); const v = st && $("video", st); if (v) { v.srcObject = LB.stream; v.play().catch(() => {}); }
    lbSetState("live"); return;
  }
  if (LB.stream && LB.parked) lbStop(true);
  if (LB.stream || LB.starting) { if (LB.stream) lbSetState("live"); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { lbSetState("nocam"); return; }
  LB.starting = true; lbSetState("starting");
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (document.hidden) { s.getTracks().forEach((t) => t.stop()); LB.state = "off"; return; }
    LB.stream = s; LB.parked = false; try { localStorage.setItem("gg-cam-ok", "1"); } catch (e) {}
    LB.track = s.getVideoTracks()[0]; LB.torch = false; if (S.route !== "scan") { lbStop(); return; }
    let caps = {}; try { caps = (LB.track.getCapabilities && LB.track.getCapabilities()) || {}; } catch (e) {}
    LB.torchOk = !!caps.torch;
    const st = lbStageEl(); const v = st && $("video", st); if (v) { v.srcObject = s; v.play().catch(() => {}); }
    lbSetState("live");
  } catch (e) {
    const n = e && e.name;
    lbSetState(n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError" ? "denied" : n === "NotReadableError" || n === "TrackStartError" ? "busy" : "nocam");
  } finally { LB.starting = false; }
}
/* Leaving the scanner only « parks » the camera (track disabled, stream kept for 10 min): coming back reuses it, so iPhone
   home-screen apps don't ask for the camera permission again. A real stop happens when the app goes to the background. */
function lbStop(hard) {
  cancelAnimationFrame(LB.raf); LB.raf = 0;
  if (LB.stream && !hard && LB.track && LB.track.readyState === "live") {
    if (!LB.parked) { LB.parked = true; LB.track.enabled = false; if (LB.torch) { try { LB.track.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {} LB.torch = false; } clearTimeout(LB.parkT); LB.parkT = setTimeout(() => lbStop(true), 10 * 60 * 1000); }
    if (["live", "starting"].includes(LB.state)) LB.state = "off";
    return;
  }
  clearTimeout(LB.parkT); LB.parked = false;
  if (LB.stream) LB.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
  LB.stream = null; LB.track = null; LB.torch = false; if (["live", "starting"].includes(LB.state)) LB.state = "off";
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
  if (LB.mode === "multi" || LB.mode === "svc") {
    if (LB.seen[code] && now - LB.seen[code] < 3500) { LB.seen[code] = now; return; }
    LB.seen[code] = now; lbFlash(stage, lbFind(raw) ? "hit" : "miss"); if (LB.mode === "svc") svcScan(raw); else lbBatchAdd(raw); return;
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
    SFX.scan(); buzz(15);
    const U = svcNewUndo(`rangement de ${l.name} dans ${fridgeName(tgt)}`); await svcMove(l, tgt, null, U);
    S.ui.lbUndo = { svc: U, id: l.id, label: "rangé", undoTxt: U.label, at: Date.now() };
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
  const n = LB.batch.filter((b) => b.cls === "ok" && !b.undone).length; const svc = LB.mode === "svc";
  const cnt = $("#lbCount"); if (cnt) { cnt.textContent = n; cnt.parentElement.hidden = !LB.batch.length || LB.mode === "one"; if (fresh) { cnt.parentElement.classList.remove("bump"); void cnt.offsetWidth; cnt.parentElement.classList.add("bump"); } }
  const box = $("#lbBatch"); if (!box) return;
  const u = S.ui.lbUndo; const canUndo = !!(u && LB.batch.find((b) => b.undo && !b.undone && b.id === u.id));
  box.innerHTML = LB.batch.length ? `<div class="row" style="margin-bottom:2px;min-height:40px"><span class="lbl">${n} produit${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""}</span>${canUndo ? `<button class="btn ghost sm" data-act="lbUndo" style="white-space:nowrap">${ico("lbUndo")}Annuler</button>` : ""}</div>
    ${LB.batch.slice(0, 40).map((b, i) => `<div class="li lb-brow ${i === 0 && fresh ? "lb-new" : ""} ${b.undone ? "undone" : ""}" ${b.id ? `data-id="${b.id}"` : ""}><span class="ic ${b.cls}">${ico(b.cls === "ok" ? "check" : b.cls === "warn" ? "clock" : "alert")}</span><div class="tx"><b>${esc(b.name)}</b><em>${b.undone ? "Annulé" : esc(b.txt)}</em></div>${b.dlc && !b.undone ? dlcPill(b.dlc) : ""}</div>`).join("")}
    ${svc ? "" : `<button class="btn soft block" data-act="lbBatchEnd" style="margin-top:10px">${ico("check")}Terminer</button>`}`
    : svc ? `<div class="lb-bempty svc"><span class="ic">${ico(svcPref().dir === "mep" ? "svcGo" : "svcBack")}</span><div><b>${svcPref().dir === "mep" ? "Scannez ce que vous sortez" : "Scannez ce que vous remettez"}</b><span>${svcPref().dir === "mep" ? `Chaque produit part en ${esc(fridgeName(svcTo()))} dès le bip.` : "Chaque produit retourne en chambre froide dès le bip."}</span></div></div>`
    : `<div class="lb-bempty"><span class="ic">${ico("lbLayers")}</span><div><b>Scannez les produits à la suite</b><span>${lbTarget() ? `Chaque produit est rangé dans ${esc(fridgeName(lbTarget()))}` : "Chaque produit est contrôlé"} dès le bip. Rien à valider.</span></div></div>`;
}
function lbPatchLists() { const r = $("#viewport .view:not(.leave) #lbRecent"); if (r) r.innerHTML = lotList(activeLots().slice(0, 6), true); }
function lbPanelHtml() {
  const multi = LB.mode === "multi", svc = LB.mode === "svc"; const tgt = lbTarget(); const mi = ["one", "svc", "multi"].indexOf(LB.mode);
  return `<div class="seg lb-seg lb-seg3 st" style="--i:2"><span class="knob" style="width:calc(33.333% - 2.67px);transform:translateX(${mi * 100}%)"></span><button class="${mi === 0 ? "on" : ""}" data-act="lbMode" data-v="one">${ico("qr")}<span>Un produit</span></button><button class="${svc ? "on" : ""}" data-act="lbMode" data-v="svc">${ico("svcCounter")}<span>Service</span></button><button class="${multi ? "on" : ""}" data-act="lbMode" data-v="multi">${ico("lbLayers")}<span>Plusieurs</span></button></div>
    ${svc ? svcPanelHtml() : ""}
    ${multi ? `<div class="glass pad st" style="--i:3"><span class="lbl">Ranger dans</span><div class="chips" style="margin-top:8px;flex-wrap:wrap">${S.fridges.map((f) => `<button class="chip ${tgt === f.id ? "on" : ""}" data-act="lbTarget" data-v="${f.id}">${esc(f.name)}</button>`).join("")}<button class="chip ${tgt === "" ? "on" : ""}" data-act="lbTarget" data-v="">Juste vérifier</button></div>
      <div id="lbBatch" style="margin-top:12px"></div></div>` : ""}
    <div class="glass pad st" style="--i:4;display:flex;flex-direction:column;gap:10px"><div class="hstack"><span class="ic">${ico("keyboard")}</span><div><b class="h3">Douchette ou code</b><div class="sub">Une douchette Bluetooth tape le code ici toute seule</div></div></div>
      <form class="hstack" data-form="code"><input class="input mono" id="codeIn" placeholder="GG-7K3F2" autocomplete="off" autocapitalize="characters" enterkeyhint="go" style="flex:1"><button class="btn acc sm" style="height:50px">OK</button></form></div>
    ${multi || svc ? "" : `<div class="glass pad st" style="--i:5"><div class="row"><span class="lbl">Récents</span><button class="btn ghost sm" data-act="scanPhoto">${ico("image")}Depuis une photo</button></div><div id="lbRecent">${lotList(activeLots().slice(0, 6), true)}</div></div>`}`;
}
VIEWS.scan = {
  live: false,
  render(params = {}) {
    /* go("scan", { mode: "mep" | "retour" }) opens straight in service mode, once per navigation */
    if (params && params.mode && LB.paramsSeen !== params) { LB.paramsSeen = params; lbServiceMode(params.mode, true); }
    return `<div class="inner narrow lb-scan">
      <div class="lb-stage st ${LB.mode === "multi" ? "multi" : ""} ${LB.mode === "svc" ? "svc" + (svcPref().dir === "ret" ? " ret" : "") : ""}" style="--i:0" id="lbStage" data-state="${LB.state === "live" && !LB.stream ? "off" : LB.state}">
        <video playsinline muted autoplay></video>
        <div class="lb-vf"><i></i><i></i><i></i><i></i><b class="lb-las"></b></div>
        <div class="lb-msgw">${lbStageMsg()}</div>
        <div class="lb-top"><span class="lb-title">Scanner</span><span class="lb-cnt" hidden>${ico("check")}<b id="lbCount">0</b></span><button class="lb-rb" data-act="lbTorch" aria-label="Lampe" hidden>${ico("lbFlash")}</button></div>
        <div class="lb-hint">${esc(lbHintTx())}</div>
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
document.addEventListener("visibilitychange", () => { if (document.hidden) lbStop(true); else if (S.route === "scan" && lbStageEl()) { if (!LB.raf) LB.raf = requestAnimationFrame(lbLoop); if (LB.state !== "denied") lbStart(); } else if (lbWake && $("#lbQr")) lbWakeLock(); });

function lookupCode(raw) {
  const code = lbParseCode(raw); if (!code) return;
  if (S.route === "scan" && LB.mode !== "one") { LB.seen[code] = performance.now(); if (LB.mode === "svc") svcScan(raw); else lbBatchAdd(raw); return; }
  const l = lbFind(raw);
  if (l) { SFX.scan(); buzz(15); openLot(l.id); const i = $("#codeIn"); if (i) { i.value = ""; i.blur(); } } else { SFX.err(); toast(`Aucun produit avec le code ${code}`, "err"); }
}

/* ───────────── fiche produit (après scan) ───────────── */
const LB_ST = { in: ["En frigo", "snow"], opened: ["Ouvert", "scissors"], out: ["Utilisé", "lbDone"], lost: ["Jeté", "trash"], merged: ["Regroupé", "lbLayers"] };
function lbTimeline(l) {
  const evs = S.events.filter((e) => e.ref === l.id || e.ref2 === l.id).map((e) => ({ at: e.at, uid: e.uid, type: e.undoOf != null ? "undo" : e.type, text: e.text, cancelled: !!e.cancelled }));
  const has = (t) => evs.some((e) => e.type === t && !e.cancelled);
  const rows = [...evs];
  if (l.createdAt && !l.parentLotId) rows.push({ at: l.createdAt, uid: l.uid, type: "in", text: `a rentré ${l.name} dans ${fridgeName(l.receivedFridgeId || l.svcFrom || l.fridgeId)}${l.receivedTemp != null && l.receivedTemp !== "" ? ` · ${fmt(num(l.receivedTemp))}°C à réception` : ""}` });
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
  const inSvc = active && svcIn(l) && l.svcAt;
  const sub = l.status === "merged" ? (l.cancelled ? "Mise en place annulée" : `Remis avec le lot d'origine en ${esc(fridgeName(l.fridgeId))}`)
    : inSvc ? `${esc(fridgeName(l.fridgeId))} · sorti à ${hm(l.svcAt)} de ${esc(fridgeName(l.svcFrom))}`
    : l.status === "in" ? `${esc(fridgeName(l.fridgeId))} · depuis le ${l.createdAt ? shortDate(dayKey(new Date(l.createdAt))) : "–"}`
    : l.status === "opened" ? `Le ${at(l.openedAt)} par ${esc(firstName(nameOf(l.openedBy)))} · ${esc(fridgeName(l.fridgeId))}`
    : `Le ${at(l.outAt)} par ${esc(firstName(nameOf(l.outBy)))}${l.status === "lost" && l.lostReason ? ` · ${esc(l.lostReason)}` : ""}`;
  const big = active && D.d != null ? `<div class="lb-cd ${D.cls}"><b class="mono">${D.d < 0 ? "!" : D.d}</b><small>${D.d < 0 ? "dépassée" : D.d === 0 ? "auj." : D.d === 1 ? "jour" : "jours"}</small></div>` : "";
  const u = S.ui.lbUndo; const undo = u && u.id === id && Date.now() - u.at < 15 * 60e3;
  const tile = (act, icon, label, cls = "") => `<button class="lb-tile ${cls}" data-act="${act}" data-id="${id}">${ico(icon)}<span>${label}</span></button>`;
  lbSheet(`<div class="lb-lot">
    <div class="hstack" style="gap:14px;align-items:flex-start"><button class="lb-qthumb" data-act="lbQr" data-id="${id}" aria-label="Afficher le QR en grand">${qrSvg(l.code || l.id)}<span>${ico("lbFull")}</span></button><div style="flex:1;min-width:0"><div class="h2" style="font-size:21px">${esc(l.name)}</div>${(() => { const m = [lbQty(l), l.supplier, l.lot ? `lot ${l.lot}` : ""].filter((x) => x && String(x).trim()); return m.length ? `<div class="sub lb-meta" style="margin-top:3px">${m.map(esc).join(" · ")}</div>` : ""; })()}<div class="mono lb-code">${esc(l.code || "")}</div></div></div>
    <div class="lb-status s-${l.status || "in"} ${inSvc ? "s-svc" : ""}"><span class="lb-si">${ico(inSvc ? "svcCounter" : stI)}</span><div class="tx"><b>${inSvc ? "En service" : stT}</b><em>${sub}</em>${inSvc ? `<span class="svc-dwl">${svcDwellPill(l)}<small>${svcMin(l) >= 240 ? "À remettre au froid" : svcMin(l) >= 120 ? "Pensez au retour" : "en frigo de service"}</small></span>` : ""}${active ? `<span class="pill ${D.cls}">${l.status === "opened" ? `Nouvelle DLC ${shortDate(k)} · ` : `DLC ${shortDate(k)} · `}${D.txt}</span>` : ""}</div>${big}</div>
    ${undo ? `<div class="lb-undo"><span>Vous avez ${esc(u.label)} ce produit.</span><button class="btn soft sm" data-act="lbUndo">${ico("lbUndo")}Annuler</button></div>` : ""}
    ${active ? `<div class="grid2">${l.status === "in" ? `<button class="btn soft lb-big" data-act="lotOpen" data-id="${id}">${ico("scissors")}Ouvrir</button>` : `<button class="btn soft lb-big" data-act="lotPrint" data-id="${id}">${ico("printer")}Imprimer</button>`}<button class="btn acc lb-big" data-act="lotOut" data-id="${id}">${ico("lbDone")}Utilisé</button></div>
      ${svcLotCta(l)}
      <div class="lb-tiles">${tile("lotMoveAsk", "move", "Déplacer")}${l.status === "in" ? tile("lotPrint", "printer", "Imprimer") + tile("lotLabel", "qr", "Étiquette") : tile("lotLabel", "qr", "Étiquette") + tile("lbQr", "lbFull", "Voir le QR")}${tile("lotLost", "trash", "Jeter", "bad")}</div>`
      : `<div class="lb-tiles">${tile("lotLabel", "qr", "Étiquette")}${tile("lotPrint", "printer", "Imprimer")}${tile("lbQr", "lbFull", "Voir le QR")}</div>`}
    ${svcSibHtml(l)}
    <div class="lb-tl"><span class="lbl">Historique</span><div style="margin-top:8px">${lbTimeline(l)}</div></div></div>`);
}

/* service shortcut on the product sheet: out to the service fridge, or back to the cold room */
function svcLotCta(l) {
  if (svcIn(l)) { const to = svcBackFor(l); return to ? `<button class="btn soft block svc-cta ret" data-act="svcBackOne" data-id="${l.id}">${ico("svcBack")}Remettre en ${esc(relShort(fridgeName(to), 22))}</button>` : ""; }
  const to = svcTo(); return to ? `<button class="btn soft block svc-cta" data-act="svcMep" data-id="${l.id}" data-v="${to}">${ico("svcGo")}Mise en place → ${esc(relShort(fridgeName(to), 22))}</button>` : "";
}
function svcSibHtml(l) {
  const sib = svcSiblings(l); if (!sib.length) return "";
  return `<div class="svc-sib"><span class="lbl">Même étiquette</span>${sib.map((x) => `<div class="li tap" data-act="lot" data-id="${x.id}" role="button" tabindex="0"><span class="ic">${relIco(relFr(x.fridgeId))}</span><div class="tx"><b>${esc(lbQty(x) || x.name)}</b><em>${esc(fridgeName(x.fridgeId))}${x.parentLotId ? "" : " · lot d'origine"}</em></div>${svcIn(x) ? svcDwellPill(x) : ""}${ico("chev")}</div>`).join("")}</div>`;
}

/* ───────────── imprimante : modèles, rouleaux DK, réglages ─────────────
   Settings live on the resto doc: printer: { model, roll, mode }. The old shape (printer: "Zebra ZD421d", printTest: bool) still reads. */
const LB_MODELS = [
  { id: "ql810wc", name: "Brother QL-810Wc", short: "QL-810W", tag: "Votre imprimante", d: "Wi-Fi et USB, compatible AirPrint : le téléphone imprime directement, sans application.", link: ["Wi-Fi", "USB", "AirPrint"] },
  { id: "ql820nwb", name: "Brother QL-820NWB", short: "QL-820NWB", tag: "Même famille", d: "Wi-Fi, Bluetooth et USB, compatible AirPrint. Mêmes rouleaux DK.", link: ["Wi-Fi", "Bluetooth", "AirPrint"] },
  { id: "zd421", name: "Zebra ZD421d", short: "ZD421", tag: "Cuisine pro", d: "Robuste et rapide. Elle imprime en AirPrint une fois sur le Wi-Fi.", link: ["Wi-Fi", "Bluetooth"] },
  { id: "other", name: "Autre imprimante", short: "imprimante", tag: "", d: "Toute imprimante AirPrint, ou reliée à l'ordinateur : choisissez-la dans la fenêtre d'impression.", link: ["AirPrint"] },
];
const LB_ROLLS = [
  { id: "dk11209", name: "DK-11209", w: 62, h: 29, t: "62 × 29 mm", d: "Prédécoupées, 800 par rouleau. La plus pratique.", rec: true },
  { id: "dk22205", name: "DK-22205", w: 62, h: 0, t: "62 mm en continu", d: "L'imprimante coupe à la longueur voulue." },
  { id: "dk11201", name: "DK-11201", w: 90, h: 29, t: "29 × 90 mm", d: "Prédécoupées, allongées : imprimées en travers." },
];
function lbPrinterCfg() {
  const p = S.resto?.printer; let model = null, roll = "dk11209", mode = "airprint";
  if (p && typeof p === "object") { model = p.model || null; roll = p.roll || roll; mode = p.mode || mode; }
  else if (typeof p === "string" && p) model = /zebra|zd/i.test(p) ? "zd421" : /820/.test(p) ? "ql820nwb" : /810/.test(p) ? "ql810wc" : "other";
  if (!LB_MODELS.some((m) => m.id === model)) model = null;
  if (!LB_ROLLS.some((r) => r.id === roll)) roll = "dk11209";
  const M = LB_MODELS.find((m) => m.id === model);
  const ok = p && typeof p === "object" ? p.ok || null : null, scanOk = p && typeof p === "object" ? p.scanOk || null : null;
  return { model, roll, ok, scanOk, mode: mode === "image" ? "image" : "airprint", name: M ? M.name : typeof p === "string" ? p : "", short: M ? M.short : "imprimante" };
}
const lbRoll = () => LB_ROLLS.find((r) => r.id === lbPrinterCfg().roll) || LB_ROLLS[0];
async function lbPrinterSave(patch) { const c = lbPrinterCfg(); await safe(DB.update("restos", S.rid, { printer: { model: c.model, roll: c.roll, mode: c.mode, ok: c.ok, scanOk: c.scanOk, ...patch } })); }
/* last print, remembered on this device */
function lbLastPrint() { try { return JSON.parse(localStorage.getItem("gg-lastprint-" + S.rid) || "null"); } catch (e) { return null; } }
function lbLastPrintTx() { const p = lbLastPrint(); if (!p) return "Aucune impression pour l'instant."; return `Dernière impression : ${when(p.at)} · ${p.n > 1 ? `${p.n} étiquettes` : "1 étiquette"}${p.name ? ` (${p.name})` : ""}`; }
function lbPrintRemember(lots) { try { localStorage.setItem("gg-lastprint-" + S.rid, JSON.stringify({ at: Date.now(), n: lots.length, name: relShortSafe(lots[0].name, 24) })); } catch (e) {} $$("[data-lb=last]").forEach((e) => (e.textContent = lbLastPrintTx())); }
const relShortSafe = (s, n) => (typeof relShort === "function" ? relShort(s || "", n) : String(s || "").slice(0, n));

/* ───────────── étiquette (62 × 29 mm par défaut) ─────────────
   One markup for the screen preview and the printed label: sizes are in --mm (5.3px on screen, 1mm in the print document). */
function lbAllergens(l) {
  const p = l.productId && (S.products || []).find((x) => x.id === l.productId);
  const ids = l.allergens && l.allergens.length ? l.allergens : (p && p.allergens) || [];
  return ids.map((id) => ((typeof allergenOf === "function" && allergenOf(id)) || {}).t || id).filter(Boolean);
}
/* ───────────── design de l'étiquette ─────────────
   resto.labelStyle: absent (= Classique) / "big" (old string form) / { preset, dlc, qr, txt, alg, lot, dates, qty, brand, code }.
   Thermal printing is black only: the designs differ by layout and type size. Read with lbStyle(), everywhere lbTagHtml runs. */
const LB_STYLES = [
  { id: "classic", name: "Classique", d: "QR, nom, DLC, traçabilité", v: { dlc: 2, qr: 2, txt: 2, alg: true, lot: true, dates: true, qty: false, brand: false, code: true } },
  { id: "big", name: "DLC en grand", d: "La date se lit de loin", v: { dlc: 4, qr: 1, txt: 2, alg: false, lot: false, dates: false, qty: false, brand: false, code: true } },
  { id: "compact", name: "Compacte", d: "Plus d'infos, plus petit", v: { dlc: 1, qr: 1, txt: 1, alg: true, lot: true, dates: true, qty: true, brand: false, code: true } },
  { id: "logo", name: "Avec logo", d: "Le restaurant en tête", v: { dlc: 2, qr: 2, txt: 2, alg: true, lot: true, dates: true, qty: false, brand: true, code: true } },
];
const LB_SKEYS = ["dlc", "qr", "txt", "alg", "lot", "dates", "qty", "brand", "code"];
const LB_SMAX = { dlc: [1, 4], qr: [0, 3], txt: [1, 3] };
function lbStyle(raw) {
  const r = raw !== undefined ? raw : S.resto && S.resto.labelStyle;
  const o = typeof r === "string" ? { preset: r } : r && typeof r === "object" ? r : {};
  const P = LB_STYLES.find((p) => p.id === o.preset) || LB_STYLES[0];
  const s = { preset: P.id, ...P.v };
  LB_SKEYS.forEach((k) => {
    if (o[k] === undefined || o[k] === null) return;
    if (typeof P.v[k] === "boolean") s[k] = !!o[k];
    else { const n = Math.round(+o[k]); if (Number.isFinite(n)) s[k] = Math.max(LB_SMAX[k][0], Math.min(LB_SMAX[k][1], n)); }
  });
  s.custom = LB_SKEYS.some((k) => s[k] !== P.v[k]);
  return s;
}
/* lbStyle() (no argument) = the current design; a classic script function, so window.lbStyle is the same function */
/* restaurant name + logo for the « Avec logo » design */
function lbBrand() { const r = S.resto || {}; const name = String(r.name || "").trim(); const logo = typeof r.logo === "string" && /^(data:image|https?:)/.test(r.logo) ? r.logo : ""; return name || logo ? { name, logo } : null; }
/* every size in mm (1mm on paper, --mm on screen) */
const LB_FN = [0, 3.1, 3.9, 4.7], LB_FD = [0, 4.4, 5.8, 7.6, 10.4], LB_FS = [0, 1.8, 2.1, 2.5], LB_QR = [0, 16.5, 24.4, 40];
/* the label lays itself out before it is drawn: a design that asks for more than the roll holds is scaled down to fit */
function lbGeom(l, roll, st) {
  const cont = !roll.h; const baseH = roll.h || 29;
  const qr = st.qr ? Math.min(LB_QR[st.qr], baseH - (st.qr === 3 ? 2.8 : 4.6)) : 0;
  const tw = roll.w - 3.6 - (qr ? qr + 1.6 : 0);
  const fn0 = LB_FN[st.txt], fd0 = LB_FD[st.dlc], fs0 = LB_FS[st.txt], fc0 = 2.5 * [0, 0.88, 1, 1.12][st.txt];
  const op = l.status === "opened"; const nm = l.name || ""; const brand = st.brand ? lbBrand() : null; const alg = st.alg ? lbAllergens(l) : [];
  const meta = [st.dates ? (op ? `Ouvert le ${shortDate(dayKey(new Date(l.openedAt)))} à ${hm(l.openedAt)}` : `Reçu le ${l.createdAt ? shortDate(dayKey(new Date(l.createdAt))) : "–"}`) : "", st.lot && l.lot ? `${st.dates ? "lot" : "Lot"} ${l.lot}` : ""].filter(Boolean).join(" · ");
  const qty = st.qty ? [lbQty(l), l.supplier].filter(Boolean).join(" · ") : "";
  const maxL = cont ? 3 : 2;
  const lines = (f) => Math.max(1, Math.min(maxL, Math.ceil((nm.length * 0.53 * f * 1.12) / Math.max(10, tw))));
  const sl = (f) => f * 1.1;
  const need = (k) => (brand ? sl(fs0 * k) + 0.6 : 0) + lines(fn0 * k) * fn0 * k * 1.05 + 0.2 + sl(fs0 * 0.95 * k) + fd0 * k + 0.25
    + (meta ? sl(fs0 * k) + 0.7 : 0) + (qty ? sl(fs0 * k) + 0.35 : 0) + (alg.length ? sl(fs0 * k) + 0.35 : 0) + (st.code && l.code ? fc0 * k + 1.65 : 0);
  let H = roll.h, k = 1;
  if (cont) H = Math.max(29, Math.ceil(need(1) + 3));
  else { const avail = H - 2.8 + 0.3; while (k > 0.62 && need(k) > avail) k -= 0.02; }
  const kd = Math.min(k, tw / (8 * 0.56 * fd0)); /* « 06/11/26 » must fit the width */
  const r2 = (n) => Math.round(n * 100) / 100;
  return { H, qr, nl: lines(fn0 * k), fn: r2(fn0 * k), fd: r2(fd0 * kd), fs: r2(fs0 * k), fc: r2(fc0 * k), meta, qty, alg, brand };
}
/* continuous roll: the label grows with its content */
function lbLabelH(l, roll, st) { if (roll.h) return roll.h; return lbGeom(l, roll, st || lbStyle()).H; }
function lbTagHtml(l, roll, st) {
  roll = roll || lbRoll(); st = st || lbStyle(); const G = lbGeom(l, roll, st); const op = l.status === "opened"; const nm = l.name || "";
  const br = G.brand ? `<span class="br">${G.brand.logo ? `<img src="${esc(G.brand.logo)}" alt="" referrerpolicy="no-referrer">` : ""}<i>${esc(G.brand.name)}</i></span>` : "";
  return `<div class="lb-tag ${roll.h ? "" : "cont"} st-${st.preset}${G.qr ? "" : " noqr"}" style="--w:${roll.w};--h:${G.H};--q:${G.qr};--fn:${G.fn};--fd:${G.fd};--fs:${G.fs};--fc:${G.fc};--nl:${G.nl}">${G.qr ? `<span class="q">${qrSvg(l.code || l.id)}</span>` : ""}<div class="t">${br}<b class="n">${esc(nm.replace(/ (%|°C?)/g, " $1"))}</b>
    <span class="k">${op ? "DLC après ouverture" : "DLC"}</span><span class="d">${lbDate(dlcOf(l))}</span>
    ${G.meta ? `<span class="m">${esc(G.meta)}</span>` : ""}${G.qty ? `<span class="x">${esc(G.qty)}</span>` : ""}${G.alg.length ? `<span class="a">Allergènes : ${esc(G.alg.join(", "))}</span>` : ""}
    ${st.code && l.code ? `<span class="c">${esc(l.code)}</span>` : ""}</div></div>`;
}
function labelHtml(l) { return `<div class="lb-roll">${lbTagHtml(l)}</div>`; }

/* ───────────── impression : AirPrint / fenêtre d'impression du système ─────────────
   A browser can't talk to the printer itself, so the label is a print-only document sized exactly to the roll (@page 62mm 29mm, margin 0),
   rendered in a hidden iframe (its CSS stays isolated from the app) and sent to the system print dialog: iPhone (AirPrint), Android, desktop. */
function lbPrintDoc(lots, roll) {
  roll = roll || lbRoll(); const H = roll.h || Math.max(...lots.map((l) => lbLabelH(l, roll)));
  const css = new URL("css/labels.css", document.baseURI).href;
  const fonts = document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes</title>
<link rel="stylesheet" href="${esc(css)}">${fonts ? `<link rel="stylesheet" href="${esc(fonts.href)}">` : ""}
<style>@page{size:${roll.w}mm ${H}mm;margin:0}html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
:root{--f:"Manrope",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;--mono:var(--f)}
.lb-page{width:${roll.w}mm;height:${H}mm;overflow:hidden;break-after:page;page-break-after:always;background:#fff}.lb-page:last-child{break-after:auto;page-break-after:auto}
.lb-tag{--mm:1mm;--h:${H};border-radius:0;box-shadow:none;background:#fff}</style></head>
<body>${lots.map((l) => `<div class="lb-page">${lbTagHtml(l, roll)}</div>`).join("")}</body></html>`;
}
const LBP = { frame: null, t: 0 };
function lbPrintCleanup() { clearTimeout(LBP.t); LBP.t = 0; if (LBP.frame) { try { LBP.frame.remove(); } catch (e) {} LBP.frame = null; } }
async function lbPrint(lots, opts = {}) {
  lots = (lots || []).filter(Boolean); if (!lots.length) return false;
  lbPrintCleanup(); const roll = opts.roll || lbRoll();
  const f = document.createElement("iframe"); f.className = "lb-pframe"; f.setAttribute("aria-hidden", "true"); f.title = "Impression des étiquettes";
  f.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none"; /* not display:none: Safari prints a blank page then */
  f.srcdoc = lbPrintDoc(lots, roll);
  const loaded = new Promise((r) => { f.addEventListener("load", r, { once: true }); setTimeout(r, 3000); });
  document.body.appendChild(f); LBP.frame = f; await loaded;
  const w = f.contentWindow, d = f.contentDocument; if (!w || !d) { lbPrintCleanup(); return false; }
  try { await Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  if (opts.dry) { const n = d.querySelectorAll(".lb-page").length; lbPrintCleanup(); return n; }
  w.addEventListener("afterprint", () => setTimeout(lbPrintCleanup, 400));
  LBP.t = setTimeout(lbPrintCleanup, 180000);
  try { w.focus(); w.print(); } catch (e) { lbPrintCleanup(); return false; }
  lbPrintRemember(lots); return true;
}
window.lbPrint = lbPrint; window.lbPrintDoc = lbPrintDoc;
/* the primary button of the label sheet: print (AirPrint), or save the image when the restaurant chose that */
const lbPrintBtn = (ids, cls = "acc") => `<button class="btn ${cls} block" data-act="labelPrint" data-ids="${ids.join(",")}">${ico("printer")}Imprimer</button>`;
function openLabel(ids) {
  const lots = ids.map((i) => lbLot(i)).filter(Boolean); if (!lots.length) return;
  const test = lbTestMode(); const one = lots.length === 1; const c = lbPrinterCfg(); const roll = lbRoll(); const img = c.mode === "image";
  const fmtTx = roll.h ? `${roll.w === 90 ? "29 × 90" : `${roll.w} × ${roll.h}`} mm` : "62 mm en continu";
  lbSheet(`${one ? `<button class="btn ghost sm lb-back" data-act="lot" data-id="${lots[0].id}">${ico("back")}<span class="lb-bk">${esc(lots[0].name)}</span></button>` : ""}
    <div style="text-align:center"><div class="h2" style="font-size:20px">${one ? "Étiquette QR" : `${lots.length} étiquettes`}</div><div class="sub">Étiquette ${fmtTx}${c.name ? ` · ${esc(c.name)}` : ""}</div></div>
    <div class="lb-feed go" id="prAnim"><div class="lb-mouth"><i></i></div><div class="lb-paper" data-ids="${ids.join(",")}">${lots.map((l) => lbTagHtml(l, roll)).join("")}</div></div>
    ${test ? `<div class="lb-testnote">${ico("sparkle")}<span><b>Mode test sans imprimante.</b> ${one ? "Affichez le QR en grand : un autre téléphone peut le scanner. " : ""}Ou enregistrez l'image pour l'imprimer plus tard, sur n'importe quelle imprimante.</span></div>` : ""}
    ${one && test ? `<button class="btn acc block" data-act="lbQr" data-id="${lots[0].id}">${ico("lbFull")}Afficher le QR en grand</button>` : ""}
    ${img ? "" : lbPrintBtn(ids, test ? "soft" : "acc")}
    <button class="btn ${img && !(one && test) ? "acc" : "soft"} block" data-act="labelSave" data-ids="${ids.join(",")}">${ico("download")}Enregistrer l'image</button>
    ${one && !test ? `<button class="btn ghost block" data-act="lbQr" data-id="${lots[0].id}">${ico("lbFull")}Afficher le QR en grand</button>` : ""}
    <p class="note" style="margin:0;text-align:center">${img ? "L'image s'imprime depuis le téléphone (Partager, puis Imprimer) ou l'ordinateur." : `Touchez Imprimer, puis choisissez <b>${esc(c.short)}</b> dans la fenêtre d'impression${roll.h ? `, format <b>${fmtTx}</b>` : ""}. Le téléphone s'en souvient ensuite.`}</p>`);
}
/* the saved image is drawn from the very same markup as the screen and the print: the label is laid out off screen at 12px per mm,
   then every word, the QR and the logo are painted on a canvas at the position the browser gave them */
function lbLoadImg(src) {
  return new Promise((r) => { if (!src) return r(null); const im = new Image(); if (!/^data:/.test(src)) im.crossOrigin = "anonymous"; im.onload = () => r(im); im.onerror = () => r(null); setTimeout(() => r(null), 2500); im.src = src; });
}
function lbPaintText(g, el, o, y0) {
  const er = el.getBoundingClientRect(); if (!er.width || !er.height) return;
  const cs = getComputedStyle(el); const fsz = parseFloat(cs.fontSize) || 12;
  const ox = (x) => x - o.left, oy = (y) => y0 + y - o.top;
  const bw = parseFloat(cs.borderTopWidth) || 0; g.fillStyle = "#000"; if (bw) g.fillRect(ox(er.left), oy(er.top), er.width, Math.max(1, bw));
  g.save(); g.beginPath(); g.rect(ox(er.left) - 1, oy(er.top) - 1, er.width + 2, er.height + 2); g.clip();
  g.font = `${cs.fontStyle === "italic" ? "italic " : ""}${cs.fontWeight} ${fsz}px ${cs.fontFamily}`; g.textBaseline = "alphabetic";
  try { g.letterSpacing = cs.letterSpacing && cs.letterSpacing !== "normal" ? cs.letterSpacing : "0px"; } catch (e) {}
  const up = cs.textTransform === "uppercase"; const nowrap = cs.whiteSpace === "nowrap" && el.scrollWidth > el.clientWidth + 1;
  const ell = "…"; const ellW = nowrap ? g.measureText(ell).width : 0; let lastR = null, cut = false;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const rg = document.createRange(); let node;
  while ((node = tw.nextNode())) {
    const s = node.nodeValue; const re = /[^ \n\t\r]+/g; let m;
    while ((m = re.exec(s))) {
      rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length); const rr = rg.getClientRects()[0]; if (!rr) continue;
      if (rr.top >= er.bottom - 1) { cut = true; continue; }
      if (nowrap && rr.right > er.right - ellW) { cut = true; continue; }
      const t = up ? m[0].toUpperCase() : m[0]; const mt = g.measureText(t);
      const asc = mt.fontBoundingBoxAscent || fsz * 0.8, desc = mt.fontBoundingBoxDescent || fsz * 0.22;
      /* the screen font may be narrower (variable width axis): squeeze the word into the box the browser gave it */
      const by = oy(rr.top) + (rr.height - asc - desc) / 2 + asc; const sx = mt.width > rr.width * 1.01 ? rr.width / mt.width : 1;
      if (sx < 1) { g.save(); g.translate(ox(rr.left), by); g.scale(sx, 1); g.fillText(t, 0, 0); g.restore(); } else g.fillText(t, ox(rr.left), by);
      lastR = rr;
    }
  }
  if (nowrap && cut && lastR) { const mt = g.measureText(ell); const asc = mt.fontBoundingBoxAscent || fsz * 0.8, desc = mt.fontBoundingBoxDescent || fsz * 0.22; g.fillText(ell, ox(lastR.right) + 1, oy(lastR.top) + (lastR.height - asc - desc) / 2 + asc); }
  g.restore();
}
async function labelPng(lots, noLogo) {
  const roll = lbRoll(); const st = lbStyle(); const PX = 12, GAP = lots.length > 1 ? 24 : 0;
  const box = document.createElement("div"); box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none;display:flex;flex-direction:column;align-items:flex-start;gap:0";
  box.innerHTML = lots.map((l) => lbTagHtml(l, roll, st)).join("");
  $$(".lb-tag", box).forEach((t) => { t.style.setProperty("--mm", PX + "px"); t.style.borderRadius = "0"; t.style.boxShadow = "none"; });
  document.body.appendChild(box);
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}
  const brand = st.brand ? lbBrand() : null; const logo = !noLogo && brand && brand.logo ? await lbLoadImg(brand.logo) : null;
  const tags = $$(".lb-tag", box); const W = Math.round(roll.w * PX); const hs = tags.map((t) => Math.round(t.getBoundingClientRect().height));
  const c = document.createElement("canvas"); c.width = W; c.height = hs.reduce((a, b) => a + b, 0) + GAP * (tags.length - 1); const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  let y0 = 0;
  tags.forEach((t, i) => {
    const o = t.getBoundingClientRect(); const l = lots[i];
    if (i) { g.fillStyle = "#e6e6e6"; g.fillRect(0, y0 - GAP, W, GAP); }
    g.fillStyle = "#fff"; g.fillRect(0, y0, W, hs[i]);
    const qe = $(".q", t);
    if (qe) {
      const r = qe.getBoundingClientRect(); const q = qrcode(0, "M"); q.addData(l.code || l.id); q.make(); const n = q.getModuleCount(); const s = r.width / (n + 2);
      const qx = r.left - o.left + s, qy = y0 + r.top - o.top + s; g.fillStyle = "#000";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) { const a = Math.round(qx + x * s), b = Math.round(qy + y * s); g.fillRect(a, b, Math.round(qx + (x + 1) * s) - a, Math.round(qy + (y + 1) * s) - b); }
    }
    const im = $(".br img", t);
    if (im && logo) { const r = im.getBoundingClientRect(); try { g.filter = "grayscale(1) contrast(1.25)"; } catch (e) {} const k = Math.min(r.width / logo.naturalWidth, r.height / logo.naturalHeight); const w = logo.naturalWidth * k, h = logo.naturalHeight * k; try { g.drawImage(logo, r.left - o.left + (r.width - w) / 2, y0 + r.top - o.top + (r.height - h) / 2, w, h); } catch (e) {} try { g.filter = "none"; } catch (e) {} }
    $$(".br i,.n,.k,.d,.m,.x,.a,.c", t).forEach((el) => lbPaintText(g, el, o, y0));
    y0 += hs[i] + GAP;
  });
  box.remove();
  const out = await new Promise((r) => { try { c.toBlob(r, "image/png"); } catch (e) { r(null); } });
  if (out || !logo) return out;
  /* a logo from another site can lock the canvas: draw again without it */
  return labelPng(lots, true);
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
      <div class="h2" style="font-size:21px">Ranger dans…</div>${svcNum(l) != null && svcNum(l) > svcStepOf(l) ? `<p class="sub" style="margin:-6px 0 0">Vous pourrez n'en déplacer qu'une partie (${svcQtyTx(svcNum(l), l.unit)} en tout).</p>` : ""}
      <div>${S.fridges.map((f) => { const n = activeLots().filter((x) => x.fridgeId === f.id).length; const on = l.fridgeId === f.id; return `<div class="li tap lb-fr ${on ? "on" : ""}" data-act="lotMove" data-id="${id}" data-v="${f.id}"><span class="ic">${relIco(f)}</span><div class="tx"><b>${esc(f.name)}</b><em>${on ? "Il est ici" : `${relIsService(f) ? "Frigo de service · " : ""}${n} produit${n > 1 ? "s" : ""}`}</em></div>${on ? `<span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : ico("chev")}</div>`; }).join("") || `<div class="empty">Aucun frigo. Ajoutez-en depuis l'onglet Frigos.</div>`}</div>`);
  },
  lotMove: lbOnce(async (a, id, v) => {
    const l = svcGet(id); if (!l) return; if (l.fridgeId === v) { openLot(id); return; }
    if (svcNum(l) != null && svcNum(l) > svcStepOf(l) && !(svcIn(l) && !relIsService(relFr(v)))) { svcAsk(id, v, "lot"); return; }
    const U = svcNewUndo(`déplacement de ${l.name} vers ${fridgeName(v)}`); const nid = await svcMove(l, v, null, U); if (!nid) return;
    SFX.ok(); buzz(10); const nl = svcGet(nid); openLot(nl && nl.status === "merged" ? nl.mergedInto : nid); svcArmUndo(U, nid, "déplacé", `Déplacé en ${relShort(fridgeName(v), 22)}`);
  }),
  /* HACCP: an undo never erases the trace. The original entry stays, marked cancelled, and the undo itself is logged. */
  lbUndo: lbOnce(async () => {
    const u = S.ui.lbUndo; if (!u) return; S.ui.lbUndo = null;
    try {
      if (u.svc) await svcUndo(u.svc); else {
      await DB.set("lots", u.id, u.prev);
      const now = Date.now();
      if (u.evId) await DB.update("events", u.evId, { cancelled: true, cancelledAt: now, cancelledBy: S.me.id }).catch(() => {});
      await DB.add("events", { type: "lot", text: u.undoTxt, at: now, uid: S.me.id, ref: u.id, undoOf: u.evId || "" }).catch(() => {});
      }
    } catch (e) { S.ui.lbUndo = u; SFX.err(); toast("Impossible d'annuler.", "err"); return; }
    const t = $("#toast"); t.classList.remove("on"); t.style.pointerEvents = ""; SFX.close(); buzz(8);
    const b = LB.batch.find((x) => x.id === u.id && !x.undone); if (b) { b.undone = true; lbRenderBatch(); }
    if ($("#sheet").classList.contains("open") && $("#sheetBody .lb-lot")) { const back = u.svc && u.svc.lots[0] ? u.svc.lots[0].id : u.id; openLot(lbLot(back) && !["merged"].includes(lbLot(back).status) ? back : u.id); }
    setTimeout(() => toast("Annulé, c'est noté dans l'historique"), 60);
    if (u.svc && S.route !== "scan") refresh();
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
    if (LB.mode === v) return; LB.mode = v; LB.seen = {}; LB.batch = []; SFX.tick(); buzz(5);
    const seg = a.closest(".seg"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${["one", "svc", "multi"].indexOf(v) * 100}%)`; }
    setTimeout(() => { const p = $("#lbPanel"); if (p) { p.innerHTML = lbPanelHtml(); p.classList.add("nost"); lbRenderBatch(); } }, 180);
    const st = lbStageEl(); if (st) { st.classList.toggle("multi", v === "multi"); st.classList.toggle("svc", v === "svc"); st.classList.toggle("ret", v === "svc" && svcPref().dir === "ret"); $(".lb-hint", st).textContent = lbHintTx(); }
  },
  lbTarget: (a, id, v) => { S.ui.lbTarget = v; $$("[data-act=lbTarget]").forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); lbRenderBatch(); },
  lbBatchEnd: () => {
    const n = LB.batch.filter((b) => b.cls === "ok" && !b.undone).length; LB.batch = []; LB.seen = {};
    if (n) { SFX.done(); burst(); toast(`${n} produit${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""}`); }
    lbRenderBatch();
  },

  /* choosing a real printer also leaves the test mode: labels then print instead of showing on screen */
  printerSet: async (a, id, v) => { const M = LB_MODELS.find((m) => m.id === v); if (!M) return; const ch = lbPrinterCfg().model !== v; await lbPrinterSave(ch ? { model: v, ok: null, scanOk: null } : { model: v }); if (lbTestMode()) await safe(DB.update("restos", S.rid, { printTest: false })); SFX.ok(); buzz(8); LBW.alt = false; lbPrinterPatch(); lbwPaint(); toast(`${M.name} choisie`); },
  printerRoll: async (a, id, v) => { if (!LB_ROLLS.some((r) => r.id === v)) return; await lbPrinterSave({ roll: v }); SFX.tick(); buzz(6); lbPrinterPatch(); lbStylePatch(true); },
  printerMode: async (a, id, v) => { await lbPrinterSave({ mode: v === "image" ? "image" : "airprint" }); SFX.tick(); buzz(6); lbPrinterPatch(); },
  lbTestMode: async () => { const on = !lbTestMode(); await safe(DB.update("restos", S.rid, { printTest: on })); SFX.tick(); buzz(6); lbPrinterPatch(); },
  lbTestLabel: async () => {
    const demos = [["Crème fraîche 35 %", "1", "L", 6], ["Saumon fumé", "0,8", "kg", 4], ["Fond de veau maison", "2", "L", 3], ["Beurre doux AOP", "1", "kg", 12]];
    const [name, qty, unit, d] = demos[S.lots.filter((l) => l.test).length % demos.length];
    const id = await safe(DB.add("lots", { name: `${name} (test)`, productId: "", qty, unit, lot: "TEST", dlc: addDays(dayKey(), d), supplier: "Étiquette test", receptionId: "", fridgeId: S.fridges[0]?.id || "", status: "in", receivedTemp: null, code: "GG-" + rid6(), createdAt: Date.now(), uid: S.me.id, test: true }));
    await logEvent("lot", `a créé une étiquette test (${name})`, { ref: id });
    SFX.ok(); buzz([10, 30, 10]); setTimeout(() => lbQrOpen(id), 120);
  },
  /* print: from the label sheet (one or many lots), the lot sheet, or the test button of the printer setup */
  labelPrint: async (a) => { const lots = (a.dataset.ids || "").split(",").map((i) => lbLot(i)).filter(Boolean); if (!lots.length) return; const p = $("#prAnim"); if (p) { p.classList.remove("go"); void p.offsetWidth; p.classList.add("go"); } await lbPrintLots(lots); },
  lotPrint: (a, id) => { lbQrClose(true); SFX.tap(); if (lbPrinterCfg().mode === "image") return openLabel([id]); const l = lbLot(id); if (l) lbPrintLots([l]); },
  lbPrintTest: async (a) => {
    const demo = { id: "test", name: "Étiquette test", status: "in", dlc: addDays(dayKey(), 3), createdAt: Date.now(), lot: "TEST", code: "GG-TEST01", allergens: ["lait"] };
    if (a) a.disabled = true; const ok = await lbPrintLots([demo], true); if (a) a.disabled = false;
    if (ok) { logEvent("lot", "a imprimé une étiquette test"); lbwAfterPrint(); }
  },
});
/* sends to the system print dialog; says what to do when the device cannot print */
async function lbPrintLots(lots, test) {
  SFX.print(); buzz(8); const n = lots.length;
  const ok = await lbPrint(lots);
  if (ok) { toast(test ? "Étiquette test envoyée à l'imprimante" : n > 1 ? `${n} étiquettes envoyées à l'imprimante` : "Étiquette envoyée à l'imprimante"); if (!test) logEvent("lot", `a imprimé ${n > 1 ? `${n} étiquettes` : `l'étiquette de ${lots[0].name}`}`, { ref: lots[0].id }); }
  else { SFX.err(); toast("Impression impossible sur cet appareil. Enregistrez l'image, puis Partager → Imprimer.", "err"); }
  return ok;
}
/* the three setup steps, worded for the chosen printer */
function lbStepsFor(model) {
  const M = LB_MODELS.find((m) => m.id === model) || LB_MODELS[0]; const brother = /^ql/.test(M.id); const roll = lbRoll();
  const fmt = roll.h ? `format <b>${roll.w === 90 ? "29 × 90" : `${roll.w} × ${roll.h}`} mm</b>` : "format <b>62 mm continu</b>";
  const app = brother ? "l'application gratuite <b>Brother iPrint&amp;Label</b>" : M.id === "zd421" ? "l'application gratuite <b>Zebra Printer Setup</b>" : "l'application du fabricant";
  return [
    ["Branchez et chargez le rouleau", brother ? `Branchez l'imprimante sur le secteur et allumez-la. Ouvrez le capot, posez le rouleau <b>${esc(roll.name)}</b> (les étiquettes passent par-dessous et sortent par la fente avant), refermez : elle avance d'une étiquette.` : "Branchez l'imprimante sur le secteur, allumez-la et chargez le rouleau d'étiquettes en suivant le schéma sous le capot."],
    ["Connectez-la au Wi-Fi du restaurant", brother ? `Le plus simple : appuyez sur le bouton <b>WPS</b> de la box, puis dans les 2 minutes sur le bouton <b>Wi-Fi</b> de l'imprimante. Sinon, faites-le avec ${app}. Le voyant Wi-Fi doit rester <b>fixe</b>. Le téléphone doit être sur le <b>même Wi-Fi</b> que l'imprimante.` : `Avec ${app}, reliez-la au Wi-Fi du restaurant. Le téléphone doit être sur le <b>même Wi-Fi</b> que l'imprimante.`],
    ["Imprimez une étiquette test", `Touchez « Imprimer une étiquette test ». Dans la fenêtre d'impression, choisissez <b>${esc(M.id === "other" ? "votre imprimante" : M.short)}</b>, ${fmt}, puis Imprimer. Le téléphone s'en souvient : la prochaine fois, un seul geste.`],
  ];
}
const lbStepsHtml = (model) => lbStepsFor(model).map(([t, d], i) => `<div class="lb-step"><span class="mono">${i + 1}</span><div><b>${t}</b><p class="note" style="margin:2px 0 0">${d}</p></div></div>`).join("");
const LB_FAQ = [
  ["L'imprimante n'apparaît pas dans la liste", "Le téléphone et l'imprimante doivent être sur le <b>même Wi-Fi</b> (pas en 4G, pas sur le Wi-Fi invités). Le voyant Wi-Fi doit être <b>fixe</b> : s'il clignote, elle n'est pas connectée (elle ne capte que le 2,4 GHz). Éteignez-la, rallumez-la, puis réessayez."],
  ["Rien ne sort", "Vérifiez que le <b>capot est bien fermé</b> et qu'un rouleau est chargé. Si le voyant clignote, éteignez puis rallumez l'imprimante, et relancez l'impression."],
  ["L'étiquette sort blanche", "Le rouleau est <b>à l'envers</b> : le papier thermique ne noircit que d'un côté. Rechargez-le, étiquettes se déroulant par-dessous vers l'avant."],
  ["L'étiquette sort coupée ou décalée", "Dans la fenêtre d'impression, le <b>format papier</b> doit être celui du rouleau (62 × 29 mm pour le DK-11209). Vérifiez aussi le rouleau choisi dans Growth Gusto."],
  ["L'impression est pâle", "Préférez les <b>rouleaux DK d'origine Brother</b> et rangez-les à l'abri de la chaleur et du soleil."],
  ["Rien ne se passe en touchant Imprimer", "Sur iPhone, ouvrez Growth Gusto dans Safari ou depuis son icône sur l'écran d'accueil. En secours, réglez « Comment imprimer » sur <b>Image à enregistrer</b>, puis Partager, Imprimer."],
];
const lbFaqHtml = (openFirst) => LB_FAQ.map(([q, a], i) => `<details class="lb-faq" ${openFirst && !i ? "open" : ""}><summary>${q}${ico("chev")}</summary><p class="note">${a}</p></details>`).join("");
const lbDemoLot = () => ({ name: "Crème fraîche 35 %", status: "in", dlc: addDays(dayKey(), 6), createdAt: Date.now(), lot: "A1234", code: "GG-DEMO1", allergens: ["lait"], qty: "1", unit: "L", supplier: "Laiterie du Val" });
const lbRollVis = (r) => `<span class="lb-rv ${r.h ? "" : "cont"}"><i style="aspect-ratio:${r.w}/${r.h || 62}"></i></span>`;
const lbSel = (on) => `<span class="lb-sel ${on ? "on" : ""}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>`;
/* after a setting changes: update what is on screen, no re-render (works on the Imprimante screen and in the onboarding) */
function lbPrinterPatch() {
  const c = lbPrinterCfg();
  $$("[data-act=printerSet]").forEach((b) => b.classList.toggle("on", b.dataset.v === c.model));
  $$("[data-act=printerRoll]").forEach((b) => { b.classList.toggle("on", b.dataset.v === c.roll); b.setAttribute("aria-pressed", b.dataset.v === c.roll); });
  $$("[data-act=printerMode]").forEach((b) => b.classList.toggle("on", b.dataset.v === c.mode));
  $$(".lb-sel").forEach((s) => { const b = s.closest("[data-act]"); if (b && /^printer/.test(b.dataset.act)) s.classList.toggle("on", b.classList.contains("on")); });
  $$(".lb-mseg .knob").forEach((k) => (k.style.transform = `translateX(${c.mode === "image" ? 100 : 0}%)`));
  $$("[data-lb=last]").forEach((e) => (e.textContent = lbLastPrintTx()));
  const t = lbTestMode(); $$(".lb-testcard").forEach((k) => { k.classList.toggle("on", t); const sw = $(".lb-sw", k); if (sw) sw.classList.toggle("on", t); const em = $(".tx em", k); if (em) em.textContent = t ? "Activé" : "Désactivé"; const r = $("[role=switch]", k); if (r) r.setAttribute("aria-checked", t); });
  lbStatusPatch();
}
/* ───────────── illustrations de l'assistant (SVG plats, V2) ───────────── */
const LBI = { ink: "#1B1530", body: "#2B2540", lid: "#3B3456", hi: "#4C4470", deep: "#0E0B16", paper: "#FFFDF8", rim: "#DCCFB8", rim2: "#E9DFCD", cream: "#F4EDE0", vio: "#5B2BFF", vink: "#3A10D8", tint: "#EFE9FF", saf: "#F6B93B", mint: "#9EF5C4", sky: "#9EC5FF" };
const lbiBadge = (x, y, n) => `<g class="lbi-badge" style="--d:${n * 0.18}s"><circle cx="${x}" cy="${y}" r="11" fill="${LBI.vio}"/><circle cx="${x}" cy="${y + 1.5}" r="11" fill="none" stroke="#2A0BA6" stroke-width="0" /><text x="${x}" y="${y + 4.2}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff" font-family="Bricolage Grotesque,Instrument Sans,Arial,sans-serif">${n}</text></g>`;
const lbiRing = (x, y, r = 13) => `<circle class="lbi-ring" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${LBI.vio}" stroke-width="3"/>`;
const lbiMiniQr = (x, y, s) => { const u = s / 7; const on = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [4, 0], [5, 0], [6, 0], [4, 1], [6, 1], [4, 2], [5, 2], [6, 2], [0, 4], [1, 4], [2, 4], [0, 5], [2, 5], [0, 6], [1, 6], [2, 6], [4, 4], [6, 4], [5, 5], [4, 6], [6, 6], [3, 3], [3, 5], [5, 3]]; return on.map(([a, b]) => `<rect x="${(x + a * u).toFixed(1)}" y="${(y + b * u).toFixed(1)}" width="${u.toFixed(2)}" height="${u.toFixed(2)}" fill="${LBI.ink}"/>`).join(""); };
/* the printer, front view, 160 × 100 */
function lbiPrinter(o = {}) {
  const t = `translate(${o.x || 0},${o.y || 0}) scale(${o.s || 1})`;
  const ledS = o.led === false ? "#4A4560" : LBI.mint, ledW = o.wifi === "off" ? "#4A4560" : LBI.sky;
  return `<g transform="${t}">
    <ellipse cx="80" cy="101" rx="86" ry="6" fill="${LBI.ink}" opacity=".1"/>
    <rect x="0" y="36" width="160" height="64" rx="18" fill="${LBI.deep}"/>
    ${o.open ? `<rect x="12" y="24" width="120" height="22" rx="9" fill="${LBI.deep}"/><rect x="16" y="28" width="6" height="14" rx="3" fill="${LBI.saf}"/>` : ""}
    <rect x="0" y="32" width="160" height="64" rx="18" fill="${LBI.body}"/>
    ${o.open ? `<g class="lbi-lid" transform="translate(0,-34) rotate(-7 154 40)"><rect x="6" y="8" width="148" height="30" rx="15" fill="${LBI.lid}"/><rect x="22" y="14" width="64" height="4" rx="2" fill="${LBI.hi}"/></g>`
      : `<rect x="6" y="8" width="148" height="36" rx="18" fill="${LBI.lid}"/><rect x="22" y="15" width="64" height="4" rx="2" fill="${LBI.hi}"/>`}
    <rect x="18" y="72" width="100" height="9" rx="4.5" fill="${LBI.deep}"/>
    <circle cx="138" cy="52" r="8" fill="${LBI.ink}" stroke="${LBI.hi}" stroke-width="1.5"/><path d="M138 47.5v4M134.8 49.6a4.6 4.6 0 1 0 6.4 0" fill="none" stroke="#B9B2CE" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="114" cy="52" r="6.5" fill="${LBI.ink}" stroke="${LBI.hi}" stroke-width="1.5"/><path d="M110.8 51.2a4.6 4.6 0 0 1 6.4 0M112.3 53a2.4 2.4 0 0 1 3.4 0" fill="none" stroke="#B9B2CE" stroke-width="1.3" stroke-linecap="round"/>
    <circle class="${o.led === false ? "" : "lbi-led"}" cx="138" cy="66" r="2.4" fill="${ledS}"/><circle class="${o.wifi === "blink" ? "lbi-blink" : ""}" cx="114" cy="66" r="2.4" fill="${ledW}"/>
    <text x="16" y="62" font-size="7.5" font-weight="700" fill="#8E87A6" font-family="Instrument Sans,Arial,sans-serif" letter-spacing=".04em">QL-810W</text>
    ${o.hi === "power" ? lbiRing(138, 52) : o.hi === "wifi" ? lbiRing(114, 52, 11.5) : ""}
    ${o.label ? `<clipPath id="lbiClip${o.label}"><rect x="10" y="77" width="140" height="80"/></clipPath><g clip-path="url(#lbiClip${o.label})"><g class="lbi-out"><rect x="28" y="70" width="80" height="50" rx="3" fill="#fff" stroke="${LBI.rim}" stroke-width="1.5"/>${lbiMiniQr(34, 80, 30)}<rect x="70" y="82" width="32" height="6" rx="2" fill="${LBI.ink}"/><rect x="70" y="93" width="22" height="3" rx="1.5" fill="#9C96AE"/><rect x="70" y="100" width="30" height="8" rx="2" fill="${LBI.ink}"/></g></g>` : ""}
  </g>`;
}
const lbiSvg = (inner, cls = "") => `<svg class="lbw-ill ${cls}" viewBox="0 0 320 200" aria-hidden="true">${inner}</svg>`;
function lbiPhone(x, y, screen, dark) {
  return `<g transform="translate(${x},${y})"><rect x="0" y="0" width="112" height="188" rx="22" fill="${LBI.ink}"/><rect x="6" y="6" width="100" height="176" rx="17" fill="${dark ? LBI.body : LBI.paper}"/><rect x="40" y="12" width="32" height="8" rx="4" fill="${LBI.ink}"/>${screen}</g>`;
}
const lbiArcs = (cx, cy, rot = 0, s = 1) => `<g transform="translate(${cx},${cy}) rotate(${rot}) scale(${s})" fill="none" stroke="${LBI.vio}" stroke-width="5" stroke-linecap="round"><path class="lbi-arc a3" d="M-30 -8a42 42 0 0 1 60 0"/><path class="lbi-arc a2" d="M-19 3a27 27 0 0 1 38 0"/><path class="lbi-arc a1" d="M-8 14a11 11 0 0 1 16 0"/><circle cx="0" cy="22" r="4" fill="${LBI.vio}" stroke="none"/></g>`;
const LB_ILL = {
  power: () => lbiSvg(`<rect x="16" y="84" width="48" height="60" rx="13" fill="${LBI.paper}" stroke="${LBI.rim}" stroke-width="2"/><circle cx="34" cy="114" r="3.6" fill="#4A4560"/><circle cx="46" cy="114" r="3.6" fill="#4A4560"/>
      <path d="M40 124C40 176 108 176 132 150" fill="none" stroke="${LBI.body}" stroke-width="6" stroke-linecap="round"/><g class="lbi-plug"><rect x="29" y="103" width="22" height="22" rx="6" fill="${LBI.body}"/></g>
      ${lbiPrinter({ x: 130, y: 64, s: 1.1, hi: "power" })}${lbiBadge(76, 98, 1)}${lbiBadge(300, 82, 2)}`),
  roll: () => lbiSvg(`${lbiPrinter({ x: 80, y: 92, open: true })}
      <g class="lbi-drop"><rect x="108" y="10" width="10" height="42" rx="4" fill="${LBI.body}"/><rect x="116" y="12" width="90" height="38" rx="9" fill="#fff" stroke="${LBI.rim}" stroke-width="2"/><path d="M140 12v38M164 12v38M188 12v38" stroke="${LBI.rim2}" stroke-width="2" stroke-dasharray="3 3"/><rect x="204" y="10" width="10" height="42" rx="4" fill="${LBI.body}"/><path d="M122 50v24" stroke="${LBI.rim}" stroke-width="10"/></g>
      <path class="lbi-arrow" d="M246 26v40m-10-11 10 11 10-11" fill="none" stroke="${LBI.vio}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${lbiBadge(66, 118, 1)}`),
  wifi: () => lbiSvg(`<g transform="translate(16,92)"><rect x="16" y="-30" width="7" height="38" rx="3.5" fill="#4A4560"/><rect x="84" y="-30" width="7" height="38" rx="3.5" fill="#4A4560"/><rect x="0" y="0" width="108" height="54" rx="15" fill="${LBI.paper}" stroke="${LBI.rim}" stroke-width="2"/><circle cx="18" cy="27" r="3" fill="${LBI.mint}"/><circle cx="29" cy="27" r="3" fill="${LBI.mint}"/><circle cx="40" cy="27" r="3" fill="#D8CFBE"/><g class="lbi-press"><rect x="58" y="16" width="38" height="22" rx="11" fill="${LBI.saf}"/><text x="77" y="31" text-anchor="middle" font-size="10" font-weight="800" fill="#5E4410" font-family="Instrument Sans,Arial,sans-serif">WPS</text></g></g>
      ${lbiArcs(162, 104, 90, 0.9)}${lbiPrinter({ x: 196, y: 86, s: 0.72, hi: "wifi", wifi: "blink" })}${lbiBadge(94, 72, 1)}${lbiBadge(282, 76, 2)}`),
  phone: () => lbiSvg(`${lbiPhone(40, 6, `<text x="56" y="40" text-anchor="middle" font-size="9" font-weight="800" fill="${LBI.ink}" font-family="Instrument Sans,Arial,sans-serif">Imprimer</text>
      <rect class="lbi-row" x="12" y="50" width="88" height="34" rx="10" fill="${LBI.tint}"/><text x="20" y="63" font-size="7" font-weight="600" fill="#615B74" font-family="Instrument Sans,Arial,sans-serif">Imprimante</text><text x="20" y="76" font-size="8.4" font-weight="800" fill="${LBI.vink}" font-family="Instrument Sans,Arial,sans-serif">Brother QL-810W</text>
      <rect x="12" y="90" width="88" height="24" rx="10" fill="${LBI.cream}"/><text x="20" y="105.5" font-size="8" font-weight="600" fill="${LBI.ink}" font-family="Instrument Sans,Arial,sans-serif">1 copie</text>
      <rect x="12" y="120" width="88" height="24" rx="10" fill="${LBI.cream}"/><text x="20" y="135.5" font-size="8" font-weight="600" fill="${LBI.ink}" font-family="Instrument Sans,Arial,sans-serif">62 × 29 mm</text>
      <rect x="12" y="152" width="88" height="22" rx="11" fill="${LBI.vio}"/><text x="56" y="166.5" text-anchor="middle" font-size="8.6" font-weight="800" fill="#fff" font-family="Instrument Sans,Arial,sans-serif">Imprimer</text>`)}
      ${lbiArcs(234, 58, 0, 0.8)}${lbiPrinter({ x: 180, y: 100, s: 0.78 })}`),
  rolls: () => lbiSvg(`<rect x="96" y="124" width="216" height="40" rx="4" fill="#fff" stroke="${LBI.rim}" stroke-width="2"/><g class="lbi-strip">${[0, 1, 2].map((i) => `<rect x="${150 + i * 66}" y="128" width="58" height="32" rx="5" fill="#fff" stroke="${LBI.rim2}" stroke-width="2"/>${lbiMiniQr(155 + i * 66, 134, 19)}<rect x="${178 + i * 66}" y="135" width="24" height="5" rx="2" fill="${LBI.ink}"/><rect x="${178 + i * 66}" y="145" width="18" height="7" rx="2" fill="${LBI.ink}"/>`).join("")}</g>
      <circle cx="92" cy="96" r="62" fill="#fff" stroke="${LBI.rim}" stroke-width="3"/><circle cx="92" cy="96" r="46" fill="none" stroke="${LBI.rim2}" stroke-width="2"/><circle cx="92" cy="96" r="22" fill="${LBI.cream}" stroke="${LBI.rim}" stroke-width="2"/><circle cx="92" cy="96" r="9" fill="${LBI.body}"/>
      <path d="M150 112h58" stroke="${LBI.vio}" stroke-width="2.5"/><path d="M150 106v12M208 106v12" stroke="${LBI.vio}" stroke-width="2.5" stroke-linecap="round"/><text x="179" y="102" text-anchor="middle" font-size="10" font-weight="800" fill="${LBI.vink}" font-family="Instrument Sans,Arial,sans-serif">62 mm</text>
      <path d="M140 128v32" stroke="${LBI.vio}" stroke-width="2.5"/><text x="134" y="148" text-anchor="end" font-size="10" font-weight="800" fill="${LBI.vink}" font-family="Instrument Sans,Arial,sans-serif">29</text>`),
  test: () => lbiSvg(`${lbiPrinter({ x: 80, y: 30, label: 1 })}<g class="lbi-spark" fill="${LBI.saf}"><path d="M262 44l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="M58 100l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>`),
  scan: () => lbiSvg(`<g transform="translate(196,96) rotate(-6)"><rect x="0" y="0" width="104" height="50" rx="5" fill="#fff" stroke="${LBI.rim}" stroke-width="2"/>${lbiMiniQr(7, 8, 34)}<rect x="48" y="10" width="46" height="7" rx="2" fill="${LBI.ink}"/><rect x="48" y="23" width="30" height="4" rx="2" fill="#9C96AE"/><rect x="48" y="32" width="40" height="10" rx="2" fill="${LBI.ink}"/></g>
      ${lbiPhone(44, 6, `<rect x="16" y="52" width="80" height="80" rx="8" fill="#fff"/>${lbiMiniQr(26, 62, 60)}<path d="M10 58v-10h10M102 58v-10h-10M10 126v10h10M102 126v10h-10" fill="none" stroke="${LBI.saf}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect class="lbi-laser" x="14" y="90" width="84" height="3" rx="1.5" fill="${LBI.saf}"/>`, true)}
      <path d="M168 102c10-8 18-8 26-4" fill="none" stroke="${LBI.vio}" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>`),
};
/* the « validé » seal: scalloped violet stamp + check */
const LB_SEAL_D = (() => { const n = 18, R = 46, r = 40; let d = ""; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 0.5) / n) * Math.PI * 2; const p = [50 + R * Math.cos(a), 50 + R * Math.sin(a)], q = [50 + (r + 14) * Math.cos(b) * 0.92, 50 + (r + 14) * Math.sin(b) * 0.92]; d += i ? `Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`; } return d + "Z"; })();
const lbSealSvg = () => `<svg class="lb-seal" viewBox="0 0 100 100" aria-hidden="true"><path class="sh" d="${LB_SEAL_D}" fill="#2A0BA6" transform="translate(0 3.5)"/><path d="${LB_SEAL_D}" fill="${LBI.vio}"/><circle cx="50" cy="50" r="31" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="2 3.2"/><path class="ck" d="M35 51l10 10 21-23" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* ═════════════ Assistant d'installation de l'imprimante (pas à pas) ═════════════
   lbWizardHTML(opts) → markup, one step at a time; every action patches it in place (works in VIEWS.imprimante and in the onboarding).
   Saved on the resto doc: printer: { model, roll, mode, ok (test label printed, ms), scanOk (test label scanned, ms) }. */
const LBW = { step: 0, alt: false, open: false, fail: false, printed: false, opts: {} };
const LB_TESTCODE = "GG-TEST01";
const lbWizardDone = () => !!lbPrinterCfg().ok;
window.lbWizardDone = lbWizardDone;
const lbModel = () => LB_MODELS.find((m) => m.id === lbPrinterCfg().model) || LB_MODELS[0];
const lbFmtTx = (roll) => (roll.h ? `${roll.w === 90 ? "29 × 90" : `${roll.w} × ${roll.h}`} mm` : "62 mm en continu");
/* the steps, worded for the chosen printer (the Brother QL-810Wc by default) */
function lbwSteps() {
  const M = lbModel(); const ql = /^ql/.test(M.id); const q810 = M.id === "ql810wc"; const roll = lbRoll(); const nm = M.id === "other" ? "votre imprimante" : M.short;
  return [
    { k: "power", ill: "power", t: "Branchez-la", s: "Le cordon d'alimentation à l'arrière, puis dans une prise.",
      b: ["Retirez d'abord les adhésifs et les cartons de protection.", ql ? "Appuyez sur le bouton marche : le voyant s'allume." : "Allumez-la avec son bouton marche."],
      help: [["Rien ne s'allume", "Enfoncez bien le cordon des deux côtés, essayez une autre prise, puis maintenez le bouton marche une seconde."], ["Le voyant clignote", "Souvent, il manque le rouleau ou le capot est mal fermé : c'est l'étape suivante."]] },
    { k: "roll", ill: "roll", t: "Mettez le rouleau", s: ql ? "Soulevez le capot, posez le rouleau DK, refermez." : "Ouvrez le capot et chargez le rouleau selon le schéma intérieur.",
      b: ql ? ["Les étiquettes se déroulent par-dessous, vers l'avant.", "Glissez le bout dans la fente, bord gauche contre le guide, jusqu'à ce qu'il sorte devant."] : ["Les étiquettes sortent par la fente avant.", "Refermez bien le capot."],
      help: [["Les étiquettes sortent blanches", "Le rouleau est à l'envers : le papier thermique ne noircit que d'un côté. Retournez-le, étiquettes vers le bas."], ["Le capot ne ferme pas", "Les deux bras du rouleau doivent être bien enfoncés dans leurs encoches."], ["Le papier sort de travers", "Coupez le bout abîmé aux ciseaux, remettez-le droit contre le guide et refermez."]] },
    { k: "wifi", ill: "wifi", t: "Reliez-la au Wi-Fi", s: ql ? "Le plus simple : le bouton WPS de votre box." : "Reliez-la au Wi-Fi du restaurant avec l'application du fabricant.",
      b: q810 ? ["Appuyez sur WPS sur la box, puis dans les 2 minutes, maintenez le bouton Wi-Fi de l'imprimante 5 secondes.", "Le voyant Wi-Fi clignote, puis reste allumé : c'est connecté."]
        : M.id === "ql820nwb" ? ["Appuyez sur WPS sur la box, puis dans les 2 minutes, lancez WPS depuis le menu WLAN de l'imprimante.", "L'icône Wi-Fi de l'écran reste allumée : c'est connecté."]
        : M.id === "zd421" ? ["Application gratuite Zebra Printer Setup, sur le téléphone.", "Choisissez le Wi-Fi du restaurant et tapez son mot de passe."] : ["Suivez la notice : choisissez le Wi-Fi du restaurant et son mot de passe."],
      help: [["Ma box n'a pas de bouton WPS", ql ? "Sur un ordinateur, branchez l'imprimante en USB et lancez l'assistant gratuit Brother (support.brother.com, puis votre modèle, puis Téléchargements). Choisissez le Wi-Fi du restaurant et tapez son mot de passe." : "Utilisez l'application ou le logiciel du fabricant, sur un téléphone ou un ordinateur relié à l'imprimante."],
        ["Le voyant Wi-Fi clignote sans arrêt", `La connexion n'a pas abouti. Rapprochez l'imprimante de la box et recommencez.${ql ? " Elle ne capte que le Wi-Fi 2,4 GHz : si la box a deux réseaux, prenez celui en 2,4 GHz." : ""}`],
        ...(ql ? [["Le voyant Wi-Fi est éteint", "Le Wi-Fi de l'imprimante est coupé : appuyez une fois sur son bouton Wi-Fi."]] : [])] },
    { k: "phone", ill: "phone", t: "Le téléphone la voit ?", s: "Mettez le téléphone sur le même Wi-Fi que l'imprimante.",
      b: ["Pas le Wi-Fi invités, pas la 4G.", `Elle apparaîtra dans la liste « Imprimante » : AirPrint est intégré, aucune application à installer.`],
      help: [["Elle n'apparaît pas dans la liste", "Vérifiez le Wi-Fi du téléphone, attendez que le voyant Wi-Fi soit fixe, puis éteignez et rallumez l'imprimante."], ["J'imprime depuis un ordinateur", "Ajoutez-la une fois dans les réglages Imprimantes de l'ordinateur (Mac : Réglages Système, Imprimantes. Windows : installez le pilote Brother)."]] },
    { k: "rolls", ill: "rolls", t: "Quel rouleau ?", s: "Choisissez le rouleau que vous venez de mettre.", b: ["Le nom est écrit sur le côté du rouleau."], body: "rolls",
      help: [["Je ne trouve pas le nom", "Il est imprimé sur le carton et sur le côté du rouleau, par exemple DK-11209. Le 62 × 29 mm prédécoupé est le plus courant."]] },
    { k: "test", ill: "test", t: "Imprimez un test", s: `Touchez Imprimer, choisissez ${q810 ? "Brother QL-810W" : nm}, puis Imprimer.`, b: [`Format papier : ${lbFmtTx(roll)}.`, "Le téléphone retient ce choix pour la suite."], body: "test", noNext: true,
      help: [["La fenêtre d'impression ne s'ouvre pas", "Sur iPhone, ouvrez Growth Gusto dans Safari ou depuis son icône sur l'écran d'accueil. Sinon, réglez « Comment imprimer » sur Image à enregistrer, plus bas."]] },
    { k: "scan", ill: "scan", t: "Scannez l'étiquette", s: "Visez le QR de l'étiquette qui vient de sortir.", b: ["Le bip confirme que tout fonctionne."], body: "scan", noNext: true,
      help: [["Le QR ne se lit pas", "Approchez à 10 cm, évitez les reflets et gardez le téléphone immobile. Une étiquette pâle ou rayée : vérifiez le rouleau (étape 2)."], ["Pas de caméra", "Tapez le code imprimé sous le QR : GG-TEST01."]] },
  ];
}
const lbwStepsN = () => lbwSteps().length;
function lbwBodyHTML(S1) {
  if (S1.body === "rolls") { const c = lbPrinterCfg(); return `<div class="lbw-rolls">${LB_ROLLS.map((r) => `<button class="lbw-roll ${c.roll === r.id ? "on" : ""}" data-act="printerRoll" data-v="${r.id}" aria-pressed="${c.roll === r.id}">${lbRollVis(r)}<span class="tx"><b>${r.name}${r.rec ? ` <i>Conseillé</i>` : ""}</b><em>${r.t}</em></span>${lbSel(c.roll === r.id)}</button>`).join("")}</div>`; }
  if (S1.body === "test") return `<button class="btn acc block lbw-print" data-act="lbPrintTest">${ico("printer")}Imprimer l'étiquette test</button>
    <div class="lbw-q ${LBW.printed ? "on" : ""}"><b>L'étiquette est bien sortie ?</b><div class="lbw-yn"><button class="btn soft" data-act="lbwNo">Non</button><button class="btn acc" data-act="lbwYes">Oui</button></div></div>
    <div class="lbw-fail" ${LBW.fail ? "" : "hidden"}><b>Voyons ça ensemble</b>${lbFaqHtml(true)}<button class="btn soft block" data-act="lbPrintTest">${ico("printer")}Réessayer</button></div>`;
  if (S1.body === "scan") return lbScanTestHTML(true);
  return "";
}
function lbwStepHTML(i, dir) {
  const st = lbwSteps(); const N = st.length;
  if (i >= N) return lbwDoneHTML(dir);
  const s = st[i];
  return `<div class="lbw-card ${dir ? "in-" + dir : ""}" data-k="${s.k}">
    <div class="lbw-art">${LB_ILL[s.ill]()}</div>
    <div class="lbw-tx"><b class="lbw-t">${s.t}</b><p class="lbw-s">${s.s}</p>${s.b && s.b.length ? `<ul class="lbw-b">${s.b.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}</div>
    ${s.body ? `<div class="lbw-body">${lbwBodyHTML(s)}</div>` : ""}
    <div class="lbw-act">${i ? `<button class="btn soft lbw-back" data-act="lbwBack">${ico("back")}Retour</button>` : ""}${s.noNext ? (s.k === "scan" ? `<button class="btn ${LBT.done ? "acc" : "soft"} lbw-next" data-act="lbwFinish" data-lbt="fin">${LBT.done ? "Terminer" : "Plus tard"}</button>` : "") : `<button class="btn acc lbw-next" data-act="lbwNext">C'est fait${ico("chev")}</button>`}</div>
    ${s.help && s.help.length ? `<details class="lbw-help"><summary>${ico("alert")}Ça ne marche pas ?${ico("chev")}</summary>${s.help.map(([q, a]) => `<div class="lbw-h"><b>${q}</b><p>${a}</p></div>`).join("")}</details>` : ""}
  </div>`;
}
function lbwDoneHTML(dir) {
  const c = lbPrinterCfg(); const roll = lbRoll();
  return `<div class="lbw-card lbw-done ${dir ? "in-" + dir : ""}" data-k="done"><div class="lbw-sealw">${lbSealSvg()}</div>
    <div class="lbw-tx" style="text-align:center"><b class="lbw-t">Votre imprimante est prête</b><p class="lbw-s">${esc(c.name || "Imprimante")} · ${esc(roll.name)} ${roll.t}</p></div>
    <div class="lbw-sum"><span>Étiquette test<b>imprimée</b></span><span>Scan<b>${c.scanOk ? "réussi" : "à tester"}</b></span></div>
    ${LBW.opts.embedded ? "" : `<button class="btn soft block" data-act="lbwRedo">${ico("lbUndo")}Refaire la configuration</button>`}</div>`;
}
const lbwDots = (i, N) => `${Array.from({ length: N }, (_, k) => `<button class="lbw-dot ${k < i ? "done" : k === i ? "on" : ""}" data-act="lbwGo" data-v="${k}" aria-label="Étape ${k + 1}"></button>`).join("")}`;
function lbwAltHTML() {
  const c = lbPrinterCfg();
  return `<div class="lbw-alt" ${LBW.alt ? "" : "hidden"}><div class="chips lb-obchips">${LB_MODELS.map((m) => `<button class="chip ${c.model === m.id || (!c.model && m.id === "ql810wc") ? "on" : ""}" data-act="printerSet" data-v="${m.id}">${m.name}</button>`).join("")}</div></div>`;
}
function lbWizardHTML(opts = {}) {
  LBW.opts = opts || {}; if (typeof opts.step === "number") LBW.step = opts.step;
  const N = lbwStepsN(); if (lbWizardDone() && !LBW.open && LBW.step < N && !opts.restart) LBW.step = N;
  if (!lbWizardDone() && LBW.step >= N) LBW.step = 0;
  const i = Math.min(LBW.step, N); const M = lbModel();
  return `<div class="lbw ${opts.embedded ? "emb" : ""}" data-lbw>
    <div class="lbw-head"><span class="lbw-count" data-lbw="count">${i < N ? `Étape ${i + 1} sur ${N}` : "Terminé"}</span><div class="lbw-dots" data-lbw="dots">${lbwDots(i, N)}</div></div>
    <div class="lbw-stage" data-lbw="stage">${lbwStepHTML(i)}</div>
    <div class="lbw-foot"><button class="lbw-link" data-act="lbwAlt"><span data-lb="mname">${LBW.alt ? "Choisissez votre imprimante" : "Ce n'est pas cette imprimante ?"}</span></button>${lbwAltHTML()}</div>
  </div>`;
}
window.lbWizardHTML = lbWizardHTML;
/* repaint every wizard on screen, sliding the new step in */
function lbwPaint(dir) {
  const N = lbwStepsN(); const i = Math.min(LBW.step, N);
  $$("[data-lbw=stage]").forEach((st) => { st.innerHTML = lbwStepHTML(i, dir); if (dir) { const w = st.closest("[data-lbw]"); const top = w && w.getBoundingClientRect().top; if (top != null && top < 60) w.scrollIntoView({ block: "start", behavior: "smooth" }); } });
  $$("[data-lbw=count]").forEach((e) => (e.textContent = i < N ? `Étape ${i + 1} sur ${N}` : "Terminé"));
  $$("[data-lbw=dots]").forEach((e) => (e.innerHTML = lbwDots(i, N)));
  $$("[data-lbw] .lbw-alt").forEach((e) => (e.outerHTML = lbwAltHTML()));
  $$("[data-lb=mname]").forEach((e) => (e.textContent = LBW.alt ? "Choisissez votre imprimante" : "Ce n'est pas cette imprimante ?"));
  if (i === N) { setTimeout(() => { const s = $("[data-lbw] .lbw-done .lb-seal"); if (s && dir) { SFX.done(); buzz([12, 40, 18]); const r = s.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); } }, 260); }
  if (LBW.step === lbwSteps().findIndex((s) => s.k === "scan")) setTimeout(() => { if (lbtBox() && !LBT.done) lbtStart(); }, 450);
  lbStatusPatch();
}
function lbwGo(i, dir) { const N = lbwStepsN(); i = Math.max(0, Math.min(N, i)); if (i === LBW.step) return; if (i !== lbwSteps().findIndex((s) => s.k === "test")) LBW.fail = false; LBW.step = i; lbwPaint(dir || "r"); }
function lbwFinish() {
  LBW.open = false; lbwGo(lbwStepsN(), "r");
  try { if (typeof LBW.opts.onDone === "function") LBW.opts.onDone(); } catch (e) { console.warn(e); }
  document.dispatchEvent(new CustomEvent("lb:printer", { detail: { done: true, scan: !!lbPrinterCfg().scanOk } }));
}

/* ───────────── test du scan (après l'impression) : la caméra lit l'étiquette test ───────────── */
const LBT = { stream: null, own: false, raf: 0, state: "off", done: false, last: 0, cv: null, cool: 0 };
const lbtBox = () => $$("[data-lbt=box]").filter((b) => b.isConnected && b.offsetParent !== null).pop() || null;
function lbtMsg() {
  const st = LBT.state;
  if (st === "starting") return `<span class="lb-spin"></span>`;
  if (st === "denied") return `<b>Caméra bloquée</b><span>Autorisez-la dans les réglages du navigateur, ou tapez le code ci-dessous.</span><button class="btn acc sm" data-act="lbtCam">Réessayer</button>`;
  if (st === "nocam") return `<b>Pas de caméra ici</b><span>Tapez le code imprimé sous le QR.</span>`;
  if (st === "live") return "";
  return `<button class="lbt-start" data-act="lbtCam"><span>${ico("camera")}</span><b>Activer la caméra</b></button>`;
}
function lbScanTestHTML(inWizard) {
  return `<div class="lbt ${LBT.done ? "ok" : ""}" data-lbt="box" data-state="${LBT.done ? "ok" : LBT.stream ? "live" : LBT.state === "live" ? "off" : LBT.state}">
    <div class="lbt-cam"><video playsinline muted autoplay></video><div class="lbt-vf"><i></i><i></i><i></i><i></i><b></b></div><div class="lbt-msg">${LBT.done ? "" : lbtMsg()}</div>
      <div class="lbt-win"><div class="lbt-sealw">${lbSealSvg()}</div><b>Tout fonctionne</b><span>Impression et scan validés.</span></div></div>
    <form class="lbt-code" data-lb="tcode" novalidate><input class="input mono" placeholder="${LB_TESTCODE}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Code sous le QR"><button class="btn soft sm" type="submit">OK</button></form>
    ${inWizard ? "" : `<p class="note lbt-note">Imprimez d'abord une étiquette test, puis visez son QR.</p>`}</div>`;
}
function lbtSetState(st) {
  LBT.state = st; const b = lbtBox(); if (!b) return; if (LBT.done) return;
  b.dataset.state = st; const m = $(".lbt-msg", b); if (m) m.innerHTML = lbtMsg();
}
async function lbtStart() {
  const box = lbtBox(); if (!box || LBT.done) return;
  if (LBT.stream) { lbtAttach(); return; }
  if (LB.stream && LB.track && LB.track.readyState === "live" && S.route !== "scan") { clearTimeout(LB.parkT); LB.track.enabled = true; LBT.stream = LB.stream; LBT.own = false; }
  else {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { lbtSetState("nocam"); return; }
    lbtSetState("starting");
    try { LBT.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }); LBT.own = true; }
    catch (e) { const n = e && e.name; lbtSetState(n === "NotAllowedError" || n === "SecurityError" ? "denied" : "nocam"); return; }
    if (!lbtBox()) { lbtStop(); return; }
  }
  lbtAttach();
}
function lbtAttach() {
  const b = lbtBox(); if (!b) return; const v = $("video", b); if (v.srcObject !== LBT.stream) { v.srcObject = LBT.stream; v.play().catch(() => {}); }
  lbtSetState("live"); if (!LBT.raf) LBT.raf = requestAnimationFrame(lbtLoop);
}
/* stop: the stream goes back to the main scanner « parked » (no new camera prompt on iPhone) */
function lbtStop() {
  cancelAnimationFrame(LBT.raf); LBT.raf = 0; const s = LBT.stream; LBT.stream = null; if (LBT.state === "live" || LBT.state === "starting") LBT.state = "off";
  if (!s || S.route === "scan") return;
  const t = s.getVideoTracks()[0];
  if (!LBT.own || !LB.stream) { if (t && t.readyState === "live") { if (LBT.own) { LB.stream = s; LB.track = t; } t.enabled = false; LB.parked = true; clearTimeout(LB.parkT); LB.parkT = setTimeout(() => lbStop(true), 10 * 60 * 1000); } }
  else s.getTracks().forEach((x) => { try { x.stop(); } catch (e) {} });
}
function lbtLoop() {
  LBT.raf = requestAnimationFrame(lbtLoop);
  const b = lbtBox(); if (!b || document.hidden || LBT.done) { lbtStop(); return; }
  const v = $("video", b); if (v.srcObject !== LBT.stream) { v.srcObject = LBT.stream; v.play().catch(() => {}); }
  const now = performance.now(); if (now - LBT.last < 110 || now < LBT.cool || v.readyState < 2 || !v.videoWidth || !window.jsQR) return; LBT.last = now;
  const vw = v.videoWidth, vh = v.videoHeight, side = Math.min(vw, vh) * 0.9, sx = (vw - side) / 2, sy = (vh - side) / 2, N = 400;
  const cv = LBT.cv || (LBT.cv = document.createElement("canvas")); if (cv.width !== N) { cv.width = N; cv.height = N; }
  const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(v, sx, sy, side, side, 0, 0, N, N);
  let r = null; try { r = jsQR(g.getImageData(0, 0, N, N).data, N, N, { inversionAttempts: "dontInvert" }); } catch (e) {}
  if (r && r.data) lbtCheck(r.data);
}
function lbtCheck(raw, typed) {
  const code = lbParseCode(raw); const b = lbtBox(); const l = code !== LB_TESTCODE ? lbFind(raw) : null;
  if (code === LB_TESTCODE || l) { lbtWin(l); return; }
  LBT.cool = performance.now() + 1500; SFX.err(); buzz([30, 40, 30]);
  if (b) { b.classList.remove("miss"); void b.offsetWidth; b.classList.add("miss"); setTimeout(() => b.classList.remove("miss"), 700); }
  toast(/^GG-/.test(code) ? `Code ${code} inconnu : visez l'étiquette test` : typed ? "Tapez le code sous le QR, par exemple GG-TEST01" : "Ce QR n'est pas une étiquette Growth Gusto", "err");
}
async function lbtWin(l) {
  LBT.done = true; lbtStop(); SFX.scan(); buzz([14, 50, 20]);
  $$("[data-lbt=box]").forEach((b) => { b.classList.add("ok"); b.dataset.state = "ok"; });
  setTimeout(() => { SFX.done(); const s = $("[data-lbt=box].ok .lbt-sealw"); if (s) { const r = s.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); } }, 380);
  $$("[data-lbt=fin]").forEach((x) => { x.textContent = "Terminer"; x.classList.remove("soft"); x.classList.add("acc", "lbw-pop"); });
  if (l) toast(`Étiquette de ${l.name} reconnue`);
  await lbPrinterSave({ scanOk: Date.now(), ...(lbPrinterCfg().ok ? {} : { ok: Date.now() }) });
  logEvent("lot", "a validé le scan d'une étiquette test"); lbStatusPatch();
}
document.addEventListener("submit", (e) => { const f = e.target; if (!f.dataset || f.dataset.lb !== "tcode") return; e.preventDefault(); const i = $("input", f); const v = (i && i.value || "").trim(); if (!v) { i && i.focus(); return; } if (i) i.blur(); lbtCheck(v, true); });
document.addEventListener("visibilitychange", () => { if (document.hidden) lbtStop(); });

/* ───────────── choix du design de l'étiquette ───────────── */
const lbsOpt = (k, label, vals) => { const st = lbStyle(); return `<div class="lbs-row"><span class="lbs-l">${label}</span><div class="lbs-seg" role="radiogroup">${vals.map(([v, t]) => `<button class="${st[k] === v ? "on" : ""}" data-act="lbStyleOpt" data-id="${k}" data-v="${v}" role="radio" aria-checked="${st[k] === v}">${t}</button>`).join("")}</div></div>`; };
const lbsTog = (k, label) => { const on = lbStyle()[k]; return `<button class="lbs-tog ${on ? "on" : ""}" data-act="lbStyleOpt" data-id="${k}" data-v="${on ? 0 : 1}" role="switch" aria-checked="${on}"><span>${label}</span><span class="lb-sw ${on ? "on" : ""}"><i></i></span></button>`; };
function lbsCustHTML() {
  const st = lbStyle(); const P = LB_STYLES.find((p) => p.id === st.preset);
  return `${lbsOpt("dlc", "Taille de la DLC", [[1, "Petite"], [2, "Normale"], [3, "Grande"], [4, "Géante"]])}
    ${lbsOpt("qr", "QR code", [[0, "Sans"], [1, "Petit"], [2, "Normal"], [3, "Grand"]])}
    <p class="lbs-warn" ${st.qr ? "hidden" : ""}>Sans QR, l'étiquette ne se scanne plus : il reste le code à taper.</p>
    ${lbsOpt("txt", "Taille du texte", [[1, "Petit"], [2, "Normal"], [3, "Grand"]])}
    <div class="lbs-togs">${lbsTog("dates", "Date de réception ou d'ouverture")}${lbsTog("lot", "Numéro de lot")}${lbsTog("alg", "Allergènes")}${lbsTog("qty", "Quantité et fournisseur")}${lbsTog("brand", "Nom et logo du restaurant")}${lbsTog("code", "Code sous le texte")}</div>
    <button class="btn soft sm lbs-reset" data-act="lbStyleReset" ${st.custom ? "" : "disabled"}>${ico("lbUndo")}Revenir au modèle « ${esc(P.name)} »</button>`;
}
function lbStylePickerHTML(opts = {}) {
  const st = lbStyle(); const roll = lbRoll(); const demo = lbDemoLot();
  return `<div class="lbs" data-lbs>
    <div class="lbs-grid">${LB_STYLES.map((p) => { const on = st.preset === p.id; return `<button class="lbs-opt ${on ? "on" : ""}" data-act="lbStyleSet" data-v="${p.id}" aria-pressed="${on}"><span class="lbs-prev">${lbTagHtml(demo, roll, lbStyle({ preset: p.id }))}</span><span class="lbs-nm"><b>${p.name}</b>${lbSel(on)}</span><em>${p.d}</em></button>`; }).join("")}</div>
    <details class="lbs-cust" ${opts.open ? "open" : ""}><summary><span class="ic">${ico("sliders")}</span><span class="tx"><b>Personnaliser</b><em data-lbs="ctx">${st.custom ? "Modifié à votre façon" : "Choisissez ce qui s'affiche"}</em></span>${ico("chev")}</summary>
      <div class="lbs-live"><div class="lb-roll" data-lb="sprev">${lbTagHtml(demo, roll, st)}</div><p class="note" data-lb="sfmt">Taille réelle du rouleau ${esc(roll.name)} · ${roll.t}</p></div>
      <div class="lbs-ctl" data-lbs="ctl">${lbsCustHTML()}</div></details></div>`;
}
window.lbStylePickerHTML = lbStylePickerHTML;
/* restyle every label on screen, no re-render */
function lbStylePatch(all) {
  const st = lbStyle(); const roll = lbRoll(); const demo = lbDemoLot();
  $$("[data-act=lbStyleSet]").forEach((b) => { const on = b.dataset.v === st.preset; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); const s = $(".lb-sel", b); if (s) s.classList.toggle("on", on); if (all) { const p = $(".lbs-prev", b); if (p) p.innerHTML = lbTagHtml(demo, roll, lbStyle({ preset: b.dataset.v })); } });
  $$("[data-lb=sprev],[data-lb=prev]").forEach((e) => { e.innerHTML = lbTagHtml(demo, roll, st); const t = $(".lb-tag", e); if (t && !all) { t.classList.add("lbs-bump"); } });
  $$("[data-lb=sfmt]").forEach((e) => (e.textContent = `Taille réelle du rouleau ${roll.name} · ${roll.t}`));
  $$("[data-lbs=ctl]").forEach((e) => (e.innerHTML = lbsCustHTML()));
  $$("[data-lbs=ctx]").forEach((e) => (e.textContent = st.custom ? "Modifié à votre façon" : "Choisissez ce qui s'affiche"));
  /* an open label sheet follows too */
  const pa = $("#prAnim .lb-paper"); if (pa && pa.dataset.ids) { const lots = pa.dataset.ids.split(",").map((i) => lbLot(i)).filter(Boolean); if (lots.length) pa.innerHTML = lots.map((l) => lbTagHtml(l, roll, st)).join(""); }
}
async function lbStyleSave(v) { if (S.resto) S.resto.labelStyle = v; lbStylePatch(); await safe(DB.update("restos", S.rid, { labelStyle: v })); }

/* status at the top of the Imprimante screen */
function lbStatusHTML() {
  const c = lbPrinterCfg(); const ok = lbWizardDone(); const roll = lbRoll();
  return `<div class="lbx-st ${ok ? "ok" : "todo"}" data-lb="status"><span class="lbx-pi">${ico("printer")}</span><div class="tx"><b>${esc(c.name || "Brother QL-810Wc")}</b><em>${esc(roll.name)} · ${roll.t}</em></div>
    <span class="lbx-badge">${ok ? `<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>Configurée` : "Pas encore configurée"}</span></div>`;
}
function lbStatusPatch() { $$("[data-lb=status]").forEach((e) => (e.outerHTML = lbStatusHTML())); }

Object.assign(ACT, {
  lbwNext: () => { SFX.tap(); buzz(6); lbwGo(LBW.step + 1, "r"); },
  lbwBack: () => { SFX.tap(); lbwGo(LBW.step - 1, "l"); },
  lbwGo: (a, id, v) => { const i = +v; if (!(i < LBW.step || lbWizardDone())) return; SFX.tick(); lbwGo(i, i < LBW.step ? "l" : "r"); },
  lbwYes: async () => {
    LBW.fail = false; await lbPrinterSave({ ok: Date.now(), model: lbPrinterCfg().model || "ql810wc" });
    if (lbTestMode()) await safe(DB.update("restos", S.rid, { printTest: false }));
    SFX.ok(); buzz([10, 30, 10]); LBT.done = false; lbwGo(LBW.step + 1, "r"); lbPrinterPatch();
  },
  lbwNo: () => {
    LBW.fail = true; SFX.tap(); const f = $$("[data-lbw] .lbw-fail"); f.forEach((x) => { x.hidden = false; x.classList.remove("lbw-pop"); void x.offsetWidth; x.classList.add("lbw-pop"); const d = $("details", x); if (d) d.open = true; });
    if (f[0]) setTimeout(() => f[0].scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  },
  lbwAlt: () => { LBW.alt = !LBW.alt; SFX.tick(); $$("[data-lbw] .lbw-alt").forEach((e) => (e.hidden = !LBW.alt)); $$("[data-lb=mname]").forEach((e) => (e.textContent = LBW.alt ? "Choisissez votre imprimante" : "Ce n'est pas cette imprimante ?")); },
  lbwRedo: () => { LBW.open = true; $$("[data-lb=wizwrap]").forEach((e) => e.classList.remove("closed")); LBW.step = 0; LBW.fail = false; LBW.printed = false; LBT.done = false; SFX.tap(); lbStatusPatch(); lbwPaint("r"); const w = $("[data-lbw]"); if (w) setTimeout(() => w.scrollIntoView({ block: "start", behavior: "smooth" }), 80); },
  lbwFinish: () => { SFX.tap(); lbwFinish(); },
  lbtCam: () => { SFX.tap(); LBT.state = "off"; lbtStart(); },
  lbScanTest: () => {
    SFX.tap(); LBT.done = false; LBT.state = "off";
    openSheet(`<div class="lbt-sheet"><div style="text-align:center"><div class="h2" style="font-size:20px">Tester le scan</div><div class="sub">Visez le QR de l'étiquette test imprimée</div></div>${lbScanTestHTML()}<button class="btn soft block" data-act="lbPrintTest">${ico("printer")}Imprimer une étiquette test</button></div>`);
    setTimeout(lbtStart, 380);
  },
  lbStyleSet: (a, id, v) => { if (!LB_STYLES.some((p) => p.id === v)) return; SFX.tick(); buzz(6); lbStyleSave({ preset: v }); a.classList.remove("lbs-pop"); void a.offsetWidth; a.classList.add("lbs-pop"); },
  lbStyleOpt: (a, k, v) => {
    if (!LB_SKEYS.includes(k)) return; const st = lbStyle(); const P = LB_STYLES.find((p) => p.id === st.preset);
    const nv = typeof P.v[k] === "boolean" ? v === "1" : +v; const o = { preset: st.preset }; LB_SKEYS.forEach((x) => { const val = x === k ? nv : st[x]; if (val !== P.v[x]) o[x] = val; });
    SFX.tick(); buzz(5); lbStyleSave(o);
  },
  lbStyleReset: () => { SFX.tap(); lbStyleSave({ preset: lbStyle().preset }); },
});
/* the system print dialog was used from the wizard: ask « bien sortie ? » */
function lbwAfterPrint() { LBW.printed = true; $$("[data-lbw] .lbw-q").forEach((q) => { q.classList.add("on"); q.classList.remove("lbw-pop"); void q.offsetWidth; q.classList.add("lbw-pop"); }); }
/* the onboarding (js/onboard.js) calls this when defined: it is the step-by-step wizard */
function lbPrinterStepHTML() { return lbWizardHTML({ embedded: true }); }
window.lbPrinterStepHTML = lbPrinterStepHTML;

/* ───────────── imprimante ───────────── */
VIEWS.imprimante = {
  live: false,
  render() {
    const c = lbPrinterCfg(); const test = lbTestMode(); const closed = lbWizardDone() && !LBW.open; const wiz = lbWizardHTML({}); LBW.open = false;
    return `<div class="inner narrow lb-print">${topBar("Imprimante")}<div class="lb-pgrid"><div class="lb-pcol">
      <div class="glass pad st lbx-hero" style="--i:1">${lbStatusHTML()}
        <div class="lbx-tests"><button class="btn acc" data-act="lbPrintTest">${ico("printer")}Imprimer un test</button><button class="btn soft" data-act="lbScanTest">${ico("scan")}Tester le scan</button></div>
        <p class="note lb-last" data-lb="last">${esc(lbLastPrintTx())}</p></div>
      <div class="glass pad st lbx-wiz ${closed ? "closed" : ""}" style="--i:2" data-lb="wizwrap"><span class="lbl">Installation pas à pas</span>
        <div class="li tap lbx-redo" data-act="lbwRedo" role="button" tabindex="0"><span class="ic">${ico("lbUndo")}</span><div class="tx"><b>Refaire la configuration</b><em>7 étapes illustrées, 3 minutes</em></div>${ico("chev")}</div>
        <div class="lbx-wbody">${wiz}</div></div>
    </div><div class="lb-pcol">
      <div class="glass pad st" style="--i:3"><span class="lbl">Design de l'étiquette</span>${lbStylePickerHTML()}</div>
      <div class="glass pad st" style="--i:4"><span class="lbl">Rouleau</span>
        <div class="lbx-rolls">${LB_ROLLS.map((r) => `<button class="lbw-roll ${c.roll === r.id ? "on" : ""}" data-act="printerRoll" data-v="${r.id}" aria-pressed="${c.roll === r.id}">${lbRollVis(r)}<span class="tx"><b>${r.name}${r.rec ? ` <i>Conseillé</i>` : ""}</b><em>${r.t}</em></span>${lbSel(c.roll === r.id)}</button>`).join("")}</div>
        <span class="lbl">Comment imprimer</span>
        <div class="seg lb-mseg" style="margin-top:10px"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${c.mode === "image" ? 100 : 0}%)"></span><button class="${c.mode === "airprint" ? "on" : ""}" data-act="printerMode" data-v="airprint">Fenêtre d'impression</button><button class="${c.mode === "image" ? "on" : ""}" data-act="printerMode" data-v="image">Image à enregistrer</button></div>
        <p class="note" style="margin:10px 0 0">Fenêtre d'impression : le téléphone envoie l'étiquette par le Wi-Fi (AirPrint). Image : vous l'enregistrez et l'imprimez vous-même.</p></div>
      <div class="glass pad st lb-testcard ${test ? "on" : ""}" style="--i:5">
        <div class="li tap" data-act="lbTestMode" style="padding:0" role="switch" aria-checked="${test}" tabindex="0"><span class="ic">${ico("sparkle")}</span><div class="tx"><b>Mode test sans imprimante</b><em>${test ? "Activé" : "Désactivé"}</em></div><span class="lb-sw ${test ? "on" : ""}"><i></i></span></div>
        <p class="note" style="margin:12px 0 0">Les étiquettes s'affichent <b>à l'écran</b> : un autre téléphone peut scanner le QR.</p>
        <button class="btn soft block" style="margin-top:14px" data-act="lbTestLabel">${ico("qr")}Créer une étiquette test à l'écran</button></div>
      <div class="glass pad st" style="--i:6"><span class="lbl">En cas de souci</span><div class="lb-faqs">${lbFaqHtml()}</div></div>
    </div></div></div>`;
  },
};

/* ═════════════ Service : mise en place (chambre froide → frigo de service) et retour ═════════════
   A partial move splits the lot: the original keeps the rest, the child keeps code, DLC and traceability (parentLotId).
   Every move writes a « moves » doc (kind transfert, qty 0 on stock) and an event; one undo reverses a whole action. */
Object.assign(IC, {
  svcGo: ["M3 12h13", "m11 6 6 6-6 6", "M21 4v16"],
  svcBack: ["M21 12H8", "m13 6-6 6 6 6", "M3 4v16"],
  svcCounter: ["r:2,8,20,13,2.5", "M2 5h20", "M12 8v13", "M8.5 13h1", "M14.5 13h1", "f:M2 8h20v13H2z"],
});
const SVC = { rid: null, pref: null, over: {} };
const svcNum = (l) => { const n = num(l && l.qty); return n != null && n > 0 ? n : null; };
const svcStr = (n) => String(Math.round(n * 1000) / 1000).replace(".", ",");
const svcDec = (n) => (n % 1 ? (Math.round(n * 10) === n * 10 ? 1 : 2) : 0);
const svcQtyTx = (n, u) => (n == null ? "" : `${fmt(n, svcDec(n))}${u ? " " + (typeof relUnit === "function" ? relUnit(n, u) : u) : ""}`);
const svcFridges = () => S.fridges.filter((f) => relIsService(f));
/* where things come back to: chambres froides first, then the other fridges (never a service fridge) */
const svcStores = () => S.fridges.filter((f) => !relIsService(f)).sort((a, b) => (relTypeOf(a).k === "cfp" ? 0 : 1) - (relTypeOf(b).k === "cfp" ? 0 : 1));
const svcIn = (l) => !!l && relIsService(relFr(l.fridgeId));
const svcInService = () => activeLots().filter(svcIn);
const svcMin = (l) => (l && l.svcAt ? Math.max(0, Math.round((Date.now() - l.svcAt) / 60000)) : null);
const svcDur = (m) => (m == null ? "" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? " " + pad(m % 60) : ""}`);
/* HACCP: a product should not stay long above 4 °C. Under 2 h fine, 2 to 4 h « bientôt », beyond « à remettre au froid » */
const svcTone = (m) => (m == null ? "neu" : m < 120 ? "ok" : m < 240 ? "warn" : "bad");
function svcDwellPill(l) { const m = svcMin(l); if (m == null) return ""; return `<span class="pill ${svcTone(m)} svc-dw" title="En frigo de service depuis ${hm(l.svcAt)}">${ico("clock")}${svcDur(m)}</span>`; }
/* a fresh copy of a lot, including the writes this session just made (the db may not have echoed them yet) */
function svcGet(id) { const l = S.lots.find((x) => x.id === id); const o = SVC.over[id]; return l ? (o && Date.now() - o.t < 15000 ? { ...l, ...o.p } : l) : null; }
async function svcUpd(id, patch) { await safe(DB.update("lots", id, patch)); const o = SVC.over[id]; SVC.over[id] = { t: Date.now(), p: { ...(o && Date.now() - o.t < 15000 ? o.p : {}), ...patch } }; }
const svcStrip = (l) => { const { id, ...d } = l; return d; };

/* device preferences: direction, destinations, ask for quantity (remembered per restaurant) */
function svcPref() {
  if (!SVC.pref || SVC.rid !== S.rid) { SVC.rid = S.rid; let p = {}; try { p = JSON.parse(localStorage.getItem("gg-svc-" + S.rid) || "{}") || {}; } catch (e) {} SVC.pref = { dir: p.dir === "ret" ? "ret" : "mep", to: p.to || "", back: p.back || "orig", ask: p.ask !== false, last: p.last || {} }; }
  return SVC.pref;
}
function svcSave(patch) { Object.assign(svcPref(), patch); try { localStorage.setItem("gg-svc-" + S.rid, JSON.stringify(SVC.pref)); } catch (e) {} }
function svcTo() { const fs = svcFridges(); const p = svcPref(); return (fs.find((f) => f.id === p.to) || fs[0] || {}).id || ""; }
function svcBackPref() { const p = svcPref(); return p.back === "orig" || svcStores().some((f) => f.id === p.back) ? p.back : "orig"; }
/* the cold room a lot goes back to: the chosen one, or the one it came from */
function svcBackFor(l) {
  const p = svcBackPref(); if (p !== "orig") return p;
  const ok = (id) => id && relFr(id) && !relIsService(relFr(id));
  if (ok(l.svcFrom)) return l.svcFrom;
  const par = l.parentLotId && S.lots.find((x) => x.id === l.parentLotId); if (par && ok(par.fridgeId)) return par.fridgeId;
  return (svcStores()[0] || {}).id || "";
}
/* same label, other parts of the lot (split children, or the parent) */
function svcSiblings(l) { const c = (l.code || "").toUpperCase(); return c ? activeLots().filter((x) => x.id !== l.id && (x.code || "").toUpperCase() === c) : []; }

function svcNewUndo(label) { return { label, lots: [], created: [], moves: [], evs: [], n: 0, at: Date.now() }; }
async function svcEv(U, text, ref, ref2) { try { const id = await DB.add("events", { type: "lot", text, at: Date.now(), uid: S.me.id, ref, ...(ref2 ? { ref2 } : {}) }); U.evs.push(id); } catch (e) {} }
const svcKeep = (U, l) => { if (!U.lots.some((x) => x.id === l.id)) U.lots.push({ id: l.id, prev: svcStrip(l) }); };

/* move `qty` (null = all) of a lot to another fridge. Returns the id of the lot that now sits in `toId`. */
async function svcMove(l0, toId, qty, U, note) {
  const l = svcGet(l0.id) || l0; const from = l.fridgeId; const toF = relFr(toId), fromF = relFr(from);
  if (!toF || toId === from) return null;
  const now = Date.now(), have = svcNum(l);
  const part = have != null && qty != null && qty > 0 && qty < have - 1e-9;
  const amt = part ? qty : have;
  const toSvc = relIsService(toF), fromSvc = relIsService(fromF);
  const dir = toSvc && !fromSvc ? "mep" : fromSvc && !toSvc ? "ret" : "move";
  const dwell = fromSvc && l.svcAt ? Math.max(0, Math.round((now - l.svcAt) / 60000)) : 0;
  const enter = toSvc && !fromSvc ? { svcAt: now, svcFrom: from } : {};
  const leave = fromSvc && !toSvc ? { svcAt: null, svcMin: (l.svcMin || 0) + dwell } : {};
  const amtTx = amt != null ? svcQtyTx(amt, l.unit) + " de " : "";
  let lotId = l.id, merged = null;
  if (part) {
    const child = { ...svcStrip(l), qty: svcStr(amt), fridgeId: toId, parentLotId: l.parentLotId || l.id, splitAt: now, splitBy: S.me.id, checkedAt: null, ...enter, ...leave };
    svcKeep(U, l);
    lotId = await safe(DB.add("lots", child)); U.created.push(lotId);
    await svcUpd(l.id, { qty: svcStr(have - amt) });
  } else {
    /* back where the original lot sits: put the rest back with it, one lot again */
    const par = dir === "ret" && l.parentLotId ? svcGet(l.parentLotId) : null;
    if (par && ["in", "opened"].includes(par.status) && par.fridgeId === toId && par.status === l.status && (par.unit || "") === (l.unit || "") && svcNum(par) != null && have != null) {
      merged = par; svcKeep(U, par); svcKeep(U, l);
      await svcUpd(par.id, { qty: svcStr(svcNum(par) + have), svcMin: Math.max(par.svcMin || 0, leave.svcMin || 0) });
      await svcUpd(l.id, { status: "merged", fridgeId: toId, mergedInto: par.id, mergedAt: now, ...leave });
    } else { svcKeep(U, l); await svcUpd(l.id, { fridgeId: toId, ...enter, ...leave }); }
  }
  try { U.moves.push(await DB.add("moves", { productId: l.productId || "", name: l.name, qty: 0, moved: amt, unit: l.unit || "", kind: "transfert", dir, fridgeId: from, toFridgeId: toId, lotId, parentLotId: part ? l.parentLotId || l.id : l.parentLotId || "", ref: lotId, refType: "lot", ...(dwell ? { dwellMin: dwell } : {}), ...(note || {}), at: now, uid: S.me.id, by: S.me.name || "" })); } catch (e) {}
  const txt = dir === "mep" ? `a mis en place ${amtTx}${l.name} dans ${toF.name} (sorti de ${fridgeName(from)}${part ? `, reste ${svcQtyTx(have - amt, l.unit)}` : ""})`
    : dir === "ret" ? `a remis ${amtTx}${l.name} en ${toF.name} après le service${dwell ? ` · ${svcDur(dwell)} en frigo de service` : ""}${merged ? " · regroupé avec le lot d'origine" : ""}`
    : `a déplacé ${amtTx}${l.name} de ${fridgeName(from)} vers ${toF.name}`;
  await svcEv(U, txt, lotId, part ? l.id : merged ? merged.id : "");
  U.n++; if (dir === "mep" && amt != null) svcSave({ last: { ...svcPref().last, [l.name]: amt } });
  return lotId;
}
/* end of service: `left` is what is really coming back (null = all). 0 = everything was used during the service. */
async function svcReturn(l0, toId, left, U) {
  const l = svcGet(l0.id) || l0; const have = svcNum(l);
  if (have != null && left != null && left < have - 1e-9) {
    const used = have - Math.max(0, left);
    if (left <= 0) {
      svcKeep(U, l); const dwell = svcMin(l) || 0;
      await svcUpd(l.id, { status: "out", outAt: Date.now(), outBy: S.me.id, usedInService: true, svcAt: null, svcMin: (l.svcMin || 0) + dwell });
      await svcEv(U, `a utilisé tout ${l.name} (${svcQtyTx(have, l.unit)}) pendant le service`, l.id); U.n++; return l.id;
    }
    svcKeep(U, l); await svcUpd(l.id, { qty: svcStr(left) });
    return svcMove({ ...l, qty: svcStr(left) }, toId, null, U, { used, usedUnit: l.unit || "" });
  }
  return svcMove(l, toId, null, U);
}
/* HACCP: an undo never erases the trace. Lots are restored, created parts are closed (status merged), moves and events are marked cancelled. */
async function svcUndo(U) {
  const now = Date.now();
  for (const x of U.lots) await DB.set("lots", x.id, x.prev).catch(() => {});
  for (const id of U.created) { const c = S.lots.find((x) => x.id === id); await DB.update("lots", id, { status: "merged", cancelled: true, mergedInto: c && c.parentLotId ? c.parentLotId : "", mergedAt: now }).catch(() => {}); }
  for (const id of U.moves) await DB.update("moves", id, { cancelled: true, cancelledAt: now, cancelledBy: S.me.id }).catch(() => {});
  for (const id of U.evs) await DB.update("events", id, { cancelled: true, cancelledAt: now, cancelledBy: S.me.id }).catch(() => {});
  const ref = (U.created[0] || (U.lots[0] && U.lots[0].id)) || "";
  await DB.add("events", { type: "lot", text: `a annulé : ${U.label}`, at: now, uid: S.me.id, ref, undoOf: U.evs[0] || "" }).catch(() => {});
  SVC.over = {};
}
function svcArmUndo(U, lotId, label, msg) { S.ui.lbUndo = { svc: U, id: lotId, label, undoTxt: U.label, at: Date.now() }; lbToastUndo(msg); }

/* ───────────── quantity sheet (« combien en sortir ? ») ───────────── */
function svcStepOf(l) { const u = (l.unit || "").toLowerCase(); const n = svcNum(l) || 0; return u === "g" ? (n >= 1000 ? 100 : 10) : u === "kg" || u === "l" ? (n >= 5 ? 0.5 : 0.1) : n % 1 ? 0.5 : 1; }
function svcDefaultQty(l) {
  const have = svcNum(l); if (have == null) return null; const last = svcPref().last[l.name];
  if (last && last < have) return last;
  const st = svcStepOf(l); const q = Math.max(st, Math.round(have / 4 / st) * st); return Math.min(have, Math.round(q * 1000) / 1000);
}
/* `src`: "scan" (keeps scanning after), "list" or "lot" (back to the product sheet) */
function svcAsk(id, toId, src) {
  const l = svcGet(id); const toF = relFr(toId); if (!l || !toF) return; const have = svcNum(l);
  S.ui.svcQ = { id, to: toId, src, q: svcDefaultQty(l), have, step: svcStepOf(l) };
  const quick = [1, 2, 3, 5, 10, 20].filter((n) => n < have && (S.ui.svcQ.step >= 1 || n <= have)).slice(0, 4);
  lbSheet(`<div class="svc-qhd"><span class="ic">${relIco(relFr(l.fridgeId))}</span><div class="tx"><b>${esc(l.name)}</b><em>${esc(fridgeName(l.fridgeId))} · ${svcQtyTx(have, l.unit)}${dlcOf(l) ? ` · DLC ${shortDate(dlcOf(l))}` : ""}</em></div></div>
    <div class="svc-route"><span>${esc(relShort(fridgeName(l.fridgeId), 22))}</span>${ico("svcGo")}<b>${esc(relShort(toF.name, 22))}</b></div>
    <div class="h2" style="font-size:21px;text-align:center">Combien en sortir ?</div>
    <div class="big svc-big"><button class="step" data-act="svcQStep" data-v="-1" aria-label="Moins">${ico("minus")}</button><div class="svc-qv"><input class="mono" id="svcQIn" inputmode="decimal" autocomplete="off" value="${fmt(S.ui.svcQ.q, svcDec(S.ui.svcQ.q))}" aria-label="Quantité"><small id="svcQU">${esc(relUnit(S.ui.svcQ.q || 0, l.unit))}</small></div><button class="step" data-act="svcQStep" data-v="1" aria-label="Plus">${ico("plus")}</button></div>
    <div class="chips svc-quick">${quick.map((n) => `<button class="chip" data-act="svcQSet" data-v="${n}">${fmt(n, svcDec(n))}</button>`).join("")}<button class="chip" data-act="svcQSet" data-v="${have}">Tout (${fmt(have, svcDec(have))})</button></div>
    <p class="note svc-rest" id="svcRest" style="text-align:center;margin:0">${svcRestTx()}</p>
    <button class="btn acc block lb-big" data-act="svcQOk">${ico("svcGo")}<span id="svcQBtn">${svcQBtnTx()}</span></button>
    ${src === "scan" ? `<button class="btn ghost block" data-act="sheetClose">Passer ce produit</button>` : `<button class="btn ghost block" data-act="${src === "lot" ? "lot" : "sheetClose"}" data-id="${id}">Annuler</button>`}`);
  SFX.sheet(); buzz(6);
}
function svcRestTx() {
  const Q = S.ui.svcQ; const l = Q && svcGet(Q.id); if (!l) return ""; const q = Q.q, have = Q.have;
  if (q == null || q <= 0) return "Choisissez une quantité.";
  if (q >= have) return `Tout le lot part en ${esc(fridgeName(Q.to))}.`;
  return `Il reste <b>${svcQtyTx(have - q, l.unit)}</b> en ${esc(fridgeName(l.fridgeId))}. Même étiquette, même DLC.`;
}
function svcQBtnTx() { const Q = S.ui.svcQ; const l = Q && svcGet(Q.id); if (!l) return ""; const v = relIsService(relFr(Q.to)) && !svcIn(l) ? "Sortir" : "Déplacer"; return Q.q >= Q.have ? `${v} tout (${svcQtyTx(Q.have, l.unit)})` : `${v} ${svcQtyTx(Q.q, l.unit)}`; }
function svcQSync(fromInput) {
  const Q = S.ui.svcQ; if (!Q) return; const i = $("#svcQIn");
  if (i && !fromInput) { i.value = fmt(Q.q, svcDec(Q.q)); i.classList.remove("bump"); void i.offsetWidth; i.classList.add("bump"); }
  const r = $("#svcRest"); if (r) r.innerHTML = svcRestTx(); const u = $("#svcQU"); const l = svcGet(Q.id); if (u && l) u.textContent = relUnit(Q.q || 0, l.unit); const b = $("#svcQBtn"); if (b) b.textContent = svcQBtnTx();
  const ok = $("[data-act=svcQOk]"); if (ok) ok.disabled = !(Q.q > 0);
}
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "svcQIn" && S.ui.svcQ) { const n = num(e.target.value); S.ui.svcQ.q = n == null ? null : Math.min(S.ui.svcQ.have, Math.max(0, n)); svcQSync(true); }
  const lf = e.target && e.target.closest && e.target.closest("[data-svcleft]");
  if (lf) { const n = num(lf.value); const l = svcGet(lf.dataset.svcleft); if (l) { S.ui.svcLeft = S.ui.svcLeft || {}; S.ui.svcLeft[l.id] = n == null ? null : Math.max(0, Math.min(svcNum(l) ?? n, n)); } }
});
/* one lot to the service fridge, whole or after asking how much */
async function svcStart(l, toId, src) {
  if (!toId) { SFX.err(); toast("Ajoutez d'abord un frigo de service dans Frigos.", "err"); return; }
  const have = svcNum(l);
  if (have != null && have > svcStepOf(l) && (src !== "scan" || svcPref().ask)) { svcAsk(l.id, toId, src); return; }
  const U = svcNewUndo(`mise en place de ${l.name}`); const nid = await svcMove(l, toId, null, U);
  svcDone(U, nid, l, null, src);
}
function svcDone(U, nid, l, q, src) {
  const nl = svcGet(nid) || l; const msg = `${q != null && svcNum(l) != null && q < svcNum(l) ? svcQtyTx(q, l.unit) + " · " : ""}${relShort(l.name, 18)} → ${relShort(fridgeName(nl.fridgeId), 18)}`;
  SFX.ok(); buzz(12);
  if (src === "scan") { closeSheet(true); lbBatchRow({ id: nid, code: l.code, name: l.name, txt: `${q != null && q < (svcNum(l) || 0) ? svcQtyTx(q, l.unit) + " · " : ""}en ${fridgeName(nl.fridgeId)}`, cls: "ok", undo: true, dlc: dlcOf(l) }); S.ui.lbUndo = { svc: U, id: nid, label: "mis en place", undoTxt: U.label, at: Date.now() }; lbRenderBatch(); return; }
  if (src === "lot") { openLot(nid); svcArmUndo(U, nid, "mis en place", msg); return; }
  closeSheet(true); svcArmUndo(U, nid, "mis en place", msg); refresh();
}
function lbBatchRow(row) { LB.batch.unshift(row); lbRenderBatch(true); const i = $("#codeIn"); if (i) i.value = ""; }

/* scan in service mode: no tap needed, the direction and the destination are already chosen */
async function svcScan(raw) {
  const code = lbParseCode(raw); const t = String(raw || "").trim();
  const all = S.lots.filter((x) => (x.code || "").toUpperCase() === code || x.id === t);
  const act = all.filter((x) => ["in", "opened"].includes(x.status));
  const dir = svcPref().dir;
  if (!all.length) { SFX.err(); buzz([30, 40, 30]); lbBatchRow({ code, name: "Code inconnu", txt: code, cls: "bad" }); return; }
  if (!act.length) { SFX.err(); buzz([30, 40, 30]); lbBatchRow({ id: all[0].id, code, name: all[0].name, txt: all[0].status === "lost" ? "Déjà noté jeté" : "Déjà sorti du stock", cls: "bad" }); return; }
  if (dir === "mep") {
    const to = svcTo(); if (!to) { SFX.err(); toast("Ajoutez d'abord un frigo de service dans Frigos.", "err"); return; }
    const src = act.filter((x) => !svcIn(x)).sort((a, b) => (svcNum(b) || 0) - (svcNum(a) || 0))[0];
    if (!src) { SFX.tick(); lbBatchRow({ id: act[0].id, code, name: act[0].name, txt: `Déjà en ${fridgeName(act[0].fridgeId)}`, cls: "warn", dlc: dlcOf(act[0]) }); return; }
    SFX.scan(); buzz(15); await svcStart(src, to, "scan"); return;
  }
  const back = act.filter(svcIn);
  if (!back.length) { SFX.tick(); lbBatchRow({ id: act[0].id, code, name: act[0].name, txt: `Déjà en ${fridgeName(act[0].fridgeId)}`, cls: "warn", dlc: dlcOf(act[0]) }); return; }
  SFX.scan(); buzz(15);
  const U = svcNewUndo(`retour de ${back[0].name} en chambre froide`); let last = null;
  for (const l of back) last = await svcReturn(l, svcBackFor(l), null, U);
  const q = back.reduce((s, l) => s + (svcNum(l) || 0), 0);
  lbBatchRow({ id: last, code, name: back[0].name, txt: `${q ? svcQtyTx(q, back[0].unit) + " · " : ""}remis en ${fridgeName(svcBackFor(back[0]))}`, cls: "ok", undo: true, dlc: dlcOf(back[0]) });
  S.ui.lbUndo = { svc: U, id: last, label: "remis en chambre froide", undoTxt: U.label, at: Date.now() }; lbRenderBatch();
}
function svcPanelHtml() {
  const p = svcPref(); const mep = p.dir === "mep"; const fs = svcFridges(); const to = svcTo(); const back = svcBackPref(); const n = svcInService().length;
  if (!fs.length) return `<div class="glass pad st" style="--i:3"><div class="empty" style="padding:6px 4px"><div class="ic">${ico("svcCounter")}</div><b>Aucun frigo de service</b>Ajoutez les frigos sous vos plans de travail : en début de service, un scan suffit pour y mettre un produit, et on le remet en chambre froide à la fin.<div style="margin-top:14px"><button class="btn acc" data-act="fridgeEdit" data-v="service">${ico("plus")}Ajouter un frigo de service</button></div></div></div>`;
  return `<div class="glass pad st svc-pan ${mep ? "mep" : "ret"}" style="--i:3">
    <div class="svc-dir" role="radiogroup" aria-label="Sens">
      <button class="svc-d mep ${mep ? "on" : ""}" data-act="svcDir" data-v="mep" role="radio" aria-checked="${mep}"><span class="svc-di">${ico("svcGo")}</span><b>Mise en place</b><em>→ frigo de service</em></button>
      <button class="svc-d ret ${mep ? "" : "on"}" data-act="svcDir" data-v="ret" role="radio" aria-checked="${!mep}"><span class="svc-di">${ico("svcBack")}</span><b>Retour</b><em>→ chambre froide</em></button>
    </div>
    <span class="lbl">${mep ? "Vers" : "Remettre dans"}</span>
    <div class="chips svc-to">${mep ? fs.map((f) => `<button class="chip ${to === f.id ? "on" : ""}" data-act="svcTo" data-v="${f.id}">${esc(f.name)}</button>`).join("") : `<button class="chip ${back === "orig" ? "on" : ""}" data-act="svcBackTo" data-v="orig">Son frigo d'origine</button>${svcBackChoices().map((f) => `<button class="chip ${back === f.id ? "on" : ""}" data-act="svcBackTo" data-v="${f.id}">${esc(f.name)}</button>`).join("")}`}</div>
    ${mep ? `<div class="li tap svc-ask" data-act="svcAskT" role="switch" aria-checked="${p.ask}" tabindex="0"><div class="tx"><b>Demander la quantité</b><em>${p.ask ? "Ex. 5 lanières sur 20 : le reste reste en chambre froide" : "Chaque scan sort tout le lot"}</em></div><span class="lb-sw ${p.ask ? "on" : ""}"><i></i></span></div>` : `<p class="note" style="margin:0">Chaque scan remet tout ce qui est en frigo de service avec cette étiquette. Pour ajuster les restes : <b>liste de retour</b>.</p>`}
    <div id="lbBatch"></div>
    <button class="btn soft block" data-go="service" data-id="${mep ? "mep" : "ret"}">${ico("list")}${mep ? "Choisir dans la liste" : `Liste de retour${n ? ` (${n})` : ""}`}</button>
  </div>`;
}
const svcHint = () => { const p = svcPref(); return p.dir === "mep" ? `Mise en place → ${relShort(fridgeName(svcTo()), 22)}` : "Retour → chambre froide"; };

/* end-of-service nudge: once per service, gently, when products have been out for long or the service is over */
let svcNudged = "";
function svcNudge() {
  if (!S.ready || !S.resto || S.route === "service" || S.route === "onboarding" || document.hidden || $("#sheet").classList.contains("open")) return;
  const ls = svcInService().filter((l) => l.svcAt); if (!ls.length) return;
  const old = Math.max(...ls.map(svcMin)); const h = new Date().getHours() + new Date().getMinutes() / 60;
  const after = (k) => ls.every((l) => { const d = new Date(l.svcAt); return d.getHours() + d.getMinutes() / 60 < k; });
  const key = dayKey() + (old >= 240 ? "|long" : h >= 15 && h < 18 && after(15) ? "|midi" : h >= 23 && after(23) ? "|soir" : "");
  if (!key.includes("|") || svcNudged === key) return; svcNudged = key;
  toast(`Fin de service ? ${ls.length} produit${ls.length > 1 ? "s" : ""} en frigo de service`, "info");
  const t = $("#toast"); $("#toastTx").innerHTML = `<span class="tx">${old >= 240 ? `${ls.length} produit${ls.length > 1 ? "s" : ""} en frigo de service depuis ${svcDur(old)}` : `Fin de service ? ${ls.length} produit${ls.length > 1 ? "s" : ""} à remettre au froid`}</span><button data-act="svcNudgeGo">Retour</button>`;
  if (typeof toastPlace === "function") toastPlace(t); t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 7000);
  SFX.tick(); buzz(8);
}
setInterval(svcNudge, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(svcNudge, 1500); });

Object.assign(ACT, {
  svcDir: (a, id, v) => { if (svcPref().dir === v) return; svcSave({ dir: v }); LB.seen = {}; LB.batch = []; SFX.tick(); buzz(6); lbSvcRepaint(); },
  svcTo: (a, id, v) => { svcSave({ to: v }); SFX.tick(); $$("[data-act=svcTo]").forEach((b) => b.classList.toggle("on", b === a)); if (S.route === "service") refresh(); else lbSvcRepaint(true); },
  svcBackTo: (a, id, v) => { svcSave({ back: v }); SFX.tick(); $$("[data-act=svcBackTo]").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); if (S.route === "service") refresh(); else lbSvcRepaint(true); },
  svcAskT: () => { svcSave({ ask: !svcPref().ask }); SFX.tick(); buzz(5); lbSvcRepaint(true); },
  svcQStep: (a, id, v) => { const Q = S.ui.svcQ; if (!Q) return; const q = Math.round(((Q.q || 0) + +v * Q.step) * 1000) / 1000; Q.q = Math.max(Q.step, Math.min(Q.have, q)); SFX.tick(); buzz(4); svcQSync(); },
  svcQSet: (a, id, v) => { const Q = S.ui.svcQ; if (!Q) return; Q.q = Math.min(Q.have, +v); SFX.tick(); buzz(4); svcQSync(); },
  svcQOk: lbOnce(async () => {
    const Q = S.ui.svcQ; if (!Q) return; const l = svcGet(Q.id); if (!l || !(Q.q > 0)) return;
    if (!["in", "opened"].includes(l.status)) { closeSheet(true); return; }
    const U = svcNewUndo(`mise en place de ${l.name}`); const q = Q.q >= Q.have ? null : Q.q;
    const nid = await svcMove(l, Q.to, q, U); S.ui.svcQ = null; if (!nid) { closeSheet(true); return; }
    svcDone(U, nid, l, q, Q.src);
  }),
  svcMep: (a, id, v) => { const l = svcGet(id); if (!l) return; SFX.tap(); svcStart(l, v || svcTo(), a.closest("#sheetBody") ? "lot" : "list"); },
  svcBackOne: lbOnce(async (a, id) => {
    const l = svcGet(id); if (!l || !svcIn(l)) return; const to = svcBackFor(l); if (!to) { SFX.err(); toast("Aucune chambre froide : ajoutez-en une dans Frigos.", "err"); return; }
    const left = S.ui.svcLeft && S.ui.svcLeft[id] != null ? S.ui.svcLeft[id] : null;
    const U = svcNewUndo(`retour de ${l.name} en chambre froide`); const nid = await svcReturn(l, to, left, U);
    if (S.ui.svcLeft) delete S.ui.svcLeft[id];
    SFX.ok(); buzz(12);
    const used = left === 0; const msg = used ? `${relShort(l.name, 20)} : tout utilisé` : `${relShort(l.name, 20)} → ${relShort(fridgeName(to), 18)}`;
    if (a.closest("#sheetBody")) { openLot(svcGet(nid) && svcGet(nid).status === "merged" ? svcGet(nid).mergedInto : nid); svcArmUndo(U, nid, "remis en chambre froide", msg); return; }
    const row = a.closest(".svc-row"); if (row) row.classList.add("svc-gone");
    svcArmUndo(U, nid, "remis en chambre froide", msg); setTimeout(refresh, row ? 300 : 0);
  }),
  svcAllBack: lbOnce(async (a, id) => {
    const ls = svcInService().filter((l) => !id || l.fridgeId === id); if (!ls.length) return;
    const U = svcNewUndo(`retour de ${ls.length} produit${ls.length > 1 ? "s" : ""} en chambre froide`); let used = 0, last = null;
    for (const l of ls) { const left = S.ui.svcLeft && S.ui.svcLeft[l.id] != null ? S.ui.svcLeft[l.id] : null; if (left === 0) used++; const to = svcBackFor(l); if (!to) continue; last = await svcReturn(l, to, left, U); }
    S.ui.svcLeft = {}; SFX.done(); buzz([12, 40, 12]); setTimeout(() => burst(), 100);
    const n = ls.length - used;
    svcArmUndo(U, last, "remis en chambre froide", `${n} produit${n > 1 ? "s" : ""} remis au froid${used ? ` · ${used} utilisé${used > 1 ? "s" : ""}` : ""}`);
    refresh();
  }),
  svcNudgeGo: () => { const t = $("#toast"); t.classList.remove("on"); t.style.pointerEvents = ""; SFX.tap(); go("service", { id: "ret" }); },
});
function lbSvcRepaint(soft) {
  const p = $("#lbPanel"); if (p && LB.mode === "svc") { p.innerHTML = lbPanelHtml(); p.classList.add("nost"); lbRenderBatch(); }
  const st = lbStageEl(); if (st) { st.classList.toggle("svc", LB.mode === "svc"); st.classList.toggle("ret", LB.mode === "svc" && svcPref().dir === "ret"); const h = $(".lb-hint", st); if (h) h.textContent = lbHintTx(); if (!soft) lbFlash(st, "hit"); }
}
const lbHintTx = () => (LB.mode === "svc" ? svcHint() : LB.mode === "multi" ? "Passez les étiquettes une par une" : "Visez le QR de l'étiquette");

/* public: open the scanner in service mode (navigates to « scan » when needed). mode = "mep" (mise en place) or "retour"/"ret" */
function lbServiceMode(mode, quiet) {
  const dir = mode === "retour" || mode === "ret" ? "ret" : "mep";
  const was = LB.mode === "svc" && svcPref().dir === dir;
  LB.mode = "svc"; svcSave({ dir }); if (!was) { LB.batch = []; LB.seen = {}; }
  if (quiet) return dir;
  if (S.route === "scan") { const p = $("#lbPanel"); if (p) { p.innerHTML = lbPanelHtml(); lbRenderBatch(); } lbSvcRepaint(true); }
  else go("scan", { mode: dir === "ret" ? "retour" : "mep" });
  return dir;
}
