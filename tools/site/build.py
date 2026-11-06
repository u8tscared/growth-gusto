#!/usr/bin/env python3
"""Builds the pages of growthgusto.fr (everything except the home page, which is hand-made: site/index.html).

  python3 tools/site/build.py

Content lives in tools/site/content_*.py. Each page gets its own title, description, canonical URL,
breadcrumbs, structured data (BreadcrumbList + the page's own type) and internal links; sitemap.xml is rewritten.
Pages are written as site/<path>.html (Firebase Hosting serves them without .html: cleanUrls).
The home page's footer is replaced between <!--sf:start--> and <!--sf:end--> so it matches every page.
"""
import html, json, pathlib, re, sys, datetime

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent / "site"
sys.path.insert(0, str(HERE))
BASE = "https://growthgusto.fr"
APP = "https://app.growthgusto.fr"
TODAY = datetime.date(2026, 11, 6).isoformat()

def e(s):
    return html.escape(s, quote=True)

ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

ICONS = {
    "thermo": '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 9v7"/>',
    "tag": '<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1L21 11.9a1.5 1.5 0 0 1 0 2.1l-7 7a1.5 1.5 0 0 1-2.1 0Z"/><circle cx="8.2" cy="8.2" r="1.6"/>',
    "shield": '<path d="M12 3 4.5 6v6c0 4.6 3.2 8 7.5 9 4.3-1 7.5-4.4 7.5-9V6Z"/><path d="m8.8 12.2 2.3 2.3 4.3-4.6"/>',
    "book": '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    "cal": '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h3"/>',
    "order": '<path d="M7 3h10l1 4H6Z"/><path d="M5 7h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z"/><path d="M9.5 12h5M9.5 16h5"/>',
    "qr": '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "box": '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    "heart": '<path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.6 12 20 12 20Z"/>',
    "wallet": '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v4"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M16 13.5h2"/>',
    "plug": '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0Z"/><path d="M12 17v4"/>',
    "pot": '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5"/>',
    "pizza": '<path d="M12 21 3.5 6.5a14 14 0 0 1 17 0Z"/><circle cx="10" cy="10" r="1.2"/><circle cx="14" cy="13" r="1.2"/><circle cx="12" cy="16.5" r="1"/>',
    "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    "cup": '<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M11 3v2"/>',
    "truck": '<path d="M2.5 6.5h11v10h-11zM13.5 10h4.5l3 3v3.5h-7.5"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    "bag": '<path d="M5 8h14l-1 12.5H6Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    "scale": '<path d="M12 3v18M5 7h14M7 21h10"/><path d="m5 7-3 6a3 3 0 0 0 6 0Zm14 0-3 6a3 3 0 0 0 6 0Z"/>',
    "mail": '<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m3 7 9 6 9-6"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9.5h8M8 12.5h5"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "leaf": '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "fish": '<path d="M3 12c3-4 7-5.5 11-5.5 2.8 0 5 2 7 5.5-2 3.5-4.2 5.5-7 5.5-4 0-8-1.5-11-5.5Z"/><path d="M3 12 1 9m2 3-2 3"/><circle cx="16" cy="11" r="1"/>',
}

def icon(name, cls=""):
    return f'<span class="ic {cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg></span>'

def tag(t):
    cls = {"En direct": "it-live", "Par import": "it-imp", "Bientôt": "it-soon"}.get(t, "")
    return f'<span class="tag {cls}">{e(t)}</span>'

def phone(img, alt="", cls=""):
    return f'<div class="phone {cls}"><img src="/img/{img}.jpg" alt="{e(alt)}" width="600" height="1382" loading="lazy" decoding="async"></div>'

def btn_try(cls="v", label="Essayer 14 jours gratuits", plan=None):
    q = "?signup=1" + (f"&amp;plan={plan}" if plan else "")
    return f'<a class="btn {cls}" href="{APP}/{q}" target="_blank" rel="noopener">{label} {ARROW}</a>'

def btn_demo(cls="ghost"):
    return f'<a class="btn {cls}" href="{APP}/?demo=1" target="_blank" rel="noopener">Voir la démo</a>'

# ───────────────────────── navigation ─────────────────────────
NAV = [("/fonctionnalites", "Fonctionnalités"), ("/restaurants", "Restaurants"), ("/tarifs", "Tarifs"), ("/guides", "Guides"), ("/comparatif", "Comparatif")]

MENU_MORE = [("/integrations", "Ce qui se relie"), ("/faq", "Questions fréquentes"), ("/contact", "Contact")]
HOME_ANCHORS = {"/tarifs": "#tarifs", "/comparatif": "#comparatif", "/integrations": "#integrations", "/faq": "#faq"}

def home_nav():
    """Same menu as every page (NAV + MENU_MORE); on the home page, sections that exist there are anchors."""
    u = lambda x: HOME_ANCHORS.get(x, x)
    links = "".join(f'<a{" class=\"xl\"" if i == len(NAV) - 1 else ""} href="{u(x)}">{t}</a>' for i, (x, t) in enumerate(NAV))
    menu = "".join(f'<a href="{u(x)}">{t}</a>' for x, t in NAV + MENU_MORE)
    return links, menu

def header(cur):
    links = "".join(f'<a href="{u}"{" aria-current=\"page\"" if cur.startswith(u) else ""}>{t}</a>' for u, t in NAV)
    menu = "".join(f'<a href="{u}">{t}</a>' for u, t in NAV + MENU_MORE)
    return f'''<header class="top"><div class="wrap">
<a class="brand" href="/" aria-label="Growth Gusto, accueil">Growth<b>Gusto</b></a>
<nav class="links" aria-label="Principal">{links}</nav>
<a class="btn soft sm login" href="{APP}/?login=1" target="_blank" rel="noopener">Se connecter</a>
<a class="btn v sm" href="{APP}/?signup=1" target="_blank" rel="noopener"><span class="cta-long">Essayer 14 jours</span><span class="cta-short">Essayer</span></a>
<button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Menu"><i></i><i></i></button>
</div>
<nav class="menu" id="menu" aria-label="Menu" hidden>{menu}<div class="menu-b"><a class="btn soft" href="{APP}/?login=1" target="_blank" rel="noopener">Se connecter</a><a class="btn soft" href="{APP}/?demo=1" target="_blank" rel="noopener">Voir la démo</a></div></nav>
</header>'''

def footer():
    from content_features import FEATURES
    from content_types import TYPES
    from content_guides import GUIDES
    col = lambda title, items: f'<div class="sf-col"><h3>{title}</h3><ul>' + "".join(f'<li><a href="{u}">{e(t)}</a></li>' for u, t in items) + "</ul></div>"
    feats = [(f"/fonctionnalites/{f['slug']}", f["short"]) for f in FEATURES]
    types = [(f"/restaurants/{t['slug']}", t["short"]) for t in TYPES]
    res = [("/guides", "Tous les guides")] + [(f"/guides/{g['slug']}", g["short"]) for g in GUIDES[:6]]
    co = [("/tarifs", "Tarifs"), ("/integrations", "Ce qui se relie"), ("/comparatif", "Comparatif"), ("/faq", "Questions fréquentes"), ("/a-propos", "À propos"), ("/contact", "Contact")]
    return f'''<!--sf:start-->
<footer class="sf">
<div class="sf-in">
<div class="sf-brand"><a class="brand" href="/" aria-label="Growth Gusto, accueil">Growth<b>Gusto</b></a>
<p>L'app de gestion pour restaurants&nbsp;: hygiène et HACCP, salle, commandes, stock, marges, caisse et équipe, au même endroit. Conçue à Lyon, données hébergées en France.</p>
{btn_try("v", "Essayer 14 jours")}</div>
<div class="sf-cols">{col("Fonctionnalités", feats)}{col("Restaurants", types + [("/restaurants", "Tous les restaurants")])}{col("Guides", res)}{col("Growth Gusto", co)}</div>
</div>
<div class="sf-bot"><span>© 2026 Growth Gusto · EI Ruis Global, Lyon</span><a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a><a href="mailto:contact@growthgusto.fr">contact@growthgusto.fr</a><a href="{APP}/?login=1">Se connecter</a></div>
</footer>
<!--sf:end-->'''

def crumbs_html(trail, dark=False):
    items = "".join(f'<li><a href="{u}">{e(t)}</a></li>' if i < len(trail) - 1 else f'<li aria-current="page">{e(t)}</li>' for i, (u, t) in enumerate(trail))
    return f'<nav aria-label="Fil d\'Ariane"><ol class="crumbs{" dark" if dark else ""}">{items}</ol></nav>'

def crumbs_ld(trail):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": t, "item": BASE + (u if u != "/" else "/")} for i, (u, t) in enumerate(trail)]}

def faq_html(qs):
    return '<div class="faq">' + "".join(f'<details data-r style="--dl:{min(i,4)}"><summary>{e(q)}<i aria-hidden="true"></i></summary><div class="ans">{a}</div></details>' for i, (q, a) in enumerate(qs)) + "</div>"

def faq_ld(qs):
    txt = lambda x: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", x))).strip()
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": txt(a)}} for q, a in qs]}

def hero(trail, kick, h1, lede, *, img=None, tags=(), ctas=None, meta=None):
    tg = ('<div class="tags">' + "".join(tag(t) for t in tags) + "</div>") if tags else ""
    ctas = ctas if ctas is not None else btn_try("w") + btn_demo()
    vis = f'<div class="vis">{phone(img, "", "float")}</div>' if img else '<div class="vis"></div>'
    mt = f'<div class="meta">{meta}</div>' if meta else ""
    return f'''<section class="hero{"" if img else " noph"}"><div class="wall"><div class="in">
<div class="copy">{crumbs_html(trail)}{tg}<span class="kick" style="background:rgba(255,255,255,.14);color:#fff">{e(kick)}</span>
<h1 style="margin-top:18px">{h1}</h1>
<p class="lede">{lede}</p>{mt}
<div class="ctas">{ctas}</div>
</div>{vis}</div></div></section><div class="hero-pad"></div>'''

def band(title="Essayez Growth Gusto 14 jours.", sub="Sans carte bancaire, sans engagement. Votre restaurant prêt ce soir, ou la démo déjà remplie pour regarder."):
    return f'''<section class="band"><div class="wall" data-r><h2>{title}</h2><p>{sub}</p><div class="ctas">{btn_try("w")}{btn_demo()}</div></div></section>'''

def card(href, title, text, ic=None, icc="", tags=(), go="Découvrir", shot=None, dl=0):
    i = icon(ic, icc) if ic else ""
    tg = ('<div class="tags">' + "".join(tag(t) for t in tags) + "</div>") if tags else ""
    mini = f'<div class="mini">{phone(shot)}</div>' if shot else ""
    return f'<a class="card{" shot" if shot else ""}" href="{href}" data-r style="--dl:{dl}">{i}<h3>{title}</h3><p>{text}</p>{tg}<span class="go">{go} {ARROW}</span>{mini}</a>'

PAGES = []

def page(path, title, desc, body, trail, ld=(), og=None, cur=None, extra_head=""):
    canon = BASE + path
    ldx = [crumbs_ld(trail)] + list(ld)
    lds = "\n".join('<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>" for x in ldx)
    ogi = og or f"{BASE}/og.jpg"
    doc = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FBF6EC">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canon}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Growth Gusto">
<meta property="og:url" content="{canon}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{ogi}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&amp;family=Instrument+Sans:wght@400..700&amp;family=JetBrains+Mono:wght@500;700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css">
{lds}{extra_head}
</head>
<body>
{header(cur or path)}
<main>
{body}
</main>
{footer()}
<script src="/js/site.js" defer></script>
</body>
</html>
'''
    out = SITE / (path.strip("/") + ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)
    PAGES.append((path, title))

def main():
    sys.modules.setdefault("build", sys.modules[__name__])  # content modules import this file as `build`: share PAGES
    import content_features, content_types, content_guides, content_compare, content_misc
    for m in (content_features, content_types, content_guides, content_compare, content_misc):
        m.build()
    # sitemap
    urls = [("/", "1.0", "weekly")] + [(p, "0.8" if p.count("/") == 1 else "0.7", "monthly") for p, _ in PAGES] + [(p, "0.2", "yearly") for p in ("/cgv", "/mentions-legales", "/confidentialite")]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"<url><loc>{BASE}{p if p != '/' else '/'}</loc><lastmod>{TODAY}</lastmod><changefreq>{c}</changefreq><priority>{pr}</priority></url>\n" for p, pr, c in urls) + "</urlset>\n"
    (SITE / "sitemap.xml").write_text(sm)
    # home footer
    idx = SITE / "index.html"
    h = idx.read_text()
    if "<!--sf:start-->" in h:
        a, b = h.index("<!--sf:start-->"), h.index("<!--sf:end-->") + len("<!--sf:end-->")
        h = h[:a] + footer() + h[b:]
    links, menu = home_nav()
    for k, v in (("nav", links), ("menu", menu)):
        a, b = h.index(f"<!--{k}:start-->"), h.index(f"<!--{k}:end-->")
        h = h[:a + len(f"<!--{k}:start-->")] + v + h[b:]
    idx.write_text(h)
    print(len(PAGES), "pages,", len(urls), "URLs in the sitemap")

if __name__ == "__main__":
    main()
