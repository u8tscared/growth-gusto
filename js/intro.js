/* Growth Gusto — opening animation « L'élan » (css/intro.css). Loaded first, so it starts right after the violet launch image.
   The G draws itself, the arrow springs in; when the app is ready (bootOut(), called by core.js finishBoot and auth.js) the camera
   dives through the bowl of the G: the mark zooms around that point and the violet screen opens there onto the app.
   A tap skips the wait. Reduced motion: a short fade. ?nointro (tools/gen-splash.js): the plain violet frame. */
(function () {
  var boot = document.getElementById("boot"); if (!boot || window.GG_OLD) { window.bootOut = function () { if (boot) boot.classList.add("out"); }; return; }
  var reduce = false; try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var quiet = document.visibilityState === "hidden" || /[?&]nointro\b/.test(location.search);
  var t0 = performance.now(), MIN = quiet ? 0 : reduce ? 300 : 680, ready = false, gone = false;
  var mark = document.getElementById("bootMark");
  if (!quiet) boot.classList.add("go");
  var waitT = setTimeout(function () { if (!ready && !quiet && !reduce) boot.classList.add("wait"); }, 1400);
  function finish() { boot.classList.add("gone"); boot.style.webkitMaskImage = boot.style.maskImage = ""; setTimeout(function () { document.documentElement.classList.remove("gg-enter"); }, 700); }
  function exit() {
    if (gone) return; gone = true; clearTimeout(waitT); boot.classList.remove("wait");
    if (quiet || reduce || !mark || !mark.animate) { boot.classList.add("out"); setTimeout(finish, 450); return; }
    boot.classList.add("gg-x");
    var B = boot.getBoundingClientRect(), r0 = mark.getBoundingClientRect(), w = r0.width;
    /* the zoom point: inside the bowl of the G (45,45 of the 100-unit mark), the mark's transform-origin */
    var cx = r0.left - B.left + .45 * w, cy = r0.top - B.top + .45 * w, inner = .27 * w; /* inner edge of the G's stroke */
    var far = Math.max(Math.hypot(cx, cy), Math.hypot(B.width - cx, cy), Math.hypot(cx, B.height - cy), Math.hypot(B.width - cx, B.height - cy));
    var S = Math.max(14, far / inner * 1.25), T = "translate(-50%,-50%) ";
    var a = mark.animate([{ transform: T + "scale(1)" }, { transform: T + "scale(.9)", offset: .2, easing: "cubic-bezier(.5,0,.85,.4)" }, { transform: T + "scale(" + S + ")" }], { duration: 560, easing: "linear", fill: "forwards" });
    var app = false;
    (function f() {
      var m = getComputedStyle(mark).transform, sc = 1, v = m && m !== "none" ? m.match(/matrix\(([^,]+)/) : null; if (v) sc = parseFloat(v[1]);
      if (sc > 1.2) {
        if (!app) { app = true; document.documentElement.classList.add("gg-enter"); }
        var r = inner * sc * .98, k = "radial-gradient(circle at " + cx + "px " + cy + "px, transparent " + r + "px, #000 " + (r + 1) + "px)";
        boot.style.webkitMaskImage = k; boot.style.maskImage = k;
      }
      if (a.playState !== "finished") requestAnimationFrame(f); else finish();
    })();
  }
  window.bootOut = function (delay) {
    if (ready) return; ready = true;
    setTimeout(function () { var left = MIN - (performance.now() - t0); if (left > 0) setTimeout(exit, left); else exit(); }, Math.min(delay || 0, 120));
  };
  boot.addEventListener("pointerdown", function () { if (ready) exit(); });
  setTimeout(function () { if (!gone && ready) exit(); }, 3000);
})();
