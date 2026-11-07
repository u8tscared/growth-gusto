/* Growth Gusto — area: pourboires (route « pourboires »). Prefix « tp ».
   La cagnotte de l'équipe sur le mois, et la part de chacun.
   - D'où viennent les pourboires, sans double saisie :
       · l'addition en salle (js/salle.js) : en libérant la table, le serveur touche « 2 € », « 5 € », « 10 % » ou « Autre », carte ou espèces ;
       · le menu QR (commande/, functions/src/commande.js) : le client ajoute un pourboire en payant en ligne (Stripe), le serveur l'inscrit ici ;
       · la caisse connectée (functions/src/caisse.js) : les pourboires de SumUp et Square arrivent seuls ;
       · le bocal à espèces, ou toute autre somme : « Ajouter » (tout le monde peut le faire, c'est signé).
   - Le tableau du mois : total, part carte / en ligne / espèces, une barre par jour (touchez un jour pour voir son détail), comparaison
     avec le mois d'avant, le journal des pourboires.
   - La répartition, réglée par le gérant : des groupes (Salle 60 %, Cuisine 40 % par défaut), chacun à parts égales ou selon les heures
     pointées (js/rh.js staffCost). Le gérant peut sortir quelqu'un de la cagnotte ou le changer de groupe. Un groupe vide ce mois-là
     voit son pourcentage reversé aux autres, et l'écran le dit.
   - Chacun voit la cagnotte et sa part (« Ma part »), et par défaut la part de chacun (réglable).
   - Fin de mois : « Clôturer » fige les parts (tipMonths), export CSV pour la paie, « Marquer comme versé ».
   Data (members read; rules: tipCfg and tipMonths written by the gérant only):
     restos/{rid}/tips/{id}        { at, day, amount, method:"cb"|"ligne"|"especes", src:"salle"|"qr"|"caisse"|"bocal",
                                     table?, tabId?, orderId?, provider?, waiter?, waiterName?, service?: "midi"|"soir", note?, uid, by }
                                   ids written by the server: qr_{orderId}, pos_{provider}_{extId}
     restos/{rid}/tipCfg/rule      { groups:[{ id, t, pct, posts:[poste], mode:"egal"|"heures", c }], out:[staffId] (hors cagnotte),
                                     to:{ staffId: groupId }, showAll, at, by }
     restos/{rid}/tipMonths/{YYYY-MM} { mk, total, n, groups:[{id,t,pct,eff,amt,mode,c}], shares:[{id,name,group,h,amt}], closedAt, closedBy,
                                     closedByName, paid, paidAt?, paidBy? }
   Pack Second (AB_GATE). Exposed: tpMonthTotal(mk) → € of the month, tpMyShare() → { amt, group } for the person signed in. */
"use strict";

TAB_OF.pourboires = "more";
(function tpNav() { /* side nav, « Équipe » section: after « Équipe & salaires » (no edit of the shared NAV list) */
  if (NAV.some((n) => n[0] === "pourboires")) return;
  const i = NAV.findIndex((n) => n[0] === "equipe"), j = i >= 0 ? i : NAV.findIndex((n) => n[0] === "planning");
  NAV.splice(j >= 0 ? j + 1 : NAV.length, 0, ["pourboires", "tpJar", "Pourboires"]);
})();
try { if (typeof AB_GATE !== "undefined") AB_GATE.pourboires = ["pro", "Pourboires"]; } catch (e) {}
/* the lesson of the « Prise en main » (js/lecons.js, js/parcours.js) */
if (typeof PC_LECONS === "object") PC_LECONS.pourboires = {
  t: "Pourboires", d: "La cagnotte de l'équipe sur le mois : ce qui est rentré, d'où ça vient, et la part de chacun, calculée toute seule.",
  who: ["salle", "bar", "cuisine", "plonge", "boss"],
  steps: ["En libérant une table, touchez le pourboire laissé", "Le soir, ajoutez le bocal à espèces avec le +", "Regardez « Ma part » : elle suit la cagnotte en direct"],
  q: ["Un client laisse 5 € en carte. Que faites-vous ?", ["Je touche « 5 € » en libérant la table", "Je le note sur un papier", "Rien, ça se perd"], 0],
  tip: "Les pourboires du menu QR et de la caisse connectée arrivent seuls dans la cagnotte.",
  sc: { k: "list", t: "Cagnotte de novembre", rows: [["tpJar", "Salle · 60 %", "772 €", "acc"], ["tpJar", "Cuisine · 40 %", "514 €", "ok"], ["tpCoin", "Ma part", "386 €", "acc"]] },
};
try { if (typeof PC_FAMILLES !== "undefined" && !PC_FAMILLES.some((f) => f[4].includes("pourboires"))) { const k = PC_FAMILLES.findIndex((f) => f[0] === "salaires"); PC_FAMILLES.splice(k >= 0 ? k + 1 : PC_FAMILLES.length, 0, ["pourboires", "Pourboires", "La cagnotte du mois et la part de chacun", "tpJar", ["pourboires"], "Équipe"]); } } catch (e) {}
/* « Mon espace » and « En service » (js/espaces.js): everyone sees the pot and their share */
try { if (typeof ES_MOI_SET !== "undefined" && !ES_MOI_SET.includes("pourboires")) ES_MOI_SET.push("pourboires"); } catch (e) {}
try { if (typeof ES_ALWAYS !== "undefined" && !ES_ALWAYS.includes("pourboires")) ES_ALWAYS.push("pourboires"); } catch (e) {}
try { if (typeof ES_WELL !== "undefined") ES_WELL.pourboires = "w-sa"; } catch (e) {}
Object.assign(IC, {
  tpJar: ["M8.5 3.5h7v3h-7z", "M7 6.5h10", "M7.6 6.5C6 7.9 5 10 5 12.6V18a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18v-5.4c0-2.6-1-4.7-2.6-6.1", "f:M7.6 6.5h8.8C18 7.9 19 10 19 12.6V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-5.4c0-2.6 1-4.7 2.6-6.1z", "c:12,14.5,2.8", "M12 13.3v2.4"],
  tpCoin: ["c:12,12,8.5", "f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M14.6 9.3A3 3 0 0 0 12 8c-1.6 0-2.7.9-2.7 2 0 2.6 5.5 1.3 5.5 4 0 1.1-1.2 2-2.8 2a3.2 3.2 0 0 1-2.7-1.4", "M12 6.5V8", "M12 16v1.5"],
  tpCard: ["r:2.5,5.5,19,13,2.5", "f:M2.5 8a2.5 2.5 0 0 1 2.5-2.5h14A2.5 2.5 0 0 1 21.5 8v1.5h-19z", "M2.5 9.5h19", "M6 14.5h4"],
  tpCash: ["r:2.5,6.5,19,11,2", "f:M4.5 6.5h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z", "c:12,12,2.6", "M6 9.5v.01", "M18 14.5v.01"],
  tpPhone: ["r:6.5,2.5,11,19,2.5", "f:M9 2.5h6a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 19V5A2.5 2.5 0 0 1 9 2.5z", "M10.5 18.5h3", "M9.5 7h2v2h-2z", "M12.5 7h2v2h-2z", "M9.5 10h2v2h-2z", "M14.5 11.5v.5"],
  tpPos: ["r:5.5,2.5,13,19,2.5", "f:M8 2.5h8a2.5 2.5 0 0 1 2.5 2.5v4.5h-13V5A2.5 2.5 0 0 1 8 2.5z", "M8 5.5h8v3H8z", "M8.8 13h.01", "M12 13h.01", "M15.2 13h.01", "M8.8 16.5h.01", "M12 16.5h.01", "M15.2 16.5h.01"],
  tpSplit: ["c:12,12,8.5", "M12 3.5V12l7.3 4.3", "f:M12 3.5a8.5 8.5 0 0 1 7.3 12.8L12 12z"],
  tpLock: ["r:5,10.5,14,10,2.5", "f:M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-5a2.5 2.5 0 0 1 2.5-2.5z", "M8 10.5V7.5a4 4 0 0 1 8 0v3", "M12 14.5v2"],
  tpPaid: ["c:12,12,8.5", "f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "m8.3 12.3 2.5 2.5 5-5.3"],
  tpL: ["m14.5 6-6 6 6 6"], tpR: ["m9.5 6 6 6-6 6"],
});

/* ───────── vocabulary ───────── */
const TP_METHODS = { cb: ["Carte", "tpCard"], ligne: ["En ligne", "tpPhone"], especes: ["Espèces", "tpCash"] };
const TP_SRC = { salle: "Addition en salle", qr: "Menu QR", caisse: "Caisse connectée", bocal: "Ajouté à la main" };
const TP_COLORS = ["#1F7AE0", "#5B2BFF", "#E0752F", "#0E8C9E"];
const TP_DEF = [{ id: "salle", t: "Salle", pct: 60, posts: ["salle", "bar"], mode: "egal", c: "#1F7AE0" }, { id: "cuisine", t: "Cuisine", pct: 40, posts: ["cuisine", "plonge"], mode: "egal", c: "#5B2BFF" }];
const TP_POSTS = [["salle", "Salle"], ["bar", "Bar"], ["cuisine", "Cuisine"], ["plonge", "Plonge"]];
const TP_PRESETS = [[60, 40], [50, 50], [70, 30]];
const TP = { rid: null, rows: null, cfg: null, cfgSeen: false, months: {}, per: "mois", yr: 0, off: 0, day: null, all: false, anim: "", ed: null, add: null, bill: null, seeded: null };

const tpR2 = (v) => Math.round((+v || 0) * 100) / 100;
const tpEur = (v, d = 2) => `${(+v || 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
const tpEur0 = (v) => tpEur(v, Math.abs(v) >= 100 || Math.round(v) === +v ? 0 : 2);
const tpMk = (off = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off); return monthKey(d); };
const tpRange = (mk) => { const [y, m] = mk.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${mk}-01`, `${mk}-${pad(last)}`, last]; };
const tpMonthName = (mk) => MONTHS[+mk.slice(5) - 1];
const tpMonthLbl = (mk) => `${tpMonthName(mk)}${mk.slice(0, 4) !== String(new Date().getFullYear()) ? " " + mk.slice(0, 4) : ""}`;
const tpDe = (mk) => (/^[aeiouyéèêàâîôûœ]/i.test(tpMonthName(mk)) ? "d'" : "de ") + tpMonthLbl(mk);
const tpPl = (n, w, p) => `${n} ${n > 1 ? p || w + "s" : w}`;
const tpBoss = () => { try { return typeof PERMS === "undefined" || !PERMS.isAdmin || PERMS.isAdmin(); } catch (e) { return myRole() === "gerant"; } };
const tpDayOf = (r) => r.day || dayKey(new Date(r.at || Date.now()));
const tpMethod = (r) => (TP_METHODS[r.method] ? r.method : r.src === "qr" ? "ligne" : r.src === "caisse" ? "cb" : "especes");
/* month offset (0 = this month) of a "YYYY-MM" key */
const tpOffOf = (mk) => { const n = new Date(); return (+mk.slice(0, 4) - n.getFullYear()) * 12 + +mk.slice(5, 7) - 1 - n.getMonth(); };
const tpYearRows = (y) => (TP.rows || []).filter((r) => tpDayOf(r).slice(0, 4) === String(y));
const tpDayLbl = (d) => (d === dayKey() ? "Aujourd'hui" : d === addDays(dayKey(), -1) ? "Hier" : tpCap(new Date(parseDay(d)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", ...(d.slice(0, 4) !== String(new Date().getFullYear()) ? { year: "numeric" } : {}) })));
const tpCap = (t) => String(t || "").replace(/^./, (c) => c.toUpperCase());
const tpOpen = () => !$("#sheet").classList.contains("open");

/* ───────── data ───────── */
function tpWatch() {
  if (!S.rid || !S.ready) return;
  /* this device or the demo: the listeners are dropped when a restaurant is attached again (core attachResto, demo re-entered) */
  if (TP.rid === S.rid && DB.mode !== "db" && !(DB.listeners[DB.path("tips")] || []).includes(TP.cbT)) TP.rid = null;
  if (TP.rid === S.rid) return; TP.rid = S.rid; TP.rows = null; TP.cfg = null; TP.cfgSeen = false; TP.months = {};
  const rid = S.rid;
  if (DB.mode === "demo") tpSeedDemo();
  const re = () => { if (S.route === "pourboires" && tpOpen()) refresh(); };
  TP.cbT = (rows) => { if (S.rid !== rid) return; TP.rows = rows.filter((r) => !r.void && +r.amount > 0); re(); };
  DB.watch("tips", { order: "at", dir: "desc", limit: 4000 }, TP.cbT);
  DB.watch("tipCfg", {}, (rows) => { if (S.rid !== rid) return; TP.cfg = rows.find((r) => r.id === "rule") || null; TP.cfgSeen = true; re(); });
  DB.watch("tipMonths", {}, (rows) => { if (S.rid !== rid) return; TP.months = Object.fromEntries(rows.map((r) => [r.id, r])); re(); });
  try { if (typeof cxEnsure === "function") cxEnsure(); } catch (e) {}
  try { if (typeof cmWatch === "function") cmWatch(); } catch (e) {}
}
const tpRowsOf = (mk) => (TP.rows || []).filter((r) => tpDayOf(r).slice(0, 7) === mk);
function tpMonthTotal(mk = tpMk()) { tpWatch(); return tpR2(tpRowsOf(mk).reduce((a, r) => a + +r.amount, 0)); }
window.tpMonthTotal = tpMonthTotal;

/* the rule, with its defaults */
function tpRule() {
  const c = TP.cfg || {};
  const gs = (Array.isArray(c.groups) && c.groups.length ? c.groups : TP_DEF).map((g, i) => ({ id: String(g.id || "g" + i), t: String(g.t || "Groupe"), pct: Math.max(0, Math.min(100, Math.round(+g.pct || 0))), posts: Array.isArray(g.posts) ? g.posts : [], mode: g.mode === "heures" ? "heures" : "egal", c: g.c || TP_COLORS[i % TP_COLORS.length] }));
  return { groups: gs, out: Array.isArray(c.out) ? c.out : null, to: c.to && typeof c.to === "object" ? c.to : {}, showAll: c.showAll !== false, set: !!TP.cfg };
}
/* the poste of a person: their file, else guessed from the job title */
function tpPost(p) {
  if (p.post && RH_POSTS[p.post]) return p.post;
  const r = String(p.role || "").toLowerCase();
  if (/barman|barmaid|bar\b|mixolog/.test(r)) return "bar";
  if (/serv|salle|maître|maitre|sommel|runner|chef de rang|hôte|hote/.test(r)) return "salle";
  if (/plong/.test(r)) return "plonge";
  if (/chef|second|commis|cuisin|pâtiss|patiss|cuisson/.test(r)) return "cuisine";
  return "";
}
const tpOwner = (p) => !!(p.memberId && S.resto && S.resto.owner === p.memberId);
const tpIsOut = (p, R) => (R.out ? R.out.includes(p.id) : tpOwner(p));
function tpGroupOf(p, R) { const g = R.to[p.id]; if (g && R.groups.some((x) => x.id === g)) return g; const post = tpPost(p); const x = R.groups.find((x) => x.posts.includes(post)); return x ? x.id : ""; }
/* hours worked in a month, per person (punches, else planned shifts: js/rh.js) */
function tpHours(mk) {
  const [a, b] = tpRange(mk); const to = b < dayKey() ? b : dayKey(); const out = {};
  if (a > to || typeof staffCost !== "function") return out;
  try { staffCost(a, to).byStaff.forEach((x) => { out[x.id] = Math.round(x.hours * 10) / 10; }); } catch (e) {}
  return out;
}
function tpPeople() { return typeof rhPeople === "function" ? rhPeople() : []; }

/* the split of one month: live, or frozen when the month is closed */
function tpCalc(mk, R = tpRule()) {
  const rows = tpRowsOf(mk); const total = tpR2(rows.reduce((a, r) => a + +r.amount, 0));
  const hrs = tpHours(mk); const anyH = Object.values(hrs).some((h) => h > 0);
  const ppl = tpPeople(); const out = ppl.filter((p) => tpIsOut(p, R)); const none = ppl.filter((p) => !tpIsOut(p, R) && !tpGroupOf(p, R) && (!anyH || hrs[p.id] > 0));
  const groups = R.groups.map((g) => {
    const all = ppl.filter((p) => !tpIsOut(p, R) && tpGroupOf(p, R) === g.id).map((p) => ({ p, h: hrs[p.id] || 0 }));
    const el = anyH ? all.filter((m) => m.h > 0) : all; /* who worked this month (everyone of the group when nothing is pointed or planned) */
    return { ...g, all, el, idle: all.filter((m) => !el.includes(m)) };
  });
  const live = groups.filter((g) => g.el.length && g.pct > 0); const pctLive = live.reduce((a, g) => a + g.pct, 0);
  let given = 0;
  groups.forEach((g) => {
    g.eff = live.includes(g) && pctLive ? (g.pct * 100) / pctLive : 0; g.amt = tpR2((total * g.eff) / 100);
    const byH = g.mode === "heures" && g.el.some((m) => m.h > 0); const W = g.el.reduce((a, m) => a + (byH ? m.h : 1), 0) || 1;
    g.byH = byH; g.el.forEach((m) => { m.w = byH ? m.h : 1; m.amt = Math.floor((g.amt * m.w * 100) / W) / 100; given += m.amt; });
  });
  const shares = groups.flatMap((g) => g.el.map((m) => ({ id: m.p.id, name: m.p.name, group: g.id, h: m.h, amt: m.amt })));
  return { mk, rows, total, groups, shares, out, none, empty: groups.filter((g) => g.pct > 0 && !g.el.length), left: tpR2(total - given), anyH, frozen: null };
}
/* a closed month shows its frozen split */
function tpView(mk) {
  const live = tpCalc(mk); const f = TP.months[mk];
  if (!f) return live;
  const ppl = Object.fromEntries(tpPeople().map((p) => [p.id, p]));
  const groups = (f.groups || []).map((g) => { const el = (f.shares || []).filter((s) => s.group === g.id).map((s) => ({ p: ppl[s.id] || { id: s.id, name: s.name, color: colorFor(s.id) }, h: s.h || 0, amt: s.amt, w: 1 })); return { ...g, all: el, el, idle: [], byH: g.mode === "heures" }; });
  return { ...live, total: f.total, groups, shares: f.shares || [], empty: [], left: tpR2(f.total - (f.shares || []).reduce((a, s) => a + s.amt, 0)), frozen: f, late: tpR2(live.total - f.total), none: [], out: [] };
}
function tpMe() { const ppl = tpPeople(); return ppl.find((p) => p.memberId === S.me.id) || ppl.find((p) => p.id === "m_" + S.me.id) || null; }
function tpMyShare(mk = tpMk()) { const me = tpMe(); if (!me) return null; const v = tpView(mk); const s = v.shares.find((x) => x.id === me.id); return s ? { amt: s.amt, group: s.group, h: s.h } : null; }
window.tpMyShare = tpMyShare;

/* ───────── demo: 5 weeks of tips (October closed and paid, November in progress) ───────── */
function tpSeedDemo() {
  const path = DB.path("tips"); if (DB.local[path] && Object.keys(DB.local[path]).length) return;
  let seed = 4207; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const L = {}; let n = 0; const today = dayKey(), now = Date.now(); const hNow = new Date().getHours();
  const waiters = [["demo-sarah", "Sarah Lemoine"], ["demo-camille", "Camille Laurent"], ["demo-lea", "Léa Fontaine"]];
  const put = (d) => { L["tpd" + (++n).toString(36)] = { uid: d.waiter || "demo-camille", by: d.waiterName || "Camille Laurent", ...d }; };
  const at = (day, h, m) => { const x = parseDay(day); x.setHours(h, m, Math.floor(rnd() * 59), 0); return x.getTime(); };
  const start = addDays(tpRange(tpMk(-1))[0], 0);
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const wd = parseDay(day).getDay(); if (wd === 1) continue; /* closed on Mondays */
    const busy = wd === 5 || wd === 6 ? 1.5 : wd === 0 ? 1.2 : 1;
    [["midi", 12, 14], ["soir", 19, 22]].forEach(([sv, h0, h1]) => {
      if (day === today && (sv === "soir" ? hNow < 20 : hNow < 13)) return;
      const nb = Math.round((sv === "soir" ? 4 : 3) * busy + rnd() * 2);
      for (let i = 0; i < nb; i++) {
        const w = pick(waiters[2] && wd >= 5 || wd === 0 ? waiters : waiters.slice(0, 2)); const t = at(day, h0 + Math.floor(rnd() * (h1 - h0 + 1)), Math.floor(rnd() * 59));
        if (t > now) continue;
        const amt = pick([2, 2, 3, 5, 5, 5, 4, 10, 2.5, 3.5, 6, 8]);
        put({ at: t, day, amount: amt, method: rnd() < 0.78 ? "cb" : "especes", src: "salle", table: String(1 + Math.floor(rnd() * 14)), waiter: w[0], waiterName: w[1], service: sv });
      }
      if (rnd() < 0.7) { const t = at(day, h0 + 1, Math.floor(rnd() * 59)); if (t < now) put({ at: t, day, amount: pick([1, 2, 2, 3, 1.5, 5]), method: "ligne", src: "qr", table: String(1 + Math.floor(rnd() * 14)), orderId: "", service: sv, uid: "server", by: "Menu QR" }); }
      if (rnd() < 0.55) { const t = at(day, h1, Math.floor(rnd() * 59)); if (t < now) put({ at: t, day, amount: pick([2, 3, 4.5, 5, 6.5]), method: "cb", src: "caisse", provider: "sumup", service: sv, uid: "server", by: "SumUp" }); }
    });
    if (day < today || hNow >= 23) put({ at: at(day, 23, 30), day, amount: Math.round(12 + rnd() * (wd >= 5 ? 34 : 18)), method: "especes", src: "bocal", note: "Bocal du soir", service: "soir", waiter: "demo-camille", waiterName: "Camille Laurent" });
  }
  DB.local[path] = L;
  /* the rule: salle selon les heures (Léa, extra, a moins d'heures), cuisine à parts égales, Camille (gérante) hors cagnotte */
  DB.local[DB.path("tipCfg")] = { rule: { groups: [{ ...TP_DEF[0], mode: "heures" }, { ...TP_DEF[1] }], out: ["s_demo-camille"], to: {}, showAll: true, at: now - 40 * 864e5, by: "demo-camille" } };
  DB.emit(path); DB.emit(DB.path("tipCfg"));
  /* last month: closed and paid, frozen with the same rule */
  setTimeout(() => {
    try {
      if (DB.mode !== "demo" || S.rid !== "demo") return; TP.rows = Object.entries(DB.local[path]).map(([id, d]) => ({ id, ...d })); TP.cfg = { id: "rule", ...DB.local[DB.path("tipCfg")].rule };
      const mk = tpMk(-1), c = tpCalc(mk); const [, b] = tpRange(mk); const closedAt = parseDay(addDays(b, 3)).getTime() + 10 * 36e5;
      DB.local[DB.path("tipMonths")] = { [mk]: { mk, total: c.total, n: c.rows.length, groups: c.groups.map((g) => ({ id: g.id, t: g.t, pct: g.pct, eff: g.eff, amt: g.amt, mode: g.mode, c: g.c })), shares: c.shares, closedAt, closedBy: "demo-camille", closedByName: "Camille Laurent", paid: true, paidAt: closedAt + 36e5, paidBy: "demo-camille" } };
      DB.emit(DB.path("tipMonths"));
    } catch (e) { console.warn("pourboires demo", e); }
  }, 0);
}

/* ───────── pieces ───────── */
const tpAva = (p, s = 36) => (typeof rhAva === "function" ? rhAva(p, s) : `<span class="tp-ava" style="--s:${s}px;--c:${esc(p.color || "#5A6386")}">${esc(initials(p.name))}</span>`);
function tpLabel(r) {
  const m = tpMethod(r);
  if (r.src === "salle") return [`Table ${esc(r.table || "?")}`, `${r.waiterName ? esc(firstName(r.waiterName)) + " · " : ""}${TP_METHODS[m][0]}`];
  if (r.src === "qr") return [`Menu QR${r.table ? ` · table ${esc(r.table)}` : ""}`, "Payé en ligne"];
  if (r.src === "caisse") { const p = typeof cxPos === "function" && r.provider ? cxPos(r.provider) : null; return [esc((p && p.id !== "autre" && p.name) || "Caisse connectée"), `Sur la caisse · ${TP_METHODS[m][0]}`]; }
  return [esc(r.note || (m === "especes" ? "Espèces" : "Pourboire")), `${TP_METHODS[m][0]}${r.by ? " · " + esc(firstName(r.by)) : ""}`];
}
function tpBars(mk, rows, today) {
  const [, , last] = tpRange(mk); const by = {};
  rows.forEach((r) => { const d = +tpDayOf(r).slice(8); const m = tpMethod(r); (by[d] ||= { cb: 0, ligne: 0, especes: 0, t: 0 }); by[d][m] += +r.amount; by[d].t += +r.amount; });
  const max = Math.max(1, ...Object.values(by).map((x) => x.t));
  const tday = today.slice(0, 7) === mk ? +today.slice(8) : mk < today.slice(0, 7) ? 99 : 0;
  return `<div class="tp-bars" role="group" aria-label="Pourboires par jour">${Array.from({ length: last }, (_, i) => {
    const d = i + 1, x = by[d], k = `${mk}-${pad(d)}`, on = TP.day === k, fut = d > tday, wd = parseDay(k).getDay();
    const segs = x ? ["especes", "ligne", "cb"].map((m) => (x[m] ? `<i class="m-${m}" style="height:${(x[m] / max) * 100}%"></i>` : "")).join("") : "";
    return `<button class="tp-bar${on ? " on" : ""}${fut ? " fut" : ""}${d === tday ? " now" : ""}${wd === 1 ? " mon" : ""}" data-act="tpDay" data-v="${k}" style="--j:${i}" aria-label="${d} : ${x ? tpEur(x.t) : "rien"}" ${fut ? "disabled" : ""}><span class="tp-bc">${segs}</span><em>${d === 1 || d % 5 === 0 || d === tday ? d : ""}</em></button>`;
  }).join("")}</div>`;
}
const tpMethLegend = (rows, total) => { const s = { cb: 0, ligne: 0, especes: 0 }; rows.forEach((r) => { s[tpMethod(r)] += +r.amount; });
  return { s, bar: `<div class="tp-mbar">${["cb", "ligne", "especes"].map((m) => (s[m] ? `<i class="m-${m}" style="flex:${s[m]}"></i>` : "")).join("") || `<i class="m-none" style="flex:1"></i>`}</div>`,
    keys: `<div class="tp-mkeys">${["cb", "ligne", "especes"].map((m) => `<span class="${s[m] ? "" : "zero"}"><i class="m-${m}"></i>${TP_METHODS[m][0]}<b class="mono">${tpEur0(s[m])}</b>${total > 0 && s[m] ? `<em>${Math.round((s[m] / total) * 100)} %</em>` : ""}</span>`).join("")}</div>` }; };

/* ───────── the period: Jour / Mois / Année (like the Finances screen), arrows, and a picker on the label ───────── */
const TP_PERS = [["jour", "Jour"], ["mois", "Mois"], ["annee", "Année"]];
function tpYears() { const yNow = new Date().getFullYear(); let y0 = yNow; (TP.rows || []).forEach((r) => { const y = +tpDayOf(r).slice(0, 4); if (y > 1999 && y < y0) y0 = y; }); const a = []; for (let y = yNow; y >= Math.max(y0, yNow - 9); y--) a.push(y); return a; }
function tpNav(per, mk, today) {
  const yNow = new Date().getFullYear(); const cur = tpMk();
  const lbl = per === "jour" ? tpDayLbl(TP.day) : per === "annee" ? String(TP.yr) : tpCap(tpMonthLbl(mk));
  const atEnd = per === "jour" ? TP.day >= today : per === "annee" ? TP.yr >= yNow : TP.off >= 0;
  const pick = per === "jour" ? `<input type="date" id="tpPick" max="${today}" value="${esc(TP.day)}" aria-label="Choisir un jour">`
    : per === "mois" ? `<input type="month" id="tpPick" max="${cur}" value="${mk}" aria-label="Choisir un mois">`
    : `<select id="tpPick" aria-label="Choisir une année">${tpYears().map((y) => `<option value="${y}"${y === TP.yr ? " selected" : ""}>${y}</option>`).join("")}</select>`;
  const i = TP_PERS.findIndex((x) => x[0] === per);
  return `<div class="tp-ctl st" style="--i:1"><div class="seg tp-per" role="tablist">${TP_PERS.map(([k, t]) => `<button class="${per === k ? "on" : ""}" data-act="tpPer" data-v="${k}" role="tab" aria-selected="${per === k}">${t}</button>`).join("")}<span class="knob" style="width:calc(33.33% - 2.67px);transform:translateX(${i * 100}%)"></span></div>
    <div class="tp-mnav"><button class="iconbtn" data-act="tpStep" data-v="-1" aria-label="Précédent">${ico("tpL")}</button><label class="tp-pick"><b>${esc(lbl)}</b>${ico("cal")}${pick}</label><button class="iconbtn" data-act="tpStep" data-v="1" aria-label="Suivant" ${atEnd ? "disabled" : ""}>${ico("tpR")}</button></div></div>`;
}
/* one day: its total, midi / soir, how it was paid; the month bars stay to jump to another day */
function tpDayHero(rows, monthRows, mk, today) {
  const total = tpR2(rows.reduce((a, r) => a + +r.amount, 0)); const L = tpMethLegend(rows, total);
  const sv = (k) => tpR2(rows.filter((r) => (r.service || (new Date(r.at).getHours() < 16 ? "midi" : "soir")) === k).reduce((a, r) => a + +r.amount, 0));
  const wk = addDays(TP.day, -7); const wkT = tpR2((TP.rows || []).filter((r) => tpDayOf(r) === wk).reduce((a, r) => a + +r.amount, 0));
  return `<section class="tp-hero wall st" style="--i:2">
      <div class="tp-hero-t"><span class="tp-kick">${ico("tpJar")}Pourboires du jour</span>${TP.day === today ? `<span class="tp-st live"><i></i>En cours</span>` : ""}</div>
      <div class="tp-big mono" data-to="${total}" data-k="${TP.day}:${total}">${tpEur(total)}</div>
      <p class="tp-sub">${rows.length ? tpPl(rows.length, "pourboire") : "Aucun pourboire ce jour-là"}${wkT > 0 ? ` · ${esc(DAYS[parseDay(wk).getDay()])} précédent : <b>${tpEur0(wkT)}</b>` : ""}</p>
      <div class="tp-svs"><span><em>Midi</em><b class="mono">${tpEur0(sv("midi"))}</b></span><span><em>Soir</em><b class="mono">${tpEur0(sv("soir"))}</b></span></div>
      ${L.bar}${L.keys}
      ${tpBars(mk, monthRows, today)}
    </section>`;
}
/* one year: 12 bars, month by month, and what each person received */
function tpYearHtml(nav, boss) {
  const y = TP.yr, yNow = new Date().getFullYear(), mNow = new Date().getMonth(); const rows = tpYearRows(y);
  const total = tpR2(rows.reduce((a, r) => a + +r.amount, 0)); const prev = tpR2(tpYearRows(y - 1).reduce((a, r) => a + +r.amount, 0));
  const L = tpMethLegend(rows, total); const mks = Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`);
  const by = {}; rows.forEach((r) => { const k = tpDayOf(r).slice(0, 7); const m = tpMethod(r); (by[k] ||= { cb: 0, ligne: 0, especes: 0, t: 0, n: 0 }); by[k][m] += +r.amount; by[k].t += +r.amount; by[k].n++; });
  const max = Math.max(1, ...Object.values(by).map((x) => x.t));
  const bars = `<div class="tp-bars yr" role="group" aria-label="Pourboires par mois">${mks.map((k, i) => { const x = by[k], fut = y > yNow || (y === yNow && i > mNow);
    const segs = x ? ["especes", "ligne", "cb"].map((m) => (x[m] ? `<i class="m-${m}" style="height:${(x[m] / max) * 100}%"></i>` : "")).join("") : "";
    return `<button class="tp-bar${fut ? " fut" : ""}${y === yNow && i === mNow ? " now" : ""}" data-act="tpOpenM" data-v="${k}" style="--j:${i}" aria-label="${MONTHS[i]} : ${x ? tpEur(x.t) : "rien"}" ${fut ? "disabled" : ""}><span class="tp-bc">${segs}</span><em>${MONTHS[i].slice(0, 1).toUpperCase()}</em></button>`; }).join("")}</div>`;
  const diff = prev > 0 && total > 0 && y < yNow ? Math.round(((total - prev) / prev) * 100) : null;
  const hero = `<section class="tp-hero wall st" style="--i:2">
      <div class="tp-hero-t"><span class="tp-kick">${ico("tpJar")}Cagnotte ${y}</span>${y === yNow ? `<span class="tp-st live"><i></i>En cours</span>` : ""}</div>
      <div class="tp-big mono" data-to="${total}" data-k="y${y}:${total}">${tpEur(total)}</div>
      <p class="tp-sub">${rows.length ? tpPl(rows.length, "pourboire") : "Aucun pourboire cette année"}${diff != null ? ` · <b class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "+" : ""}${diff} %</b> par rapport à ${y - 1}` : prev > 0 ? ` · ${y - 1} : <b>${tpEur0(prev)}</b>` : ""}</p>
      ${L.bar}${L.keys}${bars}
    </section>`;
  /* the shares, month by month (frozen when closed) */
  const R = tpRule(); const me = tpMe(); const seeAll = boss || R.showAll; const people = {};
  const used = mks.filter((k) => by[k]);
  used.forEach((k) => { tpView(k).shares.forEach((s) => { const p = (people[s.id] ||= { id: s.id, name: s.name, amt: 0, n: 0 }); p.amt = tpR2(p.amt + s.amt); p.n++; }); });
  const mine = me && people[me.id];
  const myCard = me && (mine || !boss) ? `<section class="glass tp-me st" style="--i:3">${tpAva(me, 48)}<div class="tx"><em>Ma part en ${y}</em>${mine ? `<b class="mono" data-to="${mine.amt}">${tpEur(mine.amt)}</b><span>Sur ${tpPl(mine.n, "mois", "mois")}</span>` : `<b class="sm">Pas encore de part</b><span>Elle apparaît dès que vous avez travaillé.</span>`}</div></section>` : "";
  const months = used.slice().reverse().map((k, i) => { const F = TP.months[k]; const st = F ? (F.paid ? "versé" : "clôturé, à verser") : k === tpMk() ? "en cours" : "à clôturer";
    return `<button class="tp-j tp-ym" data-act="tpOpenM" data-v="${k}" style="--j:${Math.min(i, 12)}"><span class="tp-ji m-cb">${ico("cal")}</span><span class="tx"><b>${tpCap(MONTHS[+k.slice(5) - 1])}</b><em>${tpPl(by[k].n, "pourboire")} · ${st}</em></span><b class="mono">${tpEur(by[k].t)}</b></button>`; }).join("");
  const journal = `<section class="glass tp-jr st" style="--i:5"><div class="tp-sh"><span class="h3">Mois par mois</span></div>
      ${months || `<div class="tp-empty">${ico("tpJar")}<b>Rien en ${y}</b><span>Les pourboires apparaissent ici mois par mois.</span></div>`}
      <button class="tp-add" data-act="tpAdd">${ico("plus")}<span>Ajouter un pourboire<em>Bocal à espèces, terminal de carte…</em></span></button></section>`;
  const list = Object.values(people).sort((a, b) => b.amt - a.amt || a.name.localeCompare(b.name, "fr")); const top = list.length ? list[0].amt : 1;
  const shown = seeAll ? list : list.filter((p) => me && p.id === me.id);
  const ppl = Object.fromEntries(tpPeople().map((p) => [p.id, p]));
  const split = `<section class="glass tp-split st" style="--i:4"><div class="tp-sh"><span class="h3">${ico("tpSplit")}Par personne en ${y}</span></div>
      ${shown.length ? `<div class="tp-ppl">${shown.map((p) => `<div class="tp-p${me && p.id === me.id ? " me" : ""}">${tpAva(ppl[p.id] || { id: p.id, name: p.name, color: colorFor(p.id) }, 36)}<span class="nm"><span class="l1"><b>${esc(p.name)}</b><em>${tpPl(p.n, "mois", "mois")}</em></span><span class="tp-pbar"><i style="width:${Math.max(4, (p.amt / top) * 100)}%"></i></span></span><b class="mono">${tpEur(p.amt)}</b></div>`).join("")}</div>` : `<p class="tp-gempty">Aucune part cette année.</p>`}
      ${!seeAll && list.length > shown.length ? `<p class="tp-hid">${tpPl(list.length - shown.length, "autre personne")} dans l'équipe</p>` : ""}
      ${boss && total > 0 ? `<div class="tp-acts"><button class="btn soft" data-act="tpCsvY">${ico("download")}Export de l'année</button></div>` : ""}
    </section>`;
  return `<div class="inner wide tp">${topBar("Pourboires", { right: `<button class="btn acc sm tp-plus" data-act="tpAdd" aria-label="Ajouter un pourboire">${ico("plus")}<span>Ajouter</span></button>` })}
      ${nav}<div class="tp-cols"><div class="tp-c1">${hero}${myCard}${journal}</div><div class="tp-c2">${split}</div></div></div>`;
}

/* ───────── the screen ───────── */
VIEWS.pourboires = {
  render() {
    tpWatch();
    const today = dayKey(), yNow = new Date().getFullYear(); const per = ["jour", "mois", "annee"].includes(TP.per) ? TP.per : (TP.per = "mois");
    if (per === "jour") { if (!TP.day || TP.day > today) TP.day = today; TP.off = Math.min(0, tpOffOf(TP.day.slice(0, 7))); }
    if (per === "annee" && !(TP.yr > 1999 && TP.yr <= yNow)) TP.yr = yNow;
    const boss = tpBoss(), mk = tpMk(TP.off), cur = tpMk(), past = mk < cur;
    if (TP.rows == null) return `<div class="inner wide tp">${topBar("Pourboires")}<div class="glass pad st tp-load" style="--i:1"><span class="tp-spin"></span>Chargement de la cagnotte…</div></div>`;
    const V = tpView(mk), R = tpRule(), prev = tpMonthTotal(tpMk(TP.off - 1)), F = V.frozen;
    if (TP.day && TP.day.slice(0, 7) !== mk) TP.day = null;
    const L = tpMethLegend(V.rows, tpR2(V.rows.reduce((a, r) => a + +r.amount, 0)));
    const diff = prev > 0 && V.total > 0 ? Math.round(((V.total - prev) / prev) * 100) : null;
    const dLeft = mk === cur ? +tpRange(mk)[1].slice(8) - +today.slice(8) : 0;
    const status = F ? (F.paid ? `<span class="tp-st paid">${ico("tpPaid")}Versé${F.paidAt ? " le " + shortDate(dayKey(new Date(F.paidAt))) : ""}</span>` : `<span class="tp-st closed">${ico("tpLock")}Clôturé, à verser</span>`)
      : mk === cur ? `<span class="tp-st live"><i></i>En cours${dLeft > 0 ? ` · encore ${tpPl(dLeft, "jour")}` : ""}</span>` : past && V.total > 0 ? `<span class="tp-st todo">${ico("tpLock")}À clôturer</span>` : "";
    const nav = tpNav(per, mk, today);
    if (per === "annee") return tpYearHtml(nav, boss);
    const DR = per === "jour" ? V.rows.filter((r) => tpDayOf(r) === TP.day) : null;
    const hero = DR ? tpDayHero(DR, V.rows, mk, today) : `<section class="tp-hero wall st" style="--i:2">
      <div class="tp-hero-t"><span class="tp-kick">${ico("tpJar")}Cagnotte ${tpDe(mk)}</span>${status}</div>
      <div class="tp-big mono" data-to="${V.total}" data-k="${mk}:${V.total}">${tpEur(V.total)}</div>
      <p class="tp-sub">${V.rows.length ? `${tpPl(V.rows.length, "pourboire")}` : "Aucun pourboire pour l'instant"}${diff != null && mk === cur ? "" : diff != null ? ` · <b class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "+" : ""}${diff} %</b> par rapport à ${tpMonthName(tpMk(TP.off - 1))}` : ""}${mk === cur && prev > 0 ? ` · ${tpMonthName(tpMk(-1))} : <b>${tpEur0(prev)}</b>` : ""}${V.late > 0 ? ` · <b class="up">+${tpEur(V.late)}</b> arrivés après la clôture` : ""}</p>
      ${L.bar}${L.keys}
      ${tpBars(mk, V.rows, today)}
    </section>`;

    /* my share */
    const me = tpMe(); const mine = me ? V.shares.find((s) => s.id === me.id) : null; const myG = mine ? V.groups.find((g) => g.id === mine.group) : null;
    const meOut = me && !F && tpIsOut(me, R);
    const myCard = me && (mine || !boss) ? `<section class="glass tp-me st" style="--i:3">
      ${tpAva(me, 48)}<div class="tx"><em>Ma part ${tpDe(mk)}</em>
      ${mine ? `<b class="mono" data-to="${mine.amt}">${tpEur(mine.amt)}</b><span>${esc(myG ? myG.t : "")} · ${myG && myG.byH ? `${fmt(mine.h, 1)} h pointées` : myG ? `parts égales entre ${myG.el.length}` : ""}</span>`
        : meOut ? `<b class="sm">Hors cagnotte</b><span>Le gérant vous a sorti de la répartition.</span>` : `<b class="sm">Pas encore de part</b><span>${tpGroupOf(me, R) ? "Elle apparaît dès que vous avez travaillé ce mois-ci." : "Le gérant doit vous placer dans un groupe."}</span>`}
      ${mine ? `<span class="tp-me-st${F && F.paid ? " paid" : ""}">${F ? (F.paid ? `${ico("tpPaid")}Versé` : `${ico("tpLock")}À verser avec la paie`) : mk === cur ? "Estimation à ce jour" : "Pas encore clôturé"}</span>` : ""}</div>
    </section>` : "";

    /* split */
    const seeAll = boss || R.showAll;
    const grpCard = (g, gi) => `<div class="tp-g" style="--c:${esc(g.c)};--j:${gi}">
      <div class="tp-gh"><i class="tp-gdot"></i><b>${esc(g.t)}</b><span class="tp-gp mono">${Math.round(g.eff || 0) !== g.pct && (g.eff || F) ? `${fmt(g.eff, 0)} %` : `${g.pct} %`}</span><span class="tp-gm">${g.byH ? "selon les heures" : "parts égales"}</span><b class="tp-ga mono">${tpEur(g.amt || 0)}</b></div>
      ${g.el.length ? `<div class="tp-ppl">${(seeAll ? g.el : g.el.filter((m) => me && m.p.id === me.id)).sort((a, b) => b.amt - a.amt || a.p.name.localeCompare(b.p.name, "fr")).map((m) => `<div class="tp-p${me && m.p.id === me.id ? " me" : ""}">${tpAva(m.p, 36)}<span class="nm"><span class="l1"><b>${esc(m.p.name)}</b>${g.byH ? `<em>${fmt(m.h, 1)} h</em>` : ""}</span><span class="tp-pbar"><i style="width:${g.amt ? Math.max(4, (m.amt / g.amt) * 100) : 0}%"></i></span></span><b class="mono">${tpEur(m.amt)}</b></div>`).join("")}
        ${!seeAll && g.el.length > 1 ? `<p class="tp-hid">${tpPl(g.el.length - (g.el.some((m) => me && m.p.id === me.id) ? 1 : 0), "autre personne")} dans ce groupe</p>` : ""}</div>`
        : `<p class="tp-gempty">${g.pct > 0 && !F ? `Personne ${g.all.length ? "n'a travaillé" : "dans ce groupe"} ce mois-ci : ses ${g.pct} % vont aux autres groupes.` : "Personne dans ce groupe."}</p>`}
      ${boss && g.idle && g.idle.length ? `<p class="tp-gidle">${esc(g.idle.map((m) => firstName(m.p.name)).join(", "))} : pas d'heures ce mois-ci</p>` : ""}
    </div>`;
    const tot = V.groups.reduce((a, g) => a + (g.amt || 0), 0) || 1;
    const split = `<section class="glass tp-split st" style="--i:4">
      <div class="tp-sh"><span class="h3">${ico("tpSplit")}Répartition</span>${boss && !F ? `<button class="btn soft sm" data-act="tpRule">${ico("sliders")}Modifier</button>` : ""}</div>
      ${!R.set && boss && !F ? `<p class="tp-note">Proposition : 60 % pour la salle, 40 % pour la cuisine, à parts égales. Modifiez-la pour l'adapter à votre équipe.</p>` : ""}
      <div class="tp-sbar">${V.groups.filter((g) => g.amt > 0).map((g) => `<i style="flex:${g.amt};--c:${esc(g.c)}"><span>${esc(g.t)} ${fmt(g.eff, 0)} %</span></i>`).join("") || `<i class="none" style="flex:1"></i>`}</div>
      ${V.groups.map(grpCard).join("")}
      ${boss && V.none.length ? `<button class="tp-warn" data-act="tpRule">${ico("alert")}<span><b>${esc(V.none.map((p) => firstName(p.name)).join(", "))}</b> ${V.none.length > 1 ? "n'ont" : "n'a"} pas de groupe : touchez pour ${V.none.length > 1 ? "les" : "le"} placer.</span></button>` : ""}
      ${boss && V.out.length ? `<p class="tp-out">Hors cagnotte : ${esc(V.out.map((p) => firstName(p.name)).join(", "))}</p>` : ""}
      ${V.left > 0.009 && V.total > 0 ? `<p class="tp-out">Arrondi au centime : ${tpEur(V.left)} restent dans la cagnotte.</p>` : ""}
      ${boss ? `<div class="tp-acts">${!F && past && V.total > 0 ? `<button class="btn acc block" data-act="tpClose">${ico("tpLock")}Clôturer ${tpMonthName(mk)} et figer les parts</button>`
        : F && !F.paid ? `<button class="btn acc block" data-act="tpPaid">${ico("tpPaid")}Marquer comme versé</button>` : ""}
        ${V.total > 0 ? `<button class="btn soft" data-act="tpCsv">${ico("download")}Export pour la paie</button>` : ""}
        ${F && !F.paid && V.late > 0 ? `<button class="btn soft" data-act="tpClose">${ico("tpSplit")}Recalculer</button>` : ""}${F ? `<button class="btn ghost" data-act="tpReopen">Rouvrir</button>` : ""}</div>
        ${mk === cur && V.total > 0 ? `<p class="tp-hint">À la fin du mois, clôturez : les parts sont figées et l'équipe voit ce qui lui sera versé.</p>` : ""}` : ""}
    </section>`;

    /* journal */
    const list = (TP.day ? V.rows.filter((r) => tpDayOf(r) === TP.day) : V.rows).slice().sort((a, b) => b.at - a.at);
    const shown = TP.all || TP.day ? list : list.slice(0, 14); let lastD = "";
    const rowsH = shown.map((r, i) => {
      const d = tpDayOf(r), [t, s] = tpLabel(r), m = tpMethod(r);
      const head = d !== lastD ? `<div class="tp-jd">${d === today ? "Aujourd'hui" : d === addDays(today, -1) ? "Hier" : esc(tpCap(new Date(parseDay(d)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))}<b class="mono">${tpEur(list.filter((x) => tpDayOf(x) === d).reduce((a, x) => a + +x.amount, 0))}</b></div>` : ""; lastD = d;
      return `${head}<button class="tp-j" data-act="tpRow" data-id="${esc(r.id)}" style="--j:${Math.min(i, 12)}"><span class="tp-ji m-${m}">${ico(r.src === "qr" ? "tpPhone" : r.src === "caisse" ? "tpPos" : TP_METHODS[m][1])}</span><span class="tx"><b>${t}</b><em>${hm(r.at)} · ${s}</em></span><b class="mono">+${tpEur(r.amount)}</b></button>`;
    }).join("");
    const journal = `<section class="glass tp-jr st" style="--i:5">
      <div class="tp-sh"><span class="h3">${TP.day ? esc(tpDayLbl(TP.day)) : "Derniers pourboires"}</span>${TP.day ? `<button class="btn ghost sm" data-act="tpPer" data-v="mois">Tout le mois</button>` : ""}</div>
      ${rowsH || `<div class="tp-empty">${ico("tpJar")}<b>${TP.day ? "Rien ce jour-là" : "La cagnotte est vide"}</b><span>${TP.day ? "Restaurant fermé, ou pourboires pas encore notés." : "Touchez le pourboire en libérant une table, ou ajoutez le bocal du soir avec le +."}</span></div>`}
      ${!TP.all && !TP.day && list.length > shown.length ? `<button class="btn ghost block" data-act="tpAll">Voir les ${list.length} pourboires</button>` : ""}
      ${!F ? `<button class="tp-add" data-act="tpAdd">${ico("plus")}<span>Ajouter un pourboire<em>Bocal à espèces, terminal de carte…</em></span></button>` : ""}
    </section>`;

    /* where tips come from */
    let srcs = "";
    if (boss) {
      const cx = typeof cxActive === "function" && S.cxStat ? cxActive() : null; const cxApi = cx && cx.mode === "api" && cx.status === "connected";
      const cxP = cx && typeof cxPos === "function" ? cxPos(cx.provider || cx.id) : null;
      const qrOn = typeof CM !== "undefined" && CM.link && CM.link.charges; const qrTips = typeof cmCfg === "function" ? cmCfg().tips !== false : true;
      const row = (ic, t, s, right, go) => `<div class="tp-src">${ico(ic)}<span class="tx"><b>${t}</b><em>${s}</em></span>${right || ""}${go ? `<button class="iconbtn" data-go="${go}" aria-label="Ouvrir">${ico("chev")}</button>` : ""}</div>`;
      srcs = `<section class="glass tp-srcs st" style="--i:6"><div class="tp-sh"><span class="h3">D'où viennent les pourboires</span></div>
        ${row("tpCard", "Addition en salle", "Le serveur touche le pourboire en libérant la table.", `<span class="tp-on">Actif</span>`, VIEWS.salle ? "salle" : "")}
        ${row("tpPhone", "Menu QR", qrOn ? "Le client ajoute un pourboire en payant en ligne." : "Proposé au client dès que le paiement en ligne est activé.", qrOn ? `<button class="cm-tog tp-tg${qrTips ? " on" : ""}" data-act="tpQr" aria-pressed="${qrTips}" aria-label="Proposer un pourboire"><span class="cm-sw${qrTips ? " on" : ""}"><i></i></span></button>` : `<span class="tp-off">Paiement en ligne non activé</span>`, VIEWS.commandes ? "commandes" : "")}
        ${row("tpPos", "Caisse connectée", cxApi ? `${esc((cxP && cxP.name) || "Votre caisse")} : les pourboires arrivent seuls.` : "SumUp ou Square : les pourboires arrivent seuls.", cxApi ? `<span class="tp-on">Relié</span>` : `<span class="tp-off">Non reliée</span>`, VIEWS.caisse ? "caisse" : "")}
        ${row("tpCash", "Espèces", "Le bocal du soir, ajouté avec le +.", "", "")}
      </section>`;
    }
    return `<div class="inner wide tp">${topBar("Pourboires", { right: `${!F ? `<button class="btn acc sm tp-plus" data-act="tpAdd" aria-label="Ajouter un pourboire">${ico("plus")}<span>Ajouter</span></button>` : ""}` })}
      ${nav}<div class="tp-cols"><div class="tp-c1">${hero}${myCard}${journal}</div><div class="tp-c2">${split}${srcs}</div></div></div>`;
  },
  after(v) {
    const pk = $("#tpPick", v);
    if (pk && pk.tagName === "INPUT") pk.addEventListener("click", () => { try { pk.showPicker(); } catch (e) {} }); /* a computer opens the calendar on any click, not only on its icon */
    if (pk) pk.addEventListener("change", () => { const x = pk.value; if (!x) return; const P = TP.per;
      if (P === "jour" && /^\d{4}-\d{2}-\d{2}$/.test(x) && x <= dayKey()) TP.day = x;
      else if (P === "mois" && /^\d{4}-\d{2}$/.test(x) && x <= tpMk()) { TP.off = Math.min(0, tpOffOf(x)); TP.day = null; TP.all = false; }
      else if (P === "annee" && +x > 1999) TP.yr = +x; else return;
      SFX.tick(); buzz(4); rerender(); });
    /* the totals roll up once per month and per amount (not on every refresh) */
    const big = $(".tp-big", v); if (!big) return; const k = big.dataset.k;
    if (TP.anim === k) return; TP.anim = k;
    $$("[data-to]", v).forEach((el) => { const to = +el.dataset.to || 0; if (!to) return; const t0 = performance.now(), ms = 900; const step = (t) => { const x = Math.min(1, (t - t0) / ms); el.textContent = tpEur(to * (1 - Math.pow(1 - x, 3))); if (x < 1) requestAnimationFrame(step); else el.textContent = tpEur(to); }; requestAnimationFrame(step); });
  },
};

/* ───────── sheets ───────── */
function tpRowSheet(r) {
  const [t, s] = tpLabel(r), m = tpMethod(r), can = !TP.months[tpDayOf(r).slice(0, 7)] && (tpBoss() || r.uid === S.me.id) && r.src !== "qr" && r.src !== "caisse";
  openSheet(`<div class="tp-sh-in"><div class="tp-shh"><span class="h2">${t}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="tp-rbig"><span class="tp-ji m-${m}">${ico(TP_METHODS[m][1])}</span><b class="mono">${tpEur(r.amount)}</b></div>
    <dl class="tp-dl"><dt>Quand</dt><dd>${esc(new Date(r.at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))} à ${hm(r.at)}</dd>
      <dt>Comment</dt><dd>${TP_METHODS[m][0]}</dd><dt>D'où</dt><dd>${TP_SRC[r.src] || "Ajouté à la main"}</dd>
      ${r.waiterName && r.src === "salle" ? `<dt>Serveur</dt><dd>${esc(r.waiterName)}</dd>` : ""}${r.by && r.src === "bocal" ? `<dt>Ajouté par</dt><dd>${esc(r.by)}</dd>` : ""}${r.note && r.src !== "bocal" ? `<dt>Note</dt><dd>${esc(r.note)}</dd>` : ""}</dl>
    ${r.src === "qr" || r.src === "caisse" ? `<p class="tp-note">Arrivé tout seul ${r.src === "qr" ? "avec le paiement en ligne" : "depuis la caisse"} : il se corrige là-bas.</p>` : ""}
    ${can ? `<button class="btn danger block" data-act="tpDel" data-id="${esc(r.id)}">${ico("trash")}Retirer ce pourboire</button>` : ""}</div>`);
}
function tpAddPaint(first) {
  const A = TP.add; const today = dayKey(); const amt = num(A.v);
  const html = `<div class="tp-sh-in tp-addsh"><div class="tp-shh"><span class="h2">Ajouter un pourboire</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="tp-amt"><input class="mono" id="tpAmt" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(A.v)}" aria-label="Montant"><span>€</span></label>
    <div class="tp-quick">${[5, 10, 20, 50].map((v) => `<button class="chip${amt === v ? " on" : ""}" data-act="tpAddQ" data-v="${v}">${v} €</button>`).join("")}</div>
    <div class="field"><span class="lbl">Comment</span><div class="tp-seg">${[["especes", "Espèces"], ["cb", "Carte"]].map(([k, t]) => `<button class="${A.method === k ? "on" : ""}" data-act="tpAddM" data-v="${k}">${ico(TP_METHODS[k][1])}${t}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Quand</span><div class="tp-seg">${[[today, "Aujourd'hui"], [addDays(today, -1), "Hier"]].map(([k, t]) => `<button class="${A.day === k ? "on" : ""}" data-act="tpAddD" data-v="${k}">${t}</button>`).join("")}<label class="tp-date${A.day !== today && A.day !== addDays(today, -1) ? " on" : ""}">${ico("cal")}<span>${A.day !== today && A.day !== addDays(today, -1) ? shortDate(A.day) : "Autre jour"}</span><input type="date" id="tpAddDay" max="${today}" value="${esc(A.day)}" aria-label="Autre jour"></label></div>
      <div class="tp-seg sm">${[["midi", "Midi"], ["soir", "Soir"]].map(([k, t]) => `<button class="${A.sv === k ? "on" : ""}" data-act="tpAddS" data-v="${k}">${t}</button>`).join("")}</div></div>
    <label class="field"><span class="lbl">Note <i>(facultatif)</i></span><input class="input" id="tpAddNote" maxlength="60" placeholder="Bocal du soir" value="${esc(A.note)}"></label>
    ${TP.months[A.day.slice(0, 7)] ? `<p class="tp-warn-t">${ico("alert")}Ce mois est clôturé : rouvrez-le pour y ajouter un pourboire.</p>` : ""}
    <button class="btn acc block" data-act="tpAddOk" ${amt > 0 && amt <= 5000 && !TP.months[A.day.slice(0, 7)] ? "" : "disabled"}>${ico("check")}Ajouter ${amt > 0 ? tpEur(amt) : ""} à la cagnotte</button></div>`;
  const cur = $(".tp-addsh"); if (cur && !first) cur.outerHTML = html; else openSheet(html);
  const i = $("#tpAmt"); const fit = () => { if (i) i.style.width = Math.max(3.2, (i.value || "0,00").length * 0.62 + 0.4) + "em"; }; fit();
  if (i) { i.addEventListener("input", () => { A.v = i.value.replace(/[^\d,.]/g, ""); fit(); const b = $("[data-act=tpAddOk]"); const n2 = num(A.v); if (b) { b.disabled = !(n2 > 0 && n2 <= 5000) || !!TP.months[A.day.slice(0, 7)]; b.innerHTML = `${ico("check")}Ajouter ${n2 > 0 ? tpEur(n2) : ""} à la cagnotte`; } $$(".tp-quick .chip").forEach((c) => c.classList.toggle("on", +c.dataset.v === n2)); }); if (first) setTimeout(() => { try { i.focus(); } catch (e) {} }, 320); }
  const n = $("#tpAddNote"); if (n) n.addEventListener("input", () => { A.note = n.value; });
  const d = $("#tpAddDay"); if (d) d.addEventListener("click", () => { try { d.showPicker(); } catch (e) {} });
  if (d) d.addEventListener("change", () => { if (d.value && d.value <= today) { A.day = d.value; tpAddPaint(); } });
}

/* the rule editor (gérant) */
function tpRulePaint(first) {
  const E = TP.ed; const sum = E.groups.reduce((a, g) => a + g.pct, 0); const ppl = tpPeople();
  const R = { groups: E.groups, out: E.out, to: E.to };
  const html = `<div class="tp-sh-in tp-rulesh"><div class="tp-shh"><span class="h2">Répartition</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${E.groups.length === 2 ? `<div class="tp-pre">${TP_PRESETS.map(([a, b]) => `<button class="chip${E.groups[0].pct === a && E.groups[1].pct === b ? " on" : ""}" data-act="tpPre" data-v="${a}">${a} / ${b}</button>`).join("")}</div>` : ""}
    ${E.groups.map((g, i) => `<div class="tp-eg" style="--c:${esc(g.c)}">
      <div class="tp-egh"><i class="tp-gdot"></i><input class="input" data-tpg="${i}" maxlength="20" value="${esc(g.t)}" aria-label="Nom du groupe">
        <div class="tp-step"><button data-act="tpPct" data-id="${i}" data-v="-5" aria-label="Moins 5 %">${ico("minus")}</button><b class="mono">${g.pct} %</b><button data-act="tpPct" data-id="${i}" data-v="5" aria-label="Plus 5 %">${ico("plus")}</button></div></div>
      <div class="tp-seg sm">${[["egal", "Parts égales"], ["heures", "Selon les heures"]].map(([k, t]) => `<button class="${g.mode === k ? "on" : ""}" data-act="tpMode" data-id="${i}" data-v="${k}">${t}</button>`).join("")}</div>
      <div class="tp-posts"><span>Postes</span>${TP_POSTS.map(([k, t]) => `<button class="chip${g.posts.includes(k) ? " on" : ""}" data-act="tpPost" data-id="${i}" data-v="${k}">${t}</button>`).join("")}${E.groups.length > 1 ? `<button class="tp-gdel" data-act="tpGDel" data-id="${i}" aria-label="Retirer ce groupe">${ico("trash")}</button>` : ""}</div>
    </div>`).join("")}
    ${E.groups.length < 4 ? `<button class="btn ghost block" data-act="tpGAdd">${ico("plus")}Ajouter un groupe (bar, plonge…)</button>` : ""}
    <div class="tp-sum ${sum === 100 ? "ok" : "bad"}">${sum === 100 ? `${ico("check")}Total : 100 %` : `${ico("alert")}Total : ${sum} %, ${sum < 100 ? `il manque ${100 - sum} %` : `${sum - 100} % de trop`}`}</div>
    <div class="field"><span class="lbl">Qui reçoit sa part</span>
      <div class="tp-who">${ppl.map((p) => { const g = tpIsOut(p, R) ? "__out" : tpGroupOf(p, R); return `<div class="tp-wr">${tpAva(p, 32)}<span class="nm"><b>${esc(p.name)}</b><em>${esc(p.role || (RH_POSTS[tpPost(p)] || {}).t || "")}</em></span>
        <div class="tp-wseg">${E.groups.map((x) => `<button class="${g === x.id ? "on" : ""}" style="--c:${esc(x.c)}" data-act="tpWho" data-id="${esc(p.id)}" data-v="${esc(x.id)}">${esc(x.t)}</button>`).join("")}<button class="${g === "__out" ? "on out" : ""}" data-act="tpWho" data-id="${esc(p.id)}" data-v="__out">Non</button></div></div>`; }).join("") || `<p class="tp-note">Ajoutez votre équipe dans « Équipe & salaires ».</p>`}</div></div>
    <button class="cm-tog${E.showAll ? " on" : ""}" data-act="tpShowAll" aria-pressed="${E.showAll}"><span class="cm-tt"><b>L'équipe voit la part de chacun</b><em>${E.showAll ? "Tout le monde voit les montants de tous." : "Chacun ne voit que la cagnotte et sa propre part."}</em></span><span class="cm-sw${E.showAll ? " on" : ""}"><i></i></span></button>
    <button class="btn acc block" data-act="tpRuleOk" ${sum === 100 ? "" : "disabled"}>${ico("check")}Enregistrer la répartition</button></div>`;
  const cur = $(".tp-rulesh"); if (cur && !first) { const sc = $("#sheetBody"), y = sc ? sc.scrollTop : 0; cur.outerHTML = html; if (sc) sc.scrollTop = y; } else openSheet(html);
  $$("[data-tpg]").forEach((el) => el.addEventListener("input", () => { E.groups[+el.dataset.tpg].t = el.value.slice(0, 20); }));
}

/* ───────── the bill (js/salle.js): « Pourboire » chips before « Table réglée » ───────── */
function tpBillHtml(tab, tot) {
  const B = TP.bill && TP.bill.tab === tab.id ? TP.bill : (TP.bill = { tab: tab.id, amt: 0, method: "cb", other: false, v: "" });
  const ten = Math.round(tot * 0.1 * 2) / 2;
  const opts = [[0, "Aucun"], [2, "2 €"], [5, "5 €"], ...(ten >= 1 && ten !== 2 && ten !== 5 ? [[ten, `10 % · ${tpEur0(ten)}`]] : [])];
  return `<div class="tp-bill"><div class="tp-billh">${ico("tpJar")}<b>Pourboire pour l'équipe</b>${B.amt > 0 ? `<em class="mono">+${tpEur(B.amt)}</em>` : ""}</div>
    <div class="tp-billc">${opts.map(([v, t]) => `<button class="chip${!B.other && B.amt === v ? " on" : ""}" data-act="tpBillAmt" data-v="${v}">${t}</button>`).join("")}<button class="chip${B.other ? " on" : ""}" data-act="tpBillOther">Autre</button></div>
    ${B.other ? `<label class="tp-billo"><input class="input mono" id="tpBillV" inputmode="decimal" placeholder="0,00" value="${esc(B.v)}" aria-label="Montant du pourboire"><span>€</span></label>` : ""}
    ${B.amt > 0 ? `<div class="tp-seg sm">${[["cb", "Carte"], ["especes", "Espèces"]].map(([k, t]) => `<button class="${B.method === k ? "on" : ""}" data-act="tpBillM" data-v="${k}">${ico(TP_METHODS[k][1])}${t}</button>`).join("")}</div>` : ""}</div>`;
}
function tpBillInject() {
  try {
    const sh = $(".sl-sh.bill"); if (!sh || typeof slCurTab !== "function" || !permOk("pourboires") || (typeof abHas === "function" && !abHas("pourboires"))) return;
    const tab = slCurTab(); if (!tab) return; const tot = typeof slTotal === "function" && typeof slItemsOk === "function" ? slTotal(slItemsOk(tab)) : +tab.total || 0;
    const old = $(".tp-bill", sh); const btn = $("[data-act=slClose]", sh); const w = document.createElement("div"); w.innerHTML = tpBillHtml(tab, tot);
    if (old) old.replaceWith(w.firstElementChild); else if (btn) btn.before(w.firstElementChild);
    const i = $("#tpBillV", sh); if (i) i.addEventListener("input", () => { TP.bill.v = i.value.replace(/[^\d,.]/g, ""); const n2 = num(TP.bill.v) || 0; const had = TP.bill.amt > 0; TP.bill.amt = n2 > 0 && n2 <= 500 ? tpR2(n2) : 0; if (had !== TP.bill.amt > 0) { tpBillInject(); const j = $("#tpBillV"); if (j) { j.focus(); try { j.setSelectionRange(j.value.length, j.value.length); } catch (e) {} } } else { const em = $(".tp-billh em", sh); if (em) em.textContent = "+" + tpEur(TP.bill.amt); } });
  } catch (e) { console.warn("pourboires addition", e); }
}
if (typeof slBillPaint === "function") {
  const tpBase = slBillPaint;
  slBillPaint = function (first) { const r = tpBase.apply(this, arguments); tpWatch(); tpBillInject(); return r; }; // eslint-disable-line no-global-assign
}
if (typeof ACT.slClose === "function") {
  const tpClose0 = ACT.slClose;
  ACT.slClose = async function () {
    const tab = typeof slCurTab === "function" ? slCurTab() : null; const B = TP.bill && tab && TP.bill.tab === tab.id ? { ...TP.bill } : null;
    const r = await tpClose0.apply(this, arguments);
    if (tab && B && B.amt > 0) {
      TP.bill = null;
      const day = dayKey(), mk = day.slice(0, 7);
      if (!TP.months[mk]) {
        try {
          await safe(DB.add("tips", { at: Date.now(), day, amount: B.amt, method: B.method, src: "salle", table: String(tab.table || ""), tabId: tab.id, waiter: tab.by || S.me.id, waiterName: tab.byName || S.me.name || "", service: new Date().getHours() < 16 ? "midi" : "soir", uid: S.me.id, by: (typeof esActorName === "function" && esActorName()) || S.me.name || "" }));
          setTimeout(() => toast(`${tpEur(B.amt)} de pourboire dans la cagnotte`), 1900);
        } catch (e) {}
      }
    } else TP.bill = null;
    return r;
  };
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  tpMonth: (a, id, v) => { const n = Math.min(0, TP.off + +v); if (n === TP.off) return; TP.off = n; TP.day = null; TP.all = false; SFX.tick(); buzz(4); rerender(); },
  tpDay: (a, id, v) => { if (TP.per === "jour") { if (TP.day === v) return; TP.day = v; SFX.tick(); buzz(3); rerender(); return; } TP.day = TP.day === v ? null : v; SFX.tick(); buzz(3); refresh(true); },
  tpPer: (a, id, v) => { if (!TP_PERS.some((x) => x[0] === v)) return; const was = TP.per; if (was === v && !(v === "mois" && TP.day)) return;
    if (v === "jour") TP.day = TP.off === 0 ? dayKey() : TP.day && TP.day.slice(0, 7) === tpMk(TP.off) ? TP.day : tpRange(tpMk(TP.off))[1];
    else if (v === "mois") { if (was === "annee") TP.off = TP.yr === new Date().getFullYear() ? 0 : Math.min(0, tpOffOf(`${TP.yr}-12`)); TP.day = null; TP.all = false; }
    else TP.yr = +tpMk(TP.off).slice(0, 4);
    TP.per = v; SFX.tick(); buzz(4); rerender(); },
  tpStep: (a, id, v) => { const d = +v, P = TP.per;
    if (P === "jour") { const n = addDays(TP.day || dayKey(), d); if (n > dayKey()) return; TP.day = n; }
    else if (P === "annee") { const n = TP.yr + d; if (n > new Date().getFullYear() || n < 2000) return; TP.yr = n; }
    else { const n = Math.min(0, TP.off + d); if (n === TP.off) return; TP.off = n; TP.day = null; TP.all = false; }
    SFX.tick(); buzz(4); rerender(); },
  tpOpenM: (a, id, v) => { if (!/^\d{4}-\d{2}$/.test(v || "") || v > tpMk()) return; TP.per = "mois"; TP.off = Math.min(0, tpOffOf(v)); TP.day = null; TP.all = false; SFX.tick(); buzz(4); rerender(); },
  tpCsvY: () => {
    const y = TP.yr; const people = {}; const mks = Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`).filter((k) => tpRowsOf(k).length);
    mks.forEach((k) => tpView(k).shares.forEach((s) => { (people[s.id] ||= { name: s.name, m: {} }).m[k] = s.amt; }));
    const rows = [[`Pourboires ${y} · ${S.resto ? S.resto.name : ""}`], [], ["Employé", ...mks.map((k) => tpCap(MONTHS[+k.slice(5) - 1])), "Total (€)"],
      ...Object.values(people).map((p) => [p.name, ...mks.map((k) => fmt(p.m[k] || 0, 2)), fmt(Object.values(p.m).reduce((a, x) => a + x, 0), 2)]), [],
      ["Cagnotte", ...mks.map((k) => fmt(tpRowsOf(k).reduce((a, r) => a + +r.amount, 0), 2)), fmt(tpYearRows(y).reduce((a, r) => a + +r.amount, 0), 2)]];
    const slug = (S.resto?.name || "resto").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    SFX.tap(); saveCsv(`pourboires-${slug}-${y}.csv`, rows);
  },
  tpAll: () => { TP.all = true; SFX.tap(); refresh(true); },
  tpRow: (a, id) => { const r = (TP.rows || []).find((x) => x.id === id); if (!r) return; SFX.sheet ? SFX.sheet() : SFX.tap(); tpRowSheet(r); },
  tpDel: async (a, id) => {
    const r = (TP.rows || []).find((x) => x.id === id); if (!r) return; closeSheet(); SFX.close();
    const { id: _i, ...doc } = r; await safe(DB.del("tips", id));
    S.ui.undo = () => DB.set("tips", id, doc); toastUndo(`Pourboire de ${tpEur(r.amount)} retiré`);
    if (typeof logEvent === "function") try { logEvent("pourboires", `a retiré un pourboire de ${tpEur(r.amount)} (${tpLabel(r)[0].replace(/&[^;]+;/g, "")})`); } catch (e) {}
  },
  tpAdd: () => { SFX.sheet ? SFX.sheet() : SFX.tap(); TP.add = { v: "", method: "especes", day: TP.per === "jour" && TP.day ? TP.day : TP.per === "annee" ? (TP.yr === new Date().getFullYear() ? dayKey() : `${TP.yr}-12-31`) : TP.off === 0 ? dayKey() : tpRange(tpMk(TP.off))[1], sv: new Date().getHours() < 16 ? "midi" : "soir", note: "" }; tpAddPaint(true); },
  tpAddQ: (a, id, v) => { TP.add.v = String(v); SFX.tick(); tpAddPaint(); },
  tpAddM: (a, id, v) => { TP.add.method = v; SFX.tick(); tpAddPaint(); },
  tpAddD: (a, id, v) => { TP.add.day = v; SFX.tick(); tpAddPaint(); },
  tpAddS: (a, id, v) => { TP.add.sv = v; SFX.tick(); tpAddPaint(); },
  tpAddOk: async () => {
    const A = TP.add; const amt = tpR2(num(A.v)); if (!(amt > 0) || TP.months[A.day.slice(0, 7)]) return;
    const d = parseDay(A.day); if (A.day === dayKey()) d.setTime(Date.now()); else d.setHours(A.sv === "midi" ? 15 : 23, 0, 0, 0);
    closeSheet(); SFX.done ? SFX.done() : SFX.ok(); buzz([10, 30, 10]);
    await safe(DB.add("tips", { at: d.getTime(), day: A.day, amount: amt, method: A.method, src: "bocal", service: A.sv, note: (A.note || "").trim().slice(0, 60), uid: S.me.id, by: (typeof esActorName === "function" && esActorName()) || S.me.name || "" }));
    if (A.day.slice(0, 7) !== tpMk(TP.off)) TP.off = Math.min(0, tpOffOf(A.day.slice(0, 7)));
    if (TP.per === "jour") TP.day = A.day; else if (TP.per === "annee") TP.yr = +A.day.slice(0, 4);
    toast(`${tpEur(amt)} ajoutés à la cagnotte`); try { burst(); } catch (e) {}
    if (typeof logEvent === "function") try { logEvent("pourboires", `a ajouté ${tpEur(amt)} de pourboires (${TP_METHODS[A.method][0].toLowerCase()})`); } catch (e) {}
  },
  tpRule: () => {
    if (!tpBoss()) return; SFX.sheet ? SFX.sheet() : SFX.tap(); const R = tpRule(); const ppl = tpPeople();
    TP.ed = { groups: R.groups.map((g) => ({ ...g, posts: g.posts.slice() })), out: R.out ? R.out.slice() : ppl.filter((p) => tpOwner(p)).map((p) => p.id), to: { ...R.to }, showAll: R.showAll };
    tpRulePaint(true);
  },
  tpPre: (a, id, v) => { const E = TP.ed; E.groups[0].pct = +v; E.groups[1].pct = 100 - +v; SFX.tick(); buzz(3); tpRulePaint(); },
  tpPct: (a, id, v) => { const g = TP.ed.groups[+id]; g.pct = Math.max(0, Math.min(100, g.pct + +v)); SFX.tick(); buzz(3); tpRulePaint(); },
  tpMode: (a, id, v) => { TP.ed.groups[+id].mode = v; SFX.tick(); tpRulePaint(); },
  tpPost: (a, id, v) => { const E = TP.ed; E.groups.forEach((g, i) => { if (i !== +id) g.posts = g.posts.filter((p) => p !== v); }); const g = E.groups[+id]; g.posts = g.posts.includes(v) ? g.posts.filter((p) => p !== v) : [...g.posts, v]; SFX.tick(); tpRulePaint(); },
  tpGAdd: () => { const E = TP.ed; const used = new Set(E.groups.flatMap((g) => g.posts)); const free = TP_POSTS.find(([k]) => !used.has(k)); const id = "g" + Date.now().toString(36); E.groups.push({ id, t: free ? free[1] : "Groupe", pct: 0, posts: [], mode: "egal", c: TP_COLORS[E.groups.length % TP_COLORS.length] }); SFX.tap(); tpRulePaint(); },
  tpGDel: (a, id) => { const E = TP.ed; const g = E.groups.splice(+id, 1)[0]; if (g) { E.groups[0].pct += g.pct; Object.keys(E.to).forEach((k) => { if (E.to[k] === g.id) delete E.to[k]; }); } SFX.close(); tpRulePaint(); },
  tpWho: (a, id, v) => { const E = TP.ed; E.out = E.out.filter((x) => x !== id); delete E.to[id]; if (v === "__out") E.out.push(id); else { const p = tpPeople().find((x) => x.id === id); const R = { groups: E.groups, out: [], to: {} }; if (!p || tpGroupOf(p, R) !== v) E.to[id] = v; } SFX.tick(); tpRulePaint(); },
  tpShowAll: () => { TP.ed.showAll = !TP.ed.showAll; SFX.tick(); tpRulePaint(); },
  tpRuleOk: async () => {
    const E = TP.ed; if (E.groups.reduce((a, g) => a + g.pct, 0) !== 100) return;
    $$("[data-tpg]").forEach((el) => { E.groups[+el.dataset.tpg].t = (el.value || "").trim().slice(0, 20) || "Groupe"; });
    closeSheet(); SFX.done ? SFX.done() : SFX.ok();
    await safe(DB.set("tipCfg", "rule", { groups: E.groups.map(({ id, t, pct, posts, mode, c }) => ({ id, t, pct, posts, mode, c })), out: E.out, to: E.to, showAll: !!E.showAll, at: Date.now(), by: S.me.id }));
    toast("Répartition enregistrée");
    if (typeof logEvent === "function") try { logEvent("pourboires", `a modifié la répartition des pourboires (${E.groups.map((g) => `${g.t} ${g.pct} %`).join(", ")})`); } catch (e) {}
  },
  tpClose: async () => {
    if (!tpBoss()) return; const mk = tpMk(TP.off); const c = tpCalc(mk); if (!(c.total > 0)) return;
    SFX.done ? SFX.done() : SFX.ok(); buzz([10, 40, 10]);
    await safe(DB.set("tipMonths", mk, { mk, total: c.total, n: c.rows.length, groups: c.groups.map((g) => ({ id: g.id, t: g.t, pct: g.pct, eff: g.eff, amt: g.amt, mode: g.mode, c: g.c })), shares: c.shares, closedAt: Date.now(), closedBy: S.me.id, closedByName: S.me.name || "", paid: false }));
    toast(`${tpMonthLbl(mk).replace(/^./, (x) => x.toUpperCase())} clôturé : ${tpEur(c.total)} répartis`); try { burst(); } catch (e) {}
    if (typeof logEvent === "function") try { logEvent("pourboires", `a clôturé les pourboires ${tpDe(mk)} (${tpEur(c.total)})`); } catch (e) {}
  },
  tpPaid: async () => { if (!tpBoss()) return; const mk = tpMk(TP.off); if (!TP.months[mk]) return; SFX.done ? SFX.done() : SFX.ok(); await safe(DB.update("tipMonths", mk, { paid: true, paidAt: Date.now(), paidBy: S.me.id })); S.ui.undo = () => DB.update("tipMonths", mk, { paid: false, paidAt: null, paidBy: null }); toastUndo("Pourboires marqués comme versés"); try { burst(); } catch (e) {} },
  tpReopen: async () => { if (!tpBoss()) return; const mk = tpMk(TP.off); const f = TP.months[mk]; if (!f) return; SFX.tap(); const { id: _i, ...doc } = f; await safe(DB.del("tipMonths", mk)); S.ui.undo = () => DB.set("tipMonths", mk, doc); toastUndo(`${tpMonthLbl(mk).replace(/^./, (x) => x.toUpperCase())} rouvert`); },
  tpCsv: () => {
    const mk = tpMk(TP.off), V = tpView(mk); const G = Object.fromEntries(V.groups.map((g) => [g.id, g]));
    const rows = [[`Pourboires ${tpDe(mk)} · ${S.resto ? S.resto.name : ""}`], [V.frozen ? `Clôturé le ${shortDate(dayKey(new Date(V.frozen.closedAt)))}${V.frozen.paid ? ", versé" : ""}` : "Mois non clôturé : estimation"], [],
      ["Employé", "Groupe", "Répartition", "Heures", "Part (€)"], ...V.shares.map((s) => [s.name, (G[s.group] || {}).t || "", (G[s.group] || {}).mode === "heures" ? "selon les heures" : "parts égales", fmt(s.h || 0, 1), fmt(s.amt, 2)]), [],
      ["Groupe", "Pourcentage", "Montant (€)"], ...V.groups.map((g) => [g.t, fmt(g.eff, 1) + " %", fmt(g.amt || 0, 2)]), [], ["Total de la cagnotte", "", fmt(V.total, 2)],
      ["Par carte", "", fmt(tpMethLegend(V.rows, V.total).s.cb, 2)], ["En ligne", "", fmt(tpMethLegend(V.rows, V.total).s.ligne, 2)], ["En espèces", "", fmt(tpMethLegend(V.rows, V.total).s.especes, 2)], [], ["Montants à reporter sur la fiche de paie de chacun."]];
    const slug = (S.resto?.name || "resto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    SFX.tap(); saveCsv(`pourboires-${slug}-${mk}.csv`, rows);
  },
  tpQr: async (el) => { if (typeof cmSaveCfg !== "function") return; const on = !(cmCfg().tips !== false); SFX.tick(); el.classList.toggle("on", on); $(".cm-sw", el)?.classList.toggle("on", on); await safe(cmSaveCfg({ tips: on })); toast(on ? "Le menu QR propose un pourboire" : "Plus de pourboire proposé sur le menu QR"); },
  tpBillAmt: (a, id, v) => { TP.bill.amt = +v; TP.bill.other = false; SFX.tick(); buzz(3); tpBillInject(); },
  tpBillOther: () => { TP.bill.other = true; TP.bill.amt = num(TP.bill.v) > 0 ? tpR2(num(TP.bill.v)) : 0; SFX.tick(); tpBillInject(); setTimeout(() => { const i = $("#tpBillV"); if (i) i.focus(); }, 40); },
  tpBillM: (a, id, v) => { TP.bill.method = v; SFX.tick(); tpBillInject(); },
});
