/* scripts/status-likes-capture.cjs
   Génère une capture (rapport) des contacts dont les statuts ont été
   likés, sur le bureau de l'utilisateur.
   Usage : node scripts/status-likes-capture.cjs
   Source : data/status-likes.json (journal maintenu par status-likes-log.cjs)
   Noms enrichis depuis la table contacts_reels (djousse.db). */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JOURNAL = path.join(ROOT, 'data', 'status-likes.json');
const DESKTOP = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, 'Desktop')
  : require('os').homedir();

function loadJournal() {
  try {
    if (fs.existsSync(JOURNAL)) return JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
  } catch (e) {}
  return [];
}

/* Charge un mapping numero -> nom depuis contacts_reels (sql.js). */
function loadContactNames() {
  const names = new Map();
  try {
    const config = require(path.join(ROOT, 'config.cjs'));
    const DB_FILE = path.resolve(config.DB_PATH || './data/djousse.db');
    if (fs.existsSync(DB_FILE) && !process.env.DATABASE_URL) {
      const initSqlJs = require('sql.js');
      const SQL = initSqlJs({ locateFile: (f) => require.resolve('sql.js/dist/' + f) });
      const db = new SQL.Database(fs.readFileSync(DB_FILE));
      const res = db.exec('SELECT numero, nom FROM contacts_reels');
      if (res.length && res[0].values) {
        for (const row of res[0].values) {
          const num = String(row[0] || '').replace(/\D/g, '');
          if (num) names.set(num, String(row[1] || ''));
        }
      }
      db.close();
    }
  } catch (e) {}
  return names;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

const TITLES = {
  txt: '📱 CONTACTS DONT LES STATUTS ONT ÉTÉ LIKÉS',
  html: 'Contacts dont les statuts ont été likés',
};

function buildTxt(entries, names) {
  const lines = [];
  lines.push('═'.repeat(50));
  lines.push('  ' + TITLES.txt);
  lines.push('  Généré le ' + fmtDate(new Date().toISOString()));
  lines.push('═'.repeat(50));
  lines.push('');

  if (!entries.length) {
    lines.push('(Aucun statut liké enregistré pour le moment.)');
    return lines.join('\n');
  }

  lines.push('📊 TOTAL : ' + entries.length + ' like(s)');
  lines.push('');

  const byContact = new Map();
  for (const e of entries) {
    const key = e.phone || 'inconnu';
    if (!byContact.has(key)) byContact.set(key, { phone: key, emojis: [], times: [], name: e.name || names.get(key) || '' });
    const c = byContact.get(key);
    c.emojis.push(e.emoji || '❤️');
    c.times.push(e.at);
  }

  let i = 0;
  for (const [key, c] of byContact) {
    i++;
    const label = c.name ? `${c.name} (${c.phone})` : key;
    lines.push(`${String(i).padStart(3)}. ${label}`);
    lines.push(`     Likes : ${c.emojis.join(' ')}`);
    lines.push(`     Dernier : ${fmtDate(c.times[c.times.length - 1])}`);
    lines.push('');
  }

  lines.push('─'.repeat(50));
  lines.push('Généré par DJOUSSE-TECH-MD · ' + entries.length + ' enregistrements');
  return lines.join('\n');
}

function buildHtml(entries, names) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byContact = new Map();
  for (const e of entries) {
    const key = e.phone || 'inconnu';
    if (!byContact.has(key)) byContact.set(key, { phone: key, emojis: [], times: [], name: e.name || names.get(key) || '' });
    const c = byContact.get(key);
    c.emojis.push(e.emoji || '❤️');
    c.times.push(e.at);
  }

  const rows = [];
  let i = 0;
  for (const [, c] of byContact) {
    i++;
    const label = c.name ? `${esc(c.name)} <small>(${esc(c.phone)})</small>` : esc(c.phone);
    const last = fmtDate(c.times[c.times.length - 1]);
    rows.push(`<tr><td>${i}</td><td>${label}</td><td class="em">${esc(c.emojis.join(' '))}</td><td>${esc(last)}</td></tr>`);
  }

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${TITLES.html}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background: radial-gradient(1200px 600px at 80% -10%, #0e2a4a 0%, transparent 60%), #050a12;
         color:#c9d8ea; font-family:'Segoe UI',system-ui,sans-serif; min-height:100vh; padding:28px; }
  h1 { color:#fff; font-size:20px; margin-bottom:4px; letter-spacing:.5px; }
  .sub { color:#5f7a99; font-size:13px; margin-bottom:20px; }
  .card { background:linear-gradient(180deg,#0d1830 0%,#0b1424 100%); border:1px solid #12233c;
          border-radius:14px; padding:20px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { color:#5f7a99; text-align:left; padding:10px 8px; border-bottom:1px solid #12233c; font-size:12px;
       text-transform:uppercase; letter-spacing:1px; }
  td { padding:10px 8px; border-bottom:1px solid #0f1d33; }
  td:first-child { color:#5f7a99; width:34px; }
  .em { font-size:16px; letter-spacing:2px; }
  .badge { display:inline-block; padding:3px 12px; border-radius:999px; background:#00c8ff22; color:#00c8ff;
           font-size:12px; font-weight:700; margin-bottom:14px; }
  .empty { color:#5f7a99; padding:20px 0; text-align:center; }
</style></head>
<body>
  <h1>👥 ${TITLES.html}</h1>
  <div class="sub">Rapport généré le ${fmtDate(new Date().toISOString())} par DJOUSSE-TECH-MD</div>
  <div class="card">
    <span class="badge">📊 ${entries.length} like(s)</span>
    ${rows.length ? `<table><thead><tr><th>#</th><th>Contact</th><th>Emojis</th><th>Dernier like</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : '<div class="empty">Aucun statut liké enregistré pour le moment.</div>'}
  </div>
</body></html>`;
}

function main() {
  const entries = loadJournal();
  const names = loadContactNames();

  const txt = buildTxt(entries, names);
  const html = buildHtml(entries, names);

  const stamp = new Date().toISOString().slice(0, 10);
  const txtPath = path.join(DESKTOP, `statuts-likes-${stamp}.txt`);
  const htmlPath = path.join(DESKTOP, `statuts-likes-${stamp}.html`);

  fs.writeFileSync(txtPath, txt, 'utf8');
  fs.writeFileSync(htmlPath, html, 'utf8');

  console.log('📁 Capture générée sur le bureau :');
  console.log('   ' + txtPath);
  console.log('   ' + htmlPath);
  console.log('📊 Likes enregistrés : ' + entries.length);
}

main();