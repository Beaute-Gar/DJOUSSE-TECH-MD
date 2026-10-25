# DJOUSSE TECH MD — mise à jour guard + correctifs

## Fichiers à remplacer / ajouter
| Fichier | Action |
|---|---|
| `config.js` | **remplacer** (ajout du bloc `guard`, retrait de `messages.maxWarnings` inutilisé) |
| `handler.js` | **remplacer** |
| `index.js` | **remplacer** |
| `style.js` | **nouveau** (racine) — source unique du style DJOUSSE TECH |
| `guard/` | **remplacer tout le dossier** (supprime l'ancien `guard/src/handler.js` et `guard/index.js` s'ils existent : plus utilisés) |

`.env` (optionnel) : `GUARD_LOG=true` (rapport des expulsions en DM owner), `GUARD_TZ=Africa/Douala`, `GUARD_DB=guard.json`.

## Bugs corrigés (tous couverts par un test sur ton vrai handler.js)
1. **Stickers, vocaux, médias sans légende, sondages, contacts, mentions de statut n'étaient jamais contrôlés** : les protections passaient après `if (!text) return`. Elles passent maintenant en premier.
2. **Les nouvelles protections ne recevaient pas leurs données** : le contexte envoyé au moteur n'incluait pas statut/transfert/contact/sondage. Contexte complet transmis.
3. **Un lien pouvait être « avalé » comme saisie en attente** (`.play` puis lien) ou par le menu, et **le mode self coupait les protections** : protections avant tout.
4. **Antidelete annulait l'antilink** : le bot supprimait le lien, puis antidelete le re-postait. Les suppressions du bot/guard ne sont plus re-postées, ni un lien interdit.
5. **Interrupteurs cassés** : `.antilink`, `.antidelete`, `.welcome`, `.goodbye`, `.glog` sans argument disaient « Tape à nouveau pour basculer » sans rien basculer. Sans argument = bascule ; argument invalide = erreur.
6. **`index.js` bloquait tous les statuts** (`@broadcast` filtré) : le moteur STATUTS (vu/réaction/réponse auto) n'était jamais atteint. Corrigé, et la lecture auto ne marque plus les statuts comme vus.
7. **Réactions et révocations comptaient comme flood** → faux positifs anti-flood.
8. **Contournement par édition** (« salut » puis édité en lien) : les éditions sont analysées.
9. **Cache des permissions en double** (handler + guard) : après promotion du bot, les commandes restaient « bot non admin » jusqu'à 60 s. Un seul cache, invalidé par index.js.
10. **Owner non reconnu quand WhatsApp donne un LID** : le numéro réel (`participantAlt`) est aussi vérifié.
11. Chemin de la base guard ignorait `SESSION_DIR` ; `state.warns` mort supprimé.

## Doublons supprimés (une seule version de chaque)
style (→ `style.js`) · `unwrap` · `formatDuration` · cache/permissions de groupe · `num` · `isSystemJid` (index/handler) · filtre « vieux message » (index/handler) · `guardToggle` + 5 commandes toggle copiées (→ 1 boucle `SWITCHES`) · commandes protections copiées (→ 1 boucle `guardCmd`) · config guard (lit `config.js`) · `glog` défini deux fois · `streamToBuffer` (code mort).

## Nouveautés
- Style DJOUSSE TECH partout dans le guard (cadres `╭┄┄『 』┄❍`, `│✦`, alphabet officiel).
- **Anti-statut** `.antistatus` (expulsion par défaut) · **anti-virtex** · anti-forward · anti-contact · anti-sondage.
- **Anti-fake** `.antifake` + `.allowcodes 237 33` (avant la bienvenue) · **Mode nuit** `.nightmode` / `.nightset 22:00 06:00`.
- Sanction par protection : `.sanction antistatus warn` · journal des expulsions au owner (`GUARD_LOG`).

## Limites honnêtes
- Format du message « mention de statut » : 3 variantes couvertes, à confirmer sur un vrai WhatsApp.
- `textOf`/`ctxInfo` (handler) et `parse` (guard) se ressemblent encore : rôles différents (boutons/menus vs protections), non fusionnés par prudence.
