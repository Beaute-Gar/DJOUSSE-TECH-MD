// ═══════════════════════════════════════════════════════════════
//  DJOUSSE TECH — TUI professionnelle (CommonJS, modules natifs)
//  Header temps réel (statut/téléphone/uptime/RAM/CPU/activité/
//  compteurs) + logs défilants, rotation des fichiers de logs.
//  Compatible : Windows PowerShell / Windows Terminal / Linux / VPS.
//  - TTY    : redraw sans clignotement, rafraîchissement 1 s
//  - non-TTY: logs en flux simple (service, redirection, tests)
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

// ─── Détection support Unicode ──────────────────────────────────────
const supportsUnicode = () => {
  if (process.platform !== 'win32') return true;
  try {
    return !!(process.env.WT_SESSION || process.env.Terminal === 'vscode' ||
      process.env.ConEmuANSI === 'ON' ||
      (process.env.LANG || '').toUpperCase().includes('UTF') ||
      (process.env.LC_ALL || '').toUpperCase().includes('UTF'));
  } catch (_) { return false; }
};

const UNICODE = supportsUnicode();
const TTY = !!process.stdout.isTTY;

// ─── Utilitaires ────────────────────────────────────────────────────
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}j ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatTime(d = new Date()) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Largeur d'affichage réelle (emoji = 2 colonnes, sélecteurs = 0)
function dw(str) {
  let w = 0;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp === 0x200D || cp === 0xFE0F || cp === 0xFE0E) continue;          // ZWJ / VS
    if (cp >= 0x0300 && cp <= 0x036F) continue;                              // combinés
    if (cp >= 0x1F000 || (cp >= 0x2600 && cp <= 0x27BF) ||
        (cp >= 0x2B00 && cp <= 0x2BFF) || (cp >= 0x2300 && cp <= 0x23FF)) {
      w += 2;                                                                // emoji
    } else {
      w += 1;
    }
  }
  return w;
}

function padW(str, width) {
  const pad = Math.max(0, width - dw(str));
  return str + ' '.repeat(pad);
}

// Erreurs silencieuses (filtre identique à index.js — libsignal / anti-bruit)
const IGNORED = [
  'Bad MAC', 'Failed to decrypt', 'Session error', 'libsignal',
  'session_cipher', 'decryptWithSessions', 'doDecryptWhisperMessage',
  'MessageCounterError', 'Closing open session', 'Closing session',
  'Key used already', 'Invalid PreKey', 'Duplicate Message',
];

// ─── Classe TUI ─────────────────────────────────────────────────────
class TUI {
  constructor(opts = {}) {
    this.botName = opts.botName || 'DJOUSSE-TECH-MD';
    this.version = opts.version || '0.0.0';
    this.startTime = Date.now();
    this.status = 'INITIALIZING';
    this.phone = '-';
    this.messagesReceived = 0;
    this.messagesSent = 0;
    this.commandsExecuted = 0;
    this.errors = 0;
    this.lastActivity = Date.now();
    this.logs = [];
    this.maxLogs = 200;
    this.refreshInterval = null;
    this._started = false;
    this._drawing = false;
    this._firstDraw = true;
    this.W = 60; // largeur utile du cadre

    // Rotation : 10 Mo par fichier, 5 fichiers max par base
    this.logDir = path.join(__dirname, '..', 'logs');
    this.maxLogSize = 10 * 1024 * 1024;
    this.maxRotated = 4;

    this._originalLog = console.log.bind(console);
    this._originalError = console.error.bind(console);
    this._originalWarn = console.warn.bind(console);
    this._patchConsole();

    process.on('SIGINT', () => this.shutdown(0));
    process.on('SIGTERM', () => this.shutdown(0));
  }

  _patchConsole() {
    console.log = (...args) => this._addLog('INFO', args.map(String).join(' '));
    console.error = (...args) => this._addLog('ERROR', args.map(String).join(' '));
    console.warn = (...args) => this._addLog('WARN', args.map(String).join(' '));
  }

  _restoreConsole() {
    console.log = this._originalLog;
    console.error = this._originalError;
    console.warn = this._originalWarn;
  }

  // ─── Logs ─────────────────────────────────────────────────────────
  _addLog(level, message) {
    const msg = String(message ?? '');
    if (IGNORED.some(kw => msg.includes(kw))) return;

    const timestamp = formatTime();
    this.logs.push({ timestamp, level, message: msg });
    if (this.logs.length > this.maxLogs) this.logs.shift();
    this.lastActivity = Date.now();
    if (level === 'ERROR') this.errors++;

    this._writeToFile(timestamp, level, msg);

    if (!TTY) {
      // Mode service / redirection : sortie directe (QR visible en clair)
      const prefix = level === 'INFO' ? '' : `[${level}] `;
      this._originalLog(`[${timestamp}] ${prefix}${msg}`);
    } else if (this._started) {
      this._draw();
    }
  }

  _writeToFile(timestamp, level, message) {
    try {
      if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
      // INFO → bot-out.log ; WARN/ERROR → bot-error.log
      const base = level === 'INFO' ? 'bot-out.log' : 'bot-error.log';
      const file = path.join(this.logDir, base);
      fs.appendFileSync(file, `[${formatDate()} ${timestamp}] ${message}\n`, 'utf8');
      this._rotateLog(file, base);
    } catch (_) {}
  }

  _rotateLog(file, base) {
    try {
      const st = fs.statSync(file);
      if (st.size < this.maxLogSize) return;
      fs.renameSync(file, file.replace(/\.log$/, `.${Date.now()}.log`));
      // Conserver 5 fichiers max par base (courant + 4 archivés)
      const stem = base.replace(/\.log$/, '');
      const archived = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith(`${stem}.`) && f.endsWith('.log'))
        .map(f => ({ f, m: fs.statSync(path.join(this.logDir, f)).mtimeMs }))
        .sort((a, b) => a.m - b.m);
      while (archived.length > this.maxRotated) {
        fs.unlinkSync(path.join(this.logDir, archived.shift().f));
      }
    } catch (_) {}
  }

  // ─── Setters publics ──────────────────────────────────────────────
  setStatus(status) { this.status = status; this._draw(); }
  setPhone(phone) { this.phone = phone || '—'; this._draw(); }
  incrementMessagesReceived() { this.messagesReceived++; }
  incrementMessagesSent() { this.messagesSent++; }
  incrementCommands() { this.commandsExecuted++; }
  noteActivity() { this.lastActivity = Date.now(); }

  // ─── Affichage ────────────────────────────────────────────────────
  _statusIcon() {
    return ({
      'CONNECTED': '🟢',
      'INITIALIZING': '🟡',
      'CONNECTING': '🟡',
      'WAITING_FOR_QR': '🔵',
      'WAITING_FOR_PAIRING': '🟣',
      'RECONNECTING': '🟠',
      'CONFLICT': '🟠',
      'DISCONNECTED': '🔴',
      'LOGGED_OUT': '⚫',
    })[this.status] || '⚪';
  }

  _stats() {
    const uptimeS = (Date.now() - this.startTime) / 1000;
    const mem = process.memoryUsage().rss;
    const cpu = process.cpuUsage();
    const cpuPercent = uptimeS > 1
      ? (((cpu.user + cpu.system) / 1e6) / uptimeS * 100).toFixed(1)
      : '0.0';
    return {
      uptime: formatUptime(uptimeS),
      ram: formatBytes(mem),
      cpu: `${cpuPercent} %`,
      activity: formatTime(new Date(this.lastActivity)),
    };
  }

  _headerLines() {
    const s = this._stats();
    const W = this.W;
    const line = (content) => `║${padW(content, W)}║`;
    const sep = `╠${'═'.repeat(W)}╣`;
    const top = `╔${'═'.repeat(W)}╗`;
    const bottom = `╚${'═'.repeat(W)}╝`;

    if (!UNICODE) {
      const bar = '='.repeat(W);
      return [
        bar,
        `  ${this.botName} v${this.version}`.padEnd(W),
        bar,
        `  Statut     : ${this.status}`.padEnd(W),
        `  Telephone  : ${this.phone}`.padEnd(W),
        `  Uptime     : ${s.uptime}`.padEnd(W),
        `  RAM        : ${s.ram}`.padEnd(W),
        `  CPU        : ${s.cpu}`.padEnd(W),
        `  Activite   : ${s.activity}`.padEnd(W),
        bar,
        `  Messages recus    : ${this.messagesReceived}`.padEnd(W),
        `  Messages envoyes  : ${this.messagesSent}`.padEnd(W),
        `  Commandes         : ${this.commandsExecuted}`.padEnd(W),
        `  Erreurs           : ${this.errors}`.padEnd(W),
        bar,
        '',
        '--- Logs en direct (Ctrl+C pour quitter) ---',
      ];
    }

    const right = (label, value) => line(`  ${label.padEnd(dw(label))}${value}`);
    return [
      top,
      line(padW(`  🤖 ${this.botName}`, W - dw(`v${this.version}`)) + `v${this.version}`),
      sep,
      line(`  ${this._statusIcon()} Statut     : ${this.status}`),
      right('📱 Téléphone  : ', this.phone),
      right('⏱️  Uptime     : ', s.uptime),
      right('💾 RAM        : ', s.ram),
      right('⚙️  CPU        : ', s.cpu),
      right('🕒 Activité   : ', s.activity),
      sep,
      line(`  📥 Messages reçus : ${this.messagesReceived}`),
      line(`  📤 Messages envoyés : ${this.messagesSent}`),
      line(`  ⚡ Commandes : ${this.commandsExecuted}`),
      line(`  ❌ Erreurs : ${this.errors}`),
      bottom,
      '',
      '─── Logs en direct (Ctrl+C pour quitter) ───────────────────────',
    ];
  }

  _headerText() {
    return this._headerLines().join('\n');
  }

  _logLines() {
    return this.logs.slice(-15).map(l => {
      const icon = { INFO: 'ℹ', WARN: '⚠', ERROR: '✗' }[l.level] || '·';
      const head = `  ${icon} [${l.timestamp}] `;
      const body = l.message.split('\n');
      return head + body[0] + body.slice(1).map(x => '\n    ' + x).join('');
    }).join('\n');
  }

  _draw() {
    if (!TTY || !this._started || this._drawing) return;
    this._drawing = true;
    try {
      const text = this._headerText() + '\n' + this._logLines() + '\n';
      if (this._firstDraw) {
        process.stdout.write('\x1b[2J');     // clear une seule fois (anti-clignotement)
        this._firstDraw = false;
      }
      // Retour en haut + réécriture ligne par ligne + purge du bas
      const painted = text.split('\n').map(l => l + '\x1b[K').join('\n');
      process.stdout.write('\x1b[H' + painted + '\x1b[J');
    } catch (_) {} finally {
      this._drawing = false;
    }
  }

  // ─── Cycle de vie ─────────────────────────────────────────────────
  start() {
    this._started = true;
    const banner = `[${this.botName}] TUI démarrée — ${formatDate()} ${formatTime()} (logs: logs/bot-out.log, logs/bot-error.log)`;
    if (TTY) {
      this._draw();
      this.refreshInterval = setInterval(() => this._draw(), 1000);
      this._originalLog(banner);
    } else {
      // Mode non-interactif : en-tête unique puis flux simple
      this._originalLog(this._headerText());
      this._originalLog(banner);
    }
  }

  shutdown(code = 0) {
    if (this._shutdownDone) return;
    this._shutdownDone = true;
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this._restoreConsole();
    const s = this._stats();
    const out = [
      '',
      '════════════════════════════════════════════════════════',
      `  ${this.botName} — Arrêt du bot`,
      `  Uptime   : ${s.uptime}`,
      `  Messages : ${this.messagesReceived} reçus / ${this.messagesSent} envoyés`,
      `  Commandes: ${this.commandsExecuted} | Erreurs: ${this.errors}`,
      '════════════════════════════════════════════════════════',
      '',
    ].join('\n');
    this._originalLog(out);
    process.exit(code);
  }

  getLogs() { return this.logs; }
}

module.exports = { TUI, formatUptime, formatBytes };
