import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('MINUTES');

let enabled = false, listener = null;
const chatBuffer = new Map();

export function enableAutoMinutes(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key.remoteJid; if (!jid) continue;
      if (!chatBuffer.has(jid)) chatBuffer.set(jid, []);
      const arr = chatBuffer.get(jid);
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      arr.push({ sender: msg.key.participant || jid, text, ts: Date.now() });
      if (arr.length > 500) arr.splice(0, arr.length - 500);
      const lower = text.toLowerCase();
      if (!/(compte rendu|compte-rendu|résumé réunion|minutes|résumé|synthèse)/i.test(lower)) continue;
      const recent = arr.filter(e => Date.now() - e.ts < 86400000);
      if (recent.length < 3) return sock.sendMessage(jid, { text: '📋 Pas assez de messages récents pour faire un compte-rendu.' });
      const decisions = recent.filter(e => /décidé|validé|approuvé|confirmé/i.test(e.text));
      const tasks = recent.filter(e => /(il faut|on doit|tâche|action|faire|préparer|envoyer|contacter)/i.test(e.text));
      const nextSteps = recent.filter(e => /(prochaine|prochain|suivant|next|rendez-vous|rdv|réunion le)/i.test(e.text));
      let report = `📋 *COMPTE-RENDU DE RÉUNION*\n📅 ${new Date().toLocaleDateString('fr-FR')}\n\n👥 ${recent.length} messages analysés\n\n`;
      if (decisions.length) { report += '✅ *DÉCISIONS PRISES*\n'; decisions.slice(-5).forEach(d => report += `  • ${d.text.substring(0, 200)}\n`); report += '\n'; }
      if (tasks.length) { report += '📝 *TÂCHES À FAIRE*\n'; tasks.slice(-5).forEach(t => report += `  • ${t.text.substring(0, 200)}\n`); report += '\n'; }
      if (nextSteps.length) { report += '📅 *PROCHAINES ÉTAPES*\n'; nextSteps.slice(-3).forEach(n => report += `  • ${n.text.substring(0, 200)}\n`); report += '\n'; }
      if (!decisions.length && !tasks.length && !nextSteps.length) report += 'ℹ️ Aucune décision ou tâche détectée automatiquement.\n';
      sock.sendMessage(jid, { text: report });
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Compte-rendu automatique activé');
}

export function disableAutoMinutes(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isAutoMinutesOn() { return enabled; }
