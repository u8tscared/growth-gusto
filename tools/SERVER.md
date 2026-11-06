# Serveur Growth Gusto (Cloud Functions)

Code : `functions/` (Node 22, europe-west9). `functions/index.js` charge les modules listés dans `functions/.env` (`GG_MODULES=sondes,alertes`, ajouter `caisse` quand les clés SumUp existent) et crée **une seule** tâche planifiée `ggTick` (toutes les 15 min) qui appelle `sondesTick`, `alertesTick`, `caisseTick` et, le lundi à 7 h, `alertesWeekly`. Règle de coût : Cloud Scheduler n'offre que 3 tâches gratuites par compte, donc jamais d'`onSchedule` dans un module.

## Déployer (depuis le Mac, dans le dossier du projet)

```
(cd functions && npm install)
firebase functions:secrets:set BREVO_KEY      # coller la clé API Brevo (SMTP et API → Clés API)
firebase deploy --only functions,hosting,firestore:rules
```

Avec `caisse` : `firebase functions:secrets:set SUMUP_CLIENT_ID`, `SUMUP_CLIENT_SECRET`, `CAISSE_ENC_KEY` (n'importe quelle longue chaîne aléatoire), et `SQUARE_*` / `LIGHTSPEED_*` (mettre `none` si non utilisés).

## Modules

- **alertes** (`functions/src/alertes.js`)
  - `onAlertCreated` (déclencheur sur `restos/{rid}/alerts/*`) : une alerte de test part tout de suite, les autres rejoignent la file et partent au plus une fois par 15 min et par restaurant.
  - `alertesTick` : active `server.alertes`, détecte les relevés hors seuil ou oubliés, les DLC et les obligations, envoie un mail groupé, gère l'escalade.
  - `alertesWeekly` : rapport du lundi.
  - Brevo gratuit (300 mails/jour, arrêt à 290 via `_meta/brevo`), expéditeur alertes@growthgusto.fr (domaine authentifié dans Brevo).
- **sondes** (`functions/src/sondes.js`)
  - `sondesIngest` (HTTPS) : `POST …/sondesIngest?r=<rid>&t=<token>`, accepte le JSON simple, Milesight, TTN v3, ChirpStack v4 et les actions Shelly (GET).
  - `sondesTick` : interroge Shelly Cloud, SensorPush, Govee v2, UbiBot ; écrit les mesures, les relevés automatiques (midi 10–16 h, soir 18–24 h) et les alertes. Les clés de chaque restaurant sont dans `restos/{rid}/sensorKeys` (gérants seulement).
- **caisse** (`functions/src/caisse.js`)
  - `caisseApi` (HTTPS, jeton Firebase) : connexion OAuth SumUp / Square / Lightspeed, clé Zelty, synchro, déconnexion (gérant).
  - `caisseTick` : synchronise les ventes (`restos/{rid}/sales`) ; jetons chiffrés AES-GCM dans `caisseTokens` (serveur seulement).
  - Comptes à créer : app développeur SumUp (redirect `https://app.growthgusto.fr/?caisse=sumup`, scopes `transactions.history user.profile_readonly`).

## Drapeaux côté app

`S.resto.server.<module>` est posé par le serveur au premier passage. `window.GG_SERVER = { sondes: true, alertes: true }` dans `js/config.js` force l'affichage « actif » une fois le déploiement fait.

- **mails** (`functions/src/mails.js`) : `mailSendCode` / `mailVerifyCode` (appelables : code à 6 chiffres haché dans `_codes`, 10 min, 5 essais, 5 envois/h, puis `emailVerified`) ; `mailOnUserCreated` (déclencheur v1 sur les comptes : « Bienvenue », Google tout de suite, e-mail après le code) ; `mailsTick` (essai J-3 et dernier jour, une fois par restaurant, 9–19 h). Expéditeur bonjour@growthgusto.fr, compteur partagé `_meta/brevo`. Drapeau app : `GG_SERVER.mails`.
- **mailInvite** (`functions/src/mails.js`, appelable, gérant seulement) : envoie une invitation d'équipe par e-mail (code + lien, 40 par restaurant et par jour).
- **admin** (`functions/src/admin.js`) : `adminDeleteUser` (appelable, admins Growth Gusto seulement) supprime un compte, ses restaurants, ses adhésions et sa connexion. Bouton corbeille dans Admin → Comptes.
- **resa** (`functions/src/resa.js`) : `onResaBooking` (déclencheur sur les réservations : mails au client via Brevo) et `resaTick` (rappels de la veille).
- **pennylane** (`functions/src/pennylane.js`, app `js/pennylane.js`, menu « Comptabilité ») : `pennylaneApi` (HTTPS, jeton Firebase, gérant) relie le Pennylane du restaurant par **jeton API société** (Paramètres › Connectivité › Développeurs, formule Essentiel ou plus, « Lecture et écriture », durée illimitée) ou par **OAuth** une fois Growth Gusto partenaire Pennylane (`PL_OAUTH=1` dans `functions/.env` + secrets `PL_CLIENT_ID`, `PL_CLIENT_SECRET`, redirect `https://app.growthgusto.fr/?pennylane=1`). `pennylaneTick` (toutes les 3 h par restaurant) : banque Pennylane → `bankTx/pl_*` (même forme que la banque connectée), factures fournisseurs → `plInv`, tickets Z → une écriture de ventes équilibrée par ticket dans le journal VT (530000 / 7061xx / 44571x, arrondis 658/758, photo jointe), suivi dans `plSent`. Jetons chiffrés AES-GCM dans `plTokens` (serveur seulement). Secret obligatoire : `PL_ENC_KEY` (n'importe quelle longue suite de lettres). Gratuit pour Growth Gusto.

## Paiement en ligne (Stripe) — functions/src/stripe.js

- Aucun secret Stripe dans Firebase. L'admin colle **une fois** la clé secrète du compte Stripe dans l'appli, rubrique **Espace admin › Paiement en ligne**. Elle est stockée chiffrée dans `ggPrivate/stripe`, avec la clé `PL_ENC_KEY` qui existe déjà. Le setup crée ensuite les prix des 3 packs (lookup_key `gg_<pack>_<centimes>_m`), le taux de TVA (en option), la configuration du portail client et deux webhooks vers `stripeWebhook` : le premier pour la plateforme, le second, `?c=1`, pour Connect et les commandes du menu QR.
- Le compte Stripe est **partagé avec Nova**, l'autre activité de la même micro-entreprise. Le setup ne crée que des objets marqués Growth Gusto (`metadata.app = growth-gusto`) et ne supprime que les webhooks qui pointent vers `stripeWebhook`. Le webhook ignore tout ce qui n'a pas de `metadata.rid`.
- Le plan payé (`plan`, `paidUntil`, `stripe`) n'est écrit que par le serveur ou par un admin : voir `billKeys()` dans firestore.rules.
- Pour les autres modules, comme `commande.js` : `require("./stripe")._onStripeEvent("order", fn)` et `_stripeCall(path, { account })`.
- Pour changer un prix : modifier `AB_PRICES` dans stripe.js **et** `AB_PACKS` dans js/abo.js, déployer, puis relancer « Changer la clé » dans l'admin (la même clé). Un nouveau prix est alors créé. Les abonnés en cours gardent l'ancien prix.
