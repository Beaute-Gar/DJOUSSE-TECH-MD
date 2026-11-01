# Site DJOUSSE TECH MD

Site statique en HTML/CSS/JavaScript vanilla. Aucun bundler, framework, base de données ou dépendance JavaScript côté navigateur n’est nécessaire. Les pages HTML sont complètes et lisibles sans rendu serveur; le dossier `web/public/` peut être servi tel quel.

## Lancer en local

Depuis la racine du dépôt :

```bash
npx serve web/public
```

Le site est alors accessible à l’adresse indiquée par `serve`. Les polices Inter et Fira Code sont chargées depuis Google Fonts; toutes les images, icônes, données et feuilles de style du site sont locales.

## Déployer sur Vercel

1. Crée un projet Vercel à partir du dépôt DJOUSSE TECH MD.
2. Définis `web/` comme **Root Directory**. Ne configure pas de commande de build : c’est un site statique sans build obligatoire. `vercel.json` fixe déjà `outputDirectory` sur `public` et Vercel détecte les fonctions Node.js situées dans `api/`.
3. Pour activer le formulaire, configure les variables d’environnement suivantes dans Vercel :
   - `PAIRING_API_URL` : URL HTTPS publique de l’API du worker, par exemple `https://bot.example.com` (ne pas ajouter `/pair` ou `/status`).
   - `PAIRING_API_TOKEN` : valeur du jeton partagé configuré côté bot, si l’API du bot l’exige. Elle ne se trouve jamais dans le navigateur.
   - `SITE_ORIGIN` : origine publique du site, par exemple `https://djousse-tech-md-web.vercel.app`; configure aussi les domaines de preview si tu veux y autoriser le formulaire.
4. Côté worker, active `PAIRING_API=on`, configure `PAIRING_API_PORT` si nécessaire, et protège l’API avec `PAIRING_API_TOKEN`. Le worker WhatsApp doit tourner ailleurs dans un environnement persistant; Vercel ne remplace pas ce processus.
5. Si le site change de domaine, mets à jour l’origine dans les métadonnées canonical / Open Graph / Twitter, le `siteOrigin` de `data/site-data.json`, `sitemap.xml` et `robots.txt`.

La fonction de jumelage applique une limite mémoire par adresse IP de cinq demandes par dix minutes et valide l’origine, le numéro et la réponse. Dans un environnement serverless, cette mémoire est propre à une instance et peut être réinitialisée; elle n’est donc pas une limite globale distribuée. L’API du bot applique également sa propre limite (huit demandes par minute et par IP). Pour une garantie globale, branche un stockage partagé de limitation de débit avant d’ouvrir largement l’API.

## Autres hébergeurs

- Pour un hébergeur statique (Pages, Netlify, stockage web, serveur Nginx), publie le contenu de `web/public/` sans étape de compilation. Les pages restent consultables même sans API; le formulaire indique alors que le jumelage est indisponible.
- Pour servir le site depuis l’instance du bot, copie le contenu dans le dossier `web/public/` du dépôt et active `SERVE_SITE=on`. L’interface utilise la même origine pour `/status` et `/pair`; configure **aucun** `PAIRING_API_TOKEN` côté bot pour cette connexion directe. Si l’API du bot exige un jeton, utilise plutôt les fonctions Vercel (elles ajoutent `x-api-token` côté serveur) ou ajoute un relais serveur équivalent à l’hébergeur choisi. Le navigateur n’envoie jamais ce jeton.
- Un site hébergé statiquement sur un domaine distinct ne peut pas appeler automatiquement un autre domaine de bot : utilise un relais serveur qui restreint le CORS et conserve le jeton côté serveur, ou déploie le site et l’API sous la même origine.

## Régénérer le catalogue

Le catalogue livré (`web/public/data/commands.json`) est **complet** : il est produit depuis le registre réellement chargé par le bot. Après `npm install`, lance depuis la racine du dépôt :

```bash
npm run site
# ou : node scripts/export-site-data.js
```

Le script charge la Map `commands` et les catégories exportées par `src/handlers/handler.js`, déduplique les alias, écrit `web/public/data/commands.json` puis recalcule les chiffres de `web/public/data/site-data.json` (registre, menu, alias, catégories affichées, protections). Aucun chiffre n’est saisi à la main.

`docs/site/scripts/export-commands.js` reste un point d’entrée compatible qui délègue au script principal ; ses options `--bot-root` et `--website-root` ne sont plus utilisées.

## Notes

- Aucun cookie, traceur ni outil d’analyse n’est installé. Le choix de thème est mémorisé localement dans `localStorage`.
- L’expiration exacte du code n’est pas documentée; la page la signale comme `TODO` et n’invente pas de compte à rebours.
- Les fonctions `api/pair.js` et `api/status.js` sont des relais Vercel. Le secret est lu uniquement dans l’environnement serveur.
