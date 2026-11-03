'use strict';

const style = require('../../config/style');

module.exports = [
  {
    commands: ['crypto', 'bitcoin', 'btc'],
    description: 'Crypto info',
    permission: 'public',
    run: async (sock, message, args, ctx) => {
      const coins = {
        btc: { name: 'Bitcoin', symbol: 'BTC', created: 2009, creator: 'Satoshi Nakamoto', max: '21 million', consensus: 'Proof of Work' },
        eth: { name: 'Ethereum', symbol: 'ETH', created: 2015, creator: 'Vitalik Buterin', max: 'No cap', consensus: 'Proof of Stake' },
        bnb: { name: 'BNB', symbol: 'BNB', created: 2017, creator: 'Changpeng Zhao', max: '200 million', consensus: 'Proof of Stake' },
        sol: { name: 'Solana', symbol: 'SOL', created: 2020, creator: 'Anatoly Yakovenko', max: 'No cap', consensus: 'Proof of History' },
        ada: { name: 'Cardano', symbol: 'ADA', created: 2017, creator: 'Charles Hoskinson', max: '45 billion', consensus: 'Proof of Stake' },
        xrp: { name: 'XRP', symbol: 'XRP', created: 2012, creator: 'Chris Larsen', max: '100 billion', consensus: 'Consensus Protocol' },
        doge: { name: 'Dogecoin', symbol: 'DOGE', created: 2013, creator: 'Billy Markus', max: 'No cap', consensus: 'Proof of Work' },
        dot: { name: 'Polkadot', symbol: 'DOT', created: 2020, creator: 'Gavin Wood', max: 'No cap', consensus: 'Nominated PoS' },
        matic: { name: 'Polygon', symbol: 'MATIC', created: 2020, creator: 'Sandeep Nailwal', max: '10 billion', consensus: 'Proof of Stake' },
        avax: { name: 'Avalanche', symbol: 'AVAX', created: 2020, creator: 'Emin Gün Sirer', max: '720 million', consensus: 'Avalanche Consensus' },
      };
      const coin = coins[(args[0] || 'btc').toLowerCase()];
      if (!coin) return ctx.reply(style.renderError([
        `Usage: .crypto <symbol>\nCoins: ${Object.keys(coins).join(', ')}`,
      ]));
      return ctx.reply(style.renderInfo([
        `💰 ${coin.name} (${coin.symbol})`,
        '',
        `Created: ${coin.created}`,
        `Creator: ${coin.creator}`,
        `Max Supply: ${coin.max}`,
        `Consensus: ${coin.consensus}`,
      ]));
    },
  },
  {
    commands: ['invest', 'investtip', 'investadvice'],
    description: 'Investment tip',
    permission: 'public',
    run: async (sock, message, args, ctx) => {
      const tips = [
        "Never invest money you can't afford to lose.",
        'Diversify your portfolio across different asset classes.',
        'Start investing early — compound interest is powerful.',
        "Don't try to time the market, invest consistently.",
        'Understand what you invest in before putting money in.',
        'Keep an emergency fund before investing.',
        "Past performance doesn't guarantee future results.",
        'Low-cost index funds beat most active managers.',
        'Reinvest dividends for faster growth.',
        'Review your portfolio quarterly, not daily.',
        'Dollar-cost averaging reduces timing risk.',
        'Pay off high-interest debt before investing.',
        'Tax-advantaged accounts should be used first.',
        "Don't let emotions drive investment decisions.",
        'Long-term investing beats short-term trading.',
      ];
      return ctx.reply(style.renderInfo([
        'Investment Tip',
        '',
        `💡 ${tips[Math.floor(Math.random() * tips.length)]}`,
        '',
        'This is educational, not financial advice!',
      ]));
    },
  },
  null,
  null,
  null,
  null,
  {
    commands: ['split', 'splitbill', 'billsplit'],
    description: 'Bill splitter',
    permission: 'public',
    run: async (sock, message, args, ctx) => {
      const [total, people, tipPct] = args.map(Number);
      if (Number.isNaN(total) || Number.isNaN(people) || people < 1) {
        return ctx.reply(style.renderError(['Usage: .split <total> <people> [tip%]']));
      }
      const tip = tipPct ? total * tipPct / 100 : 0;
      const grandTotal = total + tip;
      const perPerson = grandTotal / people;
      return ctx.reply(style.renderInfo([
        'Bill Splitter',
        '',
        `Bill: $${total.toFixed(2)}`,
        ...(tip ? [`Tip (${tipPct}%): $${tip.toFixed(2)}`] : []),
        `Total: $${grandTotal.toFixed(2)}`,
        `People: ${people}`,
        '',
        `Each pays: $${perPerson.toFixed(2)}`,
      ]));
    },
  },
  null,
  null,
  null,
];
