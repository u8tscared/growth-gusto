/* Growth Gusto — area: avis (avis clients, retours équipe, synthèse) */
/* Data (collection "feedback", V3 contract), all fields optional except source/text/at:
   client : { source:"client", rating:1-5, dish?, noteId?, channel, text, at, day, table?, client?, by, uid, status:"a_traiter"|"repondu"|"clos", reply?, repliedAt?, repliedBy? }
   équipe : { source:"equipe", kind:"idee"|"incident", text, urgent?, at, by, uid, status:"a_traiter"|"en_cours"|"clos", reply?, voters:[uid] }
   Helper for other areas: avisStats(from, to) → { count, avg, positivePct, toReply, openTeam }. */

Object.assign(IC, {
  avBulb: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4", "f:M12 2a6 6 0 0 0-4.5 9.5c.7.7 1.3 1.5 1.5 2.5h6c.2-1 .7-1.7 1.5-2.5A6 6 0 0 0 12 2z"],
  avMsg: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  avCopy: ["r:8,8,14,14,2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  avTel: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"],
  avMail: ["r:2,4,20,16,2", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  avGlobe: ["c:12,12,10", "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
  avFork: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"],
  avOwl: ["c:7,14,4", "c:17,14,4", "c:7,14,1", "c:17,14,1", "M11 14h2", "M3 10l2-4h4l3 3 3-3h4l2 4"],
  avUp: ["M7 10v12", "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"],
});
TAB_OF.avis = "more";

const AV_CH = [["salle", "En salle", "store"], ["google", "Google", "avGlobe"], ["tripadvisor", "TripAdvisor", "avOwl"], ["thefork", "TheFork", "avFork"], ["tel", "Téléphone", "avTel"], ["email", "E-mail", "avMail"]];
const AV_ONLINE = ["google", "tripadvisor", "thefork"];
const AV_ST = { a_traiter: ["À traiter", "warn"], repondu: ["Répondu", "acc"], clos: ["Clos", "ok"] };
const AV_EST = { a_traiter: ["Nouveau", "warn"], en_cours: ["En cours", "acc"], clos: ["Réglé", "ok"] };
const AV_RLAB = ["", "Décevant", "Moyen", "Correct", "Très bien", "Parfait !"];
const AV_NOTES = [523, 659, 784, 988, 1319];
const avCh = (k) => AV_CH.find((c) => c[0] === k) || AV_CH[0];
const avNorm = (s) => String(s || "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
const avRecipes = () => S.notes.filter((n) => n.cat === "Recettes" && String(n.title || "").trim());
const avClients = () => S.feedback.filter((f) => f.source !== "equipe" && f.rating);
const avTeam = () => S.feedback.filter((f) => f.source === "equipe");
const avTone = (r) => (r >= 4 ? "ok" : r === 3 ? "warn" : "bad");
const avFmt = (v) => (v == null || isNaN(v) ? "–" : v.toFixed(1).replace(".", ","));
const avStarSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${IC.star[0]}"/></svg>`;
const avStars = (r, cls = "") => `<span class="av-mini ${cls}" aria-label="${r} sur 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= r ? "on" : ""}">${avStarSvg}</i>`).join("")}</span>`;
const avPlural = (n, w, p) => `${n} ${n > 1 ? p || w + "s" : w}`;
/* the recipe a review is about: its saved link, or a recipe with the same name */
const avNoteOf = (f) => { if (f.noteId && S.notes.some((n) => n.id === f.noteId)) return f.noteId; const k = avNorm(f.dish); if (!k) return null; return avRecipes().find((n) => avNorm(n.title) === k)?.id || null; };
const avF = () => (S.ui.av ||= { tab: "clients", r: 0, ch: "salle", dish: "", noteId: "", text: "", table: "", day: dayKey(), client: "", more: false, filter: "todo", lim: 30, eqKind: "idee", eqText: "", eqUrgent: false, eqFilter: "open", per: "90" });

async function avLog(text, ref) { try { return await DB.add("events", { type: "feedback", text, at: Date.now(), uid: S.me.id, ref }); } catch (e) { return null; } }

/* ───────── shared helper (dashboard, home) ───────── */
function avisStats(from = 0, to = Date.now()) {
  const L = avClients().filter((f) => f.at >= from && f.at <= to);
  const avg = L.length ? L.reduce((s, f) => s + f.rating, 0) / L.length : null;
  return { count: L.length, avg, positivePct: L.length ? Math.round((L.filter((f) => f.rating >= 4).length / L.length) * 100) : null, toReply: avClients().filter((f) => (f.status || "a_traiter") === "a_traiter").length, openTeam: avTeam().filter((f) => f.status !== "clos").length };
}

/* ───────── reply templates (warm, professional) ───────── */
function avTplCtx(f) {
  const c = String(f.client || "").trim(); const me = firstName(S.me.name); const resto = S.resto?.name || "";
  return { hi: c ? `Bonjour ${c},` : "Bonjour,", dish: String(f.dish || "").trim().toLowerCase(), sign: [me, `L'équipe${resto ? ` · ${resto}` : ""}`].filter(Boolean).join("\n") };
}
const AV_TPL = [
  { k: "t5", t: "Merci chaleureux", fit: (r) => r === 5, txt: (x) => `${x.hi}\n\nMerci infiniment pour ce magnifique retour ! Toute l'équipe est ravie que vous ayez passé un si bon moment chez nous${x.dish ? `, et que notre ${x.dish} vous ait autant plu` : ""}. Ce sont des mots comme les vôtres qui nous donnent envie de nous dépasser chaque jour.\n\nAu plaisir de vous accueillir à nouveau très bientôt !\n\n${x.sign}` },
  { k: "t4", t: "Merci + 5e étoile", fit: (r) => r === 4, txt: (x) => `${x.hi}\n\nMerci beaucoup pour votre avis et pour ces quatre belles étoiles ! Nous sommes heureux que votre passage vous ait plu${x.dish ? `, notamment notre ${x.dish}` : ""}. Nous travaillons chaque jour pour décrocher la cinquième : si un détail vous a manqué, dites-le-nous lors de votre prochaine visite, nous serons à l'écoute.\n\nÀ très bientôt,\n\n${x.sign}` },
  { k: "t3", t: "Avis mitigé", fit: (r) => r === 3, txt: (x) => `${x.hi}\n\nMerci d'avoir pris le temps de partager votre expérience. Nous sommes contents que certains aspects vous aient plu, et nous prenons bonne note de ce qui n'a pas été à la hauteur de vos attentes${x.dish ? `, en particulier sur notre ${x.dish}` : ""} : vos remarques ont été transmises à toute l'équipe.\n\nNous serions heureux de vous recevoir à nouveau pour vous montrer le meilleur de notre cuisine.\n\nBien cordialement,\n\n${x.sign}` },
  { k: "t1", t: "Excuses sincères", fit: (r) => r <= 2, txt: (x) => `${x.hi}\n\nMerci pour votre retour, et toutes nos excuses : votre expérience n'a pas été celle que nous souhaitons offrir à chacun de nos clients${x.dish ? `, et nous sommes sincèrement désolés que notre ${x.dish} vous ait déçu` : ""}. Nous l'avons partagée avec l'équipe en cuisine comme en salle pour que cela ne se reproduise pas.\n\nNous aimerions beaucoup en parler avec vous directement : n'hésitez pas à nous contacter par téléphone ou par e-mail. Nous espérons avoir l'occasion de vous faire changer d'avis.\n\nBien sincèrement,\n\n${x.sign}` },
  { k: "wait", t: "Attente trop longue", fit: (r, f) => r <= 3 && /attent|lent|long|oubli|retard/.test(avNorm(f.text)), txt: (x) => `${x.hi}\n\nMerci pour votre retour, et pardon pour l'attente que vous avez subie. Ce n'est pas l'accueil que nous voulons vous réserver : nous revoyons l'organisation du service pour que chaque table soit servie dans de bonnes conditions, même les soirs de forte affluence.\n\nNous espérons vous revoir bientôt pour vous offrir l'expérience que vous méritez.\n\nBien cordialement,\n\n${x.sign}` },
  { k: "short", t: "Merci express", fit: (r) => r >= 4, txt: (x) => `${x.hi} merci beaucoup pour ce joli retour ! Toute l'équipe vous attend avec plaisir pour une prochaine visite.\n\n${x.sign}` },
];
const avTplFor = (f) => { const r = f.rating || 3; const fit = AV_TPL.filter((t) => t.fit(r, f)); return [...fit.map((t) => ({ ...t, best: true })), ...AV_TPL.filter((t) => !fit.includes(t))]; };

/* ───────── view ───────── */
VIEWS.avis = {
  render() {
    const F = avF(); const todo = avClients().filter((f) => (f.status || "a_traiter") === "a_traiter").length; const open = avTeam().filter((f) => f.status !== "clos").length;
    const tabs = [["clients", "star", "Clients", todo], ["equipe", "users", "Équipe", open], ["synthese", "trend", "Synthèse", 0]]; const ix = tabs.findIndex((t) => t[0] === F.tab);
    const body = F.tab === "equipe" ? avTeamHTML() : F.tab === "synthese" ? avSynthHTML() : avClientsHTML();
    return `<div class="inner ${F.tab === "synthese" ? "wide" : "narrow"} av-wrap">${topBar("Avis & retours", { right: F.tab === "synthese" && S.feedback.length ? `<button class="iconbtn" data-act="avCsv" aria-label="Exporter en CSV" title="Exporter en CSV">${ico("download")}</button>` : "" })}
      <div class="seg av-seg st" style="--i:1"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${ix * 100}%)"></span>${tabs.map(([k, ic, t, n]) => `<button class="${F.tab === k ? "on" : ""}" data-act="avTab" data-v="${k}">${ico(ic)}<span>${t}</span>${n ? `<em class="mono">${n}</em>` : ""}</button>`).join("")}</div>
      ${body}</div>`;
  },
  after(v) {
    const F = avF();
    const d = $("#avDish", v); if (d) d.addEventListener("input", () => { F.noteId = ""; avSugPaint(); });
    const c = $("#avChart", v); if (c) avChartHover(c);
  },
};

/* ───────── clients ───────── */
function avSugHTML() {
  const F = avF(); const R = avRecipes(); if (!R.length) return "";
  const cnt = {}; avClients().forEach((f) => { const id = avNoteOf(f); if (id) cnt[id] = (cnt[id] || 0) + 1; });
  const q = avNorm(F.dish); let L = R.filter((n) => !q || avNorm(n.title).includes(q) || n.id === F.noteId);
  L.sort((a, b) => (b.id === F.noteId) - (a.id === F.noteId) || (cnt[b.id] || 0) - (cnt[a.id] || 0) || String(a.title).localeCompare(String(b.title), "fr"));
  L = L.slice(0, 10);
  if (!L.length) return `<span class="note av-free">« ${esc(F.dish)} » sera enregistré tel quel.</span>`;
  return L.map((n) => `<button class="chip ${n.id === F.noteId ? "on" : ""}" data-act="avDishPick" data-id="${n.id}">${n.id === F.noteId ? ico("check") : ""}${esc(n.title)}</button>`).join("");
}
function avSugPaint() { const s = $("#avSug"); if (s) s.innerHTML = avSugHTML(); }
function avStarsInput(r) {
  return `<div class="av-stars" id="avStars" role="radiogroup" aria-label="Note">${[1, 2, 3, 4, 5].map((i) => `<button class="av-star ${i <= r ? "on" : ""}" data-act="avRate" data-v="${i}" role="radio" aria-checked="${i === r}" aria-label="${i} étoile${i > 1 ? "s" : ""}">${avStarSvg}</button>`).join("")}</div>
    <div class="av-rlab ${r ? avTone(r) : ""}" id="avRlab">${r ? AV_RLAB[r] : "Touchez une étoile"}</div>`;
}
function avClientsHTML() {
  const F = avF(); const R = avRecipes(); const all = avClients();
  const todo = all.filter((f) => (f.status || "a_traiter") === "a_traiter");
  const L = F.filter === "todo" ? todo : F.filter === "neg" ? all.filter((f) => f.rating <= 3) : all;
  const shown = L.slice(0, F.lim);
  const form = `<div class="glass av-cap st" style="--i:2">
      ${avStarsInput(F.r)}
      <div class="chips av-chs" role="group" aria-label="Canal">${AV_CH.map(([k, t, ic]) => `<button class="chip ${F.ch === k ? "on" : ""}" data-act="avCh" data-v="${k}">${ico(ic)}${t}</button>`).join("")}</div>
      <div class="field"><span>Plat</span><input class="input" id="avDish" data-bind="ui.av.dish" value="${esc(F.dish)}" autocomplete="off" enterkeyhint="done" placeholder="${R.length ? "Choisir ou écrire un plat (facultatif)" : "Ex. croquettes de jambon (facultatif)"}"></div>
      ${R.length ? `<div class="chips av-sug" id="avSug">${avSugHTML()}</div>` : `<p class="note av-tip">${ico("book")}<span>Astuce : créez vos <button class="av-link" data-go="notes">fiches recettes</button> pour choisir le plat en un geste et suivre sa note.</span></p>`}
      <div class="field"><span>Commentaire</span><textarea class="input av-ta" rows="2" data-bind="ui.av.text" placeholder="Ce que le client a dit, en quelques mots">${esc(F.text)}</textarea></div>
      <button class="av-more ${F.more ? "on" : ""}" data-act="avMore" aria-expanded="${F.more}">${ico("down")}Table, date, nom du client</button>
      <div class="av-extra" ${F.more ? "" : "hidden"}><div class="grid3"><label class="field"><span>Table</span><input class="input mono" inputmode="numeric" data-bind="ui.av.table" value="${esc(F.table)}" placeholder="12"></label><label class="field" style="grid-column:span 2"><span>Date</span><input class="input" type="date" data-bind="ui.av.day" value="${esc(F.day)}" max="${dayKey()}"></label></div>
        <label class="field"><span>Nom du client</span><input class="input" data-bind="ui.av.client" value="${esc(F.client)}" autocomplete="off" placeholder="Pour personnaliser la réponse"></label></div>
      <button class="btn acc block" data-act="avSave">${ico("check")}Enregistrer l'avis</button>
    </div>`;
  const filt = `<div class="av-lh st" style="--i:3"><span class="h3">Avis reçus</span><div class="chips">${[["todo", `À traiter${todo.length ? ` · ${todo.length}` : ""}`], ["all", "Tous"], ["neg", "≤ 3 étoiles"]].map(([k, t]) => `<button class="chip ${F.filter === k ? "on" : ""}" data-act="avFilter" data-v="${k}">${t}</button>`).join("")}</div></div>`;
  const empty = !all.length ? `<div class="glass empty st" style="--i:4"><div class="ic">${ico("star")}</div><b>Aucun avis pour l'instant</b>Notez chaque retour client en 5 secondes : une note, le plat, le canal. Les avis Google, TripAdvisor et TheFork arrivent ici « à traiter », avec une réponse toute prête.</div>`
    : !L.length ? `<div class="glass empty st" style="--i:4"><div class="ic ok">${ico("check")}</div><b>${F.filter === "todo" ? "Tout est traité" : "Rien ici"}</b>${F.filter === "todo" ? "Bravo : aucun avis n'attend de réponse." : "Aucun avis ne correspond à ce filtre."}</div>` : "";
  return `${form}${filt}${empty}${shown.length ? `<div class="av-list">${shown.map((f, i) => avItem(f, i)).join("")}</div>` : ""}${L.length > shown.length ? `<button class="btn soft block" data-act="avLim">Voir ${Math.min(30, L.length - shown.length)} de plus</button>` : ""}`;
}
function avItem(f, i) {
  const [, cht, chi] = avCh(f.channel); const st = AV_ST[f.status || "a_traiter"] || AV_ST.a_traiter;
  return `<button class="glass av-item st" style="--i:${Math.min(4 + i, 14)}" data-act="avOpen" data-id="${f.id}">
    <span class="av-score ${avTone(f.rating)}"><b class="mono">${f.rating}</b>${avStarSvg}</span>
    <span class="av-itx"><span class="av-ih"><b>${esc(f.dish || cht)}</b><span class="pill ${st[1]}">${st[0]}</span></span>
      ${f.text ? `<span class="av-q">${esc(f.text)}</span>` : ""}
      <span class="av-meta">${ico(chi)}${cht} · ${when(f.at)}${f.table ? ` · table ${esc(f.table)}` : ""}${f.reply ? ` · ${ico("avMsg")}réponse` : ""}</span></span></button>`;
}
function avSheet(f) {
  const [, cht, chi] = avCh(f.channel); const st = f.status || "a_traiter"; const online = AV_ONLINE.includes(f.channel); const nid = avNoteOf(f);
  const replyable = f.channel !== "salle"; const tpls = replyable ? avTplFor(f) : [];
  return `<div class="av-sh">
    <div class="av-shh"><span class="av-score big ${avTone(f.rating)}"><b class="mono">${f.rating}</b>${avStarSvg}</span><div style="min-width:0;flex:1"><div class="h2" style="font-size:20px">${esc(f.dish || "Avis " + cht)}</div><div class="sub av-shm">${ico(chi)}<span>${cht} · ${when(f.at)}${f.table ? ` · table ${esc(f.table)}` : ""}${f.client ? ` · ${esc(f.client)}` : ""}</span></div></div></div>
    ${f.text ? `<blockquote class="av-quote">${esc(f.text)}</blockquote>` : ""}
    <div class="note">Saisi par ${esc(f.by || nameOf(f.uid))}${nid ? ` · <button class="av-link" data-act="avFiche" data-id="${nid}">voir la fiche recette</button>` : ""}</div>
    <div class="seg av-sseg" id="avSt"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${Object.keys(AV_ST).indexOf(st) * 100}%)"></span>${Object.entries(AV_ST).map(([k, [t]]) => `<button class="${k === st ? "on" : ""}" data-act="avStatus" data-id="${f.id}" data-v="${k}">${t}</button>`).join("")}</div>
    <div class="field"><span>${replyable ? (online ? `Réponse publiée sur ${cht}` : "Réponse au client") : "Suite donnée (geste, échange…)"}</span>
      ${tpls.length ? `<div class="chips av-tpls">${tpls.map((t) => `<button class="chip ${t.best ? "best" : ""}" data-act="avTpl" data-id="${f.id}" data-v="${t.k}">${t.best ? ico("sparkle") : ""}${t.t}</button>`).join("")}</div>` : ""}
      <textarea class="input av-reply" id="avReply" rows="7" placeholder="${replyable ? "Choisissez un modèle ci-dessus ou écrivez votre réponse" : "Ex. dessert offert, le chef est passé en salle"}">${esc(f.reply || "")}</textarea></div>
    <div class="grid2">${replyable ? `<button class="btn soft" data-act="avCopy">${ico("avCopy")}Copier</button>` : `<button class="btn soft" data-act="sheetClose">Fermer</button>`}<button class="btn acc" data-act="avReplySave" data-id="${f.id}">${ico("check")}${replyable ? "Répondu" : "Enregistrer"}</button></div>
    ${f.repliedAt ? `<p class="note" style="margin:-4px 0 0;text-align:center">Dernière réponse ${when(f.repliedAt)} par ${esc(f.repliedBy || "")}</p>` : ""}
    <button class="btn ghost av-del" data-act="avDel" data-id="${f.id}">${ico("trash")}Supprimer cet avis</button></div>`;
}

/* ───────── équipe ───────── */
function avTeamHTML() {
  const F = avF(); const all = avTeam(); const inc = F.eqKind === "incident";
  const sorted = all.slice().sort((a, b) => (a.status === "clos") - (b.status === "clos") || (!!b.urgent && b.status !== "clos") - (!!a.urgent && a.status !== "clos") || (b.voters || []).length - (a.voters || []).length || b.at - a.at);
  const L = sorted.filter((f) => (F.eqFilter === "open" ? f.status !== "clos" : F.eqFilter === "done" ? f.status === "clos" : true));
  const form = `<div class="glass av-cap st" style="--i:2">
    <div class="av-kind">${[["idee", "avBulb", "Une idée"], ["incident", "alert", "Un problème"]].map(([k, ic, t]) => `<button class="av-kbtn ${k} ${F.eqKind === k ? "on" : ""}" data-act="avKind" data-v="${k}" aria-pressed="${F.eqKind === k}">${ico(ic)}<b>${t}</b></button>`).join("")}</div>
    <textarea class="input av-ta" id="avEqText" rows="2" data-bind="ui.av.eqText" placeholder="${inc ? "Ex. le frigo 2 ferme mal" : "Ex. un plat du jour végétarien le mardi"}">${esc(F.eqText)}</textarea>
    <div class="av-eqcta">${inc ? `<button class="chip av-urg ${F.eqUrgent ? "on" : ""}" data-act="avUrg" aria-pressed="${F.eqUrgent}">${ico("alert")}Urgent</button>` : ""}
    <button class="btn acc ${inc ? "" : "block"}" data-act="avEqSave">${ico("check")}${inc ? "Signaler" : "Proposer l'idée"}</button></div></div>`;
  const nOpen = all.filter((f) => f.status !== "clos").length;
  const filt = `<div class="av-lh st" style="--i:3"><span class="h3">Idées & problèmes</span><div class="chips">${[["open", `Ouverts${nOpen ? ` · ${nOpen}` : ""}`], ["done", "Réglés"], ["all", "Tous"]].map(([k, t]) => `<button class="chip ${F.eqFilter === k ? "on" : ""}" data-act="avEqFilter" data-v="${k}">${t}</button>`).join("")}</div></div>`;
  const empty = !all.length ? `<div class="glass empty st" style="--i:4"><div class="ic">${ico("avBulb")}</div><b>La boîte est vide</b>Chacun peut proposer une idée ou signaler un souci (« le frigo 2 ferme mal »). L'équipe vote +1 pour faire remonter ce qui compte.</div>`
    : !L.length ? `<div class="glass empty st" style="--i:4"><div class="ic ok">${ico("check")}</div><b>${F.eqFilter === "open" ? "Rien en attente" : "Rien ici"}</b>${F.eqFilter === "open" ? "Tous les retours de l'équipe ont été réglés." : "Aucun retour ne correspond."}</div>` : "";
  return `${form}${filt}${empty}${L.length ? `<div class="av-list">${L.map((f, i) => avEqItem(f, i)).join("")}</div>` : ""}`;
}
function avEqItem(f, i) {
  const st = AV_EST[f.status || "a_traiter"] || AV_EST.a_traiter; const inc = f.kind === "incident"; const v = (f.voters || []).length; const mine = (f.voters || []).includes(S.me.id); const hot = f.urgent && f.status !== "clos";
  return `<div class="glass av-eq st ${f.status === "clos" ? "done" : ""} ${hot ? "hot" : ""}" style="--i:${Math.min(4 + i, 14)}">
    <button class="av-eqb" data-act="avEqOpen" data-id="${f.id}"><span class="ic ${inc ? (hot ? "bad" : "warn") : ""}">${ico(inc ? "alert" : "avBulb")}</span>
      <span class="av-itx"><span class="av-et">${esc(f.text)}</span><span class="av-meta">${hot ? `<span class="pill bad"><span class="dot"></span>Urgent</span>` : ""}<span class="pill ${st[1]}">${st[0]}</span><span>${esc(firstName(f.by) || firstName(nameOf(f.uid)))} · ${when(f.at)}</span>${f.reply ? ico("avMsg") : ""}</span></span></button>
    <button class="av-vote ${mine ? "on" : ""}" data-act="avVote" data-id="${f.id}" aria-pressed="${mine}" aria-label="Voter +1"><span>${ico("avUp")}</span><b class="mono">${v}</b></button></div>`;
}
function avEqSheet(f) {
  const st = f.status || "a_traiter"; const inc = f.kind === "incident";
  return `<div class="av-sh"><div class="av-shh"><span class="ic ${inc ? "warn" : ""}" style="width:48px;height:48px">${ico(inc ? "alert" : "avBulb")}</span><div style="min-width:0;flex:1"><div class="lbl">${inc ? "Problème signalé" : "Idée"}${f.urgent ? " · urgent" : ""}</div><div class="h3" style="font-size:18px;margin-top:3px">${esc(f.text)}</div><div class="sub" style="margin-top:4px">${esc(f.by || nameOf(f.uid))} · ${when(f.at)} · ${avPlural((f.voters || []).length, "vote")}</div></div></div>
    <div class="seg av-sseg"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${Object.keys(AV_EST).indexOf(st) * 100}%)"></span>${Object.entries(AV_EST).map(([k, [t]]) => `<button class="${k === st ? "on" : ""}" data-act="avStatus" data-id="${f.id}" data-v="${k}">${t}</button>`).join("")}</div>
    <label class="field"><span>Réponse / suite donnée</span><textarea class="input av-reply" id="avReply" rows="4" placeholder="${inc ? "Ex. technicien appelé, passage jeudi" : "Ex. on teste la semaine prochaine"}">${esc(f.reply || "")}</textarea></label>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Fermer</button><button class="btn acc" data-act="avReplySave" data-id="${f.id}">${ico("check")}Enregistrer</button></div>
    <button class="btn ghost av-del" data-act="avDel" data-id="${f.id}">${ico("trash")}Supprimer</button></div>`;
}

/* ───────── synthèse ───────── */
const AV_PER = [["30", "30 jours"], ["90", "90 jours"], ["365", "12 mois"], ["all", "Tout"]];
const AV_STOP = new Set(("a ai aie as au aux avec avoir avons bcp beaucoup bien bon bonne c ca car ce cela celle celui ces cet cette chez comme d dans de des deja du elle elles en encore est et etaient etait ete etre eu fait faire fois il ils j je jusqu l la le les leur lui m ma mais me meme mes moi mon n ne nos notre nous on ont ou par pas peu plus pour pourtant qu que quel quelle qui s sa sans se ses si son sont sur ta te tes toi ton tous tout toute tres trop tu un une vers vos votre vous y " +
  "plat plats restaurant resto repas soir midi table service client clients etais avait avaient serait sommes etes suis vraiment assez juste rien tant aussi alors donc puis apres avant toujours jamais non oui ici cest nest jai etions personne chose entre sous dont quand comme car cela leurs ceux celles deux trois").split(" "));
function avWords(L) {
  const m = {};
  L.forEach((f) => { const seen = new Set(); String(f.text || "").split(/[^\p{L}'’-]+/u).forEach((raw) => { const w0 = raw.replace(/^[a-z]['’]/i, "").replace(/^-+|['’-]+$/g, ""); const n = avNorm(w0).replace(/\s/g, ""); if (n.length < 3 || AV_STOP.has(n)) return; const k = n.length > 4 ? n.replace(/(es|s|x)$/, "") : n; if (seen.has(k)) return; seen.add(k); const e = (m[k] ||= { n: 0, forms: {} }); e.n++; const fm = w0.toLowerCase(); e.forms[fm] = (e.forms[fm] || 0) + 1; }); });
  return Object.values(m).filter((e) => e.n >= (L.length > 6 ? 2 : 1)).sort((a, b) => b.n - a.n).slice(0, 14).map((e) => ({ w: Object.entries(e.forms).sort((a, b) => b[1] - a[1])[0][0], n: e.n }));
}
function avSeries(L, per) {
  const monthly = per === "365" || per === "all"; const B = {};
  const key = (ts) => { const d = new Date(ts); if (monthly) return monthKey(d); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))); };
  L.forEach((f) => { const k = key(f.at); (B[k] ||= { k, s: 0, n: 0 }); B[k].s += f.rating; B[k].n++; });
  return Object.values(B).sort((a, b) => (a.k < b.k ? -1 : 1)).map((b) => ({ ...b, v: b.s / b.n, lab: monthly ? AV_MS[+b.k.slice(5, 7) - 1] + (b.k.slice(5, 7) === "01" ? " " + b.k.slice(2, 4) : "") : shortDate(b.k), tip: monthly ? monthLabel(b.k) : `semaine du ${shortDate(b.k)}` }));
}
const AV_MS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
function avChartSvg(pts, W = 640) {
  const H = W < 500 ? 190 : 230, l = 30, r = 16, t = 22, b = 30; const iw = W - l - r, ih = H - t - b; const n = pts.length;
  const x = (i) => (n === 1 ? l + iw / 2 : l + (i * iw) / (n - 1)); const y = (v) => t + ((5 - v) / 4) * ih;
  const grid = [1, 2, 3, 4, 5].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" class="av-gl"/><text x="${l - 10}" y="${y(v) + 4}" class="av-ax" text-anchor="end">${v}</text>`).join("");
  const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 70))));
  const xl = pts.map((p, i) => (i === n - 1 || (i % step === 0 && n - 1 - i >= step * 0.7)) ? `<text x="${x(i)}" y="${H - 8}" class="av-ax" text-anchor="${n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}">${esc(p.lab)}</text>` : "").join("");
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = n > 1 ? `<path class="av-area" d="${d} L${x(n - 1).toFixed(1)},${t + ih} L${x(0).toFixed(1)},${t + ih} Z"/>` : "";
  const last = pts[n - 1]; const hw = iw / Math.max(2, n);
  return `<svg viewBox="0 0 ${W} ${H}" class="av-svg" role="img" aria-label="Note moyenne dans le temps : de ${avFmt(pts[0].v)} à ${avFmt(last.v)}"><defs><linearGradient id="avGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7A4DFF" stop-opacity=".22"/><stop offset="1" stop-color="#7A4DFF" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xl}${area}${n > 1 ? `<path class="av-ln" d="${d}" pathLength="1"/>` : ""}
    ${pts.map((p, i) => `<circle class="av-pt" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5" style="--d:${(0.4 + (i / Math.max(1, n)) * 0.9).toFixed(2)}s"/>`).join("")}
    <text x="${x(n - 1)}" y="${y(last.v) - 12}" class="av-lv" text-anchor="${n > 1 ? "end" : "middle"}">${avFmt(last.v)}</text>
    <line class="av-cross" id="avCross" x1="0" x2="0" y1="${t}" y2="${t + ih}" style="opacity:0"/>
    <g id="avHits">${pts.map((p, i) => `<rect x="${(x(i) - hw / 2).toFixed(1)}" y="0" width="${hw.toFixed(1)}" height="${H}" fill="transparent" data-i="${i}" data-x="${x(i).toFixed(1)}" data-y="${y(p.v).toFixed(1)}"/>`).join("")}</g></svg>`;
}
function avChartHover(box) {
  let pts = []; try { pts = JSON.parse(box.dataset.pts || "[]"); } catch (e) {} if (!pts.length) return;
  const W = Math.max(260, Math.round(box.clientWidth)); const old = $("svg", box); if (old) old.outerHTML = avChartSvg(pts, W);
  const svg = $("svg", box), tip = $(".av-tip2", box), cross = $("#avCross", box); if (!svg || !tip) return;
  const show = (rect) => { const p = pts[+rect.dataset.i]; if (!p) return; const bb = svg.getBoundingClientRect(), k = bb.width / W; cross.setAttribute("x1", rect.dataset.x); cross.setAttribute("x2", rect.dataset.x); cross.style.opacity = 1;
    tip.innerHTML = `<b class="mono">${avFmt(p.v)} ★</b><span>${esc(p.tip)} · ${avPlural(p.n, "avis", "avis")}</span>`; tip.hidden = false; const tx = Math.max(4, Math.min(bb.width - tip.offsetWidth - 4, rect.dataset.x * k - tip.offsetWidth / 2)); tip.style.transform = `translate(${tx}px,${Math.max(0, rect.dataset.y * k - tip.offsetHeight - 12)}px)`; };
  const hide = () => { tip.hidden = true; cross.style.opacity = 0; };
  svg.addEventListener("pointermove", (e) => { const r = e.target.closest("#avHits rect"); if (r) show(r); });
  svg.addEventListener("pointerdown", (e) => { const r = e.target.closest("#avHits rect"); if (r) { show(r); SFX.tick(); } });
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
}
function avSynthHTML() {
  const F = avF(); const days = F.per === "all" ? null : +F.per; const now = Date.now(); const from = days ? now - days * 864e5 : 0;
  const all = avClients(); const L = all.filter((f) => f.at >= from);
  const per = `<div class="chips av-per st" style="--i:2">${AV_PER.map(([k, t]) => `<button class="chip ${F.per === k ? "on" : ""}" data-act="avPer" data-v="${k}">${t}</button>`).join("")}</div>`;
  if (!L.length) return `${per}<div class="glass empty st" style="--i:3"><div class="ic">${ico("trend")}</div><b>${all.length ? "Aucun avis sur la période" : "La synthèse se remplit toute seule"}</b>${all.length ? "Choisissez une période plus longue." : "Dès les premiers avis : note moyenne dans le temps, plats les mieux notés et à surveiller, canaux, et les mots qui reviennent dans les critiques."}<div style="margin-top:14px"><button class="btn acc sm" data-act="avTab" data-v="clients">${ico("plus")}Noter un avis</button></div></div>`;
  const mean = (A) => A.reduce((s, f) => s + f.rating, 0) / A.length;
  const avg = mean(L); const prevL = days ? all.filter((f) => f.at >= from - days * 864e5 && f.at < from) : [];
  const delta = prevL.length ? avg - mean(prevL) : null;
  const pos = Math.round((L.filter((f) => f.rating >= 4).length / L.length) * 100);
  const onl = L.filter((f) => AV_ONLINE.includes(f.channel)); const repl = onl.filter((f) => f.reply || f.status === "repondu" || f.status === "clos").length;
  const todo = all.filter((f) => (f.status || "a_traiter") === "a_traiter").length;
  const kpi = `<div class="av-kpis">
    <div class="glass av-kpi hero st" style="--i:3"><span class="lbl">Note moyenne</span><b class="mono av-big">${avFmt(avg)}<small>/5</small></b>${avStars(Math.round(avg))}${delta != null && Math.abs(delta) >= 0.05 ? `<span class="av-delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "▲" : "▼"} ${avFmt(Math.abs(delta))} vs période précédente</span>` : delta != null ? `<span class="av-delta">Stable vs période précédente</span>` : ""}</div>
    <div class="glass av-kpi st" style="--i:4"><span class="lbl">Avis</span><b class="mono">${L.length}</b><span class="note">${avPlural(L.filter((f) => f.text).length, "commentaire")}</span></div>
    <div class="glass av-kpi st" style="--i:5"><span class="lbl">Clients ravis</span><b class="mono">${pos}<small>%</small></b><span class="note">4 ou 5 étoiles</span></div>
    <div class="glass av-kpi st" style="--i:6"><span class="lbl">Réponses en ligne</span><b class="mono">${onl.length ? Math.round((repl / onl.length) * 100) + "<small>%</small>" : "–"}</b><span class="note">${onl.length ? `${repl} sur ${onl.length}` : "aucun avis en ligne"}</span></div>
    <button class="glass av-kpi tap st ${todo ? "warn" : ""}" style="--i:7" data-act="avGoTodo"><span class="lbl">À traiter</span><b class="mono">${todo}</b><span class="note">${todo ? "Répondre maintenant" : "Tout est à jour"}</span></button></div>`;
  const pts = avSeries(L, F.per);
  const chart = `<div class="glass pad av-card av-span st" style="--i:8"><div class="row"><span class="h3">Note moyenne dans le temps</span><span class="note">${F.per === "365" || F.per === "all" ? "par mois" : "par semaine"}</span></div>
    <div class="av-chart" id="avChart" data-pts="${esc(JSON.stringify(pts.map((p) => ({ v: p.v, n: p.n, tip: p.tip, lab: p.lab }))))}">${avChartSvg(pts)}<div class="av-tip2" hidden></div></div></div>`;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: L.filter((f) => f.rating === s).length })); const dmax = Math.max(...dist.map((d) => d.n), 1);
  const distH = `<div class="glass pad av-card st" style="--i:9"><span class="h3">Répartition des notes</span><div class="av-dist">${dist.map((d, i) => `<div class="av-dr"><span class="av-ds mono">${d.s}${avStarSvg}</span><span class="av-bar"><i class="${avTone(d.s)}" style="--w:${(d.n / dmax) * 100}%;--d:${i * 70}ms"></i></span><b class="mono">${d.n}</b></div>`).join("")}</div></div>`;
  /* dishes */
  const D = {}; L.forEach((f) => { const nid = avNoteOf(f); const name = nid ? S.notes.find((n) => n.id === nid)?.title : String(f.dish || "").trim(); if (!name) return; const k = nid || "t:" + avNorm(name); (D[k] ||= { k, nid, name, s: 0, n: 0 }); D[k].s += f.rating; D[k].n++; });
  const dishes = Object.values(D).map((d) => ({ ...d, v: d.s / d.n }));
  const top = dishes.filter((d) => d.v >= 3.5).sort((a, b) => b.v - a.v || b.n - a.n).slice(0, 4);
  const flop = dishes.filter((d) => d.v < 4 && !top.includes(d)).sort((a, b) => a.v - b.v || b.n - a.n).slice(0, 4);
  const drow = (d) => `<${d.nid ? `button data-act="avFiche" data-id="${d.nid}"` : "div"} class="li ${d.nid ? "tap" : ""} av-dish"><span class="av-score ${avTone(Math.round(d.v))}"><b class="mono">${avFmt(d.v)}</b>${avStarSvg}</span><span class="tx"><b>${esc(d.name)}</b><em>${avPlural(d.n, "avis", "avis")}${d.nid ? " · voir la fiche" : ""}</em></span>${d.nid ? ico("chev") : ""}</${d.nid ? "button" : "div"}>`;
  const dishH = `<div class="glass pad av-card st" style="--i:10"><span class="h3">Par plat</span>${dishes.length ? `<div class="av-dcols"><div><div class="lbl av-dl ok">${ico("avUp")}Les plus appréciés</div>${top.length ? top.map(drow).join("") : `<p class="note">Pas encore de plat bien noté.</p>`}</div><div><div class="lbl av-dl bad">${ico("alert")}À surveiller</div>${flop.length ? flop.map(drow).join("") : `<p class="note">Aucun plat sous 4 étoiles. Bravo à la cuisine.</p>`}</div></div>` : `<p class="note">Indiquez le plat en notant un avis pour voir vos tops et vos flops.</p>`}</div>`;
  /* channels */
  const C = AV_CH.map(([k, t, ic]) => { const l = L.filter((f) => (f.channel || "salle") === k); return { k, t, ic, n: l.length, v: l.length ? mean(l) : null }; }).filter((c) => c.n).sort((a, b) => b.n - a.n); const cmax = Math.max(...C.map((c) => c.n), 1);
  const chH = `<div class="glass pad av-card st" style="--i:11"><span class="h3">Par canal</span><div class="av-dist">${C.map((c, i) => `<div class="av-cr"><span class="av-cn">${ico(c.ic)}<span>${c.t}</span></span><span class="av-bar"><i class="acc" style="--w:${(c.n / cmax) * 100}%;--d:${i * 70}ms"></i></span><b class="mono">${c.n}</b><span class="av-score sm ${avTone(Math.round(c.v))}"><b class="mono">${avFmt(c.v)}</b>${avStarSvg}</span></div>`).join("")}</div></div>`;
  /* words */
  const neg = L.filter((f) => f.rating <= 3 && f.text); const posL = L.filter((f) => f.rating >= 4 && f.text);
  const wn = avWords(neg), wp = avWords(posL);
  const cloud = (W, cls) => { const mx = Math.max(...W.map((w) => w.n), 1); return `<div class="av-cloud">${W.map((w, i) => `<span class="av-w ${cls}" style="--s:${(0.88 + (w.n / mx) * 0.42).toFixed(2)};--i:${i}">${esc(w.w)}<em class="mono">${w.n}</em></span>`).join("")}</div>`; };
  const wordH = `<div class="glass pad av-card st" style="--i:12"><span class="h3">Ce qui revient dans les critiques</span><p class="note" style="margin:2px 0 10px">Mots les plus fréquents dans les avis à 3 étoiles ou moins (${avPlural(neg.length, "commentaire")}).</p>${wn.length ? cloud(wn, "bad") : `<p class="note">Aucune critique écrite sur la période.</p>`}
    ${wp.length ? `<div class="lbl" style="margin-top:16px">Ce que les clients aiment</div>${cloud(wp, "ok")}` : ""}</div>`;
  /* team */
  const T = avTeam(); const tOpen = T.filter((f) => f.status !== "clos"); const tInc = tOpen.filter((f) => f.kind === "incident"); const nIdea = tOpen.length - tInc.length; const tTop = tOpen.filter((f) => f.kind !== "incident").sort((a, b) => (b.voters || []).length - (a.voters || []).length)[0];
  const teamH = T.length ? `<button class="glass pad av-card av-team st" style="--i:13" data-act="avTab" data-v="equipe"><span class="h3">Côté équipe</span><span class="av-tr"><span><b class="mono">${tInc.length}</b>${tInc.length > 1 ? "problèmes ouverts" : "problème ouvert"}</span><span><b class="mono">${nIdea}</b>${nIdea > 1 ? "idées en attente" : "idée en attente"}</span></span>${tTop && (tTop.voters || []).length ? `<span class="note">Idée la plus votée : « ${esc(tTop.text)} » (${avPlural((tTop.voters || []).length, "vote")})</span>` : ""}</button>` : "";
  return `${per}${kpi}<div class="av-grid">${chart}${dishH}${wordH}${distH}${chH}${teamH}</div>`;
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  avTab: (a, id, v) => { const F = avF(); if (F.tab === v) return; F.tab = v; SFX.tap(); buzz(4); closeSheet(true); rerender(); const vw = $("#viewport .view:not(.leave)"); if (vw) vw.scrollTop = 0; },
  avRate: (a, id, v) => {
    const F = avF(); const r = +v; F.r = r;
    $$("#avStars .av-star").forEach((b, i) => { const on = i < r; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(i + 1 === r)); b.classList.remove("pop"); b.style.setProperty("--d", `${i * 45}ms`); if (on) { void b.offsetWidth; b.classList.add("pop"); } });
    for (let i = 0; i < r; i++) SFX.tone(AV_NOTES[i], 0.14, "sine", 0.026, i * 0.045);
    const lab = $("#avRlab"); if (lab) { lab.textContent = AV_RLAB[r]; lab.className = `av-rlab ${avTone(r)}`; void lab.offsetWidth; lab.classList.add("bump"); }
    buzz(r === 5 ? [6, 40, 10] : 6);
    if (r === 5) { const b = a.getBoundingClientRect(); setTimeout(() => burst(b.left + b.width / 2, b.top + b.height / 2), 220); }
  },
  avCh: (a, id, v) => { const F = avF(); F.ch = v; SFX.tick(); buzz(3); $$(".av-chs .chip").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); },
  avDishPick: (a, id) => { const F = avF(); const n = S.notes.find((x) => x.id === id); if (!n) return; if (F.noteId === id) { F.noteId = ""; F.dish = ""; } else { F.noteId = id; F.dish = n.title; } const i = $("#avDish"); if (i) i.value = F.dish; SFX.tick(); buzz(3); avSugPaint(); },
  avMore: (a) => { const F = avF(); F.more = !F.more; SFX.tap(); a.classList.toggle("on", F.more); a.setAttribute("aria-expanded", String(F.more)); const x = $(".av-extra"); if (x) x.hidden = !F.more; },
  avSave: async (a) => {
    const F = avF();
    if (!F.r) { SFX.err(); buzz([20, 40, 20]); const s = $("#avStars"); if (s) { s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake"); } toast("Touchez une note de 1 à 5 étoiles", "err"); return; }
    const dish = String(F.dish || "").replace(/\s+/g, " ").trim(); const nid = F.noteId || (dish ? avRecipes().find((n) => avNorm(n.title) === avNorm(dish))?.id : "") || "";
    const day = F.day && F.day <= dayKey() ? F.day : dayKey(); const at = day === dayKey() ? Date.now() : parseDay(day).getTime() + 12 * 36e5;
    const online = AV_ONLINE.includes(F.ch);
    const d = { source: "client", rating: F.r, channel: F.ch, text: String(F.text || "").trim(), at, day, by: S.me.name || nameOf(S.me.id), uid: S.me.id, status: online || F.r <= 3 ? "a_traiter" : "clos" };
    if (dish) d.dish = dish; if (nid) d.noteId = nid; if (String(F.table || "").trim()) d.table = String(F.table).trim(); if (String(F.client || "").trim()) d.client = String(F.client).trim();
    a.disabled = true; let fid;
    try { fid = await safe(DB.add("feedback", d)); } catch (e) { a.disabled = false; return; }
    const evId = await avLog(`a noté un avis ${d.rating}★ (${avCh(d.channel)[1]})${dish ? ` sur « ${dish} »` : ""}`, fid);
    if (d.rating >= 4) SFX.done(); else SFX.ok(); buzz([8, 30, 8]);
    if (d.rating === 5) { const b = a.getBoundingClientRect(); burst(b.left + b.width / 2, b.top); }
    Object.assign(F, { r: 0, dish: "", noteId: "", text: "", table: "", client: "", day: dayKey(), more: false, filter: d.status === "a_traiter" ? "todo" : F.filter === "todo" ? "all" : F.filter });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    rerender(); S.ui.undo = { col: "feedback", id: fid, evId }; toastUndo(d.status === "a_traiter" ? (online ? "Avis enregistré · réponse à publier" : "Avis enregistré · à traiter") : "Avis enregistré");
    const it = $(`.av-item[data-id="${fid}"]`); if (it) it.classList.add("av-new");
  },
  avFilter: (a, id, v) => { const F = avF(); F.filter = v; F.lim = 30; SFX.tick(); rerender(); },
  avLim: () => { const F = avF(); F.lim += 30; SFX.tap(); rerender(); },
  avOpen: (a, id) => { const f = S.feedback.find((x) => x.id === id); if (!f) return; SFX.tap(); S.ui.avDelArm = null; openSheet(avSheet(f)); },
  avEqOpen: (a, id) => { const f = S.feedback.find((x) => x.id === id); if (!f) return; SFX.tap(); S.ui.avDelArm = null; openSheet(avEqSheet(f)); },
  avFiche: (a, id) => { SFX.tap(); closeSheet(true); go("fiche", { id }); },
  avStatus: async (a, id, v) => {
    const f = S.feedback.find((x) => x.id === id); if (!f || (f.status || "a_traiter") === v) return;
    const eq = f.source === "equipe"; const M = eq ? AV_EST : AV_ST; const keys = Object.keys(M);
    const seg = a.closest(".seg"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); const k = $(".knob", seg); if (k) k.style.transform = `translateX(${keys.indexOf(v) * 100}%)`; }
    SFX.tick(); buzz(4);
    try { await safe(DB.update("feedback", id, { status: v })); } catch (e) { return; }
    await avLog(eq ? `a passé « ${String(f.text).slice(0, 60)} » en ${M[v][0].toLowerCase()}` : `a passé un avis ${f.rating}★ en ${M[v][0].toLowerCase()}`, id);
    if (v === "clos") { SFX.ok(); if (eq) toast(f.kind === "incident" ? "Problème réglé" : "Idée réalisée"); }
  },
  avTpl: (a, id, v) => {
    const f = S.feedback.find((x) => x.id === id); const t = AV_TPL.find((x) => x.k === v); const ta = $("#avReply"); if (!f || !t || !ta) return;
    ta.value = t.txt(avTplCtx(f)); ta.classList.remove("av-fill"); void ta.offsetWidth; ta.classList.add("av-fill"); ta.scrollTop = 0;
    $$(".av-tpls .chip").forEach((c) => c.classList.toggle("on", c === a)); SFX.tick(); buzz(4);
  },
  avCopy: async () => {
    const ta = $("#avReply"); const t = ta ? ta.value.trim() : ""; if (!t) { SFX.err(); toast("Choisissez un modèle ou écrivez une réponse", "err"); return; }
    let ok = false; try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { ta.select(); ok = document.execCommand("copy"); } catch (e2) {} }
    if (ok) { SFX.ok(); buzz(6); toast("Réponse copiée : collez-la sur la plateforme"); } else toast("Copie impossible : sélectionnez le texte à la main", "err");
  },
  avReplySave: async (a, id) => {
    const f = S.feedback.find((x) => x.id === id); const ta = $("#avReply"); if (!f || !ta) return; const reply = ta.value.trim(); const eq = f.source === "equipe";
    if (!reply && !f.reply) { closeSheet(); return; }
    const patch = { reply, repliedAt: Date.now(), repliedBy: S.me.name || nameOf(S.me.id) }; const st = f.status || "a_traiter";
    if (!eq && reply && st === "a_traiter") patch.status = f.channel === "salle" ? "clos" : "repondu";
    if (eq && reply && st === "a_traiter") patch.status = "en_cours";
    try { await safe(DB.update("feedback", id, patch)); } catch (e) { return; }
    await avLog(eq ? `a répondu à « ${String(f.text).slice(0, 60)} »` : `a répondu à un avis ${f.rating}★ (${avCh(f.channel)[1]})`, id);
    closeSheet(true); SFX.done(); buzz([8, 30, 8]); toast(eq ? "Réponse enregistrée" : patch.status === "repondu" ? "Avis marqué répondu" : "Suite enregistrée");
  },
  avDel: async (a, id) => {
    const f = S.feedback.find((x) => x.id === id); if (!f) return;
    if (S.ui.avDelArm !== id) { S.ui.avDelArm = id; SFX.tap(); buzz(10); a.classList.add("arm"); a.innerHTML = `${ico("trash")}Toucher encore pour supprimer`; setTimeout(() => { if (S.ui.avDelArm === id && a.isConnected) { S.ui.avDelArm = null; a.classList.remove("arm"); a.innerHTML = `${ico("trash")}Supprimer`; } }, 3500); return; }
    S.ui.avDelArm = null;
    try { await safe(DB.del("feedback", id)); } catch (e) { return; }
    await avLog(f.source === "equipe" ? `a supprimé le retour « ${String(f.text).slice(0, 60)} »` : `a supprimé un avis ${f.rating}★ (${avCh(f.channel)[1]})`, id);
    closeSheet(); toast("Supprimé");
  },
  /* équipe */
  avKind: (a, id, v) => { const F = avF(); if (F.eqKind === v) return; const t = $("#avEqText"); if (t) F.eqText = t.value; F.eqKind = v; SFX.tick(); buzz(4); rerender(); },
  avUrg: (a) => { const F = avF(); F.eqUrgent = !F.eqUrgent; SFX.tick(); buzz(5); a.classList.toggle("on", F.eqUrgent); a.setAttribute("aria-pressed", String(F.eqUrgent)); },
  avEqSave: async (a) => {
    const F = avF(); const t = $("#avEqText"); const text = String((t ? t.value : F.eqText) || "").replace(/\s+/g, " ").trim();
    if (!text) { SFX.err(); if (t) { t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); t.focus(); } toast(F.eqKind === "incident" ? "Décrivez le problème en quelques mots" : "Écrivez votre idée en quelques mots", "err"); return; }
    const inc = F.eqKind === "incident"; const d = { source: "equipe", kind: F.eqKind, text, at: Date.now(), by: S.me.name || nameOf(S.me.id), uid: S.me.id, status: "a_traiter", voters: [] }; if (inc && F.eqUrgent) d.urgent = true;
    a.disabled = true; let fid; try { fid = await safe(DB.add("feedback", d)); } catch (e) { a.disabled = false; return; }
    const evId = await avLog(inc ? `a signalé un problème${d.urgent ? " urgent" : ""} : « ${text.slice(0, 80)} »` : `a proposé une idée : « ${text.slice(0, 80)} »`, fid);
    if (t) t.blur(); Object.assign(F, { eqText: "", eqUrgent: false, eqFilter: "open" }); SFX.done(); buzz([8, 30, 8]); rerender();
    S.ui.undo = { col: "feedback", id: fid, evId }; toastUndo(inc ? "Problème signalé à l'équipe" : "Idée envoyée, merci !");
  },
  avEqFilter: (a, id, v) => { avF().eqFilter = v; SFX.tick(); rerender(); },
  avVote: async (a, id) => {
    const f = S.feedback.find((x) => x.id === id); if (!f) return; const V = (f.voters || []).slice(); const mine = V.includes(S.me.id);
    const next = mine ? V.filter((u) => u !== S.me.id) : [...V, S.me.id];
    a.classList.toggle("on", !mine); const b = $("b", a); if (b) { b.textContent = next.length; b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    if (!mine) { const p = document.createElement("span"); p.className = "av-plus"; p.textContent = "+1"; a.appendChild(p); setTimeout(() => p.remove(), 900); SFX.tone(1319, 0.08, "sine", 0.03); SFX.tone(1760, 0.12, "sine", 0.024, 0.06); buzz(8); } else { SFX.tick(); buzz(3); }
    await new Promise((r) => setTimeout(r, 420));
    try { await safe(DB.update("feedback", id, { voters: next })); } catch (e) { return; }
    if (!mine) avLog(`a voté +1 pour « ${String(f.text).slice(0, 60)} »`, id);
  },
  /* synthèse */
  avPer: (a, id, v) => { avF().per = v; SFX.tick(); rerender(); },
  avGoTodo: () => { const F = avF(); F.tab = "clients"; F.filter = "todo"; SFX.tap(); rerender(); setTimeout(() => { const l = $(".av-lh"); l && l.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); },
  avCsv: () => {
    const rows = [["Date", "Source", "Note", "Plat", "Canal", "Commentaire", "Table", "Client", "Statut", "Réponse", "Votes", "Saisi par"]];
    S.feedback.slice().sort((a, b) => a.at - b.at).forEach((f) => { const eq = f.source === "equipe"; rows.push([`${dayKey(new Date(f.at))} ${hm(f.at)}`, eq ? (f.kind === "incident" ? "Équipe · problème" : "Équipe · idée") : "Client", f.rating || "", f.dish || "", eq ? "" : avCh(f.channel)[1], f.text || "", f.table || "", f.client || "", ((eq ? AV_EST : AV_ST)[f.status || "a_traiter"] || [""])[0], f.reply || "", eq ? (f.voters || []).length : "", f.by || ""]); });
    saveCsv(`avis-${dayKey()}.csv`, rows);
  },
});
