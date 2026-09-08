import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
const log = createLogger('CINETPAY');

export const PLANS = {
  basic:     { nom: 'Premium Basic',     prix: 2500,  devise: 'XAF', duree_jours: 30 },
  pro:       { nom: 'Premium Pro',       prix: 5000,  devise: 'XAF', duree_jours: 30 },
  enterprise:{ nom: 'Premium Enterprise',prix: 15000, devise: 'XAF', duree_jours: 30 },
};

export async function initierPaiement(userId, nomPlan) {
  rawRun(`CREATE TABLE IF NOT EXISTS transactions_cinetpay (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    montant REAL NOT NULL,
    devise TEXT NOT NULL DEFAULT 'XAF',
    statut TEXT NOT NULL DEFAULT 'pending',
    reference TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`);
  rawRun(`CREATE TABLE IF NOT EXISTS abonnements_premium (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL,
    debut INTEGER NOT NULL,
    fin INTEGER NOT NULL,
    actif INTEGER NOT NULL DEFAULT 1
  )`);
  const plan = PLANS[nomPlan];
  if (!plan) throw new Error(`Plan "${nomPlan}" invalide`);
  const ref = `CP-${Date.now()}-${userId.replace(/[^0-9]/g, '').slice(-6)}`;
  rawRun('INSERT INTO transactions_cinetpay (user_id, plan, montant, devise, statut, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    userId, nomPlan, plan.prix, plan.devise, 'pending', ref, Date.now());
  return {
    success: true,
    reference: ref,
    montant: plan.prix,
    devise: plan.devise,
    message: `Paiement initié : ${plan.prix} ${plan.devise} pour ${plan.nom}. Réf: ${ref}`,
  };
}

export async function traiterWebhookCinetPay(corpsWebhook) {
  try {
    const { reference, statut, transaction_id } = corpsWebhook;
    if (!reference) return { success: false, message: 'Référence manquante' };
    const tx = rawGet('SELECT * FROM transactions_cinetpay WHERE reference = ?', reference);
    if (!tx) return { success: false, message: 'Transaction inconnue' };
    rawRun('UPDATE transactions_cinetpay SET statut = ?, updated_at = ? WHERE reference = ?', statut, Date.now(), reference);
    if (statut === 'completed') {
      const plan = PLANS[tx.plan];
      if (plan) {
        const debut = Date.now();
        const fin = debut + plan.duree_jours * 86400000;
        rawRun('INSERT OR REPLACE INTO abonnements_premium (user_id, plan, debut, fin, actif) VALUES (?, ?, ?, ?, 1)',
          tx.user_id, tx.plan, debut, fin);
      }
      log.info(`Paiement complété: ${reference} pour ${tx.user_id}`);
    }
    return { success: true, reference, statut };
  } catch (e) {
    log.error(`Webhook error: ${e.message}`);
    return { success: false, message: e.message };
  }
}

export function estPremium(userId) {
  const abo = rawGet('SELECT * FROM abonnements_premium WHERE user_id = ? AND actif = 1', userId);
  if (!abo) return false;
  if (abo.fin < Date.now()) {
    rawRun('UPDATE abonnements_premium SET actif = 0 WHERE user_id = ?', userId);
    return false;
  }
  return true;
}
