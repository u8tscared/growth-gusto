/* Growth Gusto — demo seed (loaded only when someone taps « Essayer la démo »). « Le Bistrot Démo »: a full, realistic restaurant,
   dated relative to today, following the V3 data contract (tools/BRIEF.md). Kept in memory only: DB.mode = "demo" never persists. */
window.GG_DEMO = {
  rid: "demo",
  build() {
    const RID = this.rid, P = (c) => `restos/${RID}/${c}`, D = {};
    let seed = 20261104; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
    const today = dayKey(), now = Date.now();
    const at = (day, h, m = 0) => { const d = parseDay(day); d.setHours(h, m, Math.floor(rnd() * 50), 0); return d.getTime(); };
    let n = 0; const id = (p) => `${p}${(++n).toString(36).padStart(3, "0")}`;
    const put = (col, doc, key) => { const k = key || id(col.slice(0, 2)); (D[P(col)] ||= {})[k] = doc; return k; };
    const days = (k) => Array.from({ length: k }, (_, i) => addDays(today, -i)); /* today first */
    const hourNow = new Date().getHours();

    /* ── restaurant + team ── */
    D.restos = { [RID]: { name: "Le Bistrot Démo", type: "bistrot", owner: "demo-camille", plan: "essai", createdAt: now - 420 * 864e5, demo: true } };
    const team = [
      ["demo-camille", "Camille Laurent", "gerant", "#4A1FE6", "Gérant", "CDI", 39, 0, "salle"],
      ["demo-thomas", "Thomas Girard", "chef", "#E0752F", "Chef de cuisine", "CDI", 42, 19.5, "cuisine"],
      ["demo-ines", "Inès Benali", "chef", "#D63A7A", "Second", "CDI", 39, 15.8, "cuisine"],
      ["demo-lucas", "Lucas Petit", "equipe", "#0B9B6A", "Commis", "CDD", 35, 12.4, "cuisine"],
      ["demo-sarah", "Sarah Lemoine", "equipe", "#1F7AE0", "Serveur", "CDI", 35, 12.6, "salle"],
      ["demo-hugo", "Hugo Martin", "equipe", "#0E8C9E", "Plongeur", "Extra", 20, 12.1, "plonge"],
    ];
    team.forEach(([mid, name, role, color], i) => put("members", { name, role, color, joinedAt: now - (400 - i * 40) * 864e5, email: mid === "demo-camille" ? "camille@bistrot-demo.fr" : "" }, mid));
    const staffIds = {};
    team.forEach(([mid, name, , color, jobRole, contract, weeklyHours, hourlyGross, post], i) => {
      staffIds[mid] = put("staff", { memberId: mid, name, role: jobRole, color, contract, weeklyHours, hourlyGross: hourlyGross || 24, chargesPct: contract === "Extra" ? 30 : 42, active: true, start: addDays(today, -(400 - i * 40)), post }, "s_" + mid);
    });
    const who = team.map((t) => t[0]), cooks = ["demo-thomas", "demo-ines", "demo-lucas"];

    /* ── fridges + 30 days of readings (a few non-conformities, with the corrective action) ── */
    const F = [
      ["fr-cf", "Chambre froide", "cfp", 0, 2, 1.1, 0.4],
      ["fr-s1", "Frigo de service 1", "service", 0, 4, 2.6, 0.5],
      ["fr-s2", "Frigo de service 2", "service", 0, 4, 2.8, 0.5],
      ["fr-cg", "Congélateur", "congel", -40, -18, -21, 1.2],
    ];
    F.forEach(([k, name, type, min, max], i) => put("fridges", { name, type, min, max, ...(type === "service" ? { role: "service", svcMax: 8 } : { role: type === "cfp" ? "stock" : undefined }), order: i, createdAt: now - 400 * 864e5 + i }, k));
    const bad = { 3: ["fr-s1", "soir", 7.6, "Porte mal fermée, refermée"], 9: ["fr-s2", "soir", 8.1, "Produits déplacés dans un autre frigo"], 16: ["fr-cf", "midi", 4.6, "Technicien appelé"], 23: ["fr-cg", "midi", -12.5, "Thermostat réglé"] };
    days(30).forEach((day, di) => {
      ["midi", "soir"].forEach((slot) => {
        if (di === 0 && (slot === "soir" || hourNow < 10)) return; /* today's evening round is still to do */
        F.forEach(([k, name, , min, max, base, sd]) => {
          let v = r1(base + (rnd() - 0.5) * 2 * sd + (slot === "soir" && k.startsWith("fr-s") ? 0.4 : 0)); let action = "";
          const b = bad[di]; if (b && b[0] === k && b[1] === slot) { v = b[2]; action = b[3]; }
          const ok = v >= min && v <= max;
          put("readings", { fridgeId: k, fname: name, value: v, slot, day, at: at(day, slot === "midi" ? 11 : 18, 5 + Math.floor(rnd() * 40)), uid: pick(cooks), ok, action: ok ? "" : action || ACTIONS[0] });
        });
      });
    });

    /* ── products (with allergens) ── */
    const PR = [
      ["p-huitre", "Fines de claire n°3", "bourriche", "Chambre froide", 42, "Marée Atlantique", ["mollusques"], 4],
      ["p-jambon", "Jambon blanc supérieur", "kg", "Chambre froide", 14.9, "Charcuterie Ripert", [], 2],
      ["p-jambonc", "Jambon de Bayonne", "kg", "Chambre froide", 24.5, "Charcuterie Ripert", [], 1],
      ["p-saucisson", "Saucisson sec", "kg", "Chambre froide", 19.8, "Charcuterie Ripert", ["lait"], 1],
      ["p-terrine", "Terrine de campagne", "kg", "Chambre froide", 16.2, "Charcuterie Ripert", ["oeufs", "lait", "sulfites"], 1],
      ["p-rillettes", "Rillettes du Mans", "kg", "Chambre froide", 13.4, "Charcuterie Ripert", [], 1],
      ["p-paleron", "Paleron de bœuf", "kg", "Chambre froide", 17.5, "Boucherie Durand", [], 5],
      ["p-lardons", "Lardons fumés", "kg", "Chambre froide", 9.9, "Boucherie Durand", [], 1],
      ["p-beurre", "Beurre doux AOP", "kg", "Chambre froide", 11.2, "Metro", ["lait"], 2],
      ["p-lait", "Lait entier", "L", "Chambre froide", 1.15, "Metro", ["lait"], 6],
      ["p-creme", "Crème liquide 35 %", "L", "Chambre froide", 4.8, "Metro", ["lait"], 3],
      ["p-comte", "Comté 18 mois", "kg", "Chambre froide", 22.9, "Metro", ["lait"], 1],
      ["p-oeufs", "Œufs plein air", "pièce", "Chambre froide", 0.32, "Ferme des Collines", ["oeufs"], 60],
      ["p-farine", "Farine T55", "kg", "Réserve sèche", 1.1, "Metro", ["gluten"], 5],
      ["p-chapelure", "Chapelure panko", "kg", "Réserve sèche", 6.4, "Metro", ["gluten"], 1],
      ["p-pain", "Pain de campagne", "pièce", "Réserve sèche", 3.2, "Boulangerie Gaspard", ["gluten", "sesame"], 6],
      ["p-vin", "Vin rouge de Bourgogne", "L", "Cave à vin", 8.5, "Domaine Rion", ["sulfites"], 6],
      ["p-fond", "Fond de veau", "L", "Chambre froide", 6.9, "Metro", ["celeri"], 2],
      ["p-carotte", "Carottes", "kg", "Chambre froide", 1.4, "Primeur du Marché", [], 5],
      ["p-oignon", "Oignons", "kg", "Réserve sèche", 1.2, "Primeur du Marché", [], 5],
      ["p-champi", "Champignons de Paris", "kg", "Chambre froide", 5.6, "Primeur du Marché", [], 2],
      ["p-citron", "Citrons", "kg", "Chambre froide", 3.4, "Primeur du Marché", [], 1],
      ["p-echalote", "Échalotes", "kg", "Réserve sèche", 4.2, "Primeur du Marché", [], 1],
      ["p-cornich", "Cornichons", "kg", "Réserve sèche", 7.8, "Metro", ["moutarde", "sulfites"], 1],
      ["p-glace", "Glace vanille", "L", "Congélateur", 9.5, "Metro", ["lait", "oeufs"], 2],
      ["p-frites", "Frites surgelées", "kg", "Congélateur", 2.3, "Metro", [], 10],
    ];
    PR.forEach(([k, name, unit, zone, price, supplier, allergens, minQty], i) => put("products", { name, unit, zone, price, supplier, allergens, alChecked: true, minQty, step: unit === "kg" || unit === "L" ? 0.5 : 1, createdAt: now - 300 * 864e5 + i }, k));
    /* ── purchase price history + scanned supplier invoices (js/marge.js) ── */
    const PH = [ /* product, days ago, previous price, new price, supplier, invoice key */
      ["p-paleron", 75, 15.6, 16.2, "Boucherie Durand", "f-d1"], ["p-lardons", 75, 9.1, 9.4, "Boucherie Durand", "f-d1"],
      ["p-huitre", 62, 38, 39.5, "Marée Atlantique", "f-m1"], ["p-beurre", 48, 9.6, 10, "Metro", "f-x1"], ["p-creme", 48, 4.6, 4.8, "Metro", "f-x1"],
      ["p-vin", 34, 8.9, 8.9, "Domaine Rion", "f-v1"], ["p-huitre", 20, 39.5, 42, "Marée Atlantique", "f-m2"],
      ["p-paleron", 12, 16.2, 17.5, "Boucherie Durand", "f-d2"], ["p-lardons", 12, 9.4, 9.9, "Boucherie Durand", "f-d2"],
      ["p-vin", 9, 8.9, 8.5, "Domaine Rion", "f-v2"], ["p-beurre", 6, 10, 11.2, "Metro", "f-x2"], ["p-creme", 6, 4.8, 4.8, "Metro", "f-x2"], ["p-comte", 6, 22.9, 22.9, "Metro", "f-x2"], ["p-farine", 6, 1.1, 1.1, "Metro", "f-x2"],
    ];
    const INV = {};
    PH.forEach(([pid, ago, prev, price, supplier, fk], i) => {
      const p = PR.find((x) => x[0] === pid); const day = addDays(today, -ago); const q = { "p-paleron": 8, "p-lardons": 2, "p-huitre": 6, "p-beurre": 3, "p-creme": 4, "p-vin": 12, "p-comte": 1.5, "p-farine": 10 }[pid] || 1;
      const f = (INV[fk] ||= { supplier, day, number: { "f-d1": "D-20418", "f-d2": "D-20977", "f-m1": "MA-8812", "f-m2": "MA-9140", "f-x1": "FA-2026-109412", "f-x2": "FA-2026-118734", "f-v1": "R-311", "f-v2": "R-342" }[fk], lines: [] });
      f.lines.push({ name: p[1].toUpperCase(), qty: q, unit: p[2], price, total: r2(q * price), productId: pid, per: 1, unitPrice: price });
      put("prices", { productId: pid, name: p[1], supplier, unit: p[2], price, prev, pct: Math.round(((price - prev) / prev) * 1000) / 10, day, at: at(day, 9, 30 + i), src: "facture", invoiceId: fk, by: "demo-thomas" });
    });
    Object.entries(INV).forEach(([fk, f]) => { const ht = r2(f.lines.reduce((s, l) => s + l.total, 0)); put("invoices", { ...f, totalHT: ht, totalTTC: r2(ht * (f.supplier === "Domaine Rion" ? 1.2 : 1.055)), photoId: "", src: "photo", status: "validee", at: at(f.day, 9, 40), by: "demo-thomas" }, fk); });

    const month = monthKey();
    const QTY = { "p-huitre": 6, "p-jambon": 3.5, "p-jambonc": 2, "p-saucisson": 1.5, "p-terrine": 1, "p-rillettes": 1.5, "p-paleron": 8, "p-lardons": 2, "p-beurre": 3, "p-lait": 8, "p-creme": 4, "p-comte": 1.5, "p-oeufs": 90, "p-farine": 12, "p-chapelure": 2, "p-pain": 4, "p-vin": 9, "p-fond": 3, "p-carotte": 6, "p-oignon": 7, "p-champi": 1.5, "p-citron": 2, "p-echalote": 1, "p-cornich": 1, "p-glace": 3, "p-frites": 14 };
    const pm = prevMonthKey(), pmEnd = addDays(today, -parseDay(today).getDate());
    Object.entries(QTY).forEach(([pid, qty]) => put("counts", { month: pm, productId: pid, qty: r1(qty * (0.8 + rnd() * 0.5)), uid: "demo-thomas", at: at(pmEnd, 16) }, `${pm}_${pid}`));
    Object.entries(QTY).slice(0, 18).forEach(([pid, qty]) => put("counts", { month, productId: pid, qty, uid: "demo-thomas", at: at(addDays(today, -(parseDay(today).getDate() - 1)), 15) }, `${month}_${pid}`));

    /* ── receptions + lots with DLC (one past, one today, one tomorrow) ── */
    const REC = [
      [6, "Marée Atlantique", [["p-huitre", 6, "bourriche", 3.1, 9]]],
      [4, "Boucherie Durand", [["p-paleron", 8, "kg", 2.4, 6], ["p-lardons", 2, "kg", 2.9, 12]]],
      [3, "Charcuterie Ripert", [["p-jambon", 3.5, "kg", 3.2, 5], ["p-jambonc", 2, "kg", 3.6, 40], ["p-terrine", 1.2, "kg", 3.0, 3], ["p-saucisson", 1.5, "kg", null, 60]]],
      [2, "Metro", [["p-beurre", 3, "kg", 3.4, 30], ["p-creme", 4, "L", 3.1, 9], ["p-lait", 8, "L", 3.3, 6], ["p-comte", 1.5, "kg", 4.1, 45]]],
      [1, "Primeur du Marché", [["p-carotte", 6, "kg", null, 10], ["p-champi", 1.5, "kg", 5.2, 4], ["p-citron", 2, "kg", null, 14]]],
      [9, "Ferme des Collines", [["p-oeufs", 90, "pièce", null, 19]]],
    ];
    const fridgeOf = (pid) => (PR.find((p) => p[0] === pid)[3] === "Congélateur" ? "fr-cg" : PR.find((p) => p[0] === pid)[3] === "Chambre froide" ? "fr-cf" : "");
    REC.forEach(([ago, supplier, lines], ri) => {
      const day = addDays(today, -ago), t = at(day, 9, 10 + ri);
      const L = lines.map(([pid, qty, unit, temp, dlcIn]) => { const p = PR.find((x) => x[0] === pid); return { name: p[1], productId: pid, qty, unit, temp, tmax: temp == null ? null : 4, type: temp == null ? "sec" : "frais", dlc: addDays(day, dlcIn), lot: "L" + (4400 + ri * 17 + qty).toString().replace(".", ""), fridgeId: fridgeOf(pid), ok: true, refused: false, reserve: false, reason: "", photoId: "", photoUrl: "", sanitary: pid === "p-huitre" ? "FR 17.306.003 CE" : "", peche: "" }; });
      const recId = put("receptions", { supplier, bl: "BL-" + (2380 + ri * 7), at: t, uid: pick(cooks), lines: L });
      L.forEach((l, i) => put("lots", { name: l.name, productId: l.productId, qty: l.qty, unit: l.unit, lot: l.lot, dlc: l.dlc, supplier, receptionId: recId, fridgeId: l.fridgeId, status: "in", receivedTemp: l.temp, code: "GG-" + rid6(), photoId: "", photoUrl: "", createdAt: t + i, uid: pick(cooks) }));
      L.forEach((l) => put("moves", { productId: l.productId, name: l.name, qty: l.qty, unit: l.unit, kind: "reception", ref: recId, refType: "reception", at: t, uid: "demo-thomas", by: "Thomas Girard" }));
    });
    put("lots", { name: "Fond de veau maison", productId: "p-fond", qty: 2, unit: "L", lot: "MAISON", dlc: addDays(today, -1), supplier: "Fait maison", receptionId: "", fridgeId: "fr-cf", status: "opened", dlcOpen: addDays(today, -1), receivedTemp: null, code: "GG-" + rid6(), createdAt: now - 4 * 864e5, uid: "demo-ines" });
    put("lots", { name: "Mayonnaise maison", productId: "", qty: 1, unit: "kg", lot: "MAISON", dlc: today, supplier: "Fait maison", receptionId: "", fridgeId: "fr-cf", status: "opened", dlcOpen: today, receivedTemp: null, code: "GG-" + rid6(), createdAt: now - 2 * 864e5, uid: "demo-lucas" });
    put("lots", { name: "Croquettes de jambon (panées)", productId: "", qty: 60, unit: "pièce", lot: "MAISON", dlc: addDays(today, 1), supplier: "Fait maison", receptionId: "", fridgeId: "fr-cf", status: "in", receivedTemp: null, code: "GG-" + rid6(), createdAt: now - 864e5, uid: "demo-ines" });
    if (hourNow >= 11 && hourNow < 23) {
      const svcAt = at(today, 11, 2);
      put("lots", { name: "Fines de claire n°3", productId: "p-huitre", qty: 2, unit: "bourriche", lot: "L4423", dlc: addDays(today, 3), supplier: "Marée Atlantique", receptionId: "", fridgeId: "fr-s1", status: "in", receivedTemp: 3.1, code: "GG-" + rid6(), createdAt: svcAt, uid: "demo-lucas", svcAt, svcFrom: "fr-cf" });
      put("lots", { name: "Croquettes de jambon (service)", productId: "", qty: 20, unit: "pièce", lot: "MAISON", dlc: addDays(today, 1), supplier: "Fait maison", receptionId: "", fridgeId: "fr-s2", status: "in", receivedTemp: null, code: "GG-" + rid6(), createdAt: svcAt + 1, uid: "demo-ines", svcAt, svcFrom: "fr-cf" });
    }
    put("lots", { name: "Frites surgelées", productId: "p-frites", qty: 14, unit: "kg", lot: "F2291", dlc: addDays(today, 160), supplier: "Metro", receptionId: "", fridgeId: "fr-cg", status: "in", receivedTemp: -19, code: "GG-" + rid6(), createdAt: now - 12 * 864e5, uid: "demo-lucas" });

    /* ── recipes (ingredients linked to products, allergens) + a procedure ── */
    const ing = (pid, qty, unit) => ({ name: PR.find((p) => p[0] === pid)[1], qty: String(qty), unit, productId: pid });
    const NOTES = [
      ["n-croq", { title: "Croquettes de jambon", cat: "Recettes", portions: 6, carte: true, carteCat: "partage", price: 9, allergens: ["gluten", "lait", "oeufs"], body: "Servies par 5 avec une mayonnaise fumée. Se congèlent panées, crues.",
        ingredients: [ing("p-jambon", "0,6", "kg"), ing("p-lait", "1", "L"), ing("p-beurre", "0,1", "kg"), ing("p-farine", "0,12", "kg"), ing("p-oeufs", "4", "pièce"), ing("p-chapelure", "0,3", "kg")],
        steps: ["Hacher finement le jambon.", "Roux blanc : beurre et farine, mouiller au lait chaud, cuire 10 min.", "Ajouter le jambon, refroidir 4 h filmé au contact.", "Façonner des boules de 35 g.", "Paner à l'anglaise : farine, œuf, panko.", "Frire 3 min à 175 °C."] }],
      ["n-planche", { title: "Planche de charcuterie", cat: "Recettes", portions: 1, carte: true, carteCat: "partage", price: 19, allergens: ["gluten", "lait", "oeufs", "sulfites", "moutarde", "sesame"], body: "Pour 2 personnes. Indiquer les allergènes au client : terrine (œufs, lait), cornichons (moutarde, sulfites), pain (gluten, sésame).",
        ingredients: [ing("p-jambonc", "0,06", "kg"), ing("p-saucisson", "0,05", "kg"), ing("p-terrine", "0,08", "kg"), ing("p-rillettes", "0,05", "kg"), ing("p-cornich", "0,03", "kg"), ing("p-pain", "0,25", "pièce")],
        steps: ["Sortir la charcuterie 15 min avant.", "Trancher le jambon et le saucisson à la minute.", "Dresser sur planche avec cornichons et pain grillé."] }],
      ["n-bourgui", { title: "Bœuf bourguignon", cat: "Recettes", portions: 10, carte: true, carteCat: "plat", price: 22, allergens: ["gluten", "lait", "sulfites", "celeri"], body: "Meilleur réchauffé le lendemain. Servir avec des pommes vapeur.",
        ingredients: [ing("p-paleron", "2", "kg"), ing("p-vin", "1", "L"), ing("p-carotte", "0,6", "kg"), ing("p-oignon", "0,4", "kg"), ing("p-lardons", "0,25", "kg"), ing("p-champi", "0,4", "kg"), ing("p-farine", "0,04", "kg"), ing("p-fond", "0,5", "L"), ing("p-beurre", "0,05", "kg")],
        steps: ["Couper le bœuf en cubes de 5 cm.", "Mariner 12 h au froid avec le vin et la garniture.", "Saisir, singer à la farine.", "Mouiller avec la marinade et le fond, cuire 3 h à frémissement.", "Rissoler lardons et champignons, ajouter en fin de cuisson."] }],
      ["n-huitres", { title: "Huîtres fines de claire (la douzaine)", cat: "Recettes", portions: 1, carte: true, carteCat: "entree", price: 24, allergens: ["mollusques", "sulfites"], body: "Ouvrir à la minute. Servir sur glace pilée avec citron et mignonnette. Stocker les huîtres À PART, loin des œufs et du lait.",
        ingredients: [ing("p-huitre", "0,25", "bourriche"), ing("p-citron", "0,05", "kg"), ing("p-echalote", "0,01", "kg")],
        steps: ["Sortir de la chambre froide au début du service : frigo de service.", "Ouvrir à la minute, retirer la première eau.", "Dresser sur glace pilée.", "En fin de service, remettre les bourriches en chambre froide."] }],
      ["n-cafe", { title: "Café gourmand", cat: "Recettes", portions: 10, carte: true, carteCat: "dessert", price: 9.5, allergens: ["lait", "oeufs", "gluten"], body: "Un café, une boule de glace vanille, un mini financier et une crème brûlée.",
        ingredients: [ing("p-glace", "0,5", "L"), ing("p-creme", "0,6", "L"), ing("p-oeufs", "8", "pièce"), ing("p-beurre", "0,2", "kg"), ing("p-farine", "0,1", "kg"), { name: "Café en grains", qty: "0,08", unit: "kg" }],
        steps: ["Crème brûlée : crème, jaunes, sucre, cuire 1 h à 95 °C.", "Financiers : beurre noisette, farine, blancs, cuire 9 min à 180 °C.", "Dresser à la minute avec le café."] }],
      ["n-proc", { title: "Ouverture de la cuisine", cat: "Procédures", body: "À faire chaque matin avant la mise en place.", steps: ["Relevé de température de tous les frigos.", "Vérifier les DLC du jour.", "Lavage des mains, tenue propre.", "Désinfecter les plans de travail."], ingredients: [], allergens: [], portions: 1 }],
    ];
    try { if (typeof noteBourguignon === "function") { const nb = noteBourguignon(); if (nb && nb.process) Object.assign(NOTES[2][1], { process: nb.process, processV: 1, processAt: now - 30 * 864e5, processBy: "demo-thomas", seed: "bourguignon" }); } } catch (e) {}
    NOTES.forEach(([k, d], i) => put("notes", { ...d, uid: "demo-thomas", at: now - (200 - i) * 864e5, updatedAt: now - (10 - i) * 864e5, photo: "", photoId: "" }, k));

    /* ── cleaning plan + logs ── */
    const CH = [
      ["c-plans", "Plans de travail", "Cuisine", "service", "midi"], ["c-sols", "Sols cuisine", "Cuisine", "jour", "soir"], ["c-frigos", "Intérieur des frigos de service", "Cuisine", "semaine", "soir", { wday: 1 }],
      ["c-hotte", "Filtres de la hotte", "Cuisine", "semaine", "soir", { wday: 5 }], ["c-cf", "Chambre froide (sol et étagères)", "Réserve", "semaine", "matin", { wday: 2 }],
      ["c-wc", "Toilettes clients", "Salle", "jour", "matin"], ["c-poubelles", "Poubelles et local déchets", "Extérieur", "jour", "soir"], ["c-trancheuse", "Trancheuse", "Cuisine", "service", "soir"],
    ];
    CH.forEach(([k, name, zone, freq, moment, extra], i) => put("chores", { name, zone, freq, moment: freq === "service" ? "midi" : moment, days: [], wday: (extra && extra.wday) ?? null, mday: null, who: "", notes: "", photo: false, createdAt: now - 200 * 864e5 + i }, k));
    days(14).slice(1).forEach((day) => CH.forEach(([k, , , freq]) => { if (freq === "semaine" && rnd() > 0.2) return; if (rnd() < 0.12) return; const u = pick(who.slice(1)); put("choreLogs", { choreId: k, at: at(day, freq === "service" ? 15 : 22, Math.floor(rnd() * 50)), day, uid: u, by: team.find((t) => t[0] === u)[1] }); }));

    /* ── 30 days of Z tickets (closed on Mondays) + matching sales moves ── */
    const MENU = [["Fines de claire n°3 (douzaine)", 24, "n-huitres", 6, 14], ["Croquettes de jambon", 9, "n-croq", 8, 22], ["Planche de charcuterie", 19, "n-planche", 6, 16], ["Bœuf bourguignon", 22, "n-bourgui", 10, 26], ["Café gourmand", 9.5, "n-cafe", 6, 18], ["Verre de vin", 6.5, "", 20, 60], ["Formule midi", 18.5, "", 12, 30]];
    days(30).slice(1).forEach((day) => {
      if (parseDay(day).getDay() === 1) return;
      const wk = [0, 6].includes(parseDay(day).getDay()) || parseDay(day).getDay() === 5 ? 1.3 : 1;
      const lines = MENU.map(([libelle, price, noteId, lo, hi]) => { const q = Math.round((lo + rnd() * (hi - lo)) * wk); return { libelle, quantite: q, montant: r2(q * price), ...(noteId ? { noteId } : {}) }; });
      const ttc = r2(lines.reduce((s, l) => s + l.montant, 0)); const ht = r2(ttc / 1.1);
      const tid = put("tickets", { date: day, total: ttc, ht, vat: [{ rate: 10, ttc, ht, tva: r2(ttc - ht) }], covers: Math.round(ttc / 31), lines, photoIds: [], photoUrls: [], photos: [], at: at(day, 23, 30), uid: "demo-camille", updatedAt: at(day, 23, 30) });
      const oy = lines[0].quantite; put("moves", { productId: "p-huitre", name: "Fines de claire n°3", qty: -r2(oy / 4), unit: "bourriche", kind: "vente", ref: tid, refType: "ticket", at: at(day, 23, 31), uid: "demo-camille", by: "Camille Laurent" });
    });
    put("moves", { productId: "p-huitre", name: "Fines de claire n°3", qty: 0, unit: "bourriche", kind: "transfert", fridgeId: "fr-cf", toFridgeId: "fr-s1", at: at(today, 11, 2), uid: "demo-lucas", by: "Lucas Petit" });
    put("moves", { productId: "p-jambon", name: "Jambon blanc supérieur", qty: -0.6, unit: "kg", kind: "recette", ref: "n-croq", refType: "note", at: now - 864e5, uid: "demo-ines", by: "Inès Benali" });
    put("moves", { productId: "p-creme", name: "Crème liquide 35 %", qty: -0.5, unit: "L", kind: "perte", at: now - 2 * 864e5, uid: "demo-thomas", by: "Thomas Girard" });

    /* ── planning (this week and next) + time clock (last 14 days) ── */
    const PLAN = { "demo-thomas": [["09:30", "15:00"], ["18:00", "23:00"]], "demo-ines": [["09:30", "15:00"], ["18:00", "23:00"]], "demo-lucas": [["10:00", "15:00"], ["18:30", "23:00"]], "demo-sarah": [["11:30", "15:00"], ["18:30", "23:30"]], "demo-hugo": [["19:00", "23:30"]], "demo-camille": [["10:00", "16:00"]] };
    const OFF = { "demo-thomas": [1, 2], "demo-ines": [1, 0], "demo-lucas": [1, 3], "demo-sarah": [1, 4], "demo-hugo": [1, 2, 3], "demo-camille": [1, 0] };
    const mon = (() => { const d = parseDay(today); const w = (d.getDay() + 6) % 7; return addDays(today, -w); })();
    for (let i = -14; i < 14; i++) {
      const day = addDays(mon, i), wd = parseDay(day).getDay();
      Object.entries(PLAN).forEach(([mid, segs]) => {
        if (OFF[mid].includes(wd)) return;
        segs.forEach(([start, end]) => put("shifts", { staffId: staffIds[mid], day, start, end, breakMin: segs.length === 1 && mid === "demo-camille" ? 30 : 0, post: team.find((t) => t[0] === mid)[8] }));
        if (day < today || (day === today && hourNow >= 12)) {
          segs.forEach(([start, end], si) => {
            if (day === today && si > 0) return;
            const [h1, m1] = start.split(":").map(Number), [h2, m2] = end.split(":").map(Number);
            const tin = at(day, h1, Math.max(0, m1 - 6 + Math.floor(rnd() * 10)));
            put("punches", { staffId: staffIds[mid], kind: "in", at: tin, day, by: mid });
            if (day !== today || hourNow >= h2) put("punches", { staffId: staffIds[mid], kind: "out", at: at(day, h2, Math.min(59, m2 + Math.floor(rnd() * 15))), day, by: mid });
          });
        }
      });
    }

    /* ── annual obligations (one late, one due soon) + intervention log ── */
    const OB = [
      ["o-ext", "extincteurs", "Extincteurs", "feu", 12, "Sécurifeu 17", "05 46 41 22 10", 300],
      ["o-nuis", "nuisibles", "Dératisation et désinsectisation", "hyg", 3, "Anti-Nuisibles Atlantique", "05 46 50 33 81", 80],
      ["o-hotte", "hotte", "Hotte et conduits d'extraction", "feu", 12, "Dégraiss'Pro", "05 46 27 64 02", 395],
      ["o-elec", "electricite", "Installations électriques", "tech", 12, "Apave La Rochelle", "05 46 00 12 12", 150],
      ["o-gaz", "gaz", "Installation gaz et cuisson", "tech", 12, "Apave La Rochelle", "05 46 00 12 12", 150],
      ["o-baes", "baes", "Éclairage de sécurité (BAES)", "feu", 12, "Sécurifeu 17", "05 46 41 22 10", 200],
    ];
    OB.forEach(([k, key, name, cat, everyMonths, provider, phone, ago]) => {
      const lastDone = addDays(today, -ago); const nd = parseDay(lastDone); nd.setMonth(nd.getMonth() + everyMonths); const nextDue = dayKey(nd);
      put("obligations", { key, name, cat, everyMonths, provider, phone, contract: key === "nuisibles" ? "Contrat 4 passages / an" : "", lastDone, nextDue, notes: "" }, k);
      put("oblLogs", { oblId: k, day: lastDone, provider, by: "Camille Laurent", at: at(lastDone, 10), notes: key === "hotte" ? "Conduits dégraissés, photos avant / après fournies." : "RAS", cost: { extincteurs: 186, nuisibles: 95, hotte: 540, electricite: 320, gaz: 210, baes: 120 }[key], files: [] });
    });

    /* ── feedback ── */
    const FB = [
      ["client", 5, "Bœuf bourguignon", "google", "Le meilleur bourguignon de La Rochelle, service adorable. On reviendra !", 1, "repondu", "Merci beaucoup ! Toute l'équipe a hâte de vous revoir."],
      ["client", 4, "Fines de claire n°3 (douzaine)", "salle", "Huîtres très fraîches, un peu d'attente au dessert.", 2, "clos", ""],
      ["client", 2, "Croquettes de jambon", "tripadvisor", "Croquettes trop salées ce soir-là, dommage car le reste était bon.", 4, "a_traiter", ""],
      ["client", 5, "Planche de charcuterie", "thefork", "Planche généreuse, et le serveur a pris le temps d'expliquer les allergènes à ma fille.", 6, "repondu", "Merci, la sécurité de nos clients passe avant tout."],
      ["client", 5, "", "google", "Cadre chaleureux, carte courte et maîtrisée.", 9, "a_traiter", ""],
      ["client", 3, "Café gourmand", "salle", "Café gourmand un peu léger pour le prix.", 12, "clos", ""],
    ];
    FB.forEach(([source, rating, dish, channel, text, ago, status, reply]) => { const day = addDays(today, -ago); const nid = { "Bœuf bourguignon": "n-bourgui", "Croquettes de jambon": "n-croq", "Planche de charcuterie": "n-planche", "Fines de claire n°3 (douzaine)": "n-huitres" }[dish]; put("feedback", { source, rating, dish, ...(nid ? { noteId: nid } : {}), channel, text, at: at(day, 21), day, by: "Camille Laurent", uid: "demo-camille", status, ...(reply ? { reply, repliedAt: at(day, 23), repliedBy: "demo-camille" } : {}) }); });
    put("feedback", { source: "equipe", kind: "incident", text: "Le joint de la porte du frigo de service 1 est abîmé : il monte vite en température pendant le service.", urgent: true, at: now - 3 * 864e5, by: "Lucas Petit", uid: "demo-lucas", status: "en_cours", voters: ["demo-thomas"] });
    put("feedback", { source: "equipe", kind: "idee", text: "Proposer une demi-douzaine d'huîtres au verre de vin le midi ?", at: now - 6 * 864e5, by: "Sarah Lemoine", uid: "demo-sarah", status: "a_traiter", voters: ["demo-camille", "demo-ines"] });

    /* ── « Votre avis » about the app itself (stays in the demo, never sent) ── */
    put("feedback", { source: "app", rid: RID, restoName: "Le Bistrot Démo", uid: "demo-thomas", name: "Thomas Girard", role: "chef", type: "idee", area: "stock", text: "Pouvoir scanner la facture du fournisseur pour remplir la réception toute seule.", at: now - 5 * 864e5, status: "en_cours", replies: [{ by: "Équipe Growth Gusto", at: now - 4 * 864e5, text: "Bonne idée, c'est en cours !" }] });
    put("feedback", { source: "app", rid: RID, restoName: "Le Bistrot Démo", uid: "demo-camille", name: "Camille Laurent", role: "gerant", type: "jadore", area: "releve", text: "Le relevé en 10 secondes le matin, toute l'équipe l'utilise.", at: now - 12 * 864e5, status: "fait", replies: [] });

    /* ── expenses ── */
    const m2 = (() => { const d = parseDay(today); d.setDate(1); d.setMonth(d.getMonth() - 2); return dayKey(d); })();
    [["loyer", "SCI du Port", "Loyer", 2400, 20], ["energie", "EDF", "Électricité et gaz", 780, 20], ["assurances", "MAAF Pro", "Multirisque pro", 189, 0], ["banque", "Crédit Agricole", "Frais bancaires et TPE", 74, 0]]
      .forEach(([cat, supplier, label, amountHT, vat]) => put("expenses", { day: m2, cat, supplier, label, amountHT, vat, recurring: "mois", at: at(m2, 9), by: "Camille Laurent" }));
    [[10, "entretien", "Dégraiss'Pro", "Nettoyage hotte", 450, 20], [14, "autres", "Bureau Vallée", "Rouleaux d'étiquettes", 38, 20], [21, "entretien", "Froid Service 17", "Joint porte frigo de service 1", 85, 20]]
      .forEach(([ago, cat, supplier, label, amountHT, vat]) => { const day = addDays(today, -ago); put("expenses", { day, cat, supplier, label, amountHT, vat, at: at(day, 14), by: "Camille Laurent" }); });
    /* the restaurant buys every week: one purchase per supplier and week, on top of the detailed receptions */
    for (let w = 1; w <= 4; w++) [["Marée Atlantique", 260], ["Metro", 540], ["Boucherie Durand", 410], ["Primeur du Marché", 180], ["Charcuterie Ripert", 230]].forEach(([supplier, base], i) => { const day = addDays(today, -(w * 7) + i); put("expenses", { day, cat: "achats", supplier, label: "Facture semaine", amountHT: r2(base * (0.85 + rnd() * 0.3)), vat: 5.5, at: at(day, 10), by: "Thomas Girard" }); });
    Object.entries(D[P("receptions")]).forEach(([rid, r]) => { const amt = r2(r.lines.reduce((s, l) => s + (PR.find((p) => p[0] === l.productId)?.[4] || 0) * l.qty, 0)); put("expenses", { day: dayKey(new Date(r.at)), cat: "achats", supplier: r.supplier, label: r.bl, amountHT: amt, vat: 5.5, receptionId: rid, at: r.at + 1000, by: "Thomas Girard" }); });

    /* ── audit trail ── */
    const EV = [[0, "reading", "a fait le relevé du midi", "demo-lucas"], [0, "move", "a mis 5 bourriches de fines de claire au frigo de service 1", "demo-lucas"], [1, "lot", "a fabriqué 60 croquettes de jambon", "demo-ines"], [1, "reception", "a réceptionné Primeurs Lucas", "demo-thomas"], [2, "reception", "a réceptionné Crèmerie Duval", "demo-thomas"], [3, "reading", "a signalé le frigo de service 1 à 7,6 °C (porte mal fermée)", "demo-sarah"], [3, "reception", "a réceptionné Maison Ripert", "demo-ines"], [4, "ticket", "a enregistré le ticket Z", "demo-camille"], [6, "obl", "a enregistré le passage des nuisibles", "demo-camille"], [8, "team", "a ajouté Hugo Martin à l'équipe", "demo-camille"]];
    EV.forEach(([ago, type, text, uid], i) => put("events", { type, text, at: at(addDays(today, -ago), 11 + (i % 6), 10 + i), uid }));

    /* ── consignes & discussion (js/consignes.js) ── */
    {
      const mn = (k) => now - k * 60000; const yest = addDays(today, -1);
      const c1 = put("consignes", { kind: "plat", text: "Joue de bœuf braisée, purée maison · 18 €\nDessert : tarte fine aux pommes", day: today, keep: false, at: mn(95), uid: "demo-thomas", by: "Thomas Girard" }, "cs-plat");
      const c2 = put("consignes", { kind: "rupture", text: "Plus de bar de ligne ce midi", day: today, keep: true, at: mn(70), uid: "demo-thomas", by: "Thomas Girard" }, "cs-bar");
      const c3 = put("consignes", { kind: "info", text: "Livraison Metro vers 10 h : Lucas réceptionne. Contrôle des extincteurs jeudi matin.", day: today, keep: false, at: mn(120), uid: "demo-camille", by: "Camille Laurent" }, "cs-info");
      put("consignes", { kind: "rupture", text: "Plus de Chablis 2022 (commande en cours)", day: yest, keep: true, at: now - 26 * 36e5, uid: "demo-camille", by: "Camille Laurent" }, "cs-chablis");
      [[c3, "demo-thomas", "Thomas Girard", 110], [c3, "demo-ines", "Inès Benali", 98], [c3, "demo-lucas", "Lucas Petit", 64], [c1, "demo-ines", "Inès Benali", 80], [c1, "demo-sarah", "Sarah Lemoine", 40], [c2, "demo-sarah", "Sarah Lemoine", 38], [c2, "demo-ines", "Inès Benali", 60], ["cs-chablis", "demo-sarah", "Sarah Lemoine", 1500], ["cs-chablis", "demo-thomas", "Thomas Girard", 1450]]
        .forEach(([cid, pid, name, k]) => put("csReads", { cid, pid, name, at: mn(k) }, `${cid}~${pid}`));
      [["demo-ines", "Inès Benali", "Je peux échanger mon samedi soir avec quelqu'un ? J'ai un mariage.", 1560], ["demo-hugo", "Hugo Martin", "Moi je prends, je suis dispo.", 1530], ["demo-camille", "Camille Laurent", "Merci Hugo ! Je change le planning.", 1500],
        ["demo-thomas", "Thomas Girard", "Le lave-vaisselle fuit encore un peu côté gauche, j'ai mis un seau.", 140], ["demo-camille", "Camille Laurent", "Le technicien passe demain à 9 h.", 125], ["demo-sarah", "Sarah Lemoine", "Table de 12 ce soir à 20 h, anniversaire : prévoir une bougie 🎂", 30]]
        .forEach(([uid, by, text, k]) => put("chat", { text, at: mn(k), uid, by }));
    }
    return { rid: RID, data: D, me: { id: "demo-camille", name: "Camille Laurent", color: "#4A1FE6" } };
  },
};
