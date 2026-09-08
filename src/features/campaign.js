import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CAMPAIGN');

const triggers = [/campagne/i, /campaign/i, /lance.*campagne/i, /marketing/i, /publipostage/i, /liste.*campagne/i];
const cmdPrefix = /^[.!]campagne/i;

async function getDB() {
  const { getDB } = await import('../../packages/infrastructure/database/database.js');
  return getDB();
}

export function enableCampaign(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || chat;
      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      if (!isOwner) continue;

      /* Handle .campagne command */
      if (cmdPrefix.test(text)) {
        const args = text.replace(cmdPrefix, '').trim().split(/\s+/);
        const subCmd = args[0]?.toLowerCase();
        try {
          const db = await getDB();

          if (subCmd === 'liste' || subCmd === 'list' || !subCmd) {
            const rows = await db.all('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 20').catch(() => []);
            if (!rows.length) {
              await sock.sendMessage(chat, { text: '📊 *Campagnes*\n\nAucune campagne trouvée.\n💡 Utilise `.campagne creer <nom>` pour créer une campagne.' }).catch(() => {});
              return;
            }
            let response = '📊 *Campagnes*\n\n';
            rows.forEach((c, i) => {
              response += `${i + 1}. *${c.name}* [${c.status}]\n`;
              response += `   ${c.sent_count || 0} envoyés · ${c.failed_count || 0} échecs\n`;
              if (c.scheduled_at) response += `   📅 ${new Date(c.scheduled_at * 1000).toLocaleDateString()}\n`;
              response += '\n';
            });
            response += '💡 `.campagne creer <nom>` pour créer une nouvelle campagne';
            await sock.sendMessage(chat, { text: response }).catch(() => {});
          } else if (subCmd === 'creer' && args[1]) {
            const nom = args.slice(1).join(' ');
            const t = Math.floor(Date.now() / 1000);
            await db.run(
              "INSERT INTO campaigns (name, type, status, message, channel, created_at, updated_at) VALUES (?, 'broadcast', 'draft', ?, 'whatsapp', ?, ?)",
              nom, 'Message de la campagne', t, t
            ).catch(() => {});
            await sock.sendMessage(chat, { text: `✅ Campagne "${nom}" créée avec succès !\n💡 Modifie le message via le dashboard.` }).catch(() => {});
          } else if (subCmd === 'supprimer' && args[1]) {
            const nom = args.slice(1).join(' ');
            await db.run("DELETE FROM campaigns WHERE name = ?", nom).catch(() => {});
            await sock.sendMessage(chat, { text: `🗑️ Campagne "${nom}" supprimée.` }).catch(() => {});
          } else {
            await sock.sendMessage(chat, {
              text: '📊 *Commandes Campagnes*\n\n' +
                    '📋 `.campagne liste` — Voir toutes les campagnes\n' +
                    '✏️ `.campagne creer <nom>` — Créer une nouvelle campagne\n' +
                    '🗑️ `.campagne supprimer <nom>` — Supprimer une campagne'
            }).catch(() => {});
          }
          log.info(`Campagne commande: ${subCmd || 'liste'}`);
        } catch (e) {
          await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
        }
        continue;
      }

      /* Trigger words */
      if (!triggers.some(p => p.test(text))) continue;

      try {
        const db = await getDB();
        const rows = await db.all('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 5').catch(() => []);
        const summary = rows.length
          ? rows.map((c, i) => `${i + 1}. ${c.name} [${c.status}] ${c.sent_count || 0} envoyés`).join('\n')
          : 'Aucune campagne.';
        await sock.sendMessage(chat, {
          text: `📊 *Campagnes*\n\n${summary}\n\n💡 Dis \`.campagne creer <nom>\` pour créer et envoyer une campagne.`
        }).catch(() => {});
      } catch {
        await sock.sendMessage(chat, { text: '❌ Base de données inaccessible' }).catch(() => {});
      }
    }
  });

  log.info('Module campaign actif (campagnes réelles via DB)');
}
