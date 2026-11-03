// @legacy-order {"sourceFile":"10-divers/ascii.js","sourceOrder":27,"definitionIndex":0,"entryOrder":83}
'use strict';

const figlet = require('figlet');
const style = require('../../config/style');

const FONTS = ['Standard', 'Big', 'Slant', 'Banner', 'Block', 'Doom', 'Ghost', 'Poison', 'Thick'];

module.exports = {
  commands: ['figlet', 'art'],
  description: 'Convert text to ASCII art',
  usage: '.ascii <text> | .ascii <text> --font Slant',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    if (!args.length) {
      return ctx.reply(style.renderError([
        'Provide text.',
        '',
        'Usage: .ascii Hello',
        '',
        `Available fonts: ${FONTS.join(', ')}`,
        'With font: .ascii Hello --font Slant',
      ]));
    }

    let font = 'Standard';
    let text = args.join(' ');
    const fontIdx = text.indexOf('--font');
    if (fontIdx !== -1) {
      const requestedFont = text.slice(fontIdx + 6).trim().split(/\s+/)[0] || '';
      const selectedFont = FONTS.find((candidate) => candidate.toLowerCase() === requestedFont.toLowerCase());
      if (selectedFont) font = selectedFont;
      text = text.slice(0, fontIdx).trim();
    }

    if (!text) return ctx.reply(style.renderError(['Provide text before the --font option.']));
    if (text.length > 30) return ctx.reply(style.renderError(['Text too long — max 30 characters for ASCII art.']));

    try {
      const result = await new Promise((resolve, reject) => {
        figlet.text(text, { font }, (error, output) => {
          if (error || !output) reject(error || new Error('Failed to generate ASCII art.'));
          else resolve(output);
        });
      });
      return ctx.reply(style.renderInfo([`\`\`\`\n${result}\n\`\`\``]));
    } catch {
      return ctx.reply(style.renderError(['Failed to generate ASCII art.']));
    }
  },
};
