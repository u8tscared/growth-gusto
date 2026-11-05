// Generates realistic sample exports for the « Importer » screen (js/import.js).
// node tools/import-samples/make.js  → writes the files next to this script.
const fs = require("fs"), path = require("path");
const X = require(path.join(__dirname, "../../vendor/xlsx.full.min.js"));
const D = __dirname; const out = (n, data) => fs.writeFileSync(path.join(D, n), data);
const pad = (n) => String(n).padStart(2, "0");
let seed = 42; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const day = (back) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - back); return d; };
const fr = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dec = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
const csv = (rows, sep = ";") => rows.map((r) => r.map((c) => { const s = String(c ?? ""); return s.includes(sep) || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; }).join(sep)).join("\r\n");
const xlsx = (name, sheets) => { const wb = X.utils.book_new(); for (const [n, rows] of sheets) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows, { cellDates: true }), n); out(name, X.write(wb, { type: "buffer", bookType: "xlsx" })); };
/* windows-1252 for the CSV that Excel (FR) saves by default */
const cp1252 = (s) => Buffer.from([...s].map((ch) => { const c = ch.charCodeAt(0); const m = { 0x20ac: 0x80, 0x153: 0x9c, 0x152: 0x8c, 0x2019: 0x92, 0x2026: 0x85 }; return c < 256 ? c : m[c] || 63; }));

// 1. Traqfood · relevés de température (CSV ; cp1252, title line, dd/mm/yyyy + heure, comma decimals)
{
  const eq = [["Chambre froide positive", 2.2, 1.4], ["Frigo de service", 3.1, 1.6], ["Saladette", 3.4, 1.4], ["Congélateur", -19.5, 2.5]];
  const rows = [["Traqfood - Export des relevés de température"], ["Établissement : Le Bistrot des Halles"], [], ["Date du relevé", "Heure", "Enceinte", "Température relevée (°C)", "Conformité", "Action corrective", "Opérateur"]];
  for (let b = 45; b >= 1; b--) for (const h of ["08:55", "18:20"]) for (const [n, base, sp] of eq) {
    let v = base + (rnd() - 0.5) * sp; let ok = "Conforme", act = "";
    if (n === "Frigo de service" && b === 12 && h === "18:20") { v = 6.8; ok = "Non conforme"; act = "Porte mal fermée, refermée"; }
    rows.push([fr(day(b)), h, n, dec(v), ok, act, ["Julie", "Karim", "Léa"][Math.floor(rnd() * 3)]]);
  }
  out("traqfood_releves_temperature.csv", cp1252(csv(rows)));
}
// 2. Excel « maison » · relevés : one column per fridge, real Excel dates
{
  const rows = [["Relevés températures - Cuisine"], ["Date", "Matin / Soir", "Frigo pâtisserie", "Chambre froide", "Congélateur 1"]];
  for (let b = 20; b >= 1; b--) for (const s of ["Matin", "Soir"]) rows.push([day(b), s, Math.round((3 + rnd()) * 10) / 10, Math.round((1.8 + rnd()) * 10) / 10, Math.round((-19 - rnd() * 2) * 10) / 10]);
  xlsx("releves_excel_maison.xlsx", [["Octobre", rows]]);
}
// 3. Koust · mercuriale + fiches techniques (XLSX, 2 sheets, capitals, numbers as cells)
const PRODS = [["A101", "BEURRE DOUX 82% 1KG", "Crèmerie", "KG", 8.9, 5.5, "METRO", "Lait", 6], ["A102", "CRÈME LIQUIDE 35% UHT", "Crèmerie", "L", 4.2, 5.5, "METRO", "Lait", 12], ["A103", "OEUFS FRAIS PLEIN AIR", "Crèmerie", "pce", 0.32, 5.5, "Ferme des Saules", "Oeufs", 180],
  ["A104", "FARINE DE BLÉ T55", "Épicerie", "kg", 0.95, 5.5, "METRO", "Gluten", 25], ["A105", "SUCRE SEMOULE", "Épicerie", "kg", 1.1, 5.5, "METRO", "", 10], ["A106", "FILET DE CABILLAUD", "Marée", "kg", 21.5, 5.5, "Marée Atlantique", "Poissons", 3],
  ["A107", "PARMESAN 24 MOIS", "Crèmerie", "kg", 24, 5.5, "Fromagerie Laurent", "Lait", 2], ["A108", "MOUTARDE DE DIJON", "Épicerie", "kg", 3.6, 5.5, "METRO", "Moutarde", 2], ["A109", "SAUMON FUMÉ TRANCHÉ", "Marée", "kg", 32, 5.5, "Marée Atlantique", "Poissons", 1.5],
  ["A110", "PÂTE FEUILLETÉE PUR BEURRE", "Surgelés", "kg", 6.4, 5.5, "METRO", "Gluten, lait", 4], ["A111", "HUILE D'OLIVE VIERGE EXTRA", "Épicerie", "L", 9.9, 5.5, "METRO", "", 5], ["A112", "SAUCE SOJA", "Épicerie", "L", 5.1, 5.5, "METRO", "Soja, gluten", 1],
  ["A113", "NOISETTES DÉCORTIQUÉES", "Épicerie", "kg", 14.8, 5.5, "METRO", "Fruits à coque", 1], ["A114", "POMMES GOLDEN", "Fruits et légumes", "kg", 2.3, 5.5, "Primeurs du Marché", "", 8], ["A115", "ÉCHALOTES", "Fruits et légumes", "kg", 3.2, 5.5, "Primeurs du Marché", "", 3],
  ["A116", "PALERON DE BOEUF", "Boucherie", "kg", 16.9, 5.5, "Boucherie Martin", "", 6], ["A117", "VIN ROUGE BOURGOGNE", "Boissons", "bouteille", 7.5, 20, "Cave Saint-Vincent", "Sulfites", 24], ["A118", "CREVETTES ROSES CUITES", "Marée", "kg", 18, 5.5, "Marée Atlantique", "Crustacés", 2],
  ["A119", "GRAINES DE SÉSAME", "Épicerie", "kg", 8.2, 5.5, "METRO", "Sésame", 0.5], ["A120", "CÉLERI RAVE", "Fruits et légumes", "kg", 1.9, 5.5, "Primeurs du Marché", "Céleri", 4], ["A101", "BEURRE DOUX 82% 1KG", "Crèmerie", "KG", 8.9, 5.5, "METRO", "Lait", 6]];
{
  const p = [["Code article", "Désignation", "Famille", "Unité de stock", "Prix HT", "TVA", "Fournisseur", "Allergènes", "Stock"], ...PRODS];
  const r = [["Nom de la recette", "Ingrédient", "Quantité nette", "Unité", "Nombre de portions", "Prix de vente TTC", "Catégorie"],
    ["Tarte fine aux pommes", "Pâte feuilletée pur beurre", 250, "g", 6, 9.5, "Dessert"], ["", "Pommes golden", 4, "pièce", "", "", ""], ["", "Beurre doux 82% 1kg", 40, "g", "", "", ""], ["", "Sucre semoule", 50, "g", "", "", ""],
    ["Cabillaud, beurre blanc", "Filet de cabillaud", 1.2, "kg", 8, 24, "Plat"], ["", "Échalotes", 80, "g", "", "", ""], ["", "Beurre doux 82% 1kg", 250, "g", "", "", ""], ["", "Crème liquide 35% UHT", 10, "cl", "", "", ""],
    ["Bœuf bourguignon", "Paleron de boeuf", 1.6, "kg", 6, 21, "Plat"], ["", "Vin rouge Bourgogne", 75, "cl", "", "", ""], ["", "Farine de blé T55", 30, "g", "", "", ""]];
  xlsx("koust_mercuriale_et_fiches.xlsx", [["Articles", p], ["Fiches techniques", r]]);
}
// 4. Fournisseurs (CSV , UTF-8 BOM)
out("fournisseurs.csv", "﻿" + csv([["Fournisseur", "Contact", "Téléphone", "E-mail", "Adresse", "Jours de livraison", "Notes"],
  ["METRO", "Service pro", "01 41 00 00 00", "pro@metro.example", "ZI Nord, Lyon", "Lundi, jeudi", "Franco 300 €"], ["Marée Atlantique", "Yann Le Goff", "02 98 11 22 33", "yann@maree.example", "Quai du Port, Concarneau", "Mardi, vendredi", ""],
  ["Boucherie Martin", "Paul Martin", "04 78 22 33 44", "", "8 rue des Halles, Lyon", "Mercredi", "Commande la veille avant 16 h"], ["Primeurs du Marché", "Sophie Bernard", "04 72 33 44 55", "sophie@primeurs.example", "", "Tous les jours", ""],
  ["Cave Saint-Vincent", "Luc Moreau", "03 80 44 55 66", "contact@cave.example", "Beaune", "Vendredi", ""]], ","));
// 5. Équipe (XLSX, prénom/nom séparés, salaire mensuel, dates Excel)
xlsx("registre_personnel.xlsx", [["Personnel", [["Prénom", "Nom", "Poste", "Type de contrat", "Heures hebdo", "Salaire brut mensuel", "Date d'embauche", "Date de sortie", "E-mail"],
  ["Julie", "MARTIN", "Commis de cuisine", "CDI", 35, 1850, new Date(2024, 8, 2), "", "julie@exemple.fr"], ["Karim", "BENALI", "Second de cuisine", "CDI", 39, 2450, new Date(2022, 2, 14), "", ""],
  ["Léa", "DUBOIS", "Serveuse", "CDD saisonnier", 30, 1520, new Date(2026, 4, 1), new Date(2026, 9, 31), ""], ["Tom", "ROUX", "Plongeur", "Extra", 15, "", new Date(2026, 6, 1), "", ""],
  ["Inès", "MOREAU", "Apprentie cuisinière", "Contrat d'apprentissage", 35, 980, new Date(2025, 8, 1), "", ""]]]]);
// 6. Plan de nettoyage (CSV ;)
out("plan_de_nettoyage.csv", csv([["Zone", "Surface / matériel", "Fréquence", "Moment", "Produit", "Méthode", "Responsable"],
  ["Cuisine", "Plans de travail", "Après chaque service", "", "Dégraissant alimentaire", "Pulvériser, laisser agir 5 min, rincer", "Commis"], ["Cuisine", "Sols", "Quotidienne", "Fermeture", "Détergent sol", "Balayer puis laver à la monobrosse", "Plongeur"],
  ["Chambre froide", "Étagères et parois", "Hebdomadaire (lundi)", "Ouverture", "Désinfectant D10", "Vider, laver, désinfecter, ranger", "Second"], ["Cuisine", "Hotte et filtres", "Hebdomadaire", "Fermeture", "Dégraissant", "Filtres au lave-vaisselle", "Plongeur"],
  ["Plonge", "Lave-vaisselle", "Tous les jours", "Fermeture", "Détartrant", "Vidanger, nettoyer les bras", "Plongeur"], ["WC", "Sanitaires clients", "2x par jour", "", "Désinfectant", "", "Salle"], ["Cuisine", "Four mixte", "Mensuel", "", "Nettoyant four", "Programme de nettoyage", "Chef"]]));
// 7. Obligations (JSON)
out("controles_obligatoires.json", JSON.stringify({ controles: [
  { controle: "Vérification des extincteurs", prestataire: "SÉCURIFEU", telephone: "01 23 45 67 89", periodicite: "Annuelle", dernier_passage: iso(day(240)) },
  { controle: "Dératisation / désinsectisation", prestataire: "Hygiène 3D Services", periodicite: "Trimestrielle", dernier_passage: iso(day(70)), contrat: "HD-2231" },
  { controle: "Nettoyage hotte et conduits", prestataire: "Net'Hotte", periodicite: "Semestrielle", dernier_passage: iso(day(200)), prochaine_echeance: iso(day(-15)) },
  { controle: "Analyses microbiologiques", prestataire: "Labo Rhône Analyses", periodicite: "tous les 6 mois", dernier_passage: iso(day(30)) },
  { controle: "Contrôle de la balance", prestataire: "Métrologie Pro", periodicite: "Tous les 2 ans", dernier_passage: iso(day(400)) }] }, null, 2));
// 8. Octopus HACCP · réceptions (CSV ;, one line per product, BL filled down)
{
  const rows = [["Date de réception", "Fournisseur", "N° BL", "Produit", "Quantité", "Unité", "Température", "DLC", "N° de lot", "Conformité", "Motif"]];
  const recs = [[6, "Marée Atlantique", "BL-48213", [["Filet de cabillaud", 3, "kg", 1.8, 4, "C2611"], ["Crevettes roses cuites", 2, "kg", 2.4, 6, "CR118"]]], [4, "METRO", "F-99120", [["Crème liquide 35% UHT", 6, "L", 3.5, 20, "L4412"], ["Beurre doux 82% 1kg", 5, "kg", 4.1, 40, "B1180"], ["Pâte feuilletée pur beurre", 4, "kg", -19, 120, "PF22"]]], [2, "Boucherie Martin", "BM-552", [["Paleron de boeuf", 6, "kg", 6.9, 5, "BM0927"]]]];
  for (const [b, sup, bl, L] of recs) L.forEach(([n, q, u, t, dl, lot], i) => rows.push([i ? "" : fr(day(b)), i ? "" : sup, i ? "" : bl, n, q, u, dec(t), fr(day(b - dl)), lot, t > 4 && t > 0 ? "Non conforme" : "Conforme", t > 4 && t > 0 ? "Température trop haute, livreur prévenu" : ""]));
  out("octopus_receptions.csv", csv(rows));
}
// 9. Recettes (JSON, nested ingredients, allergens as text)
out("recettes_export.json", JSON.stringify([
  { nom: "Velouté de céleri, noisettes", portions: 10, allergenes: "céleri, lait, fruits à coque", etapes: "1. Éplucher et tailler le céleri. 2. Suer au beurre. 3. Mouiller, cuire 25 min. 4. Mixer, crémer, servir avec les noisettes.", ingredients: [{ nom: "Céleri rave", quantite: "1,5", unite: "kg" }, { nom: "Crème liquide 35% UHT", quantite: "20", unite: "cl" }, { nom: "Noisettes décortiquées", quantite: "80", unite: "g" }] },
  { nom: "Mousse au chocolat", portions: 8, allergenes: "oeufs, lait", etapes: "Fondre le chocolat\nMonter les blancs\nIncorporer délicatement", ingredients: [{ nom: "Chocolat noir 70%", quantite: "250", unite: "g" }, { nom: "Oeufs frais plein air", quantite: "6", unite: "pièce" }] }], null, 2));
// 10. Inpulse · ingrédients with one column per allergen (X marks), DLC + lots, ISO dates
{
  const rows = [["Nom ingrédient", "Catégorie", "Unité d'inventaire", "Prix par unité", "Fournisseur", "Gluten", "Lait", "Oeufs", "Fruits à coque", "Stock", "DLC", "Lot"],
    ["Brioche tranchée", "Boulangerie", "pce", "0,45", "Boulangerie Pain d'Or", "X", "X", "X", "", "40", iso(day(-4)), "BR-77"], ["Mozzarella di bufala", "Crèmerie", "pce", "1,90", "Fromagerie Laurent", "", "X", "", "", "12", iso(day(-6)), "MZ-310"],
    ["Pesto au basilic", "Épicerie fine", "kg", "18,00", "Metro", "", "X", "", "X", "1", iso(day(-30)), "PS-09"], ["Yaourt nature", "Crèmerie", "pce", "0,38", "Ferme des Saules", "", "X", "", "", "24", iso(day(3)), "YN-12"]];
  out("inpulse_ingredients.csv", csv(rows));
}
// 11. A table nobody can guess (manual mapping)
out("tableau_inconnu.csv", csv([["Truc", "Machin", "Bidule"], ["Lundi", "12", "A"], ["Mardi", "8", "B"]]));
console.log("samples written to", D);
