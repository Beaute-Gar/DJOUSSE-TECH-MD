/**
 * utils/safe-group-update.js
 * Helper UNIVERSEL pour les opérations de groupe WhatsApp.
 * Résout automatiquement :
 *  - Les LID → PN (évite "No sessions")
 *  - Les erreurs de session (retry automatique)
 *  - Les erreurs de permissions (messages clairs)
 */

const { resolveLid } = require('./lid-resolver');

function resolveTarget(target, meta) {
    if (!target || typeof target !== 'string') return target;
    if (!target.includes('@lid')) return target;

    const clean = String(target).split(':')[0].split('@')[0];

    const cachedPn = resolveLid(target);
    if (cachedPn) {
        return cachedPn + '@s.whatsapp.net';
    }

    if (meta?.participants) {
        const participant = meta.participants.find(p => {
            const lid = String(p.lid || '').split(':')[0].split('@')[0];
            const id = String(p.id || '').split(':')[0].split('@')[0];
            return lid === clean || id === clean;
        });

        if (participant) {
            const pnId = String(participant.id || '').split(':')[0];
            if (pnId && !pnId.includes('@lid')) {
                return pnId;
            }
            if (participant.lid) {
                return String(participant.lid).split(':')[0];
            }
        }
    }

    return target;
}

async function waitForConnection(conn, maxWaitMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if ((conn?.ws?.isOpen === true || conn?.ws?.socket?.readyState === 1) && conn?.user?.id) {
            return true;
        }
        await new Promise(r => setTimeout(r, 300));
    }
    return false;
}

async function getMetadataWithRetry(conn, chat, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await conn.groupMetadata(chat);
        } catch (e) {
            if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
    return null;
}

async function safeGroupUpdate(conn, chat, targets, action, opts = {}) {
    const { maxRetries = 2, skipWait = false, silent = false } = opts;

    if (!conn) {
        return { ok: false, error: '❌ Socket non disponible.' };
    }

    if (!skipWait) {
        const ready = await waitForConnection(conn, 3000);
        if (!ready) {
            return { ok: false, error: '🔴 Bot déconnecté de WhatsApp. Attends la reconnexion...' };
        }
    }

    if (!chat || !chat.endsWith('@g.us')) {
        return { ok: false, error: '❌ JID de groupe invalide.' };
    }

    let targetList = Array.isArray(targets) ? targets : [targets];
    targetList = targetList.filter(Boolean);
    if (targetList.length === 0) {
        return { ok: false, error: '❌ Aucune cible fournie.' };
    }

    const meta = await getMetadataWithRetry(conn, chat, 3);
    const resolvedTargets = targetList.map(t => resolveTarget(t, meta));

    if (!silent) {
        for (let i = 0; i < targetList.length; i++) {
            if (targetList[i] !== resolvedTargets[i]) {
                console.log(`[SAFE-UPDATE] LID résolu: ${targetList[i]} → ${resolvedTargets[i]}`);
            }
        }
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await conn.groupParticipantsUpdate(chat, resolvedTargets, action);
            return { ok: true, results: result };
        } catch (e) {
            lastError = e;
            const msg = String(e.message || e);

            if (!silent) {
                console.log(`[SAFE-UPDATE] tentative ${attempt}/${maxRetries} échouée: ${msg}`);
            }

            if (msg.includes('forbidden') || msg.includes('403') || msg.includes('not-authorized') || msg.includes('not-admin') || msg.includes('bad-request')) {
                return { ok: false, error: parseError(msg, action) };
            }

            if (msg.includes('No sessions') || msg.includes('Connection') || msg.includes('timeout') || msg.includes('rate-overlimit') || msg.includes('500') || msg.includes('503')) {
                if (attempt < maxRetries) {
                    const freshMeta = await getMetadataWithRetry(conn, chat, 2);
                    if (freshMeta) {
                        const reResolved = targetList.map(t => resolveTarget(t, freshMeta));
                        resolvedTargets.length = 0;
                        resolvedTargets.push(...reResolved);
                    }
                    await new Promise(r => setTimeout(r, 1500 * attempt));
                    continue;
                }
            }

            if (attempt === maxRetries) break;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    return { ok: false, error: parseError(String(lastError?.message || lastError), action) };
}

function parseError(msg, action) {
    const lower = msg.toLowerCase();

    if (lower.includes('no sessions')) {
        return (
            '🔴 *Session Signal manquante*\n\n' +
            'Le bot ne peut pas effectuer cette action car :\n' +
            "• L'utilisateur n'a jamais interagi avec le bot, OU\n" +
            '• Le bot vient de redémarrer, OU\n' +
            "• L'utilisateur est identifié uniquement par un LID\n\n" +
            '_Solution : Fais parler l\'utilisateur dans le groupe, puis réessaie._'
        );
    }

    if (lower.includes('forbidden') || lower.includes('403')) {
        return '❌ Action interdite. Vérifie que le bot est admin du groupe.';
    }

    if (lower.includes('not-authorized') || lower.includes('not-admin')) {
        return "❌ Le bot n'a pas les droits nécessaires pour cette action.";
    }

    if (lower.includes('rate-overlimit') || lower.includes('too many')) {
        return '⏳ Trop de requêtes WhatsApp. Attends quelques minutes avant de réessayer.';
    }

    if (lower.includes('timeout')) {
        return '⏱️ Délai dépassé. Vérifie ta connexion et réessaie.';
    }

    if (lower.includes('bad-request') || lower.includes('400')) {
        return '❌ Requête invalide. Le numéro/JID est peut-être incorrect.';
    }

    if (lower.includes('not-found') || lower.includes('404')) {
        return '❌ Utilisateur introuvable dans ce groupe.';
    }

    return `❌ Erreur: ${msg}`;
}

module.exports = { safeGroupUpdate, resolveTarget, waitForConnection, getMetadataWithRetry };
