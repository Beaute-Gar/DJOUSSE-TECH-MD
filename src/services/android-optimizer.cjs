/**
 * Android Optimizer — DJOUSSE-TECH-MD v3.0
 * 
 * Optimisations spécifiques Termux / Android :
 * - Surveillance mémoire (garde-fou OOM)
 * - Batch de messages (groupement envois)
 * - Reconnexion intelligente (backoff adaptatif)
 * - Nettoyage automatique mémoire
 * - Gestion du mode économie d'énergie
 * - Monitoring CPU/Température
 * 
 * Compatible CJS.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════ */
const CONFIG = {
    MEMORY_WARN_MB: 1200,
    MEMORY_CRITICAL_MB: 1500,
    MEMORY_CHECK_INTERVAL: 30000,    // 30s
    CPU_TEMP_WARN: 45,               // °C
    CPU_TEMP_CRITICAL: 55,
    GC_INTERVAL: 300000,             // 5min - force garbage collector
    MAX_MESSAGES_PER_BATCH: 5,       // Messages groupés
    BATCH_DELAY_MS: 2000,            // Délai entre batchs
    RECONNECT_BASE_DELAY: 2000,
    RECONNECT_MAX_DELAY: 120000,     // 2min max
    LOG_FILE: path.join(__dirname, '../../data/android-optimizer.log'),
};

/* ═══════════════════════════════════════════════════════════════════
   MONITEUR MÉMOIRE
   ═══════════════════════════════════════════════════════════════════ */
class MemoryMonitor {
    constructor() {
        this.interval = null;
        this.alerts = [];
        this.lastGc = 0;
    }

    start() {
        this.interval = setInterval(() => this.check(), CONFIG.MEMORY_CHECK_INTERVAL);
        console.log('[ANDROID] Memory monitor démarré');
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    check() {
        const mem = process.memoryUsage();
        const usedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const totalMB = Math.round(mem.rss / 1024 / 1024);

        // Force GC si disponible et mémoire haute
        if (usedMB > CONFIG.MEMORY_WARN_MB && global.gc) {
            const now = Date.now();
            if (now - this.lastGc > 60000) { // Max 1 GC/minute
                global.gc();
                this.lastGc = now;
                console.log(`[ANDROID] 🧹 GC forcé (${usedMB}MB → ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
            }
        }

        // Alertes
        if (usedMB > CONFIG.MEMORY_CRITICAL_MB) {
            this.sendAlert('critical', `Mémoire CRITIQUE: ${usedMB}MB`);
        } else if (usedMB > CONFIG.MEMORY_WARN_MB) {
            this.sendAlert('warn', `Mémoire haute: ${usedMB}MB`);
        }

        return { usedMB, totalMB };
    }

    sendAlert(level, message) {
        const now = Date.now();
        const lastAlert = this.alerts.find(a => a.level === level);
        if (lastAlert && now - lastAlert.time < 60000) return; // Max 1 alert/min

        this.alerts.push({ level, message, time: now });
        if (this.alerts.length > 100) this.alerts.shift();

        console.log(`[ANDROID] 🚨 ${level.toUpperCase()}: ${message}`);
    }

    getStats() {
        const mem = process.memoryUsage();
        return {
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            rss: Math.round(mem.rss / 1024 / 1024),
            external: Math.round(mem.external / 1024 / 1024),
            alerts: this.alerts.slice(-10),
        };
    }
}

/* ═══════════════════════════════════════════════════════════════════
   BATCH DE MESSAGES — grouper les envois
   ═══════════════════════════════════════════════════════════════════ */
class MessageBatcher {
    constructor(sock) {
        this.sock = sock;
        this.queue = [];
        this.processing = false;
        this.interval = null;
    }

    add(jid, content, options = {}) {
        this.queue.push({ jid, content, options, time: Date.now() });
        if (!this.processing) this.processNext();
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }

        this.processing = true;
        const batch = this.queue.splice(0, CONFIG.MAX_MESSAGES_PER_BATCH);

        for (const item of batch) {
            try {
                await this.sock.sendMessage(item.jid, item.content, item.options);
            } catch (e) {
                console.error('[ANDROID] Batch send error:', e.message);
            }
        }

        // Délai entre batchs
        if (this.queue.length > 0) {
            setTimeout(() => this.processNext(), CONFIG.BATCH_DELAY_MS);
        } else {
            this.processing = false;
        }
    }

    getPending() {
        return this.queue.length;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   RECONNEXION INTELLIGENTE — backoff adaptatif
   ═══════════════════════════════════════════════════════════════════ */
class SmartReconnector {
    constructor() {
        this.attempts = 0;
        this.lastReconnect = 0;
        this.backoff = CONFIG.RECONNECT_BASE_DELAY;
    }

    getNextDelay() {
        const now = Date.now();
        const timeSinceLast = now - this.lastReconnect;

        // Reset si > 5 minutes depuis dernière tentative
        if (timeSinceLast > 300000) {
            this.attempts = 0;
            this.backoff = CONFIG.RECONNECT_BASE_DELAY;
        }

        this.attempts++;
        this.lastReconnect = now;

        // Backoff exponentiel avec jitter
        const base = Math.min(this.backoff * Math.pow(1.5, this.attempts - 1), CONFIG.RECONNECT_MAX_DELAY);
        const jitter = Math.random() * 1000;
        const delay = Math.round(base + jitter);

        console.log(`[ANDROID] Reconnexion #${this.attempts} dans ${Math.round(delay / 1000)}s`);
        return delay;
    }

    reset() {
        this.attempts = 0;
        this.backoff = CONFIG.RECONNECT_BASE_DELAY;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   MONITEUR CPU / TEMPÉRATURE
   ═══════════════════════════════════════════════════════════════════ */
function getCpuTemp() {
    try {
        // Linux/Termux: lire la température CPU
        const temp = execSync('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0', { timeout: 1000 });
        return parseInt(temp.toString().trim()) / 1000;
    } catch {
        return 0;
    }
}

function getCpuUsage() {
    try {
        const stat = fs.readFileSync('/proc/stat', 'utf8');
        const cpuLine = stat.split('\n')[0];
        const parts = cpuLine.split(/\s+/).slice(1).map(Number);
        const idle = parts[3];
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
    } catch {
        return null;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   NETTOYAGE AUTOMATIQUE
   ═══════════════════════════════════════════════════════════════════ */
function cleanupTempFiles() {
    const tmpDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tmpDir)) return;

    try {
        const files = fs.readdirSync(tmpDir);
        let cleaned = 0;
        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            const stat = fs.statSync(filePath);
            // Supprimer les fichiers > 1h
            if (Date.now() - stat.mtimeMs > 3600000) {
                fs.unlinkSync(filePath);
                cleaned++;
            }
        }
        if (cleaned > 0) console.log(`[ANDROID] 🧹 ${cleaned} fichiers temporaires nettoyés`);
    } catch (e) {
        console.error('[ANDROID] Cleanup error:', e.message);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   LOGGING PERSISTANT
   ═══════════════════════════════════════════════════════════════════ */
function logEvent(event, data = {}) {
    try {
        const dir = path.dirname(CONFIG.LOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const entry = {
            time: new Date().toISOString(),
            event,
            ...data,
        };

        fs.appendFileSync(CONFIG.LOG_FILE, JSON.stringify(entry) + '\n');

        // Rotation: garder max 1000 lignes
        const content = fs.readFileSync(CONFIG.LOG_FILE, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        if (lines.length > 1000) {
            fs.writeFileSync(CONFIG.LOG_FILE, lines.slice(-500).join('\n') + '\n');
        }
    } catch {}
}

/* ═══════════════════════════════════════════════════════════════════
   API PUBLIQUE
   ═══════════════════════════════════════════════════════════════════ */
let memoryMonitor = null;
let batcher = null;
let reconnector = null;

function initAndroidOptimizer(sock) {
    // Memory monitor
    memoryMonitor = new MemoryMonitor();
    memoryMonitor.start();

    // Message batcher
    batcher = new MessageBatcher(sock);

    // Smart reconnect
    reconnector = new SmartReconnector();

    // Cleanup temp files
    cleanupTempFiles();
    setInterval(cleanupTempFiles, 3600000); // Toutes les heures

    // Force GC périodique
    if (global.gc) {
        setInterval(() => {
            global.gc();
            console.log('[ANDROID] ♻️ GC périodique');
        }, CONFIG.GC_INTERVAL);
    }

    // Nettoyage mémoire des caches globaux
    setInterval(() => {
        try {
            if (global.__recentBotMessages) {
                for (const [k, v] of global.__recentBotMessages) {
                    if (v.length > 50) v.splice(0, v.length - 50);
                }
            }
            if (global.__msgDedup && global.__msgDedup.size > 1000) {
                const now = Date.now();
                for (const [k, t] of global.__msgDedup) {
                    if (now - t > 60000) global.__msgDedup.delete(k);
                }
            }
        } catch {}
    }, 60000);

    console.log('[ANDROID] ✅ Android Optimizer initialisé');
}

function getAndroidStats() {
    return {
        memory: memoryMonitor?.getStats() || null,
        batchPending: batcher?.getPending() || 0,
        reconnectAttempts: reconnector?.attempts || 0,
        cpuTemp: getCpuTemp(),
    };
}

function getReconnector() {
    if (!reconnector) reconnector = new SmartReconnector();
    return reconnector;
}

module.exports = {
    initAndroidOptimizer,
    getAndroidStats,
    getReconnector,
    MemoryMonitor,
    MessageBatcher,
    SmartReconnector,
    getCpuTemp,
    getCpuUsage,
    cleanupTempFiles,
    logEvent,
    CONFIG,
};
