/* Growth Gusto — area: stock
   Inventaire mensuel (comptage plein écran, reprise), résumé du mois (valeur, écarts, export CSV), catalogue produits.
   Modèle :
   - counts/{YYYY-MM}_{productId} = { month, productId, qty, uid, at } : LE comptage du mois. Écrit uniquement par le mode comptage
     ou par une correction explicite d'un comptage (feuille "Corriger").
   - stockMoves/{id} = { productId, delta, month, at, uid } : ajustements rapides +/− hors inventaire (casse, dépannage…).
     Ils servent au "stock estimé" et n'écrivent JAMAIS dans counts. (Ancien format : lu, plus écrit.)
   - V3 : moves/{id} (contrat partagé, S.moves) : recettes, ventes du Z, pertes, corrections, réceptions, transferts.
     stockLevel(pid) = dernier comptage + lots reçus depuis + moves depuis (hors "transfert"). stockMove(doc) écrit un move.
   - products : + allergens:[ids ALLERGENS], alChecked, fam (étagère HACCP, sinon devinée), minQty (seuil "À commander"). */

Object.assign(IC, {
  stkUp: ["M12 19V5", "m5 12 7-7 7 7"],
  stkDn: ["M12 5v14", "m19 12-7 7-7-7"],
  stkEq: ["M5 9h14", "M5 15h14"],
  stkPlay: ["f:M7 4v16l13-8z", "M7 4v16l13-8z"],
});

const STK_ZONE_ORDER = ["Chambre froide", "Chambre froide 1", "Chambre froide 2", "Chambre froide 3", "Congélateur", "Cuisine", "Légumerie", "Réserve sèche", "Réserve", "Cave", "Bar"];
const STK_UNITS = ["kg", "g", "L", "PCE", "DZ", "bouteille", "fût", "botte", "boîte", "colis", "bourriche", "plateau"];
const STK_SS = "gg-stk-cm";

/* ───────── helpers ───────── */
const stkZoneOf = (p) => (p.zone || "").trim() || "Autre";
function stkZoneRank(z) {
  const i = STK_ZONE_ORDER.findIndex((x) => x.toLowerCase() === z.toLowerCase()); if (i >= 0) return i;
  const fi = S.fridges.findIndex((f) => (f.name || "").trim().toLowerCase() === z.toLowerCase()); if (fi < 0) return 100;
  const k = stkFridgeKind(S.fridges[fi]); return (k === "congel" ? 4 : k === "cave" ? 9 : 0) + 0.2 + fi / 100;
}
/* fridges ↔ catalogue zones: a catalogue zone is the real equipment name when there is one */
function stkFridgeKind(f) { if (!f) return ""; if (typeof relTypeOf === "function") { try { return relTypeOf(f).k; } catch (e) {} } const n = (f.name || "").toLowerCase(); return /cong[eé]l|surg|n[eé]gativ/.test(n) || f.max <= -10 ? "congel" : /cave|vin|boisson/.test(n) ? "cave" : "frigo"; }
function stkFridgeFor(kind) { const L = S.fridges.filter((f) => (kind === "congel" ? stkFridgeKind(f) === "congel" : ["cfp", "frigo"].includes(stkFridgeKind(f)))); return L.find((f) => stkFridgeKind(f) === "cfp") || L[0] || null; }
/* generic catalogue zone → the restaurant's own equipment, when it has one of that kind */
function stkRealZone(z) { const f = z === "Chambre froide" ? stkFridgeFor("cold") : z === "Congélateur" ? stkFridgeFor("congel") : null; return f ? f.name.trim() : z; }
/* zone guessed for a received product: the fridge it was stored in, else from the product type */
function stkZoneGuess(src) {
  const f = src.fridgeId && S.fridges.find((x) => x.id === src.fridgeId); if (f && (f.name || "").trim()) return f.name.trim();
  if (src.type === "sec") return "Réserve sèche";
  if (src.type === "surg") return stkRealZone("Congélateur");
  return stkRealZone("Chambre froide");
}
function stkZones(list = S.products) { return [...new Set(list.map(stkZoneOf))].sort((a, b) => stkZoneRank(a) - stkZoneRank(b) || a.localeCompare(b, "fr")); }
function stkSorted(scope) { const zs = stkZones(); return S.products.filter((p) => !scope || stkZoneOf(p) === scope).slice().sort((a, b) => zs.indexOf(stkZoneOf(a)) - zs.indexOf(stkZoneOf(b)) || stkHasAl(a) - stkHasAl(b) || a.name.localeCompare(b.name, "fr")); }
const stkN = (n) => (n == null || isNaN(n) ? "–" : String(Math.round(n * 1000) / 1000).replace(".", ","));
const stkSigned = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + stkN(Math.abs(n));
const stkEur = (n, d = 0) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const stkShift = (m, k) => { const [y, mo] = m.split("-").map(Number); return monthKey(new Date(y, mo - 1 + k, 1)); };
const stkMonthName = (m) => MONTHS[+m.split("-")[1] - 1];
const stkNorm = (s) => String(s || "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ").replace(/\s+/g, " ");
const STK_PLU = { "pièce": "pièces", bouteille: "bouteilles", "fût": "fûts", botte: "bottes", "boîte": "boîtes", bourriche: "bourriches", plateau: "plateaux", barquette: "barquettes", sac: "sacs", carton: "cartons", seau: "seaux", pot: "pots", paquet: "paquets", "bocal": "bocaux", "unité": "unités", portion: "portions", "tranche": "tranches", "sachet": "sachets", "bidon": "bidons", "caisse": "caisses" };
const stkU = (n, u) => (n != null && Math.abs(n) >= 2 && STK_PLU[u] ? STK_PLU[u] : u || "");
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
function stkMovesIn(p, m) {
  const X = stkIndex(); const v3 = [...(X.mv["i:" + p.id] || [])].filter((x) => x.qty > 0 && x.at && monthKey(new Date(x.at)) === m).reduce((a, x) => a + x.qty, 0);
  return v3 + S.stockMoves.filter((x) => x.productId === p.id && x.month === m && x.delta > 0).reduce((a, x) => a + x.delta, 0);
}
function stkEstimate(p) {
  const L = stkLevelAt(p); const pend = S.ui.stkAdj && S.ui.stkAdj.pid === p.id ? S.ui.stkAdj.delta : 0;
  return { last: L.last, recv: L.recv, adj: Math.round((L.mv + pend) * 1000) / 1000, est: L.level != null || pend ? Math.round(((L.level || 0) + pend) * 1000) / 1000 : null };
}

/* ───────── stock théorique (V3) ───────── */
const stkR3 = (n) => Math.round((n || 0) * 1000) / 1000;
const stkKeyN = (s) => stkNorm(s).replace(/\s*\(test\)\s*$/, "").trim();
let stkIx = null;
/* moves and lots indexed per product (by id and by name), rebuilt only when a collection changes */
function stkIndex() {
  if (stkIx && stkIx.m === S.moves && stkIx.l === S.lots && stkIx.s === S.stockMoves && stkIx.c === S.counts) return stkIx;
  const mv = {}, lo = {}, cn = {}, put = (o, k, x) => { (o[k] ||= []).push(x); };
  const lotIds = new Set(S.lots.map((l) => l.id));
  (S.moves || []).forEach((m) => { if (m.kind === "transfert" || (m.kind === "reception" && m.lotId && lotIds.has(m.lotId))) return; put(mv, m.productId ? "i:" + m.productId : "n:" + stkKeyN(m.name), m); });
  S.lots.forEach((l) => { if (l.test) return; if (l.productId) put(lo, "i:" + l.productId, l); put(lo, "n:" + stkKeyN(l.name), l); });
  S.counts.forEach((c) => { if (c.productId && c.qty != null) put(cn, c.productId, c); });
  Object.values(cn).forEach((L) => L.sort((a, b) => (b.month > a.month ? 1 : b.month < a.month ? -1 : (b.at || 0) - (a.at || 0))));
  return (stkIx = { m: S.moves, l: S.lots, s: S.stockMoves, c: S.counts, mv, lo, cn });
}
/* level just before time t (Infinity = now): last count before t + lots received + moves since that count */
function stkLevelAt(p, t = Infinity) {
  const X = stkIndex(); const last = (X.cn[p.id] || []).find((c) => (c.at || 0) < t) || null; const since = last ? last.at || 0 : 0;
  const inW = (a) => a > since && a < t;
  const lots = [...new Set([...(X.lo["i:" + p.id] || []), ...(X.lo["n:" + stkKeyN(p.name)] || [])])].filter((l) => inW(l.createdAt || 0) && stkLotMatch(l, p));
  const recv = lots.reduce((a, l) => a + (num(l.qty) || 0), 0);
  const ms = [...(X.mv["i:" + p.id] || []), ...(X.mv["n:" + stkKeyN(p.name)] || []).filter((m) => !m.productId)];
  const mv = ms.filter((m) => inW(m.at || 0)).reduce((a, m) => a + (+m.qty || 0), 0) + S.stockMoves.filter((x) => x.productId === p.id && inW(x.at || 0)).reduce((a, x) => a + (x.delta || 0), 0);
  const any = last || lots.length || ms.some((m) => inW(m.at || 0)) || mv;
  return { last, recv: stkR3(recv), mv: stkR3(mv), level: any ? stkR3((last ? last.qty : 0) + recv + mv) : null };
}
/* Cross-area helper (BRIEF V3): theoretical quantity in the product's unit, or null when nothing is known yet. */
function stockLevel(productId) { stkEnsureMoves(); const p = S.products.find((x) => x.id === productId); return p ? stkLevelAt(p).level : null; }
/* Cross-area helper: products under their "À commander" threshold. */
function stockLow() { return S.products.filter((p) => p.minQty > 0).map((p) => ({ p, level: stkLevelAt(p).level })).filter((x) => x.level != null && x.level <= x.p.minQty).map((x) => ({ id: x.p.id, name: x.p.name, unit: x.p.unit, level: x.level, min: x.p.minQty, supplier: x.p.supplier || "" })); }

const STK_KIND = {
  recette: { t: "Recette", tp: "Recettes", ic: "book", c: "acc" },
  vente: { t: "Vente", tp: "Ventes", ic: "receipt", c: "ok" },
  perte: { t: "Perte", tp: "Pertes", ic: "trash", c: "bad" },
  correction: { t: "Correction", tp: "Corrections", ic: "sliders", c: "neu" },
  reception: { t: "Entrée", tp: "Entrées", ic: "truck", c: "ok" },
  transfert: { t: "Transfert", tp: "Transferts", ic: "move", c: "neu" },
};
const STK_EV = {};
function stkMoveText(m) {
  const q = `${stkN(Math.abs(m.qty))} ${stkU(Math.abs(m.qty), m.unit)}`.trim(), n = m.name || "un produit", lb = m.label || m.refName || "";
  if (m.kind === "recette") return `a utilisé ${q} de ${n}${lb ? ` (recette ${lb})` : ""}`;
  if (m.kind === "vente") return `a enregistré une vente : ${q} de ${n}${lb ? ` (${lb})` : ""}`;
  if (m.kind === "perte") return `a déclaré une perte : ${q} de ${n}${m.reason ? ` (${m.reason})` : ""}`;
  if (m.kind === "reception") return `a fait entrer ${q} de ${n}`;
  if (m.kind === "transfert") return `a déplacé ${n} : ${fridgeName(m.fridgeId)} → ${fridgeName(m.toFridgeId)}`;
  return `a corrigé le stock de ${n} : ${stkSigned(m.qty)} ${m.unit || ""}`.trim();
}
/* Cross-area helper (BRIEF V3): writes one moves doc (fills at/uid/by, name/unit from the catalogue), logs it, returns its id.
   Pass stockMove(doc, { silent: true }) (or doc.noLog) to skip the journal line, e.g. one recipe or Z ticket = many moves, log once yourself. */
async function stockMove(doc, opts) {
  const d = { ...(doc || {}) }; const noLog = d.noLog || d.silent || !!(opts && (opts.silent || opts.noLog)); delete d.noLog; delete d.silent;
  const p = d.productId ? S.products.find((x) => x.id === d.productId) : d.name ? S.products.find((x) => stkKeyN(x.name) === stkKeyN(d.name)) : null;
  if (p) { d.productId = p.id; d.name = d.name || p.name; d.unit = d.unit || p.unit; }
  const m = { ...d, kind: STK_KIND[d.kind] ? d.kind : "correction", qty: stkR3(+d.qty || 0), name: d.name || "", unit: d.unit || "", at: Date.now(), uid: S.me.id, by: S.me.name || "" };
  Object.keys(m).forEach((k) => m[k] === undefined && delete m[k]);
  const id = await DB.add("moves", m);
  if (!noLog) { try { STK_EV[id] = await DB.add("events", { type: "stock", text: stkMoveText(m), at: m.at, uid: S.me.id, ref: id }); } catch (e) {} }
  return id;
}

/* ───────── allergènes ───────── */
const stkAlList = () => (typeof ALLERGENS !== "undefined" ? ALLERGENS : []);
const stkAlT = (id) => { const a = stkAlList().find((x) => x.id === id); return a ? a.t : id; };
function stkAl(p) { const ok = new Set(stkAlList().map((a) => a.id)); return [...new Set((Array.isArray(p && p.allergens) ? p.allergens : []).map((a) => (a === "fruits_coque" ? "fruitscoque" : a)))].filter((a) => ok.has(a)); }
const stkHasAl = (p) => (stkAl(p).length ? 1 : 0);
const STK_RX_MER_M = "huitres?|moules?|coquilles? saint jacques|saint jacques|st jacques|praires?|palourdes?|bulots?|calamars?|encornets?|seiches?|poulpes?|escargots?|bigorneaux?|couteaux|fines? de claire|speciales? de claire|bouchots?|clams?|ormeaux?|chipirons?|coques";
const STK_RX_MER_C = "crevettes?|gambas|homards?|langoustes?|langoustines?|crabes?|tourteaux?|araignees? de mer|ecrevisses?|bisque|surimi";
const STK_RX_MER_P = "poissons?|saumons?|cabillauds?|thons?|bar|dorades?|daurades?|soles?|merlus?|lieu|truites?|sardines?|maquereaux?|anchois|colin|haddock|eglefin|turbot|lotte|rougets?|harengs?|saint pierre|julienne|merlans?|espadon|fletan|raie|tarama|caviar|brandade|morue|nuoc mam|bonite";
const STK_AL_RX = [
  ["gluten", /\b(farines?|pains?|baguettes?|brioches?|feuilletees?|brisees?|sablees?|pates?|spaghettis?|tagliatelles?|penne|lasagnes?|ravioles?|raviolis?|gnocchis?|bieres?|chapelure|panure|semoule|ble|seigle|orge|avoine|epeautre|couscous|boulgour|croissants?|biscuits?|gateaux?|croutons?|crackers?|croquettes?|tartes?|quiches?|crepes?|gaufres?|fond de veau|fond brun|roux|blinis?|chouquettes?|madeleines?)\b/],
  ["crustaces", new RegExp(`\\b(${STK_RX_MER_C})\\b`)],
  ["oeufs", /\b(oeufs?|jaunes? d oeufs?|blancs? d oeufs?|mayonnaise|mayo|meringues?|brioches?|aioli|pates? fraiches?|croquettes?|genoise|flans?|madeleines?|chouquettes?)\b/],
  ["poissons", new RegExp(`\\b(${STK_RX_MER_P}|surimi)\\b`)],
  ["arachides", /\b(arachides?|cacahuetes?)\b/],
  ["soja", /\b(soja|tofu|edamame|miso|tamari|shoyu|tempeh)\b/],
  ["lait", /\b(beurre(?! de cacahuete)|cremes?(?! de marrons)|lait(?! de coco)|laitiers?|fromages?|comte|chevre|brie|camembert|emmental|gruyere|parmesan|mozzarella|burrata|roquefort|yaourts?|mascarpone|ricotta|feta|reblochon|tomme|cantal|morbier|munster|mimolette|raclette|glaces?|chantilly|bechamel|faisselle|petits? suisses?|brioches?|croquettes?|financiers?)\b/],
  ["fruitscoque", /\b(amandes?(?! de mer)|noisettes?|noix(?! de (coco|saint|st |veau|jambon|muscade))|pistaches?|cajou|pecan|macadamia|pralines?|pralin|frangipane|nougats?|gianduja|financiers?|massepain)\b/],
  ["celeri", /\b(celeri|celeri rave)\b/],
  ["moutarde", /\b(moutardes?|vinaigrette|remoulade)\b/],
  ["sesame", /\b(sesame|tahini|tahin|houmous|hoummous|gomasio)\b/],
  ["sulfites", /\b(vins?|vinaigres?|champagnes?|cremant|cidres?|porto|cognac|armagnac|madere|xeres|vermouth|bordeaux|chablis|cotes du rhone|cotes de provence|rose de provence|muscadet|sancerre|beaujolais|abricots secs|raisins secs|pruneaux)\b/],
  ["lupin", /\b(lupin)\b/],
  ["mollusques", new RegExp(`\\b(${STK_RX_MER_M})\\b`)],
];
const stkTx = (s) => ` ${stkNorm(s).replace(/[-_/().,;:+&]/g, " ").replace(/\s+/g, " ")} `;
function stkAlGuess(name) { const n = stkTx(name); return STK_AL_RX.filter(([, rx]) => rx.test(n)).map(([id]) => id); }
const stkAlTags = (p, max = 3) => { const L = stkAl(p); if (!L.length) return ""; return `<span class="stk-alt">${L.slice(0, max).map((id) => `<i class="stk-al">${esc(stkAlT(id))}</i>`).join("")}${L.length > max ? `<i class="stk-al more">+${L.length - max}</i>` : ""}</span>`; };
/* catalogue products whose name suggests allergens nobody confirmed yet */
const stkAlTodo = () => S.products.filter((p) => !p.alChecked && !stkAl(p).length && stkAlGuess(p.name).length);

/* ───────── rangement HACCP ───────── */
/* shelves top → bottom: ready-to-eat on top, raw meats and fish low, poultry lowest */
const STK_FAM = [
  ["cuit", "Prêt à consommer", "Cuisiné, desserts, charcuterie, entamés filmés"],
  ["lait", "Produits laitiers", "Beurre, crème, fromages, bien fermés"],
  ["oeuf", "Œufs", "Dans leur boîte, à part des autres denrées"],
  ["autre", "Autres produits", "Fermés et étiquetés"],
  ["legume", "Fruits et légumes", "En bacs ; légumes terreux à part"],
  ["mer", "Poissons et coquillages crus", "Bac fermé avec égouttoir"],
  ["viande", "Viandes crues", "Bac fermé ou filmé"],
  ["volaille", "Volailles crues", "Toujours tout en bas"],
];
const STK_FAM_RX = [
  ["cuit", /\b(cuite?s?|confite?s?|confits?|terrines?|pate de campagne|pate en croute|rillettes|jambons?|saucissons?|charcuteries?|chorizo|coppa|bresaola|lomo|desserts?|tartes?|gateaux?|mousses?|sauces?|fonds?|preparations?|maison|purees?|soupes?|veloutes?|creme brulee|tiramisu|foie gras|plats?|salade composee|taboule)\b/],
  ["oeuf", /\b(oeufs?)\b/],
  ["lait", /\b(beurre|cremes?|lait|fromages?|comte|chevre|brie|camembert|emmental|gruyere|parmesan|mozzarella|burrata|roquefort|yaourts?|mascarpone|ricotta|feta|reblochon|tomme|cantal|morbier|munster|mimolette|raclette|faisselle)\b/],
  ["mer", new RegExp(`\\b(${STK_RX_MER_M}|${STK_RX_MER_C}|${STK_RX_MER_P})\\b`)],
  ["volaille", /\b(poulets?|volailles?|dindes?|pintades?|cailles?|chapons?|coquelets?|canettes?|supremes?)\b/],
  ["viande", /\b(boeuf|bavettes?|entrecotes?|veau|porc|agneau|magrets?|canards?|lardons?|steaks?|filet mignon|cotes? de|viandes?|saucisses?|chair a|hache|joues?|onglets?|rumsteck|faux filet|gigots?|tartare|paleron|souris|echine|poitrine|travers|merguez|chipolatas?|boudins?|ris de veau|foies?|rognons?|lapins?|gibier|chevreuil|sanglier)\b/],
  ["legume", /\b(tomates?|salades?|laitues?|mesclun|roquette|citrons?|oranges?|herbes|persil|ciboulette|basilic|coriandre|legumes?|fruits?|pommes?|poires?|carottes?|oignons?|echalotes?|ail|courgettes?|aubergines?|champignons?|poireaux?|poivrons?|concombres?|radis|epinards?|choux?|brocolis?|haricots verts|asperges?|fraises?|framboises?|myrtilles?|bananes?|avocats?|celeri|navets?|betteraves?|fenouil|artichauts?|potirons?|courges?|patates?)\b/],
];
const stkFamGuess = (p) => { const n = stkTx(p.name); const f = STK_FAM_RX.find(([, rx]) => rx.test(n)); return f ? f[0] : "autre"; };
const stkFamOf = (p) => (p.fam && STK_FAM.some((f) => f[0] === p.fam) ? p.fam : stkFamGuess(p));
function stkZoneKind(z) {
  const f = S.fridges.find((x) => (x.name || "").trim().toLowerCase() === String(z).trim().toLowerCase());
  if (f) { const k = stkFridgeKind(f); return k === "congel" ? "congel" : k === "cave" ? "cave" : "froid"; }
  const n = stkNorm(z); return /congel|surgel|negati/.test(n) ? "congel" : /chambre froide|frigo|froid|refrig|saladette|vitrine|timbre/.test(n) ? "froid" : /cave|bar\b|boisson|vin/.test(n) ? "cave" : "sec";
}
/* allergen families that must not share a zone (cross-contact): seafood juices, nut traces, raw eggs */
const STK_RISK = [["mer", ["crustaces", "mollusques", "poissons"]], ["noix", ["arachides", "fruitscoque", "sesame"]], ["oeufs", ["oeufs"]]];
const stkRiskOf = (p) => { const a = stkAl(p); return STK_RISK.filter(([, ids]) => ids.some((i) => a.includes(i))).map((r) => r[0]); };
const stkRiskAl = (p, g) => stkAl(p).filter((i) => STK_RISK.find((r) => r[0] === g)[1].includes(i));
function stkConflict(z) {
  if (stkZoneKind(z) === "cave") return null;
  const by = {}; S.products.filter((p) => stkZoneOf(p) === z).forEach((p) => stkRiskOf(p).forEach((g) => (by[g] ||= []).push(p)));
  const gs = STK_RISK.map((r) => r[0]).filter((g) => by[g]); if (gs.length < 2) return null;
  const mv = gs[0]; const sig = gs.map((g) => g + ":" + by[g].map((p) => p.id).sort().join(",")).join("|");
  return { z, gs, by, mv, sig, dest: stkDestFor(z, mv) };
}
function stkDestFor(z, g) {
  const kind = stkZoneKind(z); const all = [...new Set([...S.fridges.map((f) => (f.name || "").trim()).filter(Boolean), ...stkZones()])];
  const c = all.filter((x) => x.toLowerCase() !== String(z).toLowerCase() && stkZoneKind(x) === kind).map((x) => { const gs = new Set(); S.products.filter((p) => stkZoneOf(p) === x).forEach((p) => stkRiskOf(p).forEach((r) => gs.add(r))); return { x, bad: [...gs].some((r) => r !== g), same: gs.has(g) }; }).filter((o) => !o.bad).sort((a, b) => b.same - a.same);
  return c[0] ? c[0].x : null;
}
const STK_ACK = "gg-stk-ack";
const stkAcked = (c) => { const o = stkLS(STK_ACK) || {}; return !!(o[S.rid] && o[S.rid][c.z] === c.sig); };
function stkConflictHtml(c, compact) {
  if (!c) return ""; const ack = stkAcked(c); if (ack && compact) return "";
  const part = (g) => { const ps = c.by[g]; const al = [...new Set(ps.flatMap((p) => stkRiskAl(p, g)))].map(stkAlT).join(", "); return `${esc(ps.slice(0, 2).map((p) => p.name).join(", "))}${ps.length > 2 ? ` +${ps.length - 2}` : ""} <span>(${esc(al.toLowerCase())})</span>`; };
  const how = c.mv === "mer" ? "en bas, dans un bac fermé, à un niveau d'écart" : c.mv === "noix" ? "dans un contenant fermé et étiqueté, sur une étagère à part" : "dans leur boîte fermée, sur une étagère à part";
  const who = c.by[c.mv].length === 1 ? esc(c.by[c.mv][0].name) : "ces produits";
  if (ack) return `<div class="stk-cf ok">${ico("check")}<span>Séparation confirmée : ${c.gs.map((g) => part(g)).join(" · ")}</span></div>`;
  return `<div class="stk-cf" role="note"><span class="stk-cfi">${ico("alert")}</span><div class="stk-cft"><b>À séparer : ${c.gs.map((g) => part(g)).join(" et ")}</b>
    <em>${c.dest ? `Mettez ${who} dans <b>${esc(c.dest)}</b>, ou ${how}.` : `Rangez ${who} ${how}.`}</em>
    <div class="stk-cfb">${S.stockTab !== "plan" ? `<button class="btn soft sm" data-act="stkPlanGo" data-v="${esc(c.z)}">Voir le plan</button>` : ""}<button class="btn ghost sm" data-act="stkAck" data-v="${esc(c.z)}">${ico("check")}C'est séparé</button></div></div></div>`;
}

/* Produits reçus (lots, réceptions) absents du catalogue. Ceux que l'on décoche ne sont plus proposés (par restaurant, sur cet appareil). */
const STK_IGN = "gg-stk-ign";
const stkIgnored = () => { const o = stkLS(STK_IGN) || {}; return new Set(o[S.rid] || []); };
function stkIgnore(names) { const o = stkLS(STK_IGN) || {}; o[S.rid] = [...new Set([...(o[S.rid] || []), ...names])].slice(-400); stkLS(STK_IGN, o); }
function stkRecvSuggest() {
  const have = new Set(S.products.map((p) => stkNorm(p.name).trim())); const ign = stkIgnored(); const out = new Map();
  const add = (name, src, at) => {
    name = String(name || "").replace(/\s*\(test\)\s*$/i, "").trim(); const k = stkNorm(name).trim(); if (!k || have.has(k) || ign.has(k)) return;
    const e = out.get(k) || { name, k, n: 0, at: 0, unit: "", zone: "", supplier: "" }; e.n++;
    if ((at || 0) >= e.at) { e.at = at || 0; e.name = name; e.unit = src.unit || e.unit; e.zone = stkZoneGuess(src); e.supplier = src.supplier || e.supplier; }
    out.set(k, e);
  };
  S.receptions.forEach((rc) => (rc.lines || []).forEach((L) => { if (!L.refused) add(L.name, { ...L, supplier: rc.supplier }, rc.at); }));
  S.lots.forEach((l) => { if (!l.test) add(l.name, l, l.createdAt); });
  return [...out.values()].sort((a, b) => stkZoneRank(a.zone) - stkZoneRank(b.zone) || a.name.localeCompare(b.name, "fr"));
}
function stkRecvCard(i) {
  const L = stkRecvSuggest(); if (!L.length) return "";
  return `<div class="glass pad st stk-rcv" style="--i:${i}"><span class="ic">${ico("truck")}</span><div class="tx"><b>${L.length} produit${L.length > 1 ? "s" : ""} reçu${L.length > 1 ? "s" : ""} hors catalogue</b><em>${esc(L.slice(0, 3).map((x) => x.name).join(", "))}${L.length > 3 ? "…" : ""}</em></div><button class="btn soft sm" data-act="stkRecv">${ico("plus")}Ajouter les produits reçus au catalogue</button></div>`;
}
function stkRecvSheet() {
  const L = stkRecvSuggest(); const off = S.ui.stkRv || {}; const n = L.filter((x) => !off[x.k]).length;
  if (!L.length) return `<div class="stk-stdone"><span class="check draw"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><div class="h2" style="font-size:21px">Tout est au catalogue</div><p class="sub">Les produits reçus sont tous dans votre catalogue.</p><button class="btn acc block" data-act="sheetClose">Fermer</button></div>`;
  const zs = [...new Set(L.map((x) => x.zone))];
  return `<div class="row"><div><div class="h2" style="font-size:21px">Produits reçus</div><span class="sub">Ils rejoignent le catalogue, rangés dans le frigo où ils ont été mis. Décochez ce que vous ne comptez pas.</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="stk-stl">${zs.map((z) => `<div><span class="lbl">${esc(z)}</span><div class="stk-stg">${L.filter((x) => x.zone === z).map((x) => `<button class="stk-st ${off[x.k] ? "" : "on"}" data-act="stkRvToggle" data-v="${esc(x.k)}" aria-pressed="${!off[x.k]}"><i>${ico("check")}</i><span>${esc(x.name)}</span><em>${esc(x.unit || "kg")}</em></button>`).join("")}</div></div>`).join("")}</div>
    <p class="note" style="margin:0">Les produits décochés ne seront plus proposés. Prix et zone se modifient ensuite dans le catalogue.</p>
    <div class="ctabar stk-stcta"><button class="btn acc block" data-act="stkRvAdd" ${n ? "" : "disabled"}>Ajouter ${n} produit${n > 1 ? "s" : ""}</button></div>`;
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
const stkR2 = (n) => Math.round((n || 0) * 100) / 100;
function invSummary() { const D = stkMonthData(monthKey()); return { value: stkR2(D.value), prevValue: stkR2(D.prevValue), used: stkR2(D.used), top: D.top.map((r) => ({ name: r.p.name, unit: r.p.unit, cur: r.c, prev: r.pc, used: r.used })) }; }

function stkDiff(d, suffix = "") {
  if (d == null) return "";
  const k = d > 0 ? "up" : d < 0 ? "dn" : "eq";
  return `<span class="stk-d ${k}" title="${d === 0 ? "Identique au mois précédent" : d > 0 ? "En hausse" : "En baisse"}">${ico(k === "up" ? "stkUp" : k === "dn" ? "stkDn" : "stkEq")}${d === 0 ? "" : `<span class="mono">${stkN(Math.abs(d))}${suffix}</span>`}</span>`;
}

/* ───────── view ───────── */
const STK_TABS = [["inv", "Inventaire", "list"], ["mv", "Mouvements", "trend"], ["plan", "Rangement", "grid"], ["cat", "Catalogue", "box"]];
VIEWS.stock = {
  render() {
    stkEnsureMoves();
    if (S.params && S.params.tab && S.ui.stkPT !== S.params) { S.ui.stkPT = S.params; S.stockTab = S.params.tab; }
    const tab = STK_TABS.some((t) => t[0] === S.stockTab) ? S.stockTab : "inv"; const ti = STK_TABS.findIndex((t) => t[0] === tab);
    const seg = `<div class="seg stk-seg stk-seg4 st" style="--i:1" role="tablist"><span class="knob" style="width:calc(25% - 2px);transform:translateX(${ti * 100}%)"></span>${STK_TABS.map(([k, t, ic]) => `<button class="${tab === k ? "on" : ""}" data-act="stockTab" data-v="${k}" role="tab" aria-selected="${tab === k}">${ico(ic)}<span>${t}${k === "cat" && S.products.length ? ` <span class="stk-segn mono">${S.products.length}</span>` : ""}</span></button>`).join("")}</div>`;
    if (tab === "mv" && S.products.length) return stkMovesView(seg);
    if (tab === "plan" && S.products.length) return stkPlanView(seg);
    if (!S.products.length) {
      return `<div class="inner narrow">${topBar("Stock", { noBack: true })}${seg}
        <div class="glass stk-empty st" style="--i:2"><div class="stk-empty-art">${ico("box")}</div><b class="h2">Votre inventaire en 3 gestes</b>
          <ol class="stk-steps"><li><span>1</span>Créez votre catalogue : produits, zone, unité, prix d'achat.</li><li><span>2</span>Chaque mois, comptez produit par produit avec le pavé.</li><li><span>3</span>Voyez la consommation, la valeur du stock et exportez.</li></ol>
          ${stkRecvSuggest().length ? `<button class="btn acc block" data-act="stkRecv">${ico("truck")}Ajouter les produits reçus au catalogue</button>` : ""}
          <button class="btn ${stkRecvSuggest().length ? "soft" : "acc"} block" data-act="stkStarter">${ico("sparkle")}Partir de la liste type bistro</button>
          <button class="btn soft block" data-act="prodEdit">${ico("plus")}Ajouter un produit</button></div></div>`;
    }
    return tab === "cat" ? stkCatalogue(seg) : stkInventory(seg);
  },
  after(v) { if (S.stockTab === "cat" && S.stkQ) stkApplySearch(); const on = $(".chips .chip.on", v); if (on && on.previousElementSibling) { const row = on.parentElement; row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2; } },
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
    const none = D.n === 0, part = !none && D.n < D.total;
    const vSub = none ? "Comptez pour la calculer" : dv != null ? `<span class="stk-vs">${stkDiff(Math.round(dv), " %")}<span>vs ${stkMonthName(D.pm)}${part ? "*" : ""}</span></span>` : D.priced < D.total ? `${D.priced}/${D.total} produits avec prix` : part ? `sur ${D.n} produits comptés` : "";
    return `<div class="glass pad st stk-kpis" style="--i:3"><div><span class="lbl">Valeur du stock</span><div class="h2 mono">${none ? "–" : stkEur(D.value)}</div><div class="sub">${vSub}</div></div>
      <div><span class="lbl">Consommé</span><div class="h2 mono">${D.used ? stkEur(D.used) : "–"}</div><div class="sub">depuis ${stkMonthName(D.pm)}${part && D.used ? "*" : ""}</div></div>${part && (dv != null || D.used) ? `<p class="note stk-kfn">* sur les produits comptés les deux mois</p>` : ""}</div>`;
  })() : `<div class="glass pad st stk-tip" style="--i:3"><span class="ic">${ico("trend")}</span><div><b>Voir la valeur du stock</b><p class="note">Ajoutez un prix d'achat à vos produits : la valeur et la consommation en € s'affichent ici.</p><button class="btn soft sm" data-act="stockTab" data-v="cat">Ajouter les prix</button></div></div>`;
  const topCard = D.top.length ? `<div class="glass pad st" style="--i:4"><span class="lbl">Plus grosses consommations</span>${D.top.map((r) => `<div class="li"><div class="tx"><b>${esc(r.p.name)}</b><em>${stkN(r.used)} ${esc(stkU(r.used, r.p.unit))} utilisé${r.used >= 2 ? "s" : ""}</em></div><span class="mono stk-strong">${stkEur(r.used * r.p.price)}</span></div>`).join("")}<p class="note" style="margin:8px 0 0">Stock de ${stkMonthName(D.pm)} + achats reçus − stock compté.</p></div>` : "";
  const exportCard = `<div class="glass pad st stk-exp stk-dk" style="--i:5"><div><b>Exporter ${stkMonthName(m)}</b><span class="sub">Fichier CSV pour Excel ou votre comptable</span></div><button class="btn soft sm" data-act="exportInv">${ico("download")}CSV</button></div>`;
  const shown = zones.filter((z) => !S.stkZone || z === S.stkZone);
  const chips = `<div class="chips st" style="--i:3"><button class="chip ${!S.stkZone ? "on" : ""}" data-act="stkZone" data-v="">Toutes <span class="stk-cn">${D.n}/${D.total}</span></button>${zones.map((z) => { const zr = D.rows.filter((r) => stkZoneOf(r.p) === z); const zc = zr.filter((r) => r.c != null).length; return `<button class="chip ${z === S.stkZone ? "on" : ""}" data-act="stkZone" data-v="${esc(z)}">${esc(z)} <span class="stk-cn">${zc === zr.length ? "✓" : `${zc}/${zr.length}`}</span></button>`; }).join("")}</div>`;
  const row = (r) => {
    const cdoc = r.c != null ? S.counts.find((x) => x.id === `${m}_${r.p.id}`) : null;
    const th = isCur ? (cdoc ? stkLevelAt(r.p, cdoc.at || Date.now()).level : stkLevelAt(r.p).level) : null;
    const gap = th != null && r.c != null ? stkR3(r.c - th) : null;
    const em = [th != null ? `Théorique ${stkN(Math.max(0, th))} ${esc(stkU(Math.max(0, th), r.p.unit))}` : "", r.pc != null ? `${stkMonthName(D.pm)} : ${stkN(r.pc)} ${esc(stkU(r.pc, r.p.unit))}` : th == null ? "1er comptage" : "", r.val != null ? stkEur(r.val) : ""].filter(Boolean).join(" · ");
    return `<div class="li tap stk-row ${r.c == null ? "todo" : ""}" data-act="stkEdCount" data-id="${r.p.id}" role="button" tabindex="0"><div class="tx"><b>${esc(r.p.name)}</b><em>${em}</em>${stkAlTags(r.p)}</div>
        <div class="stk-q">${r.c != null ? `<b class="mono">${stkN(r.c)}<small> ${esc(stkU(r.c, r.p.unit))}</small></b>${gap != null ? stkGap(gap) : stkDiff(r.d)}` : `<span class="stk-todo">À compter</span>`}</div></div>`;
  };
  const lists = shown.map((z, zi) => {
    const zr = stkSorted(z).map((p) => byId[p.id]); const zc = zr.filter((r) => r.c != null).length;
    return `<div class="glass pad st" style="--i:${Math.min(zi + 4, 9)}"><div class="row stk-zh"><span class="lbl">${esc(z)} <span class="mono">${zc}/${zr.length}</span></span>${isCur && zc < zr.length ? `<button class="btn ghost sm" data-act="stkStart" data-v="${esc(z)}">Compter</button>` : ""}</div>
      ${stkConflictHtml(stkConflict(z), true)}${stkAlSplit(zr, (r) => r.p, row)}</div>`;
  }).join("");
  return `<div class="inner">${topBar("Stock", { noBack: true, right: `<button class="btn soft sm stk-tbx" data-act="exportInv" aria-label="Exporter en CSV">${ico("download")}<span class="stk-hide-s">Exporter</span></button>` })}${seg}
    <div class="cols"><div>${hero}<div class="stk-ph">${valueCard}${stkLowCard(3)}</div>${stkRecvCard(3)}${chips}${lists}</div><div class="stk-side"><div class="stk-dk">${valueCard}${stkLowCard(3)}</div>${stkMvTeaser(4)}${topCard}${exportCard}</div></div></div>`;
}
function stkGap(g) {
  if (g === 0) return `<span class="stk-d eq stk-gap" title="Conforme au stock théorique">${ico("check")}</span>`;
  return `<span class="stk-d ${g > 0 ? "up" : "dn"} stk-gap" title="Écart avec le stock théorique"><span class="mono">${stkSigned(g)}</span><small>vs théo.</small></span>`;
}
/* one zone's rows: products without allergen first, then the « à ranger à part » group */
function stkAlSplit(items, getP, render) {
  const a = items.filter((x) => !stkHasAl(getP(x))), b = items.filter((x) => stkHasAl(getP(x)));
  return a.map(render).join("") + (b.length ? `<div class="stk-alh">${ico("alert")}<span>Allergènes : à ranger à part</span><em class="mono">${b.length}</em></div><div class="stk-alg-rows">${b.map(render).join("")}</div>` : "");
}
function stkLowCard(i) {
  if (!S.products.some((p) => p.minQty > 0)) return "";
  const L = stockLow();
  return `<button class="glass pad st stk-low ${L.length ? "on" : ""}" style="--i:${i}" data-act="stkLowOpen"><span class="ic">${ico(L.length ? "truck" : "check")}</span><span class="tx"><b>${L.length ? `À commander : ${L.length} produit${L.length > 1 ? "s" : ""}` : "Stock suffisant"}</b><em>${L.length ? esc(L.slice(0, 3).map((x) => x.name).join(", ")) + (L.length > 3 ? "…" : "") : "Aucun produit sous son seuil d'alerte"}</em></span>${ico("chev")}</button>`;
}
function stkMvTeaser(i) {
  const L = stkMvRows().slice(0, 4);
  return `<div class="glass pad st stk-mvt" style="--i:${i}"><div class="row"><span class="lbl">Derniers mouvements</span><button class="btn ghost sm" data-act="stockTab" data-v="mv">Tout voir</button></div>
    ${L.length ? L.map(stkMvRow).join("") : `<p class="note" style="margin:6px 0 0">Recettes utilisées, ventes du ticket Z, pertes : tout s'affiche ici.</p>`}
    <button class="btn danger block stk-lossb" data-act="stkLoss">${ico("trash")}Perte / casse</button></div>`;
}

function stkCatalogue(seg) {
  const q = S.stkQ || ""; const zones = stkZones(); const nq = stkNorm(q);
  const priced = S.products.filter((p) => p.price > 0).length;
  const groups = zones.map((z, zi) => {
    const ps = stkSorted(z); const vis = ps.filter((p) => !nq || stkNorm(`${p.name} ${p.supplier || ""} ${z}`).includes(nq)).length;
    return `<div class="glass pad st stk-grp" style="--i:${Math.min(zi + 3, 9)}" data-zone="${esc(z)}" ${vis ? "" : "hidden"}><div class="row stk-zh"><span class="lbl">${esc(z)} <span class="mono stk-gn">${ps.length}</span></span><button class="btn ghost sm" data-act="prodEdit" data-v="${esc(z)}" aria-label="Ajouter dans ${esc(z)}">${ico("plus")}</button></div>
      ${stkConflictHtml(stkConflict(z), true)}${stkAlSplit(ps, (p) => p, (p) => { const hay = stkNorm(`${p.name} ${p.supplier || ""} ${z} ${stkAl(p).map(stkAlT).join(" ")}`); const lv = p.minQty > 0 ? stkLevelAt(p).level : null; const low = lv != null && lv <= p.minQty; return `<div class="li tap stk-prow" data-act="prodEdit" data-id="${p.id}" data-q="${esc(hay)}" role="button" tabindex="0" ${nq && !hay.includes(nq) ? "hidden" : ""}><div class="tx"><b>${esc(p.name)}</b><em>${esc(p.unit)}${p.supplier ? ` · ${esc(p.supplier)}` : ""}${low ? ` · <span class="stk-lowt">Stock bas</span>` : ""}</em>${stkAlTags(p)}</div>${p.price > 0 ? `<span class="mono stk-price">${stkEur(p.price, 2)}<small>/${esc(p.unit)}</small></span>` : `<span class="stk-noprice">Prix ?</span>`}${ico("chev")}</div>`; })}</div>`;
  }).join("");
  const todo = stkAlTodo();
  const alCard = todo.length ? `<div class="glass pad st stk-rcv stk-alrv" style="--i:2"><span class="ic">${ico("alert")}</span><div class="tx"><b>${todo.length} produit${todo.length > 1 ? "s" : ""} à vérifier : allergènes</b><em>${esc(todo.slice(0, 3).map((p) => p.name).join(", "))}${todo.length > 3 ? "…" : ""}</em></div><button class="btn soft sm" data-act="stkAlReview">${ico("sparkle")}Vérifier les allergènes</button></div>` : "";
  return `<div class="inner stk-cat">${topBar("Stock", { noBack: true, right: `<button class="btn acc sm" data-act="prodEdit">${ico("plus")}Produit</button>` })}${seg}
    <div class="stk-search st" style="--i:2">${ico("search")}<input class="input" id="stkQ" data-stkq="1" type="search" placeholder="Rechercher un produit, un fournisseur…" value="${esc(q)}" autocomplete="off" aria-label="Rechercher"></div>
    <div class="row st" style="--i:2;padding:0 4px"><span class="sub">${S.products.length} produits · ${priced} avec prix</span><button class="btn ghost sm" data-act="stkStarter">${ico("sparkle")}Liste type</button></div>
    ${alCard}${stkRecvCard(2)}<div class="stk-groups">${groups}</div><div class="glass empty stk-nores" hidden><b>Aucun produit trouvé</b><button class="btn soft sm" data-act="prodEditQ" style="margin-top:10px">${ico("plus")}<span>Créer « <span id="stkQn"></span> »</span></button></div></div>`;
}
function stkApplySearch() {
  const inp = $("#stkQ"); if (!inp) return; S.stkQ = inp.value; const nq = stkNorm(inp.value); let any = false;
  $$(".stk-grp").forEach((g) => { let n = 0; $$(".stk-prow", g).forEach((r) => { const ok = !nq || r.dataset.q.includes(nq); r.hidden = !ok; if (ok) n++; }); g.hidden = !n; if (n) any = true; const ah = $(".stk-alh", g); if (ah) ah.hidden = !$$(".stk-alg-rows .stk-prow", g).some((r) => !r.hidden); });
  const nr = $(".stk-nores"); if (nr) { nr.hidden = any; $("#stkQn").textContent = inp.value.trim(); }
}
document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.stkq) stkApplySearch(); });

/* ───────── mouvements ───────── */
/* moves (V3) + legacy quick adjustments + received lots not already linked to a move, newest first */
function stkMvRows() {
  const L = (S.moves || []).map((m) => ({ ...m, src: "moves" }));
  S.stockMoves.forEach((x) => { const p = S.products.find((y) => y.id === x.productId); L.push({ id: x.id, src: "stockMoves", productId: x.productId, name: p ? p.name : "Produit supprimé", unit: p ? p.unit : "", qty: x.delta, kind: "correction", reason: "Ajustement rapide", at: x.at, uid: x.uid }); });
  const linked = new Set((S.moves || []).filter((m) => m.lotId).map((m) => m.lotId));
  S.lots.forEach((l) => { if (l.test || linked.has(l.id) || !l.createdAt) return; const p = S.products.find((y) => stkLotMatch(l, y)); if (!p) return; L.push({ id: l.id, src: "lots", productId: p.id, name: p.name, unit: p.unit, qty: num(l.qty) || 0, kind: "reception", label: l.supplier || "", at: l.createdAt, uid: l.uid }); });
  return L.sort((a, b) => (b.at || 0) - (a.at || 0));
}
const stkMvSub = (x) => {
  const k = STK_KIND[x.kind] || STK_KIND.correction;
  const what = x.kind === "transfert" ? `${esc(fridgeName(x.fridgeId))} → ${esc(fridgeName(x.toFridgeId))}` : x.kind === "perte" ? esc(x.reason || "Perte") : x.label || x.refName ? `${k.t} · ${esc(x.label || x.refName)}` : x.reason ? esc(x.reason) : k.t;
  return `${what} · ${x.uid ? esc(firstName(nameOf(x.uid))) + " · " : x.by ? esc(x.by) + " · " : ""}${when(x.at || 0)}`;
};
function stkMvRow(x) {
  const k = STK_KIND[x.kind] || STK_KIND.correction; const q = +x.qty || 0;
  return `<div class="li tap stk-mv" data-act="stkMvOpen" data-id="${esc(x.id)}" data-v="${x.src}" role="button" tabindex="0"><span class="stk-mvi k-${x.kind}">${ico(k.ic)}</span><div class="tx"><b>${esc(x.name || "Produit")}</b><em>${stkMvSub(x)}</em></div>
    <span class="mono stk-mvq ${x.kind === "transfert" ? "" : q < 0 ? "neg" : q > 0 ? "pos" : ""}">${x.kind === "transfert" ? (q ? `${stkN(Math.abs(q))} ${esc(stkU(Math.abs(q), x.unit))}` : "↔") : `${stkSigned(q)}<small> ${esc(stkU(Math.abs(q), x.unit))}</small>`}</span></div>`;
}
function stkMovesView(seg) {
  const f = STK_KIND[S.stkMvF] ? S.stkMvF : "all"; const pf = S.stkMvP && S.products.find((p) => p.id === S.stkMvP);
  const all = stkMvRows().filter((x) => !pf || x.productId === pf.id || (!x.productId && stkKeyN(x.name) === stkKeyN(pf.name)));
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0); const mon = all.filter((x) => (x.at || 0) >= +m0);
  const priceOf = (x) => { const p = S.products.find((y) => y.id === x.productId); return p && p.price > 0 ? p.price : 0; };
  const loss = mon.filter((x) => x.kind === "perte"); const lossV = loss.reduce((a, x) => a + Math.abs(x.qty || 0) * priceOf(x), 0);
  const cnt = (k) => mon.filter((x) => x.kind === k).length;
  const kpi = `<div class="glass pad st stk-mvk" style="--i:2"><div><span class="lbl">Pertes du mois</span><div class="h2 mono ${loss.length ? "bad" : ""}">${lossV ? stkEur(lossV) : loss.length}</div><div class="sub">${lossV ? `${loss.length} perte${loss.length > 1 ? "s" : ""}` : loss.length > 1 ? "pertes" : "perte"}</div></div>
    <div><span class="lbl">Recettes</span><div class="h2 mono">${cnt("recette")}</div><div class="sub">sorties</div></div><div><span class="lbl">Ventes</span><div class="h2 mono">${cnt("vente")}</div><div class="sub">lignes du Z</div></div></div>`;
  const acts = `<div class="grid2 st stk-mva" style="--i:2"><button class="btn danger stk-big" data-act="stkLoss" ${pf ? `data-id="${pf.id}"` : ""}>${ico("trash")}Perte / casse</button><button class="btn soft stk-big" data-act="stkFix" ${pf ? `data-id="${pf.id}"` : ""}>${ico("sliders")}Corriger un stock</button></div>`;
  const kinds = Object.keys(STK_KIND).filter((k) => all.some((x) => x.kind === k));
  const chips = kinds.length > 1 || pf ? `<div class="chips st" style="--i:3">${pf ? `<button class="chip on stk-pf" data-act="stkMvP" data-v="">${esc(pf.name)} ${ico("x")}</button>` : ""}<button class="chip ${f === "all" ? "on" : ""}" data-act="stkMvF" data-v="all">Tous</button>${kinds.map((k) => `<button class="chip ${f === k ? "on" : ""}" data-act="stkMvF" data-v="${k}">${STK_KIND[k].tp} <span class="stk-cn">${all.filter((x) => x.kind === k).length}</span></button>`).join("")}</div>` : "";
  const rows = all.filter((x) => f === "all" || x.kind === f); const lim = S.ui.stkMvLim || 60; const shown = rows.slice(0, lim);
  const days = []; shown.forEach((x) => { const d = dayKey(new Date(x.at || 0)); const g = days[days.length - 1]; if (g && g.d === d) g.L.push(x); else days.push({ d, L: [x] }); });
  const dl = (d) => { const t = dayKey(); const y = new Date(); y.setDate(y.getDate() - 1); if (d === t) return "Aujourd'hui"; if (d === dayKey(y)) return "Hier"; const D = parseDay(d); return `${["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][D.getDay()]} ${D.getDate()} ${MONTHS[D.getMonth()]}`; };
  const list = rows.length ? days.map((g, i) => `<div class="glass pad st" style="--i:${Math.min(i + 4, 9)}"><span class="lbl">${dl(g.d)}</span>${g.L.map(stkMvRow).join("")}</div>`).join("") + (rows.length > lim ? `<button class="btn soft block" data-act="stkMvMore">Voir plus (${rows.length - lim})</button>` : "")
    : `<div class="glass stk-empty st" style="--i:4"><div class="stk-empty-art">${ico("trend")}</div><b class="h2">${pf ? `Aucun mouvement pour ${esc(pf.name)}` : f !== "all" ? `Aucun mouvement « ${STK_KIND[f].tp.toLowerCase()} »` : "Aucun mouvement pour l'instant"}</b>
      <ol class="stk-steps"><li><span>1</span>« Utiliser la recette » retire les ingrédients du stock.</li><li><span>2</span>Le ticket Z de fin de service retire ce qui a été vendu.</li><li><span>3</span>Une casse ? Touchez « Perte / casse » : le stock théorique se met à jour.</li></ol></div>`;
  return `<div class="inner">${topBar("Stock", { noBack: true })}${seg}
    <div class="cols"><div><div class="stk-ph">${acts}${kpi}</div>${chips}${list}</div><div class="stk-side"><div class="stk-dk">${acts}${kpi}</div>${stkLowCard(3)}
      <div class="glass pad st stk-tip" style="--i:4"><span class="ic">${ico("sparkle")}</span><div><b>Stock théorique</b><p class="note" style="margin:4px 0 0">Dernier inventaire + réceptions + mouvements. Comparez-le au comptage dans l'onglet Inventaire.</p></div></div></div></div></div>`;
}
function stkMvSheet(id, src) {
  const x = stkMvRows().find((r) => r.id === id && r.src === src); if (!x) return "";
  const k = STK_KIND[x.kind] || STK_KIND.correction; const q = +x.qty || 0; const p = S.products.find((y) => y.id === x.productId);
  const lines = [["Type", k.t], x.reason ? ["Motif", x.reason] : null, x.label || x.refName ? ["Origine", x.label || x.refName] : null, x.kind === "transfert" ? ["Trajet", `${fridgeName(x.fridgeId)} → ${fridgeName(x.toFridgeId)}`] : null, ["Par", x.uid ? nameOf(x.uid) : x.by || "—"], ["Quand", when(x.at || 0)], p && p.price > 0 && q ? ["Valeur", stkEur(Math.abs(q) * p.price, 2)] : null].filter(Boolean);
  return `<div class="row"><div style="min-width:0"><span class="lbl">${esc(k.t)}</span><div class="h2 stk-ellip" style="font-size:21px;margin-top:2px">${esc(x.name || "Produit")}</div></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="stk-mvbig"><span class="stk-mvi k-${x.kind}">${ico(k.ic)}</span><b class="mono ${q < 0 ? "neg" : q > 0 ? "pos" : ""}">${x.kind === "transfert" ? "↔" : stkSigned(q)}</b><span>${esc(stkU(Math.abs(q), x.unit))}</span></div>
    <div class="stk-kv">${lines.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("")}</div>
    ${p ? `<div class="sub" style="text-align:center">Stock théorique de ${esc(p.name)} : <b class="mono">${stkN(Math.max(0, stkLevelAt(p).level || 0))} ${esc(p.unit)}</b></div>` : ""}
    ${src !== "lots" ? `<button class="btn ghost block stk-del" data-act="stkMvDel" data-id="${esc(id)}" data-v="${src}">${ico("trash")}Supprimer ce mouvement</button>` : `<p class="note" style="margin:0;text-align:center">Entrée créée par la réception du lot.</p>`}`;
}

/* ───────── perte / casse, correction ───────── */
const STK_REASONS = ["Casse", "DLC dépassée", "Abîmé", "Erreur de préparation", "Retour client", "Autre"];
function stkLsOpen(kind, pid) {
  S.ui.stkEd = null; S.ui.stkLs = { kind, pid: pid && S.products.some((p) => p.id === pid) ? pid : null, buf: "", typed: false, reason: kind === "perte" ? "Casse" : "" };
  openSheet(stkLsHtml(), (b) => { const sb = $("#sheetBody"); if (!sb.dataset.stkLp) { sb.dataset.stkLp = 1; stkLongPress(sb); } });
}
function stkLsHtml() {
  const L = S.ui.stkLs; const p = L.pid && S.products.find((x) => x.id === L.pid); const loss = L.kind === "perte";
  const title = loss ? "Perte / casse" : "Corriger un stock";
  if (!p) {
    const recent = [...new Set((S.moves || []).filter((m) => m.kind === (loss ? "perte" : "correction") && m.productId).map((m) => m.productId))].map((id) => S.products.find((x) => x.id === id)).filter(Boolean).slice(0, 5);
    const item = (x) => `<button class="li tap stk-lsp" data-act="stkLsPick" data-id="${x.id}" data-q="${esc(stkNorm(x.name + " " + stkZoneOf(x)))}"><div class="tx"><b>${esc(x.name)}</b><em>${esc(stkZoneOf(x))}${(() => { const l = stkLevelAt(x).level; return l != null ? ` · ${stkN(Math.max(0, l))} ${esc(stkU(Math.max(0, l), x.unit))}` : ""; })()}</em></div>${ico("chev")}</button>`;
    return `<div class="row"><div><div class="h2" style="font-size:21px">${title}</div><span class="sub">Quel produit ?</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <div class="stk-search">${ico("search")}<input class="input" id="stkLsQ" data-stklsq="1" type="search" placeholder="Rechercher un produit…" autocomplete="off" aria-label="Rechercher un produit"></div>
      <div class="stk-lsl">${recent.length ? `<span class="lbl stk-lsr">Récents</span>${recent.map(item).join("")}<span class="lbl stk-lsr">Tous les produits</span>` : ""}${stkSorted().map(item).join("")}</div>`;
  }
  const lv = stkLevelAt(p).level;
  return `<div class="row"><button class="iconbtn" data-act="stkLsBack" aria-label="Changer de produit">${ico("back")}</button><div style="min-width:0;flex:1;text-align:center"><span class="lbl">${title}</span><div class="h2 stk-ellip" style="font-size:20px;margin-top:2px">${esc(p.name)}</div></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="sub" style="text-align:center;margin:-4px 0 -8px">${loss ? "Quantité perdue" : "Quantité réelle en stock"}${lv != null ? ` · théorique <b class="mono">${stkN(Math.max(0, lv))} ${esc(stkU(Math.max(0, lv), p.unit))}</b>` : ""}</div>
    ${stkValHtml(L.buf, p.unit, "stkLsVal")}
    ${loss ? `<div class="chips stk-pick stk-rsn">${STK_REASONS.map((r) => `<button class="chip ${r === L.reason ? "on" : ""}" data-act="stkLsReason" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div>` : ""}
    ${stkKeypad("ls")}
    <button class="btn ${loss ? "danger stk-lossgo" : "acc"} block stk-big" data-act="stkLsSave">${loss ? `${ico("trash")}Enregistrer la perte` : "Corriger le stock"}</button>`;
}
document.addEventListener("input", (e) => { if (!e.target.dataset || !e.target.dataset.stklsq) return; const q = stkNorm(e.target.value).trim(); $$(".stk-lsp").forEach((b) => { b.hidden = !!q && !b.dataset.q.includes(q); }); $$(".stk-lsr").forEach((l) => { l.hidden = !!q; }); });

/* ───────── à commander ───────── */
function stkLowSheet() {
  const L = stockLow(); const sup = [...new Set(L.map((x) => x.supplier || ""))].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b, "fr"));
  const sugg = (x) => { const p = S.products.find((y) => y.id === x.id); const st = (p && p.step) || stkDefStep(x.unit); return Math.max(st, Math.ceil((x.min * 2 - Math.max(0, x.level)) / st) * st); };
  if (!L.length) return `<div class="stk-stdone"><span class="check draw"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><div class="h2" style="font-size:21px">Rien à commander</div><p class="sub">Tous les produits avec un seuil sont au-dessus.</p><button class="btn acc block" data-act="sheetClose">Fermer</button></div>`;
  return `<div class="row"><div><div class="h2" style="font-size:21px">À commander</div><span class="sub">Stock théorique sous le seuil d'alerte. Quantité proposée : de quoi revenir à 2× le seuil.</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="stk-stl">${sup.map((s) => `<div><span class="lbl">${esc(s || "Sans fournisseur")}</span>${L.filter((x) => (x.supplier || "") === s).map((x) => `<div class="li tap" data-act="prodEdit" data-id="${x.id}" role="button" tabindex="0"><div class="tx"><b>${esc(x.name)}</b><em>Reste ${stkN(Math.max(0, x.level))} ${esc(stkU(x.level, x.unit))} · seuil ${stkN(x.min)}</em></div><span class="pill acc mono">+${stkN(sugg(x))} ${esc(stkU(sugg(x), x.unit))}</span></div>`).join("")}</div>`).join("")}</div>
    <button class="btn acc block" data-act="stkLowCopy">${ico("share")}Copier la liste</button>`;
}

/* ───────── vérification des allergènes ───────── */
function stkAlReviewSheet() {
  const L = stkAlTodo(); const off = (S.ui.stkAlR ||= {});
  if (!L.length) return `<div class="stk-stdone"><span class="check draw"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><div class="h2" style="font-size:21px">Allergènes à jour</div><p class="sub">Tous les produits ont été vérifiés.</p><button class="btn acc block" data-act="sheetClose">Fermer</button></div>`;
  return `<div class="row"><div><div class="h2" style="font-size:21px">Allergènes suggérés</div><span class="sub">D'après le nom des produits. Décochez ce qui est faux, puis confirmez.</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="stk-alrl">${L.map((p) => `<div class="stk-alri"><b>${esc(p.name)}</b><div class="stk-stg">${stkAlGuess(p.name).map((a) => { const k = p.id + ":" + a; return `<button class="stk-st ${off[k] ? "" : "on"}" data-act="stkAlRT" data-v="${esc(k)}" aria-pressed="${!off[k]}"><i>${ico("check")}</i><span>${esc(stkAlT(a))}</span></button>`; }).join("")}</div></div>`).join("")}</div>
    <div class="ctabar stk-stcta"><button class="btn acc block" data-act="stkAlRSave">Confirmer ${L.length} produit${L.length > 1 ? "s" : ""}</button></div>`;
}

/* ───────── plan de rangement ───────── */
function stkPlanView(seg) {
  const zones = stkZones().filter((z) => stkZoneKind(z) !== "cave");
  const cards = zones.map((z, zi) => {
    const kind = stkZoneKind(z); const ps = stkSorted(z); const cold = kind !== "sec";
    let shelves;
    if (cold) shelves = STK_FAM.map(([k, t, s]) => ({ k, t, s, L: ps.filter((p) => stkFamOf(p) === k) })).filter((x) => x.L.length);
    else shelves = [{ k: "sec", t: "Épicerie", s: "Le plus lourd en bas", L: ps.filter((p) => !stkHasAl(p)) }, { k: "alg", t: "Allergènes", s: "Contenants fermés et étiquetés, étagère dédiée", L: ps.filter((p) => stkHasAl(p)) }].filter((x) => x.L.length);
    const chip = (p) => `<button class="stk-pc ${stkHasAl(p) ? "al" : ""}" data-act="prodEdit" data-id="${p.id}">${esc(p.name)}${stkHasAl(p) ? `<i>${esc(stkAl(p).map(stkAlT).slice(0, 2).join(", "))}${stkAl(p).length > 2 ? "…" : ""}</i>` : ""}</button>`;
    const shelf = (x, i) => { const a = cold ? x.L.filter((p) => !stkHasAl(p)) : x.L, b = cold ? x.L.filter((p) => stkHasAl(p)) : []; return `<div class="stk-sh f-${x.k}"><span class="stk-shn mono">${i + 1}</span><div class="stk-shb"><b>${esc(x.t)}</b><em>${esc(x.s)}</em><div class="stk-pcs">${a.map(chip).join("")}${b.length ? `<div class="stk-bac"><span>${ico("alert")}Bac allergènes</span>${b.map(chip).join("")}</div>` : ""}</div></div></div>`; };
    const icn = kind === "congel" ? "snow" : kind === "froid" ? "therm" : "box";
    return `<div class="glass pad st stk-plan" style="--i:${Math.min(zi + 3, 9)}" data-zone="${esc(z)}"><div class="row stk-zh"><span class="stk-plh"><span class="stk-pli k-${kind}">${ico(icn)}</span><b>${esc(z)}</b></span><span class="pill neu">${ps.length} produit${ps.length > 1 ? "s" : ""}</span></div>
      ${stkConflictHtml(stkConflict(z), false)}
      <div class="stk-fr ${cold ? "cold" : "dry"}"><span class="stk-frt">${cold ? "Haut" : "Haut"}</span>${shelves.map(shelf).join("")}<span class="stk-frt">${cold ? "Bas" : "Sol : rien posé, 15 cm minimum"}</span></div></div>`;
  }).join("");
  const conflicts = zones.map(stkConflict).filter((c) => c && !stkAcked(c)).length;
  const head = `<div class="glass pad st stk-planh" style="--i:2"><span class="ic">${ico("grid")}</span><div><b>Plan de rangement</b><p class="note" style="margin:3px 0 0">Du haut vers le bas, selon l'HACCP : le cuit et le prêt à consommer en haut, le cru en bas, la volaille tout en bas. Les allergènes à part, en bacs fermés.</p>${conflicts ? `<span class="pill warn" style="margin-top:8px">${ico("alert")}${conflicts} zone${conflicts > 1 ? "s" : ""} à séparer</span>` : `<span class="pill ok" style="margin-top:8px">${ico("check")}Aucun mélange d'allergènes à risque</span>`}</div></div>`;
  return `<div class="inner">${topBar("Stock", { noBack: true })}${seg}${head}<div class="stk-plans">${cards || `<div class="glass empty">Ajoutez des produits avec leur zone pour voir le plan.</div>`}</div>
    <p class="note st" style="--i:9;text-align:center;margin:0 8px">Touchez un produit pour corriger son étagère ou ses allergènes.</p></div>`;
}

/* ───────── comptage plein écran ───────── */
function stkSessLoad() { const s = stkLS(STK_SS); return s && s.rid === S.rid && s.month === monthKey() ? s : null; }
function stkSessSave() { const C = S.ui.stkCm; if (!C) return; stkLS(STK_SS, { rid: S.rid, month: C.month, scope: C.scope || null, pid: C.list[C.i] || null, buf: C.typed ? C.buf : "", at: Date.now() }); }

function stkKeypad(ctx) {
  return `<div class="keypad stk-kp">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"].map((k) => `<button data-act="stkKey" data-id="${ctx}" data-v="${k}" aria-label="${k === "del" ? "Effacer (appui long : tout effacer)" : k === "," ? "Virgule" : k}" class="${k === "del" ? "del" : k === "," ? "sep" : ""}">${k === "del" ? ico("back") : k}</button>`).join("")}</div>`;
}
const stkBufHtml = (b) => esc(b || "0").replace(",", '<i class="cm">,</i>');
function stkValHtml(buf, unit, id) { return `<div class="stk-val ${buf === "" ? "empty" : ""} ${buf.length > 6 ? "xlong" : buf.length > 4 ? "long" : ""}" id="${id}"><span class="mono n">${stkBufHtml(buf)}</span><span class="caret"></span><span class="u" data-u="${esc(unit)}">${esc(stkU(num(buf), unit))}</span></div>`; }

function stkCmCard() {
  const C = S.ui.stkCm; const p = S.products.find((x) => x.id === C.list[C.i]); if (!p) return "";
  const pc = countOf(p.id, stkShift(C.month, -1)), cur = countOf(p.id, C.month);
  return `<div class="stk-card" id="stkCard">
    <span class="pill acc stk-zp">${esc(stkZoneOf(p))}</span>
    <div class="stk-pn">${esc(p.name)}</div>
    ${p.supplier || cur != null ? `<div class="stk-pm">${[p.supplier ? esc(p.supplier) : "", cur != null ? `<b class="okc">${ico("check")}Déjà compté</b>` : ""].filter(Boolean).join(" · ")}</div>` : ""}
    ${stkValHtml(C.buf, p.unit, "stkVal")}
    <div class="stk-hintw" id="stkHint">${pc != null ? `<button class="stk-hint" data-act="stkSame"><span>Le mois dernier</span><b class="mono">${stkN(pc)} ${esc(stkU(pc, p.unit))}</b><em>Même quantité</em></button>` : `<div class="stk-hint none"><span>Premier comptage de ce produit</span></div>`}</div>
  </div>`;
}
function stkCmHead() {
  const C = S.ui.stkCm; const cm = stkCountMap(C.month); const n = C.list.filter((id) => cm[id] != null).length; const p = S.products.find((x) => x.id === C.list[C.i]);
  return `<div class="stk-cm-zone"><b>${esc(C.scope || `Inventaire de ${stkMonthName(C.month)}`)}</b><span class="mono">${Math.min(C.i + 1, C.list.length)} / ${C.list.length}</span></div>
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
  const ex = new Set(S.products.map((p) => p.id));
  if (C.list.some((id) => !ex.has(id))) { const at = C.list[C.i]; const before = C.list.slice(0, C.i).filter((id) => ex.has(id)).length; C.list = C.list.filter((id) => ex.has(id)); C.i = ex.has(at) ? before : before - (dir > 0 ? 1 : 0); if (!C.list.length) { stkCmClose(); return; } }
  C.lock = Date.now() + 240; C.warned = null;
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
    <div class="stk-pm">${full ? `${all.total} produits comptés pour ${stkMonthName(C.month)}${stkHasPrice() ? ` · stock de ${stkEur(stkMonthData(C.month).value)}` : ""}` : `${C.scope ? `${esc(C.scope)} · ` : ""}${done} compté${done > 1 ? "s" : ""}${left.length ? ` · ${left.length} passé${left.length > 1 ? "s" : ""}` : ""} · ${all.n}/${all.total} au total`}</div>
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
/* Garde-fou : une valeur 10× plus grande que le mois dernier (ou énorme) demande un 2e appui sur Suivant. */
function stkCmOdd(C) {
  if (!C.typed || C.buf === "") return false; const v = num(C.buf); const pid = C.list[C.i]; if (v == null || v === countOf(pid, C.month)) return false;
  const pc = countOf(pid, stkShift(C.month, -1)); const p = S.products.find((x) => x.id === pid);
  const odd = pc != null && pc > 0 ? v >= pc * 10 && v - pc >= 10 : v >= 1000;
  if (!odd || C.warned === C.buf) return false;
  C.warned = C.buf; const h = $("#stkHint");
  if (h) h.innerHTML = `<div class="stk-warn" role="alert">${ico("alert")}<span><b>${stkN(v)} ${esc(stkU(v, p ? p.unit : ""))}, c'est bien ça ?</b>${pc != null && pc > 0 ? `Le mois dernier : ${stkN(pc)} ${esc(stkU(pc, p ? p.unit : ""))}. ` : ""}Touchez Suivant pour confirmer.</span></div>`;
  stkShake($("#stkVal")); SFX.err(); buzz([8, 30, 8]); return true;
}
function stkShake(el) { if (el && el.animate) el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "none" }], { duration: 360, easing: "ease-out" }); }
function stkKey(ctx, k) {
  const C = ctx === "cm" ? S.ui.stkCm : ctx === "ls" ? S.ui.stkLs : S.ui.stkEd; if (!C) return; const vid = ctx === "cm" ? "#stkVal" : ctx === "ls" ? "#stkLsVal" : "#stkEdVal";
  let b = C.typed ? C.buf : "";
  if (k === "del") b = C.typed ? b.slice(0, -1) : "";
  else if (k === "clr") b = "";
  else if (k === ",") { if (!b.includes(",")) b = (b || "0") + ","; }
  else { const [ip, dec] = b.split(","); if (dec != null ? dec.length >= 3 : ip.length >= 6) { stkShake($(vid)); SFX.err(); return; } b = b === "0" ? k : b + k; }
  C.buf = b; C.typed = true; SFX.tick(); buzz(3);
  if (ctx === "cm" && C.warned != null) { C.warned = null; const h = $("#stkHint"), cur = $("#stkCm .stk-warn"); if (h && cur) { const pid = C.list[C.i], p = S.products.find((x) => x.id === pid), pc = countOf(pid, stkShift(C.month, -1)); h.innerHTML = pc != null && p ? `<button class="stk-hint" data-act="stkSame"><span>Le mois dernier</span><b class="mono">${stkN(pc)} ${esc(stkU(pc, p.unit))}</b><em>Même quantité</em></button>` : `<div class="stk-hint none"><span>Premier comptage de ce produit</span></div>`; } }
  const d = $(vid); if (d) { $(".n", d).innerHTML = stkBufHtml(b); const u = $(".u", d); if (u && u.dataset.u) u.textContent = stkU(num(b), u.dataset.u); d.classList.toggle("empty", b === ""); d.classList.toggle("long", b.length > 4 && b.length <= 6); d.classList.toggle("xlong", b.length > 6); d.classList.remove("bump"); void d.offsetWidth; d.classList.add("bump"); }
  if (ctx === "cm") stkSessSave();
}
function stkLongPress(el) {
  let t = null;
  el.addEventListener("pointerdown", (e) => { const b = e.target.closest(".stk-kp .del"); if (!b) return; clearTimeout(t); t = setTimeout(() => { stkKey(b.dataset.id, "clr"); buzz(14); }, 520); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => el.addEventListener(ev, () => clearTimeout(t)));
}
document.addEventListener("keydown", (e) => {
  const cmOn = $("#stkCm.on"); const shOpen = $("#sheet").classList.contains("open"); const edOn = !cmOn && S.ui.stkEd && shOpen && $("#stkEdVal"); const lsOn = !cmOn && !edOn && S.ui.stkLs && shOpen && $("#stkLsVal");
  if (!cmOn && !edOn && !lsOn) return; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !(cmOn && !cmOn.contains(e.target))) return; if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ctx = cmOn ? "cm" : lsOn ? "ls" : "ed"; const k = e.key;
  if (/^[0-9]$/.test(k)) { e.preventDefault(); stkKey(ctx, k); }
  else if (k === "," || k === ".") { e.preventDefault(); stkKey(ctx, ","); }
  else if (k === "Backspace") { e.preventDefault(); stkKey(ctx, "del"); }
  else if (k === "Enter") { e.preventDefault(); if (cmOn) { if (S.ui.stkCm && S.ui.stkCm.i < S.ui.stkCm.list.length) ACT.stkNext(); } else if (lsOn) ACT.stkLsSave(); else ACT.stkEdSave(); }
  else if (cmOn && k === "ArrowRight") { e.preventDefault(); ACT.stkSkip(); }
  else if (cmOn && k === "ArrowLeft") { e.preventDefault(); ACT.stkPrev(); }
  else if (cmOn && k === "Escape") { e.preventDefault(); ACT.stkCmClose(); }
});

/* ───────── correction d'un comptage (feuille) ───────── */
function stkEdOpen(pid) {
  const p = S.products.find((x) => x.id === pid); if (!p) return; const m = S.stkMonth && S.stkMonth < monthKey() ? S.stkMonth : monthKey();
  const cur = countOf(pid, m), pc = countOf(pid, stkShift(m, -1));
  S.ui.stkLs = null; S.ui.stkEd = { pid, month: m, buf: cur != null ? stkN(cur) : "", typed: false };
  openSheet(`<div class="row"><div style="min-width:0"><span class="lbl">${esc(stkZoneOf(p))} · ${stkMonthName(m)}</span><div class="h2 stk-ellip" style="font-size:21px;margin-top:2px">${esc(p.name)}</div></div><button class="iconbtn" data-act="prodEdit" data-id="${p.id}" aria-label="Modifier le produit">${ico("edit")}</button></div>
    ${stkValHtml(S.ui.stkEd.buf, p.unit, "stkEdVal")}
    <div class="sub" style="text-align:center;margin-top:-8px">${pc != null ? `${stkMonthName(stkShift(m, -1))} : <b class="mono">${stkN(pc)} ${esc(p.unit)}</b>` : "Premier comptage de ce produit"}</div>
    ${stkKeypad("ed")}
    <div class="grid2" style="grid-template-columns:${cur != null ? "1fr 2fr" : "1fr"}">${cur != null ? `<button class="btn danger" data-act="stkEdClear">Effacer</button>` : ""}<button class="btn acc" data-act="stkEdSave">Enregistrer</button></div>`);
  const sb = $("#sheetBody"); if (!sb.dataset.stkLp) { sb.dataset.stkLp = 1; stkLongPress(sb); }
}

/* ───────── fiche produit ───────── */
function stkProdSheet(p, isNew, presetZone) {
  const real = S.fridges.map((f) => (f.name || "").trim()).filter(Boolean);
  const zones = [...new Set([...stkZones(), ...real, stkRealZone("Chambre froide"), stkRealZone("Congélateur"), "Réserve sèche", "Cave", "Bar"])].sort((a, b) => stkZoneRank(a) - stkZoneRank(b) || a.localeCompare(b, "fr"));
  const units = unitsFor(STK_UNITS, p.unit);
  const sups = [...new Set([...S.products.map((x) => x.supplier), ...S.receptions.map((r) => r.supplier), ...S.lots.map((l) => l.supplier)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const zone = p.zone || presetZone || S.stkZone || zones[0]; const unit = p.unit || "kg";
  const E = !isNew ? stkEstimate(p) : null;
  S.ui.stkPA = { on: stkAl(p), open: false, fam: p.fam || null };
  const famG = stkFamGuess({ name: p.name || "" }); const fam = p.fam || famG;
  return `<div class="row"><div class="h2" style="font-size:21px">${isNew ? "Nouveau produit" : "Modifier le produit"}</div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="field"><span>Nom</span><input class="input" id="pName" value="${esc(p.name || "")}" placeholder="Ex. Beurre doux AOP" autocomplete="off" enterkeyhint="done" data-stkpn="1"></label>
    <div class="field"><span>Allergènes</span><div id="pAl">${stkPAHtml(p.name || "")}</div></div>
    <div class="field"><span>Zone</span><div class="chips stk-pick" data-k="zone">${zones.map((z) => `<button class="chip ${z === zone ? "on" : ""}" data-act="stkPick" data-v="${esc(z)}">${esc(z)}</button>`).join("")}<button class="chip stk-newz" data-act="stkNewZone">${ico("plus")}Autre</button></div><input class="input" id="pZone" value="${esc(zone)}" placeholder="Nom de la zone" hidden></div>
    <div class="field" id="pFamF" ${stkZoneKind(zone) === "sec" || stkZoneKind(zone) === "cave" ? "hidden" : ""}><span>Étagère au froid <em class="stk-opt">ordre HACCP, du haut vers le bas</em></span><div class="chips stk-famc" data-k="fam">${STK_FAM.map(([k, t], i) => `<button class="chip ${k === fam ? "on" : ""}" data-act="stkFamPick" data-v="${k}"><i class="stk-fn f-${k}">${i + 1}</i>${esc(t)}</button>`).join("")}</div></div>
    <div class="field"><span>Unité de comptage</span><div class="chips stk-pick" data-k="unit">${units.map((u) => `<button class="chip ${u === unit ? "on" : ""}" data-act="stkPick" data-v="${esc(u)}">${esc(u)}</button>`).join("")}<button class="chip unit-add" data-act="unitNew">${ico("plus")}Autre</button></div><input type="hidden" id="pUnit" value="${esc(unit)}"></div>
    <div class="grid2"><label class="field"><span>Prix d'achat <em class="stk-opt">€ / <span class="pUnitL">${esc(unit)}</span></em></span><input class="input mono" id="pPrice" inputmode="decimal" value="${p.price > 0 ? fmt(p.price, 2) : ""}" placeholder="Facultatif" autocomplete="off"></label>
      <label class="field"><span>Fournisseur</span><input class="input" id="pSup" list="stkSupList" value="${esc(p.supplier || "")}" placeholder="Facultatif" autocomplete="off"><datalist id="stkSupList">${sups.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label></div>
    <label class="field"><span>À commander sous <em class="stk-opt">seuil d'alerte, facultatif</em></span><div class="stk-inu"><input class="input mono" id="pMin" inputmode="decimal" value="${p.minQty > 0 ? stkN(p.minQty) : ""}" placeholder="Aucun seuil" autocomplete="off"><span class="pUnitL">${esc(unit)}</span></div></label>
    ${E ? `<div class="stk-adj"><div style="min-width:0"><span class="lbl">Stock théorique</span><div class="stk-adjv"><b class="mono" id="stkEst">${E.est != null ? stkN(Math.max(0, E.est)) : "–"}</b> <span>${esc(p.unit)}</span></div><em class="note">${E.last ? `Compté ${stkN(E.last.qty)} en ${stkMonthName(E.last.month)}` : "Jamais compté"}${E.recv ? ` · +${stkN(E.recv)} reçus` : ""}<span id="stkAdjL">${E.adj ? ` · ${stkSigned(E.adj)} mouvements` : ""}</span></em></div>
      <div class="cnt"><button data-act="stkAdj" data-id="${p.id}" data-v="-1" aria-label="Retirer">${ico("minus")}</button><button data-act="stkAdj" data-id="${p.id}" data-v="1" aria-label="Ajouter">${ico("plus")}</button></div></div>
      <div class="grid2 stk-pacts"><button class="btn danger" data-act="stkLoss" data-id="${p.id}">${ico("trash")}Perte / casse</button><button class="btn soft" data-act="stkMvOf" data-id="${p.id}">${ico("trend")}Historique</button></div>` : ""}
    ${isNew ? `<div class="grid2 stk-addb"><button class="btn soft" data-act="prodSave" data-v="more">Ajouter + autre</button><button class="btn acc" data-act="prodSave">Ajouter</button></div>`
    : `<button class="btn acc block" data-act="prodSave" data-id="${p.id}">Enregistrer</button><button class="btn ghost block stk-del" data-act="prodDel" data-id="${p.id}">${ico("trash")}Supprimer le produit</button>`}`;
}
/* allergen field: chosen chips + name-based suggestions (dashed, to confirm) + « Ajouter » that opens the 14 */
function stkPAHtml(nm) {
  const A = S.ui.stkPA || { on: [], open: false }; if (nm == null) nm = ($("#pName") || {}).value || ""; const sug = stkAlGuess(nm).filter((a) => !A.on.includes(a) && !(A.no || []).includes(a));
  const ids = A.open ? stkAlList().map((a) => a.id) : [...A.on, ...sug];
  const chip = (id) => { const on = A.on.includes(id), sg = sug.includes(id); return `<button class="stk-alc ${on ? "on" : ""} ${sg ? "sug" : ""}" data-act="stkAlTog" data-v="${id}" aria-pressed="${on}" ${sg ? `title="Suggéré d'après le nom"` : ""}>${ico(on ? "check" : sg ? "sparkle" : "plus")}${esc(stkAlT(id))}</button>`; };
  return `<div class="stk-alw">${ids.map(chip).join("")}${!A.on.length && !sug.length && !A.open ? `<span class="stk-alnone">Aucun allergène</span>` : ""}${!A.open ? `<button class="stk-alc more" data-act="stkAlMore">${ico("plus")}${A.on.length || sug.length ? "Autres" : "Ajouter"}</button>` : ""}</div>
    ${sug.length ? `<div class="stk-alsug">${ico("sparkle")}<span>Suggéré d'après le nom : <b>${esc(sug.map(stkAlT).join(", "))}</b></span><button class="btn soft sm" data-act="stkAlOk">Confirmer</button></div>` : ""}`;
}
function stkProdOpen(id, presetZone, presetName) {
  const p = S.products.find((x) => x.id === id); stkAdjFlush(); S.ui.stkEd = null;
  openSheet(stkProdSheet(p || { name: presetName || "" }, !p, presetZone), (b) => { const fc = $(".stk-famc .chip.on", b); if (fc && fc.previousElementSibling) fc.parentElement.scrollLeft = fc.offsetLeft - 20; if (!p) setTimeout(() => { const i = $("#pName", b); i && i.focus(); }, 380); });
}
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && ["pName", "pPrice", "pSup", "pZone"].includes(e.target.id) && $("#sheet").classList.contains("open")) { e.preventDefault(); const b = $('#sheetBody [data-act="prodSave"]:not([data-v])'); b && b.click(); } });
function stkAdjFlush() {
  const A = S.ui.stkAdj; if (!A) return; clearTimeout(A.t); S.ui.stkAdj = null; if (!A.delta) return;
  const p = S.products.find((x) => x.id === A.pid);
  stockMove({ productId: A.pid, qty: A.delta, kind: "correction", reason: "Ajustement rapide" }).then((id) => { S.ui.undo = { col: "moves", id, evId: STK_EV[id] }; toastUndo(`${p ? p.name : "Stock"} : ${stkSigned(A.delta)} ${p ? p.unit : ""}`); }).catch(() => SFX.err());
}
/* name typed in the product sheet → allergen suggestions and HACCP shelf guess follow */
const stkPNameSync = debounce(() => {
  const el = $("#pAl"); if (el && S.ui.stkPA) el.innerHTML = stkPAHtml(($("#pName") || {}).value || "");
  const A = S.ui.stkPA; const f = $("#pFamF"); if (f && A && !A.fam) { const g = stkFamGuess({ name: ($("#pName") || {}).value || "" }); $$(".chip", f).forEach((c) => c.classList.toggle("on", c.dataset.v === g)); }
}, 250);
document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.stkpn) stkPNameSync(); });

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
  const groups = STK_STARTER.map(([z, L]) => [z, L.filter(([nm]) => !have.has(nm.toLowerCase()))]).filter(([, L]) => L.length);
  const all = STK_STARTER.reduce((a, [, L]) => a + L.length, 0), got = all - groups.reduce((a, [, L]) => a + L.length, 0);
  if (!groups.length) return `<div class="stk-stdone"><span class="check draw"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><div class="h2" style="font-size:21px">Tout est déjà là</div><p class="sub">Les ${all} produits de la liste type sont dans votre catalogue.</p><button class="btn acc block" data-act="sheetClose">Fermer</button></div>`;
  return `<div class="row"><div><div class="h2" style="font-size:21px">Liste type bistro</div><span class="sub">${got ? `${got} produits déjà dans votre catalogue. ` : ""}Décochez ce que vous n'avez pas.${got ? "" : " Ajoutez vos prix ensuite."}</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="stk-stl">${groups.map(([z, L]) => `<div><span class="lbl">${esc(z)}</span><div class="stk-stg">${L.map(([nm, u]) => { const h = have.has(nm.toLowerCase()); const off = h || S.ui.stkSt[nm]; return `<button class="stk-st ${off ? "" : "on"} ${h ? "have" : ""}" data-act="stkStToggle" data-v="${esc(nm)}" ${h ? "disabled" : ""} aria-pressed="${!off}"><i>${ico("check")}</i><span>${esc(nm)}</span><em>${h ? "déjà là" : esc(u)}</em></button>`; }).join("")}</div></div>`).join("")}</div>
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
  stkCmClose: () => { const C = S.ui.stkCm; const done = C && C.i >= C.list.length; stkCmClose(); if (C && !done && invProgress().n < S.products.length) toast("Comptage en pause", "info"); },
  stkKey: (a, id, v) => stkKey(id, v),
  stkSame: () => { const C = S.ui.stkCm; if (!C) return; const pc = countOf(C.list[C.i], stkShift(C.month, -1)); if (pc == null) return; C.buf = stkN(pc); C.typed = true; const d = $("#stkVal"); $(".n", d).innerHTML = stkBufHtml(C.buf); const u = $(".u", d); if (u && u.dataset.u) u.textContent = stkU(pc, u.dataset.u); d.classList.remove("empty", "bump"); void d.offsetWidth; d.classList.add("bump"); SFX.tap(); buzz(5); stkSessSave(); },
  stkNext: async () => {
    const C = S.ui.stkCm; if (!C || C.busy || C.i >= C.list.length || Date.now() < (C.lock || 0)) return;
    if (stkCmOdd(C)) return; C.busy = true;
    const ok = await stkCmCommit(); C.busy = false;
    if (!ok) { stkShake($("#stkVal")); SFX.err(); buzz([8, 30, 8]); return; }
    SFX.ok(); buzz(6); stkCmGo(1);
  },
  stkSkip: () => { const C = S.ui.stkCm; if (!C || C.i >= C.list.length || Date.now() < (C.lock || 0)) return; SFX.tap(); stkCmGo(1); },
  stkPrev: () => { const C = S.ui.stkCm; if (!C || C.i === 0 || Date.now() < (C.lock || 0)) return; SFX.tap(); stkCmGo(-1); },
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
  stkPick: (a, id, v) => { const wrap = a.closest(".stk-pick"); $$(".chip", wrap).forEach((c) => c.classList.toggle("on", c === a)); if (wrap.dataset.k === "zone") { const z = $("#pZone"); z.value = v; z.hidden = true; const f = $("#pFamF"); if (f) f.hidden = ["sec", "cave"].includes(stkZoneKind(v)); } else { $("#pUnit").value = v; $$(".pUnitL").forEach((e) => { e.textContent = v; }); } SFX.tick(); },
  stkNewZone: (a) => { const wrap = a.closest(".stk-pick"); $$(".chip", wrap).forEach((c) => c.classList.toggle("on", c === a)); const z = $("#pZone"); z.hidden = false; z.value = ""; z.focus(); SFX.tick(); },
  prodSave: async (a, id, v) => {
    const name = $("#pName").value.trim(); if (!name) { stkShake($("#pName")); $("#pName").focus(); SFX.err(); return; }
    const unit = $("#pUnit").value || "kg"; const old = S.products.find((x) => x.id === id);
    const pr = num($("#pPrice").value);
    const mq = num(($("#pMin") || {}).value); const A = S.ui.stkPA || { on: [] }; const famOn = $("#pFamF .chip.on");
    const fam = A.fam && famOn ? famOn.dataset.v : old && old.fam ? old.fam : null;
    const d = { name, unit, zone: $("#pZone").value.trim() || "Autre", price: pr != null && pr > 0 ? pr : null, supplier: $("#pSup").value.trim(), step: old && old.unit === unit && old.step ? old.step : stkDefStep(unit), allergens: A.on.slice(), alChecked: true, fam: fam && fam !== stkFamGuess({ name }) ? fam : null, minQty: mq != null && mq > 0 ? mq : null };
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
    const E = stkEstimate(p); const el = $("#stkEst"); if (el) { el.textContent = E.est != null ? stkN(Math.max(0, E.est)) : "–"; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    const l = $("#stkAdjL"); if (l) l.textContent = E.adj ? ` · ${stkSigned(E.adj)} ajusté` : ""; SFX.tick(); buzz(4);
  },
  stkStarter: () => { SFX.tap(); S.ui.stkSt = {}; openSheet(stkStarterSheet()); },
  stkRecv: () => { SFX.tap(); S.ui.stkRv = {}; openSheet(stkRecvSheet()); },
  stkRvToggle: (a, id, v) => { const off = (S.ui.stkRv ||= {}); off[v] = !off[v]; a.classList.toggle("on", !off[v]); a.setAttribute("aria-pressed", String(!off[v])); SFX.tick(); const n = stkRecvSuggest().filter((x) => !off[x.k]).length; const b = $('[data-act="stkRvAdd"]'); if (b) { b.textContent = `Ajouter ${n} produit${n > 1 ? "s" : ""}`; b.disabled = !n; } },
  stkRvAdd: async (a) => {
    if (a.disabled) return; a.disabled = true; const off = S.ui.stkRv || {}; const L = stkRecvSuggest(); let n = 0; const now = Date.now();
    try { for (const x of L) { if (off[x.k]) continue; const unit = x.unit || "kg"; await DB.add("products", { name: x.name, unit, zone: x.zone || "Autre", step: stkDefStep(unit), price: null, supplier: x.supplier || "", createdAt: now + n, fromReception: true }); n++; } }
    catch (e) { SFX.err(); toast("Impossible d'ajouter les produits.", "err"); a.disabled = false; return; }
    stkIgnore(L.filter((x) => off[x.k]).map((x) => x.k));
    closeSheet(true); SFX.done(); burst(); toast(`${n} produit${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} au catalogue`); S.ui.stkRv = null; setTimeout(rerender, 80);
  },
  prodStarter: () => ACT.stkStarter(),
  stkStToggle: (a, id, v) => { S.ui.stkSt[v] = !S.ui.stkSt[v]; a.classList.toggle("on", !S.ui.stkSt[v]); a.setAttribute("aria-pressed", String(!S.ui.stkSt[v])); SFX.tick(); const n = stkStarterCount(); const b = $('[data-act="stkStAdd"]'); b.textContent = `Ajouter ${n} produit${n > 1 ? "s" : ""}`; b.disabled = !n; },
  stkStAdd: async (a) => {
    if (a.disabled) return; a.disabled = true; const have = new Set(S.products.map((p) => p.name.toLowerCase())); let n = 0; const now = Date.now();
    try { for (const [zone, L] of STK_STARTER) for (const [name, unit] of L) { if (have.has(name.toLowerCase()) || S.ui.stkSt[name]) continue; await DB.add("products", { name, unit, zone: stkRealZone(zone), step: stkDefStep(unit), price: null, supplier: "", createdAt: now + n }); n++; } } catch (e) { SFX.err(); toast("Impossible d'ajouter la liste.", "err"); a.disabled = false; return; }
    closeSheet(true); SFX.done(); burst(); toast(`${n} produits ajoutés`); setTimeout(rerender, 80);
  },
  exportInv: async () => {
    const m = S.stkMonth || monthKey(); const D = stkMonthData(m); const byId = {}; D.rows.forEach((r) => { byId[r.p.id] = r; });
    const tx = (v) => { const t = String(v || ""); return /^[=+\-@]/.test(t) ? "'" + t : t; };
    const head = ["Zone", "Produit", "Unité", "Fournisseur", "Prix d'achat (€)", `Stock ${monthLabel(D.pm)}`, `Stock ${monthLabel(m)}`, "Écart", "Consommé (qté)", "Consommé (€)", "Valeur du stock (€)"];
    const rows = [head].concat(stkSorted().map((p) => { const r = byId[p.id]; const pr = p.price > 0 ? p.price : 0; return [tx(stkZoneOf(p)), tx(p.name), p.unit, tx(p.supplier), pr ? stkN(stkR2(pr)) : "", r.pc != null ? stkN(r.pc) : "", r.c != null ? stkN(r.c) : "", r.d != null ? stkN(r.d) : "", r.used != null ? stkN(r.used) : "", r.used != null && pr ? stkN(stkR2(Math.max(0, r.used) * pr)) : "", r.val != null ? stkN(stkR2(r.val)) : ""]; }));
    rows.push([], ["Total", `${D.n}/${D.total} comptés`, "", "", "", "", "", "", "", D.used ? stkN(stkR2(D.used)) : "", stkN(stkR2(D.value))]);
    await stkDownload(`inventaire-${m}.csv`, rows);
  },
});

/* ───────── actions V3 : allergènes, mouvements, pertes, rangement, à commander ───────── */
Object.assign(ACT, {
  stkAlTog: (a, id, v) => {
    const A = S.ui.stkPA; if (!A) return; const i = A.on.indexOf(v);
    if (i >= 0) { A.on.splice(i, 1); (A.no ||= []).push(v); } else { A.on.push(v); A.no = (A.no || []).filter((x) => x !== v); }
    $("#pAl").innerHTML = stkPAHtml(); SFX.tick(); buzz(3);
    const b = $(`#pAl [data-v="${v}"]`); if (b && b.animate) b.animate([{ transform: "scale(.85)" }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.34,1.56,.64,1)" });
  },
  stkAlOk: () => { const A = S.ui.stkPA; if (!A) return; const sug = stkAlGuess(($("#pName") || {}).value || "").filter((x) => !A.on.includes(x) && !(A.no || []).includes(x)); A.on.push(...sug); $("#pAl").innerHTML = stkPAHtml(); SFX.ok(); buzz(5); },
  stkAlMore: () => { const A = S.ui.stkPA; if (!A) return; A.open = true; $("#pAl").innerHTML = stkPAHtml(); SFX.tick(); },
  stkFamPick: (a, id, v) => { const A = S.ui.stkPA; if (A) A.fam = v; $$("#pFamF .chip").forEach((c) => c.classList.toggle("on", c === a)); SFX.tick(); },
  stkAlReview: () => { SFX.tap(); S.ui.stkAlR = {}; openSheet(stkAlReviewSheet()); },
  stkAlRT: (a, id, v) => { const off = (S.ui.stkAlR ||= {}); off[v] = !off[v]; a.classList.toggle("on", !off[v]); a.setAttribute("aria-pressed", String(!off[v])); SFX.tick(); },
  stkAlRSave: async (a) => {
    if (a.disabled) return; a.disabled = true; const off = S.ui.stkAlR || {}; const L = stkAlTodo(); let n = 0;
    try { for (const p of L) { const al = stkAlGuess(p.name).filter((x) => !off[p.id + ":" + x]); await DB.update("products", p.id, { allergens: al, alChecked: true }); if (al.length) n++; } } catch (e) { a.disabled = false; SFX.err(); toast("Impossible d'enregistrer.", "err"); return; }
    closeSheet(true); SFX.done(); burst(); toast(`${L.length} produit${L.length > 1 ? "s" : ""} vérifié${L.length > 1 ? "s" : ""}${n ? ` · ${n} avec allergènes` : ""}`); S.ui.stkAlR = null;
  },
  stkAck: (a, id, v) => { const c = stkConflict(v); if (!c) return; const o = stkLS(STK_ACK) || {}; (o[S.rid] ||= {})[v] = c.sig; stkLS(STK_ACK, o); SFX.ok(); buzz(5); const box = a.closest(".stk-cf"); if (box && box.animate) { const an = box.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.96)" }], { duration: 220, easing: "ease-in", fill: "forwards" }); an.onfinish = () => rerender(); } else rerender(); },
  stkPlanGo: (a, id, v) => { S.stockTab = "plan"; SFX.tap(); rerender(); setTimeout(() => { const el = $$(".stk-plan").find((x) => x.dataset.zone === v); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 120); },
  stkMvF: (a, id, v) => { S.stkMvF = v === "all" ? null : v; S.ui.stkMvLim = 0; SFX.tick(); rerender(); },
  stkMvP: () => { S.stkMvP = null; SFX.tick(); rerender(); },
  stkMvOf: (a, id) => { stkAdjFlush(); closeSheet(true); S.stkMvP = id; S.stkMvF = null; S.stockTab = "mv"; SFX.tap(); if (S.route !== "stock") go("stock"); else rerender(); },
  stkMvMore: () => { S.ui.stkMvLim = (S.ui.stkMvLim || 60) + 100; SFX.tap(); rerender(); },
  stkMvOpen: (a, id, v) => { const h = stkMvSheet(id, v); if (!h) return; SFX.tap(); openSheet(h); },
  stkMvDel: async (a, id, v) => {
    if (!a.dataset.sure) { a.dataset.sure = 1; a.classList.add("sure"); a.innerHTML = `${ico("trash")}Touchez encore pour supprimer`; buzz(6); return; }
    try { await safe(DB.del(v, id)); } catch (e) { return; }
    const ev = STK_EV[id] || (S.events.find((e) => e.ref === id && e.type === "stock") || {}).id; if (ev) DB.del("events", ev).catch(() => {});
    closeSheet(true); SFX.close(); toast("Mouvement supprimé");
  },
  stkLoss: (a, id) => { stkAdjFlush(); SFX.tap(); stkLsOpen("perte", id); },
  stkFix: (a, id) => { stkAdjFlush(); SFX.tap(); stkLsOpen("correction", id); },
  stkLsPick: (a, id) => { const L = S.ui.stkLs; if (!L) return; L.pid = id; L.buf = ""; L.typed = false; SFX.tap(); $("#sheetBody").innerHTML = stkLsHtml(); },
  stkLsBack: () => { const L = S.ui.stkLs; if (!L) return; L.pid = null; SFX.tap(); $("#sheetBody").innerHTML = stkLsHtml(); setTimeout(() => { const q = $("#stkLsQ"); q && !window.matchMedia("(pointer:coarse)").matches && q.focus(); }, 40); },
  stkLsReason: (a, id, v) => { const L = S.ui.stkLs; if (!L) return; L.reason = v; $$(".stk-rsn .chip").forEach((c) => c.classList.toggle("on", c === a)); SFX.tick(); },
  stkLsSave: async () => {
    const L = S.ui.stkLs; if (!L || L.busy) return; const p = S.products.find((x) => x.id === L.pid); if (!p) return;
    const v = L.buf === "" ? null : num(L.buf); const loss = L.kind === "perte";
    if (v == null || (loss && v <= 0)) { stkShake($("#stkLsVal")); SFX.err(); buzz([8, 30, 8]); return; }
    const lv = stkLevelAt(p).level; const qty = loss ? -v : stkR3(v - (lv || 0));
    if (!loss && qty === 0) { closeSheet(true); S.ui.stkLs = null; SFX.ok(); toast(`${p.name} : le stock était déjà juste`); return; }
    L.busy = true; let id;
    try { id = await safe(stockMove(loss ? { productId: p.id, qty, kind: "perte", reason: L.reason || "Autre", value: p.price > 0 ? stkR2(v * p.price) : undefined } : { productId: p.id, qty, kind: "correction", reason: `Recompté : ${stkN(v)} ${stkU(v, p.unit)}`, counted: v })); } catch (e) { L.busy = false; return; }
    closeSheet(true); S.ui.stkLs = null; SFX.ok(); buzz(loss ? [8, 30, 8] : 6);
    S.ui.undo = { col: "moves", id, evId: STK_EV[id] };
    toastUndo(loss ? `Perte : ${stkN(v)} ${stkU(v, p.unit)} de ${p.name}${p.price > 0 ? ` (${stkEur(v * p.price, 2)})` : ""}` : `${p.name} : stock corrigé à ${stkN(v)} ${stkU(v, p.unit)}`);
  },
  stkLowOpen: () => { SFX.tap(); openSheet(stkLowSheet()); },
  stkLowCopy: async () => {
    const L = stockLow(); const by = {}; L.forEach((x) => { (by[x.supplier || "Sans fournisseur"] ||= []).push(x); });
    const txt = `À commander · ${S.resto ? S.resto.name : ""} · ${shortDate(dayKey())}\n` + Object.entries(by).map(([s, xs]) => `\n${s}\n` + xs.map((x) => { const p = S.products.find((y) => y.id === x.id); const st = (p && p.step) || stkDefStep(x.unit); const q = Math.max(st, Math.ceil((x.min * 2 - Math.max(0, x.level)) / st) * st); return `- ${x.name} : ${stkN(q)} ${stkU(q, x.unit)}`; }).join("\n")).join("\n");
    try { await navigator.clipboard.writeText(txt); SFX.ok(); toast("Liste copiée"); } catch (e) { try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e2) { return; } toast("Copie impossible sur cet appareil.", "err"); }
  },
});
