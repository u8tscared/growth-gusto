"""Pages per kind of restaurant: /restaurants and /restaurants/<slug>."""
from build import page, hero, band, card, faq_html, faq_ld, phone, icon, e, btn_try, btn_demo, BASE, APP, ARROW

PACKS = {"essentiel": ("Commis", "59"), "pro": ("Second", "109"), "complet": ("Chef", "169")}

TYPES = [
 dict(slug="bistrot-brasserie", short="Bistrot et brasserie", ic="pot", icc="",
  title="Logiciel de gestion pour bistrot et brasserie · HACCP, réservations, caisse · Growth Gusto",
  desc="Bistrot ou brasserie : relevés HACCP, étiquettes DLC, réservations sans commission, plan de salle, prise de commande, stock et marges dans une seule app. Essai 14 jours.",
  kick="Bistrot et brasserie", h1='Le coup de feu du midi, <span class="hl">la tête libre.</span>',
  lede="Deux services par jour, une carte qui bouge avec l'ardoise, une équipe qui tourne. Growth Gusto garde l'hygiène, la salle et les marges au même endroit, sur le téléphone de chacun.",
  img="salle", pack="pro",
  day=[("9 h 30, la mise en place", "Relevés des frigos, sortie des produits, étiquettes des préparations du jour."), ("12 h, le service", "Réservations et passants sur le plan de salle, commandes envoyées à l'écran cuisine."), ("15 h, l'ardoise du soir", "Marge du plat du jour calculée, consigne envoyée à l'équipe, stock à jour.")],
  feats=["haccp-temperatures", "etiquettes-dlc", "reservations", "prise-de-commande", "marges-achats", "caisse-stock"],
  faq=[("Le plat du jour change tous les jours. C'est un problème ?", "Non. Créez la recette en une minute avec ses ingrédients : la marge et les allergènes sont calculés tout de suite. Le plat peut ensuite être mis en avant sur le menu QR."),
       ("On a une terrasse l'été.", "Ajoutez une salle « Terrasse » sur le plan de salle, avec ses tables. Vous l'ouvrez ou la fermez selon la météo, et les réservations en tiennent compte."),
       ("Quel pack choisir ?", "Le pack Second couvre l'hygiène, la salle, la caisse, le stock, la pointeuse et le planning de la semaine. Prenez Chef pour le planning intelligent, les salaires et les finances.")],
  guides=["normes-haccp-restaurant", "temperatures-reglementaires", "dlc-ddm-etiquetage"]),

 dict(slug="restaurant-gastronomique", short="Restaurant gastronomique", ic="star", icc="s",
  title="Logiciel pour restaurant gastronomique · fiches techniques, allergènes, HACCP · Growth Gusto",
  desc="Restaurant gastronomique : fiches techniques chiffrées, 14 allergènes, process HACCP par plat, réservations et fichier clients, marges au gramme. Essai 14 jours.",
  kick="Restaurant gastronomique", h1='La précision en cuisine, <span class="hl">jusqu\'aux papiers.</span>',
  lede="Des fiches techniques au gramme, des allergènes exacts pour chaque assiette, des clients qu'on reconnaît. Growth Gusto suit la rigueur de votre brigade, sans un classeur de plus.",
  img="fiche", pack="complet",
  day=[("Le matin, la réception", "Contrôle des livraisons à la porte : température, état, lot, photo de l'étiquette."), ("L'après-midi, les fiches", "Fiches techniques chiffrées, process HACCP de chaque plat, refroidissement suivi."), ("Le soir, la salle", "Allergies et préférences de chaque table sur sa fiche client, menu dégustation sans erreur.")],
  feats=["recettes-allergenes", "etiquettes-dlc", "controle-sanitaire", "reservations", "fidelite-clients", "equipe-planning"],
  faq=[("Les allergènes sont-ils calculés automatiquement ?", "Oui : chaque ingrédient porte ses allergènes parmi les 14 obligatoires, et chaque recette en hérite, sous-recettes comprises. Vous imprimez le tableau pour la salle."),
       ("Peut-on noter les allergies d'un client ?", "Oui, sur sa fiche client. Elles s'affichent sur la réservation et sur le plan de salle le soir du service."),
       ("Quel pack choisir ?", "Le pack Chef, pour le planning intelligent de la brigade, les salaires et les finances. Le pack Second suffit déjà pour la salle, la pointeuse et le planning de la semaine.")],
  guides=["allergenes-restaurant", "refroidissement-rapide", "plan-de-maitrise-sanitaire"]),

 dict(slug="pizzeria", short="Pizzeria", ic="pizza", icc="k",
  title="Logiciel pour pizzeria · HACCP, commande à emporter, livraison, stock · Growth Gusto",
  desc="Pizzeria : prise de commande au téléphone et à emporter, menu QR, relevés Uber Eats et Deliveroo par import, stock de pâte et de fromage déduit des ventes. Essai 14 jours.",
  kick="Pizzeria", h1='Le téléphone sonne, <span class="hl">la pâte est prête.</span>',
  lede="Sur place, à emporter, en livraison : les commandes arrivent de partout. Growth Gusto les rassemble à l'écran cuisine, déduit le stock de chaque pizza et vous montre ce que rapporte vraiment la livraison.",
  img="commandes", pack="pro",
  day=[("17 h, la pâte", "Étiquette DLC des pâtons du jour, relevé du frigo à mozzarella, mise en place sortie."), ("19 h, le rush", "Commandes au téléphone et sur le menu QR, envoyées à l'écran cuisine avec l'heure de retrait."), ("Fin du mois, les plateformes", "Relevé Uber Eats ou Deliveroo déposé : commissions rangées, vraie marge par pizza.")],
  feats=["prise-de-commande", "menu-qr", "caisse-stock", "etiquettes-dlc", "marges-achats", "haccp-temperatures"],
  faq=[("Uber Eats et Deliveroo arrivent-ils dans l'app ?", "Par import : vous déposez le relevé de ventes, et l'app en tire le chiffre, les commissions et le stock déduit. Les commandes en direct sur l'écran cuisine arrivent bientôt, en option."),
       ("Les clients peuvent-ils commander en ligne ?", "Oui : un lien de commande à emporter, avec créneaux de retrait. La commande arrive sur l'écran cuisine. Le client paie au retrait, ou en ligne par Stripe si vous l'activez, sans commission Growth Gusto."),
       ("Quel pack choisir ?", "Le pack Second : prise de commande, menu QR, caisse, stock et relevés des plateformes y sont inclus. Plusieurs enseignes depuis la même cuisine ? Le pack Chef suit chaque marque à part.")],
  guides=["dlc-ddm-etiquetage", "temperatures-reglementaires", "huile-de-friture"]),

 dict(slug="traiteur", short="Traiteur", ic="truck", icc="l",
  title="Logiciel HACCP pour traiteur · traçabilité, refroidissement, liaison froide · Growth Gusto",
  desc="Traiteur : traçabilité des lots, refroidissement rapide suivi, liaison froide et chaude, étiquettes DLC, rappel de lot, fiches techniques et coût de revient par pièce. Essai 14 jours.",
  kick="Traiteur", h1='Chaque plateau tracé, <span class="hl">du lot à la livraison.</span>',
  lede="Production en avance, liaison froide, livraisons chez le client : la traçabilité n'est pas une option. Growth Gusto suit chaque lot, chaque refroidissement et chaque étiquette, et retrouve tout en cas de rappel.",
  img="rappel", pack="complet",
  day=[("La veille, la production", "Cuisson, refroidissement de 63 °C à moins de 10 °C en moins de deux heures, noté et daté."), ("Le matin, le conditionnement", "Étiquettes DLC avec lot et QR code sur chaque barquette, sortie des chambres froides."), ("En cas de rappel", "Un fournisseur rappelle un lot : l'app retrouve où il est passé en quelques secondes.")],
  feats=["etiquettes-dlc", "controle-sanitaire", "recettes-allergenes", "haccp-temperatures", "marges-achats", "equipe-planning"],
  faq=[("Le refroidissement rapide est-il suivi ?", "Oui : vous notez la température au départ et à l'arrivée, l'app vérifie le délai et demande une action si la limite est dépassée."),
       ("Un rappel de lot, comment ça se passe ?", "Vous tapez le numéro de lot ou le fournisseur : l'app montre les réceptions, les préparations et les étiquettes concernées, avec les dates."),
       ("Quel pack choisir ?", "Le pack Commis couvre toute l'hygiène et la traçabilité. Le pack Second ajoute la pointeuse et le planning de la semaine, le pack Chef le planning intelligent et les finances.")],
  guides=["refroidissement-rapide", "plan-de-maitrise-sanitaire", "dlc-ddm-etiquetage"]),

 dict(slug="cafe-bar", short="Café, bar et salon de thé", ic="cup", icc="r",
  title="Logiciel pour café, bar et salon de thé · HACCP simple, menu QR, caisse · Growth Gusto",
  desc="Café, bar, salon de thé : relevés HACCP en un tap, étiquettes des pâtisseries, menu QR, caisse SumUp ou Square en direct, carte de fidélité. Dès 59 € HT par mois.",
  kick="Café, bar, salon de thé", h1='Le comptoir tourne, <span class="hl">l\'hygiène suit.</span>',
  lede="Une petite équipe, peu de temps, et quand même un frigo à pâtisseries, du lait ouvert et un contrôle possible. Growth Gusto fait l'essentiel en quelques taps et garde vos habitués.",
  img="menu-qr", pack="essentiel",
  day=[("7 h, l'ouverture", "Relevé de la vitrine et du frigo, étiquette du lait et des pâtisseries ouvertes."), ("Toute la journée", "Menu QR sur les tables, ventes SumUp ou Square qui arrivent toutes seules."), ("Le soir", "Ce qui doit être jeté, ce qui reste, et la carte à tampons des habitués à jour.")],
  feats=["haccp-temperatures", "etiquettes-dlc", "menu-qr", "fidelite-clients", "caisse-stock", "controle-sanitaire"],
  faq=[("Je suis seul derrière le comptoir. Ça prend combien de temps ?", "Deux relevés de température prennent moins d'une minute. Avec une sonde sans fil, ils se font tout seuls."),
       ("Ma caisse SumUp est-elle reliée ?", "Oui, SumUp et Square se relient en direct avec les packs Second et Chef : les ventes arrivent toutes seules."),
       ("Quel pack choisir ?", "Le pack Commis suffit pour l'hygiène. Le pack Second ajoute le menu QR, la caisse reliée, le stock et la fidélité.")],
  guides=["normes-haccp-restaurant", "dlc-ddm-etiquetage", "formation-hygiene-obligatoire"]),

 dict(slug="restauration-rapide", short="Restauration rapide et snacking", ic="bag", icc="",
  title="Logiciel pour restauration rapide et snacking · HACCP, commandes, livraison · Growth Gusto",
  desc="Fast-food, snack, burger, kebab, poke : relevés HACCP, huile de friture, étiquettes DLC, commandes à emporter, relevés de livraison par import, stock et marges. Essai 14 jours.",
  kick="Restauration rapide", h1='Vite servi, <span class="hl">bien tenu.</span>',
  lede="Beaucoup de couverts, de la friture, des livraisons et une équipe souvent jeune. Growth Gusto rend chaque geste d'hygiène évident et vous montre ce que rapporte chaque produit.",
  img="cuisine", pack="pro",
  day=[("Avant l'ouverture", "Relevés des frigos, test de l'huile de friture, mise en place étiquetée."), ("Le rush", "Commandes à l'écran cuisine, sur place, à emporter et en livraison."), ("La fermeture", "Ticket Z ou ventes de la caisse, stock déduit, gaspillage noté en euros.")],
  feats=["haccp-temperatures", "etiquettes-dlc", "prise-de-commande", "caisse-stock", "marges-achats", "equipe-planning"],
  faq=[("L'huile de friture est-elle suivie ?", "Oui : le test de l'huile (composés polaires) se note dans l'app, avec le changement de bain. La limite réglementaire est de 25 % de composés polaires."),
       ("Mon équipe change souvent.", "Chaque nouvel arrivant a son compte en un code, et la formation HACCP intégrée lui apprend les gestes de base."),
       ("Quel pack choisir ?", "Le pack Second, pour la prise de commande, l'écran cuisine, la caisse, le stock, la pointeuse et les alertes d'heures sup. Le pack Chef ajoute le planning intelligent, utile avec beaucoup d'extras.")],
  guides=["huile-de-friture", "formation-hygiene-obligatoire", "controle-sanitaire-ddpp"]),
]

TBY = {t["slug"]: t for t in TYPES}

def build():
    from content_features import BY
    from content_guides import GBY
    hub = [("/", "Accueil"), ("/restaurants", "Restaurants")]
    cards = "".join(card(f"/restaurants/{t['slug']}", e(t["short"]), e(t["lede"].split(". ")[0] + "."), t["ic"], t["icc"], go="Voir pour mon restaurant", dl=i % 3) for i, t in enumerate(TYPES))
    body = hero(hub, "Pour chaque restaurant", 'Votre cuisine, <span class="hl">votre façon de faire.</span>',
                "Bistrot, gastronomique, pizzeria, traiteur, café ou snacking : la même app, réglée pour votre service. Choisissez le vôtre.", img="home")
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Par type de restaurant</span><h2>Vous vous reconnaissez&nbsp;?</h2><p>Chaque page montre une journée type, ce qui sert le plus et le pack conseillé.</p></div><div class="cards c3">{cards}</div></section>'
    body += band()
    page("/restaurants", "Logiciel de gestion par type de restaurant · bistrot, pizzeria, traiteur, café · Growth Gusto",
         "Bistrot, brasserie, restaurant gastronomique, pizzeria, traiteur, café, bar ou restauration rapide : comment Growth Gusto s'adapte à votre établissement.",
         body, hub, ld=[{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{BASE}/restaurants/{t['slug']}", "name": t["short"]} for i, t in enumerate(TYPES)]}])

    for t in TYPES:
        trail = hub + [(f"/restaurants/{t['slug']}", t["short"])]
        name, price = PACKS[t["pack"]]
        body = hero(trail, t["kick"], t["h1"], t["lede"], img=t["img"], ctas=btn_try("w", f"Essayer {name} 14 jours", t["pack"]) + btn_demo())
        steps = "".join(f'<li data-r style="--dl:{i}"><b>{e(a)}</b><span>{e(b)}</span></li>' for i, (a, b) in enumerate(t["day"]))
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Une journée type</span><h2>Votre service, avec Growth Gusto.</h2></div><ol class="steps">{steps}</ol></section>'
        from content_features import live_slugs, NOMBRES
        fs = [s for s in t["feats"] if s in live_slugs()]  # une fonction retirée de l'app disparaît d'ici aussi
        fc = "".join(card(f"/fonctionnalites/{s}", e(BY[s]["short"]), e(BY[s]["card"]), BY[s]["ic"], BY[s]["icc"], shot=BY[s]["img"] if i < 3 else None, dl=i % 3) for i, s in enumerate(fs))
        nb = NOMBRES.get(len(fs), str(len(fs))).capitalize()
        if fs:
            body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Ce qui vous sert le plus</span><h2>{nb} fonction{"s" if len(fs) > 1 else ""} à ouvrir en premier.</h2></div><div class="cards c3">{fc}</div></section>'
        body += f'''<section class="sec wrap"><div class="note s" data-r><b>Le pack conseillé&nbsp;: {name}, {price}&nbsp;€ HT par mois.</b> Sans engagement, utilisateurs illimités, 14 jours gratuits sans carte bancaire. <a href="/tarifs">Comparer les trois packs</a>.</div></section>'''
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Questions</span><h2>Ce qu\'on nous demande.</h2></div>{faq_html(t["faq"])}</section>'
        gc = "".join(card(f"/guides/{g}", e(GBY[g]["short"]), e(GBY[g]["card"]), "book", "l", go="Lire le guide", dl=i) for i, g in enumerate(t["guides"]))
        others = [o for o in TYPES if o is not t][:3]
        gc2 = "".join(card(f"/restaurants/{o['slug']}", e(o["short"]), e(o["kick"] + " : la page dédiée."), o["ic"], o["icc"], go="Voir", dl=i) for i, o in enumerate(others))
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Les guides utiles</span><h2>À lire avant le prochain contrôle.</h2></div><div class="cards c3">{gc}</div></section>'
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Autres restaurants</span><h2>Et pour les autres&nbsp;?</h2></div><div class="cards c3">{gc2}</div></section>'
        body += band()
        ld = [{"@context": "https://schema.org", "@type": "WebPage", "name": t["title"], "description": t["desc"], "url": f"{BASE}/restaurants/{t['slug']}",
               "about": {"@type": "SoftwareApplication", "name": "Growth Gusto", "applicationCategory": "BusinessApplication", "operatingSystem": "Web, iOS, Android",
                         "offers": {"@type": "Offer", "price": price, "priceCurrency": "EUR"}}}, faq_ld(t["faq"])]
        page(f"/restaurants/{t['slug']}", t["title"], t["desc"], body, trail, ld=ld)
