// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":4,"entryOrder":334}
'use strict';

const style = require('../../config/style');

const SYSTEMS = Object.freeze({
  windows: { name: 'Windows', maker: 'Microsoft', year: 1985, share: '72%', type: 'Desktop/Server' },
  macos: { name: 'macOS', maker: 'Apple', year: 2001, share: '15%', type: 'Desktop' },
  linux: { name: 'Linux', maker: 'Linus Torvalds (community)', year: 1991, share: '3%', type: 'Desktop/Server/Embedded' },
  android: { name: 'Android', maker: 'Google', year: 2008, share: '72% mobile', type: 'Mobile' },
  ios: { name: 'iOS', maker: 'Apple', year: 2007, share: '27% mobile', type: 'Mobile' },
  ubuntu: { name: 'Ubuntu', maker: 'Canonical', year: 2004, share: 'Popular Linux distro', type: 'Desktop/Server' },
  chromeos: { name: 'ChromeOS', maker: 'Google', year: 2011, share: 'Growing', type: 'Desktop (Chromebooks)' },
});

module.exports = {
  commands: ['os', 'osinfo'],
  description: 'Operating system info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = (args[0] || '').toLowerCase();
    const system = SYSTEMS[query];
    if (!system) {
      return ctx.reply(style.renderError([
        `Usage: .os <name>\nOS: ${Object.keys(SYSTEMS).join(', ')}`,
      ]));
    }

    return ctx.reply(style.renderInfo([
      system.name,
      '',
      `Maker: ${system.maker}`,
      `Released: ${system.year}`,
      `Market Share: ${system.share}`,
      `Type: ${system.type}`,
    ]));
  },
};
