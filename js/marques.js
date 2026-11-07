/* Growth Gusto — « Marques et points de vente » (route « marques », préfixe « mq »). Pack Chef.
   Trouvé par la simulation de 15 restaurants (tools/sim) : une dark kitchen qui vend 4 marques depuis une seule cuisine, un hôtel
   (restaurant, bar, petit-déjeuner) ne savaient pas ce que rapporte chaque marque : tout était mélangé dans un seul chiffre.
   Données : restos/{rid}.brands = [{ id, name, color }] ; un plat (notes, cat « Recettes ») porte { brand: id } (vide = carte principale).
   Chiffres : lignes des tickets Z (caisse, import, livraison) reliées à une fiche (tkRecipeFor), sur 7 ou 30 jours : CA TTC et HT,
   plats vendus, coût matière (mgDish), food cost, marge brute. Les ventes non reliées à une fiche sont comptées à part. */
"use strict";

TAB_OF.marques = "more";
Object.assign(IC, { mqTags: ["f:M3 11.5V4a1 1 0 0 1 1-1h7.5l8.8 8.8a1.4 1.4 0 0 1 0 2l-6.5 6.5a1.4 1.4 0 0 1-2 0z", "M3 11.5V4a1 1 0 0 1 1-1h7.5l8.8 8.8a1.4 1.4 0 0 1 0 2l-6.5 6.5a1.4 1.4 0 0 1-2 0z", "c:7.5,7.5,1.4", "M14 3.5l7 7"] });
try { if (typeof AB_GATE !== "undefined") AB_GATE.marques = ["complet", "Marques et points de vente"]; } catch (e) {}
const MQ_COLORS = ["#5B2BFF", "#EF5A3C", "#16A37B", "#E6A100", "#2F7BEA", "#D63B8F", "#0E8C9B", "#7A5A1A"];
const MQ = { days: 30, edit: null };
const mqList = () => (S.resto && Array.isArray(S.resto.brands) ? S.resto.brands : []);
const mqById = (id) => mqList().find((b) => b.id === id) || null;
const mqOf = (n) => (n && n.brand ? mqById(n.brand) : null);
const mqBoss = () => DB.mode === "demo" || myRole() === "gerant";
const mqDishes = () => (S.notes || []).filter((n) => (typeof noteKind === "function" ? noteKind(n) : n.cat) === "Recettes" && (n.carte || num(n.price) > 0));
const mqEur = (v) => (v == null || isNaN(v) ? "–" : `${Math.round(v).toLocaleString("fr-FR")} €`);
const mqPct = (v) => (v == null || !isFinite(v) ? "–" : `${Math.round(v)} %`);
const mqPl = (n, one, many) => `${n.toLocaleString("fr-FR")} ${n > 1 ? many || one + "s" : one}`;

function mqStats(days = MQ.days) {
  const from = addDays(dayKey(), -days + 1); const cache = {}; const B = {}; const loose = { ca: 0, qty: 0 };
  const row = (k) => (B[k] ||= { ca: 0, ht: 0, cost: 0, qty: 0, costKnown: 0, dishes: {} });
  const dish = (r) => { if (cache[r.id] === undefined) { try { cache[r.id] = typeof mgDish === "function" ? mgDish(r) : null; } catch (e) { cache[r.id] = null; } } return cache[r.id]; };
  (S.tickets || []).filter((t) => (t.date || "") >= from).forEach((t) => (t.lines || []).forEach((l) => {
    const q = num(l.quantite) || 0; if (q <= 0) return;
    const r = typeof tkRecipeFor === "function" ? tkRecipeFor(l) : l.noteId ? (S.notes || []).find((n) => n.id === l.noteId) : null;
    const amt = num(l.montant) != null && num(l.montant) > 0 ? num(l.montant) : r && num(r.price) > 0 ? q * num(r.price) : 0;
    if (!r) { loose.ca += amt; loose.qty += q; return; }
    const k = mqById(r.brand) ? r.brand : ""; const x = row(k); const d = dish(r); const vat = d ? d.vat : 10;
    x.ca += amt; x.ht += amt / (1 + vat / 100); x.qty += q; x.dishes[r.id] = (x.dishes[r.id] || 0) + q;
    if (d && d.known) { x.cost += q * d.cost; x.costKnown += amt / (1 + vat / 100); }
  }));
  const total = Object.values(B).reduce((s, x) => s + x.ca, 0) + loose.ca;
  Object.values(B).forEach((x) => { x.fc = x.costKnown ? (x.cost / x.costKnown) * 100 : null; x.margin = x.costKnown ? x.ht - x.cost * (x.ht / x.costKnown) : null; x.share = total ? x.ca / total : 0; });
  return { B, loose, total, from };
}

function mqCard(b, x, i, n) {
  const top = Object.entries((x && x.dishes) || {}).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([id, q]) => { const d = (S.notes || []).find((z) => z.id === id); return d ? `${esc(d.title)} (${q})` : ""; }).filter(Boolean).join(" · ");
  return `<div class="glass mq-card st" style="--i:${i};--mq:${b.color || "#8a8fa8"}">
    <div class="mq-hd"><span class="mq-dot"></span><div class="tx"><b>${esc(b.name)}</b><em>${mqPl(n, "plat")} à la carte${x && x.qty ? ` · ${mqPl(Math.round(x.qty), "vendu")}` : ""}</em></div>
      ${b.id && mqBoss() ? `<button class="iconbtn" data-act="mqEdit" data-v="${esc(b.id)}" aria-label="Modifier ${esc(b.name)}">${ico("edit")}</button>` : ""}</div>
    <div class="mq-kpi"><span><b class="mono">${mqEur(x ? x.ca : 0)}</b>CA TTC</span><span><b class="mono">${x && x.margin != null ? mqEur(x.margin) : "–"}</b>marge brute</span><span><b class="mono">${mqPct(x ? x.fc : null)}</b>food cost</span></div>
    <div class="mq-bar"><i style="width:${Math.round(((x && x.share) || 0) * 100)}%"></i></div><p class="mq-share">${Math.round(((x && x.share) || 0) * 100)} % du chiffre${top ? ` · ${top}` : ""}</p>
    ${mqBoss() ? `<button class="btn soft sm" data-act="mqDishes" data-v="${esc(b.id)}">${ico("mqTags")}Choisir ses plats</button>` : ""}
  </div>`;
}

VIEWS.marques = {
  render() {
    const L = mqList(); const st = mqStats(); const D = mqDishes(); let i = 2;
    const count = (id) => D.filter((n) => (mqById(n.brand) ? n.brand : "") === id).length;
    const add = mqBoss() ? `<button class="btn acc sm" data-act="mqEdit" data-v="">${ico("plus")}Ajouter</button>` : "";
    const seg = `<div class="seg mq-seg st" style="--i:1"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${MQ.days === 30 ? "100%" : "0"})"></span><button class="${MQ.days === 7 ? "on" : ""}" data-act="mqDays" data-v="7">7 jours</button><button class="${MQ.days === 30 ? "on" : ""}" data-act="mqDays" data-v="30">30 jours</button></div>`;
    if (!L.length) return `<div class="inner narrow mq">${topBar("Marques", { right: add })}
      <div class="glass empty st" style="--i:1"><span class="ic">${ico("mqTags")}</span><b>Plusieurs marques, une seule cuisine</b>Dark kitchen, food court, hôtel avec restaurant, bar et petit-déjeuner : créez une marque par enseigne ou point de vente, rangez-y ses plats, et voyez ce que chacune rapporte.${mqBoss() ? `<button class="btn acc" style="margin-top:14px" data-act="mqEdit" data-v="">${ico("plus")}Ajouter une marque</button>` : ""}</div></div>`;
    const main = { id: "", name: "Carte principale", color: "#8a8fa8" };
    const cards = [...L.map((b) => mqCard(b, st.B[b.id], i++, count(b.id))), count("") || st.B[""] ? mqCard(main, st.B[""], i++, count("")) : ""].join("");
    return `<div class="inner wide mq">${topBar("Marques", { right: add })}
      ${seg}
      <div class="glass mq-sum st" style="--i:${i++}"><span><b class="mono">${mqEur(st.total)}</b>chiffre TTC sur ${MQ.days} jours</span>${st.loose.ca ? `<em>dont ${mqEur(st.loose.ca)} de ventes non reliées à une fiche : <a href="#" data-go="tickets">les relier</a></em>` : ""}</div>
      <div class="mq-grid">${cards}</div>
      <p class="note st" style="--i:${i++}">Chiffres tirés des tickets Z (caisse, import, livraison) reliés à une fiche recette. Marge brute = ventes HT moins coût matière des fiches.</p>
    </div>`;
  },
};

function mqEditSheet() {
  const E = MQ.edit; const used = mqList().map((b) => b.color);
  return `<div class="mq-es"><div class="h2">${E.id ? "Modifier la marque" : "Nouvelle marque"}</div>
    <label class="field" style="margin-top:12px"><span>Nom</span><input class="input" id="mqN" maxlength="40" value="${esc(E.name)}" placeholder="Ex. Smash Club, Bar du Lac, Petit-déjeuner"></label>
    <div class="field"><span>Couleur</span><div class="rh-cols">${MQ_COLORS.map((c) => `<button class="${E.color === c ? "on" : ""}" style="background:${c}" data-act="mqColor" data-v="${c}" aria-label="Couleur ${c}${used.includes(c) && E.color !== c ? " (déjà prise)" : ""}"></button>`).join("")}</div></div>
    <button class="btn acc block" style="margin-top:14px" data-act="mqSave">${ico("check")}Enregistrer</button>
    ${E.id ? `<button class="btn soft block" style="margin-top:8px" data-act="mqDel">${ico("trash")}Supprimer la marque</button><p class="note">Ses plats reviennent dans la carte principale. Rien n'est perdu.</p>` : ""}
  </div>`;
}
function mqDishSheet(id) {
  const b = mqById(id) || { id: "", name: "Carte principale" }; const D = mqDishes().slice().sort((x, y) => (x.title || "").localeCompare(y.title || ""));
  return `<div class="mq-ds"><div class="h2">Plats de ${esc(b.name)}</div><p class="sub">Touchez un plat pour le ranger dans cette marque. Un plat n'appartient qu'à une marque.</p>
    <div class="glass pad" style="margin-top:12px">${D.length ? D.map((n) => { const cur = mqOf(n); const on = (cur ? cur.id : "") === b.id; return `<button class="li tap mq-di ${on ? "on" : ""}" data-act="mqPut" data-id="${esc(n.id)}" data-v="${esc(b.id)}" aria-pressed="${on}"><span class="mq-ck">${on ? ico("check") : ""}</span><div class="tx"><b>${esc(n.title || "Plat")}</b><em>${cur && !on ? `Aujourd'hui dans ${esc(cur.name)}` : on ? "Dans cette marque" : "Carte principale"}${num(n.price) > 0 ? ` · ${fmt(num(n.price), 2)} €` : ""}</em></div></button>`; }).join("") : `<p class="sub" style="margin:0">Aucun plat à la carte pour l'instant : ajoutez vos recettes avec un prix de vente.</p>`}</div>
    <button class="btn acc block" style="margin-top:14px" data-act="sheetClose">${ico("check")}Terminé</button></div>`;
}
async function mqWrite(brands) {
  if (!S.rid || !mqBoss()) { toast("Seul le gérant change les marques.", "err"); return false; }
  try { await DB.update("restos", S.rid, { brands }); } catch (e) { toast("Pas enregistré, réessayez.", "err"); return false; }
  if (S.resto) S.resto.brands = brands; return true;
}
Object.assign(ACT, {
  mqDays: (a, id, v) => { MQ.days = +v === 7 ? 7 : 30; SFX.tick(); rerender(); },
  mqEdit: (a, id, v) => { if (!mqBoss()) return; const b = mqById(v); const used = mqList().map((x) => x.color); MQ.edit = b ? { ...b } : { id: "", name: "", color: MQ_COLORS.find((c) => !used.includes(c)) || MQ_COLORS[0] }; SFX.tap(); openSheet(mqEditSheet()); setTimeout(() => { const i = $("#mqN"); if (i && !b) i.focus(); }, 60); },
  mqColor: (a, id, v) => { if (!MQ.edit) return; MQ.edit.name = ($("#mqN") || {}).value ?? MQ.edit.name; MQ.edit.color = v; SFX.tick(); openSheet(mqEditSheet()); },
  mqSave: async () => {
    const E = MQ.edit; if (!E) return; const name = (($("#mqN") || {}).value || "").trim().slice(0, 40);
    if (!name) return toast("Donnez un nom à la marque.", "err");
    if (mqList().some((b) => b.id !== E.id && b.name.toLowerCase() === name.toLowerCase())) return toast("Cette marque existe déjà.", "err");
    const nid = E.id || "b" + Date.now().toString(36);
    const L = E.id ? mqList().map((b) => (b.id === E.id ? { ...b, name, color: E.color } : b)) : [...mqList(), { id: nid, name, color: E.color }];
    if (!(await mqWrite(L))) return;
    MQ.edit = null; SFX.ok(); toast(E.id ? "Marque modifiée" : `${name} ajoutée`); try { Promise.resolve(logEvent("settings", E.id ? `a modifié la marque ${name}` : `a créé la marque ${name}`)).catch(() => {}); } catch (e) {}
    if (E.id) { closeSheet(); rerender(); } else { openSheet(mqDishSheet(nid)); rerender(); }
  },
  mqDel: async () => {
    const E = MQ.edit; if (!E || !E.id) return;
    if (!(await mqWrite(mqList().filter((b) => b.id !== E.id)))) return;
    for (const n of mqDishes().filter((x) => x.brand === E.id)) await safe(DB.update("notes", n.id, { brand: "" }));
    MQ.edit = null; closeSheet(); SFX.tap(); toast(`${E.name} supprimée`); rerender();
  },
  mqDishes: (a, id, v) => { if (!mqBoss()) return; SFX.tap(); openSheet(mqDishSheet(v || "")); },
  mqPut: async (a, id, v) => {
    const n = (S.notes || []).find((x) => x.id === id); if (!n || !mqBoss()) return;
    const cur = mqById(n.brand) ? n.brand : ""; const next = cur === v ? "" : v; SFX.tick();
    await safe(DB.update("notes", n.id, { brand: next })); n.brand = next;
    const b = $("#sheetBody"); const y = b ? b.scrollTop : 0; openSheet(mqDishSheet(v)); const b2 = $("#sheetBody"); if (b2) b2.scrollTop = y;
  },
});

/* Réglages : la ligne « Marques et points de vente » (gérant) ; Marges : un bouton « Par marque » quand il y a des marques */
(function mqHooks() {
  const R = VIEWS.reglages;
  if (R && !R._mq) {
    const r0 = R.render; R._mq = true;
    R.render = function () {
      const h = r0.apply(this, arguments); if (!S.resto || !mqBoss()) return h;
      const L = mqList();
      const row = `<div class="li tap" data-go="marques"><span class="ic w-vi">${ico("mqTags")}</span><div class="tx"><b>Marques et points de vente</b><em>${L.length ? esc(L.map((b) => b.name).join(", ")) : "Plusieurs enseignes dans une même cuisine"}</em></div>${ico("chev")}</div>`;
      for (const k of ['<div class="li tap" data-act="jnOpen"', '<div class="li tap" data-go="fonctions"', '<div class="li tap" data-go="priseEnMain"', '<div class="li tap" data-go="imprimante"']) { const i = h.indexOf(k); if (i >= 0) return h.slice(0, i) + row + h.slice(i); }
      return h;
    };
  }
  const M = VIEWS.marges;
  if (M && !M._mq) {
    const m0 = M.render; M._mq = true;
    M.render = function () {
      const h = m0.apply(this, arguments); if (!mqList().length) return h;
      const k = '<button class="btn soft sm" data-go="factures">'; const i = h.indexOf(k); if (i < 0) return h;
      return h.slice(0, i) + `<button class="btn soft sm" data-go="marques">${ico("mqTags")}<span class="mg-hide-s">Par marque</span></button>` + h.slice(i);
    };
  }
})();
