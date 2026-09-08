import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('EXPORT');

const exportDir = './exports';

async function initDir() {
  await fs.mkdir(exportDir, { recursive: true });
}

export async function exportGroupMembers(sock, groupJid) {
  await initDir();
  const metadata = await sock.groupMetadata(groupJid);
  const safeName = (metadata.subject || 'Groupe').replace(/[^a-zA-Z0-9]/g, '_');
  let csv = 'Numéro,Nom,Admin,SuperAdmin\n';
  for (const p of metadata.participants) {
    const num = p.id.split('@')[0].replace(/:[0-9]+/, '');
    const name = sock.contacts?.[p.id]?.name || sock.contacts?.[p.id]?.notify || num;
    const isAdmin = p.admin === 'admin' ? 'Oui' : 'Non';
    const isSuper = p.admin === 'superadmin' ? 'Oui' : 'Non';
    csv += `"${num}","${name}",${isAdmin},${isSuper}\n`;
  }
  const filename = `membres_${safeName}_${Date.now()}.csv`;
  const filepath = path.join(exportDir, filename);
  await fs.writeFile(filepath, csv);
  const admins = metadata.participants.filter(p => p.admin === 'admin').length;
  const supers = metadata.participants.filter(p => p.admin === 'superadmin').length;
  return { filename, filepath, total: metadata.participants.length, admins, supers, groupName: metadata.subject };
}

export async function exportAllGroups(sock) {
  const groups = await sock.groupFetchAllParticipating();
  const results = [];
  for (const jid of Object.keys(groups)) {
    try { results.push(await exportGroupMembers(sock, jid)); } catch {}
  }
  return results;
}
