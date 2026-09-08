const dl = require('../lib/dl.cjs');

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.log('Usage : node scripts/test-dl.cjs <url> [--audio]');
    process.exit(1);
  }
  const audioOnly = process.argv.includes('--audio');
  const res = await dl.downloadPlatform(url, audioOnly);
  console.log('URL        : ' + url);
  console.log('PLATEFORME : ' + res.platform);
  if (!res.ok) {
    console.log('RESULTAT   : ÉCHEC (' + res.error + ')');
    console.log('DURÉE      : ' + res.durationMs + 'ms');
    process.exit(1);
  }
  console.log('PROVIDER   : ' + res.provider);
  console.log('TYPE       : ' + res.type);
  const detected = dl.detectMimetype(res.buffer);
  console.log('MIME       : ' + detected.mimetype + (res.type === detected.type ? '' : ' (détecté: ' + detected.type + ')'));
  console.log('TAILLE     : ' + (res.buffer.length / 1048576).toFixed(2) + ' Mo');
  console.log('TITRE      : ' + (res.title || '').slice(0, 120));
  console.log('DURÉE      : ' + res.durationMs + 'ms');
  process.exit(0);
})();