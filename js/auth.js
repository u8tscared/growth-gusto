/* Growth Gusto — accounts (area prefix « au »): welcome screen, Google and e-mail sign-in, restaurant setup, team invites,
   demo mode, import of this phone's data. Firebase Auth + Firestore (compat SDK, loaded only when js/config.js has a config).
   Hooks for other areas:
     AUTH.mode()            → "local" | "demo" | "cloud" (signed in) | "welcome"
     authUser()             → { uid, name, email, photo, provider } or null
     AUTH.signOut()         → signs out (cloud), leaves the demo (demo), or opens the welcome screen (local)
     AUTH.openWelcome(opt)  → shows the welcome / sign-in screen over the app ({ screen: "email", tab: "up" })
     AUTH.inviteSheet()     → team invite sheet (link, code, QR, pending invites) · also ACT.auInvite
     AUTH.reglagesHTML()    → « Compte » card for Réglages (added automatically if compte.js does not place it)
     events on window: "gg:auth" {type: "signin"|"signout"|"mode", mode}, "gg:ready" (core, app on screen) */
"use strict";

const AU_SDK = "10.14.1";
const AU_SDK_BASE = `https://www.gstatic.com/firebasejs/${AU_SDK}/`;
const AU_ROLES = {
  equipe: { t: "Équipe", s: "Relevés, étiquettes, ménage, pointeuse", ic: "users" },
  chef: { t: "Chef", s: "En plus : stock, recettes, planning", ic: "book" },
  gerant: { t: "Gérant", s: "Tout, y compris l'équipe et les finances", ic: "shield" },
};
const AU_TYPES = [["bistrot", "Bistrot"], ["brasserie", "Brasserie"], ["gastro", "Gastronomique"], ["bar", "Bar à vin"], ["pizzeria", "Pizzeria"], ["traiteur", "Traiteur"], ["boulangerie", "Boulangerie"], ["autre", "Autre"]];
const AU_FRIDGES = [["Chambre froide", "cfp", 0, 4], ["Frigo de service 1", "frigo", 0, 4], ["Frigo de service 2", "frigo", 0, 4], ["Congélateur", "congel", -40, -15], ["Saladette", "saladette", 0, 4], ["Cave à vin", "cave", 2, 8]];
const AU_ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const auLS = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) {} },
  sget: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  sset: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
  sdel: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} },
};
const auCode = (n = 8) => { let s = ""; const r = new Uint32Array(n); try { crypto.getRandomValues(r); } catch (e) { for (let i = 0; i < n; i++) r[i] = Math.random() * 1e9; } for (let i = 0; i < n; i++) s += AU_ALPHA[r[i] % AU_ALPHA.length]; return s; };
const auFmtCode = (c) => String(c || "").replace(/(.{4})(?=.)/g, "$1-");
const auCleanCode = (v) => { v = String(v || ""); const m = /invite=([A-Za-z0-9-]+)/.exec(v); if (m) v = m[1]; return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); };
const auEmailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
const auPwScore = (p) => { p = String(p || ""); if (!p) return 0; let s = p.length >= 8 ? 1 : 0; if (s && /[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (s && /\d/.test(p)) s++; if (s && (/[^A-Za-z0-9]/.test(p) || p.length >= 14)) s++; return Math.max(p.length >= 8 ? 1 : 0, s); };
const AU_PW_TX = ["Au moins 8 caractères", "Correct", "Bien", "Solide", "Excellent"];
const auG = `<svg class="au-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
Object.assign(IC, {
  auMail: ["r:2,4,20,16,3", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  auEye: ["M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0", "c:12,12,3"],
  auEyeOff: ["M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68", "M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61", "M9.88 9.88a3 3 0 1 0 4.24 4.24", "m2 2 20 20"],
  auKey: ["c:7.5,15.5,5.5", "m21 2-9.6 9.6", "m15.5 7.5 3 3L22 7l-3-3"],
  auLink: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  auCopy: ["r:8,8,14,14,2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  auCloud: ["M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z", "f:M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"],
  auOff: ["m2 2 20 20", "M8.5 16.5a5 5 0 0 1 7 0", "M2 8.82a15 15 0 0 1 4.17-2.65", "M10.66 5c4.01-.36 8.14.9 11.34 3.76", "M16.85 11.25a10 10 0 0 1 2.22 1.68", "M5 13a10 10 0 0 1 5.24-2.76", "M12 20h.01"],
  auPhone: ["r:5,2,14,20,2", "M12 18h.01"],
  auPlay: ["c:12,12,10", "f:m10 8 6 4-6 4z", "m10 8 6 4-6 4z"],
});

/* ───────────────────────── state ───────────────────────── */
const AUTH = {
  cfg: window.GG_FIREBASE && window.GG_FIREBASE.apiKey ? window.GG_FIREBASE : null,
  sdkP: null, auth: null, fs: null, user: null, restos: [], resolve: null, inApp: false, st: "welcome",
  ui: { screen: "welcome", tab: "in", err: "", busy: "", email: "", name: "", pw: "", show: false, sent: false, join: null, create: null, imp: null, back: [] },

  /* ───────────── public hooks ───────────── */
  get demo() { return DB.mode === "demo"; },
  mode() { return DB.mode === "demo" ? "demo" : DB.uid ? "cloud" : this.resolve ? "welcome" : "local"; },
  emit(type) { try { window.dispatchEvent(new CustomEvent("gg:auth", { detail: { type, mode: this.mode(), user: authUser() } })); } catch (e) {} },

  /* ───────────── boot gate: resolves with { mode: "local" | "demo" | "db", … } ───────────── */
  gate() {
    return new Promise((resolve) => {
      this.resolve = (r) => { this.resolve = null; resolve(r); setTimeout(() => this.emit("mode"), 0); };
      const u = new URL(location.href), q = u.searchParams; let strip = false;
      const inv = auCleanCode(q.get("invite")); if (inv.length === 8) auLS.set("gg-invite", inv);
      const wantLocal = q.has("local"), wantDemo = q.has("demo");
      ["invite", "local", "demo"].forEach((k) => { if (q.has(k)) { q.delete(k); strip = true; } });
      if (strip) { try { history.replaceState(null, "", u.pathname + (q.toString() ? "?" + q : "") + u.hash); } catch (e) {} }
      if (wantLocal) { auLS.set("gg-mode", "local"); auLS.sdel("gg-demo"); return this.resolve({ mode: "local" }); }
      if (wantDemo || auLS.sget("gg-demo") === "1") return this.startDemo();
      const mode = auLS.get("gg-mode"), invite = auLS.get("gg-invite");
      if (mode === "cloud" && this.cfg) return this.resume();
      if (!invite && (mode === "local" || (!mode && this.hasLocal()))) { if (!mode) auLS.set("gg-mode", "local"); return this.resolve({ mode: "local" }); }
      this.show(invite && this.cfg ? "welcome" : "welcome");
    });
  },
  /* a returning signed-in user: SDK from the offline cache, auth state from IndexedDB, then straight in */
  async resume() {
    try { await this.sdk(); } catch (e) { this.ui.err = "Connexion impossible pour l'instant. Vérifiez le réseau, puis réessayez."; this.show("welcome"); return; }
    if (auLS.sget("gg-redirect")) {
      auLS.sdel("gg-redirect");
      try { const r = await this.auth.getRedirectResult(); if (r && r.user) auLS.set("gg-last", "google"); } catch (e) { this.ui.err = this.msg(e); }
    }
    const u = await this.firstUser();
    if (!u) { this.show("welcome"); return; }
    await this.signedIn(u);
  },
  firstUser() { return new Promise((res) => { const un = this.auth.onAuthStateChanged((u) => { try { un(); } catch (e) {} res(u); }); }); },

  /* ───────────── Firebase SDK (lazy) ───────────── */
  script(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement("script"); s.src = src; s.async = false; s.crossOrigin = "anonymous";
      const t = setTimeout(() => ko(new Error("timeout " + src)), 20000);
      s.onload = () => { clearTimeout(t); ok(); }; s.onerror = () => { clearTimeout(t); s.remove(); ko(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  },
  sdk() {
    if (this.sdkP) return this.sdkP;
    if (!this.cfg) return Promise.reject(Object.assign(new Error("no config"), { code: "gg/no-config" }));
    this.sdkP = (async () => {
      if (!(window.firebase && firebase.initializeApp)) await this.script(AU_SDK_BASE + "firebase-app-compat.js");
      await Promise.all([firebase.auth ? null : this.script(AU_SDK_BASE + "firebase-auth-compat.js"), firebase.firestore ? null : this.script(AU_SDK_BASE + "firebase-firestore-compat.js")]);
      if (!firebase.apps.length) firebase.initializeApp(this.cfg);
      this.auth = firebase.auth(); this.fs = firebase.firestore();
      try { this.auth.languageCode = "fr"; } catch (e) {}
      try { this.fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}
      /* offline in the kitchen: every read is cached on the device, writes queue until the network is back */
      try { await this.fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { console.warn("persistence", e && e.code); }
      try { await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
      return true;
    })();
    this.sdkP.catch(() => { this.sdkP = null; });
    return this.sdkP;
  },
  FV() { return firebase.firestore.FieldValue; },
  timeout(p, ms, code = "gg/timeout") { return Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(Object.assign(new Error(code), { code })), ms))]); },

  /* ───────────── local data on this phone (import offer) ───────────── */
  localData() { try { return JSON.parse(localStorage.getItem("gg-local") || "{}") || {}; } catch (e) { return {}; } },
  hasLocal() { const d = this.localData(); return !!(d.restos && Object.keys(d.restos).length); },
  localSummary() {
    const d = this.localData(), keys = Object.keys(d); const cnt = (c) => keys.filter((k) => k.endsWith("/" + c)).reduce((s, k) => s + Object.keys(d[k] || {}).length, 0);
    return { names: Object.values(d.restos || {}).map((r) => r && r.name).filter(Boolean), readings: cnt("readings"), lots: cnt("lots"), products: cnt("products"), members: cnt("members"), notes: cnt("notes"), docs: keys.filter((k) => k.startsWith("restos/")).reduce((s, k) => s + Object.keys(d[k] || {}).length, 0) };
  },

  /* ───────────── signed in ───────────── */
  async signedIn(u) {
    this.user = u; auLS.set("gg-mode", "cloud"); this.emit("signin");
    let doc = {};
    try { const s = await this.timeout(this.fs.collection("users").doc(u.uid).get(), 12000); doc = s.exists ? s.data() || {} : {}; } catch (e) { console.warn("users get", e && e.code); }
    this.restos = Array.isArray(doc.restos) ? doc.restos : [];
    const prof = { name: u.displayName || doc.name || "", email: u.email || "", photo: u.photoURL || "" };
    if (prof.name !== doc.name || prof.email !== doc.email || prof.photo !== doc.photo) this.fs.collection("users").doc(u.uid).set({ ...prof, updatedAt: Date.now(), ...(doc.createdAt ? {} : { createdAt: Date.now() }) }, { merge: true }).catch((e) => console.warn("users set", e && e.code));
    const inv = auLS.get("gg-invite");
    if (inv) return this.openJoin(inv);
    if (this.hasLocal() && !auLS.get("gg-imp-" + u.uid)) return this.show("import");
    if (this.restos.length) return this.enter();
    this.show("setup");
  },
  enter(rid) {
    if (rid) auLS.set("gg-rid-c", rid);
    auLS.sdel("gg-demo");
    if (this.resolve) { this.hide(); this.resolve({ mode: "db", fs: this.fs, user: authUser(), rid: rid || null }); this.watchNet(); }
    else { this.hide(); setTimeout(() => location.reload(), 280); } /* opened over a running app (this device only, or the demo) */
  },
  async signOut() {
    if (DB.mode === "demo") return this.leaveDemo();
    if (!DB.uid || !this.auth) { this.openWelcome(); return; }
    SFX.close(); try { DB.unsubAll(); } catch (e) {}
    try { await this.auth.signOut(); } catch (e) {}
    /* a shared kitchen tablet: the next person must not find the previous account's cached data */
    try { await this.fs.terminate(); await this.fs.clearPersistence(); } catch (e) {}
    auLS.set("gg-mode", "out"); auLS.del("gg-rid-c"); this.emit("signout");
    location.reload();
  },
  noResto() { if (this.resolve || $("#au.on")) return; this.inApp = true; this.restos = []; this.mount(); this.show("setup"); },

  /* ───────────── demo ───────────── */
  async startDemo() {
    try { if (!window.GG_DEMO) await this.script("js/demo.js"); } catch (e) { SFX.err(); toast("Démo indisponible hors ligne.", "err"); if (this.resolve) this.show("welcome"); return; }
    if (!this.resolve) { auLS.sset("gg-demo", "1"); this.hide(); setTimeout(() => location.reload(), 250); return; }
    const d = GG_DEMO.build(); auLS.sset("gg-demo", "1");
    this.hide(); this.resolve({ mode: "demo", data: d.data, rid: d.rid, me: d.me });
    setTimeout(() => this.demoBar(), 600);
  },
  leaveDemo() { auLS.sdel("gg-demo"); SFX.close(); document.documentElement.classList.add("au-leaving"); setTimeout(() => location.reload(), 260); },
  demoBar() {
    if ($("#auDemo")) return;
    document.documentElement.classList.add("au-demo");
    const b = document.createElement("div"); b.id = "auDemo"; b.className = "au-dbar"; b.setAttribute("role", "status");
    b.innerHTML = `<span class="au-demo-dot" aria-hidden="true"></span><span class="au-demo-tx"><b>Mode démo</b><span><i class="au-sep"> · </i>rien n'est enregistré</span></span><button class="au-demo-cta" data-act="auDemoSignup">Créer mon compte</button><button class="au-demo-x" data-act="auDemoLeave" aria-label="Quitter la démo">${ico("x")}</button>`;
    document.body.appendChild(b); requestAnimationFrame(() => b.classList.add("on"));
  },

  /* ───────────── overlay ───────────── */
  mount() {
    let el = $("#au"); if (el) return el;
    el = document.createElement("div"); el.id = "au"; el.className = "au"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Bienvenue sur Growth Gusto");
    el.innerHTML = `<div class="au-bg" aria-hidden="true"><i></i><i></i><i></i><i></i><b class="au-spot"></b></div>
      <div class="au-scroll"><div class="au-wrap">
        <section class="au-hero" aria-hidden="false">
          <div class="au-brand">${appIcon(40)}<b>Growth Gusto</b></div>
          <h1 class="au-h1">Votre cuisine,<br><span class="au-grad">parfaitement maîtrisée.</span></h1>
          <p class="au-lead">Relevés HACCP, étiquettes, stock, allergènes, équipe et finances. Une seule app, pensée pour le coup de feu.</p>
          <div class="au-stage" aria-hidden="true">${this.stageHTML()}</div>
          <ul class="au-feats" aria-label="Fonctions"><li>${ico("therm")}Relevés en 10 s</li><li>${ico("shield")}Registre prêt pour le contrôle</li><li>${ico("auOff")}Marche sans réseau</li></ul>
        </section>
        <section class="au-card" id="auCard" aria-live="polite"><div class="au-pane" id="auPane"></div></section>
      </div></div>`;
    document.body.appendChild(el);
    /* desktop: the light follows the pointer, the preview cards lean towards it */
    el.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; const r = el.getBoundingClientRect(); el.style.setProperty("--mx", ((e.clientX - r.left) / r.width).toFixed(3)); el.style.setProperty("--my", ((e.clientY - r.top) / r.height).toFixed(3)); }, { passive: true });
    return el;
  },
  stageHTML() {
    const spark = [38, 52, 44, 61, 58, 72, 66, 80, 74, 88].map((v, i) => `${i * 12 + 4},${(56 - (v - 30) * 0.8).toFixed(1)}`).join(" ");
    return `<div class="au-mock m1"><span class="au-mic ok">${ico("therm")}</span><div><em>Chambre froide</em><b class="mono">1,8 °C</b></div><span class="pill ok"><span class="dot"></span>Conforme</span></div>
      <div class="au-mock m2"><div class="au-mrow"><span class="au-mic">${ico("book")}</span><div><em>Fiche recette</em><b>Croquettes de jambon</b></div></div><div class="au-al"><span>Gluten</span><span>Lait</span><span>Œufs</span></div></div>
      <div class="au-mock m3"><div><em>Ticket Z · hier</em><b class="mono">2 486 €</b></div><svg viewBox="0 0 117 60" aria-hidden="true"><polyline points="${spark}" fill="none" stroke="url(#auSp)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="auSp" x1="0" x2="1"><stop offset="0" stop-color="#9ED7FF"/><stop offset="1" stop-color="#7A4DFF"/></linearGradient></defs></svg></div>
      <div class="au-mock m4"><span class="au-mic warn">${ico("clock")}</span><div><em>DLC demain</em><b>Fines de claire n°3</b></div></div>`;
  },
  show(screen, opts = {}) {
    const el = this.mount(); const first = !el.classList.contains("on");
    if (opts.push !== false && !first && this.ui.screen !== screen && !["busy"].includes(this.ui.screen)) this.ui.back.push(this.ui.screen);
    if (opts.reset) this.ui.back = [];
    this.ui.screen = screen; this.st = screen;
    el.classList.toggle("au-inapp", this.inApp); el.dataset.screen = screen;
    if (first) { el.hidden = false; void el.offsetWidth; el.classList.add("on"); document.documentElement.classList.toggle("au-open", !this.inApp); const b = $("#boot"); b && setTimeout(() => b.classList.add("out"), 120); }
    this.paint(first);
  },
  hide() {
    const el = $("#au"); if (!el) return;
    el.classList.remove("on"); el.classList.add("off"); document.documentElement.classList.remove("au-open");
    setTimeout(() => { el.remove(); }, 520); this.inApp = false;
  },
  openWelcome(opt = {}) {
    this.inApp = true; this.ui.back = []; this.ui.err = "";
    if (opt.tab) this.ui.tab = opt.tab;
    this.mount(); this.show(opt.screen || "welcome", { push: false }); SFX.sheet();
  },
  /* height-animated pane swap: the card glides to its new height while the content cross-fades */
  paint(first) {
    const pane = $("#auPane"), card = $("#auCard"); if (!pane) return;
    const h0 = card.offsetHeight; const html = this.screenHTML();
    pane.classList.remove("in"); pane.innerHTML = html; void pane.offsetWidth; pane.classList.add("in");
    if (!first && h0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const h1 = card.offsetHeight; if (Math.abs(h1 - h0) > 2) { card.style.height = h0 + "px"; void card.offsetWidth; card.style.height = h1 + "px"; clearTimeout(card._t); card._t = setTimeout(() => { card.style.height = ""; }, 460); }
    }
    this.after();
  },
  after() {
    const s = this.ui.screen, desk = window.matchMedia("(min-width:960px)").matches;
    const f = { email: this.ui.tab === "up" && !this.ui.name ? "#auName" : "#auEmail", reset: "#auREmail", create: "#auRName", join: "#auCode" }[s];
    if (f && (desk || s === "join")) setTimeout(() => { const i = $(f); if (i && !i.value) i.focus({ preventScroll: true }); }, 380);
    if (s === "email" || s === "reset") this.validate();
    if (s === "join") this.codeCells();
    if (s === "create") this.createPrev();
  },
  backBtn() { return this.ui.back.length ? `<button class="au-back" data-act="auBack" aria-label="Retour">${ico("back")}</button>` : this.inApp ? `<button class="au-back" data-act="auClose" aria-label="Fermer">${ico("x")}</button>` : ""; },
  errHTML() { return this.ui.err ? `<div class="au-err" role="alert">${ico("alert")}<span>${esc(this.ui.err)}</span></div>` : ""; },

  screenHTML() {
    const U = this.ui, s = U.screen, busy = (k) => (U.busy === k ? " au-busy" : "");
    const spin = `<span class="au-spin" aria-hidden="true"></span>`;
    if (s === "welcome") {
      const inv = auLS.get("gg-invite"), last = auLS.get("gg-last");
      return `${inv ? `<div class="au-invite st" style="--i:0">${ico("users")}<div><b>Vous êtes invité dans une équipe</b><span>Connectez-vous pour la rejoindre · code <span class="mono">${esc(auFmtCode(inv))}</span></span></div></div>` : ""}
        <div class="au-head st" style="--i:0">${this.inApp ? this.backBtn() : ""}<div><div class="au-t">${inv ? "Rejoindre l'équipe" : "Bienvenue"}</div><div class="au-s">${this.inApp && DB.mode === "local" ? "Créez votre compte : vos données vous suivent sur tous vos appareils." : "Connectez-vous ou découvrez l'app en 1 minute."}</div></div></div>
        ${this.errHTML()}
        <div class="au-btns">
          <button class="au-btn au-google st${busy("google")}" style="--i:1" data-act="auGoogle">${auG}<span>Continuer avec Google</span>${last === "google" ? `<em class="au-last">Dernière fois</em>` : ""}${spin}</button>
          <button class="au-btn au-mailb st" style="--i:2" data-act="auEmail">${ico("auMail")}<span>Continuer avec un e-mail</span>${last === "email" ? `<em class="au-last">Dernière fois</em>` : ""}</button>
          <div class="au-or st" style="--i:3"><span>ou</span></div>
          ${DB.mode === "demo" ? "" : `<button class="au-btn au-demob st" style="--i:4" data-act="auDemo"><span class="au-demo-ic">${ico("auPlay")}</span><span class="au-demo-l"><b>Essayer la démo</b><em>Un vrai restaurant, déjà rempli. Rien n'est enregistré.</em></span>${ico("chev")}</button>`}
        </div>
        ${this.inApp ? "" : `<button class="au-link st" style="--i:5" data-act="auLocal">${ico("auPhone")}Continuer sans compte <span>(sur cet appareil)</span></button>`}`;
    }
    if (s === "soon") {
      return `<div class="au-head">${this.backBtn()}<div><div class="au-t">Les comptes arrivent</div><div class="au-s">Nous finalisons la connexion sécurisée.</div></div></div>
        <div class="au-soon st" style="--i:1"><span class="au-soon-ic">${ico("auCloud")}</span><p>Très bientôt : un compte pour votre restaurant, synchronisé sur tous vos appareils, et votre équipe invitée en un lien.</p><p class="au-soon-s">En attendant, essayez la démo, ou utilisez l'app sur cet appareil : vous pourrez tout importer dans votre compte ensuite.</p></div>
        <div class="au-btns"><button class="btn acc block st" style="--i:2" data-act="auDemo">${ico("auPlay")}Essayer la démo</button>${this.inApp ? "" : `<button class="btn soft block st" style="--i:3" data-act="auLocal">${ico("auPhone")}Continuer sur cet appareil</button>`}</div>`;
    }
    if (s === "email") {
      const up = U.tab === "up";
      return `<div class="au-head">${this.backBtn()}<div><div class="au-t">${up ? "Créer votre compte" : auLS.get("gg-last-email") ? "Bon retour" : "Se connecter"}</div><div class="au-s">${up ? "30 secondes, et votre restaurant est prêt." : "Avec l'e-mail de votre compte."}</div></div></div>
        <div class="seg au-seg" role="tablist"><span class="au-segi" style="transform:translateX(${up ? "100%" : "0"})"></span><button role="tab" aria-selected="${!up}" class="${up ? "" : "on"}" data-act="auTab" data-v="in">Connexion</button><button role="tab" aria-selected="${up}" class="${up ? "on" : ""}" data-act="auTab" data-v="up">Créer un compte</button></div>
        ${this.errHTML()}
        <form class="au-form" data-au="email" novalidate>
          ${up ? `<label class="au-f"><span>Prénom</span><div class="au-in"><input class="input" id="auName" autocomplete="given-name" maxlength="40" placeholder="Marceau" value="${esc(U.name)}" enterkeyhint="next"><i class="au-ok">${ico("check")}</i></div></label>` : ""}
          <label class="au-f"><span>E-mail</span><div class="au-in"><input class="input" id="auEmail" type="email" inputmode="email" autocomplete="${up ? "email" : "username"}" autocapitalize="off" spellcheck="false" placeholder="vous@restaurant.fr" value="${esc(U.email || auLS.get("gg-last-email") || "")}" enterkeyhint="next"><i class="au-ok">${ico("check")}</i></div><em class="au-hint" id="auEmailH"></em></label>
          <label class="au-f"><span>Mot de passe</span><div class="au-in"><input class="input" id="auPw" type="${U.show ? "text" : "password"}" autocomplete="${up ? "new-password" : "current-password"}" minlength="8" placeholder="${up ? "8 caractères minimum" : "Votre mot de passe"}" value="${esc(U.pw)}" enterkeyhint="go"><button type="button" class="au-eye" data-act="auEye" aria-label="${U.show ? "Masquer" : "Afficher"} le mot de passe">${ico(U.show ? "auEyeOff" : "auEye")}</button></div>
            ${up ? `<div class="au-meter" id="auMeter" aria-hidden="true"><i></i><i></i><i></i><i></i></div><em class="au-hint" id="auPwH">${AU_PW_TX[0]}</em>` : ""}</label>
          <button class="btn acc block au-submit${busy("email")}" type="submit" id="auGo"><span>${up ? "Créer mon compte" : "Se connecter"}</span>${spin}</button>
        </form>
        ${up ? `<p class="au-fine">En créant un compte, vous devenez gérant de votre restaurant. Vous pourrez inviter votre équipe ensuite.</p>` : `<button class="au-link au-forgot" data-act="auForgot">Mot de passe oublié ?</button>`}`;
    }
    if (s === "reset") {
      if (U.sent) return `<div class="au-head">${this.backBtn()}<div><div class="au-t">Vérifiez vos e-mails</div><div class="au-s">Un lien vient de partir.</div></div></div>
        <div class="au-done st" style="--i:1"><span class="au-check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span><p>Ouvrez le message envoyé à <b>${esc(U.email)}</b> et choisissez un nouveau mot de passe. Pensez aux courriers indésirables.</p></div>
        <button class="btn acc block st" style="--i:2" data-act="auBackToIn">Revenir à la connexion</button>`;
      return `<div class="au-head">${this.backBtn()}<div><div class="au-t">Mot de passe oublié</div><div class="au-s">On vous envoie un lien pour en choisir un nouveau.</div></div></div>
        ${this.errHTML()}
        <form class="au-form" data-au="reset" novalidate><label class="au-f"><span>E-mail</span><div class="au-in"><input class="input" id="auREmail" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="vous@restaurant.fr" value="${esc(U.email || auLS.get("gg-last-email") || "")}" enterkeyhint="send"><i class="au-ok">${ico("check")}</i></div></label>
        <button class="btn acc block au-submit${busy("reset")}" type="submit" id="auRGo"><span>Envoyer le lien</span>${spin}</button></form>`;
    }
    if (s === "busy") return `<div class="au-busyp"><span class="au-ring">${appIcon(64)}</span><div class="au-t">${esc(U.busyTx || "Connexion…")}</div></div>`;
    const who = this.user ? `<div class="au-who st" style="--i:0">${this.user.photoURL ? `<img src="${esc(this.user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="au-wi">${esc(initials(this.user.displayName || this.user.email || "?"))}</span>`}<div><b>${esc(this.user.displayName || firstName(String(this.user.email || "").split("@")[0]))}</b><span>${esc(this.user.email || "")}</span></div><button class="au-link sm" data-act="auSwitch">Changer</button></div>` : "";
    if (s === "setup") {
      return `${who}<div class="au-head"><div><div class="au-t">${this.user && this.user.displayName ? `Bienvenue, ${esc(firstName(this.user.displayName))}` : "Bienvenue"}</div><div class="au-s">Votre restaurant est-il déjà sur Growth Gusto ?</div></div></div>
        <div class="au-choices">
          <button class="au-choice st" style="--i:1" data-act="auCreate"><span class="au-cic">${ico("store")}</span><span><b>Créer mon restaurant</b><em>Je suis gérant, je démarre</em></span>${ico("chev")}</button>
          <button class="au-choice st" style="--i:2" data-act="auJoinOpen"><span class="au-cic alt">${ico("users")}</span><span><b>Rejoindre une équipe</b><em>J'ai un code ou un lien d'invitation</em></span>${ico("chev")}</button>
        </div>`;
    }
    if (s === "create") {
      const C = (U.create ||= { name: "", type: "bistrot", frs: ["Chambre froide", "Frigo de service 1", "Frigo de service 2", "Congélateur"], me: "" });
      const needName = !(this.user && this.user.displayName);
      return `<div class="au-head">${this.backBtn()}<div><div class="au-t">Votre restaurant</div><div class="au-s">Tout se modifie ensuite dans Réglages.</div></div></div>
        ${this.errHTML()}
        <form class="au-form" data-au="create" novalidate>
          ${needName ? `<label class="au-f"><span>Votre prénom</span><div class="au-in"><input class="input" id="auRMe" autocomplete="given-name" maxlength="40" placeholder="Il signe vos relevés" value="${esc(C.me)}"><i class="au-ok">${ico("check")}</i></div></label>` : ""}
          <label class="au-f"><span>Nom du restaurant</span><div class="au-in"><input class="input" id="auRName" autocomplete="organization" maxlength="80" placeholder="Ex. Chemin des Sarments" value="${esc(C.name)}"><i class="au-ok">${ico("check")}</i></div></label>
          <div class="au-f"><span>Type</span><div class="au-chips" role="radiogroup">${AU_TYPES.map(([k, t]) => `<button type="button" class="chip ${C.type === k ? "on" : ""}" role="radio" aria-checked="${C.type === k}" data-act="auType" data-v="${k}">${t}</button>`).join("")}</div></div>
          <div class="au-f"><span>Vos équipements froids</span><div class="au-chips">${AU_FRIDGES.map(([n, , lo, hi]) => `<button type="button" class="chip au-fr ${C.frs.includes(n) ? "on" : ""}" aria-pressed="${C.frs.includes(n)}" data-act="auFr" data-v="${esc(n)}">${C.frs.includes(n) ? ico("check") : ""}${esc(n)}<em class="mono">${lo}/${hi}°</em></button>`).join("")}</div></div>
          <div class="au-prev" id="auPrev"><span class="au-pm">R</span><div><b>Votre restaurant</b><em></em></div><span class="pill acc">Essai</span></div>
          <button class="btn acc block au-submit${busy("create")}" type="submit"><span>${ico("sparkle")}Créer mon restaurant</span>${spin}</button>
        </form>`;
    }
    if (s === "join") {
      const J = (U.join ||= { code: "", inv: null, err: "", loading: false });
      const inv = J.inv; const exp = inv ? Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / 864e5)) : 0;
      return `<div class="au-head">${this.backBtn()}<div><div class="au-t">Rejoindre une équipe</div><div class="au-s">Le gérant vous a donné un code à 8 caractères.</div></div></div>
        <form class="au-form" data-au="join" novalidate>
          <label class="au-codebox" for="auCode"><input id="auCode" class="au-codein" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" spellcheck="false" maxlength="40" value="${esc(J.code)}" aria-label="Code d'invitation"><span class="au-cells" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i data-i="${i}"></i>${i === 3 ? "<b>–</b>" : ""}`).join("")}</span></label>
          <div class="au-jstate" id="auJState">${J.loading ? `<div class="au-jload">${spin}Recherche de l'invitation…</div>` : J.err ? `<div class="au-err" role="alert">${ico("alert")}<span>${esc(J.err)}</span></div>` : inv ? `<div class="au-jcard st" style="--i:0"><span class="au-pm">${esc(initials(inv.restoName || "R"))}</span><div><b>${esc(inv.restoName || "Restaurant")}</b><em>Invité par ${esc(inv.createdByName || "le gérant")} · rôle ${esc((AU_ROLES[inv.role] || AU_ROLES.equipe).t)}</em></div><span class="pill ok">${exp > 1 ? `${exp} jours` : "Valable"}</span></div>` : `<p class="au-fine">Vous pouvez aussi coller le lien reçu par message.</p>`}</div>
          <button class="btn acc block au-submit${busy("join")}" type="submit" ${inv ? "" : "disabled"}><span>${inv ? `Rejoindre ${esc(inv.restoName || "l'équipe")}` : "Rejoindre"}</span>${spin}</button>
        </form>`;
    }
    if (s === "import") {
      const I = U.imp || {}; const sm = this.localSummary();
      if (I.done) return `<div class="au-done st" style="--i:0"><span class="au-check big"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span><div class="au-t">Tout est dans votre compte</div><p>${I.n} élément${I.n > 1 ? "s" : ""} importé${I.n > 1 ? "s" : ""}${I.skipped ? ` · ${I.skipped} ignoré${I.skipped > 1 ? "s" : ""}` : ""}. Vos données restent aussi sur ce téléphone.</p></div><button class="btn acc block st" style="--i:1" data-act="auImportGo">Ouvrir mon restaurant${ico("chev")}</button>`;
      return `${who}<div class="au-head"><div><div class="au-t">Vos données sont sur ce téléphone</div><div class="au-s">Importez-les dans votre compte : rien n'est perdu.</div></div></div>
        ${this.errHTML()}
        <div class="au-imp st" style="--i:1"><div class="au-imph"><span class="au-pm">${esc(initials(sm.names[0] || "R"))}</span><div><b>${esc(sm.names.join(", ") || "Votre restaurant")}</b><em>${sm.docs} éléments enregistrés ici</em></div></div>
          <div class="au-kpis"><div><b class="mono">${sm.readings}</b><span>relevés</span></div><div><b class="mono">${sm.lots}</b><span>lots</span></div><div><b class="mono">${sm.products}</b><span>produits</span></div><div><b class="mono">${sm.members}</b><span>personnes</span></div></div>
          ${I.running ? `<div class="au-prog"><i style="width:${Math.round((I.p || 0) * 100)}%"></i></div><em class="au-hint">Import en cours… ${Math.round((I.p || 0) * 100)} %</em>` : ""}</div>
        <div class="au-btns"><button class="btn acc block st${I.running ? " au-busy" : ""}" style="--i:2" data-act="auImport"><span>${ico("auCloud")}Importer les données de ce téléphone dans mon compte</span>${spin}</button>
        ${I.running ? "" : `<button class="btn ghost block st" style="--i:3" data-act="auImportSkip">Plus tard</button>`}</div>`;
    }
    if (s === "welcomeDone") return `<div class="au-done"><span class="au-ring">${appIcon(84)}</span><div class="au-t">${esc(U.doneTx || "C'est prêt !")}</div><p>${esc(U.doneSub || "")}</p></div>`;
    return "";
  },

  /* ───────────── inline validation ───────────── */
  validate() {
    const s = this.ui.screen;
    const mark = (inp, ok) => { if (!inp) return; const w = inp.closest(".au-in"); w && w.classList.toggle("ok", !!ok); };
    if (s === "email") {
      const up = this.ui.tab === "up", e = $("#auEmail"), p = $("#auPw"), n = $("#auName");
      if (n) mark(n, n.value.trim().length >= 2);
      if (e && p && p.value) e.dataset.touched = "1";
      if (e) { const ok = auEmailOk(e.value); mark(e, ok); const h = $("#auEmailH"); if (h) h.textContent = e.value && !ok && e.dataset.touched ? "Vérifiez l'adresse e-mail" : ""; e.closest(".au-f").classList.toggle("bad", !!(e.value && !ok && e.dataset.touched)); }
      if (p && up) { const sc = auPwScore(p.value); const m = $("#auMeter"); if (m) { m.dataset.s = p.value ? sc : 0; } const h = $("#auPwH"); if (h) h.textContent = p.value ? (p.value.length < 8 ? `Encore ${8 - p.value.length} caractère${8 - p.value.length > 1 ? "s" : ""}` : AU_PW_TX[sc]) : AU_PW_TX[0]; mark(p, p.value.length >= 8); }
    }
    if (s === "reset") { const e = $("#auREmail"); mark(e, e && auEmailOk(e.value)); }
    if (s === "create") { mark($("#auRName"), ($("#auRName")?.value || "").trim().length >= 2); mark($("#auRMe"), ($("#auRMe")?.value || "").trim().length >= 2); }
  },
  shake(el) { if (!el) return; const t = el.closest(".au-f") || el; t.classList.remove("au-shake"); void t.offsetWidth; t.classList.add("au-shake"); SFX.err(); buzz([20, 40, 20]); setTimeout(() => t.classList.remove("au-shake"), 460); },
  setBusy(k, tx) { this.ui.busy = k; if (k) this.ui.busyTx = tx; const el = $("#au"); if (!el) return; $$(".au-btn,.au-submit,[data-act=auImport]", el).forEach((b) => { const on = !!k && ((k === "google" && b.classList.contains("au-google")) || (k !== "google" && (b.classList.contains("au-submit") || b.dataset.act === "auImport"))); b.classList.toggle("au-busy", on); b.toggleAttribute("disabled", !!k && !on ? false : on); }); },
  fail(e, screen) {
    this.setBusy("");
    const m = this.msg(e); if (!m) return;
    this.ui.err = m; SFX.err(); buzz([20, 40, 20]);
    if (screen && this.ui.screen !== screen) this.show(screen, { push: false }); else this.paint();
    const er = $("#au .au-err"); er && er.classList.add("au-shake");
  },
  msg(e) {
    const c = (e && e.code) || "";
    const M = {
      "auth/invalid-email": "Adresse e-mail invalide.",
      "auth/user-not-found": "E-mail ou mot de passe incorrect.", "auth/wrong-password": "E-mail ou mot de passe incorrect.", "auth/invalid-credential": "E-mail ou mot de passe incorrect.", "auth/invalid-login-credentials": "E-mail ou mot de passe incorrect.",
      "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail. Connectez-vous.",
      "auth/weak-password": "Mot de passe trop faible : 8 caractères minimum.",
      "auth/too-many-requests": "Trop d'essais. Patientez quelques minutes, ou réinitialisez le mot de passe.",
      "auth/network-request-failed": "Pas de connexion internet. Réessayez quand le réseau revient.",
      "auth/user-disabled": "Ce compte a été désactivé.",
      "auth/operation-not-allowed": "Ce mode de connexion n'est pas encore activé.",
      "auth/unauthorized-domain": "Ce site n'est pas encore autorisé pour la connexion (voir tools/FIREBASE.md).",
      "auth/account-exists-with-different-credential": "Ce compte utilise un autre mode de connexion : essayez Google ou l'e-mail.",
      "auth/popup-blocked": "La fenêtre de connexion a été bloquée. Autorisez les fenêtres pour ce site.",
      "auth/web-storage-unsupported": "Votre navigateur bloque la connexion (navigation privée ?).",
      "gg/timeout": "Le réseau est trop lent. Réessayez dans un instant.",
      "permission-denied": "Accès refusé.", "unavailable": "Pas de connexion internet. Réessayez quand le réseau revient.",
    };
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"].includes(c)) return "";
    return M[c] || "Une erreur est survenue. Réessayez.";
  },

  /* ───────────── sign-in flows ───────────── */
  useRedirect() { return IS_IOS && isStandalone(); }, /* iPhone home-screen app: popups open in a detached sheet that never reports back */
  async google() {
    if (!this.cfg) { this.ui.err = ""; this.show("soon"); return; }
    if (this.ui.busy) return; this.ui.err = ""; this.setBusy("google");
    try {
      await this.sdk();
      const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      if (this.useRedirect()) { auLS.sset("gg-redirect", "1"); auLS.set("gg-mode", "cloud"); await this.auth.signInWithRedirect(p); return; }
      let r;
      try { r = await this.auth.signInWithPopup(p); }
      catch (e) { if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) { auLS.sset("gg-redirect", "1"); auLS.set("gg-mode", "cloud"); await this.auth.signInWithRedirect(p); return; } throw e; }
      auLS.set("gg-last", "google"); SFX.ok(); buzz(8);
      this.setBusy(""); await this.signedIn(r.user);
    } catch (e) { console.warn("google", e); this.fail(e); }
  },
  async emailSubmit() {
    const up = this.ui.tab === "up", e = $("#auEmail"), p = $("#auPw"), n = $("#auName");
    if (e) e.dataset.touched = "1";
    const email = (e?.value || "").trim(), pw = p?.value || "", name = (n?.value || "").trim();
    Object.assign(this.ui, { email, pw, name: up ? name : this.ui.name });
    if (up && name.length < 2) { this.shake(n); n.focus(); return; }
    if (!auEmailOk(email)) { this.validate(); this.shake(e); e.focus(); return; }
    if (up ? pw.length < 8 : !pw) { this.shake(p); p.focus(); if (up) toast("8 caractères minimum pour le mot de passe.", "err"); return; }
    if (!this.cfg) { this.show("soon"); return; }
    if (this.ui.busy) return; this.ui.err = ""; this.setBusy("email");
    try {
      await this.sdk();
      let u;
      if (up) { const r = await this.auth.createUserWithEmailAndPassword(email, pw); u = r.user; try { await u.updateProfile({ displayName: name }); } catch (x) {} try { u.sendEmailVerification && u.sendEmailVerification().catch(() => {}); } catch (x) {} }
      else { const r = await this.auth.signInWithEmailAndPassword(email, pw); u = r.user; }
      auLS.set("gg-last", "email"); auLS.set("gg-last-email", email); this.ui.pw = ""; SFX.ok(); buzz(8);
      this.setBusy(""); await this.signedIn(this.auth.currentUser || u);
    } catch (x) {
      console.warn("email", x);
      if (x && x.code === "auth/email-already-in-use") { this.ui.tab = "in"; }
      this.fail(x);
    }
  },
  async resetSubmit() {
    const e = $("#auREmail"); const email = (e?.value || "").trim(); this.ui.email = email;
    if (!auEmailOk(email)) { this.shake(e); e.focus(); return; }
    if (!this.cfg) { this.show("soon"); return; }
    if (this.ui.busy) return; this.ui.err = ""; this.setBusy("reset");
    try { await this.sdk(); await this.auth.sendPasswordResetEmail(email); this.setBusy(""); this.ui.sent = true; SFX.done(); this.paint(); }
    catch (x) { if (x && x.code === "auth/user-not-found") { this.setBusy(""); this.ui.sent = true; this.paint(); return; } /* never reveal which e-mails have an account */ this.fail(x); }
  },

  /* ───────────── create a restaurant ───────────── */
  createPrev() {
    const C = this.ui.create; if (!C) return; const p = $("#auPrev"); if (!p) return;
    const n = ($("#auRName")?.value || C.name || "").trim();
    $(".au-pm", p).textContent = initials(n || "R"); $("b", p).textContent = n || "Votre restaurant";
    $("em", p).textContent = `${(AU_TYPES.find((t) => t[0] === C.type) || AU_TYPES[0])[1]} · ${C.frs.length} équipement${C.frs.length > 1 ? "s" : ""} froid${C.frs.length > 1 ? "s" : ""}`;
    p.classList.toggle("on", !!n);
  },
  async createSubmit() {
    const C = this.ui.create, nEl = $("#auRName"), mEl = $("#auRMe");
    C.name = (nEl?.value || "").trim(); if (mEl) C.me = mEl.value.trim();
    if (mEl && C.me.length < 2) { this.shake(mEl); mEl.focus(); return; }
    if (C.name.length < 2) { this.shake(nEl); nEl.focus(); return; }
    if (this.ui.busy) return; this.ui.err = ""; this.setBusy("create");
    const u = this.user, fs = this.fs, FV = this.FV(), now = Date.now();
    const rid = "r" + now.toString(36) + auCode(4).toLowerCase();
    const name = (u.displayName || C.me || firstName(String(u.email || "").split("@")[0])).trim();
    try {
      if (C.me && !u.displayName) { try { await u.updateProfile({ displayName: C.me }); } catch (x) {} fs.collection("users").doc(u.uid).set({ name: C.me }, { merge: true }).catch(() => {}); }
      const b = fs.batch(), R = fs.collection("restos").doc(rid);
      b.set(R, { name: C.name, type: C.type, owner: u.uid, createdAt: now, plan: "essai", by: u.uid });
      b.set(R.collection("members").doc(u.uid), { name, email: u.email || "", photo: u.photoURL || "", role: "gerant", joinedAt: now });
      b.set(fs.collection("users").doc(u.uid), { restos: FV.arrayUnion(rid) }, { merge: true });
      AU_FRIDGES.filter(([n]) => C.frs.includes(n)).forEach(([n, type, min, max], i) => b.set(R.collection("fridges").doc("f" + now.toString(36) + i), { name: n, type, min, max, order: i, createdAt: now + i }));
      b.set(R.collection("events").doc("e" + now.toString(36)), { type: "team", text: `a créé ${C.name}`, at: now, uid: u.uid });
      await this.timeout(b.commit(), 15000);
      this.setBusy(""); this.celebrate(`C'est prêt${name ? ", " + firstName(name) : ""} !`, `${C.name} · ${C.frs.length} équipement${C.frs.length > 1 ? "s" : ""} à relever`, rid);
    } catch (x) { console.warn("create", x); this.fail(x); }
  },
  celebrate(t, sub, rid) {
    this.ui.doneTx = t; this.ui.doneSub = sub; this.show("welcomeDone", { push: false });
    SFX.done(); buzz([12, 40, 12, 40, 30]); setTimeout(() => burst(window.innerWidth / 2, window.innerHeight * 0.45), 180);
    setTimeout(() => this.enter(rid), 1500);
  },

  /* ───────────── join with an invite ───────────── */
  async openJoin(code) {
    code = auCleanCode(code);
    this.ui.join = { code, inv: null, err: "", loading: code.length === 8 };
    this.show("join", { push: !!this.ui.back.length || this.ui.screen === "setup" });
    if (code.length === 8) this.lookup(code);
  },
  async lookup(code) {
    const J = this.ui.join; J.loading = true; J.err = ""; J.inv = null; this.paintJoin();
    try {
      const s = await this.timeout(this.fs.collection("invites").doc(code).get(), 12000);
      if (J.code !== code) return;
      const inv = s.exists ? s.data() : null;
      if (!inv) J.err = "Ce code n'existe pas ou a été annulé. Vérifiez-le avec votre gérant.";
      else if (inv.expiresAt && inv.expiresAt < Date.now()) J.err = "Cette invitation a expiré. Demandez-en une nouvelle au gérant.";
      else if (this.restos.includes(inv.rid)) { auLS.del("gg-invite"); toast(`Vous faites déjà partie de ${inv.restoName || "cette équipe"}`); this.enter(inv.rid); return; }
      else { J.inv = { ...inv, code }; SFX.scan(); buzz(8); }
    } catch (x) { if (J.code !== code) return; J.err = this.msg(x); }
    J.loading = false; this.paint();
  },
  paintJoin() { if (this.ui.screen !== "join") return; const st = $("#auJState"); const J = this.ui.join; if (st && J.loading) st.innerHTML = `<div class="au-jload"><span class="au-spin"></span>Recherche de l'invitation…</div>`; },
  codeCells() {
    const i = $("#auCode"); if (!i) return; const v = auCleanCode(i.value);
    $$(".au-cells i").forEach((c, k) => { c.textContent = v[k] || ""; c.classList.toggle("f", !!v[k]); c.classList.toggle("cur", k === v.length && document.activeElement === i); });
  },
  async joinSubmit() {
    const J = this.ui.join; if (!J || !J.inv || this.ui.busy) return;
    const u = this.user, fs = this.fs, FV = this.FV(), inv = J.inv, now = Date.now();
    this.setBusy("join");
    try {
      const b = fs.batch();
      b.set(fs.doc(`restos/${inv.rid}/members/${u.uid}`), { name: u.displayName || firstName(String(u.email || "").split("@")[0]), email: u.email || "", photo: u.photoURL || "", role: inv.role || "equipe", joinedAt: now, invite: J.code });
      b.set(fs.collection("users").doc(u.uid), { restos: FV.arrayUnion(inv.rid) }, { merge: true });
      b.update(fs.collection("invites").doc(J.code), { uses: FV.increment(1), lastUsedAt: now });
      b.set(fs.doc(`restos/${inv.rid}/events/e${now.toString(36)}`), { type: "team", text: `a rejoint ${inv.restoName || "l'équipe"}`, at: now, uid: u.uid });
      await this.timeout(b.commit(), 15000);
      auLS.del("gg-invite"); this.setBusy("");
      this.celebrate(`Bienvenue dans l'équipe !`, `${inv.restoName || "Restaurant"} · ${(AU_ROLES[inv.role] || AU_ROLES.equipe).t}`, inv.rid);
    } catch (x) { console.warn("join", x); J.err = x && x.code === "permission-denied" ? "Cette invitation n'est plus valable. Demandez-en une nouvelle." : this.msg(x); this.setBusy(""); this.paint(); SFX.err(); }
  },

  /* ───────────── import this phone's data into the account ───────────── */
  async importLocal() {
    const I = (this.ui.imp ||= {}); if (I.running) return;
    I.running = true; I.p = 0; this.ui.err = ""; this.paint();
    const u = this.user, fs = this.fs, FV = this.FV(), data = this.localData(); let n = 0, skipped = 0;
    try {
      const restos = Object.entries(data.restos || {});
      const plan = []; /* [{rid, first:[ops], rest:[ops]}] */
      for (const [old, r] of restos) {
        const rid = "r" + Date.now().toString(36) + auCode(4).toLowerCase(); const now = Date.now();
        const R = fs.collection("restos").doc(rid); const { by, ...rest } = r || {};
        const first = [[R, { ...DB.clean(rest), name: String((r && r.name) || "Mon restaurant").slice(0, 80), owner: u.uid, createdAt: (r && r.createdAt) || now, plan: "essai", importedAt: now }],
          [R.collection("members").doc(u.uid), { name: u.displayName || S.me.name || "", email: u.email || "", photo: u.photoURL || "", role: "gerant", joinedAt: now }],
          [fs.collection("users").doc(u.uid), { restos: FV.arrayUnion(rid) }, { merge: true }]];
        const ops = [];
        Object.keys(data).filter((k) => k.startsWith(`restos/${old}/`)).forEach((k) => {
          const col = k.slice(`restos/${old}/`.length); if (!/^[A-Za-z]{1,32}$/.test(col)) return;
          Object.entries(data[k] || {}).forEach(([id, d]) => { if (!d || typeof d !== "object" || id === u.uid) return; if (col === "members" && d.role === "gerant" && id === "local") d = { ...d, role: "gerant" }; ops.push([R.collection(col).doc(id), DB.clean(d)]); });
        });
        plan.push({ rid, first, ops });
      }
      const total = plan.reduce((s, p) => s + p.ops.length + 1, 0) || 1; let done = 0;
      const tick = () => { I.p = Math.min(1, done / total); const bar = $("#au .au-prog i"); if (bar) bar.style.width = Math.round(I.p * 100) + "%"; const h = $("#au .au-imp .au-hint"); if (h) h.textContent = `Import en cours… ${Math.round(I.p * 100)} %`; };
      for (const P of plan) {
        /* first the restaurant and the owner's membership (the rules check it for every later write) */
        const b0 = fs.batch(); P.first.forEach(([ref, d, o]) => (o ? b0.set(ref, d, o) : b0.set(ref, d))); await this.timeout(b0.commit(), 20000); done++; tick();
        for (let i = 0; i < P.ops.length; i += 400) {
          const b = fs.batch(); let k = 0;
          P.ops.slice(i, i + 400).forEach(([ref, d]) => { try { b.set(ref, d); k++; } catch (x) { skipped++; } }); /* a doc Firestore cannot store (nested arrays…) is skipped, not fatal */
          if (k) await this.timeout(b.commit(), 30000); n += k; done += Math.min(400, P.ops.length - i); tick();
        }
        this.restos.push(P.rid); auLS.set("gg-rid-c", P.rid);
      }
      auLS.set("gg-imp-" + u.uid, "1");
      Object.assign(I, { running: false, done: true, n, skipped, rid: plan[0] && plan[0].rid }); SFX.done(); burst(); this.paint();
    } catch (x) { console.warn("import", x); I.running = false; this.ui.err = this.msg(x) + " Rien n'a été effacé de ce téléphone."; SFX.err(); this.paint(); }
  },

  /* ───────────── team invites (gérant) ───────────── */
  inviteSheet(role) {
    SFX.tap();
    const isG = myRole() === "gerant";
    if (DB.mode === "local") {
      openSheet(`<div class="au-sh"><span class="au-shic">${ico("auLink")}</span><div class="h2">Invitez votre équipe</div><p class="sub">${this.cfg ? "Avec un compte, chacun se connecte sur son téléphone et voit les mêmes données, en direct." : "Bientôt : un compte pour votre restaurant, et votre équipe invitée en un lien. Les comptes arrivent très vite."}</p>
        ${this.cfg ? `<button class="btn acc block" data-act="auOpen">${ico("auCloud")}Créer mon compte</button>` : `<button class="btn soft block" data-act="sheetClose">Compris</button>`}</div>`);
      return;
    }
    if (!isG) { openSheet(`<div class="au-sh"><span class="au-shic">${ico("shield")}</span><div class="h2">Réservé au gérant</div><p class="sub">Demandez à votre gérant de vous envoyer une invitation pour un nouveau collègue.</p><button class="btn soft block" data-act="sheetClose">Compris</button></div>`); return; }
    S.ui.auInv = { role: role || (S.ui.auInv && S.ui.auInv.role) || "equipe", cur: null, list: S.ui.auInv?.list || null };
    this.invPaint(true);
    if (DB.uid) this.invLoad();
  },
  invHTML() {
    const V = S.ui.auInv, demo = DB.mode === "demo";
    const roles = Object.entries(AU_ROLES).map(([k, r]) => `<button class="au-role ${V.role === k ? "on" : ""}" role="radio" aria-checked="${V.role === k}" data-act="auInvRole" data-v="${k}"><span class="au-rdot"></span><span class="ic">${ico(r.ic)}</span><span class="tx"><b>${r.t}</b><em>${r.s}</em></span></button>`).join("");
    const cur = V.cur;
    const link = cur ? this.invLink(cur.code) : "";
    const pend = (V.list || []).filter((x) => !cur || x.code !== cur.code);
    return `<div class="au-sh au-inv">
      <div class="au-shh"><span class="au-shic">${ico("auLink")}</span><div><div class="h2">Inviter dans l'équipe</div><p class="sub">${esc(S.resto?.name || "")} · chacun aura son propre compte</p></div></div>
      ${cur ? `<div class="au-invres">
          <div class="au-qr">${this.qr(link)}</div>
          <div class="au-invc"><span class="lbl">Code · ${esc((AU_ROLES[cur.role] || AU_ROLES.equipe).t)}</span><b class="mono au-bigcode">${esc(auFmtCode(cur.code)).split("").map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</b><em>Valable 7 jours · plusieurs personnes peuvent l'utiliser</em></div>
        </div>
        ${demo ? `<div class="banner">${ico("alert")}<span>Démo : ce lien est un exemple, il ne fonctionne pas.</span></div>` : ""}
        <div class="grid2 au-g2">${navigator.share ? `<button class="btn acc" data-act="auInvShare">${ico("share")}Partager</button>` : ""}<button class="btn ${navigator.share ? "soft" : "acc"}" data-act="auInvCopy" data-v="link">${ico("auCopy")}Copier le lien</button>${navigator.share ? "" : `<button class="btn soft" data-act="auInvCopy" data-v="code">${ico("auKey")}Copier le code</button>`}</div>
        <button class="btn ghost block" data-act="auInvNew">Créer une autre invitation</button>`
      : `<div class="lbl">Son rôle</div><div class="au-roles" role="radiogroup">${roles}</div>
        <button class="btn acc block au-submit" data-act="auInvCreate" id="auInvGo"><span>${ico("auLink")}Créer le lien d'invitation</span><span class="au-spin" aria-hidden="true"></span></button>`}
      ${pend.length ? `<div class="lbl au-pendl">Invitations en cours</div><div class="glass pad au-pend">${pend.map((x) => { const d = Math.max(0, Math.ceil((x.expiresAt - Date.now()) / 864e5)); return `<div class="li"><span class="ic">${ico((AU_ROLES[x.role] || AU_ROLES.equipe).ic)}</span><div class="tx"><b class="mono">${esc(auFmtCode(x.code))}</b><em>${esc((AU_ROLES[x.role] || AU_ROLES.equipe).t)} · ${x.uses ? `${x.uses} a rejoint` : "personne encore"} · expire dans ${d} j</em></div><button class="iconbtn sm" data-act="auInvRevoke" data-id="${esc(x.code)}" aria-label="Annuler l'invitation ${esc(auFmtCode(x.code))}">${ico("trash")}</button></div>`; }).join("")}</div>` : V.list === null && DB.uid ? `<div class="au-jload"><span class="au-spin"></span>Invitations en cours…</div>` : ""}
    </div>`;
  },
  invPaint(open) { if (open || !$("#sheetBody .au-inv")) openSheet(this.invHTML()); else $("#sheetBody").innerHTML = this.invHTML(); },
  invLink(code) { return `${location.origin}${location.pathname.replace(/index\.html$/, "")}?invite=${code}`; },
  qr(text) { try { const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(); let r = ""; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) r += `M${x} ${y}h1v1h-1z`; return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="QR code de l'invitation"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${r}" fill="#0E1330"/></svg>`; } catch (e) { return ""; } },
  async invLoad() {
    try {
      const s = await this.timeout(this.fs.collection("invites").where("rid", "==", S.rid).get(), 12000);
      S.ui.auInv.list = s.docs.map((d) => ({ code: d.id, ...d.data() })).filter((x) => (x.expiresAt || 0) > Date.now()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (e) { console.warn("invites", e && e.code); S.ui.auInv.list = []; }
    if ($("#sheetBody .au-inv")) this.invPaint();
  },
  async invCreate() {
    const V = S.ui.auInv; if (!V || V.busy) return; V.busy = true; const btn = $("#auInvGo"); btn && btn.classList.add("au-busy");
    const code = auCode(8), now = Date.now();
    const doc = { rid: S.rid, restoName: S.resto?.name || "", role: V.role, createdBy: S.me.id, createdByName: S.me.name || "", createdAt: now, expiresAt: now + 7 * 864e5, uses: 0 };
    try {
      if (DB.uid) await this.timeout(this.fs.collection("invites").doc(code).set(doc), 12000);
      V.cur = { code, ...doc }; (V.list ||= []).unshift(V.cur); SFX.done(); buzz([10, 30, 10]);
      logEvent("team", `a créé une invitation (${(AU_ROLES[V.role] || AU_ROLES.equipe).t})`);
    } catch (e) { console.warn("invite", e); SFX.err(); toast(e && e.code === "permission-denied" ? "Seul un gérant peut inviter." : "Invitation impossible : vérifiez le réseau.", "err"); }
    V.busy = false; this.invPaint();
  },
  async invShare() {
    const c = S.ui.auInv?.cur; if (!c) return; const url = this.invLink(c.code);
    try { await navigator.share({ title: `Rejoignez ${S.resto?.name || "l'équipe"} sur Growth Gusto`, text: `${S.me.name ? firstName(S.me.name) + " vous invite" : "Vous êtes invité"} à rejoindre ${S.resto?.name || "l'équipe"} sur Growth Gusto. Code : ${auFmtCode(c.code)}`, url }); SFX.ok(); }
    catch (e) { if (e && e.name !== "AbortError") this.invCopy("link"); }
  },
  async invCopy(what) {
    const c = S.ui.auInv?.cur; if (!c) return; const t = what === "code" ? auFmtCode(c.code) : this.invLink(c.code);
    let ok = false; try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (x) {} }
    if (ok) { SFX.ok(); buzz(6); toast(what === "code" ? "Code copié" : "Lien copié"); } else toast(t, "info");
  },
  async invRevoke(code) {
    const V = S.ui.auInv; if (!V) return;
    try { if (DB.uid) await this.timeout(this.fs.collection("invites").doc(code).delete(), 12000); V.list = (V.list || []).filter((x) => x.code !== code); if (V.cur && V.cur.code === code) V.cur = null; SFX.close(); toast("Invitation annulée"); }
    catch (e) { SFX.err(); toast("Impossible d'annuler : vérifiez le réseau.", "err"); }
    this.invPaint();
  },

  /* ───────────── Réglages « Compte » card ───────────── */
  reglagesHTML() {
    const u = authUser(), m = DB.mode;
    const row = (act, icn, b, em, extra = "") => `<div class="li tap" data-act="${act}"><span class="ic${extra}">${ico(icn)}</span><div class="tx"><b${extra ? ' style="color:var(--bad)"' : ""}>${b}</b><em>${em}</em></div>${ico("chev")}</div>`;
    let body;
    if (m === "demo") body = `<div class="au-acc"><span class="au-wi demo">${ico("auPlay")}</span><div><b>Mode démo</b><span>Rien n'est enregistré · tout s'efface en quittant</span></div></div>${row("auDemoSignup", "auCloud", "Créer mon compte", "Gardez vos données, invitez l'équipe")}${row("auDemoLeave", "out", "Quitter la démo", "Revenir à l'accueil", " bad")}`;
    else if (u) body = `<div class="au-acc">${u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="au-wi">${esc(initials(u.name || u.email))}</span>`}<div><b>${esc(u.name || "Mon compte")}</b><span>${esc(u.email || "")}</span></div><span class="pill acc">${esc(S.resto?.plan === "essai" || !S.resto?.plan ? "Essai" : S.resto.plan)}</span></div>
      ${myRole() === "gerant" ? row("auInvite", "auLink", "Inviter l'équipe", "Lien, code ou QR · chacun son compte") : ""}
      ${row("auJoinOpen", "users", "Rejoindre un autre établissement", "Avec un code d'invitation")}
      ${this.hasLocal() && auLS.get("gg-imp-" + u.uid) !== "1" ? row("auImportOpen", "upload", "Importer les données de ce téléphone", "Elles restent aussi sur l'appareil") : ""}
      ${row("auSignOut", "out", "Se déconnecter", "Les données restent dans votre compte", " bad")}`;
    else body = `<div class="au-acc"><span class="au-wi">${ico("auPhone")}</span><div><b>Sur cet appareil</b><span>Sans compte · données sur ce téléphone</span></div></div>${row("auOpen", "auCloud", "Créer un compte ou se connecter", this.cfg ? "Synchronisé sur tous vos appareils, équipe invitée en un lien" : "Bientôt disponible")}`;
    return `<div class="lbl st cc-sec au-acct-l" style="--i:5">Compte</div><div class="glass pad st au-acct" style="--i:5">${body}</div>`;
  },

  /* ───────────── network state (accounts only): offline pill, « synchronisé » on return ───────────── */
  watchNet() {
    if (this._net) return; this._net = true;
    const pill = document.createElement("div"); pill.id = "auNet"; pill.className = "au-net"; pill.setAttribute("role", "status");
    pill.innerHTML = `${ico("auOff")}<span>Hors ligne · envoi au retour du réseau</span>`; document.body.appendChild(pill);
    const upd = () => { const off = navigator.onLine === false; pill.classList.toggle("on", off); document.documentElement.classList.toggle("au-offline", off); };
    window.addEventListener("offline", () => { upd(); SFX.tick(); });
    window.addEventListener("online", () => { upd(); try { this.fs.waitForPendingWrites().then(() => { toast("Synchronisé"); }).catch(() => {}); } catch (e) {} });
    upd();
  },
};
function authUser() {
  const u = AUTH.user; if (!u) return null;
  const pid = (u.providerData && u.providerData[0] && u.providerData[0].providerId) || "password";
  return { uid: u.uid, name: u.displayName || "", email: u.email || "", photo: u.photoURL || "", provider: pid === "google.com" ? "google" : "email" };
}

/* ───────────── forms + live inputs inside the overlay ───────────── */
document.addEventListener("submit", (e) => {
  const f = e.target; if (!f.dataset || !f.dataset.au) return; e.preventDefault(); SFX.init();
  ({ email: () => AUTH.emailSubmit(), reset: () => AUTH.resetSubmit(), create: () => AUTH.createSubmit(), join: () => AUTH.joinSubmit() })[f.dataset.au]?.();
});
document.addEventListener("input", (e) => {
  const t = e.target; if (!t.closest || !t.closest("#au")) return;
  if (t.id === "auCode") {
    const v = auCleanCode(t.value); const J = (AUTH.ui.join ||= { code: "", inv: null, err: "" });
    if (v !== J.code) { J.code = v; J.inv = null; J.err = ""; const st = $("#auJState"); if (st) st.innerHTML = `<p class="au-fine">${v.length < 8 ? `Encore ${8 - v.length} caractère${8 - v.length > 1 ? "s" : ""}` : ""}</p>`; const b = $("#au [data-au=join] .au-submit"); b && b.setAttribute("disabled", ""); SFX.tick(); if (v.length === 8) { t.blur(); AUTH.lookup(v); } }
    AUTH.codeCells(); return;
  }
  if (t.id === "auRName") { AUTH.ui.create.name = t.value; AUTH.createPrev(); }
  if (t.id === "auRMe") AUTH.ui.create.me = t.value;
  if (t.id === "auEmail" || t.id === "auREmail") AUTH.ui.email = t.value;
  if (t.id === "auPw") AUTH.ui.pw = t.value;
  if (t.id === "auName") AUTH.ui.name = t.value;
  if (AUTH.ui.err && t.closest(".au-form")) { AUTH.ui.err = ""; const er = $("#au .au-err"); if (er) { er.classList.add("bye"); setTimeout(() => er.remove(), 260); } }
  AUTH.validate();
});
document.addEventListener("focusout", (e) => { const t = e.target; if (t && t.id === "auEmail" && t.value) { t.dataset.touched = "1"; AUTH.validate(); } if (t && t.id === "auCode") setTimeout(() => AUTH.codeCells(), 0); });
document.addEventListener("focusin", (e) => { if (e.target && e.target.id === "auCode") AUTH.codeCells(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#au.on") && AUTH.inApp && !$("#sheet.open")) { e.stopPropagation(); ACT.auClose(); } }, true);

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  auGoogle: () => { SFX.tap(); buzz(5); AUTH.google(); },
  auEmail: () => { SFX.tap(); buzz(5); AUTH.ui.err = ""; if (!AUTH.cfg) { AUTH.show("soon"); return; } AUTH.show("email"); },
  auTab: (a, id, v) => { if (AUTH.ui.tab === v) return; SFX.tick(); buzz(4); const em = $("#auEmail"), pw = $("#auPw"), nm = $("#auName"); if (em) AUTH.ui.email = em.value; if (pw) AUTH.ui.pw = pw.value; if (nm) AUTH.ui.name = nm.value; AUTH.ui.tab = v; AUTH.ui.err = ""; AUTH.paint(); },
  auEye: () => { const p = $("#auPw"); if (!p) return; AUTH.ui.show = !AUTH.ui.show; p.type = AUTH.ui.show ? "text" : "password"; const b = $("#au .au-eye"); if (b) { b.innerHTML = ico(AUTH.ui.show ? "auEyeOff" : "auEye"); b.setAttribute("aria-label", (AUTH.ui.show ? "Masquer" : "Afficher") + " le mot de passe"); } SFX.tick(); p.focus({ preventScroll: true }); },
  auForgot: () => { SFX.tap(); const e = $("#auEmail"); if (e) AUTH.ui.email = e.value; AUTH.ui.sent = false; AUTH.ui.err = ""; AUTH.show("reset"); },
  auBackToIn: () => { SFX.tap(); AUTH.ui.sent = false; AUTH.ui.tab = "in"; AUTH.ui.back = AUTH.ui.back.filter((x) => x !== "reset" && x !== "email"); AUTH.show("email"); },
  auBack: () => { SFX.tap(); const p = AUTH.ui.back.pop(); AUTH.ui.err = ""; if (p) AUTH.show(p, { push: false }); },
  auClose: () => { SFX.close(); AUTH.hide(); },
  auDemo: () => { SFX.tap(); buzz(6); if (DB.uid) return; AUTH.ui.busyTx = "Préparation de la démo…"; AUTH.show("busy", { push: false }); setTimeout(() => AUTH.startDemo(), 380); },
  auLocal: () => { SFX.tap(); auLS.set("gg-mode", "local"); auLS.del("gg-invite"); auLS.sdel("gg-demo"); if (AUTH.resolve) { AUTH.hide(); AUTH.resolve({ mode: "local" }); } else location.reload(); },
  auSwitch: async () => { SFX.tap(); try { await AUTH.auth.signOut(); } catch (e) {} AUTH.user = null; auLS.set("gg-mode", "out"); AUTH.ui.back = []; AUTH.show("welcome", { push: false }); },
  auCreate: () => { SFX.tap(); buzz(5); AUTH.ui.err = ""; AUTH.show("create"); },
  auType: (a, id, v) => { AUTH.ui.create.type = v; $$("#au [data-act=auType]").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); SFX.tick(); buzz(4); AUTH.createPrev(); },
  auFr: (a, id, v) => { const C = AUTH.ui.create; const i = C.frs.indexOf(v); i >= 0 ? C.frs.splice(i, 1) : C.frs.push(v); const on = i < 0; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); const f = AU_FRIDGES.find((x) => x[0] === v); a.innerHTML = `${on ? ico("check") : ""}${esc(v)}<em class="mono">${f[2]}/${f[3]}°</em>`; SFX.tick(); buzz(4); AUTH.createPrev(); },
  auJoinOpen: () => {
    SFX.tap(); closeSheet(true);
    if (!AUTH.user) { if (DB.mode === "demo") { toast("Créez d'abord votre compte.", "info"); return; } AUTH.openWelcome(); return; }
    if (!$("#au.on")) { AUTH.inApp = true; AUTH.ui.back = []; AUTH.mount(); }
    AUTH.openJoin("");
  },
  auImport: () => AUTH.importLocal(),
  auImportSkip: () => { SFX.tap(); auLS.set("gg-imp-" + AUTH.user.uid, "no"); if (AUTH.restos.length) AUTH.enter(); else AUTH.show("setup", { reset: true }); },
  auImportGo: () => { SFX.tap(); AUTH.enter(AUTH.ui.imp && AUTH.ui.imp.rid); },
  auImportOpen: () => { SFX.tap(); AUTH.inApp = true; AUTH.ui.back = []; AUTH.ui.imp = {}; AUTH.mount(); AUTH.show("import", { push: false }); },
  auOpen: () => { closeSheet(true); AUTH.openWelcome(); },
  auSignOut: () => {
    SFX.tap();
    openSheet(`<div class="au-sh"><span class="au-shic">${ico("out")}</span><div class="h2">Se déconnecter ?</div><p class="sub">Vos données restent dans votre compte. Cet appareil oubliera ${esc(S.resto?.name || "le restaurant")} jusqu'à la prochaine connexion.</p>
      <button class="btn danger block" data-act="auSignOutOk">${ico("out")}Se déconnecter</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
  },
  auSignOutOk: () => { closeSheet(true); AUTH.signOut(); },
  auDemoSignup: () => { SFX.tap(); AUTH.openWelcome({ screen: AUTH.cfg ? "email" : "soon", tab: "up" }); },
  auDemoLeave: () => AUTH.leaveDemo(),
  auInvite: () => AUTH.inviteSheet(),
  auInvRole: (a, id, v) => { S.ui.auInv.role = v; $$("#sheetBody .au-role").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); SFX.tick(); buzz(4); },
  auInvCreate: () => AUTH.invCreate(),
  auInvShare: () => AUTH.invShare(),
  auInvCopy: (a, id, v) => AUTH.invCopy(v),
  auInvNew: () => { SFX.tap(); S.ui.auInv.cur = null; AUTH.invPaint(); },
  auInvRevoke: (a, id) => AUTH.invRevoke(id),
});

/* ───────────── light-touch integration with js/compte.js (it may also call the hooks itself) ───────────── */
(function auIntegrate() {
  /* Réglages: a « Compte » card (sign-out, invites, import), unless compte.js already placed AUTH.reglagesHTML() */
  const R = VIEWS.reglages;
  if (R && R.render && !R._au) {
    const r0 = R.render; R._au = true;
    R.render = function () { const h = r0.apply(this, arguments); if (typeof h !== "string" || h.includes("au-acct")) return h; const card = AUTH.reglagesHTML(); const i = h.lastIndexOf('<div class="cc-about'); return i >= 0 ? h.slice(0, i) + `<div class="au-acct-wrap">${card}</div>` + h.slice(i) : h.replace(/<\/div>\s*$/, `<div class="au-acct-wrap">${card}</div></div>`); };
  }
  /* Établissements sheet: with an account or in the demo, add « Rejoindre » and « Inviter » */
  const sw0 = ACT.restoSwitch;
  if (sw0 && !sw0._au) {
    ACT.restoSwitch = async function () {
      const r = await sw0.apply(this, arguments);
      if (DB.mode === "local" || !$("#sheet").classList.contains("open")) return r;
      const b = $("#sheetBody"); if (!b || $(".au-swx", b)) return r;
      b.insertAdjacentHTML("beforeend", `<div class="au-swx">${myRole() === "gerant" ? `<button class="btn soft block" data-act="auInvite">${ico("auLink")}Inviter l'équipe</button>` : ""}${DB.uid ? `<button class="btn ghost block" data-act="auJoinOpen">${ico("users")}Rejoindre avec un code</button>` : ""}</div>`);
      return r;
    };
    ACT.restoSwitch._au = true;
  }
})();
