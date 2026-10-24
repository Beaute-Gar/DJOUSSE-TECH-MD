# Export du site DJOUSSE TECH MD

Le site exportable se trouve dans [`website/`](website/README.md). Il fonctionne sans compilation et peut être servi tel quel.

- **Vercel** : importe ce dépôt, choisis `website/` comme **Root Directory** et laisse la commande de build vide. Les fonctions optionnelles de jumelage sont dans `website/api/`.
- **Hébergement statique** : publie le contenu du dossier `website/`.
- **Worker WhatsApp** : il reste distinct du site et doit tourner dans un environnement persistant. Les détails des variables d’API et de déploiement sont dans [`website/README.md`](website/README.md).
- **Catalogue** : le fichier livré est partiel. Pour le régénérer depuis le vrai registre, utilise [`scripts/export-commands.js`](scripts/export-commands.js) avec les options `--bot-root` et `--website-root` décrites dans le guide.

Le site n’a pas encore été déployé publiquement. Les nombres du registre et des alias, ainsi que la durée de validité du code, restent à confirmer par le mainteneur. Le domaine `djousse-tech-md.vercel.app` est une valeur de départ : adapte canonical, Open Graph/Twitter, `siteOrigin`, sitemap, robots et `SITE_ORIGIN` au domaine retenu avant la mise en ligne.