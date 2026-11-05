/* Growth Gusto — area: perso (« Personnaliser l'app »). Prefix « pz ».
   Each person arranges the app their way: the menu (order, hidden entries, icon, colour, name), the two free tabs of the phone
   tab bar, and the blocks of « Aujourd'hui » (order, hidden, quick actions). Everything resets in one tap.
   Storage (per person):
     cloud  restos/{rid}/members/{me}.ui   (a member may update their own doc except role/invite/perms: see firestore.rules)
     local  localStorage gg-ui-<rid>-<memberId>   (also a cache in cloud mode, so the first paint is already personal)
     team   restos/{rid}.uiDefault         (written by a gérant: « Appliquer à toute l'équipe »; used by whoever has no own ui)
   Shape: { v:1, nav?:{ order:[route|"sep:<titre>"], hide:[…], ic:{route:icon}, col:{route:"w-vi"…}, name:{route:"…"} },
            tabs?:[route, route], home?:{ order:[block], hide:[block], qa:[route] } }
   Hooks used by other files (all guarded with typeof): pzNav() (core renderChrome), pzApplyTabs() (core renderChrome),
   pzMoreGroups(groups) (compte.js menu Plus), pzHome() / pzHomeEdit() / pzQA() (home.js), pzRow() (compte.js Réglages). */
"use strict";

Object.assign(IC, {
  pzEye: ["M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", "c:12,12,3", "f:M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"],
  pzEyeOff: ["M10 5.7c.65-.13 1.32-.2 2-.2 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.4 3.2", "M6.6 6.7C3.9 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.9 0 3.5-.6 4.9-1.4", "M3.5 3.5l17 17", "M9.9 9.9a3 3 0 0 0 4.2 4.2"],
  pzGrip: ["M9 6h.01", "M15 6h.01", "M9 12h.01", "M15 12h.01", "M9 18h.01", "M15 18h.01"],
  pzBrush: ["f:M4 20c2.5 0 4-1.2 4-3.5a2.5 2.5 0 0 0-5 0c0 1-.4 2-1 3.5h2z", "M14.5 4.5 19.5 9.5", "M18 3a2.1 2.1 0 0 1 3 3l-9.5 9.5-3-3z", "M8 16.5a2.5 2.5 0 0 0-5 0c0 1-.4 2-1 3.5 2.5 0 6 0 6-3.5z"],
  pzReset: ["M3.5 12a8.5 8.5 0 1 0 2.5-6", "M3.5 3.5V8H8"],
  pzDown: ["m6 9.5 6 6 6-6"],
  pzUp: ["m6 14.5 6-6 6 6"],
});

/* ── catalogue ── */
const PZ_ICONS = ["home", "therm", "snow", "fridge", "coldroom", "vitrine", "scan", "qr", "tag", "truck", "box", "list", "receipt", "book", "spray", "shield",
  "calcheck", "cal", "clock", "dash", "euro", "trend", "users", "pmToque", "pmCloche", "pmDrop", "pmGlass", "pmCrown", "wine", "store", "printer", "camera",
  "image", "star", "alert", "lock", "pmKey", "sliders", "grid", "move", "scissors", "edit", "search", "sound", "activity", "check"];
/* [class, nom, encre (icône de la barre latérale)] — the V2 pastel wells */
const PZ_COLS = [["w-vi", "Violet", "#5B2BFF"], ["w-sa", "Safran", "#9A6200"], ["w-sk", "Ciel", "#2F5FBF"], ["w-to", "Tomate", "#C8432A"], ["w-mi", "Menthe", "#1E7F55"], ["w-in", "Encre", "#1B1530"], ["w-nd", "Sable", "#4A4560"]];
const PZ_INK = Object.fromEntries(PZ_COLS.map((c) => [c[0], c[2]]));
const PZ_LOCK = new Set(["home", "reglages"]); /* always in the menu: the way back here */
const PZ_TAB_DEF = ["frigos", "stock"];
/* candidates for the 2 free tabs: [route, icon, short label] */
const PZ_TABS = [["frigos", "snow", "Frigos"], ["releve", "therm", "Relevés"], ["stock", "box", "Stock"], ["reception", "truck", "Réception"], ["menage", "spray", "Ménage"],
  ["notes", "book", "Recettes"], ["tickets", "receipt", "Tickets"], ["registre", "shield", "Registre"], ["pointeuse", "clock", "Pointer"], ["planning", "cal", "Planning"],
  ["dashboard", "dash", "Chiffres"], ["finance", "euro", "Finances"], ["obligations", "calcheck", "Contrôles"]];
const PZ_SUB = { frigo: "frigos", note: "notes", fiche: "notes", tzEdit: "tickets", regReport: "registre", obl: "obligations", oblCat: "obligations" };
/* blocks of « Aujourd'hui »: [key, title, icon] */
const PZ_BLOCKS = [["hero", "Relevé du service", "therm"], ["qa", "Actions rapides", "grid"], ["svc", "Mise en place · fin de service", "move"], ["todo", "À faire maintenant", "list"],
  ["shift", "Pointeuse", "clock"], ["stats", "Chiffres du jour", "trend"], ["dash", "Tableau de bord", "dash"], ["feed", "Activité de l'équipe", "activity"], ["steps", "Premiers pas", "check"]];
const PZ_BLOCK = Object.fromEntries(PZ_BLOCKS.map((b) => [b[0], b]));
const PZ_HOME_DEF = ["hero", "qa", "svc", "steps", "todo", "shift", "stats", "dash", "feed"];
/* quick actions: route → [icon, label, colour class] */
const PZ_QA = { releve: ["therm", "Relevé", "c1"], reception: ["truck", "Réception", "c2"], scan: ["scan", "Scanner", "c3"], menage: ["spray", "Ménage", "c4"], stock: ["list", "Inventaire", "c5"],
  frigos: ["snow", "Frigos", "c4"], notes: ["book", "Recettes", "c2"], tickets: ["receipt", "Tickets", "c5"], pointeuse: ["clock", "Pointer", "c4"], planning: ["cal", "Planning", "c1"],
  registre: ["shield", "Registre", "c1"], obligations: ["calcheck", "Contrôles", "c5"], dashboard: ["dash", "Chiffres", "c1"], finance: ["euro", "Finances", "c2"] };
const PZ_QA_DEF = ["releve", "reception", "scan", "menage", "stock"];

const PZ = { cache: null, sec: "menu", he: null, drag: null, tab0: null };

/* ── storage ── */
const pzKey = () => `gg-ui-${S.rid || ""}-${(S.me && S.me.id) || ""}`;
const pzCloud = () => DB.mode === "db" && !!DB.db && !!DB.uid;
const pzMine = () => (S.members || []).find((m) => m.id === S.me.id);
const pzObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
function pzLS() { try { const v = JSON.parse(localStorage.getItem(pzKey()) || "null"); return pzObj(v) ? v : null; } catch (e) { return null; } }
/* the person's own prefs (null = none) */
function pzOwn() {
  if (pzCloud()) { const m = pzMine(); if (m && "ui" in m) return pzObj(m.ui) ? m.ui : null; }
  return pzLS();
}
/* effective prefs: own, else the team's default, else {} */
function pzPrefs() {
  const k = pzKey() + "|" + JSON.stringify((S.resto && S.resto.uiDefault) || null) + "|" + (pzCloud() && pzMine() ? JSON.stringify(pzMine().ui || null) : "");
  if (PZ.cache && PZ.cache.k === k) return PZ.cache.v;
  const own = pzOwn(); const d = S.resto && pzObj(S.resto.uiDefault) ? S.resto.uiDefault : null;
  const v = own || d || {}; PZ.cache = { k, v }; return v;
}
const pzClone = (o) => JSON.parse(JSON.stringify(o || {}));
/* drop empty parts so « nothing customised » stays {} */
function pzTidy(u) {
  const o = pzClone(u); o.v = 1;
  if (o.nav) { const n = o.nav; ["ic", "col", "name"].forEach((k) => { if (n[k] && !Object.keys(n[k]).length) delete n[k]; }); if (n.hide && !n.hide.length) delete n.hide; if (n.order && !n.order.length) delete n.order; if (!Object.keys(n).length) delete o.nav; }
  if (o.tabs && o.tabs.join() === PZ_TAB_DEF.join()) delete o.tabs;
  if (o.home) { const h = o.home; if (h.order && h.order.join() === PZ_HOME_DEF.join()) delete h.order; if (h.hide && !h.hide.length) delete h.hide; if (h.qa && h.qa.join() === PZ_QA_DEF.join()) delete h.qa; if (!Object.keys(h).length) delete o.home; }
  return Object.keys(o).length > 1 ? o : null;
}
function pzSave(u) {
  const v = u ? pzTidy(u) : null;
  try { if (v) localStorage.setItem(pzKey(), JSON.stringify(v)); else localStorage.removeItem(pzKey()); } catch (e) {}
  if (pzCloud()) {
    const m = pzMine(); if (m) m.ui = v; /* optimistic: the snapshot follows */
    try { DB.dbw(DB.db.collection(DB.path("members")).doc(S.me.id).update({ ui: v })).catch?.(() => {}); } catch (e) { console.warn("pz save", e); }
  }
  PZ.cache = null; pzApply();
}
/* the editable copy (own prefs, else the team default the person sees) */
const pzEditable = () => pzClone(pzOwn() || (S.resto && pzObj(S.resto.uiDefault) ? S.resto.uiDefault : {}));
function pzSet(fn) { const u = pzEditable(); fn(u); pzSave(u); }
function pzApply() { PZ.cache = null; pzApplyTabs(); const tb = $("#tabbar"); if (tb) delete tb.dataset.built; try { renderChrome(); } catch (e) {} if (S.route === "home" || S.route === "more" || S.route === "perso") rerender(); }

/* ── menu (side nav + Plus) ── */
const pzNavBase = () => NAV.map((n) => (n[0] === "sep" ? ["sep:" + n[2], "", n[2]] : n));
/* the full ordered list with the person's overrides: [key, icon, label, colourClass|"", hidden, defaultIcon, defaultLabel] */
function pzNavAll(prefs) {
  const p = (prefs || pzPrefs()).nav || {}; const base = pzNavBase(); const keys = base.map((n) => n[0]);
  let order = (p.order || []).filter((k, i, a) => keys.includes(k) && a.indexOf(k) === i);
  keys.forEach((k, i) => { if (order.includes(k)) return; let j = i - 1; while (j >= 0 && !order.includes(keys[j])) j--; order.splice(j < 0 ? 0 : order.indexOf(keys[j]) + 1, 0, k); });
  const hide = new Set(p.hide || []), ic = p.ic || {}, col = p.col || {}, nm = p.name || {};
  return order.map((k) => { const b = base[keys.indexOf(k)]; return [k, ic[k] && IC[ic[k]] ? ic[k] : b[1], (nm[k] || "").trim() || b[2], PZ_INK[col[k]] ? col[k] : "", hide.has(k) && !PZ_LOCK.has(k), b[1], b[2]]; });
}
/* what renderChrome draws: [route, icon, label, colourClass] ("sep" rows keep the NAV shape) */
function pzNav() {
  const out = [];
  pzNavAll().forEach(([k, i, t, c, h]) => {
    if (h) return;
    if (k.startsWith("sep:")) { if (out.length && out[out.length - 1][0] === "sep") out.pop(); out.push(["sep", "", t]); return; }
    if (!permOk(k)) return; out.push([k, i, t, c]);
  });
  while (out.length && out[out.length - 1][0] === "sep") out.pop();
  return out;
}
const pzNavCustom = () => { const n = pzPrefs().nav; return !!(n && Object.keys(n).length); };
/* menu Plus (compte.js): groups = [[title, [[route, icon, title, badge, tone, well?]…]]…] */
function pzMoreGroups(groups) {
  const p = pzPrefs().nav; if (!p) return groups;
  const all = pzNavAll(); const by = Object.fromEntries(all.map((x) => [x[0], x]));
  const deco = (it) => { const x = by[it[0]]; if (!x) return it; const o = it.slice(); const pn = p.name || {}, pi = p.ic || {}; if (pi[it[0]] && IC[pi[it[0]]]) o[1] = pi[it[0]]; if ((pn[it[0]] || "").trim()) o[2] = pn[it[0]].trim(); o[5] = x[3] || o[5]; return o; };
  const hidden = (r) => by[r] && by[r][4];
  if (!p.order) return groups.map(([g, its]) => [g, its.filter((it) => !hidden(it[0])).map(deco)]);
  /* user order: groups follow the person's sections; entries only Plus has stay right after the entry they followed */
  const flat = groups.flatMap(([, its]) => its); const pos = {}; let n = 0;
  all.forEach((x) => { pos[x[0]] = n++; });
  const anchor = {}; flat.forEach((it, i) => { if (!(it[0] in pos)) { let j = i - 1; while (j >= 0 && !(flat[j][0] in pos)) j--; anchor[it[0]] = j >= 0 ? pos[flat[j][0]] + 0.5 + i / 1000 : 1e6 + i; } });
  const place = (it) => (it[0] in pos ? pos[it[0]] : anchor[it[0]]);
  const seps = all.filter((x) => x[0].startsWith("sep:") && !x[4]).map((x) => [pos[x[0]], x[2]]);
  const out = [[groups[0] ? groups[0][0] : "Au quotidien", []]]; seps.forEach(([at, t]) => out.push([t, [], at]));
  flat.filter((it) => !hidden(it[0])).sort((a, b) => place(a) - place(b)).forEach((it) => { const at = place(it); let g = 0; for (let i = 1; i < out.length; i++) if (out[i][2] < at) g = i; out[g][1].push(deco(it)); });
  return out.map(([t, its]) => [t, its]).filter(([, its]) => its.length);
}

/* ── tab bar ── */
function pzTabs() {
  const t = pzPrefs().tabs; const ok = (r) => PZ_TABS.some((x) => x[0] === r) && VIEWS[r];
  if (!Array.isArray(t) || t.length !== 2 || !t.every(ok) || t[0] === t[1]) return PZ_TAB_DEF.slice();
  return t.slice();
}
function pzTabDef(r) {
  const d = PZ_TABS.find((x) => x[0] === r) || [r, "grid", r]; const p = pzPrefs().nav || {};
  const nm = ((p.name || {})[r] || "").trim();
  return [r, (p.ic || {})[r] && IC[p.ic[r]] ? p.ic[r] : d[1], nm && nm.length <= 11 ? nm : d[2]];
}
function pzApplyTabs() {
  if (typeof TABS === "undefined" || typeof TAB_OF === "undefined") return;
  if (!PZ.tab0) PZ.tab0 = { ...TAB_OF }; Object.keys(TAB_OF).forEach((k) => { if (!(k in PZ.tab0)) PZ.tab0[k] = TAB_OF[k]; });
  const [a, b] = pzTabs(); const on = new Set([a, b]);
  TABS[1] = pzTabDef(a); TABS[3] = pzTabDef(b);
  Object.keys(PZ.tab0).forEach((k) => { const v = PZ.tab0[k]; TAB_OF[k] = (v === "frigos" || v === "stock") && !on.has(v) ? "more" : v; });
  on.forEach((r) => { TAB_OF[r] = r; Object.entries(PZ_SUB).forEach(([s, m]) => { if (m === r) TAB_OF[s] = r; }); });
  TAB_OF.perso = "more";
}

/* ── home ── */
function pzHomeNorm(h) {
  const keys = PZ_BLOCKS.map((b) => b[0]);
  const order = ((h && h.order) || []).filter((k, i, a) => keys.includes(k) && a.indexOf(k) === i);
  PZ_HOME_DEF.forEach((k, i) => { if (order.includes(k)) return; let j = i - 1; while (j >= 0 && !order.includes(PZ_HOME_DEF[j])) j--; order.splice(j < 0 ? 0 : order.indexOf(PZ_HOME_DEF[j]) + 1, 0, k); });
  return { order, hide: ((h && h.hide) || []).filter((k) => keys.includes(k)), qa: pzQANorm(h && h.qa) };
}
function pzQANorm(q) { const v = (Array.isArray(q) ? q : PZ_QA_DEF).filter((r, i, a) => PZ_QA[r] && a.indexOf(r) === i).slice(0, 6); return v.length >= 3 ? v : PZ_QA_DEF.slice(); }
/* null = the default home; else { order, hide:Set, qa } */
function pzHome() { const h = pzPrefs().home; if (!h || (!h.order && !h.hide)) return null; const n = pzHomeNorm(h); return { order: n.order, hide: new Set(n.hide), qa: n.qa }; }
/* the draft while « Modifier l'accueil » is on */
function pzHomeEdit() { return PZ.he; }
/* quick actions shown on home: [route, icon, label, class] (permissions filtered by home.js) */
function pzQA() {
  const src = PZ.he ? PZ.he.qa : pzQANorm((pzPrefs().home || {}).qa); const p = pzPrefs().nav || {};
  return src.map((r) => [r, (p.ic || {})[r] && IC[p.ic[r]] ? p.ic[r] : PZ_QA[r][0], PZ_QA[r][1], PZ_QA[r][2]]);
}
function pzHomeStart() {
  const h = pzHomeNorm(pzPrefs().home); PZ.he = { order: h.order, hide: h.hide, qa: h.qa, at: Date.now() };
  VIEWS.home.hideTabs = true; if (S.route !== "home") go("home"); else { rerender(); renderChrome(); }
  SFX.tap(); buzz(8); setTimeout(() => { const v = $("#viewport .view"); v && v.scrollTo({ top: 0, behavior: "smooth" }); }, 60);
}
function pzHomeEnd(save) {
  const d = PZ.he; PZ.he = null; VIEWS.home.hideTabs = false;
  if (save && d) { pzSet((u) => { u.home = { order: d.order, hide: d.hide, qa: d.qa }; }); SFX.done(); buzz([8, 30, 8]); toast("Accueil enregistré"); }
  else { rerender(); renderChrome(); SFX.close(); }
}
/* the edit chrome around one block (home.js calls it in edit mode) */
function pzHomeWrap(k, html, i, n) {
  const d = PZ.he; const off = d.hide.includes(k); const [, t, ic] = PZ_BLOCK[k];
  const inner = html || `<div class="pz-ghost">${ico(ic)}<span>Rien à montrer pour l'instant</span></div>`;
  return `<div class="pz-hb ${off ? "off" : ""}" data-k="${k}" style="order:${i};--j:${i}">
    <div class="pz-hbar"><span class="pz-hic">${ico(ic)}</span><b>${t}</b>
      ${k === "qa" && !off ? `<button class="pz-hbtn txt" data-act="pzQaSheet" aria-label="Choisir les raccourcis">${ico("edit")}Choisir</button>` : ""}
      <button class="pz-hbtn" data-act="pzHbMove" data-id="${k}" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Monter">${ico("pzUp")}</button>
      <button class="pz-hbtn" data-act="pzHbMove" data-id="${k}" data-v="1" ${i === n - 1 ? "disabled" : ""} aria-label="Descendre">${ico("pzDown")}</button>
      <button class="pz-hbtn eye ${off ? "on" : ""}" data-act="pzHbEye" data-id="${k}" aria-label="${off ? "Afficher" : "Masquer"} ${esc(t)}">${ico(off ? "pzEyeOff" : "pzEye")}</button></div>
    <div class="pz-hin" inert>${inner}</div></div>`;
}
function pzHomeEditBar() {
  return `<div class="pz-ebar" role="toolbar" aria-label="Modifier l'accueil"><button class="btn soft" data-act="pzHomeCancel">Annuler</button><button class="btn soft pz-ereset" data-act="pzHomeReset" aria-label="Réinitialiser">${ico("pzReset")}<span>Réinitialiser</span></button><button class="btn acc" data-act="pzHomeDone">${ico("check")}Terminé</button></div>`;
}
function pzHomeHint() { return `<div class="pz-ehint st" style="--i:1"><span class="pz-well w-sa">${ico("pzBrush")}</span><div><b>Votre accueil</b><span>Montez, descendez, masquez les blocs.</span></div></div>`; }
function pzHomeBtn() { return `<div class="pz-hedit-w"><button class="pz-hedit" data-act="pzHomeEdit">${ico("pzBrush")}Modifier l'accueil</button></div>`; }

/* quick actions picker (3 to 6) */
function pzQaSheetHTML(list) {
  const on = list; const rest = Object.keys(PZ_QA).filter((r) => !on.includes(r) && VIEWS[r] && permOk(r));
  const tile = (r, i) => { const [ic, t, c] = PZ_QA[r]; return `<div class="pz-qrow"><span class="pz-qwell ${c}">${ico(ic)}</span><b>${t}</b>
    <button class="pz-hbtn" data-act="pzQaMove" data-id="${r}" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Avancer ${t}">${ico("pzUp")}</button><button class="pz-hbtn" data-act="pzQaMove" data-id="${r}" data-v="1" ${i === on.length - 1 ? "disabled" : ""} aria-label="Reculer ${t}">${ico("pzDown")}</button>
    <button class="pz-hbtn rm" data-act="pzQaTog" data-id="${r}" ${on.length <= 3 ? "disabled" : ""} aria-label="Retirer ${t}">${ico("minus")}</button></div>`; };
  return `<div class="pz-sh"><div class="h2">Actions rapides</div><p class="sub">De 3 à 6 raccourcis, dans l'ordre de votre choix.</p>
    <div class="pz-qprev">${on.map((r) => `<span class="pz-qwell ${PZ_QA[r][2]}">${ico(PZ_QA[r][0])}</span>`).join("")}</div>
    <div class="pz-qlist">${on.map(tile).join("")}</div>
    ${rest.length ? `<div class="lbl pz-lbl">${on.length >= 6 ? "Retirez-en un pour en ajouter" : "Ajouter"}</div><div class="pz-qadd">${rest.map((r) => `<button class="pz-qchip" data-act="pzQaTog" data-id="${r}" ${on.length >= 6 ? "disabled" : ""}><span class="pz-qwell sm ${PZ_QA[r][2]}">${ico(PZ_QA[r][0])}</span>${PZ_QA[r][1]}${ico("plus")}</button>`).join("")}</div>` : ""}
    <button class="btn acc block" data-act="sheetClose" style="margin-top:16px">${ico("check")}C'est bon</button></div>`;
}
const pzQaList = () => (PZ.he ? PZ.he.qa : pzQANorm((pzEditable().home || {}).qa));
function pzQaSet(fn) {
  if (PZ.he) { fn(PZ.he.qa); rerender(); } else pzSet((u) => { u.home = u.home || {}; const q = pzQANorm(u.home.qa); fn(q); u.home.qa = q; });
  openSheet(pzQaSheetHTML(pzQaList()));
}

/* ── screen « Personnaliser » ── */
const pzWell = (cls, icon, big) => `<span class="pz-well ${cls || "w-vi"}${big ? " big" : ""}">${ico(IC[icon] ? icon : "grid")}</span>`;
const PZ_WELL0 = () => (typeof CC_WELL === "object" ? CC_WELL : {});
function pzMenuSec() {
  const all = pzNavAll(); const W = PZ_WELL0();
  const rows = all.map(([k, i, t, c, h], idx) => {
    if (k.startsWith("sep:")) return `<div class="pz-mrow sep ${h ? "off" : ""}" data-k="${esc(k)}" data-i="${idx}"><span class="pz-grip" data-drag="1" aria-label="Déplacer la section ${esc(t)}">${ico("pzGrip")}</span><span class="pz-sept">${esc(t)}</span><button class="pz-hbtn eye ${h ? "on" : ""}" data-act="pzNavEye" data-id="${esc(k)}" aria-label="${h ? "Afficher" : "Masquer"} le titre ${esc(t)}">${ico(h ? "pzEyeOff" : "pzEye")}</button></div>`;
    const perm = !permOk(k); const lock = PZ_LOCK.has(k);
    return `<div class="pz-mrow ${h ? "off" : ""} ${perm ? "perm" : ""}" data-k="${k}" data-i="${idx}"><span class="pz-grip" data-drag="1" aria-label="Déplacer ${esc(t)}">${ico("pzGrip")}</span>
      <button class="pz-mmain" data-act="pzMod" data-id="${k}" aria-label="Modifier ${esc(t)}">${pzWell(c || W[k] || "w-vi", i)}<span class="pz-mt"><b>${esc(t)}</b>${perm ? `<em>${ico("lock")}Fermé pour vous</em>` : ""}</span>${ico("edit", "pz-pen")}</button>
      ${lock ? `<span class="pz-hbtn ghost" aria-hidden="true"></span>` : `<button class="pz-hbtn eye ${h ? "on" : ""}" data-act="pzNavEye" data-id="${k}" aria-label="${h ? "Afficher" : "Masquer"} ${esc(t)}">${ico(h ? "pzEyeOff" : "pzEye")}</button>`}</div>`;
  }).join("");
  return `<p class="pz-hint">${DESK_MQ.matches ? "Glissez pour ranger, touchez pour changer l'icône, la couleur ou le nom." : "Glissez la poignée pour ranger. Touchez une ligne pour changer l'icône, la couleur ou le nom."}</p>
    <div class="glass pz-mlist" id="pzMlist">${rows}</div>
    ${pzNavCustom() ? `<button class="btn ghost block pz-sreset" data-act="pzResetSec" data-v="nav">${ico("pzReset")}Menu par défaut</button>` : ""}`;
}
function pzTabsSec() {
  const [a, b] = pzTabs(); const sel = S.ui.pzSlot === 1 ? 1 : 0; const cur = [a, b];
  const slot = (n) => { const [r, i, t] = pzTabDef(cur[n]); return `<button class="pz-tslot ${sel === n ? "on" : ""}" data-act="pzSlot" data-v="${n}" aria-label="Onglet ${n ? "de droite" : "de gauche"} : ${esc(t)}">${ico(i)}<span>${esc(t)}</span></button>`; };
  const opts = PZ_TABS.filter(([r]) => VIEWS[r]).map(([r]) => { const [, i, t] = pzTabDef(r); const used = cur.includes(r); const mine = cur[sel] === r; const no = !permOk(r);
    return `<button class="pz-topt ${mine ? "on" : ""} ${used && !mine ? "used" : ""}" data-act="pzTabPick" data-id="${r}" ${no ? "disabled" : ""}>${pzWell(((pzPrefs().nav || {}).col || {})[r] || PZ_WELL0()[r] || "w-vi", i)}<span>${esc(t)}</span></button>`; }).join("");
  return `<p class="pz-hint">${DESK_MQ.matches ? "La barre du bas du téléphone. Accueil et Plus restent fixes." : "Accueil et Plus restent fixes. Touchez un onglet, puis choisissez."}</p>
    <div class="pz-tbar" aria-label="Aperçu de la barre du bas"><span class="pz-tfix">${ico("home")}<span>Accueil</span></span>${slot(0)}<span class="pz-tfab">${ico("scan")}</span>${slot(1)}<span class="pz-tfix">${ico("grid")}<span>Plus</span></span></div>
    <div class="lbl pz-lbl">Onglet ${sel ? "de droite" : "de gauche"}</div>
    <div class="pz-tgrid">${opts}</div>
    ${pzPrefs().tabs ? `<button class="btn ghost block pz-sreset" data-act="pzResetSec" data-v="tabs">${ico("pzReset")}Onglets par défaut</button>` : ""}`;
}
function pzHomeSec() {
  const h = pzHomeNorm(pzPrefs().home); const hide = new Set(h.hide);
  const rows = h.order.map((k, i) => { const [, t, ic] = PZ_BLOCK[k]; const off = hide.has(k); return `<div class="pz-mrow ${off ? "off" : ""}"><span class="pz-well w-nd">${ico(ic)}</span><span class="pz-mt"><b>${t}</b></span>
    <button class="pz-hbtn" data-act="pzHmMove" data-id="${k}" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Monter ${t}">${ico("pzUp")}</button><button class="pz-hbtn" data-act="pzHmMove" data-id="${k}" data-v="1" ${i === h.order.length - 1 ? "disabled" : ""} aria-label="Descendre ${t}">${ico("pzDown")}</button>
    <button class="pz-hbtn eye ${off ? "on" : ""}" data-act="pzHmEye" data-id="${k}" aria-label="${off ? "Afficher" : "Masquer"} ${t}">${ico(off ? "pzEyeOff" : "pzEye")}</button></div>`; }).join("");
  return `<button class="pz-hlive" data-act="pzHomeEdit"><span class="pz-hlive-art" aria-hidden="true"><i></i><i></i><i></i></span><span class="tx"><b>Modifier sur l'accueil</b><em>Les blocs bougent, rangez-les du bout du doigt</em></span>${ico("chev")}</button>
    <div class="lbl pz-lbl">Actions rapides</div>
    <button class="glass pz-qcard" data-act="pzQaSheet">${pzQA().map(([r, i, t, c]) => `<span class="pz-qmini"><span class="pz-qwell ${c}">${ico(i)}</span><span>${t}</span></span>`).join("")}<span class="pz-qedit">${ico("edit")}</span></button>
    <div class="lbl pz-lbl">Blocs</div>
    <div class="glass pz-mlist">${rows}</div>
    ${pzPrefs().home ? `<button class="btn ghost block pz-sreset" data-act="pzResetSec" data-v="home">${ico("pzReset")}Accueil par défaut</button>` : ""}`;
}
VIEWS.perso = {
  render() {
    const sec = ["menu", "tabs", "home"].includes(PZ.sec) ? PZ.sec : "menu"; const ix = ["menu", "tabs", "home"].indexOf(sec);
    const own = !!pzOwn(); const team = !own && S.resto && pzObj(S.resto.uiDefault);
    const gerant = myRole() === "gerant";
    return `<div class="inner narrow pz">${topBar("Personnaliser")}
      <div class="pz-hero st" style="--i:1"><div class="pz-hero-art" aria-hidden="true"><span class="w-vi">${ico("therm")}</span><span class="w-sa">${ico("truck")}</span><span class="w-sk">${ico("snow")}</span><span class="w-to">${ico("book")}</span></div><div><b>L'app, à votre façon</b><span>${team ? "Vous utilisez la présentation de l'équipe" : "Rien que pour vous · tout se remet à zéro"}</span></div></div>
      <div class="seg pz-seg st" style="--i:2"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${ix * 100}%)"></span><button class="${sec === "menu" ? "on" : ""}" data-act="pzSec" data-v="menu">Menu</button><button class="${sec === "tabs" ? "on" : ""}" data-act="pzSec" data-v="tabs">Barre du bas</button><button class="${sec === "home" ? "on" : ""}" data-act="pzSec" data-v="home">Accueil</button></div>
      <div class="pz-body st" style="--i:3">${sec === "menu" ? pzMenuSec() : sec === "tabs" ? pzTabsSec() : pzHomeSec()}</div>
      <div class="pz-foot st" style="--i:4">
        ${gerant && (own || team) ? `<button class="btn soft block" data-act="pzTeam">${ico("users")}Appliquer à toute l'équipe</button>` : ""}
        ${gerant && S.resto && pzObj(S.resto.uiDefault) ? `<button class="btn ghost block" data-act="pzTeamOff">Retirer la présentation d'équipe</button>` : ""}
        ${own ? `<button class="btn ghost block pz-all" data-act="pzResetAll">${ico("pzReset")}Tout réinitialiser</button>` : ""}
      </div></div>`;
  },
  after(v) { pzDragInit(v); },
};

/* module sheet: icon, colour, name, hide, move */
function pzModSheetHTML(k) {
  const all = pzNavAll(); const x = all.find((y) => y[0] === k); if (!x) return "";
  const [, i, t, c, h, i0, t0] = x; const W = PZ_WELL0(); const cc = c || W[k] || "w-vi"; const lock = PZ_LOCK.has(k);
  const n = (pzPrefs().nav || {}).name || {};
  return `<div class="pz-sh"><div class="pz-mhead">${pzWell(cc, i, true)}<div style="min-width:0;flex:1"><div class="h2">${esc(t)}</div><span class="sub">${t !== t0 ? `Nom d'origine : ${esc(t0)}` : "Icône, couleur et nom"}</span></div></div>
    <label class="field pz-name"><span>Nom</span><input class="input" id="pzName" maxlength="28" value="${esc(n[k] || "")}" placeholder="${esc(t0)}" data-id="${k}" autocomplete="off"></label>
    <div class="lbl pz-lbl">Couleur</div>
    <div class="pz-cols">${PZ_COLS.map(([cl, nm]) => `<button class="pz-col ${cl} ${cl === cc ? "on" : ""}" data-act="pzModCol" data-id="${k}" data-v="${cl}" aria-label="${nm}"><i></i></button>`).join("")}</div>
    <div class="lbl pz-lbl">Icône</div>
    <div class="pz-icons">${PZ_ICONS.filter((q) => IC[q]).map((q) => `<button class="pz-ic ${q === i ? "on" : ""}" data-act="pzModIc" data-id="${k}" data-v="${q}" aria-label="Icône ${q === i0 ? "d'origine" : q}">${ico(q)}</button>`).join("")}</div>
    <div class="pz-mfoot">
      <button class="btn soft sm" data-act="pzModMove" data-id="${k}" data-v="-1">${ico("pzUp")}Monter</button><button class="btn soft sm" data-act="pzModMove" data-id="${k}" data-v="1">${ico("pzDown")}Descendre</button>
      ${lock ? "" : `<button class="btn soft sm" data-act="pzNavEye" data-id="${k}">${ico(h ? "pzEye" : "pzEyeOff")}${h ? "Afficher" : "Masquer"}</button>`}
    </div>
    <div class="grid2" style="margin-top:14px"><button class="btn ghost" data-act="pzModReset" data-id="${k}">${ico("pzReset")}D'origine</button><button class="btn acc" data-act="pzModOk">${ico("check")}C'est bon</button></div></div>`;
}
function pzNavEdit(fn) { pzSet((u) => { u.nav = u.nav || {}; fn(u.nav); }); }
function pzNavMove(k, d) { pzNavEdit((n) => { const o = pzNavAll().map((x) => x[0]); const i = o.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= o.length) return; o.splice(i, 1); o.splice(j, 0, k); n.order = o; }); }

/* drag to reorder the menu list (pointer: mouse, pen and touch on the grip) */
function pzDragInit(v) {
  const list = $("#pzMlist", v); if (!list) return;
  list.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-drag]"); if (!g) return; const row = g.closest(".pz-mrow"); if (!row) return;
    e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (x) {}
    const rows = $$(".pz-mrow", list); const r0 = row.getBoundingClientRect(); const h = r0.height;
    const D = { row, y0: e.clientY, from: rows.indexOf(row), to: rows.indexOf(row), rows, h, mids: rows.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }) };
    PZ.drag = D; row.classList.add("drag"); list.classList.add("dragging"); buzz(6); SFX.tick();
    const move = (ev) => {
      const dy = ev.clientY - D.y0; row.style.transform = `translateY(${dy}px) scale(1.02)`;
      const cy = D.mids[D.from] + dy; let to = D.from;
      D.mids.forEach((m, i) => { if (i < D.from && cy < m) to = Math.min(to, i); if (i > D.from && cy > m) to = Math.max(to, i); });
      if (to !== D.to) { D.to = to; buzz(3); }
      D.rows.forEach((r, i) => { if (r === row) return; const sh = D.from < D.to && i > D.from && i <= D.to ? -D.h : D.from > D.to && i >= D.to && i < D.from ? D.h : 0; r.style.transform = sh ? `translateY(${sh}px)` : ""; });
    };
    const up = () => {
      g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up);
      list.classList.remove("dragging"); row.classList.remove("drag"); D.rows.forEach((r) => { r.style.transform = ""; }); PZ.drag = null;
      if (D.to !== D.from) { const o = pzNavAll().map((x) => x[0]); const [k] = o.splice(D.from, 1); o.splice(D.to, 0, k); SFX.ok(); pzNavEdit((n) => { n.order = o; }); }
    };
    g.addEventListener("pointermove", move); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
  });
}

/* Réglages row (compte.js) */
function pzRow() { return `<div class="li tap" data-go="perso"><span class="ic w-vi">${ico("pzBrush")}</span><div class="tx"><b>Personnaliser l'app</b><em>Menu, barre du bas, accueil</em></div>${ico("chev")}</div>`; }

Object.assign(ACT, {
  pzSec: (a, id, v) => { PZ.sec = v; SFX.tick(); rerender(); },
  pzMod: (a, k) => { if (PZ.drag) return; openSheet(pzModSheetHTML(k), (b) => { const inp = $("#pzName", b); inp && inp.addEventListener("input", debounce(() => { pzNavEdit((n) => { n.name = n.name || {}; const v = inp.value.trim(); if (v) n.name[k] = v; else delete n.name[k]; }); const hd = $(".pz-mhead .h2", b); if (hd) hd.textContent = inp.value.trim() || inp.placeholder; }, 350)); }); },
  pzModOk: () => { closeSheet(); SFX.ok(); },
  pzModIc: (a, k, v) => { SFX.tick(); buzz(5); pzNavEdit((n) => { n.ic = n.ic || {}; const x = pzNavAll().find((y) => y[0] === k); if (x && v === x[5]) delete n.ic[k]; else n.ic[k] = v; }); pzModRefresh(k); },
  pzModCol: (a, k, v) => { SFX.tick(); buzz(5); pzNavEdit((n) => { n.col = n.col || {}; if (v === (PZ_WELL0()[k] || "w-vi")) delete n.col[k]; else n.col[k] = v; }); pzModRefresh(k); },
  pzModMove: (a, k, v) => { SFX.tick(); pzNavMove(k, +v); },
  pzModReset: (a, k) => { SFX.close(); pzNavEdit((n) => { ["ic", "col", "name"].forEach((f) => { if (n[f]) delete n[f][k]; }); }); pzModRefresh(k, true); },
  pzNavEye: (a, k) => { if (PZ_LOCK.has(k)) return; SFX.tick(); buzz(6); pzNavEdit((n) => { const s = new Set(n.hide || []); if (s.has(k)) s.delete(k); else s.add(k); n.hide = [...s]; }); if ($("#sheet").classList.contains("open") && $(".pz-mhead")) pzModRefresh(k); },
  pzSlot: (a, id, v) => { S.ui.pzSlot = +v; SFX.tick(); rerender(); },
  pzTabPick: (a, r) => {
    const t = pzTabs(); const n = S.ui.pzSlot === 1 ? 1 : 0; if (t[n] === r) return;
    const o = t.indexOf(r); if (o >= 0) t[o] = t[n]; t[n] = r; SFX.ok(); buzz(8);
    pzSet((u) => { u.tabs = t; }); const tb = $("#tabbar"); if (tb) { tb.classList.remove("pz-flash"); void tb.offsetWidth; tb.classList.add("pz-flash"); }
  },
  pzHmMove: (a, k, v) => { SFX.tick(); pzSet((u) => { const h = pzHomeNorm(u.home); const i = h.order.indexOf(k), j = i + +v; if (j < 0 || j >= h.order.length) return; h.order.splice(i, 1); h.order.splice(j, 0, k); u.home = { ...(u.home || {}), order: h.order, hide: h.hide }; }); },
  pzHmEye: (a, k) => { SFX.tick(); buzz(6); pzSet((u) => { const h = pzHomeNorm(u.home); const s = new Set(h.hide); if (s.has(k)) s.delete(k); else s.add(k); u.home = { ...(u.home || {}), order: h.order, hide: [...s] }; }); },
  pzResetSec: (a, id, v) => { SFX.close(); buzz(8); pzSet((u) => { delete u[v]; }); toast(v === "nav" ? "Menu remis par défaut" : v === "tabs" ? "Onglets remis par défaut" : "Accueil remis par défaut"); },
  pzResetAll: () => {
    openSheet(`<div class="pz-sh" style="text-align:center"><span class="pz-well w-to big" style="margin:0 auto">${ico("pzReset")}</span><div class="h2" style="margin-top:12px">Tout remettre comme au début ?</div><p class="sub">Menu, barre du bas et accueil reprennent leur présentation d'origine.</p>
      <button class="btn acc block" data-act="pzResetAllOk" style="margin-top:14px">${ico("pzReset")}Tout réinitialiser</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
  },
  pzResetAllOk: () => { closeSheet(true); pzSave(null); SFX.done(); toast("Tout est revenu par défaut"); },
  pzTeam: () => {
    if (myRole() !== "gerant") return;
    openSheet(`<div class="pz-sh" style="text-align:center"><span class="pz-well w-mi big" style="margin:0 auto">${ico("users")}</span><div class="h2" style="margin-top:12px">Pour toute l'équipe ?</div><p class="sub">Ceux qui n'ont rien personnalisé verront votre menu, vos onglets et votre accueil. Chacun peut ensuite changer le sien.</p>
      <button class="btn acc block" data-act="pzTeamOk" style="margin-top:14px">${ico("check")}Appliquer à l'équipe</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
  },
  pzTeamOk: async () => {
    closeSheet(true); const u = pzTidy(pzEditable()); if (!u) return;
    try { await DB.update("restos", S.rid, { uiDefault: u }); if (S.resto) S.resto.uiDefault = u; SFX.done(); burst(); toast("Présentation partagée avec l'équipe"); } catch (e) { toast("Impossible pour l'instant", "err"); }
    PZ.cache = null; rerender();
  },
  pzTeamOff: async () => { try { await DB.update("restos", S.rid, { uiDefault: null }); if (S.resto) S.resto.uiDefault = null; toast("Présentation d'équipe retirée"); } catch (e) { toast("Impossible pour l'instant", "err"); } pzApply(); },
  /* home edit mode */
  pzHomeEdit: () => pzHomeStart(),
  pzHomeDone: () => pzHomeEnd(true),
  pzHomeCancel: () => pzHomeEnd(false),
  pzHomeReset: () => { if (!PZ.he) return; PZ.he.order = PZ_HOME_DEF.slice(); PZ.he.hide = []; PZ.he.qa = PZ_QA_DEF.slice(); SFX.close(); buzz(8); rerender(); toast("Accueil d'origine · touchez Terminé"); },
  pzHbMove: (a, k, v) => { const d = PZ.he; if (!d) return; const vis = d.order; const i = vis.indexOf(k), j = i + +v; if (j < 0 || j >= vis.length) return; vis.splice(i, 1); vis.splice(j, 0, k); SFX.tick(); buzz(5); S.ui.pzMoved = k; rerender(); },
  pzHbEye: (a, k) => { const d = PZ.he; if (!d) return; const s = new Set(d.hide); if (s.has(k)) s.delete(k); else s.add(k); d.hide = [...s]; SFX.tick(); buzz(6); rerender(); },
  pzQaSheet: () => openSheet(pzQaSheetHTML(pzQaList())),
  pzQaTog: (a, r) => { SFX.tick(); buzz(5); pzQaSet((q) => { const i = q.indexOf(r); if (i >= 0) { if (q.length > 3) q.splice(i, 1); } else if (q.length < 6) q.push(r); }); },
  pzQaMove: (a, r, v) => { SFX.tick(); pzQaSet((q) => { const i = q.indexOf(r), j = i + +v; if (j < 0 || j >= q.length) return; q.splice(i, 1); q.splice(j, 0, r); }); },
});
function pzModRefresh(k) { const b = $("#sheetBody"); const sc = b ? b.scrollTop : 0; const f = document.activeElement && document.activeElement.id === "pzName"; if (f) return; ACT.pzMod(null, k); if (b) b.scrollTop = sc; }

/* leaving home while editing drops the draft; the team default can arrive late (resto snapshot) */
document.addEventListener("click", (e) => { if (PZ.he && e.target.closest("[data-tab],.side [data-go]")) { PZ.he = null; VIEWS.home.hideTabs = false; } }, true);
if (typeof TAB_OF === "object") TAB_OF.perso = "more";
