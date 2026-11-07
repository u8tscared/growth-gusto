/* Growth Gusto — area: mode « coup de feu » (route « coupdefeu »). Prefix « cf ».
   Pendant le service, l'app passe en vue ultra simple, gros boutons, adaptée à chacun :
     - Salle : les plats prêts à servir (« Servi » d'un geste), les tables ouvertes, ouvrir une table, les arrivées des réservations.
     - Cuisine : les bons en cours (les cartes de l'écran cuisine, js/salle.js), les ruptures, les relevés de température à faire.
     - Pilotage (gérant, chef) : tout le service en direct : couverts, tables, temps en cuisine, retards, plats qui attendent au passe.
   Allumage : tout seul sur l'Accueil (services des Réservations : restos/{rid}.resaCfg.services),
   calé sur les réservations du jour : 15 min avant la première résa du service, une fois par service et par appareil ; ou d'un
   geste (carte de l'Accueil, menu « Coup de feu »). Extinction : 45 min après la dernière résa du service, avec le bilan. Un service
   sans aucune résa garde ses horaires des Réservations. « Quitter » le coupe jusqu'au service suivant.
   Rôle : d'après le poste de la personne (js/perms.js : salle / bar → Salle, cuisine / plonge / second → Cuisine, gérant → Pilotage),
   changeable d'un geste ; le choix est gardé sur l'appareil (la tablette de la cuisine reste en Cuisine).
   Data: none of its own. Reads js/salle.js (salleTabs + clientOrders), js/resa.js (bookings, services), the fridges and readings.
   Device prefs (localStorage): gg-cf-role-<rid>, gg-cf-auto-<rid> ("0" = no auto start), gg-cf-seen-<rid> (service already started). */
"use strict";

TAB_OF.coupdefeu = "home";
(function cfNav() {
  if (NAV.some((n) => n[0] === "coupdefeu")) return;
  const i = NAV.findIndex((n) => n[0] === "home");
  NAV.splice(i >= 0 ? i + 1 : 0, 0, ["coupdefeu", "cfFlame", "Coup de feu"]);
})();
try { if (typeof AB_GATE !== "undefined") AB_GATE.coupdefeu = ["pro", "Mode coup de feu"]; } catch (e) {}
Object.assign(IC, {
  cfFlame: ["f:M12 2.8c.9 3 4.9 5.2 4.9 10a4.9 4.9 0 0 1-9.8 0c0-2.1.9-3.7 2.2-4.9.3 1.6 1.1 2.6 2.1 3.1C10.8 8 11 5.3 12 2.8Z", "M12 2.8c.9 3 4.9 5.2 4.9 10a4.9 4.9 0 0 1-9.8 0c0-2.1.9-3.7 2.2-4.9.3 1.6 1.1 2.6 2.1 3.1C10.8 8 11 5.3 12 2.8Z", "M12 21.5a2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.3-2.4 2.6-3.9 1.3 1.5 2.6 2.4 2.6 3.9a2.6 2.6 0 0 1-2.6 2.6Z"],
  cfGauge: ["f:M3.3 18.5a9 9 0 1 1 17.4 0z", "M3.3 18.5a9 9 0 1 1 17.4 0", "M12 14.5l4.2-4.7", "c:12,14.5,1.6", "M7 18.5h10"],
  cfDoor: ["M14 3.5h4.5A1.5 1.5 0 0 1 20 5v14a1.5 1.5 0 0 1-1.5 1.5H14", "M10 16.5l4.5-4.5L10 7.5", "M14.5 12H3.5"],
  cfPlate: ["c:12,13,7.5", "c:12,13,4", "M3 6.5h18"],
});

const CF_PRE = 15, CF_POST = 45; /* minutes before the first seating / after the last one */
const CF_ROLES = [["salle", "pmCloche", "Salle", "Tables et plats prêts"], ["cuisine", "pmToque", "Cuisine", "Bons, ruptures, frigos"], ["pilote", "cfGauge", "Pilotage", "Tout le service en direct"]];
const CF = { tick: null, cur: null, ending: false, last: "" };
const cfLS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; };
const cfMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
const cfPl = (n, w, ws) => `${n} ${n > 1 ? ws || w + "s" : w}`;
const cfOn = () => typeof abHas !== "function" || abHas("coupdefeu");

/* ───────── the service going on now, or null ─────────
   The window follows the day's bookings: it opens 15 min before the first booking of the service and closes 45 min after
   the last one. A service with no booking today falls back to its hours in the Réservations settings (from → to). */
function cfSpan(cfg, k, s) {
  let times = [];
  try { times = rsOfDay(k).filter((b) => rsLive(b) && b.time && rsSvcOf(cfg, k, b.time).id === s.id).map((b) => rsMin(b.time)); } catch (e) {}
  if (!times.length) return { from: s.from, to: s.to, n: 0 };
  const a = Math.min(...times), b = Math.max(...times), h = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { from: h(a), to: h(b), n: times.length };
}
function cfSvc(now = new Date()) {
  if (!S.resto) return null;
  let list = [], cfg = null; const k = dayKey();
  try { cfg = rsCfg(); list = typeof rsDaySvcs === "function" ? rsDaySvcs(cfg, k) : typeof rsSvcsOn === "function" ? rsSvcsOn(cfg, k) : cfg.services; } catch (e) { list = [{ id: "midi", name: "Midi", from: "12:00", to: "13:45" }, { id: "soir", name: "Soir", from: "19:00", to: "21:45" }]; }
  const m = now.getHours() * 60 + now.getMinutes(), d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  for (const s of list) {
    const sp = cfg ? cfSpan(cfg, k, s) : { from: s.from, to: s.to, n: 0 };
    const a = cfMin(sp.from) - CF_PRE, b = cfMin(sp.to) + CF_POST;
    if (m >= a && m < b) return { id: s.id, name: s.name || "Service", from: sp.from, to: sp.to, resa: sp.n, key: k + "|" + s.id, t0: d0.getTime() + a * 6e4, t1: d0.getTime() + b * 6e4, live: m >= cfMin(sp.from), inMin: cfMin(sp.from) - m };
  }
  /* demo: there is always a service in full swing (js/salle.js seeds a lunch rush); hours from the demo bookings when there are some */
  if (DB.mode === "demo") {
    const mid = now.getHours() < 16, s0 = { id: mid ? "midi" : "soir", from: mid ? "12:00" : "19:00", to: mid ? "13:45" : "21:45" };
    const sp = cfg ? cfSpan(cfg, k, (list.find((x) => x.id === s0.id) || s0)) : { from: s0.from, to: s0.to, n: 0 };
    return { id: "demo", name: mid ? "Midi" : "Soir", from: sp.from, to: sp.to, resa: sp.n, key: k + "|demo", t0: Date.now() - 3 * 36e5, t1: Date.now() + 3 * 36e5, live: true, inMin: 0, demo: true };
  }
  return null;
}
/* "19:30 – 21:15 · 1re à dernière résa" or "19:00 – 21:45 · horaires du service" */
const cfSpanT = (s) => `${esc(s.from)} – ${esc(s.to)} · ${s.resa ? (s.resa > 1 ? "1re à dernière résa" : "1 seule résa") : "horaires du service"}`;
const cfSvcT = (s) => { const n = String((s && s.name) || "").toLowerCase(); return n === "midi" ? "service du midi" : n === "soir" ? "service du soir" : `service « ${(s && s.name) || ""} »`; };

/* ───────── who needs what ───────── */
const cfCanPilot = () => DB.mode === "demo" || myRole() !== "equipe";
function cfRoleDef() {
  let p = ""; try { p = (typeof PERMS !== "undefined" && PERMS.me && (PERMS.me() || {}).poste) || ""; } catch (e) {}
  if (!p) p = ((S.members || []).find((m) => m.id === S.me.id) || {}).poste || "";
  if (p === "salle" || p === "bar") return "salle";
  if (["cuisine", "plonge", "second"].includes(p)) return "cuisine";
  return myRole() === "gerant" ? "pilote" : "cuisine";
}
function cfRole() { const r = S.rid ? cfLS("gg-cf-role-" + S.rid) : null; if (r && CF_ROLES.some((x) => x[0] === r) && (r !== "pilote" || cfCanPilot())) return r; return cfRoleDef(); }
const cfAuto = () => !S.rid || cfLS("gg-cf-auto-" + S.rid) !== "0";

/* ───────── auto on / off ───────── */
function cfCheck() {
  if (!S.ready || !S.resto || !S.rid) return;
  const ok = cfOn(), s = ok ? cfSvc() : null;
  document.documentElement.classList.toggle("cf-live", !!(s && !s.demo && s.live));
  if (S.route === "coupdefeu") {
    if (CF.cur && !CF.cur.demo && Date.now() >= CF.cur.t1 && !CF.ending) cfEnd();
    return;
  }
  if (!ok || !s || s.demo || !cfAuto()) return;
  if (cfLS("gg-cf-seen-" + S.rid) === s.key) return; /* already started (or turned off) for this service, on this device */
  if (S.route !== "home" || $("#sheet").classList.contains("open") || (typeof PZ !== "undefined" && PZ.he)) return;
  const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  cfEnter(cfRole(), true);
}
function cfEnter(role, auto) {
  const s = cfSvc(); CF.cur = s;
  if (role && S.rid) cfLS("gg-cf-role-" + S.rid, role);
  if (s && S.rid) cfLS("gg-cf-seen-" + S.rid, s.key);
  try { SFX.init(); SFX.noise(0.5, 0.014, 300, 2600); SFX.tone(392, 0.16, "triangle", 0.03, 0.08); SFX.tone(587, 0.18, "triangle", 0.03, 0.18); SFX.tone(784, 0.32, "sine", 0.03, 0.3); } catch (e) {}
  buzz([10, 40, 18]);
  go("coupdefeu", s ? { svc: s.key } : {});
  if (auto) setTimeout(() => toast(`C'est le coup de feu : ${cfSvcT(s)}. Tout en gros, rien de plus.`, "info"), 500);
}
/* the service is over: back to Accueil, with the recap */
function cfEnd() {
  CF.ending = true; const s = CF.cur; CF.cur = null;
  const r = cfRecap(s);
  go("home", {}, { replace: true }); S.history = [];
  setTimeout(() => { CF.ending = false; cfRecapSheet(s, r); }, 420);
}
function cfRecap(s) {
  const t0 = s ? s.t0 : Date.now() - 4 * 36e5;
  const tabs = ((typeof SL !== "undefined" && SL.tabs) || []).filter((t) => (t.openedAt || 0) >= t0 && !t.mergedInto);
  const tk = ((typeof CM !== "undefined" && CM.orders) || []).filter((o) => (o.at || 0) >= t0 && o.status !== "annulee");
  const times = tk.filter((o) => o.readyAt && o.readyAt > (o.firedAt || o.at)).map((o) => (o.readyAt - (o.firedAt || o.at)) / 6e4);
  return { tables: tabs.length, covers: tabs.reduce((a, t) => a + (+t.covers || 0), 0), tickets: tk.length, avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, late: times.filter((m) => m >= 20).length, total: tabs.reduce((a, t) => a + (+t.total || 0), 0) };
}
function cfRecapSheet(s, r) {
  const money = cfMoney();
  openSheet(`<div class="cf-sh cf-end"><div class="cf-endart" aria-hidden="true"><i></i><i></i><i></i>${ico("cfFlame")}</div>
    <span class="cf-kick">Fin du coup de feu</span><h2 class="h2">${s ? `Le ${esc(cfSvcT(s))} est bouclé` : "Service terminé"}</h2>
    <div class="cf-endg">
      <div><b class="mono">${r.covers}</b><span>${r.covers > 1 ? "couverts" : "couvert"}</span></div>
      <div><b class="mono">${r.tables}</b><span>${r.tables > 1 ? "tables" : "table"}</span></div>
      <div><b class="mono">${r.tickets}</b><span>${r.tickets > 1 ? "bons" : "bon"} en cuisine</span></div>
      <div><b class="mono">${r.avg != null ? r.avg + "'" : "–"}</b><span>temps moyen</span></div>
      ${money && r.total ? `<div class="w"><b class="mono">${slEur(r.total)}</b><span>pris en salle (à encaisser sur la caisse)</span></div>` : ""}
    </div>
    ${r.late ? `<p class="sub">${cfPl(r.late, "bon a", "bons ont")} dépassé 20 minutes en cuisine.</p>` : ""}
    <button class="btn acc block" data-act="sheetClose">Retour à l'accueil</button></div>`);
  try { SFX.done(); } catch (e) {}
}
const cfMoney = () => { try { return DB.mode === "demo" || myRole() === "gerant" || (typeof PERMS !== "undefined" && PERMS.cap && PERMS.cap("seeMoney")); } catch (e) { return myRole() === "gerant"; } };

window.addEventListener("gg:ready", () => { setTimeout(cfCheck, 1200); clearInterval(CF.tick); CF.tick = setInterval(cfCheck, 30000); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(cfCheck, 600); });

/* ───────── the view ───────── */
VIEWS.coupdefeu = {
  hideTabs: true,
  render() {
    if (typeof slWatch === "function") slWatch();
    const s = cfSvc(), role = cfRole(); if (!CF.cur && s && S.params && S.params.svc === s.key) CF.cur = s;
    const roles = CF_ROLES.filter((r) => r[0] !== "pilote" || cfCanPilot()), ri = Math.max(0, roles.findIndex((r) => r[0] === role));
    const body = role === "salle" ? cfSalle() : role === "pilote" ? cfPilote() : cfCuisine();
    return `<div class="inner wide cf cf-r-${role}">
      <header class="cf-head st" style="--i:0">
        <span class="cf-fl" aria-hidden="true"><i></i><i></i>${ico("cfFlame")}</span>
        <div class="cf-ht"><span class="cf-kick"><i class="cf-dot"></i>Coup de feu</span><b>${s ? esc(cfSvcT(s).replace(/^./, (c) => c.toUpperCase())) : "Hors service"}</b><em>${s ? `${cfSpanT(s)}${!s.live && s.inMin > 0 ? ` · dans ${s.inMin} min` : ""}` : "Allumé à la main"}</em></div>
        <span class="cf-clock mono" id="cfClock">${hm(Date.now())}</span>
        ${typeof bigBtn === "function" ? bigBtn("cf-big") : ""}
        <button class="iconbtn cf-set" data-act="cfSet" aria-label="Réglages du coup de feu" title="Réglages">${ico("sliders")}</button>
        <button class="btn soft cf-exit" data-act="cfExit">${ico("cfDoor")}<span>Quitter</span></button>
      </header>
      <div class="cf-roles st" style="--i:1;--n:${roles.length};--ri:${ri}" role="tablist" aria-label="Pour qui ?"><span class="cf-rin" aria-hidden="true"></span>
        ${roles.map(([k, ic, t, sub]) => `<button class="${k === role ? "on" : ""}" role="tab" aria-selected="${k === role}" data-act="cfRole" data-v="${k}">${ico(ic)}<span><b>${t}</b><em>${sub}</em></span></button>`).join("")}</div>
      <div class="cf-body" data-role="${role}">${body}</div>
    </div>`;
  },
  after(v) {
    clearInterval(CF.vt);
    CF.vt = setInterval(() => {
      if (S.route !== "coupdefeu") { clearInterval(CF.vt); if (S.route !== "cuisine" && typeof slWake === "function") slWake(false); return; }
      const c = document.getElementById("cfClock"); if (c) c.textContent = hm(Date.now());
      $$(".cf [data-at]").forEach((el) => { el.textContent = slAgo(+el.dataset.at); });
      $$(".cf .sl-kt[data-at]").forEach((el) => { const m = slMin(+el.dataset.at), k = el.closest(".sl-kcard"); if (k) { k.classList.toggle("warm", m >= 10 && m < 20); k.classList.toggle("late", m >= 20); } });
    }, 10000);
    if (typeof slWake === "function") slWake(true); /* the screen stays on during the service */
    $$(".sl-kcard.fresh", v).forEach((el) => setTimeout(() => el.classList.remove("fresh"), 2600));
    setTimeout(() => { try { CM.fresh.clear(); } catch (e) {} }, 2700);
    const rk = role0(); if (CF.last && CF.last !== rk) { const b = $(".cf-body", v); if (b) { b.classList.remove("swap"); void b.offsetWidth; b.classList.add("swap"); } } CF.last = rk;
  },
};
const role0 = () => cfRole();

/* ── Salle: what to carry, where to go ── */
function cfSalle() {
  const me = S.me.id, ready = slKitchen().filter((o) => o.src === "salle" && o.status === "prete").sort((a, b) => (a.waiter === me ? -1 : 0) - (b.waiter === me ? -1 : 0) || (a.readyAt || 0) - (b.readyAt || 0));
  const PR = ["ready", "hold", "draft", "cook", "open"];
  const open = slOpenTabs().slice().sort((a, b) => (a.by === me ? -1 : 0) - (b.by === me ? -1 : 0) || PR.indexOf(slTabState(a).k) - PR.indexOf(slTabState(b).k) || (a.openedAt || 0) - (b.openedAt || 0));
  const plates = (o) => (o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0);
  const readyH = ready.length ? `<div class="cf-ready">${ready.map((o, i) => `<div class="cf-rd st" style="--i:${2 + Math.min(i, 6)}"><span class="cf-rdn mono">${esc(o.table)}</span>
      <div class="cf-rdt"><b>${esc(o.courseT || "Commande")}</b><em>${cfPl(plates(o), "assiette")} · prêt depuis <span data-at="${o.readyAt || o.at}">${slAgo(o.readyAt || o.at)}</span>${o.waiter && o.waiter !== me && o.waiterName ? ` · ${esc(firstName(o.waiterName))}` : ""}${o.call ? ` · <b class="cf-call">la cuisine appelle</b>` : ""}</em></div>
      <button class="btn cf-big cf-serv" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}Servi</button></div>`).join("")}</div>`
    : `<div class="cf-calm st" style="--i:2"><span class="cf-ci">${ico("cmBell")}</span><div><b>Rien à servir</b><em>Dès qu'un plat est prêt, il s'affiche ici en grand, avec un son.</em></div></div>`;
  const tile = (t, i) => { const s = slTabState(t); return `<button class="cf-tb k-${s.k}${t.by === me ? " mine" : ""} st" style="--i:${3 + Math.min(i, 8)}" data-go="salle" data-id="${esc(t.id)}"><b class="mono">${esc(t.table)}</b><span>${esc(s.t)}</span><em>${slCovers(t)} · <span data-at="${t.openedAt}">${slAgo(t.openedAt)}</span></em></button>`; };
  const soon = cfSoon();
  return `${typeof slStockBar === "function" ? slStockBar() : ""}${readyH}
    <div class="cf-lbl st" style="--i:3"><span>Tables ouvertes</span><b class="mono">${open.length}</b></div>
    <div class="cf-tables">${open.map(tile).join("")}<button class="cf-tb cf-new st" style="--i:${3 + Math.min(open.length, 8)}" data-act="cfNewTable">${ico("plus")}<span>Ouvrir une table</span></button></div>
    ${soon.length ? `<div class="cf-lbl st" style="--i:6"><span>Arrivent bientôt</span><b class="mono">${soon.reduce((a, b) => a + (+b.covers || 0), 0)} couv.</b></div>
      <div class="glass cf-soon st" style="--i:6">${soon.map((b) => `<button class="cf-sn" ${b.table ? `data-act="slTable" data-id="${esc(b.table)}"` : `data-act="cfNewTable"`}><b class="mono">${esc(b.time)}</b><span><b>${esc(b.name || "Réservation")}</b><em>${cfPl(+b.covers || 0, "pers.", "pers.")}${b.table && typeof slTableBy === "function" && slTableBy(b.table) ? ` · table ${esc(slTableBy(b.table).n)}` : ""}${b.notes ? ` · ${esc(String(b.notes).slice(0, 60))}` : ""}</em></span>${ico("chev")}</button>`).join("")}</div>` : ""}
    <div class="cf-links st" style="--i:7"><button class="btn soft" data-go="salle">${ico("plZone")}Toute la salle</button><button class="btn soft" data-go="resa">${ico("resa")}Réservations</button></div>`;
}
/* bookings due in the next hour, not seated yet */
function cfSoon() {
  try {
    const now = new Date().getHours() * 60 + new Date().getMinutes(), seated = new Set(slOpenTabs().map((t) => t.booking).filter(Boolean));
    return rsOfDay(dayKey()).filter((b) => rsLive(b) && b.status !== "arrive" && !seated.has(b.id)).filter((b) => { const d = rsMin(b.time) - now; return d >= -20 && d <= 60; }).slice(0, 6);
  } catch (e) { return []; }
}

/* ── Cuisine: the tickets, the 86s, the fridges ── */
function cfKitchenData() {
  const all = slKitchen(), today = dayKey();
  const live = all.filter((o) => ["nouvelle", "prep"].includes(o.status)).sort((a, b) => (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || (a.firedAt || a.at || 0) - (b.firedAt || b.at || 0));
  const held = all.filter((o) => o.status === "attente"), ready = all.filter((o) => o.status === "prete");
  const done = (CM.orders || []).filter((o) => o.day === today && o.readyAt && ["prete", "servie"].includes(o.status));
  const times = done.filter((o) => o.readyAt > (o.firedAt || o.at)).map((o) => (o.readyAt - (o.firedAt || o.at)) / 6e4);
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const late = live.filter((o) => slMin(o.firedAt || o.at) >= 20);
  return { live, held, ready, avg, late, done };
}
function cfFridges() {
  const slot = slotNow(), rs = readingsFor(dayKey(), slot);
  return { slot, pend: (S.fridges || []).filter((f) => !rs.find((r) => r.fridgeId === f.id)), bad: rs.filter((r) => r.ok === false) };
}
function cfCuisine() {
  const K = cfKitchenData(), F = cfFridges();
  const outs = slDishes().filter((n) => slOut(n.id)), lefts = slDishes().filter((n) => !slOut(n.id) && slLeft(n.id) != null);
  const allDay = new Map(); K.live.forEach((o) => (o.items || []).forEach((x) => { if (x.off || x.ok) return; allDay.set(x.name, (allDay.get(x.name) || 0) + (+x.q || 0)); }));
  const day = [...allDay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const kpi = `<div class="cf-kpi st" style="--i:2"><div><b class="mono">${K.live.length}</b><span>sur le feu</span></div><div><b class="mono">${K.held.length}</b><span>à suivre</span></div><div class="${K.late.length ? "bad" : ""}"><b class="mono">${K.late.length}</b><span>en retard</span></div><div><b class="mono">${K.avg != null ? K.avg + "'" : "–"}</b><span>temps moyen</span></div></div>`;
  const cards = K.live.length ? `<div class="sl-kgrid cf-kgrid">${K.live.map((o, i) => slKCard(o, i)).join("")}</div>`
    : `<div class="cf-calm st" style="--i:3"><span class="cf-ci">${ico("slHat")}</span><div><b>Rien sur le feu</b><em>Les bons de la salle et du menu QR arrivent ici en grand, le plus ancien d'abord.</em></div></div>`;
  const temp = `<div class="glass cf-card st" style="--i:4"><header>${ico("therm")}<b>Températures</b><span class="mono">${F.pend.length ? F.pend.length : ""}</span></header>
    ${F.pend.length ? `<div class="cf-frs">${F.pend.slice(0, 4).map((f) => `<button class="cf-fr" data-act="homeFridge" data-id="${esc(f.id)}">${ico("snow")}<b>${esc(f.name)}</b><em>Relever</em></button>`).join("")}</div>${F.pend.length > 4 ? `<button class="btn ghost sm block" data-go="releve">Les ${F.pend.length} frigos</button>` : ""}`
      : `<p class="cf-ok">${S.fridges.length ? `Tous les frigos sont relevés pour ce ${F.slot === "midi" ? "midi" : "soir"}.` : "Aucun frigo pour l'instant."}</p>`}
    ${F.bad.length ? `<p class="cf-warn">${ico("slWarn")}${cfPl(F.bad.length, "relevé hors limite", "relevés hors limite")} aujourd'hui</p>` : ""}</div>`;
  const rupt = `<div class="glass cf-card st" style="--i:5"><header>${ico("slBan")}<b>Ruptures</b><span class="mono">${outs.length || ""}</span></header>
    ${outs.length || lefts.length ? `<div class="cf-outs">${outs.map((n) => `<span class="out">${esc(n.title || "")}</span>`).join("")}${lefts.map((n) => `<span>${esc(n.title || "")} <b class="mono">${slLeft(n.id)}</b></span>`).join("")}</div>` : `<p class="cf-ok">Toute la carte est disponible.</p>`}
    <button class="btn cf-big soft block" data-act="slOuts">${ico("slBan")}Déclarer une rupture</button></div>`;
  const dayH = day.length ? `<div class="glass cf-card st" style="--i:6"><header>${ico("slList")}<b>Total par plat</b></header>${day.map(([k, n]) => `<div class="cf-dy"><b class="mono">${n}</b><span>${esc(k)}</span></div>`).join("")}</div>` : "";
  const quick = `<div class="cf-kq st" style="--i:2"><button class="btn soft cf-big" ${F.pend.length ? `data-act="homeFridge" data-id="${esc(F.pend[0].id)}"` : `data-go="releve"`}>${ico("therm")}Températures${F.pend.length ? `<b class="mono">${F.pend.length}</b>` : ""}</button><button class="btn soft cf-big" data-act="slOuts">${ico("slBan")}Ruptures${outs.length ? `<b class="mono">${outs.length}</b>` : ""}</button></div>`;
  return `${kpi}${quick}<div class="cf-kwrap"><div class="cf-kmain">${cards}</div><aside class="cf-kside">${temp}${rupt}${dayH}<button class="btn soft block st" style="--i:7" data-go="cuisine">${ico("slHat")}Écran cuisine complet</button></aside></div>`;
}

/* ── Pilotage: the whole service, live ── */
function cfPilote() {
  const s = cfSvc() || CF.cur, t0 = s ? s.t0 : Date.now() - 4 * 36e5, K = cfKitchenData(), F = cfFridges(), money = cfMoney();
  const open = slOpenTabs(), { T } = slTables(), byT = typeof slTabMap === "function" ? slTabMap() : new Map(open.map((t) => [t.tableId, t]));
  const closed = ((SL.tabs || []).filter((t) => t.status === "closed" && (t.openedAt || 0) >= t0 && !t.mergedInto && (+t.total || 0) > 0));
  const cvNow = open.reduce((a, t) => a + (+t.covers || 0), 0), cvDone = closed.reduce((a, t) => a + (+t.covers || 0), 0);
  let toCome = 0; try { const now = new Date().getHours() * 60 + new Date().getMinutes(), seated = new Set(open.map((t) => t.booking).filter(Boolean)); toCome = rsOfDay(dayKey()).filter((b) => rsLive(b) && b.status !== "arrive" && !seated.has(b.id) && rsMin(b.time) >= now - 20 && (!s || rsMin(b.time) <= cfMin(s.to) + 15)).reduce((a, b) => a + (+b.covers || 0), 0); } catch (e) {}
  const waiting = K.ready.filter((o) => slMin(o.readyAt || o.at) >= 3);
  const inRoom = slTotal(open.flatMap((t) => t.items || [])), taken = inRoom + closed.reduce((a, t) => a + (+t.total || 0), 0);
  const tile = (v, l, sub, tone, i, go) => `<button class="cf-pt ${tone || ""} st" style="--i:${i}" ${go ? `data-go="${go}"` : "tabindex=\"-1\""}><span class="cf-pl">${l}</span><b class="mono">${v}</b><em>${sub}</em></button>`;
  const tiles = `<div class="cf-ptiles">
    ${tile(cvNow, "Couverts en salle", `${cvDone} déjà partis · ${toCome} attendus`, "", 2, "salle")}
    ${tile(`${open.length}<small>/${T.length}</small>`, "Tables", `${Math.max(0, T.length - open.length)} libres`, "", 2, "salle")}
    ${tile(K.live.length, "En cuisine", K.late.length ? `${K.late.length} en retard` : `${K.held.length} à suivre`, K.late.length ? "bad" : "", 3, "cuisine")}
    ${tile(K.avg != null ? K.avg + "'" : "–", "Temps moyen", `${K.done.length} ${K.done.length > 1 ? "bons sortis" : "bon sorti"}`, K.avg != null && K.avg >= 18 ? "warn" : "", 3, "cuisine")}
    ${tile(K.ready.length, "Au passe", waiting.length ? `${waiting.length} attend${waiting.length > 1 ? "ent" : ""} depuis 3 min` : "rien n'attend", waiting.length ? "warn" : "", 4, "")}
    ${money ? tile(`${Math.round(taken).toLocaleString("fr-FR")}<small> €</small>`, "Pris ce service", `dont ${Math.round(inRoom).toLocaleString("fr-FR")} € en salle`, "", 4, "") : ""}
  </div>`;
  const alerts = [];
  K.late.forEach((o) => alerts.push([1, "bad", "slFire", `${slWho(o)}${o.courseT ? ` · ${o.courseT}` : ""}`, `${slMin(o.firedAt || o.at)} min en cuisine${o.rush ? " · réclamé" : ""}`, `<button class="btn sm soft" data-go="cuisine">Voir</button>`]));
  waiting.forEach((o) => alerts.push([2, "warn", "cmBell", `${slWho(o)}${o.courseT ? ` · ${o.courseT}` : ""}`, `Prêt depuis ${slMin(o.readyAt || o.at)} min, personne ne l'a pris`, `<button class="btn sm cf-serv" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}${o.src === "salle" ? "Servi" : "Remis"}</button>`]));
  const outs = slDishes().filter((n) => slOut(n.id)); if (outs.length) alerts.push([3, "", "slBan", `${cfPl(outs.length, "plat épuisé", "plats épuisés")}`, outs.map((n) => n.title).slice(0, 4).join(", "), `<button class="btn sm soft" data-act="slOuts">Gérer</button>`]);
  if (F.pend.length) alerts.push([4, "", "therm", `${cfPl(F.pend.length, "frigo à relever", "frigos à relever")}`, F.pend.slice(0, 3).map((f) => f.name).join(", "), `<button class="btn sm soft" data-act="homeFridge" data-id="${esc(F.pend[0].id)}">Relever</button>`]);
  if (F.bad.length) alerts.push([2, "bad", "slWarn", `${cfPl(F.bad.length, "relevé hors limite", "relevés hors limite")}`, "Aujourd'hui, à vérifier", `<button class="btn sm soft" data-go="releve">Voir</button>`]);
  try { if (typeof ALERTES !== "undefined" && ALERTES.count()) alerts.push([3, "warn", "alBell", `${cfPl(ALERTES.count(), "alerte")}`, "Frigos, sondes, livraisons", `<button class="btn sm soft" data-go="alertes">Voir</button>`]); } catch (e) {}
  alerts.sort((a, b) => a[0] - b[0]);
  const alertH = `<div class="glass cf-card cf-alerts st" style="--i:5"><header>${ico("slWarn")}<b>Ce qui coince</b><span class="mono">${alerts.length || ""}</span></header>
    ${alerts.length ? alerts.map(([, tone, ic, t, sub, btn]) => `<div class="cf-al ${tone}"><span class="cf-ali">${ico(ic)}</span><div><b>${esc(t)}</b><em>${esc(sub)}</em></div>${btn}</div>`).join("") : `<div class="cf-zen"><b>Tout roule.</b><em>Rien en retard, rien qui attend au passe.</em></div>`}</div>`;
  const room = `<div class="glass cf-card cf-room st" style="--i:6"><header>${ico("plZone")}<b>La salle</b><span class="cf-leg"><i class="k-open"></i>À table<i class="k-cook"></i>En cuisine<i class="k-ready"></i>Prêt</span></header>
    <div class="cf-mini">${T.map((t) => { const tab = byT.get(t.id), k = tab ? slTabState(tab).k : "free"; return `<button class="k-${k}" data-act="slTable" data-id="${esc(t.id)}" aria-label="Table ${esc(t.n)}"><b class="mono">${esc(t.n)}</b>${tab ? `<em>${+tab.covers || 0}</em>` : ""}</button>`; }).join("")}</div></div>`;
  let team = ""; try { const on = typeof homeOnShift === "function" ? homeOnShift().filter((x) => x.st === "in") : []; if (on.length) team = `<div class="glass cf-card st" style="--i:7"><header>${ico("users")}<b>En service</b><span class="mono">${on.length}</span></header><div class="cf-team">${on.slice(0, 10).map((x) => `<span>${typeof homeShiftAva === "function" ? homeShiftAva(x) : ""}<b>${esc(firstName(x.name))}</b></span>`).join("")}</div></div>`; } catch (e) {}
  return `${tiles}<div class="cf-pwrap"><div>${alertH}${team}</div><div>${room}<div class="cf-links st" style="--i:7"><button class="btn soft" data-go="salle">${ico("slPad")}Prise de commande</button><button class="btn soft" data-go="cuisine">${ico("slHat")}Écran cuisine</button></div></div></div>`;
}

/* ───────── Accueil: the one-tap card while a service is on ───────── */
function cfHomeCard() {
  if (!S.resto || !cfOn()) return ""; const s = cfSvc(); if (!s) return "";
  const role = cfRole(), roles = CF_ROLES.filter((r) => r[0] !== "pilote" || cfCanPilot());
  return `<section class="cf-hc st" style="--i:1" aria-label="Mode coup de feu"><span class="cf-hcaur" aria-hidden="true"><i></i><i></i><i></i></span>
    <div class="cf-hct"><span class="cf-fl sm" aria-hidden="true"><i></i><i></i>${ico("cfFlame")}</span><div><span class="cf-kick"><i class="cf-dot"></i>${s.live ? "Service en cours" : `Le service commence dans ${s.inMin} min`}</span><b>Passer en mode coup de feu</b><em>Gros boutons, l'essentiel ${esc(cfSvcT(s).replace(/^service /, ""))}, rien d'autre.</em></div></div>
    <div class="cf-hcr">${roles.map(([k, ic, t]) => `<button class="${k === role ? "on" : ""}" data-act="cfGo" data-v="${k}">${ico(ic)}<b>${t}</b></button>`).join("")}</div></section>`;
}
(function cfHomeWrap() {
  const wrap = () => { const H = VIEWS.home; if (!H || H._cf) return; H._cf = true; const h0 = H.render; H.render = function (p) { const html = h0.call(this, p); let c = ""; try { c = cfHomeCard(); } catch (e) {} return c && html.includes("</header>") ? html.replace("</header>", "</header>" + c) : html; }; };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wrap); else wrap();
})();

/* ───────── sheets ───────── */
function cfNewTableSheet() {
  const open = new Set(typeof slTabMap === "function" ? slTabMap().keys() : slOpenTabs().map((t) => t.tableId)), { T } = slTables(), free = T.filter((t) => !open.has(t.id));
  openSheet(`<div class="cf-sh"><div class="sl-shh"><span class="h2">Quelle table ?</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${free.length ? `<div class="cf-free">${free.map((t, i) => { const b = slBookingAt(t.id); return `<button class="${b ? "bk" : ""}" style="--i:${Math.min(i, 20)}" data-act="slTable" data-id="${esc(t.id)}"><b class="mono">${esc(t.n)}</b>${b ? `<em>${esc(b.time)} · ${esc(firstName(b.name) || "")}</em>` : `<em>${+t.seats || 2} places</em>`}</button>`; }).join("")}</div>`
      : `<p class="sub">Toutes les tables sont occupées.</p>`}</div>`);
}
function cfSetSheet() {
  let svcs = [], cfg = null; try { cfg = rsCfg(); svcs = cfg.services || []; } catch (e) {}
  const today = (s) => { if (!cfg) return ""; let on = true; try { on = rsDaySvcs(cfg, dayKey()).some((x) => x.id === s.id); } catch (e) {} if (!on) return "fermé aujourd'hui"; const sp = cfSpan(cfg, dayKey(), s); return sp.n ? `aujourd'hui ${sp.from} – ${sp.to} · ${cfPl(sp.n, "résa")}` : "aujourd'hui pas encore de résa"; };
  const on = cfAuto(), D = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  openSheet(`<div class="cf-sh"><div class="sl-shh"><span class="h2">Coup de feu</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <button class="cf-sw${on ? " on" : ""}" data-act="cfAutoTog" role="switch" aria-checked="${on}"><span><b>S'allume tout seul</b><em>Sur cet appareil, ${CF_PRE} min avant la première réservation du service, et s'éteint ${CF_POST} min après la dernière.</em></span><i></i></button>
    <div class="lbl">Vos services</div>
    <div class="glass cf-svcs">${svcs.map((s) => `<div><b>${esc(s.name)}</b><span class="mono">${esc(s.from)} – ${esc(s.to)}</span><em>${(s.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => D[d]).join(" ")}</em>${cfg ? `<em class="cf-today">${esc(today(s))}</em>` : ""}</div>`).join("") || `<p class="sub">Aucun service.</p>`}</div>
    <p class="note">Le coup de feu suit les réservations du jour : il démarre avant la première et s'arrête après la dernière. Un service sans réservation garde ses horaires, réglés dans les Réservations.</p>
    ${myRole() === "gerant" || DB.mode === "demo" ? `<button class="btn soft block" data-act="cfHours">${ico("clock")}Modifier les horaires</button>` : ""}</div>`);
}

Object.assign(ACT, {
  cfGo: (a, id, v) => { SFX.tap(); cfEnter(v || cfRole(), false); },
  cfRole: (a, id, v) => { if (!S.rid || v === cfRole()) return; cfLS("gg-cf-role-" + S.rid, v); SFX.tick(); buzz(5); const r = a.closest(".cf-roles"); if (r) { const roles = [...r.querySelectorAll("button")]; r.style.setProperty("--ri", roles.indexOf(a)); roles.forEach((b) => b.classList.toggle("on", b === a)); } setTimeout(rerender, 160); },
  cfExit: () => { const s = cfSvc(); if (s && S.rid) cfLS("gg-cf-seen-" + S.rid, s.key); CF.cur = null; SFX.close(); buzz(6); go("home", {}, { back: true }); S.history = []; setTimeout(() => toast(s && !s.demo ? "Coup de feu coupé. Il revient au prochain service." : "Coup de feu coupé"), 380); },
  cfNewTable: () => { SFX.tap(); cfNewTableSheet(); },
  cfSet: () => { SFX.tap(); cfSetSheet(); },
  cfAutoTog: () => { const on = !cfAuto(); cfLS("gg-cf-auto-" + S.rid, on ? "1" : "0"); SFX.tick(); buzz(4); cfSetSheet(); toast(on ? "Le coup de feu s'allumera tout seul" : "Le coup de feu ne s'allumera qu'à la main"); },
  cfHours: () => { closeSheet(); go("resa"); setTimeout(() => { try { if (ACT.rsCfgOpen) ACT.rsCfgOpen(); } catch (e) {} }, 450); },
});
