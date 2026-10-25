'use strict';
/**
 * src/config/paths.js — source unique des chemins du projet.
 * ROOT = racine du dépôt (là où se trouvent index.js et package.json).
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const STORAGE = path.join(ROOT, 'storage');
const DATA = path.join(STORAGE, 'data');

module.exports = {
  ROOT,
  SRC,
  ASSETS: path.join(SRC, 'assets'),
  WEB: path.join(ROOT, 'web'),
  WEB_PUBLIC: path.join(ROOT, 'web', 'public'),
  STORAGE,
  SESSIONS: path.join(STORAGE, 'sessions'),
  DATA,
  PLUGIN_DATA: path.join(DATA, 'plugins'),
  LOGS: path.join(STORAGE, 'logs'),
  DOWNLOADS: path.join(STORAGE, 'downloads'),
  BIN: path.join(STORAGE, 'bin'),
};
