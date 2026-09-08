const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'djousse.db');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

console.log('🔧 Repairing SQLite database...');

// Delete WAL/SHM files (they hold pending transactions causing I/O errors)
if (fs.existsSync(walPath)) { fs.unlinkSync(walPath); console.log('  Deleted WAL'); }
if (fs.existsSync(shmPath)) { fs.unlinkSync(shmPath); console.log('  Deleted SHM'); }

try {
  const db = new Database(dbPath);
  db.pragma('integrity_check');
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  console.log('✅ Database repaired');
} catch (e) {
  console.log('⚠️ Database corrupted, recreating...');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new Database(dbPath);
  db.close();
  console.log('✅ Fresh database created');
}
