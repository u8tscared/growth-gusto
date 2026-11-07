/* Growth Gusto — « Comment nous avez-vous trouvés ? » : the client's page after the meal (https://app.growthgusto.fr/avis/).
   Links:  ?r=<rid>&b=<booking>&k=<key>[&n=1-5]  from the e-mail « Votre déjeuner s'est bien passé ? » (stars pick the note at once)
           ?r=<rid>&o=<order>&k=<key>[&n=]      from the QR order page once the order is served
           ?r=<rid>                             the « Votre avis » QR card on the table or the bill (anonymous)
           ?r=demo                              demo: nothing is sent
   The callable avisClient (functions/src/avisclient.js) checks the link, keeps the feedback (restos/{rid}/feedback) and warns the team
   when the note is 3 or less. Google has no way to post a review for someone: happy or not, every client gets the « Publier sur Google »
   button, which copies their words and opens the restaurant's Google review form, where they only have to paste. */
(function () {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const REGION = "europe-west9";
  const Q = new URLSearchParams(location.search);
  const RID = (Q.get("r") || "").trim();
  const DEMO = RID === "demo";
  const BID = (Q.get("b") || "").trim(), OID = (Q.get("o") || "").trim(), KEY = (Q.get("k") || "").trim().toLowerCase();
  const N0 = Math.round(+Q.get("n") || 0);
  const ANON = !BID && !OID;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const svg = {
    star: '<svg viewBox="0 0 24 24"><path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/></svg>',
    wand: '<svg viewBox="0 0 24 24"><path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M4 20 14 10"/><path d="m19 13 .6 1.4L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  };
  const WORDS = ["Touchez une étoile", "Décevant", "Bof", "Correct", "Très bien", "Parfait !"];
  /* the same tag ids as the server (functions/src/avisclient.js TAGS); the label depends on the note */
  const TAG_UP = [["cuisine", "La cuisine"], ["service", "Le service"], ["accueil", "L'accueil"], ["ambiance", "L'ambiance"], ["prix", "Le rapport qualité-prix"], ["quantite", "Les assiettes généreuses"]];
  const TAG_DOWN = [["attente", "L'attente"], ["service", "Le service"], ["cuisine", "La cuisine"], ["temperature", "Plats pas assez chauds"], ["quantite", "Les quantités"], ["prix", "Le prix"], ["bruit", "Le bruit"], ["proprete", "La propreté"]];

  const st = { info: null, n: N0 >= 1 && N0 <= 5 ? N0 : 0, tags: new Set(), text: "", recontact: true, name: "", contact: "", sending: false, view: "rate", fid: "", sugg: 0, copied: false };
  const app = $("#app");

  /* ───────── sound: soft pops, no file ───────── */
  let AC = null;
  function pop(f = 660, d = 0.09, v = 0.05) {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d * 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {}
  }
  const chime = () => { pop(523, 0.16, 0.05); setTimeout(() => pop(659, 0.16, 0.05), 110); setTimeout(() => pop(784, 0.24, 0.05), 220); };
  function toast(msg) { const t = $("#avToast"); if (!t) return; t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 3200); }

  /* ───────── server ───────── */
  function script(src) { return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
  async function api(op, extra) {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, op === "get" ? 250 : 650));
      if (op === "get") return { name: "Le Bistrot Démo", logo: "", first: ANON ? "" : "Camille", meal: new Date().getHours() < 16 ? "déjeuner" : "dîner", google: "https://g.page/r/CbistrotDemoGG/review", phone: "04 78 42 18 90", done: null };
      return { ok: true, google: "https://g.page/r/CbistrotDemoGG/review", fid: "demo" };
    }
    if (!window.GG_FIREBASE) throw new Error("nocfg");
    if (!(window.firebase && firebase.initializeApp)) await script(SDK + "firebase-app-compat.js");
    if (!firebase.functions) await script(SDK + "firebase-functions-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(window.GG_FIREBASE);
    const call = firebase.app().functions(REGION).httpsCallable("avisClient");
    const r = await call({ op, rid: RID, ...(BID ? { bid: BID } : {}), ...(OID ? { oid: OID } : {}), ...(KEY ? { k: KEY } : {}), ...(extra || {}) }); return r.data || {};
  }
  const errText = (e) => { const c = String((e && e.code) || "").replace(/^functions\//, ""), m = String((e && e.message) || "");
    if (c === "permission-denied" || m === "lien") return "Ce lien n'est plus valide. Merci quand même d'avoir pensé à nous !";
    if (c === "not-found") return "Ce lien ne correspond plus à une visite.";
    if (m === "tard") return "Votre avis est déjà enregistré depuis plus de deux jours. Merci !";
    if (m === "trop") return "Beaucoup d'avis aujourd'hui : réessayez demain, ou dites-le directement à l'équipe.";
    return navigator.onLine === false ? "Pas de connexion internet. Réessayez dans un instant." : "Ça n'a pas marché. Réessayez dans un instant."; };

  /* ───────── a review they can paste on Google: their words, or a sentence written from what they ticked ───────── */
  function suggest(k) {
    const I = st.info || {}, rn = I.name || "ce restaurant", m = I.meal === "repas" ? "repas" : I.meal || "repas";
    const T = TAG_UP.filter(([id]) => st.tags.has(id)).map(([, t]) => t.toLowerCase());
    const list = T.length > 1 ? T.slice(0, -1).join(", ") + " et " + T[T.length - 1] : T[0] || "";
    const great = st.n === 5;
    const S = [
      `${great ? "Un excellent" : "Un très bon"} ${m} chez ${rn}.${list ? ` ${list[0].toUpperCase() + list.slice(1)}, tout était ${great ? "parfait" : "très réussi"}.` : ""} Je recommande${great ? " sans hésiter" : ""} !`,
      `${list ? `${list[0].toUpperCase() + list.slice(1)} : on a été ${great ? "conquis" : "ravis"}.` : `On a passé un ${great ? "super" : "très bon"} moment.`} Merci à toute l'équipe de ${rn}, on reviendra !`,
      `${great ? "Coup de cœur" : "Belle adresse"} : ${rn}.${list ? ` Mention spéciale pour ${T.length > 1 ? T.slice(0, -1).join(", ") + " et " + T[T.length - 1] : T[0]}.` : ""} ${great ? "À ne pas manquer." : "À essayer."}`,
    ];
    return S[(k || 0) % S.length];
  }

  /* ───────── views ───────── */
  const logoOf = (p) => (p && typeof p.logo === "string" && /^(data:image\/|https:\/\/)/.test(p.logo) ? p.logo : "");
  function hero() {
    const p = st.info || {}, lg = logoOf(p);
    return `<header class="rv-hero slim"><div class="rv-hero-in">
      <div class="rv-ph${lg ? " logo" : ""}">${lg ? `<img src="${esc(lg)}" alt="${esc(p.name || "")}" referrerpolicy="no-referrer">` : `<span>${esc(initials(p.name))}</span>`}</div>
      <div class="rv-hn"><span class="rv-k">Votre avis</span><h1>${esc(p.name || "Restaurant")}</h1></div>
    </div></header>`;
  }
  const foot = () => `<footer class="rv-foot">${DEMO ? "Démo : rien n'est envoyé · " : ""}Avis recueillis par <a href="https://growthgusto.fr" target="_blank" rel="noopener">Growth Gusto</a></footer>`;
  function paintMsg(title, text, retry) {
    app.innerHTML = `${st.info ? hero() : `<header class="rv-hero slim"></header>`}<section class="rv-card rv-msg"><div class="rv-msg-ic">${svg.alert}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>${retry ? `<button class="rv-btn soft" data-a="retry">Réessayer</button>` : ""}</section>${foot()}`;
  }
  const stars = (n, big) => `<div class="av-stars${big ? " big" : ""}" role="radiogroup" aria-label="Votre note sur 5">${[1, 2, 3, 4, 5].map((i) => `<button class="av-st${i <= n ? " on" : ""}" data-a="rate" data-v="${i}" role="radio" aria-checked="${i === n}" aria-label="${i} sur 5 · ${WORDS[i]}" style="--i:${i}">${svg.star}</button>`).join("")}</div>`;
  function paintRate(focus) {
    st.view = "rate";
    const I = st.info || {}, n = st.n, up = n >= 4, low = n && n <= 3;
    const q = I.first ? `Votre ${I.meal === "repas" ? "repas" : I.meal || "repas"} s'est bien passé, ${esc(I.first)} ?` : `Votre ${I.meal === "repas" ? "repas" : I.meal || "repas"} s'est bien passé ?`;
    const tags = (up ? TAG_UP : TAG_DOWN).map(([id, t]) => `<button class="av-tag${st.tags.has(id) ? " on" : ""}" data-a="tag" data-v="${id}" aria-pressed="${st.tags.has(id)}">${esc(t)}</button>`).join("");
    app.innerHTML = `${hero()}<section class="rv-card av-card">
      <div class="av-q"><h2>${q}</h2><p>Comment nous avez-vous trouvés ?</p></div>
      ${stars(n, true)}
      <div class="av-word${n ? " on" : ""}" aria-live="polite">${esc(WORDS[n])}</div>
      ${n ? `<div class="av-more">
        <div class="av-sh">${up ? "Qu'avez-vous aimé ?" : "Qu'est-ce qui n'a pas été ?"}<em>facultatif</em></div>
        <div class="av-tags">${tags}</div>
        <label class="rv-f av-f"><span class="av-lab">${up ? "Un mot sur votre repas" : "Dites-nous tout, on vous lit"}</span>
          <textarea id="avText" rows="${up ? 3 : 4}" maxlength="1500" placeholder="${up ? "Ce que vous avez préféré, un plat, un sourire…" : "Ce qui s'est passé, pour qu'on fasse mieux"}">${esc(st.text)}</textarea></label>
        ${up ? `<button class="av-wand" data-a="wand">${svg.wand}<span>${st.text ? "Une autre phrase" : "Écrire pour moi"}</span></button>` : ""}
        ${low ? `<div class="av-priv">${svg.lock}<span>Votre message va directement au responsable du restaurant. Il n'est pas publié.</span></div>
          <button class="av-check${st.recontact ? " on" : ""}" data-a="recontact" role="checkbox" aria-checked="${st.recontact}"><span class="av-box"></span><span>Je veux bien qu'on me recontacte</span></button>
          ${ANON && st.recontact ? `<div class="av-anon"><label class="rv-f"><input id="avName" maxlength="60" placeholder="Votre prénom" value="${esc(st.name)}" autocomplete="given-name"></label><label class="rv-f"><input id="avContact" maxlength="120" placeholder="Téléphone ou e-mail" value="${esc(st.contact)}" inputmode="email" autocomplete="email"></label></div>` : ""}` : ""}
        <button class="rv-btn big" data-a="send"${st.sending ? " disabled" : ""}>${st.sending ? `<span class="rv-spin"></span>Envoi…` : up ? "Continuer" : "Envoyer au responsable"}</button>
      </div>` : `<p class="av-hint">Un geste suffit. Dix secondes, promis.</p>`}
    </section>${foot()}`;
    const ta = $("#avText"); if (ta) ta.addEventListener("input", () => { st.text = ta.value; const w = $('[data-a="wand"] span'); if (w) w.textContent = st.text ? "Une autre phrase" : "Écrire pour moi"; });
    const nm = $("#avName"); if (nm) nm.addEventListener("input", () => { st.name = nm.value; });
    const ct = $("#avContact"); if (ct) ct.addEventListener("input", () => { st.contact = ct.value; });
    if (focus) { const m = $(".av-more"); if (m) m.classList.add("in"); }
  }
  /* the paste help, shown on the « thanks » card of happy clients */
  function paintThanks() {
    st.view = "thanks";
    const I = st.info || {}, up = st.n >= 4, g = I.google;
    const txt = st.text.trim() || (up ? suggest(st.sugg) : "");
    if (up && !st.text.trim()) st.text = txt;
    const conf = Array.from({ length: 14 }, (_, k) => `<i style="--a:${k * 26}deg;--d:${(k % 5) * 40}ms"></i>`).join("");
    const gBtn = (cls) => g ? `<button class="rv-btn big av-g ${cls || ""}" data-a="google">${svg.star}Publier sur Google</button>` : "";
    app.innerHTML = `${hero()}<section class="rv-card rv-done av-done">
      <div class="av-burst ${up ? "up" : "low"}" aria-hidden="true"><span class="av-bub">${up ? svg.heart : svg.lock}</span>${up ? conf : ""}</div>
      ${up ? `<h2>Merci${I.first ? ` ${esc(I.first)}` : ""} !</h2>
        <p>${g ? "Un dernier geste nous aiderait énormément : partager votre avis sur Google." : "Toute l'équipe a reçu votre message. À très vite !"}</p>
        ${g ? `<div class="av-paste"><div class="av-paste-h"><span>${stars(st.n)}</span><button class="av-copy" data-a="copy">${svg.copy}<span>${st.copied ? "Copié" : "Copier"}</span></button></div>
          <textarea id="avPaste" rows="4" maxlength="1500" aria-label="Votre avis">${esc(txt)}</textarea></div>
          ${gBtn()}
          <ol class="av-how"><li><b>1</b>Votre texte est copié</li><li><b>2</b>Sur Google, touchez ${st.n} étoile${st.n > 1 ? "s" : ""}</li><li><b>3</b>Collez, publiez</li></ol>
          <button class="rv-link" data-a="later">Pas maintenant</button>` : ""}`
      : `<h2>Merci de nous l'avoir dit.</h2>
        <p>Votre message est arrivé directement chez le responsable${st.recontact ? ", qui revient vers vous très vite" : ""}. On en parle avec l'équipe dès le prochain service.</p>
        ${I.phone ? `<a class="rv-btn soft" href="tel:${esc(String(I.phone).replace(/[^\d+]/g, ""))}">${svg.phone}Appeler le restaurant</a>` : ""}
        ${g ? `<div class="av-pub"><span>Vous préférez donner un avis public ? C'est votre droit.</span>${gBtn("soft")}</div>` : ""}`}
      <button class="rv-link av-edit" data-a="edit">${svg.edit}Modifier mon avis</button>
    </section>${foot()}`;
    const ta = $("#avPaste"); if (ta) ta.addEventListener("input", () => { st.text = ta.value; st.copied = false; const c = $('[data-a="copy"] span'); if (c) c.textContent = "Copier"; });
  }
  function paintLater() {
    app.innerHTML = `${hero()}<section class="rv-card rv-msg av-later"><div class="av-bub sm">${svg.heart}</div><h2>À très bientôt !</h2><p>Votre avis est bien arrivé chez l'équipe. Merci d'avoir pris ce temps.</p>
      ${st.info && st.info.google ? `<button class="rv-btn soft" data-a="google">${svg.star}Finalement, publier sur Google</button>` : ""}</section>${foot()}`;
  }

  /* ───────── actions ───────── */
  async function copy(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
    try { const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0;top:0"; document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length); const ok = document.execCommand("copy"); t.remove(); return ok; } catch (e) { return false; }
  }
  const ACT = {
    retry: () => load(),
    rate: (el) => {
      const n = +el.dataset.v, was = st.n; if (!(n >= 1 && n <= 5)) return;
      if ((was >= 4) !== (n >= 4)) st.tags.clear();
      st.n = n; pop(440 + n * 90, 0.1, 0.05); vib(n === 5 ? [10, 30, 10] : 10);
      const ta = $("#avText"); if (ta) st.text = ta.value;
      paintRate(!was);
      const s = $(".av-stars.big"); if (s) { s.classList.add("pick"); s.dataset.n = n; }
      if (!was) setTimeout(() => { const m = $(".av-more"); if (m) m.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 120);
    },
    tag: (el) => { const id = el.dataset.v; st.tags.has(id) ? st.tags.delete(id) : st.tags.add(id); el.classList.toggle("on", st.tags.has(id)); el.setAttribute("aria-pressed", st.tags.has(id)); pop(st.tags.has(id) ? 760 : 520, 0.07, 0.035); vib(6); },
    wand: () => { st.sugg = st.text ? st.sugg + 1 : st.sugg; st.text = suggest(st.sugg); const ta = $("#avText"); if (ta) { ta.value = st.text; ta.classList.remove("flash"); void ta.offsetWidth; ta.classList.add("flash"); } const w = $('[data-a="wand"] span'); if (w) w.textContent = "Une autre phrase"; pop(880, 0.12, 0.04); vib(8); },
    recontact: () => { const ta = $("#avText"); if (ta) st.text = ta.value; st.recontact = !st.recontact; pop(620, 0.07, 0.035); paintRate(true); },
    send: async () => {
      if (st.sending || !st.n) return; const ta = $("#avText"); if (ta) st.text = ta.value;
      const c = st.contact.trim(), extra = ANON && st.n <= 3 && st.recontact ? { name: st.name.trim(), ...(/@/.test(c) ? { email: c } : c ? { phone: c } : {}) } : {};
      st.sending = true; paintRate(true);
      try {
        const r = await api("send", { rating: st.n, tags: [...st.tags], text: st.text.trim(), recontact: st.n <= 3 && st.recontact, ...extra });
        if (r.google != null) st.info.google = r.google; st.fid = r.fid || "";
        st.sending = false; chime(); vib([12, 50, 20]); paintThanks(); window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) { console.warn(e); st.sending = false; paintRate(true); toast(errText(e)); }
    },
    copy: async () => { const ta = $("#avPaste"); const t = (ta ? ta.value : st.text).trim(); if (!t) return; st.copied = await copy(t); const c = $('[data-a="copy"] span'); if (c) c.textContent = st.copied ? "Copié" : "Copier"; pop(820, 0.08, 0.04); vib(8); if (st.copied) toast("Texte copié. Il ne reste qu'à le coller sur Google."); },
    google: () => {
      const g = st.info && st.info.google; if (!g) return;
      const ta = $("#avPaste"); const t = (ta ? ta.value : st.text).trim();
      if (t) copy(t); /* in the tap itself: browsers only allow the clipboard there */
      if (DEMO) { chime(); toast("Démo : Google s'ouvrirait ici, votre texte déjà copié."); return; }
      try { window.open(g, "_blank", "noopener"); } catch (e) { location.href = g; }
      api("google", st.fid && /^a_/.test(st.fid) ? { fid: st.fid } : {}).catch(() => {});
      setTimeout(() => toast(t ? "Collez votre texte sur Google : il est copié." : "Merci !"), 400);
    },
    later: () => { pop(520, 0.08, 0.03); paintLater(); },
    edit: () => { pop(600, 0.07, 0.03); paintRate(true); },
  };
  document.addEventListener("click", (e) => { const el = e.target.closest("[data-a]"); if (!el || el.disabled) return; const f = ACT[el.dataset.a]; if (f) { e.preventDefault(); f(el, e); } });

  async function load() {
    if (!RID) return paintMsg("Lien incomplet", "Ce lien d'avis n'est pas complet. Demandez-le au restaurant.");
    try { st.info = await api("get"); } catch (e) { console.warn(e); return paintMsg("Lien introuvable", errText(e), !/plus|valide/.test(errText(e))); }
    document.title = `Votre avis · ${st.info.name || "Restaurant"}`;
    const d = st.info.done; if (d && !st.n) { st.n = +d.rating || 0; st.text = d.text || ""; (d.tags || []).forEach((t) => st.tags.add(t)); }
    if (d && !N0) return paintThanks();
    paintRate(!!st.n);
  }
  load();
})();
