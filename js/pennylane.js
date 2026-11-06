/* Growth Gusto — area: pennylane (« Comptabilité » : le restaurant relie son Pennylane). Prefix « pny ».
   Server: functions/src/pennylane.js (pennylaneApi + pennylaneTick, every 3 h). Gérant only (firestore.rules).
   Model (restos/{rid}/…):
   - pennylane/link   { mode:"jeton"|"oauth", company, status:"connected"|"error"|"off", canWrite, connectedAt, lastSync, lastError, last:{tx,inv,sent,failed} }  (server)
   - pennylane/cfg    { from:"AAAA-MM-JJ", pushZ, photos, pullBank, acc:{ cash, sales:{20,10,5.5,2.1}, vat:{…} }, journalId?, journalCode? }  (app + server)
   - plSent/{ticketId} { entryId, hash, day, ttc, at, err?, tries? }  a Z ticket sent as a ledger entry  (server)
   - plInv/{id}        { day, due, number, supplier, label, ttc, ht, tva, paid, status, url }  supplier invoices read from Pennylane  (server)
   - bankTx/pl_{id}    Pennylane's bank feed, same shape as js/banque.js reads (src:"pennylane"): Finances sorts them like any bank line. */
TAB_OF.pennylane = "more";
Object.assign(IC, {
  pnyBook: ["M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5", "M9 7h7", "M9 11h5"],
  pnyLink: ["M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7", "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"],
  pnyBank: ["M3 21h18", "M4 18h16", "M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7", "M12 3 3 8h18z"],
  pnySend: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
  pnyDoc: ["M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M14 3v5h5", "M8.5 13h7", "M8.5 16.5h5"],
  pnySync: ["M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M3 21v-5h5"],
});

const PNY_API = "https://europe-west9-growth-gusto.cloudfunctions.net/pennylaneApi";
const PNY_RATES = [["20", "20 %", "alcools, boissons à emporter"], ["10", "10 %", "repas sur place, boissons sans alcool"], ["5.5", "5,5 %", "vente à emporter à consommer plus tard"], ["2.1", "2,1 %", "rare"]];
const PNY_DEF = { cash: "530000", sales: { 20: "706200", 10: "706100", 5.5: "706055", 2.1: "706021" }, vat: { 20: "445712", 10: "445711", 5.5: "445713", 2.1: "445714" } };

/* ───────── state ───────── */
const PNY = { rid: null, docs: [], sent: [], inv: [], info: null, busy: null };
const pnyBoss = () => { try { return DB.mode === "demo" || myRole() === "gerant" || (typeof PERMS !== "undefined" && PERMS.isAdmin()); } catch (e) { return false; } };
const pnyLive = () => DB.mode === "db" && !!DB.uid;
function pnyWatch() {
  if (!S.ready || !S.rid || !S.resto || !pnyLive() || !pnyBoss()) return;
  if (typeof attachedRid !== "undefined" && attachedRid !== S.rid) return;
  if (PNY.rid === S.rid) return;
  const rid = PNY.rid = S.rid; PNY.docs = []; PNY.sent = []; PNY.inv = [];
  const w = (col, opts, cb) => DB.watch(col, opts, (rows) => { if (S.rid !== rid) return; cb(rows); if (S.route === "pennylane" || S.route === "finance") refresh(); });
  w("pennylane", {}, (rows) => { PNY.docs = rows; });
  w("plSent", { order: "day", dir: "desc", limit: 60 }, (rows) => { PNY.sent = rows; });
  w("plInv", { order: "day", dir: "desc", limit: 200 }, (rows) => { PNY.inv = rows; });
}
setInterval(pnyWatch, 1000);
const pnyLink = () => PNY.docs.find((d) => d.id === "link") || null;
const pnyCfg = () => PNY.docs.find((d) => d.id === "cfg") || {};
const pnyOn = () => { const l = pnyLink(); return !!(l && l.status && l.status !== "off"); };

/* ───────── server ───────── */
async function pnyCall(op, body = {}) {
  const u = typeof firebase !== "undefined" && firebase.auth && firebase.auth().currentUser; if (!u) throw Object.assign(new Error("auth"), { code: "auth" });
  const tok = await u.getIdToken();
  let r; try { r = await fetch(PNY_API, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify({ op, rid: S.rid, ...body }) }); }
  catch (e) { throw Object.assign(new Error("net"), { code: "net" }); }
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(j.error || "http " + r.status), { code: j.error || (r.status === 404 ? "net" : "http") }); return j;
}
const PNY_ERR = {
  auth: "Connectez-vous à votre compte pour relier Pennylane.", forbidden: "Seul le gérant peut relier la comptabilité.",
  badkey: "Pennylane refuse ce jeton. Vérifiez qu'il est copié en entier et qu'il n'a pas expiré.", state: "Le lien a expiré. Recommencez la connexion.",
  denied: "Connexion annulée.", not_configured: "La connexion Pennylane n'est pas encore activée sur le serveur.", net: "La connexion Pennylane arrive bientôt sur votre compte.",
  not_connected: "Pennylane n'est plus relié. Reconnectez-le.", unauthorized: "Pennylane a retiré l'accès. Reconnectez-le.", upstream: "Pennylane ne répond pas. Réessayez dans un instant.",
};
const pnyErr = (e) => PNY_ERR[e && e.code] || "Impossible pour l'instant. Réessayez dans un instant.";
async function pnyInfo() {
  if (PNY.info || !pnyLive()) return; PNY.info = { loading: true };
  try { PNY.info = await pnyCall("info"); } catch (e) { PNY.info = { down: true }; }
  if (S.route === "pennylane") refresh();
}
/* OAuth return: https://app.growthgusto.fr/?pennylane=1&code=…&state=… */
(function pnyCatchReturn() {
  try {
    const u = new URL(location.href); if (!u.searchParams.get("pennylane")) return;
    sessionStorage.setItem("gg-pny-ret", JSON.stringify({ code: u.searchParams.get("code") || "", state: u.searchParams.get("state") || "", error: u.searchParams.get("error") || "" }));
    ["pennylane", "code", "state", "error", "error_description", "scope"].forEach((k) => u.searchParams.delete(k));
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (e) {}
})();
async function pnyReturn() {
  let ret = null; try { ret = JSON.parse(sessionStorage.getItem("gg-pny-ret") || "null"); sessionStorage.removeItem("gg-pny-ret"); } catch (e) {}
  if (!ret || !S.resto) return; go("pennylane");
  if (ret.error || !ret.code) { SFX.err(); toast(PNY_ERR.denied, "err"); return; }
  PNY.busy = "connect"; refresh();
  try { const r = await pnyCall("finish", ret); pnyDone(r); } catch (e) { SFX.err(); toast(pnyErr(e), "err"); }
  PNY.busy = null; refresh();
}
window.addEventListener("gg:ready", () => setTimeout(() => { try { pnyWatch(); pnyReturn(); } catch (e) { console.warn(e); } }, 500));
function pnyDone(r) {
  SFX.done(); buzz([10, 40, 10]); try { burst(); } catch (e) {}
  const bits = []; if (r.tx) bits.push(`${r.tx} opération${r.tx > 1 ? "s" : ""} bancaire${r.tx > 1 ? "s" : ""}`); if (r.inv) bits.push(`${r.inv} facture${r.inv > 1 ? "s" : ""}`);
  toast(`Pennylane est relié${r.company ? ` : ${r.company}` : ""}${bits.length ? ` · ${bits.join(", ")}` : ""}`);
}

/* ───────── small helpers ───────── */
const pnyEur = (v) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
const pnyAgo = (ts) => { if (!ts) return "jamais"; const m = Math.round((Date.now() - ts) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`; return when(ts); };
const pnySw = (on) => `<span class="pny-sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span>`;
const pnyMonth = () => dayKey().slice(0, 7);

/* ═════════ Finances card (js/finance.js calls pnyCard() in the side column and in the first-steps view) ═════════ */
function pnyCard() {
  if (!pnyBoss()) return "";
  const L = pnyLink();
  if (!pnyOn()) return `<button class="glass pad pny-card st" style="--i:6" data-go="pennylane"><span class="pny-ic logo">${brandLogo("pennylane")}</span><span class="tx"><b>Reliez votre comptabilité</b><em>Pennylane : la banque arrive seule, les tickets Z partent chez le comptable.</em></span>${ico("chev")}</button>`;
  const err = L.status === "error"; const m = pnyMonth(); const sentM = PNY.sent.filter((s) => s.entryId && (s.day || "").startsWith(m)).length;
  return `<button class="glass pad pny-card on st" style="--i:6" data-go="pennylane"><span class="pny-ic ${err ? "bad" : "logo"}">${err ? ico("alert") : brandLogo("pennylane")}</span><span class="tx"><b>Pennylane${L.company ? ` · ${esc(L.company)}` : ""}</b><em>${err ? "À reconnecter" : `${sentM} ticket${sentM > 1 ? "s" : ""} Z envoyé${sentM > 1 ? "s" : ""} ce mois · synchro ${pnyAgo(L.lastSync)}`}</em></span>${ico("chev")}</button>`;
}

/* ═════════ the page ═════════ */
VIEWS.pennylane = {
  render() {
    pnyWatch();
    if (!pnyBoss()) return `<div class="inner pny">${topBar("Comptabilité")}<div class="glass pad"><p class="sub">Seul le gérant peut relier la comptabilité du restaurant.</p></div></div>`;
    if (!pnyLive()) return `<div class="inner pny">${topBar("Comptabilité")}${pnyIntro()}<div class="glass pad st" style="--i:3"><p class="sub" style="margin:0">Créez votre compte Growth Gusto pour relier Pennylane : en démonstration, rien n'est envoyé.</p></div></div>`;
    pnyInfo();
    if (!pnyOn() || S.ui.pnyRe) return `<div class="inner pny">${topBar("Comptabilité", S.ui.pnyRe ? { right: `<button class="btn ghost sm" data-act="pnyReOff">Annuler</button>` } : {})}<div class="cols"><div>${pnyIntro()}</div><div>${pnyConnect()}</div></div></div>`;
    return `<div class="inner pny">${topBar("Comptabilité")}<div class="cols"><div>${pnyHero()}${pnyZCard()}</div><div>${pnyInvCard()}${pnySettings()}</div></div></div>`;
  },
};

function pnyIntro() {
  const pt = (ic, t, s, i) => `<div class="pny-pt st" style="--i:${i}"><span class="pny-ic sm">${ico(ic)}</span><span class="tx"><b>${t}</b><em>${s}</em></span></div>`;
  return `<div class="glass wall pny-intro st" style="--i:1"><span class="pny-introic logo">${brandLogo("pennylane")}</span><b>Votre comptabilité, reliée</b><span>Reliez Pennylane une fois. Ensuite, tout circule seul, toutes les 3 heures.</span></div>
    <div class="glass pad pny-pts st" style="--i:2">${pt("pnySend", "Les tickets Z partent chez le comptable", "Chaque soir, le chiffre du jour est passé en écriture de ventes, TVA séparée, photo du ticket jointe.", 3)}${pt("pnyBank", "La banque arrive dans Finances", "Les opérations que Pennylane lit déjà sur vos comptes remplissent vos charges, sans abonnement bancaire en plus.", 4)}${pt("pnyDoc", "Les factures fournisseurs à portée de main", "Montant, échéance, payée ou non : visibles ici, sans ouvrir Pennylane.", 5)}</div>`;
}

function pnyConnect() {
  const I = PNY.info || {}; const busy = PNY.busy === "connect";
  const oauth = I.oauth ? `<button class="btn acc block pny-oa" data-act="pnyOauth" ${busy ? "disabled" : ""}>${ico("pnyLink")}Se connecter avec Pennylane</button><div class="pny-or"><span>ou avec un jeton</span></div>` : "";
  const step = (n, t, s) => `<li><span class="pny-n mono">${n}</span><span class="tx"><b>${t}</b>${s ? `<em>${s}</em>` : ""}</span></li>`;
  return `<div class="glass pad pny-conn st" style="--i:3"><span class="lbl">Relier Pennylane</span>${oauth}
    <ol class="pny-steps">${step(1, "Ouvrez Pennylane sur un ordinateur", "Avec le compte du dirigeant (ou demandez à votre comptable).")}${step(2, "Paramètres › Connectivité › Développeurs", "Touchez « Générer un token API ».")}${step(3, "Choisissez « Lecture et écriture » et la durée « Illimitée »", "En lecture seule, la banque et les factures arrivent, mais les tickets Z ne partent pas.")}${step(4, "Copiez le jeton et collez-le ici", "Il est chiffré et gardé sur notre serveur, jamais sur le téléphone.")}</ol>
    <label class="field"><span>Jeton Pennylane</span><input class="input mono" id="pnyTok" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Collez le jeton ici" ${busy ? "disabled" : ""}></label>
    <button class="btn ${I.oauth ? "soft" : "acc"} block" data-act="pnyKey" ${busy ? "disabled" : ""}>${busy ? `<span class="spin" aria-hidden="true"></span>Connexion…` : `${ico("pnyLink")}Relier Pennylane`}</button>
    <p class="note pny-note">L'onglet Développeurs existe à partir de la formule Pennylane Essentiel. Votre comptable peut aussi générer le jeton pour vous.</p>
    ${I.down ? `<p class="note pny-note warn">${ico("alert")}La connexion Pennylane n'est pas encore active sur le serveur : elle le sera à la prochaine mise à jour.</p>` : ""}</div>`;
}

function pnyHero() {
  const L = pnyLink(); const C = pnyCfg(); const err = L.status === "error"; const last = L.last || {}; const busy = PNY.busy === "sync";
  const st = err ? `<span class="pill bad">${ico("alert")}À reconnecter</span>` : `<span class="pill ok"><span class="dot"></span>Relié</span>`;
  const warn = err ? `<p class="pny-warn">${L.lastError === "lost" ? "Pennylane a retiré l'accès (jeton expiré ou supprimé)." : "Pennylane ne répond plus depuis plusieurs essais."} <button class="linkbtn" data-act="pnyReOn">Reconnecter</button></p>`
    : L.canWrite === false ? `<p class="pny-warn">Jeton en lecture seule : la banque et les factures arrivent, les tickets Z ne partent pas. <button class="linkbtn" data-act="pnyReOn">Mettre un jeton « Lecture et écriture »</button></p>` : "";
  const k = (v, t) => `<div><b class="mono">${v}</b><span>${t}</span></div>`;
  const m = pnyMonth(); const sentM = PNY.sent.filter((s) => s.entryId && (s.day || "").startsWith(m)).length; const invM = PNY.inv.filter((v) => (v.day || "").startsWith(m)).length;
  const bankN = (typeof BQ !== "undefined" && BQ.tx ? BQ.tx.filter((t) => t.src === "pennylane").length : null);
  return `<div class="glass wall pny-hero st" style="--i:1"><div class="row"><span class="pny-introic sm">${ico("pnyBook")}</span><div class="tx"><b>${esc(L.company || "Pennylane")}</b><em>${L.mode === "oauth" ? "Connecté avec Pennylane" : "Relié par jeton"} · synchro ${pnyAgo(L.lastSync)}</em></div>${st}</div>
    ${warn}
    <div class="pny-ks">${k(sentM, `ticket${sentM > 1 ? "s" : ""} Z envoyé${sentM > 1 ? "s" : ""} ce mois`)}${k(invM, `facture${invM > 1 ? "s" : ""} fournisseur ce mois`)}${bankN != null ? k(bankN, "opérations bancaires") : k(last.tx || 0, "opérations à la dernière synchro")}</div>
    <button class="btn pny-wbtn block" data-act="pnySync" ${busy ? "disabled" : ""}>${busy ? `<span class="spin" aria-hidden="true"></span>Synchronisation…` : `${ico("pnySync")}Synchroniser maintenant`}</button>
    ${C.pushZ === false ? "" : `<p class="pny-fine">Les tickets Z à partir du ${esc(shortDate(C.from || dayKey()))} partent 45 min après leur saisie.</p>`}</div>`;
}

function pnyZCard() {
  const C = pnyCfg(); const from = C.from || dayKey().slice(0, 8) + "01";
  const tk = finAllSafe("tickets").filter((t) => t.date && t.date >= from && +t.total > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const S_ = new Map(PNY.sent.map((s) => [s.id, s]));
  const ERRS = { scope: "jeton en lecture seule", refused: "refusé par Pennylane (comptes à vérifier)", edited: "modifié après envoi : corrigez dans Pennylane", upstream: "nouvel essai bientôt" };
  const row = (t, i) => {
    const s = S_.get(t.id); let pill;
    if (C.pushZ === false) pill = `<span class="pill neu">Envoi coupé</span>`;
    else if (s && s.entryId && !s.err) pill = `<span class="pill ok">${ico("check")}Envoyé</span>`;
    else if (s && s.err) pill = `<span class="pill ${s.err === "upstream" ? "warn" : "bad"}" title="${esc(ERRS[s.err] || "")}">${s.err === "upstream" ? "En attente" : "Erreur"}</span>`;
    else pill = `<span class="pill neu">À envoyer</span>`;
    const why = s && s.err && s.err !== "upstream" ? `<em class="bad">${esc(ERRS[s.err] || "erreur")}</em>` : "";
    return `<div class="li tap st" style="--i:${Math.min(i, 8) + 3}" data-act="ticket" data-id="${esc(t.id)}" role="button" tabindex="0"><span class="ic">${ico("receipt")}</span><div class="tx"><b>${esc(typeof tkDayLabel === "function" ? tkDayLabel(t.date) : shortDate(t.date))}</b><em class="mono">${pnyEur(+t.total)} TTC</em>${why}</div>${pill}</div>`;
  };
  return `<div class="glass pad pny-z st" style="--i:2"><div class="row"><span class="lbl">Tickets Z vers Pennylane</span><span class="sub">journal ${esc(C.journalCode || "VT")}</span></div>
    ${tk.length ? tk.map(row).join("") : `<div class="empty" style="padding:12px 0 4px">Aucun ticket Z depuis le ${esc(shortDate(from))}. Saisissez le ticket du soir : il partira tout seul.</div>`}</div>`;
}
const finAllSafe = (col) => (typeof finAll === "function" ? finAll(col) : S[col] || []);

function pnyInvCard() {
  const m = pnyMonth(); const L = PNY.inv.slice(0, 14);
  const tot = PNY.inv.filter((v) => (v.day || "").startsWith(m)).reduce((a, v) => a + (+v.ht || 0), 0);
  const unpaid = PNY.inv.filter((v) => !v.paid && v.due && v.due < dayKey()).length;
  const row = (v, i) => `<${v.url ? `a href="${esc(v.url)}" target="_blank" rel="noopener"` : "div"} class="li ${v.url ? "tap" : ""} st" style="--i:${Math.min(i, 8) + 3}"><span class="ic">${ico("pnyDoc")}</span><div class="tx"><b>${esc(v.supplier || v.label || "Facture")}</b><em>${esc(shortDate(v.day))}${v.number ? ` · n° ${esc(v.number)}` : ""}${v.paid ? " · payée" : v.due ? ` · échéance ${esc(shortDate(v.due))}` : ""}</em></div><span class="mono pny-amt ${!v.paid && v.due && v.due < dayKey() ? "bad" : ""}">${pnyEur(v.ht != null ? v.ht : v.ttc)}${v.ht != null ? "<small> HT</small>" : ""}</span></${v.url ? "a" : "div"}>`;
  return `<div class="glass pad pny-inv st" style="--i:3"><div class="row"><span class="lbl">Factures fournisseurs</span>${unpaid ? `<span class="pill warn">${unpaid} en retard</span>` : ""}</div>
    ${PNY.inv.length ? `<p class="sub pny-tot">Ce mois : <b class="mono">${pnyEur(tot)}</b> HT</p>${L.map(row).join("")}` : `<div class="empty" style="padding:12px 0 4px">${(pnyLink().last || {}).noInv ? "Le jeton ne donne pas accès aux factures fournisseurs." : "Les factures déposées dans Pennylane apparaîtront ici."}</div>`}</div>`;
}

function pnySettings() {
  const C = pnyCfg(); const L = pnyLink();
  const tog = (k, t, s, on) => `<div class="li tap" data-act="pnyTog" data-v="${k}" role="switch" aria-checked="${on}" tabindex="0"><div class="tx"><b>${t}</b><em>${s}</em></div>${pnySw(on)}</div>`;
  return `<div class="glass pad pny-set st" style="--i:4"><span class="lbl">Réglages</span>
    ${tog("pushZ", "Envoyer les tickets Z", "Une écriture de ventes par ticket, dans le journal des ventes.", C.pushZ !== false)}
    ${tog("photos", "Joindre la photo du ticket", "Le comptable voit la pièce justificative.", C.photos !== false)}
    ${tog("pullBank", "Recevoir la banque de Pennylane", "Les opérations remplissent les charges dans Finances.", C.pullBank !== false)}
    <button class="cx-opt pny-opt" data-act="pnyAcc"><span class="ic">${ico("pnyBook")}</span><span class="tx"><b>Comptes comptables</b><em>Caisse ${esc((C.acc && C.acc.cash) || PNY_DEF.cash)} · ventes 706 · TVA 4457, à ajuster avec votre comptable</em></span>${ico("chev")}</button>
    <button class="cx-opt pny-opt" data-act="pnyFrom"><span class="ic">${ico("cal")}</span><span class="tx"><b>Envoyer à partir du</b><em>${esc(shortDate(C.from || dayKey()))} : les tickets plus anciens restent ici</em></span>${ico("chev")}</button>
    <button class="cx-opt pny-opt" data-act="pnyOff"><span class="ic bad">${ico("x")}</span><span class="tx"><b>Délier Pennylane</b><em>Ce qui est déjà dans Pennylane y reste</em></span>${ico("chev")}</button>
    <p class="note pny-note">${L.mode === "oauth" ? "Connexion Pennylane officielle." : "Jeton chiffré sur le serveur Growth Gusto, jamais affiché."}</p></div>`;
}

function pnyAccSheet() {
  const C = pnyCfg(); const A = C.acc || {};
  const v = (kind, r) => (r == null ? A[kind] : (A[kind] || {})[r]) || (r == null ? PNY_DEF[kind] : PNY_DEF[kind][r]);
  const f = (id, lab, val, sub) => `<label class="field"><span>${lab}${sub ? ` <em class="fin-opt">${sub}</em>` : ""}</span><input class="input mono" id="${id}" inputmode="numeric" maxlength="12" value="${esc(val)}"></label>`;
  openSheet(`<div class="pny-sh"><div class="h2">Comptes comptables</div><p class="sub">Les numéros du plan comptable utilisés pour chaque ticket Z. Ceux par défaut conviennent à la plupart des restaurants ; votre comptable peut vous donner les siens. Un compte absent est créé dans Pennylane.</p>
    ${f("pnyAcash", "Encaissements (débit)", v("cash"), "caisse, 530000")}
    <div class="pny-grid">${PNY_RATES.map(([r, t, s]) => f("pnyAs" + r.replace(".", ""), `Ventes ${t}`, v("sales", r), s)).join("")}</div>
    <div class="pny-grid">${PNY_RATES.map(([r, t]) => f("pnyAv" + r.replace(".", ""), `TVA collectée ${t}`, v("vat", r))).join("")}</div>
    <p class="note">Écarts d'arrondi : 658000 et 758000.</p>
    <div class="row" style="gap:10px"><button class="btn ghost" data-act="pnyAccReset">Par défaut</button><button class="btn acc" style="flex:1" data-act="pnyAccSave">Enregistrer</button></div></div>`);
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  pnyKey: async () => {
    const i = $("#pnyTok"); const tok = String((i && i.value) || "").trim();
    if (tok.length < 16 || /\s/.test(tok)) { SFX.err(); buzz([20, 40, 20]); toast("Collez le jeton Pennylane en entier.", "err"); if (i) { i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake"); i.focus(); } return; }
    SFX.tap(); PNY.busy = "connect"; refresh();
    try { const r = await pnyCall("key", { token: tok }); S.ui.pnyRe = false; pnyDone(r); }
    catch (e) { SFX.err(); toast(pnyErr(e), "err"); }
    PNY.busy = null; refresh();
  },
  pnyOauth: async () => { SFX.tap(); PNY.busy = "connect"; refresh(); try { const r = await pnyCall("start"); location.href = r.url; } catch (e) { SFX.err(); toast(pnyErr(e), "err"); PNY.busy = null; refresh(); } },
  pnySync: async () => {
    SFX.tap(); PNY.busy = "sync"; refresh();
    try { const r = await pnyCall("sync"); SFX.ok(); buzz(8); const b = []; if (r.sent) b.push(`${r.sent} ticket${r.sent > 1 ? "s" : ""} Z envoyé${r.sent > 1 ? "s" : ""}`); if (r.tx) b.push(`${r.tx} opération${r.tx > 1 ? "s" : ""}`); if (r.inv) b.push(`${r.inv} facture${r.inv > 1 ? "s" : ""}`); toast(b.length ? b.join(" · ") : "Tout est à jour"); }
    catch (e) { SFX.err(); toast(pnyErr(e), "err"); }
    PNY.busy = null; refresh();
  },
  pnyReOn: () => { SFX.tap(); S.ui.pnyRe = true; rerender(); },
  pnyReOff: () => { SFX.close(); S.ui.pnyRe = false; rerender(); },
  pnyTog: async (a, id, k) => { const C = pnyCfg(); const on = C[k] !== false; SFX.tick(); buzz(4); try { await safe(DB.set("pennylane", "cfg", { ...pnyStrip(C), [k]: !on })); } catch (e) {} },
  pnyAcc: () => { SFX.tap(); pnyAccSheet(); },
  pnyAccReset: () => { PNY_RATES.forEach(([r]) => { const s = $("#pnyAs" + r.replace(".", "")); const v = $("#pnyAv" + r.replace(".", "")); if (s) s.value = PNY_DEF.sales[r]; if (v) v.value = PNY_DEF.vat[r]; }); const c = $("#pnyAcash"); if (c) c.value = PNY_DEF.cash; SFX.tick(); },
  pnyAccSave: async () => {
    const g = (id) => String(($(id) || {}).value || "").replace(/\s/g, "");
    const bad = (x) => !/^\d{3,12}$/.test(x);
    const acc = { cash: g("#pnyAcash"), sales: {}, vat: {} }; PNY_RATES.forEach(([r]) => { acc.sales[r] = g("#pnyAs" + r.replace(".", "")); acc.vat[r] = g("#pnyAv" + r.replace(".", "")); });
    const all = [acc.cash, ...Object.values(acc.sales), ...Object.values(acc.vat)];
    if (all.some(bad)) { SFX.err(); toast("Un numéro de compte : de 3 à 12 chiffres.", "err"); return; }
    if (acc.cash.slice(0, 1) !== "5" && acc.cash.slice(0, 3) !== "411") { SFX.err(); toast("Le compte d'encaissement commence par 5 (caisse, banque) ou 411.", "err"); return; }
    if (Object.values(acc.sales).some((x) => x[0] !== "7") || Object.values(acc.vat).some((x) => !x.startsWith("4457"))) { SFX.err(); toast("Ventes : un compte 7… · TVA collectée : un compte 4457…", "err"); return; }
    try { await safe(DB.set("pennylane", "cfg", { ...pnyStrip(pnyCfg()), acc })); } catch (e) { return; }
    closeSheet(true); SFX.ok(); toast("Comptes enregistrés : les prochains tickets les utilisent");
  },
  pnyFrom: () => {
    SFX.tap(); const C = pnyCfg();
    openSheet(`<div class="pny-sh"><div class="h2">Envoyer à partir du</div><p class="sub">Les tickets Z de cette date et après partent dans Pennylane. Choisissez le début d'une période que le comptable n'a pas encore saisie, pour éviter les doublons.</p>
      <label class="field"><span>Date</span><input class="input" id="pnyFromD" type="date" max="${dayKey()}" value="${esc(C.from || dayKey().slice(0, 8) + "01")}"></label>
      <button class="btn acc block" data-act="pnyFromSave">Enregistrer</button></div>`);
  },
  pnyFromSave: async () => { const v = String(($("#pnyFromD") || {}).value || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { SFX.err(); return; } try { await safe(DB.set("pennylane", "cfg", { ...pnyStrip(pnyCfg()), from: v })); } catch (e) { return; } closeSheet(true); SFX.ok(); toast(`Envoi à partir du ${shortDate(v)}`); },
  pnyOff: () => {
    SFX.tap();
    openSheet(`<div class="pny-sh"><div class="h2">Délier Pennylane ?</div><p class="sub">Plus rien ne part ni n'arrive. Les écritures et la banque déjà dans Pennylane y restent ; ici, l'historique reste visible.</p>
      <div class="row" style="gap:10px"><button class="btn ghost" style="flex:1" data-act="closeSheet">Garder</button><button class="btn danger" style="flex:1" data-act="pnyOffGo">Délier</button></div></div>`);
  },
  pnyOffGo: async (a) => { a.setAttribute("disabled", ""); try { await pnyCall("disconnect"); } catch (e) { SFX.err(); toast(pnyErr(e), "err"); a.removeAttribute("disabled"); return; } closeSheet(true); SFX.close(); toast("Pennylane est délié"); },
});
const pnyStrip = (C) => { const o = { ...C }; delete o.id; return o; };
if (!ACT.closeSheet) ACT.closeSheet = () => closeSheet();
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "pnyTok") { e.preventDefault(); const b = $("[data-act=pnyKey]"); b && b.click(); } });
