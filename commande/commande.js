/* Growth Gusto — public menu and online ordering (https://app.growthgusto.fr/commande/?r=<rid>&t=<table>). No account, no tracking.
   Links: ?r=<rid>&t=12 a table's QR code (order to table 12) · ?r=<rid>&t=e the takeaway QR · ?r=<rid> asks « sur place ou à emporter ».
          ?r=<rid>&o=<order>&k=<key> the client's own order (live status), &paid=1 back from Stripe Checkout, &cancel=1 payment cancelled.
          ?r=demo a demo restaurant: nothing is sent, the order moves on by itself.
   Reads restos/{rid}/public/menu (written by the app, js/commande.js cmPubDoc: name, logo, cfg, cats, items — never a client's data).
   Writes nothing itself: the callable orderApi (functions/src/commande.js) checks every price and dish against that doc, creates
   restos/{rid}/clientOrders/{id}, and, for « payer maintenant », opens Stripe Checkout on the restaurant's own Stripe account. */
(function () {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const REGION = "europe-west9";
  const Q = new URLSearchParams(location.search);
  const RID = (Q.get("r") || "").trim();
  const DEMO = RID === "demo";
  const PV = Q.get("pv") === "1"; /* the app's live preview (Apparence): opens straight on the menu, the look comes from the link */
  const T0 = (Q.get("t") || "").trim();
  const OID = (Q.get("o") || "").trim(), KEY = (Q.get("k") || "").trim().toLowerCase();
  const LS = "gg-qm-" + RID;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
  const hm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const eur = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) {} } };

  /* prix dynamiques (js/prix.js): pub.promos [{ k:"hh"|"jour", t, days, day?, from?, to?, it:{ itemId: pct } }]. The server
     (functions/src/commande.js) applies the same rule to the order, so the price shown is the price charged. Time is Paris time. */
  const pxMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
  function pxParis() { try { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) }; } catch (e) { const d = new Date(); return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, min: d.getHours() * 60 + d.getMinutes(), wd: d.getDay() }; } }
  function pxActive(r, now) {
    if (!r || !r.it) return false; if (r.day ? r.day !== now.day : !(Array.isArray(r.days) && r.days.includes(now.wd))) return false;
    const a = pxMin(r.from) ?? 0, b = pxMin(r.to) ?? 1440; return a <= b ? now.min >= a && now.min < b : now.min >= a || now.min < b;
  }
  function pxDeal(promos, id, now) {
    let best = null; (Array.isArray(promos) ? promos : []).forEach((r) => { const v = r && r.it ? r.it[id] : undefined; const pc = +v;
      if (v == null || !(pc >= 0 && pc <= 90) || !pxActive(r, now)) return; if (!best || pc > best.pct) best = { pct: pc, t: r.t || "", k: r.k || "", to: r.to || "" }; });
    return best;
  }
  const pxPrice = (p, pct) => (pct > 0 ? Math.max(0.1, Math.round((+p || 0) * (100 - pct) / 10) / 10) : Math.round((+p || 0) * 100) / 100);
  const hTx = (t) => String(t || "").replace(/^0(\d)/, "$1").replace(":00", " h").replace(":", " h ");
  /* sets it.p (price now), it.p0 (the carte price) and it.pr (the running deal); true when something changed */
  function applyPromos() {
    if (!st.pub) return false; const now = pxParis(); let ch = false;
    (st.pub.items || []).forEach((it) => { if (it.p0 == null) it.p0 = it.p; const d = pxDeal(st.pub.promos, it.id, now); const p = d && d.pct > 0 ? pxPrice(it.p0, d.pct) : it.p0;
      const sig = d ? `${d.k}${d.pct}${d.t}` : ""; if (p !== it.p || sig !== (it.prSig || "")) { ch = true; it.p = p; it.pr = d; it.prSig = sig; } });
    return ch;
  }
  const dealTag = (it) => (!it.pr ? "" : `<span class="qm-tag deal${it.pr.k === "jour" ? " jour" : ""}">${it.pr.k === "jour" ? "Plat du jour" : esc(it.pr.t || "Happy hour")}${it.pr.pct > 0 ? ` −${it.pr.pct} %` : ""}</span>`);
  const was = (it) => (it.pr && it.pr.pct > 0 ? `<s class="qm-was">${eur(it.p0)}</s>` : "");
  /* banner: the happy hour running now (what, until when) and the plat du jour */
  function dealBanner() {
    const P = (st.pub && st.pub.promos) || [], now = pxParis(), out = [];
    P.filter((r) => r.k === "hh" && pxActive(r, now)).slice(0, 2).forEach((r) => { const ids = Object.keys(r.it || {}).filter((id) => +r.it[id] > 0 && itemOf(id)); if (!ids.length) return;
      const cs = [...new Set(ids.map((id) => itemOf(id).c))].map((c) => ((st.pub.cats || []).find((x) => x.id === c) || {}).t).filter(Boolean);
      const pcs = [...new Set(ids.map((id) => +r.it[id]))]; const pc = Math.max(...pcs);
      out.push(`<div class="qm-deal st" style="--i:1"><span class="qm-deal-pc">−${pc}<small>%</small></span><span class="qm-deal-tx"><b>${esc(r.t || "Happy hour")} en ce moment</b><em>${pcs.length > 1 ? "Jusqu'à " : ""}−${pc} % sur ${esc(cs.join(", ").toLowerCase() || "une sélection")}${r.to ? ` · jusqu'à ${esc(hTx(r.to))}` : ""}</em></span></div>`); });
    P.filter((r) => r.k === "jour" && pxActive(r, now)).slice(0, 1).forEach((r) => { const id = Object.keys(r.it || {})[0]; const it = itemOf(id); if (!it || it.out) return;
      out.push(`<button class="qm-deal jour st" style="--i:1" data-a="open" data-id="${esc(it.id)}"><span class="qm-deal-pc">${svg.chef}</span><span class="qm-deal-tx"><b>Plat du jour : ${esc(it.t)}</b><em>${was(it)}${eur(it.p)}${it.pr && it.pr.pct > 0 ? ` · −${it.pr.pct} % aujourd'hui` : " · aujourd'hui seulement"}</em></span><span class="qm-chev">${svg.back}</span></button>`); });
    return out.join("");
  }

  const AL = [["gluten", "Gluten"], ["crustaces", "Crustacés"], ["oeufs", "Œufs"], ["poissons", "Poissons"], ["arachides", "Arachides"], ["soja", "Soja"], ["lait", "Lait"], ["fruitscoque", "Fruits à coque"], ["celeri", "Céleri"], ["moutarde", "Moutarde"], ["sesame", "Sésame"], ["sulfites", "Sulfites"], ["lupin", "Lupin"], ["mollusques", "Mollusques"]];
  const alName = (id) => (AL.find((a) => a[0] === id) || [id, id])[1];
  const svg = {
    plus: '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>',
    table: '<svg viewBox="0 0 24 24"><path d="M3 9h18M5 9v11M19 9v11M8 9V5h8v4"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/></svg>',
    leaf: '<svg viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>',
    coins: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.4 18"/><path d="M8 7h1.5v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    chef: '<svg viewBox="0 0 24 24"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.31-.85.74-1.03A4 4 0 0 0 17 6a5 5 0 0 0-10 0 4 4 0 0 0-1.74 7.62c.43.18.74.57.74 1.03V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  };

  const st = { pub: null, mode: null, table: "", cart: [], al: new Set(), cat: "", view: "menu", sending: false, err: "",
    name: "", phone: "", slot: "", note: "", pay: "", order: null, oid: OID, okey: KEY, pollT: 0, sheet: null };
  /* "fruits_coque" is the old spelling of "fruitscoque" (js/notes.js noteAlId): read both */
  const alId = (k) => (k === "fruits_coque" ? "fruitscoque" : String(k || ""));
  try { const a = JSON.parse(localStorage.getItem("gg-qm-al") || "[]"); if (Array.isArray(a)) a.forEach((x) => st.al.add(alId(x))); } catch (e) {}
  const app = $("#app"), sheet = $("#sheet");

  /* ───────── sound: one soft « pop », no file to load ───────── */
  let AC = null;
  function pop(f = 660, d = 0.09, v = 0.05) {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + d * 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {}
  }
  const chime = () => { pop(523, 0.16, 0.05); setTimeout(() => pop(784, 0.22, 0.05), 120); };

  /* ───────── Firebase (only what this page needs) ───────── */
  let fs = null;
  function script(src) { return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
  async function fb() {
    if (fs) return fs;
    if (!window.GG_FIREBASE) throw new Error("nocfg");
    if (!(window.firebase && firebase.initializeApp)) await script(SDK + "firebase-app-compat.js");
    if (!firebase.firestore) await script(SDK + "firebase-firestore-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(window.GG_FIREBASE);
    fs = firebase.firestore(); return fs;
  }
  /* every call goes through GGR.run (js/reseau-client.js): when the network drops, the client sees « Petit souci de réseau », then
     « Nous renvoyons votre commande… », and the call leaves again by itself. A call that changes something carries one request id `rq`,
     the same on every try, so the server never takes it twice (functions/src/commande.js). Reads (status…) retry quietly. */
  const NET_KIND = { create: "commande", billPay: "paiement", call: "appel", status: "suivi", callSt: "suivi", bill: "suivi" };
  const NET_READ = ["status", "callSt", "bill"];
  const R = window.GGR || { run: (f) => f(), rid: () => Date.now().toString(36) + Math.random().toString(36).slice(2), back() {} };
  async function api(op, data, net) {
    const body = { op, rid: RID, ...(data || {}) }; const read = NET_READ.includes(op) && !(data && data.cancel);
    if (!read && !body.rq) body.rq = R.rid();
    const go = async () => {
      if (DEMO) return demoApi(op, data);
      await fb(); if (!firebase.functions) await script(SDK + "firebase-functions-compat.js");
      const r = await firebase.app().functions(REGION).httpsCallable("orderApi", { timeout: 25000 })(body); return r.data || {};
    };
    return R.run(go, { kind: NET_KIND[op] || "lecture", pending: !read, stopable: op === "create" || op === "billPay", quiet: read && !!(net && net.quiet) });
  }
  const errText = (e) => {
    const m = String((e && e.message) || "");
    const T = { ferme: "Le restaurant ne prend plus de commandes en ligne pour le moment.", plat: "Un plat de votre commande n'est plus disponible. Vérifiez votre panier.",
      prix: "La carte vient de changer. Vérifiez votre panier puis réessayez.", creneau: "Cet horaire n'est plus disponible. Choisissez-en un autre.",
      paiement: payModes().includes("place") ? "Le paiement en ligne ne répond pas pour le moment. Choisissez « payer sur place », ou réessayez dans un instant."
        : "Le paiement en ligne ne répond pas pour le moment. Réessayez dans un instant : rien n'a été débité. Si ça continue, appelez le personnel.",
      paiement_oblig: "Ce restaurant demande de payer au moment de commander. Choisissez « payer maintenant ».", trop: "Trop de commandes en même temps. Réessayez dans une minute.",
      lien: "Ce lien n'est plus valide.", table: "Indiquez le numéro de votre table.", contact: "Indiquez votre prénom et votre téléphone." };
    return T[m] || (navigator.onLine === false ? "Pas de connexion internet. Réessayez dans un instant." : "Ça n'a pas marché. Réessayez, ou demandez au personnel.");
  };

  /* ───────── demo restaurant ───────── */
  const DEMO_PH = (h1, h2, e) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${h1}"/><stop offset="1" stop-color="${h2}"/></radialGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="76" font-size="46" text-anchor="middle">${e}</text></svg>`)}`;
  function demoPub() {
    return { name: "Le Bistrot Démo", address: "8 place du Marché, Lyon 2e", phone: "04 78 42 18 90", logo: "", msg: "Produits frais du marché, cuisinés sur place.", look: { style: "moderne", acc: "violet", photos: true, cover: "" },
      cfg: { on: true, table: true, takeaway: true, payOnline: true, payPlace: true, tablePay: "choix", prepMin: 20, tables: 18, pickup: { days: [0, 1, 2, 3, 4, 5, 6], windows: [{ from: "11:30", to: "14:00" }, { from: "18:30", to: "22:00" }], step: 15 }, tipNote: "" },
      cats: [{ id: "partage", t: "À partager" }, { id: "entree", t: "Entrées" }, { id: "plat", t: "Plats" }, { id: "dessert", t: "Desserts" }, { id: "boisson", t: "Boissons" }],
      items: [
        { id: "d1", t: "Croquettes de jambon", d: "Béchamel crémeuse, jambon ibérique, chapelure maison. Par six.", p: 9, c: "partage", al: ["gluten", "lait", "oeufs"], ph: DEMO_PH("#F6C97A", "#C9822E", "🥘") },
        { id: "d2", t: "Planche de charcuterie", d: "Rosette, jambon cru, terrine du chef, cornichons.", p: 18, c: "partage", al: ["sulfites", "lait", "gluten"], ph: DEMO_PH("#F3A29A", "#B8473C", "🥓"), pop: true },
        { id: "d3", t: "Œuf parfait, crème de champignons", d: "Œuf cuit à 64 °C, champignons de Paris, noisettes torréfiées.", p: 11, c: "entree", al: ["oeufs", "lait", "fruitscoque"], ph: DEMO_PH("#FBE7A8", "#D9A23A", "🍳") },
        { id: "d4", t: "Velouté de potimarron", d: "Crème fouettée au cumin, graines de courge.", p: 8.5, c: "entree", al: ["lait"], ph: DEMO_PH("#FFC37A", "#E07B22", "🎃"), veg: true },
        { id: "d5", t: "Bœuf bourguignon", d: "Mijoté sept heures, carottes fondantes, purée de pommes de terre.", p: 22, c: "plat", al: ["sulfites", "lait", "celeri"], ph: DEMO_PH("#C98A6B", "#6E2E1E", "🍲"), pop: true },
        { id: "d6", t: "Filet de bar, beurre blanc", d: "Poisson de ligne, poireaux crayon, beurre blanc au citron.", p: 24, c: "plat", al: ["poissons", "lait"], ph: DEMO_PH("#BFE3F0", "#4E8FB0", "🐟") },
        { id: "d7", t: "Risotto aux cèpes", d: "Carnaroli, cèpes poêlés, parmesan 24 mois.", p: 19, c: "plat", al: ["lait"], ph: DEMO_PH("#E9D7B0", "#9C7A3E", "🍄"), veg: true, out: true },
        { id: "d8", t: "Tarte fine aux pommes", d: "Pâte feuilletée pur beurre, glace vanille.", p: 8, c: "dessert", al: ["gluten", "lait", "oeufs"], ph: DEMO_PH("#F7D99B", "#C98F33", "🥧") },
        { id: "d9", t: "Mousse au chocolat", d: "Chocolat noir 70 %, fleur de sel.", p: 7, c: "dessert", al: ["oeufs", "lait"], ph: DEMO_PH("#B98A6E", "#4A2A1C", "🍫"), pop: true },
        { id: "d10", t: "Limonade maison", d: "Citron pressé, sucre de canne, menthe fraîche. 33 cl.", p: 4.5, c: "boisson", al: [], ph: DEMO_PH("#E6F5B8", "#9CC23E", "🍋"), veg: true },
        { id: "d11", t: "Côtes-du-Rhône, verre", d: "Domaine des Sarments, rouge. 12 cl.", p: 6, c: "boisson", al: ["sulfites"], ph: DEMO_PH("#D8A0B8", "#7A2148", "🍷") },
      ], promos: demoPromos() };
  }
  /* the demo always has a happy hour running (drinks) and a plat du jour */
  function demoPromos() {
    const n = pxParis(), h0 = Math.max(0, Math.floor(n.min / 60) - 1), h1 = Math.min(23, h0 + 3);
    return [{ id: "hh1", k: "hh", t: "Happy hour", days: [0, 1, 2, 3, 4, 5, 6], from: `${pad(h0)}:00`, to: h1 >= 23 ? "23:59" : `${pad(h1)}:00`, it: { d10: 30, d11: 30 } },
      { id: "jour", k: "jour", t: "Plat du jour", days: [], day: n.day, it: { d5: 20 } }];
  }
  const demo = { orders: {} };
  async function demoApi(op, d) {
    await new Promise((r) => setTimeout(r, 650));
    if (op === "create") {
      const oid = "demo" + Date.now().toString(36), k = "0".repeat(32);
      const items = d.items.map((x) => { const it = st.pub.items.find((i) => i.id === x.id); return { id: x.id, name: it.t, price: it.p, q: x.q, note: x.note || "" }; });
      const o = { id: oid, n: 1 + Math.floor(Math.random() * 40), mode: d.mode, table: d.table, items, total: items.reduce((a, x) => a + x.price * x.q, 0), pay: d.pay, paid: false,
        status: d.pay === "stripe" ? "apayer" : "nouvelle", at: Date.now(), slot: d.slot || "", name: d.name || "", note: d.note || "" };
      demo.orders[oid] = o;
      if (d.pay === "stripe") { setTimeout(() => { o.paid = true; o.status = "nouvelle"; o.paidAt = Date.now(); }, 1800); }
      return { oid, k, order: { ...o, items: o.items.slice() } };
    }
    if (op === "status") {
      const o = demo.orders[d.oid]; if (!o) throw new Error("lien");
      const age = Date.now() - (o.paidAt || o.at);
      if (o.status !== "apayer") o.status = age > 16000 ? (o.mode === "table" ? "servie" : "prete") : age > 9000 ? "prete" : age > 3500 ? "prep" : "nouvelle";
      if (o.status === "prete" && o.mode === "table" && age > 16000) o.status = "servie";
      return { order: { ...o } };
    }
    throw new Error("op");
  }

  /* ───────── menu data ───────── */
  const cfg = () => (st.pub && st.pub.cfg) || {};
  const items = () => (st.pub && st.pub.items) || [];
  const itemOf = (id) => items().find((i) => i.id === id);
  const cats = () => { const C = (st.pub && st.pub.cats) || []; return C.filter((c) => items().some((i) => i.c === c.id)); };
  const hits = (it) => (it.al || []).filter((a) => st.al.has(a));
  const qtyOf = (id) => st.cart.filter((l) => l.id === id).reduce((a, l) => a + l.q, 0);
  const count = () => st.cart.reduce((a, l) => a + l.q, 0);
  const total = () => st.cart.reduce((a, l) => { const it = itemOf(l.id); return a + (it ? it.p * l.q : 0); }, 0);
  const saveCart = () => { const s = store.get() || {}; s.cart = st.cart; s.mode = st.mode; s.table = st.table; s.at = Date.now(); store.set(s); };
  function addLine(id, q = 1, note = "") {
    note = String(note || "").trim().slice(0, 140);
    const l = st.cart.find((x) => x.id === id && (x.note || "") === note);
    if (l) l.q = Math.min(30, l.q + q); else st.cart.push({ id, q: Math.min(30, q), note });
    st.cart = st.cart.filter((x) => x.q > 0); saveCart();
  }
  function decItem(id) { for (let i = st.cart.length - 1; i >= 0; i--) if (st.cart[i].id === id) { st.cart[i].q--; break; } st.cart = st.cart.filter((x) => x.q > 0); saveCart(); }

  /* takeaway pickup times today: open windows, from now + preparation time */
  function pickupSlots() {
    const c = cfg(), p = c.pickup || {}, now = new Date(), w = now.getDay(), step = +p.step || 15, lead = +c.prepMin || 20;
    if (Array.isArray(p.days) && !p.days.includes(w)) return [];
    const from = now.getHours() * 60 + now.getMinutes() + lead, out = [];
    (p.windows || []).forEach((x) => { for (let m = toMin(x.from); m <= toMin(x.to); m += step) if (m >= from) out.push(hm(m)); });
    return [...new Set(out)].sort();
  }
  const takeawayOpen = () => !!cfg().takeaway && pickupSlots().length > 0;
  /* à table, the restaurant picks (cfg.tablePay): "avant" pay when ordering (required), "choix" the client picks, "apres" at the end of the meal.
     Takeaway keeps payOnline / payPlace. An older menu doc without tablePay falls back on those two. */
  const tablePay = () => { const c = cfg(); if (["avant", "choix", "apres"].includes(c.tablePay)) return !c.payOnline && c.tablePay !== "apres" ? "apres" : c.tablePay; return !c.payOnline ? "apres" : c.payPlace === false ? "avant" : "choix"; };
  const payModes = () => { const c = cfg(); if (st.mode === "table") { const tp = tablePay(); return tp === "avant" ? ["stripe"] : tp === "apres" ? ["place"] : ["stripe", "place"]; }
    const m = []; if (c.payOnline) m.push("stripe"); if (c.payPlace !== false || !c.payOnline) m.push("place"); return m; };

  /* ───────── the restaurant's look: style, colour, photos, cover (cmPubDoc look) ───────── */
  const LOOKS = ["moderne", "bistrot", "elegant"], ACCS = ["violet", "tomate", "safran", "sauge", "ocean", "encre"];
  let lookOver = null;
  function look() {
    const l = Object.assign({ style: "moderne", acc: "violet", photos: true, cover: "" }, (st.pub && st.pub.look) || {});
    if (DEMO || PV) { if (LOOKS.includes(Q.get("look"))) l.style = Q.get("look"); if (ACCS.includes(Q.get("acc"))) l.acc = Q.get("acc"); if (Q.get("ph") === "0") l.photos = false; }
    if (lookOver) Object.assign(l, lookOver);
    if (!LOOKS.includes(l.style)) l.style = "moderne"; if (!ACCS.includes(l.acc)) l.acc = "violet";
    if (!(typeof l.cover === "string" && /^(https:\/\/|data:image\/)/.test(l.cover))) l.cover = "";
    return l;
  }
  function applyLook() {
    const l = look(), h = document.documentElement; h.dataset.look = l.style; h.dataset.acc = l.acc; h.classList.toggle("noph", l.photos === false);
    const tc = { violet: "#4C1FEA", tomate: "#D63F22", safran: "#B36F00", sauge: "#2A7F51", ocean: "#1B62BC", encre: "#1B1530" }[l.acc]; const m = $('meta[name="theme-color"]'); if (m) m.setAttribute("content", l.style === "elegant" ? "#1B1530" : tc);
  }
  /* the app's preview frame sends a new look without reloading */
  window.addEventListener("message", (e) => { const d = e.data && e.data.ggLook; if (!d || !(DEMO || PV) || e.source !== window.parent) return; lookOver = { style: d.style, acc: d.acc, photos: d.photos !== false, cover: typeof d.cover === "string" ? d.cover : "" }; applyLook(); if (st.pub && st.view === "menu") { const y = window.scrollY; paintMenu(); window.scrollTo(0, y); } });

  /* ───────── views ───────── */
  const logoOf = (p) => (p && typeof p.logo === "string" && /^(data:image\/|https:\/\/)/.test(p.logo) ? p.logo : "");
  function brandIcon(p) {
    const lg = logoOf(p); if (!lg || brandIcon.done === lg) return; brandIcon.done = lg;
    try { $$('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach((l) => l.remove()); ["icon", "apple-touch-icon"].forEach((rel) => { const l = document.createElement("link"); l.rel = rel; l.href = lg; document.head.appendChild(l); }); } catch (e) {}
  }
  function hero(kicker) {
    const p = st.pub || {}, lg = logoOf(p); brandIcon(p);
    const where = st.mode === "table" ? `<button class="qm-where" data-a="mode">${svg.table}<span>Table <b>${esc(st.table)}</b></span></button>`
      : st.mode === "emporter" ? `<button class="qm-where" data-a="mode">${svg.bag}<span>À emporter</span></button>` : "";
    const cv = look().cover;
    return `<header class="qm-hero${cv ? " cover" : ""}"${cv ? ` style="--cover:url('${esc(cv.replace(/'/g, "%27"))}')"` : ""}><div class="qm-hero-in">
      <div class="qm-ph${lg ? " logo" : ""}">${lg ? `<img src="${esc(lg)}" alt="${esc(p.name || "")}" referrerpolicy="no-referrer">` : `<span>${esc(initials(p.name))}</span>`}</div>
      <div class="qm-hn"><span class="qm-k">${esc(kicker || "La carte")}</span><h1>${esc(p.name || "Restaurant")}</h1>${p.address ? `<p>${svg.pin}${esc(p.address)}</p>` : ""}</div>
    </div>${where ? `<div class="qm-hero-bar">${where}${st.al.size ? `<button class="qm-where al" data-a="allergies">${svg.leaf}<span>${st.al.size} allergie${st.al.size > 1 ? "s" : ""}</span></button>` : `<button class="qm-where ghost" data-a="allergies">${svg.leaf}<span>Allergies</span></button>`}</div>` : ""}</header>`;
  }
  const foot = () => `<footer class="qm-foot">Commande en ligne par <a href="https://growthgusto.fr" target="_blank" rel="noopener">Growth Gusto</a>${DEMO && !PV ? `<br><button type="button" class="ggr-demo" data-a="netTest"><svg viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 20 0M5.2 12.4a10 10 0 0 1 13.6 0M8.6 15.9a5 5 0 0 1 6.8 0"/><path d="M3 3l18 18"/></svg>Simuler une coupure réseau</button>` : ""}</footer>`;
  function paintMsg(title, text, retry) {
    closeSheet(true);
    app.innerHTML = `${st.pub ? hero() : `<header class="qm-hero slim"></header>`}<section class="qm-card qm-msg"><div class="qm-msg-ic">${svg.alert}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>
      ${st.pub && st.pub.phone ? `<a class="qm-btn" href="tel:${esc(String(st.pub.phone).replace(/[^\d+]/g, ""))}">${svg.phone}Appeler le ${esc(st.pub.phone)}</a>` : ""}${retry ? `<button class="qm-btn soft" data-a="retry">Réessayer</button>` : ""}</section>${foot()}`;
  }

  /* where are you: at a table (number) or takeaway */
  function paintMode() {
    const c = cfg(), ta = takeawayOpen();
    app.innerHTML = `${hero("Bienvenue")}<section class="qm-card qm-mode">
      <h2>Comment souhaitez-vous commander ?</h2>
      ${c.table ? `<div class="qm-mc st" style="--i:0"><div class="qm-mc-ic">${svg.table}</div><div class="qm-mc-tx"><b>Je suis à table</b><em>On vous apporte tout à votre table.</em></div>
        <div class="qm-tnum"><input id="qmT" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="N°" value="${esc(st.table)}" aria-label="Numéro de table"><button class="qm-btn" data-a="pickTable" aria-label="Valider la table">${svg.check}</button></div></div>` : ""}
      ${c.takeaway ? `<button class="qm-mc st ${ta ? "" : "off"}" style="--i:1" data-a="pickTake" ${ta ? "" : "disabled"}><div class="qm-mc-ic sa">${svg.bag}</div><div class="qm-mc-tx"><b>À emporter</b><em>${ta ? `Prêt en ${+c.prepMin || 20} min environ. Vous choisissez l'heure.` : "Fermé pour le moment."}</em></div><span class="qm-chev">${svg.back}</span></button>` : ""}
      <button class="qm-link" data-a="browse">Voir la carte sans commander</button>
    </section>${foot()}`;
    const i = $("#qmT"); if (i) { i.addEventListener("keydown", (e) => { if (e.key === "Enter") ACT.pickTable(); }); }
  }

  function itemCard(it, i) {
    const q = qtyOf(it.id), h = hits(it), can = !!st.mode && !it.out;
    return `<article class="qm-it st${it.out ? " out" : ""}${h.length ? " hit" : ""}${q ? " has" : ""}" style="--i:${Math.min(i, 14)}" data-a="open" data-id="${esc(it.id)}" tabindex="0" role="button" aria-label="${esc(it.t)}, ${eur(it.p)}">
      <div class="qm-it-tx">
        <div class="qm-it-h"><b>${esc(it.t)}</b><i class="qm-lead" aria-hidden="true"></i><span class="qm-pr2${it.pr && it.pr.pct > 0 ? " deal" : ""}" aria-hidden="true">${it.pr && it.pr.pct > 0 ? `<s>${eur(it.p0).replace(",00", "")}</s> ` : ""}${eur(it.p).replace(",00", "")}</span></div>
        ${it.d ? `<p>${esc(it.d)}</p>` : ""}
        <div class="qm-it-meta">${was(it)}<span class="qm-pr${it.pr && it.pr.pct > 0 ? " deal" : ""}">${eur(it.p)}</span>${dealTag(it)}${it.pop ? `<span class="qm-tag pop">Le plus commandé</span>` : ""}${it.veg ? `<span class="qm-tag veg">${svg.leaf}Végétarien</span>` : ""}${it.out ? `<span class="qm-tag out">Épuisé</span>` : ""}</div>
        ${h.length ? `<div class="qm-it-al">${svg.alert}Contient : ${esc(h.map(alName).join(", ").toLowerCase())}</div>` : it.alu && st.al.size ? `<div class="qm-it-al">${svg.alert}Allergènes : demandez au personnel</div>` : ""}
      </div>
      <div class="qm-it-ph">${it.ph ? `<img src="${esc(it.ph)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${esc(initials(it.t))}</span>`}
        ${can ? (q ? `<div class="qm-step" data-stop="1"><button data-a="dec" data-id="${esc(it.id)}" aria-label="Retirer un">${svg.minus}</button><b>${q}</b><button data-a="inc" data-id="${esc(it.id)}" aria-label="Ajouter un">${svg.plus}</button></div>`
          : `<button class="qm-add" data-a="inc" data-id="${esc(it.id)}" aria-label="Ajouter ${esc(it.t)}">${svg.plus}</button>`) : ""}
      </div>
    </article>`;
  }
  function bar() {
    const n = count();
    return `<div class="qm-bar${n ? " on" : ""}" id="qmBar"><button class="qm-bar-b" data-a="cart" ${n ? "" : "tabindex=-1"}><span class="qm-bar-n" id="qmN">${n}</span><span class="qm-bar-t">Voir la commande</span><span class="qm-bar-p" id="qmP">${eur(total())}</span></button></div>`;
  }
  function paintMenu() {
    const C = cats(), p = st.pub, mine = store.get(), live = mine && mine.o && mine.k && Date.now() - (mine.oAt || 0) < 6 * 3600e3;
    document.title = `La carte · ${p.name || "Restaurant"}`;
    if (!st.cat || !C.some((c) => c.id === st.cat)) st.cat = (C[0] || {}).id || "";
    app.innerHTML = `${hero(st.mode === "emporter" ? "Commande à emporter" : st.mode === "table" ? "Commander à table" : "La carte")}
      ${live && !st.order ? `<button class="qm-track st" style="--i:0" data-a="track">${svg.bell}<span><b>Suivre ma commande</b><em>Commande n° ${esc(mine.n || "")} · touchez pour voir où elle en est</em></span><span class="qm-chev">${svg.back}</span></button>` : ""}
      ${dealBanner()}
      ${p.msg ? `<p class="qm-msgline st" style="--i:1">${esc(p.msg)}</p>` : ""}
      ${!st.mode ? `<p class="qm-msgline info st" style="--i:1">${svg.alert}<span>Vous consultez la carte. <button class="qm-link in" data-a="mode">Commander</button></span></p>` : ""}
      <nav class="qm-cats" id="qmCats" aria-label="Catégories"><div class="qm-cats-in">${C.map((c) => `<button class="qm-cat${c.id === st.cat ? " on" : ""}" data-a="cat" data-v="${esc(c.id)}">${esc(c.t)}</button>`).join("")}<span class="qm-cat-ind" id="qmInd"></span></div></nav>
      <section class="qm-list">${C.map((c) => { const L = items().filter((i) => i.c === c.id); return `<div class="qm-sec" id="sec-${esc(c.id)}" data-cat="${esc(c.id)}"><h2>${esc(c.t)}<span>${L.length}</span></h2>${L.map(itemCard).join("")}</div>`; }).join("") || `<div class="qm-none">La carte arrive bientôt.</div>`}</section>
      ${foot()}${bar()}`;
    catInd(); spy();
  }
  /* sticky category bar: the violet pill slides under the active category, and follows the scroll */
  function catInd(scroll) {
    const nav = $("#qmCats"), on = nav && $(".qm-cat.on", nav), ind = $("#qmInd"); if (!on || !ind) return;
    ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft}px)`;
    if (scroll) { const box = $(".qm-cats-in", nav); const l = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2; nav.scrollTo({ left: Math.max(0, l), behavior: "smooth" }); void box; }
  }
  let spyOn = false, spyLock = 0;
  function spy() {
    if (spyOn) return; spyOn = true;
    window.addEventListener("scroll", () => {
      if (st.view !== "menu" || Date.now() < spyLock) return; const secs = $$(".qm-sec"); if (!secs.length) return;
      const nav = $("#qmCats"); const top = (nav ? nav.getBoundingClientRect().bottom : 0) + 24; let cur = secs[0].dataset.cat;
      secs.forEach((s) => { if (s.getBoundingClientRect().top <= top) cur = s.dataset.cat; });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) cur = secs[secs.length - 1].dataset.cat;
      if (cur !== st.cat) { st.cat = cur; $$(".qm-cat").forEach((b) => b.classList.toggle("on", b.dataset.v === cur)); catInd(true); }
      const n = $("#qmCats"); if (n) n.classList.toggle("stuck", n.getBoundingClientRect().top <= 1);
    }, { passive: true });
  }
  /* repaint one card and the bar only (keeps scroll and avoids flashing the whole list) */
  function refreshItem(id) {
    const old = $(`.qm-it[data-id="${CSS.escape(id)}"]`), it = itemOf(id);
    if (old && it) { const tmp = document.createElement("div"); tmp.innerHTML = itemCard(it, 0); const n = tmp.firstElementChild; n.classList.remove("st"); old.replaceWith(n); }
    const b = $("#qmBar"); if (b) { const was = b.classList.contains("on"); b.classList.toggle("on", count() > 0); $("#qmN").textContent = count(); $("#qmP").textContent = eur(total()); const nn = $("#qmN"); nn.classList.remove("bump"); void nn.offsetWidth; nn.classList.add("bump"); if (!was && count()) pop(520, 0.12); }
  }
  /* a small violet dot flies from the + to the cart bar */
  function fly(from) {
    try {
      const a = from.getBoundingClientRect(), bar = $("#qmN"); if (!bar) return; const b = bar.getBoundingClientRect();
      const d = document.createElement("i"); d.className = "qm-fly"; d.style.left = a.left + a.width / 2 - 9 + "px"; d.style.top = a.top + a.height / 2 - 9 + "px"; document.body.appendChild(d);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      d.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 70}px) scale(1.15)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0.2 }], { duration: 560, easing: "cubic-bezier(.45,.05,.55,.95)" }).onfinish = () => d.remove();
    } catch (e) {}
  }

  /* ───────── sheets ───────── */
  function openSheet(html, cls = "") {
    sheet.innerHTML = `<div class="qm-scrim" data-a="close"></div><div class="qm-sh ${cls}" role="dialog" aria-modal="true"><div class="qm-grab"></div>${html}</div>`;
    sheet.hidden = false; document.documentElement.classList.add("noscroll");
    requestAnimationFrame(() => sheet.classList.add("on")); st.sheet = cls || "sheet";
    swipeClose($(".qm-sh", sheet));
  }
  function closeSheet(now) {
    if (sheet.hidden) return; st.sheet = null; sheet.classList.remove("on"); document.documentElement.classList.remove("noscroll");
    if (now) { sheet.hidden = true; sheet.innerHTML = ""; return; } setTimeout(() => { if (!st.sheet) { sheet.hidden = true; sheet.innerHTML = ""; } }, 380);
  }
  function swipeClose(el) {
    if (!el) return; let y0 = null, dy = 0;
    el.addEventListener("touchstart", (e) => { const sc = $(".qm-sh-sc", el); if (sc && sc.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    el.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; el.style.transition = "none"; }, { passive: true });
    el.addEventListener("touchend", () => { if (y0 == null) return; el.style.transition = ""; el.style.transform = ""; if (dy > 110) closeSheet(); y0 = null; });
  }
  let detail = { id: "", q: 1, note: "" };
  function paintDetail() {
    const it = itemOf(detail.id); if (!it) return;
    const h = hits(it), can = !!st.mode && !it.out;
    openSheet(`<div class="qm-sh-sc">
      <div class="qm-dt-ph">${it.ph ? `<img src="${esc(it.ph)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(initials(it.t))}</span>`}<button class="qm-x" data-a="close" aria-label="Fermer">${svg.x}</button></div>
      <div class="qm-dt">
        <h3>${esc(it.t)}</h3>
        <div class="qm-it-meta">${was(it)}<span class="qm-pr big${it.pr && it.pr.pct > 0 ? " deal" : ""}">${eur(it.p)}</span>${dealTag(it)}${it.veg ? `<span class="qm-tag veg">${svg.leaf}Végétarien</span>` : ""}${it.out ? `<span class="qm-tag out">Épuisé</span>` : ""}</div>
        ${it.d ? `<p>${esc(it.d)}</p>` : ""}
        <div class="qm-dt-al"><b>Allergènes</b>${it.alu ? `<em>Le restaurant vérifie encore les allergènes de ce plat. Demandez au personnel avant de commander.</em>` : (it.al || []).length ? `<div class="qm-alc">${it.al.map((a) => `<span class="${st.al.has(a) ? "hit" : ""}">${esc(alName(a))}</span>`).join("")}</div>` : `<em>Aucun des 14 allergènes réglementaires.</em>`}
          ${h.length ? `<div class="qm-warn">${svg.alert}<span>Ce plat contient ${esc(h.map(alName).join(", ").toLowerCase())}. Parlez-en au personnel avant de commander.</span></div>` : ""}</div>
        ${can ? `<label class="qm-f"><span>Une précision pour la cuisine <i>(facultatif)</i></span><input id="qmDn" maxlength="140" placeholder="Sans oignons, bien cuit…" value="${esc(detail.note)}"></label>` : ""}
      </div></div>
      ${can ? `<div class="qm-sh-cta"><div class="qm-qty"><button data-a="dq" data-v="-1" aria-label="Moins" ${detail.q <= 1 ? "disabled" : ""}>${svg.minus}</button><b id="qmDq">${detail.q}</b><button data-a="dq" data-v="1" aria-label="Plus">${svg.plus}</button></div>
        <button class="qm-btn big grow" data-a="dadd">Ajouter · <span id="qmDt">${eur(it.p * detail.q)}</span></button></div>`
      : !st.mode && !it.out ? `<div class="qm-sh-cta"><button class="qm-btn big grow" data-a="mode">Commander</button></div>` : ""}`, "detail");
    const n = $("#qmDn"); if (n) n.addEventListener("input", () => { detail.note = n.value; });
  }
  function paintAllergies() {
    openSheet(`<div class="qm-sh-sc"><div class="qm-sh-h"><div><h3>Vos allergies</h3><p>Les plats qui en contiennent sont signalés sur la carte. Gardé sur ce téléphone seulement.</p></div><button class="qm-x in" data-a="close" aria-label="Fermer">${svg.x}</button></div>
      <div class="qm-algrid">${AL.map(([id, t], i) => `<button class="qm-alb st${st.al.has(id) ? " on" : ""}" style="--i:${i}" data-a="alt" data-v="${id}" aria-pressed="${st.al.has(id)}"><span class="qm-alb-c">${svg.check}</span>${esc(t)}</button>`).join("")}</div>
      <p class="qm-hint">En cas d'allergie sévère, signalez-la toujours au personnel.</p></div>
      <div class="qm-sh-cta"><button class="qm-btn soft" data-a="alclear">Tout effacer</button><button class="qm-btn grow" data-a="close">Voir la carte</button></div>`, "al");
  }

  /* ───────── cart → order ───────── */
  function paintCart() {
    st.view = "cart"; const c = cfg(), modes = payModes(); if (!modes.includes(st.pay)) st.pay = modes[0];
    const slots = st.mode === "emporter" ? pickupSlots() : []; if (st.mode === "emporter" && !slots.includes(st.slot)) st.slot = slots[0] || "";
    const lines = st.cart.map((l, i) => { const it = itemOf(l.id); if (!it) return ""; return `<div class="qm-ln st" style="--i:${i}"><div class="qm-ln-tx"><b>${esc(it.t)}</b>${l.note ? `<em>${svg.note}${esc(l.note)}</em>` : ""}<span>${eur(it.p * l.q)}</span></div>
      <div class="qm-qty sm"><button data-a="lq" data-v="-1" data-i="${i}" aria-label="Moins">${l.q === 1 ? '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>' : svg.minus}</button><b>${l.q}</b><button data-a="lq" data-v="1" data-i="${i}" aria-label="Plus">${svg.plus}</button></div></div>`; }).join("");
    const t = total(), online = st.pay === "stripe";
    const ok = st.cart.length && (st.mode === "table" ? !!st.table : st.slot && st.name.trim().length >= 2 && st.phone.replace(/\D/g, "").length >= 8);
    openSheet(`<div class="qm-sh-sc">
      <div class="qm-sh-h"><div><h3>Votre commande</h3><p>${st.mode === "table" ? `${svg.table}Table ${esc(st.table)}` : `${svg.bag}À emporter`}</p></div><button class="qm-x in" data-a="close" aria-label="Fermer">${svg.x}</button></div>
      <div class="qm-lines">${lines || `<div class="qm-none">Votre panier est vide.</div>`}</div>
      <button class="qm-more" data-a="close">${svg.plus}Ajouter autre chose</button>
      ${st.mode === "emporter" ? `<div class="qm-blk"><div class="qm-bh">${svg.clock}<b>À quelle heure ?</b></div><div class="qm-slots">${slots.slice(0, 24).map((s, i) => `<button class="qm-slot${s === st.slot ? " on" : ""}" style="--i:${i}" data-a="slot" data-v="${s}">${i === 0 ? `<i>au plus tôt</i>` : ""}${s}</button>`).join("")}</div></div>
        <div class="qm-blk qm-g2"><label class="qm-f"><span>Prénom</span><input id="qmName" autocomplete="given-name" maxlength="40" value="${esc(st.name)}" placeholder="Camille"></label>
        <label class="qm-f"><span>Téléphone</span><input id="qmPhone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" value="${esc(st.phone)}" placeholder="06 12 34 56 78"></label></div>`
      : `<div class="qm-blk"><label class="qm-f"><span>Votre prénom <i>(facultatif)</i></span><input id="qmName" autocomplete="given-name" maxlength="40" value="${esc(st.name)}" placeholder="Pour qu'on vous reconnaisse"></label></div>`}
      <div class="qm-blk"><label class="qm-f"><span>Un mot pour l'équipe <i>(facultatif)</i></span><input id="qmNote" maxlength="200" value="${esc(st.note)}" placeholder="${st.mode === "table" ? "Les desserts plus tard, merci" : "Couverts, sauce à part…"}"></label></div>
      ${modes.length ? `<div class="qm-blk"><div class="qm-bh">${svg.card}<b>Paiement</b></div>${st.mode === "table" && modes.length === 1 ? `<p class="qm-payn">${modes[0] === "stripe" ? `${esc(st.pub.name || "Le restaurant")} demande de régler en commandant. La cuisine reçoit votre commande dès le paiement.` : "Vous réglez à la fin du repas, auprès du serveur. Rien à payer maintenant."}</p>` : ""}<div class="qm-pays">${modes.map((m) => m === "stripe"
        ? `<button class="qm-pay${st.pay === m ? " on" : ""}" data-a="pay" data-v="stripe"><span class="qm-radio"></span><span class="qm-pay-tx"><b>Payer maintenant</b><em>Carte bancaire, Apple Pay, Google Pay</em></span><span class="qm-cards"><i class="cb">CB</i><i class="vi">VISA</i><i class="mc"><s></s><s></s></i></span></button>`
        : `<button class="qm-pay${st.pay === m ? " on" : ""}" data-a="pay" data-v="place"><span class="qm-radio"></span><span class="qm-pay-tx"><b>${st.mode === "table" ? "Payer à la fin du repas" : "Payer au retrait"}</b><em>Carte, espèces ou titre-restaurant, sur place</em></span>${svg.coins}</button>`).join("")}</div></div>` : ""}
      <div class="qm-tot"><span>Total</span><b class="mono">${eur(t)}</b></div>
      ${st.err ? `<div class="qm-err">${svg.alert}<span>${esc(st.err)}</span></div>` : ""}
    </div>
    <div class="qm-sh-cta col"><button class="qm-btn big grow" data-a="send" ${ok && !st.sending ? "" : "disabled"}>${st.sending ? `<span class="qm-spin"></span>Un instant…` : online ? `${svg.lock}Payer ${eur(t)}` : `Envoyer la commande · ${eur(t)}`}</button>
      ${online ? `<p class="qm-legal">Paiement sécurisé par Stripe. ${esc(st.pub.name || "Le restaurant")} reçoit directement votre paiement.</p>` : `<p class="qm-legal">La cuisine reçoit votre commande tout de suite.</p>`}</div>`, "cart");
    const bind = (id, k) => { const el = $("#" + id); if (el) el.addEventListener("input", () => { st[k] = el.value; if (k === "name" || k === "phone") { const b = $('[data-a="send"]'); const ok2 = st.cart.length && (st.mode === "table" ? !!st.table : st.slot && st.name.trim().length >= 2 && st.phone.replace(/\D/g, "").length >= 8); if (b && !st.sending) b.disabled = !ok2; } }); };
    bind("qmName", "name"); bind("qmPhone", "phone"); bind("qmNote", "note");
  }

  /* ───────── the client's own order: live status ───────── */
  const STEPS = [["nouvelle", "Reçue", "La cuisine a bien reçu votre commande."], ["prep", "En préparation", "Le chef s'en occupe."], ["prete", "Prête", ""], ["servie", "Servie", "Bon appétit !"]];
  function stepIdx(o) { const i = STEPS.findIndex((s) => s[0] === o.status); return o.status === "apayer" ? -1 : i < 0 ? 0 : i; }
  function paintOrder() {
    st.view = "order"; closeSheet(true);
    const o = st.order, p = st.pub || {}; document.title = `Commande n° ${o.n || ""} · ${p.name || ""}`;
    const take = o.mode === "emporter", steps = take ? STEPS.slice(0, 3) : STEPS, i = stepIdx(o);
    const off = o.status === "annulee" || o.status === "abandonnee";
    const msgs = { apayer: ["En attente du paiement", "Dès que le paiement est confirmé, la commande part en cuisine."], nouvelle: ["Commande reçue", take ? `On la prépare pour ${o.slot || "l'heure choisie"}.` : "Elle part en cuisine."], prep: ["En préparation", "Le chef s'en occupe."],
      prete: [take ? "C'est prêt !" : "C'est prêt !", take ? "Votre commande vous attend au comptoir." : "On vous l'apporte à votre table."], servie: ["Bon appétit !", "Merci pour votre commande."],
      annulee: ["Commande annulée", "Le restaurant a annulé cette commande. Demandez au personnel."], abandonnee: ["Paiement non abouti", "La commande n'a pas été envoyée. Vous pouvez recommencer."] };
    const [h, s] = msgs[o.status] || msgs.nouvelle;
    app.innerHTML = `${hero(take ? "Commande à emporter" : `Table ${o.table || ""}`)}<section class="qm-card qm-order">
      <div class="qm-ring ${off ? "off" : o.status}" aria-hidden="true">
        <svg viewBox="0 0 120 120"><circle class="tr" cx="60" cy="60" r="52"/><circle class="pg" cx="60" cy="60" r="52" style="--p:${off ? 0 : o.status === "apayer" ? 0.08 : (i + 1) / steps.length}"/></svg>
        <div class="qm-ring-c">${off ? svg.x : o.status === "apayer" ? `<span class="qm-spin big"></span>` : o.status === "prep" ? svg.chef : o.status === "nouvelle" ? svg.check : svg.bell}</div>
        ${o.status === "prete" || o.status === "servie" ? Array.from({ length: 14 }, (_, k) => `<i style="--a:${k * 26}deg;--d:${(k % 5) * 40}ms"></i>`).join("") : ""}
      </div>
      <div class="qm-num">Commande n° <b class="mono">${esc(o.n || "—")}</b></div>
      <h2>${esc(h)}</h2><p class="qm-os">${esc(s)}</p>
      ${!off ? `<ol class="qm-steps">${steps.map((x, k) => `<li class="${k < i ? "done" : k === i ? "now" : ""}"><span class="qm-dot">${k < i ? svg.check : ""}</span><b>${esc(x[1])}</b></li>`).join("")}</ol>` : ""}
      <div class="qm-ticket"><div class="qm-tk-h">${take ? `À emporter${o.slot ? ` · ${esc(o.slot)}` : ""}` : `Table ${esc(o.table || "")}`}${o.name ? ` · ${esc(o.name)}` : ""}</div>
        <div class="qm-tk-l">${(o.items || []).map((x) => `<div><span><b>${x.q}×</b> ${esc(x.name)}${x.note ? `<em>${esc(x.note)}</em>` : ""}</span><span class="mono">${eur(x.price * x.q)}</span></div>`).join("")}</div>
        <div class="qm-tk-t"><span>Total</span><b class="mono">${eur(o.total)}</b></div>
        <div class="qm-tk-s ${o.paid ? "ok" : ""}">${o.paid ? `${svg.check}Payé en ligne` : o.pay === "stripe" && o.status === "apayer" ? "Paiement en cours" : take ? "À régler au retrait" : "À régler sur place"}</div></div>
      ${avisCard(o, take)}
      ${o.status === "abandonnee" || o.status === "servie" || (take && o.status === "prete") ? `<button class="qm-btn${o.status === "abandonnee" ? "" : " soft"}" data-a="again">Nouvelle commande</button>` : ""}
      ${o.status === "apayer" && o.payUrl ? `<a class="qm-btn" href="${esc(o.payUrl)}">${svg.lock}Reprendre le paiement</a>` : ""}
      ${p.phone ? `<a class="qm-link" href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">Une question ? ${esc(p.phone)}</a>` : ""}
    </section>${foot()}`;
  }
  /* « Comment c'était ? » once the order is served (or ready to take away): each star opens the avis/ page with that note picked
     (functions/src/avisclient.js checks the order's private key; the restaurant hears at once about a note of 3 or less) */
  function avisCard(o, take) {
    if (!(o.status === "servie" || (take && o.status === "prete"))) return "";
    const q = DEMO ? "?r=demo" : st.oid && st.okey ? `?r=${encodeURIComponent(RID)}&o=${encodeURIComponent(st.oid)}&k=${encodeURIComponent(st.okey)}` : ""; if (!q) return "";
    const star = '<svg viewBox="0 0 24 24"><path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"/></svg>';
    return `<div class="qm-av"><b>${take ? "Comment c'était ?" : "Vous avez terminé ? Comment c'était ?"}</b><span>Touchez une étoile, c'est fait en dix secondes.</span>
      <div class="qm-av-s">${[1, 2, 3, 4, 5].map((n) => `<a href="../avis/${q}&n=${n}" aria-label="${n} sur 5" style="--i:${n}">${star}</a>`).join("")}</div></div>`;
  }
  async function poll(first) {
    clearTimeout(st.pollT);
    try {
      const r = await api("status", { oid: st.oid, k: st.okey, check: first ? 1 : 0 }, { quiet: !!st.order }); const o = r.order; if (!o) throw new Error("lien");
      const was = st.order && st.order.status; st.order = o;
      if (was && was !== o.status) { if (o.status === "prete") { chime(); vib([60, 40, 60]); } else { pop(600, 0.1); vib(15); } }
      if (!was || was !== o.status || first) paintOrder();
      const s = store.get() || {}; s.o = st.oid; s.k = st.okey; s.n = o.n; s.oAt = s.oAt || o.at || Date.now(); if (["servie", "annulee", "abandonnee"].includes(o.status)) { delete s.o; delete s.k; } store.set(s);
      if (!["servie", "annulee", "abandonnee"].includes(o.status) && !(o.mode === "emporter" && o.status === "prete" && Date.now() - (o.readyAt || Date.now()) > 3600e3)) st.pollT = setTimeout(() => poll(false), document.hidden ? 20000 : o.status === "apayer" ? 3000 : 6000);
      R.back();
    } catch (e) { console.warn(e); if (!st.order) return paintMsg("Commande introuvable", errText(e)); st.pollT = setTimeout(() => poll(false), e && (e.ggNet || e.code === "unavailable" || navigator.onLine === false) ? 5000 : 15000); }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && st.view === "order" && st.oid) poll(false); });

  /* ───────── actions ───────── */
  const ACT = {
    retry: () => load(),
    mode: () => { closeSheet(true); st.view = "mode"; paintMode(); window.scrollTo(0, 0); },
    browse: () => { st.mode = null; st.view = "menu"; paintMenu(); },
    pickTable: () => { const i = $("#qmT"); const v = String((i && i.value) || "").replace(/\D/g, "").slice(0, 4); if (!v) { if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); i.focus(); } vib(30); return; }
      st.mode = "table"; st.table = v; saveCart(); pop(); vib(12); st.view = "menu"; paintMenu(); window.scrollTo(0, 0); },
    pickTake: () => { st.mode = "emporter"; saveCart(); pop(); vib(12); st.view = "menu"; paintMenu(); window.scrollTo(0, 0); },
    cat: (el) => { const v = el.dataset.v; st.cat = v; $$(".qm-cat").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); catInd(true); const s = $("#sec-" + CSS.escape(v)); const nav = $("#qmCats");
      if (s) { spyLock = Date.now() + 900; window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - (nav ? nav.offsetHeight : 0) - 8, behavior: "smooth" }); } pop(820, 0.05, 0.025); },
    open: (el) => { const it = itemOf(el.dataset.id); if (!it) return; detail = { id: it.id, q: 1, note: "" }; pop(700, 0.06, 0.03); paintDetail(); },
    inc: (el, e) => { e.stopPropagation(); const id = el.dataset.id; const it = itemOf(id); if (!it || it.out || !st.mode) return; addLine(id, 1); fly(el); pop(); vib(10); refreshItem(id); },
    dec: (el, e) => { e.stopPropagation(); decItem(el.dataset.id); pop(480, 0.07, 0.03); vib(6); refreshItem(el.dataset.id); },
    dq: (el) => { detail.q = Math.max(1, Math.min(30, detail.q + +el.dataset.v)); $("#qmDq").textContent = detail.q; const it = itemOf(detail.id); $("#qmDt").textContent = eur(it.p * detail.q); $('[data-a="dq"][data-v="-1"]').disabled = detail.q <= 1; pop(640 + detail.q * 20, 0.05, 0.03); vib(6); },
    dadd: () => { const n = $("#qmDn"); addLine(detail.id, detail.q, n ? n.value : detail.note); pop(); vib(12); closeSheet(); refreshItem(detail.id); },
    allergies: () => { pop(700, 0.06, 0.03); paintAllergies(); },
    alt: (el) => { const v = el.dataset.v; if (st.al.has(v)) st.al.delete(v); else st.al.add(v); el.classList.toggle("on", st.al.has(v)); el.setAttribute("aria-pressed", st.al.has(v)); try { localStorage.setItem("gg-qm-al", JSON.stringify([...st.al])); } catch (e) {} pop(st.al.has(v) ? 760 : 520, 0.06, 0.03); vib(8); },
    alclear: () => { st.al.clear(); try { localStorage.removeItem("gg-qm-al"); } catch (e) {} $$(".qm-alb").forEach((b) => b.classList.remove("on")); pop(480, 0.07, 0.03); },
    close: () => { const was = st.sheet; closeSheet(); if (was === "al" || was === "cart") { st.view = "menu"; paintMenu(); } },
    cart: () => { if (!count()) return; st.err = ""; pop(700, 0.06, 0.03); paintCart(); },
    lq: (el) => { const l = st.cart[+el.dataset.i]; if (!l) return; l.q = Math.max(0, Math.min(30, l.q + +el.dataset.v)); st.cart = st.cart.filter((x) => x.q > 0); saveCart(); pop(560, 0.05, 0.03); vib(6); if (!st.cart.length) { closeSheet(); st.view = "menu"; paintMenu(); return; } keepScroll(paintCart); },
    slot: (el) => { st.slot = el.dataset.v; pop(760, 0.05, 0.03); vib(6); keepScroll(paintCart); },
    pay: (el) => { st.pay = el.dataset.v; pop(760, 0.05, 0.03); vib(6); keepScroll(paintCart); },
    send: async (el, ev, resume) => {
      if (st.sending) return;
      /* the order being sent is kept on the phone (pend) with its request id: a page closed or reloaded during a network cut sends it
         again on the next visit, and a second tap on « Envoyer » with the same cart reuses the same id — never two orders */
      const body = resume ? resume.body : { mode: st.mode, table: st.mode === "table" ? st.table : "", items: st.cart.map((l) => ({ id: l.id, q: l.q, note: l.note || "" })), name: st.name.trim(), phone: st.phone.trim(), slot: st.slot, note: st.note.trim(), pay: st.pay,
        back: location.origin + location.pathname };
      const h = JSON.stringify({ ...body, back: "" }), s0 = store.get() || {};
      const rq = resume ? resume.rq : s0.pend && s0.pend.h === h && Date.now() - (s0.pend.at || 0) < 3 * 3600e3 ? s0.pend.rq : R.rid();
      s0.pend = { rq, h, body, at: (s0.pend && s0.pend.rq === rq && s0.pend.at) || Date.now() }; store.set(s0);
      st.sending = true; st.err = ""; keepScroll(paintCart);
      try {
        const r = await api("create", { ...body, rq });
        st.oid = r.oid; st.okey = r.k; st.cart = []; const s = store.get() || {}; delete s.pend; s.cart = []; s.o = r.oid; s.k = r.k; s.n = r.order && r.order.n; s.oAt = Date.now(); store.set(s);
        history.replaceState(null, "", `?r=${encodeURIComponent(RID)}&o=${encodeURIComponent(r.oid)}&k=${r.k}`);
        if (r.url) { location.href = r.url; return; }
        st.sending = false; chime(); vib([20, 40, 20]); st.order = r.order; paintOrder(); poll(false);
      } catch (e) {
        console.warn(e); st.sending = false;
        if (e && e.ggStop) st.err = "Envoi arrêté. Votre panier est gardé : renvoyez-le quand le réseau revient, ou commandez auprès de l'équipe.";
        else { st.err = errText(e); const s = store.get() || {}; if (s.pend && s.pend.rq === rq) { delete s.pend; store.set(s); } }
        vib([30, 30, 30]); keepScroll(paintCart);
      }
    },
    netTest: () => { if (!R.fake) return; pop(520, 0.08, 0.04); vib(12); R.fake(9000); },
    track: () => { const s = store.get(); if (!s || !s.o) return; st.oid = s.o; st.okey = s.k; poll(true); },
    again: () => { history.replaceState(null, "", `?r=${encodeURIComponent(RID)}${st.order && st.order.mode === "table" ? `&t=${encodeURIComponent(st.order.table)}` : "&t=e"}`); clearTimeout(st.pollT); st.order = null; st.oid = ""; st.view = "menu"; paintMenu(); window.scrollTo(0, 0); },
  };
  function keepScroll(fn) { const sc = $(".qm-sh-sc", sheet), y = sc ? sc.scrollTop : 0; const keep = !sheet.hidden; fn(); if (keep) { const n = $(".qm-sh", sheet); if (n) n.classList.add("noanim"); sheet.classList.add("on"); } const s2 = $(".qm-sh-sc", sheet); if (s2) s2.scrollTop = y; }
  document.addEventListener("click", (e) => { const el = e.target.closest("[data-a]"); if (!el || el.disabled) return; const fn = ACT[el.dataset.a]; if (fn) { e.preventDefault(); fn(el, e); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && st.sheet) ACT.close(); if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".qm-it")) { e.preventDefault(); ACT.open(e.target); } });
  window.addEventListener("resize", () => catInd());

  /* ───────── start ───────── */
  async function load() {
    if (!RID) return paintMsg("Lien incomplet", "Ce lien n'est pas complet. Scannez à nouveau le QR code de votre table.");
    try {
      if (DEMO) st.pub = demoPub();
      else { const snap = await R.run(async () => (await fb()).doc(`restos/${RID}/public/menu`).get(), { kind: "lecture" }); st.pub = snap.exists ? snap.data() : null; }
    } catch (e) { console.warn(e); return paintMsg("Connexion impossible", "Vérifiez votre connexion internet, puis réessayez.", true); }
    if (!st.pub || !(st.pub.items || []).length) return paintMsg("Carte introuvable", "Ce restaurant n'a pas (encore) de carte en ligne.");
    st.pub.items.forEach((it) => { if (Array.isArray(it.al)) it.al = [...new Set(it.al.map(alId))]; });
    applyPromos();
    /* a happy hour starts or ends while the menu is open: prices follow (the cart too) */
    setInterval(() => { if (!applyPromos()) return; if (st.view === "menu" && !st.sheet) { const y = window.scrollY; paintMenu(); window.scrollTo(0, y); } else if (st.view === "menu") { const b = $("#qmP"); if (b) b.textContent = eur(total()); } }, 30000);
    applyLook();
    if (PV) { const c0 = cfg(); st.mode = DEMO && /^\d{1,4}$/.test(T0) && c0.on && c0.table ? "table" : null; /* a real menu is only browsed in the preview: no order can leave it */ st.table = st.mode ? T0 : ""; st.view = "menu"; paintMenu(); return; }
    if (st.oid && st.okey) { poll(true); return; }
    const c = cfg(), saved = store.get();
    if (saved && Date.now() - (saved.at || 0) < 3 * 3600e3 && Array.isArray(saved.cart)) st.cart = saved.cart.filter((l) => itemOf(l.id) && !itemOf(l.id).out && l.q > 0);
    if (!c.on) { st.mode = null; paintMenu(); const m = $(".qm-msgline.info"); if (m) m.innerHTML = `${svg.alert}<span>La commande en ligne est fermée pour le moment. Voici la carte.</span>`; return; }
    if (T0 === "e" || T0 === "emporter") { if (c.takeaway) st.mode = "emporter"; }
    else if (/^\d{1,4}$/.test(T0) && c.table) { st.mode = "table"; st.table = T0; }
    else if (saved && saved.mode && Date.now() - (saved.at || 0) < 3 * 3600e3) { st.mode = saved.mode === "table" && c.table && saved.table ? "table" : saved.mode === "emporter" && c.takeaway ? "emporter" : null; st.table = saved.table || ""; }
    if (st.mode === "emporter" && !takeawayOpen()) st.mode = null;
    if (!st.mode && (c.table || takeawayOpen())) { st.view = "mode"; paintMode(); return; }
    st.view = "menu"; paintMenu();
    if (DEMO && Q.get("coupure") === "1") setTimeout(() => ACT.netTest(), 900);
    /* an order that was still on its way when the page closed: send it again, with the same request id */
    if (saved && saved.pend && saved.pend.body && Date.now() - (saved.pend.at || 0) < 3 * 3600e3 && st.cart.length) { setTimeout(() => { paintCart(); ACT.send(null, null, saved.pend); }, 400); return; }
    if (Q.get("cancel") === "1") setTimeout(() => { st.err = "Paiement annulé. Votre panier vous attend."; if (count()) paintCart(); }, 300);
  }
  load();
})();
