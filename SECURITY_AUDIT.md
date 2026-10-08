# Rapport initial de sécurité — DJOUSSE-TECH-MD

Branche : `improvement/security-stability-audit`  
Périmètre : revue statique ciblée de `handler.js`, `index.js`, `config.js`, `lib/vigilLink.js`, `.gitignore` et `scripts/audit.js`.

## Correction appliquée

### Autorisations propriétaire / sudo : comparaison exacte des numéros

Les fonctions d'autorisation comparaient auparavant les numéros avec `endsWith` dans plusieurs chemins. Une comparaison par suffixe peut accepter un numéro différent partageant les mêmes derniers chiffres. Les vérifications concernées utilisent désormais une comparaison exacte après normalisation en chiffres :

- `isPrimaryOwner`
- `isSudoNumber`
- `isOwnerJid`
- le contrôle owner utilisé dans le chemin de traitement des messages concernés

Le numéro vide est explicitement rejeté pour les contrôles owner/sudo. Cela réduit le risque qu'un compte non autorisé soit considéré comme propriétaire à cause d'une correspondance partielle.

## Vérification automatisée ajoutée

`scripts/audit.js` comprend maintenant un contrôle G5 qui signale l'utilisation de comparaisons par suffixe dans les trois helpers d'autorisation.

À exécuter localement après installation des dépendances :

```bash
npm run check
npm run audit
```

Le contrôle G5 est un contrôle statique ciblé, pas un substitut à des tests d'autorisation avec des identités de test.

## Points de vigilance identifiés — à vérifier avant production

1. **Pont Vigil :** `index.js` publie le QR et le code d'appairage dans l'état synchronisé, et les journaux sont relayés au serveur distant. Il faut confirmer côté Vigil que l'authentification, les autorisations par compte, les sessions et les réponses d'API protègent strictement ces données.
2. **Commandes distantes :** la commande `raw` injecte un texte dans le handler comme message du propriétaire. Il faut vérifier côté serveur Vigil qui peut créer cette commande et garantir que seuls les opérateurs autorisés peuvent l'envoyer.
3. **Secrets et sessions :** `.gitignore` exclut déjà `.env`, les dossiers de sessions, les données locales et les journaux. Il faut tout de même contrôler l'historique Git et les paramètres de déploiement avant publication.
4. **Dépendances :** exécuter `npm audit` dans un environnement disposant du réseau et examiner les avis selon les versions réellement installées.
5. **Tests en conditions réelles :** cette modification n'a pas été exécutée sur un compte WhatsApp de test dans le cadre de cette revue. QR, pairing, reconnexion et actions de groupe restent à tester séparément.

## Statut

- [x] Correction ciblée des comparaisons owner/sudo par suffixe.
- [x] Contrôle statique G5 ajouté à l'audit.
- [ ] Exécuter `npm run check` et `npm run audit` sur une copie installée du projet.
- [ ] Tester les refus d'accès avec des numéros proches mais différents.
- [ ] Auditer le serveur Vigil et son interface Web avant de déclarer le pont sûr.
- [ ] Tester les deux méthodes Baileys et les scénarios de reconnexion.

**Ce rapport ne certifie pas que l'ensemble du projet est sécurisé.** Il documente une correction précise et les vérifications encore nécessaires.
