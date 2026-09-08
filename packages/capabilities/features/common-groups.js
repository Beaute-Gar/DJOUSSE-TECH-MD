import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('COMMON');

export async function findCommonGroups(sock, targetJid) {
  const groups = await sock.groupFetchAllParticipating();
  const common = [];
  const cleanTarget = targetJid.replace(/:[0-9]+@/, '@');
  for (const [gid, group] of Object.entries(groups)) {
    const member = group.participants.find(p => p.id.replace(/:[0-9]+@/, '@') === cleanTarget);
    if (member) {
      common.push({ id: gid, name: group.subject || 'Sans nom', members: group.participants.length, isAdmin: !!member.admin });
    }
  }
  return common;
}
