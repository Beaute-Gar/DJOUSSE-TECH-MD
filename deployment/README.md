# Déploiement

Ces fichiers ont été regroupés ici. Le contexte de build reste la **racine du dépôt**.

| Plateforme | Commande / réglage |
|---|---|
| Docker | `docker build -f deployment/Dockerfile -t djousse-tech-md .` |
| Docker Compose | `docker compose -f deployment/docker-compose.yml up -d --build` |
| Fly.io | `fly deploy --config deployment/fly.toml --dockerfile deployment/Dockerfile` |
| Render | Dashboard → Blueprint Path = `deployment/render.yaml` |
| Vercel (site) | Root Directory = `web` (le fichier `web/vercel.json` est lu à cet endroit) |
| Heroku / Railway | `Procfile` et `app.json` restent à la racine (exigé par la plateforme) |
| Replit | `.replit` reste à la racine (exigé par la plateforme) |

`deployment/vercel.json` est l'ancienne configuration « racine du dépôt » (outputDirectory `web/public`) ;
elle n'expose pas `web/api`. La configuration utilisée par le site est `web/vercel.json`.

`Dockerfile.dockerignore` est lu automatiquement par BuildKit à côté du Dockerfile.
