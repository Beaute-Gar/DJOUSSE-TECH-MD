'use strict';

const axios = require('axios');
const config = require('../../config/config');
const style = require('../../config/style');

const FEEDS = {
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  africa: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
  business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
  sports: 'https://feeds.bbci.co.uk/sport/rss.xml',
};

module.exports = {
  commands: ['news', 'headlines'],
  description: 'Get latest news headlines',
  usage: '.news [world|tech|africa|business|sports]',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const category = String(args[0] || 'world').toLowerCase();
    if (!Object.hasOwn(FEEDS, category)) {
      return ctx.reply(style.renderError([`Catégorie invalide. Choisis : ${Object.keys(FEEDS).join(', ')}.`]));
    }

    try {
      const { data } = await axios.get('https://api.rss2json.com/v1/api.json', {
        params: { rss_url: FEEDS[category], count: 5 },
        timeout: 12000,
      });
      if (Array.isArray(data?.items) && data.items.length) {
        const lines = data.items.slice(0, 5).map((item, index) =>
          `${index + 1}. *${item.title || 'Untitled'}*\n   🔗 ${item.link || ''}`);
        return ctx.reply(style.renderInfo([
          `Latest News — ${category.toUpperCase()}`,
          '',
          ...lines.flatMap((line) => line.split('\n')),
          '',
          `Categories: ${Object.keys(FEEDS).join(' | ')}`,
          `Powered by BBC • ${config.botName}`,
        ]));
      }
    } catch (error) {
      console.warn('[NEWS] BBC feed failed; trying configured fallback.', error?.code || error?.name || 'unknown error');
    }

    if (config.gnewsKey) {
      try {
        const { data } = await axios.get('https://gnews.io/api/v4/top-headlines', {
          params: { category, lang: 'en', max: 5, apikey: config.gnewsKey },
          timeout: 15000,
        });
        if (Array.isArray(data?.articles) && data.articles.length) {
          const articles = data.articles.slice(0, 5).map((article, index) => {
            const title = String(article.title || '').slice(0, 150);
            const source = article.source?.name ? ` (${article.source.name})` : '';
            const description = String(article.description || '').slice(0, 200);
            return `*${index + 1}.* ${title}${source}\n   🔗 ${article.url || ''}\n   ${description}`;
          });
          return ctx.reply(style.renderInfo([
            `GNews : ${category.toUpperCase()}`,
            '',
            ...articles.flatMap((article) => article.split('\n')),
          ]));
        }
      } catch (error) {
        console.warn('[NEWS] GNews fallback failed.', error?.code || error?.name || 'unknown error');
      }
    }

    return ctx.reply(style.renderError([
      `Impossible de récupérer les actualités ${category.toUpperCase()} pour le moment. Réessaie plus tard.`,
    ]));
  },
};
