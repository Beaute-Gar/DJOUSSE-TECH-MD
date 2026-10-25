'use strict';
module.exports = {
  key: 'antisticker',
  label: 'Anti-Sticker',
  detect: (ctx) => (ctx.isSticker ? { reason: 'Les stickers ne sont pas autorisés.' } : null),
};
