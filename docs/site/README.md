# Export du site DJOUSSE TECH MD

Le site exportable se trouve dans [`web/`](../../web/). Il fonctionne sans compilation et peut être servi tel quel depuis `web/public/`.

- **Vercel** : importe ce dépôt, choisis `web/` comme **Root Directory** et laisse la commande de build vide. `vercel.json` fixe `outputDirectory` sur `public`. Les fonctions optionnelles de jumelage sont dans `web/api/`.
- **Hébergement statique** : publie le contenu du dossier `web/public/`.
- **Worker WhatsApp** : il reste distinct du site et doit tourner dans un environnement persistant. Les détails des variables d’API et de déploiement sont dans [`web/README.md`](../../web/README.md).
- **Catalogue** : le fichier livré est complet et provient du registre réel. Pour le régénérer après une modification des commandes, lance `node scripts/export-site-data.js` depuis la racine du dépôt. L’ancien exporteur [`scripts/export-commands.js`](scripts/export-commands.js) délègue désormais à ce script.

Le site lit `web/public/data/commands.json` et `web/public/data/site-data.json`. Le domaine `djousse-tech-md-web.vercel.app` reste une valeur de départ : adapte canonical, Open Graph/Twitter, `siteOrigin`, sitemap, robots et `SITE_ORIGIN` au domaine retenu avant la mise en ligne.