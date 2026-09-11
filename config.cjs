// Single source of truth — all config lives in config-djousse.cjs
// This file re-exports it so legacy plugins that import config.cjs still work.
module.exports = require('./config-djousse.cjs');
