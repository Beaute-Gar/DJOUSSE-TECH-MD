'use strict';
module.exports = {
  key: 'antiforward',
  label: 'Anti-Forward',
  detect: (ctx) => (ctx.isForwarded ? { reason: 'Les messages transférés ne sont pas autorisés.' } : null),
};
