#!/usr/bin/env python3
"""Vérifie que le site vitrine suit l'app. Lancé sur chaque PR par tools/ci.js (code de sortie 1 = la PR ne part pas en ligne).

  python3 tools/site/check.py                 vérifie le registre
  python3 tools/site/check.py --nav a,b,c     compare aussi avec le menu réel de l'app (relevé dans le navigateur par tools/ci.js)

Règles :
  1. chaque écran du menu de l'app (NAV) a une fonction sur l'accueil (accueil.py, app=…) ET une page
     /fonctionnalites (content_features.py, app=[…]), ou figure dans registre.INTERNE avec sa raison ;
  2. les captures citées existent (site/img/<img>.jpg) et les identifiants des fonctions sont uniques ;
  3. le site lit le même menu que l'app réelle (sinon : écrire l'ajout au menu sous la forme NAV.splice(…, ["route", "icône", "Nom"])).
Une fonction rattachée à un écran qui n'existe plus est simplement masquée (ce n'est pas une erreur) : c'est ce qui permet
de retirer un module de l'app sans toucher au site.
"""
import pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import registre
from accueil import GROUPES

SITE = registre.ROOT / "site"

def main(argv):
    nav = None
    if "--nav" in argv:
        nav = [x for x in argv[argv.index("--nav") + 1].split(",") if x and x != "sep"]
    sys.modules.setdefault("build", __import__("build"))
    from content_features import FEATURES

    errs, notes = [], []
    app = registre.app_modules()
    feats = [f for g in GROUPES for f in g["f"]]
    on_home = {a for f in feats for a in f["app"]}
    on_page = {a for p in FEATURES for a in p["app"]}

    for r in app:
        if r in registre.INTERNE:
            continue
        miss = []
        if r not in on_home:
            miss.append("une FONCTION(…, app=\"%s\") dans tools/site/accueil.py" % r)
        if r not in on_page:
            miss.append("\"%s\" dans app=[…] d'une page de tools/site/content_features.py" % r)
        if miss:
            errs.append("L'écran « %s » de l'app n'est pas présenté sur le site. Ajouter %s (ou, si ce n'est pas une fonction à vendre, l'ajouter à INTERNE dans tools/site/registre.py avec la raison)." % (r, " et ".join(miss)))

    ids = [f["id"] for f in feats]
    for i in sorted({i for i in ids if ids.count(i) > 1}):
        errs.append("Fonction « %s » écrite deux fois dans tools/site/accueil.py." % i)
    for f in feats:
        if not (SITE / "img" / (f["img"] + ".jpg")).exists():
            errs.append("Capture manquante pour la fonction « %s » : site/img/%s.jpg" % (f["id"], f["img"]))
    for p in FEATURES:
        for img in [p["img"]] + [b[3] for b in p["blocks"]]:
            if not (SITE / "img" / (img + ".jpg")).exists():
                errs.append("Capture manquante pour la page « %s » : site/img/%s.jpg" % (p["slug"], img))

    # tarifs du site (content_misc.PLANS, repris sur l'accueil) = prix et noms des packs de l'app (js/abo.js AB_PACKS)
    import ast
    abo = (registre.ROOT / "js" / "abo.js").read_text()
    site_plans = ast.literal_eval(re.search(r"^PLANS = (\[.*?\n\])\n", (pathlib.Path(__file__).parent / "content_misc.py").read_text(), re.S | re.M).group(1).replace("{N}", ""))
    for pid, name, price, *_ in site_plans:
        m = re.search(pid + r': \{ t: "([^"]+)", price: (\d+)', abo)
        if not m:
            errs.append("Pack « %s » du site introuvable dans js/abo.js (AB_PACKS)." % pid)
        elif (m.group(1), m.group(2)) != (name, price):
            errs.append("Tarif du pack « %s » : le site dit %s %s €, l'app (js/abo.js) dit %s %s €." % (pid, name, price, m.group(1), m.group(2)))

    if nav is not None:
        a, b = set(app), set(nav)
        for r in sorted(b - a):
            errs.append("Le menu de l'app contient « %s » mais tools/site/registre.py ne le voit pas dans le code : écrire l'ajout au menu sur une seule ligne, NAV.splice(…, [\"%s\", \"icône\", \"Nom\"])." % (r, r))
        for r in sorted(a - b):
            errs.append("tools/site/registre.py voit « %s » dans le code mais il n'est pas dans le menu réel de l'app." % r)

    live = set(app)
    for f in feats:
        if not registre.is_live(f["app"]):
            notes.append("accueil : « %s » masquée (écran %s absent de l'app)" % (f["id"], ", ".join(f["app"])))
    for p in FEATURES:
        if not registre.is_live(p["app"]):
            notes.append("page /fonctionnalites/%s non construite (écrans %s absents de l'app)" % (p["slug"], ", ".join(p["app"])))
    for r in registre.INTERNE:
        if r not in live:
            notes.append("INTERNE : « %s » n'existe plus dans l'app, peut être retiré de registre.py" % r)

    for n in notes:
        print("info :", n)
    if errs:
        print("Site vitrine pas à jour :\n\n- " + "\n- ".join(errs))
        return 1
    shown = sum(1 for f in feats if registre.is_live(f["app"]))
    print("Site OK : %d écrans de l'app, tous présentés (%d fonctions sur l'accueil, %d pages)%s." % (
        len(app), shown, sum(1 for p in FEATURES if registre.is_live(p["app"])), ", menu réel identique" if nav is not None else ""))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
