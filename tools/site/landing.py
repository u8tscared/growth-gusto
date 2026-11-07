"""Accueil de growthgusto.fr (site/index.html, fait main) : régénère les blocs entre marqueurs à partir de accueil.py.

  <!--feat:…-->  groupes « Fonctionnalités »     <!--chips:…-->  pastilles + nombre de fonctions
  <!--ld:…-->    données structurées (SEO)        <!--plan-<id>:…-->  contenu des trois packs (content_misc.PLANS)
  (nav, menu et pied de page : build.py)
Seules les fonctions dont au moins un écran existe dans l'app sont affichées (registre.py). Lancé par build.py.
"""
import html, json, re
from accueil import GROUPES
from registre import is_live

PLUS = '<svg class="fi-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

def esc(s):
    return html.escape(s, quote=True)

def text(x):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", x))).strip()

def phone(img, alt):
    return f'<div class="phone"><div class="scr"><img src="img/{img}.jpg" alt="{alt}" width="600" height="1301" loading="lazy" decoding="async"></div></div>'

def groups():
    """Groupes et fonctions encore présents dans l'app, dans l'ordre de accueil.py."""
    out = []
    for g in GROUPES:
        fs = [f for f in g["f"] if is_live(f["app"])]
        if fs:
            out.append(dict(g, f=fs))
    return out

def put(h, name, body):
    a, b = f"<!--{name}:start-->", f"<!--{name}:end-->"
    i, j = h.index(a) + len(a), h.index(b)
    return h[:i] + "\n" + body + "\n" + h[j:]

def build_plans(h):
    """Tarifs de l'accueil : la même liste que la page /tarifs (content_misc.PLANS), pour qu'elles ne divergent jamais."""
    from content_misc import PLANS
    nb = lambda x: re.sub(r" ([:;?!])", "&nbsp;\\1", re.sub(r"(\d) €", "\\1&nbsp;€", x))
    for pid, _name, price, who, all_, groups in PLANS:
        lis = (f'<li class="all">{nb(esc(all_))}</li>\n' if all_ else "")
        lis += "\n".join(f'<li class="grp">{esc(g)}</li>' + "".join(f"<li>{nb(esc(x))}</li>" for x in items) for g, items in groups)
        body = (f'<p class="who">{nb(esc(who))}</p>\n<div class="price"><b>{price}</b><span>€ HT<br>par mois</span></div>\n'
                f'<p class="eq">Sans engagement · sans frais d\'installation</p>\n<ul>{lis}</ul>')
        h = put(h, f"plan-{pid}", body)
    return h

def build_home(h):
    out, chips, n = [], [], 0
    gs = groups()
    for gi, g in enumerate(gs):
        rev = gi % 2 == 1  # alternance gauche / droite gardée même si un groupe disparaît
        out.append(f'<div class="fg{" rev" if rev else ""}" id="{g["id"]}" data-c="{g["c"]}" data-r>')
        out.append(f'<div class="fg-l"><div class="fg-head"><span class="fg-n">{esc(g["kick"])}</span><h3>{esc(g["t"])}</h3><p>{esc(g["lede"])}</p></div>')
        lis = []
        for k, f in enumerate(g["f"]):
            n += 1
            tplain = html.unescape(f["t"])
            on = k == 0
            tags = (f'<span class="tag {f["lien"][0]}">{f["lien"][1]}</span>' if f["lien"] else "") + (f'<span class="tag">{f["pack"]}</span>' if f["pack"] else "")
            tags = f'<span class="fi-tags">{tags}</span>' if tags else ""
            ul = "".join(f"<li>{x}</li>" for x in f["ul"])
            alt = esc(f"Écran {tplain} de l'app Growth Gusto")
            lis.append(
                f'<li class="fi{" on" if on else ""}" id="f-{f["id"]}" data-img="{f["img"]}" data-t="{esc(tplain)}">\n'
                f'<button class="fi-b" type="button" aria-expanded="{"true" if on else "false"}"><span class="fi-n">{n:02d}</span><span class="fi-t">{f["t"]}{tags}</span>{PLUS}</button>\n'
                f'<div class="fi-d"><div><p>{f["p"]}</p><ul>{ul}</ul>\n'
                f'<figure class="fi-m">{phone(f["img"], alt)}</figure></div></div>\n</li>')
            chips.append(f'<a class="chip" href="#f-{f["id"]}" data-feat="{f["id"]}">{f["t"]}</a>')
        out.append('<ul class="flist" role="list">' + "".join(lis) + "</ul></div>")
        f0 = g["f"][0]
        out.append(f'<div class="stage" aria-hidden="true"><i class="dk"></i><span class="cap">{f0["t"]}</span>{phone(f0["img"], "")}</div>')
        out.append("</div>")
    chips.append('<a class="chip" href="#integrations">Ce qui se relie</a><a class="chip" href="#import">Import depuis un autre logiciel</a>')
    h = put(h, "feat", "\n".join(out))
    h = build_plans(h)
    h = put(h, "chips", f'<p class="chips-h"><b>{n} fonctions</b>, une seule app</p>\n<div class="chips">' + "".join(chips) + "</div>")

    # données structurées : organisation, l'app avec ses trois packs et sa liste de fonctions, la FAQ relue sur la page
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
         "featureList": [text(f["t"]) for g in gs for f in g["f"]],
         "offers": [{"@type": "Offer", "name": f"Pack {nm}", "description": d, "price": p, "priceCurrency": "EUR",
                     "url": f"https://app.growthgusto.fr/?signup=1&plan={k}",
                     "priceSpecification": {"@type": "UnitPriceSpecification", "price": p, "priceCurrency": "EUR", "unitText": "MONTH", "valueAddedTaxIncluded": False}}
                    for nm, p, k, d in packs]},
    ]
    if faq:
        ld.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq})
    h = put(h, "ld", "\n".join('<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>" for x in ld))
    return h, n, len(gs)
