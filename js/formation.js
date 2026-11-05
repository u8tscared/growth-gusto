/* Growth Gusto — area: formation (mini-formation HACCP, quiz, attestations). Prefix « fm ».
   Route `formation` (S.params.id = a module → the player: cards, quiz, result).
   Data: restos/{rid}/training/{id} = one quiz attempt { pid, memberId, name, mod, score, total, passed, at, day, by }
         (pid = the person's id as rh.js lists them: staff id, or "m_<memberId>" for a member without a staff file).
   Mandatory modules: restos/{rid}.trainingRequired = ["froid", "allergenes", …] (perms.js has no training key).
   Public helpers: fmProgress(pid) → { done, total, required, missing:[modId], passed:{modId:record} }, fmTodo(pid) → [modId],
                   fmMyPid() → the current person's pid. */
"use strict";

Object.assign(IC, {
  fmBug: ["f:M8 9.5a4 4 0 0 1 8 0V15a4 4 0 0 1-8 0z", "M8 9.5a4 4 0 0 1 8 0V15a4 4 0 0 1-8 0z", "M12 9.5V19", "M9.6 5.7 8.2 3.6", "M14.4 5.7l1.4-2.1", "M8 12H4.5", "M16 12h3.5", "m8 15.5-3 1.6", "m16 15.5 3 1.6", "M8.4 8.6 5.6 7.2", "m15.6 8.6 2.8-1.4"],
  fmHand: ["f:M12 2.8s3.6 3.9 3.6 6.3a3.6 3.6 0 0 1-7.2 0c0-2.4 3.6-6.3 3.6-6.3z", "M12 2.8s3.6 3.9 3.6 6.3a3.6 3.6 0 0 1-7.2 0c0-2.4 3.6-6.3 3.6-6.3z", "M2.8 16.9c2.4 0 3.5-1.4 5.5-1.4h3.1a1.45 1.45 0 0 1 0 2.9H8.9", "M11.4 18.4h4.3l3.8-2.6a1.4 1.4 0 0 1 1.6 2.3L16 21.2H2.8"],
  fmWheat: ["M12 21.2V8.8", "f:M12 8.8c-2.2-.4-3.5-2-3.5-4.6 2.2.4 3.5 2 3.5 4.6z", "M12 8.8c-2.2-.4-3.5-2-3.5-4.6 2.2.4 3.5 2 3.5 4.6z", "M12 8.8c2.2-.4 3.5-2 3.5-4.6-2.2.4-3.5 2-3.5 4.6z", "M12 13.3c-2.2-.4-3.5-2-3.5-4.6 2.2.4 3.5 2 3.5 4.6z", "M12 13.3c2.2-.4 3.5-2 3.5-4.6-2.2.4-3.5 2-3.5 4.6z", "M12 17.8c-2.2-.4-3.5-2-3.5-4.6 2.2.4 3.5 2 3.5 4.6z", "M12 17.8c2.2-.4 3.5-2 3.5-4.6-2.2.4-3.5 2-3.5 4.6z"],
  fmMedal: ["f:M12 9.6a5.4 5.4 0 1 1 0 10.8 5.4 5.4 0 0 1 0-10.8z", "c:12,15,5.4", "M8.6 10.8 5.6 3.5h3.9l2.5 6.1", "m15.4 10.8 3-7.3h-3.9L12 9.6", "m12 12.4.85 1.7 1.85.27-1.35 1.3.32 1.85L12 16.65l-1.67.87.32-1.85-1.35-1.3 1.85-.27z"],
  fmBox: ["f:M4.5 9.5h15V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19z", "M3.5 6.5h17v3h-17z", "M4.5 9.5V19A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5V9.5", "M10 13h4"],
});

/* ───────────── content (French regulation; short on purpose) ─────────────
   card: { ic, t, s, viz?: "lcd" | "steps" | "chips" | "label" | "vs" | "seal" | "levels", big?, items? }
   quiz: [question, [right answer, wrong, wrong], why] — the right answer is always written first, the options are shuffled. */
const FM_TONES = { vi: ["#EFE9FF", "#5B2BFF"], sk: ["#E6F0FF", "#2F5FBF"], sa: ["#FFF3D6", "#7A5A1A"], to: ["#FFE9DE", "#C8432A"], mi: ["#E3F5EA", "#1E7F55"] };
const FM_MODS = [
  { id: "froid", t: "Chaîne du froid", ic: "snow", tone: "sk",
    cards: [
      { viz: "lcd", big: "0 à +4 °C", t: "Les produits frais", s: "Viandes, laitages, préparations : au froid. Viande hachée : +2 °C maximum." },
      { viz: "lcd", big: "−18 °C", t: "Les surgelés", s: "−18 °C ou moins, sans coupure. Un produit décongelé ne se recongèle jamais." },
      { ic: "fridge", t: "Décongeler au frigo", s: "Jamais sur le plan de travail ni sous l'eau chaude : au réfrigérateur, entre 0 et +4 °C." },
      { ic: "therm", t: "Relever, noter, réagir", s: "Températures notées à chaque service. Hors limite : on isole les produits, on prévient, on note l'action." },
    ],
    quiz: [
      ["La viande hachée se garde à…", ["+2 °C maximum", "+6 °C maximum", "+8 °C maximum"], "Viande hachée : +2 °C maximum (arrêté du 21 décembre 2009)."],
      ["Un surgelé doit rester à…", ["−18 °C ou moins", "−10 °C ou moins", "0 °C ou moins"], "La température des surgelés est de −18 °C ou moins."],
      ["Un produit décongelé peut-il être recongelé tel quel ?", ["Non, jamais", "Oui, s'il est encore froid", "Oui, dans les 24 h"], "Les microbes se sont multipliés pendant la décongélation : on ne recongèle jamais."],
      ["Où décongeler un rôti ?", ["Au réfrigérateur", "Sur le plan de travail", "Dans l'évier, à l'eau chaude"], "Au froid, entre 0 et +4 °C : les microbes ne se multiplient pas."],
      ["Le frigo affiche +8 °C. Que faire ?", ["Vérifier, isoler les produits et noter l'action", "Attendre le prochain relevé", "Rien, c'est toléré quelques heures"], "Hors limite, on agit tout de suite et on garde une trace de l'action corrective."],
    ] },
  { id: "dates", t: "DLC et DDM", ic: "cal", tone: "sa",
    cards: [
      { viz: "vs", t: "Deux dates, deux règles", s: "La DLC protège la santé. La DDM ne concerne que la qualité." },
      { ic: "trash", t: "DLC dépassée = on jette", s: "Interdit en cuisine, même cuit, même si le produit a l'air bon. On le jette et on le note." },
      { viz: "label", t: "Après ouverture", s: "Un produit entamé ou fait maison a sa propre date limite : on l'écrit sur l'étiquette." },
      { ic: "up", t: "Premier périmé, premier sorti", s: "Les dates courtes devant, les plus longues derrière. On utilise d'abord ce qui périme d'abord." },
    ],
    quiz: [
      ["« À consommer jusqu'au… », c'est…", ["Une DLC", "Une DDM", "Une date indicative"], "« Jusqu'au » = date limite de consommation, impérative."],
      ["Un yaourt dont la DLC était hier :", ["On le jette", "On le sert vite", "On le cuisine en gâteau"], "DLC dépassée = interdit à la consommation, même cuit."],
      ["Pâtes sèches, DDM dépassée d'une semaine, paquet intact :", ["Encore consommables", "Interdites", "À congeler d'urgence"], "La DDM (« de préférence avant ») concerne la qualité, pas la sécurité."],
      ["Une sauce faite maison, comment la dater ?", ["Étiquette : fabriquée le, à utiliser avant", "Pas besoin, on s'en souvient", "Avec la DLC du beurre utilisé"], "Toute préparation porte sa date de fabrication et sa date limite."],
      ["Dans le frigo, devant, on met…", ["Les dates les plus courtes", "La livraison du matin", "Les plus gros bacs"], "Premier périmé, premier sorti : moins de pertes, moins de risques."],
    ] },
  { id: "tracabilite", t: "Étiquetage et traçabilité", ic: "tag", tone: "vi",
    cards: [
      { ic: "truck", t: "D'où vient ce produit ?", s: "Vous devez pouvoir dire qui a livré chaque produit, et quand (règlement CE 178/2002)." },
      { viz: "seal", t: "La marque sanitaire", s: "L'ovale des produits animaux : pays et numéro de l'atelier agréé. On garde l'étiquette ou une photo." },
      { viz: "label", t: "L'étiquette maison", s: "Sur chaque bac : nom, date de fabrication ou d'ouverture, date limite." },
      { ic: "store", t: "L'origine des viandes", s: "Bœuf, porc, volaille, agneau : l'origine est indiquée aux clients, sur la carte ou un affichage." },
    ],
    quiz: [
      ["La traçabilité, c'est pouvoir dire…", ["Qui a livré chaque produit, et quand", "Le prix de chaque produit", "Le nom de chaque client"], "Un pas en amont (fournisseur), un pas en aval : c'est la règle européenne."],
      ["L'ovale « FR 69.123.456 CE » indique…", ["L'atelier agréé d'où vient le produit", "La date de péremption", "Le poids du produit"], "C'est la marque d'identification sanitaire des produits d'origine animale."],
      ["Que met-on sur un bac de préparation ?", ["Nom, date de fabrication, date limite", "Seulement le nom", "Rien si le bac est fermé"], "Sans étiquette, impossible de savoir si le produit est encore bon."],
      ["Vous jetez le carton d'origine d'un produit :", ["On garde son étiquette ou une photo", "On jette tout", "On recopie juste le prix"], "L'étiquette d'origine (lot, marque sanitaire) reste la preuve de traçabilité."],
      ["L'origine du bœuf servi doit être…", ["Indiquée aux clients", "Gardée secrète", "Donnée seulement au contrôleur"], "Obligatoire en restauration pour le bœuf, et depuis 2022 pour le porc, la volaille et l'agneau."],
    ] },
  { id: "allergenes", t: "Les 14 allergènes", ic: "fmWheat", tone: "to",
    cards: [
      { viz: "chips", t: "14 allergènes à déclarer", s: "La liste du règlement européen INCO (1169/2011)." },
      { ic: "book", t: "Une information écrite", s: "Le client trouve les allergènes de chaque plat par écrit, sans avoir à demander : carte, affichage ou classeur." },
      { ic: "scissors", t: "Attention aux traces", s: "Planche, couteau, huile de friture, gants : un ustensile partagé suffit à contaminer un plat." },
      { ic: "search", t: "Un doute ? On vérifie", s: "Fiche recette ou étiquette en main. Si on ne sait pas, on ne promet rien." },
    ],
    quiz: [
      ["Combien d'allergènes doivent être déclarés ?", ["14", "9", "20"], "14 allergènes réglementaires, fixés par le règlement INCO."],
      ["Lequel est un allergène réglementaire ?", ["Le sésame", "La tomate", "Le poivre"], "Sésame, mais aussi céleri, moutarde, lupin, sulfites…"],
      ["Un client demande si un plat contient des fruits à coque :", ["On vérifie la fiche recette", "On répond « je crois que non »", "On retire juste la garniture"], "Une réponse au hasard peut envoyer quelqu'un à l'hôpital."],
      ["Frites cuites dans l'huile des beignets de crevettes :", ["Danger pour un allergique aux crustacés", "Aucun risque, la friture désinfecte", "Risque seulement si l'huile est froide"], "La cuisson ne détruit pas les allergènes : l'huile partagée contamine."],
      ["L'information allergènes doit être…", ["Écrite et accessible sans demander", "Donnée seulement à l'oral", "Réservée aux contrôleurs"], "En France, elle est écrite et consultable librement par le client (décret 2015-447)."],
    ] },
  { id: "nettoyage", t: "Nettoyage et désinfection", ic: "spray", tone: "sk",
    cards: [
      { viz: "steps", items: ["Débarrasser", "Nettoyer au détergent", "Rincer", "Désinfecter", "Rincer si l'étiquette le dit", "Sécher à l'air"], t: "Les 6 étapes", s: "Dans cet ordre, à chaque fois." },
      { ic: "clock", t: "Dose et temps de contact", s: "Trop dilué, le produit ne désinfecte pas. Laissez-le agir le temps écrit sur l'étiquette." },
      { ic: "alert", t: "Jamais de mélange", s: "Javel + détartrant acide = gaz toxique. Un produit à la fois, rincé entre deux." },
      { ic: "list", t: "Un plan, coché", s: "Qui nettoie quoi, quand, avec quel produit. On coche dans l'app : c'est la preuve." },
    ],
    quiz: [
      ["Dans quel ordre ?", ["Nettoyer, puis désinfecter", "Désinfecter, puis nettoyer", "Peu importe"], "Le désinfectant n'agit pas sur une surface encore sale."],
      ["Le temps de contact d'un désinfectant…", ["Doit être respecté, sinon il n'agit pas", "Est facultatif", "Ne compte que pour les sols"], "Chaque produit a un temps d'action minimum, écrit sur l'étiquette."],
      ["Mélanger javel et détartrant :", ["Dangereux : gaz toxique", "Plus efficace", "Sans effet"], "Le mélange dégage du chlore gazeux, très irritant."],
      ["Pour sécher un plan de travail désinfecté :", ["Air libre ou papier à usage unique", "Le torchon de la veille", "Le tablier"], "Un torchon réutilisé redépose des microbes."],
      ["Comment prouver que le nettoyage est fait ?", ["En le cochant au plan de nettoyage", "En le disant au contrôleur", "Ça se voit, pas besoin"], "Ce qui n'est pas noté n'est pas prouvé."],
    ] },
  { id: "reception", t: "Réception des marchandises", ic: "truck", tone: "sa",
    cards: [
      { viz: "steps", items: ["Température", "Dates", "Emballages", "Marque sanitaire"], t: "4 contrôles à chaque livraison", s: "Avant de signer le bon, jamais après." },
      { viz: "lcd", big: "≤ +4 °C", t: "Sonde entre deux paquets", s: "Pas à travers le film. Surgelés : −18 °C (−15 °C toléré pendant le transport)." },
      { ic: "x", t: "Non conforme ? On refuse", s: "On l'écrit sur le bon de livraison, on prend une photo, on prévient le fournisseur." },
      { ic: "snow", t: "Le froid d'abord", s: "Surgelés puis frais, rangés tout de suite. Les cartons restent hors de la chambre froide." },
    ],
    quiz: [
      ["Le livreur arrive. Que rangez-vous en premier ?", ["Les surgelés", "Les conserves", "Les légumes secs"], "Les surgelés d'abord, puis le frais : la chaîne du froid ne s'arrête pas."],
      ["Où piquer la sonde pour un produit emballé ?", ["Entre deux emballages", "Dans l'aliment, à travers le film", "Sur le carton"], "On ne perce pas un emballage qu'on n'a pas encore accepté."],
      ["Du poulet livré à +9 °C :", ["On refuse et on le note sur le bon", "On l'accepte et on le met vite au froid", "On le cuisine aujourd'hui"], "Volaille fraîche : +4 °C maximum à la livraison."],
      ["Pourquoi laisser les cartons hors de la chambre froide ?", ["Ils sont sales et abritent des nuisibles", "Pour gagner de la place seulement", "Ils réchauffent la chambre"], "Les cartons viennent de l'extérieur : ils salissent et peuvent cacher des insectes."],
      ["Que garder pour la traçabilité ?", ["Bon de livraison et étiquettes", "Rien, le fournisseur garde tout", "Le ticket de caisse du client"], "Bons et étiquettes prouvent l'origine de chaque produit."],
    ] },
  { id: "refroidissement", t: "Refroidissement rapide", ic: "therm", tone: "sk",
    cards: [
      { viz: "lcd", big: "+63 → +10 °C", t: "En moins de 2 heures", s: "Un plat cuisiné à l'avance passe sous +10 °C en moins de 2 h, puis se garde à +3 °C maximum." },
      { ic: "snow", t: "La cellule de refroidissement", s: "Le frigo de service refroidit trop lentement et réchauffe tout ce qu'il contient." },
      { ic: "fmBox", t: "Petit et plat", s: "Bacs peu profonds, portions fines. On couvre une fois refroidi." },
      { viz: "lcd", big: "≥ +63 °C", t: "Le chaud reste chaud", s: "Maintien au chaud à +63 °C ou plus. Remise en température : +63 °C en moins d'une heure." },
    ],
    quiz: [
      ["Un plat cuisiné à l'avance doit passer sous +10 °C en…", ["Moins de 2 heures", "Moins de 6 heures", "Une nuit"], "De +63 °C à moins de +10 °C en moins de 2 h (arrêté du 21 décembre 2009)."],
      ["Pourquoi pas directement dans le frigo de service ?", ["Trop lent, et il réchauffe les autres produits", "Mettre du chaud au froid est interdit", "Pour économiser l'électricité"], "Entre +10 et +63 °C, les microbes se multiplient très vite."],
      ["Maintien au chaud, au minimum :", ["+63 °C", "+45 °C", "+50 °C"], "En dessous de +63 °C, les bactéries se développent."],
      ["Pour refroidir vite une sauce :", ["La répartir dans des bacs peu profonds", "La laisser dans la grande marmite", "La couvrir hermétiquement encore chaude"], "Moins d'épaisseur = le froid arrive au cœur plus vite."],
      ["Une fois refroidi, le plat se garde à…", ["+3 °C maximum", "+8 °C maximum", "Température ambiante"], "Plats cuisinés à l'avance : +3 °C maximum."],
    ] },
  { id: "hygiene", t: "Hygiène du personnel", ic: "fmHand", tone: "vi",
    cards: [
      { viz: "lcd", big: "30 s", t: "Le lavage des mains", s: "Savon, au moins 30 secondes, ongles et poignets, essuie-mains à usage unique." },
      { viz: "chips", items: ["En arrivant", "Après les toilettes", "Après le cru", "Après les déchets", "Après le téléphone", "Après s'être mouché"], t: "Quand se laver les mains ?", s: "Et à chaque changement de tâche." },
      { ic: "users", t: "La tenue de cuisine", s: "Propre et réservée au travail, cheveux couverts, ni bijoux ni montre, ongles courts sans vernis." },
      { ic: "alert", t: "Malade ou blessé ? On le dit", s: "Diarrhée, vomissements, fièvre, plaie infectée : prévenez le responsable. Coupure : pansement étanche et gant." },
    ],
    quiz: [
      ["Combien de temps se laver les mains ?", ["Au moins 30 secondes", "5 secondes", "Le temps de les mouiller"], "30 secondes de savon pour atteindre ongles, pouces et poignets."],
      ["Après avoir touché du poulet cru :", ["Je me lave les mains", "Je m'essuie sur mon tablier", "Je change juste de couteau"], "Le poulet cru porte souvent des salmonelles ou des campylobacters."],
      ["Montre et bracelets en cuisine :", ["On les retire", "On les garde sous la manche", "Seulement le soir"], "Les bijoux retiennent les microbes et peuvent tomber dans un plat."],
      ["Vous avez une gastro :", ["Je préviens le responsable avant de travailler", "Je viens et je mets des gants", "Je ne dis rien"], "La loi impose de le signaler (règlement CE 852/2004)."],
      ["Coupure au doigt :", ["Pansement étanche et gant", "On continue sans rien", "Un peu d'alcool et on continue"], "Une plaie peut porter des staphylocoques."],
    ] },
  { id: "nuisibles", t: "Les nuisibles", ic: "fmBug", tone: "to",
    cards: [
      { viz: "chips", items: ["Crottes", "Traces de dents", "Insectes", "Emballages percés", "Odeur"], t: "Les signes", s: "Au moindre signe, on prévient le responsable." },
      { ic: "home", t: "Tout fermer", s: "Moustiquaires, trous bouchés, portes fermées, rien posé au sol." },
      { ic: "trash", t: "Poubelles fermées", s: "Couvercle à pédale, vidées souvent, local propre. Pas de carton qui traîne." },
      { ic: "shield", t: "Un plan de lutte", s: "Pièges repérés sur un plan, passages d'un prestataire ou contrôles internes, tout est noté." },
    ],
    quiz: [
      ["Des crottes de souris dans la réserve :", ["Prévenir, jeter les produits touchés, appeler le dératiseur", "Balayer et continuer", "Attendre de voir une souris"], "On isole, on jette ce qui est touché, on traite et on note."],
      ["En réserve, les produits sont stockés…", ["Surélevés, jamais au sol", "Au sol s'ils sont emballés", "Dans leurs cartons, au sol"], "Le sol, c'est l'autoroute des rongeurs et la zone qu'on ne nettoie pas."],
      ["Les poubelles de cuisine :", ["Couvercle fermé, ouverture à pédale", "Ouvertes pour aller plus vite", "Vidées une fois par semaine"], "Une poubelle ouverte attire mouches et rongeurs."],
      ["Le plan de lutte contre les nuisibles, c'est…", ["Des pièges repérés sur un plan, et des passages notés", "Une bombe insecticide sous l'évier", "Un chat dans la réserve"], "Les animaux sont interdits en cuisine, et un insecticide ne se pulvérise pas près des aliments."],
      ["Un sachet percé ou grignoté :", ["On jette le produit", "On le transvase dans une boîte", "On l'utilise vite"], "Il a pu être contaminé par l'urine ou les crottes."],
    ] },
  { id: "ddpp", t: "Le contrôle sanitaire", ic: "shield", tone: "vi",
    cards: [
      { ic: "users", t: "Sans prévenir", s: "Les inspecteurs de la DDPP (les services vétérinaires) peuvent passer à tout moment, même en plein service." },
      { viz: "steps", items: ["Relevés de température", "Traçabilité", "Plan de nettoyage", "Allergènes", "Formation hygiène"], t: "Ce qu'ils demandent", s: "Tout est déjà dans le registre HACCP de l'app." },
      { viz: "levels", t: "Une note publique", s: "Le résultat est publié sur Alim'confiance, visible par vos clients." },
      { ic: "book", t: "Le jour J", s: "Restez courtois, accompagnez l'inspecteur, montrez le registre HACCP de l'app. Notez ses remarques." },
    ],
    quiz: [
      ["Un contrôle sanitaire est-il annoncé ?", ["Non, il peut arriver sans prévenir", "Oui, un mois avant", "Oui, par lettre recommandée"], "La plupart des inspections sont inopinées."],
      ["Où le résultat est-il publié ?", ["Sur Alim'confiance", "Nulle part", "Dans le journal local"], "Site et appli Alim'confiance, consultables par tout le monde."],
      ["Combien de niveaux sur Alim'confiance ?", ["4", "2", "10"], "Très satisfaisant, satisfaisant, à améliorer, à corriger de manière urgente."],
      ["La formation hygiène de 14 h :", ["Au moins une personne de l'équipe doit l'avoir suivie", "Personne n'y est obligé", "Seul le propriétaire du local doit l'avoir"], "Obligatoire en restauration commerciale (décret 2011-731)."],
      ["L'inspecteur demande les relevés de la semaine :", ["On les montre dans le registre HACCP", "On dit qu'on les fait de tête", "On refuse"], "Des relevés notés et datés : c'est ce qu'il vient vérifier."],
    ] },
];
const FM_BY = Object.fromEntries(FM_MODS.map((m) => [m.id, m]));
const FM_PASS = 4; /* 4 bonnes réponses sur 5 */
const FM_LEVELS = [["Très satisfaisant", "mi"], ["Satisfaisant", "sk"], ["À améliorer", "sa"], ["À corriger de manière urgente", "to"]];

/* ───────────── state + data ───────────── */
const FM = { rows: null, rid: null, seeded: {}, who: null, tab: "mods", run: null };
function fmWatch() {
  if (!S.rid || FM.rid === S.rid) return; FM.rid = S.rid; FM.rows = null;
  const rid = S.rid; DB.watch("training", { order: "at", dir: "desc", limit: 3000 }, (rows) => { if (S.rid !== rid) return; FM.rows = rows; if (S.route === "formation") onData(); });
}
const fmRows = () => (FM.rid === S.rid && FM.rows) || [];
const fmPeople = () => (typeof rhPeople === "function" ? rhPeople() : (S.members || []).map((m) => ({ id: "m_" + m.id, memberId: m.id, name: m.name || "Sans nom", color: m.color || colorFor(m.id) })));
function fmMyPid() {
  const ppl = fmPeople(); const me = ppl.find((p) => p.memberId && p.memberId === S.me.id);
  return me ? me.id : "m_" + (S.me.id || "local");
}
const fmWho = () => { const ppl = fmPeople(); if (FM.who && (ppl.some((p) => p.id === FM.who) || FM.who === fmMyPid())) return FM.who; return fmMyPid(); };
const fmPerson = (pid) => fmPeople().find((p) => p.id === pid) || { id: pid, name: pid === fmMyPid() ? S.me.name || "Moi" : "Sans nom", color: "#5B2BFF" };
const fmRequired = () => { const r = S.resto && S.resto.trainingRequired; return Array.isArray(r) ? r.filter((k) => FM_BY[k]) : []; };
const fmIsBoss = () => DB.mode === "demo" || (typeof myRole === "function" && myRole() === "gerant");
const fmIsMgr = () => DB.mode === "demo" || (typeof myRole === "function" && ["gerant", "chef"].includes(myRole()));
function fmProgress(pid) {
  const passed = {}; fmRows().forEach((r) => { if (r.pid === pid && r.passed && FM_BY[r.mod] && (!passed[r.mod] || r.at > passed[r.mod].at)) passed[r.mod] = r; });
  const req = fmRequired(); const missing = req.filter((k) => !passed[k]);
  return { done: Object.keys(passed).length, total: FM_MODS.length, required: req.length, missing, passed };
}
const fmTodo = (pid) => fmProgress(pid || fmMyPid()).missing;
window.fmProgress = fmProgress; window.fmTodo = fmTodo; window.fmMyPid = fmMyPid;

/* demo: a believable team, some modules done, Hugo (the newest) still has the mandatory ones to do */
function fmSeed() {
  if (DB.mode !== "demo" || !S.rid || FM.seeded[S.rid] || !FM.rows) return; FM.seeded[S.rid] = true; if (FM.rows.length) return;
  const ppl = fmPeople(); if (!ppl.length) return;
  const plan = { thomas: 10, ines: 8, camille: 10, lucas: 5, sarah: 4, hugo: 1 };
  const t0 = Date.now(); let k = 0;
  ppl.forEach((p) => {
    const key = Object.keys(plan).find((n) => (p.memberId || p.id).toLowerCase().includes(n)); const n = key ? plan[key] : 3;
    FM_MODS.slice(0, n).forEach((m, i) => {
      const at = t0 - (60 - i * 5 - (k % 4)) * 864e5 - (k * 3571000) % 864e5; k++;
      if ((k % 5) === 0) DB.set("training", `fmd${k}x`, { pid: p.id, memberId: p.memberId || "", name: p.name, mod: m.id, score: 3, total: 5, passed: false, at: at - 3600e3, day: dayKey(new Date(at - 3600e3)), by: p.memberId || "" });
      const score = (k % 3) === 0 ? 4 : 5;
      DB.set("training", `fmd${k}`, { pid: p.id, memberId: p.memberId || "", name: p.name, mod: m.id, score, total: 5, passed: true, at, day: dayKey(new Date(at)), by: p.memberId || "" });
    });
  });
  if (S.resto && !Array.isArray(S.resto.trainingRequired)) { S.resto.trainingRequired = ["froid", "allergenes", "hygiene"]; DB.update("restos", S.rid, { trainingRequired: S.resto.trainingRequired }).catch(() => {}); }
}

/* ───────────── small pieces ───────────── */
const fmAva = (p, s = 40) => (typeof rhAva === "function" ? rhAva(p, s) : `<span class="fm-ava" style="--s:${s}px;--c:${esc(p?.color || "#5B2BFF")}">${esc(initials(p?.name || "?"))}</span>`);
const fmWell = (m, s = 52) => { const [bg, c] = FM_TONES[m.tone] || FM_TONES.vi; return `<span class="fm-well" style="--s:${s}px;--wb:${bg};--wc:${c}">${ico(m.ic)}</span>`; };
const fmDate = (at) => { const d = new Date(at); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
function fmRing(done, total, size = 64) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, f = total ? done / total : 0;
  return `<svg class="fm-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" style="stroke-dasharray:${c};stroke-dashoffset:${c * (1 - f)}"/></svg>`;
}
const fmNext = (pid) => { const pr = fmProgress(pid); const req = fmRequired(); return FM_MODS.find((m) => req.includes(m.id) && !pr.passed[m.id]) || FM_MODS.find((m) => !pr.passed[m.id]) || null; };

/* the card illustrations: drawn from the app's own pieces (fridge LCD, label, chips), never pictures */
function fmViz(c, m) {
  const [bg, col] = FM_TONES[m.tone] || FM_TONES.vi;
  if (c.viz === "lcd") return `<div class="fm-lcd"><span class="lcd">${esc(c.big)}</span></div>`;
  if (c.viz === "steps") return `<ol class="fm-steps${c.items.length > 5 ? " many" : ""}" style="--wb:${bg};--wc:${col}">${c.items.map((x, i) => `<li style="--j:${i}"><b>${i + 1}</b><span>${esc(x)}</span></li>`).join("")}</ol>`;
  if (c.viz === "chips") { const items = c.items || ALLERGENS.map((a) => a.t); return `<div class="fm-chips${items.length > 8 ? " many" : ""}" style="--wb:${bg};--wc:${col}">${items.map((x, i) => `<span style="--j:${i}">${esc(x)}</span>`).join("")}</div>`; }
  if (c.viz === "label") return `<div class="fm-label"><b>Sauce tomate maison</b><span><em>Fabriquée le</em><i class="lcd">05/11</i></span><span><em>À utiliser avant</em><i class="lcd">08/11</i></span><u>Inès · lot 1105-2</u></div>`;
  if (c.viz === "seal") return `<div class="fm-seal"><span>FR</span><b class="lcd">69.123.456</b><span>CE</span></div>`;
  if (c.viz === "vs") return `<div class="fm-vs"><div class="to"><b>DLC</b><em>« À consommer jusqu'au »</em><span>Dépassée : on jette</span></div><div class="sa"><b>DDM</b><em>« De préférence avant »</em><span>Dépassée : encore bon</span></div></div>`;
  if (c.viz === "levels") return `<div class="fm-levels">${FM_LEVELS.map(([t, k], i) => `<span class="${k}" style="--j:${i}"><i>${"●".repeat(4 - i)}</i>${esc(t)}</span>`).join("")}</div>`;
  return `<div class="fm-big">${fmWell({ ic: c.ic || m.ic, tone: m.tone }, 96)}</div>`;
}

/* ═══════════════════════ HOME ═══════════════════════ */
TAB_OF.formation = "more";
function fmModCard(m, i, pr, req) {
  const r = pr.passed[m.id]; const must = req.includes(m.id) && !r;
  return `<button class="glass fm-mod st${r ? " done" : ""}${must ? " must" : ""}" style="--i:${i + 4}" data-act="fmOpen" data-id="${m.id}">
    ${fmWell(m, 50)}<span class="fm-mod-t"><b>${esc(m.t)}</b><em>${m.cards.length} cartes · 5 questions · 2 min</em></span>
    ${r ? `<span class="pill ok">${r.score}/${r.total}</span>` : must ? `<span class="pill warn">Obligatoire</span>` : `<span class="fm-go">${ico("chev")}</span>`}</button>`;
}
function fmTeamHTML() {
  const ppl = fmPeople(); const req = fmRequired(); const boss = fmIsBoss();
  const rows = ppl.map((p, i) => {
    const pr = fmProgress(p.id); const pct = Math.round(pr.done / pr.total * 100);
    return `<button class="fm-pr st" style="--i:${i + 4}" data-act="fmPerson" data-id="${esc(p.id)}">${fmAva(p, 44)}
      <span class="fm-pr-t"><b>${esc(p.name)}</b><span class="fm-bar"><i style="width:${pct}%"></i></span><em>${pr.done} module${pr.done > 1 ? "s" : ""} sur ${pr.total}</em></span>
      ${pr.missing.length ? `<span class="pill warn">${pr.missing.length} à faire</span>` : pr.done === pr.total ? `<span class="pill ok">Complet</span>` : ""}${ico("chev")}</button>`;
  }).join("");
  const reqCard = `<div class="glass fm-req st" style="--i:${ppl.length + 6}"><div class="fm-req-h"><span class="fm-well" style="--s:44px;--wb:#FFF3D6;--wc:#7A5A1A">${ico("star")}</span><div><b class="h3">Obligatoires à l'arrivée</b><em>Chaque nouvel employé les voit en premier.</em></div></div>
    <div class="fm-req-l">${FM_MODS.map((m) => { const on = req.includes(m.id); return `<button class="fm-tg${on ? " on" : ""}" ${boss ? `data-act="fmReq" data-id="${m.id}"` : "disabled"} role="switch" aria-checked="${on}"><span class="fm-tg-t">${ico(m.ic)}${esc(m.t)}</span><i></i></button>`; }).join("")}</div>
    ${boss ? "" : `<p class="note">Seul le gérant peut les changer.</p>`}</div>`;
  return `${ppl.length ? `<div class="glass fm-team st" style="--i:3">${rows}</div>` : `<div class="glass empty st" style="--i:3"><span class="ic">${ico("users")}</span><b>Pas encore d'équipe</b>Ajoutez vos employés : leur progression s'affichera ici.</div>`}${reqCard}`;
}
function fmHomeHTML() {
  fmWatch(); fmSeed();
  const pid = fmWho(); const p = fmPerson(pid); const pr = fmProgress(pid); const req = fmRequired(); const nx = fmNext(pid); const mgr = fmIsMgr();
  const many = fmPeople().length > 1 && fmIsMgr();
  const hero = `<div class="fm-hero wall st" style="--i:1">
    <div class="fm-hero-t"><button class="fm-who" data-act="fmWhoPick" ${many ? "" : "disabled"} aria-label="Changer de personne">${fmAva(p, 30)}<span>${esc(firstName(p.name) || "Moi")}</span>${many ? ico("down") : ""}</button>
      <span class="fm-hero-n"><b class="mono">${pr.done}</b>/${pr.total}</span></div>
    <div class="fm-hero-big">${pr.done === pr.total ? "Formation complète, bravo !" : pr.missing.length ? `${pr.missing.length} module${pr.missing.length > 1 ? "s" : ""} obligatoire${pr.missing.length > 1 ? "s" : ""} à faire` : pr.done ? "On continue ?" : "2 minutes par module"}</div>
    <div class="fm-dots" aria-hidden="true">${FM_MODS.map((m) => `<i class="${pr.passed[m.id] ? "on" : req.includes(m.id) ? "req" : ""}"></i>`).join("")}</div>
    ${nx ? `<button class="fm-cta" data-act="fmOpen" data-id="${nx.id}">${ico(nx.ic)}<span>${pr.done ? "Continuer" : "Commencer"} : ${esc(nx.t)}</span>${ico("chev")}</button>` : `<button class="fm-cta" data-act="fmPrint" data-id="${esc(pid)}">${ico("printer")}<span>Imprimer mon attestation</span></button>`}
  </div>`;
  const seg = mgr ? `<div class="seg fm-seg st" style="--i:2" role="tablist"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${FM.tab === "team" ? 100 : 0}%)"></span><button class="${FM.tab !== "team" ? "on" : ""}" role="tab" data-act="fmTab" data-v="mods">Modules</button><button class="${FM.tab === "team" ? "on" : ""}" role="tab" data-act="fmTab" data-v="team">Équipe</button></div>` : "";
  const mods = [...FM_MODS].sort((a, b) => (req.includes(b.id) && !pr.passed[b.id]) - (req.includes(a.id) && !pr.passed[a.id]));
  const body = mgr && FM.tab === "team" ? fmTeamHTML() : `<div class="fm-mods">${mods.map((m, i) => fmModCard(m, i, pr, req)).join("")}</div>
    ${pr.done ? `<button class="btn soft block fm-att st" style="--i:16" data-act="fmPrint" data-id="${esc(pid)}">${ico("fmMedal")}Voir mon attestation</button>` : ""}`;
  return `<div class="inner fm">${topBar("Formation HACCP")}${hero}${seg}${body}
    <p class="note fm-foot st" style="--i:18">Sensibilisation interne. Elle ne remplace pas la formation hygiène de 14 h exigée pour au moins une personne de l'établissement.</p></div>`;
}

/* ═══════════════════════ PLAYER ═══════════════════════ */
function fmShuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function fmStart(id) {
  const m = FM_BY[id]; if (!m) return null;
  FM.run = { id, phase: "cards", ci: 0, qi: 0, picks: [], order: m.quiz.map((q) => fmShuffle(q[1].map((_, k) => k))), pid: fmWho(), saved: false, rec: null };
  return FM.run;
}
function fmPlayerHTML(id) {
  const m = FM_BY[id]; if (!m) return `<div class="inner">${topBar("Formation HACCP")}<div class="glass empty"><b>Module introuvable</b></div></div>`;
  const R = FM.run && FM.run.id === id ? FM.run : fmStart(id);
  const nC = m.cards.length, nQ = m.quiz.length;
  const segs = [...m.cards.map((_, i) => R.phase !== "cards" || i <= R.ci), ...m.quiz.map((_, i) => R.phase === "done" || (R.phase === "quiz" && i < R.qi + (R.picks[R.qi] != null ? 1 : 0)))];
  const top = `<div class="fm-ptop"><button class="iconbtn" data-act="fmClose" aria-label="Fermer">${ico("x")}</button><div class="fm-prog">${segs.map((on, i) => `<i class="${on ? "on" : ""}${i === nC ? " q" : ""}"></i>`).join("")}</div>${fmWell(m, 40)}</div>`;
  let body = "";
  if (R.phase === "cards") {
    body = `<div class="fm-ph"><span class="fm-k">${esc(m.t)}</span></div>
      <div class="fm-deck" id="fmDeck">${m.cards.map((c, i) => `<article class="fm-card" style="--j:${i}" aria-label="Carte ${i + 1} sur ${nC}">
        <div class="fm-viz">${fmViz(c, m)}</div><div class="fm-ct"><h3 class="h2">${esc(c.t)}</h3>${c.s ? `<p>${esc(c.s)}</p>` : ""}</div></article>`).join("")}</div>
      <div class="fm-pager">${m.cards.map((_, i) => `<i class="${i === R.ci ? "on" : ""}"></i>`).join("")}</div>
      <div class="fm-bot"><button class="btn acc block" data-act="fmNextCard" id="fmNextB">${R.ci >= nC - 1 ? `${ico("sparkle")}Je passe au quiz` : `Suivant${ico("chev")}`}</button></div>`;
  } else if (R.phase === "quiz") {
    const q = m.quiz[R.qi]; const pick = R.picks[R.qi]; const ans = pick != null;
    body = `<div class="fm-ph"><span class="fm-k">Question ${R.qi + 1} sur ${nQ}</span></div>
      <div class="fm-q" id="fmQ"><h3 class="fm-qt">${esc(q[0])}</h3>
        <div class="fm-opts">${R.order[R.qi].map((k, i) => `<button class="fm-opt${ans ? (k === 0 ? " ok" : k === pick ? " ko" : " dim") : ""}" data-act="fmPick" data-v="${k}" ${ans ? "disabled" : ""} style="--j:${i}"><span class="fm-l">${"ABC"[i]}</span><span>${esc(q[1][k])}</span>${ans && k === 0 ? ico("check") : ans && k === pick ? ico("x") : ""}</button>`).join("")}</div>
        ${ans ? `<div class="fm-why ${pick === 0 ? "ok" : "ko"}"><b>${pick === 0 ? FM_YAY[R.qi % FM_YAY.length] : "Pas tout à fait"}</b><span>${esc(q[2])}</span></div>` : ""}
      </div>
      <div class="fm-bot">${ans ? `<button class="btn acc block" data-act="fmNextQ">${R.qi >= nQ - 1 ? "Voir mon score" : `Question suivante${ico("chev")}`}</button>` : `<p class="fm-hint">Touchez une réponse</p>`}</div>`;
  } else {
    const score = R.picks.filter((x) => x === 0).length; const ok = score >= FM_PASS; const p = fmPerson(R.pid); const nx = fmNext(R.pid);
    body = `<div class="fm-done${ok ? " ok" : ""}">
      <div class="fm-score">${fmRing(score, nQ, 150)}<div><b class="mono">${score}</b><span>/${nQ}</span></div></div>
      <h3 class="title">${ok ? (score === nQ ? "Sans faute !" : "Validé !") : "Presque !"}</h3>
      <p class="sub">${ok ? `${esc(m.t)} : validé pour ${esc(firstName(p.name) || "vous")}, attestation enregistrée.` : `Il faut ${FM_PASS} bonnes réponses sur ${nQ}. Relisez les cartes et retentez.`}</p>
      <div class="fm-acts">${ok ? `${nx ? `<button class="btn acc block" data-act="fmOpen" data-id="${nx.id}" data-v="replace">${ico(nx.ic)}Module suivant : ${esc(nx.t)}</button>` : ""}<button class="btn soft block" data-act="fmPrint" data-id="${esc(R.pid)}">${ico("fmMedal")}Voir l'attestation</button>`
        : `<button class="btn acc block" data-act="fmRetry">${ico("swap")}Revoir et recommencer</button>`}<button class="btn ghost" data-act="fmClose">Retour aux modules</button></div></div>`;
  }
  return `<div class="inner narrow fm fm-play ph-${R.phase}">${top}${body}</div>`;
}
const FM_YAY = ["Bien vu !", "Exact !", "Parfait !", "Oui !", "Bravo !"];

VIEWS.formation = {
  get hideTabs() { return !!(S.params && S.params.id); },
  get live() { return !(S.params && S.params.id); },
  render(params) { return params && params.id ? fmPlayerHTML(params.id) : fmHomeHTML(); },
  after(v) {
    const deck = $("#fmDeck", v); if (!deck) return;
    const R = FM.run; if (R && R.ci) deck.scrollLeft = R.ci * deck.clientWidth;
    let t = null;
    deck.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(() => { const i = Math.round(deck.scrollLeft / Math.max(1, deck.clientWidth)); if (FM.run && i !== FM.run.ci) { FM.run.ci = i; fmPagerPaint(v); SFX.tick(); buzz(3); } }, 60); }, { passive: true });
  },
};
function fmPagerPaint(v = $("#viewport .view:not(.leave)")) {
  const R = FM.run; const m = R && FM_BY[R.id]; if (!m || !v) return; const nC = m.cards.length;
  $$(".fm-pager i", v).forEach((e, i) => e.classList.toggle("on", i === R.ci));
  $$(".fm-prog i", v).forEach((e, i) => { if (i < nC) e.classList.toggle("on", i <= R.ci); });
  const b = $("#fmNextB", v); if (b) b.innerHTML = R.ci >= nC - 1 ? `${ico("sparkle")}Je passe au quiz` : `Suivant${ico("chev")}`;
}
async function fmSave(R) {
  if (R.saved) return; R.saved = true; const m = FM_BY[R.id]; const p = fmPerson(R.pid); const score = R.picks.filter((x) => x === 0).length; const passed = score >= FM_PASS;
  const doc = { pid: R.pid, memberId: p.memberId || (R.pid.startsWith("m_") ? R.pid.slice(2) : ""), name: p.name || S.me.name || "", mod: R.id, score, total: m.quiz.length, passed, at: Date.now(), day: dayKey(), by: S.me.id };
  try { R.rec = await DB.add("training", doc); } catch (e) { console.warn(e); }
  if (passed && typeof logEvent === "function") { try { logEvent("formation", `a validé le module « ${m.t} » (${score}/${m.quiz.length})${p.memberId && p.memberId !== S.me.id ? ` pour ${firstName(p.name)}` : ""}`, { ref: R.rec }); } catch (e) {} }
}

/* ═══════════════════════ attestation (print) ═══════════════════════ */
function fmPrint(pid) {
  const p = fmPerson(pid); const pr = fmProgress(pid); const list = FM_MODS.filter((m) => pr.passed[m.id]);
  let el = $("#fmPrint"); if (!el) { el = document.createElement("div"); el.id = "fmPrint"; document.body.appendChild(el); }
  const today = fmDate(Date.now());
  el.innerHTML = `<div class="fmp">
    <div class="fmp-h">${typeof restoMark === "function" && restoLogo() ? `<span class="fmp-mk fmp-rl">${restoMark(40)}</span>` : `<span class="fmp-mk">${typeof logoMark === "function" ? logoMark({ mono: "#5B2BFF" }) : ""}</span>`}<div><b>${esc(S.resto?.name || "")}</b><span>Sensibilisation à l'hygiène alimentaire</span></div></div>
    <h1>Attestation de formation</h1>
    <p class="fmp-lead">L'établissement <b>${esc(S.resto?.name || "")}</b> atteste que <b>${esc(p.name || "")}</b> a suivi et validé les modules suivants (quiz de 5 questions, 4 bonnes réponses minimum) :</p>
    <table><thead><tr><th>Module</th><th>Validé le</th><th>Score</th></tr></thead><tbody>
      ${list.map((m) => { const r = pr.passed[m.id]; return `<tr><td>${esc(m.t)}</td><td>${fmDate(r.at)}</td><td>${r.score}/${r.total}</td></tr>`; }).join("") || `<tr><td colspan="3">Aucun module validé pour l'instant.</td></tr>`}
    </tbody></table>
    <p class="fmp-sum">${list.length} module${list.length > 1 ? "s" : ""} validé${list.length > 1 ? "s" : ""} sur ${FM_MODS.length}.</p>
    <div class="fmp-sig"><div><span>Le salarié</span></div><div><span>Le responsable</span></div></div>
    <p class="fmp-f">Fait le ${today}. Sensibilisation interne réalisée avec Growth Gusto : elle complète, sans la remplacer, la formation spécifique en hygiène alimentaire (14 h) exigée pour au moins une personne de l'établissement (décret n° 2011-731).</p>
  </div>`;
  document.documentElement.classList.add("fm-printing"); SFX.print ? SFX.print() : SFX.tap();
  setTimeout(() => { try { window.print(); } catch (e) {} }, 80);
}
window.addEventListener("afterprint", () => document.documentElement.classList.remove("fm-printing"));

/* person sheet (gérant): modules, dates, scores, attempts */
function fmPersonSheet(pid) {
  const p = fmPerson(pid); const pr = fmProgress(pid); const req = fmRequired();
  const tries = (mid) => fmRows().filter((r) => r.pid === pid && r.mod === mid).length;
  return `<div class="fm-ps"><div class="fm-ps-h">${fmAva(p, 56)}<div><div class="h2">${esc(p.name)}</div><div class="sub">${pr.done} module${pr.done > 1 ? "s" : ""} validé${pr.done > 1 ? "s" : ""} sur ${pr.total}${pr.missing.length ? ` · ${pr.missing.length} obligatoire${pr.missing.length > 1 ? "s" : ""} à faire` : ""}</div></div></div>
    <div class="fm-ps-l">${FM_MODS.map((m) => { const r = pr.passed[m.id]; const n = tries(m.id); return `<div class="fm-ps-r${r ? " ok" : ""}">${fmWell(m, 36)}<span class="t"><b>${esc(m.t)}</b><em>${r ? `Validé le ${fmDate(r.at)}${n > 1 ? ` · ${n} essais` : ""}` : n ? `${n} essai${n > 1 ? "s" : ""}, pas encore validé` : "Pas commencé"}</em></span>${r ? `<span class="pill ok">${r.score}/${r.total}</span>` : req.includes(m.id) ? `<span class="pill warn">Obligatoire</span>` : ""}</div>`; }).join("")}</div>
    <button class="btn acc block" data-act="fmPrint" data-id="${esc(pid)}" ${pr.done ? "" : "disabled"}>${ico("printer")}Imprimer l'attestation</button>
  </div>`;
}

/* ═══════════════════════ actions ═══════════════════════ */
Object.assign(ACT, {
  fmTab: (a, id, v) => { if (FM.tab === v) return; const seg = a.closest(".seg"); const i = [...$$("button", seg)].indexOf(a); $(".knob", seg).style.transform = `translateX(${i * 100}%)`; $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); SFX.tick(); buzz(4); setTimeout(() => { FM.tab = v; rerender(); }, 160); },
  fmOpen: (a, id, v) => { if (!FM_BY[id]) return; SFX.tap(); buzz(5); fmStart(id); go("formation", { id }, { replace: v === "replace" }); },
  fmClose: () => { SFX.tap(); FM.run = null; if (S.history.length && S.history[S.history.length - 1].route === "formation") goBack(); else go("formation", {}, { replace: true, back: true }); },
  fmNextCard: () => {
    const R = FM.run; const m = R && FM_BY[R.id]; if (!m) return;
    if (R.ci >= m.cards.length - 1) { R.phase = "quiz"; R.qi = 0; SFX.ok(); buzz(8); rerender(); const v = $("#viewport .view:not(.leave)"); if (v) { v.classList.remove("nost"); v.scrollTop = 0; } return; }
    const deck = $("#fmDeck"); R.ci++; SFX.tick(); buzz(4); if (deck) deck.scrollTo({ left: R.ci * deck.clientWidth, behavior: "smooth" }); fmPagerPaint();
  },
  fmPick: (a, id, v) => {
    const R = FM.run; const m = R && FM_BY[R.id]; if (!m || R.picks[R.qi] != null) return; const k = +v; R.picks[R.qi] = k;
    if (k === 0) { SFX.ok(); buzz(10); const r = a.getBoundingClientRect(); setTimeout(() => burstSmall(r.left + r.width / 2, r.top + r.height / 2), 60); } else { SFX.err(); buzz([30, 50, 30]); }
    rerender(); const q = $("#fmQ"); if (q && k !== 0) { q.classList.remove("shake"); void q.offsetWidth; q.classList.add("shake"); }
  },
  fmNextQ: () => {
    const R = FM.run; const m = R && FM_BY[R.id]; if (!m) return;
    if (R.qi < m.quiz.length - 1) { R.qi++; SFX.tick(); buzz(4); rerender(); return; }
    R.phase = "done"; fmSave(R); rerender(); const score = R.picks.filter((x) => x === 0).length;
    if (score >= FM_PASS) { SFX.done(); buzz([10, 40, 10, 40, 20]); setTimeout(() => { burst(window.innerWidth / 2, window.innerHeight / 3); setTimeout(() => burst(window.innerWidth / 2, window.innerHeight / 3.4), 260); }, 200); } else { SFX.err(); buzz(20); }
  },
  fmRetry: () => { const R = FM.run; if (!R) return; fmStart(R.id); FM.run.pid = R.pid; SFX.tap(); rerender(); },
  fmPrint: (a, id) => { closeSheet(true); fmPrint(id || fmWho()); },
  fmPerson: (a, id) => { if (!fmIsMgr()) return; SFX.tap(); openSheet(fmPersonSheet(id)); },
  fmWhoPick: () => {
    const ppl = fmPeople(); if (ppl.length < 2 || !fmIsMgr()) return; SFX.tap(); const cur = fmWho();
    openSheet(`<div class="h2">Qui suit la formation ?</div><p class="sub">Le score est enregistré au nom de cette personne.</p><div class="fm-whos">${ppl.map((p) => { const pr = fmProgress(p.id); return `<button class="fm-whob${p.id === cur ? " on" : ""}" data-act="fmWhoSet" data-id="${esc(p.id)}">${fmAva(p, 48)}<b>${esc(firstName(p.name))}</b><em>${pr.done}/${pr.total}</em></button>`; }).join("")}</div>`);
  },
  fmWhoSet: (a, id) => { if (!fmIsMgr()) return; FM.who = id; SFX.ok(); buzz(6); closeSheet(true); rerender(); },
  fmReq: async (a, id) => {
    if (!fmIsBoss() || !FM_BY[id]) return; const cur = fmRequired(); const on = !cur.includes(id); const next = on ? [...cur, id] : cur.filter((k) => k !== id);
    a.classList.toggle("on", on); a.setAttribute("aria-checked", String(on)); SFX.tick(); buzz(5);
    if (S.resto) S.resto.trainingRequired = next;
    await safe(DB.update("restos", S.rid, { trainingRequired: next }));
    toast(on ? `« ${FM_BY[id].t} » obligatoire à l'arrivée` : `« ${FM_BY[id].t} » n'est plus obligatoire`, "info");
    setTimeout(rerender, 400);
  },
});
/* keyboard (tablet with keyboard, desktop): arrows move between cards, A/B/C or 1/2/3 answer, Entrée continues */
document.addEventListener("keydown", (e) => {
  if (S.route !== "formation" || !S.params || !S.params.id || !FM.run || $("#sheet").classList.contains("open") || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
  const R = FM.run;
  if (R.phase === "cards") {
    const deck = $("#fmDeck");
    if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); ACT.fmNextCard(); }
    else if (e.key === "ArrowLeft" && R.ci > 0 && deck) { e.preventDefault(); R.ci--; deck.scrollTo({ left: R.ci * deck.clientWidth, behavior: "smooth" }); fmPagerPaint(); SFX.tick(); }
    return;
  }
  if (R.phase === "quiz") {
    const i = { a: 0, b: 1, c: 2, 1: 0, 2: 1, 3: 2 }[String(e.key).toLowerCase()];
    if (i != null && R.picks[R.qi] == null) { const b = $$(".fm-opt")[i]; if (b) { e.preventDefault(); ACT.fmPick(b, null, b.dataset.v); } }
    else if ((e.key === "Enter" || e.key === "ArrowRight") && R.picks[R.qi] != null) { e.preventDefault(); ACT.fmNextQ(); }
  }
});
/* a small sparkle on a right answer (the big confetti is for the result) */
function burstSmall(x, y) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const b = document.createElement("div"); b.className = "burst"; const cols = ["#5B2BFF", "#F6B93B", "#9EF5C4", "#9EC5FF"];
  for (let i = 0; i < 14; i++) { const s = document.createElement("i"); const ang = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60; s.style.left = x + "px"; s.style.top = y + "px"; s.style.background = cols[i % cols.length]; s.style.setProperty("--x", Math.cos(ang) * d + "px"); s.style.setProperty("--y", Math.sin(ang) * d + 30 + "px"); s.style.setProperty("--r", Math.random() * 360 + "deg"); if (i % 2) s.style.borderRadius = "50%"; b.appendChild(s); }
  document.body.appendChild(b); setTimeout(() => b.remove(), 1200);
}
