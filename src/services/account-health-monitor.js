/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  account-health-monitor.js                                   ║
 * ║  Surveillance proactive de la santé du compte WhatsApp.      ║
 * ║  Principe : WhatsApp envoie des signaux AVANT de bannir.     ║
 * ║  Ce module les lit, calcule un score de risque, et prend      ║
 * ║  des actions automatiques pour protéger le compte.            ║
 * ║                                                                ║
 * ║  Pas de promesses d'indétectabilité — juste une réponse       ║
 * ║  intelligente aux signaux réels que Baileys expose.            ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * npm install archiver   (pour la compression des backups de session)
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { stat, unlink } from 'fs/promises';
import path from 'path';
import { ZipArchive } from 'archiver';
import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';

const db = { run: rawRun, get: rawGet, all: rawAll };

const CODES_ERREUR_BAILEYS = {
  401:  { nom: 'loggedOut',          severite: 10, message: 'Compte déconnecté par WhatsApp (ban probable)' },
  408:  { nom: 'timedOut',           severite: 3,  message: 'Timeout — surcharge ou connexion instable' },
  411:  { nom: 'multideviceMismatch',severite: 6,  message: 'Conflit multi-appareils — session corrompue' },
  428:  { nom: 'connectionClosed',   severite: 2,  message: 'Connexion fermée proprement' },
  440:  { nom: 'connectionReplaced', severite: 7,  message: 'Connexion remplacée — autre session active' },
  500:  { nom: 'badSession',         severite: 8,  message: 'Session invalide — recréation nécessaire' },
  515:  { nom: 'restartRequired',    severite: 4,  message: 'Redémarrage demandé par WhatsApp' },
  'rate_limit':    { severite: 7, message: 'Rate limit atteint — WhatsApp ralentit activement ce compte' },
  'blocked':       { severite: 9, message: 'Message bloqué par le destinataire ou WhatsApp' },
  'not_member':    { severite: 2, message: 'Utilisateur non membre du groupe' },
  'forbidden':     { severite: 8, message: 'Action interdite — permissions insuffisantes ou compte restreint' },
};

const TYPES_EVENEMENTS = {
  RATE_LIMIT_ATTEINT:      { severite: 7, description: 'Rate limit WhatsApp détecté' },
  DECONNEXION_INATTENDUE:  { severite: 5, description: 'Déconnexion non initiée par le bot' },
  MESSAGE_NON_LIVRE:       { severite: 3, description: 'Message non livré — destinataire potentiellement bloquant' },
  TAUX_ECHEC_ELEVE:        { severite: 6, description: "Taux d'échec de livraison > 20%" },
  SESSION_REMPLACEE:       { severite: 7, description: 'Session WhatsApp remplacée par un autre appareil' },
  COMPTE_DECONNECTE:       { severite: 10, description: 'Compte déconnecté (logout ou ban)' },
  VOLUME_ANORMAL:          { severite: 6, description: 'Volume de messages anormalement élevé détecté' },
  WARMUP_DEPASSE:          { severite: 5, description: 'Limite de warmup quotidien dépassée' },
  ERREUR_PROTOCOLE:        { severite: 4, description: 'Erreur de protocole Baileys — instabilité de session' },
};

const PLAN_WARMUP = {
  1:  { maxMessages: 5,   maxGroupes: 0, maxNouveauxContacts: 2 },
  2:  { maxMessages: 10,  maxGroupes: 0, maxNouveauxContacts: 3 },
  3:  { maxMessages: 20,  maxGroupes: 1, maxNouveauxContacts: 5 },
  4:  { maxMessages: 35,  maxGroupes: 1, maxNouveauxContacts: 8 },
  5:  { maxMessages: 50,  maxGroupes: 2, maxNouveauxContacts: 10 },
  6:  { maxMessages: 75,  maxGroupes: 2, maxNouveauxContacts: 15 },
  7:  { maxMessages: 100, maxGroupes: 3, maxNouveauxContacts: 20 },
  8:  { maxMessages: 130, maxGroupes: 3, maxNouveauxContacts: 25 },
  9:  { maxMessages: 160, maxGroupes: 4, maxNouveauxContacts: 30 },
  10: { maxMessages: 200, maxGroupes: 5, maxNouveauxContacts: 40 },
  14: { maxMessages: 300, maxGroupes: 8, maxNouveauxContacts: 60 },
  21: { maxMessages: 400, maxGroupes: 12, maxNouveauxContacts: 80 },
  30: { maxMessages: 500, maxGroupes: 20, maxNouveauxContacts: 100 },
};

function getLimitesWarmup(jourActuel) {
  const jours = Object.keys(PLAN_WARMUP).map(Number).sort((a, b) => b - a);
  for (const jour of jours) {
    if (jourActuel >= jour) return PLAN_WARMUP[jour];
  }
  return PLAN_WARMUP[1];
}

export class AccountHealthMonitor {
  constructor(sock, options = {}) {
    this.sock = sock;
    this.sessionDir = options.sessionDir || './auth_session';
    this.backupDir = options.backupDir || './session_backups';
    this.adminJid = options.adminJid || null;

    this.scoreCourant = 100;
    this.niveauCourant = 'sain';

    this.warmupActif = false;
    this.jourWarmup = 0;
    this.msgEnvoyesAujourdHui = 0;
    this.groupesRejointsAujourdHui = 0;

    this.modeRalenti = false;
    this.facteurRalentissement = 1.0;

    this.statsLivraison = { total: 0, livres: 0, echecs: 0 };
    this.fenetreStatsMs = 60 * 60 * 1000;
  }

  async init() {
    if (!existsSync(this.backupDir)) mkdirSync(this.backupDir, { recursive: true });
    await this.determinerJourWarmup();
    this.attacherListenersBaileys();

    setInterval(() => this.verifierSante(), 5 * 60 * 1000);
    setInterval(() => this.sauvegarderSession('automatique'), 6 * 60 * 60 * 1000);

    const maintenant = new Date();
    const minuit = new Date(maintenant); minuit.setHours(24, 0, 0, 0);
    setTimeout(() => {
      this.reinitialiserCompteursQuotidiens();
      setInterval(() => this.reinitialiserCompteursQuotidiens(), 86_400_000);
    }, minuit - maintenant);

    await this.sauvegarderSession('demarrage');
    console.log(`✅ AccountHealthMonitor initialisé — Score initial: ${this.scoreCourant}/100`);
    return this;
  }

  attacherListenersBaileys() {
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (lastDisconnect?.error) {
        const code = lastDisconnect.error?.output?.statusCode;
        await this.traiterErreurConnexion(code, lastDisconnect.error.message);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === 401) {
          await this.enregistrerEvenement('COMPTE_DECONNECTE', 'Déconnexion avec code 401 — ban probable ou logout');
          await this.sauvegarderSession('pre_ban_detecte');
          await this.alerterAdmin('🚨 COMPTE DÉCONNECTÉ (code 401) — Vérifiez immédiatement si le numéro est banni.');
        } else if (code === 440) {
          await this.enregistrerEvenement('SESSION_REMPLACEE', `Session remplacée (code ${code})`);
        } else if (code !== 428) {
          await this.enregistrerEvenement('DECONNEXION_INATTENDUE', `Déconnexion code ${code || 'inconnu'}`);
        }
      }
    });

    this.sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update?.status !== undefined) {
          await this.traiterMiseAJourStatut(update);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        this.msgEnvoyesAujourdHui++;
      }
    });

    console.log('✅ Listeners Baileys attachés pour le monitoring de santé');
  }

  async traiterErreurConnexion(code, message) {
    const infos = CODES_ERREUR_BAILEYS[code] || { severite: 3, message: message || 'Erreur inconnue' };

    await this.enregistrerEvenement('ERREUR_PROTOCOLE', `Code ${code}: ${infos.message}`, infos.severite);
    this.penaliserScore(infos.severite * 2, `Erreur connexion code ${code}`);

    if (infos.severite >= 7) {
      await this.sauvegarderSession(`erreur_critique_${code}`);
      this.activerModeRalenti(infos.severite);
    }
  }

  async traiterMiseAJourStatut(update) {
    const { key, update: { status } } = update;
    const now = Date.now();

    try {
      if (status === 0 || status === 1) {
        await db.run(
          `INSERT INTO delivery_stats (jid_dest, message_id, envoye_le, statut) VALUES (?, ?, ?, 'envoye')
           ON CONFLICT(jid_dest, message_id) DO UPDATE SET statut = 'envoye'`,
          [key.remoteJid, key.id, now]
        );
        this.statsLivraison.total++;
      } else if (status === 2) {
        await db.run(
          `UPDATE delivery_stats SET livre_le = ?, statut = 'livre' WHERE message_id = ?`,
          [now, key.id]
        );
        this.statsLivraison.livres++;
      } else if (status === 3 || status === 4) {
        await db.run(
          `UPDATE delivery_stats SET lu_le = ?, statut = 'lu' WHERE message_id = ?`,
          [now, key.id]
        );
      }

      await this.verifierTauxLivraison();
    } catch (err) {}
  }

  async verifierTauxLivraison() {
    const depuis = Date.now() - this.fenetreStatsMs;
    const stats = await db.get(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN statut = 'livre' OR statut = 'lu' THEN 1 ELSE 0 END) as livres,
         SUM(CASE WHEN statut = 'envoye' AND envoye_le < ? THEN 1 ELSE 0 END) as potentiels_echecs
       FROM delivery_stats WHERE envoye_le > ?`,
      [Date.now() - 5 * 60 * 1000, depuis]
    );

    if (!stats || stats.total < 10) return;

    const tauxEchec = stats.potentiels_echecs / stats.total;

    if (tauxEchec > 0.20) {
      await this.enregistrerEvenement('TAUX_ECHEC_ELEVE', `Taux d'échec: ${(tauxEchec * 100).toFixed(1)}%`);
      this.penaliserScore(15, 'Taux de non-livraison élevé');
      this.activerModeRalenti(5);
    }

    return { tauxLivraison: stats.livres / stats.total, tauxEchec, total: stats.total };
  }

  async verifierSante() {
    const metriques = await this.calculerMetriques();
    this.scoreCourant = this.calculerScore(metriques);
    this.niveauCourant = this.determinerNiveau(this.scoreCourant);

    await db.run(
      `INSERT INTO account_health_checks (score, niveau, details, cree_le) VALUES (?, ?, ?, ?)`,
      [this.scoreCourant, this.niveauCourant, JSON.stringify(metriques), Date.now()]
    );

    await this.reagirAuNiveau(this.niveauCourant, metriques);

    if (this.scoreCourant > 80 && this.modeRalenti) {
      this.desactiverModeRalenti();
    }

    return { score: this.scoreCourant, niveau: this.niveauCourant, metriques };
  }

  async calculerMetriques() {
    const depuis1h = Date.now() - 3_600_000;

    const [eventsRecents, statsDelivery, warmupStatus] = await Promise.all([
      db.all(
        `SELECT type, severite, COUNT(*) as nb FROM account_risk_events
         WHERE cree_le > ? AND resolu = 0 GROUP BY type`,
        [depuis1h]
      ),
      db.get(
        `SELECT
           COUNT(*) as total,
           AVG(CASE WHEN statut = 'livre' OR statut = 'lu' THEN 1.0 ELSE 0.0 END) as taux_livraison
         FROM delivery_stats WHERE envoye_le > ?`,
        [depuis1h]
      ),
      this.getStatutWarmup(),
    ]);

    const scoreEvenements = eventsRecents.reduce((acc, e) => acc - (e.severite * e.nb), 0);
    const tauxLivraison = statsDelivery?.taux_livraison ?? 1.0;

    return {
      scoreEvenements: Math.max(-100, scoreEvenements),
      tauxLivraison,
      msgAujourdHui: this.msgEnvoyesAujourdHui,
      modeRalenti: this.modeRalenti,
      facteurRalentissement: this.facteurRalentissement,
      warmup: warmupStatus,
      evenementsActifs: eventsRecents,
    };
  }

  calculerScore(metriques) {
    let score = 100;
    score += metriques.scoreEvenements;
    if (metriques.tauxLivraison < 0.95) score -= 10;
    if (metriques.tauxLivraison < 0.80) score -= 20;
    if (metriques.tauxLivraison < 0.60) score -= 30;
    if (metriques.modeRalenti) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  determinerNiveau(score) {
    if (score >= 80) return 'sain';
    if (score >= 60) return 'attention';
    if (score >= 40) return 'danger';
    return 'critique';
  }

  async reagirAuNiveau(niveau, metriques) {
    switch (niveau) {
      case 'attention':
        if (!this.modeRalenti) this.activerModeRalenti(2);
        break;
      case 'danger':
        this.activerModeRalenti(4);
        await this.sauvegarderSession('niveau_danger');
        if (this.adminJid) {
          await this.alerterAdmin(
            `⚠️ Score de santé du compte : ${this.scoreCourant}/100 (DANGER)\n` +
            `Taux de livraison : ${(metriques.tauxLivraison * 100).toFixed(1)}%\n` +
            `Le bot ralentit automatiquement.`
          );
        }
        break;
      case 'critique':
        this.activerModeRalenti(8);
        await this.sauvegarderSession('niveau_critique');
        await this.alerterAdmin(
          `🚨 NIVEAU CRITIQUE — Score: ${this.scoreCourant}/100\n` +
          `Le bot a drastiquement réduit son activité.\n` +
          `Vérifiez votre numéro WhatsApp immédiatement.`
        );
        break;
    }
  }

  activerModeRalenti(intensite = 1) {
    this.modeRalenti = true;
    this.facteurRalentissement = Math.min(10, 1 + (intensite * 0.5));
    console.warn(`🐢 Mode ralenti activé — facteur: x${this.facteurRalentissement.toFixed(1)}`);
  }

  desactiverModeRalenti() {
    this.modeRalenti = false;
    this.facteurRalentissement = 1.0;
    console.info('✅ Mode ralenti désactivé — compte en bonne santé');
  }

  appliquerRalentissement(delaiBaseMs) {
    return Math.round(delaiBaseMs * this.facteurRalentissement);
  }

  async determinerJourWarmup() {
    const premierJour = await db.get('SELECT date_jour FROM warmup_journal ORDER BY id ASC LIMIT 1');

    if (!premierJour) {
      this.warmupActif = true;
      this.jourWarmup = 1;
      await this.enregistrerJourWarmup();
      console.info('📅 Warmup démarré — Jour 1. Limites progressives actives.');
    } else {
      const debut = new Date(premierJour.date_jour);
      const maintenant = new Date();
      this.jourWarmup = Math.ceil((maintenant - debut) / 86_400_000);
      this.warmupActif = this.jourWarmup <= 30;

      if (this.warmupActif) {
        console.info(`📅 Warmup actif — Jour ${this.jourWarmup}/30`);
      } else {
        console.info('✅ Période de warmup terminée (30 jours)');
      }
    }
  }

  async autoriserEnvoi(type = 'message') {
    if (!this.warmupActif) return true;

    const limites = getLimitesWarmup(this.jourWarmup);

    if (type === 'message') {
      if (this.msgEnvoyesAujourdHui >= limites.maxMessages) {
        await this.enregistrerEvenement('WARMUP_DEPASSE', `Limite jour ${this.jourWarmup}: ${limites.maxMessages} msgs`);
        return false;
      }
      this.msgEnvoyesAujourdHui++;
    } else if (type === 'groupe') {
      if (this.groupesRejointsAujourdHui >= limites.maxGroupes) return false;
      this.groupesRejointsAujourdHui++;
    }

    return true;
  }

  async enregistrerJourWarmup() {
    const dateJour = new Date().toISOString().slice(0, 10);
    await db.run(
      `INSERT INTO warmup_journal (jour, date_jour, msgs_envoyes) VALUES (?, ?, 0)
       ON CONFLICT(date_jour) DO NOTHING`,
      [this.jourWarmup, dateJour]
    );
  }

  async getStatutWarmup() {
    if (!this.warmupActif) return { actif: false };
    const limites = getLimitesWarmup(this.jourWarmup);
    return {
      actif: true,
      jour: this.jourWarmup,
      msgsAutorises: limites.maxMessages,
      msgsEnvoyes: this.msgEnvoyesAujourdHui,
      pourcentageUtilise: Math.round((this.msgEnvoyesAujourdHui / limites.maxMessages) * 100),
    };
  }

  async sauvegarderSession(raison = 'automatique') {
    try {
      if (!existsSync(this.sessionDir)) {
        console.warn('⚠️ Dossier de session introuvable — backup ignoré');
        return null;
      }

      const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const nomFichier = `session_${raison}_${horodatage}.zip`;
      const cheminComplet = path.join(this.backupDir, nomFichier);

      await new Promise((resolve, reject) => {
        const sortie = createWriteStream(cheminComplet);
        const archive = new ZipArchive();

        sortie.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(sortie);
        archive.directory(this.sessionDir, false);
        archive.finalize();
      });

      const infos = await stat(cheminComplet);

      await db.run(
        `INSERT INTO session_snapshots (snapshot_path, taille_octets, raison, cree_le) VALUES (?, ?, ?, ?)`,
        [cheminComplet, infos.size, raison, Date.now()]
      );

      await this.nettoyerAnciensBackups();
      console.info(`💾 Session sauvegardée: ${nomFichier} (${Math.round(infos.size / 1024)} Ko)`);
      return cheminComplet;
    } catch (err) {
      console.error('❌ Erreur backup session:', err.message);
      return null;
    }
  }

  async nettoyerAnciensBackups() {
    const backups = await db.all(
      `SELECT id, snapshot_path FROM session_snapshots WHERE raison = 'automatique' ORDER BY cree_le DESC`
    );

    for (const backup of backups.slice(10)) {
      try {
        await unlink(backup.snapshot_path);
        await db.run('DELETE FROM session_snapshots WHERE id = ?', [backup.id]);
      } catch (_) {}
    }
  }

  async enregistrerEvenement(type, detail = '', severiteOverride = null) {
    const infos = TYPES_EVENEMENTS[type] || { severite: 3, description: type };
    const severite = severiteOverride || infos.severite;

    await db.run(
      `INSERT INTO account_risk_events (type, severite, detail, cree_le) VALUES (?, ?, ?, ?)`,
      [type, severite, detail, Date.now()]
    );

    this.penaliserScore(severite, type);
    console.warn(`⚠️ [AccountHealth] ${type} (sévérité ${severite}): ${detail}`);
  }

  penaliserScore(points, raison) {
    this.scoreCourant = Math.max(0, this.scoreCourant - points);
    if (this.scoreCourant < 40) {
      this.niveauCourant = 'critique';
    } else if (this.scoreCourant < 60) {
      this.niveauCourant = 'danger';
    } else if (this.scoreCourant < 80) {
      this.niveauCourant = 'attention';
    }
  }

  async alerterAdmin(message) {
    if (!this.adminJid || !this.sock) return;
    try {
      await this.sock.sendMessage(this.adminJid, { text: `🔐 *AINORIA — Alerte Sécurité Compte*\n\n${message}` });
    } catch (err) {
      console.error('❌ Impossible d\'alerter l\'admin:', err.message);
    }
  }

  reinitialiserCompteursQuotidiens() {
    this.msgEnvoyesAujourdHui = 0;
    this.groupesRejointsAujourdHui = 0;
    this.statsLivraison = { total: 0, livres: 0, echecs: 0 };
    this.jourWarmup++;
    this.enregistrerJourWarmup();
    this.scoreCourant = Math.min(100, this.scoreCourant + 10);
    console.info(`🌅 Nouveau jour — Jour warmup ${this.jourWarmup} | Score: ${this.scoreCourant}/100`);
  }

  async getEtatComplet() {
    const [derniereVerif, evenementsRecents, statsDelivery] = await Promise.all([
      db.get('SELECT * FROM account_health_checks ORDER BY cree_le DESC LIMIT 1'),
      db.all('SELECT type, severite, detail, cree_le FROM account_risk_events WHERE resolu = 0 ORDER BY cree_le DESC LIMIT 20'),
      db.get(`SELECT AVG(livre_le - envoye_le) as latence_moy_ms, COUNT(*) as total,
              SUM(CASE WHEN statut='livre' OR statut='lu' THEN 1 ELSE 0 END) as livres
              FROM delivery_stats WHERE envoye_le > ?`, [Date.now() - 86_400_000]),
    ]);

    return {
      score: this.scoreCourant,
      niveau: this.niveauCourant,
      modeRalenti: this.modeRalenti,
      facteurRalentissement: this.facteurRalentissement,
      warmup: await this.getStatutWarmup(),
      evenementsActifs: evenementsRecents.length,
      tauxLivraisonAujourdHui: statsDelivery?.total > 0
        ? ((statsDelivery.livres / statsDelivery.total) * 100).toFixed(1) + '%'
        : 'N/A',
      derniereVerification: derniereVerif?.cree_le ? new Date(derniereVerif.cree_le).toLocaleString('fr-FR') : 'Jamais',
    };
  }
}

let instance = null;

export async function initAccountHealthMonitor(sock, options = {}) {
  if (!instance) {
    instance = new AccountHealthMonitor(sock, options);
    await instance.init();
  }
  return instance;
}

export function getAccountHealthMonitor() {
  return instance;
}
