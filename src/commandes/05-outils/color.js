// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":6,"entryOrder":138}
'use strict';

const style = require('../../config/style');

const COLORS = Object.freeze({
  red: { hex: '#FF0000', rgb: '255,0,0' },
  blue: { hex: '#0000FF', rgb: '0,0,255' },
  green: { hex: '#00FF00', rgb: '0,255,0' },
  yellow: { hex: '#FFFF00', rgb: '255,255,0' },
  purple: { hex: '#800080', rgb: '128,0,128' },
  orange: { hex: '#FFA500', rgb: '255,165,0' },
  pink: { hex: '#FFC0CB', rgb: '255,192,203' },
  black: { hex: '#000000', rgb: '0,0,0' },
  white: { hex: '#FFFFFF', rgb: '255,255,255' },
  cyan: { hex: '#00FFFF', rgb: '0,255,255' },
  magenta: { hex: '#FF00FF', rgb: '255,0,255' },
  brown: { hex: '#A52A2A', rgb: '165,42,42' },
  gray: { hex: '#808080', rgb: '128,128,128' },
  gold: { hex: '#FFD700', rgb: '255,215,0' },
  silver: { hex: '#C0C0C0', rgb: '192,192,192' },
  navy: { hex: '#000080', rgb: '0,0,128' },
  teal: { hex: '#008080', rgb: '0,128,128' },
  coral: { hex: '#FF7F50', rgb: '255,127,80' },
  salmon: { hex: '#FA8072', rgb: '250,128,114' },
  lime: { hex: '#00FF00', rgb: '0,255,0' },
});

module.exports = {
  commands: ['color2'],
  description: 'Color information',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const name = (args[0] || '').toLowerCase();
    const color = COLORS[name];
    if (!color) {
      return ctx.reply(style.renderError([
        `Usage: .color2 <name>\nColors: ${Object.keys(COLORS).join(', ')}`,
      ]));
    }

    return ctx.reply(style.renderInfo([
      name.charAt(0).toUpperCase() + name.slice(1),
      '',
      `HEX: ${color.hex}`,
      `RGB: rgb(${color.rgb})`,
    ]));
  },
};
