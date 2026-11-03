'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['wikipedia', 'search'],
  description: 'Search Wikipedia for any topic',
  usage: '.search <topic>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const query = args.join(' ').trim();
    if (!query) {
      return ctx.reply(style.renderError(['Indique un sujet. Exemple : .search Black holes']));
    }

    try {
      const { data: searchData } = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'search',
          srsearch: query,
          format: 'json',
          srlimit: 1,
        },
        timeout: 10000,
      });
      const title = searchData?.query?.search?.[0]?.title;
      if (!title) return ctx.reply(style.renderError([`Aucun résultat trouvé pour « ${query} ».`]));

      const { data } = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { timeout: 10000 },
      );
      const displayTitle = data.displaytitle || title;
      const extract = String(data.extract || '').slice(0, 1200);
      const truncated = (data.extract?.length || 0) > 1200 ? '\n_[Lire la suite sur Wikipédia]_' : '';
      const pageUrl = data.content_urls?.desktop?.page
        || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      const report = style.renderInfo([
        displayTitle,
        '',
        extract,
        truncated,
        '',
        pageUrl,
      ].filter((line) => line !== undefined));

      if (data.thumbnail?.source) {
        try {
          const imageUrl = new URL(data.thumbnail.source);
          if (imageUrl.protocol === 'https:') {
            return await ctx.sock.sendMessage(ctx.from, {
              image: { url: imageUrl.toString() },
              caption: report,
            }, { quoted: ctx.msg });
          }
        } catch (error) {
          console.warn('[WIKIPEDIA] thumbnail could not be sent:', error.message);
        }
      }
      return ctx.reply(report);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn('[WIKIPEDIA] lookup failed:', error.message);
        return ctx.reply(style.renderError(['La recherche Wikipédia a échoué. Réessaie plus tard.']));
      }
      return ctx.reply(style.renderError([`Aucune page Wikipédia trouvée pour « ${query} ».`]));
    }
  },
};
