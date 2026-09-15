const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({ pattern: 'base64', alias: ['b64', 'b64encode', 'b64decode', 'base64encode', 'base64decode'], react: '🔤', desc: 'Encode ou décode un texte en base64 (décodage auto si texte encodé)', category: 'math', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  try {
    if (!q) return reply(box('🔤 *BASE64*', [
      { raw: 'Utilisation :' },
      { raw: '.base64 <texte> → encode' },
      { raw: '.base64 <texte encodé> → décode' },
    ]));
    const clean = q.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(clean) && clean.length % 4 === 0 && clean.length > 4) {
      const decoded = Buffer.from(clean, 'base64').toString('utf-8');
      if (decoded.length > 0 && !decoded.includes('\u0000')) {
        return reply(box('🔓 *BASE64 DÉCODÉ*', [
          { raw: decoded },
        ]));
      }
    }
    reply(box('🔐 *BASE64 ENCODÉ*', [
      { raw: Buffer.from(q).toString('base64') },
    ]));
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});
