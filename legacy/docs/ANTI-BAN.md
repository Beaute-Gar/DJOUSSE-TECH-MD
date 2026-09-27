# 🛡️ Guide Anti-Ban WhatsApp — DJOUSSE TECH

## Règles d'or

### 1. Warmup progressif (30 jours)

| Période | Messages/j | Statuts/j | Chaîne/j |
|---------|:----------:|:---------:|:--------:|
| J0-J2   | 10         | 1         | 0        |
| J3-J6   | 25         | 2         | 1        |
| J7-J13  | 50         | 3         | 2        |
| J14-J29 | 100        | 4         | 3        |
| +30j    | 400        | 4         | 4        |

### 2. Quotas

- **10 messages / minute maximum**
- **60 messages / heure maximum**
- **3 secondes minimum entre messages**
- **2 heures minimum entre statuts**
- **4 heures minimum entre posts chaîne**

### 3. Délais humains

Le bot simule :
- Délai aléatoire 1.5-4 sec avant envoi
- Indicateur "en train d'écrire" 1-3 sec
- Pause avant envoi

### 4. Pause auto

Si WhatsApp renvoie un code 401/403/440 :
- Un fichier `database/RESTRICTED.flag` est créé
- Tous les schedulers sont arrêtés
- Aucun envoi n'est possible jusqu'à reset manuel

## Commandes admin

- `.warmup` → Voir l'état du warmup
- `.warmup reset` → Réinitialiser le warmup (jour 1)
- `.warmup restricted` → Voir l'état de restriction

## Configuration chaîne WhatsApp

1. Crée la chaîne **manuellement** dans WhatsApp
2. Récupère son code d'invitation (ex: `ABC123xyz`)
3. Récupère le JID via :
   ```js
   const meta = await sock.newsletterMetadata("invite", "ABC123xyz");
   console.log(meta.id); // ex: "120363xxx@newsletter"
   ```
4. Mets le JID dans `data/status-quotes-session.json` → `channelJid`

## ❌ Ce qu'il ne faut JAMAIS faire

- Créer une chaîne automatiquement
- Partager le lien de chaîne automatiquement sur des sites
- Envoyer des messages à froid (sans opt-in)
- Dépasser les quotas
- Publier plusieurs statuts d'affilée
- Utiliser le même template en boucle

## ✅ En cas de restriction

1. **Arrêter immédiatement** toute publication
2. **Ne pas insister** (aggrave la situation)
3. **Attendre 24-48h** minimum
4. **Demander une révision** à Meta si erreur
5. **Reset le warmup** : `.warmup reset`

## Fichiers

| Fichier | Rôle |
|---------|------|
| `lib/anti-ban.cjs` | Module central anti-ban |
| `lib/templates.cjs` | 12 templates variés |
| `lib/warmup.cjs` | Warmup progressif |
| `lib/safesend.cjs` | Wrapper sécurisé |
| `commands/owner/warmup.js` | Commande `.warmup` |
| `utils/statusQuotes.js` | Intégration anti-ban |
| `index.js` | Détection restriction |
| `database/RESTRICTED.flag` | Flag restriction (auto) |
| `database/anti-ban-quota.json` | Quotas quotidiens |
