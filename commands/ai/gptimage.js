const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'gptimage',
  desc: 'Génère une image avec l\'IA (gratuit, sans clé API)',
  category: 'ai',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  const prompt = args.join(' ');
  if (!prompt) return reply(boxWithFooter('GPTIMAGE', [
    { cmd: 'gptimage', desc: 'un chat dans l\'espace' },
  ]));
  try {
    await react('🎨');
    // Import dynamique car g4f-image est un package ESM
    const g4f = await import('g4f-image');
    const generate = g4f.generate || (g4f.default && g4f.default.generate);
    if (!generate) throw new Error('Module g4f-image non disponible');
    const imageUrl = await generate(prompt);
    if (!imageUrl) throw new Error('Aucune image générée');
    await conn.sendMessage(from, {
      image: { url: imageUrl },
      caption: box('IMAGE', [{ label: 'Prompt', value: prompt }]),
    });
  } catch (err) {
    console.error('[GPTIMAGE]', err.message);
    return reply(boxWithFooter('ERROR', [{ raw: '❌ Erreur de génération: ' + err.message }]));
  }
});
