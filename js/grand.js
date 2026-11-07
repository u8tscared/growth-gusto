/* Growth Gusto — « Grand écran »: a service screen (coup de feu, écran cuisine, commandes, prise de commande, réservations)
   takes the whole screen: no left menu, no tab bar, content as wide as the screen, screen kept awake.
   Works everywhere, including the app added to the home screen: the menus are hidden by the app itself (html.gg-big), and where the
   browser allows it (computer, Android, iPad) the browser's own fullscreen hides its bars too. iPhone Safari has no such API (Apple allows it
   for videos only): there the app hides everything it can, tightens the screen, and explains once that Safari's own bars only go away in the
   app added to the home screen (bigTip), which really is full screen.
   Remembered per screen on this device, so a kitchen tablet reopens straight in grand écran. Esc or the same button leaves it.
   The button comes with topBar() (core.js) on every screen of BIG_ROUTES; coup de feu puts it in its own header (rush.js). */
Object.assign(IC, {
  bigIn: ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"],
  bigOut: ["M4 14h6v6", "M20 10h-6V4", "M14 10l7-7", "M3 21l7-7"],
});
const BIG_ROUTES = ["coupdefeu", "cuisine", "commandes", "salle", "resa"];
const BIG = { on: false, wake: null };
const bigKey = (r) => "gg-big-" + r;
const bigOk = (r = S.route) => BIG_ROUTES.includes(r);
const bigWanted = (r = S.route) => { try { return bigOk(r) && localStorage.getItem(bigKey(r)) === "1"; } catch (e) { return false; } };
function bigBtn(cls = "") {
  if (!bigOk()) return "";
  const on = BIG.on;
  return `<button class="btn soft sm gg-bigb${on ? " on" : ""}${cls ? " " + cls : ""}" data-act="bigTog" aria-pressed="${on}" title="${on ? "Revenir à l'affichage normal (Échap)" : "Afficher en grand écran, sans les menus"}">${ico(on ? "bigOut" : "bigIn")}<span>${on ? "Réduire" : "Grand écran"}</span></button>`;
}
/* can this browser hide its own bars? iPhone Safari: never (even when an old WebKit exposes the call, it only works on videos) */
const bigCanFs = () => { const de = document.documentElement; if (typeof IS_IOS !== "undefined" && IS_IOS && !IS_IPAD) return false; return !!(de.requestFullscreen || de.webkitRequestFullscreen) && document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false; };
const bigInApp = () => typeof isStandalone === "function" && isStandalone();
const bigFsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function bigFs(on) {
  const de = document.documentElement;
  try {
    if (on && !bigFsEl()) { const f = de.requestFullscreen || de.webkitRequestFullscreen; if (f) { const p = f.call(de, { navigationUI: "hide" }); if (p && p.catch) p.catch(() => {}); } }
    else if (!on && bigFsEl()) { const x = document.exitFullscreen || document.webkitExitFullscreen; if (x) { const p = x.call(document); if (p && p.catch) p.catch(() => {}); } }
  } catch (e) {}
}
async function bigWake(on) {
  try {
    if (on) { if (!("wakeLock" in navigator) || (BIG.wake && !BIG.wake.released)) return; BIG.wake = await navigator.wakeLock.request("screen"); }
    else if (BIG.wake) { await BIG.wake.release(); BIG.wake = null; }
  } catch (e) {}
}
/* apply the state without touching the browser fullscreen (that needs a tap) */
function bigApply(on) {
  on = !!on && bigOk();
  if (on === BIG.on) return false;
  BIG.on = on;
  const h = document.documentElement;
  h.classList.toggle("gg-big", on);
  h.classList.remove("gg-big-in"); void h.offsetWidth; h.classList.add("gg-big-in"); clearTimeout(BIG.t); BIG.t = setTimeout(() => h.classList.remove("gg-big-in"), 700);
  bigWake(on);
  return true;
}
function bigSet(on, { tap = false } = {}) {
  if (!bigOk()) return;
  try { localStorage.setItem(bigKey(S.route), on ? "1" : "0"); } catch (e) {}
  if (tap) bigFs(on);
  if (bigApply(on)) { renderChrome(); rerender(); }
  if (!tap) return;
  SFX.tap && SFX.tap();
  /* iPhone in Safari: the browser keeps its bars whatever a page does, so say it once, with the way to the real thing */
  if (on && !bigInApp() && !bigCanFs()) {
    let seen = false; try { seen = localStorage.getItem("gg-big-tip") === "1"; localStorage.setItem("gg-big-tip", "1"); } catch (e) {}
    if (!seen) { openSheet(bigTip()); return; }
    toast("Barres de Safari : ouvrez Gusto depuis l'écran d'accueil"); return;
  }
  toast(on ? "Grand écran : le même bouton vous ramène" : "Affichage normal");
}
function bigTip() {
  const step = (n, html) => `<li><span class="n mono">${n}</span><span>${html}</span></li>`;
  const menu = typeof IOS_MENU !== "undefined" && IOS_MENU;
  const steps = menu
    ? step(1, `Touchez <span class="key">${ico("dots").replace("<svg ", '<svg style="transform:rotate(90deg)" ')}</span> en bas, puis <b>Partager</b>`) + step(2, `Choisissez <span class="key">${ico("addsq")}</span> <b>Sur l'écran d'accueil</b>`) + step(3, `Laissez <b>Ouvrir comme app web</b> activé, puis <b>Ajouter</b>`)
    : step(1, `Touchez <span class="key">${ico("share")}</span> <b>Partager</b>`) + step(2, `Choisissez <span class="key">${ico("addsq")}</span> <b>Sur l'écran d'accueil</b>`);
  return `<div class="gg-tip"><div class="sl-shh"><span class="h2">Grand écran sur iPhone</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="gg-tip-ill" aria-hidden="true"><span class="gg-tip-ph"><i class="gg-tip-bar"></i><i class="gg-tip-sc"></i><i class="gg-tip-bar b"></i></span>${ico("bigIn")}<span class="gg-tip-ph full"><i class="gg-tip-sc"></i></span></div>
    <p class="gg-tip-p">C'est fait : les menus de Gusto sont cachés et l'écran est resserré. <b>Les barres de Safari, elles, restent</b> : Apple ne laisse aucun site les cacher sur iPhone.</p>
    <p class="gg-tip-p">Pour un vrai plein écran, ouvrez Gusto depuis l'écran d'accueil. C'est la même app, avec vos données, sans aucune barre :</p>
    <ol class="inst-steps">${steps}</ol>
    <button class="btn acc block gg-tip-ok" data-act="sheetClose">C'est noté</button></div>`;
}
Object.assign(ACT, {
  bigTog: () => bigSet(!BIG.on, { tap: true }),
  /* the older « plein écran » buttons (commande.js, salle.js) now open the same mode */
  cmFull: () => bigSet(!BIG.on, { tap: true }),
});
/* follow the route: entering a screen remembered in grand écran opens it; any other screen brings the menus back */
const bigChrome0 = renderChrome;
renderChrome = function () {
  /* going from one service screen to another (coup de feu → écran cuisine) stays in grand écran */
  if (BIG.on && bigOk()) { try { localStorage.setItem(bigKey(S.route), "1"); } catch (e) {} }
  const want = BIG.on && bigOk() ? true : bigWanted();
  if (want !== BIG.on) { bigApply(want); if (!want) bigFs(false); }
  return bigChrome0.apply(this, arguments);
};
/* Échap on a computer, or leaving the browser fullscreen with its own gesture, leaves grand écran too */
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && BIG.on && !bigFsEl() && !document.querySelector(".sheet.open") && !e.defaultPrevented) bigSet(false); }, true);
const bigFsChange = () => { if (!bigFsEl() && BIG.on && BIG.fsWas) bigSet(false); BIG.fsWas = !!bigFsEl(); };
document.addEventListener("fullscreenchange", bigFsChange); document.addEventListener("webkitfullscreenchange", bigFsChange);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && BIG.on) { BIG.wake = null; bigWake(true); } });
