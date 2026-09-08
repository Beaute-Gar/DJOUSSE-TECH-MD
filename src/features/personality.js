import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const log = createLogger('PERSONALITY');
const DB = './database/personality.json';

const PRESETS = {
  'professionnel': { style: 'professionnel et formel', temperature: 0.3, systemPrompt: 'Tu es un assistant professionnel. Réponses concises et précises.' },
  'amical': { style: 'amical et décontracté', temperature: 0.7, systemPrompt: 'Tu es un ami serviable. Réponses chaleureuses et décontractées.' },
  'humoristique': { style: 'drôle et sarcastique', temperature: 0.9, systemPrompt: 'Tu es humoriste. Ajoute de l\'humour à chaque réponse.' },
  'formel': { style: 'formel et respectueux', temperature: 0.2, systemPrompt: 'Tu es un assistant formel. Langage soutenu.' },
  'technique': { style: 'technique et précis', temperature: 0.4, systemPrompt: 'Tu es un expert technique. Réponses détaillées et précises.' },
  'minimaliste': { style: 'minimaliste', temperature: 0.1, systemPrompt: 'Réponds le plus brièvement possible.' }
};

function load() {
  try {
    if (!existsSync(DB)) { writeFileSync(DB, JSON.stringify(PRESETS['amical'], null, 2)); return PRESETS['amical']; }
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return PRESETS['amical']; }
}

function save(d) { writeFileSync(DB, JSON.stringify(d, null, 2)); }

const triggers = [
  /personnalité/i, /personnalite/i, /personality/i,
  /change.*ton (style|ton|manière|façon)/i, /sois plus/i,
  /mode (professionnel|amical|humoristique|formel|technique)/i,
  /parle comme/i
];

export function enablePersonality(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const isOwner = (msg.key.participant || chat)?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      if (!isOwner) {
        const current = load();
        try { await sock.sendMessage(chat, { text: `🧠 Ma personnalité actuelle: *${current.style}*\nSeul l'owner peut la changer.` }); } catch (_) {}
        continue;
      }

      let changed = false;
      for (const [name, preset] of Object.entries(PRESETS)) {
        if (text.includes(name)) {
          save(preset);
          try { await sock.sendMessage(chat, { text: `🧠 Personnalité changée: *${name}*\nStyle: ${preset.style}` }); } catch (_) {}
          changed = true;
          log.info(`Personnalité → ${name}`);
          break;
        }
      }

      if (!changed) {
        const modes = Object.keys(PRESETS).join(', ');
        try { await sock.sendMessage(chat, { text: `🎭 *Personnalités disponibles:*\n${modes}\n\nDis "mode amical" ou "sois professionnel"` }); } catch (_) {}
      }
    }
  });

  log.info('Module personality actif (6 modes)');
}

export function getPersonality() { return load(); }
