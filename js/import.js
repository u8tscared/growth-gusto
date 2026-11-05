/* Growth Gusto — area: import (« Importer depuis un autre logiciel »). Prefix « im ».
   Route `import`: drop or choose files (CSV, TSV, XLSX / XLS / ODS, JSON, several at once) or paste cells copied from a spreadsheet.
   Each sheet becomes a table: header row found, kind detected (produits & stock, fournisseurs, recettes, équipements, relevés,
   réceptions, équipe, nettoyage, obligations), columns mapped with French / English synonyms and the header patterns of known
   exports (Traqfood, Octopus HACCP, ePackPro, RestoPil, Koust, Melba, Inpulse, Excel « maison »). Never fails: an unknown table
   gets the manual mapping sheet (dropdowns + 5-row preview).
   Review shows counts and duplicates (update or keep the existing), the import runs in batches with a progress ring, and can be
   undone as a whole. Shapes written are exactly the owning areas' ones (see the builders below):
     products (+ counts of the month, + lots with a future DLC), suppliers, notes (cat Recettes), fridges, readings, receptions,
     staff, chores, obligations (+ oblLogs for the last visit).
   Every created doc carries importId. Collection "imports" (history + undo):
     { at, uid, by, files[], source, counts{kind:n}, created{col:[id]}, updated{col:[{id, before}]}, total, state, undone?, undoneAt? }
   Collection "suppliers" (new, written here): { name, contact?, phone?, email?, address?, siret?, days?, notes?, cat?, createdAt, importId? }
   SheetJS (vendor/xlsx.full.min.js) is loaded on demand; a small built-in XLSX reader takes over when it cannot load (offline).
   API: window.IMPORT = { open(kind?), kinds } */
"use strict";

Object.assign(IC, {
  imUp: ["M12 15V4", "m7 9 5-5 5 5", "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3", "f:M4 15h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"],
  imPaste: ["r:8,2,8,4,1", "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M8 12h8", "M8 16h5", "f:M4 6h16v14H4z"],
  imUndo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  imFile: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v5h5", "M8 13h8", "M8 17h8", "f:M6 3h8v4h5v13H5z"],
  imCols: ["r:3,3,18,18,3", "M9 3v18", "M3 9h18", "f:M3 3h18v6H3z"],
  imSup: ["M3 21h18", "M5 21V8l7-5 7 5v13", "M9 21v-6h6v6", "f:M5 8l7-5 7 5v13H5z"],
  imPlay: ["c:12,12,9", "M10 8.5v7l6-3.5z", "f:M10 8.5v7l6-3.5z"],
});

/* ───────────── kinds and their fields ─────────────
   field: [key, label, synonyms (normalized, | separated), weight]. A table is of a kind only when need(map) holds. */
const IM_K = {
  products: { t: "Produits & stock", one: "produit", pl: "produits", ic: "box", w: "to", go: "stock",
    kw: /produit|article|stock|inventaire|mercuriale|catalogue|ingredient|matiere|tarif|product|item|denree/,
    need: (m) => m.name != null && ["unit", "price", "zone", "qty", "dlc", "supplier", "allergens", "ref", "ean", "vat", "minQty"].some((k) => m[k] != null),
    f: [
      ["name", "Nom", "nom|produit|designation|libelle|article|nom du produit|nom produit|designation article|libelle article|libelle produit|nom article|product|product name|name|item|item name|ingredient|nom ingredient|nom de l ingredient|matiere premiere|denomination|intitule|denree", 0.7],
      ["unit", "Unité", "unite|unit|unite de stock|unite d achat|unite inventaire|unite d inventaire|uom|unite de mesure|u|un", 1],
      ["zone", "Zone ou catégorie", "zone|categorie|famille|rayon|stockage|lieu de stockage|emplacement|zone de stockage|category|family|sous famille|storage|location|rangement|type de produit|groupe", 0.9],
      ["price", "Prix HT", "prix|prix ht|prix unitaire|prix unitaire ht|pu ht|pu|prix d achat|prix d achat ht|prix achat|prix achat ht|cout|cout unitaire|tarif|tarif ht|price|unit price|cost|purchase price|dernier prix", 1.2],
      ["vat", "TVA", "tva|taux tva|taux de tva|vat|tax|taxe|tva %", 1],
      ["supplier", "Fournisseur", "fournisseur|fournisseur principal|supplier|vendor|grossiste|fourn|nom du fournisseur", 1],
      ["qty", "Quantité en stock", "stock|quantite|qte|qty|quantity|quantite en stock|stock actuel|en stock|stock theorique|stock reel|quantite inventaire|on hand|qte stock|qte en stock|stock final", 1],
      ["minQty", "Stock minimum", "stock min|stock minimum|seuil|seuil d alerte|seuil mini|minimum|stock d alerte|reorder point|par level|stock de securite|mini", 1],
      ["allergens", "Allergènes", "allergenes|allergene|allergens|allergen|allergies|liste des allergenes", 1.2],
      ["dlc", "DLC", "dlc|date limite|date limite de consommation|dluo|ddm|date de peremption|peremption|expiry|expiry date|expiration|date d expiration|best before|use by|dlc ddm|dlc dluo", 1.2],
      ["lot", "N° de lot", "lot|n lot|numero de lot|no lot|num lot|batch|lot number|n de lot|lot fournisseur", 1.1],
      ["ref", "Référence", "reference|ref|code|code article|sku|ref fournisseur|code fournisseur|code produit|item code|ref article|code interne", 0.8],
      ["ean", "Code-barres", "ean|code barre|code barres|gtin|barcode|ean13|ean 13|code ean", 1],
    ] },
  suppliers: { t: "Fournisseurs", one: "fournisseur", pl: "fournisseurs", ic: "imSup", w: "sa", go: "reception",
    kw: /fournisseur|supplier|vendor|grossiste|prestataire|contacts?/,
    need: (m) => m.name != null && ["contact", "phone", "email", "address", "siret", "days"].some((k) => m[k] != null),
    f: [
      ["name", "Fournisseur", "fournisseur|nom|raison sociale|societe|entreprise|supplier|vendor|company|nom du fournisseur|name|denomination|enseigne|nom fournisseur", 0.8],
      ["contact", "Contact", "contact|interlocuteur|commercial|representant|contact name|nom du contact|personne a contacter", 1.2],
      ["phone", "Téléphone", "telephone|tel|portable|mobile|phone|numero de telephone|fixe|tel fixe|tel portable|n telephone|telephone commande", 1.3],
      ["email", "E-mail", "email|e mail|mail|courriel|adresse email|adresse mail|adresse e mail|mail commande", 1.3],
      ["address", "Adresse", "adresse|address|rue|adresse postale|adresse complete", 1.1],
      ["siret", "SIRET", "siret|siren|tva intracom|n tva|numero tva|tva intracommunautaire|n siret", 1.2],
      ["days", "Jours de livraison", "jours de livraison|jour de livraison|delivery days|passage|jours de passage|livraison", 1.2],
      ["cat", "Catégorie", "categorie|type|famille|specialite|activite|secteur", 0.6],
      ["notes", "Notes", "notes|note|commentaire|commentaires|remarques|observations|comment|info|infos|conditions", 0.5],
    ] },
  recipes: { t: "Recettes & allergènes", one: "recette", pl: "recettes", ic: "book", w: "vi", go: "notes",
    kw: /recette|fiche|plat|carte|menu|recipe|technique/,
    need: (m) => m.title != null && ["ingredient", "portions", "steps", "allergens", "price"].some((k) => m[k] != null),
    f: [
      ["title", "Recette", "recette|nom de la recette|nom recette|plat|fiche technique|fiche|titre|nom du plat|recipe|recipe name|dish|dish name|intitule|nom|libelle recette|nom de la fiche|preparation", 1.1],
      ["ingredient", "Ingrédient", "ingredient|ingredients|composant|composants|denree|matiere premiere|ingredient name|nom ingredient|nom de l ingredient|produit|article|composition", 1.3],
      ["qty", "Quantité", "quantite|qte|quantite nette|quantite brute|qty|quantity|poids|grammage|dose|quantite utilisee|qte nette|qte brute", 1],
      ["unit", "Unité", "unite|unit|u|uom|unite de mesure", 0.8],
      ["portions", "Portions", "portions|nb portions|nombre de portions|couverts|nb couverts|nombre de couverts|rendement|yield|servings|parts|nb parts|pour", 1.3],
      ["allergens", "Allergènes", "allergenes|allergene|allergens|allergen|allergies|liste des allergenes", 1.2],
      ["steps", "Étapes", "etapes|procede|progression|methode|instructions|method|steps|deroulement|technique|mode operatoire|deroule|etapes de preparation", 1.2],
      ["price", "Prix de vente", "prix de vente|prix de vente ttc|pv ttc|prix ttc|prix carte|selling price|prix vente|pv|tarif carte|prix", 1],
      ["cat", "Catégorie", "categorie|type de plat|famille|section|course|rubrique|type", 0.6],
    ] },
  fridges: { t: "Équipements froids", one: "équipement", pl: "équipements", ic: "fridge", w: "sk", go: "frigos",
    kw: /equipement|enceinte|frigo|froid|materiel|appareil|fridge|chambre/,
    need: (m) => m.name != null && (m.min != null || m.max != null || m.type != null),
    f: [
      ["name", "Équipement", "equipement|enceinte|nom|appareil|frigo|enceinte froide|nom de l equipement|materiel|equipment|fridge|name|designation|libelle|nom equipement", 0.9],
      ["type", "Type", "type|type d equipement|categorie|famille|nature|type enceinte", 1],
      ["min", "Température min", "min|minimum|temperature min|temperature minimum|t min|tmin|seuil bas|seuil min|consigne min|limite basse|low|seuil mini|min c", 1.4],
      ["max", "Température max", "max|maximum|temperature max|temperature maximum|t max|tmax|seuil haut|seuil max|consigne max|limite haute|high|seuil|consigne|seuil maxi|max c|temperature cible", 1.4],
    ] },
  readings: { t: "Relevés de température", one: "relevé", pl: "relevés", ic: "therm", w: "vi", go: "registre",
    kw: /releve|temperature|temp|froid|enregistrement|haccp|sonde/,
    need: (m) => m.value != null && m.fridge != null && m.date != null,
    f: [
      ["fridge", "Équipement", "equipement|enceinte|appareil|frigo|nom de l equipement|materiel|equipment|fridge|sonde|capteur|enceinte froide|point de controle|device|sensor|chambre froide|nom enceinte|lieu|zone", 1],
      ["date", "Date", "date|date du releve|date releve|jour|date et heure|date heure|horodatage|timestamp|datetime|date time|date de mesure|date de releve|date mesure|le", 0.9],
      ["time", "Heure", "heure|heure du releve|time|horaire|heure releve|heure de releve|a", 0.8],
      ["value", "Température", "temperature|temp|t|t c|valeur|valeur relevee|mesure|releve|temperature relevee|t releve|t relevee|degres|temperature c|value|reading|temperature mesuree|temp c|t mesuree", 1.6],
      ["slot", "Service", "service|creneau|moment|periode|matin soir|midi soir", 0.8],
      ["action", "Action corrective", "action corrective|actions correctives|mesure corrective|corrective action|commentaire|remarque|observation|comment|note|action", 1],
      ["who", "Fait par", "operateur|utilisateur|par|salarie|employe|responsable|releve par|user|operator|signature|auteur|visa|fait par|realise par|nom", 0.6],
      ["ok", "Conforme", "conforme|conformite|statut|etat|resultat|alerte|status|ok|compliant|anomalie", 0.9],
    ] },
  receptions: { t: "Réceptions", one: "livraison", pl: "livraisons", ic: "truck", w: "sa", go: "registre",
    kw: /reception|livraison|delivery|arrivage|bon de livraison|tracabilite/,
    need: (m) => m.name != null && m.date != null && (m.supplier != null || m.bl != null) && ["temp", "bl", "dlc", "lot", "ok", "qty"].some((k) => m[k] != null),
    f: [
      ["date", "Date", "date|date de reception|date reception|date livraison|date de livraison|livre le|received|delivery date|jour|recu le|date d arrivee", 1.1],
      ["time", "Heure", "heure|heure de reception|heure livraison|time", 0.6],
      ["supplier", "Fournisseur", "fournisseur|supplier|vendor|grossiste|fourn|nom du fournisseur|expediteur", 1.1],
      ["bl", "N° de BL", "bl|n bl|numero bl|bon de livraison|n bon|n de bl|num bl|numero de bon|numero du bon|facture|n facture|delivery note|n bon de livraison|ref bl", 1.5],
      ["name", "Produit", "produit|designation|article|libelle|nom|product|item|denree|nom du produit|libelle produit", 0.8],
      ["qty", "Quantité", "quantite|qte|qty|quantity|poids|quantite livree|qte livree|colis", 0.8],
      ["unit", "Unité", "unite|unit|u|uom", 0.6],
      ["temp", "Température", "temperature|temp|t|t c|temperature a reception|t reception|temperature produit|t produit|temperature reception|temp c|t a reception|temperature c", 1.4],
      ["dlc", "DLC", "dlc|date limite|dluo|ddm|date de peremption|expiry|dlc ddm|date limite de consommation", 1.1],
      ["lot", "N° de lot", "lot|n lot|numero de lot|no lot|batch|n de lot|lot fournisseur", 1.1],
      ["price", "Prix HT", "prix|prix ht|pu ht|prix unitaire|prix unitaire ht|price|unit price", 0.7],
      ["ok", "Conforme", "conforme|conformite|statut|decision|accepte|etat|resultat|controle|status", 1.1],
      ["reason", "Motif", "motif|commentaire|remarque|observation|reserve|non conformite|raison|comment|motif de refus|observations", 0.7],
      ["type", "Type", "type|categorie|famille|conservation|type de produit|temperature de conservation", 0.5],
    ] },
  staff: { t: "Équipe", one: "salarié", pl: "salariés", ic: "users", w: "mi", go: "staff",
    kw: /personnel|salarie|employe|equipe|staff|rh|collaborateur|effectif|registre du personnel/,
    need: (m) => (m.name != null || m.first != null) && ["role", "contract", "hours", "rate", "monthly", "start", "post"].some((k) => m[k] != null),
    f: [
      ["name", "Nom", "nom|nom complet|salarie|employe|collaborateur|nom et prenom|nom prenom|prenom nom|name|full name|employee|staff|nom de famille|last name|lastname|surname", 1],
      ["first", "Prénom", "prenom|first name|firstname|given name", 1.2],
      ["role", "Poste", "poste|fonction|role|emploi|intitule de poste|job|job title|position|qualification|metier|intitule du poste", 1.3],
      ["post", "Service", "service|secteur|equipe|departement|team|brigade", 0.8],
      ["contract", "Contrat", "contrat|type de contrat|contract|nature du contrat|type contrat", 1.4],
      ["hours", "Heures par semaine", "heures hebdo|heures|heures par semaine|h semaine|temps de travail|duree hebdomadaire|weekly hours|hours|volume horaire|base horaire|heures contrat|horaire hebdomadaire|h hebdo", 1.3],
      ["rate", "Taux horaire brut", "taux horaire|taux horaire brut|salaire horaire|brut horaire|hourly rate|taux|salaire horaire brut|taux brut", 1.3],
      ["monthly", "Salaire brut mensuel", "salaire|salaire brut|salaire mensuel|brut mensuel|salaire brut mensuel|monthly salary|remuneration|salaire de base|brut", 1.1],
      ["start", "Date d'entrée", "date d entree|entree|date d embauche|embauche|debut|date de debut|debut de contrat|start date|hire date|date entree|arrivee", 1.2],
      ["end", "Date de sortie", "date de sortie|sortie|fin de contrat|date de fin|fin|end date|date sortie|depart", 1],
      ["email", "E-mail", "email|e mail|mail|courriel|adresse email", 0.7],
      ["phone", "Téléphone", "telephone|tel|portable|mobile|phone", 0.7],
    ] },
  chores: { t: "Plan de nettoyage", one: "tâche", pl: "tâches", ic: "spray", w: "sk", go: "menage",
    kw: /nettoyage|menage|hygiene|desinfection|entretien|cleaning|plan de nettoyage|pnd/,
    need: (m) => m.name != null && (m.freq != null || m.method != null || m.product != null),
    f: [
      ["name", "Tâche", "tache|taches|action|operation|intitule|nom|libelle|element|materiel|task|que nettoyer|quoi|objet|equipement a nettoyer|designation|surface|surfaces|element a nettoyer|materiel surface", 1],
      ["zone", "Zone", "zone|lieu|local|secteur|piece|emplacement|area|room|espace|zone de travail", 1],
      ["freq", "Fréquence", "frequence|periodicite|quand|rythme|frequency|recurrence|cadence|frequence de nettoyage", 1.5],
      ["moment", "Moment", "moment|creneau|heure|timing|quand dans la journee", 0.9],
      ["who", "Responsable", "responsable|qui|personne|attribue a|assigne a|executant|who|assigned to|par|fait par", 0.9],
      ["product", "Produit", "produit|produit utilise|detergent|desinfectant|produit d entretien|product|chemical|produits|produit de nettoyage", 1.3],
      ["method", "Méthode", "methode|mode operatoire|procedure|protocole|comment|instructions|method|etapes|technique|mode d emploi", 1.2],
      ["notes", "Notes", "notes|remarques|commentaire|observations|dosage|temps de contact", 0.5],
    ] },
  obligations: { t: "Obligations & contrôles", one: "contrôle", pl: "contrôles", ic: "calcheck", w: "to", go: "obligations",
    kw: /obligation|controle|verification|securite|maintenance|conformite|visite|periodique|registre de securite/,
    need: (m) => m.name != null && ["provider", "every", "last", "next", "contract"].some((k) => m[k] != null),
    f: [
      ["name", "Contrôle", "obligation|controle|verification|libelle|intitule|nom|type de controle|installation|prestation|objet|designation|control|check|type de verification|equipement|nature du controle", 1],
      ["provider", "Prestataire", "prestataire|societe|entreprise|organisme|intervenant|provider|company|vendor|technicien|fournisseur|organisme agree|prestataire agree", 1.4],
      ["phone", "Téléphone", "telephone|tel|portable|phone|contact", 0.7],
      ["every", "Fréquence", "frequence|periodicite|tous les|recurrence|frequency|periodicite mois|delai|rythme|frequence mois", 1.3],
      ["last", "Dernier passage", "dernier passage|derniere visite|derniere verification|date du dernier controle|dernier controle|date de realisation|realise le|date de passage|date|last|last done|fait le|date intervention|derniere intervention|date de verification|date du controle|date de la visite", 1.2],
      ["next", "Prochaine échéance", "prochaine echeance|prochain passage|prochaine visite|prochain controle|echeance|a faire avant|next|next due|due date|prochaine verification|date limite|avant le", 1.4],
      ["contract", "Contrat", "contrat|n contrat|numero de contrat|reference contrat|contract|ref contrat", 1],
      ["cost", "Coût", "cout|montant|prix|tarif|cost|montant ht|prix ht", 0.6],
      ["notes", "Notes", "notes|commentaire|remarques|observations|comment|note", 0.5],
    ] },
};
const IM_ORDER = ["products", "suppliers", "recipes", "fridges", "readings", "receptions", "staff", "chores", "obligations"];
const IM_BUILD_ORDER = ["suppliers", "fridges", "products", "recipes", "readings", "receptions", "staff", "chores", "obligations"];

/* known exports: a file name that says it, or several of their typical headers. Best effort: only labels the table and
   nudges the kind; the mapping still comes from the synonyms (and can always be fixed by hand). */
const IM_PRESETS = [
  { id: "traqfood", t: "Traqfood", re: /traq ?food/, sig: ["enceinte", "temperature relevee", "action corrective", "conformite", "operateur", "date du releve", "zone de stockage", "n de lot", "date de reception"] },
  { id: "octopus", t: "Octopus HACCP", re: /octopus/, sig: ["equipement", "valeur", "date releve", "statut", "commentaire", "point de controle", "utilisateur", "type de controle"] },
  { id: "epack", t: "ePackPro", re: /e ?pack/, sig: ["appareil", "temperature c", "alerte", "date heure", "releve par", "module", "id appareil"] },
  { id: "restopil", t: "RestoPil", re: /resto ?pil/, sig: ["nom du produit", "categorie", "prix d achat ht", "unite d achat", "fournisseur principal", "stock min"] },
  { id: "koust", t: "Koust", re: /koust/, sig: ["nom de la recette", "quantite nette", "nombre de portions", "prix de vente ttc", "code fournisseur", "unite de stock", "cout matiere"] },
  { id: "melba", t: "Melba", re: /melba/, sig: ["famille", "sous famille", "conditionnement", "prix unitaire ht", "code article", "unite de vente"] },
  { id: "inpulse", t: "Inpulse", re: /inpulse/, sig: ["nom ingredient", "unite d inventaire", "code", "allergenes", "fournisseur", "prix par unite"] },
];
const IM_SOURCES = ["Traqfood", "Octopus", "ePackPro", "RestoPil", "Koust", "Melba", "Inpulse", "Excel"];

/* ───────────── state ───────────── */
const IM = { step: "pick", tables: [], errs: [], hint: null, hist: [], sup: [], wRid: null, files: [], last: null, prog: null, seq: 0, busy: false, mapT: null };

/* ───────────── small helpers ───────────── */
const imN = (s) => String(s ?? "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[°º]/g, " ").replace(/[^a-z0-9%]+/g, " ").trim();
const imKey = (s) => imN(s).split(" ").map((w) => (w.length > 3 ? w.replace(/(s|x)$/, "") : w)).join(" ");
const imStr = (v) => (v == null ? "" : typeof v === "number" ? String(Math.round(v * 1e6) / 1e6) : String(v)).replace(/\s+/g, " ").trim();
const imId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const imSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const imPl = (n, k) => { const K = IM_K[k]; return `${imFmt(n)} ${n > 1 ? K.pl : K.one}`; };
const imFmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const imPlural = (n, s, p) => `${imFmt(n)} ${n > 1 ? p || s + "s" : s}`;
const imCan = () => { try { if (typeof PERMS === "undefined") return true; if (PERMS.isAdmin && PERMS.isAdmin()) return true; return !!(PERMS.cap && PERMS.cap("editSettings")); } catch (e) { return true; } };
const imBoss = () => (typeof rhIsBoss === "function" ? rhIsBoss() : myRole() === "gerant");
const IM_FIELDS = {};
IM_ORDER.forEach((k) => { IM_K[k].f.forEach((f) => { f[2] = f[2].split("|").map(imN).filter(Boolean); }); IM_FIELDS[k] = Object.fromEntries(IM_K[k].f.map((f) => [f[0], f])); });
const IM_ALLSYN = new Set(IM_ORDER.flatMap((k) => IM_K[k].f.flatMap((f) => f[2])));
/* « BEURRE DOUX 82% » → « Beurre doux 82% » (exports love capitals) */
function imCase(s) { s = imStr(s); const L = s.replace(/[^A-Za-zÀ-ÿ]/g, ""); if (L.length >= 4 && L === L.toUpperCase()) { s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); } return s; }
function imWords(s) { s = imStr(s); const L = s.replace(/[^A-Za-zÀ-ÿ]/g, ""); if (L.length >= 3 && L === L.toUpperCase()) return s.toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()); return s; }

/* numbers: « 1 234,56 € », « -18°C », « 3.5 kg », « 12,5 % » */
function imNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v ?? "").trim(); if (!s) return null;
  s = s.replace(/[\s  ]/g, "").replace(/[−–]/g, "-");
  const m = s.match(/-?\d[\d.,]*/); if (!m) return null; let t = m[0].replace(/[.,]$/, "");
  const lc = t.lastIndexOf(","), ld = t.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) t = lc > ld ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (lc >= 0) t = t.split(",").length > 2 ? t.replace(/,/g, "") : t.replace(",", ".");
  else if (t.split(".").length > 2) t = t.replace(/\./g, "");
  const n = parseFloat(t); return isNaN(n) ? null : n;
}
const imQtyTx = (n) => (n == null ? "" : String(Math.round(n * 1000) / 1000).replace(".", ","));
const IM_MON = [["janv", 1], ["jan", 1], ["fevr", 2], ["fev", 2], ["feb", 2], ["mars", 3], ["mar", 3], ["avr", 4], ["apr", 4], ["mai", 5], ["may", 5], ["juin", 6], ["jun", 6], ["juil", 7], ["jul", 7], ["aout", 8], ["aug", 8], ["sept", 9], ["sep", 9], ["oct", 10], ["nov", 11], ["dec", 12]];
const imDayOk = (y, m, d) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
/* dates: Excel serials, timestamps, ISO, dd/mm/yyyy (or mm/dd when the column says so), « 5 nov. 2026 ». → { day, min } */
function imDate(v, order) {
  if (v == null || v === "") return null;
  const out = (y, m, d, h, mi) => { if (y < 100) y += 2000; if (!imDayOk(y, m, d)) return null; const k = `${y}-${pad(m)}-${pad(d)}`; return { day: k, min: h == null ? null : Math.min(1439, (+h || 0) * 60 + (+mi || 0)) }; };
  if (v instanceof Date && !isNaN(v)) return out(v.getFullYear(), v.getMonth() + 1, v.getDate(), v.getHours(), v.getMinutes());
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) { const days = Math.floor(v), fr = v - days; const d = new Date(Date.UTC(1899, 11, 30) + days * 864e5); const mins = Math.round(fr * 1440); return out(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), fr > 0 ? Math.floor(mins / 60) : null, mins % 60); }
    if (v > 1e11 && v < 5e12) return imDate(new Date(v)); if (v > 1e9 && v < 5e9) return imDate(new Date(v * 1000));
    if (v >= 19900101 && v <= 21001231) return out(Math.floor(v / 1e4), Math.floor(v / 100) % 100, v % 100);
    return null;
  }
  const s = String(v).trim(); let m;
  const tm = (rest) => { const t = /(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec(rest || ""); return t ? [+t[1], +(t[2] || 0)] : [null, null]; };
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/.exec(s))) { const [h, mi] = tm(m[4]); return out(+m[1], +m[2], +m[3], h, mi); }
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/.exec(s))) { const a = +m[1], b = +m[2]; const [h, mi] = tm(m[4]); const mdy = order === "mdy" || (a <= 12 && b > 12); return mdy ? out(+m[3], a, b, h, mi) : out(+m[3], b, a, h, mi); }
  if ((m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(s))) { const y = new Date().getFullYear(); return out(y, +m[2], +m[1]); }
  const n = imN(s);
  if ((m = /(\d{1,2})(?:er)? ([a-z]+) (\d{4})(.*)$/.exec(n))) { const mo = IM_MON.find(([p]) => m[2].startsWith(p)); if (mo) { const t = /(\d{1,2}) ?h ?(\d{2})?|(\d{1,2}) (\d{2})$/.exec(m[4] || ""); return out(+m[3], mo[1], +m[1], t ? +(t[1] || t[3]) : null, t ? +(t[2] || t[4] || 0) : 0); } }
  if (/^\d{5}(\.\d+)?$/.test(s)) return imDate(parseFloat(s));
  return null;
}
/* times: « 08:30 », « 8h30 », « 8h », Excel fraction */
function imTime(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") { if (v >= 0 && v < 1) return Math.round(v * 1440); if (v >= 1 && v < 24 && Number.isInteger(v)) return v * 60; const d = imDate(v); return d ? d.min : null; }
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  const m = /(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec(String(v)); if (m && +m[1] < 24) return +m[1] * 60 + +(m[2] || 0);
  return null;
}
/* the whole column decides between dd/mm and mm/dd */
function imOrder(vals) { let dm = 0, md = 0; for (const v of vals) { if (typeof v !== "string") continue; const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(v.trim()); if (!m) continue; if (+m[1] > 12) dm++; else if (+m[2] > 12) md++; } return md > dm ? "mdy" : "dmy"; }
function imBool(v) {
  if (typeof v === "boolean") return v; if (typeof v === "number") return v !== 0;
  const s = imN(v); if (!s) return null;
  if (/non conforme|refus|alerte|hors seuil|anomalie|defaut|ko\b|^nc$|^non$|^no$|^n$|^false$|^faux$|^0$|rejet|a jeter|^x$ non/.test(s)) return false;
  if (/^(oui|o|yes|y|true|vrai|1|x|ok|conforme|c|accepte|acceptee|valide|bon|correct|v)$|conforme|accepte|^ok/.test(s)) return true;
  if (String(v).trim() === "✓" || String(v).trim() === "✔") return true;
  return null;
}
const IM_AL = [["gluten", /gluten|\bble\b|froment|seigle|orge|avoine|epeautre|kamut|wheat/], ["crustaces", /crustace|crevette|crabe|homard|langoust|shellfish|crustacean/], ["oeufs", /oeuf|egg/],
  ["poissons", /poisson|fish|anchois/], ["arachides", /arachide|cacahu|peanut/], ["soja", /soja|soy/], ["lait", /\blait|lactose|milk|dairy|laitier/],
  ["fruitscoque", /fruits? a coques?|fruits? secs?|noix|noisette|amande|cajou|pecan|pistache|macadamia|\bnuts?\b|tree nut/], ["celeri", /celeri|celery/], ["moutarde", /moutarde|mustard/],
  ["sesame", /sesame/], ["sulfites", /sulfite|so2|anhydride sulfureux|sulphite/], ["lupin", /lupin/], ["mollusques", /mollusque|huitre|calamar|seiche|poulpe|escargot|coquillage|mollusc|moule/]];
const imAlKnown = (id) => typeof ALLERGENS === "undefined" || ALLERGENS.some((a) => a.id === id);
function imAllergens(v) { const s = imN(v); if (!s || /^(aucun|aucune|non|sans|none|no|ras|0|neant|nc|n a|na)$/.test(s)) return []; return IM_AL.filter(([, re]) => re.test(s)).map(([id]) => id).filter(imAlKnown); }
/* one column per allergen (« Gluten | Lait | Œufs » with X marks), as several recipe tools export it */
function imAlCols(T) { const out = []; T.headers.forEach((h, i) => { const n = imN(h); if (!n || n.split(" ").length > 4) return; const a = IM_AL.find(([, re]) => re.test(n)); if (a && imAlKnown(a[0]) && !/allergen/.test(n)) out.push([i, a[0]]); }); return out; }
const IM_UNITS = [[/^(kg|kgs|kilo|kilos|kilogramme|kilogrammes|kgr)$/, "kg"], [/^(g|gr|grs|gramme|grammes)$/, "g"], [/^(l|lt|ltr|litre|litres|liter|liters)$/, "L"], [/^(cl|centilitre|centilitres)$/, "cl"], [/^(ml|millilitre|millilitres)$/, "ml"],
  [/^(p|pc|pcs|pce|pces|piece|pieces|u|un|unite|unites|unit|units|ea|each|uv|unite de vente)$/, "PCE"], [/^(bt|btl|bout|bouteille|bouteilles|bottle|bottles)$/, "bouteille"], [/^(fut|futs|keg)$/, "fût"], [/^(botte|bottes|bunch|bte botte)$/, "botte"],
  [/^(boite|boites|bte|btes|can|tin|conserve)$/, "boîte"], [/^(colis|carton|cartons|ctn|caisse|caisses|case|cs)$/, "colis"], [/^(bourriche|bourriches)$/, "bourriche"], [/^(plateau|plateaux)$/, "plateau"], [/^(sac|sacs|bag)$/, "sac"],
  [/^(barquette|barquettes|barq)$/, "barquette"], [/^(sachet|sachets)$/, "sachet"], [/^(pot|pots)$/, "pot"], [/^(paquet|paquets|pqt|pack|paq)$/, "paquet"], [/^(douzaines?|dz|douz)$/, "DZ"], [/^(portion|portions)$/, "portion"]];
function imUnit(v) { const s = imN(v); if (!s) return ""; for (const [re, u] of IM_UNITS) if (re.test(s)) return u; const m = /^\d+[.,]?\d*\s*(kg|g|l|cl|ml)$/.exec(s); if (m) return imUnit(m[1]); return imStr(v).slice(0, 16); }
/* « 5 kg », « 2x1L » → { q, u } */
function imQU(v) { if (typeof v === "number") return { q: v, u: "" }; const s = imStr(v); const m = /^(-?\d[\d\s.,]*)\s*([a-zA-Zéèûôî.]+)?$/.exec(s); if (!m) return { q: imNum(s), u: "" }; return { q: imNum(m[1]), u: m[2] ? imUnit(m[2].replace(/\.$/, "")) : "" }; }

/* ───────────── reading files ───────────── */
function imDecode(buf) {
  const u = new Uint8Array(buf);
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder("utf-16le").decode(u.subarray(2));
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder("utf-16be").decode(u.subarray(2));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(u).replace(/^﻿/, ""); } catch (e) { return new TextDecoder("windows-1252").decode(u); }
}
function imDelim(text) {
  const lines = []; let q = false, cur = "";
  for (let i = 0; i < text.length && lines.length < 30; i++) { const c = text[i]; if (c === '"') q = !q; if (!q && (c === "\n" || c === "\r")) { if (cur.trim()) lines.push(cur); cur = ""; } else if (!q) cur += c; }
  if (cur.trim() && lines.length < 30) lines.push(cur);
  let best = ";", bs = -1;
  for (const d of [";", "\t", ",", "|"]) {
    const cs = lines.map((l) => l.split(d).length - 1); const freq = {}; cs.forEach((c) => { if (c > 0) freq[c] = (freq[c] || 0) + 1; });
    const [mode, n] = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || [0, 0];
    const s = n * 10 + +mode * 0.01; if (+mode > 0 && s > bs) { bs = s; best = d; }
  }
  return best;
}
function imParseDelim(text, d) {
  d = d || imDelim(text); const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === "") { q = true; continue; }
    if (c === d) { row.push(f); f = ""; continue; }
    if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; continue; }
    f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
let imXlsxP = null;
function imXlsxLib() {
  if (window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
  if (imXlsxP) return imXlsxP;
  imXlsxP = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "vendor/xlsx.full.min.js"; s.async = true;
    const t = setTimeout(() => { imXlsxP = null; rej(new Error("timeout")); }, 20000);
    s.onload = () => { clearTimeout(t); window.XLSX && window.XLSX.read ? res(window.XLSX) : (imXlsxP = null, rej(new Error("no XLSX"))); };
    s.onerror = () => { clearTimeout(t); imXlsxP = null; s.remove(); rej(new Error("load")); };
    document.head.appendChild(s);
  });
  return imXlsxP;
}
/* built-in fallback: .xlsx is a zip of XML parts. Reads the sheets' values (strings, numbers, booleans); dates stay Excel serials. */
async function imMiniXlsx(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("zip");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const ents = {}; const td = new TextDecoder();
  for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) {
    const meth = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    ents[td.decode(u8.subarray(p + 46, p + 46 + nl))] = { meth, cs, lo }; p += 46 + nl + xl + cl;
  }
  const read = async (name) => {
    const E = ents[name] || ents[Object.keys(ents).find((k) => k.toLowerCase() === name.toLowerCase())]; if (!E) return null;
    const s = E.lo + 30 + dv.getUint16(E.lo + 26, true) + dv.getUint16(E.lo + 28, true); const data = u8.slice(s, s + E.cs);
    if (E.meth === 0) return td.decode(data);
    if (typeof DecompressionStream === "undefined") throw new Error("inflate");
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer(); return td.decode(out);
  };
  const X = (s) => new DOMParser().parseFromString(s || "<x/>", "application/xml");
  const tags = (d, t) => [...d.getElementsByTagName("*")].filter((x) => x.localName === t);
  const sst = tags(X(await read("xl/sharedStrings.xml")), "si").map((si) => tags(si, "t").map((t) => t.textContent).join(""));
  const wb = X(await read("xl/workbook.xml")); const rels = X(await read("xl/_rels/workbook.xml.rels"));
  const relMap = {}; tags(rels, "Relationship").forEach((r) => { relMap[r.getAttribute("Id")] = r.getAttribute("Target"); });
  const out = [];
  for (const sh of tags(wb, "sheet")) {
    const rid = sh.getAttribute("r:id") || [...sh.attributes].find((a) => a.localName === "id")?.value; let tg = relMap[rid] || ""; tg = tg.replace(/^\/?xl\//, "").replace(/^\//, "");
    const doc = X(await read("xl/" + tg)); const rows = [];
    tags(doc, "row").forEach((r) => {
      const ri = (+r.getAttribute("r") || rows.length + 1) - 1; const row = rows[ri] = [];
      tags(r, "c").forEach((c, ci) => {
        const ref = c.getAttribute("r") || ""; const col = ref ? ref.replace(/\d+/g, "").split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : ci;
        const t = c.getAttribute("t"); const v = tags(c, "v")[0]?.textContent ?? "";
        row[col] = t === "s" ? sst[+v] ?? "" : t === "inlineStr" ? tags(c, "t").map((x) => x.textContent).join("") : t === "str" || t === "e" ? v : t === "b" ? v === "1" : v === "" ? "" : +v;
      });
    });
    out.push({ sheet: sh.getAttribute("name") || "Feuille", rows: Array.from(rows, (r) => Array.from(r || [], (x) => (x === undefined ? "" : x))) });
  }
  return out;
}
async function imReadSheets(buf, ext) {
  try {
    const X = await imXlsxLib();
    const wb = X.read(new Uint8Array(buf), { type: "array", cellDates: false, cellNF: false, cellStyles: false, sheetStubs: false });
    return wb.SheetNames.map((n) => ({ sheet: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "", blankrows: false }) }));
  } catch (e) {
    if (ext === "xls" || ext === "ods" || new Uint8Array(buf)[0] !== 0x50) throw e;
    return imMiniXlsx(buf);
  }
}
/* JSON: an array of objects, { key: [ … ] } for several tables, or nested lists (ingredients) spread into rows */
function imFromJson(data, file) {
  const tables = [];
  const toTable = (arr, sheet) => {
    if (!Array.isArray(arr) || !arr.length) return;
    if (arr.every((x) => Array.isArray(x))) { tables.push({ file, sheet, rows: arr }); return; }
    const objs = arr.filter((x) => x && typeof x === "object" && !Array.isArray(x)); if (!objs.length) return;
    const expandKey = Object.keys(objs[0]).find((k) => objs.filter((o) => Array.isArray(o[k]) && o[k].some((y) => y && typeof y === "object")).length >= objs.length * 0.5);
    const flat = (o, pre, out) => { for (const [k, v] of Object.entries(o || {})) { if (k === "__proto__" || k === "constructor") continue; const kk = pre ? `${pre} ${k}` : k; if (v && typeof v === "object" && !Array.isArray(v)) flat(v, kk, out); else if (Array.isArray(v)) out[kk] = v.map((x) => (x && typeof x === "object" ? Object.values(x).join(" ") : x)).join(", "); else out[kk] = v; } return out; };
    const recs = [];
    objs.forEach((o) => {
      const base = flat(Object.fromEntries(Object.entries(o).filter(([k]) => k !== expandKey)), "", {});
      const sub = expandKey && Array.isArray(o[expandKey]) ? o[expandKey].filter((y) => y && typeof y === "object") : [];
      if (!sub.length) { recs.push(base); return; }
      sub.forEach((s) => { const r = { ...base }; for (const [k, v] of Object.entries(flat(s, "", {}))) { const nk = /^(name|nom|label|libelle|produit|product|title|titre)$/i.test(k) ? expandKey : k in r ? `${expandKey} ${k}` : k; r[nk] = v; } recs.push(r); });
    });
    const heads = []; recs.slice(0, 500).forEach((r) => Object.keys(r).forEach((k) => { if (!heads.includes(k)) heads.push(k); }));
    tables.push({ file, sheet, rows: [heads, ...recs.map((r) => heads.map((h) => (r[h] == null ? "" : r[h])))] });
  };
  if (Array.isArray(data)) toTable(data, "");
  else if (data && typeof data === "object") {
    const lists = Object.entries(data).filter(([, v]) => Array.isArray(v) && v.length);
    if (lists.length) lists.forEach(([k, v]) => toTable(v, k));
    else { const vals = Object.values(data); if (vals.length && vals.every((v) => v && typeof v === "object" && !Array.isArray(v))) toTable(vals, ""); else for (const v of vals) if (v && typeof v === "object") { const inner = Object.entries(v).filter(([, x]) => Array.isArray(x)); inner.forEach(([k, x]) => toTable(x, k)); } }
  }
  return tables;
}
async function imReadFile(f) {
  const name = f.name || "Fichier"; const ext = (name.split(".").pop() || "").toLowerCase();
  if (f.size > 30 * 1024 * 1024) throw Object.assign(new Error("big"), { why: "trop lourd (30 Mo max)" });
  const buf = await f.arrayBuffer(); const u = new Uint8Array(buf.slice(0, 8));
  const zip = u[0] === 0x50 && u[1] === 0x4b, ole = u[0] === 0xd0 && u[1] === 0xcf;
  if (/^(xlsx|xlsm|xls|ods|xlsb|numbers)$/.test(ext) || zip || ole) {
    if (ext === "numbers") throw Object.assign(new Error("numbers"), { why: "exportez-le d'abord en Excel ou CSV" });
    return (await imReadSheets(buf, ext)).map((s) => ({ file: name, sheet: s.sheet, rows: s.rows }));
  }
  const text = imDecode(buf);
  if (ext === "json" || /^\s*[[{]/.test(text)) { try { return imFromJson(JSON.parse(text), name); } catch (e) { if (ext === "json") throw Object.assign(e, { why: "JSON illisible" }); } }
  if (/^\s*<(\?xml|html|table)/i.test(text)) { /* « Excel » exports that are really HTML tables */
    const d = new DOMParser().parseFromString(text, "text/html"); const ts = [...d.querySelectorAll("table")];
    if (ts.length) return ts.map((t, i) => ({ file: name, sheet: ts.length > 1 ? `Tableau ${i + 1}` : "", rows: [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())) }));
  }
  return [{ file: name, sheet: "", rows: imParseDelim(text) }];
}

/* ───────────── tables: header row, kind, mapping ───────────── */
function imSynScore(h, syns) {
  if (!h) return 0; let best = 0; const hp = ` ${h} `;
  for (const s of syns) {
    if (h === s) return 100;
    if (s.length < 3 && !/^[a-z]{1,2}$/.test(h)) continue;
    if (s.length >= 3 && hp.includes(` ${s} `)) best = Math.max(best, 48 + Math.min(30, s.length * 2) - Math.min(18, (h.length - s.length) / 2));
  }
  return best;
}
function imHeaderRow(rows) {
  let bi = 0, bs = -1e9;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i] || []; const cells = r.map((c) => imStr(c)).filter(Boolean); if (cells.length < 2) continue;
    const txt = cells.filter((c) => imNum(c) == null || /[a-zA-Z]{3}/.test(c)).length;
    const hits = cells.filter((c) => { const n = imN(c); return (n.length > 2 && IM_ALLSYN.has(n)) || [...n.split(" ")].some((w) => w.length > 3 && IM_ALLSYN.has(w)); }).length;
    const s = hits * 4 + txt * 1.2 - (cells.length - txt) * 2 + Math.min(cells.length, 8) * 0.3 - i * 0.15;
    if (s > bs) { bs = s; bi = i; }
  }
  return bi;
}
const imColName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
function imMakeTable(raw) {
  const rows = (raw.rows || []).map((r) => (Array.isArray(r) ? r : [])).filter((r) => r.some((c) => imStr(c) !== ""));
  if (!rows.length) return null;
  const hi = imHeaderRow(rows); const width = Math.max(...rows.slice(hi, hi + 400).map((r) => r.length));
  const seen = {}; const headers = Array.from({ length: width }, (_, i) => { let h = imStr(rows[hi][i]) || `Colonne ${imColName(i)}`; const k = h.toLowerCase(); if (seen[k]) h = `${h} (${++seen[k]})`; else seen[k] = 1; return h; });
  let data = rows.slice(hi + 1).filter((r) => { const first = imN(r.find((c) => imStr(c) !== "")); return !/^(total|totaux|sous total|somme)\b/.test(first); });
  const trunc = data.length > 60000; if (trunc) data = data.slice(0, 60000);
  const T = { id: "t" + (++IM.seq), file: raw.file, sheet: raw.sheet || "", headers, nh: headers.map(imN), rows: data, kind: null, map: {}, mode: "update", on: true, preset: null, trunc, wide: null, alCols: [] };
  imDetect(T); return T;
}
/* best column for each field of a kind (greedy on the best scores, one column per field) */
function imAuto(T, kind) {
  const F = IM_K[kind].f; const pairs = [];
  F.forEach((f) => T.nh.forEach((h, ci) => { const s = imSynScore(h, f[2]); if (s >= 46) pairs.push([s * (0.6 + 0.4 * f[3]), f[0], ci, s]); }));
  pairs.sort((a, b) => b[0] - a[0]); const map = {}, used = new Set(); let score = 0;
  for (const [w, k, ci] of pairs) { if (map[k] != null || used.has(ci)) continue; if (!imColFits(T, kind, k, ci)) continue; map[k] = ci; used.add(ci); score += w; }
  return { map, score };
}
/* a sanity check on the values: a « Température » column holds numbers, a date column holds dates */
function imColFits(T, kind, k, ci) {
  const vals = T.rows.slice(0, 60).map((r) => r[ci]).filter((v) => imStr(v) !== ""); if (!vals.length) return true;
  const share = (fn) => vals.filter(fn).length / vals.length;
  if (["value", "temp", "min", "max", "price", "qty", "hours", "rate", "monthly", "portions", "minQty", "vat", "cost"].includes(k)) return share((v) => imNum(v) != null) >= 0.6;
  if (["date", "dlc", "start", "end", "last", "next"].includes(k)) return share((v) => imDate(v) != null) >= 0.5;
  if (k === "time") return share((v) => imTime(v) != null) >= 0.5;
  if (["name", "title", "fridge", "supplier", "ingredient"].includes(k)) return share((v) => typeof v === "string" && /[a-zA-ZÀ-ÿ]/.test(v)) >= 0.5;
  return true;
}
/* « Date | Frigo 1 | Frigo 2 | Congélateur » : one column per equipment */
const IM_FRIDGE_RE = /frigo|refrigerateur|chambre|congel|surgel|cf\b|cfp|cfn|saladette|vitrine|cave|armoire|timbre|meuble|bac\b|tour refrig|positive|negative|enceinte|chiller|fridge|freezer|cellule|frigidaire|frais|froid/;
function imWideDetect(T) {
  const dc = T.nh.findIndex((h) => imSynScore(h, IM_FIELDS.readings.date[2]) >= 46 && imColFits(T, "readings", "date", T.nh.indexOf(h)));
  if (dc < 0) return null; const tc = T.nh.findIndex((h, i) => i !== dc && imSynScore(h, IM_FIELDS.readings.time[2]) >= 46 && imColFits(T, "readings", "time", i));
  const sc = T.nh.findIndex((h, i) => i !== dc && i !== tc && imSynScore(h, IM_FIELDS.readings.slot[2]) >= 46);
  const cols = [];
  T.nh.forEach((h, i) => {
    if (i === dc || i === tc || i === sc) return; const vals = T.rows.slice(0, 80).map((r) => r[i]).filter((v) => imStr(v) !== ""); if (vals.length < Math.min(2, T.rows.length)) return;
    const nums = vals.map(imNum).filter((x) => x != null); if (nums.length / vals.length < 0.8) return;
    const inRange = nums.filter((x) => x >= -35 && x <= 20).length / nums.length;
    if (inRange >= 0.9 && (IM_FRIDGE_RE.test(h) || !IM_ALLSYN.has(h))) cols.push(i);
  });
  return cols.length && cols.some((i) => IM_FRIDGE_RE.test(T.nh[i])) ? { date: dc, time: tc >= 0 ? tc : null, slot: sc >= 0 ? sc : null, cols } : null;
}
const imWideMap = (W) => ({ date: W.date, ...(W.time != null ? { time: W.time } : {}), ...(W.slot != null ? { slot: W.slot } : {}) });
function imPresetOf(T) {
  const fn = imN(T.file + " " + T.sheet); const p = IM_PRESETS.find((x) => x.re.test(fn)); if (p) return p;
  let best = null, bn = 0; IM_PRESETS.forEach((x) => { const n = x.sig.filter((s) => T.nh.includes(s)).length; if (n > bn) { bn = n; best = x; } });
  return bn >= 4 ? best : null;
}
function imDetect(T, hint) {
  hint = hint || IM.hint; T.preset = imPresetOf(T); T.alCols = imAlCols(T);
  const fn = imN(T.file + " " + T.sheet); const res = [];
  for (const k of IM_ORDER) {
    const { map, score } = imAuto(T, k); if (!IM_K[k].need(map)) continue;
    let s = score; if (IM_K[k].kw.test(fn)) s += 90; if (hint === k) s += 45;
    if (k === "readings" && map.value != null) s += 40; if (k === "recipes" && map.ingredient != null && map.qty != null) s += 50;
    if (k === "receptions" && map.bl != null) s += 40; if (k === "suppliers" && (map.phone != null || map.email != null) && map.address != null) s += 30;
    if (k === "products" && map.ingredient != null) s -= 40;
    if (k === "obligations" && map.next != null) s += 40; if (k === "staff" && map.contract != null) s += 40; if (k === "chores" && map.freq != null && map.product != null) s += 40;
    res.push([s, k, map]);
  }
  const W = imWideDetect(T); if (W && !res.some(([, k, m]) => k === "readings" && m.fridge != null)) res.push([400 + W.cols.length, "readings", imWideMap(W), W]);
  res.sort((a, b) => b[0] - a[0]);
  const top = res[0];
  if (!top) { T.kind = null; T.map = {}; T.wide = null; return T; }
  T.kind = top[1]; T.map = top[2]; T.wide = top[3] || null; T.alt = res.slice(1, 3).map((r) => r[1]);
  return T;
}
function imSetKind(T, k) {
  T.kind = k; T.wide = null; if (!k) { T.map = {}; return; }
  const a = imAuto(T, k); T.map = a.map;
  if (k === "readings" && T.map.value == null) { const W = imWideDetect(T); if (W) { T.wide = W; T.map = imWideMap(W); } }
}
const imCell = (T, r, k) => (T.map[k] == null ? "" : r[T.map[k]]);
const imTxt = (T, r, k) => imStr(imCell(T, r, k));
const imOrd = (T, k) => { T._ord = T._ord || {}; if (!(k in T._ord)) T._ord[k] = T.map[k] == null ? "dmy" : imOrder(T.rows.slice(0, 400).map((r) => r[T.map[k]])); return T._ord[k]; };
const imDateOf = (T, r, k) => imDate(imCell(T, r, k), imOrd(T, k));

/* ───────────── plan: what the import will write ───────────── */
function imCtx() {
  const C = { prod: new Map(), fr: new Map(), sup: new Map(), staff: new Map(), mem: new Map(), notes: new Map(), chores: new Map(), obl: new Map(), oblKey: new Map(), now: Date.now(), n: 0 };
  S.products.forEach((p) => C.prod.set(imKey(p.name), { id: p.id, name: p.name, unit: p.unit, doc: p }));
  S.fridges.forEach((f) => C.fr.set(imKey(f.name), { id: f.id, name: f.name, min: f.min, max: f.max, doc: f }));
  IM.sup.forEach((s) => C.sup.set(imKey(s.name), { id: s.id, name: s.name, doc: s }));
  S.staff.forEach((s) => C.staff.set(imKey(s.name), { id: s.id, doc: s }));
  S.members.forEach((m) => { if (m.name) C.mem.set(imKey(m.name), m); });
  S.notes.filter((n) => n.cat === "Recettes").forEach((n) => C.notes.set(imKey(n.title), { id: n.id, doc: n }));
  S.chores.forEach((c) => C.chores.set(imKey(c.name) + "|" + imKey(c.zone), { id: c.id, doc: c }));
  S.obligations.forEach((o) => { C.obl.set(imKey(o.name), { id: o.id, doc: o }); if (o.key) C.oblKey.set(o.key, { id: o.id, doc: o }); });
  return C;
}
function imCreate(P, R, col, data) { const id = imId() + (P.ops.length % 1000).toString(36); P.ops.push({ col, id, t: "c", data, tab: R && R.id }); return id; }
/* an update writes only what changes; before keeps the old values for undo */
function imPatch(P, R, col, doc, patch) {
  const d = {}, before = {};
  for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; const old = doc[k]; if (JSON.stringify(old ?? null) === JSON.stringify(v ?? null)) continue; d[k] = v; before[k] = old === undefined ? null : old; }
  if (!Object.keys(d).length) return false;
  P.ops.push({ col, id: doc.id, t: "u", data: d, before, tab: R && R.id }); return true;
}
function imSupEnsure(C, P, R, name) {
  name = imWords(name); const k = imKey(name); if (!k) return ""; const ex = C.sup.get(k); if (ex) return ex.name;
  const id = imCreate(P, R, "suppliers", { name, createdAt: C.now + C.n++ }); C.sup.set(k, { id, name, doc: { id, name } }); if (R) R.ex.sup = (R.ex.sup || 0) + 1; return name;
}
function imFridgeType(name, typeTx, vals) {
  const t = imN(typeTx) + " " + imN(name);
  if (/congel|surgel|negati|cfn|freezer|- ?18/.test(t)) return "congel";
  if (vals && vals.length) { const sorted = vals.slice().sort((a, b) => a - b); if (sorted[Math.floor(sorted.length / 2)] < -8) return "congel"; }
  if (/saladette/.test(t)) return "saladette"; if (/vitrine/.test(t)) return "vitrine"; if (/cave|vin|boisson|biere|bar/.test(t)) return "cave";
  if (/chambre|cfp|cf\b|positive/.test(t)) return "cfp"; if (/service|sous plan|plan de travail|comptoir|passe|timbre/.test(t)) return "service";
  if (typeof relTypeOf === "function") { try { return relTypeOf({ name }).k; } catch (e) {} }
  return "frigo";
}
const imTypeDef = (k) => (typeof REL_TYPES !== "undefined" && REL_TYPES.find((t) => t.k === k)) || { k, min: k === "congel" ? -40 : 0, max: k === "congel" ? -15 : k === "cave" ? 8 : 4, svc: ["service", "saladette"].includes(k) ? 8 : null };
function imFridgeEnsure(C, P, R, name, vals) {
  name = imCase(name); const k = imKey(name); const ex = C.fr.get(k); if (ex) return ex;
  const type = imFridgeType(name, "", vals); const D = imTypeDef(type); const order = S.fridges.reduce((m, f) => Math.max(m, f.order ?? 0), -1) + 1 + C.n;
  const doc = { name, min: D.min, max: D.max, type, order, createdAt: C.now + C.n++ }; if (["service", "saladette"].includes(type)) doc.svcMax = D.svc || 8;
  const id = imCreate(P, R, "fridges", doc); const e = { id, name, min: doc.min, max: doc.max, doc: { id, ...doc } }; C.fr.set(k, e); if (R) R.ex.fr = (R.ex.fr || 0) + 1; return e;
}
function imZone(cat, name) {
  const real = (z) => (typeof stkRealZone === "function" ? stkRealZone(z) : z);
  const c = imN(cat), n = imN(name), t = c + " " + n;
  if (/surgel|congel|glace|negati|frozen/.test(t)) return real("Congélateur");
  if (c) {
    if (/frais|froid|cremerie|bof|viande|volaille|boucherie|charcuterie|poisson|maree|marée|fromage|laitier|legume|fruit|primeur|traiteur|ultra frais|positive|chambre/.test(c)) return real("Chambre froide");
    if (/epicerie|sec|conserve|reserve|epice|condiment|boulangerie|patisserie seche/.test(c)) return "Réserve sèche";
    if (/boisson|vin|biere|alcool|soft|soda|spiritueux|cave|bar|eau/.test(c)) return "Bar";
    const ex = S.fridges.find((f) => imKey(f.name) === imKey(cat)); if (ex) return ex.name;
    return imCase(cat).slice(0, 40);
  }
  if (/\b(beurre|creme|lait|fromage|oeuf|yaourt|viande|boeuf|veau|porc|agneau|poulet|canard|volaille|jambon|lardon|saumon|cabillaud|poisson|crevette|moule|huitre|salade|tomate|legume|herbe|persil|ciboulette|basilic|fraise|framboise|mozzarella|burrata|parmesan)/.test(n)) return real("Chambre froide");
  if (/\b(vin|biere|soda|jus|eau|sirop|whisky|rhum|gin|vodka|champagne|cidre|limonade)/.test(n)) return "Bar";
  if (/\b(farine|sucre|sel|poivre|huile|vinaigre|pates|riz|semoule|epice|cafe|the|chocolat|conserve|levure|miel|moutarde|lentille|haricot sec|confiture)/.test(n)) return "Réserve sèche";
  return "Autre";
}
const imStep = (u) => (typeof stkDefStep === "function" ? stkDefStep(u) : u === "kg" || u === "L" ? 0.5 : u === "g" ? 100 : 1);
const imFridgeForZone = (zone) => { const f = S.fridges.find((x) => imKey(x.name) === imKey(zone)); if (f) return f.id; const k = /cong/i.test(zone) ? "congel" : "cold"; const g = typeof stkFridgeFor === "function" ? stkFridgeFor(k) : null; return (g && g.id) || (S.fridges[0] && S.fridges[0].id) || ""; };

const IM_B = {};
IM_B.suppliers = (T, C, P, R) => {
  const seen = new Set();
  T.rows.forEach((r) => {
    const name = imWords(imTxt(T, r, "name")); if (!name) { R.bad++; return; } const k = imKey(name); if (seen.has(k)) { R.dup++; return; } seen.add(k);
    const d = {}; ["contact", "phone", "email", "address", "siret", "days", "cat", "notes"].forEach((f) => { const v = imTxt(T, r, f); if (v) d[f] = f === "contact" ? imWords(v) : v; });
    const ex = C.sup.get(k);
    if (ex) { R.ex.have = (R.ex.have || 0) + 1; if (T.mode === "skip" || !ex.doc.id) { R.s++; return; } if (imPatch(P, R, "suppliers", ex.doc, d)) R.u++; else R.s++; return; }
    const id = imCreate(P, R, "suppliers", { name, ...d, createdAt: C.now + C.n++ }); C.sup.set(k, { id, name, doc: { id, name, ...d } }); R.c++;
  });
};
IM_B.fridges = (T, C, P, R) => {
  const seen = new Set();
  T.rows.forEach((r) => {
    const name = imCase(imTxt(T, r, "name")); if (!name) { R.bad++; return; } const k = imKey(name); if (seen.has(k)) { R.dup++; return; } seen.add(k);
    const type = imFridgeType(name, imTxt(T, r, "type")); const D = imTypeDef(type);
    let lo = imNum(imCell(T, r, "min")), hi = imNum(imCell(T, r, "max"));
    if (lo == null && hi != null) lo = type === "congel" ? -40 : Math.min(D.min, hi - 1); if (hi == null && lo != null) hi = type === "congel" ? -15 : Math.max(D.max, lo + 1);
    if (lo == null) { lo = D.min; hi = D.max; } if (lo > hi) [lo, hi] = [hi, lo]; if (lo === hi) lo = hi - 1;
    lo = Math.max(-60, Math.min(30, Math.round(lo * 10) / 10)); hi = Math.max(-60, Math.min(30, Math.round(hi * 10) / 10));
    const ex = C.fr.get(k);
    if (ex) { R.ex.have = (R.ex.have || 0) + 1; if (T.mode === "skip" || !ex.doc.id) { R.s++; return; } const p = { min: lo, max: hi }; if (imTxt(T, r, "type")) p.type = type; if (imPatch(P, R, "fridges", ex.doc, p)) R.u++; else R.s++; return; }
    const order = S.fridges.reduce((m, f) => Math.max(m, f.order ?? 0), -1) + 1 + C.n;
    const doc = { name, min: lo, max: hi, type, order, createdAt: C.now + C.n++ }; if (["service", "saladette"].includes(type)) doc.svcMax = Math.max(hi + 1, D.svc || 8);
    const id = imCreate(P, R, "fridges", doc); C.fr.set(k, { id, name, min: lo, max: hi, doc: { id, ...doc } }); R.c++;
  });
};
IM_B.products = (T, C, P, R) => {
  const groups = new Map(); const lotMode = T.map.dlc != null || T.map.lot != null;
  T.rows.forEach((r) => { const name = imCase(imTxt(T, r, "name")); if (!name || name.length > 120) { R.bad++; return; } const k = imKey(name); let g = groups.get(k); if (!g) groups.set(k, (g = { name, rs: [] })); else if (!lotMode) R.dup++; g.rs.push(r); });
  const month = monthKey(); const today = dayKey();
  for (const [k, g] of groups) {
    const first = (f) => { for (const r of g.rs) { const v = imTxt(T, r, f); if (v) return v; } return ""; };
    let unit = imUnit(first("unit")); let qty = null;
    if (T.map.qty != null) { g.rs.forEach((r) => { const qu = imQU(imCell(T, r, "qty")); if (qu.q != null) { qty = (qty || 0) + qu.q; if (!unit && qu.u) unit = qu.u; } }); }
    const al = new Set(); let alSeen = false;
    g.rs.forEach((r) => { if (T.map.allergens != null) { const v = imTxt(T, r, "allergens"); if (v) { alSeen = true; imAllergens(v).forEach((a) => al.add(a)); } } T.alCols.forEach(([ci, a]) => { const b = imBool(r[ci]); if (b != null) alSeen = true; if (b) al.add(a); }); });
    const price = imNum(first("price")), vat = imNum(first("vat")), minQ = imNum(first("minQty"));
    const supTx = first("supplier"); const supplier = supTx ? imSupEnsure(C, P, R, supTx) : "";
    const d = {}; if (price != null && price > 0) d.price = Math.round(price * 10000) / 10000; if (vat != null && vat >= 0 && vat < 100) d.vat = vat < 1 ? Math.round(vat * 1000) / 10 : vat;
    if (supplier) d.supplier = supplier; if (minQ != null && minQ > 0) d.minQty = minQ; if (alSeen) { d.allergens = [...al]; d.alChecked = true; }
    const ref = first("ref"), ean = first("ean"); if (ref) d.ref = ref; if (ean) d.ean = ean.replace(/\s/g, "");
    let ex = C.prod.get(k); let pid;
    if (ex) {
      R.ex.have = (R.ex.have || 0) + 1; pid = ex.id;
      if (T.mode === "skip" || !ex.doc) R.s++;
      else { const p = { ...d }; if (!ex.doc.unit && unit) p.unit = unit; const z = imZone(first("zone"), g.name); if ((!ex.doc.zone || ex.doc.zone === "Autre") && z !== "Autre") p.zone = z; if (d.allergens && ex.doc.allergens) p.allergens = [...new Set([...ex.doc.allergens, ...d.allergens])]; if (imPatch(P, R, "products", ex.doc, p)) R.u++; else R.s++; }
    } else {
      unit = unit || "kg"; const zone = imZone(first("zone"), g.name);
      const doc = { name: g.name, unit, zone, step: imStep(unit), price: null, supplier: "", ...d, createdAt: C.now + C.n++ };
      pid = imCreate(P, R, "products", doc); C.prod.set(k, { id: pid, name: g.name, unit, doc: { id: pid, ...doc } }); R.c++; ex = C.prod.get(k);
    }
    if (qty != null && qty >= 0 && !(T.mode === "skip" && S.products.some((p) => p.id === pid))) {
      const cid = `${month}_${pid}`; const cur = S.counts.find((c) => c.id === cid); const q = Math.round(qty * 1000) / 1000;
      if (cur) { if (T.mode !== "skip" && imPatch(P, R, "counts", cur, { qty: q, at: C.now })) R.ex.cnt = (R.ex.cnt || 0) + 1; }
      else { P.ops.push({ col: "counts", id: cid, t: "c", data: { month, productId: pid, qty: q, uid: S.me.id, at: C.now }, tab: R.id }); R.ex.cnt = (R.ex.cnt || 0) + 1; }
    }
    if (lotMode) {
      for (const r of g.rs) {
        const dl = imDateOf(T, r, "dlc"); const lot = imTxt(T, r, "lot"); if (!dl && !lot) continue;
        if (dl && dl.day < today) { R.ex.old = (R.ex.old || 0) + 1; continue; }
        const qu = imQU(imCell(T, r, "qty")); const q = qu.q != null && qu.q > 0 ? qu.q : 1;
        if (S.lots.some((l) => (l.status === "in" || l.status === "opened") && l.productId === pid && (l.lot || "") === lot && (l.dlc || "") === (dl ? dl.day : ""))) { R.ex.lotHave = (R.ex.lotHave || 0) + 1; continue; }
        const zone = (ex.doc && ex.doc.zone) || imZone(first("zone"), g.name);
        imCreate(P, R, "lots", { name: g.name, productId: pid, qty: q, unit: (ex.doc && ex.doc.unit) || unit || "kg", lot, dlc: dl ? dl.day : "", supplier: supplier || "", receptionId: "", fridgeId: imFridgeForZone(zone), status: "in", receivedTemp: null, code: "GG-" + rid6(), photoId: "", photoUrl: "", createdAt: C.now + C.n++, uid: S.me.id, imported: true });
        R.ex.lots = (R.ex.lots || 0) + 1;
      }
    }
  }
};
function imIngList(tx) {
  return String(tx || "").split(/\n|;|,(?!\d)|•|\s\+\s/).map((s) => s.trim()).filter(Boolean).map((s) => {
    let m = /^(\d[\d.,/]*)\s*(kg|g|gr|l|cl|ml|pieces?|pcs?|c\.? ?a\.? ?s\.?|c\.? ?a\.? ?c\.?|pincees?|bottes?|feuilles?|gousses?|tranches?|u)?\.?\s*(?:de |d'|d’)?(.+)$/i.exec(s);
    if (m) return { name: imCase(m[3]), qty: m[1].replace(".", ","), unit: m[2] ? imUnit(m[2]) || m[2] : "pièce" };
    m = /^(.+?)\s*[:(\-–]?\s*(\d[\d.,]*)\s*(kg|g|gr|l|cl|ml|pieces?|pcs?|u)?\)?$/i.exec(s);
    if (m) return { name: imCase(m[1]), qty: m[2].replace(".", ","), unit: m[3] ? imUnit(m[3]) : "pièce" };
    return { name: imCase(s), qty: "", unit: "" };
  }).map((g) => ({ ...g, unit: g.unit === "PCE" ? "pièce" : g.unit === "DZ" ? "douzaine" : g.unit }));
}
IM_B.recipes = (T, C, P, R) => {
  const groups = new Map(); let cur = null;
  T.rows.forEach((r) => {
    const t = imCase(imTxt(T, r, "title")); if (t) { const k = imKey(t); cur = groups.get(k); if (!cur) groups.set(k, (cur = { title: t, rs: [] })); }
    if (!cur) { R.bad++; return; } cur.rs.push(r);
  });
  for (const [k, g] of groups) {
    const first = (f) => { for (const r of g.rs) { const v = imTxt(T, r, f); if (v) return v; } return ""; };
    let ings = [];
    if (T.map.ingredient != null) {
      g.rs.forEach((r) => {
        const nm = imTxt(T, r, "ingredient"); if (!nm) return;
        if (T.map.qty == null && /[,;\n]/.test(nm)) { ings.push(...imIngList(nm)); return; }
        const qu = imQU(imCell(T, r, "qty")); const u = imUnit(imTxt(T, r, "unit")) || qu.u || "";
        ings.push({ name: imCase(nm), qty: qu.q != null ? imQtyTx(qu.q) : imTxt(T, r, "qty"), unit: u === "PCE" ? "pièce" : u === "DZ" ? "douzaine" : u });
      });
    }
    ings = ings.filter((g2) => g2.name).map((g2) => { const p = C.prod.get(imKey(g2.name)); return p ? { ...g2, productId: p.id } : g2; });
    const al = new Set(); g.rs.forEach((r) => { imAllergens(imTxt(T, r, "allergens")).forEach((a) => al.add(a)); T.alCols.forEach(([ci, a]) => { if (imBool(r[ci])) al.add(a); }); });
    const stTx = g.rs.map((r) => imTxt(T, r, "steps")).filter(Boolean).join("\n");
    const steps = typeof noteSplit === "function" ? noteSplit(stTx.replace(/\s(?=\d+[.)]\s)/g, "\n")) : stTx.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const por = imNum(first("portions")); const price = imNum(first("price")); const catTx = imN(first("cat"));
    const carteCat = /entree|starter|hors d/.test(catTx) ? "entree" : /dessert|patisserie|sucre/.test(catTx) ? "dessert" : /boisson|cocktail|drink|vin/.test(catTx) ? "boisson" : /partage|tapas|aperitif|planche|snack/.test(catTx) ? "partage" : "plat";
    const d = { ingredients: ings, steps, allergens: [...al] };
    if (por != null && por > 0) d.portions = Math.round(por * 100) / 100; if (price != null && price > 0) { d.price = Math.round(price * 100) / 100; d.carte = true; d.carteCat = carteCat; }
    const ex = C.notes.get(k);
    if (ex) {
      R.ex.have = (R.ex.have || 0) + 1; if (T.mode === "skip") { R.s++; continue; }
      const p = { updatedAt: C.now }; if (ings.length) p.ingredients = ings; if (steps.length) p.steps = steps; if (al.size) p.allergens = [...new Set([...(ex.doc.allergens || []), ...al])]; ["portions", "price", "carte", "carteCat"].forEach((f) => { if (d[f] != null) p[f] = d[f]; });
      if (Object.keys(p).length > 1 && imPatch(P, R, "notes", ex.doc, p)) R.u++; else R.s++; continue;
    }
    const t = C.now + C.n++;
    const id = imCreate(P, R, "notes", { title: g.title, cat: "Recettes", body: "", ingredients: ings, steps, portions: d.portions || 4, allergens: d.allergens, alNo: [], carte: !!d.carte, carteCat: d.carteCat || "plat", price: d.price || null, photo: "", photoId: "", files: [], uid: S.me.id, at: t, updatedAt: t });
    C.notes.set(k, { id, doc: { id } }); R.c++; R.ex.ing = (R.ex.ing || 0) + ings.length;
  }
};
IM_B.readings = (T, C, P, R) => {
  const pts = []; /* [fridgeName, day, min, value, row] */
  const slotOf = (tx, min) => { const s = imN(tx); if (/soir|fermeture|pm|nuit|diner|evening/.test(s)) return "soir"; if (/matin|midi|ouverture|am|dejeuner|morning|lunch/.test(s)) return "midi"; return min != null && min >= 16 * 60 ? "soir" : "midi"; };
  T.rows.forEach((r) => {
    const dd = imDateOf(T, r, "date"); if (!dd) { R.bad++; return; }
    let min = T.map.time != null ? imTime(imCell(T, r, "time")) : null; if (min == null) min = dd.min;
    if (T.wide) T.wide.cols.forEach((ci) => { const v = imNum(r[ci]); if (v != null) pts.push([T.headers[ci], dd.day, min, v, r]); });
    else { const fn = imTxt(T, r, "fridge"), v = imNum(imCell(T, r, "value")); if (!fn || v == null) { R.bad++; return; } pts.push([fn, dd.day, min, v, r]); }
  });
  const byF = new Map(); pts.forEach((p) => { const k = imKey(p[0]); (byF.get(k) || byF.set(k, []).get(k)).push(p[3]); });
  const have = new Set(S.readings.map((x) => `${x.fridgeId}|${Math.round((x.at || 0) / 60000)}`)); let from = null, to = null;
  for (const [name, day, min0, v, r] of pts) {
    if (v < -60 || v > 60) { R.bad++; continue; }
    const f = imFridgeEnsure(C, P, R, name, byF.get(imKey(name)));
    const tx = T.map.slot != null ? imTxt(T, r, "slot") : ""; let min = min0; const sl = imN(tx);
    if (min == null || (T.map.time == null && /soir|fermeture|matin|midi|ouverture/.test(sl) && (min === 0 || min === 720))) min = /soir|fermeture|pm|nuit/.test(sl) ? 18 * 60 : 9 * 60;
    const dt = parseDay(day); dt.setHours(Math.floor(min / 60), min % 60, 0, 0); const at = dt.getTime();
    const key = `${f.id}|${Math.round(at / 60000)}`; if (have.has(key)) { R.dup++; continue; } have.add(key);
    const okTx = T.map.ok != null ? imBool(imCell(T, r, "ok")) : null; const inRange = v >= (f.min ?? -99) && v <= (f.max ?? 99);
    const ok = okTx === false ? false : okTx === true && !inRange ? true : inRange;
    const doc = { fridgeId: f.id, fname: f.name, value: Math.round(v * 10) / 10, slot: slotOf(tx, min), day, at, uid: S.me.id, ok, action: imTxt(T, r, "action").slice(0, 300), imported: true };
    const who = imTxt(T, r, "who"); if (who) doc.byName = who.slice(0, 60);
    imCreate(P, R, "readings", doc); R.c++; if (!from || day < from) from = day; if (!to || day > to) to = day; if (!ok) R.ex.bad = (R.ex.bad || 0) + 1;
  }
  R.ex.from = from; R.ex.to = to;
};
IM_B.receptions = (T, C, P, R) => {
  const groups = new Map(); let ld = null, ls = "", lb = "";
  const RT = typeof REC_TYPES !== "undefined" ? REC_TYPES : [{ k: "frais", max: 4 }, { k: "ultra", max: 2 }, { k: "surg", max: -18 }];
  T.rows.forEach((r) => {
    const dd = imDateOf(T, r, "date"); const sup = imTxt(T, r, "supplier"); const bl = imTxt(T, r, "bl"); const name = imCase(imTxt(T, r, "name"));
    if (dd) ld = dd; if (sup) ls = sup; if (bl || dd || sup) lb = bl;
    if (!name || !ld) { R.bad++; return; }
    const k = `${ld.day}|${imKey(ls)}|${lb}`; let g = groups.get(k); if (!g) groups.set(k, (g = { day: ld.day, min: ld.min, sup: ls, bl: lb, rs: [] })); g.rs.push(r);
  });
  for (const g of groups.values()) {
    const supplier = g.sup ? imSupEnsure(C, P, R, g.sup) : "";
    if (S.receptions.some((x) => dayKey(new Date(x.at)) === g.day && imKey(x.supplier) === imKey(supplier) && String(x.bl || "") === String(g.bl || ""))) { R.dup++; R.ex.have = (R.ex.have || 0) + 1; continue; }
    let min = g.min; if (T.map.time != null) { const t = imTime(imCell(T, g.rs[0], "time")); if (t != null) min = t; } if (min == null) min = 10 * 60;
    const dt = parseDay(g.day); dt.setHours(Math.floor(min / 60), min % 60, 0, 0);
    const lines = g.rs.map((r) => {
      const name = imCase(imTxt(T, r, "name")); const qu = imQU(imCell(T, r, "qty")); const temp = imNum(imCell(T, r, "temp")); const typeTx = imN(imTxt(T, r, "type") + " " + name);
      const type = /surgel|congel|negati/.test(typeTx) || (temp != null && temp <= -12) ? "surg" : /ultra/.test(typeTx) ? "ultra" : temp != null || /frais|refriger|positi/.test(typeTx) ? "frais" : "sec";
      const tmax = type === "sec" ? null : (RT.find((x) => x.k === type) || {}).max ?? 4;
      const okTx = imBool(imCell(T, r, "ok")); const okTxt = imN(imTxt(T, r, "ok")); const refused = /refus|rejet|retour/.test(okTxt); const reserve = /reserve/.test(okTxt);
      const ok = okTx != null ? okTx && !refused : temp == null || tmax == null || temp <= tmax;
      const dl = imDateOf(T, r, "dlc"); const p = C.prod.get(imKey(name));
      const L = { name, qty: qu.q != null ? qu.q : 1, unit: imUnit(imTxt(T, r, "unit")) || qu.u || (p && p.unit) || "kg", temp: type === "sec" ? null : temp, tmax, type, dlc: dl ? dl.day : "", lot: imTxt(T, r, "lot"), fridgeId: "", photoId: "", photoUrl: "", sanitary: "", peche: "", ok, refused, reserve, reason: refused || reserve || !ok ? imTxt(T, r, "reason").slice(0, 200) : "", productId: p ? p.id : "" };
      const pr = imNum(imCell(T, r, "price")); if (!refused && pr > 0) L.price = Math.round(pr * 10000) / 10000; if (!p) L.newProduct = name;
      return L;
    });
    imCreate(P, R, "receptions", { supplier, bl: g.bl, at: dt.getTime(), uid: S.me.id, lines, imported: true }); R.c++; R.ex.lines = (R.ex.lines || 0) + lines.length;
  }
};
IM_B.staff = (T, C, P, R) => {
  const seen = new Set(); const boss = imBoss(); const posts = (s) => { const n = imN(s); return /plong/.test(n) ? "plonge" : /bar|sommel|barista/.test(n) ? "bar" : /serv|salle|rang|maitre d|runner|hote|accueil|caisse/.test(n) ? "salle" : /chef|cuisin|commis|second|patiss|cuisine|boulang|traiteur/.test(n) ? "cuisine" : ""; };
  T.rows.forEach((r, i) => {
    const fi = imWords(imTxt(T, r, "first")), la = imWords(imTxt(T, r, "name")); const name = [fi, la].filter(Boolean).join(" ").trim(); if (!name) { R.bad++; return; }
    const k = imKey(name); if (seen.has(k)) { R.dup++; return; } seen.add(k);
    const ct = imN(imTxt(T, r, "contract")); const contract = /apprenti|alternan|professionnalisation/.test(ct) ? "apprenti" : /extra|vacat|journalier/.test(ct) ? "extra" : /cdd|saison|determinee|interim|stage/.test(ct) ? "CDD" : "CDI";
    const hours = imNum(imCell(T, r, "hours")); const role = imCase(imTxt(T, r, "role")); const st = imDateOf(T, r, "start"), en = imDateOf(T, r, "end");
    let rate = imNum(imCell(T, r, "rate")); const mo = imNum(imCell(T, r, "monthly")); if ((rate == null || rate <= 0) && mo > 100) rate = mo / (((hours || 35) * 52) / 12); if (rate != null) rate = Math.round(rate * 100) / 100;
    const d = { name, role, post: posts(imTxt(T, r, "post") + " " + role), contract, weeklyHours: hours != null && hours > 0 && hours < 80 ? hours : 35, start: st ? st.day : "", end: en ? en.day : "", active: !(en && en.day < dayKey()) };
    if (boss && rate != null && rate > 0) d.hourlyGross = rate; const em = imTxt(T, r, "email"), ph = imTxt(T, r, "phone"); if (em) d.email = em; if (ph) d.phone = ph;
    const ex = C.staff.get(k);
    if (ex) { R.ex.have = (R.ex.have || 0) + 1; if (T.mode === "skip") { R.s++; return; } const p = {}; ["role", "post", "contract", "weeklyHours", "start", "end", "active", "hourlyGross", "email", "phone"].forEach((f) => { if (d[f] !== undefined && d[f] !== "" && (f !== "weeklyHours" || hours != null)) p[f] = d[f]; }); if (imPatch(P, R, "staff", ex.doc, p)) R.u++; else R.s++; return; }
    const m = C.mem.get(k); const doc = { ...d, color: PALETTE[(S.staff.length + C.n) % PALETTE.length], chargesPct: 42, memberId: m ? m.id : "", createdAt: C.now + C.n++, by: S.me.id };
    if (m) { if (S.staff.some((s) => s.id === "m_" + m.id)) { R.s++; return; } P.ops.push({ col: "staff", id: "m_" + m.id, t: "c", data: doc, tab: R.id }); }
    else imCreate(P, R, "staff", doc);
    C.staff.set(k, { id: "x", doc: { id: "x", ...doc } }); R.c++;
  });
};
const IM_DOW = [["dim", 0], ["lun", 1], ["mar", 2], ["mer", 3], ["jeu", 4], ["ven", 5], ["sam", 6]];
function imFreq(tx) {
  const s = imN(tx); const days = IM_DOW.filter(([p]) => new RegExp(`\\b${p}`).test(s) && !/\bmardi gras/.test(s)).map(([, n]) => n);
  if (/apres chaque service|chaque service|apres le service|apres service|2 ?x? ?(par|\/)? ?j|bi ?quotidien|midi et soir|2 fois par jour/.test(s)) return { freq: "service" };
  if (/hebdo|semaine|weekly|1 ?x? ?(par|\/) ?s|chaque sem/.test(s)) return { freq: "semaine", wday: days.length === 1 ? days[0] : null };
  if (/mensuel|mois|monthly|trimestr|semestr|annuel|an\b|annee/.test(s)) return { freq: "mois", note: /trimestr|semestr|annuel|annee|an\b/.test(s) ? imStr(tx) : "" };
  if (days.length && !/tous les jours|chaque jour|quotidien/.test(s)) return { freq: "jours", days };
  return { freq: "jour" };
}
IM_B.chores = (T, C, P, R) => {
  const seen = new Set(); const zones = typeof MEN_ZONES !== "undefined" ? MEN_ZONES : ["Cuisine", "Plonge", "Chambre froide", "Salle", "Sanitaires", "Bar"];
  T.rows.forEach((r) => {
    const name = imCase(imTxt(T, r, "name")); if (!name) { R.bad++; return; }
    let zone = imCase(imTxt(T, r, "zone")); const zk = imN(zone); const zm = zones.find((z) => imN(z) === zk) || (/wc|toilette|sanitaire|lavabo/.test(zk) ? "Sanitaires" : /plonge|laverie/.test(zk) ? "Plonge" : /chambre froide|cf\b/.test(zk) ? "Chambre froide" : /salle|terrasse/.test(zk) ? "Salle" : /bar\b|comptoir/.test(zk) ? "Bar" : /cuisine|laboratoire|labo|production/.test(zk) ? "Cuisine" : ""); if (zm) zone = zm;
    const k = imKey(name) + "|" + imKey(zone); if (seen.has(k)) { R.dup++; return; } seen.add(k);
    const fq = imFreq(imTxt(T, r, "freq")); const mt = imN(imTxt(T, r, "moment") + " " + (T.map.moment == null ? imTxt(T, r, "freq") : ""));
    const moment = fq.freq === "service" ? "midi" : /ouverture|matin|avant (le )?service|debut|arrivee/.test(mt) ? "ouverture" : /apres (le )?midi|fin du midi/.test(mt) ? "midi" : "fermeture";
    const notes = [imTxt(T, r, "product") && `Produit : ${imTxt(T, r, "product")}`, imTxt(T, r, "method") && `Méthode : ${imTxt(T, r, "method")}`, imTxt(T, r, "notes"), fq.note && `Fréquence d'origine : ${fq.note}`].filter(Boolean).join(" · ").slice(0, 500);
    const d = { name, zone, moment, freq: fq.freq, days: fq.days || [], wday: fq.freq === "semaine" ? fq.wday ?? null : null, mday: null, who: imWords(imTxt(T, r, "who")), notes, photo: false };
    const ex = C.chores.get(k);
    if (ex) { R.ex.have = (R.ex.have || 0) + 1; if (T.mode === "skip") { R.s++; return; } const { name: _n, zone: _z, photo: _p, ...p } = d; if (imPatch(P, R, "chores", ex.doc, p)) R.u++; else R.s++; return; }
    imCreate(P, R, "chores", { ...d, createdAt: C.now + C.n++ }); C.chores.set(k, { id: "x", doc: d }); R.c++;
  });
};
const IM_OBL = [["extincteurs", /extinct/], ["nuisibles", /nuisible|derat|desinsect|\brat|cafard|blatte|3d\b|rongeur|insecte/], ["hotte", /hotte|conduit|extraction|degraiss/], ["electricite", /electri/], ["gaz", /\bgaz|cuisson/],
  ["baes", /baes|eclairage de secu|bloc autonome/], ["alarme", /alarme|desenfum|ssi\b|detection incendie/], ["graisse", /graisse|separateur/], ["vmc", /vmc|clim|ventilation/], ["froid", /groupe froid|chambre froide|frigorifique|fluide/],
  ["chaudiere", /chaudiere|chauffe eau|ballon/], ["analyses", /analyse|microbio|laboratoire|prelevement/], ["formation", /formation|hygiene alimentaire/], ["permis", /permis d exploitation|licence/], ["duerp", /duerp|document unique/],
  ["pms", /pms|plan de maitrise/], ["registre", /registre de securite/], ["affichages", /affichage/], ["thermometres", /thermometre|etalonnage|sonde/], ["assurance", /assurance|\brc\b|multirisque/], ["accessibilite", /accessibilit/],
  ["dechets", /huile|biodechet|dechet/], ["sacem", /sacem|musique/]];
function imMonths(tx) {
  const s = imN(tx); if (!s) return null; const n = imNum(s);
  if (/mensuel|chaque mois|tous les mois|monthly/.test(s)) return 1; if (/bimestr/.test(s)) return 2; if (/trimestr|quarter/.test(s)) return 3; if (/semestr|2 ?(fois|x) ?(par|\/) ?an/.test(s)) return 6;
  if (/4 ?(fois|x|passages?) ?(par|\/) ?an/.test(s)) return 3; if (/6 ?(fois|x|passages?) ?(par|\/) ?an/.test(s)) return 2; if (/12 ?(fois|x) ?(par|\/) ?an/.test(s)) return 1;
  if (/an|annuel|annee|year/.test(s)) return n && n > 1 && n < 20 ? n * 12 : 12; if (/mois|month/.test(s)) return n && n > 0 && n <= 120 ? n : 1;
  if (n && n > 0 && n <= 120) return n; return null;
}
IM_B.obligations = (T, C, P, R) => {
  const seen = new Set(); const cat = typeof OBL_CATALOG !== "undefined" ? OBL_CATALOG : [];
  T.rows.forEach((r) => {
    const raw = imCase(imTxt(T, r, "name")); if (!raw) { R.bad++; return; } const n = imN(raw);
    const hit = IM_OBL.find(([, re]) => re.test(n)); const c = hit && cat.find((x) => x.key === hit[0]);
    const k = c ? "k:" + c.key : imKey(raw); if (seen.has(k)) { R.dup++; return; } seen.add(k);
    const every = imMonths(imTxt(T, r, "every")) || (c ? c.m : 12); const last = imDateOf(T, r, "last"), next = imDateOf(T, r, "next");
    const d = { everyMonths: every, provider: imWords(imTxt(T, r, "provider")), phone: imTxt(T, r, "phone"), contract: imTxt(T, r, "contract"), notes: imTxt(T, r, "notes") };
    if (last) d.lastDone = last.day; if (next) { d.nextDue = next.day; d.dueManual = true; }
    const ex = (c && C.oblKey.get(c.key)) || C.obl.get(imKey(raw)); let oid;
    if (ex) { R.ex.have = (R.ex.have || 0) + 1; oid = ex.id; if (T.mode === "skip") { R.s++; return; } const p = { archived: false }; Object.entries(d).forEach(([f, v]) => { if (v !== "" && v != null) p[f] = v; }); if (p.lastDone && ex.doc.lastDone && ex.doc.lastDone > p.lastDone) delete p.lastDone; if (imPatch(P, R, "obligations", ex.doc, p)) R.u++; else R.s++; }
    else {
      const ct = /incendie|extinct|desenfum|baes|alarme|secu/.test(n) ? "feu" : /hygiene|haccp|nuisible|analyse|graisse|nettoyage/.test(n) ? "hyg" : /affich/.test(n) ? "aff" : /assurance|licence|permis|formation|duerp|sacem|admin|contrat/.test(n) ? "admin" : "tech";
      oid = imCreate(P, R, "obligations", { key: c ? c.key : "perso-" + imId(), name: c ? c.name : raw, cat: c ? c.cat : ct, lastDone: null, nextDue: null, dueManual: false, archived: false, createdAt: C.now + C.n++, ...d });
      C.oblKey.set(c ? c.key : "_" + oid, { id: oid, doc: {} }); C.obl.set(imKey(raw), { id: oid, doc: {} }); R.c++;
    }
    if (last && !S.oblLogs.some((l) => l.oblId === oid && l.day === last.day)) { const cost = imNum(imCell(T, r, "cost")); imCreate(P, R, "oblLogs", { oblId: oid, day: last.day, provider: d.provider, by: S.me.id, uid: S.me.id, at: C.now + C.n++, notes: "Importé", files: [], ...(cost > 0 ? { cost } : {}) }); R.ex.logs = (R.ex.logs || 0) + 1; }
  });
};
function imPlan() {
  const P = { ops: [], tabs: {} }; const C = imCtx();
  for (const k of IM_BUILD_ORDER) for (const T of IM.tables) {
    if (!T.on || T.kind !== k) continue; const R = (P.tabs[T.id] = { id: T.id, kind: k, c: 0, u: 0, s: 0, bad: 0, dup: 0, ex: {} });
    try { IM_B[k](T, C, P, R); } catch (e) { console.warn("import", e); R.err = true; }
  }
  return P;
}

/* ───────────── ingest ───────────── */
async function imIngest(files, label) {
  if (IM.busy) return; IM.busy = true; IM.errs = []; const add = IM.step === "review";
  if (!add) IM.tables = []; IM.step = "read"; rerender();
  const t0 = performance.now(); const raws = [];
  for (const f of files) {
    try { const ts = f.rows ? [f] : await imReadFile(f); if (!ts.length) IM.errs.push(`${f.name} : vide`); raws.push(...ts); if (!f.rows) IM.files.push(f.name); }
    catch (e) { console.warn("import read", e); IM.errs.push(`${f.name || label} : ${e.why || "format illisible"}`); }
  }
  for (const r of raws) { const T = imMakeTable(r); if (T && T.rows.length) IM.tables.push(T); }
  await imSleep(Math.max(0, 450 - (performance.now() - t0)));
  IM.busy = false; IM.step = IM.tables.length ? "review" : "pick";
  if (!IM.tables.length) { SFX.err(); toast(IM.errs[0] || "Aucun tableau trouvé dans ce fichier.", "err"); } else { SFX.ok(); buzz(6); }
  rerender(); const v = $("#viewport .view:not(.leave)"); v && v.scrollTo({ top: 0 });
}
function imFiles(list) { const fs = [...(list || [])].filter((f) => f && f.size !== undefined); if (fs.length) imIngest(fs); }

/* ───────────── history + suppliers (own watches, re-opened per restaurant) ───────────── */
function imWatch() {
  if (!S.rid || IM.wRid === S.rid) return; IM.wRid = S.rid; IM.hist = []; IM.sup = []; const rid = S.rid; let seeded = false;
  DB.watch("imports", {}, (rows) => { if (IM.wRid !== rid) return; IM.hist = rows.sort((a, b) => (b.at || 0) - (a.at || 0)); if (DB.mode === "demo" && !rows.length && !seeded) { seeded = true; imSeedDemo(); } if (S.route === "import" && IM.step === "pick") refresh(); });
  DB.watch("suppliers", {}, (rows) => { if (IM.wRid === rid) IM.sup = rows; });
}
/* demo: one believable past import (the suppliers list), which can really be undone */
function imSeedDemo() {
  if (DB.mode !== "demo") return; const now = Date.now(), at = now - 9 * 864e5 - 3 * 36e5; const iid = "imdemo1";
  const L = [["Metro", "Service commandes", "01 41 00 00 00"], ["Marée Atlantique", "Yann Le Goff", "02 98 00 00 00"], ["Boucherie Martin", "Paul Martin", "04 78 00 00 00"], ["Primeurs du Marché", "Sophie Bernard", "04 72 00 00 00"], ["Cave Saint-Vincent", "Luc Moreau", "03 80 00 00 00"], ["Fromagerie Laurent", "Anne Laurent", "04 77 00 00 00"]];
  const path = DB.path("suppliers"); const st = (DB.local[path] ||= {}); const ids = [];
  L.forEach(([name, contact, phone], i) => { const id = "imsup" + i; ids.push(id); st[id] = { name, contact, phone, createdAt: at + i, importId: iid }; });
  (DB.local[DB.path("imports")] ||= {})[iid] = { at, uid: S.me.id, by: S.me.name || "", files: ["Fournisseurs.xlsx"], source: "Excel", counts: { suppliers: L.length }, created: { suppliers: ids }, updated: {}, total: L.length, state: "done" };
  DB.emit(path); DB.emit(DB.path("imports"));
}

/* ───────────── writing ───────────── */
async function imApply(ops, onProg) {
  const N = ops.length; let done = 0; const local = DB.mode !== "db"; const fsb = !local && DB.db && typeof DB.db.batch === "function" && typeof DB.db.collection === "function";
  const B = local ? 150 : fsb ? 400 : 25; let fail = 0;
  for (let i = 0; i < N; i += B) {
    const chunk = ops.slice(i, i + B);
    if (local) {
      const touched = new Set();
      for (const o of chunk) { const path = DB.path(o.col); const st = (DB.local[path] ||= {}); if (o.t === "d") delete st[o.id]; else if (o.t === "u") { if (st[o.id]) st[o.id] = { ...st[o.id], ...DB.clean(o.data) }; } else st[o.id] = DB.clean(o.data); touched.add(path); }
      touched.forEach((p) => DB.emit(p));
    } else if (fsb) {
      try { const b = DB.db.batch(); for (const o of chunk) { const ref = DB.db.collection(DB.path(o.col)).doc(o.id); if (o.t === "d") b.delete(ref); else if (o.t === "u") b.set(ref, DB.clean(o.data), { merge: true }); else b.set(ref, DB.clean(o.data)); } await DB.dbw(b.commit()); }
      catch (e) { console.warn("import batch", e); fail += chunk.length; }
    } else {
      await Promise.all(chunk.map((o) => Promise.resolve(o.t === "d" ? DB.del(o.col, o.id) : o.t === "u" ? DB.update(o.col, o.id, o.data) : DB.set(o.col, o.id, o.data)).catch((e) => { console.warn(e); fail++; })));
    }
    done += chunk.length; onProg && onProg(done, N, chunk[chunk.length - 1]); await imSleep(local ? 12 : 0);
  }
  return fail;
}
function imCounts(P) {
  const out = {};
  for (const T of IM.tables) { const R = P.tabs[T.id]; if (!R) continue; out[R.kind] = (out[R.kind] || 0) + R.c + R.u; if (R.ex.sup) out.suppliers = (out.suppliers || 0) + R.ex.sup; if (R.ex.fr) out.fridges = (out.fridges || 0) + R.ex.fr; }
  Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; }); return out;
}
const imSumTx = (counts) => IM_ORDER.filter((k) => counts[k]).map((k) => imPl(counts[k], k)).join(", ");
function imLocalRoom(P) { if (DB.mode !== "local") return true; try { const add = JSON.stringify(P.ops.map((o) => o.data)).length; const cur = (localStorage.getItem("gg-local") || "").length; return cur + add < 4.6e6; } catch (e) { return true; } }
async function imRun() {
  if (IM.step !== "review" || IM.busy) return;
  const P = imPlan(); const ops = P.ops; if (!ops.length) { SFX.tick(); toast("Tout est déjà dans Gusto : rien de nouveau.", "info"); return; }
  const cols = [...new Set(ops.map((o) => o.col))];
  if (typeof abBlocked === "function") { const bl = cols.find((c) => abBlocked(c)); if (bl) { DB.gate(bl); return; } }
  if (!imLocalRoom(P)) { SFX.err(); toast("Trop de données pour cet appareil : créez un compte pour tout importer.", "err"); return; }
  IM.busy = true; const iid = "im" + imId(); const t0 = performance.now();
  /* custom units kept from the files become the restaurant's own units (core unitSave) */
  if (typeof unitSave === "function") { const base = new Set([...(typeof UNITS !== "undefined" ? UNITS : []), ...(typeof STK_UNITS !== "undefined" ? STK_UNITS : []), "kg", "g", "L", "cl", "ml", "PCE", "DZ"].map((u) => u.toLowerCase())); const nu = new Set(); ops.forEach((o) => { if (o.col === "products" || o.col === "lots") { const u = o.data && o.data.unit; if (u) nu.add(u); } if (o.col === "receptions") (o.data.lines || []).forEach((L) => L.unit && nu.add(L.unit)); }); [...nu].filter((u) => !base.has(String(u).toLowerCase()) && !(S.resto && (S.resto.units || []).includes(u))).slice(0, 12).forEach((u) => { try { unitSave(u); } catch (e) {} }); }
  const created = {}, updated = {};
  ops.forEach((o) => { if (o.t === "c") { o.data.importId = iid; (created[o.col] ||= []).push(o.id); } else (updated[o.col] ||= []).push({ id: o.id, before: o.before }); });
  const counts = imCounts(P); const files = [...new Set(IM.tables.filter((T) => T.on && P.tabs[T.id]).map((T) => T.file))];
  const source = [...new Set(IM.tables.filter((T) => T.on && T.preset).map((T) => T.preset.t))].join(", ") || (files.some((f) => /\.(xlsx?|ods)$/i.test(f)) ? "Excel" : files.some((f) => /\.json$/i.test(f)) ? "JSON" : files.some((f) => /\.(csv|tsv|txt)$/i.test(f)) ? "CSV" : "Tableau collé");
  const rec = { at: Date.now(), uid: S.me.id, by: S.me.name || "", files, source, counts, created, updated, total: ops.length, state: "running" };
  IM.step = "run"; IM.prog = { n: 0, N: ops.length, col: ops[0].col, shown: 0 }; VIEWS.import.live = false; rerender(); imAnim();
  try { await imApply([{ col: "imports", id: iid, t: "c", data: rec }]); } catch (e) { console.warn(e); }
  const fail = await imApply(ops, (n, N, o) => { IM.prog.n = n; IM.prog.col = o.col; });
  const dt = performance.now() - t0; await imSleep(Math.max(0, 1100 - dt));
  await imApply([{ col: "imports", id: iid, t: "u", data: { state: fail ? "partial" : "done", failed: fail || 0, ms: Math.round(dt) } }]).catch(() => {});
  logEvent("import", `a importé ${imSumTx(counts)}${source ? ` depuis ${source}` : ""}`, { ref: iid });
  IM.prog.n = IM.prog.N; await imSleep(380);
  IM.last = { iid, counts, P, ms: dt, fail, source }; IM.busy = false; IM.step = "done"; VIEWS.import.live = true;
  SFX.done(); buzz([10, 30, 10, 30, 20]); rerender(); setTimeout(() => burst(), 160); const v = $("#viewport .view:not(.leave)"); v && v.scrollTo({ top: 0 });
  if (fail) toast(`${imPlural(fail, "élément")} n'ont pas pu être enregistrés.`, "err");
}
function imAnim() {
  const tick = () => {
    const G = IM.prog; if (!G || IM.step !== "run") return;
    G.shown += (G.n - G.shown) * 0.16 + (G.n > G.shown ? 0.4 : 0); if (G.shown > G.n) G.shown = G.n;
    const pct = G.N ? Math.min(100, Math.round((G.shown / G.N) * 100)) : 100;
    const fg = $("#imRingFg"); if (fg) fg.style.strokeDashoffset = String(100 - pct);
    const p = $("#imPct"); if (p) p.textContent = pct;
    const t = $("#imRunT"); const k = imColKind(G.col); if (t && t.dataset.k !== k && performance.now() - (G.lt || 0) > 420) { G.lt = performance.now(); t.dataset.k = k; t.textContent = imRunLabel(k); t.classList.remove("in"); void t.offsetWidth; t.classList.add("in"); }
    const c = $("#imRunN"); if (c) c.textContent = `${imFmt(Math.round(G.shown))} / ${imFmt(G.N)}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const IM_COLK = { products: "products", counts: "products", lots: "products", suppliers: "suppliers", notes: "recipes", fridges: "fridges", readings: "readings", receptions: "receptions", staff: "staff", chores: "chores", obligations: "obligations", oblLogs: "obligations", imports: "products" };
const imColKind = (col) => IM_COLK[col] || "products";
const imRunLabel = (k) => ({ products: "Produits", suppliers: "Fournisseurs", recipes: "Recettes", fridges: "Équipements", readings: "Relevés", receptions: "Réceptions", staff: "Équipe", chores: "Nettoyage", obligations: "Contrôles" }[k] || "Import");
async function imUndo(iid) {
  const rec = IM.hist.find((h) => h.id === iid) || (IM.last && IM.last.iid === iid ? { id: iid, ...imRecOf(iid) } : null); if (!rec || rec.undone) return;
  const ops = [];
  Object.entries(rec.created || {}).forEach(([col, ids]) => ids.forEach((id) => ops.push({ col, id, t: "d" })));
  const has = (col, id) => { const key = { notes: "notes", products: "products", fridges: "fridges", staff: "staff", chores: "chores", obligations: "obligations", counts: "counts" }[col]; if (col === "suppliers") return IM.sup.some((x) => x.id === id); return key ? S[key].some((x) => x.id === id) : true; };
  Object.entries(rec.updated || {}).forEach(([col, L]) => L.forEach((u) => { if (has(col, u.id)) ops.push({ col, id: u.id, t: "u", data: u.before }); }));
  IM.busy = true; toast("Annulation en cours…", "info");
  await imApply(ops); await imApply([{ col: "imports", id: iid, t: "u", data: { undone: true, undoneAt: Date.now(), undoneBy: S.me.id } }]);
  const h = IM.hist.find((x) => x.id === iid); if (h) h.undone = true;
  logEvent("import", `a annulé l'import du ${shortDate(dayKey(new Date(rec.at || Date.now())))} (${imSumTx(rec.counts || {}) || "données"})`, { ref: iid });
  IM.busy = false; SFX.close(); buzz(8); toast("Import annulé : tout est revenu comme avant");
  if (IM.step === "done") imReset(); else rerender();
}
const imRecOf = (iid) => { const L = IM.last; if (!L || L.iid !== iid) return null; const created = {}, updated = {}; L.P.ops.forEach((o) => { if (o.t === "c") (created[o.col] ||= []).push(o.id); else (updated[o.col] ||= []).push({ id: o.id, before: o.before }); }); return { at: Date.now(), counts: L.counts, created, updated }; };
function imReset() { IM.step = "pick"; IM.tables = []; IM.errs = []; IM.files = []; IM.last = null; IM.prog = null; VIEWS.import.live = true; rerender(); }

/* ───────────── rendering ───────────── */
const imWell = (k, cls = "") => `<span class="im-w ${IM_K[k] ? IM_K[k].w : "vi"} ${cls}">${ico(IC[IM_K[k]?.ic] ? IM_K[k].ic : "grid")}</span>`;
function imPick() {
  const H = IM.hist.slice(0, 8); const demo = DB.mode === "demo"; const hint = IM.hint && IM_K[IM.hint];
  return `<div class="inner im">${topBar("Importer")}
    <section class="wall im-hero st" style="--i:1">
      <div class="im-hero-tx"><div class="title">${hint ? `Vos ${esc(hint.pl.replace("équipements", "frigos"))} en 1 minute` : "Passez à Gusto en 1 minute"}</div><p>Déposez vos exports, on range tout.</p></div>
      <div class="im-stack" aria-hidden="true"><span class="f f1"></span><span class="f f2">CSV</span><span class="f f3">XLSX</span></div>
    </section>
    <label class="im-drop st" style="--i:2" id="imDrop" for="imFile">
      <span class="im-drop-ic">${ico("imUp")}</span>
      <b>Choisir des fichiers</b><em>Excel, CSV ou JSON · plusieurs à la fois</em>
      <input type="file" id="imFile" multiple accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.ods,.json,text/csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
    </label>
    <div class="grid2 st" style="--i:3"><button class="btn soft" data-act="imPaste">${ico("imPaste")}Coller</button>${demo ? `<button class="btn soft" data-act="imDemo">${ico("imPlay")}Un exemple</button>` : `<button class="btn soft" data-act="imModels">${ico("download")}Modèles</button>`}</div>
    <div class="im-srcs st" style="--i:4"><span class="lbl">Marche avec</span><div>${IM_SOURCES.map((s) => `<span class="im-src">${esc(s)}</span>`).join("")}</div></div>
    <section class="st" style="--i:5"><div class="lbl im-lbl">On reconnaît</div><div class="im-kinds">${IM_ORDER.map((k, i) => `<button class="im-kt" style="--j:${i}" data-act="imKindInfo" data-v="${k}">${imWell(k)}<span>${esc(IM_K[k].t)}</span></button>`).join("")}</div></section>
    ${H.length ? `<section class="st" style="--i:6"><div class="lbl im-lbl">Derniers imports</div><div class="glass pad im-hist">${H.map(imHistRow).join("")}</div></section>` : ""}
  </div>`;
}
function imHistRow(h) {
  const files = h.files || []; const f = files[0] || "Import"; const more = files.length > 1 ? ` +${files.length - 1}` : "";
  const sum = imSumTx(h.counts || {}) || imPlural(h.total || 0, "élément");
  return `<div class="li im-hr${h.undone ? " off" : ""}"><span class="im-w vi sm">${ico("imFile")}</span><div class="tx"><b>${esc(f)}${more}</b><em>${esc(when(h.at || 0))} · ${esc(sum)}</em></div>${h.undone ? `<span class="pill neu">Annulé</span>` : h.state === "running" ? `<span class="pill warn">Interrompu</span><button class="btn soft sm" data-act="imUndoAsk" data-id="${esc(h.id)}">Annuler</button>` : `<button class="btn soft sm" data-act="imUndoAsk" data-id="${esc(h.id)}" aria-label="Annuler cet import">${ico("imUndo")}<span class="im-hide-s">Annuler</span></button>`}</div>`;
}
function imRead() {
  return `<div class="inner im">${topBar("Importer")}<div class="glass im-reading st" style="--i:1"><div class="im-scan">${ico("imFile")}<i></i></div><b class="h3">Lecture des fichiers…</b><p class="sub">On cherche les colonnes.</p></div></div>`;
}
function imFacts(T, R) {
  const K = IM_K[T.kind]; const f = []; if (!R) return { big: 0, f };
  const total = R.c + R.u + R.s; const ex = R.ex;
  if (T.kind === "readings") { if (ex.fr) f.push(["acc", `+ ${imPl(ex.fr, "fridges")}`]); if (ex.from) f.push(["neu", ex.from === ex.to ? shortDate(ex.from) : `${shortDate(ex.from)} → ${shortDate(ex.to)}`]); if (ex.bad) f.push(["bad", `${imFmt(ex.bad)} hors seuil`]); }
  if (ex.sup && T.kind !== "suppliers") f.push(["acc", `+ ${imPl(ex.sup, "suppliers")}`]);
  if (ex.lots) f.push(["acc", `${imPlural(ex.lots, "lot")} en stock`]); if (ex.cnt) f.push(["neu", `Stock de ${MONTHS[new Date().getMonth()]}`]); if (ex.ing) f.push(["neu", `${imPlural(ex.ing, "ingrédient")}`]);
  if (ex.lines) f.push(["neu", `${imPlural(ex.lines, "produit")} contrôlé${ex.lines > 1 ? "s" : ""}`]); if (ex.logs) f.push(["neu", `${imPlural(ex.logs, "passage")}`]);
  if (R.dup && !["readings", "receptions"].includes(T.kind)) f.push(["warn", `${imPlural(R.dup, "doublon")} dans le fichier`]);
  if (T.kind === "readings" && R.dup) f.push(["neu", `${imFmt(R.dup)} déjà là`]); if (T.kind === "receptions" && R.dup) f.push(["neu", `${imFmt(R.dup)} déjà là`]);
  if (ex.old) f.push(["neu", `${imPlural(ex.old, "lot")} périmé${ex.old > 1 ? "s" : ""} ignoré${ex.old > 1 ? "s" : ""}`]);
  if (R.bad) f.push(["neu", `${imPlural(R.bad, "ligne")} vide${R.bad > 1 ? "s" : ""}`]);
  if (T.trunc) f.push(["warn", "60 000 lignes max"]);
  return { big: T.kind === "readings" || T.kind === "receptions" ? R.c : total, f, K };
}
function imCard(T, R, i) {
  const name = T.sheet && T.sheet !== T.file ? `${T.file} · ${T.sheet}` : T.file;
  if (!T.kind) return `<article class="glass im-card unk st" style="--i:${2 + i}">
      <div class="im-ch"><span class="im-w sa">${ico("imCols")}</span><div class="tx"><b>${esc(name)}</b><em>${imPlural(T.rows.length, "ligne")} · ${imPlural(T.headers.length, "colonne")}</em></div></div>
      <div class="im-unk"><b>Tableau non reconnu</b><span>Dites-nous ce que c'est, on s'occupe du reste.</span></div>
      <div class="im-ca"><button class="btn acc sm" data-act="imMap" data-id="${T.id}">${ico("imCols")}Choisir les colonnes</button><button class="btn ghost sm" data-act="imDrop" data-id="${T.id}">Ignorer</button></div></article>`;
  const { big, f, K } = imFacts(T, R); const have = R && (R.ex.have || 0) > 0 && !["readings", "receptions"].includes(T.kind);
  return `<article class="glass im-card${T.on ? "" : " off"} st" style="--i:${2 + i}">
    <div class="im-ch">${imWell(T.kind)}<div class="tx"><b>${esc(name)}</b><em>${esc(K.t)}${T.preset ? ` · ${esc(T.preset.t)}` : ""}</em></div><button class="im-sw${T.on ? " on" : ""}" role="switch" aria-checked="${T.on}" aria-label="Importer ce tableau" data-act="imOn" data-id="${T.id}"><i></i></button></div>
    <div class="im-big"><b class="mono">${imFmt(big)}</b><span>${esc(big > 1 ? K.pl : K.one)}</span>${R && R.u ? `<em>dont ${imFmt(R.u)} mis à jour</em>` : R && R.c && R.c !== big ? `<em>dont ${imFmt(R.c)} nouveaux</em>` : ""}</div>
    ${f.length ? `<div class="im-facts">${f.map(([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`).join("")}</div>` : ""}
    ${R && R.err ? `<div class="im-warn">${ico("alert")}Une partie n'a pas pu être lue : vérifiez les colonnes.</div>` : ""}
    ${have && T.on ? `<div class="im-dup"><span>${imFmt(R.ex.have)} déjà dans Gusto</span><div class="seg im-seg" data-v="${T.mode}"><button class="${T.mode === "update" ? "on" : ""}" data-act="imMode" data-id="${T.id}" data-v="update">Mettre à jour</button><button class="${T.mode === "skip" ? "on" : ""}" data-act="imMode" data-id="${T.id}" data-v="skip">Garder</button></div></div>` : ""}
    <div class="im-ca"><button class="btn soft sm" data-act="imMap" data-id="${T.id}">${ico("imCols")}Colonnes</button><span class="im-cols">${imMappedTx(T)}</span></div>
  </article>`;
}
function imMappedTx(T) { if (!T.kind) return ""; const F = IM_K[T.kind].f; const n = F.filter((f) => T.map[f[0]] != null).length + (T.wide ? T.wide.cols.length : 0) + (T.alCols.length && ["products", "recipes"].includes(T.kind) ? 1 : 0); return `${n} reconnue${n > 1 ? "s" : ""} sur ${T.headers.length}`; }
function imReview() {
  const P = imPlan(); IM._plan = P; const on = IM.tables.filter((T) => T.on && T.kind); const n = P.ops.filter((o) => o.t === "c").length, u = P.ops.filter((o) => o.t === "u").length;
  const counts = imCounts(P); const kinds = IM_ORDER.filter((k) => counts[k]);
  const sum = kinds.map((k) => `<span class="im-sk">${imWell(k, "sm")}<b class="mono">${imFmt(counts[k])}</b><em>${esc(counts[k] > 1 ? IM_K[k].pl : IM_K[k].one)}</em></span>`).join("");
  return `<div class="inner wide im">${topBar("Vérifier", { right: `<button class="btn soft sm im-add" data-act="imAddFile">${ico("plus")}<span>Fichier</span></button>` })}
    <section class="glass im-sum st" style="--i:1"><div class="im-sum-h"><b class="h3">${on.length ? "Prêt à importer" : "Rien à importer"}</b><em>${imPlural(IM.tables.length, "tableau", "tableaux")} · ${imPlural(IM.tables.reduce((a, T) => a + T.rows.length, 0), "ligne")}</em></div>${sum ? `<div class="im-sks">${sum}</div>` : ""}</section>
    ${IM.errs.length ? `<div class="im-warn st" style="--i:1">${ico("alert")}${IM.errs.map(esc).join(" · ")}</div>` : ""}
    <div class="im-cards">${IM.tables.map((T, i) => imCard(T, P.tabs[T.id], i)).join("")}</div>
    <input type="file" id="imFile2" multiple hidden accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.ods,.json">
    <div class="ctabar grid2 im-cta st" style="--i:9"><button class="btn soft" data-act="imCancel">Annuler</button><button class="btn acc" data-act="imGo" ${n + u ? "" : "disabled"}>${n + u ? `Tout importer · ${imFmt(n + u)}` : "Rien de nouveau"}</button></div>
  </div>`;
}
function imRunView() {
  const G = IM.prog || { n: 0, N: 1 };
  return `<div class="inner narrow im"><section class="glass im-run st" style="--i:0">
    <div class="im-ringw"><svg class="im-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" id="imRingFg" cx="60" cy="60" r="52" pathLength="100"/></svg><div class="im-pct"><b id="imPct" class="mono">0</b><span>%</span></div></div>
    <b class="h2 im-rt" id="imRunT" data-k="">Import</b><em class="im-rn mono" id="imRunN">0 / ${imFmt(G.N)}</em>
    <div class="im-fly" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  </section></div>`;
}
function imDone() {
  const L = IM.last || { counts: {} }; const kinds = IM_ORDER.filter((k) => L.counts[k]); const first = kinds[0];
  const route = (k) => { const g = IM_K[k].go; return g === "staff" && !VIEWS.staff ? (VIEWS.equipe ? "equipe" : "home") : VIEWS[g] ? g : "home"; };
  const sec = (L.ms || 0) / 1000;
  return `<div class="inner narrow im">${topBar("Importé", { noBack: true })}
    <section class="wall im-done st" style="--i:1"><span class="im-bigok">${ico("check")}</span><div class="title">C'est importé&nbsp;!</div><p>${sec < 1.5 ? "En un éclair" : `En ${fmt(sec, 1)} s`}${L.source ? ` · depuis ${esc(L.source)}` : ""}</p></section>
    <div class="glass pad im-res st" style="--i:2">${kinds.map((k) => `<div class="li tap" role="button" tabindex="0" data-go="${route(k)}">${imWell(k)}<div class="tx"><b>${esc(imPl(L.counts[k], k))}</b><em>${esc(IM_K[k].t)}</em></div>${ico("chev")}</div>`).join("")}</div>
    <div class="grid2 st" style="--i:3"><button class="btn soft" data-act="imUndoAsk" data-id="${esc(L.iid || "")}">${ico("imUndo")}Annuler</button><button class="btn acc" data-act="imFinish" data-v="${first ? route(first) : "home"}">Terminé</button></div>
    <button class="btn ghost st" style="--i:4" data-act="imAgain">Importer autre chose</button>
  </div>`;
}
VIEWS.import = {
  render(p = {}) {
    imWatch();
    if (p !== IM.lastP) { IM.lastP = p; if (IM.step === "pick") IM.hint = p && p.kind && IM_K[p.kind] ? p.kind : null; } /* a new visit: the hint comes from IMPORT.open(kind) */
    if (!imCan()) return `<div class="inner narrow">${topBar("Importer")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("lock")}</div><b>Réservé au gérant</b>Demandez-lui d'importer vos données.</div></div>`;
    if (IM.step === "read") return imRead();
    if (IM.step === "review") return imReview();
    if (IM.step === "run") return imRunView();
    if (IM.step === "done") return imDone();
    return imPick();
  },
  after(v) {
    const inp = $("#imFile", v) || $("#imFile2", v); if (inp) inp.addEventListener("change", () => { const fs = [...inp.files]; inp.value = ""; imFiles(fs); });
    const i2 = $("#imFile2", v); if (i2 && i2 !== inp) i2.addEventListener("change", () => { const fs = [...i2.files]; i2.value = ""; imFiles(fs); });
    if (IM.step === "run") { const fg = $("#imRingFg", v); if (fg) fg.style.strokeDashoffset = String(100 - Math.round(((IM.prog?.shown || 0) / (IM.prog?.N || 1)) * 100)); }
    if (v.dataset.imDnd) return; v.dataset.imDnd = "1";
    let depth = 0; const zone = () => $("#imDrop", v);
    v.addEventListener("dragenter", (e) => { if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return; e.preventDefault(); depth++; v.classList.add("im-dnd"); const z = zone(); z && z.classList.add("over"); });
    v.addEventListener("dragover", (e) => { if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    v.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) { v.classList.remove("im-dnd"); const z = zone(); z && z.classList.remove("over"); } });
    v.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; v.classList.remove("im-dnd"); if (!["pick", "review"].includes(IM.step)) return; SFX.tap(); imFiles(e.dataTransfer.files); });
  },
};

/* ───────────── mapping sheet ───────────── */
function imMapSheet(T) {
  const K = T.kind && IM_K[T.kind];
  const smp = (v) => { if (typeof v === "number") { if (v > 20000 && v < 80000) { const d = imDate(v); if (d) return shortDate(d.day) + "/" + d.day.slice(0, 4); } return String(Math.round(v * 1000) / 1000).replace(".", ","); } return imStr(v).slice(0, 22); };
  const opt = (sel) => `<option value="">Ignorer</option>` + T.headers.map((h, i) => { const s = T.rows.find((r) => imStr(r[i]) !== ""); const ex = s ? smp(s[i]) : ""; return `<option value="${i}" ${sel === i ? "selected" : ""}>${esc(h)}${ex ? ` · ${esc(ex)}` : ""}</option>`; }).join("");
  const fields = K ? K.f.filter(([k]) => !(T.wide && ["fridge", "value"].includes(k))).map(([k, label]) => `<label class="im-mrow${T.map[k] != null ? " set" : ""}"><span>${esc(label)}</span><select class="input" data-imf="${k}" aria-label="${esc(label)}">${opt(T.map[k])}</select></label>`).join("") : "";
  const wide = T.wide ? `<div class="im-wide"><span class="lbl">Un équipement par colonne</span><div class="im-wcols">${T.headers.map((h, i) => (i === T.map.date || i === T.map.time || i === T.map.slot ? "" : `<button class="chip${T.wide.cols.includes(i) ? " on" : ""}" data-act="imWide" data-v="${i}">${esc(h)}</button>`)).join("")}</div></div>` : "";
  return `<div class="im-ms"><div class="h2" style="font-size:22px">Colonnes</div><p class="sub" style="margin:-6px 0 0">${esc(T.file)}${T.sheet ? ` · ${esc(T.sheet)}` : ""}</p>
    <div class="im-mk" role="radiogroup" aria-label="Type de données">${IM_ORDER.map((k) => `<button class="chip${T.kind === k ? " on" : ""}" role="radio" aria-checked="${T.kind === k}" data-act="imMapKind" data-v="${k}">${esc(IM_K[k].t)}</button>`).join("")}</div>
    ${K ? `${wide}<div class="im-mf">${fields}</div>${T.alCols.length && ["products", "recipes"].includes(T.kind) ? `<div class="im-alc">${ico("sparkle")}Allergènes en colonnes : ${T.alCols.map(([i]) => esc(T.headers[i])).join(", ")}</div>` : ""}
    <div class="lbl im-lbl">Aperçu</div><div class="im-prev" id="imPrev">${imPreview(T)}</div>` : `<div class="im-pick-k">${ico("imCols")}<span>Choisissez d'abord le type de données.</span></div>`}
    <button class="btn acc block" data-act="imMapOk" ${K ? "" : "disabled"}>Valider</button></div>`;
}
function imPreview(T) {
  const K = IM_K[T.kind]; if (!K) return ""; const rows = T.rows.slice(0, 5);
  let cols = K.f.filter(([k]) => T.map[k] != null).map(([k, label]) => [label, (r) => imPrevVal(T, r, k)]);
  if (T.wide) cols = [["Date", (r) => imPrevVal(T, r, "date")], ...T.wide.cols.slice(0, 4).map((i) => [T.headers[i], (r) => { const n = imNum(r[i]); return n == null ? "" : fmt(n) + " °C"; }])];
  if (!cols.length) return `<p class="sub" style="padding:14px">Aucune colonne choisie.</p>`;
  return `<table><thead><tr>${cols.map(([l]) => `<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map(([, fn]) => { const v = fn(r); return `<td${v === "" ? ' class="e"' : ""}>${esc(v === "" ? "—" : v)}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
}
function imPrevVal(T, r, k) {
  const v = imCell(T, r, k); if (imStr(v) === "") return "";
  if (["date", "dlc", "start", "end", "last", "next"].includes(k)) { const d = imDate(v, imOrd(T, k)); if (!d) return "?"; const p = parseDay(d.day); return `${pad(p.getDate())}/${pad(p.getMonth() + 1)}/${p.getFullYear()}${d.min != null && k === "date" ? ` ${pad(Math.floor(d.min / 60))}:${pad(d.min % 60)}` : ""}`; }
  if (k === "time") { const m = imTime(v); return m == null ? "?" : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
  if (["value", "temp", "min", "max"].includes(k)) { const n = imNum(v); return n == null ? "?" : `${fmt(n)} °C`; }
  if (["price", "rate", "monthly", "cost"].includes(k)) { const n = imNum(v); return n == null ? "?" : `${fmt(n, 2)} €`; }
  if (k === "unit") return imUnit(v); if (k === "allergens") { const a = imAllergens(v); return a.length ? a.map((x) => (typeof allergenOf === "function" && allergenOf(x)?.t) || x).join(", ") : imStr(v); }
  if (k === "ok") { const b = imBool(v); return b == null ? imStr(v) : b ? "Oui" : "Non"; }
  if (k === "every") { const m = imMonths(v); return m ? (typeof oblFreqTx === "function" ? oblFreqTx(m) : `${m} mois`) : imStr(v); }
  if (k === "freq") { const f = imFreq(v); return { jour: "Chaque jour", service: "Chaque service", jours: "Jours précis", semaine: "Chaque semaine", mois: "Chaque mois" }[f.freq]; }
  return imStr(v).slice(0, 40);
}
document.addEventListener("change", (e) => {
  const s = e.target.closest && e.target.closest("select[data-imf]"); if (!s) return; const T = IM.mapT; if (!T) return;
  const k = s.dataset.imf; const v = s.value === "" ? null : +s.value;
  if (v != null) Object.keys(T.map).forEach((x) => { if (x !== k && T.map[x] === v) { T.map[x] = null; const o = $(`select[data-imf="${x}"]`); if (o) { o.value = ""; o.closest(".im-mrow").classList.remove("set"); } } });
  T.map[k] = v; if (T._ord) delete T._ord[k]; s.closest(".im-mrow").classList.toggle("set", v != null); SFX.tick();
  const p = $("#imPrev"); if (p) p.innerHTML = imPreview(T);
});

/* ───────────── kind info + templates ───────────── */
const IM_TPL = {
  products: [["Désignation", "Unité", "Catégorie", "Prix HT", "TVA", "Fournisseur", "Stock", "Allergènes", "DLC", "Lot"], ["Beurre doux 82%", "kg", "Crèmerie", "8,90", "5,5", "Metro", "4", "Lait", "", ""]],
  suppliers: [["Fournisseur", "Contact", "Téléphone", "E-mail", "Adresse", "Jours de livraison"], ["Marée Atlantique", "Yann Le Goff", "02 98 00 00 00", "commandes@exemple.fr", "12 quai du Port, Concarneau", "Mardi, vendredi"]],
  recipes: [["Recette", "Ingrédient", "Quantité", "Unité", "Portions", "Allergènes", "Prix de vente"], ["Tarte fine aux pommes", "Pâte feuilletée", "250", "g", "6", "Gluten, lait", "9,50"], ["", "Pommes golden", "4", "pièce", "", "", ""]],
  fridges: [["Équipement", "Type", "Température min", "Température max"], ["Chambre froide positive", "Chambre froide", "0", "3"], ["Congélateur", "Congélateur", "-25", "-18"]],
  readings: [["Date", "Heure", "Équipement", "Température", "Action corrective", "Opérateur"], ["03/11/2026", "09:05", "Chambre froide positive", "2,4", "", "Julie"]],
  receptions: [["Date", "Fournisseur", "N° BL", "Produit", "Quantité", "Unité", "Température", "DLC", "Lot", "Conforme"], ["03/11/2026", "Metro", "BL-48213", "Crème 35%", "6", "L", "3,1", "18/11/2026", "L2611", "Oui"]],
  staff: [["Prénom", "Nom", "Poste", "Contrat", "Heures hebdo", "Taux horaire brut", "Date d'entrée"], ["Julie", "Martin", "Commis", "CDI", "35", "12,10", "01/09/2025"]],
  chores: [["Zone", "Tâche", "Fréquence", "Moment", "Produit", "Méthode", "Responsable"], ["Cuisine", "Plans de travail", "Après chaque service", "", "Dégraissant alimentaire", "Pulvériser, laisser agir 5 min, rincer", "Commis"]],
  obligations: [["Contrôle", "Prestataire", "Téléphone", "Fréquence", "Dernier passage", "Prochaine échéance"], ["Extincteurs", "Sécurifeu", "01 23 45 67 89", "Annuelle", "12/03/2026", ""]],
};
function imKindSheet(k) {
  const K = IM_K[k];
  return `<div class="im-ki">${imWell(k, "lg")}<div class="h2" style="font-size:22px">${esc(K.t)}</div>
    <div class="lbl im-lbl">Colonnes reconnues</div><div class="im-kf">${K.f.map(([, l]) => `<span class="im-src">${esc(l)}</span>`).join("")}</div>
    <p class="sub">Les noms peuvent varier : « Désignation », « Libellé », « Article »… on comprend.</p>
    <div class="grid2"><button class="btn soft" data-act="imTpl" data-v="${k}">${ico("download")}Modèle</button><button class="btn acc" data-act="imPickKind" data-v="${k}">${ico("imUp")}Importer</button></div></div>`;
}

/* ───────────── demo sample ───────────── */
function imDemoFiles() {
  const fr = S.fridges.length ? S.fridges.slice(0, 4).map((f) => f.name) : ["Chambre froide positive", "Frigo du passe", "Congélateur"];
  const lim = (n) => (S.fridges.find((f) => f.name === n) || {}).max ?? (/cong/i.test(n) ? -18 : 3);
  const rows = [["Export Traqfood · Relevés de température"], [], ["Date du relevé", "Heure", "Enceinte", "Température relevée (°C)", "Conformité", "Action corrective", "Opérateur"]];
  const who = ["Julie", "Karim", "Léa"]; let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let d = 30; d >= 1; d--) { const dt = new Date(); dt.setDate(dt.getDate() - d); const ds = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`; for (const h of ["09:10", "18:40"]) for (const n of fr) { const mx = lim(n); const v = Math.round((mx - (mx < 0 ? 3 : 1.6) + rnd() * (mx < 0 ? 3 : 2)) * 10) / 10; rows.push([ds, h, n, String(v).replace(".", ","), "Conforme", "", who[Math.floor(rnd() * 3)]]); } }
  const prods = [["Code article", "Désignation article", "Famille", "Unité de stock", "Prix d'achat HT", "Fournisseur principal", "Allergènes"],
    ["A101", "BEURRE DOUX 82% 1KG", "Crèmerie", "kg", "8,90", "METRO", "Lait"], ["A102", "CRÈME LIQUIDE 35%", "Crèmerie", "L", "4,20", "METRO", "Lait"], ["A103", "OEUFS FRAIS PLEIN AIR", "Crèmerie", "pce", "0,32", "Ferme des Saules", "Oeufs"],
    ["A104", "FARINE T55", "Épicerie", "kg", "0,95", "Metro", "Gluten"], ["A105", "FILET DE CABILLAUD", "Marée", "kg", "21,50", "Marée Atlantique", "Poisson"], ["A106", "NOISETTES DÉCORTIQUÉES", "Épicerie", "kg", "14,80", "Metro", "Fruits à coque"],
    ["A107", "PARMESAN 24 MOIS", "Crèmerie", "kg", "24,00", "Fromagerie Laurent", "Lait"], ["A108", "MOUTARDE DE DIJON", "Épicerie", "kg", "3,60", "Metro", "Moutarde"], ["A109", "SAUMON FUMÉ", "Marée", "kg", "32,00", "Marée Atlantique", "Poisson"],
    ["A110", "PÂTE FEUILLETÉE PUR BEURRE", "Surgelés", "kg", "6,40", "Metro", "Gluten, lait"], ["A111", "HUILE D'OLIVE VIERGE EXTRA", "Épicerie", "L", "9,90", "Metro", ""], ["A112", "SAUCE SOJA", "Épicerie", "L", "5,10", "Metro", "Soja, gluten"]];
  return [{ file: "export_traqfood_releves.csv", sheet: "", rows }, { file: "mercuriale_koust.xlsx", sheet: "Articles", rows: prods }];
}

/* ───────────── actions ───────────── */
Object.assign(ACT, {
  imPaste: () => {
    SFX.tap();
    openSheet(`<div class="im-ps"><div class="h2" style="font-size:22px">Coller un tableau</div><p class="sub" style="margin:-6px 0 0">Copiez les cellules dans Excel ou Google Sheets, avec la ligne des titres.</p>
      <textarea class="input im-ta" id="imPasteTx" rows="8" placeholder="Désignation&#9;Unité&#9;Prix HT&#10;Beurre doux&#9;kg&#9;8,90" spellcheck="false"></textarea>
      <button class="btn acc block" data-act="imPasteOk">Analyser</button></div>`, (b) => setTimeout(() => { const t = $("#imPasteTx", b); t && t.focus(); }, 60));
  },
  imPasteOk: () => {
    const tx = ($("#imPasteTx") || {}).value || ""; if (tx.trim().split(/\n/).length < 2) { SFX.err(); toast("Collez au moins la ligne des titres et une ligne.", "err"); const t = $("#imPasteTx"); if (t) { t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); } return; }
    closeSheet(true); const rows = imParseDelim(tx, tx.includes("\t") ? "\t" : imDelim(tx)); imIngest([{ file: "Tableau collé", name: "Tableau collé", sheet: "", rows }]);
  },
  imDemo: () => { SFX.tap(); imIngest(imDemoFiles().map((f) => ({ ...f, name: f.file }))); IM.files = imDemoFiles().map((f) => f.file); },
  imModels: () => { SFX.tap(); openSheet(`<div class="h2" style="font-size:22px">Modèles vides</div><p class="sub" style="margin:-6px 0 0">Un fichier prêt à remplir, puis à déposer ici.</p><div class="glass pad im-mlist">${IM_ORDER.map((k) => `<div class="li tap" role="button" tabindex="0" data-act="imTpl" data-v="${k}">${imWell(k, "sm")}<div class="tx"><b>${esc(IM_K[k].t)}</b></div>${ico("download")}</div>`).join("")}</div>`); },
  imTpl: (a, id, v) => { const t = IM_TPL[v]; if (!t) return; saveCsv(`modele-${imN(IM_K[v].t).replace(/ /g, "-")}.csv`, t); },
  imKindInfo: (a, id, v) => { if (!IM_K[v]) return; SFX.tap(); openSheet(imKindSheet(v)); },
  /* the file picker opens in the same tap (iOS needs the user gesture), from the page's input once the sheet lets go */
  imPickKind: (a, id, v) => { IM.hint = v; closeSheet(true); const i = $("#imFile") || $("#imFile2"); if (i) i.click(); },
  imAddFile: () => { const i = $("#imFile2"); if (i) { SFX.tap(); i.click(); } },
  imOn: (a, id) => { const T = IM.tables.find((x) => x.id === id); if (!T) return; T.on = !T.on; SFX.tick(); buzz(4); rerender(); },
  imMode: (a, id, v) => { const T = IM.tables.find((x) => x.id === id); if (!T || T.mode === v) return; T.mode = v; SFX.tick(); rerender(); },
  imDrop: (a, id) => { IM.tables = IM.tables.filter((x) => x.id !== id); SFX.close(); if (!IM.tables.length) imReset(); else rerender(); },
  /* the sheet edits a draft: closing it without « Valider » changes nothing */
  imMap: (a, id) => { const T = IM.tables.find((x) => x.id === id); if (!T) return; IM.mapT = { ...T, src: T, map: { ...T.map }, wide: T.wide && { ...T.wide, cols: [...T.wide.cols] }, _ord: {} }; SFX.tap(); openSheet(imMapSheet(IM.mapT)); },
  imMapKind: (a, id, v) => { const T = IM.mapT; if (!T) return; imSetKind(T, v); SFX.tick(); const b = $("#sheetBody"); const st = b.scrollTop; b.innerHTML = imMapSheet(T); b.scrollTop = st; },
  imWide: (a, id, v) => { const T = IM.mapT; if (!T || !T.wide) return; const i = +v; const c = T.wide.cols; const at = c.indexOf(i); if (at >= 0) c.splice(at, 1); else c.push(i); c.sort((x, y) => x - y); a.classList.toggle("on", at < 0); SFX.tick(); const p = $("#imPrev"); if (p) p.innerHTML = imPreview(T); },
  imMapOk: () => {
    const T = IM.mapT; if (!T) return; const K = IM_K[T.kind];
    if (K && !T.wide && !K.need(T.map)) { SFX.err(); toast(T.kind === "readings" ? "Il faut au moins l'équipement, la date et la température." : `Choisissez au moins la colonne « ${K.f[0][1]} » et une autre.`, "err"); return; }
    if (T.wide && !T.wide.cols.length) { SFX.err(); toast("Choisissez au moins un équipement.", "err"); return; }
    const O = T.src; O.kind = T.kind; O.map = T.map; O.wide = T.wide; O._ord = {}; O.on = true; IM.mapT = null; closeSheet(true); SFX.ok(); rerender();
  },
  imCancel: () => { SFX.close(); imReset(); },
  imGo: () => { SFX.tap(); buzz(6); imRun(); },
  imAgain: () => { SFX.tap(); imReset(); },
  imFinish: (a, id, v) => { SFX.tap(); const r = v && VIEWS[v] ? v : "home"; imReset(); S.history = []; go(r, {}, { replace: true }); },
  imUndoAsk: (a, id) => {
    const h = IM.hist.find((x) => x.id === id) || (IM.last && IM.last.iid === id ? { id, counts: IM.last.counts, total: IM.last.P.ops.length } : null); if (!h || h.undone) return; SFX.tap();
    const sum = imSumTx(h.counts || {}) || imPlural(h.total || 0, "élément");
    openSheet(`<div class="im-ua"><span class="im-w to lg">${ico("imUndo")}</span><div class="h2" style="font-size:22px">Annuler cet import ?</div><p class="sub" style="margin:0">${esc(sum)}. Tout est retiré, les fiches mises à jour retrouvent leurs anciennes valeurs.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Garder</button><button class="btn danger" data-act="imUndoOk" data-id="${esc(id)}">Annuler</button></div></div>`);
  },
  imUndoOk: async (a, id) => { if (a.disabled) return; a.disabled = true; closeSheet(true); await imUndo(id); },
});

window.IMPORT = {
  kinds: IM_ORDER.slice(),
  open(kind) { const k = kind && IM_K[kind] ? kind : null; if (IM.step === "done" || IM.step === "pick") { IM.step = "pick"; IM.tables = []; } IM.hint = k; go("import", k ? { kind: k } : {}); },
};
