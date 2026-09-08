const pkg = require('whatsapp-web.js/package.json');
console.log('wwebjs version:', pkg.version);
try {
  const pp = require('puppeteer-core/package.json');
  console.log('puppeteer-core version:', pp.version);
} catch {}
try {
  const pp = require('puppeteer/package.json');
  console.log('puppeteer version:', pp.version);
} catch {}
