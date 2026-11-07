/* Growth Gusto — area: défis d'équipe (route « defis »). Prefix « df ».
   Le gérant ou le chef lance un défi en trois gestes : « 20 desserts ce soir », « 1 500 € de chiffre d'affaires aujourd'hui »,
   « Ticket moyen de 38 € ce week-end », « 25 bons envoyés en moins de 15 min ». La progression monte toute seule, en direct, à
   partir des commandes (prise de commande en salle et menu QR, js/salle.js + js/commande.js) : personne n'a rien à compter.
   Un classement sympa montre qui a vendu quoi, un « +1 » saute à chaque vente, et quand l'objectif tombe, tous les écrans
   de l'équipe fêtent la victoire (trophée, confettis, fanfare) et le défi rejoint la vitrine des trophées.
   Partout : écran Défis (téléphone, tablette, ordinateur, grand écran pour la télé du passe), carte sur l'Accueil, bandeau sur la
   prise de commande, l'écran cuisine et le coup de feu.
   Data (restos/{rid}/…, members read/write, generic rule):
     defis/{id} { kind:"vente"|"ca"|"panier"|"rapide", what:{ t:"cat"|"dish"|"all", v, label }, goal, lim? (rapide: minutes),
                  period:"midi"|"soir"|"jour"|"semaine"|"weekend", start, end, reward?, title, at, uid, by,
                  wonAt?, final?:{ v, won, rows:[{ k, n, c, v }] } (snapshot written once the window is over), stoppedAt? }
   Ventes comptées : les articles envoyés en cuisine (pas les annulés, pas les offerts) entre start et end, au nom du serveur
   qui a ouvert la table ; les commandes du menu QR comptent pour l'équipe sous « Menu QR ». « rapide » = bons de cuisine
   passés de « envoyé » à « prêt » en moins de lim minutes.
   Exposed: dfLive() → défis en cours, dfStats(d) → { v, goal, pct, rows, feed }, dfHomeCard(). */
"use strict";

TAB_OF.defis = "more";
(function dfNav() {
  if (NAV.some((n) => n[0] === "defis")) return;
  const i = NAV.findIndex((n) => n[0] === "consignes"), j = i >= 0 ? i : NAV.findIndex((n) => n[0] === "pointeuse");
  NAV.splice(j >= 0 ? j + (i >= 0 ? 1 : 0) : NAV.length, 0, ["defis", "dfCup", "Défis d'équipe"]);
})();
try { if (typeof AB_GATE !== "undefined") AB_GATE.defis = ["pro", "Défis d'équipe"]; } catch (e) {}
try { if (typeof BIG_ROUTES !== "undefined" && !BIG_ROUTES.includes("defis")) BIG_ROUTES.push("defis"); } catch (e) {}
Object.assign(IC, {
  dfCup: ["f:M7 3.5h10v5.5a5 5 0 0 1-10 0z", "M7 3.5h10v5.5a5 5 0 0 1-10 0z", "M7 5.5H4.5v1.5A3 3 0 0 0 7.4 10", "M17 5.5h2.5v1.5a3 3 0 0 1-2.9 3", "M12 14v3.5", "M8.5 20.5h7", "M9.5 17.5h5l.6 3h-6.2z"],
  dfFlag: ["M5 21V4", "f:M5 4.5h12.5l-2.5 4 2.5 4H5z", "M5 4.5h12.5l-2.5 4 2.5 4H5"],
  dfBolt: ["f:M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z", "M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"],
  dfCoin: ["c:12,12,8.5", "f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M14.8 9.2A3.3 3.3 0 0 0 12 7.8c-1.7 0-2.9 1-2.9 2.1 0 2.8 5.9 1.4 5.9 4.2 0 1.2-1.3 2.1-3 2.1a3.4 3.4 0 0 1-2.9-1.5", "M12 6.3v1.5", "M12 16.2v1.5"],
  dfBasket: ["M4 9.5h16l-1.6 9a1.5 1.5 0 0 1-1.5 1.2H7.1a1.5 1.5 0 0 1-1.5-1.2z", "f:M4 9.5h16l-1.6 9a1.5 1.5 0 0 1-1.5 1.2H7.1a1.5 1.5 0 0 1-1.5-1.2z", "M8.5 9.5 11 4", "M15.5 9.5 13 4", "M9.5 13v3.5", "M14.5 13v3.5"],
  dfTimer: ["c:12,13.5,7.5", "f:M12 6a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z", "M12 13.5V10", "M10 2.5h4", "M12 2.5V6", "M18.5 6.5l1.3-1.3"],
  dfGift: ["r:3.5,8.5,17,4,1.2", "M12 8.5v12.5", "M19 12.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7", "M7.8 8.5a2.4 2.4 0 0 1 0-4.8C10.2 3.7 12 8.5 12 8.5s1.8-4.8 4.2-4.8a2.4 2.4 0 0 1 0 4.8", "f:M5 12.5h14v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z"],
  dfPlus: ["M12 5v14", "M5 12h14"],
  dfSpark: ["f:M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z", "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z", "M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],
  dfStop: ["c:12,12,8.5", "r:9,9,6,6,1"],
  dfMega: ["M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2L13 19.5V4.5L7 8.5H5A1.5 1.5 0 0 0 3.5 10z", "M16.5 9a4 4 0 0 1 0 6"],
});

/* ───────── vocabulary ───────── */
/* [id, label in the picker, plural for the title, singular] */
const DF_CATS = [["dessert", "Desserts", "desserts", "dessert"], ["entree", "Entrées", "entrées", "entrée"], ["plat", "Plats", "plats", "plat"], ["boisson", "Boissons", "boissons", "boisson"], ["partage", "À partager", "assiettes à partager", "assiette à partager"], ["all", "Tout", "articles", "article"]];
/* [kind, icon, tile title, one line, colour class] */
const DF_KINDS = [
  ["vente", "dfFlag", "Vendre des…", "Desserts, cafés, un plat précis", "k-v"],
  ["ca", "dfCoin", "Chiffre d'affaires", "Atteindre un montant", "k-c"],
  ["panier", "dfBasket", "Ticket moyen", "Par couvert, en salle", "k-p"],
  ["rapide", "dfTimer", "Cuisine rapide", "Des bons prêts à temps", "k-r"],
];
const DF_PERIODS = [["midi", "Ce midi", "ce midi"], ["soir", "Ce soir", "ce soir"], ["jour", "Aujourd'hui", "aujourd'hui"], ["weekend", "Ce week-end", "ce week-end"], ["semaine", "Cette semaine", "cette semaine"]];
const DF_REWARDS = ["Un verre offert après le service", "Le repas d'équipe offert", "Une prime de 20 € chacun", "Le choix de la musique demain", "Une bouteille pour l'équipe"];
const DF_QR = { k: "qr", n: "Menu QR", c: "#0E8C9E" };
const DF = { rid: null, list: null, demo: null, prev: {}, shownWin: {}, ms: {}, tick: null, F: null, lastTop: {}, celebrating: false, bump: {} };
const dfLS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; };
const dfEur = (v, dec) => (Math.round((+v || 0) * (dec ? 100 : 1)) / (dec ? 100 : 1)).toLocaleString("fr-FR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }) + " €";
const dfOn = () => typeof abHas !== "function" || abHas("defis");
const dfCanEdit = () => DB.mode !== "db" || myRole() === "gerant" || myRole() === "chef";
const dfCat = (id) => DF_CATS.find((c) => c[0] === id) || DF_CATS[5];
const dfPl = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/* ───────── time windows ───────── */
function dfSvcHours(id) {
  /* the Réservations services when the restaurant set them, else 11:00–15:30 and 18:00–23:59 */
  try {
    const cfg = typeof rsCfg === "function" ? rsCfg() : null; const s = cfg && (cfg.services || []).find((x) => x.id === id);
    if (s && s.from && s.to) { const m = (t) => { const r = /^(\d{1,2}):(\d{2})/.exec(t); return r ? +r[1] * 60 + +r[2] : 0; }; return [Math.max(0, m(s.from) - 45), Math.min(24 * 60 - 1, m(s.to) + 120)]; }
  } catch (e) {}
  return id === "midi" ? [11 * 60, 15 * 60 + 30] : [18 * 60, 24 * 60 - 1];
}
function dfWindow(period, now = Date.now()) {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime(), D = 864e5;
  if (period === "midi" || period === "soir") { const [a, b] = dfSvcHours(period); return { start: t0 + a * 6e4, end: t0 + b * 6e4 + 59e3 }; }
  if (period === "semaine") { const wd = (d0.getDay() + 6) % 7; return { start: t0 - wd * D, end: t0 + (7 - wd) * D - 1 }; }
  if (period === "weekend") { const wd = (d0.getDay() + 6) % 7; const fri = t0 + (4 - wd) * D; const s = wd >= 4 ? t0 - (wd - 4) * D : fri; return { start: s + 18 * 36e5, end: s + 3 * D - 1 }; }
  return { start: t0, end: t0 + D - 1 };
}
const dfPeriodOk = (p, now = Date.now()) => dfWindow(p, now).end > now;
const dfSuffix = (d) => { const p = DF_PERIODS.find((x) => x[0] === d.period); if (!p) return ""; const day = dayKey(new Date(d.start)); return day === dayKey() || d.period === "semaine" || d.period === "weekend" ? p[2] : `le ${dfDay(d.start)}`; };
function dfTitle(d) {
  const sfx = dfSuffix(d), g = +d.goal || 0;
  if (d.kind === "ca") return `${dfEur(g)} de chiffre d'affaires ${sfx}`;
  if (d.kind === "panier") return `Ticket moyen de ${dfEur(g)} ${sfx}`;
  if (d.kind === "rapide") return `${g} bons prêts en moins de ${+d.lim || 15} min ${sfx}`;
  const w = d.what || {};
  if (w.t === "dish") return `${g} × ${w.label || "plat"} ${sfx}`;
  const c = dfCat(w.v); return `${g} ${g > 1 ? c[2] : c[3]} ${sfx}`;
}
function dfState(d, now = Date.now()) {
  if (d.stoppedAt) return "fini";
  if (now < d.start) return "avenir";
  if (now > d.end) return "fini";
  return "live";
}
const dfDay = (ts) => { const k = dayKey(new Date(ts)); if (k === dayKey()) return "aujourd'hui"; if (k === addDays(dayKey(), -1)) return "hier"; try { return new Date(ts).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""); } catch (e) { return shortDate(k); } };
const dfLeft = (d) => { const m = Math.max(0, Math.round((d.end - Date.now()) / 6e4)); return m >= 1440 ? `${Math.round(m / 1440)} j` : m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m} min`; };

/* ───────── data ───────── */
function dfWatch() {
  if (!S.rid || !S.ready) return;
  if (DF.rid === S.rid) return; DF.rid = S.rid; DF.list = null; DF.prev = {}; DF.demo = null;
  const rid = S.rid;
  if (DB.mode === "demo") dfSeedDemo();
  DB.watch("defis", { order: "at", dir: "desc", limit: 120 }, (rows) => {
    if (S.rid !== rid) return; const sig = (L) => (L || []).map((d) => d.id + (d.stoppedAt ? "s" : "") + (d.final ? "f" : "")).join(); const moved = sig(DF.list) !== sig(rows);
    DF.list = rows; dfFeeds(); onData();
    /* the Défis screen updates itself in place (live:false): redraw it only when a challenge was added, stopped or removed */
    if (moved && S.route === "defis" && !$("#sheet").classList.contains("open")) setTimeout(() => { if (S.route === "defis") rerender(); }, 80);
  });
}
/* the sales feeds are only opened when a challenge needs them */
function dfFeeds() {
  if (!(DF.list || []).some((d) => dfState(d) === "live") || !dfOn()) return;
  try { if (typeof slWatch === "function") slWatch(); else if (typeof cmWatch === "function") cmWatch(); } catch (e) {}
}
window.addEventListener("gg:ready", () => setTimeout(() => { try { dfWatch(); dfTickStart(); } catch (e) {} }, 900));
const dfAll = () => { dfWatch(); return DF.list || []; };
const dfLive = () => dfAll().filter((d) => dfState(d) === "live").sort((a, b) => a.end - b.end);
const dfSoon = () => dfAll().filter((d) => dfState(d) === "avenir").sort((a, b) => a.start - b.start);
const dfDone = () => dfAll().filter((d) => dfState(d) === "fini").sort((a, b) => (b.stoppedAt || b.end) - (a.stoppedAt || a.end));

function dfPerson(id, name) {
  const m = (S.members || []).find((x) => x.id === id);
  const n = (m && m.name) || name || "Équipe";
  return { k: id || n, n: firstName(n) || n, full: n, c: (m && m.color) || colorFor(id || n) };
}
const dfNoteCat = (id) => { const n = id && (S.notes || []).find((x) => x.id === id); return n ? n.carteCat || "plat" : ""; };
const dfMatch = (d, x) => {
  const w = d.what || {};
  if (w.t === "dish") return x.id && x.id === w.v;
  if (!w.v || w.v === "all") return true;
  const cat = x.cat || dfNoteCat(x.id) || "";
  return cat === w.v;
};
/* every sale line in the window: { p (person), name, q, amount, at, covers?, tab? } */
function dfLines(d) {
  const out = [], a = d.start, b = d.stoppedAt || d.end;
  const tabs = (typeof SL !== "undefined" && SL.tabs) || [];
  tabs.forEach((t) => {
    (t.items || []).forEach((x) => {
      if (x.off || x.free || !x.sent) return; const at = x.sentAt || x.at || t.openedAt || 0;
      if (at < a || at > b) return;
      out.push({ p: dfPerson(t.by, t.byName), id: x.id, cat: x.cat, name: x.name, q: +x.q || 0, amount: ((+x.price || 0) + (x.extras || []).reduce((s, e) => s + (+e.p || 0), 0)) * (+x.q || 0), at, tab: t.id });
    });
  });
  const orders = (typeof CM !== "undefined" && CM.orders) || [];
  orders.forEach((o) => {
    if (o.src === "salle" || o.status === "annulee" || o.status === "attente") return; const at = o.at || 0;
    if (at < a || at > b) return;
    (o.items || []).forEach((x) => { if (x.off) return; out.push({ p: DF_QR, id: x.id, cat: x.cat, name: x.name, q: +x.q || 0, amount: (+x.price || 0) * (+x.q || 0), at, qr: o.id }); });
  });
  if (DF.demo) DF.demo.sales.forEach((s) => { if (s.at >= a && s.at <= b) out.push(s); });
  return out;
}
function dfTabsIn(d) {
  const a = d.start, b = d.stoppedAt || d.end, L = [];
  ((typeof SL !== "undefined" && SL.tabs) || []).forEach((t) => { const at = t.openedAt || 0; if (at < a || at > b || !(+t.covers > 0)) return; const tot = (t.items || []).filter((x) => !x.off && !x.free && x.sent).reduce((s, x) => s + ((+x.price || 0) + (x.extras || []).reduce((q, e) => q + (+e.p || 0), 0)) * (+x.q || 0), 0); if (tot > 0) L.push({ p: dfPerson(t.by, t.byName), covers: +t.covers, total: tot, at }); });
  if (DF.demo) DF.demo.tabs.forEach((t) => { if (t.at >= a && t.at <= b) L.push(t); });
  return L;
}
function dfFast(d) {
  const a = d.start, b = d.stoppedAt || d.end, lim = (+d.lim || 15) * 6e4, L = [];
  ((typeof CM !== "undefined" && CM.orders) || []).forEach((o) => { if (o.station === "bar" || !o.readyAt) return; const t0 = o.firedAt || o.at; if (!t0 || o.readyAt < a || o.readyAt > b) return; L.push({ ok: o.readyAt - t0 <= lim, min: (o.readyAt - t0) / 6e4, at: o.readyAt, name: o.src === "salle" ? `Table ${o.table}` : "Menu QR" }); });
  if (DF.demo) DF.demo.fast.forEach((f) => { if (f.at >= a && f.at <= b) L.push({ ...f, ok: f.min <= (+d.lim || 15) }); });
  return L;
}
/* the score: v (current value), pct, rows (leaderboard, best first), feed (latest moves) */
function dfStats(d) {
  if (d.final && dfState(d) === "fini") return { v: d.final.v, goal: +d.goal, pct: Math.min(1, d.final.v / (+d.goal || 1)), rows: d.final.rows || [], feed: [], won: !!d.final.won, n: d.final.n || 0 };
  const goal = +d.goal || 1, by = new Map(), add = (p, v, extra) => { const r = by.get(p.k) || { k: p.k, n: p.n, c: p.c, v: 0, cv: 0, tot: 0 }; r.v += v; if (extra) { r.cv += extra.covers; r.tot += extra.total; } by.set(p.k, r); };
  let v = 0, feed = [], n = 0;
  if (d.kind === "vente" || d.kind === "ca") {
    const L = dfLines(d).filter((x) => d.kind === "ca" || dfMatch(d, x));
    L.forEach((x) => { const val = d.kind === "ca" ? x.amount : x.q; v += val; add(x.p, val); });
    feed = L.slice().sort((a, b) => b.at - a.at).slice(0, 6).map((x) => ({ p: x.p, t: d.kind === "ca" ? `${x.q} × ${x.name}` : `${x.q > 1 ? x.q + " × " : ""}${x.name}`, v: d.kind === "ca" ? `+${dfEur(x.amount)}` : `+${x.q}`, at: x.at }));
    n = L.length;
  } else if (d.kind === "panier") {
    const T = dfTabsIn(d); let cv = 0, tot = 0; T.forEach((t) => { cv += t.covers; tot += t.total; add(t.p, 0, t); });
    v = cv ? Math.round((tot / cv) * 100) / 100 : 0; by.forEach((r) => (r.v = r.cv ? Math.round((r.tot / r.cv) * 100) / 100 : 0)); n = cv;
    feed = T.slice().sort((a, b) => b.at - a.at).slice(0, 6).map((t) => ({ p: t.p, t: `${dfPl(t.covers, "couvert", "couverts")} · ${dfEur(t.total)}`, v: dfEur(t.total / t.covers, true), at: t.at }));
  } else if (d.kind === "rapide") {
    const F = dfFast(d); v = F.filter((f) => f.ok).length; n = F.length;
    feed = F.slice().sort((a, b) => b.at - a.at).slice(0, 6).map((f) => ({ p: { n: f.name, c: f.ok ? "#078A5E" : "#B86C00", k: f.name, ic: f.ok ? "dfBolt" : "dfTimer" }, t: `prêt en ${Math.max(1, Math.round(f.min))} min`, v: f.ok ? "+1" : "trop long", at: f.at, late: !f.ok }));
  }
  if (d.kind === "ca") v = Math.round(v * 100) / 100;
  const rows = [...by.values()].filter((r) => r.v > 0 || d.kind === "panier").sort((a, b) => b.v - a.v);
  const won = d.kind === "panier" ? v >= goal && n >= 6 : v >= goal;
  return { v, goal, pct: Math.min(1, v / goal), rows, feed, won, n };
}
const dfVal = (d, v) => (d.kind === "ca" ? dfEur(v) : d.kind === "panier" ? dfEur(v, true) : String(Math.round(v)));
const dfUnit = (d) => (d.kind === "ca" ? "" : d.kind === "panier" ? "par couvert" : d.kind === "rapide" ? "bons à temps" : (() => { const w = d.what || {}; return w.t === "dish" ? w.label || "" : dfCat(w.v)[2]; })());
const dfLeftT = (d, st) => {
  if (st.won) return d.kind === "panier" ? "Objectif tenu, gardez le cap" : "Objectif atteint !";
  const r = st.goal - st.v;
  if (d.kind === "ca") return `Plus que ${dfEur(r)}`;
  if (d.kind === "panier") return st.n ? `Encore ${dfEur(r, true)} par couvert` : "En attente des premières tables";
  return `Plus que ${Math.ceil(r)}`;
};

/* ───────── demo: a real evening with a team racing for the desserts ───────── */
function dfSeedDemo() {
  const p = `restos/${S.rid}/defis`; if (DB.local[p]) { dfDemoSales(); return; }
  const now = Date.now(), D = 864e5, H = 36e5, d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime();
  const mid = new Date().getHours() < 16, per = mid ? "midi" : "soir";
  const L = {};
  const add = (id, d) => { L[id] = { at: d.start - 3 * H, uid: "demo-camille", by: "Camille Laurent", ...d }; L[id].title = dfTitle(L[id]); };
  add("dfd1", { kind: "vente", what: { t: "cat", v: "dessert", label: "Desserts" }, goal: 20, period: per, start: now - 95 * 6e4, end: now + 80 * 6e4, reward: "Le repas d'équipe offert dimanche" });
  add("dfd2", { kind: "ca", what: { t: "all", v: "all" }, goal: 2800, period: "jour", start: t0, end: t0 + D - 1, reward: "" });
  add("dfd3", { kind: "rapide", what: { t: "all", v: "all" }, goal: 25, lim: 15, period: per, start: now - 95 * 6e4, end: now + 80 * 6e4, reward: "Les frites du staff, c'est le chef qui régale", uid: "demo-thomas", by: "Thomas Girard" });
  const ws = dfWindow("weekend", now), s4 = ws.start > now ? ws.start : now + 2 * H;
  add("dfd4", { kind: "panier", what: { t: "all", v: "all" }, goal: 38, period: "weekend", start: s4, end: Math.max(ws.end, s4 + 2 * D), reward: "Une prime de 20 € chacun" });
  const past = (days, d) => { const s = t0 - days * D + 18 * H; return { period: "soir", start: s, end: s + 6 * H - 1, ...d }; };
  add("dfd5", past(2, { kind: "vente", what: { t: "cat", v: "boisson", label: "Boissons" }, goal: 60, reward: "Un verre offert après le service", final: { v: 67, won: true, n: 41, rows: [{ k: "demo-sarah", n: "Sarah", c: "#1F7AE0", v: 29 }, { k: "demo-camille", n: "Camille", c: "#4A1FE6", v: 22 }, { k: "demo-hugo", n: "Hugo", c: "#0E8C9E", v: 10 }, { ...DF_QR, v: 6 }] }, wonAt: t0 - 2 * D + 21.6 * H }));
  add("dfd6", past(4, { kind: "vente", what: { t: "cat", v: "dessert", label: "Desserts" }, goal: 18, reward: "", final: { v: 14, won: false, n: 12, rows: [{ k: "demo-camille", n: "Camille", c: "#4A1FE6", v: 7 }, { k: "demo-sarah", n: "Sarah", c: "#1F7AE0", v: 5 }, { ...DF_QR, v: 2 }] } }));
  add("dfd7", past(6, { kind: "ca", what: { t: "all", v: "all" }, goal: 3000, period: "jour", reward: "Le choix de la musique demain", final: { v: 3184, won: true, n: 212, rows: [{ k: "demo-sarah", n: "Sarah", c: "#1F7AE0", v: 1420 }, { k: "demo-camille", n: "Camille", c: "#4A1FE6", v: 1236 }, { ...DF_QR, v: 528 }] }, wonAt: t0 - 6 * D + 22 * H }));
  add("dfd8", past(9, { kind: "rapide", lim: 12, what: { t: "all", v: "all" }, goal: 30, reward: "", final: { v: 34, won: true, n: 39, rows: [] }, wonAt: t0 - 9 * D + 21 * H, uid: "demo-thomas", by: "Thomas Girard" }));
  Object.values(L).forEach((d) => (d.title = dfTitle(d)));
  DB.local[p] = L;
  dfDemoSales();
}
function dfDemoSales() {
  if (DF.demo) return;
  const now = Date.now(), dishes = (typeof slDishes === "function" ? slDishes() : (S.notes || []).filter((n) => n.carte)).filter((n) => num(n.price) > 0);
  const pick = (cat, i, fb) => { const L = dishes.filter((n) => (n.carteCat || "plat") === cat); const n = L.length ? L[i % L.length] : null; return n ? { id: n.id, name: n.title, price: num(n.price), cat } : { id: "", name: fb[0], price: fb[1], cat }; };
  const ds = [pick("dessert", 0, ["Mousse au chocolat", 7]), pick("dessert", 1, ["Tarte Tatin", 8]), pick("dessert", 2, ["Café gourmand", 8.5])];
  const other = [pick("plat", 0, ["Bœuf bourguignon", 22]), pick("plat", 1, ["Filet de bar", 24]), pick("entree", 0, ["Velouté de potimarron", 8.5]), pick("boisson", 0, ["Verre de côtes-du-rhône", 6])];
  const P = { sarah: dfPerson("demo-sarah", "Sarah Lemoine"), cam: dfPerson("demo-camille", "Camille Laurent"), hugo: dfPerson("demo-hugo", "Hugo Martin") };
  const sales = [], tabs = [], fast = [];
  const sale = (p, d, q, ago) => sales.push({ p, id: d.id, cat: d.cat, name: d.name, q, amount: d.price * q, at: now - ago * 6e4, demo: 1 });
  /* a dozen desserts already (with the tables of the demo floor), a tight race */
  [[P.cam, 1, 1, 80], [P.sarah, 2, 1, 71], [P.hugo, 0, 2, 64], [DF_QR, 1, 1, 58], [P.cam, 2, 2, 49], [P.sarah, 1, 1, 33], [P.hugo, 2, 1, 15]].forEach(([p, i, q, ago]) => sale(p, ds[i], q, ago));
  /* the rest of the day's orders, for the turnover challenge */
  for (let i = 0; i < 46; i++) sale([P.sarah, P.cam, P.hugo, DF_QR][i % 4], other[i % other.length], 1 + (i % 3 === 0 ? 1 : 0), 20 + i * 9);
  [[P.sarah, 4, 151], [P.cam, 2, 63], [P.hugo, 6, 214], [P.sarah, 2, 77], [P.cam, 3, 118], [P.sarah, 5, 196]].forEach(([p, cv, tot], i) => tabs.push({ p, covers: cv, total: tot, at: now - (30 + i * 12) * 6e4 }));
  for (let i = 0; i < 21; i++) fast.push({ name: `Table ${[3, 7, 12, 5, 21, 9, 14][i % 7]}`, min: [9, 11, 13, 8, 17, 12, 10][i % 7], at: now - (4 + i * 4) * 6e4 });
  DF.demo = { sales, tabs, fast, ds, other, P, n: 0 };
}
/* demo: the team keeps selling while the visitor watches (one sale every ~12 s, a ready ticket every ~20 s) */
function dfDemoTick() {
  const X = DF.demo; if (!X || DB.mode !== "demo") return;
  X.n++;
  const who = [X.P.sarah, X.P.cam, X.P.sarah, X.P.hugo, DF_QR, X.P.cam][X.n % 6];
  if (X.n % 2 === 1) { const d = X.ds[X.n % X.ds.length], q = X.n % 4 === 1 ? 2 : 1; X.sales.push({ p: who, id: d.id, cat: d.cat, name: d.name, q, amount: d.price * q, at: Date.now(), demo: 1 }); }
  else { const d = X.other[X.n % X.other.length]; X.sales.push({ p: who, id: d.id, cat: d.cat, name: d.name, q: 1, amount: d.price, at: Date.now(), demo: 1 }); }
  if (X.n % 5 === 0) X.fast.push({ name: `Table ${[4, 8, 11, 2][X.n % 4]}`, min: X.n % 10 === 0 ? 16 : 9 + (X.n % 4), at: Date.now() });
}

/* ───────── live loop: progress, milestones, the celebration ───────── */
function dfTickStart() {
  clearInterval(DF.tick); let k = 0;
  DF.tick = setInterval(() => { k++; try { if (DB.mode === "demo" && k % 5 === 0) dfDemoTick(); dfPulse(); } catch (e) { console.warn("defis", e); } }, 2000);
}
function dfPulse() {
  if (!S.rid || !DF.list || !dfOn()) return;
  const now = Date.now(); let changed = false;
  DF.list.forEach((d) => {
    const st0 = dfState(d, now);
    /* the window is over: write the final snapshot once (the person who launched it, or a gérant) */
    if (st0 === "fini" && !d.final && (d.uid === S.me.id || myRole() === "gerant" || DB.mode !== "db")) { const s = dfStats(d); d.final = dfFinal(s); try { Promise.resolve(DB.update("defis", d.id, { final: d.final })).catch(() => {}); } catch (e) {} }
    if (st0 !== "live") return;
    const s = dfStats(d), p = DF.prev[d.id];
    DF.prev[d.id] = { v: s.v, top: s.rows[0] && s.rows[0].k, at: now };
    if (!p) { if (s.won && d.kind !== "panier" && !dfSeen(d)) dfWin(d, s); return; }
    if (s.v !== p.v) { changed = true; DF.bump[d.id] = { by: s.v - p.v, at: now, who: s.feed[0] && s.feed[0].p }; }
    if (s.v > p.v) dfMilestone(d, s, p.v);
    if (s.rows[0] && p.top && s.rows[0].k !== p.top && s.rows.length > 1 && s.v > p.v) { const r = s.rows[0]; if (S.route !== "defis") dfNudge(`${r.n} passe en tête : ${dfTitleShort(d)}`); }
    if (s.won && !(p.v >= s.goal) && d.kind !== "panier") dfWin(d, s);
  });
  if (changed) { if (S.route === "defis") dfPatch(); else if (["home", "salle", "cuisine", "coupdefeu"].includes(S.route)) dfStripPatch(); }
  else if (S.route === "defis") dfClock();
}
const dfFinal = (s) => ({ v: s.v, won: !!s.won, n: s.n || 0, rows: s.rows.slice(0, 8).map(({ k, n, c, v }) => ({ k, n, c, v })) });
const dfTitleShort = (d) => (d.title || dfTitle(d)).replace(/ (ce midi|ce soir|aujourd'hui|cette semaine|ce week-end|le [^ ]+ \d+ [^ ]+)$/, "");
const dfSeen = (d) => DF.shownWin[d.id] || dfLS("gg-df-win-" + d.id) === "1";
function dfMilestone(d, s, before) {
  const g = s.goal, marks = [[0.5, "La moitié !"], [0.75, "Plus que le dernier quart"], [0.9, "Presque !"]];
  for (const [m, t] of marks) {
    const key = d.id + m; if (DF.ms[key]) continue;
    if (before < g * m && s.v >= g * m && s.v < g) { DF.ms[key] = 1; dfNudge(`${t} ${dfVal(d, s.v)} / ${dfVal(d, g)} · ${dfTitleShort(d)}`); SFX.ok(); buzz(8); break; }
  }
}
function dfNudge(msg) { try { toast(msg, "info"); } catch (e) {} }

/* the win: a full-screen moment on every device of the team, once each */
function dfWin(d, s) {
  if (dfSeen(d)) return; DF.shownWin[d.id] = 1; dfLS("gg-df-win-" + d.id, "1");
  if (!d.wonAt) { try { Promise.resolve(DB.update("defis", d.id, { wonAt: Date.now() })).catch(() => {}); } catch (e) {} }
  /* the person who launched it tells the team chat (the push goes out from there) */
  if (DB.mode === "db" && d.uid === S.me.id && !d.wonAt) {
    try { DB.add("chat", { text: `Défi réussi : ${d.title || dfTitle(d)} ! Bravo l'équipe${d.reward ? ` · ${d.reward}` : ""}`, at: Date.now(), uid: S.me.id, by: S.me.name || "" }).then((id) => { if (typeof csNotify === "function") csNotify("chat", id); }).catch(() => {}); } catch (e) {}
  }
  if (typeof logEvent === "function") try { logEvent("note", `défi réussi : ${d.title || dfTitle(d)}`); } catch (e) {}
  dfCelebrate(d, s);
}
function dfFanfare() {
  try {
    SFX.init(); const T = (f, at, d = 0.22, v = 0.05, ty = "triangle") => SFX.tone(f, d, ty, v, at);
    [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.38]].forEach(([f, at]) => T(f, at, 0.3, 0.055));
    [[783.99, 0.62], [987.77, 0.62], [1174.66, 0.62]].forEach(([f, at]) => T(f, at, 0.7, 0.035, "sine"));
    [0.38, 0.62, 0.8].forEach((at) => SFX.noise(0.18, 0.02, 5000, 1800, at));
  } catch (e) {}
  buzz([30, 60, 30, 60, 80]);
}
function dfCelebrate(d, s) {
  if (DF.celebrating) { (DF.queue = DF.queue || []).push([d, s]); return; } DF.celebrating = true;
  const top = (s.rows || []).slice(0, 3), reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pod = top.length ? `<div class="df-wpod">${[1, 0, 2].filter((i) => top[i]).map((i) => { const r = top[i]; return `<div class="df-wp p${i + 1}" style="--c:${esc(r.c)};--d:${0.9 + (2 - i) * 0.14}s">${dfAv(r, "lg")}<b>${esc(r.n)}</b><em class="mono">${esc(dfVal(d, r.v))}</em><i>${i + 1}</i></div>`; }).join("")}</div>` : "";
  const el = document.createElement("div"); el.id = "dfWin"; el.className = "df-win"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Défi réussi");
  el.innerHTML = `<canvas class="df-conf" aria-hidden="true"></canvas><div class="df-wrays" aria-hidden="true"></div>
    <div class="df-wbox"><div class="df-wcup" aria-hidden="true">${dfCupSvg()}</div>
      <span class="df-wkick">${ico("dfSpark")}Défi réussi</span>
      <h2 class="df-wt">${esc(d.title || dfTitle(d))}</h2>
      <p class="df-wsub"><b class="mono">${esc(dfVal(d, s.v))}</b> ${esc(dfUnit(d))} · bravo toute l'équipe</p>
      ${pod}
      ${d.reward ? `<div class="df-wrew">${ico("dfGift")}<span><em>La récompense</em><b>${esc(d.reward)}</b></span></div>` : ""}
      <button class="btn acc block df-wgo" data-act="dfWinClose">Bravo l'équipe !</button></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("on"));
  dfFanfare(); if (!reduce) dfConfetti(el.querySelector(".df-conf"));
}
function dfCupSvg() {
  return `<svg viewBox="0 0 120 120" width="120" height="120"><defs><linearGradient id="dfG1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE59A"/><stop offset=".5" stop-color="#F6B93B"/><stop offset="1" stop-color="#D98A12"/></linearGradient><linearGradient id="dfG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4DFF"/><stop offset="1" stop-color="#3B16D9"/></linearGradient></defs>
    <path d="M36 22h48v22a24 24 0 0 1-48 0z" fill="url(#dfG1)"/><path d="M36 28H24v6a14 14 0 0 0 14 14" fill="none" stroke="#F6B93B" stroke-width="6" stroke-linecap="round"/><path d="M84 28h12v6a14 14 0 0 1-14 14" fill="none" stroke="#F6B93B" stroke-width="6" stroke-linecap="round"/>
    <rect x="43" y="27" width="5" height="22" rx="2.5" fill="#fff" fill-opacity=".45"/><rect x="54" y="66" width="12" height="16" rx="3" fill="#E39A1D"/><rect x="38" y="82" width="44" height="16" rx="5" fill="url(#dfG2)"/><rect x="44" y="87" width="32" height="6" rx="3" fill="#fff" fill-opacity=".28"/>
    <path d="M60 32l3.2 6.6 7.2 1-5.2 5 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5 7.2-1z" fill="#fff" fill-opacity=".9"/></svg>`;
}
function dfConfetti(cv) {
  if (!cv) return; const ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr); cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
  const cols = ["#5B2BFF", "#F6B93B", "#EF5A3C", "#9EF5C4", "#9EC5FF", "#FFFFFF", "#FF8CC0"], P = [];
  const shoot = (x, dir, n) => { for (let i = 0; i < n; i++) { const a = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.55), sp = (14 + Math.random() * 16) * dpr; P.push({ x, y: H * 0.98, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: (6 + Math.random() * 7) * dpr, h: (3 + Math.random() * 5) * dpr, c: cols[(Math.random() * cols.length) | 0], ci: Math.random() < 0.25 }); } };
  shoot(W * 0.06, 1, 110); shoot(W * 0.94, -1, 110);
  setTimeout(() => { for (let i = 0; i < 90; i++) P.push({ x: Math.random() * W, y: -20 * dpr, vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 3) * dpr, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, w: (6 + Math.random() * 6) * dpr, h: (3 + Math.random() * 4) * dpr, c: cols[(Math.random() * cols.length) | 0], ci: Math.random() < 0.25 }); }, 700);
  const t0 = performance.now();
  const step = (t) => {
    if (!cv.isConnected) return; ctx.clearRect(0, 0, W, H);
    P.forEach((p) => { p.vy += 0.32 * dpr; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = 0.95;
      if (p.ci) { ctx.beginPath(); ctx.arc(0, 0, p.h * 0.7, 0, 6.28); ctx.fill(); } else { ctx.scale(1, Math.cos(p.r * 2)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); } ctx.restore(); });
    if (t - t0 < 6500) requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(step);
}

/* ───────── pieces ───────── */
const dfKindOf = (k) => DF_KINDS.find((x) => x[0] === k) || DF_KINDS[0];
function dfRing(d, s, size = 196) {
  const r = 44, C = 2 * Math.PI * r, off = C * (1 - s.pct), w = s.won ? " won" : "";
  return `<div class="df-ring${w}" style="--sz:${size}px" data-dfring="${esc(d.id)}">
    <svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="dfRg-${esc(d.id)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD66B"/><stop offset=".55" stop-color="#FF8A5B"/><stop offset="1" stop-color="#C46BFF"/></linearGradient></defs>
      <circle cx="50" cy="50" r="${r}" class="df-rtrack"/>
      ${[0.25, 0.5, 0.75].map((m) => { const a = -Math.PI / 2 + m * 2 * Math.PI; return `<circle cx="${50 + r * Math.cos(a)}" cy="${50 + r * Math.sin(a)}" r="1.4" class="df-rtick${s.pct >= m ? " on" : ""}"/>`; }).join("")}
      <circle cx="50" cy="50" r="${r}" class="df-rbar" stroke="url(#dfRg-${esc(d.id)})" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" data-c="${C.toFixed(2)}"/></svg>
    <div class="df-rin"><b class="mono" data-dfv="${esc(d.id)}">${esc(dfVal(d, s.v))}</b><span>sur <b class="mono">${esc(dfVal(d, s.goal))}</b></span><em>${esc(dfUnit(d))}</em></div>
    <span class="df-rpop" data-dfpop="${esc(d.id)}" aria-hidden="true"></span></div>`;
}
const dfAv = (p, cls = "") => `<span class="df-av ${cls}" style="--c:${esc(p.c || "#5B2BFF")}">${p.k === "qr" ? ico("cmQr") : p.ic ? ico(p.ic) : esc((p.n || "?").slice(0, 1))}</span>`;
function dfBoard(d, s) {
  if (d.kind === "rapide") return "";
  const R = s.rows; if (!R.length) return `<div class="df-bempty"><span>${ico("dfFlag")}</span><p>Le premier qui vend prend la tête du classement.</p></div>`;
  const max = Math.max(...R.map((r) => r.v), 1), me = S.me.id;
  return `<ol class="df-board" data-dfboard="${esc(d.id)}">${R.slice(0, 8).map((r, i) => `<li class="df-br${i < 3 ? " m" + (i + 1) : ""}${r.k === me ? " me" : ""}" data-k="${esc(r.k)}" style="--j:${i};--c:${esc(r.c)}">
      <span class="df-brk mono">${i < 3 ? `<i class="df-medal">${i + 1}</i>` : i + 1}</span>${dfAv(r)}<span class="df-brn"><b>${esc(r.n)}${r.k === me ? " <em>vous</em>" : ""}</b><span class="df-brb"><i style="width:${Math.max(4, (r.v / max) * 100).toFixed(1)}%"></i></span></span><b class="df-brv mono">${esc(dfVal(d, r.v))}</b></li>`).join("")}</ol>`;
}
function dfFeed(d, s) {
  if (!s.feed.length) return "";
  return `<div class="df-feed" data-dffeed="${esc(d.id)}"><span class="lbl">En direct</span>${s.feed.slice(0, 4).map((f, i) => `<div class="df-fi${f.late ? " late" : ""}" style="--j:${i}">${dfAv(f.p, "sm")}<span><b>${esc(f.p.n)}</b> ${esc(f.t)}</span><em class="mono">${esc(f.v)}</em><time>${slAgoSafe(f.at)}</time></div>`).join("")}</div>`;
}
const slAgoSafe = (at) => { const m = Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4)); return m < 1 ? "à l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
function dfHero(d, i) {
  const s = dfStats(d), K = dfKindOf(d.kind);
  return `<section class="df-hero st ${K[4]}${s.won ? " won" : ""}" style="--i:${1 + i}" data-dfhero="${esc(d.id)}"><span class="df-aur" aria-hidden="true"><i></i><i></i><i></i></span>
    <div class="df-hl">${dfRing(d, s, DESK_MQ.matches ? 220 : 188)}</div>
    <div class="df-hr">
      <span class="df-kick"><i class="df-dot"></i>${s.won ? "Objectif atteint" : "En cours"} · ${ico("dfTimer")}<span data-dfleft="${esc(d.id)}">encore ${dfLeft(d)}</span></span>
      <h2 class="df-ht">${esc(d.title || dfTitle(d))}</h2>
      <p class="df-hs" data-dfrest="${esc(d.id)}">${esc(dfLeftT(d, s))}</p>
      ${d.reward ? `<div class="df-rew">${ico("dfGift")}<span>${esc(d.reward)}</span></div>` : ""}
      <div class="df-hgrid">${dfBoard(d, s)}${dfFeed(d, s)}</div>
      ${dfCanEdit() ? `<div class="df-hact"><button class="btn soft sm" data-act="dfMenu" data-id="${esc(d.id)}">${ico("dots")}Gérer</button></div>` : ""}
    </div></section>`;
}
function dfCardSm(d, mode) {
  const s = dfStats(d), K = dfKindOf(d.kind), st = dfState(d);
  const when = st === "avenir" ? `Commence ${dayKey(new Date(d.start)) === dayKey() ? `à ${hm(d.start)}` : `le ${dfDay(d.start)} à ${hm(d.start)}`}` : st === "fini" ? `${dfDay(d.start)}` : `encore ${dfLeft(d)}`;
  const won = st === "fini" && s.won;
  return `<button class="df-sm ${K[4]} ${mode}${won ? " won" : ""}" data-act="dfMenu" data-id="${esc(d.id)}">
    <span class="df-smi">${won ? dfCupSvg() : ico(K[1])}</span>
    <span class="df-smt"><b>${esc(st === "fini" ? dfTitleShort(d) : d.title || dfTitle(d))}</b><em>${esc(when)}${st === "fini" ? ` · ${esc(dfVal(d, s.v))} / ${esc(dfVal(d, s.goal))}` : ""}${d.reward && st !== "fini" ? ` · ${esc(d.reward)}` : ""}</em>
      ${st === "fini" && s.rows[0] ? `<span class="df-smw">${dfAv(s.rows[0], "xs")}<span>Meilleur score : ${esc(s.rows[0].n)}</span></span>` : ""}</span>
    ${st === "fini" ? `<span class="df-stamp ${won ? "ok" : "ko"}">${won ? "Gagné" : s.pct >= 0.85 ? "Raté de peu" : "Pas cette fois"}</span>` : st === "avenir" ? `<span class="df-stamp soon">Bientôt</span>` : ""}</button>`;
}
function dfIdeas() {
  const mid = new Date().getHours() < 15, per = mid ? "midi" : "soir", pt = mid ? "ce midi" : "ce soir";
  const I = [
    ["vente", { t: "cat", v: "dessert", label: "Desserts" }, 20, per, `20 desserts ${pt}`, "Le grand classique pour pousser la fin de repas"],
    ["vente", { t: "cat", v: "boisson", label: "Boissons" }, 50, per, `50 boissons ${pt}`, "Apéritifs, vins, cafés : tout compte"],
    ["ca", { t: "all", v: "all" }, 2000, "jour", "2 000 € aujourd'hui", "Toute l'équipe sur le même objectif"],
    ["panier", { t: "all", v: "all" }, 35, "weekend", "Ticket moyen à 35 €", "Faire goûter le vin, l'entrée, le dessert"],
    ["rapide", { t: "all", v: "all" }, 25, per, "25 bons en moins de 15 min", "Pour la cuisine : le rythme du passe"],
    ["vente", { t: "cat", v: "entree", label: "Entrées" }, 15, per, `15 entrées ${pt}`, "Proposer une entrée à chaque table"],
  ];
  return `<div class="df-ideas">${I.map(([k, w, g, p, t, sub], i) => { const K = dfKindOf(k); return `<button class="df-idea ${K[4]} st" style="--i:${3 + i}" data-act="dfNew" data-v="${esc(JSON.stringify({ kind: k, what: w, goal: g, period: p, lim: 15 }))}"><span class="df-idi">${ico(K[1])}</span><b>${esc(t)}</b><em>${esc(sub)}</em></button>`; }).join("")}</div>`;
}
function dfTrophies(done) {
  const won = done.filter((d) => dfStats(d).won);
  if (!done.length) return "";
  return `<div class="lbl st" style="--i:8">La vitrine des trophées <span class="df-cnt mono">${won.length}</span></div>
    ${won.length ? `<div class="df-shelf st" style="--i:8">${won.slice(0, 12).map((d, i) => `<button class="df-tro" style="--j:${i}" data-act="dfMenu" data-id="${esc(d.id)}" title="${esc(d.title || dfTitle(d))}"><span class="df-troc">${dfCupSvg()}</span><b>${esc(dfTitleShort(d))}</b><em>${esc(dfDay(d.start))}</em></button>`).join("")}</div>` : ""}
    <div class="df-list st" style="--i:9">${done.slice(0, 10).map((d) => dfCardSm(d, "done")).join("")}</div>`;
}

/* ───────── the screen ───────── */
VIEWS.defis = {
  live: false,
  render() {
    dfWatch(); dfFeeds();
    const live = dfLive(), soon = dfSoon(), done = dfDone(), can = dfCanEdit();
    const right = can ? `<button class="btn acc sm df-new" data-act="dfNew">${ico("dfPlus")}<span>Nouveau défi</span></button>` : "";
    const empty = !live.length;
    return `<div class="inner wide df">${topBar("Défis d'équipe", { right })}
      ${live.map((d, i) => dfHero(d, i)).join("")}
      ${empty ? `<section class="df-empty st" style="--i:1"><span class="df-aur" aria-hidden="true"><i></i><i></i><i></i></span><div class="df-ecup">${dfCupSvg()}</div><div><b>Lancez un défi à l'équipe</b><p>« 20 desserts ce soir », avec un classement en direct. Les ventes se comptent toutes seules à partir des commandes : personne n'a rien à noter.</p>${can ? `<button class="btn acc" data-act="dfNew">${ico("dfPlus")}Créer un défi</button>` : `<p class="df-enote">Le gérant ou le chef lance les défis.</p>`}</div></section>` : ""}
      ${soon.length ? `<div class="lbl st" style="--i:5">À venir</div><div class="df-list st" style="--i:5">${soon.map((d) => dfCardSm(d, "soon")).join("")}</div>` : ""}
      ${can ? `<div class="lbl st df-lid" style="--i:6">${empty ? "Des idées pour commencer" : "Lancer un autre défi"}</div>${dfIdeas()}` : ""}
      ${dfTrophies(done)}
      <p class="note df-how st" style="--i:10">${ico("dfSpark")}<span>Les ventes viennent de la prise de commande et du menu QR, au nom du serveur qui a ouvert la table. Les plats offerts ou annulés ne comptent pas.</span></p>
    </div>`;
  },
  after(v) { DF.prevDom = {}; dfLive().forEach((d) => (DF.prevDom[d.id] = dfStats(d))); },
};
/* in-place update of the screen: the number rolls, the ring fills, a « +1 » jumps, the leaderboard reorders smoothly */
function dfPatch() {
  const v = $("#viewport .view:not(.leave)"); if (!v || S.route !== "defis") return;
  if ($("#sheet").classList.contains("open")) return;
  dfLive().forEach((d) => {
    const hero = v.querySelector(`[data-dfhero="${d.id}"]`); if (!hero) { rerender(); return; }
    const s = dfStats(d), was = (DF.prevDom || {})[d.id];
    const bar = hero.querySelector(".df-rbar"); if (bar) { const C = +bar.dataset.c; bar.style.strokeDashoffset = (C * (1 - s.pct)).toFixed(2); }
    hero.querySelectorAll(".df-rtick").forEach((t, i) => t.classList.toggle("on", s.pct >= [0.25, 0.5, 0.75][i]));
    const num = hero.querySelector(`[data-dfv="${d.id}"]`); if (num) dfRoll(num, was ? was.v : s.v, s.v, d);
    const rest = hero.querySelector(`[data-dfrest="${d.id}"]`); if (rest) rest.textContent = dfLeftT(d, s);
    hero.classList.toggle("won", !!s.won); hero.querySelector(".df-ring")?.classList.toggle("won", !!s.won);
    const b = DF.bump[d.id];
    if (b && was && s.v > was.v) {
      const pop = hero.querySelector(`[data-dfpop="${d.id}"]`);
      if (pop) { pop.innerHTML = `${b.who ? dfAv(b.who, "xs") : ""}<b>${d.kind === "ca" ? "+" + dfEur(s.v - was.v) : d.kind === "panier" ? "" : "+" + Math.round(s.v - was.v)}</b>${b.who ? `<span>${esc(b.who.n)}</span>` : ""}`; pop.classList.remove("go"); void pop.offsetWidth; if (d.kind !== "panier") pop.classList.add("go"); }
      hero.querySelector(".df-ring")?.classList.remove("hit"); void hero.offsetWidth; hero.querySelector(".df-ring")?.classList.add("hit");
      SFX.tick(); buzz(6);
    }
    /* leaderboard: FLIP */
    const old = hero.querySelector(`[data-dfboard="${d.id}"]`), grid = hero.querySelector(".df-hgrid");
    if (grid) {
      const pos = {}; if (old) old.querySelectorAll(".df-br").forEach((li) => (pos[li.dataset.k] = li.getBoundingClientRect().top));
      const tmp = document.createElement("div"); tmp.innerHTML = dfBoard(d, s) + dfFeed(d, s);
      grid.innerHTML = tmp.innerHTML; grid.classList.add("live");
      const nb = grid.querySelector(".df-board");
      if (nb) nb.querySelectorAll(".df-br").forEach((li) => { const p0 = pos[li.dataset.k]; li.style.animation = "none"; if (p0 == null) { li.classList.add("new"); return; } const dy = p0 - li.getBoundingClientRect().top; if (!dy) return; li.style.transform = `translateY(${dy}px)`; li.style.transition = "none"; requestAnimationFrame(() => { li.style.transition = "transform .6s cubic-bezier(.34,1.56,.64,1)"; li.style.transform = ""; if (dy > 0) li.classList.add("up"); }); });
      const f0 = grid.querySelector(".df-fi"); if (f0 && was && s.v !== was.v) f0.classList.add("fresh");
    }
    DF.prevDom[d.id] = s;
  });
  dfClock();
}
function dfRoll(el, a, b, d) {
  if (a === b) { el.textContent = dfVal(d, b); return; }
  const t0 = performance.now(), dur = 700;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = dfVal(d, a + (b - a) * e); if (k < 1) requestAnimationFrame(step); else { el.textContent = dfVal(d, b); el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); } };
  requestAnimationFrame(step);
}
function dfClock() { $$("[data-dfleft]").forEach((e) => { const d = (DF.list || []).find((x) => x.id === e.dataset.dfleft); if (d) e.textContent = `encore ${dfLeft(d)}`; }); if (S.route === "defis" && dfLive().some((d) => Date.now() > d.end)) rerender(); }

/* ───────── create ───────── */
function dfDefault(seed) {
  const mid = new Date().getHours() < 15;
  return { kind: "vente", what: { t: "cat", v: "dessert", label: "Desserts" }, goal: 20, lim: 15, period: mid ? "midi" : "soir", reward: "", tell: true, ...(seed || {}) };
}
const DF_GOALS = { vente: [10, 15, 20, 30, 50], ca: [1000, 1500, 2000, 3000, 5000], panier: [28, 32, 35, 38, 45], rapide: [15, 20, 25, 30, 40] };
function dfNewSheet() {
  const F = DF.F, K = dfKindOf(F.kind), preview = { ...F, start: dfWindow(F.period).start };
  const dishes = typeof slDishes === "function" ? slDishes() : (S.notes || []).filter((n) => n.carte);
  const step = F.kind === "ca" ? 100 : F.kind === "panier" ? 1 : 1;
  return `<div class="df-sh"><div class="sl-shh"><span class="h2">Nouveau défi</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="df-kinds" role="radiogroup" aria-label="Type de défi">${DF_KINDS.map(([k, ic, t, sub, c]) => `<button class="df-kd ${c}${k === F.kind ? " on" : ""}" role="radio" aria-checked="${k === F.kind}" data-act="dfK" data-v="${k}"><span>${ico(ic)}</span><b>${t}</b><em>${sub}</em></button>`).join("")}</div>
    ${F.kind === "vente" ? `<div class="lbl">Quoi ?</div><div class="chips df-chips">${DF_CATS.map(([id, t]) => `<button class="chip${F.what.t === "cat" && F.what.v === id ? " on" : ""}" data-act="dfWhat" data-v="${id}">${esc(t)}</button>`).join("")}${F.what.t === "dish" ? `<button class="chip on" data-act="dfDish">${esc(F.what.label)}</button>` : ""}${dishes.length ? `<button class="chip ghost" data-act="dfDish">${ico("book")}Un plat précis…</button>` : ""}</div>` : ""}
    ${F.kind === "rapide" ? `<div class="lbl">Prêt en moins de</div><div class="seg df-seg">${[10, 12, 15, 20].map((m) => `<button class="${+F.lim === m ? "on" : ""}" data-act="dfLim" data-v="${m}">${m} min</button>`).join("")}</div>` : ""}
    <div class="lbl">${F.kind === "ca" ? "Montant à atteindre" : F.kind === "panier" ? "Ticket moyen par couvert" : F.kind === "rapide" ? "Nombre de bons" : "Combien ?"}</div>
    <div class="df-goal"><button class="iconbtn" data-act="dfGoal" data-v="${-step}" aria-label="Moins">${ico("minus")}</button><label class="df-gv"><input class="mono" id="dfGoalIn" type="number" inputmode="numeric" min="1" value="${esc(String(F.goal))}" aria-label="Objectif">${F.kind === "ca" || F.kind === "panier" ? "<span>€</span>" : ""}</label><button class="iconbtn" data-act="dfGoal" data-v="${step}" aria-label="Plus">${ico("dfPlus")}</button></div>
    <div class="chips df-qg">${DF_GOALS[F.kind].map((g) => `<button class="chip${+F.goal === g ? " on" : ""}" data-act="dfGoalSet" data-v="${g}">${F.kind === "ca" || F.kind === "panier" ? dfEur(g) : g}</button>`).join("")}</div>
    <div class="lbl">Quand ?</div><div class="chips df-chips">${DF_PERIODS.map(([id, t]) => { const ok = dfPeriodOk(id); return `<button class="chip${F.period === id ? " on" : ""}" data-act="dfPer" data-v="${id}"${ok ? "" : " disabled"}>${t}</button>`; }).join("")}</div>
    <div class="lbl">La récompense <span class="df-opt">facultatif</span></div>
    <input class="input" id="dfRew" maxlength="80" placeholder="Ex. : le repas d'équipe offert" value="${esc(F.reward || "")}">
    <div class="chips df-chips df-rews">${DF_REWARDS.map((r) => `<button class="chip${F.reward === r ? " on" : ""}" data-act="dfRewSet" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div>
    <label class="df-tell"><input type="checkbox" id="dfTell"${F.tell ? " checked" : ""}><span><b>Prévenir l'équipe</b><em>Une consigne part sur le téléphone de chacun.</em></span></label>
    <div class="df-prev ${K[4]}"><span class="df-smi">${ico(K[1])}</span><span><em>Le défi</em><b id="dfPrevT">${esc(dfTitle(preview))}</b></span></div>
    <button class="btn acc block df-go" data-act="dfCreate">${ico("dfFlag")}Lancer le défi</button></div>`;
}
function dfSync() { const F = DF.F; if (!F) return; const g = $("#dfGoalIn"); if (g) F.goal = Math.max(1, Math.round(num(g.value) || F.goal)); const r = $("#dfRew"); if (r) F.reward = r.value.trim(); const t = $("#dfTell"); if (t) F.tell = t.checked; }
function dfRedraw() { dfSync(); openSheet(dfNewSheet()); }
document.addEventListener("input", (e) => { if (e.target && e.target.id === "dfGoalIn" && DF.F) { DF.F.goal = Math.max(1, Math.round(num(e.target.value) || 1)); const t = $("#dfPrevT"); if (t) t.textContent = dfTitle({ ...DF.F, start: dfWindow(DF.F.period).start }); } });

function dfMenuSheet(d) {
  const s = dfStats(d), st = dfState(d), K = dfKindOf(d.kind), can = dfCanEdit();
  const head = st === "fini" ? (s.won ? "Gagné" : "Pas cette fois") : st === "avenir" ? "À venir" : s.won ? "Objectif atteint" : "En cours";
  return `<div class="df-sh"><div class="sl-shh"><span class="h2">${esc(head)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="df-prev ${K[4]}"><span class="df-smi">${st === "fini" && s.won ? dfCupSvg() : ico(K[1])}</span><span><em>${esc(dfDay(d.start))} · ${hm(d.start)} → ${hm(d.end)} · lancé par ${esc(firstName(d.by) || "l'équipe")}</em><b>${esc(d.title || dfTitle(d))}</b></span></div>
    <div class="df-msc"><div><b class="mono">${esc(dfVal(d, s.v))}</b><span>sur ${esc(dfVal(d, s.goal))}</span></div><div class="df-mbar"><i style="width:${(s.pct * 100).toFixed(1)}%"></i></div></div>
    ${d.reward ? `<div class="df-rew in">${ico("dfGift")}<span>${esc(d.reward)}</span></div>` : ""}
    ${st !== "avenir" ? dfBoard(d, s) : ""}
    ${can ? `<div class="df-macts">${st === "live" ? `<button class="btn soft block" data-act="dfStop" data-id="${esc(d.id)}">${ico("dfStop")}Arrêter le défi maintenant</button>` : ""}${st !== "live" ? `<button class="btn soft block" data-act="dfAgain" data-id="${esc(d.id)}">${ico("dfFlag")}Relancer le même défi</button>` : ""}<button class="btn ghost block df-del" data-act="dfDel" data-id="${esc(d.id)}">${ico("trash")}Supprimer</button></div>` : ""}</div>`;
}

Object.assign(ACT, {
  dfNew(el, id, v) {
    if (!dfCanEdit()) { toast("Le gérant ou le chef lance les défis", "info"); return; }
    let seed = null; try { seed = v ? JSON.parse(v) : null; } catch (e) {}
    DF.F = dfDefault(seed); if (!dfPeriodOk(DF.F.period)) DF.F.period = "jour"; SFX.tap(); openSheet(dfNewSheet());
  },
  dfK(el, id, v) { dfSync(); const F = DF.F; if (!F || F.kind === v) return; F.kind = v; F.goal = DF_GOALS[v][2]; if (v !== "vente") F.what = { t: "all", v: "all" }; else F.what = { t: "cat", v: "dessert", label: "Desserts" }; if (v === "panier" && (F.period === "midi" || F.period === "soir")) F.period = "jour"; SFX.tap(); buzz(4); openSheet(dfNewSheet()); },
  dfWhat(el, id, v) { const F = DF.F; if (!F) return; F.what = { t: "cat", v, label: dfCat(v)[1] }; SFX.tap(); dfRedraw(); },
  dfDish() {
    dfSync(); const dishes = (typeof slDishes === "function" ? slDishes() : (S.notes || []).filter((n) => n.carte)).slice(0, 80);
    openSheet(`<div class="df-sh"><div class="sl-shh"><button class="iconbtn" data-act="dfBackNew" aria-label="Retour">${ico("back")}</button><span class="h2">Quel plat ?</span><span></span></div>
      <div class="df-dishes">${dishes.map((n) => `<button class="df-dish" data-act="dfDishPick" data-id="${esc(n.id)}"><b>${esc(n.title || "Plat")}</b><em>${esc(typeof noteCarteCat === "function" ? noteCarteCat(n.carteCat) : n.carteCat || "")}${num(n.price) ? ` · ${esc(dfEur(num(n.price), true))}` : ""}</em></button>`).join("") || `<p class="note">Aucun plat à la carte pour l'instant.</p>`}</div></div>`);
  },
  dfDishPick(el, id) { const n = (S.notes || []).find((x) => x.id === id); if (!n || !DF.F) return; DF.F.what = { t: "dish", v: id, label: n.title || "Plat" }; if (+DF.F.goal > 30) DF.F.goal = 15; SFX.tap(); openSheet(dfNewSheet()); },
  dfBackNew() { openSheet(dfNewSheet()); },
  dfLim(el, id, v) { if (!DF.F) return; DF.F.lim = +v; SFX.tap(); dfRedraw(); },
  dfGoal(el, id, v) { dfSync(); const F = DF.F; if (!F) return; F.goal = Math.max(1, (+F.goal || 0) + +v); const g = $("#dfGoalIn"); if (g) g.value = F.goal; const t = $("#dfPrevT"); if (t) t.textContent = dfTitle({ ...F, start: dfWindow(F.period).start }); SFX.tick(); buzz(3); $$(".df-qg .chip").forEach((c) => c.classList.toggle("on", +c.dataset.v === F.goal)); },
  dfGoalSet(el, id, v) { dfSync(); if (!DF.F) return; DF.F.goal = +v; SFX.tap(); openSheet(dfNewSheet()); },
  dfPer(el, id, v) { dfSync(); if (!DF.F) return; DF.F.period = v; SFX.tap(); openSheet(dfNewSheet()); },
  dfRewSet(el, id, v) { dfSync(); if (!DF.F) return; DF.F.reward = DF.F.reward === v ? "" : v; SFX.tap(); openSheet(dfNewSheet()); },
  async dfCreate() {
    dfSync(); const F = DF.F; if (!F) return;
    if (!(+F.goal > 0)) { SFX.err(); return; }
    const w = dfWindow(F.period), now = Date.now();
    const doc = { kind: F.kind, what: F.what, goal: +F.goal, ...(F.kind === "rapide" ? { lim: +F.lim || 15 } : {}), period: F.period, start: w.start, end: w.end, reward: F.reward || "", at: now, uid: S.me.id, by: (typeof esActorName === "function" && esActorName()) || S.me.name || "" };
    doc.title = dfTitle(doc);
    closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst();
    const id = await DB.add("defis", doc); DF.F = null;
    try { logEvent("note", `a lancé le défi « ${doc.title} »`); } catch (e) {}
    if (F.tell) {
      try {
        const when = now < w.start ? ` (à partir de ${hm(w.start)})` : "";
        const cid = await DB.add("consignes", { kind: "info", text: `Défi : ${doc.title}${when}.${doc.reward ? ` À la clé : ${doc.reward}.` : ""} Suivez le classement dans Défis d'équipe.`, day: dayKey(), keep: false, at: Date.now(), uid: S.me.id, by: doc.by });
        if (typeof csNotify === "function") csNotify("consigne", cid);
      } catch (e) {}
    }
    dfFeeds(); toast(F.tell ? "Défi lancé, l'équipe est prévenue" : "Défi lancé");
    if (S.route !== "defis") go("defis"); else rerender();
  },
  dfMenu(el, id) { const d = (DF.list || []).find((x) => x.id === id); if (!d) return; SFX.tap(); openSheet(dfMenuSheet(d)); },
  async dfStop(el, id) { const d = (DF.list || []).find((x) => x.id === id); if (!d) return; const s = dfStats(d); closeSheet(true); SFX.ok(); await DB.update("defis", id, { stoppedAt: Date.now(), final: dfFinal(s) }); toast("Défi arrêté"); rerender(); },
  dfAgain(el, id) { const d = (DF.list || []).find((x) => x.id === id); if (!d) return; DF.F = dfDefault({ kind: d.kind, what: d.what, goal: d.goal, lim: d.lim || 15, period: dfPeriodOk(d.period) ? d.period : "jour", reward: d.reward || "" }); SFX.tap(); openSheet(dfNewSheet()); },
  dfDel(el, id) {
    if (el && !el.classList.contains("sure")) { el.classList.add("sure"); el.innerHTML = `${ico("trash")}Toucher encore pour supprimer`; SFX.tap(); buzz(6); setTimeout(() => { if (el.isConnected) { el.classList.remove("sure"); el.innerHTML = `${ico("trash")}Supprimer`; } }, 3000); return; }
    closeSheet(true); DB.del("defis", id); SFX.close(); toast("Défi supprimé"); rerender();
  },
  dfWinClose() { const el = $("#dfWin"); if (!el) return; SFX.tap(); el.classList.remove("on"); el.classList.add("off"); DF.celebrating = false; setTimeout(() => { el.remove(); const n = (DF.queue || []).shift(); if (n) dfCelebrate(n[0], dfStats(n[0])); }, 450); if (S.route === "defis") rerender(); },
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#dfWin")) ACT.dfWinClose(); });

/* ───────── everywhere else: Accueil card, strip on the service screens ───────── */
function dfStrip(d, where) {
  const s = dfStats(d), lead = s.rows[0];
  return `<button class="df-strip ${where}${s.won ? " won" : ""}" data-go="defis" data-dfstrip="${esc(d.id)}" aria-label="Défi : ${esc(d.title || dfTitle(d))}">
    <span class="df-sti">${ico("dfCup")}</span><span class="df-stt"><b>${esc(dfTitleShort(d))}</b><span class="df-stb"><i style="width:${(s.pct * 100).toFixed(1)}%"></i></span></span>
    <b class="df-stv mono">${esc(dfVal(d, s.v))}<em>/${esc(dfVal(d, s.goal))}</em></b>${lead && where !== "kit" ? `<span class="df-stl">${dfAv(lead, "xs")}</span>` : ""}</button>`;
}
function dfStrips(where) {
  if (!S.resto || !dfOn() || !DF.list) return "";
  const L = dfLive().filter((d) => (where === "kit" ? d.kind === "rapide" : where === "sal" ? d.kind !== "rapide" : true));
  return L.length ? `<div class="df-strips st" style="--i:1">${L.slice(0, 2).map((d) => dfStrip(d, where)).join("")}</div>` : "";
}
function dfStripPatch() {
  $$("[data-dfstrip]").forEach((el) => {
    const d = (DF.list || []).find((x) => x.id === el.dataset.dfstrip); if (!d) return; const s = dfStats(d);
    const v = el.querySelector(".df-stv"); if (v) v.innerHTML = `${esc(dfVal(d, s.v))}<em>/${esc(dfVal(d, s.goal))}</em>`;
    const b = el.querySelector(".df-stb i"); if (b) b.style.width = (s.pct * 100).toFixed(1) + "%";
    el.classList.toggle("won", !!s.won); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  });
  $$("[data-dfhome]").forEach((el) => { const d = (DF.list || []).find((x) => x.id === el.dataset.dfhome); if (!d) return; const s = dfStats(d); const v = el.querySelector(".df-hcv"); if (v) v.textContent = dfVal(d, s.v); const b = el.querySelector(".df-hcb i"); if (b) b.style.width = (s.pct * 100).toFixed(1) + "%"; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
}
function dfHomeCard() {
  if (!S.resto || !dfOn()) return ""; dfWatch(); const L = dfLive(); if (!L.length) return "";
  const d = L[0], s = dfStats(d), lead = s.rows[0];
  return `<section class="df-hc st" style="--i:1" data-dfhome="${esc(d.id)}"><button class="df-hcin" data-go="defis"><span class="df-aur" aria-hidden="true"><i></i><i></i></span>
    <span class="df-hcc">${dfCupSvg()}</span>
    <span class="df-hct"><span class="df-kick"><i class="df-dot"></i>Défi d'équipe${L.length > 1 ? ` · ${L.length} en cours` : ""}</span><b>${esc(d.title || dfTitle(d))}</b>
      <span class="df-hcb"><i style="width:${(s.pct * 100).toFixed(1)}%"></i></span>
      <em><b class="df-hcv mono">${esc(dfVal(d, s.v))}</b> / ${esc(dfVal(d, s.goal))}${lead ? ` · ${esc(lead.n)} en tête` : ""}</em></span>${ico("chev")}</button></section>`;
}
(function dfWraps() {
  const topRe = /(<div class="top st"[^]*?<\/div>)/;
  const wrap = () => {
    const H = VIEWS.home; if (H && !H._df) { H._df = true; const h0 = H.render; H.render = function (p) { const html = h0.call(this, p); let c = ""; try { c = dfHomeCard(); } catch (e) {} return c && html.includes("</header>") ? html.replace("</header>", "</header>" + c) : html; }; }
    [["salle", "sal"], ["cuisine", "kit"]].forEach(([r, w]) => { const V = VIEWS[r]; if (!V || V._df) return; V._df = true; const r0 = V.render; V.render = function (p) { const html = r0.call(this, p); let c = ""; try { c = dfStrips(w); } catch (e) {} return c && topRe.test(html) ? html.replace(topRe, "$1" + c) : html; }; });
    const C = VIEWS.coupdefeu; if (C && !C._df) { C._df = true; const c0 = C.render; C.render = function (p) { const html = c0.call(this, p); let c = ""; try { const role = typeof cfRole === "function" ? cfRole() : "salle"; c = dfStrips(role === "cuisine" ? "kit" : role === "salle" ? "sal" : "all"); } catch (e) {} return c && html.includes('<div class="cf-body"') ? html.replace('<div class="cf-body"', c.replace("df-strips", "df-strips cf") + '<div class="cf-body"') : html; }; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wrap); else wrap();
})();
