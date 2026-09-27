'use strict';

const fetch = globalThis.fetch || (() => { throw new Error('fetch not available'); });

async function stockQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const meta = data.chart.result[0].meta;
    return {
      ok: true,
      name: meta.shortName || meta.symbol,
      symbol: meta.symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency,
      change: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2) + '%',
      marketState: meta.marketState
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function cryptoQuote(sym) {
  try {
    const id = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', doge: 'dogecoin', bnb: 'binancecoin', xrp: 'ripple', ada: 'cardano', dot: 'polkadot', avax: 'avalanche-2', matic: 'matic-network' }[sym.toLowerCase()] || sym.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await res.json();
    return {
      ok: true,
      name: d.name,
      symbol: d.symbol.toUpperCase(),
      price_usd: '$' + d.market_data.current_price.usd.toLocaleString(),
      price_xof: d.market_data.current_price.xof ? d.market_data.current_price.xof.toLocaleString() + ' FCFA' : '',
      change24h: d.market_data.price_change_percentage_24h?.toFixed(2) + '%',
      change7d: d.market_data.price_change_percentage_7d?.toFixed(2) + '%',
      market_cap: '$' + d.market_data.market_cap.usd.toLocaleString(),
      vol24h: '$' + d.market_data.total_volume.usd.toLocaleString()
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function goldPrice() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await res.json();
    const price = d['tether-gold']?.usd;
    if (price) return { ok: true, name: 'Gold (XAUT)', usd_per_oz: price.toLocaleString() + ' USD/oz' };
    const res2 = await fetch('https://data-asg.goldprice.org/dbXRates/USD', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d2 = await res2.json();
    const g = d2?.items?.[0]?.xauPrice;
    if (g) return { ok: true, name: 'Gold (XAU)', usd_per_oz: g.toFixed(2) + ' USD/oz' };
    return { ok: false, error: 'Prix de l\'or non disponible' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function forexRate(from, to) {
  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await res.json();
    const rate = d.rates[to.toUpperCase()];
    if (!rate) return { ok: false, error: `Paire ${from}-${to} non trouvée` };
    return { ok: true, from: from.toUpperCase(), to: to.toUpperCase(), rate: rate.toFixed(4) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { stockQuote, cryptoQuote, goldPrice, forexRate };
