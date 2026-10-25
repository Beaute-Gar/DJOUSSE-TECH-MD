'use strict';
module.exports = {
  key: 'antivoice',
  label: 'Anti-Voice',
  detect: (ctx) => (ctx.isVoice ? { reason: 'Les messages vocaux ne sont pas autorisés.' } : null),
};
