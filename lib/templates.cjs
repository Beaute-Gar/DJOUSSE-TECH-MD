'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — QUOTE TEMPLATES (12 VARIANTS)
 * ============================================================
 *
 * 12 templates variés pour éviter la détection de patterns
 * Chaque template a un style unique : emojis, ponctuation, ordre
 *
 * ============================================================
 */

const TEMPLATES = [
  // Style 1 : encadré classique
  (q, a, bot) => `╭─「 💡 PENSÉE DU JOUR 」\n│\n│ « ${q} »\n│\n│ — ${a}\n│\n╰─「 ${bot} 」`,

  // Style 2 : bordure double
  (q, a, bot) => `┏━━「 ✨ SAGESSE 」\n┃\n┃ « ${q} »\n┃\n┃ — ${a}\n┗━━ ${bot}`,

  // Style 3 : minimal
  (q, a, bot) => `「 🧠 RÉFLEXION DU JOUR 」\n\n« ${q} »\n\n— ${a}\n\n⚡ ${bot}`,

  // Style 4 : étoilé
  (q, a, bot) => `╭━━━━━━「 🌟 」\n│\n│ ${q}\n│\n│ ─ ${a}\n╰━━━━━━「 ${bot} 」`,

  // Style 5 : italique markdown
  (q, a, bot) => `💭 *${q}*\n\n_— ${a}_\n\n> ${bot}`,

  // Style 6 : quote
  (q, a, bot) => `✨ « ${q} »\n\n— ${a} ✨\n\n_${bot}_`,

  // Style 7 : sunrise
  (q, a, bot) => `🌅 ${q}\n\n👤 ${a}\n\n📌 ${bot}`,

  // Style 8 : partage
  (q, a, bot) => `${bot} vous partage :\n\n*${q}*\n_— ${a}_`,

  // Style 9 : livre
  (q, a, bot) => `📖 "${q}"\n\n— ${a}`,

  // Style 10 : réflexion
  (q, a, bot) => `🧠 Réflexion :\n\n${q}\n\n— ${a} | ${bot}`,

  // Style 11 : ligne simple
  (q, a, bot) => `━━━━━━━━━━━━━\n💫 ${q}\n\n— ${a}\n━━━━━━━━━━━━━\n${bot}`,

  // Style 12 : premium
  (q, a, bot) => `✦ ─────────────── ✦\n   💎  C I T A T I O N\n✦ ─────────────── ✦\n\n« ${q} »\n\n  ▸ Auteur  ·  ${a}\n\n✦ ─────────────── ✦\n   ${bot}\n✦ ─────────────── ✦`,
];

/**
 * Retourne un template aléatoire formaté
 */
function formatQuote(quote, botName = 'DJOUSSE TECH') {
    const idx = Math.floor(Math.random() * TEMPLATES.length);
    return TEMPLATES[idx](quote.text, quote.author, botName);
}

module.exports = {
    TEMPLATES,
    formatQuote,
};
