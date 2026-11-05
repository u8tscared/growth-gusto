/* Growth Gusto — saisie rapide : dictée vocale (« Dicter ») et sonde Bluetooth (« Prendre avec la sonde »).
   Loaded after releve.js and reception.js. Nothing here writes data by itself: every voice reading goes through
   ACT.saveReading (so required photo, corrective action and service peaks behave exactly like a manual reading),
   and the probe only fills the value on screen (Relevé: setTemp, Réception: recSetTemp).
   API: window.SAISIE = { voiceSupported(), btSupported(), listen(cb), probeRead(), parse(text, fridges) }. */

Object.assign(IC, {
  mic: ["f:M9 5.5a3 3 0 0 1 6 0v5.5a3 3 0 0 1-6 0z", "M9 5.5a3 3 0 0 1 6 0v5.5a3 3 0 0 1-6 0z", "M5.5 11a6.5 6.5 0 0 0 13 0", "M12 17.5v3.25", "M8.75 20.75h6.5"],
  probe: ["f:M12 2.75a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", "c:12,6.75,4", "M12 6.75 13.6 5.2", "M12 10.75v10.5"],
});

/* ───────────────────────── support ───────────────────────── */
const saiRec = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
const saiIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const saiBt = () => !!(navigator.bluetooth && typeof navigator.bluetooth.requestDevice === "function" && window.isSecureContext !== false);
const SAI_KEY = "gg.saisie.probe";
function saiSaved() { try { return JSON.parse(localStorage.getItem(SAI_KEY) || "null"); } catch (e) { return null; } }
function saiSave(v) { try { if (v) localStorage.setItem(SAI_KEY, JSON.stringify(v)); else localStorage.removeItem(SAI_KEY); } catch (e) {} }

/* ───────────────────────── French number + fridge parser ───────────────────────── */
const SAI_UNITS = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 };
const SAI_TENS = { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
const SAI_ORD = { premier: 1, premiere: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7, huitieme: 8, neuvieme: 9, dixieme: 10 };
const SAI_FILL = new Set(["de", "du", "des", "la", "le", "l", "les", "numero", "n", "no", "num", "the"]);
const SAI_PRE = new Set(["a", "est", "il", "fait", "c", "ca", "cest", "temperature", "temp", "je", "lis", "on", "environ", "y", "en", "et", "egal", "egale", "=", ":", "mesure", "affiche", "indique", "pile", "tout", "juste"]);
const SAI_DEG = new Set(["degre", "degres", "deg", "celsius", "c", "°"]);
const SAI_ALIAS = {
  frigo: [["frigo"], ["refrigerateur"], ["frigidaire"], ["frigot"]],
  cfp: [["chambre", "froide"], ["chambre"], ["cf"], ["chambre", "froide", "positive"]],
  service: [["frigo", "de", "service"], ["service"], ["frigo"]],
  congel: [["congelateur"], ["congel"], ["congelo"], ["congelos"], ["chambre", "negative"], ["surgele"], ["surgeles"], ["negatif"]],
  saladette: [["saladette"], ["salade"]],
  cave: [["cave"], ["cave", "a", "vin"], ["boissons"], ["boisson"]],
  vitrine: [["vitrine"]],
};
const saiNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
function saiWords(s) {
  let x = saiNorm(s).replace(/[−–—]/g, "-").replace(/°\s*c\b/g, " degres ").replace(/°/g, " degres ").replace(/n°/g, " numero ");
  x = x.replace(/([a-z])-(?=[a-z])/g, "$1 ").replace(/(^|[^\d])-\s*(?=\d)/g, "$1 moins ").replace(/(\d)\.(\d)/g, "$1,$2");
  x = x.replace(/(\d+)\s*(?:er|ere|e|eme)\b/g, "$1").replace(/([a-z])'/g, "$1 ");
  x = x.replace(/(\d),(\d)/g, "$1#$2").replace(/[,;!?]/g, " , ").replace(/\./g, " , ").replace(/#/g, ",");
  return x.split(/\s+/).filter(Boolean);
}
/* turn words into tokens: { w } or { n, raw, dec } (number); word numbers are composed (« dix huit », « vingt et un ») */
function saiTokens(s) {
  const ws = saiWords(s), out = [];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (/^\d+(,\d+)?$/.test(w)) { out.push({ n: parseFloat(w.replace(",", ".")), raw: w.replace(",", "."), dec: w.includes(",") }); continue; }
    if (SAI_ORD[w] != null) { out.push({ n: SAI_ORD[w], raw: String(SAI_ORD[w]), ord: true }); continue; }
    if (SAI_UNITS[w] != null || SAI_TENS[w] != null || w === "cent") {
      let v = 0, j = i;
      const u = (k) => SAI_UNITS[ws[k]];
      if (ws[j] === "cent") { v = 100; j++; }
      else if (SAI_TENS[ws[j]] != null) {
        v = SAI_TENS[ws[j]]; j++;
        if (ws[j] === "et" && (ws[j + 1] === "un" || ws[j + 1] === "une" || (v === 60 && ws[j + 1] === "onze"))) { v += u(j + 1); j += 2; }
        else if (u(j) != null && u(j) > 0 && (u(j) < 10 || v === 60)) { const a = u(j); v += a; j++; if (a === 10 && u(j) != null && u(j) >= 7 && u(j) <= 9) { v += u(j); j++; } }
      } else if (ws[j] === "quatre" && /^vingts?$/.test(ws[j + 1] || "")) {
        v = 80; j += 2; if (u(j) != null && u(j) > 0) { v += u(j); j++; if (v === 90 && u(j) >= 7 && u(j) <= 9) { v += u(j); j++; } }
      } else {
        v = u(j); j++;
        if (v === 10 && u(j) != null && u(j) >= 7 && u(j) <= 9) { v += u(j); j++; }
      }
      out.push({ n: v, raw: String(v), word: true }); i = j - 1; continue;
    }
    out.push({ w });
  }
  return out;
}
function saiLev(a, b) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function saiWordEq(a, b) {
  if (!a || !b) return false; if (a === b) return true;
  const s = (x) => x.replace(/(s|x)$/, ""); if (s(a) === s(b)) return true;
  const L = Math.min(a.length, b.length); if (L < 5) return false;
  return saiLev(a, b) <= (L >= 8 ? 2 : 1);
}
/* key = [{w}|{n}] built from the fridge name, or from its type alias (+ the name's number) */
function saiKeys(f) {
  const name = saiTokens(f.name).filter((t) => t.n != null || !SAI_FILL.has(t.w));
  const num = name.filter((t) => t.n != null).map((t) => ({ n: t.n }));
  let k = "frigo"; try { k = typeof relTypeOf === "function" ? relTypeOf(f).k : f.type || "frigo"; } catch (e) {}
  const keys = [{ toks: name, bonus: 2 }];
  (SAI_ALIAS[k] || []).forEach((a) => keys.push({ toks: [...a.filter((w) => !SAI_FILL.has(w)).map((w) => ({ w })), ...num], bonus: 0 }));
  return keys;
}
const saiIsTempNum = (T, j) => { const nx = T[j + 1]; return !!(T[j].dec || (nx && nx.w && (SAI_DEG.has(nx.w) || nx.w === "virgule" || nx.w === "point" || nx.w === "et"))); };
/* how well does fridge key `K` match the spoken tokens from i? → { len, score } or null */
function saiMatchKey(T, i, K) {
  let j = i, k = 0, words = 0, nums = 0, last = i;
  while (j < T.length && k < K.length) {
    const s = T[j];
    if (s.w === ",") break;
    let hit = -1;
    for (let q = k; q < K.length; q++) {
      const kt = K[q];
      if (kt.n != null) { if (s.n != null && !s.dec && s.n === kt.n && !saiIsTempNum(T, j)) hit = q; break; } /* a number in the name can't be skipped */
      if (s.w && saiWordEq(s.w, kt.w)) { hit = q; break; }
    }
    if (hit < 0 && s.n != null && s.dec && K[k] && K[k].n != null && Math.floor(s.n) === K[k].n && words) {
      /* « frigo 2,3 degrés » heard as one number: 2 = the fridge, 3 = the temperature */
      const frac = s.raw.split(".")[1]; T.splice(j, 1, { n: K[k].n, raw: String(K[k].n) }, { n: parseFloat(frac), raw: frac }); hit = k;
    }
    if (hit >= 0) { if (K[hit].n != null) nums++; else words++; k = hit + 1; j++; last = j; continue; }
    if (s.w && SAI_FILL.has(s.w) && words) { j++; continue; }
    break;
  }
  if (!words) return null;
  const needNum = K.slice(k).some((t) => t.n != null);
  if (needNum) { const s = T[last]; if (s && s.n != null && !s.dec && !saiIsTempNum(T, last)) return null; } /* « frigo 1 » is not frigo 2 */
  const allNum = !K.some((t) => t.n != null) || !needNum;
  return { len: last - i, score: words * 10 + nums * 12 + (allNum ? 5 : 0) + (k === K.length ? 3 : 0) };
}
function saiFindFridge(T, i, fridges) {
  let best = null;
  for (const f of fridges) for (const key of saiKeys(f)) {
    const m = saiMatchKey(T, i, key.toks); if (!m) continue;
    const sc = m.score + key.bonus;
    if (!best || sc > best.sc || (sc === best.sc && m.len > best.len)) best = { sc, len: m.len, list: [f] };
    else if (sc === best.sc && m.len === best.len && !best.list.includes(f)) best.list.push(f);
  }
  return best;
}
/* a temperature from position j → { v, len } */
function saiReadTemp(T, j) {
  const j0 = j; let neg = false;
  while (j < T.length && T[j].w && (SAI_PRE.has(T[j].w) || T[j].w === ",") && T[j].w !== "moins") j++;
  if (T[j] && T[j].w === "moins") { neg = true; j++; }
  else if (T[j] && T[j].w === "plus") j++;
  const t = T[j]; if (!t || t.n == null) return null;
  let v = t.n; j++;
  if (T[j] && (T[j].w === "virgule" || T[j].w === "point") && T[j + 1] && T[j + 1].n != null && !T[j + 1].dec) { v = parseFloat(`${Math.floor(v)}.${T[j + 1].raw}`); j += 2; }
  else if (T[j] && T[j].w === "et" && T[j + 1] && /^demie?$/.test(T[j + 1].w || "")) { v += 0.5; j += 2; }
  if (T[j] && T[j].w && SAI_DEG.has(T[j].w)) j++;
  if (neg) v = -v;
  if (!(v >= -60 && v <= 110)) return null;
  return { v: Math.round(v * 10) / 10, len: j - j0 };
}
/* parse a whole utterance into [{ fid, v, guess }] (one per fridge, last mention wins). `ctx.done(fid)` = already read this round,
   `ctx.open` = the card that is open (gets a bare value). Several values in a row without names go to the next fridges in order. */
function saiParse(text, fridges, ctx = {}) {
  const T = saiTokens(text); const items = new Map(); const done = ctx.done || (() => false);
  let cur = null, guess = false, lastF = null; let i = 0;
  const free = () => fridges.filter((f) => !done(f.id) && !items.has(f.id));
  const nextFree = () => { const fs = free(); if (!fs.length) return null; if (lastF) { const ix = fridges.indexOf(lastF); const after = [...fridges.slice(ix + 1), ...fridges.slice(0, ix)].find((f) => fs.includes(f)); if (after) return after; } return (ctx.open && fs.find((f) => f.id === ctx.open)) || fs[0]; };
  while (i < T.length) {
    if (T[i].w === ",") { i++; continue; }
    const m = saiFindFridge(T, i, fridges);
    if (m && m.len) {
      const pick = m.list.find((f) => !done(f.id) && !items.has(f.id)) || m.list.find((f) => !items.has(f.id)) || m.list[0];
      cur = pick; guess = m.list.length > 1; i += m.len; continue;
    }
    const t = saiReadTemp(T, i);
    if (t) {
      const f = cur || nextFree(); i += t.len;
      if (f) { items.set(f.id, { fid: f.id, v: t.v, guess: guess || !cur }); lastF = f; }
      cur = null; guess = false; continue;
    }
    i++;
  }
  return [...items.values()];
}

/* ───────────────────────── voice ───────────────────────── */
let saiLive = null; /* { rec, items, text, stop } */
function saiListen(cb, opts = {}) {
  const R = saiRec(); if (!R) { cb && cb({ error: "unsupported" }); return () => {}; }
  const rec = new R(); rec.lang = "fr-FR"; rec.interimResults = true; rec.continuous = !saiIOS() || !!opts.continuous; rec.maxAlternatives = 1;
  let finals = "", stopped = false;
  rec.onresult = (e) => {
    let interim = "";
    for (let k = e.resultIndex; k < e.results.length; k++) { const r = e.results[k]; if (r.isFinal) finals += " " + r[0].transcript; else interim += " " + r[0].transcript; }
    cb && cb({ text: (finals + interim).trim(), final: !interim });
  };
  rec.onerror = (e) => { cb && cb({ error: e.error || "error" }); };
  rec.onend = () => { if (!stopped) cb && cb({ end: true, text: finals.trim() }); stopped = true; };
  try { rec.start(); } catch (e) { cb && cb({ error: "start" }); }
  return () => { if (stopped) return; stopped = true; try { rec.stop(); } catch (e) {} cb && cb({ end: true, text: finals.trim() }); };
}

const saiAlerted = new Set();
function saiAlert(f, v) {
  const k = f.id + ":" + v; if (saiAlerted.has(k)) return; saiAlerted.add(k);
  const txt = `${f.name} ${v > f.max ? "trop chaud" : "trop froid"} : ${relDeg(v)} °C`;
  let pushed = false;
  try { if (window.ALERTES && typeof window.ALERTES.push === "function") { const pr = window.ALERTES.push({ type: "temp", level: "bad", text: `${f.name} à ${fmt(v)} °C`, sub: "Saisie vocale · hors seuil", fridgeId: f.id, value: v, at: Date.now(), key: `voice_${f.id}_${dayKey()}_${S.slot}` }); if (pr && pr.catch) pr.catch(() => {}); pushed = true; } } catch (e) {}
  SFX.err(); buzz([20, 40, 20]);
  if (saiLive && $("#saiV")) { saiLive.alert = txt; saiPaint(); } else if (!pushed) toast(txt, "err");
}
const saiDoneNow = (fid) => readingsFor(dayKey(), S.slot).some((r) => r.fridgeId === fid);
const saiOut = (f, v) => !relIn(f, v) && !(relIsService(f) && v > f.max && v <= relSvcMax(f));

function saiLineHtml(it, i) {
  const f = relFr(it.fid); if (!f) return "";
  const out = saiOut(f, it.v), peak = !out && !relIn(f, it.v);
  const tone = out ? "bad" : peak ? "pk" : "ok";
  return `<div class="sai-line st ${tone}" style="--i:${i}"><span class="ic ${out ? "bad" : peak ? "warn" : "ok"}">${relIco(f)}</span><div class="tx"><b class="rel-ell">${esc(f.name)}</b><em>${out ? (it.v > f.max ? "Trop chaud" : "Trop froid") : peak ? "Pic de service" : relRange(f)}</em></div><span class="sai-lcd ${tone}">${relDeg(it.v)}°</span><button class="iconbtn sai-rm" data-act="saiRm" data-id="${it.fid}" aria-label="Retirer ${esc(f.name)}">${ico("x")}</button></div>`;
}
function saiSheetHtml() {
  const L = saiLive || { items: [], text: "" }; const n = L.items.length; const on = L.on;
  return `<div class="sai-v" id="saiV">
    <div class="sai-mh"><button class="sai-mic ${on ? "on" : ""}" data-act="saiMic" aria-label="${on ? "Arrêter la dictée" : "Reprendre la dictée"}">${ico("mic")}<i></i><i></i></button>
      <div class="sai-said" id="saiSaid" aria-live="polite">${L.text ? `« ${esc(L.text)} »` : on ? `<span class="sai-ph">J'écoute…</span>` : `<span class="sai-ph">Touchez le micro</span>`}</div>
      <p class="sai-hint" id="saiHint">${L.err ? esc(L.err) : n ? "" : "Dites : « frigo 2, trois degrés »"}</p></div>
    <div class="sai-alert" id="saiAlert" ${L.alert ? "" : "hidden"}>${ico("alert")}<span>${esc(L.alert || "")}</span></div>
    <div class="sai-list" id="saiList">${L.items.map(saiLineHtml).join("")}</div>
    <button class="btn acc block" data-act="saiOk" id="saiOk" ${n ? "" : "disabled"}>${ico("check")}${n ? `Valider ${n} relevé${n > 1 ? "s" : ""}` : "Valider"}</button>
    <button class="btn ghost block" data-act="saiCancel">Annuler</button></div>`;
}
function saiPaint() {
  if (!$("#saiV")) return;
  const L = saiLive; const said = $("#saiSaid"), list = $("#saiList"), ok = $("#saiOk"), hint = $("#saiHint"), mic = $(".sai-mic");
  if (said) said.innerHTML = L.text ? `« ${esc(L.text)} »` : `<span class="sai-ph">${L.on ? "J'écoute…" : "Touchez le micro"}</span>`;
  if (hint) hint.textContent = L.err || (L.items.length ? "" : "Dites : « frigo 2, trois degrés »");
  const al = $("#saiAlert"); const live = L.alert && L.items.some((x) => { const f = relFr(x.fid); return f && saiOut(f, x.v); });
  if (al) { const was = al.hidden; al.hidden = !live; if (live) { $("span", al).textContent = L.alert + " · une action vous sera demandée"; if (was) { al.classList.remove("pop"); void al.offsetWidth; al.classList.add("pop"); } } }
  if (mic) { mic.classList.toggle("on", !!L.on); mic.setAttribute("aria-label", L.on ? "Arrêter la dictée" : "Reprendre la dictée"); }
  if (list) {
    const sig = L.items.map((x) => x.fid + "=" + x.v).join("|");
    if (list.dataset.sig !== sig) { const old = new Set((list.dataset.sig || "").split("|")); list.dataset.sig = sig; list.innerHTML = L.items.map(saiLineHtml).join(""); $$(".sai-line", list).forEach((el, i) => { const it = L.items[i]; if (!old.has(it.fid + "=" + it.v)) el.classList.add("pop"); }); }
  }
  if (ok) { const n = L.items.length; ok.disabled = !n; ok.innerHTML = `${ico("check")}${n ? `Valider ${n} relevé${n > 1 ? "s" : ""}` : "Valider"}`; }
}
/* new text heard → parse, fill the cards behind live, alert at once on an out-of-range value */
function saiHeard(text) {
  const L = saiLive; if (!L) return;
  const base = L.prefix ? L.prefix + " , " + text : text;
  L.text = base.trim();
  const fs = S.fridges.filter((f) => !saiDoneNow(f.id));
  const items = saiParse(L.text, fs, { open: S.open, done: (id) => L.removed.has(id) });
  L.items = items.filter((x) => !L.removed.has(x.fid));
  for (const it of L.items) {
    const f = relFr(it.fid); if (!f) continue;
    if (S.temp[it.fid] !== it.v && typeof setTemp === "function") setTemp(it.fid, it.v);
    if (saiOut(f, it.v)) saiAlert(f, it.v);
  }
  saiPaint();
}
function saiStart() {
  const L = saiLive; if (!L) return;
  if (L.text) L.prefix = L.text; /* resuming keeps what was already said */
  L.err = ""; L.on = true; saiPaint();
  L.stop = saiListen((ev) => {
    if (saiLive !== L) return;
    if (ev.error) {
      L.on = false;
      L.err = ev.error === "not-allowed" || ev.error === "service-not-allowed" ? "Micro refusé : autorisez-le dans les réglages du navigateur." : ev.error === "no-speech" ? "Je n'ai rien entendu. Touchez le micro." : ev.error === "network" ? "Dictée indisponible sans connexion." : ev.error === "aborted" ? "" : "La dictée s'est arrêtée. Touchez le micro.";
      if (L.err) SFX.err(); saiPaint(); return;
    }
    if (ev.text != null && ev.text !== "") saiHeard(ev.text);
    if (ev.end) { L.on = false; saiPaint(); }
  });
  SFX.tap(); buzz(6);
}
function saiStopVoice() { const L = saiLive; if (L && L.stop) { const s = L.stop; L.stop = null; s(); } if (L) L.on = false; }
/* the sheet was closed (scrim, drag, Échap): stop listening */
setInterval(() => { if (saiLive && saiLive.on && !$("#saiV")) { saiStopVoice(); saiLive = null; } }, 400);

/* save the dictated values one by one through the normal path: in-range first, then each out-of-range one asks for its action */
async function saiCommit(items) {
  const okFirst = [...items].sort((a, b) => { const fa = relFr(a.fid), fb = relFr(b.fid); return (fa && saiOut(fa, a.v) ? 1 : 0) - (fb && saiOut(fb, b.v) ? 1 : 0); });
  const fake = { tagName: "DIV", dataset: {} };
  for (const it of okFirst) {
    const f = relFr(it.fid); if (!f || saiDoneNow(f.id)) continue;
    S.temp[f.id] = it.v; relTouched().add(f.id);
    if (relPhMust()) {
      const p = (S.ui.relPh || {})[f.id];
      if (!(p && !p.busy && (p.photoId || p.photoUrl))) { /* photo required: open that card, values of the others stay filled */
        S.open = f.id; S.ui.relScroll = f.id; rerender(); SFX.err(); buzz([10, 30, 10]); toast("Photo obligatoire : prenez-la, puis validez"); return;
      }
    }
    if (saiOut(f, it.v)) {
      S.open = f.id;
      await ACT.saveReading(fake, f.id); /* opens the corrective action sheet */
      await saiWaitSheet();
      if (!saiDoneNow(f.id)) return; /* « Changer la température » : stop here, the card stays filled */
      await saiPause(620);
      continue;
    }
    await ACT.saveReading(fake, f.id);
    await saiPause(620);
  }
}
const saiPause = (ms) => new Promise((r) => setTimeout(r, ms));
function saiWaitSheet() { return new Promise((res) => { const t = setInterval(() => { if (!$("#sheet").classList.contains("open")) { clearInterval(t); res(); } }, 180); }); }

/* ───────────────────────── Bluetooth probe ───────────────────────── */
const ETI = { svc: "45544942-4c55-4554-4845-524db87ad700", s1: "45544942-4c55-4554-4845-524db87ad701", s2: "45544942-4c55-4554-4845-524db87ad703", cmd: "45544942-4c55-4554-4845-524db87ad705" };
const HTS = { svc: 0x1809, meas: 0x2a1c, inter: 0x2a1e };
const ESS = { svc: 0x181a, temp: 0x2a6e };
const BT = { dev: null, ch: null, kind: null, last: null, lastAt: 0, wait: [], busy: false };
/* IEEE-11073 32-bit FLOAT (Health Thermometer): 24-bit signed mantissa + 8-bit signed exponent */
function saiF11073(dv, o) {
  const raw = dv.getUint32(o, true); let m = raw & 0xffffff; const e = (raw >>> 24) << 24 >> 24;
  if (m === 0x7fffff || m === 0x800000 || m === 0x7ffffe || m === 0x800002 || m === 0x800001) return NaN;
  if (m & 0x800000) m -= 0x1000000; return m * Math.pow(10, e);
}
function saiDecode(kind, dv) {
  if (!dv || !dv.byteLength) return NaN;
  if (kind === "eti") { if (dv.byteLength < 4 || dv.getUint32(0, true) === 0xffffffff) return NaN; const v = dv.getFloat32(0, true); return v > -100 && v < 400 ? v : NaN; }
  if (kind === "ess") { const v = dv.getInt16(0, true); return v === -32768 ? NaN : v / 100; }
  /* Health Thermometer measurement: flags, then FLOAT; bit 0 = Fahrenheit */
  if (dv.byteLength < 5) return NaN; const fl = dv.getUint8(0); let v = saiF11073(dv, 1); if (fl & 1) v = (v - 32) * 5 / 9; return v;
}
function saiFeed(v) {
  if (!isFinite(v)) return; v = Math.round(v * 10) / 10; BT.last = v; BT.lastAt = Date.now();
  const w = BT.wait; BT.wait = []; w.forEach((r) => r(v));
}
async function saiConnect(dev) {
  const gatt = dev.gatt.connected ? dev.gatt : await dev.gatt.connect();
  const tryS = async (u) => { try { return await gatt.getPrimaryService(u); } catch (e) { return null; } };
  let s;
  if ((s = await tryS(ETI.svc))) {
    const ch = await s.getCharacteristic(ETI.s1); BT.kind = "eti"; BT.ch = ch;
    try { await ch.startNotifications(); ch.addEventListener("characteristicvaluechanged", (e) => saiFeed(saiDecode("eti", e.target.value))); } catch (e) {}
    try { const c = await s.getCharacteristic(ETI.cmd); await c.startNotifications(); c.addEventListener("characteristicvaluechanged", async () => { try { saiFeed(saiDecode("eti", await ch.readValue())); } catch (x) {} }); } catch (e) {} /* button on the probe pressed */
  } else if ((s = await tryS(HTS.svc))) {
    BT.kind = "hts"; let any = false;
    for (const u of [HTS.meas, HTS.inter]) { try { const ch = await s.getCharacteristic(u); await ch.startNotifications(); ch.addEventListener("characteristicvaluechanged", (e) => saiFeed(saiDecode("hts", e.target.value))); BT.ch = BT.ch || ch; any = true; } catch (e) {} }
    if (!any) throw new Error("nochar");
  } else if ((s = await tryS(ESS.svc))) {
    const ch = await s.getCharacteristic(ESS.temp); BT.kind = "ess"; BT.ch = ch;
    try { await ch.startNotifications(); ch.addEventListener("characteristicvaluechanged", (e) => saiFeed(saiDecode("ess", e.target.value))); } catch (e) {}
  } else throw new Error("noservice");
  if (!dev._saiDisc) { dev._saiDisc = true; dev.addEventListener("gattserverdisconnected", () => { BT.ch = null; saiProbeSync(); }); }
  BT.dev = dev; saiProbeSync();
}
async function saiPair(kind) {
  const opt = kind === "eti"
    ? { filters: [{ services: [ETI.svc] }, { namePrefix: "Thermapen" }, { namePrefix: "ThermaQ" }, { namePrefix: "BlueTherm" }, { namePrefix: "RayTemp" }], optionalServices: [ETI.svc, "battery_service"] }
    : { acceptAllDevices: true, optionalServices: [HTS.svc, ESS.svc, ETI.svc] };
  const dev = await navigator.bluetooth.requestDevice(opt);
  await saiConnect(dev);
  saiSave({ id: dev.id, name: dev.name || (kind === "eti" ? "Thermapen Blue" : "Sonde Bluetooth"), kind });
  return dev;
}
/* find the remembered probe again without the picker when the browser allows it (Chrome getDevices) */
async function saiDevice() {
  if (BT.dev) return BT.dev; const sv = saiSaved(); if (!sv) return null;
  try { if (navigator.bluetooth.getDevices) { const ds = await navigator.bluetooth.getDevices(); const d = ds.find((x) => x.id === sv.id) || ds.find((x) => x.name && x.name === sv.name); if (d) return d; } } catch (e) {}
  /* not allowed to reconnect silently: ask once (this runs from a tap) */
  const dev = await navigator.bluetooth.requestDevice(sv.kind === "eti" ? { filters: [{ services: [ETI.svc] }, ...(sv.name ? [{ name: sv.name }] : [])], optionalServices: [ETI.svc] } : { ...(sv.name ? { filters: [{ name: sv.name }] } : { acceptAllDevices: true }), optionalServices: [HTS.svc, ESS.svc, ETI.svc] });
  saiSave({ ...sv, id: dev.id, name: dev.name || sv.name }); return dev;
}
/* one temperature in °C from the paired probe */
async function saiProbeRead(timeout = 9000) {
  if (!saiBt()) throw new Error("unsupported");
  const dev = await saiDevice(); if (!dev) throw new Error("nodevice");
  if (!dev.gatt.connected || !BT.ch) await saiConnect(dev);
  if (BT.kind === "eti" || BT.kind === "ess") { try { const v = saiDecode(BT.kind, await BT.ch.readValue()); if (isFinite(v)) { saiFeed(v); return BT.last; } } catch (e) {} }
  if (BT.last != null && Date.now() - BT.lastAt < 2500) return BT.last;
  return new Promise((res, rej) => { const t = setTimeout(() => { BT.wait = BT.wait.filter((x) => x !== ok); rej(new Error("timeout")); }, timeout); const ok = (v) => { clearTimeout(t); res(v); }; BT.wait.push(ok); });
}
const saiBtErr = (e) => {
  const m = (e && (e.name || e.message)) || "";
  if (m === "NotFoundError" || /cancel/i.test(m)) return ""; /* the person closed the picker */
  if (m === "timeout") return "Pas de mesure : plantez la sonde et appuyez sur son bouton.";
  if (m === "noservice" || m === "nochar") return "Cette sonde n'utilise pas le service thermomètre standard.";
  if (m === "NotAllowedError" || m === "SecurityError") return "Bluetooth refusé : autorisez-le dans le navigateur.";
  return "Sonde injoignable : allumez-la et rapprochez-la.";
};

/* ───────────────────────── markup hooks (called from releve.js) ───────────────────────── */
function saiProbeShow() { return saiBt() && !!saiSaved(); }
/* the Dicter / Sonde row under the midi/soir switch */
function saiBar() {
  const v = !!saiRec(), b = saiBt() || saiIOS(); if (!v && !b) return "";
  const sv = saiSaved();
  return `<div class="sai-bar st" style="--i:1">${v ? `<button class="btn sai-dict" data-act="saiDict">${ico("mic")}Dicter</button>` : ""}${b ? `<button class="btn soft sai-bt ${sv && saiBt() ? "paired" : ""}" data-act="saiBtSheet" aria-label="Sonde Bluetooth">${ico("bt")}<span class="rel-ell">${sv && saiBt() ? esc(relShort(sv.name, 16)) : "Sonde"}</span></button>` : ""}</div>`;
}
/* « Prendre avec la sonde » inside an open fridge card (key = fridge id, or e-/s- key of a correction sheet) */
function saiProbeBtn(key) { return saiProbeShow() ? `<button class="sai-probe" data-act="saiProbe" data-id="${esc(key)}">${ico("probe")}<span>Prendre avec la sonde</span></button>` : ""; }
window.saisieBar = saiBar; window.saisieProbeBtn = saiProbeBtn;
function saiProbeSync() { $$(".sai-bt").forEach((b) => { const sv = saiSaved(); b.classList.toggle("paired", !!(sv && saiBt())); const s = $("span", b); if (s) s.textContent = sv && saiBt() ? relShort(sv.name, 16) : "Sonde"; }); }

/* Réception: add the probe button under the core temperature (the screen is not ours, so we watch for it) */
function saiRecHook() {
  if (S.route !== "reception" || !saiProbeShow()) return;
  const st = $("#viewport .view:not(.leave) #recTst"); if (!st || (st.nextElementSibling && st.nextElementSibling.classList.contains("sai-probe"))) return;
  st.insertAdjacentHTML("afterend", `<button class="sai-probe sai-rec" data-act="saiProbe" data-id="__rec">${ico("probe")}<span>Prendre avec la sonde</span></button>`);
}
(function saiObs() {
  const go = () => { const vp = document.getElementById("viewport"); if (!vp) return setTimeout(go, 300); let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; saiRecHook(); }); }).observe(vp, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();

function saiIosCard() {
  return `<div class="sai-ios"><span class="ic sai-bigic">${ico("bt")}</span><div class="h2">Sonde Bluetooth sur iPhone</div>
    <p class="sub">Safari ne sait pas parler aux sondes Bluetooth. Sur iPhone, la sonde Bluetooth marche avec l'app <b>Bluefy</b>.</p>
    <ol class="sai-steps"><li><span class="mono">1</span>Installez Bluefy (gratuit)</li><li><span class="mono">2</span>Ouvrez Growth Gusto dans Bluefy</li><li><span class="mono">3</span>Associez votre sonde ici</li></ol>
    <a class="btn acc block" href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener">${ico("download")}Installer Bluefy</a>
    <button class="btn soft block" data-act="saiCopy">${ico("share")}Copier le lien de l'app</button>
    <p class="note">Ou utilisez la sonde depuis un téléphone Android ou un ordinateur.</p>
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`;
}
function saiBtSheetHtml(msg) {
  if (!saiBt()) return saiIosCard();
  const sv = saiSaved();
  if (sv) {
    const on = !!(BT.dev && BT.dev.gatt && BT.dev.gatt.connected);
    return `<div class="sai-bts"><div class="sai-dev"><span class="ic">${ico("probe")}</span><div class="tx"><b class="rel-ell">${esc(sv.name)}</b><em>${sv.kind === "eti" ? "Thermapen / ThermaQ Blue" : "Sonde Bluetooth"} · ${on ? "connectée" : "se connecte à la mesure"}</em></div></div>
      <div class="sai-test" id="saiTest"><span class="rel-lcd ${BT.last != null ? "ok" : "off"}">${BT.last != null ? fmt(BT.last) + "°" : "– –"}</span><em id="saiTestTx">${msg ? esc(msg) : BT.last != null ? `Dernière mesure · ${hm(BT.lastAt)}` : "Plantez la sonde, puis testez"}</em></div>
      <button class="btn acc block" data-act="saiTest">${ico("therm")}Tester la sonde</button>
      <button class="btn ghost block" style="color:var(--bad)" data-act="saiForget">${ico("trash")}Oublier cette sonde</button></div>`;
  }
  return `<div class="sai-bts"><div style="text-align:center"><span class="ic sai-bigic">${ico("bt")}</span><div class="h2">Associer une sonde</div><p class="sub">Allumez la sonde, puis choisissez son modèle.</p></div>
    <div class="sai-kinds"><button class="sai-kind" data-act="saiPair" data-v="eti"><span class="ic">${ico("probe")}</span><span class="tx"><b>Thermapen Blue / ThermaQ Blue</b><em>ETI · BlueTherm</em></span>${ico("chev")}</button>
    <button class="sai-kind" data-act="saiPair" data-v="std"><span class="ic">${ico("bt")}</span><span class="tx"><b>Autre sonde Bluetooth</b><em>Service standard</em></span>${ico("chev")}</button></div>
    ${msg ? `<p class="sai-err">${esc(msg)}</p>` : ""}<p class="note">La sonde est retenue sur cet appareil.</p></div>`;
}

Object.assign(ACT, {
  saiDict: () => {
    if (!saiRec()) return; SFX.init();
    saiLive = { items: [], text: "", prefix: "", on: false, err: "", removed: new Set(), stop: null };
    openSheet(saiSheetHtml()); saiStart();
  },
  saiMic: () => { const L = saiLive; if (!L) return; if (L.on) { saiStopVoice(); SFX.tick(); saiPaint(); } else saiStart(); },
  saiRm: (a, fid) => { const L = saiLive; if (!L) return; L.removed.add(fid); L.items = L.items.filter((x) => x.fid !== fid); SFX.tick(); buzz(4); saiPaint(); },
  saiCancel: () => { saiStopVoice(); saiLive = null; closeSheet(); },
  saiOk: async (a) => {
    const L = saiLive; if (!L || !L.items.length || !relOnce(a, 1500)) return;
    saiStopVoice(); const items = L.items.slice(); saiLive = null; closeSheet(true);
    await saiPause(260); await saiCommit(items);
  },
  saiBtSheet: () => { SFX.tap(); openSheet(saiBtSheetHtml()); },
  saiCopy: async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname); SFX.ok(); toast("Lien copié : collez-le dans Bluefy"); } catch (e) { toast(location.origin + location.pathname, "info"); } },
  saiPair: async (a, id, v) => {
    if (!saiBt() || !relOnce(a, 1500)) return;
    try { await saiPair(v === "eti" ? "eti" : "std"); SFX.ok(); buzz(12); toast("Sonde associée"); openSheet(saiBtSheetHtml()); saiProbeSync(); if (S.route === "releve") rerender(); }
    catch (e) { console.warn(e); const m = saiBtErr(e); if (m) { SFX.err(); openSheet(saiBtSheetHtml(m)); } }
  },
  saiTest: async (a) => {
    if (!relOnce(a, 1500)) return; const tx = $("#saiTestTx"); if (tx) tx.textContent = "Mesure…"; a.classList.add("busy");
    try { const v = await saiProbeRead(); SFX.scan(); buzz(8); openSheet(saiBtSheetHtml(`Mesure reçue · ${hm(Date.now())}`)); return v; }
    catch (e) { const m = saiBtErr(e); SFX.err(); openSheet(saiBtSheetHtml(m || "Mesure annulée")); }
  },
  saiForget: () => { try { if (BT.dev && BT.dev.gatt.connected) BT.dev.gatt.disconnect(); if (BT.dev && BT.dev.forget) BT.dev.forget().catch(() => {}); } catch (e) {} BT.dev = null; BT.ch = null; BT.last = null; saiSave(null); SFX.close(); toast("Sonde oubliée"); openSheet(saiBtSheetHtml()); saiProbeSync(); if (S.route === "releve") rerender(); },
  saiProbe: async (a, key) => {
    if (!a || a.classList.contains("busy")) return; SFX.tap();
    const sp = $("span", a); const was = sp ? sp.textContent : ""; a.classList.add("busy"); if (sp) sp.textContent = "Mesure…";
    try {
      const v = await saiProbeRead();
      if (key === "__rec") { if (typeof recSetTemp === "function") recSetTemp(v); }
      else if (typeof setTemp === "function") setTemp(key, v);
      SFX.scan(); buzz(8);
    } catch (e) { const m = saiBtErr(e); if (m) { SFX.err(); toast(m, "err"); } }
    finally { a.classList.remove("busy"); if (sp) sp.textContent = was; }
  },
});

window.SAISIE = {
  voiceSupported: () => !!saiRec(),
  btSupported: saiBt,
  isIOS: saiIOS,
  /* cb({ text, final, items }) on every result, cb({ end }) / cb({ error }); returns stop() */
  listen: (cb) => saiListen((ev) => { if (ev.text) ev.items = saiParse(ev.text, S.fridges, { open: S.open, done: saiDoneNow }); cb && cb(ev); }),
  probeRead: saiProbeRead,
  parse: (text, fridges) => saiParse(text, fridges || S.fridges),
  paired: saiSaved,
};
