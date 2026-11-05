/* Growth Gusto — abonnement (area prefix « ab »): 14-day trial, the two packs (Essentiel 49 € · Complet 99 € HT/mois), activation
   codes, gentle gating once the trial is over, and the Growth Gusto admin space (GG_ADMINS: every restaurant, every account).
   State on the restaurant doc (restos/{rid}):
     plan: "essai" | "essentiel" | "complet" | "suspendu"   pack: "essentiel" | "complet" (the pack chosen on the site, Complet by default)
     trialEnds (ms) · paidAt, paidUntil (ms | null = unlimited), activatedBy, activationCode · grantedBy, grantedAt · suspended { at, by, plan, pack }
   abPlan(resto?) → { plan: "essai" | "essentiel" | "complet" | "expire" | "suspendu" | "demo", pack, feat ("essentiel" | "complet": what is
   open), open (writes allowed), days, ends, until, why }. Hooks for other areas: abBlocked(col), abRefuse(col) (called by DB in core.js),
   abTile() / abRow() (menu Plus and Réglages, js/compte.js). Config: window.GG_STRIPE, GG_ACTIVATION, GG_CONTACT (js/config.js). */
"use strict";

const AB_DAY = 864e5, AB_TRIAL = 14;
const AB_PACKS = {
  essentiel: { t: "Essentiel", price: 49, tag: "L'hygiène, tenue au propre", feats: ["Relevés HACCP", "Étiquettes & DLC", "Réception des livraisons", "Registre sanitaire", "Planning ménage", "Fiches process", "Équipe illimitée"] },
  complet: { t: "Complet", price: 99, tag: "Toute la gestion du restaurant", feats: ["Tout Essentiel", "Stock & inventaire", "Tickets de caisse", "Tableau de bord", "Finances", "Pointeuse", "Planning", "Employés & salaires", "Plusieurs restaurants"] },
};
/* areas that belong to the pack Complet: with a paid Essentiel they show an upgrade card instead (during the trial everything is open) */
const AB_COMPLET = { stock: "Stock & inventaire", tickets: "Tickets de caisse", tzEdit: "Tickets de caisse", dashboard: "Tableau de bord", finance: "Finances", pointeuse: "Pointeuse", planning: "Planning", staff: "Employés & salaires" };
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
  const pack = r.pack === "essentiel" ? "essentiel" : "complet";
  if (r.plan === "suspendu") return { plan: "suspendu", pack, feat: "complet", open: false, days: 0 };
  if (r.plan === "essentiel" || r.plan === "complet") {
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
    AB.stamped[r.id] = true; const patch = { plan: "essai", pack: r.pack === "essentiel" ? "essentiel" : "complet", trialEnds: ends };
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
    : ["Votre essai est terminé", `Merci d'avoir essayé Growth Gusto. Vos données sont conservées et restent consultables. Pour continuer à enregistrer, choisissez un pack : ${AB_PACKS.essentiel.price} € ou ${AB_PACKS.complet.price} € HT par mois, sans engagement.`];
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
  const t = AB_COMPLET[route] || "Cette fonction"; const g = abGerant();
  return `<div class="inner narrow">${topBar(t)}
    <div class="glass ab-up st" style="--i:1"><span class="ab-upic">${ico("abPack")}</span><div class="lbl">Pack Complet</div><h2 class="h2">${esc(t)} fait partie du pack Complet</h2>
      <p class="sub">Stock & inventaire, tickets de caisse, tableau de bord, finances, pointeuse, planning, employés & salaires, plusieurs restaurants : ${AB_PACKS.complet.price} € HT par mois, sans engagement.</p>
      <ul class="ab-feats">${AB_PACKS.complet.feats.slice(1).map((f) => `<li>${ico("check")}${f}</li>`).join("")}</ul>
      ${g ? `<button class="btn acc block" data-go="abonnement">${ico("abPack")}Passer à Complet</button>` : `<p class="note" style="text-align:center">Votre restaurant est au pack Essentiel. Demandez au gérant de passer à Complet.</p>`}</div></div>`;
}
/* wrap the areas once every js/<area>.js has loaded (abo.js comes right after compte.js) */
function abWrap() {
  Object.keys(AB_COMPLET).forEach((r) => {
    const V = VIEWS[r]; if (!V || V._ab) return; V._ab = true;
    const r0 = V.render, a0 = V.after;
    V.render = function (p) { return abPlan().feat === "essentiel" ? abUpgrade(r) : r0.call(this, p); };
    if (a0) V.after = function (v) { if (abPlan().feat !== "essentiel") return a0.call(this, v); };
  });
  const H = VIEWS.home; if (H && !H._ab) { H._ab = true; const h0 = H.render; H.render = function (p) { const html = h0.call(this, p); const b = abStrip(); return b && html.includes("</header>") ? html.replace("</header>", "</header>" + b) : html; }; }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", abWrap); else abWrap();
/* ?admin=1 (or /admin): once the app is on screen, open the admin space */
window.addEventListener("gg:ready", () => { let f = null; try { f = sessionStorage.getItem("gg-admin"); sessionStorage.removeItem("gg-admin"); } catch (e) {} if (f === "1") setTimeout(() => go("admin", {}, { replace: !S.resto }), 60); });

/* ───────────────────────── Abonnement ───────────────────────── */
VIEWS.abonnement = {
  render() {
    const p = abPlan(), g = abGerant(), stripe = window.GG_STRIPE || {}, online = !!(stripe.essentiel || stripe.complet);
    const C = +(2 * Math.PI * 42).toFixed(2);
    const ring = p.plan === "essai" ? `<div class="ring ab-ring"><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="42" fill="none" stroke-width="8"/><circle class="br" cx="50" cy="50" r="42" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - p.pct)).toFixed(2)}"/></svg><div class="num"><span><b class="mono">${p.days}</b><small>${p.days > 1 ? "jours" : "jour"}</small></span></div></div>`
      : `<div class="ab-seal ${p.open ? "ok" : "off"}">${ico(p.plan === "suspendu" ? "abPause" : p.open ? "check" : "lock")}</div>`;
    const H = p.plan === "essai" ? ["Essai gratuit · tout le pack Complet est ouvert", `${abJours(p.days)} restant${p.days > 1 ? "s" : ""}`, p.days <= 3 ? `Jusqu'au ${abDate(p.ends)}. Ensuite, vos données restent lisibles mais plus rien ne s'enregistre : choisissez votre pack dès maintenant.` : `Jusqu'au ${abDate(p.ends)}. Choisissez votre pack quand vous voulez : rien ne s'arrête d'ici là.`]
      : p.plan === "expire" ? (p.why === "paid" ? ["Abonnement arrivé à échéance", "Renouvelez votre pack", `Votre pack ${AB_PACKS[p.pack].t} s'est terminé le ${abDate(p.ends)}. Vos données sont conservées : dès le renouvellement, tout repart.`] : ["Essai terminé", "Choisissez votre pack", "Vos données sont conservées et restent consultables. Dès l'activation, tout repart exactement là où vous en étiez."])
      : p.plan === "suspendu" ? ["Accès suspendu", "Contactez-nous", "L'accès à ce restaurant a été suspendu par Growth Gusto. Vos données sont conservées et restent consultables."]
      : p.plan === "demo" ? ["Démo", "Tout est ouvert", "Créez votre compte pour démarrer votre essai gratuit de 14 jours, sans carte bancaire."]
      : ["Abonnement actif", `Pack ${AB_PACKS[p.plan].t}`, `${p.until ? `Jusqu'au ${abDate(p.until)}${p.days != null && p.days <= 7 ? ` · ${abJours(p.days)}` : ""}.` : "Mensuel, sans engagement : résiliable à tout moment."}${p.since ? ` Activé le ${abDate(p.since)}.` : ""} Utilisateurs illimités.`];
    const hero = `<section class="ab-hero ${p.plan} st" style="--i:1">${ring}<div class="ab-ht"><span class="ab-eyebrow">${H[0]}</span><h2>${H[1]}</h2><p>${H[2]}</p></div></section>`;
    const paid = p.plan === "essentiel" || p.plan === "complet";
    const card = (k, i) => {
      const P = AB_PACKS[k], cur = paid && p.plan === k, best = k === "complet";
      const cta = !g ? "" : cur ? `<button class="btn soft block" disabled>${ico("check")}Pack actuel</button>`
        : paid && k === "essentiel" ? `<button class="btn soft block" data-act="abContact" data-v="${k}">${ico("abMail")}Nous écrire</button>`
        : `<button class="btn ${best ? "acc" : "soft"} block" data-act="abChoose" data-v="${k}">${paid ? "Passer à " : "Choisir "}${P.t}</button>`;
      return `<article class="glass ab-pack ${k} ${cur ? "cur" : ""} st" style="--i:${i}">
        <div class="ab-ph"><div><span class="lbl">Pack</span><h3 class="ab-pn">${P.t}</h3></div>${cur ? `<span class="pill ok">Votre pack</span>` : best ? `<span class="pill acc">Recommandé</span>` : ""}</div>
        <div class="ab-price"><b class="mono">${P.price} €</b><span>HT / mois</span></div>
        <p class="ab-ptag">${P.tag}</p>
        <ul class="ab-feats">${P.feats.map((f, j) => `<li class="${j === 0 && k === "complet" ? "all" : ""}">${ico("check")}${f}</li>`).join("")}</ul>${cta}</article>`;
    };
    const packs = `<div class="ab-packs">${card("essentiel", 2)}${card("complet", 3)}</div>
      <div class="ab-common st" style="--i:4">${["Mensuel, sans engagement", "Essai gratuit 14 jours", "Utilisateurs illimités", "Données hébergées en France"].map((t) => `<span>${ico("check")}${t}</span>`).join("")}</div>`;
    const act = !g || p.plan === "demo" || paid ? (g ? "" : `<p class="note st ab-ro" style="--i:5">${ico("lock")}Seul le gérant peut choisir le pack ou saisir un code d'activation.</p>`)
      : `<div class="glass pad ab-act st" style="--i:5"><div class="ab-acth"><span class="ic">${ico("abKey")}</span><div><b>${online ? "J'ai un code d'activation" : "Activer mon abonnement"}</b><em>${online ? "Reçu de Growth Gusto après votre commande" : "Le paiement en ligne arrive. En attendant, contactez-nous : vous recevez un code d'activation."}</em></div></div>
        ${online ? "" : `<a class="btn soft block ab-mailto" href="${abMailto(p.pack)}">${ico("abMail")}Nous écrire</a><p class="note ab-addr">${esc(window.GG_CONTACT || "")} · réponse dans la journée, du lundi au samedi</p>`}
        <form class="ab-actf" data-ab="code" novalidate><input class="input mono" id="abCode" placeholder="GG-XXXXXXXX-2026" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Code d'activation"><button class="btn acc" type="submit">Activer</button></form><em class="ab-acterr" id="abCodeErr" role="alert"></em></div>`;
    const adm = abAdmin() ? `<div class="glass pad st ab-admrow" style="--i:6"><div class="li tap" data-go="admin"><span class="ic">${ico("shield")}</span><div class="tx"><b>Espace admin Growth Gusto</b><em>Tous les restaurants, offrir ou suspendre l'accès</em></div>${ico("chev")}</div></div>` : "";
    return `<div class="inner cc-wide ab-wrap">${topBar("Abonnement")}${hero}${packs}${act}${adm}</div>`;
  },
  after() { if (AB.flash) { AB.flash = false; const h = $(".ab-hero"); h && h.classList.add("pop"); } },
};
function abMailto(pack) {
  const r = S.resto || {}; const subj = `Abonnement Growth Gusto · Pack ${AB_PACKS[pack === "essentiel" ? "essentiel" : "complet"].t} · ${r.name || ""}`;
  const body = `Bonjour,\n\nJe souhaite activer le pack ${AB_PACKS[pack === "essentiel" ? "essentiel" : "complet"].t} pour ${r.name || "mon restaurant"}.\nIdentifiant du restaurant : ${S.rid || ""}\nE-mail du compte : ${abEmail() || "(sans compte)"}\n\nMerci !`;
  return `mailto:${window.GG_CONTACT || ""}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}
async function abActivate(raw, errEl, inp) {
  const code = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  const fail = (m) => { SFX.err(); buzz([30, 50, 30]); if (errEl) errEl.textContent = m; if (inp) { inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake"); inp.focus(); } };
  if (!abGerant()) return fail("Seul le gérant peut activer l'abonnement.");
  if (!code) return fail("Saisissez votre code d'activation.");
  const plan = (window.GG_ACTIVATION || {})[code]; if (plan !== "essentiel" && plan !== "complet") return fail("Code inconnu. Vérifiez-le, ou écrivez-nous.");
  if (!S.rid || !S.resto) return fail("Aucun restaurant ouvert.");
  const patch = { plan, pack: plan, paidAt: Date.now(), paidUntil: null, activatedBy: abEmail() || S.me.name || S.me.id, activationCode: code };
  try { await DB.update("restos", S.rid, patch); } catch (e) { return fail("Impossible d'enregistrer pour l'instant. Vérifiez la connexion et réessayez."); }
  Object.assign(S.resto, patch); const r = S.restos.find((x) => x.id === S.rid); if (r) Object.assign(r, patch);
  try { logEvent("team", `a activé le pack ${AB_PACKS[plan].t}`); } catch (e) {}
  closeSheet(true); SFX.done(); buzz([12, 40, 12, 40, 30]); burst(); toast(`Pack ${AB_PACKS[plan].t} activé !`);
  AB.flash = true; if (S.route === "abonnement") { rerender(); const v = $("#viewport .view"); if (v) v.scrollTo({ top: 0, behavior: "smooth" }); } else go("abonnement");
  renderChrome();
}
document.addEventListener("submit", (e) => { const f = e.target; if (!f.dataset || f.dataset.ab !== "code") return; e.preventDefault(); SFX.init && SFX.init(); const i = $("#abCode", f); abActivate(i && i.value, $("#abCodeErr"), i); });

Object.assign(ACT, {
  abGoAbo: () => { closeSheet(true); go("abonnement"); },
  abChoose: (a, id, v) => {
    const k = v === "essentiel" ? "essentiel" : "complet"; const url = (window.GG_STRIPE || {})[k];
    SFX.tap(); buzz(6);
    if (url) { const u = url + (url.includes("?") ? "&" : "?") + "client_reference_id=" + encodeURIComponent(S.rid || "") + (abEmail() ? "&prefilled_email=" + encodeURIComponent(abEmail()) : ""); try { window.open(u, "_blank", "noopener"); } catch (e) { location.href = u; } return; }
    openSheet(`<div class="ab-block"><span class="ab-blockic">${ico("abPack")}</span><div class="lbl">Pack ${AB_PACKS[k].t} · ${AB_PACKS[k].price} € HT/mois</div><div class="h2">Paiement en ligne bientôt disponible</div><p class="sub">Pour activer votre abonnement, écrivez-nous : nous vous envoyons un code d'activation dans la journée. Sans engagement, résiliable à tout moment.</p>
      <a class="btn acc block" href="${abMailto(k)}">${ico("abMail")}Nous écrire</a>
      <form class="ab-actf" data-ab="code" novalidate><input class="input mono" id="abCode" placeholder="Code d'activation" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Code d'activation"><button class="btn soft" type="submit">Activer</button></form><em class="ab-acterr" id="abCodeErr" role="alert"></em></div>`);
  },
  abContact: (a, id, v) => { SFX.tap(); location.href = abMailto(v); },
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
      <span class="ab-clm dim">${r.createdAt ? `Créé le ${abDate(r.createdAt)}` : "Date inconnue"} · ${r.nMembers == null ? "équipe ?" : `${r.nMembers} membre${r.nMembers > 1 ? "s" : ""}`} ${p.plan === "essai" || p.plan === "expire" ? `· pack ${AB_PACKS[r.pack === "essentiel" ? "essentiel" : "complet"].t} ` : ""}${r.id === S.rid ? "· ouvert ici" : ""}</span></span>${ico("chev")}</button>`; }).join("");
}
function abAdminUsers() {
  const A = AB.admin || {}; const q = AB.q.trim().toLowerCase();
  const L = (A.users || []).filter((u) => !q || [u.name, u.email, u.id].some((x) => String(x || "").toLowerCase().includes(q))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (A.loading && !A.users) return `<div class="glass empty"><div class="ic">${ico("clock")}</div><b>Chargement…</b></div>`;
  if (!L.length) return `<div class="glass empty"><div class="ic">${ico("abUsers")}</div><b>${q ? "Aucun compte ne correspond" : "Aucun compte"}</b></div>`;
  return `<div class="glass pad ab-ul">${L.slice(0, 500).map((u) => { const n = (u.restos || []).length; return `<div class="li"><span class="ab-mono" style="--s:40px">${esc(initials(u.name || u.email || "?"))}</span><div class="tx"><b>${esc(u.name || firstName(String(u.email || "").split("@")[0]) || "Sans nom")}</b><em>${esc(u.email || u.id)}</em></div><span class="pill ${n ? "acc" : "neu"}">${n} resto${n > 1 ? "s" : ""}</span></div>`; }).join("")}</div>`;
}
VIEWS.admin = {
  noResto: true, nav: "more",
  render() {
    const signed = !!DB.uid;
    if (!abAdmin()) return `<div class="inner narrow">${topBar("Admin Growth Gusto")}<div class="glass empty ab-denied st" style="--i:1"><div class="ic">${ico("shield")}</div><b>Accès réservé à l'équipe Growth Gusto</b>${signed ? `Connecté avec <b class="ab-em">${esc(abEmail())}</b>, qui n'est pas un compte administrateur.` : "Connectez-vous avec un compte administrateur."}
      <div class="ab-denied-b">${signed ? `<button class="btn soft" data-act="abAdmSwitch">${ico("swap")}Changer de compte</button>` : `<button class="btn acc" data-act="abAdmLogin">${ico("users")}Se connecter</button>`}${S.resto ? `<button class="btn ghost" data-go="home">Retour à l'app</button>` : ""}</div></div></div>`;
    abAdminFetch();
    const A = AB.admin || {}; const R = A.restos || [];
    const n = { all: R.length, essai: 0, paye: 0, fin: 0 }; R.forEach((r) => { const p = abPlan(r); if (p.plan === "essai") n.essai++; else if (p.plan === "essentiel" || p.plan === "complet") n.paye++; else n.fin++; });
    const kpi = `<div class="ab-kpis st" style="--i:1"><div class="glass ab-kpi"><span class="lbl">Restaurants</span><b class="mono">${n.all}</b></div><div class="glass ab-kpi"><span class="lbl">En essai</span><b class="mono acc">${n.essai}</b></div><div class="glass ab-kpi"><span class="lbl">Abonnés</span><b class="mono ok">${n.paye}</b></div><div class="glass ab-kpi"><span class="lbl">Terminés</span><b class="mono ${n.fin ? "bad" : ""}">${n.fin}</b></div></div>`;
    const tabs = `<div class="seg ab-seg st" style="--i:2"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${AB.tab === "comptes" ? "100%" : "0"})"></span><button class="${AB.tab === "restos" ? "on" : ""}" data-act="abAdmTab" data-v="restos">Restaurants</button><button class="${AB.tab === "comptes" ? "on" : ""}" data-act="abAdmTab" data-v="comptes">Comptes${A.users ? ` · ${A.users.length}` : ""}</button></div>
      <label class="ab-search st" style="--i:2">${ico("abSearch")}<input class="input" id="abQ" type="search" placeholder="${AB.tab === "comptes" ? "Nom, e-mail…" : "Restaurant, e-mail du gérant…"}" value="${esc(AB.q)}" autocomplete="off"></label>`;
    return `<div class="inner cc-wide ab-wrap ab-adm">${topBar("Admin Growth Gusto", { right: `${typeof auMailPrev === "function" ? `<button class="iconbtn" data-act="auMailPrev" aria-label="Aperçu des e-mails" title="Aperçu des e-mails">${ico("abMail")}</button>` : ""}<button class="iconbtn" data-act="abAdmReload" aria-label="Actualiser" title="Actualiser">${ico("abRefresh")}</button>` })}
      <p class="sub st" style="--i:0;margin:-6px 0 0">${DB.mode === "db" ? "Tous les restaurants et comptes du projet." : "Cet appareil seulement (sans compte, l'admin ne voit que les restaurants de ce téléphone)."}${A.loading ? " Actualisation…" : ""}</p>
      ${kpi}${tabs}<div id="abList" class="ab-list">${AB.tab === "comptes" ? abAdminUsers() : abAdminList()}</div></div>`;
  },
};
function abAdmSheet(id) {
  const A = AB.admin || {}; const r = (A.restos || []).find((x) => x.id === id) || S.restos.find((x) => x.id === id); if (!r) return;
  const st = (S.ui.abAdm ||= { pack: "complet", dur: 1 }); st.id = id; const p = abPlan(r);
  const dur = [[1, "1 mois"], [3, "3 mois"], [12, "1 an"], [0, "Illimité"]];
  const line = p.plan === "essai" ? `Essai jusqu'au ${abDate(p.ends)}` : p.plan === "expire" ? (p.why === "paid" ? `Pack ${AB_PACKS[p.pack].t} échu le ${abDate(p.ends)}` : `Essai terminé le ${abDate(p.ends)}`) : p.plan === "suspendu" ? `Suspendu${r.suspended && r.suspended.at ? ` le ${abDate(r.suspended.at)}` : ""}` : p.plan === "demo" ? "Démo" : `Pack ${AB_PACKS[p.plan].t}${p.until ? ` jusqu'au ${abDate(p.until)}` : " · illimité"}${r.grantedBy ? ` · offert par ${esc(r.grantedBy)}` : r.activationCode ? ` · code ${esc(r.activationCode)}` : ""}`;
  openSheet(`<div class="ab-ash"><div class="ab-ashh">${abMono(r, 52)}<div style="flex:1;min-width:0"><div class="h2" style="font-size:20px">${esc(r.name || "Sans nom")}</div><div class="sub">${esc(r.ownerEmail || r.ownerName || r.owner || "")}${r.createdAt ? ` · créé le ${abDate(r.createdAt)}` : ""}</div></div>${abPlanPill(p)}</div>
    <p class="note ab-line">${line} · ${r.nMembers == null ? "équipe inconnue" : `${r.nMembers} membre${r.nMembers > 1 ? "s" : ""}`} · <span class="mono">${esc(r.id)}</span></p>
    ${p.plan === "suspendu" ? `<button class="btn acc block" data-act="abAdmRestore">${ico("abPlay")}Rétablir l'accès</button>` : `
    <div class="lbl">Offrir l'accès</div>
    <div class="seg ab-seg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${st.pack === "complet" ? "100%" : "0"})"></span><button class="${st.pack === "essentiel" ? "on" : ""}" data-act="abAdmPack" data-v="essentiel">Essentiel</button><button class="${st.pack === "complet" ? "on" : ""}" data-act="abAdmPack" data-v="complet">Complet</button></div>
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
  abAdmReload: () => { SFX.tap(); abAdminFetch(true); },
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
