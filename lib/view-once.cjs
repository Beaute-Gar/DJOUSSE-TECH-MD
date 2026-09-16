'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — AUTO VIEW-ONCE SAVER
 * ============================================================
 *
 * Automatically intercepts and resends view-once messages.
 * No reply needed — it works passively.
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const VIEW_ONCE_DIR = path.join(__dirname, '..', 'data', 'view-once');
let enabled = true;
let sock = null;

function ensureDir() {
    if (!fs.existsSync(VIEW_ONCE_DIR)) {
        fs.mkdirSync(VIEW_ONCE_DIR, { recursive: true });
    }
}

function saveToDisk(buffer, filename) {
    ensureDir();
    const filePath = path.join(VIEW_ONCE_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

function isViewOnceMessage(msg) {
    if (!msg || !msg.message) return false;
    const m = msg.message;
    return !!(m.viewOnceMessage || m.viewOnceMessageV2);
}

function getViewOnceContent(msg) {
    const m = msg.message;
    const vo = m.viewOnceMessage || m.viewOnceMessageV2;
    if (!vo || !vo.message) return null;
    const inner = vo.message;
    const type = Object.keys(inner).find(k =>
        k === 'imageMessage' || k === 'videoMessage' || k === 'audioMessage'
    );
    if (!type) return null;
    return { type, content: inner[type], inner };
}

async function interceptViewOnce(baileysSock, msg) {
    if (!enabled || !baileysSock) return;
    if (!isViewOnceMessage(msg)) return;

    const data = getViewOnceContent(msg);
    if (!data) return;

    try {
        const buffer = await baileysSock.downloadMediaMessage({
            key: msg.key,
            message: data.inner
        });
        if (!buffer) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const timestamp = Date.now();
        const ext = data.content.mimetype?.split('/')[1] || 'bin';
        const filename = `vo_${timestamp}.${ext}`;
        saveToDisk(buffer, filename);

        const jid = msg.key.remoteJid;
        const caption = `🔓 *View-Once intercepté*\nDe: ${sender.split('@')[0]}\nType: ${data.type.replace('Message', '')}`;

        if (data.type === 'imageMessage') {
            await baileysSock.sendMessage(jid, { image: buffer, caption });
        } else if (data.type === 'videoMessage') {
            await baileysSock.sendMessage(jid, { video: buffer, caption });
        } else if (data.type === 'audioMessage') {
            await baileysSock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg' });
            await baileysSock.sendMessage(jid, { text: caption });
        }

        console.log(`[VIEW-ONCE] 🔓 Intercepté: ${data.type} de ${sender.split('@')[0]}`);
    } catch (err) {
        console.error('[VIEW-ONCE] ❌ Erreur:', err.message);
    }
}

function init(baileysSock) {
    sock = baileysSock;
    ensureDir();
    console.log('[VIEW-ONCE] 🟢 Auto-saver activé');
}

function enable() { enabled = true; console.log('[VIEW-ONCE] ✅ Activé'); }
function disable() { enabled = false; console.log('[VIEW-ONCE] ❌ Désactivé'); }
function status() { return { enabled, directory: VIEW_ONCE_DIR }; }

module.exports = { init, interceptViewOnce, enable, disable, status, isViewOnceMessage };
