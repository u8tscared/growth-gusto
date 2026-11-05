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
/* the 14 regulated allergens come from core (ALLERGENS); v1/v2 recipes stored "fruits_coque": read as "fruitscoque" */
const NOTE_ALLERGENS = (typeof ALLERGENS !== "undefined" ? ALLERGENS : []).map((a) => [a.id, a.t]);
const noteAlId = (k) => (k === "fruits_coque" ? "fruitscoque" : String(k || ""));
const NOTE_UNITS = ["g", "kg", "ml", "cl", "L", "PCE", "DZ", "pièce", "c. à s.", "c. à c.", "pincée", "botte", "feuille"];
const noteKind = (n) => (n.cat === "Recettes" ? "Recettes" : n.cat === "Hygiène" || n.cat === "Procédures" ? "Procédures" : "Notes");
const noteSplit = (t) => String(t || "").split(/\n+/).map((s) => s.replace(/^\s*(\d+\s*[.)\-–:]|[-•*·])\s*/, "").trim()).filter(Boolean);
const noteSteps = (n) => (Array.isArray(n.steps) ? n.steps.map((s) => String(s || "").trim()).filter(Boolean) : noteKind(n) === "Notes" ? [] : noteSplit(n.body));
const noteIntro = (n) => (Array.isArray(n.steps) || noteKind(n) === "Notes" ? String(n.body || "").trim() : "");
const noteAllergenLabel = (k) => NOTE_ALLERGENS.find((a) => a[0] === noteAlId(k))?.[1] || k;
const noteNorm = (s) => String(s || "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").trim();
const noteHay = (n) => noteNorm([n.title, n.body, ...(n.steps || []), ...(n.ingredients || []).map((g) => g.name), ...(noteKind(n) === "Recettes" && typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || []).map(noteAllergenLabel), n.carte ? "carte " + (NOTE_CARTE_CATS.find((c) => c[0] === n.carteCat)?.[1] || "") : ""].join(" "));
const noteMatch = (n, q) => { const h = noteHay(n); return q.split(/\s+/).filter(Boolean).every((w) => h.includes(w)); };
function noteNum(v) { if (v >= 100) return String(Math.round(v)); const d = v >= 10 ? 1 : 2; return String(+v.toFixed(d)).replace(".", ","); }
/* quantities: "200", "1,5", "1/2", "1 1/2", "½", ranges "2-3" / "2 à 3", and a text tail "200 env." */
const NOTE_UFRAC = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8" };
function noteVal(s) {
  s = String(s).trim().replace(/(\d)?\s*([½¼¾⅓⅔⅛])/g, (m, d, f) => (d ? d + " " : "") + NOTE_UFRAC[f]);
  let m = s.match(/^\d+(?:[.,]\d+)?$/); if (m) return +s.replace(",", ".");
  m = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/); if (m && +m[3]) return +(m[1] || 0) + m[2] / m[3];
  return null;
}
function noteParse(q) {
  const s = String(q ?? "").trim(); if (!s) return null;
  const r = s.split(/\s*(?:-|–|\sà\s)\s*/); if (r.length === 2) { const a = noteVal(r[0]), b = noteVal(r[1]); if (a != null && b != null) return { v: [a, b], rest: "" }; }
  const v = noteVal(s); if (v != null) return { v: [v], rest: "" };
  const m = s.match(/^([\d.,/½¼¾⅓⅔⅛ ]*\d[½¼¾⅓⅔⅛]?)\s+(\D.*)$/); if (m) { const x = noteVal(m[1]); if (x != null) return { v: [x], rest: m[2] }; }
  return null;
}
const NOTE_COUNT = /^(pi[eè]ce|botte|feuille|pinc[ée]e|gousse|tranche|branche|brin|boule|sachet|bo[iî]te|bocal|œuf|oeuf|jaune|blanc|zeste|citron|c\. à [sc]\.|cuill[eè]re)s?$/i;
const NOTE_PLURAL = /^(pi[eè]ce|botte|feuille|pinc[ée]e|gousse|tranche|branche|brin|boule|sachet|bo[iî]te|bocal|œuf|oeuf|jaune|blanc|zeste|citron|cuill[eè]re)s?$/i;
function noteUnitForm(u, v) { if (!NOTE_PLURAL.test(u)) return u; const base = u.replace(/s$/i, ""); return v >= 2 ? base + "s" : base; }
/* count units read better as kitchen fractions: ½, 1 ¼, ⅓ … */
function noteFrac(v) {
  if (v >= 10) return String(Math.round(v));
  const w = Math.floor(v), f = v - w; const C = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
  let best = C[0]; for (const c of C) if (Math.abs(f - c[0]) < Math.abs(f - best[0])) best = c;
  const W = best[0] === 1 ? w + 1 : w; if (!W && !best[1]) return noteNum(v);
  return W ? `${W}${best[1] ? " " + best[1] : ""}` : best[1];
}
function noteFmt(v, u) {
  const lu = u.toLowerCase();
  if (!u || NOTE_COUNT.test(u)) return noteFrac(v);
  if ((lu === "g" || lu === "ml") && v >= 10) return String(Math.round(v));
  return noteNum(v);
}
function noteScale(qty, unit, k) {
  const p = noteParse(qty); unit = String(unit || "").trim();
  if (!p) return { q: String(qty || ""), u: unit };
  const conv = (v) => {
    let u = unit; const lu = u.toLowerCase();
    if (lu === "g" && v >= 1000) { v /= 1000; u = "kg"; } else if (lu === "kg" && v < 1) { v *= 1000; u = "g"; }
    else if (lu === "ml" && v >= 1000) { v /= 1000; u = "L"; } else if (lu === "cl" && v >= 100) { v /= 100; u = "L"; } else if (lu === "l" && v < 1) { v *= 100; u = "cl"; }
    return { v, u };
  };
  const vs = p.v.map((x) => conv(x * k)); const u = noteUnitForm(vs[vs.length - 1].u, vs[vs.length - 1].v);
  const sameU = vs.every((x) => x.u === vs[0].u);
  const q = sameU ? vs.map((x) => noteFmt(x.v, x.u)).join("–") : vs.map((x) => noteFmt(x.v, x.u) + " " + x.u).join("–");
  return { q: q + (p.rest ? " " + p.rest : ""), u: sameU ? u : "" };
}
/* French typography for display (already-escaped text): no line break inside "180 °C", "25 min", before ":" "?" "!" ";" */
const noteTy = (h) => String(h).replace(/(\d) (?=(°|%|€|g\b|kg\b|cl\b|ml\b|L\b|min\b|minutes?\b|secondes?\b|s\b|h\b|heures?\b|jours?\b|cm\b|mm\b))/g, "$1 ").replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ").replace(/(\d) (\d{3})\b/g, "$1 $2");
const noteLinkify = (h) => String(h).replace(/(\+33\s?[1-9]|\b0[1-9])((?:[\s.-]?\d{2}){4})\b/g, (m) => `<a class="nt-tel" href="tel:${m.replace(/[^\d+]/g, "")}">${m}</a>`);

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
/* wording follows the device: "Touchez" on touch screens, "Cliquez sur" with a mouse */
const notePointer = () => { try { return matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) { return false; } };
const noteTap = (what) => (notePointer() ? `Cliquez sur ${what}` : `Touchez ${what}`);
const noteIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const notePlural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

/* ───────── list ───────── */
function noteCard(n, i) {
  const k = noteKind(n); const tab = NOTE_TABS.find((t) => t[0] === k); const steps = noteSteps(n); const ings = n.ingredients || []; const al = k === "Recettes" ? recipeAllergens(n) : [];
  const meta = k === "Recettes" ? [ings.length ? notePlural(ings.length, "ingrédient") : "", n.portions ? notePlural(n.portions, "portion") : "", steps.length ? notePlural(steps.length, "étape") : ""].filter(Boolean)
    : k === "Procédures" ? (steps.length ? [notePlural(steps.length, "étape")] : []) : [];
  const excerpt = k === "Notes" ? String(n.body || "").trim() : k === "Recettes" ? ings.map((g) => g.name).filter(Boolean).join(", ") : noteIntro(n) || steps[0] || "";
  return `<div class="nt-card glass st" style="--i:${Math.min(i + 4, 14)}" role="button" tabindex="0" data-go="fiche" data-id="${esc(n.id)}">
    <div class="nt-thumb k-${k === "Recettes" ? "r" : k === "Procédures" ? "p" : "n"}">${n.photo ? `<img src="${esc(n.photo)}" alt="" loading="lazy">` : ico(tab[1])}</div>
    <div class="nt-cbody"><b class="nt-ctitle">${esc(n.title || "Sans titre")}</b>
      ${meta.length ? `<span class="nt-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join(" · ")}</span>` : ""}
      ${excerpt ? `<span class="nt-excerpt">${esc(excerpt)}</span>` : ""}
      ${k === "Recettes" ? noteCardFoot(n) : ""}
    </div><span class="nt-chev">${ico("chev")}</span></div>`;
}
function noteListHTML() {
  const q = noteNorm(S.noteQ); const tab = S.noteCat;
  const list = S.notes.filter((n) => (q ? noteMatch(n, q) : noteKind(n) === tab)).sort((a, b) => (b.updatedAt || b.at || 0) - (a.updatedAt || a.at || 0));
  const miss = noteMissingStarter();
  const starter = !q && tab === "Procédures" && miss.length ? `<div class="glass nt-starter st" style="--i:4"><div class="ic ok">${ico("sparkle")}</div><div style="flex:1;min-width:0"><b class="h3">${miss.length === NOTE_STARTER.length ? "Les 4 procédures HACCP essentielles" : `${notePlural(miss.length, "procédure")} HACCP à ajouter`}</b><p class="note" style="margin:3px 0 0">${miss.map((p) => esc(p.title)).join(" · ")}. Rédigées en français clair, modifiables.</p></div><button class="btn acc sm" data-act="noteSeed">${ico("plus")}Ajouter</button></div>` : "";
  const head = q ? `<div class="sub">${notePlural(list.length, "résultat")} pour « ${esc(S.noteQ.trim())} »</div>` : "";
  const empty = list.length ? "" : q ? `<div class="glass empty"><div class="ic">${ico("search")}</div><b>Aucun résultat</b>Essayez un autre mot : un ingrédient, un allergène, une étape.</div>`
    : tab === "Recettes" ? `<div class="glass empty st" style="--i:5"><div class="ic">${ico("ntChef")}</div><b>Aucune fiche recette</b>Ingrédients, grammages, portions, étapes et allergènes, au même endroit.<div style="margin-top:14px"><button class="btn acc sm" data-act="noteNew" data-v="Recettes">${ico("plus")}Créer une recette</button></div></div>`
    : tab === "Procédures" ? (starter ? "" : `<div class="glass empty st" style="--i:5"><div class="ic ok">${ico("shield")}</div><b>Aucune procédure</b>Écrivez vos méthodes de nettoyage, de réception, d'hygiène.</div>`)
    : `<div class="glass empty st" style="--i:5"><div class="ic">${ico("ntNote")}</div><b>Aucune note</b>Infos pour l'équipe, contacts, rappels.<div style="margin-top:14px"><button class="btn acc sm" data-act="noteNew" data-v="Notes">${ico("plus")}Écrire une note</button></div></div>`;
  const extra = !q && tab === "Recettes" ? noteProcListHTML() : "";
  return `${head}${starter}${extra}${list.length ? `<div class="nt-grid">${list.map(noteCard).join("")}</div>` : ""}${empty}`;
}
function noteListPaint(anim) { const L = $("#noteList"); if (!L) return; L.innerHTML = noteListHTML(); if (!anim) $$(".st", L).forEach((e) => (e.style.animation = "none")); }
VIEWS.notes = {
  render() {
    if (!NOTE_TABS.some((t) => t[0] === S.noteCat)) S.noteCat = S.noteCat === "Hygiène" ? "Procédures" : "Recettes";
    const ix = NOTE_TABS.findIndex((t) => t[0] === S.noteCat); const cnt = (k) => S.notes.filter((n) => noteKind(n) === k).length;
    return `<div class="inner wide nt-wrap">${topBar("Recettes & procédures", { right: `<button class="btn acc sm" data-act="noteNew">${ico("plus")}Nouvelle</button>` })}
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
const notePortCur = (n) => { const base = num(n.portions); const P = S.ui.notePortions?.[n.id]; return P ?? (base && base > 0 ? base : 1); };
function noteIngHTML(n) {
  const base = num(n.portions); const k = base && base > 0 ? notePortCur(n) / base : notePortCur(n);
  return (n.ingredients || []).map((g) => { const s = noteScale(g.qty, g.unit, k); const L = noteIngLink(g); const ga = noteIngAl(g);
    return `<li class="${L ? "lk" : ""}"><span class="nt-iname">${L ? `<i class="nt-ilk" title="${L.t === "p" ? "Suivi en stock" : "Sous-recette"}">${ico(L.t === "p" ? "box" : "ntChef")}</i>` : ""}<span>${esc(g.name)}${ga.on.length || ga.sug.length ? `<em class="nt-ial">${esc([...ga.on.map(noteAllergenLabel), ...ga.sug.map((x) => noteAllergenLabel(x) + " ?")].join(" · "))}</em>` : ""}</span></span><span class="nt-lead"></span><b class="nt-iqty mono">${esc(s.q)}${s.u ? `<small>${esc(s.u)}</small>` : ""}</b></li>`; }).join("");
}
const notePortW = (s) => `${Math.max(1, String(s).length) + 0.3}ch`;
function noteScalerHTML(n) {
  const base = num(n.portions); const v = notePortCur(n); const sv = noteNum(v);
  if (base && base > 0) {
    const quick = [...new Set([Math.max(1, Math.round(base / 2)), base, base * 2, 10, 20, 50])].sort((a, b) => a - b).slice(0, 6);
    return `<div class="nt-scaler"><button class="iconbtn nt-step" data-act="notePort" data-v="-1" aria-label="Une portion de moins">${ico("minus")}</button><label class="nt-pval"><input class="mono" id="ntPort" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${sv}" style="width:${notePortW(sv)}" aria-label="Nombre de portions"><span id="ntPortLbl">${v >= 2 ? "portions" : "portion"}</span></label><button class="iconbtn nt-step" data-act="notePort" data-v="1" aria-label="Une portion de plus">${ico("plus")}</button></div>
      <div class="nt-quick">${quick.map((x) => `<button class="chip ${x === v ? "on" : ""} ${x === base ? "base" : ""}" data-act="notePortSet" data-v="${x}">${noteNum(x)}${x === base ? "<em>fiche</em>" : ""}</button>`).join("")}</div>`;
  }
  return `<div class="nt-scaler"><button class="iconbtn nt-step" data-act="notePort" data-v="-1" aria-label="Moins">${ico("minus")}</button><label class="nt-pval"><span>×</span><input class="mono" id="ntPort" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${sv}" style="width:${notePortW(sv)}" aria-label="Multiplier la recette"></label><button class="iconbtn nt-step" data-act="notePort" data-v="1" aria-label="Plus">${ico("plus")}</button></div>`;
}
function noteRefreshScale(id, fromInput) {
  const n = S.notes.find((x) => x.id === id); if (!n) return;
  const L = $("#ntIngs"); if (L) { L.innerHTML = noteIngHTML(n); $$(".nt-iqty", L).forEach((e) => { e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }); }
  const v = notePortCur(n);
  $$(".nt-quick .chip").forEach((c) => c.classList.toggle("on", +c.dataset.v === v));
  const lab = $("#ntPortLbl"); if (lab) lab.textContent = v >= 2 ? "portions" : "portion";
  const i = $("#ntPort"); if (i) { if (!fromInput) { i.value = noteNum(v); i.classList.remove("bump"); void i.offsetWidth; i.classList.add("bump"); } i.style.width = notePortW(i.value); i.classList.remove("bad"); }
}
function noteRunHTML(n, steps, intro = "") {
  const R = S.ui.noteRun?.id === n.id ? S.ui.noteRun : { done: [] }; const done = R.done.length; const cur = steps.findIndex((_, i) => !R.done.includes(i));
  return `<div class="nt-pcols"><div class="nt-pside">${intro}<div class="glass pad nt-runbar st" style="--i:3"><div class="hstack" style="justify-content:space-between"><span class="lbl">Étape par étape</span><span class="mono nt-runct"><b>${done}</b> / ${steps.length}</span></div><div class="nt-prog"><i style="width:${steps.length ? (done / steps.length) * 100 : 0}%"></i></div><p class="note nt-runhint" style="margin:8px 0 0">Cochez chaque étape quand elle est faite.</p></div></div>
    <div class="nt-pmain"><ol class="nt-run">${steps.map((s, i) => `<li class="st ${R.done.includes(i) ? "done" : ""} ${i === cur ? "cur" : ""}" style="--i:${Math.min(i + 4, 14)}"><button data-act="noteTick" data-id="${esc(n.id)}" data-v="${i}" aria-pressed="${R.done.includes(i)}"><span class="nt-box">${ico("check")}</span><span class="nt-rnum mono">${i + 1}</span><span class="nt-rtx">${noteTy(esc(s))}</span></button></li>`).join("")}</ol>
    <div class="glass nt-runend" ${done && done === steps.length ? "" : "hidden"}><div class="check draw">${ico("check")}</div><b class="h3">Procédure terminée</b><span class="note">C'est noté dans le registre.</span><button class="btn soft sm" data-act="noteRunReset" data-id="${esc(n.id)}">${ico("ntReset")}Recommencer</button></div></div></div>`;
}
VIEWS.fiche = {
  render({ id }) {
    const n = S.notes.find((x) => x.id === id);
    if (!n) return `<div class="inner narrow nt-wrap">${topBar("Fiche")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("book")}</div><b>Fiche introuvable</b>Elle a peut-être été supprimée.</div></div>`;
    const k = noteKind(n); const steps = noteSteps(n); const intro = noteIntro(n); const ings = n.ingredients || []; const al = n.allergens || [];
    const pill = k === "Recettes" ? `<span class="nt-pills"><span class="pill acc">${ico("ntChef")}Recette</span>${n.carte ? `<span class="pill ok">${ico("ntMenu")}À la carte · ${esc(noteCarteCat(n.carteCat))}${num(n.price) ? ` · ${esc(noteEur(n.price))}` : ""}</span>` : ""}</span>` : k === "Procédures" ? `<span class="pill ok">${ico("shield")}Procédure</span>` : `<span class="pill neu">${ico("ntNote")}Note</span>`;
    const hero = `<div class="nt-hero st ${n.photo ? "has-ph" : ""}" style="--i:1">${n.photo ? `<div class="nt-photo"><img src="${esc(n.photo)}" alt=""></div>` : ""}<div class="nt-htx">${pill}<h1 class="nt-title">${esc(n.title || "Sans titre")}</h1><span class="who">${avatar(n.uid, true)}${esc(firstName(nameOf(n.uid)))} · modifié ${when(n.updatedAt || n.at)}</span></div></div>`;
    const top = `<div class="top st" style="--i:0"><button class="iconbtn" data-act="back" aria-label="Retour">${ico("back")}</button><span class="h2"></span><button class="btn soft sm" data-act="noteEdit" data-id="${esc(n.id)}">${ico("edit")}Modifier</button></div>`;
    const stepsHTML = steps.length ? `<div class="glass pad st" style="--i:4"><span class="lbl">Étapes</span><ol class="nt-steps">${steps.map((s, i) => `<li><span class="nt-snum mono">${i + 1}</span><span>${noteTy(esc(s))}</span></li>`).join("")}</ol></div>` : "";
    const introHTML = (lbl, i) => (intro ? `<div class="glass pad st nt-intro" style="--i:${i}"><span class="lbl">${lbl}</span><p>${noteTy(esc(intro))}</p></div>` : "");
    if (k === "Recettes") {
      const alHTML = noteAlCardHTML(n);
      const tab = S.ui.noteTab?.[n.id] === "process" ? "process" : "fiche"; const PL = (n.process || []).length;
      const seg = `<div class="seg nt-seg nt-fseg st" style="--i:2"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "process" ? 100 : 0}%)"></span><button class="${tab === "fiche" ? "on" : ""}" data-act="noteFTab" data-id="${esc(n.id)}" data-v="fiche">${ico("ntChef")}<span>Fiche recette</span></button><button class="${tab === "process" ? "on" : ""}" data-act="noteFTab" data-id="${esc(n.id)}" data-v="process">${ico("ntFlow")}<span>Process HACCP</span>${PL ? `<em class="mono">${PL}</em>` : `<em class="ntp-todo">à faire</em>`}</button></div>`;
      if (tab === "process") return `<div class="inner wide nt-wrap">${top}${hero}${seg}<div id="ntFBody" class="nt-fbody">${noteProcTabHTML(n)}</div>${noteFilesHTML(n)}</div>`;
      return `<div class="inner wide nt-wrap">${top}${hero}${seg}<div id="ntFBody" class="nt-fbody">${alHTML}<div class="cols nt-cols"><div>
        <div class="glass pad st nt-ingcard" style="--i:3"><span class="lbl">${num(n.portions) ? "Pour combien de portions ?" : "Multiplier la recette"}</span>${noteScalerHTML(n)}
        ${ings.length ? `<ul class="nt-ings" id="ntIngs">${noteIngHTML(n)}</ul>` : `<p class="note" style="margin:0">Pas encore d'ingrédients. ${noteTap("« Modifier »")} pour les ajouter.</p>`}</div>
        </div><div>${stepsHTML || `<div class="glass pad st" style="--i:4"><span class="lbl">Étapes</span><p class="note" style="margin:6px 0 0">Pas encore d'étapes. ${noteTap("« Modifier »")} pour les écrire.</p></div>`}${introHTML("Conseils du chef", 5)}${noteCostHTML(n)}</div></div></div>${noteFilesHTML(n)}
        <div class="ctabar nt-usebar st" style="--i:9">${noteLastUseHTML(n)}<button class="btn acc block" data-act="noteUse" data-id="${esc(n.id)}">${ico("ntUse")}Utiliser la recette</button></div></div>`;
    }
    if (k === "Procédures") return `<div class="inner nt-wrap nt-pread">${top}${hero}${steps.length ? noteRunHTML(n, steps, introHTML("Quand et pourquoi", 2)) : `${introHTML("Quand et pourquoi", 2)}<div class="glass empty st" style="--i:3">Aucune étape. ${noteTap("« Modifier »")} pour les écrire.</div>`}${noteFilesHTML(n)}</div>`;
    return `<div class="inner nt-wrap nt-nread">${top}${hero}<div class="glass pad st nt-body" style="--i:2">${n.body ? noteLinkify(noteTy(esc(n.body))) : `<span class="note">Note vide.</span>`}</div>${noteFilesHTML(n)}</div>`;
  },
  after(v) {
    setTimeout(() => { const b = $('#side .nav[data-go="notes"]'); b && b.classList.add("on"); }, 0);
    noteFilesBind(v);
    const i = $("#ntPort", v); if (!i) return; const id = S.params.id;
    i.addEventListener("focus", () => setTimeout(() => i.select(), 0));
    i.addEventListener("input", () => {
      i.style.width = notePortW(i.value); const x = num(i.value);
      if (x != null && x > 0 && x <= 9999) { (S.ui.notePortions ||= {})[id] = Math.round(x * 100) / 100; noteRefreshScale(id, true); } else i.classList.toggle("bad", i.value.trim() !== "");
    });
    i.addEventListener("blur", () => { const n = S.notes.find((x) => x.id === id); if (!n) return; const want = noteNum(notePortCur(n)); if (i.value !== want) { if (i.classList.contains("bad")) { SFX.err(); buzz(20); } noteRefreshScale(id); } });
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") i.blur(); });
  },
};

/* ───────── editor ───────── */
function noteDraft(id) {
  const n = S.notes.find((x) => x.id === id);
  if (!n) { const cat = S.ui.noteNewCat || "Recettes"; return { _id: id, title: "", cat, body: "", ingredients: cat === "Recettes" ? [{ name: "", qty: "", unit: "g" }] : [], steps: cat === "Notes" ? [] : [""], portions: cat === "Recettes" ? 4 : "", allergens: [], alNo: [], carte: false, carteCat: "plat", price: "", photo: "" }; }
  const d = JSON.parse(JSON.stringify(n)); d._id = id; d.cat = noteKind(n);
  if (!Array.isArray(d.steps)) { if (d.cat === "Notes") d.steps = []; else { d.steps = noteSplit(d.body); d.body = ""; } }
  if (d.cat !== "Notes" && !d.steps.length) d.steps = [""];
  d.ingredients ||= []; d.allergens = [...new Set((d.allergens || []).map(noteAlId))]; d.alNo ||= []; d.photo ||= ""; d.portions ??= ""; d.carte = !!d.carte; d.carteCat ||= "plat"; d.price ??= "";
  ["id", "updatedAt", "uid", "at"].forEach((key) => delete d[key]); return d;
}
const noteSnap = (N) => JSON.stringify({ t: (N.title || "").trim(), c: N.cat, b: (N.body || "").trim(), i: (N.ingredients || []).filter((g) => String(g.name || "").trim()), s: (N.steps || []).filter((s) => s.trim()), p: String(N.portions ?? ""), a: [...(N.allergens || [])].sort(), no: [...(N.alNo || [])].sort(), k: N.cat === "Recettes" ? [!!N.carte, N.carte ? N.carteCat : "", String(N.price ?? "").trim()] : 0, ph: N.photo || "" });
VIEWS.note = {
  live: false,
  render({ id }) {
    if (!S.ui.note || S.ui.note._id !== id) { S.ui.note = noteDraft(id); S.ui.noteOrig = noteSnap(S.ui.note); }
    const N = S.ui.note; N.ingredients ||= []; N.steps ||= []; N.allergens ||= [];
    const isR = N.cat === "Recettes", isN = N.cat === "Notes"; const ix = NOTE_TABS.findIndex((t) => t[0] === N.cat);
    const photo = N.photo ? `<div class="nt-ephoto"><img src="${esc(N.photo)}" alt=""><div class="nt-ephbtn"><button class="btn soft sm" data-act="notePhoto">${ico("camera")}Changer</button><button class="btn soft sm" data-act="notePhotoDel" style="color:var(--bad)">${ico("trash")}Retirer</button></div></div>`
      : `<button class="nt-addph" data-act="notePhoto" ${S.ui.notePhBusy ? "disabled" : ""}>${ico(S.ui.notePhBusy ? "clock" : "camera")}<span>${S.ui.notePhBusy ? "Préparation de la photo…" : "Ajouter une photo"}</span><em>facultatif</em></button>`;
    const ingsHTML = `<div class="glass pad st nt-esec" style="--i:3"><div class="nt-ehead"><span class="lbl">Ingrédients</span>
        <label class="nt-eport"><span>Pour</span><input class="input mono nt-eportin" data-bind="ui.note.portions" inputmode="decimal" autocomplete="off" value="${esc(N.portions)}" placeholder="4" aria-label="Nombre de portions"><span>portions</span></label></div>
      <div class="nt-erows">${N.ingredients.map((g, i) => `<div class="nt-erow"><input class="input nt-n" data-bind="ui.note.ingredients.${i}.name" data-nkey="ing" data-i="${i}" value="${esc(g.name)}" placeholder="Ingrédient" aria-label="Ingrédient ${i + 1}" enterkeyhint="next"><input class="input mono nt-q" data-bind="ui.note.ingredients.${i}.qty" data-nkey="ing" data-i="${i}" inputmode="decimal" value="${esc(g.qty)}" placeholder="Qté" aria-label="Quantité" enterkeyhint="next"><input class="input nt-u" list="ntUnits" data-bind="ui.note.ingredients.${i}.unit" data-nkey="ing" data-i="${i}" value="${esc(g.unit)}" placeholder="g" aria-label="Unité" enterkeyhint="next"><button class="iconbtn nt-del" data-act="noteIngDel" data-v="${i}" aria-label="Retirer l'ingrédient">${ico("x")}</button>${noteELinkHTML(g, i)}</div>`).join("")}</div>
      <datalist id="ntUnits">${unitsFor(NOTE_UNITS).map((u) => `<option value="${esc(u)}">`).join("")}</datalist>
      <button class="btn ghost sm" data-act="noteIngAdd" style="align-self:flex-start">${ico("plus")}Ajouter un ingrédient</button></div>
      <div class="glass pad st nt-esec" style="--i:4"><span class="lbl">Allergènes</span><p class="note" style="margin:0">Ceux des ingrédients liés au stock s'ajoutent tout seuls. Touchez un allergène pour l'ajouter ou le confirmer.</p><div class="nt-als nt-alsed" id="ntAlEd">${noteAlEdHTML(N)}</div></div>
      ${noteCarteEdHTML(N)}`;
    const stepsHTML = `<div class="glass pad st nt-esec" style="--i:5"><span class="lbl">Étapes</span><div class="nt-esteps">${N.steps.map((s, i) => `<div class="nt-estep"><span class="nt-snum mono">${i + 1}</span><textarea class="input" rows="1" data-bind="ui.note.steps.${i}" data-nkey="step" data-i="${i}" enterkeyhint="next" placeholder="${i === 0 ? (isR ? "Ex. Mélanger le sucre, le sel et les baies roses." : "Ex. Débrancher la machine.") : "Étape suivante"}" aria-label="Étape ${i + 1}">${esc(s)}</textarea><button class="iconbtn nt-del" data-act="noteStepDel" data-v="${i}" aria-label="Retirer l'étape">${ico("x")}</button></div>`).join("")}</div>
      <button class="btn ghost sm" data-act="noteStepAdd" style="align-self:flex-start">${ico("plus")}Ajouter une étape</button><p class="note" style="margin:0">Astuce : la touche Entrée crée l'étape suivante.</p></div>`;
    const bodyHTML = isN ? `<div class="glass pad st nt-esec" style="--i:3"><span class="lbl">Contenu</span><textarea class="input nt-ebody" data-bind="ui.note.body" placeholder="Écrivez ici…">${esc(N.body)}</textarea></div>`
      : `<div class="glass pad st nt-esec" style="--i:6"><span class="lbl">${isR ? "Conseils du chef" : "Quand et pourquoi"}</span><textarea class="input" style="min-height:96px" data-bind="ui.note.body" placeholder="${isR ? "Dressage, conservation, astuces… (facultatif)" : "Fréquence, matériel, précautions… (facultatif)"}">${esc(N.body)}</textarea></div>`;
    const phHTML = !isN || N.photo ? `<div class="st" style="--i:2">${photo}</div>` : "";
    /* desktop: two columns (ingrédients | étapes), the title stays full width */
    const colsHTML = isN ? `${phHTML}${bodyHTML}` : isR ? `<div class="nt-ecols"><div>${phHTML}${ingsHTML}</div><div>${stepsHTML}${bodyHTML}</div></div>` : `<div class="nt-ecols"><div>${stepsHTML}</div><div>${phHTML}${bodyHTML}</div></div>`;
    return `<div class="inner nt-wrap nt-ed ${isN ? "nt-edn" : ""}"><div class="top st" style="--i:0"><button class="iconbtn" data-act="noteBack" aria-label="Retour">${ico("back")}</button><span class="h2">${id === "new" ? "Nouvelle fiche" : "Modifier la fiche"}</span>${id !== "new" ? `<button class="iconbtn" data-act="noteDel" aria-label="Supprimer la fiche" style="color:var(--bad)">${ico("trash")}</button>` : ""}</div>
      <div class="glass pad st nt-esec" style="--i:1"><textarea class="input nt-etitle" rows="1" data-bind="ui.note.title" enterkeyhint="done" placeholder="${isR ? "Nom de la recette" : isN ? "Titre de la note" : "Nom de la procédure"}" aria-label="Titre">${esc(N.title)}</textarea>
        <div class="seg nt-seg" id="ntESeg"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${ix * 100}%)"></span>${NOTE_TABS.map(([k, ic]) => `<button class="${N.cat === k ? "on" : ""}" data-act="noteSetCat" data-v="${k}">${ico(ic)}<span>${k === "Recettes" ? "Recette" : k === "Procédures" ? "Procédure" : "Note"}</span></button>`).join("")}</div></div>
      ${colsHTML}
      <div class="ctabar st" style="--i:7"><button class="btn acc block" data-act="noteSave">${ico("check")}Enregistrer</button></div></div>`;
  },
  after(v) {
    const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
    $$(".nt-estep textarea, textarea.nt-etitle", v).forEach((t) => { grow(t); t.addEventListener("input", () => grow(t)); });
    const T = $("textarea.nt-etitle", v);
    if (T) { /* the title is one line that wraps: Enter closes the keyboard, pasted line breaks become spaces */
      T.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); T.blur(); } });
      T.addEventListener("input", () => { if (/\n/.test(T.value)) { T.value = T.value.replace(/\s*\n+\s*/g, " "); S.ui.note.title = T.value; grow(T); } });
    }
    if (!v._ntKeys) v._ntKeys = 1, v.addEventListener("keydown", (e) => {
      const t = e.target; if (S.route !== "note" || e.key !== "Enter" || e.shiftKey || !t.dataset.nkey || e.isComposing) return;
      const i = +t.dataset.i; e.preventDefault();
      if (t.dataset.nkey === "step") { S.ui.note.steps.splice(i + 1, 0, ""); S.ui.noteFocus = `[data-nkey=step][data-i="${i + 1}"]`; noteRer(); return; }
      const ins = $$("input", t.closest(".nt-erow")); const k = ins.indexOf(t); if (k < ins.length - 1) { ins[k + 1].focus(); return; }
      const L = S.ui.note.ingredients; if (i === L.length - 1) L.push({ name: "", qty: "", unit: "g" }); S.ui.noteFocus = `.nt-n[data-i="${i + 1}"]`; noteRer();
    });
    const alRe = debounce(() => { const g = $("#ntAlEd", v); if (g && S.ui.note) g.innerHTML = noteAlEdHTML(S.ui.note); }, 250);
    $$(".nt-erow .nt-n", v).forEach((t) => t.addEventListener("input", alRe));
    if (S.ui.noteFocus) { const f = $(S.ui.noteFocus, v); S.ui.noteFocus = null; if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "center", behavior: "smooth" }); } }
  },
};
const noteRer = () => { const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); rerender(); const v = $("#viewport .view:not(.leave)"); v && $$(".st", v).forEach((e) => (e.style.animation = "none")); };
function noteSegMove(segId, v) { const seg = $("#" + segId); if (!seg) return; const ix = NOTE_TABS.findIndex((t) => t[0] === v); $$("button", seg).forEach((b) => { b.classList.toggle("on", b.dataset.v === v); b.classList.remove("dim"); }); $(".knob", seg).style.transform = `translateX(${ix * 100}%)`; }
const noteDirty = () => !!S.ui.note && noteSnap(S.ui.note) !== S.ui.noteOrig;
const noteGuardDirty = () => (S.route === "note" && noteDirty()) || (S.route === "noteProc" && npDirty());
function noteAskLeave() {
  const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur();
  openSheet(`<div class="h2" style="font-size:20px">Enregistrer les modifications ?</div><p class="sub" style="margin:0">Sinon, elles seront perdues.</p><div class="grid2"><button class="btn soft" data-act="noteDiscard" style="color:var(--bad)">Ne pas enregistrer</button><button class="btn acc" data-act="noteSaveFromSheet">${ico("check")}Enregistrer</button></div>`);
}
/* leaving the editor any other way (side nav on tablet / desktop, profile) asks first; closing the tab warns too */
document.addEventListener("click", (e) => {
  if (!noteGuardDirty()) return; const g = e.target.closest("[data-go],[data-tab]"); if (!g || g.closest("#viewport .view:not(.leave)") || g.closest("#sheet")) return;
  e.preventDefault(); e.stopPropagation(); const route = g.dataset.go || g.dataset.tab; const params = g.dataset.id ? { id: g.dataset.id } : {};
  S.ui.notePending = { route, params }; SFX.tap(); noteAskLeave();
}, true);
window.addEventListener("beforeunload", (e) => { if (noteGuardDirty()) { e.preventDefault(); e.returnValue = ""; } });
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
    const cur = notePortCur(n); const step = base && base > 0 ? 1 : 0.5;
    let nx = +v > 0 ? Math.floor(cur / step + 1e-9) * step + step : Math.ceil(cur / step - 1e-9) * step - step; /* 2,5 + 1 → 3, 2,5 − 1 → 2 */
    nx = Math.min(9999, Math.max(step, Math.round(nx * 100) / 100));
    if (nx === cur) { SFX.err(); buzz(20); const i = $("#ntPort"); if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); } return; }
    S.ui.notePortions[pid] = nx; SFX.tick(); buzz(5); noteRefreshScale(pid);
  },
  notePortSet: (a, id, v) => { const pid = S.params.id; (S.ui.notePortions ||= {})[pid] = +v; SFX.tick(); buzz(5); noteRefreshScale(pid); },
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
  noteAl: (a, id, v) => {
    const N = S.ui.note; const L = N.allergens; const D = noteAlDetail(N)[v];
    if (D && D.from.length && !L.includes(v)) { SFX.tap(); toast(`Vient de : ${D.from.join(", ")}`); return; }
    const on = !L.includes(v); if (on) { L.push(v); N.alNo = (N.alNo || []).filter((x) => x !== v); } else { L.splice(L.indexOf(v), 1); if (D && D.sug.length) (N.alNo ||= []).push(v); }
    const g = $("#ntAlEd"); if (g) g.innerHTML = noteAlEdHTML(N); const b = g && $(`[data-v="${v}"]`, g); if (b && on) b.classList.add("pop");
    SFX.tick(); buzz(5);
  },
  notePhoto: async () => {
    const [f] = await pickImage(); if (!f) return; const N = S.ui.note; S.ui.notePhBusy = true; noteRer();
    try { const r = await notePhotoUrl(f); if (S.ui.note === N) { N.photo = r.url; N.photoId = r.id; SFX.ok(); } } catch (e) { console.warn(e); if (S.ui.note === N) { SFX.err(); toast("Photo illisible. Essayez une autre image.", "err"); } }
    S.ui.notePhBusy = false; if (S.route === "note" && S.ui.note === N) noteRer();
  },
  notePhotoDel: () => { S.ui.note.photo = ""; S.ui.note.photoId = ""; SFX.close(); noteRer(); },
  noteBack: () => { S.ui.notePending = null; if (!noteDirty()) { SFX.tap(); noteLeave(); return; } noteAskLeave(); },
  noteDiscard: () => {
    closeSheet(true); const p = S.ui.notePending; S.ui.notePending = null;
    const proc = S.route === "noteProc"; S.ui.np = null; SFX.close();
    if (p) { S.ui.note = null; S.ui.noteNewCat = null; go(p.route, p.params, { replace: true }); } else if (proc) goBack(); else noteLeave();
  },
  noteSaveFromSheet: () => { closeSheet(true); S.ui.noteFromSheet = true; const b = $("#viewport .view:not(.leave) [data-act=noteSave], #viewport .view:not(.leave) [data-act=npSave]"); if (b && !b.disabled) b.click(); },
  noteSave: async (a) => {
    const N = S.ui.note; const id = N._id; const isR = N.cat === "Recettes", isN = N.cat === "Notes";
    if (!N || a.disabled) return;
    if (S.ui.notePhBusy) { SFX.err(); toast("Un instant : la photo se prépare."); return; }
    const title = String(N.title || "").replace(/\s+/g, " ").trim(); const por = num(N.portions);
    if (!title) { SFX.err(); buzz(30); toast("Donnez un titre à la fiche.", "err"); const t = $(".nt-etitle"); if (t) { t.focus(); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); } return; }
    if (isR && !(por > 0 && por <= 9999)) { SFX.err(); buzz(30); toast("Indiquez les portions.", "err"); const t = $(".nt-eportin"); if (t) { t.scrollIntoView({ block: "center", behavior: "smooth" }); t.focus({ preventScroll: true }); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); } return; }
    const d = { title, cat: N.cat, body: String(N.body || "").trim(), updatedAt: Date.now(), uid: S.me.id,
      ingredients: isR ? (N.ingredients || []).filter((g) => String(g.name || "").trim() || g.productId || g.noteId).map((g) => noteIngClean(g)) : [],
      steps: isN ? [] : (N.steps || []).map((s) => String(s || "").trim()).filter(Boolean),
      allergens: isR ? N.allergens || [] : [], portions: isR ? Math.round(por * 100) / 100 : 1, photo: N.photo || "", photoId: N.photoId || "" };
    if (isR) { const pr = num(N.price); Object.assign(d, { alNo: (N.alNo || []).filter((x) => !d.allergens.includes(x)), carte: !!N.carte, carteCat: N.carteCat || "plat", price: pr > 0 ? Math.round(pr * 100) / 100 : null }); }
    a.disabled = true;
    try {
      let nid = id;
      if (id === "new") { d.at = Date.now(); nid = await safe(DB.add("notes", d)); await logEvent("note", `a créé la fiche « ${d.title} »`, { ref: nid }); }
      else { await safe(DB.update("notes", id, d)); await logEvent("note", `a modifié la fiche « ${d.title} »`, { ref: id }); }
      S.noteCat = d.cat; SFX.ok(); buzz(10); toast("Fiche enregistrée");
      const p = S.ui.noteFromSheet ? S.ui.notePending : null; S.ui.notePending = null; S.ui.noteFromSheet = false; /* a sheet dismissed by the scrim leaves no pending route */
      if (p) { S.ui.note = null; S.ui.noteNewCat = null; go(p.route, p.params, { replace: true }); }
      else if (id === "new") { S.ui.note = null; S.ui.noteNewCat = null; go("fiche", { id: nid }, { replace: true }); }
      else noteLeave();
    } catch (e) { a.disabled = false; }
  },
  noteDel: () => { openSheet(`<div class="h2" style="font-size:20px">Supprimer cette fiche ?</div><p class="sub" style="margin:0">Elle disparaît pour toute l'équipe. Impossible d'annuler.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="noteDelOk">${ico("trash")}Supprimer</button></div>`); },
  noteDelOk: async () => {
    closeSheet(true); if (!S.ui.note || S.ui.noteDeleting) return; S.ui.noteDeleting = true; const id = S.ui.note._id; const t = S.ui.note.title;
    try { await safe(DB.del("notes", id)); } catch (e) { S.ui.noteDeleting = false; return; } finally { setTimeout(() => (S.ui.noteDeleting = false), 600); }
    await logEvent("note", `a supprimé la fiche « ${t || "Sans titre"} »`, { ref: id });
    S.ui.note = null; S.history = S.history.filter((h) => !(h.params && h.params.id === id)); SFX.close(); toast("Fiche supprimée"); goBack();
  },
});


/* ═════════ Process HACCP (diagramme de fabrication), export PDF, documents joints ═════════
   Recipe doc fields (all optional, backward compatible):
   process: [{k: step type, t: title, x: instruction, c: {l: limite critique, m: surveillance, a: action corrective} | null}]
   processV: number (version, +1 at each save) · processAt: ts · processBy: uid
   files: [{id, name, type, size, at, uid}]  (the bytes live on this device, IndexedDB "gg-notes-files") */
Object.assign(IC, {
  ntFlow: ["M5 3h6v5H5z", "M13 16h6v5h-6z", "M8 8v4a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2"],
  ntHand: ["M18 11V6a2 2 0 0 0-4 0v1", "M14 10V4a2 2 0 0 0-4 0v2", "M10 10.5V6a2 2 0 0 0-4 0v8", "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"],
  ntFlame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  ntDrop: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"],
  ntUp: ["m18 15-6-6-6 6"],
  ntDown: ["m6 9 6 6 6-6"],
  ntClip: ["m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"],
  ntFile: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M9 15h6", "M9 11h2"],
  ntCarrot: ["M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7z", "M8.64 14l-2.05-2.04", "M15.34 15l-2.46-2.46", "M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z", "M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"],
  ntUtensils: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"],
  ntBowl: ["M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z", "M7 21h10", "M19.5 12 22 6"],
  ntPlate: ["M3 17h18", "M12 7a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8Z", "M12 7V5", "M10 5h4"],
});
TAB_OF.noteProc = "more"; TAB_OF.noteDoc = "more";

/* step library: [type, icon, title, instruction, CCP [limite, surveillance, action] | null] */
const NOTE_PLIB = [
  ["reception", "truck", "Réception des marchandises", "Contrôler la température, la DLC et l'emballage de chaque produit à la livraison.", ["Frais 0 à +4 °C · surgelés ≤ -18 °C · DLC valide", "Thermomètre sonde, lecture des étiquettes", "Refuser le produit et le noter sur le bon de livraison"], 1],
  ["stockage", "box", "Stockage", "Ranger aussitôt : froid 0 à +4 °C, surgelés à -18 °C, épicerie au sec. Premier entré, premier sorti.", ["Froid positif 0 à +4 °C", "Relevé des frigos 2 fois par jour", "Déplacer les produits, appeler le technicien, jeter si besoin"]],
  ["fiche", "book", "Lecture de la fiche recette", "Lire la fiche : ingrédients, grammages, allergènes et étapes.", null],
  ["mains", "ntHand", "Lavage des mains", "Savon bactéricide 30 secondes, rinçage, essuie-mains à usage unique.", null],
  ["ustensiles", "ntUtensils", "Préparation des ustensiles", "Ustensiles, planches et plan de travail lavés, propres et désinfectés.", null],
  ["legumes", "ntDrop", "Lavage et désinfection des légumes", "Bain javellisé (dose et temps indiqués sur le produit), puis rinçage abondant à l'eau potable.", ["Dose et temps de contact du produit respectés", "Dose mesurée, minuteur", "Refaire le bain puis le rinçage"], 1],
  ["epluchage", "ntCarrot", "Épluchage", "Éplucher sur un plan propre, à l'écart des produits cuits.", null],
  ["decoupe", "scissors", "Découpe", "Sur une planche propre réservée au produit. Se laver les mains après chaque découpe.", null],
  ["lavust", "spray", "Lavage des ustensiles", "Laver, rincer et désinfecter couteaux, planches et bacs avant de passer au cuit.", null],
  ["assemblage", "ntBowl", "Marinade / assemblage", "Assembler au froid, filmer et étiqueter avec la date.", ["Au froid, 0 à +3 °C", "Étiquette avec la date et l'heure", "Jeter si le produit est resté hors du froid"]],
  ["cuisson", "ntFlame", "Cuisson", "Cuire jusqu'à cœur.", ["≥ +63 °C à cœur", "Sonde à cœur", "Prolonger la cuisson"]],
  ["duree", "clock", "Temps de cuisson", "Respecter le temps de cuisson indiqué sur la fiche.", null],
  ["temp", "therm", "Prise de température en fin de cuisson", "Sonde désinfectée au cœur du produit, valeur notée.", ["≥ +63 °C à cœur", "Sonde, valeur notée dans le registre", "Poursuivre la cuisson puis reprendre la température"], 1],
  ["refroid", "snow", "Refroidissement rapide en cellule", "En cellule dès la fin de cuisson, en bacs peu épais. Noter la température et l'heure au début et à la fin.", ["De +63 °C à +3 °C en moins de 2 h", "Température et heure notées au début et à la fin", "Au-delà de 2 h : jeter le produit"], 1],
  ["froid", "snow", "Stockage au froid", "Filmé, étiqueté avec la date de fabrication et la DLC.", ["0 à +3 °C · étiquette et DLC", "Relevé des frigos, lecture des étiquettes", "Jeter si DLC dépassée ou température non conforme"], 1],
  ["remise", "ntFlame", "Remise en température", "Réchauffer rapidement, une seule fois.", ["≥ +63 °C à cœur en moins d'1 h", "Sonde et heure", "Si la température n'est pas atteinte en 1 h : jeter"], 1],
  ["chaud", "therm", "Maintien au chaud", "Bain-marie ou étuve jusqu'au service.", ["≥ +63 °C", "Sonde toutes les heures", "Remettre en température ou jeter"], 1],
  ["service", "ntPlate", "Service", "Dresser avec des ustensiles propres et servir sans attendre.", null],
  ["libre", "edit", "Autre étape", "", null],
];
/* the 6th field marks the steps that are a CCP by default; the others keep a suggested control for when the chef turns CCP on */
const noteLib = (k) => { const L = NOTE_PLIB.find((x) => x[0] === k) || NOTE_PLIB[NOTE_PLIB.length - 1]; return { k: L[0], ic: L[1], t: L[2], x: L[3], c: L[4], on: !!L[5] }; };
const noteStep = (k, t, x, c) => { const L = noteLib(k); const cc = c === undefined ? (L.on ? L.c : null) : c; return { k: L.k, t: t || L.t, x: x ?? L.x, c: cc ? { l: cc[0], m: cc[1], a: cc[2] } : null }; };

/* generator: a standard process built from the recipe */
const NOTE_VEG = /carott|oignon|echalot|ail\b|celeri|poireau|champignon|pomme de terre|patate|legume|tomate|courgette|aubergine|poivron|persil|ciboulette|cerfeuil|basilic|coriandre|salade|topinambour|navet|panais|chou|epinard|haricot vert|petit pois|radis|betterave|fenouil|asperge|courge|potiron|herbe|thym|laurier|citron|orange|pomme\b|poire|fraise|framboise|fruit/;
const NOTE_PROT = /boeuf|veau|porc|agneau|mouton|volaille|poulet|canard|dinde|pintade|lapin|viande|paleron|joue|filet|cote|entrecote|lardon|jambon|saucisse|poisson|cabillaud|saumon|thon|bar\b|dorade|merlu|lieu|truite|sole|crevette|gambas|moule|saint-jacques|calamar|seiche|poulpe|crustace|homard|langoustine/;
const NOTE_COOK = /cui[rst]|cuisson|four|roti|rotir|frire|frit|friture|poel|mijot|brais|saut|bouill|grill|confi|blanch|rissol|saisir|frem|reduire|caramel|\d\s*°c/;
const noteIngNames = (n, re) => (n.ingredients || []).map((g) => String(g.name || "").trim()).filter((s) => s && re.test(noteNorm(s)));
const noteCooked = (n) => NOTE_COOK.test(noteNorm([n.title, ...noteSteps(n)].join(" ")));
const noteList = (a) => { const s = a.slice(0, 6).map((x) => x.toLowerCase()); return s.length > 1 ? s.slice(0, -1).join(", ") + " et " + s[s.length - 1] : s[0] || ""; };
function noteProcGen(n, mode) {
  const veg = noteIngNames(n, NOTE_VEG), prot = noteIngNames(n, NOTE_PROT); const cooked = noteCooked(n);
  const hay = noteNorm(noteSteps(n).join(" ")); const names = (n.ingredients || []).map((g) => g.name).filter(Boolean);
  const P = [noteStep("reception", "", names.length ? `Contrôler température, DLC et emballage : ${noteList(names)}${names.length > 6 ? "…" : "."}` : undefined), noteStep("stockage"), noteStep("fiche"), noteStep("mains"), noteStep("ustensiles")];
  if (veg.length) {
    P.push(noteStep("legumes", "", `${noteList(veg).replace(/^./, (c) => c.toUpperCase())} : bain javellisé (dose et temps indiqués sur le produit), puis rinçage abondant à l'eau potable.`));
    P.push(noteStep("epluchage"), noteStep("decoupe", "Découpe des légumes"), noteStep("mains", "Lavage des mains", "Après la découpe des légumes."));
  }
  if (prot.length) P.push(noteStep("decoupe", `Découpe : ${noteList(prot)}`, "Sur la planche réservée au cru, à l'écart des légumes prêts."), noteStep("mains", "Lavage des mains", "Après la découpe du produit cru."));
  P.push(noteStep("lavust"));
  if (/marin|assembl|melang|monter|farcir|dresser au froid/.test(hay)) P.push(noteStep("assemblage"));
  if (cooked) {
    P.push(noteStep("cuisson", "", "Cuire jusqu'à cœur, en suivant la fiche recette."), noteStep("temp"));
    if (mode === "avance") P.push(noteStep("refroid"), noteStep("froid"), noteStep("remise"), noteStep("chaud"));
  } else P.push(noteStep("froid", "Stockage au froid jusqu'au service"));
  P.push(noteStep("service"));
  return P;
}

/* starter example: Bœuf bourguignon, the owner's sequence */
function noteBourguignon() {
  const S_ = noteStep;
  return {
    title: "Bœuf bourguignon", cat: "Recettes", seed: "bourguignon", portions: 8, allergens: ["gluten", "lait", "sulfites"],
    body: "Meilleur réchauffé le lendemain. Servir avec des pommes vapeur ou des tagliatelles fraîches.",
    ingredients: [["Paleron de bœuf", "1,6", "kg"], ["Vin rouge de Bourgogne", "75", "cl"], ["Carottes", "500", "g"], ["Oignons", "300", "g"], ["Ail", "3", "gousse"], ["Bouquet garni", "1", "pièce"], ["Lardons fumés", "200", "g"], ["Champignons de Paris", "300", "g"], ["Oignons grelots", "200", "g"], ["Farine", "30", "g"], ["Fond de veau", "50", "cl"], ["Beurre", "40", "g"], ["Huile", "3", "c. à s."], ["Sel, poivre", "", "pincée"]].map(([name, qty, unit]) => ({ name, qty, unit })),
    steps: ["Couper le bœuf en cubes de 5 cm.", "Mariner 12 h au froid avec le vin, les carottes, les oignons, l'ail et le bouquet garni.", "Égoutter et sécher la viande. Garder la marinade.", "Saisir la viande dans l'huile, singer avec la farine.", "Mouiller avec la marinade et le fond de veau, porter à ébullition.", "Cuire 3 h à frémissement, à couvert.", "Rissoler lardons, champignons et oignons grelots au beurre, ajouter en fin de cuisson.", "Rectifier l'assaisonnement."],
    process: [
      S_("reception", "", "Contrôler température, DLC et emballage : bœuf, lardons, fond de veau, légumes."),
      S_("stockage"),
      S_("fiche"),
      S_("mains"),
      S_("ustensiles", "Préparation des ustensiles lavés et propres"),
      S_("legumes", "Lavage des légumes à la javel + rinçage", "Carottes, oignons, ail, champignons : bain javellisé (dose et temps indiqués sur le produit), puis rinçage abondant à l'eau potable."),
      S_("epluchage", "", "Carottes, oignons, ail, oignons grelots."),
      S_("decoupe", "Découpe des légumes", "Lavage des mains après chaque découpe."),
      S_("mains", "", "Après la découpe des légumes."),
      S_("lavust"),
      S_("decoupe", "Découpe du bœuf", "Cubes de 5 cm, sur la planche rouge réservée à la viande crue."),
      S_("mains", "", "Après la découpe de la viande crue."),
      S_("assemblage", "Marinade", "Bœuf, vin et garniture aromatique : 12 h au froid, filmé et étiqueté."),
      S_("cuisson", "Cuisson du bœuf", "Saisir, singer, mouiller puis mijoter à couvert."),
      S_("duree", "", "3 h à frémissement."),
      S_("temp"),
      S_("refroid", "Mise en cellule de refroidissement"),
      S_("froid", "Stockage"),
      S_("remise"),
      S_("chaud"),
      S_("service"),
    ],
  };
}

/* ───────── documents joints (PDF, photos): bytes on this device ───────── */
const NOTE_FILES = {
  _db: null, urls: {},
  open() {
    return (this._db ||= new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no indexedDB"));
      const r = indexedDB.open("gg-notes-files", 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("blocked"));
    }));
  },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("files", mode); const q = fn(t.objectStore("files")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); },
  put(id, buf, type) { return this.tx("readwrite", (s) => s.put({ buf, type }, id)); },
  get(id) { return this.tx("readonly", (s) => s.get(id)); },
  async del(id) { if (this.urls[id]) { URL.revokeObjectURL(this.urls[id]); delete this.urls[id]; } return this.tx("readwrite", (s) => s.delete(id)); },
  async url(id) { if (this.urls[id]) return this.urls[id]; const r = await this.get(id); if (!r) return null; return (this.urls[id] = URL.createObjectURL(new Blob([r.buf], { type: r.type || "application/octet-stream" }))); },
};
const noteSize = (b) => (b >= 1048576 ? `${noteNum(b / 1048576)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);
function noteFilesHTML(n) {
  const F = n.files || [];
  return `<div class="glass pad st nt-files" style="--i:8"><div class="nt-fhead"><span class="lbl">Documents${F.length ? ` · ${F.length}` : ""}</span></div>
    ${F.length ? `<div class="nt-flist">${F.map((f) => `<div class="nt-file"><a class="nt-fopen" data-nf="${esc(f.id)}" href="#" target="_blank" rel="noopener"><span class="nt-ficon ${/pdf/.test(f.type) ? "pdf" : "img"}">${/pdf/.test(f.type) ? "PDF" : ico("image")}</span><span class="nt-fname"><b>${esc(f.name)}</b><em>${noteSize(f.size || 0)} · ajouté ${when(f.at)}</em></span></a><button class="iconbtn nt-del" data-act="noteFileDel" data-id="${esc(n.id)}" data-v="${esc(f.id)}" aria-label="Retirer le document">${ico("trash")}</button></div>`).join("")}</div>` : `<p class="note" style="margin:0">Joignez vos documents existants : process, fiche technique fournisseur, analyses…</p>`}
    <button class="nt-addph nt-addfile" data-act="noteFileAdd" data-id="${esc(n.id)}">${ico("ntClip")}<span>Joindre un PDF ou une photo</span></button>
    ${F.length ? `<p class="note" style="margin:0">Les documents sont gardés sur cet appareil.</p>` : ""}</div>`;
}
async function noteFilesBind(v) {
  for (const a of $$("[data-nf]", v)) {
    const id = a.dataset.nf; let u = null; try { u = await NOTE_FILES.url(id); } catch (e) {}
    if (u) a.href = u; else { a.classList.add("missing"); a.removeAttribute("target"); const em = $("em", a); if (em) em.textContent = "Pas sur cet appareil"; }
  }
}
document.addEventListener("click", (e) => { const a = e.target.closest("a[data-nf]"); if (a && (a.getAttribute("href") === "#" || a.classList.contains("missing"))) { e.preventDefault(); if (a.classList.contains("missing")) toast("Ce document a été ajouté depuis un autre appareil.", "err"); } else if (a) { SFX.tap(); } }, true);

/* ───────── process: read tab ───────── */
function noteCcpHTML(c, cls = "ntp-cc") {
  const R = [["Limite critique", c.l], ["Surveillance", c.m], ["Action corrective", c.a]].filter((r) => String(r[1] || "").trim());
  return R.length ? `<dl class="${cls}">${R.map(([k, t]) => `<div><dt>${k}</dt><dd>${noteTy(esc(t))}</dd></div>`).join("")}</dl>` : "";
}
function noteProcTabHTML(n) {
  const P = n.process || [];
  if (!P.length) return `<div class="glass ntp-empty st" style="--i:3"><div class="ntp-art">${["truck", "ntHand", "ntFlame", "snow", "ntPlate"].map((k, i) => `<span style="--d:${i}">${ico(k)}</span>`).join("<i></i>")}</div>
      <b class="h3">Process HACCP à créer</b><p>Le diagramme de fabrication demandé lors des contrôles d'hygiène : chaque étape du plat, de la réception au service, avec ses points critiques.</p>
      <button class="btn acc" data-act="npGen" data-id="${esc(n.id)}">${ico("sparkle")}Générer le process</button><span class="note">Créé à partir des ingrédients et des étapes de la recette. Tout reste modifiable.</span></div>`;
  let ci = 0;
  const flow = P.map((s, i) => { const L = noteLib(s.k); const cc = s.c ? ++ci : 0; return `<li class="ntp-st ${s.c ? "ccp" : ""} st" style="--i:${Math.min(i + 4, 16)}"><span class="ntp-node">${ico(L.ic)}</span><div class="ntp-card"><div class="ntp-hd"><span class="ntp-n mono">${i + 1}</span><b>${esc(s.t || L.t)}</b>${s.c ? `<span class="ntp-ccp">CCP ${cc}</span>` : ""}</div>${s.x ? `<p>${noteTy(esc(s.x))}</p>` : ""}${s.c ? noteCcpHTML(s.c) : ""}</div></li>`; }).join("");
  return `<div class="glass pad ntp-sum st" style="--i:3"><div><b class="h3">${notePlural(P.length, "étape")} · ${ci ? `${ci} point${ci > 1 ? "s" : ""} critique${ci > 1 ? "s" : ""}` : "aucun point critique"}</b><span class="note">Version ${n.processV || 1}${n.processAt ? ` · mise à jour ${when(n.processAt)}` : ""}</span></div>
      <div class="grid2"><button class="btn soft" data-act="npEdit" data-id="${esc(n.id)}">${ico("edit")}Modifier</button><button class="btn acc" data-go="noteDoc" data-id="${esc(n.id)}">${ico("printer")}Exporter en PDF</button></div></div>
    <ol class="ntp-flow">${flow}</ol>`;
}

/* ───────── process: editor ───────── */
const npSnap = (L) => JSON.stringify((L || []).map((s) => [s.k, String(s.t || "").trim(), String(s.x || "").trim(), s.c ? [s.c.l, s.c.m, s.c.a].map((x) => String(x || "").trim()) : 0]));
VIEWS.noteProc = {
  live: false, hideTabs: true,
  render({ id }) {
    const n = S.notes.find((x) => x.id === id);
    if (!n) return `<div class="inner narrow nt-wrap">${topBar("Process HACCP")}<div class="glass empty">Fiche introuvable.</div></div>`;
    if (!S.ui.np || S.ui.np.id !== id) { S.ui.np = { id, steps: JSON.parse(JSON.stringify(n.process || [])) }; S.ui.npOrig = npSnap(S.ui.np.steps); }
    const L = S.ui.np.steps;
    const card = (s, i) => { const B = noteLib(s.k); return `<div class="glass ntp-ecard ${s.c ? "ccp" : ""}" data-i="${i}">
        <div class="ntp-ehd"><span class="ntp-node">${ico(B.ic)}</span><span class="ntp-n mono">${i + 1}</span><input class="input ntp-et" data-bind="ui.np.steps.${i}.t" value="${esc(s.t)}" placeholder="${esc(B.t)}" aria-label="Nom de l'étape ${i + 1}"></div>
        <textarea class="input ntp-ex" rows="1" data-bind="ui.np.steps.${i}.x" placeholder="Consigne (facultatif)" aria-label="Consigne">${esc(s.x || "")}</textarea>
        ${s.c ? `<div class="ntp-ecc"><label><span>Limite critique</span><input class="input" data-bind="ui.np.steps.${i}.c.l" value="${esc(s.c.l || "")}" placeholder="Ex. ≥ +63 °C à cœur"></label><label><span>Surveillance</span><input class="input" data-bind="ui.np.steps.${i}.c.m" value="${esc(s.c.m || "")}" placeholder="Ex. Sonde à cœur, valeur notée"></label><label><span>Action corrective</span><input class="input" data-bind="ui.np.steps.${i}.c.a" value="${esc(s.c.a || "")}" placeholder="Ex. Prolonger la cuisson"></label></div>` : ""}
        <div class="ntp-etools"><button class="ntp-cctog ${s.c ? "on" : ""}" data-act="npCcp" data-v="${i}" aria-pressed="${!!s.c}">${ico(s.c ? "check" : "plus")}Point critique</button><span style="flex:1"></span>
          <button class="iconbtn" data-act="npMove" data-v="${i}" data-id="-1" aria-label="Monter l'étape" ${i === 0 ? "disabled" : ""}>${ico("ntUp")}</button><button class="iconbtn" data-act="npMove" data-v="${i}" data-id="1" aria-label="Descendre l'étape" ${i === L.length - 1 ? "disabled" : ""}>${ico("ntDown")}</button><button class="iconbtn ntp-trash" data-act="npDel" data-v="${i}" aria-label="Supprimer l'étape">${ico("trash")}</button></div></div>`; };
    return `<div class="inner nt-wrap nt-ped"><div class="top st" style="--i:0"><button class="iconbtn" data-act="npBack" aria-label="Retour">${ico("back")}</button><span class="h2">Process HACCP</span></div>
      <p class="sub st" style="--i:1;margin:-6px 0 0">${esc(n.title)} · ${notePlural(L.length, "étape")}</p>
      <div class="ntp-elist">${L.length ? L.map(card).join("") : `<div class="glass empty">Aucune étape. Ajoutez-en depuis la bibliothèque.</div>`}</div>
      <button class="nt-addph st" style="--i:3" data-act="npLib">${ico("plus")}<span>Ajouter une étape</span><em>bibliothèque HACCP</em></button>
      <div class="ctabar st" style="--i:4"><button class="btn acc block" data-act="npSave">${ico("check")}Enregistrer le process</button></div></div>`;
  },
  after(v) {
    const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
    $$(".ntp-ex", v).forEach((t) => { grow(t); t.addEventListener("input", () => grow(t)); });
    if (S.ui.npFlash != null) { const c = $(`.ntp-ecard[data-i="${S.ui.npFlash}"]`, v); S.ui.npFlash = null; if (c) { c.classList.add("flash"); c.scrollIntoView({ block: "center", behavior: "smooth" }); } }
    setTimeout(() => { const b = $('#side .nav[data-go="notes"]'); b && b.classList.add("on"); }, 0);
  },
};
const npDirty = () => !!S.ui.np && npSnap(S.ui.np.steps) !== S.ui.npOrig;
const npRer = (flash) => { S.ui.npFlash = flash; noteRer(); };

/* ───────── export: printable A4 document ───────── */
function noteDocHTML(n, P, proposed) {
  const ings = n.ingredients || []; const al = recipeAllergens(n); let ci = 0; const ccps = [];
  const items = P.map((s, i) => { const L = noteLib(s.k); const cc = s.c ? ++ci : 0; if (s.c) ccps.push({ i, cc, s, L }); return `<li class="${s.c ? "ccp" : ""}"><div class="ntd-box"><span class="ntd-n">${i + 1}</span><div class="ntd-tx"><b>${esc(s.t || L.t)}</b>${s.c ? ` <em class="ntd-badge">CCP ${cc}</em>` : ""}${s.x ? `<p>${noteTy(esc(s.x))}</p>` : ""}${s.c && s.c.l ? `<p class="ntd-lim">${noteTy(esc(s.c.l))}</p>` : ""}</div></div></li>`; });
  const flow = noteDocFlow(items);
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const por = num(n.portions);
  return `<article class="ntd">
    <header class="ntd-h"><div class="ntd-hl"><div class="ntd-k">Fiche process HACCP · diagramme de fabrication</div><h1>${esc(n.title || "Sans titre")}</h1>
      <div class="ntd-meta"><span>${esc(S.resto?.name || "")}</span>${por ? `<span>${noteNum(por)} portion${por >= 2 ? "s" : ""}</span>` : ""}<span>${proposed ? "Process proposé, à valider" : `Version ${n.processV || 1}`}</span><span>Édité le ${today}</span></div></div>
      <div class="ntd-logo">${(() => { try { return typeof appIcon === "function" ? appIcon(36) : logoMark({ mono: "#5B2BFF" }); } catch (e) { return ""; } })()}</div></header>
    <p class="ntd-legend ntd-muted"><span class="ntd-key"></span> Étape &nbsp; <span class="ntd-key ccp"></span> Point critique (CCP) : limite à respecter, contrôle noté.</p>
    ${flow}
    <section class="ntd-two"><div><h2>Ingrédients</h2>${ings.length ? `<table class="ntd-t ntd-ing"><tbody>${ings.map((g) => { const s = noteScale(g.qty, g.unit, 1); return `<tr><td>${esc(g.name)}</td><td class="r">${esc(s.q)} ${esc(s.u)}</td></tr>`; }).join("")}</tbody></table>` : `<p class="ntd-muted">Non renseignés.</p>`}</div>
      <div><h2>Allergènes</h2>${al.length ? `<div class="ntd-al">${al.map((a) => `<span>${esc(noteAllergenLabel(a))}</span>`).join("")}</div>` : `<p class="ntd-muted">Aucun allergène déclaré sur la fiche.</p>`}</div></section>
    <div class="ntd-end"><section><h2>Points critiques à maîtriser (CCP)</h2>${ccps.length ? `<table class="ntd-t ntd-ccp"><thead><tr><th>CCP</th><th>Étape</th><th>Limite critique</th><th>Surveillance</th><th>Action corrective</th></tr></thead><tbody>${ccps.map(({ i, cc, s, L }) => `<tr><td class="ntd-c">${cc}</td><td><b>${esc(s.t || L.t)}</b><br><span class="ntd-muted">étape ${i + 1}</span></td><td>${noteTy(esc(s.c.l || "—"))}</td><td>${noteTy(esc(s.c.m || "—"))}</td><td>${noteTy(esc(s.c.a || "—"))}</td></tr>`).join("")}</tbody></table>` : `<p class="ntd-muted">Aucun point critique défini.</p>`}</section>
    <section class="ntd-sign"><div><span>Établi par</span><i></i><span>Date</span><i></i><span>Signature</span><i class="tall"></i></div><div><span>Vérifié par (responsable)</span><i></i><span>Date</span><i></i><span>Signature</span><i class="tall"></i></div></section>
    <footer class="ntd-f">${esc(S.resto?.name || "")} · Plan de maîtrise sanitaire · ${esc(n.title || "")}</footer></div></article>`;
}
/* the flow reads top to bottom: one column up to 8 steps, else two explicit columns (left, then right),
   each ending without an arrow, with a numbered "suite" marker. The diagram opens the document (page 1);
   past 22 steps it is cut in even blocks, one per page, with "suite page suivante" markers. */
function noteDocFlow(items) {
  const nb = Math.max(1, Math.ceil(items.length / 22)); const BLOCK = Math.ceil(items.length / nb); const blocks = []; for (let i = 0; i < items.length; i += BLOCK) blocks.push(i);
  const many = blocks.length > 1;
  return blocks.map((b0, bi) => {
    const part = items.slice(b0, b0 + BLOCK); const last = bi === blocks.length - 1;
    const end = last ? "" : `<p class="ntd-next">Suite du diagramme page suivante, à l'étape ${b0 + BLOCK + 1} ↓</p>`;
    const from = bi ? `<p class="ntd-from">↑ Suite de l'étape ${b0}</p>` : "";
    const h = `<h2>Diagramme de fabrication${many ? ` <span class="ntd-pg">${bi ? "suite, " : ""}étapes ${b0 + 1} à ${b0 + part.length}</span>` : ""}</h2>`;
    if (part.length <= 8) return `<section class="ntd-flowsec">${h}${from}<ol class="ntd-flow ntd-one" start="${b0 + 1}">${part.join("")}</ol>${end}</section>`;
    const k = Math.ceil(part.length / 2); const A = part.slice(0, k), B = part.slice(k);
    return `<section class="ntd-flowsec">${h}${from}<div class="ntd-cols"><div><ol class="ntd-flow">${A.join("")}</ol><p class="ntd-cont">Suite : étape ${b0 + k + 1}, colonne de droite <b>→</b></p></div><div><p class="ntd-cont ntd-cin"><b>→</b> Suite de l'étape ${b0 + k}</p><ol class="ntd-flow">${B.join("")}</ol></div></div>${end}</section>`;
  }).join("");
}
const noteDocList = (id) => (id === "all" ? S.notes.filter((n) => noteKind(n) === "Recettes" && (n.title || "").trim()).sort((a, b) => String(a.title).localeCompare(String(b.title), "fr")) : S.notes.filter((n) => n.id === id));
const noteDocProc = (n) => (n.process && n.process.length ? { P: n.process, proposed: false } : { P: noteProcGen(n, noteCooked(n) ? "avance" : "now"), proposed: true });
function noteDocHow() {
  if (notePointer()) return "Cliquez sur « Exporter en PDF », puis choisissez « Enregistrer au format PDF » comme imprimante.";
  if (noteIOS()) return "Touchez « Exporter en PDF », puis le bouton Partager de l'aperçu et « Enregistrer dans Fichiers ».";
  return "Touchez « Exporter en PDF », puis choisissez « Enregistrer au format PDF » comme imprimante.";
}
VIEWS.noteDoc = {
  hideTabs: true,
  render({ id }) {
    const L = noteDocList(id); const all = id === "all";
    if (!L.length) return `<div class="inner narrow nt-wrap">${topBar(all ? "Tous les process" : "Fiche process")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("ntFlow")}</div><b>Aucune recette</b>Créez une fiche recette pour éditer son process HACCP.</div></div>`;
    const miss = L.filter((n) => !(n.process && n.process.length)).length;
    return `<div class="inner wide nt-wrap ntd-screen">${topBar(all ? "Tous les process HACCP" : "Fiche process")}
      <div class="glass pad ntd-hint st" style="--i:1"><div class="ic">${ico("printer")}</div><div class="ntd-htx"><b>${all ? `${notePlural(L.length, "plat")}, un par page.` : "Prêt à imprimer ou à enregistrer en PDF."}</b><p class="note" style="margin:3px 0 0">${noteDocHow()}</p>${miss ? `<p class="note nt-warn" style="margin:6px 0 0">${miss === 1 ? "1 plat n'a pas encore de process : un process standard est proposé" : `${miss} plats n'ont pas encore de process : un process standard est proposé`}, à valider.</p>` : ""}</div><button class="btn acc ntd-hbtn" data-act="notePrint">${ico("printer")}Exporter en PDF</button></div>
      <div class="ntd-stack st" style="--i:2">${L.map((n) => { const d = noteDocProc(n); return noteDocHTML(n, d.P, d.proposed); }).join("")}</div>
      <div class="ctabar ntd-cta st" style="--i:3"><button class="btn acc block" data-act="notePrint">${ico("printer")}Exporter en PDF</button></div></div>`;
  },
  after() { setTimeout(() => { const b = $('#side .nav[data-go="notes"]'); b && b.classList.add("on"); }, 0); },
};
function notePrintCleanup() { document.documentElement.classList.remove("nt-printing"); const p = $("#ntPrint"); if (p) p.remove(); if (notePrintCleanup.t) { document.title = notePrintCleanup.t; notePrintCleanup.t = null; } }
window.addEventListener("afterprint", () => { if (document.documentElement.classList.contains("nt-printing")) setTimeout(notePrintCleanup, 300); });
function notePrintPrep() {
  notePrintCleanup(); const docs = $$("#viewport .view:not(.leave) .ntd"); if (!docs.length) return false;
  const box = document.createElement("div"); box.id = "ntPrint"; box.innerHTML = docs.map((d) => d.outerHTML).join(""); document.body.appendChild(box);
  document.documentElement.classList.add("nt-printing");
  const L = noteDocList(S.params.id); notePrintCleanup.t = document.title;
  document.title = (S.params.id === "all" ? `Process HACCP - ${S.resto?.name || ""}` : `Process HACCP - ${L[0]?.title || ""}`).replace(/[\/\\:]/g, "-");
  return true;
}

/* ───────── list: export-all row + example ───────── */
function noteProcListHTML() {
  const R = S.notes.filter((n) => noteKind(n) === "Recettes"); const has = S.notes.some((n) => n.seed === "bourguignon" || noteNorm(n.title) === "boeuf bourguignon");
  const ex = !has && R.length < 3 ? `<div class="glass nt-starter nt-exrow st" style="--i:4"><div class="ic acc">${ico("ntChef")}</div><div style="flex:1;min-width:0"><b class="h3">Exemple : Bœuf bourguignon</b><p class="note" style="margin:3px 0 0">Une fiche complète pour 8 portions, avec son process HACCP de la réception au service.</p></div><button class="btn soft sm" data-act="noteExample">${ico("plus")}Ajouter</button></div>` : "";
  const all = R.length ? `<div class="glass nt-procall st" style="--i:3"><div class="ic">${ico("ntFlow")}</div><div style="flex:1;min-width:0"><b>Process HACCP</b><span class="note">${R.filter((n) => n.process && n.process.length).length} / ${R.length} plat${R.length > 1 ? "s" : ""} avec un process</span></div><button class="btn soft sm" data-go="noteDoc" data-id="all">${ico("printer")}Tout exporter</button></div>` : "";
  return noteCarteRowHTML() + all + ex + noteExRowHTML();
}

Object.assign(ACT, {
  noteFTab: (a, id, v) => { (S.ui.noteTab ||= {})[id] = v; SFX.tick(); buzz(5); rerender(); const b = $("#ntFBody"); if (b) { b.classList.remove("in"); void b.offsetWidth; b.classList.add("in"); } },
  noteExample: async (a) => {
    if (a.disabled) return; a.disabled = true; const t = Date.now(); const d = { ...noteBourguignon(), uid: S.me.id, at: t, updatedAt: t, processV: 1, processAt: t, processBy: S.me.id, photo: "", files: [] };
    let id; try { id = await safe(DB.add("notes", d)); } catch (e) { a.disabled = false; return; }
    await logEvent("note", `a ajouté la fiche « ${d.title} »`, { ref: id });
    SFX.done(); buzz(14); const r = a.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); toast("Bœuf bourguignon ajouté");
    (S.ui.noteTab ||= {})[id] = "process"; go("fiche", { id });
  },
  npGen: (a, id) => {
    const n = S.notes.find((x) => x.id === id); if (!n) return;
    if (!noteCooked(n)) return ACT.npGenGo(a, id, "now");
    openSheet(`<div class="h2" style="font-size:20px">Comment ce plat est-il servi ?</div><p class="sub" style="margin:0">Le process change selon la liaison.</p>
      <button class="ntp-choice" data-act="npGenGo" data-id="${esc(id)}" data-v="now"><span class="ic">${ico("ntFlame")}</span><span><b>Cuit et servi aussitôt</b><em>Cuisson, contrôle à cœur, service.</em></span></button>
      <button class="ntp-choice" data-act="npGenGo" data-id="${esc(id)}" data-v="avance"><span class="ic">${ico("snow")}</span><span><b>Préparé à l'avance</b><em>Cellule de refroidissement, stockage, remise en température.</em></span></button>`);
  },
  npGenGo: async (a, id, v) => {
    closeSheet(true); const n = S.notes.find((x) => x.id === id); if (!n || S.ui.npBusy) return; S.ui.npBusy = true;
    const P = noteProcGen(n, v); const t = Date.now();
    try { await safe(DB.update("notes", id, { process: P, processV: (n.processV || 0) + 1, processAt: t, processBy: S.me.id })); } catch (e) { S.ui.npBusy = false; return; }
    S.ui.npBusy = false; await logEvent("note", `a créé le process HACCP « ${n.title} »`, { ref: id });
    (S.ui.noteTab ||= {})[id] = "process"; SFX.done(); buzz(14); burst(); toast(`Process créé : ${notePlural(P.length, "étape")}`); rerender();
  },
  npEdit: (a, id) => { S.ui.np = null; SFX.tap(); go("noteProc", { id }); },
  npBack: () => { S.ui.notePending = null; if (!npDirty()) { SFX.tap(); S.ui.np = null; goBack(); return; } noteAskLeave(); },
  npCcp: (a, id, v) => { const s = S.ui.np.steps[+v]; if (s.c) s.c = null; else { const L = noteLib(s.k); s.c = L.c ? { l: L.c[0], m: L.c[1], a: L.c[2] } : { l: "", m: "", a: "" }; } SFX.tick(); buzz(5); npRer(+v); },
  npMove: (a, id, v) => { const L = S.ui.np.steps; const i = +v, j = i + +id; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; SFX.tick(); buzz(5); npRer(j); },
  npDel: (a, id, v) => { const L = S.ui.np.steps; const i = +v; const c = $(`.ntp-ecard[data-i="${i}"]`); SFX.close(); buzz(6); const go_ = () => { L.splice(i, 1); noteRer(); }; if (c) { c.classList.add("bye"); setTimeout(go_, 220); } else go_(); },
  npLib: () => {
    openSheet(`<div class="h2" style="font-size:20px">Ajouter une étape</div><p class="sub" style="margin:0">Elle s'ajoute à la fin. Déplacez-la ensuite avec les flèches.</p>
      <div class="ntp-lib">${NOTE_PLIB.map(([k, ic, t, x, c, on]) => `<button data-act="npAdd" data-v="${k}"><span class="ntp-node">${ico(ic)}</span><span>${esc(t)}</span>${on ? `<em>CCP</em>` : ""}</button>`).join("")}</div>`);
  },
  npAdd: (a, id, v) => { closeSheet(true); const L = S.ui.np.steps; const s = noteStep(v); if (v === "libre") s.t = ""; L.push(s); SFX.tick(); buzz(6); npRer(L.length - 1); if (v === "libre") setTimeout(() => { const i = $(`.ntp-ecard[data-i="${L.length - 1}"] .ntp-et`); i && i.focus({ preventScroll: true }); }, 450); },
  npSave: async (a) => {
    const D = S.ui.np; if (!D || a.disabled) return; const n = S.notes.find((x) => x.id === D.id); if (!n) return;
    const P = D.steps.map((s) => { const L = noteLib(s.k); const c = s.c && [s.c.l, s.c.m, s.c.a].some((x) => String(x || "").trim()) ? { l: String(s.c.l || "").trim(), m: String(s.c.m || "").trim(), a: String(s.c.a || "").trim() } : null; return { k: L.k, t: String(s.t || "").trim() || L.t, x: String(s.x || "").trim(), c }; });
    if (!P.length) { SFX.err(); buzz(30); toast("Ajoutez au moins une étape.", "err"); return; }
    a.disabled = true;
    try { await safe(DB.update("notes", D.id, { process: P, processV: (n.processV || 0) + 1, processAt: Date.now(), processBy: S.me.id })); } catch (e) { a.disabled = false; return; }
    await logEvent("note", `a modifié le process HACCP « ${n.title} »`, { ref: D.id });
    SFX.ok(); buzz(10); toast("Process enregistré"); S.ui.np = null; (S.ui.noteTab ||= {})[D.id] = "process";
    const p = S.ui.noteFromSheet ? S.ui.notePending : null; S.ui.notePending = null; S.ui.noteFromSheet = false; if (p) go(p.route, p.params, { replace: true }); else goBack();
  },
  notePrint: () => { if (!notePrintPrep()) return; SFX.print ? SFX.print() : SFX.tap(); buzz(8); setTimeout(() => { try { window.print(); } catch (e) {} }, 80); },
  noteFileAdd: (a, id) => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/pdf,image/*"; inp.multiple = true; inp.hidden = true; document.body.appendChild(inp);
    inp.addEventListener("change", async () => {
      const fs = [...(inp.files || [])]; inp.remove(); if (!fs.length) return;
      const n = S.notes.find((x) => x.id === id); if (!n) return; const add = [];
      for (const f of fs) {
        if (!/pdf$|^image\//.test(f.type) && !/\.pdf$/i.test(f.name)) { toast("Seuls les PDF et les photos sont acceptés.", "err"); continue; }
        let blob = f, type = f.type || "application/pdf";
        if (/^image\//.test(type) && f.size > 1500000) { try { blob = (await shrink(f, 2000, 0.82)).blob; type = "image/jpeg"; } catch (e) {} }
        if (blob.size > 25 * 1048576) { SFX.err(); toast(`« ${f.name} » est trop lourd (25 Mo max).`, "err"); continue; }
        const fid = "nf-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        try { await NOTE_FILES.put(fid, await blob.arrayBuffer(), type); } catch (e) { console.warn(e); SFX.err(); toast("Impossible de garder ce document sur l'appareil.", "err"); continue; }
        add.push({ id: fid, name: f.name || "document.pdf", type, size: blob.size, at: Date.now(), uid: S.me.id });
      }
      if (!add.length) return;
      try { await safe(DB.update("notes", id, { files: [...(n.files || []), ...add] })); } catch (e) { return; }
      await logEvent("note", `a joint ${add.length > 1 ? `${add.length} documents` : `« ${add[0].name} »`} à « ${n.title} »`, { ref: id });
      SFX.ok(); buzz(10); toast(add.length > 1 ? `${add.length} documents joints` : "Document joint");
    }, { once: true });
    inp.click();
  },
  noteFileDel: (a, id, v) => {
    const n = S.notes.find((x) => x.id === id); const f = (n?.files || []).find((x) => x.id === v); if (!f) return;
    openSheet(`<div class="h2" style="font-size:20px">Retirer ce document ?</div><p class="sub" style="margin:0">« ${esc(f.name)} » sera supprimé de cet appareil.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="noteFileDelOk" data-id="${esc(id)}" data-v="${esc(v)}">${ico("trash")}Retirer</button></div>`);
  },
  noteFileDelOk: async (a, id, v) => {
    closeSheet(true); const n = S.notes.find((x) => x.id === id); if (!n || !(n.files || []).some((x) => x.id === v)) return;
    try { await safe(DB.update("notes", id, { files: (n.files || []).filter((x) => x.id !== v) })); } catch (e) { return; }
    NOTE_FILES.del(v).catch(() => {}); SFX.close(); toast("Document retiré");
  },
});


/* ═════════ V3 · allergènes, carte, utilisation de la recette ═════════
   Recipe doc fields (all optional, backward compatible):
   ingredients[i]: {name, qty, unit, productId?, noteId? (sous-recette), free? (lien retiré à la main)}
   allergens: own allergens (core ids) · alNo: suggestions refused by the chef
   carte: bool · carteCat: entree|plat|dessert|partage|boisson · price: prix de vente TTC
   portions: portions per batch (fournée). Stock: "moves" docs {kind:"recette", qty<0, ref: note id, use, batches}. */
Object.assign(IC, {
  ntMenu: ["M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3Z", "M9 8h6", "M9 12h6", "M9 16h3"],
  ntUse: ["M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z", "M2 10h20", "M9 6.5V3", "M15 6.5V3", "M12 7V3"],
  ntLink: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  ntFilter: ["M3 5h18", "M6 12h12", "M10 19h4"],
});
TAB_OF.noteCarte = "more";

const NOTE_CARTE_CATS = [["partage", "À partager"], ["entree", "Entrée"], ["plat", "Plat"], ["dessert", "Dessert"], ["boisson", "Boisson"]];
const NOTE_CARTE_PL = { partage: "À partager", entree: "Entrées", plat: "Plats", dessert: "Desserts", boisson: "Boissons" };
const noteCarteCat = (k) => NOTE_CARTE_CATS.find((c) => c[0] === k)?.[1] || "Plat";
const noteEur = (v) => `${(Math.round(v * 100) / 100).toFixed(2).replace(".", ",")} €`;
const noteAlOrder = (ids) => NOTE_ALLERGENS.map((a) => a[0]).filter((k) => ids.includes(k));

/* ───────── ingredient links ───────── */
function noteIngLink(g) {
  if (g && g.productId) { const p = S.products.find((x) => x.id === g.productId); if (p) return { t: "p", p }; }
  if (g && g.noteId) { const n = S.notes.find((x) => x.id === g.noteId); if (n) return { t: "n", n }; }
  return null;
}
const noteSing = (s) => noteNorm(s).replace(/\s+/g, " ").split(" ").map((w) => (w.length > 3 ? w.replace(/(s|x)$/, "") : w)).join(" ");
function noteFindProduct(name) { const k = noteSing(name); if (!k) return null; return S.products.find((p) => noteSing(p.name) === k) || null; }
function noteIngClean(g) {
  const o = { name: String(g.name || "").trim(), qty: String(g.qty ?? "").trim(), unit: String(g.unit ?? "").trim() };
  const L = noteIngLink(g);
  if (L && L.t === "p") o.productId = L.p.id; else if (L && L.t === "n") o.noteId = L.n.id;
  else if (g.free) o.free = true; else { const p = noteFindProduct(o.name); if (p) o.productId = p.id; } /* same name as a stock product: linked automatically */
  if (!o.name) o.name = L ? (L.t === "p" ? L.p.name : L.n.title) : "";
  return o;
}

/* ───────── allergens: guesses from a name (only the obvious ones, always shown as « à confirmer ») ───────── */
const NOTE_GUESS = [
  ["lait", /\b(beurre|creme|lait|laitier|fromage|comte|emmental|gruyere|parmesan|mozzarella|burrata|chevre|roquefort|bleu d auvergne|brie|camembert|tomme|reblochon|raclette|morbier|mimolette|cantal|feta|ricotta|mascarpone|yaourt|bechamel|chantilly|lactose)s?\b/, /\b(lait|creme) de coco\b|\bcreme de (cassis|marron|mure|peche|framboise|balsamique)\b|\bbeurre de cacahuete/],
  ["gluten", /\b(farine|pain|baguette|brioche|chapelure|panure|panko|biscuit|biscotte|pates?|feuillete|brisee|sablee|semoule|boulgour|ble|seigle|orge|epeautre|avoine|croutons?|tagliatelles?|spaghettis?|penne|ravioles?|gnocchis?|couscous|biere|seitan)s?\b/, /\bpate (de fruit|d amande)|\bpate (de|du) (porc|campagne|foie)/],
  ["oeufs", /\b(oeufs?|jaunes? d oeuf|blancs? d oeuf|mayonnaise|meringue)\b/],
  ["poissons", /\b(poissons?|saumon|thon|cabillaud|morue|anchois|sardines?|maquereau|truite|dorade|merlu|colin|sole|haddock|lotte|bar|eglefin|hareng|surimi|nuoc mam)\b/],
  ["crustaces", /\b(crevettes?|gambas|homard|langoustines?|langouste|crabe|tourteau|ecrevisses?|araignee de mer)\b/],
  ["mollusques", /\b(huitres?|moules?|coquillages?|calamars?|encornets?|seiches?|poulpe|saint jacques?|bulots?|palourdes?|coques|bigorneaux|escargots?|praires?|couteaux de mer|noix de saint jacques)\b/],
  ["fruitscoque", /\b(noix|noisettes?|amandes?|pistaches?|cajou|pecan|macadamia|praline|pralin|nougat|frangipane)\b/, /\bnoix de (coco|muscade|saint jacques?|veau|beurre)\b|\bbeurre noisette\b/],
  ["arachides", /\b(arachides?|cacahuetes?)\b/],
  ["soja", /\b(soja|tofu|edamame|miso|tamari)\b/],
  ["celeri", /\bceleris?\b/],
  ["moutarde", /\bmoutardes?\b/],
  ["sesame", /\b(sesame|tahini|tahin)\b/],
  ["sulfites", /\b(vins?|vinaigres?|vinaigrette|porto|madere|xeres|cidre|champagne|cremant|fruits secs)\b/, /\bvin (sans sulfites?)\b/],
  ["lupin", /\blupin\b/],
];
function noteAlGuess(name) { const h = " " + noteNorm(name).replace(/[-_/]/g, " ") + " "; return NOTE_GUESS.filter(([, re, no]) => re.test(h) && !(no && no.test(h) && !re.test(h.replace(new RegExp(no.source, "g"), " ")))).map((g) => g[0]); }
/* per ingredient: allergens it brings (recorded) and the ones only guessed */
function noteIngAl(g, seen) {
  const L = noteIngLink(g);
  if (L && L.t === "p") { const rec = (L.p.allergens || []).map(noteAlId); return rec.length ? { on: rec, sug: [] } : { on: [], sug: L.p.allergensNone ? [] : noteAlGuess(L.p.name + " " + (g.name || "")) }; }
  if (L && L.t === "n") { if (seen && seen.has(L.n.id)) return { on: [], sug: [] }; const D = noteAlDetail(L.n, seen); const ids = Object.keys(D); return { on: ids.filter((k) => D[k].own || D[k].from.length), sug: ids.filter((k) => !D[k].own && !D[k].from.length && D[k].sug.length) }; }
  return { on: [], sug: noteAlGuess(g.name) };
}
/* id → {own, from:[ingredient names], sug:[ingredient names]}; refused suggestions (alNo) are dropped */
function noteAlDetail(n, seen = new Set()) {
  const M = {}; const E = (k) => (M[k] ||= { own: false, from: [], sug: [] }); const no = new Set((n.alNo || []).map(noteAlId));
  (n.allergens || []).forEach((k) => (E(noteAlId(k)).own = true));
  const S2 = new Set(seen); if (n.id || n._id) S2.add(n.id || n._id);
  (n.ingredients || []).forEach((g) => {
    const nm = String(g.name || "").trim() || noteIngLink(g)?.p?.name || noteIngLink(g)?.n?.title || ""; if (!nm && !g.productId && !g.noteId) return;
    const A = noteIngAl(g, S2); A.on.forEach((k) => { const e = E(k); if (!e.from.includes(nm)) e.from.push(nm); });
    A.sug.forEach((k) => { if (!no.has(k)) { const e = E(k); if (!e.sug.includes(nm)) e.sug.push(nm); } });
  });
  Object.keys(M).forEach((k) => { if (!M[k].own && !M[k].from.length && !M[k].sug.length) delete M[k]; });
  return M;
}
/* allergen ids of a recipe: own + linked products + sub-recipes. withSuggested adds the guesses still to confirm. */
function recipeAllergens(note, withSuggested = false) {
  if (!note) return []; const D = noteAlDetail(note);
  return noteAlOrder(Object.keys(D).filter((k) => D[k].own || D[k].from.length || (withSuggested && D[k].sug.length)));
}
const noteAlToConfirm = (n) => { const D = noteAlDetail(n); return noteAlOrder(Object.keys(D).filter((k) => !D[k].own && !D[k].from.length && D[k].sug.length)); };
function noteCardFoot(n) {
  const al = recipeAllergens(n); const q = noteAlToConfirm(n);
  return `<span class="nt-cfoot">${n.carte ? `<span class="nt-carpill">${ico("ntMenu")}${esc(noteCarteCat(n.carteCat))}</span>` : ""}${al.length ? `<span class="nt-almini">${ico("alert")}${esc(al.map(noteAllergenLabel).join(", "))}</span>` : ""}${q.length ? `<span class="nt-almini q">${notePlural(q.length, "allergène")} à confirmer</span>` : ""}${!al.length && !q.length ? `<span class="nt-almini none">${(n.ingredients || []).length ? "Sans allergène" : "Allergènes non renseignés"}</span>` : ""}</span>`;
}

/* ───────── read view: allergen card ───────── */
function noteAlCardHTML(n) {
  const D = noteAlDetail(n); const on = noteAlOrder(Object.keys(D).filter((k) => D[k].own || D[k].from.length)); const q = noteAlToConfirm(n);
  const off = NOTE_ALLERGENS.filter(([k]) => !on.includes(k) && !q.includes(k)).map((a) => a[1]);
  const src = (k) => (D[k].from.length ? D[k].from.join(", ") : "indiqué sur la fiche");
  const empty = !(n.ingredients || []).length && !on.length;
  return `<div class="glass pad st nt-alcard ${on.length ? "has" : ""}" style="--i:2">
    <div class="nt-alhead"><span class="lbl">${ico("alert")}${on.length ? `${notePlural(on.length, "allergène")} dans ce plat` : "Allergènes"}</span><button class="btn ghost sm" data-go="noteCarte">${ico("ntMenu")}Tableau de la carte</button></div>
    ${on.length ? `<div class="nt-albig">${on.map((k, i) => `<div class="nt-alb st" style="--i:${i + 3}"><b>${esc(noteAllergenLabel(k))}</b><span>${esc(src(k))}</span></div>`).join("")}</div>` : `<p class="note" style="margin:8px 0 0">${empty ? "Aucun allergène renseigné. Ajoutez les ingrédients ou cochez les allergènes dans « Modifier »." : q.length ? "Aucun allergène confirmé pour l'instant." : "Aucun allergène réglementaire dans ce plat."}</p>`}
    ${q.length ? `<div class="nt-alq"><span class="nt-alqh">${ico("sparkle")}À confirmer, d'après le nom des ingrédients</span>${q.map((k) => `<div class="nt-alqr"><span><b>${esc(noteAllergenLabel(k))} ?</b><em>${esc(D[k].sug.join(", "))}</em></span><button class="btn soft sm" data-act="noteAlNo" data-id="${esc(n.id)}" data-v="${k}">Non</button><button class="btn acc sm" data-act="noteAlOk" data-id="${esc(n.id)}" data-v="${k}">${ico("check")}Oui</button></div>`).join("")}</div>` : ""}
    ${on.length || q.length ? `<p class="nt-aloff"><b>Sans :</b> ${esc(off.join(", ").toLowerCase())}.</p>` : ""}</div>`;
}

/* ───────── editor: allergen grid, ingredient link line, carte block ───────── */
function noteAlEdHTML(N) {
  const D = noteAlDetail(N); const own = N.allergens || [];
  return NOTE_ALLERGENS.map(([k, t]) => {
    const d = D[k]; const st = own.includes(k) ? "on" : d && d.from.length ? "from" : d && d.sug.length ? "sug" : "";
    const sub = st === "from" ? d.from.join(", ") : st === "sug" ? `${d.sug.join(", ")} ?` : st === "on" && d && d.from.length ? d.from.join(", ") : "";
    return `<button class="nt-al ${st === "on" || st === "from" ? "on" : ""} ${st}" data-act="noteAl" data-v="${k}" aria-pressed="${st === "on" || st === "from"}">${ico(st === "on" || st === "from" ? "check" : st === "sug" ? "alert" : "plus")}<span class="nt-alt"><span>${t}</span>${sub ? `<em>${esc(sub)}</em>` : ""}</span></button>`;
  }).join("");
}
function noteELinkHTML(g, i) {
  const L = noteIngLink(g);
  if (L) { const A = noteIngAl(g); const al = [...A.on.map(noteAllergenLabel), ...A.sug.map((x) => noteAllergenLabel(x) + " ?")];
    return `<div class="nt-elink on"><button class="nt-elk" data-act="noteLink" data-v="${i}">${ico(L.t === "p" ? "box" : "ntChef")}<span><b>${esc(L.t === "p" ? L.p.name : L.n.title)}</b><em>${L.t === "p" ? `Stock · ${esc(L.p.unit || "")}` : "Sous-recette"}${al.length ? ` · ${esc(al.join(", "))}` : ""}</em></span></button><button class="iconbtn nt-eunl" data-act="noteLinkFree" data-v="${i}" aria-label="Retirer le lien">${ico("x")}</button></div>`; }
  const sug = !g.free && String(g.name || "").trim() ? noteFindProduct(g.name) : null;
  return `<div class="nt-elink"><button class="nt-elk" data-act="noteLink" data-v="${i}">${ico("ntLink")}<span>${sug ? `Lier à « ${esc(sug.name)} »` : "Lier au stock"}</span></button></div>`;
}
function noteCarteEdHTML(N) {
  return `<div class="glass pad st nt-esec nt-ecarte" style="--i:5"><button class="nt-ctog ${N.carte ? "on" : ""}" data-act="noteCarteTog" aria-pressed="${!!N.carte}"><span class="ic">${ico("ntMenu")}</span><span class="nt-ctx"><b>À la carte</b><em>Le plat apparaît dans le tableau des allergènes pour les clients.</em></span><span class="nt-sw"><i></i></span></button>
    ${N.carte ? `<div class="nt-ccats">${NOTE_CARTE_CATS.map(([k, t]) => `<button class="chip ${N.carteCat === k ? "on" : ""}" data-act="noteCarteCatSet" data-v="${k}">${t}</button>`).join("")}</div>
    <label class="nt-eprice"><span>Prix de vente</span><input class="input mono" data-bind="ui.note.price" inputmode="decimal" autocomplete="off" value="${esc(N.price ?? "")}" placeholder="12,50" aria-label="Prix de vente TTC"><span>€ TTC</span></label>` : ""}</div>`;
}
function noteLinkListHTML(i, q) {
  const k = noteNorm(q); const g = S.ui.note?.ingredients?.[i] || {}; const self = S.ui.note?._id;
  const P = S.products.filter((p) => !k || noteNorm(p.name).includes(k) || k.split(" ").every((w) => noteNorm(p.name).includes(w))).slice(0, 40);
  const R = S.notes.filter((n) => noteKind(n) === "Recettes" && n.id !== self && (!k || noteNorm(n.title).includes(k))).slice(0, 12);
  const row = (v, ic, t, sub, on) => `<button class="nt-lrow ${on ? "on" : ""}" data-act="noteLinkSet" data-id="${i}" data-v="${v}"><span class="ic">${ico(ic)}</span><span><b>${esc(t)}</b><em>${esc(sub)}</em></span>${on ? ico("check") : ""}</button>`;
  const pal = (p) => { const a = (p.allergens || []).map(noteAllergenLabel); return [p.zone || "", p.unit || "", a.length ? a.join(", ") : ""].filter(Boolean).join(" · "); };
  return `${P.length ? `<span class="lbl">Produits du stock</span>${P.map((p) => row("p:" + p.id, "box", p.name, pal(p), g.productId === p.id)).join("")}` : S.products.length ? `<p class="note">Aucun produit « ${esc(q)} » dans le stock.</p>` : `<div class="nt-lempty"><b>Le stock est vide</b><span class="note">Ajoutez vos produits dans Stock pour les lier aux recettes.</span></div>`}
    ${R.length ? `<span class="lbl" style="margin-top:6px">Sous-recettes</span>${R.map((n) => row("n:" + n.id, "ntChef", n.title, notePlural(recipeAllergens(n).length, "allergène"), g.noteId === n.id)).join("")}` : ""}`;
}

/* ───────── units, cost ───────── */
function noteUnitKey(u) {
  const l = noteNorm(u).replace(/\.$/, "").trim();
  if (["g", "gr", "gramme", "grammes"].includes(l)) return ["m", 1]; if (["kg", "kilo", "kilos"].includes(l)) return ["m", 1000];
  if (l === "ml") return ["v", 1]; if (l === "cl") return ["v", 10]; if (l === "dl") return ["v", 100]; if (["l", "litre", "litres"].includes(l)) return ["v", 1000];
  if (["", "piece", "pieces", "pc", "pcs", "u", "unite", "unites"].includes(l)) return ["u", 1];
  return ["x:" + l.replace(/s$/, ""), 1];
}
/* v in unit `from` → unit `to`, or null when they cannot be compared (cuillère vs kg…) */
function noteConv(v, from, to) { const a = noteUnitKey(from), b = noteUnitKey(to); if (a[0] !== b[0]) return null; return (v * a[1]) / b[1]; }
const noteQtyVal = (q) => { const p = noteParse(q); return p ? p.v.reduce((x, y) => x + y, 0) / p.v.length : null; };
/* food cost of one batch and one portion, from the linked products' prices (€ per stock unit) */
function recipeCost(note, seen = new Set()) {
  let batch = 0, known = 0, missing = 0; if (!note) return { batch: 0, portion: 0, complete: false, known: 0, missing: 0 }; seen = new Set(seen); seen.add(note.id);
  (note.ingredients || []).forEach((g) => {
    const L = noteIngLink(g); const v = noteQtyVal(g.qty); if (v == null) { if (L) missing++; return; }
    if (L && L.t === "p" && num(L.p.price) > 0) { const q = noteConv(v, g.unit, L.p.unit); if (q != null) { batch += q * num(L.p.price); known++; return; } }
    if (L && L.t === "n" && !seen.has(L.n.id)) { const c = recipeCost(L.n, seen); const sp = num(L.n.portions) || 1; const k = noteUnitKey(g.unit)[0] === "u" || /portion/.test(noteNorm(g.unit)) ? v / sp : /fourn/.test(noteNorm(g.unit)) ? v : null; if (k != null && c.known) { batch += c.batch * k; known++; return; } }
    missing++;
  });
  const por = num(note.portions) || 1; return { batch, portion: batch / por, complete: !missing && known > 0, known, missing };
}
function noteCostHTML(n) {
  const c = recipeCost(n); if (!c.known) return "";
  const pr = num(n.price); const ht = pr ? pr / 1.1 : 0; const ratio = ht ? (c.portion / ht) * 100 : 0;
  return `<div class="glass pad st nt-cost" style="--i:6"><span class="lbl">${ico("euro")}Coût matière</span>
    <div class="nt-costrow"><div><b class="mono">${noteEur(c.portion)}</b><em>par portion</em></div><div><b class="mono">${noteEur(c.batch)}</b><em>la fournée</em></div>${pr ? `<div class="${ratio > 35 ? "warn" : "ok"}"><b class="mono">${Math.round(ratio)} %</b><em>du prix HT</em></div>` : ""}</div>
    <p class="note" style="margin:0">${c.missing ? `Estimation : ${notePlural(c.missing, "ingrédient")} sans prix ou non lié au stock. ` : ""}D'après les prix du stock${pr ? `, prix de vente ${noteEur(pr)} TTC (TVA 10 %)` : ""}.</p></div>`;
}

/* ───────── utiliser la recette: deduct from stock ───────── */
function noteUses(n) {
  const G = {}; (S.moves || []).filter((m) => m.ref === n.id && m.kind === "recette").forEach((m) => { const k = m.use || m.at; (G[k] ||= { at: m.at, by: m.uid, batches: m.batches, n: 0 }).n++; });
  return Object.values(G).sort((a, b) => b.at - a.at);
}
function noteLastUseHTML(n) {
  const U = noteUses(n); if (!U.length) return ""; const u = U[0]; const b = num(u.batches);
  return `<p class="nt-lastuse">${ico("clock")}Utilisée ${when(u.at)}${b ? ` · ${b === Math.round(b) ? notePlural(b, "fournée") : noteNum(b) + " fournée"}` : ""} · ${esc(firstName(nameOf(u.by)))}${U.length > 1 ? ` · ${U.length} fois en tout` : ""}</p>`;
}
const noteBatches = (n, U) => { const por = num(n.portions) || 1; return U.mode === "p" ? U.v / por : U.v; };
function noteUsePlan(n, k) {
  const rows = [], skip = [];
  (n.ingredients || []).forEach((g) => {
    const L = noteIngLink(g); const nm = g.name || (L && L.t === "p" ? L.p.name : "");
    if (!L) { skip.push({ name: nm, why: "texte libre" }); return; }
    if (L.t === "n") { skip.push({ name: nm, why: "sous-recette, préparée à part" }); return; }
    const v = noteQtyVal(g.qty); if (v == null) { skip.push({ name: nm, why: "quantité manquante" }); return; }
    const q = noteConv(v * k, g.unit, L.p.unit); if (q == null) { skip.push({ name: nm, why: `unité « ${g.unit} » ≠ ${L.p.unit} du stock` }); return; }
    let lvl = null; if (typeof stockLevel === "function") { try { const x = stockLevel(L.p.id); lvl = x == null || isNaN(+x) ? null : +x; } catch (e) {} }
    const ex = rows.find((r) => r.p.id === L.p.id); if (ex) { ex.q += q; ex.names.push(nm); return; }
    rows.push({ p: L.p, q, lvl, names: [nm] });
  });
  return { rows, skip };
}
const noteQ3 = (v) => Math.round(v * 1000) / 1000;
function noteUseHTML() {
  const U = S.ui.noteUse; const n = S.notes.find((x) => x.id === U?.id); if (!n) return "";
  const por = num(n.portions) || 1; const k = noteBatches(n, U); const { rows, skip } = noteUsePlan(n, k); const totP = Math.round(k * por * 100) / 100;
  const quick = U.mode === "b" ? [0.5, 1, 2, 3, 5] : [...new Set([1, Math.max(1, Math.round(por / 2)), por, por * 2, por * 3])].sort((a, b) => a - b);
  const lbl = U.mode === "b" ? (U.v >= 2 ? "fournées" : "fournée") : U.v >= 2 ? "portions" : "portion";
  const list = rows.length ? `<ul class="nt-ulist">${rows.map((r, i) => { const after = r.lvl != null ? r.lvl - r.q : null; return `<li class="st" style="--i:${i}"><span class="nt-uname"><b>${esc(r.p.name)}</b>${after != null ? `<em class="${after < 0 ? "bad" : ""}">Stock ${noteNum(Math.max(0, r.lvl))} → <b>${noteNum(Math.max(0, after))}</b> ${esc(r.p.unit || "")}${after < 0 ? " · insuffisant" : ""}</em>` : `<em>Stock théorique non disponible</em>`}</span><b class="nt-uq mono">−${noteNum(r.q)}<small>${esc(r.p.unit || "")}</small></b></li>`; }).join("")}</ul>`
    : `<div class="nt-lempty"><b>Aucun ingrédient lié au stock</b><span class="note">Liez les ingrédients aux produits du stock dans « Modifier » pour les déduire en un geste.</span></div>`;
  return `<div class="h2" style="font-size:20px">Utiliser la recette</div><p class="sub" style="margin:0">${esc(n.title)} · ${notePlural(por, "portion")} par fournée</p>
    <div class="seg nt-useg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${U.mode === "p" ? 100 : 0}%)"></span><button class="${U.mode === "b" ? "on" : ""}" data-act="noteUseMode" data-v="b">Fournées</button><button class="${U.mode === "p" ? "on" : ""}" data-act="noteUseMode" data-v="p">Portions</button></div>
    <div class="nt-scaler nt-uscal"><button class="iconbtn nt-step" data-act="noteUseStep" data-v="-1" aria-label="Moins">${ico("minus")}</button><span class="nt-pval"><b class="mono" id="ntUseV">${noteNum(U.v)}</b><span>${lbl}</span></span><button class="iconbtn nt-step" data-act="noteUseStep" data-v="1" aria-label="Plus">${ico("plus")}</button></div>
    <div class="nt-quick">${quick.map((x) => `<button class="chip ${x === U.v ? "on" : ""}" data-act="noteUseSet" data-v="${x}">${noteNum(x)}</button>`).join("")}</div>
    <p class="nt-utot">${U.mode === "b" ? `Soit <b>${noteNum(totP)} portions</b>` : `Soit <b>${noteNum(Math.round(k * 100) / 100)} fournée${k >= 2 ? "s" : ""}</b>`}. Ce qui sera retiré du stock :</p>
    ${list}
    ${skip.length ? `<p class="note nt-uskip">Non déduits : ${skip.map((x) => `${esc(x.name)} (${esc(x.why)})`).join(", ")}.</p>` : ""}
    <div class="grid2 nt-useact"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="noteUseGo" ${rows.length ? "" : "disabled"}>${ico("check")}Déduire du stock</button></div>`;
}
function noteUsePaint() { const b = $("#sheetBody"); if (b && S.ui.noteUse) { b.innerHTML = noteUseHTML(); $$(".st", b).forEach((e) => (e.style.animation = "none")); } }

/* ───────── list rows: carte + examples ───────── */
function noteCarteRowHTML() {
  const C = S.notes.filter((n) => noteKind(n) === "Recettes" && n.carte); const q = C.filter((n) => noteAlToConfirm(n).length).length;
  return `<button class="glass nt-carterow st" style="--i:3" data-go="noteCarte"><span class="ic">${ico("ntMenu")}</span><span class="nt-crtx"><b>Carte & allergènes</b><em>${C.length ? `${notePlural(C.length, "plat")} à la carte${q ? ` · ${q} à vérifier` : ""} · tableau client à imprimer` : "Le tableau des 14 allergènes de votre carte, prêt à montrer au client"}</em></span><span class="nt-chev">${ico("chev")}</span></button>`;
}
function noteExamples() {
  const ing = (L) => L.map(([name, qty, unit]) => ({ name, qty, unit }));
  return [
    { seed: "croquettes", title: "Croquettes de jambon", cat: "Recettes", portions: 10, carte: true, carteCat: "partage", price: 9, allergens: ["gluten", "lait", "oeufs"],
      body: "Assiette de 4 croquettes. Se congèlent crues, panées : frire directement sans décongeler.",
      ingredients: ing([["Jambon blanc", "400", "g"], ["Beurre", "100", "g"], ["Farine", "120", "g"], ["Lait entier", "1", "L"], ["Œufs", "3", "pièce"], ["Chapelure", "250", "g"], ["Muscade", "1", "pincée"], ["Huile de friture", "", ""]]),
      steps: ["Faire fondre le beurre, ajouter la farine et cuire 2 min sans coloration.", "Verser le lait chaud en fouettant, cuire 5 min jusqu'à une béchamel très épaisse. Muscade, sel, poivre.", "Ajouter le jambon haché fin. Débarrasser en bac filmé au contact, refroidir en cellule.", "Façonner les croquettes, les passer dans l'œuf battu puis la chapelure.", "Frire à 180 °C, 3 à 4 min, jusqu'à coloration dorée. Égoutter et servir aussitôt."] },
    { seed: "planche", title: "Planche de charcuterie", cat: "Recettes", portions: 2, carte: true, carteCat: "partage", price: 18, allergens: ["sulfites", "lait", "gluten"],
      body: "Planche pour 2. Trancher la charcuterie au dernier moment, à la trancheuse propre.",
      ingredients: ing([["Jambon cru", "80", "g"], ["Saucisson sec", "80", "g"], ["Terrine de campagne", "100", "g"], ["Comté", "80", "g"], ["Pain de campagne", "150", "g"], ["Cornichons", "40", "g"], ["Beurre demi-sel", "20", "g"]]),
      steps: ["Sortir le fromage 30 min avant le service.", "Trancher le jambon cru et le saucisson finement.", "Couper la terrine en tranches de 1 cm et le comté en bâtonnets.", "Dresser sur la planche avec les cornichons, le beurre et le pain grillé."] },
  ];
}
function noteExRowHTML() {
  const miss = noteExamples().filter((e) => !S.notes.some((n) => n.seed === e.seed || noteNorm(n.title) === noteNorm(e.title)));
  const R = S.notes.filter((n) => noteKind(n) === "Recettes").length; if (!miss.length || R >= 6) return "";
  return `<div class="glass nt-starter nt-exrow st" style="--i:5"><div class="ic acc">${ico("ntMenu")}</div><div style="flex:1;min-width:0"><b class="h3">Exemples de la carte</b><p class="note" style="margin:3px 0 0">${miss.map((e) => esc(e.title)).join(" · ")}, avec leurs allergènes. Liés à votre stock quand le produit existe.</p></div><button class="btn soft sm" data-act="noteExCarte">${ico("plus")}Ajouter</button></div>`;
}

/* ───────── vue « Carte & allergènes » ───────── */
const noteCarteList = () => S.notes.filter((n) => noteKind(n) === "Recettes" && n.carte).sort((a, b) => NOTE_CARTE_CATS.findIndex((c) => c[0] === a.carteCat) - NOTE_CARTE_CATS.findIndex((c) => c[0] === b.carteCat) || String(a.title).localeCompare(String(b.title), "fr"));
const noteCarteGroups = (L) => NOTE_CARTE_CATS.map(([k]) => [k, L.filter((n) => (NOTE_CARTE_CATS.some((c) => c[0] === n.carteCat) ? n.carteCat : "plat") === k)]).filter((g) => g[1].length);
/* status of a dish for a client allergic to `sel`: ok / q (to check) / no (contains) */
function noteSafe(n, sel) {
  const on = recipeAllergens(n); const q = noteAlToConfirm(n); const bad = sel.filter((k) => on.includes(k));
  if (bad.length) return { s: "no", bad }; const qq = sel.filter((k) => q.includes(k));
  if (qq.length) return { s: "q", bad: qq }; if (!(n.ingredients || []).length && !on.length) return { s: "q", bad: [], empty: true };
  return { s: "ok", bad: [] };
}
function noteMatrixHTML(L, sel) {
  return `<div class="nt-mwrap"><table class="nt-mx"><thead><tr><th class="nt-mdish">Plat</th>${NOTE_ALLERGENS.map(([k, t]) => `<th class="${sel.includes(k) ? "sel" : ""}"><span>${t}</span></th>`).join("")}</tr></thead>
    <tbody>${noteCarteGroups(L).map(([c, G]) => `<tr class="nt-mcat"><td colspan="15"><span>${esc(NOTE_CARTE_PL[c])}</span></td></tr>${G.map((n) => { const on = recipeAllergens(n), q = noteAlToConfirm(n); return `<tr><td class="nt-mdish"><button data-go="fiche" data-id="${esc(n.id)}">${esc(n.title)}</button></td>${NOTE_ALLERGENS.map(([k, t]) => `<td class="${sel.includes(k) ? "sel" : ""}">${on.includes(k) ? `<i class="nt-dot" title="${esc(t)}"></i>` : q.includes(k) ? `<i class="nt-dot q" title="${esc(t)} à confirmer">?</i>` : ""}</td>`).join("")}</tr>`; }).join("")}`).join("")}</tbody></table></div>`;
}
function noteCarteBody() {
  const L = noteCarteList(); const sel = S.ui.noteAlSel || [];
  if (!L.length) return "";
  const qn = L.filter((n) => noteAlToConfirm(n).length).length;
  let res = "";
  if (sel.length) {
    const R = L.map((n) => ({ n, r: noteSafe(n, sel) })); const ok = R.filter((x) => x.r.s === "ok"), q = R.filter((x) => x.r.s === "q"), no = R.filter((x) => x.r.s === "no");
    const item = ({ n, r }, i) => `<button class="nt-sres ${r.s} st" style="--i:${Math.min(i, 12)}" data-go="fiche" data-id="${esc(n.id)}"><span class="nt-sic">${ico(r.s === "ok" ? "check" : r.s === "q" ? "alert" : "x")}</span><span class="nt-stx"><b>${esc(n.title)}</b><em>${esc(noteCarteCat(n.carteCat))}${r.s === "no" ? ` · contient ${esc(r.bad.map(noteAllergenLabel).join(", ").toLowerCase())}` : r.s === "q" ? (r.empty ? " · fiche sans ingrédients" : ` · ${esc(r.bad.map(noteAllergenLabel).join(", ").toLowerCase())} à confirmer`) : ""}</em></span></button>`;
    res = `<div class="nt-sres-h st" style="--i:1"><b class="mono">${ok.length}</b> plat${ok.length > 1 ? "s" : ""} sans ${esc(sel.map(noteAllergenLabel).join(", ").toLowerCase())}${q.length ? ` · <span class="w">${q.length} à vérifier</span>` : ""}</div>
      <div class="nt-sgrid">${ok.map(item).join("")}${ok.length ? "" : `<div class="glass empty"><b>Aucun plat sûr</b>Proposez au chef d'adapter un plat, sans contamination croisée.</div>`}</div>
      ${q.length ? `<span class="lbl">À vérifier en cuisine</span><div class="nt-sgrid">${q.map(item).join("")}</div>` : ""}
      ${no.length ? `<details class="nt-sno"><summary>${notePlural(no.length, "plat")} à éviter</summary><div class="nt-sgrid">${no.map(item).join("")}</div></details>` : ""}`;
  }
  return `<div class="glass pad nt-filter st" style="--i:2"><div class="nt-fh"><div><b class="h3">Que peut manger un client allergique à… ?</b><p class="note" style="margin:2px 0 0">Choisissez une ou plusieurs allergies.</p></div>${sel.length ? `<button class="btn ghost sm" data-act="noteAlSelClear">${ico("x")}Effacer</button>` : ""}</div>
      <div class="nt-fchips">${NOTE_ALLERGENS.map(([k, t]) => `<button class="nt-fchip ${sel.includes(k) ? "on" : ""}" data-act="noteAlSel" data-v="${k}" aria-pressed="${sel.includes(k)}">${t}</button>`).join("")}</div>
      ${res ? `<div class="nt-sres-wrap">${res}</div>` : ""}</div>
    <div class="glass pad nt-mcard st" style="--i:3"><div class="nt-fh"><div><b class="h3">Tableau des allergènes</b><p class="note" style="margin:2px 0 0">${notePlural(L.length, "plat")} à la carte${qn ? ` · <span class="nt-warn">${qn} avec des allergènes à confirmer (?)</span>` : ""}</p></div></div>
      ${noteMatrixHTML(L, sel)}
      <p class="note nt-mleg"><i class="nt-dot"></i> contient &nbsp; <i class="nt-dot q">?</i> à confirmer sur la fiche</p></div>`;
}
VIEWS.noteCarte = {
  render() {
    const L = noteCarteList(); const others = S.notes.filter((n) => noteKind(n) === "Recettes" && !n.carte).length;
    const top = topBar("Carte & allergènes", { right: L.length ? `<button class="btn acc sm nt-cprint" data-act="noteCartePrint">${ico("printer")}<span>Imprimer</span></button>` : "" });
    const empty = `<div class="glass empty st" style="--i:2"><div class="ic">${ico("ntMenu")}</div><b>Aucun plat à la carte</b>Sur chaque fiche recette, activez « À la carte » et choisissez sa catégorie : entrée, plat, dessert, à partager ou boisson. Le tableau des allergènes se remplit tout seul.
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${others ? `<button class="btn acc sm" data-act="noteCarteAdd">${ico("plus")}Choisir les plats</button>` : `<button class="btn acc sm" data-act="noteNew" data-v="Recettes">${ico("plus")}Créer une recette</button>`}${noteExRowHTML() ? `<button class="btn soft sm" data-act="noteExCarte">${ico("sparkle")}Ajouter les exemples</button>` : ""}</div></div>`;
    return `<div class="inner wide nt-wrap nt-carte">${top}
      <p class="sub st" style="--i:1;margin:-6px 0 0">Information obligatoire : les 14 allergènes de chaque plat, à montrer au client sur simple demande.</p>
      <div id="ntCarteBody" class="nt-cbody2">${L.length ? noteCarteBody() : empty}</div>
      ${L.length && others ? `<button class="nt-addph st" style="--i:5" data-act="noteCarteAdd">${ico("plus")}<span>Ajouter des plats à la carte</span><em>${notePlural(others, "recette")}</em></button>` : ""}
      ${L.length ? `<div class="ctabar nt-cprintbar st" style="--i:6"><button class="btn acc block" data-act="noteCartePrint">${ico("printer")}Imprimer le tableau client</button></div>` : ""}</div>`;
  },
  after() { setTimeout(() => { const b = $('#side .nav[data-go="notes"]'); b && b.classList.add("on"); }, 0); },
};
function noteCartePaint() { const b = $("#ntCarteBody"); if (!b) return; b.innerHTML = noteCarteBody(); $$(".nt-filter.st, .nt-mcard.st", b).forEach((e) => (e.style.animation = "none")); }
/* printable A4: the regulatory table for clients */
function noteCarteDocHTML() {
  const L = noteCarteList(); const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const head = `<tr><th class="ntc-d">Nos plats</th>${NOTE_ALLERGENS.map(([k, t]) => `<th class="ntc-a"><span>${t}</span></th>`).join("")}</tr>`;
  const body = noteCarteGroups(L).map(([c, G]) => `<tr class="ntc-cat"><td colspan="15">${esc(NOTE_CARTE_PL[c])}</td></tr>${G.map((n) => { const on = recipeAllergens(n, true); return `<tr><td class="ntc-d">${esc(n.title)}</td>${NOTE_ALLERGENS.map(([k]) => `<td class="ntc-a">${on.includes(k) ? "●" : ""}</td>`).join("")}</tr>`; }).join("")}`).join("");
  return `<article class="ntd ntc-doc"><header class="ntd-h"><div class="ntd-hl"><div class="ntd-k">Information des consommateurs · allergènes</div><h1>${esc(S.resto?.name || "Notre carte")}</h1>
      <div class="ntd-meta"><span>Allergènes présents dans nos plats</span><span>Mis à jour le ${today}</span></div></div>
      <div class="ntd-logo">${(() => { try { return typeof appIcon === "function" ? appIcon(36) : logoMark({ mono: "#5B2BFF" }); } catch (e) { return ""; } })()}</div></header>
    <table class="ntc-t"><thead>${head}</thead><tbody>${body}</tbody></table>
    <p class="ntc-leg">● : le plat contient cet allergène ou des produits qui en contiennent.</p>
    <p class="ntc-law">Liste des 14 allergènes à déclaration obligatoire (règlement UE n° 1169/2011, annexe II ; décret n° 2015-447). Nos plats sont préparés dans une cuisine où tous ces allergènes sont présents : des traces restent possibles. Une allergie ou une intolérance ? Parlez-en à notre équipe avant de commander.</p>
    <footer class="ntd-f">${esc(S.resto?.name || "")} · Tableau des allergènes · ${today}</footer></article>`;
}

Object.assign(ACT, {
  /* allergen suggestions on the read view */
  noteAlOk: async (a, id, v) => {
    const n = S.notes.find((x) => x.id === id); if (!n || a.disabled) return; a.disabled = true;
    try { await safe(DB.update("notes", id, { allergens: [...new Set([...(n.allergens || []).map(noteAlId), v])], alNo: (n.alNo || []).filter((x) => x !== v), updatedAt: Date.now() })); } catch (e) { a.disabled = false; return; }
    await logEvent("note", `a confirmé l'allergène ${noteAllergenLabel(v).toLowerCase()} sur « ${n.title} »`, { ref: id });
    const row = a.closest(".nt-alqr"); if (row) row.classList.add("bye"); SFX.ok(); buzz(8); toast(`${noteAllergenLabel(v)} : confirmé`); setTimeout(rerender, row ? 240 : 60);
  },
  noteAlNo: async (a, id, v) => {
    const n = S.notes.find((x) => x.id === id); if (!n || a.disabled) return; a.disabled = true;
    try { await safe(DB.update("notes", id, { alNo: [...new Set([...(n.alNo || []), v])], updatedAt: Date.now() })); } catch (e) { a.disabled = false; return; }
    await logEvent("note", `a écarté l'allergène ${noteAllergenLabel(v).toLowerCase()} sur « ${n.title} »`, { ref: id });
    SFX.close(); toast(`${noteAllergenLabel(v)} : non`); setTimeout(rerender, 60);
  },
  /* editor: links */
  noteLink: (a, id, v) => {
    const i = +v; const g = S.ui.note.ingredients[i]; if (!g) return; const q = String(g.name || "").trim(); const blur = document.activeElement; if (blur && blur.blur) blur.blur();
    openSheet(`<div class="h2" style="font-size:20px">Lier « ${esc(q || "l'ingrédient")} »</div><p class="sub" style="margin:0">Ses allergènes s'ajoutent à la fiche et « Utiliser la recette » le retire du stock.</p>
      <div class="nt-search">${ico("search")}<input class="input" id="ntLinkQ" type="search" autocomplete="off" placeholder="Chercher un produit…" value="${esc(q)}"></div>
      <div class="nt-llist" id="ntLinkL">${noteLinkListHTML(i, q)}</div>
      ${g.productId || g.noteId ? `<button class="btn soft block" data-act="noteLinkFree" data-v="${i}">${ico("x")}Garder en texte libre</button>` : ""}`, (b) => {
      const inp = $("#ntLinkQ", b); const L = $("#ntLinkL", b);
      inp.addEventListener("input", debounce(() => { L.innerHTML = noteLinkListHTML(i, inp.value); }, 120));
      if (q && !L.querySelector(".nt-lrow")) { inp.value = ""; L.innerHTML = noteLinkListHTML(i, ""); }
    });
  },
  noteLinkSet: (a, id, v) => {
    const g = S.ui.note.ingredients[+id]; if (!g) return; const [t, x] = v.split(":"); delete g.productId; delete g.noteId; delete g.free;
    if (t === "p") { const p = S.products.find((y) => y.id === x); g.productId = x; if (!String(g.name || "").trim() && p) g.name = p.name; if (p && !String(g.qty || "").trim() && noteUnitKey(g.unit)[0] !== noteUnitKey(p.unit)[0]) g.unit = p.unit === "kg" ? "g" : p.unit === "L" ? "cl" : p.unit; }
    else { const n = S.notes.find((y) => y.id === x); g.noteId = x; if (!String(g.name || "").trim() && n) g.name = n.title; if (!String(g.qty || "").trim()) { g.qty = "1"; g.unit = "portion"; } }
    closeSheet(true); SFX.ok(); buzz(6); noteRer();
  },
  noteLinkFree: (a, id, v) => { const g = S.ui.note.ingredients[+v]; if (!g) return; delete g.productId; delete g.noteId; g.free = true; closeSheet(true); SFX.close(); noteRer(); },
  noteCarteTog: () => { const N = S.ui.note; N.carte = !N.carte; if (N.carte && !N.carteCat) N.carteCat = "plat"; SFX.tick(); buzz(6); noteRer(); },
  noteCarteCatSet: (a, id, v) => { S.ui.note.carteCat = v; $$(".nt-ccats .chip").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); SFX.tick(); buzz(4); },
  /* utiliser la recette */
  noteUse: (a, id) => {
    const n = S.notes.find((x) => x.id === id); if (!n) return; const base = num(n.portions) || 1; const P = S.ui.notePortions?.[id];
    S.ui.noteUse = P && P !== base ? { id, mode: "p", v: P } : { id, mode: "b", v: 1 }; SFX.tap(); openSheet(noteUseHTML());
  },
  noteUseMode: (a, id, v) => {
    const U = S.ui.noteUse; if (!U || U.mode === v) return; const n = S.notes.find((x) => x.id === U.id); const por = num(n?.portions) || 1;
    U.v = v === "p" ? Math.max(1, Math.round(U.v * por * 100) / 100) : Math.max(0.5, Math.round((U.v / por) * 2) / 2); U.mode = v; SFX.tick(); buzz(4); noteUsePaint();
  },
  noteUseStep: (a, id, v) => {
    const U = S.ui.noteUse; if (!U) return; const st = U.mode === "b" ? (U.v < 1 || (U.v === 1 && +v < 0) ? 0.5 : 1) : 1;
    let nx = +v > 0 ? Math.floor(U.v / st + 1e-9) * st + st : Math.ceil(U.v / st - 1e-9) * st - st; nx = Math.round(nx * 100) / 100;
    const min = U.mode === "b" ? 0.5 : 1; if (nx < min || nx > 9999) { SFX.err(); buzz(20); return; }
    U.v = nx; SFX.tick(); buzz(4); noteUsePaint(); const e = $("#ntUseV"); if (e) e.classList.add("bump");
  },
  noteUseSet: (a, id, v) => { const U = S.ui.noteUse; if (!U) return; U.v = +v; SFX.tick(); buzz(4); noteUsePaint(); },
  noteUseGo: async (a) => {
    const U = S.ui.noteUse; const n = S.notes.find((x) => x.id === U?.id); if (!n || a.disabled || S.ui.noteUseBusy) return;
    const k = noteBatches(n, U); const { rows } = noteUsePlan(n, k); if (!rows.length) return; a.disabled = true; S.ui.noteUseBusy = true;
    const use = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); const at = Date.now(); const ids = [];
    try {
      for (const r of rows) {
        const doc = { productId: r.p.id, name: r.p.name, qty: -noteQ3(r.q), unit: r.p.unit || "", kind: "recette", ref: n.id, refType: "note", use, batches: Math.round(k * 100) / 100, at, uid: S.me.id, by: S.me.name || "" };
        const mid = typeof stockMove === "function" ? await stockMove(doc) : await safe(DB.add("moves", doc)); if (typeof mid === "string") ids.push(mid);
      }
    } catch (e) { console.warn(e); }
    const por = num(n.portions) || 1; const totP = Math.round(k * por * 100) / 100;
    let evId = null; try { evId = await DB.add("events", { type: "note", text: `a utilisé la recette « ${n.title} » : ${U.mode === "b" ? notePlural(noteNum(k), "fournée") + `, ${noteNum(totP)} portions` : notePlural(noteNum(totP), "portion")}, ${notePlural(rows.length, "produit")} retiré${rows.length > 1 ? "s" : ""} du stock`, at, uid: S.me.id, ref: n.id, use }); } catch (e) {}
    S.ui.noteUseBusy = false; S.ui.noteUseUndo = { use, ids, evId, title: n.title }; S.ui.noteUse = null;
    closeSheet(true); const r = a.getBoundingClientRect(); SFX.done(); buzz(14); burst(r.left + r.width / 2, r.top);
    toastUndo(`Stock mis à jour : ${notePlural(rows.length, "produit")}`); const ub = $("#toastTx button"); if (ub) ub.dataset.act = "noteUseUndo";
    setTimeout(() => { if (S.route === "fiche") rerender(); }, 120);
  },
  noteUseUndo: async () => {
    const u = S.ui.noteUseUndo; if (!u) return; S.ui.noteUseUndo = null;
    const ids = [...new Set([...u.ids, ...(S.moves || []).filter((m) => m.use === u.use).map((m) => m.id)])];
    for (const id of ids) await DB.del("moves", id).catch(() => {});
    if (u.evId) await DB.del("events", u.evId).catch(() => {});
    $("#toast").classList.remove("on"); SFX.close(); toast("Utilisation annulée, stock rétabli"); setTimeout(() => { if (S.route === "fiche") rerender(); }, 120);
  },
  /* carte view */
  noteAlSel: (a, id, v) => { const L = (S.ui.noteAlSel ||= []); const on = !L.includes(v); if (on) L.push(v); else L.splice(L.indexOf(v), 1); SFX.tick(); buzz(5); noteCartePaint(); const b = $(`.nt-fchip[data-v="${v}"]`); if (b && on) b.classList.add("pop"); },
  noteAlSelClear: () => { S.ui.noteAlSel = []; SFX.close(); noteCartePaint(); },
  noteCartePrint: () => {
    const L = noteCarteList(); if (!L.length) return; const q = L.filter((n) => noteAlToConfirm(n).length);
    if (q.length && !S.ui.noteCarteQOk) { openSheet(`<div class="h2" style="font-size:20px">${notePlural(q.length, "plat")} à vérifier</div><p class="sub" style="margin:0">Des allergènes ne sont pas encore confirmés : ${esc(q.map((n) => n.title).join(", "))}. Par prudence, ils sont imprimés comme présents.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Vérifier d'abord</button><button class="btn acc" data-act="noteCartePrintGo">${ico("printer")}Imprimer</button></div>`); return; }
    ACT.noteCartePrintGo();
  },
  noteCartePrintGo: () => {
    closeSheet(true); notePrintCleanup(); const box = document.createElement("div"); box.id = "ntPrint"; box.innerHTML = noteCarteDocHTML(); document.body.appendChild(box);
    document.documentElement.classList.add("nt-printing"); notePrintCleanup.t = document.title; document.title = `Allergènes - ${S.resto?.name || "carte"}`.replace(/[\/\\:]/g, "-");
    SFX.print ? SFX.print() : SFX.tap(); buzz(8); logEvent("note", "a imprimé le tableau des allergènes de la carte"); setTimeout(() => { try { window.print(); } catch (e) {} }, 80);
  },
  noteCarteAdd: () => {
    const R = S.notes.filter((n) => noteKind(n) === "Recettes" && !n.carte).sort((a, b) => String(a.title).localeCompare(String(b.title), "fr"));
    openSheet(`<div class="h2" style="font-size:20px">Ajouter à la carte</div><p class="sub" style="margin:0">Choisissez la catégorie de chaque plat.</p>
      <div class="nt-cadd">${R.map((n) => `<div class="nt-caddr"><b>${esc(n.title)}</b><div class="nt-ccats">${NOTE_CARTE_CATS.map(([k, t]) => `<button class="chip" data-act="noteCarteSet" data-id="${esc(n.id)}" data-v="${k}">${t}</button>`).join("")}</div></div>`).join("")}</div>`);
  },
  noteCarteSet: async (a, id, v) => {
    const n = S.notes.find((x) => x.id === id); if (!n || a.disabled) return; a.disabled = true;
    try { await safe(DB.update("notes", id, { carte: true, carteCat: v, updatedAt: Date.now() })); } catch (e) { a.disabled = false; return; }
    await logEvent("note", `a mis « ${n.title} » à la carte (${noteCarteCat(v).toLowerCase()})`, { ref: id });
    const row = a.closest(".nt-caddr"); SFX.ok(); buzz(8); if (row) { row.classList.add("bye"); setTimeout(() => { row.remove(); if (!$(".nt-caddr")) closeSheet(); }, 260); }
    setTimeout(() => { if (S.route === "noteCarte") rerender(); }, 300);
  },
  noteExCarte: async (a) => {
    if (a.disabled) return; a.disabled = true; const t = Date.now(); let n = 0;
    const miss = noteExamples().filter((e) => !S.notes.some((x) => x.seed === e.seed || noteNorm(x.title) === noteNorm(e.title)));
    try { for (const e of miss) { const d = { ...e, ingredients: e.ingredients.map(noteIngClean), uid: S.me.id, at: t + n, updatedAt: t + n, photo: "", files: [] }; const id = await safe(DB.add("notes", d)); await logEvent("note", `a ajouté la fiche « ${d.title} »`, { ref: id }); n++; } } catch (e) { a.disabled = false; return; }
    SFX.done(); buzz(14); const r = a.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); toast(`${notePlural(n, "fiche")} ajoutée${n > 1 ? "s" : ""}`); S.noteCat = "Recettes"; setTimeout(rerender, 80);
  },
});
