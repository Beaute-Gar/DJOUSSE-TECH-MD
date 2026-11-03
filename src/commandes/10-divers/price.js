// @legacy-order {"sourceFile":"10-divers/crypto.js","sourceOrder":66,"definitionIndex":0,"entryOrder":124}
'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['price'],
  description: 'Get live cryptocurrency prices',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const coins = (args[0] || 'bitcoin,ethereum,solana').toLowerCase().replace(/\s+/g, ',');
    try {
      const { data } = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd&include_24hr_change=true`,
        { timeout: 10000 },
      );
      if (!data || !Object.keys(data).length) throw new Error('No coins found. Check the coin name.');
      const lines = Object.entries(data).map(([coin, value]) => {
        const price = value.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const change = value.usd_24h_change?.toFixed(2);
        const emoji = change >= 0 ? '📈' : '📉';
        return `${emoji} ${coin.toUpperCase()}: ${price} (${change >= 0 ? '+' : ''}${change}% 24h)`;
      });
      return ctx.reply(style.renderInfo([
        'Crypto Prices',
        '',
        ...lines,
        '',
        'Powered by CoinGecko • DJOUSSE TECH',
      ]));
    } catch (error) {
      return ctx.reply(style.renderError([`Crypto lookup failed: ${error.message}`]));
    }
  },
};
