/* Growth Gusto — area: annuaire des fournisseurs (routes « fournisseurs », « fournisseur »). Prefix « fo ».
   Every supplier of the restaurant on one screen: who delivers this week, the next order deadline with a live countdown,
   one card per supplier (category, delivery days, franco, what was spent this month) and, on each card, call / write / order.
   The supplier page gathers everything Growth Gusto knows about them:
     · contact: call, SMS, WhatsApp, e-mail, itinerary, website, « Enregistrer le contact » (.vcf), share the file;
     · « Commander en un clic »: the order already prepared by js/achats.js (covers × usage − stock, rounded to the pack), sent by
       e-mail / SMS / WhatsApp / PDF from one sheet (ACT.acSendAsk). No prepared line: the order page opens to add products;
     · delivery: weekdays, delivery window, order deadline and delay, franco de port, payment terms, customer number;
     · figures: spend per month (expenses « achats » of js/reception.js + js/marge.js, else invoices), deliveries complete,
       refused lines, recent price changes (S.prices), the products they supply with their current price;
     · history: orders, deliveries and invoices on one timeline.
   Data (restos/{rid}/suppliers/{id}, shared with js/achats.js and js/import.js; fields added here, none renamed):
     + cat, address, website, account (n° client), winFrom / winTo ("HH:MM", delivery window), payTerms, notes, fav, archived
   Reads: S.products, S.receptions, S.expenses, S.invoices, S.prices, orders (js/achats.js). Nothing here costs money: mailto, sms, tel. */
"use strict";

TAB_OF.fournisseurs = "stock"; TAB_OF.fournisseur = "stock";
Object.assign(IC, {
  foBook: ["M5 3.5h12.5A1.5 1.5 0 0 1 19 5v15.5H6.5A1.5 1.5 0 0 1 5 19z", "f:M5 3.5h12.5A1.5 1.5 0 0 1 19 5v15.5H6.5A1.5 1.5 0 0 1 5 19z", "M5 19a1.5 1.5 0 0 1 1.5-1.5H19", "c:12,9.5,2.2", "M8.6 14.5a3.6 3.6 0 0 1 6.8 0"],
  foPhone: ["M5 3.5h3.2l1.6 4.2-2.2 1.4a11 11 0 0 0 7.3 7.3l1.4-2.2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z", "f:M5 3.5h3.2l1.6 4.2-2.2 1.4a11 11 0 0 0 7.3 7.3l1.4-2.2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z"],
  foPin: ["M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z", "f:M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z", "c:12,9.5,2.5"],
  foGlobe: ["c:12,12,9", "M3 12h18", "M12 3a14 14 0 0 1 0 18", "M12 3a14 14 0 0 0 0 18"],
  foStar: ["m12 3.2 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.9-5.3 2.9 1-6L3.3 9.6l6-.9z", "f:m12 3.2 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.9-5.3 2.9 1-6L3.3 9.6l6-.9z"],
  foBolt: ["M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z", "f:M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"],
  foCard: ["r:2.5,5,19,14,2.5", "c:8.5,11,2", "M5.5 16a3.2 3.2 0 0 1 6 0", "M14 10h4.5", "M14 13.5h3"],
  foNote: ["M6 3.5h8.5L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1-1.5z", "f:M6 3.5h8.5L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1-1.5z", "M14.5 3.5V8H19", "M8.5 12.5h7", "M8.5 16h4.5"],
  foUp: ["M7 14.5 12 9.5l5 5"], foDown: ["M7 9.5l5 5 5-5"],
});

/* side nav: right after « Achats » (no core edit); the phone and tablet « Plus » menu copies NAV (js/compte.js ccMoreFill) */
(function foNav() {
  if (NAV.some((n) => n[0] === "fournisseurs")) return;
  const i = NAV.findIndex((n) => n[0] === "achats"); const j = NAV.findIndex((n) => n[0] === "stock");
  NAV.splice(i >= 0 ? i + 1 : j >= 0 ? j + 1 : NAV.length, 0, ["fournisseurs", "foBook", "Fournisseurs"]);
})();
try { if (typeof PM_ROUTE !== "undefined") Object.assign(PM_ROUTE, { fournisseurs: "stock", fournisseur: "stock" }); } catch (e) {}

/* ───────── categories (guessed from the name until the person picks one) ───────── */
const FO_CATS = [
  ["maree", "Marée", "#2F6FD8", /mar[ée]e|poisson|p[êe]che|criée|hu[îi]tre|coquillage|ocean|océan/i],
  ["boucherie", "Boucherie", "#C2337A", /boucher|viande|volaille|abattoir/i],
  ["charcuterie", "Charcuterie", "#B5482E", /charcut|salaison|traiteur/i],
  ["primeur", "Fruits & légumes", "#1E7F55", /primeur|l[ée]gume|fruit|maraîch|maraich|ferme|potager|jardin/i],
  ["cremerie", "Crèmerie", "#B97D0E", /fromag|cr[èe]merie|laiti|lait|beurre/i],
  ["boulangerie", "Boulangerie", "#A0632B", /boulang|pain|p[âa]tisserie|fournil/i],
  ["boissons", "Vins & boissons", "#7A2D6E", /domaine|cave|vin|boisson|brass|bi[èe]re|spiritueux|caf[ée]|torr[ée]f/i],
  ["grossiste", "Grossiste", "#4A1FE6", /metro|promocash|transgourmet|pomona|episaveurs|sysco|brake|davigel|grossiste|cash/i],
  ["entretien", "Entretien & emballages", "#0E8C9E", /entretien|nettoy|hygi[èe]ne|emballage|jetable|lessive/i],
  ["autre", "Autre", "#5A6386", /$^/],
];
const foCat = (id) => FO_CATS.find((c) => c[0] === id) || FO_CATS[FO_CATS.length - 1];
const foGuess = (name) => (FO_CATS.find((c) => c[3].test(name || "")) || FO_CATS[FO_CATS.length - 1])[0];
const FO_PAY = ["À la livraison", "Prélèvement", "15 jours", "30 jours", "45 jours fin de mois", "60 jours"];

const FO = { q: "", cat: "", day: null, F: null, seeded: null };

/* ───────── demo: give the demo suppliers a real file (category, address, window, customer number, notes) ───────── */
function foSeedDemo() {
  if (DB.mode !== "demo" || FO.seeded === S.rid) return; FO.seeded = S.rid;
  try { if (typeof acSeedDemo === "function") acSeedDemo(); } catch (e) {}
  const path = DB.path("suppliers"); const st = DB.local[path]; if (!st) return;
  const X = {
    "Marée Atlantique": { cat: "maree", address: "Port de pêche, 17000 La Rochelle", website: "https://www.maree-atlantique.fr", account: "CDS-0418", winFrom: "06:30", winTo: "08:30", payTerms: "30 jours", notes: "Julien passe par la cour arrière. Arrivage de Saint-Jacques le mardi d'octobre à mai.", fav: true },
    "Charcuterie Ripert": { cat: "charcuterie", address: "3 rue des Halles, 42000 Saint-Étienne", account: "R-2291", winFrom: "09:00", winTo: "11:00", payTerms: "30 jours", notes: "Jambon de Bayonne 18 mois sur commande, 10 jours à l'avance." },
    "Boucherie Durand": { cat: "boucherie", address: "8 place du Marché, 69002 Lyon", winFrom: "07:00", winTo: "09:00", payTerms: "À la livraison", notes: "Marc découpe le paleron à la demande. Appeler avant 17 h la veille.", fav: true },
    Metro: { cat: "grossiste", address: "Avenue Jean Mermoz, 69008 Lyon", website: "https://www.metro.fr", account: "4 412 908 551", winFrom: "08:00", winTo: "12:00", payTerms: "Prélèvement", notes: "Carte client au nom du restaurant, dans le tiroir du bureau." },
    "Ferme des Collines": { cat: "primeur", address: "Lieu-dit Les Collines, 69610 Sainte-Foy-l'Argentière", winFrom: "10:00", winTo: "12:00", payTerms: "À la livraison", notes: "Œufs plein air et volailles. Élodie livre le mercredi, prévenir si fermeture." },
    "Boulangerie Gaspard": { cat: "boulangerie", address: "14 rue Mercière, 69002 Lyon", winFrom: "07:00", winTo: "07:45", payTerms: "15 jours" },
    "Domaine Rion": { cat: "boissons", address: "8 route nationale, 21700 Vosne-Romanée", website: "https://www.domainerion.fr", account: "CLI-0071", winFrom: "14:00", winTo: "17:00", payTerms: "45 jours fin de mois", notes: "Franco à 300 € HT. Allocation de Nuits-Saint-Georges en mars." },
    "Primeur du Marché": { cat: "primeur", address: "Marché de gros, 69007 Lyon", winFrom: "06:00", winTo: "07:30", payTerms: "15 jours", notes: "Karim répond aussi par SMS. Herbes fraîches à commander avant 21 h.", fav: true },
  };
  let n = 0; Object.values(st).forEach((d) => { const x = X[d.name]; if (x && !d.cat) { Object.assign(d, x); n++; } });
  if (n) DB.emit(path);
}

/* ───────── data ───────── */
function foWatch() { foSeedDemo(); if (typeof acWatch === "function") acWatch(); }
/* every supplier the restaurant works with: the files, the names on products (js/achats.js) and on deliveries and invoices */
function foAll(withArchived) {
  foWatch();
  const base = typeof acSuppliers === "function" ? acSuppliers() : [];
  const seen = new Set(base.map((s) => s.key));
  const arch = new Set((typeof acSupDocs === "function" ? acSupDocs() : []).filter((d) => d.archived && d.name).map((d) => acKey(d.name)));
  const add = (n) => { n = (n || "").trim(); if (!n) return; const k = acKey(n); if (seen.has(k) || arch.has(k)) return; seen.add(k); base.push({ key: k, name: n, doc: null, products: [] }); };
  (S.receptions || []).forEach((r) => add(r.supplier)); (S.invoices || []).forEach((f) => add(f.supplier));
  let out = base;
  if (withArchived) (typeof acSupDocs === "function" ? acSupDocs() : []).forEach((d) => { if (d.archived && d.name && !out.some((s) => s.key === acKey(d.name))) out.push({ key: acKey(d.name), name: d.name.trim(), doc: d, products: [] }); });
  return out;
}
const foOf = (k) => foAll(true).find((s) => s.key === k) || null;
const foCatOf = (s) => (s.doc && s.doc.cat) || foGuess(s.name);
const foPlan = (s) => { try { return typeof acPlanFor === "function" ? acPlanFor(s) : null; } catch (e) { return null; } };

/* € HT spent with a supplier, per month (YYYY-MM): purchases of Finances (expenses « achats »), else invoices, else priced deliveries */
function foSpend(k) {
  const by = {};
  (S.expenses || []).forEach((e) => { if (e.cat !== "achats" || !e.day || acKey(e.supplier) !== k) return; const m = e.day.slice(0, 7); by[m] = (by[m] || 0) + (+e.amountHT || 0); });
  if (!Object.keys(by).length) (S.invoices || []).forEach((f) => { if (!f.day || acKey(f.supplier) !== k) return; const m = f.day.slice(0, 7); by[m] = (by[m] || 0) + (+f.totalHT || 0); });
  if (!Object.keys(by).length) (S.receptions || []).forEach((r) => { if (acKey(r.supplier) !== k || !(r.amountHT > 0)) return; const m = dayKey(new Date(r.at)).slice(0, 7); by[m] = (by[m] || 0) + +r.amountHT; });
  return by;
}
const foMonth = (off = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const FO_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/* deliveries and their quality: complete orders, refused lines */
function foStats(s) {
  const k = s.key, since = Date.now() - 90 * 864e5;
  const recs = (S.receptions || []).filter((r) => acKey(r.supplier) === k).sort((a, b) => b.at - a.at);
  const recent = recs.filter((r) => r.at > since);
  const refused = recent.reduce((a, r) => a + (r.lines || []).filter((L) => L.decision === "refuse" || L.refused).length, 0);
  const ords = (typeof acOrders === "function" ? acOrders() : []).filter((o) => (o.supKey || acKey(o.supplier)) === k && o.status !== "brouillon");
  const deliv = ords.map((o) => ({ o, d: typeof acDelivery === "function" ? acDelivery(o) : null })).filter((x) => x.d && x.d.lines);
  const full = deliv.filter((x) => !(typeof acMissing === "function" ? acMissing(x.o, x.d) : []).length).length;
  const prices = (S.prices || []).filter((h) => acKey(h.supplier) === k && h.prev > 0 && Math.abs(+h.pct || 0) >= 1 && (h.day || "") >= addDays(dayKey(), -90))
    .sort((a, b) => (b.day || "").localeCompare(a.day || "") || (b.at || 0) - (a.at || 0));
  const seenP = new Set(); const lastP = prices.filter((h) => { const id = h.productId || h.name; if (seenP.has(id)) return false; seenP.add(id); return true; });
  return { recs, recent, refused, ords, deliv: deliv.length, full, lastP, lastRec: recs[0] || null };
}

/* contact links */
const foTel = (ph) => String(ph || "").replace(/[^\d+]/g, "");
const foSite = (u) => { u = String(u || "").trim(); return !u ? "" : /^https?:\/\//i.test(u) ? u : "https://" + u; };
const foMaps = (a) => (IS_IOS ? `https://maps.apple.com/?q=${encodeURIComponent(a)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`);
const foHost = (u) => String(u || "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/.*$/, "");

/* delivery days of this week, starting today */
function foWeek(list) {
  const today = dayKey(); const out = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(today, i); const w = parseDay(k).getDay();
    const who = list.filter((s) => acCfg(s).days.includes(w) && (s.doc || s.products.length));
    const route = (typeof acOrders === "function" ? acOrders() : []).filter((o) => o.status === "envoyee" && o.deliveryDay === k && !(typeof acDelivery === "function" && acDelivery(o)));
    out.push({ k, w, i, who, route });
  }
  return out;
}

/* ───────── list ───────── */
VIEWS.fournisseurs = {
  render() {
    const all = foAll().sort((a, b) => (b.doc && b.doc.fav ? 1 : 0) - (a.doc && a.doc.fav ? 1 : 0) || a.name.localeCompare(b.name, "fr"));
    const money = acMoney(); const m0 = foMonth(0);
    const plans = all.map((s) => ({ s, pl: foPlan(s) })).filter((x) => x.pl);
    const nextUp = plans.filter((x) => x.pl.on.length && x.pl.next.deadline > Date.now()).sort((a, b) => a.pl.next.deadline - b.pl.next.deadline)[0]
      || plans.filter((x) => (x.s.doc || x.s.products.length) && x.pl.next.deadline > Date.now()).sort((a, b) => a.pl.next.deadline - b.pl.next.deadline)[0];
    const week = foWeek(all);
    const cats = [...new Set(all.map(foCatOf))].sort((a, b) => FO_CATS.findIndex((c) => c[0] === a) - FO_CATS.findIndex((c) => c[0] === b));
    const q = acKey(FO.q || "");
    const dayOn = FO.day != null ? week.find((d) => d.k === FO.day) : null;
    const shown = all.filter((s) => (!FO.cat || foCatOf(s) === FO.cat) && (!q || acKey([s.name, s.doc && s.doc.contact, s.doc && s.doc.notes, foCat(foCatOf(s))[1], ...s.products.map((p) => p.name)].join(" ")).includes(q)) && (!dayOn || dayOn.who.some((x) => x.key === s.key)));
    const spentM = all.reduce((a, s) => a + (foSpend(s.key)[m0] || 0), 0);

    const hero = `<div class="fo-hero wall st" style="--i:1">
      <div class="fo-hero-t"><span class="fo-hero-l">${ico("foBook")}Vos fournisseurs</span><span class="fo-hero-c mono">${all.length}</span></div>
      ${nextUp ? (() => { const { s, pl } = nextUp; return `<div class="fo-next">
        <div class="fo-next-h">${acSupMark(s.name, 46)}<div class="tx"><em>Prochaine commande</em><b>${esc(s.name)}</b><span>Livraison ${acDayLong(pl.next.d1)}${pl.on.length ? ` · ${pl.on.length} produit${pl.on.length > 1 ? "s" : ""} prêt${pl.on.length > 1 ? "s" : ""}` : ""}</span></div></div>
        <div class="fo-next-f">${acDeadlinePill(pl)}<button class="btn fo-next-b" data-act="foOrder" data-v="${esc(s.key)}">${ico("foBolt")}${pl.on.length ? "Commander" : "Préparer"}</button></div>
      </div>`; })() : `<p class="fo-hero-s">Ajoutez vos fournisseurs : leurs jours de livraison, leur heure limite et leurs coordonnées, tout au même endroit.</p>`}
      <div class="fo-week" role="group" aria-label="Livraisons de la semaine">${week.map((d) => `<button class="fo-wd${d.i === 0 ? " now" : ""}${FO.day === d.k ? " on" : ""}${d.who.length ? "" : " off"}" data-act="foDay" data-v="${d.k}" aria-pressed="${FO.day === d.k}" style="--j:${d.i}">
        <em>${d.i === 0 ? "auj." : AC_DOW[d.w]}</em><b class="mono">${parseDay(d.k).getDate()}</b>
        <span class="fo-wdots">${d.who.slice(0, 4).map((s) => `<i style="--c:${acColor(s.key)}"></i>`).join("")}${d.who.length > 4 ? `<i class="more">+${d.who.length - 4}</i>` : ""}</span>
        ${d.route.length ? `<span class="fo-wtruck" title="Commande en route">${ico("truck")}</span>` : ""}</button>`).join("")}</div>
      <div class="fo-hero-f"><span>${week[0].who.length ? `${week[0].who.length} livraison${week[0].who.length > 1 ? "s" : ""} possible${week[0].who.length > 1 ? "s" : ""} aujourd'hui` : "Pas de livraison aujourd'hui"}</span>${money && spentM > 0 ? `<span><b class="mono">${acEur(spentM, 0)}</b> HT achetés en ${MONTHS[new Date().getMonth()]}</span>` : ""}</div>
    </div>`;

    const tools = `<div class="fo-tools st" style="--i:2">
      <label class="fo-search">${ico("search")}<input class="input" id="foQ" type="search" placeholder="Fournisseur, produit, contact…" value="${esc(FO.q || "")}" autocomplete="off" enterkeyhint="search"></label>
      ${cats.length > 1 ? `<div class="fo-chips"><button class="chip${!FO.cat ? " on" : ""}" data-act="foCatF" data-v="">Tous</button>${cats.map((c) => `<button class="chip${FO.cat === c ? " on" : ""}" data-act="foCatF" data-v="${c}"><i class="fo-dot" style="--c:${foCat(c)[2]}"></i>${foCat(c)[1]}</button>`).join("")}</div>` : ""}
      ${dayOn ? `<div class="fo-filt">${ico("truck")}<span>Livrent ${dayOn.i === 0 ? "aujourd'hui" : acDayLong(dayOn.k)}</span><button class="fo-x" data-act="foDay" data-v="${dayOn.k}" aria-label="Retirer le filtre">${ico("x")}</button></div>` : ""}
    </div>`;

    const card = (s, i) => {
      const c = acCfg(s); const cat = foCat(foCatOf(s)); const pl = foPlan(s); const sp = foSpend(s.key)[m0] || 0; const d = s.doc || {};
      const days = AC_WEEK.map((w) => `<i class="${c.days.includes(w) ? "on" : ""}">${AC_DL[w]}</i>`).join("");
      return `<div class="glass fo-card st" style="--i:${Math.min(i + 3, 14)};--c:${acColor(s.key)}">
        <button class="fo-card-m" data-act="foOpen" data-v="${esc(s.key)}">
          <div class="fo-card-h">${acSupMark(s.name, 48)}<div class="tx"><b>${esc(s.name)}${d.fav ? `<span class="fo-fav">${ico("foStar")}</span>` : ""}</b><em><i class="fo-dot" style="--c:${cat[2]}"></i>${cat[1]}${c.contact ? ` · ${esc(c.contact)}` : ""}</em></div>${ico("chev")}</div>
          <div class="fo-card-d"><span class="fo-days" aria-label="Jours de livraison">${days}</span><span class="fo-cut">${ico("clock")}avant ${c.cutoff}${c.lead ? (c.lead === 1 ? " la veille" : ` · J-${c.lead}`) : ""}</span></div>
          <div class="fo-card-s">${c.minHT && money ? `<span>Franco <b class="mono">${acEur(c.minHT, 0)}</b></span>` : ""}${d.winFrom ? `<span>Livré <b class="mono">${d.winFrom.replace(":", "h")}–${(d.winTo || "").replace(":", "h")}</b></span>` : ""}${money && sp > 0 ? `<span>Ce mois <b class="mono">${acEur(sp, 0)}</b></span>` : ""}${s.products.length ? `<span><b class="mono">${s.products.length}</b> produit${s.products.length > 1 ? "s" : ""}</span>` : ""}</div>
        </button>
        <div class="fo-card-a">
          ${c.phone ? `<a class="fo-qa" href="tel:${esc(foTel(c.phone))}" data-act="foTap" aria-label="Appeler ${esc(s.name)}">${ico("foPhone")}<span>Appeler</span></a>` : `<button class="fo-qa dim" data-act="foEdit" data-v="${esc(s.key)}">${ico("foPhone")}<span>Ajouter</span></button>`}
          ${c.email ? `<a class="fo-qa" href="mailto:${esc(c.email)}" data-act="foTap" aria-label="Écrire à ${esc(s.name)}">${ico("acMail")}<span>E-mail</span></a>` : c.phone ? `<a class="fo-qa" href="sms:${esc(foTel(c.phone))}" data-act="foTap">${ico("acSms")}<span>SMS</span></a>` : `<span class="fo-qa ghost"></span>`}
          <button class="fo-qa go${pl && pl.on.length ? " hot" : ""}" data-act="foOrder" data-v="${esc(s.key)}">${ico("foBolt")}<span>Commander${pl && pl.on.length ? ` <b class="mono">${pl.on.length}</b>` : ""}</span></button>
        </div>
      </div>`;
    };
    const list = shown.length ? `<div class="fo-grid">${shown.map(card).join("")}</div>`
      : all.length ? `<div class="glass empty st" style="--i:3"><div class="ic">${ico("search")}</div><b>Aucun fournisseur ne correspond</b>Essayez un autre mot, ou retirez le filtre.<div style="margin-top:14px"><button class="btn soft" data-act="foClear">Tout afficher</button></div></div>`
      : `<div class="glass empty st" style="--i:3"><div class="ic">${ico("foBook")}</div><b>Votre carnet de fournisseurs</b>Le poissonnier, le boucher, le primeur, la cave : leurs coordonnées, leurs jours de livraison et la commande en un geste.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn acc" data-act="foEdit" data-v="">${ico("plus")}Ajouter un fournisseur</button>${VIEWS.import ? `<button class="btn soft" data-go="import">${ico("upload")}Importer une liste</button>` : ""}</div></div>`;
    return `<div class="inner wide fo">${topBar("Fournisseurs", { right: `<button class="iconbtn" data-act="foEdit" data-v="" aria-label="Ajouter un fournisseur">${ico("plus")}</button>` })}
      ${hero}${all.length ? tools : ""}${list}
      ${all.length ? `<button class="glass pad fo-add st" style="--i:${Math.min(shown.length + 4, 15)}" data-act="foEdit" data-v="">${ico("plus")}<span>Ajouter un fournisseur</span></button>` : ""}
    </div>`;
  },
  after(v) {
    const i = $("#foQ", v); if (i) i.addEventListener("input", debounce(() => { FO.q = i.value; const at = i.selectionStart; refresh(true); const n = $("#foQ"); if (n) { n.focus(); try { n.setSelectionRange(at, at); } catch (e) {} } }, 160));
    if (typeof acTicker === "function") acTicker();
  },
};

/* ───────── one supplier ───────── */
function foBars(by) {
  const ms = [-5, -4, -3, -2, -1, 0].map((o) => foMonth(o)); const vals = ms.map((m) => by[m] || 0); const max = Math.max(...vals, 1);
  return `<div class="fo-bars">${ms.map((m, j) => `<div class="fo-bar${j === 5 ? " now" : ""}" style="--j:${j}"><span class="mono">${vals[j] ? (vals[j] >= 1000 ? (Math.round(vals[j] / 100) / 10).toString().replace(".", ",") + " k" : Math.round(vals[j])) : ""}</span><i style="height:${Math.max(vals[j] ? 6 : 2, (vals[j] / max) * 100)}%"></i><em>${FO_MS[+m.slice(5) - 1]}</em></div>`).join("")}</div>`;
}
VIEWS.fournisseur = {
  nav: "fournisseurs",
  render(P) {
    const s = foOf(P.k); if (!s) return `<div class="inner narrow">${topBar("Fournisseur")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("foBook")}</div><b>Ce fournisseur n'existe plus</b><div style="margin-top:14px"><button class="btn acc" data-go="fournisseurs">Retour aux fournisseurs</button></div></div></div>`;
    const c = acCfg(s); const d = s.doc || {}; const cat = foCat(foCatOf(s)); const money = acMoney(); const pl = foPlan(s); const st = foStats(s);
    const by = foSpend(s.key); const m0 = foMonth(0), m1 = foMonth(-1); const y12 = Object.entries(by).filter(([m]) => m > foMonth(-12)).reduce((a, [, v]) => a + v, 0);
    const qa = (href, ic, t, extra = "") => href ? `<a class="fo-act" href="${esc(href)}" ${extra} data-act="foTap">${ico(ic)}<span>${t}</span></a>` : `<button class="fo-act off" data-act="foEdit" data-v="${esc(s.key)}">${ico(ic)}<span>${t}</span></button>`;
    const head = `<div class="glass fo-head st" style="--i:1;--c:${acColor(s.key)}">
      <div class="fo-head-t">${acSupMark(s.name, 64)}<div class="tx"><h1>${esc(s.name)}</h1><em><i class="fo-dot" style="--c:${cat[2]}"></i>${cat[1]}${c.contact ? ` · ${esc(c.contact)}` : ""}</em></div>
        <button class="fo-star${d.fav ? " on" : ""}" data-act="foFav" data-v="${esc(s.key)}" aria-pressed="${!!d.fav}" aria-label="Favori">${ico("foStar")}</button></div>
      <div class="fo-acts">
        ${qa(c.phone ? `tel:${foTel(c.phone)}` : "", "foPhone", "Appeler")}
        ${qa(c.phone ? `sms:${foTel(c.phone)}` : "", "acSms", "SMS")}
        ${qa(c.email ? `mailto:${c.email}` : "", "acMail", "E-mail")}
        ${qa(d.address ? foMaps(d.address) : "", "foPin", "Itinéraire", 'target="_blank" rel="noopener"')}
        ${d.website ? qa(foSite(d.website), "foGlobe", "Site", 'target="_blank" rel="noopener"') : qa(c.phone ? `https://wa.me/${acPhoneIntl(c.phone)}` : "", "acWa", "WhatsApp", 'target="_blank" rel="noopener"')}
      </div>
    </div>`;
    const order = pl ? `<div class="fo-order wall st" style="--i:2">
      <div class="fo-order-t"><span class="fo-hero-l">${ico("foBolt")}Commande en un clic</span>${acDeadlinePill(pl)}</div>
      ${pl.on.length ? `<div class="fo-order-n"><b class="mono">${money ? acEur(pl.total, 0) : pl.on.length}</b><span>${money ? `HT · ${pl.on.length} produit${pl.on.length > 1 ? "s" : ""}` : `produit${pl.on.length > 1 ? "s" : ""}`}</span></div>
        <p class="fo-order-s">${esc(pl.on.slice(0, 5).map((L) => L.name).join(", "))}${pl.on.length > 5 ? "…" : ""}. Préparée d'après vos couverts et votre stock, pour une livraison ${acDayLong(pl.next.d1)}.</p>
        ${c.minHT && money ? `<div class="fo-fr${pl.total >= c.minHT ? " ok" : ""}"><i style="width:${Math.min(100, (pl.total / c.minHT) * 100)}%"></i></div><span class="fo-frt">${pl.total >= c.minHT ? "Franco de port atteint" : `Encore ${acEur(c.minHT - pl.total, 0)} pour le franco`}</span>` : ""}
        <div class="fo-order-b"><button class="btn fo-send" data-act="foOrder" data-v="${esc(s.key)}" data-direct="1">${ico("acSend")}Envoyer</button><button class="btn fo-see" data-act="acOpen" data-v="${esc(s.key)}">Vérifier</button></div>`
      : `<p class="fo-order-s">${s.products.length ? `Rien à commander pour la livraison ${acDayLong(pl.next.d1)} : votre stock suffit. Vous pouvez quand même préparer un bon.` : `Reliez vos produits à ${esc(s.name)} dans le stock : la commande se préparera toute seule. En attendant, faites un bon à la main.`}</p>
        <div class="fo-order-b"><button class="btn fo-see" data-act="acOpen" data-v="${esc(s.key)}">${ico("plus")}Préparer une commande</button></div>`}
    </div>` : "";
    const row = (ic, t, v) => v ? `<div class="li fo-li"><span class="fo-lic">${ico(ic)}</span><div class="tx"><em>${t}</em><b>${v}</b></div></div>` : "";
    const deliv = `<div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">Livraisons</span><button class="btn ghost sm" data-act="foEdit" data-v="${esc(s.key)}">${ico("edit")}Modifier</button></div>
      <div class="fo-wk">${AC_WEEK.map((w) => `<span class="${c.days.includes(w) ? "on" : ""}${new Date().getDay() === w ? " td" : ""}">${AC_DOW[w].replace(".", "")}</span>`).join("")}</div>
      ${c.daysFrom === "learnt" ? `<em class="fo-hint">${ico("acBrain")}Jours déduits de vos dernières réceptions</em>` : c.daysFrom === "default" ? `<em class="fo-hint">${ico("alert")}Jours de livraison pas encore renseignés</em>` : ""}
      <div class="fo-kv">
        <div><em>Commander avant</em><b class="mono">${c.cutoff.replace(":", "h")}</b><span>${c.lead === 0 ? "le jour même" : c.lead === 1 ? "la veille" : `${c.lead} jours avant`}</span></div>
        <div><em>Créneau</em><b class="mono">${d.winFrom ? `${d.winFrom.replace(":", "h")}–${(d.winTo || "").replace(":", "h")}` : "–"}</b><span>de livraison</span></div>
        ${money ? `<div><em>Franco</em><b class="mono">${c.minHT ? acEur(c.minHT, 0) : "Aucun"}</b><span>minimum HT</span></div>` : ""}
        <div><em>Paiement</em><b>${esc(d.payTerms || "–")}</b><span>${d.account ? `n° client <span class="mono">${esc(d.account)}</span>` : ""}</span></div>
      </div></div>`;
    const card = `<div class="glass pad st" style="--i:4"><span class="lbl">Coordonnées</span>
      ${row("foPhone", "Téléphone", c.phone ? `<a href="tel:${esc(foTel(c.phone))}" class="mono">${esc(c.phone)}</a>` : "")}
      ${row("acMail", "E-mail", c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "")}
      ${row("foPin", "Adresse", d.address ? `<a href="${esc(foMaps(d.address))}" target="_blank" rel="noopener">${esc(d.address)}</a>` : "")}
      ${row("foGlobe", "Site", d.website ? `<a href="${esc(foSite(d.website))}" target="_blank" rel="noopener">${esc(foHost(d.website))}</a>` : "")}
      ${!c.phone && !c.email && !d.address ? `<p class="note">Aucune coordonnée pour l'instant.</p><button class="btn soft block" data-act="foEdit" data-v="${esc(s.key)}">${ico("plus")}Ajouter les coordonnées</button>` : ""}
      ${d.notes ? `<div class="fo-notes">${ico("foNote")}<p>${esc(d.notes)}</p></div>` : ""}
      <div class="grid2 fo-share"><button class="btn soft sm" data-act="foVcf" data-v="${esc(s.key)}">${ico("foCard")}Aux contacts</button><button class="btn soft sm" data-act="foShare" data-v="${esc(s.key)}">${ico("share")}Partager</button></div>
    </div>`;
    const figs = money && (Object.keys(by).length || st.recs.length) ? `<div class="glass pad st" style="--i:5"><span class="lbl">Achats</span>
      <div class="fo-figs"><div><em>Ce mois</em><b class="mono">${acEur(by[m0] || 0, 0)}</b>${by[m1] ? `<span class="${(by[m0] || 0) > by[m1] ? "up" : "dn"}">${acEur(by[m1], 0)} le mois dernier</span>` : ""}</div><div><em>12 mois</em><b class="mono">${acEur(y12, 0)}</b><span>HT</span></div></div>
      ${foBars(by)}</div>` : "";
    const qual = st.recent.length || st.deliv ? `<div class="glass pad st" style="--i:6"><span class="lbl">Fiabilité · 90 jours</span>
      <div class="fo-q">
        <div><b class="mono">${st.recent.length}</b><em>livraison${st.recent.length > 1 ? "s" : ""}</em></div>
        ${st.deliv ? `<div class="${st.full === st.deliv ? "ok" : "warn"}"><b class="mono">${Math.round((st.full / st.deliv) * 100)} %</b><em>commandes livrées en entier</em></div>` : ""}
        <div class="${st.refused ? "bad" : "ok"}"><b class="mono">${st.refused}</b><em>produit${st.refused > 1 ? "s" : ""} refusé${st.refused > 1 ? "s" : ""}</em></div>
      </div>
      ${st.lastRec ? `<p class="note fo-last">Dernière réception ${when(st.lastRec.at)}</p>` : ""}</div>` : "";
    const prices = st.lastP.length && money ? `<div class="glass pad st" style="--i:7"><span class="lbl">Prix qui ont bougé</span>${st.lastP.slice(0, 5).map((h) => `<div class="li"><div class="tx"><b>${esc(h.name || "")}</b><em>${shortDate(h.day)} · ${acEur(h.prev)} → ${acEur(h.price)}${h.unit ? ` / ${esc(h.unit)}` : ""}</em></div><span class="fo-pct ${h.pct > 0 ? "up" : "dn"} mono">${ico(h.pct > 0 ? "foUp" : "foDown")}${Math.abs(Math.round(h.pct * 10) / 10).toString().replace(".", ",")} %</span></div>`).join("")}</div>` : "";
    const prods = s.products.length ? `<div class="glass pad st" style="--i:8"><div class="row"><span class="lbl">Produits</span><span class="sub">${s.products.length}</span></div>${s.products.slice().sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, S.ui.foAllP ? 999 : 8).map((p) => { const pr = acPrice(p); const lv = acStock(p); return `<div class="li"><div class="tx"><b>${esc(p.name)}</b><em>${lv != null ? `En stock ${acQty(Math.max(0, lv), p.unit)}` : "Pas encore compté"}</em></div>${money && pr ? `<span class="mono fo-pr">${acEur(pr)}<em>/${esc(p.unit || "u")}</em></span>` : ""}</div>`; }).join("")}${s.products.length > 8 && !S.ui.foAllP ? `<button class="btn ghost sm block" data-act="foAllP">Voir les ${s.products.length} produits</button>` : ""}</div>` : "";
    const noProd = !s.products.length ? `<div class="glass empty st" style="--i:8"><div class="ic">${ico("acBox")}</div><b>Aucun produit relié</b>Dans Stock › Catalogue, choisissez ${esc(s.name)} comme fournisseur de vos produits : prix, stock et commandes suivront.<div style="margin-top:14px"><button class="btn soft" data-act="acNoSupGo">Ouvrir le catalogue</button></div></div>` : "";
    const ev = [];
    st.ords.forEach((o) => ev.push({ at: o.sentAt || o.at, ic: "acSend", t: o.status === "annulee" ? "Commande annulée" : "Commande envoyée", s: `${(o.lines || []).length} produit${(o.lines || []).length > 1 ? "s" : ""}${money && o.totalHT ? ` · ${acEur(o.totalHT, 0)}` : ""}`, act: "acOrd", id: o.id }));
    st.recs.slice(0, 12).forEach((r) => { const ref = (r.lines || []).filter((L) => L.decision === "refuse" || L.refused).length; ev.push({ at: r.at, ic: "truck", t: "Livraison reçue", s: `${(r.lines || []).length} produit${(r.lines || []).length > 1 ? "s" : ""}${r.bl ? ` · BL ${esc(r.bl)}` : ""}${ref ? ` · <span class="fo-bad">${ref} refusé${ref > 1 ? "s" : ""}</span>` : ""}`, tone: ref ? "bad" : "ok" }); });
    (S.invoices || []).filter((f) => acKey(f.supplier) === s.key).forEach((f) => ev.push({ at: f.at || parseDay(f.day).getTime(), ic: "receipt", t: `Facture${f.number ? " " + esc(f.number) : ""}`, s: money && f.totalHT ? acEur(f.totalHT) + " HT" : "" }));
    ev.sort((a, b) => b.at - a.at);
    const hist = ev.length ? `<div class="glass pad st" style="--i:9"><span class="lbl">Historique</span><div class="fo-tl">${ev.slice(0, S.ui.foHist || 8).map((e) => `<div class="fo-ev${e.tone ? " " + e.tone : ""}${e.act ? " tap" : ""}" ${e.act ? `data-act="${e.act}" data-id="${e.id}" role="button" tabindex="0"` : ""}><span class="fo-evi">${ico(e.ic)}</span><div class="tx"><b>${e.t}</b><em>${when(e.at)}${e.s ? ` · ${e.s}` : ""}</em></div></div>`).join("")}</div>${ev.length > (S.ui.foHist || 8) ? `<button class="btn ghost sm block" data-act="foMoreH">Voir plus</button>` : ""}</div>` : "";
    return `<div class="inner fo">${topBar("Fiche fournisseur", { right: `<button class="iconbtn" data-act="foEdit" data-v="${esc(s.key)}" aria-label="Modifier">${ico("edit")}</button>` })}
      <div class="cols"><div>${head}${order}${deliv}${card}</div><div>${figs}${qual}${prices}${prods}${noProd}${hist}
        ${d.archived ? `<button class="btn soft block st" style="--i:10" data-act="foArch" data-v="${esc(s.key)}">Remettre dans l'annuaire</button>` : ""}</div></div></div>`;
  },
  after() { if (typeof acTicker === "function") acTicker(); },
};

/* ───────── edit sheet ───────── */
function foSheet(k) {
  const s = (k && foOf(k)) || { key: "", name: "", doc: null, products: [] }; const c = acCfg(s); const d = s.doc || {};
  const F = (FO.F ||= { k, days: c.daysFrom === "default" && !s.doc ? [] : c.days.slice(), lead: c.lead, cat: d.cat || (s.name ? foGuess(s.name) : ""), pay: d.payTerms || "" });
  const v = (x) => esc(x || "");
  return `<div class="fo-sf">
    <div class="fo-sf-h">${acSupMark(s.name || "?", 52)}<div><b class="h3">${esc(s.name || "Nouveau fournisseur")}</b><em>${s.products.length ? `${s.products.length} produit${s.products.length > 1 ? "s" : ""} au catalogue` : "Carnet de fournisseurs"}</em></div></div>
    <label class="field"><span>Nom</span><input class="input" id="foN" value="${v(s.name)}" placeholder="Ex. : Marée Atlantique" autocomplete="off"></label>
    <div class="field"><span>Catégorie</span><div class="fo-cats">${FO_CATS.map(([id, t, col]) => `<button class="chip${F.cat === id ? " on" : ""}" data-act="foSCat" data-v="${id}"><i class="fo-dot" style="--c:${col}"></i>${t}</button>`).join("")}</div></div>
    <div class="fo-sec">Contact</div>
    <div class="grid2"><label class="field"><span>Prénom du contact</span><input class="input" id="foCt" value="${v(c.contact)}" placeholder="Ex. : Julien" autocomplete="off"></label>
      <label class="field"><span>Téléphone</span><input class="input mono" id="foPh" type="tel" inputmode="tel" value="${v(c.phone)}" placeholder="06…" autocomplete="off"></label></div>
    <label class="field"><span>E-mail des commandes</span><input class="input" id="foMail" type="email" inputmode="email" value="${v(c.email)}" placeholder="commandes@…" autocomplete="off"></label>
    <label class="field"><span>Adresse</span><input class="input" id="foAd" value="${v(d.address)}" placeholder="Rue, code postal, ville" autocomplete="off"></label>
    <div class="grid2"><label class="field"><span>Site web</span><input class="input" id="foWeb" inputmode="url" value="${v(d.website)}" placeholder="www…" autocomplete="off"></label>
      <label class="field"><span>N° client</span><input class="input mono" id="foAcc" value="${v(d.account)}" placeholder="Facultatif" autocomplete="off"></label></div>
    <div class="fo-sec">Livraisons</div>
    <div class="field"><span>Jours de livraison</span><div class="ac-days">${AC_WEEK.map((w) => `<button class="ac-day${F.days.includes(w) ? " on" : ""}" data-act="foSDay" data-v="${w}" aria-pressed="${F.days.includes(w)}">${AC_DL[w]}</button>`).join("")}</div></div>
    <div class="grid2"><label class="field"><span>Livré entre</span><input class="input mono" id="foW1" type="time" value="${v(d.winFrom)}"></label><label class="field"><span>et</span><input class="input mono" id="foW2" type="time" value="${v(d.winTo)}"></label></div>
    <div class="grid2"><label class="field"><span>Commander avant</span><input class="input mono" id="foCut" type="time" value="${v(c.cutoff)}"></label>
      <div class="field"><span>Délai</span><div class="seg fo-seg">${[[0, "Jour même"], [1, "La veille"], [2, "2 jours"]].map(([x, t]) => `<button class="${F.lead === x ? "on" : ""}" data-act="foSLead" data-v="${x}">${t}</button>`).join("")}</div></div></div>
    ${acMoney() ? `<label class="field"><span>Franco de port <em class="ac-opt">minimum de commande, € HT</em></span><input class="input mono" id="foMin" inputmode="decimal" value="${c.minHT ? acN(c.minHT) : ""}" placeholder="Aucun"></label>
    <div class="field"><span>Paiement</span><div class="fo-cats">${FO_PAY.map((p) => `<button class="chip${F.pay === p ? " on" : ""}" data-act="foSPay" data-v="${esc(p)}">${p}</button>`).join("")}</div></div>` : ""}
    <label class="field"><span>Notes</span><textarea class="input" id="foNotes" rows="3" placeholder="Ex. : livrer par la cour, arrivage le mardi…">${v(d.notes)}</textarea></label>
    <button class="btn acc block" data-act="foSave" data-v="${esc(k || "")}">Enregistrer</button>
    ${s.doc ? `<button class="btn ghost block fo-arch" data-act="foArch" data-v="${esc(k)}">${d.archived ? "Remettre dans l'annuaire" : "Retirer de l'annuaire"}</button>` : ""}
  </div>`;
}

function foVcf(s) {
  const c = acCfg(s); const d = s.doc || {}; const e = (x) => String(x || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${e(c.contact ? `${c.contact} (${s.name})` : s.name)}`, `ORG:${e(s.name)}`, c.contact ? `N:;${e(c.contact)};;;` : `N:${e(s.name)};;;;`,
    c.phone ? `TEL;TYPE=WORK,VOICE:${foTel(c.phone)}` : "", c.email ? `EMAIL;TYPE=WORK:${e(c.email)}` : "", d.address ? `ADR;TYPE=WORK:;;${e(d.address)};;;;` : "", d.website ? `URL:${e(foSite(d.website))}` : "",
    `NOTE:${e([`Fournisseur de ${S.resto ? S.resto.name : "notre restaurant"}`, d.account ? `N° client ${d.account}` : "", d.notes || ""].filter(Boolean).join(" · "))}`, "END:VCARD"].filter(Boolean).join("\r\n");
}
function foText(s) {
  const c = acCfg(s); const d = s.doc || {};
  return [s.name, foCat(foCatOf(s))[1], c.contact && `Contact : ${c.contact}`, c.phone && `Tél. : ${c.phone}`, c.email && `E-mail : ${c.email}`, d.address && `Adresse : ${d.address}`, d.account && `N° client : ${d.account}`,
    `Livraisons : ${AC_WEEK.filter((w) => c.days.includes(w)).map((w) => DAYS[w]).join(", ")}${d.winFrom ? ` (${d.winFrom}–${d.winTo || ""})` : ""}`, `Commander avant ${c.cutoff}${c.lead === 1 ? " la veille" : c.lead > 1 ? ` (${c.lead} jours avant)` : ""}`,
    c.minHT && acMoney() ? `Franco : ${acEur(c.minHT, 0)} HT` : "", d.notes].filter(Boolean).join("\n");
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  foOpen: (a, id, v) => { SFX.tap(); S.ui.foAllP = false; S.ui.foHist = 8; go("fournisseur", { k: v }); },
  foTap: () => { SFX.tap(); buzz(4); },
  foDay: (a, id, v) => { SFX.tick(); buzz(3); FO.day = FO.day === v ? null : v; refresh(true); },
  foCatF: (a, id, v) => { SFX.tick(); FO.cat = FO.cat === v ? "" : v; refresh(true); },
  foClear: () => { FO.q = ""; FO.cat = ""; FO.day = null; refresh(true); },
  foAllP: () => { S.ui.foAllP = true; refresh(true); },
  foMoreH: () => { S.ui.foHist = (S.ui.foHist || 8) + 12; refresh(true); },
  /* one tap: the prepared order goes straight to the send sheet (e-mail, SMS, WhatsApp, PDF); else the order page */
  foOrder: (a, id, v) => {
    const s = foOf(v); if (!s) return; const pl = foPlan(s);
    if (pl && pl.on.length && typeof ACT.acSendAsk === "function") { ACT.acSendAsk(a, null, s.key); return; }
    SFX.tap(); go("achat", { k: s.key });
  },
  foFav: async (a, id, v) => {
    const s = foOf(v); if (!s) return; const on = !(s.doc && s.doc.fav); SFX.tick(); buzz(on ? [6, 30, 10] : 4);
    a.classList.toggle("on", on); a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop");
    try { if (s.doc) await safe(DB.update("suppliers", s.doc.id, { fav: on })); else await safe(DB.add("suppliers", { name: s.name, cat: foGuess(s.name), fav: on, createdAt: Date.now() })); } catch (e) {}
  },
  foEdit: (a, id, v) => { SFX.tap(); FO.F = null; openSheet(foSheet(v || "")); },
  foSCat: (a, id, v) => { const F = FO.F; if (!F) return; F.cat = v; $$(".fo-sf .fo-cats [data-act=foSCat]").forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); },
  foSPay: (a, id, v) => { const F = FO.F; if (!F) return; F.pay = F.pay === v ? "" : v; $$(".fo-sf [data-act=foSPay]").forEach((b) => b.classList.toggle("on", b.dataset.v === F.pay)); SFX.tick(); },
  foSDay: (a, id, v) => { const F = FO.F; if (!F) return; const w = +v; F.days = F.days.includes(w) ? F.days.filter((x) => x !== w) : [...F.days, w].sort(); a.classList.toggle("on"); a.setAttribute("aria-pressed", F.days.includes(w)); a.classList.remove("bump"); void a.offsetWidth; a.classList.add("bump"); SFX.tick(); buzz(3); },
  foSLead: (a, id, v) => { const F = FO.F; if (!F) return; F.lead = +v; $$(".fo-seg button").forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); },
  foSave: async (a, id, v) => {
    const F = FO.F; if (!F) return; const val = (sel) => (($(sel) || {}).value || "").trim();
    const name = val("#foN"); if (!name) { const e = $("#foN"); if (e) { e.focus(); e.classList.add("shake"); setTimeout(() => e.classList.remove("shake"), 500); } SFX.err(); return; }
    const old = v ? foOf(v) : null; const clash = foAll(true).find((s) => s.key === acKey(name) && s.doc && (!old || !old.doc || s.doc.id !== old.doc.id));
    if (clash) { SFX.err(); toast(`${clash.name} est déjà dans l'annuaire.`, "err"); return; }
    const d = { name, cat: F.cat || foGuess(name), contact: val("#foCt"), phone: val("#foPh"), email: val("#foMail"), address: val("#foAd"), website: val("#foWeb"), account: val("#foAcc"),
      cutoff: val("#foCut") || "18:00", leadDays: F.lead, winFrom: val("#foW1"), winTo: val("#foW2"), notes: val("#foNotes"), updatedAt: Date.now() };
    if (F.days.length) d.deliveryDays = F.days;
    if ($("#foMin")) { const mn = num(val("#foMin")); d.minOrderHT = mn > 0 ? mn : null; d.payTerms = F.pay || ""; }
    a.disabled = true;
    try {
      if (old && old.doc) await safe(DB.update("suppliers", old.doc.id, d));
      else await safe(DB.add("suppliers", { ...d, createdAt: Date.now() }));
      /* renamed: the products keep pointing at it */
      if (old && old.name !== name) await Promise.all(S.products.filter((p) => acKey(p.supplier) === old.key).map((p) => DB.update("products", p.id, { supplier: name }).catch(() => {})));
    } catch (e) { a.disabled = false; return; }
    logEvent("supplier", `${old ? "a modifié" : "a ajouté"} le fournisseur ${name}`);
    FO.F = null; closeSheet(); SFX.ok(); buzz([6, 30, 10]); toast(`${name} enregistré`);
    if (!old || old.key !== acKey(name)) setTimeout(() => go("fournisseur", { k: acKey(name) }, { replace: S.route === "fournisseur" }), 260);
  },
  foArch: async (a, id, v) => {
    const s = foOf(v); if (!s || !s.doc) return; const on = !s.doc.archived;
    if (on && !a.dataset.sure) { a.dataset.sure = "1"; a.textContent = "Confirmer : retirer de l'annuaire"; SFX.tap(); return; }
    await safe(DB.update("suppliers", s.doc.id, { archived: on })).catch(() => {}); closeSheet(); SFX.ok();
    if (on) { toast(`${s.name} retiré de l'annuaire`); go("fournisseurs", {}, { replace: true }); } else toast(`${s.name} est de retour`);
  },
  foVcf: (a, id, v) => {
    const s = foOf(v); if (!s) return; SFX.tap(); const blob = new Blob([foVcf(s)], { type: "text/vcard" }); const name = `${s.name.replace(/[^\p{L}\p{N} -]/gu, "").trim() || "fournisseur"}.vcf`;
    try { const f = new File([blob], name, { type: "text/vcard" }); if (navigator.canShare && navigator.canShare({ files: [f] }) && (IS_IOS || matchMedia("(pointer:coarse)").matches)) { navigator.share({ files: [f], title: s.name }).catch(() => {}); return; } } catch (e) {}
    const u = URL.createObjectURL(blob); const l = document.createElement("a"); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast("Contact téléchargé");
  },
  foShare: async (a, id, v) => {
    const s = foOf(v); if (!s) return; SFX.tap(); const txt = foText(s);
    if (navigator.share) { try { await navigator.share({ title: s.name, text: txt }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(txt); toast("Fiche copiée"); } catch (e) { toast("Copie impossible sur cet appareil", "err"); }
  },
});
