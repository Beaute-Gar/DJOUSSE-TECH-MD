import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('FIX');

const correctionMap = {
  'bjr': 'bonjour', 'bonj': 'bonjour', 'bonsoir': 'bonsoir', 'slt': 'salut',
  'cc': 'coucou', 'pk': 'pourquoi', 'pck': 'parce que', 'pq': 'pourquoi',
  'bj': 'bonjour', 'svp': 's\'il vous plaît', 'stp': 's\'il te plaît',
  'merci': 'merci', 'mrc': 'merci', 'ok': 'd\'accord', 'dac': 'd\'accord',
  'nn': 'non', 'oui': 'oui', 'jsuis': 'je suis', 'jai': 'j\'ai',
  'pas': 'pas', 'trop': 'trop', 'vrm': 'vraiment', 'vrément': 'vraiment',
  'tjr': 'toujours', 'jamais': 'jamais', 'tps': 'temps', 'aussi': 'aussi'
};

const fixTriggers = [
  /corrige.*?ça/i, /corrige.*?message/i, /fixe.*?ça/i, /auto.?fix/i,
  /mon.*?français/i, /orthographe/i
];

const cmdPrefix = /^[.!]auto.?fix/i;

export function enableFix(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;

      /* Handle .autofix command */
      if (cmdPrefix.test(text)) {
        const args = text.replace(cmdPrefix, '').trim().split(/\s+/);
        const subCmd = args[0]?.toLowerCase();
        try {
          const { RealAutoFix } = await import('../services/real-auto-fix.js');
          const { getDB } = await import('../../packages/infrastructure/database/database.js');
          const db = getDB();
          const fixer = new RealAutoFix(sock, db);

          if (subCmd === 'diagnostic' || subCmd === 'diag') {
            const result = await fixer.diagnostiquer();
            let response = `🔍 *Diagnostic système*\n\n`;
            response += `📊 Statut: ${result.summary}\n`;
            response += `📝 Détails: ${result.details}\n\n`;
            for (const issue of result.issues) {
              const icon = issue.ok ? '✅' : issue.severity === 'high' ? '🔴' : '🟡';
              response += `${icon} *${issue.label}*: ${issue.message}\n`;
            }
            response += `\n🕐 ${new Date(result.timestamp).toLocaleString()}`;
            response += `\n\n💡 Envoie \`!autofix reparer\` pour tenter une réparation`;
            await sock.sendMessage(chat, { text: response }).catch(() => {});
          } else if (subCmd === 'reparer' || subCmd === 'fix') {
            const result = await fixer.reparer();
            let response = `⚡ *Réparation automatique*\n\n`;
            response += `${result.resume}\n\n`;
            for (const action of result.actions) {
              const icon = action.status === 'ok' ? '✅' : '❌';
              response += `${icon} *${action.action}*: ${action.message || action.status}\n`;
            }
            response += `\n🕐 ${new Date(result.timestamp).toLocaleString()}`;
            await sock.sendMessage(chat, { text: response }).catch(() => {});
          } else {
            await sock.sendMessage(chat, {
              text: `⚡ *Auto-Fix v2.0*\n\n` +
                    `🔍 \`!autofix diagnostic\` — Analyser le système\n` +
                    `⚡ \`!autofix reparer\` — Réparer automatiquement\n` +
                    `📝 Corrige aussi les fautes d'orthographe`
            }).catch(() => {});
          }
          log.info(`Auto-fix commande: ${subCmd || 'aide'}`);
        } catch (e) {
          await sock.sendMessage(chat, { text: `❌ Auto-Fix: ${e.message}` }).catch(() => {});
        }
        continue;
      }

      /* Orthographe correction */
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';

      const isRequest = fixTriggers.some(p => p.test(text));
      if (!isRequest) continue;

      if (!targetText) {
        try { await sock.sendMessage(chat, { text: '📝 Réponds au message que tu veux corriger.' }); } catch (_) {}
        continue;
      }

      const words = targetText.split(' ');
      const corrected = words.map(w => {
        const clean = w.toLowerCase().replace(/[^a-zéèêëàâîôùûç]/g, '');
        return correctionMap[clean] || w;
      }).join(' ');

      if (corrected !== targetText) {
        try {
          await sock.sendMessage(chat, { text: `✏️ *Correction:*\n\n~~${targetText}~~\n✅ ${corrected}` });
          log.info(`Texte corrigé: "${targetText.slice(0, 30)}" → "${corrected.slice(0, 30)}"`);
        } catch (_) {}
      } else {
        try { await sock.sendMessage(chat, { text: '✅ Ce message semble correct.' }); } catch (_) {}
      }
    }
  });

  log.info('Module fix actif (Auto-Fix v2.0 réel)');
}
