import { google } from 'googleapis';
import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

const log = createLogger('SHEETS-EXPORT');

rawRun(`CREATE TABLE IF NOT EXISTS sheets_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  sheet_id TEXT,
  sheet_title TEXT,
  export_type TEXT,
  group_jid TEXT,
  fichier_url TEXT,
  created_at INTEGER
)`);

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

function getSheets(client) {
  return google.sheets({ version: 'v4', auth: client });
}

export async function exporterVersSheet(userId, typeExport, titreSheet, entetes, lignes) {
  const client = getClientAuthentifie(userId);
  if (!client) throw new Error('Google Sheets non connecté');
  const sheets = getSheets(client);

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: titreSheet },
      sheets: [{ properties: { title: 'Export' } }],
    },
  });

  const sheetId = spreadsheet.data.spreadsheetId;
  const valeurs = [entetes, ...lignes];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Export!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: valeurs },
  });

  rawRun(
    'INSERT INTO sheets_exports (user_id, sheet_id, sheet_title, export_type, created_at) VALUES (?, ?, ?, ?, ?)',
    userId, sheetId, titreSheet, typeExport, Date.now()
  );

  log.info(`Sheet créé: ${titreSheet} (${sheetId})`);
  return `https://docs.google.com/spreadsheets/d/${sheetId}`;
}

export async function exporterClassementEconomie(userId, groupJid) {
  const membres = rawAll('SELECT jid, money, bank FROM economy ORDER BY (money + bank) DESC LIMIT 50');
  if (!membres.length) throw new Error('Aucune donnée économique à exporter');

  const entetes = ['Rang', 'JID', 'Argent Liquide', 'Banque', 'Total'];
  const lignes = membres.map((m, i) => [
    String(i + 1),
    m.jid,
    String(m.money || 0),
    String(m.bank || 0),
    String((m.money || 0) + (m.bank || 0)),
  ]);

  const url = await exporterVersSheet(userId, 'classement_economie', `Classement Économie ${new Date().toLocaleDateString('fr-FR')}`, entetes, lignes);

  rawRun('UPDATE sheets_exports SET group_jid = ? WHERE fichier_url = ? OR sheet_id IN (SELECT sheet_id FROM sheets_exports ORDER BY id DESC LIMIT 1)', groupJid, url);

  log.info(`Classement économie exporté pour le groupe ${groupJid}`);
  return url;
}

export async function exporterStatsMembres(userId, groupJid) {
  const membres = rawAll('SELECT jid, name, xp, level FROM users WHERE jid LIKE ? ORDER BY xp DESC LIMIT 50', '%@s.whatsapp.net');
  if (!membres.length) throw new Error('Aucune donnée membre à exporter');

  const entetes = ['Rang', 'JID', 'Nom', 'XP', 'Niveau'];
  const lignes = membres.map((m, i) => [
    String(i + 1),
    m.jid,
    m.name || 'Inconnu',
    String(m.xp || 0),
    String(m.level || 1),
  ]);

  const url = await exporterVersSheet(userId, 'stats_membres', `Statistiques Membres ${new Date().toLocaleDateString('fr-FR')}`, entetes, lignes);

  rawRun('UPDATE sheets_exports SET group_jid = ? WHERE sheet_id IN (SELECT sheet_id FROM sheets_exports ORDER BY id DESC LIMIT 1)', groupJid);

  log.info(`Statistiques membres exportées pour le groupe ${groupJid}`);
  return url;
}
