/* Growth Gusto — area: notes (recettes, procédures d'hygiène, notes libres) */
/* Data shape (collection "notes"), backward compatible with v1 docs {title, cat, body, ingredients[{name,qty,unit}], uid, at, updatedAt}:
   cat: "Recettes" | "Procédures" | "Notes" (legacy "Hygiène" is shown as Procédures)
   body: free text (Notes) or intro / conseils (Recettes, Procédures). Legacy recipes kept their steps in body: they are split into steps on read.
   steps: [string] · portions: number · allergens: [key] · photo: url · seed: starter key */

Object.assign(IC, {
  ntChef: ["M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.85.74-1.03a4 4 0 0 0-2.18-7.58 5 5 0 0 0-9.12 0A4 4 0 0 0 5.26 13.62c.42.18.74.57.74 1.03V20a1 1 0 0 0 1 1Z", "M6 17h12"],
  ntNote: ["M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z", "M15 3v5a1 1 0 0 0 1 1h5", "M7 13h8", "M7 17h5"],
  ntReset: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"],
});
TAB_OF.fiche = "more";

const NOTE_TABS = [["Recettes", "ntChef", "Recettes"], ["Procédures", "shield", "Procédures"], ["Notes", "ntNote", "Notes"]];
const NOTE_ALLERGENS = [["gluten", "Gluten"], ["crustaces", "Crustacés"], ["oeufs", "Œufs"], ["poissons", "Poissons"], ["arachides", "Arachides"], ["soja", "Soja"], ["lait", "Lait"], ["fruits_coque", "Fruits à coque"], ["celeri", "Céleri"], ["moutarde", "Moutarde"], ["sesame", "Sésame"], ["sulfites", "Sulfites"], ["lupin", "Lupin"], ["mollusques", "Mollusques"]];
const NOTE_UNITS = ["g", "kg", "ml", "cl", "L", "pièce", "c. à s.", "c. à c.", "pincée", "botte", "feuille"];
const noteKind = (n) => (n.cat === "Recettes" ? "Recettes" : n.cat === "Hygiène" || n.cat === "Procédures" ? "Procédures" : "Notes");
const noteSplit = (t) => String(t || "").split(/\n+/).map((s) => s.replace(/^\s*(\d+\s*[.)\-–:]|[-•*·])\s*/, "").trim()).filter(Boolean);
const noteSteps = (n) => (Array.isArray(n.steps) ? n.steps.map((s) => String(s || "").trim()).filter(Boolean) : noteKind(n) === "Notes" ? [] : noteSplit(n.body));
const noteIntro = (n) => (Array.isArray(n.steps) || noteKind(n) === "Notes" ? String(n.body || "").trim() : "");
const noteAllergenLabel = (k) => NOTE_ALLERGENS.find((a) => a[0] === k)?.[1] || k;
const noteNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const noteHay = (n) => noteNorm([n.title, n.body, ...(n.steps || []), ...(n.ingredients || []).map((g) => g.name), ...(n.allergens || []).map(noteAllergenLabel)].join(" "));
function noteNum(v) { if (v >= 100) return String(Math.round(v)); const d = v >= 10 ? 1 : 2; return String(+v.toFixed(d)).replace(".", ","); }
function noteScale(qty, unit, k) {
  const n = num(qty); unit = String(unit || "").trim();
  if (n == null) return { q: String(qty || ""), u: unit };
  let v = n * k, u = unit; const lu = u.toLowerCase();
  if (lu === "g" && v >= 1000) { v /= 1000; u = "kg"; } else if (lu === "kg" && v < 1) { v *= 1000; u = "g"; }
  else if (lu === "ml" && v >= 1000) { v /= 1000; u = "L"; } else if (lu === "cl" && v >= 100) { v /= 100; u = "L"; } else if (lu === "l" && v < 1) { v *= 100; u = "cl"; }
  if (/^pi[eè]ce$/i.test(u) && v >= 2) u += "s";
  return { q: noteNum(v), u };
}

/* ───────── starter HACCP procedures ───────── */
const NOTE_STARTER = [
  { seed: "mains", title: "Lavage des mains", body: "À faire en arrivant, après les toilettes, après avoir touché des produits crus, des déchets, son visage ou son téléphone, et entre deux tâches différentes.", steps: [
    "Mouiller les mains et les avant-bras à l'eau tiède.",
    "Prendre une dose de savon bactéricide.",
    "Frotter au moins 30 secondes : paumes, dos des mains, entre les doigts, pouces, ongles et poignets.",
    "Rincer abondamment, du bout des doigts vers les poignets.",
    "Sécher avec un essuie-mains à usage unique. Fermer le robinet avec, s'il n'est pas automatique.",
    "Jeter l'essuie-mains dans la poubelle à pédale."] },
  { seed: "trancheuse", title: "Nettoyage de la trancheuse", body: "Après chaque utilisation, et au moins une fois par service. Porter des gants anti-coupure pendant tout le nettoyage.", steps: [
    "Éteindre et débrancher la trancheuse. Mettre l'épaisseur sur zéro pour couvrir la lame.",
    "Retirer les déchets avec une spatule ou une brosse, jamais avec les doigts.",
    "Démonter les pièces amovibles : chariot, pousse-viande, protège-lame.",
    "Laver les pièces et la machine avec du détergent. Essuyer la lame du centre vers l'extérieur.",
    "Rincer à l'eau claire.",
    "Pulvériser le désinfectant alimentaire. Respecter le temps d'action écrit sur le produit, puis rincer si l'étiquette le demande.",
    "Laisser sécher à l'air ou essuyer avec du papier à usage unique.",
    "Remonter la machine, vérifier qu'elle est propre et la couvrir avec sa housse."] },
  { seed: "reception", title: "Réception des marchandises", body: "Contrôler chaque livraison avant de signer le bon. En cas de doute, refuser le produit et l'écrire sur le bon de livraison.", steps: [
    "Vérifier la propreté du camion et de la tenue du livreur.",
    "Prendre la température des produits : frais entre 0 et 4 °C, viande hachée et poisson frais 2 °C maximum, surgelés -18 °C ou moins.",
    "Vérifier les emballages : intacts, propres, non gonflés, sans givre sur les surgelés.",
    "Lire les étiquettes : DLC ou DDM, numéro de lot, estampille sanitaire pour les produits d'origine animale.",
    "Comparer avec la commande : produits, quantités, prix.",
    "Refuser tout produit non conforme et noter la raison sur le bon de livraison.",
    "Ranger le froid en premier (surgelés puis frais), en moins de 15 minutes.",
    "Enregistrer la réception dans l'app : températures et photo des étiquettes."] },
  { seed: "allergenes", title: "Gestion des allergènes", body: "La loi impose d'informer le client des 14 allergènes majeurs présents dans chaque plat. Une erreur peut être grave pour le client.", steps: [
    "Connaître les 14 allergènes : gluten, crustacés, œufs, poissons, arachides, soja, lait, fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques.",
    "Indiquer les allergènes sur chaque fiche recette et garder la liste à jour, prête à montrer au client.",
    "Relire les étiquettes à chaque livraison : un nouveau fournisseur peut changer les allergènes.",
    "Quand un client signale une allergie, prévenir le chef et l'écrire clairement sur le bon.",
    "Se laver les mains et changer de gants avant de préparer le plat.",
    "Préparer ce plat en premier, sur un plan nettoyé, avec planche et ustensiles propres.",
    "Garder le plat à part, filmé et identifié, jusqu'au service.",
    "En cas de doute sur un ingrédient, ne pas servir et le dire au client."] },
];
const noteMissingStarter = () => NOTE_STARTER.filter((p) => !S.notes.some((n) => n.seed === p.seed || noteNorm(n.title) === noteNorm(p.title)));
const notePlural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

/* ───────── list ───────── */
function noteCard(n, i) {
  const k = noteKind(n); const tab = NOTE_TABS.find((t) => t[0] === k); const steps = noteSteps(n); const ings = n.ingredients || []; const al = n.allergens || [];
  const meta = k === "Recettes" ? [ings.length ? notePlural(ings.length, "ingrédient") : "", n.portions ? notePlural(n.portions, "portion") : "", steps.length ? notePlural(steps.length, "étape") : ""].filter(Boolean).join(" · ")
    : k === "Procédures" ? (steps.length ? notePlural(steps.length, "étape") : "") : "";
  const excerpt = k === "Notes" ? String(n.body || "").trim() : k === "Recettes" ? ings.map((g) => g.name).filter(Boolean).join(", ") : noteIntro(n) || steps[0] || "";
  return `<div class="nt-card glass st" style="--i:${Math.min(i + 4, 14)}" role="button" tabindex="0" data-go="fiche" data-id="${esc(n.id)}">
    <div class="nt-thumb k-${k === "Recettes" ? "r" : k === "Procédures" ? "p" : "n"}">${n.photo ? `<img src="${esc(n.photo)}" alt="" loading="lazy">` : ico(tab[1])}</div>
    <div class="nt-cbody"><b class="nt-ctitle">${esc(n.title || "Sans titre")}</b>
      ${meta ? `<span class="nt-meta">${esc(meta)}</span>` : ""}
      ${excerpt ? `<span class="nt-excerpt">${esc(excerpt)}</span>` : ""}
      ${al.length ? `<span class="nt-almini">${ico("alert")}${notePlural(al.length, "allergène")}</span>` : ""}
    </div><span class="nt-chev">${ico("chev")}</span></div>`;
}
function noteListHTML() {
  const q = noteNorm(S.noteQ); const tab = S.noteCat;
  const list = S.notes.filter((n) => (q ? noteHay(n).includes(q) : noteKind(n) === tab)).sort((a, b) => (b.updatedAt || b.at || 0) - (a.updatedAt || a.at || 0));
  const miss = noteMissingStarter();
  const starter = !q && tab === "Procédures" && miss.length ? `<div class="glass nt-starter st" style="--i:4"><div class="ic ok">${ico("sparkle")}</div><div style="flex:1;min-width:0"><b class="h3">${miss.length === NOTE_STARTER.length ? "Les 4 procédures HACCP essentielles" : `${notePlural(miss.length, "procédure")} HACCP à ajouter`}</b><p class="note" style="margin:3px 0 0">${miss.map((p) => esc(p.title)).join(" · ")}. Rédigées en français clair, modifiables.</p></div><button class="btn acc sm" data-act="noteSeed">${ico("plus")}Ajouter</button></div>` : "";
  const head = q ? `<div class="sub">${notePlural(list.length, "résultat")} pour « ${esc(S.noteQ.trim())} »</div>` : "";
  const empty = list.length ? "" : q ? `<div class="glass empty"><div class="ic">${ico("search")}</div><b>Aucun résultat</b>Essayez un autre mot : un ingrédient, un allergène, une étape.</div>`
    : tab === "Recettes" ? `<div class="glass empty st" style="--i:5"><div class="ic">${ico("ntChef")}</div><b>Aucune fiche recette</b>Ingrédients, grammages, portions, étapes et allergènes, au même endroit.<div style="margin-top:14px"><button class="btn acc sm" data-act="noteNew" data-v="Recettes">${ico("plus")}Créer une recette</button></div></div>`
    : tab === "Procédures" ? (starter ? "" : `<div class="glass empty st" style="--i:5"><div class="ic ok">${ico("shield")}</div><b>Aucune procédure</b>Écrivez vos méthodes de nettoyage, de réception, d'hygiène.</div>`)
    : `<div class="glass empty st" style="--i:5"><div class="ic">${ico("ntNote")}</div><b>Aucune note</b>Infos pour l'équipe, contacts, rappels.<div style="margin-top:14px"><button class="btn acc sm" data-act="noteNew" data-v="Notes">${ico("plus")}Écrire une note</button></div></div>`;
  return `${head}${starter}${list.length ? `<div class="nt-grid">${list.map(noteCard).join("")}</div>` : ""}${empty}`;
}
function noteListPaint(anim) { const L = $("#noteList"); if (!L) return; L.innerHTML = noteListHTML(); if (!anim) $$(".st", L).forEach((e) => (e.style.animation = "none")); }
VIEWS.notes = {
  render() {
    if (!NOTE_TABS.some((t) => t[0] === S.noteCat)) S.noteCat = S.noteCat === "Hygiène" ? "Procédures" : "Recettes";
    const ix = NOTE_TABS.findIndex((t) => t[0] === S.noteCat); const cnt = (k) => S.notes.filter((n) => noteKind(n) === k).length;
    return `<div class="inner nt-wrap">${topBar("Recettes & procédures", { right: `<button class="btn acc sm" data-act="noteNew">${ico("plus")}Nouvelle</button>` })}
      <div class="seg nt-seg st" style="--i:1" id="ntSeg"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${ix * 100}%)"></span>${NOTE_TABS.map(([k, ic, t]) => `<button class="${S.noteCat === k ? "on" : ""}" data-act="noteCat" data-v="${k}">${ico(ic)}<span>${t}</span><em class="mono">${cnt(k)}</em></button>`).join("")}</div>
      <div class="nt-search st" style="--i:2">${ico("search")}<input class="input" id="noteQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Rechercher une fiche, un ingrédient…" value="${esc(S.noteQ)}"><button class="nt-clear" data-act="noteQClear" aria-label="Effacer" ${S.noteQ ? "" : "hidden"}>${ico("x")}</button></div>
      <div id="noteList" class="nt-list">${noteListHTML()}</div></div>`;
  },
  after(v) {
    const i = $("#noteQ", v); if (!i) return;
    i.addEventListener("input", debounce(() => { S.noteQ = i.value; noteListPaint(false); const c = $(".nt-clear", v); if (c) c.hidden = !i.value; $$("#ntSeg button", v).forEach((b) => b.classList.toggle("dim", !!i.value)); }, 150));
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") i.blur(); });
    if (S.noteQ) $$("#ntSeg button", v).forEach((b) => b.classList.add("dim"));
  },
};

/* ───────── read view ───────── */
function noteIngHTML(n) {
  const base = num(n.portions); const P = S.ui.notePortions?.[n.id]; const k = base ? (P ?? base) / base : P ?? 1;
  return (n.ingredients || []).map((g) => { const s = noteScale(g.qty, g.unit, k); return `<li><span class="nt-iname">${esc(g.name)}</span><span class="nt-lead"></span><b class="nt-iqty mono">${esc(s.q)}${s.u ? `<small>${esc(s.u)}</small>` : ""}</b></li>`; }).join("");
}
function noteScalerHTML(n) {
  const base = num(n.portions); const P = S.ui.notePortions?.[n.id];
  if (base) {
    const v = P ?? base; const quick = [...new Set([Math.max(1, Math.round(base / 2)), base, base * 2, 10, 20, 50])].sort((a, b) => a - b).slice(0, 6);
    return `<div class="nt-scaler"><button class="iconbtn nt-step" data-act="notePort" data-v="-1" aria-label="Moins">${ico("minus")}</button><label class="nt-pval"><input class="mono" id="ntPort" inputmode="numeric" value="${v}" aria-label="Portions"><span id="ntPortLbl">${v > 1 ? "portions" : "portion"}</span></label><button class="iconbtn nt-step" data-act="notePort" data-v="1" aria-label="Plus">${ico("plus")}</button></div>
      <div class="chips nt-quick">${quick.map((x) => `<button class="chip ${x === v ? "on" : ""}" data-act="notePortSet" data-v="${x}">${x}${x === base ? " · base" : ""}</button>`).join("")}</div>`;
  }
  const v = P ?? 1;
  return `<div class="nt-scaler"><button class="iconbtn nt-step" data-act="notePort" data-v="-1" aria-label="Moins">${ico("minus")}</button><label class="nt-pval"><span>×</span><input class="mono" id="ntPort" inputmode="decimal" value="${noteNum(v)}" aria-label="Multiplier la recette"></label><button class="iconbtn nt-step" data-act="notePort" data-v="1" aria-label="Plus">${ico("plus")}</button></div>`;
}
function noteRefreshScale(id) {
  const n = S.notes.find((x) => x.id === id); if (!n) return;
  const L = $("#ntIngs"); if (L) { L.innerHTML = noteIngHTML(n); $$(".nt-iqty", L).forEach((e) => { e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }); }
  const base = num(n.portions); const v = S.ui.notePortions[id] ?? base ?? 1;
  $$(".nt-quick .chip").forEach((c) => c.classList.toggle("on", +c.dataset.v === v));
  const lab = $("#ntPortLbl"); if (lab) lab.textContent = v > 1 ? "portions" : "portion";
}
function noteRunHTML(n, steps) {
  const R = S.ui.noteRun?.id === n.id ? S.ui.noteRun : { done: [] }; const done = R.done.length; const cur = steps.findIndex((_, i) => !R.done.includes(i));
  return `<div class="glass pad nt-runbar st" style="--i:3"><div class="hstack" style="justify-content:space-between"><span class="lbl">Mode pas-à-pas</span><span class="mono nt-runct"><b>${done}</b> / ${steps.length}</span></div><div class="nt-prog"><i style="width:${steps.length ? (done / steps.length) * 100 : 0}%"></i></div><p class="note" style="margin:8px 0 0">Touchez chaque étape quand elle est faite.</p></div>
    <ol class="nt-run">${steps.map((s, i) => `<li class="st ${R.done.includes(i) ? "done" : ""} ${i === cur ? "cur" : ""}" style="--i:${Math.min(i + 4, 14)}"><button data-act="noteTick" data-id="${esc(n.id)}" data-v="${i}" aria-pressed="${R.done.includes(i)}"><span class="nt-box">${ico("check")}</span><span class="nt-rnum mono">${i + 1}</span><span class="nt-rtx">${esc(s)}</span></button></li>`).join("")}</ol>
    <div class="glass nt-runend" ${done && done === steps.length ? "" : "hidden"}><div class="check draw">${ico("check")}</div><b class="h3">Procédure terminée</b><span class="note">C'est noté dans le registre.</span><button class="btn soft sm" data-act="noteRunReset" data-id="${esc(n.id)}">${ico("ntReset")}Recommencer</button></div>`;
}
VIEWS.fiche = {
  render({ id }) {
    const n = S.notes.find((x) => x.id === id);
    if (!n) return `<div class="inner narrow">${topBar("Fiche")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("book")}</div><b>Fiche introuvable</b>Elle a peut-être été supprimée.</div></div>`;
    const k = noteKind(n); const steps = noteSteps(n); const intro = noteIntro(n); const ings = n.ingredients || []; const al = n.allergens || [];
    const pill = k === "Recettes" ? `<span class="pill acc">${ico("ntChef")}Recette</span>` : k === "Procédures" ? `<span class="pill ok">${ico("shield")}Procédure</span>` : `<span class="pill neu">${ico("ntNote")}Note</span>`;
    const hero = `<div class="nt-hero st ${n.photo ? "has-ph" : ""}" style="--i:1">${n.photo ? `<div class="nt-photo"><img src="${esc(n.photo)}" alt=""></div>` : ""}<div class="nt-htx">${pill}<h1 class="nt-title">${esc(n.title || "Sans titre")}</h1><span class="who">${avatar(n.uid, true)}${esc(firstName(nameOf(n.uid)))} · modifié ${when(n.updatedAt || n.at)}</span></div></div>`;
    const top = `<div class="top st" style="--i:0"><button class="iconbtn" data-act="back" aria-label="Retour">${ico("back")}</button><span class="h2"></span><button class="btn soft sm" data-act="noteEdit" data-id="${esc(n.id)}">${ico("edit")}Modifier</button></div>`;
    const stepsHTML = steps.length ? `<div class="glass pad st" style="--i:4"><span class="lbl">Étapes</span><ol class="nt-steps">${steps.map((s, i) => `<li><span class="nt-snum mono">${i + 1}</span><span>${esc(s)}</span></li>`).join("")}</ol></div>` : "";
    const introHTML = (lbl, i) => (intro ? `<div class="glass pad st nt-intro" style="--i:${i}"><span class="lbl">${lbl}</span><p>${esc(intro)}</p></div>` : "");
    if (k === "Recettes") {
      const alHTML = `<div class="glass pad st" style="--i:3"><span class="lbl">Allergènes</span>${al.length ? `<div class="nt-als">${al.map((a) => `<span class="nt-al on">${ico("alert")}${esc(noteAllergenLabel(a))}</span>`).join("")}</div>` : `<p class="note" style="margin:8px 0 0">Aucun allergène indiqué. Vérifiez la fiche avant de servir un client allergique.</p>`}</div>`;
      return `<div class="inner wide nt-wrap">${top}${hero}<div class="cols nt-cols"><div>
        <div class="glass pad st nt-ingcard" style="--i:2"><span class="lbl">${num(n.portions) ? "Pour combien de portions ?" : "Quantité"}</span>${noteScalerHTML(n)}
        ${ings.length ? `<ul class="nt-ings" id="ntIngs">${noteIngHTML(n)}</ul>` : `<p class="note" style="margin:0">Pas encore d'ingrédients. Touchez « Modifier » pour les ajouter.</p>`}</div>
        ${alHTML}</div><div>${stepsHTML}${introHTML("Conseils du chef", 5)}</div></div></div>`;
    }
    if (k === "Procédures") return `<div class="inner narrow nt-wrap">${top}${hero}${introHTML("Quand et pourquoi", 2)}${steps.length ? noteRunHTML(n, steps) : `<div class="glass empty st" style="--i:3">Aucune étape. Touchez « Modifier » pour les écrire.</div>`}</div>`;
    return `<div class="inner narrow nt-wrap">${top}${hero}<div class="glass pad st nt-body" style="--i:2">${n.body ? esc(n.body) : `<span class="note">Note vide.</span>`}</div></div>`;
  },
  after(v) {
    setTimeout(() => { const b = $('#side .nav[data-go="notes"]'); b && b.classList.add("on"); }, 0);
    const i = $("#ntPort", v); if (!i) return; const id = S.params.id;
    i.addEventListener("focus", () => i.select());
    i.addEventListener("input", () => { const x = num(i.value); if (x && x > 0 && x <= 10000) { (S.ui.notePortions ||= {})[id] = x; noteRefreshScale(id); } });
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") i.blur(); });
  },
};

/* ───────── editor ───────── */
function noteDraft(id) {
  const n = S.notes.find((x) => x.id === id);
  if (!n) { const cat = S.ui.noteNewCat || "Recettes"; return { _id: id, title: "", cat, body: "", ingredients: cat === "Recettes" ? [{ name: "", qty: "", unit: "g" }] : [], steps: cat === "Notes" ? [] : [""], portions: cat === "Recettes" ? 4 : "", allergens: [], photo: "" }; }
  const d = JSON.parse(JSON.stringify(n)); d._id = id; d.cat = noteKind(n);
  if (!Array.isArray(d.steps)) { if (d.cat === "Notes") d.steps = []; else { d.steps = noteSplit(d.body); d.body = ""; } }
  if (d.cat !== "Notes" && !d.steps.length) d.steps = [""];
  d.ingredients ||= []; d.allergens ||= []; d.photo ||= ""; d.portions ??= "";
  ["id", "updatedAt", "uid", "at"].forEach((key) => delete d[key]); return d;
}
const noteSnap = (N) => JSON.stringify({ t: (N.title || "").trim(), c: N.cat, b: (N.body || "").trim(), i: (N.ingredients || []).filter((g) => g.name.trim()), s: (N.steps || []).filter((s) => s.trim()), p: String(N.portions ?? ""), a: [...(N.allergens || [])].sort(), ph: N.photo || "" });
VIEWS.note = {
  live: false,
  render({ id }) {
    if (!S.ui.note || S.ui.note._id !== id) { S.ui.note = noteDraft(id); S.ui.noteOrig = noteSnap(S.ui.note); }
    const N = S.ui.note; N.ingredients ||= []; N.steps ||= []; N.allergens ||= [];
    const isR = N.cat === "Recettes", isN = N.cat === "Notes"; const ix = NOTE_TABS.findIndex((t) => t[0] === N.cat);
    const photo = N.photo ? `<div class="nt-ephoto"><img src="${esc(N.photo)}" alt=""><div class="nt-ephbtn"><button class="btn soft sm" data-act="notePhoto">${ico("camera")}Changer</button><button class="btn soft sm" data-act="notePhotoDel" style="color:var(--bad)">${ico("trash")}Retirer</button></div></div>`
      : `<button class="nt-addph" data-act="notePhoto" ${S.ui.notePhBusy ? "disabled" : ""}>${ico(S.ui.notePhBusy ? "clock" : "camera")}<span>${S.ui.notePhBusy ? "Préparation de la photo…" : "Ajouter une photo"}</span><em>facultatif</em></button>`;
    const ingsHTML = `<div class="glass pad st nt-esec" style="--i:3"><div class="nt-ehead"><span class="lbl">Ingrédients</span>
        <label class="nt-eport"><span>Pour</span><input class="input mono" data-bind="ui.note.portions" inputmode="numeric" value="${esc(N.portions)}" placeholder="4" aria-label="Nombre de portions"><span>portions</span></label></div>
      <div class="nt-erows">${N.ingredients.map((g, i) => `<div class="nt-erow"><input class="input nt-n" data-bind="ui.note.ingredients.${i}.name" data-nkey="ing" data-i="${i}" value="${esc(g.name)}" placeholder="Ingrédient" aria-label="Ingrédient ${i + 1}" enterkeyhint="next"><input class="input mono nt-q" data-bind="ui.note.ingredients.${i}.qty" data-nkey="ing" data-i="${i}" inputmode="decimal" value="${esc(g.qty)}" placeholder="Qté" aria-label="Quantité" enterkeyhint="next"><input class="input nt-u" list="ntUnits" data-bind="ui.note.ingredients.${i}.unit" data-nkey="ing" data-i="${i}" value="${esc(g.unit)}" placeholder="g" aria-label="Unité" enterkeyhint="next"><button class="iconbtn nt-del" data-act="noteIngDel" data-v="${i}" aria-label="Retirer l'ingrédient">${ico("x")}</button></div>`).join("")}</div>
      <datalist id="ntUnits">${NOTE_UNITS.map((u) => `<option value="${esc(u)}">`).join("")}</datalist>
      <button class="btn ghost sm" data-act="noteIngAdd" style="align-self:flex-start">${ico("plus")}Ajouter un ingrédient</button></div>
      <div class="glass pad st nt-esec" style="--i:4"><span class="lbl">Allergènes présents</span><div class="nt-als nt-alsed">${NOTE_ALLERGENS.map(([key, t]) => `<button class="nt-al ${N.allergens.includes(key) ? "on" : ""}" data-act="noteAl" data-v="${key}" aria-pressed="${N.allergens.includes(key)}">${ico(N.allergens.includes(key) ? "check" : "plus")}${t}</button>`).join("")}</div></div>`;
    const stepsHTML = `<div class="glass pad st nt-esec" style="--i:5"><span class="lbl">Étapes</span><div class="nt-esteps">${N.steps.map((s, i) => `<div class="nt-estep"><span class="nt-snum mono">${i + 1}</span><textarea class="input" rows="1" data-bind="ui.note.steps.${i}" data-nkey="step" data-i="${i}" enterkeyhint="next" placeholder="${i === 0 ? (isR ? "Ex. Mélanger le sucre, le sel et les baies roses." : "Ex. Débrancher la machine.") : "Étape suivante"}" aria-label="Étape ${i + 1}">${esc(s)}</textarea><button class="iconbtn nt-del" data-act="noteStepDel" data-v="${i}" aria-label="Retirer l'étape">${ico("x")}</button></div>`).join("")}</div>
      <button class="btn ghost sm" data-act="noteStepAdd" style="align-self:flex-start">${ico("plus")}Ajouter une étape</button><p class="note" style="margin:0">Astuce : la touche Entrée crée l'étape suivante.</p></div>`;
    const bodyHTML = isN ? `<div class="glass pad st nt-esec" style="--i:3"><span class="lbl">Contenu</span><textarea class="input nt-ebody" data-bind="ui.note.body" placeholder="Écrivez ici…">${esc(N.body)}</textarea></div>`
      : `<div class="glass pad st nt-esec" style="--i:6"><span class="lbl">${isR ? "Conseils du chef" : "Quand et pourquoi"}</span><textarea class="input" style="min-height:96px" data-bind="ui.note.body" placeholder="${isR ? "Dressage, conservation, astuces… (facultatif)" : "Fréquence, matériel, précautions… (facultatif)"}">${esc(N.body)}</textarea></div>`;
    return `<div class="inner narrow nt-wrap"><div class="top st" style="--i:0"><button class="iconbtn" data-act="noteBack" aria-label="Retour">${ico("back")}</button><span class="h2">${id === "new" ? "Nouvelle fiche" : "Modifier la fiche"}</span>${id !== "new" ? `<button class="iconbtn" data-act="noteDel" aria-label="Supprimer la fiche" style="color:var(--bad)">${ico("trash")}</button>` : ""}</div>
      <div class="glass pad st nt-esec" style="--i:1"><input class="input nt-etitle" data-bind="ui.note.title" value="${esc(N.title)}" placeholder="${isR ? "Nom de la recette" : isN ? "Titre de la note" : "Nom de la procédure"}" aria-label="Titre">
        <div class="seg nt-seg" id="ntESeg"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${ix * 100}%)"></span>${NOTE_TABS.map(([k, ic]) => `<button class="${N.cat === k ? "on" : ""}" data-act="noteSetCat" data-v="${k}">${ico(ic)}<span>${k === "Recettes" ? "Recette" : k === "Procédures" ? "Procédure" : "Note"}</span></button>`).join("")}</div></div>
      ${!isN || N.photo ? `<div class="st" style="--i:2">${photo}</div>` : ""}
      ${isR ? ingsHTML : ""}${isN ? "" : stepsHTML}${bodyHTML}
      <div class="ctabar st" style="--i:7"><button class="btn acc block" data-act="noteSave">${ico("check")}Enregistrer</button></div></div>`;
  },
  after(v) {
    const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
    $$(".nt-estep textarea", v).forEach((t) => { grow(t); t.addEventListener("input", () => grow(t)); });
    if (!v._ntKeys) v._ntKeys = 1, v.addEventListener("keydown", (e) => {
      const t = e.target; if (S.route !== "note" || e.key !== "Enter" || e.shiftKey || !t.dataset.nkey || e.isComposing) return;
      const i = +t.dataset.i; e.preventDefault();
      if (t.dataset.nkey === "step") { S.ui.note.steps.splice(i + 1, 0, ""); S.ui.noteFocus = `[data-nkey=step][data-i="${i + 1}"]`; noteRer(); return; }
      const ins = $$("input", t.closest(".nt-erow")); const k = ins.indexOf(t); if (k < ins.length - 1) { ins[k + 1].focus(); return; }
      const L = S.ui.note.ingredients; if (i === L.length - 1) L.push({ name: "", qty: "", unit: "g" }); S.ui.noteFocus = `.nt-n[data-i="${i + 1}"]`; noteRer();
    });
    if (S.ui.noteFocus) { const f = $(S.ui.noteFocus, v); S.ui.noteFocus = null; if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "center", behavior: "smooth" }); } }
  },
};
const noteRer = () => { const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); rerender(); const v = $("#viewport .view:not(.leave)"); v && $$(".st", v).forEach((e) => (e.style.animation = "none")); };
function noteSegMove(segId, v) { const seg = $("#" + segId); if (!seg) return; const ix = NOTE_TABS.findIndex((t) => t[0] === v); $$("button", seg).forEach((b) => { b.classList.toggle("on", b.dataset.v === v); b.classList.remove("dim"); }); $(".knob", seg).style.transform = `translateX(${ix * 100}%)`; }
function noteLeave() { S.ui.note = null; S.ui.noteNewCat = null; goBack(); }

async function notePhotoUrl(file) {
  const { blob, canvas } = await shrink(file, 1200, 0.8);
  let url = "", id = "";
  try { const r = await upload(blob); url = r.url; id = r.id; } catch (e) {}
  if (!url || url.startsWith("blob:")) { // a blob: URL dies with the tab: keep a small persistent copy on the device instead
    const k = Math.min(1, 900 / Math.max(canvas.width, canvas.height)); const c = document.createElement("canvas"); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
    c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); url = c.toDataURL("image/jpeg", 0.72); id = "";
  }
  return { url, id };
}

Object.assign(ACT, {
  noteCat: (a, id, v) => { if (S.noteCat === v && !S.noteQ) return; S.noteCat = v; S.noteQ = ""; SFX.tick(); buzz(5); noteSegMove("ntSeg", v); const i = $("#noteQ"); if (i) i.value = ""; const c = $(".nt-clear"); if (c) c.hidden = true; noteListPaint(true); },
  noteQClear: () => { S.noteQ = ""; const i = $("#noteQ"); if (i) { i.value = ""; i.focus(); } const c = $(".nt-clear"); if (c) c.hidden = true; $$("#ntSeg button").forEach((b) => b.classList.remove("dim")); noteListPaint(false); SFX.tick(); },
  noteNew: (a, id, v) => { S.ui.note = null; S.ui.noteNewCat = v || (NOTE_TABS.some((t) => t[0] === S.noteCat) ? S.noteCat : "Recettes"); SFX.tap(); go("note", { id: "new" }); },
  noteEdit: (a, id) => { S.ui.note = null; SFX.tap(); go("note", { id }); },
  noteSeed: async (a) => {
    const miss = noteMissingStarter(); if (!miss.length) return; a.disabled = true; const t = Date.now();
    try { for (let i = 0; i < miss.length; i++) { const p = miss[i]; await safe(DB.add("notes", { title: p.title, cat: "Procédures", body: p.body, steps: p.steps, seed: p.seed, uid: S.me.id, at: t + i, updatedAt: t + i })); } } catch (e) { a.disabled = false; return; }
    await logEvent("note", `a ajouté ${notePlural(miss.length, "procédure")} HACCP`);
    const r = a.getBoundingClientRect(); SFX.done(); buzz(14); burst(r.left + r.width / 2, r.top); toast(`${notePlural(miss.length, "procédure")} ajoutée${miss.length > 1 ? "s" : ""}`);
    S.noteCat = "Procédures"; setTimeout(rerender, 80);
  },
  /* read view */
  notePort: (a, id, v) => {
    const pid = S.params.id; const n = S.notes.find((x) => x.id === pid); if (!n) return; const base = num(n.portions); S.ui.notePortions ||= {};
    const cur = S.ui.notePortions[pid] ?? base ?? 1; const step = base ? 1 : 0.5; const nx = Math.max(step, Math.min(10000, Math.round((cur + step * +v) / step) * step));
    if (nx === cur) { SFX.err(); return; } S.ui.notePortions[pid] = nx; SFX.tick(); buzz(5); const i = $("#ntPort"); if (i) { i.value = base ? nx : noteNum(nx); i.classList.remove("bump"); void i.offsetWidth; i.classList.add("bump"); } noteRefreshScale(pid);
  },
  notePortSet: (a, id, v) => { const pid = S.params.id; (S.ui.notePortions ||= {})[pid] = +v; SFX.tick(); buzz(5); const i = $("#ntPort"); if (i) i.value = v; noteRefreshScale(pid); },
  noteTick: async (a, id, v) => {
    const n = S.notes.find((x) => x.id === id); if (!n) return; const steps = noteSteps(n);
    if (S.ui.noteRun?.id !== id) S.ui.noteRun = { id, done: [] }; const R = S.ui.noteRun; const i = +v;
    const on = !R.done.includes(i); if (on) R.done.push(i); else R.done = R.done.filter((x) => x !== i);
    const li = a.closest("li"); li.classList.toggle("done", on); a.setAttribute("aria-pressed", on);
    const cur = steps.findIndex((_, k) => !R.done.includes(k)); $$(".nt-run li").forEach((e, k) => e.classList.toggle("cur", k === cur));
    const ct = $(".nt-runct b"); if (ct) ct.textContent = R.done.length; const bar = $(".nt-prog i"); if (bar) bar.style.width = (R.done.length / steps.length) * 100 + "%";
    const end = $(".nt-runend"); const all = R.done.length === steps.length;
    if (on) { SFX.tick(); buzz(8); } else SFX.tap();
    if (all && end) {
      end.hidden = false; const c = $(".check", end); c.classList.remove("draw"); void c.offsetWidth; c.classList.add("draw");
      setTimeout(() => { SFX.done(); buzz(16); burst(); end.scrollIntoView({ block: "center", behavior: "smooth" }); }, 120);
      if (!R.logged) { R.logged = true; await logEvent("note", `a suivi la procédure « ${n.title} »`, { ref: id }); }
    } else if (end) { end.hidden = true; if (on && cur >= 0) { const nx = $$(".nt-run li")[cur]; nx && nx.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }
  },
  noteRunReset: (a, id) => { S.ui.noteRun = { id, done: [] }; SFX.close(); rerender(); const v = $("#viewport .view:not(.leave)"); v && v.scrollTo({ top: 0, behavior: "smooth" }); },
  /* editor */
  noteSetCat: (a, id, v) => { const N = S.ui.note; if (N.cat === v) return; N.cat = v; if (v !== "Notes" && !N.steps.length) N.steps = [""]; if (v === "Recettes" && !N.ingredients.length) N.ingredients = [{ name: "", qty: "", unit: "g" }]; if (v === "Recettes" && !N.portions) N.portions = 4; SFX.tick(); noteRer(); },
  noteIngAdd: () => { const L = S.ui.note.ingredients; L.push({ name: "", qty: "", unit: "g" }); S.ui.noteFocus = `.nt-n[data-i="${L.length - 1}"]`; SFX.tick(); noteRer(); },
  noteIngDel: (a, id, v) => { S.ui.note.ingredients.splice(+v, 1); SFX.close(); noteRer(); },
  noteStepAdd: () => { const L = S.ui.note.steps; L.push(""); S.ui.noteFocus = `[data-nkey=step][data-i="${L.length - 1}"]`; SFX.tick(); noteRer(); },
  noteStepDel: (a, id, v) => { S.ui.note.steps.splice(+v, 1); if (!S.ui.note.steps.length) S.ui.note.steps.push(""); SFX.close(); noteRer(); },
  noteAl: (a, id, v) => { const L = S.ui.note.allergens; const on = !L.includes(v); if (on) L.push(v); else L.splice(L.indexOf(v), 1); a.classList.toggle("on", on); a.setAttribute("aria-pressed", on); a.innerHTML = ico(on ? "check" : "plus") + esc(noteAllergenLabel(v)); SFX.tick(); buzz(5); },
  notePhoto: async () => {
    const [f] = await pickImage(); if (!f) return; S.ui.notePhBusy = true; noteRer();
    try { const r = await notePhotoUrl(f); S.ui.note.photo = r.url; S.ui.note.photoId = r.id; SFX.ok(); } catch (e) { console.warn(e); SFX.err(); toast("Photo illisible. Essayez une autre image.", "err"); }
    S.ui.notePhBusy = false; if (S.route === "note") noteRer();
  },
  notePhotoDel: () => { S.ui.note.photo = ""; S.ui.note.photoId = ""; SFX.close(); noteRer(); },
  noteBack: () => {
    const N = S.ui.note; if (!N || noteSnap(N) === S.ui.noteOrig) { SFX.tap(); noteLeave(); return; }
    openSheet(`<div class="h2" style="font-size:20px">Quitter sans enregistrer ?</div><p class="sub" style="margin:0">Vos modifications seront perdues.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Continuer</button><button class="btn danger" data-act="noteDiscard">Quitter</button></div>`);
  },
  noteDiscard: () => { closeSheet(true); noteLeave(); },
  noteSave: async (a) => {
    const N = S.ui.note; const id = N._id; const isR = N.cat === "Recettes", isN = N.cat === "Notes";
    const title = (N.title || "").trim();
    if (!title) { SFX.err(); buzz(30); toast("Donnez un titre à la fiche.", "err"); const t = $(".nt-etitle"); if (t) { t.focus(); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); } return; }
    const d = { title, cat: N.cat, body: String(N.body || "").trim(), updatedAt: Date.now(), uid: S.me.id,
      ingredients: isR ? (N.ingredients || []).filter((g) => String(g.name || "").trim()).map((g) => ({ name: g.name.trim(), qty: String(g.qty ?? "").trim(), unit: String(g.unit ?? "").trim() })) : [],
      steps: isN ? [] : (N.steps || []).map((s) => String(s || "").trim()).filter(Boolean),
      allergens: isR ? N.allergens || [] : [], portions: isR ? Math.max(0.01, num(N.portions) || 1) : 1, photo: N.photo || "", photoId: N.photoId || "" };
    a.disabled = true;
    try {
      if (id === "new") { d.at = Date.now(); const nid = await safe(DB.add("notes", d)); await logEvent("note", `a créé la fiche « ${d.title} »`, { ref: nid }); S.ui.note = null; S.ui.noteNewCat = null; S.noteCat = d.cat; SFX.ok(); buzz(10); toast("Fiche enregistrée"); go("fiche", { id: nid }, { replace: true }); }
      else { await safe(DB.update("notes", id, d)); await logEvent("note", `a modifié la fiche « ${d.title} »`, { ref: id }); S.noteCat = d.cat; SFX.ok(); buzz(10); toast("Fiche enregistrée"); noteLeave(); }
    } catch (e) { a.disabled = false; }
  },
  noteDel: () => { openSheet(`<div class="h2" style="font-size:20px">Supprimer cette fiche ?</div><p class="sub" style="margin:0">Elle disparaît pour toute l'équipe. Impossible d'annuler.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="noteDelOk">${ico("trash")}Supprimer</button></div>`); },
  noteDelOk: async () => {
    closeSheet(true); const id = S.ui.note._id; const t = S.ui.note.title;
    try { await safe(DB.del("notes", id)); } catch (e) { return; }
    await logEvent("note", `a supprimé la fiche « ${t || "Sans titre"} »`, { ref: id });
    S.ui.note = null; S.history = S.history.filter((h) => !(h.params && h.params.id === id)); SFX.close(); toast("Fiche supprimée"); goBack();
  },
});

