/* Growth Gusto — area: mode sombre (apparence de l'app, par appareil). Prefix « th ».

   Choix par appareil (localStorage) :
     gg-theme      auto (comme le téléphone) · light · dark · soir (sombre de 19 h à 7 h)
     gg-theme-svc  "0" pour couper « écrans de service toujours sombres » (activé par défaut)
   html[data-theme] vaut toujours "light" ou "dark" (posé avant le premier affichage par le petit script du <head> d'index.html).

   Les écrans de service (écran cuisine, bar, coup de feu, et toute vue qui déclare VIEWS.x.dark = true) passent en sombre
   d'eux-mêmes quand « écrans de service toujours sombres » est activé : moins d'éblouissement en cuisine et en salle le soir.

   Le look sombre :
   1) css/sombre.css : les couleurs de la marque (crème, violet, safran) déclinées en version nuit + les retouches faites à la main.
   2) thPatch() ci-dessous : chaque feuille de style est parcourue une fois ; juste après chaque règle qui écrit une couleur claire
      « en dur » (#fff, crème…), une règle jumelle limitée à :where(html[data-theme=dark]) est insérée avec la couleur traduite
      (OKLCH : fonds clairs → surfaces prune, encres sombres → crème, bords crème → ombres). Même spécificité, juste après :
      l'ordre des règles ne change pas. Ainsi un nouvel écran ajouté par n'importe quel module a un mode sombre sans rien faire.
      Ne sont pas traduits : les sélecteurs qui contiennent .th-keep (aperçus d'impression, documents), @media print, @keyframes
      et les anciens blocs prefers-color-scheme. */
(function () {
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const MQ = (() => { try { return matchMedia("(prefers-color-scheme: dark)"); } catch (e) { return null; } })();
  const SVC_ROUTES = ["cuisine", "bar", "coupdefeu", "recette"];
  const TH = (window.TH = {
    pref: ["auto", "light", "dark", "soir"].includes(LS.get("gg-theme")) ? LS.get("gg-theme") : "auto",
    svc: LS.get("gg-theme-svc") !== "0",
    eff: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    patched: false,
  });
  const night = () => { const h = new Date().getHours(); return h >= 19 || h < 7; };
  const route = () => (typeof S !== "undefined" && S && S.route) || "";
  const svcRoute = (r) => SVC_ROUTES.includes(r) || !!(typeof VIEWS !== "undefined" && VIEWS[r] && VIEWS[r].dark === true);
  /* the look the person chose, before service screens */
  const prefDark = () => TH.pref === "dark" || (TH.pref === "auto" && !!(MQ && MQ.matches)) || (TH.pref === "soir" && night());
  const wanted = () => (TH.svc && svcRoute(route()) ? "dark" : prefDark() ? "dark" : "light");
  TH.svcNow = () => TH.svc && svcRoute(route());

  const M = window.THMAP;
  let nRules = 0;
  function walk(list, owner) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.type === 1) { /* CSSStyleRule */
        const t = M.twin(r.selectorText, r.style && r.style.cssText);
        if (t) { try { owner.insertRule(t, i + 1); i++; nRules++; } catch (e) {} }
      } else if (r.cssRules && r.type !== 7) { /* @media, @supports, @layer, @container — not @keyframes (7) */
        const cond = (r.conditionText || (r.media && r.media.mediaText) || "").toLowerCase();
        if (/print|prefers-color-scheme/.test(cond)) continue;
        walk(r.cssRules, r);
      }
    }
  }
  const done = new WeakSet();
  /* at deploy, tools/sombre.js already wrote the twin rules into css/*.css (and --th-built:1): nothing to do here.
     Opened from raw sources (tests, a copy of the repo), the same work is done once in the browser. */
  const built = () => { try { return getComputedStyle(document.documentElement).getPropertyValue("--th-built").trim() === "1"; } catch (e) { return false; } };
  function thPatch() {
    if (!TH.patched && built()) { TH.patched = true; TH.patchMs = 0; TH.patchRules = "build"; return; }
    if (!M) return;
    const t0 = performance.now();
    for (const sh of Array.from(document.styleSheets)) {
      if (done.has(sh)) continue;
      const own = sh.ownerNode; if (own && own.dataset && own.dataset.thKeep != null) { done.add(sh); continue; }
      if (sh.href && /sombre\.css/.test(sh.href)) { done.add(sh); continue; }
      let rules; try { rules = sh.cssRules; } catch (e) { done.add(sh); continue; } /* cross-origin (fonts) */
      if (!rules) continue;
      done.add(sh); walk(rules, sh);
    }
    TH.patched = true; TH.patchMs = Math.round(performance.now() - t0); TH.patchRules = nRules;
  }
  TH.patch = thPatch;

  /* ───────────── apply ───────────── */
  const META = { dark: "#120E20", light: "#FBF6EC" };
  function setMeta(eff) { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", META[eff]); }
  function apply(how) {
    const eff = wanted();
    if (eff === "dark") thPatch(); /* new stylesheets added since are patched too */
    if (eff === TH.eff && document.documentElement.dataset.theme === eff) return;
    const html = document.documentElement;
    const flip = () => { html.dataset.theme = eff; TH.eff = eff; setMeta(eff); try { document.dispatchEvent(new CustomEvent("gg-theme", { detail: { theme: eff } })); } catch (e) {} };
    const reduce = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
    if (how && how.x != null && document.startViewTransition && !reduce && !document.hidden) {
      /* the new look spreads from the finger, as a circle */
      const r = Math.hypot(Math.max(how.x, innerWidth - how.x), Math.max(how.y, innerHeight - how.y));
      html.style.setProperty("--thx", how.x + "px"); html.style.setProperty("--thy", how.y + "px"); html.style.setProperty("--thr", r + "px");
      html.classList.add("th-vt");
      try { const vt = document.startViewTransition(flip); vt.ready.catch(() => {}); vt.finished.catch(() => {}).finally(() => html.classList.remove("th-vt")); } catch (e) { flip(); html.classList.remove("th-vt"); }
    } else if (how && how.soft && !reduce) {
      html.classList.add("th-soft"); flip(); setTimeout(() => html.classList.remove("th-soft"), 520);
    } else flip();
  }
  TH.apply = apply;
  /* at load: the head script already set data-theme; patch now (stylesheets are loaded before this script runs) */
  if (wanted() === "dark") thPatch();
  setMeta(TH.eff);
  if (MQ) { const on = () => apply({ soft: 1 }); MQ.addEventListener ? MQ.addEventListener("change", on) : MQ.addListener && MQ.addListener(on); }
  setInterval(() => { if (TH.pref === "soir") apply({ soft: 1 }); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") apply(); });
  /* route changes: each new view is a <section data-route> in #viewport */
  const watchRoute = () => {
    const vp = document.getElementById("viewport"); if (!vp) return;
    let last = route();
    new MutationObserver(() => { const r = route(); if (r === last) return; last = r; apply({ soft: 1 }); }).observe(vp, { childList: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchRoute); else watchRoute();

  /* ───────────── UI ───────────── */
  const IC_TH = {
    thMoon: ["f:M20 14.6A8.3 8.3 0 0 1 9.4 4a8.3 8.3 0 1 0 10.6 10.6z", "M20 14.6A8.3 8.3 0 0 1 9.4 4a8.3 8.3 0 1 0 10.6 10.6z", "M17 3v3M15.5 4.5h3"],
    thSun: ["f:M12 7.8a4.2 4.2 0 1 0 0 8.4a4.2 4.2 0 1 0 0-8.4z", "c:12,12,4.2", "M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4"],
    thAuto: ["f:M12 3.5a8.5 8.5 0 0 0 0 17z", "c:12,12,8.5", "M12 3.5v17"],
  };
  const icoOk = () => typeof IC !== "undefined" && typeof ico === "function";
  const addIcons = () => { if (typeof IC === "undefined") return; Object.keys(IC_TH).forEach((k) => { if (!IC[k]) IC[k] = IC_TH[k]; }); };
  addIcons();
  const OPTS = [
    ["auto", "Automatique", "Comme le téléphone"],
    ["light", "Clair", "Toujours clair"],
    ["dark", "Sombre", "Toujours sombre"],
    ["soir", "Le soir", "Sombre de 19 h à 7 h"],
  ];
  const label = () => {
    const o = OPTS.find((x) => x[0] === TH.pref) || OPTS[0];
    const now = TH.eff === "dark" ? "sombre" : "clair";
    return TH.pref === "auto" || TH.pref === "soir" ? `${o[1]} · ${now} en ce moment` : o[1];
  };
  TH.label = label;
  const icFor = () => (TH.pref === "auto" ? "thAuto" : TH.eff === "dark" ? "thMoon" : "thSun");
  /* the « Réglages » row (Cet appareil) */
  window.thRow = () => icoOk() ? `<div class="li tap th-row" data-act="thSheet"><span class="ic w-vi">${ico(icFor())}</span><div class="tx"><b>Apparence</b><em>${esc(label())}</em></div>${ico("chev")}</div>` : "";
  /* a quick switch for service screens' top bar (cuisine, bar…): one tap, no menu */
  window.thTopBtn = () => {
    if (!icoOk() || !svcRoute(route())) return "";
    const d = TH.eff === "dark";
    return `<button class="iconbtn th-topbtn" data-act="thQuick" aria-label="${d ? "Passer en clair" : "Passer en sombre"}" title="${d ? "Passer en clair" : "Passer en sombre"}">${ico(d ? "thSun" : "thMoon")}</button>`;
  };
  const pv = (k) => `<span class="th-pv th-pv-${k}" aria-hidden="true"><span class="th-pv-s th-pv-l"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></span><span class="th-pv-s th-pv-n"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></span>${k === "soir" ? `<span class="th-pv-moon"></span><span class="th-pv-st"><i></i><i></i><i></i></span>` : ""}</span>`;
  const sheetHTML = () => `<div class="th-sheet">
      <div class="th-hd"><span class="ic w-vi">${ico("thMoon")}</span><div><div class="h2">Apparence</div><p class="sub">Sur cet appareil seulement. Chacun choisit le sien.</p></div></div>
      <div class="th-opts" role="radiogroup" aria-label="Apparence">${OPTS.map(([k, t, s]) => `<button class="th-opt ${TH.pref === k ? "on" : ""}" role="radio" aria-checked="${TH.pref === k}" data-act="thSet" data-v="${k}">${pv(k)}<b>${t}</b><em>${s}</em></button>`).join("")}</div>
      <div class="glass pad th-svc"><div class="li tap" data-act="thSvc" role="switch" aria-checked="${TH.svc}"><span class="ic w-in">${ico(typeof IC !== "undefined" && IC.slHat ? "slHat" : "thMoon")}</span><div class="tx"><b>Service toujours en sombre</b><em>Écran cuisine, bar et coup de feu, même en mode clair</em></div>${typeof ccSw === "function" ? ccSw(TH.svc) : ""}</div></div>
      <button class="btn acc block" data-act="sheetClose">${ico("check")}C'est bon</button>
    </div>`;
  const refreshSheet = () => {
    document.querySelectorAll(".th-opt").forEach((b) => { const on = b.dataset.v === TH.pref; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const sw = document.querySelector('.th-svc [data-act="thSvc"]'); if (sw) { sw.setAttribute("aria-checked", TH.svc); const s = sw.querySelector(".cc-sw"); s && s.classList.toggle("on", TH.svc); }
    document.querySelectorAll(".th-row em").forEach((e) => { e.textContent = label(); });
    document.querySelectorAll(".th-row .ic").forEach((e) => { e.innerHTML = ico(icFor()); });
    document.querySelectorAll(".th-seg button").forEach((b) => { const on = b.dataset.v === TH.pref; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    document.querySelectorAll(".th-topbtn").forEach((b) => { const d = TH.eff === "dark"; b.innerHTML = ico(d ? "thSun" : "thMoon"); b.setAttribute("aria-label", d ? "Passer en clair" : "Passer en sombre"); });
  };
  document.addEventListener("gg-theme", () => setTimeout(refreshSheet, 30));
  const tap = (e, el) => { const p = e && e.clientX != null && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : (() => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })(); return p; };
  const setPref = (v, e, el) => {
    if (!OPTS.some((o) => o[0] === v)) return;
    TH.pref = v; LS.set("gg-theme", v);
    try { SFX.tap(); buzz(6); } catch (x) {}
    apply(tap(e, el)); refreshSheet();
  };
  if (typeof ACT !== "undefined") Object.assign(ACT, {
    thSheet: () => { addIcons(); openSheet(sheetHTML()); },
    thSet: (a, id, v, e) => setPref(v, e, a),
    thSvc: (a) => { TH.svc = !TH.svc; LS.set("gg-theme-svc", TH.svc ? "1" : "0"); try { SFX.tap(); buzz(5); } catch (x) {} apply({ soft: 1 }); refreshSheet(); },
    /* service screens: flip this device between light and dark in one tap (it becomes the device's choice) */
    thQuick: (a, id, v, e) => {
      const toDark = TH.eff !== "dark";
      if (!toDark && TH.svcNow()) { TH.svc = false; LS.set("gg-theme-svc", "0"); }
      TH.pref = toDark ? "dark" : "light"; LS.set("gg-theme", TH.pref);
      try { SFX.tap(); buzz(6); } catch (x) {}
      apply(tap(e, a)); refreshSheet();
      try { toast(toDark ? "Mode sombre sur cet appareil" : "Mode clair sur cet appareil", "info"); } catch (x) {}
    },
  });

  /* Réglages › Cet appareil gets the « Apparence » row; Plus gets a quick 3-way switch under the profile */
  const wrap = () => {
    if (typeof VIEWS === "undefined") return;
    const R = VIEWS.reglages;
    if (R && R.render && !R._th) {
      const r0 = R.render; R._th = 1;
      R.render = function () {
        const h = r0.apply(this, arguments);
        const at = h.indexOf('data-act="ccHaptics"'); if (at < 0) return h + "";
        const end = h.indexOf('<div class="li', at + 10); const pos = end > 0 ? end : h.indexOf("</div>", at);
        return h.slice(0, pos) + thRow() + h.slice(pos);
      };
    }
    const M = VIEWS.more;
    if (M && M.render && !M._th) {
      const m0 = M.render; M._th = 1;
      M.render = function () {
        const h = m0.apply(this, arguments);
        const seg = `<div class="th-seg st" role="radiogroup" aria-label="Apparence" style="--i:1">${[["light", "thSun", "Clair"], ["auto", "thAuto", "Auto"], ["dark", "thMoon", "Sombre"]].map(([k, i, t]) => `<button class="${TH.pref === k ? "on" : ""}" role="radio" aria-checked="${TH.pref === k}" data-act="thSet" data-v="${k}">${ico(i)}<span>${t}</span></button>`).join("")}<button class="th-seg-more" data-act="thSheet" aria-label="Plus de choix d'apparence">${ico(typeof IC !== "undefined" && IC.dots ? "dots" : "chev")}</button></div>`;
        const i = h.indexOf('<div class="lbl st cc-sec"');
        return i > 0 ? h.slice(0, i) + seg + h.slice(i) : h;
      };
    }
  };
  wrap();
})();
