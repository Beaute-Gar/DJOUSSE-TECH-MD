# Stratégie de migration Baileys → whatsapp-web.js (v1)

> Audit réalisé sur l'état **live** du bot (moteur `wwebjs`, 160 plugins, PID valide).
> Ce document est **factuel** : chaque ligne provient d'un scan réel du code, pas d'hypothèses.

---

## 1. Constat principal

**Aucun plugin n'importe plus directement `@whiskeysockets/baileys`.**

Les seuls imports Baileys restants sont dans la couche **service/legacy** (hors chemin de commande) :
`src/services/recovery-engine.js`, `src/services/pg-auth.cjs`, `src/services/account-manager.cjs`,
`packages/infrastructure/session/*`, `packages/connectors/whatsapp/multi-session-bot.js`,
`packages/capabilities/features/multi-session.js` → multi-comptes/PostgreSQL, **pas touchés** par le routeur.

L'adaptateur `src/engine/wwebjs-adapter.cjs` expose déjà une surface `sock` **compatible Baileys**
(env. 40 méthodes). Le scan croisé « méthodes appelées par les plugins » vs « méthodes de l'adapter » donne :

| Couverture                                                        | Résultat |
| ----------------------------------------------------------------- | -------- |
| Méthodes d'engine différentes appelées par les plugins            | 36       |
| Dont déjà implémentées dans l'adapter                             | **35**   |
| Dont **manquantes** → `sendPresenceUpdate`                         | **1**    |
| Dont « non supportées » par choix (stub/throw clair)              | 9        |

→ La migration « masse » n'est **pas** nécessaire. Il faut : 1 méthode ajoutée (fait),
des messages propres sur les 9 stubs, et des corrections logiques sur les plugins média/quoted (fait pour les principaux).

---

## 2. Surface de l'adapter `conn` (= `sock`)

Déjà en place dans `src/engine/wwebjs-adapter.cjs` (vérifié ligne par ligne) :

**Messages / média**
- `sendMessage(chat, content, options)` → text, image, video, audio(ptt), sticker, document, contact, vCard, mentions, **edit**, **delete**, **react**, statuts, quoted. Retourne `{ key }` avec **id réel**.
- `downloadMediaMessage(m, filename)` → délègue à `lib/wwebjs-msg.cjs` (fallback vue-unique `pageDownloadMedia`).
- `relayMessage(jid, content)`, `loadMessages(jid, limit)`, `loadMessage(jid, id)`.

**Groupes**
- `groupMetadata`, `groupParticipantsUpdate` (add/remove/promote/demote),
- `groupSettingUpdate`, `groupSettingsUpdate`, `groupUpdateSubject`, `groupUpdateDescription`,
- `groupLeave`, `groupFetchAllParticipating` (**fallback Store : 11 groupes**),
- `groupCreate`, `groupAcceptInvite`, `groupInviteCode`, `groupRevokeInvite(Code)`,
- `groupToggleEphemeral`, `groupRequestParticipantsList/Update` (stub → `[]`).

**Profil / contacts / chaînes**
- `profilePictureUrl`, `updateProfilePicture`, `removeProfilePicture`, `updateProfileStatus`, `fetchStatus`,
- `getContacts`, `getBlockList`, `updateBlockStatus`, `onWhatsApp`, `getBusinessProfile`, `getLabels`,
- `newsletterFollow/Unfollow/Subscriptions` (followed channels), `chatModify` (archive/pin/mute/star).

**Stubs volontaires (pas un bug, une absence de feature wwebjs)**
- `requestPairingCode` (QR seul), `query` (2FA), `requestPayment`, `addProduct`,
- `getProductCatalog` (→ `[]`), `rejectCall`, `removeDevice`, `authState` (dummy), `store` (dummy).

**Ajouté cette session**
- `sendPresenceUpdate(presence)` (available/unavailable/composing/recording/paused) — **manquait** (protection.cjs).
- `readMessages(jids)` → `client.sendSeen`.

---

## 3. Matrice de compatibilité (par catégorie)

| Catégorie              | Exemple        | wwebjs natif | Adapter requis | Verdict |
| ---------------------- | -------------- | :----------: | :------------: | ------- |
| Messages texte         | `.ping`        | ✅            | —              | ✅      |
| Médias (quoted)        | `.togif`       | ⚠️           | ✅              | ✅ fait |
| Vue unique             | `.vv`          | ⚠️           | ✅              | ✅ fait |
| Édition                | `.ping` `.fix` | ⚠️           | ✅              | ✅ fait |
| Groupes / membres      | `.add` `.kick` | ✅            | ✅ (adapter)   | ✅      |
| Admin groupe           | `.promote`     | ✅            | ✅ (adapter)   | ✅      |
| Réactions              | react          | ✅            | —              | ✅      |
| Suppression            | `.delete`      | ✅            | —              | ✅      |
| Présence               | protection     | ✅            | ✅ (ajouté)    | ✅      |
| Contacts / profil      | `.pp` `.calc`  | ✅            | —              | ✅      |
| Chaînes (newsletter)   | `.channel`     | ✅            | —              | ⚠️ à tester |
| Business / catalogue   | `.pay` `.product` | ❌        | access          | ⚫ non dispo |
| 2FA / pairing          | `.twostep` `.pair` | ❌       | access          | ⚫ non dispo |
| Legacy Baileys (services) | multi-session | ❌          | architecture    | 🔴 hors périmètre |

---

## 4. Classification commande par commande (scan réel)

### 🟢 Standard — 103 plugins
Ne dépendent que des hooks communs (`conn.sendMessage`, `reply`, `box`, API HTTP). **Aucun travail.**

### 🟢 Groupe (adapter OK) — 13 plugins
`action-verite`, `add`, `admin`, `broadcast`, `close`, `creategroup`, `deldup`, `disappear`,
`group-extra2`, `invite`, `join`, `myaccount`, `setname`.
→ méthode partagée `groupParticipantsUpdate` (dans l'adapter). **Vérifier permissions** (côté groupe).
*1 seul test live par action admin (add/kick/promote/demote) recommandé.*

### 🟡 Média — 2 plugins
`anime_effect_image_edit`, `img2sticker` (obfusqués).
→ `downloadMediaMessage` corrigé (fallback vue-unique) → **re-tester** (`img2sticker` = envoi direct/quote).

### 🟡 Média + quoted (adapter OK) — 35 plugins
`0ai-members`, `ai-extra`, `biz`, `blacklist`, `block`, `clonevoice`, `contact`, `convert-extra`,
`convert` (**corrigé**), `delete`, `demote`, `download-clean`, `download-extra`, `enhance`, `fix`,
`general-extra`, `group-extra`, `group`, `jid`, `owner-settings`, `pdf`, `pp`, `prexzy`, `qr`, `save`,
`setpp`, `text_to_speech_`, `transcribe`, `unblock`, `unwarn`, `vision`, `vv` (**corrigé**), `warn`,
`warnings`, `whois`.
→ mêmes fixes que `.vv`/`.togif` (résolution `m.quoted` + fallback download). **Re-tester en batch.**

### 🟡 Présence — 1 plugin
`protection` → `sendPresenceUpdate` **ajouté** à l'adapter. ✅

### ⚫ Éditions/risque faible restant
`direct.cjs`, `fb.cjs`, `instagram.cjs`, `video.cjs`(disabled)… : **obfusqués** → `node --check` OK,
mais logique illisible. À ne **pas** réécrire ; test au cas par cas.

### ⚫ Stubs volontaires (features absentes wwebjs) — 5 plugins
`catalogue` (`getProductCatalog`→[]), `pair-owner` (`requestPairingCode` throw), `pay` (`requestPayment`
throw), `product` (`addProduct` throw), `twostep` (`query` throw qui peut faire remonter l'erreur).
→ **Action recommandée** : attraper l'erreur dans chaque plugin et répondre
« ❌ Non supporté par le moteur whatsapp-web.js » clairement (au lieu de « Prioritaire error »).

---

## 5. Règle d'architecture (ce que le plan officiel impose)

> **Les plugins n'appellent jamais Baileys.** Toute action passe par `conn.*` (adapter), qui décide
> comment la réaliser avec whatsapp-web.js. C'est déjà le cas à 100% — à préserver.

Ordre de priorité de migration (faits, pas de tout-réécrire) :

1. ✅ **Déjà corrigé (session)**
   - `.vv` : fallback `pageDownloadMedia` (WAWebDownloadManager) contournant `hasMedia=false`.
   - `.convert/.sticker/.toimg/.tovideo/.togif/.toaudio/.tomp3` : résolution `m.quoted` → `src.type`.
   - `.ping` : registre mémoire `global.__wwebjsSent` → édition sans re-fetch.
   - adapter : +`sendPresenceUpdate`, +`readMessages`.
2. **À faire (court terme)**
   - Messages propres sur les 5 plugins business/2FA ⚫ (catch + réponse claire).
   - Smoke test live des actions admin groupe (`.add`, `.kick`, `.promote`, `.demote`) — 1 rôle par rôle.
   - Smoke test live des 35 plugins média/quoted (coté `.vv`/`.togif` validés ; lot 2).
   - Vérifier chaînes (`.channel`) sur version web épinglée.
3. **À faire (moyen terme)**
   - Jeux PartyPlay (moteur à états par chat + 1 commande par jeu + `games_menu.cjs`).
   - Dashboard (Semaine 2 roadmap).
4. **Hors périmètre**
   - Multi-session / pg-auth (layer services, Baileys gardé pour compat PostgreSQL).