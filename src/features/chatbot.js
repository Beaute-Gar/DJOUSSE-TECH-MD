import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

const log = createLogger('CHATBOT');
const DB = './database/chatbot.json';

function load() {
  try {
    if (!existsSync(DB)) {
      writeFileSync(DB, JSON.stringify({ enabled: true, api: 'gemini', personality: 'default', systemPrompt: 'Tu es DJOUSSE TECH, assistant WhatsApp.', groups: {} }, null, 2));
    }
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return { enabled: true, api: 'gemini', personality: 'default', systemPrompt: '', groups: {} }; }
}

function save(d) { writeFileSync(DB, JSON.stringify(d, null, 2)); }

const triggers = [
  /parle moi/i, /discute/i, /tu fais quoi/i, /salut bot/i, /bonjour bot/i,
  /qui es-tu/i, /djousse/i, /hey bot/i, /tu peux/i, /demande.*toi/i
];

export function enableChatbot(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const cfg = load();
    if (!cfg.enabled) return;

    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;

      /* Ne jamais voler les commandes du bot (préfixe . ou !) ni les médias */
      const t = text.trim();
      if (t.startsWith('.') || t.startsWith('!') || t.startsWith('/')) continue;
      if (!t) continue;

      /* En groupe uniquement sur triggers explicites; en privé aussi
         (évite qu'une phrase ordinaire reçoive la réponse générique) */
      if (!triggers.some(p => p.test(t))) continue;

      try {
        const response = await generateResponse(t, cfg);
        await sock.sendMessage(chat, { text: response });
        log.info(`Chatbot reply to ${chat}: ${t.slice(0, 30)}`);
      } catch (_) {}
    }
  });

  log.info('Module chatbot actif (réponses IA en conversation naturelle)');
}

async function generateResponse(text, cfg) {
  const lower = text.toLowerCase();
  if (lower.includes('qui es tu') || lower.includes('qui es-tu')) {
    return '🤖 Je suis *DJOUSSE TECH*, ton assistant WhatsApp intelligent.\n🧠 Propulsé par Cognitive OS + AINORIA\n📱 Je peux t\'aider à gérer tes groupes, analyser des données, générer des images et bien plus !';
  }
  if (lower.includes('salut') || lower.includes('bonjour')) {
    return `👋 Salut ! Comment puis-je t'aider aujourd'hui ?\n(Je peux: générer des images, analyser des fichiers, traduire, etc.)`;
  }
  if (lower.includes('merci')) {
    return '😊 Avec plaisir ! N\'hésite pas si tu as besoin d\'autre chose.';
  }
  if (lower.includes('tu fais quoi')) {
    return '💻 Je surveille les conversations, prêt à t\'aider. Et toi ?';
  }
  return `📝 J'ai bien reçu ton message. Que veux-tu que je fasse ?\n(Dis "menu" pour voir mes capacités)`;
}
