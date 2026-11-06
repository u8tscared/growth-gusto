/* Growth Gusto — area: banque (relevés bancaires → Finances)
   Two sources feed the same collection, gérant only (firestore.rules):
     · « Banque connectée »: the server (functions/src/banque.js, Enable Banking) writes restos/{rid}/bankTx/eb_* every 6 h.
     · « Import de relevé »: an OFX / CSV / Excel export from any bank, parsed here, written as bankTx/f_*.
   restos/{rid}/bankTx/{id}  { src:"banque"|"fichier", link, account, day, amount (€ TTC, positive), dir:"out"|"in", label, who, ref, at }
                             + fields set here: cat (chosen), ht (typed), sure (checked by the gérant)
   restos/{rid}/bank/{id}    eb_<session>: { kind:"api", bank, accounts[], validUntil, status, lastSync, lastError } (server)
                             file: { kind:"file", name, lastImport, count } · rules: { r: { key: cat } } · cfg: { achats: "banque"|"receptions" }
   Finances (js/finance.js finExp) asks bqExp(): every outgoing operation becomes a charge, HT estimated with the category's VAT.
   No double count: a manual charge with the same amount (±6 days) wins; a monthly charge (loyer…) is replaced by the bank in the months
   where the bank has that category; reception amounts are replaced by the bank purchases while the bank covers the period (cfg.achats). */

Object.assign(IC, {
  bqBank: ["M3 21h18", "M4 18h16", "M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7", "M12 3 3 8h18z"],
  bqSync: ["M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M3 21v-5h5"],
  bqUp: ["M12 15V3", "m7 8 5-5 5 5", "M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"],
  bqEye: ["M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z", "c:12,12,3"],
  bqOff: ["c:12,12,9", "m5.6 5.6 12.8 12.8"],
  bqTag: ["M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z", "c:7.5,7.5,1.5"],
});

const BQ_API = "https://europe-west9-growth-gusto.cloudfunctions.net/banqueApi";
/* charges counted in Finances (same keys as FIN_CATS) + VAT used to estimate the HT from the bank amount (TTC) */
const BQ_VAT = { achats: 0.07, loyer: 0.2, energie: 0.2, assurances: 0, entretien: 0.2, banque: 0, autres: 0.2 };
/* operations kept out of the charges, with the reason shown to the gérant */
const BQ_OFF = [
  { k: "salaires", t: "Salaires", ic: "users", why: "déjà comptés par la pointeuse" },
  { k: "social", t: "URSSAF, retraite", ic: "shield", why: "déjà dans la masse salariale chargée" },
  { k: "impots", t: "Impôts et TVA", ic: "receipt", why: "pas une charge d'exploitation" },
  { k: "emprunt", t: "Emprunt, leasing", ic: "finRepeat", why: "hors résultat d'exploitation" },
  { k: "retrait", t: "Retrait, virement interne", ic: "finCoin", why: "l'argent reste à vous" },
  { k: "perso", t: "Pas une charge", ic: "bqOff", why: "ignoré" },
];
const bqOffCat = (k) => BQ_OFF.find((c) => c.k === k) || null;
const bqCatT = (k) => (bqOffCat(k) || finCat(k)).t;
const bqCatIc = (k) => (bqOffCat(k) || finCat(k)).ic;

/* ───────── automatic sorting (French bank labels) ───────── */
const bqNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const BQ_GUESS = [
  ["salaires", /\b(salaires?|paie|acompte sal|net a payer|remuneration)\b/],
  ["social", /\b(urssaf|klesia|humanis|malakoff|ag2r|audiens|apicil|pro btp|mutuelle|prevoyance|retraite|pole emploi|france travail|dsn|medecine du travail|ast\b|cmb sante)\b/],
  ["impots", /\b(dgfip|impots?|tresor public|direction generale des finances|tva|cfe|cvae|taxe|amende|sie )\b/],
  ["emprunt", /\b(echeance pret|ech pret|remboursement pret|remb pret|pret n|credit n|emprunt|leasing|location financiere|grenke|locam|bnp lease|leasecom)\b/],
  ["retrait", /\b(retrait|ret dab|dab|distributeur|vir(ement)? (interne|compte a compte|permanent vers)|epargne|livret)\b/],
  ["banque", /\b(frais|commission|cotisation|agios|interets debiteurs|tenue de compte|abonnement (jazz|pro|offre)|forfait|sumup fee|stripe fee|commissions? cb|frais cb|tpe|monetique|lyra|payplug|zettle|ingenico|worldline)\b/],
  ["energie", /\b(edf|engie|totalenergies|total energies|ekwateur|ohm energie|mint energie|gaz de bordeaux|vattenfall|eni|alterna|primagaz|butagaz|antargaz|enercoop|veolia|suez|saur|eau de|eaux de|electricite|gaz)\b/],
  ["loyer", /\b(loyer|bail|sci|foncia|nexity|citya|immobili[a-z]*|syndic|charges locatives)\b/],
  ["assurances", /\b(axa|allianz|maaf|macif|maif|matmut|generali|groupama|hiscox|mma|gan|swisslife|swiss life|aviva|abeille|smabtp|assurances?|hiscox)\b/],
  ["achats", /\b(metro|promocash|transgourmet|pomona|episaveurs|passion froid|terre azur|sysco|brake|davigel|france boissons|c10|richard|boissons|cave|vins?|brasseur|brasserie|boucherie|charcuterie|poissonnerie|maree|primeur|fromagerie|boulangerie|rungis|grossiste|carrefour|leclerc|auchan|lidl|aldi|intermarche|super u|hyper u|monoprix|franprix|grand frais|biocoop|picard|cash|krill|socopa|bigard|labeyrie|lactalis|elle et vire|transgourmet|disvae|reynaud)\b/],
  ["entretien", /\b(nettoyage|maintenance|depannage|reparation|plomb[a-z]*|electricien|froid|frigoriste|hotte|leroy merlin|castorama|brico|manomano|bricorama|point p|rentokil|anticimex|hygiene|elis|initial|lavage|blanchisserie|pressing)\b/],
  ["autres", /\b(orange|sfr|bouygues|free|sosh|ovh|google|microsoft|apple|adobe|canva|amazon|amzn|uber|deliveroo|just eat|thefork|zenchef|sevenrooms|expert comptable|comptab[a-z]*|avocat|huissier|la poste|chronopost|ups|dhl|publicite|meta|facebook|instagram)\b/],
];
const BQ_STOP = new Set("prlv sepa prelevement prel cb carte paiement achat vir virement recu emis inst instantane de du des la le les ref reference mandat ech facture fact fac no n numero sa sas sarl eurl srl fr france paris lyon www com x".split(" "));
function bqKey(t) {
  const src = t.who || t.label || "";
  const w = bqNorm(src).split(" ").filter((x) => x.length > 1 && !BQ_STOP.has(x) && !/\d/.test(x));
  return w.slice(0, 2).join(" ");
}
function bqGuess(t) {
  const s = " " + bqNorm(`${t.who || ""} ${t.label || ""}`) + " ";
  for (const [cat, re] of BQ_GUESS) if (re.test(s)) return cat;
  return null;
}

/* ───────── state ───────── */
const BQ = { rid: null, tx: [], docs: [], ver: 0, memo: null, busy: false };
function bqWatch() {
  if (!S.ready || !S.rid || !S.resto || typeof attachedRid === "undefined" || attachedRid !== S.rid) return;
  if (BQ.rid === S.rid || !finIsGerant()) return;
  const rid = BQ.rid = S.rid; BQ.tx = []; BQ.docs = []; BQ.ver++;
  const w = (col, opts, cb) => DB.watch(col, opts, (rows) => { if (S.rid !== rid) return; cb(rows); BQ.ver++; BQ.memo = null; onData(); });
  w("bankTx", { order: "day", dir: "desc", limit: 6000 }, (rows) => { BQ.tx = rows; });
  w("bank", {}, (rows) => { BQ.docs = rows; });
}
setInterval(bqWatch, 900);
const bqLinks = () => BQ.docs.filter((d) => d.kind === "api" && d.status !== "off");
const bqFile = () => BQ.docs.find((d) => d.id === "file" && d.kind === "file") || null;
const bqRules = () => (BQ.docs.find((d) => d.id === "rules") || {}).r || {};
const bqCfg = () => BQ.docs.find((d) => d.id === "cfg") || {};
const bqOn = () => bqLinks().length > 0 || BQ.tx.length > 0;
const bqLive = () => DB.mode === "db" && !!DB.uid;

/* category of one operation: chosen by the gérant > « toujours » rule > guess */
function bqCat(t) {
  if (t.cat) return { cat: t.cat, sure: true };
  const k = bqKey(t); const r = k && bqRules()[k]; if (r) return { cat: r, sure: true, rule: true };
  const g = bqGuess(t); return { cat: g || "autres", sure: !!g && !t.dupe };
}
const bqHT = (t, cat) => (t.ht != null && !isNaN(t.ht) ? +t.ht : (+t.amount || 0) / (1 + (BQ_VAT[cat] ?? 0.2)));

/* everything Finances needs, computed once per data change */
function bqAll() {
  if (BQ.memo && BQ.memo.ver === BQ.ver && BQ.memo.exp === S.expenses) return BQ.memo;
  const manual = finAll("expenses").filter((e) => !e.recurring && !e.receptionId && +e.amountHT > 0);
  const rows = []; const cover = new Set(); let from = null, to = null;
  /* the same movement can come from several sources (bank link, Pennylane, an imported statement): keep the most direct one */
  const PRI = { banque: 0, pennylane: 1, fichier: 2 }; const pri = (t) => PRI[t.src] ?? 3; const byAmt = {};
  BQ.tx.forEach((t) => { (byAmt[t.dir + "|" + t.amount] ||= []).push(t); });
  const twin = (t) => (byAmt[t.dir + "|" + t.amount] || []).some((o) => o !== t && o.src !== t.src && pri(o) < pri(t) && o.day && Math.abs(finDays(o.day, t.day)) <= 2);
  BQ.tx.forEach((t) => {
    if (!t.day || twin(t)) return; if (!from || t.day < from) from = t.day; if (!to || t.day > to) to = t.day;
    if (t.dir !== "out") return;
    const c = bqCat(t); const off = !!bqOffCat(c.cat); const ht = off ? 0 : bqHT(t, c.cat);
    /* the same charge typed by hand: keep the typed one */
    const dup = !off && !t.cat ? manual.find((e) => e.cat === c.cat && Math.abs(finDays(e.day, t.day)) <= 6 && (Math.abs(e.amountHT - t.amount) <= Math.max(0.5, t.amount * 0.01) || Math.abs(e.amountHT * (1 + (BQ_VAT[c.cat] ?? 0.2)) - t.amount) <= Math.max(0.5, t.amount * 0.02))) : null;
    const row = { t, cat: c.cat, sure: c.sure, rule: c.rule, off, ht, dup: dup ? dup.id : null };
    rows.push(row);
    if (!off && !dup) cover.add(t.day.slice(0, 7) + "|" + c.cat);
  });
  BQ.memo = { ver: BQ.ver, exp: S.expenses, rows, cover, from, to };
  return BQ.memo;
}
/* called by finExp (js/finance.js) */
function bqExp(from, to) {
  if (!BQ.tx.length) return null;
  const A = bqAll(); const cfg = bqCfg();
  const items = A.rows.filter((r) => !r.off && !r.dup && r.t.day >= from && r.t.day <= to)
    .map((r) => ({ id: r.t.id, bank: true, cat: r.cat, day: r.t.day, label: bqLabel(r.t), supplier: r.t.who || "", ht: r.ht }));
  return { items, cover: A.cover, from: A.from, to: A.to, achatsBank: cfg.achats !== "receptions" };
}
/* bank labels are shouty and full of references: keep the words */
function bqLabel(t) {
  let s = String(t.who || t.label || "Opération").replace(/\b(PRLV|PRELEVEMENT|SEPA|PAIEMENT PAR CARTE|PAIEMENT|ACHAT|CB|CARTE|VIR(EMENT)?( SEPA)?( INST(ANTANE)?)?( RECU| EMIS)?|FACTURE CARTE|DU \d{2}\/?\d{2}(\/?\d{2,4})?)\b/gi, " ")
    .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, " ").replace(/\b(?=[A-Z]*\d)[A-Z0-9]{8,}\b/g, " ").replace(/\s+/g, " ").trim();
  if (!s) s = String(t.label || "Opération").trim();
  return s.length > 3 && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'\-])\p{L}/gu, (m) => m.toUpperCase()) : s;
}

/* ───────── server ───────── */
async function bqCall(op, body = {}) {
  const u = typeof firebase !== "undefined" && firebase.auth && firebase.auth().currentUser; if (!u) throw Object.assign(new Error("auth"), { code: "auth" });
  const tok = await u.getIdToken();
  let r; try { r = await fetch(BQ_API, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify({ op, rid: S.rid, ...body }) }); }
  catch (e) { throw Object.assign(new Error("http"), { code: "http" }); }
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(j.error || "http " + r.status), { code: j.error || "http" }); return j;
}
const BQ_ERR = {
  auth: "Connectez-vous à votre compte pour relier la banque.", forbidden: "Seul le gérant peut relier la banque.", state: "Le lien a expiré. Recommencez la connexion.",
  denied: "Connexion annulée à la banque.", not_configured: "La connexion directe s'active très bientôt. En attendant, importez un relevé : c'est gratuit et ça marche avec toutes les banques.",
  http: "Le serveur ne répond pas. Réessayez dans un instant, ou importez un relevé.", refused: "La banque a refusé la demande. Réessayez, ou importez un relevé.", no_account: "Aucun compte trouvé à cette banque.",
  unauthorized: "Cette banque n'est pas encore ouverte pour votre compte. Importez un relevé en attendant.", rate: "La banque limite les lectures. Réessayez dans quelques heures.", plan: "La connexion directe est comprise dans l'abonnement Chef. Importez un relevé en attendant.",
};
const bqErr = (e) => BQ_ERR[e && e.code] || "Connexion impossible pour l'instant. Réessayez, ou importez un relevé.";

/* retour de la banque : https://app.growthgusto.fr/?code=…&state=bq_… */
(function bqCatchReturn() {
  try {
    const u = new URL(location.href); const st = u.searchParams.get("state") || ""; if (!st.startsWith("bq_")) return;
    sessionStorage.setItem("gg-bq-ret", JSON.stringify({ state: st, code: u.searchParams.get("code") || "", error: u.searchParams.get("error") || "" }));
    ["code", "state", "error", "error_description"].forEach((k) => u.searchParams.delete(k));
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (e) {}
})();
async function bqReturn() {
  let ret = null; try { ret = JSON.parse(sessionStorage.getItem("gg-bq-ret") || "null"); sessionStorage.removeItem("gg-bq-ret"); } catch (e) {}
  if (!ret || !S.resto) return; go("finance");
  if (ret.error || !ret.code) { SFX.err(); toast(BQ_ERR.denied, "err"); return; }
  BQ.busy = true; refresh();
  try { const r = await bqCall("finish", ret); SFX.done(); buzz([10, 40, 10]); burst(); toast(`${r.bank} est reliée · ${r.added} opération${r.added > 1 ? "s" : ""}`); }
  catch (e) { SFX.err(); toast(bqErr(e), "err"); }
  BQ.busy = false; refresh();
}
window.addEventListener("gg:ready", () => setTimeout(() => { try { bqWatch(); bqReturn(); } catch (e) { console.warn(e); } }, 450));

/* ───────── card in Finances ───────── */
const bqEur = (v, d) => finEur(v, d);
function bqAgo(ts) { if (!ts) return "pas encore"; const m = Math.round((Date.now() - ts) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; if (m < 24 * 60) return `il y a ${Math.round(m / 60)} h`; return `le ${shortDate(dayKey(new Date(ts)))}`; }
function bqMono(name) { const w = String(name || "B").replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase(); }
function bqLogo(name, logo, cls = "") { const k = bqNorm(name).split(" ")[0]; if (!logo && typeof BRAND_LOGOS !== "undefined" && BRAND_LOGOS[k]) logo = `img/logos/${k}.${BRAND_LOGOS[k]}`; return `<span class="bq-logo ${cls}">${logo ? `<img src="${esc(logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<b>${esc(bqMono(name))}</b></span>`; }
function bqCard(P) {
  if (!finIsGerant()) return "";
  const links = bqLinks(); const file = bqFile();
  if (!links.length && !BQ.tx.length) {
    return `<div class="glass pad bq-card bq-new st" style="--i:2"><div class="row"><span class="lbl">${ico("bqBank")}Banque</span></div>
      <div class="bq-hook"><span class="bq-well">${ico("bqBank")}</span><div><b>Vos dépenses, sans rien saisir</b><p class="sub">Reliez le compte pro : prélèvements, cartes et virements arrivent ici, déjà rangés par catégorie.</p></div></div>
      <button class="btn acc block" data-act="bqConnect" ${BQ.busy ? "disabled" : ""}>${ico("bqBank")}${BQ.busy ? "Connexion…" : "Relier ma banque"}</button>
      <button class="btn soft block" data-act="bqImport">${ico("bqUp")}Importer un relevé (OFX, CSV)</button>
      <p class="note bq-safe">${ico("finLock")}Lecture seule : Growth Gusto ne peut faire aucun paiement.</p></div>`;
  }
  const A = bqAll(); const inP = A.rows.filter((r) => r.t.day >= P.from && r.t.day <= P.to);
  const counted = inP.filter((r) => !r.off && !r.dup); const tot = counted.reduce((a, r) => a + r.ht, 0);
  const todo = A.rows.filter((r) => !r.sure && !r.off && !r.dup).length;
  const accRows = links.map((L) => {
    const err = L.status === "error" || L.status === "expired";
    return (L.accounts || []).map((a) => `<div class="bq-acc ${err ? "bad" : ""}">${bqLogo(L.bank, L.logo)}<span class="tx"><b>${esc(L.bank)}${a.name ? ` · ${esc(a.name)}` : ""}</b><em>${a.iban ? `•• ${esc(a.iban)} · ` : ""}${err ? esc(L.lastError || "À reconnecter") : `synchro ${bqAgo(L.lastSync || L.connectedAt)}`}</em></span>${err ? `<button class="btn soft sm" data-act="bqConnect">Reconnecter</button>` : a.balance != null ? `<span class="mono bq-bal">${bqEur(a.balance, 0)}</span>` : ""}</div>`).join("");
  }).join("");
  const pl = BQ.tx.filter((t) => t.src === "pennylane");
  const plRow = pl.length ? `<div class="bq-acc">${bqLogo("Pennylane", "")}<span class="tx"><b>Banque via Pennylane</b><em>${pl.length} opération${pl.length > 1 ? "s" : ""} · dernière le ${esc(shortDate(pl.reduce((m, t) => (t.day > m ? t.day : m), "")))}</em></span></div>` : "";
  const fileRow = file ? `<div class="bq-acc">${`<span class="bq-logo">${ico("bqUp")}</span>`}<span class="tx"><b>Relevé importé</b><em>${esc(file.name || "fichier")} · ${bqAgo(file.lastImport)}</em></span></div>` : "";
  return `<div class="glass pad bq-card st" style="--i:2"><div class="row"><span class="lbl">${ico("bqBank")}Banque</span>
      <span class="bq-tools">${links.length ? `<button class="iconbtn sm ${BQ.busy ? "spin" : ""}" data-act="bqSync" aria-label="Synchroniser maintenant" title="Synchroniser">${ico("bqSync")}</button>` : ""}<button class="iconbtn sm" data-act="bqSettings" aria-label="Réglages de la banque" title="Réglages">${ico("sliders")}</button></span></div>
    <div class="bq-accs">${accRows}${plRow}${fileRow}</div>
    <button class="bq-sum" data-act="bqList"><span class="tx"><b>${counted.length} dépense${counted.length > 1 ? "s" : ""} comptée${counted.length > 1 ? "s" : ""}</b><em>${esc(P.lab)} · ${bqEur(tot, 0)} HT${inP.length - counted.length > 0 ? ` · ${inP.length - counted.length} mise${inP.length - counted.length > 1 ? "s" : ""} de côté` : ""}</em></span>${todo ? `<span class="pill warn">${todo} à vérifier</span>` : ""}${ico("chev")}</button>
    ${!links.length && !pl.length ? `<button class="btn soft block sm" data-act="bqConnect">${ico("bqBank")}Relier la banque pour tout recevoir seul</button>` : ""}</div>`;
}

/* ───────── list of operations ───────── */
function bqListSheet(f) {
  const U = finUi(); const P = finPeriod(U.kind, U.off); const A = bqAll();
  S.ui.bqF = f = f || S.ui.bqF || (A.rows.some((r) => !r.sure && !r.off && !r.dup) ? "todo" : "all");
  const inP = A.rows.filter((r) => r.t.day >= P.from && r.t.day <= P.to);
  const todoAll = A.rows.filter((r) => !r.sure && !r.off && !r.dup);
  const sets = { todo: todoAll, all: inP.filter((r) => !r.off && !r.dup), off: inP.filter((r) => r.off || r.dup) };
  const list = (sets[f] || sets.all).slice(0, 250);
  const chip = (k, t, n) => `<button class="chip ${f === k ? "on" : ""}" data-act="bqF" data-v="${k}">${t}${n ? ` <b class="mono">${n}</b>` : ""}</button>`;
  let lastDay = "";
  const rows = list.map((r) => {
    const head = r.t.day !== lastDay ? `<div class="bq-day">${esc(finCap(parseDay(r.t.day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))}</div>` : ""; lastDay = r.t.day;
    const why = r.dup ? "déjà saisie à la main" : r.off ? (bqOffCat(r.cat) || {}).why : r.sure ? bqCatT(r.cat) : `${bqCatT(r.cat)} ?`;
    return `${head}<button class="li tap bq-tx ${r.off || r.dup ? "off" : ""} ${!r.sure && !r.off && !r.dup ? "todo" : ""}" data-act="bqTx" data-id="${esc(r.t.id)}"><span class="bq-cic">${ico(r.dup ? "check" : bqCatIc(r.cat))}</span><span class="tx"><b>${esc(bqLabel(r.t))}</b><em>${esc(why)}</em></span><span class="mono bq-amt">−${bqEur(r.t.amount, 2)}</span></button>`;
  }).join("");
  openSheet(`<div class="fin-sh bq-sh"><div class="h2">Opérations bancaires</div><div class="sub">${f === "todo" ? "Toutes périodes" : esc(P.lab)} · montants TTC</div>
    <div class="chips bq-chips">${chip("todo", "À vérifier", todoAll.length)}${chip("all", "Comptées", sets.all.length)}${chip("off", "Mises de côté", sets.off.length)}</div>
    ${f === "todo" && todoAll.length ? `<p class="note" style="margin:0">Rangées au mieux d'après le libellé. Touchez une ligne pour corriger, ou validez tout d'un coup.</p>` : ""}
    <div class="fin-items bq-list">${rows || `<div class="empty fin-empty"><span class="ic">${ico("check")}</span><b>${f === "todo" ? "Tout est rangé" : "Rien sur cette période"}</b></div>`}</div>
    ${f === "todo" && todoAll.length ? `<button class="btn acc block" data-act="bqOkAll">${ico("check")}Tout valider (${todoAll.length})</button>` : ""}
    ${(sets[f] || []).length > 250 ? `<p class="note" style="margin:0">250 premières lignes affichées. L'export CSV des Finances contient tout.</p>` : ""}</div>`);
}

/* ───────── one operation ───────── */
function bqTxSheet(id) {
  const t = BQ.tx.find((x) => x.id === id); if (!t) return;
  const c = bqCat(t); const k = bqKey(t);
  S.ui.bqX = { id, cat: c.cat, always: !!k, ht: t.ht != null ? fmt(t.ht, 2) : "", key: k };
  const paint = () => {
    const x = S.ui.bqX; const off = !!bqOffCat(x.cat); const est = (+t.amount || 0) / (1 + (BQ_VAT[x.cat] ?? 0.2));
    const cb = (cat) => `<button class="fin-catb ${x.cat === cat.k ? "on" : ""}" data-act="bqXCat" data-v="${cat.k}" role="radio" aria-checked="${x.cat === cat.k}">${ico(cat.ic)}<span>${cat.t}</span></button>`;
    openSheet(`<div class="fin-sh bq-sh"><div class="bq-xh"><span class="bq-cic big">${ico(bqCatIc(x.cat))}</span><div><div class="h2">${esc(bqLabel(t))}</div><div class="sub">${esc(shortDate(t.day))} · <b class="mono">−${bqEur(t.amount, 2)}</b> TTC${t.src === "fichier" ? " · relevé importé" : t.src === "pennylane" ? " · via Pennylane" : ""}</div></div></div>
      <p class="bq-raw mono">${esc(t.label)}${t.who && !String(t.label).includes(t.who) ? ` · ${esc(t.who)}` : ""}</p>
      <span class="lbl">Compter dans les charges</span>
      <div class="fin-catgrid" role="radiogroup" aria-label="Catégorie">${FIN_CATS.map(cb).join("")}</div>
      <span class="lbl">Ne pas compter</span>
      <div class="fin-catgrid bq-offgrid" role="radiogroup" aria-label="Mise de côté">${BQ_OFF.map(cb).join("")}</div>
      ${off ? `<p class="note" style="margin:0">${esc(bqOffCat(x.cat).why)} : cette opération ne compte pas dans les Finances.</p>`
        : `<label class="fin-amtin"><span class="lbl">Montant HT</span><span class="w"><input class="input mono" id="bqXHt" inputmode="decimal" value="${esc(x.ht)}" placeholder="${esc(fmt(est, 2))}" autocomplete="off" enterkeyhint="done"><b>€</b></span></label>
           <p class="note" style="margin:-4px 0 0">Laissé vide : ${bqEur(est, 2)} HT, estimé avec une TVA de ${Math.round((BQ_VAT[x.cat] ?? 0.2) * 1000) / 10} %.</p>`}
      ${x.key ? `<label class="bq-always"><input type="checkbox" id="bqXAlw" ${x.always ? "checked" : ""}><span>Toujours ranger « ${esc(x.key)} » ici</span></label>` : ""}
      <button class="btn acc block" data-act="bqXSave">${ico("check")}Enregistrer</button></div>`);
  };
  S.ui.bqXPaint = paint; paint();
}
const bqXGrab = () => { const x = S.ui.bqX; if (!x) return; const h = $("#bqXHt"); if (h) x.ht = h.value; const a = $("#bqXAlw"); if (a) x.always = a.checked; };

/* ───────── connect: bank picker ───────── */
const BQ_DEMO_BANKS = ["BNP Paribas", "Crédit Agricole", "Société Générale", "LCL", "Banque Populaire", "Caisse d'Epargne", "Crédit Mutuel", "CIC", "La Banque Postale", "Qonto", "Shine", "Boursorama", "HSBC", "Revolut Business", "Crédit Coopératif", "Banque Palatine"].map((name) => ({ name, logo: "" }));
/* the direct link costs Growth Gusto a few € per account and month: only paying Chef (complet) restaurants, plus the Growth Gusto team */
function bqPaidOk() {
  if (!bqLive()) return true;
  try { const em = (firebase.auth().currentUser || {}).email || ""; if ((window.GG_ADMINS || []).includes(em)) return true; } catch (e) {}
  try { return typeof abPlan !== "function" || abPlan().plan === "complet"; } catch (e) { return true; }
}
async function bqConnect() {
  if (!finIsGerant()) { SFX.err(); toast("Réservé au gérant", "err"); return; }
  if (!bqPaidOk()) {
    openSheet(`<div class="fin-sh bq-sh"><div class="bq-xh"><span class="bq-cic big">${ico("bqBank")}</span><div><div class="h2">Connexion directe à la banque</div><div class="sub">Comprise dans l'abonnement Chef</div></div></div>
      <p class="sub" style="margin:0">Une fois abonné, vos opérations arrivent toutes seules toutes les 6 heures. D'ici là, importez un relevé : même résultat, en un fichier.</p>
      <button class="btn acc block" data-act="bqImport">${ico("bqUp")}Importer un relevé</button>
      ${typeof VIEWS !== "undefined" && VIEWS.abonnement ? `<button class="btn soft block" data-go="abonnement">Voir l'abonnement</button>` : ""}</div>`);
    return;
  }
  S.ui.bqB = { q: "", psu: "business", list: bqLive() ? null : BQ_DEMO_BANKS, err: "" };
  bqBankPaint();
  if (bqLive()) {
    try { const r = await bqCall("banks"); S.ui.bqB.list = r.banks || []; }
    catch (e) { S.ui.bqB.err = bqErr(e); S.ui.bqB.list = []; }
    if ($("#bqBankList")) bqBankPaint(true);
  }
}
function bqBankPaint(keep) {
  const B = S.ui.bqB; if (!B) return;
  const q = bqNorm(B.q); const L = (B.list || []).filter((b) => !q || bqNorm(b.name).includes(q));
  const html = B.err ? `<div class="bq-err">${ico("alert")}<span>${esc(B.err)}</span></div><button class="btn acc block" data-act="bqImport">${ico("bqUp")}Importer un relevé</button>`
    : !B.list ? `<div class="bq-load">${[0, 1, 2, 3, 4].map(() => `<i></i>`).join("")}</div>`
    : L.length ? L.slice(0, 80).map((b) => `<button class="li tap bq-bk" data-act="bqPick" data-v="${esc(b.name)}">${bqLogo(b.name, b.logo)}<span class="tx"><b>${esc(b.name)}</b>${b.beta ? `<em>bêta</em>` : ""}</span>${ico("chev")}</button>`).join("")
    : `<div class="empty fin-empty"><b>Aucune banque « ${esc(B.q)} »</b>Importez un relevé : ça marche avec toutes les banques.</div>`;
  if (keep && $("#bqBankList")) { $("#bqBankList").innerHTML = html; return; }
  openSheet(`<div class="fin-sh bq-sh"><div class="h2">Relier ma banque</div>
    <p class="sub" style="margin:0">Vous vous connectez sur le site de votre banque, jamais chez nous. Accès en lecture seule, renouvelé tous les 6 mois.</p>
    <div class="seg bq-psu"><button class="${B.psu === "business" ? "on" : ""}" data-act="bqPsu" data-v="business">Compte pro</button><button class="${B.psu === "personal" ? "on" : ""}" data-act="bqPsu" data-v="personal">Compte perso</button><span class="knob" style="width:calc(50% - 4px);transform:translateX(${B.psu === "personal" ? "100%" : "0"})"></span></div>
    <label class="bq-search">${ico("search")}<input class="input" id="bqQ" placeholder="Chercher votre banque" value="${esc(B.q)}" autocomplete="off" enterkeyhint="search"></label>
    <div class="fin-items bq-banks" id="bqBankList">${html}</div>
    <button class="btn ghost block sm" data-act="bqImport">${ico("bqUp")}Plutôt importer un relevé</button></div>`, (b) => {
    const i = $("#bqQ", b); if (i) i.addEventListener("input", () => { S.ui.bqB.q = i.value; bqBankPaint(true); });
  });
}
async function bqPick(name) {
  const B = S.ui.bqB || {}; SFX.tap();
  if (!bqLive()) { closeSheet(true); BQ.busy = true; refresh(); setTimeout(() => { bqDemoSeed(name); BQ.busy = false; SFX.done(); burst(); toast(`${name} est reliée (démo)`); refresh(); }, 1100); return; }
  const btn = $(`[data-act="bqPick"][data-v="${CSS.escape(name)}"]`); if (btn) btn.classList.add("busy");
  try { const r = await bqCall("start", { bank: name, psu: B.psu }); location.href = r.url; }
  catch (e) { if (btn) btn.classList.remove("busy"); SFX.err(); toast(bqErr(e), "err"); }
}

/* ───────── import: OFX / CSV / Excel ───────── */
function bqHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
function bqOfx(text) {
  const out = []; const get = (b, k) => { const m = b.match(new RegExp(`<${k}>\\s*([^<\\r\\n]*)`, "i")); return m ? m[1].trim() : ""; };
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  blocks.forEach((b) => {
    const d = get(b, "DTPOSTED") || get(b, "DTUSER"); const amt = cxNum(get(b, "TRNAMT"));
    if (!/^\d{8}/.test(d) || amt == null) return;
    const name = get(b, "NAME"), memo = get(b, "MEMO");
    out.push({ day: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, amount: amt, label: [name, memo && memo !== name ? memo : ""].filter(Boolean).join(" ").replace(/&amp;/g, "&"), ext: get(b, "FITID") });
  });
  return out;
}
function bqTable(rows) {
  const N = (s) => bqNorm(s);
  let hi = -1, H = [];
  for (let i = 0; i < Math.min(rows.length, 30); i++) { const h = rows[i].map((c) => N(c)); if (h.some((c) => /^date/.test(c)) && h.some((c) => /montant|debit|credit|amount|somme/.test(c))) { hi = i; H = h; break; } }
  if (hi < 0) return null;
  const find = (re, not) => H.findIndex((c) => re.test(c) && !(not && not.test(c)));
  let cDate = find(/^date (de l )?op|^date comptable|^date$|^date operation/); if (cDate < 0) cDate = find(/^date/, /valeur/); if (cDate < 0) cDate = find(/^date/);
  const cLab = find(/libelle|label|description|intitule|detail|nature|operation|motif/, /date|complementaire|type/);
  const cLab2 = find(/complementaire|info|detail/, /date/);
  const cWho = find(/tiers|beneficiaire|contrepartie|marchand|fournisseur|creancier/);
  const cAmt = find(/^montant|amount|somme/, /devise|origine/); const cDeb = find(/debit/); const cCred = find(/credit/, /carte/);
  if (cDate < 0 || (cAmt < 0 && cDeb < 0)) return null;
  const out = [];
  rows.slice(hi + 1).forEach((r) => {
    const day = cxDay(r[cDate]); if (!day) return;
    let amt = null;
    if (cAmt >= 0 && cxNum(r[cAmt]) != null) amt = cxNum(r[cAmt]);
    else { const d = cDeb >= 0 ? cxNum(r[cDeb]) : null, c = cCred >= 0 ? cxNum(r[cCred]) : null; if (d != null && d !== 0) amt = -Math.abs(d); else if (c != null && c !== 0) amt = Math.abs(c); }
    if (amt == null || !amt) return;
    const label = [cLab >= 0 ? r[cLab] : "", cLab2 >= 0 && cLab2 !== cLab ? r[cLab2] : ""].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
    out.push({ day, amount: amt, label: label || "Opération", who: cWho >= 0 ? String(r[cWho] || "").trim() : "" });
  });
  return out;
}
async function bqImport() {
  if (!finIsGerant()) { SFX.err(); toast("Réservé au gérant", "err"); return; }
  const f = await new Promise((res) => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".ofx,.qfx,.csv,.txt,.tsv,.xlsx,text/csv,application/x-ofx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    inp.style.display = "none"; document.body.appendChild(inp); let done = false;
    const end = (x) => { if (done) return; done = true; inp.remove(); res(x); };
    inp.addEventListener("change", () => end(inp.files && inp.files[0])); inp.addEventListener("cancel", () => end(null));
    window.addEventListener("focus", () => setTimeout(() => { if (!(inp.files && inp.files.length)) end(null); }, 1500), { once: true });
    inp.click();
  });
  if (!f) return;
  let ops = null;
  try {
    const buf = await f.arrayBuffer(); const u8 = new Uint8Array(buf.slice(0, 4));
    if (u8[0] === 0x50 && u8[1] === 0x4b && typeof cxXlsx === "function") ops = bqTable(await cxXlsx(buf));
    else {
      let t = new TextDecoder("utf-8").decode(buf); if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
      ops = /<OFX>|<STMTTRN>/i.test(t) ? bqOfx(t) : bqTable(cxCsv(t));
    }
  } catch (e) { console.warn(e); ops = null; }
  if (!ops || !ops.length) { SFX.err(); openSheet(`<div class="fin-sh bq-sh"><div class="h2">Fichier non reconnu</div><p class="sub" style="margin:0">Il faut un relevé avec au moins une date, un libellé et un montant (ou débit / crédit).</p><div class="bq-how"><b>Où le trouver</b><span>Sur le site de la banque : Comptes → Télécharger ou Exporter les opérations → format <b>OFX</b> (le plus sûr) ou CSV / Excel.</span></div><button class="btn acc block" data-act="bqImport">${ico("bqUp")}Choisir un autre fichier</button></div>`); return; }
  /* ids: same day + amount + label, numbered when they repeat in the file, so a second import of an overlapping file adds nothing */
  const seen = {}; const rows = ops.map((o) => { const k = `${o.day}|${o.amount}|${bqNorm(o.label)}`; seen[k] = (seen[k] || 0) + 1; return { ...o, id: "f_" + bqHash(k + "|" + seen[k]) + bqHash(k).slice(0, 3) }; });
  const have = new Set(BQ.tx.map((t) => t.id));
  const api = BQ.tx.filter((t) => t.src === "banque" || t.src === "pennylane"); /* the connected bank already has it: skip */
  const fresh = rows.filter((r) => !have.has(r.id) && !api.some((t) => t.amount === Math.round(Math.abs(r.amount) * 100) / 100 && (t.dir === "out") === (r.amount < 0) && Math.abs(finDays(t.day, r.day)) <= 2));
  const outs = fresh.filter((r) => r.amount < 0); const days = rows.map((r) => r.day).sort();
  S.ui.bqImp = { name: f.name, rows: fresh, total: rows.length };
  openSheet(`<div class="fin-sh bq-sh"><div class="bq-xh"><span class="bq-cic big">${ico("bqUp")}</span><div><div class="h2">${esc(f.name)}</div><div class="sub">${rows.length} opération${rows.length > 1 ? "s" : ""} du ${esc(shortDate(days[0]))} au ${esc(shortDate(days[days.length - 1]))}</div></div></div>
    <div class="bq-imp"><div><b class="mono">${outs.length}</b><span>dépenses nouvelles</span></div><div><b class="mono">${bqEur(outs.reduce((a, r) => a - r.amount, 0), 0)}</b><span>TTC</span></div><div><b class="mono">${rows.length - fresh.length}</b><span>déjà là</span></div></div>
    <p class="note" style="margin:0">Chaque dépense est rangée d'après son libellé. Les salaires, l'URSSAF, les impôts et les retraits sont mis de côté. Les entrées d'argent ne comptent pas : le chiffre d'affaires vient des tickets Z.</p>
    <button class="btn acc block" data-act="bqImpOk" ${fresh.length ? "" : "disabled"}>${ico("check")}${fresh.length ? `Ajouter ${fresh.length} opération${fresh.length > 1 ? "s" : ""}` : "Rien de nouveau"}</button></div>`);
}
async function bqImpOk() {
  const I = S.ui.bqImp; if (!I || !I.rows.length) return; const at = Date.now();
  const btn = $(`[data-act="bqImpOk"]`); if (btn) { btn.disabled = true; btn.textContent = "Ajout…"; }
  try {
    for (let i = 0; i < I.rows.length; i += 40) {
      await Promise.all(I.rows.slice(i, i + 40).map((r) => DB.set("bankTx", r.id, { src: "fichier", link: "file", account: "file", day: r.day, amount: Math.round(Math.abs(r.amount) * 100) / 100, dir: r.amount < 0 ? "out" : "in", label: String(r.label).slice(0, 200), who: String(r.who || "").slice(0, 100), ref: String(r.ext || "").slice(0, 60), at })));
    }
    const prev = bqFile();
    await DB.set("bank", "file", { kind: "file", name: I.name, lastImport: at, count: (prev && prev.count || 0) + I.rows.length });
  } catch (e) { SFX.err(); toast("Import interrompu : vérifiez la connexion et réessayez.", "err"); if (btn) btn.disabled = false; return; }
  logEvent("expense", `a importé un relevé bancaire : ${I.rows.length} opérations`);
  S.ui.bqImp = null; closeSheet(true); SFX.done(); buzz([10, 40, 10]); burst(); toast(`${I.rows.length} opération${I.rows.length > 1 ? "s" : ""} ajoutée${I.rows.length > 1 ? "s" : ""}`);
}

/* ───────── settings ───────── */
function bqSettingsSheet() {
  const links = bqLinks(); const cfg = bqCfg(); const file = bqFile(); const a = cfg.achats === "receptions" ? "receptions" : "banque";
  openSheet(`<div class="fin-sh bq-sh"><div class="h2">Banque</div>
    <span class="lbl">Achats matières</span>
    <div class="seg bq-psu"><button class="${a === "banque" ? "on" : ""}" data-act="bqAch" data-v="banque">Depuis la banque</button><button class="${a === "receptions" ? "on" : ""}" data-act="bqAch" data-v="receptions">Depuis les réceptions</button><span class="knob" style="width:calc(50% - 4px);transform:translateX(${a === "receptions" ? "100%" : "0"})"></span></div>
    <p class="note" style="margin:-4px 0 0">${a === "banque" ? "Les paiements aux fournisseurs comptent comme achats. Les montants notés à la réception restent visibles mais ne sont pas comptés deux fois." : "Les montants notés à chaque réception font les achats. Les paiements fournisseurs de la banque sont mis de côté."}</p>
    <span class="lbl">Comptes reliés</span>
    <div class="fin-items">${links.map((L) => `<div class="li bq-set">${bqLogo(L.bank, L.logo)}<span class="tx"><b>${esc(L.bank)}</b><em>${(L.accounts || []).length} compte${(L.accounts || []).length > 1 ? "s" : ""}${L.validUntil ? ` · accès jusqu'au ${esc(shortDate(String(L.validUntil).slice(0, 10)))}` : ""}</em></span><button class="btn soft sm" data-act="bqOff" data-id="${esc(L.id)}">Délier</button></div>`).join("")}
      ${file ? `<div class="li bq-set"><span class="bq-logo">${ico("bqUp")}</span><span class="tx"><b>Relevés importés</b><em>${file.count || 0} opérations · dernier : ${esc(file.name || "")}</em></span></div>` : ""}
      ${!links.length && !file ? `<div class="empty fin-empty"><b>Aucun compte</b></div>` : ""}</div>
    <div class="grid2"><button class="btn soft" data-act="bqConnect">${ico("bqBank")}Relier une banque</button><button class="btn soft" data-act="bqImport">${ico("bqUp")}Importer</button></div>
    ${BQ.tx.length ? `<span class="lbl">Comptabilité</span><button class="btn soft block" data-act="bqAcc">${ico("download")}Journal de banque pour le comptable (CSV)</button><p class="note" style="margin:-4px 0 0">Période affichée dans les Finances, au plan comptable : charges HT, TVA déductible, banque 512. S'importe dans Pennylane, Tiime, Cegid ou chez votre expert-comptable.</p>` : ""}
    ${Object.keys(bqRules()).length ? `<button class="btn ghost block sm" data-act="bqRulesReset">${ico("bqTag")}Oublier mes ${Object.keys(bqRules()).length} règles de rangement</button>` : ""}</div>`);
}

/* ───────── export for the accountant: bank journal (CSV, French chart of accounts) ─────────
   Every bank movement of the period, in double entry: charge account (HT) + TVA déductible 44566 / bank 512, so an accounting tool
   (Pennylane, Tiime, Cegid, ACD, Inqom…) or the accountant imports it as the « BQ » journal. Credits go to 471 (à affecter by the accountant):
   the turnover itself comes from the Z tickets. Same cat → account map later for a direct accounting connection. */
const BQ_PCG = { achats: ["601000", "Achats matières premières"], loyer: ["613200", "Locations immobilières"], energie: ["606100", "Eau, énergie"], assurances: ["616000", "Assurances"],
  entretien: ["615000", "Entretien et réparations"], banque: ["627000", "Services bancaires"], autres: ["628000", "Charges diverses"], salaires: ["421000", "Personnel, rémunérations dues"],
  social: ["431000", "Sécurité sociale"], impots: ["635000", "Impôts et taxes"], emprunt: ["164000", "Emprunts"], retrait: ["580000", "Virements internes"], perso: ["455000", "Compte courant d'associé"] };
const bqPcg = (cat, t) => (cat === "impots" && /\btva\b/.test(bqNorm(t.label)) ? ["445510", "TVA à décaisser"] : BQ_PCG[cat] || BQ_PCG.autres);
async function bqAccExport() {
  const U = finUi(); const P = finPeriod(U.kind, U.off); const to = finEffTo(P); const A = bqAll();
  const n2 = (v) => (v ? (Math.round(v * 100) / 100).toFixed(2).replace(".", ",") : "");
  const fr = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const rows = [["Date", "Journal", "Compte", "Intitulé du compte", "Libellé", "Pièce", "Débit", "Crédit", "Catégorie Growth Gusto"]];
  const tx = BQ.tx.filter((t) => t.day >= P.from && t.day <= to).sort((a, b) => a.day.localeCompare(b.day));
  let n = 0;
  tx.forEach((t) => {
    const lab = bqLabel(t).slice(0, 60); const pc = "BQ" + String(++n).padStart(4, "0"); const ttc = +t.amount || 0;
    if (t.dir === "in") { rows.push([fr(t.day), "BQ", "512000", "Banque", lab, pc, n2(ttc), "", "Entrée"], [fr(t.day), "BQ", "471000", "Compte d'attente", lab, pc, "", n2(ttc), "Entrée"]); return; }
    const r = A.rows.find((x) => x.t.id === t.id); const cat = r ? r.cat : "autres"; const [acc, accT] = bqPcg(cat, t);
    const off = !!bqOffCat(cat); const ht = off ? ttc : Math.min(ttc, bqHT(t, cat)); const tva = off ? 0 : Math.round((ttc - ht) * 100) / 100;
    rows.push([fr(t.day), "BQ", acc, accT, lab, pc, n2(ttc - tva), "", bqCatT(cat)]);
    if (tva > 0.004) rows.push([fr(t.day), "BQ", "445660", "TVA déductible", lab, pc, n2(tva), "", bqCatT(cat)]);
    rows.push([fr(t.day), "BQ", "512000", "Banque", lab, pc, "", n2(ttc), bqCatT(cat)]);
  });
  if (rows.length < 2) { SFX.err(); toast("Aucune opération bancaire sur cette période", "err"); return; }
  await saveCsv(`journal-banque-${P.from}-${P.kind}.csv`, rows);
  SFX.ok(); toast(`${n} opération${n > 1 ? "s" : ""} exportée${n > 1 ? "s" : ""} pour le comptable`);
}

/* ───────── demo ───────── */
function bqDemoSeed(bank) {
  const now = Date.now(); const day = (n) => dayKey(new Date(now - n * 864e5));
  DB.set("bank", "eb_demo", { kind: "api", bank: bank || "Crédit Agricole", accounts: [{ uid: "d1", name: "Compte pro", iban: "4821", currency: "EUR", balance: 18452.3 }], status: "connected", lastSync: now - 2 * 36e5, connectedAt: now, validUntil: new Date(now + 178 * 864e5).toISOString() });
  const T = []; const add = (n, amount, label, who = "", dir = "out") => T.push({ day: day(n), amount, label, who, dir });
  for (let w = 0; w < 10; w++) { add(2 + w * 7, 380 + ((w * 137) % 340), "PAIEMENT CB METRO NANTERRE", "METRO"); add(4 + w * 7, 160 + ((w * 71) % 120), "PRLV SEPA POMONA TERREAZUR", "POMONA"); }
  for (let w = 0; w < 5; w++) add(6 + w * 14, 520 + w * 35, "PRLV SEPA FRANCE BOISSONS FACT " + (4410 + w), "FRANCE BOISSONS");
  for (let m = 0; m < 3; m++) {
    const b = m * 30;
    add(b + 3, 2400, "VIR SEPA LOYER SCI LES SARMENTS", "SCI LES SARMENTS"); add(b + 8, 412.6, "PRLV SEPA EDF CLIENTS PRO", "EDF"); add(b + 9, 168.2, "PRLV SEPA ENGIE GAZ", "ENGIE");
    add(b + 10, 186.4, "PRLV SEPA AXA FRANCE IARD", "AXA FRANCE"); add(b + 12, 49.99, "PRLV SEPA ORANGE PRO", "ORANGE"); add(b + 1, 18.4, "FRAIS TENUE DE COMPTE"); add(b + 1, 64.2, "COMMISSIONS CB MONETIQUE");
    add(b + 5, 2285, "PRLV SEPA URSSAF ILE DE FRANCE", "URSSAF"); add(b + 4, 1850, "VIR SALAIRE OCTOBRE M. DUPONT", "M. DUPONT"); add(b + 4, 1720, "VIR SALAIRE OCTOBRE L. MARTIN", "L. MARTIN");
    add(b + 15, 1340, "PRLV SEPA DGFIP TVA", "DGFIP"); add(b + 20, 640, "ECHEANCE PRET 0045871", "");
  }
  add(11, 200, "RETRAIT DAB 05/11 PARIS"); add(16, 87.3, "PAIEMENT CB LEROY MERLIN"); add(23, 23.4, "PAIEMENT CB LA FOURNEE DU MARCHE"); add(27, 64.9, "PAIEMENT CB AMZN MKTP FR");
  for (let d = 1; d < 70; d++) if (d % 7 !== 0) add(d, 900 + ((d * 211) % 1400), "REMISE CB " + shortDate(day(d)), "", "in");
  T.forEach((t, i) => DB.set("bankTx", "eb_demo" + i, { src: "banque", link: "eb_demo", account: "d1", ...t, ref: "", at: now }));
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  bqConnect: () => { SFX.tap(); bqConnect(); },
  bqPsu: (a, id, v) => { if (!S.ui.bqB) return; S.ui.bqB.psu = v === "personal" ? "personal" : "business"; SFX.tick(); bqBankPaint(); },
  bqPick: (a, id, v) => bqPick(v),
  bqImport: () => { SFX.tap(); bqImport(); },
  bqImpOk: () => bqImpOk(),
  bqList: () => { SFX.tap(); S.ui.bqF = null; bqListSheet(); },
  bqF: (a, id, v) => { SFX.tick(); bqListSheet(v); },
  bqTx: (a, id) => { SFX.tap(); bqTxSheet(id); },
  bqXCat: (a, id, v) => { bqXGrab(); const x = S.ui.bqX; if (!x) return; x.cat = v; SFX.tick(); buzz(4); S.ui.bqXPaint(); },
  bqXSave: async () => {
    bqXGrab(); const x = S.ui.bqX; if (!x) return; const t = BQ.tx.find((y) => y.id === x.id); if (!t) return;
    const ht = finNum(x.ht); const patch = { cat: x.cat, sure: true, ht: !bqOffCat(x.cat) && ht != null && ht > 0 ? Math.round(ht * 100) / 100 : null };
    try {
      await safe(DB.update("bankTx", x.id, patch));
      if (x.always && x.key) { const r = { ...bqRules(), [x.key]: x.cat }; await safe(DB.set("bank", "rules", { r, at: Date.now() })); }
    } catch (e) { return; }
    SFX.ok(); buzz(6); const back = S.ui.bqF; S.ui.bqX = null;
    toast(x.always && x.key ? `« ${x.key} » ira toujours dans ${bqCatT(x.cat)}` : "Opération rangée");
    if (back) setTimeout(() => bqListSheet(back), 60); else closeSheet(true);
  },
  bqOkAll: async () => {
    const L = bqAll().rows.filter((r) => !r.sure && !r.off && !r.dup); if (!L.length) return;
    try { for (let i = 0; i < L.length; i += 40) await Promise.all(L.slice(i, i + 40).map((r) => DB.update("bankTx", r.t.id, { cat: r.cat, sure: true }))); } catch (e) { SFX.err(); toast("Impossible d'enregistrer. Vérifiez la connexion.", "err"); return; }
    SFX.done(); buzz([8, 30, 8]); toast(`${L.length} opération${L.length > 1 ? "s" : ""} validée${L.length > 1 ? "s" : ""}`); bqListSheet("all");
  },
  bqSync: async () => {
    if (BQ.busy) return; SFX.tap();
    if (!bqLive()) { toast("Synchronisé (démo)"); return; }
    BQ.busy = true; refresh();
    try { const r = await bqCall("sync"); SFX.ok(); toast(r.added ? `${r.added} nouvelle${r.added > 1 ? "s" : ""} opération${r.added > 1 ? "s" : ""}` : "Tout est à jour"); }
    catch (e) { SFX.err(); toast(bqErr(e), "err"); }
    BQ.busy = false; refresh();
  },
  bqSettings: () => { SFX.tap(); bqSettingsSheet(); },
  bqAcc: () => { SFX.tap(); bqAccExport(); },
  bqAch: async (a, id, v) => { SFX.tick(); try { await safe(DB.set("bank", "cfg", { achats: v === "receptions" ? "receptions" : "banque", at: Date.now() })); } catch (e) { return; } setTimeout(bqSettingsSheet, 30); },
  bqOff: (a, id) => openSheet(`<div class="h2" style="font-size:20px">Délier ce compte ?</div><p class="sub" style="margin:0">Les nouvelles opérations n'arriveront plus. Celles déjà reçues restent dans les Finances.</p><div class="grid2"><button class="btn soft" data-act="bqSettings">Annuler</button><button class="btn danger" data-act="bqOffOk" data-id="${esc(id)}">Délier</button></div>`),
  bqOffOk: async (a, id) => {
    try { if (bqLive() && id !== "eb_demo") await bqCall("disconnect", { link: id }); else await DB.update("bank", id, { status: "off" }); }
    catch (e) { SFX.err(); toast(bqErr(e), "err"); return; }
    closeSheet(true); SFX.close(); toast("Compte délié");
  },
  bqRulesReset: async () => { try { await safe(DB.set("bank", "rules", { r: {}, at: Date.now() })); } catch (e) { return; } SFX.ok(); toast("Règles oubliées"); bqSettingsSheet(); },
});
