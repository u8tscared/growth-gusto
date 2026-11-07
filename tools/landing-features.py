#!/usr/bin/env python3
"""Regenerates the « Fonctionnalités » groups and the feature chips of site/index.html.

The texts of features already on the page are read back from the page itself (so hand edits
are kept); NEW lists the features added since, GROUPS sets the order, the pack badge and the
integration label (« En direct », « Par import », « Bientôt »). Run: python3 tools/landing-features.py
Only the blocks between <!--feat:start--> / <!--feat:end--> and <!--chips:start--> / <!--chips:end--> change.
"""
import html, re, pathlib

P = pathlib.Path(__file__).resolve().parent.parent / "site" / "index.html"
h = P.read_text()

def esc(s):
    return html.escape(s, quote=True).replace("&#x27;", "&#x27;")

# ── features already on the page: id -> (title, desc html, bullets html list)
OLD = {}
for m in re.finditer(r'<li class="fi[^"]*" id="f-([^"]+)" data-img="([^"]+)" data-t="([^"]+)">.*?<span class="fi-t">([^<]*).*?<div class="fi-d"><div><p>(.*?)</p><ul>(.*?)</ul>', h, re.S):
    OLD[m.group(1)] = dict(img=m.group(2), t=m.group(4), p=m.group(5), ul=re.findall(r"<li>(.*?)</li>", m.group(6)))

N = "&nbsp;"
# ── features added or rewritten (html allowed in p / ul)
NEW = {
    "caisse": dict(img="caisse", t="Caisse connectée",
        p=f"Les ventes arrivent toutes seules{N}: chaque plat vendu sort du stock selon sa recette, et le chiffre du jour est prêt.",
        ul=[f"SumUp et Square{N}: en direct", f"Autres caisses{N}: import du fichier des ventes", f"Zelty et Lightspeed en direct{N}: bientôt", "Ventes reliées aux fiches recettes"]),
    "finance": dict(img="finance", t="Finances",
        p="Le résultat estimé du mois et les ratios qui comptent, comparés au mois d'avant et à l'an dernier.",
        ul=["Résultat estimé (EBE), marge brute", "Food cost, masse salariale, prime cost", "Lien avec Pennylane, en direct", "Export pour le comptable"]),
    "banque": dict(img="banque", t="Dépenses de la banque",
        p=f"Déposez le relevé de votre compte pro{N}: prélèvements, cartes et virements sont rangés par catégorie et comptent dans vos finances.",
        ul=["Relevé OFX ou CSV, par import", "Catégories apprises au fil des mois", f"Connexion directe à la banque{N}: bientôt", "Lecture seule, aucun paiement possible"]),
    "marges": dict(img="marges", t="Marge de chaque plat",
        p="Le food cost de la carte et la marge par assiette, plat par plat. Quand un prix fournisseur monte, vous voyez ce que ça vous coûte par mois.",
        ul=["Fiche technique chiffrée, export PDF", "Coefficient, TVA, prix conseillé", "Hausses de prix et leur coût", f"Carte en 4 cases{N}: ventes × marge"]),
    "factures": dict(img="factures", t="Factures fournisseurs scannées",
        p="Une photo ou le PDF de la facture{0}: les lignes sont lues sur votre téléphone, les prix d'achat se mettent à jour et la marge de chaque plat suit.".format(N),
        ul=["Photo ou PDF, lu sur l'appareil", "Lignes reliées au stock", "Historique des prix par produit", "Dépense ajoutée aux achats"]),
    "achats": dict(img="achats", t="Commandes fournisseurs préparées",
        p="L'app prépare un bon par fournisseur d'après les couverts attendus, ce que vous consommez et ce qu'il reste en stock. Vous vérifiez, vous envoyez.",
        ul=["Calculé sur les réservations et l'historique", "Jours de livraison, heure limite, franco", "Envoi par e-mail, SMS, WhatsApp ou PDF", "Manquants repérés à la réception"]),
    "fournisseurs": dict(img="fournisseurs", t="Annuaire des fournisseurs",
        p="Tous vos fournisseurs au même endroit{0}: qui livre aujourd'hui, l'heure limite de la prochaine commande, et la commande prête envoyée en un geste.".format(N),
        ul=["Appeler, SMS, e-mail, itinéraire d'un tap", "Jours et créneau de livraison, heure limite, franco", "Commande préparée envoyée en un clic", "Achats du mois, hausses de prix, livraisons complètes"]),
    "previsions": dict(img="previsions", t="Prévisions d'après l'an dernier",
        p="Les couverts et le chiffre attendus jour par jour{0}: le même jour l'an dernier, la tendance du moment et vos réservations. Les commandes fournisseurs et le planning suivent.".format(N),
        ul=["13 mois de ventes récupérés depuis SumUp ou Square", "Autres caisses{0}: export « CA par jour »".format(N), "Fêtes et événements comparés à eux-mêmes", "Précision mesurée, affichée"]),
    "prix": dict(img="prix", t="Prix dynamiques",
        p="Le happy hour se met en route tout seul sur le menu QR, le plat du jour écoule ce qui arrive à date, et une hausse fournisseur déclenche une alerte avec le prix qui rattrape votre marge.",
        ul=[f"Happy hour programmé{N}: jours, heures, remise", "Prix barrés sur le menu QR, même prix encaissé", "Plat du jour choisi selon les DLC", f"Remise plafonnée{N}: jamais sous votre marge"]),
    "gaspillage": dict(img="gaspillage", t="Gaspillage en euros",
        p="Pertes, invendus, produits dont la DLC est passée{0}: tout est chiffré au coût de la recette, avec des pistes pour jeter moins.".format(N),
        ul=["Jeté du mois, part des achats", "Projection sur l'année", "Lots à jeter en un geste", "Les produits souvent jetés commandés au plus juste"]),
    "zenchef": dict(img="zenchef", t="Réservations Zenchef et TheFork",
        p="Vous gardez votre outil de réservation{0}? Chaque e-mail de réservation, modification ou annulation est repris tout seul dans votre carnet et sur le plan de salle.".format(N),
        ul=["Une adresse e-mail à vous, à mettre dans Zenchef", "Ou import du fichier des réservations", "Passer à nos réservations quand vous voulez"]),
    "salle": dict(img="salle", t="Prise de commande au téléphone",
        p="Le serveur touche la table sur le plan de salle, ajoute les plats, les cuissons et les allergies du client, puis envoie en cuisine. Suite par suite. Quand la cuisine l'appelle, son téléphone sonne.",
        ul=[f"Plats en rupture{N}: «{N}Il reste 7{N}» sous les yeux, «{N}Épuisé{N}» bloqué", "Tables accolées pour les grandes tablées, séparées en un geste", "Alerte si un plat contient l'allergie du client", f"«{N}La cuisine vous appelle{N}» avec une sonnette", "Addition à encaisser sur votre caisse"]),
    "cuisine": dict(img="cuisine", t="Écran cuisine",
        p="Une tablette au passe{0}: les bons de la salle et du menu QR arrivent ensemble, avec le numéro de table, un minuteur et les allergies en rouge.".format(N),
        ul=[f"«{N}Table 8 · Commande QR{N}» sur le bon", "Lancer, prêt, à suivre", "Rappeler le serveur d'un tap", "Disponible, limité à N portions ou épuisé", "Filtre cuisine ou bar, carillon à chaque bon"]),
    "menuqr": dict(img="menu-qr", t="Menu QR et commande en ligne",
        p="Un QR code sur chaque table et un lien à emporter{0}: le client voit la carte avec photos et allergènes, commande, et peut payer en ligne.".format(N),
        ul=["Sur place ou à emporter, avec créneaux", "Paiement à la commande, au choix ou en fin de repas", "Suivi de la commande en direct", "Sans commission Growth Gusto"]),
    "carte": dict(img="carte-import", t="Votre carte importée",
        p="Donnez le PDF, une photo ou l'adresse de votre site{0}: l'app lit la carte, devine les allergènes et vous laisse tout vérifier avant de publier.".format(N),
        ul=["Rubriques, prix, descriptions", "Allergènes devinés, à confirmer", "3 styles, 6 couleurs, photos", "Impression A4 de la carte"]),
    "releve": dict(img="releve", t="Relevés de températures",
        p="Midi et soir, l'app vous dit quel frigo relever. Un chiffre, un tap, c'est noté, avec le prénom et l'heure.",
        ul=[f"Seuil par équipement{N}: 0 à 4 °C, -18 °C", f"Hors seuil{N}: l'action corrective est demandée", "Photo du thermomètre, si vous voulez", "Relevés du midi et du soir, jour par jour"]),
    "clients": dict(img="clients", t="Fichier clients et fidélité",
        p="Chaque client qui réserve ou commande a sa fiche{0}: visites, allergies, anniversaire. Une carte à tampons récompense les habitués, et vous les relancez par e-mail ou SMS, s'ils l'ont accepté.".format(N),
        ul=["Visites, notes, allergies, VIP", "Carte à tampons", "Campagnes e-mail et SMS avec consentement", "Clients à fêter et à relancer"]),
    "consignes": dict(img="consignes", t="Consignes et messagerie d'équipe",
        p="Plat du jour, rupture, info du service{0}: la consigne arrive sur le téléphone de ceux qui sont concernés et vous voyez qui l'a lue. La discussion d'équipe a ses groupes, Cuisine, Salle ou ceux que vous créez, sans groupe WhatsApp perso.".format(N),
        ul=["Groupes Toute l'équipe, Cuisine, Salle, et les vôtres", "Consigne pour tout le monde ou pour un groupe", "Vous choisissez qui peut publier", "Lu, et qui a lu", "Dictée vocale et notifications"]),
    "defis": dict(img="defis", t="Défis d'équipe",
        p="«{0}20 desserts ce soir{0}», «{0}2{0}000{0}€ aujourd'hui{0}», «{0}25 bons prêts en moins de 15 min{0}»{0}: vous lancez le défi, les ventes se comptent toutes seules depuis les commandes, et le classement bouge en direct jusqu'à la fête finale.".format(N),
        ul=["Desserts, boissons, un plat précis, chiffre d'affaires, ticket moyen", "Classement en direct, au nom de chaque serveur", "Sur l'Accueil, la prise de commande et l'écran cuisine", "Trophée, confettis et récompense quand c'est gagné"]),
    "pourboires": dict(img="pourboires", t="Pourboires de l'équipe",
        p="Les pourboires de l'addition, du menu QR et de la caisse arrivent dans une seule cagnotte du mois{0}; le bocal et le terminal se notent en deux taps. La répartition, c'est l'équipe qui la décide{0}: 60{0}% salle, 40{0}% cuisine, à parts égales ou selon les heures, et chacun voit sa part.".format(N),
        ul=["Addition, menu QR, SumUp et Square, espèces", "Salle, cuisine, bar{0}: les pourcentages que vous voulez".format(N), "Parts égales ou selon les heures pointées", "Mois clôturé, versé, export pour la paie"]),
    "notifs": dict(img="notifs", t="Notifications selon le poste",
        p="Chacun reçoit ce qui le concerne{0}: la cuisine voit partir les bons, le serveur sait que sa table est prête, le patron a le chiffre du service à la fin du midi et du soir. Chacun règle les siennes, et chaque téléphone peut avoir sa propre liste.".format(N),
        ul=[f"Cuisine{N}: nouveau bon, table qui réclame, bon modifié", f"Salle{N}: plat prêt, commande en ligne, réservation", f"Patron{N}: chiffre du service, alertes frigos, offerts", "Heures calmes, et seulement quand on a pointé", "iPhone (app sur l'écran d'accueil), Android, ordinateur"]),
    "frais": dict(img="frais", t="Notes de frais pour vos clients",
        p="Un client demande une note pour sa société{0}? «{0}4 repas complets × 37,25{0}€{0}» ou le détail de la table, la TVA ventilée à 10{0}% et 20{0}%, numérotée. Imprimée ou envoyée par e-mail.".format(N),
        ul=["Depuis l'addition d'une table ou à la main", "TVA ventilée par taux", "Numérotation qui se suit, annulation tracée", "PDF imprimé ou envoyé par e-mail"]),
    "coupdefeu": dict(img="resa", t="Coup de feu calé sur les réservations",
        p="Pendant le service, l'app passe en vue coup de feu{0}: gros boutons, l'essentiel pour chacun. Elle s'allume 15 minutes avant la première réservation et s'éteint 45 minutes après la dernière, avec le bilan du service.".format(N),
        ul=[f"Salle{N}: plats prêts, tables, arrivées", f"Cuisine{N}: bons en cours, ruptures, relevés", f"Gérant{N}: couverts, temps en cuisine, retards", "Ou lancé d'un geste depuis l'accueil"]),
    "avis": dict(img="avis-clients", t="Avis clients et Google",
        p="Après le repas, le client dit comment ça s'est passé, par e-mail, sur le menu QR ou avec le QR «{0}Votre avis{0}» posé sur la table. Content{0}? Son avis est prêt à coller sur Google. Déçu{0}? Le message arrive d'abord chez vous.".format(N),
        ul=["Note des 30 derniers jours, les avis à traiter en premier", "Avis prêt à coller sur votre fiche Google", "Note basse{0}: alerte au responsable, réponse depuis l'app".format(N), "E-mail une fois par réservation, seulement aux clients venus"]),
    "livraison": dict(img="livraison", t="Uber Eats, Deliveroo, Just Eat",
        p="Déposez le relevé de ventes de chaque plateforme{0}: le chiffre, les commissions et ce qui vous est versé arrivent dans vos finances, le stock est déduit selon vos recettes et vous voyez la vraie marge de chaque plat.".format(N),
        ul=["Relevé de ventes, par import", "Commissions dans les finances", "Vraie marge par plat, livraison comprise", f"Commandes en direct sur l'écran cuisine{N}: bientôt"]),
    "passation": dict(img="passation", t="Passation de service",
        p="En fin de service, un mot pour l'équipe suivante{0}: ruptures, casse, client à rappeler, ce qu'il reste à préparer. L'app reprend la journée pour vous, et l'équipe suivante le lit en arrivant et signe.".format(N),
        ul=["Repris tout seul{0}: ruptures, casse, refroidissements, DLC".format(N), "Client à rappeler, avec son numéro", "Lu par qui, et à quelle heure", "Rien à signaler{0}? Un seul geste".format(N)]),
    "journal": dict(img="journal", t="Journal des actions",
        p="Qui a annulé, offert ou modifié quoi, et quand, avec le montant. Chaque ligne est signée et rien ne s'efface, pas même par le gérant.",
        ul=["Annulations et offerts, avec leur motif et leur montant", "Filtres par personne, par jour, par type", f"«{N}À regarder{N}» quand quelqu'un sort du lot", "Export pour le comptable"]),
    "acces": dict(img="acces", t="Accès temporaires",
        p="Un extra pour le week-end, un stagiaire pour un mois{0}: vous choisissez la date de fin, et l'accès se ferme tout seul. Prolonger ou rouvrir, c'est un geste.".format(N),
        ul=["Extra, stagiaire, saison, remplacement", "Ce soir, cette semaine, ce mois ou une date", "Se ferme tout seul, à l'heure dite", "Ce qu'ils ont fait reste signé à leur nom"]),
    "bar": dict(img="bar", t="Écran bar",
        p="Une tablette au comptoir{0}: les boissons de la salle et du menu QR arrivent sur leur propre écran, avec le verre à utiliser. La cuisine ne garde que ses plats.".format(N),
        ul=["Total à préparer par boisson, avec le verre", "«{0}Prêt{0}» prévient le serveur sur son téléphone".format(N), "Desserts lancés{0}: le moment de proposer les cafés".format(N), "Carillon à chaque bon, impression possible"]),
    "recette": dict(img="recette", t="Recette pas à pas au poste",
        p="Depuis une ligne du bon, la recette s'ouvre en grand{0}: grammages calculés pour le nombre d'assiettes, une étape à la fois avec sa photo, et la photo du dressage.".format(N),
        ul=["Grammages au nombre d'assiettes", "Étapes en grand, lisibles de loin", "Minuteurs qui sonnent", "«{0}Fait{0}» coche la ligne du bon".format(N)]),
    "horsligne": dict(img="hors-ligne", t="Mode hors ligne",
        p="Le Wi-Fi tombe en plein service{0}? Commandes, écran cuisine, relevés et étiquettes continuent sur l'appareil, et tout part dès que le réseau revient.".format(N),
        ul=["«{0}Hors ligne · 3 en attente{0}», puis «{0}Tout est à jour{0}»".format(N), "Gardé sur l'appareil, même s'il redémarre", "Repère le Wi-Fi connecté qui ne mène nulle part", "«{0}Tester une coupure{0}» avant le jour J".format(N)]),
    "sombre": dict(img="sombre", t="Mode sombre",
        p="Clair le jour, sombre le soir, ou automatique{0}: chaque appareil a le sien. Les écrans cuisine, bar et coup de feu sont sombres d'office, pour ne pas éblouir.".format(N),
        ul=["Automatique, clair, sombre ou le soir", "Réglé appareil par appareil", "Écrans de service sombres par défaut", "Tous les écrans de l'app, sans exception"]),
    "parcours": dict(img="prise-en-main", t="Prise en main de l'app",
        p="Chacun apprend l'app sur ses vrais écrans{0}: une leçon courte par fonction qu'il utilise, les gestes montrés au doigt, une question pour vérifier. Vous voyez où en est l'équipe.".format(N),
        ul=["Parcours selon le poste et l'appareil", "Une leçon par écran du menu", "Avancement de chaque employé", "Fonctions inutiles coupées, elles disparaissent"]),
    "pointeuse": dict(img="pointeuse", t="Pointeuse",
        p="Arrivée, pause, départ{0}: chacun touche son prénom. Au départ, l'app montre les heures du jour et propose d'imprimer un ticket.".format(N),
        ul=["Sur la tablette de la cuisine", "Ticket des heures sur l'imprimante", "Relevé d'heures en PDF, pour l'employé et le gérant", "Retards visibles"]),
    "planning": dict(img="planif", t="Planning intelligent",
        p="L'app propose la semaine{0}: d'après les couverts prévus, elle place les bonnes personnes selon leurs dispos, leurs congés, leur contrat et le coût. Vous ajustez, vous publiez, chacun le reçoit.".format(N),
        ul=["Couverts prévus d'après les semaines passées et les réservations", "Dispos, congés et heures du contrat respectés", "Coût de la semaine et part du chiffre prévu", "Repères de la convention HCR, export paie"]),
}

# integration labels (Marceau: be honest about what is really linked)
LIVE, IMPORT, SOON = ("it-live", "En direct"), ("it-imp", "Par import"), ("it-soon", "Bientôt")

# ── groups: (id, colour, kicker, title, lede, reversed, [(feature id, pack, integration label)])
SECOND, CHEF = "Pack Second", "Pack Chef"
GROUPS = [
    ("g-temp", "v", "Tous les jours", "Températures et frigos", "Les relevés se font presque tout seuls.", False,
        [("releve", None, None), ("saisie", None, None), ("sondes", None, LIVE), ("alertes", None, None), ("frigo", None, None)]),
    ("g-hygiene", "s", "À chaque service", "Hygiène et traçabilité", "Ce que l'équipe fait à chaque service, en un tap.", True,
        [("service", None, None), ("reception", None, None), ("imprimante", None, None), ("menage", None, None), ("hygiene", None, None)]),
    ("g-cuisine", "l", "En cuisine", "Recettes, allergènes et formation", "Le savoir de la cuisine, au même endroit.", False,
        [("fiche", None, None), ("noteProc", None, None), ("notes", None, None), ("formation", None, None)]),
    ("g-controle", "k", "Le jour du contrôle", "Contrôle sanitaire", "Tout est enregistré. Le dossier sort en un tap.", True,
        [("controle", None, None), ("pms", None, None), ("rappel", None, None), ("registre", None, None), ("regReport", None, None), ("obligations", None, None)]),
    ("g-salle", "r", "En salle", "Réservations, commandes et cuisine", "De la réservation au bon en cuisine, sans commission par couvert.", False,
        [("resa", SECOND, None), ("coupdefeu", SECOND, None), ("reserver", SECOND, None), ("zenchef", SECOND, IMPORT), ("salle", SECOND, None), ("cuisine", SECOND, None), ("bar", SECOND, None), ("recette", None, None), ("menuqr", SECOND, None), ("carte", SECOND, None), ("clients", SECOND, None), ("avis", SECOND, None)]),
    ("g-achats", "t", "Chaque semaine", "Achats, marges et gaspillage", "Acheter juste, connaître sa marge, jeter moins.", True,
        [("marges", None, None), ("factures", None, None), ("prix", SECOND, None), ("achats", None, None), ("fournisseurs", None, None), ("gaspillage", None, None)]),
    ("g-gestion", "s", "Au bureau", "Caisse, stock et chiffres", "Savoir ce que vous avez, ce que vous vendez, ce que vous gagnez.", False,
        [("caisse", SECOND, None), ("livraison", SECOND, IMPORT), ("tickets", SECOND, None), ("frais", SECOND, None), ("stock", SECOND, None), ("dashboard", SECOND, None), ("previsions", SECOND, None), ("finance", CHEF, None), ("banque", CHEF, IMPORT), ("sites", CHEF, None)]),
    ("g-app", "l", "Pendant le service", "Une app qui tient le coup", "Sans réseau, de nuit, et facile à prendre en main.", True,
        [("horsligne", None, None), ("sombre", None, None), ("parcours", None, None)]),
    ("g-equipe", "v", "L'équipe", "Équipe, pointeuse et planning", "Chacun son compte, ses horaires, son planning.", False,
        [("equipe", None, None), ("consignes", None, None), ("notifs", None, None), ("defis", SECOND, None), ("pourboires", SECOND, None), ("passation", None, None), ("journal", None, None), ("acces", None, None), ("pointeuse", SECOND, None), ("planning", CHEF, None), ("staff", CHEF, None)]),
]

PLUS = '<svg class="fi-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

def feat(fid):
    f = dict(OLD.get(fid, {}))
    f.update(NEW.get(fid, {}))
    if not f:
        raise SystemExit("unknown feature " + fid)
    return f

def phone(img, alt, eager=False):
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<div class="phone"><div class="scr"><img src="img/{img}.jpg" alt="{alt}" width="600" height="1301" {load} decoding="async"></div></div>'

out, chips, n = [], [], 0
for gi, (gid, col, kick, title, lede, rev, feats) in enumerate(GROUPS):
    out.append(f'<div class="fg{" rev" if rev else ""}" id="{gid}" data-c="{col}" data-r>')
    out.append(f'<div class="fg-l"><div class="fg-head"><span class="fg-n">{esc(kick)}</span><h3>{esc(title)}</h3><p>{esc(lede)}</p></div>')
    lis = []
    for k, (fid, pack, integ) in enumerate(feats):
        n += 1
        f = feat(fid)
        t = f["t"]
        tplain = html.unescape(t)
        on = k == 0
        tags = (f'<span class="tag {integ[0]}">{integ[1]}</span>' if integ else "") + (f'<span class="tag">{pack}</span>' if pack else "")
        tags = f'<span class="fi-tags">{tags}</span>' if tags else ""
        ul = "".join(f"<li>{x}</li>" for x in f["ul"])
        alt = esc(f"Écran {tplain} de l'app Growth Gusto")
        lis.append(
            f'<li class="fi{" on" if on else ""}" id="f-{fid}" data-img="{f["img"]}" data-t="{esc(tplain)}">\n'
            f'<button class="fi-b" type="button" aria-expanded="{"true" if on else "false"}"><span class="fi-n">{n:02d}</span><span class="fi-t">{t}{tags}</span>{PLUS}</button>\n'
            f'<div class="fi-d"><div><p>{f["p"]}</p><ul>{ul}</ul>\n'
            f'<figure class="fi-m">{phone(f["img"], alt)}</figure></div></div>\n</li>')
        chips.append(f'<a class="chip" href="#f-{fid}" data-feat="{fid}">{t}</a>')
    out.append('<ul class="flist" role="list">' + "".join(lis) + "</ul></div>")
    f0 = feat(feats[0][0])
    out.append(f'<div class="stage" aria-hidden="true"><i class="dk"></i><span class="cap">{f0["t"]}</span>{phone(f0["img"], "")}</div>')
    out.append("</div>")

chips.append('<a class="chip" href="#integrations">Ce qui se relie</a><a class="chip" href="#import">Import depuis un autre logiciel</a>')

def put(name, body):
    global h
    a, b = f"<!--{name}:start-->", f"<!--{name}:end-->"
    i, j = h.index(a) + len(a), h.index(b)
    h = h[:i] + "\n" + body + "\n" + h[j:]

put("feat", "\n".join(out))
put("chips", f'<p class="chips-h"><b>{n} fonctions</b>, une seule app</p>\n<div class="chips">' + "".join(chips) + "</div>")
P.write_text(h)
print(n, "features in", len(GROUPS), "groups")

# ── structured data (SEO): organisation, the app with its three packs, and the FAQ read back from the page
import json
def text(x):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", x))).strip()
faq = [{"@type": "Question", "name": text(q), "acceptedAnswer": {"@type": "Answer", "text": text(a)}}
       for q, a in re.findall(r'<details><summary>(.*?)<i aria-hidden="true"></i></summary><div class="ans">(.*?)</div></details>', h, re.S)]
packs = [("Commis", "59", "essentiel", "Hygiène et HACCP"), ("Second", "109", "pro", "Salle, commandes, caisse et stock en plus"), ("Chef", "169", "complet", "Équipe, finances et plusieurs restaurants en plus")]
ld = [
    {"@context": "https://schema.org", "@type": "Organization", "name": "Growth Gusto", "url": "https://growthgusto.fr/",
     "logo": "https://growthgusto.fr/apple-touch-icon.png", "email": "contact@growthgusto.fr",
     "address": {"@type": "PostalAddress", "addressLocality": "Lyon", "addressCountry": "FR"}},
    {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Growth Gusto", "url": "https://growthgusto.fr/",
     "applicationCategory": "BusinessApplication", "applicationSubCategory": "Logiciel de gestion de restaurant",
     "operatingSystem": "Web, iOS, Android, Windows, macOS", "inLanguage": "fr", "image": "https://growthgusto.fr/og.jpg",
     "description": "L'app de gestion pour restaurants : HACCP et relevés de températures, étiquettes DLC, contrôle sanitaire, réservations, prise de commande, menu QR, stock, marges, caisse, équipe et finances.",
     "featureList": [html.unescape(re.sub(r"<[^>]+>", "", c)) for c in re.findall(r'<a class="chip" href="#f-[^"]+" data-feat="[^"]+">(.*?)</a>', h)],
     "offers": [{"@type": "Offer", "name": f"Pack {n}", "description": d, "price": p, "priceCurrency": "EUR",
                 "url": f"https://app.growthgusto.fr/?signup=1&plan={k}",
                 "priceSpecification": {"@type": "UnitPriceSpecification", "price": p, "priceCurrency": "EUR", "unitText": "MONTH", "valueAddedTaxIncluded": False}}
                for n, p, k, d in packs]},
]
if faq:
    ld.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq})
body = "\n".join('<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>" for x in ld)
put("ld", body)
P.write_text(h)
print(len(faq), "FAQ entries in structured data")
