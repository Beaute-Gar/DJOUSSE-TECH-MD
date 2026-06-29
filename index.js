import 'dotenv/config';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = require('./config.cjs');

if (!config.OWNER_NUMBER) {
  console.error('[BOOT] OWNER_NUMBER non défini dans .env — arrêt.');
  process.exit(1);
}

import { createLogger } from './src/core/logger.js';
const log = createLogger('BOOT');

log.info(`╔══════════════════════════════════════╗`);
log.info(`║   ${config.BOT_NAME.padEnd(36)}║`);
log.info(`║   ${config.COMPANY_NAME.padEnd(36)}║`);
log.info(`╚══════════════════════════════════════╝`);

async function main() {
  try {
    const { initDB } = await import('./src/lib/database.js');
    await initDB();
    log.info('Base de données initialisée');

    const { startWebServer } = await import('./src/core/webserver.js');
    startWebServer(config.PORT);
    log.info(`Serveur web démarré sur le port ${config.PORT}`);

    const { startBot } = await import('./src/core/bot.js');
    await startBot();
  } catch (err) {
    log.error({ err }, 'Erreur fatale au démarrage');
    process.exit(1);
  }
}

process.on('SIGINT',  () => { log.info('SIGINT reçu — arrêt propre'); process.exit(0); });
process.on('SIGTERM', () => { log.info('SIGTERM reçu — arrêt propre'); process.exit(0); });
process.on('uncaughtException',  err => log.error({ err }, 'Exception non capturée'));
process.on('unhandledRejection', err => log.error({ err }, 'Promesse rejetée non gérée'));

main();
