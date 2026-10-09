'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('les options welcome et goodbye enregistrees survivent au chargement du handler', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-group-options-'));
  const dataDir = path.join(dir, 'data');
  const sessionDir = path.join(dir, 'session');
  const groupId = '120363000000000000@g.us';
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify({
    groups: {
      [groupId]: {
        welcome: true,
        goodbye: true,
      },
    },
  }));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const output = execFileSync(process.execPath, [
    '-e',
    `const handler = require('./handler'); process.stdout.write(JSON.stringify(handler.state.groups[${JSON.stringify(groupId)}]));`,
  ], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      SESSION_DIR: sessionDir,
    },
    encoding: 'utf8',
  });

  const loadedGroup = JSON.parse(output.slice(output.lastIndexOf('{')));
  assert.equal(loadedGroup.welcome, true);
  assert.equal(loadedGroup.goodbye, true);
});
