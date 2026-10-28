'use strict';
/**
 * Shim DJOUSSE : '../lib/bgmTrigger' (son de fond sur les commandes).
 * Désactivé : l'envoi de médias automatiques déclenche facilement les
 * détections anti-spam de WhatsApp. Les commandes répondent clairement.
 */
const bgm = { actif: false, fichier: null };
function setBgm(f) { bgm.fichier = f; return bgm; }
function enable() { bgm.actif = true; return bgm; }
function disable() { bgm.actif = false; return bgm; }
function getBgm() { return bgm; }
function isEnabled() { return false; }
function setTrigger() { throw new Error('Les déclencheurs audio automatiques sont désactivés pour protéger le compte WhatsApp.'); }
function delTrigger() { return false; }
function listTriggers() { return []; }
function matchTrigger() { return null; }
module.exports = { setBgm, enable, disable, getBgm, isEnabled, setTrigger, delTrigger, listTriggers, matchTrigger };
