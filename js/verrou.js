/* Growth Gusto — area: verrou (« Verrouiller avec Face ID »). Prefix « vr ».
   An optional lock for THIS device, like a banking app: Face ID / Touch ID on iPhone, iPad and Mac (also in the app added to the
   home screen), fingerprint or face on Android, Windows Hello on a PC. Built on WebAuthn (a passkey made by the device's own
   biometric sensor, user verification required): the face or the finger never leaves the device, the app only gets « verified ».
   A 6-digit code is the fallback, and « Code oublié » signs out (the account's password or Google proves who you are again).
   Modes:
     cloud (DB.uid)  own lock screen (#vrLock), settings per account on this device: localStorage gg-vr["u:<uid>"]
     demo            same screens, Face ID simulated (no passkey left on the visitor's phone), nothing saved
     local           the profile lock of js/compte.js stays; each profile can add Face ID to it: gg-vr["l:<rid>:<memberId>"]
   When it locks: at app open (a reload while in use doesn't count: sessionStorage gg-vr-seen), after N minutes away or untouched
   (kitchen screens that nobody touches are only locked when the app is left), and right away when leaving if « Dès que je quitte ».
   Hooks: vrRow() (compte.js Réglages, « Cet appareil »), VR.lockNow(), vrUnlockTest() (tests). Route « verrou » (Réglages → Verrouillage). */
"use strict";

Object.assign(IC, {
  vrFace: ["M3.5 8V6.5a3 3 0 0 1 3-3H8", "M16 3.5h1.5a3 3 0 0 1 3 3V8", "M20.5 16v1.5a3 3 0 0 1-3 3H16", "M8 20.5H6.5a3 3 0 0 1-3-3V16", "M9 9v1.6", "M15 9v1.6", "M12.2 9v4.2h-1", "M9 16.1c1.7 1.3 4.3 1.3 6 0"],
  vrFinger: ["M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4", "M14 13.12c0 2.38 0 6.38-1 8.88", "M17.29 21.02c.12-.6.43-2.3.5-3.02", "M2 12a10 10 0 0 1 18-6", "M2 16h.01", "M21.8 16c.2-2 .131-5.354 0-6", "M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2", "M8.65 22c.21-.66.45-1.32.57-2", "M9 6.8a6 6 0 0 1 9 5.2v2"],
});

const VR = {
  demo: null, locked: false, mode: "main", code: "", first: "", err: "", busy: false, ok: false, confirm: null, abort: null,
  last: Date.now(), hiddenAt: 0, pickUntil: 0, inSys: false, beat: 0, setup: null, sheetCode: "", sheetFirst: "", sheetStep: "new", sheetErr: "",
  lockNow() { if (vrOn()) vrLock(false); },
};
const VR_DIGITS = 6;
const VR_DELAYS = [[0, "Dès que je quitte l'app", "Dès la sortie"], [1, "Après 1 minute", "1 min"], [5, "Après 5 minutes", "5 min"], [15, "Après 15 minutes", "15 min"], [60, "Après 1 heure", "1 h"]];
const vrDelayTx = (d) => (VR_DELAYS.find((x) => x[0] === d) || VR_DELAYS[2])[2];

/* ── which sensor this device has (only for the words and the drawing: the system shows its own prompt) ── */
function vrKind() {
  const ua = navigator.userAgent || ""; const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (/iPhone|iPod/.test(ua)) return { t: "Face ID", with: "avec Face ID", ic: "vrFace", face: true, dev: "iPhone", btn: "Déverrouiller avec Face ID" };
  if (iPad) return { t: "Face ID", with: "avec Face ID ou Touch ID", ic: "vrFace", face: true, dev: "iPad", btn: "Déverrouiller avec Face ID" };
  if (/Macintosh/.test(ua)) return { t: "Touch ID", with: "avec Touch ID", ic: "vrFinger", face: false, dev: "Mac", btn: "Déverrouiller avec Touch ID" };
  if (/Android/.test(ua)) return { t: "Empreinte", with: "avec votre empreinte ou votre visage", ic: "vrFinger", face: false, dev: "téléphone", btn: "Déverrouiller avec l'empreinte" };
  if (/Windows/.test(ua)) return { t: "Windows Hello", with: "avec Windows Hello", ic: "vrFace", face: true, dev: "ordinateur", btn: "Déverrouiller avec Windows Hello" };
  return { t: "Face ID ou empreinte", with: "avec Face ID ou l'empreinte", ic: "vrFace", face: true, dev: "appareil", btn: "Déverrouiller" };
}

/* ── storage ── */
const vrDemo = () => DB.mode === "demo";
const vrLocal = () => DB.mode === "local";
function vrAll() { try { const o = JSON.parse(localStorage.getItem("gg-vr") || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function vrKey(memberId) { if (vrDemo()) return "demo"; if (DB.uid) return "u:" + DB.uid; if (vrLocal() && S.rid) return "l:" + S.rid + ":" + (memberId || (S.me && S.me.id) || ""); return null; }
function vrCfg(memberId) { if (vrDemo()) return VR.demo; const k = vrKey(memberId); return k ? vrAll()[k] || null : null; }
function vrSave(c, memberId) {
  if (vrDemo()) { VR.demo = c; return; }
  const k = vrKey(memberId); if (!k) return; const all = vrAll(); if (c) all[k] = c; else delete all[k];
  try { localStorage.setItem("gg-vr", JSON.stringify(all)); } catch (e) {}
}
/* the app's own lock (cloud and demo). Local mode has the profile lock of compte.js. */
const vrOn = () => !vrLocal() && !!S.resto && !!vrCfg() && !!vrCfg().pinSha;
const vrBioOn = () => { const c = vrCfg(); return !!(c && (c.cred || c.sim)); };
/* local mode: the profiles of this restaurant that added Face ID on this device */
function vrLocalCreds() { if (!vrLocal() || !S.rid) return []; const p = "l:" + S.rid + ":"; return Object.entries(vrAll()).filter(([k, v]) => k.startsWith(p) && v && v.cred && S.members.some((m) => m.id === k.slice(p.length))).map(([k, v]) => ({ memberId: k.slice(p.length), cred: v.cred })); }

/* ── WebAuthn ── */
const vrB64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const vrBuf = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const vrRand = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const vrSupported = () => { try { return !!(window.isSecureContext && window.PublicKeyCredential && navigator.credentials && navigator.credentials.create); } catch (e) { return false; } };
let vrAvail = null;
function vrCheckAvail() {
  if (vrAvail !== null) return Promise.resolve(vrAvail);
  if (!vrSupported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) { vrAvail = false; return Promise.resolve(false); }
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then((v) => (vrAvail = !!v)).catch(() => (vrAvail = false));
}
vrCheckAvail().then(() => { if (S.route === "verrou" || S.route === "reglages") rerender(); });
/* flags byte of the authenticator data: bit 2 = the person was verified (face, finger or the device's own code) */
const vrUV = (ad) => { const a = new Uint8Array(ad); return a.length > 32 && (a[32] & 0x04) !== 0; };
function vrClientOk(cdj, type, chal) { try { const c = JSON.parse(new TextDecoder().decode(cdj)); return c.type === type && c.challenge === vrB64(chal) && c.origin === location.origin; } catch (e) { return false; } }
function vrErr(e) { const n = e && e.name; return n === "NotAllowedError" || n === "AbortError" ? "cancel" : n === "InvalidStateError" ? "exists" : n === "SecurityError" ? "security" : "other"; }
async function vrCreate() { VR.inSys = true; try { return await vrCreate0(); } finally { VR.inSys = false; VR.pickUntil = Date.now() + 1500; } }
async function vrCreate0() {
  const chal = vrRand(32); const u = typeof authUser === "function" ? authUser() : null;
  const who = (u && u.email) || (S.me && S.me.name) || "Growth Gusto";
  const c = await navigator.credentials.create({ publicKey: {
    rp: { name: "Growth Gusto" }, challenge: chal,
    user: { id: vrRand(16), name: who, displayName: `Verrouillage · ${(S.me && S.me.name) || who}` },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred", requireResidentKey: false },
    timeout: 60000, attestation: "none",
  } });
  if (!c || !vrClientOk(c.response.clientDataJSON, "webauthn.create", chal)) throw Object.assign(new Error("bad"), { name: "BadData" });
  try { if (c.response.getAuthenticatorData && !vrUV(c.response.getAuthenticatorData())) throw Object.assign(new Error("uv"), { name: "NoUV" }); } catch (e) { if (e.name === "NoUV") throw e; }
  return vrB64(c.rawId);
}
async function vrGet(ids) { VR.inSys = true; try { return await vrGet0(ids); } finally { VR.inSys = false; VR.pickUntil = Date.now() + 1500; } }
async function vrGet0(ids) {
  try { if (VR.abort) VR.abort.abort(); } catch (e) {}
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null; VR.abort = ac;
  const chal = vrRand(32);
  const a = await navigator.credentials.get({ publicKey: { challenge: chal, allowCredentials: ids.map((id) => ({ type: "public-key", id: vrBuf(id), transports: ["internal"] })), userVerification: "required", timeout: 60000 }, ...(ac ? { signal: ac.signal } : {}) });
  if (VR.abort === ac) VR.abort = null;
  if (!a || !vrClientOk(a.response.clientDataJSON, "webauthn.get", chal) || !vrUV(a.response.authenticatorData)) throw Object.assign(new Error("bad"), { name: "BadData" });
  const id = vrB64(a.rawId); if (!ids.includes(id)) throw Object.assign(new Error("unknown"), { name: "BadData" });
  return id;
}

/* ── code de secours: only a salted hash is kept ── */
function vrHash(salt, code) { return typeof ccSha === "function" ? ccSha(`vr:${salt}:${code}`) : String(code); }
const vrWeak = (c) => /^(\d)\1+$/.test(c) || "0123456789".includes(c) || "9876543210".includes(c) || /^(\d\d)\1\1$/.test(c);
function vrFailWait(c) { return c && c.until ? Math.max(0, Math.ceil((c.until - Date.now()) / 1000)) : 0; }

/* ── the drawing: Face ID frame (or a fingerprint) that scans, then turns into a tick ── */
function vrGlyph(cls = "") {
  const k = vrKind();
  const inner = k.face
    ? `<g class="vr-gf"><path class="vr-gc" d="M8 22V16a8 8 0 0 1 8-8h6"/><path class="vr-gc" d="M42 8h6a8 8 0 0 1 8 8v6"/><path class="vr-gc" d="M56 42v6a8 8 0 0 1-8 8h-6"/><path class="vr-gc" d="M22 56h-6a8 8 0 0 1-8-8v-6"/>
       <path class="vr-gp" d="M23 24v4.5"/><path class="vr-gp" d="M41 24v4.5"/><path class="vr-gp" d="M32.6 24v11.5h-2.6"/><path class="vr-gp vr-gm" d="M23.5 42.5c4.6 3.8 12.4 3.8 17 0"/></g>`
    : `<g class="vr-gf"><g transform="translate(5.33 5.33) scale(2.22)">${IC.vrFinger.map((d) => `<path class="vr-gp vr-fp" pathLength="1" d="${d}"/>`).join("")}</g></g>`;
  return `<svg class="vr-glyph ${cls}" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}
    <rect class="vr-scan" x="10" y="10" width="44" height="3" rx="1.5"/>
    <circle class="vr-ring" cx="32" cy="32" r="25" pathLength="1"/><path class="vr-tick" pathLength="1" d="M21.5 32.5l7 7 14-15"/></svg>`;
}

/* ═════════════ lock screen (cloud + demo) ═════════════ */
function vrMount() {
  let L = $("#vrLock"); if (L) return L;
  L = document.createElement("div"); L.id = "vrLock"; L.className = "vr-lock"; L.hidden = true;
  L.setAttribute("role", "dialog"); L.setAttribute("aria-modal", "true"); L.setAttribute("aria-label", "Application verrouillée");
  L.innerHTML = `<div class="vr-sky" aria-hidden="true"><i></i><i></i><i></i></div><div class="vr-wrap" id="vrBody"></div>`;
  document.body.appendChild(L); return L;
}
function vrClock() { const d = new Date(); return { t: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, d: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) }; }
function vrDots(n, cls = "") { return `<div class="vr-dots ${cls}" aria-label="${n} chiffre${n > 1 ? "s" : ""} sur ${VR_DIGITS}">${Array.from({ length: VR_DIGITS }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`; }
function vrPad(act, off) { return `<div class="vr-pad ${off ? "off" : ""}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="${act}" data-v="${d}" ${off ? "disabled" : ""}>${d}</button>`).join("")}<span></span><button data-act="${act}" data-v="0" ${off ? "disabled" : ""}>0</button><button data-act="${act}" data-v="del" aria-label="Effacer" ${off ? "disabled" : ""}>${ico("back")}</button></div>`; }
function vrLockHTML() {
  const c = vrCfg() || {}; const k = vrKind(); const ck = vrClock(); const bio = vrBioOn() && (c.sim || vrSupported());
  const name = firstName((S.me && S.me.name) || ""); const conf = VR.confirm;
  const brand = `<div class="vr-brand">${typeof restoLogo === "function" && restoLogo() ? restoMark(22) : appIcon(22)}<span>${esc(S.resto?.name || "Growth Gusto")}</span></div>`;
  const cancel = conf ? `<button class="vr-link" data-act="vrConfirmCancel">Annuler</button>` : "";
  if (VR.mode === "forgot") {
    return `${brand}<div class="vr-mid vr-forgot st" style="--i:1"><span class="vr-fic">${ico("lock")}</span><div class="vr-h">Code oublié ?</div>
      <p class="vr-p">${vrDemo() ? "Dans la démo, rien n'est enregistré : quittez-la simplement." : "Reconnectez-vous avec votre compte (Google ou e-mail). Le verrouillage de cet appareil sera retiré, vous pourrez le remettre ensuite dans Réglages."}</p></div>
      <div class="vr-foot"><button class="vr-cta" data-act="vrForgotOk">${ico("out")}${vrDemo() ? "Quitter la démo" : "Se déconnecter et se reconnecter"}</button><button class="vr-link" data-act="vrBackMain">Retour</button></div>`;
  }
  if (VR.mode === "pin" || !bio) {
    const wait = vrFailWait(c); const fails = c.fails || 0;
    const sub = wait ? "" : VR.err ? `<span class="vr-err">${esc(VR.err)}</span>` : conf ? esc(conf.why) : `Tapez votre code à ${VR_DIGITS} chiffres`;
    return `${brand}<div class="vr-mid vr-pinbox"><div class="vr-h sm">${conf ? "Confirmez" : "Code de l'app"}</div><div class="vr-p sm">${sub}</div>
      ${wait ? `<div class="vr-wait" role="status">${ico("clock")}<span>Trop d'essais. Réessayez dans <b id="vrWaitS">${wait} s</b></span></div>` : vrDots(VR.code.length, VR.err ? "err shake" : VR.ok ? "ok" : "")}</div>
      ${vrPad("vrKey", !!wait)}
      <div class="vr-foot row">${bio ? `<button class="vr-link" data-act="vrBackMain">${ico(k.ic)}${esc(k.t)}</button>` : `<span></span>`}${cancel || `<button class="vr-link" data-act="vrForgot">Code oublié ?</button>`}</div>
      ${fails >= 2 && !wait && !conf ? `<p class="vr-hint">${Math.max(0, 5 - (fails % 5))} essai${5 - (fails % 5) > 1 ? "s" : ""} avant une pause</p>` : ""}`;
  }
  return `${brand}
    <div class="vr-time st" style="--i:1"><b>${ck.t}</b><span>${esc(ck.d)}</span></div>
    <div class="vr-mid st" style="--i:2">
      <button class="vr-gbtn ${VR.busy ? "scan" : ""} ${VR.ok ? "ok" : ""}" id="vrGlyph" data-act="vrBio" aria-label="Déverrouiller ${esc(k.with)}">${vrGlyph()}</button>
      <div class="vr-h">${VR.ok ? `Bon retour${name ? ", " + esc(name) : ""}` : conf ? "Confirmez que c'est vous" : name ? `Bonjour ${esc(name)}` : "Verrouillé"}</div>
      <div class="vr-p" id="vrMsg">${VR.err ? `<span class="vr-err">${esc(VR.err)}</span>` : VR.busy ? (vrDemo() ? "Démo : Face ID simulé…" : "Regardez l'écran…") : conf ? esc(conf.why) : "Touchez pour déverrouiller"}</div>
    </div>
    <div class="vr-foot st" style="--i:3"><button class="vr-cta" data-act="vrBio">${ico(k.ic)}${esc(k.btn)}</button><div class="vr-row2"><button class="vr-link" data-act="vrUsePin">Utiliser le code</button>${cancel}</div></div>`;
}
function vrPaint() { const b = $("#vrBody"); if (b && VR.locked) b.innerHTML = vrLockHTML(); }
let vrClockT = 0, vrWaitT = 0;
function vrLock(boot, confirm) {
  if (VR.locked) return;
  const L = vrMount(); if (!boot) closeSheet(true);
  VR.locked = true; VR.confirm = confirm || null; VR.mode = vrBioOn() ? "main" : "pin"; VR.code = ""; VR.err = ""; VR.ok = false; VR.busy = false;
  vrPaint(); L.hidden = false; L.classList.remove("out"); void L.offsetWidth; L.classList.add("on");
  document.documentElement.classList.add("vr-locked");
  ["#app", "#tabbar", "#skip"].forEach((s) => { const e = $(s); if (e) e.setAttribute("inert", ""); });
  clearInterval(vrClockT); vrClockT = setInterval(() => { const t = $(".vr-time b"); if (t) t.textContent = vrClock().t; }, 15000);
  vrWaitTick();
  if (!boot && !confirm) SFX.sheet();
  /* ask for Face ID straight away when the page may (desktop browsers, Android). Safari wants a tap: then the screen waits for it. */
  if (VR.mode === "main" && !confirm && document.visibilityState === "visible") setTimeout(() => { if (VR.locked && VR.mode === "main" && !VR.busy) vrBioGo(true); }, boot ? 900 : 380);
}
function vrUnlock(silent) {
  const L = $("#vrLock"); const conf = VR.confirm;
  VR.locked = false; VR.confirm = null; VR.busy = false; VR.last = Date.now(); vrSeen(); clearInterval(vrClockT); clearInterval(vrWaitT);
  try { if (VR.abort) VR.abort.abort(); } catch (e) {} VR.abort = null;
  document.documentElement.classList.remove("vr-locked");
  const sh = $("#sheet").classList.contains("open"); ["#app", "#tabbar", "#skip"].forEach((s) => { const e = $(s); if (e && !sh) e.removeAttribute("inert"); });
  if (L) { L.classList.add("out"); L.classList.remove("on"); setTimeout(() => { if (!VR.locked) { L.hidden = true; L.classList.remove("out"); } }, silent ? 10 : 560); }
  if (conf && conf.ok) setTimeout(conf.ok, 120);
}
function vrWaitTick() {
  clearInterval(vrWaitT); if (!vrFailWait(vrCfg())) return;
  vrWaitT = setInterval(() => { const w = vrFailWait(vrCfg()); if (!w) { clearInterval(vrWaitT); vrPaint(); return; } const el = $("#vrWaitS"); if (el) el.textContent = w + " s"; }, 1000);
}
function vrSuccess() {
  VR.ok = true; VR.busy = false; VR.err = "";
  const g = $("#vrGlyph"); if (g) { g.classList.remove("scan"); g.classList.add("ok"); }
  const h = $(".vr-mid .vr-h"); const name = firstName((S.me && S.me.name) || ""); if (h && VR.mode === "main") h.textContent = VR.confirm ? "C'est bien vous" : `Bon retour${name ? ", " + name : ""}`;
  const m = $("#vrMsg"); if (m) m.textContent = "";
  SFX.init(); SFX.done(); buzz([8, 30, 8]);
  const c = vrCfg(); if (c && (c.fails || c.until)) { c.fails = 0; c.until = 0; vrSave(c); }
  setTimeout(() => vrUnlock(), VR.mode === "main" ? 620 : 260);
}
async function vrBioGo(auto) {
  const c = vrCfg(); if (!c || VR.busy || VR.ok || (auto && c.sim)) return;
  VR.busy = true; VR.err = "";
  const g = $("#vrGlyph"); if (g) { g.classList.remove("err", "ok"); void g.offsetWidth; g.classList.add("scan"); }
  const m = $("#vrMsg"); if (m) m.textContent = vrDemo() ? "Démo : Face ID simulé…" : "Regardez l'écran…";
  if (!auto) { SFX.init(); SFX.tap(); }
  if (c.sim) { setTimeout(() => { if (VR.locked) vrSuccess(); }, 1300); return; }
  try { await vrGet([c.cred]); if (VR.locked) vrSuccess(); }
  catch (e) {
    VR.busy = false; if (!VR.locked) return;
    const why = vrErr(e); const g2 = $("#vrGlyph"); if (g2) g2.classList.remove("scan");
    const m2 = $("#vrMsg");
    if (auto && why === "cancel") { if (m2) m2.textContent = "Touchez pour déverrouiller"; return; }
    if (g2) { g2.classList.add("err"); setTimeout(() => g2.classList.remove("err"), 600); }
    SFX.err(); buzz([30, 50, 30]);
    if (m2) m2.innerHTML = `<span class="vr-err">${why === "cancel" ? "Pas reconnu. Réessayez ou utilisez le code." : "Indisponible ici : utilisez le code."}</span>`;
  }
}
function vrPinDone() {
  const c = vrCfg(); if (!c) return; const code = VR.code;
  if (vrHash(c.pinSalt, code) === c.pinSha) { VR.ok = true; vrPaint(); vrSuccess(); return; }
  c.fails = (c.fails || 0) + 1; if (c.fails % 5 === 0) c.until = Date.now() + Math.min(15 * 60, 30 * Math.pow(2, c.fails / 5 - 1)) * 1000; vrSave(c);
  setTimeout(() => { VR.code = ""; VR.err = "Code incorrect"; SFX.err(); buzz([30, 50, 30]); vrPaint(); vrWaitTick(); }, 140);
}

/* ── when to lock ── */
/* sessionStorage survives a reload (auto-update) but not an app killed and relaunched */
const vrSeen = () => { try { sessionStorage.setItem("gg-vr-seen", String(Date.now())); } catch (e) {} };
const vrSeenAt = () => { try { return +(sessionStorage.getItem("gg-vr-seen") || 0); } catch (e) { return 0; } };
const vrDelayMs = () => { const c = vrCfg(); const d = c && c.delay != null ? +c.delay : 0; return d * 60000; };
/* screens left on for the brigade (kitchen display, big screen, time clock kiosk): nobody touches them, so no « untouched » lock */
const vrWatched = () => (typeof BIG !== "undefined" && BIG.on) || (typeof RH !== "undefined" && RH.kiosk) || ["cuisine", "service", "coupdefeu", "commandes", "salle"].includes(S.route);
const vrBlocked = () => !!$("#au.on") || S.route === "onboarding";
/* leaving on purpose for the app's own needs (photo from the camera or the gallery, Face ID sheet): not a « left the app » */
const vrPicking = () => VR.inSys || Date.now() < (VR.pickUntil || 0);
document.addEventListener("click", (e) => { const t = e.target; if (t && t.tagName === "INPUT" && t.type === "file") VR.pickUntil = Date.now() + 3 * 60000; }, true);
document.addEventListener("change", (e) => { const t = e.target; if (t && t.tagName === "INPUT" && t.type === "file") VR.pickUntil = Date.now() + 1500; }, true);
["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, () => { if (!VR.locked) { const n = Date.now(); if (n - VR.last > 20000) vrSeen(); VR.last = n; } }, { passive: true, capture: true }));
/* the app left the screen: home button, swipe to another app, app switcher, screen off */
function vrLeave() {
  if (!vrOn() || vrBlocked()) return;
  if (!VR.hiddenAt) VR.hiddenAt = Date.now();
  if (VR.locked) { try { if (VR.abort && !VR.busy) VR.abort.abort(); } catch (e) {} return; }
  /* « Dès que je quitte »: lock now, so the app switcher already shows the lock and not the accounts */
  if (vrDelayMs() === 0 && !vrPicking()) vrLock(false);
}
/* back on screen. iOS does not always say it left (the page is just frozen): a gap in the heartbeat counts as « left » too */
function vrBack(gap) {
  if (!vrOn() || vrBlocked()) { VR.hiddenAt = 0; return; }
  const away = VR.hiddenAt ? Date.now() - VR.hiddenAt : gap || 0; const left = !!VR.hiddenAt || (gap || 0) > 2500;
  VR.hiddenAt = 0;
  if (!VR.locked && left) {
    if (vrPicking()) { if (!VR.inSys) VR.pickUntil = Date.now() + 1500; }
    else if (vrDelayMs() === 0 || away > vrDelayMs()) vrLock(false);
  }
  if (VR.locked && VR.mode === "main" && !VR.busy && !VR.confirm) setTimeout(() => { if (VR.locked && VR.mode === "main" && !VR.busy && document.visibilityState === "visible") vrBioGo(true); }, 450);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") vrLeave(); else vrBack(); });
window.addEventListener("pagehide", vrLeave);
window.addEventListener("pageshow", (e) => { if (e.persisted) { VR.hiddenAt = VR.hiddenAt || Date.now() - 60000; vrBack(); } });
document.addEventListener("freeze", vrLeave);
document.addEventListener("resume", () => vrBack());
/* heartbeat: JavaScript stops while the app is in the background, so a jump of more than 2.5 s means it was away */
VR.beat = Date.now();
setInterval(() => {
  const n = Date.now(), gap = n - VR.beat; VR.beat = n;
  if (document.visibilityState !== "visible") return;
  if (gap > 2500 && !VR.locked) vrBack(gap);
  if (!VR.locked && vrOn() && n - vrSeenAt() > 4000) vrSeen();
}, 1000);
setInterval(() => {
  if (!vrOn() || VR.locked || vrBlocked() || document.visibilityState !== "visible" || vrWatched()) return;
  const lim = Math.max(vrDelayMs(), 5 * 60000); if (Date.now() - VR.last > lim) vrLock(false);
}, 5000);
const vrFinish0 = finishBoot;
finishBoot = function () {
  /* settings saved before « Dès que je quitte » became the default (2026-11-07) move to it */
  try { const c = vrCfg(); if (c && c.pinSha && !c.v) { c.v = 2; if (c.delay === 5) c.delay = 0; vrSave(c); } } catch (e) {}
  /* every opening is locked, except a reload of an app that was on screen a few seconds ago (automatic update) */
  try { if (vrOn() && !vrBlocked() && Date.now() - vrSeenAt() > Math.max(vrDelayMs(), 8000)) vrLock(true); else if (vrOn()) vrSeen(); } catch (e) { console.warn(e); }
  return vrFinish0.apply(this, arguments);
};
/* tests */
function vrUnlockTest() { if (VR.locked) vrUnlock(true); return true; }

/* keyboard: digits on the lock (desktop), Escape cancels a confirmation */
document.addEventListener("keydown", (e) => {
  if (VR.locked && (VR.mode === "pin" || !vrBioOn())) { if (/^[0-9]$/.test(e.key)) { e.preventDefault(); ACT.vrKey(null, null, e.key); return; } if (e.key === "Backspace") { e.preventDefault(); ACT.vrKey(null, null, "del"); return; } }
  if (VR.locked && VR.confirm && e.key === "Escape") { e.preventDefault(); ACT.vrConfirmCancel(); return; }
  if (VR.locked && e.key === "Enter" && VR.mode === "main") { e.preventDefault(); vrBioGo(false); return; }
  const sb = $("#sheetBody .vr-sheetpin"); if (sb && $("#sheet").classList.contains("open")) { if (/^[0-9]$/.test(e.key)) { e.preventDefault(); ACT.vrSKey(null, null, e.key); } else if (e.key === "Backspace") { e.preventDefault(); ACT.vrSKey(null, null, "del"); } }
}, true);

/* ═════════════ local mode: Face ID on the profile lock of compte.js ═════════════ */
if (typeof ccWhoHTML === "function") {
  const vrWho0 = ccWhoHTML;
  ccWhoHTML = function () {
    const h = vrWho0.apply(this, arguments);
    if (!CC.who || CC.who.mode !== "lock" || !vrLocalCreds().length || !vrSupported()) return h;
    const k = vrKind(); const one = vrLocalCreds().length === 1 ? ccMember(vrLocalCreds()[0].memberId) : null;
    return h + `<div class="vr-ccbar"><button class="vr-ccbio" data-act="vrCcBio">${vrGlyph("sm")}<span><b>${esc(k.t)}</b><em>${one ? esc(firstName(one.name)) + " · sans code" : "Sans taper de code"}</em></span></button></div>`;
  };
}
if (typeof ccLock === "function") {
  const vrCc0 = ccLock;
  ccLock = function (boot) {
    const r = vrCc0.apply(this, arguments);
    if (CC.locked && vrLocalCreds().length && vrSupported() && document.visibilityState === "visible") setTimeout(() => { if (CC.locked) ACT.vrCcBio(null, null, "auto"); }, boot ? 1000 : 400);
    return r;
  };
}

/* ═════════════ Réglages row + screen ═════════════ */
function vrRow() {
  const k = vrKind();
  if (vrLocal()) {
    if (!ccMember(S.me.id)) return "";
    const on = !!vrCfg(); return `<div class="li tap" data-go="verrou"><span class="ic w-vi vr-rowic">${ico(k.ic)}</span><div class="tx"><b>${esc(k.t)}</b><em>${on ? "Votre profil s'ouvre sans code" : "Ouvrir votre profil sans taper de code"}</em></div>${on ? `<span class="pill acc">Activé</span>` : ico("chev")}</div>`;
  }
  const c = vrCfg(); const on = vrOn();
  return `<div class="li tap" data-go="verrou"><span class="ic w-vi vr-rowic">${ico(k.ic)}</span><div class="tx"><b>Verrouiller avec ${esc(k.t)}</b><em>${on ? (vrBioOn() ? `${esc(k.t)} · ${VR_DELAYS.find((d) => d[0] === (c.delay ?? 0))?.[1].toLowerCase() || ""}` : "Avec un code") : "Personne n'ouvre l'app à votre place"}</em></div>${on ? `<span class="pill acc">${vrDelayTx(c.delay ?? 0)}</span>` : ico("chev")}</div>`;
}
TAB_OF.verrou = "more";
VIEWS.verrou = {
  nav: "reglages", live: false,
  /* asked again on each visit: Face ID may have been switched on in the phone's settings meanwhile */
  after() { const was = vrAvail; if (!vrSupported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return; PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then((v) => { vrAvail = !!v; if (vrAvail !== was && S.route === "verrou") rerender(); }).catch(() => {}); },
  render() {
    const k = vrKind(); const av = vrAvail; const demo = vrDemo(); const local = vrLocal();
    const on = local ? !!vrCfg() : vrOn(); const c = vrCfg() || {}; const bio = vrBioOn();
    const canBio = demo || av === true;
    const hero = `<div class="vr-hero wall st" style="--i:1"><div class="vr-hsky" aria-hidden="true"><i></i><i></i></div>
      <div class="vr-hg ${on ? "on" : ""}">${vrGlyph(on ? "done" : "idle")}</div>
      <div class="vr-ht"><b>${local ? `${esc(k.t)} pour votre profil` : `Verrouiller avec ${esc(k.t)}`}</b>
      <span>${local ? "Sur cet appareil, votre profil s'ouvre d'un regard ou d'un doigt, sans taper votre code." : `Si quelqu'un prend votre ${esc(k.dev)}, il tombe sur l'écran verrouillé. Vous, ${k.face ? "un regard suffit" : "un doigt suffit"}.`}</span></div></div>`;
    const demoNote = demo ? `<div class="banner st" style="--i:2">${ico("sparkle")}<span>Démo : ${esc(k.t)} est simulé ici et rien n'est enregistré. Dans votre compte, c'est le vrai ${esc(k.t)}.</span></div>` : "";
    const noBio = !canBio && av === false ? `<div class="banner st" style="--i:2">${ico("alert")}<span>${vrSupported() ? `${esc(k.t)} n'est pas réglé sur cet appareil. Activez-le dans les réglages du ${esc(k.dev)}, ou verrouillez avec un code.` : "Ce navigateur ne permet pas la biométrie. Le verrouillage par code fonctionne quand même."}</span></div>` : "";
    let body = "";
    if (local) {
      if (!ccHasPin(ccMember(S.me.id))) body = `<div class="glass pad st" style="--i:3"><p class="sub" style="margin:0 0 12px">Créez d'abord votre code personnel : ${esc(k.t)} vient en plus, pour aller plus vite.</p><button class="btn acc block" data-act="ccPinChange">${ico("lock")}Créer mon code</button></div>`;
      else if (!on) body = `<div class="ctabar st" style="--i:3"><button class="btn acc block" data-act="vrEnable" ${canBio ? "" : "disabled"}>${ico(k.ic)}Activer ${esc(k.t)}</button></div>`;
      else body = `<div class="glass pad st" style="--i:3">
        <div class="li"><span class="ic w-mi">${ico("check")}</span><div class="tx"><b>${esc(k.t)} activé</b><em>Depuis le ${shortDate(dayKey(new Date(c.at || Date.now())))} · votre code marche toujours</em></div></div>
        <div class="li tap" data-act="ccAutoLockSheet"><span class="ic w-nd">${ico("clock")}</span><div class="tx"><b>Quand verrouiller</b><em>Réglé avec le code à l'ouverture</em></div>${ico("chev")}</div>
        <div class="li tap" data-act="vrOff"><span class="ic bad">${ico("x")}</span><div class="tx"><b style="color:var(--bad)">Retirer ${esc(k.t)}</b><em>Le code reste demandé</em></div>${ico("chev")}</div></div>`;
    } else if (!on) {
      body = `<div class="vr-steps st" style="--i:3">
          <div><span class="vr-n">1</span><span>${canBio ? `Vous validez avec ${esc(k.t)}` : "Vous choisissez un code"}</span></div>
          <div><span class="vr-n">2</span><span>${canBio ? `Vous choisissez un code de secours (${VR_DIGITS} chiffres)` : `${VR_DIGITS} chiffres, rien que pour cet appareil`}</span></div>
          <div><span class="vr-n">3</span><span>L'app se verrouille quand vous la quittez</span></div></div>
        <div class="ctabar st" style="--i:4">${canBio ? `<button class="btn acc block" data-act="vrEnable">${ico(k.ic)}Activer ${esc(k.t)}</button>` : `<button class="btn acc block" data-act="vrEnablePin" ${av === null ? "disabled" : ""}>${ico("lock")}Verrouiller avec un code</button>`}</div>`;
    } else {
      const d = c.delay ?? 0;
      body = `<div class="lbl st cc-sec" style="--i:3">Verrouiller</div>
        <div class="glass pad st vr-delays" style="--i:3">${VR_DELAYS.map(([v, t]) => `<button class="chip cc-opt-row ${d === v ? "on" : ""}" data-act="vrDelay" data-v="${v}">${t}${v === 0 ? `<span class="vr-adv">conseillé</span>` : ""}${d === v ? ico("check") : ""}</button>`).join("")}
          <p class="note" style="margin:6px 2px 0">L'app est toujours verrouillée quand on la rouvre. Les écrans cuisine restent allumés tant qu'on ne quitte pas l'app.</p></div>
        <div class="lbl st cc-sec" style="--i:4">Déverrouillage</div>
        <div class="glass pad st" style="--i:4">
          ${canBio || bio ? `<div class="li tap" data-act="vrBioToggle" role="switch" aria-checked="${bio}"><span class="ic w-vi">${ico(k.ic)}</span><div class="tx"><b>${esc(k.t)}</b><em>${bio ? "Activé sur cet appareil" : "Coupé : seul le code ouvre l'app"}</em></div>${ccSw(bio)}</div>` : ""}
          <div class="li tap" data-act="vrPinChange"><span class="ic w-in">${ico("lock")}</span><div class="tx"><b>Changer le code</b><em>${VR_DIGITS} chiffres</em></div>${ico("chev")}</div>
          <div class="li tap" data-act="vrLockNow"><span class="ic w-sa">${ico("lock")}</span><div class="tx"><b>Verrouiller maintenant</b><em>Pour voir l'écran de verrouillage</em></div>${ico("chev")}</div>
          <div class="li tap" data-act="vrOff"><span class="ic bad">${ico("x")}</span><div class="tx"><b style="color:var(--bad)">Désactiver le verrouillage</b><em>Après confirmation</em></div>${ico("chev")}</div>
        </div>`;
    }
    const facts = `<div class="vr-facts st" style="--i:5">
      <div><span class="ic w-mi">${ico("shield")}</span><p><b>Votre ${k.face ? "visage" : "empreinte"} reste dans le ${esc(k.dev)}.</b> Growth Gusto reçoit seulement « c'est bien la personne ».</p></div>
      <div><span class="ic w-sk">${ico("download")}</span><p><b>Marche aussi depuis l'écran d'accueil,</b> sans application à télécharger.</p></div>
      <div><span class="ic w-sa">${ico("users")}</span><p><b>Chaque appareil a son réglage.</b> Le téléphone d'un équipier n'est pas touché.</p></div></div>`;
    return `<div class="inner cc-wide vr-page">${topBar(local ? esc(k.t) : "Verrouillage")}${hero}${demoNote}${noBio}${body}${facts}</div>`;
  },
};

/* ── setup: Face ID first (it needs the tap), then the backup code in a sheet ── */
function vrSheetPinHTML() {
  const st = VR.sheetStep; const title = st === "confirm" ? "Confirmez le code" : VR.setup && VR.setup.change ? "Nouveau code" : "Code de secours";
  const sub = VR.sheetErr ? `<span class="vr-err">${esc(VR.sheetErr)}</span>` : st === "confirm" ? "Tapez-le une seconde fois" : VR.setup && VR.setup.cred ? `Si ${esc(vrKind().t)} ne vous reconnaît pas. ${VR_DIGITS} chiffres.` : `${VR_DIGITS} chiffres, rien que pour cet appareil`;
  return `<div class="vr-sheetpin" data-step="${st}"><div class="vr-sp-top">${VR.setup && VR.setup.cred ? `<span class="vr-sp-ok">${vrGlyph("done sm")}</span>` : `<span class="ic w-in">${ico("lock")}</span>`}<div class="h2">${title}</div><div class="sub">${sub}</div></div>
    ${vrDots(VR.sheetCode.length, (VR.sheetErr ? "err shake " : "") + "light")}${vrPad("vrSKey", false)}<button class="btn ghost block" data-act="vrSetupCancel">Annuler</button></div>`;
}
function vrSheetPaint() { const b = $("#sheetBody .vr-sheetpin"); if (b) b.outerHTML = vrSheetPinHTML(); }
function vrOpenPinSheet(setup) { VR.setup = setup; VR.sheetCode = ""; VR.sheetFirst = ""; VR.sheetStep = "new"; VR.sheetErr = ""; openSheet(vrSheetPinHTML()); }
function vrSetupDone() {
  const s = VR.setup || {}; const prev = vrCfg() || {}; const salt = typeof ccSalt === "function" ? ccSalt() : String(Math.random()).slice(2);
  const cfg = { ...prev, pinSalt: salt, pinSha: vrHash(salt, VR.sheetFirst), fails: 0, until: 0 };
  if (!s.change) Object.assign(cfg, { cred: s.cred || null, sim: !!s.sim, delay: prev.delay ?? 0, v: 2, at: Date.now(), dev: vrKind().dev });
  vrSave(cfg); VR.setup = null; vrSeen(); VR.last = Date.now();
  $$(".vr-sheetpin .vr-dots").forEach((d) => d.classList.add("ok"));
  setTimeout(() => { closeSheet(true); SFX.done(); buzz([10, 30, 10]); if (!s.change) burst(); toast(s.change ? "Nouveau code enregistré" : `Verrouillage activé${cfg.cred || cfg.sim ? " · " + vrKind().t : ""}`); rerender(); }, 320);
}
/* demo: a short scan in a sheet instead of the system prompt */
function vrSimScan(then) {
  const k = vrKind();
  openSheet(`<div class="vr-simsheet"><button class="vr-gbtn scan light" id="vrSimG" aria-hidden="true" tabindex="-1">${vrGlyph()}</button><div class="h2">${esc(k.t)}</div><p class="sub">Démo : sur votre ${esc(k.dev)}, c'est la vraie fenêtre ${esc(k.t)} qui s'ouvre ici.</p></div>`);
  setTimeout(() => { const g = $("#vrSimG"); if (g) { g.classList.remove("scan"); g.classList.add("ok"); } SFX.ok(); buzz(8); }, 1200);
  setTimeout(then, 1800);
}

Object.assign(ACT, {
  vrBio: () => vrBioGo(false),
  vrUsePin: () => { SFX.tap(); try { if (VR.abort) VR.abort.abort(); } catch (e) {} VR.busy = false; VR.mode = "pin"; VR.code = ""; VR.err = ""; vrPaint(); vrWaitTick(); },
  vrBackMain: () => { SFX.tap(); VR.mode = "main"; VR.code = ""; VR.err = ""; vrPaint(); },
  vrForgot: () => { SFX.tap(); VR.mode = "forgot"; vrPaint(); },
  vrForgotOk: () => { if (vrDemo()) { VR.demo = null; vrUnlock(true); if (typeof AUTH !== "undefined") AUTH.signOut(); return; } vrSave(null); if (typeof AUTH !== "undefined" && AUTH.signOut) AUTH.signOut(); else location.reload(); },
  vrKey: (a, id, v) => {
    if (!VR.locked || VR.ok || vrFailWait(vrCfg())) return;
    SFX.init(); SFX.tick(); buzz(4);
    if (v === "del") { VR.code = VR.code.slice(0, -1); VR.err = ""; vrPaint(); return; }
    if (VR.code.length >= VR_DIGITS) return; VR.code += v; VR.err = "";
    const d = $(".vr-dots"); if (d) d.outerHTML = vrDots(VR.code.length); else vrPaint();
    const p = $(".vr-pinbox .vr-p"); if (p && VR.code.length === 1) p.textContent = VR.confirm ? VR.confirm.why : `Tapez votre code à ${VR_DIGITS} chiffres`;
    if (VR.code.length === VR_DIGITS) vrPinDone();
  },
  vrConfirmCancel: () => { SFX.close(); VR.confirm = null; vrUnlock(); },
  vrLockNow: () => { if (!vrOn()) return; buzz(6); vrLock(false); },
  vrEnable: async () => {
    const k = vrKind(); SFX.init(); SFX.tap();
    if (vrDemo()) { vrSimScan(() => vrOpenPinSheet({ sim: true })); return; }
    if (vrLocal()) {
      try { const cred = await vrCreate(); vrSave({ cred, at: Date.now(), dev: k.dev }); SFX.done(); buzz([10, 30, 10]); burst(); toast(`${k.t} activé pour ${firstName(S.me.name) || "votre profil"}`); rerender(); }
      catch (e) { const w = vrErr(e); SFX.err(); toast(w === "cancel" ? `${k.t} annulé, rien n'a changé` : `${k.t} indisponible sur cet appareil`, "err"); }
      return;
    }
    try { const cred = await vrCreate(); SFX.ok(); buzz(8); vrOpenPinSheet({ cred }); }
    catch (e) { const w = vrErr(e); SFX.err(); toast(w === "cancel" ? `${k.t} annulé, rien n'a changé` : `${k.t} indisponible ici : verrouillez avec un code`, "err"); if (w !== "cancel") { vrAvail = false; rerender(); } }
  },
  vrEnablePin: () => { SFX.tap(); vrOpenPinSheet({ cred: null }); },
  vrPinChange: () => { if (!vrOn()) return; vrLock(false, { why: "Votre code actuel ou " + vrKind().t, ok: () => vrOpenPinSheet({ change: true }) }); },
  vrSetupCancel: () => { VR.setup = null; closeSheet(); },
  vrSKey: (a, id, v) => {
    SFX.init(); SFX.tick(); buzz(4);
    if (v === "del") { VR.sheetCode = VR.sheetCode.slice(0, -1); VR.sheetErr = ""; vrSheetPaint(); return; }
    if (VR.sheetCode.length >= VR_DIGITS) return; VR.sheetCode += v; VR.sheetErr = ""; vrSheetPaint();
    if (VR.sheetCode.length < VR_DIGITS) return;
    const code = VR.sheetCode;
    if (VR.sheetStep === "new") {
      if (vrWeak(code)) { setTimeout(() => { VR.sheetCode = ""; VR.sheetErr = "Trop facile à deviner, choisissez-en un autre"; SFX.err(); buzz([30, 50, 30]); vrSheetPaint(); }, 140); return; }
      VR.sheetFirst = code; setTimeout(() => { VR.sheetCode = ""; VR.sheetStep = "confirm"; vrSheetPaint(); }, 160); return;
    }
    if (code !== VR.sheetFirst) { setTimeout(() => { VR.sheetCode = ""; VR.sheetFirst = ""; VR.sheetStep = "new"; VR.sheetErr = "Les deux codes sont différents, recommencez"; SFX.err(); buzz([30, 50, 30]); vrSheetPaint(); }, 140); return; }
    vrSetupDone();
  },
  vrDelay: (a, id, v) => { const c = vrCfg(); if (!c) return; c.delay = +v; vrSave(c); SFX.ok(); buzz(6); toast(+v ? `Verrouillé après ${vrDelayTx(+v)} sans l'app` : "Verrouillé dès que vous quittez l'app"); rerender(); },
  vrBioToggle: async () => {
    const c = vrCfg(); if (!c) return; const k = vrKind();
    if (c.cred || c.sim) { vrLock(false, { why: `Pour couper ${k.t}`, ok: () => { const c2 = vrCfg(); c2.cred = null; c2.sim = false; vrSave(c2); toast(`${k.t} coupé : le code ouvre l'app`); rerender(); } }); return; }
    if (vrDemo()) { vrSimScan(() => { c.sim = true; vrSave(c); closeSheet(true); SFX.done(); toast(`${k.t} activé`); rerender(); }); return; }
    try { c.cred = await vrCreate(); vrSave(c); SFX.done(); buzz([10, 30, 10]); toast(`${k.t} activé`); rerender(); }
    catch (e) { SFX.err(); toast(vrErr(e) === "cancel" ? `${k.t} annulé` : `${k.t} indisponible ici`, "err"); }
  },
  vrOff: () => {
    const k = vrKind();
    if (vrLocal()) { vrSave(null); SFX.close(); toast(`${k.t} retiré : votre code reste demandé`); rerender(); return; }
    if (!vrOn()) return;
    vrLock(false, { why: "Pour désactiver le verrouillage", ok: () => { vrSave(null); SFX.close(); toast("Verrouillage désactivé sur cet appareil"); rerender(); } });
  },
  /* local mode: Face ID on the profile lock */
  vrCcBio: async (a, id, v) => {
    const list = vrLocalCreds(); if (!list.length || VR.busy) return; const auto = v === "auto";
    const b = $(".vr-ccbio"); if (b) b.classList.add("scan"); VR.busy = true; if (!auto) { SFX.init(); SFX.tap(); }
    try {
      const got = await vrGet(list.map((x) => x.cred)); VR.busy = false;
      const hit = list.find((x) => x.cred === got); const m = hit && ccMember(hit.memberId);
      if (m && CC.locked) { if (b) { b.classList.remove("scan"); b.classList.add("ok"); } SFX.done(); setTimeout(() => ccSwitchTo(m), 380); }
    } catch (e) { VR.busy = false; if (b) b.classList.remove("scan"); if (!(auto && vrErr(e) === "cancel")) { SFX.err(); buzz([30, 50, 30]); if (b) { b.classList.add("err"); setTimeout(() => b.classList.remove("err"), 600); } } }
  },
});
