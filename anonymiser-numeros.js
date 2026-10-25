#!/usr/bin/env node
'use strict';
/**
 * anonymiser-numeros.js — remplace les vrais numéros WhatsApp par des numéros
 * fictifs dans les fichiers du dépôt (code, tests, docs), avant un push public.
 * Les vrais numéros sont lus dans .env (OWNER_NUMBER, PAIRING_PHONE) ou passés en arguments.
 *
 *   node anonymiser-numeros.js           simulation (n'écrit rien)
 *   node anonymiser-numeros.js --apply   applique
 *
 * Chaque vrai numéro est remplacé par un numéro fictif DISTINCT (les tests qui
 * comparent plusieurs numéros restent valides). Les numéros ne sont jamais
 * affichés : seuls les noms de fichiers et les compteurs le sont.
 * Ne touche pas à .env, storage/, node_modules/, .git/ ni _archive/.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APPLY = process.argv.includes('--apply');
const ROOT = process.cwd();

// Numéros fictifs DISTINCTS (aucun vrai numéro n'est écrit dans ce script)
const FAKES = ['237600111222', '237600333444', '237600555666', '237600777888', '237600999000'];

// Vrais numéros : lus dans .env (OWNER_NUMBER, PAIRING_PHONE, ...) + arguments
//   node anonymiser-numeros.js 237XXXXXXXXX [autre numéro] [--apply]
const real = new Set();
for (const a of process.argv.slice(2)) if (/^\+?\d{9,15}$/.test(a)) real.add(a.replace(/\D/g, ''));
try {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const m of env.matchAll(/^\s*(OWNER_NUMBER|PAIRING_PHONE|SUDO_NUMBERS?|ADMIN_NUMBERS?|BOT_NUMBER)\s*=\s*(.+)$/gm)) {
    for (const n of m[2].replace(/["']/g, '').split(/[,;\s]+/)) { const d = n.replace(/\D/g, ''); if (d.length >= 9) real.add(d); }
  }
} catch (_) { /* pas de .env : numéros à passer en arguments */ }
if (real.size === 0) {
  console.error('Aucun numéro trouvé : renseigne OWNER_NUMBER/PAIRING_PHONE dans .env, ou passe-les en arguments.');
  process.exit(1);
}
if (real.size > FAKES.length) { console.error(`Trop de numéros (${real.size}) : maximum ${FAKES.length}.`); process.exit(1); }
console.log(`${real.size} numéro(s) à anonymiser (valeurs non affichées).`);

const MAP = [...real].map((r, i) => [r, FAKES[i]]);
// forme longue tolérante aux séparateurs (espaces, points, tirets entre les chiffres)
const LONG = MAP.map(([r, f]) => [new RegExp(r.split('').join('[ .\\-]?'), 'g'), f]);
// formes courtes : 9 derniers chiffres et suffixe de 6 chiffres cités dans des commentaires
const SHORT = [];
for (const [r, f] of MAP) {
  SHORT.push([r.slice(-9), f.slice(-9)]);
  SHORT.push([r.slice(-6), f.slice(-6)]);
}
const ALL = [...LONG, ...SHORT]; // formes longues (regex) d'abord, puis suffixes

function listFiles() {
  try {
    const out = execSync('git ls-files -z', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
    return out.split('\0').filter(Boolean);
  } catch (_) {
    const res = [];
    const skip = new Set(['node_modules', '.git', 'storage', '_archive', '.vercel']);
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!skip.has(e.name)) walk(path.join(d, e.name)); }
        else res.push(path.relative(ROOT, path.join(d, e.name)).split(path.sep).join('/'));
      }
    })(ROOT);
    return res;
  }
}

const TEXT = /\.(js|cjs|mjs|json|md|txt|html|css|yml|yaml|toml|cmd|ps1|env\.example|webmanifest|xml)$|^(Procfile|Dockerfile|LICENSE|NOTICE|\.gitignore|\.replit)$/i;
const SKIP = /^(anonymiser-numeros\.js$|\.env($|\.)(?!example)|storage\/|node_modules\/|_archive\/|\.git\/|package-lock\.json$)/;

let changedFiles = 0, replaced = 0;
for (const f of listFiles()) {
  if (SKIP.test(f) || !TEXT.test(path.basename(f)) && !TEXT.test(f)) continue;
  const abs = path.join(ROOT, f);
  let src;
  try { src = fs.readFileSync(abs, 'utf8'); } catch (_) { continue; }
  let out = src;
  let n = 0;
  for (const [from, to] of ALL) {
    if (from instanceof RegExp) {
      const hits = out.match(from);
      if (hits) { n += hits.length; out = out.replace(from, to); }
    } else {
      const parts = out.split(from);
      if (parts.length > 1) { n += parts.length - 1; out = parts.join(to); }
    }
  }
  if (out !== src) {
    changedFiles++; replaced += n;
    console.log(`${APPLY ? 'MODIFIE ' : '[simulation] '}${f}  (${n} remplacement${n > 1 ? 's' : ''})`);
    if (APPLY) fs.writeFileSync(abs, out, 'utf8');
  }
}
console.log(`\n${changedFiles} fichier(s), ${replaced} occurrence(s)${APPLY ? ' remplacée(s).' : ' à remplacer. Relance avec --apply.'}`);
