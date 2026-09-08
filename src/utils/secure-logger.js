import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SECURITY: 4
};

const LOG_LEVEL_NAMES = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARN',
    3: 'ERROR',
    4: 'SECURITY'
};

const SENSITIVE_PATTERNS = [
    { pattern: /phone_number[=:]\s*(\+?\d{10,15})/gi, replacement: '[REDACTED_PHONE]' },
    { pattern: /email[=:]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, replacement: '[REDACTED_EMAIL]' },
    { pattern: /password[=:]\s*([^\s,]+)/gi, replacement: '[REDACTED_PASSWORD]' },
    { pattern: /pin[=:]\s*(\d{4,6})/gi, replacement: '[REDACTED_PIN]' },
    { pattern: /token[=:]\s*([a-zA-Z0-9._-]{8,})/gi, replacement: '[REDACTED_TOKEN]' },
    { pattern: /key[=:]\s*([a-zA-Z0-9._-]{16,})/gi, replacement: '[REDACTED_KEY]' },
    { pattern: /cookie[=:]\s*([^;,]+)/gi, replacement: '[REDACTED_COOKIE]' },
    { pattern: /jwt[=:]\s*([a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, replacement: '[REDACTED_JWT]' },
    { pattern: /session[=:]\s*([a-zA-Z0-9_-]{10,})/gi, replacement: '[REDACTED_SESSION]' },
    { pattern: /credit[_\s]?card[=:]\s*(\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4})/gi, replacement: '[REDACTED_CC]' },
    { pattern: /ip_address[=:]\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi, replacement: '[REDACTED_IP]' }
];

class SecureLogger {
    constructor(config = {}) {
        this.logLevel = config.logLevel || LOG_LEVELS.INFO;
        this.logDirectory = config.logDirectory || './logs';
        this.maxLogSize = config.maxLogSize || 10 * 1024 * 1024;
        this.retentionDays = config.retentionDays || 30;
        this.consoleOutput = config.consoleOutput !== undefined ? config.consoleOutput : true;

        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }

        this.logBuffer = [];
        this.bufferSize = 0;
        this.maxBufferSize = config.maxBufferSize || 100;
    }

    sanitize(message) {
        let sanitized = message;
        for (const pattern of SENSITIVE_PATTERNS) {
            sanitized = sanitized.replace(pattern.pattern, pattern.replacement);
        }
        return sanitized;
    }

    sanitizeObject(obj) {
        if (typeof obj === 'string') {
            return this.sanitize(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                const sensitiveKeys = ['password', 'pin', 'token', 'key', 'secret', 'jwt', 'cookie', 'session', 'creditCard'];
                if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
                    sanitized[key] = '[REDACTED]';
                } else {
                    sanitized[key] = this.sanitizeObject(value);
                }
            }
            return sanitized;
        }
        return obj;
    }

    getLogFilename() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `app-${year}-${month}-${day}.log`;
    }

    async writeLog(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const levelName = LOG_LEVEL_NAMES[level] || 'INFO';

        const sanitizedMessage = this.sanitize(message);
        let logEntry = `[${timestamp}] [${levelName}] ${sanitizedMessage}`;

        if (data !== null && data !== undefined) {
            const sanitizedData = this.sanitizeObject(data);
            logEntry += `\n${JSON.stringify(sanitizedData, null, 2)}`;
        }

        logEntry += '\n';

        if (this.consoleOutput && level >= this.logLevel) {
            const color = this.getConsoleColor(level);
            console.log(color + logEntry + '\x1b[0m');
        }

        this.logBuffer.push(logEntry);
        this.bufferSize += logEntry.length;

        if (this.bufferSize >= this.maxBufferSize) {
            await this.flush();
        }
    }

    getConsoleColor(level) {
        switch(level) {
            case LOG_LEVELS.DEBUG: return '\x1b[36m';
            case LOG_LEVELS.INFO: return '\x1b[32m';
            case LOG_LEVELS.WARN: return '\x1b[33m';
            case LOG_LEVELS.ERROR: return '\x1b[31m';
            case LOG_LEVELS.SECURITY: return '\x1b[35m';
            default: return '\x1b[0m';
        }
    }

    async flush() {
        if (this.logBuffer.length === 0) return;

        try {
            const filename = this.getLogFilename();
            const filepath = path.join(this.logDirectory, filename);

            if (fs.existsSync(filepath)) {
                const stats = fs.statSync(filepath);
                if (stats.size > this.maxLogSize) {
                    const archivePath = path.join(this.logDirectory, `archive-${filename}`);
                    fs.renameSync(filepath, archivePath);
                }
            }

            const content = this.logBuffer.join('');
            fs.appendFileSync(filepath, content, 'utf8');

            this.logBuffer = [];
            this.bufferSize = 0;

            await this.cleanOldLogs();
        } catch (error) {
            console.error('Erreur lors de l\'écriture du log:', error);
        }
    }

    async cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logDirectory);
            const now = Date.now();

            for (const file of files) {
                if (file.startsWith('app-') && file.endsWith('.log')) {
                    const filepath = path.join(this.logDirectory, file);
                    const stats = fs.statSync(filepath);
                    const fileAge = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

                    if (fileAge > this.retentionDays) {
                        fs.unlinkSync(filepath);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors du nettoyage des logs:', error);
        }
    }

    debug(message, data = null) {
        this.writeLog(LOG_LEVELS.DEBUG, message, data);
    }

    info(message, data = null) {
        this.writeLog(LOG_LEVELS.INFO, message, data);
    }

    warn(message, data = null) {
        this.writeLog(LOG_LEVELS.WARN, message, data);
    }

    error(message, data = null) {
        this.writeLog(LOG_LEVELS.ERROR, message, data);
    }

    security(message, data = null) {
        this.writeLog(LOG_LEVELS.SECURITY, `\u{1F512} ${message}`, data);
    }

    logUserAction(action, userJid, data = null) {
        this.security(`User action: ${action}`, {
            user: userJid,
            action: action,
            ...data
        });
    }

    logSecurityEvent(event, details = null) {
        this.security(`Security event: ${event}`, details);
    }

    async shutdown() {
        await this.flush();
    }
}

let instance = null;

export function getSecureLogger(config = {}) {
    if (!instance) {
        instance = new SecureLogger(config);
    }
    return instance;
}

export default SecureLogger;
export { LOG_LEVELS, LOG_LEVEL_NAMES };
