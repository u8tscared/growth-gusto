/* Growth Gusto — area: sondes (« Sondes connectées »: wireless thermometers in fridges, freezers and cold rooms). Prefix « sd ».
   Route: sondes. The list (live temperature, battery, signal, last seen, 24 h curve), a 4-question « Ajouter une sonde » flow
   (marque → connexion → frigo → c'est prêt), a detail sheet, a buying guide, and a full CSV import that works with no server.
   Data, under restos/{rid}/ (the server part is functions/src/sondes.js):
     sensors/{id}        { name, brand, fridgeId?, devId?, cfg?, active, createdAt, uid, lastSeen?, lastTemp?, lastHum?, battery?, rssi? }
                         brand ∈ shelly | sensorpush | govee | ubibot | gateway | csv
     sensorKeys/{brand}  account keys read by the server (shelly {key, server}, sensorpush {email, password}, govee {key}, ubibot {key},
                         gateway {token}); the server writes {error} there when an account is refused
     sensorReadings/{id} { sensorId, fridgeId?, value, hum?, battery?, at, src }
     readings/{id}       automatic relevé, same shape as js/releve.js commitReading + { uid:"sonde", by:"Sonde <name>", source:"sonde", sensorId }
   Server switch: S.resto.server.sondes (set by the server on its first run) or window.GG_SERVER.sondes.
   Exposed: window.SONDES = { forFridge(fid) → { temp, at, battery, ok, offline, name } | null, list(), serverOn() } */
"use strict";

TAB_OF.sondes = "frigos";
Object.assign(IC, {
  sdProbe: ["M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z", "f:M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z", "M17.5 5.5a4 4 0 0 1 0 5", "M20 3a8 8 0 0 1 0 10"],
  sdRadio: ["c:12,12,2", "M16.24 7.76a6 6 0 0 1 0 8.49", "M7.76 16.24a6 6 0 0 1 0-8.49", "M19.07 4.93a10 10 0 0 1 0 14.14", "M4.93 19.07a10 10 0 0 1 0-14.14"],
  sdCloud: ["M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z", "f:M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"],
  sdFile: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M8 13h2", "M14 13h2", "M8 17h2", "M14 17h2"],
  sdCopy: ["r:8,8,14,14,2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  sdLink: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  sdCart: ["c:8,21,1", "c:19,21,1", "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"],
});

/* ───────── brands ───────── */
const SD_BRANDS = {
  shelly: { t: "Shelly", s: "H&T Gen3 · BLU", ic: "wifi", w: "sk", cloud: true,
    keys: [["key", "Clé cloud", "App Shelly › Paramètres › Clé d'autorisation cloud"], ["server", "Serveur", "Même écran, ex. shelly-49-eu.shelly.cloud"]],
    dev: ["Identifiant de l'appareil", "Appareil › Paramètres › Infos › ID", "ex. e4b063f0a1b2"] },
  sensorpush: { t: "SensorPush", s: "avec passerelle G1", ic: "bt", w: "vi", cloud: true,
    keys: [["email", "E-mail du compte SensorPush", "", "email"], ["password", "Mot de passe", "", "password"]],
    dev: ["Nom de la sonde dans l'app", "Exactement comme dans SensorPush", "ex. Congélateur"] },
  govee: { t: "Govee", s: "Wi-Fi ou passerelle", ic: "wifi", w: "sa", cloud: true,
    keys: [["key", "Clé API Govee", "Govee Home › Profil › ⚙ › Demander une clé API"]],
    dev: ["Nom de l'appareil dans l'app", "Ou son adresse MAC", "ex. Frigo bar"] },
  ubibot: { t: "UbiBot", s: "WS1 · WS1 Pro", ic: "sdCloud", w: "mi", cloud: true,
    keys: [["key", "Clé de compte (Account Key)", "console.ubibot.com › Compte › Clés API"]],
    dev: ["Nom du canal", "Ou son numéro (Channel ID)", "ex. Chambre froide"] },
  gateway: { t: "Passerelle universelle", s: "LoRaWAN, Milesight…", ic: "sdRadio", w: "in", cloud: true, dev: ["Identifiant (DevEUI, MAC…)", "Laissez vide : la première sonde qui envoie une mesure prend cette place.", "ex. 24E124136B502277"] },
  csv: { t: "Autre · fichier", s: "Export CSV de l'app", ic: "sdFile", w: "to" },
};
const SD_ORDER = ["shelly", "sensorpush", "govee", "ubibot", "gateway", "csv"];
const SD_OFF = 30 * 60e3, SD_OOR = 30 * 60e3, SD_DAY = 24 * 3600e3;
const SD_SLOT_FROM = { midi: 10, soir: 18 }; /* same windows as the server: midi 10–16 h, soir 18–24 h */

/* ───────── state + data ───────── */
const SD = { rid: null, sensors: [], rd: [], keys: {}, got: 0, seeded: false, live: {}, timer: null, csv: null };
function sdWatch() {
  if (!S.ready || !S.rid || !S.resto || typeof attachedRid === "undefined" || attachedRid !== S.rid || SD.rid === S.rid) return;
  const rid = SD.rid = S.rid; SD.sensors = []; SD.rd = []; SD.keys = {}; SD.got = 0; SD.seeded = false;
  const w = (col, opts, cb) => DB.watch(col, opts, (rows) => { if (S.rid !== rid) return; cb(rows); SD.got |= ({ sensors: 1, sensorReadings: 2, sensorKeys: 4 })[col]; if (DB.mode === "demo" && SD.got === 7) sdSeed(); onData(); });
  w("sensors", {}, (rows) => { SD.sensors = rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); });
  w("sensorReadings", { order: "at", dir: "desc", limit: 4000 }, (rows) => { SD.rd = rows; });
  w("sensorKeys", {}, (rows) => { SD.keys = Object.fromEntries(rows.map((r) => [r.id, r])); });
}
setInterval(sdWatch, 800);
const sdServerOn = () => DB.mode === "demo" || !!((S.resto && S.resto.server && S.resto.server.sondes) || (window.GG_SERVER && window.GG_SERVER.sondes));
const sdCan = () => { try { return typeof PERMS === "undefined" || !PERMS.cap || PERMS.cap("editSettings") !== false; } catch (e) { return true; } };
const sdList = () => SD.sensors.filter((s) => s.active !== false);
const sdFr = (id) => S.fridges.find((f) => f.id === id) || null;
const sdLast = (s) => { const L = SD.live[s.id]; return L && L.at >= (s.lastSeen || 0) ? L : { value: s.lastTemp, at: s.lastSeen }; };
const sdDeg = (v) => (v == null ? "--,-" : fmt(v, 1));
function sdAgo(at) {
  if (!at) return "jamais"; const m = Math.round((Date.now() - at) / 60e3);
  if (m < 2) return "à l'instant"; if (m < 60) return `il y a ${m} min`; if (m < 24 * 60) return `il y a ${Math.round(m / 60)} h`; return when(at);
}
/* the 24 h points of a sensor, oldest first, with the live value at the end */
function sdSeries(s, span = SD_DAY) {
  const from = Date.now() - span;
  const pts = SD.rd.filter((r) => r.sensorId === s.id && r.at >= from && r.value != null).map((r) => ({ at: r.at, v: r.value })).sort((a, b) => a.at - b.at);
  const L = sdLast(s); if (L.value != null && L.at && L.at >= from && (!pts.length || L.at > pts[pts.length - 1].at + 60e3)) pts.push({ at: L.at, v: L.value });
  return pts;
}
function sdState(s) {
  const L = sdLast(s), f = sdFr(s.fridgeId), b = SD_BRANDS[s.brand] || {};
  const k = SD.keys[s.brand];
  if (b.cloud && k && k.error && (!L.at || Date.now() - L.at > SD_OFF)) return { k: "err", tone: "bad", tx: "Connexion refusée" };
  if (!L.at || L.value == null) return { k: "wait", tone: "neu", tx: b.cloud && !sdServerOn() ? "Bientôt active" : "En attente" };
  if (s.brand !== "csv" && Date.now() - L.at > SD_OFF) return { k: "off", tone: "warn", tx: "Hors ligne" };
  if (f && f.min != null && f.max != null && (L.value > f.max || L.value < f.min)) return { k: "bad", tone: "bad", tx: L.value > f.max ? "Trop chaud" : "Trop froid" };
  if (s.brand === "csv") return { k: "csv", tone: "neu", tx: "Importée" };
  return { k: "ok", tone: "ok", tx: f ? "Au froid" : "En ligne" };
}
const sdBatt = (p) => { if (p == null) return ""; const lv = Math.max(0, Math.min(100, p)); const c = lv <= 15 ? "var(--bad)" : lv <= 30 ? "var(--warn)" : "currentColor";
  return `<svg class="sd-bat" viewBox="0 0 26 14" aria-hidden="true"><rect x="1" y="1.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="23.2" y="5" width="1.8" height="4" rx=".9" fill="currentColor"/><rect x="3" y="3.5" width="${(17 * lv / 100).toFixed(1)}" height="7" rx="1.6" fill="${c}"/></svg>`; };
const sdBars = (rssi) => { if (rssi == null) return ""; const n = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -82 ? 2 : 1;
  return `<svg class="sd-sig" viewBox="0 0 18 14" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<rect x="${i * 4.6}" y="${10 - i * 3}" width="3.2" height="${4 + i * 3}" rx="1" fill="currentColor" opacity="${i < n ? 1 : 0.22}"/>`).join("")}</svg>`; };
const sdSigTx = (rssi) => (rssi == null ? "–" : rssi >= -60 ? "Excellent" : rssi >= -70 ? "Bon" : rssi >= -82 ? "Moyen" : "Faible");

/* ───────── curve (inline SVG, band = the fridge's safe range, out-of-range part in tomato) ───────── */
let sdGid = 0;
function sdCurve(s, { h = 64, big = false } = {}) {
  const pts = sdSeries(s); const f = sdFr(s.fridgeId);
  if (pts.length < 2) return `<div class="sd-nocurve" style="height:${h}px"><span>${pts.length ? "La courbe se dessine…" : "Pas encore de mesure"}</span></div>`;
  const W = 300, now = Date.now(), t0 = now - SD_DAY;
  const vs = pts.map((p) => p.v); const hasR = f && f.min != null && f.max != null;
  let lo = Math.min(...vs), hi = Math.max(...vs); if (hasR) { const l0 = lo, h0 = hi; lo = Math.min(l0, Math.max(f.min, l0 - 2)); hi = Math.max(h0, Math.min(f.max, h0 + 2)); }
  const padV = Math.max(0.6, (hi - lo) * 0.18); lo -= padV; hi += padV;
  const x = (t) => ((t - t0) / SD_DAY) * W, y = (v) => h - ((v - lo) / (hi - lo)) * h;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const id = "sdc" + ++sdGid; const yb = hasR ? Math.max(0, Math.min(h, y(f.max))) : 0, ye = hasR ? Math.max(0, Math.min(h, y(f.min))) : h;
  const last = pts[pts.length - 1]; const lx = x(last.at), ly = y(last.v); const out = hasR && (last.v > f.max || last.v < f.min);
  const grid = big ? [6, 12, 18].map((k) => `<line x1="${x(t0 + k * 3600e3)}" x2="${x(t0 + k * 3600e3)}" y1="0" y2="${h}" class="gl"/>`).join("") : "";
  return `<svg class="sd-svg${big ? " big" : ""}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px" role="img" aria-label="Courbe des dernières 24 heures">
    <defs><clipPath id="${id}i"><rect x="0" y="${yb}" width="${W}" height="${Math.max(0, ye - yb)}"/></clipPath><clipPath id="${id}o"><rect x="0" y="0" width="${W}" height="${yb}"/><rect x="0" y="${ye}" width="${W}" height="${Math.max(0, h - ye)}"/></clipPath></defs>
    ${grid}${hasR ? `<rect x="0" y="${yb}" width="${W}" height="${Math.max(0, ye - yb)}" class="band"/>` : ""}
    <path d="${d}" class="ln" ${hasR ? `clip-path="url(#${id}i)"` : ""} vector-effect="non-scaling-stroke"/>
    ${hasR ? `<path d="${d}" class="ln hot" clip-path="url(#${id}o)" vector-effect="non-scaling-stroke"/>` : ""}
  </svg><i class="sd-now${out ? " hot" : ""}" style="left:${(lx / W) * 100}%;top:${ly}px"></i>`;
}
function sdStats(s) { const vs = sdSeries(s).map((p) => p.v); if (!vs.length) return null; return { min: Math.min(...vs), max: Math.max(...vs), avg: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length }; }

/* ───────── list ───────── */
function sdCard(s, i) {
  const st = sdState(s), L = sdLast(s), f = sdFr(s.fridgeId), b = SD_BRANDS[s.brand] || SD_BRANDS.csv, x = sdStats(s);
  return `<div class="glass sd-card st ${st.k}" style="--i:${Math.min(i + 2, 10)}" data-act="sdOpen" data-id="${s.id}" role="button" tabindex="0" aria-label="${esc(s.name)} · ${st.tx}">
    <div class="sd-hd"><span class="sd-w w-${b.w}">${ico(b.ic)}</span><div class="tx"><b>${esc(s.name || "Sonde")}</b><em>${f ? esc(f.name) : "Sans frigo"}</em></div><span class="pill ${st.tone}">${st.tx}</span></div>
    <div class="sd-mid"><span class="sd-lcd ${st.k}"><b data-sdlive="${s.id}">${sdDeg(L.value)}<small>°C</small></b></span>
      <div class="sd-meta">${s.battery != null ? `<span class="${s.battery <= 15 ? "lo" : ""}">${sdBatt(s.battery)}${Math.round(s.battery)} %</span>` : ""}${s.rssi != null ? `<span>${sdBars(s.rssi)}${sdSigTx(s.rssi)}</span>` : ""}<span data-sdago="${s.id}">${ico("clock")}${sdAgo(L.at)}</span></div></div>
    <div class="sd-curve">${sdCurve(s)}</div>
    <div class="sd-ft">${x ? `<span>min <b>${fmt(x.min)}°</b></span><span>24 h</span><span>max <b>${fmt(x.max)}°</b></span>` : `<span>${esc(b.t)}</span>`}</div>
  </div>`;
}
function sdEmpty() {
  return `<div class="glass sd-empty st" style="--i:1">
      <div class="sd-art" aria-hidden="true"><span class="sd-box"><span class="sd-lcdmini">3,2°</span><span class="sd-probe">${ico("sdProbe")}</span></span><i class="w1"></i><i class="w2"></i><i class="w3"></i></div>
      <b class="sd-et">Vos frigos se relèvent tout seuls</b>
      <p class="sub">Une sonde par frigo. La température arrive ici, le registre se remplit midi et soir.</p>
      ${sdCan() ? `<button class="btn acc block" data-act="sdAdd">${ico("plus")}Ajouter une sonde</button>` : ""}
      <button class="btn soft block" data-act="sdGuide">${ico("sdCart")}Quelle sonde acheter ?</button>
    </div>`;
}
function sdSummary(L) {
  const st = L.map(sdState); const bad = st.filter((x) => x.k === "bad" || x.k === "err").length, off = st.filter((x) => x.k === "off").length;
  const mk = monthKey(); const auto = S.readings.filter((r) => r.source === "sonde" && (r.day || "").startsWith(mk)).length;
  const tone = bad ? "bad" : off ? "warn" : "ok";
  const tx = bad ? `${bad} sonde${bad > 1 ? "s" : ""} à vérifier` : off ? `${off} sonde${off > 1 ? "s" : ""} hors ligne` : "Tout est au froid";
  return `<div class="glass sd-sum st ${tone}" style="--i:1"><span class="sd-sumic">${ico(bad ? "alert" : off ? "wifi" : "sdProbe")}</span><div class="tx"><b>${tx}</b><em>${L.length} sonde${L.length > 1 ? "s" : ""} · ${auto ? `${auto} relevé${auto > 1 ? "s" : ""} auto ce mois` : "relevés auto midi et soir"}</em></div></div>`;
}
VIEWS.sondes = {
  render() {
    sdWatch(); const L = sdList();
    const right = L.length && sdCan() ? `<button class="btn acc sm" data-act="sdAdd">${ico("plus")}<span>Ajouter</span></button>` : "";
    if (!L.length) return `<div class="inner narrow sd">${topBar("Sondes connectées", { right })}${sdEmpty()}</div>`;
    const wait = L.some((s) => (SD_BRANDS[s.brand] || {}).cloud) && !sdServerOn();
    return `<div class="inner wide sd">${topBar("Sondes connectées", { right })}
      ${sdSummary(L)}
      ${wait ? `<div class="sd-srv st" style="--i:2"><span class="sd-spin"></span><span><b>Activation du serveur en cours</b> · les sondes connectées démarreront toutes seules.</span></div>` : ""}
      <div class="sd-grid">${L.map(sdCard).join("")}</div>
      <div class="sd-more st" style="--i:${Math.min(L.length + 3, 11)}">
        <button class="sd-lk" data-act="sdGuide"><span class="sd-w w-sa">${ico("sdCart")}</span><span class="tx"><b>Quelle sonde acheter ?</b><em>Nos conseils, frigo par frigo</em></span>${ico("chev")}</button>
        ${sdCan() ? `<button class="sd-lk" data-act="sdCsvAny"><span class="sd-w w-to">${ico("upload")}</span><span class="tx"><b>Importer un fichier</b><em>L'export CSV de l'app de la sonde</em></span>${ico("chev")}</button>` : ""}
      </div>
    </div>`;
  },
  after() { sdLiveStart(); },
};

/* demo: three believable sensors over the last 24 h (in memory only) + a gently moving live value while the screen is open */
function sdSeed() {
  if (SD.seeded || DB.mode !== "demo" || SD.sensors.length) return; SD.seeded = true;
  const fr = (k) => S.fridges.find((f) => f.id === k) ? k : null;
  const now = Date.now(), H = 3600e3;
  /* smooth service bumps (doors open around 12:30 and 20:30), a few door spikes, a freezer defrost every 8 h */
  const hr = (t) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
  const svc = (t) => { const h = hr(t); return Math.exp(-((h - 12.6) ** 2) / 1.4) + Math.exp(-((h - 20.6) ** 2) / 1.8); };
  const door = (t) => Math.max(0, Math.sin(t / 5.2e5)) ** 6;
  const D = [
    ["sd-demo-cf", "Chambre froide", "gateway", fr("fr-cf"), 86, -79, (t) => 0.9 + 0.12 * Math.sin(t / 5.4e6) + svc(t) * (0.45 + 0.35 * door(t)), "24E124136B502277"],
    ["sd-demo-s1", "Frigo de service 1", "shelly", fr("fr-s1"), 64, -61, (t) => 2.3 + 0.15 * Math.sin(t / 7.1e6) + svc(t) * (1.1 + 0.9 * door(t)), "e4b063f0a1b2"],
    ["sd-demo-cg", "Congélateur", "sensorpush", fr("fr-cg"), 18, -83, (t) => { const c = ((t / 3600e3) % 8 + 8) % 8; return -20.6 + 0.25 * Math.sin(t / 3.1e6) + (c < 0.7 ? 3.4 * Math.sin((c / 0.7) * Math.PI) : 0); }, "Congélateur"],
  ];
  const base = `restos/${S.rid}`; const sp = `${base}/sensors`, rp = `${base}/sensorReadings`;
  DB.local[sp] ||= {}; DB.local[rp] ||= {};
  D.forEach(([id, name, brand, fid, bat, rssi, fn, dev], k) => {
    let last = null;
    for (let t = now - SD_DAY + k * 97e3; t <= now - 4 * 60e3; t += 15 * 60e3) {
      const v = Math.round((fn(t) + (Math.random() - 0.5) * 0.1) * 10) / 10; last = { t, v };
      DB.local[rp][`${id}-${t}`] = { sensorId: id, ...(fid ? { fridgeId: fid } : {}), value: v, at: t, src: brand };
    }
    DB.local[sp][id] = { name, brand, ...(fid ? { fridgeId: fid } : {}), devId: dev, active: true, createdAt: now - (40 - k) * 864e5, uid: "demo-camille", lastSeen: now - (2 + k) * 60e3, lastTemp: last.v, battery: bat, rssi, demo: true };
    SD.live[id] = { value: last.v, at: now - (2 + k) * 60e3, fn };
  });
  DB.local[`${base}/sensorKeys`] ||= {}; DB.local[`${base}/sensorKeys`].gateway = { token: "demo" + rid6().toLowerCase() + rid6().toLowerCase(), createdAt: now };
  DB.emit(sp); DB.emit(rp); DB.emit(`${base}/sensorKeys`);
}
function sdLiveStart() {
  if (SD.timer) return;
  SD.timer = setInterval(() => {
    if (S.route !== "sondes") { clearInterval(SD.timer); SD.timer = null; return; }
    const now = Date.now();
    Object.entries(SD.live).forEach(([id, L]) => {
      if (!L.fn) return; const v = Math.round((L.fn(now) + (Math.random() - 0.5) * 0.1) * 10) / 10;
      const changed = v !== L.value; L.value = v; L.at = now;
      const el = $(`[data-sdlive="${id}"]`); if (el && changed) { el.innerHTML = `${sdDeg(v)}<small>°C</small>`; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
      const ag = $(`[data-sdago="${id}"]`); if (ag) ag.innerHTML = `${ico("clock")}à l'instant`;
    });
    $$("[data-sdago]").forEach((el) => { const s = SD.sensors.find((x) => x.id === el.dataset.sdago); if (s && !SD.live[s.id]) el.innerHTML = `${ico("clock")}${sdAgo(sdLast(s).at)}`; });
  }, 4000);
}

/* ───────── detail sheet ───────── */
function sdDetailHtml(s) {
  const st = sdState(s), L = sdLast(s), f = sdFr(s.fridgeId), b = SD_BRANDS[s.brand] || SD_BRANDS.csv, x = sdStats(s), can = sdCan();
  const auto = S.readings.filter((r) => r.sensorId === s.id && r.source === "sonde").length;
  const row = (ic, k, v) => `<div class="sd-row"><span class="sd-ri">${ic}</span><span class="k">${k}</span><b>${v}</b></div>`;
  return `<div class="sd-dt">
    <div class="sd-dhd"><span class="sd-w w-${b.w}">${ico(b.ic)}</span><div class="tx"><div class="h2">${esc(s.name || "Sonde")}</div><em>${f ? esc(f.name) : "Sans frigo"} · ${esc(b.t)}</em></div><span class="pill ${st.tone}">${st.tx}</span></div>
    <div class="sd-dbig"><span class="sd-lcd big ${st.k}"><b data-sdlive="${s.id}">${sdDeg(L.value)}<small>°C</small></b></span><div class="sd-dbs">${f && f.min != null ? `<span>Attendu</span><b>${fmt(f.min)} à ${fmt(f.max)} °C</b>` : "<span>Aucun frigo relié</span>"}<em data-sdago="${s.id}">${ico("clock")}${sdAgo(L.at)}</em></div></div>
    <div class="sd-dcurve"><div class="sd-curve">${sdCurve(s, { h: 132, big: true })}</div><div class="sd-ax"><span>-24 h</span><span>-18 h</span><span>-12 h</span><span>-6 h</span><span>maintenant</span></div></div>
    ${x ? `<div class="sd-st3"><div><span>Min</span><b>${fmt(x.min)}°</b></div><div><span>Moyenne</span><b>${fmt(x.avg)}°</b></div><div><span>Max</span><b>${fmt(x.max)}°</b></div></div>` : ""}
    <div class="glass sd-rows">
      ${s.battery != null ? row(sdBatt(s.battery), "Pile", `${Math.round(s.battery)} %${s.battery <= 15 ? " · à changer" : ""}`) : ""}
      ${s.rssi != null ? row(sdBars(s.rssi), "Signal", sdSigTx(s.rssi)) : ""}
      ${f ? row(ico("shield"), "Registre", auto ? `${auto} relevé${auto > 1 ? "s" : ""} auto` : "Midi et soir, tout seul") : ""}
      ${s.devId ? row(ico("sdLink"), "Identifiant", `<span class="sd-mono">${esc(s.devId)}</span>`) : ""}
    </div>
    ${st.k === "err" ? `<div class="sd-warnbox">${ico("alert")}<span>Le compte ${esc(b.t)} a refusé la connexion. Vérifiez la clé.</span></div>` : ""}
    ${st.k === "wait" && b.cloud && !sdServerOn() ? `<div class="sd-srv">${ico("clock")}<span><b>Activation du serveur en cours</b> · elle démarrera toute seule.</span></div>` : ""}
    ${can ? `<div class="sd-acts">
      <button class="btn soft" data-act="sdMoveAsk" data-id="${s.id}">${ico("snow")}${f ? "Changer de frigo" : "Choisir un frigo"}</button>
      <button class="btn soft" data-act="sdCsvFor" data-id="${s.id}">${ico("upload")}Importer</button>
      ${b.cloud && s.brand !== "gateway" ? `<button class="btn soft" data-act="sdKeyEdit" data-v="${s.brand}">${ico("sdLink")}${b.t.length > 7 ? "Compte" : `Compte ${esc(b.t)}`}</button>` : ""}
      ${s.brand === "gateway" ? `<button class="btn soft" data-act="sdHook">${ico("sdLink")}Adresse d'envoi</button>` : ""}
      <button class="btn soft" data-act="sdRename" data-id="${s.id}">${ico("edit")}Renommer</button>
    </div>
    <button class="btn ghost danger-t" data-act="sdDelAsk" data-id="${s.id}">${ico("trash")}Retirer la sonde</button>` : ""}
  </div>`;
}

/* ───────── add flow: marque → connexion → frigo → prêt ───────── */
const sdA = () => (S.ui.sdAdd ||= { step: 1, brand: null, f: {}, fridgeId: undefined, name: "" });
function sdStepsBar(n) { return `<div class="sd-steps" aria-label="Étape ${n} sur 3">${[1, 2, 3].map((i) => `<i class="${i < n ? "on" : i === n ? "cur" : ""}"></i>`).join("")}</div>`; }
function sdQ(n, q, back = true) { return `<div class="sd-qhd">${back ? `<button class="iconbtn" data-act="sdBack" aria-label="Retour">${ico("back")}</button>` : "<span></span>"}${sdStepsBar(n)}<span></span></div><div class="h2 sd-q">${q}</div>`; }
function sdHookUrl() {
  const k = SD.keys.gateway; if (!k || !k.token) return "";
  return `https://europe-west9-${(window.GG_FIREBASE && GG_FIREBASE.projectId) || "growth-gusto"}.cloudfunctions.net/sondesIngest?r=${encodeURIComponent(S.rid)}&t=${k.token}`;
}
function sdHookBox() {
  const on = sdServerOn(), u = sdHookUrl();
  return `<div class="sd-hook${on ? "" : " off"}"><span class="k">Adresse d'envoi (POST JSON)</span><code class="sd-mono">${u ? esc(u) : "…"}</code>
    ${on ? `<button class="btn dark sm" data-act="sdCopy">${ico("sdCopy")}Copier</button>` : `<span class="sd-soon"><span class="sd-spin"></span>Activation du serveur en cours</span>`}</div>
    <details class="sd-fmt"><summary>Format accepté</summary><code class="sd-mono">{"id":"24E124136B502277",\n "temperature":3.4,\n "battery":92}</code><p>Milesight, The Things Network, ChirpStack et les actions Shelly (…&amp;id=…&amp;temp=\${ev.tC}) sont reconnus tels quels.</p></details>`;
}
function sdAddHtml() {
  const A = sdA(), b = SD_BRANDS[A.brand];
  if (A.step === 1) return `${sdQ(1, "Quelle sonde avez-vous ?", false)}
    <div class="sd-brands">${SD_ORDER.map((k, i) => { const x = SD_BRANDS[k]; return `<button class="sd-brand st" style="--i:${i}" data-act="sdBrand" data-v="${k}"><span class="sd-w w-${x.w}">${ico(x.ic)}</span><b>${x.t}</b><em>${x.s}</em></button>`; }).join("")}</div>
    <button class="sd-lk sm" data-act="sdGuide"><span class="sd-w w-sa">${ico("sdCart")}</span><span class="tx"><b>Pas encore de sonde ?</b><em>Ce qu'on conseille</em></span>${ico("chev")}</button>`;
  if (A.step === 2 && A.brand === "csv") return `${sdQ(2, "Importez le fichier")}${sdCsvPick()}`;
  if (A.step === 2) {
    const K = SD.keys[A.brand]; const keyed = K && !A.rekey && (A.brand === "gateway" ? !!K.token : true);
    let keyHtml = "";
    if (A.brand === "gateway") keyHtml = sdHookBox();
    else if (keyed) keyHtml = `<div class="sd-keyed"><span class="sd-w w-${b.w}">${ico("sdLink")}</span><span class="tx"><b>Compte ${b.t} relié</b><em>${K.error ? "Connexion refusée la dernière fois" : "Utilisé pour toutes vos sondes " + b.t}</em></span><button class="btn soft sm" data-act="sdRekey">Changer</button></div>`;
    else keyHtml = b.keys.map(([k, t, hint, type]) => `<label class="field"><span>${t}</span><input class="input" ${type ? `type="${type}"` : 'autocapitalize="off" spellcheck="false"'} autocomplete="off" data-bind="ui.sdAdd.f.${k}" value="${esc(A.f[k] || "")}" id="sdk-${k}">${hint ? `<em class="sd-hint">${hint}</em>` : ""}</label>`).join("");
    const [dt, dh, dp] = b.dev;
    return `${sdQ(2, A.brand === "gateway" ? "Branchez la passerelle" : `Reliez votre compte ${b.t}`)}
      ${keyHtml}
      <label class="field"><span>${dt}${A.brand === "gateway" ? " · facultatif" : ""}</span><input class="input sd-mono-in" autocapitalize="off" spellcheck="false" autocomplete="off" data-bind="ui.sdAdd.f.devId" value="${esc(A.f.devId || "")}" placeholder="${esc(dp)}" id="sdk-devId"><em class="sd-hint">${dh}</em></label>
      ${A.brand === "govee" ? `<div class="seg sd-seg2"><button class="${A.f.unit === "C" ? "" : "on"}" data-act="sdUnit" data-v="F">Envoie des °F</button><button class="${A.f.unit === "C" ? "on" : ""}" data-act="sdUnit" data-v="C">Envoie des °C</button></div>` : ""}
      ${A.brand === "ubibot" ? `<label class="field"><span>Capteur utilisé</span><div class="seg sd-seg2"><button class="${A.f.field && A.f.field !== "1" ? "" : "on"}" data-act="sdField" data-v="1">Intégré</button><button class="${A.f.field && A.f.field !== "1" ? "on" : ""}" data-act="sdField" data-v="8">Sonde à câble</button></div></label>` : ""}
      <button class="btn acc block" data-act="sdNext">Continuer</button>`;
  }
  if (A.step === 3) {
    const F = S.fridges; const csv = A.brand === "csv" && SD.csv;
    return `${sdQ(3, "Dans quel frigo est-elle ?")}
      <div class="sd-frs">${F.map((f, i) => sdFrTile(f, A.fridgeId === f.id, "sdPickFr", i)).join("")}
        <button class="sd-fr st${A.fridgeId === null ? " on" : ""}" style="--i:${F.length}" data-act="sdPickFr" data-v=""><span class="sd-w w-in">${ico("sdProbe")}</span><span class="tx"><b>Aucun pour l'instant</b><em>Juste la température</em></span></button></div>
      <label class="field"><span>Nom de la sonde</span><input class="input" data-bind="ui.sdAdd.name" value="${esc(A.name || "")}" placeholder="ex. Chambre froide" maxlength="40" id="sdName"></label>
      <button class="btn acc block" data-act="sdCreate" ${A.fridgeId === undefined ? "data-off" : ""}>${csv ? `${ico("upload")}Importer ${sdNb(csv.rows.length)} mesures` : `${ico("check")}Ajouter la sonde`}</button>`;
  }
  /* step 4 */
  const R = A.result || {};
  const live = b && b.cloud; const on = sdServerOn();
  return `<div class="sd-done">
    <div class="sd-art done" aria-hidden="true"><span class="sd-box"><span class="sd-lcdmini">${R.temp != null ? sdDeg(R.temp) + "°" : "--,-"}</span><span class="sd-probe">${ico("sdProbe")}</span></span><i class="w1"></i><i class="w2"></i><i class="w3"></i></div>
    <div class="h2">${A.brand === "csv" ? "C'est importé" : "C'est branché"}</div>
    <p class="sub">${A.brand === "csv" ? `${sdNb(R.n || 0)} mesures${R.slots ? ` · <b>${R.slots} relevé${R.slots > 1 ? "s" : ""}</b> ajouté${R.slots > 1 ? "s" : ""} au registre` : ""}` : live && !on ? "Elle démarrera dès l'activation du serveur." : A.brand === "gateway" ? "Elle apparaît dès sa première mesure." : "Première mesure d'ici 15 minutes."}</p>
    ${R.fridge && A.brand !== "csv" ? `<div class="sd-chipline">${ico("shield")}Relevés de ${esc(R.fridge)} faits tout seuls, midi et soir</div>` : ""}
    <button class="btn acc block" data-act="sdDone">Terminé</button>
  </div>`;
}
const sdNb = (n) => Number(n).toLocaleString("fr-FR");
function sdFrTile(f, on, act, i) {
  const used = sdList().find((s) => s.fridgeId === f.id && s.id !== (S.ui.sdMove || ""));
  return `<button class="sd-fr st${on ? " on" : ""}" style="--i:${i}" data-act="${act}" data-v="${f.id}"><span class="sd-w w-sk">${ico("snow")}</span><span class="tx"><b>${esc(f.name)}</b><em>${f.min != null ? `${fmt(f.min)} à ${fmt(f.max)} °C` : ""}${used ? ` · déjà : ${esc(used.name)}` : ""}</em></span><span class="sd-rad"></span></button>`;
}
const sdAddPaint = () => openSheet(`<div class="sd-add">${sdAddHtml()}</div>`, (b) => { const i = $(".input:not([value]),.input[value='']", b); if (i && !matchMedia("(pointer:coarse)").matches) i.focus(); });

/* ───────── CSV ───────── */
function sdCsvPick() {
  const C = SD.csv;
  return `<label class="sd-drop${C ? " has" : ""}"><input type="file" id="sdFile" accept=".csv,.txt,text/csv,text/plain" hidden><span class="sd-w w-to">${ico(C ? "sdFile" : "upload")}</span><b>${C ? esc(C.file) : "Choisir le fichier"}</b><em>${C ? "Toucher pour en choisir un autre" : "Export CSV de l'app de la sonde (Govee, SensorPush, Shelly, ThermoPro, Inkbird…)"}</em></label>
    ${C && C.error ? `<div class="sd-warnbox">${ico("alert")}<span>${esc(C.error)}</span></div>` : ""}
    ${C && !C.error ? `<div class="glass sd-prev"><div class="sd-pv1"><b>${sdNb(C.rows.length)} mesures</b><span>${when(C.from)} → ${when(C.to)}</span></div>
      <div class="sd-curve">${sdMiniCsv(C.rows)}</div>
      <div class="sd-ft"><span>min <b>${fmt(C.min)}°</b></span><div class="seg sd-unit"><button class="${C.unit === "C" ? "on" : ""}" data-act="sdCsvUnit" data-v="C">°C</button><button class="${C.unit === "F" ? "on" : ""}" data-act="sdCsvUnit" data-v="F">°F</button></div><span>max <b>${fmt(C.max)}°</b></span></div></div>` : ""}
    <button class="btn acc block" data-act="sdNext" ${C && !C.error ? "" : "data-off"}>Continuer</button>`;
}
function sdMiniCsv(rows) {
  const step = Math.max(1, Math.floor(rows.length / 240)); const pts = rows.filter((_, i) => i % step === 0);
  const W = 300, h = 56, t0 = rows[0].at, t1 = rows[rows.length - 1].at || t0 + 1; let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v)); const pv = Math.max(0.5, (hi - lo) * 0.15); lo -= pv; hi += pv;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${(((p.at - t0) / Math.max(1, t1 - t0)) * W).toFixed(1)} ${(h - ((p.v - lo) / (hi - lo)) * h).toFixed(1)}`).join("");
  return `<svg class="sd-svg" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px"><path d="${d}" class="ln" vector-effect="non-scaling-stroke"/></svg>`;
}
/* any thermometer app export: finds the date column(s) and the temperature column, °C or °F, , or ; or tab, dd/mm or mm/dd */
function sdParseCsv(text, name) {
  text = String(text || "").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim()); if (lines.length < 2) return { file: name, error: "Le fichier est vide." };
  const cnt = (c) => (lines[0].match(new RegExp(c === "\t" ? "\\t" : c, "g")) || []).length;
  const sep = ["\t", ";", ","].sort((a, b) => cnt(b) - cnt(a))[0];
  const split = (l) => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === sep && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  /* the header is the first line with a temperature-looking name (some apps write a title line first) */
  let hi = lines.slice(0, 8).findIndex((l) => /temp|°|℃|℉|field1/i.test(l)); if (hi < 0) hi = 0;
  const H = split(lines[hi]).map((h) => h.toLowerCase());
  let ti = H.findIndex((h) => /temp|℃|℉|°c|°f|field1/.test(h) && !/humid|point|dew|ros[ée]e/.test(h));
  const di = H.findIndex((h) => /date|time|heure|horodat|timestamp|observed|created|jour/.test(h) && !/zone/.test(h));
  const hh = H.findIndex((h, i) => i !== di && /^(heure|time|hour)\b/.test(h));
  const dIdx = di < 0 ? 0 : di; if (ti < 0) ti = H.findIndex((h, i) => i !== dIdx && i !== hh);
  if (ti < 0) return { file: name, error: "Aucune colonne de température trouvée." };
  const fH = /°f|℉|fahrenheit|\(f\)|_f\b|\bf$/.test(H[ti]);
  const body = lines.slice(hi + 1).map(split);
  const raw = body.map((c) => [c[dIdx] + (hh >= 0 && hh !== dIdx ? " " + c[hh] : ""), c[ti]]);
  /* dd/mm vs mm/dd: a part above 12 decides, French order by default */
  let mdy = false; for (const [d] of raw) { const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(d || ""); if (m) { if (+m[1] > 12) { mdy = false; break; } if (+m[2] > 12) { mdy = true; break; } } }
  const parseAt = (s) => {
    s = String(s || "").trim(); if (!s) return null;
    if (/^\d{9,13}(\.\d+)?$/.test(s)) { const n = +s; return n < 1e12 ? n * 1000 : n; }
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T,]*(\d{1,2})?:?(\d{2})?:?(\d{2})?/.exec(s);
    if (m && /[zZ]|[+-]\d\d:?\d\d$/.test(s)) { const t = Date.parse(s.replace(" ", "T")); if (!isNaN(t)) return t; }
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[ T,]*(\d{1,2})?[:h]?(\d{2})?:?(\d{2})?\s*([ap]m)?/i.exec(s);
    if (m) { let [, a, b, y, H2, M2, S2, ap] = m; y = +y < 100 ? 2000 + +y : +y; let hr = +(H2 || 0); if (ap) { hr = hr % 12 + (/p/i.test(ap) ? 12 : 0); } const dd = mdy ? +b : +a, mm = mdy ? +a : +b; return new Date(y, mm - 1, dd, hr, +(M2 || 0), +(S2 || 0)).getTime(); }
    const t = Date.parse(s); return isNaN(t) ? null : t;
  };
  let rows = raw.map(([d, v]) => ({ at: parseAt(d), v: num(String(v || "").replace(/[^\d,.\-]/g, "")) })).filter((r) => r.at && r.v != null && isFinite(r.v));
  if (!rows.length) return { file: name, error: "Les dates ou les températures sont illisibles." };
  rows.sort((a, b) => a.at - b.at);
  const vs = rows.map((r) => r.v); const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
  const unit = fH || (!/°c|℃|celsius/.test(H[ti]) && avg > 30 && avg < 60) ? "F" : "C";
  return sdCsvFinish({ file: name, raw: rows, unit });
}
function sdCsvFinish(C) {
  const rows = C.raw.map((r) => ({ at: r.at, v: Math.round((C.unit === "F" ? ((r.v - 32) * 5) / 9 : r.v) * 10) / 10 })).filter((r) => r.v > -60 && r.v < 80);
  if (!rows.length) return { ...C, error: "Températures hors plage." };
  const vs = rows.map((r) => r.v);
  return { ...C, rows, from: rows[0].at, to: rows[rows.length - 1].at, min: Math.min(...vs), max: Math.max(...vs), error: "" };
}
const sdSlotOf = (t) => { const d = new Date(t), h = d.getHours(); return h >= SD_SLOT_FROM.midi && h < 16 ? "midi" : h >= SD_SLOT_FROM.soir ? "soir" : null; };
/* one automatic relevé per service slot (the server applies the same rule): the first in-range value of the slot,
   else the first value that stayed out of range for 30 min, else (sparse files) the first value */
function sdSlotPicks(rows, f) {
  const G = new Map();
  rows.forEach((r) => { const sl = sdSlotOf(r.at); if (!sl) return; const k = dayKey(new Date(r.at)) + "|" + sl; (G.get(k) || G.set(k, []).get(k)).push(r); });
  const out = [];
  G.forEach((rs, k) => {
    const [day, slot] = k.split("|"); const inR = (v) => v >= f.min && v <= f.max;
    let p = rs.find((r) => inR(r.v)), ok = true;
    if (!p) { ok = false; const s0 = rs[0]; p = rs.find((r) => r.at - s0.at >= SD_OOR) || rs[0]; }
    out.push({ day, slot, at: p.at, value: p.v, ok });
  });
  return out;
}
async function sdImport(s, C) {
  const f = sdFr(s.fridgeId); const now = Date.now();
  /* the curve: one point per 15 min over the last 48 h of the file */
  const keep = []; let lastB = -1; const from = Math.max(C.to - 2 * SD_DAY, now - 31 * SD_DAY);
  C.rows.forEach((r) => { if (r.at < from || r.at > now + 60e3) return; const b = Math.floor(r.at / (15 * 60e3)); if (b !== lastB) { lastB = b; keep.push(r); } });
  const have = new Set(SD.rd.filter((r) => r.sensorId === s.id).map((r) => Math.floor(r.at / (15 * 60e3))));
  const add = keep.filter((r) => !have.has(Math.floor(r.at / (15 * 60e3)))).slice(-200);
  for (let i = 0; i < add.length; i += 25) await Promise.all(add.slice(i, i + 25).map((r) => DB.add("sensorReadings", { sensorId: s.id, ...(s.fridgeId ? { fridgeId: s.fridgeId } : {}), value: r.v, at: r.at, src: "csv" })));
  /* the HACCP register: the last 31 days, never over a relevé that exists */
  let slots = 0;
  if (f && f.min != null) {
    const recent = C.rows.filter((r) => r.at >= now - 31 * SD_DAY && r.at <= now);
    const picks = sdSlotPicks(recent, f).filter((p) => !S.readings.some((r) => r.fridgeId === f.id && r.day === p.day && r.slot === p.slot));
    for (let i = 0; i < picks.length; i += 20) await Promise.all(picks.slice(i, i + 20).map((p) => DB.add("readings", { fridgeId: f.id, fname: f.name, value: p.value, slot: p.slot, day: p.day, at: p.at, uid: "sonde", by: `Sonde ${s.name || ""}`.trim(), ok: p.ok, action: p.ok ? "" : "Hors seuil relevé par la sonde", source: "sonde", sensorId: s.id, imported: true })));
    slots = picks.length;
    const bad = picks.filter((p) => !p.ok && p.at >= now - SD_DAY).pop();
    if (bad && window.ALERTES && typeof ALERTES.push === "function") { try { ALERTES.push({ type: "temp", level: "bad", fridgeId: f.id, sensorId: s.id, value: bad.value, text: `${f.name} : ${fmt(bad.value)} °C relevé par la sonde (attendu ${fmt(f.min)} à ${fmt(f.max)} °C)` }); } catch (e) {} }
  }
  const last = C.rows[C.rows.length - 1];
  if (!s.lastSeen || last.at > s.lastSeen) await DB.update("sensors", s.id, { lastSeen: last.at, lastTemp: last.v });
  logEvent("sensor", `a importé ${sdNb(C.rows.length)} mesures de la sonde ${s.name}${slots ? ` · ${slots} relevé${slots > 1 ? "s" : ""} ajouté${slots > 1 ? "s" : ""} au registre` : ""}`, { ref: s.id });
  return { n: C.rows.length, slots, temp: last.v };
}
document.addEventListener("change", async (e) => {
  if (!e.target || e.target.id !== "sdFile") return; const file = e.target.files && e.target.files[0]; if (!file) return;
  if (file.size > 25e6) { SD.csv = { file: file.name, error: "Fichier trop lourd (25 Mo max)." }; }
  else { try { SD.csv = sdParseCsv(await file.text(), file.name); } catch (err) { SD.csv = { file: file.name, error: "Fichier illisible." }; } }
  if (SD.csv.error) SFX.err(); else SFX.ok();
  if (S.ui.sdCsvFor) sdCsvForPaint(); else sdAddPaint();
});
function sdCsvForPaint() { const s = SD.sensors.find((x) => x.id === S.ui.sdCsvFor); if (!s) return closeSheet(); openSheet(`<div class="sd-add"><div class="sd-qhd"><button class="iconbtn" data-act="sdOpen" data-id="${s.id}" aria-label="Retour">${ico("back")}</button><span></span><span></span></div><div class="h2 sd-q">Importer pour ${esc(s.name)}</div>${sdCsvPick().replace('data-act="sdNext"', 'data-act="sdCsvGo"')}</div>`); }

/* ───────── buying guide ───────── */
function sdGuideHtml() {
  const it = (w, ic, where, what, price, why) => `<div class="sd-gi"><span class="sd-w w-${w}">${ico(ic)}</span><div class="tx"><span class="k">${where}</span><b>${what}</b><em>${why}</em></div><span class="sd-price">${price}</span></div>`;
  return `<div class="sd-guide"><div class="h2">Quelle sonde acheter ?</div>
    <div class="glass sd-gl">
      ${it("sk", "snow", "Frigos, saladettes", "Shelly BLU H&amp;T + passerelle BLU Gateway Gen3", "≈ 25 € + 30 €", "Une passerelle pour toute la cuisine. Pile 1 an et plus.")}
      ${it("vi", "snow", "Congélateurs", "SensorPush HT1 + passerelle G1", "≈ 50 € + 100 €", "Tient jusqu'à −40 °C. Bluetooth à travers la porte.")}
      ${it("in", "sdRadio", "Chambre froide", "Milesight EM300-TH (LoRaWAN) + passerelle UG65", "≈ 80 € + 350 €", "Étanche, traverse les murs isolés, pile 5 ans. Une passerelle couvre tout le restaurant.")}
      ${it("mi", "sdCloud", "Petit budget", "UbiBot WS1 Pro + sonde à câble", "≈ 120 €", "Le boîtier reste dehors, seule la sonde entre dans le froid.")}
    </div>
    <div class="sd-tips"><b>Bien la poser</b><span>Au milieu, à mi-hauteur. Jamais contre la porte ni devant le ventilateur.</span><span>Piles lithium dans le froid négatif.</span></div>
    <button class="btn soft block" data-act="sheetClose">Fermer</button></div>`;
}

/* ───────── actions ───────── */
const sdBusy = {};
Object.assign(ACT, {
  sdAdd: () => { if (!sdCan()) { toast("Demandez au gérant pour ajouter une sonde.", "err"); return; } SFX.tap(); S.ui.sdAdd = null; S.ui.sdCsvFor = null; SD.csv = null; sdA(); sdAddPaint(); },
  sdCsvAny: () => { if (!sdCan()) return; SFX.tap(); S.ui.sdCsvFor = null; SD.csv = null; S.ui.sdAdd = { step: 2, brand: "csv", f: {}, fridgeId: undefined, name: "" }; sdAddPaint(); },
  sdBrand: async (a, id, v) => {
    if (!SD_BRANDS[v]) return; SFX.tap(); buzz(5); const A = sdA(); A.brand = v; A.step = 2; A.rekey = false; A.f = { unit: v === "govee" ? "F" : undefined };
    if (v === "csv") SD.csv = null;
    if (v === "gateway" && !(SD.keys.gateway && SD.keys.gateway.token)) {
      const arr = new Uint8Array(18); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(arr) : arr.forEach((_, i) => (arr[i] = Math.random() * 256));
      const token = [...arr].map((x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
      SD.keys.gateway = { id: "gateway", token, createdAt: Date.now() }; DB.set("sensorKeys", "gateway", { token, createdAt: Date.now() }).catch(() => {});
    }
    sdAddPaint();
  },
  sdBack: () => { SFX.tap(); const A = sdA(); A.step = Math.max(1, A.step - 1); sdAddPaint(); },
  sdRekey: () => { SFX.tap(); sdA().rekey = true; sdAddPaint(); },
  sdUnit: (a, id, v) => { SFX.tick(); sdA().f.unit = v; sdAddPaint(); },
  sdField: (a, id, v) => { SFX.tick(); sdA().f.field = v; sdAddPaint(); },
  sdNext: (a) => {
    const A = sdA();
    if (A.step === 2 && A.brand === "csv") { if (!SD.csv || SD.csv.error) { SFX.err(); return; } }
    else if (A.step === 2) {
      const b = SD_BRANDS[A.brand]; const K = SD.keys[A.brand];
      const need = [...(b.keys && (!K || A.rekey) ? b.keys.map((k) => k[0]) : []), ...(A.brand === "gateway" ? [] : ["devId"])];
      const miss = need.find((k) => !String(A.f[k] || "").trim());
      if (miss) { SFX.err(); buzz([20, 40, 20]); const el = $("#sdk-" + miss); if (el) { el.classList.remove("sd-shake"); void el.offsetWidth; el.classList.add("sd-shake"); el.focus(); } return; }
    }
    SFX.tap(); A.step = 3; sdAddPaint();
  },
  sdPickFr: (a, id, v) => {
    SFX.tick(); buzz(4); const A = sdA(); const auto = (fid) => (fid ? sdFr(fid)?.name : "") || "";
    const inp = $("#sdName"); const cur = inp ? inp.value.trim() : A.name || "";
    const prev = A.fridgeId; A.fridgeId = v || null;
    A.name = !cur || cur === auto(prev) ? auto(A.fridgeId) : cur;
    sdAddPaint();
  },
  sdCreate: async (a) => {
    const A = sdA(); if (A.fridgeId === undefined) { SFX.err(); toast("Choisissez un frigo.", "err"); return; }
    if (sdBusy.c) return; sdBusy.c = true;
    try {
      const b = SD_BRANDS[A.brand]; const fr = sdFr(A.fridgeId);
      const name = String(A.name || "").trim() || (fr ? fr.name : "Sonde");
      if (b.keys && (!SD.keys[A.brand] || A.rekey)) { const k = Object.fromEntries(b.keys.map(([x]) => [x, String(A.f[x] || "").trim()])); await safe(DB.set("sensorKeys", A.brand, { ...k, at: Date.now(), by: S.me.id })); }
      const cfg = {}; if (A.brand === "govee") cfg.unit = A.f.unit || "F"; if (A.brand === "ubibot") cfg.field = A.f.field || "1";
      const doc = { name, brand: A.brand, ...(A.fridgeId ? { fridgeId: A.fridgeId } : {}), devId: String(A.f.devId || "").trim(), ...(Object.keys(cfg).length ? { cfg } : {}), active: true, createdAt: Date.now(), uid: S.me.id };
      const id = await safe(DB.add("sensors", doc));
      let R = { fridge: fr ? fr.name : "" };
      if (A.brand === "csv" && SD.csv && !SD.csv.error) R = { ...R, ...(await sdImport({ id, ...doc }, SD.csv)) };
      if (A.brand !== "csv") logEvent("sensor", `a ajouté la sonde ${name}${fr ? ` dans ${fr.name}` : ""}`, { ref: id });
      A.result = R; A.step = 4; SD.csv = null;
      SFX.done(); buzz([12, 40, 12]); sdAddPaint(); setTimeout(() => burst(), 160);
    } catch (e) { console.warn(e); } finally { sdBusy.c = false; }
  },
  sdDone: () => { closeSheet(); S.ui.sdAdd = null; if (S.route !== "sondes") go("sondes"); else refresh(true); },
  sdOpen: (a, id) => { const s = SD.sensors.find((x) => x.id === id); if (!s) return; SFX.tap(); S.ui.sdCsvFor = null; S.ui.sdMove = null; openSheet(sdDetailHtml(s)); sdLiveStart(); },
  sdCopy: async () => {
    const u = sdHookUrl(); if (!u) return;
    try { await navigator.clipboard.writeText(u); } catch (e) { const t = document.createElement("textarea"); t.value = u; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (x) {} t.remove(); }
    SFX.ok(); buzz(8); toast("Adresse copiée");
  },
  sdHook: () => { SFX.tap(); openSheet(`<div class="sd-add"><div class="h2">Adresse d'envoi</div><p class="sub" style="margin:0">À coller dans votre passerelle (Milesight, TTN, ChirpStack…).</p>${sdHookBox()}<button class="btn soft block" data-act="sheetClose">Fermer</button></div>`); },
  sdGuide: () => { SFX.tap(); openSheet(sdGuideHtml()); },
  sdKeyEdit: (a, id, v) => { if (!sdCan() || !SD_BRANDS[v]) return; SFX.tap(); const b = SD_BRANDS[v];
    S.ui.sdKey = v;
    openSheet(`<div class="sd-add"><div class="h2">Compte ${b.t}</div>${SD.keys[v] && SD.keys[v].error ? `<div class="sd-warnbox">${ico("alert")}<span>Connexion refusée : vérifiez et enregistrez à nouveau.</span></div>` : ""}${b.keys.map(([k, t, hint, type]) => `<label class="field"><span>${t}</span><input class="input" id="sdke-${k}" ${type ? `type="${type}"` : 'autocapitalize="off" spellcheck="false"'} autocomplete="off" value="${type === "password" ? "" : esc((SD.keys[v] || {})[k] || "")}" placeholder="${type === "password" ? "••••••••" : ""}">${hint ? `<em class="sd-hint">${hint}</em>` : ""}</label>`).join("")}<div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="sdKeySave" data-v="${v}">Enregistrer</button></div></div>`); },
  sdKeySave: async (a, id, v) => { const b = SD_BRANDS[v]; if (!b) return; const cur = SD.keys[v] || {};
    const k = Object.fromEntries(b.keys.map(([x]) => [x, ($("#sdke-" + x) || {}).value?.trim() || cur[x] || ""]));
    const miss = b.keys.find(([x]) => !k[x]); if (miss) { SFX.err(); $("#sdke-" + miss[0])?.focus(); return; }
    await safe(DB.set("sensorKeys", v, { ...k, at: Date.now(), by: S.me.id })).catch(() => null); SFX.ok(); closeSheet(); toast("Compte enregistré"); },
  sdMoveAsk: (a, id) => { const s = SD.sensors.find((x) => x.id === id); if (!s) return; SFX.tap(); S.ui.sdMove = id;
    openSheet(`<div class="sd-add"><div class="sd-qhd"><button class="iconbtn" data-act="sdOpen" data-id="${id}" aria-label="Retour">${ico("back")}</button><span></span><span></span></div><div class="h2 sd-q">Dans quel frigo est-elle ?</div><div class="sd-frs">${S.fridges.map((f, i) => sdFrTile(f, s.fridgeId === f.id, "sdMove", i)).join("")}<button class="sd-fr${!s.fridgeId ? " on" : ""}" data-act="sdMove" data-v=""><span class="sd-w w-in">${ico("sdProbe")}</span><span class="tx"><b>Aucun</b><em>Juste la température</em></span><span class="sd-rad"></span></button></div></div>`); },
  sdMove: async (a, id, v) => { const sid = S.ui.sdMove; const s = SD.sensors.find((x) => x.id === sid); if (!s) return; SFX.tick();
    await safe(DB.update("sensors", sid, { fridgeId: v || null, oorSince: null, oorAlert: false, slotDone: null })).catch(() => null);
    const f = sdFr(v); logEvent("sensor", `a placé la sonde ${s.name} ${f ? `dans ${f.name}` : "hors frigo"}`, { ref: sid });
    S.ui.sdMove = null; SFX.ok(); openSheet(sdDetailHtml({ ...s, fridgeId: v || null })); toast(f ? `Sonde reliée à ${f.name}` : "Sonde détachée"); },
  sdRename: (a, id) => { const s = SD.sensors.find((x) => x.id === id); if (!s) return; SFX.tap();
    openSheet(`<div class="sd-add"><div class="h2">Renommer</div><label class="field"><span>Nom de la sonde</span><input class="input" id="sdRen" maxlength="40" value="${esc(s.name || "")}"></label><div class="grid2"><button class="btn soft" data-act="sdOpen" data-id="${id}">Annuler</button><button class="btn acc" data-act="sdRenOk" data-id="${id}">Enregistrer</button></div></div>`, (b) => { const i = $("#sdRen", b); if (i) { i.focus(); i.select(); } }); },
  sdRenOk: async (a, id) => { const n = ($("#sdRen") || {}).value?.trim(); if (!n) { SFX.err(); return; } await safe(DB.update("sensors", id, { name: n })).catch(() => null); SFX.ok(); const s = SD.sensors.find((x) => x.id === id); openSheet(sdDetailHtml({ ...s, name: n })); },
  sdDelAsk: (a, id) => { const s = SD.sensors.find((x) => x.id === id); if (!s) return; SFX.tap();
    openSheet(`<div style="text-align:center"><span class="ic bad sd-bigic">${ico("trash")}</span><div class="h2" style="margin-top:10px;font-size:21px">Retirer ${esc(s.name)} ?</div><p class="sub" style="margin:4px 0 0">Ses relevés restent dans le registre.</p></div><div class="grid2"><button class="btn soft" data-act="sdOpen" data-id="${id}">Annuler</button><button class="btn danger" data-act="sdDelOk" data-id="${id}">${ico("trash")}Retirer</button></div>`); },
  sdDelOk: async (a, id) => { const s = SD.sensors.find((x) => x.id === id); if (!s) return;
    await safe(DB.update("sensors", id, { active: false, removedAt: Date.now() })).catch(() => null); delete SD.live[id];
    logEvent("sensor", `a retiré la sonde ${s.name}`, { ref: id }); SFX.close(); closeSheet(); toast("Sonde retirée"); },
  sdCsvFor: (a, id) => { if (!sdCan()) return; SFX.tap(); S.ui.sdCsvFor = id; SD.csv = null; sdCsvForPaint(); },
  sdCsvUnit: (a, id, v) => { if (!SD.csv || !SD.csv.raw) return; SFX.tick(); SD.csv = sdCsvFinish({ ...SD.csv, unit: v }); if (S.ui.sdCsvFor) sdCsvForPaint(); else sdAddPaint(); },
  sdCsvGo: async () => { const s = SD.sensors.find((x) => x.id === S.ui.sdCsvFor); if (!s || !SD.csv || SD.csv.error || sdBusy.i) return; sdBusy.i = true;
    try { const R = await sdImport(s, SD.csv); SD.csv = null; S.ui.sdCsvFor = null; SFX.done(); closeSheet(); toast(R.slots ? `${R.slots} relevé${R.slots > 1 ? "s" : ""} ajouté${R.slots > 1 ? "s" : ""} au registre` : `${sdNb(R.n)} mesures importées`); }
    catch (e) { console.warn(e); } finally { sdBusy.i = false; } },
});

/* ───────── for the fridge screens (wired by the lead) ───────── */
window.SONDES = {
  forFridge(fid) {
    sdWatch(); const s = sdList().find((x) => x.fridgeId === fid && x.brand !== "csv") || sdList().find((x) => x.fridgeId === fid); if (!s) return null;
    const L = sdLast(s); if (L.value == null) return null; const f = sdFr(fid); const offline = s.brand !== "csv" && Date.now() - (L.at || 0) > SD_OFF;
    const inR = !f || f.min == null || (L.value >= f.min && L.value <= f.max);
    return { temp: L.value, at: L.at, battery: s.battery ?? null, ok: !offline && inR, offline, name: s.name, sensorId: s.id };
  },
  list: () => sdList().map((s) => ({ id: s.id, name: s.name, brand: s.brand, fridgeId: s.fridgeId || null, state: sdState(s).k })),
  serverOn: sdServerOn,
};
