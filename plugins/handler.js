'use strict';
/**
 * Shim DJOUSSE : '../handler'
 *   groupCache : métadonnées de groupe en mémoire (rempli à la demande)
 *   plugins    : registre des plugins chargés
 *   loadPlugins: no-op (le chargement est fait par lib/silva-loader.js)
 */
const groupCache = new Map();
const plugins = new Map();

function loadPlugins() { return plugins; }

module.exports = { groupCache, plugins, loadPlugins };
