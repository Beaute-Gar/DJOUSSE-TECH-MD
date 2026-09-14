const TicTacToe = require('../../utils/tictactoe');

module.exports = {
  name: 'tictactoe',
  aliases: ['tictactoe', 'ttt'],
  category: 'fun',
  desc: 'Jeu du morpion',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!global.tttGames) global.tttGames = new Map();

    const gameKey = ctx.from;

    if (args.length === 0) {
      if (global.tttGames.has(gameKey)) {
        const game = global.tttGames.get(gameKey);
        ctx.reply(`🎮 Morpion en cours\n\n${game.toString()}\n\nJoueur X: @${game.playerX}\nJoueur O: @${game.playerO}\n\nC'est au tour de: ${game.turn === 'X' ? '@' + game.playerX : '@' + game.playerO}\n\nTape .ttt <1-9> pour jouer.`, {
          mentions: [`${game.playerX}@s.whatsapp.net`, `${game.playerO}@s.whatsapp.net`]
        });
      } else {
        ctx.reply('🎮 Pour commencer un morpion, mentionne quelqu\'un :\n.ttt @joueur\n\nOu rejoins un jeu existant avec .ttt');
      }
      return;
    }

    if (args[0] === 'join' || (!global.tttGames.has(gameKey) && args.length === 1 && args[0].startsWith('@'))) {
      let player2;
      if (args[0] === 'join' && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        player2 = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
      } else {
        player2 = args[0].replace(/[^0-9]/g, '');
      }
      const player1 = ctx.sender.split('@')[0];

      if (player1 === player2) return ctx.reply('Tu peux pas jouer contre toi-même !');

      const game = new TicTacToe(player1, player2);
      global.tttGames.set(gameKey, game);
      await ctx.react('🎮');
      ctx.reply(`🎮 Morpion lancé !\n\n${game.toString()}\n\nJoueur X: @${player1}\nJoueur O: @${player2}\n\nC'est au tour de @${player1}\n\nTape .ttt <1-9> pour jouer.`, {
        mentions: [`${player1}@s.whatsapp.net`, `${player2}@s.whatsapp.net`]
      });
      return;
    }

    if (!global.tttGames.has(gameKey)) return ctx.reply('Pas de jeu en cours. Lance un avec .ttt @joueur');
    const game = global.tttGames.get(gameKey);

    if (game.gameOver) {
      global.tttGames.delete(gameKey);
      return ctx.reply('Le jeu est terminé. Lance un nouveau avec .ttt @joueur');
    }

    const position = parseInt(args[0]);
    if (isNaN(position) || position < 1 || position > 9) return ctx.reply('Écris un numéro entre 1 et 9.');

    const sender = ctx.sender.split('@')[0];
    const result = game.makeMove(position, sender);

    if (!result.success) {
      if (result.reason === 'not_your_turn') return ctx.reply('C\'est pas ton tour !');
      if (result.reason === 'already_taken') return ctx.reply('Cette case est déjà prise !');
      return ctx.reply('Erreur...');
    }

    if (result.winner) {
      await ctx.react('🏆');
      ctx.reply(`🏆 BRAVO ! @${result.winner} a gagné !\n\n${game.toString()}`, {
        mentions: [`${result.winner}@s.whatsapp.net`]
      });
      global.tttGames.delete(gameKey);
      return;
    }

    if (result.draw) {
      ctx.reply(`🤝 Match nul !\n\n${game.toString()}`);
      global.tttGames.delete(gameKey);
      return;
    }

    const nextTurn = game.turn === 'X' ? game.playerX : game.playerO;
    ctx.reply(`${game.toString()}\n\nC'est au tour de @${nextTurn}`, {
      mentions: [`${nextTurn}@s.whatsapp.net`]
    });
  }
};
