/* Growth Gusto — area: écran bar (route « bar »). Prefix « br ».
   L'écran cuisine des boissons. Une tablette (ou un téléphone) au comptoir reçoit :
     - les bons « Boissons » de la prise de commande (js/salle.js : station "bar", ils partent tout de suite à l'envoi) ;
     - les boissons des commandes du menu QR (js/commande.js) : seules les lignes boissons s'affichent ici, la cuisine garde le reste.
   Gestes : une ligne touchée = faite (barrée) ; « Prêt » prévient le serveur sur son téléphone (comme la cuisine) ; pour le QR,
   « Boissons prêtes » coche les boissons du bon. Le livre ouvre la recette pas à pas du cocktail (js/recette.js).
   À côté : le total à préparer par boisson (avec le verre), ce qui attend au comptoir, et les tables dont les desserts sont
   lancés (le moment de proposer les cafés). Carillon cristallin à chaque bon, impression du bon possible, écran toujours allumé.
   Réglage du restaurant : qrMenu/cfg.barScreen = true quand le bar a son écran : les bons boissons quittent alors « Tout » sur
   l'écran cuisine et le coup de feu Cuisine (ils restent dans le filtre « Bar »), et la cuisine ne sonne plus pour eux.
   Aussi : rôle « Bar » du coup de feu (js/rush.js), poste Bar et appareil « Écran bar » dans Vues & appareils (js/espaces.js).
   Data: none of its own (clientOrders, qrMenu/cfg). Pack Second (pro), like the kitchen screen. */
"use strict";

TAB_OF.bar = "more";
(function brNav() {
  if (NAV.some((n) => n[0] === "bar")) return;
  const i = NAV.findIndex((n) => n[0] === "cuisine");
  NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["bar", "slGlass", "Écran bar"]);
})();
try { if (typeof AB_GATE !== "undefined") AB_GATE.bar = ["pro", "Écran bar"]; } catch (e) {}
/* the lesson of the screen (js/lecons.js), when the onboarding lessons are there */
try { if (typeof PC_LECONS === "object") PC_LECONS.bar = { t: "Écran bar", d: "Les boissons de la salle et du menu QR arrivent au comptoir, la cuisine ne voit plus que ses plats.",
  steps: ["Une boisson touchée est faite : elle se barre.", "« Prêt » prévient le serveur sur son téléphone.", "Le livre ouvre la recette du cocktail, pas à pas, avec le bon verre."],
  q: ["Où voir combien de spritz préparer pour toutes les tables ?", ["Dans « À préparer », à côté des bons", "Sur l'écran cuisine", "Dans le menu QR"], 0], sc: { k: "board" }, who: "bar" }; } catch (e) {}
try { if (typeof BIG_ROUTES !== "undefined" && !BIG_ROUTES.includes("bar")) BIG_ROUTES.push("bar"); } catch (e) {}
Object.assign(IC, {
  brShaker: ["M8 8h8l-1.2 12.2a1 1 0 0 1-1 .8h-3.6a1 1 0 0 1-1-.8z", "M7.5 8h9", "M9 8V6.5a3 3 0 0 1 6 0V8", "M11 3.5h2", "f:M8 8h8l-1.2 12.2a1 1 0 0 1-1 .8h-3.6a1 1 0 0 1-1-.8z"],
  brCup: ["M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z", "M16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.8", "M8 3.5c-.6 1 .6 2 0 3", "M12 3.5c-.6 1 .6 2 0 3", "f:M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"],
});

const BR = { tick: null };
const brRoute = () => S.route === "bar" || (S.route === "coupdefeu" && typeof cfRole === "function" && cfRole() === "bar");
const brCfg = () => (typeof cmCfg === "function" ? cmCfg() : {});
/* the bar has its own screen: its tickets leave the kitchen's « Tout » */
const brOn = () => !!brCfg().barScreen;
const brNote = (id) => (id && (S.notes || []).find((n) => n.id === id)) || null;
function brIsDrink(x) {
  if (!x) return false; if (x.cat === "boisson") return true;
  const n = brNote(x.id); return !!n && n.carteCat === "boisson";
}
/* on a kitchen card (QR order), a drink line says it is the bar's */
function brLineTag(o, x) { return brOn() && o.src !== "salle" && brIsDrink(x) ? ` <i class="sl-tag brt">${ico("slGlass")}Bar</i>` : ""; }
const brMine = (o) => (o.src === "salle" ? o.station === "bar" : (o.items || []).some((x) => !x.off && brIsDrink(x)));
/* the drink lines of a ticket, with their index on the ticket */
const brLines = (o) => (o.items || []).map((x, j) => ({ x, j })).filter(({ x }) => (o.src === "salle" ? true : brIsDrink(x)));
const brPlates = (o) => brLines(o).filter(({ x }) => !x.off).reduce((a, { x }) => a + (+x.q || 0), 0);

function brData() {
  const all = typeof slKitchen === "function" ? slKitchen() : [], today = dayKey();
  const live = all.filter((o) => brMine(o) && (o.src === "salle" ? ["nouvelle", "prep"].includes(o.status) : ["nouvelle", "prep", "prete"].includes(o.status) && brLines(o).some(({ x }) => !x.off && !x.ok)))
    .sort((a, b) => (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || (a.firedAt || a.at || 0) - (b.firedAt || b.at || 0));
  const ready = all.filter((o) => o.src === "salle" && o.station === "bar" && o.status === "prete").sort((a, b) => (a.readyAt || 0) - (b.readyAt || 0));
  const done = ((typeof CM !== "undefined" && CM.orders) || []).filter((o) => o.day === today && o.src === "salle" && o.station === "bar" && o.readyAt && ["prete", "servie"].includes(o.status));
  const times = done.filter((o) => o.readyAt > (o.firedAt || o.at)).map((o) => (o.readyAt - (o.firedAt || o.at)) / 6e4);
  const avg = times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10 : null;
  const late = live.filter((o) => slMin(o.firedAt || o.at) >= 8).length;
  /* what to pour, all tickets together */
  const tot = new Map();
  live.forEach((o) => brLines(o).forEach(({ x }) => { if (x.off || x.ok) return; const k = x.id || x.name; const r = tot.get(k) || { id: x.id, name: x.name, q: 0 }; r.q += +x.q || 0; tot.set(k, r); }));
  /* desserts on the way: the moment to offer coffee */
  const sweet = all.filter((o) => o.src === "salle" && +o.course === 3 && ["nouvelle", "prep", "prete"].includes(o.status)).sort((a, b) => (a.firedAt || a.at || 0) - (b.firedAt || b.at || 0));
  return { live, ready, done, avg, late, tot: [...tot.values()].sort((a, b) => b.q - a.q), sweet };
}

function brCard(o, i) {
  const t0 = o.firedAt || o.at, m = slMin(t0), salle = o.src === "salle", L = brLines(o), modNew = o.mod && Date.now() - o.mod < 5 * 6e4;
  const head = salle ? `<b class="sl-ktab">Table <span class="mono">${esc(o.table)}</span></b>` : `<b class="sl-ktab">${o.mode === "table" ? `Table <span class="mono">${esc(o.table)}</span>` : `${ico("cmBag")}<span class="mono">${esc(o.slot || "")}</span>`}</b><span class="sl-kcrs qr">${o.mode === "table" ? "QR" : `n° ${o.n}`}</span>`;
  const meta = [salle && o.waiterName ? firstName(o.waiterName) : "", salle && o.covers ? `${o.covers} couv.` : "", !salle && o.name ? o.name : "", !salle && L.length < (o.items || []).length ? "le reste part en cuisine" : ""].filter(Boolean);
  const flags = [o.rush ? `<span class="sl-flag rush">${ico("slBolt")}Prioritaire</span>` : "", modNew ? `<span class="sl-flag mod">${ico("slWarn")}Modifié</span>` : "", o.add ? `<span class="sl-add">Ajout</span>` : ""].join("");
  const li = ({ x, j }) => { const n = brNote(x.id);
    return `<li class="${x.ok ? "ok" : ""}${x.off ? " off" : ""}" data-act="slKItem" data-id="${esc(o.id)}" data-v="${j}"><b class="mono">${x.q}</b><span><span class="sl-kn">${esc(x.name)}${x.seat ? ` <i class="sl-tag seat">P${x.seat}</i>` : ""}</span>${n && n.vessel && !x.off ? `<i class="br-vs">${esc(n.vessel)}</i>` : ""}${x.off ? `<i class="sl-ial">ANNULÉ${x.offReason ? ` · ${esc(x.offReason)}` : ""}</i>` : ""}${(x.without || []).map((w) => `<em class="m-w">Sans ${esc(w)}</em>`).join("")}${(x.extras || []).map((e) => `<em class="m-x">+ ${esc(e.t)}</em>`).join("")}${x.note ? `<em>${esc(x.note)}</em>` : ""}${(x.allergy || []).length ? `<i class="sl-ial clash">${ico("slWarn")}${esc(x.allergy.map((a) => slAl(a).t).join(", "))}</i>` : ""}</span>${typeof rpBtn === "function" ? rpBtn(o, x, j) : ""}</li>`; };
  return `<article class="sl-kcard br-card s-${o.status}${m >= 8 ? " late" : m >= 4 ? " warm" : ""}${CM.fresh.has(o.id) ? " fresh" : ""}${o.rush ? " rush" : ""}" style="--i:${Math.min(i, 10)}" data-id="${esc(o.id)}">
    <header>${head}<span class="sl-kt mono" data-at="${t0}">${slAgo(t0)}</span></header>
    ${flags || meta.length ? `<div class="sl-kmeta">${flags}${meta.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
    <ul class="sl-kit">${L.map(li).join("")}</ul>
    ${o.note ? `<div class="cm-onote">${ico("rsNote")}<span>${esc(o.note)}</span></div>` : ""}
    <footer>${salle ? `<button class="btn acc sl-kgo rdy" data-act="slKNext" data-id="${esc(o.id)}" data-v="prete">${ico("cmBell")}Prêt</button>` : `<button class="btn acc sl-kgo rdy" data-act="brQrDone" data-id="${esc(o.id)}">${ico("check")}Boissons prêtes</button>`}<button class="iconbtn sm" data-act="brPrint" data-id="${esc(o.id)}" aria-label="Imprimer le bon">${ico("printer")}</button></footer>
  </article>`;
}
const brEmpty = (i) => `<div class="glass sl-empty sl-kempty br-empty st" style="--i:${i}"><div class="br-ill" aria-hidden="true"><i></i><i></i><i></i></div><b class="h3">Le comptoir est calme</b><p class="sub">Les boissons envoyées par la salle et celles du menu QR arrivent ici, avec un carillon. La cuisine ne voit que ses plats.</p></div>`;
function brSide(D, i0) {
  const tot = D.tot.length ? `<div class="glass sl-ks br-tot st" style="--i:${i0}"><header>${ico("brShaker")}<b>À préparer</b><span class="mono">${D.tot.reduce((a, r) => a + r.q, 0)}</span></header>
      ${D.tot.map((r) => { const n = brNote(r.id); return `<div class="br-tr"><b class="mono">${r.q}</b><span><b>${esc(r.name)}</b>${n && n.vessel ? `<em>${esc(n.vessel)}</em>` : ""}</span>${n ? `<button class="iconbtn sm" data-act="rpOpen" data-id="${esc(n.id)}" data-v="${r.q}" aria-label="Recette de ${esc(r.name)}">${ico("book")}</button>` : ""}</div>`; }).join("")}</div>` : "";
  const rdy = `<div class="glass sl-ks st" style="--i:${i0 + 1}"><header>${ico("cmBell")}<b>Au comptoir</b><span class="mono">${D.ready.length}</span></header>${D.ready.map((o) => `<div class="sl-kr${o.call ? " call" : ""}"><div><b>Table ${esc(o.table)}</b><em>${brPlates(o)} boisson${brPlates(o) > 1 ? "s" : ""} · <span class="cm-ago" data-at="${o.readyAt || o.at}">${slAgo(o.readyAt || o.at)}</span>${o.waiterName ? ` · ${esc(firstName(o.waiterName))}` : ""}${o.call ? " · rappelé" : ""}</em></div>
      <button class="btn ghost sm sl-callb${o.call ? " on" : ""}" data-act="slCall" data-id="${esc(o.id)}" title="Fait sonner le téléphone du serveur">${ico("slCall")}${o.call ? "Rappelé" : "Rappeler"}</button><button class="btn sm sl-servb" data-act="slServed" data-id="${esc(o.id)}">${ico("check")}Parti</button></div>`).join("") || `<p class="sl-ksn">Rien n'attend sur le comptoir.</p>`}</div>`;
  const sw = D.sweet.length ? `<div class="glass sl-ks br-sweet st" style="--i:${i0 + 2}"><header>${ico("brCup")}<b>Desserts lancés</b><span class="mono">${D.sweet.length}</span></header><p class="br-swn">Le bon moment pour proposer les cafés.</p>
      ${D.sweet.map((o) => `<div class="br-sw"><b class="mono">${esc(o.table)}</b><span>${(o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0)} dessert${(o.items || []).filter((x) => !x.off).reduce((a, x) => a + (+x.q || 0), 0) > 1 ? "s" : ""}${o.covers ? ` · ${o.covers} couv.` : ""}</span><em>${o.status === "prete" ? "au passe" : slAgo(o.firedAt || o.at)}</em></div>`).join("")}</div>` : "";
  return `${tot}${rdy}${sw}`;
}
VIEWS.bar = {
  render() {
    if (typeof slWatch === "function") slWatch();
    const D = brData(), sound = SFX.ctx && SFX.ctx.state === "running", on = brOn();
    const right = `<span class="sl-clock mono" id="brClock">${hm(Date.now())}</span><button class="iconbtn${SL.print ? " on" : ""}" data-act="slPrintTog" aria-pressed="${SL.print}" aria-label="Imprimer chaque nouveau bon" title="Imprimer chaque nouveau bon">${ico("printer")}</button>`;
    return `<div class="inner wide sl sl-k br">${topBar("Écran bar", { right })}
      ${sound ? "" : `<button class="sl-snd st" style="--i:1" data-act="slSound">${ico("sound")}<span><b>Touchez pour activer le carillon</b><em>La tablette sonne à chaque nouvelle boisson.</em></span></button>`}
      ${on ? "" : `<div class="glass br-setup st" style="--i:1"><span class="br-si">${ico("slGlass")}</span><div><b>Les boissons s'affichent aussi en cuisine</b><em>Gardez-les seulement ici : la cuisine ne voit plus que ses plats, et ne sonne plus pour un café.</em></div><button class="btn acc sm" data-act="brMode" data-v="1">Seulement au bar</button></div>`}
      <div class="sl-kbar st" style="--i:1"><div class="sl-kst"><span><b class="mono">${D.live.length}</b>à préparer</span><span><b class="mono">${D.tot.reduce((a, r) => a + r.q, 0)}</b>boissons</span><span class="${D.late ? "bad" : ""}"><b class="mono">${D.late}</b>en retard</span><span><b class="mono">${D.avg != null ? String(D.avg).replace(".", ",") + "'" : "–"}</b>temps moyen</span><span><b class="mono">${D.done.length}</b>servis</span></div>
        <button class="btn soft sm sl-86b" data-act="slOuts">${ico("slBan")}Ruptures</button></div>
      <div class="sl-kwrap">
        <div class="sl-kgrid br-grid">${D.live.map((o, i) => brCard(o, i)).join("") || brEmpty(2)}</div>
        <aside class="sl-kside">${brSide(D, 2)}
          ${on ? `<button class="btn ghost sm br-off st" style="--i:6" data-act="brMode" data-v="0">${ico("slHat")}Montrer aussi les boissons en cuisine</button>` : ""}</aside>
      </div>
    </div>`;
  },
  after(v) {
    clearInterval(BR.tick);
    BR.tick = setInterval(() => {
      if (!brRoute()) { clearInterval(BR.tick); BR.tick = null; return; }
      const c = document.getElementById("brClock"); if (c) c.textContent = hm(Date.now());
      $$(".br-card .sl-kt[data-at]").forEach((el) => { const m = slMin(+el.dataset.at), k = el.closest(".sl-kcard"); el.textContent = slAgo(+el.dataset.at); if (k) { k.classList.toggle("warm", m >= 4 && m < 8); k.classList.toggle("late", m >= 8); } });
      $$(".br .cm-ago[data-at]").forEach((el) => { el.textContent = slAgo(+el.dataset.at); });
      if (typeof slWake === "function") slWake(true); /* the kitchen screen releases the lock when it is left: take it back */
    }, 10000);
    if (typeof slWake === "function") slWake(true);
    $$(".sl-kcard.fresh", v).forEach((el) => setTimeout(() => el.classList.remove("fresh"), 2600)); setTimeout(() => { try { CM.fresh.clear(); } catch (e) {} }, 2700);
  },
};
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && brRoute() && typeof slWake === "function") { SL.wake = null; slWake(true); } });

/* coup de feu, role « Bar » (js/rush.js) */
function brCfBody() {
  const D = brData();
  const kpi = `<div class="cf-kpi st" style="--i:2"><div><b class="mono">${D.live.length}</b><span>à préparer</span></div><div><b class="mono">${D.tot.reduce((a, r) => a + r.q, 0)}</b><span>boissons</span></div><div class="${D.late ? "bad" : ""}"><b class="mono">${D.late}</b><span>en retard</span></div><div><b class="mono">${D.ready.length}</b><span>au comptoir</span></div></div>`;
  const cards = D.live.length ? `<div class="sl-kgrid cf-kgrid br-grid">${D.live.map((o, i) => brCard(o, i)).join("")}</div>` : `<div class="cf-calm st" style="--i:3"><span class="cf-ci">${ico("slGlass")}</span><div><b>Rien à préparer</b><em>Les boissons de la salle et du menu QR arrivent ici en grand, avec un carillon.</em></div></div>`;
  return `${kpi}<div class="cf-kwrap"><div class="cf-kmain">${cards}</div><aside class="cf-kside">${brSide(D, 4)}<button class="btn soft block st" style="--i:7" data-go="bar">${ico("slGlass")}Écran bar complet</button></aside></div>`;
}

/* new tickets: a crystal chime on the bar; the kitchen stays quiet for drinks once the bar has its screen */
function brChime() { try { SFX.init(); SFX.tone(1568, 0.16, "sine", 0.05); SFX.tone(2093, 0.2, "sine", 0.045, 0.09); SFX.tone(2637, 0.4, "sine", 0.03, 0.18); SFX.noise(0.12, 0.008, 6000, 3000, 0.02); buzz([18, 40, 18]); } catch (e) {} }
const brSlice = (o) => (o.src === "salle" ? o : { ...o, items: brLines(o).map(({ x }) => x) });
(function brHook() {
  if (typeof cmAlert !== "function") return;
  const a0 = cmAlert;
  cmAlert = function (o) {
    if (o && brRoute()) {
      if (!SL.mine.has(o.id) && brMine(o)) { CM.fresh.add(o.id); brChime(); if (SL.print) slPrint(brSlice(o)); }
      return;
    }
    if (o && o.src === "salle" && o.station === "bar" && brOn()) return;
    return a0(o);
  };
})();

Object.assign(ACT, {
  brMode: async (a, id, v) => {
    const on = v === "1"; SFX.ok(); buzz(8);
    if (typeof cmSaveCfg === "function") await cmSaveCfg({ barScreen: on });
    toast(on ? "Les boissons ne s'affichent plus qu'au bar. La cuisine les retrouve dans son filtre « Bar »." : "Les boissons s'affichent de nouveau aussi en cuisine.");
    rerender();
  },
  brQrDone: async (a, id) => {
    const o = (CM.orders || []).find((x) => x.id === id); if (!o) return;
    const items = (o.items || []).map((x) => (!x.off && brIsDrink(x) ? { ...x, ok: true } : x)), onlyDrinks = (o.items || []).every((x) => x.off || brIsDrink(x));
    const card = a.closest(".sl-kcard"); if (card) card.classList.add("go"); SFX.done(); buzz([14, 40, 14]);
    const patch = { items, ...(onlyDrinks && o.status !== "prete" ? { status: "prete", readyAt: Date.now(), by: S.me.id } : {}) };
    setTimeout(async () => { try { await safe(DB.update("clientOrders", id, patch)); toast(`${slWho(o)} : boissons prêtes${onlyDrinks ? "" : ", la cuisine fait le reste"}`); } catch (e) {} onData(); }, card ? 280 : 0);
  },
  brPrint: (a, id) => { const o = (CM.orders || []).find((x) => x.id === id); if (!o) return; SFX.print ? SFX.print() : SFX.tap(); slPrint(brSlice(o)); },
});
