/* Growth Gusto — area: recette pas à pas (route « recette », params { id, q, t }). Prefix « rp ».
   Sur l'écran cuisine et l'écran bar, on touche un plat (ou une boisson) d'un bon : sa fiche s'ouvre en très grand, faite pour
   être lue à un mètre avec les mains prises :
     - la table et ce que le serveur a noté pour CETTE assiette (sans oignon, cuisson, allergie en rouge) ;
     - les grammages calculés pour le nombre d'assiettes du bon (la fiche est écrite pour N portions) ;
     - les étapes une par une, en gros, avec leur photo ; un minuteur d'un geste quand l'étape dit « 3 min » ;
     - le dressage en dernière étape : la photo du plat fini, le contenant (assiette, verre) et la façon de dresser.
   Navigation : flèches du clavier, espace, glisser du doigt, ou les deux gros boutons. Les minuteurs continuent sur tous les écrans.
   « Fait » à la dernière étape coche la ligne sur le bon (ok) et revient à l'écran d'où l'on vient.
   Data: none of its own. Reads the recipe (collection notes, fields of js/notes.js) and, with t = "ticketId|line", the ticket (CM.orders). */
"use strict";

TAB_OF.recette = "more";
try { if (typeof BIG_ROUTES !== "undefined" && !BIG_ROUTES.includes("recette")) BIG_ROUTES.push("recette"); } catch (e) {}
Object.assign(IC, {
  rpPlay: ["M7 4.5v15l12-7.5z", "f:M7 4.5v15l12-7.5z"],
  rpPlate: ["c:12,12,9", "c:12,12,5.2", "f:M12 6.8a5.2 5.2 0 1 1 0 10.4 5.2 5.2 0 0 1 0-10.4z"],
  rpTimer: ["c:12,13.5,7.5", "M12 13.5V10", "M9.5 2.5h5", "M18.5 6.5l1.5-1.5", "f:M12 6a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z"],
  rpList: ["M8 6h12", "M8 12h12", "M8 18h12", "c:4,6,1", "c:4,12,1", "c:4,18,1"],
  rpNext: ["M5 12h14", "M13 6l6 6-6 6"],
  rpPrev: ["M19 12H5", "M11 6l-6 6 6 6"],
});

const RP = { id: null, i: 0, q: 1, all: false, dir: 1, timers: [], tk: null, kb: null };
const rpNote = (id) => (S.notes || []).find((n) => n.id === id) || null;
/* the steps to read: the recipe's, each with its photo; the dressage comes last when there is one */
function rpSteps(n) {
  const L = (typeof noteSteps === "function" ? noteSteps(n) : n.steps || []).map((t, i) => ({ t, ph: Array.isArray(n.stepPh) && Array.isArray(n.steps) ? n.stepPh[i] || "" : "" }));
  if (n.dress || n.dressPh || n.vessel) L.push({ t: n.dress || "", ph: n.dressPh || "", dress: true, vessel: n.vessel || "" });
  return L;
}
/* « 3 min », « 1 h 30 », « 45 secondes », « 10 à 12 min » (the longest): a timer the cook starts with one tap */
function rpDur(t) {
  const s = String(t || "").replace(/ /g, " ");
  let m = /(\d+)\s*h(?:eures?)?\s*(\d{1,2})?\b/i.exec(s); if (m && +m[1] <= 24) return (+m[1] * 60 + (+m[2] || 0)) * 60;
  m = /(\d+(?:[.,]\d+)?)\s*(?:à|-|–)?\s*(\d+(?:[.,]\d+)?)?\s*(min(?:utes?)?|mn)\b/i.exec(s); if (m) return Math.round(parseFloat((m[2] || m[1]).replace(",", ".")) * 60);
  m = /(\d+)\s*(s|sec(?:ondes?)?)\b/i.exec(s); if (m && +m[1] <= 600) return +m[1];
  return 0;
}
const rpDurT = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} h${sec % 3600 ? " " + pad(Math.round((sec % 3600) / 60)) : ""}` : sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} s`);
const rpClock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
/* the ticket line this sheet was opened from: table, quantity and what the waiter wrote */
function rpLine(t) {
  if (!t || typeof CM === "undefined") return null; const [oid, j] = String(t).split("|"); const o = (CM.orders || []).find((x) => x.id === oid); const x = o && (o.items || [])[+j];
  return o && x ? { o, x, j: +j } : null;
}
const rpWho = (o) => (typeof slWho === "function" ? slWho(o) : `Table ${o.table || ""}`);
/* a quantity for k plates (k = plates / portions of the recipe) */
function rpIng(g, k) {
  const s = typeof noteScale === "function" ? noteScale(g.qty, g.unit, k) : { q: g.qty, u: g.unit };
  return `<li><b class="mono">${esc(s.q || "")}<em>${esc(s.u || "")}</em></b><span>${esc(g.name || "")}</span></li>`;
}
/* where the screen goes back to, and which menu entry stays lit */
const rpFrom = () => { const h = S.history[S.history.length - 1]; return h && ["cuisine", "bar", "coupdefeu", "fiche", "notes"].includes(h.route) ? h.route : "cuisine"; };

VIEWS.recette = {
  live: false,
  get nav() { const f = rpFrom(); return f === "fiche" ? "notes" : f; },
  render(p) {
    const n = rpNote(p && p.id);
    if (!n) return `<div class="inner narrow">${topBar("Recette")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("ntChef")}</div><b>Fiche introuvable</b>Ce plat n'a pas encore de fiche recette. Créez-la dans Recettes &amp; allergènes.</div></div>`;
    if (RP.id !== n.id || RP.t !== (p.t || "")) { RP.id = n.id; RP.t = p.t || ""; RP.i = 0; RP.all = false; RP.q = Math.max(1, +p.q || 1); }
    const L = rpLine(p.t), steps = rpSteps(n), base = num(n.portions) > 0 ? num(n.portions) : 1, k = RP.q / base;
    const al = typeof recipeAllergens === "function" ? recipeAllergens(n) : n.allergens || [], alT = (a) => (typeof noteAllergenLabel === "function" ? noteAllergenLabel(a) : a);
    const drink = n.carteCat === "boisson";
    const ctx = L ? (() => { const x = L.x, mods = [...(x.without || []).map((w) => `<i class="w">Sans ${esc(w)}</i>`), ...(x.extras || []).map((e) => `<i class="x">+ ${esc(e.t)}</i>`), x.note ? `<i>${esc(x.note)}</i>` : ""].join("");
      return `<div class="rp-ctx st" style="--i:1"><div class="rp-ctxh"><b>${esc(rpWho(L.o))}</b>${L.o.courseT ? `<span>${esc(L.o.courseT)}</span>` : ""}<em class="mono">${x.q} ×</em></div>${mods ? `<div class="rp-mods">${mods}</div>` : ""}
        ${(x.allergy || []).length ? `<div class="rp-allg">${ico("slWarn")}<b>Allergie : ${esc(x.allergy.map((a) => (typeof slAl === "function" ? slAl(a).t : a)).join(", "))}</b></div>` : ""}</div>`; })() : "";
    const hero = `<div class="rp-hero st${n.photo ? " ph" : ""}" style="--i:1">${n.photo ? `<img src="${esc(n.photo)}" alt="">` : `<span class="rp-hi">${ico(drink ? "slGlass" : "ntChef")}</span>`}
      <div class="rp-ht"><b>${esc(n.title || "")}</b>${n.vessel ? `<em>${ico("rpPlate")}${esc(n.vessel)}</em>` : ""}</div></div>`;
    const alH = al.length ? `<div class="rp-al st" style="--i:2">${ico("alert")}<span>${al.map((a) => `<b>${esc(alT(a))}</b>`).join("")}</span></div>` : "";
    const ings = (n.ingredients || []).filter((g) => g.name);
    const ingH = `<div class="glass rp-ings st" style="--i:3"><header><span class="lbl">${drink ? "Pour" : "Grammages pour"}</span>
        <div class="rp-q"><button class="iconbtn" data-act="rpQ" data-v="-1" aria-label="Une de moins">${ico("minus")}</button><b class="mono" id="rpQ">${RP.q}</b><button class="iconbtn" data-act="rpQ" data-v="1" aria-label="Une de plus">${ico("plus")}</button></div>
        <span class="rp-qu" id="rpQu">${drink ? (RP.q > 1 ? "verres" : "verre") : RP.q > 1 ? "assiettes" : "assiette"}</span></header>
      ${ings.length ? `<ul id="rpIngs">${ings.map((g) => rpIng(g, k)).join("")}</ul>` : `<p class="note">Pas d'ingrédients sur la fiche.</p>`}
      ${base !== 1 ? `<p class="rp-base">La fiche est écrite pour ${noteNum ? noteNum(base) : base} portions : tout est recalculé.</p>` : ""}</div>`;
    const right = `<button class="btn soft sm rp-allb${RP.all ? " on" : ""}" data-act="rpAll" aria-pressed="${RP.all}">${ico("rpList")}<span>${RP.all ? "Une à la fois" : "Tout voir"}</span></button>`;
    return `<div class="inner wide rp${drink ? " drink" : ""}">${topBar(drink ? "Recette" : "Pas à pas", { right })}
      <div class="rp-grid"><aside class="rp-side">${ctx}${hero}${alH}${ingH}
        <button class="btn ghost sm rp-full st" style="--i:4" data-go="fiche" data-id="${esc(n.id)}">${ico("book")}Fiche complète${n.process && n.process.length ? " et process HACCP" : ""}</button></aside>
        <section class="rp-main" id="rpMain">${rpMainHTML(n, steps)}</section></div>
      <div class="rp-dock" id="rpDock">${rpDockHTML()}</div></div>`;
  },
  after(v) {
    const main = $("#rpMain", v); if (!main) return;
    /* swipe left / right on the step */
    let x0 = null, y0 = 0;
    main.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; x0 = e.clientX; y0 = e.clientY; }, { passive: true });
    main.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) rpGo(dx < 0 ? 1 : -1); }, { passive: true });
    if (!RP.kb) { RP.kb = (e) => { if (S.route !== "recette" || $("#sheet").classList.contains("open")) return; const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); rpGo(1); } else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); rpGo(-1); } };
      document.addEventListener("keydown", RP.kb); }
    if (typeof slWake === "function") slWake(true);
  },
};
function rpMainHTML(n, steps) {
  if (!steps.length) return `<div class="glass rp-empty"><span class="rp-hi">${ico("ntChef")}</span><b class="h3">Pas encore d'étapes</b><p class="sub">Écrivez-les dans la fiche : elles s'afficheront ici une par une, en grand, avec leurs photos et le dressage.</p><button class="btn soft" data-act="noteEdit" data-id="${esc(n.id)}">${ico("edit")}Écrire les étapes</button></div>`;
  if (RP.all) return `<ol class="rp-list">${steps.map((s, i) => `<li class="st${i === RP.i ? " cur" : ""}${s.dress ? " dress" : ""}" style="--i:${Math.min(i + 1, 12)}"><button data-act="rpTo" data-v="${i}"><span class="rp-ln mono">${s.dress ? ico("rpPlate") : i + 1}</span><span class="rp-lt">${s.dress ? `<b>Dressage</b>` : ""}${noteTy(esc(s.t || (s.dress ? s.vessel : "")))}</span>${s.ph ? `<img src="${esc(s.ph)}" alt="" loading="lazy">` : ""}</button></li>`).join("")}</ol>`;
  const i = Math.min(RP.i, steps.length - 1), s = steps[i], last = i === steps.length - 1, dur = s.dress ? 0 : rpDur(s.t), L = rpLine(RP.t);
  const dots = `<div class="rp-dots" role="tablist" aria-label="Étapes">${steps.map((x, j) => `<button class="${j === i ? "on" : j < i ? "done" : ""}${x.dress ? " dr" : ""}" data-act="rpTo" data-v="${j}" aria-label="${x.dress ? "Dressage" : `Étape ${j + 1}`}" aria-selected="${j === i}"></button>`).join("")}</div>`;
  const run = dur && RP.timers.find((t) => t.k === RP.id + ":" + i);
  return `${dots}<article class="rp-step${s.dress ? " dress" : ""}${s.ph ? " has-ph" : ""} in-${RP.dir > 0 ? "r" : "l"}" aria-live="polite">
      <span class="rp-sn">${s.dress ? `${ico("rpPlate")}Dressage` : `Étape <b class="mono">${i + 1}</b> sur ${steps.filter((x) => !x.dress).length}`}</span>
      ${s.ph ? `<div class="rp-sph"><img src="${esc(s.ph)}" alt=""></div>` : ""}
      ${s.dress && s.vessel ? `<p class="rp-vessel">${ico("rpPlate")}${esc(s.vessel)}</p>` : ""}
      ${s.t ? `<p class="rp-tx">${noteTy(esc(s.t))}</p>` : ""}
      ${dur ? `<button class="btn soft rp-tmb${run ? " on" : ""}" data-act="rpTimer" data-v="${i}" data-n="${dur}">${ico("rpTimer")}${run ? `<span>En cours · <b class="mono" data-end="${run.end}">${rpClock(run.end - Date.now())}</b></span>` : `<span>Minuteur <b class="mono">${rpDurT(dur)}</b></span>`}</button>` : ""}
    </article>
    <div class="rp-nav"><button class="btn soft rp-prev" data-act="rpGo" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Étape précédente">${ico("rpPrev")}<span>Précédente</span></button>
      ${last ? `<button class="btn acc rp-next rp-done" data-act="rpDone">${ico("check")}<span>${L && !L.x.ok ? "Fait, cocher sur le bon" : "Terminé"}</span></button>` : `<button class="btn acc rp-next" data-act="rpGo" data-v="1">${steps[i + 1].dress ? "Le dressage" : "Étape suivante"}${ico("rpNext")}</button>`}</div>`;
}
function rpPaint() {
  const n = rpNote(RP.id), m = $("#rpMain"); if (!n || !m) return;
  m.innerHTML = rpMainHTML(n, rpSteps(n));
  const b = $(".rp-allb"); if (b) { b.classList.toggle("on", RP.all); b.setAttribute("aria-pressed", RP.all); const s = $("span", b); if (s) s.textContent = RP.all ? "Une à la fois" : "Tout voir"; }
}
function rpGo(d) {
  const n = rpNote(RP.id); if (!n) return; const L = rpSteps(n), wasAll = RP.all; RP.all = false;
  const j = Math.max(0, Math.min(L.length - 1, RP.i + d)); if (j === RP.i && !wasAll) { if (SFX.err) SFX.err(); return; }
  RP.dir = d; RP.i = j; SFX.tick(); buzz(6); rpPaint();
}
/* timers: a dock at the bottom of the screen; they keep running on any screen and ring at zero */
function rpDockHTML() {
  if (!RP.timers.length) return "";
  return RP.timers.map((t) => { const left = t.end - Date.now(); return `<div class="rp-tm${left <= 0 ? " over" : left < 30000 ? " soon" : ""}"><span class="rp-tmi">${ico("rpTimer")}</span><span class="rp-tmt"><b class="mono" data-end="${t.end}">${left <= 0 ? "C'est prêt" : rpClock(left)}</b><em>${esc(t.label)}</em></span><button class="iconbtn sm" data-act="rpTimerX" data-id="${esc(t.k)}" aria-label="Arrêter le minuteur">${ico("x")}</button></div>`; }).join("");
}
function rpTick() {
  if (!RP.timers.length) { clearInterval(RP.tk); RP.tk = null; return; }
  const now = Date.now();
  RP.timers.forEach((t) => {
    if (!t.rung && t.end <= now) {
      t.rung = true;
      try { SFX.init(); [0, 0.5, 1].forEach((d) => { SFX.tone(1319, 0.18, "sine", 0.06, d); SFX.tone(1760, 0.24, "sine", 0.05, d + 0.12); }); } catch (e) {}
      buzz([80, 60, 80, 60, 160]); toast(`Minuteur : ${t.label}`, "info");
    }
  });
  $$("[data-end]").forEach((el) => { const l = +el.dataset.end - now; el.textContent = l <= 0 ? "C'est prêt" : rpClock(l); const tm = el.closest(".rp-tm"); if (tm) { tm.classList.toggle("over", l <= 0); tm.classList.toggle("soon", l > 0 && l < 30000); } });
  /* a finished timer leaves by itself after a minute */
  const before = RP.timers.length; RP.timers = RP.timers.filter((t) => now - t.end < 60000);
  if (RP.timers.length !== before) { const d = $("#rpDock"); if (d) d.innerHTML = rpDockHTML(); }
}
Object.assign(ACT, {
  rpOpen: (a, id, v) => { if (!rpNote(id)) { SFX.err && SFX.err(); toast("Ce plat n'a pas encore de fiche recette.", "info"); return; } SFX.sheet ? SFX.sheet() : SFX.tap(); buzz(6); go("recette", { id, q: Math.max(1, +v || 1), ...(a.dataset.t ? { t: a.dataset.t } : {}) }); },
  rpGo: (a, id, v) => rpGo(+v),
  rpTo: (a, id, v) => { const j = +v; RP.dir = j >= RP.i ? 1 : -1; RP.i = j; RP.all = false; SFX.tick(); buzz(5); rpPaint(); },
  rpAll: () => { RP.all = !RP.all; SFX.tap(); rpPaint(); },
  rpQ: (a, id, v) => {
    RP.q = Math.max(1, Math.min(200, RP.q + +v)); SFX.tick(); buzz(4); const n = rpNote(RP.id); if (!n) return;
    const base = num(n.portions) > 0 ? num(n.portions) : 1, u = $("#rpIngs"), q = $("#rpQ"), qu = $("#rpQu"), drink = n.carteCat === "boisson";
    if (u) u.innerHTML = (n.ingredients || []).filter((g) => g.name).map((g) => rpIng(g, RP.q / base)).join("");
    if (q) { q.textContent = RP.q; q.classList.remove("pop"); void q.offsetWidth; q.classList.add("pop"); }
    if (qu) qu.textContent = drink ? (RP.q > 1 ? "verres" : "verre") : RP.q > 1 ? "assiettes" : "assiette";
  },
  rpTimer: (a, id, v) => {
    const n = rpNote(RP.id); if (!n) return; const k = RP.id + ":" + v, cur = RP.timers.find((t) => t.k === k);
    if (cur) { RP.timers = RP.timers.filter((t) => t !== cur); SFX.close(); }
    else { const sec = +a.dataset.n; const st = rpSteps(n)[+v]; RP.timers.push({ k, end: Date.now() + sec * 1000, label: `${n.title} · ${String((st && st.t) || "").slice(0, 48)}` }); SFX.ok(); buzz([10, 30, 10]); toast(`Minuteur lancé : ${rpDurT(sec)}. Il sonne même sur un autre écran.`); }
    if (!RP.tk) RP.tk = setInterval(rpTick, 1000);
    rpPaint(); const d = $("#rpDock"); if (d) d.innerHTML = rpDockHTML();
  },
  rpTimerX: (a, id) => { RP.timers = RP.timers.filter((t) => t.k !== id); SFX.close(); const d = $("#rpDock"); if (d) d.innerHTML = rpDockHTML(); if (S.route === "recette") rpPaint(); },
  rpDone: async () => {
    const L = rpLine(RP.t); SFX.done(); buzz([14, 40, 14]);
    const card = $(".rp-step"); if (card) card.classList.add("fin");
    if (L && !L.x.ok && !L.x.off) { const items = (L.o.items || []).map((x, j) => (j === L.j ? { ...x, ok: true } : x)); try { await safe(DB.update("clientOrders", L.o.id, { items })); } catch (e) {} toast(`${L.x.q} × ${L.x.name} coché sur le bon`); }
    setTimeout(() => goBack(), 380);
  },
});
/* the timers dock follows the cook on every screen (kitchen, bar…) */
const rpChrome0 = renderChrome;
renderChrome = function () {
  rpChrome0.apply(this, arguments);
  try {
    let d = document.getElementById("rpDockG");
    if (!RP.timers.length || S.route === "recette") { if (d) d.remove(); return; }
    if (!d) { d = document.createElement("div"); d.id = "rpDockG"; d.className = "rp-dock g"; document.body.appendChild(d); }
    d.innerHTML = rpDockHTML();
  } catch (e) {}
};
/* the line of a ticket opens its recipe: a small button next to the dish name (the line itself still ticks it) */
function rpBtn(o, x, j) {
  if (!x || x.off || !x.id || !rpNote(x.id)) return "";
  return `<button class="rp-kb" data-act="rpOpen" data-id="${esc(x.id)}" data-v="${+x.q || 1}" data-t="${esc(o.id)}|${j}" aria-label="Recette de ${esc(x.name || "")}" title="Recette pas à pas">${ico("book")}</button>`;
}
