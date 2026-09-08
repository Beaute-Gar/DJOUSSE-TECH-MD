import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('BIZPROFILE');

export async function initBusinessProfile() {
  rawRun(`CREATE TABLE IF NOT EXISTS business_profile (
    jid TEXT PRIMARY KEY, name TEXT, description TEXT, category TEXT,
    website TEXT, email TEXT, phone TEXT, address TEXT, hours TEXT,
    updated_at INTEGER NOT NULL
  )`);
}

export async function setBusinessProfile(jid, data) {
  await initBusinessProfile();
  rawRun('INSERT OR REPLACE INTO business_profile (jid, name, description, category, website, email, phone, address, hours, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    jid, data.name || '', data.description || '', data.category || '', data.website || '', data.email || '', data.phone || '', data.address || '', data.hours || '', Date.now());
  log.info(`Business profile mis à jour pour ${jid}`);
  return { success: true };
}

export function getBusinessProfile(jid) {
  return rawGet('SELECT * FROM business_profile WHERE jid = ?', jid) || null;
}

export function listBusinessProfiles(category) {
  if (category) return rawAll('SELECT * FROM business_profile WHERE category = ? ORDER BY name', category);
  return rawAll('SELECT * FROM business_profile ORDER BY name');
}

export function searchBusinessProfiles(query) {
  const q = `%${query}%`;
  return rawAll('SELECT * FROM business_profile WHERE name LIKE ? OR description LIKE ? OR category LIKE ? LIMIT 20', q, q, q);
}

export function deleteBusinessProfile(jid) {
  rawRun('DELETE FROM business_profile WHERE jid = ?', jid);
  return { success: true };
}
