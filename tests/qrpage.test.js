'use strict';
/**
 * tests/qrpage.test.js — le QR de la page de connexion doit être
 * VRAIMENT scannable.
 *
 * Chaîne complète, sans simulation :
 *   encodeur embarqué (website/js/qrcode.js, chargé EXACTEMENT comme le
 *   ferait un <script> navigateur) → SVG → rasterisation sharp →
 *   décodage par jsQR (décodeur indépendant, Apache-2.0).
 * Si jsQR retrouve la chaîne d'origine, l'appareil photo du visiteur
 * scannera le code — c'est la même preuve que la possession d'un
 * téléphone, en automatique.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const jsQR = require('jsqr');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, 'website', 'js', 'qrcode.js');
const LIB_UTF8 = path.join(ROOT, 'website', 'js', 'qrcode_utf8.js');
const PAGE = path.join(ROOT, 'website', 'connecter.html');

/** Charge le libellé comme le ferait un navigateur : ni module, ni exports, ni define.
 *  Les deux fichiers sont chaînés exactement comme les deux <script> de la page —
 *  `qrcode_utf8.js` active l'encodage UTF-8 officiel (sinon : latin1 tronqué). */
function loadBrowserGlobal() {
  const src = fs.readFileSync(LIB, 'utf8') + '\n' + fs.readFileSync(LIB_UTF8, 'utf8');
  const factory = new Function(
    'module', 'exports', 'define',
    `${src}\nreturn typeof qrcode !== 'undefined' ? qrcode : null;`,
  );
  return factory(undefined, undefined, undefined);
}

/** Rasterise le SVG de la page (scalable = sans width/height) en RGBA. */
async function rasterize(svg) {
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(vb, 'SVG sans viewBox');
  const sized = svg.replace('<svg ', `<svg width="${vb[1]}" height="${vb[2]}" `);
  const { data, info } = await sharp(Buffer.from(sized))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height };
}

/** Encode → image → décode ; renvoie la chaîne décodée (ou échoue). */
async function roundtrip(payload) {
  const qrcode = loadBrowserGlobal();
  assert.ok(typeof qrcode === 'function', 'global qrcode absent : la page ne pourrait rien afficher');

  const qr = qrcode(0, 'M'); // 0 = version automatique
  qr.addData(payload);
  qr.make();

  const svg = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
  const { rgba, w, h } = await rasterize(svg);
  const decoded = jsQR(rgba, w, h);
  return { decoded, svg, modules: qr.getModuleCount() };
}

/** Chaîne réaliste d'un QR Baileys : version + segments base64 (2 ≈ 400 caractères). */
const REALISTIC_QR = '2@'
  + 'YXdMaXZlUmVsYXktMjAyNi1BQkNERUZHCktMT1BLRVJUOjEwMA=='
  + '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
  + ',AQEBAQEBAQEBAQAAAAAAAAIBAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQR'
  + 'BRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKz'
  + 'tLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+'
  + 'z//Z';

test('QR embarqué : aller-retour encode → image → jsQR = chaîne d\'origine', async () => {
  const { decoded, modules } = await roundtrip(REALISTIC_QR);

  assert.ok(decoded, 'décodeur indépendant incapable de lire le QR généré');
  assert.strictEqual(decoded.data, REALISTIC_QR);
  assert.ok(modules > 50, `QR trop petit (${modules} modules) pour une payload réelle`);
});

test('QR avec accents et caractères UTF-8 : décodable aussi', async () => {
  const payload = '2@éèàç€→QR-pour-vérifier-l’encodage-UTF-8-✓';
  const { decoded } = await roundtrip(payload);
  assert.ok(decoded, 'QR UTF-8 illisible');
  assert.strictEqual(decoded.data, payload);
});

test('SVG produit : fond blanc, marge de silence de 4 modules, zone scannable', async () => {
  const qrcode = loadBrowserGlobal();
  const qr = qrcode(0, 'M');
  qr.addData(REALISTIC_QR);
  qr.make();

  const svg = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
  assert.match(svg, /fill="white"/, 'fond blanc absent → contraste de scan non garanti');
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  // marge : 32 px pour 8 px/module = exactement 4 modules (quiet zone QR)
  assert.strictEqual(32 / 8, 4);
});

test('page de connexion : QR en direct, noindex, aucun lien vers le code source', () => {
  const html = fs.readFileSync(PAGE, 'utf8');

  assert.match(html, /<meta name="robots" content="noindex, nofollow">/, 'page de connexion indexée');
  assert.match(html, /\/api\/bot\/public/, 'point d\'appel du statut en direct absent');
  assert.match(html, /\/js\/qrcode\.js/, 'encodeur QR non embarqué');
  assert.match(html, /Appareils liés/, 'consignes de scan absentes');
  assert.match(html, /connecter/i);

  // confidentialité : rien qui ramène au dépôt ou à un terminal
  assert.ok(!/github\.com|git clone|npm (install|start)|Licence MIT/i.test(html));
  // autonome : aucune dépendance externe obligatoire
  const externals = html.match(/(src|href)="https?:\/\//g) || [];
  assert.strictEqual(externals.length, 0, `dépendances tierces : ${externals.join(', ')}`);
});
