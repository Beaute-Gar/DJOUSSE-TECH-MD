'use strict';

const style = require('../../config/style');

const SYNONYMS = {
  happy: ['joyful', 'cheerful', 'delighted', 'content', 'pleased', 'glad', 'thrilled'],
  sad: ['unhappy', 'sorrowful', 'depressed', 'gloomy', 'melancholy', 'miserable'],
  big: ['large', 'huge', 'enormous', 'massive', 'gigantic', 'vast', 'immense'],
  small: ['tiny', 'little', 'miniature', 'petite', 'minute', 'compact'],
  fast: ['quick', 'rapid', 'swift', 'speedy', 'brisk', 'hasty'],
  slow: ['sluggish', 'unhurried', 'gradual', 'leisurely', 'steady'],
  good: ['great', 'excellent', 'superb', 'wonderful', 'outstanding', 'fantastic'],
  bad: ['terrible', 'awful', 'dreadful', 'horrible', 'poor', 'lousy'],
  smart: ['intelligent', 'clever', 'brilliant', 'wise', 'bright', 'sharp'],
  beautiful: ['gorgeous', 'stunning', 'attractive', 'lovely', 'pretty', 'elegant'],
  strong: ['powerful', 'mighty', 'robust', 'sturdy', 'tough', 'forceful'],
  angry: ['furious', 'mad', 'enraged', 'irate', 'annoyed', 'irritated'],
};

module.exports = {
  commands: ['synonym', 'syn'],
  description: 'Find synonyms',
  usage: '.synonym <word>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const word = String(args[0] || '').toLowerCase();
    if (!word) return ctx.reply(style.renderError(['Usage : .synonym <word>']));
    const synonyms = SYNONYMS[word];
    if (!synonyms) {
      return ctx.reply(style.renderError(['No synonyms found. Try: happy, sad, big, small, fast, slow, good, bad, smart, beautiful, strong, angry']));
    }
    return ctx.reply(style.renderInfo([`Synonyms for "${word}"`, '', synonyms.join(', ')]));
  },
};
