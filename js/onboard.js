/* Growth Gusto — onboarding (area prefix « ob »): six short screens that build the restaurant properly, after an account is created
   (js/auth.js hands off with OB.handoff), on the first run of the local mode (VIEWS.onboarding delegates here), and later from Réglages
   (« Compléter la fiche du restaurant »). One screen per step, springy transitions, a live « fiche » of the restaurant on the right (desktop).
   Modes: "create" (no restaurant yet: everything is written when the person leaves step 5) · "complete" (the restaurant exists: each step
   writes on « Continuer »). Data: resto doc { name, site, logo, type, address, phone, covers, printer }, fridges { name, type, min, max },
   members { name, role, color, photo }. Hooks: OB.handoff(rid) (auth), OB.open(from) (Réglages), ACT.obCreate() (legacy test entry). */
"use strict";

const OB_STEPS = [
  { k: "resto", t: "Le restaurant", opt: false },
  { k: "vous", t: "Vous", opt: false },
  { k: "frigos", t: "Les frigos", opt: true },
  { k: "equipe", t: "L'équipe", opt: true },
  { k: "imprimante", t: "L'imprimante", opt: true },
  { k: "pret", t: "C'est prêt", opt: false },
];
const OB_TYPES = [["bistrot", "Bistrot"], ["brasserie", "Brasserie"], ["gastro", "Gastronomique"], ["bar", "Bar à vin"], ["pizzeria", "Pizzeria"], ["traiteur", "Traiteur"], ["boulangerie", "Boulangerie"], ["autre", "Autre"]];
const OB_PRESETS = [["Chambre froide 1", "cfp"], ["Chambre froide 2", "cfp"], ["Frigo de service 1", "service"], ["Frigo de service 2", "service"], ["Frigo du bar", "frigo"], ["Frigo pâtisserie", "frigo"], ["Saladette", "saladette"], ["Congélateur", "congel"], ["Cave à boissons", "cave"], ["Vitrine", "vitrine"]];
const OB_DEFAULT_FRS = ["Chambre froide 1", "Frigo de service 1", "Frigo de service 2", "Congélateur"];
const OB_PRINTER = "Brother QL-810Wc";
const obSv = (d, w = 20, sw = 2) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const OB_SVG = {
  back: obSv('<path d="M19 12H5M11 6l-6 6 6 6"/>', 20, 2.2),
  arrow: obSv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  ok: `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: obSv('<path d="M12 5v14M5 12h14"/>', 18, 2.2),
  x: obSv('<path d="M6 6l12 12M18 6 6 18"/>', 14, 2.2),
  globe: obSv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>'),
  pin: obSv('<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>'),
  phone: obSv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  seats: obSv('<path d="M4 11h16v3H4zM6 14v6M18 14v6M7 11V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5"/>'),
  camera: obSv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>'),
  image: obSv('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-4.5-4.5L8 20"/>'),
  snow: obSv('<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>'),
  users: obSv('<circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.4 3.4 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6"/>'),
  printer: obSv('<path d="M7 9V4h10v5M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1.5"/>'),
  copy: obSv('<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>', 18),
  share: obSv('<path d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', 18),
  store: obSv('<path d="m3 8 2-4h14l2 4M3 8h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 12v8h14v-8M10 20v-5h4v5"/>'),
  wifi: obSv('<path d="M12 19h.01M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0"/>', 16),
  seal: `<svg class="onb-sealsvg" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><circle class="disc" cx="36" cy="36" r="30"/><circle class="ring" cx="36" cy="36" r="34" fill="none" stroke-width="3"/><path d="M24 37l8 8 16-17" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
Object.assign(IC, { obCard: ["r:3,5,18,14,2.5", "M3 10h18", "M7 15h4"] });

const obReduce = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const obDesk = () => window.matchMedia("(min-width:960px)").matches;
const obDomain = (v) => { v = String(v || "").trim().toLowerCase(); if (!v) return ""; v = v.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].split("@").pop(); return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : ""; };
const obSS = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} } };
const obDeg = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
const obFrType = (k) => { if (typeof ccObType === "function") return ccObType(k); const F = { frigo: [0, 4], cfp: [0, 4], service: [0, 4], congel: [-40, -15], saladette: [0, 4], cave: [2, 8], vitrine: [0, 4] }[k] || [0, 4]; return { k, min: F[0], max: F[1] }; };
const obGuessType = (name) => { const n = String(name || "").toLowerCase(); return /cong[eé]l|surg[eé]l|n[eé]gativ/.test(n) ? "congel" : /chambre froide/.test(n) ? "cfp" : /service|plan de travail|sous[- ]plan|comptoir|passe\b/.test(n) ? "service" : /saladette/.test(n) ? "saladette" : /cave|vin|boisson/.test(n) ? "cave" : /vitrine/.test(n) ? "vitrine" : "frigo"; };

const OB = {
  st: null,
  /* ───────────── entry points ───────────── */
  /* js/auth.js, right after the restaurant doc and the gérant membership are written: the app opens on this flow */
  handoff(rid, C, name) {
    obSS.set("gg-ob", rid);
    if (typeof AUTH !== "undefined" && AUTH.celebrate) AUTH.celebrate(`Bienvenue${name ? ", " + firstName(name) : ""} !`, `${(C && C.name) || "Votre restaurant"} · on finit d'installer la cuisine`, rid);
    else if (typeof AUTH !== "undefined") AUTH.enter(rid);
  },
  /* Réglages → « Compléter la fiche du restaurant » */
  open(from) { this.start({ mode: "complete", from: from || "reglages" }); SFX.tap(); buzz(5); go("onboard"); },
  start(opts = {}) {
    const r = S.resto || {}, meDoc = S.members.find((m) => m.id === S.me.id) || {};
    const mode = opts.mode || (S.rid && S.resto ? "complete" : "create");
    const d = { name: r.name || "", site: r.site || "", logo: r.logo || "", type: r.type || "", address: r.address || "", phone: r.phone || "", covers: r.covers || "", me: S.me.name || "", photo: meDoc.photo || "", frs: [], custom: [], team: [], inv: null, printer: r.printer || "", skipped: {}, done: {} };
    if (mode === "create") d.frs = OB_DEFAULT_FRS.slice();
    this.st = { mode, step: 0, dir: 1, from: opts.from || "", busy: false, d, nav: null };
  },
  ensure() { if (!this.st || (this.st.mode === "create" && S.resto)) this.start({}); return this.st; },
  presets() { return (typeof OB_FRIDGES !== "undefined" ? OB_FRIDGES : OB_PRESETS).map(([n, k]) => { const t = obFrType(k); return { name: n, type: t.k, min: t.min, max: t.max }; }); },
  types() { return typeof AU_TYPES !== "undefined" ? AU_TYPES : OB_TYPES; },
  typeLabel(k) { const t = this.types().find((x) => x[0] === k); return t ? t[1] : ""; },
  existing() { return this.st.mode === "complete" ? S.fridges : []; },
  /* the fridges this flow will create: chosen presets not yet in the restaurant, plus the custom ones */
  newFridges() { const ex = this.existing().map((f) => (f.name || "").toLowerCase()); const d = this.st.d; return [...this.presets().filter((p) => d.frs.includes(p.name)), ...d.custom].filter((f) => !ex.includes(f.name.toLowerCase())); },
  local() { return DB.mode === "local"; },
  cloud() { return DB.mode === "db" && !!DB.uid && typeof AUTH !== "undefined" && !!AUTH.fs; },
  cur() { return OB_STEPS[this.st.step]; },

  /* ───────────── markup ───────────── */
  shell() {
    const st = this.ensure(); const s = this.cur();
    return `<div class="onb" data-step="${s.k}" data-mode="${st.mode}">
      <header class="onb-top">${this.topHTML()}</header>
      <div class="onb-body">
        <div class="onb-form" id="obForm"><div class="onb-pane" id="obPane">${this.paneHTML()}</div><div class="onb-cta" id="obCta">${this.ctaHTML()}</div></div>
        <aside class="onb-stage" aria-hidden="true"><div class="onb-wall"><span class="onb-dfr cf"><b>3,2°</b></span><span class="onb-dfr"><b>2,8°</b></span><span class="onb-dfr"><b>3,1°</b></span><span class="onb-dfr cg"><b>−19°</b></span></div>${this.ficheHTML()}<div class="onb-stage-cap">Fiche du restaurant, mise à jour en direct</div></aside>
      </div>
    </div>`;
  },
  topHTML() {
    const st = this.st, n = st.step, s = this.cur();
    const canBack = n > 0 && s.k !== "pret";
    const left = canBack ? `<button class="onb-back" data-act="obPrev" aria-label="Retour">${OB_SVG.back}</button>` : st.from === "reglages" && n === 0 ? `<button class="onb-back" data-act="obClose" aria-label="Fermer">${OB_SVG.x}</button>` : `<span class="onb-back onb-brand">${typeof appIcon === "function" ? appIcon(30) : ""}</span>`;
    const prog = `<div class="onb-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${OB_STEPS.length}" aria-valuenow="${n + 1}" aria-label="Étape ${n + 1} sur ${OB_STEPS.length}">${OB_STEPS.map((x, i) => `<i class="${i < n ? "on" : i === n ? "on cur" : ""}"></i>`).join("")}</div><span class="onb-count">${n + 1}/${OB_STEPS.length}</span>`;
    const right = s.opt ? `<button class="onb-skip" data-act="obSkip">Passer</button>` : `<span class="onb-skip ph" aria-hidden="true"></span>`;
    return `${left}${prog}${right}`;
  },
  ctaHTML() {
    const s = this.cur(), st = this.st;
    const tx = s.k === "pret" ? "Ouvrir ma cuisine" : s.k === "imprimante" && st.mode === "create" ? "Créer mon restaurant" : "Continuer";
    return `<button class="onb-go${st.busy ? " onb-busy" : ""}" data-act="${s.k === "pret" ? "obFinish" : "obNext"}" id="obGo"><span class="onb-bl">${tx}${OB_SVG.arrow}</span><span class="onb-dots" aria-hidden="true"><i></i><i></i><i></i></span></button>`;
  },
  head(eyebrow, t, sub, i = 0) { return `<p class="onb-eyebrow st" style="--i:${i}"><span class="onb-dot"></span>${eyebrow}</p><h2 class="onb-h2 st" style="--i:${i + 1}">${t}</h2>${sub ? `<p class="onb-sub st" style="--i:${i + 2}">${sub}</p>` : ""}`; },
  field(id, label, value, attrs = "", i = 3, hint = "") { return `<label class="onb-f st" style="--i:${i}"><span class="onb-lbl">${label}</span><div class="onb-in"><input class="onb-input" id="${id}" value="${esc(value)}" ${attrs}><i class="onb-ok" aria-hidden="true">${OB_SVG.ok}</i></div>${hint ? `<em class="onb-hint">${hint}</em>` : ""}</label>`; },
  paneHTML() {
    const st = this.st, d = st.d, s = this.cur(), phone = !obDesk();
    if (s.k === "resto") {
      const dom = obDomain(d.site);
      return `${this.head("Étape 1 · Le restaurant", d.name ? "Complétons la fiche." : "Créons votre restaurant.", "Seul le nom est obligatoire. Le reste se complète quand vous voulez.")}
        ${this.field("obName", "Nom du restaurant", d.name, 'autocomplete="organization" maxlength="80" placeholder="Chemin des Sarments" enterkeyhint="next"', 3)}
        ${this.field("obSite", "Site web <em>facultatif</em>", d.site, 'type="url" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="chemindessarments.fr" enterkeyhint="next"', 4, "On récupère votre logo automatiquement.")}
        <div class="onb-logo st" style="--i:5" id="obLogo" data-src="${esc(d.logo ? (d.logo.startsWith("data:") ? "img" : "web") : "")}">
          <span class="onb-logo-box" id="obLogoBox">${this.logoHTML()}</span>
          <div class="onb-logo-tx"><b id="obLogoT">${d.logo ? "Logo trouvé" : dom ? "Recherche du logo…" : "Votre logo"}</b><span id="obLogoS">${d.logo ? "Vous pouvez en importer un autre." : dom ? esc(dom) : "Depuis votre site, ou une image de votre téléphone."}</span></div>
          <button type="button" class="onb-chip onb-logo-btn" data-act="obLogoPick">${OB_SVG.image}<span>${d.logo && d.logo.startsWith("data:") ? "Changer" : "Importer"}</span></button>
        </div>
        <div class="onb-f st" style="--i:6"><span class="onb-lbl" id="obTypeL">Type de cuisine <em>facultatif</em></span><div class="onb-chips" role="radiogroup" aria-labelledby="obTypeL">${this.types().map(([k, t]) => `<button type="button" class="onb-chip${d.type === k ? " on" : ""}" role="radio" aria-checked="${d.type === k}" data-act="obType" data-v="${k}">${t}</button>`).join("")}</div></div>
        ${this.field("obAddr", "Adresse <em>facultatif</em>", d.address, 'autocomplete="street-address" maxlength="140" placeholder="12 rue des Sarments, Bordeaux" enterkeyhint="next"', 7)}
        <div class="onb-row2 st" style="--i:8">
          ${this.field("obPhone", "Téléphone <em>facultatif</em>", d.phone, 'type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="05 56 00 00 00" enterkeyhint="next"', 0)}
          ${this.field("obCovers", "Couverts / jour <em>facultatif</em>", d.covers, 'inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="42" enterkeyhint="done"', 0)}
        </div>
        ${phone ? `<div class="onb-prevwrap st" style="--i:9">${this.ficheHTML(true)}</div>` : ""}`;
    }
    if (s.k === "vous") {
      const me = firstName(d.me);
      return `${this.head("Étape 2 · Vous", me ? `Enchanté, ${esc(me)}.` : "Qui tient la cuisine ?", "Votre prénom signe chaque relevé et chaque action au registre. Vous êtes le gérant.")}
        <div class="onb-you st" style="--i:3">
          <button type="button" class="onb-ava" data-act="obPhotoPick" aria-label="Ajouter une photo" id="obAva">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : `<span class="onb-ava-ini" id="obAvaIni">${esc(initials(d.me || "?"))}</span>`}<span class="onb-ava-cam">${OB_SVG.camera}</span></button>
          <div class="onb-you-tx"><b>${d.photo ? "Photo ajoutée" : "Une photo ?"}</b><span>${d.photo ? "Touchez pour la changer." : "Facultatif. Elle apparaît sur vos relevés."}</span></div>
        </div>
        ${this.field("obMe", "Votre prénom", d.me, 'autocomplete="given-name" maxlength="40" placeholder="Marceau" enterkeyhint="next"', 4)}
        <div class="onb-role st" style="--i:5"><span class="onb-role-ic">${OB_SVG.store}</span><div><b>Gérant</b><span>Tout voir, tout régler, inviter l'équipe.</span></div><i class="onb-ok on" aria-hidden="true">${OB_SVG.ok}</i></div>`;
    }
    if (s.k === "frigos") {
      const ex = this.existing(), exNames = ex.map((f) => (f.name || "").toLowerCase());
      const tiles = this.presets().map((p) => { const had = exNames.includes(p.name.toLowerCase()); const on = had || d.frs.includes(p.name); return `<button type="button" class="onb-fr${on ? " on" : ""}${had ? " had" : ""}" data-act="obFr" data-v="${esc(p.name)}" aria-pressed="${on}" ${had ? 'disabled title="Déjà dans votre cuisine"' : ""}><i class="onb-frk">${OB_SVG.ok}</i><span class="onb-fr-tx"><b>${esc(p.name)}</b><em>${had ? "déjà créé" : `${obDeg(p.min)} à ${obDeg(p.max)} °C`}</em></span></button>`; }).join("");
      const extra = ex.filter((f) => !this.presets().some((p) => p.name.toLowerCase() === (f.name || "").toLowerCase()));
      return `${this.head("Étape 3 · Les frigos", "Quels frigos relever chaque jour ?", "Touchez pour choisir. Les seuils sont réglés pour vous, modifiables ensuite.")}
        <div class="onb-frs st" style="--i:3">${tiles}${[...extra.map((f) => ({ name: f.name, min: f.min, max: f.max, had: true })), ...d.custom].map((f, i) => `<span class="onb-fr on custom${f.had ? " had" : ""}"><i class="onb-frk">${OB_SVG.ok}</i><span class="onb-fr-tx"><b>${esc(f.name)}</b><em>${f.had ? "déjà créé" : `${obDeg(f.min)} à ${obDeg(f.max)} °C`}</em></span>${f.had ? "" : `<button type="button" class="onb-fr-x" data-act="obFrDel" data-v="${i - extra.length}" aria-label="Retirer ${esc(f.name)}">${OB_SVG.x}</button>`}</span>`).join("")}</div>
        <div class="onb-addrow st" style="--i:4"><div class="onb-in"><input class="onb-input" id="obFrIn" placeholder="Un autre : Frigo poisson, Cave à vin…" autocomplete="off" maxlength="40" enterkeyhint="done"></div><button type="button" class="onb-chip onb-addbtn" data-act="obFrAdd">${OB_SVG.plus}<span>Ajouter</span></button></div>
        <p class="onb-fine st" style="--i:5" id="obFrNote">${this.frNote()}</p>`;
    }
    if (s.k === "equipe") {
      const cloud = this.cloud();
      return `${this.head("Étape 4 · L'équipe", "Qui travaille avec vous ?", cloud ? "Partagez le lien : chacun crée son compte et voit la cuisine en direct." : "Ajoutez des profils : chacun signe ses relevés en touchant son prénom.")}
        ${cloud ? `<div class="onb-inv st" style="--i:3" id="obInv">${this.invHTML()}</div>` : ""}
        <div class="onb-team st" style="--i:${cloud ? 4 : 3}"><div class="onb-team-h"><b>${cloud ? "Profils cuisine sans compte" : "Profils cuisine"}</b><span>${cloud ? "Pour les extras et les équipiers sans téléphone." : "Vous pourrez ajouter un code à 4 chiffres ensuite."}</span></div>
          <div class="onb-mates" id="obTeamList">${this.teamHTML()}</div>
          <div class="onb-addrow"><div class="onb-in"><input class="onb-input" id="obTeamIn" placeholder="Son prénom" autocomplete="off" maxlength="40" enterkeyhint="done"></div><button type="button" class="onb-chip onb-addbtn" data-act="obTeamAdd">${OB_SVG.plus}<span>Ajouter</span></button></div></div>`;
    }
    if (s.k === "imprimante") {
      let custom = ""; try { if (typeof lbPrinterStepHTML === "function") custom = lbPrinterStepHTML() || ""; } catch (e) { custom = ""; }
      const on = d.printer === OB_PRINTER;
      return `${this.head("Étape 5 · L'imprimante", "Vos étiquettes DLC, en un geste.", "Les étiquettes sortent de l'imprimante depuis le téléphone. Sans imprimante, elles s'affichent à l'écran.")}
        ${custom ? `<div class="onb-custom st" style="--i:3">${custom}</div>` : `<button type="button" class="onb-pr st${on ? " on" : ""}" style="--i:3" data-act="obPrinter" aria-pressed="${on}">
          <span class="onb-pr-ic">${OB_SVG.printer}</span>
          <span class="onb-pr-tx"><b>${OB_PRINTER}</b><em>${OB_SVG.wifi}Wi-Fi · impression via AirPrint</em><span>Rouleaux 62 mm, sans encre, papier thermique.</span></span>
          <i class="onb-frk">${OB_SVG.ok}</i></button>
        <p class="onb-fine st" style="--i:4">${on ? "Parfait. Vous la connecterez au Wi-Fi du restaurant depuis Réglages → Imprimante." : "Pas celle-là, ou pas encore ? <b>Configurer plus tard</b> dans Réglages → Imprimante : rien ne bloque."}</p>`}`;
    }
    if (s.k === "pret") {
      const me = firstName(d.me || S.me.name);
      const sum = this.summary();
      return `<div class="onb-seal st" style="--i:0">${OB_SVG.seal}</div>
        ${this.head("Étape 6 · C'est prêt", `C'est prêt${me ? ", " + esc(me) : ""}.`, `${esc(d.name || S.resto?.name || "Votre restaurant")} est installé. Voici ce qui est en place.`, 1)}
        <div class="onb-sum st" style="--i:4">${sum.map((r, i) => `<div class="onb-sumr ${r.ok ? "ok" : "later"}"><i>${[OB_SVG.store, OB_SVG.image, OB_SVG.users, OB_SVG.snow, OB_SVG.users, OB_SVG.printer][i] || OB_SVG.ok}</i><b>${r.t}</b><span>${r.s}</span></div>`).join("")}</div>
        ${sum.some((r) => !r.ok) ? `<p class="onb-fine st" style="--i:5">Le reste se complète plus tard dans <b>Réglages → Compléter la fiche du restaurant</b>.</p>` : `<p class="onb-fine st" style="--i:5">Tout se modifie ensuite dans Réglages.</p>`}`;
    }
    return "";
  },
  logoHTML() {
    const d = this.st.d, n = d.name || "";
    if (d.logo) return `<img src="${esc(d.logo)}" alt="" referrerpolicy="no-referrer">`;
    return `<span class="onb-mono">${esc(initials(n || "R"))}</span>`;
  },
  frNote() { const n = this.newFridges().length + this.existing().length; return n ? `${n} équipement${n > 1 ? "s" : ""} à relever · seuils et noms modifiables dans Frigos.` : "Rien de coché : vous ajouterez vos équipements plus tard, dans Frigos."; },
  teamHTML() { const d = this.st.d; return d.team.map((t, i) => `<span class="onb-mate" style="--c:${esc(PALETTE[(i + 1) % PALETTE.length])}"><i>${esc(initials(t.name))}</i>${esc(t.name)}<button type="button" data-act="obTeamDel" data-v="${i}" aria-label="Retirer ${esc(t.name)}">${OB_SVG.x}</button></span>`).join(""); },
  invHTML() {
    const d = this.st.d, inv = d.inv;
    if (d.invErr) return `<div class="onb-inv-in"><div class="onb-inv-tx"><b>Invitation indisponible</b><span>${esc(d.invErr)}</span></div><button type="button" class="onb-chip" data-act="obInvRetry">Réessayer</button></div>`;
    if (!inv) return `<div class="onb-inv-in"><span class="onb-qr onb-qr-wait" aria-hidden="true"></span><div class="onb-inv-tx"><b>Préparation du lien…</b><span>Un code à 8 caractères, valable 7 jours.</span></div></div>`;
    const link = typeof AUTH !== "undefined" && AUTH.invLink ? AUTH.invLink(inv.code) : `${location.origin}${location.pathname}?invite=${inv.code}`;
    const code = typeof auFmtCode === "function" ? auFmtCode(inv.code) : inv.code;
    return `<div class="onb-inv-in"><span class="onb-qr">${typeof AUTH !== "undefined" && AUTH.qr ? AUTH.qr(link) : ""}</span>
        <div class="onb-inv-tx"><span class="onb-lbl">Code d'invitation · rôle Équipe</span><b class="onb-code">${esc(code).split("").map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</b><span>Valable 7 jours · plusieurs personnes peuvent l'utiliser.</span></div></div>
      <div class="onb-inv-acts">${navigator.share ? `<button type="button" class="onb-chip on" data-act="obInvShare">${OB_SVG.share}<span>Partager</span></button>` : ""}<button type="button" class="onb-chip${navigator.share ? "" : " on"}" data-act="obInvCopy" data-v="link">${OB_SVG.copy}<span>Copier le lien</span></button><button type="button" class="onb-chip" data-act="obInvCopy" data-v="code">${OB_SVG.copy}<span>Copier le code</span></button></div>`;
  },
  summary() {
    const st = this.st, d = st.d, nF = this.newFridges().length + this.existing().length;
    const team = d.team.length + (st.mode === "complete" ? S.members.filter((m) => m.id !== S.me.id).length : 0);
    const resto = [d.type ? this.typeLabel(d.type) : "", d.address ? "adresse" : "", d.phone ? "téléphone" : "", d.covers ? `${d.covers} couverts/jour` : ""].filter(Boolean);
    return [
      { t: d.name || "Restaurant", s: resto.length ? resto.join(" · ") : "Nom seulement · fiche à compléter", ok: resto.length > 0 },
      { t: "Logo", s: d.logo ? (d.logo.startsWith("data:") ? "Image importée" : "Récupéré depuis votre site") : "À ajouter plus tard", ok: !!d.logo },
      { t: d.me ? `${firstName(d.me)} · gérant` : "Vous", s: d.photo ? "Prénom et photo" : "Prénom · photo facultative", ok: !!d.me },
      { t: "Frigos", s: nF ? `${nF} équipement${nF > 1 ? "s" : ""} à relever` : "Aucun pour l'instant", ok: nF > 0 },
      { t: "Équipe", s: [team ? `${team} profil${team > 1 ? "s" : ""}` : "", d.inv ? "invitation prête" : ""].filter(Boolean).join(" · ") || "Vous seul pour l'instant", ok: team > 0 || !!d.inv },
      { t: "Imprimante", s: d.printer ? d.printer : "Plus tard · étiquettes à l'écran", ok: !!d.printer },
    ];
  },
  /* the live card of the restaurant (desktop stage; compact on the phone's first and last steps) */
  ficheHTML(compact) {
    const st = this.ensure(), d = st.d, s = this.cur();
    const nF = this.newFridges().length + this.existing().length;
    const frs = [...this.existing().map((f) => f.name), ...this.newFridges().map((f) => f.name)];
    const team = [d.me || S.me.name || "Vous", ...(st.mode === "complete" ? S.members.filter((m) => m.id !== S.me.id).map((m) => m.name || "?") : []), ...d.team.map((t) => t.name)];
    const row = (k, ic, t, v, ph) => `<div class="onb-frow${s.k === k ? " cur" : ""}${v ? " set" : ""}" data-k="${k}"><span class="onb-fi">${ic}</span><span class="onb-ft">${t}</span><span class="onb-fv">${v ? esc(v) : `<i>${ph}</i>`}</span></div>`;
    return `<div class="onb-fiche${compact ? " compact" : ""}" data-cur="${s.k}">
      <div class="onb-fh"><span class="onb-flogo">${this.logoHTML()}</span><div class="onb-fn"><b class="${d.name ? "" : "empty"}">${esc(d.name || "Votre restaurant")}</b><em>${esc([this.typeLabel(d.type), d.covers ? `${d.covers} couverts/jour` : ""].filter(Boolean).join(" · ") || "Registre HACCP · relevés · étiquettes")}</em></div><span class="onb-ftag">Fiche</span></div>
      <div class="onb-frows">
        ${row("resto", OB_SVG.pin, "Adresse", d.address, "À compléter")}
        ${row("resto", OB_SVG.phone, "Téléphone", d.phone, "À compléter")}
        ${row("vous", OB_SVG.store, "Gérant", d.me ? firstName(d.me) : "", "Votre prénom")}
        ${row("frigos", OB_SVG.snow, "Frigos", nF ? `${nF} · ${frs.slice(0, 3).join(", ")}${nF > 3 ? "…" : ""}` : "", "Aucun pour l'instant")}
        <div class="onb-frow${s.k === "equipe" ? " cur" : ""} set" data-k="equipe"><span class="onb-fi">${OB_SVG.users}</span><span class="onb-ft">Équipe</span><span class="onb-fv onb-fteam">${team.slice(0, 5).map((n, i) => `<b style="--c:${esc(PALETTE[i % PALETTE.length])}" title="${esc(n)}">${esc(initials(n))}</b>`).join("")}${team.length > 5 ? `<span>+${team.length - 5}</span>` : ""}${d.inv ? `<span class="onb-fpill">invitation</span>` : ""}</span></div>
        ${row("imprimante", OB_SVG.printer, "Imprimante", d.printer, "Plus tard")}
      </div>
    </div>`;
  },

  /* ───────────── painting ───────────── */
  root() { return $("#viewport .view:not(.leave) .onb"); },
  /* step swap: the old pane lifts away while the new one rises in, line by line */
  paint(first) {
    const root = this.root(); if (!root) return;
    const pane = $("#obPane", root), form = $("#obForm", root), reduce = obReduce();
    if (!first && !reduce && pane.childElementCount) {
      const old = pane.cloneNode(true); old.removeAttribute("id"); old.className = "onb-pane onb-leave" + (this.st.dir < 0 ? " back" : ""); old.inert = true;
      $$("[id],[for]", old).forEach((n) => { n.removeAttribute("id"); n.removeAttribute("for"); });
      old.style.top = pane.offsetTop + "px"; form.appendChild(old); setTimeout(() => old.remove(), 260);
    }
    root.dataset.step = this.cur().k; pane.classList.toggle("onb-later", !first); pane.classList.toggle("onb-back", this.st.dir < 0);
    pane.innerHTML = this.paneHTML(); $(".onb-top", root).innerHTML = this.topHTML(); $("#obCta", root).innerHTML = this.ctaHTML();
    if (!first) { const v = root.closest(".view"); [v, form].forEach((x) => { if (x && x.scrollTop > 0) x.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }); }
    this.fiche(); this.after(first);
  },
  after(first) {
    const s = this.cur(), root = this.root(); if (!root) return;
    if (s.k === "resto") { this.validate(); if (!this.st.d.logo && obDomain(this.st.d.site)) this.logoFetch(obDomain(this.st.d.site)); }
    if (s.k === "vous") this.validate();
    if (s.k === "equipe" && this.cloud() && !this.st.d.inv && !this.st.d.invErr) this.invite();
    if (s.k === "pret") { if (!first || this.st.from !== "boot") { SFX.done(); buzz([12, 40, 12, 40, 30]); } setTimeout(() => { const r = $(".onb-seal", root); if (r) { const b = r.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2); } }, obReduce() ? 0 : 420); }
    /* autofocus on desktop only: a phone keyboard must not jump up on its own */
    const f = { resto: "#obName", vous: "#obMe", frigos: "", equipe: "", imprimante: "", pret: "" }[s.k];
    if (f && obDesk()) setTimeout(() => { const i = $(f, root); if (i && !i.value) i.focus({ preventScroll: true }); }, first ? 500 : 380);
  },
  /* the fiche updates in place, row by row, so a keystroke never replays the card's animations */
  fiche() {
    const root = this.root(); if (!root) return;
    $$(".onb-stage .onb-fiche, .onb-prevwrap .onb-fiche", root).forEach((el) => {
      const compact = el.classList.contains("compact"); const t = document.createElement("div"); t.innerHTML = this.ficheHTML(compact); const nu = t.firstElementChild;
      if (el.dataset.cur !== nu.dataset.cur) el.dataset.cur = nu.dataset.cur;
      const a = [$(".onb-fh", el), ...$$(".onb-frow", el)], b = [$(".onb-fh", nu), ...$$(".onb-frow", nu)];
      if (a.length !== b.length) { el.outerHTML = nu.outerHTML; return; }
      a.forEach((x, i) => { if (x.outerHTML !== b[i].outerHTML) x.replaceWith(b[i]); });
    });
  },
  validate() {
    const root = this.root(); if (!root) return;
    const mark = (sel, ok) => { const i = $(sel, root); if (!i) return; const w = i.closest(".onb-in"); w && w.classList.toggle("ok", !!ok); };
    mark("#obName", this.st.d.name.trim().length >= 2); mark("#obMe", this.st.d.me.trim().length >= 2);
    mark("#obSite", !!obDomain(this.st.d.site)); mark("#obAddr", this.st.d.address.trim().length >= 4); mark("#obPhone", this.st.d.phone.replace(/\D/g, "").length >= 8); mark("#obCovers", +this.st.d.covers > 0);
  },
  shake(el) { if (!el) return; const t = el.closest(".onb-f") || el; t.classList.remove("onb-shake"); void t.offsetWidth; t.classList.add("onb-shake"); SFX.err(); buzz([20, 40, 20]); setTimeout(() => t.classList.remove("onb-shake"), 460); },
  setBusy(on) { this.st.busy = on; const b = $("#obGo"); if (b) { b.classList.toggle("onb-busy", on); b.toggleAttribute("disabled", on); } },

  /* ───────────── logo: favicon of the site, then DuckDuckGo, then a monogram ───────────── */
  logoFetch(dom) {
    const d = this.st.d; if (!dom || d.logo && d.logo.startsWith("data:")) return;
    const seq = this._logoSeq = (this._logoSeq || 0) + 1;
    const T = $("#obLogoT"), Sx = $("#obLogoS"); if (T) { T.textContent = "Recherche du logo…"; Sx.textContent = dom; }
    const urls = [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=256`, `https://icons.duckduckgo.com/ip3/${encodeURIComponent(dom)}.ico`];
    const tryAt = (i) => {
      if (seq !== this._logoSeq) return;
      if (i >= urls.length) { d.logo = ""; d.logoDom = dom; this.logoPaint(); if (T) { T.textContent = "Pas de logo trouvé"; Sx.textContent = "Importez une image, ou gardez le monogramme."; } return; }
      const img = new Image(); img.referrerPolicy = "no-referrer";
      img.onload = () => { if (seq !== this._logoSeq) return; if (img.naturalWidth < 24) return tryAt(i + 1); d.logo = urls[i]; d.logoDom = dom; this.logoPaint(true); if (T) { T.textContent = "Logo trouvé"; Sx.textContent = `Depuis ${dom} · vous pouvez en importer un autre.`; } SFX.tick(); buzz(4); };
      img.onerror = () => tryAt(i + 1);
      img.src = urls[i];
    };
    tryAt(0);
  },
  logoPaint(pop) {
    const box = $("#obLogoBox"); if (box) { box.innerHTML = this.logoHTML(); if (pop) { box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop"); } }
    const lg = $("#obLogo"); if (lg) { lg.dataset.src = this.st.d.logo ? (this.st.d.logo.startsWith("data:") ? "img" : "web") : ""; const b = $(".onb-logo-btn span", lg); if (b) b.textContent = this.st.d.logo && this.st.d.logo.startsWith("data:") ? "Changer" : "Importer"; }
    this.fiche();
  },
  /* a small JPEG/PNG data URL (≤ 40 KB) from a picked image */
  async smallImage(file, px) {
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
    const c = document.createElement("canvas"); c.width = c.height = px; const x = c.getContext("2d");
    const k = Math.max(px / img.width, px / img.height), w = img.width * k, h = img.height * k; x.fillStyle = "#fff"; x.fillRect(0, 0, px, px); x.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
    try { URL.revokeObjectURL(img.src); } catch (e) {}
    for (const q of [0.86, 0.72, 0.58, 0.45]) { const u = c.toDataURL("image/jpeg", q); if (u.length <= 40 * 1024) return u; }
    return c.toDataURL("image/jpeg", 0.35);
  },
  async pickInto(key, px) {
    SFX.tap(); const [f] = await pickImage(true); if (!f) return null;
    try { const u = await this.smallImage(f, px); this.st.d[key] = u; SFX.ok(); buzz(8); return u; } catch (e) { console.warn("image", e); SFX.err(); toast("Image illisible. Essayez une autre photo.", "err"); return null; }
  },

  /* ───────────── invites (accounts) ───────────── */
  async invite() {
    const d = this.st.d; if (d.invBusy || !this.cloud()) return; d.invBusy = true; d.invErr = "";
    const code = auCode(8), now = Date.now();
    const doc = { rid: S.rid, restoName: d.name || S.resto?.name || "", role: "equipe", createdBy: S.me.id, createdByName: d.me || S.me.name || "", createdAt: now, expiresAt: now + 7 * 864e5, uses: 0 };
    try { await AUTH.timeout(AUTH.fs.collection("invites").doc(code).set(doc), 12000); d.inv = { code, ...doc }; logEvent("team", "a créé une invitation (Équipe)"); SFX.ok(); }
    catch (e) { console.warn("invite", e); d.invErr = e && e.code === "permission-denied" ? "Seul un gérant peut inviter." : "Vérifiez le réseau, puis réessayez."; }
    d.invBusy = false; const box = $("#obInv"); if (box) box.innerHTML = this.invHTML(); this.fiche();
  },
  invText(what) { const c = this.st.d.inv; if (!c) return ""; return what === "code" ? (typeof auFmtCode === "function" ? auFmtCode(c.code) : c.code) : (AUTH.invLink ? AUTH.invLink(c.code) : `${location.origin}${location.pathname}?invite=${c.code}`); },
  async copy(what) {
    const t = this.invText(what); if (!t) return; let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (x) {} }
    if (ok) { SFX.ok(); buzz(6); toast(what === "code" ? "Code copié" : "Lien copié"); } else toast(t, "info");
  },

  /* ───────────── reading the screen into the state ───────────── */
  collect() {
    const d = this.st.d, root = this.root(); if (!root) return;
    const g = (id) => { const e = $(id, root); return e ? e.value : null; };
    const n = g("#obName"); if (n != null) d.name = n.trim();
    const s = g("#obSite"); if (s != null) d.site = s.trim();
    const a = g("#obAddr"); if (a != null) d.address = a.trim();
    const p = g("#obPhone"); if (p != null) d.phone = p.trim();
    const c = g("#obCovers"); if (c != null) d.covers = c.replace(/\D/g, "").slice(0, 5);
    const m = g("#obMe"); if (m != null) d.me = m.trim();
    const fr = g("#obFrIn"); if (fr && fr.trim()) ACT.obFrAdd();
    const tm = g("#obTeamIn"); if (tm && tm.trim()) ACT.obTeamAdd();
  },
  restoPatch() {
    const d = this.st.d, r = S.resto || {}; const patch = {};
    const put = (k, v) => { if (v !== "" && v != null && v !== (r[k] ?? "")) patch[k] = v; };
    put("name", d.name); put("site", d.site); put("logo", d.logo); put("type", d.type); put("address", d.address); put("phone", d.phone); put("covers", d.covers ? +d.covers : "");
    return patch;
  },

  /* ───────────── writes ───────────── */
  /* "complete" mode: each step writes on « Continuer » */
  async commit(k) {
    const st = this.st, d = st.d; if (st.mode !== "complete" || !S.rid) return;
    if (k === "resto") { const p = this.restoPatch(); if (Object.keys(p).length) { await safe(DB.update("restos", S.rid, p)); if (S.resto) Object.assign(S.resto, p); const r = S.restos.find((x) => x.id === S.rid); if (r) Object.assign(r, p); } }
    if (k === "vous") {
      const patch = { name: d.me, ...(d.photo ? { photo: d.photo } : {}) };
      const mine = S.members.find((m) => m.id === S.me.id);
      await safe(mine ? DB.update("members", S.me.id, patch) : DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now(), ...patch, ...(this.local() ? { color: S.me.color || PALETTE[0] } : {}) }));
      S.me.name = d.me; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), name: d.me, ...(d.photo ? { avatarUrl: d.photo } : {}) };
      if (this.local()) { try { localStorage.setItem("gg-name", d.me); } catch (e) {} if (typeof ccSaveWho === "function") ccSaveWho(); }
      renderChrome();
    }
    if (k === "frigos") { const base = S.fridges.length; for (const [i, f] of this.newFridges().entries()) await safe(DB.add("fridges", { name: f.name, type: f.type, min: f.min, max: f.max, order: base + i, createdAt: Date.now() + i })); }
    if (k === "equipe") { await this.writeTeam(); }
    if (k === "imprimante") { if (d.printer && d.printer !== (S.resto && S.resto.printer)) { await safe(DB.update("restos", S.rid, { printer: d.printer })); if (S.resto) S.resto.printer = d.printer; } }
    d.done[k] = true;
  },
  async writeTeam() {
    const d = this.st.d; if (!d.team.length) return;
    const used = S.members.map((m) => m.color);
    for (const [i, t] of d.team.entries()) { const id = "m" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5); const color = PALETTE.find((c) => !used.includes(c)) || PALETTE[(S.members.length + i + 1) % PALETTE.length]; used.push(color); await safe(DB.set("members", id, { role: "equipe", name: t.name, color, joinedAt: Date.now() + i + 1, by: S.me.id })); S.profiles[id] = { name: t.name, color }; }
    await logEvent("team", `a ajouté ${d.team.map((t) => t.name).join(", ")} à l'équipe`);
    d.team = [];
  },
  /* "create" mode (this device only): the restaurant, the gérant, the fridges and the profiles, in that order */
  async finish() {
    const st = this.st, d = st.d; if (st.mode !== "create" || S.resto) return true;
    const name = d.name.trim(), me = d.me.trim(); if (!name || !me) return false;
    S.me.name = me; S.me.color = S.me.color || PALETTE[0]; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), ...S.me, ...(d.photo ? { avatarUrl: d.photo } : {}) }; try { localStorage.setItem("gg-name", me); } catch (e) {}
    const rid = "r" + Date.now().toString(36), prev = S.rid; S.rid = rid;
    try {
      const doc = { name, createdAt: Date.now(), by: S.me.id }; const p = this.restoPatch(); delete p.name; Object.assign(doc, p); if (d.printer) doc.printer = d.printer;
      await safe(DB.set("restos", rid, doc));
      attachedRid = null; memberChecked = true; if (typeof CC !== "undefined") CC.last = Date.now(); attachResto();
      await DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now(), name: me, color: S.me.color || PALETTE[0], ...(d.photo ? { photo: d.photo } : {}) });
      for (const [i, f] of this.newFridges().entries()) await DB.add("fridges", { name: f.name, type: f.type, min: f.min, max: f.max, order: i, createdAt: Date.now() + i });
      await logEvent("team", `a créé ${name}`);
      await this.writeTeam();
      S.resto = { id: rid, ...doc }; if (!S.restos.find((r) => r.id === rid)) S.restos.push(S.resto);
      if (typeof ccSaveWho === "function") ccSaveWho();
      st.mode = "complete"; Object.keys(d.done).length || OB_STEPS.forEach((x) => { d.done[x.k] = true; });
      renderChrome(); return true;
    } catch (e) { S.rid = prev; return false; }
  },

  /* ───────────── navigation ───────────── */
  async next(skip) {
    const st = this.st, s = this.cur(), root = this.root(); if (!root || st.busy) return;
    this.collect(); const d = st.d;
    if (!skip) {
      if (s.k === "resto" && d.name.length < 2) { const el = $("#obName", root); this.shake(el); el && el.focus(); return; }
      if (s.k === "vous" && d.me.length < 2) { const el = $("#obMe", root); this.shake(el); el && el.focus(); return; }
    } else d.skipped[s.k] = true;
    if (s.k === "pret") return this.leave();
    this.setBusy(true);
    try {
      if (!skip || s.k === "frigos" || s.k === "equipe") await this.commit(s.k); /* skipping still keeps what was already chosen */
      if (st.step === OB_STEPS.length - 2 && st.mode === "create") { const ok = await this.finish(); if (!ok) { this.setBusy(false); if (!d.name) this.goTo(0); else if (!d.me) this.goTo(1); return; } }
    } catch (e) { this.setBusy(false); return; }
    this.setBusy(false); SFX.ok(); buzz(6);
    this.goTo(st.step + 1);
  },
  goTo(n) { const st = this.st; n = Math.max(0, Math.min(OB_STEPS.length - 1, n)); if (n === st.step && this.root() && $("#obPane", this.root()).childElementCount) return; st.dir = n >= st.step ? 1 : -1; st.step = n; this.paint(false); },
  prev() { if (this.st.step === 0) return; this.collect(); SFX.tap(); buzz(4); this.goTo(this.st.step - 1); },
  leave() {
    const st = this.st; SFX.tap(); buzz([8, 30, 8]);
    const back = st.from === "reglages" ? "reglages" : "home";
    st.from = ""; this.st = null; S.history = []; go(back, {}, { replace: true });
    if (back === "home") setTimeout(() => toast(`${S.resto?.name || "Votre restaurant"} est prêt`), 500);
  },
};

/* ───────────── route ───────────── */
VIEWS.onboard = {
  live: false, hideTabs: true,
  render() { if (!OB.st) OB.start({ mode: S.resto ? "complete" : "create", from: "reglages" }); return OB.shell(); },
  after() { OB.after(true); },
};
/* the local-mode first run (core routes to "onboarding" while there is no restaurant): same flow, "create" mode */
(function obLegacy() {
  const V = VIEWS.onboarding; if (!V) return;
  V.render = function () { if (!OB.st || OB.st.mode !== "create") OB.start({ mode: "create", from: "boot" }); return OB.shell(); };
  V.after = function () { OB.after(true); };
})();
/* after an account creates its restaurant (OB.handoff), the app opens on this flow instead of Accueil */
(function obBoot() {
  const f0 = finishBoot;
  finishBoot = function () { const want = obSS.get("gg-ob"); if (want && S.resto && want === S.rid) { obSS.del("gg-ob"); OB.start({ mode: "complete", from: "boot" }); OB._redirect = true; } return f0.apply(this, arguments); };
  const g0 = go;
  go = function (route, params, opts) { if (OB._redirect && route === "home") { OB._redirect = false; route = "onboard"; params = {}; } return g0.call(this, route, params, opts); };
  const c0 = renderChrome;
  renderChrome = function () { c0.apply(this, arguments); if (S.route === "onboard") { const sd = $("#side"); sd && sd.classList.add("off"); } };
})();

/* ───────────── live inputs + keys ───────────── */
const obLogoDeb = debounce(() => { const d = OB.st && OB.st.d; if (!d) return; const dom = obDomain(d.site); if (!dom) { if (d.logo && !d.logo.startsWith("data:")) { d.logo = ""; OB.logoPaint(); } const T = $("#obLogoT"), Sx = $("#obLogoS"); if (T && !d.logo) { T.textContent = "Votre logo"; Sx.textContent = "Depuis votre site, ou une image de votre téléphone."; } return; } if (dom !== d.logoDom || !d.logo) OB.logoFetch(dom); }, 450);
const obFicheDeb = debounce(() => OB.fiche(), 160);
document.addEventListener("input", (e) => {
  const t = e.target; if (!OB.st || !t.closest || !t.closest(".onb")) return; const d = OB.st.d;
  if (t.id === "obName") { d.name = t.value.trim(); if (!d.logo || !d.logo.startsWith("data:")) { const b = $("#obLogoBox .onb-mono"); if (b) b.textContent = initials(d.name || "R"); } obFicheDeb(); }
  else if (t.id === "obSite") { d.site = t.value.trim(); obLogoDeb(); }
  else if (t.id === "obAddr") { d.address = t.value.trim(); obFicheDeb(); }
  else if (t.id === "obPhone") { d.phone = t.value.trim(); obFicheDeb(); }
  else if (t.id === "obCovers") { t.value = t.value.replace(/\D/g, "").slice(0, 5); d.covers = t.value; obFicheDeb(); }
  else if (t.id === "obMe") { d.me = t.value.trim(); const i = $("#obAvaIni"); if (i) i.textContent = initials(d.me || "?"); obFicheDeb(); }
  OB.validate();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !OB.st) return; const t = e.target; if (!t || !t.closest || !t.closest(".onb") || t.tagName !== "INPUT") return;
  if (t.id === "obFrIn") { e.preventDefault(); ACT.obFrAdd(); return; }
  if (["obSite", "obAddr", "obPhone", "obCovers"].includes(t.id)) { e.preventDefault(); ACT.obNext(); }
});

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  obNext: () => OB.next(false),
  obSkip: () => { SFX.tap(); buzz(4); OB.next(true); },
  obPrev: () => OB.prev(),
  obFinish: () => OB.next(false),
  obClose: () => { SFX.close(); OB.st = null; S.history = []; go("reglages", {}, { replace: true }); },
  obComplete: () => { if (myRole() !== "gerant") { SFX.err(); toast("Réservé au gérant", "err"); return; } OB.open("reglages"); },
  obType: (a, id, v) => { const d = OB.st.d; d.type = d.type === v ? "" : v; $$(".onb [data-act=obType]").forEach((b) => { const on = b.dataset.v === d.type; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); SFX.tick(); buzz(4); OB.fiche(); },
  obLogoPick: async () => { const u = await OB.pickInto("logo", 256); if (u) { OB.logoPaint(true); const T = $("#obLogoT"), Sx = $("#obLogoS"); if (T) { T.textContent = "Logo importé"; Sx.textContent = "Il apparaît sur vos étiquettes et documents."; } } },
  obPhotoPick: async () => { const u = await OB.pickInto("photo", 192); if (u) { const a = $("#obAva"); if (a) { a.innerHTML = `<img src="${esc(u)}" alt=""><span class="onb-ava-cam">${OB_SVG.camera}</span>`; a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); } const tx = $(".onb-you-tx"); if (tx) tx.innerHTML = `<b>Photo ajoutée</b><span>Touchez pour la changer.</span>`; } },
  obFr: (a, id, v) => { const d = OB.st.d; const i = d.frs.indexOf(v); i >= 0 ? d.frs.splice(i, 1) : d.frs.push(v); const on = i < 0; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); a.classList.remove("bump"); void a.offsetWidth; a.classList.add("bump"); const nt = $("#obFrNote"); if (nt) nt.textContent = OB.frNote(); SFX.tick(); buzz(5); OB.fiche(); },
  obFrAdd: () => {
    const el = $("#obFrIn"); if (!el) return; const n = el.value.trim(); if (!n) { OB.shake(el); return; } const d = OB.st.d;
    const all = [...OB.presets().map((p) => p.name), ...OB.existing().map((f) => f.name || ""), ...d.custom.map((c) => c.name)].map((x) => x.toLowerCase());
    if (all.includes(n.toLowerCase())) { OB.shake(el); toast("Cet équipement est déjà dans la liste.", "err"); return; }
    if (d.custom.length >= 12) { toast("12 équipements maximum ici : ajoutez les autres dans Frigos."); return; }
    const t = obFrType(obGuessType(n)); d.custom.push({ name: n, type: t.k, min: t.min, max: t.max }); el.value = "";
    const grid = $(".onb-frs"); if (grid) { grid.insertAdjacentHTML("beforeend", `<span class="onb-fr on custom pop"><i class="onb-frk">${OB_SVG.ok}</i><span class="onb-fr-tx"><b>${esc(n)}</b><em>${obDeg(t.min)} à ${obDeg(t.max)} °C</em></span><button type="button" class="onb-fr-x" data-act="obFrDel" data-v="${d.custom.length - 1}" aria-label="Retirer ${esc(n)}">${OB_SVG.x}</button></span>`); }
    const nt = $("#obFrNote"); if (nt) nt.textContent = OB.frNote(); SFX.ok(); buzz(6); OB.fiche(); if (obDesk()) el.focus();
  },
  /* the custom tiles are re-indexed after a removal */
  obFrDel: (a, id, v) => {
    const d = OB.st.d; d.custom.splice(+v, 1); const grid = $("#obPane .onb-frs");
    if (grid) { $$(".onb-fr.custom:not(.had)", grid).forEach((x) => x.remove()); grid.insertAdjacentHTML("beforeend", d.custom.map((f, i) => `<span class="onb-fr on custom"><i class="onb-frk">${OB_SVG.ok}</i><span class="onb-fr-tx"><b>${esc(f.name)}</b><em>${obDeg(f.min)} à ${obDeg(f.max)} °C</em></span><button type="button" class="onb-fr-x" data-act="obFrDel" data-v="${i}" aria-label="Retirer ${esc(f.name)}">${OB_SVG.x}</button></span>`).join("")); }
    const nt = $("#obFrNote"); if (nt) nt.textContent = OB.frNote(); SFX.close(); OB.fiche();
  },
  obTeamAdd: () => {
    const el = $("#obTeamIn"); if (!el) return; const n = el.value.trim(); if (!n) { OB.shake(el); return; } const d = OB.st.d;
    const taken = [d.me || S.me.name || "", ...S.members.map((m) => m.name || ""), ...d.team.map((t) => t.name)].map((x) => x.trim().toLowerCase());
    if (taken.includes(n.toLowerCase())) { OB.shake(el); toast(`Il y a déjà un ${n} : ajoutez une initiale.`, "err"); return; }
    if (d.team.length >= 12) { toast("12 personnes maximum ici : ajoutez les autres dans Équipe."); return; }
    d.team.push({ name: n, role: "equipe" }); el.value = ""; const L = $("#obTeamList"); if (L) { L.innerHTML = OB.teamHTML(); const last = $(".onb-mate:last-child", L); last && last.classList.add("pop"); } SFX.ok(); buzz(6); OB.fiche(); if (obDesk()) el.focus();
  },
  obTeamDel: (a, id, v) => { OB.st.d.team.splice(+v, 1); const L = $("#obTeamList"); if (L) L.innerHTML = OB.teamHTML(); SFX.close(); OB.fiche(); },
  obInvRetry: () => { OB.st.d.invErr = ""; const box = $("#obInv"); if (box) box.innerHTML = OB.invHTML(); OB.invite(); },
  obInvShare: async () => { const c = OB.st.d.inv; if (!c) return; try { await navigator.share({ title: `Rejoignez ${OB.st.d.name || "l'équipe"} sur Growth Gusto`, text: `${OB.st.d.me ? firstName(OB.st.d.me) + " vous invite" : "Vous êtes invité"} à rejoindre ${OB.st.d.name || "l'équipe"} sur Growth Gusto. Code : ${OB.invText("code")}`, url: OB.invText("link") }); SFX.ok(); } catch (e) { if (e && e.name !== "AbortError") OB.copy("link"); } },
  obInvCopy: (a, id, v) => OB.copy(v),
  obPrinter: (a) => { const d = OB.st.d; d.printer = d.printer === OB_PRINTER ? "" : OB_PRINTER; const on = d.printer === OB_PRINTER; a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); const f = a.nextElementSibling; if (f && f.classList.contains("onb-fine")) f.innerHTML = on ? "Parfait. Vous la connecterez au Wi-Fi du restaurant depuis Réglages → Imprimante." : "Pas celle-là, ou pas encore ? <b>Configurer plus tard</b> dans Réglages → Imprimante : rien ne bloque."; SFX.tick(); buzz(5); OB.fiche(); },
  /* legacy entry (tools/smoke.js and older scripts): create the restaurant now with what has been filled, then show « C'est prêt » */
  obCreate: async () => {
    const st = OB.ensure(); OB.collect(); const d = st.d;
    if (d.name.length < 2) { OB.goTo(0); setTimeout(() => OB.shake($("#obName")), 200); return; }
    if (d.me.length < 2) { OB.goTo(1); setTimeout(() => OB.shake($("#obMe")), 200); return; }
    OB.setBusy(true); const ok = await OB.finish(); OB.setBusy(false); if (!ok) return;
    OB_STEPS.forEach((x, i) => { if (i < OB_STEPS.length - 1 && !["resto", "vous"].includes(x.k)) d.skipped[x.k] = d.skipped[x.k] || !d.done[x.k]; });
    OB.goTo(OB_STEPS.length - 1);
  },
});
