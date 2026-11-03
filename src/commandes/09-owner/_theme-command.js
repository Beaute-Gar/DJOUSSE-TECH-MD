'use strict';

const { listThemes, setActiveTheme, getActiveTheme } = require('../_partage/theme');
const { renderError, renderInfo } = require('../../config/style');

function listText(all, current) {
  return [
    `BOT THEMES (${all.length} AVAILABLE)`,
    `ACTIVE THEME: ${current}`,
    ...all.map((theme, index) => `${index + 1}. ${theme}`),
    'USAGE: .theme set <name>',
    'EXAMPLE: .theme set naruto',
  ];
}

function themeCaption(title, rows) {
  return renderInfo([title, ...rows]);
}

module.exports = function createThemeCommand(command, aliases) {
  const register = ({ cmd }) => {
    cmd(command, aliases, {
      cat: 9,
      desc: 'List available themes or switch the bot theme at runtime',
      usage: '.theme list | .theme set <name> | .theme info',
      owner: true,
      group: false,
      private: true,
    }, async (ctx) => {
      const args = ctx.args;
      const sub = (args[0] || '').toLowerCase();

      if (!sub || sub === 'list' || sub === 'themes') {
        const all = listThemes();
        const current = (getActiveTheme()?.global?.botName) || 'DJOUSSE TECH';
        return ctx.reply(renderInfo(listText(all, current)));
      }

      if (sub === 'info') {
        const theme = getActiveTheme();
        if (!theme) return ctx.reply(renderError(['NO THEME LOADED']));
        const globalTheme = theme.global || {};
        return ctx.sock.sendMessage(ctx.jid, {
          image: { url: globalTheme.pic1 || '' },
          caption: themeCaption('CURRENT THEME INFO', [
            `NAME: ${globalTheme.botName || '—'}`,
            `GREETING: ${globalTheme.greet || '—'}`,
            `BODY: ${globalTheme.body || '—'}`,
            `FOOTER: ${globalTheme.footer || '—'}`,
            `WAIT MSG: ${globalTheme.wait || '—'}`,
          ]),
          contextInfo: ctx.contextInfo,
        }, { quoted: ctx.msg });
      }

      if (sub === 'set' || sub === 'change' || sub === 'switch') {
        const target = (args[1] || '').toLowerCase().trim();
        if (!target) {
          return ctx.reply(renderError([
            'USAGE: .theme set <name>',
            'RUN .theme list TO SEE AVAILABLE THEMES.',
          ]));
        }
        if (!setActiveTheme(target)) {
          return ctx.reply(renderError([
            `THEME ${target} NOT FOUND.`,
            'AVAILABLE THEMES:',
            ...listThemes().map((theme, index) => `${index + 1}. ${theme}`),
          ]));
        }
        const globalTheme = getActiveTheme()?.global || {};
        return ctx.sock.sendMessage(ctx.jid, {
          image: { url: globalTheme.pic1 || '' },
          caption: themeCaption(`THEME CHANGED TO: ${target}`, [
            `BOT NAME: ${globalTheme.botName || target}`,
            `GREETING: ${globalTheme.greet || '—'}`,
            `BODY: ${globalTheme.body || '—'}`,
            'THEME IS ACTIVE IMMEDIATELY — NO RESTART NEEDED.',
          ]),
          contextInfo: ctx.contextInfo,
        }, { quoted: ctx.msg });
      }

      if (setActiveTheme(sub)) {
        const globalTheme = getActiveTheme()?.global || {};
        return ctx.sock.sendMessage(ctx.jid, {
          image: { url: globalTheme.pic1 || '' },
          caption: themeCaption(`THEME CHANGED TO: ${sub}`, [
            `BOT NAME: ${globalTheme.botName || sub}`,
          ]),
          contextInfo: ctx.contextInfo,
        }, { quoted: ctx.msg });
      }

      return ctx.reply(renderError([
        'UNKNOWN SUBCOMMAND.',
        'USAGE: .theme list — SEE ALL THEMES',
        '.theme set <name> — SWITCH THEME',
        '.theme info — VIEW CURRENT THEME',
      ]));
    });
  };

  register.maison = true;
  return register;
};
