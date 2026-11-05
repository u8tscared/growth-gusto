/* ═══════════════════════════ Growth Gusto · visite guidée (coach marks) ═══════════════════════════
   A short tour of the real app, right after the onboarding: a cream card on a soft ink scrim, a spotlight cut out around
   the element it talks about. 6–8 stops, one sentence each, always skippable.
   Public:
     window.TOUR.start()   → opens the tour (goes to Accueil first, closes any sheet)
     window.TOUR.done()    → ends it and remembers it for this user on this device
     window.TOUR.seen()    → true once finished or skipped
     ACT.tourStart         → data-act="tourStart" (« Revoir la visite guidée » in Réglages / Plus)
   Trigger: window event "gg:onboarded" (fired when the onboarding closes) → starts once the Accueil is on screen,
   once per user per device (localStorage gg-tour-<uid | local>). Never auto-starts in the demo.
   Any error ends the tour silently: it must never block the app. */
(function () {
  const TR = { on: false, i: 0, list: [], root: null, raf: 0, last: "", wait: 0, prevFocus: null, inerted: [] };
  const RM = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const desk = () => { try { return typeof DESK_MQ === "object" && DESK_MQ ? DESK_MQ.matches : innerWidth >= 960; } catch (e) { return innerWidth >= 960; } };
  const isDemo = () => { try { return typeof DB === "object" && DB.mode === "demo"; } catch (e) { return false; } };
  const key = () => { let u = ""; try { u = (typeof DB === "object" && DB.uid) || ""; } catch (e) {} return "gg-tour-" + (u || "local"); };
  const seen = () => { try { return !!localStorage.getItem(key()); } catch (e) { return false; } };
  const q = (s, r) => (r || document).querySelector(s);
  const view = () => q("#viewport .view:not(.leave)") || q("#viewport .view");
  const ic = (n) => { try { return typeof ico === "function" ? ico(n) : ""; } catch (e) { return ""; } };
  const sfx = (k) => { try { SFX[k] && SFX[k](); } catch (e) {} };
  const shown = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity !== 0; };
  const tabs = () => { const tb = q("#tabbar"); return !desk() && tb && !tb.classList.contains("hide") ? tb : null; };
  const side = () => { const s = q("#side"); return desk() && s && !s.classList.contains("off") ? s : null; };

  /* a sidebar line (computer only) · a module that exists in this build and is allowed for this person · an icon or its fallback */
  const nav = (r) => { const s = side(); return s ? q(`.nav[data-go="${r}"]`, s) : null; };
  const has = (r) => { try { return !!(typeof VIEWS === "object" && VIEWS[r]) && (typeof permOk !== "function" || permOk(r)); } catch (e) { return false; } };
  const IC_OR = (a, b) => { try { return typeof IC === "object" && IC[a] ? a : b; } catch (e) { return b; } };
  /* the stops: el() finds the target right now (the home re-renders on every data change, so never keep a node) */
  const STOPS = [
    { k: "hero", ic: "therm", t: "Le relevé", s: "Midi et soir, relevez vos frigos ici. Dix secondes chacun.", el: () => q(".hm-hero", view()) },
    { k: "qa", ic: "sparkle", t: "Actions rapides", s: "Réception, scanner, ménage : un geste et c'est parti.", el: () => q(".hm-qa", view()) },
    { k: "todo", ic: "list", t: "À faire maintenant", s: "Les urgences du moment, dans l'ordre. Commencez par le haut.", el: () => q(".hm-todo", view()) },
    { k: "scan", ic: "scan", t: "Le scanner", s: "Étiquette ou QR : scannez, le produit s'ouvre aussitôt.", el: () => { const t = tabs(); if (t) return q('[data-tab="scan"] .fab', t) || q('[data-tab="scan"]', t); const s = side(); return s && q('.nav[data-go="scan"]', s); } },
    { k: "frigos", ic: "snow", t: "Vos frigos", s: "Chaque frigo, ses produits et leurs DLC, d'un coup d'œil.", el: () => { const t = tabs(); if (t) return q('[data-tab="frigos"]', t); const s = side(); return s && q('.nav[data-go="frigos"]', s); } },
    /* one module = one exact item: the Plus tab on a phone, the Finances line of the sidebar on a computer (never the whole list) */
    { k: "plus", ic: "grid", t: "Tout le reste", s: () => `${has("hygiene") ? "Hygiène, " : ""}${has("alertes") ? "alertes, " : ""}${has("controle") ? "contrôle sanitaire, " : ""}recettes, équipe : tout est dans Plus.`.replace(/^./, (c) => c.toUpperCase()), el: () => { const t = tabs(); return t ? q('[data-tab="more"]', t) : null; } },
    /* computer: the new modules, one sidebar line each */
    { k: "hygiene", ic: IC_OR("hygPot", "spray"), t: "L'hygiène", s: "Refroidissement, friture, gaspillage et vos documents.", el: () => nav("hygiene") },
    { k: "finance", ic: "euro", t: "Vos finances", s: "Achats, coûts et résultat du mois, au même endroit.", el: () => nav("finance") },
    { k: "controle", ic: IC_OR("ctBadge", "shield"), t: "Le contrôle sanitaire", s: "Un inspecteur passe ? Tout son dossier est prêt ici.", el: () => nav("controle") },
    { k: "alertes", ic: IC_OR("alBell", "alert"), t: "Les alertes", s: "Un frigo chauffe, une DLC tombe : vous êtes prévenu.", el: () => nav("alertes") },
    { k: "registre", ic: "shield", t: "Le registre", s: () => desk() ? "Tout est daté et signé. Prêt pour le contrôle sanitaire." : "Chaque geste est daté et signé : prêt pour le contrôle sanitaire.", el: () => { const s = side(); if (s) return has("controle") ? null : q('.nav[data-go="registre"]', s); return q(".hm-feedc", view()); } },
    { k: "end", ic: "therm", t: "Vous êtes prêt", s: "Commencez par votre premier relevé. Le reste suivra.", end: true },
  ];
  const txt = (v) => (typeof v === "function" ? v() : v);

  /* ── DOM ── */
  function build() {
    const r = document.createElement("div");
    r.className = "gt" + (RM() ? " rm" : "");
    r.setAttribute("role", "dialog"); r.setAttribute("aria-modal", "true"); r.setAttribute("aria-labelledby", "gtT"); r.setAttribute("aria-describedby", "gtS");
    r.innerHTML = `<div class="gt-catch"></div><div class="gt-spot" aria-hidden="true"></div>
      <div class="gt-card" tabindex="-1"><i class="gt-notch" aria-hidden="true"></i>
        <div class="gt-top"><span class="gt-n mono"></span><button type="button" class="gt-skip" data-gt="skip">Passer la visite</button></div>
        <div class="gt-body"></div>
        <div class="gt-foot"><div class="gt-dots" aria-hidden="true"></div><div class="gt-btns"><button type="button" class="gt-b gt-back" data-gt="back">Retour</button><button type="button" class="gt-b gt-next" data-gt="next"></button></div></div>
      </div>`;
    r.addEventListener("click", onClick);
    /* the touch scroll guard in core never sees these taps as « after a scroll » */
    ["touchstart", "touchmove", "pointerdown", "wheel"].forEach((ev) => r.addEventListener(ev, (e) => { if (!e.target.closest(".gt-card")) e.stopPropagation(); if (ev === "touchmove" || ev === "wheel") { if (!e.target.closest(".gt-card")) e.preventDefault(); } }, { passive: false }));
    document.body.appendChild(r);
    return r;
  }
  function onClick(e) {
    try {
      e.stopPropagation();
      const b = e.target.closest("[data-gt]");
      if (!b) { if (!e.target.closest(".gt-card")) nudge(); return; }
      const a = b.dataset.gt;
      if (a === "skip") return finish("skip");
      if (a === "back") return step(-1);
      if (a === "next") return step(1);
      if (a === "go") return finish("go");
      if (a === "close") return finish("end");
    } catch (err) { kill(); }
  }
  /* a tap on the scrim does nothing but a little shake of the card: nothing is lost */
  function nudge() { const c = q(".gt-card", TR.root); if (!c || RM()) return; c.classList.remove("nudge"); void c.offsetWidth; c.classList.add("nudge"); sfx("tick"); }
  function onKey(e) {
    if (!TR.on) return;
    try {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return finish("skip"); }
      if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); return TR.list[TR.i] && TR.list[TR.i].end ? null : step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); return step(-1); }
      if (e.key === "Tab") { /* focus stays in the card */
        const f = [...TR.root.querySelectorAll(".gt-card button:not([hidden])")].filter((b) => b.offsetParent !== null); if (!f.length) return;
        const i = f.indexOf(document.activeElement); e.preventDefault(); (f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length] || f[0]).focus();
      }
    } catch (err) { kill(); }
  }

  /* ── one stop ── */
  function render(dir) {
    const s = TR.list[TR.i]; if (!s) return finish("end");
    const card = q(".gt-card", TR.root), body = q(".gt-body", TR.root), n = TR.list.length;
    TR.root.classList.toggle("fin", !!s.end);
    q(".gt-n", TR.root).textContent = s.end ? "" : `${TR.i + 1} sur ${n - 1}`;
    q(".gt-skip", TR.root).hidden = !!s.end;
    q(".gt-dots", TR.root).innerHTML = TR.list.map((_, k) => `<i class="${k === TR.i ? "on" : k < TR.i ? "past" : ""}"></i>`).join("");
    const back = q(".gt-back", TR.root), next = q(".gt-next", TR.root);
    back.hidden = TR.i === 0 && !s.end; back.textContent = s.end ? "Terminer" : "Retour"; back.dataset.gt = s.end ? "close" : "back";
    next.innerHTML = s.end ? `<span>Faire mon premier relevé</span>${ic("arrow")}` : "Suivant";
    next.dataset.gt = s.end ? "go" : "next";
    body.innerHTML = `${s.end ? `<span class="gt-hero" aria-hidden="true"><span class="gt-hi">${ic(s.ic)}</span><i class="gt-c1"></i><i class="gt-c2"></i><i class="gt-c3"></i></span>` : ""}<div class="gt-h">${s.end ? "" : `<span class="gt-ic">${ic(s.ic)}</span>`}<b id="gtT">${esc0(s.t)}</b></div><p id="gtS">${esc0(txt(s.s))}</p>`;
    body.classList.remove("in", "fw", "bw"); void body.offsetWidth; body.classList.add("in", dir < 0 ? "bw" : "fw");
    TR.last = ""; TR.place = null;
    if (!s.end) bring(s.el()); else { const v = view(); if (v && v.scrollTop > 0) v.scrollTo({ top: 0, behavior: RM() ? "auto" : "smooth" }); }
    layout(true);
    setTimeout(() => { try { if (TR.on) (document.activeElement && TR.root.contains(document.activeElement) ? null : card.focus({ preventScroll: true })); } catch (e) {} }, 30);
  }
  const esc0 = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function step(d) {
    let i = TR.i + d;
    /* a stop whose element vanished meanwhile (a re-render, a resize to desktop…) is skipped */
    while (i > 0 && i < TR.list.length - 1 && !shown(TR.list[i].el())) i += d < 0 ? -1 : 1;
    if (i < 0) return;
    if (i >= TR.list.length) return finish("end");
    if (i === 0 && !shown(TR.list[0].el()) && d < 0) return;
    TR.i = i; TR.dir = d < 0 ? -1 : 1; sfx("tick"); try { buzz(4); } catch (e) {}
    render(d);
  }

  /* scroll the target into view, leaving room for the card under (or over) it */
  function scroller(el) { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2) return p; } return null; }
  function bring(el) {
    if (!el) return;
    const sc = scroller(el); if (!sc) return;
    const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect();
    if (el.closest("#side")) { /* the sidebar list: just enough to show the whole item, clear of its edge fades */
      const m = 30; let dy = 0;
      if (r.top < b.top + m) dy = r.top - (b.top + m); else if (r.bottom > b.bottom - m) dy = r.bottom - (b.bottom - m);
      if (Math.abs(dy) >= 1) { TR.scrolling = true; sc.scrollTo({ top: Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, sc.scrollTop + dy)), behavior: RM() ? "auto" : "smooth" }); onScroll(); }
      return;
    }
    const card = q(".gt-card", TR.root);
    const ch = (card && card.offsetHeight) || 220, gap = 18, top0 = Math.max(b.top, topSafe()) + 12, bot0 = Math.min(b.bottom, innerHeight - bottomInset()) - 12;
    const room = bot0 - top0;
    let want; /* where the target's top should land */
    if (r.height + gap + ch <= room) want = top0 + Math.max(0, (room - (r.height + gap + ch)) / 2);
    else if (r.height <= room) want = top0 + Math.max(0, room - r.height) * (r.height + gap + ch > room ? 0 : .5);
    else want = top0;
    const dy = Math.round(r.top - want); if (Math.abs(dy) < 4) return;
    sc.scrollTo({ top: Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, sc.scrollTop + dy)), behavior: RM() ? "auto" : "smooth" });
  }
  function topSafe() { const d = q("#auDemo.on"); if (d) { const r = d.getBoundingClientRect(); if (r.bottom > 0 && r.bottom < 160) return r.bottom + 4; } return 0; }
  function bottomInset() { const t = tabs(); if (!t) return 0; const r = t.getBoundingClientRect(); return Math.max(0, innerHeight - r.top); }

  /* ── exact framing: the target's own border box, an even padding that never reaches a neighbour, clipped to what is visible ── */
  const BASE_PAD = 6;
  function padFor(el, r) {
    let gap = Infinity;
    const sibs = [el.previousElementSibling, el.nextElementSibling];
    for (const n of sibs) {
      if (!n || !shown(n)) continue;
      const o = n.getBoundingClientRect();
      gap = Math.min(gap, Math.max(o.left - r.right, r.left - o.right, o.top - r.bottom, r.top - o.bottom));
    }
    return gap === Infinity ? BASE_PAD : Math.max(0, Math.min(BASE_PAD, Math.floor(gap / 2)));
  }
  /* the visible box: the viewport, minus every scrolling ancestor's own edges (the sidebar list scrolls on short screens) */
  function clipBox(el) {
    let L = 4, T = 4, R = innerWidth - 4, B = innerHeight - 4;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2) { const b = p.getBoundingClientRect(); T = Math.max(T, b.top); B = Math.min(B, b.bottom); }
    }
    return { L, T, R, B };
  }
  function frame(el) {
    const r = el.getBoundingClientRect(), pad = padFor(el, r), c = clipBox(el);
    const x0 = Math.max(c.L, r.left - pad), y0 = Math.max(c.T, r.top - pad), x1 = Math.min(c.R, r.right + pad), y1 = Math.min(c.B, r.bottom + pad);
    const br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
    const rad = Math.min(br > 0 ? br + pad : el.closest("#tabbar") ? 18 : pad + 8, w / 2, h / 2);
    return { r, pad, x: x0, y: y0, w, h, rad, tight: pad < 3 };
  }
  /* inner scrollers (the sidebar list, the view) settle before the spotlight is measured again */
  let scrollT = 0;
  function onScroll() { TR.scrolling = true; clearTimeout(scrollT); scrollT = setTimeout(() => { TR.scrolling = false; TR.last = ""; }, 110); }

  /* ── follow the target every frame (scroll, resize, re-render, entrance animations) ── */
  function loop() { if (!TR.on) return; try { layout(false); } catch (e) { return kill(e); } TR.raf = requestAnimationFrame(loop); }
  function layout(force) {
    const s = TR.list[TR.i]; if (!s) return;
    const spot = q(".gt-spot", TR.root), card = q(".gt-card", TR.root), notch = q(".gt-notch", TR.root);
    const W = innerWidth, H = innerHeight, M = 12;
    const el = s.end ? null : s.el();
    if (!s.end && !shown(el)) { /* gone (no fridges, a resize…): next stop */
      if (!TR.wait) TR.wait = performance.now();
      if (performance.now() - TR.wait > 600) { TR.wait = 0; const d = TR.dir || 1; let i = TR.i + d; while (i > 0 && i < TR.list.length - 1 && !shown(TR.list[i].el())) i += d; TR.i = Math.max(0, Math.min(TR.list.length - 1, i)); render(d); }
      return;
    }
    TR.wait = 0;
    if (TR.scrolling && !force && TR.last) return;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let crop = false, sig, sx = 0, sy = 0, sw = 0, sh = 0, rad = 24, cx, cy, side = "c";
    if (el) {
      const f = frame(el); TR.fr = f;
      sx = f.x; sy = f.y; sw = f.w; sh = f.h; rad = f.rad;
      const gap = 16, inSide = !!el.closest("#side");
      if (inSide) { side = "r"; cx = sx + sw + gap; cy = Math.min(Math.max(M, sy + sh / 2 - ch / 2), H - ch - M); }
      else {
        const below = H - (sy + sh) - gap - M - (el.closest("#tabbar") ? 0 : bottomInset()), above = sy - gap - M;
        if (below >= ch) { side = "b"; cy = sy + sh + gap; }
        else if (above >= ch) { side = "t"; cy = sy - gap - ch; }
        else if (el.closest("#tabbar")) { side = "t"; cy = Math.max(M, sy - gap - ch); }
        else if (W - (sx + sw) - gap - M >= cw || sx - gap - M >= cw) { /* wide screen, tall target: the card goes beside it, the frame stays whole */
          side = W - (sx + sw) - gap - M >= cw ? "r" : "l"; cx = side === "r" ? sx + sw + gap : sx - gap - cw;
          cy = Math.min(Math.max(M + topSafe(), sy + sh / 2 - ch / 2), H - ch - M - bottomInset());
        }
        else { /* taller than the screen: the card sits at the bottom, the spotlight shows the part above it */
          side = "b"; cy = Math.max(M, H - ch - M - bottomInset());
          const t0 = Math.max(sy, topSafe()), b0 = Math.min(sy + sh, cy - gap); if (b0 - t0 > 40) { sy = t0; sh = b0 - t0; crop = true; } }
        if (side === "b" || side === "t") cx = Math.min(Math.max(M, sx + sw / 2 - cw / 2), W - cw - M);
      }
    } else { cx = (W - cw) / 2; cy = Math.max(M, (H - ch) / 2); }
    sig = [sx, sy, sw, sh, cx, cy, cw, ch, side, W, H].map((v) => (typeof v === "number" ? Math.round(v) : v)).join(",");
    if (!force && sig === TR.last) return; TR.last = sig;
    TR.crop = crop;
    TR.root.classList.toggle("nospot", !el);
    spot.classList.toggle("tight", !!(el && TR.fr && TR.fr.tight));
    if (el) {
      spot.style.transform = `translate(${Math.round(sx)}px,${Math.round(sy)}px)`; spot.style.width = Math.round(sw) + "px"; spot.style.height = Math.round(sh) + "px"; spot.style.borderRadius = Math.round(rad) + "px";
    } else {
      const ex = W / 2, ey = cy + ch / 2; spot.style.transform = `translate(${Math.round(ex)}px,${Math.round(ey)}px)`; spot.style.width = "0px"; spot.style.height = "0px";
    }
    card.style.transform = `translate(${Math.round(cx)}px,${Math.round(cy)}px)`;
    card.dataset.side = side;
    /* the little notch points at the target */
    if (side === "b" || side === "t") { const nx = Math.min(Math.max(22, sx + sw / 2 - cx), cw - 22); notch.style.left = Math.round(nx) + "px"; notch.style.top = ""; }
    else if (side === "r" || side === "l") { const ny = Math.min(Math.max(22, sy + sh / 2 - cy), ch - 22); notch.style.top = Math.round(ny) + "px"; notch.style.left = ""; }
  }

  /* ── open / close ── */
  function waitFor(test, ms) { return new Promise((res) => { const t0 = performance.now(); const tick = () => { let ok = false; try { ok = test(); } catch (e) {} if (ok) return res(true); if (performance.now() - t0 > ms) return res(false); setTimeout(tick, 80); }; tick(); }); }
  function inert(on) {
    if (on) { TR.inerted = ["#app", "#tabbar", "#side", "#skip"].map((s) => q(s)).filter((e) => e && !e.hasAttribute("inert")); TR.inerted.forEach((e) => e.setAttribute("inert", "")); }
    else { TR.inerted.forEach((e) => e.removeAttribute("inert")); TR.inerted = []; }
  }
  async function start() {
    if (TR.on || TR.starting) return;
    TR.starting = true;
    try {
      if (typeof S !== "object" || !S || !S.resto) return;
      try { if (q("#sheet.open") && typeof closeSheet === "function") closeSheet(); } catch (e) {}
      if (S.route !== "home") { try { S.history = []; go("home", {}, { replace: true, tab: true }); } catch (e) {} }
      const ok = await waitFor(() => S.route === "home" && shown(q(".hm-hero", view())) && !q("#sheet.open"), 4000);
      if (!ok) return;
      await new Promise((r) => setTimeout(r, 450)); /* let the home's entrance settle */
      TR.list = STOPS.filter((s) => s.end || shown(s.el()));
      if (TR.list.length < 2) return;
      TR.i = 0; TR.dir = 1; TR.on = true; TR.prevFocus = document.activeElement;
      TR.root = build();
      inert(true);
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("scroll", onScroll, true);
      try { document.fonts && document.fonts.ready.then(() => { TR.last = ""; }); document.fonts && document.fonts.addEventListener("loadingdone", refit); } catch (e) {}
      document.documentElement.classList.add("gt-open");
      render(1);
      requestAnimationFrame(() => { if (TR.root) TR.root.classList.add("on"); });
      sfx("sheet");
      TR.raf = requestAnimationFrame(loop);
    } catch (e) { kill(e); } finally { TR.starting = false; }
  }
  function remember() { if (isDemo()) return; try { localStorage.setItem(key(), String(Date.now())); } catch (e) {} }
  function finish(how) {
    if (!TR.on) return;
    remember();
    const go1 = how === "go";
    close(how === "skip" ? "close" : "ok");
    if (go1) setTimeout(() => {
      try {
        const slot = typeof slotNow === "function" ? slotNow() : "";
        const done = new Set((typeof readingsFor === "function" ? readingsFor(dayKey(), slot) : []).map((r) => r.fridgeId));
        const f = (S.fridges || []).find((x) => !done.has(x.id)) || (S.fridges || [])[0];
        if (f && ACT.homeFridge) ACT.homeFridge(null, f.id); else go("frigos");
      } catch (e) {}
    }, RM() ? 0 : 260);
  }
  function close(sound) {
    TR.on = false; cancelAnimationFrame(TR.raf);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("scroll", onScroll, true); TR.scrolling = false;
    try { document.fonts && document.fonts.removeEventListener("loadingdone", refit); } catch (e) {}
    inert(false); document.documentElement.classList.remove("gt-open");
    const r = TR.root; TR.root = null;
    if (sound) sfx(sound === "ok" ? "done" : "close");
    if (r) { r.classList.remove("on"); r.classList.add("off"); setTimeout(() => r.remove(), RM() ? 0 : 320); }
    try { const p = TR.prevFocus; if (p && p.isConnected && p.focus) p.focus({ preventScroll: true }); } catch (e) {}
  }
  /* anything unexpected: the tour quietly disappears, the app keeps working */
  function kill(e0) { try { close(); } catch (e) { try { TR.on = false; inert(false); document.querySelectorAll(".gt").forEach((x) => x.remove()); document.documentElement.classList.remove("gt-open"); } catch (e2) {} } }

  /* after the onboarding: once per user per device, as soon as the Accueil shows (never on its own in the demo) */
  const PEND = "gg-tour-pend";
  function armed() { try { return sessionStorage.getItem(PEND) === "1"; } catch (e) { return !!TR.armed; } }
  function arm(on) { TR.armed = on; try { on ? sessionStorage.setItem(PEND, "1") : sessionStorage.removeItem(PEND); } catch (e) {} }
  let watchT = 0;
  function watch() {
    clearTimeout(watchT);
    if (!armed() || TR.on) return;
    if (isDemo() || seen()) return arm(false);
    const ready = typeof S === "object" && S && S.ready && S.resto && S.route === "home" && shown(q(".hm-hero", view())) && !q("#sheet.open") && !q(".au.on, .au.show") && !q(".cc-lock.on") && !q(".cc-cele.on");
    if (ready) { arm(false); setTimeout(() => { if (!TR.on && !seen()) start(); }, 700); return; }
    watchT = setTimeout(watch, 500);
  }
  window.addEventListener("gg:onboarded", () => { try { if (isDemo() || seen()) return; arm(true); watch(); } catch (e) {} });
  /* a reload between the onboarding and the Accueil keeps the promise */
  window.addEventListener("load", () => setTimeout(() => { try { if (armed()) watch(); } catch (e) {} }, 1500));
  addEventListener("resize", () => { if (TR.on) { TR.last = ""; try { const s = TR.list[TR.i]; if (s && !s.end) setTimeout(() => TR.on && bring(s.el()), 120); } catch (e) {} } });

  function refit() { TR.last = ""; }
  /* the home re-renders on every data change: re-measure right after */
  try { new MutationObserver(() => { if (TR.on) TR.last = ""; }).observe(document.getElementById("viewport") || document.body, { childList: true, subtree: true }); } catch (e) {}

  window.TOUR = {
    start() { try { start(); } catch (e) { kill(); } },
    done() { try { remember(); if (TR.on) close("ok"); } catch (e) { kill(); } },
    seen,
    /* test hook: the current stop, its target's border box and the spotlight box */
    _debug() {
      if (!TR.on) return null; const s = TR.list[TR.i]; const el = s && !s.end ? s.el() : null; if (!el) return { k: s && s.k, end: true };
      const f = frame(el), sp = q(".gt-spot", TR.root).getBoundingClientRect(), r = f.r;
      return { k: s.k, pad: f.pad, clip: clipBox(el), t: { l: r.left, t: r.top, r: r.right, b: r.bottom }, s: { l: sp.left, t: sp.top, r: sp.right, b: sp.bottom }, rad: f.rad, crop: !!TR.crop };
    },
  };
  try { Object.assign(ACT, { tourStart: () => { sfx("tap"); try { if (typeof closeSheet === "function" && q("#sheet.open")) closeSheet(); } catch (e) {} setTimeout(() => window.TOUR.start(), 120); } }); } catch (e) {}
})();
