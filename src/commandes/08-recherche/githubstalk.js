'use strict';

const axios = require('axios');
const config = require('../../config/config');
const style = require('../../config/style');

const headers = {
  'User-Agent': 'DJOUSSE-TECH-MD',
  Accept: 'application/vnd.github+json',
};

const compactNumber = (value) => {
  if (!Number.isFinite(value)) return 'N/A';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

module.exports = {
  commands: ['githubstalk', 'gh'],
  description: 'Show public GitHub profile details',
  usage: '.githubstalk <username>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const username = String(args[0] || '').replace(/^@/, '').trim();
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) {
      return ctx.reply(style.renderError(['Indique un nom GitHub valide. Exemple : .githubstalk torvalds']));
    }

    const encodedUsername = encodeURIComponent(username);
    try {
      const [userResult, reposResult, orgsResult] = await Promise.allSettled([
        axios.get(`https://api.github.com/users/${encodedUsername}`, { headers, timeout: 10000 }),
        axios.get(`https://api.github.com/users/${encodedUsername}/repos`, {
          headers,
          params: { sort: 'updated', per_page: 5, type: 'owner' },
          timeout: 10000,
        }),
        axios.get(`https://api.github.com/users/${encodedUsername}/orgs`, {
          headers,
          params: { per_page: 5 },
          timeout: 10000,
        }),
      ]);

      if (userResult.status === 'rejected') {
        if (userResult.reason.response?.status === 404) {
          return ctx.reply(style.renderError([`Le profil GitHub « ${username} » est introuvable.`]));
        }
        throw userResult.reason;
      }

      const user = userResult.value.data;
      if (!user?.login) throw new Error('GitHub returned an invalid profile.');
      const repos = reposResult.status === 'fulfilled' && Array.isArray(reposResult.value.data)
        ? reposResult.value.data
        : [];
      const orgs = orgsResult.status === 'fulfilled' && Array.isArray(orgsResult.value.data)
        ? orgsResult.value.data
        : [];
      const totalStars = repos.reduce((total, repo) => total + (repo.stargazers_count || 0), 0);
      const languages = [...new Set(repos.map((repo) => repo.language).filter(Boolean))].slice(0, 4);
      const lines = [
        '🐙 *GitHub Profile Report*',
        '',
        '*👤 Identity*',
        `• *Username:* @${user.login}`,
        user.name && `• *Name:* ${user.name}`,
        user.company && `• *Company:* ${user.company.trim()}`,
        user.location && `• *Location:* ${user.location}`,
        `• *Type:* ${user.type || 'User'}`,
        `• *Joined:* ${user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB') : 'N/A'}`,
        user.bio && `\n*📝 Bio*\n${String(user.bio).slice(0, 300)}`,
        '',
        '*📊 Stats*',
        `• *Followers:* ${compactNumber(user.followers)}`,
        `• *Following:* ${compactNumber(user.following)}`,
        `• *Public repos:* ${compactNumber(user.public_repos)}`,
        `• *Public gists:* ${compactNumber(user.public_gists)}`,
        `• *Stars (latest 5 repos):* ${compactNumber(totalStars)}`,
        repos.length > 0 && `\n*📦 Latest Repos*\n${repos.map((repo) =>
          `• *${repo.name}*${repo.language ? ` · ${repo.language}` : ''} ⭐${compactNumber(repo.stargazers_count || 0)}`).join('\n')}`,
        languages.length > 0 && `*Top languages:* ${languages.join(', ')}`,
        orgs.length > 0 && `\n*🏢 Organizations*\n${orgs.map((org) => `@${org.login}`).join(' • ')}`,
        `\n• *Profile:* https://github.com/${user.login}`,
        `_Powered by ${config.botName} · GitHub API_`,
      ].filter(Boolean);
      const report = style.renderInfo(lines);

      if (user.avatar_url) {
        try {
          const avatar = new URL(user.avatar_url);
          if (avatar.protocol === 'https:') {
            return await ctx.sock.sendMessage(ctx.from, {
              image: { url: avatar.toString() },
              caption: report,
            }, { quoted: ctx.msg });
          }
        } catch (error) {
          console.warn('[GITHUBSTALK] avatar could not be sent:', error.message);
        }
      }
      return ctx.reply(report);
    } catch (error) {
      console.warn('[GITHUBSTALK] lookup failed:', error.message);
      return ctx.reply(style.renderError(['Impossible de récupérer ce profil GitHub. Vérifie le nom ou réessaie plus tard.']));
    }
  },
};
