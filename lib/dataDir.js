'use strict';
/**
 * lib/dataDir.js — base locale du bot, SÉPARÉE de la session WhatsApp
 *
 *   sessions/djsession/ = credentials WhatsApp uniquement (creds.json,
 *               clés, app-state…) → le seul dossier à effacer pour
 *               réappareiller le bot
 *   data/     = configuration et historiques du bot : state.json,
 *               history.json, guard.json, scheduler.json, store/
 *
 * Avant cette séparation, les deux vivaient côte à côte dans
 * session : « supprime le dossier de session pour corriger un login » emportait
 * avec lui les groupes, les avertissements, les rôles, le blacklist
 * et l'historique. La migration est idempotente et s'exécute une fois
 * au démarrage, avant toute lecture.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const ROOT = path.join(__dirname, '..');
/* path.resolve et NON path.join : si SESSION_DIR / DATA_DIR est un
   chemin ABSOLU (.env), path.join le concatènerait à la racine du
   projet et produirait « …\DJOUSSE-TECH-MD\C:\data ». */
const SESSION_DIR = path.resolve(ROOT, config.sessionDir);
const DATA_DIR = path.resolve(ROOT, config.dataDir);

/* Ce qui appartient à la base locale — et rien d'autre : les
   credentials WhatsApp ne doivent JAMAIS être déplacés ici.
   On garde les NOMS D'ORIGINE (guard.json) même quand la base est
   passée en SQLite : c'est précisément ce qu'on doit récupérer. */
const FILES = [...new Set(['state.json', 'history.json', 'scheduler.json', 'guard.json', config.guard.dbFile])];
const DIRS = ['store'];

/** Chemin absolu d'un élément de la base locale. */
function inData(name) {
  return name ? path.join(DATA_DIR, name) : DATA_DIR;
}

const mtime = (p) => {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
};

/**
 * Migre les anciens fichiers de session → data/. Idempotent.
 *
 *  - la destination n'existe pas → déplacement direct (rapide, same volume)
 *  - les deux existent → le fichier le PLUS RÉCENT gagne : on ne perd
 *    jamais silencieusement une config plus fraîche
 *  - renommage refusé (fichier verrouillé sous Windows) → copie
 *    puis suppression de l'origine
 *
 * @param {string} target  dossier de destination (défaut : data/)
 * @param {string} source  dossier d'origine (défaut : sessions/djsession/)
 * @returns {string[]} éléments réellement déplacés
 */
function migrate(target = DATA_DIR, source = SESSION_DIR) {
  const moved = [];
  try { fs.mkdirSync(target, { recursive: true }); } catch { /* laisser échouer plus bas */ }

  const handle = (name) => {
    const from = path.join(source, name);
    const to = path.join(target, name);
    if (!fs.existsSync(from)) return;
    if (fs.existsSync(to) && mtime(to) >= mtime(from)) return; // data/ déjà à jour
    try {
      if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
      fs.renameSync(from, to);
    } catch {
      try {
        fs.cpSync(from, to, { recursive: true });
        fs.rmSync(from, { recursive: true, force: true });
      } catch (e) {
        console.error(`[DATA] Migration ${name} impossible : ${e.message}`);
        return;
      }
    }
    moved.push(name);
  };

  for (const f of FILES) handle(f);
  for (const d of DIRS) handle(d);

  if (moved.length) console.log(`[DATA] 📦 Base locale migrée → ${target} : ${moved.join(', ')}`);
  return moved;
}

module.exports = { ROOT, SESSION_DIR, DATA_DIR, FILES, DIRS, inData, migrate };
