/* Growth Gusto — « Grand écran »: a service screen (coup de feu, écran cuisine, commandes, prise de commande, réservations)
   takes the whole screen: no left menu, no tab bar, content as wide as the screen, screen kept awake.
   Works everywhere, including the app added to the home screen: the menus are hidden by the app itself (html.gg-big), and where the
   browser allows it (computer, Android, iPad) the browser's own fullscreen hides its bars too. iPhone has no such API: the app mode alone.
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
  if (tap) { SFX.tap && SFX.tap(); toast(on ? "Grand écran : le même bouton vous ramène" : "Affichage normal"); }
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
