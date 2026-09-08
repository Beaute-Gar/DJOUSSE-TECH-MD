import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('BIZDIR');

export function initBizDir() {
  rawRun(`CREATE TABLE IF NOT EXISTS business_directory (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL, description TEXT, category TEXT,
    tags TEXT, website TEXT, phone TEXT, email TEXT, address TEXT,
    verified INTEGER DEFAULT 0, rating REAL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`);
}

export function registerBusiness(jid, name, category, description, opts = {}) {
  initBizDir();
  try {
    rawRun('INSERT OR REPLACE INTO business_directory (jid, business_name, description, category, tags, website, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      jid, name, description || '', category || '', opts.tags || '', opts.website || '', opts.phone || '', opts.email || '', opts.address || '', Date.now(), Date.now());
    return { success: true, message: `"${name}" enregistré dans l'annuaire` };
  } catch (e) { return { success: false, message: e.message }; }
}

export function unregisterBusiness(jid) {
  rawRun('DELETE FROM business_directory WHERE jid = ?', jid);
  return { success: true };
}

export function searchDirectory(query) {
  initBizDir();
  const q = `%${query}%`;
  return rawAll('SELECT * FROM business_directory WHERE business_name LIKE ? OR description LIKE ? OR category LIKE ? OR tags LIKE ? ORDER BY verified DESC, rating DESC LIMIT 20',
    q, q, q, q);
}

export function listByCategory(category) {
  initBizDir();
  return rawAll('SELECT * FROM business_directory WHERE category = ? ORDER BY business_name', category);
}

export function listCategories() {
  initBizDir();
  return rawAll('SELECT category, COUNT(*) as count FROM business_directory GROUP BY category ORDER BY count DESC');
}

export function getBusiness(jid) {
  return rawGet('SELECT * FROM business_directory WHERE jid = ?', jid) || null;
}

export function rateBusiness(jid, rating) {
  const r = Math.max(1, Math.min(5, rating));
  rawRun('UPDATE business_directory SET rating = (rating + ?) / 2.0, updated_at = ? WHERE jid = ?', r, Date.now(), jid);
  return { success: true };
}
