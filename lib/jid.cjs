'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

function normalizeJid(jid) {
    if (!jid) return '';
    if (typeof jid !== 'string') return '';
    try {
        return jidNormalizedUser(jid);
    } catch {
        return jid;
    }
}

function extractNumber(jid) {
    if (!jid || typeof jid !== 'string') return '';
    return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isGroupJid(jid) {
    return typeof jid === 'string' && jid.endsWith('@g.us');
}

function isStatusJid(jid) {
    return jid === 'status@broadcast';
}

function numberToJid(num) {
    const clean = String(num || '').replace(/[^0-9]/g, '');
    return clean ? `${clean}@s.whatsapp.net` : '';
}

module.exports = { normalizeJid, extractNumber, isGroupJid, isStatusJid, numberToJid };
