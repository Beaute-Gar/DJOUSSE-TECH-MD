'use strict';
module.exports = {
  key: 'antipoll',
  label: 'Anti-Sondage',
  detect: (ctx) => (ctx.isPoll ? { reason: 'Les sondages ne sont pas autorisés.' } : null),
};
