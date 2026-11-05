/* Growth Gusto — area: hygiène (prefix « hy »). Four small HACCP modules and their hub.
   Routes: hygiene (hub) · refroid (refroidissement & remise en température) · friture (huile) · gaspillage · documents (coffre-fort).
   Data (restos/{rid}/…, all backwards compatible: every field optional except the ones marked *):
     cooling  { kind*: "refroid"|"remise", plat*, noteId?, qty?, unit?, cell?, startAt*, t0?, checks:[{at,t}], status*: "run"|"ok"|"ko"|"stop",
                endAt?, t1?, action?, actionNote?, day, uid, by }
     fryers   { name*, every (services between oil changes, default 8), svc (services since the last change), lastChange?, order, createdAt, archived? }
     fryLogs  { fryerId*, kind*: "test"|"change", pct?, method?: "testeur"|"bandelette", level?, at*, day, uid, by }
     waste    { name*, productId?, qty, unit, reason*: dlc|abime|surprod|retour|rappel, cost?, at*, day, month, uid, by, moveId? }
     vault    { cat*, name*, expiry?: "YYYY-MM-DD", remind (days, default 30), files:[{id,name,type,url?}], notes?, at, updatedAt, uid, by }
   Files are stored exactly like the reading photos (js/releve.js) and the obligation reports: core upload() → on-device IndexedDB (ids "loc-…").
   Public: window.HYG = { expiringDocs(days?), coolingInProgress(), fryerAlerts(), wasteMonth(month?), summary() }. */
"use strict";

Object.assign(IC, {
  hygPot: ["f:M4.5 10.5h15V17a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z", "M4.5 10.5h15V17a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z", "M2.5 10.5h19", "M9 7c0-1.2 1.2-1.3 1.2-2.5", "M13.5 7c0-1.2 1.2-1.3 1.2-2.5"],
  hygFlame: ["f:M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-2.2-1.1-4.2-2.6-5.7-.3 1.5-1.1 2.6-2.2 3.2.3-3.3-1-6.6-3.7-9 0 3-1.5 5.2-3.2 7A7 7 0 0 0 5.5 15a6.5 6.5 0 0 0 6.5 6.5z", "M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-2.2-1.1-4.2-2.6-5.7-.3 1.5-1.1 2.6-2.2 3.2.3-3.3-1-6.6-3.7-9 0 3-1.5 5.2-3.2 7A7 7 0 0 0 5.5 15a6.5 6.5 0 0 0 6.5 6.5z", "M12 21.5a2.8 2.8 0 0 1-2.8-2.8c0-1.6 1.4-2.6 2.8-4.2 1.4 1.6 2.8 2.6 2.8 4.2a2.8 2.8 0 0 1-2.8 2.8z"],
  hygOil: ["f:M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z", "M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z", "M9.4 14.8a2.7 2.7 0 0 0 2.6 2.7"],
  hygBin: ["f:M6 7h12l-.9 12.2a2 2 0 0 1-2 1.8H8.9a2 2 0 0 1-2-1.8z", "M4 7h16", "M6 7l.9 12.2a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8L18 7", "M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7", "M10 11v6", "M14 11v6"],
  hygVault: ["f:M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z", "M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z", "M3.5 10h17"],
  hygBug: ["f:M8 11a4 4 0 0 1 8 0v3a4 4 0 0 1-8 0z", "M8 11a4 4 0 0 1 8 0v3a4 4 0 0 1-8 0z", "M12 10v8", "M9.5 7.5 8 5.5", "M14.5 7.5 16 5.5", "M8 12.5H4.5", "M16 12.5h3.5", "M8.4 16l-3 2", "M15.6 16l3 2"],
  hygFlask: ["f:M9.5 3.5h5v5.3l4.6 8.5a2 2 0 0 1-1.8 2.9H6.7a2 2 0 0 1-1.8-2.9l4.6-8.5z", "M9.5 3.5h5", "M10 3.5v5.3l-5.1 8.5a2 2 0 0 0 1.8 2.9h10.6a2 2 0 0 0 1.8-2.9L14 8.8V3.5", "M7 15h10"],
  hygDoc: ["f:M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1-1.5z", "M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18 19V7.5z", "M14 3.5v4h4", "M8.5 12.5h7", "M8.5 16h4.5"],
  hygUmb: ["f:M21 12a9 9 0 0 0-18 0z", "M21 12a9 9 0 0 0-18 0z", "M12 12v6.5a2 2 0 0 0 4 0", "M12 3V2"],
  hygCap: ["f:M2.8 9.4 12 5l9.2 4.4L12 13.8z", "M2.8 9.4 12 5l9.2 4.4L12 13.8z", "M6.5 11.3V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.7", "M21.2 9.4V15"],
  hygBell: ["f:M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z", "M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z", "M10.3 20.5a2 2 0 0 0 3.4 0"],
  hygPlate: ["c:12,13,7", "c:12,13,3.5", "M3 6.5h18"],
  hygStack: ["f:M5 9h14v3H5z", "M4 9h16", "M5 12h14", "M6 15h12", "M7.5 18h9", "M9 6h6"],
  hygPdf: ["M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18 19V7.5z", "M14 3.5v4h4"],
});
TAB_OF.hygiene = "more"; TAB_OF.refroid = "more"; TAB_OF.friture = "more"; TAB_OF.gaspillage = "more"; TAB_OF.documents = "more";

/* ───────── state, subscriptions ───────── */
const HY = { rid: null, subs: {}, cool: null, fry: null, flog: null, waste: null, docs: null, seeded: {}, rung: {}, cdT: 0, last: {} };
try { HY.rung = JSON.parse(localStorage.getItem("gg-hyg-rung") || "{}"); } catch (e) {}
const HY_COLS = [["cool", "cooling", { order: "startAt", dir: "desc", limit: 600 }], ["fry", "fryers", {}], ["flog", "fryLogs", { order: "at", dir: "desc", limit: 800 }], ["waste", "waste", { order: "at", dir: "desc", limit: 3000 }], ["docs", "vault", {}]];
/* a watch dies when the core re-attaches a restaurant (it drops every listener): check that ours is still alive, re-open it if not */
function hyAlive(key) {
  const s = HY.subs[key]; if (!s) return false;
  if (DB.mode === "db") return DB.subs.includes(s);
  return (DB.listeners[DB.path(s.col)] || []).includes(s.cb);
}
function hyWatch() {
  if (!S.rid || typeof DB === "undefined") return;
  if (HY.rid !== S.rid) { HY.rid = S.rid; HY.subs = {}; HY_COLS.forEach(([k]) => (HY[k] = null)); }
  const rid = S.rid;
  HY_COLS.forEach(([k, col, opts]) => {
    if (hyAlive(k)) return;
    const cb = (rows) => { if (S.rid !== rid) return; HY[k] = rows; hySeedMaybe(); onData(); };
    const n = DB.subs.length; DB.watch(col, opts, cb);
    HY.subs[k] = DB.mode === "db" ? DB.subs[DB.subs.length - 1] || DB.subs[n] : { col, cb };
  });
}
const hyArr = (k) => { hyWatch(); return HY[k] || []; };
const hyLoaded = () => HY_COLS.every(([k]) => HY[k] !== null);

/* ───────── small helpers ───────── */
const hyCan = (k) => { try { return typeof PERMS === "undefined" || !PERMS.cap ? true : PERMS.cap(k) !== false; } catch (e) { return true; } };
const hyMoney = () => hyCan("seeMoney");
const hyDur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h} h${m % 60 ? " " + pad(m % 60) : ""}` : `${m} min`; };
const hyCd = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
const hyDeg = (t) => (t == null ? "–" : `${fmt(t, Number.isInteger(t) ? 0 : 1)} °C`);
const hyEur = (v, d) => (v == null ? "–" : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d ?? (v >= 100 ? 0 : 2), maximumFractionDigits: d ?? (v >= 100 ? 0 : 2) })} €`);
const hyU = (q, u) => ((u === "pièce" || u === "portion") && q >= 2 ? u + "s" : u || "");
const hyPl = (n, s, p) => `${n} ${n > 1 ? p || s + "s" : s}`;
const hyMe = () => ({ uid: S.me.id, by: S.me.name || (typeof nameOf === "function" ? nameOf(S.me.id) : "") });
const HY_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const hyDay = (k) => { const d = parseDay(k); if (!d) return "–"; const t = daysUntil(k); return t === 0 ? "aujourd'hui" : t === -1 ? "hier" : t === 1 ? "demain" : `le ${d.getDate()} ${HY_MS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`; };
const hyFull = (k) => { const d = parseDay(k); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "–"; };
const hyWell = (ic, tone, cls = "") => `<span class="hy-well ${tone} ${cls}">${ico(ic)}</span>`;
const hyIsPdf = (f) => /pdf/i.test(f?.type || "") || /\.pdf$/i.test(f?.name || "");
const hyIsLoc = (id) => typeof PHOTOS !== "undefined" && PHOTOS.isLocal(id);
const hyFileUrl = (f) => (f && ((f.id && photoUrl(f.id)) || f.url)) || "";
const hyRmFile = (f) => { if (f && hyIsLoc(f.id)) PHOTOS.delete(f.id).catch(() => {}); };
const hyRecipes = () => (S.notes || []).filter((n) => (typeof noteKind === "function" ? noteKind(n) : n.cat) === "Recettes" && n.title);
function hyAlarm() { /* loud enough for a kitchen, still short */ if (SFX.on && SFX.ctx) { [0, 0.28, 0.56].forEach((at) => { SFX.tone(988, 0.18, "square", 0.05, at); SFX.tone(1319, 0.14, "sine", 0.06, at + 0.09); }); } buzz([220, 90, 220, 90, 320]); }
function hyNotify(title, body, tag) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const o = { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png", renotify: true, requireInteraction: true, vibrate: [220, 90, 220] };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then((r) => { if (r && r.showNotification) r.showNotification(title, o); else new Notification(title, o); }).catch(() => { try { new Notification(title, o); } catch (e) {} });
    else new Notification(title, o);
  } catch (e) {}
}
function hyAskNotify() { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch (e) {} }

/* ═════════════════════ 1 · Refroidissement & remise en température ═════════════════════ */
const HY_K = {
  refroid: { t: "Refroidissement", verb: "Refroidir", lim: 120 * 6e4, remind: 105 * 6e4, ok: (t) => t <= 10, goal: "10 °C", rule: "De +63 °C à moins de +10 °C à cœur en moins de 2 h", ic: "snow", tone: "sky", t0min: 63 },
  remise: { t: "Remise en température", verb: "Réchauffer", lim: 60 * 6e4, remind: 45 * 6e4, ok: (t) => t >= 63, goal: "63 °C", rule: "De +3 °C à +63 °C à cœur en moins d'1 h", ic: "hygFlame", tone: "tomato" },
};
const HY_ACTIONS = { refroid: ["Produit jeté", "Remis à 63 °C et servi aussitôt", "Cellule vérifiée, technicien appelé"], remise: ["Produit jeté", "Servi aussitôt après chauffe", "Matériel de chauffe vérifié"] };
const hyKind = (b) => HY_K[b.kind] || HY_K.refroid;
function hyPhase(b, now = Date.now()) {
  if (b.status && b.status !== "run") return b.status;
  const el = now - (b.startAt || now), K = hyKind(b);
  return el >= K.lim ? "late" : el >= K.remind ? "due" : "run";
}
const hyRunning = () => hyArr("cool").filter((b) => (b.status || "run") === "run").sort((a, b) => a.startAt + hyKind(a).lim - (b.startAt + hyKind(b).lim));
const hyToFix = () => hyArr("cool").filter((b) => b.status === "ko" && !b.action);
const hyPhaseTx = { run: "En cours", due: "À mesurer", late: "Délai dépassé" };

function hyBatchCard(b, i) {
  const K = hyKind(b), now = Date.now(), ph = hyPhase(b, now), el = now - b.startAt, left = b.startAt + K.lim - now;
  const pct = Math.min(100, (el / K.lim) * 100); const last = (b.checks || [])[b.checks?.length - 1];
  const meta = [b.qty ? `${fmt(b.qty, Number.isInteger(+b.qty) ? 0 : 1)} ${esc(b.unit || "")}` : "", b.kind === "refroid" ? (b.cell ? "Cellule" : "Sans cellule") : "", `depuis ${hm(b.startAt)}`].filter(Boolean).join(" · ");
  return `<div class="hy-run ${ph} ${K.tone} st" style="--i:${i}" data-hy-run="${b.id}">
    <div class="hy-runh">${hyWell(K.ic, K.tone)}<div class="tx"><b>${esc(b.plat)}</b><em>${meta}</em></div><button class="iconbtn hy-mini" data-act="hyCoolMore" data-id="${b.id}" aria-label="Options">${ico("dots")}</button></div>
    <div class="hy-clock"><span class="hy-cdl">${ph === "late" ? "Dépassé de" : "Reste"}</span><span class="hy-cd" data-hy-cd="${b.id}">${hyCd(Math.abs(left))}</span><span class="hy-ph" data-hy-ph="${b.id}">${hyPhaseTx[ph]}</span></div>
    <div class="hy-track"><i data-hy-bar="${b.id}" style="width:${pct}%"></i><span class="hy-mk" style="left:${(K.remind / K.lim) * 100}%"></span></div>
    <div class="hy-steps"><span class="hy-stp done"><b>${hyDeg(b.t0)}</b><em>départ ${hm(b.startAt)}</em></span>${last ? `<span class="hy-stp mid"><b>${hyDeg(last.t)}</b><em>${hm(last.at)}</em></span>` : ""}<span class="hy-stp goal"><b>${b.kind === "remise" ? "≥" : "≤"} ${K.goal}</b><em>avant ${hm(b.startAt + K.lim)}</em></span></div>
    <button class="btn ${ph === "late" ? "danger" : "acc"} block hy-mbtn" data-act="hyMeasure" data-id="${b.id}">${ico("therm")}Mesurer maintenant</button>
  </div>`;
}
function hyCoolRow(b) {
  const K = hyKind(b); const st = b.status === "ok" ? ["ok", "Conforme"] : b.status === "stop" ? ["neu", "Annulé"] : b.action ? ["bad", "Non conforme"] : ["bad", "Action à noter"];
  const dur = b.endAt ? hyDur(b.endAt - b.startAt) : "";
  return `<div class="li tap hy-row" data-act="hyCoolOpen" data-id="${b.id}" role="button" tabindex="0">${hyWell(K.ic, K.tone, "sm")}<div class="tx"><b>${esc(b.plat)}</b><em>${when(b.startAt)} · ${hyDeg(b.t0)} → ${hyDeg(b.t1)}${dur ? ` · ${dur}` : ""}</em></div><span class="pill ${st[0]}">${st[1]}</span></div>`;
}
VIEWS.refroid = {
  nav: "hygiene",
  render() {
    const R = hyRunning(), F = hyToFix(); const H = hyArr("cool").filter((b) => b.status && b.status !== "run").sort((a, b) => b.startAt - a.startAt);
    const shown = H.slice(0, S.ui.hyCoolN || 25);
    const start = `<div class="hy-starts st" style="--i:${R.length + 1}">
      <button class="hy-start sky" data-act="hyCoolNew" data-v="refroid">${hyWell("snow", "sky")}<span class="tx"><b>Refroidir un plat</b><em>${HY_K.refroid.rule}</em></span>${ico("plus")}</button>
      <button class="hy-start tomato" data-act="hyCoolNew" data-v="remise">${hyWell("hygFlame", "tomato")}<span class="tx"><b>Remettre en température</b><em>${HY_K.remise.rule}</em></span>${ico("plus")}</button></div>`;
    const fix = F.length ? `<div class="glass pad hy-fix st" style="--i:1"><span class="lbl">À régulariser</span>${F.map((b) => `<div class="li tap" data-act="hyAction" data-id="${b.id}" role="button" tabindex="0">${hyWell("alert", "tomato", "sm")}<div class="tx"><b>${esc(b.plat)}</b><em>Notez ce que vous avez fait du plat</em></div>${ico("chev")}</div>`).join("")}</div>` : "";
    const okN = H.filter((b) => b.status === "ok" && b.startAt > Date.now() - 30 * 864e5).length, koN = H.filter((b) => b.status === "ko" && b.startAt > Date.now() - 30 * 864e5).length;
    const hist = H.length ? `<div class="glass pad hy-hist st" style="--i:3"><div class="row"><span class="lbl">Historique</span><span class="sub">30 j : ${okN} conformes${koN ? ` · ${koN} non` : ""}</span></div>${shown.map(hyCoolRow).join("")}${H.length > shown.length ? `<button class="btn ghost sm block" data-act="hyMore" data-v="hyCoolN">Voir plus</button>` : ""}</div>`
      : `<div class="glass empty st" style="--i:3"><div class="ic">${ico("clock")}</div><b>Aucun suivi pour l'instant</b>Lancez le chrono dès la sortie du four : on vous prévient quand mesurer.</div>`;
    return `<div class="inner hy">${topBar("Refroidissement")}${fix}
      <div class="cols"><div>${R.map((b, i) => hyBatchCard(b, i + 1)).join("")}${start}</div><div>${hist}</div></div></div>`;
  },
};

/* new batch sheet */
function hyCoolForm() {
  const F = S.ui.hyCool; const K = HY_K[F.kind]; const rec = hyRecipes();
  const used = {}; hyArr("cool").forEach((b) => { if (b.noteId) used[b.noteId] = (used[b.noteId] || 0) + 1; });
  const sug = rec.slice().sort((a, b) => (used[b.id] || 0) - (used[a.id] || 0) || a.title.localeCompare(b.title, "fr")).slice(0, 8);
  const t0 = num(F.t0); const warn = F.kind === "refroid" && t0 != null && t0 < 63;
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell(K.ic, K.tone)}<div><b class="h3">${K.t}</b><em>${K.rule}</em></div></div>
    <div class="seg hy-seg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${F.kind === "remise" ? 100 : 0}%)"></span><button class="${F.kind === "refroid" ? "on" : ""}" data-act="hyCoolKind" data-v="refroid">Refroidir</button><button class="${F.kind === "remise" ? "on" : ""}" data-act="hyCoolKind" data-v="remise">Réchauffer</button></div>
    <label class="field"><span>Plat</span><input class="input" id="hyPlat" value="${esc(F.plat)}" placeholder="Ex. Bœuf bourguignon" autocomplete="off" enterkeyhint="next"></label>
    ${sug.length ? `<div class="chips hy-rc">${sug.map((n) => `<button class="chip${F.noteId === n.id ? " on" : ""}" data-act="hyCoolRec" data-id="${n.id}">${ico("book")}${esc(n.title)}</button>`).join("")}</div>` : ""}
    <div class="field"><span>Quantité <em class="hy-opt">facultatif</em></span><div class="hy-qrow"><input class="input mono" id="hyQty" inputmode="decimal" value="${esc(F.qty)}" placeholder="0" aria-label="Quantité"><div class="hy-units">${["kg", "L", "portions"].map((u) => `<button class="chip${F.unit === u ? " on" : ""}" data-act="hyCoolUnit" data-v="${u}">${u}</button>`).join("")}</div></div></div>
    ${F.kind === "refroid" ? `<div class="field"><span>Cellule de refroidissement</span><div class="hy-units">${[[1, "Oui"], [0, "Non, à l'air"]].map(([v, t]) => `<button class="chip${+F.cell === v ? " on" : ""}" data-act="hyCoolCell" data-v="${v}">${t}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span>Température à cœur au départ${F.kind === "remise" ? " <em class=\"hy-opt\">facultatif</em>" : ""}</span>${hyTempIn("hyT0", F.t0, F.kind === "refroid" ? "65" : "3")}</div>
    <p class="hy-verdict ${warn ? "warn" : ""}" id="hyT0v">${warn ? "Moins de 63 °C : le refroidissement doit commencer dès la fin de cuisson." : ""}</p>
    <button class="btn acc block" data-act="hyCoolGo">${ico("clock")}Lancer le chrono</button>
  </div>`;
}
const hyTempIn = (id, v, ph) => `<div class="hy-temp"><button class="hy-tb" data-act="hyTStep" data-id="${id}" data-v="-1" aria-label="Moins un degré">${ico("minus")}</button><label class="hy-tw"><input class="hy-ti mono" id="${id}" inputmode="decimal" value="${esc(v ?? "")}" placeholder="${ph}" autocomplete="off" aria-label="Température en °C"><span>°C</span></label><button class="hy-tb" data-act="hyTStep" data-id="${id}" data-v="1" aria-label="Plus un degré">${ico("plus")}</button></div>`;
function hyCoolPaint() { const F = S.ui.hyCool; if (!F) return; openSheet(hyCoolForm(), (b) => {
  const bind = (sel, key) => { const e = $(sel, b); if (e) e.addEventListener("input", () => { F[key] = e.value; if (key === "plat" && F.noteId) { const n = S.notes.find((x) => x.id === F.noteId); if (!n || n.title !== e.value) { F.noteId = null; $$(".hy-rc .chip", b).forEach((c) => c.classList.remove("on")); } } if (key === "t0") hyT0Verdict(b); }); };
  bind("#hyPlat", "plat"); bind("#hyQty", "qty"); bind("#hyT0", "t0");
}); }
function hyT0Verdict(b) { const F = S.ui.hyCool, v = $("#hyT0v", b); if (!F || !v) return; const t = num(F.t0); const w = F.kind === "refroid" && t != null && t < 63; v.className = "hy-verdict" + (w ? " warn" : ""); v.textContent = w ? "Moins de 63 °C : le refroidissement doit commencer dès la fin de cuisson." : ""; }

/* measure sheet */
function hyMeasureForm(b) {
  const K = hyKind(b), ph = hyPhase(b), left = b.startAt + K.lim - Date.now();
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell(K.ic, K.tone)}<div><b class="h3">${esc(b.plat)}</b><em>${ph === "late" ? `Délai dépassé de ${hyDur(-left)}` : `Il reste ${hyDur(left)} · objectif ${b.kind === "remise" ? "≥" : "≤"} ${K.goal}`}</em></div></div>
    <div class="field"><span>Température à cœur</span>${hyTempIn("hyT1", S.ui.hyT1 || "", b.kind === "remise" ? "65" : "8")}</div>
    <p class="hy-verdict" id="hyT1v"></p>
    <button class="btn acc block" data-act="hyMeasureOk" data-id="${b.id}">Valider la mesure</button>
  </div>`;
}
function hyT1Verdict(bd, b) {
  const v = $("#hyT1v", bd), e = $("#hyT1", bd); if (!v || !e) return; const t = num(e.value); const K = hyKind(b);
  if (t == null) { v.className = "hy-verdict"; v.textContent = ""; return; }
  const good = K.ok(t), late = Date.now() - b.startAt > K.lim;
  v.className = "hy-verdict " + (good && !late ? "ok" : good || late ? "bad" : "warn");
  v.textContent = good && !late ? "Conforme : le suivi sera clôturé." : late ? "Hors délai : notez ensuite ce que vous faites du plat." : b.kind === "remise" ? `Encore ${fmt(63 - t, 0)} °C à gagner : on continue.` : `Encore ${fmt(t - 10, 0)} °C à perdre : on continue.`;
}
function hyActionForm(b) {
  const A = HY_ACTIONS[b.kind] || HY_ACTIONS.refroid; const F = S.ui.hyAct || {};
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell("alert", "tomato")}<div><b class="h3">Non conforme</b><em>${esc(b.plat)} · ${hyDeg(b.t1)} après ${hyDur((b.endAt || Date.now()) - b.startAt)}</em></div></div>
    <div class="field"><span>Qu'avez-vous fait du plat ?</span><div class="hy-acts">${A.map((a) => `<button class="hy-act${F.a === a ? " on" : ""}" data-act="hyActPick" data-v="${esc(a)}"><span class="hy-radio"></span>${esc(a)}</button>`).join("")}</div></div>
    <label class="field"><span>Précision <em class="hy-opt">facultatif</em></span><input class="input" id="hyActNote" value="${esc(F.note || "")}" placeholder="Ex. 4 portions jetées"></label>
    <button class="btn acc block" data-act="hyActSave" data-id="${b.id}" ${F.a ? "" : "disabled"}>Enregistrer</button>
  </div>`;
}
function hyCoolDetail(b) {
  const K = hyKind(b); const n = b.noteId && S.notes.find((x) => x.id === b.noteId);
  const pts = [[b.startAt, b.t0, "Départ"]].concat((b.checks || []).map((c) => [c.at, c.t, "Contrôle"])).concat(b.endAt ? [[b.endAt, b.t1, "Fin"]] : []);
  const st = b.status === "ok" ? ["ok", "Conforme"] : b.status === "stop" ? ["neu", "Annulé"] : b.status === "run" ? ["acc", "En cours"] : ["bad", "Non conforme"];
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell(K.ic, K.tone)}<div><b class="h3">${esc(b.plat)}</b><em>${K.t} · ${esc(b.by || nameOf(b.uid))}</em></div><span class="pill ${st[0]}">${st[1]}</span></div>
    <div class="hy-tl">${pts.map(([at, t, l]) => `<div class="hy-tli"><span class="mono">${hm(at)}</span><b class="mono">${hyDeg(t)}</b><em>${l}</em></div>`).join("")}</div>
    <div class="hy-kv">${[["Date", hyFull(dayKey(new Date(b.startAt)))], b.endAt ? ["Durée", hyDur(b.endAt - b.startAt)] : null, b.qty ? ["Quantité", `${fmt(b.qty, Number.isInteger(+b.qty) ? 0 : 1)} ${esc(b.unit || "")}`] : null, b.kind === "refroid" ? ["Cellule", b.cell ? "Oui" : "Non"] : null, b.action ? ["Action", esc(b.action) + (b.actionNote ? ` · ${esc(b.actionNote)}` : "")] : null].filter(Boolean).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
    ${n ? `<button class="btn soft block" data-go="fiche" data-id="${n.id}">${ico("book")}Voir la fiche recette</button>` : ""}
    ${b.status === "ko" ? `<button class="btn ${b.action ? "soft" : "acc"} block" data-act="hyAction" data-id="${b.id}">${b.action ? "Modifier l'action" : "Noter l'action corrective"}</button>` : ""}
    ${b.status === "run" ? `<button class="btn danger block" data-act="hyCoolStop" data-id="${b.id}">Arrêter ce suivi</button>` : ""}
    ${hyCan("editSettings") && b.status !== "run" ? `<button class="btn ghost sm block hy-del" data-act="hyCoolDel" data-id="${b.id}">${ico("trash")}Supprimer</button>` : ""}
  </div>`;
}
const hyCool = (id) => hyArr("cool").find((b) => b.id === id);

/* the ticker: live countdowns on screen + one alarm per batch and phase, anywhere in the app while it is open */
function hyTick() {
  if (!S.ready || !S.rid) return; hyWatch(); const R = HY.cool ? hyRunning() : []; if (!R.length) return;
  const now = Date.now(); let changed = false;
  R.forEach((b) => {
    const K = hyKind(b), ph = hyPhase(b, now), left = b.startAt + K.lim - now;
    $$(`[data-hy-cd="${b.id}"]`).forEach((e) => { e.textContent = hyCd(Math.abs(left)); });
    $$(`[data-hy-bar="${b.id}"]`).forEach((e) => { e.style.width = Math.min(100, ((now - b.startAt) / K.lim) * 100) + "%"; });
    const card = $(`[data-hy-run="${b.id}"]`); if (card && !card.classList.contains(ph)) changed = true;
    if (ph === "run") return; const key = b.id + ":" + ph; if (HY.rung[key]) return;
    HY.rung[key] = now; const ks = Object.keys(HY.rung); if (ks.length > 80) ks.sort((a, c) => HY.rung[a] - HY.rung[c]).slice(0, ks.length - 80).forEach((k) => delete HY.rung[k]);
    try { localStorage.setItem("gg-hyg-rung", JSON.stringify(HY.rung)); } catch (e) {}
    if (now - b.startAt > K.lim + 30 * 6e4 && ph === "late") return; /* opened long after: no alarm storm, the card is red anyway */
    const title = ph === "late" ? `${b.plat} : délai dépassé` : `${b.plat} : mesurez la température`;
    const body = ph === "late" ? `${K.t} au-delà de ${b.kind === "remise" ? "1 h" : "2 h"}. Mesurez et notez l'action.` : `Plus que ${hyDur(left)} pour atteindre ${K.goal}.`;
    hyAlarm(); hyNotify(title, body, "gg-cool-" + b.id); toast(title, ph === "late" ? "err" : "info"); changed = true;
  });
  if (changed && ["refroid", "hygiene"].includes(S.route)) refresh();
}
setInterval(hyTick, 1000);

/* ═════════════════════ 2 · Huile de friture ═════════════════════ */
const HY_LIM = 25, HY_WARN = 20;
const HY_STRIPS = [["b1", "Bonne", 10, "#1E7F55"], ["b2", "Correcte", 17, "#9BB83A"], ["b3", "À surveiller", 22, "#E8A21A"], ["b4", "À changer", 27, "#C8432A"]];
const hyFryers = () => hyArr("fry").filter((f) => !f.archived).sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
const hyFLogs = (id) => hyArr("flog").filter((l) => l.fryerId === id).sort((a, b) => b.at - a.at);
function hyFryState(f) {
  const L = hyFLogs(f.id); const test = L.find((l) => l.kind === "test" && (!f.lastChange || l.at >= f.lastChange));
  const every = +f.every || 8, svc = +f.svc || 0; const pct = test ? test.pct : null;
  const st = pct != null && pct >= HY_LIM ? "bad" : svc >= every ? "warn" : pct != null && pct >= HY_WARN ? "warn" : "ok";
  const tx = pct != null && pct >= HY_LIM ? "Huile à changer" : svc >= every ? "Changement conseillé" : pct != null && pct >= HY_WARN ? "À surveiller" : test ? "Huile correcte" : "Pas encore testée";
  const testedToday = test && test.day === dayKey();
  return { test, pct, every, svc, st, tx, testedToday };
}
function hyGauge(pct) {
  const max = 30, p = pct == null ? 0 : Math.min(max, Math.max(0, pct));
  return `<div class="hy-gauge${pct == null ? " none" : ""}"><div class="hy-gt"><i style="width:${(p / max) * 100}%"></i><span class="hy-gl" style="left:${(HY_LIM / max) * 100}%"></span></div><div class="hy-gs"><span>0 %</span><span style="left:${(HY_LIM / max) * 100}%">25 % légal</span></div></div>`;
}
function hyFryCard(f, i) {
  const s = hyFryState(f); const ring = Math.min(1, s.svc / s.every);
  return `<div class="glass hy-fry ${s.st} st" style="--i:${i}">
    <div class="hy-fh">${hyWell("hygOil", s.st === "bad" ? "tomato" : s.st === "warn" ? "saffron" : "violet")}<div class="tx"><b>${esc(f.name)}</b><em>${f.lastChange ? `Huile changée ${hyDay(dayKey(new Date(f.lastChange)))}` : "Pas encore de changement noté"}</em></div>${hyCan("editSettings") ? `<button class="iconbtn hy-mini" data-act="hyFryEdit" data-id="${f.id}" aria-label="Réglages de ${esc(f.name)}">${ico("sliders")}</button>` : ""}</div>
    <div class="hy-fm"><div class="hy-pct"><b class="mono">${s.pct == null ? "–" : fmt(s.pct, 0)}<small>%</small></b><span class="pill ${s.st === "ok" ? (s.test ? "ok" : "neu") : s.st}">${s.tx}</span></div>
      <button class="hy-ring" data-act="hyFrySvc" data-id="${f.id}" style="--p:${ring}" aria-label="Ajouter un service"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="v" cx="22" cy="22" r="19" pathLength="1" style="stroke-dasharray:${ring} 1;opacity:${ring > 0 ? 1 : 0}"/></svg><span><b class="mono">${s.svc}/${s.every}</b><em>services</em></span><i>${ico("plus")}</i></button></div>
    ${hyGauge(s.pct)}
    <div class="hy-fa"><button class="btn ${s.testedToday ? "soft" : "acc"} sm" data-act="hyFryTest" data-id="${f.id}">${ico("hygFlask")}${s.testedToday ? "Retester" : "Tester"}</button><button class="btn ${s.st === "ok" ? "soft" : "saffron"} sm" data-act="hyFryChange" data-id="${f.id}">${ico("hygOil")}Huile changée</button></div>
  </div>`;
}
VIEWS.friture = {
  nav: "hygiene",
  render() {
    const F = hyFryers();
    const right = F.length && hyCan("editSettings") ? `<button class="iconbtn" data-act="hyFryEdit" aria-label="Ajouter une friteuse">${ico("plus")}</button>` : "";
    if (!F.length) return `<div class="inner narrow hy">${topBar("Huile de friture")}<div class="glass hy-hello st" style="--i:1">${hyWell("hygOil", "saffron", "lg")}<b class="h3">Suivez l'huile de vos friteuses</b><p class="sub">Un test, un tap. On vous dit quand la changer (25 % de composés polaires au maximum).</p><button class="btn acc" data-act="hyFryEdit">${ico("plus")}Ajouter une friteuse</button></div></div>`;
    const L = hyArr("flog").filter((l) => F.some((f) => f.id === l.fryerId)).sort((a, b) => b.at - a.at).slice(0, S.ui.hyFryN || 12);
    const hist = `<div class="glass pad st" style="--i:${F.length + 1}"><span class="lbl">Historique</span>${L.length ? L.map((l) => { const f = F.find((x) => x.id === l.fryerId); const bad = l.kind === "test" && l.pct >= HY_LIM;
      return `<div class="li">${hyWell(l.kind === "change" ? "hygOil" : "hygFlask", l.kind === "change" ? "saffron" : bad ? "tomato" : "violet", "sm")}<div class="tx"><b>${l.kind === "change" ? "Huile changée" : `Test : ${fmt(l.pct, 0)} %${l.method === "bandelette" ? " · bandelette" : ""}`}</b><em>${esc(f ? f.name : "")} · ${when(l.at)} · ${esc(firstName(l.by || nameOf(l.uid)))}</em></div>${l.kind === "test" ? `<span class="pill ${bad ? "bad" : l.pct >= HY_WARN ? "warn" : "ok"}">${bad ? "À changer" : l.pct >= HY_WARN ? "Limite" : "OK"}</span>` : ""}</div>`; }).join("") : `<p class="note" style="margin:8px 0 0">Les tests et les changements d'huile apparaissent ici.</p>`}</div>`;
    return `<div class="inner hy">${topBar("Huile de friture", { right })}<div class="cols"><div>${F.map((f, i) => hyFryCard(f, i + 1)).join("")}</div><div>${hist}</div></div></div>`;
  },
};
function hyFryTestForm(f) {
  const T = S.ui.hyTest;
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell("hygFlask", "violet")}<div><b class="h3">Tester l'huile</b><em>${esc(f.name)} · limite légale 25 %</em></div></div>
    <div class="seg hy-seg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${T.method === "bandelette" ? 100 : 0}%)"></span><button class="${T.method === "testeur" ? "on" : ""}" data-act="hyTestM" data-v="testeur">Testeur</button><button class="${T.method === "bandelette" ? "on" : ""}" data-act="hyTestM" data-v="bandelette">Bandelette</button></div>
    ${T.method === "testeur" ? `<div class="field"><span>Composés polaires</span><div class="hy-temp"><button class="hy-tb" data-act="hyTStep" data-id="hyPct" data-v="-1" aria-label="Moins un">${ico("minus")}</button><label class="hy-tw"><input class="hy-ti mono" id="hyPct" inputmode="decimal" value="${esc(T.pct ?? "")}" placeholder="14" autocomplete="off" aria-label="Pourcentage de composés polaires"><span>%</span></label><button class="hy-tb" data-act="hyTStep" data-id="hyPct" data-v="1" aria-label="Plus un">${ico("plus")}</button></div></div><p class="hy-verdict" id="hyPctV"></p>`
      : `<div class="field"><span>Couleur de la bandelette</span><div class="hy-strips">${HY_STRIPS.map(([k, t, p, c]) => `<button class="hy-strip${T.level === k ? " on" : ""}" data-act="hyTestL" data-v="${k}" style="--c:${c}"><i></i><b>${t}</b><em>≈ ${p} %</em></button>`).join("")}</div></div>`}
    <button class="btn acc block" data-act="hyTestSave" data-id="${f.id}">Enregistrer le test</button>
  </div>`;
}
function hyPctVerdict(bd) { const e = $("#hyPct", bd), v = $("#hyPctV", bd); if (!e || !v) return; const p = num(e.value); if (p == null) { v.className = "hy-verdict"; v.textContent = ""; return; } v.className = "hy-verdict " + (p >= HY_LIM ? "bad" : p >= HY_WARN ? "warn" : "ok"); v.textContent = p >= HY_LIM ? "Au-delà de 25 % : l'huile doit être changée." : p >= HY_WARN ? "Proche de la limite : prévoyez le changement." : "Huile correcte."; }
function hyFryEditForm(f) {
  const E = S.ui.hyFE;
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell("hygOil", "saffron")}<div><b class="h3">${f ? "Réglages" : "Nouvelle friteuse"}</b><em>${f ? esc(f.name) : "Une carte par friteuse"}</em></div></div>
    <label class="field"><span>Nom</span><input class="input" id="hyFName" value="${esc(E.name)}" placeholder="Ex. Friteuse frites"></label>
    <div class="field"><span>Changer l'huile tous les</span><div class="hy-step"><button class="hy-tb" data-act="hyFEvery" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono" id="hyFEv">${E.every}</b><span>services</span><button class="hy-tb" data-act="hyFEvery" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>
    <button class="btn acc block" data-act="hyFrySave" ${f ? `data-id="${f.id}"` : ""}>${f ? "Enregistrer" : "Ajouter"}</button>
    ${f ? `<button class="btn ghost sm block hy-del" data-act="hyFryDel" data-id="${f.id}">${ico("trash")}Retirer cette friteuse</button>` : ""}
  </div>`;
}

/* ═════════════════════ 3 · Gaspillage ═════════════════════ */
const HY_R = { dlc: ["DLC dépassée", "clock", "#C8432A"], abime: ["Abîmé", "alert", "#E8A21A"], surprod: ["Surproduction", "hygStack", "#5B2BFF"], retour: ["Retour client", "hygPlate", "#2F5FBF"], rappel: ["Rappel produit", "hygBell", "#1B1530"] };
const HY_UNITS = ["kg", "g", "L", "pièce", "portion"];
function hyConv(q, from, to) {
  if (from === to) return q;
  if (from === "g" && to === "kg") return q / 1000; if (from === "kg" && to === "g") return q * 1000; if (from === "ml" && to === "L") return q / 1000; if (from === "cl" && to === "L") return q / 100; if (from === "L" && to === "cl") return q * 100;
  return null;
}
function hyCostOf(productId, qty, unit) { const p = productId && S.products.find((x) => x.id === productId); if (!p || !(p.price > 0) || !(qty > 0)) return null; const q = hyConv(qty, unit, p.unit); return q == null ? null : Math.round(q * p.price * 100) / 100; }
const hyWMonth = (m = monthKey()) => hyArr("waste").filter((w) => (w.month || (w.day || "").slice(0, 7)) === m);
function hyWasteSum(L) { const by = {}; let cost = 0, n = 0, priced = 0; L.forEach((w) => { n++; if (w.cost > 0) { cost += w.cost; priced++; } const r = HY_R[w.reason] ? w.reason : "abime"; (by[r] ||= { n: 0, cost: 0 }).n++; by[r].cost += w.cost > 0 ? w.cost : 0; }); return { n, cost: Math.round(cost * 100) / 100, priced, by }; }
function hyMonths(n) { const out = []; const d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(monthKey(x)); } return out; }
VIEWS.gaspillage = {
  nav: "hygiene",
  render() {
    const money = hyMoney(); const m = monthKey(), pm = prevMonthKey(); const cur = hyWasteSum(hyWMonth(m)), prev = hyWasteSum(hyWMonth(pm));
    const val = (s) => (money && s.priced ? s.cost : s.n);
    const big = !cur.n ? (money ? "0 €" : "0") : money && cur.priced ? hyEur(cur.cost, 0) : hyPl(cur.n, "perte");
    const months = hyMonths(6).map((k) => ({ k, s: hyWasteSum(hyWMonth(k)) })); const mx = Math.max(1, ...months.map((x) => val(x.s)));
    const chart = `<div class="hy-chart">${months.map(({ k, s }, i) => `<div class="hy-bar${k === m ? " now" : ""}" style="--j:${i}"><span class="hy-bv mono">${val(s) ? (money && s.priced ? hyEur(s.cost, 0) : s.n) : ""}</span><i style="height:${Math.max(3, (val(s) / mx) * 100)}%"></i><em>${HY_MS[+k.slice(5) - 1].replace(".", "")}</em></div>`).join("")}</div>`;
    const byR = Object.entries(HY_R).map(([k, [t, ic, c]]) => ({ k, t, ic, c, ...(cur.by[k] || { n: 0, cost: 0 }) })).filter((x) => x.n).sort((a, b) => (money ? b.cost - a.cost : 0) || b.n - a.n);
    const rmax = Math.max(1, ...byR.map((x) => (money && cur.priced ? x.cost : x.n)));
    const reasons = byR.length ? `<div class="glass pad st" style="--i:4"><span class="lbl">Par motif · ${MONTHS[new Date().getMonth()]}</span><div class="hy-rs">${byR.map((x) => `<div class="hy-rr"><span class="hy-rd" style="--c:${x.c}">${ico(x.ic)}</span><div class="tx"><div class="row"><b>${x.t}</b><span class="mono">${money && cur.priced ? hyEur(x.cost) : hyPl(x.n, "fois", "fois")}</span></div><div class="hy-rb"><i style="width:${((money && cur.priced ? x.cost : x.n) / rmax) * 100}%;--c:${x.c}"></i></div></div></div>`).join("")}</div></div>` : "";
    const W = hyArr("waste").slice().sort((a, b) => b.at - a.at).slice(0, S.ui.hyWN || 20);
    const list = `<div class="glass pad st" style="--i:5"><span class="lbl">Dernières pertes</span>${W.length ? W.map((w) => { const R = HY_R[w.reason] || HY_R.abime;
      return `<div class="li tap" data-act="hyWasteOpen" data-id="${w.id}" role="button" tabindex="0"><span class="hy-rd" style="--c:${R[2]}">${ico(R[1])}</span><div class="tx"><b>${esc(w.name)}</b><em>${w.qty ? `${fmt(w.qty, Number.isInteger(+w.qty) ? 0 : 2)} ${esc(hyU(w.qty, w.unit))} · ` : ""}${R[0]} · ${when(w.at)}</em></div>${money && w.cost > 0 ? `<span class="mono hy-wc">${hyEur(w.cost)}</span>` : ""}</div>`; }).join("") + (hyArr("waste").length > W.length ? `<button class="btn ghost sm block" data-act="hyMore" data-v="hyWN">Voir plus</button>` : "") : `<p class="note" style="margin:8px 0 0">Chaque produit jeté s'ajoute ici en deux taps.</p>`}</div>`;
    return `<div class="inner hy">${topBar("Gaspillage")}
      <div class="cols"><div>
        <div class="glass hy-whero st" style="--i:1"><span class="lbl">Ce mois-ci</span><div class="hy-wbig"><b class="mono">${big}</b></div><em class="sub">${cur.n ? (money && cur.priced ? hyPl(cur.n, "produit jeté", "produits jetés") : "jetés depuis le 1er") : "Rien de jeté pour l'instant"}${prev.n ? ` · ${MONTHS[+pm.slice(5) - 1]} : ${money && prev.priced ? hyEur(prev.cost, 0) : prev.n}` : ""}</em>${chart}</div>
        <button class="btn acc block st hy-wgo" style="--i:2" data-act="hyWasteNew">${ico("hygBin")}Jeter un produit</button>
        ${reasons}</div><div>${list}</div></div></div>`;
  },
};
function hyWasteForm() {
  const F = S.ui.hyW; const q = (F.q || "").trim().toLowerCase();
  const recent = []; hyArr("waste").slice().sort((a, b) => b.at - a.at).forEach((w) => { if (recent.length < 6 && !recent.some((r) => r.name === w.name)) recent.push(w); });
  const pr = q ? S.products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6) : [];
  const sug = F.productId || F.name ? [] : q ? pr : recent;
  const cost = F.costEdit ? num(F.cost) : hyCostOf(F.productId, num(F.qty), F.unit);
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell("hygBin", "tomato")}<div><b class="h3">Produit jeté</b><em>Deux taps, c'est noté</em></div></div>
    ${F.name ? `<div class="hy-picked">${ico("box")}<b>${esc(F.name)}</b><button class="iconbtn hy-mini" data-act="hyWClear" aria-label="Changer de produit">${ico("x")}</button></div>`
      : `<label class="field"><span>Produit</span><input class="input" id="hyWQ" value="${esc(F.q || "")}" placeholder="Chercher ou écrire…" autocomplete="off" enterkeyhint="done"></label>
      <div class="hy-sug" id="hyWSug">${hyWSugHtml(sug, q)}</div>`}
    <div class="field"><span>Quantité</span><div class="hy-qrow w"><input class="input mono" id="hyWQty" inputmode="decimal" value="${esc(F.qty || "")}" placeholder="1" aria-label="Quantité"><div class="hy-units sc">${HY_UNITS.map((u) => `<button class="chip${F.unit === u ? " on" : ""}" data-act="hyWUnit" data-v="${u}">${u}</button>`).join("")}</div></div></div>
    <div class="field"><span>Pourquoi ?</span><div class="hy-reasons">${Object.entries(HY_R).map(([k, [t, ic, c]]) => `<button class="hy-reason${F.reason === k ? " on" : ""}" data-act="hyWReason" data-v="${k}" style="--c:${c}">${ico(ic)}<span>${t}</span></button>`).join("")}</div></div>
    ${hyMoney() ? `<label class="field"><span>Coût <em class="hy-opt" id="hyWCostH">${F.costEdit || cost == null ? "facultatif" : "d'après le prix du stock"}</em></span><input class="input mono" id="hyWCost" inputmode="decimal" value="${cost != null ? fmt(cost, 2) : ""}" placeholder="€"></label>` : ""}
    <button class="btn acc block" data-act="hyWasteSave" ${F.name && F.reason ? "" : "disabled"}>Enregistrer</button>
  </div>`;
}
function hyWSugHtml(sug, q) {
  const free = q && !sug.some((p) => p.name.toLowerCase() === q) ? `<button class="chip hy-free" data-act="hyWPickFree">${ico("plus")}« ${esc(q)} »</button>` : "";
  return sug.map((p) => `<button class="chip" data-act="hyWPick" data-id="${esc(p.productId !== undefined ? p.productId || "" : p.id)}" data-v="${esc(p.name)}" data-u="${esc(p.unit || "")}">${esc(p.name)}</button>`).join("") + free;
}
function hyWPaint() { const F = S.ui.hyW; if (!F) return; openSheet(hyWasteForm(), (b) => {
  const q = $("#hyWQ", b); if (q) q.addEventListener("input", () => { F.q = q.value; const s = $("#hyWSug", b); const t = q.value.trim().toLowerCase(); const pr = t ? S.products.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 6) : []; if (s) s.innerHTML = hyWSugHtml(t ? pr : [], t); });
  if (q) q.addEventListener("keydown", (e) => { if (e.key === "Enter" && q.value.trim()) { e.preventDefault(); ACT.hyWPickFree(); } });
  const qty = $("#hyWQty", b); if (qty) qty.addEventListener("input", () => { F.qty = qty.value; if (!F.costEdit) { const c = $("#hyWCost", b); const v = hyCostOf(F.productId, num(F.qty), F.unit); if (c) c.value = v != null ? fmt(v, 2) : ""; const h = $("#hyWCostH", b); if (h) h.textContent = v != null ? "d'après le prix du stock" : "facultatif"; } });
  const c = $("#hyWCost", b); if (c) c.addEventListener("input", () => { F.costEdit = true; F.cost = c.value; const h = $("#hyWCostH", b); if (h) h.textContent = "facultatif"; });
}); }

/* ═════════════════════ 4 · Coffre-fort documents ═════════════════════ */
const HY_DC = [
  ["nuisibles", "Dératisation", "hygBug", "Contrat dératisation", 12, "#7A5A1A", "saffron"],
  ["fournisseurs", "Fournisseurs", "truck", "Attestation fournisseur", 12, "#2F5FBF", "sky"],
  ["labo", "Analyses labo", "hygFlask", "Analyse labo", 12, "#5B2BFF", "violet"],
  ["kbis", "Kbis", "hygDoc", "Extrait Kbis", 3, "#4A4560", "neu"],
  ["assurance", "Assurance", "hygUmb", "Attestation d'assurance", 12, "#1E7F55", "mint"],
  ["formation", "Formations", "hygCap", "Attestation formation HACCP", 0, "#C8432A", "tomato"],
  ["autre", "Autres", "hygVault", "Document", 0, "#4A4560", "neu"],
];
const hyDC = (k) => HY_DC.find((c) => c[0] === k) || HY_DC[HY_DC.length - 1];
function hyDocState(d) {
  if (!d.expiry) return { st: "none", tx: "Sans date", d: null };
  const n = daysUntil(d.expiry); const rem = d.remind ?? 30;
  if (n < 0) return { st: "late", tx: n === -1 ? "Expiré hier" : `Expiré depuis ${-n} j`, d: n };
  if (n <= rem) return { st: "soon", tx: n === 0 ? "Expire aujourd'hui" : `Expire dans ${n} j`, d: n };
  const e = parseDay(d.expiry); return { st: "ok", tx: `<i>Valide · </i>${HY_MS[e.getMonth()]} ${e.getFullYear()}`, d: n };
}
const hyDocs = () => hyArr("docs").slice().sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999") || (a.name || "").localeCompare(b.name || "", "fr"));
function hyThumb(d) {
  const f = (d.files || [])[0]; const C = hyDC(d.cat);
  if (!f) return `<span class="hy-th none" style="--c:${C[5]}">${ico(C[2])}</span>`;
  if (hyIsPdf(f)) return `<span class="hy-th pdf"><b>PDF</b></span>`;
  const u = hyFileUrl(f); return `<span class="hy-th"><img src="${esc(u || PIXEL)}" alt=""${hyIsLoc(f.id) ? ` data-photo="${esc(f.id)}"` : ""} loading="lazy"></span>`;
}
VIEWS.documents = {
  nav: "hygiene",
  render() {
    const D = hyDocs(); const cnt = { late: 0, soon: 0, ok: 0, none: 0 }; D.forEach((d) => cnt[hyDocState(d).st]++);
    const right = `<button class="btn acc sm hy-add" data-act="hyDocNew">${ico("plus")}<span>Ajouter</span></button>`;
    const head = D.length ? `<div class="hy-dsum st" style="--i:1">${[["late", "Expirés"], ["soon", "Bientôt"], ["ok", "À jour"]].filter(([k]) => cnt[k] || k === "ok").map(([k, t]) => `<span class="hy-ds ${k}"><b class="mono">${cnt[k]}</b>${t}</span>`).join("")}</div>` : "";
    const secs = HY_DC.map((C, ci) => {
      const L = D.filter((d) => (hyDC(d.cat)[0]) === C[0]);
      if (!L.length && C[0] === "autre") return "";
      const rows = L.map((d) => { const s = hyDocState(d); return `<div class="li tap hy-drow" data-act="hyDocOpen" data-id="${d.id}" role="button" tabindex="0">${hyThumb(d)}<div class="tx"><b>${esc(d.name)}</b><em>${(d.files || []).length > 1 ? `${d.files.length} fichiers · ` : ""}${d.by ? esc(firstName(d.by)) + " · " : ""}${shortDate(dayKey(new Date(d.at || Date.now())))}</em></div><span class="hy-exp ${s.st}">${s.tx}</span></div>`; }).join("");
      const add = !L.length ? `<button class="hy-dadd" data-act="hyDocNew" data-v="${C[0]}">${ico("plus")}<span>${esc(C[3])}</span></button>` : "";
      return `<section class="hy-dsec st" style="--i:${Math.min(ci + 2, 8)}"><div class="hy-dsh">${hyWell(C[2], C[6], "sm")}<b>${C[1]}</b>${L.length ? `<em class="mono">${L.length}</em><button class="hy-dplus" data-act="hyDocNew" data-v="${C[0]}" aria-label="Ajouter : ${esc(C[1])}">${ico("plus")}</button>` : ""}</div>${rows ? `<div class="glass hy-dl">${rows}</div>` : add}</section>`;
    }).join("");
    return `<div class="inner hy">${topBar("Documents", { right })}${head}${!D.length ? `<div class="glass hy-hello st" style="--i:1">${hyWell("hygVault", "violet", "lg")}<b class="h3">Tous vos papiers au même endroit</b><p class="sub">Photographiez ou joignez le PDF. On vous prévient avant qu'il expire.</p></div>` : ""}<div class="hy-dgrid">${secs}</div></div>`;
  },
};
function hyDocForm() {
  const F = S.ui.hyD; const C = hyDC(F.cat);
  const quick = [[3, "+3 mois"], [12, "+1 an"], [36, "+3 ans"]];
  const addM = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return dayKey(d); };
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell(C[2], C[6])}<div><b class="h3">${F.id ? "Modifier" : "Ranger un document"}</b><em>${C[1]}</em></div></div>
    <div class="chips hy-dcats">${HY_DC.map((c) => `<button class="chip${F.cat === c[0] ? " on" : ""}" data-act="hyDCat" data-v="${c[0]}">${ico(c[2])}${c[1]}</button>`).join("")}</div>
    <label class="field"><span>Nom</span><input class="input" id="hyDName" value="${esc(F.name)}" placeholder="${esc(C[3])}" autocomplete="off"></label>
    <div class="field"><span>Fichiers</span><div class="hy-files">${F.files.map((f, i) => `<div class="hy-pf${hyIsPdf(f) ? " pdf" : ""}">${hyIsPdf(f) ? `<b>PDF</b><em>${esc(f.name)}</em>` : `<img src="${esc(f.url || hyFileUrl(f))}" alt="">`}<button class="hy-pfx" data-act="hyDRm" data-v="${i}" aria-label="Retirer">${ico("x")}</button></div>`).join("")}
      <button class="hy-shot" data-act="hyDPhoto">${ico("camera")}<span>${F.files.length ? "Autre photo" : "Photographier"}</span></button><button class="hy-shot" data-act="hyDPdf">${ico("hygPdf")}<span>Joindre un PDF</span></button></div>${F.busy ? `<p class="hy-verdict">Enregistrement du fichier…</p>` : ""}</div>
    <div class="field"><span>Expire le <em class="hy-opt">facultatif</em></span><div class="hy-exq">${quick.map(([m, t]) => `<button class="chip${F.expiry === addM(m) ? " on" : ""}" data-act="hyDExp" data-v="${addM(m)}">${t}</button>`).join("")}<button class="chip${!F.expiry ? " on" : ""}" data-act="hyDExp" data-v="">Pas de date</button></div>
      <input class="input" type="date" id="hyDExpI" value="${esc(F.expiry || "")}" aria-label="Date d'expiration"></div>
    ${F.expiry ? `<div class="field"><span>Me prévenir</span><div class="hy-exq">${[[15, "15 j avant"], [30, "1 mois avant"], [60, "2 mois avant"]].map(([d, t]) => `<button class="chip${+F.remind === d ? " on" : ""}" data-act="hyDRem" data-v="${d}">${t}</button>`).join("")}</div></div>` : ""}
    <button class="btn acc block" data-act="hyDocSave" ${F.busy ? "disabled" : ""}>${F.id ? "Enregistrer" : "Ranger dans le coffre"}</button>
  </div>`;
}
function hyDPaint() { const F = S.ui.hyD; if (!F) return; openSheet(hyDocForm(), (b) => {
  const n = $("#hyDName", b); if (n) n.addEventListener("input", () => { F.name = n.value; F.named = true; });
  const e = $("#hyDExpI", b); if (e) e.addEventListener("change", () => { F.expiry = e.value || ""; hyDPaint(); });
}); }
function hyDocView(d) {
  const C = hyDC(d.cat), s = hyDocState(d); const F = d.files || [];
  return `<div class="hy-sh">
    <div class="hy-shh">${hyWell(C[2], C[6])}<div><b class="h3">${esc(d.name)}</b><em>${C[1]} · <span class="hy-expt ${s.st}">${s.tx.replace(/<\/?i>/g, "")}</span></em></div></div>
    ${F.length ? `<div class="hy-gal">${F.map((f) => { const u = hyFileUrl(f); const ph = hyIsLoc(f.id) ? ` data-photo="${esc(f.id)}"` : "";
      return hyIsPdf(f) ? `<a class="hy-gpdf" href="${esc(u || "#")}"${ph} target="_blank" rel="noopener"><b>PDF</b><span>${esc(f.name || "document.pdf")}</span>${ico("out")}</a>` : `<a class="hy-gimg" href="${esc(u || "#")}"${ph} target="_blank" rel="noopener" aria-label="Voir en grand"><img src="${esc(u || PIXEL)}" alt=""${ph}></a>`; }).join("")}</div>` : `<p class="note">Aucun fichier joint.</p>`}
    <div class="hy-kv">${[d.expiry ? ["Expire le", hyFull(d.expiry)] : null, d.expiry ? ["Rappel", `${d.remind ?? 30} jours avant`] : null, ["Ajouté", `${hyFull(dayKey(new Date(d.at || Date.now())))}${d.by ? " · " + esc(firstName(d.by)) : ""}`]].filter(Boolean).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
    <div class="grid2"><button class="btn soft" data-act="hyDocEdit" data-id="${d.id}">${ico("edit")}Modifier</button><button class="btn acc" data-act="hyDocRenew" data-id="${d.id}">${ico("upload")}Nouvelle version</button></div>
    ${hyCan("editSettings") ? `<button class="btn ghost sm block hy-del" data-act="hyDocDel" data-id="${d.id}">${ico("trash")}Supprimer</button>` : ""}
  </div>`;
}
async function hyAttach(files) {
  const F = S.ui.hyD; if (!F) return; F.busy = true; hyDPaint();
  for (const f of files) {
    const pdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name || "");
    if (!pdf && !/^image\//.test(f.type)) { SFX.err(); toast("Seuls les PDF et les photos sont acceptés.", "err"); continue; }
    if (f.size > 20 * 1048576) { SFX.err(); toast(`« ${f.name} » est trop lourd (20 Mo max).`, "err"); continue; }
    let blob = f; if (!pdf) { try { blob = (await shrink(f, 1800, 0.8)).blob || f; } catch (e) {} }
    try { const r = await upload(blob); F.files.push({ id: r.id, url: r.url, name: pdf ? f.name || "document.pdf" : `${hyDC(F.cat)[0]}-${dayKey()}.jpg`, type: pdf ? "application/pdf" : "image/jpeg" }); F.added = (F.added || 0) + 1; SFX.scan(); buzz(6); }
    catch (e) { console.warn(e); SFX.err(); toast("Impossible de garder ce fichier sur l'appareil.", "err"); }
  }
  if (S.ui.hyD === F) { F.busy = false; hyDPaint(); }
}

/* ═════════════════════ hub ═════════════════════ */
VIEWS.hygiene = {
  render() {
    const R = hyRunning(), Fx = hyToFix(), A = hyFryers().map((f) => ({ f, s: hyFryState(f) })), W = hyWasteSum(hyWMonth()), D = HYG.expiringDocs();
    const top = R[0]; const money = hyMoney();
    const hero = top ? (() => { const K = hyKind(top), ph = hyPhase(top), left = top.startAt + K.lim - Date.now();
      return `<button class="wall hy-hero st ${ph}" style="--i:1" data-go="refroid"><span class="hy-hk">${ico(K.ic)}${K.t}${R.length > 1 ? ` · ${R.length} en cours` : ""}</span><b class="hy-hcd mono" data-hy-cd="${top.id}">${hyCd(Math.abs(left))}</b><span class="hy-hp">${esc(top.plat)} · ${ph === "late" ? "délai dépassé" : ph === "due" ? "à mesurer maintenant" : `objectif ${K.goal} avant ${hm(top.startAt + K.lim)}`}</span><span class="hy-hb">Mesurer${ico("chev")}</span></button>`; })() : "";
    const fryBad = A.filter((x) => x.s.st === "bad").length, fryWarn = A.filter((x) => x.s.st === "warn").length;
    const lastCool = hyArr("cool").filter((b) => b.status && b.status !== "run").sort((a, b) => b.startAt - a.startAt)[0];
    const tiles = [
      ["refroid", "snow", "sky", "Refroidissement", R.length ? `${R.length} en cours` : Fx.length ? "Action à noter" : lastCool ? `Dernier : ${when(lastCool.startAt)}` : "63 → 10 °C en 2 h", Fx.length ? "bad" : R.length ? "acc" : ""],
      ["friture", "hygOil", "saffron", "Huile de friture", !A.length ? "Ajouter une friteuse" : fryBad ? "Huile à changer" : fryWarn ? "À surveiller" : "Huile correcte", fryBad ? "bad" : fryWarn ? "warn" : A.length ? "ok" : ""],
      ["gaspillage", "hygBin", "tomato", "Gaspillage", W.n ? (money && W.priced ? `${hyEur(W.cost, 0)} ce mois` : `${hyPl(W.n, "perte")} ce mois`) : "Rien ce mois-ci", ""],
      ["documents", "hygVault", "violet", "Documents", D.some((d) => d.late) ? hyPl(D.filter((d) => d.late).length, "expiré") : D.length ? `${D.length} à renouveler` : hyArr("docs").length ? hyPl(hyArr("docs").length, "document") : "Kbis, assurance…", D.some((d) => d.late) ? "bad" : D.length ? "warn" : ""],
    ];
    return `<div class="inner hy">${topBar("Hygiène")}${hero}
      <div class="hy-tiles">${tiles.map(([r, ic, tone, t, sub, st], i) => `<button class="hy-tile st" style="--i:${i + 2}" data-go="${r}">${hyWell(ic, tone, "lg")}<b>${t}</b><span class="hy-ts ${st}">${esc(sub)}</span></button>`).join("")}</div></div>`;
  },
};

/* ═════════════════════ actions ═════════════════════ */
const hyNow = () => ({ at: Date.now(), day: dayKey(), ...hyMe() });
Object.assign(ACT, {
  hyMore: (a, id, v) => { SFX.tap(); S.ui[v] = (S.ui[v] || 20) + 25; rerender(); },
  hyTStep: (a, id, v) => { const e = $("#" + id); if (!e) return; const t = num(e.value); const base = t == null ? num(e.placeholder) || 0 : t; e.value = fmt(Math.round((base + +v) * 10) / 10, Number.isInteger(base + +v) ? 0 : 1); SFX.tick(); buzz(3); e.dispatchEvent(new Event("input", { bubbles: true })); },

  /* refroidissement */
  hyCoolNew: (a, id, v) => { SFX.tap(); S.ui.hyCool = { kind: v === "remise" ? "remise" : "refroid", plat: "", noteId: null, qty: "", unit: "kg", cell: 1, t0: "" }; hyCoolPaint(); setTimeout(() => { const e = $("#hyPlat"); if (e && DESK_MQ.matches) e.focus(); }, 380); },
  hyCoolKind: (a, id, v) => { const F = S.ui.hyCool; if (!F || F.kind === v) return; F.kind = v; SFX.tick(); hyCoolPaint(); },
  hyCoolRec: (a, id) => { const F = S.ui.hyCool; const n = S.notes.find((x) => x.id === id); if (!F || !n) return; SFX.tick(); if (F.noteId === id) { F.noteId = null; F.plat = ""; } else { F.noteId = id; F.plat = n.title; } hyCoolPaint(); },
  hyCoolUnit: (a, id, v) => { const F = S.ui.hyCool; if (!F) return; F.unit = v; SFX.tick(); $$(".hy-units .chip[data-act=hyCoolUnit]").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); },
  hyCoolCell: (a, id, v) => { const F = S.ui.hyCool; if (!F) return; F.cell = +v; SFX.tick(); $$(".hy-units .chip[data-act=hyCoolCell]").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); },
  hyCoolGo: async (a) => {
    const F = S.ui.hyCool; if (!F) return; const plat = (F.plat || "").trim(); const t0 = num(F.t0);
    if (!plat) { SFX.err(); toast("Indiquez le plat", "err"); const e = $("#hyPlat"); e && e.focus(); return; }
    if (F.kind === "refroid" && t0 == null) { SFX.err(); toast("Notez la température de départ", "err"); const e = $("#hyT0"); e && e.focus(); return; }
    if (t0 != null && (t0 < -30 || t0 > 120)) { SFX.err(); toast("Température improbable", "err"); return; }
    a.disabled = true; hyAskNotify();
    const d = { kind: F.kind, plat, ...(F.noteId ? { noteId: F.noteId } : {}), ...(num(F.qty) ? { qty: num(F.qty), unit: F.unit } : {}), ...(F.kind === "refroid" ? { cell: !!F.cell } : {}), startAt: Date.now(), t0: t0 ?? null, checks: [], status: "run", ...hyNow() };
    try { await safe(DB.add("cooling", d)); } catch (e) { a.disabled = false; return; }
    const K = HY_K[F.kind]; logEvent("cooling", `a lancé ${F.kind === "refroid" ? "le refroidissement" : "la remise en température"} : ${plat}${t0 != null ? ` · ${hyDeg(t0)} au départ` : ""}`);
    S.ui.hyCool = null; closeSheet(); SFX.ok(); buzz(10); toast(`Chrono lancé · mesure avant ${hm(d.startAt + K.lim)}`);
    if (S.route !== "refroid") go("refroid");
  },
  hyCoolMore: (a, id) => { const b = hyCool(id); if (!b) return; SFX.tap(); openSheet(hyCoolDetail(b)); },
  hyCoolOpen: (a, id) => { const b = hyCool(id); if (!b) return; SFX.tap(); openSheet(hyCoolDetail(b)); },
  hyCoolStop: async (a, id) => { const b = hyCool(id); if (!b) return; if (!a.dataset.sure) { a.dataset.sure = "1"; a.textContent = "Toucher encore pour arrêter"; SFX.tap(); return; } await safe(DB.update("cooling", id, { status: "stop", endAt: Date.now() })).catch(() => {}); logEvent("cooling", `a arrêté le suivi : ${b.plat}`); closeSheet(); SFX.close(); toast("Suivi arrêté"); },
  hyCoolDel: async (a, id) => { const b = hyCool(id); if (!b) return; if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Toucher encore pour supprimer"; SFX.tap(); return; } await safe(DB.del("cooling", id)).catch(() => {}); closeSheet(); SFX.close(); toast("Supprimé"); },
  hyMeasure: (a, id) => { const b = hyCool(id); if (!b) return; SFX.tap(); S.ui.hyT1 = ""; openSheet(hyMeasureForm(b), (bd) => { const e = $("#hyT1", bd); if (e) { e.addEventListener("input", () => hyT1Verdict(bd, b)); e.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); ACT.hyMeasureOk($("[data-act=hyMeasureOk]", bd), id); } }); setTimeout(() => { try { e.focus(); } catch (x) {} }, 380); } }); },
  hyMeasureOk: async (a, id) => {
    const b = hyCool(id); const e = $("#hyT1"); if (!b || !e) return; const t = num(e.value);
    if (t == null || t < -30 || t > 120) { SFX.err(); toast("Notez la température à cœur", "err"); e.focus(); return; }
    const K = hyKind(b), now = Date.now(), late = now - b.startAt > K.lim, good = K.ok(t); a.disabled = true;
    if (good && !late) {
      await safe(DB.update("cooling", id, { status: "ok", endAt: now, t1: t })).catch(() => {});
      logEvent("cooling", `${b.kind === "refroid" ? "refroidissement" : "remise en température"} conforme : ${b.plat} · ${hyDeg(b.t0)} → ${hyDeg(t)} en ${hyDur(now - b.startAt)}`);
      closeSheet(); SFX.done(); buzz([10, 40, 10]); burst(); toast(`Conforme · ${hyDeg(t)} en ${hyDur(now - b.startAt)}`); return;
    }
    if (!good && !late) {
      await safe(DB.update("cooling", id, { checks: [...(b.checks || []), { at: now, t }] })).catch(() => {});
      closeSheet(); SFX.tick(); buzz(6); toast(`${hyDeg(t)} noté · on continue`, "info"); return;
    }
    await safe(DB.update("cooling", id, { status: "ko", endAt: now, t1: t })).catch(() => {});
    logEvent("cooling", `${b.kind === "refroid" ? "refroidissement" : "remise en température"} non conforme : ${b.plat} · ${hyDeg(t)} après ${hyDur(now - b.startAt)}`);
    SFX.err(); buzz([40, 60, 40]); S.ui.hyAct = {}; setTimeout(() => { const nb = hyCool(id) || { ...b, status: "ko", endAt: now, t1: t }; openSheet(hyActionForm(nb)); }, 120);
  },
  hyAction: (a, id) => { const b = hyCool(id); if (!b) return; SFX.tap(); S.ui.hyAct = { a: b.action || "", note: b.actionNote || "" }; openSheet(hyActionForm(b)); },
  hyActPick: (a, id, v) => { const F = (S.ui.hyAct ||= {}); F.a = v; const n = $("#hyActNote"); if (n) F.note = n.value; SFX.tick(); $$(".hy-act").forEach((x) => x.classList.toggle("on", x.dataset.v === v)); const s = $("[data-act=hyActSave]"); if (s) s.disabled = false; },
  hyActSave: async (a, id) => {
    const b = hyCool(id); const F = S.ui.hyAct || {}; if (!b || !F.a) return; const note = ($("#hyActNote") || {}).value || "";
    await safe(DB.update("cooling", id, { action: F.a, actionNote: note.trim() })).catch(() => {});
    logEvent("cooling", `action corrective : ${b.plat} · ${F.a.toLowerCase()}${note.trim() ? ` (${note.trim()})` : ""}`);
    S.ui.hyAct = null; closeSheet(); SFX.ok(); toast("Action corrective notée");
  },

  /* friture */
  hyFryEdit: (a, id) => { if (!hyCan("editSettings")) { SFX.err(); toast("Réglage réservé : demandez au gérant.", "err"); return; } const f = id && hyArr("fry").find((x) => x.id === id); SFX.tap(); S.ui.hyFE = { name: f ? f.name : hyFryers().length ? `Friteuse ${hyFryers().length + 1}` : "Friteuse", every: f ? +f.every || 8 : 8 }; openSheet(hyFryEditForm(f), (b) => { const n = $("#hyFName", b); if (n) n.addEventListener("input", () => { S.ui.hyFE.name = n.value; }); }); },
  hyFEvery: (a, id, v) => { const E = S.ui.hyFE; if (!E) return; E.every = Math.max(1, Math.min(60, E.every + +v)); const b = $("#hyFEv"); if (b) b.textContent = E.every; SFX.tick(); buzz(3); },
  hyFrySave: async (a, id) => {
    const E = S.ui.hyFE; if (!E) return; const name = (E.name || "").trim() || "Friteuse"; a.disabled = true;
    try { if (id) await safe(DB.update("fryers", id, { name, every: E.every })); else await safe(DB.add("fryers", { name, every: E.every, svc: 0, lastChange: null, order: Date.now(), createdAt: Date.now() })); } catch (e) { a.disabled = false; return; }
    S.ui.hyFE = null; closeSheet(); SFX.ok(); toast(id ? "Enregistré" : "Friteuse ajoutée");
  },
  hyFryDel: async (a, id) => { if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Toucher encore pour retirer"; SFX.tap(); return; } await safe(DB.update("fryers", id, { archived: true })).catch(() => {}); closeSheet(); SFX.close(); toast("Friteuse retirée"); },
  hyFrySvc: async (a, id) => {
    const f = hyArr("fry").find((x) => x.id === id); if (!f) return; const n = (+f.svc || 0) + 1; SFX.tick(); buzz(5);
    a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop");
    await DB.update("fryers", id, { svc: n }).catch(() => {});
    const every = +f.every || 8; if (n === every) { SFX.err(); toast(`${f.name} : ${every} services, pensez à changer l'huile`, "info"); } else toast(`${n}/${every} services`);
  },
  hyFryTest: (a, id) => { const f = hyArr("fry").find((x) => x.id === id); if (!f) return; SFX.tap(); let m = "testeur"; try { m = localStorage.getItem("gg-hyg-test") || "testeur"; } catch (e) {} S.ui.hyTest = { id, method: m, pct: "", level: null }; hyTestPaint(f); },
  hyTestM: (a, id, v) => { const T = S.ui.hyTest; if (!T) return; T.method = v; try { localStorage.setItem("gg-hyg-test", v); } catch (e) {} SFX.tick(); hyTestPaint(hyArr("fry").find((x) => x.id === T.id)); },
  hyTestL: (a, id, v) => { const T = S.ui.hyTest; if (!T) return; T.level = v; SFX.tick(); buzz(4); $$(".hy-strip").forEach((x) => x.classList.toggle("on", x.dataset.v === v)); },
  hyTestSave: async (a, id) => {
    const T = S.ui.hyTest; const f = hyArr("fry").find((x) => x.id === id); if (!T || !f) return;
    let pct; if (T.method === "testeur") { pct = num(($("#hyPct") || {}).value); if (pct == null || pct < 0 || pct > 60) { SFX.err(); toast("Notez le pourcentage lu", "err"); return; } }
    else { const s = HY_STRIPS.find((x) => x[0] === T.level); if (!s) { SFX.err(); toast("Choisissez la couleur", "err"); return; } pct = s[2]; }
    a.disabled = true;
    try { await safe(DB.add("fryLogs", { fryerId: id, kind: "test", pct, method: T.method, ...(T.method === "bandelette" ? { level: T.level } : {}), ...hyNow() })); } catch (e) { a.disabled = false; return; }
    logEvent("fryer", `a testé l'huile · ${f.name} · ${fmt(pct, 0)} % de composés polaires${pct >= HY_LIM ? " · à changer" : ""}`);
    S.ui.hyTest = null;
    if (pct >= HY_LIM) { SFX.err(); buzz([40, 60, 40]); openSheet(`<div class="hy-sh"><div class="hy-shh">${hyWell("alert", "tomato")}<div><b class="h3">Huile à changer</b><em>${esc(f.name)} · ${fmt(pct, 0)} % (limite 25 %)</em></div></div><p class="sub">Au-delà de 25 %, l'huile ne doit plus servir. Changez-la avant le prochain service.</p><button class="btn saffron block" data-act="hyFryChange" data-id="${id}" data-sure="1">${ico("hygOil")}C'est fait, huile changée</button><button class="btn ghost block" data-act="sheetClose">Plus tard</button></div>`); return; }
    closeSheet(); SFX.ok(); buzz(8); toast(pct >= HY_WARN ? `${fmt(pct, 0)} % · à surveiller` : `${fmt(pct, 0)} % · huile correcte`);
  },
  hyFryChange: async (a, id) => {
    const f = hyArr("fry").find((x) => x.id === id); if (!f) return;
    if (!a.dataset.sure) { a.dataset.sure = "1"; const s = a.lastChild; if (s && s.nodeType === 3) s.textContent = "Confirmer"; SFX.tap(); buzz(4); setTimeout(() => { if (a.isConnected) { delete a.dataset.sure; if (s && s.nodeType === 3) s.textContent = "Huile changée"; } }, 3500); return; }
    a.disabled = true; const now = Date.now();
    try { await safe(DB.add("fryLogs", { fryerId: id, kind: "change", ...hyNow(), at: now })); await safe(DB.update("fryers", id, { svc: 0, lastChange: now })); } catch (e) { a.disabled = false; return; }
    logEvent("fryer", `a changé l'huile · ${f.name}`); closeSheet(); SFX.done(); buzz([10, 40, 10]); toast("Huile neuve, compteur remis à zéro");
  },

  /* gaspillage */
  hyWasteNew: () => { SFX.tap(); S.ui.hyW = { q: "", name: "", productId: null, qty: "", unit: "kg", reason: null, cost: "", costEdit: false }; hyWPaint(); setTimeout(() => { const e = $("#hyWQ"); if (e && DESK_MQ.matches) e.focus(); }, 380); },
  hyWPick: (a, id, v) => { const F = S.ui.hyW; if (!F) return; const p = id && S.products.find((x) => x.id === id); F.name = v; F.productId = p ? p.id : null; if (a.dataset.u && HY_UNITS.includes(a.dataset.u)) F.unit = a.dataset.u; else if (p && HY_UNITS.includes(p.unit)) F.unit = p.unit; SFX.tick(); buzz(4); hyWPaint(); setTimeout(() => { const e = $("#hyWQty"); if (e) e.focus(); }, 60); },
  hyWPickFree: () => { const F = S.ui.hyW; if (!F) return; const q = (($("#hyWQ") || {}).value || F.q || "").trim(); if (!q) return; const p = S.products.find((x) => x.name.toLowerCase() === q.toLowerCase()); F.name = p ? p.name : q; F.productId = p ? p.id : null; if (p && HY_UNITS.includes(p.unit)) F.unit = p.unit; SFX.tick(); hyWPaint(); },
  hyWClear: () => { const F = S.ui.hyW; if (!F) return; F.name = ""; F.productId = null; F.q = ""; SFX.tap(); hyWPaint(); },
  hyWUnit: (a, id, v) => { const F = S.ui.hyW; if (!F) return; F.qty = ($("#hyWQty") || {}).value ?? F.qty; F.unit = v; SFX.tick(); hyWPaint(); },
  hyWReason: (a, id, v) => { const F = S.ui.hyW; if (!F) return; F.reason = v; F.qty = ($("#hyWQty") || {}).value ?? F.qty; SFX.tick(); buzz(4); $$(".hy-reason").forEach((x) => x.classList.toggle("on", x.dataset.v === v)); const s = $("[data-act=hyWasteSave]"); if (s) s.disabled = !F.name; },
  hyWasteSave: async (a) => {
    const F = S.ui.hyW; if (!F || !F.name || !F.reason) return; const qty = num(($("#hyWQty") || {}).value) || 1; const cEl = $("#hyWCost");
    const cost = cEl ? num(cEl.value) : hyCostOf(F.productId, qty, F.unit); a.disabled = true; const now = Date.now();
    const d = { name: F.name, ...(F.productId ? { productId: F.productId } : {}), qty, unit: F.unit, reason: F.reason, cost: cost != null && cost >= 0 ? Math.round(cost * 100) / 100 : null, month: monthKey(), ...hyNow(), at: now };
    let moveId = null;
    if (F.productId && typeof stockMove === "function") { const p = S.products.find((x) => x.id === F.productId); const q = p ? hyConv(qty, F.unit, p.unit) : null; if (q != null) { try { moveId = await stockMove({ productId: F.productId, qty: -q, kind: "perte", reason: HY_R[F.reason][0], refType: "waste" }); } catch (e) {} } }
    if (moveId) d.moveId = moveId;
    let id; try { id = await safe(DB.add("waste", d)); } catch (e) { a.disabled = false; return; }
    if (!moveId) logEvent("waste", `a jeté ${fmt(qty, Number.isInteger(qty) ? 0 : 2)} ${hyU(qty, F.unit)} de ${F.name} · ${HY_R[F.reason][0].toLowerCase()}`);
    S.ui.hyW = null; closeSheet(); SFX.ok(); buzz(8);
    toast(`${F.name} noté`); const t = $("#toast"); $("#toastTx").innerHTML = `<span class="tx">${esc(F.name)} noté</span><button data-act="hyWUndo" data-id="${esc(id)}">Annuler</button>`; t.style.pointerEvents = "auto"; clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 4500);
  },
  hyWUndo: async (a, id) => { const w = hyArr("waste").find((x) => x.id === id); await DB.del("waste", id).catch(() => {}); if (w && w.moveId) await DB.del("moves", w.moveId).catch(() => {}); $("#toast").classList.remove("on"); SFX.close(); },
  hyWasteOpen: (a, id) => {
    const w = hyArr("waste").find((x) => x.id === id); if (!w) return; SFX.tap(); const R = HY_R[w.reason] || HY_R.abime;
    openSheet(`<div class="hy-sh"><div class="hy-shh"><span class="hy-rd lg" style="--c:${R[2]}">${ico(R[1])}</span><div><b class="h3">${esc(w.name)}</b><em>${R[0]} · ${when(w.at)}</em></div></div>
      <div class="hy-kv">${[["Quantité", `${fmt(w.qty, Number.isInteger(+w.qty) ? 0 : 2)} ${esc(hyU(w.qty, w.unit))}`], hyMoney() && w.cost > 0 ? ["Coût", hyEur(w.cost)] : null, ["Par", esc(w.by || nameOf(w.uid))], w.moveId ? ["Stock", "Sorti du stock"] : null].filter(Boolean).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
      <button class="btn danger block" data-act="hyWasteDel" data-id="${w.id}">${ico("trash")}Supprimer cette perte</button></div>`);
  },
  hyWasteDel: async (a, id) => { const w = hyArr("waste").find((x) => x.id === id); if (!w) return; if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Toucher encore pour supprimer"; SFX.tap(); return; } await safe(DB.del("waste", id)).catch(() => {}); if (w.moveId) await DB.del("moves", w.moveId).catch(() => {}); closeSheet(); SFX.close(); toast("Perte supprimée"); },

  /* documents */
  hyDocNew: (a, id, v) => { SFX.tap(); const cat = HY_DC.some((c) => c[0] === v) ? v : "nuisibles"; const C = hyDC(cat); const ex = C[4] ? (() => { const d = new Date(); d.setMonth(d.getMonth() + C[4]); return dayKey(d); })() : ""; S.ui.hyD = { cat, name: v ? C[3] : "", files: [], expiry: v ? ex : "", remind: 30, busy: false }; hyDPaint(); },
  hyDCat: (a, id, v) => { const F = S.ui.hyD; if (!F) return; F.cat = v; const C = hyDC(v); if (!F.named || !F.name) F.name = C[3]; if (!F.id && !F.expTouched) { if (C[4]) { const d = new Date(); d.setMonth(d.getMonth() + C[4]); F.expiry = dayKey(d); } else F.expiry = ""; } SFX.tick(); hyDPaint(); },
  hyDExp: (a, id, v) => { const F = S.ui.hyD; if (!F) return; F.expiry = v; F.expTouched = true; SFX.tick(); hyDPaint(); },
  hyDRem: (a, id, v) => { const F = S.ui.hyD; if (!F) return; F.remind = +v; SFX.tick(); hyDPaint(); },
  hyDPhoto: async () => { const files = await pickImage(); if (files.length) await hyAttach(files); },
  hyDPdf: () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/pdf,image/*"; inp.multiple = true; inp.hidden = true; document.body.appendChild(inp); inp.addEventListener("change", async () => { const fs = [...(inp.files || [])]; inp.remove(); if (fs.length) await hyAttach(fs); }, { once: true }); inp.click(); },
  hyDRm: (a, id, v) => { const F = S.ui.hyD; if (!F) return; const [f] = F.files.splice(+v, 1); if (f && !(F.orig || []).some((x) => x.id && x.id === f.id)) hyRmFile(f); SFX.close(); hyDPaint(); },
  hyDocSave: async (a) => {
    const F = S.ui.hyD; if (!F || F.busy) return; const C = hyDC(F.cat); const name = (($("#hyDName") || {}).value || F.name || "").trim() || C[3];
    if (!F.files.length && (!F.id || F.renew)) { SFX.err(); toast("Ajoutez une photo ou un PDF", "err"); return; }
    a.disabled = true; const files = F.files.map((f) => ({ id: f.id, name: f.name, type: f.type, ...(hyIsLoc(f.id) ? {} : { url: f.url }) }));
    const d = { cat: F.cat, name, expiry: F.expiry || null, remind: +F.remind || 30, files, updatedAt: Date.now() };
    try { if (F.id) await safe(DB.update("vault", F.id, d)); else await safe(DB.add("vault", { ...d, ...hyNow() })); } catch (e) { a.disabled = false; return; }
    (F.orig || []).forEach((o) => { if (!files.some((f) => f.id === o.id)) hyRmFile(o); });
    logEvent("doc", `${F.id ? "a mis à jour" : "a rangé"} un document : ${name}${F.expiry ? ` · expire le ${shortDate(F.expiry)}` : ""}`);
    S.ui.hyD = null; closeSheet(); SFX.ok(); buzz(8); toast(F.id ? "Document mis à jour" : "Rangé dans le coffre");
  },
  hyDocOpen: (a, id) => { const d = hyArr("docs").find((x) => x.id === id); if (!d) return; SFX.tap(); openSheet(hyDocView(d)); },
  hyDocEdit: (a, id) => { const d = hyArr("docs").find((x) => x.id === id); if (!d) return; SFX.tap(); S.ui.hyD = { id, cat: hyDC(d.cat)[0], name: d.name, named: true, files: (d.files || []).map((f) => ({ ...f })), orig: d.files || [], expiry: d.expiry || "", expTouched: true, remind: d.remind ?? 30, busy: false }; hyDPaint(); },
  hyDocRenew: (a, id) => { const d = hyArr("docs").find((x) => x.id === id); if (!d) return; SFX.tap(); const C = hyDC(d.cat); const ex = C[4] ? (() => { const x = new Date(); x.setMonth(x.getMonth() + C[4]); return dayKey(x); })() : ""; S.ui.hyD = { id, cat: C[0], name: d.name, named: true, files: [], orig: d.files || [], expiry: ex, remind: d.remind ?? 30, busy: false, renew: true }; hyDPaint(); },
  hyDocDel: async (a, id) => { const d = hyArr("docs").find((x) => x.id === id); if (!d) return; if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Toucher encore pour supprimer"; SFX.tap(); return; } await safe(DB.del("vault", id)).catch(() => {}); (d.files || []).forEach(hyRmFile); logEvent("doc", `a supprimé un document : ${d.name}`); closeSheet(); SFX.close(); toast("Document supprimé"); },
});
function hyTestPaint(f) { if (!f || !S.ui.hyTest) return; openSheet(hyFryTestForm(f), (b) => { const e = $("#hyPct", b); if (e) { e.addEventListener("input", () => { S.ui.hyTest.pct = e.value; hyPctVerdict(b); }); hyPctVerdict(b); } }); }

/* ═════════════════════ public API (home, alerts) ═════════════════════ */
window.HYG = {
  /* documents that expire within N days (or within their own reminder window), and the expired ones; soonest first */
  expiringDocs(days = 30) {
    return hyArr("docs").filter((d) => d.expiry).map((d) => ({ d, n: daysUntil(d.expiry) })).filter(({ d, n }) => n != null && n <= Math.max(days, d.remind ?? 30)).sort((a, b) => a.n - b.n)
      .map(({ d, n }) => ({ id: d.id, name: d.name, cat: hyDC(d.cat)[0], catT: hyDC(d.cat)[1], icon: hyDC(d.cat)[2], expiry: d.expiry, days: n, late: n < 0, statusTx: hyDocState(d).tx.replace(/<\/?i>/g, ""), route: "documents" }));
  },
  /* batches still running (refroidissement or remise en température), most urgent first. phase: run | due (time to measure) | late */
  coolingInProgress() {
    const now = Date.now(); return (HY.cool ? hyRunning() : (hyWatch(), [])).map((b) => { const K = hyKind(b); return { id: b.id, kind: b.kind, kindT: K.t, plat: b.plat, startAt: b.startAt, deadline: b.startAt + K.lim, left: b.startAt + K.lim - now, phase: hyPhase(b, now), goal: K.goal, route: "refroid" }; });
  },
  fryerAlerts() { return hyFryers().map((f) => ({ f, s: hyFryState(f) })).filter((x) => x.s.st !== "ok").map(({ f, s }) => ({ id: f.id, name: f.name, status: s.st, statusTx: s.tx, pct: s.pct, services: s.svc, every: s.every, route: "friture" })); },
  wasteMonth(m) { const s = hyWasteSum(hyWMonth(m || monthKey())); return { count: s.n, cost: s.cost, byReason: s.by }; },
  toFix() { return hyToFix().map((b) => ({ id: b.id, plat: b.plat, route: "refroid" })); },
  summary() { return { cooling: this.coolingInProgress().length, toFix: hyToFix().length, fryers: this.fryerAlerts().length, docs: this.expiringDocs().length }; },
};

/* ═════════════════════ demo seed (in memory only) ═════════════════════ */
function hyDemoImg(title, sub, color) {
  try {
    const c = document.createElement("canvas"); c.width = 300; c.height = 400; const g = c.getContext("2d");
    g.fillStyle = "#E9E2D3"; g.fillRect(0, 0, 300, 400); g.save(); g.translate(150, 200); g.rotate(-0.025); g.fillStyle = "#FFFFFF"; g.fillRect(-128, -176, 256, 352); g.restore();
    g.fillStyle = color; g.fillRect(36, 42, 70, 12); g.fillStyle = "#1B1530"; g.font = "bold 17px sans-serif"; g.fillText(title, 36, 88); g.fillStyle = "#6E6880"; g.font = "12px sans-serif"; g.fillText(sub, 36, 108);
    g.fillStyle = "#DCD6E6"; for (let i = 0; i < 11; i++) g.fillRect(36, 136 + i * 19, 228 - (i % 3) * 34, 6);
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.arc(222, 338, 24, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(44, 344); g.bezierCurveTo(70, 320, 90, 360, 120, 336); g.stroke();
    return c.toDataURL("image/jpeg", 0.6);
  } catch (e) { return ""; }
}
async function hySeedMaybe() {
  if (DB.mode !== "demo" || !S.rid || HY.seeded[S.rid] || !hyLoaded()) return;
  HY.seeded[S.rid] = true;
  if (HY_COLS.some(([k]) => (HY[k] || []).length)) return;
  const now = Date.now(), H = 36e5, M = 6e4, cooks = [["demo-thomas", "Thomas Girard"], ["demo-ines", "Inès Benali"], ["demo-lucas", "Lucas Petit"]];
  let si = 0; const who = () => { const c = cooks[si++ % cooks.length]; return { uid: c[0], by: c[1] }; };
  const rec = hyRecipes(); const rid = (t) => (rec.find((n) => n.title.toLowerCase().includes(t)) || {}).id;
  const put = (col, d) => DB.add(col, d).catch(() => {});
  /* refroidissement: one batch running now, one remise running, 14 days of history with one non-conformity */
  await put("cooling", { kind: "refroid", plat: "Bœuf bourguignon", ...(rid("bourguignon") ? { noteId: rid("bourguignon") } : {}), qty: 6, unit: "kg", cell: true, startAt: now - 84 * M, t0: 71, checks: [{ at: now - 40 * M, t: 34 }], status: "run", day: dayKey(), ...who() });
  await put("cooling", { kind: "remise", plat: "Soupe à l'oignon", qty: 4, unit: "L", startAt: now - 22 * M, t0: 4, checks: [], status: "run", day: dayKey(), ...who() });
  const plats = [["Bœuf bourguignon", "bourguignon", 6, "kg"], ["Fond de veau", "", 5, "L"], ["Blanquette de veau", "", 4, "kg"], ["Sauce tomate", "", 3, "L"], ["Riz pilaf", "", 2.5, "kg"], ["Crème anglaise", "", 2, "L"]];
  for (let i = 1; i <= 14; i++) {
    const p = plats[i % plats.length]; const st = now - i * 864e5 - (3 + (i % 3)) * H; const dur = (68 + ((i * 17) % 44)) * M; const ko = i === 6;
    await put("cooling", { kind: i % 4 === 0 ? "remise" : "refroid", plat: p[0], ...(p[1] && rid(p[1]) ? { noteId: rid(p[1]) } : {}), qty: p[2], unit: p[3], cell: i % 5 !== 0, startAt: st, t0: i % 4 === 0 ? 3 + (i % 3) : 66 + (i % 6), checks: [], status: ko ? "ko" : "ok", endAt: st + (ko ? 138 * M : i % 4 === 0 ? dur / 2 : dur), t1: i % 4 === 0 ? 68 + (i % 5) : ko ? 14 : 4 + (i % 6), ...(ko ? { action: "Produit jeté", actionNote: "Cellule en panne, technicien appelé" } : {}), day: dayKey(new Date(st)), ...who() });
  }
  /* friture: two fryers */
  const f1 = await DB.add("fryers", { name: "Friteuse frites", every: 8, svc: 6, lastChange: now - 4 * 864e5, order: 1, createdAt: now - 200 * 864e5 }).catch(() => null);
  const f2 = await DB.add("fryers", { name: "Friteuse croquettes", every: 10, svc: 10, lastChange: now - 6 * 864e5, order: 2, createdAt: now - 200 * 864e5 }).catch(() => null);
  if (f1) { await put("fryLogs", { fryerId: f1, kind: "change", at: now - 4 * 864e5, day: dayKey(new Date(now - 4 * 864e5)), ...who() }); [[3, 9], [2, 12], [1, 14]].forEach(([d, p]) => put("fryLogs", { fryerId: f1, kind: "test", pct: p, method: "testeur", at: now - d * 864e5 + 2 * H, day: dayKey(new Date(now - d * 864e5)), ...who() })); }
  if (f2) { await put("fryLogs", { fryerId: f2, kind: "change", at: now - 6 * 864e5, day: dayKey(new Date(now - 6 * 864e5)), ...who() }); [[4, 13, "testeur"], [2, 19, "testeur"], [1, 22, "bandelette"]].forEach(([d, p, m]) => put("fryLogs", { fryerId: f2, kind: "test", pct: p, method: m, ...(m === "bandelette" ? { level: "b3" } : {}), at: now - d * 864e5 + 3 * H, day: dayKey(new Date(now - d * 864e5)), ...who() })); }
  /* gaspillage: six months, linked to the demo products when they exist */
  const P = (id, n, u) => { const p = S.products.find((x) => x.id === id); return p ? { productId: p.id, name: p.name, unit: p.unit } : { name: n, unit: u }; };
  const items = [[P("p-creme", "Crème liquide", "L"), 1, "dlc"], [P("p-carotte", "Carottes", "kg"), 2, "abime"], [P("p-paleron", "Paleron de bœuf", "kg"), 1.2, "surprod"], [P("p-pain", "Pain de campagne", "pièce"), 3, "surprod"], [P("p-lait", "Lait entier", "L"), 2, "dlc"], [P("p-jambon", "Jambon blanc", "kg"), 0.5, "dlc"], [P("p-oeufs", "Œufs", "pièce"), 6, "abime"], [{ name: "Tartare de bœuf", unit: "portion" }, 1, "retour"], [P("p-comte", "Comté", "kg"), 0.4, "rappel"], [P("p-beurre", "Beurre", "kg"), 0.5, "dlc"]];
  const per = [9, 12, 8, 14, 10, 7];
  for (let mi = 5; mi >= 0; mi--) {
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() - mi);
    const maxDay = mi === 0 ? Math.max(1, new Date().getDate()) : 27; const n = mi === 0 ? Math.min(per[5], Math.max(3, Math.round(maxDay / 1.6))) : per[5 - mi];
    for (let j = 0; j < n; j++) {
      const it = items[(j * 7 + mi * 3) % items.length]; const day = 1 + ((j * 5 + mi) % maxDay); const d = new Date(base.getFullYear(), base.getMonth(), day, 15 + (j % 6), (j * 13) % 60);
      if (d.getTime() > now) d.setTime(now - (j + 1) * 3 * H);
      const qty = it[1] * (1 + (j % 3) * 0.5); const cost = it[0].productId ? hyCostOf(it[0].productId, qty, it[0].unit) : it[0].unit === "portion" ? 16 : null;
      await put("waste", { ...it[0], qty, reason: it[2], cost, at: d.getTime(), day: dayKey(d), month: monthKey(d), ...who() });
    }
  }
  /* coffre-fort: a believable set, one expired, one soon */
  const addD = (n) => dayKey(new Date(now + n * 864e5));
  const docs = [["nuisibles", "Contrat dératisation Hygiène Sud", 190, "#D99A1E", "Contrat 2026"], ["nuisibles", "Rapport de passage · septembre", null, "#D99A1E", "Rapport"], ["fournisseurs", "Agrément sanitaire Boucherie Durand", 240, "#2F5FBF", "FR 33.063.001 CE"], ["fournisseurs", "Attestation Marée Atlantique", -12, "#2F5FBF", "Attestation"], ["labo", "Analyse surfaces · octobre", 330, "#5B2BFF", "Laboratoire Eurofins"], ["kbis", "Extrait Kbis", 21, "#1B1530", "Greffe de Bordeaux"], ["assurance", "Responsabilité civile pro", 120, "#1E7F55", "Attestation 2026"], ["formation", "Formation HACCP · Thomas", null, "#C8432A", "14 heures"], ["formation", "Formation HACCP · Inès", null, "#C8432A", "14 heures"]];
  for (let i = 0; i < docs.length; i++) { const [cat, name, exp, col, sub] = docs[i]; const img = hyDemoImg(name.split(" · ")[0].slice(0, 26), sub, col);
    await put("vault", { cat, name, expiry: exp == null ? null : addD(exp), remind: 30, files: img ? [{ id: "", name: `${cat}.jpg`, type: "image/jpeg", url: img }] : [], at: now - (40 + i * 23) * 864e5, updatedAt: now - (40 + i * 23) * 864e5, ...who() }); }
}
