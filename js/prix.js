/* Growth Gusto — area: prix dynamiques (route « prix »). Prefix « px ».
   Three things, one screen:
   1) Happy hour automatique : the gérant sets days, hours, a discount and what it applies to (sections of the carte or chosen dishes).
      During those hours the QR menu shows the old price struck through, a « Happy hour » tag and a banner with the end time; the
      server (functions/src/commande.js) charges the same price, the waiter's order-taking (js/salle.js) too. Nothing to switch on/off.
   2) Plat du jour anti-gaspi : dishes that use a product whose DLC is close (lots of js/labels.js) or a prepared batch that must go
      today are suggested every morning, with what is at risk. One tap puts one in « Plat du jour » at a discount (or the app picks it
      alone each morning). The discount never pushes the food cost above the floor the gérant set (default 40 %).
   3) Alertes de marge : when a supplier raises a price (S.prices from js/marge.js invoices / receptions), every dish it hurts gets an
      alert with the margin lost per plate and per month, the supplier, and the price that gives the margin back (one tap).
      Alerts also go to the alert centre (ALERTES.push, type « marge »).
   Data: restos/{rid}/prix/cfg = { hh:[{ id, on, t, days:[0-6], from:"HH:MM", to:"HH:MM", pct, secs:[sectionId], ids:[noteId] }],
                                   jour:{ auto, pct, horizon }, today:{ day, noteId, pct, why, auto, at, by } | null,
                                   floor (food cost max under a promo, %), alert:{ tol (pts above target), drop (% of margin lost) },
                                   done:{ alertKey: { at, by, act } } }
   Public projection (js/commande.js cmPubDoc → restos/{rid}/public/menu.promos, never a cost price):
     [{ id, k:"hh"|"jour", t, days:[0-6], day?, from?, to?, it:{ itemId: pct } }]  (pct already capped by the margin floor)
   The rule « is a promo running now » is the same three lines in the app (pxDeal), the public page and the server. */
"use strict";

TAB_OF.prix = "more";
Object.assign(IC, {
  pxTag: ["f:M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z", "M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z", "M8.2 15.8 15.8 8.2", "c:9.6,9.6,1.1", "c:14.4,14.4,1.1"],
  pxGlass: ["f:M6 3.5h12l-1.2 7.2a4.9 4.9 0 0 1-9.6 0z", "M6 3.5h12l-1.2 7.2a4.9 4.9 0 0 1-9.6 0z", "M12 15.6V20.5", "M8.5 20.5h7", "M6.6 7.5h10.8"],
  pxPlate: ["c:12,12.5,8.5", "f:M12 7.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z", "c:12,12.5,5", "M4 4v4a1.5 1.5 0 0 0 3 0V4", "M5.5 8v12"],
  pxDrop: ["M4 7l6 6 4-4 6 7", "M15 16h5v-5"],
  pxPulse: ["M3 12h4l2.5-6 5 12 2.5-6h4"],
  pxTimer: ["c:12,13.5,7.5", "f:M12 6a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z", "M12 13.5V9.75", "m12 13.5 2.25 1.5", "M10 2.75h4"],
});

/* side nav: right after « Factures fournisseurs » (no edit of the shared NAV list); « Plus » copies NAV (js/compte.js) */
(function pxNav() {
  if (NAV.some((n) => n[0] === "prix")) return;
  const i = NAV.findIndex((n) => n[0] === "factures"); const j = NAV.findIndex((n) => n[0] === "marges");
  NAV.splice(i >= 0 ? i + 1 : j >= 0 ? j + 1 : NAV.length, 0, ["prix", "pxTag", "Prix dynamiques"]);
  if (typeof AB_GATE !== "undefined") AB_GATE.prix = ["pro", "Prix dynamiques"];
  try { if (typeof PM_ROUTE !== "undefined") PM_ROUTE.prix = "dashboard"; } catch (e) {}
  if (typeof PC_LECONS === "object") PC_LECONS.prix = {
    t: "Prix dynamiques", who: ["boss"],
    d: "Le happy hour se met tout seul sur le menu QR, le plat du jour écoule ce qui arrive à date, et une alerte vous prévient quand une hausse fournisseur mange votre marge.",
    steps: ["Programmez un happy hour : jours, heures, remise", "Chaque matin, mettez en plat du jour ce qui doit partir", "Une hausse fournisseur ? Touchez le prix conseillé pour retrouver votre marge"],
    q: ["Le beurre augmente de 12 %. Que fait l'app ?", ["Elle montre la marge perdue par plat et le prix qui la rattrape", "Rien, il faut tout recalculer", "Elle change les prix toute seule"], 0],
    tip: "Une remise ne fait jamais passer un plat sous votre marge minimum : l'app la plafonne.",
    sc: { k: "list", t: "Prix dynamiques", rows: [["pxGlass", "Happy hour · 17 h – 19 h", "−30 %", "acc"], ["pxPlate", "Plat du jour · bourguignon", "−20 %", "ok"], ["pxDrop", "Huîtres : marge en baisse", "−0,64 €", "bad"]] },
  };
  try { if (typeof PC_FAMILLES !== "undefined") { const f = PC_FAMILLES.find((x) => x[0] === "marges"); if (f && Array.isArray(f[4]) && !f[4].includes("prix")) f[4].push("prix"); } } catch (e) {}
})();

/* ───────── the shared rule (same in commande/commande.js and functions/src/commande.js) ───────── */
const pxMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
function pxParis(d) { try { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(d || new Date()).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) }; } catch (e) { const n = d || new Date(); return { day: dayKey(n), min: n.getHours() * 60 + n.getMinutes(), wd: n.getDay() }; } }
function pxActive(r, now) {
  if (!r || !r.it) return false; if (r.day ? r.day !== now.day : !(Array.isArray(r.days) && r.days.includes(now.wd))) return false;
  const a = pxMin(r.from) ?? 0, b = pxMin(r.to) ?? 1440; return a <= b ? now.min >= a && now.min < b : now.min >= a || now.min < b;
}
function pxDeal(promos, id, now) {
  let best = null; (promos || []).forEach((r) => { const v = r && r.it ? r.it[id] : undefined; const pc = +v;
    if (v == null || !(pc >= 0 && pc <= 90) || !pxActive(r, now)) return; if (!best || pc > best.pct) best = { pct: pc, t: r.t || "", k: r.k || "", to: r.to || "" }; });
  return best;
}
const pxPrice = (p, pct) => (pct > 0 ? Math.max(0.1, Math.round((+p || 0) * (100 - pct) / 10) / 10) : Math.round((+p || 0) * 100) / 100);

/* ───────── config ───────── */
const PX_DAYS = [[1, "L", "lundi"], [2, "M", "mardi"], [3, "M", "mercredi"], [4, "J", "jeudi"], [5, "V", "vendredi"], [6, "S", "samedi"], [0, "D", "dimanche"]];
const pxDef = () => ({ hh: [], jour: { auto: false, pct: 20, horizon: 2 }, today: null, floor: 40, alert: { tol: 2, drop: 3 }, done: {} });
const PX = { rid: null, doc: null, seen: false, tab: "hh", F: null, pushed: new Set(), autoT: 0, tick: 0, seeded: null };
function pxCfg() {
  const d = pxDef(), c = PX.doc || {}; const o = { ...d, ...c };
  o.hh = (Array.isArray(c.hh) ? c.hh : []).filter((r) => r && r.id).map((r) => ({ on: r.on !== false, t: String(r.t || "Happy hour").slice(0, 40), days: Array.isArray(r.days) ? r.days.filter((x) => x >= 0 && x <= 6) : [], from: r.from || "17:00", to: r.to || "19:00", pct: Math.max(1, Math.min(90, Math.round(+r.pct || 20))), secs: Array.isArray(r.secs) ? r.secs : [], ids: Array.isArray(r.ids) ? r.ids : [], id: r.id }));
  o.jour = { ...d.jour, ...(c.jour || {}) }; o.alert = { ...d.alert, ...(c.alert || {}) }; o.done = c.done && typeof c.done === "object" ? c.done : {};
  o.floor = Math.max(20, Math.min(80, +o.floor || 40));
  return o;
}
async function pxSave(patch) {
  const next = { ...(PX.doc || {}), ...patch, at: Date.now() }; PX.doc = next; onData();
  try { if (typeof cmSyncSoon === "function") cmSyncSoon(); } catch (e) {}
  await safe(DB.set("prix", "cfg", DB.clean(next)));
}
const pxMgr = () => { try { if (DB.mode === "demo") return true; if (typeof PERMS !== "undefined" && PERMS.isAdmin && PERMS.isAdmin()) return true; } catch (e) {} const r = myRole(); return r === "gerant" || r === "chef"; };
const pxEur = (v) => (v == null || isNaN(v) ? "–" : `${(Math.round(v * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const pxEur0 = (v) => pxEur(v).replace(",00 €", " €");
const pxPct = (v) => `${Math.round(v)} %`;
const pxHm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const pxHtx = (t) => String(t || "").replace(/^0(\d)/, "$1").replace(":00", " h").replace(":", " h ");
const pxDur = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : `${Math.floor(min / 60)} h${min % 60 ? " " + pad(Math.round(min % 60)) : ""}`);

/* ───────── data ───────── */
function pxWatch() {
  if (!S.rid || PX.rid === S.rid) return; PX.rid = S.rid; PX.doc = null; PX.seen = false; PX.pushed = new Set(); const rid = S.rid;
  if (DB.mode === "demo") pxSeedDemo();
  DB.watch("prix", {}, (rows) => { if (S.rid !== rid) return; PX.doc = rows.find((r) => r.id === "cfg") || null; PX.seen = true;
    /* a promo has to reach the public menu even when nobody opens « Commandes en ligne » */
    try { const c = pxCfg(); if ((c.hh.some((r) => r.on) || (c.today && c.today.day === dayKey())) && typeof cmWatch === "function") cmWatch(); if (typeof cmSyncSoon === "function") cmSyncSoon(); } catch (e) {}
    pxAutoSoon(); onData(); });
}
/* every device that opens the restaurant keeps the promos and the margin alerts alive */
try { const pxAttach0 = attachResto; attachResto = function () { const r = pxAttach0.apply(this, arguments); setTimeout(() => { try { pxWatch(); } catch (e) {} }, 0); return r; }; } catch (e) {}
setInterval(() => { try { if (S.rid && PX.rid !== S.rid && S.ready) pxWatch(); } catch (e) {} }, 4000);

function pxSeedDemo() {
  if (PX.seeded === S.rid) return; PX.seeded = S.rid; const p = `restos/${S.rid}/prix`; if (DB.local[p]) return;
  /* the demo shows a happy hour running right now, and the classic afterwork */
  const now = pxParis(), h0 = Math.max(0, Math.floor(now.min / 60) - 1), h1 = Math.min(23, h0 + 3);
  DB.local[p] = { cfg: { hh: [
    { id: "hh1", on: true, t: "Happy hour", days: [0, 1, 2, 3, 4, 5, 6], from: `${pad(h0)}:00`, to: h1 >= 23 ? "23:59" : `${pad(h1)}:00`, pct: 30, secs: ["boisson"], ids: [] },
    { id: "hh2", on: true, t: "Afterwork du jeudi", days: [4, 5], from: "17:30", to: "19:30", pct: 20, secs: ["partage"], ids: [] },
    { id: "hh3", on: false, t: "Café gourmand du midi", days: [1, 2, 3, 4, 5], from: "13:30", to: "15:00", pct: 15, secs: [], ids: ["n-cafe"] },
  ], jour: { auto: true, pct: 20, horizon: 2 }, today: null, floor: 40, alert: { tol: 2, drop: 3 }, done: {}, at: Date.now() } };
}

/* ───────── what each rule touches, capped by the margin floor ───────── */
function pxCarte() { try { return typeof cmDishes === "function" ? cmDishes().filter((n) => num(n.price) > 0) : (S.notes || []).filter((n) => n.carte && num(n.price) > 0); } catch (e) { return []; } }
const pxSecOf = (n) => { try { return typeof cmSecOf === "function" ? cmSecOf(n) : n.carteCat || "plat"; } catch (e) { return n.carteCat || "plat"; } };
const pxSecs = () => { try { return typeof cmSecs === "function" ? cmSecs() : []; } catch (e) { return []; } };
const pxSecName = (id) => (pxSecs().find((s) => s.id === id) || { t: id }).t;
function pxTargets(r) { const S2 = new Set(r.secs || []), I = new Set(r.ids || []); return pxCarte().filter((n) => S2.has(pxSecOf(n)) || I.has(n.id)); }
function pxDishInfo(n) { try { if (typeof mgDish === "function") { const d = mgDish(n); return { cost: d.known ? d.cost : null, ht: d.ht, ttc: d.ttc, vat: d.vat, fc: d.fc, margin: d.margin, target: d.target, complete: d.complete }; } } catch (e) {} const ttc = num(n.price) || 0; return { cost: null, ht: ttc / 1.1, ttc, vat: 10, fc: null, margin: null, target: 30 }; }
/* the biggest discount that keeps the food cost under the floor (cost unknown: at most 50 %) */
function pxCap(n, pct, C) {
  C = C || pxCfg(); const d = pxDishInfo(n); if (!(d.cost > 0) || !(d.ht > 0)) return Math.min(pct, 50);
  const max = Math.floor((1 - (d.cost * 100) / (d.ht * C.floor)) * 100); return Math.max(0, Math.min(pct, max));
}
function pxUnder(n, pct) { const d = pxDishInfo(n); const ttc = pxPrice(d.ttc, pct), ht = ttc / (1 + (d.vat || 10) / 100); return { ttc, ht, margin: d.cost != null ? ht - d.cost : null, fc: d.cost > 0 && ht ? (d.cost / ht) * 100 : null }; }
/* the projection written to public/menu (called by js/commande.js cmPubDoc) */
function pxPubPromos(items) {
  const C = pxCfg(), ids = new Set((items || []).map((i) => i.id)), byId = Object.fromEntries(pxCarte().map((n) => [n.id, n])), out = [];
  C.hh.filter((r) => r.on && r.days.length && pxMin(r.from) != null && pxMin(r.to) != null).forEach((r) => {
    const it = {}; pxTargets(r).forEach((n) => { if (!ids.has(n.id)) return; const c = pxCap(n, r.pct, C); if (c > 0) it[n.id] = c; });
    if (Object.keys(it).length) out.push({ id: r.id, k: "hh", t: r.t, days: r.days, from: r.from, to: r.to, it });
  });
  const T = C.today; if (T && T.day >= dayKey() && ids.has(T.noteId) && byId[T.noteId]) out.push({ id: "jour", k: "jour", t: "Plat du jour", days: [], day: T.day, it: { [T.noteId]: pxCap(byId[T.noteId], +T.pct || 0, C) } });
  return out.slice(0, 20);
}
window.pxPubPromos = pxPubPromos;
/* the price of a dish right now, for the waiter's order-taking (js/salle.js) */
function pxNowPrice(n) { if (!n || !(num(n.price) > 0)) return n ? num(n.price) || 0 : 0; try { const P = pxPubPromos([{ id: n.id }]); const d = pxDeal(P, n.id, pxParis()); return d ? pxPrice(num(n.price), d.pct) : num(n.price); } catch (e) { return num(n.price); } }
function pxNowDeal(n) { try { return n ? pxDeal(pxPubPromos([{ id: n.id }]), n.id, pxParis()) : null; } catch (e) { return null; } }
window.pxNowPrice = pxNowPrice; window.pxNowDeal = pxNowDeal;

/* rule state: running now (minutes left) or the next start (within 7 days) */
function pxState(r, now) {
  now = now || pxParis(); if (!r.on) return { k: "off" }; if (!r.days.length) return { k: "off" };
  const a = pxMin(r.from), b = pxMin(r.to); if (a == null || b == null) return { k: "off" };
  if (pxActive({ ...r, it: {} }, now)) { const left = (b > now.min ? b : b + 1440) - now.min; return { k: "on", left }; }
  for (let i = 0; i < 8; i++) { const wd = (now.wd + i) % 7; if (!r.days.includes(wd)) continue; if (i === 0 && a <= now.min) continue; return { k: "next", inDays: i, at: a, wd }; }
  return { k: "off" };
}
const pxWhenTx = (s) => (s.k !== "next" ? "" : s.inDays === 0 ? `Aujourd'hui à ${pxHtx(pxHm(s.at))}` : s.inDays === 1 ? `Demain à ${pxHtx(pxHm(s.at))}` : `${PX_DAYS.find((d) => d[0] === s.wd)[2].replace(/^./, (c) => c.toUpperCase())} à ${pxHtx(pxHm(s.at))}`);
const pxDaysTx = (D) => { const s = [...D].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)); if (s.length === 7) return "Tous les jours"; if (s.length === 5 && [1, 2, 3, 4, 5].every((d) => s.includes(d))) return "Du lundi au vendredi"; if (s.length === 6 && !s.includes(0)) return "Du lundi au samedi"; return s.map((d) => PX_DAYS.find((x) => x[0] === d)[2].slice(0, 3) + ".").join(" ").replace(/^./, (c) => c.toUpperCase()); };
const pxScopeTx = (r) => { const p = [...(r.secs || []).map(pxSecName)]; const n = (r.ids || []).length; if (n) p.push(`${n} plat${n > 1 ? "s" : ""} choisi${n > 1 ? "s" : ""}`); return p.join(", ") || "Rien de choisi"; };

/* ───────── plat du jour: what must go ───────── */
const pxNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function pxRisk(C) {
  C = C || pxCfg(); const H = Math.max(0, Math.min(5, +C.jour.horizon || 2)); const by = {}, named = [];
  (typeof activeLots === "function" ? activeLots() : []).forEach((l) => {
    const k = typeof dlcOf === "function" ? dlcOf(l) : l.dlc; const d = daysUntil(k); if (d == null || d < 0 || d > H) return;
    if (l.productId) { const p = S.products.find((x) => x.id === l.productId); if (!p) return; const o = (by[p.id] ||= { p, qty: 0, d, unit: l.unit || p.unit }); o.qty += num(l.qty) || 0; o.d = Math.min(o.d, d); }
    else named.push({ name: l.name || "", key: pxNorm(l.name), qty: num(l.qty) || 0, unit: l.unit || "", d });
  });
  return { by, named, H };
}
function pxSuggest(C) {
  C = C || pxCfg(); const R = pxRisk(C); const out = [];
  pxCarte().forEach((n) => {
    const why = []; let val = 0, dmin = 9;
    const t = pxNorm(n.title); R.named.forEach((x) => { if (t && x.key && (x.key.startsWith(t) || t.startsWith(x.key))) { why.push({ name: x.name.replace(/\s*\(.*\)$/, ""), qty: x.qty, unit: x.unit, d: x.d, own: true }); val += x.qty * (num(n.price) || 0) * 0.3; dmin = Math.min(dmin, x.d); } });
    let lines = []; try { lines = typeof mgCost === "function" ? mgCost(n).lines : []; } catch (e) {}
    lines.filter((l) => l.kind === "p" && R.by[l.id]).forEach((l) => { const o = R.by[l.id]; if (why.some((w) => w.pid === o.p.id)) return; why.push({ pid: o.p.id, name: o.p.name, qty: o.qty, unit: o.unit, d: o.d }); val += o.qty * (num(o.p.price) || 0); dmin = Math.min(dmin, o.d); });
    if (!why.length) return;
    out.push({ n, why, val, d: dmin, pct: pxCap(n, +C.jour.pct || 20, C), want: +C.jour.pct || 20 });
  });
  /* what is at risk, weighted by urgency: 200 € due in two days beats 20 € due tonight */
  return out.sort((a, b) => b.val / (b.d + 1) - a.val / (a.d + 1)).slice(0, 6);
}
const pxDTx = (d) => (d <= 0 ? "DLC aujourd'hui" : d === 1 ? "DLC demain" : `DLC dans ${d} jours`);
const pxQty = (q, u) => `${fmt(q, q % 1 ? 1 : 0)} ${u === "pièce" && q > 1 ? "pièces" : u || ""}`.trim();
const pxWhyTx = (w) => (w.own ? `Déjà préparé : ${pxQty(w.qty, w.unit)} · ${pxDTx(w.d)}` : `${w.name} · ${pxQty(w.qty, w.unit)} · ${pxDTx(w.d)}`);
function pxToday(C) { C = C || pxCfg(); const T = C.today; if (!T || T.day !== dayKey()) return null; const n = (S.notes || []).find((x) => x.id === T.noteId); return n ? { ...T, n } : null; }

/* ───────── margin alerts: a supplier raised a price, which dishes pay for it ───────── */
function pxAlerts(C) {
  C = C || pxCfg(); if (typeof mgDish !== "function" || typeof mgLastChange !== "function") return [];
  const sales = typeof mgSalesMap === "function" ? mgSalesMap(30) : {}; const out = [];
  (typeof mgDishes === "function" ? mgDishes() : []).forEach((n) => {
    const d = mgDish(n); if (!d.ttc || !d.known || !(d.cost > 0)) return;
    const causes = []; const seen = new Set();
    d.lines.filter((l) => l.kind === "p" && l.id && l.q != null).forEach((l) => { if (seen.has(l.id)) return; seen.add(l.id); const ch = mgLastChange(l.id, 30); if (!ch || !(num(ch.pct) > 0)) return;
      const p = S.products.find((x) => x.id === l.id); const per = (l.q * (num(ch.price) - num(ch.prev))) / (d.por || 1); causes.push({ p, ch, per, sup: ch.supplier || (p && p.supplier) || "" }); });
    if (!causes.length) return;
    const from = causes.map((c) => c.ch.day || dayKey()).sort()[0]; const old = mgDish(n, addDays(from, -1));
    if (old.margin == null || d.margin == null) return; const lost = old.margin - d.margin; if (lost < 0.01) return;
    const lostPct = old.margin > 0 ? (lost / old.margin) * 100 : 100; const over = d.fc != null && d.fc > d.target + (+C.alert.tol || 0);
    if (!over && lostPct < (+C.alert.drop || 3)) return;
    const back = Math.max(d.ttc + 0.5, Math.ceil((d.cost + old.margin) * (1 + d.vat / 100) * 2) / 2);
    const key = `marge_${n.id}_${causes.map((c) => c.ch.id || c.ch.day).sort().join("_")}`.slice(0, 120);
    out.push({ key, n, d, old, lost, lostPct, over, causes: causes.sort((a, b) => b.per - a.per), back, month: lost * (sales[n.id] || 0), sold: sales[n.id] || 0, level: d.fc != null && d.fc > d.target + 5 ? "bad" : "warn", done: C.done[key] });
  });
  return out.sort((a, b) => !!a.done - !!b.done || (b.level === "bad") - (a.level === "bad") || (b.month || b.lost) - (a.month || a.lost));
}
const pxOpen = (C) => pxAlerts(C).filter((a) => !a.done);

/* ───────── automatic part: plat du jour of the morning, alerts to the alert centre ───────── */
function pxAutoSoon() { clearTimeout(PX.autoT); PX.autoT = setTimeout(pxAuto, 1500); }
async function pxAuto() {
  if (!S.rid || !PX.seen || !pxMgr()) return; const C = pxCfg(), now = pxParis();
  if (C.jour.auto && !pxToday(C) && now.min >= 5 * 60 && !(C.today && C.today.day === now.day && C.today.off)) {
    const s = pxSuggest(C)[0];
    if (s) { await pxSave({ today: { day: now.day, noteId: s.n.id, pct: s.pct, why: pxWhyTx(s.why[0]), auto: true, at: Date.now(), by: "auto" } });
      logEvent("note", `Plat du jour choisi automatiquement : ${s.n.title}${s.pct ? ` à −${s.pct} %` : ""}`, { area: "prix" }); }
  }
  if (window.ALERTES && typeof ALERTES.push === "function") pxOpen(C).forEach((a) => {
    if (PX.pushed.has(a.key)) return; PX.pushed.add(a.key); const c0 = a.causes[0];
    ALERTES.push({ key: a.key, type: "marge", level: a.level, text: `Marge en baisse · ${a.n.title}`, sub: `${c0.p ? c0.p.name : "Un ingrédient"} +${fmt(num(c0.ch.pct), 1)} %${c0.sup ? ` chez ${c0.sup}` : ""} · ${pxEur(a.lost)} de moins par assiette`, day: dayKey() });
  });
}
setInterval(() => { try { if (PX.seen && PX.rid === S.rid) pxAuto(); } catch (e) {} }, 10 * 6e4);

/* ───────── view ───────── */
VIEWS.prix = {
  render() {
    pxWatch(); try { if (typeof cmWatch === "function") cmWatch(); } catch (e) {}
    if (S.params && S.params.tab && PX.tabFrom !== S.params) { PX.tab = S.params.tab; PX.tabFrom = S.params; }
    const C = pxCfg(), now = pxParis(), A = pxOpen(C), mgr = pxMgr(); let k = 1;
    const tabs = [["hh", "Happy hour"], ["jour", "Plat du jour"], ["marge", `Marges${A.length ? ` · ${A.length}` : ""}`]]; const ti = Math.max(0, tabs.findIndex((t) => t[0] === PX.tab));
    const right = `<button class="btn soft sm" data-act="pxPreview">${ico("cmEye")}<span class="px-hide-s">Menu client</span></button>`;
    const body = !pxCarte().length ? pxEmptyCarte() : PX.tab === "jour" ? pxJourTab(C, mgr) : PX.tab === "marge" ? pxMargeTab(C, mgr) : pxHHTab(C, now, mgr);
    return `<div class="inner wide px">${topBar("Prix dynamiques", { right })}
      ${pxHero(C, now, A, k++)}
      <div class="seg px-seg st" style="--i:${k++}" role="tablist"><span class="knob" style="width:calc(33.333% - 2.67px);transform:translateX(${ti * 100}%)"></span>${tabs.map(([v, t]) => `<button class="${PX.tab === v ? "on" : ""}" data-act="pxTab" data-v="${v}" role="tab" aria-selected="${PX.tab === v}">${t}</button>`).join("")}</div>
      <div class="px-body">${body}</div>
    </div>`;
  },
  after(v) { clearInterval(PX.tick); PX.tick = setInterval(() => { if (S.route !== "prix") return clearInterval(PX.tick); pxTickCd(); }, 20000); pxTickCd(); },
};
function pxTickCd() { const now = pxParis(); $$("[data-pxto]").forEach((el) => { const b = +el.dataset.pxto; const left = (b > now.min ? b : b + 1440) - now.min; el.textContent = `encore ${pxDur(left)}`; }); }
function pxEmptyCarte() {
  return `<div class="glass empty st" style="--i:3"><div class="ic">${ico("pxTag")}</div><b>Il faut d'abord une carte</b>Les prix dynamiques s'appliquent aux plats de votre menu QR. Ajoutez vos plats avec leur prix, ou importez votre carte.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn acc" data-act="pxCarteGo">${ico("cmQr")}Ma carte en ligne</button><button class="btn soft" data-go="notes">${ico("book")}Mes recettes</button></div></div>`;
}
function pxHero(C, now, A, i) {
  const runs = C.hh.map((r) => ({ r, s: pxState(r, now) })), on = runs.filter((x) => x.s.k === "on"), next = runs.filter((x) => x.s.k === "next").sort((a, b) => a.s.inDays - b.s.inDays || a.s.at - b.s.at)[0];
  const T = pxToday(C); const live = on[0];
  const main = live ? `<div class="px-hk"><span class="px-live"><i></i>Happy hour en cours</span></div>
      <div class="px-hbig"><b class="mono">−${live.r.pct} %</b><span><em>${esc(live.r.t)}</em>${esc(pxScopeTx(live.r))} · jusqu'à ${esc(pxHtx(live.r.to))}<br><strong data-pxto="${pxMin(live.r.to)}">encore ${pxDur(live.s.left)}</strong></span></div>`
    : `<div class="px-hk"><span class="px-live off"><i></i>${next ? "Prochain happy hour" : "Pas de happy hour en ce moment"}</span></div>
      <div class="px-hbig"><b class="mono">${next ? `−${next.r.pct} %` : ico("pxGlass")}</b><span><em>${next ? esc(next.r.t) : "Programmez-en un"}</em>${next ? `${esc(pxWhenTx(next.s))} · ${esc(pxScopeTx(next.r))}` : "Les boissons à −30 % de 17 h à 19 h, par exemple : il se met en route tout seul."}</span></div>`;
  return `<div class="px-hero st" style="--i:${i}"><div class="px-aur" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="px-hmain">${main}</div>
    <div class="px-hside">
      <button class="px-hrow" data-act="pxTab" data-v="jour"><span class="px-hic">${ico("cmChef")}</span><span><b>${T ? esc(T.n.title) : "Pas de plat du jour"}</b><em>${T ? `Plat du jour${T.pct ? ` · −${T.pct} %` : ""}` : C.jour.auto ? "Choisi tout seul chaque matin" : "Écoulez ce qui arrive à date"}</em></span></button>
      <button class="px-hrow${A.length ? " bad" : ""}" data-act="pxTab" data-v="marge"><span class="px-hic">${ico(A.length ? "pxDrop" : "mgCoin")}</span><span><b>${A.length ? `${A.length} plat${A.length > 1 ? "s perdent" : " perd"} de la marge` : "Marges sous contrôle"}</b><em>${A.length ? "À cause d'une hausse fournisseur" : "Aucune hausse fournisseur ne vous coûte"}</em></span></button>
    </div></div>`;
}

/* ───────── tab: happy hour ───────── */
function pxHHTab(C, now, mgr) {
  let k = 3;
  if (!C.hh.length) return `<div class="glass empty px-empty st" style="--i:${k++}"><div class="ic">${ico("pxGlass")}</div><b>Votre premier happy hour</b>Choisissez les jours, les heures et la remise : le menu QR affiche les prix barrés tout seul, et l'addition suit.
    ${mgr ? `<div class="px-presets">${PX_PRESETS.map((p, i) => `<button class="px-preset st" style="--i:${k++}" data-act="pxPreset" data-v="${i}"><b>${esc(p.t)}</b><span>${esc(pxDaysTx(p.days))} · ${pxHtx(p.from)} – ${pxHtx(p.to)}</span><em class="mono">−${p.pct} %</em></button>`).join("")}</div>
    <button class="btn acc" data-act="pxEdit" data-v="">${ico("plus")}Créer le mien</button>` : ""}</div>`;
  return `<div class="px-rules">${C.hh.map((r) => pxRuleCard(r, pxState(r, now), C, mgr, k++)).join("")}</div>
    ${mgr ? `<button class="btn soft block px-add st" style="--i:${k++}" data-act="pxEdit" data-v="">${ico("plus")}Ajouter un happy hour</button>` : ""}
    <p class="note px-note st" style="--i:${k++}">${ico("info")}Le prix réduit s'applique au menu QR et à la prise de commande de l'app. Sur votre caisse, programmez la même remise. Une remise ne fait jamais passer un plat au-dessus de ${C.floor} % de food cost : elle est plafonnée.</p>`;
}
const PX_PRESETS = [
  { t: "Afterwork", days: [1, 2, 3, 4, 5], from: "17:00", to: "19:00", pct: 30, secs: ["boisson"] },
  { t: "Apéro du week-end", days: [5, 6], from: "18:00", to: "20:00", pct: 20, secs: ["partage", "boisson"] },
  { t: "Fin de service du midi", days: [1, 2, 3, 4, 5], from: "13:45", to: "14:30", pct: 15, secs: ["dessert"] },
];
function pxRuleCard(r, st, C, mgr, i) {
  const T = pxTargets(r); const ex = T.slice(0, 3).map((n) => { const c = pxCap(n, r.pct, C); return `<span class="px-ex"><b>${esc(typeof mgShort === "function" ? mgShort(n.title) : n.title)}</b><s class="mono">${pxEur0(num(n.price))}</s><em class="mono">${c ? pxEur0(pxPrice(num(n.price), c)) : "—"}</em></span>`; }).join("");
  const capped = T.filter((n) => pxCap(n, r.pct, C) < r.pct).length;
  const pill = st.k === "on" ? `<span class="pill acc"><span class="dot"></span>En cours · ${pxDur(st.left)}</span>` : st.k === "next" ? `<span class="pill neu">${esc(pxWhenTx(st))}</span>` : `<span class="pill neu">Coupé</span>`;
  return `<div class="glass px-rule st${st.k === "on" ? " on" : ""}${r.on ? "" : " off"}" style="--i:${i}">
    <button class="px-rmain" ${mgr ? `data-act="pxEdit" data-v="${esc(r.id)}"` : "disabled"}>
      <span class="px-rpct mono">−${r.pct}<small>%</small></span>
      <span class="px-rtx"><b>${esc(r.t)}</b><em>${esc(pxDaysTx(r.days))} · <span class="px-nw">${pxHtx(r.from)} – ${pxHtx(r.to)}</span></em><em>${esc(pxScopeTx(r))} · ${T.length} article${T.length > 1 ? "s" : ""}${capped ? ` · ${capped} plafonné${capped > 1 ? "s" : ""}` : ""}</em></span>
    </button>
    <div class="px-rside">${pill}${mgr ? `<button class="px-sw${r.on ? " on" : ""}" data-act="pxHHOn" data-v="${esc(r.id)}" role="switch" aria-checked="${r.on}" aria-label="${r.on ? "Couper" : "Activer"} ${esc(r.t)}"><i></i></button>` : ""}</div>
    ${ex ? `<div class="px-exs">${ex}${T.length > 3 ? `<span class="px-more">+${T.length - 3}</span>` : ""}</div>` : ""}
  </div>`;
}
function pxSheet() {
  const F = PX.F, C = pxCfg(); const T = pxTargets(F);
  const D = pxCarte(); const S2 = pxSecs().filter((s) => D.some((n) => pxSecOf(n) === s.id));
  return `<div class="px-sf">
    <div class="px-sfh"><span class="px-sfic">${ico("pxGlass")}</span><div><b class="h3">${F.id ? "Modifier le happy hour" : "Nouveau happy hour"}</b><em>Il se met en route et s'arrête tout seul</em></div></div>
    <label class="field"><span>Nom affiché aux clients</span><input class="input" id="pxN" value="${esc(F.t)}" maxlength="40" placeholder="Ex. : Happy hour" autocomplete="off"></label>
    <div class="field"><span>Jours</span><div class="px-days">${PX_DAYS.map(([d, l, full]) => `<button class="px-day${F.days.includes(d) ? " on" : ""}" data-act="pxFDay" data-v="${d}" aria-pressed="${F.days.includes(d)}" aria-label="${full}">${l}</button>`).join("")}</div></div>
    <div class="grid2"><label class="field"><span>De</span><input class="input mono" id="pxFrom" type="time" value="${esc(F.from)}"></label><label class="field"><span>À</span><input class="input mono" id="pxTo" type="time" value="${esc(F.to)}"></label></div>
    <div class="field"><span>Remise</span><div class="px-pcts">${[10, 15, 20, 30, 50].map((p) => `<button class="chip${F.pct === p ? " on" : ""}" data-act="pxFPct" data-v="${p}">−${p} %</button>`).join("")}<label class="px-pin"><input class="input mono" id="pxP" inputmode="numeric" value="${[10, 15, 20, 30, 50].includes(F.pct) ? "" : F.pct}" placeholder="Autre" aria-label="Autre remise en %"><i>%</i></label></div></div>
    <div class="field"><span>Sur quoi</span><div class="px-secs">${S2.map((s) => `<button class="chip${F.secs.includes(s.id) ? " on" : ""}" data-act="pxFSec" data-v="${esc(s.id)}">${esc(s.t)}</button>`).join("")}</div></div>
    <details class="px-pick"${F.ids.length ? " open" : ""}><summary>Ou des plats précis${F.ids.length ? ` · ${F.ids.length}` : ""}</summary><div class="px-plist">${D.map((n) => { const on = F.ids.includes(n.id); return `<button class="px-pi${on ? " on" : ""}" data-act="pxFId" data-v="${esc(n.id)}" aria-pressed="${on}"><span class="px-ck">${on ? ico("check") : ""}</span><b>${esc(n.title)}</b><em class="mono">${pxEur0(num(n.price))}</em></button>`; }).join("")}</div></details>
    <div class="px-prev"><span class="lbl">Aperçu des prix · ${T.length} article${T.length > 1 ? "s" : ""}</span>${T.length ? T.slice(0, 8).map((n) => { const c = pxCap(n, F.pct, C), u = pxUnder(n, c); return `<div class="px-pr"><b>${esc(n.title)}</b><s class="mono">${pxEur(num(n.price))}</s><em class="mono">${c ? pxEur(u.ttc) : "Prix normal"}</em>${c < F.pct ? `<span class="px-cap">${c ? `limité à −${c} %` : "marge trop juste"}</span>` : ""}</div>`; }).join("") + (T.length > 8 ? `<div class="px-pr more">et ${T.length - 8} autre${T.length - 8 > 1 ? "s" : ""}</div>` : "") : `<p class="sub">Choisissez une catégorie ou des plats.</p>`}</div>
    <button class="btn acc block" data-act="pxHHSave">Enregistrer</button>
    ${F.id ? `<button class="btn ghost block px-del" data-act="pxHHDel" data-v="${esc(F.id)}">Supprimer ce happy hour</button>` : ""}
  </div>`;
}
function pxFRead() { const F = PX.F; if (!F) return; const n = $("#pxN"), a = $("#pxFrom"), b = $("#pxTo"), p = $("#pxP"); if (n) F.t = n.value; if (a && a.value) F.from = a.value; if (b && b.value) F.to = b.value; if (p && p.value.trim()) { const v = Math.round(num(p.value.replace(/[^\d,.]/g, ""))); if (v >= 1 && v <= 90) F.pct = v; } }
function pxSheetPaint() { openSheet(pxSheet()); }

/* ───────── tab: plat du jour ───────── */
function pxJourTab(C, mgr) {
  let k = 3; const T = pxToday(C); const L = pxSuggest(C).filter((s) => !T || s.n.id !== T.n.id);
  const today = T ? (() => { const d = pxDishInfo(T.n), c = pxCap(T.n, +T.pct || 0, C), u = pxUnder(T.n, c); return `<div class="glass px-today st" style="--i:${k++}">
      <div class="px-tk"><span class="px-live"><i></i>Plat du jour · aujourd'hui</span>${T.auto ? `<span class="pill neu">Choisi tout seul ce matin</span>` : ""}</div>
      <b class="px-tt">${esc(T.n.title)}</b>${T.why ? `<em class="px-tw">${ico("tag")}${esc(T.why)}</em>` : ""}
      <div class="px-tp"><span>${c ? `<s class="mono">${pxEur(d.ttc)}</s>` : ""}<b class="mono">${pxEur(u.ttc)}</b>${c ? `<i class="mono">−${c} %</i>` : ""}</span>${u.margin != null ? `<span class="px-tm">Marge <b class="mono">${pxEur(u.margin)}</b> par assiette${u.fc != null ? ` · food cost ${pxPct(u.fc)}` : ""}</span>` : ""}</div>
      ${mgr ? `<div class="px-tacts"><button class="btn acc sm" data-act="pxTeam">${ico("csMega")}Prévenir l'équipe</button><button class="btn soft sm" data-act="pxJourOff">Arrêter</button></div>` : ""}
    </div>`; })() : "";
  const sug = L.length ? `<div class="px-sech st" style="--i:${k++}"><span class="lbl">À écouler en priorité</span><span class="sub">DLC d'ici ${C.jour.horizon <= 0 ? "ce soir" : C.jour.horizon === 1 ? "demain" : `${C.jour.horizon} jours`}</span></div>
    <div class="px-sugs">${L.map((s) => { const u = pxUnder(s.n, s.pct); return `<div class="glass px-sug st" style="--i:${k++}">
      <div class="px-stx"><b>${esc(s.n.title)}</b>${s.why.slice(0, 2).map((w) => `<em class="${w.d <= 1 ? "hot" : ""}">${ico("clock")}${esc(pxWhyTx(w))}</em>`).join("")}</div>
      <div class="px-sp"><span>${s.pct ? `<s class="mono">${pxEur0(num(s.n.price))}</s>` : ""}<b class="mono">${pxEur(u.ttc)}</b></span><em>${s.pct ? `−${s.pct} %${s.pct < s.want ? " · plafonné" : ""}` : "sans remise, marge trop juste"}</em></div>
      ${mgr ? `<button class="btn ${T ? "soft" : "acc"} sm" data-act="pxJourSet" data-id="${esc(s.n.id)}" data-v="${s.pct}">${T ? "Choisir plutôt" : "Mettre en plat du jour"}</button>` : ""}
    </div>`; }).join("")}</div>`
    : !T ? `<div class="glass empty st" style="--i:${k++}"><div class="ic">${ico("pxPlate")}</div><b>Rien à écouler d'urgence</b>Aucun produit de vos recettes n'arrive à date d'ici ${C.jour.horizon} jours. Les DLC viennent de vos étiquettes et réceptions.${mgr ? `<div style="margin-top:14px"><button class="btn soft" data-act="pxJourPick">${ico("plus")}Choisir un plat moi-même</button></div>` : ""}</div>` : "";
  const auto = mgr ? `<div class="glass pad px-auto st" style="--i:${k++}">
      <button class="px-arow" data-act="pxJourAuto" role="switch" aria-checked="${!!C.jour.auto}"><span class="px-hic">${ico("pxTimer")}</span><span class="tx"><b>Choisir tout seul chaque matin</b><em>Le plat qui écoule le plus de produits à date passe en plat du jour, l'équipe le voit dans l'app.</em></span><span class="px-sw${C.jour.auto ? " on" : ""}" aria-hidden="true"><i></i></span></button>
      <div class="px-arow2"><span class="lbl">Remise du plat du jour</span><div class="px-pcts">${[0, 10, 15, 20, 30].map((p) => `<button class="chip${+C.jour.pct === p ? " on" : ""}" data-act="pxJourPct" data-v="${p}">${p ? `−${p} %` : "Aucune"}</button>`).join("")}</div></div>
      <div class="px-arow2"><span class="lbl">Produits à écouler</span><div class="px-pcts">${[[0, "DLC aujourd'hui"], [1, "Jusqu'à demain"], [2, "2 jours"], [3, "3 jours"]].map(([v, t]) => `<button class="chip${+C.jour.horizon === v ? " on" : ""}" data-act="pxJourH" data-v="${v}">${t}</button>`).join("")}</div></div>
      ${L.length || T ? `<button class="btn ghost sm" data-act="pxJourPick">Choisir un autre plat</button>` : ""}
    </div>` : "";
  return `<div class="px-cols"><div>${today}${sug}</div><div>${auto}</div></div>`;
}
function pxPickSheet() {
  const C = pxCfg(); return `<div class="px-sf"><div class="px-sfh"><span class="px-sfic">${ico("pxPlate")}</span><div><b class="h3">Plat du jour</b><em>Remise de ${C.jour.pct ? `−${C.jour.pct} %` : "0 %"}, plafonnée pour garder votre marge</em></div></div>
    <div class="px-plist">${pxCarte().map((n) => { const c = pxCap(n, +C.jour.pct || 0, C); return `<button class="px-pi" data-act="pxJourSet" data-id="${esc(n.id)}" data-v="${c}"><span class="px-ck">${ico("pxPlate")}</span><b>${esc(n.title)}</b><em class="mono">${c ? `${pxEur0(pxPrice(num(n.price), c))} · −${c} %` : pxEur0(num(n.price))}</em></button>`; }).join("")}</div></div>`;
}

/* ───────── tab: marges ───────── */
function pxMargeTab(C, mgr) {
  let k = 3; const all = pxAlerts(C), A = all.filter((a) => !a.done), done = all.filter((a) => a.done);
  const tot = A.reduce((s, a) => s + a.month, 0);
  const head = A.length ? `<div class="px-msum st" style="--i:${k++}"><b>${A.length} plat${A.length > 1 ? "s" : ""} ${A.length > 1 ? "rapportent" : "rapporte"} moins qu'avant</b><span>${tot > 0 ? `Soit <b class="mono">${pxEur0(Math.round(tot))}</b> de marge en moins par mois au rythme des ventes.` : "Des hausses fournisseurs des 30 derniers jours."} Un geste suffit pour la retrouver.</span></div>`
    : `<div class="glass empty st" style="--i:${k++}"><div class="ic">${ico("mgCoin")}</div><b>Aucune hausse ne mange vos marges</b>Dès qu'un fournisseur augmente un prix (facture scannée ou réception), les plats touchés apparaissent ici avec le prix qui rattrape la marge.<div style="margin-top:14px"><button class="btn soft" data-go="factures">${ico("mgInvoice")}Scanner une facture</button></div></div>`;
  const card = (a) => { const c0 = a.causes;
    return `<div class="glass px-al ${a.level}${a.done ? " done" : ""} st" style="--i:${k++}">
      <div class="px-alh"><span class="px-alic">${ico("pxDrop")}</span><span class="tx"><b>${esc(a.n.title)}</b><em>Food cost ${a.old.fc != null ? `${pxPct(a.old.fc)} → ` : ""}<b>${a.d.fc != null ? pxPct(a.d.fc) : "–"}</b> · objectif ${pxPct(a.d.target)}</em></span>${a.done ? `<span class="pill neu">${a.done.act === "prix" ? "Prix ajusté" : "Ignorée"}</span>` : a.level === "bad" ? `<span class="pill bad"><span class="dot"></span>À revoir</span>` : `<span class="pill warn">À surveiller</span>`}</div>
      <div class="px-alk"><div><span>Marge par assiette</span><b class="mono"><s>${pxEur(a.old.margin)}</s> ${pxEur(a.d.margin)}</b></div><div><span>Perdu</span><b class="mono bad">−${pxEur(a.lost)}</b><em>${a.sold ? `≈ −${pxEur0(Math.round(a.month))} par mois` : "par assiette"}</em></div></div>
      <div class="px-causes">${c0.slice(0, 3).map((c) => { const k2 = c.sup && typeof acKey === "function" ? acKey(c.sup) : ""; const fo = k2 && typeof foOf === "function" ? foOf(k2) : null; const ph = fo && typeof acCfg === "function" ? (acCfg(fo).phone || "") : "";
        return `<div class="px-cause"><span class="px-cpct mono">+${fmt(num(c.ch.pct), num(c.ch.pct) < 10 ? 1 : 0)} %</span><span class="tx"><b>${esc(c.p ? c.p.name : "Ingrédient")}</b><em>${esc(c.sup || "Fournisseur inconnu")} · ${typeof mgDayTx === "function" ? mgDayTx(c.ch.day) : esc(c.ch.day || "")} · ${pxEur(num(c.ch.prev))} → ${pxEur(num(c.ch.price))}</em></span>${ph ? `<a class="iconbtn sm" href="tel:${esc(ph.replace(/[^\d+]/g, ""))}" aria-label="Appeler ${esc(c.sup)}">${ico("foPhone")}</a>` : ""}${fo ? `<button class="iconbtn sm" data-act="pxFo" data-v="${esc(k2)}" aria-label="Fiche ${esc(c.sup)}">${ico("chev")}</button>` : ""}</div>`; }).join("")}</div>
      ${mgr && !a.done ? `<div class="px-alacts"><button class="btn acc sm" data-act="pxBack" data-id="${esc(a.n.id)}" data-v="${a.back}" data-k="${esc(a.key)}">Passer à ${pxEur(a.back)}</button><button class="btn soft sm" data-go="margeFiche" data-id="${esc(a.n.id)}">Fiche technique</button><button class="btn ghost sm" data-act="pxIgnore" data-k="${esc(a.key)}">Ignorer</button></div>
        <p class="px-alhint">${pxEur(a.back)} redonne la marge d'avant la hausse (${pxEur(a.old.margin)} par assiette).</p>` : ""}
    </div>`; };
  const cfg = mgr ? `<div class="glass pad px-acfg st" style="--i:${k + A.length + done.length}">
      <span class="lbl">Réglages des alertes</span>
      <div class="px-arow2"><span>M'alerter quand la marge d'un plat baisse de</span><div class="px-pcts">${[2, 3, 5, 10].map((v) => `<button class="chip${+C.alert.drop === v ? " on" : ""}" data-act="pxDrop" data-v="${v}">${v} %</button>`).join("")}</div></div>
      <div class="px-arow2"><span>Ou quand le food cost dépasse l'objectif de</span><div class="px-pcts">${[0, 2, 5].map((v) => `<button class="chip${+C.alert.tol === v ? " on" : ""}" data-act="pxTol" data-v="${v}">${v ? `+${v} pts` : "Dès l'objectif"}</button>`).join("")}</div></div>
      <div class="px-arow2"><span>Food cost maximum pendant une promo</span><div class="px-pcts">${[35, 40, 45, 50].map((v) => `<button class="chip${+C.floor === v ? " on" : ""}" data-act="pxFloor" data-v="${v}">${v} %</button>`).join("")}</div></div>
    </div>` : "";
  return `<div class="px-cols"><div>${head}<div class="px-als">${A.map(card).join("")}${done.length ? `<div class="px-sech"><span class="lbl">Traitées</span></div>${done.slice(0, 6).map(card).join("")}` : ""}</div></div><div>${cfg}</div></div>`;
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  pxTab(el, id, v) { if (PX.tab === v && S.route === "prix") return; PX.tab = v; SFX.tap(); buzz(4); if (S.route !== "prix") go("prix"); else rerender(); },
  pxCarteGo() { SFX.tap(); go("commandes", { tab: "carte" }); },
  pxFo(el, id, v) { SFX.tap(); go("fournisseur", { k: v }); },
  pxPreview() { SFX.tap(); try { window.open(typeof cmUrl === "function" ? cmUrl("") : "commande/?r=demo", "_blank", "noopener"); } catch (e) {} },
  pxPreset(el, id, v) { const p = PX_PRESETS[+v]; if (!p) return; PX.F = { id: "", on: true, ...JSON.parse(JSON.stringify(p)), ids: [] }; SFX.tap(); openSheet(pxSheet()); },
  pxEdit(el, id, v) { const r = v && pxCfg().hh.find((x) => x.id === v); PX.F = r ? JSON.parse(JSON.stringify(r)) : { id: "", on: true, t: "Happy hour", days: [1, 2, 3, 4, 5], from: "17:00", to: "19:00", pct: 30, secs: pxSecs().some((s) => s.id === "boisson") ? ["boisson"] : [], ids: [] }; SFX.tap(); openSheet(pxSheet()); },
  pxFDay(el, id, v) { pxFRead(); const F = PX.F, d = +v; F.days = F.days.includes(d) ? F.days.filter((x) => x !== d) : [...F.days, d]; SFX.tick(); buzz(4); pxSheetPaint(); },
  pxFPct(el, id, v) { pxFRead(); PX.F.pct = +v; const p = $("#pxP"); if (p) p.value = ""; SFX.tick(); buzz(4); pxSheetPaint(); },
  pxFSec(el, id, v) { pxFRead(); const F = PX.F; F.secs = F.secs.includes(v) ? F.secs.filter((x) => x !== v) : [...F.secs, v]; SFX.tick(); buzz(4); pxSheetPaint(); },
  pxFId(el, id, v) { pxFRead(); const F = PX.F; F.ids = F.ids.includes(v) ? F.ids.filter((x) => x !== v) : [...F.ids, v]; SFX.tick(); buzz(4); pxSheetPaint(); },
  async pxHHSave() {
    pxFRead(); const F = PX.F; if (!F) return; F.t = String(F.t || "").trim() || "Happy hour";
    const bad = !F.days.length ? "Choisissez au moins un jour" : pxMin(F.from) == null || pxMin(F.to) == null || F.from === F.to ? "Vérifiez les heures" : !F.secs.length && !F.ids.length ? "Choisissez sur quoi s'applique la remise" : "";
    if (bad) { SFX.err(); buzz([20, 40, 20]); toast(bad, "warn"); return; }
    const C = pxCfg(); const r = { id: F.id || "hh" + rid6(), on: F.on !== false, t: F.t.slice(0, 40), days: F.days, from: F.from, to: F.to, pct: F.pct, secs: F.secs, ids: F.ids };
    const hh = F.id ? C.hh.map((x) => (x.id === F.id ? r : x)) : [...C.hh, r];
    closeSheet(); SFX.done(); buzz([10, 40, 10]); if (!F.id) burst(); PX.F = null; PX.tab = "hh";
    await pxSave({ hh }); logEvent("note", `${F.id ? "a modifié" : "a créé"} le happy hour « ${r.t} » (−${r.pct} %, ${pxDaysTx(r.days).toLowerCase()} ${r.from}–${r.to})`, { area: "prix" });
    toast(F.id ? "Happy hour mis à jour" : "Happy hour programmé : il se lance tout seul");
  },
  async pxHHDel(el, id, v) {
    if (!el.dataset.sure) { el.dataset.sure = "1"; el.textContent = "Touchez encore pour supprimer"; el.classList.add("danger"); SFX.tick(); return; }
    const C = pxCfg(), old = C.hh; closeSheet(); SFX.done(); PX.F = null; await pxSave({ hh: old.filter((x) => x.id !== v) });
    toastUndo("Happy hour supprimé"); S.ui.undo = async () => { await pxSave({ hh: old }); };
  },
  async pxHHOn(el, id, v) { const C = pxCfg(); const hh = C.hh.map((x) => (x.id === v ? { ...x, on: !x.on } : x)); const r = hh.find((x) => x.id === v); el.classList.toggle("on", !!(r && r.on)); SFX.tick(); buzz(6); await pxSave({ hh }); if (r) toast(r.on ? `« ${r.t} » activé` : `« ${r.t} » coupé`); },
  async pxJourSet(el, id, v) {
    const n = (S.notes || []).find((x) => x.id === id); if (!n) return; const C = pxCfg(); const s = pxSuggest(C).find((x) => x.n.id === id);
    const pct = Math.max(0, Math.min(90, +v || 0)); closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst();
    await pxSave({ today: { day: dayKey(), noteId: id, pct, why: s ? pxWhyTx(s.why[0]) : "", auto: false, at: Date.now(), by: S.me.name || "" } });
    logEvent("note", `a mis en plat du jour : ${n.title}${pct ? ` à −${pct} %` : ""}`, { area: "prix" }); PX.tab = "jour"; if (S.route !== "prix") go("prix"); else rerender();
    toast(`${n.title} est le plat du jour sur le menu QR`);
  },
  async pxJourOff() { const C = pxCfg(), old = C.today; SFX.tap(); await pxSave({ today: { day: dayKey(), off: true, noteId: "", pct: 0 } }); toastUndo("Plus de plat du jour aujourd'hui"); S.ui.undo = async () => { await pxSave({ today: old }); }; },
  pxJourPick() { SFX.tap(); openSheet(pxPickSheet()); },
  async pxJourAuto() { const C = pxCfg(); SFX.tick(); buzz(6); await pxSave({ jour: { ...C.jour, auto: !C.jour.auto } }); if (!C.jour.auto) { toast("Chaque matin, le plat du jour se choisit tout seul"); pxAutoSoon(); } },
  async pxJourPct(el, id, v) { const C = pxCfg(); SFX.tick(); await pxSave({ jour: { ...C.jour, pct: +v } }); },
  async pxJourH(el, id, v) { const C = pxCfg(); SFX.tick(); await pxSave({ jour: { ...C.jour, horizon: +v } }); },
  pxTeam() {
    const T = pxToday(); if (!T) return; const c = pxCap(T.n, +T.pct || 0), u = pxUnder(T.n, c);
    const text = `${T.n.title} · ${pxEur(u.ttc).replace(",00", "")}${c ? ` (−${c} %)` : ""}${T.why ? `. Pour écouler : ${T.why}` : ""}`;
    if (typeof CS !== "undefined" && ACT.csNew && typeof csNewSheet === "function") { ACT.csNew(null, null, "plat"); if (CS.F) { CS.F.text = text; openSheet(csNewSheet()); const t = $("#csNewTx"); if (t && !t.value) t.value = text; } return; }
    try { navigator.clipboard.writeText(text); toast("Texte copié : collez-le à l'équipe"); } catch (e) { toast(text); }
  },
  async pxBack(el, id, v, ev) {
    const n = (S.notes || []).find((x) => x.id === id); if (!n) return; const old = num(n.price), price = Math.round(+v * 100) / 100; const key = el.dataset.k; const C = pxCfg();
    SFX.done(); buzz([10, 40, 10]); burst(); n.price = price;
    await safe(DB.update("notes", id, { price, updatedAt: Date.now() }));
    await pxSave({ done: { ...C.done, [key]: { at: Date.now(), by: S.me.name || "", act: "prix", from: old, to: price } } });
    logEvent("note", `a passé ${n.title} de ${pxEur(old)} à ${pxEur(price)} (hausse fournisseur)`, { area: "prix" });
    toastUndo(`${n.title} passe à ${pxEur(price)}`); S.ui.undo = async () => { n.price = old; await DB.update("notes", id, { price: old, updatedAt: Date.now() }); const D2 = { ...pxCfg().done }; delete D2[key]; await pxSave({ done: D2 }); };
  },
  async pxIgnore(el) { const key = el.dataset.k, C = pxCfg(); SFX.tap(); await pxSave({ done: { ...C.done, [key]: { at: Date.now(), by: S.me.name || "", act: "ignore" } } }); toastUndo("Alerte ignorée"); S.ui.undo = async () => { const D2 = { ...pxCfg().done }; delete D2[key]; await pxSave({ done: D2 }); }; },
  async pxDrop(el, id, v) { const C = pxCfg(); SFX.tick(); await pxSave({ alert: { ...C.alert, drop: +v } }); },
  async pxTol(el, id, v) { const C = pxCfg(); SFX.tick(); await pxSave({ alert: { ...C.alert, tol: +v } }); },
  async pxFloor(el, id, v) { SFX.tick(); await pxSave({ floor: +v }); toast(`Les remises gardent un food cost sous ${v} %`); },
});
