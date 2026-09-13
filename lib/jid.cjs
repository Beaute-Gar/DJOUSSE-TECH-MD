'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

/**
 * Normalise un JID WhatsApp de manière sûre.
 * Retourne toujours une string (ou '' si invalide).
 */
function normalizeJid(jid) {
    if (!jid) return '';
    if (typeof jid !== 'string') return '';
    try {
        return jidNormalizedUser(jid);
    } catch {
        return jid;
    }
}

/**
 * Extrait le numéro pur d'un JID (sans @s.whatsapp.net, sans :device).
 * normalizeJid('12345:67@s.whatsapp.net') → '12345'
 */
function extractNumber(jid) {
    if (!jid || typeof jid !== 'string') return '';
    return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

/**
 * Vérifie si un JID est un groupe.
 */
function isGroupJid(jid) {
    return typeof jid === 'string' && jid.endsWith('@g.us');
}

/**
 * Vérifie si un JID est un statut broadcast.
 */
function isStatusJid(jid) {
    return jid === 'status@broadcast';
}

/**
 * Convertit un numéro en JID utilisateur standard.
 * '237693978044' → '237693978044@s.whatsapp.net'
 */
function numberToJid(num) {
    const clean = String(num || '').replace(/[^0-9]/g, '');
    return clean ? `${clean}@s.whatsapp.net` : '';
}

module.exports = { normalizeJid, extractNumber, isGroupJid, isStatusJid, numberToJid };
