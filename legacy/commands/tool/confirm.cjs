const { cmd } = require('../command.cjs');
const confirm = require('../lib/confirm.cjs');

cmd({ pattern: 'confirm', desc: 'Confirmer une action destructrice en attente (.delall, .broadcast...)', category: 'ownertools', filename: __filename, fromMe: true, usage: '.confirm' }, async (conn, m) => {
  await confirm.run(conn, m);
});