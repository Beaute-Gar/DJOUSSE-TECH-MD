import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');

export const name = 'about';
export const aliases = ['info', 'botinfo', 'status'];
export const description = 'À propos du bot';
export const category = 'general';
export const level = 'user';
export const cooldown = 10;

export async function handler(sock, m, { reply, jid }) {
  const owner = config?.OWNER_NUMBER || global.__sessionOwnerNumber || '';
  return reply(
    `🤖 *DJOUSSE-TECH MD — v2.0*\n\n` +
    `🧠 *Moteur:* Cognitive OS\n` +
    `📡 *Multi-agent:* Orchestrateur + Executive + Research + Communication + Learning\n` +
    `🔒 *Gouvernance:* Trust, Safety, Audit, Approvals\n` +
    `🌐 *Dashboard:* djousse-tech.onrender.com\n\n` +
    `👑 *Propriétaire:* ${owner}\n` +
    `💬 *Contact:* wa.me/${owner}\n\n` +
    `_Tape .menu pour la liste des commandes_`
  );
}
