"""Le lien entre l'app et le site vitrine : quels écrans existent dans l'app, et où chacun est présenté sur growthgusto.fr.

La source, c'est le menu de l'app : NAV (js/core.js) et les modules qui s'y ajoutent (NAV.splice dans js/<module>.js). Le site
ne tient pas sa propre liste : il lit ce menu à chaque construction.
  - accueil.py           : les fonctions de la page d'accueil, chacune rattachée à un ou plusieurs écrans (app=…)
  - content_features.py  : les pages /fonctionnalites/<slug>, chacune rattachée à des écrans (app=[…])
  - INTERNE ci-dessous   : les écrans qui ne se vendent pas (réglages, accueil du jour…), avec la raison
Ajouter un écran à l'app sans le mettre dans l'un de ces trois endroits fait échouer tools/site/check.py (donc la PR).
Retirer un écran de l'app retire tout seul ses fonctions de l'accueil, et sa page quand plus aucun de ses écrans n'existe.
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

# Écrans du menu qui n'ont pas à être présentés comme une fonction sur le site.
INTERNE = {
    "home": "accueil du jour de l'app, montré par toutes les captures",
    "avis": "« Votre avis » : retours des restaurants à l'équipe Growth Gusto",
    "import": "import depuis un autre logiciel : section à part sur l'accueil (#import)",
    "reglages": "réglages de l'app",
}

TRIPLET = re.compile(r'\[\s*"([A-Za-z][\w-]*)"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*\]')

def app_modules():
    """Routes du menu de l'app, lues dans le code (sans navigateur). tools/ci.js vérifie qu'elles sont identiques au menu réel."""
    found = []
    core = (ROOT / "js" / "core.js").read_text()
    m = re.search(r"const NAV = \[(.*?)\n\];", core, re.S)
    if not m:
        raise SystemExit("registre.py : « const NAV = [ … ]; » introuvable dans js/core.js")
    found += [r for r in TRIPLET.findall(m.group(1)) if r != "sep"]
    for f in sorted((ROOT / "js").glob("*.js")):
        for line in f.read_text().splitlines():
            i = line.find("NAV.splice(")
            if i >= 0:
                found += [r for r in TRIPLET.findall(line[i:]) if r != "sep"]
    seen, out = set(), []
    for r in found:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out

_LIVE = None

def live():
    """Ensemble des écrans présents dans l'app (calculé une fois par construction)."""
    global _LIVE
    if _LIVE is None:
        _LIVE = set(app_modules())
    return _LIVE

def is_live(app):
    """Une fonction ou une page existe tant qu'au moins un de ses écrans existe dans l'app."""
    return any(a in live() for a in app)
