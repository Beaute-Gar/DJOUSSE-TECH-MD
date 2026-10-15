'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { it } = require('node:test');

it('charge la configuration depuis ENV_FILE pour isoler chaque processus', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-env-'));
  const envFile = path.join(tempDir, '.env.instance');
  fs.writeFileSync(envFile, 'PREFIX=~\nCONNECT_METHOD=qr\nPAIRING_PHONE=237690000000\n');

  try {
    const env = { ...process.env, ENV_FILE: envFile };
    delete env.PREFIX;
    delete env.CONNECT_METHOD;
    delete env.PAIRING_PHONE;
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `const config = require(${JSON.stringify(path.resolve(__dirname, '../config.js'))});` +
          'process.stdout.write(JSON.stringify({ prefix: config.prefix, method: config.connectMethod, phone: config.pairingPhone }));',
      ],
      { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      prefix: '~',
      method: 'qr',
      phone: '237690000000',
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

/* MODE / PUBLIC_MODE : le mode public ouvre le bot à tout le monde, le
   mode self le réserve au propriétaire. PUBLIC_MODE a la priorité. */
function lirePublicMode(vars) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-env-'));
  const envFile = path.join(tempDir, '.env.instance');
  fs.writeFileSync(envFile, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  try {
    const env = { ...process.env, ENV_FILE: envFile };
    delete env.MODE;
    delete env.PUBLIC_MODE;
    delete env.FORCE_PUBLIC;
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `const config = require(${JSON.stringify(path.resolve(__dirname, '../config.js'))});` +
          'process.stdout.write(JSON.stringify({ publicMode: config.publicMode, selfMode: config.selfMode }));',
      ],
      { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

it('MODE=public → publicMode activé (tout le monde peut commander)', () => {
  assert.deepEqual(lirePublicMode({ MODE: 'public' }), { publicMode: true, selfMode: false });
});

it('MODE=self → publicMode désactivé (bot réservé au propriétaire)', () => {
  assert.deepEqual(lirePublicMode({ MODE: 'self' }), { publicMode: false, selfMode: true });
});

it('PUBLIC_MODE=on force le public même sans MODE', () => {
  assert.deepEqual(lirePublicMode({ PUBLIC_MODE: 'on' }), { publicMode: true, selfMode: false });
});

it('aucun mode → publicMode désactivé par défaut (sécurité)', () => {
  assert.deepEqual(lirePublicMode({}), { publicMode: false, selfMode: false });
});

it('HYBRID_MODE=on → Baileys lancé en plus de l’agent officiel', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-env-'));
  const envFile = path.join(tempDir, '.env.instance');
  fs.writeFileSync(envFile, 'AGENT_MODE=on\nHYBRID_MODE=on\n');
  try {
    const env = { ...process.env, ENV_FILE: envFile };
    delete env.AGENT_MODE;
    delete env.HYBRID_MODE;
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `const config = require(${JSON.stringify(path.resolve(__dirname, '../config.js'))});` +
          'process.stdout.write(JSON.stringify({ agentMode: config.agentMode, hybridMode: config.hybridMode }));',
      ],
      { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { agentMode: true, hybridMode: true });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

it('hybridMode désactivé par défaut (l’agent seul ne lance pas Baileys)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-env-'));
  const envFile = path.join(tempDir, '.env.instance');
  fs.writeFileSync(envFile, 'AGENT_MODE=on\n');
  try {
    const env = { ...process.env, ENV_FILE: envFile };
    delete env.AGENT_MODE;
    delete env.HYBRID_MODE;
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `const config = require(${JSON.stringify(path.resolve(__dirname, '../config.js'))});config.hybridMode === false ? process.stdout.write('ok') : process.stdout.write('ko');`,
      ],
      { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'ok');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
