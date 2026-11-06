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
    "gaspillage": dict(img="gaspillage", t="Gaspillage en euros",
        p="Pertes, invendus, produits dont la DLC est passée{0}: tout est chiffré au coût de la recette, avec des pistes pour jeter moins.".format(N),
        ul=["Jeté du mois, part des achats", "Projection sur l'année", "Lots à jeter en un geste", "Les produits souvent jetés commandés au plus juste"]),
    "zenchef": dict(img="zenchef", t="Réservations Zenchef et TheFork",
        p="Vous gardez votre outil de réservation{0}? Chaque e-mail de réservation, modification ou annulation est repris tout seul dans votre carnet et sur le plan de salle.".format(N),
        ul=["Une adresse e-mail à vous, à mettre dans Zenchef", "Ou import du fichier des réservations", "Passer à nos réservations quand vous voulez"]),
    "salle": dict(img="salle", t="Prise de commande au téléphone",
        p="Le serveur touche la table sur le plan de salle, ajoute les plats, les cuissons et les allergies du client, puis envoie en cuisine. Suite par suite.",
        ul=["Boissons, entrées, plats, desserts", "Alerte si un plat contient l'allergie du client", "Prévenu quand c'est prêt", "Addition à encaisser sur votre caisse"]),
    "cuisine": dict(img="cuisine", t="Écran cuisine",
        p="Une tablette au passe{0}: les bons de la salle et du menu QR arrivent ensemble, avec un minuteur et les allergies en rouge.".format(N),
        ul=["Lancer, prêt, à suivre", "Filtre cuisine ou bar", "Carillon à chaque bon", "Bon imprimé sur l'imprimante d'étiquettes"]),
    "menuqr": dict(img="menu-qr", t="Menu QR et commande en ligne",
        p="Un QR code sur chaque table et un lien à emporter{0}: le client voit la carte avec photos et allergènes, commande, et peut payer en ligne.".format(N),
        ul=["Sur place ou à emporter, avec créneaux", "Paiement en ligne par Stripe", "Suivi de la commande en direct", "Sans commission Growth Gusto"]),
    "carte": dict(img="carte-import", t="Votre carte importée",
        p="Donnez le PDF, une photo ou l'adresse de votre site{0}: l'app lit la carte, devine les allergènes et vous laisse tout vérifier avant de publier.".format(N),
        ul=["Rubriques, prix, descriptions", "Allergènes devinés, à confirmer", "3 styles, 6 couleurs, photos", "Impression A4 de la carte"]),
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
        [("resa", SECOND, None), ("reserver", SECOND, None), ("zenchef", SECOND, IMPORT), ("salle", SECOND, None), ("cuisine", SECOND, None), ("menuqr", SECOND, None), ("carte", SECOND, None)]),
    ("g-achats", "t", "Chaque semaine", "Achats, marges et gaspillage", "Acheter juste, connaître sa marge, jeter moins.", True,
        [("marges", None, None), ("factures", None, None), ("achats", None, None), ("gaspillage", None, None)]),
    ("g-gestion", "s", "Au bureau", "Caisse, stock et chiffres", "Savoir ce que vous avez, ce que vous vendez, ce que vous gagnez.", False,
        [("caisse", SECOND, None), ("tickets", SECOND, None), ("stock", SECOND, None), ("dashboard", SECOND, None), ("finance", CHEF, None), ("banque", CHEF, IMPORT), ("sites", CHEF, None)]),
    ("g-equipe", "v", "L'équipe", "Équipe, pointeuse et planning", "Chacun son compte, ses horaires, son planning.", True,
        [("equipe", None, None), ("pointeuse", CHEF, None), ("planning", CHEF, None), ("staff", CHEF, None)]),
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
    return f'<div class="phone"><div class="scr"><img src="img/{img}.jpg" alt="{alt}" width="600" height="1382" {load} decoding="async"></div></div>'

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
