'use strict';
/**
 * lib/wa-send.js — SERVICE UNIQUE D'ENVOI WhatsApp (garantie G2)
 * ────────────────────────────────────────────────────────────────
 * Point de passage obligatoire pour tout message sortant :
 *
 *   const { send } = require('./wa-send');
 *   await send(sock, jid, { text: 'bonjour' }, { quoted: msg });
 *
 * Pourquoi : un seul endroit à auditer (scripts/audit.js contrôle que
 * plus aucun `.sendMessage(` n'existe hors de ce fichier) au lieu de 80+
 * appels disséminés dans 10 fichiers.
 *
 * Comportement :
 *   - signature identique à `sock.sendMessage(jid, content, opts)` avec le
 *     socket passé en 1er argument ;
 *   - un socket absent ou incomplet renvoie une promesse résolue `undefined`
 *     au lieu de lever TypeError (cas d'un bot en cours de reconnexion) ;
 *   - sinon la promesse de Baileys est retournée telle quelle : les
 *     await / try-catch / fire-and-forget des appelants restent valables.
 *
 * Aucune logique métier ici (pas de rate-limit, pas de formatage) : c'est
 * la couche d'acheminement uniquement.
 */

function send(sock, jid, content, opts) {
  if (!sock || typeof sock.sendMessage !== 'function') return Promise.resolve(undefined);
  return sock.sendMessage(jid, content, opts);
}

module.exports = { send };
