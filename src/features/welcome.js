import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, existsSync } from 'fs';

const log = createLogger('WELCOME');
const DB = './database/welcome.json';

function load() {
  try {
    if (!existsSync(DB)) return {};
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

export function enableWelcome(sock) {
  if (process.env.AUTO_WELCOME !== 'true') {
    log.info('Welcome/départ désactivé (AUTO_WELCOME != true)');
    return;
  }
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const configs = load();
    const groupCfg = configs[id];

    for (const jid of participants) {
      if (action === 'add') {
        let msg = groupCfg?.welcome || '👋 Bienvenue @user dans @group ! 🎉';
        msg = msg.replace(/@user/g, `@${jid.split('@')[0]}`);
        msg = msg.replace(/@group/g, (await sock.groupMetadata(id).catch(() => ({ subject: 'Groupe' })))?.subject || 'Groupe');
        const meta = await sock.groupMetadata(id).catch(() => ({ participants: [], subject: 'Groupe' }));
        msg = msg.replace(/@count/g, String(meta.participants?.length || 0));

        try {
          await sock.sendMessage(id, { text: msg, mentions: [jid] });
          log.info(`Welcome envoyé à ${jid} dans ${id}`);
        } catch (_) {}
      }

      if (action === 'remove') {
        const goodbye = groupCfg?.goodbye;
        if (!goodbye) continue;
        let msg = goodbye.replace(/@user/g, `@${jid.split('@')[0]}`);
        msg = msg.replace(/@group/g, (await sock.groupMetadata(id).catch(() => ({ subject: 'Groupe' })))?.subject || 'Groupe');
        const meta = await sock.groupMetadata(id).catch(() => ({ participants: [], subject: 'Groupe' }));
        msg = msg.replace(/@count/g, String(meta.participants?.length || 0));

        try {
          await sock.sendMessage(id, { text: msg, mentions: [jid] });
          log.info(`Goodbye envoyé pour ${jid} dans ${id}`);
        } catch (_) {}
      }
    }
  });

  log.info('Module welcome actif (bienvenue/départ automatiques)');
}
