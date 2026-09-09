'use strict';

require('dotenv').config();

/* Warn-only : signale les clés absentes sans bloquer le démarrage (SQLite OK en local) */
const WARN_KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'CORE_TOKEN', 'DASHBOARD_TOKEN'];
setImmediate(() => {
  const missing = WARN_KEYS.filter(k => !process.env[k]);
  if (missing.length) {
    console.warn('[config-djousse] Clés optionnelles absentes: ' + missing.join(', ') + ' (fonctionnalités concernées désactivées)');
  }
});

module.exports = {
  BOT_NAME: process.env.BOT_NAME || 'DJOUSSE-TECH-MD',
  DB_TYPE: process.env.DB_TYPE || 'sqlite',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DATABASE_URL_PUBLIC: process.env.DATABASE_URL_PUBLIC || '',
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'djousse_tech',
  SESSION_ID: process.env.SESSION_ID || '',
  MODE: process.env.MODE || 'public',
  PREFIX: process.env.PREFIX || '.',
  BOT_OWNER: process.env.BOT_OWNER || '',
  OWNER_NUMBER: process.env.OWNER_NUMBER || process.env.BOT_OWNER || '',
  OWNER_NAME: process.env.OWNER_NAME || 'Beaute Gar',
  BOT_FOOTER: process.env.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION',
  WORK_TYPE: process.env.WORK_TYPE || 'public',
  STICKER_NAME: process.env.STICKER_NAME || 'DJOUSSE-TECH-MD',
  AUTO_LIKE_EMOJI: ['❤️', '🌹', '✨', '🥰', '💖', '😍', '💞', '💕', '☺️', '🤗'],
  CUSTOM_REACT: process.env.CUSTOM_REACT === 'true',
  CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || '💝,💖,💗,❤️‍🩹,❤️,🧡,💛,💚,💙,💜,🤎,🖤,🤍',
  AUTO_REACT: process.env.AUTO_REACT === 'true',
  AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || 'SEEN YOUR STATUS BY DJOUSSE-TECH-MD 🤗',
  GROUP_INVITE_CODE: process.env.GROUP_INVITE_CODE || '',
  REJECT_MSG: process.env.REJECT_MSG || 'CALL LATER PLEASE ☺️🌹',
  LIVE_MSG: process.env.LIVE_MSG || 'I am active and running',
  MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || '',
  REPO_URL: process.env.REPO_URL || 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD',
  DESCRIPTION: process.env.DESCRIPTION || 'Multi-Device WhatsApp Bot',
  ALIVE_IMG: process.env.ALIVE_IMG || 'media/djousse.jpg',
  ALIVE_MSG: `
👋 𝐇𝐄𝐋𝐋𝐎, *WΞLCΩMΞ TΩ MyBot* 💎

*╭─「  ᴅᴀᴛᴇ ɪɴ꜀ᴘꜰᴏʀᴍᴀᴛɪᴏN  」*
*┃* ❖ 🧑‍💻 *\`Owner\`* : *{USER}*
*┃* ❖ ⏰ *\`Time\`* : {TIME}
*╰─────────────❖●►*

*╭─「  ꜱᴛᴀᴛᴜꜱ ᴅᴇᴛᴀɪʟꜱ  」*
*┃* ➤ 👩‍💼 *\`User\`* : *{USER}*
*┃* ➤ ✒️ *\`Prefix\`* : *{PREFIX}*
*┃* 🧬 *\`Version\`* : *ᴠ2.0 ᴀɪɴᴏʀɪᴀ*
*┃* 🖥️ *\`Platform\`* : *ʀᴇɴᴅᴇʀ*
*┃* 📟 *\`Uptime\`* : *{UPTIME}*
*┃* 📂 *\`Memory\`* : *{RAM}*
*╰─────────────❖◆►*

*╭─「 ᴀɪɴᴏʀɪᴀ ᴀɪ ᴇɴɢɪɴᴇ 」*
┃ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ MyBot*

*╰──────────❖✦►*

> ᴇɴᴅ ᴜsᴇʀ
`,
  API_KEY: process.env.API_KEY || '',
  API_PREFIX: process.env.API_PREFIX || '/api',
  AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN === 'true',
  AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT === 'true',
  AUTO_STATUS_FORWARD: false,
  AUTO_STATUS_REACT_EMOJI: process.env.AUTO_STATUS_REACT_EMOJI || 'random',
  ANTI_DELETE: process.env.ANTI_DELETE !== 'false',
  ANTI_DEL_PATH: process.env.ANTI_DEL_PATH || 'inbox',
  ANTI_LINK: process.env.ANTI_LINK !== 'false',
  ANTI_LINK_KICK: process.env.ANTI_LINK_KICK === 'true',
  ANTI_BAD: process.env.ANTI_BAD === 'true',
  ANTI_BAD_WORDS: (process.env.ANTI_BAD_WORDS || 'fuck,shit,bitch,ass,damn, asshole, motherfucker,nigga,fuc,k,puta,merde,con,enculé,fdp').split(',').map(w => w.trim().toLowerCase()),
  ANTI_VV: process.env.ANTI_VV !== 'false',
  DELETE_LINKS: process.env.DELETE_LINKS === 'true',
  AUTO_STICKER: process.env.AUTO_STICKER === 'true',
  AUTO_REPLY: process.env.AUTO_REPLY === 'true',
  AUTO_REPLY_MSG: process.env.AUTO_REPLY_MSG || 'I am busy right now, will reply later.',
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true',
  AUTO_TYPING: process.env.AUTO_TYPING === 'true',
  AUTO_RECORDING: process.env.AUTO_RECORDING === 'true',
  MENTION_REPLY: process.env.MENTION_REPLY === 'true',
  MENTION_REPLY_MSG: process.env.MENTION_REPLY_MSG || 'You mentioned me!',
  READ_MESSAGE: process.env.READ_MESSAGE === 'true',
  READ_CMD: process.env.READ_CMD === 'true',
  WELCOME: process.env.WELCOME === 'true',
  WELCOME_MSG: process.env.WELCOME_MSG || 'Welcome to the group @{user}!',
  GOODBYE_MSG: process.env.GOODBYE_MSG || 'Goodbye @{user}!',
  ADMIN_EVENTS: process.env.ADMIN_EVENTS === 'true',
  PUBLIC_MODE: process.env.PUBLIC_MODE !== 'false',
  DEV: process.env.DEV || '',
  STICKER_PACKNAME: process.env.STICKER_PACKNAME || 'DJOUSSE-TECH-MD',
  STICKER_AUTHOR: process.env.STICKER_AUTHOR || 'Beaute Gar',
};