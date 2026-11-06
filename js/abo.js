/* Growth Gusto — abonnement (area prefix « ab »): 14-day trial, the three packs (Commis 59 € · Second 109 € · Chef 169 € HT/mois; internal keys essentiel / pro / complet), online
   payment (Stripe, functions/src/stripe.js), gentle gating once the trial is over, and the Growth Gusto admin space (GG_ADMINS: every restaurant, every account).
   State on the restaurant doc (restos/{rid}):
     plan: "essai" | "essentiel" | "pro" | "complet" | "suspendu"   pack: "essentiel" | "pro" | "complet" (the pack chosen on the site, Complet by default)
     trialEnds (ms) · paidAt, paidUntil (ms | null = unlimited), activatedBy, activationCode · grantedBy, grantedAt · suspended { at, by, plan, pack }
   abPlan(resto?) → { plan: "essai" | "essentiel" | "pro" | "complet" | "expire" | "suspendu" | "demo", pack, feat (the pack whose areas are
   open), open (writes allowed), days, ends, until, why }. Hooks for other areas: abBlocked(col), abRefuse(col) (called by DB in core.js),
   abTile() / abRow() (menu Plus and Réglages, js/compte.js). Config: GG_CONTACT (js/config.js); online payment is switched on from the admin space (ggPublic/billing). */
"use strict";

const AB_DAY = 864e5, AB_TRIAL = 14;
const AB_PACKS = {
  essentiel: { t: "Commis", price: 59, tag: "L'hygiène carrée, sans y penser", feats: ["Relevés et sondes", "Étiquettes & DLC", "Réception des livraisons", "Plan de nettoyage", "Fiches recettes & allergènes", "Mode contrôle & PMS", "Registre & rappel de lot", "Équipe illimitée"] },
  pro: { t: "Second", price: 109, tag: "La salle et la caisse en plus", feats: ["Tout Commis", "Réservations", "Plan de salle", "Caisse connectée & tickets Z", "Stock & inventaire", "Tableau de bord"] },
  complet: { t: "Chef", price: 169, tag: "Toute la maison tourne", feats: ["Tout Second", "Pointeuse", "Planning", "Employés & salaires", "Finances & banque", "Pennylane", "Plusieurs restaurants"] },
};
const AB_ORDER = ["essentiel", "pro", "complet"], AB_LVL = { essentiel: 1, pro: 2, complet: 3 };
const abPk = (x) => AB_LVL[x] ? x : "complet";
/* areas that need a higher pack: with a paid Commis or Second they show an upgrade card instead (during the trial everything is open) */
const AB_GATE = {
  resa: ["pro", "Réservations"], plan: ["pro", "Plan de salle"], stock: ["pro", "Stock & inventaire"], tickets: ["pro", "Tickets de caisse"], tzEdit: ["pro", "Tickets de caisse"], dashboard: ["pro", "Tableau de bord"], caisse: ["pro", "Caisse connectée"], caisseMap: ["pro", "Caisse connectée"],
  finance: ["complet", "Finances"], pennylane: ["complet", "Pennylane"], pointeuse: ["complet", "Pointeuse"], planning: ["complet", "Planning"], staff: ["complet", "Employés & salaires"], sites: ["complet", "Multi-restaurant"],
};
const abHas = (route, p = abPlan()) => !AB_GATE[route] || AB_LVL[p.feat] >= AB_LVL[AB_GATE[route][0]];
const AB_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const abDate = (ts) => { const d = new Date(ts); return `${d.getDate()} ${AB_MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`; };
const abJours = (n) => `${n} jour${n > 1 ? "s" : ""}`;
const abGerant = () => myRole() === "gerant";
const abAdmin = () => typeof avisIsAdmin === "function" && avisIsAdmin();
const abEmail = () => { try { const u = typeof authUser === "function" && authUser(); if (u && u.email) return u.email; } catch (e) {} return S.me.email || ""; };
TAB_OF.abonnement = "more"; TAB_OF.admin = "more";
Object.assign(IC, {
  abPack: ["M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z", "m9 12 2 2 4-4"],
  abGift: ["r:3,8,18,4,1", "M12 8v13", "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7", "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"],
  abKey: ["c:7.5,15.5,5.5", "m21 2-9.6 9.6", "m15.5 7.5 3 3L22 7l-3-3"],
  abPause: ["r:3,3,18,18,4", "M10 9v6", "M14 9v6"],
  abPlay: ["r:3,3,18,18,4", "m10 8.5 5 3.5-5 3.5z"],
  abMail: ["r:2,4,20,16,3", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  abSearch: ["c:11,11,7", "m21 21-4.3-4.3"],
  abRefresh: ["M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 21v-5h5"],
  abUsers: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "c:9,7,4", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
});
const AB = { stamped: {}, admin: null, q: "", tab: "restos" };

/* ───────────────────────── state machine ───────────────────────── */
function abPlan(r = S.resto) {
  const now = Date.now();
  if (!r) return { plan: "essai", pack: "complet", feat: "complet", open: true, days: AB_TRIAL, ends: now + AB_TRIAL * AB_DAY, pct: 1 };
  if (DB.mode === "demo") return { plan: "demo", pack: "complet", feat: "complet", open: true, days: null };
  const pack = abPk(r.pack);
  if (r.plan === "suspendu") return { plan: "suspendu", pack, feat: "complet", open: false, days: 0 };
  if (AB_LVL[r.plan]) {
    const until = +r.paidUntil || 0;
    if (until && until < now) return { plan: "expire", why: "paid", pack: r.plan, feat: "complet", open: false, days: 0, ends: until };
    return { plan: r.plan, pack: r.plan, feat: r.plan, open: true, until: until || null, days: until ? Math.max(0, Math.ceil((until - now) / AB_DAY)) : null, since: r.paidAt || r.grantedAt || null };
  }
  const ends = +r.trialEnds || abStamp(r);
  if (ends <= now) return { plan: "expire", why: "trial", pack, feat: "complet", open: false, days: 0, ends };
  const days = Math.max(1, Math.ceil((ends - now) / AB_DAY));
  return { plan: "essai", pack, feat: "complet", open: true, days, ends, pct: Math.max(0, Math.min(1, (ends - now) / (AB_TRIAL * AB_DAY))) };
}
/* a restaurant created before the trial existed: its 14 days start now (the gérant's device writes the date once) */
function abStamp(r) {
  const ends = Date.now() + AB_TRIAL * AB_DAY;
  if (r === S.resto && r.id && S.rid === r.id && DB.mode !== "demo" && !AB.stamped[r.id] && abGerant()) {
    AB.stamped[r.id] = true; const patch = { plan: "essai", pack: abPk(r.pack), trialEnds: ends };
    Object.assign(r, patch); DB.update("restos", r.id, patch).catch((e) => console.warn("trial stamp", e && e.code));
  }
  return ends;
}
const abState = () => abPlan();
function abLabel(p = abPlan()) {
  if (p.plan === "essai") return `Essai gratuit · ${abJours(p.days)} restant${p.days > 1 ? "s" : ""}`;
  if (p.plan === "expire") return p.why === "paid" ? "Abonnement échu · à renouveler" : "Essai terminé · choisir un pack";
  if (p.plan === "suspendu") return "Accès suspendu";
  if (p.plan === "demo") return "Démo · tout est ouvert";
  return `Pack ${AB_PACKS[p.plan].t} · actif${p.until ? ` jusqu'au ${abDate(p.until)}` : ""}`;
}
/* menu Plus tile and Réglages row (js/compte.js) */
function abTile() { const p = abPlan(); const b = p.plan === "essai" ? `${p.days} j` : p.plan === "expire" || p.plan === "suspendu" ? "!" : 0; return ["abonnement", "abPack", "Abonnement", b, p.plan === "essai" && p.days > 3 ? "acc" : ""]; }
function abRow() { const p = abPlan(); const pill = p.plan === "essai" ? `<span class="pill ${p.days <= 3 ? "warn" : "acc"}">${p.days} j</span>` : p.plan === "expire" || p.plan === "suspendu" ? `<span class="pill bad">À activer</span>` : p.plan === "demo" ? ico("chev") : `<span class="pill ok">${AB_PACKS[p.plan].t}</span>`; return `<div class="li tap" data-go="abonnement"><span class="ic">${ico("abPack")}</span><div class="tx"><b>Abonnement</b><em>${esc(abLabel(p))}</em></div>${pill}</div>`; }

/* ───────────────────────── gating ───────────────────────── */
/* writes that must always pass: the restaurant itself (plan, name…), the team, the audit trail */
const AB_FREE = new Set(["restos", "members", "events"]);
function abBlocked(col) { return !!S.resto && !AB_FREE.has(col) && !abPlan().open; }
function abRefuse(col) {
  abBlockSheet();
  const e = Object.assign(new Error("abonnement : écriture refusée (" + col + ")"), { code: "ab/blocked" });
  const p = Promise.reject(e); p.catch(() => {}); return p;
}
window.addEventListener("unhandledrejection", (ev) => { if (ev.reason && ev.reason.code === "ab/blocked") ev.preventDefault(); });
function abBlockSheet() {
  if ($("#sheet.open .ab-block")) return;
  const p = abPlan(); const g = abGerant();
  const T = p.plan === "suspendu" ? ["Accès suspendu", "L'accès à ce restaurant a été suspendu par Growth Gusto. Vos données sont conservées et restent consultables : contactez-nous pour le rétablir."]
    : p.why === "paid" ? ["Votre abonnement est arrivé à échéance", "Vos données sont conservées et restent consultables. Renouvelez votre pack pour continuer à enregistrer."]
    : ["Votre essai est terminé", `Merci d'avoir essayé Growth Gusto. Vos données sont conservées et restent consultables. Pour continuer à enregistrer, choisissez un pack : ${AB_PACKS.essentiel.price} €, ${AB_PACKS.pro.price} € ou ${AB_PACKS.complet.price} € HT par mois, sans engagement.`];
  SFX.err(); buzz([14, 30, 14]);
  openSheet(`<div class="ab-block"><span class="ab-blockic ${p.plan === "suspendu" ? "bad" : ""}">${ico(p.plan === "suspendu" ? "abPause" : "lock")}</span><div class="h2">${T[0]}</div><p class="sub">${T[1]}</p>
    ${S.route === "abonnement" ? "" : `<button class="btn acc block" data-act="abGoAbo">${ico("abPack")}${g ? (p.plan === "suspendu" ? "Voir mon abonnement" : "Choisir mon pack") : "Voir l'abonnement"}</button>`}
    ${g ? "" : `<p class="note" style="text-align:center">Seul le gérant peut activer l'abonnement.</p>`}
    <button class="btn ghost block" data-act="sheetClose">Continuer en lecture</button></div>`);
}
/* Home: a thin strip when the trial is about to end (≤ 3 days) or over */
function abStrip() {
  const p = abPlan(); if (!S.resto || p.open && !(p.plan === "essai" && p.days <= 3)) return "";
  const tx = p.plan === "essai" ? `Essai : <b>${abJours(p.days)} restant${p.days > 1 ? "s" : ""}</b>` : p.plan === "suspendu" ? `<b>Accès suspendu</b>` : p.why === "paid" ? `<b>Abonnement échu</b>` : `<b>Essai terminé</b> · lecture seule`;
  const cta = abGerant() ? (p.plan === "suspendu" ? "Nous contacter" : "Choisir mon pack") : "Voir";
  return `<div class="ab-strip ${p.open ? "warn" : "bad"} st" style="--i:0" data-go="abonnement" role="button" tabindex="0">${ico(p.open ? "clock" : "lock")}<span>${tx}</span><em>${cta}${ico("chev")}</em></div>`;
}
function abUpgrade(route) {
  const [k, t] = AB_GATE[route] || ["complet", "Cette fonction"]; const g = abGerant(), P = AB_PACKS[k];
  const list = AB_ORDER.slice(Math.min(AB_LVL[abPlan().feat] || 1, AB_LVL[k] - 1), AB_LVL[k]).flatMap((x) => AB_PACKS[x].feats.slice(1));
  return `<div class="inner narrow">${topBar(t)}
    <div class="glass ab-up st" style="--i:1"><span class="ab-upic">${ico("abPack")}</span><div class="lbl">Pack ${P.t}</div><h2 class="h2">${esc(t)} fait partie du pack ${P.t}</h2>
      <p class="sub">${P.tag} : ${P.price} € HT par mois, sans engagement.</p>
      <ul class="ab-feats">${list.map((f) => `<li>${ico("check")}${f}</li>`).join("")}</ul>
      ${g ? `<button class="btn acc block" data-go="abonnement">${ico("abPack")}Passer à ${P.t}</button>` : `<p class="note" style="text-align:center">Votre restaurant est au pack ${AB_PACKS[abPlan().feat].t}. Demandez au gérant de passer à ${P.t}.</p>`}</div></div>`;
}
/* wrap the areas once every js/<area>.js has loaded (abo.js comes right after compte.js) */
function abWrap() {
  Object.keys(AB_GATE).forEach((r) => {
    const V = VIEWS[r]; if (!V || V._ab) return; V._ab = true;
    const r0 = V.render, a0 = V.after;
    V.render = function (p) { return abHas(r) ? r0.call(this, p) : abUpgrade(r); };
    if (a0) V.after = function (v) { if (abHas(r)) return a0.call(this, v); };
  });
  const H = VIEWS.home; if (H && !H._ab) { H._ab = true; const h0 = H.render; H.render = function (p) { const html = h0.call(this, p); const b = abStrip(); return b && html.includes("</header>") ? html.replace("</header>", "</header>" + b) : html; }; }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", abWrap); else abWrap();
/* ?admin=1 (or /admin): once the app is on screen, open the admin space */
window.addEventListener("gg:ready", () => { let f = null; try { f = sessionStorage.getItem("gg-admin"); sessionStorage.removeItem("gg-admin"); } catch (e) {} if (f === "1") setTimeout(() => go("admin", {}, { replace: !S.resto }), 60); });

/* ───────────────────────── Abonnement ───────────────────────── */
VIEWS.abonnement = {
  render() {
    const p = abPlan(), g = abGerant(), online = abOnline(), sx = (S.resto && S.resto.stripe) || {}; abBillLoad();
    const C = +(2 * Math.PI * 42).toFixed(2);
    const ring = p.plan === "essai" ? `<div class="ring ab-ring"><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="42" fill="none" stroke-width="8"/><circle class="br" cx="50" cy="50" r="42" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - p.pct)).toFixed(2)}"/></svg><div class="num"><span><b class="mono">${p.days}</b><small>${p.days > 1 ? "jours" : "jour"}</small></span></div></div>`
      : `<div class="ab-seal ${p.open ? "ok" : "off"}">${ico(p.plan === "suspendu" ? "abPause" : p.open ? "check" : "lock")}</div>`;
    const H = p.plan === "essai" ? ["Essai gratuit · tout le pack Chef est ouvert", `${abJours(p.days)} restant${p.days > 1 ? "s" : ""}`, p.days <= 3 ? `Jusqu'au ${abDate(p.ends)}. Ensuite, vos données restent lisibles mais plus rien ne s'enregistre : choisissez votre pack dès maintenant.` : `Jusqu'au ${abDate(p.ends)}. Choisissez votre pack quand vous voulez : rien ne s'arrête d'ici là.`]
      : p.plan === "expire" ? (p.why === "paid" ? ["Abonnement arrivé à échéance", "Renouvelez votre pack", `Votre pack ${AB_PACKS[p.pack].t} s'est terminé le ${abDate(p.ends)}. Vos données sont conservées : dès le renouvellement, tout repart.`] : ["Essai terminé", "Choisissez votre pack", "Vos données sont conservées et restent consultables. Dès l'activation, tout repart exactement là où vous en étiez."])
      : p.plan === "suspendu" ? ["Accès suspendu", "Contactez-nous", "L'accès à ce restaurant a été suspendu par Growth Gusto. Vos données sont conservées et restent consultables."]
      : p.plan === "demo" ? ["Démo", "Tout est ouvert", "Créez votre compte pour démarrer votre essai gratuit de 14 jours, sans carte bancaire."]
      : ["Abonnement actif", `Pack ${AB_PACKS[p.plan].t}`, `${p.until ? `Jusqu'au ${abDate(p.until)}${p.days != null && p.days <= 7 ? ` · ${abJours(p.days)}` : ""}.` : "Mensuel, sans engagement : résiliable à tout moment."}${p.since ? ` Activé le ${abDate(p.since)}.` : ""} Utilisateurs illimités.`];
    const hero = `<section class="ab-hero ${p.plan} st" style="--i:1">${ring}<div class="ab-ht"><span class="ab-eyebrow">${H[0]}</span><h2>${H[1]}</h2><p>${H[2]}</p></div></section>`;
    const paid = !!AB_LVL[p.plan];
    const card = (k, i) => {
      const P = AB_PACKS[k], cur = paid ? p.plan === k : abLive(sx) && sx.pack === k, best = k === "complet";
      const cta = !g ? "" : cur ? `<button class="btn soft block" disabled>${ico("check")}Pack actuel</button>`
        : paid && !online && AB_LVL[k] < AB_LVL[p.plan] ? `<button class="btn soft block" data-act="abContact" data-v="${k}">${ico("abMail")}Nous écrire</button>`
        : `<button class="btn ${best ? "acc" : "soft"} block" data-act="abChoose" data-v="${k}" ${AB.busy === k ? "disabled" : ""}>${AB.busy === k ? `<span class="spin"></span>Ouverture du paiement…` : `${paid || abLive(sx) ? "Passer à " : "Choisir "}${P.t}`}</button>`;
      return `<article class="glass ab-pack ${k} ${cur ? "cur" : ""} st" style="--i:${i}">
        <div class="ab-ph"><div><span class="lbl">Pack</span><h3 class="ab-pn">${P.t}</h3></div>${cur ? `<span class="pill ok">Votre pack</span>` : best ? `<span class="pill acc">Recommandé</span>` : ""}</div>
        <div class="ab-price"><b class="mono">${P.price} €</b><span>HT / mois</span></div>
        <p class="ab-ptag">${P.tag}</p>
        <ul class="ab-feats">${P.feats.map((f, j) => `<li class="${j === 0 && k !== "essentiel" ? "all" : ""}">${ico("check")}${f}</li>`).join("")}</ul>${cta}</article>`;
    };
    const packs = `<div class="ab-packs">${AB_ORDER.map((k, i) => card(k, 2 + i)).join("")}</div>
      <div class="ab-common st" style="--i:5">${["Mensuel, sans engagement", "Essai gratuit 14 jours", "Utilisateurs illimités", "Données hébergées en France"].map((t) => `<span>${ico("check")}${t}</span>`).join("")}</div>`;
    const act = p.plan === "demo" ? "" : !g ? `<p class="note st ab-ro" style="--i:5">${ico("lock")}Seul le gérant peut choisir le pack et gérer le paiement.</p>`
      : online ? abBillCard(p, sx)
      : paid ? "" : `<div class="glass pad ab-act st" style="--i:5"><div class="ab-acth"><span class="ic">${ico("abMail")}</span><div><b>Activer mon abonnement</b><em>Le paiement en ligne arrive. En attendant, écrivez-nous : votre pack est activé dans la journée.</em></div></div>
        <a class="btn soft block ab-mailto" href="${abMailto(p.pack)}">${ico("abMail")}Nous écrire</a><p class="note ab-addr">${esc(window.GG_CONTACT || "")} · réponse dans la journée, du lundi au samedi</p></div>`;
    const adm = abAdmin() ? `<div class="glass pad st ab-admrow" style="--i:6"><div class="li tap" data-go="admin"><span class="ic">${ico("shield")}</span><div class="tx"><b>Espace admin Growth Gusto</b><em>Tous les restaurants, offrir ou suspendre l'accès</em></div>${ico("chev")}</div></div>` : "";
    return `<div class="inner cc-wide ab-wrap">${topBar("Abonnement")}${hero}${packs}${act}${adm}</div>`;
  },
  after() { if (AB.flash) { AB.flash = false; const h = $(".ab-hero"); h && h.classList.add("pop"); } },
};
function abMailto(pack) {
  const r = S.resto || {}; const P = AB_PACKS[abPk(pack)]; const subj = `Abonnement Growth Gusto · Pack ${P.t} · ${r.name || ""}`;
  const body = `Bonjour,\n\nJe souhaite activer le pack ${P.t} pour ${r.name || "mon restaurant"}.\nIdentifiant du restaurant : ${S.rid || ""}\nE-mail du compte : ${abEmail() || "(sans compte)"}\n\nMerci !`;
  return `mailto:${window.GG_CONTACT || ""}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}
/* ───────────────────────── paiement en ligne (Stripe, functions/src/stripe.js) ─────────────────────────
   ggPublic/billing { stripe } says whether it is on. The restaurant doc carries stripe { customer, sub, status, pack, periodEnd, cancelAt,
   trialEnd, lastInvoice, failedAt }, written by the server only (firestore.rules billKeys). */
const abLive = (sx) => !!(sx && sx.sub && ["active", "trialing", "past_due"].includes(sx.status));
const abOnline = () => DB.mode === "db" && !!(AB.bill && AB.bill.stripe);
function abBillLoad(force) {
  if (DB.mode !== "db" || !DB.db || (AB.billAt && !force && Date.now() - AB.billAt < 300000)) return;
  AB.billAt = Date.now();
  DB.db.doc("ggPublic/billing").get().then((d) => { const b = d.exists ? d.data() : {}; const ch = !AB.bill || !!AB.bill.stripe !== !!b.stripe; AB.bill = b; if (ch && (S.route === "abonnement" || S.route === "admin")) rerender(); }).catch(() => { AB.billAt = 0; });
}
async function abCall(op, data) {
  if (typeof AUTH === "undefined" || !AUTH.call) throw new Error("offline");
  return AUTH.call("stripeApi", { op, rid: S.rid, ...(data || {}) });
}
function abBillCard(p, sx) {
  const L = [];
  if (sx.failedAt && sx.status === "past_due") L.push(`<div class="ab-bl bad">${ico("alert")}<span><b>Le dernier paiement n'est pas passé.</b> Stripe réessaie automatiquement. Mettez à jour votre carte pour éviter l'interruption.</span></div>`);
  if (sx.status === "trialing" && sx.trialEnd) L.push(`<div class="ab-bl">${ico("abPack")}<span>Pack <b>${AB_PACKS[abPk(sx.pack)].t}</b> choisi, carte enregistrée. <b>Premier prélèvement le ${abDate(sx.trialEnd)}</b>, rien avant.</span></div>`);
  else if (abLive(sx) && sx.cancelAt) L.push(`<div class="ab-bl warn">${ico("clock")}<span>Résiliation demandée : le pack reste actif <b>jusqu'au ${abDate(sx.cancelAt)}</b>. Vous pouvez la retirer depuis « Gérer mon abonnement ».</span></div>`);
  else if (abLive(sx) && sx.periodEnd) L.push(`<div class="ab-bl">${ico("clock")}<span>Prochain prélèvement le <b>${abDate(sx.periodEnd)}</b> : ${AB_PACKS[abPk(sx.pack)].price} €, ${AB.bill && AB.bill.tva ? `soit ${(AB_PACKS[abPk(sx.pack)].price * 1.2).toFixed(2).replace(".", ",")} € TTC` : "TVA non applicable"}.</span></div>`);
  if (sx.lastInvoice && sx.lastInvoice.url) L.push(`<a class="ab-bl tap" href="${esc(sx.lastInvoice.url)}" target="_blank" rel="noopener">${ico("receipt")}<span>Dernière facture${sx.lastInvoice.number ? ` <b>${esc(sx.lastInvoice.number)}</b>` : ""} · ${String(sx.lastInvoice.ttc.toFixed(2)).replace(".", ",")} € TTC</span>${ico("chev")}</a>`);
  const head = sx.customer ? ["Paiement et factures", "Carte bancaire ou prélèvement, factures téléchargeables, résiliation en un geste."] : ["Paiement sécurisé par Stripe", p.plan === "essai" ? "Choisissez votre pack : la carte est enregistrée maintenant, le premier prélèvement a lieu à la fin de l'essai." : "Choisissez votre pack ci-dessus : paiement par carte, facture envoyée chaque mois, sans engagement."];
  return `<div class="glass pad ab-act st" style="--i:5"><div class="ab-acth"><span class="ic">${ico("abKey")}</span><div><b>${head[0]}</b><em>${head[1]}</em></div></div>
    ${L.join("")}
    ${sx.customer ? `<button class="btn soft block" data-act="abPortal" ${AB.busy === "portal" ? "disabled" : ""}>${AB.busy === "portal" ? `<span class="spin"></span>Ouverture…` : `${ico("abPack")}Gérer mon abonnement`}</button>` : ""}
    <p class="note ab-addr">Paiement traité par Stripe : Growth Gusto ne voit jamais votre numéro de carte.</p></div>`;
}
const AB_ERR = { stripe_off: "Le paiement en ligne n'est pas encore ouvert. Écrivez-nous : on active votre pack dans la journée.", suspendu: "L'accès à ce restaurant est suspendu : contactez-nous.", "permission-denied": "Seul le gérant peut gérer l'abonnement.", no_customer: "Aucun paiement enregistré pour ce restaurant." };
const abErrTx = (e) => { const m = String((e && e.message) || ""); return AB_ERR[m] || AB_ERR[String((e && e.code) || "").replace(/^functions\//, "")] || "Impossible de joindre le paiement pour l'instant. Vérifiez la connexion et réessayez."; };
async function abCheckout(k) {
  AB.busy = k; refresh();
  try {
    const r = await abCall("checkout", { pack: k });
    if (r.url) { location.href = r.url; return; }
    if (r.changed) { closeSheet(true); SFX.done(); buzz([12, 40, 12, 40, 30]); burst(); toast(`Pack ${AB_PACKS[k].t} activé !`); AB.flash = true; }
  } catch (e) { SFX.err(); toast(abErrTx(e)); }
  AB.busy = null; refresh();
}
/* back from Stripe: ?abo=ok&session=… | ?abo=annule | ?abo=retour */
(function abCatchReturn() {
  try {
    const u = new URL(location.href); const a = u.searchParams.get("abo"); if (!a) return;
    sessionStorage.setItem("gg-abo-ret", JSON.stringify({ a, session: u.searchParams.get("session") || "" }));
    ["abo", "session"].forEach((k) => u.searchParams.delete(k)); history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (e) {}
})();
window.addEventListener("gg:ready", () => setTimeout(async () => {
  let ret = null; try { ret = JSON.parse(sessionStorage.getItem("gg-abo-ret") || "null"); sessionStorage.removeItem("gg-abo-ret"); } catch (e) {}
  if (!ret || !S.rid) return;
  if (ret.a === "annule") { go("abonnement"); toast("Paiement annulé : rien n'a été prélevé."); return; }
  if (ret.a === "retour") { go("abonnement"); return; }
  if (ret.a === "ok") {
    go("abonnement"); toast("Paiement validé, activation…");
    try { const r = await abCall("confirm", { session: ret.session }); if (r.ok) { SFX.done(); buzz([12, 40, 12, 40, 30]); burst(); AB.flash = true; toast(r.status === "trialing" ? `Pack ${AB_PACKS[abPk(r.pack)].t} choisi : premier prélèvement à la fin de l'essai.` : `Pack ${AB_PACKS[abPk(r.pack)].t} activé, merci !`); } }
    catch (e) { toast("Paiement reçu : l'activation arrive dans une minute."); }
    refresh();
  }
}, 700));

Object.assign(ACT, {
  abGoAbo: () => { closeSheet(true); go("abonnement"); },
  abChoose: (a, id, v) => {
    const k = abPk(v); SFX.tap(); buzz(6); if (AB.busy) return;
    if (abOnline()) {
      const sx = (S.resto && S.resto.stripe) || {}; const p = abPlan();
      if (abLive(sx) && sx.status !== "trialing") { /* already paying: confirm the change first, it is billed today (prorated) */
        const up = AB_LVL[k] > AB_LVL[abPk(sx.pack)];
        openSheet(`<div class="ab-block"><span class="ab-blockic">${ico("abPack")}</span><div class="lbl">Pack ${AB_PACKS[k].t} · ${AB_PACKS[k].price} € HT/mois</div><div class="h2">Passer au pack ${AB_PACKS[k].t} ?</div>
          <p class="sub">${up ? "Le changement est immédiat. La différence, au prorata des jours restants, est prélevée aujourd'hui sur votre carte." : "Le changement est immédiat. Les jours déjà payés du pack actuel sont déduits de la prochaine facture."}</p>
          <button class="btn acc block" data-act="abChange" data-v="${k}">${ico("check")}Oui, passer à ${AB_PACKS[k].t}</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
        return;
      }
      void p; abCheckout(k); return;
    }
    openSheet(`<div class="ab-block"><span class="ab-blockic">${ico("abPack")}</span><div class="lbl">Pack ${AB_PACKS[k].t} · ${AB_PACKS[k].price} € HT/mois</div><div class="h2">Paiement en ligne bientôt disponible</div><p class="sub">Pour activer votre abonnement, écrivez-nous : nous vous envoyons un code d'activation dans la journée. Sans engagement, résiliable à tout moment.</p>
      <a class="btn acc block" href="${abMailto(k)}">${ico("abMail")}Nous écrire</a></div>`);
  },
  abContact: (a, id, v) => { SFX.tap(); location.href = abMailto(v); },
  abChange: (a, id, v) => { SFX.tap(); abCheckout(abPk(v)); },
  abPortal: async () => {
    SFX.tap(); if (AB.busy) return; AB.busy = "portal"; refresh();
    try { const r = await abCall("portal"); if (r.url) { location.href = r.url; return; } } catch (e) { SFX.err(); toast(abErrTx(e)); }
    AB.busy = null; refresh();
  },
});

/* ───────────────────────── Admin Growth Gusto ───────────────────────── */
async function abAdminFetch(force) {
  const A = (AB.admin ||= { restos: null, users: null, err: null, at: 0, loading: false });
  if (A.loading || (!force && A.at && Date.now() - A.at < 90000)) return;
  A.loading = true; A.err = null; if (S.route === "admin") refresh();
  try {
    if (DB.mode === "db" && DB.db) {
      const fs = DB.db;
      const [rs, us] = await Promise.all([fs.collection("restos").limit(1000).get(), fs.collection("users").limit(3000).get()]);
      const users = {}; us.docs.forEach((d) => { users[d.id] = { id: d.id, ...d.data() }; });
      const restos = rs.docs.map((d) => ({ id: d.id, ...d.data() }));
      await Promise.all(restos.map(async (r) => { try { const m = await fs.collection(`restos/${r.id}/members`).get(); r.nMembers = m.size; } catch (e) { r.nMembers = null; } }));
      restos.forEach((r) => { const o = users[r.owner]; r.ownerEmail = (o && o.email) || ""; r.ownerName = (o && o.name) || ""; });
      A.restos = restos; A.users = Object.values(users);
    } else {
      /* this device only / demo: what this phone knows */
      A.restos = S.restos.map((r) => ({ ...r, nMembers: r.id === S.rid ? S.members.length : null, ownerEmail: S.me.email || "", ownerName: S.me.name || "" }));
      A.users = [{ id: S.me.id, name: S.me.name, email: S.me.email || "", restos: S.restos.map((r) => r.id) }];
    }
  } catch (e) { console.warn("admin", e); A.err = (e && e.code) || "erreur"; }
  A.loading = false; A.at = Date.now(); if (S.route === "admin") refresh();
}
function abAdminPatch(id, patch) {
  const A = AB.admin; const r = A && A.restos && A.restos.find((x) => x.id === id); if (r) Object.assign(r, patch);
  if (S.resto && S.resto.id === id) Object.assign(S.resto, patch); const l = S.restos.find((x) => x.id === id); if (l) Object.assign(l, patch);
  if (DB.mode === "db" && DB.db) return DB.db.collection("restos").doc(id).update(DB.clean(patch));
  return DB.update("restos", id, patch);
}
const abPlanPill = (p) => p.plan === "essai" ? `<span class="pill ${p.days <= 3 ? "warn" : "acc"}">Essai · ${p.days} j</span>` : p.plan === "expire" ? `<span class="pill bad">${p.why === "paid" ? "Échu" : "Essai terminé"}</span>` : p.plan === "suspendu" ? `<span class="pill bad">Suspendu</span>` : p.plan === "demo" ? `<span class="pill neu">Démo</span>` : `<span class="pill ok">${AB_PACKS[p.plan].t}${p.until ? ` · ${p.days} j` : ""}</span>`;
const abMono = (r, size = 44) => r.logo ? `<img class="ab-logo" src="${esc(r.logo)}" alt="" style="--s:${size}px">` : `<span class="ab-mono" style="--s:${size}px">${esc(initials(r.name || "R"))}</span>`;
function abAdminList() {
  const A = AB.admin || {}; const q = AB.q.trim().toLowerCase();
  const L = (A.restos || []).filter((r) => !q || [r.name, r.ownerEmail, r.ownerName, r.id, r.type].some((x) => String(x || "").toLowerCase().includes(q))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (A.loading && !A.restos) return `<div class="glass empty"><div class="ic">${ico("clock")}</div><b>Chargement…</b>Tous les restaurants arrivent.</div>`;
  if (A.err) return `<div class="glass empty"><div class="ic bad">${ico("alert")}</div><b>Lecture refusée</b>${esc(A.err)} · les règles Firestore doivent autoriser l'admin (firestore.rules).</div>`;
  if (!L.length) return `<div class="glass empty"><div class="ic">${ico("store")}</div><b>${q ? "Aucun restaurant ne correspond" : "Aucun restaurant"}</b>${q ? "Essayez un autre mot." : "Les restaurants créés dans l'app apparaîtront ici."}</div>`;
  return L.slice(0, 300).map((r, i) => { const p = abPlan(r); return `<button class="glass ab-cl st" style="--i:${Math.min(3 + i, 12)}" data-act="abAdmOpen" data-id="${esc(r.id)}">${abMono(r)}
    <span class="ab-clb"><span class="ab-clh"><b>${esc(r.name || "Sans nom")}</b>${abPlanPill(p)}</span>
      <span class="ab-clm">${esc(r.ownerEmail || r.ownerName || r.owner || "—")}${r.ownerName && r.ownerEmail ? ` · ${esc(firstName(r.ownerName))}` : ""}</span>
      <span class="ab-clm dim">${r.createdAt ? `Créé le ${abDate(r.createdAt)}` : "Date inconnue"} · ${r.nMembers == null ? "équipe ?" : `${r.nMembers} membre${r.nMembers > 1 ? "s" : ""}`} ${p.plan === "essai" || p.plan === "expire" ? `· pack ${AB_PACKS[abPk(r.pack)].t} ` : ""}${r.id === S.rid ? "· ouvert ici" : ""}</span></span>${ico("chev")}</button>`; }).join("");
}
function abAdminUsers() {
  const A = AB.admin || {}; const q = AB.q.trim().toLowerCase();
  const L = (A.users || []).filter((u) => !q || [u.name, u.email, u.id].some((x) => String(x || "").toLowerCase().includes(q))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (A.loading && !A.users) return `<div class="glass empty"><div class="ic">${ico("clock")}</div><b>Chargement…</b></div>`;
  if (!L.length) return `<div class="glass empty"><div class="ic">${ico("abUsers")}</div><b>${q ? "Aucun compte ne correspond" : "Aucun compte"}</b></div>`;
  return `<div class="glass pad ab-ul">${L.slice(0, 500).map((u) => { const n = (u.restos || []).length; const me = u.id === S.me.id || u.id === DB.uid; return `<div class="li"><span class="ab-mono" style="--s:40px">${esc(initials(u.name || u.email || "?"))}</span><div class="tx"><b>${esc(u.name || firstName(String(u.email || "").split("@")[0]) || "Sans nom")}</b><em>${esc(u.email || u.id)}</em></div><span class="pill ${n ? "acc" : "neu"}">${n} resto${n > 1 ? "s" : ""}</span>${me ? "" : `<button class="iconbtn ab-udel" data-act="abUserDel" data-id="${esc(u.id)}" aria-label="Supprimer ${esc(u.email || u.name || "ce compte")}" title="Supprimer ce compte">${ico("trash")}</button>`}</div>`; }).join("")}</div>`;
}
VIEWS.admin = {
  noResto: true, nav: "more",
  render() {
    const signed = !!DB.uid;
    if (!abAdmin()) return `<div class="inner narrow">${topBar("Admin Growth Gusto")}<div class="glass empty ab-denied st" style="--i:1"><div class="ic">${ico("shield")}</div><b>Accès réservé à l'équipe Growth Gusto</b>${signed ? `Connecté avec <b class="ab-em">${esc(abEmail())}</b>, qui n'est pas un compte administrateur.` : "Connectez-vous avec un compte administrateur."}
      <div class="ab-denied-b">${signed ? `<button class="btn soft" data-act="abAdmSwitch">${ico("swap")}Changer de compte</button>` : `<button class="btn acc" data-act="abAdmLogin">${ico("users")}Se connecter</button>`}${S.resto ? `<button class="btn ghost" data-go="home">Retour à l'app</button>` : ""}</div></div></div>`;
    abAdminFetch();
    const A = AB.admin || {}; const R = A.restos || [];
    const n = { all: R.length, essai: 0, paye: 0, fin: 0 }; R.forEach((r) => { const p = abPlan(r); if (p.plan === "essai") n.essai++; else if (AB_LVL[p.plan]) n.paye++; else n.fin++; });
    const kpi = `<div class="ab-kpis st" style="--i:1"><div class="glass ab-kpi"><span class="lbl">Restaurants</span><b class="mono">${n.all}</b></div><div class="glass ab-kpi"><span class="lbl">En essai</span><b class="mono acc">${n.essai}</b></div><div class="glass ab-kpi"><span class="lbl">Abonnés</span><b class="mono ok">${n.paye}</b></div><div class="glass ab-kpi"><span class="lbl">Terminés</span><b class="mono ${n.fin ? "bad" : ""}">${n.fin}</b></div></div>`;
    const tabs = `<div class="seg ab-seg st" style="--i:2"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${AB.tab === "comptes" ? "100%" : "0"})"></span><button class="${AB.tab === "restos" ? "on" : ""}" data-act="abAdmTab" data-v="restos">Restaurants</button><button class="${AB.tab === "comptes" ? "on" : ""}" data-act="abAdmTab" data-v="comptes">Comptes${A.users ? ` · ${A.users.length}` : ""}</button></div>
      <label class="ab-search st" style="--i:2">${ico("abSearch")}<input class="input" id="abQ" type="search" placeholder="${AB.tab === "comptes" ? "Nom, e-mail…" : "Restaurant, e-mail du gérant…"}" value="${esc(AB.q)}" autocomplete="off"></label>`;
    return `<div class="inner cc-wide ab-wrap ab-adm">${topBar("Admin Growth Gusto", { right: `${typeof auMailPrev === "function" ? `<button class="iconbtn" data-act="auMailPrev" aria-label="Aperçu des e-mails" title="Aperçu des e-mails">${ico("abMail")}</button>` : ""}<button class="iconbtn" data-act="abAdmReload" aria-label="Actualiser" title="Actualiser">${ico("abRefresh")}</button>` })}
      <p class="sub st" style="--i:0;margin:-6px 0 0">${DB.mode === "db" ? "Tous les restaurants et comptes du projet." : "Cet appareil seulement (sans compte, l'admin ne voit que les restaurants de ce téléphone)."}${A.loading ? " Actualisation…" : ""}</p>
      ${kpi}${abStripeAdm()}${tabs}<div id="abList" class="ab-list">${AB.tab === "comptes" ? abAdminUsers() : abAdminList()}</div></div>`;
  },
};
/* Espace admin › Paiement en ligne: paste the Stripe secret key once; the server builds everything on the Stripe account */
const AB_STATUS = { trialing: "carte enregistrée, essai", active: "payé", past_due: "paiement en retard", canceled: "résilié", unpaid: "impayé", incomplete: "paiement inachevé", incomplete_expired: "paiement abandonné" };
function abStripeAdm() {
  if (DB.mode !== "db") return "";
  const X = (AB.sadm ||= { st: null, busy: false, err: "", edit: false });
  if (!X.st && !X.busy && !X.err) { X.busy = true; abCall("status").then((r) => { X.st = r; }).catch((e) => { X.err = abErrTx(e); }).finally(() => { X.busy = false; if (S.route === "admin") rerender(); }); }
  const st = X.st || {};
  const head = X.busy && !X.st ? "Lecture…" : st.on ? `Actif · ${st.live ? "paiements réels" : "mode test"} · ${st.tva ? "TVA 20 %" : "sans TVA"}${st.account ? ` · ${esc(st.account)}` : ""}` : "Pas encore branché : les gérants voient « Nous écrire »";
  const form = !st.on || X.edit ? `<form class="ab-actf" data-ab="sk" novalidate><input class="input mono" id="abSk" type="password" placeholder="sk_live_…" autocomplete="off" spellcheck="false" aria-label="Clé secrète Stripe"><button class="btn acc" type="submit" ${X.busy ? "disabled" : ""}>${X.busy ? `<span class="spin"></span>` : ""}Brancher</button></form>
      <label class="ab-tva"><input type="checkbox" id="abTva" ${st.tva ? "checked" : ""}> Facturer la TVA (20 %). Laissez décoché en micro-entreprise : les factures portent « TVA non applicable, art. 293 B du CGI ».</label>
      <p class="note">Stripe › Développeurs › Clés API › <b>Clé secrète</b> (Révéler, puis copier). Une clé de test (sk_test_) permet de tout essayer avec la carte 4242 4242 4242 4242. La clé est chiffrée côté serveur et n'est jamais renvoyée à l'appli.</p>` : "";
  return `<div class="glass pad ab-act ab-sadm st" style="--i:2"><div class="ab-acth"><span class="ic">${ico("abKey")}</span><div><b>Paiement en ligne (Stripe)</b><em>${head}</em></div>
      ${st.on && !X.edit ? `<button class="btn ghost sm" data-act="abSkEdit">Changer la clé</button>` : ""}</div>
    ${form}<em class="ab-acterr" id="abSkErr" role="alert">${esc(X.err || "")}</em>
    ${st.on ? `<p class="note">Les packs (« Growth Gusto · Pack … »), le portail client et un webhook dédié sont créés sur le compte Stripe, sans toucher à ce qui existe déjà. Prix : ${AB_ORDER.map((k) => `${AB_PACKS[k].t} ${AB_PACKS[k].price} €`).join(", ")} HT par mois.${X.edit ? "" : ` <a href="#" data-act="abSkOff">Couper le paiement en ligne</a>`}</p>` : ""}</div>`;
}
document.addEventListener("submit", async (e) => {
  const f = e.target; if (!f.dataset || f.dataset.ab !== "sk") return; e.preventDefault();
  const X = AB.sadm; const i = $("#abSk", f); const key = String((i && i.value) || "").trim();
  if (!/^(sk|rk)_(live|test)_/.test(key)) { SFX.err(); const er = $("#abSkErr"); if (er) er.textContent = "Collez la clé secrète : elle commence par sk_live_ ou sk_test_."; return; }
  X.busy = true; X.err = ""; rerender();
  try { const tv = $("#abTva"); const r = await abCall("setup", { key, tva: !!(tv && tv.checked) }); X.st = { on: true, live: r.live, account: r.account, tva: r.tva }; X.edit = false; AB.billAt = 0; abBillLoad(true); SFX.done(); burst(); toast(r.live ? "Stripe branché : les gérants peuvent payer en ligne." : "Stripe branché en mode test."); }
  catch (er) { SFX.err(); X.err = /badkey/.test(String(er && er.message)) ? "Clé refusée par Stripe : vérifiez-la." : abErrTx(er) + (er && er.message && /stripe:/.test(er.message) ? ` (${er.message})` : ""); }
  X.busy = false; rerender();
});
function abAdmSheet(id) {
  const A = AB.admin || {}; const r = (A.restos || []).find((x) => x.id === id) || S.restos.find((x) => x.id === id); if (!r) return;
  const st = (S.ui.abAdm ||= { pack: "complet", dur: 1 }); st.id = id; const p = abPlan(r);
  const dur = [[1, "1 mois"], [3, "3 mois"], [12, "1 an"], [0, "Illimité"]];
  let line = p.plan === "essai" ? `Essai jusqu'au ${abDate(p.ends)}` : p.plan === "expire" ? (p.why === "paid" ? `Pack ${AB_PACKS[p.pack].t} échu le ${abDate(p.ends)}` : `Essai terminé le ${abDate(p.ends)}`) : p.plan === "suspendu" ? `Suspendu${r.suspended && r.suspended.at ? ` le ${abDate(r.suspended.at)}` : ""}` : p.plan === "demo" ? "Démo" : `Pack ${AB_PACKS[p.plan].t}${p.until ? ` jusqu'au ${abDate(p.until)}` : " · illimité"}${r.grantedBy ? ` · offert par ${esc(r.grantedBy)}` : r.activationCode ? ` · code ${esc(r.activationCode)}` : ""}`;
  if (r.stripe && r.stripe.status) line += ` · Stripe : ${AB_STATUS[r.stripe.status] || r.stripe.status}`;
  openSheet(`<div class="ab-ash"><div class="ab-ashh">${abMono(r, 52)}<div style="flex:1;min-width:0"><div class="h2" style="font-size:20px">${esc(r.name || "Sans nom")}</div><div class="sub">${esc(r.ownerEmail || r.ownerName || r.owner || "")}${r.createdAt ? ` · créé le ${abDate(r.createdAt)}` : ""}</div></div>${abPlanPill(p)}</div>
    <p class="note ab-line">${line} · ${r.nMembers == null ? "équipe inconnue" : `${r.nMembers} membre${r.nMembers > 1 ? "s" : ""}`} · <span class="mono">${esc(r.id)}</span></p>
    ${p.plan === "suspendu" ? `<button class="btn acc block" data-act="abAdmRestore">${ico("abPlay")}Rétablir l'accès</button>` : `
    <div class="lbl">Offrir l'accès</div>
    <div class="seg ab-seg ab-seg3"><span class="knob" style="width:calc(33.333% - 2.67px);transform:translateX(${AB_ORDER.indexOf(st.pack) * 100}%)"></span>${AB_ORDER.map((k) => `<button class="${st.pack === k ? "on" : ""}" data-act="abAdmPack" data-v="${k}">${AB_PACKS[k].t}</button>`).join("")}</div>
    <div class="chips ab-dur">${dur.map(([m, t]) => `<button class="chip ${st.dur === m ? "on" : ""}" data-act="abAdmDur" data-v="${m}">${t}</button>`).join("")}</div>
    <button class="btn acc block" data-act="abAdmGrant">${ico("abGift")}Offrir ${AB_PACKS[st.pack].t} · ${dur.find(([m]) => m === st.dur)[1].toLowerCase()}</button>
    <div class="lbl">Essai</div>
    <div class="grid2"><button class="btn soft" data-act="abAdmTrial" data-v="14">${ico("clock")}+ 14 jours</button><button class="btn soft" data-act="abAdmTrial" data-v="30">${ico("clock")}+ 30 jours</button></div>
    <button class="btn danger block" data-act="abAdmSuspend">${ico("abPause")}Suspendre l'accès</button>`}
    <button class="btn ghost block" data-act="sheetClose">Fermer</button></div>`);
}
async function abAdmWrite(id, patch, msg) {
  try { await abAdminPatch(id, patch); } catch (e) { console.warn("admin write", e); SFX.err(); toast(e && e.code === "permission-denied" ? "Refusé par les règles Firestore : publiez firestore.rules." : "Impossible d'enregistrer.", "err"); return; }
  closeSheet(true); SFX.done(); buzz([10, 30, 10]); toast(msg); refresh(); renderChrome();
}
Object.assign(ACT, {
  abAdmOpen: (a, id) => { SFX.tap(); abAdmSheet(id); },
  abAdmTab: (a, id, v) => { if (AB.tab === v) return; AB.tab = v; AB.q = ""; SFX.tick(); rerender(); },
  abAdmReload: () => { SFX.tap(); abAdminFetch(true); if (AB.sadm) { AB.sadm.st = null; AB.sadm.err = ""; } },
  abSkEdit: () => { SFX.tap(); AB.sadm.edit = true; rerender(); setTimeout(() => { const i = $("#abSk"); i && i.focus(); }, 60); },
  abSkOff: async () => { SFX.tap(); if (!AB.sadm.confirmOff) { AB.sadm.confirmOff = true; toast("Touchez encore une fois pour couper le paiement en ligne."); setTimeout(() => { AB.sadm.confirmOff = false; }, 4000); return; }
    try { await abCall("off"); AB.sadm.st = { on: false }; AB.billAt = 0; abBillLoad(true); toast("Paiement en ligne coupé."); } catch (e) { toast(abErrTx(e)); } rerender(); },
  /* delete an account for good (functions/src/admin.js adminDeleteUser): its own restaurants, its memberships, its sign-in */
  abUserDel: (a, id) => {
    const A = AB.admin || {}; const u = (A.users || []).find((x) => x.id === id); if (!u) return;
    const own = (A.restos || []).filter((r) => r.owner === id); const who = esc(u.email || u.name || id);
    S.ui.abDel = { id, email: u.email || "" };
    openSheet(`<div class="ab-delsh"><span class="ab-delic">${ico("trash")}</span><div class="h2">Supprimer ce compte ?</div>
      <p class="sub"><b>${who}</b> ne pourra plus se connecter. ${own.length ? `Ses restaurants sont effacés avec toutes leurs données : <b>${own.map((r) => esc(r.name || r.id)).join(", ")}</b>.` : "Il n'a créé aucun restaurant."} Il est retiré des équipes dont il fait partie.</p>
      <p class="sub ab-delw">C'est définitif : rien ne peut être récupéré.</p>
      <button class="btn danger block" data-act="abUserDelGo">${ico("trash")}Supprimer définitivement</button><button class="btn ghost block" data-act="sheetClose">Annuler</button></div>`);
  },
  abUserDelGo: async (a) => {
    const st = S.ui.abDel; if (!st || st.busy) return; st.busy = true; a && a.setAttribute("disabled", ""); if (a) a.innerHTML = `${ico("clock")}Suppression…`;
    try {
      if (DB.mode !== "db" || typeof AUTH === "undefined" || !AUTH.call) throw { code: "demo" };
      const r = await AUTH.call("adminDeleteUser", { uid: st.id, email: st.email });
      const A = AB.admin || {}; A.users = (A.users || []).filter((x) => x.id !== st.id); A.restos = (A.restos || []).filter((x) => x.owner !== st.id);
      closeSheet(); SFX.ok(); toast(`Compte ${r.email || st.email || ""} supprimé${r.restos && r.restos.length ? ` avec ${r.restos.length} restaurant${r.restos.length > 1 ? "s" : ""}` : ""}`); refresh(); abAdminFetch(true);
    } catch (e) { const c = String((e && e.code) || "").replace(/^functions\//, ""); console.warn("adminDeleteUser", c || e); st.busy = false; a && a.removeAttribute("disabled"); if (a) a.innerHTML = `${ico("trash")}Supprimer définitivement`; SFX.err();
      toast(c === "demo" ? "Possible seulement avec un compte en ligne." : c === "permission-denied" ? "Réservé aux administrateurs Growth Gusto." : c === "not-found" ? "Ce compte n'existe plus." : c === "failed-precondition" ? "Vous ne pouvez pas supprimer votre propre compte ici." : "Suppression impossible : le serveur n'est peut-être pas encore à jour.", "err"); }
  },
  abAdmPack: (a, id, v) => { S.ui.abAdm.pack = v; SFX.tick(); abAdmSheet(S.ui.abAdm.id); },
  abAdmDur: (a, id, v) => { S.ui.abAdm.dur = +v; SFX.tick(); abAdmSheet(S.ui.abAdm.id); },
  abAdmGrant: () => {
    const st = S.ui.abAdm; const now = Date.now(); const until = st.dur ? (() => { const d = new Date(now); d.setMonth(d.getMonth() + st.dur); return d.getTime(); })() : null;
    abAdmWrite(st.id, { plan: st.pack, pack: st.pack, paidAt: now, paidUntil: until, grantedBy: abEmail(), grantedAt: now, suspended: null }, `Pack ${AB_PACKS[st.pack].t} offert${until ? ` jusqu'au ${abDate(until)}` : ""}`);
  },
  abAdmTrial: (a, id, v) => {
    const st = S.ui.abAdm; const A = AB.admin || {}; const r = (A.restos || []).find((x) => x.id === st.id) || S.restos.find((x) => x.id === st.id) || {};
    const base = Math.max(Date.now(), +r.trialEnds || 0); const ends = base + (+v) * AB_DAY;
    abAdmWrite(st.id, { plan: "essai", trialEnds: ends, suspended: null }, `Essai prolongé jusqu'au ${abDate(ends)}`);
  },
  abAdmSuspend: () => {
    const st = S.ui.abAdm; const A = AB.admin || {}; const r = (A.restos || []).find((x) => x.id === st.id) || S.restos.find((x) => x.id === st.id) || {};
    abAdmWrite(st.id, { plan: "suspendu", suspended: { at: Date.now(), by: abEmail(), plan: r.plan || "essai", pack: r.pack || "complet" } }, "Accès suspendu");
  },
  abAdmRestore: () => {
    const st = S.ui.abAdm; const A = AB.admin || {}; const r = (A.restos || []).find((x) => x.id === st.id) || S.restos.find((x) => x.id === st.id) || {};
    const prev = (r.suspended && r.suspended.plan) || "essai";
    abAdmWrite(st.id, { plan: prev === "suspendu" ? "essai" : prev, suspended: null }, "Accès rétabli");
  },
  abAdmSwitch: () => { SFX.tap(); if (typeof AUTH !== "undefined") AUTH.signOut(); },
  abAdmLogin: () => { SFX.tap(); if (typeof AUTH !== "undefined") AUTH.openWelcome({ screen: AUTH.cfg ? "email" : "welcome", tab: "in" }); },
});
document.addEventListener("input", (e) => { const t = e.target; if (!t || t.id !== "abQ") return; AB.q = t.value; const l = $("#abList"); if (l) l.innerHTML = AB.tab === "comptes" ? abAdminUsers() : abAdminList(); });
