import { createLogger } from '../../infrastructure/logger.js';
import { rawRun } from '../../infrastructure/database/database.js';
const log = createLogger('ACCOUNTCTRL');

export async function deleteUserData(jid) {
  const tables = [
    'vault', 'labels', 'preferences_npd', 'disappearing_prefs',
    'business_profile', 'transactions_cinetpay', 'abonnements_premium', 'wa_sessions'
  ];
  for (const table of tables) {
    try { rawRun(`DELETE FROM ${table} WHERE jid = ? OR user_id = ?`, jid, jid); } catch {}
  }
  log.info(`Données utilisateur supprimées pour ${jid}`);
  return { success: true, message: 'Toutes vos données ont été supprimées du système.' };
}

export async function resetAccount(jid, sock) {
  await deleteUserData(jid);
  try {
    const sessionDir = `./session_${jid.replace(/[^0-9]/g, '')}`;
    const fs = await import('fs/promises');
    await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
  } catch {}
  log.info(`Compte réinitialisé pour ${jid}`);
  return { success: true, message: 'Compte réinitialisé. Vous pouvez vous reconnecter.' };
}
