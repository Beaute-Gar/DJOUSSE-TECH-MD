'use strict';
const { findLinks } = require('../utils/links');
module.exports = {
  key: 'antilink',
  label: 'Anti-Link',
  reason: 'Les liens ne sont pas autorisés dans ce groupe.',
  detect: (ctx, g) => (findLinks(ctx.text, g.linkWhitelist).length ? { reason: module.exports.reason } : null),
};
