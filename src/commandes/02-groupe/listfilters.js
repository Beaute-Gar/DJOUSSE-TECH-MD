// @legacy-order {"sourceFile":"02-groupe/advanced-features.js","sourceOrder":4,"definitionIndex":7,"entryOrder":8}
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const style = require('../../config/style');
const { PLUGIN_DATA } = require('../../config/paths');

module.exports = {
  commands: ['listfilters', 'filterlist'],
  description: 'List active word filters in this group',
  permission: 'public',
  group: true,
  run: async (sock, message, args, ctx) => {
    let wordFilters = {};
    try {
      wordFilters = JSON.parse(fs.readFileSync(path.join(PLUGIN_DATA, 'word-filters.json'), 'utf8'));
    } catch {}

    const filters = wordFilters[ctx.jid];
    if (!Array.isArray(filters) || filters.length === 0) {
      return ctx.reply(style.renderInfo([
        'No word filters active in this group.',
        '',
        'Admins can add them with `.addfilter <word>`',
      ]));
    }

    return ctx.reply(style.renderInfo([
      `Word filters (${filters.length})`,
      '',
      ...filters.map((word, index) => `${index + 1}. ${word}`),
      '',
      'Messages containing these words are automatically deleted.',
    ]));
  },
};
