'use strict';

const axios = require('axios');
const style = require('../../config/style');

function parseDomain(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    const domain = url.hostname.toLowerCase();
    const labels = domain.split('.');
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || labels.length < 2
      || domain.length > 253
      || labels.some((label) => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) {
      return null;
    }
    return domain;
  } catch {
    return null;
  }
}

module.exports = {
  commands: ['domain', 'domaininfo'],
  description: 'WHOIS lookup for a domain',
  usage: '.domain <domain>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const domain = parseDomain(args.join(' '));
    if (!domain) {
      return ctx.reply(style.renderError(['Indique un nom de domaine valide. Exemple : .domain google.com']));
    }

    try {
      const { data } = await axios.get(
        `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        { timeout: 15000 },
      );
      const events = Object.fromEntries(
        (data.events || []).map((event) => [event.eventAction, event.eventDate?.slice(0, 10)]),
      );
      const nameservers = (data.nameservers || [])
        .map((server) => server.ldhName)
        .filter(Boolean)
        .slice(0, 5)
        .join(', ') || 'N/A';

      await ctx.reply(style.renderInfo([
        `WHOIS: ${data.ldhName || domain}`,
        '',
        `Status: ${data.status?.join(', ') || 'N/A'}`,
        `Registered: ${events.registration || 'N/A'}`,
        `Updated: ${events['last changed'] || events.last_update || 'N/A'}`,
        `Expires: ${events.expiration || 'N/A'}`,
        `Nameservers: ${nameservers}`,
        '',
        'Powered by DJOUSSE TECH',
      ]));
    } catch (error) {
      const notFound = error.response?.status === 404;
      if (!notFound) console.warn('[DOMAIN] lookup failed:', error.message);
      await ctx.reply(style.renderError([notFound
        ? `Aucun enregistrement trouvé pour ${domain}.`
        : 'La recherche WHOIS a échoué. Réessaie plus tard.']));
    }
  },
};
