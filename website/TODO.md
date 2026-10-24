# Suivi des livrables — DJOUSSE TECH MD

## 1. Pages éditoriales, navigation et contenu de la vitrine

- [x] Le dossier `website/` contient une page d’accueil, un catalogue `commandes.html`, une page `connexion.html`, un guide `installation.html`, une page `securite.html`, une page `politique.html`, une FAQ `faq.html` et une page `404.html`.
- [x] Toutes les pages partagent la navigation et le pied de page; la navigation donne accès à Commandes, Connexion, Installation, Sécurité, FAQ, au changement de thème et à GitHub.
- [x] L’accueil explique en moins de 10 secondes l’assistant WhatsApp 100 % texte, le menu à chiffres, DJOUSSE GUARD, l’IA et les 11 catégories; il comprend une maquette CSS de conversation `.menu` → menu `1`–`11` → réponse `7`, les statistiques, les trois piliers, les catégories, les 13 protections dans leur ordre, les capacités IA/médias, les trois modes Baileys/Agent officiel/Hybride, un appel à l’action, les liens utiles, la licence et la mention de non-affiliation à WhatsApp.
- [x] Les catégories, protections, liens, chiffres et textes communs proviennent de `data/site-data.json`; les totaux du registre et des alias ne sont pas présentés comme confirmés.
- [x] `installation.html` reprend fidèlement les prérequis, commandes de clonage/installation, configuration `.env`, démarrage, service détaché, tableau d’hébergement et quatre règles d’or du cloud du README; les blocs de commande ont un bouton Copier, avec sommaire latéral sur desktop et recherche dans la page.
- [x] `securite.html` reprend sans les affaiblir les blocs sécurité, confidentialité, données transmises à l’IA, services externes, conservation/suppression, politique d’utilisation et relation indépendante avec WhatsApp; `politique.html` présente séparément la politique d’utilisation complète.
- [x] La FAQ accessible avec `<details>` couvre au minimum le risque de bannissement, WhatsApp Business, l’absence de boutons natifs, les pauses de conflit et `.unpause`, les suppressions impossibles sans droits admin, l’effacement des données, les données transmises à l’IA et l’hébergement gratuit.
- [x] L’attribution visible indique « Créé par Djousse Uriel » et n’attribue pas le site à un agent IA.

## 2. Catalogue des commandes

- [x] `commandes.html` charge `data/commands.json`; si le catalogue réel n’est pas encore généré, elle affiche les exemples issus du README et un bandeau discret « Catalogue partiel ».
- [x] La recherche instantanée est insensible à la casse et aux accents, et porte sur le nom, les alias et la description.
- [x] Les filtres couvrent les 11 catégories et les accès `public`, `admin`, `owner`.
- [x] Chaque fiche affiche le nom avec le préfixe `.`, les alias, la description, l’usage, le badge d’accès et un bouton Copier.
- [x] `?cat=N` pré-sélectionne la catégorie; `#nom-de-commande` rejoint la commande; l’état vide affiche « Aucune commande ne correspond. Essaie un autre mot. »; le rendu est incrémental ou paginé à partir de 300 éléments.
- [x] `scripts/export-commands.js` lit la Map `commands` et les catégories réellement exportées par `handler.js`, déduplique les alias, produit le schéma `{name, aliases, category, description, usage, access}` avec `access` dans `public` / `admin` / `owner`, et écrit `website/data/commands.json`. Le chemin export a été vérifié avec 320 commandes et la pagination rend 48 éléments par lot.

## 3. Formulaire de jumelage et relais API

- [x] `connexion.html` explique les trois étapes: saisir le numéro, recevoir un code de 8 caractères, puis suivre le chemin WhatsApp « Appareils connectés → Connecter un appareil → Associer avec un numéro de téléphone » et saisir le code.
- [x] Le champ de numéro comprend un sélecteur d’indicatif par défaut `+237`, accepte uniquement 8 à 15 chiffres après indicatif, et le formulaire explique tout échec de validation.
- [x] L’indicateur d’état appelle `GET /status` toutes les 30 secondes et affiche le message d’indisponibilité prévu si le service ne répond pas.
- [x] Le bouton « Obtenir mon code » est désactivé pendant la requête, empêche les doubles clics, applique un délai maximal de 15 secondes et affiche le code en deux groupes de quatre caractères avec un bouton Copier.
- [x] Les erreurs numéro invalide, HTTP 409 (session déjà enregistrée), limitation de demandes et service indisponible sont distinctes; la durée de validité reste un `TODO` visible et n’est pas inventée.
- [x] Des avertissements visibles disent de ne pas transmettre le code à quelqu’un ni de le publier dans un groupe.
- [x] `js/api.js` est le seul module navigateur qui appelle l’API de jumelage; il essaie les routes Vercel `/api/status` et `/api/pair`, avec repli sur `/status` et `/pair` pour le service du bot. Les autres lectures `fetch` sont des fichiers de données statiques de même origine.
- [x] `website/api/status.js` et `website/api/pair.js` lisent `PAIRING_API_URL` et `PAIRING_API_TOKEN` côté serveur, appellent le contrat vérifié du bot (`GET /status`, `POST /pair` avec `{ "number": "+…" }`), ne renvoient pas le jeton, restreignent l’origine, valident le numéro et ne journalisent pas le numéro.
- [x] Les réponses API sont JSON uniformes et les fonctions serveur appliquent une limitation par IP; la documentation indique que la limite mémoire Vercel est par instance et ne remplace pas un service de limite partagé/distribué.
- [x] Le site reste lisible si l’API est absente; il indique alors clairement que le jumelage n’est pas disponible.

## 4. Design, accessibilité, SEO et métadonnées

- [x] Les fichiers `css/tokens.css`, `css/base.css` et `css/components.css` contiennent le système de design terminal/hacker propre, vert DJOUSSE, composants partagés et états de focus.
- [x] Le thème sombre est le thème initial, le thème clair est disponible, le choix est conservé dans `localStorage` et appliqué avant le premier rendu pour éviter le flash.
- [x] La mise en page est mobile-first et ne crée aucun défilement horizontal à 360 px; elle reste adaptée à 768 et 1280 px.
- [x] La navigation clavier est fonctionnelle, les focus sont visibles, les champs sont associés à leurs libellés, les annonces d’état sont accessibles, les contrastes visent WCAG 2.1 AA et `prefers-reduced-motion` désactive les animations.
- [x] Lighthouse mobile atteint au moins 90 dans chacune des quatre catégories: Performance, Accessibilité, Bonnes pratiques et SEO (résultats: 92 / 100 / 100 / 100).
- [x] Les titres, descriptions de 160 caractères maximum, liens canonical et métadonnées Open Graph/Twitter sont propres à chaque page; `assets/og-image.png` fait 1200 × 630.
- [x] L’accueil comporte le JSON-LD `SoftwareApplication` avec nom, version, licence MIT, langue française et système `Node.js ≥ 18`.
- [x] `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, favicon SVG et icônes locales sont inclus; la 404 a une indication noindex et n’est pas dans le sitemap.
- [x] Aucun cookie, traceur, script tiers de suivi ou publicité; seules les requêtes Google Fonts et celles vers l’origine même du site sont permises.

## 5. Export, déploiement et documentation

- [x] Le site ne requiert aucun framework ni compilation; les chemins sont relatifs, et `npx serve website` suffit pour l’ouvrir localement ou après copie dans le dossier `website/` du bot avec `SERVE_SITE=on`.
- [x] `website/README.md` explique le lancement local, le déploiement Vercel avec `website/` comme Root Directory et ses variables d’environnement, la copie vers un hébergeur statique, l’activation de l’API sur le bot et la régénération de `commands.json`.
- [x] Les instructions distinguent l’hébergement du site/fonctions du worker WhatsApp persistant, qui doit être hébergé séparément.
- [x] Aucun déploiement public n’est lancé pendant cette réalisation.
- [x] Les TODO restants (`commands_registry`, `aliases`, durée de validité du code, domaine/origine à adapter lors d’un autre déploiement) sont explicitement recensés dans la livraison.
