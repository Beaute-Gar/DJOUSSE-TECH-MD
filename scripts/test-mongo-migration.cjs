'use strict';
/**
 * test-mongo-migration.cjs — Test de la migration MongoDB.
 *
 * Vérifie :
 *   1. Connexion MongoDB
 *   2. Auth state Baileys
 *   3. Account manager
 *   4. Isolation multi-comptes
 *   5. Concurrence (4 comptes simultanés)
 */

require('dotenv').config();

const { connectMongo, getCollection, checkMongoHealth, closeMongo, COLLECTIONS } = require('../src/services/mongodb.cjs');
const { useMongoAuthState, useMongoAuthStateForAccount, getAccountDB, clearAccountSession } = require('../src/services/mongo-auth.cjs');

function log(msg) { console.log(`[TEST] ${msg}`); }
function pass(msg) { console.log(`✅ PASS: ${msg}`); }
function fail(msg) { console.log(`❌ FAIL: ${msg}`); process.exitCode = 1; }

async function testMongoConnection() {
  log('--- Test 1: Connexion MongoDB ---');
  try {
    const health = await checkMongoHealth();
    if (health.status === 'online' && health.ok) {
      pass('MongoDB connecté');
    } else {
      fail(`MongoDB status: ${health.status}`);
    }
  } catch (e) {
    fail(`Connexion MongoDB: ${e.message}`);
  }
}

async function testCollections() {
  log('--- Test 2: Collections MongoDB ---');
  try {
    const accounts = await getCollection(COLLECTIONS.ACCOUNTS);
    const sessions = await getCollection(COLLECTIONS.SESSIONS);
    const pairing = await getCollection(COLLECTIONS.PAIRING);

    pass(`Collections accessibles: ${COLLECTIONS.ACCOUNTS}, ${COLLECTIONS.SESSIONS}, ${COLLECTIONS.PAIRING}`);
  } catch (e) {
    fail(`Collections: ${e.message}`);
  }
}

async function testAccountDB() {
  log('--- Test 3: Account DB (wrapper MongoDB) ---');
  try {
    const db = await getAccountDB();
    if (!db) {
      fail('Account DB null');
      return;
    }

    // Test INSERT
    const testId = 'test_' + Date.now();
    await db.run(
      'INSERT INTO wa_accounts (id, nom, prenom, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      testId, 'Test', 'User', testId, 'pending', Date.now()
    );

    // Test SELECT
    const row = await db.get('SELECT * FROM wa_accounts WHERE id = ?', testId);
    if (row && row.id === testId) {
      pass('Account INSERT/SELECT fonctionne');
    } else {
      fail('Account INSERT/SELECT échoué');
    }

    // Test COUNT
    const count = await db.get('SELECT COUNT(*) AS n FROM wa_accounts');
    if (count && typeof count.n === 'number') {
      pass(`Account COUNT: ${count.n} comptes`);
    } else {
      fail('Account COUNT échoué');
    }

    // Test UPDATE
    await db.run('UPDATE wa_accounts SET status = ? WHERE id = ?', 'active', testId);
    const updated = await db.get('SELECT * FROM wa_accounts WHERE id = ?', testId);
    if (updated && updated.status === 'active') {
      pass('Account UPDATE fonctionne');
    } else {
      fail('Account UPDATE échoué');
    }

    // Test DELETE
    await db.run('DELETE FROM wa_accounts WHERE id = ?', testId);
    const deleted = await db.get('SELECT * FROM wa_accounts WHERE id = ?', testId);
    if (!deleted) {
      pass('Account DELETE fonctionne');
    } else {
      fail('Account DELETE échoué');
    }

  } catch (e) {
    fail(`Account DB: ${e.message}`);
  }
}

async function testAuthState() {
  log('--- Test 4: Auth State Baileys ---');
  try {
    const { state, saveCreds } = await useMongoAuthState();
    if (state && state.creds) {
      pass('Auth state Baileys créé');
    } else {
      fail('Auth state null');
    }
  } catch (e) {
    fail(`Auth state: ${e.message}`);
  }
}

async function testMultiAccountIsolation() {
  log('--- Test 5: Isolation multi-comptes ---');
  const testAccounts = ['account_A', 'account_B', 'account_C', 'account_D'];

  try {
    // Créer les auth states pour chaque compte
    const authStates = {};
    for (const accId of testAccounts) {
      authStates[accId] = await useMongoAuthStateForAccount(accId);
    }

    // Vérifier que chaque compte a son propre auth state
    for (const accId of testAccounts) {
      if (authStates[accId].state && authStates[accId].state.creds) {
        pass(`Auth state compte #${accId} créé`);
      } else {
        fail(`Auth state compte #${accId} null`);
      }
    }

    // Nettoyer les sessions de test
    for (const accId of testAccounts) {
      await clearAccountSession(accId);
    }
    pass('Nettoyage multi-comptes terminé');

  } catch (e) {
    fail(`Isolation multi-comptes: ${e.message}`);
  }
}

async function testConcurrentOperations() {
  log('--- Test 6: Opérations concurrentes (4 comptes simultanés) ---');
  const testAccounts = ['concurrent_A', 'concurrent_B', 'concurrent_C', 'concurrent_D'];

  try {
    // Créer 4 auth states simultanément
    const promises = testAccounts.map(accId => useMongoAuthStateForAccount(accId));
    const results = await Promise.all(promises);

    let successCount = 0;
    for (let i = 0; i < testAccounts.length; i++) {
      if (results[i].state && results[i].state.creds) {
        successCount++;
      }
    }

    if (successCount === testAccounts.length) {
      pass(`${successCount}/${testAccounts.length} auth states concurrents créés`);
    } else {
      fail(`${successCount}/${testAccounts.length} auth states concurrents créés`);
    }

    // Nettoyer
    for (const accId of testAccounts) {
      await clearAccountSession(accId);
    }
    pass('Nettoyage concurrent terminé');

  } catch (e) {
    fail(`Opérations concurrentes: ${e.message}`);
  }
}

async function testPostgreSQLRemoval() {
  log('--- Test 7: Vérification suppression PostgreSQL ---');
  try {
    const fs = require('fs');
    const path = require('path');

    // Vérifier que pg-auth.cjs n'existe plus
    const pgAuthPath = path.join(__dirname, '../src/services/pg-auth.cjs');
    if (!fs.existsSync(pgAuthPath)) {
      pass('pg-auth.cjs supprimé');
    } else {
      fail('pg-auth.cjs existe encore');
    }

    // Vérifier que export-session.cjs n'existe plus
    const exportPath = path.join(__dirname, 'export-session.cjs');
    if (!fs.existsSync(exportPath)) {
      pass('export-session.cjs supprimé');
    } else {
      fail('export-session.cjs existe encore');
    }

    // Vérifier que package.json n'a plus pg
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    if (!pkg.dependencies.pg) {
      pass('pg supprimé de package.json');
    } else {
      fail('pg existe encore dans package.json');
    }

    // Vérifier que mongodb est présent
    if (pkg.dependencies.mongodb) {
      pass(`mongodb ${pkg.dependencies.mongodb} présent dans package.json`);
    } else {
      fail('mongodb absent de package.json');
    }

  } catch (e) {
    fail(`Vérification suppression: ${e.message}`);
  }
}

async function runAllTests() {
  log('=== DÉBUT DES TESTS DE MIGRATION MONGODB ===');
  log('');

  await testMongoConnection();
  await testCollections();
  await testAccountDB();
  await testAuthState();
  await testMultiAccountIsolation();
  await testConcurrentOperations();
  await testPostgreSQLRemoval();

  log('');
  log('=== FIN DES TESTS DE MIGRATION MONGODB ===');

  // Fermer la connexion MongoDB proprement
  await closeMongo();
  log('Connexion MongoDB fermée');
}

runAllTests().catch(e => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
