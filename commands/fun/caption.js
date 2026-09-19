const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'caption',
  alias: ['légende'],
  desc: 'Generate funny caption for image',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const captions = [
    'Quand tu essaies de comprendre le code à 3h du matin.',
    'Moi regardant mon code fonctionner du premier coup.',
    'Le moment où tu realises que tu as oublié le point-virgule.',
    'Quand le client dit "c\'est un bug simple" mais c\'est un bug complexe.',
    'Le visage quand le build réussit après 47 tentatives.',
    'Quand tu trouves enfin le bug et c\'est une faute de frappe.',
    'Le développeur qui dit "ça marche sur ma machine".',
    'Quand tu push en production le vendredi soir.',
    'Le moment où tu comprends que le problème était une variable globale.',
    'Quand tu copies-colle depuis Stack Overflow et que ça marche.'
  ];

  const text = boxWithFooter('📸 LÉGENDE GÉNÉRÉE', [
    { raw: `"${captions[Math.floor(Math.random() * captions.length)]}"` },
  ]);
  await m.reply(text);
});
