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
