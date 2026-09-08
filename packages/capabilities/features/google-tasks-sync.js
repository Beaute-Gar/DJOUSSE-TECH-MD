import { google } from 'googleapis';
import { createLogger } from '../../infrastructure/logger.js';
import { rawGet } from '../../infrastructure/database/database.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
import { estAutorisePour, accederOuDemanderAutorisation } from './google-auth-gate.js';

const log = createLogger('GOOGLE-TASKS');

function creerClientOAuth() {
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );
}

function getClientAuthentifie(userId) {
  const ligne = rawGet('SELECT access_token, refresh_token, expiry_date FROM google_oauth_tokens WHERE user_id = ?', userId);
  if (!ligne) return null;
  const client = creerClientOAuth();
  client.setCredentials({
    access_token: ligne.access_token,
    refresh_token: ligne.refresh_token,
    expiry_date: ligne.expiry_date,
  });
  return client;
}

function getTasks(client) {
  return google.tasks({ version: 'v1', auth: client });
}

export async function creerTache(userId, titre, echeance, notes) {
  const autorise = estAutorisePour(userId, 'tasks');
  if (!autorise) {
    const url = accederOuDemanderAutorisation(userId, 'tasks');
    throw new Error(`Autorisation Google Tasks requise. ${url}`);
  }

  const client = getClientAuthentifie(userId);
  if (!client) throw new Error('Compte Google non connecté');
  const tasks = getTasks(client);

  const tache = await tasks.tasks.insert({
    tasklist: '@default',
    requestBody: {
      title: titre,
      notes: notes || '',
      due: echeance ? new Date(echeance).toISOString() : undefined,
    },
  });

  log.info(`Tâche créée: ${titre}`);
  return tache.data;
}

export async function marquerTacheTerminee(userId, tacheId) {
  const autorise = estAutorisePour(userId, 'tasks');
  if (!autorise) throw new Error('Google Tasks non autorisé');

  const client = getClientAuthentifie(userId);
  if (!client) throw new Error('Compte Google non connecté');
  const tasks = getTasks(client);

  const tache = await tasks.tasks.get({ tasklist: '@default', task: tacheId });
  const miseAJour = await tasks.tasks.update({
    tasklist: '@default',
    task: tacheId,
    requestBody: {
      ...tache.data,
      status: 'completed',
      completed: new Date().toISOString(),
    },
  });

  log.info(`Tâche terminée: ${tacheId}`);
  return miseAJour.data;
}
