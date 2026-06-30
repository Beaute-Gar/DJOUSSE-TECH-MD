# Cognitive OS — Déploiement Render

## Prérequis
1. Compte Render (https://dashboard.render.com)
2. Base de données PostgreSQL créée sur Render (plan free)
3. Token de pairage défini dans les env vars

## Variables d'environnement requises

| Variable | Description | Exemple |
|---|---|---|
| `OWNER_NUMBER` | Numéro WhatsApp du propriétaire | `237659809751` |
| `GEMINI_API_KEY` | Clé API Google Gemini | `AIzaSy...` |
| `PAIRING_TOKEN` | Token pour sécuriser l'interface de pairage | (chaîne aléatoire) |
| `DATABASE_URL` | URL de connexion PostgreSQL | (fourni par Render) |

## Endpoints

| Route | Description |
|---|---|
| `/health` | Healthcheck |
| `/status` | Statut connexion WhatsApp |
| `/pair` | Pairage WhatsApp (POST, protégé par PAIRING_TOKEN) |
| `/api/status` | Dashboard — statut complet du Cognitive OS |
| `/api/agents` | Dashboard — liste des agents avec trust scores |
| `/api/workspaces` | Dashboard — workspaces multi-tenant |
| `/api/trust` | Dashboard — scores de confiance des agents |
| `/api/audit` | Dashboard — piste d'audit |
| `/api/approvals` | Dashboard — approbations en attente |
| `/api/missions` | Dashboard — missions et objectifs |
| `/api/groups` | Dashboard — groupes cognitifs |
| `/api/search` | Dashboard — recherche cognitive |

## Architecture (fichiers)
```
src/cognitive/          → Noyau cognitif (engines, agents, governance, apps)
src/core/               → Runtime bot + serveur web + middleware
src/lib/                → Base de données (sql.js)
src/commands/           → Commandes WhatsApp (.menu, etc.)
src/security/           → Auth, rate limiting
src/modules/            → Modules additionnels
```

## Keep-alive
Le système ping `/health` toutes les 10 minutes pour éviter le sommeil Render free.
Configurable via `KEEP_ALIVE_URL` ou détecté automatiquement via `RENDER_EXTERNAL_URL`.
