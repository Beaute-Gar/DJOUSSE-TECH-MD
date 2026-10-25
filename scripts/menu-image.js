'use strict';
/**
 * scripts/menu-image.js — génère l'image d'affichage du menu
 * ────────────────────────────────────────────────────────────────
 * Effet : « anonymous hacker avatars cyan neon »
 *   https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html
 *
 * Protocole officiel du site (reconstitué à partir de ses propres scripts,
 * testé réellement de bout en bout) :
 *
 *   1. GET la page effet          → cookies de session + token + build_server
 *                                   + l'UUID du style choisi ;
 *   2. POST le formulaire         → page « résultat » qui embarque un JSON de
 *                                   rendu (#form_value_input) avec un token
 *                                   chiffré côté serveur ;
 *   3. POST /effect/create-image  → en boucle (1 s) jusqu'à { success: true },
 *                                   puis télécharger build_server + result.image.
 *
 * USAGE
 *   node scripts/menu-image.js [texte] [fichier-sortie]
 *     défauts : texte « DJOUSE TECH » · sortie src/assets/menu-hacker.jpg
 *
 * Le bot n'exécute JAMAIS ce script au démarrage : l'image est statique,
 * le mode « local » du menu l'affiche, et la chaîne de repli existante
 * (fichiers locaux → bannière) reste intacte si le fichier venait à manquer.
 *
 * Requiert Node ≥ 18 (fetch global) — aucune dépendance externe.
 */

const fs = require('node:fs');
const path = require('node:path');

const PAGE_URL = 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html';
const CREATE_URL = 'https://en.ephoto360.com/effect/create-image';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const POLL_MS = 1000;
const POLL_MAX_MS = 90000; // ephoto360 met souvent 15–45 s à rendre

/* ── Cookies (le site exige la session pour accepter le formulaire) ── */

/** Scission robuste de header Set-Cookie multiples (virgules de dates incluses). */
function parseSetCookies(headerValues) {
  const out = new Map();
  for (const raw of headerValues) {
    for (const part of String(raw).split(/,(?=[^;\s]+=)/)) {
      const [pair] = part.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) out.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  return out;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/* ── Extraction des champs du formulaire ── */

function attr(html, name) {
  const m = html.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`));
  if (!m) throw new Error(`champ « ${name} » introuvable dans la page effet`);
  return m[1];
}

/** UUID du style sélectionné (celui coché par défaut, sinon le premier). */
function firstRadioUuid(html) {
  const inputs = [...html.matchAll(/<input[^>]*name="radio0\[radio\]"[^>]*>/g)].map((m) => m[0]);
  if (!inputs.length) throw new Error('aucun style (radio0[radio]) dans la page effet');
  const chosen = inputs.find((t) => t.includes('checked')) || inputs[0];
  const v = chosen.match(/value="([0-9a-f-]{36})"/);
  if (!v) throw new Error('style (radio0[radio]) sans value= exploitable');
  return v[1];
}

/** Récupère le JSON de rendu embarqué dans la page résultat (#form_value_input). */
function resultPayload(html) {
  const m = html.match(/name="form_value_input"\s+value="([^"]*)"/);
  if (!m) throw new Error('page résultat sans #form_value_input (formulaire refusé ?)');
  return m[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'");
}

/* ── Étape 1 + 2 : page effet → formulaire → page résultat ── */

async function startGeneration(text) {
  const jar = new Map();
  const headers = { 'User-Agent': UA };

  const pageRes = await fetch(PAGE_URL, { headers });
  if (!pageRes.ok) throw new Error(`GET page effet : HTTP ${pageRes.status}`);
  const setCookies = typeof pageRes.headers.getSetCookie === 'function'
    ? pageRes.headers.getSetCookie()
    : (pageRes.headers.get('set-cookie') ? [pageRes.headers.get('set-cookie')] : []);
  for (const [k, v] of parseSetCookies(setCookies)) jar.set(k, v);
  const html = await pageRes.text();

  const token = attr(html, 'token');
  const buildServer = attr(html, 'build_server');
  const buildServerId = attr(html, 'build_server_id');
  const radio = firstRadioUuid(html);

  const body = new URLSearchParams({
    'radio0[radio]': radio,
    'text[]': text,
    submit: 'GO',
    token,
    build_server: buildServer,
    build_server_id: buildServerId,
  });

  const postRes = await fetch(PAGE_URL, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': PAGE_URL,
      'Origin': 'https://en.ephoto360.com',
      'Cookie': cookieHeader(jar),
    },
    body,
  });
  const resultHtml = await postRes.text();
  const payload = resultPayload(resultHtml);
  JSON.parse(payload); // validation : c'est bien du JSON
  return { payload, cookie: cookieHeader(jar) };
}

/** Sérialise le JSON de rendu comme le fait jQuery ($.param) : objets →
 *  `clé[sous]=…`, tableaux → `clé[]=…` (PHP lit du form-data, pas du JSON). */
function toFormBody(json) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(json)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(`${k}[]`, x));
    else if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) p.append(`${k}[${k2}]`, v2);
    else p.append(k, v);
  }
  return p.toString();
}

/* ── Étape 3 : boucle create-image jusqu'à success ── */

async function waitForImage(payload, cookie) {
  const form = toFormBody(JSON.parse(payload));
  const deadline = Date.now() + POLL_MAX_MS;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(CREATE_URL, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': PAGE_URL,
          'Origin': 'https://en.ephoto360.com',
          'Cookie': cookie, // le token du payload est lié à la session
        },
        body: form,
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success === true && json.image) {
          const { build_server: buildServer } = JSON.parse(payload);
          return `${buildServer}${json.image}`;
        }
      }
      lastErr = res.ok ? `success=false (HTTP ${res.status})` : `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`rendu non abouti après ${POLL_MAX_MS / 1000} s (${lastErr || 'aucune réponse'})`);
}

/** Identifie réellement le format d'un buffer (PNG / JPEG) — test d'intégrité. */
function sniffImage(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Largeur/hauteur : IHDR pour PNG, segment SOF pour JPEG. */
function imageSize(buf) {
  const kind = sniffImage(buf);
  if (kind === 'png') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (kind === 'jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

async function main() {
  const text = process.argv[2] || 'DJOUSE TECH';
  const outRel = process.argv[3] || 'src/assets/menu-hacker.jpg';
  const out = path.resolve(__dirname, '..', outRel);

  console.log(`[MENU-IMG] Génération « ${text} » → ${outRel}`);
  const { payload, cookie } = await startGeneration(text);
  console.log('[MENU-IMG] Formulaire accepté — rendu en cours (15 à 45 s)…');
  const url = await waitForImage(payload, cookie);
  console.log(`[MENU-IMG] Image produite : ${url}`);

  const imgRes = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!imgRes.ok) throw new Error(`téléchargement : HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new Error('le fichier reçu n\'est pas une image (magic bytes inconnus)');
  const dim = imageSize(buf);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`[MENU-IMG] ✅ ${path.basename(out)} — ${kind.toUpperCase()} ${(buf.length / 1024).toFixed(1)} Ko`
    + (dim ? ` — ${dim.w}×${dim.h}` : ''));
}

main().catch((e) => {
  console.error(`[MENU-IMG] ❌ ${e.message}`);
  process.exitCode = 1;
});
