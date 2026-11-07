/* Growth Gusto — « La journée du restaurant » (préfixe « jn »). Réglages › Journée et fermetures.
   Trouvé par la simulation de 15 restaurants (tools/sim) : un bar qui ferme à 2 h, un hôtel qui sert le petit-déjeuner, une boulangerie
   ouverte sans coupure, une cantine fermée le week-end ne rentraient pas dans « midi et soir, coupure à 16 h ».
   Données : restos/{rid}.day = { start (heure où la journée commence, 4 par défaut : à 1 h du matin on est encore sur la veille),
   cut (heure du second relevé), names: [nom du 1er relevé, nom du 2nd], off: [{ from, to, label }] (congés, saison) }.
   Les jours fermés de la semaine restent dans alertCfg.closed (partagés avec les alertes). Lecture : GG_DAY, slotName(), ggClosed() (js/core.js). */
"use strict";

Object.assign(IC, { jnSun: ["c:12,12,4", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m6.3 17.7-1.4 1.4", "m19.1 4.9-1.4 1.4"] });

const JN_PRESETS = [
  ["midi", "Midi et soir", "Bistrot, brasserie classique", { start: 4, cut: 16, names: ["Midi", "Soir"] }],
  ["matin", "Matin et soir", "Hôtel, petit-déjeuner, boulangerie", { start: 4, cut: 14, names: ["Matin", "Soir"] }],
  ["nuit", "Ouvert la nuit", "Bar, fermeture après minuit", { start: 8, cut: 22, names: ["Ouverture", "Fermeture"] }],
  ["continu", "Ouvert en continu", "Service sans coupure", { start: 4, cut: 15, names: ["Ouverture", "Fermeture"] }],
];
const JN_WD = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [0, "Dim"]];
const JN = { add: null };
const jnCfg = () => { const c = (S.resto && S.resto.day) || {}; return { start: GG_DAY.start, cut: GG_DAY.cut, names: GG_DAY.names.slice(), off: Array.isArray(c.off) ? c.off : [] }; };
const jnBoss = () => DB.mode === "demo" || myRole() === "gerant";
const jnH = (h) => `${Math.floor(h)} h${h % 1 ? pad(Math.round((h % 1) * 60)) : ""}`;
const jnWk = () => (S.resto && S.resto.alertCfg && Array.isArray(S.resto.alertCfg.closed) ? S.resto.alertCfg.closed : []);
function jnSummary() {
  const c = jnCfg(); const wk = jnWk(); const p = JN_PRESETS.find(([, , , v]) => v.start === c.start && v.cut === c.cut && v.names.join() === c.names.join());
  const days = JN_WD.filter(([d]) => wk.includes(d)).map(([, t]) => t.toLowerCase()).join(", ");
  return `${p ? p[1] : `${c.names[0]} et ${c.names[1].toLowerCase()}`}${days ? ` · fermé ${days}` : ""}${c.off.some((o) => (o.to || o.from) >= dayKey()) ? " · congés prévus" : ""}`;
}
function jnSheet() {
  const c = jnCfg(); const wk = jnWk(); const today = dayKey();
  const pre = JN_PRESETS.map(([k, t, d, v]) => { const on = v.start === c.start && v.cut === c.cut && v.names.join() === c.names.join(); return `<button class="li tap jn-pre ${on ? "on" : ""}" data-act="jnPreset" data-v="${k}"><div class="tx"><b>${t}</b><em>${d} · relevés «&nbsp;${v.names[0].toLowerCase()}&nbsp;» et «&nbsp;${v.names[1].toLowerCase()}&nbsp;»</em></div>${on ? ico("check") : ""}</button>`; }).join("");
  const hours = (from, to, cur, act) => `<select class="input" data-act-change="${act}">${Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => `<option value="${h}" ${h === cur ? "selected" : ""}>${h} h</option>`).join("")}</select>`;
  const off = c.off.filter((o) => (o.to || o.from) >= addDays(today, -30)).sort((a, b) => a.from.localeCompare(b.from));
  return `<div class="jn">
    <div class="h2">Journée et fermetures</div>
    <p class="sub">Quand commence votre journée, comment s'appellent vos deux relevés, quels jours vous êtes fermé. Les relevés, le registre, les alertes et l'accueil suivent.</p>
    <div class="lbl" style="margin-top:14px">Votre rythme</div>
    <div class="glass pad jn-list">${pre}</div>
    <div class="grid2" style="margin-top:12px">
      <label class="field"><span>La journée commence à</span>${hours(0, 10, c.start, "jnStart")}</label>
      <label class="field"><span>Second relevé à partir de</span>${hours(10, 23, Math.round(c.cut), "jnCut")}</label>
    </div>
    <div class="grid2" style="margin-top:10px">
      <label class="field"><span>Premier relevé</span><input class="input" id="jnN0" maxlength="16" value="${esc(c.names[0])}"></label>
      <label class="field"><span>Second relevé</span><input class="input" id="jnN1" maxlength="16" value="${esc(c.names[1])}"></label>
    </div>
    <p class="note" style="margin-top:8px">${c.start ? `Exemple : à ${jnH(Math.max(0, c.start - 2))} du matin, un relevé compte encore pour la veille («&nbsp;${esc(c.names[1].toLowerCase())}&nbsp;»).` : "La journée change à minuit."}</p>
    <div class="lbl" style="margin-top:16px">Jours de fermeture</div>
    <div class="chips" style="flex-wrap:wrap">${JN_WD.map(([d, t]) => `<button class="chip ${wk.includes(d) ? "on" : ""}" data-act="jnWd" data-v="${d}" aria-pressed="${wk.includes(d)}">${t}</button>`).join("")}</div>
    <div class="lbl" style="margin-top:16px">Congés et saison</div>
    <div class="glass pad">${off.length ? off.map((o) => `<div class="li"><div class="tx"><b>${esc(o.label || "Fermeture")}</b><em>du ${shortDate(o.from)} au ${shortDate(o.to || o.from)}</em></div><button class="iconbtn" data-act="jnOffDel" data-v="${esc(o.from + "|" + (o.to || o.from))}" aria-label="Retirer cette fermeture">${ico("x")}</button></div>`).join("") : `<p class="sub" style="margin:0">Aucune fermeture prévue. Ces jours-là, aucun relevé n'est attendu et rien ne compte comme oublié.</p>`}
      ${JN.add ? `<div class="grid2" style="margin-top:10px"><label class="field"><span>Du</span><input class="input" type="date" id="jnFrom" value="${esc(JN.add.from)}"></label><label class="field"><span>Au</span><input class="input" type="date" id="jnTo" value="${esc(JN.add.to)}"></label></div>
        <label class="field" style="margin-top:10px"><span>Nom</span><input class="input" id="jnLbl" maxlength="40" placeholder="Fermeture annuelle, hors saison…" value="${esc(JN.add.label)}"></label>
        <button class="btn acc block" style="margin-top:10px" data-act="jnOffSave">${ico("check")}Ajouter la fermeture</button>` : `<button class="btn soft block" style="margin-top:10px" data-act="jnOffAdd">${ico("plus")}Ajouter des congés ou une saison</button>`}
    </div>
    <button class="btn acc block" style="margin-top:16px" data-act="jnSave">${ico("check")}Enregistrer</button>
  </div>`;
}
async function jnWrite(patch, msg) {
  if (!S.rid || !jnBoss()) { toast("Seul le gérant change ces réglages.", "err"); return false; }
  const cur = (S.resto && S.resto.day) || {}; const day = { ...cur, ...patch };
  try { await DB.update("restos", S.rid, { day }); } catch (e) { toast("Pas enregistré, réessayez.", "err"); return false; }
  if (S.resto) S.resto.day = day; ggDaySync(S.resto); S.slot = slotNow();
  if (msg) { SFX.ok(); toast(msg); try { logEvent("settings", msg.toLowerCase()); } catch (e) {} }
  return true;
}
const jnRedraw = () => { const b = $("#sheetBody"); if (b && $(".jn", b)) b.innerHTML = jnSheet(); };
Object.assign(ACT, {
  jnOpen: () => { SFX.sheet ? SFX.sheet() : SFX.tap(); JN.add = null; openSheet(jnSheet()); },
  jnPreset: async (a, id, v) => { const p = JN_PRESETS.find((x) => x[0] === v); if (!p) return; SFX.tick(); if (await jnWrite({ ...p[3] })) jnRedraw(); },
  jnStart: async (a) => { if (await jnWrite({ start: +a.value })) jnRedraw(); },
  jnCut: async (a) => { if (await jnWrite({ cut: +a.value })) jnRedraw(); },
  jnWd: async (a, id, v) => {
    if (!jnBoss()) return toast("Seul le gérant change ces réglages.", "err");
    const d = +v, wk = jnWk(); const closed = wk.includes(d) ? wk.filter((x) => x !== d) : [...wk, d]; SFX.tick();
    const alertCfg = { ...((S.resto && S.resto.alertCfg) || {}), closed };
    try { await DB.update("restos", S.rid, { alertCfg }); if (S.resto) S.resto.alertCfg = alertCfg; } catch (e) { return toast("Pas enregistré, réessayez.", "err"); }
    jnRedraw();
  },
  jnOffAdd: () => { SFX.tap(); const t = dayKey(); JN.add = { from: t, to: addDays(t, 6), label: "" }; jnRedraw(); },
  jnOffSave: async () => {
    const from = ($("#jnFrom") || {}).value, to = ($("#jnTo") || {}).value || from, label = (($("#jnLbl") || {}).value || "").trim().slice(0, 40);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) return toast("Choisissez les deux dates.", "err");
    const o = from <= to ? { from, to, label } : { from: to, to: from, label };
    JN.add = null; if (await jnWrite({ off: [...jnCfg().off, o] }, `Fermeture ajoutée du ${shortDate(o.from)} au ${shortDate(o.to)}`)) jnRedraw();
  },
  jnOffDel: async (a, id, v) => { const [f, t] = String(v).split("|"); if (await jnWrite({ off: jnCfg().off.filter((o) => !(o.from === f && (o.to || o.from) === t)) })) { SFX.tap(); jnRedraw(); } },
  jnSave: async () => {
    const n0 = (($("#jnN0") || {}).value || "").trim().slice(0, 16), n1 = (($("#jnN1") || {}).value || "").trim().slice(0, 16);
    if (!n0 || !n1) return toast("Donnez un nom à chaque relevé.", "err");
    if (await jnWrite({ names: [n0, n1] }, "Journée du restaurant enregistrée")) { closeSheet(); rerender(); }
  },
});
/* <select data-act-change> : le dispatcher de core écoute les clics, on écoute « change » ici */
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.actChange || !$(".jn", $("#sheetBody") || document)) return; const f = ACT[t.dataset.actChange]; if (f) f(t, null, t.value, e); });
/* Réglages : la ligne « Journée et fermetures » (gérant), juste avant « Fonctionnalités » */
(function jnReglages() {
  const V = VIEWS.reglages; if (!V || V._jn) return; const r0 = V.render; V._jn = true;
  V.render = function (p) {
    const h = r0.apply(this, arguments); if (!S.resto || !jnBoss()) return h;
    const row = `<div class="li tap" data-act="jnOpen"><span class="ic w-sa">${ico("jnSun")}</span><div class="tx"><b>Journée et fermetures</b><em>${esc(jnSummary())}</em></div>${ico("chev")}</div>`;
    for (const k of ['<div class="li tap" data-go="fonctions"', '<div class="li tap" data-go="priseEnMain"', '<div class="li tap" data-act="tourStart"', '<div class="li tap" data-go="imprimante"']) { const i = h.indexOf(k); if (i >= 0) return h.slice(0, i) + row + h.slice(i); }
    return h;
  };
})();
