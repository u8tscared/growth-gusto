# Mise en ligne automatique

Chaque merge sur `main` lance `.github/workflows/deploy.yml` :

- site (growthgusto.fr), app (app.growthgusto.fr) et règles Firestore, à chaque fois ;
- fonctions serveur, seulement quand `functions/` a changé (ou via « Run workflow » en cochant « fonctions »).

Suivi : onglet **Actions** du dépôt, workflow « Mise en ligne ». Plus besoin de lancer `firebase deploy` depuis le Mac.

## Connexion sans clé (réglage unique, déjà fait une fois)

GitHub se connecte à Google par Workload Identity Federation : aucune clé, aucun secret. Seul le dépôt
`u8tscared/growth-gusto` peut emprunter le compte de service `github-deploy`. À refaire seulement si le projet change.
Dans Cloud Shell (console.cloud.google.com, projet growth-gusto) :

```sh
P=growth-gusto; N=$(gcloud projects describe $P --format='value(projectNumber)'); SA=github-deploy@$P.iam.gserviceaccount.com
gcloud iam service-accounts create github-deploy --project $P --display-name "GitHub : mise en ligne"
for R in firebase.admin iam.serviceAccountUser cloudfunctions.admin run.admin secretmanager.admin artifactregistry.admin \
         cloudscheduler.admin cloudbuild.builds.editor serviceusage.serviceUsageConsumer eventarc.admin pubsub.admin; do
  gcloud projects add-iam-policy-binding $P --member serviceAccount:$SA --role roles/$R --condition None -q >/dev/null; done
gcloud iam workload-identity-pools create github --project $P --location global --display-name GitHub
gcloud iam workload-identity-pools providers create-oidc github --project $P --location global --workload-identity-pool github \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition "assertion.repository=='u8tscared/growth-gusto'"
gcloud iam service-accounts add-iam-policy-binding $SA --project $P --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/u8tscared/growth-gusto"
echo "WIF_PROVIDER: projects/$N/locations/global/workloadIdentityPools/github/providers/github"
```

Le numéro de projet affiché à la fin va dans `WIF_PROVIDER` de `.github/workflows/deploy.yml`.
