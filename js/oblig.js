/* Growth Gusto — area: obligations & contrôles
   Every recurring legal or safety obligation of a French restaurant (ERP 5e catégorie type N + HACCP): extincteurs, nuisibles, hotte,
   électricité, gaz… Each one keeps its provider, its frequency, its next due date and the history of interventions with the reports
   (photo or PDF, stored through core upload()). Recording a visit takes three taps: « Le prestataire est passé » → date → photo.
   Data: collection "obligations" { key, name, cat, everyMonths, provider?, phone?, contract?, lastDone?, nextDue?, dueManual?, notes?, archived?, checks?, checksAt?, createdAt }
         collection "oblLogs" { oblId, day, provider, by, uid, at, notes?, cost?, checks?, files:[{id,name,type,url?}] }
   Exposed helpers: oblDue(days=30), oblState(o), oblSummary(), oblReportRows(), OBL_CATALOG, OBL_CATS. */

TAB_OF.obl = "more"; TAB_OF.oblCat = "more";
Object.assign(IC, {
  oblFire: ["M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5", "M9 18h8", "M18 3h-3", "M11 3a6 6 0 0 0-6 6v11", "M5 13h4", "M17 10a4 4 0 0 0-8 0v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2Z", "f:M9 10a4 4 0 0 1 8 0v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"],
  oblBug: ["m8 2 1.88 1.88", "M14.12 3.88 16 2", "M9 7.13v-1a3 3 0 1 1 6 0v1", "M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6", "M12 20v-9", "M6.53 9C4.6 8.8 3 7.1 3 5", "M6 13H2", "M3 21c0-2.1 1.7-3.9 3.8-4", "M20.97 5c0 2.1-1.6 3.8-3.5 4", "M22 13h-4", "M17.2 17c2.1.1 3.8 1.9 3.8 4"],
  oblHood: ["M3 20h18", "M9 3h6v5l5 6H4l5-6z", "M8 17h.01", "M12 17h.01", "M16 17h.01", "f:M9 3h6v5l5 6H4l5-6z"],
  oblBolt: ["M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z", "f:M4 14 14 3l-2 7h8L10 21l2-7z"],
  oblFlame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  oblExit: ["r:2,6,20,12,2", "M6 12h7", "m10 9 3 3-3 3", "M17 9v6", "f:M2 6h20v12H2z"],
  oblBell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  oblDrop: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z", "M9 15a3 3 0 0 0 3 3"],
  oblWind: ["M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2", "M9.6 4.6A2 2 0 1 1 11 8H2", "M12.6 19.4A2 2 0 1 0 14 16H2"],
  oblHeat: ["r:5,2,14,20,2.5", "c:12,14,3.2", "M9 6h6", "f:M5 2h14v20H5z"],
  oblFlask: ["M10 2v7.31", "M14 9.3V2", "M8.5 2h7", "M14 9.3a6.5 6.5 0 1 1-4 0", "M5.52 16h12.96"],
  oblCap: ["M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z", "M22 10v6", "M6 12.5V16a6 3 0 0 0 12 0v-3.5"],
  oblKey: ["c:7.5,15.5,5.5", "m21 2-9.6 9.6", "m15.5 7.5 3 3L22 7l-3-3"],
  oblDoc: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M8 13h8", "M8 17h5", "f:M6 3h8v4h5v13H5z"],
  oblSign: ["r:3,3,18,13,2", "M7 8h10", "M7 11.5h6", "M12 16v5", "M8 21h8"],
  oblUmb: ["M22 12a10.06 10.06 1 0 0-20 0Z", "M12 12v8a2 2 0 0 0 4 0", "M12 2v1", "f:M22 12a10 10 0 0 0-20 0z"],
  oblMusic: ["M9 18V5l12-2v13", "c:6,18,3", "c:18,16,3"],
  oblAccess: ["c:16,4,1", "m18 19 1-7-6 1", "m5 8 3-3 5.5 3-2.36 3.5", "M4.24 14.5a5 5 0 0 0 6.88 6", "M13.76 17.5a5 5 0 0 0-6.88-6"],
  oblRecycle: ["M7 19H4.8a1.83 1.83 0 0 1-1.57-.88 1.79 1.79 0 0 1 0-1.78L7.2 9.5", "M11 19h8.2a1.83 1.83 0 0 0 1.56-.89 1.78 1.78 0 0 0 0-1.78l-1.23-2.12", "m14 16-3 3 3 3", "M8.3 13.6 7.2 9.5 3.1 10.6", "m9.34 5.81 1.1-1.89A1.83 1.83 0 0 1 12 3a1.78 1.78 0 0 1 1.55.89l3.94 6.84", "m13.38 9.63 4.1 1.1 1.1-4.1"],
  oblPhone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"],
  oblInfo: ["c:12,12,10", "M12 16v-4", "M12 8h.01"],
  oblClip: ["m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"],
  oblAsk: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  oblWho: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "c:12,7,4"],
});

/* ───────── catalogue ───────── */
const OBL_CATS = {
  feu: { t: "Sécurité incendie", c: "#D42A48" },
  tech: { t: "Installations techniques", c: "#1F7AE0" },
  hyg: { t: "Hygiène & HACCP", c: "#0B9B6A" },
  admin: { t: "Administratif & légal", c: "#4A1FE6" },
  aff: { t: "Affichages", c: "#E0752F" },
};
const OBL_CAT_ORDER = ["feu", "tech", "hyg", "admin", "aff"];
/* kind: visit = an outside company comes; self = you do it; doc = a document to renew */
const OBL_CATALOG = [
  { key: "extincteurs", name: "Extincteurs", cat: "feu", ic: "oblFire", m: 12, on: true, kind: "visit",
    why: "Obligatoire dans tout établissement recevant du public et sur tout lieu de travail. Un extincteur non vérifié peut ne pas fonctionner, et l'assureur peut refuser d'indemniser après un incendie.",
    who: "Une entreprise certifiée (APSAD ou NF Service). En général : un extincteur à eau pour 200 m² et par étage, plus un CO₂ près du tableau électrique et de la cuisine.",
    ask: "Une étiquette datée sur chaque extincteur, le rapport de vérification et sa signature dans le registre de sécurité. Un extincteur de plus de 10 ans doit être révisé ou remplacé." },
  { key: "nuisibles", name: "Dératisation et désinsectisation", cat: "hyg", ic: "oblBug", m: 3, on: true, kind: "visit",
    why: "Le plan de lutte contre les nuisibles (rats, souris, blattes, mouches) fait partie du plan de maîtrise sanitaire. C'est l'un des premiers documents demandés lors d'un contrôle d'hygiène.",
    who: "Une entreprise de dératisation sous contrat, avec le certificat Certibiocide. Un contrat prévoit en général 4 à 6 passages par an, plus les interventions d'urgence.",
    ask: "La fiche de passage signée à chaque visite, le plan des appâts et des pièges, et les fiches de sécurité des produits utilisés." },
  { key: "hotte", name: "Hotte et conduits d'extraction", cat: "feu", ic: "oblHood", m: 12, on: true, kind: "visit",
    why: "La graisse accumulée dans les conduits est la première cause d'incendie en restaurant. Le règlement de sécurité impose un nettoyage complet au moins une fois par an, tous les 6 mois si vous faites beaucoup de friture ou de grillades.",
    who: "Une entreprise spécialisée dans le dégraissage des hottes et des conduits, pas seulement des filtres (les filtres, c'est votre équipe, chaque semaine).",
    ask: "Le certificat de nettoyage avec photos avant et après des conduits. Votre assureur le demandera en cas de sinistre." },
  { key: "electricite", name: "Installations électriques", cat: "tech", ic: "oblBolt", m: 12, on: true, kind: "visit",
    why: "Vérification obligatoire chaque année dès que vous avez un salarié (Code du travail) et dans un établissement recevant du public. Les anomalies relevées doivent être corrigées.",
    who: "Un organisme accrédité (Apave, Socotec, Bureau Veritas, Dekra…) ou un électricien qualifié.",
    ask: "Le rapport de vérification et la preuve que les observations ont été levées. Votre assureur peut aussi demander une thermographie infrarouge (rapport Q19)." },
  { key: "gaz", name: "Installation gaz et cuisson", cat: "tech", ic: "oblFlame", m: 12, on: true, kind: "visit",
    why: "Les appareils et tuyauteries gaz de la cuisine doivent être vérifiés pour éviter fuites, intoxications et explosions.",
    who: "Un technicien gaz qualifié ou un organisme agréé, souvent le même que pour l'électricité.",
    ask: "Le rapport de vérification, l'état et la date limite des tuyaux souples, et le test de la vanne d'arrêt d'urgence et de la ventilation." },
  { key: "baes", name: "Éclairage de sécurité (BAES)", cat: "feu", ic: "oblExit", m: 12, on: true, kind: "visit",
    why: "En cas de coupure de courant, les blocs de secours doivent éclairer les sorties pendant au moins une heure. Vérification annuelle obligatoire en établissement recevant du public.",
    who: "Un technicien compétent, souvent l'entreprise des extincteurs. Entre deux visites, coupez le courant une fois par mois : tous les blocs doivent s'allumer.",
    ask: "Le rapport avec le nombre de blocs testés, leur autonomie et les blocs remplacés." },
  { key: "alarme", name: "Alarme incendie et désenfumage", cat: "feu", ic: "oblBell", m: 12, on: false, kind: "visit",
    why: "Si votre restaurant est équipé d'une alarme incendie ou d'un désenfumage (selon la taille et la configuration du local), ils doivent être vérifiés chaque année.",
    who: "L'installateur de l'alarme ou une entreprise de maintenance incendie.",
    ask: "Le rapport de maintenance et le test du déclenchement. Testez vous-même l'alarme régulièrement, en dehors du service." },
  { key: "graisse", name: "Bac à graisse", cat: "hyg", ic: "oblDrop", m: 6, on: true, kind: "visit",
    why: "Un bac à graisse plein déborde, sent mauvais et bouche les canalisations. Sa vidange régulière est exigée par le règlement d'assainissement de votre commune.",
    who: "Une entreprise de vidange et d'assainissement. Comptez tous les 3 à 6 mois selon le volume de cuisine. Désactivez cette ligne si vous n'avez pas de bac à graisse.",
    ask: "Le bon d'enlèvement (bordereau de suivi des déchets), à garder comme preuve." },
  { key: "vmc", name: "VMC et climatisation", cat: "tech", ic: "oblWind", m: 12, on: true, kind: "visit",
    why: "Des filtres encrassés font circuler poussières et bactéries, et la cuisine chauffe. Au-delà d'une certaine quantité de gaz frigorigène, un contrôle d'étanchéité est obligatoire.",
    who: "Un frigoriste ou un chauffagiste avec attestation de capacité pour les fluides frigorigènes.",
    ask: "L'attestation d'entretien, et la fiche d'intervention fluides si un contrôle d'étanchéité a été fait." },
  { key: "froid", name: "Chambre froide et groupes froids", cat: "tech", ic: "snow", m: 12, on: true, kind: "visit",
    why: "Un groupe froid entretenu tient sa température en plein service et tombe moins en panne. Contrôle d'étanchéité obligatoire selon la quantité de fluide frigorigène.",
    who: "Un frigoriste avec attestation de capacité.",
    ask: "Le rapport d'entretien (nettoyage du condenseur, joints de porte, niveau de fluide) et la fiche d'intervention fluides." },
  { key: "chaudiere", name: "Chaudière et chauffe-eau", cat: "tech", ic: "oblHeat", m: 12, on: true, kind: "visit",
    why: "L'entretien annuel d'une chaudière (gaz, fioul ou bois) est obligatoire. L'eau chaude doit sortir à plus de 55 °C pour limiter le risque de légionelle.",
    who: "Un chauffagiste qualifié.",
    ask: "L'attestation d'entretien (à garder 2 ans) avec la mesure de monoxyde de carbone. Faites aussi détartrer le chauffe-eau." },
  { key: "analyses", name: "Analyses microbiologiques", cat: "hyg", ic: "oblFlask", m: 6, on: true, kind: "visit",
    why: "Elles prouvent que vos préparations et votre nettoyage sont maîtrisés. La fréquence est fixée dans votre plan de maîtrise sanitaire, et l'inspecteur demande souvent les derniers résultats.",
    who: "Un laboratoire accrédité COFRAC. Il prélève des surfaces (plans de travail, planches, trancheuse) et des plats.",
    ask: "Les bulletins d'analyse avec leur interprétation (satisfaisant, acceptable, non satisfaisant) et ce que vous avez corrigé en cas de mauvais résultat. Si vous servez des groupes ou des banquets, gardez aussi des plats témoins 5 jours au froid." },
  { key: "formation", name: "Formation hygiène alimentaire", cat: "admin", ic: "oblCap", m: 60, on: true, kind: "doc",
    why: "Au moins une personne de l'équipe doit avoir suivi la formation hygiène de 14 heures. Sans attestation, c'est une non-conformité lors d'un contrôle.",
    who: "Un organisme de formation enregistré auprès de la DRAAF. Un diplôme de cuisine (CAP ou plus) ou 3 ans d'expérience comme gérant de restaurant en dispensent.",
    ask: "L'attestation de formation nominative. Si la personne formée quitte l'équipe, formez quelqu'un d'autre. Une remise à niveau est conseillée tous les 5 ans." },
  { key: "permis", name: "Permis d'exploitation (licence)", cat: "admin", ic: "oblKey", m: 120, on: true, kind: "doc",
    why: "Obligatoire pour vendre de l'alcool. Le permis est valable 10 ans : avant cette date, il faut suivre une formation de mise à jour, sinon il n'est plus valable.",
    who: "Un organisme de formation agréé (une journée de mise à jour). La licence elle-même est déclarée en mairie.",
    ask: "Le nouveau permis d'exploitation. Gardez-le avec le récépissé de déclaration de la licence, à présenter en cas de contrôle." },
  { key: "duerp", name: "Document unique (DUERP)", cat: "admin", ic: "oblDoc", m: 12, on: true, kind: "self",
    why: "Obligatoire dès le premier salarié : il liste les risques (brûlures, coupures, chutes, charges lourdes, produits chimiques) et les mesures prises. Mise à jour au moins une fois par an, et à chaque changement important.",
    who: "Vous-même, avec l'aide de la médecine du travail ou de l'outil gratuit OiRA de l'INRS pour la restauration.",
    ask: "La version datée, accessible aux salariés et à l'inspection du travail. Les anciennes versions doivent être conservées 40 ans." },
  { key: "pms", name: "Revue du plan de maîtrise sanitaire", cat: "hyg", ic: "shield", m: 12, on: true, kind: "self",
    why: "Le PMS regroupe vos procédures d'hygiène : HACCP, traçabilité, nettoyage, nuisibles, températures, allergènes. Il doit être à jour et présenté lors d'un contrôle.",
    who: "Vous-même ou un consultant hygiène. Cette application tient déjà une grande partie du PMS : relevés, réceptions, ménage, recettes.",
    ask: "Relire les procédures, ajouter les nouveaux plats et produits, vérifier les fiches de nettoyage, puis dater et signer la revue." },
  { key: "registre", name: "Registre de sécurité", cat: "feu", ic: "book", m: 12, on: true, kind: "self",
    why: "Obligatoire en établissement recevant du public : il réunit les vérifications (extincteurs, électricité, gaz, hotte…), les formations du personnel et les travaux. La commission de sécurité le demande.",
    who: "Vous-même. Chaque prestataire doit le signer à son passage.",
    ask: "Vérifier que chaque intervention de l'année y est notée, signée et que le rapport y est joint. Cette application garde aussi chaque rapport en photo." },
  { key: "affichages", name: "Affichages obligatoires", cat: "aff", ic: "oblSign", m: 12, on: true, kind: "self",
    why: "Plusieurs informations doivent être affichées pour les clients et pour l'équipe. Chaque affichage manquant peut coûter une amende.",
    who: "Vous-même. Faites le tour de l'entrée, de la salle et de la cuisine avec cette liste.",
    ask: "Cochez chaque affichage présent et lisible.",
    list: [
      { id: "prix", t: "Prix des menus à l'extérieur", s: "Carte du jour visible de la rue pendant le service, prix TTC service compris" },
      { id: "boissons", t: "Prix des boissons en salle", s: "Au moins les boissons les plus servies, dont des boissons sans alcool" },
      { id: "licence", t: "Licence de débit de boissons", s: "Catégorie de la licence, visible par les clients" },
      { id: "mineurs", t: "Protection des mineurs et ivresse publique", s: "Interdiction de vendre de l'alcool aux moins de 18 ans" },
      { id: "tabac", t: "Interdiction de fumer et de vapoter", s: "Signalétique à l'entrée et en salle" },
      { id: "allergenes", t: "Allergènes", s: "Le client peut consulter par écrit les allergènes de chaque plat" },
      { id: "viandes", t: "Origine des viandes", s: "Pays d'élevage et d'abattage du bœuf, du porc, de la volaille et de l'agneau" },
      { id: "faitmaison", t: "Mention « fait maison »", s: "Seulement si vous l'utilisez : logo et explication sur la carte" },
      { id: "incendie", t: "Consignes incendie et plan d'évacuation", s: "Près des sorties et en cuisine" },
      { id: "urgences", t: "Numéros d'urgence", s: "15, 18, 112, centre antipoison" },
      { id: "equipe", t: "Affichages pour l'équipe", s: "Inspection et médecine du travail, convention collective HCR, horaires, harcèlement, égalité de salaire" },
    ] },
  { key: "thermometres", name: "Étalonnage des thermomètres", cat: "hyg", ic: "therm", m: 6, on: true, kind: "self",
    why: "Un thermomètre qui se trompe de 2 °C fausse tous vos relevés. Vérifiez-les régulièrement et gardez-en la trace.",
    who: "Vous-même : plongez la sonde dans un verre rempli de glaçons et d'un peu d'eau. Après une minute, elle doit indiquer 0 °C, à 0,5 °C près. Sinon, réglez-la ou changez-la.",
    ask: "Noter la valeur lue pour chaque thermomètre (sonde, frigos). Un laboratoire peut fournir un certificat d'étalonnage si besoin." },
  { key: "assurance", name: "Assurance multirisque et RC", cat: "admin", ic: "oblUmb", m: 12, on: true, kind: "doc",
    why: "La responsabilité civile professionnelle et la multirisque (incendie, dégâts des eaux, perte d'exploitation) protègent le restaurant. L'assureur demande souvent les rapports d'extincteurs, d'électricité et de hotte.",
    who: "Votre assureur ou votre courtier.",
    ask: "L'attestation d'assurance de l'année. À chaque échéance, vérifiez les garanties : perte d'exploitation, bris de machine, marchandises en chambre froide." },
  { key: "accessibilite", name: "Registre public d'accessibilité", cat: "admin", ic: "oblAccess", m: 12, on: true, kind: "self",
    why: "Obligatoire dans tout établissement recevant du public : il explique comment le restaurant accueille les personnes handicapées.",
    who: "Vous-même, avec le modèle gratuit du ministère.",
    ask: "Le registre à jour, consultable à l'accueil, avec la liste des aménagements et les attestations de formation de l'équipe d'accueil." },
  { key: "dechets", name: "Huiles usagées et biodéchets", cat: "hyg", ic: "oblRecycle", m: 12, on: true, kind: "doc",
    why: "Le tri des biodéchets (restes alimentaires) est obligatoire depuis 2024. Les huiles de friture usagées doivent être reprises par un collecteur, jamais jetées dans l'évier.",
    who: "Un collecteur d'huiles alimentaires agréé, et votre collectivité ou un prestataire pour les biodéchets.",
    ask: "Le contrat et les bons d'enlèvement, à garder comme preuve." },
  { key: "sacem", name: "Musique d'ambiance (Sacem)", cat: "admin", ic: "oblMusic", m: 12, on: false, kind: "doc",
    why: "Diffuser de la musique dans la salle, même la radio, demande une autorisation et une redevance annuelle.",
    who: "La Sacem, qui collecte aussi pour la SPRE.",
    ask: "Le contrat et la facture de l'année." },
];
const OBL_FREQS = [[1, "1 mois"], [3, "3 mois"], [6, "6 mois"], [12, "1 an"], [24, "2 ans"], [60, "5 ans"], [120, "10 ans"]];
const OBL_KIND = {
  visit: { cta: "Le prestataire est passé", title: "Le prestataire est passé", ph: "Photographier le rapport" },
  self: { cta: "C'est fait", title: "C'est fait", ph: "Ajouter une photo" },
  doc: { cta: "Document renouvelé", title: "Document renouvelé", ph: "Photographier le document" },
};

/* ───────── helpers ───────── */
const oblDef = (o) => OBL_CATALOG.find((c) => c.key === (o && o.key)) || null;
const oblIc = (o) => o?.ic || oblDef(o)?.ic || "calcheck";
const oblKindOf = (o) => OBL_KIND[oblDef(o)?.kind || "visit"];
const oblCatOf = (o) => OBL_CATS[o?.cat] || OBL_CATS.admin;
const oblActive = () => S.obligations.filter((o) => !o.archived);
const oblLogsOf = (id) => S.oblLogs.filter((l) => l.oblId === id).sort((a, b) => String(b.day || "").localeCompare(String(a.day || "")) || (b.at || 0) - (a.at || 0));
const oblFull = (k) => { const d = parseDay(k); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "–"; };
const oblLong = (k, y = true) => { const d = parseDay(k); return d ? `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]}${y ? ` ${d.getFullYear()}` : ""}` : "–"; };
const oblMon = (k) => { const d = parseDay(k); if (!d) return "–"; const m = MONTHS[d.getMonth()]; return `${m.length > 5 ? m.slice(0, 4) + "." : m} ${d.getFullYear()}`; };
function oblAddM(k, n) {
  const d = parseDay(k); if (!d || !n) return null;
  const y = d.getFullYear(), m = d.getMonth() + n; const last = new Date(y, m + 1, 0).getDate();
  return dayKey(new Date(y, m, Math.min(d.getDate(), last)));
}
function oblFreqTx(m) {
  m = +m || 0; if (!m) return "Une seule fois";
  return { 1: "Chaque mois", 12: "Chaque année", 24: "Tous les 2 ans", 36: "Tous les 3 ans", 60: "Tous les 5 ans", 120: "Tous les 10 ans" }[m] || (m % 12 === 0 ? `Tous les ${m / 12} ans` : `Tous les ${m} mois`);
}
const oblSoonDays = (o) => ((+o.everyMonths || 12) <= 1 ? 7 : (+o.everyMonths || 12) <= 3 ? 15 : 30);
const oblNextOf = (o) => (o.dueManual && o.nextDue ? o.nextDue : o.lastDone ? oblAddM(o.lastDone, +o.everyMonths || 12) : o.nextDue || null);
/* state of one obligation: st = late | soon | ok | unk; d = days until the due date */
function oblState(o) {
  const due = oblNextOf(o); if (!due) return { st: "unk", due: null, d: null, tx: "À renseigner", pill: "neu" };
  const d = daysUntil(due);
  if (d < 0) return { st: "late", due, d, tx: -d > 60 ? `En retard de ${Math.round(-d / 30.4)} mois` : `En retard de ${-d} j`, pill: "bad" };
  if (d <= oblSoonDays(o)) return { st: "soon", due, d, tx: d === 0 ? "Aujourd'hui" : d === 1 ? "Demain" : `Dans ${d} j`, pill: "warn" };
  return { st: "ok", due, d, tx: d <= 60 ? `Dans ${d} j` : oblMon(due), pill: "ok" };
}
const OBL_ST = { late: "En retard", soon: "Bientôt", ok: "À jour", unk: "À renseigner" };
function oblSummary() {
  const r = { late: 0, soon: 0, ok: 0, unk: 0, total: 0 };
  oblActive().forEach((o) => { r[oblState(o).st]++; r.total++; });
  return r;
}
/* oblDue(days=30): active obligations due or late within N days, late ones first. Obligations without any date are left out. */
function oblDue(days = 30) {
  return oblActive().map((o) => ({ o, s: oblState(o) })).filter(({ s }) => s.due && s.d <= days)
    .sort((a, b) => a.s.d - b.s.d)
    .map(({ o, s }) => ({ id: o.id, key: o.key, name: o.name, cat: o.cat, catT: oblCatOf(o).t, icon: oblIc(o), nextDue: s.due, days: s.d, status: s.st === "late" ? "late" : "soon", statusTx: s.tx, late: s.st === "late", provider: o.provider || "", phone: o.phone || "" }));
}
/* for the registre report: one row per active obligation with its latest intervention */
function oblReportRows() {
  const ord = (o) => ({ late: 0, unk: 1, soon: 2, ok: 3 }[oblState(o).st]);
  return oblActive().slice().sort((a, b) => OBL_CAT_ORDER.indexOf(a.cat) - OBL_CAT_ORDER.indexOf(b.cat) || ord(a) - ord(b) || a.name.localeCompare(b.name, "fr")).map((o) => {
    const L = oblLogsOf(o.id); const last = L[0] || null; const s = oblState(o);
    const ck = oblDef(o)?.list; const checks = ck ? { done: ck.filter((x) => (o.checks || {})[x.id]).length, total: ck.length } : null;
    return { o, name: o.name, catT: oblCatOf(o).t, freqTx: oblFreqTx(o.everyMonths), lastDone: o.lastDone || null, last, provider: (last && last.provider) || o.provider || "", contract: o.contract || "", nextDue: s.due, st: s.st, stTx: OBL_ST[s.st], files: last ? (last.files || []).length : 0, logs: L, checks };
  });
}
const oblFileUrl = (f) => (f && ((f.id && photoUrl(f.id)) || f.url)) || "";
const oblIsPdf = (f) => /pdf/i.test(f?.type || "") || /\.pdf$/i.test(f?.name || "");
const oblIsLoc = (id) => typeof PHOTOS !== "undefined" && PHOTOS.isLocal(id);
const oblRmFile = (f) => { if (f && oblIsLoc(f.id)) PHOTOS.delete(f.id).catch(() => {}); };
const oblTile = (o, cls = "") => `<span class="ob-tile ${cls}" style="--k:${oblCatOf(o).c}">${ico(oblIc(o))}</span>`;
const oblPlural = (n, s, p) => `${n} ${n > 1 ? p || s + "s" : s}`;
const oblQA = (ic, t, x) => `<div class="ob-iq"><span class="ob-iqi">${ico(ic)}</span><div><b>${t}</b><p>${esc(x)}</p></div></div>`;
const oblWhy = (c) => oblQA("oblInfo", "Pourquoi", c.why) + oblQA("oblWho", "Qui", c.who) + oblQA("oblAsk", "Quoi demander", c.ask);

/* enable / disable a catalogue entry (one tap). Disabling only archives: the history stays. */
async function oblEnable(key, on) {
  const ex = S.obligations.find((o) => o.key === key); const c = OBL_CATALOG.find((x) => x.key === key);
  if (ex) { if (!!ex.archived === !on) return ex.id; await safe(DB.update("obligations", ex.id, { archived: !on })); return ex.id; }
  if (!on || !c) return null;
  return safe(DB.add("obligations", { key, name: c.name, cat: c.cat, everyMonths: c.m, provider: "", phone: "", contract: "", lastDone: null, nextDue: null, notes: "", archived: false, createdAt: Date.now() }));
}
async function oblRecalc(oblId, exceptLog) {
  const o = S.obligations.find((x) => x.id === oblId); if (!o) return;
  const L = S.oblLogs.filter((l) => l.oblId === oblId && l.id !== exceptLog).map((l) => l.day).filter(Boolean).sort();
  const last = L[L.length - 1] || null;
  await DB.update("obligations", oblId, { lastDone: last, nextDue: last ? oblAddM(last, +o.everyMonths || 12) : null, dueManual: false });
}

/* ───────── main screen ───────── */
function oblRow(o) {
  const s = oblState(o); const L = oblLogsOf(o.id); const nf = L[0] ? (L[0].files || []).length : 0;
  const stx = s.st === "unk" ? "Dernier passage ?" : s.st === "ok" ? (s.d <= 60 ? s.tx : `Prochain : ${s.tx}`) : s.tx;
  const rest = [o.lastDone ? `fait le ${oblFull(o.lastDone)}` : "", o.provider].filter(Boolean).join(" · ");
  const qa = s.st === "unk" ? `<button class="ob-q unk" data-act="oblRec" data-id="${o.id}" aria-label="Indiquer le dernier passage : ${esc(o.name)}">${ico("cal")}</button>` : `<button class="ob-q" data-act="oblRec" data-id="${o.id}" aria-label="${esc(oblKindOf(o).cta)} : ${esc(o.name)}">${ico("check")}</button>`;
  return `<div class="ob-row ${s.st}" data-go="obl" data-id="${o.id}" role="button" tabindex="0">${oblTile(o)}<div class="tx"><b>${esc(o.name)}</b><em><span class="ob-s ${s.st}">${s.st === "late" ? `<i class="ob-live"></i>` : ""}${esc(stx)}</span>${rest ? ` · ${esc(rest)}` : ""}${nf ? `<span class="ob-clip">${ico("oblClip")}${nf}</span>` : ""}</em></div>${qa}</div>`;
}
function oblHeroHtml() {
  const r = oblSummary(); const A = oblActive();
  const nx = A.map((o) => ({ o, s: oblState(o) })).filter((x) => x.s.due && x.s.d >= 0).sort((a, b) => a.s.d - b.s.d)[0];
  const tone = r.late ? "bad" : r.soon ? "warn" : r.unk ? "neu" : "ok";
  const head = r.late ? `${oblPlural(r.late, "contrôle")} en retard` : r.soon ? `${oblPlural(r.soon, "contrôle")} à prévoir` : r.unk ? `${oblPlural(r.unk, "date")} à renseigner` : "Tout est à jour";
  const sub = r.unk && (r.late || r.soon) ? `et ${oblPlural(r.unk, "date")} à renseigner` : r.unk && !nx ? "Touchez le calendrier d'une ligne pour indiquer le dernier passage." : nx ? `Prochain : ${esc(nx.o.name)}, ${nx.s.d === 0 ? "aujourd'hui" : `le ${oblLong(nx.s.due, nx.s.d > 300)}`}` : "";
  const seg = (k) => (r[k] ? `<i class="${k}" style="flex:${r[k]}"></i>` : "");
  const tile = (k, lbl) => `<button class="ob-stat ${k}${r[k] ? "" : " zero"}" data-act="oblJump" data-v="${k}" ${r[k] ? "" : "tabindex=\"-1\""}><b class="mono">${r[k]}</b><span>${lbl}</span></button>`;
  return `<div class="glass ob-hero st ${tone}" style="--i:1">
    <div class="ob-hh"><span class="ob-hic ${tone}">${ico(tone === "ok" ? "shield" : tone === "neu" ? "cal" : "alert")}</span><div class="tx"><b>${head}</b>${sub ? `<em>${sub}</em>` : ""}</div></div>
    <div class="ob-bar" aria-hidden="true">${seg("late")}${seg("soon")}${seg("unk")}${seg("ok")}</div>
    <div class="ob-stats">${tile("late", "En retard")}${tile("soon", "Bientôt")}${tile("ok", "À jour")}${tile("unk", "Sans date")}</div></div>`;
}
function oblYearHtml() {
  const t = parseDay(dayKey()); const cols = [];
  for (let i = 0; i < 12; i++) { const d = new Date(t.getFullYear(), t.getMonth() + i, 1); cols.push({ k: monthKey(d), m: d.getMonth(), y: d.getFullYear(), L: [] }); }
  oblActive().forEach((o) => { const s = oblState(o); if (!s.due) return; const k = s.st === "late" ? cols[0].k : s.due.slice(0, 7); const c = cols.find((x) => x.k === k); if (c) c.L.push({ o, s }); });
  const n = cols.reduce((a, c) => a + c.L.length, 0);
  return `<div class="glass pad ob-year st" style="--i:4"><div class="row"><span class="lbl">Les 12 prochains mois</span><span class="sub">${n ? oblPlural(n, "échéance") : "aucune date"}</span></div>
    <div class="ob-cal">${cols.map((c, i) => `<div class="ob-mo${i === 0 ? " now" : ""}"><div class="ob-dots">${c.L.slice(0, 5).map(({ o, s }, j) => `<button class="ob-dot ${s.st}" style="--k:${oblCatOf(o).c};--j:${j}" data-go="obl" data-id="${o.id}" title="${esc(o.name)} · ${oblFull(s.due)}" aria-label="${esc(o.name)}, ${oblLong(s.due)}">${ico(oblIc(o))}</button>`).join("")}${c.L.length > 5 ? `<span class="ob-more">+${c.L.length - 5}</span>` : ""}</div><span class="ob-ml">${MONTHS[c.m].slice(0, 3)}${c.m === 0 || i === 0 ? `<small>${String(c.y).slice(2)}</small>` : ""}</span></div>`).join("")}</div>
    ${n ? "" : `<p class="note" style="margin:8px 0 0">Les échéances apparaissent ici dès qu'une date de dernier passage est renseignée.</p>`}</div>`;
}
function oblThumb(f, cls = "") {
  if (!f) return ""; if (oblIsPdf(f)) return `<span class="ob-pdf ${cls}">PDF</span>`;
  const u = oblFileUrl(f); return u ? `<span class="ob-th ${cls}"><img src="${esc(u)}" alt=""${oblIsLoc(f.id) ? ` data-photo="${esc(f.id)}"` : ""}></span>` : "";
}
function oblRecentHtml() {
  const L = S.oblLogs.filter((l) => S.obligations.some((o) => o.id === l.oblId)).slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 5);
  if (!L.length) return `<div class="glass pad ob-recent st" style="--i:5"><span class="lbl">Derniers passages</span><p class="note" style="margin:8px 0 0">Chaque passage enregistré apparaît ici avec son rapport. Il est aussi noté dans le registre HACCP et dans le rapport pour l'inspecteur.</p></div>`;
  return `<div class="glass pad ob-recent st" style="--i:5"><span class="lbl">Derniers passages</span>${L.map((l) => { const o = S.obligations.find((x) => x.id === l.oblId);
    return `<div class="li tap" data-go="obl" data-id="${o.id}" role="button" tabindex="0">${oblTile(o, "sm")}<div class="tx"><b>${esc(o.name)}</b><em>${oblFull(l.day)}${l.provider ? ` · ${esc(l.provider)}` : ""}</em></div>${oblThumb((l.files || [])[0], "sm")}</div>`; }).join("")}</div>`;
}
function oblListHtml() {
  const A = oblActive().map((o) => ({ o, s: oblState(o) }));
  const grp = (st, title, hint, i) => {
    const L = A.filter((x) => x.s.st === st).sort((a, b) => (a.s.d ?? 0) - (b.s.d ?? 0) || OBL_CAT_ORDER.indexOf(a.o.cat) - OBL_CAT_ORDER.indexOf(b.o.cat) || a.o.name.localeCompare(b.o.name, "fr"));
    if (!L.length) return "";
    return `<section class="ob-sec st" style="--i:${i}" id="ob-${st}"><div class="ob-sh ${st}"><span>${title}</span><em class="mono">${L.length}</em></div>${hint ? `<p class="ob-hint">${hint}</p>` : ""}<div class="glass ob-grp">${L.map(({ o }) => oblRow(o)).join("")}</div></section>`;
  };
  return grp("late", "En retard", "", 2) + grp("soon", "Bientôt", "", 3) + grp("unk", "À renseigner", `Touchez ${ico("cal")} pour indiquer la date du dernier passage, même approximative.`, 3) + grp("ok", "À jour", "", 4);
}
VIEWS.obligations = {
  render() {
    if (!oblActive().length) return oblIntroHtml();
    const right = `<button class="btn soft sm ob-catb" data-go="oblCat" aria-label="Catalogue">${ico("sliders")}<span>Catalogue</span></button>`;
    const side = `${oblYearHtml()}${oblRecentHtml()}<button class="glass pad ob-rep st" style="--i:6" data-go="regReport"><span class="ic">${ico("printer")}</span><span class="tx"><b>Pour un contrôle</b><em>Ces contrôles figurent dans le rapport du registre HACCP, avec la date, le prestataire et le statut.</em></span>${ico("chev")}</button>`;
    return `<div class="inner ob">${topBar("Obligations & contrôles", { right })}
      ${oblHeroHtml()}
      <div class="cols ob-cols"><div>${oblListHtml()}<button class="ob-add st" style="--i:5" data-go="oblCat">${ico("plus")}<span><b>Ajouter ou retirer des obligations</b><em>${oblActive().length} suivies · ${OBL_CATALOG.length} proposées</em></span></button></div><div>${side}</div></div>
    </div>`;
  },
};

/* first visit: the catalogue, recommended items pre-selected, one button to start */
function oblIntroHtml() {
  const sel = (S.ui.oblSel ||= Object.fromEntries(OBL_CATALOG.map((c) => [c.key, c.on])));
  const n = OBL_CATALOG.filter((c) => sel[c.key]).length;
  return `<div class="inner narrow ob ob-intro">${topBar("Obligations & contrôles")}
    <div class="ob-ihero st" style="--i:1"><span class="ob-iic">${ico("calcheck")}</span><div><b>Tout ce qui revient chaque année</b><p>Extincteurs, nuisibles, hotte, électricité… Choisissez ce qui concerne votre restaurant : l'application vous prévient avant chaque échéance et garde chaque rapport pour l'inspecteur.</p></div></div>
    <p class="sub st" style="--i:2;margin:0 2px">Ce qui est coché concerne tout restaurant. Touchez un nom pour savoir pourquoi.</p>
    ${oblCatalogHtml((c) => !!sel[c.key], "oblSel", 3)}
    <div class="ctabar"><button class="btn acc block" data-act="oblStart" ${n ? "" : "data-off"}>${ico("check")}Suivre ${oblPlural(n, "obligation")}</button></div>
  </div>`;
}
function oblCatalogHtml(isOn, act, i0) {
  return OBL_CAT_ORDER.map((k, i) => {
    const L = OBL_CATALOG.filter((c) => c.cat === k); if (!L.length) return "";
    return `<section class="ob-csec st" style="--i:${i0 + i}"><div class="ob-ch"><i style="background:${OBL_CATS[k].c}"></i>${OBL_CATS[k].t}</div><div class="glass ob-cgrp">${L.map((c) => {
      const on = isOn(c);
      return `<div class="ob-crow${on ? " on" : ""}"><button class="ob-cinfo" data-act="oblInfo" data-v="${c.key}">${oblTile(c)}<span class="tx"><b>${esc(c.name)}</b><em>${oblFreqTx(c.m)}${c.on ? "" : " · si vous êtes équipé"}</em></span></button><button class="ob-sw${on ? " on" : ""}" role="switch" aria-checked="${on}" aria-label="Suivre : ${esc(c.name)}" data-act="${act}" data-v="${c.key}"><i></i></button></div>`;
    }).join("")}</div></section>`;
  }).join("");
}

/* catalogue screen: enable / disable in one tap, add your own */
VIEWS.oblCat = {
  nav: "obligations",
  render() {
    const on = (c) => S.obligations.some((o) => o.key === c.key && !o.archived);
    const custom = S.obligations.filter((o) => !oblDef(o));
    return `<div class="inner narrow ob">${topBar("Catalogue", { right: `<button class="btn soft sm" data-act="oblNew">${ico("plus")}Ajouter</button>` })}
      <p class="sub st" style="--i:1;margin:0 2px">Activez ce qui concerne votre restaurant. Désactiver une ligne garde son historique.</p>
      ${oblCatalogHtml(on, "oblToggle", 2)}
      <section class="ob-csec st" style="--i:8"><div class="ob-ch"><i style="background:var(--muted)"></i>Vos obligations</div>
        ${custom.length ? `<div class="glass ob-cgrp">${custom.map((o) => `<div class="ob-crow${o.archived ? "" : " on"}"><button class="ob-cinfo" data-go="obl" data-id="${o.id}">${oblTile(o)}<span class="tx"><b>${esc(o.name)}</b><em>${oblFreqTx(o.everyMonths)} · ${esc(oblCatOf(o).t)}</em></span></button><button class="ob-sw${o.archived ? "" : " on"}" role="switch" aria-checked="${!o.archived}" aria-label="Suivre : ${esc(o.name)}" data-act="oblToggleId" data-id="${o.id}"><i></i></button></div>`).join("")}</div>` : ""}
        <button class="ob-add" data-act="oblNew">${ico("plus")}<span><b>Ajouter une obligation</b><em>Contrat d'entretien, contrôle propre à votre local…</em></span></button></section>
    </div>`;
  },
};

/* ───────── detail ───────── */
VIEWS.obl = {
  nav: "obligations",
  render(p) {
    const o = S.obligations.find((x) => x.id === p.id);
    if (!o) return `<div class="inner narrow">${topBar("Obligation")}<div class="glass empty st" style="--i:1"><div class="ic">${ico("calcheck")}</div><b>Introuvable</b>Cette obligation a été supprimée.</div></div>`;
    const s = oblState(o); const D = oblDef(o); const K = oblKindOf(o); const L = oblLogsOf(o.id); const self = D?.kind === "self";
    const span = (+o.everyMonths || 12) * 30.4; const pct = s.due && o.lastDone ? Math.max(0, Math.min(100, Math.round(((span - s.d) / span) * 100))) : s.st === "late" ? 100 : 0;
    const cd = s.st === "unk" ? "Indiquez la date du dernier passage" : s.st === "late" ? s.tx : s.d === 0 ? "C'est aujourd'hui" : `dans ${oblPlural(s.d, "jour")}`;
    const hero = `<div class="glass ob-dh st ${s.st}" style="--i:1;--k:${oblCatOf(o).c}">
      <div class="ob-dhh">${oblTile(o, "lg")}<div class="tx"><span class="lbl">${esc(oblCatOf(o).t)}</span><b>${esc(oblFreqTx(o.everyMonths))}</b></div><span class="pill ${s.pill}">${s.st === "late" ? `<span class="dot"></span>` : ""}${OBL_ST[s.st]}</span></div>
      <div class="ob-dnext"><span class="lbl">Prochaine échéance</span><b>${s.due ? oblLong(s.due) : "Pas encore de date"}</b><em class="${s.st}">${esc(cd)}</em></div>
      ${s.due ? `<div class="ob-prog ${s.st}"><i style="width:${pct}%"></i></div><div class="ob-pl"><span>${o.lastDone ? `Fait le ${oblFull(o.lastDone)}` : o.dueManual ? "Date fixée à la main" : ""}</span><span>${oblFull(s.due)}</span></div>` : ""}</div>`;
    const ck = D?.list ? (() => { const C = o.checks || {}; const n = D.list.filter((x) => C[x.id]).length; return `<div class="glass pad ob-ck st" style="--i:2"><div class="row"><span class="lbl">Liste à vérifier</span><span class="pill ${n === D.list.length ? "ok" : "warn"}" id="obCkN">${n} / ${D.list.length}</span></div>${D.list.map((x) => `<button class="ob-ckr${C[x.id] ? " on" : ""}" role="checkbox" aria-checked="${!!C[x.id]}" data-act="oblCheck" data-id="${o.id}" data-v="${x.id}"><span class="ob-box">${ico("check")}</span><span class="tx"><b>${esc(x.t)}</b><em>${esc(x.s)}</em></span></button>`).join("")}${o.checksAt ? `<p class="note" style="margin:6px 0 0">Liste mise à jour le ${oblFull(dayKey(new Date(o.checksAt)))}.</p>` : ""}</div>`; })() : "";
    const prov = o.provider || o.phone || o.contract
      ? `<div class="glass pad ob-prov st" style="--i:3"><div class="row"><span class="lbl">${self ? "Responsable" : "Prestataire"}</span><button class="btn ghost sm" data-act="oblEdit" data-id="${o.id}">${ico("edit")}Modifier</button></div>
          <div class="ob-pv"><span class="ob-pava" style="background:${colorFor(o.provider || o.id)}">${esc(initials(o.provider || "?"))}</span><div class="tx"><b>${esc(o.provider || "Sans nom")}</b>${o.contract ? `<em>Contrat n° <span class="mono">${esc(o.contract)}</span></em>` : ""}</div></div>
          ${o.phone ? `<a class="btn soft block ob-call" href="tel:${esc(o.phone.replace(/[^\d+]/g, ""))}">${ico("oblPhone")}Appeler <span class="mono">${esc(o.phone)}</span></a>` : ""}
          ${o.notes ? `<p class="note" style="margin:0">${esc(o.notes)}</p>` : ""}</div>`
      : `<button class="glass pad ob-prov ob-pempty st" style="--i:3" data-act="oblEdit" data-id="${o.id}"><span class="ic">${ico(self ? "oblWho" : "oblPhone")}</span><span class="tx"><b>${self ? "Ajouter un responsable" : "Ajouter le prestataire"}</b><em>${self ? "Qui s'en occupe dans l'équipe." : "Nom, téléphone, n° de contrat : la prochaine fois, un tap pour l'appeler."}</em></span>${ico("chev")}</button>`;
    const info = D ? `<div class="glass pad ob-info st" style="--i:4"><span class="lbl">À savoir</span>${oblWhy(D)}</div>` : "";
    const hist = `<div class="glass pad ob-hist st" style="--i:5"><div class="row"><span class="lbl">Historique</span>${L.length ? `<span class="sub">${oblPlural(L.length, "passage")}</span>` : ""}</div>
      ${L.length ? `<ol class="ob-tl">${L.map((l, i) => oblLogHtml(l, i)).join("")}</ol>` : `<div class="ob-hempty"><span class="ic">${ico("camera")}</span><p class="note" style="margin:0">Aucun passage enregistré. ${self ? "Quand c'est fait, touchez « C'est fait »." : "Quand le prestataire passe, touchez le bouton en bas et photographiez son rapport : il sera rangé ici pour le prochain contrôle."}</p></div>`}</div>`;
    const off = `<button class="btn ghost ob-off st" style="--i:6" data-act="oblArchive" data-id="${o.id}">${o.archived ? `${ico("plus")}Suivre à nouveau` : "Ne plus suivre cette obligation"}</button>`;
    return `<div class="inner ob ob-d">${topBar(esc(o.name), { right: `<button class="iconbtn" data-act="oblEdit" data-id="${o.id}" aria-label="Modifier">${ico("edit")}</button>` })}
      <div class="cols"><div>${hero}${ck}${hist}</div><div>${prov}${info}${off}</div></div>
      ${o.archived ? "" : `<div class="ctabar"><button class="btn acc block" data-act="oblRec" data-id="${o.id}">${ico(s.st === "unk" ? "cal" : "check")}${s.st === "unk" ? "Indiquer le dernier passage" : esc(K.cta)}</button></div>`}
    </div>`;
  },
};
function oblLogHtml(l, i) {
  const F = l.files || [];
  const files = F.length ? `<div class="ob-files">${F.map((f) => { const u = oblFileUrl(f); const ph = oblIsLoc(f.id) ? ` data-photo="${esc(f.id)}"` : "";
    return oblIsPdf(f) ? `<a class="ob-fpdf" href="${esc(u || "#")}"${ph} target="_blank" rel="noopener"><span class="ob-pdf">PDF</span><span class="nm">${esc(f.name || "Rapport.pdf")}</span></a>` : `<a class="ob-th" href="${esc(u || "#")}"${ph} target="_blank" rel="noopener" aria-label="Voir le rapport en grand"><img src="${esc(u || PIXEL)}" alt=""${ph} loading="lazy"></a>`; }).join("")}</div>` : "";
  const ck = l.checks ? (() => { const n = Object.values(l.checks).filter(Boolean).length; const T = (oblDef(S.obligations.find((o) => o.id === l.oblId))?.list || []).length || Object.keys(l.checks).length; return `<span class="pill ${n >= T ? "ok" : "warn"}">${n} / ${T} affichages</span>`; })() : "";
  const meta = [l.provider ? esc(l.provider) : "", l.by ? `noté par ${esc(firstName(l.by))}` : "", l.cost != null ? `<span class="mono">${fmt(l.cost, 2)} € HT</span>` : ""].filter(Boolean).join(" · ");
  return `<li class="${i === 0 ? "first" : ""}"><i></i><div class="ob-lg"><div class="ob-lh"><b>${oblLong(l.day)}</b><button class="ob-ldel" data-act="oblLogDel" data-id="${l.id}" aria-label="Supprimer ce passage">${ico("trash")}</button></div>
    ${meta ? `<em>${meta}</em>` : ""}${ck}${l.notes ? `<p>${esc(l.notes)}</p>` : ""}${files}</div></li>`;
}

/* ───────── « Le prestataire est passé » : date → photo → done ───────── */
function oblRecHtml() {
  const R = S.ui.oblRec; const o = S.obligations.find((x) => x.id === R.id); if (!o) return "";
  const K = oblKindOf(o); const D = oblDef(o); const t = dayKey(); const y = addDays(t, -1); const self = D?.kind === "self";
  const mode = R.day === t ? "t" : R.day === y ? "y" : "o";
  const first = !o.lastDone && !oblLogsOf(o.id).length;
  const F = R.files.map((f, i) => `<div class="ob-pf${oblIsPdf(f) ? " pdf" : ""}">${oblIsPdf(f) ? `<span class="ob-pdf">PDF</span><em>${esc(f.name)}</em>` : `<img src="${esc(f.url || oblFileUrl(f))}" alt="">`}<button class="ob-pfx" data-act="oblRecRm" data-v="${i}" aria-label="Retirer">${ico("x")}</button></div>`).join("");
  const ck = D?.list ? `<div class="field"><span>Ce qui est affiché</span><div class="ob-rck">${D.list.map((x) => `<button class="ob-ckr sm${R.checks[x.id] ? " on" : ""}" role="checkbox" aria-checked="${!!R.checks[x.id]}" data-act="oblRecCk" data-v="${x.id}"><span class="ob-box">${ico("check")}</span><span class="tx"><b>${esc(x.t)}</b></span></button>`).join("")}</div></div>` : "";
  return `<div class="ob-rec">
    <div class="ob-rh">${oblTile(o)}<div class="tx"><span class="lbl">${esc(o.name)}</span><b>${first ? "Dernier passage" : esc(K.title)}</b></div></div>
    <div class="field"><span>Quand ?</span><div class="ob-days"><button class="chip${mode === "t" ? " on" : ""}" data-act="oblRecDay" data-v="t">Aujourd'hui</button><button class="chip${mode === "y" ? " on" : ""}" data-act="oblRecDay" data-v="y">Hier</button><button class="chip${mode === "o" ? " on" : ""}" data-act="oblRecDay" data-v="o">${mode === "o" ? oblFull(R.day) : "Autre date"}</button></div>
      ${mode === "o" ? `<input class="input" type="date" id="obRecDate" max="${t}" value="${R.day}" aria-label="Date du passage">` : ""}</div>
    ${ck}
    <div class="ob-ph${R.files.length ? " has" : ""}">${F}<button class="ob-shot" data-act="oblRecPhoto"><span class="ob-shic">${ico("camera")}</span><span class="tx"><b>${R.files.length ? "Autre photo" : esc(K.ph)}</b>${R.files.length ? "" : `<em>${self ? "Facultatif" : first ? "Si vous l'avez encore" : "Rangé avec ce passage pour le contrôle"}</em>`}</span></button></div>
    <button class="btn ghost sm ob-pdfbtn" data-act="oblRecPdf">${ico("oblClip")}Joindre un PDF</button>
    ${self ? "" : `<label class="field"><span>Prestataire</span><input class="input" data-bind="ui.oblRec.provider" value="${esc(R.provider)}" placeholder="Nom de l'entreprise" autocomplete="organization"></label>`}
    <details class="ob-more"${R.notes || R.cost ? " open" : ""}><summary>${ico("plus")}Commentaire ou coût</summary><div class="ob-mf">
      <label class="field"><span>Commentaire</span><input class="input" data-bind="ui.oblRec.notes" value="${esc(R.notes)}" placeholder="Ex. 2 extincteurs remplacés"></label>
      <label class="field"><span>Coût HT (€)</span><input class="input mono" data-bind="ui.oblRec.cost" value="${esc(R.cost)}" inputmode="decimal" placeholder="0,00"></label></div></details>
    <div class="grid2"><button class="btn soft" data-act="oblRecCancel">Annuler</button><button class="btn acc" data-act="oblRecSave" ${R.busy ? "disabled" : ""}>${ico("check")}Enregistrer</button></div>
    ${first ? `<button class="btn ghost ob-dunno" data-act="oblDunno" data-id="${o.id}">Je ne sais pas : à faire dès que possible</button>` : ""}
  </div>`;
}
const oblRecPaint = () => { if (S.ui.oblRec) openSheet(oblRecHtml(), oblRecAfter); };
function oblRecAfter(b) {
  const d = $("#obRecDate", b); if (d) d.addEventListener("change", () => { if (d.value && d.value <= dayKey() && S.ui.oblRec) { S.ui.oblRec.day = d.value; SFX.tick(); const c = $('.ob-days .chip[data-v="o"]', b); if (c) c.textContent = oblFull(d.value); } });
}
async function oblAttach(files) {
  const R = S.ui.oblRec; if (!R) return;
  for (const f of files) {
    const pdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name || "");
    if (!pdf && !/^image\//.test(f.type)) { SFX.err(); toast("Seuls les PDF et les photos sont acceptés.", "err"); continue; }
    if (f.size > 20 * 1048576) { SFX.err(); toast(`« ${f.name} » est trop lourd (20 Mo max).`, "err"); continue; }
    let blob = f; if (!pdf) { try { blob = (await shrink(f, 1800, 0.8)).blob || f; } catch (e) {} }
    try { const r = await upload(blob); R.files.push({ id: r.id, url: r.url, name: pdf ? f.name || "rapport.pdf" : `rapport-${R.day}.jpg`, type: pdf ? "application/pdf" : "image/jpeg" }); SFX.scan(); buzz(6); }
    catch (e) { console.warn(e); SFX.err(); toast("Impossible de garder ce fichier sur l'appareil.", "err"); }
  }
  if (S.ui.oblRec === R) oblRecPaint();
}

/* own undo toast: removes the log and puts the obligation's dates back */
function oblToastUndo(msg, logId) {
  toast(msg); const t = $("#toast");
  $("#toastTx").innerHTML = `<span class="tx">${esc(msg)}</span><button data-act="oblUndo" data-id="${esc(logId)}">Annuler</button>`;
  if (typeof toastPlace === "function") toastPlace(t); t.style.pointerEvents = "auto"; clearTimeout(t._h);
  t._h = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 5000);
}

/* ───────── edit sheet (also used to add a custom obligation) ───────── */
function oblEdHtml() {
  const E = S.ui.oblEd; const D = E.key ? OBL_CATALOG.find((c) => c.key === E.key) : null; const self = D?.kind === "self";
  return `<div class="ob-ed"><div class="h2" style="font-size:21px">${E.id ? (D ? esc(D.name) : "Modifier") : "Nouvelle obligation"}</div>
    ${D ? "" : `<label class="field"><span>Nom</span><input class="input" data-bind="ui.oblEd.name" value="${esc(E.name)}" placeholder="Ex. Entretien du lave-vaisselle"></label>
      <div class="field"><span>Catégorie</span><div class="ob-wrap">${OBL_CAT_ORDER.map((k) => `<button class="chip${E.cat === k ? " on" : ""}" data-act="oblEdCat" data-v="${k}">${OBL_CATS[k].t}</button>`).join("")}</div></div>`}
    <div class="field"><span>Fréquence</span><div class="ob-wrap">${OBL_FREQS.map(([m, t]) => `<button class="chip${+E.everyMonths === m ? " on" : ""}" data-act="oblEdFreq" data-v="${m}">${t}</button>`).join("")}</div></div>
    <label class="field"><span>${self ? "Responsable" : "Prestataire"}</span><input class="input" data-bind="ui.oblEd.provider" value="${esc(E.provider)}" placeholder="${self ? "Ex. Marceau" : "Nom de l'entreprise"}" autocomplete="organization"></label>
    <div class="grid2"><label class="field"><span>Téléphone</span><input class="input mono" type="tel" data-bind="ui.oblEd.phone" value="${esc(E.phone)}" placeholder="06 12 34 56 78" autocomplete="tel"></label>
      <label class="field"><span>N° de contrat</span><input class="input mono" data-bind="ui.oblEd.contract" value="${esc(E.contract)}" placeholder="Facultatif"></label></div>
    <label class="field"><span>Prochaine échéance <i class="ob-opt">si le contrat fixe une date</i></span><input class="input" type="date" data-bind="ui.oblEd.nextDue" value="${esc(E.nextDue || "")}"></label>
    <label class="field"><span>Note</span><input class="input" data-bind="ui.oblEd.notes" value="${esc(E.notes)}" placeholder="Ex. passe le mardi matin"></label>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="oblEdSave">${ico("check")}Enregistrer</button></div>
    ${E.id && !D ? `<button class="btn ghost ob-del" data-act="oblDelAsk" data-id="${E.id}">${ico("trash")}Supprimer cette obligation</button>` : ""}</div>`;
}
const oblEdPaint = () => openSheet(oblEdHtml());

function oblInfoSheet(c) {
  const intro = !oblActive().length;
  const on = intro ? !!(S.ui.oblSel || {})[c.key] : S.obligations.some((o) => o.key === c.key && !o.archived);
  return `<div class="ob-isheet"><div class="ob-rh">${oblTile(c, "lg")}<div class="tx"><span class="lbl">${esc(OBL_CATS[c.cat].t)} · ${oblFreqTx(c.m)}</span><b>${esc(c.name)}</b></div></div>
    ${oblWhy(c)}
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Fermer</button><button class="btn ${on ? "soft" : "acc"}" data-act="${intro ? "oblSel" : "oblToggle"}" data-v="${c.key}" data-close="1">${on ? "Ne pas suivre" : `${ico("check")}Suivre`}</button></div></div>`;
}

/* switch: flip it right away (the data round-trip re-renders a moment later) */
function oblSwFlip(a, on) {
  const sw = a && a.classList.contains("ob-sw") ? a : null; if (!sw) return;
  sw.classList.toggle("on", on); sw.setAttribute("aria-checked", String(on)); const r = sw.closest(".ob-crow"); if (r) r.classList.toggle("on", on);
}

Object.assign(ACT, {
  oblSel: (a, id, v) => {
    const sel = (S.ui.oblSel ||= {}); sel[v] = !sel[v]; SFX.tick(); buzz(5); oblSwFlip(a, sel[v]);
    if (a.dataset.close) { closeSheet(true); rerender(); return; }
    const n = OBL_CATALOG.filter((c) => sel[c.key]).length; const b = $('[data-act="oblStart"]');
    if (b) { b.innerHTML = `${ico("check")}Suivre ${oblPlural(n, "obligation")}`; if (n) b.removeAttribute("data-off"); else b.setAttribute("data-off", ""); }
  },
  oblStart: async (a) => {
    const sel = S.ui.oblSel || {}; const keys = OBL_CATALOG.filter((c) => sel[c.key]).map((c) => c.key); if (!keys.length) return;
    a.disabled = true;
    try { for (const k of keys) await oblEnable(k, true); } catch (e) { a.disabled = false; return; }
    logEvent("oblcfg", `a activé le suivi de ${keys.length} obligations réglementaires`);
    SFX.done(); buzz([10, 40, 14]); burst(); toast(`${keys.length} obligations suivies`); S.ui.oblSel = null;
  },
  oblToggle: async (a, id, v) => {
    const on = !S.obligations.some((o) => o.key === v && !o.archived); oblSwFlip(a, on); SFX.tick(); buzz(5);
    if (a.dataset.close) closeSheet(true);
    try { await oblEnable(v, on); } catch (e) { return; }
    const c = OBL_CATALOG.find((x) => x.key === v); toast(on ? `« ${c.name} » est suivie` : `« ${c.name} » n'est plus suivie`);
  },
  oblToggleId: async (a, id) => { const o = S.obligations.find((x) => x.id === id); if (!o) return; oblSwFlip(a, !!o.archived); SFX.tick(); buzz(5); try { await safe(DB.update("obligations", id, { archived: !o.archived })); } catch (e) {} },
  oblArchive: async (a, id) => {
    const o = S.obligations.find((x) => x.id === id); if (!o) return; const was = !!o.archived;
    try { await safe(DB.update("obligations", id, { archived: !was })); } catch (e) { return; }
    SFX.tick(); toast(was ? "Suivie à nouveau" : "N'est plus suivie. L'historique est conservé."); if (!was) goBack();
  },
  oblInfo: (a, id, v) => { const c = OBL_CATALOG.find((x) => x.key === v); if (!c) return; SFX.tap(); openSheet(oblInfoSheet(c)); },
  oblJump: (a, id, v) => { const el = $(`#ob-${v}`); if (!el) return; SFX.tick(); buzz(4); el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("ob-flash"); void el.offsetWidth; el.classList.add("ob-flash"); },
  oblCheck: async (a, id, v) => {
    const o = S.obligations.find((x) => x.id === id); if (!o) return; const C = { ...(o.checks || {}) }; C[v] = !C[v];
    a.classList.toggle("on", C[v]); a.setAttribute("aria-checked", String(C[v])); SFX.tick(); buzz(5);
    const D = oblDef(o); const all = D?.list && D.list.every((x) => C[x.id]);
    try { await safe(DB.update("obligations", id, { checks: C, checksAt: Date.now() })); } catch (e) { return; }
    if (all && C[v]) { SFX.ok(); toast("Tous les affichages sont en place"); }
  },
  /* record an intervention */
  oblRec: (a, id) => {
    const o = S.obligations.find((x) => x.id === id); if (!o) return; const D = oblDef(o);
    S.ui.oblRec = { id, day: dayKey(), files: [], provider: o.provider || "", notes: "", cost: "", checks: D?.list ? { ...(o.checks || {}) } : null, busy: false };
    SFX.tap(); buzz(6); oblRecPaint();
  },
  oblRecDay: (a, id, v) => {
    const R = S.ui.oblRec; if (!R) return; const t = dayKey();
    if (v === "t") R.day = t; else if (v === "y") R.day = addDays(t, -1); else if (R.day === t || R.day === addDays(t, -1)) R.day = addDays(t, -2);
    SFX.tick(); oblRecPaint();
    if (v === "o") setTimeout(() => { const d = $("#obRecDate"); if (d) { try { d.focus({ preventScroll: true }); d.showPicker && d.showPicker(); } catch (e) {} } }, 80);
  },
  oblRecCk: (a, id, v) => { const R = S.ui.oblRec; if (!R || !R.checks) return; R.checks[v] = !R.checks[v]; a.classList.toggle("on", R.checks[v]); a.setAttribute("aria-checked", String(R.checks[v])); SFX.tick(); buzz(4); },
  oblRecPhoto: async () => { const files = await pickImage(); if (files.length) await oblAttach(files); },
  oblRecPdf: () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/pdf,image/*"; inp.multiple = true; inp.hidden = true; document.body.appendChild(inp);
    inp.addEventListener("change", async () => { const fs = [...(inp.files || [])]; inp.remove(); if (fs.length) await oblAttach(fs); }, { once: true });
    inp.click();
  },
  oblRecRm: (a, id, v) => { const R = S.ui.oblRec; if (!R) return; const [f] = R.files.splice(+v, 1); oblRmFile(f); SFX.close(); oblRecPaint(); },
  oblRecCancel: () => { const R = S.ui.oblRec; S.ui.oblRec = null; if (R) R.files.forEach(oblRmFile); closeSheet(); },
  oblRecSave: async (a) => {
    const R = S.ui.oblRec; if (!R || R.busy) return; const o = S.obligations.find((x) => x.id === R.id); if (!o) return;
    if (!R.day || R.day > dayKey()) { SFX.err(); toast("Choisissez une date passée.", "err"); return; }
    R.busy = true; a.disabled = true;
    const provider = String(R.provider || "").trim(); const cost = num(R.cost);
    const log = { oblId: o.id, day: R.day, provider: provider || o.provider || "", by: S.me.name || nameOf(S.me.id), uid: S.me.id, at: Date.now(), files: R.files.map((f) => ({ id: f.id, name: f.name, type: f.type, ...(oblIsLoc(f.id) ? {} : { url: f.url }) })) };
    if (String(R.notes || "").trim()) log.notes = String(R.notes).trim();
    if (cost != null) log.cost = cost;
    if (R.checks) log.checks = { ...R.checks };
    let logId;
    try { logId = await safe(DB.add("oblLogs", log)); } catch (e) { R.busy = false; a.disabled = false; return; }
    const last = [o.lastDone, R.day].filter(Boolean).sort().pop();
    const patch = { lastDone: last, nextDue: oblAddM(last, +o.everyMonths || 12), dueManual: false };
    if (provider && !o.provider) patch.provider = provider;
    if (R.checks) { patch.checks = { ...R.checks }; patch.checksAt = Date.now(); }
    await DB.update("obligations", o.id, patch).catch(() => {});
    logEvent("obl", `a enregistré « ${o.name} » du ${oblFull(R.day)}${log.provider ? ` (${log.provider})` : ""}`, { ref: o.id, logId });
    S.ui.oblRec = null; closeSheet(true);
    SFX.done(); buzz([10, 40, 14]); burst();
    oblToastUndo(`${o.name} : à jour jusqu'au ${oblFull(patch.nextDue)}`, logId);
  },
  oblUndo: async (a, id) => {
    const l = S.oblLogs.find((x) => x.id === id); $("#toast").classList.remove("on"); if (!l) return;
    await DB.del("oblLogs", id).catch(() => {}); await oblRecalc(l.oblId, id);
    const ev = S.events.find((e) => e.type === "obl" && e.logId === id); if (ev) DB.del("events", ev.id).catch(() => {});
    (l.files || []).forEach(oblRmFile); SFX.close();
  },
  oblDunno: async (a, id) => {
    const R = S.ui.oblRec; S.ui.oblRec = null; if (R) R.files.forEach(oblRmFile);
    closeSheet(true); try { await safe(DB.update("obligations", id, { nextDue: dayKey(), dueManual: true })); } catch (e) { return; }
    SFX.ok(); toast("À faire dès que possible : appelez le prestataire");
  },
  oblLogDel: (a, id) => {
    const l = S.oblLogs.find((x) => x.id === id); if (!l) return; SFX.tap(); const n = (l.files || []).length;
    openSheet(`<div class="h2" style="font-size:20px">Supprimer ce passage ?</div><p class="sub" style="margin:0">Le passage du ${oblLong(l.day)}${n ? ` et ${n > 1 ? `ses ${n} fichiers` : "son fichier"}` : ""} seront supprimés. La prochaine échéance sera recalculée.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="oblLogDelOk" data-id="${id}">${ico("trash")}Supprimer</button></div>`);
  },
  oblLogDelOk: async (a, id) => {
    const l = S.oblLogs.find((x) => x.id === id); closeSheet(true); if (!l) return; const o = S.obligations.find((x) => x.id === l.oblId);
    try { await safe(DB.del("oblLogs", id)); } catch (e) { return; }
    await oblRecalc(l.oblId, id); (l.files || []).forEach(oblRmFile);
    logEvent("oblcfg", `a supprimé le passage « ${o ? o.name : ""} » du ${oblFull(l.day)}`, { ref: l.oblId });
    SFX.close(); toast("Passage supprimé");
  },
  /* edit / add */
  oblEdit: (a, id) => { const o = S.obligations.find((x) => x.id === id); if (!o) return; S.ui.oblEd = { id, key: oblDef(o) ? o.key : null, name: o.name, cat: o.cat, everyMonths: +o.everyMonths || 12, provider: o.provider || "", phone: o.phone || "", contract: o.contract || "", nextDue: o.dueManual ? o.nextDue : "", notes: o.notes || "" }; SFX.tap(); oblEdPaint(); },
  oblNew: () => { S.ui.oblEd = { id: null, key: null, name: "", cat: "tech", everyMonths: 12, provider: "", phone: "", contract: "", nextDue: "", notes: "" }; SFX.tap(); oblEdPaint(); },
  oblEdFreq: (a, id, v) => { S.ui.oblEd.everyMonths = +v; SFX.tick(); oblEdPaint(); },
  oblEdCat: (a, id, v) => { S.ui.oblEd.cat = v; SFX.tick(); oblEdPaint(); },
  oblEdSave: async (a) => {
    const E = S.ui.oblEd; if (!E) return; const name = String(E.name || "").trim();
    if (!E.key && !name) { SFX.err(); buzz(30); toast("Donnez un nom à cette obligation.", "err"); const i = $('#sheetBody input[data-bind="ui.oblEd.name"]'); if (i) i.focus(); return; }
    const d = { everyMonths: +E.everyMonths || 12, provider: String(E.provider || "").trim(), phone: String(E.phone || "").trim(), contract: String(E.contract || "").trim(), notes: String(E.notes || "").trim() };
    if (!E.key) { d.name = name; d.cat = E.cat; }
    if (E.nextDue) { d.nextDue = E.nextDue; d.dueManual = true; }
    a.disabled = true;
    try {
      if (E.id) {
        const o = S.obligations.find((x) => x.id === E.id);
        if (!E.nextDue) { d.dueManual = false; d.nextDue = o && o.lastDone ? oblAddM(o.lastDone, d.everyMonths) : null; }
        await safe(DB.update("obligations", E.id, d));
      } else {
        const nid = await safe(DB.add("obligations", { key: "perso-" + Date.now().toString(36), lastDone: null, archived: false, createdAt: Date.now(), nextDue: null, ...d }));
        logEvent("oblcfg", `a ajouté l'obligation « ${name} »`, { ref: nid });
        S.ui.oblEd = null; closeSheet(true); SFX.ok(); toast("Obligation ajoutée"); go("obl", { id: nid }); return;
      }
    } catch (e) { a.disabled = false; return; }
    S.ui.oblEd = null; closeSheet(true); SFX.ok(); buzz(8); toast("Enregistré");
  },
  oblDelAsk: (a, id) => { const o = S.obligations.find((x) => x.id === id); if (!o) return; const n = oblLogsOf(id).length; openSheet(`<div class="h2" style="font-size:20px">Supprimer « ${esc(o.name)} » ?</div><p class="sub" style="margin:0">L'obligation${n ? ` et ${oblPlural(n, "passage")}` : ""} seront supprimés définitivement.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="oblDelOk" data-id="${id}">${ico("trash")}Supprimer</button></div>`); },
  oblDelOk: async (a, id) => {
    closeSheet(true); const L = oblLogsOf(id);
    try { for (const l of L) { await DB.del("oblLogs", l.id); (l.files || []).forEach(oblRmFile); } await safe(DB.del("obligations", id)); } catch (e) { return; }
    SFX.close(); toast("Obligation supprimée"); go("obligations", {}, { replace: true });
  },
});
