import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';
import { getSecureLogger } from '../utils/secure-logger.js';

const logger = getSecureLogger();

const db = { run: rawRun, get: rawGet, all: rawAll };

const CONFIG = {
    maxMessageLength: 4096,
    maxMediaSize: 100 * 1024 * 1024,
    maxLinksPerMessage: 5,
    maxMentionsPerMessage: 20,
    spamScoreThreshold: 5,
    allowedDomains: [
        'youtube.com', 'youtu.be', 'google.com', 'gmail.com',
        'whatsapp.com', 'wa.me', 'github.com', 'gitlab.com',
        'twitter.com', 'x.com', 'linkedin.com', 'facebook.com',
        'instagram.com', 'tiktok.com', 'reddit.com', 'medium.com'
    ],
    blockedDomains: [
        'bit.ly', 'tinyurl.com', 'shorturl.at', 'is.gd',
        'buff.ly', 'ow.ly', 'goo.gl', 't.co'
    ],
    spamKeywords: [
        'gagner', 'argent', 'facile', 'rapide', 'cliquez',
        'abonnez', 'partagez', 'million', 'offre', 'exclusif',
        'gratuit', '100%', 'garanti', 'urgent', 'secret'
    ],
    blockedContentRegex: [
        /<script/i,
        /javascript:/i,
        /onclick=/i,
        /onerror=/i,
        /eval\(/i,
        /document\./i,
        /window\./i,
        /localStorage/i,
        /sessionStorage/i,
        /\.exec\(/i,
        /sql\s*inject/i,
        /union\s+select/i,
        /drop\s+table/i,
        /delete\s+from/i
    ]
};

class MessageValidator {
    constructor(config = {}) {
        this.config = { ...CONFIG, ...config };
        this.spamCache = new Map();
        this.validatorStats = {
            totalValidated: 0,
            blocked: 0,
            warnings: 0
        };
    }

    async validateMessage(message, userJid) {
        this.validatorStats.totalValidated++;

        const result = {
            valid: true,
            warnings: [],
            errors: [],
            score: 0,
            sanitized: null
        };

        try {
            if (!message) {
                result.valid = false;
                result.errors.push('Message is undefined');
                return result;
            }

            if (message.text) {
                const textResult = await this.validateText(message.text, userJid);
                Object.assign(result, textResult);
            }

            if (message.media) {
                const mediaResult = await this.validateMedia(message.media);
                if (!mediaResult.valid) {
                    result.valid = false;
                    result.errors.push(...mediaResult.errors);
                }
            }

            if (message.mentions) {
                const mentionResult = this.validateMentions(message.mentions);
                if (!mentionResult.valid) {
                    result.valid = false;
                    result.errors.push(...mentionResult.errors);
                }
            }

            if (result.score > this.config.spamScoreThreshold) {
                result.valid = false;
                result.errors.push(`Spam score too high: ${result.score}`);
            }

            if (!result.valid) {
                this.validatorStats.blocked++;
                logger.security(`Message blocked for ${userJid}`, {
                    errors: result.errors,
                    score: result.score,
                    message: result.sanitized || message.text?.substring(0, 100)
                });
            } else if (result.warnings.length > 0) {
                this.validatorStats.warnings++;
                logger.warn(`Message warnings for ${userJid}`, {
                    warnings: result.warnings,
                    message: result.sanitized || message.text?.substring(0, 100)
                });
            }

            return result;
        } catch (error) {
            logger.error('Erreur lors de la validation du message', {
                error: error.message,
                userJid,
                message: message?.text?.substring(0, 100)
            });
            result.valid = false;
            result.errors.push(`Validation error: ${error.message}`);
            return result;
        }
    }

    async validateText(text, userJid) {
        const result = {
            valid: true,
            warnings: [],
            errors: [],
            score: 0,
            sanitized: text
        };

        if (text.length > this.config.maxMessageLength) {
            result.errors.push(`Message exceeds maximum length (${this.config.maxMessageLength})`);
            result.sanitized = text.substring(0, this.config.maxMessageLength);
            result.valid = false;
        }

        const urls = this.extractUrls(text);
        const uniqueUrls = [...new Set(urls)];

        if (uniqueUrls.length > this.config.maxLinksPerMessage) {
            result.warnings.push(`Too many links (${uniqueUrls.length})`);
            result.score += 2;
        }

        for (const url of uniqueUrls) {
            const urlResult = this.validateUrl(url);
            if (!urlResult.valid) {
                result.errors.push(`Invalid URL: ${url}`);
                result.valid = false;
            }
            if (urlResult.score > 0) {
                result.score += urlResult.score;
            }
        }

        const injectionResult = this.detectInjection(text);
        if (!injectionResult.valid) {
            result.errors.push(...injectionResult.errors);
            result.valid = false;
            result.score += 5;
        }

        const spamResult = this.detectSpam(text, userJid);
        result.score += spamResult.score;
        if (!spamResult.valid) {
            result.errors.push(...spamResult.errors);
            result.valid = false;
        }

        result.sanitized = this.sanitizeText(result.sanitized);

        return result;
    }

    extractUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matches = text.match(urlRegex) || [];
        return matches.map(url => url.trim().replace(/[.,;:!?]$/, ''));
    }

    validateUrl(url) {
        const result = { valid: true, score: 0, domain: null };

        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            result.domain = domain;

            if (this.config.blockedDomains.some(blocked => domain.includes(blocked))) {
                result.valid = false;
                result.score += 3;
                return result;
            }

            const isAllowed = this.config.allowedDomains.some(allowed =>
                domain === allowed || domain.endsWith(`.${allowed}`)
            );

            if (!isAllowed) {
                result.score += 1;
            }

            if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
                result.valid = false;
                result.score += 2;
            }
        } catch (error) {
            result.valid = false;
            result.score += 2;
        }

        return result;
    }

    detectInjection(text) {
        const result = { valid: true, errors: [] };

        for (const regex of this.config.blockedContentRegex) {
            if (regex.test(text)) {
                result.valid = false;
                result.errors.push(`Potential injection detected (pattern: ${regex})`);
                break;
            }
        }

        return result;
    }

    detectSpam(text, userJid) {
        const result = { valid: true, score: 0, errors: [] };

        let keywordCount = 0;
        const lowerText = text.toLowerCase();
        for (const keyword of this.config.spamKeywords) {
            if (lowerText.includes(keyword)) {
                keywordCount++;
            }
        }

        if (keywordCount > 0) {
            result.score += keywordCount * 0.5;
        }

        const uppercaseCount = (text.match(/[A-Z\u00C0-\u00DE]/g) || []).length;
        const totalChars = text.replace(/[^a-zA-Z\u00C0-\u00DE]/g, '').length;
        if (totalChars > 0) {
            const uppercaseRatio = uppercaseCount / totalChars;
            if (uppercaseRatio > 0.7) {
                result.score += 2;
            }
        }

        const repeatedChars = text.match(/(.)\1{3,}/g);
        if (repeatedChars) {
            result.score += repeatedChars.length * 0.5;
        }

        const emojiCount = (text.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length;
        if (emojiCount > 10) {
            result.score += 1;
        }

        const userSpamScore = this.spamCache.get(userJid) || 0;
        if (userSpamScore > 10) {
            result.score += 2;
        }

        if (result.score > this.config.spamScoreThreshold) {
            result.valid = false;
            result.errors.push('Spam pattern detected');
        }

        return result;
    }

    sanitizeText(text) {
        let sanitized = text;
        sanitized = sanitized.replace(/[&<>"]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            return m;
        });
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        return sanitized;
    }

    validateMentions(mentions) {
        const result = { valid: true, errors: [] };

        if (!Array.isArray(mentions)) {
            result.errors.push('Mentions must be an array');
            result.valid = false;
            return result;
        }

        if (mentions.length > this.config.maxMentionsPerMessage) {
            result.errors.push(`Too many mentions (max ${this.config.maxMentionsPerMessage})`);
            result.valid = false;
        }

        for (const mention of mentions) {
            if (!mention || typeof mention !== 'string') {
                result.errors.push('Invalid mention format');
                result.valid = false;
                break;
            }
            if (!mention.includes('@')) {
                result.errors.push(`Invalid mention: ${mention}`);
                result.valid = false;
                break;
            }
        }

        return result;
    }

    async validateMedia(media) {
        const result = { valid: true, errors: [] };

        if (media.size && media.size > this.config.maxMediaSize) {
            result.errors.push(`Media size exceeds limit (${this.config.maxMediaSize})`);
            result.valid = false;
        }

        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/3gp', 'audio/mpeg', 'audio/ogg'];
        if (media.mimetype && !allowedMimes.includes(media.mimetype)) {
            result.errors.push(`Unsupported media type: ${media.mimetype}`);
            result.valid = false;
        }

        return result;
    }

    getStats() {
        return { ...this.validatorStats, spamCacheSize: this.spamCache.size };
    }

    resetStats() {
        this.validatorStats = { totalValidated: 0, blocked: 0, warnings: 0 };
    }
}

let instance = null;

export function getMessageValidator(config = {}) {
    if (!instance) {
        instance = new MessageValidator(config);
    }
    return instance;
}

/* Wrapper fonctionnel attendu par src/api/webhook.js (POST /validate).
   isGroup n'est pas encore exploité par validateMessage/validateText — transmis
   dans l'objet message pour rester disponible plutôt que d'être silencieusement perdu. */
export async function validate(userJid, text, isGroup = false) {
    return getMessageValidator().validateMessage({ text, isGroup }, userJid);
}

export default MessageValidator;
