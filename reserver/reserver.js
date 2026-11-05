/* Growth Gusto — public booking page (https://app.growthgusto.fr/reserver/?r=<rid>). No account, no tracking.
   Reads restos/{rid}/public/resa (name, address, photo, cfg, booked covers per day and slot — never a client's data, see js/resa.js rsPubDoc)
   and creates one booking restos/{rid}/bookings/{id} with status "en ligne", in a batch that also adds its covers to the slot counter
   of the public doc (firestore rules check both: tools/resa.rules.txt). ?r=demo shows a demo restaurant and books nothing.
   ?embed=1: compact header, for the iframe snippet given in the app. */
(function () {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const Q = new URLSearchParams(location.search);
  const RID = (Q.get("r") || "").trim();
  const EMBED = Q.get("embed") === "1";
  const DEMO = RID === "demo";
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
    alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/></svg>',
  };

  const st = { pub: null, covers: 2, date: null, time: null, step: 1, sending: false, err: "", done: null, name: "", phone: "", email: "", notes: "", more: false };
  const app = $("#app");
  if (EMBED) document.documentElement.classList.add("embed");

  /* ───────── availability (same rules as js/resa.js) ───────── */
  const cfg = () => (st.pub && st.pub.cfg) || {};
  const closedOn = (k) => (cfg().closures || []).some((c) => c && c.from && k >= c.from && k <= (c.to || c.from));
  const svcsOn = (k) => { if (closedOn(k)) return []; const w = parseDay(k).getDay(); return (cfg().services || []).filter((s) => (s.days || []).includes(w)); };
  const slotsOf = (s) => { const out = [], a = toMin(s.from), b = Math.max(a, toMin(s.to)), step = +cfg().slot || 15; for (let m = a; m <= b; m += step) out.push(hm(m)); return out; };
  const atOf = (k, t) => { const d = parseDay(k); d.setHours(0, toMin(t), 0, 0); return d.getTime(); };
  function slotState(k, t, s) {
    const c = cfg(), used = ((st.pub.days || {})[k] || {}), n = +used[t] || 0;
    if (atOf(k, t) < Date.now() + (+c.lead || 0) * 3600e3) return "past";
    if (+c.maxPerSlot && n + st.covers > +c.maxPerSlot) return "full";
    if (+c.maxService) { const tot = slotsOf(s).reduce((a, x) => a + (+used[x] || 0), 0); if (tot + st.covers > +c.maxService) return "full"; }
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
  function demoPub() {
    const days = {}, today = dayKey(); let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 40; i++) { const k = addDays(today, i), m = {}; ["12:00", "12:15", "12:30", "12:45", "13:00", "19:30", "20:00", "20:15", "20:30"].forEach((t) => { m[t] = Math.floor(rnd() * 15); }); days[k] = m; }
    return { name: "Le Bistrot Démo", address: "8 place du Marché, Lyon 2e", phone: "04 78 42 18 90", photo: "", msg: "Terrasse chauffée. Au-delà de 8 personnes, appelez-nous.", mail: false,
      cfg: { services: [{ id: "midi", name: "Midi", from: "12:00", to: "13:45", days: [1, 2, 3, 4, 5, 6] }, { id: "soir", name: "Soir", from: "19:00", to: "21:45", days: [2, 3, 4, 5, 6] }], slot: 15, maxPerSlot: 14, maxService: 0, closures: [], online: true, lead: 2, maxOnline: 8, horizon: 60 }, days };
  }
  async function load() {
    if (!RID) return paintMsg("Lien incomplet", "Ce lien de réservation n'est pas complet. Demandez le bon lien au restaurant.");
    try {
      if (DEMO) st.pub = demoPub();
      else { const db = await fb(); const snap = await db.doc(`restos/${RID}/public/resa`).get(); st.pub = snap.exists ? snap.data() : null; }
    } catch (e) { console.warn(e); return paintMsg("Connexion impossible", "Vérifiez votre connexion internet, puis réessayez.", true); }
    if (!st.pub) return paintMsg("Lien introuvable", "Ce restaurant n'a pas (ou plus) de réservation en ligne.");
    document.title = `Réserver · ${st.pub.name || "Restaurant"}`;
    const c = cfg(); st.covers = Math.min(2, +c.maxOnline || 2);
    st.date = firstFree(dayKey());
    paint();
  }

  /* ───────── views ───────── */
  function hero() {
    const p = st.pub || {};
    return `<header class="rv-hero"><div class="rv-hero-in">
      <div class="rv-ph">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc(initials(p.name))}</span>`}</div>
      <div class="rv-hn"><span class="rv-k">Réserver une table</span><h1>${esc(p.name || "Restaurant")}</h1>${p.address ? `<p>${svg.pin}${esc(p.address)}</p>` : ""}</div>
    </div></header>`;
  }
  function paintMsg(title, text, retry) {
    app.innerHTML = `${st.pub ? hero() : `<header class="rv-hero slim"></header>`}<section class="rv-card rv-msg"><div class="rv-msg-ic">${svg.alert}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>
      ${st.pub && st.pub.phone ? `<a class="rv-btn" href="tel:${esc(String(st.pub.phone).replace(/[^\d+]/g, ""))}">${svg.phone}Appeler le ${esc(st.pub.phone)}</a>` : ""}${retry ? `<button class="rv-btn soft" data-a="retry">Réessayer</button>` : ""}</section>${foot()}`;
  }
  const foot = () => `<footer class="rv-foot">Réservations par <a href="https://growthgusto.fr" target="_blank" rel="noopener">Growth Gusto</a></footer>`;
  function paint() {
    const p = st.pub, c = cfg();
    if (!c.online) return paintMsg("Réservation en ligne fermée", p.phone ? "Pour réserver, appelez-nous directement." : "La réservation en ligne est fermée pour le moment.");
    if (st.done) return paintDone();
    const today = dayKey(), end = lastDay(), max = Math.max(1, +c.maxOnline || 8);
    if (st.covers > max) st.covers = max;
    const strip = []; for (let i = 0; i < 21; i++) { const k = addDays(today, i); if (k > end) break; strip.push(k); }
    const custom = st.date && !strip.includes(st.date);
    const covers = Array.from({ length: max }, (_, i) => i + 1);
    let times = "";
    if (!st.date) times = `<div class="rv-none">Plus aucune place en ligne pour le moment.${p.phone ? ` Appelez-nous au <a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>.` : ""}</div>`;
    else {
      const sv = svcsOn(st.date);
      const blocks = sv.map((s) => { const ts = slotsOf(s).map((t) => ({ t, s: slotState(st.date, t, s) })).filter((x) => x.s !== "past"); return { s, ts }; }).filter((b) => b.ts.length);
      if (!blocks.length || !blocks.some((b) => b.ts.some((x) => x.s === "ok"))) {
        const nx = firstFree(addDays(st.date, 1));
        times = `<div class="rv-none">${sv.length ? "Complet ce jour-là." : "Fermé ce jour-là."}${nx ? ` <button class="rv-link" data-a="date" data-v="${nx}">Prochaine date libre : ${esc(longDay(nx))}</button>` : ""}</div>`;
      } else times = blocks.map((b) => `<div class="rv-svc"><div class="rv-svch">${esc(b.s.name)}</div><div class="rv-times">${b.ts.map((x, i) => `<button class="rv-t${x.t === st.time ? " on" : ""}${x.s !== "ok" ? " off" : ""}" style="--i:${i}" data-a="time" data-v="${x.t}" ${x.s !== "ok" ? 'disabled aria-label="' + x.t + ' complet"' : ""}>${x.t}</button>`).join("")}</div></div>`).join("");
    }
    const ready = !!(st.date && st.time);
    const okForm = st.name.trim().length >= 2 && st.phone.replace(/[^\d]/g, "").length >= 8;
    app.innerHTML = `${hero()}
    <section class="rv-card${st.painted ? "" : " in"}">
      ${p.msg && !EMBED ? `<p class="rv-msgline">${esc(p.msg)}</p>` : ""}
      <div class="rv-step"><div class="rv-sh"><b>Combien de personnes ?</b></div>
        <div class="rv-cov">${covers.map((n) => `<button class="${n === st.covers ? "on" : ""}" data-a="cov" data-v="${n}" aria-pressed="${n === st.covers}">${n}</button>`).join("")}</div>
        ${p.phone ? `<p class="rv-hint">Plus de ${max} personnes ? <a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">Appelez-nous</a></p>` : ""}</div>
      <div class="rv-step"><div class="rv-sh"><b>Quel jour ?</b>${st.date ? `<span>${esc(longDay(st.date))}</span>` : ""}</div>
        <div class="rv-days">${strip.map((k) => { const d = parseDay(k), free = dayFree(k), open = svcsOn(k).length; return `<button class="rv-d${k === st.date ? " on" : ""}${!free ? " off" : ""}" data-a="date" data-v="${k}" ${!open ? "disabled" : ""} aria-label="${esc(longDay(k))}${!open ? ", fermé" : !free ? ", complet" : ""}"><em>${k === today ? "Auj." : DSH[d.getDay()]}</em><b>${d.getDate()}</b><i>${!open ? "fermé" : !free ? "complet" : MSH[d.getMonth()]}</i></button>`; }).join("")}
          <label class="rv-d rv-dp${custom ? " on" : ""}"><em>${custom ? DSH[parseDay(st.date).getDay()] : "Autre"}</em><b>${custom ? parseDay(st.date).getDate() : svg.cal}</b><i>${custom ? MSH[parseDay(st.date).getMonth()] : "date"}</i><input type="date" data-a="pick" min="${today}" max="${end}" value="${st.date || ""}" aria-label="Choisir une autre date"></label></div></div>
      <div class="rv-step" id="rvTimes"><div class="rv-sh"><b>À quelle heure ?</b></div>${times}</div>
      <div class="rv-form${ready ? " open" : ""}" ${ready ? "" : "hidden"}>
        <div class="rv-sum"><span>${svg.users}<b>${st.covers} pers.</b></span><span>${svg.cal}<b>${st.date ? esc(shortDay(st.date)) : ""}</b></span><span>${svg.clock}<b>${st.time || ""}</b></span></div>
        <label class="rv-f"><span>Nom</span><input id="fName" autocomplete="name" autocapitalize="words" maxlength="60" value="${esc(st.name)}" placeholder="Votre nom" enterkeyhint="next"></label>
        <label class="rv-f"><span>Téléphone</span><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" value="${esc(st.phone)}" placeholder="06 12 34 56 78" enterkeyhint="next"></label>
        <label class="rv-f"><span>E-mail <i>${p.mail ? "pour recevoir la confirmation" : "facultatif"}</i></span><input id="fEmail" type="email" inputmode="email" autocomplete="email" maxlength="100" value="${esc(st.email)}" placeholder="vous@exemple.fr"></label>
        <label class="rv-f"><span>Une précision ? <i>facultatif</i></span><textarea id="fNotes" rows="2" maxlength="300" placeholder="Allergie, anniversaire, chaise bébé…">${esc(st.notes)}</textarea></label>
        ${st.err ? `<div class="rv-err">${svg.alert}<span>${esc(st.err)}</span></div>` : ""}
        <button class="rv-btn big" data-a="send" ${okForm && !st.sending ? "" : "disabled"}>${st.sending ? `<span class="rv-spin"></span>Un instant…` : "Réserver"}</button>
        <p class="rv-legal">Vos coordonnées servent uniquement au restaurant pour votre réservation.</p>
      </div>
    </section>${foot()}`;
    if (!st.painted) { st.painted = true; const card = $(".rv-card"); requestAnimationFrame(() => requestAnimationFrame(() => card && card.classList.remove("in"))); }
  }
  function paintDone() {
    const d = st.done, p = st.pub;
    app.innerHTML = `${hero()}<section class="rv-card rv-done">
      <div class="rv-anim" aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="c1" cx="60" cy="60" r="50"/><path class="ck" d="M38 61l15 15 30-32"/></svg>${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 25.7}deg;--d:${(i % 3) * 60}ms"></i>`).join("")}</div>
      <h2>C'est réservé !</h2>
      <p>${p.mail && d.email ? "Un e-mail de confirmation est en route." : "Votre réservation est bien enregistrée auprès du restaurant."}</p>
      <div class="rv-ticket"><div class="rv-tk-h">${esc(p.name || "")}</div>
        <div class="rv-tk-g"><div><em>Jour</em><b>${esc(longDay(d.date))}</b></div><div><em>Heure</em><b>${d.time}</b></div><div><em>Personnes</em><b>${d.covers}</b></div><div><em>Au nom de</em><b>${esc(d.name)}</b></div></div></div>
      <button class="rv-btn" data-a="ics">${svg.cal}Ajouter à mon agenda</button>
      ${p.phone ? `<a class="rv-btn soft" href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}">${svg.phone}Un changement ? Appelez-nous</a>` : ""}
      <button class="rv-link" data-a="again">Faire une autre réservation</button>
    </section>${foot()}`;
  }

  /* ───────── actions ───────── */
  function keep() { const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; }; ["Name", "Phone", "Email", "Notes"].forEach((k) => { const v = g("f" + k); if (v != null) st[k.toLowerCase()] = v; }); }
  function scrollTo(sel) { setTimeout(() => { const e = $(sel); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
  app.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]"); if (!b || b.disabled || b.tagName === "INPUT") return;
    const a = b.dataset.a, v = b.dataset.v; keep(); vib(6);
    if (a === "retry") { location.reload(); return; }
    if (a === "cov") { st.covers = +v; if (st.time && st.date) { const s = svcsOn(st.date).find((x) => slotsOf(x).includes(st.time)); if (!s || slotState(st.date, st.time, s) !== "ok") st.time = null; } if (st.date && !dayFree(st.date)) st.date = firstFree(st.date) || st.date; paint(); return; }
    if (a === "date") { const had = !!st.time; st.date = v; st.time = null; paint(); if (had || b.classList.contains("rv-link")) scrollTo("#rvTimes"); return; }
    if (a === "time") { const first = !st.time; st.time = v; st.err = ""; paint(); if (first) scrollTo(".rv-form"); return; }
    if (a === "send") return send();
    if (a === "again") { st.done = null; st.time = null; paint(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (a === "ics") return ics();
  });
  app.addEventListener("change", (e) => { const t = e.target; if (t.dataset && t.dataset.a === "pick" && t.value) { keep(); st.date = t.value; st.time = null; paint(); } });
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
    const data = { date: st.date, time: st.time, covers: st.covers, name, phone, status: "en ligne", source: "web", createdAt: Date.now(), at: atOf(st.date, st.time) };
    if (email) data.email = email; if (notes) data.notes = notes;
    try {
      if (DEMO) await new Promise((r) => setTimeout(r, 900));
      else {
        const db = await fb(); const FV = firebase.firestore.FieldValue;
        const ref = db.collection(`restos/${RID}/bookings`).doc(); const pub = db.doc(`restos/${RID}/public/resa`);
        const b = db.batch(); b.set(ref, data); b.update(pub, new firebase.firestore.FieldPath("days", st.date, st.time), FV.increment(st.covers), "last", ref.id);
        await b.commit();
      }
      st.sending = false; st.done = { ...data }; vib([12, 50, 20]); paintDone(); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.warn(e); st.sending = false;
      try { if (!DEMO) { const snap = await (await fb()).doc(`restos/${RID}/public/resa`).get(); if (snap.exists) st.pub = snap.data(); } } catch (x) {}
      const s = st.pub && svcsOn(st.date).find((x) => slotsOf(x).includes(st.time));
      if (!cfg().online) { paint(); return; }
      if (!s || slotState(st.date, st.time, s) !== "ok") { st.err = "Ce créneau vient d'être pris. Choisissez-en un autre."; st.time = null; paint(); scrollTo("#rvTimes"); return; }
      st.err = navigator.onLine === false ? "Pas de connexion internet. Réessayez dans un instant." : "La réservation n'a pas pu être envoyée. Réessayez, ou appelez le restaurant.";
      paint();
    }
  }
  function ics() {
    const d = st.done, p = st.pub; if (!d) return;
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
