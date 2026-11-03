/* Growth Gusto — area: stock
   Inventaire mensuel (comptage plein écran, reprise), résumé du mois (valeur, écarts, export CSV), catalogue produits.
   Modèle :
   - counts/{YYYY-MM}_{productId} = { month, productId, qty, uid, at } : LE comptage du mois. Écrit uniquement par le mode comptage
     ou par une correction explicite d'un comptage (feuille "Corriger").
   - stockMoves/{id} = { productId, delta, month, at, uid } : ajustements rapides +/− hors inventaire (casse, dépannage…).
     Ils servent au "stock estimé" et n'écrivent JAMAIS dans counts. */

Object.assign(IC, {
  stkUp: ["M12 19V5", "m5 12 7-7 7 7"],
  stkDn: ["M12 5v14", "m19 12-7 7-7-7"],
  stkEq: ["M5 9h14", "M5 15h14"],
  stkPlay: ["f:M7 4v16l13-8z", "M7 4v16l13-8z"],
});

const STK_ZONE_ORDER = ["Chambre froide", "Chambre froide 1", "Chambre froide 2", "Chambre froide 3", "Congélateur", "Cuisine", "Légumerie", "Réserve sèche", "Réserve", "Cave", "Bar"];
const STK_UNITS = ["kg", "g", "L", "pièce", "bouteille", "fût", "botte", "boîte", "colis", "bourriche", "plateau"];
const STK_SS = "gg-stk-cm";

/* ───────── helpers ───────── */
const stkZoneOf = (p) => (p.zone || "").trim() || "Autre";
function stkZoneRank(z) { const i = STK_ZONE_ORDER.findIndex((x) => x.toLowerCase() === z.toLowerCase()); return i < 0 ? 100 : i; }
function stkZones(list = S.products) { return [...new Set(list.map(stkZoneOf))].sort((a, b) => stkZoneRank(a) - stkZoneRank(b) || a.localeCompare(b, "fr")); }
function stkSorted(scope) { const zs = stkZones(); return S.products.filter((p) => !scope || stkZoneOf(p) === scope).slice().sort((a, b) => zs.indexOf(stkZoneOf(a)) - zs.indexOf(stkZoneOf(b)) || a.name.localeCompare(b.name, "fr")); }
const stkN = (n) => (n == null || isNaN(n) ? "–" : String(Math.round(n * 1000) / 1000).replace(".", ","));
const stkSigned = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + stkN(Math.abs(n));
const stkEur = (n, d = 0) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const stkShift = (m, k) => { const [y, mo] = m.split("-").map(Number); return monthKey(new Date(y, mo - 1 + k, 1)); };
const stkMonthName = (m) => MONTHS[+m.split("-")[1] - 1];
const stkNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const stkDefStep = (u) => (u === "kg" || u === "L" ? 0.5 : u === "g" ? 100 : 1);
const stkHasPrice = () => S.products.some((p) => p.price > 0);
function stkLS(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

function countOf(pid, m) { const c = S.counts.find((x) => x.id === `${m}_${pid}`); return c && c.qty != null ? c.qty : null; }
function stkCountMap(m) { const o = {}; S.counts.forEach((c) => { if (c.id && c.id.startsWith(m + "_") && c.qty != null) o[c.id.slice(m.length + 1)] = c.qty; }); return o; }
function stkWriteCount(pid, month, qty) {
  const id = `${month}_${pid}`;
  if (qty == null) return safe(DB.del("counts", id));
  return safe(DB.set("counts", id, { month, productId: pid, qty, uid: S.me.id, at: Date.now() }));
}
function invProgress(m = monthKey()) { const cm = stkCountMap(m); const total = S.products.length; const n = S.products.filter((p) => cm[p.id] != null).length; return { n, total, pct: total ? Math.round((n / total) * 100) : 0 }; }

/* Kept for core's [data-cnt] input listener: an explicit count edit for the current month (month captured at call time). */
const countTimers = {};
function saveCount(pid, raw) {
  const month = monthKey(); clearTimeout(countTimers[pid]);
  countTimers[pid] = setTimeout(() => { stkWriteCount(pid, month, num(raw)).catch(() => {}); }, 500);
}

/* Ajustements (own subscription, guarded per resto) */
S.stockMoves = S.stockMoves || [];
let stkMovesRid = null;
function stkEnsureMoves() {
  if (!S.rid || stkMovesRid === S.rid) return; stkMovesRid = S.rid; S.stockMoves = [];
  DB.watch("stockMoves", { order: "at", dir: "desc", limit: 800 }, (rows) => { S.stockMoves = rows; if (S.route === "stock") refresh(); });
}
const stkLotMatch = (l, p) => (l.productId === p.id || (l.name || "").trim().toLowerCase() === p.name.toLowerCase()) && (!l.unit || l.unit === p.unit);
function stkBuys(p, m) { return S.lots.filter((l) => l.createdAt && monthKey(new Date(l.createdAt)) === m && stkLotMatch(l, p)).reduce((a, l) => a + (num(l.qty) || 0), 0); }
function stkMovesIn(p, m) { return S.stockMoves.filter((x) => x.productId === p.id && x.month === m && x.delta > 0).reduce((a, x) => a + x.delta, 0); }
function stkEstimate(p) {
  const last = S.counts.filter((c) => c.productId === p.id && c.qty != null).sort((a, b) => (b.month > a.month ? 1 : b.month < a.month ? -1 : (b.at || 0) - (a.at || 0)))[0];
  const since = last ? last.at || 0 : 0;
  const recv = S.lots.filter((l) => (l.createdAt || 0) > since && stkLotMatch(l, p)).reduce((a, l) => a + (num(l.qty) || 0), 0);
  const adj = S.stockMoves.filter((x) => x.productId === p.id && (x.at || 0) > since).reduce((a, x) => a + (x.delta || 0), 0) + (S.ui.stkAdj && S.ui.stkAdj.pid === p.id ? S.ui.stkAdj.delta : 0);
  return { last, recv, adj, est: last || recv || adj ? Math.max(0, (last ? last.qty : 0) + recv + adj) : null };
}

/* Month data: per product count, diff, value, consumption */
function stkMonthData(m) {
  const pm = stkShift(m, -1), cm = stkCountMap(m), cp = stkCountMap(pm); let value = 0, prevValue = 0, used = 0, priced = 0, likeCur = 0, likePrev = 0;
  const rows = S.products.map((p) => {
    const c = cm[p.id] ?? null, pc = cp[p.id] ?? null, price = p.price > 0 ? p.price : 0;
    if (price) priced++;
    if (c != null) value += c * price; if (pc != null) prevValue += pc * price; if (c != null && pc != null) { likeCur += c * price; likePrev += pc * price; }
    const d = c != null && pc != null ? Math.round((c - pc) * 1000) / 1000 : null;
    let u = null; if (c != null && pc != null) { const buy = stkBuys(p, m) + stkMovesIn(p, m); u = Math.round((pc + buy - c) * 1000) / 1000; used += Math.max(0, u) * price; }
    return { p, c, pc, d, used: u, val: c != null && price ? c * price : null };
  });
  const top = rows.filter((r) => r.used > 0 && r.p.price > 0).sort((a, b) => b.used * b.p.price - a.used * a.p.price).slice(0, 5);
  return { m, pm, rows, value, prevValue, likeCur, likePrev, used, top, priced, n: rows.filter((r) => r.c != null).length, total: rows.length };
}
function invSummary() { const D = stkMonthData(monthKey()); return { value: D.value, prevValue: D.prevValue, used: D.used, top: D.top.map((r) => ({ name: r.p.name, unit: r.p.unit, cur: r.c, prev: r.pc, used: r.used })) }; }

function stkDiff(d, suffix = "") {
  if (d == null) return "";
  const k = d > 0 ? "up" : d < 0 ? "dn" : "eq";
  return `<span class="stk-d ${k}" title="${d === 0 ? "Identique au mois précédent" : ""}">${ico(k === "up" ? "stkUp" : k === "dn" ? "stkDn" : "stkEq")}${d === 0 ? "" : `<span class="mono">${stkSigned(d)}${suffix}</span>`}</span>`;
}

/* ───────── view ───────── */
VIEWS.stock = {
  render() {
    stkEnsureMoves();
    const tab = S.stockTab === "cat" ? "cat" : "inv";
    const seg = `<div class="seg st" style="--i:1"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "cat" ? "100%" : "0"})"></span><button class="${tab === "inv" ? "on" : ""}" data-act="stockTab" data-v="inv">Inventaire</button><button class="${tab === "cat" ? "on" : ""}" data-act="stockTab" data-v="cat">Catalogue <span class="stk-segn mono">${S.products.length || ""}</span></button></div>`;
    if (!S.products.length) {
      return `<div class="inner narrow">${topBar("Stock", { noBack: true })}${seg}
        <div class="glass stk-empty st" style="--i:2"><div class="stk-empty-art">${ico("box")}</div><b class="h2">Votre inventaire en 3 gestes</b>
          <ol class="stk-steps"><li><span>1</span>Créez votre catalogue : produits, zone, unité, prix d'achat.</li><li><span>2</span>Chaque mois, comptez produit par produit avec le pavé.</li><li><span>3</span>Voyez la consommation, la valeur du stock et exportez.</li></ol>
          <button class="btn acc block" data-act="stkStarter">${ico("sparkle")}Partir de la liste type bistro</button>
          <button class="btn soft block" data-act="prodEdit">${ico("plus")}Ajouter un produit</button></div></div>`;
    }
    return tab === "cat" ? stkCatalogue(seg) : stkInventory(seg);
  },
  after(v) { const on = $(".chips .chip.on", v); if (on && on.previousElementSibling) { const row = on.parentElement; row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2; } },
};

function stkInventory(seg) {
  const cur = monthKey(); let m = S.stkMonth || cur; if (m > cur) m = cur;
  const D = stkMonthData(m), isCur = m === cur, pct = D.total ? Math.round((D.n / D.total) * 100) : 0;
  const zones = stkZones(); if (S.stkZone && !zones.includes(S.stkZone)) S.stkZone = null;
  const ses = isCur ? stkSessLoad() : null; const left = D.total - D.n;
  const byId = {}; D.rows.forEach((r) => { byId[r.p.id] = r; });
  const firstTodo = stkSorted().find((p) => byId[p.id].c == null);
  const resumeP = (ses && S.products.find((p) => p.id === ses.pid)) || firstTodo;
  const hasPrev = S.counts.some((c) => c.month && c.month < m);
  let cta = "";
  if (isCur) {
    if (D.n === 0) cta = `<button class="btn acc block stk-go" data-act="stkStart">${ico("stkPlay")}Commencer l'inventaire</button><span class="sub stk-ctasub">${D.total} produits · environ ${Math.max(1, Math.round(D.total * 0.25))} min</span>`;
    else if (left > 0) cta = `<button class="btn acc block stk-go" data-act="stkResume">${ico("stkPlay")}Reprendre l'inventaire</button><span class="sub stk-ctasub">${resumeP ? `Reprise sur <b>${esc(resumeP.name)}</b> · ` : ""}${left} restant${left > 1 ? "s" : ""}</span>`;
    else cta = `<div class="stk-done">${ico("check")}<span><b>Inventaire terminé</b><em>Tous les produits sont comptés pour ${stkMonthName(m)}.</em></span></div>`;
  }
  const r0 = 34, c0 = 2 * Math.PI * r0;
  const ring = `<svg class="stk-ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="${r0}" class="bg"/><circle cx="40" cy="40" r="${r0}" class="fg" style="stroke-dasharray:${c0};stroke-dashoffset:${c0 * (1 - pct / 100)}"/></svg>`;
  const hero = `<div class="glass pad stk-hero st" style="--i:2">
      <div class="row"><button class="iconbtn" data-act="stkMonth" data-v="-1" aria-label="Mois précédent" ${hasPrev ? "" : "disabled"}>${ico("back")}</button><span class="lbl">Inventaire de ${stkMonthName(m)} ${m.slice(0, 4)}</span><button class="iconbtn" data-act="stkMonth" data-v="1" aria-label="Mois suivant" ${isCur ? "disabled" : ""}>${ico("chev")}</button></div>
      <div class="stk-heroc"><div class="stk-ringw">${ring}<span class="mono">${pct}%</span></div><div><div class="title mono">${D.n}<small> / ${D.total}</small></div><div class="sub">produits comptés</div></div></div>
      ${cta}${!isCur ? `<span class="pill neu" style="align-self:center">Mois passé · touchez un produit pour corriger</span>` : ""}</div>`;
  const valueCard = stkHasPrice() ? (() => {
    const dv = D.likePrev ? ((D.likeCur - D.likePrev) / D.likePrev) * 100 : null;
    return `<div class="glass pad st stk-kpis" style="--i:3"><div><span class="lbl">Valeur du stock</span><div class="h2 mono">${stkEur(D.value)}</div><div class="sub">${dv != null ? `${stkDiff(Math.round(dv), " %")} vs ${stkMonthName(D.pm)}${D.n < D.total ? "*" : ""}` : `${D.priced}/${D.total} produits avec prix`}</div></div>
      <div><span class="lbl">Consommé</span><div class="h2 mono">${D.used ? stkEur(D.used) : "–"}</div><div class="sub">depuis ${stkMonthName(D.pm)}</div></div>${dv != null && D.n < D.total ? `<p class="note stk-kfn">* à périmètre égal : produits comptés les deux mois</p>` : ""}</div>`;
  })() : `<div class="glass pad st stk-tip" style="--i:3"><span class="ic">${ico("trend")}</span><div><b>Voir la valeur du stock</b><p class="note">Ajoutez un prix d'achat à vos produits : la valeur et la consommation en € s'affichent ici.</p><button class="btn soft sm" data-act="stockTab" data-v="cat">Ajouter les prix</button></div></div>`;
  const topCard = D.top.length ? `<div class="glass pad st" style="--i:4"><span class="lbl">Plus grosses consommations</span>${D.top.map((r) => `<div class="li"><div class="tx"><b>${esc(r.p.name)}</b><em>${stkN(r.used)} ${esc(r.p.unit)} utilisés</em></div><span class="mono stk-strong">${stkEur(r.used * r.p.price)}</span></div>`).join("")}<p class="note" style="margin:8px 0 0">Stock de ${stkMonthName(D.pm)} + achats reçus − stock compté.</p></div>` : "";
  const exportCard = `<div class="glass pad st stk-exp" style="--i:5"><div><b>Exporter ${stkMonthName(m)}</b><span class="sub">Fichier CSV pour Excel ou votre comptable</span></div><button class="btn soft sm" data-act="exportInv">${ico("download")}CSV</button></div>`;
  const shown = zones.filter((z) => !S.stkZone || z === S.stkZone);
  const chips = `<div class="chips st" style="--i:3"><button class="chip ${!S.stkZone ? "on" : ""}" data-act="stkZone" data-v="">Toutes <span class="stk-cn">${D.n}/${D.total}</span></button>${zones.map((z) => { const zr = D.rows.filter((r) => stkZoneOf(r.p) === z); const zc = zr.filter((r) => r.c != null).length; return `<button class="chip ${z === S.stkZone ? "on" : ""}" data-act="stkZone" data-v="${esc(z)}">${esc(z)} <span class="stk-cn">${zc === zr.length ? "✓" : `${zc}/${zr.length}`}</span></button>`; }).join("")}</div>`;
  const lists = shown.map((z, zi) => {
    const zr = stkSorted(z).map((p) => byId[p.id]); const zc = zr.filter((r) => r.c != null).length;
    return `<div class="glass pad st" style="--i:${Math.min(zi + 4, 9)}"><div class="row stk-zh"><span class="lbl">${esc(z)} <span class="mono">${zc}/${zr.length}</span></span>${isCur && zc < zr.length ? `<button class="btn ghost sm" data-act="stkStart" data-v="${esc(z)}">Compter</button>` : ""}</div>
      ${zr.map((r) => `<div class="li tap stk-row ${r.c == null ? "todo" : ""}" data-act="stkEdCount" data-id="${r.p.id}" role="button" tabindex="0"><div class="tx"><b>${esc(r.p.name)}</b><em>${r.pc != null ? `${stkMonthName(D.pm)} : ${stkN(r.pc)} ${esc(r.p.unit)}` : "1er comptage"}${r.val != null ? ` · ${stkEur(r.val)}` : ""}</em></div>
        <div class="stk-q">${r.c != null ? `<b class="mono">${stkN(r.c)}<small> ${esc(r.p.unit)}</small></b>${stkDiff(r.d)}` : `<span class="stk-todo">À compter</span>`}</div></div>`).join("")}</div>`;
  }).join("");
  return `<div class="inner">${topBar("Stock", { noBack: true, right: `<button class="btn soft sm" data-act="exportInv" aria-label="Exporter en CSV">${ico("download")}<span class="stk-hide-s">Exporter</span></button>` })}${seg}
    <div class="cols"><div>${hero}<div class="stk-ph">${valueCard}</div>${chips}${lists}</div><div class="stk-side"><div class="stk-dk">${valueCard}</div>${topCard}${exportCard}</div></div></div>`;
}

function stkCatalogue(seg) {
  const q = S.stkQ || ""; const zones = stkZones(); const nq = stkNorm(q);
  const priced = S.products.filter((p) => p.price > 0).length;
  const groups = zones.map((z, zi) => {
    const ps = stkSorted(z); const vis = ps.filter((p) => !nq || stkNorm(`${p.name} ${p.supplier || ""} ${z}`).includes(nq)).length;
    return `<div class="glass pad st stk-grp" style="--i:${Math.min(zi + 3, 9)}" data-zone="${esc(z)}" ${vis ? "" : "hidden"}><div class="row stk-zh"><span class="lbl">${esc(z)} <span class="mono stk-gn">${ps.length}</span></span><button class="btn ghost sm" data-act="prodEdit" data-v="${esc(z)}" aria-label="Ajouter dans ${esc(z)}">${ico("plus")}</button></div>
      ${ps.map((p) => { const hay = stkNorm(`${p.name} ${p.supplier || ""} ${z}`); return `<div class="li tap stk-prow" data-act="prodEdit" data-id="${p.id}" data-q="${esc(hay)}" role="button" tabindex="0" ${nq && !hay.includes(nq) ? "hidden" : ""}><div class="tx"><b>${esc(p.name)}</b><em>${esc(p.unit)}${p.supplier ? ` · ${esc(p.supplier)}` : ""}</em></div>${p.price > 0 ? `<span class="mono stk-price">${stkEur(p.price, 2)}<small>/${esc(p.unit)}</small></span>` : `<span class="stk-noprice">Prix ?</span>`}${ico("chev")}</div>`; }).join("")}</div>`;
  }).join("");
  return `<div class="inner narrow">${topBar("Stock", { noBack: true, right: `<button class="btn acc sm" data-act="prodEdit">${ico("plus")}Produit</button>` })}${seg}
    <div class="stk-search st" style="--i:2">${ico("search")}<input class="input" id="stkQ" data-stkq="1" type="search" placeholder="Rechercher un produit, un fournisseur…" value="${esc(q)}" autocomplete="off" aria-label="Rechercher"></div>
    <div class="row st" style="--i:2;padding:0 4px"><span class="sub">${S.products.length} produits · ${priced} avec prix</span><button class="btn ghost sm" data-act="stkStarter">${ico("sparkle")}Liste type</button></div>
    <div class="stk-groups">${groups}</div><div class="glass empty stk-nores" hidden><b>Aucun produit trouvé</b><button class="btn soft sm" data-act="prodEditQ" style="margin-top:10px">${ico("plus")}Créer « <span id="stkQn"></span> »</button></div></div>`;
}
function stkApplySearch() {
  const inp = $("#stkQ"); if (!inp) return; S.stkQ = inp.value; const nq = stkNorm(inp.value); let any = false;
  $$(".stk-grp").forEach((g) => { let n = 0; $$(".stk-prow", g).forEach((r) => { const ok = !nq || r.dataset.q.includes(nq); r.hidden = !ok; if (ok) n++; }); g.hidden = !n; if (n) any = true; });
  const nr = $(".stk-nores"); if (nr) { nr.hidden = any; $("#stkQn").textContent = inp.value.trim(); }
}
document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.stkq) stkApplySearch(); });

/* ───────── comptage plein écran ───────── */
function stkSessLoad() { const s = stkLS(STK_SS); return s && s.rid === S.rid && s.month === monthKey() ? s : null; }
function stkSessSave() { const C = S.ui.stkCm; if (!C) return; stkLS(STK_SS, { rid: S.rid, month: C.month, scope: C.scope || null, pid: C.list[C.i] || null, buf: C.typed ? C.buf : "", at: Date.now() }); }

function stkKeypad(ctx) {
  return `<div class="keypad stk-kp">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"].map((k) => `<button data-act="stkKey" data-id="${ctx}" data-v="${k}" aria-label="${k === "del" ? "Effacer (appui long : tout effacer)" : k === "," ? "Virgule" : k}" class="${k === "del" ? "del" : k === "," ? "sep" : ""}">${k === "del" ? ico("back") : k}</button>`).join("")}</div>`;
}
function stkValHtml(buf, unit, id) { return `<div class="stk-val ${buf === "" ? "empty" : ""} ${buf.length > 4 ? "long" : ""}" id="${id}"><span class="mono n">${esc(buf || "0")}</span><span class="caret"></span><span class="u">${esc(unit)}</span></div>`; }

function stkCmCard() {
  const C = S.ui.stkCm; const p = S.products.find((x) => x.id === C.list[C.i]); if (!p) return "";
  const pc = countOf(p.id, stkShift(C.month, -1)), cur = countOf(p.id, C.month);
  return `<div class="stk-card" id="stkCard">
    <span class="pill acc stk-zp">${esc(stkZoneOf(p))}</span>
    <div class="stk-pn">${esc(p.name)}</div>
    <div class="stk-pm">${esc(p.unit)}${p.supplier ? ` · ${esc(p.supplier)}` : ""}${cur != null ? ` · <b class="okc">déjà compté</b>` : ""}</div>
    ${stkValHtml(C.buf, p.unit, "stkVal")}
    ${pc != null ? `<button class="stk-hint" data-act="stkSame"><span>Le mois dernier</span><b class="mono">${stkN(pc)} ${esc(p.unit)}</b><em>Même quantité</em></button>` : `<div class="stk-hint none"><span>Premier comptage de ce produit</span></div>`}
  </div>`;
}
function stkCmHead() {
  const C = S.ui.stkCm; const cm = stkCountMap(C.month); const n = C.list.filter((id) => cm[id] != null).length; const p = S.products.find((x) => x.id === C.list[C.i]);
  return `<div class="stk-cm-zone"><b>${esc(C.scope || (p ? stkZoneOf(p) : "Inventaire"))}</b><span class="mono">${Math.min(C.i + 1, C.list.length)} / ${C.list.length}</span></div>
    <div class="prog stk-cm-prog"><i style="width:${C.list.length ? (n / C.list.length) * 100 : 0}%"></i></div>`;
}
function stkCmOpen(scope, pid) {
  const month = monthKey(); const list = stkSorted(scope || null).map((p) => p.id); if (!list.length) return;
  const cm = stkCountMap(month); let i = pid ? list.indexOf(pid) : -1; if (i < 0) i = list.findIndex((id) => cm[id] == null); if (i < 0) i = 0;
  S.ui.stkCm = { month, scope: scope || null, list, i, buf: "", typed: false };
  stkCmLoad(); const ses = stkSessLoad(); if (ses && ses.pid === list[i] && ses.buf) { S.ui.stkCm.buf = ses.buf; S.ui.stkCm.typed = true; }
  let el = $("#stkCm"); if (!el) { el = document.createElement("div"); el.id = "stkCm"; el.className = "stk-cm"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Comptage d'inventaire"); document.body.appendChild(el); stkLongPress(el); }
  el.innerHTML = `<div class="stk-cm-panel">
      <div class="stk-cm-top"><button class="iconbtn" data-act="stkCmClose" aria-label="Fermer le comptage">${ico("x")}</button><div class="stk-cm-head" id="stkHead">${stkCmHead()}</div></div>
      <div class="stk-stage" id="stkStage">${stkCmCard()}</div>
      <div class="stk-ctl" id="stkCtl">${stkKeypad("cm")}
      <div class="stk-nav"><button class="btn soft" data-act="stkPrev" aria-label="Produit précédent">${ico("back")}</button><button class="btn soft" data-act="stkSkip">Passer</button><button class="btn acc" data-act="stkNext">Suivant${ico("chev")}</button></div></div>
    </div>`;
  try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) {}
  document.documentElement.classList.add("stk-lock"); void el.offsetWidth; el.classList.add("on"); SFX.sheet(); stkCmSync(); stkSessSave();
}
function stkCmLoad() { const C = S.ui.stkCm; const cur = countOf(C.list[C.i], C.month); C.buf = cur != null ? stkN(cur) : ""; C.typed = false; }
function stkCmSync() { const C = S.ui.stkCm; const pv = $('#stkCm [data-act="stkPrev"]'); if (pv) pv.disabled = C.i === 0; }
function stkCmClose(silent) {
  const el = $("#stkCm"); if (!el || !el.classList.contains("on")) return; stkSessSave();
  el.classList.remove("on"); document.documentElement.classList.remove("stk-lock"); if (!silent) SFX.close();
  setTimeout(() => { if (!el.classList.contains("on")) el.innerHTML = ""; }, 450); S.ui.stkCm = null; rerender();
}
function stkCmGo(dir) {
  const C = S.ui.stkCm; const st = $("#stkStage"); const old = $("#stkCard");
  C.i = Math.max(0, C.i + dir); if (C.i >= C.list.length) { stkCmFinish(); return; }
  stkCmLoad(); stkSessSave();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tok = (C.tok = (C.tok || 0) + 1);
  const put = () => { if (S.ui.stkCm !== C || C.tok !== tok) return; st.innerHTML = stkCmCard(); $("#stkHead").innerHTML = stkCmHead(); stkCmSync(); const n = $("#stkCard"); if (!reduce && n && n.animate) n.animate([{ transform: `translateX(${dir > 0 ? 46 : -46}%) scale(.96)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 460, easing: "cubic-bezier(.34,1.56,.64,1)" }); };
  if (old && old.isConnected && !reduce && old.animate) { old.style.pointerEvents = "none"; old.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${dir > 0 ? -46 : 46}%) scale(.96)`, opacity: 0 }], { duration: 170, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }); setTimeout(put, 150); } else put();
}
function stkCmFinish() {
  const C = S.ui.stkCm; C.i = C.list.length; const cm = stkCountMap(C.month); const left = C.list.filter((id) => cm[id] == null); const all = invProgress(C.month);
  $("#stkHead").innerHTML = stkCmHead(); $("#stkCtl").innerHTML = "";
  const full = all.n === all.total; const done = C.list.length - left.length;
  $("#stkStage").innerHTML = `<div class="stk-card stk-fin" id="stkCard"><span class="check draw stk-fck"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>
    <div class="stk-pn">${full ? "Inventaire terminé" : left.length ? "Tour terminé" : C.scope ? "Zone terminée" : "Tour terminé"}</div>
    <div class="stk-pm">${C.scope && !full ? `${esc(C.scope)} · ` : ""}${done} compté${done > 1 ? "s" : ""}${left.length ? ` · ${left.length} passé${left.length > 1 ? "s" : ""}` : ""} · ${all.n}/${all.total} au total</div>
    <div class="stk-fbtns">${left.length ? `<button class="btn acc block" data-act="stkRetry">Compter les ${left.length} passé${left.length > 1 ? "s" : ""}</button>` : !full ? `<button class="btn acc block" data-act="stkStart">Continuer l'inventaire</button>` : ""}<button class="btn ${left.length || !full ? "soft" : "acc"} block" data-act="stkCmClose">Voir le résumé</button></div></div>`;
  if (full) { stkLS(STK_SS, null); SFX.done(); burst(window.innerWidth / 2, window.innerHeight / 3); buzz([10, 40, 10]); if (S.ui.stkLogged !== C.month) { S.ui.stkLogged = C.month; logEvent("stock", `a terminé l'inventaire de ${monthLabel(C.month)}`); } }
  else { SFX.ok(); stkSessSave(); }
}
async function stkCmCommit() {
  const C = S.ui.stkCm; const pid = C.list[C.i]; const cur = countOf(pid, C.month);
  if (C.buf === "") return cur != null;
  const v = num(C.buf); if (v == null) return false;
  if (v !== cur) { try { await stkWriteCount(pid, C.month, v); } catch (e) { return false; } }
  return true;
}
function stkShake(el) { if (el && el.animate) el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "none" }], { duration: 360, easing: "ease-out" }); }
function stkKey(ctx, k) {
  const C = ctx === "cm" ? S.ui.stkCm : S.ui.stkEd; if (!C) return;
  let b = C.typed ? C.buf : "";
  if (k === "del") b = C.typed ? b.slice(0, -1) : "";
  else if (k === "clr") b = "";
  else if (k === ",") { if (!b.includes(",")) b = (b || "0") + ","; }
  else { const dec = b.split(",")[1]; if (b.replace(",", "").length >= 6 || (dec && dec.length >= 3)) { stkShake($(ctx === "cm" ? "#stkVal" : "#stkEdVal")); SFX.err(); return; } b = b === "0" ? k : b + k; }
  C.buf = b; C.typed = true; SFX.tick(); buzz(3);
  const d = $(ctx === "cm" ? "#stkVal" : "#stkEdVal"); if (d) { $(".n", d).textContent = b || "0"; d.classList.toggle("empty", b === ""); d.classList.toggle("long", b.length > 4); d.classList.remove("bump"); void d.offsetWidth; d.classList.add("bump"); }
  if (ctx === "cm") stkSessSave();
}
function stkLongPress(el) {
  let t = null;
  el.addEventListener("pointerdown", (e) => { const b = e.target.closest(".stk-kp .del"); if (!b) return; clearTimeout(t); t = setTimeout(() => { stkKey(b.dataset.id, "clr"); buzz(14); }, 520); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => el.addEventListener(ev, () => clearTimeout(t)));
}
document.addEventListener("keydown", (e) => {
  const cmOn = $("#stkCm.on"); const edOn = !cmOn && S.ui.stkEd && $("#sheet").classList.contains("open") && $("#stkEdVal");
  if (!cmOn && !edOn) return; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !(cmOn && !cmOn.contains(e.target))) return; if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ctx = cmOn ? "cm" : "ed"; const k = e.key;
  if (/^[0-9]$/.test(k)) { e.preventDefault(); stkKey(ctx, k); }
  else if (k === "," || k === ".") { e.preventDefault(); stkKey(ctx, ","); }
  else if (k === "Backspace") { e.preventDefault(); stkKey(ctx, "del"); }
  else if (k === "Enter") { e.preventDefault(); if (cmOn) { if (S.ui.stkCm && S.ui.stkCm.i < S.ui.stkCm.list.length) ACT.stkNext(); } else ACT.stkEdSave(); }
  else if (cmOn && k === "ArrowRight") { e.preventDefault(); ACT.stkSkip(); }
  else if (cmOn && k === "ArrowLeft") { e.preventDefault(); ACT.stkPrev(); }
  else if (cmOn && k === "Escape") { e.preventDefault(); ACT.stkCmClose(); }
});

/* ───────── correction d'un comptage (feuille) ───────── */
function stkEdOpen(pid) {
  const p = S.products.find((x) => x.id === pid); if (!p) return; const m = S.stkMonth && S.stkMonth < monthKey() ? S.stkMonth : monthKey();
  const cur = countOf(pid, m), pc = countOf(pid, stkShift(m, -1));
  S.ui.stkEd = { pid, month: m, buf: cur != null ? stkN(cur) : "", typed: false };
  openSheet(`<div class="row"><div style="min-width:0"><span class="lbl">${esc(stkZoneOf(p))} · ${stkMonthName(m)}</span><div class="h2 stk-ellip" style="font-size:21px;margin-top:2px">${esc(p.name)}</div></div><button class="iconbtn" data-act="prodEdit" data-id="${p.id}" aria-label="Modifier le produit">${ico("edit")}</button></div>
    ${stkValHtml(S.ui.stkEd.buf, p.unit, "stkEdVal")}
    <div class="sub" style="text-align:center;margin-top:-8px">${pc != null ? `${stkMonthName(stkShift(m, -1))} : <b class="mono">${stkN(pc)} ${esc(p.unit)}</b>` : "Premier comptage de ce produit"}</div>
    ${stkKeypad("ed")}
    <div class="grid2" style="grid-template-columns:${cur != null ? "1fr 2fr" : "1fr"}">${cur != null ? `<button class="btn danger" data-act="stkEdClear">Effacer</button>` : ""}<button class="btn acc" data-act="stkEdSave">Enregistrer</button></div>`);
  const sb = $("#sheetBody"); if (!sb.dataset.stkLp) { sb.dataset.stkLp = 1; stkLongPress(sb); }
}

/* ───────── fiche produit ───────── */
function stkProdSheet(p, isNew, presetZone) {
  const zones = [...new Set([...stkZones(), "Chambre froide", "Congélateur", "Réserve sèche", "Cave", "Bar"])].sort((a, b) => stkZoneRank(a) - stkZoneRank(b) || a.localeCompare(b, "fr"));
  const units = [...new Set([...STK_UNITS, ...UNITS, ...S.products.map((x) => x.unit).filter(Boolean)])];
  const sups = [...new Set([...S.products.map((x) => x.supplier), ...S.receptions.map((r) => r.supplier), ...S.lots.map((l) => l.supplier)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const zone = p.zone || presetZone || S.stkZone || zones[0]; const unit = p.unit || "kg";
  const E = !isNew ? stkEstimate(p) : null;
  return `<div class="row"><div class="h2" style="font-size:21px">${isNew ? "Nouveau produit" : "Modifier le produit"}</div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="field"><span>Nom</span><input class="input" id="pName" value="${esc(p.name || "")}" placeholder="Ex. Beurre doux AOP" autocomplete="off" enterkeyhint="done"></label>
    <div class="field"><span>Zone</span><div class="chips stk-pick" data-k="zone">${zones.map((z) => `<button class="chip ${z === zone ? "on" : ""}" data-act="stkPick" data-v="${esc(z)}">${esc(z)}</button>`).join("")}<button class="chip stk-newz" data-act="stkNewZone">${ico("plus")}Autre</button></div><input class="input" id="pZone" value="${esc(zone)}" placeholder="Nom de la zone" hidden></div>
    <div class="field"><span>Unité de comptage</span><div class="chips stk-pick" data-k="unit">${units.map((u) => `<button class="chip ${u === unit ? "on" : ""}" data-act="stkPick" data-v="${esc(u)}">${esc(u)}</button>`).join("")}</div><input type="hidden" id="pUnit" value="${esc(unit)}"></div>
    <div class="grid2"><label class="field"><span>Prix d'achat <em class="stk-opt">€ / <span id="pUnitL">${esc(unit)}</span></em></span><input class="input mono" id="pPrice" inputmode="decimal" value="${p.price > 0 ? fmt(p.price, 2) : ""}" placeholder="Facultatif" autocomplete="off"></label>
      <label class="field"><span>Fournisseur</span><input class="input" id="pSup" list="stkSupList" value="${esc(p.supplier || "")}" placeholder="Facultatif" autocomplete="off"><datalist id="stkSupList">${sups.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label></div>
    ${E ? `<div class="stk-adj"><div style="min-width:0"><span class="lbl">Stock estimé</span><div class="stk-adjv"><b class="mono" id="stkEst">${E.est != null ? stkN(E.est) : "–"}</b> <span>${esc(p.unit)}</span></div><em class="note">${E.last ? `Compté ${stkN(E.last.qty)} en ${stkMonthName(E.last.month)}` : "Jamais compté"}${E.recv ? ` · +${stkN(E.recv)} reçus` : ""}<span id="stkAdjL">${E.adj ? ` · ${stkSigned(E.adj)} ajusté` : ""}</span></em></div>
      <div class="cnt"><button data-act="stkAdj" data-id="${p.id}" data-v="-1" aria-label="Retirer">${ico("minus")}</button><button data-act="stkAdj" data-id="${p.id}" data-v="1" aria-label="Ajouter">${ico("plus")}</button></div></div>
      <p class="note stk-adjn">Ajustement rapide (casse, dépannage) : l'inventaire du mois n'est pas modifié.</p>` : ""}
    ${isNew ? `<div class="grid2" style="grid-template-columns:1fr 1.3fr"><button class="btn soft" data-act="prodSave" data-v="more">Ajouter + autre</button><button class="btn acc" data-act="prodSave">Ajouter</button></div>`
    : `<button class="btn acc block" data-act="prodSave" data-id="${p.id}">Enregistrer</button><button class="btn ghost block stk-del" data-act="prodDel" data-id="${p.id}">${ico("trash")}Supprimer le produit</button>`}`;
}
function stkProdOpen(id, presetZone, presetName) {
  const p = S.products.find((x) => x.id === id); stkAdjFlush(); S.ui.stkEd = null;
  openSheet(stkProdSheet(p || { name: presetName || "" }, !p, presetZone), (b) => { if (!p) setTimeout(() => { const i = $("#pName", b); i && i.focus(); }, 380); });
}
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && ["pName", "pPrice", "pSup", "pZone"].includes(e.target.id) && $("#sheet").classList.contains("open")) { e.preventDefault(); const b = $('#sheetBody [data-act="prodSave"]:not([data-v])'); b && b.click(); } });
function stkAdjFlush() {
  const A = S.ui.stkAdj; if (!A) return; clearTimeout(A.t); S.ui.stkAdj = null; if (!A.delta) return;
  DB.add("stockMoves", { productId: A.pid, delta: Math.round(A.delta * 1000) / 1000, month: monthKey(), at: Date.now(), uid: S.me.id }).then((id) => { S.ui.undo = { col: "stockMoves", id }; const p = S.products.find((x) => x.id === A.pid); toastUndo(`${p ? p.name : "Stock"} : ${stkSigned(A.delta)} ${p ? p.unit : ""}`); }).catch(() => SFX.err());
}

/* ───────── liste type bistro ───────── */
const STK_STARTER = [
  ["Chambre froide", [["Beurre doux AOP", "kg"], ["Crème liquide 35 %", "L"], ["Lait entier", "L"], ["Œufs plein air", "pièce"], ["Comté 18 mois", "kg"], ["Chèvre frais", "kg"], ["Bavette de bœuf", "kg"], ["Entrecôte", "kg"], ["Magret de canard", "kg"], ["Poulet fermier", "pièce"], ["Lardons fumés", "kg"], ["Jambon blanc", "kg"], ["Saumon frais", "kg"], ["Cabillaud", "kg"], ["Salade (laitue)", "pièce"], ["Tomates", "kg"], ["Citrons", "kg"], ["Herbes fraîches", "botte"]]],
  ["Congélateur", [["Frites surgelées", "kg"], ["Pâte feuilletée", "kg"], ["Escargots de Bourgogne", "boîte"], ["Glace vanille", "L"], ["Fruits rouges", "kg"]]],
  ["Réserve sèche", [["Farine T55", "kg"], ["Sucre semoule", "kg"], ["Sel fin", "kg"], ["Fleur de sel", "kg"], ["Poivre noir en grains", "kg"], ["Huile d'olive", "L"], ["Huile de tournesol", "L"], ["Vinaigre de vin", "L"], ["Moutarde de Dijon", "kg"], ["Pommes de terre", "kg"], ["Oignons", "kg"], ["Échalotes", "kg"], ["Ail", "kg"], ["Riz", "kg"], ["Lentilles vertes", "kg"], ["Chocolat noir 70 %", "kg"], ["Café en grains", "kg"], ["Fond de veau", "kg"]]],
  ["Cave", [["Côtes-du-Rhône rouge", "bouteille"], ["Bordeaux rouge", "bouteille"], ["Chablis blanc", "bouteille"], ["Rosé de Provence", "bouteille"], ["Champagne brut", "bouteille"], ["Bière pression", "fût"], ["Cidre brut", "bouteille"]]],
  ["Bar", [["Eau plate 1 L", "bouteille"], ["Eau gazeuse 1 L", "bouteille"], ["Cola 33 cl", "bouteille"], ["Jus d'orange", "L"], ["Sirop de menthe", "bouteille"], ["Pastis", "bouteille"], ["Thé et infusions", "boîte"]]],
];
function stkStarterCount() { const have = new Set(S.products.map((p) => p.name.toLowerCase())); return STK_STARTER.reduce((a, [, L]) => a + L.filter(([nm]) => !have.has(nm.toLowerCase()) && !S.ui.stkSt[nm]).length, 0); }
function stkStarterSheet() {
  const have = new Set(S.products.map((p) => p.name.toLowerCase())); const n = stkStarterCount();
  return `<div class="row"><div><div class="h2" style="font-size:21px">Liste type bistro</div><span class="sub">Décochez ce que vous n'avez pas. Ajoutez vos prix ensuite.</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="stk-stl">${STK_STARTER.map(([z, L]) => `<div><span class="lbl">${esc(z)}</span><div class="stk-stg">${L.map(([nm, u]) => { const h = have.has(nm.toLowerCase()); const off = h || S.ui.stkSt[nm]; return `<button class="stk-st ${off ? "" : "on"} ${h ? "have" : ""}" data-act="stkStToggle" data-v="${esc(nm)}" ${h ? "disabled" : ""} aria-pressed="${!off}"><i>${ico("check")}</i><span>${esc(nm)}</span><em>${h ? "déjà là" : esc(u)}</em></button>`; }).join("")}</div></div>`).join("")}</div>
    <div class="ctabar stk-stcta"><button class="btn acc block" data-act="stkStAdd" ${n ? "" : "disabled"}>Ajouter ${n} produit${n > 1 ? "s" : ""}</button></div>`;
}

/* ───────── export ───────── */
async function stkDownload(name, rows) {
  if (S.cap.downloads) return saveCsv(name, rows);
  const csv = "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\n");
  try { const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); SFX.ok(); toast("Fichier téléchargé"); } catch (e) { toast("Export impossible.", "err"); }
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  stockTab: (a, id, v) => { S.stockTab = v; SFX.tick(); rerender(); const vw = $("#viewport .view:not(.leave)"); if (vw) vw.scrollTop = 0; },
  stkZone: (a, id, v) => { S.stkZone = v || null; SFX.tick(); rerender(); },
  zone: (a, id, v) => { S.stkZone = v || null; rerender(); },
  stkMonth: (a, id, v) => { const cur = monthKey(); let m = stkShift(S.stkMonth || cur, +v); if (m > cur) m = cur; S.stkMonth = m === cur ? null : m; SFX.tick(); rerender(); },
  stkStart: (a, id, v) => { SFX.tap(); stkCmOpen(v || null); },
  stkResume: () => { const s = stkSessLoad(); SFX.tap(); stkCmOpen(s ? s.scope : null, s ? s.pid : null); },
  countMode: () => ACT.stkResume(),
  stkCmClose: () => { const C = S.ui.stkCm; const done = C && C.i >= C.list.length; stkCmClose(); if (C && !done && invProgress().n < S.products.length) toast("Comptage en pause"); },
  stkKey: (a, id, v) => stkKey(id, v),
  stkSame: () => { const C = S.ui.stkCm; const pc = countOf(C.list[C.i], stkShift(C.month, -1)); if (pc == null) return; C.buf = stkN(pc); C.typed = true; const d = $("#stkVal"); $(".n", d).textContent = C.buf; d.classList.remove("empty", "bump"); void d.offsetWidth; d.classList.add("bump"); SFX.tap(); buzz(5); stkSessSave(); },
  stkNext: async () => {
    const C = S.ui.stkCm; if (!C || C.busy || C.i >= C.list.length) return; C.busy = true;
    const ok = await stkCmCommit(); C.busy = false;
    if (!ok) { stkShake($("#stkVal")); SFX.err(); buzz([8, 30, 8]); return; }
    SFX.ok(); buzz(6); stkCmGo(1);
  },
  stkSkip: () => { const C = S.ui.stkCm; if (!C || C.i >= C.list.length) return; SFX.tap(); stkCmGo(1); },
  stkPrev: () => { const C = S.ui.stkCm; if (!C || C.i === 0) return; SFX.tap(); stkCmGo(-1); },
  stkRetry: () => { const C = S.ui.stkCm; const cm = stkCountMap(C.month); const first = C.list.find((id) => cm[id] == null); stkCmOpen(C.scope, first); },
  stkEdCount: (a, id) => { SFX.tap(); stkEdOpen(id); },
  stkEdSave: async () => {
    const E = S.ui.stkEd; if (!E) return; const v = E.buf === "" ? null : num(E.buf);
    if (v == null) { if (countOf(E.pid, E.month) == null) { stkShake($("#stkEdVal")); SFX.err(); } else { closeSheet(); S.ui.stkEd = null; } return; }
    try { await stkWriteCount(E.pid, E.month, v); } catch (e) { return; }
    closeSheet(true); S.ui.stkEd = null; SFX.ok(); toast("Comptage enregistré");
  },
  stkEdClear: async () => { const E = S.ui.stkEd; if (!E) return; try { await stkWriteCount(E.pid, E.month, null); } catch (e) { return; } closeSheet(true); S.ui.stkEd = null; SFX.close(); toast("Comptage effacé"); },
  prodEdit: (a, id, v) => { SFX.tap(); stkProdOpen(id, v); },
  prodEditQ: () => stkProdOpen(null, null, (S.stkQ || "").trim()),
  stkPick: (a, id, v) => { const wrap = a.closest(".stk-pick"); $$(".chip", wrap).forEach((c) => c.classList.toggle("on", c === a)); if (wrap.dataset.k === "zone") { const z = $("#pZone"); z.value = v; z.hidden = true; } else { $("#pUnit").value = v; $("#pUnitL").textContent = v; } SFX.tick(); },
  stkNewZone: (a) => { const wrap = a.closest(".stk-pick"); $$(".chip", wrap).forEach((c) => c.classList.toggle("on", c === a)); const z = $("#pZone"); z.hidden = false; z.value = ""; z.focus(); SFX.tick(); },
  prodSave: async (a, id, v) => {
    const name = $("#pName").value.trim(); if (!name) { stkShake($("#pName")); $("#pName").focus(); SFX.err(); return; }
    const unit = $("#pUnit").value || "kg"; const old = S.products.find((x) => x.id === id);
    const pr = num($("#pPrice").value);
    const d = { name, unit, zone: $("#pZone").value.trim() || "Autre", price: pr != null && pr > 0 ? pr : null, supplier: $("#pSup").value.trim(), step: old && old.unit === unit && old.step ? old.step : stkDefStep(unit) };
    if (S.products.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) { toast("Ce produit existe déjà", "err"); stkShake($("#pName")); return; }
    try { if (id) await safe(DB.update("products", id, d)); else await safe(DB.add("products", { ...d, createdAt: Date.now() })); } catch (e) { return; }
    SFX.ok(); buzz(5);
    if (v === "more") { toast(`${name} ajouté`); $("#sheetBody").innerHTML = stkProdSheet({ name: "", zone: d.zone, unit: d.unit, supplier: d.supplier }, true); setTimeout(() => $("#pName").focus(), 30); return; }
    stkAdjFlush(); closeSheet(true); toast(id ? "Produit mis à jour" : `${name} ajouté`);
  },
  prodDel: (a, id) => { const p = S.products.find((x) => x.id === id); openSheet(`<div class="h2" style="font-size:20px">Supprimer « ${esc(p ? p.name : "")} » ?</div><p class="sub" style="margin:0">Il disparaît du catalogue. Les comptages passés restent dans l'historique.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="prodDelOk" data-id="${id}">Supprimer</button></div>`); },
  prodDelOk: async (a, id) => { try { await safe(DB.del("products", id)); } catch (e) { return; } closeSheet(true); SFX.close(); toast("Produit supprimé"); },
  stkAdj: (a, id, v) => {
    const p = S.products.find((x) => x.id === id); if (!p) return; if (S.ui.stkAdj && S.ui.stkAdj.pid !== id) stkAdjFlush();
    const E0 = stkEstimate(p); const step = p.step || stkDefStep(p.unit); if (+v < 0 && (E0.est || 0) <= 0) { SFX.err(); stkShake($("#stkEst")); return; }
    const A = S.ui.stkAdj = S.ui.stkAdj || { pid: id, delta: 0 }; clearTimeout(A.t);
    A.delta = Math.round((A.delta + (+v) * step) * 1000) / 1000; A.t = setTimeout(stkAdjFlush, 1200);
    const E = stkEstimate(p); const el = $("#stkEst"); if (el) { el.textContent = E.est != null ? stkN(E.est) : "–"; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    const l = $("#stkAdjL"); if (l) l.textContent = E.adj ? ` · ${stkSigned(E.adj)} ajusté` : ""; SFX.tick(); buzz(4);
  },
  stkStarter: () => { SFX.tap(); S.ui.stkSt = {}; openSheet(stkStarterSheet()); },
  prodStarter: () => ACT.stkStarter(),
  stkStToggle: (a, id, v) => { S.ui.stkSt[v] = !S.ui.stkSt[v]; a.classList.toggle("on", !S.ui.stkSt[v]); a.setAttribute("aria-pressed", String(!S.ui.stkSt[v])); SFX.tick(); const n = stkStarterCount(); const b = $('[data-act="stkStAdd"]'); b.textContent = `Ajouter ${n} produit${n > 1 ? "s" : ""}`; b.disabled = !n; },
  stkStAdd: async (a) => {
    if (a.disabled) return; a.disabled = true; const have = new Set(S.products.map((p) => p.name.toLowerCase())); let n = 0; const now = Date.now();
    try { for (const [zone, L] of STK_STARTER) for (const [name, unit] of L) { if (have.has(name.toLowerCase()) || S.ui.stkSt[name]) continue; await DB.add("products", { name, unit, zone, step: stkDefStep(unit), price: null, supplier: "", createdAt: now + n }); n++; } } catch (e) { SFX.err(); toast("Impossible d'ajouter la liste.", "err"); a.disabled = false; return; }
    closeSheet(true); SFX.done(); burst(); toast(`${n} produits ajoutés`); setTimeout(rerender, 80);
  },
  exportInv: async () => {
    const m = S.stkMonth || monthKey(); const D = stkMonthData(m); const byId = {}; D.rows.forEach((r) => { byId[r.p.id] = r; });
    const head = ["Zone", "Produit", "Unité", "Fournisseur", "Prix d'achat (€)", `Stock ${monthLabel(D.pm)}`, `Stock ${monthLabel(m)}`, "Écart", "Consommé", "Valeur (€)"];
    const rows = [head].concat(stkSorted().map((p) => { const r = byId[p.id]; return [stkZoneOf(p), p.name, p.unit, p.supplier || "", p.price > 0 ? stkN(Math.round(p.price * 100) / 100) : "", r.pc != null ? stkN(r.pc) : "", r.c != null ? stkN(r.c) : "", r.d != null ? stkN(r.d) : "", r.used != null ? stkN(r.used) : "", r.val != null ? stkN(Math.round(r.val * 100) / 100) : ""]; }));
    rows.push([], ["Total", `${D.n}/${D.total} comptés`, "", "", "", "", "", "", D.used ? stkN(Math.round(D.used * 100) / 100) : "", stkN(Math.round(D.value * 100) / 100)]);
    await stkDownload(`inventaire-${m}.csv`, rows);
  },
});
