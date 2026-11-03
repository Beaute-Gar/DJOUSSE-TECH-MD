'use strict';
/**
 * lib/build-info.js — IDENTITÉ DE LA VERSION RÉELLEMENT DÉPLOYÉE
 * ────────────────────────────────────────────────────────────────
 * Le bot affiche dans `.list`, `.menu` et `.info` la version + le commit
 * + la date de build. Sans cela, impossible de distinguer une ancienne
 * version (commandes retirées encore visibles) d'un déploiement à jour.
 *
 * Ordre de résolution du commit :
 *   1. BOT_REVISION (variable explicite) ;
 *   2. RENDER_GIT_COMMIT (Render) ;
 *   3. RAILWAY_GIT_COMMIT_SHA (Railway) ;
 *   4. SOURCE_VERSION / GIT_COMMIT (Heroku, CI) ;
 *   5. git rev-parse --short HEAD (poste local).
 *
 * La date vient de BOT_BUILT_AT, sinon de la mtime d'index.js (date du
 * checkout/déploiement), jamais de l'heure de démarrage : elle reste
 * stable entre deux redémarrages du même build.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');

let pkg = {};
try {
  pkg = require(path.join(ROOT, 'package.json'));
} catch {
  pkg = {};
}

const clean = (value) => String(value || '').trim();

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2500,
    }).toString().trim();
  } catch {
    return '';
  }
}

const revisionBrute = clean(
  process.env.BOT_REVISION ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.SOURCE_VERSION ||
  process.env.GIT_COMMIT,
) || git(['rev-parse', '--short', 'HEAD']);

const revision = revisionBrute.slice(0, 40);
const shortRevision = revisionBrute.slice(0, 7);

const branch = clean(
  process.env.BOT_BRANCH ||
  process.env.RENDER_GIT_BRANCH ||
  process.env.RAILWAY_GIT_BRANCH,
) || git(['rev-parse', '--abbrev-ref', 'HEAD']);

let builtAt = clean(process.env.BOT_BUILT_AT);
if (!builtAt) {
  try {
    builtAt = fs.statSync(path.join(ROOT, 'index.js')).mtime.toISOString();
  } catch {
    builtAt = '';
  }
}

const two = (n) => String(n).padStart(2, '0');
const date = builtAt ? new Date(builtAt) : null;
const dateLabel = date && !Number.isNaN(date.getTime())
  ? `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`
  : 'inconnue';

const version = pkg.version || '0.0.0';
const label = shortRevision ? `${version}+${shortRevision}` : version;

/* Une seule ligne compacte, lisible dans un cadre WhatsApp. */
const infoLine = `${label} · ${dateLabel}${branch ? ` · ${branch}` : ''}`;

module.exports = {
  version,
  revision,
  shortRevision,
  branch,
  builtAt,
  dateLabel,
  label,
  infoLine,
};
