const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'create',
  react: '👥',
  desc: 'Créer un groupe WhatsApp',
  category: 'admin',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply(box('👥 *GROUP CREATION*', [
    { raw: '.create <Nom>' }, { raw: '.create <Nom> add <num1,num2>' },
  ]));
  let groupName = q; let numbersToAdd = [];
  if (q.includes('add')) {
    const [namePart, numberPart] = q.split('add');
    groupName = namePart.trim();
    numbersToAdd = numberPart.split(',').map(num => num.replace(/[^0-9]/g, '') + '@s.whatsapp.net').filter(id => id.length > 15);
  }
  try {
    const response = await conn.groupCreate(groupName, []);
    if (numbersToAdd.length > 0) await conn.groupParticipantsUpdate(response.gid, numbersToAdd, 'add');
    reply(box('✅ *GROUPE CRÉÉ*', [
      { label: 'Nom', value: groupName }, { label: 'ID', value: response.gid },
    ]));
  } catch (err) { reply('❌ Erreur lors de la création.'); }
});
