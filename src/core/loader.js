import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createLogger } from './logger.js';

const log = createLogger('LOADER');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CMDS_DIR = path.resolve(__dirname, '..', 'commands');

const pluginMap = new Map();
const aliasMap = new Map();

let isLoaded = false;
let loadedAt = null;

async function loadOne(filePath) {
  const filename = path.basename(filePath);
  if (filename.startsWith('_') || filename.startsWith('.')) {
    return { ok: false, name: filename, error: new Error('SKIPPED') };
  }
  let mod;
  try {
    const url = new URL(`${pathToFileURL(filePath)}?t=${Date.now()}`);
    mod = await import(url);
  } catch (err) {
    return { ok: false, name: filename, error: err };
  }
  if (!mod.name || typeof mod.name !== 'string') {
    return { ok: false, name: filename, error: new Error('Export `name` manquant ou invalide') };
  }
  if (typeof mod.handler !== 'function') {
    return { ok: false, name: filename, error: new Error('Export `handler` manquant ou pas une fonction') };
  }
  const cmdName = mod.name.toLowerCase().trim();
  if (pluginMap.has(cmdName)) {
    log.warn(`Conflit : commande "${cmdName}" déjà chargée, ignorée (${filename})`);
    return { ok: false, name: filename, error: new Error(`CONFLICT:${cmdName}`) };
  }
  pluginMap.set(cmdName, { ...mod, _file: filename });
  if (Array.isArray(mod.aliases)) {
    for (const alias of mod.aliases) {
      const a = String(alias).toLowerCase().trim();
      if (a && a !== cmdName) {
        if (aliasMap.has(a)) {
          log.warn(`Alias "${a}" déjà pris, ignoré (${filename})`);
        } else {
          aliasMap.set(a, cmdName);
        }
      }
    }
  }
  return { ok: true, name: cmdName };
}

export async function loadAllPlugins() {
  if (isLoaded) {
    log.warn('loadAllPlugins() appelé plusieurs fois — ignoré');
    return;
  }
  let files;
  try {
    files = await readdir(CMDS_DIR);
  } catch (err) {
    log.error({ err }, `Impossible de lire le dossier commands : ${CMDS_DIR}`);
    return;
  }
  const jsFiles = files.filter(f => f.endsWith('.js')).sort();
  const results = await Promise.allSettled(
    jsFiles.map(f => loadOne(path.join(CMDS_DIR, f)))
  );
  let ok = 0, skipped = 0, failed = 0;
  for (const r of results) {
    const val = r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason };
    if (!val.ok && val.error?.message === 'SKIPPED') { skipped++; continue; }
    if (val.ok) { ok++; continue; }
    failed++;
    log.error(`  ${val.name} — ${val.error?.message ?? 'erreur inconnue'}`);
  }
  isLoaded = true;
  loadedAt = new Date();
  log.info(`Plugins chargés : ${ok} OK | ${skipped} ignorés | ${failed} erreurs`);
  log.info(`${aliasMap.size} alias enregistrés`);
}

export function getPlugin(commandName) {
  if (!commandName) return null;
  const key = commandName.toLowerCase().trim();
  if (pluginMap.has(key)) return pluginMap.get(key);
  const canonical = aliasMap.get(key);
  if (canonical) return pluginMap.get(canonical) ?? null;
  return null;
}

export function getPluginMeta(name) {
  return pluginMap.get(name?.toLowerCase().trim()) || null;
}

export function getPluginNames() {
  return [...pluginMap.keys()].sort();
}
export const getAllCommandNames = getPluginNames;

export function getCommandsByCategory(category) {
  const all = [...pluginMap.values()];
  if (!category) return all;
  return all.filter(p => p.category === category);
}

export function getLoaderStats() {
  return {
    total   : pluginMap.size,
    aliases : aliasMap.size,
    loadedAt: loadedAt?.toISOString() ?? null,
    uptime  : loadedAt ? Math.floor((Date.now() - loadedAt) / 1000) : 0,
  };
}

export async function reloadPlugin(filename) {
  const filePath = path.join(CMDS_DIR, filename.endsWith('.js') ? filename : filename + '.js');
  for (const [key, mod] of pluginMap) {
    if (mod._file === path.basename(filePath)) {
      if (Array.isArray(mod.aliases)) {
        for (const a of mod.aliases) aliasMap.delete(a.toLowerCase());
      }
      pluginMap.delete(key);
      break;
    }
  }
  const result = await loadOne(filePath);
  if (result.ok) return { ok: true, message: `Plugin "${result.name}" rechargé avec succès` };
  return { ok: false, message: `Échec rechargement : ${result.error?.message}` };
}

export async function reloadAll() {
  pluginMap.clear();
  aliasMap.clear();
  isLoaded = false;
  loadedAt = null;
  await loadAllPlugins();
}

export const loadCommands = loadAllPlugins;
