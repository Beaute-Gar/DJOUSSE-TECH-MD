'use strict';
module.exports = {
  key: 'antimedia',
  label: 'Anti-Media',
  detect: (ctx) => (ctx.isMedia && !ctx.isVoice && !ctx.isSticker ? { reason: 'Les médias ne sont pas autorisés.' } : null),
};
