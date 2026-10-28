'use strict';
/**
 * Shim DJOUSSE : '../lib/bgmTrigger' (son de fond sur les commandes).
 * Désactivé : l'envoi de médias automatiques déclenche facilement les
 * détections anti-spam de WhatsApp. L'API existe et répond proprement.
 */
const bgm = { actif: false, fichier: null };
function setBgm(f) { bgm.fichier = f; return bgm; }
function enable() { bgm.actif = true; return bgm; }
function disable() { bgm.actif = false; return bgm; }
function getBgm() { return bgm; }
module.exports = { setBgm, enable, disable, getBgm };
