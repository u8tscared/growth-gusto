// Vérifications propres à chaque restaurant simulé (attentes de tools/sim/profiles.js) + quelques-unes communes à tous.
// Chaque vérification rend { id, ok, titre, detail } ; ok:false = problème vu par ce restaurant.
const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };

const COMMON = {
  /* le menu respecte les fonctionnalités coupées par le restaurant */
  async modulesCoupes(page, P) {
    if (!P.sansModules.length) return null;
    const r = await page.evaluate((off) => { const nav = esNavRoutes(); const vis = off.filter((x) => nav.includes(x)); go("home"); const t = document.querySelector("#viewport .view").innerText; return { vis, home: t.slice(0, 4000) }; }, P.sansModules);
    const words = { resa: /réservation/i, salle: /prise de commande/i, plan: /plan de salle/i, commandes: /commande(s)? en ligne/i, reception: /Réception en cours|Enregistrer une réception/, clients: /fidélité/i, cuisine: /écran cuisine/i };
    const leak = P.sansModules.filter((m) => words[m] && words[m].test(r.home)).map((m) => m + " (« " + (r.home.split("\n").find((l) => words[m].test(l)) || "").slice(0, 80) + " »)");
    return { ok: !r.vis.length && !leak.length, titre: "Fonctionnalités coupées vraiment absentes", detail: r.vis.length ? "encore dans le menu : " + r.vis.join(", ") : leak.length ? "l'accueil parle encore de : " + leak.join(", ") : "menu et accueil propres" };
  },
  /* le créneau du relevé (midi / soir) colle aux heures réelles du restaurant */
  async creneaux(page, P) {
    const hours = P.services.flatMap((s) => s.split("-").map((x) => +x.split(":")[0]));
    const r = await page.evaluate((hs) => { const G = Date.prototype.getHours; const out = {}; hs.forEach((h) => { Date.prototype.getHours = function () { return h; }; try { out[h] = slotNow(); } catch (e) { out[h] = "err"; } }); Date.prototype.getHours = G; return out; }, hours);
    const bad = Object.entries(r).filter(([h, s]) => (+h < 5 && s === "midi") || (+h >= 5 && +h < 11 && s === "midi" && P.services.some((x) => /^0[5-9]/.test(x))));
    return { ok: !bad.length, titre: "Créneaux de relevé (midi/soir) adaptés aux horaires", detail: bad.length ? "à " + bad.map(([h, s]) => h + " h → « " + s + " »").join(", ") + " alors que le service est " + P.services.join(" / ") : JSON.stringify(r) };
  },
};

const SPECIFIC = {
  async packPro(page) {
    const r = await page.evaluate(() => ["planning", "pointeuse", "finance", "staff"].map((x) => { try { go(x); } catch (e) { return [x, "err " + e.message]; } const v = document.querySelector("#viewport .view"); return [x, v.querySelector(".ab-up") ? "carte « passer au pack Chef »" : S.route === "locked" ? "verrouillé" : "ouvert"]; }));
    const nav = await page.evaluate(() => esNavRoutes());
    const shown = r.filter(([x, s]) => s !== "ouvert" && nav.includes(x)).map(([x]) => x);
    return { ok: true, info: true, titre: "Pack Second : planning et pointeuse", detail: r.map((x) => x.join(" : ")).join(" · ") + (shown.length ? " · visibles dans le menu malgré le pack : " + shown.join(", ") : "") };
  },
  async packCommis(page) {
    const r = await page.evaluate(() => { const nav = esNavRoutes(); return nav.filter((x) => typeof abHas === "function" && !abHas(x)).map((x) => { go(x); return [x, !!document.querySelector("#viewport .view .ab-up")]; }); });
    const sans = r.filter((x) => !x[1]);
    return { ok: !sans.length, titre: "Pack Commis : les écrans du pack supérieur montrent une carte claire", detail: r.length + " écrans du menu hors pack (" + r.map((x) => x[0]).join(", ") + ")" + (sans.length ? " · sans carte : " + sans.map((x) => x[0]).join(", ") : "") };
  },
  async essaiFini(page) {
    const r = await page.evaluate(async () => { const p = abPlan(); go("home"); const t = document.querySelector("#viewport .view").innerText; let wrote = true; try { await DB.add("readings", { fridgeId: S.fridges[0] && S.fridges[0].id, temp: 3, day: dayKey(), slot: "midi", at: Date.now() }); } catch (e) { wrote = false; } go("registre"); const reg = document.querySelector("#viewport .view").innerText.length; return { plan: p.plan, open: p.open, home: t.slice(0, 300), wrote, reg }; });
    return { ok: r.plan === "expire" && r.reg > 100, titre: "Essai terminé : données visibles, écriture bloquée", detail: `plan ${r.plan}, écriture ${r.wrote ? "acceptée" : "refusée"}, registre lisible ${r.reg > 100 ? "oui" : "non"} · accueil : ${r.home.replace(/\s+/g, " ").slice(0, 160)}` };
  },
  async apresMinuit(page) {
    const r = await page.evaluate(async () => {
      const sid = (S.staff.find((s) => s.active) || {}).id; if (!sid) return { skip: true };
      const d = addDays(dayKey(), -3), d2 = addDays(d, 1);
      const a = parseDay(d); a.setHours(18, 0, 0, 0); const b = parseDay(d2); b.setHours(2, 15, 0, 0);
      await DB.add("punches", { staffId: sid, kind: "in", at: a.getTime(), day: d, by: "sim" }); await DB.add("punches", { staffId: sid, kind: "out", at: b.getTime(), day: d, by: "sim" });
      await new Promise((r) => setTimeout(r, 300));
      const dm = rhDayMin(sid, d, d2); const ses = ((dm[d] || {}).sessions || []).find((x) => x.in === a.getTime()); const sh = rhShiftMin({ day: d, start: "18:00", end: "02:00", breakMin: 30 });
      return { min: ses ? ses.w / 60000 : 0, anomalies: (dm[d] || {}).anomalies, sh };
    });
    if (r.skip) return null;
    return { ok: Math.round(r.min) === 495 && r.sh === 450, titre: "Service qui finit à 2 h : heures pointées et planning", detail: `pointé 18 h → 2 h 15 : ${Math.round(r.min || 0)} min (attendu 495) · créneau 18 h–2 h pause 30 : ${r.sh} min (attendu 450)` };
  },
  async marques(page, P) {
    const r = await page.evaluate(() => { const txt = []; ["livraison", "dashboard", "notes", "marges"].forEach((x) => { try { go(x); txt.push(document.querySelector("#viewport .view").innerText); } catch (e) {} }); const all = txt.join(" "); return { brand: /\bmarque|enseigne|concept\b/i.test(all) }; });
    return { ok: r.brand, titre: "Plusieurs marques dans une seule cuisine (" + P.marques.join(", ") + ")", detail: r.brand ? "notion de marque trouvée" : "aucune notion de marque : chiffre, carte, fiches et livraisons ne se séparent pas par marque" };
  },
  async pointsDeVente(page, P) { return SPECIFIC.marques(page, P).then((x) => ({ ...x, titre: "Plusieurs points de vente au même endroit (" + P.marques.join(", ") + ")" })); },
  async multiSites(page, P) {
    const r = await page.evaluate(() => { const n = S.restos.length; try { go("sites"); } catch (e) { return { n, err: e.message }; } const t = document.querySelector("#viewport .view").innerText; return { n, names: S.restos.map((x) => x.name), seen: S.restos.filter((x) => t.includes(x.name)).length }; });
    return { ok: !r.err && r.seen === r.n && r.n === P.sites.length, titre: "Mes établissements : les " + P.sites.length + " sites comparés", detail: r.err ? r.err : `${r.n} restaurants sur l'appareil, ${r.seen} visibles dans la comparaison` };
  },
  async employeDeuxSites(page) {
    return { ok: false, info: true, titre: "Une personne qui travaille sur deux sites", detail: "chaque restaurant a sa propre fiche, son planning et sa pointeuse : la même serveuse a deux fiches et ses heures ne s'additionnent pas pour les heures sup" };
  },
  async grosseEquipe(page, P) {
    const r = await page.evaluate(async () => { const out = {}; for (const x of ["planning", "pointeuse", "equipe", "staff"]) { const t = performance.now(); try { go(x); } catch (e) { out[x] = "err"; continue; } await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); out[x] = Math.round(performance.now() - t); } return { out, n: S.members.length, st: S.staff.length }; });
    const slow = Object.entries(r.out).filter(([, v]) => v === "err" || v > 400);
    return { ok: !slow.length, titre: "Équipe de " + P.equipe.length + " personnes : planning, pointeuse, équipe", detail: Object.entries(r.out).map(([k, v]) => k + " " + v + " ms").join(" · ") + ` (${r.n} comptes, ${r.st} fiches)` };
  },
  async fortVolume(page) {
    const r = await page.evaluate(async () => { const out = {}; for (const x of ["home", "registre", "dashboard", "stock", "releve", "frigos"]) { const t = performance.now(); try { go(x); } catch (e) { out[x] = "err"; continue; } await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); out[x] = Math.round(performance.now() - t); } return { out, kb: Math.round((localStorage.getItem("gg-local") || "").length / 1024) }; });
    const slow = Object.entries(r.out).filter(([, v]) => v === "err" || v > 500);
    return { ok: !slow.length, titre: "Gros volume : écrans qui restent rapides", detail: Object.entries(r.out).map(([k, v]) => k + " " + v + " ms").join(" · ") + " · données sur l'appareil " + r.kb + " Ko" };
  },
  async beaucoupDeTables(page, P) {
    const r = await page.evaluate(() => { const o = {}; for (const x of ["plan", "salle"]) { try { go(x); } catch (e) { o[x] = "err " + e.message; continue; } const v = document.querySelector("#viewport .view"); o[x] = v.querySelectorAll("[data-id]").length; } return o; });
    return { ok: !Object.values(r).some((v) => String(v).startsWith("err")), titre: P.tables + " tables : plan de salle et prise de commande", detail: JSON.stringify(r) };
  },
  async sansSalle() { return null; },
  async sansResa() { return null; },
  async nouveauClient(page, P, device, errs, H, setup) {
    const r = await page.evaluate(() => { go("home"); const v = document.querySelector("#viewport .view"); return { todo: /bien démarrer|À faire/i.test(v.innerText), cards: v.querySelectorAll(".glass").length, len: v.innerText.length }; });
    return { ok: r.todo, titre: "Nouveau client : premiers pas après la prise en main", detail: `carte « À faire pour bien démarrer » ${r.todo ? "présente" : "absente"}, ${r.cards} cartes sur l'accueil` };
  },
  async unTelephone(page, P, device, errs, H) {
    if (device !== "phone") return null;
    await H.ctx.setOffline(true);
    const before = errs.length; const bad = [];
    for (const x of ["releve", "scan", "reception", "tickets", "menage", "home"]) { const v = await H.visit(page, x, errs, 350); if (v.err) bad.push(x + " : " + v.err); }
    await H.ctx.setOffline(false);
    const e = errs.slice(before);
    return { ok: !bad.length && !e.length, titre: "Sans réseau (camion en bord de route)", detail: bad.concat(e).join(" · ") || "relevé, scan, réception, tickets, ménage s'ouvrent hors ligne" };
  },
  async tabletteFamille(page) {
    const r = await page.evaluate(() => { go("home"); const v = document.querySelector("#viewport .view"); const btns = [...v.querySelectorAll("button,[data-go],[data-act]")].filter((e) => e.getBoundingClientRect().width); return { n: btns.length, words: v.innerText.split(/\s+/).length }; });
    return { ok: r.n <= 25, titre: "Accueil simple pour une personne peu à l'aise", detail: `${r.n} boutons et ${r.words} mots sur l'accueil` };
  },
  async allergenes(page) {
    const r = await page.evaluate(() => { const n = S.notes.filter((x) => (x.kind || x.type) !== "proc"); const w = n.filter((x) => typeof recipeAllergens === "function" && recipeAllergens(x).length).length; return { n: n.length, w }; });
    return { ok: r.w > 0, titre: "Allergènes des fiches", detail: `${r.w} fiches sur ${r.n} avec des allergènes` };
  },
  async extras(page, P) {
    const r = await page.evaluate(() => { go("equipe"); const t = document.querySelector("#viewport .view").innerText; return { bulk: /plusieurs|importer|en une fois|liste/i.test(t), extras: S.staff.filter((s) => s.contract === "Extra").length }; });
    return { ok: r.bulk, info: !r.bulk, titre: "Ajouter " + P.extras + " extras / saisonniers d'un coup", detail: r.bulk ? "ajout groupé proposé" : `pas d'ajout groupé repéré dans Équipe : il faut les créer un par un (${r.extras} fiches Extra en place)` };
  },
  async saisonniers(page, P) { return SPECIFIC.extras(page, P); },
  async petitDej(page, P) {
    const r = await page.evaluate(() => { const G = Date.prototype.getHours; Date.prototype.getHours = () => 7; const s = slotNow(); Date.prototype.getHours = G; return s; });
    return { ok: false, info: true, titre: "Trois services (petit-déjeuner, midi, soir)", detail: `le relevé de 7 h est rangé en « ${r} » : l'app ne connaît que midi et soir (relevés, ménage, notifications de fin de service)` };
  },
  async serviceContinu(page, P) {
    return { ok: false, info: true, titre: "Ouverture continue (" + P.services.join(", ") + ")", detail: "relevés et ménage restent découpés en midi / soir (coupure fixe à 16 h)" };
  },
  async beaucoupDeFrigos(page, P) {
    const r = await page.evaluate(async () => { go("releve"); await new Promise((r) => setTimeout(r, 300)); const v = document.querySelector("#viewport .view"); return { n: S.fridges.length, h: Math.round(v.scrollHeight / innerHeight * 10) / 10 }; });
    return { ok: r.h < 6, titre: r.n + " équipements à relever", detail: `le relevé fait ${r.h} hauteurs d'écran` };
  },
  async semaineSeulement(page) {
    const r = await page.evaluate(() => { go("registre"); const t = document.querySelector("#viewport .view").innerText; let k = dayKey(); while (parseDay(k).getDay() !== 0) k = addDays(k, -1); return { manque: (t.match(/manquant|oubli|non fait|pas fait/gi) || []).length, ferme: typeof ggClosed === "function" ? ggClosed(k) : /fermé|jour de fermeture|fermeture/i.test(t) }; });
    return { ok: r.ferme, info: true, titre: "Fermé le week-end", detail: r.ferme ? "jours de fermeture reconnus" : `pas de jours de fermeture dans le registre : samedi et dimanche sans relevé comptent comme des oublis (${r.manque} mentions d'oubli)` };
  },
  async vitrines(page) { const r = await page.evaluate(() => S.fridges.filter((f) => f.type === "vitrine").length); return { ok: r > 0, titre: "Vitrines réfrigérées", detail: r + " vitrines relevées" }; },
};

module.exports = {
  async run(page, P, device, errs, H) {
    const out = [];
    const list = [...Object.keys(COMMON).map((k) => [k, COMMON[k]]), ...P.attentes.filter((k) => SPECIFIC[k]).map((k) => [k, SPECIFIC[k]])];
    for (const [id, fn] of list) {
      const before = errs.length;
      try { const r = await fn(page, P, device, errs, H); if (r) out.push({ id, ...r, errs: errs.slice(before) }); }
      catch (e) { out.push({ id, ok: false, titre: id, detail: "la vérification a planté : " + e.message.slice(0, 300) }); }
    }
    return out;
  },
};
