'use strict';
/**
 * Test d'INTÉGRATION réel (pas une simulation) : on lance le VRAI handler
 * dans un process isolé, on fait écrire « .ping » par un INCONNU, et on
 * regarde les messages réellement envoyés.
 *
 *   - MODE=public  → l'inconnu reçoit la réponse (PING)
 *   - aucun mode   → l'inconnu est refusé (ACCÈS RESTREINT)
 *   - MODE=self    → silence total (seul le propriétaire commande)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { toUnicode } = require('../src/config/style.js');

const ROOT = path.resolve(__dirname, '..');

function lancerInconnu(modeLine) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-public-'));
  const dataDir = path.join(dir, 'data');
  const sessionDir = path.join(dir, 'session');
  const envFile = path.join(dir, '.env.instance');
  fs.writeFileSync(envFile, [
    'PREFIX=.',
    'OWNER_NUMBER=237693978044',
    'HUMAN_DELAY=0',
    `DATA_DIR=${dataDir.replace(/\\/g, '/')}`,
    `SESSION_DIR=${sessionDir.replace(/\\/g, '/')}`,
    modeLine,
  ].filter(Boolean).join('\n') + '\n');

  const env = {
    ...process.env,
    ENV_FILE: envFile,
    DATA_DIR: dataDir,
    SESSION_DIR: sessionDir,
    HUMAN_DELAY: '0',
    AGENT_MODE: 'off',
  };
  delete env.MODE;
  delete env.PUBLIC_MODE;
  delete env.FORCE_PUBLIC;
  delete env.OWNER_NUMBER;
  delete env.SUDO_NUMBER;

  try {
    const script = `
      const handler = require(${JSON.stringify(path.join(ROOT, 'src', 'handlers', 'handler.js'))});
      const envois = [];
      const sock = {
        user: { id: '237659809751:1@s.whatsapp.net' },
        sendMessage: async (jid, content) => { envois.push({ jid, content }); return { key: { id: 'S' } }; },
        sendPresenceUpdate: async () => {},
        readMessages: async () => {},
        groupMetadata: async () => ({}),
        profilePictureUrl: async () => '',
      };
      (async () => {
        await handler.handleMessage(sock, {
          key: { remoteJid: '237600000001@s.whatsapp.net', fromMe: false, id: 'PING1' },
          message: { conversation: '.ping' },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: 'Inconnu',
        });
        process.stdout.write('@@' + JSON.stringify(envois));
        process.exit(0);
      })().catch((e) => { process.stdout.write('@@ERR:' + e.message); process.exit(0); });
    `;
    const out = execFileSync(process.execPath, ['-e', script], {
      cwd: ROOT, env, encoding: 'utf8', timeout: 60000,
    });
    const i = out.lastIndexOf('@@');
    const brut = out.slice(i + 2);
    assert.ok(!brut.startsWith('ERR:'), `le handler a planté : ${brut}`);
    return JSON.parse(brut);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const texteDe = (envois) => envois.map((e) => e.content?.text || '').join('\n');
/* les messages sortent en « alphabet cadre » (toUnicode) : on compare avec
   les mêmes jetons stylés que le bot, pas du texte ASCII brut. */
const REFUS = toUnicode('ACCÈS RESTREINT');
const PING = toUnicode('PING');

test('MODE=public : un inconnu reçoit la réponse à .ping (plus d’ACCÈS RESTREINT)', () => {
  const envois = lancerInconnu('MODE=public');
  assert.ok(envois.length >= 1, 'le bot doit répondre au moins une fois');
  assert.equal(envois[0].jid, '237600000001@s.whatsapp.net', 'réponse au bon destinataire');
  assert.ok(texteDe(envois).includes(PING), 'la réponse doit être le PING');
  assert.ok(!texteDe(envois).includes(REFUS), 'aucun ACCÈS RESTREINT attendu');
});

test('PUBLIC_MODE=on : même effet sans MODE', () => {
  const envois = lancerInconnu('PUBLIC_MODE=on');
  assert.ok(texteDe(envois).includes(PING));
  assert.ok(!texteDe(envois).includes(REFUS));
});

test('aucun mode : l’inconnu est refusé (ACCÈS RESTREINT)', () => {
  const envois = lancerInconnu('');
  assert.ok(texteDe(envois).includes(REFUS));
  assert.ok(!texteDe(envois).includes(PING));
});

test('MODE=self : silence total pour un inconnu', () => {
  const envois = lancerInconnu('MODE=self');
  assert.equal(envois.length, 0, 'aucun message ne doit être envoyé');
});
