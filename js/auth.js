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
const AU_G = `<svg class="au-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
/* « Cuisine vivante » drawing kit: hand-tuned strokes, one weight family, no icon-font look */
const auSv = (d, w = 20, sw = 2) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const AU_SVG = {
  back: auSv('<path d="M19 12H5M11 6l-6 6 6 6"/>', 20, 2.2),
  x: auSv('<path d="M6 6l12 12M18 6 6 18"/>', 20, 2.2),
  mail: auSv('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'),
  arrow: auSv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  arrowS: auSv('<path d="M5 12h14M13 6l6 6-6 6"/>', 16),
  play: auSv('<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z" fill="currentColor"/>'),
  phone: auSv('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  eye: auSv('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: auSv('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>'),
  ok: `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cloche: `<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 20h20a10 10 0 0 0-20 0Z" fill="#F6B93B"/><path d="M4 23.5h24"/><path d="M16 8v2"/><circle cx="16" cy="7" r="1.6" fill="currentColor"/></svg>`,
};
const AU_DOTS = `<span class="au-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
const AU_DOTS_IN = `<span class="au-dots in" aria-hidden="true"><i></i><i></i><i></i></span>`;
const AU_SEAL = `<svg class="au-sealsvg" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><circle class="disc" cx="36" cy="36" r="30"/><circle class="ring" cx="36" cy="36" r="34" fill="none" stroke-width="3"/><path d="M24 37l8 8 16-17" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* the brand mark (exact artwork), with a gradient id unique to each copy */
const auMark = (id) => `<svg class="au-mark" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><defs><linearGradient id="auLg${id}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(-15 .5 .5)"><stop offset="0" stop-color="#8F63FF"/><stop offset=".55" stop-color="#4A1FE6"/><stop offset="1" stop-color="#2F1BC4"/></linearGradient></defs><rect width="512" height="512" rx="143.36" fill="url(#auLg${id})"/><svg x="97.28" y="97.28" width="317.44" height="317.44" viewBox="0 0 100 100"><path d="M86 16H50A34 34 0 0 0 25.96 74.04" fill="none" stroke="#fff" stroke-width="14"/><path d="M40.5 83.5 80 44M52 42h30v30" fill="none" stroke="#fff" stroke-width="12.5"/></svg></svg>`;
const auReduce = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const auFrHTML = (n, lo, hi, on) => `<i class="au-frk" aria-hidden="true">${on ? AU_SVG.ok : ""}</i>${esc(n)}<em>${lo}/${hi} °C</em>`;
/* camera framing of the kitchen (x, y, w, h in the 800×840 drawing) for each kind of step */
const AUK_FOCUS = {
  desk: { welcome: [0, 0, 800, 840], soon: [0, 0, 800, 840], form: [0, 0, 800, 840], busy: [0, 0, 800, 840], done: [30, 220, 540, 560] },
  tab: { welcome: [0, 90, 800, 480], soon: [0, 90, 800, 480], form: [0, 180, 800, 300], busy: [0, 90, 800, 480], done: [0, 180, 800, 520] },
  phone: { welcome: [40, 92, 640, 470], soon: [40, 92, 640, 470], form: [250, 200, 480, 200], busy: [40, 92, 640, 470], done: [30, 200, 420, 420] },
};
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
      /* links from the marketing site (growthgusto.fr): ?signup=1 (create an account), &plan=essentiel|complet (the pack chosen there,
         remembered until the restaurant is created), ?login=1 (sign in), ?admin=1 (the Growth Gusto admin space, js/abo.js) */
      const wantSignup = q.has("signup"), wantLogin = q.has("login"), wantAdmin = q.has("admin"), plan = String(q.get("plan") || "").toLowerCase();
      if (plan === "essentiel" || plan === "complet") auLS.set("gg-plan", plan);
      if (wantAdmin) auLS.sset("gg-admin", "1");
      ["invite", "local", "demo", "signup", "login", "plan", "admin"].forEach((k) => { if (q.has(k)) { q.delete(k); strip = true; } });
      if (strip) { try { history.replaceState(null, "", u.pathname + (q.toString() ? "?" + q : "") + u.hash); } catch (e) {} }
      this.flash();
      if (wantLocal) { auLS.set("gg-mode", "local"); auLS.set("gg-local-ok", "1"); auLS.sdel("gg-demo"); return this.resolve({ mode: "local" }); }
      if (wantDemo || auLS.sget("gg-demo") === "1") return this.startDemo();
      const mode = auLS.get("gg-mode"), invite = auLS.get("gg-invite");
      if (mode === "cloud" && this.cfg) return this.resume();
      if (wantSignup || wantLogin || wantAdmin) { auLS.sdel("gg-demo"); this.ui.tab = wantSignup ? "up" : "in"; this.ui.back = ["welcome"]; return this.show(this.cfg ? "email" : "soon"); }
      /* stay on this device only when the person chose it on the welcome screen (gg-local-ok); phones that were auto-switched before accounts existed see the welcome once */
      if (!invite && mode === "local" && auLS.get("gg-local-ok") === "1") return this.resolve({ mode: "local" });
      this.show(invite && this.cfg ? "welcome" : "welcome");
    });
  },
  /* a returning signed-in user: SDK from the offline cache, auth state from IndexedDB, then straight in */
  async resume() {
    try { await this.sdk(); } catch (e) { this.ui.err = "Connexion impossible pour l'instant. Vérifiez le réseau, puis réessayez."; this.show("welcome"); return; }
    if (auLS.sget("gg-redirect")) {
      auLS.sdel("gg-redirect"); this._wasRedirect = true;
      try { const r = await this.auth.getRedirectResult(); if (r && r.user) auLS.set("gg-last", "google"); } catch (e) { this.ui.err = this.msg(e); }
    }
    const u = await this.firstUser();
    if (!u) { if (this._wasRedirect && !this.ui.err) this.ui.err = "Google n'a pas pu finir la connexion dans l'app installée sur l'iPhone. Continuez avec votre e-mail, ou ouvrez le lien dans Safari."; this.show("welcome"); return; }
    if (auLS.sget("gg-del-account") === "1") { this.user = u; auLS.sdel("gg-del-account"); return this.deleteAccount(true); }
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
    if (inv) return this.openJoin(inv, true);
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
    document.documentElement.classList.add("au-demomode");
    const b = document.createElement("div"); b.id = "auDemo"; b.className = "au-dbar"; b.setAttribute("role", "status");
    b.innerHTML = `<span class="au-demo-dot" aria-hidden="true">${AU_SVG.cloche}</span><span class="au-demo-tx"><b>Mode démo</b><span><i class="au-sep"> · </i>rien n'est enregistré</span></span><button class="au-demo-cta" data-act="auDemoSignup">Créer mon compte</button><button class="au-demo-x" data-act="auDemoLeave" aria-label="Quitter la démo">${ico("x")}</button>`;
    document.body.appendChild(b); requestAnimationFrame(() => b.classList.add("on"));
  },

  /* ───────────── overlay: « Cuisine vivante » — the form on the left, a living kitchen on the right (on top on phones) ───────────── */
  mount() {
    let el = $("#au"); if (el) return el;
    el = document.createElement("div"); el.id = "au"; el.className = "au"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Bienvenue sur Growth Gusto");
    el.innerHTML = `<div class="au-scroll" id="auScroll"><div class="au-app">
        <main class="au-auth" id="auAuth">
          <div class="au-brand">${appIcon(36)}<span class="au-wm">Growth <b>Gusto</b></span></div>
          <div class="au-deck" id="auDeck"><div class="au-pane" id="auPane" aria-live="polite"></div></div>
          <p class="au-fine au-fine-d">Données hébergées en France et chiffrées.</p>
        </main>
        <aside class="au-stage" id="auStage" aria-hidden="true">
          <div class="au-sbrand">${appIcon(30)}<span class="au-wm">Growth <b>Gusto</b></span></div>
          <div class="auk" id="auk">${this.stageHTML()}</div>
          <div class="auk-night"></div>
        </aside>
        <button class="au-xf" data-act="auClose" aria-label="Fermer">${AU_SVG.x}</button>
      </div></div>`;
    document.body.appendChild(el);
    const fr = $("#aukFridge", el), pr = $("#aukPrinter", el);
    fr && fr.addEventListener("click", () => fr.classList.toggle("open"));
    pr && pr.addEventListener("click", () => this.print());
    return el;
  },
  /* the kitchen of Chemin des Sarments: fridge with its thermometer, label printer, sauce pot, oysters, and the ticket rail */
  stageHTML() {
    /* V2 flat drawing: no outlines, cream appliances with a lilac inner edge, dark LCD screens with mint digits, on the violet grid wall */
    const fr = (x, y, w, h, r = 14) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#E4DCF7"/><rect x="${x}" y="${y}" width="${w}" height="${h - 14}" rx="${r}" fill="#FFFDF8"/><rect x="${x + w - 20}" y="${y + 10}" width="10" height="${h - 34}" rx="5" fill="#EEE9FB"/>`;
    const lcd = (x, y, w, h, t, fs = 20) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#1B1530"/><text x="${x + w / 2}" y="${y + h / 2 + fs * 0.36}" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="${fs}" fill="#9EF5C4">${t}</text>`;
    return `<svg viewBox="0 0 800 840" aria-hidden="true" focusable="false">
      <rect x="-400" y="648" width="1600" height="600" fill="#1B1530" fill-opacity=".14"/>
      <rect x="-400" y="638" width="1600" height="10" fill="#FFFDF8" fill-opacity=".88"/>
      <g id="aukFridge">
        ${fr(60, 150, 200, 498, 18)}
        <rect x="74" y="262" width="166" height="5" rx="2.5" fill="#EEE9FB"/><rect x="214" y="180" width="8" height="54" rx="4" fill="#C9BFE9"/>
        <text x="84" y="216" font-family="Instrument Sans, ui-sans-serif, sans-serif" font-weight="700" font-size="15" fill="#B5ABD3">Chambre froide</text>
        <g><rect x="74" y="278" width="166" height="340" rx="10" fill="#FFF4D9"/><rect id="aukLight" x="82" y="284" width="150" height="70" rx="8" fill="#FFFBEF"/>
          <rect x="128" y="286" width="60" height="6" rx="3" fill="#F6B93B"/><path d="M78 392h158M78 500h158" stroke="#EADBB8" stroke-width="5" stroke-linecap="round"/>
          <rect x="90" y="340" width="70" height="50" rx="6" fill="#E4DCF7"/><rect x="104" y="356" width="40" height="18" rx="3" fill="#fff"/>
          <path d="M196 390v-36l7-10v-12h10v12l7 10v36z" fill="#2FA36B"/>
          <rect x="88" y="448" width="96" height="50" rx="6" fill="#E8B26A"/><rect x="104" y="458" width="62" height="12" rx="2" fill="#fff"/>
          <circle cx="210" cy="480" r="18" fill="#EF5A3C"/><path d="M204 462c4 2 8 2 12 0" stroke="#2FA36B" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path d="M92 598v-30l60-14v44z" fill="#F6B93B"/><circle cx="122" cy="580" r="4" fill="#D99A1E"/><rect x="166" y="560" width="62" height="38" rx="6" fill="#9EC5FF"/></g>
        <g id="aukDoor">
          <g id="aukDoorB"><rect x="74" y="278" width="166" height="340" rx="10" fill="#F2EADB"/><rect x="88" y="320" width="138" height="34" rx="6" fill="#FFFDF8"/><rect x="88" y="430" width="138" height="34" rx="6" fill="#FFFDF8"/><rect x="88" y="540" width="138" height="34" rx="6" fill="#FFFDF8"/></g>
          <g id="aukDoorF"><rect x="74" y="278" width="166" height="340" rx="10" fill="#FFFDF8"/><rect x="214" y="300" width="8" height="120" rx="4" fill="#C9BFE9"/>
            <rect x="90" y="300" width="112" height="70" rx="12" fill="#1B1530"/><rect id="aukLcd" x="96" y="306" width="100" height="58" rx="8" fill="#241C40"/>
            <rect x="105" y="314" width="8" height="34" rx="4" fill="none" stroke="#9EF5C4" stroke-width="2"/><rect id="aukMerc" x="107" y="320" width="4" height="28" rx="2" fill="#9EF5C4"/><circle cx="109" cy="352" r="5.5" fill="#9EF5C4"/>
            <text id="aukT" x="188" y="343" text-anchor="end" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="28" fill="#9EF5C4">3,2</text>
            <text id="aukTs" x="188" y="357" text-anchor="end" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="500" font-size="9" fill="#9EF5C4" opacity=".75">°C · OK</text>
            <g transform="rotate(-4 140 500)"><rect x="96" y="446" width="92" height="104" rx="8" fill="#F6B93B"/><rect x="96" y="540" width="92" height="10" rx="5" fill="#D99A1E"/>
              <text x="108" y="472" font-family="Bricolage Grotesque, ui-sans-serif, sans-serif" font-weight="700" font-size="13" fill="#1B1530">Relevés</text>
              <path d="M108 490l4 4 7-8M108 510l4 4 7-8M108 530l4 4 7-8" fill="none" stroke="#1B1530" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M126 490h46M126 510h36M126 530h42" stroke="#7A5A1A" stroke-width="2" stroke-linecap="round" opacity=".6"/>
              <circle cx="142" cy="446" r="8" fill="#EF5A3C"/></g></g></g>
      </g>
      <g>${fr(296, 488, 236, 160, 12)}${lcd(314, 506, 92, 34, "2,8°")}<rect x="314" y="560" width="188" height="7" rx="3.5" fill="#C9BFE9"/>
        ${fr(550, 488, 236, 160, 12)}${lcd(568, 506, 92, 34, "−19°")}<rect x="568" y="560" width="188" height="7" rx="3.5" fill="#C9BFE9"/>
        <rect x="286" y="460" width="520" height="16" rx="6" fill="#FFFDF8"/><rect x="292" y="474" width="508" height="5" rx="2.5" fill="#E4DCF7"/></g>
      <g id="aukPrinter"><rect x="316" y="402" width="136" height="60" rx="14" fill="#E4DCF7"/><rect x="316" y="402" width="136" height="48" rx="14" fill="#FFFDF8"/>
        <rect x="334" y="398" width="100" height="10" rx="5" fill="#1B1530"/><circle cx="338" cy="428" r="5" fill="#2FA36B"/><rect x="352" y="424" width="40" height="8" rx="4" fill="#EEE9FB"/><circle class="auk-btnp" cx="428" cy="428" r="10" fill="#5B2BFF"/></g>
      <g id="aukPot"><g class="auk-steam"><path d="M528 360c-8-10 8-18 0-30"/><path d="M552 356c-8-10 8-18 0-30"/><path d="M576 360c-8-10 8-18 0-30"/></g>
        <rect x="474" y="408" width="20" height="12" rx="6" fill="#C8432A"/><rect x="610" y="408" width="20" height="12" rx="6" fill="#C8432A"/>
        <path d="M486 398h132v48a16 16 0 0 1-16 16H502a16 16 0 0 1-16-16z" fill="#EF5A3C"/><rect x="486" y="424" width="132" height="6" fill="#FF8A6F"/>
        <g id="aukLid"><path d="M480 400c0-14 32-24 72-24s72 10 72 24z" fill="#FFFDF8"/><rect x="540" y="362" width="24" height="16" rx="6" fill="#F6B93B"/></g></g>
      <g id="aukBoard"><rect x="648" y="450" width="140" height="12" rx="6" fill="#E8B26A"/>
        <g id="aukOyster"><circle cx="684" cy="432" r="18" fill="#EF5A3C"/><path class="auk-top" d="M676 416c6 3 11 3 16 0" stroke="#2FA36B" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="676" cy="428" r="4" fill="#FF8A6F"/></g>
        <g id="aukKnife"><path d="M712 450h44v-6c-22 0-32-8-44-2z" fill="#F4F2FA"/><rect x="754" y="441" width="34" height="9" rx="4.5" fill="#1B1530"/></g></g>
      <g><circle cx="356" cy="708" r="17" fill="#EF5A3C"/><circle cx="388" cy="704" r="18" fill="#EF5A3C"/><circle cx="420" cy="708" r="17" fill="#EF5A3C"/><circle cx="452" cy="706" r="16" fill="#C8432A"/>
        <rect x="330" y="712" width="150" height="62" rx="8" fill="#E8B26A"/><path d="M342 734h126M342 754h126" stroke="#D49A4E" stroke-width="5" stroke-linecap="round"/>
        <circle cx="528" cy="716" r="20" fill="#2FA36B"/><circle cx="562" cy="712" r="21" fill="#3DBB7C"/><circle cx="596" cy="718" r="18" fill="#2FA36B"/>
        <rect x="506" y="722" width="120" height="52" rx="8" fill="#E8B26A"/><path d="M518 744h96" stroke="#D49A4E" stroke-width="5" stroke-linecap="round"/>
        <path d="M664 774c-6-30-4-62 8-86 6-8 14-10 22-8l40 0c8-2 16 0 22 8 12 24 14 56 8 86z" fill="#FFFDF8"/><path d="M684 688c10 6 46 6 58 0" stroke="#E4DCF7" stroke-width="5" stroke-linecap="round" fill="none"/>
        <text x="714" y="740" text-anchor="middle" font-family="Bricolage Grotesque, ui-sans-serif, sans-serif" font-weight="700" font-size="17" fill="#B5ABD3">Farine</text></g>
    </svg>
    <div class="auk-rail"></div>
    <div class="auk-ticket" style="left:340px"><div class="auk-tk">Relevé · 07:42</div><div class="auk-tt">Chambre froide</div><div class="auk-tv">3,2<small> °C</small></div><div class="auk-ts">Conforme · Léa</div></div>
    <div class="auk-ticket" style="left:488px;width:140px"><div class="auk-tk">Livraison · 06:10</div><div class="auk-tt">Marée Atlantique</div><div class="auk-tl">Huîtres n°3<br>4 bourriches</div><div class="auk-ts w">Reçue à 4,1 °C</div></div>
    <div class="auk-ticket" style="left:644px;width:124px"><div class="auk-tk">Contrôle</div><div class="auk-tt">Cahier HACCP</div><div class="auk-tv s">100<small> %</small></div><div class="auk-tp"><b></b></div></div>
    <div class="auk-slot"><div class="auk-dlc printed" id="aukDlc"><div class="auk-dh"><span>GG · LOT 0412</span><i></i></div><div class="auk-dp" id="aukDlcP">Sauce tomate maison</div><div class="auk-dk">DLC</div><div class="auk-dd" id="aukDlcD">07/11</div><div class="auk-dm" id="aukDlcM">Par Léa · 07:40</div><div class="auk-bc"></div></div></div>
    <div class="auk-stamp" id="aukStamp"><div><b>Prêt</b><span>pour le contrôle</span></div></div>
    <div class="auk-cap"><b>Chemin des Sarments</b><br>Bordeaux · 42 couverts</div>`;
  },

  /* ── the kitchen reacts: camera framing per step, label printer, thermometer, stamp ── */
  sceneKey() {
    const s = this.ui.screen;
    if (s === "welcomeDone" || (s === "import" && this.ui.imp && this.ui.imp.done)) return "done";
    if (s === "busy") return "busy";
    if (s === "welcome" || s === "soon") return s;
    return "form";
  },
  cam(instant) {
    const st = $("#auStage"), sc = $("#auk"); if (!st || !sc) return;
    const k = this.sceneKey(), desk = window.matchMedia("(min-width:960px)").matches, vh = window.innerHeight;
    const tab = !desk && (st.clientWidth || window.innerWidth) >= 600;
    const F = AUK_FOCUS[desk ? "desk" : tab ? "tab" : "phone"][k];
    let W, H;
    if (desk) { st.style.removeProperty("--sh"); W = st.clientWidth; H = st.clientHeight; }
    else {
      W = st.clientWidth || window.innerWidth - 20;
      if (W >= 600) H = Math.round(Math.min(vh * (k === "form" ? 0.24 : k === "done" ? 0.42 : 0.37), W * (k === "form" ? 0.32 : 0.55)));
      else H = k === "welcome" ? Math.round(Math.min(300, Math.max(176, vh * 0.3))) : k === "done" ? Math.round(Math.min(420, Math.max(220, vh * 0.46))) : k === "busy" ? Math.round(Math.min(330, Math.max(200, vh * 0.36))) : vh < 700 ? 124 : 152;
      st.style.setProperty("--sh", H + "px");
    }
    if (!W || !H) return;
    const [fx, fy, fw, fh] = F; const s = Math.max(W / fw, H / fh, W / 800, H / 840);
    let tx = W / 2 - (fx + fw / 2) * s, ty = H / 2 - (fy + fh / 2) * s;
    tx = Math.min(0, Math.max(W - 800 * s, tx)); ty = Math.min(0, Math.max(H - 840 * s, ty));
    if (instant) sc.style.transition = "none";
    sc.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    if (instant) { void sc.offsetWidth; sc.style.transition = ""; }
  },
  /* what the label printer prints for the current step: first the person's first name, then the restaurant */
  labelTx() {
    const U = this.ui, s = U.screen, u = this.user;
    const me = firstName((u && u.displayName) || (U.create && U.create.me) || (U.tab === "up" ? U.name : "") || "");
    if (s === "email") return U.tab === "up" ? ["Compte cuisine", `Par ${me || "…"}`] : ["Compte cuisine", "Retour en cuisine"];
    if (s === "reset") return ["Nouveau mot de passe", U.sent ? "Lien envoyé" : "Lien par e-mail"];
    if (s === "delAccount" || s === "reauth") return ["Suppression du compte", "Définitif"];
    if (s === "setup") return [me ? `Cuisine de ${me}` : "Votre cuisine", `Par ${me || "vous"}`];
    if (s === "create") { const C = U.create || {}; const n = ($("#auRName")?.value ?? C.name ?? "").trim(); const t = (AU_TYPES.find((x) => x[0] === C.type) || AU_TYPES[0])[1]; return [n || "Votre restaurant", `Par ${me || "vous"} · ${t}`]; }
    if (s === "join") { const inv = U.join && U.join.inv; return inv ? [inv.restoName || "Votre équipe", `Rôle ${(AU_ROLES[inv.role] || AU_ROLES.equipe).t}`] : ["Invitation", "Code à 8 caractères"]; }
    if (s === "import") { const sm = this.localSummary(); return [sm.names[0] || "Données du téléphone", `${sm.docs} éléments`]; }
    if (s === "welcomeDone") return this._lbl || ["Votre restaurant", "Prêt"];
    return ["Sauce tomate maison", "Par Léa · 07:40"];
  },
  labelSync() {
    const P = $("#aukDlcP"), M = $("#aukDlcM"), D = $("#aukDlcD"); if (!P) return false;
    const [p, m] = this.labelTx(), d = new Date(), dlc = new Date(Date.now() + 3 * 864e5), dd = (x) => String(x.getDate()).padStart(2, "0") + "/" + String(x.getMonth() + 1).padStart(2, "0");
    const changed = !this._lbl || this._lbl[0] !== p;
    P.textContent = p; M.textContent = m.includes("·") || m.startsWith("Par Léa") ? m : `${m} · ${dd(d)}`; D.textContent = dd(dlc); this._lbl = [p, m];
    return changed;
  },
  print() {
    const d = $("#aukDlc"); if (!d) return;
    if (auReduce()) { d.className = "auk-dlc printed"; return; }
    d.className = "auk-dlc"; void d.offsetWidth; d.className = "auk-dlc printing";
    clearTimeout(this._pt); this._pt = setTimeout(() => { d.className = "auk-dlc printed"; }, 1120);
  },
  therm(reset) {
    const T = $("#aukT"), Mc = $("#aukMerc"), L = $("#aukLcd"), Ts = $("#aukTs"), St = $("#aukStamp"); if (!T) return;
    cancelAnimationFrame(this._raf);
    if (reset) { T.textContent = "3,2"; Mc.style.transform = "scaleY(.42)"; L.style.fill = ""; Ts.textContent = "°C · OK"; St.classList.remove("on"); this._dropped = false; return; }
    if (this._dropped) return; this._dropped = true;
    const from = 7.8, to = 3.2, dur = auReduce() ? 1 : 1000, t0 = performance.now();
    Mc.style.transition = "none"; Mc.style.transform = "scaleY(1)"; Ts.textContent = "°C · …"; L.style.fill = "#3A1E2E";
    requestAnimationFrame(() => { Mc.style.transition = ""; Mc.style.transform = "scaleY(.42)"; });
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      T.textContent = (from + (to - from) * e).toFixed(1).replace(".", ",");
      if (p < 1) this._raf = requestAnimationFrame(tick);
      else { Ts.textContent = "°C · OK"; L.style.fill = "#11402B"; St.classList.add("on"); buzz(14); }
    };
    this._raf = requestAnimationFrame(tick);
  },
  scene(first) {
    if (!$("#auk")) return;
    const s = this.ui.screen, k = this.sceneKey(), entered = this._sc !== s; this._sc = s;
    this.cam(first);
    const fr = $("#aukFridge"); fr && fr.classList.remove("open");
    if (k !== "done") this.therm(true);
    if (k === "done") { if (s !== "welcomeDone") this.labelSync(); setTimeout(() => this.therm(false), auReduce() ? 0 : 280); return; }
    const changed = this.labelSync();
    if (["email", "reset", "setup", "create", "join", "import"].includes(s) && (entered || changed)) { clearTimeout(this._pq); this._pq = setTimeout(() => this.print(), auReduce() || first ? 0 : 380); }
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
    cancelAnimationFrame(this._raf); clearTimeout(this._pt); clearTimeout(this._pq); this._sc = null; this._painted = null; this._lbl = null; this._dropped = false;
    setTimeout(() => { el.remove(); }, 520); this.inApp = false;
  },
  openWelcome(opt = {}) {
    this.inApp = true; this.ui.back = []; this.ui.err = "";
    if (opt.tab) this.ui.tab = opt.tab;
    this.mount(); this.show(opt.screen || "welcome", { push: false }); SFX.sheet();
  },
  /* screen swap: the old step lifts away while the new one rises in, line by line; a repaint of the same step only cross-fades */
  paint(first) {
    const pane = $("#auPane"); if (!pane) return;
    const s = this.ui.screen, same = !first && this._painted === s, reduce = auReduce();
    if (!first && !same && !reduce && pane.childElementCount) {
      const old = pane.cloneNode(true); old.removeAttribute("id"); old.removeAttribute("aria-live"); old.setAttribute("aria-hidden", "true"); old.className = "au-pane au-leave"; old.inert = true;
      $$("[id],[for]", old).forEach((n) => { n.removeAttribute("id"); n.removeAttribute("for"); });
      $$("form", old).forEach((f) => f.removeAttribute("data-au"));
      old.style.top = pane.offsetTop + "px"; old.style.left = pane.offsetLeft + "px"; old.style.width = pane.offsetWidth + "px";
      pane.parentNode.appendChild(old); setTimeout(() => old.remove(), 240);
    }
    pane.classList.toggle("au-swap", same); pane.classList.toggle("au-later", !first && !same);
    pane.innerHTML = this.screenHTML(); this._painted = s;
    if (!first && !same) { const sc = $("#auScroll"), a = $("#auAuth"); [sc, a].forEach((x) => { if (x && x.scrollTop > 0) x.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }); }
    this.after(); this.scene(first);
  },
  after() {
    const s = this.ui.screen, desk = window.matchMedia("(min-width:960px)").matches;
    const f = { email: this.ui.tab === "up" && !this.ui.name ? "#auName" : "#auEmail", reset: "#auREmail", create: "#auRName", join: "#auCode", reauth: "#auRePw", delAccount: "#auConfIn" }[s];
    if (f && (desk || s === "join" || s === "reauth")) setTimeout(() => { const i = $(f); if (i && !i.value) i.focus({ preventScroll: true }); }, 380);
    if (s === "email" || s === "reset" || s === "create") this.validate();
    if (s === "join") this.codeCells();
    if (s === "create") this.createPrev();
    /* the segmented control's knob slides from the previous tab */
    const sg = $("#au .au-seg");
    if (sg) { const to = this.ui.tab === "up" ? "up" : "in"; if (this._seg && this._seg !== to && !auReduce()) { sg.dataset.mode = this._seg; void sg.offsetWidth; } sg.dataset.mode = to; this._seg = to; } else this._seg = null;
  },
  /* the pack chosen on growthgusto.fr (?plan=), shown while the account and the restaurant are created */
  packHTML(i = 3) {
    const p = auLS.get("gg-plan") === "essentiel" ? "essentiel" : "complet", t = p === "essentiel" ? "Essentiel" : "Complet", price = p === "essentiel" ? 49 : 99;
    return `<div class="au-pack st" style="--i:${i}"><span class="au-pack-ic" aria-hidden="true">${ico("sparkle")}</span><div><b>Essai gratuit 14 jours · Pack ${t}</b><span>Sans engagement, sans carte bancaire. Ensuite ${price} € HT par mois, si vous continuez.</span></div></div>`;
  },
  backBtn() { return this.ui.back.length ? `<button class="au-back" data-act="auBack" aria-label="Retour">${AU_SVG.back}</button>` : this.inApp ? `<button class="au-back" data-act="auClose" aria-label="Fermer">${AU_SVG.x}</button>` : ""; },
  errHTML() { return this.ui.err ? `<div class="au-err" role="alert">${ico("alert")}<span>${esc(this.ui.err)}</span></div>` : ""; },

  screenHTML() {
    const U = this.ui, s = U.screen, busy = (k) => (U.busy === k ? " au-busy" : "");
    const dots = AU_DOTS;
    const top = (right = "") => { const b = this.backBtn(); return b || right ? `<div class="au-top st" style="--i:0">${b || "<span></span>"}${right}</div>` : ""; };
    const head = (t, sub, i = 1) => `<h2 class="au-h2 st" style="--i:${i}">${t}</h2>${sub ? `<p class="au-sub st" style="--i:${i + 1}">${sub}</p>` : ""}`;
    const okI = `<i class="au-ok" aria-hidden="true">${AU_SVG.ok}</i>`;
    if (s === "welcome") {
      const inv = auLS.get("gg-invite"), last = auLS.get("gg-last");
      const lede = this.inApp && DB.mode === "local" ? "Créez votre compte : vos données vous suivent sur tous vos appareils." : inv ? "Connectez-vous pour rejoindre l'équipe. Relevés, étiquettes et planning, partagés en direct." : "Températures, étiquettes et contrôle sanitaire. Sans papier, sans stress.";
      const lastTag = `<em class="au-last">Dernière fois</em>`;
      return `${inv ? `<div class="au-invite st" style="--i:0"><span class="au-invic">${ico("users")}</span><div><b>Vous êtes invité dans une équipe</b><span>Connectez-vous pour la rejoindre · code <span class="au-mono">${esc(auFmtCode(inv))}</span></span></div></div>` : `<p class="au-eyebrow st" style="--i:0">Le cahier HACCP qui se remplit tout seul</p>`}
        <h1 class="au-h1 st" style="--i:1">${inv ? "Votre brigade<br><em>vous attend.</em>" : "Tout est relevé.<br><em>Vous, cuisinez.</em>"}</h1>
        <p class="au-lede st" style="--i:2">${lede}</p>
        ${this.errHTML()}
        <div class="au-stack st" style="--i:3">
          <button class="au-tac au-btn au-google${busy("google")}" data-act="auGoogle"><span class="au-bl">${AU_G}Continuer avec Google</span>${last === "google" ? lastTag : ""}${dots}</button>
          <button class="au-tac au-btn au-primary au-mailb" data-act="auEmail"><span class="au-bl">${AU_SVG.mail}Continuer avec un e-mail</span>${last === "email" ? lastTag : ""}</button>
        </div>
        ${DB.mode === "demo" ? "" : `<button class="au-demo st" style="--i:4" data-act="auDemo"><span class="au-demo-ic" aria-hidden="true">${AU_SVG.cloche}</span><span class="au-demo-l"><b>Essayer la démo</b><span>Un restaurant déjà rempli. Rien n'est enregistré.</span></span><span class="au-arr" aria-hidden="true">${AU_SVG.arrow}</span></button>`}
        ${this.inApp ? "" : `<button class="au-ghost st" style="--i:5" data-act="auLocal">${this.hasLocal() ? "Continuer avec les données de ce téléphone" : "Continuer sans compte"}${AU_SVG.arrowS}</button>`}
        <p class="au-fine au-fine-m st" style="--i:6">Données hébergées en France et chiffrées.</p>`;
    }
    if (s === "soon") {
      return `${top()}${head("Les comptes arrivent.", "Nous finalisons la connexion sécurisée.")}
        <div class="au-note st" style="--i:3"><p>Très bientôt : un compte pour votre restaurant, sur tous vos appareils, et l'équipe invitée en un lien.</p><p class="au-note-s">En attendant, essayez la démo ou utilisez l'app sur cet appareil. Vous pourrez tout importer ensuite.</p></div>
        <div class="au-stack st" style="--i:4"><button class="au-tac au-primary" data-act="auDemo"><span class="au-bl">${AU_SVG.play}Essayer la démo</span></button>${this.inApp ? "" : `<button class="au-tac" data-act="auLocal"><span class="au-bl">${AU_SVG.phone}Continuer sur cet appareil</span></button>`}</div>`;
    }
    if (s === "email") {
      const up = U.tab === "up", back = !!auLS.get("gg-last-email");
      return `${top(`<div class="au-seg" role="tablist" aria-label="Mode" data-mode="${up ? "up" : "in"}"><span class="au-segi" aria-hidden="true"></span><button role="tab" aria-selected="${!up}" class="${up ? "" : "on"}" data-act="auTab" data-v="in">Connexion</button><button role="tab" aria-selected="${up}" class="${up ? "on" : ""}" data-act="auTab" data-v="up">Créer un compte</button></div>`)}
        ${head(up ? "Ouvrons votre cuisine." : back ? "Bon retour en cuisine." : "Entrez en cuisine.", up ? "30 secondes, et votre cahier HACCP tient tout seul." : back ? "Vos relevés du jour vous attendent." : "Avec l'e-mail de votre compte.")}
        ${up ? this.packHTML(3) : ""}
        ${this.errHTML()}
        <form class="au-form st" style="--i:${up ? 4 : 3}" data-au="email" novalidate>
          ${up ? `<label class="au-f${this._seg === "in" ? " au-grow" : ""}"><span class="au-lbl">Prénom</span><div class="au-in"><input class="au-input" id="auName" autocomplete="given-name" maxlength="40" placeholder="Marceau" value="${esc(U.name)}" enterkeyhint="next">${okI}</div></label>` : ""}
          <label class="au-f"><span class="au-lbl">E-mail</span><div class="au-in"><input class="au-input" id="auEmail" type="email" inputmode="email" autocomplete="${up ? "email" : "username"}" autocapitalize="off" spellcheck="false" placeholder="chef@votre-restaurant.fr" value="${esc(U.email || auLS.get("gg-last-email") || "")}" enterkeyhint="next">${okI}</div><em class="au-hint" id="auEmailH" aria-live="polite"></em></label>
          <div class="au-f"><div class="au-lrow"><label class="au-lbl" for="auPw">Mot de passe</label>${up ? "" : `<button type="button" class="au-forgot" data-act="auForgot">Mot de passe oublié ?</button>`}</div>
            <div class="au-in"><input class="au-input" id="auPw" type="${U.show ? "text" : "password"}" autocomplete="${up ? "new-password" : "current-password"}" minlength="8" placeholder="${up ? "8 caractères minimum" : "Votre mot de passe"}" value="${esc(U.pw)}" enterkeyhint="go">${okI}<button type="button" class="au-eye" data-act="auEye" aria-label="${U.show ? "Masquer" : "Afficher"} le mot de passe">${U.show ? AU_SVG.eyeOff : AU_SVG.eye}</button></div>
            ${up ? `<div class="au-meter" id="auMeter" data-s="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="au-mrow"><span>Solidité</span><em class="au-hint" id="auPwH">${AU_PW_TX[0]}</em></div>` : ""}</div>
          <button class="au-tac au-primary au-submit${busy("email")}" type="submit" id="auGo"><span class="au-bl">${up ? "Créer mon compte" : "Se connecter"}</span>${dots}</button>
          <p class="au-legal">${up ? "En créant un compte, vous devenez gérant de votre restaurant. Vous inviterez votre équipe ensuite." : "Protégé par chiffrement. Vos données restent en France."}</p>
        </form>`;
    }
    if (s === "reset") {
      if (U.sent) return `${top()}<div class="au-seal st" style="--i:1">${AU_SEAL}</div>${head("Vérifiez vos e-mails.", `Un lien vient de partir vers <b>${esc(U.email)}</b>. Choisissez-y un nouveau mot de passe, et pensez aux courriers indésirables.`, 2)}
        <div class="au-stack st" style="--i:4"><button class="au-tac au-primary" data-act="auBackToIn"><span class="au-bl">Revenir à la connexion</span></button></div>`;
      return `${top()}${head("Mot de passe oublié ?", "On vous envoie un lien pour en choisir un nouveau.")}
        ${this.errHTML()}
        <form class="au-form st" style="--i:3" data-au="reset" novalidate><label class="au-f"><span class="au-lbl">E-mail</span><div class="au-in"><input class="au-input" id="auREmail" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="chef@votre-restaurant.fr" value="${esc(U.email || auLS.get("gg-last-email") || "")}" enterkeyhint="send">${okI}</div></label>
        <button class="au-tac au-primary au-submit${busy("reset")}" type="submit" id="auRGo"><span class="au-bl">Envoyer le lien</span>${dots}</button></form>`;
    }
    if (s === "busy") return `<div class="au-busyp"><span class="au-busym st" style="--i:0">${appIcon(64)}</span><h2 class="au-h2 st" style="--i:1">${esc(U.busyTx || "Connexion…")}</h2><span class="au-bdots st" style="--i:2" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
    const who = this.user ? `<div class="au-who st" style="--i:0">${this.user.photoURL ? `<img src="${esc(this.user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="au-wi">${esc(initials(this.user.displayName || this.user.email || "?"))}</span>`}<div><b>${esc(this.user.displayName || firstName(String(this.user.email || "").split("@")[0]))}</b><span>${esc(this.user.email || "")}</span></div><button class="au-chg" data-act="auSwitch">Changer</button></div>` : "";
    if (s === "setup") {
      const me = this.user && this.user.displayName ? firstName(this.user.displayName) : "";
      return `${who}${head(me ? `Bienvenue, ${esc(me)}.` : "Bienvenue.", "Votre restaurant est-il déjà sur Growth Gusto ?")}
        <div class="au-choices">
          <button class="au-choice st" style="--i:3" data-act="auCreate"><span class="au-cic">${ico("store")}</span><span class="au-ctx"><b>Créer mon restaurant</b><span>Je suis gérant, je démarre</span></span><span class="au-arr" aria-hidden="true">${AU_SVG.arrow}</span></button>
          <button class="au-choice st" style="--i:4" data-act="auJoinOpen"><span class="au-cic alt">${ico("users")}</span><span class="au-ctx"><b>Rejoindre une équipe</b><span>J'ai un code ou un lien d'invitation</span></span><span class="au-arr" aria-hidden="true">${AU_SVG.arrow}</span></button>
        </div>
        <button class="au-ghost au-delacc st" style="--i:5" data-act="auDelAccount">Supprimer mon compte${AU_SVG.arrowS}</button>`;
    }
    /* typed confirmation inside the overlay (sheets sit under it): used from the « setup » screen */
    if (s === "delAccount") {
      const u = this.user || {};
      return `${top()}${head("Supprimer mon compte ?", `Vous quitterez vos équipes, les restaurants que vous possédez seront supprimés avec leurs données, puis le compte <b>${esc(u.email || "")}</b> sera effacé. C'est définitif.`)}
        ${this.errHTML()}
        <form class="au-form st" style="--i:3" data-au="delacc" novalidate><label class="au-f"><span class="au-lbl">Pour confirmer, tapez EFFACER</span><div class="au-in"><input class="au-input mono" id="auConfIn" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="EFFACER" enterkeyhint="done"></div></label>
        <button class="au-tac au-primary au-submit au-danger" type="submit" id="auConfGo" disabled><span class="au-bl">${ico("trash")}Supprimer définitivement</span>${dots}</button></form>`;
    }
    /* Firebase asks for a fresh sign-in before deleting an account (e-mail accounts: the password) */
    if (s === "reauth") {
      const u = this.user || {};
      return `${head("Confirmez votre mot de passe.", `Par sécurité, avant de supprimer le compte <b>${esc(u.email || "")}</b>.`)}
        ${this.errHTML()}
        <form class="au-form st" style="--i:3" data-au="reauth" novalidate><label class="au-f"><span class="au-lbl">Mot de passe</span><div class="au-in"><input class="au-input" id="auRePw" type="password" autocomplete="current-password" placeholder="Votre mot de passe" enterkeyhint="go"></div></label>
        <button class="au-tac au-primary au-submit au-danger${busy("reauth")}" type="submit" id="auReGo"><span class="au-bl">${ico("trash")}Supprimer définitivement</span>${dots}</button>
        <button class="au-ghost" type="button" data-act="auReauthCancel">Annuler</button></form>`;
    }
    if (s === "create") {
      const C = (U.create ||= { name: "", type: "bistrot", frs: ["Chambre froide", "Frigo de service 1", "Frigo de service 2", "Congélateur"], me: "" });
      const needName = !(this.user && this.user.displayName);
      return `${top()}${head("Créons votre restaurant.", "Tout se modifie ensuite dans Réglages.")}
        ${this.packHTML(3)}
        ${this.errHTML()}
        <form class="au-form st" style="--i:3" data-au="create" novalidate>
          ${needName ? `<label class="au-f"><span class="au-lbl">Votre prénom</span><div class="au-in"><input class="au-input" id="auRMe" autocomplete="given-name" maxlength="40" placeholder="Il signe vos relevés" value="${esc(C.me)}">${okI}</div></label>` : ""}
          <label class="au-f"><span class="au-lbl">Nom du restaurant</span><div class="au-in"><input class="au-input" id="auRName" autocomplete="organization" maxlength="80" placeholder="Chemin des Sarments" value="${esc(C.name)}">${okI}</div></label>
          <div class="au-f"><span class="au-lbl" id="auTypeL">Type de cuisine</span><div class="au-chips" role="radiogroup" aria-labelledby="auTypeL">${AU_TYPES.map(([k, t]) => `<button type="button" class="au-chip ${C.type === k ? "on" : ""}" role="radio" aria-checked="${C.type === k}" data-act="auType" data-v="${k}">${t}</button>`).join("")}</div></div>
          <div class="au-f"><span class="au-lbl" id="auFrL">Vos équipements froids</span><div class="au-chips" role="group" aria-labelledby="auFrL">${AU_FRIDGES.map(([n, , lo, hi]) => `<button type="button" class="au-chip au-fr ${C.frs.includes(n) ? "on" : ""}" aria-pressed="${C.frs.includes(n)}" data-act="auFr" data-v="${esc(n)}">${auFrHTML(n, lo, hi, C.frs.includes(n))}</button>`).join("")}</div></div>
          <div class="au-prev" id="auPrev" aria-live="polite"><div class="au-pvh"><span class="au-pm">R</span><div class="au-pvn"><b>Votre restaurant</b><em></em></div><span class="au-pvtag">Aperçu</span></div><div class="au-pvl"></div></div>
          <button class="au-tac au-primary au-submit${busy("create")}" type="submit"><span class="au-bl">Créer mon restaurant</span>${dots}</button>
        </form>`;
    }
    if (s === "join") {
      const J = (U.join ||= { code: "", inv: null, err: "", loading: false });
      const inv = J.inv; const exp = inv ? Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / 864e5)) : 0;
      return `${top()}${head("Rejoindre une équipe.", "Le gérant vous a donné un code à 8 caractères.")}
        <form class="au-form st" style="--i:3" data-au="join" novalidate>
          <label class="au-codebox" for="auCode"><input id="auCode" class="au-codein" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" spellcheck="false" maxlength="40" value="${esc(J.code)}" aria-label="Code d'invitation"><span class="au-cells" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i data-i="${i}"></i>${i === 3 ? "<b>–</b>" : ""}`).join("")}</span></label>
          <div class="au-jstate" id="auJState">${J.loading ? `<div class="au-jload">${AU_DOTS_IN}Recherche de l'invitation…</div>` : J.err ? `<div class="au-err" role="alert">${ico("alert")}<span>${esc(J.err)}</span></div>` : inv ? `<div class="au-jcard"><span class="au-pm">${esc(initials(inv.restoName || "R"))}</span><div><b>${esc(inv.restoName || "Restaurant")}</b><em>Invité par ${esc(inv.createdByName || "le gérant")} · rôle ${esc((AU_ROLES[inv.role] || AU_ROLES.equipe).t)}</em></div><span class="au-jexp">${exp > 1 ? `${exp} jours` : "Valable"}</span></div>` : `<p class="au-fine">Vous pouvez aussi coller le lien reçu par message.</p>`}</div>
          <button class="au-tac au-primary au-submit${busy("join")}" type="submit" ${inv ? "" : "disabled"}><span class="au-bl">${inv ? `Rejoindre ${esc(inv.restoName || "l'équipe")}` : "Rejoindre"}</span>${dots}</button>
        </form>`;
    }
    if (s === "import") {
      const I = U.imp || {}; const sm = this.localSummary();
      if (I.done) return `<div class="au-seal st" style="--i:0">${AU_SEAL}</div>${head("Tout est dans votre compte.", `${I.n} élément${I.n > 1 ? "s" : ""} importé${I.n > 1 ? "s" : ""}${I.skipped ? ` · ${I.skipped} ignoré${I.skipped > 1 ? "s" : ""}` : ""}. Vos données restent aussi sur ce téléphone.`)}<div class="au-stack st" style="--i:3"><button class="au-tac au-primary" data-act="auImportGo"><span class="au-bl">Ouvrir mon restaurant${AU_SVG.arrowS}</span></button></div>`;
      return `${who}${head("Vos données sont sur ce téléphone.", "Importez-les dans votre compte : rien n'est perdu.")}
        ${this.errHTML()}
        <div class="au-imp st" style="--i:3"><div class="au-imph"><span class="au-pm">${esc(initials(sm.names[0] || "R"))}</span><div><b>${esc(sm.names.join(", ") || "Votre restaurant")}</b><em>${sm.docs} éléments enregistrés ici</em></div></div>
          <div class="au-kpis"><div><b>${sm.readings}</b><span>relevés</span></div><div><b>${sm.lots}</b><span>lots</span></div><div><b>${sm.products}</b><span>produits</span></div><div><b>${sm.members}</b><span>personnes</span></div></div>
          ${I.running ? `<div class="au-prog"><i style="width:${Math.round((I.p || 0) * 100)}%"></i></div><em class="au-hint">Import en cours… ${Math.round((I.p || 0) * 100)} %</em>` : ""}</div>
        <div class="au-stack st" style="--i:4"><button class="au-tac au-primary au-tall${I.running ? " au-busy" : ""}" data-act="auImport"><span class="au-bl">Importer les données de ce téléphone dans mon compte</span>${dots}</button>
        ${I.running ? "" : `<button class="au-ghost" data-act="auImportSkip">Plus tard</button>`}</div>`;
    }
    if (s === "welcomeDone") return `<div class="au-seal st" style="--i:0">${AU_SEAL}</div>${head(esc(U.doneTx || "C'est prêt !"), esc(U.doneSub || ""))}<div class="au-opening st" style="--i:3"><span>Ouverture de votre cuisine</span><i><b></b></i></div>`;
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
      if (e) { const ok = auEmailOk(e.value); mark(e, ok); const h = $("#auEmailH"); if (h) h.textContent = e.value && !ok && e.dataset.touched ? (e.value.includes("@") ? "Cette adresse semble incomplète." : "Il manque le @ dans l'adresse.") : ""; e.closest(".au-f").classList.toggle("bad", !!(e.value && !ok && e.dataset.touched)); }
      if (p && up) { const sc = auPwScore(p.value); const m = $("#auMeter"); if (m) { m.dataset.s = p.value ? (p.value.length < 8 ? "x" : sc) : 0; } const h = $("#auPwH"); if (h) h.textContent = p.value ? (p.value.length < 8 ? `Encore ${8 - p.value.length} caractère${8 - p.value.length > 1 ? "s" : ""}` : AU_PW_TX[sc]) : AU_PW_TX[0]; mark(p, p.value.length >= 8); }
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
    const n = ($("#auRName")?.value || C.name || "").trim(), t = (AU_TYPES.find((x) => x[0] === C.type) || AU_TYPES[0])[1];
    const pm = $(".au-pm", p), ini = initials(n || "R");
    if (pm.textContent !== ini) { pm.textContent = ini; pm.classList.remove("au-pop"); void pm.offsetWidth; pm.classList.add("au-pop"); }
    $("b", p).textContent = n || "Votre restaurant"; $("b", p).classList.toggle("empty", !n);
    $("em", p).textContent = `${t} · ${C.frs.length} équipement${C.frs.length > 1 ? "s" : ""} froid${C.frs.length > 1 ? "s" : ""}`;
    const rows = AU_FRIDGES.filter(([f]) => C.frs.includes(f)).slice(0, 3);
    $(".au-pvl", p).innerHTML = rows.length ? rows.map(([f, , lo, hi], i) => `<div class="au-pvr"><span class="t">${["07:30", "07:35", "07:40"][i]}</span><span class="n">${esc(f)}</span><span class="s">${lo}/${hi} °C</span></div>`).join("") + (C.frs.length > 3 ? `<div class="au-pvr more">+ ${C.frs.length - 3} autre${C.frs.length - 3 > 1 ? "s" : ""} à relever</div>` : "") : `<div class="au-pvr more">Aucun équipement froid pour l'instant</div>`;
    p.classList.toggle("on", !!n);
    this.labelSync();
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
      /* commercial fields (js/abo.js): 14-day trial of the pack chosen on the site (Complet by default) */
      const pack = auLS.get("gg-plan") === "essentiel" ? "essentiel" : "complet";
      b.set(R, { name: C.name, type: C.type, owner: u.uid, createdAt: now, plan: "essai", pack, trialEnds: now + 14 * 864e5, by: u.uid });
      b.set(R.collection("members").doc(u.uid), { name, email: u.email || "", photo: u.photoURL || "", role: "gerant", joinedAt: now });
      b.set(fs.collection("users").doc(u.uid), { restos: FV.arrayUnion(rid) }, { merge: true });
      AU_FRIDGES.filter(([n]) => C.frs.includes(n)).forEach(([n, type, min, max], i) => b.set(R.collection("fridges").doc("f" + now.toString(36) + i), { name: n, type, min, max, order: i, createdAt: now + i }));
      b.set(R.collection("events").doc("e" + now.toString(36)), { type: "team", text: `a créé ${C.name}`, at: now, uid: u.uid });
      await this.timeout(b.commit(), 15000);
      auLS.del("gg-plan"); this.setBusy("");
      /* js/onboard.js: the app opens on the onboarding (logo, adresse, équipe, imprimante…) once the kitchen moment has played */
      if (typeof OB !== "undefined" && OB.handoff) return OB.handoff(rid, C, name);
      this.celebrate(`C'est prêt${name ? ", " + firstName(name) : ""} !`, `${C.name} · ${C.frs.length} équipement${C.frs.length > 1 ? "s" : ""} à relever`, rid);
    } catch (x) { console.warn("create", x); this.fail(x); }
  },
  celebrate(t, sub, rid) {
    this.ui.doneTx = t; this.ui.doneSub = sub; this.show("welcomeDone", { push: false });
    SFX.done(); buzz([12, 40, 12, 40, 30]); /* the kitchen answers: the thermometer drops to 3,2 °C, then the « Prêt pour le contrôle » stamp lands */
    setTimeout(() => this.enter(rid), auReduce() ? 1200 : 2100);
  },

  /* ───────────── join with an invite ───────────── */
  async openJoin(code, auto) {
    code = auCleanCode(code);
    this.ui.join = { code, inv: null, err: "", loading: code.length === 8, auto: !!auto && code.length === 8 };
    this.show("join", { push: !!this.ui.back.length || this.ui.screen === "setup" });
    if (code.length === 8) this.lookup(code);
  },
  async lookup(code) {
    const J = this.ui.join; J.loading = true; J.err = ""; J.inv = null; this.paintJoin();
    try {
      const s = await this.timeout(this.fs.collection("invites").doc(code).get(), 12000);
      if (J.code !== code) return;
      const inv = s.exists ? s.data() : null;
      if (!inv) { J.err = "Ce code n'existe pas ou a été annulé. Vérifiez-le avec votre gérant."; auLS.del("gg-invite"); }
      else if (inv.expiresAt && inv.expiresAt < Date.now()) { J.err = "Cette invitation a expiré. Demandez-en une nouvelle au gérant."; auLS.del("gg-invite"); }
      else if (inv.maxUses && (inv.uses || 0) >= inv.maxUses) { J.err = "Cette invitation a déjà été utilisée. Demandez-en une nouvelle au gérant."; auLS.del("gg-invite"); }
      else if (this.restos.includes(inv.rid)) { auLS.del("gg-invite"); toast(`Vous faites déjà partie de ${inv.restoName || "cette équipe"}`); this.enter(inv.rid); return; }
      else { J.inv = { ...inv, code }; SFX.scan(); buzz(8); }
    } catch (x) { if (J.code !== code) return; J.err = this.msg(x); }
    J.loading = false; this.paint();
    /* opened from an invitation link: join right away with the invite's role (a code typed by hand still shows the card first) */
    if (J.inv && J.auto) { J.auto = false; setTimeout(() => { if (this.ui.join === J && J.inv && !this.ui.busy) this.joinSubmit(); }, 350); }
    else if (J.auto) { J.auto = false; auLS.del("gg-invite"); }
  },
  paintJoin() { if (this.ui.screen !== "join") return; const st = $("#auJState"); const J = this.ui.join; if (st && J.loading) st.innerHTML = `<div class="au-jload">${AU_DOTS_IN}Recherche de l'invitation…</div>`; },
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
    } catch (x) { console.warn("join", x); J.err = x && x.code === "permission-denied" ? "Cette invitation n'est plus valable. Demandez-en une nouvelle." : this.msg(x); auLS.del("gg-invite"); this.setBusy(""); this.paint(); SFX.err(); }
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
        const first = [[R, { ...DB.clean(rest), name: String((r && r.name) || "Mon restaurant").slice(0, 80), owner: u.uid, createdAt: (r && r.createdAt) || now, plan: (r && r.plan) || "essai", pack: (r && r.pack) || "complet", trialEnds: (r && r.trialEnds) || now + 14 * 864e5, importedAt: now }],
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
      Object.assign(I, { running: false, done: true, n, skipped, rid: plan[0] && plan[0].rid }); SFX.done(); this.paint();
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

  /* ───────────── remise à zéro (accounts): wipe the restaurant's data, delete the restaurant, leave a team, delete my account ─────────────
     Every subcollection of restos/{rid} is deleted client-side in batches of 400 (Firestore never cascades). */
  COLS: ["fridges", "readings", "lots", "products", "counts", "receptions", "events", "notes", "chores", "choreLogs", "tickets", "tkLinks", "moves", "stockMoves", "staff", "shifts", "punches", "obligations", "oblLogs", "feedback", "expenses"],
  online() { return navigator.onLine !== false; },
  isOwner() { return !!(DB.uid && S.resto && S.resto.owner === DB.uid); },
  /* typed confirmation, same pattern as the local « Tout effacer » (compte.js): the button wakes up on EFFACER */
  confirmSheet({ icon = "trash", title, sub, btn, act, id = "", extra = "" }) {
    openSheet(`<div class="au-sh au-conf"><span class="au-shic bad">${ico(icon)}</span><div class="h2">${title}</div><p class="sub">${sub}</p>${extra}
      <label class="field"><span>Pour confirmer, tapez EFFACER</span><input class="input mono" id="auConfIn" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="EFFACER" enterkeyhint="done"></label>
      <button class="btn danger block" id="auConfGo" data-act="${act}" data-id="${esc(id)}" disabled>${ico(icon)}${btn}</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
  },
  confOk() {
    const i = $("#auConfIn"); if ((i?.value || "").trim().toUpperCase() === "EFFACER") return true;
    if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); i.focus(); } SFX.err(); buzz([20, 40, 20]); return false;
  },
  busy(tx) { this.inApp = true; this.mount(); this.ui.busyTx = tx; this.show("busy", { push: false }); },
  busyTx(tx) { this.ui.busyTx = tx; const h = $("#au .au-busyp .au-h2"); if (h) h.textContent = tx; },
  needNet() { if (this.online()) return true; SFX.err(); toast("Connexion internet nécessaire pour cette opération.", "err"); return false; },
  async wipeCols(rid, cols, tick) {
    const fs = this.fs; let n = 0;
    for (const col of cols) {
      for (let guard = 0; guard < 500; guard++) {
        const s = await this.timeout(fs.collection(`restos/${rid}/${col}`).limit(400).get(), 30000);
        if (s.empty) break;
        const b = fs.batch(); s.docs.forEach((d) => b.delete(d.ref)); await this.timeout(b.commit(), 30000);
        n += s.size; tick && tick(n); if (s.size < 400) break;
      }
    }
    return n;
  },
  /* (a) « Vider les données du restaurant »: everything but the restaurant itself and its team */
  async wipeData() {
    if (!DB.uid || myRole() !== "gerant" || !S.rid || !this.needNet()) return;
    const rid = S.rid, name = S.resto?.name || "le restaurant"; closeSheet(true); this.busy("Suppression des données…");
    try {
      const n = await this.wipeCols(rid, this.COLS, (k) => this.busyTx(`Suppression… ${k} élément${k > 1 ? "s" : ""}`));
      await logEvent("team", `a vidé les données de ${name}`);
      this.hide(); SFX.done(); buzz([10, 30, 10]); toast(n ? `Données effacées · ${n} élément${n > 1 ? "s" : ""}` : "Rien à effacer"); try { refresh(); } catch (e) {}
    } catch (e) { console.warn("wipe", e); this.hide(); SFX.err(); toast(this.msg(e), "err"); }
  },
  /* every doc under restos/{rid}, then the team (others first; the owner's own doc needs the owner rule of firestore.rules), the invites, the restaurant, and my list */
  async deleteRestoDocs(rid, tick) {
    const fs = this.fs, uid = this.user.uid;
    const n = await this.wipeCols(rid, this.COLS, tick);
    const ms = await this.timeout(fs.collection(`restos/${rid}/members`).get(), 30000);
    const others = ms.docs.filter((d) => d.id !== uid), mine = ms.docs.find((d) => d.id === uid);
    for (let i = 0; i < others.length; i += 400) { const b = fs.batch(); others.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await this.timeout(b.commit(), 30000); }
    try { const inv = await this.timeout(fs.collection("invites").where("rid", "==", rid).get(), 15000); if (!inv.empty) { const b = fs.batch(); inv.docs.forEach((d) => b.delete(d.ref)); await this.timeout(b.commit(), 15000); } } catch (e) { console.warn("invites", e && e.code); }
    if (mine) { try { await this.timeout(mine.ref.delete(), 15000); } catch (e) { console.warn("own member doc", e && e.code); } }
    await this.timeout(fs.collection("restos").doc(rid).delete(), 15000);
    await this.timeout(fs.collection("users").doc(uid).set({ restos: this.FV().arrayRemove(rid) }, { merge: true }), 15000);
    this.restos = this.restos.filter((x) => x !== rid);
    return n;
  },
  /* (b) « Supprimer le restaurant » (owner only) */
  async deleteResto() {
    if (!this.isOwner() || !S.rid || !this.needNet()) return;
    const rid = S.rid, name = S.resto?.name || "Le restaurant"; closeSheet(true); this.busy(`Suppression de ${name}…`);
    try { DB.unsubAll(); } catch (e) {} /* no churn while the docs vanish; the restaurant list is re-subscribed by the reload */
    try {
      await this.deleteRestoDocs(rid, (k) => this.busyTx(`Suppression… ${k} élément${k > 1 ? "s" : ""}`));
      auLS.del("gg-rid-c"); auLS.sset("gg-au-flash", `${name} a été supprimé`); SFX.done();
      setTimeout(() => location.reload(), 300);
    } catch (e) { console.warn("delete resto", e); SFX.err(); this.busyTx(this.msg(e)); setTimeout(() => location.reload(), 1800); }
  },
  /* « Quitter l'équipe » (any member but the owner) */
  async leaveResto() {
    if (!DB.uid || !S.rid || this.isOwner() || !this.needNet()) return;
    const rid = S.rid, name = S.resto?.name || "l'équipe", uid = DB.uid, fs = this.fs; closeSheet(true); this.busy("Un instant…");
    try {
      await logEvent("team", `a quitté ${name}`);
      try { DB.unsubAll(); } catch (e) {}
      await this.timeout(fs.doc(`restos/${rid}/members/${uid}`).delete(), 15000);
      await this.timeout(fs.collection("users").doc(uid).set({ restos: this.FV().arrayRemove(rid) }, { merge: true }), 15000);
      auLS.del("gg-rid-c"); auLS.sset("gg-au-flash", `Vous avez quitté ${name}`); SFX.close();
      setTimeout(() => location.reload(), 300);
    } catch (e) { console.warn("leave", e); SFX.err(); this.busyTx(this.msg(e)); setTimeout(() => location.reload(), 1800); }
  },
  /* (c) « Supprimer mon compte »: leave every team, delete the restaurants I own, then the account (re-authentication when Firebase asks) */
  async deleteAccount(resumed) {
    const u = this.auth && this.auth.currentUser; if (!u) return;
    if (!resumed && !this.needNet()) return;
    const fs = this.fs, uid = u.uid; closeSheet(true); this.busy("Suppression du compte…");
    try { DB.unsubAll(); } catch (e) {}
    try {
      let ids = []; try { const s = await this.timeout(fs.collection("users").doc(uid).get(), 15000); ids = s.exists && Array.isArray(s.data().restos) ? s.data().restos : []; } catch (e) { console.warn("users", e && e.code); }
      ids = [...new Set([...ids, ...(S.restos || []).map((r) => r.id)])].filter((x) => typeof x === "string");
      for (const rid of ids) {
        let r = null; try { r = await this.timeout(fs.collection("restos").doc(rid).get(), 15000); } catch (e) { continue; } /* permission-denied: already removed from that team */
        if (!r.exists) continue;
        if (r.data().owner === uid) await this.deleteRestoDocs(rid, (k) => this.busyTx(`Suppression de ${r.data().name || "votre restaurant"}… ${k}`));
        else { try { await this.timeout(fs.doc(`restos/${rid}/members/${uid}`).delete(), 15000); } catch (e) { console.warn("leave", rid, e && e.code); } }
      }
      try { await this.timeout(fs.collection("users").doc(uid).delete(), 15000); } catch (e) { console.warn("users del", e && e.code); }
      this.busyTx("Suppression du compte…");
      try { await u.delete(); }
      catch (e) {
        if (!(e && e.code === "auth/requires-recent-login")) throw e;
        const ok = await this.reauth(u); if (!ok) throw Object.assign(new Error("cancel"), { code: "gg/reauth-cancel" });
        await u.delete();
      }
      auLS.sdel("gg-del-account"); auLS.set("gg-mode", "out"); auLS.del("gg-rid-c"); auLS.del("gg-imp-" + uid); auLS.del("gg-last"); auLS.del("gg-last-email"); auLS.del("gg-invite"); auLS.sset("gg-au-flash", "Votre compte a été supprimé.");
      try { await this.fs.terminate(); await this.fs.clearPersistence(); } catch (e) {}
      SFX.close(); location.reload();
    } catch (e) {
      console.warn("delete account", e); auLS.sdel("gg-del-account"); SFX.err();
      if (e && e.code === "gg/redirect") return; /* Google re-authentication by redirect: the page is leaving, deletion resumes on return */
      this.busyTx(e && e.code === "gg/reauth-cancel" ? "Suppression annulée. Vos restaurants ont pu être retirés : le compte reste ouvert." : this.msg(e));
      setTimeout(() => location.reload(), 2200);
    }
  },
  /* Firebase wants a fresh sign-in before deleting an account: password for e-mail accounts, Google popup (redirect in the iPhone home-screen app) */
  reauth(u) {
    const google = (u.providerData || []).some((p) => p && p.providerId === "google.com");
    if (google) {
      const p = new firebase.auth.GoogleAuthProvider();
      if (this.useRedirect()) { auLS.sset("gg-del-account", "1"); auLS.sset("gg-redirect", "1"); return u.reauthenticateWithRedirect(p).then(() => { throw Object.assign(new Error("redirect"), { code: "gg/redirect" }); }); }
      return u.reauthenticateWithPopup(p).then(() => true).catch((e) => { if (["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"].includes(e && e.code)) return false; throw e; });
    }
    return new Promise((res) => { this._reauth = { res, done: false }; this.ui.err = ""; this.setBusy(""); this.show("reauth", { push: false }); SFX.sheet(); });
  },
  async reauthSubmit() {
    const R = this._reauth, u = this.auth.currentUser; if (!R || R.done || !u || this.ui.busy) return;
    const pw = $("#auRePw")?.value || ""; if (!pw) { this.shake($("#auRePw")); return; }
    this.ui.err = ""; this.setBusy("reauth");
    try { await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw)); R.done = true; this.setBusy(""); this.busy("Suppression du compte…"); R.res(true); }
    catch (e) { console.warn("reauth", e && e.code); this.fail(e); }
  },
  reauthCancel() { const R = this._reauth; if (R && !R.done) { R.done = true; this.busy("Un instant…"); R.res(false); } },
  /* a message left for the next load (deleted restaurant, left team, deleted account) */
  flash() { const m = auLS.sget("gg-au-flash"); if (!m) return; auLS.sdel("gg-au-flash"); setTimeout(() => { try { toast(m); } catch (e) {} }, 900); },

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
      ${row("auSignOut", "out", "Se déconnecter", "Les données restent dans votre compte", " bad")}
      ${S.rid && !this.isOwner() ? row("auLeave", "users", "Quitter l'équipe", `Vous ne verrez plus ${esc(S.resto?.name || "ce restaurant")}`, " bad") : ""}
      ${row("auDelAccount", "trash", "Supprimer mon compte", "Définitif : vos restaurants et vos données avec", " bad")}`;
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
/* ───────────── « Ajouter à l'écran d'accueil »: an illustrated guide adapted to the device (ACT.auInstall) ─────────────
   iPhone/iPad Safari (Partager → Sur l'écran d'accueil → Ajouter; Safari 26+: ••• → Partager first), Chrome on iPhone,
   Android Chrome (the real install prompt captured by core as `installEvt` when there is one, else ⋮ → Installer l'application),
   desktop Chrome/Edge (install icon in the address bar, or the captured prompt), Safari on Mac (Fichier → Ajouter au Dock). */
const AU_INS_IC = {
  share: auSv('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/>', 20, 2.1),
  add: auSv('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8.5v7M8.5 12h7"/>', 20, 2.1),
  more: auSv('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>', 20, 2),
  kebab: auSv('<circle cx="12" cy="5.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/>', 20, 2),
  inst: auSv('<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M8 21h8M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5"/>', 20, 2),
  phoneDl: auSv('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5"/>', 20, 2),
  back: auSv('<path d="M15 5l-7 7 7 7"/>', 18, 2.2), fwd: auSv('<path d="M9 5l7 7-7 7"/>', 18, 2.2),
  book: auSv('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>', 18, 2),
  tabs: auSv('<rect x="3" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h11a2 2 0 0 1 2 2v11"/>', 18, 2),
  lock: auSv('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 13, 2.2),
  dock: auSv('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 15h18"/>', 20, 2),
};
function auInstallInfo() {
  const ua = navigator.userAgent || "", mac = /Macintosh/.test(ua) && !IS_IOS;
  const ev = typeof installEvt !== "undefined" ? installEvt : null;
  if (isStandalone()) return { k: "done" };
  if (IS_IOS) {
    if (/CriOS|EdgiOS|FxiOS/.test(ua)) return { k: "iosother", app: /CriOS/.test(ua) ? "Chrome" : /EdgiOS/.test(ua) ? "Edge" : "Firefox" };
    return { k: IOS_MENU ? "ios26" : "ios", ipad: IS_IPAD };
  }
  if (ev) return { k: "prompt", mob: IS_ANDROID };
  if (IS_ANDROID) return { k: "android", samsung: /SamsungBrowser/.test(ua) };
  if (mac && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return { k: "macsafari" };
  if (/Firefox/.test(ua)) return { k: "firefox" };
  return { k: "desktop", edge: /Edg\//.test(ua) };
}
function auInstallHTML() {
  const I = auInstallInfo(), K = AU_INS_IC, mob = ["ios", "ios26", "iosother", "android"].includes(I.k) || (I.k === "prompt" && I.mob);
  const key = (ic, t = "") => `<span class="au-ik">${ic}${t ? `<b>${t}</b>` : ""}</span>`;
  const hi = (h) => `<span class="au-hi">${h}</span>`;
  /* little drawings of the browser's own buttons, the one to touch circled in saffron */
  const M = {
    safbar: `<div class="au-m au-m-bar">${K.back}${K.fwd}${hi(K.share)}${K.book}${K.tabs}</div>`,
    safbar26: `<div class="au-m au-m-bar">${K.back}<span class="au-m-url">${K.lock}gusto</span>${hi(K.more)}</div>`,
    padbar: `<div class="au-m au-m-bar top"><span class="au-m-url">${K.lock}gusto</span>${hi(K.share)}${K.add}</div>`,
    sharerow: `<div class="au-m au-m-list"><span class="dim">Copier</span>${hi(`<span class="au-m-row">Sur l'écran d'accueil${K.add}</span>`)}</div>`,
    shareRow26: `<div class="au-m au-m-list"><span class="dim">Copier le lien</span>${hi(`<span class="au-m-row">Partager${K.share}</span>`)}</div>`,
    addbtn: `<div class="au-m au-m-head"><span class="dim">Annuler</span>${hi("<b>Ajouter</b>")}</div>`,
    crbar: `<div class="au-m au-m-bar top"><span class="au-m-url">${K.lock}gusto</span>${hi(K.share)}</div>`,
    crrow: `<div class="au-m au-m-list"><span class="dim">Copier</span>${hi(`<span class="au-m-row">Ajouter à l'écran d'accueil${K.add}</span>`)}</div>`,
    andbar: `<div class="au-m au-m-bar top"><span class="au-m-url">${K.lock}gusto</span>${hi(K.kebab)}</div>`,
    androw: `<div class="au-m au-m-list"><span class="dim">Nouvel onglet</span>${hi(`<span class="au-m-row">${K.phoneDl}Installer l'application</span>`)}</div>`,
    andok: `<div class="au-m au-m-dlg"><span class="dim">Annuler</span>${hi("<b>Installer</b>")}</div>`,
    deskbar: `<div class="au-m au-m-bar top wide"><span class="au-m-url">${K.lock}app.growthgusto.fr</span>${hi(K.inst)}${K.kebab}</div>`,
    deskok: `<div class="au-m au-m-dlg"><span class="dim">Annuler</span>${hi("<b>Installer</b>")}</div>`,
    macmenu: `<div class="au-m au-m-list"><span class="dim">Fichier</span>${hi(`<span class="au-m-row">Ajouter au Dock${K.dock}</span>`)}</div>`,
  };
  const step = (n, tx, m) => `<li class="au-is st" style="--i:${n + 1}"><span class="au-isn">${n}</span><p>${tx}</p>${m || ""}</li>`;
  let steps = [], title = mob ? "Ajoutez Gusto à votre écran d'accueil" : "Installez Gusto sur cet ordinateur", cta = "", note = "";
  if (I.k === "done") return `<div class="au-sh au-ins"><div class="au-ins-hero wall">${auInsHome(true)}</div><div class="h2">Gusto est déjà installée</div><p class="sub">Vous l'utilisez en ce moment, comme une vraie app.</p><button class="btn soft block" data-act="sheetClose">Parfait</button></div>`;
  if (I.k === "ios") steps = [
    step(1, `Touchez ${key(K.share)} <b>Partager</b>${I.ipad ? " en haut à droite" : " en bas de l'écran"}.`, I.ipad ? M.padbar : M.safbar),
    step(2, `Faites défiler, puis touchez ${key(K.add)} <b>Sur l'écran d'accueil</b>.`, M.sharerow),
    step(3, `Touchez <b>Ajouter</b> en haut à droite. C'est fait.`, M.addbtn)];
  else if (I.k === "ios26") steps = [
    step(1, `Touchez ${key(K.more)} en bas à droite, puis <b>Partager</b>.`, M.safbar26),
    step(2, `Faites défiler, puis touchez ${key(K.add)} <b>Sur l'écran d'accueil</b>.`, M.sharerow),
    step(3, `Laissez <b>Ouvrir comme app web</b> activé, puis <b>Ajouter</b>.`, M.addbtn)];
  else if (I.k === "iosother") { steps = [
    step(1, `Touchez ${key(K.share)} <b>Partager</b>, à droite de l'adresse.`, M.crbar),
    step(2, `Choisissez ${key(K.add)} <b>Ajouter à l'écran d'accueil</b>.`, M.crrow),
    step(3, `Touchez <b>Ajouter</b>. C'est fait.`, M.addbtn)];
    if (I.app === "Firefox") note = "Si l'option n'apparaît pas, ouvrez Gusto dans Safari."; }
  else if (I.k === "prompt") { cta = `<button class="btn acc block au-ins-go" data-act="auInstallGo">${ico("download")}Installer Gusto</button>`;
    steps = [step(1, `Touchez <b>Installer Gusto</b> ci-dessous.`), step(2, `Confirmez avec <b>Installer</b>. L'icône arrive ${mob ? "sur l'écran d'accueil" : "avec vos applications"}.`, M.andok)]; }
  else if (I.k === "android") steps = [
    step(1, `Touchez ${key(K.kebab)} <b>Menu</b>, en haut à droite.`, M.andbar),
    step(2, `Choisissez <b>Installer l'application</b>${I.samsung ? "" : " ou <b>Ajouter à l'écran d'accueil</b>"}.`, M.androw),
    step(3, `Confirmez avec <b>Installer</b>. C'est fait.`, M.andok)];
  else if (I.k === "macsafari") steps = [
    step(1, `Dans la barre des menus, ouvrez <b>Fichier</b>.`),
    step(2, `Choisissez ${key(K.dock)} <b>Ajouter au Dock</b>.`, M.macmenu),
    step(3, `Cliquez <b>Ajouter</b>. Gusto s'ouvre depuis le Dock.`)];
  else if (I.k === "firefox") { steps = [
    step(1, `Ouvrez <b>app.growthgusto.fr</b> dans Chrome ou Edge.`),
    step(2, `Cliquez ${key(K.inst)} dans la barre d'adresse.`, M.deskbar),
    step(3, `Cliquez <b>Installer</b>. C'est fait.`, M.deskok)]; note = "Firefox ne sait pas installer les applications web."; }
  else steps = [
    step(1, `Cliquez ${key(K.inst)} à droite de la barre d'adresse.`, M.deskbar),
    step(2, `Cliquez <b>Installer</b>. Gusto s'ouvre dans sa propre fenêtre.`, M.deskok),
    step(3, `Pas d'icône ? Menu ${key(K.kebab)} › ${I.edge ? "<b>Applications</b> › <b>Installer ce site en tant qu'application</b>" : "<b>Caster, enregistrer et partager</b> › <b>Installer la page en tant qu'application</b>"}.`)];
  return `<div class="au-sh au-ins${mob ? " mob" : " desk"}">
    <div class="au-ins-hero wall st" style="--i:0">${auInsHome(mob)}</div>
    <div class="h2 st" style="--i:1">${title}</div>
    <p class="sub st" style="--i:1">Elle s'ouvre en plein écran, comme une vraie app. Même sans réseau.</p>
    <ol class="au-ins-steps">${steps.join("")}</ol>
    ${note ? `<p class="au-ins-note st" style="--i:5">${note}</p>` : ""}
    ${cta}<button class="btn ${cta ? "ghost" : "soft"} block st" style="--i:5" data-act="sheetClose">${cta ? "Plus tard" : "J'ai compris"}</button>
  </div>`;
}
/* the home screen (or the desktop dock) with the cream « Gusto » tile landing among the other apps */
function auInsHome(mob) {
  const tile = (i) => `<span class="au-ins-app" style="--j:${i}"><i></i><em></em></span>`;
  if (mob) return `<div class="au-ins-phone"><span class="au-ins-notch"></span><div class="au-ins-grid">${tile(0)}${tile(1)}${tile(2)}${tile(3)}${tile(4)}<span class="au-ins-me">${appIcon(46)}<b>Gusto</b></span>${tile(5)}${tile(6)}</div></div>`;
  return `<div class="au-ins-dock">${tile(0)}${tile(1)}${tile(2)}<span class="au-ins-me">${appIcon(52)}<b>Gusto</b></span>${tile(3)}${tile(4)}</div>`;
}
function auInstallSheet() { SFX.tap(); buzz(4); openSheet(auInstallHTML()); }

function authUser() {
  const u = AUTH.user; if (!u) return null;
  const pid = (u.providerData && u.providerData[0] && u.providerData[0].providerId) || "password";
  return { uid: u.uid, name: u.displayName || "", email: u.email || "", photo: u.photoURL || "", provider: pid === "google.com" ? "google" : "email" };
}

/* ───────────── forms + live inputs inside the overlay ───────────── */
document.addEventListener("submit", (e) => {
  const f = e.target; if (!f.dataset || !f.dataset.au) return; e.preventDefault(); SFX.init();
  ({ email: () => AUTH.emailSubmit(), reset: () => AUTH.resetSubmit(), create: () => AUTH.createSubmit(), join: () => AUTH.joinSubmit(), reauth: () => AUTH.reauthSubmit(), delacc: () => ACT.auDelAccountOk() })[f.dataset.au]?.();
});
document.addEventListener("input", (e) => { const t = e.target; if (t && t.id === "auConfIn") { const b = $("#auConfGo"); if (b) b.toggleAttribute("disabled", t.value.trim().toUpperCase() !== "EFFACER"); } });
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "auConfIn") { e.preventDefault(); const b = $("#auConfGo"); if (b && !b.disabled) b.click(); } });

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
  if (t.id === "auName") { AUTH.ui.name = t.value; AUTH.labelSync(); }
  if (AUTH.ui.err && t.closest(".au-form")) { AUTH.ui.err = ""; const er = $("#au .au-err"); if (er) { er.classList.add("bye"); setTimeout(() => er.remove(), 260); } }
  AUTH.validate();
});
document.addEventListener("focusout", (e) => { const t = e.target; if (t && t.id === "auEmail" && t.value) { t.dataset.touched = "1"; AUTH.validate(); } if (t && t.id === "auCode") setTimeout(() => AUTH.codeCells(), 0); });
/* the kitchen keeps its framing when the window or the phone rotates */
/* only a width change re-frames the kitchen: on phones the browser bar showing/hiding while scrolling changes the height constantly */
let auRzW = window.innerWidth;
window.addEventListener("resize", () => { if (!$("#au.on")) return; const desk = window.matchMedia("(min-width:960px)").matches; if (!desk && window.innerWidth === auRzW) return; auRzW = window.innerWidth; cancelAnimationFrame(AUTH._rz); AUTH._rz = requestAnimationFrame(() => AUTH.cam(true)); }, { passive: true });
document.addEventListener("focusin", (e) => { if (e.target && e.target.id === "auCode") AUTH.codeCells(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#au.on") && AUTH.inApp && !$("#sheet.open")) { e.stopPropagation(); ACT.auClose(); } }, true);

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  auGoogle: () => { SFX.tap(); buzz(5); AUTH.google(); },
  auEmail: () => { SFX.tap(); buzz(5); AUTH.ui.err = ""; if (!AUTH.cfg) { AUTH.show("soon"); return; } AUTH.show("email"); },
  auTab: (a, id, v) => { if (AUTH.ui.tab === v) return; SFX.tick(); buzz(4); const em = $("#auEmail"), pw = $("#auPw"), nm = $("#auName"); if (em) AUTH.ui.email = em.value; if (pw) AUTH.ui.pw = pw.value; if (nm) AUTH.ui.name = nm.value; AUTH.ui.tab = v; AUTH.ui.err = ""; AUTH.paint(); },
  auEye: () => { const p = $("#auPw"); if (!p) return; AUTH.ui.show = !AUTH.ui.show; p.type = AUTH.ui.show ? "text" : "password"; const b = $("#au .au-eye"); if (b) { b.innerHTML = AUTH.ui.show ? AU_SVG.eyeOff : AU_SVG.eye; b.setAttribute("aria-label", (AUTH.ui.show ? "Masquer" : "Afficher") + " le mot de passe"); } SFX.tick(); p.focus({ preventScroll: true }); },
  auForgot: () => { SFX.tap(); const e = $("#auEmail"); if (e) AUTH.ui.email = e.value; AUTH.ui.sent = false; AUTH.ui.err = ""; AUTH.show("reset"); },
  auBackToIn: () => { SFX.tap(); AUTH.ui.sent = false; AUTH.ui.tab = "in"; AUTH.ui.back = AUTH.ui.back.filter((x) => x !== "reset" && x !== "email"); AUTH.show("email"); },
  auBack: () => { SFX.tap(); const p = AUTH.ui.back.pop(); AUTH.ui.err = ""; if (p) AUTH.show(p, { push: false }); },
  auClose: () => { SFX.close(); AUTH.hide(); },
  auDemo: () => { SFX.tap(); buzz(6); if (DB.uid) return; AUTH.ui.busyTx = "Préparation de la démo…"; AUTH.show("busy", { push: false }); setTimeout(() => AUTH.startDemo(), 380); },
  auLocal: () => { SFX.tap(); auLS.set("gg-mode", "local"); auLS.set("gg-local-ok", "1"); auLS.del("gg-invite"); auLS.sdel("gg-demo"); if (AUTH.resolve) { AUTH.hide(); AUTH.resolve({ mode: "local" }); } else location.reload(); },
  auSwitch: async () => { SFX.tap(); try { await AUTH.auth.signOut(); } catch (e) {} AUTH.user = null; auLS.set("gg-mode", "out"); AUTH.ui.back = []; AUTH.show("welcome", { push: false }); },
  auCreate: () => { SFX.tap(); buzz(5); AUTH.ui.err = ""; AUTH.show("create"); },
  auType: (a, id, v) => { AUTH.ui.create.type = v; $$("#au [data-act=auType]").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); SFX.tick(); buzz(4); AUTH.createPrev(); },
  auFr: (a, id, v) => { const C = AUTH.ui.create; const i = C.frs.indexOf(v); i >= 0 ? C.frs.splice(i, 1) : C.frs.push(v); const on = i < 0; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); const f = AU_FRIDGES.find((x) => x[0] === v); a.innerHTML = auFrHTML(v, f[2], f[3], on); SFX.tick(); buzz(4); AUTH.createPrev(); },
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
  /* remise à zéro (accounts) */
  auWipe: () => { if (myRole() !== "gerant") { SFX.err(); toast("Réservé au gérant", "err"); return; } SFX.tap(); AUTH.confirmSheet({ title: "Vider les données du restaurant ?", sub: `Relevés, étiquettes, stock, recettes, planning, pointages, finances de ${esc(S.resto?.name || "ce restaurant")} : tout sera supprimé pour toute l'équipe. Le restaurant et l'équipe restent. C'est définitif.`, btn: "Vider les données", act: "auWipeOk" }); },
  auWipeOk: () => { if (AUTH.confOk()) AUTH.wipeData(); },
  auDelResto: () => { if (!AUTH.isOwner()) { SFX.err(); toast("Réservé au propriétaire du restaurant", "err"); return; } SFX.tap(); AUTH.confirmSheet({ title: `Supprimer ${esc(S.resto?.name || "ce restaurant")} ?`, sub: `Le restaurant, toutes ses données et son équipe (${S.members.length} personne${S.members.length > 1 ? "s" : ""}) disparaissent pour tout le monde. C'est définitif.`, btn: "Supprimer le restaurant", act: "auDelRestoOk" }); },
  auDelRestoOk: () => { if (AUTH.confOk()) AUTH.deleteResto(); },
  auLeave: () => { if (AUTH.isOwner()) { SFX.err(); toast("Le propriétaire ne peut pas quitter son restaurant.", "err"); return; } SFX.tap(); openSheet(`<div class="au-sh"><span class="au-shic bad">${ico("users")}</span><div class="h2">Quitter ${esc(S.resto?.name || "l'équipe")} ?</div><p class="sub">Vous n'aurez plus accès à ce restaurant. Vos relevés et actions restent au registre, à votre nom. Le gérant pourra vous réinviter.</p><button class="btn danger block" data-act="auLeaveOk">${ico("out")}Quitter l'équipe</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`); },
  auLeaveOk: () => AUTH.leaveResto(),
  auDelAccount: () => { SFX.tap(); if ($("#au.on")) { AUTH.ui.err = ""; AUTH.show("delAccount"); return; } const own = S.restos.filter((r) => r.owner === DB.uid).length; AUTH.confirmSheet({ title: "Supprimer mon compte ?", sub: `${own ? `${own === 1 ? "Le restaurant que vous possédez" : `Les ${own} restaurants que vous possédez`} et toutes ses données seront supprimés pour toute l'équipe. ` : ""}Vous quitterez les équipes dont vous faites partie, puis le compte <b>${esc(authUser()?.email || "")}</b> sera effacé. C'est définitif.`, btn: "Supprimer mon compte", act: "auDelAccountOk" }); },
  auDelAccountOk: () => { if (AUTH.confOk()) AUTH.deleteAccount(); },
  auReauthCancel: () => AUTH.reauthCancel(),
  auInstall: () => auInstallSheet(),
  auInstallGo: () => { closeSheet(true); if (typeof installEvt !== "undefined" && installEvt && ACT.installApp) ACT.installApp(); },
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
