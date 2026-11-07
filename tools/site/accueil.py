"""Les fonctions présentées sur la page d'accueil de growthgusto.fr (section « Fonctionnalités », pastilles, données SEO).

C'est ici, et seulement ici, qu'on écrit le texte d'une fonction de l'accueil. Chaque FONCTION dit à quel(s) écran(s) de l'app
elle correspond (app=, l'identifiant de la route dans NAV : js/core.js ou le module qui s'y ajoute). Au moment de construire le
site (python3 tools/site/build.py, lancé aussi à chaque mise en ligne) :
  - une fonction dont plus aucun écran n'existe dans l'app disparaît toute seule de l'accueil (et un groupe vide aussi) ;
  - un écran de l'app qui n'a aucune fonction ici, ni page dans content_features.py, fait échouer la vérification
    (python3 tools/site/check.py, lancée sur chaque PR) : il faut écrire son texte avant que la PR parte en ligne.

Ordre = ordre d'affichage. pack= SECOND ou CHEF (rien = tous les packs). lien= EN_DIRECT, PAR_IMPORT ou BIENTOT, à n'utiliser
que pour ce qui est vraiment relié (règle de Marceau : être honnête sur ce qui est branché). HTML permis dans titre/texte/points ;
mettre &nbsp; avant « : ; ? ! » et à l'intérieur des guillemets. img = capture site/img/<img>.jpg (600×1382, voir
tools/landing-statusbar.py).
"""
SECOND, CHEF = "Pack Second", "Pack Chef"
EN_DIRECT, PAR_IMPORT, BIENTOT = ("it-live", "En direct"), ("it-imp", "Par import"), ("it-soon", "Bientôt")

GROUPES = []

def GROUPE(gid, couleur, sur_titre, titre, chapo, inverse=False):
    GROUPES.append(dict(id=gid, c=couleur, kick=sur_titre, t=titre, lede=chapo, rev=inverse, f=[]))

def FONCTION(fid, *, app, img, titre, texte, points, pack=None, lien=None):
    if not GROUPES:
        raise SystemExit("accueil.py : FONCTION avant le premier GROUPE")
    GROUPES[-1]["f"].append(dict(id=fid, app=[app] if isinstance(app, str) else list(app), img=img, t=titre, p=texte, ul=list(points), pack=pack, lien=lien))

# ─── Températures et frigos
GROUPE('g-temp', 'v', 'Tous les jours', 'Températures et frigos', 'Les relevés se font presque tout seuls.', inverse=False)
FONCTION('releve',
    app='releve',
    img='releve',
    titre='Relevés de températures',
    texte="Midi et soir, l'app vous dit quel frigo relever. Un chiffre, un tap, c'est noté, avec le prénom et l'heure.",
    points=['Seuil par équipement&nbsp;: 0 à 4 °C, -18 °C',
        "Hors seuil&nbsp;: l'action corrective est demandée",
        'Photo du thermomètre, si vous voulez',
        'Relevés du midi et du soir, jour par jour'])
FONCTION('saisie',
    app='releve',
    img='saisie',
    titre='À la voix ou à la sonde Bluetooth',
    texte='Dites «&nbsp;chambre froide, 2,5&nbsp;»&nbsp;: le relevé se remplit. Ou piquez avec un thermomètre Bluetooth, la valeur arrive toute seule.',
    points=['Bouton «&nbsp;Dicter&nbsp;», les mains restent libres',
        'Thermomètre-sonde Bluetooth',
        'Aussi pour la réception des livraisons'])
FONCTION('sondes',
    app='sondes',
    img='sondes',
    titre='Sondes sans fil',
    lien=EN_DIRECT,
    texte='Une sonde dans chaque frigo&nbsp;: la température remonte jour et nuit, et les relevés du midi et du soir s&#x27;écrivent sans vous.',
    points=['Shelly, SensorPush, Govee, UbiBot',
        'LoRaWAN&nbsp;: Milesight, TTN, ChirpStack',
        'Courbe des dernières 24 h, batterie, signal',
        'Ajout pas à pas dans l&#x27;app'])
FONCTION('alertes',
    app='alertes',
    img='alertes',
    titre='Alertes par e-mail',
    texte='Un frigo qui chauffe, un relevé oublié, une DLC dépassée&nbsp;: vous recevez un e-mail. Le lundi matin, le bilan de la semaine.',
    points=['Températures hors seuil',
        'Relevés oubliés',
        'DLC et obligations qui arrivent',
        'Rapport de la semaine le lundi'])
FONCTION('frigo',
    app='frigos',
    img='frigo',
    titre='Frigos et chambre froide',
    texte='Ce qu&#x27;il y a dans chaque frigo, avec les DLC qui arrivent.',
    points=['Frigos, congélateurs, chambres froides',
        'DLC dépassée signalée en rouge',
        'Historique des températures'])

# ─── Hygiène et traçabilité
GROUPE('g-hygiene', 's', 'À chaque service', 'Hygiène et traçabilité', "Ce que l'équipe fait à chaque service, en un tap.", inverse=True)
FONCTION('service',
    app='service',
    img='service',
    titre='Mise en place et fin de service',
    texte='Le matin, sortez les produits de la chambre froide. Le soir, l&#x27;app vous dit quoi remettre.',
    points=['Un tap ou un scan pour déplacer',
        'Temps passé hors chambre froide suivi',
        '«&nbsp;Tout remettre&nbsp;» en un bouton'])
FONCTION('reception',
    app='reception',
    img='reception',
    titre='Réception des livraisons',
    texte='Touchez le fournisseur, contrôlez les produits, photographiez l&#x27;étiquette.',
    points=['Température à cœur à la livraison',
        'Photo de l&#x27;étiquette sanitaire',
        'Refus et non-conformités tracés'])
FONCTION('imprimante',
    app=['imprimante', 'scan'],
    img='imprimante',
    titre='Étiquettes DLC et QR',
    texte='Imprimez l&#x27;étiquette du produit ouvert ou préparé. Le QR se scanne pour tout retrouver.',
    points=['Brother QL-810Wc en Wi-Fi (AirPrint)',
        'Scan du QR à la porte du frigo',
        'Unités au choix&nbsp;: kg, L, pièce, douzaine ou la vôtre'])
FONCTION('menage',
    app='menage',
    img='menage',
    titre='Plan de nettoyage',
    texte='Chaque tâche a son jour, sa fiche «&nbsp;comment faire&nbsp;» et la signature de qui l&#x27;a faite.',
    points=['Vue du jour, de la semaine, plan complet',
        'Retards signalés',
        'Photo de preuve possible'])
FONCTION('hygiene',
    app='hygiene',
    img='hygiene',
    titre='Refroidissement, friture, gaspillage',
    texte='Les autres enregistrements d&#x27;hygiène, au même endroit.',
    points=['Refroidissement rapide chronométré',
        'Suivi de l&#x27;huile de friture',
        'Gaspillage, en euros',
        'Documents&nbsp;: attestations, analyses, contrats'])

# ─── Recettes, allergènes et formation
GROUPE('g-cuisine', 'l', 'En cuisine', 'Recettes, allergènes et formation', 'Le savoir de la cuisine, au même endroit.', inverse=False)
FONCTION('fiche',
    app='notes',
    img='fiche',
    titre='Fiches recettes et allergènes',
    texte='Les 14 allergènes sont calculés depuis les ingrédients. En salle, on répond au client tout de suite.',
    points=['Fiche recette et portions',
        'Tableau des allergènes de la carte',
        'Ingrédients reliés au stock'])
FONCTION('noteProc',
    app='notes',
    img='noteProc',
    titre='Process HACCP par plat',
    texte='Le diagramme de fabrication de chaque plat, de la réception au stockage.',
    points=['Points critiques&nbsp;: ≥ 63 °C à cœur',
        'Refroidissement de 63 °C à 10 °C en moins de 2 h',
        'Export en PDF'])
FONCTION('notes',
    app='notes',
    img='notes',
    titre='Procédures et notes',
    texte='Ouverture, fermeture, consignes&nbsp;: l&#x27;équipe trouve tout en cherchant un mot.',
    points=['Procédures pas à pas',
        'Recherche par plat ou ingrédient',
        'Partagé avec toute l&#x27;équipe'])
FONCTION('formation',
    app='formation',
    img='formation',
    titre='Formation HACCP',
    texte='Des mini-formations de deux minutes pour l&#x27;équipe&nbsp;: chaîne du froid, DLC, étiquetage, allergènes.',
    points=['Cartes et questions courtes',
        'Suivi par employé',
        'Attestation à imprimer'])

# ─── Contrôle sanitaire
GROUPE('g-controle', 'k', 'Le jour du contrôle', 'Contrôle sanitaire', 'Tout est enregistré. Le dossier sort en un tap.', inverse=True)
FONCTION('controle',
    app='controle',
    img='controle',
    titre='Mode contrôle sanitaire',
    texte='L&#x27;inspecteur de la DDPP arrive&nbsp;? Ouvrez le mode contrôle&nbsp;: tout est rangé par thème, le dossier complet sort en PDF.',
    points=['7 jours, 30 jours, 3 mois ou vos dates',
        'Températures, traçabilité, réceptions, nettoyage',
        'Dossier complet en PDF'])
FONCTION('pms',
    app='controle',
    img='pms',
    titre='Plan de maîtrise sanitaire',
    texte='Répondez à 15 questions simples&nbsp;: l&#x27;app rédige votre PMS avec vos propres données. Vous le modifiez section par section.',
    points=['Prérempli&nbsp;: frigos, fournisseurs, recettes',
        'Références du Paquet hygiène',
        'PDF à imprimer'])
FONCTION('rappel',
    app='rappel',
    img='rappel',
    titre='Rappel de lot',
    texte='Un fournisseur rappelle un produit&nbsp;? Tapez le numéro de lot&nbsp;: l&#x27;app retrouve la livraison, le stock et les plats concernés.',
    points=['Recherche par lot ou par produit',
        'Produits bloqués en un tap',
        'Fiche de retrait à imprimer'])
FONCTION('registre',
    app='registre',
    img='registre',
    titre='Registre HACCP',
    texte='Qui a fait quoi, et quand. Rien ne s&#x27;efface.',
    points=['Taux de conformité sur 30 jours',
        'Filtre sur les non-conformités',
        'Températures, réceptions, ménage, traçabilité'])
FONCTION('regReport',
    app='registre',
    img='regReport',
    titre='Rapport de la période',
    texte='Choisissez la période, l&#x27;app prépare le rapport à montrer à l&#x27;inspecteur.',
    points=['7 jours, 30 jours ou vos dates',
        'PDF à imprimer ou CSV',
        'Non-conformités et actions correctives'])
FONCTION('obligations',
    app=['obligations', 'documents'],
    img='obligations',
    titre='Obligations et contrôles',
    texte='Extincteurs, dératisation, hotte, électricité&nbsp;: l&#x27;app prévient avant l&#x27;échéance.',
    points=['Prestataire et dernier passage',
        'Rappel avant la date',
        'En retard&nbsp;: signalé sur l&#x27;accueil'])

# ─── Réservations, commandes et cuisine
GROUPE('g-salle', 'r', 'En salle', 'Réservations, commandes et cuisine', 'De la réservation au bon en cuisine, sans commission par couvert.', inverse=False)
FONCTION('resa',
    app=['resa', 'plan'],
    img='resa',
    titre='Carnet de réservations',
    pack=SECOND,
    texte='Le midi et le soir, toutes les réservations au même endroit. Un appel&nbsp;? La réservation se note en quelques secondes.',
    points=['Demandes à valider ou à refuser',
        'Plan de salle&nbsp;: tables libres, réservées, installées',
        'Couverts du jour et de la semaine',
        'Fiche client&nbsp;: visites, notes'])
FONCTION('coupdefeu',
    app='coupdefeu',
    img='resa',
    titre='Coup de feu calé sur les réservations',
    pack=SECOND,
    texte="Pendant le service, l'app passe en vue coup de feu&nbsp;: gros boutons, l'essentiel pour chacun. Elle s'allume 15 minutes avant la première réservation et s'éteint 45 minutes après la dernière, avec le bilan du service.",
    points=['Salle&nbsp;: plats prêts, tables, arrivées',
        'Cuisine&nbsp;: bons en cours, ruptures, relevés',
        'Gérant&nbsp;: couverts, temps en cuisine, retards',
        "Ou lancé d'un geste depuis l'accueil"])
FONCTION('reserver',
    app='resa',
    img='reserver',
    titre='Lien de réservation pour vos clients',
    pack=SECOND,
    texte='Un lien à mettre sur Google, Instagram ou votre site. Le client choisit le jour, l&#x27;heure et le nombre de couverts.',
    points=['Confirmation automatique ou validation par vous',
        'E-mail de confirmation au client',
        'Rappel par e-mail la veille',
        'Liste d&#x27;attente quand c&#x27;est complet'])
FONCTION('zenchef',
    app='resa',
    img='zenchef',
    titre='Réservations Zenchef et TheFork',
    pack=SECOND,
    lien=PAR_IMPORT,
    texte='Vous gardez votre outil de réservation&nbsp;? Chaque e-mail de réservation, modification ou annulation est repris tout seul dans votre carnet et sur le plan de salle.',
    points=['Une adresse e-mail à vous, à mettre dans Zenchef',
        'Ou import du fichier des réservations',
        'Passer à nos réservations quand vous voulez'])
FONCTION('salle',
    app='salle',
    img='salle',
    titre='Prise de commande au téléphone',
    pack=SECOND,
    texte="Le serveur touche la table sur le plan de salle, ajoute les plats, les cuissons et les allergies du client, puis envoie en cuisine. Suite par suite. Quand la cuisine l'appelle, son téléphone sonne.",
    points=['Plats en rupture&nbsp;: «&nbsp;Il reste 7&nbsp;» sous les yeux, «&nbsp;Épuisé&nbsp;» bloqué',
        'Tables accolées pour les grandes tablées, séparées en un geste',
        "Alerte si un plat contient l'allergie du client",
        '«&nbsp;La cuisine vous appelle&nbsp;» avec une sonnette',
        'Addition à encaisser sur votre caisse'])
FONCTION('cuisine',
    app='cuisine',
    img='cuisine',
    titre='Écran cuisine',
    pack=SECOND,
    texte='Une tablette au passe&nbsp;: les bons de la salle et du menu QR arrivent ensemble, avec le numéro de table, un minuteur et les allergies en rouge.',
    points=['«&nbsp;Table 8 · Commande QR&nbsp;» sur le bon',
        'Lancer, prêt, à suivre',
        "Rappeler le serveur d'un tap",
        'Disponible, limité à N portions ou épuisé',
        'Filtre cuisine ou bar, carillon à chaque bon'])
FONCTION('menuqr',
    app='commandes',
    img='menu-qr',
    titre='Menu QR et commande en ligne',
    pack=SECOND,
    texte='Un QR code sur chaque table et un lien à emporter&nbsp;: le client voit la carte avec photos et allergènes, commande, et peut payer en ligne.',
    points=['Sur place ou à emporter, avec créneaux',
        'Paiement en ligne par Stripe',
        'Suivi de la commande en direct',
        'Sans commission Growth Gusto'])
FONCTION('carte',
    app='commandes',
    img='carte-import',
    titre='Votre carte importée',
    pack=SECOND,
    texte="Donnez le PDF, une photo ou l'adresse de votre site&nbsp;: l'app lit la carte, devine les allergènes et vous laisse tout vérifier avant de publier.",
    points=['Rubriques, prix, descriptions',
        'Allergènes devinés, à confirmer',
        '3 styles, 6 couleurs, photos',
        'Impression A4 de la carte'])
FONCTION('clients',
    app='clients',
    img='clients',
    titre='Fichier clients et fidélité',
    pack=SECOND,
    texte="Chaque client qui réserve ou commande a sa fiche&nbsp;: visites, allergies, anniversaire. Une carte à tampons récompense les habitués, et vous les relancez par e-mail ou SMS, s'ils l'ont accepté.",
    points=['Visites, notes, allergies, VIP',
        'Carte à tampons',
        'Campagnes e-mail et SMS avec consentement',
        'Clients à fêter et à relancer'])
FONCTION('avis',
    app='clients',
    img='clients',
    titre='Avis Google après le repas',
    pack=SECOND,
    texte="Après le dîner, le client reçoit un e-mail «&nbsp;Votre dîner s'est bien passé&nbsp;?&nbsp;» avec le lien vers votre fiche Google. Le soir même ou le lendemain, comme vous voulez.",
    points=['Seulement aux clients venus, qui ont laissé leur e-mail',
        "Une fois par réservation, pas plus d'une fois tous les 4 mois",
        "SMS tout prêt quand il n'y a pas d'e-mail",
        'Nombre de demandes envoyées sur 30 jours'])

# ─── Achats, marges et gaspillage
GROUPE('g-achats', 't', 'Chaque semaine', 'Achats, marges et gaspillage', 'Acheter juste, connaître sa marge, jeter moins.', inverse=True)
FONCTION('marges',
    app='marges',
    img='marges',
    titre='Marge de chaque plat',
    texte='Le food cost de la carte et la marge par assiette, plat par plat. Quand un prix fournisseur monte, vous voyez ce que ça vous coûte par mois.',
    points=['Fiche technique chiffrée, export PDF',
        'Coefficient, TVA, prix conseillé',
        'Hausses de prix et leur coût',
        'Carte en 4 cases&nbsp;: ventes × marge'])
FONCTION('factures',
    app='factures',
    img='factures',
    titre='Factures fournisseurs scannées',
    texte="Une photo ou le PDF de la facture&nbsp;: les lignes sont lues sur votre téléphone, les prix d'achat se mettent à jour et la marge de chaque plat suit.",
    points=["Photo ou PDF, lu sur l'appareil",
        'Lignes reliées au stock',
        'Historique des prix par produit',
        'Dépense ajoutée aux achats'])
FONCTION('achats',
    app='achats',
    img='achats',
    titre='Commandes fournisseurs préparées',
    texte="L'app prépare un bon par fournisseur d'après les couverts attendus, ce que vous consommez et ce qu'il reste en stock. Vous vérifiez, vous envoyez.",
    points=["Calculé sur les réservations et l'historique",
        'Jours de livraison, heure limite, franco',
        'Envoi par e-mail, SMS, WhatsApp ou PDF',
        'Manquants repérés à la réception'])
FONCTION('gaspillage',
    app='gaspillage',
    img='gaspillage',
    titre='Gaspillage en euros',
    texte='Pertes, invendus, produits dont la DLC est passée&nbsp;: tout est chiffré au coût de la recette, avec des pistes pour jeter moins.',
    points=['Jeté du mois, part des achats',
        "Projection sur l'année",
        'Lots à jeter en un geste',
        'Les produits souvent jetés commandés au plus juste'])

# ─── Caisse, stock et chiffres
GROUPE('g-gestion', 's', 'Au bureau', 'Caisse, stock et chiffres', 'Savoir ce que vous avez, ce que vous vendez, ce que vous gagnez.', inverse=False)
FONCTION('caisse',
    app='caisse',
    img='caisse',
    titre='Caisse connectée',
    pack=SECOND,
    texte='Les ventes arrivent toutes seules&nbsp;: chaque plat vendu sort du stock selon sa recette, et le chiffre du jour est prêt.',
    points=['SumUp et Square&nbsp;: en direct',
        'Autres caisses&nbsp;: import du fichier des ventes',
        'Zelty et Lightspeed en direct&nbsp;: bientôt',
        'Ventes reliées aux fiches recettes'])
FONCTION('livraison',
    app='livraison',
    img='livraison',
    titre='Uber Eats, Deliveroo, Just Eat',
    pack=SECOND,
    lien=PAR_IMPORT,
    texte='Déposez le relevé de ventes de chaque plateforme&nbsp;: le chiffre, les commissions et ce qui vous est versé arrivent dans vos finances, le stock est déduit selon vos recettes et vous voyez la vraie marge de chaque plat.',
    points=['Relevé de ventes, par import',
        'Commissions dans les finances',
        'Vraie marge par plat, livraison comprise',
        "Commandes en direct sur l'écran cuisine&nbsp;: bientôt"])
FONCTION('tickets',
    app='tickets',
    img='tickets',
    titre='Ticket Z en photo',
    pack=SECOND,
    texte='Pas de caisse connectée&nbsp;? Photographiez le ticket Z du soir&nbsp;: les ventes déduisent le stock.',
    points=['Ticket long&nbsp;? En plusieurs photos',
        'Chiffre d&#x27;affaires et couverts',
        'Ventes reliées aux recettes'])
FONCTION('frais',
    app='frais',
    img='frais',
    titre='Notes de frais pour vos clients',
    pack=SECOND,
    texte='Un client demande une note pour sa société&nbsp;? «&nbsp;4 repas complets × 37,25&nbsp;€&nbsp;» ou le détail de la table, la TVA ventilée à 10&nbsp;% et 20&nbsp;%, numérotée. Imprimée ou envoyée par e-mail.',
    points=["Depuis l'addition d'une table ou à la main",
        'TVA ventilée par taux',
        'Numérotation qui se suit, annulation tracée',
        'PDF imprimé ou envoyé par e-mail'])
FONCTION('stock',
    app='stock',
    img='stock',
    titre='Stock et inventaire',
    pack=SECOND,
    texte='L&#x27;inventaire du mois se fait en comptant zone par zone. L&#x27;app montre les écarts.',
    points=['Inventaire mensuel guidé',
        'Mouvements et rangement',
        'Valeur du stock et produits à commander'])
FONCTION('dashboard',
    app='dashboard',
    img='dashboard',
    titre='Tableau de bord',
    pack=SECOND,
    texte='Le chiffre du jour, de la semaine, comparé à la semaine d&#x27;avant.',
    points=['Chiffre d&#x27;affaires TTC',
        'Food cost et prime cost',
        'Masse salariale du mois'])
FONCTION('finance',
    app=['finance', 'pennylane'],
    img='finance',
    titre='Finances',
    pack=CHEF,
    texte="Le résultat estimé du mois et les ratios qui comptent, comparés au mois d'avant et à l'an dernier.",
    points=['Résultat estimé (EBE), marge brute',
        'Food cost, masse salariale, prime cost',
        'Lien avec Pennylane, en direct',
        'Export pour le comptable'])
FONCTION('banque',
    app='finance',
    img='banque',
    titre='Dépenses de la banque',
    pack=CHEF,
    lien=PAR_IMPORT,
    texte='Déposez le relevé de votre compte pro&nbsp;: prélèvements, cartes et virements sont rangés par catégorie et comptent dans vos finances.',
    points=['Relevé OFX ou CSV, par import',
        'Catégories apprises au fil des mois',
        'Connexion directe à la banque&nbsp;: bientôt',
        'Lecture seule, aucun paiement possible'])
FONCTION('sites',
    app='sites',
    img='sites',
    titre='Plusieurs restaurants',
    pack=CHEF,
    texte='Passez d&#x27;un établissement à l&#x27;autre et voyez où en est chacun.',
    points=['Un seul compte pour tous vos restaurants',
        'Conformité, relevés et alertes de chacun',
        'Nouvel établissement en un tap'])

# ─── Équipe, pointeuse et planning
GROUPE('g-equipe', 'v', "L'équipe", 'Équipe, pointeuse et planning', 'Chacun son compte, ses horaires, son planning.', inverse=True)
FONCTION('equipe',
    app='equipe',
    img='equipe',
    titre='Comptes de l&#x27;équipe',
    texte='Chaque cuisinier a son compte. Vous voyez qui a fait chaque relevé, chaque étiquette.',
    points=['Utilisateurs illimités',
        'Rôles&nbsp;: gérant, chef, équipe',
        'Invitation par code ou QR'])
FONCTION('consignes',
    app='consignes',
    img='consignes',
    titre="Consignes et messagerie d'équipe",
    texte="Plat du jour, rupture, info du service&nbsp;: la consigne arrive sur le téléphone de ceux qui sont concernés et vous voyez qui l'a lue. La discussion d'équipe a ses groupes, Cuisine, Salle ou ceux que vous créez, sans groupe WhatsApp perso.",
    points=["Groupes Toute l'équipe, Cuisine, Salle, et les vôtres",
        'Consigne pour tout le monde ou pour un groupe',
        'Vous choisissez qui peut publier',
        'Lu, et qui a lu',
        'Dictée vocale et notifications'])
FONCTION('pointeuse',
    app='pointeuse',
    img='pointeuse',
    titre='Pointeuse',
    pack=CHEF,
    texte='Arrivée, pause, départ&nbsp;: chacun touche son prénom.',
    points=['Sur la tablette de la cuisine',
        'Heures du jour et de la semaine',
        'Retards visibles'])
FONCTION('planning',
    app='planning',
    img='planning',
    titre='Planning et heures',
    pack=CHEF,
    texte='Le planning de la semaine, les heures prévues et pointées, avec les repères de la convention HCR.',
    points=['Créneaux par poste',
        'Heures sup. et repos (convention HCR)',
        'Export paie pour le comptable',
        'Coût estimé de la semaine'])
FONCTION('staff',
    app='equipe',
    img='staff',
    titre='Employés et salaires',
    pack=CHEF,
    texte='Contrats, taux horaires et coût réel de chaque employé.',
    points=['Brut et chargé par heure et par mois',
        'Masse salariale comparée au CA',
        'Fiche par employé'])
