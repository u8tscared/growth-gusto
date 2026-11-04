# Growth Gusto · Firebase (comptes + données partagées)

Projet : **growth-gusto** · Firestore `(default)` en **europe-west9** · Auth : Google + E-mail/mot de passe.
La config publique est dans `js/config.js` (`window.GG_FIREBASE`). La mettre à `null` coupe les comptes : l'app tourne alors sur l'appareil seul, et les boutons de connexion annoncent que les comptes arrivent.

## 1. Publier les règles de sécurité (à refaire à chaque changement de `firestore.rules`)

1. Ouvrir https://console.firebase.google.com/project/growth-gusto/firestore/rules
   (Firebase console → **Firestore Database** → onglet **Règles**).
2. Tout sélectionner dans l'éditeur et supprimer.
3. Coller le contenu entier de `firestore.rules` (à la racine du dépôt).
4. Cliquer **Publier**. C'est actif en moins d'une minute.

Les règles ont été vérifiées sur l'émulateur Firestore (45 cas : création, invitation, rôles, import, avis).

## 2. Réglages Authentication (déjà faits, à vérifier si la connexion échoue)

- **Authentication → Sign-in method** : *Google* et *Adresse e-mail/Mot de passe* activés.
- **Authentication → Paramètres → Domaines autorisés** : `u8tscared.github.io` (et `localhost` pour les tests).
- **Authentication → Modèles** : passer la langue des e-mails en **français** (réinitialisation du mot de passe, vérification d'adresse).

## 3. Modèle de données

| Chemin | Contenu | Qui |
|---|---|---|
| `users/{uid}` | `{ name, email, photo, restos: [rid] }` | la personne seule |
| `restos/{rid}` | `{ name, type, owner, createdAt, plan: "essai" }` | membres (lecture), gérant (modification), propriétaire (suppression) |
| `restos/{rid}/members/{id}` | `{ name, email, photo, role: gerant\|chef\|equipe, joinedAt, invite? }` (`id` = uid d'un compte, ou profil cuisine sans compte) | membres (lecture), gérant (gestion), chacun son nom |
| `restos/{rid}/{collection}/{id}` | frigos, relevés, lots, stock, tickets, équipe RH, finances… | membres |
| `invites/{CODE}` | `{ rid, restoName, role, createdBy, createdAt, expiresAt, uses }` | lisible avec le code, gérée par les gérants |
| `appFeedback/{id}` | avis sur l'app (`js/avis.js`) | l'équipe du restaurant, admins (`marceau.ruis@gmail.com`) |

Le propriétaire ne peut être ni rétrogradé ni retiré. Un invité reçoit le rôle de l'invitation, jamais celui qu'il choisit.

## 4. Comment ça marche dans l'app

- **Premier lancement** : écran d'accueil → Google, e-mail, « Essayer la démo », ou « Continuer sans compte (sur cet appareil) ». Le lien `?local=1` saute l'accueil (tests), `?demo=1` ouvre la démo, `?invite=CODE` ouvre l'invitation.
- **Après la 1re connexion** : « Importer les données de ce téléphone » si l'appareil a des données locales, puis créer un restaurant ou rejoindre une équipe avec un code.
- **Hors ligne** : Firestore garde tout sur l'appareil et envoie au retour du réseau. Le SDK (`www.gstatic.com/firebasejs/10.14.1/…`) est mis en cache par le service worker.
- **Déconnexion** : Réglages → Compte → Se déconnecter (le cache de l'appareil est effacé).

## 5. Limite connue : Google dans l'app installée sur iPhone

Sur iPhone, dans l'app ajoutée à l'écran d'accueil, la connexion Google passe par une redirection. Safari peut la bloquer, parce que la page de connexion vit sur `growth-gusto.firebaseapp.com` et l'app sur `u8tscared.github.io`. **E-mail + mot de passe marche partout.** Pour que Google marche aussi à coup sûr sur iPhone installé, il faudra un domaine à vous (par ex. `app.growthgusto.fr`) qui sert l'app et la page `/__/auth/` (Firebase Hosting le fait tout seul).

## 6. Hébergement Firebase (app.growthgusto.fr + growthgusto.fr)

`firebase.json` déclare deux sites Hosting : `app` (l'application, racine du dépôt sans site/, tools/, avant/) et `www` (la landing, dossier `site/`).
Mise en place, une fois, depuis un terminal connecté (`firebase login` approuvé par Marceau) :
1. `firebase hosting:sites:create growth-gusto-app` (le site par défaut `growth-gusto` sert la landing).
2. `firebase deploy --only hosting,firestore:rules`.
3. Console → Hosting → « Ajouter un domaine personnalisé » : `app.growthgusto.fr` sur le site growth-gusto-app, `growthgusto.fr` + `www.growthgusto.fr` sur growth-gusto. Firebase donne les enregistrements DNS (A / TXT / CNAME) à saisir chez IONOS.
4. Authentication → Paramètres → Domaines autorisés : ajouter `app.growthgusto.fr` ; puis dans `js/config.js` mettre `authDomain: "app.growthgusto.fr"` (la connexion Google marche alors aussi dans l'app installée sur iPhone).
5. Faire pointer l'ancien lien GitHub Pages vers app.growthgusto.fr (redirection dans index.html).
