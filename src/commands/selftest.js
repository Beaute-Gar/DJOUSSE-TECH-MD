import { getAllCommandNames, getPlugin } from '../core/loader.js';
import { Users } from '../lib/database.js';

export const name = 'selftest';
export const aliases = ['testall', 'autotest'];
export const description = 'Teste toutes les commandes automatiquement';
export const category = 'admin';
export const level = 'owner';

export async function handler(sock, m, { prefix, sender, pushName, isGroup }) {
  const chatJid = m.key.remoteJid;
  const allPlugins = getAllCommandNames().filter(p => p !== 'selftest');
  let success = 0;
  let failed = 0;
  const results = [];

  await m.reply(`🧪 *Auto-Test lancé*\n━━━━━━━━━━━━━━━━\n📦 ${allPlugins.length} commandes à tester\n⏳ Patientez…`);

  for (const name of allPlugins) {
    try {
      const plugin = getPlugin(name);
      if (!plugin || typeof plugin.handler !== 'function') {
        failed++;
        results.push(`❌ ${name} — handler introuvable`);
        continue;
      }

      const mockM = {
        key: { remoteJid: chatJid, id: `test_${name}_${Date.now()}`, fromMe: false, participant: sender },
        sender: sender,
        pushName: pushName || 'Test',
        body: `${prefix}${name}`,
        isGroup: false,
        react: async (emoji) => sock.sendMessage(chatJid, { react: { text: emoji, key: mockM.key } }).catch(() => {}),
        reply: async (content) => sock.sendMessage(chatJid, typeof content === 'string' ? { text: content } : content).catch(() => {}),
      };

      await plugin.handler(sock, mockM, {
        args: [],
        text: '',
        prefix,
        config: { PREFIX: prefix },
        isGroup: false,
        privilege: 'owner',
      });

      success++;
      results.push(`✅ ${name}`);
    } catch (e) {
      failed++;
      results.push(`❌ ${name} — ${(e.message || '').slice(0, 80)}`);
    }
  }

  let report = `╭━━━『 *AUTO-TEST* 』━━━╮\n`;
  report += `┃ ✅ Réussis: ${success}\n`;
  report += `┃ ❌ Échecs: ${failed}\n`;
  report += `┃ 📦 Total: ${allPlugins.length}\n`;
  report += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
  report += results.join('\n');

  await sock.sendMessage(chatJid, { text: report });
}
