/**
 * config-djousse.cjs — Compat layer (étendu)
 * Utilisé par anti-bad.cjs, anti-vv.cjs, auto-reply.cjs, auto-sticker.cjs, etc.
 */

require('dotenv').config();

module.exports = {
  // Base
  BOT_OWNER: process.env.OWNER_NUMBER || '237693978044',
  OWNER_NAME: process.env.OWNER_NAME || 'Beaute Gar',
  BOT_NAME: process.env.BOT_NAME || 'DJOUSSE TECH',
  PREFIX: process.env.PREFIX || '.',
  MODE: process.env.MODE || 'public',
  VERSION: 'v3.1.0',

  // Flags (état runtime)
  ANTI_BAD: false,
  ANTI_BAD_WORDS: [],
  ANTI_VV: false,
  ANTI_LINK: true,
  ANTI_DELETE: true,
  ANTI_SPAM: false,
  AUTO_REPLY: false,
  AUTO_REPLY_MSG: 'Je suis occupé, je te répondrai plus tard.',
  AUTO_STICKER: false,
  AUTO_STATUS_REACT: false,
  AUTO_TYPING: 'false',
  AUTO_RECORDING: 'false',

  // Sticker
  STICKER_PACKNAME: process.env.PACK_NAME || 'DJOUSSE TECH',
  STICKER_AUTHOR: process.env.OWNER_NAME || 'Beaute Gar',
  STICKER_NAME: process.env.PACK_NAME || 'DJOUSSE TECH',
};
