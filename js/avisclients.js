/* Growth Gusto — area: avis clients (route « avisClients »). Prefix « vc ».
   « Comment nous avez-vous trouvés ? » from the restaurant's side: every note left by a client after the meal, the unhappy ones first.
   Where the notes come from (the public page avis/, server functions/src/avisclient.js):
     · the e-mail « Votre déjeuner s'est bien passé ? » (functions/src/resa.js reviewTick): its stars open the page with that note;
     · the QR order page (commande/), once the order is served: « Comment c'était ? »;
     · the « Votre avis » QR card printed from here, for the table or the bill (anonymous).
   4 or 5 stars: the client's words are copied and Google's review form opens, they paste and publish (Google lets nobody publish for
   them). 3 or less: the message comes here privately, an alert goes to the team (Alertes, push once notifications are on), and the
   client may still go to Google: Google forbids hiding it from unhappy clients.
   Data: restos/{rid}/feedback (S.feedback, shared with js/finance.js), docs { source:"client", channel:"resa"|"qr"|"emporter"|"table"|…,
     rating, tags[], text, by, email?, phone?, recontact, private, status:"a_traiter"|"repondu"|"clos", googleAt?, bookingId?, orderId?,
     table?, reply?, repliedAt?, repliedBy? }. Written by the server; the app only adds the reply and the status. */
"use strict";

Object.assign(IC, {
  vcStar: ["m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z", "f:m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"],
  vcLock: ["r:4,11,16,10,2", "M8 11V7a4 4 0 0 1 8 0v4"],
  vcOut: ["M14 4h6v6", "M20 4 10 14", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
  vcReply: ["M9 17 4 12l5-5", "M20 18v-2a4 4 0 0 0-4-4H4"],
  vcQr: ["r:3,3,7,7,1.5", "r:14,3,7,7,1.5", "r:3,14,7,7,1.5", "M14 14h3v3", "M20 14v.01", "M14 20h.01", "M17 20h3v-3"],
  vcMail: ["r:2,4,20,16,2", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  vcSms: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
});
TAB_OF.avisClients = "more";
/* side nav: right after « Clients & fidélité » (else Réservations); the phone and tablet « Plus » menu copies NAV */
(function vcNav() {
  if (NAV.some((n) => n[0] === "avisClients")) return;
  let i = NAV.findIndex((n) => n[0] === "clients"); if (i < 0) i = NAV.findIndex((n) => n[0] === "resa");
  NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["avisClients", "vcStar", "Avis clients"]);
})();
try { if (typeof PM_ROUTE !== "undefined") PM_ROUTE.avisClients = PM_ROUTE.avisClients || "resa"; } catch (e) {}
try { if (typeof AB_GATE !== "undefined" && !AB_GATE.avisClients) AB_GATE.avisClients = ["pro", "Avis clients"]; } catch (e) {}
/* onboarding: with « Clients & fidélité » */
try { if (typeof PC_FAMILLES !== "undefined") { const f = PC_FAMILLES.find((x) => x[0] === "clients"); if (f && !f[4].includes("avisClients")) f[4].push("avisClients"); } } catch (e) {}
if (typeof PC_LECONS === "object") PC_LECONS.avisClients = {
  t: "Avis clients", d: "Après le repas, chaque client note sa visite en un geste. Les contents publient sur Google, les déçus vous écrivent à vous d'abord.",
  who: ["salle", "boss"],
  steps: ["Ouvrez « À traiter » : les notes de 3 étoiles ou moins arrivent ici", "Touchez « Répondre » : un message prêt à envoyer, par e-mail ou SMS", "Posez le QR « Votre avis » sur les tables ou l'addition"],
  q: ["Un client met 2 étoiles. Que se passe-t-il ?", ["Son message arrive chez vous, en privé, et vous pouvez lui répondre", "Il est publié tout de suite sur Google", "Il est effacé"], 0],
  tip: "Répondez dans la journée : un client déçu à qui l'on répond revient souvent.",
  sc: { k: "list", t: "Avis clients", rows: [["vcStar", "Léa · 5 étoiles", "Publié sur Google", "ok"], ["vcStar", "Hugo · 2 étoiles", "À traiter", "warn"], ["vcQr", "QR « Votre avis »", "Table 6", "acc"]] },
};
/* alerts: an unhappy note is an alert of its own kind (js/alertes.js), opening this screen */
try {
  if (typeof AL_TYPES !== "undefined" && !AL_TYPES.some((t) => t[0] === "avis")) { AL_TYPES.push(["avis", "vcStar", "Avis client à traiter", "Une note de 3 étoiles ou moins", "warn"]); AL_TYPE.avis = AL_TYPES[AL_TYPES.length - 1]; }
  if (typeof AL_DEF !== "undefined" && AL_DEF.on && AL_DEF.on.avis == null) AL_DEF.on.avis = true;
  if (typeof alGoCause === "function" && !alGoCause.vc) { const prev = alGoCause; alGoCause = function (a) { if (a && a.type === "avis") return go("avisClients", { tab: "todo" }); return prev(a); }; alGoCause.vc = true; }
} catch (e) {}

const VC = { tab: "todo", seeded: null };
const VC_TAGS = { cuisine: "La cuisine", service: "Le service", accueil: "L'accueil", ambiance: "L'ambiance", prix: "Le prix", quantite: "Les quantités", attente: "L'attente", temperature: "Plats tièdes", bruit: "Le bruit", proprete: "La propreté" };
/* the same, inside a sentence of the reply */
const VC_SAY = { cuisine: "la cuisine", service: "le service", accueil: "l'accueil", ambiance: "l'ambiance", prix: "le prix", quantite: "les quantités", attente: "l'attente", temperature: "les plats servis tièdes", bruit: "le bruit", proprete: "la propreté" };
const VC_CH = { resa: ["Après réservation", "resa"], qr: ["Menu QR à table", "cmQr"], emporter: ["À emporter", "cmQr"], table: ["QR « Votre avis »", "vcQr"], salle: ["En salle", "users"], google: ["Google", "vcStar"], tripadvisor: ["Tripadvisor", "vcStar"], thefork: ["TheFork", "vcStar"] };
const vcPl = (n, w, p) => `${n} ${n > 1 ? p || w + "s" : w}`;
const vcRows = () => (S.feedback || []).filter((f) => f && f.source === "client" && num(f.rating) != null).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
const vcTodo = (f) => f.status === "a_traiter" && num(f.rating) <= 3;
const vcMgr = () => { try { if (DB.mode === "demo") return true; if (typeof PERMS !== "undefined" && PERMS.isAdmin) return !!PERMS.isAdmin(); } catch (e) {} return myRole() === "gerant"; };
function vcBase() { const h = location.hostname; if (/growthgusto\.fr$|github\.io$/.test(h) || location.protocol === "file:") return "https://app.growthgusto.fr/avis/"; return new URL("avis/", location.href.split("?")[0].split("#")[0]).href; }
const vcUrl = () => vcBase() + "?r=" + encodeURIComponent(DB.mode === "demo" ? "demo" : S.rid || "");
const vcGoogle = () => { try { return typeof rsGoogleUrl === "function" ? rsGoogleUrl(((S.resto && S.resto.resaCfg) || {}).googleReview) : ""; } catch (e) { return ""; } };
const vcStars = (n, cls) => `<span class="vc-stars ${cls || ""}" aria-label="${n} sur 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? "on" : ""}">${ico("vcStar")}</i>`).join("")}</span>`;

/* ───────── demo: the visits of the last weeks left their notes ───────── */
function vcSeedDemo() {
  if (DB.mode !== "demo" || VC.seeded === S.rid) return; VC.seeded = S.rid;
  const path = DB.path("feedback"); const D = (DB.local[path] ||= {}); if (D["vc-1"]) return;
  const now = Date.now(), H = 3600e3;
  const X = [
    ["vc-1", 5, "resa", ["cuisine", "service"], "Un excellent dîner. Le bourguignon fond dans la bouche, et Inès a été aux petits soins. On reviendra !", "Léa Martin", 2, "clos", true, { email: "lea.martin@mail.fr" }],
    ["vc-2", 2, "qr", ["attente", "temperature"], "40 minutes pour le plat, et il était tiède. Dommage, l'entrée était très bonne.", "Hugo Mercier", 5, "a_traiter", false, { phone: "06 33 90 12 54", table: "6", recontact: true }],
    ["vc-3", 5, "qr", ["ambiance", "cuisine"], "Super ambiance, les croquettes sont une tuerie.", "Table 3", 20, "clos", true, { table: "3" }],
    ["vc-4", 4, "resa", ["accueil", "prix"], "Très bon rapport qualité-prix pour le menu du midi.", "Antoine Roux", 26, "clos", true, { email: "antoine.roux@mail.fr" }],
    ["vc-5", 3, "table", ["bruit"], "Bonne cuisine mais très bruyant le samedi soir, on s'entendait à peine.", "Claire", 30, "a_traiter", false, { email: "claire.dubois@mail.fr", recontact: true }],
    ["vc-6", 5, "emporter", ["quantite"], "", "Nicolas Faure", 50, "clos", false, {}],
    ["vc-7", 1, "resa", ["service"], "Réservation pour 4, on nous a installés à 2 tables séparées sans prévenir.", "Pierre Morel", 75, "repondu", false, { email: "pierre.morel@mail.fr", recontact: true, reply: "Bonjour Pierre, vous avez raison et nous en sommes désolés. Votre prochain dessert est pour nous.", repliedAt: now - 70 * H, repliedBy: "Camille Laurent" }],
    ["vc-8", 5, "resa", ["cuisine", "service", "ambiance"], "Coup de cœur : Le Bistrot Démo. Mention spéciale pour la cuisine, le service et l'ambiance. À ne pas manquer.", "Sophie Laurent", 98, "clos", true, { email: "sophie.laurent@mail.fr" }],
  ];
  X.forEach(([id, rating, channel, tags, text, by, hAgo, status, g, extra]) => { const at = now - hAgo * H; D[id] = { source: "client", channel, rating, tags, text, by, at, day: dayKey(new Date(at)), status, private: rating <= 3, recontact: false, ...(g ? { googleAt: at + 4 * 60e3 } : {}), ...extra }; });
  DB.emit(path);
}

VIEWS.avisClients = {
  render() {
    vcSeedDemo();
    const all = vcRows(), since = Date.now() - 30 * 864e5, m = all.filter((f) => f.at >= since);
    const avg = m.length ? m.reduce((a, f) => a + num(f.rating), 0) / m.length : null;
    const todo = all.filter(vcTodo), toG = m.filter((f) => f.googleAt).length, happy = m.filter((f) => num(f.rating) >= 4).length;
    const dist = [5, 4, 3, 2, 1].map((n) => [n, m.filter((f) => Math.round(num(f.rating)) === n).length]); const dmax = Math.max(1, ...dist.map((d) => d[1]));
    if (VC.tab === "todo" && !todo.length) VC.tab = "all";
    const g = vcGoogle(), c = (S.resto && S.resto.resaCfg) || {}, mailOn = !!g && c.reviewAsk !== false;

    const hero = `<div class="vc-hero wall st" style="--i:1">
      <div class="vc-h-l"><span class="vc-h-k">${ico("vcStar")}Note des 30 derniers jours</span>
        <div class="vc-h-n"><b class="mono">${avg != null ? fmt(avg, 1) : "–"}</b><span>/ 5</span></div>${avg != null ? vcStars(avg, "big") : `<p class="vc-h-s">Les premières notes arrivent après les premiers repas.</p>`}
        <div class="vc-h-f"><span><b class="mono">${m.length}</b> ${m.length > 1 ? "avis" : "avis"}</span><span><b class="mono">${toG}</b> vers Google</span>${todo.length ? `<span class="warn"><b class="mono">${todo.length}</b> à traiter</span>` : ""}</div></div>
      <div class="vc-dist" aria-hidden="true">${dist.map(([n, k], i) => `<div class="vc-dr" style="--w:${(k / dmax) * 100}%;--j:${i}"><span>${n}</span><i></i><em class="mono">${k}</em></div>`).join("")}</div>
    </div>`;

    const how = `<div class="glass pad vc-how st" style="--i:2"><div class="vc-how-h"><span class="lbl">Comment les avis arrivent</span>${happy ? `<span class="sub">${Math.min(100, Math.round((toG / happy) * 100))} % des clients contents sont allés sur Google ce mois-ci</span>` : ""}</div>
      ${!g ? `<div class="vc-warn">${ico("vcStar")}<div><b>Ajoutez votre lien d'avis Google</b><span>Sans lui, les clients contents ne peuvent pas publier sur Google.</span></div>${vcMgr() && VIEWS.resa ? `<button class="btn acc sm" data-act="vcCfg">Ajouter</button>` : ""}</div>` : ""}
      <div class="vc-src">
        <div class="vc-s"><span class="vc-si">${ico("vcMail")}</span><div class="tx"><b>E-mail après le repas</b><em>${mailOn ? `Envoyé ${c.reviewWhen === "lendemain" ? "le lendemain à 11 h" : "2 h 30 après la table"} aux clients qui ont réservé` : "Coupé ou sans lien Google"}</em></div>${vcMgr() && VIEWS.resa ? `<button class="btn soft sm" data-act="vcCfg">Régler</button>` : ""}</div>
        <div class="vc-s"><span class="vc-si">${ico("cmQr")}</span><div class="tx"><b>Menu QR à table</b><em>Une fois servi, le client voit « Comment c'était ? » sur son téléphone</em></div></div>
        <div class="vc-s"><span class="vc-si">${ico("vcQr")}</span><div class="tx"><b>QR « Votre avis »</b><em>À poser sur la table ou à glisser avec l'addition</em></div><button class="btn soft sm" data-act="vcQr">Afficher</button></div>
      </div>
      <button class="vc-try" data-act="vcTry">${ico("vcOut")}Voir la page du client</button></div>`;

    const tabs = `<div class="seg vc-seg st" style="--i:3" role="tablist">${[["todo", `À traiter${todo.length ? ` · ${todo.length}` : ""}`], ["all", "Tous"], ["google", "Sur Google"]].map(([k, l]) => `<button class="${VC.tab === k ? "on" : ""}" data-act="vcTab" data-v="${k}" role="tab" aria-selected="${VC.tab === k}">${l}</button>`).join("")}</div>`;
    const shown = VC.tab === "todo" ? todo : VC.tab === "google" ? all.filter((f) => f.googleAt) : all;
    const card = (f, i) => {
      const ch = VC_CH[f.channel] || [f.channel || "Client", "users"], low = num(f.rating) <= 3, t = vcTodo(f);
      return `<div class="glass vc-card st${low ? " low" : ""}${t ? " todo" : ""}" style="--i:${Math.min(i + 4, 14)}">
        <div class="vc-c-h"><span class="vc-av">${esc(initials(f.by || "Client"))}</span><div class="tx"><b>${esc(f.by || "Client")}${f.table ? ` <i>· table ${esc(f.table)}</i>` : ""}</b><em>${ico(ch[1])}${esc(ch[0])} · ${esc(when(f.at))}</em></div>${vcStars(num(f.rating))}</div>
        ${(f.tags || []).length ? `<div class="vc-tags">${f.tags.map((k) => `<span class="${low ? "bad" : "ok"}">${esc(VC_TAGS[k] || k)}</span>`).join("")}</div>` : ""}
        ${f.text ? `<p class="vc-txt">« ${esc(f.text)} »</p>` : ""}
        <div class="vc-c-f">${f.googleAt ? `<span class="pill ok">${ico("vcOut")}Parti sur Google</span>` : low ? `<span class="pill ${t ? "warn" : ""}">${ico("vcLock")}Privé</span>` : ""}${f.recontact ? `<span class="pill acc">Veut être recontacté</span>` : ""}
          ${f.reply ? `<span class="vc-rep">${ico("vcReply")}Répondu${f.repliedBy ? ` par ${esc(String(f.repliedBy).split(" ")[0])}` : ""} ${esc(when(f.repliedAt))}</span>` : ""}
          <span class="sp"></span>${low && (f.email || f.phone) ? `<button class="btn ${t ? "acc" : "soft"} sm" data-act="vcReply" data-id="${esc(f.id)}">${ico("vcReply")}Répondre</button>` : ""}${t ? `<button class="btn soft sm" data-act="vcDone" data-id="${esc(f.id)}">Traité</button>` : ""}</div>
      </div>`;
    };
    const list = shown.length ? `<div class="vc-list">${shown.slice(0, 120).map(card).join("")}</div>`
      : `<div class="glass empty st" style="--i:4"><div class="ic">${ico("vcStar")}</div><b>${VC.tab === "google" ? "Aucun avis parti sur Google pour l'instant" : "Rien à traiter"}</b>${VC.tab === "google" ? "Les clients contents y sont invités juste après leur note." : "Aucun client déçu en attente de réponse. Bravo à l'équipe !"}</div>`;
    return `<div class="inner vc">${topBar("Avis clients")}<div class="vc-grid"><div class="vc-side">${hero}${how}</div><div class="vc-main">${tabs}${list}</div></div></div>`;
  },
};

/* ───────── reply: a message ready to send, from the restaurant's own phone or mailbox (free) ───────── */
function vcReplyText(f) {
  const nm = String(f.by || "").trim().split(/\s+/)[0], rn = (S.resto && S.resto.name) || "le restaurant", me = String(S.me.name || "").split(" ")[0];
  const what = (f.tags || []).map((k) => VC_SAY[k] || "").filter(Boolean);
  return `Bonjour${nm && !/^table/i.test(nm) ? " " + nm : ""},\n\nMerci d'avoir pris le temps de nous écrire après votre visite chez ${rn}. ${what.length ? `Vous avez raison pour ${what.length > 1 ? what.slice(0, -1).join(", ") + " et " + what[what.length - 1] : what[0]}, et nous en sommes désolés.` : "Nous sommes désolés que tout n'ait pas été parfait."} Nous en avons parlé avec l'équipe.\n\nNous serions ravis de vous accueillir à nouveau pour vous montrer le meilleur de notre maison.\n\n${me ? me + ", " : ""}${rn}`;
}
function vcReplySheet(f) {
  const can = [f.email ? ["mail", "vcMail", "E-mail"] : null, f.phone ? ["sms", "vcSms", "SMS"] : null].filter(Boolean);
  openSheet(`<div class="vc-sheet"><div class="h3">Répondre à ${esc(f.by || "ce client")}</div>
    <div class="vc-quote">${vcStars(num(f.rating))}${f.text ? `<p>« ${esc(f.text)} »</p>` : ""}</div>
    <label class="field"><span class="lbl">Votre message</span><textarea class="input" id="vcMsg" rows="8">${esc(vcReplyText(f))}</textarea></label>
    <p class="sub">Il part de ${can.length > 1 ? "votre messagerie ou de votre téléphone" : can[0] && can[0][0] === "sms" ? "votre téléphone" : "votre messagerie"}, à votre nom. Gratuit.</p>
    <div class="vc-sb">${can.map(([k, ic, l], i) => `<button class="btn ${i ? "soft" : "acc"} block" data-act="vcSend" data-id="${esc(f.id)}" data-v="${k}">${ico(ic)}Envoyer par ${l}</button>`).join("")}</div></div>`);
}

Object.assign(ACT, {
  vcTab: (a, id, v) => { SFX.tick(); buzz(3); VC.tab = v; refresh(); },
  vcCfg: () => { SFX.tap(); go("resa"); setTimeout(() => { try { ACT.rsCfgOpen(null, null, "a"); } catch (e) {} }, 350); },
  vcTry: () => { SFX.tap(); window.open(vcUrl() + (DB.mode === "demo" ? "&b=demo&k=" + "0".repeat(32) : ""), "_blank", "noopener"); },
  vcReply: (a, id) => { const f = vcRows().find((x) => x.id === id); if (!f) return; SFX.sheet(); vcReplySheet(f); },
  vcSend: (a, id, v) => {
    const f = vcRows().find((x) => x.id === id); if (!f) return; const el = document.getElementById("vcMsg"); const msg = (el ? el.value : vcReplyText(f)).trim(); if (!msg) return;
    const rn = (S.resto && S.resto.name) || "Restaurant";
    const url = v === "mail" ? `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(`Votre visite chez ${rn}`)}&body=${encodeURIComponent(msg)}` : `sms:${String(f.phone).replace(/[^\d+]/g, "")}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}`;
    if (DB.mode !== "demo") { try { location.href = url; } catch (e) {} }
    DB.update("feedback", id, { reply: msg, repliedAt: Date.now(), repliedBy: S.me.name || "", replyVia: v, status: "repondu" }).catch(() => {});
    try { logEvent("avis", `Réponse à l'avis de ${f.by || "un client"} (${f.rating}/5)`, { feedbackId: id }); } catch (e) {}
    closeSheet(); SFX.done(); burst(); toast(DB.mode === "demo" ? "Démo : le message serait parti" : "Réponse notée", "ok");
  },
  vcDone: (a, id) => { const f = vcRows().find((x) => x.id === id); if (!f) return; SFX.ok(); buzz(8); DB.update("feedback", id, { status: "clos", closedAt: Date.now(), closedBy: S.me.name || "" }).catch(() => {}); toastUndo("Avis traité"); S.ui.undo = () => DB.update("feedback", id, { status: "a_traiter", closedAt: null, closedBy: null }); },
  vcQr: () => {
    SFX.sheet(); const url = vcUrl(), nm = (S.resto && S.resto.name) || "Votre restaurant";
    openSheet(`<div class="vc-sheet vc-qrs"><div class="h3">QR « Votre avis »</div><p class="sub">Sur la table, le comptoir ou avec l'addition : le client scanne, note, et les contents publient sur Google.</p>
      <div class="vc-qrcard th-keep"><span class="vc-qk">Votre avis compte</span><b>${esc(nm)}</b><div class="vc-qq">${typeof qrSvg === "function" ? qrSvg(url) : ""}</div><span class="vc-qs">${[1, 2, 3, 4, 5].map(() => ico("vcStar")).join("")}</span><em>Scannez, notez en dix secondes</em></div>
      <div class="vc-sb"><button class="btn acc block" data-act="vcPrint">${ico("printer")}Imprimer 6 cartes</button><button class="btn soft block" data-act="vcCopy">Copier le lien</button></div></div>`);
  },
  vcCopy: async () => { try { await navigator.clipboard.writeText(vcUrl()); SFX.ok(); toast("Lien copié", "ok"); } catch (e) { toast(vcUrl()); } },
  vcPrint: () => {
    const nm = esc((S.resto && S.resto.name) || "Votre restaurant"), q = typeof qrSvg === "function" ? qrSvg(vcUrl()) : "";
    const star = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#F6B93B" d="m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"/></svg>`;
    const card = `<div class="c"><div class="k">Votre avis compte</div><div class="n">${nm}</div><div class="q">${q}</div><div class="s">${star.repeat(5)}</div><div class="t">Scannez, notez en dix secondes</div></div>`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Votre avis · ${nm}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,600..800&family=Instrument+Sans:wght@500;600;700&display=swap"><style>
      @page{size:A4;margin:10mm}body{margin:0;font-family:"Instrument Sans",sans-serif;color:#1B1530}.g{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
      .c{height:84mm;border:1.5px dashed #DCCFB8;border-radius:6mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm;background:#FBF6EC;text-align:center}
      .k{font:700 10pt "Instrument Sans";color:#5B2BFF}.n{font:800 16pt/1.05 "Bricolage Grotesque";letter-spacing:-.02em;max-width:80mm}.q{width:40mm;height:40mm;padding:2mm;background:#fff;border-radius:3mm}.q svg{width:100%;height:100%}.t{font:600 9pt "Instrument Sans";color:#615B74}</style></head><body><div class="g">${card.repeat(6)}</div></body></html>`;
    const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; document.body.appendChild(f);
    const d = f.contentDocument; d.open(); d.write(html); d.close(); SFX.print ? SFX.print() : SFX.tap();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 700);
  },
});
