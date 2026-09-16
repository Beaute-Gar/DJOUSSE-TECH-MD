'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — AI MEMORY MODULE
 * ============================================================
 *
 * Per-user memory for AI context:
 * - Facts extracted from conversations
 * - Similarity-based dedup (>=60% common words)
 * - Security filter (no passwords, secrets, card numbers)
 * - Context prompt builder for AI commands
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'user-memory.json');
const MAX_FACTS_PER_USER = 50;
const SIMILARITY_THRESHOLD = 0.6;

// Security patterns — refuse to store
const SENSITIVE_PATTERNS = [
    /password/i,
    /mot de passe/i,
    /code secret/i,
    /\d{16}/,  // Card numbers
    /token/i,
    /api[_-]?key/i,
    /secret/i,
    /credential/i,
];

// Trigger patterns — extract facts when detected
const TRIGGER_PATTERNS = [
    /je m'appelle/i,
    /je vends/i,
    /j'habite/i,
    /mon business/i,
    /je suis/i,
    /mon numéro/i,
    /mon email/i,
    /ma société/i,
    /je travaille/i,
    /mon adresse/i,
    /je veux/i,
    /mon projet/i,
    /ma marque/i,
];

function load() {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function save(data) {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function getUserMemory(userId) {
    const data = load();
    if (!data[userId]) {
        data[userId] = { facts: [], tone: null, interactions: 0, lastInteraction: null };
        save(data);
    }
    return data[userId];
}

function containsSensitive(text) {
    return SENSITIVE_PATTERNS.some(p => p.test(text));
}

function wordOverlap(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (words1.size === 0 || words2.size === 0) return 0;
    let common = 0;
    for (const w of words1) {
        if (words2.has(w)) common++;
    }
    return common / Math.max(words1.size, words2.size);
}

function isDuplicate(userId, text) {
    const memory = getUserMemory(userId);
    return memory.facts.some(f => wordOverlap(f.text, text) >= SIMILARITY_THRESHOLD);
}

function addFact(userId, text, source = 'manual') {
    if (!text || typeof text !== 'string' || text.trim().length < 3) return null;
    text = text.trim();

    // Security check
    if (containsSensitive(text)) return null;

    // Dedup check
    if (isDuplicate(userId, text)) return null;

    const memory = getUserMemory(userId);
    if (memory.facts.length >= MAX_FACTS_PER_USER) return null;

    const fact = {
        id: Date.now().toString(36) + Math.floor(Math.random() * 999),
        text,
        source,
        score: 1,
        ts: Date.now(),
    };

    memory.facts.push(fact);
    const data = load();
    data[userId] = memory;
    save(data);

    console.log(`[MEMORY] 📝 Fact added for ${userId.split('@')[0]}: ${text.substring(0, 50)}...`);
    return fact;
}

function removeFact(userId, factId) {
    const memory = getUserMemory(userId);
    const idx = memory.facts.findIndex(f => f.id === factId);
    if (idx === -1) return false;

    memory.facts.splice(idx, 1);
    const data = load();
    data[userId] = memory;
    save(data);
    return true;
}

function removeFactByIndex(userId, index) {
    const memory = getUserMemory(userId);
    if (index < 0 || index >= memory.facts.length) return false;
    return removeFact(userId, memory.facts[index].id);
}

function clearMemory(userId) {
    const data = load();
    data[userId] = { facts: [], tone: null, interactions: 0, lastInteraction: null };
    save(data);
}

function listFacts(userId) {
    return getUserMemory(userId).facts;
}

function buildContextPrompt(userId) {
    const memory = getUserMemory(userId);
    if (!memory.facts.length) return '';

    const factsText = memory.facts
        .sort((a, b) => b.score - a.score || b.ts - a.ts)
        .slice(0, 10)
        .map(f => `- ${f.text}`)
        .join('\n');

    return `\n[Connaissances sur cet utilisateur]\n${factsText}\n`;
}

function shouldExtractFacts(text) {
    return TRIGGER_PATTERNS.some(p => p.test(text));
}

function extractFactsFromText(text) {
    const facts = [];
    // Simple sentence extraction — split by punctuation, keep sentences with triggers
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
    for (const sentence of sentences) {
        if (TRIGGER_PATTERNS.some(p => p.test(sentence))) {
            facts.push(sentence.trim());
        }
    }
    return facts.slice(0, 3); // Max 3 facts per message
}

function touchInteraction(userId) {
    const memory = getUserMemory(userId);
    memory.interactions = (memory.interactions || 0) + 1;
    memory.lastInteraction = Date.now();
    const data = load();
    data[userId] = memory;
    save(data);
}

function getStats(userId) {
    const memory = getUserMemory(userId);
    return {
        factCount: memory.facts.length,
        maxFacts: MAX_FACTS_PER_USER,
        interactions: memory.interactions || 0,
        lastInteraction: memory.lastInteraction,
    };
}

// Cleanup: archive facts not used in 60 days
function cleanup(maxAgeDays = 60) {
    const data = load();
    const cutoff = Date.now() - (maxAgeDays * 86400000);
    let cleaned = 0;
    for (const userId of Object.keys(data)) {
        if (!data[userId]?.facts) continue;
        const before = data[userId].facts.length;
        data[userId].facts = data[userId].facts.filter(f => f.ts > cutoff || f.score > 1);
        cleaned += before - data[userId].facts.length;
    }
    if (cleaned > 0) {
        save(data);
        console.log(`[MEMORY] 🧹 Cleaned ${cleaned} old facts`);
    }
}

// Cleanup every week
setInterval(() => cleanup(), 7 * 24 * 60 * 60 * 1000);

module.exports = {
    addFact,
    removeFact,
    removeFactByIndex,
    clearMemory,
    listFacts,
    buildContextPrompt,
    shouldExtractFacts,
    extractFactsFromText,
    touchInteraction,
    getStats,
    containsSensitive,
};
