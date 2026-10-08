'use strict';
/**
 * tests/site.test.js — VRAI test du site déployé sur Vercel.
 *
 * Contexte : https://djousse-tech-md.vercel.app/ servait index.js
 * (content-type: application/javascript) puisque vercel.json + website/
 * avaient disparu lors de la restructure du 27/09.
 *
 * Ce test émule RÉELLEMENT la chaîne Vercel : un serveur HTTP qui sert
 * website/ avec la règle de réécriture de vercel.json, puis des requêtes
 * HTTP réelles. Si website/index.html ou vercel.json manquent, il échoue.
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'website');

/** fileURL→chemin local : sert un fichier de website/ SANS jamais en sortir. */
function safeFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  const clean = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(SITE, clean);
  // anti path traversal : le résolu doit rester DANS website/
  if (!full.startsWith(SITE + path.sep) && full !== SITE) return null;
  return full;
}

/** Serveur reproduisant le contrat vercel.json : sortie = website/,
 *  proxy /api/bot/public vers la console (fixture : zéro réseau en test),
 *  rewrites → /index.html pour toute autre route. */
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      // proxy externe de vercel.json — même chemin, même type, même JSON
      if (req.url.split('?')[0] === '/api/bot/public') {
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
          'cache-control': 'no-store',
        });
        res.end(JSON.stringify({
          ok: true,
          online: true,
          connected: false,
          qr: '2@QR-DE-FIXTURE',
          connectMethod: 'qr',
          numberMasked: null,
          lastSeenAt: new Date().toISOString(),
        }));
        return;
      }
      let file = safeFile(req.url);
      if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(SITE, 'index.html'); // rewrite vercel.json
      }
      const ext = path.extname(file).toLowerCase();
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.txt': 'text/plain; charset=utf-8',
        '.xml': 'application/xml; charset=utf-8',
      };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

test('vercel.json : déploie website/ et réécrit tout vers index.html', () => {
  const raw = path.join(ROOT, 'vercel.json');
  assert.ok(fs.existsSync(raw), 'vercel.json absent → Vercel resservirait index.js !');
  const cfg = JSON.parse(fs.readFileSync(raw, 'utf8'));
  assert.strictEqual(cfg.outputDirectory, 'website');
  assert.ok(
    (cfg.rewrites || []).some((r) => r.destination === '/index.html'),
    'réécriture → /index.html manquante',
  );
  // le dossier de sortie doit exister
  assert.ok(
    fs.existsSync(path.join(SITE, 'index.html')),
    'website/index.html absent → le site ne peut pas se construire',
  );
});

test('site : / renvoie la page HTML (plus de code source index.js)', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;

  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  const ctype = res.headers.get('content-type') || '';
  assert.ok(ctype.includes('text/html'), `content-type = ${ctype} (index.js ?)`);

  const body = await res.text();
  assert.ok(!body.trimStart().startsWith("'use strict'"), 'index.js est servi à la place du site !');
  assert.match(body, /<title>DJOUSSE TECH MD/);
  assert.match(body, /<html lang="fr">/);
  // faits réels vérifiés ailleurs (handler.js / npm ls)
  assert.match(body, /Baileys 6\.7\.24/);
  assert.match(body, /309/);
});

test('site : toute route inconnue réécrit vers index.html (pas de 404)', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;

  for (const route of ['/nimporte-quoi', '/commandes', '/menu']) {
    const res = await fetch(base + route);
    assert.strictEqual(res.status, 200, route);
    assert.ok((res.headers.get('content-type') || '').includes('text/html'), route);
  }
});

test('site : aucun secret ni source exposé (path traversal bloqué)', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;

  // marqueurs qui N'existent que dans .env / session/ / index.js
  const ENV_MARKERS = ['VIGIL_PASSWORD=', 'VIGIL_EMAIL=', 'WA_VERSION=', 'messageSecret'];

  for (const evil of ['/..%2F..%2F.env', '/%2e%2e/%2e%2e/session/creds.json', '/../index.js']) {
    const res = await fetch(base + evil);
    const body = await res.text();
    // quelle que soit la tentative, on ne doit recevoir QUE la page du site
    assert.ok(body.trimStart().startsWith('<!DOCTYPE html>'), `fichier hors website/ servi via ${evil}`);
    assert.ok(!body.trimStart().startsWith("'use strict'"), `source index.js exposée via ${evil}`);
    for (const marker of ENV_MARKERS) {
      assert.ok(!body.includes(marker), `secret "${marker}" exposé via ${evil}`);
    }
  }
});

test('site : ressources internes cohérentes (favicon embarqué, pas de dépendance externe)', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;

  const body = await (await fetch(`${base}/`)).text();
  // le site doit être autonome : aucune requête tierce obligatoire
  const externals = body.match(/(src|href)="https?:\/\/(?!github\.com|vigil-delta-lake)/g) || [];
  assert.strictEqual(externals.length, 0, `dépendances externes : ${externals.join(', ')}`);
  assert.match(body, /rel="icon" href="data:image\/svg/);
  // landmark unique attendu par les lecteurs d'écran (Lighthouse)
  assert.match(body, /<main>/);
  assert.match(body, /<\/main>/);
});

test('site : robots.txt + sitemap.xml servis en fichiers (jamais réécrits en HTML)', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;

  const r1 = await fetch(`${base}/robots.txt`);
  assert.strictEqual(r1.status, 200);
  assert.ok((r1.headers.get('content-type') || '').includes('text/plain'));
  const robots = await r1.text();
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.ok(!robots.startsWith('<!DOCTYPE'), 'robots.txt réécrit vers index.html → SEO cassé');

  const r2 = await fetch(`${base}/sitemap.xml`);
  const sitemap = await r2.text();
  assert.ok(sitemap.trimStart().startsWith('<?xml'), 'sitemap.xml réécrit vers index.html');
  assert.match(sitemap, /djousse-tech-md\.vercel\.app/);
});

test('vercel.json : proxy /api/bot/public AVANT la réécriture générique', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const idx = (cfg.rewrites || []).findIndex((r) => r.source === '/api/bot/public');
  assert.ok(idx >= 0, 'proxy vers la console de statut absent');
  assert.strictEqual(
    cfg.rewrites[idx].destination,
    'https://vigil-delta-lake.vercel.app/api/bot/public',
  );
  const catchAll = (cfg.rewrites || []).findIndex((r) => r.source === '/(.*)');
  assert.ok(catchAll >= 0 && idx < catchAll, 'le proxy doit précéder la réécriture générique');
});

test('page connexion : fichier propre + JSON du statut accessible sur le même domaine', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;

  // la page est un fichier réel, pas la réécriture vers l'accueil
  const page = await fetch(`${base}/connecter.html`);
  assert.strictEqual(page.status, 200);
  assert.ok((page.headers.get('content-type') || '').includes('text/html'));
  assert.match(await page.text(), /\/js\/qrcode\.js/);

  // …et le statut en direct arrive en JSON (proxy Vercel simulé ici)
  const api = await fetch(`${base}/api/bot/public`);
  assert.strictEqual(api.status, 200);
  assert.ok((api.headers.get('content-type') || '').includes('application/json'));
  const state = await api.json();
  assert.strictEqual(state.ok, true);
  assert.strictEqual(typeof state.qr, 'string');
});

test('confidentialité : ni dépôt, ni terminal, ni source sur le site', () => {
  const index = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const connect = fs.readFileSync(path.join(SITE, 'connecter.html'), 'utf8');

  for (const [name, html] of [['index.html', index], ['connecter.html', connect]]) {
    assert.ok(!/github\.com/i.test(html), `${name} expose le dépôt`);
    assert.ok(!/git clone|npm install|npm start/i.test(html), `${name} expose le terminal`);
    assert.ok(!/Licence MIT/i.test(html), `${name} annonce la licence du code`);
  }

  // …mais la page de connexion reste bien trouvable depuis l'accueil
  assert.match(index, /href="\/connecter\.html"/, 'CTA « Connecter mon WhatsApp » absent');
  assert.ok(!/id="installation"/.test(index), 'section installation (locale) encore présente');
  assert.match(index, /Branchez WhatsApp en 3 étapes/, 'section connexion orientée site absente');
});
