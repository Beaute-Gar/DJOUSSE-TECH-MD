'use strict';
module.exports = {
  key: 'antitag',
  label: 'Anti-Tag',
  detect: (ctx, g) => (ctx.mentions.length > g.tagMax ? { reason: `Mentions massives (max ${g.tagMax}).` } : null),
};
