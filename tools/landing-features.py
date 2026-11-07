#!/usr/bin/env python3
"""Ancien point d'entrée, gardé pour les habitudes : l'accueil se construit maintenant avec tout le site.
Textes des fonctions : tools/site/accueil.py. Commande : python3 tools/site/build.py"""
import pathlib, runpy, sys
sys.argv = [str(pathlib.Path(__file__).resolve().parent / "site" / "build.py")]
runpy.run_path(sys.argv[0], run_name="__main__")
