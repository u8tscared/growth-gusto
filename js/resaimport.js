/* Growth Gusto — area: « Récupérer mes réservations Zenchef » (and TheFork Manager, or any tool). Prefix « rz ».
   Zero cost, no partner API. Three ways, one sheet (rzOpen(prov)):
     « En continu »   the restaurant's own address <slug>.<token>@in.growthgusto.fr (callable resaInbox, functions/src/resaimport.js).
                      It goes in Zenchef › Paramètres › Général & équipe › Notifications: each new booking, change or cancellation
                      e-mailed by Zenchef lands in the bookings, and the floor plan (js/plan.js) seats it like any other.
                      The last e-mails (restos/{rid}/resaMails) show what came in, and the ones not understood (Gmail's forwarding
                      confirmation gets its own button).
     « Fichier »      an Excel / CSV export, a table copied from the tool's screen, or a pasted e-mail: read here (js/import.js readers,
                      js/rzparse.js for e-mails), preview, then written as bookings. Coming ones only; a second import updates instead of
                      duplicating (tool reference, else the same phone or name on the same day).
     « Passer à Growth Gusto »  the case and the three steps to leave the other tool: our bookings are included in the pack.
   Written bookings: { date, time, covers, name, phone, email?, notes?, status, source: <tool>, ext: { p, id?, by: "file"|"mail" }, createdAt, at, seen }
   ext is the mark of a booking owned by another tool: the server never e-mails its client (that tool already did).
   Exposed: rzOpen(prov?), rzCardHTML(cfg) (Réservations side column), rzProvName(p), rzBadge(b) (booking cards). */
"use strict";

Object.assign(IC, {
  rzMail: ["r:2,4,20,16,3", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", "f:M2 7l8.97 5.7a1.94 1.94 0 0 0 2.06 0L22 7v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z"],
  rzSync: ["M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M3 21v-5h5"],
  rzSwap: ["M7 4 3 8l4 4", "M3 8h14", "m17 20 4-4-4-4", "M21 16H7"],
});

const RZ_TOOLS = { zenchef: "Zenchef", thefork: "TheFork Manager", sevenrooms: "SevenRooms", guestonline: "Guestonline", resy: "Resy", opentable: "OpenTable", formitable: "Formitable", google: "Google Réserver", mail: "votre outil", autre: "votre outil" };
const rzProvName = (p) => RZ_TOOLS[p] || "votre outil";
const RZ = { tab: "live", prov: null, addr: "", busy: false, err: "", mails: null, rows: null, file: "", paste: "", res: null };
const rzProv = () => RZ.prov || (S.resto && S.resto.resaProvider) || "zenchef";
const rzLive = () => DB.mode === "db" || DB.mode === "demo";
const rzMgr = () => (typeof rsMgr === "function" ? rsMgr() : myRole() === "gerant");
const rzN = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rzPl = (n, s, p) => `${n} ${n > 1 ? p || s + "s" : s}`;
const rzExt = (b) => b && b.ext && b.ext.p;
/* the small tag on a booking card: « Zenchef » */
function rzBadge(b) { const p = rzExt(b); return p ? `<span class="rz-tag">${esc(p === "mail" ? "Importée" : rzProvName(p))}</span>` : ""; }

/* ───────────── side card in Réservations ───────────── */
function rzCardHTML() {
  if (!rzMgr()) return "";
  const p = rzProv(), n = rzProvName(p), inn = (S.resto && S.resto.resaIn) || {}, rows = typeof rsRows === "function" ? rsRows() : [];
  const ext = rows.filter((b) => rzExt(b) && b.date >= dayKey() && !["annule", "refuse"].includes(b.status)).length;
  const lg = brandLogo(p === "mail" || p === "autre" ? "" : p);
  const st = inn.last ? `<span class="rz-dot on"></span>Relié · dernier e-mail ${esc(rzAgo(inn.last))}` : inn.addr ? `<span class="rz-dot"></span>Adresse prête, en attente du premier e-mail` : ext ? `${rzPl(ext, "réservation")} récupérée${ext > 1 ? "s" : ""}` : `Vos réservations ${esc(n)} ici, sur le plan de salle.`;
  return `<div class="glass rz-card st" style="--i:6">
    <div class="rs-lh"><span class="ic rz-lg">${lg || ico("rzSync")}</span><div><b>${inn.addr || ext ? `${esc(n)} relié` : `Vous avez ${esc(n === "votre outil" ? "un autre outil" : n)} ?`}</b><em>${st}</em></div></div>
    <div class="rz-cb"><button class="btn soft sm" data-act="rzOpen" data-v="${esc(p)}">${ico("rzSync")}${inn.addr || ext ? "Gérer" : "Récupérer mes réservations"}</button>
    <button class="btn ghost sm" data-act="rzOpen" data-v="${esc(p)}" data-id="swap">${ico("rzSwap")}Arrêter de payer ${esc(p === "mail" || p === "autre" ? "l'autre outil" : n)}</button></div>
  </div>`;
}
function rzAgo(t) { const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`; const d = Math.round(h / 24); return d === 1 ? "hier" : `il y a ${d} jours`; }

/* ───────────── the sheet ───────────── */
function rzOpen(prov, tab) {
  if (prov) RZ.prov = prov;
  RZ.tab = tab || RZ.tab || "live"; RZ.err = ""; RZ.res = null; RZ.mails = null;
  rzPaint(true);
  if (RZ.tab === "live") rzLoadLive();
}
function rzPaint(first) {
  const p = rzProv(), n = rzProvName(p), lg = brandLogo(p === "mail" || p === "autre" ? "" : p);
  const tabs = [["live", "En continu"], ["file", "Fichier"], ["swap", "Changer d’outil"]];
  const body = RZ.tab === "file" ? rzFileHTML(p, n) : RZ.tab === "swap" ? rzSwapHTML(p, n) : rzLiveHTML(p, n);
  const html = `<div class="rz">
    <div class="rs-edh"><span class="rz-h">${lg ? `<span class="rz-lg">${lg}</span>` : ""}<span class="h2">${RZ.tab === "swap" ? "Quitter" : "Récupérer"} ${esc(n === "votre outil" ? "l’autre outil" : n)}</span></span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="rs-ctab" role="tablist">${tabs.map(([k, l]) => `<button class="${RZ.tab === k ? "on" : ""}" data-act="rzTab" data-v="${k}" role="tab" aria-selected="${RZ.tab === k}">${l}</button>`).join("")}</div>
    <div class="rz-b" data-rzt="${RZ.tab}">${body}</div>
  </div>`;
  openSheet(html);
}

/* ── « En continu »: the address ── */
function rzSteps(list) { return `<ol class="rz-steps">${list.map((t, j) => `<li style="--j:${j}"><span>${j + 1}</span><div>${t}</div></li>`).join("")}</ol>`; }
function rzLiveHTML(p, n) {
  if (!rzLive()) return `<div class="rz-empty">${ico("rzMail")}<b>Avec un compte Growth Gusto</b><span>Vos réservations ${esc(n)} arrivent toutes seules, sur tous vos appareils.</span><button class="btn acc" data-act="auOpen">Créer mon compte</button></div>`;
  if (!rzMgr()) return `<div class="rz-empty">${ico("lock")}<b>Réservé au gérant</b><span>Demandez-lui de relier ${esc(n)}.</span></div>`;
  const inn = (S.resto && S.resto.resaIn) || {}, addr = RZ.addr || inn.addr || "";
  const box = addr ? `<button class="rs-url rz-addr" data-act="rzCopy" title="Copier l'adresse"><span>${esc(addr)}</span>${ico("rsCopy")}</button>`
    : RZ.err ? `<div class="rz-err">${esc(RZ.err)} <button class="rz-lk" data-act="rzAddr">Réessayer</button></div>` : `<div class="rz-addr sk" aria-busy="true"><i></i></div>`;
  const zen = p === "zenchef";
  const steps = zen ? [
    `Copiez votre adresse Growth Gusto ci-dessus.`,
    `Dans Zenchef : <b>Paramètres › Général &amp; équipe › Notifications</b>.`,
    `Ajoutez l'adresse aux e-mails de la catégorie <b>Réservations</b>, et gardez la vôtre.`,
  ] : [
    `Copiez votre adresse Growth Gusto ci-dessus.`,
    `Dans ${esc(n)}, ajoutez-la aux e-mails de notification des réservations, si l'outil le permet.`,
    `Sinon, dans votre messagerie : transférez automatiquement les e-mails de ${esc(n)} vers cette adresse.`,
  ];
  const mails = RZ.mails;
  const log = !addr ? "" : mails == null ? `<div class="rz-log sk"><i></i><i></i></div>` : !mails.length
    ? `<div class="rz-wait"><span class="rz-pulse" aria-hidden="true"></span><div><b>En attente du premier e-mail</b><span>Dès votre prochaine réservation ${esc(n)}, elle apparaît ici et sur votre plan de salle.</span></div></div>`
    : `<div class="rz-log"><div class="rz-lh"><b>Derniers e-mails reçus</b><button class="rz-lk" data-act="rzRefresh">${ico("rzSync")}Actualiser</button></div>${mails.slice(0, 8).map(rzMailRow).join("")}</div>`;
  return `<p class="rz-lead">Chaque réservation ${esc(n)}, modification ou annulation arrive ici toute seule, et se place sur votre plan de salle.</p>
    ${box}
    ${rzSteps(steps)}
    ${log}
    ${addr ? `<p class="rz-fine">Cette adresse est à vous seul. Elle a fuité ? <button class="rz-lk" data-act="rzRenew">Changer d'adresse</button></p>` : ""}`;
}
function rzMailRow(m) {
  const s = m.sum || {}, when = s.date ? `${typeof rsShort === "function" ? rsShort(s.date) : s.date}${s.time ? " · " + s.time : ""}` : "";
  if (m.ok) {
    const k = m.kind === "cancel" ? ["Annulée", "bad"] : m.kind === "modify" ? ["Modifiée", "warn"] : ["Nouvelle", "ok"];
    return `<div class="rz-m"><span class="rz-mk ${k[1]}">${k[0]}</span><div><b>${esc(s.name || "Réservation")}${s.covers ? ` · ${s.covers} pers.` : ""}</b><em>${esc(when)}${when ? " · " : ""}reçue ${esc(rzAgo(m.at))}</em></div></div>`;
  }
  if (m.why === "gmail") { const u = (m.links || [])[0]; return `<div class="rz-m gm"><span class="rz-mk acc">Gmail</span><div><b>Confirmez le transfert</b><em>Un geste et vos e-mails arrivent.</em></div>${u ? `<a class="btn acc sm" href="${esc(u)}" target="_blank" rel="noopener">Confirmer</a>` : ""}</div>`; }
  const why = { date: "date introuvable", heure: "heure introuvable", couverts: "nombre de couverts introuvable", introuvable: "réservation d'origine introuvable" }[m.why] || "pas une réservation";
  return `<div class="rz-m"><span class="rz-mk">Ignoré</span><div><b>${esc(m.subj || "E-mail sans objet")}</b><em>${esc(why)} · ${esc(rzAgo(m.at))}</em></div></div>`;
}
async function rzCall(name, data) {
  if (typeof AUTH !== "undefined" && AUTH.call) return AUTH.call(name, data);
  const r = await firebase.app().functions("europe-west9").httpsCallable(name, { timeout: 15000 })(data || {}); return (r && r.data) || {};
}
async function rzLoadLive(renew) {
  if (!rzLive() || !rzMgr()) return;
  if (DB.mode === "demo") { RZ.addr = `${rzSlug()}.3f9a1c22b0@in.growthgusto.fr`; RZ.mails = rzDemoMails(); rzRepaint(); return; }
  const inn = (S.resto && S.resto.resaIn) || {};
  if (!inn.addr || renew) {
    try { const r = await rzCall("resaInbox", { rid: S.rid, renew: !!renew }); RZ.addr = r.addr || ""; RZ.err = ""; if (S.resto) S.resto.resaIn = { ...(S.resto.resaIn || {}), addr: RZ.addr }; }
    catch (e) { RZ.err = /permission/.test(String(e && (e.code || e.message))) ? "Seul le gérant peut créer l'adresse." : "Le serveur ne répond pas pour l'instant."; }
  } else RZ.addr = inn.addr;
  await rzLoadMails(); rzRepaint();
}
async function rzLoadMails() {
  if (DB.mode !== "db" || !DB.db || !S.rid) { RZ.mails = RZ.mails || []; return; }
  try { const s = await DB.db.collection(`restos/${S.rid}/resaMails`).orderBy("at", "desc").limit(12).get(); RZ.mails = s.docs.map((d) => ({ id: d.id, ...d.data() })); } catch (e) { RZ.mails = []; }
}
const rzSlug = () => rzN((S.resto && S.resto.name) || "resto").replace(/ /g, "-").slice(0, 24) || "resto";
function rzDemoMails() {
  const k = addDays(dayKey(), 2), k2 = addDays(dayKey(), 5);
  return [
    { ok: true, kind: "new", at: Date.now() - 14 * 6e4, sum: { name: "Camille Rousseau", covers: 4, date: k, time: "20:30" } },
    { ok: true, kind: "modify", at: Date.now() - 3 * 36e5, sum: { name: "Hugo Lambert", covers: 6, date: k2, time: "12:45" } },
    { ok: true, kind: "cancel", at: Date.now() - 26 * 36e5, sum: { name: "Sarah Petit", covers: 2, date: k, time: "19:30" } },
  ];
}
function rzRepaint() { if ($("#sheet").classList.contains("open") && document.querySelector("#sheetBody .rz")) { const b = document.querySelector("#sheetBody .rz-b"); const p = rzProv(), n = rzProvName(p); if (b) b.innerHTML = RZ.tab === "file" ? rzFileHTML(p, n) : RZ.tab === "swap" ? rzSwapHTML(p, n) : rzLiveHTML(p, n); } }

/* ── « Fichier »: an export, a copied table, a pasted e-mail ── */
function rzFileHTML(p, n) {
  if (RZ.res) return rzPreviewHTML(n);
  const zen = p === "zenchef";
  return `<p class="rz-lead">Récupérez d'un coup toutes vos réservations à venir. À refaire quand vous voulez : rien ne sera en double.</p>
    <label class="rz-drop" data-rzdrop>
      <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods,.html,.htm" data-rzfile hidden>
      <span class="rz-di">${ico("upload")}</span><b>Choisir le fichier exporté</b><span>Excel ou CSV${zen ? ", exporté depuis la liste des réservations de Zenchef" : ""}</span>
    </label>
    <div class="rz-or"><span>ou</span></div>
    <label class="field"><span class="lbl">Collez le tableau, ou un e-mail de réservation</span>
      <textarea class="input rz-paste" data-rzpaste rows="4" placeholder="Sélectionnez la liste dans ${esc(n)}, copiez, puis collez ici.">${esc(RZ.paste)}</textarea></label>
    ${RZ.err ? `<div class="rz-err">${esc(RZ.err)}</div>` : ""}
    <button class="btn acc block" data-act="rzRead" ${RZ.busy ? "disabled" : ""}>${RZ.busy ? "Lecture…" : "Lire mes réservations"}</button>
    <p class="rz-fine">Seules les réservations d'aujourd'hui et à venir sont reprises. Vos clients ne reçoivent aucun e-mail de notre part.</p>`;
}
function rzPreviewHTML(n) {
  const R0 = RZ.res, nw = R0.items.filter((x) => x.op === "new").length, up = R0.items.filter((x) => x.op === "upd").length, cx = R0.items.filter((x) => x.op === "cancel").length;
  if (!R0.items.length) return `<div class="rz-empty">${ico("resa")}<b>Aucune réservation à venir trouvée</b><span>${R0.past ? `${rzPl(R0.past, "réservation passée")} ignorée${R0.past > 1 ? "s" : ""}. ` : ""}${R0.bad ? `${rzPl(R0.bad, "ligne")} sans date ou sans heure.` : "Vérifiez que le fichier a bien une date, une heure et un nombre de couverts."}</span><button class="btn soft" data-act="rzBack">Essayer un autre fichier</button></div>`;
  const list = R0.items.slice().sort((a, b) => (a.b.date + a.b.time).localeCompare(b.b.date + b.b.time));
  return `<div class="rz-sum">
      <div class="rz-big"><b>${R0.items.length}</b><span>réservation${R0.items.length > 1 ? "s" : ""} à venir<em>${[nw && rzPl(nw, "nouvelle"), up && `${up} déjà là, mise${up > 1 ? "s" : ""} à jour`, cx && rzPl(cx, "annulation")].filter(Boolean).join(" · ")}</em></span></div>
      ${R0.past || R0.bad ? `<p class="rz-fine">${[R0.past && `${rzPl(R0.past, "passée")} ignorée${R0.past > 1 ? "s" : ""}`, R0.bad && `${rzPl(R0.bad, "ligne")} illisible${R0.bad > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}</p>` : ""}
    </div>
    <div class="rz-prev">${list.slice(0, 7).map((x, j) => `<div class="rz-pr" style="--j:${j}"><span class="rs-cv"><b>${x.b.covers}</b><i>pers.</i></span><div><b>${esc(x.b.name)}</b><em>${esc(typeof rsShort === "function" ? rsShort(x.b.date) : x.b.date)} · ${x.b.time}${x.b.phone ? ` · ${esc(x.b.phone)}` : ""}</em></div>${x.op === "cancel" ? `<span class="rz-mk bad">Annulée</span>` : x.op === "upd" ? `<span class="rz-mk warn">Mise à jour</span>` : ""}</div>`).join("")}
      ${list.length > 7 ? `<p class="rz-more">+ ${list.length - 7} autres</p>` : ""}</div>
    <div class="grid2"><button class="btn soft" data-act="rzBack">Annuler</button><button class="btn acc" data-act="rzGo" ${RZ.busy ? "disabled" : ""}>${RZ.busy ? "Import…" : `Importer ${R0.items.length}`}</button></div>`;
}

/* columns of a bookings table (normalized headers) */
const RZ_COLS = {
  ref: /^(id|ref|reference|n|no|numero|n reservation|numero de reservation|id reservation|booking id|reservation id|booking reference|code)$/,
  when: /^(date et heure|date heure|date & heure|date and time|datetime|creneau|horaire de la reservation)$/,
  date: /^(date|jour|date de (la )?reservation|date du repas|date de visite|day|booking date|reservation date|date de venue)$/,
  time: /^(heure|horaire|time|hour|heure d arrivee|heure de (la )?reservation|arrivee|service time|start time|debut)$/,
  covers: /^(couverts|nb couverts|nombre de couverts|personnes|nb personnes|nombre de personnes|pers|nb pers|pax|convives|guests|party size|covers|people|adultes|taille du groupe|nb|nombre)$/,
  name: /^(nom|client|nom du client|nom complet|nom et prenom|prenom nom|name|guest|guest name|customer|customer name|full name|contact)$/,
  first: /^(prenom|first name|firstname)$/,
  last: /^(nom de famille|last name|lastname|surname)$/,
  phone: /^(telephone|tel|portable|mobile|phone|phone number|numero de telephone|gsm)$/,
  email: /^(e mail|email|mail|courriel|adresse e mail|email address)$/,
  notes: /^(commentaire|commentaires|note|notes|message|remarque|remarques|demande|demandes|demande speciale|demandes speciales|allergies|comments?|special requests?|informations?)$/,
  status: /^(statut|status|etat|state)$/,
  table: /^(table|tables|n table|numero de table)$/,
};
function rzMap(headers) {
  const nh = headers.map(rzN), map = {};
  for (const k of Object.keys(RZ_COLS)) { const i = nh.findIndex((h, j) => RZ_COLS[k].test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; }
  if (map.name != null && map.first != null && map.last == null) { map.last = map.name; delete map.name; }
  return map;
}
function rzStatus(v) {
  const s = rzN(v); if (!s) return "avenir";
  if (/annul|cancel/.test(s)) return "annule"; if (/no show|noshow|absent|lapin/.test(s)) return "noshow"; if (/refus|declin|reject/.test(s)) return "refuse";
  if (/attente|waiting|wait list|waitlist/.test(s)) return "attente"; if (/venu|honor|arriv|assis|seated|termin|finished|left|parti|present/.test(s)) return "arrive";
  if (/a valider|en attente de confirmation|pending|request|demande/.test(s)) return "avalider";
  return "avenir";
}
function rzRowsOf(T) {
  /* T: { headers, rows } → bookings */
  const m = rzMap(T.headers), out = []; let bad = 0;
  if (m.date == null && m.when == null) return { list: [], bad: T.rows.length, cols: false };
  const dc = m.date != null ? m.date : m.when, order = typeof imOrder === "function" ? imOrder(T.rows.map((r) => r[dc])) : "dmy";
  for (const r of T.rows) {
    const g = (k) => (m[k] == null ? "" : r[m[k]]); const str = (k) => String(g(k) == null ? "" : g(k)).trim();
    const d = typeof imDate === "function" ? imDate(g(m.date != null ? "date" : "when"), order) : null;
    let min = m.time != null ? (typeof imTime === "function" ? imTime(g("time")) : null) : null; if (min == null && d) min = d.min;
    if (min == null && m.when != null && typeof imTime === "function") min = imTime(String(g("when")).replace(/^.*?\d{2,4}\s+/, ""));
    const cv = Math.round(+String(str("covers")).replace(/[^\d]/g, "") || 0);
    if (!d || min == null || !(cv >= 1)) { if (r.some((c) => String(c == null ? "" : c).trim())) bad++; continue; }
    const name = (str("name") || [str("first"), str("last")].filter(Boolean).join(" ")).replace(/\s+/g, " ").slice(0, 60);
    const tbl = str("table"), notes = [str("notes"), tbl ? `Table ${tbl} dans ${rzProvName(rzProv())}` : ""].filter(Boolean).join(" · ").slice(0, 300);
    out.push({ date: d.day, time: `${pad(Math.floor(min / 60))}:${pad(min % 60)}`, covers: Math.min(cv, 300), name: name || "Sans nom", phone: str("phone").slice(0, 25), email: str("email").slice(0, 100), notes, status: rzStatus(str("status")), ref: str("ref").slice(0, 40) });
  }
  return { list: out, bad, cols: true };
}
async function rzReadInput(file, text) {
  const tables = [];
  if (file) { if (typeof imReadFile !== "function") throw new Error("lecteur"); (await imReadFile(file)).forEach((t) => tables.push(t)); }
  else if (text.trim()) {
    const looksTable = /\t/.test(text) || (text.split(/\n/).filter((l) => l.split(";").length > 3).length >= 2);
    if (looksTable && typeof imParseDelim === "function") tables.push({ rows: imParseDelim(text) });
  }
  let list = [], bad = 0, found = false;
  for (const raw of tables) {
    const rows = (raw.rows || []).filter((r) => Array.isArray(r) && r.some((c) => String(c == null ? "" : c).trim()));
    if (rows.length < 2) continue;
    /* the header row: the first of the 10 first rows naming a date column */
    let hi = rows.slice(0, 10).findIndex((r) => { const mm = rzMap(r.map((c) => String(c == null ? "" : c))); return (mm.date != null || mm.when != null) && (mm.covers != null || mm.name != null); });
    if (hi < 0) continue; found = true;
    const R1 = rzRowsOf({ headers: rows[hi].map((c) => String(c == null ? "" : c)), rows: rows.slice(hi + 1) }); list = list.concat(R1.list); bad += R1.bad;
  }
  /* no table: a pasted booking e-mail (or several, one after the other) */
  if (!found && text.trim() && typeof rzParse === "function") {
    const parts = text.split(/\n(?=.*(?:nouvelle r[ée]servation|r[ée]servation (?:annul|modifi)|new booking|^de\s*:|^from\s*:))/im);
    for (const t of parts.length > 1 ? parts : [text]) { const x = rzParse({ text: t, subject: t.split("\n")[0] }); if (x.ok) list.push({ date: x.date, time: x.time, covers: x.covers, name: x.name || "Sans nom", phone: x.phone, email: x.email, notes: x.notes, status: x.kind === "cancel" ? "annule" : "avenir", ref: x.ref, prov: x.provider }); else bad++; }
  }
  return { list, bad, found };
}
function rzPlan(list) {
  const p = rzProv(), today = dayKey(), rows = typeof rsRows === "function" ? rsRows() : [], items = []; let past = 0;
  const nk = (s) => rzN(s).replace(/ /g, ""), pk = (s) => String(s || "").replace(/\D/g, "").slice(-9);
  for (const b of list) {
    if (b.date < today) { past++; continue; }
    const prov = b.prov && b.prov !== "mail" ? b.prov : p === "autre" ? "mail" : p;
    const id = b.ref ? `${prov}:${b.ref}` : "";
    const old = rows.find((o) => (id && o.ext && o.ext.id === id) || (o.date === b.date && ((pk(b.phone).length >= 8 && pk(o.phone) === pk(b.phone)) || (b.name !== "Sans nom" && nk(o.name) === nk(b.name)))));
    if (!old && ["annule", "refuse", "noshow"].includes(b.status)) continue;
    const op = old ? (b.status === "annule" ? "cancel" : "upd") : "new";
    if (old && op === "upd" && old.date === b.date && old.time === b.time && +old.covers === b.covers && (old.status === b.status || b.status === "avenir")) continue; /* nothing changed */
    items.push({ op, old, prov, id, b });
  }
  /* the same booking twice in one file: keep the last line */
  const seen = new Map(); items.forEach((x, i) => seen.set(x.id || `${x.b.date}|${nk(x.b.name)}|${pk(x.b.phone)}`, i));
  return { items: items.filter((x, i) => seen.get(x.id || `${x.b.date}|${nk(x.b.name)}|${pk(x.b.phone)}`) === i), past };
}
async function rzWrite() {
  const R0 = RZ.res; if (!R0 || RZ.busy) return; RZ.busy = true; rzRepaint();
  let n = 0, first = null;
  try {
    for (const x of R0.items) {
      const b = x.b, at = parseDay(b.date).getTime() + (+b.time.slice(0, 2) * 60 + +b.time.slice(3, 5)) * 6e4;
      const ext = { p: x.prov, by: "file", ...(x.id ? { id: x.id } : {}) };
      if (x.op === "cancel") await safe(DB.update("bookings", x.old.id, { status: "annule", cancelledBy: "outil", cancelledAt: Date.now(), ext: { ...(x.old.ext || {}), ...ext } }));
      else if (x.op === "upd") { const moved = x.old.date !== b.date || x.old.time !== b.time; await safe(DB.update("bookings", x.old.id, { date: b.date, time: b.time, covers: b.covers, at, ...(b.phone ? { phone: b.phone } : {}), ...(b.email ? { email: b.email } : {}), ...(b.notes ? { notes: b.notes } : {}), ...(b.status !== "avenir" || x.old.status === "annule" ? { status: b.status } : {}), ...(moved ? { table: "", tableAuto: true } : {}), ext: { ...(x.old.ext || {}), ...ext } })); }
      else await safe(DB.add("bookings", { date: b.date, time: b.time, covers: b.covers, name: b.name, phone: b.phone || "", ...(b.email ? { email: b.email } : {}), ...(b.notes ? { notes: b.notes } : {}), status: b.status, source: x.prov, ext, createdAt: Date.now(), at, seen: true, by: S.me && S.me.id }));
      n++; if (!first || b.date < first) first = b.date;
    }
  } catch (e) { RZ.busy = false; rzRepaint(); return; }
  RZ.busy = false; RZ.res = null; RZ.paste = "";
  if (S.resto && !S.resto.resaProvider && rzProv() !== "autre") { S.resto.resaProvider = rzProv(); DB.update("restos", S.rid, { resaProvider: rzProv() }).catch(() => {}); }
  closeSheet(true); SFX.done(); buzz([8, 40, 12]); burst();
  toast(`${rzPl(n, "réservation")} récupérée${n > 1 ? "s" : ""}`);
  if (typeof logEvent === "function") logEvent("resa", `${rzPl(n, "réservation")} importée${n > 1 ? "s" : ""} depuis ${rzProvName(rzProv())}`);
  if (first && typeof RESA !== "undefined") setTimeout(() => RESA.open(first), 250);
}

/* ── « Passer à Growth Gusto » ── */
function rzSwapHTML(p, n) {
  const cfg = typeof rsCfg === "function" ? rsCfg() : {}, on = !!cfg.online, rows = typeof rsRows === "function" ? rsRows() : [];
  const last = rows.filter((b) => rzExt(b) && !["annule", "refuse"].includes(b.status) && b.date >= dayKey()).map((b) => b.date).sort().pop();
  const tool = n === "votre outil" ? "l'autre outil" : n;
  return `<div class="rz-hero"><span class="rz-hi">${ico("sparkle")}</span><div><b>Vos réservations sont incluses dans votre pack.</b><span>Lien de réservation en ligne, plan de salle, rappels par e-mail, fiche client, liste d'attente. Sans frais par couvert.</span></div></div>
    ${rzSteps([
      `${on ? "Votre réservation en ligne est <b>ouverte</b>." : "Ouvrez la réservation en ligne Growth Gusto."}${on ? `<div class="rz-ia"><button class="btn soft sm" data-act="rsCopyLink">${ico("rsCopy")}Copier mon lien</button></div>` : `<div class="rz-ia"><button class="btn acc sm" data-act="rzOnline">${ico("rsWeb")}Ouvrir maintenant</button></div>`}`,
      `Remplacez le lien ${esc(tool)} par le vôtre : <b>fiche Google</b> (Réservations), <b>votre site</b>, <b>Instagram</b>.${on ? `<div class="rz-ia"><button class="btn ghost sm" data-act="rsSnip">${ico("rsCode")}Code pour mon site</button></div>` : ""}`,
      `Gardez ${esc(tool)} relié le temps de servir les réservations déjà prises${last ? `, jusqu'au <b>${esc(typeof rsLong === "function" ? rsLong(last) : last)}</b>` : ""}. Puis résiliez.`,
    ])}
    <button class="btn soft block" data-act="rzTab" data-v="live">${ico("rzSync")}Relier ${esc(tool)} pendant la transition</button>`;
}

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  rzOpen: (a, id, v) => { SFX.tap(); rzOpen(v || null, id === "swap" ? "swap" : RZ.tab === "swap" ? "live" : null); },
  rzTab: (a, id, v) => { SFX.tick(); buzz(4); RZ.tab = v; RZ.err = ""; rzPaint(); if (v === "live" && RZ.mails == null) rzLoadLive(); },
  rzAddr: () => { RZ.err = ""; rzRepaint(); rzLoadLive(); },
  rzRenew: async (a) => { if (a) a.disabled = true; RZ.addr = ""; RZ.mails = null; rzRepaint(); await rzLoadLive(true); toast("Nouvelle adresse : remplacez-la dans " + rzProvName(rzProv())); },
  rzRefresh: async () => { SFX.tick(); RZ.mails = null; rzRepaint(); await rzLoadMails(); rzRepaint(); },
  rzCopy: async () => { const addr = RZ.addr || (S.resto && S.resto.resaIn && S.resto.resaIn.addr); if (!addr) return; const ok = typeof rsCopy === "function" ? await rsCopy(addr) : false; SFX.ok(); buzz(6); toast(ok ? "Adresse copiée" : addr); },
  rzRead: async () => {
    const ta = document.querySelector("[data-rzpaste]"); if (ta) RZ.paste = ta.value;
    if (!RZ.fileObj && !RZ.paste.trim()) { RZ.err = "Choisissez un fichier ou collez vos réservations."; SFX.err(); rzRepaint(); return; }
    RZ.busy = true; RZ.err = ""; rzRepaint();
    try {
      const r = await rzReadInput(RZ.fileObj, RZ.fileObj ? "" : RZ.paste); RZ.fileObj = null;
      if (!r.list.length && !r.found && !r.bad) { RZ.err = "On n'a pas trouvé de colonne « Date ». Exportez la liste des réservations, ou collez un e-mail de réservation."; RZ.busy = false; SFX.err(); rzRepaint(); return; }
      const P = rzPlan(r.list); RZ.res = { ...P, bad: r.bad }; SFX.ok();
    } catch (e) { RZ.err = (e && e.why) ? `Fichier ${e.why}.` : "Ce fichier ne se lit pas. Essayez l'export CSV ou Excel."; SFX.err(); }
    RZ.busy = false; rzRepaint();
  },
  rzBack: () => { SFX.tap(); RZ.res = null; RZ.err = ""; rzRepaint(); },
  rzGo: () => rzWrite(),
  rzOnline: async (a) => {
    if (!rzLive()) { ACT.auOpen && ACT.auOpen(); return; }
    if (a) a.disabled = true;
    const cfg = { ...(S.resto.resaCfg || (typeof rsDefCfg === "function" ? rsDefCfg() : {})), online: true };
    try { await safe(DB.update("restos", S.rid, { resaCfg: cfg })); S.resto.resaCfg = cfg; SFX.done(); buzz(8); toast("Réservation en ligne ouverte"); rzRepaint(); if (typeof rsSync === "function") rsSync(); } catch (e) { if (a) a.disabled = false; }
  },
});
document.addEventListener("change", (ev) => {
  const el = ev.target; if (!el || !el.matches || !el.matches("[data-rzfile]")) return;
  const f = el.files && el.files[0]; if (!f) return; RZ.fileObj = f; RZ.err = ""; ACT.rzRead();
});
document.addEventListener("dragover", (ev) => { const d = ev.target && ev.target.closest && ev.target.closest("[data-rzdrop]"); if (d) { ev.preventDefault(); d.classList.add("over"); } });
document.addEventListener("dragleave", (ev) => { const d = ev.target && ev.target.closest && ev.target.closest("[data-rzdrop]"); if (d) d.classList.remove("over"); });
document.addEventListener("drop", (ev) => { const d = ev.target && ev.target.closest && ev.target.closest("[data-rzdrop]"); if (!d) return; ev.preventDefault(); d.classList.remove("over"); const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) { RZ.fileObj = f; ACT.rzRead(); } });
