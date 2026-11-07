"""Feature pages: /fonctionnalites and /fonctionnalites/<slug>. Honest integration labels: En direct, Par import, Bientôt."""
from build import page, hero, band, card, faq_html, faq_ld, phone, tag, icon, e, btn_try, btn_demo, BASE, APP

N = "&nbsp;"
COMMIS, SECOND, CHEF = "Dès le pack Commis", "Pack Second", "Pack Chef"

FEATURES = [
 dict(slug="haccp-temperatures", short="Relevés de températures", ic="thermo", icc="",
  title="Relevés de températures HACCP et sondes sans fil · Growth Gusto",
  desc="Relevés de températures des frigos en un tap, à la voix ou par sondes sans fil, alertes par e-mail et registre HACCP automatique. Dès 59 € HT par mois.",
  kick="Températures", h1='Les relevés de frigos, <span class="hl">sans y penser.</span>',
  lede="Midi et soir, l'app dit quel frigo relever. Un tap, un chiffre, c'est noté. Avec des sondes sans fil, le relevé s'écrit tout seul et vous êtes prévenu si un frigo chauffe.",
  img="releve", tags=[COMMIS],
  card="Relevés en un tap, à la voix ou par sondes, alertes si un frigo chauffe.",
  blocks=[
   ("Un relevé en un tap", "Chaque frigo, congélateur ou chambre froide a sa plage. L'équipe voit ce qu'il reste à relever, tape la valeur et valide. Si c'est hors seuil, l'app demande l'action corrective tout de suite.", ["Seuils par équipement : 0 à 4 °C, -18 °C…", "Action corrective demandée hors seuil", "Photo du thermomètre si vous voulez", "Prénom et heure sur chaque relevé"], "releve", "v", []),
   ("Des sondes qui relèvent pour vous", "Une petite sonde sans fil dans chaque frigo envoie la température jour et nuit. Les relevés du midi et du soir s'écrivent sans personne, et la courbe des dernières 24 heures est là.", ["Shelly, SensorPush, Govee, UbiBot", "Capteurs LoRaWAN : Milesight, TTN, ChirpStack", "Batterie et signal suivis", "Ajout pas à pas dans l'app"], "sondes", "k", ["En direct"]),
   ("Prévenu quand ça cloche", "Un frigo qui monte, un relevé oublié, une DLC dépassée : un e-mail part tout de suite. Le lundi matin, vous recevez le bilan de la semaine.", ["Températures hors seuil", "Relevés oubliés", "DLC et obligations qui approchent", "Bilan chaque lundi"], "alertes", "s", []),
   ("À la voix ou au thermomètre Bluetooth", "Les mains sont prises ? Dites « chambre froide, 2,5 » et le relevé se remplit. Avec un thermomètre-sonde Bluetooth, la valeur arrive toute seule, aussi à la réception des livraisons.", ["Dictée vocale", "Thermomètre-sonde Bluetooth", "Marche aussi à la réception"], "frigo", "l", ["En direct"]),
  ],
  faq=[("Combien de relevés par jour faut-il faire ?", "La réglementation ne fixe pas de nombre, mais votre plan de maîtrise sanitaire doit prévoir une surveillance régulière. Deux relevés par jour, midi et soir, est la pratique la plus courante. Avec des sondes, la surveillance est continue."),
       ("Quelles sondes sans fil marchent avec Growth Gusto ?", "Shelly, SensorPush, Govee, UbiBot et les capteurs LoRaWAN (Milesight, The Things Network, ChirpStack). Elles se relient en direct. Le matériel n'est pas fourni."),
       ("Et si je n'ai pas de sonde ?", "Aucun problème : l'équipe tape ou dicte la valeur lue sur le thermomètre du frigo. Tout est enregistré de la même façon dans le registre HACCP.")],
  related=["etiquettes-dlc", "controle-sanitaire", "recettes-allergenes"], guides=["temperatures-reglementaires", "normes-haccp-restaurant"]),

 dict(slug="etiquettes-dlc", short="Étiquettes DLC et traçabilité", ic="tag", icc="s",
  title="Étiquettes DLC, traçabilité et réception des livraisons · Growth Gusto",
  desc="Imprimez les étiquettes DLC de vos préparations, scannez le QR, contrôlez les livraisons et suivez la mise en place. Traçabilité HACCP complète dès 59 € HT.",
  kick="Étiquettes et traçabilité", h1='Chaque bac a son étiquette, <span class="hl">chaque lot sa trace.</span>',
  lede="Imprimez l'étiquette du produit ouvert ou préparé, avec sa DLC et un QR code. Contrôlez les livraisons à la porte. Le matin, sortez les produits ; le soir, l'app dit quoi remettre.",
  img="imprimante", tags=[COMMIS],
  card="Étiquettes DLC avec QR, réception des livraisons, mise en place et fin de service.",
  blocks=[
   ("L'étiquette sort du rouleau", "Choisissez le produit ou la préparation : l'app calcule la DLC, ajoute le prénom, la date et un QR code. Une imprimante d'étiquettes Wi-Fi suffit, l'impression passe par AirPrint.", ["DLC calculée automatiquement", "QR code à scanner ensuite", "Imprimantes Wi-Fi AirPrint, rouleaux 62 mm", "DLC dépassée signalée en rouge"], "imprimante", "s", []),
   ("La livraison contrôlée à la porte", "Touchez le fournisseur, vérifiez les produits et leur température, photographiez l'étiquette du lot. Un produit refusé est noté avec la raison.", ["Température et état des produits", "Photo du numéro de lot", "Produits manquants repérés", "Tout rejoint le stock"], "reception", "k", []),
   ("Mise en place et fin de service", "Le matin, un tap ou un scan pour sortir les produits de la chambre froide. Le soir, l'app sait ce qui est dehors et vous dit quoi remettre.", ["Un tap ou un scan pour déplacer", "Temps passé hors chambre froide", "« Tout remettre » en un bouton"], "service", "v", []),
  ],
  faq=[("Quelle imprimante faut-il ?", "Une imprimante d'étiquettes Wi-Fi compatible AirPrint, par exemple la Brother QL-810Wc avec des rouleaux de 62 mm. L'app marche aussi sans imprimante."),
       ("L'étiquetage des préparations maison est-il obligatoire ?", "La traçabilité l'est (règlement CE 178/2002), et votre PMS doit dire comment vous gérez les durées de vie. Étiqueter chaque préparation avec sa date et sa DLC est la façon la plus simple de le prouver. Voir notre <a href=\"/guides/dlc-ddm-etiquetage\">guide DLC et DDM</a>.")],
  related=["haccp-temperatures", "controle-sanitaire", "caisse-stock"], guides=["dlc-ddm-etiquetage", "plan-de-maitrise-sanitaire"]),

 dict(slug="controle-sanitaire", short="Contrôle sanitaire et PMS", ic="shield", icc="k",
  title="Contrôle sanitaire, PMS et registre HACCP · Growth Gusto",
  desc="Le jour du contrôle DDPP, ouvrez le mode contrôle : relevés, traçabilité, nettoyage, PMS rédigé et dossier PDF en un tap. Rappel de lot et obligations suivies.",
  kick="Contrôle sanitaire", h1='Le jour du contrôle, <span class="hl">le dossier est prêt.</span>',
  lede="L'inspecteur arrive ? Ouvrez le mode contrôle : tout est rangé par thème, et le dossier complet sort en PDF. Votre plan de maîtrise sanitaire est rédigé à partir de 15 questions simples.",
  img="controle", tags=[COMMIS],
  card="Mode contrôle, dossier PDF, PMS rédigé pour vous, registre et rappel de lot.",
  blocks=[
   ("Le mode contrôle", "Choisissez la période : températures, traçabilité, réceptions, nettoyage, formations. L'inspecteur voit tout à l'écran, ou vous lui remettez le PDF.", ["7 jours, 30 jours, 3 mois ou vos dates", "Rangé par thème", "Dossier complet en PDF"], "controle", "k", []),
   ("Votre PMS, rédigé pour vous", "Répondez à 15 questions simples sur votre restaurant : l'app rédige le plan de maîtrise sanitaire, avec vos équipements, vos fournisseurs et vos procédures.", ["Bonnes pratiques d'hygiène", "Plan HACCP et points critiques", "Traçabilité et non-conformités", "Mis à jour quand le restaurant change"], "pms", "v", []),
   ("Registre et rappel de lot", "Qui a fait quoi, et quand : rien ne s'efface. Un fournisseur rappelle un produit ? Tapez le numéro de lot, l'app dit où il est et ce qu'il est devenu.", ["Registre horodaté, nominatif", "Recherche par numéro de lot", "Produits à bloquer en un geste"], "rappel", "t", []),
   ("Obligations et contrôles périodiques", "Extincteurs, dératisation, hotte, électricité, formation : l'app prévient avant l'échéance et garde les attestations.", ["Échéances rappelées par e-mail", "Attestations rangées", "Rapport de la période"], "obligations", "s", []),
  ],
  faq=[("Le PMS est-il obligatoire ?", "Oui. Tout restaurant doit pouvoir présenter son plan de maîtrise sanitaire lors d'un contrôle (règlement CE 852/2004). Notre <a href=\"/guides/plan-de-maitrise-sanitaire\">guide du PMS</a> explique ce qu'il contient."),
       ("Le dossier PDF remplace-t-il le classeur papier ?", "Oui : les enregistrements numériques sont acceptés s'ils sont fiables, datés et consultables. Le PDF reprend tout sur la période choisie.")],
  related=["haccp-temperatures", "recettes-allergenes", "etiquettes-dlc"], guides=["controle-sanitaire-ddpp", "plan-de-maitrise-sanitaire"]),

 dict(slug="recettes-allergenes", short="Recettes et allergènes", ic="book", icc="l",
  title="Fiches recettes, 14 allergènes et formation HACCP · Growth Gusto",
  desc="Fiches recettes avec les 14 allergènes calculés, process HACCP par plat, refroidissement, friture, procédures et mini-formations pour l'équipe.",
  kick="Recettes et formation", h1='Le savoir de la cuisine, <span class="hl">au même endroit.</span>',
  lede="Les allergènes de chaque plat sont calculés depuis les ingrédients. En salle, on répond au client tout de suite. Les process HACCP, le refroidissement et les formations sont rangés au même endroit.",
  img="fiche", tags=[COMMIS],
  card="Fiches recettes, 14 allergènes calculés, process HACCP, formation de l'équipe.",
  blocks=[
   ("Fiches recettes et allergènes", "Ingrédients, portions, étapes, photo. Les 14 allergènes réglementaires sont déduits des ingrédients, et le tableau des allergènes de la carte se met à jour tout seul.", ["14 allergènes calculés", "Tableau des allergènes de la carte", "Portions recalculées", "Ingrédients reliés au stock"], "fiche", "l", []),
   ("Le process HACCP de chaque plat", "De la réception au service : chaque étape avec sa limite critique, sa surveillance et son action corrective. Exportable en PDF pour le dossier.", ["Points critiques par plat", "Limites et actions correctives", "Export PDF"], "noteProc", "v", []),
   ("Refroidissement, friture et documents", "Chronométrez le refroidissement rapide, suivez l'huile de friture, rangez attestations et analyses.", ["Refroidissement chronométré", "Huile de friture suivie", "Documents et attestations"], "hygiene", "s", []),
   ("Des formations de deux minutes", "Chaîne du froid, allergènes, lavage des mains : des mini-formations que l'équipe fait sur son téléphone, avec une attestation.", ["Modules courts", "Suivi par personne", "Attestation imprimable"], "formation", "k", []),
  ],
  faq=[("L'information sur les allergènes est-elle obligatoire en restaurant ?", "Oui, par écrit et accessible au client (décret 2015-447). Notre <a href=\"/guides/allergenes-restaurant\">guide des allergènes</a> détaille les 14 allergènes et la façon de les afficher."),
       ("La formation de l'app remplace-t-elle la formation hygiène de 14 heures ?", "Non. La formation obligatoire en hygiène alimentaire se fait auprès d'un organisme. Nos mini-formations aident à garder les bons gestes au quotidien.")],
  related=["controle-sanitaire", "marges-achats", "menu-qr"], guides=["allergenes-restaurant", "refroidissement-rapide", "formation-hygiene-obligatoire"]),

 dict(slug="reservations", short="Réservations et plan de salle", ic="cal", icc="r",
  title="Logiciel de réservation restaurant sans commission et plan de salle · Growth Gusto",
  desc="Carnet de réservations, lien de réservation pour vos clients, plan de salle et placement automatique, sans commission par couvert. Import Zenchef et TheFork.",
  kick="Réservations", h1='Votre carnet de réservations, <span class="hl">sans commission.</span>',
  lede="Midi et soir, toutes les réservations au même endroit. Un lien pour Google, Instagram et votre site. Le plan de salle place les tables tout seul, sans payer par couvert.",
  img="resa", tags=[SECOND],
  card="Carnet, lien de réservation, plan de salle, import Zenchef et TheFork.",
  blocks=[
   ("Le carnet du midi et du soir", "Une réservation par téléphone se note en quelques secondes. Les demandes en ligne arrivent à valider ou à refuser, et le client reçoit un e-mail.", ["Demandes à valider ou refuser", "Couverts du jour et de la semaine", "Fiche client : visites, notes", "E-mail de confirmation au client", "Après le repas : « Votre dîner s'est bien passé ? », le client note d'un geste et publie sur Google"], "resa", "r", []),
   ("Un lien de réservation à vous", "Le client choisit le nombre de personnes, le jour et l'heure. Seules les tables réellement libres sont proposées, et la liste d'attente prend le relais.", ["Sur Google, Instagram, votre site", "Sans compte à créer pour le client", "Liste d'attente", "Aucune commission"], "reserver", "v", []),
   ("Zenchef et TheFork : vous gardez votre outil", "Chaque e-mail de réservation, de modification ou d'annulation est repris dans votre carnet et sur le plan de salle. Ou importez le fichier.", ["Une adresse e-mail à vous", "Import du fichier des réservations", "Passer à nos réservations quand vous voulez"], "zenchef", "k", ["Par import"]),
   ("Le plan de salle vivant", "Salle, terrasse, zones, tables de 1 à 20 places. Le placement automatique enchaîne les tables pour en perdre moins, et assemble 2 ou 3 tables voisines pour une grande tablée.", ["Éditeur de salle", "Curseur horaire et rotation", "Tables assemblées automatiquement ou à la main", "« Accoler une table » et « Séparer » pendant le service"], "salle", "s", []),
   ("Le coup de feu calé sur le carnet", "Pendant le service, l'app passe en vue coup de feu : gros boutons, l'essentiel pour chacun. Elle s'allume 15 minutes avant la première réservation et s'éteint 45 minutes après la dernière, avec le bilan.", ["Salle : plats prêts, tables, arrivées", "Cuisine : bons en cours, ruptures, relevés", "Gérant : couverts, temps en cuisine, retards", "Ou lancé d'un geste depuis l'accueil"], "resa", "k", []),
  ],
  faq=[("Y a-t-il une commission par couvert ?", "Non, aucune. Le carnet, le plan de salle et le lien de réservation sont inclus dans les packs Second et Chef."),
       ("Comment avoir plus d'avis Google ?", "Collez une fois le lien d'avis de votre fiche Google. Après le repas, chaque client venu qui a laissé son e-mail reçoit « Votre dîner s'est bien passé ? » : il touche une étoile, son avis est prêt à coller sur Google, et une note de 3 étoiles ou moins vous arrive d'abord à vous. Le soir même ou le lendemain. Une seule fois par réservation, jamais plus d'une fois tous les 4 mois pour un même client. Sans e-mail, le serveur l'envoie par SMS en un geste."),
       ("Zenchef et TheFork sont-ils reliés en direct ?", "Non, par import : vous transférez les e-mails de réservation vers une adresse Growth Gusto, ou vous importez le fichier. Les réservations arrivent alors dans le carnet et sur le plan de salle.")],
  related=["prise-de-commande", "fidelite-clients", "menu-qr"], guides=[]),

 dict(slug="prise-de-commande", short="Prise de commande et écran cuisine", ic="order", icc="t",
  title="Prise de commande au téléphone et écran cuisine pour restaurant · Growth Gusto",
  desc="Le serveur prend la commande sur son téléphone, la cuisine la reçoit sur une tablette avec minuteurs et allergies en rouge. Ruptures en direct, note de frais (facture avec TVA) depuis l'addition. Sans encaissement dans l'app.",
  kick="Prise de commande", h1='De la table à la cuisine, <span class="hl">en un tap.</span>',
  lede="Le serveur touche la table, ajoute les plats, les cuissons et les allergies, et envoie en cuisine. La cuisine voit les bons arriver avec un minuteur, et prévient quand c'est prêt.",
  img="salle", tags=[SECOND],
  card="Le serveur commande au téléphone, la cuisine reçoit les bons sur tablette.",
  blocks=[
   ("Le serveur commande au téléphone", "Plan de salle ou grille des numéros, couverts, plats de la carte, cuissons, allergies du client. Boissons, entrées, plats, desserts : on envoie suite par suite.", ["Notes de cuisson et allergies", "Alerte si un plat contient l'allergie", "« Envoyer la suite »", "Changer de table, accoler ou séparer des tables"], "salle", "t", []),
   ("Les ruptures sous les yeux du serveur", "En cuisine, chaque plat est Disponible, Limité à quelques portions ou Épuisé. Le serveur voit « Il reste 7 » sur sa commande, son téléphone sonne quand un plat tombe en rupture, et un plat épuisé disparaît du menu QR.", ["Disponible, Limité (N portions), Épuisé", "Bandeau « Il reste » sur la commande", "Vous choisissez quand le compteur baisse : commande, envoi, prêt ou encaissement", "Retiré du menu QR à zéro"], "table", "r", []),
   ("L'écran cuisine", "Une tablette au passe : les bons de la salle et du menu QR arrivent ensemble, avec le numéro de table, un minuteur coloré et les allergies en rouge. Lancer, prêt, à suivre.", ["« Table 8 · Commande QR » sur le bon", "Rappeler le serveur : son téléphone sonne, « La cuisine vous appelle »", "Filtre cuisine ou bar, carillon à chaque bon", "Bon imprimé sur l'imprimante d'étiquettes"], "cuisine", "v", []),
   ("L'écran bar", "Une tablette au comptoir pour les boissons : elles partent de la salle et du menu QR, la cuisine ne voit plus que ses plats. Le total à préparer par boisson, avec le bon verre, et les tables dont les desserts sont lancés, pour proposer les cafés au bon moment.", ["Carillon à chaque boisson, « Prêt » prévient le serveur", "Total à préparer : 6 spritz, 4 cafés…", "Le verre de chaque boisson sur le bon", "Tablette du bar verrouillée en grand écran"], "cuisine", "v", []),
   ("La recette pas à pas, sur le bon", "En cuisine comme au bar, on touche un plat sur le bon : sa fiche s'ouvre en très grand. Les grammages calculés pour le nombre d'assiettes, les étapes une par une avec leur photo, un minuteur d'un geste, et le dressage en photo pour finir.", ["Ce que le serveur a noté, et l'allergie en rouge", "Grammages pour 4 assiettes en un tap", "Minuteur qui sonne même sur un autre écran", "Photo du dressage et contenant (assiette, verre)"], "fiche", "t", []),
   ("La note de frais du client", "Un client paie pour sa société ? Dans l'addition, un interrupteur « Note de frais » : la facture à son nom, « 4 repas complets » ou le détail, la TVA à 10 % et 20 %. Le montant vient de la table, jamais tapé à la main. Imprimée ou envoyée par e-mail.", ["Deux présentations : repas complets ou détail", "TVA ventilée par taux", "Numérotation continue, avoir en cas d’erreur", "Impression, PDF ou e-mail"], "frais", "k", []),
  ],
  faq=[("Peut-on encaisser dans Growth Gusto ?", "Non. L'addition est préparée dans l'app, l'encaissement se fait sur votre caisse habituelle. Encaisser dans l'app demanderait une certification NF525."),
       ("Faut-il du matériel spécial ?", "Non : les téléphones des serveurs et une tablette en cuisine suffisent, plus une au bar si vous le voulez. Une imprimante d'étiquettes peut imprimer les bons."),
       ("Et si le Wi-Fi tombe pendant le service ?", "Le service continue. Le serveur prend ses commandes, la cuisine garde ses bons à l'écran, et tout ce qui a été fait sans réseau part tout seul dès que la connexion revient. Une bulle « Hors ligne » indique ce qui attend, et un téléphone en 4G garde la salle reliée à la cuisine."),
       ("Comment faire une note de frais avec TVA ?", "Dans l'addition de la table, activez « Note de frais » et indiquez la société : quand la table est réglée, la facture est éditée à son nom, « 4 repas complets » ou le détail des plats, avec la TVA à 10 % et 20 %. Numérotation continue, avoir en cas d'erreur, impression ou e-mail. Inclus dans les packs Second et Chef.")],
  related=["menu-qr", "reservations", "caisse-stock"], guides=[]),

 dict(slug="menu-qr", short="Menu QR et commande en ligne", ic="qr", icc="",
  title="Menu QR code et commande en ligne pour restaurant · Growth Gusto",
  desc="Menu QR sur chaque table, commande à emporter avec créneaux, paiement en ligne par Stripe, carte importée depuis votre PDF ou votre site. Sans commission Growth Gusto.",
  kick="Menu QR et commande en ligne", h1='Votre carte en ligne, <span class="hl">commandable.</span>',
  lede="Un QR code sur chaque table et un lien à emporter : le client voit la carte avec photos et allergènes, commande, et peut payer en ligne. Votre carte est importée depuis un PDF, une photo ou votre site.",
  img="menu-qr", tags=[SECOND],
  card="QR code à table, à emporter, paiement en ligne, carte importée en une minute.",
  blocks=[
   ("Le menu QR à table", "Le client scanne, choisit, commande. Le bon arrive sur l'écran cuisine, avec la table. Il suit sa commande en direct. Vous choisissez si le paiement est obligatoire à la commande, au choix du client, ou à la fin du repas : une table pas encore payée s'affiche en gros « À régler » rouge, en cuisine comme en salle.", ["Photos et allergènes", "Paiement obligatoire ou non, au choix", "« À régler » en rouge : aucun oubli"], "menu-qr", "v", []),
   ("À emporter, avec créneaux", "Un lien à partager : le client choisit son heure de retrait et paie en ligne s'il le souhaite. Vous gardez la main sur les créneaux.", ["Créneaux de retrait", "Paiement en ligne par Stripe", "Sans commission Growth Gusto"], "commandes", "s", []),
   ("Votre carte, importée", "Donnez le PDF, une photo ou l'adresse de votre site : l'app lit la carte, devine les allergènes, et vous vérifiez tout avant de publier. Trois styles, six couleurs.", ["PDF, photo ou site web", "Allergènes devinés, à confirmer", "Impression A4"], "carte-import", "l", ["Par import"]),
  ],
  faq=[("Le paiement en ligne est-il obligatoire ?", "C'est vous qui choisissez. À table : paiement obligatoire à la commande, au choix du client, ou à la fin du repas. Le paiement en ligne passe par Stripe, sur votre propre compte."),
       ("Growth Gusto prend-il une commission sur les commandes ?", "Non. Seuls les frais de paiement Stripe s'appliquent si vous activez le paiement en ligne.")],
  related=["prise-de-commande", "recettes-allergenes", "fidelite-clients"], guides=["allergenes-restaurant"]),

 dict(slug="marges-achats", short="Marges, achats et gaspillage", ic="scale", icc="t",
  title="Marge par plat, factures fournisseurs, commandes et gaspillage · Growth Gusto",
  desc="Food cost et marge de chaque plat, factures scannées qui mettent les prix à jour, happy hour et plat du jour automatiques, commandes fournisseurs préparées et gaspillage chiffré en euros.",
  kick="Achats et marges", h1='Acheter juste, <span class="hl">connaître sa marge.</span>',
  lede="Le food cost de la carte et la marge de chaque assiette. Une facture photographiée met les prix à jour. Les commandes fournisseurs se préparent toutes seules, vos fournisseurs sont réunis dans un annuaire, et le gaspillage est chiffré en euros.",
  img="marges", tags=[COMMIS],
  card="Marge par plat, factures scannées, prix dynamiques, commandes et annuaire fournisseurs, gaspillage en euros.",
  blocks=[
   ("La marge de chaque plat", "Food cost de la carte, marge par assiette, coefficient, prix conseillé. Quand un prix fournisseur monte, vous voyez ce que ça coûte par mois.", ["Fiche technique chiffrée, export PDF", "Hausses de prix et leur coût", "Carte en 4 cases : ventes × marge"], "marges", "t", []),
   ("Factures scannées", "Une photo ou le PDF : les lignes sont lues sur votre téléphone, reliées au stock, et les prix d'achat se mettent à jour.", ["Photo ou PDF, lu sur l'appareil", "Historique des prix", "Dépense ajoutée aux achats"], "factures", "s", ["Par import"]),
   ("Prix dynamiques", "Le happy hour se met en route tout seul sur le menu QR, le plat du jour écoule ce qui arrive à date, et une hausse fournisseur vous alerte avec le prix qui rattrape la marge.", ["Happy hour programmé, prix barrés sur le menu QR", "Plat du jour choisi selon les DLC", "Remise plafonnée pour garder votre marge"], "prix", "v", []),
   ("Commandes fournisseurs préparées", "Un bon par fournisseur, calculé sur les couverts attendus, votre consommation et le stock. Vous vérifiez, vous envoyez.", ["Jours de livraison, heure limite, franco", "E-mail, SMS, WhatsApp ou PDF", "Manquants repérés à la réception"], "achats", "v", []),
   ("L'annuaire des fournisseurs", "Le poissonnier, le boucher, la cave : coordonnées, jours et créneau de livraison, heure limite et franco. La commande préparée part en un clic.", ["Appeler, écrire, itinéraire d'un tap", "Livraisons de la semaine d'un coup d'œil", "Achats, hausses de prix, livraisons complètes"], "fournisseurs", "s", []),
   ("Le gaspillage en euros", "Pertes, invendus, DLC passées : tout est chiffré au coût recette, avec des pistes pour jeter moins.", ["Part des achats, projection sur l'année", "Lots à jeter en un geste", "Produits souvent jetés commandés au plus juste"], "gaspillage", "k", []),
  ],
  faq=[("D'où viennent les prix d'achat ?", "De vos factures (photo ou PDF lus sur l'appareil), de la réception des livraisons, ou saisis à la main. L'historique des prix est gardé par produit."),
       ("Les ventes sont-elles prises en compte ?", "Oui, avec une caisse reliée ou un import des ventes (pack Second) : la carte en 4 cases croise ventes et marge."),
       ("Le happy hour s'applique-t-il aussi à ma caisse ?", "Le prix réduit s'applique au menu QR et à la prise de commande de Growth Gusto, et c'est ce prix qui est encaissé en ligne. Sur une autre caisse, programmez la même remise.")],
  related=["caisse-stock", "recettes-allergenes", "finances"], guides=[]),

 dict(slug="caisse-stock", short="Caisse, stock et ventes", ic="box", icc="s",
  title="Caisse connectée, stock et inventaire pour restaurant · Growth Gusto",
  desc="Ventes SumUp et Square en direct, autres caisses et Uber Eats, Deliveroo, Just Eat par import. Stock déduit selon vos recettes, inventaire guidé, tableau de bord.",
  kick="Caisse et stock", h1='Ce que vous vendez sort <span class="hl">du stock, tout seul.</span>',
  lede="Les ventes arrivent de la caisse, chaque plat vendu sort du stock selon sa recette, et le chiffre du jour est prêt. Les plateformes de livraison s'importent avec leurs commissions.",
  img="caisse", tags=[SECOND],
  card="Ventes de la caisse, livraison, stock déduit, inventaire et tableau de bord.",
  blocks=[
   ("La caisse reliée", "Avec SumUp ou Square, les ventes arrivent toutes seules. Avec une autre caisse, importez le fichier des ventes ou photographiez le ticket Z.", ["SumUp et Square : en direct", "Autres caisses : import ou photo du ticket Z", "Zelty et Lightspeed en direct : bientôt"], "caisse", "s", ["En direct", "Par import"]),
   ("Uber Eats, Deliveroo, Just Eat", "Déposez le relevé de ventes : chiffre, commissions et versements vont dans vos finances, le stock est déduit et vous voyez la vraie marge de chaque plat livré.", ["Relevé de ventes, par import", "Commissions dans les finances", "Commandes en direct sur l'écran cuisine : bientôt"], "livraison", "t", ["Par import"]),
   ("Stock et inventaire", "L'inventaire du mois se fait zone par zone. L'app montre les écarts, la valeur du stock et ce qu'il faut commander.", ["Inventaire guidé", "Mouvements et rangement", "Valeur du stock"], "stock", "v", []),
   ("Le tableau de bord", "Le chiffre du jour et de la semaine, comparé à la semaine d'avant, avec le food cost et la masse salariale.", ["Chiffre d'affaires", "Food cost et prime cost", "Couverts"], "dashboard", "k", []),
  ],
  faq=[("Ma caisse est-elle compatible ?", "SumUp et Square se relient en direct. Zelty et Lightspeed arrivent bientôt en direct. Pour toutes les autres caisses, importez le fichier des ventes ou photographiez le ticket Z."),
       ("Uber Eats et Deliveroo sont-ils reliés en direct ?", "Non, par import du relevé de ventes. Les commandes en direct sur l'écran cuisine arrivent bientôt, en option.")],
  related=["marges-achats", "finances", "prise-de-commande"], guides=[]),

 dict(slug="equipe-planning", short="Équipe, planning et pointeuse", ic="users", icc="",
  title="Planning, pointeuse et messagerie d'équipe pour restaurant · Growth Gusto",
  desc="Comptes de l'équipe, consignes et messagerie, défis d'équipe, passation de service, journal des actions, accès temporaires, pointeuse avec ticket d'heures au départ, relevé d'heures en PDF, planning avec repères HCR, employés et salaires, export paie pour le comptable.",
  kick="Équipe", h1='Chacun son compte, <span class="hl">son planning.</span>',
  lede="Chaque cuisinier a son compte : vous voyez qui a fait quoi. Les consignes arrivent sur le téléphone de chacun, les défis motivent la salle. La pointeuse et le planning préparent la paie.",
  img="equipe", tags=[CHEF],
  card="Comptes, consignes, passation, journal des actions, défis, pointeuse, planning HCR.",
  blocks=[
   ("Les comptes de l'équipe", "Utilisateurs illimités, rôles gérant, chef, équipe. Chaque relevé, étiquette ou réception porte un prénom.", ["Utilisateurs illimités", "Rôles et accès", "Invitation par code ou QR"], "equipe", "v", [COMMIS]),
   ("Consignes et messagerie par groupes", "Plat du jour, rupture, info : la consigne arrive chez ceux qu'elle concerne et vous voyez qui l'a lue. La discussion a ses groupes : Toute l'équipe, Cuisine, Salle, et ceux que vous créez.", ["Consigne pour tous ou pour un groupe", "Vous choisissez qui peut publier", "Lu, et qui a lu", "Dictée vocale"], "consignes", "s", [COMMIS]),
   ("Les défis d'équipe", "« 20 desserts ce soir » : vous lancez le défi, les ventes se comptent toutes seules depuis la prise de commande et le menu QR, et le classement bouge en direct. Quand c'est gagné, tous les écrans fêtent la victoire.", ["Desserts, boissons, un plat, chiffre d'affaires, ticket moyen", "Classement en direct par serveur", "Trophées et récompenses"], "defis", "t", [SECOND]),
   ("Passation de service", "En fin de service, un mot pour l'équipe suivante : ruptures, casse, client à rappeler, ce qu'il reste à préparer. L'app reprend la journée pour vous ; l'équipe suivante le lit en arrivant et signe.", ["Repris tout seul de la journée", "Client à rappeler, avec son numéro", "Lu par qui, et à quelle heure"], "passation", "r", [COMMIS]),
   ("Journal des actions", "Qui a annulé, offert ou modifié quoi, et quand, avec le montant. Chaque ligne est signée et rien ne s'efface, pas même par le gérant.", ["Annulations et offerts, avec montant", "Filtres par personne et par type", "« À regarder » quand quelqu'un sort du lot"], "journal", "t", [COMMIS]),
   ("Accès temporaires", "Un extra pour le week-end, un stagiaire pour un mois : vous choisissez la date de fin et l'accès se ferme tout seul. Prolonger ou rouvrir, c'est un geste.", ["Extra, stagiaire, saison, remplacement", "Fin ce soir, cette semaine ou à une date", "Ce qu'ils ont fait reste signé"], "acces", "v", [COMMIS]),
   ("La pointeuse", "Arrivée, pause, départ : chacun touche son prénom sur la tablette. Au départ, ses heures du jour s'affichent et il imprime son ticket s'il le veut.", ["Heures réelles", "Ticket au départ", "Relevé PDF à signer"], "pointeuse", "k", [CHEF]),
   ("Planning et heures", "Le planning de la semaine, les heures prévues et pointées, avec les repères de la convention HCR. Export pour le comptable.", ["Repères HCR", "Heures sup", "Export paie"], "planning", "l", [CHEF]),
  ],
  faq=[("Combien d'utilisateurs ?", "Illimités, dans tous les packs."),
       ("Et pour un extra ou un stagiaire ?", "Vous lui donnez un accès temporaire : vous choisissez la date de fin, et l'accès se ferme tout seul. Ce qu'il a fait reste signé à son nom."),
       ("Le planning calcule-t-il la paie ?", "Il prépare les heures et les éléments variables pour votre comptable. Le bulletin de paie reste fait par votre comptable ou votre logiciel de paie.")],
  related=["finances", "recettes-allergenes", "haccp-temperatures"], guides=["formation-hygiene-obligatoire"]),

 dict(slug="fidelite-clients", short="Fichier clients et fidélité", ic="heart", icc="r",
  title="Fichier clients et carte de fidélité pour restaurant · Growth Gusto",
  desc="Fiche de chaque client, carte à tampons, avis Google après le repas, campagnes e-mail et SMS avec consentement. Inclus dans le pack Second.",
  kick="Clients et fidélité", h1='Vos habitués, <span class="hl">enfin connus.</span>',
  lede="Chaque client qui réserve ou commande a sa fiche : visites, allergies, anniversaire. Une carte à tampons récompense les habitués, et vous les relancez s'ils l'ont accepté.",
  img="clients", tags=[SECOND],
  card="Fiches clients, carte à tampons, avis Google après le repas, campagnes e-mail et SMS.",
  blocks=[
   ("Le fichier clients", "Visites, notes, allergies, VIP. La fiche se remplit avec les réservations et les commandes.", ["Visites et dernière venue", "Allergies et préférences", "Clients à fêter et à relancer"], "clients", "r", []),
   ("Carte à tampons et campagnes", "Une carte de fidélité sans carton à perdre, et des campagnes e-mail ou SMS envoyées seulement aux clients qui ont dit oui.", ["Carte à tampons", "Consentement enregistré", "Désinscription en un clic"], "resa", "v", []),
   ("Plus d'avis Google, en dix secondes", "Après le repas, le client note sa visite d'un geste : depuis l'e-mail « Votre déjeuner s'est bien passé ? », depuis le menu QR une fois servi, ou en scannant le QR « Votre avis » posé sur la table. Content, il trouve son texte déjà copié (ou écrit pour lui) et la page d'avis Google ouverte : il colle, il publie. Déçu, son message arrive d'abord chez vous, avec une réponse prête à envoyer.", ["Étoiles dans l'e-mail, sur le menu QR et sur la table", "« Écrire pour moi » : un avis prêt à coller sur Google", "3 étoiles ou moins : alerte au responsable, réponse en un geste", "Note du mois et part des clients partis sur Google"], "clients", "s", []),
  ],
  faq=[("Est-ce conforme au RGPD ?", "Les campagnes ne partent qu'aux clients qui ont donné leur accord, et chacun peut se désinscrire. Vos données restent à vous, hébergées en France."),
       ("L'avis est-il publié tout seul sur Google ?", "Non : Google ne laisse aucune application publier un avis à la place d'un client. Growth Gusto fait tout le reste : le texte est prêt et copié, la page d'avis de votre fiche s'ouvre, le client colle et publie. Et chaque client peut aller sur Google, même mécontent : Google interdit de ne le proposer qu'aux clients satisfaits.")],
  related=["reservations", "menu-qr", "prise-de-commande"], guides=[]),

 dict(slug="finances", short="Finances et banque", ic="wallet", icc="k",
  title="Finances de restaurant, relevé bancaire et Pennylane · Growth Gusto",
  desc="Résultat estimé du mois, food cost, masse salariale, relevé bancaire par import, lien direct avec Pennylane et plusieurs restaurants dans un seul compte.",
  kick="Finances", h1='Vos chiffres, <span class="hl">sans tableur.</span>',
  lede="Le résultat estimé du mois et les ratios qui comptent. Le relevé bancaire range vos dépenses. Pennylane reçoit les ventes en direct.",
  img="finance", tags=[CHEF],
  card="Résultat du mois, ratios, relevé bancaire, Pennylane, multi-restaurants.",
  blocks=[
   ("Le résultat du mois", "Chiffre d'affaires, marge brute, masse salariale, résultat estimé, comparés au mois précédent et à l'an dernier.", ["Food cost, masse salariale, prime cost", "Comparaison N-1", "Export pour le comptable"], "finance", "k", []),
   ("Les dépenses de la banque", "Déposez le relevé de votre compte pro : prélèvements, cartes et virements sont rangés par catégorie.", ["Relevé OFX ou CSV, par import", "Catégories apprises", "Connexion directe : bientôt"], "banque", "v", ["Par import"]),
   ("Plusieurs restaurants", "Passez d'un établissement à l'autre et voyez où en est chacun, avec un seul compte.", ["49 € HT par restaurant en plus", "Vue de tous les sites"], "sites", "s", []),
  ],
  faq=[("Pennylane est-il relié en direct ?", "Oui : les tickets Z partent en écritures de ventes, et les factures fournisseurs reviennent dans vos finances."),
       ("Ma banque est-elle reliée ?", "Pas encore en direct : vous importez le relevé (OFX ou CSV). La connexion directe arrive bientôt.")],
  related=["marges-achats", "caisse-stock", "equipe-planning"], guides=[]),
]

BY = {f["slug"]: f for f in FEATURES}

def build():
    # hub
    cards = "".join(card(f"/fonctionnalites/{f['slug']}", e(f["short"]), e(f["card"]), f["ic"], f["icc"], [t for t in f["tags"] if t != COMMIS] or ["Tous les packs"], dl=i % 3) for i, f in enumerate(FEATURES))
    words = ["Relevés de températures", "Sondes sans fil", "Étiquettes DLC", "Réception", "Plan de nettoyage", "PMS", "Mode contrôle", "Rappel de lot", "14 allergènes", "Process HACCP", "Formation", "Réservations", "Plan de salle", "Prise de commande", "Écran cuisine", "Menu QR", "Carte importée", "Marge par plat", "Factures scannées", "Happy hour", "Commandes fournisseurs", "Gaspillage", "Caisse", "Uber Eats", "Stock", "Tableau de bord", "Finances", "Pennylane", "Pointeuse", "Planning", "Consignes", "Passation de service", "Journal des actions", "Accès temporaires", "Fidélité"]
    mq = '<div class="mq" aria-hidden="true"><div class="mq-t">' + "".join(f"<span>{w}</span>" for w in words * 2) + "</div></div>"
    body = hero([("/", "Accueil"), ("/fonctionnalites", "Fonctionnalités")], "Fonctionnalités",
                'Tout le restaurant, <span class="hl">une seule app.</span>',
                "De l'hygiène à la salle, du stock aux chiffres : douze grands usages, les vrais écrans, et ce qui est relié en direct ou par import.",
                img="home")
    body += f'<div class="wrap">{mq}<div class="sh" data-r style="margin-top:72px"><span class="kick">Par usage</span><h2>Choisissez par où commencer.</h2><p>Chaque page montre les écrans, ce que fait l\'app et dans quel pack.</p></div><div class="cards c3">{cards}</div></div>'
    body += band()
    page("/fonctionnalites", "Fonctionnalités · Logiciel de gestion de restaurant tout-en-un · Growth Gusto",
         "HACCP, étiquettes, contrôle sanitaire, réservations, prise de commande, menu QR, marges, stock, caisse, équipe, fidélité et finances : toutes les fonctions de Growth Gusto.",
         body, [("/", "Accueil"), ("/fonctionnalites", "Fonctionnalités")],
         ld=[{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{BASE}/fonctionnalites/{f['slug']}", "name": f["short"]} for i, f in enumerate(FEATURES)]}])

    for f in FEATURES:
        trail = [("/", "Accueil"), ("/fonctionnalites", "Fonctionnalités"), (f"/fonctionnalites/{f['slug']}", f["short"])]
        body = hero(trail, f["kick"], f["h1"], f["lede"], img=f["img"], tags=f["tags"])
        body += '<div class="wrap">'
        for i, (t, p, ul, img, c, tg) in enumerate(f["blocks"]):
            tags = ('<div class="tags">' + "".join(tag(x) for x in tg) + "</div>") if tg else ""
            ticks = "".join(f"<li>{e(x)}</li>" for x in ul)
            body += f'''<div class="blk{" rev" if i % 2 else ""}" data-c="{c}"><div class="t" data-r><span class="kick">{i+1:02d}</span><h2>{e(t)}</h2>{tags}<p>{e(p)}</p><ul class="ticks">{ticks}</ul></div><div class="stage" data-r style="--dl:1">{phone(img, "Écran " + t + " de l'app Growth Gusto")}</div></div>'''
        body += '</div>'
        # faq
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Questions</span><h2>Ce qu\'on nous demande.</h2></div>{faq_html(f["faq"])}</section>'
        # related
        rel = "".join(card(f"/fonctionnalites/{r}", e(BY[r]["short"]), e(BY[r]["card"]), BY[r]["ic"], BY[r]["icc"], dl=i) for i, r in enumerate(f["related"]))
        from content_guides import GBY
        rel += "".join(card(f"/guides/{g}", e(GBY[g]["short"]), e(GBY[g]["card"]), "book", "l", go="Lire le guide", dl=i + 3) for i, g in enumerate(f["guides"][:2]))
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Pour aller plus loin</span><h2>Ça va bien avec.</h2></div><div class="cards c3">{rel}</div></section>'
        body += band()
        ld = [{"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f"Growth Gusto · {f['short']}", "applicationCategory": "BusinessApplication",
               "operatingSystem": "Web, iOS, Android", "url": f"{BASE}/fonctionnalites/{f['slug']}", "description": f["desc"], "image": f"{BASE}/img/{f['img']}.jpg",
               "offers": {"@type": "Offer", "price": {"Pack Second": "109", "Pack Chef": "169"}.get(f["tags"][0], "59"), "priceCurrency": "EUR"}},
              faq_ld(f["faq"])]
        page(f"/fonctionnalites/{f['slug']}", f["title"], f["desc"], body, trail, ld=ld)
