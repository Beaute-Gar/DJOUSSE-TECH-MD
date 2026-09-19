/**
 * utils/lid-resolver.js
 * Résout les LID → PN (numéros de téléphone)
 */

const lidCache = new Map();

function cacheLid(lid, pn) {
    if (!lid || !pn) return;
    const cleanLid = String(lid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const cleanPn = String(pn).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (cleanLid && cleanPn && cleanLid !== cleanPn) {
        lidCache.set(cleanLid, cleanPn);
    }
}

function resolveLid(lid) {
    if (!lid) return null;
    const clean = String(lid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    return lidCache.get(clean) || null;
}

function lidToPn(jid) {
    if (!jid || typeof jid !== 'string') return jid;
    if (!jid.includes('@lid')) return jid;
    const pn = resolveLid(jid);
    return pn ? pn + '@s.whatsapp.net' : jid;
}

function resolveParticipants(participants) {
    return participants.map(p => {
        const raw = String(p.jid || p.id || '').split(':')[0];
        if (raw.includes('@lid')) {
            const pn = resolveLid(raw);
            if (pn) return pn + '@s.whatsapp.net';
        }
        return raw;
    }).filter(Boolean);
}

module.exports = { cacheLid, resolveLid, lidToPn, resolveParticipants, lidCache };
