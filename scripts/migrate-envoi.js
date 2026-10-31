'use strict';
/**
 * scripts/migrate-envoi.js — MIGRATION DU CONTRÔLE D'ENVOI
 * ────────────────────────────────────────────────────────────────────
 * Crée (ou met à jour) les tables du contrôle d'envoi dans la base
 * locale data/bot.db :
 *
 *   envoi_consentement   opt-in horodaté, numéros en HMAC uniquement
 *   envoi_journal        journal chaîné (immuable par vérification)
 *   envoi_etat           sel HMAC, mode dégradé, pauses, purge
 *
 * Idempotent : `CREATE TABLE IF NOT EXISTS`, rien n'est écrasé. À lancer
 * une fois après déploiement, ou à chaque montée de version du schéma.
 *
 * Usage :
 *   node scripts/migrate-envoi.js
 *   node scripts/migrate-envoi.js --proprietaire +2376XXXXXXXX
 *   node scripts/migrate-envoi.js --purger 180
 *   node scripts/migrate-envoi.js --verifier
 */

const path = require('path');
const store = require(path.join(__dirname, '..', 'src', 'lib', 'envoi', 'store'));
const envoi = require(path.join(__dirname, '..', 'src', 'lib', 'envoi'));

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : null;
};
const a = (nom) => args.includes(nom);

function principal() {
  console.log('[MIGRATION] base :', require(path.join(__dirname, '..', 'src', 'lib', 'dataDir')).DATA_DIR);

  store.assurer();
  if (!store.persistant()) {
    console.error('[MIGRATION] node:sqlite indisponible (Node < 22.5) — rien à migrer.');
    process.exitCode = 1;
    return;
  }

  const db = require(path.join(__dirname, '..', 'src', 'lib', 'db')).conn();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'envoi_%' ORDER BY name").all();
  console.log(`[MIGRATION] ${tables.length} table(s) : ${tables.map((t) => t.name).join(', ')}`);

  const proprietaire = option('--proprietaire');
  if (proprietaire) {
    const n = envoi.amorcerProprietaires(String(proprietaire).split(','));
    console.log(`[MIGRATION] propriétaire(s) consenti(s) : ${n}`);
  }

  if (a('--purger')) {
    const jours = Number(option('--purger')) || 180;
    const n = store.purger(jours);
    console.log(`[MIGRATION] ${n} ligne(s) de journal de plus de ${jours} jours supprimée(s).`);
  }

  const compteur = db.prepare('SELECT COUNT(*) AS n FROM envoi_consentement').get().n;
  const journal = db.prepare('SELECT COUNT(*) AS n FROM envoi_journal').get().n;
  console.log(`[MIGRATION] consentements : ${compteur} · lignes d'audit : ${journal}`);

  if (a('--verifier') || journal > 0) {
    const v = store.verifierChaine();
    console.log(`[MIGRATION] chaîne d'audit : ${v.ok ? 'VALIDE' : 'ROMPUE'} (${v.lignes} ligne(s))${v.ok ? '' : ` — ${v.motif}`}`);
    if (!v.ok) process.exitCode = 2;
  }

  const sel = process.env.ENVOI_SEL ? 'ENVOI_SEL (.env)' : 'sel généré et persisté dans envoi_etat';
  console.log(`[MIGRATION] sel HMAC : ${sel}`);
  console.log('[MIGRATION] OK — aucun numéro n’est stocké en clair.');
}

principal();
