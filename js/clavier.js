/* Growth Gusto — écrire confortablement au clavier sur iPhone, iPad (et Android).
   Chargé juste après core.js, s'applique à tous les écrans, fenêtres et pages de connexion sans rien leur demander.
   1) Clavier ouvert : iOS ne réduit jamais la page, il pose le clavier PAR-DESSUS l'app (et la fait parfois glisser vers le haut).
      Ici l'app (body, la boîte unique qui contient tout, voir base.css) prend exactement la place visible au-dessus du clavier
      (--vvh, --vvt, html.kb) : barres d'action collantes, fenêtres (sheet), écran de connexion… se posent d'elles-mêmes sur le
      clavier au lieu de rester dessous, la barre d'onglets se cache.
   2) Le champ où l'on écrit reste visible, avec son intitulé : la zone défile juste ce qu'il faut, au-dessus d'une barre
      d'action collante éventuelle (KB.reveal).
   3) Chaque champ a le bon clavier et la bonne touche Entrée (sans écraser ce que l'écran a déjà choisi) : « Suivant » passe au
      champ d'après, « OK » ferme le clavier — sauf si l'écran gère déjà Entrée lui-même (preventDefault).
   On ne touche à rien sans clavier à l'écran : ordinateur, iPad avec clavier physique, clavier iPad flottant.
   API : window.KB = { on(), reveal(el), sim(px) } — sim(px) simule un clavier de px pixels (tests tools/clavier-ui.js), sim(0) l'enlève. */
(function () {
  const de = document.documentElement, vv = window.visualViewport;
  const TEXT = "input:not([type]),input[type=text],input[type=search],input[type=email],input[type=tel],input[type=url],input[type=number],input[type=password],textarea";
  const FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]):not([type=color]):not([type=image]):not([type=hidden]),textarea,select,[contenteditable=''],[contenteditable=true]";
  const isField = (el) => !!(el && el.matches && el.matches(FIELD) && !el.disabled);
  const K = { on: false, kb: 0, sim: 0, t: 0 };

  /* ───────── 1) the app box follows the part of the screen the keyboard leaves free ───────── */
  /* reference = the app box without keyboard: html keeps the full height (body is the one resized), the home-screen app sizes it to --appH */
  const geo = () => {
    const H = de.clientHeight || window.innerHeight;
    if (K.sim) return { H, h: H - K.sim, top: 0, scale: 1 };
    return vv ? { H, h: vv.height, top: Math.max(0, vv.offsetTop), scale: vv.scale || 1 } : { H, h: H, top: 0, scale: 1 };
  };
  function upd() {
    const g = geo(); const kb = Math.max(0, Math.round(g.H - g.h - g.top));
    /* iOS 26 Safari also shrinks the visual viewport when its toolbar moves, and pinch-zoom shrinks it too: only a focused field
       (or a test) means a keyboard */
    const on = (K.sim > 0 || isField(document.activeElement)) && kb > 80 && g.scale < 1.05;
    de.style.setProperty("--kb", (on ? kb : 0) + "px");
    de.style.setProperty("--vvh", Math.round(on ? g.h : g.H) + "px");
    de.style.setProperty("--vvt", (on ? Math.round(g.top) : 0) + "px");
    const changed = on !== K.on || (on && Math.abs(kb - K.kb) > 24);
    if (on !== K.on) { K.on = on; de.classList.toggle("kb", on); try { document.dispatchEvent(new CustomEvent("gg:kb", { detail: { on, kb } })); } catch (e) {} }
    K.kb = on ? kb : 0;
    if (on && changed) later(() => reveal(document.activeElement), 40);
  }
  let tm = 0; const later = (f, ms) => { clearTimeout(tm); tm = setTimeout(f, ms); };

  /* ───────── 2) keep the field (and its label) in view, above a sticky action bar ───────── */
  function scrollers(el) {
    const out = [];
    for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
      const cs = getComputedStyle(p); if (/(auto|scroll|overlay)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) out.push(p);
    }
    return out;
  }
  /* something laid over the content at (x, y) — a sticky / absolute bar that is not an ancestor of the field */
  function cover(x, y, el) {
    let n = document.elementFromPoint(x, y);
    for (; n && n !== document.body && n !== de; n = n.parentElement) {
      if (n === el || n.contains(el)) return null;
      const p = getComputedStyle(n).position; if (p === "sticky" || p === "fixed" || p === "absolute") return n.getBoundingClientRect();
    }
    return null;
  }
  function reveal(el, smooth = true) {
    if (!K.on || !el || !el.isConnected || !isField(el) || el.tagName === "SELECT") return;
    const b = document.body.getBoundingClientRect(), r = el.getBoundingClientRect(); if (!r.height && !r.width) return;
    const sc = scrollers(el); let top = b.top + 6, bot = b.bottom - 10;
    if (sc[0]) { const cr = sc[0].getBoundingClientRect(); top = Math.max(top, cr.top + 4); bot = Math.min(bot, cr.bottom - 8); }
    const x = Math.max(b.left + 2, Math.min(b.right - 2, r.left + r.width / 2));
    /* probe a few points near each edge: a sticky bar may stop short of the very edge (margins, shadows) */
    const B0 = bot, T0 = top;
    for (const dy of [2, 18, 36, 60]) { const cb = cover(x, B0 - dy, el); if (cb && cb.bottom > B0 - 80 && cb.top > T0 + 60) bot = Math.min(bot, cb.top - 10); }
    for (const dy of [2, 18, 36]) { const ct = cover(x, T0 + dy, el); if (ct && ct.top < T0 + 60 && ct.bottom < bot - 60) top = Math.max(top, ct.bottom + 8); }
    /* the label right above the field comes along when there is room for it */
    let tTop = r.top; const lab = el.closest(".field,label"); if (lab) { const lr = lab.getBoundingClientRect(); if (lr.top < r.top && r.top - lr.top < 48) tTop = lr.top; }
    /* a tall text box: its first lines are enough, the caret is kept in view by the text box itself */
    const tBot = r.top + (el.tagName === "TEXTAREA" ? Math.min(r.height, Math.max(96, (bot - top) * 0.55)) : r.height);
    let d = 0; if (tBot > bot) d = tBot - bot; if (tTop - d < top) d = tTop - top;
    if (Math.abs(d) < 2) return;
    for (const s of sc) {
      const max = s.scrollHeight - s.clientHeight, can = Math.max(-s.scrollTop, Math.min(max - s.scrollTop, d));
      if (Math.abs(can) >= 1) { try { s.scrollBy({ top: can, behavior: smooth ? "smooth" : "auto" }); } catch (e) { s.scrollTop += can; } d -= can; }
      if (Math.abs(d) < 2) break;
    }
  }

  /* ───────── 3) the right keyboard and the right Enter key on every field ───────── */
  const scopeOf = (t) => t.closest("#sheet, .au, [role=dialog], .view, form") || document.body;
  function nextField(t) {
    if (!t.isConnected || t.tagName === "TEXTAREA") return null;
    const all = [...scopeOf(t).querySelectorAll(TEXT)].filter((x) => x === t || (!x.disabled && !x.readOnly && x.getClientRects().length && getComputedStyle(x).visibility !== "hidden"));
    const i = all.indexOf(t); return i >= 0 ? all[i + 1] || null : null;
  }
  const setIf = (el, a, v) => { if (!el.hasAttribute(a)) el.setAttribute(a, v); };
  function prep(el) {
    el.setAttribute("data-kbx", "1");
    if (!el.matches(TEXT)) return;
    const ty = (el.getAttribute("type") || "text").toLowerCase(), im = (el.getAttribute("inputmode") || "").toLowerCase();
    const said = ((el.getAttribute("placeholder") || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
    /* e-mail, web address, password, keys: no capital, no correction */
    if (ty === "email" || ty === "url" || ty === "password" || im === "email" || im === "url") { setIf(el, "autocapitalize", "off"); setIf(el, "autocorrect", "off"); setIf(el, "spellcheck", "false"); }
    if (ty === "email") setIf(el, "inputmode", "email");
    if (ty === "tel") setIf(el, "inputmode", "tel");
    if (ty === "number" || im === "decimal" || im === "numeric" || im === "tel") { setIf(el, "autocorrect", "off"); setIf(el, "spellcheck", "false"); }
    /* a search field: « Rechercher » key, no correction of what is typed */
    if (ty === "search" || /^\s*(cherch|recherch|filtrer)/.test(said)) { setIf(el, "enterkeyhint", "search"); setIf(el, "autocorrect", "off"); }
    /* a first name / customer name: capital letters, no correction */
    if (/pr[ée]nom|nom du client|votre nom|nom et pr[ée]nom|nom complet/.test(said)) { setIf(el, "autocapitalize", "words"); setIf(el, "autocorrect", "off"); setIf(el, "spellcheck", "false"); }
    if (el.tagName === "INPUT" && !el.hasAttribute("enterkeyhint")) { el.setAttribute("enterkeyhint", "done"); el.setAttribute("data-kbx", "a"); }
  }
  /* « Suivant » when another field follows in the same screen / window, « OK » on the last one (decided when the field is touched) */
  function hintFor(el) { if (el && el.getAttribute && el.getAttribute("data-kbx") === "a") el.setAttribute("enterkeyhint", nextField(el) ? "next" : "done"); }
  function deco() { document.querySelectorAll("input:not([data-kbx]),textarea:not([data-kbx])").forEach(prep); }
  let dq = false; const queue = () => { if (dq) return; dq = true; Promise.resolve().then(() => { dq = false; deco(); }); };

  /* Enter on the on-screen keyboard: « Suivant » goes to the next field, « OK » closes the keyboard — only when the screen did not
     handle Enter itself, and never inside a <form> (it submits on its own) */
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.isComposing || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || !K.on) return;
    const t = e.target; if (!t || t.tagName !== "INPUT" || !t.matches(TEXT) || t.form || !t.isConnected) return;
    const h = t.getAttribute("enterkeyhint");
    if (h === "next") { const n = nextField(t); if (n) { e.preventDefault(); n.focus(); return; } }
    if (h === "next" || h === "done") { e.preventDefault(); t.blur(); }
  });

  /* ───────── wiring ───────── */
  if (vv) { vv.addEventListener("resize", upd); vv.addEventListener("scroll", upd); }
  window.addEventListener("resize", upd);
  window.addEventListener("orientationchange", () => setTimeout(upd, 300));
  document.addEventListener("pointerdown", (e) => { const t = e.target && e.target.closest ? e.target.closest("input,textarea") : null; if (t) { if (!t.hasAttribute("data-kbx")) prep(t); hintFor(t); } }, { capture: true, passive: true });
  document.addEventListener("focusin", (e) => {
    const t = e.target; if (!isField(t)) return;
    if (t.matches("input,textarea")) { if (!t.hasAttribute("data-kbx")) prep(t); hintFor(t); }
    setTimeout(upd, 60);
    /* keyboard already up (going from one field to the next): bring the new one into view straight away */
    if (K.on) later(() => reveal(t), 60);
    /* safety net once the keyboard animation is over (iOS ~ 300 ms) */
    setTimeout(() => { if (document.activeElement === t) { upd(); reveal(t); } }, 420);
  });
  document.addEventListener("focusout", () => setTimeout(upd, 80));
  /* a text box growing while one types (auto-size): keep its bottom in view */
  document.addEventListener("input", (e) => { if (K.on && e.target && e.target.tagName === "TEXTAREA") { cancelAnimationFrame(K.t); K.t = requestAnimationFrame(() => reveal(e.target, false)); } });
  try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  deco(); upd();

  window.KB = { on: () => K.on, reveal, sim: (px) => { K.sim = Math.max(0, +px || 0); upd(); }, prep: deco };
})();
