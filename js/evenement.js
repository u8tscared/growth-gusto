/* Growth Gusto — area: Événements (route « evenement »). Prefix « ev ».
   Un salon, une foire, un marché, un festival : le restaurateur tient un stand, souvent seul, dans le jus.
   Deux étages, et rien ne se mélange avec le service du restaurant (Marceau 2026-11-07) :
   1) La section « Événements » (menu de l'app) : chaque événement a sa propre case, en cours, à venir ou terminé, avec ses chiffres.
      Toucher un événement ouvre son bilan à lui (route evenement, params {id}) : tout l'événement ou jour par jour, par article,
      par jour ou par heure, les ventes annulables, l'export CSV. C'est « l'après » : les chiffres arrivent là, et nulle part ailleurs.
   2) La caisse du stand (« Ouvrir la caisse du stand ») : une mini-interface plein écran, sans menu, sans barre d'onglets, sans
      bouton retour ni alerte du restaurant (tables, QR, cuisine se taisent : html.ev-live, evLiveOn()). Elle reste ouverte sur
      cet appareil (localStorage gg-ev-live-{rid}) jusqu'à « Fermer la caisse », qui montre le récap du jour puis le bilan.
   Les ventes du stand vivent dans leur propre collection (evSales) : jamais dans « à servir » de la salle, la cuisine, le coup de
   feu, les commandes en ligne, la caisse ou les finances du restaurant. La caisse, en détail :
     Vendre     des tuiles géantes (les articles du stand) → le panier → « Encaisser » : carte sur le terminal (SumUp…), ou
                espèces avec le rendu monnaie. Sur place ou à emporter (plateau), un prénom si on veut l'appeler.
     Commandes  les ventes à préparer, avec un grand numéro : « Prêt » (carillon), puis « Remis ». Désactivable pour un stand
                où tout part tout de suite.
     Ma journée le chiffre du jour, les ventes, le panier moyen, carte et autres paiements, par article (et ce qu'il reste),
                par heure, les dernières ventes (annulables, jamais effacées), export CSV.
   Chaque article peut avoir une quantité apportée pour la journée : la tuile montre ce qu'il reste et passe « Épuisé » à zéro.
   Pas une caisse enregistreuse certifiée (NF525) : le montant se passe sur le terminal de paiement du restaurant, les espèces
   se notent sur sa caisse ou son carnet. Comme la prise de commande en salle (js/salle.js), l'app garde la vente et le bilan.
   Appareil du stand : « Stand d'événement » dans Vues & appareils (js/espaces.js, station « evenement », kiosque grand écran,
   sortie par le cadenas + code du gérant), ou le bouton « Lancer sur cet appareil » de l'écran.
   Data (restos/{rid}/…, members read/write, generic rule):
     evStands/{id} { name, place, from, to (AAAA-MM-JJ), queue (bool, « à préparer » avant de remettre), items:[{ id, t, p, n? }], at, uid, by }
     evSales/{id}  { ev (stand id), day, at, n (numéro du jour), items:[{ id, t, p, q }], total, pay:"carte"|"autre", mode:"place"|"emporter",
                     name?, status:"prep"|"prete"|"remise", readyAt?, doneAt?, by, byName, void?:{ at, by, why } }
   Pack Second (pro), comme la prise de commande. */
"use strict";

TAB_OF.evenement = "more";
(function evNav() {
  if (NAV.some((n) => n[0] === "evenement")) return;
  const i = ["bar", "cuisine", "salle"].map((r) => NAV.findIndex((n) => n[0] === r)).find((x) => x >= 0);
  NAV.splice(i != null && i >= 0 ? i + 1 : NAV.length, 0, ["evenement", "evTent", "Événements"]);
})();
try { if (typeof AB_GATE !== "undefined") AB_GATE.evenement = ["pro", "Événements"]; } catch (e) {}
if (typeof PC_LECONS === "object") PC_LECONS.evenement = {
  t: "Événements", d: "Sur un salon, une foire ou un marché, une caisse de stand à part, toute simple : vendre, remettre les plateaux, puis le bilan de l'événement dans sa propre case.",
  who: ["salle", "boss"],
  steps: ["Préparez l'événement : nom, dates, articles et prix", "Ouvrez la caisse du stand : touchez les articles, encaissez par carte ou en espèces", "Fermez la caisse le soir : les chiffres partent dans la case de l'événement, jamais dans le service du restaurant"],
  q: ["Où retrouver le chiffre du salon une fois fini ?", ["Dans Événements, sur la case du salon", "Dans « à servir » de la salle", "Dans la caisse du restaurant"], 0],
  tip: "Ouvrez la caisse sur le téléphone ou la tablette du stand : elle prend tout l'écran et n'affiche que ça.",
  sc: { k: "ticket", t: "Vente n° 42 · à emporter", lines: [["2 × Croque truffé", "18,00 €"], ["1 × Verre de côtes-du-rhône", "5,00 €"]], total: "23,00 €" },
};
Object.assign(IC, {
  evTent: ["f:M3.5 19.5 12 4l8.5 15.5z", "M3.5 19.5 12 4l8.5 15.5z", "M12 4v15.5", "M9 19.5 12 13l3 6.5", "M2.5 19.5h19"],
  evBag: ["f:M5 8.5h14l-1 11a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5z", "M5 8.5h14l-1 11a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5z", "M9 8.5V7a3 3 0 0 1 6 0v1.5"],
  evSeat: ["M6 11V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V11", "f:M4.5 11h15v3.5h-15z", "M4.5 11h15v3.5h-15z", "M6.5 14.5V20", "M17.5 14.5V20"],
  evCard: ["f:M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z", "r:3,5,18,14,1.8", "M3 9.5h18", "M6.5 15h4"],
  evCoins: ["c:9,9,5.5", "f:M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z", "M14.6 9.6a5.5 5.5 0 1 1-5 5.7", "M9 6.8v4.4", "M7.4 8.2h3"],
  evBell: ["f:M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z", "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  evExport: ["M12 3.5v11", "m7.5 10 4.5 4.5 4.5-4.5", "M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2"],
  evPlay: ["f:M8 5.5v13l10.5-6.5z", "M8 5.5v13l10.5-6.5z"],
  evUndo: ["M9 14 4.5 9.5 9 5", "M4.5 9.5H15a5 5 0 0 1 0 10h-3"],
});

/* ───────── vocabulary ───────── */
const EV_TABS = [["vendre", "Caisse"], ["servir", "Commandes"], ["bilan", "Ma journée"]];
const EV_VOID = ["Erreur de saisie", "Client parti", "Remboursé", "Doublon"];
const EV_COLORS = ["#5B2BFF", "#E0582F", "#1E7F55", "#C2337A", "#3B6FD8", "#B97D0E", "#0E8C9E", "#8A4DFF"];

const EV = { live: undefined, liveRid: null, rid: null, stands: null, sales: null, sel: null, tab: "vendre", cart: [], mode: "place", day: null, pay: null, given: 0, fresh: new Set(), tick: null };

const evEur = (v) => { const x = Math.round((+v || 0) * 100) / 100; return x.toLocaleString("fr-FR", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €"; };
const evEur2 = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const evAgo = (ts) => { const m = Math.max(0, Math.floor((Date.now() - ts) / 6e4)); return m < 1 ? "à l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
const evDayLbl = (k) => { if (k === dayKey()) return "Aujourd'hui"; if (k === addDays(dayKey(), -1)) return "Hier"; const d = parseDay(k); return d ? `${DAYS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.` : k; };
const evRange = (st) => { if (!st || !st.from) return ""; const a = parseDay(st.from), b = parseDay(st.to || st.from); if (!a) return ""; const f = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`; return st.to && st.to !== st.from ? `du ${a.getDate()} au ${f(b)}` : `le ${f(a)}`; };
const evColor = (st, it) => EV_COLORS[Math.max(0, (st.items || []).findIndex((x) => x.id === it.id)) % EV_COLORS.length];
const evLocked = () => { try { return typeof esLocked === "function" && esLocked(); } catch (e) { return false; } };
const evOnStand = () => { try { return typeof esStation === "function" && esShared() && esStation() === "evenement"; } catch (e) { return false; } };

/* ───────── data ───────── */
function evWatch() {
  if (!S.rid || !S.ready) return;
  if (EV.rid === S.rid) return; EV.rid = S.rid; EV.stands = null; EV.sales = null; EV.sel = null; EV.cart = [];
  const rid = S.rid;
  if (DB.mode === "demo") evSeedDemo();
  DB.watch("evStands", { order: "at", dir: "desc", limit: 80 }, (rows) => { if (S.rid !== rid) return; EV.stands = rows; if (S.route === "evenement") onData(); });
  DB.watch("evSales", { order: "at", dir: "desc", limit: 2000 }, (rows) => { if (S.rid !== rid) return; const had = EV.sales; EV.sales = rows; if (had) evNewReady(had, rows); if (S.route === "evenement") onData(); });
}
window.addEventListener("gg:ready", () => setTimeout(() => { try { if (S.route === "evenement") evWatch(); } catch (e) {} }, 300));
/* the stand on today, else the one chosen, else the latest */
function evPickCur() {
  const L = EV.stands || []; if (!L.length) return null;
  if (EV.sel) { const s = L.find((x) => x.id === EV.sel); if (s) return s; }
  const t = dayKey(); return L.find((s) => s.from <= t && (s.to || s.from) >= t) || L.slice().sort((a, b) => String(b.from || "").localeCompare(String(a.from || "")) || b.at - a.at)[0];
}
/* the till open on this device (kept across reloads until « Fermer la caisse »); a « Stand d'événement » kiosk is always on its till */
const evLiveKey = () => "gg-ev-live-" + (S.rid || "");
function evLiveGet() { if (EV.liveRid === S.rid && EV.live !== undefined) return EV.live; EV.liveRid = S.rid; try { EV.live = localStorage.getItem(evLiveKey()) || null; } catch (e) { EV.live = null; } return EV.live; }
function evLiveSet(id) { EV.live = id || null; EV.liveRid = S.rid; try { if (id) localStorage.setItem(evLiveKey(), id); else localStorage.removeItem(evLiveKey()); } catch (e) {} }
function evLiveStand() { if (!EV.stands) return null; if (evOnStand()) return evPickCur(); const id = evLiveGet(); return id ? EV.stands.find((x) => x.id === id) || null : null; }
/* the stand being sold on (live till), else the one on today / chosen */
const evCur = () => evLiveStand() || evPickCur();
/* the event on screen: the till, else the one whose report is open, else the current one */
const evShown = () => evLiveStand() || (S.route === "evenement" && S.params && S.params.id && (EV.stands || []).find((x) => x.id === S.params.id)) || evPickCur();
/* true while the stand's till fills the screen: the restaurant's own calls, QR orders and kitchen bells stay quiet */
window.evLiveOn = () => { try { return S.route === "evenement" && !!evLiveStand(); } catch (e) { return false; } };
function evChrome() { try { document.documentElement.classList.toggle("ev-live", window.evLiveOn()); } catch (e) {} }
const evState = (st, t = dayKey()) => (st.from <= t && (st.to || st.from) >= t ? "on" : st.from > t ? "soon" : "done");
const evSalesOf = (st, day) => (EV.sales || []).filter((x) => x.ev === st.id && (!day || x.day === day));
const evLive = (st, day = dayKey()) => evSalesOf(st, day).filter((x) => !x.void);
function evSoldMap(st, day = dayKey()) { const m = {}; evLive(st, day).forEach((s) => (s.items || []).forEach((x) => { m[x.id] = (m[x.id] || 0) + (+x.q || 0); })); return m; }
const evInCart = (id) => EV.cart.filter((x) => x.id === id).reduce((a, x) => a + x.q, 0);
/* left for today: brought − sold − in the basket (null = not counted) */
function evLeft(st, it, sold = evSoldMap(st)) { const n = num(it.n); if (n == null || n <= 0) return null; return Math.max(0, n - (sold[it.id] || 0) - evInCart(it.id)); }
const evTotal = () => Math.round(EV.cart.reduce((a, x) => a + x.p * x.q, 0) * 100) / 100;
const evCount = () => EV.cart.reduce((a, x) => a + x.q, 0);
const evQueue = (st) => (EV.sales || []).filter((x) => x.ev === st.id && !x.void && (x.status === "prep" || x.status === "prete")).sort((a, b) => a.at - b.at);
function evStats(st, day) {
  const L = evLive(st, day), tot = L.reduce((a, s) => a + (+s.total || 0), 0), card = L.filter((s) => s.pay === "carte").reduce((a, s) => a + (+s.total || 0), 0);
  const per = {}; L.forEach((s) => (s.items || []).forEach((x) => { const r = (per[x.id] ||= { id: x.id, t: x.t, q: 0, v: 0 }); r.q += +x.q || 0; r.v += (+x.q || 0) * (+x.p || 0); }));
  const hours = {}; L.forEach((s) => { const h = new Date(s.at).getHours(); hours[h] = (hours[h] || 0) + (+s.total || 0); });
  const out = L.filter((s) => s.mode === "emporter").length;
  return { L, n: L.length, tot, card, other: tot - card, avg: L.length ? tot / L.length : 0, per: Object.values(per).sort((a, b) => b.v - a.v), hours, out, voids: evSalesOf(st, day).filter((s) => s.void).length };
}
/* a sale became ready on another device: chime on the stand */
function evNewReady(prev, rows) {
  if (S.route !== "evenement") return; const was = new Map(prev.map((x) => [x.id, x.status]));
  rows.forEach((x) => { if (x.status === "prete" && was.has(x.id) && was.get(x.id) !== "prete" && !EV.fresh.has("me" + x.id)) { EV.fresh.add(x.id); evChime(); } });
}
function evChime() { try { SFX.init(); SFX.tone(1175, 0.14, "sine", 0.05); SFX.tone(1568, 0.3, "sine", 0.04, 0.1); buzz([16, 40, 16]); } catch (e) {} }

/* ───────── demo: « Salon Saveurs du Rhône », a day well under way ───────── */
function evSeedDemo() {
  const ps = `restos/${S.rid}/evStands`, pv = `restos/${S.rid}/evSales`; if (DB.local[ps]) return;
  const t = dayKey(), now = Date.now();
  const items = [
    { id: "ev-croque", t: "Croque truffé", p: 9, n: 60 }, { id: "ev-bourgui", t: "Bourguignon en bocal", p: 12, n: 40 }, { id: "ev-planche", t: "Planche à partager", p: 16, n: 25 },
    { id: "ev-tarte", t: "Tarte aux pralines", p: 5, n: 30 }, { id: "ev-vin", t: "Verre de côtes-du-rhône", p: 5 }, { id: "ev-biere", t: "Bière de la Croix-Rousse", p: 6 },
    { id: "ev-cafe", t: "Café", p: 2 }, { id: "ev-eau", t: "Eau pétillante", p: 3 },
  ];
  DB.local[ps] = {
    "ev-salon": { name: "Salon Saveurs du Rhône", place: "Eurexpo · stand B12", from: addDays(t, -1), to: addDays(t, 1), queue: true, items, at: now - 6 * 864e5, uid: "demo-camille", by: "Camille Laurent" },
    "ev-marche": { name: "Marché de Noël des Terreaux", place: "Place des Terreaux · chalet 7", from: addDays(t, 30), to: addDays(t, 32), queue: false,
      items: [{ id: "ev-vinchaud", t: "Vin chaud", p: 4, n: 200 }, { id: "ev-crepe", t: "Crêpe au sucre", p: 3.5 }, { id: "ev-tartiflette", t: "Tartiflette", p: 9, n: 80 }], at: now - 2 * 864e5, uid: "demo-camille", by: "Camille Laurent" },
  };
  const S0 = {}; let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const combos = [[["ev-croque", 1], ["ev-vin", 1]], [["ev-bourgui", 2]], [["ev-planche", 1], ["ev-vin", 2]], [["ev-croque", 2], ["ev-biere", 2]], [["ev-tarte", 1], ["ev-cafe", 1]], [["ev-croque", 1], ["ev-eau", 1]], [["ev-bourgui", 1], ["ev-tarte", 1]], [["ev-vin", 3]], [["ev-planche", 1], ["ev-biere", 1], ["ev-eau", 1]], [["ev-cafe", 2]]];
  const by = (id) => items.find((x) => x.id === id);
  const mk = (day, at, n, k, status) => { const c = combos[k % combos.length]; const its = c.map(([id, q]) => { const x = by(id); return { id, t: x.t, p: x.p, q }; });
    S0[`evs-${day}-${n}`] = { ev: "ev-salon", day, at, n, items: its, total: its.reduce((a, x) => a + x.p * x.q, 0), pay: rnd() < 0.72 ? "carte" : "autre", mode: rnd() < 0.55 ? "emporter" : "place", name: ["", "", "Julie", "Marc", "", "Inès", "", "Paul"][n % 8], status, readyAt: status === "remise" ? at + 4 * 6e4 : null, doneAt: status === "remise" ? at + 6 * 6e4 : null, by: "demo-camille", byName: "Camille Laurent" }; };
  /* yesterday: a full day, 10:00 → 19:00 */
  const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(10, 0, 0, 0);
  for (let i = 0; i < 74; i++) mk(addDays(t, -1), y.getTime() + Math.round((i / 74) * 9 * 36e5 + rnd() * 6e5), i + 1, Math.floor(rnd() * 40), "remise");
  /* today: since 10:00 (or the last 4 h), the last three still to hand over */
  const d0 = new Date(); d0.setHours(10, 0, 0, 0); const start = Math.min(d0.getTime(), now - 4 * 36e5), span = now - 3 * 6e4 - start, N = 46;
  for (let i = 0; i < N; i++) mk(t, start + Math.round((i / N) * span), i + 1, Math.floor(rnd() * 40), i >= N - 3 ? (i === N - 3 ? "prete" : "prep") : "remise");
  const v = S0[`evs-${t}-12`]; if (v) v.void = { at: v.at + 6e4, by: "demo-camille", why: "Erreur de saisie" };
  DB.local[pv] = S0;
}

/* ───────── pieces ───────── */
function evTiles(st) {
  const sold = evSoldMap(st);
  return `<div class="ev-tiles">${(st.items || []).map((it, i) => {
    const left = evLeft(st, it, sold), q = evInCart(it.id), out = left === 0 && !q, low = left != null && left <= 5;
    return `<button class="ev-tile st${out ? " out" : ""}${q ? " in" : ""}" style="--i:${Math.min(i + 3, 12)};--c:${evColor(st, it)}" data-act="evAdd" data-id="${esc(it.id)}"${out ? " disabled aria-disabled=\"true\"" : ""} aria-label="${esc(it.t)}, ${evEur(it.p)}${left != null ? `, il en reste ${left}` : ""}">
      <span class="ev-tn">${esc(it.t)}</span>
      <span class="ev-tf"><b class="mono">${evEur(it.p)}</b>${left != null ? `<em class="${out ? "z" : low ? "low" : ""}">${out ? "Épuisé" : `reste ${left}`}</em>` : ""}</span>
      ${q ? `<i class="ev-tq mono">${q}</i>` : ""}
    </button>`;
  }).join("") || `<p class="sub">Aucun article : touchez « Modifier » pour ajouter ce que vous vendez.</p>`}</div>`;
}
function evCart(st) {
  const n = evCount(), tot = evTotal();
  const lines = EV.cart.map((x, j) => `<li><span class="ev-cq mono">${x.q}</span><span class="ev-cn">${esc(x.t)}</span><b class="mono">${evEur2(x.p * x.q)}</b>
      <span class="ev-cb"><button class="iconbtn sm" data-act="evQty" data-id="${j}" data-v="-1" aria-label="Un ${esc(x.t)} de moins">${ico("minus")}</button><button class="iconbtn sm" data-act="evQty" data-id="${j}" data-v="1" aria-label="Un ${esc(x.t)} de plus">${ico("plus")}</button></span></li>`).join("");
  return `<aside class="ev-cart glass st" style="--i:3">
    <div class="seg ev-mode" role="group" aria-label="Sur place ou à emporter">${[["place", "evSeat", "Sur place"], ["emporter", "evBag", "À emporter"]].map(([k, i, t]) => `<button class="${EV.mode === k ? "on" : ""}" data-act="evMode" data-v="${k}" aria-pressed="${EV.mode === k}">${ico(i)}${t}</button>`).join("")}</div>
    ${n ? `<ul class="ev-lines">${lines}</ul>` : `<div class="ev-cempty">${ico("evTent")}<span><b>Touchez un article</b><em>Il s'ajoute ici. Encore une fois pour en mettre deux.</em></span></div>`}
    ${n && st.queue ? `<label class="ev-who"><span>Prénom</span><input class="input" data-bind="evName" value="${esc(S.evName || "")}" placeholder="Facultatif" maxlength="24" autocomplete="off"></label>` : ""}
    <div class="ev-go">
      ${n ? `<button class="btn ghost sm ev-clear" data-act="evClear">${ico("x")}Vider</button>` : ""}
      <button class="btn acc ev-pay" data-act="evPay"${n ? "" : " disabled"}><span>Encaisser</span><b class="mono">${evEur2(tot)}</b></button>
    </div>
  </aside>`;
}
function evOrderCard(o, i) {
  const rdy = o.status === "prete", its = (o.items || []).map((x) => `<li><b class="mono">${x.q}</b>${esc(x.t)}</li>`).join("");
  return `<article class="ev-oc glass st${rdy ? " rdy" : ""}${EV.fresh.has(o.id) ? " fresh" : ""}" style="--i:${Math.min(i + 3, 12)}">
    <header><b class="ev-num mono">${o.n}</b><span>${o.name ? `<b>${esc(o.name)}</b>` : ""}<em>${o.mode === "emporter" ? `${ico("evBag")}À emporter` : `${ico("evSeat")}Sur place`} · <span class="ev-ago" data-at="${o.at}">${evAgo(o.at)}</span></em></span></header>
    <ul>${its}</ul>
    ${rdy ? `<button class="btn block ev-done" data-act="evStatus" data-id="${esc(o.id)}" data-v="remise">${ico("check")}Remis au client</button>` : `<button class="btn acc block" data-act="evStatus" data-id="${esc(o.id)}" data-v="prete">${ico("evBell")}Prêt</button>`}
  </article>`;
}
function evServe(st) {
  const Q = evQueue(st), prep = Q.filter((o) => o.status === "prep"), rdy = Q.filter((o) => o.status === "prete");
  if (!st.queue) return `<div class="glass ev-calm st" style="--i:3">${ico("evBag")}<div><b>Tout part tout de suite</b><em>Sur ce stand, une vente encaissée est remise aussitôt. Pour préparer avant de remettre, activez « À servir » dans Modifier.</em></div></div>`;
  if (!Q.length) return `<div class="glass ev-calm st" style="--i:3">${ico("evBell")}<div><b>Rien à remettre</b><em>Chaque vente encaissée arrive ici avec son numéro. « Prêt » sonne, « Remis » la range dans le bilan.</em></div></div>`;
  return `<div class="ev-cols"><section><h3 class="lbl st" style="--i:2">À préparer · ${prep.length}</h3>${prep.map(evOrderCard).join("") || `<p class="sub ev-none">Tout est prêt.</p>`}</section>
    <section><h3 class="lbl st" style="--i:2">Prêt, à remettre · ${rdy.length}</h3>${rdy.map(evOrderCard).join("") || `<p class="sub ev-none">Rien n'attend sur le comptoir.</p>`}</section></div>`;
}
/* the figures of one day (o.live: the stand's « Ma journée ») or of the whole event (section « Événements », EV.day "all") */
function evBilan(st, o = {}) {
  const days = [...new Set(evSalesOf(st).map((s) => s.day))].sort().reverse(); if (!days.includes(dayKey()) && evState(st) === "on") days.unshift(dayKey());
  const all = !o.live && days.length > 1 && (EV.day == null || EV.day === "all");
  const day = o.live ? dayKey() : all ? null : EV.day && days.includes(EV.day) ? EV.day : days[0] || dayKey();
  const D = evStats(st, day), sold = evSoldMap(st, day || dayKey());
  let bars;
  if (all) { /* one bar per day of the event */
    const per = {}; D.L.forEach((s) => { per[s.day] = (per[s.day] || 0) + (+s.total || 0); }); const ks = days.slice().reverse(), mx = Math.max(1, ...Object.values(per));
    bars = ks.map((k) => { const v = per[k] || 0; return `<div class="ev-bar" title="${evDayLbl(k)} : ${evEur(v)}"><i style="--h:${Math.round((v / mx) * 100)}%"></i><b class="mono">${evEur(v)}</b><span>${evDayLbl(k)}</span></div>`; }).join("");
  } else {
    const H = Object.keys(D.hours).map(Number); const h0 = H.length ? Math.min(...H) : 10, h1 = H.length ? Math.max(...H) : 18, mx = Math.max(1, ...Object.values(D.hours));
    bars = Array.from({ length: h1 - h0 + 1 }, (_, k) => { const h = h0 + k, v = D.hours[h] || 0; return `<div class="ev-bar" title="${h} h : ${evEur(v)}"><i style="--h:${Math.round((v / mx) * 100)}%"></i><span>${h}h</span></div>`; }).join("");
  }
  const art = D.per.map((r) => { const it = (st.items || []).find((x) => x.id === r.id); const left = !all && it && num(it.n) > 0 ? Math.max(0, num(it.n) - (sold[r.id] || 0)) : null;
    return `<tr><td>${esc(r.t)}</td><td class="mono">${r.q}</td><td class="mono">${evEur2(r.v)}</td>${all ? "" : `<td class="mono${left === 0 ? " z" : ""}">${left == null ? "–" : left === 0 ? "épuisé" : left}</td>`}</tr>`; }).join("");
  const last = all ? "" : evSalesOf(st, day).slice(0, o.live ? 20 : 12).map((s) => `<li class="${s.void ? "void" : ""}"><b class="mono">n° ${s.n}</b><span>${hm(s.at)} · ${(s.items || []).map((x) => `${x.q} ${esc(x.t)}`).join(", ")}${s.void ? ` <em>annulée · ${esc(s.void.why || "")}</em>` : ""}</span><b class="mono">${evEur2(s.total)}</b><i class="ev-pm">${s.pay === "carte" ? ico("evCard") : ico("evCoins")}</i>${s.void || evLocked() ? "" : `<button class="iconbtn sm" data-act="evVoid" data-id="${esc(s.id)}" aria-label="Annuler la vente n° ${s.n}">${ico("evUndo")}</button>`}</li>`).join("");
  const lbl = all ? "chiffre de l'événement" : day === dayKey() ? "chiffre du jour" : "chiffre de la journée";
  return `${!o.live && days.length > 1 ? `<div class="chips ev-days st" style="--i:2">${[["all", "Tout l'événement"], ...days.map((k) => [k, evDayLbl(k)])].map(([k, t]) => `<button class="chip${(all ? "all" : day) === k ? " on" : ""}" data-act="evDay" data-v="${k}" aria-pressed="${(all ? "all" : day) === k}">${t}</button>`).join("")}</div>` : ""}
    <div class="ev-kpi st" style="--i:3"><div class="big"><b class="mono">${evEur2(D.tot)}</b><span>${lbl}</span></div><div><b class="mono">${D.n}</b><span>ventes</span></div><div><b class="mono">${evEur2(D.avg)}</b><span>panier moyen</span></div><div><b class="mono">${evEur2(D.card)}</b><span>${ico("evCard")}carte</span></div><div><b class="mono">${evEur2(D.other)}</b><span>${ico("evCoins")}espèces, autres</span></div></div>
    <div class="ev-bgrid">
      <section class="glass ev-sec st" style="--i:4"><header><b class="h3">Par article</b><span class="sub">${D.out} à emporter</span></header>${art ? `<table class="ev-tab"><thead><tr><th>Article</th><th>Vendus</th><th>Montant</th>${all ? "" : "<th>Reste</th>"}</tr></thead><tbody>${art}</tbody></table>` : `<p class="sub">Pas encore de vente.</p>`}</section>
      <section class="glass ev-sec st" style="--i:5"><header><b class="h3">${all ? "Par jour" : "Par heure"}</b></header><div class="ev-bars${all ? " days" : ""}">${bars}</div></section>
      ${all ? "" : `<section class="glass ev-sec ev-last st" style="--i:6"><header><b class="h3">${o.live ? "Ventes du jour" : "Dernières ventes"}</b>${D.voids ? `<span class="sub">${D.voids} annulée${D.voids > 1 ? "s" : ""}</span>` : ""}</header>${last ? `<ul>${last}</ul>` : `<p class="sub">Les ventes de la journée s'affichent ici.</p>`}</section>`}
    </div>
    ${o.live ? "" : `<button class="btn soft block st" style="--i:7" data-act="evCsv" data-v="${all ? "all" : day}">${ico("evExport")}Exporter les ventes ${all ? "de l'événement" : "de la journée"} (CSV)</button>`}
    <p class="ev-fine st" style="--i:8">${o.live ? "Le bilan complet est dans Événements, sur la case de l'événement. " : ""}Pas une caisse enregistreuse : la carte passe sur votre terminal, les espèces se notent sur votre caisse ou votre carnet.</p>`;
}
function evIntro() {
  return `<section class="glass ev-hero st" style="--i:1">
    <span class="ev-hi">${ico("evTent")}</span>
    <h2 class="h2">Un salon, une foire, un marché ?</h2>
    <p class="sub">Une caisse de stand à part, plein écran : de grosses tuiles, le panier, le rendu monnaie, les plateaux à remettre. Rien ne se mélange avec le service du restaurant, et chaque événement garde son bilan dans sa propre case.</p>
    <ol class="ev-steps"><li><b>1</b>Nommez l'événement et ses dates</li><li><b>2</b>Choisissez ce que vous vendez, avec les prix</li><li><b>3</b>Ouvrez la caisse sur le téléphone ou la tablette du stand</li></ol>
    <button class="btn acc block" data-act="evEdit">${ico("plus")}Préparer un événement</button>
  </section>`;
}

/* ───────── the section « Événements »: one card per event, each with its own figures ───────── */
function evCard(st, i) {
  const k = evState(st), A = evStats(st, null), T = evStats(st, dayKey()), nd = new Set(A.L.map((x) => x.day)).size;
  const stl = k === "on" ? "En cours" : k === "soon" ? "À venir" : "Terminé";
  const figs = k === "soon" && !A.n ? `<span class="ev-cf soft">${(st.items || []).length} article${(st.items || []).length > 1 ? "s" : ""} prêt${(st.items || []).length > 1 ? "s" : ""}</span>`
    : `<span class="ev-cf"><b class="mono">${evEur(A.tot)}</b>${A.n} vente${A.n > 1 ? "s" : ""}${nd > 1 ? ` · ${nd} jours` : ""}</span>${k === "on" ? `<span class="ev-cf"><b class="mono">${evEur(T.tot)}</b>aujourd'hui</span>` : ""}`;
  return `<article class="ev-card glass st ${k}" style="--i:${Math.min(i + 3, 12)}" data-act="evOpen" data-id="${esc(st.id)}" role="button" tabindex="0" aria-label="${esc(st.name)}, ${stl}">
    <div class="ev-ct"><span class="ev-hi sm">${ico("evTent")}</span><span class="ev-cn"><b>${esc(st.name || "Événement")}</b><em>${[st.place, evRange(st)].filter(Boolean).map(esc).join(" · ")}</em></span><i class="ev-st ${k === "on" ? "on" : k === "soon" ? "soon" : ""}">${stl}</i></div>
    <div class="ev-cfs">${figs}</div>
    ${k !== "done" && !evLocked() ? `<button class="btn ${k === "on" ? "acc" : "soft"} block ev-golive" data-act="evGoLive" data-id="${esc(st.id)}">${ico("evPlay")}Ouvrir la caisse du stand</button>` : ""}
  </article>`;
}
function evList() {
  const L = (EV.stands || []).slice(), t = dayKey();
  const on = L.filter((s) => evState(s, t) === "on").sort((a, b) => String(a.from).localeCompare(String(b.from)));
  const soon = L.filter((s) => evState(s, t) === "soon").sort((a, b) => String(a.from).localeCompare(String(b.from)));
  const done = L.filter((s) => evState(s, t) === "done").sort((a, b) => String(b.to || b.from).localeCompare(String(a.to || a.from)));
  const yr = String(new Date().getFullYear()), ofYr = L.filter((s) => String(s.from || "").slice(0, 4) === yr), tot = ofYr.reduce((a, s) => a + evStats(s, null).tot, 0);
  let i = 0; const grp = (t, A) => A.length ? `<h3 class="lbl st" style="--i:${Math.min(i + 2, 12)}">${t} · ${A.length}</h3><div class="ev-cards">${A.map((s) => evCard(s, i++)).join("")}</div>` : "";
  return `<p class="sub ev-lead st" style="--i:1">Chaque événement a sa caisse à part et sa propre case : ses ventes ne passent jamais dans le service du restaurant.</p>
    ${ofYr.length ? `<div class="ev-sum glass st" style="--i:2"><span><b class="mono">${evEur(tot)}</b>sur les événements de ${yr}</span><span><b class="mono">${ofYr.length}</b>événement${ofYr.length > 1 ? "s" : ""}</span></div>` : ""}
    ${grp("En cours", on)}${grp("À venir", soon)}${grp("Terminés", done)}`;
}
/* one event's own report: whole event or day by day */
function evDetail(st) {
  const k = evState(st), stl = k === "on" ? "En cours" : k === "soon" ? "À venir" : "Terminé";
  return `<header class="ev-head glass st" style="--i:1"><span class="ev-hi sm">${ico("evTent")}</span><div class="ev-ht"><b>${esc(st.name || "Événement")}</b><em>${[st.place, evRange(st)].filter(Boolean).map(esc).join(" · ")}</em></div><i class="ev-st ${k === "on" ? "on" : k === "soon" ? "soon" : ""}">${stl}</i>
      ${evLocked() ? "" : `<div class="ev-ha">${k !== "done" ? `<button class="btn acc sm" data-act="evGoLive" data-id="${esc(st.id)}">${ico("evPlay")}Ouvrir la caisse</button>` : ""}<button class="btn soft sm" data-act="evEdit" data-id="${esc(st.id)}">Modifier</button>${k !== "done" && typeof esDevLaunch === "function" ? `<button class="btn ghost sm" data-act="evLaunch" data-id="${esc(st.id)}" title="Un téléphone ou une tablette qui ne montre que la caisse, verrouillé par votre code">Appareil du stand</button>` : ""}</div>`}</header>
    ${evSalesOf(st).length ? evBilan(st) : `<div class="glass ev-calm st" style="--i:2">${ico("evCard")}<div><b>Pas encore de vente</b><em>Ouvrez la caisse du stand le jour J : chaque vente arrive ici, dans le bilan de cet événement.</em></div></div>`}`;
}

/* ───────── the stand's till: a full-screen mini-interface ───────── */
function evTill(st, kiosk) {
  const T = evStats(st), Q = evQueue(st), tabs0 = EV_TABS.filter(([k]) => k !== "servir" || st.queue), tab = tabs0.some((t) => t[0] === EV.tab) ? EV.tab : "vendre";
  const head = `<header class="ev-lhead st" style="--i:0"><span class="ev-hi sm">${ico("evTent")}</span><div class="ev-ht"><b>${esc(st.name || "Événement")}</b><em><span class="mono" id="evClock">${hm(Date.now())}</span>${st.place ? ` · ${esc(st.place)}` : ""}</em></div>
      <div class="ev-hk"><span><b class="mono">${evEur(T.tot)}</b>aujourd'hui</span><span><b class="mono">${T.n}</b>ventes</span></div>
      ${kiosk ? "" : `<button class="btn soft sm ev-close" data-act="evLiveEnd">${ico("x")}<span>Fermer la caisse</span></button>`}</header>`;
  const tabs = tabs0.length > 1 ? `<div class="seg ev-segs st" style="--i:1" role="tablist">${tabs0.map(([k, t]) => `<button role="tab" class="${tab === k ? "on" : ""}" data-act="evTab" data-v="${k}" aria-selected="${tab === k}">${t}${k === "servir" && Q.length ? ` <i class="ev-badge mono">${Q.length}</i>` : ""}</button>`).join("")}</div>` : "";
  const body = tab === "vendre" ? `<div class="ev-sell">${evTiles(st)}${evCart(st)}</div>` : tab === "servir" ? evServe(st) : evBilan(st, { live: true });
  return `<div class="inner wide ev ev-tl${kiosk ? " kiosk" : ""}">${head}${tabs}${body}</div>`;
}

VIEWS.evenement = {
  render() {
    evWatch();
    const kiosk = evOnStand();
    if (EV.stands == null) return `<div class="inner wide ev">${topBar("Événements")}<div class="glass ev-calm st" style="--i:1">${ico("evTent")}<div><b>Ouverture…</b></div></div></div>`;
    const live = evLiveStand(); if (live) return evTill(live, kiosk);
    if (EV.live) evLiveSet(null); /* its event was deleted */
    const id = S.params && S.params.id, st = id && (EV.stands || []).find((x) => x.id === id);
    if (st) return `<div class="inner wide ev">${topBar(esc(st.name || "Événement"), { noBig: true })}${evDetail(st)}</div>`;
    const add = evLocked() ? "" : `<button class="btn acc sm ev-new" data-act="evEditNew">${ico("plus")}<span>Préparer un événement</span></button>`;
    return `<div class="inner wide ev">${topBar("Événements", { right: (EV.stands || []).length ? add : "", noBig: true })}${(EV.stands || []).length ? evList() : evIntro()}</div>`;
  },
  after(v) {
    evChrome();
    clearInterval(EV.tick);
    EV.tick = setInterval(() => {
      if (S.route !== "evenement") { clearInterval(EV.tick); EV.tick = null; return; }
      const c = document.getElementById("evClock"); if (c) c.textContent = hm(Date.now());
      $$(".ev-ago[data-at]").forEach((el) => { el.textContent = evAgo(+el.dataset.at); });
    }, 15000);
    if (EV.fresh.size) setTimeout(() => EV.fresh.clear(), 2600);
  },
};
/* the till hides the app around it (menu, tab bar, back, grand écran, the restaurant's call pill); leaving the route gives it back */
(function evChromeHook() {
  const rc0 = window.renderChrome; if (typeof rc0 !== "function") return;
  window.renderChrome = function () { rc0.apply(this, arguments); evChrome(); };
})();
/* while the till is open, the restaurant's own pop-ups (table calls, QR orders, plates ready in the dining room) stay quiet on it:
   they still reach the alert bell and the other devices. The stand's own messages (default and error toasts) go through. */
(function evQuietToasts() {
  const t0 = window.toast; if (typeof t0 !== "function") return;
  window.toast = function (msg, kind) { if (kind === "info" && window.evLiveOn() && !EV.say) return; return t0.apply(this, arguments); };
})();

/* ───────── sheets ───────── */
function evPaySheet() {
  const tot = evTotal(), P = EV.pay;
  if (P === "autre") {
    const g = EV.given, back = Math.round((g - tot) * 100) / 100;
    const notes = [...new Set([Math.ceil(tot), Math.ceil(tot / 5) * 5, Math.ceil(tot / 10) * 10, Math.ceil(tot / 20) * 20, 50, 100].filter((x) => x >= tot))].sort((a, b) => a - b).slice(0, 5);
    return openSheet(`<div class="ev-sheet">
      <span class="lbl">Espèces · à encaisser</span><b class="ev-stot mono">${evEur2(tot)}</b>
      <span class="lbl">Le client donne</span>
      <div class="ev-notes">${notes.map((x) => `<button class="chip${g === x ? " on" : ""}" data-act="evGiven" data-v="${x}">${x === tot ? "Le compte" : evEur(x)}</button>`).join("")}</div>
      <label class="field"><span>Autre montant</span><input class="input mono" id="evGivenIn" inputmode="decimal" placeholder="0,00" value="${g && !notes.includes(g) ? String(g).replace(".", ",") : ""}"></label>
      <div class="ev-back${g >= tot ? " on" : ""}" id="evBack"><span>À rendre</span><b class="mono">${g >= tot ? evEur2(back) : "–"}</b></div>
      <button class="btn acc block" data-act="evPaid" data-v="autre">${ico("check")}C'est réglé</button>
      <button class="btn ghost block" data-act="evPayBack">Revenir</button>
      <p class="ev-fine">Notez les espèces sur votre caisse ou votre carnet : l'app compte la vente, elle n'est pas une caisse enregistreuse.</p>
    </div>`, (b) => { const i = $("#evGivenIn", b); if (i) i.addEventListener("input", () => { EV.given = num(i.value) || 0; const r = $("#evBack", b); const ok = EV.given >= tot; r.classList.toggle("on", ok); $("b", r).textContent = ok ? evEur2(EV.given - tot) : "–"; $$(".ev-notes .chip", b).forEach((c) => c.classList.remove("on")); }); });
  }
  openSheet(`<div class="ev-sheet">
    <span class="lbl">${evCount()} article${evCount() > 1 ? "s" : ""} · ${EV.mode === "emporter" ? "à emporter" : "sur place"}</span><b class="ev-stot mono">${evEur2(tot)}</b>
    <div class="ev-pms">
      <button class="ev-pmb" data-act="evPaid" data-v="carte">${ico("evCard")}<b>Carte</b><em>Passez ${evEur2(tot)} sur votre terminal, puis touchez ici</em></button>
      <button class="ev-pmb" data-act="evPayCash">${ico("evCoins")}<b>Espèces</b><em>Avec le rendu monnaie</em></button>
    </div>
    <button class="btn ghost block" data-act="closeSheet">Pas encore</button>
  </div>`);
}
function evEditSheet(id) {
  const st = id ? (EV.stands || []).find((x) => x.id === id) : null; const t = dayKey();
  if (!S.evF || S.evF.id !== (id || "")) S.evF = st ? { id, name: st.name || "", place: st.place || "", from: st.from || t, to: st.to || st.from || t, queue: st.queue !== false, items: (st.items || []).map((x) => ({ ...x, p: String(x.p).replace(".", ","), n: x.n != null ? String(x.n) : "" })) }
    : { id: "", name: "", place: "", from: t, to: t, queue: true, items: [] };
  const F = S.evF;
  const dishes = (typeof cmDishes === "function" ? cmDishes() : []).filter((n) => num(n.price) > 0 && !F.items.some((x) => x.noteId === n.id)).slice(0, 24);
  const row = (x, j) => `<div class="ev-er"><input class="input" data-bind="evF.items.${j}.t" value="${esc(x.t)}" placeholder="Article" aria-label="Article"><input class="input mono" data-bind="evF.items.${j}.p" value="${esc(x.p)}" inputmode="decimal" placeholder="Prix €" aria-label="Prix en euros"><input class="input mono" data-bind="evF.items.${j}.n" value="${esc(x.n || "")}" inputmode="numeric" placeholder="Qté" aria-label="Quantité apportée par jour"><button class="iconbtn sm" data-act="evItemDel" data-v="${j}" aria-label="Retirer ${esc(x.t || "l'article")}">${ico("x")}</button></div>`;
  openSheet(`<div class="ev-sheet ev-edit">
    <h2 class="h2">${st ? "Modifier l'événement" : "Préparer un événement"}</h2>
    <label class="field"><span>Nom</span><input class="input" data-bind="evF.name" value="${esc(F.name)}" placeholder="Salon des vins, marché de Noël…" maxlength="60"></label>
    <label class="field"><span>Lieu, stand</span><input class="input" data-bind="evF.place" value="${esc(F.place)}" placeholder="Eurexpo · stand B12" maxlength="60"></label>
    <div class="ev-2"><label class="field"><span>Du</span><input class="input" type="date" data-bind="evF.from" value="${esc(F.from)}"></label><label class="field"><span>Au</span><input class="input" type="date" data-bind="evF.to" value="${esc(F.to)}"></label></div>
    <button class="ev-tog${F.queue ? " on" : ""}" data-act="evQueueTog" aria-pressed="${F.queue}"><span><b>Préparer avant de remettre</b><em>Les ventes passent par « À servir » avec un numéro. Sinon, elles sont remises tout de suite.</em></span><i></i></button>
    <span class="lbl">Ce que vous vendez</span>
    <p class="sub">Prix TTC. La quantité est ce que vous apportez par jour : la tuile montre ce qu'il reste. Laissez vide pour ne pas compter.</p>
    <div class="ev-ers" id="evErs">${F.items.map(row).join("") || `<p class="sub ev-none">Pas encore d'article.</p>`}</div>
    <button class="btn soft sm" data-act="evItemAdd">${ico("plus")}Ajouter un article</button>
    ${dishes.length ? `<span class="lbl">Depuis votre carte</span><div class="chips ev-from">${dishes.map((n) => `<button class="chip" data-act="evItemDish" data-id="${esc(n.id)}">${ico("plus")}${esc(n.title)} · ${evEur(num(n.price))}</button>`).join("")}</div>` : ""}
    <button class="btn acc block" data-act="evSave">${ico("check")}${st ? "Enregistrer" : "Créer l'événement"}</button>
    ${st ? `<button class="btn ghost block ev-del" data-act="evDel" data-id="${esc(st.id)}">Supprimer l'événement</button>` : ""}
  </div>`);
}
const evRepaintEdit = () => { const s = $("#sheetBody"); const top = s ? s.scrollTop : 0; evEditSheet(S.evF.id || null); if (s) s.scrollTop = top; };

/* ───────── actions ───────── */
async function evPaid(pay) {
  const st = evCur(); if (!st || !EV.cart.length) return;
  const day = dayKey(), n = 1 + Math.max(0, ...evSalesOf(st, day).map((s) => +s.n || 0)), tot = evTotal();
  const doc = { ev: st.id, day, at: Date.now(), n, items: EV.cart.map((x) => ({ id: x.id, t: x.t, p: x.p, q: x.q })), total: tot, pay, mode: EV.mode, name: String(S.evName || "").trim().slice(0, 24),
    status: st.queue ? "prep" : "remise", by: S.me.id, byName: (typeof esActorName === "function" && esActorName()) || S.me.name || "" };
  if (!st.queue) doc.doneAt = doc.at;
  closeSheet(true); SFX.done(); buzz([12, 30, 12]); try { const b = $(".ev-pay"); if (b) { const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); } } catch (e) {}
  EV.cart = []; S.evName = ""; EV.pay = null; EV.given = 0;
  const id = await safe(DB.add("evSales", doc)); if (id) EV.fresh.add(typeof id === "string" ? id : "");
  toast(`Vente n° ${n} · ${evEur2(tot)}${st.queue ? " · à préparer" : ""}`);
  rerender();
}
Object.assign(ACT, {
  evTab: (a, id, v) => { if (EV.tab === v) return; EV.tab = v; SFX.tick(); buzz(5); rerender(); },
  evAdd: (a, id) => {
    const st = evCur(); const it = st && (st.items || []).find((x) => x.id === id); if (!it) return;
    if (evLeft(st, it) === 0) { SFX.err(); toast(`${it.t} : épuisé`, "err"); return; }
    const L = EV.cart.find((x) => x.id === id); if (L) L.q++; else EV.cart.push({ id, t: it.t, p: +num(it.p) || 0, q: 1 });
    SFX.tick(); buzz(6); a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); rerender();
  },
  evQty: (a, id, v) => { const L = EV.cart[+id]; if (!L) return; if (+v > 0) { const st = evCur(), it = st && (st.items || []).find((x) => x.id === L.id); if (it && evLeft(st, it) === 0) { SFX.err(); toast(`${L.t} : épuisé`, "err"); return; } } L.q += +v; if (L.q <= 0) EV.cart.splice(+id, 1); SFX.tick(); buzz(5); rerender(); },
  evClear: () => { EV.cart = []; S.evName = ""; SFX.close(); rerender(); },
  evMode: (a, id, v) => { EV.mode = v === "emporter" ? "emporter" : "place"; SFX.tick(); buzz(5); rerender(); },
  evPay: () => { if (!EV.cart.length) return; EV.pay = null; EV.given = 0; evPaySheet(); },
  evPayCash: () => { EV.pay = "autre"; EV.given = 0; SFX.tick(); evPaySheet(); },
  evPayBack: () => { EV.pay = null; SFX.tick(); evPaySheet(); },
  evGiven: (a, id, v) => { EV.given = +v || 0; SFX.tick(); buzz(4); evPaySheet(); },
  evPaid: (a, id, v) => evPaid(v === "carte" ? "carte" : "autre"),
  evStatus: async (a, id, v) => {
    const o = (EV.sales || []).find((x) => x.id === id); if (!o) return;
    const card = a.closest(".ev-oc"); if (card) card.classList.add("go");
    EV.fresh.add("me" + id); if (v === "prete") evChime(); else { SFX.done(); buzz([10, 30, 10]); }
    const patch = v === "prete" ? { status: "prete", readyAt: Date.now() } : { status: "remise", doneAt: Date.now() };
    setTimeout(async () => { await safe(DB.update("evSales", id, patch)); toast(v === "prete" ? `n° ${o.n} prêt${o.name ? ` : appelez ${o.name}` : ""}` : `n° ${o.n} remis`); rerender(); }, card ? 260 : 0);
  },
  evDay: (a, id, v) => { EV.day = v; SFX.tick(); rerender(); },
  evVoid: (a, id) => {
    const o = (EV.sales || []).find((x) => x.id === id); if (!o) return;
    openSheet(`<div class="ev-sheet"><h2 class="h2">Annuler la vente n° ${o.n} ?</h2><p class="sub">${evEur2(o.total)} · ${hm(o.at)}. Elle reste visible, barrée, et ne compte plus dans le bilan.</p>
      <span class="lbl">Pourquoi</span><div class="ev-notes">${EV_VOID.map((w) => `<button class="chip" data-act="evVoidGo" data-id="${esc(id)}" data-v="${esc(w)}">${esc(w)}</button>`).join("")}</div>
      <button class="btn ghost block" data-act="closeSheet">Garder la vente</button></div>`);
  },
  evVoidGo: async (a, id, v) => { const o = (EV.sales || []).find((x) => x.id === id); if (!o) return; closeSheet(true); SFX.ok(); await safe(DB.update("evSales", id, { void: { at: Date.now(), by: S.me.id, why: v } })); logEvent("evenement", `Vente n° ${o.n} annulée (${evEur2(o.total)}) : ${v}`); toast(`Vente n° ${o.n} annulée`); rerender(); },
  evCsv: (a, id, v) => {
    const st = evShown(); if (!st) return; const L = evSalesOf(st, v === "all" ? null : v);
    const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const rows = [["Numéro", "Date", "Heure", "Articles", "Total TTC", "Paiement", "Mode", "Prénom", "Annulée"].join(";"), ...L.slice().reverse().map((s) => [s.n, s.day, hm(s.at), q((s.items || []).map((x) => `${x.q} × ${x.t}`).join(", ")), String((+s.total || 0).toFixed(2)).replace(".", ","), s.pay === "carte" ? "Carte" : "Espèces / autre", s.mode === "emporter" ? "À emporter" : "Sur place", q(s.name || ""), s.void ? q(s.void.why || "oui") : ""].join(";"))];
    try { const b = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = `ventes-${String(st.name || "evenement").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-${v === "all" ? "tout" : v}.csv`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); SFX.ok(); toast(`${L.length} ventes exportées`); } catch (e) { SFX.err(); toast("Export impossible sur cet appareil", "err"); }
  },
  evPick: () => {
    const t = dayKey(), cur = evCur();
    openSheet(`<div class="ev-sheet"><h2 class="h2">Vos événements</h2><div class="ev-picks">${(EV.stands || []).slice().sort((a, b) => String(b.from || "").localeCompare(String(a.from || ""))).map((s) => { const on = s.from <= t && (s.to || s.from) >= t, soon = s.from > t;
      return `<button class="ev-pk${cur && cur.id === s.id ? " on" : ""}" data-act="evPickGo" data-id="${esc(s.id)}"><span class="ev-hi sm">${ico("evTent")}</span><span><b>${esc(s.name)}</b><em>${[s.place, evRange(s)].filter(Boolean).map(esc).join(" · ")}</em></span><i class="ev-st ${on ? "on" : soon ? "soon" : ""}">${on ? "En cours" : soon ? "À venir" : "Terminé"}</i></button>`; }).join("")}</div>
      <button class="btn soft block" data-act="evEditNew">${ico("plus")}Préparer un autre événement</button></div>`);
  },
  evPickGo: (a, id) => { EV.sel = id; EV.cart = []; EV.day = null; closeSheet(); SFX.ok(); rerender(); },
  evOpen: (a, id) => { if (!(EV.stands || []).some((x) => x.id === id)) return; EV.day = null; SFX.tap ? SFX.tap() : SFX.tick(); go("evenement", { id }); },
  /* open the stand's till on this device: full screen, nothing else */
  evGoLive: (a, id) => {
    const st = (EV.stands || []).find((x) => x.id === id); if (!st) return;
    evLiveSet(id); EV.sel = id; EV.cart = []; EV.tab = "vendre"; S.evName = ""; SFX.ok(); buzz([8, 30, 8]);
    go("evenement", {}, { replace: true }); S.history = (S.history || []).filter((h) => h.route !== "evenement");
    setTimeout(() => toast(`Caisse ouverte : ${st.name}`), 350);
  },
  evLiveEnd: () => {
    const st = evLiveStand(); if (!st) return; const T = evStats(st), Q = evQueue(st);
    openSheet(`<div class="ev-sheet"><h2 class="h2">Fermer la caisse ?</h2>
      <p class="sub">Les chiffres de la journée partent dans la case « ${esc(st.name)} » des Événements. Vous pourrez la rouvrir quand vous voulez.</p>
      <div class="ev-kpi"><div class="big"><b class="mono">${evEur2(T.tot)}</b><span>aujourd'hui</span></div><div><b class="mono">${T.n}</b><span>ventes</span></div><div><b class="mono">${evEur2(T.card)}</b><span>${ico("evCard")}carte</span></div><div><b class="mono">${evEur2(T.other)}</b><span>${ico("evCoins")}espèces, autres</span></div></div>
      ${Q.length ? `<p class="ev-warn">${ico("evBell")}${Q.length} commande${Q.length > 1 ? "s" : ""} pas encore remise${Q.length > 1 ? "s" : ""} : elle${Q.length > 1 ? "s" : ""} reste${Q.length > 1 ? "nt" : ""} dans Commandes à la réouverture.</p>` : ""}
      ${EV.cart.length ? `<p class="ev-warn">${ico("evBag")}Le panier en cours (${evEur2(evTotal())}) sera vidé.</p>` : ""}
      <button class="btn acc block" data-act="evLiveEndGo" data-id="${esc(st.id)}">${ico("check")}Fermer et voir le bilan</button>
      <button class="btn ghost block" data-act="closeSheet">Rester sur la caisse</button></div>`);
  },
  evLiveEndGo: (a, id) => {
    closeSheet(true); evLiveSet(null); EV.cart = []; S.evName = ""; EV.day = null; SFX.done(); buzz([10, 30, 10]);
    logEvent("evenement", `Caisse du stand fermée : ${((EV.stands || []).find((x) => x.id === id) || {}).name || ""}`);
    go("evenement", { id }, { replace: true }); evChrome();
  },
  evEdit: (a, id) => { S.evF = null; evEditSheet(id || null); },
  evEditNew: () => { S.evF = null; evEditSheet(null); },
  evQueueTog: () => { S.evF.queue = !S.evF.queue; SFX.tick(); evRepaintEdit(); },
  evItemAdd: () => { S.evF.items.push({ id: "it" + rid6().toLowerCase() + Date.now().toString(36).slice(-3), t: "", p: "", n: "" }); SFX.tick(); evRepaintEdit(); setTimeout(() => { const L = $$("#evErs .ev-er"); const i = L.length && $("input", L[L.length - 1]); if (i) i.focus(); }, 60); },
  evItemDel: (a, id, v) => { S.evF.items.splice(+v, 1); SFX.close(); evRepaintEdit(); },
  evItemDish: (a, id) => { const n = (S.notes || []).find((x) => x.id === id); if (!n) return; S.evF.items.push({ id: "it-" + id, noteId: id, t: n.title || "", p: String(num(n.price) || "").replace(".", ","), n: "" }); SFX.tick(); evRepaintEdit(); },
  evSave: async () => {
    const F = S.evF; const name = String(F.name || "").trim();
    if (!name) { SFX.err(); toast("Donnez un nom à l'événement", "err"); return; }
    const items = F.items.map((x) => ({ id: x.id, t: String(x.t || "").trim().slice(0, 40), p: num(x.p), n: num(x.n), ...(x.noteId ? { noteId: x.noteId } : {}) })).filter((x) => x.t && x.p != null && x.p >= 0).map((x) => ({ id: x.id, t: x.t, p: Math.round(x.p * 100) / 100, ...(x.n > 0 ? { n: Math.round(x.n) } : {}), ...(x.noteId ? { noteId: x.noteId } : {}) }));
    if (!items.length) { SFX.err(); toast("Ajoutez au moins un article avec son prix", "err"); return; }
    const from = F.from || dayKey(), to = F.to && F.to >= from ? F.to : from;
    const doc = { name: name.slice(0, 60), place: String(F.place || "").trim().slice(0, 60), from, to, queue: !!F.queue, items };
    closeSheet(true); SFX.ok(); buzz(8);
    if (F.id) { await safe(DB.update("evStands", F.id, doc)); toast("Événement enregistré"); }
    else { const id = await safe(DB.add("evStands", { ...doc, at: Date.now(), uid: S.me.id, by: S.me.name || "" })); logEvent("evenement", `Événement préparé : ${doc.name}`); toast("Événement prêt : ouvrez sa caisse le jour J"); EV.tab = "vendre"; S.evF = null;
      if (id && typeof id === "string" && !evLiveStand()) { EV.sel = id; EV.day = null; go("evenement", { id }); return; } }
    S.evF = null; rerender();
  },
  evDel: (a, id) => {
    const st = (EV.stands || []).find((x) => x.id === id); if (!st) return; const n = evSalesOf(st).length;
    openSheet(`<div class="ev-sheet"><h2 class="h2">Supprimer « ${esc(st.name)} » ?</h2><p class="sub">${n ? `Ses ${n} ventes restent dans l'historique, mais l'événement ne s'affichera plus.` : "Il n'a encore aucune vente."}</p>
      <button class="btn danger block" data-act="evDelGo" data-id="${esc(id)}">Supprimer</button><button class="btn ghost block" data-act="closeSheet">Garder</button></div>`);
  },
  evDelGo: async (a, id) => { closeSheet(true); SFX.close(); EV.sel = null; S.evF = null; if (EV.live === id) evLiveSet(null); await safe(DB.del("evStands", id)); toast("Événement supprimé"); if (S.params && S.params.id === id) go("evenement", {}, { replace: true }); else rerender(); },
  evLaunch: (a, id, v, e) => { if (typeof esDevLaunch !== "function") return; if (id) EV.sel = id; ES.devDraft = { kind: "partage", station: "evenement" }; esDevLaunch(e); },
});

/* ───────── the stand's device, in Vues & appareils (js/espaces.js) ───────── */
(function evStation() {
  if (typeof ES_ST === "undefined" || ES_ST.evenement) return;
  ES_ST.evenement = { ic: "evTent", t: "Stand d'événement", dev: "Téléphone ou tablette du stand", route: "evenement", kiosk: true, mk: "ev",
    d: "Vendre, remettre les commandes, le bilan : seulement ce qu'il faut sur un salon ou une foire.",
    sees: ["Les articles du stand en grosses tuiles, le panier et l'encaissement", "Les commandes à remettre, avec leur numéro", "Le bilan de la journée"],
    hides: ["La pointeuse, le stock, l'équipe, les réglages et tout le reste de l'app"], exit: "le cadenas en bas de l'écran, puis le code du gérant" };
  if (typeof ES_ST_ORDER !== "undefined" && !ES_ST_ORDER.includes("evenement")) ES_ST_ORDER.push("evenement");
  if (typeof ES_DEVICES !== "undefined" && !ES_DEVICES.some((x) => x[0] === "evenement")) ES_DEVICES.push(["evenement", "evTent", ES_ST.evenement.dev, ES_ST.evenement.d]);
  if (typeof esMock === "function") { const mk0 = esMock; esMock = function (k) { return k === "ev" ? `<span class="es-mk sc ev-mk"><span class="mk-main"><span class="mk-g4"><i></i><i></i><i></i><i></i></span><span class="mk-pay"></span></span></span>` : mk0(k); }; }
})();
