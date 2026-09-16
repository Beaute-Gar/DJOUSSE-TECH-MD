'use strict';

const crypto = require('crypto');

const DEFAULT_CONFIG = {
    enabled: true,
    delay: 1200,
    emojis: ['❤️','🔥','😍','😂','👏','💯','✨'],
    reactToOwnStatus: false,
    reactToOthers: true,
    preventDuplicates: true,
    cacheTTL: 60 * 60 * 1000,
    logging: true
};

let config = { ...DEFAULT_CONFIG };
let sock = null;
let sessionId = null;
let listenerInstalled = false;
const processedStatuses = new Map();
let cleanupTimer = null;

function log(...args) { if (config.logging) console.log('[AUTO-REACT]', ...args); }
function warn(...args) { console.warn('[AUTO-REACT]', ...args); }
function error(...args) { console.error('[AUTO-REACT]', ...args); }

function getStatusId(status) {
    if (!status) return null;
    const key = [
        status.id || '',
        status.key?.id || '',
        status.key?.remoteJid || '',
        status.key?.participant || '',
        status.messageTimestamp || ''
    ].join('|');
    return crypto.createHash('sha1').update(key).digest('hex');
}

function randomEmoji() {
    if (!config.emojis.length) return '❤️';
    return config.emojis[Math.floor(Math.random() * config.emojis.length)];
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function cleanupCache() {
    const now = Date.now();
    for (const [id, timestamp] of processedStatuses.entries()) {
        if (now - timestamp > config.cacheTTL) processedStatuses.delete(id);
    }
}

function normalizeStatus(status) {
    if (!status) return null;
    const key = status.key || {};
    const remoteJid = key.remoteJid || status.remoteJid || 'status@broadcast';
    const participant = key.participant || status.participant || null;
    const id = key.id || status.id || null;
    return {
        raw: status,
        key,
        id,
        remoteJid,
        participant,
        messageTimestamp: status.messageTimestamp || status.timestamp || Date.now(),
        pushName: status.pushName || null,
        fromMe: Boolean(key.fromMe || status.fromMe),
        isStatus: remoteJid === 'status@broadcast'
    };
}

function isOwnStatus(status) {
    if (!sock?.user?.id) return Boolean(status?.fromMe);
    const myJid = sock.user.id;
    const participant = status.participant || status.key?.participant || '';
    const normalizedMe = myJid.split(':')[0];
    const normalizedParticipant = String(participant).split(':')[0];
    return Boolean(status.fromMe) || (normalizedParticipant && normalizedParticipant === normalizedMe);
}

async function reactToStatus(status) {
    if (!sock) { warn('Socket WhatsApp indisponible'); return false; }
    if (!config.enabled) return false;

    const normalized = normalizeStatus(status);
    if (!normalized || !normalized.isStatus) return false;

    const ownStatus = isOwnStatus(normalized);

    if (ownStatus && !config.reactToOwnStatus) {
        log('Statut personnel ignoré :', normalized.id || 'ID inconnu');
        return false;
    }
    if (!ownStatus && !config.reactToOthers) return false;

    const statusId = getStatusId(normalized);
    if (config.preventDuplicates && statusId && processedStatuses.has(statusId)) {
        log('Statut déjà traité :', normalized.id || statusId);
        return false;
    }
    if (statusId) processedStatuses.set(statusId, Date.now());

    if (config.delay > 0) await sleep(config.delay);

    const emoji = randomEmoji();

    try {
        // Step 1: READ the status first (WhatsApp requires viewing before reacting)
        try {
            await sock.readMessages([normalized.key]);
        } catch (_) {}

        // Step 2: Use the original key directly (like the reference repo)
        const reactionKey = {
            remoteJid: normalized.key.remoteJid || 'status@broadcast',
            id: normalized.key.id || normalized.id,
            participant: normalized.key.participant || normalized.participant,
            fromMe: Boolean(normalized.key.fromMe)
        };

        if (!reactionKey.id) { warn('Impossible de réagir : ID du statut absent'); return false; }

        // Step 3: React with statusJidList (critical param from reference repo)
        const participantJid = normalized.key.participant || normalized.participant || sock.user.id;
        await sock.sendMessage('status@broadcast', {
            react: { text: emoji, key: reactionKey }
        }, { statusJidList: [participantJid, sock.user.id] });

        log(
            'Réaction envoyée',
            '|',
            ownStatus ? 'PROPRE STATUT' : 'STATUT CONTACT',
            '|',
            emoji,
            '|',
            normalized.participant || 'participant inconnu',
            '|',
            normalized.id || 'ID inconnu'
        );
        return true;

    } catch (err) {
        error('Échec réaction statut :', err?.message || err);
        if (statusId) processedStatuses.delete(statusId);
        return false;
    }
}

function handleMessagesUpsert(event) {
    if (!event) return;
    const messages = Array.isArray(event.messages) ? event.messages : [];
    for (const message of messages) {
        if (!message) continue;
        const remoteJid = message.key?.remoteJid || '';
        if (remoteJid !== 'status@broadcast') continue;
        reactToStatus(message).catch(err => error('Erreur traitement statut :', err?.message || err));
    }
}

function installListener() {
    if (!sock) throw new Error('Socket WhatsApp absente');
    if (listenerInstalled) { log('Listener déjà installé'); return; }
    if (!sock.ev || typeof sock.ev.on !== 'function') throw new Error('Événement Baileys indisponible');
    sock.ev.on('messages.upsert', handleMessagesUpsert);
    listenerInstalled = true;
    log('Listener des statuts activé');
}

function init(whatsappSocket, currentSessionId = 'default', options = {}) {
    if (!whatsappSocket) throw new Error('autoreact.init(): socket WhatsApp obligatoire');
    sock = whatsappSocket;
    sessionId = currentSessionId;
    config = { ...DEFAULT_CONFIG, ...options };
    config.emojis = Array.isArray(config.emojis) ? [...config.emojis] : [...DEFAULT_CONFIG.emojis];
    installListener();
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = setInterval(cleanupCache, 10 * 60 * 1000);
    if (cleanupTimer.unref) cleanupTimer.unref();
    log('Initialisé', '| session:', sessionId, '| activé:', config.enabled, '| délai:', config.delay + 'ms', '| emojis:', config.emojis.join(' '));
    log('Statuts contacts:', config.reactToOthers ? 'OUI' : 'NON');
    log('Propre statut:', config.reactToOwnStatus ? 'OUI' : 'NON');
    return api;
}

function enable() { config.enabled = true; log('AUTO-REACT ACTIVÉ'); return status(); }
function disable() { config.enabled = false; log('AUTO-REACT DÉSACTIVÉ'); return status(); }

function configure(options = {}) {
    if (typeof options !== 'object') return status();
    config = { ...config, ...options };
    if (options.emojis && Array.isArray(options.emojis)) config.emojis = [...options.emojis];
    return status();
}

function status() {
    return {
        enabled: config.enabled,
        delay: config.delay,
        emojis: [...config.emojis],
        reactToOthers: config.reactToOthers,
        reactToOwnStatus: config.reactToOwnStatus,
        preventDuplicates: config.preventDuplicates,
        cacheSize: processedStatuses.size,
        listenerInstalled,
        sessionId,
        connected: Boolean(sock)
    };
}

function clearCache() { processedStatuses.clear(); log('Cache des statuts vidé'); return true; }

function destroy() {
    if (sock?.ev && listenerInstalled) listenerInstalled = false;
    if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
    processedStatuses.clear();
    sock = null;
    sessionId = null;
    log('AUTO-REACT arrêté');
}

const api = {
    init, enable, disable, configure, status, clearCache, destroy, reactToStatus,
    get socket() { return sock; },
    get sessionId() { return sessionId; },
    get config() { return { ...config, emojis: [...config.emojis] }; }
};

module.exports = api;
