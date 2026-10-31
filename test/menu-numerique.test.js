'use strict';
/**
 * test/menu-numerique.test.js — RÉGRESSION : le menu doit répondre aux chiffres
 * ────────────────────────────────────────────────────────────────────────────
 * Bug constaté en production : `.menu` puis « 1 » ne répondait plus. Cause :
 * le contrôle d'envoi refusait le 2ᵉ message de la même seconde
 * (LIMITE_SECONDE), donc la réponse au chiffre était jetée. La fenêtre
 * « par seconde » doit désormais FAIRE ATTENDRE, pas refuser.
 *
 * Test d'intégration réel : on lance le VRAI handler dans un process isolé,
 * on envoie `.menu`, puis des chiffres, et on inspecte les messages émis.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { toUnicode } = require('../src/config/style.js');

const ROOT = path.resolve(__dirname, '..');

function scenario(etapes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-menu-'));
  const dataDir = path.join(dir, 'data');
  const envFile = path.join(dir, '.env.instance');
  fs.writeFileSync(envFile, [
    'PREFIX=.',
    'OWNER_NUMBER=237600111222',
    'MODE=public',
    'MENU_PICTURE_MODE=off',
    'AUTO_TYPING=0',
    'HUMAN_DELAY=0',
    'ENVOI_DELAI_MIN=0',
    'ENVOI_JITTER_MAX=0',
    `DATA_DIR=${dataDir.replace(/\\/g, '/')}`,
  ].join('\n') + '\n');

  const env = { ...process.env, ENV_FILE: envFile, DATA_DIR: dataDir, HUMAN_DELAY: '0', AGENT_MODE: 'off' };
  delete env.MODE;
  delete env.PUBLIC_MODE;
  delete env.FORCE_PUBLIC;
  delete env.OWNER_NUMBER;

  try {
    const script = `
      const handler = require(${JSON.stringify(path.join(ROOT, 'src', 'handlers', 'handler.js'))});
      const envois = [];
      const sock = {
        user: { id: '237600333444:1@s.whatsapp.net' },
        sendMessage: async (jid, content) => { envois.push({ jid, content }); return { key: { id: 'S' } }; },
        sendPresenceUpdate: async () => {},
        readMessages: async () => {},
        groupMetadata: async () => ({}),
        profilePictureUrl: async () => '',
      };
      const etapes = ${JSON.stringify(etapes)};
      (async () => {
        for (let i = 0; i < etapes.length; i += 1) {
          await handler.handleMessage(sock, {
            key: { remoteJid: '237600000001@s.whatsapp.net', fromMe: false, id: 'M' + i },
            message: { conversation: etapes[i] },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Testeur',
          });
        }
        process.stdout.write('@@' + JSON.stringify(envois.map((e) => ({
          jid: e.jid,
          image: !!e.content.image,
          texte: e.content.text || e.content.caption || '',
        }))));
        process.exit(0);
      })().catch((e) => { process.stdout.write('@@ERR:' + e.stack); process.exit(0); });
    `;
    const out = execFileSync(process.execPath, ['-e', script], {
      cwd: ROOT, env, encoding: 'utf8', timeout: 120000,
    });
    const i = out.lastIndexOf('@@');
    const brut = out.slice(i + 2);
    assert.ok(!brut.startsWith('ERR:'), `le handler a planté : ${brut}`);
    return JSON.parse(brut);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('menu → chiffre de catégorie : le bot répond (plus de refus LIMITE_SECONDE)', () => {
  const envois = scenario(['.menu', '1']);
  assert.equal(envois.length, 2, `2 messages attendus (menu + catégorie), obtenu ${envois.length}`);
  assert.equal(envois[0].image, true, 'le menu principal part en image');
  assert.ok(envois[1].texte.includes(toUnicode('COMMANDS')), 'le sous-menu liste les commandes');
  assert.ok(!envois[1].texte.includes(toUnicode('CHIFFRE INVALIDE')), 'pas d’erreur de chiffre');
});

test('menu → 0 : retour au menu principal', () => {
  const envois = scenario(['.menu', '1', '0']);
  assert.equal(envois.length, 3);
  assert.ok(envois[2].texte.includes(toUnicode('INFO BOT')), 'menu principal réaffiché');
});

test('menu → chiffre hors bornes : erreur explicite, pas de silence', () => {
  const envois = scenario(['.menu', '99']);
  assert.equal(envois.length, 2);
  assert.ok(envois[1].texte.includes(toUnicode('CHIFFRE INVALIDE')));
});

test('un chiffre SANS menu ouvert ne déclenche rien (pas de détournement)', () => {
  const envois = scenario(['1']);
  assert.equal(envois.length, 0, 'aucune réponse à un chiffre isolé');
});
