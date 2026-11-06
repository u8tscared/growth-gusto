"""Guides: /guides and /guides/<slug>. Practical, sourced, plain French. Regulatory references are the usual
French/EU texts (paquet hygiène, arrêté du 21 décembre 2009, INCO, décrets cités); each guide tells readers to check
their GBPH / DDPP for their own case. No invented figures."""
from build import page, hero, band, card, phone, e, btn_try, BASE

GUIDES = [
 dict(slug="normes-haccp-restaurant", short="Normes HACCP en restaurant", img="registre", minutes=8,
  title="Normes HACCP en restaurant : ce qu'il faut faire, simplement (guide 2026)",
  desc="Les 7 principes HACCP expliqués pour un restaurant, ce que demande le paquet hygiène, les enregistrements à tenir et comment s'organiser au quotidien.",
  card="Les 7 principes, les enregistrements à tenir et l'organisation au quotidien.",
  h1='Les normes HACCP <span class="hl">en restaurant.</span>',
  lede="Ce que la méthode HACCP demande vraiment à un restaurant, sans jargon : les 7 principes, les bonnes pratiques d'hygiène et les enregistrements à garder.",
  sections=[
   ("C'est quoi, l'HACCP ?", """<p>HACCP veut dire <em>Hazard Analysis Critical Control Point</em> : analyse des dangers et points critiques pour leur maîtrise. C'est une méthode, pas un label. Depuis le <strong>règlement (CE) n°852/2004</strong> (le « paquet hygiène »), tout exploitant du secteur alimentaire, restaurants compris, doit mettre en place des procédures fondées sur ses principes.</p>
<p>Concrètement, l'idée est simple : repérer ce qui peut rendre un client malade (une bactérie qui se multiplie, un corps étranger, un allergène non signalé), décider à quelles étapes on le maîtrise, et garder une trace que c'est fait.</p>"""),
   ("Les 7 principes, en clair", """<ol>
<li><strong>Analyser les dangers</strong> : biologiques (bactéries, virus), chimiques (produits d'entretien, allergènes), physiques (verre, os).</li>
<li><strong>Déterminer les points critiques</strong> (CCP) : les étapes où un contrôle est indispensable, par exemple la cuisson, le refroidissement ou le stockage au froid.</li>
<li><strong>Fixer les limites critiques</strong> : une valeur claire, comme « 0 à +3 °C pour les préparations » ou « de 63 °C à moins de 10 °C en moins de 2 heures ».</li>
<li><strong>Surveiller</strong> : qui mesure, quand, avec quoi. Les relevés de températures en sont l'exemple le plus connu.</li>
<li><strong>Prévoir les actions correctives</strong> : que faire si la limite est dépassée (jeter, réchauffer, appeler le frigoriste).</li>
<li><strong>Vérifier</strong> que le système marche : contrôles, analyses, revue des enregistrements.</li>
<li><strong>Documenter</strong> : garder les procédures et les enregistrements.</li>
</ol>"""),
   ("Les bonnes pratiques d'hygiène d'abord", """<p>Avant même l'HACCP, le PMS repose sur les <strong>bonnes pratiques d'hygiène</strong> (BPH) : propreté des locaux et du matériel, plan de nettoyage, lutte contre les nuisibles, hygiène du personnel, maîtrise des températures, qualité de l'eau, gestion des déchets. Le <strong>Guide de bonnes pratiques d'hygiène (GBPH) du restaurateur</strong> les détaille et sert de référence lors des contrôles.</p>"""),
   ("Les enregistrements à tenir", """<p>Les contrôleurs regardent surtout les preuves que vous faites ce que vous dites. Les plus courants :</p>
<ul><li>relevés de températures des enceintes froides ;</li><li>contrôle à réception des livraisons ;</li><li>traçabilité des produits (étiquettes, numéros de lot) ;</li><li>refroidissement rapide et remise en température ;</li><li>plan de nettoyage réalisé ;</li><li>suivi des huiles de friture ;</li><li>non-conformités et actions correctives ;</li><li>formation hygiène du personnel.</li></ul>
<div class="note"><b>Avec Growth Gusto</b>Chaque enregistrement se fait en un tap sur le téléphone, porte un prénom et une heure, et ressort par thème dans le <a href="/fonctionnalites/controle-sanitaire">mode contrôle</a>.</div>"""),
   ("S'organiser sans y passer ses journées", """<p>Ce qui marche dans les cuisines : peu de règles, mais tenues tous les jours. Un moment fixe pour les relevés (avant le service du midi et du soir), une personne responsable par service, des étiquettes à portée de main, et un endroit unique où tout est rangé. Si un relevé est oublié, l'important est de le voir vite et de corriger.</p>
<p>Pour aller plus loin : <a href="/guides/temperatures-reglementaires">températures réglementaires</a>, <a href="/guides/plan-de-maitrise-sanitaire">plan de maîtrise sanitaire</a> et <a href="/guides/controle-sanitaire-ddpp">préparer un contrôle</a>.</p>"""),
  ],
  faq=[("L'HACCP est-il obligatoire en restaurant ?", "Oui. Le règlement (CE) n°852/2004 impose à tout restaurant des procédures fondées sur les principes HACCP, adaptées à sa taille."),
       ("Faut-il une certification HACCP ?", "Non. Il n'existe pas de certification obligatoire. Il faut appliquer la méthode, la documenter dans le PMS, et avoir au moins une personne formée à l'hygiène alimentaire.")],
  feature="haccp-temperatures"),

 dict(slug="temperatures-reglementaires", short="Températures réglementaires", img="frigo", minutes=7,
  title="Températures réglementaires en restaurant : frigo, congélateur, liaison chaude",
  desc="Les températures à respecter en restauration : préparations à +3 °C, viandes hachées à +2 °C, surgelés à -18 °C, liaison chaude à +63 °C, refroidissement en 2 heures.",
  card="Froid positif, surgelés, liaison chaude, refroidissement : les repères à connaître.",
  h1='Les températures <span class="hl">à respecter.</span>',
  lede="Les repères de températures les plus utilisés en restauration commerciale, d'où ils viennent, et comment les surveiller sans y penser.",
  sections=[
   ("D'où viennent les chiffres ?", """<p>En France, les températures de conservation sont fixées principalement par l'<strong>arrêté du 21 décembre 2009</strong> relatif aux règles sanitaires applicables aux activités de commerce de détail, d'entreposage et de transport. Pour un produit acheté emballé, la température indiquée par le fabricant sur l'étiquette s'applique. Pour vos préparations, c'est votre <a href="/guides/plan-de-maitrise-sanitaire">PMS</a> qui fixe les règles, en s'appuyant sur ces repères.</p>"""),
   ("Les repères principaux", """<div class="tbl-w"><table class="tbl"><thead><tr><th>Denrée</th><th>Température</th></tr></thead><tbody>
<tr><td>Préparations et plats cuisinés à l'avance, conservés au froid</td><td>0 à +3 °C</td></tr>
<tr><td>Viandes hachées</td><td>+2 °C maximum</td></tr>
<tr><td>Poissons, crustacés et mollusques frais</td><td>0 à +2 °C (glace fondante)</td></tr>
<tr><td>Produits surgelés, glaces</td><td>-18 °C ou moins</td></tr>
<tr><td>Plats en liaison chaude (maintien au chaud)</td><td>+63 °C minimum</td></tr>
<tr><td>Produits préemballés</td><td>Température indiquée sur l'étiquette</td></tr>
</tbody></table></div>
<p>Beaucoup de restaurants règlent leurs frigos de service entre 0 et +4 °C et alignent leur PMS sur la denrée la plus sensible qu'ils y rangent. Vérifiez les valeurs propres à vos produits dans le GBPH du restaurateur.</p>"""),
   ("Refroidir et réchauffer", """<p>Deux opérations sont particulièrement surveillées :</p>
<ul><li><strong>Le refroidissement rapide</strong> : passer de +63 °C à moins de +10 °C <strong>en moins de 2 heures</strong>, puis stocker à +3 °C au plus. Une cellule de refroidissement est la façon la plus sûre d'y arriver. Voir notre <a href="/guides/refroidissement-rapide">guide du refroidissement</a>.</li>
<li><strong>La remise en température</strong> : atteindre au moins +63 °C à cœur <strong>en moins d'une heure</strong>.</li></ul>"""),
   ("Surveiller sans y penser", """<p>Une surveillance régulière est attendue : deux relevés par jour, avant chaque service, est la pratique la plus courante. Notez la valeur, l'heure, la personne, et l'action corrective si c'est hors limite. Avec des sondes sans fil, la surveillance devient continue et vous êtes prévenu dès qu'un frigo monte.</p>
<div class="note"><b>Avec Growth Gusto</b>Chaque équipement a sa plage, l'app dit quoi relever, et les <a href="/fonctionnalites/haccp-temperatures">sondes sans fil</a> écrivent les relevés toutes seules.</div>"""),
  ],
  faq=[("Quelle température pour un frigo de restaurant ?", "Entre 0 et +3 °C pour les préparations et plats cuisinés, +2 °C pour les viandes hachées. En pratique, beaucoup de restaurants visent 0 à +4 °C et règlent selon la denrée la plus sensible."),
       ("Quelle température pour un congélateur ?", "-18 °C ou moins pour les produits surgelés et les glaces.")],
  feature="haccp-temperatures"),

 dict(slug="dlc-ddm-etiquetage", short="DLC, DDM et étiquetage", img="imprimante", minutes=6,
  title="DLC, DDM et DLC secondaire : bien étiqueter en cuisine de restaurant",
  desc="Différence entre DLC et DDM, DLC secondaire après ouverture, quoi écrire sur l'étiquette d'une préparation maison et comment garder la traçabilité.",
  card="DLC ou DDM, DLC secondaire après ouverture, l'étiquette d'une préparation maison.",
  h1='DLC, DDM <span class="hl">et étiquettes.</span>',
  lede="Deux sigles qui se ressemblent mais ne disent pas la même chose, et ce qu'il faut écrire sur les bacs de la chambre froide.",
  sections=[
   ("DLC ou DDM ?", """<ul><li><strong>DLC, « à consommer jusqu'au »</strong> : pour les denrées très périssables (viandes, poissons, produits laitiers frais, plats préparés). Une fois la date passée, le produit ne doit plus être servi.</li>
<li><strong>DDM, « à consommer de préférence avant »</strong> : pour les produits stables (pâtes sèches, conserves, épices). Après la date, le produit peut perdre en qualité mais reste consommable s'il est bien conservé.</li></ul>"""),
   ("La DLC secondaire", """<p>Quand vous ouvrez un conditionnement ou déconditionnez un produit, la date du fabricant ne vaut plus : elle était calculée pour l'emballage fermé. Vous fixez alors une <strong>DLC secondaire</strong>, souvent indiquée par le fabricant (« à consommer dans les 3 jours après ouverture »). À défaut, c'est votre PMS qui fixe la règle, en s'appuyant sur le GBPH ou des tests de vieillissement.</p>"""),
   ("Que mettre sur l'étiquette d'une préparation ?", """<p>Aucun modèle n'est imposé, mais la traçabilité est obligatoire (règlement (CE) n°178/2002). Une étiquette utile porte :</p>
<ul><li>le nom de la préparation ;</li><li>la date de fabrication ou d'ouverture ;</li><li>la DLC (secondaire) ;</li><li>la personne qui l'a faite ;</li><li>si possible, le lot ou un QR code qui renvoie à l'historique.</li></ul>
<div class="note"><b>Avec Growth Gusto</b>L'app calcule la DLC, ajoute le prénom et un QR code, et imprime l'étiquette sur une imprimante Wi-Fi. Une DLC dépassée ressort en rouge. Voir <a href="/fonctionnalites/etiquettes-dlc">étiquettes et traçabilité</a>.</div>"""),
   ("Et les produits congelés maison ?", """<p>Si vous congelez vous-même, notez la date de congélation et une durée limite selon votre PMS. Décongélez au froid positif, et ne recongelez pas un produit décongelé.</p>"""),
  ],
  faq=[("Peut-on servir un produit après sa DDM ?", "Oui, s'il a été bien conservé : la DDM concerne la qualité, pas la sécurité. Ce n'est pas le cas de la DLC."),
       ("Faut-il étiqueter tous les bacs ?", "Ce n'est pas écrit mot pour mot dans la loi, mais c'est la façon la plus simple de prouver la traçabilité et les durées de vie lors d'un contrôle.")],
  feature="etiquettes-dlc"),

 dict(slug="plan-de-maitrise-sanitaire", short="Plan de maîtrise sanitaire", img="pms", minutes=7,
  title="Plan de maîtrise sanitaire (PMS) d'un restaurant : contenu et exemple de plan",
  desc="Ce que contient un plan de maîtrise sanitaire : bonnes pratiques d'hygiène, plan HACCP, traçabilité, gestion des non-conformités. Comment le rédiger et le tenir à jour.",
  card="Les 4 parties du PMS, comment le rédiger et le garder à jour.",
  h1='Le plan de maîtrise <span class="hl">sanitaire.</span>',
  lede="Le PMS est le document que l'inspecteur vous demandera en premier. Voici ce qu'il contient et comment le rédiger sans y passer une semaine.",
  sections=[
   ("À quoi sert le PMS ?", """<p>Le plan de maîtrise sanitaire décrit les mesures prises par le restaurant pour garantir la sécurité des aliments. Il découle du règlement (CE) n°852/2004 et doit pouvoir être présenté lors d'un contrôle. Il n'y a pas de modèle officiel : il doit correspondre à <strong>votre</strong> restaurant, à sa taille et à sa carte.</p>"""),
   ("Les quatre parties", """<ol><li><strong>Les bonnes pratiques d'hygiène</strong> : personnel, locaux, matériel, nettoyage et désinfection, nuisibles, eau, températures, déchets.</li>
<li><strong>Le plan HACCP</strong> : l'analyse des dangers pour vos préparations, les points critiques, leurs limites, la surveillance et les actions correctives.</li>
<li><strong>La traçabilité</strong> : comment vous savez d'où vient un produit et ce qu'il est devenu (étiquettes, numéros de lot, factures).</li>
<li><strong>La gestion des non-conformités</strong> : retrait et rappel de produits, information de l'administration, actions correctives.</li></ol>"""),
   ("Rédiger le sien", """<p>Partez du <strong>GBPH du restaurateur</strong>, qui donne les dangers et les mesures types. Décrivez ensuite ce que vous faites vraiment : vos équipements, vos fournisseurs, vos procédures, qui fait quoi. Joignez les enregistrements qui prouvent que c'est appliqué. Un PMS court et vrai vaut mieux qu'un classeur épais que personne ne suit.</p>
<div class="note"><b>Avec Growth Gusto</b>Répondez à 15 questions simples sur votre restaurant : l'app rédige le PMS avec vos équipements et vos procédures, et le relie aux enregistrements du quotidien. Voir <a href="/fonctionnalites/controle-sanitaire">contrôle sanitaire et PMS</a>.</div>"""),
   ("Le garder vivant", """<p>Mettez-le à jour quand la carte, l'équipe ou le matériel changent, et relisez-le au moins une fois par an. Un rappel de lot ou une non-conformité est aussi l'occasion de le revoir.</p>"""),
  ],
  faq=[("Le PMS est-il obligatoire pour un petit restaurant ?", "Oui, quelle que soit la taille. Il doit simplement être proportionné à l'activité."),
       ("Existe-t-il un modèle officiel ?", "Non. Le GBPH du restaurateur sert de base, mais le PMS doit décrire votre propre fonctionnement.")],
  feature="controle-sanitaire"),

 dict(slug="controle-sanitaire-ddpp", short="Préparer un contrôle sanitaire", img="controle", minutes=6,
  title="Contrôle sanitaire DDPP en restaurant : comment ça se passe et comment se préparer",
  desc="Déroulé d'une inspection d'hygiène en restaurant, documents demandés, niveaux Alim'confiance et liste pour être prêt le jour où l'inspecteur arrive.",
  card="Le déroulé d'une inspection, les documents demandés, les niveaux Alim'confiance.",
  h1='Le jour du contrôle <span class="hl">sanitaire.</span>',
  lede="Un inspecteur se présente, souvent sans prévenir. Voici ce qu'il regarde, ce qu'il vous demandera, et comment être prêt en cinq minutes.",
  sections=[
   ("Qui contrôle ?", """<p>Les inspections d'hygiène en restauration commerciale sont menées par les services vétérinaires de la <strong>DDPP</strong> (direction départementale de la protection des populations), ou de la DDETSPP selon les départements. Le contrôle est le plus souvent inopiné.</p>"""),
   ("Comment ça se passe", """<ol><li><strong>Visite des locaux</strong> : cuisine, réserves, chambres froides, plonge, vestiaires, sanitaires.</li>
<li><strong>Observation des pratiques</strong> : tenue, lavage des mains, marche en avant, stockage, étiquetage.</li>
<li><strong>Vérification des documents</strong> : PMS, relevés de températures, traçabilité, plan de nettoyage, formation hygiène, contrats (nuisibles, huiles…).</li>
<li><strong>Échange et conclusions</strong> : l'inspecteur explique ce qu'il a vu et les suites éventuelles.</li></ol>"""),
   ("Les niveaux Alim'confiance", """<p>Le résultat est publié sur le site et l'application <strong>Alim'confiance</strong>, avec quatre niveaux : <em>très satisfaisant</em>, <em>satisfaisant</em>, <em>à améliorer</em>, <em>à corriger de manière urgente</em>. Les deux derniers peuvent s'accompagner d'une mise en demeure, voire d'une fermeture administrative en cas de danger.</p>"""),
   ("La liste pour être prêt", """<ul><li>PMS à jour et accessible ;</li><li>relevés de températures des dernières semaines ;</li><li>préparations étiquetées, aucune DLC dépassée ;</li><li>contrôles à réception notés ;</li><li>plan de nettoyage et sa réalisation ;</li><li>attestation de formation hygiène d'au moins une personne ;</li><li>information allergènes disponible par écrit pour les clients ;</li><li>contrats et passages : nuisibles, hotte, huiles usagées.</li></ul>
<div class="note"><b>Avec Growth Gusto</b>Ouvrez le <a href="/fonctionnalites/controle-sanitaire">mode contrôle</a> : tout est rangé par thème sur la période choisie, et le dossier complet sort en PDF.</div>"""),
  ],
  faq=[("Le contrôle est-il annoncé ?", "Le plus souvent non. C'est pour cela que les enregistrements doivent être tenus au quotidien."),
       ("Où voir le résultat ?", "Sur Alim'confiance (site et application), pendant un an.")],
  feature="controle-sanitaire"),

 dict(slug="allergenes-restaurant", short="Les 14 allergènes", img="fiche", minutes=5,
  title="Les 14 allergènes à déclarer en restaurant : liste et affichage obligatoire",
  desc="La liste des 14 allergènes réglementaires (règlement INCO), l'obligation d'information écrite en restaurant (décret 2015-447) et comment l'afficher simplement.",
  card="La liste des 14 allergènes et la façon de les afficher pour vos clients.",
  h1='Les 14 allergènes <span class="hl">en restaurant.</span>',
  lede="Depuis 2015, chaque restaurant doit informer ses clients par écrit des allergènes présents dans ses plats. Voici la liste et la façon la plus simple de faire.",
  sections=[
   ("La liste des 14", """<p>Le <strong>règlement (UE) n°1169/2011</strong> (dit INCO, annexe II) liste 14 allergènes à déclarer :</p>
<ol><li>céréales contenant du gluten (blé, seigle, orge, avoine, épeautre…)</li><li>crustacés</li><li>œufs</li><li>poissons</li><li>arachides</li><li>soja</li><li>lait</li><li>fruits à coque (amandes, noisettes, noix, noix de cajou, pistaches…)</li><li>céleri</li><li>moutarde</li><li>graines de sésame</li><li>anhydride sulfureux et sulfites (au-delà de 10 mg/kg ou 10 mg/l)</li><li>lupin</li><li>mollusques</li></ol>"""),
   ("Ce que dit la loi en France", """<p>Le <strong>décret n°2015-447 du 17 avril 2015</strong> impose aux restaurants de fournir cette information <strong>par écrit</strong>, de façon lisible et accessible au client, sans qu'il ait à la demander. Un tableau des allergènes, une mention sur la carte ou un classeur à disposition en salle conviennent, à condition qu'ils soient à jour.</p>"""),
   ("Le piège : les changements de recette", """<p>Une sauce qui change de fournisseur, un dessert du jour, une garniture remplacée : l'information doit suivre. Le plus sûr est de calculer les allergènes depuis les ingrédients de chaque fiche recette, plutôt que de tenir un tableau à la main.</p>
<div class="note"><b>Avec Growth Gusto</b>Les 14 allergènes sont calculés depuis les ingrédients des <a href="/fonctionnalites/recettes-allergenes">fiches recettes</a>, et le tableau de la carte se met à jour tout seul. Au téléphone, le serveur est alerté si un plat contient l'allergie du client.</div>"""),
  ],
  faq=[("Faut-il afficher les allergènes sur la carte ?", "Ce n'est pas obligatoire sur la carte elle-même, mais l'information doit être écrite et accessible au client sans qu'il la demande : tableau affiché, mention ou classeur en salle."),
       ("Les traces (« peut contenir ») sont-elles obligatoires ?", "Non, ce n'est pas une obligation réglementaire, mais si vous les indiquez, l'information doit être juste.")],
  feature="recettes-allergenes"),

 dict(slug="refroidissement-rapide", short="Refroidissement rapide", img="hygiene", minutes=4,
  title="Refroidissement rapide en restaurant : de 63 °C à 10 °C en moins de 2 heures",
  desc="La règle du refroidissement rapide des préparations, pourquoi elle existe, comment la tenir sans cellule et comment l'enregistrer pour le contrôle.",
  card="La règle 63 °C à 10 °C en moins de 2 heures, et comment l'enregistrer.",
  h1='Le refroidissement <span class="hl">rapide.</span>',
  lede="Un bœuf bourguignon préparé la veille doit refroidir vite. Voici la règle, pourquoi elle existe, et comment la tenir dans une vraie cuisine.",
  sections=[
   ("La règle", """<p>Une préparation cuite destinée à être conservée au froid doit passer de <strong>+63 °C à moins de +10 °C en moins de 2 heures</strong>, puis être stockée à +3 °C au plus. C'est la règle fixée par l'arrêté du 21 décembre 2009 et reprise par le GBPH. Entre 10 et 63 °C, les bactéries se multiplient très vite : il faut traverser cette zone au plus vite.</p>"""),
   ("Comment y arriver", """<ul><li>une <strong>cellule de refroidissement</strong>, la solution la plus fiable ;</li><li>à défaut, des bacs peu profonds, un bain d'eau glacée en remuant, des portions plus petites ;</li><li>jamais une grosse marmite chaude directement dans le frigo de service : elle réchauffe tout le reste.</li></ul>"""),
   ("L'enregistrer", """<p>Notez l'heure et la température de départ, puis l'heure et la température d'arrivée sous 10 °C. Si la limite est dépassée, l'action corrective prévue au PMS s'applique (souvent : jeter).</p>
<div class="note"><b>Avec Growth Gusto</b>Le refroidissement se lance en un tap, avec un minuteur et un rappel, et rejoint le registre HACCP. Voir <a href="/fonctionnalites/recettes-allergenes">recettes et process HACCP</a>.</div>"""),
  ],
  faq=[("Et la remise en température ?", "Une préparation refroidie doit être réchauffée à au moins +63 °C à cœur en moins d'une heure.")],
  feature="recettes-allergenes"),

 dict(slug="formation-hygiene-obligatoire", short="Formation hygiène obligatoire", img="formation", minutes=4,
  title="Formation hygiène alimentaire obligatoire en restaurant (14 heures) : qui, quand, dispenses",
  desc="Le décret 2011-731 impose au moins une personne formée à l'hygiène alimentaire dans chaque restaurant commercial. Durée, dispenses, organismes et attestations.",
  card="Qui doit être formé, combien d'heures, les dispenses et l'attestation.",
  h1='La formation hygiène <span class="hl">obligatoire.</span>',
  lede="Chaque restaurant commercial doit compter au moins une personne formée à l'hygiène alimentaire. Voici ce que ça veut dire en pratique.",
  sections=[
   ("L'obligation", """<p>Le <strong>décret n°2011-731 du 24 juin 2011</strong> impose aux établissements de restauration commerciale d'avoir dans leur effectif <strong>au moins une personne</strong> ayant suivi une formation en hygiène alimentaire adaptée à leur activité. La formation de référence dure <strong>14 heures</strong> et se fait auprès d'un organisme enregistré.</p>"""),
   ("Les dispenses", """<p>Sont réputées remplir l'obligation les personnes qui justifient d'au moins trois ans d'expérience comme gestionnaire ou exploitant d'une entreprise du secteur alimentaire, ou de certains diplômes et titres de la restauration listés par arrêté. Gardez le justificatif à disposition.</p>"""),
   ("Et le reste de l'équipe ?", """<p>Le règlement (CE) n°852/2004 demande que tout le personnel qui manipule des denrées soit encadré et formé aux règles d'hygiène adaptées à son poste. Pas forcément 14 heures, mais des consignes claires, rappelées régulièrement.</p>
<div class="note"><b>Avec Growth Gusto</b>Des mini-formations de deux minutes sur le téléphone, suivies par personne, gardent les bons gestes au quotidien. Elles ne remplacent pas la formation de 14 heures. Voir <a href="/fonctionnalites/recettes-allergenes">formation de l'équipe</a>.</div>"""),
  ],
  faq=[("Le gérant doit-il être formé lui-même ?", "Non, il faut au moins une personne formée dans l'effectif, qui peut être un salarié.")],
  feature="equipe-planning"),

 dict(slug="huile-de-friture", short="Huile de friture", img="hygiene", minutes=3,
  title="Huile de friture en restaurant : quand la changer (seuil de 25 % de composés polaires)",
  desc="La limite réglementaire des composés polaires dans l'huile de friture, comment la mesurer, quand changer l'huile et comment l'enregistrer.",
  card="Le seuil des 25 % de composés polaires, la mesure et le suivi.",
  h1='L\'huile de friture, <span class="hl">au bon moment.</span>',
  lede="Une huile trop utilisée donne mauvais goût et devient nocive. Voici la limite réglementaire et la façon simple de la suivre.",
  sections=[
   ("La limite", """<p>Le <strong>décret n°2008-184 du 26 février 2008</strong> fixe la teneur maximale en <strong>composés polaires</strong> d'une huile de friture à <strong>25 %</strong>. Au-delà, l'huile doit être remplacée.</p>"""),
   ("La mesurer", """<p>Un testeur électronique de composés polaires donne la valeur en quelques secondes, huile chaude. Des bandelettes existent aussi. Changez l'huile avant d'atteindre la limite, et filtrez-la chaque jour pour la faire durer.</p>"""),
   ("L'enregistrer", """<p>Notez la date, la mesure et les changements d'huile. Les huiles usagées sont collectées par un prestataire agréé : gardez les bons d'enlèvement.</p>
<div class="note"><b>Avec Growth Gusto</b>Le suivi de l'huile se fait dans l'onglet hygiène, avec les autres enregistrements du jour. Voir <a href="/fonctionnalites/recettes-allergenes">hygiène et process</a>.</div>"""),
  ],
  faq=[("Combien de fois réutiliser une huile ?", "Il n'y a pas de nombre fixe : tout dépend de l'usage. C'est la mesure des composés polaires (25 % maximum) qui fait foi.")],
  feature="recettes-allergenes"),
]
GBY = {g["slug"]: g for g in GUIDES}

def build():
    from content_features import BY as FBY
    cards = "".join(card(f"/guides/{g['slug']}", e(g["short"]), e(g["card"]), "book", ["l", "k", "s", ""][i % 4], go=f"Lire · {g['minutes']} min", dl=i % 3) for i, g in enumerate(GUIDES))
    body = hero([("/", "Accueil"), ("/guides", "Guides")], "Guides pratiques", 'L\'hygiène en cuisine, <span class="hl">expliquée simplement.</span>',
                "HACCP, températures, DLC, PMS, allergènes, contrôle sanitaire : des guides courts, avec les textes de référence, écrits pour les gens qui cuisinent.")
    body += f'<div class="wrap"><div class="cards c3" style="margin-top:0">{cards}</div><p class="src" data-r>Ces guides donnent les repères les plus courants et les textes de référence. Ils ne remplacent pas le Guide de bonnes pratiques d\'hygiène du restaurateur ni l\'avis de votre DDPP pour votre cas précis.</p></div>'
    body += band()
    page("/guides", "Guides HACCP et hygiène pour restaurants · Growth Gusto",
         "Guides pratiques pour restaurateurs : normes HACCP, températures réglementaires, DLC et DDM, plan de maîtrise sanitaire, allergènes, contrôle sanitaire, refroidissement, huile de friture.",
         body, [("/", "Accueil"), ("/guides", "Guides")])
    for g in GUIDES:
        trail = [("/", "Accueil"), ("/guides", "Guides"), (f"/guides/{g['slug']}", g["short"])]
        toc = "".join(f'<li><a href="#s{i+1}">{e(t)}</a></li>' for i, (t, _) in enumerate(g["sections"]))
        prose = "".join(f'<h2 id="s{i+1}">{e(t)}</h2>{c}' for i, (t, c) in enumerate(g["sections"]))
        from build import faq_html, faq_ld
        f = FBY[g["feature"]]
        side = f'''<aside class="side"><div class="toc"><b>Sommaire</b><ol>{toc}</ol></div>
<div class="side-card"><b>{e(f["short"])} avec Growth Gusto</b><p>{e(f["card"])}</p>{phone(g["img"], "Écran de l'app Growth Gusto")}<a class="btn v" href="/fonctionnalites/{f["slug"]}">Voir comment</a></div></aside>'''
        others = [x for x in GUIDES if x["slug"] != g["slug"]][:3]
        rel = "".join(card(f"/guides/{x['slug']}", e(x["short"]), e(x["card"]), "book", "l", go=f"Lire · {x['minutes']} min", dl=i) for i, x in enumerate(others))
        body = '<div class="progress" aria-hidden="true"></div>'
        body += hero(trail, "Guide pratique", g["h1"], g["lede"], img=None, ctas="", meta=f"<span>{g['minutes']} min de lecture</span><span>Mis à jour le 6 novembre 2026</span><span>Par l'équipe Growth Gusto</span>")
        body += f'<div class="wrap"><div class="art"><article class="prose">{prose}<h2 id="faq">Questions fréquentes</h2>{faq_html(g["faq"])}<p class="src">Repères généraux, à adapter à votre établissement avec le GBPH du restaurateur et votre DDPP. Textes cités consultables sur Légifrance et EUR-Lex.</p></article>{side}</div>'
        body += f'<section class="sec"><div class="sh" data-r><span class="kick">À lire aussi</span><h2>Les autres guides.</h2></div><div class="cards c3">{rel}</div></section></div>'
        body += band("Les enregistrements HACCP, en un tap.", "Relevés, étiquettes, nettoyage, PMS et dossier de contrôle : essayez Growth Gusto 14 jours, sans carte bancaire.")
        ld = [{"@context": "https://schema.org", "@type": "Article", "headline": g["title"], "description": g["desc"], "inLanguage": "fr",
               "datePublished": "2026-11-06", "dateModified": "2026-11-06", "mainEntityOfPage": f"{BASE}/guides/{g['slug']}",
               "image": f"{BASE}/og.jpg", "author": {"@type": "Organization", "name": "Growth Gusto", "url": BASE + "/"},
               "publisher": {"@type": "Organization", "name": "Growth Gusto", "logo": {"@type": "ImageObject", "url": f"{BASE}/apple-touch-icon.png"}}},
              faq_ld(g["faq"])]
        page(f"/guides/{g['slug']}", g["title"], g["desc"], body, trail, ld=ld)
