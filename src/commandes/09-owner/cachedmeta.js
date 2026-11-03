// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":479}
'use strict';

const createOwnerSetting = require('./_owner-setting');

module.exports = createOwnerSetting({
  command: 'cachedmeta',
  description: 'Show group metadata cache information',
  usage: '.cachedmeta',
  run() {
    const { groupCache } = require('../_partage/handler');
    const size = groupCache ? groupCache.size : 'N/A';
    return {
      lines: [
        'CACHE INFO',
        `CACHED GROUPS: ${size}`,
        'TTL: 5 MINUTES',
      ],
    };
  },
});
