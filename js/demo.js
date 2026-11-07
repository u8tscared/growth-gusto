/* Growth Gusto — demo seed (loaded only when someone taps « Essayer la démo »). « Le Bistrot Démo »: a full, realistic restaurant,
   dated relative to today, following the V3 data contract (tools/BRIEF.md). Kept in memory only: DB.mode = "demo" never persists. */
/* demo pictures, drawn here (nothing is fetched): plates from above, glasses from the side. Used by the recipe cards and the
   step-by-step screen of the kitchen and the bar (js/recette.js). */
function demoArt(k) {
  const W = (bg, body, defs = "") => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><radialGradient id="v" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-opacity=".35"/></filter>${defs}</defs><rect width="400" height="300" fill="${bg}"/>${body}<rect width="400" height="300" fill="url(#v)"/></svg>`);
  const plate = (r = 118, c = "#FBF8F2") => `<circle cx="200" cy="152" r="${r}" fill="${c}" filter="url(#s)"/><circle cx="200" cy="152" r="${r - 26}" fill="none" stroke="#E9E3D8" stroke-width="2"/>`;
  const dots = (L, c, r) => L.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join("");
  const glass = (fill, h, extra = "", shape = "ballon") => shape === "ballon"
    ? `<g filter="url(#s)"><path d="M140 52h120c4 60-6 118-60 126-54-8-64-66-60-126z" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><path d="M${150 - h / 30} ${178 - h}h${100 + h / 15}c-4 ${h - 26}-20 ${h - 6}-50 ${h}-30-${6}-46-${26}-50-${h}z" fill="${fill}"/>${extra}<rect x="196" y="178" width="8" height="70" fill="#fff" fill-opacity=".6"/><ellipse cx="200" cy="252" rx="52" ry="9" fill="#fff" fill-opacity=".55"/></g>`
    : `<g filter="url(#s)"><path d="M150 40h100l-8 214h-84z" fill="#fff" fill-opacity=".16" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><path d="M${152 + (254 - h) * 0.0} ${254 - h}h${96}l-6 ${h - 4}h-84z" fill="${fill}"/>${extra}</g>`;
  const A = {
    bourgui: W("#2C2420", `${plate(124, "#F5EFE4")}<circle cx="200" cy="152" r="84" fill="#5B2416"/><circle cx="200" cy="152" r="84" fill="url(#v)" opacity=".5"/>${dots([[178, 134], [214, 128], [196, 168], [228, 162]], "#7A3A22", 19)}${dots([[160, 168], [240, 140], [206, 196], [170, 116]], "#E8822F", 10)}${dots([[188, 150], [222, 182], [236, 118], [158, 146]], "#C9A27A", 7)}${dots([[184, 128], [210, 150], [232, 168], [170, 182], [214, 112]], "#3E7A2E", 3.5)}`),
    croq: W("#22262B", `<rect x="58" y="70" width="284" height="164" rx="14" fill="#33373D" filter="url(#s)"/>${dots([[118, 122], [176, 122], [118, 180], [176, 180], [147, 151]], "#C98A3A", 26)}${dots([[118, 122], [176, 122], [118, 180], [176, 180], [147, 151]], "#E3A955", 18)}<circle cx="268" cy="152" r="38" fill="#F4F1EA"/><circle cx="268" cy="152" r="28" fill="#E9C58A"/>${dots([[112, 116], [170, 117], [142, 146], [114, 175]], "#fff", 2)}`),
    planche: W("#2A2521", `<rect x="40" y="62" width="320" height="176" rx="20" fill="#B9834F" filter="url(#s)"/><rect x="40" y="62" width="320" height="176" rx="20" fill="url(#v)" opacity=".4"/>${dots([[96, 112], [118, 100], [140, 112], [104, 134], [128, 132]], "#D9767A", 22)}${dots([[196, 104], [220, 100], [244, 106], [208, 126], [232, 128]], "#8E2F3A", 14)}<rect x="168" y="154" width="70" height="46" rx="6" fill="#9A5A3C"/><ellipse cx="292" cy="180" rx="30" ry="18" fill="#E4C9A3"/>${dots([[290, 108], [306, 120], [282, 128]], "#6E8B3D", 9)}<rect x="96" y="176" width="54" height="34" rx="8" fill="#E8C07A"/>`),
    huitres: W("#1E2A33", `<circle cx="200" cy="152" r="128" fill="#DCEEF5" filter="url(#s)"/>${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, x = 200 + Math.cos(a) * 88, y = 152 + Math.sin(a) * 88; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="26" ry="17" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#8C8F86"/><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="17" ry="10" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#D8D3C3"/>`; }).join("")}<circle cx="200" cy="152" r="26" fill="#fff"/><circle cx="200" cy="152" r="18" fill="#7E3A4A"/>${dots([[176, 132], [226, 172]], "#F2D24A", 10)}`),
    cafe: W("#24211F", `<rect x="34" y="96" width="332" height="110" rx="12" fill="#2F3236" filter="url(#s)"/><circle cx="94" cy="151" r="34" fill="#F4F1EA"/><circle cx="94" cy="151" r="24" fill="#4A2A18"/><ellipse cx="94" cy="151" rx="15" ry="9" fill="#B57A4A" opacity=".6"/><circle cx="200" cy="151" r="36" fill="#F4F1EA"/><circle cx="200" cy="151" r="27" fill="#D9963C"/><circle cx="200" cy="151" r="27" fill="url(#v)" opacity=".6"/><rect x="262" y="126" width="46" height="26" rx="6" fill="#D6A35E"/><circle cx="314" cy="174" r="20" fill="#F6EBD3"/>`),
    cubes: W("#2B2622", `<rect x="60" y="56" width="280" height="188" rx="16" fill="#C9A47A" filter="url(#s)"/>${[[110, 100], [160, 96], [210, 104], [124, 150], [176, 148], [226, 156], [140, 196], [194, 196]].map(([x, y]) => `<rect x="${x}" y="${y}" width="38" height="34" rx="7" fill="#9E2F2A"/><rect x="${x + 6}" y="${y + 6}" width="14" height="10" rx="4" fill="#E9B7A6" opacity=".7"/>`).join("")}<path d="M270 80l50 140" stroke="#D9D9D9" stroke-width="10" stroke-linecap="round"/><path d="M262 64l14 30" stroke="#2B2B2B" stroke-width="14" stroke-linecap="round"/>`),
    saisir: W("#1F1D1C", `<circle cx="200" cy="150" r="122" fill="#3A3A3D" filter="url(#s)"/><circle cx="200" cy="150" r="104" fill="#2A2A2C"/><rect x="316" y="138" width="80" height="24" rx="10" fill="#2A2A2C"/>${dots([[170, 120], [214, 112], [236, 150], [196, 162], [160, 168], [216, 196], [178, 200]], "#6B2A1A", 20)}${dots([[170, 116], [214, 108], [236, 146], [196, 158]], "#8E4426", 9)}<path d="M150 60c10 -20 -10 -30 0 -50M200 54c10 -20 -10 -30 0 -48M250 60c10 -20 -10 -30 0 -50" stroke="#fff" stroke-opacity=".25" stroke-width="6" fill="none" stroke-linecap="round"/>`),
    spritz: W("#2A1E3A", glass("#F26B21", 92, `<circle cx="248" cy="104" r="22" fill="#FFB347" stroke="#FFE1A6" stroke-width="4"/>${dots([[178, 118], [204, 104], [222, 132], [190, 146]], "#fff", 9)}`, "ballon")),
    limo: W("#1E3A33", glass("#F4E7A1", 150, `<circle cx="248" cy="78" r="22" fill="#F7E36A" stroke="#FFF6C4" stroke-width="4"/>${dots([[184, 150], [214, 186], [198, 220]], "#fff", 10)}<path d="M174 106c14-8 26-4 32 6" stroke="#3E9B52" stroke-width="8" fill="none" stroke-linecap="round"/>`, "tall")),
    mojito: W("#16302A", glass("#CFEBC4", 170, `${dots([[176, 120], [214, 140], [186, 176], [226, 200], [196, 226]], "#4FA35C", 11)}${dots([[204, 108], [184, 150], [216, 172]], "#fff", 8)}<path d="M236 30l-20 120" stroke="#1F1F1F" stroke-width="7" stroke-linecap="round"/>`, "tall")),
    vin: W("#2A1620", glass("#7A1530", 56, "", "ballon")),
    expresso: W("#2A211C", `<ellipse cx="200" cy="170" rx="118" ry="70" fill="#F4F1EA" filter="url(#s)"/><circle cx="200" cy="150" r="62" fill="#FBF8F2"/><path d="M262 140c34 0 34 30 0 30" stroke="#FBF8F2" stroke-width="14" fill="none"/><circle cx="200" cy="150" r="48" fill="#3B2314"/><circle cx="200" cy="150" r="48" fill="#B8783F" opacity=".35"/><ellipse cx="190" cy="140" rx="20" ry="12" fill="#D9A06A" opacity=".45"/><rect x="92" y="196" width="34" height="22" rx="4" fill="#4A2A18"/>`),
  };
  return A[k] || "";
}
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
    D.restos = { [RID]: { name: "Le Bistrot Démo", type: "bistrot", owner: "demo-camille", plan: "essai", createdAt: now - 420 * 864e5, demo: true, brands: [{ id: "b-huitres", name: "Le Comptoir à huîtres", color: "#2F7BEA" }] } };
    const team = [
      ["demo-camille", "Camille Laurent", "gerant", "#4A1FE6", "Gérant", "CDI", 39, 0, "salle"],
      ["demo-thomas", "Thomas Girard", "chef", "#E0752F", "Chef de cuisine", "CDI", 42, 19.5, "cuisine"],
      ["demo-ines", "Inès Benali", "chef", "#D63A7A", "Second", "CDI", 39, 15.8, "cuisine"],
      ["demo-lucas", "Lucas Petit", "equipe", "#0B9B6A", "Commis", "CDD", 35, 12.4, "cuisine"],
      ["demo-sarah", "Sarah Lemoine", "equipe", "#1F7AE0", "Serveur", "CDI", 35, 12.6, "salle"],
      ["demo-hugo", "Hugo Martin", "equipe", "#0E8C9E", "Plongeur", "Extra", 20, 12.1, "plonge"],
      ["demo-lea", "Léa Fontaine", "equipe", "#D9468F", "Serveur", "Extra", 15, 12.1, "salle"],
    ];
    /* each person's access, from their job (js/perms.js presets): « Voir comme » (js/espaces.js) shows the app exactly as they see it */
    const demoPerms = (mid, poste) => { if (mid === "demo-camille" || typeof pmPreset !== "function") return null; const p = pmPreset(mid === "demo-thomas" || mid === "demo-ines" ? "second" : poste); if (mid === "demo-thomas") p.caps.seeMoney = true, p.modules.dashboard = true, p.modules.finance = true; return p; };
    team.forEach(([mid, name, role, color, , , , , poste], i) => { const perms = demoPerms(mid, poste); put("members", { name, role, color, poste, joinedAt: now - (400 - i * 40) * 864e5, email: mid === "demo-camille" ? "camille@bistrot-demo.fr" : "", ...(perms ? { perms } : {}) }, mid); });
    /* demandes de l'équipe (js/espaces.js « Mon espace » / « Demandes de l'équipe ») */
    [["demo-sarah", "conge", 18, 21, "Mariage de ma sœur à Bordeaux", "attente", 1], ["demo-hugo", "dispo", 4, 4, "Libre tous les lundis midi ce mois-ci", "attente", 0], ["demo-lucas", "echange", 6, 6, "avec Inès Benali · je prends son soir, elle prend mon midi", "ok", 3], ["demo-sarah", "absence", -9, -9, "Rendez-vous médical le matin", "ok", 12]]
      .forEach(([mid, kind, a, b, note, status, ago]) => { const t = team.find((x) => x[0] === mid); put("esRequests", { kind, from: addDays(today, a), to: addDays(today, b), note, memberId: mid, name: t[1], staffId: "s_" + mid, status, at: now - ago * 864e5 - 3 * 36e5, uid: mid, ...(status !== "attente" ? { answeredBy: "demo-camille", answeredByName: "Camille Laurent", answeredAt: now - ago * 864e5 } : {}) }); });
    /* planning intelligent (js/planif.js) : indisponibilités et postes de renfort */
    const DEMO_PF = { "demo-hugo": { off: { 0: ["midi"], 2: ["midi"], 3: ["midi"], 4: ["midi"], 5: ["midi"], 6: ["midi"] } }, "demo-sarah": { off: { 0: ["soir"] } }, "demo-lucas": { alsoPosts: ["plonge"] }, "demo-ines": { off: { 3: ["midi"] } } };
    const staffIds = {};
    team.forEach(([mid, name, , color, jobRole, contract, weeklyHours, hourlyGross, post], i) => {
      staffIds[mid] = put("staff", { memberId: mid, name, role: jobRole, color, contract, weeklyHours, hourlyGross: hourlyGross || 24, chargesPct: contract === "Extra" ? 30 : 42, active: true, start: addDays(today, -(400 - i * 40)), post, ...(DEMO_PF[mid] || {}) }, "s_" + mid);
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
    put("lots", { name: "Fond de veau maison", productId: "p-fond", qty: 2, unit: "L", lot: "MAISON", dlc: addDays(today, -1), supplier: "Fait maison", receptionId: "", fridgeId: "fr-cf", status: "opened", openedAt: now - 2 * 864e5 - 3 * 36e5, openedBy: "demo-thomas", dlcOpen: addDays(today, -1), receivedTemp: null, code: "GG-" + rid6(), createdAt: now - 4 * 864e5, uid: "demo-ines" });
    put("lots", { name: "Mayonnaise maison", productId: "", qty: 1, unit: "kg", lot: "MAISON", dlc: today, supplier: "Fait maison", receptionId: "", fridgeId: "fr-cf", status: "opened", openedAt: now - 864e5 - 5 * 36e5, openedBy: "demo-lucas", dlcOpen: today, receivedTemp: null, code: "GG-" + rid6(), createdAt: now - 2 * 864e5, uid: "demo-lucas" });
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
      ["n-croq", { title: "Croquettes de jambon", brand: "b-huitres", cat: "Recettes", portions: 6, carte: true, carteCat: "partage", price: 9, allergens: ["gluten", "lait", "oeufs"], body: "Servies par 5 avec une mayonnaise fumée. Se congèlent panées, crues.",
        ingredients: [ing("p-jambon", "0,6", "kg"), ing("p-lait", "1", "L"), ing("p-beurre", "0,1", "kg"), ing("p-farine", "0,12", "kg"), ing("p-oeufs", "4", "pièce"), ing("p-chapelure", "0,3", "kg")],
        steps: ["Hacher finement le jambon.", "Roux blanc : beurre et farine, mouiller au lait chaud, cuire 10 min.", "Ajouter le jambon, refroidir 4 h filmé au contact.", "Façonner des boules de 35 g.", "Paner à l'anglaise : farine, œuf, panko.", "Frire 3 min à 175 °C."] }],
      ["n-planche", { title: "Planche de charcuterie", brand: "b-huitres", cat: "Recettes", portions: 1, carte: true, carteCat: "partage", price: 19, allergens: ["gluten", "lait", "oeufs", "sulfites", "moutarde", "sesame"], body: "Pour 2 personnes. Indiquer les allergènes au client : terrine (œufs, lait), cornichons (moutarde, sulfites), pain (gluten, sésame).",
        ingredients: [ing("p-jambonc", "0,06", "kg"), ing("p-saucisson", "0,05", "kg"), ing("p-terrine", "0,08", "kg"), ing("p-rillettes", "0,05", "kg"), ing("p-cornich", "0,03", "kg"), ing("p-pain", "0,25", "pièce")],
        steps: ["Sortir la charcuterie 15 min avant.", "Trancher le jambon et le saucisson à la minute.", "Dresser sur planche avec cornichons et pain grillé."] }],
      ["n-bourgui", { title: "Bœuf bourguignon", cat: "Recettes", portions: 10, carte: true, carteCat: "plat", price: 22, allergens: ["gluten", "lait", "sulfites", "celeri"], body: "Meilleur réchauffé le lendemain. Servir avec des pommes vapeur.",
        ingredients: [ing("p-paleron", "2", "kg"), ing("p-vin", "1", "L"), ing("p-carotte", "0,6", "kg"), ing("p-oignon", "0,4", "kg"), ing("p-lardons", "0,25", "kg"), ing("p-champi", "0,4", "kg"), ing("p-farine", "0,04", "kg"), ing("p-fond", "0,5", "L"), ing("p-beurre", "0,05", "kg")],
        steps: ["Couper le bœuf en cubes de 5 cm.", "Mariner 12 h au froid avec le vin et la garniture.", "Saisir, singer à la farine.", "Mouiller avec la marinade et le fond, cuire 3 h à frémissement.", "Rissoler lardons et champignons, ajouter en fin de cuisson."] }],
      ["n-huitres", { title: "Huîtres fines de claire (la douzaine)", brand: "b-huitres", cat: "Recettes", portions: 1, carte: true, carteCat: "entree", price: 24, allergens: ["mollusques", "sulfites"], body: "Ouvrir à la minute. Servir sur glace pilée avec citron et mignonnette. Stocker les huîtres À PART, loin des œufs et du lait.",
        ingredients: [ing("p-huitre", "0,25", "bourriche"), ing("p-citron", "0,05", "kg"), ing("p-echalote", "0,01", "kg")],
        steps: ["Sortir de la chambre froide au début du service : frigo de service.", "Ouvrir à la minute, retirer la première eau.", "Dresser sur glace pilée.", "En fin de service, remettre les bourriches en chambre froide."] }],
      ["n-cafe", { title: "Café gourmand", cat: "Recettes", portions: 10, carte: true, carteCat: "dessert", price: 9.5, allergens: ["lait", "oeufs", "gluten"], body: "Un café, une boule de glace vanille, un mini financier et une crème brûlée.",
        ingredients: [ing("p-glace", "0,5", "L"), ing("p-creme", "0,6", "L"), ing("p-oeufs", "8", "pièce"), ing("p-beurre", "0,2", "kg"), ing("p-farine", "0,1", "kg"), { name: "Café en grains", qty: "0,08", unit: "kg" }],
        steps: ["Crème brûlée : crème, jaunes, sucre, cuire 1 h à 95 °C.", "Financiers : beurre noisette, farine, blancs, cuire 9 min à 180 °C.", "Dresser à la minute avec le café."] }],
      ["n-proc", { title: "Ouverture de la cuisine", cat: "Procédures", body: "À faire chaque matin avant la mise en place.", steps: ["Relevé de température de tous les frigos.", "Vérifier les DLC du jour.", "Lavage des mains, tenue propre.", "Désinfecter les plans de travail."], ingredients: [], allergens: [], portions: 1 }],
    ];
    /* the plates and glasses, drawn (nothing is fetched): the kitchen and bar screens read them step by step (js/recette.js) */
    const art = typeof demoArt === "function" ? demoArt : () => "";
    const dress = { "n-croq": ["Cinq croquettes en quinconce sur l'ardoise, la mayonnaise fumée en ramequin à droite, fleur de sel au dernier moment.", "Ardoise rectangulaire", "croq"],
      "n-planche": ["Jambon en rosace à gauche, saucisson en éventail, terrine en tranche épaisse au centre, rillettes en quenelle. Cornichons et pain grillé à droite.", "Planche en bois", "planche"],
      "n-bourgui": ["Assiette creuse chaude. Trois cubes de bœuf au centre, carottes autour, lardons et champignons par-dessus, sauce nappée. Persil plat ciselé. Pommes vapeur à part.", "Assiette creuse Ø 27 cm", "bourgui"],
      "n-huitres": ["Lit de glace pilée, douze huîtres en couronne, charnière vers le centre. Citron en quartiers et mignonnette en ramequin au milieu.", "Plateau à fruits de mer", "huitres"],
      "n-cafe": ["Café à gauche, crème brûlée caramélisée à la minute au centre, financier et boule de glace à droite.", "Ardoise longue", "cafe"] };
    NOTES.forEach(([k, d]) => { const x = dress[k]; if (x) Object.assign(d, { dress: x[0], vessel: x[1], dressPh: art(x[2]), photo: art(x[2]) }); });
    Object.assign(NOTES[2][1], { stepPh: [art("cubes"), "", art("saisir"), "", ""] });
    const ds = (name, qty, unit) => ({ name, qty: String(qty), unit });
    NOTES.splice(5, 0,
      ["n-spritz", { title: "Spritz maison", cat: "Recettes", portions: 1, carte: true, carteCat: "boisson", price: 9, allergens: ["sulfites"], body: "Toujours le prosecco avant l'apéritif : il ne retombe pas au fond.", photo: art("spritz"),
        ingredients: [ds("Prosecco", 9, "cl"), ds("Apéritif à l'orange amère", 6, "cl"), ds("Eau gazeuse", 3, "cl"), ds("Orange", 1, "tranche"), ds("Glaçons", 6, "pièce")],
        steps: ["Remplir le verre de glaçons jusqu'en haut.", "Verser le prosecco, puis l'apéritif à l'orange.", "Allonger d'eau gazeuse, remuer une seule fois avec la cuillère de bar."],
        dress: "Tranche d'orange glissée contre la paroi, paille noire. Servir tout de suite.", vessel: "Verre ballon", dressPh: art("spritz") }],
      ["n-limo", { title: "Limonade maison", cat: "Recettes", portions: 1, carte: true, carteCat: "boisson", price: 4.5, allergens: [], body: "Le sirop citron se prépare le matin : 1 L de jus pour 600 g de sucre.", photo: art("limo"),
        ingredients: [ds("Sirop citron maison", 4, "cl"), ds("Eau gazeuse bien froide", 20, "cl"), ds("Menthe fraîche", 3, "feuille"), ds("Citron jaune", 1, "rondelle")],
        steps: ["Verser le sirop citron dans le verre.", "Ajouter quatre glaçons et les feuilles de menthe.", "Compléter d'eau gazeuse, remuer doucement."], dress: "Rondelle de citron sur le bord, une tige de menthe.", vessel: "Verre tumbler", dressPh: art("limo") }],
      ["n-mojito", { title: "Mojito sans alcool", cat: "Recettes", portions: 1, carte: true, carteCat: "boisson", price: 7, allergens: [], body: "Piler sans écraser : la menthe doit rester entière, sinon elle devient amère.", photo: art("mojito"),
        ingredients: [ds("Citron vert", 0.5, "pièce"), ds("Sucre de canne", 2, "c. à c."), ds("Menthe fraîche", 10, "feuille"), ds("Glace pilée", 1, "verre"), ds("Eau gazeuse", 12, "cl")],
        steps: ["Couper le demi citron vert en quatre, le mettre dans le verre avec le sucre.", "Ajouter la menthe, piler doucement 10 secondes.", "Remplir de glace pilée, compléter d'eau gazeuse.", "Remuer de bas en haut avec la cuillère de bar."],
        dress: "Bouquet de menthe en haut du verre, paille. Servir immédiatement.", vessel: "Verre highball", dressPh: art("mojito") }],
      ["n-vin", { title: "Verre de Côtes-du-Rhône", cat: "Recettes", portions: 1, carte: true, carteCat: "boisson", price: 6, allergens: ["sulfites"], body: "Ouvrir la bouteille au début du service ; bouchée sous vide le soir, 3 jours maximum.", photo: art("vin"),
        ingredients: [ds("Côtes-du-Rhône rouge", 12, "cl")], steps: ["Vérifier la température : 16 °C.", "Servir 12 cl, le doseur posé sur le verre.", "Noter la date d'ouverture sur la bouteille."], dress: "Le verre tenu par le pied, jamais par le calice.", vessel: "Verre à vin 35 cl", dressPh: art("vin") }],
      ["n-expresso", { title: "Café", cat: "Recettes", portions: 1, carte: true, carteCat: "boisson", price: 2.5, allergens: [], body: "Purger le groupe avant chaque café.", photo: art("expresso"),
        ingredients: [ds("Café moulu", 8, "g"), ds("Eau", 25, "ml")], steps: ["Purger le groupe 2 secondes.", "Doser 8 g, tasser bien à plat.", "Extraire 25 ml en 25 secondes."], dress: "Tasse chaude, soucoupe, cuillère à droite, un carré de chocolat.", vessel: "Tasse expresso", dressPh: art("expresso") }]);
    try { if (typeof noteBourguignon === "function") { const nb = noteBourguignon(); if (nb && nb.process) Object.assign(NOTES[2][1], { process: nb.process, processV: 1, processAt: now - 30 * 864e5, processBy: "demo-thomas", seed: "bourguignon" }); } } catch (e) {}
    NOTES.forEach(([k, d], i) => put("notes", { ...d, uid: "demo-thomas", at: now - (200 - i) * 864e5, updatedAt: now - (10 - i) * 864e5, photo: d.photo || "", photoId: "" }, k));

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
    const PLAN = { "demo-thomas": [["09:30", "15:00"], ["18:00", "23:00"]], "demo-ines": [["09:30", "15:00"], ["18:00", "23:00"]], "demo-lucas": [["10:00", "15:00"], ["18:30", "23:00"]], "demo-sarah": [["11:30", "15:00"], ["18:30", "23:30"]], "demo-hugo": [["19:00", "23:30"]], "demo-camille": [["10:00", "16:00"]], "demo-lea": [["18:30", "23:30"]] };
    const OFF = { "demo-thomas": [1, 2], "demo-ines": [1, 0], "demo-lucas": [1, 3], "demo-sarah": [1, 4], "demo-hugo": [1, 2, 3], "demo-camille": [1, 0], "demo-lea": [1, 2, 3, 4] };
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
    /* a fuller trail per person over two weeks, so « Mon activité » (js/espaces.js) has something true to show for each of them */
    const PEV = {
      "demo-sarah": [["salle", "a encaissé la table 4 (3 couverts)"], ["salle", "a ouvert la table 7"], ["reading", "a fait le relevé du soir"], ["chore", "a fait « Vitres de la salle »"], ["salle", "a encaissé la table 12 (6 couverts)"]],
      "demo-lucas": [["reading", "a fait le relevé du midi"], ["lot", "a étiqueté 4 bacs de fond de veau"], ["move", "a mis en place le frigo de service 2"], ["chore", "a fait « Plans de travail »"], ["reception", "a réceptionné Primeur du Marché"]],
      "demo-hugo": [["chore", "a fait « Plonge et lave-vaisselle »"], ["chore", "a fait « Sols de la cuisine »"], ["chore", "a fait « Poubelles et local »"], ["reading", "a fait le relevé du soir"]],
      "demo-thomas": [["reception", "a réceptionné Marée Atlantique"], ["lot", "a fabriqué 3 kg de bourguignon"], ["reading", "a fait le relevé du matin"], ["note", "a mis à jour la fiche « Joue de bœuf braisée »"]],
      "demo-ines": [["lot", "a fabriqué 40 tartelettes"], ["reading", "a fait le relevé du midi"], ["chore", "a fait « Chambre froide »"]],
    };
    Object.entries(PEV).forEach(([uid, L]) => { for (let d = 0; d < 14; d++) { if (rnd() < 0.3) continue; const k = 1 + Math.floor(rnd() * 3); for (let j = 0; j < k; j++) { const [type, text] = pick(L); put("events", { type, text, at: at(addDays(today, -d), d === 0 ? Math.min(hourNow, 10 + j) : 10 + j * 4, Math.floor(rnd() * 59)), uid }); } } });

    /* ── passation de service, gestes sensibles, accès temporaires (js/relais.js) ── */
    {
      const sNow = slotNow(); const prev = sNow === "midi" ? { day: addDays(today, -1), slot: "soir" } : { day: today, slot: "midi" };
      const nx = (d, s) => (s === "midi" ? { day: d, slot: "soir" } : { day: addDays(d, 1), slot: "midi" });
      const ho = (day, slot, by, byId, mood, items, note, reads) => put("handovers", { day, slot, to: nx(day, slot), mood, items: items.map((x, i) => ({ id: "it" + i, ...x })), note, ok: !items.length && !note, at: at(day, slot === "midi" ? 15 : 23, 20 + Math.floor(rnd() * 30)), uid: byId, by, byId, reads });
      ho(prev.day, prev.slot, "Thomas Girard", "demo-thomas", "charge", [
        { k: "rupture", t: "Plus de bar de ligne, la Marée livre demain 9 h" },
        { k: "rupture", t: "Il reste 4 joues de bœuf : prévenir la salle" },
        { k: "casse", t: "Le thermomètre sonde du poste chaud est tombé, il affiche n'importe quoi", auto: true },
        { k: "rappel", t: "M. Bernard (table 6) a oublié son écharpe, il passe la chercher", tel: "06 12 34 56 78" },
        { k: "prep", t: "Fond de veau à passer et refroidir avant 11 h" },
        { k: "commande", t: "Commander crème et beurre chez Duval" },
      ], "Gros service, 84 couverts. Le lave-vaisselle fuit encore un peu à gauche, seau en place.", { "demo-ines": now - 40 * 60000 });
      let d = prev.day, s = prev.slot; const H = [
        ["Inès Benali", "demo-ines", "calme", [{ k: "prep", t: "Tartelettes du soir déjà montées, au frigo 2" }], ""],
        ["Thomas Girard", "demo-thomas", "feu", [{ k: "casse", t: "Deux assiettes creuses cassées" }, { k: "rupture", t: "Plus de frites maison" }, { k: "rappel", t: "Mme Roux veut réserver 10 pers. samedi", tel: "06 98 76 54 32" }], "Table de 12 arrivée avec 40 min de retard."],
        ["Sarah Lemoine", "demo-sarah", "calme", [], ""],
        ["Lucas Petit", "demo-lucas", "charge", [{ k: "info", t: "Le frigo de service 1 ferme mal, bien pousser la porte" }], ""],
        ["Thomas Girard", "demo-thomas", "calme", [{ k: "commande", t: "Vin blanc de cuisine : dernière bouteille" }], "RAS, bonne équipe ce soir."],
      ];
      H.forEach(([by, byId, mood, items, note]) => { const p = s === "midi" ? { day: addDays(d, -1), slot: "soir" } : { day: d, slot: "midi" }; d = p.day; s = p.slot; const rd = {}; who.filter((m) => m !== byId && m !== "demo-camille").forEach((m, i) => { if (rnd() < 0.85) rd[m] = at(nx(d, s).day, nx(d, s).slot === "midi" ? 10 : 17, 5 + i * 4); }); ho(d, s, by, byId, mood, items, note, rd); });
      /* the gestures that matter: comps, cancellations, refires, with amounts (journal « Gestes sensibles ») */
      const SG = [[0, "demo-sarah", "offert", "a offert 1 × Café gourmand (table 4, client fidèle)", 9], [0, "demo-sarah", "annul", "a annulé 1 × Joue de bœuf braisée (table 7, erreur de saisie)", 18], [1, "demo-sarah", "offert", "a offert 2 × Verre de Chablis (table 12, attente trop longue)", 16], [1, "demo-thomas", "annul", "a refait 1 × Entrecôte (table 3, cuisson ratée)", 26], [2, "demo-sarah", "offert", "a offert 1 × Tarte fine aux pommes (table 9, anniversaire)", 8], [2, "demo-sarah", "annul", "a annulé 2 × Menu du jour (table 5, partis avant le plat, déjà en cuisine)", 38], [3, "demo-hugo", "offert", "a offert 1 × Digestif (table 2)", 7], [4, "demo-sarah", "offert", "a offert 3 × Café (table 11)", 7.5], [5, "demo-camille", "offert", "a offert l'apéritif à la table 8 (habitués)", 24], [5, "demo-sarah", "modif", "a remis au tarif 1 × Dessert du jour (table 6)", 0], [6, "demo-sarah", "annul", "a annulé 1 × Planche mixte (table 1, rupture)", 19], [8, "demo-ines", "annul", "a refait 1 × Bar de ligne (table 10, arête)", 24]];
      SG.forEach(([ago, uid, k, text, amt], i) => put("events", { type: "salle", k, text, amt, at: at(addDays(today, -ago), ago === 0 ? Math.max(10, Math.min(hourNow, 13)) : 12 + (i % 9), 5 + i * 3), uid }));
      put("events", { type: "team", k: "acces", text: "a ouvert un accès temporaire à Hugo Martin (extra, 3 jours)", at: now - 2 * 864e5, uid: "demo-camille" });
      put("events", { type: "team", k: "acces", text: "L'accès de Jade Moreau (stagiaire) s'est fermé tout seul", at: now - 4 * 864e5, uid: "demo-camille" });
      /* Hugo is an extra for three more days; Jade's internship ended four days ago */
      Object.assign(D[P("members")]["demo-hugo"], { until: now + 3 * 864e5, tmp: { why: "extra" }, tmpFrom: now - 2 * 864e5 });
      put("members", { name: "Jade Moreau", role: "equipe", color: "#9A5BD6", poste: "cuisine", joinedAt: now - 32 * 864e5, email: "", until: now - 4 * 864e5, tmp: { why: "stage" }, tmpFrom: now - 32 * 864e5 }, "demo-jade");
    }
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
    /* ── bank already linked (js/banque.js), so Finances shows real bank lines from the first tap ── */
    if (typeof bqDemoData === "function") { const B = bqDemoData(); put("bank", B.link, "eb_demo"); B.tx.forEach(([k, t]) => put("bankTx", t, k)); }
    /* ── multi-restaurant (js/multi.js): two sister restaurants of the same owner, reshaped from this one, and transfers between them ── */
    if (typeof mrDemoSisters === "function") { try { mrDemoSisters(D, RID, rnd); } catch (e) { console.warn("demo sites", e); } }
    /* ── discussion groups (js/consignes.js): Cuisine and Salle talk apart, a custom group, and one group shared by the three restaurants ── */
    {
      const mn = (k) => now - k * 60000;
      [["demo-thomas", "Thomas Girard", "Mise en place du soir : 40 croquettes, 2 bacs de purée, le jus de joue est au frigo 2.", 180], ["demo-lucas", "Lucas Petit", "C'est parti, je fais les croquettes en premier.", 172], ["demo-ines", "Inès Benali", "Je prends la purée. Il reste de la crème pour demain ?", 90], ["demo-thomas", "Thomas Girard", "Oui, 2 L dans la chambre froide.", 84]]
        .forEach(([uid, by, text, k]) => put("chat", { text, at: mn(k), uid, by, g: "cuisine" }));
      [["demo-sarah", "Sarah Lemoine", "La 8 a demandé du pain sans gluten, on en a encore ?", 50], ["demo-camille", "Camille Laurent", "Oui, dans le tiroir du bas au bar.", 46], ["demo-sarah", "Sarah Lemoine", "Ce soir je fais l'ouverture de la terrasse à 18 h 30.", 22]]
        .forEach(([uid, by, text, k]) => put("chat", { text, at: mn(k), uid, by, g: "salle" }));
      put("chatGroups", { name: "Ouverture du matin", kind: "custom", add: ["demo-camille", "demo-lucas", "demo-hugo"], remove: [], c: "#0B9B6A", ic: "csChat", at: now - 30 * 864e5, by: "Camille Laurent", uid: "demo-camille" }, "g-matin");
      put("chat", { text: "Demain j'ouvre à 7 h 30, Hugo tu passes la plonge du petit-déj ?", at: mn(300), uid: "demo-camille", by: "Camille Laurent", g: "g-matin" });
      put("chat", { text: "Ça marche, je serai là.", at: mn(290), uid: "demo-hugo", by: "Hugo Martin", g: "g-matin" });
      const SIS = [[RID, "Le Bistrot Démo"], ["demo2", "Le Comptoir Démo"], ["demo3", "La Cantine du Port"]].filter(([r]) => D.restos[r]);
      if (SIS.length > 1) {
        const sites = SIS.map(([rid, name]) => ({ rid, name }));
        const G = { name: "Les 3 restaurants", kind: "multi", add: [], remove: [], sites, c: "#7A4DFF", ic: "mrShare", at: now - 60 * 864e5, by: "Camille Laurent", uid: "demo-camille" };
        const MS = [["m3r1", "demo-camille", "Camille Laurent", RID, "Réunion des responsables lundi 15 h à La Cantine du Port. Venez avec vos chiffres de la semaine.", 240], ["m3r2", "demo-karim", "Karim Haddad", "demo3", "Parfait, je prépare la salle du fond.", 200], ["m3r3", "demo-julien", "Julien Morel", "demo2", "Le Comptoir a 3 kg de frites en trop, quelqu'un en veut ?", 65]];
        SIS.forEach(([rid]) => {
          (D[`restos/${rid}/chatGroups`] ||= {})["g-3restos"] = JSON.parse(JSON.stringify(G));
          MS.forEach(([mid, uid, by, from, text, k]) => { (D[`restos/${rid}/chat`] ||= {})[mid] = { text, at: mn(k), uid, by, g: "g-3restos", ...(from !== rid ? { from: { rid: from, name: SIS.find((x) => x[0] === from)[1] } } : {}) }; });
        });
      }
    }
    return { rid: RID, data: D, me: { id: "demo-camille", name: "Camille Laurent", color: "#4A1FE6" } };
  },
};
