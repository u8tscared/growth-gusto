/* Growth Gusto — area: compte (onboarding, équipe, « Qui êtes-vous ? », réglages, menu Plus) */

/* ───────────── local profiles: helpers + persistence ───────────── */
const CC = { last: Date.now(), locked: false, who: { mode: "sheet", pick: null, code: "", err: false }, form: null, bootLocked: false };
const ccLS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
};
/* legacy PIN hash (FNV-1a, field pinH): still accepted, upgraded to salted SHA-256 (pinSalt + pinSha) on the next good code */
const ccHash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
const ccHasPin = (m) => !!(m && (m.pinSha || m.pinH));
/* SHA-256 (FIPS 180-4), checked against the standard "abc" vector and crypto.subtle in tools/cc-v3.js */
function ccSha256js(str) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a)); const K = []; let H = [];
  for (let p = 2, n = 0; n < 64; p++) { let pr = true; for (let i = 2; i * i <= p; i++) if (p % i === 0) { pr = false; break; } if (pr) { if (n < 8) H[n] = (Math.pow(p, 1 / 2) * 2 ** 32) | 0; K[n++] = (Math.pow(p, 1 / 3) * 2 ** 32) | 0; } }
  const b = [...new TextEncoder().encode(str)]; const l = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0); b.push(0, 0, 0, 0, (l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255);
  for (let j = 0; j < b.length; j += 64) {
    const w = []; for (let i = 0; i < 16; i++) w[i] = (b[j + 4 * i] << 24) | (b[j + 4 * i + 1] << 16) | (b[j + 4 * i + 2] << 8) | b[j + 4 * i + 3];
    let [A, B, C, D, E, F, G, X] = H;
    for (let i = 0; i < 64; i++) {
      if (i >= 16) { const a = w[i - 15], c = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(c, 17) ^ rr(c, 19) ^ (c >>> 10))) | 0; }
      const t1 = (X + (rr(E, 6) ^ rr(E, 11) ^ rr(E, 25)) + ((E & F) ^ (~E & G)) + K[i] + w[i]) | 0, t2 = ((rr(A, 2) ^ rr(A, 13) ^ rr(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
      X = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
    }
    H = [A, B, C, D, E, F, G, X].map((x, i) => (x + H[i]) | 0);
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
/* synchronous on purpose: other areas (pointeuse) call ccPinOk() inline, and a Promise would read as "true" */
function ccSha(s) { return ccSha256js(s); }
function ccSalt() { const a = new Uint8Array(12); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0; } return [...a].map((x) => x.toString(16).padStart(2, "0")).join(""); }
/* the fields to write for a new code: only a salted hash is stored, never the code */
/* pinH keeps a non-empty marker so older readers that test `m.pinH` still see that the profile has a code */
function ccPinPatch(id, code) { const pinSalt = ccSalt(); return { pinSalt, pinSha: ccSha(`${pinSalt}:${id}:${code}`), pinH: "sha256" }; }
/* ccPinOk(member, "1234") → boolean (sync). Accepts the legacy FNV pinH and upgrades it. */
function ccPinOk(m, code) {
  code = String(code ?? "");
  if (!m || !/^\d{4}$/.test(code)) return false;
  if (m.pinSha) return m.pinSha === ccSha(`${m.pinSalt || ""}:${m.id}:${code}`);
  if (m.pinH && m.pinH === ccHash(m.id + ":" + code)) { if (ccLocalMode()) DB.update("members", m.id, ccPinPatch(m.id, code)).catch(() => {}); return true; }
  return false;
}
/* for other areas (pointeuse…): ccVerifyPin(memberId, "1234") → boolean */
function ccVerifyPin(id, code) { return ccPinOk(ccMember(id), String(code || "")); }
const ccWeakPin = (c) => /^(\d)\1{3}$/.test(c) || ["1234", "4321", "0123", "9876"].includes(c);
const ccMembers = () => [...S.members].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
const ccMember = (id) => S.members.find((m) => m.id === id);
const ccColor = (m) => (m && m.color) || colorFor(m ? m.id : "x");
const ccAva = (m, size = 56) => m && m.photo ? `<span class="cc-ava img" style="--s:${size}px;--c:${esc(ccColor(m))}"><img src="${esc(m.photo)}" alt=""></span>` : `<span class="cc-ava" style="--s:${size}px;--c:${esc(ccColor(m))}">${esc(initials(m?.name || "") || "?")}</span>`;
const ccLocalMode = () => DB.mode === "local";
/* accounts (js/auth.js): the restaurant's owner can neither be demoted nor removed; a member with an e-mail is an account, the others are kitchen profiles */
const ccCloud = () => !!DB.uid;
const ccIsOwner = (id) => ccCloud() && !!S.resto && S.resto.owner === id;
const ccIsAccount = (m) => !!(m && (m.email || (ccCloud() && m.id === DB.uid)));
/* minutes away (app hidden or untouched) before the code is asked again; 0 = only when the app opens. Default 30. */
const ccAutoLock = () => { const r = ccLS.raw("gg-autolock"); return r == null ? 30 : +r || 0; };
const ccHaptics = () => ccLS.raw("gg-haptics") !== "off";
const ccGerants = () => S.members.filter((m) => m.role === "gerant");
const ccAgo = (ts) => { if (!ts) return "jamais"; const m = Math.round((Date.now() - ts) / 60000); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; return when(ts); };

/* rapid double taps: one run at a time per action */
const ccBusy = new Set();
async function ccOnce(k, fn, hold = 0) { if (ccBusy.has(k)) return; ccBusy.add(k); try { return await fn(); } finally { hold ? setTimeout(() => ccBusy.delete(k), hold) : ccBusy.delete(k); } }
/* every profile has a code: the lock applies as soon as the restaurant has someone. Tests can opt out with
   localStorage gg-nolock=1 (only honoured under automation), or call ccUnlockTest() / ACT.ccUnlockTest(). */
const ccNoLock = () => { try { return !!navigator.webdriver && localStorage.getItem("gg-nolock") === "1"; } catch (e) { return false; } };
const ccNeedsLock = () => ccLocalMode() && !!S.resto && !ccNoLock();

/* ───────────── roles: who sees what ───────────── */
/* gérant sees everything; chef and équipe don't see money (finances, salaires, tableau de bord).
   Other areas call it guarded: typeof canSee === "function" ? canSee("finance") : true */
const CC_GERANT_ONLY = new Set(["dashboard", "finance", "finances", "staff", "salaires", "salaries", "marges", "expenses", "couts"]);
/* with js/perms.js: each person's own access (perms on the member doc; legacy members keep the rule above) */
function canSee(area) { if (typeof PERMS !== "undefined") return PERMS.routeAllowed(area); return myRole() === "gerant" || !CC_GERANT_ONLY.has(String(area || "")); }
/* router guard: a forbidden route never opens (side nav, tabs, deep links, other areas' go()) */
const ccGo0 = go;
go = function (route) {
  if (S.resto && !canSee(route)) { SFX.err(); buzz([20, 40, 20]); if (VIEWS.noaccess) return ccGo0.call(this, "noaccess", { route }, arguments[2] || {}); toast("Réservé au gérant", "err"); if (S.route && canSee(S.route)) return; return ccGo0.call(this, "home", {}, { replace: true }); }
  return ccGo0.apply(this, arguments);
};

function ccSaveWho() {
  if (!S.rid || !ccLocalMode()) return;
  const w = ccLS.get("gg-who", {}); w[S.rid] = { id: S.me.id, name: S.me.name || "", color: S.me.color || "" }; ccLS.set("gg-who", w);
}
/* restore the last person on this device before the first render */
(function ccRestoreWho() { const w = ccLS.get("gg-who", {})[S.rid]; if (w && w.id) S.me = { id: w.id, name: w.name || (w.id === "local" ? S.me.name : ""), color: w.color || undefined }; })();

/* haptics on/off: buzz() goes through navigator.vibrate */
const ccVib0 = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
function ccApplyHaptics() { if (!ccVib0) return; try { Object.defineProperty(navigator, "vibrate", { configurable: true, writable: true, value: ccHaptics() ? ccVib0 : () => false }); } catch (e) {} }
ccApplyHaptics();

/* members feed: colors, names of removed people, current user */
function ccOnMembers(rows) {
  if (!ccLocalMode()) return;
  const ghosts = ccLS.get("gg-ghosts", {})[S.rid] || {};
  Object.entries(ghosts).forEach(([id, g]) => { if (!rows.find((m) => m.id === id)) S.profiles[id] = { name: g.name, color: g.color }; });
  rows.forEach((m) => { S.profiles[m.id] = { ...(S.profiles[m.id] || {}), name: m.name || (m.id === S.me.id ? S.me.name : "") || S.profiles[m.id]?.name || "", color: m.color || colorFor(m.id), ...(m.photo ? { avatarUrl: m.photo } : {}) }; });
  if (!rows.length) { if (CC.locked) ccUnlock(); return; }
  const me = rows.find((m) => m.id === S.me.id);
  if (me) { S.me.name = me.name || S.me.name; S.me.color = me.color; S.isOwner = (me.role || "equipe") === "gerant"; ccSaveWho(); }
  else { const pick = rows.find((m) => m.id === "local") || rows.find((m) => m.role === "gerant") || rows[0]; ccBecome(pick, true); }
  if (CC.locked) { const w = CC.who; if (w.pick && !ccMember(w.pick)) w.pick = null; if (!w.pick && rows.length === 1) ccPickStart(rows[0].id); if (!w.code) ccWhoPaint(); }
}
const ccAttach0 = attachResto;
attachResto = function () { ccAttach0(); if (ccLocalMode() && S.rid && !(DB.listeners[DB.path("members")] || []).includes(ccOnMembers)) DB.watch("members", {}, ccOnMembers); };

/* core's sidebar footer reads « Réglages » with a sliders icon, but in local mode a tap opens « Qui êtes-vous ? » (capture
   listener below): relabel it after each chrome render so label, icon and action match. */
const ccChrome0 = renderChrome;
renderChrome = function () {
  ccChrome0.apply(this, arguments);
  const me = document.querySelector("#side .me"); if (!me || !ccLocalMode() || !S.resto) return;
  me.title = "Changer d'utilisateur"; me.setAttribute("aria-label", `${S.me.name || "Vous"} · changer d'utilisateur`);
  const ic = me.lastElementChild; if (ic && ic.classList.contains("ico")) ic.outerHTML = ico("swap");
  const em = me.querySelector("em"); if (em && !em.querySelector(".cc-swtx")) em.insertAdjacentHTML("beforeend", `<span class="cc-swtx"> · Changer</span>`);
};
/* hide what the role can't see from the side nav (and a group title left empty) */
const ccChrome1 = renderChrome;
renderChrome = function () {
  ccChrome1.apply(this, arguments);
  const side = document.getElementById("side"); if (!side) return;
  $$(".navs .nav[data-go]", side).forEach((b) => { b.hidden = !canSee(b.dataset.go); });
  /* « Équipe & salaires »: the gérant lands on the employee files (rh.js « staff ») when they exist; others see « Équipe » */
  const eq = $('.navs .nav[data-go="equipe"]', side);
  if (eq) { const nt = $(".nt", eq); if (VIEWS.staff && canSee("staff")) { eq.dataset.go = "staff"; eq.classList.toggle("on", S.route === "staff"); } else if (nt && !canSee("salaires")) nt.textContent = "Équipe"; }
  $$(".navs .sep", side).forEach((sep) => { let n = sep.nextElementSibling, any = false; while (n && !n.classList.contains("sep")) { if (!n.hidden) any = true; n = n.nextElementSibling; } sep.hidden = !any; });
};
function ccBecome(m, silent) {
  if (!m) return;
  S.me = { id: m.id, name: m.name || "", color: m.color || undefined };
  S.profiles[m.id] = { ...(S.profiles[m.id] || {}), name: m.name || "", color: ccColor(m) };
  if (ccLocalMode()) S.isOwner = (m.role || "equipe") === "gerant";
  if (m.id === "local" && m.name) { try { localStorage.setItem("gg-name", m.name); } catch (e) {} }
  ccSaveWho(); CC.last = Date.now();
  if (!silent) { renderChrome(); if (S.route && !canSee(S.route)) { S.history = []; go("home", {}, { replace: true }); } else rerender(); }
}

/* ───────────── avatar → « Qui êtes-vous ? » ───────────── */
document.addEventListener("click", (e) => {
  if (!ccLocalMode() || !S.resto) return;
  const t = e.target.closest("[data-me], #side .me");
  const hb = !t && e.target.closest('[data-go="reglages"]');
  if (t || (hb && hb.querySelector(".ava"))) { e.stopPropagation(); e.preventDefault(); SFX.init(); SFX.tap(); ACT.whoami(); }
}, true);
["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, () => { CC.last = Date.now(); }, { passive: true, capture: true }));
document.addEventListener("keydown", (e) => {
  const w = CC.who; const open = CC.locked || ($("#sheet").classList.contains("open") && $("#sheetBody .cc-pin"));
  if (open && w.pick && /^[0-9]$/.test(e.key)) { e.preventDefault(); ACT.ccKey(null, null, e.key); return; }
  if (open && w.pick && e.key === "Backspace") { e.preventDefault(); ACT.ccKey(null, null, "del"); return; }
  if (e.key === "Enter" && e.target.id) {
    const id = e.target.id;
    if (id === "obMe" || id === "obName") { e.preventDefault(); ACT.obNext(); }
    else if (id === "obTeamIn") { e.preventDefault(); ACT.obTeamAdd(); }
    else if (id === "ccfName" || id === "ccfPin") { e.preventDefault(); ACT.ccMemberSave(); }
    else if (id === "newResto") { e.preventDefault(); ACT.restoAdd(); }
    else if (id === "ccResetIn" && !$("#ccResetGo")?.disabled) { e.preventDefault(); ACT.ccResetOk(); }
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "obName") { const p = $("#obPrev"); if (p) { const n = el.value.trim(); $("b", p).textContent = n || "Votre restaurant"; $(".cc-mono", p).textContent = initials(n || "R"); p.classList.toggle("on", !!n); } ccObFit(); }
  if (el.id === "ccfPin") el.value = el.value.replace(/\D/g, "").slice(0, 4);
  if (el.id === "ccfName" && CC.form) { CC.form.name = el.value; const pv = $("#ccfPrev"); if (pv) pv.innerHTML = ccAva({ id: CC.form.id || "new", name: el.value || "?", color: CC.form.color }, 72); }
  if (el.id === "ccResetIn") { const b = $("#ccResetGo"); if (b) b.toggleAttribute("disabled", el.value.trim().toUpperCase() !== "EFFACER"); }
});

/* lock: at app open (cold start), and after N minutes hidden or untouched (Réglages → Code à l'ouverture) */
function ccIdleCheck() { const n = ccAutoLock(); if (n && !CC.locked && S.route !== "onboarding" && ccNeedsLock() && S.members.length && Date.now() - CC.last > n * 60000) ccLock(); }
setInterval(ccIdleCheck, 5000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ccIdleCheck(); });
const ccFinish0 = finishBoot;
finishBoot = function () {
  /* an existing restaurant opens behind the lock (members arrive a moment later and fill the faces) */
  if (ccNeedsLock()) ccLock(true);
  return ccFinish0.apply(this, arguments);
};

/* wrong codes: 5 in a row → 30 s wait, kept per profile on this device (a reload doesn't skip it) */
const CC_MAXTRY = 5, CC_WAIT = 30000;
function ccFails() { return ccLS.get("gg-pinfail", {}); }
function ccFailOf(id) { return ccFails()[(S.rid || "") + ":" + id] || { n: 0, until: 0 }; }
function ccFailSet(id, f) { const all = ccFails(); const k = (S.rid || "") + ":" + id; if (f) all[k] = f; else delete all[k]; ccLS.set("gg-pinfail", all); }
const ccWaitLeft = (id) => Math.max(0, Math.ceil((ccFailOf(id).until - Date.now()) / 1000));
let ccWaitTimer = 0;
function ccWaitTick() { clearInterval(ccWaitTimer); ccWaitTimer = setInterval(() => { const w = CC.who; if (!w.pick || !ccWaitLeft(w.pick)) { clearInterval(ccWaitTimer); ccWhoPaint(); return; } const el = $(".cc-wait b"); if (el) el.textContent = ccWaitLeft(w.pick) + " s"; }, 1000); }

/* step: "enter" (type your code), "new" + "confirm" (first time, or after a reset), "change" (old code first, then new) */
function ccPickStart(id, step) { const m = ccMember(id); CC.who.pick = id; CC.who.code = ""; CC.who.err = false; CC.who.first = ""; CC.who.step = step || (ccHasPin(m) ? "enter" : "new"); if (ccWaitLeft(id)) ccWaitTick(); }
function ccWhoHTML() {
  const w = CC.who, lock = w.mode === "lock", ms = ccMembers();
  if (lock && !ms.length) return `<div class="cc-who"><div class="cc-who-head"><span class="cc-lockic">${ico("lock")}</span><span class="lbl">${esc(S.resto?.name || "")}</span><div class="title">Un instant…</div></div></div>`;
  if (w.pick) {
    const m = ccMember(w.pick); if (!m) { w.pick = null; return ccWhoHTML(); }
    const wait = ccWaitLeft(m.id); const st = w.step || "enter";
    const dots = [0, 1, 2, 3].map((i) => `<i class="${i < w.code.length ? "on" : ""}"></i>`).join("");
    const title = st === "new" ? (w.change ? "Nouveau code" : "Créez votre code") : st === "confirm" ? "Confirmez le code" : firstName(m.name) || "Sans nom";
    const sub = wait ? "" : w.err ? `<span class="cc-errtx">${esc(w.err === true ? "Code incorrect, réessayez" : w.err)}</span>`
      : st === "new" ? (w.change ? "4 chiffres, rien que pour vous" : `Première fois, ${esc(firstName(m.name))} ? Choisissez 4 chiffres`) : st === "confirm" ? "Tapez-le une seconde fois" : w.change ? "Tapez d'abord votre code actuel" : "Tapez votre code à 4 chiffres";
    const fl = ccFailOf(m.id).n; const back = !(lock && ms.length === 1);
    return `<div class="cc-pin" data-step="${st}">
      <div class="cc-pin-top">${back ? `<button class="iconbtn" data-act="ccWhoBack" aria-label="Retour">${ico("back")}</button>` : `<span style="width:42px"></span>`}<span class="lbl">${st === "enter" && !w.change ? (lock ? esc(S.resto?.name || "Code personnel") : "Code personnel") : "Code personnel"}</span><span style="width:42px"></span></div>
      <div class="cc-pin-who">${ccAva(m, 76)}<div class="h2">${esc(title)}</div><div class="sub">${sub}</div></div>
      ${wait ? `<div class="cc-wait" role="status">${ico("clock")}<span>Trop d'essais. Réessayez dans <b class="mono">${wait} s</b></span></div>` : `<div class="cc-dots ${w.err ? "err shake" : ""}">${dots}</div>`}
      <div class="keypad cc-keys ${wait ? "off" : ""}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="ccKey" data-v="${d}" ${wait ? "disabled" : ""}>${d}</button>`).join("")}<span></span><button data-act="ccKey" data-v="0" ${wait ? "disabled" : ""}>0</button><button data-act="ccKey" data-v="del" aria-label="Effacer" ${wait ? "disabled" : ""}>${ico("back")}</button></div>
      ${st === "enter" && fl >= 2 && !wait ? `<p class="note cc-pin-help">Code oublié ? Un gérant peut le réinitialiser dans Équipe. ${CC_MAXTRY - fl} essai${CC_MAXTRY - fl > 1 ? "s" : ""} avant une pause de 30 s.</p>` : st === "new" && !w.change ? `<p class="note cc-pin-help">Il protège votre profil : personne ne signe à votre place.</p>` : ""}
    </div>`;
  }
  const h = new Date().getHours(); const hi = h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const lastId = (ccLS.get("gg-who", {})[S.rid] || {}).id;
  return `<div class="cc-who">
    <div class="cc-who-head">${lock ? `<span class="cc-lockic">${ico("lock")}</span>` : ""}<span class="lbl">${hi} · ${esc(S.resto?.name || "")}</span><div class="title">Qui êtes-vous ?</div><div class="sub">${lock ? "Touchez votre visage, puis tapez votre code." : "Chaque relevé et chaque action seront signés à votre nom."}</div></div>
    <div class="cc-who-grid">${ms.map((m, i) => { const cur = !lock && m.id === S.me.id; const last = lock && m.id === lastId && ms.length > 1; return `<button class="cc-tile ${cur ? "cur" : ""} ${last ? "last" : ""}" style="--i:${i}" data-act="ccPick" data-id="${m.id}" aria-label="${esc(m.name || "Sans nom")}">
      <span class="cc-tava">${ccAva(m, 64)}${cur ? `<span class="cc-badge">${ico("check")}</span>` : !ccHasPin(m) ? `<span class="cc-badge nw" title="Code à créer">${ico("plus")}</span>` : ""}</span>
      <b>${esc(firstName(m.name) || "Sans nom")}</b><em>${last ? "Dernier connecté" : ROLES[m.role] || "Équipe"}</em></button>`; }).join("")}
      ${myRole() === "gerant" && !lock ? `<button class="cc-tile add" style="--i:${ms.length}" data-act="ccMemberNew"><span class="cc-tava"><span class="cc-ava plus" style="--s:64px">${ico("plus")}</span></span><b>Ajouter</b><em>un équipier</em></button>` : ""}
    </div>
    ${lock ? "" : `<div class="cc-who-foot"><button class="btn soft sm" data-go="equipe">${ico("users")}Gérer l'équipe</button><button class="btn soft sm" data-go="reglages">${ico("sliders")}Réglages</button></div>`}
  </div>`;
}
function ccWhoPaint() { const box = CC.who.mode === "lock" ? $("#ccLockBody") : $("#sheetBody"); if (box && (CC.who.mode === "lock" || $("#sheetBody .cc-who, #sheetBody .cc-pin"))) box.innerHTML = ccWhoHTML(); }
function ccLock(boot) {
  if (!ccLocalMode() || !S.resto || (!boot && !S.members.length)) return;
  if (!boot) closeSheet(true);
  CC.locked = true; CC.who = { mode: "lock", pick: null, code: "", err: false };
  const ms = ccMembers(); if (ms.length === 1) ccPickStart(ms[0].id);
  const L = $("#ccLock"); ccWhoPaint(); L.hidden = false; void L.offsetWidth; L.classList.add("on"); if (!boot) SFX.sheet();
  try { document.getElementById("app").setAttribute("inert", ""); $("#tabbar").setAttribute("inert", ""); } catch (e) {}
}
function ccUnlock() {
  CC.locked = false; CC.last = Date.now(); const L = $("#ccLock"); L.classList.remove("on"); setTimeout(() => { if (!CC.locked) L.hidden = true; }, 420);
  try { document.getElementById("app").removeAttribute("inert"); $("#tabbar").removeAttribute("inert"); } catch (e) {}
}
/* tests: unlock as the current (or given) profile without a code */
function ccUnlockTest(id) { const m = (id && ccMember(id)) || ccMember(S.me.id) || ccMembers()[0]; if (m) ccBecome(m); CC.who = { mode: "sheet", pick: null, code: "", err: false }; ccUnlock(); return !!m; }
function ccSwitchTo(m) {
  const same = m.id === S.me.id; const wasLock = CC.who.mode === "lock"; ccBecome(m);
  if (wasLock) ccUnlock(); else closeSheet(true);
  SFX.ok(); buzz([8, 30, 8]); CC.who = { mode: "sheet", pick: null, code: "", err: false };
  toast(same ? `Bon retour, ${firstName(m.name)}` : `${firstName(m.name)} signe maintenant`);
}
async function ccCodeDone() {
  const w = CC.who; const m = ccMember(w.pick); if (!m) return; const code = w.code; const st = w.step || "enter";
  const bad = (msg) => { setTimeout(() => { if (CC.who !== w) return; w.code = ""; w.err = msg || true; SFX.err(); buzz([30, 50, 30]); ccWhoPaint(); }, 140); };
  const okDots = () => $$(".cc-dots").forEach((d) => d.classList.add("ok"));
  if (st === "new") {
    if (ccWeakPin(code)) return bad("Trop facile à deviner : choisissez-en un autre");
    w.first = code; w.code = ""; w.step = "confirm"; setTimeout(() => { if (CC.who === w) ccWhoPaint(); }, 150); return;
  }
  if (st === "confirm") {
    if (code !== w.first) { w.step = "new"; w.first = ""; return bad("Les deux codes sont différents, recommencez"); }
    w.busy = true; try { await safe(DB.update("members", m.id, await ccPinPatch(m.id, code))); } catch (e) { w.busy = false; return bad("Enregistrement impossible, réessayez"); }
    w.busy = false; ccFailSet(m.id, null); okDots(); SFX.done(); buzz([10, 30, 10]);
    if (w.change) { setTimeout(() => { closeSheet(true); CC.who = { mode: "sheet", pick: null, code: "", err: false }; toast("Nouveau code enregistré"); if (S.route === "reglages" || S.route === "home") rerender(); }, 300); return; }
    setTimeout(() => { ccSwitchTo(ccMember(m.id) || m); toast(`Code créé · bienvenue ${firstName(m.name)}`); }, 300); return;
  }
  w.busy = true; const ok = await ccPinOk(m, code); w.busy = false;
  if (ok) {
    ccFailSet(m.id, null); okDots();
    if (w.change) { w.step = "new"; w.code = ""; SFX.ok(); setTimeout(() => { if (CC.who === w) ccWhoPaint(); }, 220); return; }
    setTimeout(() => ccSwitchTo(m), 240); return;
  }
  const f = ccFailOf(m.id); f.n = (f.n || 0) + 1; if (f.n >= CC_MAXTRY) { f.n = 0; f.until = Date.now() + CC_WAIT; } ccFailSet(m.id, f);
  if (f.until > Date.now()) ccWaitTick();
  bad();
}
(function ccMount() {
  const d = document.createElement("div"); d.id = "ccLock"; d.className = "cc-lock"; d.hidden = true; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.innerHTML = `<div class="cc-lock-card" id="ccLockBody"></div>`; document.body.appendChild(d);
  const f = document.createElement("input"); f.type = "file"; f.id = "ccImportPick"; f.accept = "application/json,.json"; f.hidden = true; document.body.appendChild(f);
  f.addEventListener("change", () => { const file = f.files && f.files[0]; f.value = ""; if (file) ccImportFile(file); });
  const c = document.createElement("div"); c.id = "ccCele"; c.className = "cc-cele"; c.hidden = true; document.body.appendChild(c);
})();
Object.assign(IC, {
  lock: ["r:4,11,16,10,2.5", "M8 11V7a4 4 0 0 1 8 0v4", "M12 15.5v2"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"],
  swap: ["m16 3 4 4-4 4", "M20 7H4", "m8 21-4-4 4-4", "M4 17h16"],
  vibe: ["r:7,3,10,18,2.5", "M2 9v6", "M22 9v6", "M11 18h2"],
  db: ["M3 5c0-1.7 4-3 9-3s9 1.3 9 3-4 3-9 3-9-1.3-9-3z", "M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5", "M3 12c0 1.7 4 3 9 3s9-1.3 9-3"],
  tag: ["M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z", "c:7.5,7.5,1.2"],
});

/* ───────────── onboarding: 3 short steps ───────────── */
/* onboarding presets: [name, type id from REL_TYPES (js/releve.js)] */
const OB_FRIDGES = [["Chambre froide 1", "cfp"], ["Chambre froide 2", "cfp"], ["Frigo de service 1", "service"], ["Frigo de service 2", "service"], ["Frigo du bar", "frigo"], ["Frigo pâtisserie", "frigo"], ["Saladette", "saladette"], ["Congélateur", "congel"], ["Cave à boissons", "cave"], ["Vitrine", "vitrine"]];
const OB_TYPE_FALLBACK = { frigo: [0, 4, "therm"], cfp: [0, 4, "therm"], congel: [-40, -15, "snow"], saladette: [0, 4, "therm"], cave: [2, 8, "therm"], vitrine: [0, 4, "therm"] };
function ccObType(k) {
  const t = typeof REL_TYPES !== "undefined" ? REL_TYPES.find((x) => x.k === k) : null; const f = OB_TYPE_FALLBACK[k] || OB_TYPE_FALLBACK.frigo;
  return { k, min: t ? t.min : f[0], max: t ? t.max : f[1], ic: t && IC[t.ic] ? t.ic : f[2] };
}
const ccDeg = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
VIEWS.onboarding = {
  live: false,
  render() {
    const sug = S.ui.obFr || ["Chambre froide 1", "Chambre froide 2", "Frigo du bar", "Congélateur"]; S.ui.obFr = sug;
    S.ui.obTeam = S.ui.obTeam || []; S.ui.obStep = 0;
    const steps = [
      ["users", "Bonjour ! Quel est votre prénom ?", "Il signe chaque relevé et chaque action au registre."],
      ["store", "Comment s'appelle votre restaurant ?", "Vous pourrez ajouter d'autres établissements plus tard."],
      ["snow", "Quels frigos relevez-vous ?", "Touchez pour choisir. Les seuils sont réglés pour vous."],
    ];
    const head = (i) => `<div class="cc-ob-ill">${ico(steps[i][0])}</div><div class="h2 cc-ob-q">${steps[i][1]}</div><p class="sub cc-ob-s">${steps[i][2]}</p>`;
    return `<div class="inner narrow cc-ob">
      <div class="cc-ob-top st" style="--i:0">${appIcon(40)}<div class="cc-ob-prog" id="obProg"><i class="on"></i><i></i><i></i></div><span class="lbl mono" id="obCount">1/3</span></div>
      <div class="cc-ob-track st" style="--i:1"><div class="cc-ob-rail" id="obRail">
        <section class="cc-ob-pane on" data-pane="0">${head(0)}
          <input class="input cc-big" id="obMe" placeholder="Votre prénom" autocomplete="given-name" maxlength="40" enterkeyhint="next" value="${esc(S.me.name || "")}">
          <div class="cc-ob-team"><div class="row"><span class="lbl">Vous êtes plusieurs ?</span><span class="pill neu">Facultatif</span></div>
            <div class="cc-ob-list" id="obTeamList">${ccObTeamHTML()}</div>
            <div class="hstack"><input class="input" id="obTeamIn" placeholder="Son prénom" autocomplete="off" maxlength="40" enterkeyhint="done" style="flex:1;min-width:0"><button class="btn soft sm" style="height:50px" data-act="obTeamAdd">${ico("plus")}Ajouter</button></div>
            <span class="note">Chacun touchera son avatar pour signer. Possible aussi plus tard, dans Équipe.</span></div>
        </section>
        <section class="cc-ob-pane" data-pane="1" inert>${head(1)}
          <input class="input cc-big" id="obName" placeholder="Ex. Chemin des Sarments" autocomplete="organization" maxlength="80" enterkeyhint="next">
          <div class="cc-ob-prev" id="obPrev"><span class="cc-mono">R</span><div><b>Votre restaurant</b><em>Registre HACCP · relevés · stock</em></div></div>
        </section>
        <section class="cc-ob-pane" data-pane="2" inert>${head(2)}
          <div class="cc-ob-frs">${OB_FRIDGES.map(([n, k]) => { const t = ccObType(k); const on = sug.includes(n); return `<button class="cc-fr ${on ? "on" : ""}" data-act="obToggle" data-n="${esc(n)}" aria-pressed="${on}"><span class="cc-fr-ic">${ico(t.ic)}</span><span class="cc-fr-tx"><b>${esc(n)}</b><em class="mono">${ccDeg(t.min)} à ${ccDeg(t.max)} °C</em></span><span class="cc-fr-ck">${ico("check")}</span></button>`; }).join("")}</div>
          <span class="note" id="obFrNote">${ccObFrNote(sug.length)}</span>
        </section>
      </div></div>
      <div class="cc-ob-cta st" style="--i:2"><button class="btn soft cc-ob-back" data-act="obPrev" aria-label="Retour" hidden>${ico("back")}</button><button class="btn acc block" data-act="obNext" id="obNextBtn">Continuer${ico("chev")}</button><button class="btn acc block" data-act="obCreate" id="obGo" hidden>${ico("sparkle")}Créer mon restaurant</button></div>
      ${DB.mode === "local" ? `<p class="note st cc-ob-foot" style="--i:3"><span>Vos données restent sur cet appareil.</span><button class="cc-link" data-act="ccImport">${ico("upload")}Restaurer une sauvegarde</button></p>` : ""}
    </div>`;
  },
  after(v) { ccObFit(v); setTimeout(() => { const i = $("#obMe", v); if (i && !i.value && window.matchMedia("(min-width:960px)").matches) i.focus({ preventScroll: true }); }, 450); },
};
function ccObFrNote(n) { return n ? `${n} équipement${n > 1 ? "s" : ""} · vous pourrez en ajouter et régler les seuils ensuite.` : "Rien de coché : vous ajouterez vos équipements plus tard."; }
/* the track takes the height of the visible step, so short steps don't leave a blank card */
function ccObFit(v) { v = v || $("#viewport .view:not(.leave)"); const tr = v && $(".cc-ob-track", v); if (!tr) return; const p = $(`.cc-ob-pane[data-pane="${S.ui.obStep || 0}"]`, tr); if (p) tr.style.height = p.offsetHeight + 28 + "px"; }
window.addEventListener("resize", debounce(() => { if (S.route === "onboarding") ccObFit(); }, 120));
function ccObTeamHTML() { return (S.ui.obTeam || []).map((t, i) => `<span class="cc-mate">${ccAva({ id: "t" + i, name: t.name, color: PALETTE[(i + 1) % PALETTE.length] }, 28)}${esc(t.name)}<button data-act="obTeamDel" data-v="${i}" aria-label="Retirer ${esc(t.name)}">${ico("x")}</button></span>`).join(""); }
function ccObGo(n) {
  const v = $("#viewport .view:not(.leave)"); if (!v || !$("#obRail", v)) return; S.ui.obStep = n;
  $("#obRail", v).style.transform = `translateX(calc(${-n} * (100% + 28px)))`;
  $$(".cc-ob-pane", v).forEach((p) => { const on = +p.dataset.pane === n; p.classList.toggle("on", on); p.toggleAttribute("inert", !on); });
  ccObFit(v);
  $$("#obProg i", v).forEach((d, i) => d.classList.toggle("on", i <= n));
  $("#obCount", v).textContent = `${n + 1}/3`;
  $(".cc-ob-back", v).hidden = n === 0; $("#obNextBtn", v).hidden = n === 2; $("#obGo", v).hidden = n !== 2;
  const f = n === 0 ? $("#obMe", v) : n === 1 ? $("#obName", v) : null;
  if (f) setTimeout(() => f.focus({ preventScroll: true }), 420);
}
function ccShake(el) { if (!el) return; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 420); SFX.err(); buzz([20, 40, 20]); }
function ccCelebrate(name, resto, nFr) {
  const c = $("#ccCele"); c.innerHTML = `<div class="cc-cele-in"><div class="cc-cele-ring">${appIcon(96)}</div><div class="title">C'est prêt${name ? ", " + esc(firstName(name)) : ""} !</div><div class="sub">${esc(resto)} · ${nFr} frigo${nFr > 1 ? "s" : ""} à relever</div></div>`;
  c.hidden = false; void c.offsetWidth; c.classList.add("on");
  setTimeout(() => burst(window.innerWidth / 2, window.innerHeight * 0.4), 160);
  setTimeout(() => c.classList.add("out"), 950); setTimeout(() => { c.hidden = true; c.classList.remove("on", "out"); }, 1350);
}

/* ───────────── équipe ───────────── */
VIEWS.equipe = {
  render() {
    const canManage = myRole() === "gerant"; const ms = ccMembers(); const local = ccLocalMode();
    const ev = S.events.slice(0, 8);
    const cloud = ccCloud();
    const mark = (x) => (cloud && ccIsAccount(x) ? (ccIsOwner(x.id) ? ` <span class="cc-lk" title="Propriétaire">${ico("shield")}</span>` : "") : ccHasPin(x) ? ` <span class="cc-lk" title="Protégé par un code">${ico("lock")}</span>` : "");
    const nopin = (x) => !(cloud && ccIsAccount(x)) && !ccHasPin(x) ? `<span class="cc-nopin">Code à créer</span>` : "";
    const sub = (x, mine, last) => (cloud && ccIsAccount(x) ? esc(x.email || "Compte") : cloud ? "Profil cuisine · sans compte" : "") + (mine.length ? `${cloud ? " · " : ""}${mine.length} action${mine.length > 1 ? "s" : ""} · ${ccAgo(last.at)}` : cloud ? "" : "Aucune action");
    const row = (x) => { const mine = S.events.filter((e) => e.uid === x.id); const last = mine[0]; return `<div class="li tap cc-mrow" data-act="ccMember" data-id="${x.id}">${ccAva(x, 44)}<div class="tx"><b><span class="cc-nm">${esc(x.name || nameOf(x.id))}</span>${x.id === S.me.id ? `<span class="cc-you">vous</span>` : ""}${mark(x)}</b><em>${nopin(x)}${sub(x, mine, last)}</em>${canManage && typeof PERMS !== "undefined" ? `<em class="cc-acc">${esc(PERMS.summary(x.id).short)}</em>` : ""}</div><span class="pill ${x.role === "gerant" ? "acc" : x.role === "chef" ? "warn" : "neu"}">${x.role !== "gerant" && x.poste && typeof PERMS !== "undefined" && PERMS.POSTES[x.poste] ? PERMS.POSTES[x.poste][0] : ROLES[x.role] || "Équipe"}</span>${ico("chev")}</div>`; };
    return `<div class="inner cc-wide">${topBar("Équipe", { right: canManage ? `<button class="btn acc sm" data-act="ccMemberNew">${ico("plus")}Ajouter</button>` : "" })}
      ${local ? `<div class="cc-hero st" style="--i:1"><span class="cc-hero-ic">${ico("users")}</span><div style="flex:1;min-width:0"><b>Qui signe ?</b><span>Chacun signe à son nom.</span></div><button class="btn sm cc-hero-btn" data-act="whoami">${ico("swap")}Changer</button></div>` : cloud && canManage ? `<div class="cc-hero st" style="--i:1"><span class="cc-hero-ic">${ico("auLink")}</span><div style="flex:1;min-width:0"><b>Invitez votre équipe</b><span>Vous choisissez ce que chacun voit</span></div><button class="btn sm cc-hero-btn" data-act="auInvite">${ico("plus")}Inviter</button></div><button class="btn ghost sm st cc-invl" style="--i:1" data-act="auInvList">Invitations en cours${ico("chev")}</button>` : ""}
      <div class="cc-cols"><div class="cc-col"><div class="glass pad st" style="--i:2"><div class="row" style="margin-bottom:2px"><span class="lbl">${ms.length} personne${ms.length > 1 ? "s" : ""}</span>${!canManage ? `<span class="note">Seul un gérant peut modifier l'équipe</span>` : ""}</div>
        ${ms.length ? ms.map(row).join("") : `<div class="empty">Personne pour l'instant.</div>`}
        ${canManage ? `<button class="li tap cc-addrow" data-act="ccMemberNew"><span class="cc-ava plus" style="--s:44px">${ico("plus")}</span><div class="tx"><b>Ajouter un équipier</b><em>Vous choisissez ce qu'il voit et doit faire</em></div></button>` : ""}</div>
      <p class="note st" style="--i:4">Touchez une personne pour régler ses accès et ce qui est obligatoire pour elle. ${cloud ? "Un profil cuisine sert à pointer et signer sans compte." : "Chacun entre avec son code à 4 chiffres."}</p></div>
      <div class="cc-col"><div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">Qui a fait quoi</span><button class="btn ghost sm" data-go="registre">Registre${ico("chev")}</button></div>
        ${ev.length ? ev.map((e) => `<div class="li cc-ev">${avatar(e.uid)}<div class="tx"><b style="white-space:normal">${esc(said(e.uid, e.text))}</b><em>${when(e.at)}</em></div></div>`).join("") : `<div class="empty" style="padding:16px 0 6px">Les actions de chacun apparaîtront ici.</div>`}</div></div></div></div>`;
  },
};

function ccMemberSheet(id) {
  const m = ccMember(id); if (!m) return;
  const canManage = myRole() === "gerant"; const isMe = id === S.me.id; const local = ccLocalMode(); const cloud = ccCloud(); const owner = ccIsOwner(id); const acct = cloud && ccIsAccount(m);
  const ev = S.events.filter((e) => e.uid === id); const today = ev.filter((e) => dayKey(new Date(e.at)) === dayKey()).length;
  const reads = S.readings.filter((r) => r.uid === id).length;
  const evIco = (t) => (t === "reading" ? "therm" : t === "team" ? "users" : t === "out" || t === "lost" ? "out" : "check");
  openSheet(`<div class="cc-mhead">${ccAva(m, 72)}<div style="min-width:0"><div class="h2">${esc(m.name || "Sans nom")}${isMe ? ` <span class="cc-you">vous</span>` : ""}</div><div class="sub">${ROLES[m.role] || "Équipe"}${owner ? " · propriétaire" : ""} · depuis le ${m.joinedAt ? shortDate(dayKey(new Date(m.joinedAt))) : "–"}${acct ? (m.email ? ` · ${esc(m.email)}` : "") : ccHasPin(m) ? " · code actif" : " · code à créer"}</div></div></div>
    <div class="cc-kpis"><div><b class="mono">${ev.length}</b><span>actions</span></div><div><b class="mono">${today}</b><span>aujourd'hui</span></div><div><b class="mono">${reads}</b><span>relevés</span></div></div>
    ${typeof PERMS !== "undefined" && (canManage || isMe) ? ccAccessHTML(m, canManage && !isMe && !owner) : ""}
    <div><span class="lbl">Activité récente</span>${ev.length ? ev.slice(0, 6).map((e) => `<div class="li"><span class="ic cc-evic">${ico(evIco(e.type))}</span><div class="tx"><b style="white-space:normal">${esc(String(e.text).replace(/^a /, "A "))}</b><em>${when(e.at)}</em></div></div>`).join("") : `<div class="empty" style="padding:14px 0">Aucune action pour l'instant.</div>`}</div>
    <div class="cc-acts">${local && !isMe ? `<button class="btn acc block" data-act="ccPick" data-id="${id}">${ico("swap")}Passer sur ${esc(firstName(m.name) || "ce profil")}</button>` : ""}
      ${(local || cloud) && (canManage || isMe) ? `<button class="btn soft block" data-act="ccMemberEdit" data-id="${id}">${ico("edit")}${"Modifier le profil"}</button>` : ""}
      ${local && isMe ? `<button class="btn soft block" data-act="ccPinChange">${ico("lock")}${ccHasPin(m) ? "Changer mon code" : "Créer mon code"}</button>` : ""}
      ${(local || cloud) && canManage && !isMe && !acct && ccHasPin(m) ? `<button class="btn soft block" data-act="ccPinReset" data-id="${id}">${ico("lock")}Réinitialiser son code</button>` : ""}
      ${(local || cloud) && canManage && !isMe && !owner ? `<button class="btn danger block" data-act="ccMemberDel" data-id="${id}">${ico("trash")}Retirer de l'équipe</button>` : ""}
      ${cloud && isMe && !owner ? `<button class="btn danger block" data-act="auLeave">${ico("out")}Quitter l'équipe</button>` : ""}</div>`);
}
/* « Accès et obligations »: what the person sees and must do (js/perms.js), and the button that reopens the flow */
function ccAccessHTML(m, edit) {
  const s = PERMS.summary(m.id); const fn = esc(firstName(m.name) || "Il");
  const list = (arr, cls) => arr.map((t) => `<li><span class="pm-b ${cls}"></span>${esc(t)}</li>`).join("");
  return `<div class="cc-accb"><div class="row"><span class="lbl">Accès et obligations</span>${s.admin ? `<span class="pill acc">Accès à tout</span>` : ""}</div>
    ${s.admin ? `<p class="sub" style="margin:4px 0 0">${fn} gère le restaurant avec vous : tout, y compris l'équipe et l'abonnement.</p>` : `<div class="pm-rec cc-accr"><div class="pm-rc"><b class="pm-rt">${fn} peut</b><ul>${list(s.can.slice(0, 20), "ok") || `<li><span class="pm-b"></span>pointer et signer</li>`}</ul></div>${s.must.length ? `<div class="pm-rc must"><b class="pm-rt">${fn} doit</b><ul>${list(s.must, "sa")}</ul></div>` : ""}</div>`}
    ${edit ? `<button class="btn soft block" data-act="pmEdit" data-id="${m.id}">${ico("shield")}Changer ses accès</button>` : ""}</div>`;
}
function ccFormSheet() {
  const F = CC.form; const isNew = !F.id; const m = F.id ? ccMember(F.id) : null; const canRole = myRole() === "gerant" && !ccIsOwner(F.id);
  openSheet(`<div class="cc-fhead"><span id="ccfPrev">${ccAva({ id: F.id || "new", name: F.name || "?", color: F.color }, 72)}</span><div class="h2">${isNew ? "Nouvel équipier" : "Modifier le profil"}</div></div>
    <label class="field"><span>Prénom</span><input class="input" id="ccfName" value="${esc(F.name)}" placeholder="Ex. Léa" autocomplete="off" maxlength="40" enterkeyhint="done"></label>
    ${canRole && typeof PERMS === "undefined" ? `<div class="field"><span>Rôle</span><div class="cc-seg">${Object.entries(ROLES).map(([k, t]) => `<button class="${F.role === k ? "on" : ""}" data-act="ccFormRole" data-v="${k}">${t}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span>Couleur</span><div class="cc-swatches">${PALETTE.map((c) => `<button class="${F.color === c ? "on" : ""}" style="--c:${c}" data-act="ccFormColor" data-v="${c}" aria-label="Couleur"></button>`).join("")}</div></div>
    ${!isNew && ccIsOwner(F.id) ? `<p class="note" style="margin-top:-4px">${ico("shield")}Propriétaire du restaurant : toujours gérant.</p>` : ""}
    ${isNew ? `<label class="field"><span>Code à 4 chiffres <em class="cc-opt">facultatif</em></span><input class="input mono cc-pinin" id="ccfPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="Sinon, créé à sa 1re connexion"></label>
    <span class="note" style="margin-top:-6px">${ccCloud() ? "Le code protège son pointage et ses signatures. Facultatif." : "Le code évite qu'un autre signe à sa place. Laissez vide : il le choisira lui-même en touchant son visage."}</span>`
    : `<div class="li cc-pinrow"><span class="ic">${ico("lock")}</span><div class="tx"><b>Code personnel</b><em>${ccHasPin(m) ? "Actif" : "À créer à la prochaine connexion"}</em></div>${F.id === S.me.id ? `<button class="btn soft sm" data-act="ccPinChange">${ccHasPin(m) ? "Changer" : "Créer"}</button>` : canRole && ccHasPin(m) ? `<button class="btn soft sm" data-act="ccPinReset" data-id="${F.id}">Réinitialiser</button>` : ""}</div>`}
    <button class="btn acc block" data-act="ccMemberSave">${isNew ? `${ico("plus")}Ajouter à l'équipe` : `${ico("check")}Enregistrer`}</button>`,
  (b) => { if (isNew && window.matchMedia("(min-width:960px)").matches) setTimeout(() => $("#ccfName", b)?.focus({ preventScroll: true }), 380); });
}

/* ───────────── réglages ───────────── */
function ccBytes() { const s = ccLS.raw("gg-local") || ""; const k = (s.length * 2) / 1024; return k > 1024 ? `${fmt(k / 1024, 1)} Mo` : `${Math.max(1, Math.round(k))} Ko`; }
/* « Installer l'app »: auth.js may provide ACT.auInstall; otherwise the browser prompt, or the install card on Accueil */
function ccCanInstall() { try { if (typeof isStandalone === "function" && isStandalone()) return false; return typeof ACT.auInstall === "function" || (typeof installEvt !== "undefined" && !!installEvt) || (typeof IS_IOS !== "undefined" && IS_IOS) || (typeof IS_ANDROID !== "undefined" && IS_ANDROID); } catch (e) { return false; } }
const ccSw = (on) => `<span class="cc-sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span>`;
VIEWS.reglages = {
  render() {
    const me = ccMember(S.me.id) || { id: S.me.id, name: S.me.name, color: S.me.color }; const local = ccLocalMode(); const al = ccAutoLock(); const lb = +(ccLS.raw("gg-lastbackup") || 0);
    const gerant = myRole() === "gerant";
    return `<div class="inner cc-wide">${topBar("Réglages")}
      <div class="cc-hero st" style="--i:1">${ccAva(me, 52)}<div style="flex:1;min-width:0"><b>${esc(S.me.name || "Vous")}</b><span>${ROLES[myRole()]} · ${esc(S.resto?.name || "")}</span></div>${local ? `<button class="btn sm cc-hero-btn" data-act="whoami">${ico("swap")}Changer</button>` : ""}</div>
      <div class="cc-cols"><div class="cc-col">
      <div class="lbl st cc-sec" style="--i:2">Restaurant</div>
      <div class="glass pad st" style="--i:2">
        <div class="li tap" data-act="${local && ccMember(S.me.id) ? "ccMemberEdit" : "meRename"}" data-id="${S.me.id}"><span class="ic">${ico("users")}</span><div class="tx"><b>Mon profil</b><em>${esc(S.me.name || "À renseigner, il signe vos relevés")}</em></div>${ico("chev")}</div>
        ${local && ccMember(S.me.id) ? `<div class="li tap" data-act="ccPinChange"><span class="ic w-in">${ico("lock")}</span><div class="tx"><b>Mon code</b><em>${ccHasPin(ccMember(S.me.id)) ? "Actif · toucher pour le changer" : "À créer : il protège votre profil"}</em></div>${ccHasPin(ccMember(S.me.id)) ? ico("chev") : `<span class="pill warn">À créer</span>`}</div>` : ""}
        <div class="li tap" data-act="restoRename"><span class="ic">${ico("edit")}</span><div class="tx"><b>Nom du restaurant</b><em>${esc(S.resto?.name || "")}</em></div>${ico("chev")}</div>
        ${gerant && typeof OB !== "undefined" ? `<div class="li tap" data-act="obComplete"><span class="ic w-sa">${ico("obCard")}</span><div class="tx"><b>Compléter la fiche du restaurant</b><em>${[S.resto?.logo ? "" : "logo", S.resto?.address ? "" : "adresse", S.fridges.length ? "" : "frigos", S.resto?.printer ? "" : "imprimante"].filter(Boolean).join(", ") || "Logo, adresse, frigos, équipe, imprimante"}</em></div>${ico("chev")}</div>` : ""}
        <div class="li tap" data-act="restoSwitch"><span class="ic w-sk">${ico("store")}</span><div class="tx"><b>Établissements</b><em>${S.restos.length} · changer ou en ajouter un</em></div>${ico("chev")}</div>
        ${typeof abRow === "function" ? abRow() : ""}
        <div class="li tap" data-go="equipe"><span class="ic w-mi">${ico("users")}</span><div class="tx"><b>Équipe</b><em>${S.members.length} personne${S.members.length > 1 ? "s" : ""}</em></div>${ico("chev")}</div>
        ${typeof pzRow === "function" ? pzRow() : ""}
        ${typeof ACT.tourStart === "function" ? `<div class="li tap" data-act="tourStart"><span class="ic w-sa">${ico("sparkle")}</span><div class="tx"><b>Revoir la visite guidée</b><em>Les écrans clés en 1 minute</em></div>${ico("chev")}</div>` : ""}
        <div class="li tap" data-go="imprimante"><span class="ic w-nd">${ico("printer")}</span><div class="tx"><b>Imprimante</b><em>${esc(typeof lbPrinterCfg === "function" ? (lbPrinterCfg().name || "À choisir") : "À choisir")}</em></div>${ico("chev")}</div>
      </div></div><div class="cc-col">
      <div class="lbl st cc-sec" style="--i:3">Cet appareil</div>
      <div class="glass pad st" style="--i:3">
        <div class="li tap" data-act="sound" role="switch" aria-checked="${SFX.on}"><span class="ic">${ico("sound")}</span><div class="tx"><b>Sons</b><em>${SFX.on ? "Activés" : "Coupés"}</em></div>${ccSw(SFX.on)}</div>
        <div class="li tap" data-act="ccHaptics" role="switch" aria-checked="${ccHaptics()}"><span class="ic">${ico("vibe")}</span><div class="tx"><b>Vibrations</b><em>${ccVib0 ? (ccHaptics() ? "Activées" : "Coupées") : "Non prises en charge sur cet appareil"}</em></div>${ccSw(ccHaptics())}</div>
        ${ccCanInstall() ? `<div class="li tap" data-act="ccInstall"><span class="ic w-sa">${ico("download")}</span><div class="tx"><b>Installer sur l'écran d'accueil</b><em>Plein écran, même sans réseau</em></div>${ico("chev")}</div>` : ""}
        ${local ? `<div class="li tap" data-act="ccAutoLockSheet"><span class="ic w-nd">${ico("lock")}</span><div class="tx"><b>Code à l'ouverture</b><em>${al ? `Redemandé après ${al >= 60 ? al / 60 + " h" : al + " min"} sans utiliser l'app` : "Demandé seulement à l'ouverture"}</em></div><span class="pill acc">${al ? (al >= 60 ? al / 60 + " h" : al + " min") : "Ouverture"}</span></div>` : ""}
      </div>
      ${local ? `<div class="lbl st cc-sec" style="--i:4">Données</div>
      <div class="glass pad st cc-data" style="--i:4">
        <div class="cc-datahead"><span class="ic w-sk">${ico("db")}</span><div style="flex:1;min-width:0"><b>Vos données sont sur cet appareil</b><span>${ccBytes()} · dernière sauvegarde : ${lb ? when(lb) : "jamais"}</span></div></div>
        ${!lb || Date.now() - lb > 7 * 864e5 ? `<div class="banner" style="margin-top:12px">${ico("alert")}<span>Sauvegardez chaque semaine : si le téléphone est perdu ou vidé, le fichier permet de tout récupérer.</span></div>` : ""}
        <div class="grid2 cc-g2" style="margin-top:12px">${gerant ? `<button class="btn acc" data-act="ccExport">${ico("download")}Sauvegarder</button><button class="btn soft" data-act="ccImport">${ico("upload")}Restaurer</button>` : `<button class="btn acc" data-act="ccExport" style="grid-column:1/-1">${ico("download")}Sauvegarder</button>`}</div>
        ${gerant ? "" : `<p class="note" style="margin:8px 2px 0">Seul un gérant peut restaurer une sauvegarde.</p>`}
      </div>
      ${gerant ? `<div class="glass pad st" style="--i:5"><div class="li tap" data-act="ccReset"><span class="ic bad">${ico("trash")}</span><div class="tx"><b style="color:var(--bad)">Tout effacer</b><em>Vide cet appareil, définitivement</em></div>${ico("chev")}</div></div>` : ""}`
      : ccCloud() && gerant ? `<div class="lbl st cc-sec" style="--i:4">Remise à zéro</div>
      <div class="glass pad st" style="--i:4">
        <div class="li tap" data-act="auWipe"><span class="ic bad">${ico("trash")}</span><div class="tx"><b style="color:var(--bad)">Vider les données du restaurant</b><em>Relevés, stock, registre… · l'équipe reste</em></div>${ico("chev")}</div>
        ${ccIsOwner(S.me.id) ? `<div class="li tap" data-act="auDelResto"><span class="ic bad">${ico("store")}</span><div class="tx"><b style="color:var(--bad)">Supprimer le restaurant</b><em>Pour toute l'équipe, définitivement</em></div>${ico("chev")}</div>` : ""}
      </div>` : ""}
      </div></div>
      <div class="cc-about st" style="--i:6">${appIcon(40)}<div><b>Growth Gusto</b><span>Version ${esc(typeof APP_V !== "undefined" ? APP_V : "")}</span></div></div></div>`;
  },
};

async function ccSaveFile(name, blob) {
  if (S.cap.downloads) { try { await S.cap.downloads.save({ filename: name, data: blob }); return true; } catch (e) { if (e && e.code === "declined") return false; } }
  const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); return true;
}
function ccStats(data) {
  const keys = Object.keys(data || {}); const cnt = (c) => keys.filter((k) => k.endsWith("/" + c)).reduce((s, k) => s + Object.keys(data[k] || {}).length, 0);
  return { restos: Object.keys(data.restos || {}).length, readings: cnt("readings"), lots: cnt("lots"), events: cnt("events"), members: cnt("members") };
}
/* keep only what the app can load: restos/{rid} objects and restos/{rid}/{collection} maps of objects */
function ccCleanBackup(data) {
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
  if (!isObj(data) || !isObj(data.restos)) return null;
  const out = { restos: {} };
  Object.entries(data.restos).forEach(([rid, r]) => { if (isObj(r) && /^[\w-]{1,64}$/.test(rid)) out.restos[rid] = { ...r, name: String(r.name || "Établissement").slice(0, 80) }; });
  if (!Object.keys(out.restos).length) return null;
  Object.entries(data).forEach(([k, v]) => { const m = /^restos\/([\w-]{1,64})\/([A-Za-z]{1,32})$/.exec(k); if (!m || !out.restos[m[1]] || !isObj(v)) return; const col = {}; Object.entries(v).forEach(([id, d]) => { if (isObj(d)) col[id] = d; }); out[k] = col; });
  return out;
}
async function ccImportFile(file) {
  const bad = (msg) => { SFX.err(); buzz([30, 50, 30]); toast(msg || "Fichier non reconnu", "err"); };
  if (file.size > 30 * 1024 * 1024) { bad("Fichier trop lourd"); return; }
  let obj; try { obj = JSON.parse(await file.text()); } catch (e) { obj = null; }
  const data = ccCleanBackup(obj && obj.app === "growth-gusto" ? obj.data : obj);
  if (!data) { bad(); return; }
  const pr = obj && typeof obj.prefs === "object" && obj.prefs ? obj.prefs : {}; S.ui.ccImport = { data, prefs: { rid: typeof pr.rid === "string" ? pr.rid : null, who: pr.who && typeof pr.who === "object" ? pr.who : null, ghosts: pr.ghosts && typeof pr.ghosts === "object" ? pr.ghosts : null } }; const st = ccStats(data); const names = Object.values(data.restos).map((r) => r && r.name).filter(Boolean);
  openSheet(`<div style="text-align:center"><span class="ic" style="width:56px;height:56px;border-radius:20px;margin:0 auto">${ico("upload")}</span><div class="h2" style="margin-top:10px;font-size:21px">Restaurer cette sauvegarde ?</div><p class="sub" style="margin:6px 0 0">${obj && obj.exportedAt ? `Faite le ${shortDate(dayKey(new Date(obj.exportedAt)))} à ${hm(obj.exportedAt)}` : esc(file.name)}</p></div>
    <div class="cc-impsum"><b>${esc(names.join(", ") || "Établissement")}</b><div class="cc-kpis"><div><b class="mono">${st.readings}</b><span>relevés</span></div><div><b class="mono">${st.lots}</b><span>produits</span></div><div><b class="mono">${st.members}</b><span>personnes</span></div></div></div>
    <div class="banner">${ico("alert")}<span>Les données actuelles de cet appareil seront remplacées par celles du fichier.</span></div>
    <button class="btn acc block" data-act="ccImportOk">${ico("check")}Restaurer</button><button class="btn ghost block" data-act="sheetClose">Annuler</button>`);
}
function ccReload(flag) { try { sessionStorage.setItem("gg-flash", flag); } catch (e) {} setTimeout(() => location.reload(), 650); }
setTimeout(() => { let f = null; try { f = sessionStorage.getItem("gg-flash"); sessionStorage.removeItem("gg-flash"); } catch (e) {} if (f === "import") setTimeout(() => { toast("Sauvegarde restaurée"); SFX.done(); burst(); }, 900); if (f === "reset") setTimeout(() => toast("Appareil remis à zéro"), 900); }, 0);

/* ───────────── menu Plus ───────────── */
const ccTry = (fn, d) => { try { const v = fn(); return v == null ? d : v; } catch (e) { return d; } };
function ccOblDueN() { return typeof oblDue === "function" ? ccTry(() => (oblDue(30) || []).length, 0) : 0; }
function ccOnShiftN() { return typeof homeOnShift === "function" ? ccTry(() => homeOnShift().filter((x) => x.st === "in").length, 0) : 0; }
/* V2: one pastel well per module, same colours as the Accueil shortcuts */
const CC_WELL = { releve: "w-vi", frigos: "w-sk", scan: "w-in", reception: "w-sa", notes: "w-to", menage: "w-sk", dashboard: "w-vi", finance: "w-mi", stock: "w-to", tickets: "w-sa", registre: "w-sk", obligations: "w-nd", pointeuse: "w-sk", planning: "w-vi", staff: "w-mi", equipe: "w-mi", avis: "w-sa", imprimante: "w-nd", reglages: "w-nd", abonnement: "w-vi", avisAdmin: "w-sa", admin: "w-in" };
VIEWS.more = {
  render() {
    const ts = todayStats(S.slot || slotNow()); const pend = ts.exp - ts.done; const urg = urgentCount();
    const staffR = VIEWS.staff && canSee("staff"); const fbNew = typeof avisUnread === "function" ? (avisUnread() || 0) : 0;
    /* [route, icon, title, badge, badge tone] */
    const groups = [
      ["Au quotidien", [["releve", "therm", "Relevés", pend > 0 && S.fridges.length ? pend : 0], ["frigos", "snow", "Frigos", 0], ["scan", "scan", "Scanner", urg], ["reception", "truck", "Réception", 0], ["alertes", "alBell", "Alertes", typeof ALERTES !== "undefined" ? ALERTES.count() : 0], ["resa", "resa", "Réservations", typeof RESA !== "undefined" && RESA.unseen ? (RESA.unseen() || 0) : 0, "acc"]]],
      ["Cuisine", [["notes", "book", "Recettes & allergènes", 0], ["menage", "spray", "Ménage", 0], ["hygiene", "hygPot", "Hygiène", 0], ["sondes", "sdProbe", "Sondes", 0]]],
      ["Gestion", [["dashboard", "dash", "Tableau de bord", 0], ["finance", "euro", "Finances", 0], ["stock", "box", "Stock", 0], ["tickets", "receipt", "Tickets Z", 0], ["caisse", "cxPlug", "Caisse connectée", 0], ["registre", "shield", "Registre", 0], ["controle", "ctBadge", "Contrôle sanitaire", 0], ["rappel", "ctRecall", "Rappel de lot", 0], ["obligations", "calcheck", "Obligations", ccOblDueN()]]],
      ["Équipe", [["pointeuse", "clock", "Pointeuse", ccOnShiftN(), "ok"], ["planning", "cal", "Planning", 0], ["formation", "book", "Formation HACCP", 0], staffR ? ["staff", "users", "Équipe & salaires", 0] : ["equipe", "users", "Équipe", 0], ["avis", "star", "Votre avis sur l'app", fbNew, "acc"]]],
      ["Restaurant", [["sites", "store", "Mes établissements", 0], ["import", "upload", "Importer", 0], ...(staffR ? [["equipe", "lock", "Profils & codes", 0]] : []), ["imprimante", "printer", "Imprimante", 0], ["reglages", "sliders", "Réglages", 0], ...(typeof abTile === "function" ? [abTile()] : []), ...(typeof avisIsAdmin === "function" && avisIsAdmin() ? [["avisAdmin", "star", "Retours reçus (admin)", 0], ...(VIEWS.admin ? [["admin", "shield", "Clients (admin)", 0]] : [])] : [])]],
    ];
    const grp = typeof pzMoreGroups === "function" ? pzMoreGroups(groups) : groups; /* js/perso.js: the person's order, icons, colours, names */
    let k = 2;
    const me = ccMember(S.me.id) || { id: S.me.id, name: S.me.name, color: S.me.color };
    return `<div class="inner narrow cc-more">${topBar("Tout Growth Gusto", { noBack: true })}
      <div class="cc-hero st" style="--i:1">${ccAva(me, 46)}<div style="flex:1;min-width:0"><b>${esc(S.me.name || "Vous")}</b><span>${ROLES[myRole()]} · ${esc(S.resto?.name || "")}</span></div>${ccLocalMode() ? `<button class="btn sm cc-hero-btn" data-act="whoami">${ico("swap")}Changer</button>` : ""}</div>
      ${grp.map(([g, items]) => { const its = items.filter(([r]) => VIEWS[r] && canSee(r)); if (!its.length) return ""; const n = its.length, c = n % 3 === 0 ? 3 : n === 4 || n === 7 || n === 8 ? 4 : n <= 2 ? 2 : 3; return `<div class="lbl st cc-sec" style="--i:${k++}">${g}</div><div class="cc-grid c${c} st" style="--i:${k++}">${its.map(([r, i, t, b, tone, w]) => `<button class="cc-gt ${w || CC_WELL[r] || "w-vi"}" data-go="${r}" ${r === "reception" ? 'data-fresh="1"' : ""}><span class="ic">${ico(IC[i] ? i : "grid")}${b ? `<span class="cc-gb mono ${tone || ""}">${b}</span>` : ""}</span><span class="t">${esc(t)}</span></button>`).join("")}</div>`; }).join("")}
      ${myRole() !== "gerant" && ccLocalMode() ? `<p class="note st cc-more-note" style="--i:${k}">${ico("lock")}Finances, salaires et tableau de bord sont réservés au gérant.</p>` : ""}
    </div>`;
  },
};

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  /* onboarding */
  obToggle: (a) => { const n = a.dataset.n; const s = S.ui.obFr; const i = s.indexOf(n); i >= 0 ? s.splice(i, 1) : s.push(n); const on = i < 0; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); a.classList.remove("bump"); void a.offsetWidth; a.classList.add("bump"); const nt = $("#obFrNote"); if (nt) nt.textContent = ccObFrNote(s.length); SFX.tick(); buzz(5); },
  obNext: () => {
    const n = S.ui.obStep || 0;
    if (n === 0) { const el = $("#obMe"); if (!el.value.trim()) { ccShake(el); el.focus(); return; } }
    if (n === 1) { const el = $("#obName"); if (!el.value.trim()) { ccShake(el); el.focus(); return; } }
    SFX.tap(); buzz(5); ccObGo(Math.min(2, n + 1));
  },
  obPrev: () => { SFX.tap(); ccObGo(Math.max(0, (S.ui.obStep || 0) - 1)); },
  obTeamAdd: () => { const el = $("#obTeamIn"); const n = (el.value || "").trim(); if (!n) { ccShake(el); return; } if (S.ui.obTeam.length >= 12) { toast("12 personnes maximum ici : ajoutez les autres dans Équipe."); return; }
    const me = ($("#obMe")?.value || "").trim().toLowerCase(); if (n.toLowerCase() === me || S.ui.obTeam.some((t) => t.name.toLowerCase() === n.toLowerCase())) { ccShake(el); toast("Ce prénom est déjà dans la liste.", "err"); return; } S.ui.obTeam.push({ name: n, role: "equipe" }); el.value = ""; $("#obTeamList").innerHTML = ccObTeamHTML(); const last = $("#obTeamList .cc-mate:last-child"); last && last.classList.add("pop"); SFX.ok(); buzz(6); el.focus(); ccObFit(); },
  obTeamDel: (a, id, v) => { S.ui.obTeam.splice(+v, 1); $("#obTeamList").innerHTML = ccObTeamHTML(); ccObFit(); SFX.close(); },
  obCreate: async () => {
    const meEl = $("#obMe"), nameEl = $("#obName");
    const me = meEl ? meEl.value.trim() : S.me.name; if (meEl && !me) { ccObGo(0); ccShake(meEl); return; }
    const name = (nameEl.value || "").trim(); if (!name) { ccObGo(1); ccShake(nameEl); return; }
    const pending = ($("#obTeamIn")?.value || "").trim(); if (pending && !S.ui.obTeam.some((t) => t.name.toLowerCase() === pending.toLowerCase())) S.ui.obTeam.push({ name: pending, role: "equipe" });
    if (me) { S.me.name = me; S.me.color = S.me.color || PALETTE[0]; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), ...S.me }; try { localStorage.setItem("gg-name", me); } catch (e) {} }
    const rid = "r" + Date.now().toString(36); const prev = S.rid; S.rid = rid;
    const go1 = $("#obGo"); go1 && go1.setAttribute("disabled", "");
    try {
      await safe(DB.set("restos", rid, { name, createdAt: Date.now(), by: S.me.id }));
      attachedRid = null; memberChecked = true; CC.last = Date.now(); attachResto();
      await DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now(), ...(S.me.name ? { name: S.me.name } : {}), color: S.me.color || PALETTE[0] });
      for (const [i, t] of (S.ui.obTeam || []).entries()) { const id = "m" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5); await DB.set("members", id, { role: t.role || "equipe", name: t.name, color: PALETTE[(i + 1) % PALETTE.length], joinedAt: Date.now() + i + 1, by: S.me.id }); }
      const frs = OB_FRIDGES.filter(([n]) => S.ui.obFr.includes(n));
      for (const [i, [n, k]] of frs.entries()) { const t = ccObType(k); await DB.add("fridges", { name: n, type: t.k, min: t.min, max: t.max, order: i, createdAt: Date.now() + i }); }
      await logEvent("team", `a créé ${name}`);
      if ((S.ui.obTeam || []).length) await logEvent("team", `a ajouté ${S.ui.obTeam.map((t) => t.name).join(", ")} à l'équipe`);
      S.resto = { id: rid, name }; ccSaveWho(); S.ui.obTeam = [];
      SFX.done(); buzz([12, 40, 12, 40, 30]); ccCelebrate(S.me.name, name, S.ui.obFr.length); S.history = []; go("home", {}, { replace: true });
    } catch (e) { S.rid = prev; go1 && go1.removeAttribute("disabled"); }
  },

  /* switcher */
  whoami: () => { if (!ccLocalMode()) { go("reglages"); return; } CC.who = { mode: "sheet", pick: null, code: "", err: false }; openSheet(ccWhoHTML()); buzz(6); },
  ccPick: (a, id) => {
    const m = ccMember(id); if (!m) return; const lock = CC.locked;
    if (!lock && m.id === S.me.id && $("#sheetBody .cc-who")) { closeSheet(); return; }
    if (!lock && !$("#sheetBody .cc-who")) { CC.who = { mode: "sheet", pick: null, code: "", err: false }; ccPickStart(id); openSheet(ccWhoHTML()); return; }
    ccPickStart(id); SFX.tap(); buzz(5); ccWhoPaint();
  },
  ccWhoBack: () => { const w = CC.who; if (w.change) { closeSheet(); return; } w.pick = null; w.code = ""; w.err = false; w.step = ""; SFX.tap(); ccWhoPaint(); },
  ccKey: (a, id, v) => {
    const w = CC.who; if (!w.pick || w.busy || ccWaitLeft(w.pick) || (w.code.length >= 4 && v !== "del")) return; w.err = false;
    if (v === "del") w.code = w.code.slice(0, -1); else w.code += v;
    SFX.tick(); buzz(4); ccWhoPaint();
    if (w.code.length === 4) ccCodeDone();
  },
  /* gérant: the person creates a new code at their next sign-in */
  ccPinReset: (a, id) => ccOnce("pinReset", async () => {
    const m = ccMember(id); if (!m || myRole() !== "gerant") return;
    await safe(DB.update("members", id, { pinSha: "", pinSalt: "", pinH: "" })); ccFailSet(id, null);
    await logEvent("team", `a réinitialisé le code de ${firstName(m.name)}`);
    closeSheet(true); SFX.ok(); buzz(8); toast(`${firstName(m.name)} créera un nouveau code à sa prochaine connexion`);
  }),
  /* me: change (or create) my own code */
  ccPinChange: () => { const m = ccMember(S.me.id); if (!m || !ccLocalMode()) return; CC.who = { mode: "sheet", pick: null, code: "", err: false, change: true }; ccPickStart(m.id, ccHasPin(m) ? "enter" : "new"); openSheet(ccWhoHTML()); buzz(6); },
  ccUnlockTest: (a, id) => ccUnlockTest(typeof id === "string" ? id : null),

  /* équipe */
  ccMember: (a, id) => ccMemberSheet(id),
  ccMemberNew: () => { if (myRole() !== "gerant") { toast("Seul un gérant peut ajouter quelqu'un.", "err"); return; } if (typeof PERMS !== "undefined") { closeSheet(true); return PERMS.flow({ from: "equipe", connect: DB.uid ? "" : "local" }); } const used = S.members.map((m) => m.color); CC.form = { id: null, name: "", role: "equipe", color: PALETTE.find((c) => !used.includes(c)) || PALETTE[S.members.length % PALETTE.length], clearPin: false }; ccFormSheet(); },
  ccMemberEdit: (a, id) => { const m = ccMember(id); if (!m) { ACT.meRename(); return; } CC.form = { id, name: m.name || "", role: m.role || "equipe", color: ccColor(m), clearPin: false }; ccFormSheet(); },
  ccFormRole: (a, id, v) => { CC.form.role = v; $$(".cc-seg button").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); SFX.tick(); },
  ccFormColor: (a, id, v) => { CC.form.color = v; $$(".cc-swatches button").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); const pv = $("#ccfPrev"); if (pv) pv.innerHTML = ccAva({ id: CC.form.id || "new", name: $("#ccfName").value || "?", color: v }, 72); SFX.tick(); buzz(4); },
  ccFormClearPin: (a) => { CC.form.clearPin = !CC.form.clearPin; a.classList.toggle("on", CC.form.clearPin); SFX.tick(); },
  ccMemberSave: () => ccOnce("memberSave", ACT.ccMemberSave0),
  ccMemberSave0: async () => {
    const F = CC.form; if (!F) return; const nEl = $("#ccfName"); if (!nEl) return; const name = (nEl.value || "").trim(); const pin = ($("#ccfPin")?.value || "").trim();
    if (!name) { ccShake(nEl); nEl.focus(); return; }
    if (S.members.some((m) => m.id !== F.id && (m.name || "").trim().toLowerCase() === name.toLowerCase())) { ccShake(nEl); toast(`Il y a déjà un ${name} : ajoutez une initiale.`, "err"); return; }
    if (pin && !/^\d{4}$/.test(pin)) { ccShake($("#ccfPin")); toast("Le code doit faire 4 chiffres.", "err"); return; }
    if (pin && ccWeakPin(pin)) { ccShake($("#ccfPin")); toast("Code trop facile à deviner.", "err"); return; }
    if (F.id) {
      const m = ccMember(F.id); if (!m) return;
      if (ccIsOwner(F.id)) F.role = "gerant";
      if (m.role === "gerant" && F.role !== "gerant" && ccGerants().length < 2) { SFX.err(); toast("Il faut au moins un gérant dans l'équipe.", "err"); return; }
      const patch = { name, role: F.role, color: F.color };
      await safe(DB.update("members", F.id, patch));
      if (m.role !== F.role) await logEvent("team", `a passé ${firstName(name)} en ${ROLES[F.role]}`);
      if (F.id === S.me.id) { S.me.name = name; S.me.color = F.color; if (F.id === "local") { try { localStorage.setItem("gg-name", name); } catch (e) {} } ccSaveWho(); S.isOwner = F.role === "gerant"; }
      S.profiles[F.id] = { ...(S.profiles[F.id] || {}), name, color: F.color };
      closeSheet(true); SFX.ok(); buzz(8); toast("Profil enregistré");
    } else {
      const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      await safe(DB.set("members", id, { role: F.role, name, color: F.color, joinedAt: Date.now(), by: S.me.id, ...(pin ? await ccPinPatch(id, pin) : {}) }));
      S.profiles[id] = { name, color: F.color };
      await logEvent("team", `a ajouté ${name} à l'équipe`);
      closeSheet(true); SFX.done(); buzz([10, 30, 10]); burst(window.innerWidth / 2, window.innerHeight / 2); toast(`${firstName(name)} fait partie de l'équipe`);
    }
    CC.form = null; renderChrome(); rerender();
  },
  ccMemberDel: (a, id) => { const m = ccMember(id); if (!m) return; if (ccIsOwner(id)) { SFX.err(); toast("Le propriétaire du restaurant ne peut pas être retiré.", "err"); return; } if (m.role === "gerant" && ccGerants().length < 2) { SFX.err(); toast("Il faut au moins un gérant dans l'équipe.", "err"); return; }
    openSheet(`<div style="text-align:center"><div style="display:flex;justify-content:center">${ccAva(m, 64)}</div><div class="h2" style="margin-top:10px;font-size:21px">Retirer ${esc(firstName(m.name))} ?</div><p class="sub" style="margin:6px auto 0;max-width:34ch">${ccCloud() && ccIsAccount(m) ? "Cette personne n'aura plus accès au restaurant sur son téléphone." : "Son profil disparaît de ce téléphone."} Ses relevés et actions restent au registre, à son nom.</p></div>
      <button class="btn danger block" data-act="ccMemberDelOk" data-id="${id}">${ico("trash")}Retirer</button><button class="btn ghost block" data-act="sheetClose">Annuler</button>`); },
  ccMemberDelOk: (a, id) => ccOnce("memberDel", () => ACT.ccMemberDel0(a, id)),
  ccMemberDel0: async (a, id) => { const m = ccMember(id); if (!m || id === S.me.id) return; const g = ccLS.get("gg-ghosts", {}); (g[S.rid] ||= {})[id] = { name: m.name || "", color: ccColor(m) }; ccLS.set("gg-ghosts", g); S.profiles[id] = { name: m.name, color: ccColor(m) };
    await safe(DB.del("members", id)); await logEvent("team", `a retiré ${firstName(m.name)} de l'équipe`); closeSheet(true); SFX.close(); toast(`${firstName(m.name)} a été retiré`); },
  role: (a, id) => ACT.ccMemberEdit(a, id),

  /* réglages */
  ccInstall: (a, id, v, e) => {
    if (typeof ACT.auInstall === "function") return ACT.auInstall(a, id, v, e);
    if (typeof installEvt !== "undefined" && installEvt && ACT.installApp) return ACT.installApp(a);
    try { localStorage.removeItem("gg-install-off"); } catch (x) {} S.ui.instOpen = true; SFX.tap(); go("home");
  },
  ccHaptics: () => { const on = !ccHaptics(); try { localStorage.setItem("gg-haptics", on ? "on" : "off"); } catch (e) {} ccApplyHaptics(); SFX.tick(); buzz(14); rerender(); },
  ccAutoLockSheet: () => { const al = ccAutoLock(); openSheet(`<div><div class="h2" style="font-size:21px">Redemander le code</div><p class="sub" style="margin:6px 0 0">Le code est toujours demandé à l'ouverture de l'app. Choisissez aussi au bout de combien de temps sans l'utiliser (téléphone en poche, écran éteint) il est redemandé.</p></div>
    <div style="display:flex;flex-direction:column;gap:8px">${[[5, "Après 5 minutes"], [15, "Après 15 minutes"], [30, "Après 30 minutes (conseillé)"], [60, "Après 1 heure"], [240, "Après 4 heures"], [0, "Seulement à l'ouverture"]].map(([v, t]) => `<button class="chip cc-opt-row ${al === v ? "on" : ""}" data-act="ccAutoLockSet" data-v="${v}">${t}${al === v ? ico("check") : ""}</button>`).join("")}</div>
    <button class="btn soft block" data-act="ccLockNow">${ico("lock")}Verrouiller maintenant</button>`); },
  ccAutoLockSet: (a, id, v) => { try { localStorage.setItem("gg-autolock", String(+v)); } catch (e) {} CC.last = Date.now(); closeSheet(true); SFX.ok(); toast(+v ? `Code redemandé après ${+v >= 60 ? +v / 60 + " h" : v + " min"}` : "Code demandé à l'ouverture seulement"); rerender(); },
  ccLockNow: () => ccLock(),
  ccExport: () => ccOnce("export", ACT.ccExport0, 1500),
  ccExport0: async () => {
    const data = JSON.parse(JSON.stringify(DB.local)); const st = ccStats(data);
    const payload = { app: "growth-gusto", kind: "sauvegarde", version: 1, exportedAt: Date.now(), by: S.me.name || "", stats: st, prefs: { rid: S.rid, who: ccLS.get("gg-who", {}), ghosts: ccLS.get("gg-ghosts", {}) }, data };
    const ok = await ccSaveFile(`growth-gusto-sauvegarde-${dayKey()}.json`, new Blob([JSON.stringify(payload)], { type: "application/json" }));
    if (ok) { try { localStorage.setItem("gg-lastbackup", String(Date.now())); } catch (e) {} SFX.done(); buzz([8, 30, 8]); toast(`Sauvegarde prête · ${st.readings} relevé${st.readings > 1 ? "s" : ""}`); if (S.route === "reglages" && !$("#sheet").classList.contains("open")) rerender(); }
  },
  ccImport: () => { if (S.resto && myRole() !== "gerant") { SFX.err(); toast("Seul un gérant peut restaurer une sauvegarde", "err"); return; } $("#ccImportPick").click(); },
  ccImportOk: () => {
    const I = S.ui.ccImport; if (!I) return; S.ui.ccImport = null;
    Object.keys(DB.local).forEach((k) => delete DB.local[k]); Object.assign(DB.local, JSON.parse(JSON.stringify(I.data)));
    try {
      localStorage.setItem("gg-local", JSON.stringify(DB.local));
      const rids = Object.keys(I.data.restos); const rid = I.prefs.rid && rids.includes(I.prefs.rid) ? I.prefs.rid : rids[0];
      if (rid) localStorage.setItem("gg-rid", rid); else localStorage.removeItem("gg-rid");
      if (I.prefs.who) localStorage.setItem("gg-who", JSON.stringify(I.prefs.who));
      if (I.prefs.ghosts) localStorage.setItem("gg-ghosts", JSON.stringify(I.prefs.ghosts));
    } catch (e) { toast("Espace de stockage insuffisant pour restaurer.", "err"); return; }
    closeSheet(true); SFX.ok(); toast("Restauration…"); ccReload("import");
  },
  ccReset: () => { openSheet(`<div style="text-align:center"><span class="ic bad" style="width:56px;height:56px;border-radius:20px;margin:0 auto">${ico("trash")}</span><div class="h2" style="margin-top:10px;font-size:21px">Tout effacer ?</div><p class="sub" style="margin:6px auto 0;max-width:36ch">Relevés, produits, stock, équipe, registre : tout sera supprimé de cet appareil. C'est définitif.</p></div>
    <button class="btn soft block" data-act="ccExport">${ico("download")}D'abord, sauvegarder</button>
    <label class="field"><span>Pour confirmer, tapez EFFACER</span><input class="input mono" id="ccResetIn" autocomplete="off" autocapitalize="characters" placeholder="EFFACER"></label>
    <button class="btn danger block" id="ccResetGo" data-act="ccResetOk" disabled>${ico("trash")}Effacer définitivement</button><button class="btn ghost block" data-act="sheetClose">Annuler</button>`); },
  ccResetOk: () => {
    if (($("#ccResetIn")?.value || "").trim().toUpperCase() !== "EFFACER") { ccShake($("#ccResetIn")); return; }
    Object.keys(DB.local).forEach((k) => delete DB.local[k]);
    ["gg-local", "gg-rid", "gg-who", "gg-ghosts", "gg-name", "gg-lastbackup", "gg-autolock", "gg-pinfail"].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
    ["ccResetGo"].forEach((x) => $("#" + x)?.setAttribute("disabled", ""));
    try { PHOTOS.urls && Object.values(PHOTOS.urls).forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} }); window.indexedDB && indexedDB.deleteDatabase("gg-photos"); } catch (e) {}
    closeSheet(true); SFX.close(); ccReload("reset");
  },

  /* établissements */
  restoSwitch: () => {
    openSheet(`<div class="h2" style="font-size:20px">Établissements</div>${S.restos.map((r) => `<div class="li tap" data-act="restoPick" data-id="${r.id}"><span class="cc-mono sm">${esc(initials(r.name))}</span><div class="tx"><b>${esc(r.name)}</b><em>${r.id === S.rid ? "Ouvert en ce moment" : "Toucher pour ouvrir"}</em></div>${r.id === S.rid ? `<span class="check cc-curck"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : ico("chev")}</div>`).join("")}
      ${myRole() === "gerant" ? `<div class="hstack"><input class="input" id="newResto" placeholder="Nouvel établissement" maxlength="60" enterkeyhint="done" style="flex:1;min-width:0"><button class="btn acc" data-act="restoAdd">${ico("plus")}Ajouter</button></div><span class="note">Chaque établissement a ses frigos, son équipe et son registre.</span>` : ""}`);
  },
  restoPick: (a, id) => {
    if (id === S.rid) { closeSheet(); return; }
    ccSaveWho(); const carry = { ...S.me };
    S.rid = id; S.resto = S.restos.find((r) => r.id === id); attachedRid = null; memberChecked = false;
    ["fridges", "readings", "lots", "products", "counts", "receptions", "events", "notes", "chores", "choreLogs", "tickets", "members"].forEach((k) => (S[k] = []));
    if (ccLocalMode()) { const w = ccLS.get("gg-who", {})[id]; S.me = w && w.id ? { id: w.id, name: w.name || "", color: w.color || undefined } : carry; }
    attachResto(); closeSheet(); S.history = []; go("home", {}, { replace: true }); toast(`${S.resto.name} ouvert`);
  },
  restoAdd: () => ccOnce("restoAdd", ACT.restoAdd0),
  restoAdd0: async () => { const n = ($("#newResto").value || "").trim(); if (!n) { ccShake($("#newResto")); return; } const rid = "r" + Date.now().toString(36); await safe(DB.set("restos", rid, { name: n, createdAt: Date.now(), by: S.me.id })); if (!S.restos.find((r) => r.id === rid)) S.restos.push({ id: rid, name: n }); const me = { ...S.me }; const g = ccLS.get("gg-who", {}); g[rid] = { id: me.id, name: me.name || "", color: me.color || "" }; ccLS.set("gg-who", g);
    ACT.restoPick(null, rid); await DB.set("members", me.id, { role: "gerant", joinedAt: Date.now(), ...(me.name ? { name: me.name } : {}), ...(me.color ? { color: me.color } : {}) }).catch(() => {}); S.isOwner = true; await logEvent("team", `a créé ${n}`); renderChrome(); SFX.done(); burst(); },
  restoRename: () => { openSheet(`<div class="h2" style="font-size:20px">Nom du restaurant</div><input class="input" id="rn" value="${esc(S.resto.name)}"><button class="btn acc block" data-act="restoRenameOk">Enregistrer</button>`); },
  meRename: () => { openSheet(`<div class="h2" style="font-size:20px">Votre prénom</div><input class="input" id="mn" value="${esc(S.me.name)}" autocomplete="given-name"><button class="btn acc block" data-act="meRenameOk">Enregistrer</button>`); },
  meRenameOk: async () => { const n = ($("#mn").value || "").trim(); if (!n) return; S.me.name = n; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), name: n }; if (S.me.id === "local") { try { localStorage.setItem("gg-name", n); } catch (e) {} } ccSaveWho(); await DB.update("members", S.me.id, { name: n }).catch(() => DB.set("members", S.me.id, { role: myRole(), joinedAt: Date.now(), name: n }).catch(() => {})); closeSheet(true); SFX.ok(); renderChrome(); rerender(); },
  restoRenameOk: async () => { const n = ($("#rn").value || "").trim(); if (!n) return; await safe(DB.update("restos", S.rid, { name: n })); closeSheet(); SFX.ok(); toast("Nom mis à jour"); },
  roleSet: async (a, id, v) => { await safe(DB.update("members", id, { role: v })); await logEvent("team", `a passé ${firstName(nameOf(id))} en ${ROLES[v]}`); closeSheet(true); SFX.ok(); },
});
