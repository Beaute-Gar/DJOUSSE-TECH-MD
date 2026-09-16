'use strict';

require('dotenv').config();

module.exports = {
  BOT_NAME: process.env.BOT_NAME || 'DJOUSSE-TECH-MD',
  OWNER_NUMBER: process.env.OWNER_NUMBER || process.env.BOT_OWNER || '237693978044',
  OWNER_NAME: process.env.OWNER_NAME || 'Beaute Gar',
  VERSION: '3.1.0',
  PREFIX: process.env.PREFIX || '.',
  MODE: process.env.MODE || 'public',
  TIMEZONE: 'Africa/Douala',
  BOT_FOOTER: process.env.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION',
  STICKER_NAME: process.env.STICKER_NAME || 'DJOUSSE-TECH-MD',
  STICKER_AUTHOR: process.env.STICKER_AUTHOR || 'Beaute Gar',
  STICKER_PACKNAME: process.env.STICKER_PACKNAME || 'DJOUSSE-TECH-MD',
  REPO_URL: process.env.REPO_URL || 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD',
  DESCRIPTION: process.env.DESCRIPTION || 'Multi-Device WhatsApp Bot',
  ALIVE_IMG: process.env.ALIVE_IMG || 'media/djousse.jpg',
  MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || '',
  AUTO_REACT: process.env.AUTO_REACT === 'true',
  AUTO_REACT_EMOJIS: (process.env.AUTO_REACT_EMOJIS || '❤️,🔥,😍,😂,👏,💯,✨').split(',').map(e => e.trim()),
  AUTO_REACT_DELAY: Number(process.env.AUTO_REACT_DELAY) || 1200,
  AUTO_LIKE_EMOJI: ['❤️', '🌹', '✨', '🥰', '💖', '😍', '💞', '💕', '☺️', '🤗'],
  CUSTOM_REACT: process.env.CUSTOM_REACT === 'true',
  CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || '💝,💖,💗,❤️‍🩹,❤️,🧡,💛,💚,💙,💜,🤎,🖤,🤍',
  AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || 'SEEN YOUR STATUS BY DJOUSSE-TECH-MD 🤗',
  AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN === 'true',
  AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT === 'true',
  AUTO_STATUS_REACT_EMOJI: process.env.AUTO_STATUS_REACT_EMOJI || 'random',
  AUTO_STATUS_FORWARD: false,
  AUTO_TYPING: process.env.AUTO_TYPING === 'true',
  AUTO_RECORDING: process.env.AUTO_RECORDING === 'true',
  AUTO_STICKER: process.env.AUTO_STICKER === 'true',
  AUTO_REPLY: process.env.AUTO_REPLY === 'true',
  AUTO_REPLY_MSG: process.env.AUTO_REPLY_MSG || 'I am busy right now, will reply later.',
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true',
  READ_MESSAGE: process.env.READ_MESSAGE === 'true',
  READ_CMD: process.env.READ_CMD === 'true',
  MENTION_REPLY: process.env.MENTION_REPLY === 'true',
  MENTION_REPLY_MSG: process.env.MENTION_REPLY_MSG || 'You mentioned me!',
  WELCOME: process.env.WELCOME === 'true',
  WELCOME_MSG: process.env.WELCOME_MSG || 'Welcome to the group @{user}!',
  GOODBYE_MSG: process.env.GOODBYE_MSG || 'Goodbye @{user}!',
  ADMIN_EVENTS: process.env.ADMIN_EVENTS === 'true',
  PUBLIC_MODE: process.env.PUBLIC_MODE !== 'false',
  ANTI_DELETE: process.env.ANTI_DELETE !== 'false',
  ANTI_DEL_PATH: process.env.ANTI_DEL_PATH || 'inbox',
  ANTI_LINK: process.env.ANTI_LINK !== 'false',
  ANTI_LINK_KICK: process.env.ANTI_LINK_KICK === 'true',
  ANTI_BAD: process.env.ANTI_BAD === 'true',
  ANTI_BAD_WORDS: (process.env.ANTI_BAD_WORDS || 'fuck,shit,bitch,ass,damn,asshole,motherfucker,nigga,fuc,k,puta,merde,con,enculé,fdp').split(',').map(w => w.trim().toLowerCase()),
  ANTI_VV: process.env.ANTI_VV !== 'false',
  DELETE_LINKS: process.env.DELETE_LINKS === 'true',
  REJECT_MSG: process.env.REJECT_MSG || 'CALL LATER PLEASE ☺️🌹',
  LIVE_MSG: process.env.LIVE_MSG || 'I am active and running',
  GROUP_INVITE_CODE: process.env.GROUP_INVITE_CODE || '',
  DEV: process.env.DEV || '',
  API_KEY: process.env.API_KEY || '',
  API_PREFIX: process.env.API_PREFIX || '/api',
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
};
