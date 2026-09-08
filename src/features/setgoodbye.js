import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const log = createLogger('SETGOODBYE');
const DB = './database/welcome.json';

function load() {
  try {
    if (!existsSync(DB)) writeFileSync(DB, '{}');
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

function save(data) { writeFileSync(DB, JSON.stringify(data, null, 2)); }

const triggers = [/message de départ/i, /message goodbye/i, /set goodbye/i, /quand.*part/i, /adieu/i];

export function enableSetGoodbye(sock) {
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
      const goodbyeMsg = text.replace(/message de départ\s*/i, '').replace(/set goodbye\s*/i, '').replace(/adieu\s*/i, '').trim();
      if (!goodbyeMsg || goodbyeMsg.length < 5) {
        try { await sock.sendMessage(chat, { text: '👋 Quel message de départ veux-tu définir ?\nEx: "Au revoir @user ! Tu nous manqueras."' }); } catch (_) {}
        continue;
      }
      const data = load();
      if (!data[chat]) data[chat] = {};
      data[chat].goodbye = goodbyeMsg;
      save(data);
      log.info(`Goodbye défini pour ${chat}`);
      try { await sock.sendMessage(chat, { text: `✅ Message de départ défini:\n\n${goodbyeMsg}` }); } catch (_) {}
    }
  });
  log.info('Module setgoodbye actif');
}
