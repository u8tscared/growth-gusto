"""Comparisons: /comparatif and /comparatif/<competitor>. Public facts only, dated, no logos."""
from build import page, hero, band, card, faq_html, faq_ld, e, btn_try, btn_demo, BASE, ARROW

DATE = "5 novembre 2026"
Y = '<span class="y"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg><span class="sr">Oui</span></span>'
N = '<span class="n" aria-hidden="true">—</span><span class="sr">Non indiqué</span>'

# Columns: Growth Gusto (Chef), ePackPro, Octopus, Traqfood, Koust, Combo, Zenchef. "Y" = yes, "-" = not stated, other = option text.
ROWS = [
 ("Hygiène et HACCP", None),
 ("Relevés de températures", ["Y", "Y", "Y", "Y", "En option | 38 €/mois", "-", "-"]),
 ("Sondes sans fil", ["Y", "Formule Sérénité", "En option | 6 €/sonde", "-", "-", "-", "-"]),
 ("Étiquettes DLC", ["Y", "En option | imprimante 20 €/mois", "En option | imprimante 20 €/mois", "Y", "En option | 38 €/mois", "-", "-"]),
 ("Réception des livraisons", ["Y", "Y", "Y", "Y", "Y", "-", "-"]),
 ("Plan de nettoyage", ["Y", "Y", "Y", "Y", "En option | 38 €/mois", "-", "-"]),
 ("Refroidissement et huiles de friture", ["Y", "-", "Y", "Y", "-", "-", "-"]),
 ("Recettes et allergènes", ["Y", "-", "-", "Y", "Allergènes en option", "-", "-"]),
 ("Traçabilité et rappel de lot", ["Y", "Y", "Y", "Y", "En option | 38 €/mois", "-", "-"]),
 ("Dossier PDF pour le contrôle sanitaire", ["Y", "-", "Y", "Y", "-", "-", "-"]),
 ("Plan de maîtrise sanitaire rédigé pour vous", ["Y", "-", "-", "-", "-", "-", "-"]),
 ("Formation HACCP de l'équipe", ["Y", "Y", "Y", "Formule Manager", "-", "-", "-"]),
 ("Salle", None),
 ("Réservations en ligne, sans commission", ["Y", "-", "-", "-", "-", "-", "Y"]),
 ("Plan de salle", ["Y", "-", "-", "-", "-", "-", "Y"]),
 ("Caisse et gestion", None),
 ("Stock et inventaire", ["Y", "-", "-", "Y", "Y", "-", "-"]),
 ("Ventes de la caisse déduites du stock", ["Y", "-", "-", "-", "Y", "-", "-"]),
 ("Marges et tableau de bord", ["Y", "-", "-", "-", "Y", "-", "-"]),
 ("Lien avec Pennylane", ["Y", "-", "-", "-", "Y", "-", "-"]),
 ("Relevé bancaire dans les finances", ["Y", "-", "-", "-", "-", "-", "-"]),
 ("Équipe", None),
 ("Planning de l'équipe", ["Y", "-", "-", "-", "-", "Y", "-"]),
 ("Pointeuse", ["Y", "-", "-", "-", "-", "En option | 2 €/salarié", "-"]),
 ("Export paie pour le comptable", ["Y", "-", "-", "-", "-", "Y", "-"]),
 ("Plusieurs restaurants", ["Y", "Y", "Y", "Formule Manager", "Formule Entreprise", "Y", "Formule Grow"]),
]
PRICE = ["169 € | par mois, tout compris", "119 à 154 € | par mois, tablette comprise", "dès 55 € | par mois selon modules, + matériel",
         "20 à 45 € | par mois, 1 an d'engagement pour Manager", "80 à 210 € | par mois, hygiène + 38 €", "68 à 89 € | par établissement, pointeuse + 2 €/salarié", "129 à 249 € | par mois"]

COMP = [
 dict(slug="epackpro", name="ePackPro", kind="HACCP", col=1, gg="essentiel",
  what="ePackPro est une solution HACCP française, vendue avec une tablette, pour les relevés, la traçabilité et le nettoyage.",
  fit="si vous voulez une tablette fournie avec l'abonnement et que vous n'avez besoin que du HACCP.",
  ggfit="si vous voulez aussi les recettes et les allergènes, le refroidissement, le dossier PDF de contrôle et un plan de maîtrise sanitaire rédigé, sur les téléphones que vous avez déjà.",
  focus="haccp-temperatures"),
 dict(slug="octopus-haccp", name="Octopus HACCP", kind="HACCP", col=2, gg="essentiel",
  what="Octopus HACCP est une application HACCP modulaire : on compose son abonnement selon les modules et le matériel choisis.",
  fit="si vous voulez composer votre abonnement module par module avec leur matériel.",
  ggfit="si vous préférez un prix fixe où tout l'HACCP est inclus, recettes, allergènes et plan de maîtrise sanitaire compris, avec le matériel du commerce.",
  focus="controle-sanitaire"),
 dict(slug="traqfood", name="Traqfood", kind="HACCP", col=3, gg="essentiel",
  what="Traqfood est une application HACCP avec étiquettes, recettes et un module de stock selon la formule.",
  fit="si votre budget HACCP est serré et qu'un engagement d'un an vous convient pour la formule Manager.",
  ggfit="si vous voulez rester sans engagement, avoir le plan de maîtrise sanitaire rédigé, et pouvoir ajouter la salle, la caisse et l'équipe sans changer d'app.",
  focus="etiquettes-dlc"),
 dict(slug="koust", name="Koust", kind="stock et food cost", col=4, gg="pro",
  what="Koust est un logiciel de gestion des stocks, des achats et du food cost, avec un module hygiène en option.",
  fit="si votre priorité est la gestion fine des stocks et des achats sur plusieurs sites.",
  ggfit="si vous voulez l'hygiène complète incluse, la salle et les réservations au même endroit, pour un prix plus bas.",
  focus="caisse-stock"),
 dict(slug="combo", name="Combo", kind="planning", col=5, gg="complet",
  what="Combo est un logiciel de planning et de gestion des heures pour la restauration, avec une pointeuse en option.",
  fit="si vous ne cherchez qu'un outil de planning, sans hygiène ni salle.",
  ggfit="si vous voulez le planning, la pointeuse et l'export paie avec tout le reste du restaurant, dans un seul abonnement.",
  focus="equipe-planning"),
 dict(slug="zenchef", name="Zenchef", kind="réservations", col=6, gg="pro",
  what="Zenchef est une solution de réservation en ligne et de plan de salle pour les restaurants.",
  fit="si vous voulez avant tout leur visibilité et leurs outils marketing autour de la réservation.",
  ggfit="si vous voulez le carnet de réservations et le plan de salle sans commission, avec l'hygiène, la caisse et le stock dans la même app. Vous pouvez aussi garder Zenchef : ses réservations arrivent dans Growth Gusto par import.",
  focus="reservations"),
]
CBY = {c["slug"]: c for c in COMP}
PNAME = {"essentiel": ("Commis", "59"), "pro": ("Second", "109"), "complet": ("Chef", "169")}

cap = lambda s: s[:1].upper() + s[1:]

def cell(v, gg=False):
    cls = ' class="gg"' if gg else ""
    if v == "Y": return f"<td{cls}>{Y}</td>"
    if v == "-": return f"<td{cls}>{N}</td>"
    a, _, b = v.partition(" | ")
    return f'<td{cls}><span class="o">{e(a)}</span>' + (f"<small>{e(b)}</small>" if b else "") + "</td>"

def table(cols):
    heads = ["Growth Gusto<small>Pack Chef</small>"] + [f"{c['name']}<small>{e(cap(c['kind']))}</small>" for c in COMP]
    idx = [0] + [c["col"] for c in cols]
    th = "".join(f'<th scope="col"{" class=\"gg\"" if i == 0 else ""}>{heads[i]}</th>' for i in idx)
    rows = ""
    for name, vals in ROWS:
        if vals is None:
            rows += f'<tr class="cg"><th scope="rowgroup" colspan="{len(idx) + 1}">{e(name)}</th></tr>'
        else:
            rows += f'<tr><th scope="row">{e(name)}</th>' + "".join(cell(vals[i], i == 0) for i in idx) + "</tr>"
    pr = "".join(f'<td{" class=\"gg\"" if i == 0 else ""}><b>{e(PRICE[i].split(" | ")[0])}</b><small>{e(PRICE[i].split(" | ")[1])}</small></td>' for i in idx)
    rows += f'<tr class="pr"><th scope="row">Prix public, HT</th>{pr}</tr>'
    return f'<div class="tbl-w" data-r tabindex="0" role="region" aria-label="Tableau comparatif, défilable"><table class="cmpt{" two" if len(cols) == 1 else ""}"><thead><tr><th scope="col"><span class="sr">Fonction</span></th>{th}</tr></thead><tbody>{rows}</tbody></table></div>'

NOTE = (f'<p class="src">Fonctions et tarifs publics constatés le {DATE} sur les sites des éditeurs, hors taxes, hors matériel sauf mention. '
        "«&nbsp;—&nbsp;» veut dire que la fonction n'est pas indiquée sur le site de l'éditeur, pas forcément qu'elle n'existe pas&nbsp;: certaines fonctions peuvent exister via des partenaires. "
        "Les offres évoluent, vérifiez-les auprès de chaque éditeur. Les noms cités sont des marques de leurs propriétaires respectifs&nbsp;; Growth Gusto n'est pas affilié à ces éditeurs. "
        'Une erreur&nbsp;? Écrivez à <a href="mailto:contact@growthgusto.fr">contact@growthgusto.fr</a>, nous corrigeons.</p>')

def build():
    from content_features import BY
    hub = [("/", "Accueil"), ("/comparatif", "Comparatif")]
    body = hero(hub, "Comparatif", 'Une app au lieu de <span class="hl">quatre abonnements.</span>',
                "Les logiciels pour restaurants font souvent une seule chose : l'hygiène, le stock, le planning ou les réservations. Voici, fonction par fonction et prix public par prix public, ce que fait chacun.",
                meta=f"Tarifs publics constatés le {DATE}")
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Tout le tableau</span><h2>Fonction par fonction.</h2><p>Faites glisser le tableau sur téléphone.</p></div>{table(COMP)}{NOTE}</section>'
    body += ('<section class="sec wrap"><div class="note" data-r><b>Tout avoir ailleurs coûte environ 400 à 700&nbsp;€ HT par mois.</b> '
             "HACCP chez ePackPro, stock chez Koust, planning chez Combo, réservations chez Zenchef&nbsp;: quatre apps à apprendre, et toujours ni relevé bancaire ni plan de maîtrise sanitaire. "
             'Avec Growth Gusto Chef&nbsp;: 169&nbsp;€ HT par mois, une seule app. <a href="/tarifs">Voir les tarifs</a>.</div></section>')
    cards = "".join(card(f"/comparatif/{c['slug']}", f"Growth Gusto ou {e(c['name'])}&nbsp;?", e(c["what"]), "scale", ["", "s", "k", "l", "r", ""][i], go="Comparer", dl=i % 3) for i, c in enumerate(COMP))
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Un par un</span><h2>Comparer avec un logiciel précis.</h2></div><div class="cards c3">{cards}</div></section>'
    body += band()
    page("/comparatif", "Comparatif des logiciels pour restaurants 2026 · HACCP, stock, planning, réservations · Growth Gusto",
         "Growth Gusto comparé à ePackPro, Octopus HACCP, Traqfood, Koust, Combo et Zenchef : fonctions et tarifs publics HT, constatés en novembre 2026.",
         body, hub, ld=[{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{BASE}/comparatif/{c['slug']}", "name": f"Growth Gusto ou {c['name']}"} for i, c in enumerate(COMP)]}])

    for c in COMP:
        trail = hub + [(f"/comparatif/{c['slug']}", f"Growth Gusto ou {c['name']}")]
        pn, pp = PNAME[c["gg"]]
        body = hero(trail, f"Comparatif {c['kind']}", f'Growth Gusto ou {e(c["name"])}&nbsp;? <span class="hl">Le vrai comparatif.</span>',
                    e(c["what"]) + " Voici ce que fait chacun, d'après les informations publiques.",
                    meta=f"Tarifs publics constatés le {DATE}", ctas=btn_try("w", f"Essayer {pn} 14 jours", c["gg"]) + btn_demo())
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Fonction par fonction</span><h2>Ce que fait chacun.</h2></div>{table([c])}{NOTE}</section>'
        body += f'''<section class="sec wrap"><div class="cards c3" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
<div class="card" data-r><h3>{e(c["name"])} peut vous convenir</h3><p>{e(cap(c["fit"]))}</p></div>
<div class="card" data-r style="--dl:1"><h3>Growth Gusto vous conviendra</h3><p>{e(cap(c["ggfit"]))}</p></div>
</div></section>'''
        steps = [("Exportez vos données", f"Depuis {c['name']}, en Excel ou CSV : produits, fournisseurs, recettes, équipe, selon ce que le logiciel permet."),
                 ("Déposez-les dans Growth Gusto", "L'import range tout au bon endroit, et s'annule en un tap si besoin."),
                 ("Testez 14 jours", "Sans carte bancaire. Gardez les deux en parallèle le temps d'être sûr.")]
        st = "".join(f'<li data-r style="--dl:{i}"><b>{e(a)}</b><span>{e(b)}</span></li>' for i, (a, b) in enumerate(steps))
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Changer</span><h2>Passer de {e(c["name"])} à Growth Gusto.</h2></div><ol class="steps">{st}</ol></section>'
        faq = [(f"Growth Gusto est-il moins cher que {c['name']} ?", f"Le pack {pn} de Growth Gusto, qui couvre ce que fait {c['name']}, coûte {pp} € HT par mois, sans engagement. Le prix public de {c['name']} constaté le {DATE} : {PRICE[c['col']].replace(' | ', ' ')}, HT. Comparez avec votre devis, les offres évoluent."),
               (f"Puis-je récupérer mes données de {c['name']} ?", "Si le logiciel permet un export Excel ou CSV, oui : déposez le fichier dans l'app et Growth Gusto range les données. Nous pouvons vous aider à le faire."),
               ("Y a-t-il un engagement ?", "Non. Growth Gusto est mensuel, sans engagement et sans frais d'installation, avec 14 jours d'essai gratuits.")]
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Questions</span><h2>Ce qu\'on nous demande.</h2></div>{faq_html(faq)}</section>'
        f = BY[c["focus"]]
        others = [o for o in COMP if o is not c][:2]
        rel = card(f"/fonctionnalites/{f['slug']}", e(f["short"]), e(f["card"]), f["ic"], f["icc"], shot=f["img"]) + "".join(
            card(f"/comparatif/{o['slug']}", f"Growth Gusto ou {e(o['name'])}&nbsp;?", e(o["what"]), "scale", "s", go="Comparer", dl=i + 1) for i, o in enumerate(others))
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Pour aller plus loin</span><h2>À voir aussi.</h2></div><div class="cards c3">{rel}</div></section>'
        body += band()
        page(f"/comparatif/{c['slug']}", f"Growth Gusto ou {c['name']} ? Comparatif {c['kind']} 2026, fonctions et prix · Growth Gusto",
             f"Growth Gusto comparé à {c['name']} : fonctions, prix publics HT et engagement, constatés le {DATE}. Ce que fait chacun, et comment changer.",
             body, trail, ld=[faq_ld(faq)])
