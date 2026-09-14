module.exports = {
  name: 'bomb',
  aliases: ['bomb'],
  category: 'fun',
  desc: 'Jeu de la bombe',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!global.bombMap) global.bombMap = new Map();

    const gameKey = ctx.from;
    if (global.bombMap.has(gameKey)) {
      const game = global.bombMap.get(gameKey);
      if (game.active) return ctx.reply('Un jeu est déjà en cours ! Coupe la bombe avec .cut');
    }

    const bombPos = Math.floor(Math.random() * 8) + 1;
    const wires = ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚪', '🔴'];
    const wireNames = ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'blanc', 'rouge'];
    const correctWire = wireNames[bombPos - 1];

    global.bombMap.set(gameKey, {
      active: true,
      bombPos,
      correctWire,
      startTime: Date.now()
    });

    const wireList = wires.map((w, i) => `${i + 1}. ${w}`).join('\n');
    await ctx.react('💣');
    ctx.reply(`💣 JEU DE LA BOMBE 💣\n\nCoupe le bon fil avant que le temps soit écoulé !\n\n${wireList}\n\nTape .cut <numéro> pour couper un fil.\n⏰ Tu as 30 secondes !`);
  }
};
