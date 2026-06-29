import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GREEN = (t) => `\x1b[32m${t}\x1b[0m`;
const YELLOW = (t) => `\x1b[33m${t}\x1b[0m`;
const CYAN = (t) => `\x1b[36m${t}\x1b[0m`;
const BOLD = (t) => `\x1b[1m${t}\x1b[0m`;

function ok(msg) { console.log(`  ${GREEN('✅')} ${msg}`); }
function warn(msg) { console.log(`  ${YELLOW('⚠️')}  ${msg}`); }
function info(msg) { console.log(`  ${CYAN('ℹ️')}  ${msg}`); }

console.log('\n' + BOLD(CYAN('╔══════════════════════════════════════╗')));
console.log(BOLD(CYAN('║   DJOUSSE-TECH-MD — Setup Initial     ║')));
console.log(BOLD(CYAN('║   Djousse Tech Evolution               ║')));
console.log(BOLD(CYAN('╚══════════════════════════════════════╝\n')));

const dirs = ['data', 'mydata', 'session', 'src/commands', 'src/core', 'src/lib', 'src/modules/groups', 'src/security', 'scripts'];
console.log(BOLD('📁 Création des dossiers...\n'));
for (const dir of dirs) {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) { mkdirSync(full, { recursive: true }); ok(`Créé : ${dir}/`); }
  else { info(`Déjà existant : ${dir}/`); }
}

console.log('\n' + BOLD('⚙️  Configuration .env...\n'));
const envExample = path.join(ROOT, '.env.example');
const envTarget = path.join(ROOT, '.env');
if (!existsSync(envTarget)) {
  if (existsSync(envExample)) { copyFileSync(envExample, envTarget); ok('.env créé depuis .env.example'); warn('Ouvrez .env et renseignez OWNER_NUMBER et GEMINI_API_KEY'); }
  else {
    writeFileSync(envTarget, [
      '# DJOUSSE-TECH-MD — Configuration',
      'BOT_NAME="DJOUSSE-TECH-MD"',
      'COMPANY_NAME="Djousse Tech Evolution"',
      'OWNER_NAME="Beaute Gar"',
      'OWNER_NUMBER="237XXXXXXXXX"',
      'SUDO_NUMBER=""', 'PREFIX="."', 'MODE="public"',
      'ANTI_LINK="true"', 'ANTI_BOT="true"', 'ANTI_DELETE="true"', 'AUTO_REACT="true"', 'REJECT_CALLS="true"',
      'DB_TYPE="sqlite"', 'DB_PATH="./data/djousse.db"', 'GEMINI_API_KEY=""', 'PORT=3000',
      'RATE_LIMIT_MAX=10', 'RATE_LIMIT_WINDOW_MS=5000', 'LOG_LEVEL="info"', 'LOG_TO_FILE="true"', 'LOG_FILE="./data/bot.log"',
    ].join('\n'));
    ok('.env minimal créé');
    warn('Ouvrez .env et renseignez vos informations');
  }
} else { info('.env déjà existant — non modifié'); }

console.log('\n' + BOLD('🔒 Sécurité Git...\n'));
const gitignore = path.join(ROOT, '.gitignore');
if (!existsSync(gitignore)) {
  writeFileSync(gitignore, [
    '# Données sensibles', '.env', 'session/', '',
    '# Base de données', 'data/*.db', 'data/*.log', '',
    '# Logs', '*.log', 'bot-*.log', 'bot-error.txt', 'bot-output.txt', '',
    '# Node', 'node_modules/', 'npm-debug.log*', '',
    '# Temporaires', '.botx_temp/', 'cls', 'node', '*.tmp',
  ].join('\n'));
  ok('.gitignore créé');
} else { info('.gitignore déjà existant'); }

console.log('\n' + BOLD('🔍 Vérification environnement...\n'));
const [major] = process.versions.node.split('.').map(Number);
if (major >= 18) { ok(`Node.js v${process.versions.node} ✓`); }
else { console.log(`  ${RED('❌')} Node.js v${process.versions.node} — version 18+ requise`); process.exit(1); }

console.log('\n' + BOLD(CYAN('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')));
console.log(BOLD('  ✅ Setup terminé ! Prochaines étapes :'));
console.log(BOLD(CYAN('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')));
console.log(`  1. ${YELLOW('Ouvrez .env')} et renseignez OWNER_NUMBER et GEMINI_API_KEY`);
console.log(`\n  2. ${YELLOW('Installez les dépendances')} : npm install`);
console.log(`\n  3. ${YELLOW('Démarrez le bot')} : npm start`);
console.log(`\n  4. ${YELLOW('Ouvrez le navigateur')} : http://localhost:3000`);
console.log(`\n  5. ${YELLOW('Connectez WhatsApp')} : entrez votre numéro et le code de pairage\n`);
console.log(GREEN('  Bonne utilisation — Djousse Tech Evolution 🚀\n'));
