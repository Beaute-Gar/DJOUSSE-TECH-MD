'use strict';
module.exports = {
  key: 'anticontact',
  label: 'Anti-Contact',
  detect: (ctx) => (ctx.isContact ? { reason: 'Le partage de contacts n\'est pas autorisé.' } : null),
};
