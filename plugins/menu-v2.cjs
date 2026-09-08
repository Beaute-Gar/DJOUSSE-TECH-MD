const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const moment = require('moment-timezone');
const { randomImage } = require('../lib/images.cjs');

const CATEGORY_ICONS = {
  main: '🏠', info: 'ℹ️', download: '📥', group: '👥',
  owner: '👑', tools: '🛠️', settings: '⚙️', system: '⚡',
  media: '🎬', search: '🔎', fun: '🎮', ai: '🤖',
};

const CATEGORY_NAMES = {
  main: 'MAIN', info: 'INFO', download: 'DOWNLOAD', group: 'GROUP',
  owner: 'OWNER', tools: 'TOOLS', settings: 'SETTINGS', system: 'SYSTEM',
  media: 'MEDIA', search: 'SEARCH', fun: 'FUN', ai: 'AI',
};

function listCommands() {
  return (Array.isArray(commands) ? commands : [])
    .filter(c => c && c.pattern && c.dontAddCommandList !== true)
    .map(c => ({
      pattern: String(c.pattern).trim(),
      category: String(c.category || 'misc').trim().toLowerCase(),
      desc: String(c.desc || '').trim()
    }))
    .filter(c => c.pattern);
}

function buildGroups() {
  const groups = new Map();
  for (const c of listCommands()) {
    const key = c.category || 'misc';
    if (!groups.has(key)) groups.set(key, new Map());
    const commandKey = c.pattern.toLowerCase();
    if (!groups.get(key).has(commandKey)) groups.get(key).set(commandKey, c);
  }
  return [...groups.entries()]
    .map(([category, map]) => [category, [...map.values()].sort((a, b) => a.pattern.localeCompare(b.pattern))])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

const SMALLCAP_MAP = {
  a:'ᴀ', b:'ʙ', c:'ᴄ', d:'ᴅ', e:'ᴇ', f:'ғ', g:'ɢ', h:'ʜ', i:'ɪ', j:'ᴊ',
  k:'ᴋ', l:'ʟ', m:'ᴍ', n:'ɴ', o:'ᴏ', p:'ᴘ', q:'ǫ', r:'ʀ', s:'s', t:'ᴛ',
  u:'ᴜ', v:'ᴠ', w:'ᴡ', x:'x', y:'ʏ', z:'ᴢ'
};

function smallcap(str) {
  return String(str).split('').map(ch => SMALLCAP_MAP[ch.toLowerCase()] || ch).join('');
}

function categoryTitle(category) {
  return CATEGORY_NAMES[category] || category.toUpperCase().replace(/[-_]/g, ' ');
}

cmd({
  pattern: 'menu',
  alias: ['.'],
  react: '🪀',
  desc: 'Dynamic command menu',
  category: 'main',
  filename: __filename
}, async (conn, m, commands, { from, sender, reply }) => {
  const chat = from || m.chat;
  try {
    const groups = buildGroups();
    const total = groups.reduce((n, [, list]) => n + list.length, 0);
    const prefix = config.PREFIX || '.';
    const botName = config.BOT_NAME || 'DJOUSSE-TECH-MD';
    const owner = config.OWNER_NAME || 'Beaute Gar';

    const zone = 'Africa/Douala';
    const now = moment().tz(zone);
    const image = config.MENU_IMAGE_URL || randomImage();

    let body = '';
    for (const [category, list] of groups) {
      const icon = CATEGORY_ICONS[category] || '📁';
      body += `\n*⥤ ${icon} \`${categoryTitle(category)}\`*\n*╭┄┄┄┄┄┄┄┄┄┄┄┈┈┈ᕗ*\n`;
      for (const c of list) body += `*│✦ ${prefix}${smallcap(c.pattern)}*\n`;
      body += '*╰┄┄┄┄┄┄┄┄┄┄┄┈┈┈ᕗ*\n';
    }

    const caption = `*╭┄┄『 \`INFO BOT\` 』*\n*│✦ PREFIX: 〔${prefix}〕*\n*│✦ BOT: \`${botName}\`*\n*│✦ COMMANDS: ${total}*\n*│✦ TIME: ${now.format('HH:mm:ss')}*\n*│✦ DATE: ${now.format('DD/MM/YYYY')}*\n*│✦ OWNER: \`${owner}\`*\n*╰┄┄┄┄┄┄┄┄┄┄┄┄⪼*\n${body}\n${config.DESCRIPTION || 'MULTI-DEVICE WHATSAPP BOT'}\n> *${config.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION'}*`;

    await conn.sendMessage(chat, {
      image: { url: image },
      caption,
      contextInfo: {
        mentionedJid: sender ? [sender] : [],
        forwardingScore: 1,
        isForwarded: true,
      }
    }, { quoted: m });
  } catch (error) {
    console.error('MENU ERROR:', error);
    await reply('Error loading menu');
  }
});
