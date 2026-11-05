/* Growth Gusto — server part of « Sondes connectées » (wireless fridge / freezer / cold-room thermometers).
   Firebase Cloud Functions v2, Node 20, region europe-west9.

   Exports
   - sondesIngest (HTTPS)  : webhook for any gateway able to send HTTP (Milesight / LoRaWAN network servers, TTN, ChirpStack,
                             Shelly « actions », home-made boxes). URL: …/sondesIngest?r=<restoId>&t=<token>. The per-resto token
                             lives in restos/{rid}/sensorKeys/gateway.token (created by the app, shown to copy).
   - sondesTick()          : plain async function, NOT scheduled here (cost rule: one Cloud Scheduler job for the whole app).
                             functions/index.js calls it every 15 min. It pulls the cloud APIs (Shelly Cloud, SensorPush, Govee,
                             UbiBot) for the sensors configured in each resto, then flags sensors that went silent.

   Data (all under restos/{rid}/)
   - sensors/{id}        { name, brand, fridgeId?, devId?, cfg?, active, lastSeen, lastTemp, lastHum?, battery?, rssi?,
                           lastStoredAt?, oorSince?, oorAlert?, offAlert?, battAlert?, slotDone? }
   - sensorKeys/{brand}  shelly {key, server} · sensorpush {email, password} · govee {key} · ubibot {key} · gateway {token}
   - sensorReadings/{id} { sensorId, fridgeId?, value, hum?, battery?, at, src }      (max one doc per sensor per 15 min)
   - readings/{id}       the HACCP relevé, same shape as js/releve.js commitReading, written once per service slot:
                           { fridgeId, fname, value, slot, day, at, uid:"sonde", by:"Sonde <name>", ok, action, source:"sonde", sensorId }
   - alerts/{id}         { type:"temp"|"sensor_offline"|"sensor_battery", level:"warn"|"bad", fridgeId, sensorId, value, at, text, seen:false }
   And it sets restos/{rid}.server.sondes = true the first time it works for a resto (the app then shows everything as live). */
"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const REGION = "europe-west9";
const STORE_EVERY = 14 * 60e3;   /* one sensorReadings doc per sensor per ~15 min */
const TOUCH_EVERY = 5 * 60e3;    /* the sensor doc (live value) is rewritten at most every 5 min unless the value moves */
const OOR_AFTER = 30 * 60e3;     /* out of range for 30 min = a real problem, not a door opened during the service */
const OFFLINE_AFTER = 30 * 60e3;
const SLOT_FROM = { midi: 10, soir: 18 }; /* the automatic relevé of a slot is taken from these hours (midi 10–16 h, soir 18–24 h) */

/* ───────── helpers ───────── */
const r1 = (v) => Math.round(v * 10) / 10;
const f2c = (f) => (f - 32) * 5 / 9;
const fr = (v) => String(r1(v)).replace(".", ",");
const numOf = (v) => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const voltPct = (v, lo, hi) => (v == null ? null : Math.max(0, Math.min(100, Math.round(((v - lo) / (hi - lo)) * 100))));
function localParts(ts, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
}
function slotOf(ts, tz) {
  const { day, hour } = localParts(ts, tz);
  if (hour >= SLOT_FROM.midi && hour < 16) return { day, slot: "midi" };
  if (hour >= SLOT_FROM.soir) return { day, slot: "soir" };
  return null;
}
const toMs = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const s = String(v).trim(); if (/^\d{9,13}$/.test(s)) return toMs(+s);
  const t = Date.parse(/\d{4}-\d\d-\d\d \d\d:\d\d/.test(s) && !/[zZ+]|-\d\d:\d\d$/.test(s) ? s.replace(" ", "T") + "Z" : s); return Number.isFinite(t) ? t : null;
};
async function getJson(url, opts = {}) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (e) {}
    if (!r.ok) throw new Error(`${r.status} ${tx.slice(0, 160)}`);
    return j;
  } finally { clearTimeout(tm); }
}
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* ───────── one reading: store it, update the sensor, fill the HACCP register, raise alerts ───────── */
/* ctx = { rid, resto, fridges:Map, batch helpers } ; s = sensor doc {id, ...} ; m = { value °C, at, hum?, battery?, rssi? } */
async function handleReading(ctx, s, m) {
  if (m.value == null || !Number.isFinite(m.value) || m.value < -60 || m.value > 80) return false;
  const at = Math.min(m.at || Date.now(), Date.now());
  if (s.lastSeen && at <= s.lastSeen) return false; /* nothing new */
  const base = db().collection("restos").doc(ctx.rid);
  const value = r1(m.value);
  const patch = { lastSeen: at, lastTemp: value };
  if (m.hum != null) patch.lastHum = r1(m.hum);
  if (m.battery != null) patch.battery = Math.round(m.battery);
  if (m.rssi != null) patch.rssi = Math.round(m.rssi);
  if (s.offAlert) patch.offAlert = false;
  const writes = [];

  if (!s.lastStoredAt || at - s.lastStoredAt >= STORE_EVERY) {
    patch.lastStoredAt = at;
    writes.push(base.collection("sensorReadings").add({ sensorId: s.id, ...(s.fridgeId ? { fridgeId: s.fridgeId } : {}), value, ...(patch.lastHum != null ? { hum: patch.lastHum } : {}), ...(patch.battery != null ? { battery: patch.battery } : {}), at, src: s.brand || "gateway" }));
  }

  const f = s.fridgeId ? await fridgeOf(ctx, s.fridgeId) : null;
  if (f && f.min != null && f.max != null) {
    const ok = value >= f.min && value <= f.max;
    const since = ok ? null : (s.oorSince || at);
    patch.oorSince = since;
    const sustained = !ok && at - since >= OOR_AFTER;
    if (ok && s.oorAlert) patch.oorAlert = false;
    if (sustained && !s.oorAlert) {
      patch.oorAlert = true;
      writes.push(alert(ctx, { type: "temp", level: "bad", fridgeId: s.fridgeId, sensorId: s.id, value, at, text: `${f.name} : ${fr(value)} °C depuis plus de 30 min (${value > f.max ? "trop chaud" : "trop froid"}, attendu ${fr(f.min)} à ${fr(f.max)} °C)` }));
    }
    /* the HACCP relevé of the service slot, once: the first in-range value, or the out-of-range value once it has lasted 30 min */
    const sl = slotOf(at, ctx.resto.tz);
    const key = sl && `${sl.day}:${sl.slot}`;
    if (sl && s.slotDone !== key && (ok || sustained)) {
      const ex = await base.collection("readings").where("fridgeId", "==", s.fridgeId).where("day", "==", sl.day).get();
      const has = ex.docs.some((d) => d.get("slot") === sl.slot);
      patch.slotDone = key;
      if (!has) writes.push(base.collection("readings").add({ fridgeId: s.fridgeId, fname: f.name, value, slot: sl.slot, day: sl.day, at, uid: "sonde", by: `Sonde ${s.name || ""}`.trim(), ok, action: ok ? "" : "Alerte envoyée par la sonde", source: "sonde", sensorId: s.id }));
    }
  }

  if (patch.battery != null) {
    if (patch.battery <= 15 && !s.battAlert) { patch.battAlert = true; writes.push(alert(ctx, { type: "sensor_battery", level: "warn", fridgeId: s.fridgeId || null, sensorId: s.id, value: patch.battery, at, text: `Pile faible sur la sonde ${s.name || ""} (${patch.battery} %)`.replace("  ", " ") })); }
    else if (patch.battery > 30 && s.battAlert) patch.battAlert = false;
  }

  /* skip the sensor write when nothing meaningful changed */
  const moved = s.lastTemp == null || Math.abs(value - s.lastTemp) >= 0.2;
  const flags = ["lastStoredAt", "oorAlert", "battAlert", "offAlert", "slotDone"].some((k) => k in patch && patch[k] !== s[k]) || (patch.oorSince || null) !== (s.oorSince || null);
  if (moved || flags || !s.lastSeen || at - s.lastSeen >= TOUCH_EVERY) writes.push(base.collection("sensors").doc(s.id).set(patch, { merge: true }));
  Object.assign(s, patch);
  await Promise.all(writes);
  if (ctx.resto && !(ctx.resto.server && ctx.resto.server.sondes)) { ctx.resto.server = { ...(ctx.resto.server || {}), sondes: true }; await base.set({ server: { sondes: true } }, { merge: true }); }
  return true;
}
async function fridgeOf(ctx, fid) {
  if (!ctx.fridges.has(fid)) { const d = await db().doc(`restos/${ctx.rid}/fridges/${fid}`).get(); ctx.fridges.set(fid, d.exists ? d.data() : null); }
  return ctx.fridges.get(fid);
}
function alert(ctx, a) { return db().collection(`restos/${ctx.rid}/alerts`).add({ ...a, seen: false }); }
async function ctxOf(rid) { const r = await db().doc(`restos/${rid}`).get(); return { rid, resto: r.exists ? r.data() : {}, fridges: new Map() }; }

/* ───────── webhook: any gateway ───────── */
/* Accepts one object or an array of them, JSON body or query string (GET works for Shelly « actions »:
   …&id=shellyhtg3-xxxx&temp=${ev.tC}). Recognised layouts: flat {id|devEUI|deviceId|mac|sensor, temperature|temp|tC|value, battery, rssi, time|ts|at},
   Milesight gateway HTTP integration, TTN v3 (end_device_ids + uplink_message.decoded_payload), ChirpStack v4 (deviceInfo + object). */
function parseGateway(p) {
  if (!p || typeof p !== "object") return [];
  if (Array.isArray(p)) return p.flatMap(parseGateway);
  if (Array.isArray(p.readings)) return p.readings.map((x) => ({ ...x, id: x.id || p.id || p.devEUI })).flatMap(parseGateway);
  const up = p.uplink_message || {}; const dec = up.decoded_payload || p.object || p.decoded || p.data || p.payload || {};
  const id = p.id || p.sensor || p.sensorId || p.devEUI || p.devEui || p.dev_eui || p.deviceId || p.device_id || p.mac || p.device ||
    (p.end_device_ids && (p.end_device_ids.dev_eui || p.end_device_ids.device_id)) || (p.deviceInfo && (p.deviceInfo.devEui || p.deviceInfo.deviceName));
  const pick = (...ks) => { for (const o of [p, dec]) for (const k of ks) { if (o && o[k] != null && typeof o[k] !== "object") { const n = numOf(o[k]); if (n != null) return n; } } return null; };
  let value = pick("temperature", "temp", "tC", "temperature_c", "temp_c", "ext_temperature", "temperature_1", "value");
  const tf = pick("tF", "temperature_f", "temp_f"); if (value == null && tf != null) value = f2c(tf);
  const meta = (up.rx_metadata && up.rx_metadata[0]) || (p.rxInfo && p.rxInfo[0]) || {};
  return id && value != null ? [{ id: String(id), value, hum: pick("humidity", "hum", "rh"), battery: pick("battery", "bat", "battery_level", "batt"), rssi: pick("rssi") ?? numOf(meta.rssi), at: toMs(p.time || p.ts || p.at || p.timestamp || up.received_at || p.received_at) || Date.now() }] : [];
}
const safeEq = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };

exports.sondesIngest = onRequest({ region: REGION, cors: false, maxInstances: 5, memory: "256MiB", timeoutSeconds: 30 }, async (req, res) => {
  try {
    const rid = String(req.query.r || "").slice(0, 80), tok = String(req.query.t || req.get("x-gusto-token") || "");
    if (!/^[\w-]{1,80}$/.test(rid) || !tok) { res.status(400).json({ ok: false, error: "missing r or t" }); return; }
    const k = await db().doc(`restos/${rid}/sensorKeys/gateway`).get();
    if (!k.exists || !safeEq(k.get("token"), tok)) { res.status(403).json({ ok: false, error: "bad token" }); return; }
    let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const q = { ...req.query }; delete q.r; delete q.t;
    const items = [...parseGateway(body), ...(Object.keys(q).length ? parseGateway(q) : [])].slice(0, 200);
    if (!items.length) { res.status(200).json({ ok: true, stored: 0, note: "no temperature found" }); return; }
    const ctx = await ctxOf(rid);
    const ss = (await db().collection(`restos/${rid}/sensors`).where("brand", "==", "gateway").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    let n = 0;
    for (const it of items) {
      let s = ss.find((x) => x.devId && norm(x.devId) === norm(it.id));
      if (!s) { /* first message of a new device: it joins the sensor that was added in the app without an id, or appears as « Nouvelle sonde » */
        s = ss.filter((x) => !x.devId && x.active !== false).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
        if (s) { s.devId = it.id; await db().doc(`restos/${rid}/sensors/${s.id}`).set({ devId: it.id }, { merge: true }); }
        else { const ref = db().collection(`restos/${rid}/sensors`).doc(); const data = { name: `Nouvelle sonde ${it.id.slice(-4)}`, brand: "gateway", devId: it.id, active: true, createdAt: Date.now(), auto: true }; await ref.set(data); s = { id: ref.id, ...data }; ss.push(s); }
      }
      if (s.active === false) continue;
      if (await handleReading(ctx, s, it)) n++;
    }
    res.status(200).json({ ok: true, stored: n });
  } catch (e) { logger.error("sondesIngest", e); res.status(500).json({ ok: false }); }
});

/* ───────── cloud pollers: each returns [{ s (sensor), m (measure) }] for the sensors of one resto ───────── */
const POLL = {
  /* Shelly Cloud Control API v1: POST https://<server>/device/status (id, auth_key). Key + server: app Shelly › Paramètres › Clé d'autorisation cloud.
     Gen1 (tmp.tC, bat.value), Gen2/Gen3 and BLU through a gateway ("temperature:0".tC, "devicepower:0".battery.percent). 1 request/s max. */
  async shelly(key, sensors) {
    const out = []; const host = String(key.server || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!host || !key.key) return out;
    for (const s of sensors) {
      if (!s.devId) continue;
      try {
        const j = await getJson(`https://${host}/device/status`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ id: s.devId, auth_key: key.key }).toString() });
        const st = j && j.isok && j.data && j.data.device_status; if (!st) continue;
        const find = (o, k, d = 0) => { if (!o || typeof o !== "object" || d > 4) return null; if (o[k] != null && typeof o[k] !== "object") return o[k]; for (const v of Object.values(o)) { const r = find(v, k, d + 1); if (r != null) return r; } return null; };
        const tC = numOf((st["temperature:0"] || {}).tC ?? (st.tmp || {}).tC ?? find(st, "tC"));
        const bat = numOf(((st["devicepower:0"] || {}).battery || {}).percent ?? (st.bat || {}).value ?? find(st, "percent"));
        const rssi = numOf((st.wifi || {}).rssi ?? (st.wifi_sta || {}).rssi ?? find(st, "rssi"));
        const at = toMs(st._updated) || (numOf((st.sys || {}).unixtime) ? numOf(st.sys.unixtime) * 1000 : null) || Date.now();
        if (tC != null) out.push({ s, m: { value: tC, battery: bat, rssi, at, hum: numOf((st["humidity:0"] || {}).rh ?? (st.hum || {}).value) } });
      } catch (e) { logger.warn("shelly", s.id, e.message); }
      await sleep(1100);
    }
    return out;
  },
  /* SensorPush Gateway Cloud API (needs the SensorPush G1 Wi-Fi gateway). Account e-mail + password → accesstoken. Temperatures come in °F.
     A sensor is matched by its SensorPush id or by its name in the SensorPush app. */
  async sensorpush(key, sensors) {
    const out = []; if (!key.email || !key.password) return out;
    const B = "https://api.sensorpush.com/api/v1";
    const post = (p, body, tok) => getJson(B + p, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...(tok ? { Authorization: tok } : {}) }, body: JSON.stringify(body || {}) });
    const a = await post("/oauth/authorize", { email: key.email, password: key.password });
    const t = await post("/oauth/accesstoken", { authorization: a.authorization });
    const tok = t.accesstoken;
    const devs = (await post("/devices/sensors", {}, tok)) || {};
    const idOf = (s) => (s.devId && devs[s.devId] ? s.devId : Object.keys(devs).find((id) => norm(devs[id].name) === norm(s.devId || s.cfg?.name || s.name)));
    const map = new Map(sensors.map((s) => [s, idOf(s)]).filter(([, id]) => id));
    if (!map.size) return out;
    const sm = await post("/samples", { limit: 1, sensors: [...map.values()] }, tok);
    for (const [s, id] of map) {
      const x = ((sm && sm.sensors && sm.sensors[id]) || [])[0]; if (!x || x.temperature == null) continue;
      const d = devs[id] || {};
      out.push({ s, m: { value: f2c(+x.temperature), hum: numOf(x.humidity), at: toMs(x.observed) || Date.now(), battery: voltPct(numOf(d.battery_voltage), 2.4, 3.0), rssi: numOf(d.rssi) } });
    }
    return out;
  },
  /* Govee developer API v2 (key: app Govee Home › Profil › ⚙ › Demander une clé API). Wi-Fi thermometers (H5179…) or Bluetooth ones behind a
     Govee gateway (H5151). Matched by device id (MAC) or by its name in the app. sensorTemperature is in °F unless cfg.unit === "C". */
  async govee(key, sensors) {
    const out = []; if (!key.key) return out;
    const H = { "Govee-API-Key": key.key, "content-type": "application/json" };
    const list = ((await getJson("https://openapi.api.govee.com/router/api/v1/user/devices", { headers: H })) || {}).data || [];
    for (const s of sensors) {
      const d = list.find((x) => norm(x.device) === norm(s.devId)) || list.find((x) => norm(x.deviceName) === norm(s.devId || s.name)); if (!d) continue;
      try {
        const j = await getJson("https://openapi.api.govee.com/router/api/v1/device/state", { method: "POST", headers: H, body: JSON.stringify({ requestId: crypto.randomUUID(), payload: { sku: d.sku, device: d.device } }) });
        const caps = (j && j.payload && j.payload.capabilities) || []; const v = (inst) => { const c = caps.find((x) => x.instance === inst); return c && c.state ? c.state.value : null; };
        if (v("online") === false) continue;
        let t = numOf(v("sensorTemperature")); if (t == null) continue; if ((s.cfg && s.cfg.unit) !== "C") t = f2c(t);
        let h = v("sensorHumidity"); h = numOf(h && typeof h === "object" ? h.currentHumidity : h);
        out.push({ s, m: { value: t, hum: h, at: Date.now() } });
      } catch (e) { logger.warn("govee", s.id, e.message); }
      await sleep(300);
    }
    return out;
  },
  /* UbiBot (WS1, WS1 Pro…): one call lists every channel with its last values. Account key: console.ubibot.com › Compte › Clés API.
     Matched by channel id or channel name. field1 = built-in temperature, an external probe uses the field set in cfg.field (often 8). */
  async ubibot(key, sensors) {
    const out = []; if (!key.key) return out;
    const j = await getJson(`https://webapi.ubibot.com/channels?account_key=${encodeURIComponent(key.key)}`);
    const chs = (j && j.channels) || [];
    for (const s of sensors) {
      const c = chs.find((x) => String(x.channel_id) === String(s.devId)) || chs.find((x) => norm(x.name) === norm(s.devId || s.name)); if (!c) continue;
      let lv = c.last_values; try { if (typeof lv === "string") lv = JSON.parse(lv); } catch (e) { lv = null; } if (!lv) continue;
      const fk = "field" + ((s.cfg && +s.cfg.field) || 1); const tv = lv[fk]; if (!tv || tv.value == null) continue;
      out.push({ s, m: { value: numOf(tv.value), hum: lv.field2 ? numOf(lv.field2.value) : null, battery: lv.field4 ? voltPct(numOf(lv.field4.value), 2.2, 3.0) : null, rssi: lv.field5 ? numOf(lv.field5.value) : null, at: toMs(tv.created_at) || Date.now() } });
    }
    return out;
  },
};

/* ───────── every 15 min (called by the single scheduled job of functions/index.js) ───────── */
exports.sondesTick = async function sondesTick() {
  const now = Date.now(); let polled = 0, stored = 0, offline = 0;
  const keys = await db().collectionGroup("sensorKeys").get(); /* only restos that set sensors up; no index needed */
  const byResto = new Map();
  keys.docs.forEach((d) => { const rid = d.ref.parent.parent && d.ref.parent.parent.id; if (!rid) return; (byResto.get(rid) || byResto.set(rid, {}).get(rid))[d.id] = d.data(); });
  for (const [rid, K] of byResto) {
    try {
      const all = (await db().collection(`restos/${rid}/sensors`).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.active !== false);
      if (!all.length) continue;
      const ctx = await ctxOf(rid);
      for (const brand of Object.keys(POLL)) {
        const ss = all.filter((s) => s.brand === brand); if (!ss.length || !K[brand]) continue;
        try {
          const got = await POLL[brand](K[brand], ss); polled += got.length;
          for (const { s, m } of got) if (await handleReading(ctx, s, m)) stored++;
          if (K[brand].error) await db().doc(`restos/${rid}/sensorKeys/${brand}`).set({ error: admin.firestore.FieldValue.delete(), okAt: now }, { merge: true });
        } catch (e) {
          logger.warn("poll", rid, brand, e.message);
          /* shown in the app (« Connexion refusée ») so the gérant can re-enter the key */
          if (!K[brand].error) await db().doc(`restos/${rid}/sensorKeys/${brand}`).set({ error: String(e.message).slice(0, 140), errorAt: now }, { merge: true });
        }
      }
      /* silent sensors (CSV ones are imports, never « online ») */
      const batch = db().batch(); let nb = 0;
      for (const s of all) {
        if (s.brand === "csv" || !s.lastSeen || s.offAlert || now - s.lastSeen < OFFLINE_AFTER) continue;
        const mins = Math.round((now - s.lastSeen) / 60e3);
        batch.set(db().doc(`restos/${rid}/sensors/${s.id}`), { offAlert: true }, { merge: true });
        batch.set(db().collection(`restos/${rid}/alerts`).doc(), { type: "sensor_offline", level: "warn", fridgeId: s.fridgeId || null, sensorId: s.id, value: null, at: now, text: `La sonde ${s.name || ""} ne répond plus depuis ${mins >= 90 ? Math.round(mins / 60) + " h" : mins + " min"}`.replace("  ", " "), seen: false });
        nb += 2; offline++;
      }
      if (nb) await batch.commit();
    } catch (e) { logger.error("sondesTick", rid, e); }
  }
  logger.info("sondesTick", { restos: byResto.size, polled, stored, offline });
  return { restos: byResto.size, polled, stored, offline };
};

/* exported for tests */
exports._sondes = { parseGateway, slotOf, toMs };
