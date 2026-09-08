/**
 * AI Memory — DJOUSSE-TECH-MD v3.0
 * 
 * Mémoire conversationnelle pour l'IA :
 * - Historique par utilisateur (sliding window)
 * - Résumé automatique quand l'historique dépasse la limite
 * - Contexte de conversation persistant (fichier)
 * - Support multi-modèle (Gemini, GPT, DeepSeek)
 * 
 * Compatible CJS.
 */

const fs = require('fs');
const path = require('path');

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════ */
const CONFIG = {
    MAX_HISTORY_PER_USER: 20,        // Messages à garder en mémoire
    MAX_HISTORY_CHARS: 8000,         // Limite de caractères par historique
    SUMMARY_THRESHOLD: 15,           // Résumer après X messages
    MEMORY_DIR: path.join(__dirname, '../../data/ai-memory'),
    TTL_HOURS: 24,                   // Durée de vie d'une conversation (heures)
};

/* ═══════════════════════════════════════════════════════════════════
   CLASSE MEMORY MANAGER
   ═══════════════════════════════════════════════════════════════════ */
class AIMemoryManager {
    constructor() {
        this.conversations = new Map(); // userId -> { messages[], lastActive, summary }
        this.ensureDir();
    }

    ensureDir() {
        if (!fs.existsSync(CONFIG.MEMORY_DIR)) {
            fs.mkdirSync(CONFIG.MEMORY_DIR, { recursive: true });
        }
    }

    /**
     * Récupérer l'historique d'un utilisateur
     */
    getHistory(userId) {
        // Nettoyer les conversations expirées
        this.cleanup();

        if (!this.conversations.has(userId)) {
            // Essayer de charger depuis le fichier
            const saved = this.loadFromFile(userId);
            if (saved) this.conversations.set(userId, saved);
        }

        const conv = this.conversations.get(userId);
        if (!conv) return [];

        // Vérifier TTL
        if (Date.now() - conv.lastActive > CONFIG.TTL_HOURS * 3600000) {
            this.conversations.delete(userId);
            return [];
        }

        return conv.messages || [];
    }

    /**
     * Ajouter un message à l'historique
     */
    addMessage(userId, role, content, model = null) {
        this.cleanup();

        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                messages: [],
                lastActive: Date.now(),
                summary: null,
                model,
            });
        }

        const conv = this.conversations.get(userId);
        conv.messages.push({
            role,       // 'user', 'assistant', 'system'
            content,
            time: Date.now(),
        });
        conv.lastActive = Date.now();
        if (model) conv.model = model;

        // Résumer si trop long
        if (conv.messages.length > CONFIG.SUMMARY_THRESHOLD) {
            this.summarize(userId);
        }

        // Tronquer si trop de caractères
        let totalChars = conv.messages.reduce((a, m) => a + (m.content?.length || 0), 0);
        while (totalChars > CONFIG.MAX_HISTORY_CHARS && conv.messages.length > 2) {
            const removed = conv.messages.shift();
            totalChars -= (removed.content?.length || 0);
        }

        // Sauvegarder sur disque
        this.saveToFile(userId, conv);
    }

    /**
     * Résumer l'historique via LLM (GROQ) — fallback sur truncation si pas de clé API
     */
    async summarize(userId) {
        const conv = this.conversations.get(userId);
        if (!conv || conv.messages.length < CONFIG.SUMMARY_THRESHOLD) return;

        // Garder les 5 derniers messages
        const recent = conv.messages.slice(-5);
        const old = conv.messages.slice(0, -5);

        // Tenter un résumé via LLM
        const apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
        if (apiKey && old.length >= 3) {
            try {
                const conversationText = old.map(m => `${m.role}: ${m.content}`).join('\n');
                const prompt = `Résume cette conversation en 2-3 phrases clés. Sois concis et conserve les informations importantes:\n\n${conversationText.slice(0, 4000)}`;
                
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'openai/gpt-oss-20b',
                        messages: [
                            { role: 'system', content: 'Tu résumes des conversations WhatsApp. Sois très concis.' },
                            { role: 'user', content: prompt },
                        ],
                        max_tokens: 200,
                        temperature: 0.3,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const llmSummary = data.choices?.[0]?.message?.content?.trim();
                    if (llmSummary && llmSummary.length > 20) {
                        conv.summary = llmSummary;
                        conv.messages = recent;
                        this.saveToFile(userId, conv);
                        console.log(`[AI-MEMORY] Résumé LLM créé pour ${userId}`);
                        return;
                    }
                }
            } catch (e) {
                console.error('[AI-MEMORY] Erreur résumé LLM:', e.message);
            }
        }

        // Fallback: résumé par troncation
        const summaryParts = [];
        if (conv.summary) summaryParts.push(conv.summary);
        for (const msg of old) {
            if (msg.role === 'user') {
                summaryParts.push(`User: ${msg.content.slice(0, 100)}...`);
            }
        }
        conv.summary = summaryParts.join(' | ');
        conv.messages = recent;

        console.log(`[AI-MEMORY] Résumé par troncation pour ${userId} (${conv.messages.length} messages récents)`);
    }

    /**
     * Construire le contexte pour l'IA
     */
    buildContext(userId, systemPrompt = '') {
        const history = this.getHistory(userId);
        
        const context = [];
        
        // Système
        if (systemPrompt) {
            context.push({ role: 'system', content: systemPrompt });
        }

        // Résumé si disponible
        const conv = this.conversations.get(userId);
        if (conv?.summary) {
            context.push({
                role: 'system',
                content: `[Résumé de la conversation précédente]: ${conv.summary}`,
            });
        }

        // Historique récent
        for (const msg of history) {
            context.push({
                role: msg.role,
                content: msg.content,
            });
        }

        return context;
    }

    /**
     * Effacer l'historique d'un utilisateur
     */
    clearHistory(userId) {
        this.conversations.delete(userId);
        this.deleteFile(userId);
    }

    /**
     * Obtenir les stats
     */
    getStats() {
        this.cleanup();
        let totalMessages = 0;
        for (const [, conv] of this.conversations) {
            totalMessages += conv.messages.length;
        }
        return {
            activeConversations: this.conversations.size,
            totalMessages,
            config: { ...CONFIG },
        };
    }

    /**
     * Nettoyer les conversations expirées
     */
    cleanup() {
        const now = Date.now();
        for (const [userId, conv] of this.conversations) {
            if (now - conv.lastActive > CONFIG.TTL_HOURS * 3600000) {
                this.conversations.delete(userId);
            }
        }
    }

    /**
     * Sauvegarder sur disque
     */
    saveToFile(userId, data) {
        try {
            const filePath = path.join(CONFIG.MEMORY_DIR, `${this.sanitize(userId)}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`[AI-MEMORY] Erreur sauvegarde ${userId}:`, e.message);
        }
    }

    /**
     * Charger depuis le disque
     */
    loadFromFile(userId) {
        try {
            const filePath = path.join(CONFIG.MEMORY_DIR, `${this.sanitize(userId)}.json`);
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                // Vérifier TTL
                if (Date.now() - data.lastActive > CONFIG.TTL_HOURS * 3600000) {
                    this.deleteFile(userId);
                    return null;
                }
                return data;
            }
        } catch {}
        return null;
    }

    /**
     * Supprimer le fichier
     */
    deleteFile(userId) {
        try {
            const filePath = path.join(CONFIG.MEMORY_DIR, `${this.sanitize(userId)}.json`);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
    }

    /**
     * Sanitizer le nom de fichier
     */
    sanitize(userId) {
        return String(userId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   INSTANCE SINGLETON
   ═══════════════════════════════════════════════════════════════════ */
let instance = null;

function getAIMemory() {
    if (!instance) {
        instance = new AIMemoryManager();
    }
    return instance;
}

module.exports = {
    getAIMemory,
    AIMemoryManager,
    CONFIG,
};
