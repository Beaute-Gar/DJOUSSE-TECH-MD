const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'work',
  desc: 'Work to earn coins!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const now = Date.now();
  const cooldown = 60 * 60 * 1000;
  const remaining = cooldown - (now - (user.lastWork || 0));

  if (remaining > 0) {
    const minutes = Math.floor(remaining / (1000 * 60));
    return m.reply(boxWithFooter('COOLDOWN', [{ raw: `Work module cooling down. Time remaining: ${minutes}m.` }]));
  }

  const jobs = [
    'Delivered packages across town',
    'Fixed a broken robot circuit',
    'Taught coding to digital chickens',
    'Wrote code for a self-driving pizza',
    'Organized data in the cloud warehouse',
    'Debugged a time-traveling toaster',
    'Painted digital murals for AI gallery',
    'Built a chatbot army for fun',
    'Optimized traffic lights for cats',
    'Serviced spaceship engines',
  ];

  const job = jobs[Math.floor(Math.random() * jobs.length)];
  const reward = Math.floor(Math.random() * 151) + 50;

  user.coins = (user.coins || 0) + reward;
  user.lastWork = now;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(boxWithFooter('WORK COMPLETE', [
    { label: 'Job', value: job },
    { label: 'Earnings', value: `+${reward} coins` },
    { label: 'Total', value: `${user.coins} coins` },
  ]));
});
