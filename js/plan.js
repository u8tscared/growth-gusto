/* Growth Gusto — area: plan de salle (route « plan ») + placement automatique des tables. Prefix « pl ».
   - Éditeur : zones (Salle, Terrasse, Étage…), tables de 1 à 20 places (ronde, carrée, longue), repères (bar, entrée, cuisine,
     fenêtre, plante), glisser du doigt, pivoter, dupliquer. Enregistré tout seul (gérant).
   - Plan vivant dans Réservations : la salle à l'heure choisie (curseur), libre / réservée / installée, et la « rotation »
     (une ligne par table, une barre par réservation) pour voir qui s'enchaîne sur quelle table.
   - Placement automatique : chaque réservation sans table reçoit la meilleure table. Le moteur cherche à perdre le moins de tables :
     il enchaîne une table réservée à 12:15 avec celle de 13:30 plutôt que d'entamer une table vide, garde les grandes tables pour les
     groupes, assemble deux tables voisines pour un groupe, respecte « terrasse si possible » et « aime la table 7 ».
     Une table choisie à la main, ou des clients installés, ne bougent jamais.
   - Réservation en ligne : avec un plan, la page publique ne propose que les créneaux où une table existe vraiment (fit).
   Data (restos/{rid}.resaCfg, backward compatible, written whole like js/resa.js does):
     tables:[{id,n,seats,zone,x,y,shape:"rond"|"carre"|"long",rot:0|90}]   x,y = centre, in plan units (PL_W across)
     zones:[{id,name,out}]  decor:[{id,zone,kind,x,y,rot}]  autoTables (default on)  joinTables (default on)  planOnline (default on)
     turn:{ [serviceId]: minutes }  how long a table stays taken (default 1 h 15 at lunch, 1 h 45 at dinner, +15 min from 6 people)
   bookings/{id} gain: tableWith (second table when two are joined), tableAuto (true = placed by the engine, may move;
     false = chosen by hand, never moves; missing on old bookings with a table = by hand).
   Exposed: plSolve(), plApply(), plOnRows(), plLive(), plPubFit(), plQuickHTML(), plCfgCard(), plLabel(). */
"use strict";

TAB_OF.plan = "more";
Object.assign(IC, {
  plRot: ["M21 12a9 9 0 1 1-3-6.7", "M21 4v5h-5"],
  plDup: ["r:8,8,13,13,2", "M4 16V5a1 1 0 0 1 1-1h11"],
  plWand: ["m15 4 5 5", "M3 21 15.5 8.5", "f:M17 2.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z", "M6 3v3", "M4.5 4.5h3", "M19 15v3", "M17.5 16.5h3"],
  plZone: ["r:3,3,18,18,3", "M3 12h7", "M14 12h7", "M12 3v5", "M12 16v5"],
  plSun: ["c:12,12,4", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m4.9 19.1 1.4-1.4", "m17.7 6.3 1.4-1.4"],
  plJoin: ["r:2,8,8,8,1.5", "r:14,8,8,8,1.5", "M10 12h4"],
});

const PL_W = 14; /* plan width in units (≈ 40 cm each) */
const PL_DECOR = {
  bar: { t: "Bar", w: 5.5, h: 1.3 },
  entree: { t: "Entrée", w: 2.4, h: 0.55 },
  cuisine: { t: "Cuisine", w: 4, h: 2.2 },
  fenetre: { t: "Fenêtre", w: 4, h: 0.35 },
  plante: { t: "Plante", w: 1, h: 1 },
  pilier: { t: "Pilier", w: 0.8, h: 0.8 },
};
const PL_SHAPES = [["rond", "Ronde"], ["carre", "Carrée"], ["long", "Longue"]];
const PL = { ed: null, sel: null, zone: null, drag: null, at: {}, saved: 0, done: new Map(), fitMemo: new Map(), q: null, view: "salle" };

/* ───────── geometry ───────── */
const plSeats = (t) => Math.max(1, Math.min(20, +t.seats || 2));
const plShape = (t) => (PL_SHAPES.some(([k]) => k === t.shape) ? t.shape : plSeats(t) >= 5 ? "long" : "carre");
function plGeo(t) {
  const s = plSeats(t), sh = plShape(t); let w, h;
  if (sh === "rond") w = h = s <= 2 ? 1.9 : s <= 4 ? 2.4 : s <= 6 ? 3 : s <= 8 ? 3.5 : 4.2;
  else if (sh === "carre") w = h = s <= 2 ? 1.8 : s <= 4 ? 2.3 : s <= 8 ? 2.9 : 3.6;
  else { const per = Math.ceil(s / 2); w = Math.max(2.4, per * 1.25 + 0.4); h = s <= 4 ? 1.8 : 2; }
  if (+t.rot === 90) [w, h] = [h, w];
  return { sh, w, h };
}
function plDecoGeo(d) { const k = PL_DECOR[d.kind] || PL_DECOR.plante; return +d.rot === 90 ? { w: k.h, h: k.w } : { w: k.w, h: k.h }; }
/* chairs around a table, relative to its centre */
function plChairs(t) {
  const s = plSeats(t), { sh, w, h } = plGeo(t), out = [], o = 0.46;
  if (sh === "rond") { const R = w / 2 + o; for (let i = 0; i < s; i++) { const a = (-90 + (i * 360) / s) * (Math.PI / 180); out.push([Math.cos(a) * R, Math.sin(a) * R]); } return out; }
  const horiz = w >= h, L = horiz ? w : h, Sd = horiz ? h : w;
  const side = (n, len, fix, along) => { for (let i = 0; i < n; i++) { const p = -len / 2 + (len * (i + 0.5)) / n; out.push(along ? [p, fix] : [fix, p]); } };
  if (sh === "carre") {
    const c = [0, 0, 0, 0]; for (let i = 0; i < s; i++) c[s === 2 ? i * 1 : i % 4]++; /* 2 → face à face ; 3, 4… → tour de table */
    side(c[0], w, -h / 2 - o, true); side(c[1], w, h / 2 + o, true); side(c[2], h, -w / 2 - o, false); side(c[3], h, w / 2 + o, false);
    return out;
  }
  const a = Math.ceil(s / 2), b = Math.floor(s / 2);
  if (horiz) { side(a, L, -Sd / 2 - o, true); side(b, L, Sd / 2 + o, true); } else { side(a, L, -Sd / 2 - o, false); side(b, L, Sd / 2 + o, false); }
  return out;
}
const plSnap = (v) => Math.round(v * 2) / 2;

/* ───────── config ───────── */
function plRaw() { return (S.resto && S.resto.resaCfg) || null; }
function plZones(cfg) {
  const z = Array.isArray(cfg.zones) && cfg.zones.length ? cfg.zones.map((x) => ({ id: x.id, name: x.name || "Zone", out: !!x.out })) : [{ id: "salle", name: "Salle", out: false }];
  (cfg.tables || []).forEach((t) => { const id = t.zone || "salle"; if (!z.find((x) => x.id === id)) z.push({ id, name: id === "terrasse" ? "Terrasse" : id === "salle" ? "Salle" : id, out: id === "terrasse" }); });
  if (!z.find((x) => x.id === "salle") && !z.length) z.push({ id: "salle", name: "Salle", out: false });
  return z;
}
/* auto layout for tables without a position (old configs, the demo, the quick builder) */
function plPack(list, startY = 1.3) {
  let x = 0.9, y = startY, rowH = 0;
  list.forEach((t) => {
    const { w, h } = plGeo(t), need = w + 2.1;
    if (x + w > PL_W - 0.7 && x > 1) { x = 0.9; y += rowH + 2.1; rowH = 0; }
    t.x = plSnap(x + w / 2 + 0.25); t.y = plSnap(y + h / 2); x += need; rowH = Math.max(rowH, h);
  });
  return list;
}
function plTables(cfg) {
  const T = (cfg.tables || []).map((t) => ({ ...t, zone: t.zone || "salle", seats: plSeats(t), shape: plShape(t), rot: +t.rot === 90 ? 90 : 0 }));
  plZones(cfg).forEach((z) => {
    const mine = T.filter((t) => t.zone === z.id), placed = mine.filter((t) => isFinite(+t.x) && isFinite(+t.y) && t.x !== "" && t.y !== "" && t.x != null && t.y != null);
    const todo = mine.filter((t) => !placed.includes(t)).sort((a, b) => a.seats - b.seats || String(a.n).localeCompare(String(b.n), "fr", { numeric: true }));
    const top = placed.length ? Math.max(...placed.map((t) => +t.y + plGeo(t).h / 2)) + 1.6 : 1.3;
    plPack(todo, top);
    placed.forEach((t) => { t.x = +t.x; t.y = +t.y; });
  });
  return T;
}
const plOn = (cfg) => !!(cfg && (cfg.tables || []).length) && cfg.autoTables !== false;
function plDur(cfg, svc, covers) {
  const tn = (cfg.turn || {})[svc && svc.id]; const base = +tn > 0 ? +tn : svc && rsMin(svc.from) >= 16 * 60 ? 105 : 75;
  return base + ((+covers || 0) >= 6 ? 15 : 0);
}
const plDurBase = (cfg, svc) => plDur(cfg, svc, 2);
const plHmLong = (m) => (m % 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m / 60} h`);

/* ───────── the engine ───────── */
/* units a booking can take: every table, and two or three neighbouring tables of a zone pushed together for a group
   (two tables of 2 make a table of 4, three make a table of 6). A joined unit costs more than a single table, so the
   engine only joins when no single table fits. bookings.tableWith holds the other table(s), comma separated. */
const plAdj = (a, b) => { if (a.zone !== b.zone) return false; const ga = plGeo(a), gb = plGeo(b), dx = Math.abs(a.x - b.x) - (ga.w + gb.w) / 2, dy = Math.abs(a.y - b.y) - (ga.h + gb.h) / 2; return Math.max(dx, dy) <= 2.6 && Math.min(dx, dy) <= 0.2; };
function plUnits(cfg, T) {
  const U = T.map((t) => ({ key: t.id, ids: [t.id], cap: t.seats, zone: t.zone, pair: false, n: 1 }));
  if (cfg.joinTables === false) return U;
  const adj = T.map((a, i) => T.map((b, j) => i !== j && plAdj(a, b)));
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    if (!adj[i][j]) continue; const a = T[i], b = T[j];
    U.push({ key: a.id + "+" + b.id, ids: [a.id, b.id], cap: a.seats + b.seats, zone: a.zone, pair: true, n: 2 });
    for (let k = j + 1; k < T.length; k++) if (adj[i][k] || adj[j][k]) { const c = T[k]; U.push({ key: [a.id, b.id, c.id].join("+"), ids: [a.id, b.id, c.id], cap: a.seats + b.seats + c.seats, zone: a.zone, pair: true, n: 3 }); }
  }
  /* the same three tables can be reached from two pairs: keep one */
  const seen = new Set(); return U.filter((u) => { const k = u.ids.slice().sort().join("+"); if (seen.has(k)) return false; seen.add(k); return true; });
}
const plWith = (b) => String(b.tableWith || "").split(",").map((x) => x.trim()).filter(Boolean);
const plTblOf = (b) => [b.table, ...plWith(b)].filter(Boolean);
/* the table a note asks for: « table 7 », « aime la table 12 » (booking note, then the client file) */
function plWish(b, T) {
  const txt = [b.notes || "", (typeof rsClientOf === "function" && b.phone && (rsClientOf(b.phone) || {}).notes) || ""].join(" ");
  const m = /\btable\s*(?:n[°o]\s*)?([a-z]?\d{1,3}[a-z]?)\b/i.exec(txt); const t = m && T.find((x) => String(x.n).toLowerCase() === m[1].toLowerCase());
  const out = /terrasse|dehors|ext[ée]rieur|au soleil/i.test(txt) ? 1 : /int[ée]rieur|dedans|en salle|au chaud|pas en terrasse/i.test(txt) ? -1 : 0;
  return { table: t ? t.id : "", out };
}
/* solve one service: { assign: {bookingId: {table, with}}, unplaced: [ids], free: [ids], stats } */
function plSolve(cfg, day, svc, opt = {}) {
  const T = opt.T || plTables(cfg), byId = new Map(T.map((t) => [t.id, t])), U = opt.U || plUnits(cfg, T), Z = plZones(cfg);
  const outZ = new Set(Z.filter((z) => z.out).map((z) => z.id));
  const now = day === dayKey() ? new Date().getHours() * 60 + new Date().getMinutes() : day < dayKey() ? 1e9 : -1;
  let list = (opt.books || rsOfDay(day).filter((b) => rsLive(b) && svc && rsSvcOf(cfg, day, b.time).id === svc.id)).map((b) => ({ b, s: rsMin(b.time), e: rsMin(b.time) + plDur(cfg, svc, b.covers), c: +b.covers || 1 }));
  if (opt.extra) list.push({ b: opt.extra, s: rsMin(opt.extra.time), e: rsMin(opt.extra.time) + plDur(cfg, svc, opt.extra.covers), c: +opt.extra.covers || 1, x: true });
  const valid = (b) => b.table && byId.has(b.table) && plWith(b).every((id) => byId.has(id));
  const fixed = [], free = [];
  list.forEach((r) => {
    const b = r.b, started = now >= 0 && r.s <= now + 20;
    if (r.x) free.push(r);
    else if (valid(b) && (b.tableAuto !== true || b.status === "arrive" || started || opt.keep)) fixed.push(r);
    else if (!b.table && b.tableAuto === false) { /* « aucune table », chosen by hand */ }
    else if (!valid(b) && started && b.status === "arrive") { /* seated on a table that was removed */ }
    else free.push(r);
  });
  const occ0 = new Map(T.map((t) => [t.id, []]));
  fixed.forEach((r) => plTblOf(r.b).forEach((id) => occ0.get(id) && occ0.get(id).push([r.s, r.e, r.b.id])));
  const fits = (occ, u, s, e) => u.ids.every((id) => (occ.get(id) || []).every(([a, z]) => e <= a || s >= z));
  const wishes = new Map(free.map((r) => [r.b.id, r.x ? { table: "", out: 0 } : plWish(r.b, T)]));
  const cost = (occ, r, u) => {
    const waste = u.cap - r.c; let k = waste * 3 + (u.pair ? 7 + waste + (u.n > 2 ? 9 : 0) : 0);
    if (waste >= 4) k += waste * 2; /* a couple on a table of 8: keeps the big tables for groups */
    u.ids.forEach((id) => {
      const L = occ.get(id) || []; let prev = -1, next = -1;
      L.forEach(([a, z]) => { if (z <= r.s && z > prev) prev = z; if (a >= r.e && (next < 0 || a < next)) next = a; });
      if (prev < 0 && next < 0) k += 2.2; /* an untouched table: start one only when no turned table fits */
      else { if (prev >= 0) k += Math.min(r.s - prev, 120) / 50; if (next >= 0) k += Math.min(next - r.e, 120) / 70; }
    });
    const w = wishes.get(r.b.id) || {};
    if (w.table && u.ids.includes(w.table)) k -= 6;
    if (w.out === 1) k += outZ.has(u.zone) ? -3 : 1.5; else if (w.out === -1) k += outZ.has(u.zone) ? 4 : 0;
    if (!r.x && r.b.table && u.ids[0] === r.b.table && u.ids.slice(1).join(",") === plWith(r.b).join(",")) k -= 1.6; /* stays where it was: no reshuffle */
    return k;
  };
  const place = (occ, r, avoid) => {
    let best = null, bk = Infinity;
    U.forEach((u) => { if (u.cap < r.c || (avoid && avoid === u.key) || !fits(occ, u, r.s, r.e)) return; const k = cost(occ, r, u); if (k < bk - 1e-9) { bk = k; best = u; } });
    if (best) best.ids.forEach((id) => occ.get(id).push([r.s, r.e, r.b.id]));
    return best;
  };
  const run = (order) => {
    const occ = new Map([...occ0].map(([k, v]) => [k, v.slice()])), got = new Map(), miss = [];
    order.forEach((r) => { const u = place(occ, r); if (u) got.set(r.b.id, u); else miss.push(r); });
    /* repair: a booking left without a table takes a table from one or two auto-placed bookings, which find another one */
    for (let pass = 0; pass < 2 && miss.length; pass++) {
      for (let mi = miss.length - 1; mi >= 0; mi--) {
        const r = miss[mi]; let ok = false;
        for (const u of U) {
          if (u.cap < r.c) continue;
          const clash = new Set(); u.ids.forEach((id) => (occ.get(id) || []).forEach(([a, z, bid]) => { if (!(r.e <= a || r.s >= z)) clash.add(bid); }));
          if (!clash.size || clash.size > 2 || [...clash].some((bid) => !got.has(bid))) continue;
          const moved = free.filter((x) => clash.has(x.b.id));
          const snap = new Map([...occ].map(([k, v]) => [k, v.slice()])), was = new Map(got);
          occ.forEach((v, k) => occ.set(k, v.filter(([, , bid]) => !clash.has(bid)))); moved.forEach((x) => got.delete(x.b.id));
          u.ids.forEach((id) => occ.get(id).push([r.s, r.e, r.b.id])); got.set(r.b.id, u);
          if (moved.every((x) => { const v = place(occ, x); if (v) got.set(x.b.id, v); return !!v; })) { ok = true; break; }
          occ.clear(); snap.forEach((v, k) => occ.set(k, v)); got.clear(); was.forEach((v, k) => got.set(k, v));
        }
        if (ok) miss.splice(mi, 1);
      }
    }
    const total = [...got].reduce((n, [bid, u]) => { const r = free.find((x) => x.b.id === bid); return n + (r ? cost(occ0, r, u) : 0); }, 0);
    return { got, miss, occ, sc: [miss.reduce((n, r) => n + r.c, 0), miss.length, [...got.values()].filter((u) => u.pair).length, total] };
  };
  const by = (f) => free.slice().sort((a, b) => f(a, b) || (a.b.id > b.b.id ? 1 : -1));
  const tries = [by((a, b) => b.c - a.c || a.s - b.s), by((a, b) => a.s - b.s || b.c - a.c), by((a, b) => (b.c >= 5) - (a.c >= 5) || a.s - b.s)];
  let best = null;
  const better = (x, y) => { for (let i = 0; i < x.length; i++) { if (x[i] < y[i] - 1e-9) return true; if (x[i] > y[i] + 1e-9) return false; } return false; };
  tries.forEach((o) => { const r = run(o); if (!best || better(r.sc, best.sc)) best = r; });
  const assign = {}; best.got.forEach((u, bid) => { assign[bid] = { table: u.ids[0], with: u.ids.slice(1).join(",") }; });
  return { assign, unplaced: best.miss.map((r) => r.b.id), free: free.map((r) => r.b.id), fixed: fixed.map((r) => r.b.id), occ: best.occ, T, list };
}
/* write the engine's choice (only what changed) */
async function plApply(day, svcId, { quiet = false } = {}) {
  const cfg = rsCfg(); if (!cfg.tables.length) return null;
  const svc = cfg.services.find((s) => s.id === svcId); if (!svc) return null;
  const res = plSolve(cfg, day, svc); const rows = rsRows(); let n = 0;
  const jobs = [];
  res.free.forEach((id) => {
    const b = rows.find((x) => x.id === id); if (!b) return; const a = res.assign[id] || { table: "", with: "" };
    if ((b.table || "") === a.table && (b.tableWith || "") === a.with && b.tableAuto === true) return;
    if (!a.table && !b.table && b.tableAuto === true) return;
    n++; jobs.push(DB.update("bookings", id, { table: a.table, tableWith: a.with, tableAuto: true }).catch((e) => console.warn("plan apply", e && e.code)));
  });
  await Promise.all(jobs);
  if (!quiet) logEvent && n && logEvent("resa", `a placé ${rsPl(n, "réservation")} sur le plan (${svc.name})`);
  return { n, unplaced: res.unplaced.length, res };
}
/* new or changed bookings: place them as soon as they arrive (every device runs the same deterministic engine) */
const plAuto = debounce(async () => {
  const cfg = rsCfg(); if (!plOn(cfg) || !S.rid || DB.mode === "none") return;
  const T = plTables(cfg), ids = new Set(T.map((t) => t.id)), today = dayKey(), end = addDays(today, 120), groups = new Map();
  rsRows().forEach((b) => {
    if (!rsLive(b) || !b.date || b.date < today || b.date > end) return;
    const need = (!b.table && b.tableAuto !== false) || (b.table && !ids.has(b.table)) || plWith(b).some((id) => !ids.has(id));
    const svc = rsSvcOf(cfg, b.date, b.time); if (!svc || !svc.id) return;
    const k = b.date + "|" + svc.id; if (!groups.has(k)) groups.set(k, { day: b.date, svc: svc.id, need: false, list: [] }); const g = groups.get(k); g.list.push(b); if (need) g.need = true;
  });
  const cap = new Map(T.map((t) => [t.id, t.seats]));
  for (const [k, g] of groups) {
    if (!g.need) {
      /* an auto-placed booking that now clashes (time or covers changed) is placed again */
      const svc = cfg.services.find((s) => s.id === g.svc), iv = (b) => [rsMin(b.time), rsMin(b.time) + plDur(cfg, svc, b.covers)];
      g.need = g.list.some((b) => b.tableAuto === true && b.table && (plTblOf(b).reduce((n, id) => n + (cap.get(id) || 0), 0) < (+b.covers || 1) || g.list.some((o) => o !== b && plTblOf(o).some((id) => plTblOf(b).includes(id)) && (() => { const [a, z] = iv(b), [c, d] = iv(o); return a < d && c < z; })())));
    }
    if (!g.need) continue;
    const sig = rsRows().filter((b) => b.date === g.day && rsLive(b)).map((b) => [b.id, b.time, b.covers, b.table, b.tableWith, b.tableAuto, b.status].join(",")).sort().join(";") + "|" + plSig(cfg);
    if (PL.done.get(k) === sig) continue; PL.done.set(k, sig);
    await plApply(g.day, g.svc, { quiet: true });
  }
}, 900);
function plOnRows() { try { plAuto(); } catch (e) { console.warn("plan auto", e); } }
const plSig = (cfg) => JSON.stringify([(cfg.tables || []).map((t) => [t.id, t.seats, t.zone, t.x, t.y, t.shape, t.rot]), cfg.turn || {}, cfg.joinTables !== false, (cfg.zones || []).map((z) => [z.id, z.out])]);

/* ───────── online: the biggest party a slot can still seat, per day with bookings ───────── */
function plPubFit(cfg) {
  if (!plOn(cfg) || cfg.planOnline === false) return {};
  const T = plTables(cfg), U = plUnits(cfg, T), fitMax = Math.max(0, ...U.map((u) => u.cap)), today = dayKey(), end = addDays(today, cfg.horizon + 1), max = Math.max(1, cfg.maxOnline || 8);
  const byDay = {}; rsRows().forEach((b) => { if (rsLive(b) && b.date >= today && b.date <= end) (byDay[b.date] ||= []).push(b); });
  const fit = {}, cs = plSig(cfg);
  Object.keys(byDay).sort().forEach((k) => {
    const sig = cs + "|" + byDay[k].map((b) => [b.id, b.time, b.covers, b.table, b.tableWith, b.tableAuto, b.status].join(",")).sort().join(";");
    let m = PL.fitMemo.get(k);
    if (!m || m.sig !== sig) {
      const out = {};
      rsSvcsOn(cfg, k).forEach((s) => {
        const books = byDay[k].filter((b) => rsSvcOf(cfg, k, b.time).id === s.id); if (!books.length) return;
        rsSlots(cfg, s).forEach((t) => {
          let c = 0; const top = Math.min(max, fitMax);
          for (let n = 1; n <= top; n++) { const r = plSolve(cfg, k, s, { T, U, books, extra: { id: "~", time: t, covers: n }, keep: true }); if (r.unplaced.includes("~")) break; c = n; }
          if (c < top) out[t] = c;
        });
      });
      m = { sig, out }; PL.fitMemo.set(k, m);
    }
    if (Object.keys(m.out).length) fit[k] = m.out;
  });
  return { fit, fitMax };
}

/* ───────── drawing ───────── */
function plBounds(T, D, edit) {
  if (edit) { const b = Math.max(9, ...T.map((t) => t.y + plGeo(t).h / 2 + 1.2), ...D.map((d) => d.y + plDecoGeo(d).h / 2 + 0.8)); return { y0: 0, y1: Math.ceil(b + 2.5) }; }
  if (!T.length && !D.length) return { y0: 0, y1: 6 };
  const top = Math.min(...T.map((t) => t.y - plGeo(t).h / 2 - 0.9), ...D.map((d) => d.y - plDecoGeo(d).h / 2 - 0.4)), bot = Math.max(...T.map((t) => t.y + plGeo(t).h / 2 + 0.9), ...D.map((d) => d.y + plDecoGeo(d).h / 2 + 0.4));
  return { y0: Math.max(0, Math.floor(top * 2) / 2 - 0.3), y1: Math.ceil(bot * 2) / 2 + 0.3 };
}
const plTx = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
/* one zone as an SVG. st(t) → { cls, a, b } (state class, first and second line) for the live plan */
function plSvg(zone, T, D, o = {}) {
  const edit = o.mode === "edit", { y0, y1 } = plBounds(T, D, edit), H = y1 - y0;
  const over = new Set();
  if (edit) for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = T[i], b = T[j], ga = plGeo(a), gb = plGeo(b); if (Math.abs(a.x - b.x) < (ga.w + gb.w) / 2 + 0.35 && Math.abs(a.y - b.y) < (ga.h + gb.h) / 2 + 0.35) { over.add(a.id); over.add(b.id); } }
  const deco = D.map((d) => {
    const g = plDecoGeo(d), k = PL_DECOR[d.kind] || PL_DECOR.plante, x = d.x - g.w / 2, y = d.y - g.h / 2, sel = edit && PL.sel === "d:" + d.id;
    const lbl = g.w >= 2 || g.h >= 2 ? `<text x="${d.x}" y="${d.y + 0.17}" class="pl-dt"${g.h > g.w ? ` transform="rotate(-90 ${d.x} ${d.y})"` : ""}>${k.t}</text>` : "";
    const body = d.kind === "plante" ? `<circle cx="${d.x}" cy="${d.y}" r="${g.w / 2}" class="pl-d-plante"/><circle cx="${d.x - 0.15}" cy="${d.y - 0.12}" r="${g.w / 4}" class="pl-d-plante2"/>`
      : d.kind === "pilier" ? `<rect x="${x}" y="${y}" width="${g.w}" height="${g.h}" rx="0.12" class="pl-d-pilier"/>`
      : `<rect x="${x}" y="${y}" width="${g.w}" height="${g.h}" rx="${d.kind === "fenetre" || d.kind === "entree" ? 0.12 : 0.35}" class="pl-d-${d.kind}"/>${lbl}`;
    return `<g class="pl-d${sel ? " sel" : ""}"${edit ? ` data-pld="${esc(d.id)}"` : ""}>${body}</g>`;
  }).join("");
  const tabs = T.map((t, j) => {
    const { sh, w, h } = plGeo(t), x = t.x - w / 2, y = t.y - h / 2, s = o.st ? o.st(t) : {}, sel = edit && PL.sel === "t:" + t.id;
    const cls = ["pl-t", s.cls || "free", sel ? "sel" : "", over.has(t.id) ? "over" : "", o.pick ? "can" : ""].filter(Boolean).join(" ");
    const chairs = plChairs(t).map(([cx, cy]) => `<circle cx="${(t.x + cx).toFixed(2)}" cy="${(t.y + cy).toFixed(2)}" r="0.3" class="pl-ch"/>`).join("");
    const shape = sh === "rond" ? `<circle cx="${t.x}" cy="${t.y}" r="${w / 2}" class="pl-tb"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.22}" class="pl-tb"/>`;
    const small = Math.min(w, h) < 2.1;
    const txt = s.a ? `<text x="${t.x}" y="${t.y - (small ? 0.12 : 0.2)}" class="pl-tn sm">${esc(t.n)}</text><text x="${t.x}" y="${t.y + (small ? 0.5 : 0.55)}" class="pl-tw">${esc(plTx(s.a, Math.max(5, Math.floor(w * 3.2))))}</text>${s.b && !small ? `<text x="${t.x}" y="${t.y + 1.05}" class="pl-tw2">${esc(s.b)}</text>` : ""}`
      : `<text x="${t.x}" y="${t.y + (edit || o.mode === "mini" ? 0.27 : 0.05)}" class="pl-tn">${esc(t.n)}</text>${o.mode === "live" ? `<text x="${t.x}" y="${t.y + 0.62}" class="pl-ts">${t.seats} pl.</text>` : ""}`;
    const tag = s.more ? `<g class="pl-more"><circle cx="${t.x + w / 2 - 0.05}" cy="${t.y - h / 2 + 0.05}" r="0.42"/><text x="${t.x + w / 2 - 0.05}" y="${t.y - h / 2 + 0.2}">${s.more}</text></g>` : "";
    const act = o.mode === "live" ? ` data-act="plTap" data-id="${esc(t.id)}" data-rsdropt="${esc(t.id)}" role="button" tabindex="0" aria-label="Table ${esc(t.n)}, ${t.seats} places${s.a ? `, ${esc(s.a)}` : ", libre"}"` : edit ? ` data-plt="${esc(t.id)}"` : "";
    return `<g class="${cls}" style="--j:${j}"${act}>${chairs}${shape}${txt}${tag}</g>`;
  }).join("");
  const z = o.zoneObj || {};
  return `<svg class="pl-svg ${edit ? "ed" : o.mode || ""}${z.out ? " out" : ""}" viewBox="0 ${y0} ${PL_W} ${H}" data-zone="${esc(zone)}" preserveAspectRatio="xMidYMin meet" style="aspect-ratio:${PL_W}/${H}">
    <defs><pattern id="plDots" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="0.045" class="pl-dot"/></pattern>
    <pattern id="plDeck" width="${PL_W}" height="0.9" patternUnits="userSpaceOnUse"><rect width="${PL_W}" height="0.9" class="pl-deck"/><rect y="0.86" width="${PL_W}" height="0.04" class="pl-deckl"/></pattern></defs>
    <rect x="0" y="${y0}" width="${PL_W}" height="${H}" rx="0.6" class="pl-floor"/>${edit ? `<rect x="0" y="${y0}" width="${PL_W}" height="${H}" fill="url(#plDots)"/>` : ""}
    ${deco}${tabs}</svg>`;
}

/* ───────── live plan inside Réservations ───────── */
function plAtKey(day, svc) { return day + "|" + (svc ? svc.id : ""); }
function plAt(cfg, day, svc) {
  if (!svc) return 0; const k = plAtKey(day, svc); if (PL.at[k] != null) return PL.at[k];
  const a = rsMin(svc.from), z = rsMin(svc.to) + plDurBase(cfg, svc); const now = new Date().getHours() * 60 + new Date().getMinutes();
  if (day === dayKey() && now >= a - 30 && now <= z) return Math.max(a, Math.floor(now / 15) * 15);
  return a;
}
function plLabel(b, cfg) {
  const T = (cfg || rsCfg()).tables || [], n = (id) => (T.find((t) => t.id === id) || {}).n;
  const a = b.table && n(b.table); if (!a) return ""; return [a, ...plWith(b).map(n).filter(Boolean)].join("+");
}
function plLive(cfg, day, svc, mine) {
  const T = plTables(cfg), Z = plZones(cfg), D = (cfg.decor || []).filter((d) => d && PL_DECOR[d.kind]), mgr = rsMgr();
  if (!T.length) return `<div class="glass pl-empty st" style="--i:4">${plArt()}<b>Dessinez votre salle</b><span>Vos tables, votre terrasse, du bout du doigt. Ensuite les réservations se placent toutes seules.</span>${mgr ? `<button class="btn acc" data-go="plan">${ico("plZone")}Créer mon plan de salle</button>` : `<em>Le gérant peut créer le plan.</em>`}</div>`;
  const live = mine.filter(rsLive), at = plAt(cfg, day, svc), dur = (b) => plDur(cfg, svc, b.covers);
  const by = new Map(T.map((t) => [t.id, []])); live.forEach((b) => plTblOf(b).forEach((id) => by.get(id) && by.get(id).push(b)));
  by.forEach((L) => L.sort((a, b) => (a.time > b.time ? 1 : -1)));
  const pick = R.pick && live.find((b) => b.id === R.pick) ? R.pick : (R.pick = null);
  const st = (t) => {
    const L = by.get(t.id) || [];
    const cur = L.find((b) => b.status === "arrive" && rsMin(b.time) <= at + 30 && at < rsMin(b.time) + dur(b) + 30) || L.find((b) => rsMin(b.time) <= at && at < rsMin(b.time) + dur(b));
    const nx = L.find((b) => rsMin(b.time) > at);
    const more = L.length > 1 ? `${L.length}×` : "";
    if (cur) return { cls: cur.status === "arrive" ? "seated" : "booked", a: firstName(cur.name) || cur.name || "", b: `${cur.time} · ${+cur.covers || 0}p`, more };
    if (nx && rsMin(nx.time) - at <= 45) return { cls: "soon", a: `${nx.time}`, b: `${firstName(nx.name) || ""} · ${+nx.covers || 0}p`, more };
    return { cls: "free", more };
  };
  const a0 = svc ? rsMin(svc.from) : 0, a1 = svc ? rsMin(svc.to) + plDurBase(cfg, svc) : 0;
  const noTable = live.filter((b) => !plTblOf(b).some((id) => by.has(id)));
  const seated = T.filter((t) => ["booked", "seated"].includes(st(t).cls)), seats = T.reduce((n, t) => n + t.seats, 0), used = seated.reduce((n, t) => n + t.seats, 0);
  const turns = [...by.values()].filter((L) => L.length > 1).length;
  const zoneHtml = Z.filter((z) => T.some((t) => t.zone === z.id) || D.some((d) => d.zone === z.id)).map((z) => `<div class="pl-zone"><div class="pl-zh">${z.out ? ico("plSun") : ""}<b>${esc(z.name)}</b><span>${T.filter((t) => t.zone === z.id).reduce((n, t) => n + t.seats, 0)} places</span></div>
    ${plSvg(z.id, T.filter((t) => t.zone === z.id), D.filter((d) => d.zone === z.id), { mode: "live", st, pick, zoneObj: z })}</div>`).join("");
  const scrub = svc ? `<div class="pl-scrub"><button class="iconbtn sm" data-act="plAt" data-v="-15" aria-label="Quinze minutes plus tôt" ${at <= a0 ? "disabled" : ""}>${ico("back")}</button>
    <label class="pl-range"><span class="pl-at"><em>La salle à</em><b class="mono">${rsHm(at)}</b></span><input type="range" min="${a0}" max="${a1}" step="15" value="${at}" data-plat="${esc(plAtKey(day, svc))}" aria-label="Heure du plan"></label>
    <button class="iconbtn sm" data-act="plAt" data-v="15" aria-label="Quinze minutes plus tard" ${at >= a1 ? "disabled" : ""}>${ico("chev")}</button></div>` : "";
  return `<div class="glass pl-live st" style="--i:4" id="plLive">
    ${scrub}
    <div class="pl-kpi"><span><b>${used}</b>/${seats} places prises à ${rsHm(at)}</span>${turns ? `<span><b>${turns}</b> table${turns > 1 ? "s" : ""} servie${turns > 1 ? "s" : ""} deux fois</span>` : ""}${noTable.length ? `<span class="bad"><b>${noTable.length}</b> sans table</span>` : ""}</div>
    <div class="rs-legend"><span class="l-free">Libre</span><span class="l-soon">Bientôt</span><span class="l-booked">Réservée</span><span class="l-seated">Installée</span></div>
    <div class="pl-zones">${zoneHtml}</div>
    ${noTable.length ? `<div class="rs-unas"><div class="rs-zh">${pick ? "Touchez une table" : "Sans table"}</div><div class="rs-chips">${noTable.map((b) => `<button class="rs-chip${pick === b.id ? " on" : ""}" data-act="rsPick" data-id="${esc(b.id)}" data-rsdrag="${esc(b.id)}" draggable="true"><b>${b.time}</b>${esc(firstName(b.name) || b.name || "")}<i>${+b.covers || 0}p</i></button>`).join("")}</div></div>` : ""}
    <div class="pl-acts">${live.length ? `<button class="btn ${noTable.length ? "acc" : "soft"} sm" data-act="plAutoNow">${ico("plWand")}${noTable.length ? "Placer automatiquement" : "Optimiser les tables"}</button>` : ""}${mgr ? `<button class="btn ghost sm" data-go="plan">${ico("plZone")}Modifier le plan</button>` : ""}</div>
    ${svc ? plRota(cfg, T, Z, by, live, svc, day, at, a0, a1) : ""}
  </div>`;
}
/* rotation: one row per table, one bar per booking, the chosen time as a line */
function plRota(cfg, T, Z, by, live, svc, day, at, a0, a1) {
  if (!live.length) return "";
  const span = Math.max(30, a1 - a0), pc = (m) => (((m - a0) / span) * 100).toFixed(2);
  const ticks = []; for (let m = Math.ceil(a0 / 30) * 30; m <= a1; m += 30) ticks.push(m);
  const order = Z.flatMap((z) => T.filter((t) => t.zone === z.id).sort((a, b) => String(a.n).localeCompare(String(b.n), "fr", { numeric: true })));
  const now = day === dayKey() ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
  const rows = order.map((t) => {
    const L = by.get(t.id) || [];
    const bars = L.map((b) => { const s = rsMin(b.time), e = s + plDur(cfg, svc, b.covers), st = b.status === "arrive" ? "seated" : "booked", man = b.tableAuto !== true;
      return `<button class="pl-bar ${st}${b.tableWith ? " join" : ""}" style="left:${pc(Math.max(a0, s))}%;width:${Math.max(4, pc(Math.min(a1, e)) - pc(Math.max(a0, s)))}%" data-act="rsOpen" data-id="${esc(b.id)}" title="${esc(b.name || "")} · ${b.time} · ${+b.covers || 0} pers.${man ? " · placée à la main" : ""}"><b>${esc(firstName(b.name) || b.name || "")}</b><i>${+b.covers || 0}</i>${man ? `<em aria-hidden="true"></em>` : ""}</button>`; }).join("");
    return `<div class="pl-rr${L.length ? "" : " idle"}"><span class="pl-rn"><b>${esc(t.n)}</b><i>${t.seats}</i></span><div class="pl-rl">${bars}</div></div>`;
  }).join("");
  return `<details class="pl-rota" ${PL.rota !== false ? "open" : ""}><summary data-act="plRotaTg"><b>Rotation des tables</b><span>Qui s'enchaîne sur quelle table, de ${rsHm(a0)} à ${rsHm(a1)}</span>${ico("chev")}</summary>
    <div class="pl-rg" style="--at:${(pc(at) / 100).toFixed(4)}${now >= a0 && now <= a1 ? `;--now:${(pc(now) / 100).toFixed(4)}` : ""}">
      <div class="pl-rh"><span class="pl-rn"></span><div class="pl-rl">${ticks.map((m) => `<i style="left:${pc(m)}%">${m % 60 ? "" : rsHm(m).replace(":00", "h")}</i>`).join("")}</div></div>
      ${rows}
      <div class="pl-rline" aria-hidden="true"></div>${now >= a0 && now <= a1 ? `<div class="pl-rnow" aria-hidden="true"></div>` : ""}
    </div></details>`;
}
function plArt() {
  return `<svg class="pl-art" viewBox="0 0 160 96" aria-hidden="true"><rect x="8" y="10" width="144" height="76" rx="12" fill="#F4EDE0"/>
    <g class="pl-art-t" style="--j:0"><circle cx="40" cy="38" r="11" fill="#fff" stroke="#DCCFB8" stroke-width="2"/><circle cx="40" cy="22" r="3.6" fill="#DCCFB8"/><circle cx="40" cy="54" r="3.6" fill="#DCCFB8"/></g>
    <g class="pl-art-t" style="--j:1"><rect x="66" y="27" width="28" height="22" rx="5" fill="#FFF3D6" stroke="#F6B93B" stroke-width="2"/><circle cx="74" cy="22" r="3.6" fill="#F6B93B"/><circle cx="86" cy="22" r="3.6" fill="#F6B93B"/><circle cx="74" cy="54" r="3.6" fill="#F6B93B"/><circle cx="86" cy="54" r="3.6" fill="#F6B93B"/></g>
    <g class="pl-art-t" style="--j:2"><rect x="108" y="24" width="30" height="40" rx="6" fill="#5B2BFF"/><circle cx="102" cy="34" r="3.6" fill="#2A0BA6"/><circle cx="102" cy="54" r="3.6" fill="#2A0BA6"/><circle cx="144" cy="34" r="3.6" fill="#2A0BA6"/><circle cx="144" cy="54" r="3.6" fill="#2A0BA6"/></g>
    <rect x="30" y="70" width="52" height="8" rx="4" fill="#1B1530" opacity=".85"/></svg>`;
}

/* ───────── editor (route « plan ») ───────── */
function plEdLoad() {
  const raw = plRaw() || (typeof rsDefCfg === "function" ? rsDefCfg() : { services: [] }), cfg = rsCfg();
  PL.ed = { tables: plTables(cfg).map((t) => ({ id: t.id, n: String(t.n), seats: t.seats, zone: t.zone, x: t.x, y: t.y, shape: t.shape, rot: t.rot })),
    zones: plZones(cfg), decor: (raw.decor || []).filter((d) => d && PL_DECOR[d.kind]).map((d) => ({ ...d })), autoTables: raw.autoTables !== false, joinTables: raw.joinTables !== false, planOnline: raw.planOnline !== false, turn: { ...(raw.turn || {}) }, rid: S.rid };
  if (!PL.ed.zones.find((z) => z.id === PL.zone)) PL.zone = PL.ed.zones[0].id;
  PL.sel = null;
}
const plNewId = (p = "t") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const plWrite = debounce(async () => {
  const e = PL.ed; if (!e || !S.rid || e.rid !== S.rid) return;
  const raw = plRaw() || (typeof rsDefCfg === "function" ? rsDefCfg() : {});
  const next = DB.clean({ ...raw, tables: e.tables.map((t) => ({ id: t.id, n: String(t.n || "").trim() || "?", seats: plSeats(t), zone: t.zone, x: t.x, y: t.y, shape: t.shape, rot: t.rot || 0 })),
    zones: e.zones, decor: e.decor, autoTables: e.autoTables, joinTables: e.joinTables, planOnline: e.planOnline, turn: e.turn });
  try { await safe(DB.update("restos", S.rid, { resaCfg: next })); } catch (x) { return; }
  PL.dirty = false; if (S.resto) S.resto.resaCfg = next; PL.saved = Date.now(); PL.done.clear(); PL.fitMemo.clear();
  const s = document.getElementById("plSaved"); if (s) { s.textContent = "Enregistré"; s.classList.remove("pop"); void s.offsetWidth; s.classList.add("pop"); }
  try { if (typeof rsSync === "function") rsSync(); } catch (x) {}
  plAuto();
}, 650);
function plChanged(paint = true) { PL.dirty = true; const s = document.getElementById("plSaved"); if (s) s.textContent = "Enregistrement…"; plWrite(); if (paint) plEdPaint(); }
function plEdPaint() { const r = document.getElementById("plEd"); if (r) r.innerHTML = plEdInner(); }
function plNextN(zone) {
  const e = PL.ed, nums = e.tables.map((t) => parseInt(t.n, 10)).filter((n) => !isNaN(n)), z = e.zones.find((x) => x.id === zone) || {};
  const zi = e.zones.findIndex((x) => x.id === zone), base = zi <= 0 ? 0 : z.out ? 20 * zi : 20 * zi;
  const mine = e.tables.filter((t) => t.zone === zone).map((t) => parseInt(t.n, 10)).filter((n) => !isNaN(n));
  let n = mine.length ? Math.max(...mine) + 1 : base + 1; while (nums.includes(n)) n++; return String(n);
}
function plFreeSpot(w, h, zone) {
  const e = PL.ed, T = e.tables.filter((t) => t.zone === zone), D = e.decor.filter((d) => d.zone === zone);
  const hit = (x, y) => T.some((t) => { const g = plGeo(t); return Math.abs(t.x - x) < (g.w + w) / 2 + 1.3 && Math.abs(t.y - y) < (g.h + h) / 2 + 1.3; }) || D.some((d) => { const g = plDecoGeo(d); return Math.abs(d.x - x) < (g.w + w) / 2 + 0.5 && Math.abs(d.y - y) < (g.h + h) / 2 + 0.5; });
  for (let y = 1.3 + h / 2; y < 60; y += 0.5) for (let x = 0.9 + w / 2; x <= PL_W - 0.7 - w / 2; x += 0.5) if (!hit(x, y)) return { x: plSnap(x), y: plSnap(y) };
  return { x: PL_W / 2, y: 2 };
}
function plEdInner() {
  const e = PL.ed, mgr = rsMgr(), z = e.zones.find((x) => x.id === PL.zone) || e.zones[0]; PL.zone = z.id;
  const T = e.tables.filter((t) => t.zone === z.id), D = e.decor.filter((d) => d.zone === z.id);
  const tot = e.tables.reduce((n, t) => n + plSeats(t), 0), zt = T.reduce((n, t) => n + plSeats(t), 0);
  const [kind, sid] = (PL.sel || ":").split(":"); const st = kind === "t" ? e.tables.find((t) => t.id === sid) : null, sd = kind === "d" ? e.decor.find((d) => d.id === sid) : null;
  const cfg = rsCfg();
  const insp = st ? `<div class="pl-insp glass" role="group" aria-label="Table ${esc(st.n)}">
      <div class="pl-ih"><label class="pl-num"><span>Table</span><input class="input" data-plnum="${esc(st.id)}" value="${esc(st.n)}" maxlength="6" inputmode="text" aria-label="Numéro de table"></label>
        <div class="rs-stp2"><button data-act="plSeat" data-v="-1" aria-label="Une place de moins" ${plSeats(st) <= 1 ? "disabled" : ""}>${ico("minus")}</button><b>${plSeats(st)}<i>places</i></b><button data-act="plSeat" data-v="1" aria-label="Une place de plus" ${plSeats(st) >= 20 ? "disabled" : ""}>${ico("plus")}</button></div></div>
      <div class="rs-seg pl-shapes">${PL_SHAPES.map(([k, l]) => `<button class="${plShape(st) === k ? "on" : ""}" data-act="plShape" data-v="${k}"><i class="pl-sh ${k}"></i>${l}</button>`).join("")}</div>
      <div class="pl-ib">${e.zones.length > 1 ? `<button class="btn soft sm" data-act="plMoveZone">${ico("plZone")}${esc((e.zones.find((x) => x.id !== st.zone) || {}).name || "Zone")}</button>` : ""}<button class="btn soft sm" data-act="plRot">${ico("plRot")}Pivoter</button><button class="btn soft sm" data-act="plDup">${ico("plDup")}Dupliquer</button><button class="btn soft sm pl-del" data-act="plDel" aria-label="Supprimer la table">${ico("trash")}</button><button class="btn ghost sm" data-act="plSelNone">OK</button></div>
    </div>`
    : sd ? `<div class="pl-insp glass"><div class="pl-ih"><b class="pl-dn">${(PL_DECOR[sd.kind] || {}).t || ""}</b></div><div class="pl-ib"><button class="btn soft sm" data-act="plRot">${ico("plRot")}Pivoter</button><button class="btn soft sm" data-act="plDup">${ico("plDup")}Dupliquer</button><button class="btn soft sm pl-del" data-act="plDel" aria-label="Supprimer">${ico("trash")}</button><button class="btn ghost sm" data-act="plSelNone">OK</button></div></div>`
    : `<div class="pl-add glass"><div class="pl-ah"><b>Ajouter</b><span>Touchez pour poser, puis glissez à sa place</span></div>
      <div class="pl-pal">${[[2, "rond"], [2, "carre"], [4, "carre"], [4, "rond"], [6, "long"], [8, "long"]].map(([n, sh]) => `<button class="pl-pt" data-act="plAdd" data-v="${n}:${sh}" aria-label="Table ${PL_SHAPES.find((x) => x[0] === sh)[1].toLowerCase()} de ${n}">${plMiniT(n, sh)}<b>${n}</b><span>${sh === "rond" ? "ronde" : sh === "long" ? "longue" : "carrée"}</span></button>`).join("")}</div>
      <div class="pl-decos">${Object.entries(PL_DECOR).map(([k, d]) => `<button class="chip" data-act="plDeco" data-v="${k}">${d.t}</button>`).join("")}</div></div>`;
  const svcs = cfg.services || [];
  return `${topBar("Plan de salle", { right: `<span class="pl-saved" id="plSaved" aria-live="polite">${PL.saved ? "Enregistré" : ""}</span>` })}
    <div class="pl-grid"><div class="pl-main">
      <div class="pl-ztabs st" style="--i:1" role="tablist">${e.zones.map((x) => `<button class="${x.id === z.id ? "on" : ""}" data-act="plZone" data-v="${esc(x.id)}" role="tab" aria-selected="${x.id === z.id}">${x.out ? ico("plSun") : ""}${esc(x.name)}<i>${e.tables.filter((t) => t.zone === x.id).length}</i></button>`).join("")}
        ${mgr ? `<button class="pl-zadd" data-act="plZoneAdd" aria-label="Ajouter une zone">${ico("plus")}<span>${e.zones.some((x) => x.out) ? "Zone" : "Terrasse"}</span></button>` : ""}</div>
      <div class="glass pl-canvas st" style="--i:2">
        <div class="pl-ch2"><b>${esc(z.name)}</b><span>${rsPl(T.length, "table")} · ${zt} places</span>${mgr ? `<button class="iconbtn sm" data-act="plZoneEdit" aria-label="Renommer la zone">${ico("sliders")}</button>` : ""}</div>
        ${plSvg(z.id, T, D, { mode: mgr ? "edit" : "mini", zoneObj: z })}
        ${T.length || D.length ? "" : `<div class="pl-hint">${ico("plus")}Ajoutez une table ci-dessous${z.out ? ", ou créez la terrasse d'un coup" : ""}</div>`}
      </div>
      ${mgr ? insp : `<p class="sub">Seul le gérant modifie le plan.</p>`}
    </div>
    <aside class="pl-side">
      <div class="glass pl-sum st" style="--i:3"><div class="pl-big"><b>${tot}</b><span>places au total<em>${rsPl(e.tables.length, "table")} · ${rsPl(e.zones.length, "zone")}</em></span></div>
        ${mgr ? `<button class="btn soft sm block" data-act="plQuickOpen">${ico("sparkle")}${e.tables.length ? "Refaire le plan en 30 secondes" : "Créer mon plan en 30 secondes"}</button>` : ""}</div>
      ${mgr ? `<div class="glass pl-set st" style="--i:4"><div class="pl-sh2"><b>Placement automatique</b><span>Les réservations prennent la meilleure table toutes seules : une table qui se libère à 13:30 resservie à 13:30, les grandes tables gardées pour les groupes.</span></div>
        <button class="rs-tog${e.autoTables ? " on" : ""}" data-act="plTg" data-v="autoTables" aria-pressed="${e.autoTables}"><span><b>Placer les réservations</b><em>Une table choisie à la main ne bouge jamais.</em></span><i></i></button>
        <button class="rs-tog${e.joinTables ? " on" : ""}" data-act="plTg" data-v="joinTables" aria-pressed="${e.joinTables}"><span><b>Assembler les tables voisines</b><em>Deux ou trois tables côte à côte pour un groupe : deux tables de 2 font une table de 4. Seulement si aucune table seule ne suffit.</em></span><i></i></button>
        <button class="rs-tog${e.planOnline ? " on" : ""}" data-act="plTg" data-v="planOnline" aria-pressed="${e.planOnline}"><span><b>Le plan règle la réservation en ligne</b><em>Un créneau n'est proposé que s'il reste une table à la bonne taille.</em></span><i></i></button>
        <div class="pl-turns"><b>Une table est prise</b>${svcs.map((s) => { const m = plDurBase({ turn: e.turn }, s); return `<div class="rs-row"><div><b>${esc(s.name)}</b><em>${m >= 120 ? "repas long" : "puis resservie"}</em></div><div class="rs-stp2 sm"><button data-act="plTurn" data-id="${esc(s.id)}" data-v="-15" aria-label="Quinze minutes de moins" ${m <= 30 ? "disabled" : ""}>${ico("minus")}</button><b class="pl-tm">${plHmLong(m)}</b><button data-act="plTurn" data-id="${esc(s.id)}" data-v="15" aria-label="Quinze minutes de plus" ${m >= 300 ? "disabled" : ""}>${ico("plus")}</button></div></div>`; }).join("")}<p class="sub">+15 min à partir de 6 personnes.</p></div>
      </div>` : ""}
    </aside></div>`;
}
function plMiniT(n, sh) {
  const t = { seats: n, shape: sh, x: 0, y: 0 }, g = plGeo(t), ch = plChairs(t), m = Math.max(g.w, g.h) / 2 + 0.8;
  return `<svg viewBox="${-m} ${-m} ${m * 2} ${m * 2}" aria-hidden="true">${ch.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".3" class="pl-ch"/>`).join("")}${sh === "rond" ? `<circle r="${g.w / 2}" class="pl-tb"/>` : `<rect x="${-g.w / 2}" y="${-g.h / 2}" width="${g.w}" height="${g.h}" rx="${Math.min(g.w, g.h) * 0.22}" class="pl-tb"/>`}</svg>`;
}

VIEWS.plan = {
  live: false,
  render() {
    if (!S.rid) return `<div class="inner">${topBar("Plan de salle")}<p class="sub">Créez d'abord votre restaurant.</p></div>`;
    if (!PL.ed || PL.ed.rid !== S.rid || !PL.dirty) { const sel = PL.sel; plEdLoad(); if (sel && [...PL.ed.tables.map((t) => "t:" + t.id), ...PL.ed.decor.map((d) => "d:" + d.id)].includes(sel)) PL.sel = sel; }
    return `<div class="inner wide pl" id="plEd">${plEdInner()}</div>`;
  },
  after() {},
};

/* pointer: drag a table or a landmark, snap to half units; a tap selects */
function plPt(svg, ev) { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
document.addEventListener("pointerdown", (ev) => {
  if (S.route !== "plan" || !PL.ed || !rsMgr()) return; const svg = ev.target.closest && ev.target.closest("svg.pl-svg.ed"); if (!svg) return;
  const g = ev.target.closest("[data-plt],[data-pld]");
  if (!g) { if (PL.sel) { PL.sel = null; SFX.tap(); plEdPaint(); } return; }
  ev.preventDefault();
  const isT = !!g.dataset.plt, id = g.dataset.plt || g.dataset.pld, it = isT ? PL.ed.tables.find((t) => t.id === id) : PL.ed.decor.find((d) => d.id === id); if (!it) return;
  const p = plPt(svg, ev);
  PL.drag = { id, isT, it, svg, g, sx: p.x, sy: p.y, ox: it.x, oy: it.y, nx: it.x, ny: it.y, moved: false };
  try { g.setPointerCapture(ev.pointerId); } catch (e) {}
  g.classList.add("grab");
});
document.addEventListener("pointermove", (ev) => {
  const d = PL.drag; if (!d) return; const p = plPt(d.svg, ev), dx = p.x - d.sx, dy = p.y - d.sy;
  if (!d.moved && Math.hypot(dx, dy) < 0.3) return;
  if (!d.moved) { d.moved = true; buzz(4); d.g.classList.add("drag"); }
  const gg = d.isT ? plGeo(d.it) : plDecoGeo(d.it);
  const nx = Math.max(gg.w / 2 + 0.15, Math.min(PL_W - gg.w / 2 - 0.15, plSnap(d.ox + dx))), ny = Math.max(gg.h / 2 + 0.15, plSnap(d.oy + dy));
  if (nx !== d.nx || ny !== d.ny) { d.nx = nx; d.ny = ny; SFX.tick && Math.random() < 0.35 && SFX.tick(); }
  d.g.setAttribute("transform", `translate(${(nx - d.ox).toFixed(2)} ${(ny - d.oy).toFixed(2)})`);
});
const plUp = (ev) => {
  const d = PL.drag; if (!d) return; PL.drag = null;
  const key = (d.isT ? "t:" : "d:") + d.id;
  if (d.moved) { d.it.x = d.nx; d.it.y = d.ny; PL.sel = key; SFX.tap(); buzz(6); plChanged(); }
  else { PL.sel = PL.sel === key ? null : key; SFX.tick(); buzz(3); plEdPaint(); }
};
document.addEventListener("pointerup", plUp);
document.addEventListener("pointercancel", plUp);
document.addEventListener("input", (ev) => {
  const el = ev.target; if (!el || !el.dataset) return;
  if (el.dataset.plnum && PL.ed) { const t = PL.ed.tables.find((x) => x.id === el.dataset.plnum); if (t) { t.n = el.value.slice(0, 6); const tx = document.querySelector(`[data-plt="${CSS.escape(t.id)}"] .pl-tn`); if (tx) tx.textContent = t.n; plChanged(false); } return; }
  if (el.dataset.plat) { PL.at[el.dataset.plat] = +el.value; const b = document.querySelector(".pl-at b"); if (b) b.textContent = rsHm(+el.value); plLiveRepaint(); return; }
  if (el.dataset.plzn && PL.ed) { const z = PL.ed.zones.find((x) => x.id === el.dataset.plzn); if (z) { z.name = el.value.slice(0, 24) || "Zone"; plChanged(false); } }
});
/* the live plan only: repaint the card in place (the time slider keeps the finger) */
const plLiveRepaint = (() => { let raf = 0; return () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
  if (S.route !== "resa") return; const old = document.getElementById("plLive"); if (!old) return;
  const cfg = rsCfg(), day = R.day || dayKey(), svc = cfg.services.find((s) => s.id === R.svc) || null; const all = rsOfDay(day), mine = svc ? all.filter((b) => rsSvcOf(cfg, day, b.time).id === svc.id) : all;
  const t = document.createElement("div"); t.innerHTML = plLive(cfg, day, svc, mine); const n = t.firstElementChild; if (!n) return;
  const a = old.querySelector('input[type="range"]'), b = n.querySelector('input[type="range"]');
  if (a && b && document.activeElement === a) { b.replaceWith(a); a.value = b.value; }
  n.classList.remove("st"); n.querySelectorAll(".pl-t").forEach((g) => g.classList.add("nost")); old.replaceWith(n);
}); }; })();

/* ───────── quick builder (onboarding + « Refaire le plan ») ───────── */
function plQDef() {
  const cfg = rsCfg(), T = cfg.tables || [], q = { salle: { 2: 0, 4: 0, 6: 0, 8: 0 }, terrasse: { 2: 0, 4: 0, 6: 0, 8: 0 }, ter: false };
  if (T.length) { T.forEach((t) => { const z = (t.zone || "salle") === "salle" ? "salle" : "terrasse"; const s = plSeats(t) <= 2 ? 2 : plSeats(t) <= 4 ? 4 : plSeats(t) <= 6 ? 6 : 8; q[z][s]++; }); q.ter = Object.values(q.terrasse).some(Boolean); }
  else { const cov = +(S.resto && S.resto.covers) || 40; q.salle = { 2: Math.max(2, Math.round(cov / 12)), 4: Math.max(2, Math.round(cov / 8)), 6: cov >= 30 ? 1 : 0, 8: cov >= 60 ? 1 : 0 }; q.terrasse = { 2: 3, 4: 3, 6: 0, 8: 0 }; }
  return q;
}
function plQTables(q) {
  const out = []; let n = 1;
  [["salle", q.salle], ...(q.ter ? [["terrasse", q.terrasse]] : [])].forEach(([z, c], zi) => {
    if (zi) n = 20 + 1;
    const list = []; [2, 4, 6, 8].forEach((s) => { for (let i = 0; i < (+c[s] || 0); i++) list.push({ id: plNewId(), n: String(n++), seats: s, zone: z, shape: s >= 6 ? "long" : s === 2 && z === "terrasse" ? "rond" : "carre", rot: 0 }); });
    plPack(list); out.push(...list);
  });
  return out;
}
function plQuickHTML(ctx = "ed") {
  const q = PL.q || (PL.q = plQDef()); const T = plQTables(q), tot = T.reduce((n, t) => n + t.seats, 0);
  const row = (z) => `<div class="pl-qr">${[2, 4, 6, 8].map((s) => `<div class="pl-qc"><span class="pl-qt">${plMiniT(s, s >= 6 ? "long" : "carre")}</span><em>${s} pers.</em><div class="rs-stp2 sm"><button data-act="plQ" data-v="${z}:${s}:-1" aria-label="Une table de ${s} de moins" ${q[z][s] <= 0 ? "disabled" : ""}>${ico("minus")}</button><b>${q[z][s]}</b><button data-act="plQ" data-v="${z}:${s}:1" aria-label="Une table de ${s} de plus">${ico("plus")}</button></div></div>`).join("")}</div>`;
  const prev = ["salle", ...(q.ter ? ["terrasse"] : [])].map((z) => { const L = T.filter((t) => t.zone === z); return L.length ? `<div class="pl-qp"><em>${z === "salle" ? "Salle" : "Terrasse"}</em>${plSvg(z, L, [], { mode: "mini", zoneObj: { out: z === "terrasse" } })}</div>` : ""; }).join("");
  return `<div class="pl-quick${ctx === "ob" ? " ob" : ""}" id="plQuick">
    <div class="pl-qz"><b>En salle</b>${row("salle")}</div>
    <button class="rs-tog${q.ter ? " on" : ""}" data-act="plQTer" aria-pressed="${q.ter}"><span><b>J'ai une terrasse</b><em>Elle a son propre plan.</em></span><i></i></button>
    ${q.ter ? `<div class="pl-qz"><b>En terrasse</b>${row("terrasse")}</div>` : ""}
    <div class="pl-qprev">${prev}</div>
    <div class="pl-qtot"><b>${T.length}</b> tables · <b>${tot}</b> places</div>
    ${ctx === "ob" ? "" : `<button class="btn acc block" data-act="plQGo" ${T.length ? "" : "disabled"}>${(plRaw() || {}).tables && plRaw().tables.length ? "Remplacer mon plan" : "Créer mon plan"}</button>`}
  </div>`;
}
function plQPaint() { const el = document.getElementById("plQuick"); if (!el) return; const ob = el.classList.contains("ob"); const t = document.createElement("div"); t.innerHTML = plQuickHTML(ob ? "ob" : "ed"); el.replaceWith(t.firstElementChild); }
/* writes the quick plan (onboarding: as soon as a number changes) */
async function plQSave() {
  if (!S.rid || !S.resto) return false; const T = plQTables(PL.q || plQDef());
  const raw = plRaw() || (typeof rsDefCfg === "function" ? rsDefCfg() : {});
  const zones = [{ id: "salle", name: "Salle", out: false }, ...((PL.q || {}).ter ? [{ id: "terrasse", name: "Terrasse", out: true }] : [])];
  const keep = (raw.zones || []).filter((z) => !["salle", "terrasse"].includes(z.id) && T.some((t) => t.zone === z.id));
  const next = DB.clean({ ...raw, tables: T, zones: [...zones, ...keep], decor: (raw.decor || []).filter((d) => zones.some((z) => z.id === d.zone)), autoTables: raw.autoTables !== false });
  try { await safe(DB.update("restos", S.rid, { resaCfg: next })); } catch (e) { return false; }
  S.resto.resaCfg = next; PL.ed = null; PL.done.clear(); PL.fitMemo.clear(); try { rsSync(); } catch (e) {}
  return true;
}

/* the « Tables » tab of the reservation settings (js/resa.js) */
function plCfgCard(c) {
  const T = (c && c.tables) || [], seats = T.reduce((n, t) => n + plSeats(t), 0);
  return `<div class="pl-cfgc">${T.length ? `<div class="pl-cfgp">${plSvg("salle", plTables(c).filter((t) => t.zone === (plZones(c)[0] || {}).id), [], { mode: "mini" })}</div><b>${rsPl(T.length, "table")} · ${seats} places</b>` : `${plArt()}<b>Pas encore de plan</b>`}
    <span>Dessinez la salle et la terrasse : les réservations se placent toutes seules, sans tables perdues.</span>
    <button class="btn acc block" data-act="plOpen">${ico("plZone")}${T.length ? "Modifier le plan de salle" : "Créer mon plan de salle"}</button></div>`;
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  plOpen: () => { SFX.tap(); try { R.ce = null; } catch (e) {} closeSheet(true); PL.ed = null; go("plan"); },
  plZone: (a, id, v) => { SFX.tick(); PL.zone = v; PL.sel = null; plEdPaint(); },
  plSelNone: () => { SFX.tap(); PL.sel = null; plEdPaint(); },
  plAdd: (a, id, v) => {
    const [n, sh] = v.split(":"); const t = { id: plNewId(), n: plNextN(PL.zone), seats: +n, zone: PL.zone, shape: sh, rot: 0 }; const g = plGeo(t); Object.assign(t, plFreeSpot(g.w + 0.9, g.h + 0.9, PL.zone));
    PL.ed.tables.push(t); PL.sel = "t:" + t.id; SFX.ok(); buzz(8); plChanged();
    setTimeout(() => { const el = document.querySelector(`[data-plt="${CSS.escape(t.id)}"]`); if (el) { el.classList.add("born"); try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} } }, 20);
  },
  plDeco: (a, id, v) => { const d = { id: plNewId("d"), kind: v, zone: PL.zone, rot: 0 }; const g = plDecoGeo(d); Object.assign(d, plFreeSpot(g.w, g.h, PL.zone)); PL.ed.decor.push(d); PL.sel = "d:" + d.id; SFX.ok(); buzz(6); plChanged(); },
  plSeat: (a, id, v) => { const t = PL.ed.tables.find((x) => "t:" + x.id === PL.sel); if (!t) return; t.seats = Math.max(1, Math.min(20, plSeats(t) + +v)); SFX.tick(); buzz(3); plChanged(); },
  plShape: (a, id, v) => { const t = PL.ed.tables.find((x) => "t:" + x.id === PL.sel); if (!t) return; t.shape = v; SFX.tick(); buzz(4); plChanged(); },
  plRot: () => { const [k, sid] = (PL.sel || ":").split(":"); const it = k === "t" ? PL.ed.tables.find((x) => x.id === sid) : PL.ed.decor.find((x) => x.id === sid); if (!it) return; it.rot = +it.rot === 90 ? 0 : 90; SFX.tick(); buzz(4); plChanged(); },
  plDup: () => {
    const [k, sid] = (PL.sel || ":").split(":");
    if (k === "t") { const t = PL.ed.tables.find((x) => x.id === sid); if (!t) return; const c = { ...t, id: plNewId(), n: plNextN(t.zone) }; const g = plGeo(c); const nx = t.x + g.w + 1.7; Object.assign(c, nx + g.w / 2 < PL_W - 0.3 ? { x: plSnap(nx), y: t.y } : plFreeSpot(g.w + 0.9, g.h + 0.9, t.zone)); PL.ed.tables.push(c); PL.sel = "t:" + c.id; }
    else { const d = PL.ed.decor.find((x) => x.id === sid); if (!d) return; const c = { ...d, id: plNewId("d") }; Object.assign(c, plFreeSpot(plDecoGeo(c).w, plDecoGeo(c).h, d.zone)); PL.ed.decor.push(c); PL.sel = "d:" + c.id; }
    SFX.ok(); buzz(6); plChanged();
  },
  plDel: () => {
    const [k, sid] = (PL.sel || ":").split(":");
    if (k === "t") { const i = PL.ed.tables.findIndex((x) => x.id === sid); if (i < 0) return; const t = PL.ed.tables.splice(i, 1)[0]; PL.sel = null; SFX.close(); plChanged(); PL.undo = { i, t }; toast(`Table ${t.n} supprimée`); const tx = $("#toastTx"), to = $("#toast"); if (tx && to) { tx.innerHTML = `<span class="tx">Table ${esc(t.n)} supprimée</span><button data-act="plUndo">Annuler</button>`; to.style.pointerEvents = "auto"; clearTimeout(to._h); to._h = setTimeout(() => { to.classList.remove("on"); to.style.pointerEvents = ""; PL.undo = null; }, 4000); } }
    else { PL.ed.decor = PL.ed.decor.filter((x) => x.id !== sid); PL.sel = null; SFX.close(); plChanged(); }
  },
  plUndo: () => { const u = PL.undo; PL.undo = null; if (!u || !PL.ed) return; PL.ed.tables.splice(u.i, 0, u.t); PL.sel = "t:" + u.t.id; $("#toast").classList.remove("on"); SFX.ok(); plChanged(); },
  plMoveZone: () => { const t = PL.ed.tables.find((x) => "t:" + x.id === PL.sel); if (!t) return; const z = PL.ed.zones.find((x) => x.id !== t.zone); if (!z) return; t.zone = z.id; const g = plGeo(t); Object.assign(t, plFreeSpot(g.w + 0.9, g.h + 0.9, z.id)); PL.zone = z.id; SFX.ok(); plChanged(); toast(`Table ${t.n} déplacée en ${z.name.toLowerCase()}`); },
  plZoneAdd: () => {
    const has = (id) => PL.ed.zones.some((z) => z.id === id);
    if (!has("terrasse")) { PL.ed.zones.push({ id: "terrasse", name: "Terrasse", out: true }); PL.zone = "terrasse"; PL.sel = null; SFX.ok(); plChanged(); return; }
    SFX.sheet && SFX.sheet();
    openSheet(`<div class="pl-zs"><div class="rs-edh"><span class="h2">Nouvelle zone</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <div class="pl-zchips">${[["Étage", 0], ["Salle du fond", 0], ["Mezzanine", 0], ["Véranda", 1], ["Jardin", 1], ["Salon privé", 0]].map(([n, o]) => `<button class="chip" data-act="plZoneNew" data-v="${o}:${esc(n)}">${n}</button>`).join("")}</div></div>`);
  },
  plZoneNew: (a, id, v) => { const [o, ...n] = v.split(":"); const z = { id: plNewId("z"), name: n.join(":"), out: o === "1" }; PL.ed.zones.push(z); PL.zone = z.id; PL.sel = null; closeSheet(true); SFX.ok(); plChanged(); },
  plZoneEdit: () => {
    const z = PL.ed.zones.find((x) => x.id === PL.zone); if (!z) return; const n = PL.ed.tables.filter((t) => t.zone === z.id).length;
    openSheet(`<div class="pl-zs"><div class="rs-edh"><span class="h2">${esc(z.name)}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <label class="rs-big-in sm"><span>Nom</span><input class="input" data-plzn="${esc(z.id)}" value="${esc(z.name)}" maxlength="24"></label>
      <button class="rs-tog${z.out ? " on" : ""}" data-act="plZoneOut" aria-pressed="${z.out}"><span><b>En extérieur</b><em>« Terrasse si possible » y va en priorité.</em></span><i></i></button>
      ${PL.ed.zones.length > 1 ? `<button class="btn danger block" data-act="plZoneDel">${ico("trash")}Supprimer la zone${n ? ` et ses ${rsPl(n, "table")}` : ""}</button>` : ""}</div>`);
  },
  plZoneOut: (a) => { const z = PL.ed.zones.find((x) => x.id === PL.zone); if (!z) return; z.out = !z.out; a.classList.toggle("on", z.out); a.setAttribute("aria-pressed", z.out); SFX.tick(); plChanged(); },
  plZoneDel: () => { const id = PL.zone; PL.ed.zones = PL.ed.zones.filter((z) => z.id !== id); PL.ed.tables = PL.ed.tables.filter((t) => t.zone !== id); PL.ed.decor = PL.ed.decor.filter((d) => d.zone !== id); PL.zone = PL.ed.zones[0].id; closeSheet(true); SFX.close(); plChanged(); toast("Zone supprimée"); },
  plTg: (a, id, v) => { PL.ed[v] = !PL.ed[v]; SFX.tick(); buzz(4); plChanged(); },
  plTurn: (a, id, v) => { const cfg = rsCfg(), s = cfg.services.find((x) => x.id === id); if (!s) return; PL.ed.turn[id] = Math.max(30, Math.min(300, plDurBase({ turn: PL.ed.turn }, s) + +v)); SFX.tick(); buzz(3); plChanged(); },
  plQuickOpen: () => { SFX.tap(); PL.q = plQDef(); openSheet(`<div class="pl-qs"><div class="rs-edh"><span class="h2">Votre salle en 30 secondes</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div><p class="sub">Combien de tables de chaque taille ? On les dispose, vous ajustez du doigt.</p>${plQuickHTML("ed")}</div>`); },
  plQ: (a, id, v) => { const [z, s, d] = v.split(":"); const q = PL.q || (PL.q = plQDef()); q[z][s] = Math.max(0, Math.min(40, (+q[z][s] || 0) + +d)); SFX.tick(); buzz(3); plQPaint(); },
  plQTer: () => { const q = PL.q || (PL.q = plQDef()); q.ter = !q.ter; SFX.tick(); buzz(4); plQPaint(); },
  plQGo: async (a) => { a.disabled = true; const ok = await plQSave(); a.disabled = false; if (!ok) return; closeSheet(true); SFX.done(); buzz([10, 40, 14]); toast("Plan créé : glissez les tables à leur place"); plEdLoad(); if (S.route === "plan") plEdPaint(); else go("plan"); },
  /* live plan */
  plAt: (a, id, v) => { const cfg = rsCfg(), day = R.day || dayKey(), svc = cfg.services.find((s) => s.id === R.svc); if (!svc) return; const k = plAtKey(day, svc), a0 = rsMin(svc.from), a1 = rsMin(svc.to) + plDurBase(cfg, svc); PL.at[k] = Math.max(a0, Math.min(a1, plAt(cfg, day, svc) + +v)); SFX.tick(); buzz(3); plLiveRepaint(); },
  plTap: async (a, id) => {
    const cfg = rsCfg(), t = cfg.tables.find((x) => x.id === id); if (!t) return;
    if (R.pick) { const pid = R.pick; R.pick = null; SFX.ok(); buzz(10); if (await rsSave(pid, { table: id, tableWith: "", tableAuto: false })) toast(`Installé table ${t.n}`); return; }
    const day = R.day || dayKey(), svc = cfg.services.find((s) => s.id === R.svc), at = plAt(cfg, day, svc);
    const on = rsOfDay(day).filter((b) => rsLive(b) && plTblOf(b).includes(id) && svc && rsSvcOf(cfg, day, b.time).id === svc.id).sort((x, y) => (x.time > y.time ? 1 : -1));
    const cur = on.find((b) => rsMin(b.time) <= at && at < rsMin(b.time) + plDur(cfg, svc, b.covers)) || on.find((b) => rsMin(b.time) > at) || on[on.length - 1];
    SFX.tap(); if (cur) rsOpenSheet(cur.id); else rsEdOpen(null, { date: day, svc: R.svc, table: id, time: svc && rsSlots(cfg, svc).includes(rsHm(at)) ? rsHm(at) : "" });
  },
  plAutoNow: async (a) => {
    const day = R.day || dayKey(); if (!R.svc) return; a.disabled = true; SFX.tap();
    const r = await plApply(day, R.svc); a.disabled = false; if (!r) return;
    SFX.done(); buzz([8, 30, 12]); const rr = a.getBoundingClientRect(); burst(rr.left + rr.width / 2, rr.top);
    toast(r.unplaced ? `${rsPl(r.unplaced, "réservation")} sans table : libérez ou assemblez une table` : r.n ? `${rsPl(r.n, "réservation")} placée${r.n > 1 ? "s" : ""} au mieux` : "Les tables sont déjà au mieux", r.unplaced ? "warn" : undefined);
  },
  plRotaTg: (a, id, v, ev) => { setTimeout(() => { const d = a.closest("details"); PL.rota = !!(d && d.open); }, 0); },
});
