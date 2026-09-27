const games = new Map();

const handleGameInput = async (sock, msg, ctx) => {
  const sender = ctx.sender;
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  
  if (games.has(sender)) {
    const game = games.get(sender);
    if (game.type === 'rps') {
      const choices = ['pierre', 'papier', 'ciseaux'];
      const userChoice = body.toLowerCase().trim();
      if (!choices.includes(userChoice)) return false;
      
      const botChoice = pick(choices);
      let result;
      if (userChoice === botChoice) result = 'Égalité !';
      else if (
        (userChoice === 'pierre' && botChoice === 'ciseaux') ||
        (userChoice === 'papier' && botChoice === 'pierre') ||
        (userChoice === 'ciseaux' && botChoice === 'papier')
      ) result = 'Tu as gagné !';
      else result = 'J ai gagné !';
      
      await ctx.reply(`${result}\nToi: ${userChoice}\nMoi: ${botChoice}`);
      games.delete(sender);
      return true;
    }
  }
  
  return false;
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

module.exports = { games, handleGameInput };