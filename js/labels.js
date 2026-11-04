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
document.addEventListener("visibilitychange", () => { if (document.hidden) lbStop(); else if (S.route === "scan" && lbStageEl()) { if (!LB.raf) LB.raf = requestAnimationFrame(lbLoop); if (LB.state !== "denied") lbStart(); } else if (lbWake && $("#lbQr")) lbWakeLock(); });

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
    ${active ? `<div class="grid2">${l.status === "in" ? `<button class="btn soft lb-big" data-act="lotOpen" data-id="${id}">${ico("scissors")}Ouvrir</button>` : `<button class="btn soft lb-big" data-act="lotLabel" data-id="${id}">${ico("printer")}Étiquette</button>`}<button class="btn acc lb-big" data-act="lotOut" data-id="${id}">${ico("lbDone")}Utilisé</button></div>
      ${svcLotCta(l)}
      <div class="lb-tiles">${tile("lotMoveAsk", "move", "Déplacer")}${l.status === "in" ? tile("lotLabel", "printer", "Étiquette") : ""}${tile("lbQr", "qr", "Voir le QR")}${tile("lotLost", "trash", "Jeter", "bad")}</div>`
      : `<div class="lb-tiles">${tile("lotLabel", "printer", "Étiquette")}${tile("lbQr", "qr", "Voir le QR")}</div>`}
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
