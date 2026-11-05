/* Growth Gusto — public booking page (https://app.growthgusto.fr/reserver/?r=<rid>). No account, no tracking.
   Reads restos/{rid}/public/resa (name, address, photo, cfg, booked covers per day and slot — never a client's data, see js/resa.js rsPubDoc)
   and creates one booking restos/{rid}/bookings/{id}, in a batch that also adds its covers to the slot counter of the public doc and
   writes the booking's private manage key resaKeys/{rid}/keys/{id} (firestore.rules check all three: tools/resa.rules.txt).
   Status: "en ligne" (confirmed at once), "avalider" (the restaurant validates each request: cfg.validate), "attente" (waiting list on a
   full slot: no counter). ?r=demo shows a demo restaurant and books nothing. ?embed=1: compact header, for the iframe snippet.
   ?r=&b=<booking>&k=<key>: the client's own booking (view, change, cancel) through the callable function resaManage
   (functions/src/resa.js), only when the restaurant's server is live (pub.mail); &ics=1 also downloads the calendar file. */
(function () {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const Q = new URLSearchParams(location.search);
  const RID = (Q.get("r") || "").trim();
  const EMBED = Q.get("embed") === "1";
  const DEMO = RID === "demo";
  const BID = (Q.get("b") || "").trim(), KEY = (Q.get("k") || "").trim().toLowerCase();
  const MANAGE = !!(BID && KEY);
  const REGION = "europe-west9";
  const COUNTS = ["avenir", "en ligne", "confirme", "avalider", "arrive"];
  const CONF = ["avenir", "en ligne", "confirme"];
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
  const hm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const DSH = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const MSH = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const longDay = (k) => { const d = parseDay(k); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const shortDay = (k) => { const d = parseDay(k); return `${DSH[d.getDay()]} ${d.getDate()} ${MSH[d.getMonth()]}`; };
  const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const svg = {
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/></svg>',
  };

  const st = { pub: null, covers: 2, date: null, time: null, wait: false, step: 1, sending: false, err: "", done: null, name: "", phone: "", email: "", notes: "", more: false,
    mb: null, mview: "ticket" /* ticket | edit | cancel | gone */ };
  const app = $("#app");
  if (EMBED) document.documentElement.classList.add("embed");

  /* ───────── availability (same rules as js/resa.js) ───────── */
  const cfg = () => (st.pub && st.pub.cfg) || {};
  const closedOn = (k) => (cfg().closures || []).some((c) => c && c.from && k >= c.from && k <= (c.to || c.from));
  const svcsOn = (k) => { if (closedOn(k)) return []; const w = parseDay(k).getDay(); return (cfg().services || []).filter((s) => (s.days || []).includes(w)); };
  const slotsOf = (s) => { const out = [], a = toMin(s.from), b = Math.max(a, toMin(s.to)), step = +cfg().slot || 15; for (let m = a; m <= b; m += step) out.push(hm(m)); return out; };
  const atOf = (k, t) => { const d = parseDay(k); d.setHours(0, toMin(t), 0, 0); return d.getTime(); };
  const WL = () => cfg().waitlist !== false;
  function bucketOf(k, t) { const m = toMin(t), step = +cfg().slot || 15; const s = svcsOn(k).find((x) => m >= toMin(x.from) - 60 && m <= toMin(x.to) + 120); if (!s) return t; const a = toMin(s.from); return hm(m < a ? a : a + Math.floor((m - a) / step) * step); }
  /* in « modifier », the client's own covers are not counted against him */
  function usedAt(k, t) { let n = +(((st.pub.days || {})[k] || {})[t]) || 0; const b = st.mb; if (MANAGE && b && COUNTS.includes(b.status) && b.date === k && bucketOf(k, b.time) === t) n -= +b.covers || 0; return Math.max(0, n); }
  function slotState(k, t, s) {
    const c = cfg();
    if (MANAGE && st.mb && st.mb.date === k && bucketOf(k, st.mb.time) === t && atOf(k, t) > Date.now()) { /* his current slot stays available */ }
    else if (atOf(k, t) < Date.now() + (+c.lead || 0) * 3600e3) return "past";
    if (MANAGE && st.mb && st.mb.status === "attente") return "ok";
    if (+c.maxPerSlot && usedAt(k, t) + st.covers > +c.maxPerSlot) return "full";
    if (+c.maxService) { const tot = slotsOf(s).reduce((a, x) => a + usedAt(k, x), 0); if (tot + st.covers > +c.maxService) return "full"; }
    return "ok";
  }
  const dayFree = (k) => svcsOn(k).some((s) => slotsOf(s).some((t) => slotState(k, t, s) === "ok"));
  const lastDay = () => addDays(dayKey(), Math.max(1, +cfg().horizon || 60));
  function firstFree(from) { let k = from; const end = lastDay(); while (k <= end) { if (dayFree(k)) return k; k = addDays(k, 1); } return null; }

  /* ───────── data ───────── */
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
  /* the client's own booking: callable resaManage (functions/src/resa.js), checked against the private key */
  async function manage(action, extra) {
    if (DEMO) { await new Promise((r) => setTimeout(r, 700)); const b = { ...st.mb, ...(extra || {}) }; if (action === "cancel") { b.status = "annule"; b.cancelledBy = "client"; } else if (action === "modify" && cfg().validate && CONF.includes(b.status)) b.status = "avalider"; return { b }; }
    await fb(); if (!firebase.functions) await script(SDK + "firebase-functions-compat.js");
    const call = firebase.app().functions(REGION).httpsCallable("resaManage");
    const r = await call({ rid: RID, bid: BID, k: KEY, action, ...(extra || {}) }); return r.data || {};
  }
  const errText = (e) => { const c = String((e && e.code) || "").replace(/^functions\//, ""), m = String((e && e.message) || "");
    if (c === "permission-denied" || c === "invalid-argument" && m === "lien") return "Ce lien n'est plus valide. Appelez le restaurant.";
    if (c === "not-found") return "Cette réservation n'existe plus.";
    if (c === "resource-exhausted") return "Ce créneau vient d'être pris. Choisissez-en un autre.";
    if (m === "passee") return "Cette réservation est déjà passée.";
    if (m === "statut") return "Cette réservation ne peut plus être changée en ligne. Appelez le restaurant.";
    if (m === "delai") return "Trop tard pour ce créneau en ligne. Choisissez-en un autre ou appelez-nous.";
    if (m === "ferme") return "Le restaurant est fermé à ce moment-là.";
    if (m === "couverts") return "Pour plus de personnes, appelez le restaurant.";
    return navigator.onLine === false ? "Pas de connexion internet. Réessayez dans un instant." : "Ça n'a pas marché. Réessayez, ou appelez le restaurant."; };
  const newKey = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join(""); };
  const manageUrl = (bid, k) => `${location.origin}${location.pathname}?r=${encodeURIComponent(RID)}&b=${encodeURIComponent(bid)}&k=${k}`;
  function demoPub() {
    const days = {}, today = dayKey(); let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 40; i++) { const k = addDays(today, i), m = {}; ["12:00", "12:15", "12:30", "12:45", "13:00", "19:30", "20:00", "20:15", "20:30"].forEach((t) => { m[t] = Math.floor(rnd() * 15); }); days[k] = m; }
    return { name: "Le Bistrot Démo", address: "8 place du Marché, Lyon 2e", phone: "04 78 42 18 90", photo: "", msg: "Terrasse chauffée. Au-delà de 8 personnes, appelez-nous.", mail: MANAGE,
      cfg: { services: [{ id: "midi", name: "Midi", from: "12:00", to: "13:45", days: [1, 2, 3, 4, 5, 6] }, { id: "soir", name: "Soir", from: "19:00", to: "21:45", days: [2, 3, 4, 5, 6] }], slot: 15, maxPerSlot: 14, maxService: 0, closures: [], online: true, validate: Q.get("v") === "1", waitlist: true, lead: 2, maxOnline: 8, horizon: 60 }, days };
  }
  async function load() {
    if (!RID) return paintMsg("Lien incomplet", "Ce lien de réservation n'est pas complet. Demandez le bon lien au restaurant.");
    try {
      if (DEMO) st.pub = demoPub();
      else { const db = await fb(); const snap = await db.doc(`restos/${RID}/public/resa`).get(); st.pub = snap.exists ? snap.data() : null; }
    } catch (e) { console.warn(e); return paintMsg("Connexion impossible", "Vérifiez votre connexion internet, puis réessayez.", true); }
    if (!st.pub) return paintMsg("Lien introuvable", "Ce restaurant n'a pas (ou plus) de réservation en ligne.");
    if (MANAGE) return loadMine();
    document.title = `Réserver · ${st.pub.name || "Restaurant"}`;
    const c = cfg(); st.covers = Math.min(2, +c.maxOnline || 2);
    st.date = firstFree(dayKey());
    paint();
  }
  async function loadMine() {
    document.title = `Ma réservation · ${st.pub.name || "Restaurant"}`;
    if (!st.pub.mail) return paintMsg("Votre réservation", st.pub.phone ? "Pour la modifier ou l'annuler, appelez le restaurant." : "Pour la modifier ou l'annuler, contactez le restaurant.");
    try {
      if (DEMO) { const k = firstFree(addDays(dayKey(), 2)) || addDays(dayKey(), 2); st.mb = { date: k, time: "20:00", covers: 2, name: "Camille Martin", status: "en ligne", notes: "" }; }
      else st.mb = (await manage("get")).b;
    } catch (e) { console.warn(e); return paintMsg("Réservation introuvable", errText(e), !/lien|existe/.test(errText(e))); }
    if (!st.mb) return paintMsg("Réservation introuvable", "Cette réservation n'existe plus.");
    st.covers = +st.mb.covers || 2;
    paintMine();
    if (Q.get("ics") === "1" && CONF.includes(st.mb.status)) setTimeout(() => ics(st.mb), 400);
  }

  /* ───────── views ───────── */
  function hero() {
    const p = st.pub || {};
    return `<header class="rv-hero"><div class="rv-hero-in">
      <div class="rv-ph">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc(initials(p.name))}</span>`}</div>
      <div class="rv-hn"><span class="rv-k">${MANAGE ? "Votre réservation" : "Réserver une table"}</span><h1>${esc(p.name || "Restaurant")}</h1>${p.address ? `<p>${svg.pin}${esc(p.address)}</p>` : ""}</div>
    </div></header>`;
  }
  function paintMsg(title, text, retry) {
    app.innerHTML = `${st.pub ? hero() : `<header class="rv-hero slim"></header>`}<section class="rv-card rv-msg"><div class="rv-msg-ic">${svg.alert}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>
      ${st.pub && st.pub.phone ? `<a class="rv-btn" href="tel:${esc(String(st.pub.phone).replace(/[^\d+]/g, ""))}">${svg.phone}Appeler le ${esc(st.pub.phone)}</a>` : ""}${retry ? `<button class="rv-btn soft" data-a="retry">Réessayer</button>` : ""}</section>${foot()}`;
  }
  const foot = () => `<footer class="rv-foot">Réservations par <a href="https://growthgusto.fr" target="_blank" rel="noopener">Growth Gusto</a></footer>`;
  function paint() {
    const p = st.pub, c = cfg();
    const ED = MANAGE && st.mview === "edit";
    if (!c.online && !ED) return paintMsg("Réservation en ligne fermée", p.phone ? "Pour réserver, appelez-nous directement." : "La réservation en ligne est fermée pour le moment.");
    if (st.done) return paintDone();
    const today = dayKey(), end = lastDay(), max = Math.max(1, +c.maxOnline || 8, ED ? +st.mb.covers || 0 : 0);
    if (st.covers > max) st.covers = max;
    const strip = []; for (let i = 0; i < 21; i++) { const k = addDays(today, i); if (k > end) break; strip.push(k); }
    const custom = st.date && !strip.includes(st.date);
    const covers = Array.from({ length: max }, (_, i) => i + 1);
    let times = "";
    if (!st.date) times = `<div class="rv-none">Plus aucune place en ligne pour le moment.${p.phone ? ` Appelez-nous au <a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>.` : ""}</div>`;
    else {
      const sv = svcsOn(st.date);
      const blocks = sv.map((s) => { const ts = slotsOf(s).map((t) => ({ t, s: slotState(st.date, t, s) })).filter((x) => x.s !== "past"); return { s, ts }; }).filter((b) => b.ts.length);
      const wl = WL() && !MANAGE, anyOk = blocks.some((b) => b.ts.some((x) => x.s === "ok"));
      if (!blocks.length || (!anyOk && !wl)) {
        const nx = firstFree(addDays(st.date, 1));
        times = `<div class="rv-none">${sv.length ? "Complet ce jour-là." : "Fermé ce jour-là."}${nx ? ` <button class="rv-link" data-a="date" data-v="${nx}">Prochaine date libre : ${esc(longDay(nx))}</button>` : ""}</div>`;
      } else {
        const nx = !anyOk && firstFree(addDays(st.date, 1));
        times = (!anyOk ? `<div class="rv-none">Complet ce jour-là. Choisissez une heure pour vous inscrire sur la liste d'attente${nx ? `, ou <button class="rv-link" data-a="date" data-v="${nx}">prochaine date libre : ${esc(longDay(nx))}</button>` : ""}.</div>` : "")
          + blocks.map((b) => `<div class="rv-svc"><div class="rv-svch">${esc(b.s.name)}</div><div class="rv-times">${b.ts.map((x, i) => { const full = x.s !== "ok", w = full && wl;
            return `<button class="rv-t${x.t === st.time ? " on" : ""}${full ? (w ? " wl" : " off") : ""}" style="--i:${i}" data-a="time" data-v="${x.t}"${full ? ` data-w="${w ? 1 : ""}"` : ""} ${full && !w ? 'disabled aria-label="' + x.t + ' complet"' : full ? 'aria-label="' + x.t + ' complet, liste d\'attente"' : ""}>${x.t}${w ? "<i>attente</i>" : ""}</button>`; }).join("")}</div></div>`).join("")
          + (wl && anyOk && blocks.some((b) => b.ts.some((x) => x.s !== "ok")) ? `<p class="rv-hint">Heure complète ? Touchez-la pour vous inscrire sur la liste d'attente.</p>` : "");
      }
    }
    const ready = !!(st.date && st.time);
    const okForm = st.name.trim().length >= 2 && st.phone.replace(/[^\d]/g, "").length >= 8;
    const same = ED && st.date === st.mb.date && st.time === st.mb.time && st.covers === +st.mb.covers;
    const form = ED ? `<div class="rv-form${ready ? " open" : ""}" ${ready ? "" : "hidden"}>
        <div class="rv-sum"><span>${svg.users}<b>${st.covers} pers.</b></span><span>${svg.cal}<b>${st.date ? esc(shortDay(st.date)) : ""}</b></span><span>${svg.clock}<b>${st.time || ""}</b></span></div>
        ${c.validate && CONF.includes(st.mb.status) ? `<p class="rv-hint rv-vh">Le restaurant valide la modification et vous répond par e-mail.</p>` : ""}
        ${st.err ? `<div class="rv-err">${svg.alert}<span>${esc(st.err)}</span></div>` : ""}
        <button class="rv-btn big" data-a="msave" ${same || st.sending ? "disabled" : ""}>${st.sending ? `<span class="rv-spin"></span>Un instant…` : same ? "Rien n'a changé" : "Enregistrer la modification"}</button>
        <button class="rv-btn soft" data-a="mback">Retour</button></div>` : "";
    app.innerHTML = `${hero()}
    <section class="rv-card${st.painted ? "" : " in"}">
      ${ED ? `<div class="rv-edh"><button class="rv-back" data-a="mback" aria-label="Retour">${svg.back}</button><b>Modifier ma réservation</b></div>` : p.msg && !EMBED ? `<p class="rv-msgline">${esc(p.msg)}</p>` : ""}
      <div class="rv-step"><div class="rv-sh"><b>Combien de personnes ?</b></div>
        <div class="rv-cov">${covers.map((n) => `<button class="${n === st.covers ? "on" : ""}" data-a="cov" data-v="${n}" aria-pressed="${n === st.covers}">${n}</button>`).join("")}</div>
        ${p.phone && !ED ? `<p class="rv-hint">Plus de ${max} personnes ? <a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">Appelez-nous</a></p>` : ""}</div>
      <div class="rv-step"><div class="rv-sh"><b>Quel jour ?</b>${st.date ? `<span>${esc(longDay(st.date))}</span>` : ""}</div>
        <div class="rv-days">${strip.map((k) => { const d = parseDay(k), free = dayFree(k), open = svcsOn(k).length; return `<button class="rv-d${k === st.date ? " on" : ""}${!free ? " off" : ""}" data-a="date" data-v="${k}" ${!open ? "disabled" : ""} aria-label="${esc(longDay(k))}${!open ? ", fermé" : !free ? ", complet" : ""}"><em>${k === today ? "Auj." : DSH[d.getDay()]}</em><b>${d.getDate()}</b><i>${!open ? "fermé" : !free ? "complet" : MSH[d.getMonth()]}</i></button>`; }).join("")}
          <label class="rv-d rv-dp${custom ? " on" : ""}"><em>${custom ? DSH[parseDay(st.date).getDay()] : "Autre"}</em><b>${custom ? parseDay(st.date).getDate() : svg.cal}</b><i>${custom ? MSH[parseDay(st.date).getMonth()] : "date"}</i><input type="date" data-a="pick" min="${today}" max="${end}" value="${st.date || ""}" aria-label="Choisir une autre date"></label></div></div>
      <div class="rv-step" id="rvTimes"><div class="rv-sh"><b>À quelle heure ?</b></div>${times}</div>
      ${ED ? form : `<div class="rv-form${ready ? " open" : ""}" ${ready ? "" : "hidden"}>
        <div class="rv-sum"><span>${svg.users}<b>${st.covers} pers.</b></span><span>${svg.cal}<b>${st.date ? esc(shortDay(st.date)) : ""}</b></span><span>${svg.clock}<b>${st.time || ""}</b></span></div>
        ${st.wait ? `<div class="rv-wl">${svg.clock}<span><b>Liste d'attente</b>Ce créneau est complet. Si une table se libère, le restaurant vous contacte. Rien n'est réservé pour l'instant.</span></div>` : c.validate ? `<p class="rv-hint rv-vh">Le restaurant valide chaque demande et vous répond au plus vite.</p>` : ""}
        <label class="rv-f"><span>Nom</span><input id="fName" autocomplete="name" autocapitalize="words" maxlength="60" value="${esc(st.name)}" placeholder="Votre nom" enterkeyhint="next"></label>
        <label class="rv-f"><span>Téléphone</span><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" value="${esc(st.phone)}" placeholder="06 12 34 56 78" enterkeyhint="next"></label>
        <label class="rv-f"><span>E-mail <i>${p.mail ? "pour recevoir la confirmation" : "facultatif"}</i></span><input id="fEmail" type="email" inputmode="email" autocomplete="email" maxlength="100" value="${esc(st.email)}" placeholder="vous@exemple.fr"></label>
        <label class="rv-f"><span>Une précision ? <i>facultatif</i></span><textarea id="fNotes" rows="2" maxlength="300" placeholder="Allergie, anniversaire, chaise bébé…">${esc(st.notes)}</textarea></label>
        ${st.err ? `<div class="rv-err">${svg.alert}<span>${esc(st.err)}</span></div>` : ""}
        <button class="rv-btn big" data-a="send" ${okForm && !st.sending ? "" : "disabled"}>${st.sending ? `<span class="rv-spin"></span>Un instant…` : st.wait ? "M'inscrire sur la liste d'attente" : c.validate ? "Envoyer ma demande" : "Réserver"}</button>
        <p class="rv-legal">Vos coordonnées servent uniquement au restaurant pour votre réservation.</p>
      </div>`}
    </section>${foot()}`;
    if (!st.painted) { st.painted = true; const card = $(".rv-card"); requestAnimationFrame(() => requestAnimationFrame(() => card && card.classList.remove("in"))); }
  }
  const anim = (kind) => `<div class="rv-anim${kind === "ok" ? "" : " " + kind}" aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="c1" cx="60" cy="60" r="50"/>${kind === "ok" ? `<path class="ck" d="M38 61l15 15 30-32"/>` : kind === "off" ? `<path class="ck" d="M44 44l32 32M76 44 44 76"/>` : `<path class="ck" d="M60 36v25l15 10"/>`}</svg>${kind === "ok" ? Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 25.7}deg;--d:${(i % 3) * 60}ms"></i>`).join("") : ""}</div>`;
  const ticket = (d, p, stt) => `<div class="rv-ticket">${stt ? `<div class="rv-tk-s ${stt[1]}">${stt[0]}</div>` : ""}<div class="rv-tk-h">${esc(p.name || "")}</div>
        <div class="rv-tk-g${stt && stt[1] === "off" ? " off" : ""}"><div><em>Jour</em><b>${esc(longDay(d.date))}</b></div><div><em>Heure</em><b>${d.time}</b></div><div><em>Personnes</em><b>${d.covers}</b></div><div><em>Au nom de</em><b>${esc(d.name)}</b></div></div></div>`;
  const tel = (p, label) => (p.phone ? `<a class="rv-btn soft" href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">${svg.phone}${label}</a>` : "");
  function paintDone() {
    const d = st.done, p = st.pub, wait = d.status === "attente", ask = d.status === "avalider", mail = p.mail && d.email;
    const head = wait ? "Vous êtes sur la liste d'attente" : ask ? "Demande envoyée !" : "C'est réservé !";
    const line = wait ? "Rien n'est encore réservé : si une table se libère, le restaurant vous contacte."
      : ask ? `Le restaurant valide votre demande au plus vite.${mail ? " Sa réponse arrive par e-mail." : " Il vous contacte si besoin."}`
      : mail ? "Un e-mail de confirmation est en route." : "Votre réservation est bien enregistrée auprès du restaurant.";
    app.innerHTML = `${hero()}<section class="rv-card rv-done">
      ${anim(wait || ask ? "wait" : "ok")}
      <h2>${head}</h2>
      <p>${line}</p>
      ${ticket(d, p, wait ? ["Liste d'attente", "wl"] : ask ? ["En attente de validation", "va"] : null)}
      ${!wait && !ask ? `<button class="rv-btn" data-a="ics">${svg.cal}Ajouter à mon agenda</button>` : ""}
      ${p.mail && d.k ? `<a class="rv-btn soft" href="${esc(manageUrl(d.id, d.k))}">${svg.edit}Modifier ou annuler</a>` : tel(p, "Un changement ? Appelez-nous")}
      <button class="rv-link" data-a="again">Faire une autre réservation</button>
    </section>${foot()}`;
  }
  /* ───────── the client's own booking ───────── */
  function paintMine() {
    const b = st.mb, p = st.pub, v = st.mview;
    const live = ["avenir", "en ligne", "confirme", "avalider", "attente"].includes(b.status) && atOf(b.date, b.time) > Date.now();
    const STT = { avalider: ["En attente de validation", "va"], attente: ["Liste d'attente", "wl"], annule: [b.cancelledBy === "client" ? "Annulée par vous" : "Annulée par le restaurant", "off"], refuse: ["Demande refusée", "off"], noshow: ["Non honorée", "off"], arrive: ["Vous êtes venu, merci !", "ok"] };
    const stt = STT[b.status] || ["Confirmée", "ok"];
    if (v === "edit") return paint();
    if (v === "cancel") {
      app.innerHTML = `${hero()}<section class="rv-card rv-done">
        <h2 class="rv-q">Annuler votre table ?</h2><p>Le restaurant est prévenu tout de suite et la place est libérée.</p>
        ${ticket(b, p)}${st.err ? `<div class="rv-err">${svg.alert}<span>${esc(st.err)}</span></div>` : ""}
        <button class="rv-btn danger" data-a="mcancelok" ${st.sending ? "disabled" : ""}>${st.sending ? `<span class="rv-spin"></span>Un instant…` : "Oui, annuler"}</button>
        <button class="rv-btn soft" data-a="mback">Non, je garde ma table</button></section>${foot()}`;
      return;
    }
    const gone = v === "gone";
    app.innerHTML = `${hero()}<section class="rv-card rv-done rv-mine">
      ${gone ? anim(b.status === "annule" ? "off" : b.status === "avalider" ? "wait" : "ok") : ""}
      <h2>${gone ? (b.status === "annule" ? "Réservation annulée" : b.status === "avalider" ? "Demande modifiée" : "C'est modifié !") : "Votre réservation"}</h2>
      ${gone ? `<p>${b.status === "annule" ? "Le restaurant est prévenu. À bientôt, on l'espère !" : b.status === "avalider" ? "Le restaurant valide la modification et vous répond par e-mail." : "Le restaurant est prévenu, un e-mail de confirmation arrive."}</p>` : b.resaMsg && (b.status === "refuse" || b.status === "annule") && b.cancelledBy !== "client" ? `<p class="rv-rmsg">« ${esc(b.resaMsg)} »</p>` : ""}
      ${ticket(b, p, stt)}
      ${b.notes ? `<p class="rv-hint">Votre précision : ${esc(b.notes)}</p>` : ""}
      ${live ? `${CONF.includes(b.status) ? `<button class="rv-btn" data-a="mics">${svg.cal}Ajouter à mon agenda</button>` : ""}
        <button class="rv-btn soft" data-a="medit">${svg.edit}Changer l'heure ou le nombre</button>
        <button class="rv-btn soft danger-t" data-a="mcancel">${svg.x}Annuler ma réservation</button>`
        : `<a class="rv-btn" href="?r=${encodeURIComponent(RID)}">${svg.cal}Réserver une autre date</a>`}
      ${p.phone ? `<p class="rv-hint">Une question ? <a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a></p>` : ""}
    </section>${foot()}`;
  }

  /* ───────── actions ───────── */
  function keep() { const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; }; ["Name", "Phone", "Email", "Notes"].forEach((k) => { const v = g("f" + k); if (v != null) st[k.toLowerCase()] = v; }); }
  function scrollTo(sel) { setTimeout(() => { const e = $(sel); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
  app.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]"); if (!b || b.disabled || b.tagName === "INPUT") return;
    const a = b.dataset.a, v = b.dataset.v; keep(); vib(6);
    if (a === "retry") { location.reload(); return; }
    if (a === "cov") { st.covers = +v; st.err = ""; if (st.time && st.date) { const s = svcsOn(st.date).find((x) => slotsOf(x).includes(st.time)); if (!s || (slotState(st.date, st.time, s) !== "ok" && !(WL() && !MANAGE))) st.time = null; else if (s) st.wait = slotState(st.date, st.time, s) !== "ok"; } if (st.date && !dayFree(st.date)) st.date = firstFree(st.date) || st.date; paint(); return; }
    if (a === "date") { const had = !!st.time; st.date = v; st.time = null; st.wait = false; st.err = ""; paint(); if (had || b.classList.contains("rv-link")) scrollTo("#rvTimes"); return; }
    if (a === "time") { const first = !st.time; st.time = v; st.wait = b.dataset.w === "1"; st.err = ""; paint(); if (first) scrollTo(".rv-form"); return; }
    if (a === "send") return send();
    if (a === "again") { st.done = null; st.time = null; st.wait = false; paint(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (a === "ics") return ics(st.done);
    if (a === "mics") return ics(st.mb);
    if (a === "medit") { st.mview = "edit"; st.err = ""; st.covers = +st.mb.covers || 2; st.date = st.mb.date; const bk = bucketOf(st.mb.date, st.mb.time); st.time = svcsOn(st.date).some((x) => slotsOf(x).includes(bk)) ? bk : null; st.painted = false; paint(); window.scrollTo({ top: 0 }); return; }
    if (a === "mcancel") { st.mview = "cancel"; st.err = ""; paintMine(); window.scrollTo({ top: 0 }); return; }
    if (a === "mback") { st.mview = "ticket"; st.err = ""; paintMine(); window.scrollTo({ top: 0 }); return; }
    if (a === "mcancelok" || a === "msave") return mine(a === "mcancelok" ? "cancel" : "modify");
  });
  app.addEventListener("change", (e) => { const t = e.target; if (t.dataset && t.dataset.a === "pick" && t.value) { keep(); st.date = t.value; st.time = null; st.wait = false; paint(); } });
  app.addEventListener("input", (e) => {
    if (!/^f(Name|Phone|Email|Notes)$/.test(e.target.id || "")) return; keep();
    const ok = st.name.trim().length >= 2 && st.phone.replace(/[^\d]/g, "").length >= 8; const btn = $('[data-a="send"]'); if (btn && !st.sending) btn.disabled = !ok;
  });
  app.addEventListener("keydown", (e) => { if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return; const order = ["fName", "fPhone", "fEmail", "fNotes"]; const i = order.indexOf(e.target.id); if (i < 0) return; e.preventDefault(); const n = document.getElementById(order[i + 1]); if (n) n.focus(); });

  async function send() {
    keep(); if (st.sending || !st.date || !st.time) return;
    const name = st.name.trim().slice(0, 60), phone = st.phone.trim().slice(0, 25), email = st.email.trim().slice(0, 100), notes = st.notes.trim().slice(0, 300);
    if (name.length < 2 || phone.replace(/[^\d]/g, "").length < 8) return;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { st.err = "Cette adresse e-mail semble incomplète."; paint(); return; }
    st.sending = true; st.err = ""; paint();
    const wait = st.wait && WL(), status = wait ? "attente" : cfg().validate ? "avalider" : "en ligne";
    const data = { date: st.date, time: st.time, covers: st.covers, name, phone, status, source: "web", createdAt: Date.now(), at: atOf(st.date, st.time) };
    if (email) data.email = email; if (notes) data.notes = notes;
    let id = "demo", k = newKey();
    try {
      if (DEMO) await new Promise((r) => setTimeout(r, 900));
      else {
        const db = await fb(); const FV = firebase.firestore.FieldValue;
        const ref = db.collection(`restos/${RID}/bookings`).doc(); const pub = db.doc(`restos/${RID}/public/resa`); id = ref.id;
        const b = db.batch(); b.set(ref, data);
        /* a booking takes its seats on the public counter; a waiting-list entry takes none */
        if (!wait) b.update(pub, new firebase.firestore.FieldPath("days", st.date, st.time), FV.increment(st.covers), "last", ref.id);
        /* its private key, for the « Modifier ou annuler » link: never readable by anyone but the server */
        b.set(db.doc(`resaKeys/${RID}/keys/${ref.id}`), { k, at: Date.now() });
        await b.commit();
      }
      st.sending = false; st.wait = false; st.done = { ...data, id, k: DEMO ? "" : k }; vib([12, 50, 20]); paintDone(); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.warn(e); st.sending = false;
      try { if (!DEMO) { const snap = await (await fb()).doc(`restos/${RID}/public/resa`).get(); if (snap.exists) st.pub = snap.data(); } } catch (x) {}
      const s = st.pub && svcsOn(st.date).find((x) => slotsOf(x).includes(st.time));
      if (!cfg().online) { paint(); return; }
      if (!s || (slotState(st.date, st.time, s) !== "ok" && !wait)) { st.err = "Ce créneau vient d'être pris. Choisissez-en un autre."; st.time = null; paint(); scrollTo("#rvTimes"); return; }
      st.err = navigator.onLine === false ? "Pas de connexion internet. Réessayez dans un instant." : "La réservation n'a pas pu être envoyée. Réessayez, ou appelez le restaurant.";
      paint();
    }
  }
  async function mine(action) {
    if (st.sending) return; st.sending = true; st.err = ""; action === "cancel" ? paintMine() : paint();
    try {
      const r = await manage(action, action === "modify" ? { date: st.date, time: st.time, covers: st.covers } : null);
      st.mb = { ...st.mb, ...(r.b || {}) }; st.sending = false; st.mview = "gone"; vib([12, 50, 20]); paintMine(); window.scrollTo({ top: 0, behavior: "smooth" });
      if (!DEMO) try { const snap = await (await fb()).doc(`restos/${RID}/public/resa`).get(); if (snap.exists) st.pub = snap.data(); } catch (x) {}
    } catch (e) {
      console.warn(e); st.sending = false; st.err = errText(e);
      if (action === "modify" && String(e && e.code || "").includes("resource-exhausted")) { st.time = null; try { const snap = await (await fb()).doc(`restos/${RID}/public/resa`).get(); if (snap.exists) st.pub = snap.data(); } catch (x) {} }
      action === "cancel" ? paintMine() : paint();
    }
  }
  function ics(d) {
    const p = st.pub; if (!d) return;
    const s = parseDay(d.date); s.setHours(0, toMin(d.time), 0, 0); const e = new Date(s.getTime() + 2 * 3600e3);
    const f = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const t = new Date(); const stamp = `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
    const clean = (x) => String(x || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, " ");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Growth Gusto//Reservation//FR", "BEGIN:VEVENT", `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@growthgusto.fr`, `DTSTAMP:${stamp}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
      `SUMMARY:${clean(`Table · ${p.name || "Restaurant"} (${d.covers} pers.)`)}`, ...(p.address ? [`LOCATION:${clean(p.address)}`] : []), ...(p.phone ? [`DESCRIPTION:${clean("Réservé au nom de " + d.name + ". Restaurant : " + p.phone)}`] : []), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); a.download = "reservation.ics"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  load();
})();
