'use strict';
/**
 * lib/wa-send.js — SERVICE UNIQUE D'ENVOI WhatsApp (garantie G2)
 * ────────────────────────────────────────────────────────────────
 * Point de passage obligatoire pour tout message sortant :
 *
 *   const { send, typingOn, typingOff } = require('./lib/wa-send');
 *   await send(sock, jid, { text: 'bonjour' }, { quoted: msg });
 *
 * Garanties :
 *   - signature identique à `sock.sendMessage(jid, content, opts)` avec le
 *     socket passé en 1er argument ;
 *   - un socket absent ou incomplet renvoie `undefined` (promesse résolue)
 *     au lieu de lever TypeError (bot en cours de reconnexion) ;
 *   - SEUL fichier du projet autorisé à appeler `.sendMessage(`
 *     (contrôle : scripts/audit.js, garantie G2).
 *
 * ── MODULE 2 : HUMANISATION DU TRANSPORT (anti-bannissement) ──────
 *   - tout message TEXTÉ déclenche d'abord la présence « écrit… »
 *     (composing — si AUTO_TYPING), puis un DÉLAI ALÉATOIRE 300–1100 ms
 *     avant l'envoi réel : le bot ne répond plus de façon instantanée ;
 *   - après l'envoi : présence « paused » (fin d'écriture) ;
 *   - réglages .env : HUMAN_DELAY=0 désactive · HUMAN_DELAY_MIN /
 *     HUMAN_DELAY_MAX en ms (lus à chaque envoi) ;
 *   - contenu NON-texte (médias, réactions, protocole, suppressions) :
 *     envoi immédiat — un délai sur les réactions/protections gênerait
 *     le guard sans effet anti-bannissement (WhatsApp pénalise les
 *     rafales de messages, pas les taps rapides).
 *
 * ── typingOn / typingOff : IMPLÉMENTATION UNIQUE de la présence ───
 *   « écrit… » (le handler les importe — plus aucune copie ailleurs).
 *   État partagé par chat : si dispatcher a déjà ouvert « écrit… »,
 *   send() ne l'ouvre pas deux fois et se contente de le fermer après
 *   l'envoi (typingOff suivant devient un no-op idempotent).
 */

const config = require('../config/config');
const envoi = require('./envoi');

/* jid → true : présence « écrit… » actuellement ouverte par ce module */
const composing = new Map();

const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/** Délai humain aléatoire (ms) — HUMAN_DELAY=0 coupe, MIN/MAX réglables. */
function humanDelayMs() {
  if (process.env.HUMAN_DELAY === '0' || process.env.HUMAN_DELAY === 'false') return 0;
  const lo = parseInt(process.env.HUMAN_DELAY_MIN ?? '', 10);
  const hi = parseInt(process.env.HUMAN_DELAY_MAX ?? '', 10);
  const min = Number.isFinite(lo) ? Math.max(0, lo) : 300;
  const max = Number.isFinite(hi) ? Math.max(min, hi) : 1100;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function openComposing(sock, jid) {
  if (composing.get(jid)) return; // déjà ouvert (typingOn ou 1er envoi)
  if (typeof sock.sendPresenceUpdate !== 'function') return;
  composing.set(jid, true);
  sock.sendPresenceUpdate('composing', jid).catch(() => {});
}

function closeComposing(sock, jid) {
  if (!composing.get(jid)) return;
  composing.delete(jid);
  if (typeof sock.sendPresenceUpdate !== 'function') return;
  sock.sendPresenceUpdate('paused', jid).catch(() => {});
}

async function send(sock, jid, content, opts) {
  if (!sock || typeof sock.sendMessage !== 'function') return undefined;

  /* ── CONTRÔLE D'ENVOI (lib/envoi) ─────────────────────────────────
     Allowlist → qualité → montée en charge → fenêtres glissantes →
     pause d'erreur. Un refus est journalisé et l'envoi n'a pas lieu :
     aucun appel à sock.sendMessage n'est fait dans ce cas. */
  const verdict = envoi.avantEnvoi({ jid, contenu: content, opts });
  if (!verdict.ok) {
    console.error(`[ENVOI] refusé (${verdict.code}) — ${verdict.raison}`);
    return undefined;
  }

  const isText = typeof content?.text === 'string';
  const humain = isText && jid ? humanDelayMs() : 0;
  /* HUMAN_DELAY=0 coupe le rythme humain, PAS le limiteur : le délai de
     fenêtre (verdict.delaiMs) reste appliqué dans tous les cas. */
  const attente = Math.max(humain, verdict.delaiMs);

  if (isText && jid && config.autoTyping) openComposing(sock, jid);

  try {
    if (attente > 0) await sleep(attente);
    const resultat = await sock.sendMessage(jid, content, opts);
    if (verdict.compter) {
      envoi.apresEnvoi({
        jid, correlation: verdict.correlation, type: verdict.type, succes: true,
      });
    }
    return resultat;
  } catch (e) {
    if (verdict.compter) {
      envoi.apresEnvoi({
        jid, correlation: verdict.correlation, type: verdict.type, succes: false, erreur: e,
      });
    }
    throw e;
  } finally {
    if (isText && jid && config.autoTyping) closeComposing(sock, jid);
  }
}

/* ── Présence « écrit… » — implémentation unique (importée par handler) ── */
function typingOn(sock, jid) {
  if (!config.autoTyping || !jid || !sock) return;
  openComposing(sock, jid);
}

function typingOff(sock, jid) {
  if (!jid || !sock) return;
  closeComposing(sock, jid);
}

module.exports = { send, typingOn, typingOff, humanDelayMs };
