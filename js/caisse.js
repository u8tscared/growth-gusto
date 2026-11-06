/* Growth Gusto — area: caisse (« Caisse connectée » : les ventes de la caisse arrivent seules → chiffre du jour, stock déduit). Prefix « cx ».
   Modèle (tout sous restos/{rid}/) :
   - caisse/{provider}  = { provider, mode:"api"|"csv", status:"connected"|"error"|"off", merchant?, connectedAt?, lastSync?, lastError?, lastImport?, file?, active? }
                          écrit par le serveur (functions/src/caisse.js) pour les connexions directes, par l'app pour les imports de fichiers.
   - sales/{id}         = { provider, source:"api"|"csv"|"demo", extId?, at, day:"AAAA-MM-JJ", total (TTC €), ht?, count? (nombre de notes), items:[{name, qty, amount?}], payment? }
                          une vente (connexion directe) ou un jour entier (import de fichier).
   - posMap/{k_…}       = { key, label, kind:"recipe", noteId, per (portions de la fiche pour 1 vendu), at, uid } : article de caisse → fiche recette.
                          Article → produit du stock : on réutilise tkLinks (js/tickets.js), « hors stock » aussi (tkLinks ignore).
   Chaque jour de ventes devient un ticket Z « tickets/pos_{provider}_{jour} » (source:"caisse", recipeStock:true) : salesBetween() le compte
   (Finances, Tableau de bord), et tkSyncStock() (js/tickets.js) déduit le stock : produits liés + ingrédients des fiches recettes reliées.
   Connexion directe : active quand S.resto.server.caisse est vrai (serveur déployé) ; sinon l'import CSV / Excel fait tout, dès aujourd'hui. */
TAB_OF.caisse = "more"; TAB_OF.caisseMap = "more";
Object.assign(IC, {
  cxPlug: ["f:M7 9h10v3a5 5 0 0 1-10 0z", "M9 3v5", "M15 3v5", "M6.5 8.5h11V12a5.5 5.5 0 0 1-11 0z", "M12 17.5V21"],
  cxSync: ["M20 11a8 8 0 0 0-14.3-4.9L4 8", "M4 3.5V8h4.5", "M4 13a8 8 0 0 0 14.3 4.9L20 16", "M20 20.5V16h-4.5"],
  cxFile: ["f:M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M14 3v5h5", "M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M8.5 13h7", "M8.5 16.5h5"],
  cxKey: ["c:8,15,4", "M11 12l8.5-8.5", "M16 7l2.5 2.5", "M14 9l2 2"],
  cxBolt: ["f:M13.5 2.75 5.25 13.5h6l-1.25 7.75 8.75-11h-6.25z", "M13.5 2.75 5.25 13.5h6l-1.25 7.75 8.75-11h-6.25z"],
});

/* ───────── les caisses ───────── */
const CX_EXPORT = "Rapports (ou Statistiques) → ventes par article → Exporter en CSV ou Excel.";
const CX_POS = [
  { id: "sumup", name: "SumUp", kind: "oauth", well: "w-vi", rec: true, need: "Votre identifiant SumUp, rien d'autre.",
    steps: ["Touchez « Connecter SumUp ».", "Identifiez-vous et acceptez l'accès aux ventes.", "C'est fait : les ventes arrivent toutes les 15 min."], csv: "Dans SumUp : Ventes → Exporter (CSV ou Excel)." },
  { id: "zelty", name: "Zelty", kind: "key", well: "w-sa", need: "Une clé API Zelty (back-office).",
    steps: ["Back-office Zelty → Paramètres → API.", "Créez une clé et copiez-la.", "Collez-la ici : c'est connecté."], csv: "Dans Zelty : " + CX_EXPORT },
  { id: "lightspeed", name: "Lightspeed", sub: "K-Series", kind: "oauth", well: "w-sk", need: "Votre compte Lightspeed Restaurant.",
    steps: ["Touchez « Connecter Lightspeed ».", "Identifiez-vous et choisissez l'établissement.", "Les ventes arrivent toutes les 15 min."], csv: "Dans Lightspeed : " + CX_EXPORT },
  { id: "tiller", name: "Tiller", sub: "SumUp POS Pro", kind: "csv", well: "w-to", need: "Un export des ventes depuis le back-office.",
    steps: ["Back-office Tiller → Rapports.", "Exportez les ventes par produit (CSV ou Excel).", "Importez le fichier ici."], csv: "Dans Tiller : " + CX_EXPORT },
  { id: "square", name: "Square", kind: "oauth", well: "w-in", need: "Votre compte Square.",
    steps: ["Touchez « Connecter Square ».", "Identifiez-vous et autorisez la lecture des ventes.", "Les ventes arrivent toutes les 15 min."], csv: "Dans Square : Rapports → Ventes par article → Exporter." },
  { id: "innovorder", name: "Innovorder", kind: "csv", well: "w-vi", need: "Un export des ventes depuis le back-office.",
    steps: ["Back-office Innovorder → Statistiques.", "Exportez les ventes par produit.", "Importez le fichier ici."], csv: "Dans Innovorder : " + CX_EXPORT },
  { id: "laddition", name: "L'Addition", kind: "csv", well: "w-sa", need: "Un export des ventes depuis le back-office.",
    steps: ["Back-office L'Addition → Statistiques.", "Exportez les ventes par produit.", "Importez le fichier ici."], csv: "Dans L'Addition : " + CX_EXPORT },
  { id: "popina", name: "Popina", kind: "csv", well: "w-sk", need: "Un export des ventes depuis le back-office.",
    steps: ["Back-office Popina → Rapports.", "Exportez les ventes par produit.", "Importez le fichier ici."], csv: "Dans Popina : " + CX_EXPORT },
  { id: "autre", name: "Autre caisse", kind: "csv", well: "w-to", need: "Un export des ventes, CSV ou Excel.",
    steps: ["Exportez les ventes depuis votre caisse.", "Importez le fichier ici.", "Vérifiez les colonnes : c'est fait."], csv: "Cherchez « Export » dans les rapports de votre caisse." },
];
const cxPos = (id) => CX_POS.find((p) => p.id === id) || CX_POS[CX_POS.length - 1];
const cxMono = (p) => (p.id === "laddition" ? "LA" : p.id === "autre" ? "" : p.name.charAt(0));
const cxWell = (p, cls = "") => { const lg = brandLogo(p.id); return lg ? `<span class="cx-mono logo ${cls}">${lg}</span>` : `<span class="cx-mono ${p.well} ${cls}">${p.id === "autre" ? ico("receipt") : esc(cxMono(p))}</span>`; };
const CX_API = "https://europe-west9-growth-gusto.cloudfunctions.net/caisseApi";

/* ───────── helpers ───────── */
const cxNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const cxKey = (s) => (typeof tkKey === "function" ? tkKey(s) : cxNorm(s));
const cxLinkId = (k) => "k_" + String(k).replace(/[^a-z0-9]+/g, "_").slice(0, 90);
const cxEur = (v, d = 2) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const cxN = (v, d = 1) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d }));
const cxPl = (n, w, p) => `${cxN(n)} ${Math.abs(n) >= 2 ? p || w + "s" : w}`;
const cxR2 = (v) => Math.round(v * 100) / 100;
function cxNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[\s  €$£]/g, "").replace(/^\((.*)\)$/, "-$1"); if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); else s = s.replace(",", ".");
  const n = parseFloat(s); return isNaN(n) ? null : n;
}
function cxAgo(ts) {
  if (!ts) return "jamais"; const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; if (m < 24 * 60 && dayKey(new Date(ts)) === dayKey()) return `à ${hm(ts)}`; return when(ts);
}
const cxIsAdmin = () => { try { return DB.mode === "demo" || typeof PERMS === "undefined" || PERMS.isAdmin(); } catch (e) { return true; } };
const cxCanWrite = () => { try { return DB.mode === "demo" || typeof PERMS === "undefined" || PERMS.can("tickets") !== false; } catch (e) { return true; } };
const cxServerOn = () => !!((S.resto && S.resto.server && S.resto.server.caisse) || (window.GG_SERVER && window.GG_SERVER.caisse));
const cxLive = () => cxServerOn() && DB.mode === "db";

/* ───────── abonnements ───────── */
let cxRid = null;
S.cxSales = S.cxSales || []; S.cxStat = S.cxStat || []; S.cxMap = S.cxMap || [];
const cxRe = () => { if (S.route === "caisse" || S.route === "caisseMap") refresh(); };
const cxCbS = (rows) => { S.cxSales = rows; cxRoll(); cxRe(); };
const cxCbC = (rows) => { S.cxStat = rows; cxRe(); };
const cxCbM = (rows) => { S.cxMap = rows; cxRoll(); cxRe(); };
function cxEnsure() {
  if (!S.rid || !S.resto) return;
  if (typeof tkEnsure === "function") tkEnsure();
  if (cxRid === S.rid && DB.mode !== "db" && !(DB.listeners[DB.path("sales")] || []).includes(cxCbS)) cxRid = null;
  if (cxRid === S.rid) return; cxRid = S.rid; S.cxSales = []; S.cxStat = []; S.cxMap = [];
  if (DB.mode === "demo") cxDemoSeed();
  DB.watch("sales", { order: "at", dir: "desc", limit: 4000 }, cxCbS);
  DB.watch("caisse", {}, cxCbC);
  DB.watch("posMap", {}, cxCbM);
}
setInterval(() => { try { if (S.ready && S.resto) { cxEnsure(); cxRoll(); } } catch (e) {} }, 20000);
window.addEventListener("gg:ready", () => setTimeout(() => { try { cxEnsure(); cxReturn(); } catch (e) { console.warn(e); } }, 400));

const cxActive = () => [...S.cxStat].filter((c) => c.status !== "off" && (c.mode === "csv" ? c.lastImport : true)).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (b.lastSync || b.lastImport || b.connectedAt || 0) - (a.lastSync || a.lastImport || a.connectedAt || 0))[0] || null;
const cxStatOf = (id) => S.cxStat.find((c) => c.id === id || c.provider === id) || null;
const cxSalesOf = (day, prov) => S.cxSales.filter((s) => s.day === day && (!prov || s.provider === prov) && s.status !== "refunded" && s.status !== "failed");

/* ───────── article mapping ───────── */
const cxMapOf = (key) => S.cxMap.find((m) => m.key === key) || null;
const cxRecipes = () => S.notes.filter((n) => (n.cat || "") === "Recettes" && (n.title || "").trim());
const cxStop = new Set(["de", "du", "la", "le", "les", "des", "l", "d", "a", "au", "aux", "en", "et", "avec", "sans", "maison", "the", "un", "une", "x"]);
const cxToks = (s) => cxKey(s).split(" ").filter((w) => w && !cxStop.has(w) && !/^x?\d+$/.test(w));
function cxSim(a, b) {
  const A = cxToks(a), B = cxToks(b); if (!A.length || !B.length) return 0; let hit = 0;
  A.forEach((w) => { if (B.includes(w)) hit += 1; else if (w.length >= 4 && B.some((x) => x.length >= 4 && (x.startsWith(w.slice(0, 4)) || w.startsWith(x.slice(0, 4))))) hit += 0.7; });
  return (2 * hit) / (A.length + B.length);
}
/* best candidates (recipes first on a tie), each {t:"r"|"p", id, name, s} */
function cxCands(label, n = 3) {
  const out = [];
  cxRecipes().forEach((r) => out.push({ t: "r", id: r.id, name: r.title.trim(), s: cxSim(label, r.title) + 0.02 }));
  S.products.forEach((p) => out.push({ t: "p", id: p.id, name: p.name, s: cxSim(label, p.name) }));
  return out.filter((x) => x.s >= 0.34).sort((a, b) => b.s - a.s).slice(0, n);
}
/* « Croquettes x5 », « (6) », « par 5 » → 5 portions de la fiche pour 1 vendu */
const cxPerGuess = (label) => { const m = cxNorm(label).match(/(?:^|\s)(?:x\s?|par\s)(\d{1,2})(?:\s|$)|\b(\d{1,2})\s?(?:pcs|pieces|p)\b/); const v = m ? +(m[1] || m[2]) : 1; return v >= 1 && v <= 50 ? v : 1; };
/* état d'un article : produit (tkLinks), hors stock, fiche (posMap ou même nom), suggestion, à relier */
function cxState(label) {
  const key = cxKey(label); const ln = (S.tkLinks || []).find((x) => x.key === key);
  if (ln && ln.ignore) return { st: "off", key };
  const p = ln && S.products.find((x) => x.id === ln.productId); if (p) return { st: "prod", key, p, ln };
  const m = cxMapOf(key); const r = m && S.notes.find((n) => n.id === m.noteId);
  if (r) return { st: "rec", key, r, per: num(m.per) || 1, m };
  const auto = typeof tkRecipeFor === "function" ? tkRecipeFor({ libelle: label }) : null;
  if (auto) return { st: "rec", key, r: auto, per: 1, auto: true };
  const c = cxCands(label, 1)[0]; return c ? { st: "sug", key, c } : { st: "todo", key };
}
const cxRecLinked = (r) => (r.ingredients || []).filter((g) => g.productId && S.products.some((p) => p.id === g.productId)).length;
/* distinct articles sold over N days, most sold first */
function cxArticles(days = 30) {
  const from = addDays(dayKey(), -(days - 1)); const m = new Map();
  S.cxSales.filter((s) => (s.day || "") >= from && s.status !== "refunded").forEach((s) => (s.items || []).forEach((it) => {
    const k = cxKey(it.name); if (!k) return; const e = m.get(k) || { label: String(it.name).trim(), q: 0, amt: 0 }; e.q += num(it.qty) || 0; e.amt += num(it.amount) || 0; m.set(k, e);
  }));
  return [...m.values()].sort((a, b) => b.q - a.q).map((a) => ({ ...a, ...cxState(a.label) }));
}

/* ───────── ventes → ticket Z du jour (réutilise js/tickets.js) ───────── */
let cxRolling = false, cxRollAgain = false;
const cxRoll = debounce(() => cxRollNow().catch((e) => console.warn("caisse", e)), 700);
function cxHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function cxDayTicket(prov, day) {
  const list = cxSalesOf(day, prov); if (!list.length) return null;
  const L = new Map(); let total = 0, ht = 0, htAll = true, n = 0, last = 0;
  list.forEach((s) => {
    total += num(s.total) || 0; if (num(s.ht) != null) ht += num(s.ht); else htAll = false; n += num(s.count) || 1; last = Math.max(last, s.at || 0);
    (s.items || []).forEach((it) => { const k = cxKey(it.name); const q = num(it.qty) || 0; if (!k || !q) return; const e = L.get(k) || { libelle: String(it.name).trim(), quantite: 0, montant: 0, hasM: false }; e.quantite += q; if (num(it.amount) != null) { e.montant += num(it.amount); e.hasM = true; } L.set(k, e); });
  });
  const lines = [...L.entries()].map(([k, e]) => {
    const o = { libelle: e.libelle, quantite: cxR2(e.quantite), montant: e.hasM ? cxR2(e.montant) : null };
    const m = cxMapOf(k); if (m && m.noteId) { o.noteId = m.noteId; o.per = num(m.per) || 1; }
    return o;
  }).sort((a, b) => b.quantite - a.quantite);
  return { date: day, total: cxR2(total), ht: htAll ? cxR2(ht) : null, vat: [], covers: null, lines, source: "caisse", provider: prov, nbTickets: n, recipeStock: true, at: last || Date.now(), photoIds: [], photoUrls: [], photos: [] };
}
/* everything the deduction depends on: the day's lines, the article links, the linked recipes */
function cxSig(t) {
  const keys = t.lines.map((l) => cxKey(l.libelle));
  const lk = (S.tkLinks || []).filter((x) => keys.includes(x.key)).map((x) => `${x.key}:${x.productId || ""}:${x.factor || ""}:${x.ignore ? 1 : 0}`).sort().join(",");
  const rs = t.lines.map((l) => { const r = typeof tkRecipeFor === "function" ? tkRecipeFor(l) : null; return r ? `${r.id}:${r.updatedAt || r.at || 0}` : ""; }).join(",");
  return cxHash(JSON.stringify([t.total, t.ht, t.nbTickets, t.lines, lk, rs, S.products.length]));
}
async function cxRollNow() {
  if (!S.rid || !S.resto || !S.ready || !cxCanWrite() || typeof tkSyncStock !== "function") return;
  if (cxRolling) { cxRollAgain = true; return; }
  if (document.visibilityState === "hidden" && DB.mode === "db") return;
  cxRolling = true;
  try {
    const from = addDays(dayKey(), -13); const groups = new Set();
    S.cxSales.forEach((s) => { if (s.day && s.day >= from && s.provider) groups.add(s.provider + "|" + s.day); });
    const all = typeof tkAllTickets === "function" ? tkAllTickets() : S.tickets;
    for (const g of groups) {
      const [prov, day] = g.split("|"); const t = cxDayTicket(prov, day); if (!t) continue;
      const id = `pos_${prov}_${day}`; const sig = cxSig(t); const ex = all.find((x) => x.id === id) || S.tickets.find((x) => x.id === id);
      if (ex && ex.posHash === sig) continue;
      const doc = { ...t, posHash: sig, uid: (ex && ex.uid) || S.me.id, updatedAt: Date.now(), ...(ex && ex.stockOff ? { stockOff: true } : {}) };
      try { await DB.set("tickets", id, doc); } catch (e) { console.warn(e); continue; }
      if (!ex) logEvent("ticket", `a reçu les ventes de la caisse du ${shortDate(day)}${doc.total ? ` · ${cxEur(doc.total)}` : ""}`, { ref: id });
      await tkSyncStock({ ...doc, id });
    }
  } finally { cxRolling = false; if (cxRollAgain) { cxRollAgain = false; cxRoll(); } }
}

/* ───────── serveur (connexion directe) ───────── */
async function cxCall(op, body = {}) {
  const u = typeof firebase !== "undefined" && firebase.auth && firebase.auth().currentUser; if (!u) throw Object.assign(new Error("auth"), { code: "auth" });
  const tok = await u.getIdToken();
  const r = await fetch(CX_API, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify({ op, rid: S.rid, ...body }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(j.error || "http " + r.status), { code: j.error || "http" }); return j;
}
const CX_ERR = { not_configured: "La connexion directe à cette caisse n'est pas encore ouverte. En attendant, importez un export : ça fait tout.", auth: "Connectez-vous à votre compte pour brancher la caisse.", forbidden: "Seul le gérant peut connecter la caisse.", badkey: "Clé refusée par la caisse. Vérifiez-la et recommencez.", state: "Le lien a expiré. Recommencez la connexion.", denied: "Connexion annulée.", http: "Le serveur ne répond pas. Réessayez dans un instant." };
const cxErr = (e) => CX_ERR[e && e.code] || "Connexion impossible pour l'instant. Réessayez, ou importez un fichier.";
/* retour d'OAuth : https://app.growthgusto.fr/?caisse=sumup&code=…&state=… */
(function cxCatchReturn() {
  try {
    const u = new URL(location.href); const p = u.searchParams.get("caisse"); if (!p) return;
    const ret = { provider: p, code: u.searchParams.get("code") || "", state: u.searchParams.get("state") || "", error: u.searchParams.get("error") || "" };
    sessionStorage.setItem("gg-cx-ret", JSON.stringify(ret));
    ["caisse", "code", "state", "error", "error_description", "scope"].forEach((k) => u.searchParams.delete(k));
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (e) {}
})();
async function cxReturn() {
  let ret = null; try { ret = JSON.parse(sessionStorage.getItem("gg-cx-ret") || "null"); sessionStorage.removeItem("gg-cx-ret"); } catch (e) {}
  if (!ret || !S.resto) return; go("caisse");
  if (ret.error || !ret.code) { SFX.err(); toast(CX_ERR.denied, "err"); return; }
  S.ui.cxBusy = ret.provider; refresh();
  try { await cxCall("finish", ret); SFX.done(); buzz([10, 40, 10]); burst(); toast(`${cxPos(ret.provider).name} est connectée`); }
  catch (e) { SFX.err(); toast(cxErr(e), "err"); }
  S.ui.cxBusy = null; refresh();
}

/* ───────── vue principale ───────── */
VIEWS.caisse = {
  render() {
    cxEnsure();
    const A = cxActive();
    if (!A || S.ui.cxPick) return `<div class="inner cx">${topBar("Caisse connectée", A ? { right: `<button class="btn ghost sm" data-act="cxPickOff">Annuler</button>` } : {})}${cxPickerHtml(!A)}</div>`;
    return `<div class="inner cx">${topBar("Caisse connectée")}<div class="cols"><div>${cxHeroHtml(A)}${cxConflictHtml()}${cxArtCardHtml()}</div><div>${cxSalesCardHtml(A)}${cxMoreCardHtml(A)}</div></div></div>`;
  },
};

function cxPickerHtml(first) {
  const tile = (p, i) => { const st = cxStatOf(p.id); const on = st && st.status !== "off" && (st.mode !== "csv" || st.lastImport);
    const tag = on ? (st.status === "error" ? `<span class="pill bad">Erreur</span>` : `<span class="pill acc">${st.mode === "csv" ? "Fichier importé" : "Connectée"}</span>`) : p.rec ? `<span class="pill warn">Recommandé</span>` : `<span class="cx-how">${p.kind === "csv" ? "Import de fichier" : p.kind === "key" ? "Clé API" : "Connexion directe"}</span>`;
    return `<button class="cx-tile st ${p.rec ? "big" : ""}" style="--i:${i + 2}" data-act="cxPos" data-v="${p.id}">${cxWell(p, p.rec ? "lg" : "")}<span class="tx"><b>${esc(p.name)}</b>${p.sub ? `<em>${esc(p.sub)}</em>` : ""}</span>${tag}</button>`; };
  return `${first ? `<div class="glass wall cx-intro st" style="--i:1"><span class="cx-introic">${ico("cxPlug")}</span><b>Branchez votre caisse</b><span>Le chiffre du jour arrive seul, le stock se déduit à chaque vente.</span></div>` : ""}
    <span class="lbl cx-q st" style="--i:1">Quelle caisse utilisez-vous ?</span>
    <div class="cx-tiles">${CX_POS.map(tile).join("")}</div>`;
}

function cxHeroHtml(A) {
  const p = cxPos(A.provider || A.id); const today = dayKey(); const L = cxSalesOf(today, p.id);
  const ca = L.reduce((a, s) => a + (num(s.total) || 0), 0); const n = L.reduce((a, s) => a + (num(s.count) || 1), 0);
  const api = A.mode !== "csv"; const err = A.status === "error"; const busy = S.ui.cxBusy === p.id;
  const state = err ? "Erreur de synchronisation" : api ? `Connectée · synchro ${cxAgo(A.lastSync || A.connectedAt)}` : `Fichier importé ${cxAgo(A.lastImport)}`;
  const btn = api ? `<button class="btn cx-wbtn sm ${busy ? "spin" : ""}" data-act="cxSync" data-v="${p.id}" ${busy ? "disabled" : ""}>${ico("cxSync")}${busy ? "Synchro…" : "Synchroniser"}</button>`
    : `<button class="btn cx-wbtn sm" data-act="cxImport" data-v="${p.id}">${ico("cxFile")}Importer</button>`;
  return `<div class="glass wall cx-hero st" style="--i:1">
    <div class="cx-hh">${cxWell(p, "on-wall")}<div class="tx"><b>${esc(p.name)}${p.sub ? ` <small>${esc(p.sub)}</small>` : ""}</b><em class="${err ? "err" : ""}">${ico(err ? "alert" : api ? "cxSync" : "cxFile")}${esc(state)}</em></div></div>
    <div class="cx-ca"><span>Aujourd'hui</span><b class="mono" id="cxCa">${ca.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<small> €</small></b><em>${n ? `${cxPl(n, "vente")} · panier moyen ${cxEur(ca / n)}` : api ? "Aucune vente pour l'instant" : "Aucune vente importée pour aujourd'hui"}</em></div>
    ${err ? `<div class="cx-herr">${ico("alert")}<span>${esc(A.lastError || "La caisse ne répond plus.")}</span></div>` : ""}
    <div class="cx-hb">${err && api ? `<button class="btn cx-wbtn sm" data-act="cxPos" data-v="${p.id}">${ico("cxPlug")}Reconnecter</button>` : btn}
      <span class="cx-feeds"><button data-go="tickets">${ico("receipt")}Tickets</button><button data-go="finance">${ico("euro")}Finances</button><button data-go="stock">${ico("box")}Stock</button></span></div></div>`;
}

/* a Z ticket typed by hand for a day the caisse already covers: the day would count twice */
function cxConflictHtml() {
  const from = addDays(dayKey(), -6); const pos = new Set(S.tickets.filter((t) => t.source === "caisse" && t.date >= from).map((t) => t.date));
  const dup = S.tickets.filter((t) => t.source !== "caisse" && pos.has(t.date)); if (!dup.length) return "";
  return `<div class="glass pad cx-warn st" style="--i:2"><span class="ic warn">${ico("alert")}</span><div class="tx"><b>${dup.length > 1 ? `${dup.length} jours comptés deux fois` : "Un jour compté deux fois"}</b><em>Un ticket Z saisi à la main existe aussi ${dup.length > 1 ? "pour ces jours" : `pour ${dup[0].date === dayKey() ? "aujourd'hui" : "le " + shortDate(dup[0].date)}`}. Supprimez-le dans Tickets.</em></div><button class="btn soft sm" data-act="ticket" data-id="${dup[0].id}">Voir</button></div>`;
}

function cxArtRow(a, i) {
  const sub = a.st === "prod" ? `Stock · ${esc(a.p.name)}` : a.st === "rec" ? `Fiche · ${esc(a.r.title)}${cxRecLinked(a.r) ? "" : " · aucun ingrédient suivi"}` : a.st === "off" ? "Hors stock" : a.st === "sug" ? `${a.c.t === "r" ? "Fiche" : "Stock"} · ${esc(a.c.name)} ?` : "Pas encore relié";
  const act = a.st === "sug" ? `<button class="btn acc sm cx-yes" data-act="cxMapOk" data-v="${esc(a.label)}" data-t="${a.c.t}:${a.c.id}" aria-label="Relier à ${esc(a.c.name)}">${ico("check")}Oui</button>`
    : a.st === "todo" ? `<button class="btn soft sm" data-act="cxMap" data-v="${esc(a.label)}">${ico("tklink")}Relier</button>` : `<span class="cx-chev">${ico("chev")}</span>`;
  const well = a.st === "prod" ? `<span class="ic w-sk">${ico("box")}</span>` : a.st === "rec" ? `<span class="ic">${ico("book")}</span>` : a.st === "off" ? `<span class="ic neu">${ico("x")}</span>` : `<span class="ic warn">${ico("tklink")}</span>`;
  const tap = a.st === "sug" || a.st === "todo" ? "" : `data-act="cxMap" data-v="${esc(a.label)}" role="button" tabindex="0"`;
  return `<div class="cx-art st ${a.st} ${tap ? "tap" : ""}" style="--i:${i}" ${tap}>${well}<div class="tx" ${tap ? "" : `data-act="cxMap" data-v="${esc(a.label)}"`}><b>${esc(a.label)}</b><em>${sub}</em></div><span class="cx-q mono">×${cxN(a.q)}</span>${act}</div>`;
}
function cxArtCardHtml() {
  const L = cxArticles(30); if (!L.length) return `<div class="glass pad st cx-art-card" style="--i:3"><div class="hstack"><span class="ic">${ico("tklink")}</span><div><b class="h3">Articles de la caisse</b><div class="sub">Ils apparaîtront ici dès les premières ventes.</div></div></div></div>`;
  const done = L.filter((a) => ["prod", "rec", "off"].includes(a.st)).length; const sug = L.filter((a) => a.st === "sug");
  const todo = L.filter((a) => a.st === "sug" || a.st === "todo");
  const show = (todo.length ? todo : L).slice(0, 5);
  return `<div class="glass pad st cx-art-card" style="--i:3">
    <div class="row"><div><b class="h3">${todo.length ? `${cxPl(todo.length, "article")} à relier` : "Tous les articles sont reliés"}</b><div class="sub">${done} sur ${L.length} sortent du stock</div></div>${sug.length > 1 ? `<button class="btn soft sm cx-allok" data-act="cxMapAll">Tout accepter</button>` : ""}</div>
    <div class="cx-prog"><i style="width:${Math.round((done / L.length) * 100)}%"></i></div>
    <div class="cx-arts">${show.map(cxArtRow).join("")}</div>
    <button class="btn ghost sm cx-all" data-go="caisseMap">Tous les articles · ${L.length}${ico("chev")}</button></div>`;
}

function cxSalesCardHtml(A) {
  const L = cxSalesOf(dayKey(), A.provider || A.id).sort((a, b) => (b.at || 0) - (a.at || 0));
  const row = (s, i) => { const it = (s.items || []); const tx = it.length ? it.slice(0, 3).map((x) => `${num(x.qty) > 1 ? cxN(x.qty) + " " : ""}${x.name}`).join(", ") + (it.length > 3 ? "…" : "") : "Vente";
    return `<div class="cx-sale st" style="--i:${Math.min(i, 8) + 2}"><span class="cx-t mono">${s.source === "csv" ? "Jour" : hm(s.at)}</span><span class="tx">${esc(tx)}</span><b class="mono">${cxEur(s.total)}</b></div>`; };
  return `<div class="glass pad st cx-sales" style="--i:4"><div class="row"><span class="lbl">Ventes du jour</span><span class="sub">${L.length ? cxPl(L.length, L[0].source === "csv" ? "import" : "vente") : ""}</span></div>
    ${L.length ? `<div class="cx-salel">${L.slice(0, 8).map(row).join("")}</div>${L.length > 8 ? `<span class="note cx-more">et ${L.length - 8} autres</span>` : ""}` : `<div class="empty" style="padding:12px 0 4px">${A.mode === "csv" ? "Importez l'export du jour pour voir les ventes." : "Les ventes s'afficheront ici au fil du service."}</div>`}</div>`;
}

function cxMoreCardHtml(A) {
  const p = cxPos(A.provider || A.id);
  return `<div class="glass pad st cx-moreb" style="--i:5">
    <button class="cx-opt" data-act="cxImport" data-v="${p.id}"><span class="ic w-sa">${ico("cxFile")}</span><span class="tx"><b>Importer un fichier</b><em>Export CSV ou Excel de la caisse</em></span>${ico("chev")}</button>
    <button class="cx-opt" data-act="cxPickOn"><span class="ic w-sk">${ico("swap")}</span><span class="tx"><b>Changer de caisse</b><em>${CX_POS.length} caisses au choix</em></span>${ico("chev")}</button>
    ${cxIsAdmin() ? `<button class="cx-opt" data-act="cxOff" data-v="${p.id}"><span class="ic bad">${ico("x")}</span><span class="tx"><b>Déconnecter ${esc(p.name)}</b><em>Les ventes déjà reçues restent</em></span>${ico("chev")}</button>` : ""}</div>`;
}

/* ───────── fiche d'une caisse (ce qu'il faut, 3 étapes, connexion) ───────── */
function cxPosHtml(id) {
  const p = cxPos(id); const st = cxStatOf(id); const live = cxLive(); const busy = S.ui.cxBusy === id;
  const status = st && st.status !== "off" && (st.mode !== "csv" || st.lastImport)
    ? `<div class="cx-stat ${st.status === "error" ? "bad" : ""}"><span class="cx-sic">${st.status === "error" ? ico("alert") : ico(st.mode === "csv" ? "cxFile" : "cxPlug")}</span><span><b>${st.status === "error" ? "Erreur" : st.mode === "csv" ? "Fichier importé" : "Connectée"}</b><em>${st.status === "error" ? esc(st.lastError || "") : st.mode === "csv" ? cxAgo(st.lastImport) : "Dernière synchro " + cxAgo(st.lastSync || st.connectedAt)}</em></span></div>` : "";
  let cta;
  const apiOn = st && st.mode === "api" && st.status === "connected";
  if (apiOn) cta = `<button class="btn acc block ${busy ? "spin" : ""}" data-act="cxSync" data-v="${p.id}" ${busy ? "disabled" : ""}>${ico("cxSync")}${busy ? "Synchro…" : "Synchroniser maintenant"}</button>`;
  else if (p.kind === "csv") cta = `<button class="btn acc block" data-act="cxImport" data-v="${p.id}">${ico("cxFile")}Importer un export</button>`;
  else if (live && !cxIsAdmin()) cta = `<p class="cx-soon">${ico("lock")}Seul le gérant peut connecter la caisse.</p><button class="btn soft block" data-act="cxImport" data-v="${p.id}">${ico("cxFile")}Importer un export</button>`;
  else if (live && p.kind === "key") cta = `<label class="field"><span>Clé API ${esc(p.name)}</span><input class="input mono" id="cxKey" autocomplete="off" spellcheck="false" placeholder="Collez la clé ici"></label><button class="btn acc block ${busy ? "spin" : ""}" data-act="cxKeyGo" data-v="${p.id}" ${busy ? "disabled" : ""}>${ico("cxKey")}${busy ? "Vérification…" : "Connecter " + esc(p.name)}</button>`;
  else if (live) cta = `<button class="btn acc block ${busy ? "spin" : ""}" data-act="cxGo" data-v="${p.id}" ${busy ? "disabled" : ""}>${ico("cxPlug")}${busy ? "Ouverture…" : "Connecter " + esc(p.name)}</button>`;
  else cta = `<p class="cx-soon">${ico("cxBolt")}<span><b>Connexion directe : bientôt active.</b> En attendant, l'import de fichier fait tout.</span></p><button class="btn acc block" data-act="cxImport" data-v="${p.id}">${ico("cxFile")}Importer un export</button>`;
  return `<div class="cx-pos"><div class="cx-ph">${cxWell(p, "lg")}<div><div class="h2">${esc(p.name)}</div>${p.sub ? `<div class="sub">${esc(p.sub)}</div>` : ""}</div></div>
    ${status}
    <div class="cx-need"><span class="lbl">Il vous faut</span><b>${esc(p.need)}</b></div>
    <ol class="cx-steps">${p.steps.map((s, i) => `<li class="st" style="--i:${i + 1}"><span class="cx-n mono">${i + 1}</span><span>${esc(s)}</span></li>`).join("")}</ol>
    ${cta}
    ${p.kind !== "csv" ? `<p class="note cx-csvtip">${ico("cxFile")}<span>${esc(p.csv)}</span></p>` : `<p class="note cx-csvtip">${ico("cxFile")}<span>${esc(p.csv)}</span></p>`}</div>`;
}

/* ───────── page « articles » ───────── */
VIEWS.caisseMap = {
  render() {
    cxEnsure(); const L = cxArticles(30); const f = S.ui.cxF || "todo";
    const groups = { todo: L.filter((a) => a.st === "sug" || a.st === "todo"), ok: L.filter((a) => a.st === "prod" || a.st === "rec"), off: L.filter((a) => a.st === "off") };
    const list = f === "all" ? L : groups[f] || [];
    const seg = [["todo", `À relier · ${groups.todo.length}`], ["ok", `Reliés · ${groups.ok.length}`], ["all", "Tous"]];
    return `<div class="inner cx">${topBar("Articles de la caisse")}
      <div class="seg cx-seg st" style="--i:1">${seg.map(([k, t]) => `<button class="${f === k ? "on" : ""}" data-act="cxF" data-v="${k}">${t}</button>`).join("")}</div>
      <div class="glass pad st cx-art-card" style="--i:2">${list.length ? `<div class="cx-arts">${list.map((a, i) => cxArtRow(a, Math.min(i, 10) + 3)).join("")}</div>` : `<div class="empty" style="padding:14px 0 4px">${f === "todo" ? "Rien à relier : chaque vente sort du stock toute seule." : "Aucun article ici."}</div>`}</div>
      <p class="note cx-foot st" style="--i:3">Relier un article une fois suffit : chaque vente retire ensuite du stock les ingrédients de la fiche, ou le produit choisi.</p></div>`;
  },
};

/* ───────── sheet: relier un article ───────── */
function cxMapHtml() {
  const M = S.ui.cxM; if (!M) return "";
  if (M.step === "per") {
    const r = S.notes.find((n) => n.id === M.noteId); if (!r) return "";
    const por = num(r.portions) || 1; const nl = cxRecLinked(r);
    return `<div class="cx-msh"><div class="sub cx-path">${esc(M.label)} ${ico("chev")} ${esc(r.title)}</div><div class="h2">1 vendu, c'est combien de portions ?</div>
      <div class="cx-per"><button class="iconbtn" data-act="cxPer" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono" id="cxPerV">${cxN(M.per)}</b><button class="iconbtn" data-act="cxPer" data-v="1" aria-label="Plus">${ico("plus")}</button></div>
      <p class="sub cx-perx">La fiche fait ${cxPl(por, "portion")}${nl ? ` · ${cxPl(nl, "ingrédient")} suivi${nl > 1 ? "s" : ""} en stock` : ""}.</p>
      ${nl ? "" : `<div class="cx-hint">${ico("alert")}<span>Aucun ingrédient de cette fiche n'est lié au stock : liez-les dans la fiche pour qu'ils soient déduits.</span></div>`}
      <div class="grid2"><button class="btn soft" data-act="cxMapBack">Changer</button><button class="btn acc" data-act="cxMapSave">${ico("check")}Relier</button></div></div>`;
  }
  const c = cxCands(M.label, 3); const cur = cxState(M.label);
  const item = (x, sug) => `<button class="cx-cand ${sug ? "sug" : ""}" data-act="cxMapPick" data-t="${x.t}:${x.id}" data-q="${esc(cxNorm(x.name))}"><span class="ic ${x.t === "p" ? "w-sk" : ""}">${ico(x.t === "p" ? "box" : "book")}</span><span class="tx"><b>${esc(x.name)}</b><em>${sug ? "Suggestion · " : ""}${x.t === "p" ? "Produit du stock" : "Fiche recette"}</em></span>${ico("chev")}</button>`;
  const others = [...cxRecipes().map((r) => ({ t: "r", id: r.id, name: r.title.trim() })), ...S.products.map((p) => ({ t: "p", id: p.id, name: p.name }))].filter((x) => !c.some((y) => y.t === x.t && y.id === x.id));
  const curTx = cur.st === "prod" ? `Stock · ${esc(cur.p.name)}` : cur.st === "rec" ? `Fiche · ${esc(cur.r.title)}${cur.per > 1 ? ` · ${cxN(cur.per)} portions` : ""}` : cur.st === "off" ? "Hors stock" : "";
  return `<div class="cx-msh"><div><div class="sub">Article de caisse</div><div class="h2">${esc(M.label)}</div></div>
    ${curTx ? `<div class="cx-cur"><span>Relié à</span><b>${curTx}</b>${cur.auto ? "" : `<button class="btn ghost sm" data-act="cxUnmap">Délier</button>`}</div>` : ""}
    <span class="lbl">Qu'est-ce qui sort du stock quand il est vendu ?</span>
    ${c.length ? `<div class="cx-cands">${c.map((x) => item(x, true)).join("")}</div>` : ""}
    ${others.length ? `<div class="cx-search"><span>${ico("search")}</span><input class="input" id="cxMq" placeholder="Chercher une fiche ou un produit…" autocomplete="off"></div><div class="cx-cands cx-others" id="cxMl">${others.map((x) => item(x)).join("")}</div>` : !c.length ? `<div class="empty" style="padding:6px 0">Créez d'abord vos fiches recettes ou vos produits du stock.</div>` : ""}
    <div class="grid2"><button class="btn ghost" data-act="cxIgnore">Hors stock</button><button class="btn soft" data-act="sheetClose">Plus tard</button></div></div>`;
}
function cxMapAfter(b) { const q = $("#cxMq", b); if (!q) return; q.addEventListener("input", () => { const n = cxNorm(q.value); $$("#cxMl .cx-cand", b).forEach((r) => { r.hidden = !!n && !r.dataset.q.includes(n); }); }); }
async function cxSaveRecipe(label, noteId, per) {
  const key = cxKey(label); const doc = { key, label, kind: "recipe", noteId, per: per || 1, at: Date.now(), uid: S.me.id };
  await safe(DB.set("posMap", cxLinkId(key), doc));
  S.cxMap = [...S.cxMap.filter((m) => m.key !== key), { id: cxLinkId(key), ...doc }];
  const ln = (S.tkLinks || []).find((x) => x.key === key); if (ln) { await DB.del("tkLinks", ln.id).catch(() => {}); S.tkLinks = S.tkLinks.filter((x) => x.id !== ln.id); }
  const r = S.notes.find((n) => n.id === noteId); logEvent("stock", `a relié l'article de caisse « ${label} » à la fiche ${r ? r.title : ""}`); cxRoll();
}
/* product: the conversion step of js/tickets.js (« 1 verre = 0,125 L ») */
function cxToProduct(label, pid) {
  if (typeof ACT.tkLink !== "function") return;
  const key = cxKey(label); const m = cxMapOf(key); if (m) { DB.del("posMap", m.id).catch(() => {}); S.cxMap = S.cxMap.filter((x) => x.id !== m.id); }
  ACT.tkLink({ dataset: { t: "" } }, null, label); if (pid) ACT.tkLPick(null, pid);
}

/* ───────── import CSV / Excel ───────── */
const CX_COLS = [["day", "Date"], ["name", "Article"], ["qty", "Quantité"], ["amount", "Montant TTC"], ["ref", "N° de ticket"]];
const CX_RX = {
  day: /^(date|jour|day|date de (la )?vente|date et heure|horodatage|created( at)?|ouverture|cloture|date heure|datetime|timestamp)$|^date\b/,
  name: /(produit|article|libelle|designation|item|nom du produit|product|plat|description|intitule)|^nom$|^name$/,
  qty: /^(qte|qt|quantite|quantites|qty|quantity|nombre|nb|nbre|nb vendus?|vendus?|unites|quantite vendue|count)$|quantit/,
  amount: /(total ttc|montant ttc|ca ttc|prix ttc|ttc|montant|total|ca|chiffre|amount|price total|total price|vente)/,
  ref: /(ticket|commande|order|transaction|n de|numero|facture|receipt|code)/,
};
function cxGuessCols(head, rows) {
  const H = head.map((h) => cxNorm(h)); const used = new Set(); const pick = {};
  ["day", "name", "qty", "amount", "ref"].forEach((k) => {
    let i = H.findIndex((h, j) => !used.has(j) && h && CX_RX[k].test(h) && !(k === "amount" && /\bht\b|tva|remise|unitaire|tax/.test(h)));
    if (i < 0 && k === "amount") i = H.findIndex((h, j) => !used.has(j) && CX_RX.amount.test(h));
    if (i >= 0) { pick[k] = i; used.add(i); }
  });
  if (pick.name == null) { const i = head.findIndex((_, j) => !used.has(j) && rows.slice(0, 20).filter((r) => r[j] && cxNum(r[j]) == null && !cxDay(r[j])).length >= Math.min(3, rows.length)); if (i >= 0) { pick.name = i; used.add(i); } }
  return pick;
}
function cxDay(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d{5}(\.\d+)?$/.test(String(v))) { const n = +v; if (n > 30000 && n < 80000) { const d = new Date(Math.round((n - 25569) * 864e5)); return dayKey(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); } return null; }
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return null;
}
function cxCsv(text) {
  text = text.replace(/^﻿/, ""); const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const cnt = (c) => first.split(c).length - 1; const del = [";", ",", "\t", "|"].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === "") q = true; else if (c === del) { row.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x));
}
/* .xlsx = a zip of XML files: read the central directory, inflate with DecompressionStream, keep the first sheet */
async function cxXlsx(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("zip");
  const files = {}; let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true); const td = new TextDecoder();
  for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) { const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true); files[td.decode(u8.subarray(p + 46, p + 46 + nl))] = { m: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) }; p += 46 + nl + xl + cl; }
  const read = async (name) => { const f = files[name]; if (!f) return null; const s = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true); const data = u8.subarray(s, s + f.size); if (!f.m) return td.decode(data); return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text(); };
  const X = (s) => new DOMParser().parseFromString(s, "application/xml");
  const ss = await read("xl/sharedStrings.xml"); const shared = ss ? [...X(ss).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")) : [];
  const sheet = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])[0]; if (!sheet) throw new Error("sheet");
  const doc = X(await read(sheet)); const out = [];
  const col = (r) => { let c = 0; for (const ch of r.replace(/\d+/g, "")) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  [...doc.getElementsByTagName("row")].forEach((row) => {
    const arr = []; [...row.getElementsByTagName("c")].forEach((c) => {
      const t = c.getAttribute("t"); const v = c.getElementsByTagName("v")[0]; let val = "";
      if (t === "s") val = shared[+(v && v.textContent)] ?? ""; else if (t === "inlineStr") val = [...c.getElementsByTagName("t")].map((x) => x.textContent).join(""); else val = v ? v.textContent : "";
      if (t !== "s" && t !== "inlineStr" && t !== "str" && val !== "" && !isNaN(+val)) val = +val;
      arr[col(c.getAttribute("r") || "A")] = val;
    });
    for (let i = 0; i < arr.length; i++) if (arr[i] == null) arr[i] = "";
    if (arr.some((x) => x !== "")) out.push(arr.map((x) => (typeof x === "string" ? x.trim() : x)));
  });
  return out;
}
function cxPickFile() {
  return new Promise((res) => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".csv,.txt,.tsv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    inp.style.display = "none"; document.body.appendChild(inp); let done = false;
    const end = (f) => { if (done) return; done = true; inp.remove(); res(f); };
    inp.addEventListener("change", () => end(inp.files && inp.files[0])); inp.addEventListener("cancel", () => end(null));
    window.addEventListener("focus", () => setTimeout(() => { if (!(inp.files && inp.files.length)) end(null); }, 1500), { once: true });
    inp.click();
  });
}
async function cxReadFile(f) {
  const buf = await f.arrayBuffer(); const u8 = new Uint8Array(buf.slice(0, 4));
  if (u8[0] === 0x50 && u8[1] === 0x4b) return cxXlsx(buf);
  if (u8[0] === 0xd0 && u8[1] === 0xcf) throw Object.assign(new Error("xls"), { code: "xls" });
  let t = new TextDecoder("utf-8").decode(buf); if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
  return cxCsv(t);
}
/* the header row is the first one with several text cells; the rest are data */
function cxTable(rows) {
  const hi = rows.slice(0, 15).findIndex((r) => r.filter((c) => typeof c === "string" && c && cxNum(c) == null && !cxDay(c)).length >= 2);
  const h = hi < 0 ? 0 : hi; return { head: (rows[h] || []).map((c) => String(c ?? "")), rows: rows.slice(h + 1).filter((r) => r.some((c) => c !== "")) };
}
/* rows → { days: { day: { total, count, items: Map } } } with the chosen columns */
function cxParse(I) {
  const c = I.cols; const days = {}; const skip = /^(total|sous total|totaux|tva|remise|pourboire|tip|frais|annul)/;
  I.rows.forEach((r) => {
    const name = c.name != null ? String(r[c.name] ?? "").trim() : ""; const amt = c.amount != null ? cxNum(r[c.amount]) : null;
    let q = c.qty != null ? cxNum(r[c.qty]) : null; if (name && q == null) q = 1;
    if (name && skip.test(cxNorm(name))) return; if (!name && amt == null) return;
    if (r.some((x) => typeof x === "string" && /^(total|sous total|totaux)\b/.test(cxNorm(x)))) return;
    const day = c.day != null ? cxDay(r[c.day]) : I.day; if (!day) return;
    const D = (days[day] ||= { total: 0, refs: new Set(), items: new Map(), rows: 0 }); D.rows++;
    if (amt != null) D.total += amt; if (c.ref != null && r[c.ref] !== "") D.refs.add(String(r[c.ref]));
    if (name && q) { const k = cxKey(name); const e = D.items.get(k) || { name, qty: 0, amount: null }; e.qty += q; if (amt != null) e.amount = (e.amount || 0) + amt; D.items.set(k, e); }
  });
  return days;
}
function cxImportHtml() {
  const I = S.ui.cxI; if (!I) return ""; const p = cxPos(I.provider); const D = cxParse(I); const dk = Object.keys(D).sort();
  const tot = dk.reduce((a, d) => a + D[d].total, 0); const arts = new Map(); dk.forEach((d) => D[d].items.forEach((e, k) => { const x = arts.get(k) || { name: e.name, qty: 0 }; x.qty += e.qty; arts.set(k, x); }));
  const top = [...arts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const sel = (k, t) => `<label class="cx-col"><span>${t}</span><select class="input" data-col="${k}" aria-label="Colonne ${t}"><option value="">${k === "name" || k === "amount" ? "—" : "Aucune"}</option>${I.head.map((h, i) => `<option value="${i}" ${I.cols[k] === i ? "selected" : ""}>${esc(h || "Colonne " + (i + 1))}</option>`).join("")}</select></label>`;
  const ok = dk.length && (I.cols.name != null || I.cols.amount != null);
  return `<div class="cx-imp"><div class="cx-ph">${cxWell(p)}<div style="min-width:0"><div class="h2">Import ${esc(p.name)}</div><div class="sub cx-file">${esc(I.file)}</div></div></div>
    <div class="cx-isum"><div><b class="mono">${cxEur(tot)}</b><em>chiffre TTC</em></div><div><b class="mono">${cxN(arts.size)}</b><em>${arts.size > 1 ? "articles" : "article"}</em></div><div><b class="mono">${dk.length}</b><em>${dk.length > 1 ? "jours" : "jour"}</em></div></div>
    ${I.cols.day == null ? `<div class="cx-iday"><span class="lbl">Ventes du</span><div class="cx-chips">${[[dayKey(), "Aujourd'hui"], [addDays(dayKey(), -1), "Hier"]].map(([d, t]) => `<button class="chip ${I.day === d ? "on" : ""}" data-act="cxIDay" data-v="${d}">${t}</button>`).join("")}<input type="date" class="input cx-date" id="cxIDate" value="${esc(I.day || "")}" max="${dayKey()}" aria-label="Autre jour"></div></div>` : `<p class="sub" style="margin:0">${dk.length ? (dk.length > 1 ? `Du ${shortDate(dk[0])} au ${shortDate(dk[dk.length - 1])}` : tkDayLabelSafe(dk[0])) : "Aucune date lisible dans la colonne choisie."}</p>`}
    ${top.length ? `<div class="cx-itop">${top.map((a) => `<div><span>${esc(a.name)}</span><b class="mono">×${cxN(a.qty)}</b></div>`).join("")}</div>` : ""}
    <details class="cx-cols" ${ok ? "" : "open"}><summary>${ico("sliders")}Colonnes du fichier</summary><div class="cx-colg">${CX_COLS.map(([k, t]) => sel(k, t)).join("")}</div></details>
    ${!ok ? `<div class="cx-hint">${ico("alert")}<span>Choisissez au moins la colonne Article ou Montant.</span></div>` : ""}
    <p class="note" style="margin:0">Un nouvel import remplace les ventes des mêmes jours.</p>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="cxImportGo" ${ok ? "" : "disabled"}>${ico("check")}Importer</button></div></div>`;
}
const tkDayLabelSafe = (d) => (typeof tkDayLabel === "function" ? tkDayLabel(d, true) : shortDate(d));
function cxImportAfter(b) {
  $$("select[data-col]", b).forEach((sel) => sel.addEventListener("change", () => {
    const I = S.ui.cxI; if (!I) return; const v = sel.dataset.col; const n = sel.value === "" ? null : +sel.value;
    Object.keys(I.cols).forEach((k) => { if (I.cols[k] === n && k !== v) delete I.cols[k]; }); if (n == null) delete I.cols[v]; else I.cols[v] = n;
    SFX.tick(); openSheet(cxImportHtml(), (b2) => { cxImportAfter(b2); const d = $(".cx-cols", b2); if (d) d.open = true; });
  }));
  const d = $("#cxIDate", b); if (d) d.addEventListener("change", () => { if (/^\d{4}-\d{2}-\d{2}$/.test(d.value) && S.ui.cxI) { S.ui.cxI.day = d.value; openSheet(cxImportHtml(), cxImportAfter); } }); }

/* ───────── actions ───────── */
Object.assign(ACT, {
  cxPos: (a, id, v) => { SFX.tap(); openSheet(cxPosHtml(v)); },
  cxPickOn: () => { S.ui.cxPick = true; SFX.tap(); rerender(); },
  cxPickOff: () => { S.ui.cxPick = false; SFX.tick(); rerender(); },
  cxF: (a, id, v) => { S.ui.cxF = v; SFX.tick(); buzz(4); rerender(); },
  cxGo: async (a, id, v) => {
    if (!cxLive()) return; S.ui.cxBusy = v; openSheet(cxPosHtml(v));
    try { const r = await cxCall("start", { provider: v }); if (r.url) { location.href = r.url; return; } throw new Error("url"); }
    catch (e) { S.ui.cxBusy = null; SFX.err(); toast(cxErr(e), "err"); openSheet(cxPosHtml(v)); }
  },
  cxKeyGo: async (a, id, v) => {
    const k = ($("#cxKey") || {}).value || ""; if (k.trim().length < 8) { SFX.err(); toast("Collez la clé API complète.", "err"); return; }
    S.ui.cxBusy = v; openSheet(cxPosHtml(v));
    try { await cxCall("key", { provider: v, apiKey: k.trim() }); S.ui.cxBusy = null; S.ui.cxPick = false; closeSheet(true); SFX.done(); burst(); toast(`${cxPos(v).name} est connectée`); rerender(); }
    catch (e) { S.ui.cxBusy = null; SFX.err(); toast(cxErr(e), "err"); openSheet(cxPosHtml(v)); }
  },
  cxSync: async (a, id, v) => {
    if (S.ui.cxBusy) return; S.ui.cxBusy = v; SFX.tap(); rerender();
    try {
      if (DB.mode === "demo") { await new Promise((r) => setTimeout(r, 900)); const n = cxDemoMore(); toast(n ? `${cxPl(n, "nouvelle vente", "nouvelles ventes")}` : "Tout est à jour"); }
      else if (cxLive()) { const r = await cxCall("sync", { provider: v }); toast(r.added ? `${cxPl(r.added, "nouvelle vente", "nouvelles ventes")}` : "Tout est à jour"); }
      else toast("Synchronisation automatique bientôt active : importez le fichier du jour.", "info");
      SFX.ok(); buzz(6);
    } catch (e) { SFX.err(); toast(cxErr(e), "err"); }
    S.ui.cxBusy = null; rerender();
  },
  cxOff: (a, id, v) => openSheet(`<div class="h2" style="font-size:20px">Déconnecter ${esc(cxPos(v).name)} ?</div><p class="sub" style="margin:0">Les nouvelles ventes n'arriveront plus. Celles déjà reçues restent dans Tickets et Finances.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="cxOffOk" data-v="${v}">Déconnecter</button></div>`),
  cxOffOk: async (a, id, v) => {
    closeSheet(true);
    try { if (cxLive() && cxStatOf(v)?.mode !== "csv") await cxCall("disconnect", { provider: v }); else { const st = cxStatOf(v); const o = { ...(st || {}) }; delete o.id; await safe(DB.set("caisse", v, { ...o, provider: v, status: "off", active: false, offAt: Date.now() })); } }
    catch (e) { SFX.err(); toast(cxErr(e), "err"); return; }
    S.cxStat = S.cxStat.map((c) => (c.id === v ? { ...c, status: "off" } : c)); logEvent("caisse", `a déconnecté la caisse ${cxPos(v).name}`); SFX.close(); toast("Caisse déconnectée"); rerender();
  },

  /* mapping */
  cxMap: (a, id, v) => { if (!v) return; S.ui.cxM = { label: v, step: "pick" }; SFX.tap(); openSheet(cxMapHtml(), cxMapAfter); },
  cxMapPick: (a) => {
    const M = S.ui.cxM; if (!M) return; const [t, tid] = (a.dataset.t || "").split(":");
    if (t === "p") { closeSheet(true); S.ui.cxM = null; setTimeout(() => cxToProduct(M.label, tid), 60); return; }
    M.step = "per"; M.noteId = tid; M.per = cxPerGuess(M.label); SFX.tick(); buzz(4); openSheet(cxMapHtml());
  },
  cxMapBack: () => { const M = S.ui.cxM; if (!M) return; M.step = "pick"; SFX.tick(); openSheet(cxMapHtml(), cxMapAfter); },
  cxPer: (a, id, v) => { const M = S.ui.cxM; if (!M) return; const n = Math.max(1, Math.min(99, (M.per || 1) + +v)); if (n === M.per) { SFX.err(); return; } M.per = n; SFX.tick(); buzz(4); const e = $("#cxPerV"); if (e) { e.textContent = cxN(n); e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); } },
  cxMapSave: async () => {
    const M = S.ui.cxM; if (!M || M.saving) return; M.saving = true;
    try { await cxSaveRecipe(M.label, M.noteId, M.per); } catch (e) { M.saving = false; return; }
    S.ui.cxM = null; closeSheet(true); SFX.done(); buzz([8, 30, 8]); toast("Relié : chaque vente sort du stock"); rerender();
  },
  cxMapOk: async (a, id, v) => {
    const [t, tid] = (a.dataset.t || "").split(":"); if (!v || !tid) return;
    if (t === "p") { cxToProduct(v, tid); return; }
    const row = a.closest(".cx-art"); if (row) row.classList.add("done");
    try { await cxSaveRecipe(v, tid, cxPerGuess(v)); } catch (e) { return; }
    SFX.ok(); buzz(6); setTimeout(rerender, row ? 320 : 0);
  },
  cxMapAll: async () => {
    const L = cxArticles(30).filter((x) => x.st === "sug" && x.c.t === "r"); if (!L.length) { toast("Les suggestions restantes sont des produits : reliez-les un par un.", "info"); return; }
    for (const x of L) { try { await cxSaveRecipe(x.label, x.c.id, cxPerGuess(x.label)); } catch (e) { break; } }
    SFX.done(); buzz([8, 30, 8]); burst(); toast(`${cxPl(L.length, "article")} relié${L.length > 1 ? "s" : ""}`); rerender();
  },
  cxUnmap: async () => {
    const M = S.ui.cxM; if (!M) return; const key = cxKey(M.label);
    const m = cxMapOf(key); if (m) { await DB.del("posMap", m.id).catch(() => {}); S.cxMap = S.cxMap.filter((x) => x.id !== m.id); }
    const ln = (S.tkLinks || []).find((x) => x.key === key); if (ln) { await DB.del("tkLinks", ln.id).catch(() => {}); S.tkLinks = S.tkLinks.filter((x) => x.id !== ln.id); }
    cxRoll(); SFX.close(); toast("Article délié"); openSheet(cxMapHtml(), cxMapAfter); rerender();
  },
  cxIgnore: async () => {
    const M = S.ui.cxM; if (!M) return; const key = cxKey(M.label); const doc = { key, label: M.label, ignore: true, at: Date.now(), uid: S.me.id };
    try { await safe(DB.set("tkLinks", cxLinkId(key), doc)); } catch (e) { return; }
    S.tkLinks = [...(S.tkLinks || []).filter((x) => x.key !== key), { id: cxLinkId(key), ...doc }];
    const m = cxMapOf(key); if (m) { await DB.del("posMap", m.id).catch(() => {}); S.cxMap = S.cxMap.filter((x) => x.id !== m.id); }
    S.ui.cxM = null; closeSheet(true); cxRoll(); SFX.close(); toast(`« ${M.label} » : hors stock`, "info"); rerender();
  },

  /* import */
  cxImport: async (a, id, v) => {
    if (!cxCanWrite()) { SFX.err(); toast("Votre accès ne permet pas d'importer les ventes.", "err"); return; }
    const f = await cxPickFile(); if (!f) return;
    let rows; try { rows = await cxReadFile(f); } catch (e) { SFX.err(); toast(e && e.code === "xls" ? "Ancien format Excel : enregistrez le fichier en .xlsx ou .csv." : "Fichier illisible : exportez en CSV ou Excel (.xlsx).", "err"); return; }
    const T = cxTable(rows); if (!T.rows.length) { SFX.err(); toast("Ce fichier ne contient aucune vente.", "err"); return; }
    S.ui.cxI = { provider: v || "autre", file: f.name, head: T.head, rows: T.rows, cols: cxGuessCols(T.head, T.rows), day: dayKey() };
    SFX.ok(); openSheet(cxImportHtml(), cxImportAfter);
  },
  cxIDay: (a, id, v) => { const I = S.ui.cxI; if (!I) return; I.day = v; SFX.tick(); openSheet(cxImportHtml(), cxImportAfter); },
  cxImportGo: async (a) => {
    const I = S.ui.cxI; if (!I || I.saving) return; const D = cxParse(I); const dk = Object.keys(D); if (!dk.length) return; I.saving = true; a.disabled = true;
    const now = Date.now(); const prov = I.provider;
    try {
      for (const s of S.cxSales.filter((s) => s.provider === prov && s.source === "csv" && dk.includes(s.day))) await DB.del("sales", s.id).catch(() => {});
      for (const d of dk) {
        const x = D[d]; const items = [...x.items.values()].map((e) => ({ name: e.name, qty: cxR2(e.qty), ...(e.amount != null ? { amount: cxR2(e.amount) } : {}) }));
        const at = d === dayKey() ? now : parseDay(d).getTime() + 23 * 36e5;
        await safe(DB.set("sales", `${prov}_csv_${d}`, { provider: prov, source: "csv", day: d, at, total: cxR2(x.total), count: x.refs.size || null, items, file: I.file, importedAt: now, uid: S.me.id }));
      }
      const st = cxStatOf(prov) || {}; const keep = { ...st }; delete keep.id;
      S.cxStat.filter((c) => c.id !== prov && c.active).forEach((c) => DB.update("caisse", c.id, { active: false }).catch(() => {}));
      await safe(DB.set("caisse", prov, { ...keep, provider: prov, mode: keep.mode === "api" && keep.status === "connected" ? "api" : "csv", status: "connected", lastImport: now, file: I.file, active: true }));
    } catch (e) { I.saving = false; a.disabled = false; return; }
    logEvent("caisse", `a importé les ventes ${cxPos(prov).name} (${dk.length > 1 ? cxPl(dk.length, "jour") : shortDate(dk[0])})`);
    S.ui.cxI = null; S.ui.cxPick = false; closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst(); toast(`Ventes importées · ${cxPl(dk.length, "jour")}`);
    if (S.route !== "caisse") go("caisse"); else rerender(); cxRoll();
  },
});
/* keyboard: Entrée valide la clé API */
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "cxKey") { const b = $("#sheetBody [data-act=cxKeyGo]"); if (b) b.click(); } });

/* ───────── démo : SumUp connectée, les ventes du jour ───────── */
const CX_DEMO_MENU = [
  ["Douzaine Fines de claire", 24, 3], ["Croquettes jambon x5", 9, 4], ["Planche charcuterie", 19, 3], ["Bourguignon maison", 22, 4],
  ["Verre de vin rouge", 6.5, 6], ["Café gourmand", 9.5, 3], ["Formule midi", 18.5, 4], ["Kir vin blanc", 5, 2], ["Café", 2.2, 5],
];
let cxDemoRnd = 7;
const cxDR = () => { cxDemoRnd = (cxDemoRnd * 1103515245 + 12345) % 2147483648; return cxDemoRnd / 2147483648; };
function cxDemoSale(at, i) {
  const items = []; const n = 1 + Math.floor(cxDR() * 3.2);
  for (let k = 0; k < n; k++) { const tot = CX_DEMO_MENU.reduce((a, m) => a + m[2], 0); let r = cxDR() * tot; const m = CX_DEMO_MENU.find((x) => (r -= x[2]) < 0) || CX_DEMO_MENU[0]; const ex = items.find((x) => x.name === m[0]); const q = 1 + (cxDR() < 0.25 ? 1 : 0); if (ex) { ex.qty += q; ex.amount = cxR2(ex.amount + q * m[1]); } else items.push({ name: m[0], qty: q, amount: cxR2(q * m[1]) }); }
  const total = cxR2(items.reduce((a, x) => a + x.amount, 0));
  return { provider: "sumup", source: "demo", extId: "TDEMO" + i, at, day: dayKey(new Date(at)), total, ht: cxR2(total / 1.1), count: 1, items, payment: cxDR() < 0.8 ? "Carte" : "Espèces", status: "successful" };
}
function cxDemoSeed() {
  const P = (c) => `restos/${S.rid}/${c}`; if (DB.local[P("caisse")]) return;
  const now = Date.now(); const d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime();
  const svc = [[11.75, 14.6, 26], [18.9, 22.8, 30]]; const sales = {}; let i = 0;
  svc.forEach(([a, b, n]) => { for (let k = 0; k < n; k++) { const at = t0 + (a + ((b - a) * (k + cxDR() * 0.8)) / n) * 36e5; if (at < now - 4 * 6e4) sales["sumup_TDEMO" + ++i] = cxDemoSale(Math.round(at), i); } });
  if (!i) { const a = Math.max(t0 + 5 * 6e4, now - 2.5 * 36e5, Math.min(t0 + 7 * 36e5, now - 40 * 6e4)); for (let k = 0; k < 7; k++) { const at = a + ((now - 3 * 6e4 - a) * (k + 0.3)) / 7; sales["sumup_TDEMO" + ++i] = cxDemoSale(Math.round(at), i); } }
  cxDemoN = i;
  DB.local[P("sales")] = sales;
  DB.local[P("caisse")] = { sumup: { provider: "sumup", mode: "api", status: "connected", merchant: "Le Bistrot Démo", connectedAt: now - 21 * 864e5, lastSync: now - 3 * 6e4, active: true } };
  DB.local[P("posMap")] = {
    [cxLinkId(cxKey("Douzaine Fines de claire"))]: { key: cxKey("Douzaine Fines de claire"), label: "Douzaine Fines de claire", kind: "recipe", noteId: "n-huitres", per: 1, at: now - 20 * 864e5, uid: "demo-camille" },
    [cxLinkId(cxKey("Croquettes jambon x5"))]: { key: cxKey("Croquettes jambon x5"), label: "Croquettes jambon x5", kind: "recipe", noteId: "n-croq", per: 5, at: now - 20 * 864e5, uid: "demo-camille" },
  };
  const L = (DB.local[P("tkLinks")] ||= {});
  L[cxLinkId(cxKey("Verre de vin rouge"))] = { key: cxKey("Verre de vin rouge"), label: "Verre de vin rouge", productId: "p-vin", factor: 0.125, soldUnit: "verre", inUnit: "L", inFactor: 0.125, at: now - 20 * 864e5, uid: "demo-camille" };
  L[cxLinkId(cxKey("Café gourmand"))] = { key: cxKey("Café gourmand"), label: "Café gourmand", ignore: true, at: now - 20 * 864e5, uid: "demo-camille" };
  L[cxLinkId(cxKey("Café"))] = { key: cxKey("Café"), label: "Café", ignore: true, at: now - 20 * 864e5, uid: "demo-camille" };
  ["sales", "caisse", "posMap", "tkLinks"].forEach((c) => DB.emit(P(c)));
}
let cxDemoN = 0;
function cxDemoMore() {
  const P = `restos/${S.rid}/sales`; const n = 1 + Math.floor(cxDR() * 3); const now = Date.now(); const o = (DB.local[P] ||= {});
  for (let k = 0; k < n; k++) { cxDemoN++; o["sumup_TDEMO" + cxDemoN] = cxDemoSale(now - (n - k) * 40e3, cxDemoN); }
  const c = DB.local[`restos/${S.rid}/caisse`]; if (c && c.sumup) c.sumup.lastSync = now;
  DB.emit(P); DB.emit(`restos/${S.rid}/caisse`); return n;
}
