const { cmd } = require('../command.cjs');

cmd({
  pattern: 'rps',
  alias: ['pierre', 'feuille', 'ciseaux'],
  desc: 'Rock Paper Scissors',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const choices = [' Pierre ✊', ' Papier ✋', ' Ciseaux ✌️'];
  const playerChoice = args[0]?.toLowerCase();

  if (!playerChoice || !['pierre', 'rock', 'papier', 'paper', 'feuille', 'ciseaux', 'scissors'].includes(playerChoice)) {
    return m.reply('🤖 [SYSTEM] Usage: .rps <pierre/papier/ciseaux>\n\nExemples:\n.rps pierre\n.rps papier\n.rps ciseaux');
  }

  let playerNum;
  if (['pierre', 'rock'].includes(playerChoice)) playerNum = 0;
  else if (['papier', 'paper', 'feuille'].includes(playerChoice)) playerNum = 1;
  else playerNum = 2;

  const botNum = Math.floor(Math.random() * 3);
  const player = choices[playerNum];
  const bot = choices[botNum];

  let result;
  if (playerNum === botNum) result = '⚖️ MATCH NUL!';
  else if ((playerNum === 0 && botNum === 2) || (playerNum === 1 && botNum === 0) || (playerNum === 2 && botNum === 1))
    result = '🏆 VOUS GAGNEZ!';
  else result = '💀 VOUS PERDEZ!';

  const text = `✊ [ROBOT] ROCK PAPER SCISSORS!\n\nVous :${player}\nBot :${bot}\n\n${result}\n\n⚡ [ROBOT] Jeu terminé.`;
  await m.reply(text);
});
