/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  persistent-scheduler.js                                     ║
 * ║  Scheduler de messages programmés qui SURVIT aux              ║
 * ║  redémarrages du serveur. Contrairement à setTimeout          ║
 * ║  (perdu au prochain crash), les messages sont stockés en      ║
 * ║  SQLite et ré-exécutés au redémarrage si manqués.             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';
import { getAccountHealthMonitor } from './account-health-monitor.js';

const db = { run: rawRun, get: rawGet, all: rawAll };

const INTERVALLE_VERIFICATION_MS = 30_000;
let sockActif = null;
let intervalId = null;

export function initScheduler(sock) {
  sockActif = sock;
  processerMessagesDus();
  intervalId = setInterval(processerMessagesDus, INTERVALLE_VERIFICATION_MS);
  console.info(`✅ Persistent Scheduler démarré — vérification toutes les ${INTERVALLE_VERIFICATION_MS / 1000}s`);
}

export function arreterScheduler() {
  if (intervalId) clearInterval(intervalId);
}

export async function programmerMessage(jid, contenu, dateEnvoiMs, creePar) {
  if (dateEnvoiMs <= Date.now()) {
    throw new Error('La date d\'envoi doit être dans le futur.');
  }

  const id = await db.run(
    `INSERT INTO messages_programmes (jid, contenu, envoyer_le, cree_par, cree_le)
     VALUES (?, ?, ?, ?, ?)`,
    [jid, JSON.stringify(contenu), dateEnvoiMs, creePar || null, Date.now()]
  );

  const dateFormatee = new Date(dateEnvoiMs).toLocaleString('fr-FR');
  console.info(`📅 Message programmé pour ${dateFormatee} → ${jid}`);

  return { id: id?.lastID, dateEnvoi: dateFormatee };
}

export async function annulerMessage(id, userId) {
  const msg = await db.get('SELECT * FROM messages_programmes WHERE id = ? AND statut = ?', [id, 'en_attente']);
  if (!msg) return { succes: false, raison: 'Message introuvable ou déjà envoyé.' };
  if (msg.cree_par && msg.cree_par !== userId) return { succes: false, raison: 'Vous n\'avez pas créé ce message programmé.' };

  await db.run('UPDATE messages_programmes SET statut = ? WHERE id = ?', ['annule', id]);
  return { succes: true };
}

export async function listerMessagesProgrammes(userId = null) {
  const sql = userId
    ? `SELECT * FROM messages_programmes WHERE statut = 'en_attente' AND cree_par = ? ORDER BY envoyer_le ASC`
    : `SELECT * FROM messages_programmes WHERE statut = 'en_attente' ORDER BY envoyer_le ASC`;
  const params = userId ? [userId] : [];
  const msgs = await db.all(sql, params);
  return msgs.map(m => ({ ...m, contenu: JSON.parse(m.contenu) }));
}

async function processerMessagesDus() {
  if (!sockActif) return;

  const maintenant = Date.now();
  const messagesDus = await db.all(
    `SELECT * FROM messages_programmes
     WHERE statut = 'en_attente' AND envoyer_le <= ? AND tentatives < max_tentatives
     ORDER BY envoyer_le ASC LIMIT 10`,
    [maintenant]
  );

  for (const msg of messagesDus) {
    await envoyerMessageProgramme(msg);
    await sleep(1500);
  }

  await db.run(
    `UPDATE messages_programmes SET statut = 'echec'
     WHERE statut = 'en_attente' AND tentatives >= max_tentatives AND envoyer_le <= ?`,
    [maintenant]
  );
}

async function envoyerMessageProgramme(msg) {
  const monitor = getAccountHealthMonitor();

  if (monitor) {
    const autorise = await monitor.autoriserEnvoi('message');
    if (!autorise) {
      console.warn(`⏸ Message #${msg.id} reporté — limite warmup atteinte`);
      return;
    }
  }

  await db.run('UPDATE messages_programmes SET tentatives = tentatives + 1 WHERE id = ?', [msg.id]);

  try {
    const contenu = JSON.parse(msg.contenu);

    if (monitor?.modeRalenti) {
      const delai = monitor.appliquerRalentissement(2000);
      await sleep(delai);
    }

    await sockActif.sendMessage(msg.jid, contenu);
    await db.run('UPDATE messages_programmes SET statut = ? WHERE id = ?', ['envoye', msg.id]);
    console.info(`✅ Message programmé #${msg.id} envoyé → ${msg.jid}`);
  } catch (erreur) {
    await db.run(
      'UPDATE messages_programmes SET erreur_derniere = ? WHERE id = ?',
      [erreur.message, msg.id]
    );
    console.error(`❌ Échec message programmé #${msg.id}: ${erreur.message}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
