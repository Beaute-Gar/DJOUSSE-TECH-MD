'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — SILENT AUTOMATIONS (Catégorie 1)
 * ============================================================
 *
 * Zéro message envoyé — tout est en mémoire/logs.
 *
 * 1. Auto-read: blue ticks avec délai 2-8s
 * 2. Backup DB: JSON chiffré toutes les 5h, rotation 7 jours
 * 3. Health check: RAM/latence toutes les 60s
 * 4. Purge auto: fichiers >24h, caches, vieux logs
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_DIR = path.join(__dirname, '..', 'database');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const TMP_DIR = path.join(__dirname, '..', 'tmp');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

let sock = null;
let healthInterval = null;
let backupInterval = null;
let purgeInterval = null;

// --- AUTO-READ ---
const readTimestamps = new Map(); // jid -> lastRead timestamp
const READ_COOLDOWN = 10 * 60 * 1000; // 10 min per JID

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function autoRead(msg) {
    if (!sock || !msg?.key) return;
    const jid = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;
    if (msg.key.fromMe) return;

    const now = Date.now();
    const lastRead = readTimestamps.get(jid) || 0;
    if (now - lastRead < READ_COOLDOWN) return;

    // Random delay 2-8s before marking as read
    const delay = randomBetween(2000, 8000);
    await new Promise(r => setTimeout(r, delay));

    try {
        await sock.readMessages([msg.key]);
        readTimestamps.set(jid, now);
    } catch (_) {}

    // Cleanup old entries
    if (readTimestamps.size > 500) {
        for (const [k, v] of readTimestamps) {
            if (now - v > 3600000) readTimestamps.delete(k);
        }
    }
}

// --- BACKUP DB ---
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function encrypt(text, key) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16));
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

function createBackup() {
    ensureDir(BACKUP_DIR);
    const now = Date.now();
    const dateStr = new Date(now).toISOString().split('T')[0];
    const files = ['groups.json', 'users.json', 'warnings.json', 'mods.json', 'sudo.json'];

    for (const file of files) {
        const src = path.join(DB_DIR, file);
        if (!fs.existsSync(src)) continue;

        try {
            const data = fs.readFileSync(src, 'utf8');
            // Simple obfuscation (not real encryption, but prevents casual reading)
            const key = crypto.scryptSync('djousse-tech-backup', 'salt', 32);
            const encrypted = encrypt(data, key);

            const backupName = `${file.replace('.json', '')}_${dateStr}.enc`;
            const dst = path.join(BACKUP_DIR, backupName);
            fs.writeFileSync(dst, encrypted);
        } catch (e) {}
    }

    // Cleanup backups older than 7 days
    cleanupOldBackups();
}

function cleanupOldBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return;
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        for (const file of files) {
            const fp = path.join(BACKUP_DIR, file);
            const stat = fs.statSync(fp);
            if (now - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
                fs.unlinkSync(fp);
            }
        }
    } catch (e) {}
}

// --- HEALTH CHECK ---
let lastHealthLog = 0;

function healthCheck() {
    const now = Date.now();
    const mem = process.memoryUsage();
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);

    const connected = sock?.ws?.readyState === 1;

    // Log health every 5 min
    if (now - lastHealthLog > 300000) {
        console.log(`[HEALTH] 💚 RSS: ${rssMB}MB | Heap: ${heapMB}MB | Socket: ${connected ? 'OK' : 'DISCONNECTED'}`);
        lastHealthLog = now;
    }

    // Alert if memory > 500MB
    if (rssMB > 500) {
        console.log(`[HEALTH] ⚠️ Mémoire élevée: ${rssMB}MB`);
    }

    return { rssMB, heapMB, connected };
}

// --- PURGE AUTO ---
function purgeOldFiles() {
    const now = Date.now();
    let purged = 0;

    // Purge tmp/ files > 24h
    try {
        if (fs.existsSync(TMP_DIR)) {
            const files = fs.readdirSync(TMP_DIR);
            for (const file of files) {
                const fp = path.join(TMP_DIR, file);
                const stat = fs.statSync(fp);
                if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
                    fs.unlinkSync(fp);
                    purged++;
                }
            }
        }
    } catch (e) {}

    // Purge logs/ > 7 days
    try {
        if (fs.existsSync(LOGS_DIR)) {
            const files = fs.readdirSync(LOGS_DIR);
            for (const file of files) {
                if (!file.endsWith('.log')) continue;
                const fp = path.join(LOGS_DIR, file);
                const stat = fs.statSync(fp);
                if (now - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
                    fs.unlinkSync(fp);
                    purged++;
                }
            }
        }
    } catch (e) {}

    if (purged > 0) {
        console.log(`[PURGE] 🧹 ${purged} fichiers nettoyés`);
    }
}

// --- INIT ---
function init(baileysSock) {
    sock = baileysSock;

    // Idempotent : clear les anciens timers (reconnexion = nouveau socket, pas de doublon)
    if (healthInterval) clearInterval(healthInterval);
    if (backupInterval) clearInterval(backupInterval);
    if (purgeInterval) clearInterval(purgeInterval);

    // Health check every 60s
    healthInterval = setInterval(healthCheck, 60000);

    // Backup every 5h
    backupInterval = setInterval(createBackup, 5 * 60 * 60 * 1000);
    // Initial backup on start
    setTimeout(createBackup, 30000);

    // Purge once a day at 3am (check every hour, run if 3am)
    purgeInterval = setInterval(() => {
        const now = new Date();
        if (now.getHours() === 3 && now.getMinutes() < 5) {
            purgeOldFiles();
        }
    }, 3600000);

    console.log('[SILENT] 🟢 Automatismes silencieux actifs');
    console.log('[SILENT] 📖 Auto-read: délai 2-8s, cooldown 10min/jid');
    console.log('[SILENT] 💾 Backup: toutes les 5h, rotation 7 jours');
    console.log('[SILENT] 💚 Health: toutes les 60s');
    console.log('[SILENT] 🧹 Purge: 1×/jour à 3h');
}

function destroy() {
    if (healthInterval) clearInterval(healthInterval);
    if (backupInterval) clearInterval(backupInterval);
    if (purgeInterval) clearInterval(purgeInterval);
    sock = null;
}

module.exports = { init, destroy, autoRead, healthCheck, createBackup, purgeOldFiles };
