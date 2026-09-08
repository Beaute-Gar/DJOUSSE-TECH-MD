/* lib/ratelimit.cjs — Rate limiting pour les commandes du bot */

const cooldowns = new Map();
const DEFAULT_COOLDOWN = 2000; // 2 secondes

/**
 * Vérifie si un utilisateur peut exécuter une commande
 * @param {string} userId - JID de l'utilisateur
 * @param {string} command - Nom de la commande
 * @param {number} cooldown - Cooldown en ms (défaut: 2000)
 * @returns {boolean} true si autorisé, false si trop rapide
 */
function checkRateLimit(userId, command, cooldown = DEFAULT_COOLDOWN) {
    const key = `${userId}:${command}`;
    const lastUsed = cooldowns.get(key) || 0;
    const now = Date.now();
    if (now - lastUsed < cooldown) return false;
    cooldowns.set(key, now);
    return true;
}

/**
 * Vérifie le rate limit global d'un utilisateur (toutes commandes confondues)
 * @param {string} userId - JID de l'utilisateur
 * @param {number} cooldown - Cooldown en ms (défaut: 1500)
 * @returns {boolean} true si autorisé
 */
function checkGlobalRateLimit(userId, cooldown = 1500) {
    return checkRateLimit(userId, '__global__', cooldown);
}

/**
 * Nettoie les anciens cooldowns (à appeler périodiquement)
 */
function cleanupRateLimits() {
    const now = Date.now();
    for (const [key, timestamp] of cooldowns.entries()) {
        if (now - timestamp > 60000) cooldowns.delete(key); // 1 minute
    }
}

// Nettoyage toutes les 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

module.exports = { checkRateLimit, checkGlobalRateLimit, cleanupRateLimits };
