"""Tarifs, intégrations, FAQ, à propos, contact."""
from build import page, hero, band, card, faq_html, faq_ld, icon, e, btn_try, btn_demo, BASE, APP, ARROW

N = "&nbsp;"
ORG = {"@context": "https://schema.org", "@type": "Organization", "name": "Growth Gusto", "url": BASE, "logo": f"{BASE}/apple-touch-icon.png",
       "email": "contact@growthgusto.fr", "legalName": "EI Ruis Global", "taxID": "934733122",
       "address": {"@type": "PostalAddress", "addressLocality": "Lyon", "addressCountry": "FR"}}

PLANS = [
 ("essentiel", "Commis", "59", "L'hygiène carrée, sans y penser : tout le HACCP d'un restaurant.", None, [
   ("Températures", ["Relevés au doigt, à la voix ou au thermomètre Bluetooth", "Sondes sans fil et relevés automatiques", "Alertes par e-mail et bilan du lundi"]),
   ("Hygiène et cuisine", ["Frigos, mise en place, réception des livraisons", "Étiquettes DLC, QR et scan", "Plan de nettoyage, refroidissement, friture", "Fiches recettes, 14 allergènes, process HACCP", "Formation HACCP de l'équipe"]),
   ("Contrôle sanitaire", ["Mode contrôle et dossier PDF", "PMS rédigé pour vous", "Registre, rappel de lot, obligations"]),
   ("Achats et marges", ["Marge de chaque plat, fiches techniques chiffrées", "Factures fournisseurs scannées", "Commandes fournisseurs préparées", "Gaspillage en euros"]),
   ("Et aussi", ["Consignes et messagerie d'équipe", "Passation de service et journal des actions", "Accès temporaires pour extras et stagiaires", "Mode hors ligne, mode sombre, prise en main de l'app", "Import depuis votre ancien logiciel", "Comptes équipe illimités"])]),
 ("pro", "Second", "109", "La salle et la caisse en plus : tout le service, du frigo à l'addition.", "Tout Commis, plus :", [
   ("Salle", ["Carnet de réservations, sans commission", "Lien de réservation pour vos clients", "Plan de salle et placement automatique", "Prise de commande, écran cuisine, ruptures en direct", "Écran bar et recettes pas à pas au poste", "Coup de feu calé sur les réservations", "Avis clients après le repas, prêts à coller sur Google", "Menu QR et commande en ligne, carte importée", "Réservations Zenchef et TheFork, par import", "Fichier clients et fidélité"]),
   ("Caisse et stock", ["Caisse reliée en direct : SumUp, Square", "Autres caisses : import des ventes ou photo du ticket Z", "Uber Eats, Deliveroo, Just Eat : import des relevés", "Stock déduit des ventes, selon vos recettes", "Inventaire mensuel guidé", "Notes de frais avec TVA ventilée", "Tableau de bord"]),
   ("Équipe", ["Pointeuse et ticket d'heures", "Planning de la semaine", "Relevé d'heures en PDF", "Heures et repères HCR"])]),
 ("complet", "Chef", "169", "Toute la maison tourne : HACCP, salle, caisse, stock, équipe et chiffres.", "Tout Second, plus :", [
   ("Équipe", ["Planning intelligent, proposé d'après les couverts prévus", "Coût du personnel et heures sup. en euros", "Export paie pour le comptable", "Employés et salaires"]),
   ("Finances", ["Finances et marges", "Banque : import du relevé (connexion directe bientôt)", "Lien direct avec Pennylane"]),
   ("Et aussi", ["Plusieurs marques dans une même cuisine : chiffre et marge de chacune", "Plusieurs restaurants, 49 € HT par restaurant en plus", "Mise en route avec nous (visio 30 min)", "Support prioritaire 7 j/7"])]),
]

# feature, Commis, Second, Chef
MATRIX = [
 ("Relevés de températures, sondes, alertes", 1, 1, 1), ("Étiquettes DLC, réception, mise en place", 1, 1, 1), ("Nettoyage, refroidissement, friture", 1, 1, 1),
 ("Recettes, 14 allergènes, process HACCP", 1, 1, 1), ("Mode contrôle, dossier PDF, PMS rédigé", 1, 1, 1), ("Formation HACCP", 1, 1, 1),
 ("Marges, factures, commandes fournisseurs, gaspillage", 1, 1, 1), ("Consignes et messagerie d'équipe, par groupes", 1, 1, 1), ("Passation de service, journal des actions, accès temporaires", 1, 1, 1), ("Mode hors ligne, mode sombre, prise en main de l'app", 1, 1, 1),
 ("Réservations et plan de salle", 0, 1, 1), ("Prise de commande, écran cuisine, écran bar", 0, 1, 1), ("Menu QR et commande en ligne", 0, 1, 1),
 ("Caisse, stock, inventaire, tableau de bord", 0, 1, 1), ("Relevés Uber Eats, Deliveroo, Just Eat", 0, 1, 1), ("Fichier clients, fidélité, avis clients et Google", 0, 1, 1), ("Notes de frais avec TVA", 0, 1, 1),
 ("Pointeuse, planning de la semaine, relevé d'heures", 0, 1, 1), ("Planning intelligent, coûts du personnel, export paie", 0, 0, 1), ("Finances, relevé bancaire, Pennylane", 0, 0, 1), ("Plusieurs marques dans une même cuisine", 0, 0, 1), ("Plusieurs restaurants", 0, 0, 1),
]

PRICE_FAQ = [
 ("Y a-t-il un engagement ?", "Non. L'abonnement est mensuel, sans engagement et sans frais d'installation. Vous résiliez depuis l'app, quand vous voulez."),
 ("Comment marche l'essai de 14 jours ?", "Vous créez votre compte, sans carte bancaire, et vous avez toute l'app pendant 14 jours. Ensuite, vous choisissez Commis, Second ou Chef pour continuer."),
 ("Les prix sont-ils HT ?", "Oui, les prix sont indiqués hors taxes, par mois et par restaurant. TVA non applicable, article 293 B du CGI."),
 ("Puis-je changer de pack ?", "Oui, à tout moment, depuis l'app ou en nous écrivant."),
 ("J'ai plusieurs restaurants.", "Avec le pack Chef, un seul compte suffit, à 49 € HT par mois par restaurant en plus : vous passez d'un établissement à l'autre et vous voyez où en est chacun."),
 ("Le matériel est-il compris ?", "Non. Sondes, thermomètre Bluetooth et imprimante d'étiquettes ne sont pas fournis : l'app marche avec le matériel du commerce, et sans matériel du tout."),
 ("Une commission sur les réservations ou les commandes ?", "Aucune. Seuls les frais de paiement Stripe s'appliquent si vous activez le paiement en ligne des commandes."),
]

FAQ = [
 ("L'abonnement", [
   ("Y a-t-il un engagement ?", PRICE_FAQ[0][1]), ("Comment marche l'essai de 14 jours ?", PRICE_FAQ[1][1]), ("Les prix sont-ils HT ?", PRICE_FAQ[2][1]),
   ("Toute l'équipe peut l'utiliser ?", "Oui, les utilisateurs sont illimités dans les trois packs. Chacun a son compte : chaque relevé, chaque étiquette, chaque tâche garde le nom de qui l'a fait."),
   ("J'ai plusieurs restaurants.", PRICE_FAQ[4][1]),
   ("Puis-je voir l'app avant de m'inscrire ?", f'Oui : la <a href="{APP}/?demo=1" target="_blank" rel="noopener">démo</a> est déjà remplie avec un restaurant fictif. Rien n\'y est enregistré.')]),
 ("Le matériel", [
   ("De quel matériel ai-je besoin ?", "Un téléphone, une tablette ou un ordinateur : Growth Gusto s'installe depuis le navigateur, sur iPhone comme sur Android. Gardez votre thermomètre et tapez ou dictez la valeur. Pour aller plus loin : des sondes sans fil ou un thermomètre-sonde Bluetooth. Le matériel n'est pas fourni."),
   ("Les sondes sans fil, comment ça marche ?", "Vous posez la sonde dans le frigo, vous l'ajoutez dans l'app en suivant les étapes, et c'est tout. La température remonte toute seule, les relevés du midi et du soir s'enregistrent, et vous recevez un e-mail si un frigo sort de sa plage. Marques compatibles : Shelly, SensorPush, Govee, UbiBot et capteurs LoRaWAN."),
   ("Et le thermomètre Bluetooth ?", "Sur Android et sur ordinateur, il se connecte directement depuis le navigateur Chrome. Sur iPhone, Safari ne gère pas le Bluetooth : il marche avec le navigateur gratuit Bluefy. La dictée vocale, elle, marche partout."),
   ("Quelle imprimante pour les étiquettes ?", "Une imprimante d'étiquettes Wi-Fi compatible AirPrint, par exemple la Brother QL-810Wc avec des rouleaux de 62 mm. Avec le pack Chef, nous la configurons avec vous pendant la mise en route. Sans imprimante, l'app fonctionne aussi."),
   ("Ça marche sans réseau ?", "Oui. Si le Wi-Fi tombe en plein service, l'app continue : commandes, écran cuisine, relevés, étiquettes et stock restent utilisables et sont gardés sur l'appareil. Une petite bulle compte ce qui attend, et tout part tout seul dès que le réseau revient, même après avoir fermé l'app. Vous pouvez tester une coupure depuis les réglages.")]),
 ("Ce qui se relie", [
   ("Qu'est-ce qui est relié en direct ?", "<b>En direct</b>, les données arrivent toutes seules : les caisses SumUp et Square, Pennylane, et les sondes et thermomètres sans fil. <b>Par import</b>, vous déposez un fichier ou transférez un e-mail : les autres caisses, Uber Eats, Deliveroo et Just Eat, le relevé bancaire, et les réservations Zenchef ou TheFork. <b>Bientôt en direct</b> : Zelty, Lightspeed, votre banque, et les commandes des plateformes de livraison."),
   ("Ma caisse est-elle compatible ?", "SumUp et Square se relient en direct (packs Second et Chef) : les ventes arrivent toutes seules. Zelty et Lightspeed arrivent bientôt en direct. En attendant, et pour toute autre caisse, importez le fichier des ventes ou photographiez le ticket Z du soir."),
   ("Uber Eats, Deliveroo, Just Eat ?", "Ce n'est pas relié en direct : vous téléchargez le relevé de ventes dans votre espace Uber Eats, Deliveroo ou Just Eat, et vous le déposez dans l'app. Growth Gusto en tire le chiffre d'affaires, les commissions, le stock déduit et la vraie marge de chaque plat. Les commandes en direct sur l'écran cuisine arrivent bientôt, en option."),
   ("Je viens d'un autre logiciel. Je perds tout ?", "Non. Exportez vos données en Excel ou CSV et déposez-les dans l'app : produits, fournisseurs, recettes, relevés, équipe. Tout est rangé directement dans Growth Gusto, et l'import s'annule en un tap si besoin.")]),
 ("Hygiène et contrôle", [
   ("Growth Gusto remplace-t-il le classeur HACCP ?", 'Oui : relevés, réceptions, nettoyage, étiquettes, refroidissement et formation sont enregistrés dans l\'app, avec le nom et l\'heure. Le jour du contrôle, le mode contrôle et le dossier PDF montrent tout. Voir <a href="/guides/controle-sanitaire-ddpp">comment se préparer à un contrôle</a>.'),
   ("Le plan de maîtrise sanitaire est-il fourni ?", 'L\'app rédige votre PMS à partir de vos équipements, de vos recettes et de vos procédures. Vous le relisez, le complétez et l\'imprimez. Voir <a href="/guides/plan-de-maitrise-sanitaire">le guide du PMS</a>.'),
   ("La formation hygiène est-elle comprise ?", 'L\'app contient une formation HACCP pour l\'équipe. La formation obligatoire de 14 heures pour l\'établissement se fait auprès d\'un organisme agréé. Voir <a href="/guides/formation-hygiene-obligatoire">le guide</a>.')]),
 ("Vos données", [
   ("Où sont hébergées mes données ?", "En France. Vos données sont traitées dans le respect du RGPD, elles restent à vous, et vous les exportez quand vous voulez.")]),
]

LINKS = [
 ("lk-live", "En direct", "Les données arrivent toutes seules, sans rien faire.", [
   ("Caisses SumUp et Square", "Les ventes arrivent dans l'app, le stock est déduit selon vos recettes."), ("Pennylane", "Les tickets Z partent en écritures de ventes, les factures fournisseurs reviennent."),
   ("Sondes sans fil", "Shelly, SensorPush, Govee, UbiBot, capteurs LoRaWAN (Milesight, TTN, ChirpStack)."), ("Thermomètre-sonde Bluetooth", "La valeur arrive toute seule dans le relevé ou la réception.")]),
 ("lk-imp", "Par import", "Vous déposez un fichier ou transférez un e-mail, l'app range tout.", [
   ("Autres caisses", "Fichier des ventes, ou photo du ticket Z du soir."), ("Uber Eats, Deliveroo, Just Eat", "Le relevé de ventes : chiffre, commissions, stock déduit. Pack Second."),
   ("Relevé bancaire", "Fichier OFX ou CSV de votre compte pro, dépenses rangées par catégorie."), ("Zenchef et TheFork", "Les réservations, par transfert des e-mails de confirmation."),
   ("Votre ancien logiciel", "Produits, fournisseurs, recettes, relevés, équipe, en Excel ou CSV.")]),
 ("lk-soon", "Bientôt en direct", "En préparation. En attendant, ça marche par import.", [
   ("Zelty et Lightspeed", "Les ventes de ces caisses, sans import."), ("Votre banque", "Les opérations du compte pro, sans déposer de fichier."),
   ("Commandes des plateformes", "Les commandes Uber Eats, Deliveroo et Just Eat en direct sur l'écran cuisine, en option.")]),
]

def plans_html():
    out = ""
    for i, (pid, name, price, who, all_, groups) in enumerate(PLANS):
        hi = pid == "complet"
        li = (f'<li class="grp">{e(all_)}</li>' if all_ else "") + "".join(f'<li class="grp">{e(g)}</li>' + "".join(f"<li>{e(x)}</li>" for x in items) for g, items in groups)
        btn = f'<a class="btn {"v" if hi else "soft"}" href="{APP}/?signup=1&amp;plan={pid}" target="_blank" rel="noopener">Essayer {name} 14 jours</a>'
        out += f'''<article class="plan{" hi" if hi else ""}" data-r style="--dl:{i}">{'<span class="sticker">Tout compris</span>' if hi else ""}<h3>{name}</h3><p class="who">{e(who)}</p>
<div class="price"><b>{price}</b><span>€ HT<br>par mois</span></div><ul>{li}</ul>{btn}</article>'''
    return f'<div class="plans">{out}</div>'

def build():
    # ── tarifs
    trail = [("/", "Accueil"), ("/tarifs", "Tarifs")]
    body = hero(trail, "Tarifs", 'Trois packs. <span class="hl">C\'est tout.</span>',
                "Pas de frais d'installation, pas de commission sur les réservations, utilisateurs illimités. 14 jours gratuits, sans carte bancaire.", meta="Prix HT par mois et par restaurant · sans engagement")
    body += f'<section class="sec wrap">{plans_html()}<p class="src" data-r style="text-align:center;margin-inline:auto">Sondes, thermomètre Bluetooth et imprimante ne sont pas fournis&nbsp;: l\'app marche avec le matériel du commerce, et sans matériel du tout. TVA non applicable, art. 293 B du CGI.</p></section>'
    ck = '<span class="y" style="color:var(--vink);font-weight:700">Inclus</span>'
    rows = "".join(f'<tr><td>{e(f)}</td>' + "".join(f"<td>{ck if x else N + '—'}</td>" for x in (a, b, c)) + "</tr>" for f, a, b, c in MATRIX)
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Dans le détail</span><h2>Qu\'y a-t-il dans chaque pack&nbsp;?</h2></div><div class="tbl-w" data-r><table class="tbl" style="min-width:560px"><thead><tr><th>Fonction</th><th>Commis · 59&nbsp;€</th><th>Second · 109&nbsp;€</th><th>Chef · 169&nbsp;€</th></tr></thead><tbody>{rows}</tbody></table></div></section>'
    body += '<section class="sec wrap"><div class="note s" data-r><b>Vous hésitez&nbsp;?</b> Commencez l\'essai&nbsp;: pendant 14 jours, vous avez toute l\'app. Vous choisirez le pack à la fin, selon ce que vous avez vraiment utilisé. <a href="/comparatif">Comparer avec les autres logiciels</a>.</div></section>'
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Questions</span><h2>Sur l\'abonnement.</h2></div>{faq_html(PRICE_FAQ)}</section>'
    body += band()
    offers = [{"@type": "Offer", "name": f"Pack {n}", "price": p, "priceCurrency": "EUR", "url": f"{APP}/?signup=1&plan={pid}",
               "priceSpecification": {"@type": "UnitPriceSpecification", "price": p, "priceCurrency": "EUR", "unitText": "mois", "valueAddedTaxIncluded": False}} for pid, n, p, *_ in PLANS]
    page("/tarifs", "Tarifs Growth Gusto · logiciel de gestion de restaurant dès 59 € HT par mois",
         "Commis 59 €, Second 109 €, Chef 169 € HT par mois. Sans engagement, sans frais d'installation, utilisateurs illimités, 14 jours d'essai gratuits sans carte bancaire.",
         body, trail, ld=[{"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Growth Gusto", "applicationCategory": "BusinessApplication", "operatingSystem": "Web, iOS, Android", "url": BASE, "offers": offers}, faq_ld(PRICE_FAQ)])

    # ── intégrations
    trail = [("/", "Accueil"), ("/integrations", "Ce qui se relie")]
    body = hero(trail, "Ce qui se relie", 'Ce qui se relie, <span class="hl">dit honnêtement.</span>',
                "En direct, par import ou bientôt : voici exactement comment chaque caisse, plateforme, banque ou sonde arrive dans Growth Gusto. Pas de promesse en l'air.")
    cols = ""
    for i, (cls, t, sub, items) in enumerate(LINKS):
        li = "".join(f"<li><b>{e(a)}</b><span>{e(b)}</span></li>" for a, b in items)
        cols += f'<div class="lk-c {cls}" data-r style="--dl:{i}"><h3><i class="lk-dot" aria-hidden="true"></i>{t}</h3><p>{e(sub)}</p><ul>{li}</ul></div>'
    body += f'<section class="sec wrap"><div class="lk">{cols}</div></section>'
    hw = [("/fonctionnalites/haccp-temperatures", "Sondes et thermomètres", "Shelly, SensorPush, Govee, UbiBot, LoRaWAN, thermomètre-sonde Bluetooth. Matériel du commerce, non fourni.", "thermo", ""),
          ("/fonctionnalites/etiquettes-dlc", "Imprimante d'étiquettes", "Une imprimante Wi-Fi compatible AirPrint, par exemple la Brother QL-810Wc, rouleaux de 62 mm.", "tag", "s"),
          ("/fonctionnalites/caisse-stock", "Caisse et livraison", "SumUp et Square en direct, les autres caisses et les plateformes par import.", "wallet", "k")]
    body += '<section class="sec wrap"><div class="sh" data-r><span class="kick">Le matériel</span><h2>Ce qui marche avec l\'app.</h2><p>Rien n\'est obligatoire&nbsp;: sans matériel, l\'équipe tape ou dicte les valeurs.</p></div><div class="cards c3">' + "".join(card(u, t, x, ic, icc, dl=i) for i, (u, t, x, ic, icc) in enumerate(hw)) + "</div></section>"
    q = FAQ[2][1]
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Questions</span><h2>Sur les liaisons.</h2></div>{faq_html(q)}</section>'
    body += band()
    page("/integrations", "Intégrations Growth Gusto · caisses SumUp, Square, Pennylane, Uber Eats, sondes",
         "Ce qui se relie à Growth Gusto : en direct (SumUp, Square, Pennylane, sondes sans fil), par import (autres caisses, Uber Eats, Deliveroo, Just Eat, relevé bancaire, Zenchef, TheFork) et bientôt.",
         body, trail, ld=[faq_ld(q)])

    # ── faq
    trail = [("/", "Accueil"), ("/faq", "Questions fréquentes")]
    body = hero(trail, "Questions fréquentes", 'Les questions <span class="hl">du passe.</span>',
                'Tout ce qu\'on nous demande, rangé par thème. Une autre question&nbsp;? <a href="mailto:contact@growthgusto.fr" style="color:#fff;text-decoration:underline">contact@growthgusto.fr</a>, une vraie personne vous répond.')
    allq = []
    for t, qs in FAQ:
        allq += qs
        body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">{e(t)}</span></div>{faq_html(qs)}</section>'
    body += band()
    page("/faq", "Questions fréquentes · Growth Gusto, logiciel de gestion de restaurant",
         "Engagement, essai gratuit, matériel, sondes, imprimante, caisses compatibles, Uber Eats, données en France, PMS et contrôle sanitaire : toutes les réponses.",
         body, trail, ld=[faq_ld(allq)])

    # ── à propos
    trail = [("/", "Accueil"), ("/a-propos", "À propos")]
    body = hero(trail, "À propos", 'Une app pour la cuisine, <span class="hl">faite pour durer.</span>',
                "Growth Gusto est une app de gestion pour restaurants, conçue et éditée à Lyon. Une seule idée nous guide : ce qui prend du temps en cuisine doit se faire en un geste.")
    vals = [("Simple d'abord", "Si un cuisinier ne comprend pas un écran en trois secondes, l'écran est à refaire. Pas de formation à suivre pour s'en servir.", "pot", ""),
            ("Honnête sur ce qui marche", "En direct, par import ou bientôt : nous disons exactement comment chaque logiciel se relie. Rien n'est promis avant d'exister.", "plug", "s"),
            ("Un prix fixe, sans commission", "Un abonnement clair, des utilisateurs illimités, aucune commission sur vos réservations ou vos commandes.", "wallet", "k"),
            ("Vos données sont à vous", "Hébergées en France, exportables à tout moment, jamais revendues.", "shield", "l"),
            ("Tout au même endroit", "L'hygiène, la salle, la caisse, le stock et l'équipe se parlent : un relevé, une vente ou une facture ne se saisit qu'une fois.", "box", "r"),
            ("Au service des restaurateurs", "Les fonctions arrivent parce que des restaurateurs les demandent. Écrivez-nous, nous lisons tout.", "chat", "")]
    body += '<section class="sec wrap"><div class="sh" data-r><span class="kick">Ce qui compte pour nous</span><h2>Six principes, tenus.</h2></div><div class="cards c3">' + "".join(
        f'<div class="card" data-r style="--dl:{i % 3}">{icon(ic, icc)}<h3>{e(t)}</h3><p>{e(x)}</p></div>' for i, (t, x, ic, icc) in enumerate(vals)) + "</div></section>"
    body += f'''<section class="sec wrap"><div class="art" style="grid-template-columns:1fr"><div class="prose" data-r>
<h2>L'éditeur</h2>
<p>Growth Gusto est édité par <strong>EI Ruis Global</strong>, entreprise individuelle immatriculée sous le SIREN 934&nbsp;733&nbsp;122, à Lyon. L'app est hébergée en France.</p>
<p>Pour toute question&nbsp;: <a href="mailto:contact@growthgusto.fr">contact@growthgusto.fr</a>. Les informations légales complètes sont dans les <a href="/mentions-legales">mentions légales</a>, les <a href="/cgv">conditions générales de vente</a> et la <a href="/confidentialite">politique de confidentialité</a>.</p>
<h2>Ce que fait l'app</h2>
<p>Les <a href="/fonctionnalites">fonctionnalités</a> couvrent l'hygiène et le HACCP, la salle et les réservations, la prise de commande, le stock, les marges, la caisse, l'équipe et les finances. Les <a href="/guides">guides</a> expliquent la réglementation simplement, et le <a href="/comparatif">comparatif</a> montre ce que font les autres logiciels.</p>
</div></div></section>'''
    body += band()
    page("/a-propos", "À propos de Growth Gusto · l'app de gestion de restaurant conçue à Lyon",
         "Growth Gusto, app de gestion pour restaurants éditée par EI Ruis Global à Lyon : nos principes, l'éditeur, l'hébergement des données en France.",
         body, trail, ld=[ORG, {"@context": "https://schema.org", "@type": "AboutPage", "name": "À propos de Growth Gusto", "url": f"{BASE}/a-propos"}])

    # ── contact
    trail = [("/", "Accueil"), ("/contact", "Contact")]
    body = hero(trail, "Contact", 'Une question&nbsp;? <span class="hl">Une vraie personne répond.</span>',
                "Par e-mail, en regardant la démo, ou directement dans l'app. Avec le pack Chef, la mise en route se fait avec nous, en visio.")
    cs = [(f"mailto:contact@growthgusto.fr", "Écrire un e-mail", "contact@growthgusto.fr. Une vraie personne vous répond.", "mail", "", "Écrire"),
          (f"{APP}/?demo=1", "Voir la démo", "Un restaurant fictif déjà rempli. Rien n'est enregistré, rien à installer.", "star", "s", "Ouvrir la démo"),
          (f"{APP}/?login=1", "Déjà client", "Connectez-vous à votre compte, sur téléphone, tablette ou ordinateur.", "users", "k", "Se connecter")]
    body += '<section class="sec wrap"><div class="contact">' + "".join(
        f'<a class="card" href="{u}"{" target=\"_blank\" rel=\"noopener\"" if u.startswith("http") else ""} data-r style="--dl:{i}">{icon(ic, icc)}<h3>{t}</h3><p>{e(x)}</p><span class="go">{g} {ARROW}</span></a>' for i, (u, t, x, ic, icc, g) in enumerate(cs)) + "</div></section>"
    cq = [("Puis-je avoir une présentation ?", "Oui. Écrivez-nous avec le nom de votre restaurant et vos disponibilités, nous vous proposons un créneau en visio."),
          ("Vous m'aidez à importer mes données ?", "Oui : envoyez-nous vos fichiers Excel ou CSV, nous vous aidons à les déposer dans l'app."),
          ("Où êtes-vous ?", "À Lyon. Growth Gusto est édité par EI Ruis Global.")]
    body += f'<section class="sec wrap"><div class="sh" data-r><span class="kick">Questions</span><h2>Avant de nous écrire.</h2></div>{faq_html(cq)}</section>'
    body += band()
    page("/contact", "Contact · Growth Gusto", "Contacter Growth Gusto : e-mail contact@growthgusto.fr, démo en ligne, support dans l'app. Édité à Lyon par EI Ruis Global.",
         body, trail, ld=[ORG, {"@context": "https://schema.org", "@type": "ContactPage", "name": "Contact Growth Gusto", "url": f"{BASE}/contact"}, faq_ld(cq)])
