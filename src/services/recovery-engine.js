/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  recovery-engine.js                                          ║
 * ║  Récupération automatique après :                            ║
 * ║  - Ban temporaire (le compte reste suspendu X heures)        ║
 * ║  - Session corrompue (le fichier auth est invalide)          ║
 * ║  - Déconnexion répétée (instabilité réseau/serveur)          ║
 * ║  - Blacklist dynamique (contact qui a signalé le bot)        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { Boom } from '@hapi/boom';

/* Dépendance Baileys supprimée : on garde uniquement les codes de déconnexion
   (constantes stables du protocole), afin que ce module reste valide sous le
   moteur whatsapp-web.js sans importer l'ancienne bibliothèque. */
const DisconnectReason = {
  loggedOut: 401,
  badSession: 500,
  connectionReplaced: 440,
  timedOut: 408,
  restartRequired: 515,
};
import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';
import { getAccountHealthMonitor } from './account-health-monitor.js';

const db = { run: rawRun, get: rawGet, all: rawAll };

const DELAIS_RECONNEXION_MS = [
  5_000,
  15_000,
  60_000,
  300_000,
  900_000,
  3_600_000,
];

const MAX_TENTATIVES_RECONNEXION = 6;

export class RecoveryEngine {
  constructor(reinitialiserBot, options = {}) {
    this.reinitialiserBot = reinitialiserBot;
    this.adminJid = options.adminJid || null;
    this.tentativesEnCours = 0;
    this.enCoursDeRecuperation = false;
    this.derniereBanDureeMs = null;
  }

  async gererDeconnexion(lastDisconnect, sock) {
    const erreur = new Boom(lastDisconnect?.error);
    const code = erreur?.output?.statusCode;
    const monitor = getAccountHealthMonitor();

    console.warn(`🔌 Déconnexion détectée — Code: ${code}`);

    switch (code) {
      case DisconnectReason.loggedOut:
      case 401:
        await this.gererBanOuLogout(sock);
        return false;

      case DisconnectReason.badSession:
      case 500:
        await this.gererSessionCorrompue();
        return this.tenterReconnexion();

      case DisconnectReason.connectionReplaced:
      case 440:
        await this.journaliser('deconnexion', 'Connexion remplacée par un autre appareil');
        await sleep(5000);
        return this.tenterReconnexion();

      case DisconnectReason.timedOut:
      case 408:
        return this.tenterReconnexion();

      case DisconnectReason.restartRequired:
      case 515:
        await sleep(3000);
        return this.tenterReconnexion();

      default:
        if (this.tentativesEnCours < MAX_TENTATIVES_RECONNEXION) {
          return this.tenterReconnexion();
        }
        await this.gererEchecDefinitif(code);
        return false;
    }
  }

  async tenterReconnexion() {
    if (this.enCoursDeRecuperation) return false;
    this.enCoursDeRecuperation = true;

    const indexDelai = Math.min(this.tentativesEnCours, DELAIS_RECONNEXION_MS.length - 1);
    const delai = DELAIS_RECONNEXION_MS[indexDelai];
    this.tentativesEnCours++;

    console.info(`🔄 Reconnexion dans ${delai / 1000}s (tentative ${this.tentativesEnCours}/${MAX_TENTATIVES_RECONNEXION})`);

    await sleep(delai);

    try {
      await this.reinitialiserBot();
      this.tentativesEnCours = 0;
      this.enCoursDeRecuperation = false;
      await this.journaliser('deconnexion', 'Reconnexion réussie');
      console.info('✅ Reconnexion réussie');
      return true;
    } catch (err) {
      this.enCoursDeRecuperation = false;
      console.error(`❌ Échec reconnexion tentative ${this.tentativesEnCours}: ${err.message}`);

      if (this.tentativesEnCours >= MAX_TENTATIVES_RECONNEXION) {
        await this.gererEchecDefinitif('max_tentatives_atteint');
        return false;
      }

      return this.tenterReconnexion();
    }
  }

  async gererBanOuLogout(sock) {
    await this.journaliser('ban_temporaire', 'Déconnexion 401 — ban ou logout détecté');

    const monitor = getAccountHealthMonitor();
    if (monitor) {
      await monitor.sauvegarderSession('pre_logout_401');
    }

    const message = [
      '🚨 *AINORIA — ALERTE CRITIQUE*',
      '',
      'Le compte WhatsApp vient d\'être déconnecté (code 401).',
      '',
      '*Actions à faire immédiatement :*',
      '1. Ouvrez WhatsApp sur votre téléphone',
      '2. Vérifiez si le numéro est suspendu ou banni',
      '3. Si banni temporairement : attendez la fin de la suspension',
      '4. Si banni définitivement : changez de numéro',
      '5. Ne relancez PAS le bot avant d\'avoir vérifié',
      '',
      'Le bot NE SE RECONNECTE PAS automatiquement après un code 401.',
    ].join('\n');

    if (this.adminJid && sock) {
      try {
        await sock.sendMessage(this.adminJid, { text: message });
      } catch (_) {}
    }

    console.error('🚨 BAN OU LOGOUT DÉTECTÉ — Bot arrêté, intervention manuelle requise.');
  }

  async gererSessionCorrompue() {
    console.warn('⚠️ Session corrompue détectée — restauration depuis backup...');
    await this.journaliser('session_corrompue', 'Session invalide, tentative de restauration');

    const monitor = getAccountHealthMonitor();
    if (!monitor) return;

    const dernierBackup = await db.get(
      'SELECT snapshot_path FROM session_snapshots ORDER BY cree_le DESC LIMIT 1'
    );

    if (dernierBackup) {
      console.info(`📦 Backup disponible : ${dernierBackup.snapshot_path}`);
      console.info('⚠️ Restauration automatique non implémentée pour éviter les boucles — restaurez manuellement.');
    } else {
      console.warn('❌ Aucun backup disponible — reconnexion nécessitera un nouveau QR scan.');
    }
  }

  async gererEchecDefinitif(raison) {
    await this.journaliser('deconnexion', `Échec définitif après ${this.tentativesEnCours} tentatives: ${raison}`);
    console.error(`🔴 Reconnexion abandonnée après ${this.tentativesEnCours} tentatives.`);

    if (this.adminJid) {
      console.warn('⚠️ Envoi d\'alerte admin impossible (bot déconnecté)');
    }
  }

  async journaliser(type, detail) {
    await db.run(
      `INSERT INTO recovery_log (type, tentatives_reconnexion, detail, cree_le) VALUES (?, ?, ?, ?)`,
      [type, this.tentativesEnCours, detail, Date.now()]
    );
  }
}

export async function blacklisterContact(jid, raison, dureeHeures = 24) {
  const expireLe = dureeHeures > 0 ? Date.now() + dureeHeures * 3_600_000 : null;

  await db.run(
    `INSERT INTO contact_blacklist (jid, raison, nb_signalements, blackliste_le, expire_le)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(jid) DO UPDATE SET
       nb_signalements = nb_signalements + 1,
       raison = excluded.raison,
       expire_le = excluded.expire_le`,
    [jid, raison, Date.now(), expireLe]
  );

  console.warn(`🚫 Contact blacklisté: ${jid} (${raison}, expire dans ${dureeHeures}h)`);
}

export async function estBlackliste(jid) {
  const ligne = await db.get(
    `SELECT jid, expire_le FROM contact_blacklist WHERE jid = ?`,
    [jid]
  );
  if (!ligne) return false;

  if (ligne.expire_le && Date.now() > ligne.expire_le) {
    await db.run('DELETE FROM contact_blacklist WHERE jid = ?', [jid]);
    return false;
  }

  return true;
}

export async function retirerDeBlacklist(jid) {
  await db.run('DELETE FROM contact_blacklist WHERE jid = ?', [jid]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
