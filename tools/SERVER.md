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
