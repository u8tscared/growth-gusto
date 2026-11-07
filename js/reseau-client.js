/* Growth Gusto — « petit souci de réseau » on every page a restaurant's CLIENT sees (commande/: QR table orders, takeaway, online and
   table payments, waiter call · reserver/: online booking). Global `GGR`, no dependency, loaded before the page's own script.
   The client never sees a raw error when the network drops. Instead, a frosted card slides down from the top:
     1. « Petit souci de réseau » — the connection comes back quickly, stay on the page, there is nothing to do;
     2. « Nous renvoyons votre commande… » — the moment the network answers again, what was being sent leaves again by itself;
     3. « C'est reparti ! » — then the card goes away.
   GGR.run(fn, opts) runs one request (fn) and, when it fails because of the network — or stays silent while the network is gone — waits
   for the network and runs it again, as long as the page is open. It never sends twice: the page passes the SAME request id on every try
   (commande/: `rq`, checked by functions/src/commande.js create; reserver/: the booking's own document id, chosen on the device).
   « Arrêter l'envoi » appears after 40 s, for a client who would rather order with the staff: the request stops, the cart stays.
   Network down = navigator.onLine false, a Firebase « unavailable / deadline-exceeded » or a plain « internal » with no server answer
   (that is what the Functions SDK says when fetch failed), checked by a ping of /version.json?ggping (sw.js never answers it from cache).
   Demo: GGR.fake(ms) cuts the network for real on this page only (every request fails, the ping too), so « Simuler une coupure » shows
   exactly what a client would see. */
(function () {
  "use strict";
  const NET_CODES = ["unavailable", "deadline-exceeded", "network-request-failed", "cancelled"];
  const NET_RE = /network|failed to fetch|load failed|offline|internet|timed? ?out|err_internet|err_network|connexion/i;
  const T = {
    commande: ["Nous renvoyons votre commande…", "Votre commande est bien partie.", "Votre commande est gardée : elle partira toute seule."],
    paiement: ["Nous reprenons votre paiement…", "Le paiement peut continuer.", "Rien n'a été payé deux fois : le paiement reprend tout seul."],
    appel: ["Nous renvoyons votre appel…", "L'équipe a bien reçu votre appel.", "Votre appel est gardé : il partira tout seul."],
    reservation: ["Nous renvoyons votre réservation…", "Votre réservation est bien partie.", "Votre réservation est gardée : elle partira toute seule."],
    suivi: ["Nous reconnectons…", "Votre suivi est de nouveau en direct.", "Le suivi reprend dès que la connexion revient."],
    lecture: ["Nous reconnectons…", "Connexion rétablie.", "La page se recharge toute seule dès que la connexion revient."],
  };
  const ICO = {
    off: '<svg viewBox="0 0 24 24"><path class="w3" d="M2 8.8a15 15 0 0 1 20 0"/><path class="w2" d="M5.2 12.4a10 10 0 0 1 13.6 0"/><path class="w1" d="M8.6 15.9a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.4" r="1.3" class="w0"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  };
  let fakeUntil = 0, fakeT = 0;
  const faking = () => Date.now() < fakeUntil;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ───────── is it the network? ───────── */
  async function ping() {
    if (faking()) return false;
    if (navigator.onLine === false) return false;
    const c = typeof AbortController === "function" ? new AbortController() : null; const to = setTimeout(() => c && c.abort(), 4500);
    try { const r = await fetch("/version.json?ggping=" + Date.now(), { cache: "no-store", signal: c ? c.signal : undefined }); return r.ok || r.status < 500; }
    catch (e) { return false; } finally { clearTimeout(to); }
  }
  async function isNet(e) {
    if (e && e.ggNet) return true;
    if (faking() || navigator.onLine === false) return true;
    const code = String((e && e.code) || "").replace(/^(functions|firestore)\//, ""), msg = String((e && e.message) || "");
    if (NET_CODES.includes(code)) return true;
    if (e instanceof TypeError && NET_RE.test(msg)) return true;
    if (NET_RE.test(msg) && !/^[a-z_]{2,14}$/.test(msg)) return true;
    /* the Functions SDK turns « fetch failed » into code internal / message « internal » (a server crash says « INTERNAL ») */
    if (code === "internal" && msg === "internal") return !(await ping());
    if (!code || code === "unknown") return !(await ping());
    return false;
  }
  const netErr = () => { const e = new Error("network"); e.code = "unavailable"; e.ggNet = true; return e; };

  /* ───────── the card ───────── */
  let el = null, hideT = 0, tickT = 0, runs = 0, cur = null;
  function card() {
    if (el && document.body.contains(el)) return el;
    el = document.createElement("div"); el.className = "ggr"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); el.hidden = true;
    el.innerHTML = `<div class="ggr-in"><span class="ggr-ic" aria-hidden="true"></span><div class="ggr-tx"><b class="ggr-h"></b><p class="ggr-p"></p><p class="ggr-s"></p></div></div>
      <div class="ggr-bar" aria-hidden="true"><i></i></div><div class="ggr-x"></div>`;
    el.addEventListener("click", (ev) => { const b = ev.target.closest("[data-ggr]"); if (!b) return; ev.preventDefault(); if (b.dataset.ggr === "stop" && cur && cur.stop) cur.stop(); if (b.dataset.ggr === "now" && cur && cur.now) cur.now(); });
    document.body.appendChild(el); return el;
  }
  function show(state, o) {
    const c = card(); clearTimeout(hideT); c.hidden = false;
    const t = T[o.kind] || T.lecture, pend = !!o.pending;
    const was = c.classList.contains("on"); c.className = "ggr is-" + state + (was ? " on" : ""); if (!was) { void c.offsetWidth; c.classList.add("on"); }
    const ic = c.querySelector(".ggr-ic");
    if (state === "ok") ic.innerHTML = ICO.ok; else if (state === "retry") ic.innerHTML = '<span class="ggr-spin"></span>'; else ic.innerHTML = ICO.off;
    c.querySelector(".ggr-h").textContent = state === "ok" ? "C'est reparti !" : state === "retry" ? t[0] : "Petit souci de réseau";
    c.querySelector(".ggr-p").textContent = state === "ok" ? (pend ? t[1] : "Connexion rétablie.")
      : state === "retry" ? "Le réseau revient. Ça ne prend que quelques secondes."
      : "Pas d'inquiétude, ce sera rétabli très vite. Restez sur cette page, il suffit de patienter." + (pend ? " " + t[2] : "");
    paintSub(state, o);
  }
  function paintSub(state, o) {
    const c = card(), s = c.querySelector(".ggr-s"), x = c.querySelector(".ggr-x");
    if (state !== "off") { s.textContent = ""; x.innerHTML = ""; return; }
    const left = Math.max(0, Math.ceil(((o.nextAt || 0) - Date.now()) / 1000));
    s.innerHTML = o.checking ? `<span class="ggr-dots"><i></i><i></i><i></i></span>On vérifie la connexion` : left ? `Nouvel essai dans <b>${left}&nbsp;s</b>` : "";
    const long = o.pending && o.stop && Date.now() - o.since > 40000;
    x.innerHTML = long ? `<p>Toujours coupé ? Vous pouvez aussi demander à l'équipe.</p><button type="button" class="ggr-btn" data-ggr="stop">Arrêter l'envoi</button>`
      : o.nextAt && left > 2 ? `<button type="button" class="ggr-btn soft" data-ggr="now">Réessayer maintenant</button>` : "";
  }
  function hide(after) { clearTimeout(hideT); hideT = setTimeout(() => { if (!el) return; el.classList.remove("on"); setTimeout(() => { if (el && !el.classList.contains("on")) el.hidden = true; }, 420); }, after || 0); }
  let AC = null;
  function chime() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); [523, 784].forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + i * 0.12; o.type = "sine"; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.22); }); } catch (e) {} }
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  /* ───────── wait for the network to come back ───────── */
  const BACK = [2000, 3000, 5000, 8000, 10000];
  function waitBack(o) {
    return new Promise((ok, ko) => {
      let n = 0, done = false, timer = 0;
      const end = (f, v) => { if (done) return; done = true; clearTimeout(timer); clearInterval(tickT); window.removeEventListener("online", onl); o.now = o.stop = null; f(v); };
      const tryNow = async () => { if (done) return; clearTimeout(timer); o.checking = true; o.nextAt = 0; paintSub("off", o);
        const up = await ping(); if (done) return; o.checking = false; if (up) return end(ok);
        o.nextAt = Date.now() + BACK[Math.min(n++, BACK.length - 1)]; paintSub("off", o); timer = setTimeout(tryNow, o.nextAt - Date.now()); };
      const onl = () => setTimeout(tryNow, 300);
      window.addEventListener("online", onl);
      o.now = () => tryNow();
      if (o.stopable) o.stop = () => { const e = new Error("stop"); e.ggStop = true; end(ko, e); };
      clearInterval(tickT); tickT = setInterval(() => { if (!o.checking && el && el.classList.contains("is-off")) paintSub("off", o); }, 1000);
      o.nextAt = Date.now() + BACK[0]; n = 1; paintSub("off", o); timer = setTimeout(tryNow, BACK[0]);
    });
  }

  /* ───────── run one request until it gets through ───────── */
  async function run(fn, opts) {
    runs++;
    try { return await run1(fn, opts); } finally { runs--; }
  }
  async function run1(fn, opts) {
    const o = { kind: "lecture", pending: false, stopable: false, quiet: false, slow: 6000, ...(opts || {}) }; o.since = Date.now();
    let shown = false;
    for (;;) {
      cur = o;
      /* a request that stays silent: check the network, and say so if it is gone (the request keeps waiting, it is not sent again) */
      let slowT = 0, watching = true;
      const watch = async () => { if (!watching) return; const up = await ping(); if (!watching) return;
        if (!up) { if (!shown) { shown = true; vib(20); } show("off", { ...o, nextAt: 0, checking: true }); }
        else if (shown) show("retry", o);
        slowT = setTimeout(watch, 4000); };
      slowT = setTimeout(watch, o.slow);
      try {
        if (faking()) { await sleep(500); throw netErr(); }
        const r = await fn();
        watching = false; clearTimeout(slowT);
        if (shown) { show("ok", o); chime(); vib([12, 40, 12]); hide(2600); }
        return r;
      } catch (e) {
        watching = false; clearTimeout(slowT);
        if (!(await isNet(e))) { if (shown) hide(0); throw e; }
        if (o.quiet && !o.pending) { /* background refresh: show the card, but let the page's own timer try again */ shown = true; show("off", { ...o, nextAt: 0 }); throw e; }
        if (!shown) vib(20);
        shown = true; show("off", o);
        await waitBack(o); /* throws « stop » if the client stops it */
        show("retry", o); await sleep(700);
      }
    }
  }

  /* the network drops while nothing is being sent: say it once, quietly, and say when it is back */
  let idleOff = false;
  window.addEventListener("offline", () => { if (runs || (el && !el.hidden && !el.classList.contains("is-ok"))) return; idleOff = true; show("off", { kind: "lecture" }); });
  window.addEventListener("online", async () => { if (!idleOff) return; if (!(await ping())) return; idleOff = false; if (runs) return; show("ok", { kind: "lecture" }); chime(); hide(2200); });

  window.GGR = {
    run, isNet, ping,
    /* the background refresh came back after a quiet failure: close the card */
    back() { if (el && !el.hidden && el.classList.contains("is-off") && !runs) { show("ok", { kind: "suivi", pending: true }); chime(); hide(2200); } },
    fake(ms) { fakeUntil = Date.now() + (ms || 9000); clearTimeout(fakeT); idleOff = true; if (!runs) show("off", { kind: "lecture" });
      fakeT = setTimeout(() => { fakeUntil = 0; if (idleOff && !runs) { idleOff = false; show("ok", { kind: "lecture" }); chime(); hide(2200); } }, ms || 9000); },
    faking,
    /* a stable id for one request, so trying again never sends it twice */
    rid() { const a = new Uint8Array(10); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))); return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join(""); },
  };
})();
