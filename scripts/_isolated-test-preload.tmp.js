'use strict';

const fs = require('node:fs');
const path = require('node:path');
const paths = require('../src/config/paths');
const root = path.resolve(__dirname, '..');
const tempRoot = path.join(path.resolve(process.env.DJOUSSE_TEST_TMP), String(process.pid));
const dataDir = path.join(tempRoot, 'data');
const sessionDir = path.join(tempRoot, 'sessions');
const pluginDataDir = path.join(dataDir, 'plugins');

fs.mkdirSync(pluginDataDir, { recursive: true });
fs.mkdirSync(sessionDir, { recursive: true });
process.env.DATA_DIR ||= dataDir;
process.env.SESSION_DIR ||= sessionDir;
Object.assign(paths, {
  STORAGE: tempRoot,
  SESSIONS: sessionDir,
  DATA: dataDir,
  PLUGIN_DATA: pluginDataDir,
  LOGS: path.join(tempRoot, 'logs'),
  DOWNLOADS: path.join(tempRoot, 'downloads'),
  BIN: path.join(tempRoot, 'bin'),
});
