import { google } from 'googleapis';
import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet } from '../../infrastructure/database/database.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

const log = createLogger('GOOGLE-AUTH');

rawRun(`CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date INTEGER,
  scopes TEXT,
  cree_le INTEGER,
  maj_le INTEGER
)`);

export const FONCTIONNALITES_GOOGLE = {
  calendar: {
    nom: 'Agenda / Calendrier',
    description: 'Lire et créer des événements dans Google Agenda',
    scopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  },
  sheets: {
    nom: 'Sheets / Tableur',
    description: 'Lire et écrire dans Google Sheets',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  },
  tasks: {
    nom: 'Tasks / Tâches',
    description: 'Gérer les Google Tasks',
    scopes: ['https://www.googleapis.com/auth/tasks'],
  },
};

function creerClientOAuth() {
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );
}

export function estAutorisePour(userId, nomFonctionnalite) {
  const feature = FONCTIONNALITES_GOOGLE[nomFonctionnalite];
  if (!feature) throw new Error(`Fonctionnalité Google inconnue: ${nomFonctionnalite}`);
  const ligne = rawGet('SELECT scopes FROM google_oauth_tokens WHERE user_id = ?', userId);
  if (!ligne) return false;
  const scopesStockes = ligne.scopes ? JSON.parse(ligne.scopes) : [];
  return feature.scopes.every(s => scopesStockes.includes(s));
}

export function accederOuDemanderAutorisation(userId, nomFonctionnalite) {
  const feature = FONCTIONNALITES_GOOGLE[nomFonctionnalite];
  if (!feature) throw new Error(`Fonctionnalité Google inconnue: ${nomFonctionnalite}`);
  const ligne = rawGet('SELECT scopes FROM google_oauth_tokens WHERE user_id = ?', userId);
  const scopesExistants = ligne?.scopes ? JSON.parse(ligne.scopes) : [];
  const scopesRequis = feature.scopes;
  const tousLesScopes = [...new Set([...scopesExistants, ...scopesRequis])];
  const oauth2Client = creerClientOAuth();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: scopesExistants.length ? '' : 'consent',
    scope: tousLesScopes,
    state: JSON.stringify({ userId, nomFonctionnalite, tousLesScopes }),
  });
}

export async function traiterCallbackOAuth(code, userId) {
  const oauth2Client = creerClientOAuth();
  const { tokens } = await oauth2Client.getToken(code);
  const scopes = tokens.scope ? tokens.scope.split(' ') : [];
  const maintenant = Date.now();
  const existant = rawGet('SELECT user_id, scopes FROM google_oauth_tokens WHERE user_id = ?', userId);
  if (existant) {
    const ancien = existant.scopes ? JSON.parse(existant.scopes) : [];
    const fusionScopes = [...new Set([...ancien, ...scopes])];
    rawRun(
      'UPDATE google_oauth_tokens SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expiry_date = ?, scopes = ?, maj_le = ? WHERE user_id = ?',
      tokens.access_token, tokens.refresh_token, tokens.expiry_date, JSON.stringify(fusionScopes), maintenant, userId
    );
  } else {
    rawRun(
      'INSERT INTO google_oauth_tokens (user_id, access_token, refresh_token, expiry_date, scopes, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date, JSON.stringify(scopes), maintenant, maintenant
    );
  }
  log.info(`OAuth terminé pour ${userId}`);
}

export function revoquerAcces(userId) {
  rawRun('DELETE FROM google_oauth_tokens WHERE user_id = ?', userId);
  log.info(`Accès Google révoqué pour ${userId}`);
}

export function getClientAuthentifie(userId) {
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
