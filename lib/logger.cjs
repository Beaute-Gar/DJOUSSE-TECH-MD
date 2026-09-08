/**
 * DJOUSSE TECH — Central Logger v1.0
 *
 * Three modes: NORMAL, DEBUG, QUIET
 * Controlled via LOG_LEVEL env var or .loglevel command
 *
 * Terminal: clean, professional output
 * File: full detailed logs (logs/djousse-tech.log)
 * Dashboard: all data still available via /api/status
 */

const fs = require('fs');
const path = require('path');

const MODES = { NORMAL: 0, DEBUG: 1, QUIET: 2 };

let currentMode = MODES[(process.env.LOG_LEVEL || 'normal').toUpperCase()] || MODES.NORMAL;

// ─── Log file setup ───
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'djousse-tech.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// ─── Deduplication ───
const _seen = new Map();
const DEDUP_WINDOW_MS = 30_000;

function _dedup(key) {
    const now = Date.now();
    const entry = _seen.get(key);
    if (entry && (now - entry.ts) < DEDUP_WINDOW_MS) {
        entry.count++;
        return true;
    }
    _seen.set(key, { ts: now, count: 1 });
    return false;
}

// Periodic cleanup of dedup map
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _seen) {
        if (now - v.ts > DEDUP_WINDOW_MS * 2) _seen.delete(k);
    }
}, 60_000);

// ─── File logger (always writes everything) ───
function _writeFile(level, msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${msg}\n`;
    logStream.write(line);
}

// ─── Terminal output ───
const _colors = { reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', magenta: '\x1b[35m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m' };
function _term(color, ...args) {
    try { process.stdout.write(_colors[color] + args.join(' ') + _colors.reset + '\n'); } catch (_) {}
}

// ─── Public API ───
const logger = {
    setMode(mode) {
        const m = String(mode).toUpperCase();
        if (MODES[m] !== undefined) currentMode = MODES[m];
    },
    getMode() {
        return Object.keys(MODES).find(k => MODES[k] === currentMode) || 'NORMAL';
    },

    info(msg, ...a) {
        _writeFile('INFO', msg + (a.length ? ' ' + a.join(' ') : ''));
        if (currentMode === MODES.NORMAL || currentMode === MODES.DEBUG) {
            _term('dim', msg, ...a);
        }
    },

    success(msg, ...a) {
        _writeFile('OK', msg + (a.length ? ' ' + a.join(' ') : ''));
        if (currentMode !== MODES.QUIET) {
            _term('green', msg, ...a);
        }
    },

    warn(msg, ...a) {
        _writeFile('WARN', msg + (a.length ? ' ' + a.join(' ') : ''));
        const key = msg;
        if (_dedup(key)) {
            if (currentMode === MODES.DEBUG) _term('yellow', `⚠️  ${msg} (×${_seen.get(key).count})`);
            return;
        }
        if (currentMode !== MODES.QUIET) {
            _term('yellow', '⚠️ ', msg, ...a);
        }
    },

    error(msg, ...a) {
        _writeFile('ERROR', msg + (a.length ? ' ' + a.join(' ') : ''));
        const key = msg;
        if (_dedup(key)) {
            if (currentMode === MODES.DEBUG) _term('red', `❌ ${msg} (×${_seen.get(key).count})`);
            return;
        }
        if (currentMode !== MODES.QUIET) {
            _term('red', '❌', msg, ...a);
        }
    },

    debug(msg, ...a) {
        _writeFile('DEBUG', msg + (a.length ? ' ' + a.join(' ') : ''));
        if (currentMode === MODES.DEBUG) {
            _term('cyan', '[DEBUG]', msg, ...a);
        }
    },

    // Plugin loading — batch summary only in NORMAL
    _pluginErrors: [],
    _pluginSuccess: 0,

    pluginLoad(filename) {
        _writeFile('PLUGIN', `Chargé: ${filename}`);
        if (currentMode === MODES.DEBUG) _term('dim', `📦 ${filename}`);
        this._pluginSuccess++;
    },

    pluginError(filename, error) {
        _writeFile('PLUGIN', `Erreur: ${filename} — ${error}`);
        this._pluginErrors.push({ filename, error });
    },

    pluginSummary() {
        const total = this._pluginSuccess + this._pluginErrors.length;
        if (currentMode === MODES.DEBUG) {
            _term('dim', `📦 Plugins: ${total} chargés`);
        } else {
            _term('green', `📦 Plugins : ${total} chargés`);
        }
        if (this._pluginErrors.length > 0) {
            // Group by error message
            const grouped = {};
            for (const e of this._pluginErrors) {
                (grouped[e.error] ||= []).push(e.filename);
            }
            for (const [err, files] of Object.entries(grouped)) {
                if (files.length === 1) {
                    _term('red', `❌ ${files[0]} — ${err}`);
                } else {
                    _term('red', `❌ ${files.length} plugins — ${err}`);
                }
            }
        }
        _term('green', `🟢 Fonctionnels : ${this._pluginSuccess}`);
        if (this._pluginErrors.length > 0) {
            _term('yellow', `⚠️ Problèmes : ${this._pluginErrors.length}`);
        }
    },

    // Memory — only show significant changes
    _lastMemLevel: 'normal',

    memory(rssMB, heapMB, heapTotalMB) {
        _writeFile('MEMORY', `RSS=${rssMB.toFixed(0)}MB Heap=${heapMB.toFixed(0)}/${heapTotalMB.toFixed(0)}MB`);

        let level = 'normal';
        if (rssMB > 1024) level = 'critical';
        else if (rssMB > 700) level = 'high';
        else if (rssMB > 500) level = 'elevated';
        else if (rssMB > 350) level = 'warning';

        // Only print on level change
        if (level !== this._lastMemLevel) {
            this._lastMemLevel = level;
            if (currentMode === MODES.QUIET) return;
            if (currentMode === MODES.DEBUG) {
                _term('dim', `[DEBUG] Mémoire RSS=${rssMB.toFixed(0)}MB Heap=${heapMB.toFixed(0)}MB`);
                return;
            }
            switch (level) {
                case 'normal':
                    _term('green', `🟢 Mémoire normale — RSS ${rssMB.toFixed(0)} MB`);
                    break;
                case 'warning':
                    _term('yellow', `🟡 Pression mémoire — RSS ${rssMB.toFixed(0)} MB`);
                    break;
                case 'elevated':
                    _term('yellow', `🟠 Mémoire élevée — RSS ${rssMB.toFixed(0)} MB`);
                    break;
                case 'high':
                    _term('red', `🔴 ALERTE MÉMOIRE — RSS ${rssMB.toFixed(0)} MB`);
                    break;
                case 'critical':
                    _term('red', `🚨 MÉMOIRE CRITIQUE — RSS ${rssMB.toFixed(0)} MB`);
                    break;
            }
        }
    },

    // Baileys events
    baileys(event, detail) {
        _writeFile('BAILEYS', `${event}: ${detail || ''}`);
        if (currentMode === MODES.DEBUG) {
            _term('dim', `[BAILEYS] ${event}`, detail || '');
        }
    },

    // Command execution
    command(cmd, sender) {
        _writeFile('CMD', `.${cmd} ← ${sender}`);
        if (currentMode !== MODES.QUIET) {
            _term('cyan', `👤 → .${cmd}`);
        }
    },

    // Connection events
    connect(msg) {
        _writeFile('CONN', msg);
        if (currentMode !== MODES.QUIET) {
            _term('green', msg);
        }
    },

    disconnect(msg) {
        _writeFile('CONN', msg);
        if (currentMode !== MODES.QUIET) {
            _term('yellow', msg);
        }
    },

    // Critical events (always shown)
    critical(msg) {
        _writeFile('CRITICAL', msg);
        _term('red', '🚨', msg);
    },
};

module.exports = logger;
