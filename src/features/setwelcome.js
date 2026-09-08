import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const log = createLogger('SETWELCOME');
const DB = './database/welcome.json';

function load() {
  try {
    if (!existsSync(DB)) writeFileSync(DB, '{}');
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

function save(data) { writeFileSync(DB, JSON.stringify(data, null, 2)); }

const triggers = [/message d'accueil/i, /message de bienvenue/i, /set welcome/i, /setwelcome/i, /bienvenue/i, /welcome/i];

export function enableSetWelcome(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat?.endsWith('@g.us')) continue;
      const sender = msg.key.participant;
      if (!sender) continue;
      const meta = await sock.groupMetadata(chat).catch(() => null);
      if (!meta) continue;
      const isAdmin = meta.participants?.some(p => p.id === sender && p.admin);
      if (!isAdmin) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const welcomeMsg = text
        .replace(/message d'accueil\s*/i, '').replace(/message de bienvenue\s*/i, '')
        .replace(/set welcome\s*/i, '').replace(/bienvenue\s*/i, '').trim();

      if (!welcomeMsg || welcomeMsg.length < 5) {
        try {
          await sock.sendMessage(chat, {
            text: '👋 Quel message d\'accueil veux-tu définir ?\nEx: "Bienvenue @user dans @group ! 🎉"\n\nVariables: @user, @group, @count'
          });
        } catch (_) {}
        continue;
      }

      const data = load();
      if (!data[chat]) data[chat] = {};
      data[chat].welcome = welcomeMsg;
      save(data);
      log.info(`Welcome défini pour ${chat}: ${welcomeMsg.slice(0, 50)}`);
      try {
        await sock.sendMessage(chat, { text: `✅ Message d'accueil défini:\n\n${welcomeMsg}` });
      } catch (_) {}
    }
  });

  log.info('Module setwelcome actif');
}
