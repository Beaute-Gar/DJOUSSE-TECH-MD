'use strict';
/** Le guard n'a PAS de config propre : tout vient du config.js racine (owner, préfixe, bloc `guard`). */
const root = require('../../config');

module.exports = {
  prefix: root.prefix,
  owners: root.ownerNumber,
  botName: root.botName,
  ...root.guard,
  metaTtlMs: 60 * 1000,
};
