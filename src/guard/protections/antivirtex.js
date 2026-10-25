'use strict';
// Anti-crash : textes géants, tonnes de caractères invisibles / combinants ("virtex"), murs de lignes.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u0300-\u036F\u0483-\u0489]/g;
module.exports = {
  key: 'antivirtex',
  label: 'Anti-Virtex',
  defaultSanction: 'kick',
  detect: (ctx, g) => {
    const t = ctx.text || '';
    if (!t) return null;
    const invisible = (t.match(INVISIBLE) || []).length;
    const lines = t.split('\n').length;
    if (t.length > g.maxText || invisible > 150 || lines > 250) return { reason: 'Message anormalement lourd (anti-crash).' };
    return null;
  },
};
