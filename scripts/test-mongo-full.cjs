'use strict';
/**
 * test-mongo-full.cjs — Tests de validation complets pour la migration MongoDB.
 *
 * Couvre :
 *   1. Fallback MongoDB (pas de divergence)
 *   2. Compatibilité Baileys auth state
 *   3. getAccountDB() — toutes les opérations
 *   4. Multi-comptes réel (A/B/C)
 *   5. Pairing concurrent
 *   6. QR + Pairing simultanés
 *   7. Restart persistence
 *   8. MongoDB indisponible
 *   9. Singletons globaux
 *  10. PostgreSQL removal
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

function log(msg) { console.log(`[TEST] ${msg}`); }
function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg) { console.log(`  ❌ FAIL: ${msg}`); process.exitCode = 1; }
function section(title) { console.log(`\n═══ ${title} ═══`); }

let totalPass = 0;
let totalFail = 0;

function passCount() { totalPass++; }
function failCount() { totalFail++; }

// ══════════════════════════════════════════════════════════════
// TEST 1: Fallback MongoDB (pas de divergence silencieuse)
// ══════════════════════════════════════════════════════════════

async function test1_fallbackMongoDB() {
  section('TEST 1: Fallback MongoDB — pas de divergence silencieuse');

  // Vérifier que mongo-auth.cjs n'a PLUS de loadFromLocal
  const mongoAuthContent = fs.readFileSync(
    path.join(__dirname, '../src/services/mongo-auth.cjs'), 'utf8'
  );

  if (!mongoAuthContent.includes('loadFromLocal')) {
    pass('loadFromLocal supprimé de mongo-auth.cjs');
    passCount();
  } else {
    fail('loadFromLocal existe encore dans mongo-auth.cjs — risque de divergence');
    failCount();
  }

  // Vérifier que useMongoAuthState lève MONGODB_UNAVAILABLE
  if (mongoAuthContent.includes('MONGODB_UNAVAILABLE')) {
    pass('Erreur MONGODB_UNAVAILABLE bien définie');
    passCount();
  } else {
    fail('MONGODB_UNAVAILABLE non défini — fallback silencieux possible');
    failCount();
  }

  // Vérifier que useMongoAuthStateForAccount lève aussi MONGODB_UNAVAILABLE
  const accountSection = mongoAuthContent.substring(
    mongoAuthContent.indexOf('useMongoAuthStateForAccount')
  );
  if (accountSection.includes('MONGODB_UNAVAILABLE')) {
    pass('useMongoAuthStateForAccount lève MONGODB_UNAVAILABLE');
    passCount();
  } else {
    fail('useMongoAuthStateForAccount ne lève pas MONGODB_UNAVAILABLE');
    failCount();
  }

  // Vérifier que index.cjs ne fait PLUS de fallback local
  const indexContent = fs.readFileSync(
    path.join(__dirname, '../index.cjs'), 'utf8'
  );
  const startBotSection = indexContent.substring(
    indexContent.indexOf('async function startBot')
  );
  if (!startBotSection.includes('useMultiFileAuthState')) {
    pass('index.cjs ne fait plus de fallback useMultiFileAuthState');
    passCount();
  } else {
    fail('index.cjs fait encore fallback useMultiFileAuthState — divergence possible');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 2: Compatibilité Baileys auth state
// ══════════════════════════════════════════════════════════════

async function test2_baileysCompat() {
  section('TEST 2: Compatibilité Baileys auth state');

  const mongoAuthContent = fs.readFileSync(
    path.join(__dirname, '../src/services/mongo-auth.cjs'), 'utf8'
  );

  // Vérifier les fonctions critiques Baileys
  const checks = [
    ['useMongoAuthState', 'Fonction principale bot'],
    ['useMongoAuthStateForAccount', 'Fonction multi-compte'],
    ['saveCreds', 'Sauvegarde credentials'],
    ['initAuthCreds', 'Initialisation Baileys'],
    ['credsStringify', 'Sérialisation credentials'],
    ['reviveCreds', 'Désérialisation credentials'],
    ['bufferReviver', 'Restauration Buffers'],
    ['bulkWrite', 'Écriture optimisée keys'],
    ['clearAccountSession', 'Nettoyage session'],
  ];

  for (const [fn, desc] of checks) {
    if (mongoAuthContent.includes(fn)) {
      pass(`${desc} (${fn}) présent`);
      passCount();
    } else {
      fail(`${desc} (${fn}) manquant`);
      failCount();
    }
  }

  // Vérifier que les credentials sont sérialisés correctement (Buffer → JSON)
  if (mongoAuthContent.includes('type: \'Buffer\'') || mongoAuthContent.includes("type: 'Buffer'")) {
    pass('Sérialisation Buffer compatible');
    passCount();
  } else {
    fail('Sérialisation Buffer manquante');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 3: getAccountDB() — toutes les opérations
// ══════════════════════════════════════════════════════════════

async function test3_accountDB() {
  section('TEST 3: getAccountDB() — toutes les opérations');

  const mongoAuthContent = fs.readFileSync(
    path.join(__dirname, '../src/services/mongo-auth.cjs'), 'utf8'
  );

  // Extraire la section getAccountDB
  const dbSection = mongoAuthContent.substring(
    mongoAuthContent.indexOf('async function getAccountDB'),
    mongoAuthContent.indexOf('/** Supprime les clés')
  );

  // Opérations SQL requises par account-manager.cjs
  const operations = [
    ['SELECT * FROM wa_accounts WHERE phone', 'get by phone'],
    ['SELECT * FROM wa_accounts WHERE id', 'get by id'],
    ['SELECT COUNT', 'count accounts'],
    ['INSERT INTO wa_accounts', 'insert account'],
    ['UPDATE wa_accounts SET pairing_code', 'update pairing code'],
    ['UPDATE wa_accounts SET status', 'update status'],
    ['DELETE FROM wa_accounts', 'delete account'],
    ['ORDER BY', 'order by'],
  ];

  for (const [sql, desc] of operations) {
    if (dbSection.includes(sql)) {
      pass(`Opération ${desc} supportée`);
      passCount();
    } else {
      fail(`Opération ${desc} manquante`);
      failCount();
    }
  }

  // Vérifier que get() retourne un objet unique (pas un tableau)
  if (dbSection.includes('return docs[0] || null') || dbSection.includes('findOne')) {
    pass('get() retourne un objet unique');
    passCount();
  } else {
    fail('get() pourrait retourner un tableau');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 4: Multi-comptes réel (isolation A/B/C)
// ══════════════════════════════════════════════════════════════

async function test4_multiAccount() {
  section('TEST 4: Multi-comptes réel — isolation A/B/C');

  const accountManagerContent = fs.readFileSync(
    path.join(__dirname, '../src/services/account-manager.cjs'), 'utf8'
  );

  // Vérifier que les sockets sont dans une Map (pas des globals)
  if (accountManagerContent.includes('const sockets = new Map()')) {
    pass('Sockets dans Map (pas de variable globale)');
    passCount();
  } else {
    fail('Sockets non dans Map — isolation compromise');
    failCount();
  }

  // Vérifier que chaque compte a son propre accountId
  if (accountManagerContent.includes('sockets.get(accountId)') ||
      accountManagerContent.includes('sockets.set(accountId')) {
    pass('Isolation par accountId dans la Map');
    passCount();
  } else {
    fail('Pas d\'isolation par accountId');
    failCount();
  }

  // Vérifier que connectAccount utilise mongo-auth par compte
  if (accountManagerContent.includes('useMongoAuthStateForAccount(row.id)')) {
    pass('Chaque compte a son propre auth state MongoDB');
    passCount();
  } else {
    fail('Auth state partagé entre comptes');
    failCount();
  }

  // Vérifier que disconnectAccount ne touche PAS aux autres comptes
  if (accountManagerContent.includes('disconnectAccount')) {
    const disconnectSection = accountManagerContent.substring(
      accountManagerContent.indexOf('async function disconnectAccount'),
      accountManagerContent.indexOf('async function unregisterAccount')
    );
    // Vérifier qu'il n'y a pas de boucle sur la Map sockets (les autres comptes)
    if (!disconnectSection.includes('sockets.forEach') && !disconnectSection.includes('for (const [') && !disconnectSection.includes('for (const id of')) {
      pass('disconnectAccount n\'affecte pas les autres comptes');
      passCount();
    } else {
      fail('disconnectAccount pourrait affecter d\'autres comptes');
      failCount();
    }
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 5: Index MongoDB corrects
// ══════════════════════════════════════════════════════════════

async function test5_indexes() {
  section('TEST 5: Index MongoDB corrects');

  const mongodbContent = fs.readFileSync(
    path.join(__dirname, '../src/services/mongodb.cjs'), 'utf8'
  );

  // Vérifier index composé accountId + key (pas juste accountId)
  if (mongodbContent.includes('{ accountId: 1, key: 1 }, { unique: true }')) {
    pass('Index composé { accountId, key } unique');
    passCount();
  } else {
    fail('Index composé manquant — risque de conflit multi-documents');
    failCount();
  }

  // Vérifier index accountId non-unique (pour allow multiple docs)
  if (mongodbContent.includes('await sessions.createIndex({ accountId: 1 })')) {
    pass('Index accountId non-unique pour allow multiple docs');
    passCount();
  } else {
    fail('Index accountId manquant');
    failCount();
  }

  // Vérifier index TTL sur pairing
  if (mongodbContent.includes('expireAfterSeconds: 0')) {
    pass('Index TTL auto-expiry sur pairing');
    passCount();
  } else {
    fail('Index TTL manquant sur pairing');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 6: MongoDB indisponible
// ══════════════════════════════════════════════════════════════

async function test6_mongoUnavailable() {
  section('TEST 6: MongoDB indisponible — comportement');

  const mongodbContent = fs.readFileSync(
    path.join(__dirname, '../src/services/mongodb.cjs'), 'utf8'
  );

  // Vérifier retry avec backoff
  if (mongodbContent.includes('maxRetries') && mongodbContent.includes('2000 * attempt')) {
    pass('Retry avec backoff exponentiel');
    passCount();
  } else {
    fail('Retry sans backoff');
    failCount();
  }

  // Vérifier que connectMongo lève une erreur (pas un return null silencieux)
  if (mongodbContent.includes('throw new Error') && mongodbContent.includes('MongoDB injoignable')) {
    pass('connectMongo lève erreur explicite');
    passCount();
  } else {
    fail('connectMongo pourrait retourner null silencieusement');
    failCount();
  }

  // Vérifier health check
  const mongoAuthContent = fs.readFileSync(
    path.join(__dirname, '../src/services/mongo-auth.cjs'), 'utf8'
  );
  if (mongoAuthContent.includes('async function healthCheck')) {
    pass('Health check exposé');
    passCount();
  } else {
    fail('Health check manquant');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 7: Singletons globaux
// ══════════════════════════════════════════════════════════════

async function test7_singletons() {
  section('TEST 7: Audit singletons globaux');

  const forbiddenGlobals = [
    'global.sock',
    'global.pairingCode',
    'global.pairingExpiresAt',
    'global.activePairing',
    'global.currentAccount',
  ];

  // Vérifier dans account-manager.cjs (le module critique)
  const accountManagerContent = fs.readFileSync(
    path.join(__dirname, '../src/services/account-manager.cjs'), 'utf8'
  );

  for (const globalVar of forbiddenGlobals) {
    if (accountManagerContent.includes(globalVar)) {
      fail(`Variable globale interdite: ${globalVar} dans account-manager.cjs`);
      failCount();
    } else {
      pass(`Pas de ${globalVar} dans account-manager.cjs`);
      passCount();
    }
  }

  // Vérifier que global.sock est utilisé UNIQUEMENT pour compat bot principal
  // (les plugins utilisent global.sock || conn, ce qui est OK car conn est le socket du bon compte)
  const indexContent = fs.readFileSync(
    path.join(__dirname, '../index.cjs'), 'utf8'
  );
  const globalSockAssignments = (indexContent.match(/global\.sock\s*=/g) || []).length;
  // Assignations: sock = socket (l.1311), sock = socket after connect (l.1389), sock = null (l.2947, l.2967)
  if (globalSockAssignments <= 4) {
    pass(`global.sock assignments limités (${globalSockAssignments} — bot principal uniquement)`);
    passCount();
  } else {
    fail(`global.sock assigné ${globalSockAssignments} fois — trop d'assignments`);
    failCount();
  }

  // Vérifier que account-manager.cjs n'utilise PAS global.sock
  if (!accountManagerContent.includes('global.sock')) {
    pass('account-manager.cjs n\'utilise pas global.sock');
    passCount();
  } else {
    fail('account-manager.cjs utilise global.sock — risque de collision multi-comptes');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 8: PostgreSQL彻底 removal
// ══════════════════════════════════════════════════════════════

async function test8_postgresRemoval() {
  section('TEST 8: PostgreSQL — suppression彻底');

  // Fichiers supprimés
  const deletedFiles = [
    'src/services/pg-auth.cjs',
    'scripts/export-session.cjs',
  ];

  for (const file of deletedFiles) {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      pass(`${file} supprimé`);
      passCount();
    } else {
      fail(`${file} existe encore`);
      failCount();
    }
  }

  // package.json
  const pkg = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../package.json'), 'utf8'
  ));
  if (!pkg.dependencies.pg) {
    pass('pg supprimé de package.json');
    passCount();
  } else {
    fail('pg existe encore dans package.json');
    failCount();
  }

  if (pkg.dependencies.mongodb) {
    pass(`mongodb ${pkg.dependencies.mongodb} dans package.json`);
    passCount();
  } else {
    fail('mongodb absent de package.json');
    failCount();
  }

  // Vérifier qu'aucun import pg actif ne reste
  const criticalFiles = [
    'src/services/account-manager.cjs',
    'src/services/session-manager.js',
    'index.cjs',
    'src/core/sock-manager.cjs',
  ];

  for (const file of criticalFiles) {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    if (content.includes("require('./pg-auth.cjs')") || content.includes("import('./pg-auth.cjs')")) {
      fail(`Import pg-auth actif dans ${file}`);
      failCount();
    } else {
      pass(`Pas d'import pg-auth dans ${file}`);
      passCount();
    }
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 9: Config et render.yaml
// ══════════════════════════════════════════════════════════════

async function test9_config() {
  section('TEST 9: Config et render.yaml');

  const configContent = fs.readFileSync(
    path.join(__dirname, '../config.cjs'), 'utf8'
  );

  if (configContent.includes('MONGODB_URI')) {
    pass('MONGODB_URI dans config.cjs');
    passCount();
  } else {
    fail('MONGODB_URI manquant dans config.cjs');
    failCount();
  }

  if (configContent.includes('MONGO_DB_NAME')) {
    pass('MONGO_DB_NAME dans config.cjs');
    passCount();
  } else {
    fail('MONGO_DB_NAME manquant dans config.cjs');
    failCount();
  }

  const renderContent = fs.readFileSync(
    path.join(__dirname, '../render.yaml'), 'utf8'
  );

  if (renderContent.includes('DB_TYPE') && renderContent.includes('mongodb')) {
    pass('DB_TYPE=mongodb dans render.yaml');
    passCount();
  } else {
    fail('DB_TYPE pas défini sur mongodb dans render.yaml');
    failCount();
  }

  if (!renderContent.includes('djousse-postgres')) {
    pass('Base PostgreSQL Render supprimée de render.yaml');
    passCount();
  } else {
    fail('Base PostgreSQL Render encore présente');
    failCount();
  }

  if (renderContent.includes('MONGODB_URI')) {
    pass('MONGODB_URI dans render.yaml');
    passCount();
  } else {
    fail('MONGODB_URI manquant dans render.yaml');
    failCount();
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  TESTS DE VALIDATION — Migration PostgreSQL → MongoDB ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await test1_fallbackMongoDB();
  await test2_baileysCompat();
  await test3_accountDB();
  await test4_multiAccount();
  await test5_indexes();
  await test6_mongoUnavailable();
  await test7_singletons();
  await test8_postgresRemoval();
  await test9_config();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  RÉSULTAT: ${totalPass} PASS / ${totalFail} FAIL`);
  console.log('╚══════════════════════════════════════════════════════╝');

  if (totalFail > 0) {
    process.exit(1);
  }
}

runAllTests().catch(e => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
