/* Growth Gusto — opening animation (css/intro.css). Loaded first, so it starts on the very first frame after the launch image.
   bootOut() (called by core.js finishBoot and auth.js when the sign-in screen shows) waits for the intro to end, then opens
   the screen from the tile like an iris. A tap skips the wait. Reduced motion: a short fade. */
(function () {
  var boot = document.getElementById("boot"); if (!boot || window.GG_OLD) { window.bootOut = function () { if (boot) boot.classList.add("out"); }; return; }
  var reduce = false; try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  /* a page opened in a background tab, or the screenshot tool for the launch images: no show */
  var quiet = document.visibilityState === "hidden" || /[?&]nointro\b/.test(location.search);
  var t0 = performance.now(), MIN = quiet ? 0 : reduce ? 500 : 1250, ready = false, gone = false;
  /* the name, one letter at a time */
  var wm = boot.querySelectorAll(".boot-wm .bw"), n = 0;
  for (var k = 0; k < wm.length; k++) { var w = wm[k], t = w.textContent; w.textContent = ""; for (var j = 0; j < t.length; j++) { var c = document.createElement("span"); c.className = "ch"; c.style.setProperty("--i", n++); c.textContent = t[j]; w.appendChild(c); } }
  if (!quiet) boot.classList.add("go");
  var ease = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  function finish() { boot.classList.add("gone"); boot.style.webkitMaskImage = boot.style.maskImage = ""; setTimeout(function () { document.documentElement.classList.remove("gg-enter"); }, 400); }
  function exit() {
    if (gone) return; gone = true;
    if (quiet || reduce || !("requestAnimationFrame" in window)) { boot.classList.add("out"); setTimeout(finish, 600); return; }
    var ic = document.getElementById("bootMark"), r0 = ic ? ic.getBoundingClientRect() : null, B = boot.getBoundingClientRect();
    var cx = r0 ? r0.left + r0.width / 2 - B.left : B.width / 2, cy = r0 ? r0.top + r0.height / 2 - B.top : B.height / 2;
    var far = Math.max(Math.hypot(cx, cy), Math.hypot(B.width - cx, cy), Math.hypot(cx, B.height - cy), Math.hypot(B.width - cx, B.height - cy)) + 80;
    boot.classList.add("gg-x", "out");
    var ring = document.getElementById("bootRing"), D = 760, start = 0;
    setTimeout(function () {
      document.documentElement.classList.add("gg-enter");
      function f(now) {
        if (!start) start = now; var p = Math.min(1, (now - start) / D), r = ease(p) * far;
        var m = "radial-gradient(circle at " + cx + "px " + cy + "px, transparent " + r + "px, #000 " + (r + 70) + "px)";
        boot.style.webkitMaskImage = m; boot.style.maskImage = m;
        if (ring) { var R = r + 34; ring.style.cssText = "left:" + cx + "px;top:" + cy + "px;width:" + 2 * R + "px;height:" + 2 * R + "px;margin:" + -R + "px 0 0 " + -R + "px;opacity:" + Math.max(0, .9 - p * 1.1); }
        if (p < 1) requestAnimationFrame(f); else finish();
      }
      requestAnimationFrame(f);
    }, 200);
  }
  window.bootOut = function (delay) {
    if (ready) return; ready = true;
    setTimeout(function () { var left = MIN - (performance.now() - t0); if (left > 0) setTimeout(exit, left); else exit(); }, delay || 0);
  };
  boot.addEventListener("pointerdown", function () { if (ready) exit(); });
  /* safety: never hold the app behind the intro */
  setTimeout(function () { if (!gone && ready) exit(); }, 4000);
})();
