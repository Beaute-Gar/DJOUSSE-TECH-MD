'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { httpGet } = require('../lib/http-get');

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/json' }).end();
      return;
    }
    if (req.url === '/loop') {
      res.writeHead(302, { Location: '/loop' }).end();
      return;
    }
    if (req.url === '/slow') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      const interval = setInterval(() => res.write('still sending'), 10);
      res.on('close', () => clearInterval(interval));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('parses JSON responses and follows bounded redirects', async () => {
  assert.deepEqual(await httpGet(`${baseUrl}/json`, { json: true }), { ok: true });
  assert.deepEqual(await httpGet(`${baseUrl}/redirect`, { json: true }), { ok: true });
});

test('applies one total timeout to a response that keeps sending data', async () => {
  await assert.rejects(
    httpGet(`${baseUrl}/slow`, { timeoutMs: 50 }),
    /Requête HTTP : délai dépassé \(50 ms\)\./
  );
});

test('rejects redirect loops and unsupported protocols', async () => {
  await assert.rejects(httpGet(`${baseUrl}/loop`, { timeoutMs: 500 }), /trop de redirections/);
  await assert.rejects(httpGet('file:///tmp/image.jpg'), /Protocole HTTP non pris en charge/);
});
