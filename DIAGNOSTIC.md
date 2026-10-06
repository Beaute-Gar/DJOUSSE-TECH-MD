# Si rien ne marche — procédure de secours

## Étape 0 — Ton setup (d’après le log)

- **Bot WhatsApp** = `+237 659 809 751`
- **Owner configuré** = `+237 693 978 044`
- Préfixe = `.`
- Session connectée, 164 commandes OK

Tu dois écrire **à** `+237 659 809 751` (le bot).

---

## Étape 1 — Reset mode self (obligatoire)

### A. Fichier `.env` (racine du projet)

```env
OWNER_NUMBER=237693978044
PREFIX=.
MODE=public
FORCE_PUBLIC=1
REJECT_CALL=true
AUTO_READ=true
```

### B. Fichier `data\state.json`

> ℹ️ Depuis la séparation base locale / credentials : `state.json`,
> `history.json`, `guard.json`, `scheduler.json` et `store/` vivent dans
> **`data/`** — `session/` ne contient plus que les credentials WhatsApp
> (`creds.json`, clés…). La migration est automatique au démarrage.

1. Arrête le bot (Ctrl+C)
2. Ouvre `data\state.json`
3. Mets `"selfMode": false`

Si le fichier pose problème :

```powershell
cd C:\Users\djous\Documents\DJOUSSE-TECH-MD
Rename-Item data\state.json state.json.bak -ErrorAction SilentlyContinue
```

---

## Étape 2 — Recopier les fichiers corrigés

Remplace dans ton projet :
- `config.js`
- `handler.js`
- `index.js`

---

## Étape 3 — Redémarrer

```powershell
cd C:\Users\djous\Documents\DJOUSSE-TECH-MD
npm start
```

**Variante détachée** (recommandée : le bot continue de tourner même
après avoir fermé la fenêtre PowerShell) :

```powershell
node scripts/service.js stop     # au cas où une instance tournerait encore
node scripts/service.js start    # PID dans logs\bot.pid
node scripts/service.js status   # état + dernière sortie
```

⚠️ **Une seule instance à la fois** : deux bots sur la même session =
conflit `440` / déconnexion en boucle.

Attends `CONNECTÉ` + `commandes chargées`.

---

## Étape 4 — Test

Chat **privé** avec **+237 659 809 751** :

```text
.ping
```

Dans le terminal tu dois voir :

```text
[MSG] ... : .ping
[CMD] ... → .ping | owner=... self=false
```

| Terminal | Action |
|----------|--------|
| Pas de `[MSG]` | Étape 5 (session) |
| `[MSG]` + réponse | OK |
| `SELF MODE — ignore` | Refaire étape 1 |
| `[HANDLER] ...` | Envoyer l’erreur |

---

## Étape 5 — Recréer la session

```powershell
cd C:\Users\djous\Documents\DJOUSSE-TECH-MD
# Ctrl+C
Remove-Item -Recurse -Force session
npm start
```

Scanne le **nouveau QR** avec le téléphone du bot (`+237 659 809 751`).

Reteste `.ping`.

---

## Étape 6 — Checklist Windows

1. Une seule fenêtre `npm start`
2. Heure Windows en automatique
3. WhatsApp du bot à jour + internet OK
4. Tu n’écris pas dans les Statuts
5. Tu écris bien **au numéro du bot**, pas à un autre contact

---

## Étape 7 — Owner = numéro du bot

Si tu préfères :

```env
OWNER_NUMBER=237659809751
MODE=public
FORCE_PUBLIC=1
```

Redémarre, puis `.ping` depuis ce numéro.

---

## Si ça bloque encore, envoie

1. Les 30 dernières lignes du terminal **après** `.ping`
2. Ton `.env` (sans les clés API)
3. Confirmation : tu écris bien à `+237 659 809 751` ?
