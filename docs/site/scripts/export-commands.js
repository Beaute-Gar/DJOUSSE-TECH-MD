#!/usr/bin/env node
'use strict';

/**
 * Obsolète — conservé comme point d'entrée compatible.
 *
 * L'ancien exporteur attendait `handler.js` à la racine et écrivait dans
 * `website/data/`, deux chemins qui n'existent plus. Le site lit désormais
 * `web/public/data/` et la génération est centralisée dans :
 *
 *   node scripts/export-site-data.js
 *
 * Ce fichier délègue simplement pour ne pas casser les scripts existants.
 * Les options `--bot-root` et `--website-root` ne sont plus utilisées.
 */

const path = require('node:path');

console.log('docs/site/scripts/export-commands.js est obsolète : délégation vers scripts/export-site-data.js');

require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'export-site-data.js'));
