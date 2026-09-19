const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'calc',
  alias: ['calculator'],
  desc: 'Calculatrice',
  category: 'util',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  if (!args.length) return reply(box('CALCULETTE', [{ raw: 'Ex: .calc 2 + 2' }]));
  const expr = args.join(' ');
  try {
    const sanitized = expr.replace(/[^0-9+\-*/().%]/g, '');
    if (!sanitized) return reply(box('ERROR', [{ raw: 'Expression invalide.' }]));
    const result = Function('"use strict"; return (' + sanitized + ')')();
    if (typeof result !== 'number' || isNaN(result)) return reply(box('ERROR', [{ raw: 'Résultat invalide.' }]));
    await react('🔢');
    return reply(box('CALCULETTE', [
      { label: 'Expression', value: expr },
      { label: 'Résultat', value: result },
    ]));
  } catch {
    return reply(box('ERROR', [{ raw: 'Erreur dans le calcul...' }]));
  }
});
