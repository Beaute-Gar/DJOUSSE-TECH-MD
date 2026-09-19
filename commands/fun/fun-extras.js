const axios = require('axios');
const { Sticker } = require('wa-sticker-formatter');
const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function progressBar(pct, len = 16) {
  const filled = Math.round((pct / 100) * len);
  const empty = len - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ═══════════════════════════════════════════════════════════════════════════
// EMOJI MIX STICKER
// ═══════════════════════════════════════════════════════════════════════════

cmd({
  pattern: 'emix',
  alias: ['emojimix', 'emogimix'],
  desc: 'Combine two emojis into a sticker',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from, q }) => {
  if (!q || !q.includes(',')) {
    return conn.sendMessage(from, {
      text: boxWithFooter('EMOJI MIX', [{ raw: 'Provide two emojis separated by comma.\nUsage: `.emix 😎,🔥`' }]),
    }, { quoted: m });
  }

  const [emoji1, emoji2] = q.split(',').map((e) => e.trim());
  if (!emoji1 || !emoji2) {
    return conn.sendMessage(from, {
      text: boxWithFooter('EMOJI MIX', [{ raw: 'Invalid format. Usage: `.emix 😎,🔥`' }]),
    }, { quoted: m });
  }

  try {
    await m.react('🔄').catch(() => {});
    const url = `https://levanter.onrender.com/emix?emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`;
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    const sticker = new Sticker(Buffer.from(res.data), {
      pack: 'DJOUSSE-TECH',
      author: 'MD',
      type: 'full',
      quality: 70,
    });
    const stickerBuffer = await sticker.toBuffer();
    await conn.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (err) {
    await m.react('❌').catch(() => {});
    await conn.sendMessage(from, {
      text: boxWithFooter('EMOJI MIX', [{ raw: `Failed to mix emojis: ${err.message}` }]),
    }, { quoted: m });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════

cmd({
  pattern: 'compatibility',
  alias: ['compat', 'shiprate'],
  desc: 'Check compatibility between two users',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length < 2) {
    return conn.sendMessage(from, {
      text: boxWithFooter('COMPATIBILITY', [{ raw: 'Mention two users!\nUsage: `.compatibility @user1 @user2`' }]),
    }, { quoted: m });
  }

  const user1 = mentions[0].split('@')[0];
  const user2 = mentions[1].split('@')[0];
  const score = Math.floor(Math.random() * 100) + 1;
  const bar = progressBar(score);

  let status, emoji;
  if (score >= 90) { status = 'SOULMATES'; emoji = '💍'; }
  else if (score >= 70) { status = 'GREAT MATCH'; emoji = '💕'; }
  else if (score >= 50) { status = 'POTENTIAL'; emoji = '💗'; }
  else if (score >= 30) { status = 'FRIENDS'; emoji = '🤝'; }
  else { status = 'NOT COMPATIBLE'; emoji = '💔'; }

  await conn.sendMessage(from, {
    text: boxWithFooter('COMPATIBILITY', [
      { label: 'Users', value: `@${user1} & @${user2}` },
      { raw: '' },
      { label: emoji + ' Score', value: `${score}%` },
      { label: 'Progress', value: bar },
      { raw: '' },
      { label: 'Status', value: status },
    ]),
    mentions: mentions,
  }, { quoted: m });
});

// ═══════════════════════════════════════════════════════════════════════════
// AURA
// ═══════════════════════════════════════════════════════════════════════════

cmd({
  pattern: 'aura',
  alias: ['aurascore'],
  desc: 'Check your aura score',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const target = mentions.length ? mentions[0] : m.sender;
  const user = target.split('@')[0];
  const score = Math.floor(Math.random() * 1000) + 1;
  const pct = Math.min(Math.round((score / 1000) * 100), 100);
  const bar = progressBar(pct);

  let tier, emoji;
  if (score >= 900) { tier = 'LEGENDARY'; emoji = '✨'; }
  else if (score >= 700) { tier = 'MYTHIC'; emoji = '🔮'; }
  else if (score >= 500) { tier = 'RARE'; emoji = '💎'; }
  else if (score >= 300) { tier = 'UNCOMMON'; emoji = '🟢'; }
  else { tier = 'COMMON'; emoji = '⚪'; }

  await conn.sendMessage(from, {
    text: boxWithFooter('AURA', [
      { label: 'User', value: `@${user}` },
      { raw: '' },
      { label: emoji + ' Aura Score', value: `${score}/1000` },
      { label: 'Power', value: bar },
      { raw: '' },
      { label: 'Tier', value: tier },
    ]),
    mentions: [target],
  }, { quoted: m });
});

// ═══════════════════════════════════════════════════════════════════════════
// HACK (Owner only)
// ═══════════════════════════════════════════════════════════════════════════

cmd({
  pattern: 'hack',
  desc: 'Fake hack animation (owner only)',
  category: 'fun',
  fromMe: false,
  filename: __filename,
}, async (conn, m, args, { from }) => {
  if (!m.isOwner) {
    return conn.sendMessage(from, {
      text: boxWithFooter('HACK', [{ raw: 'This command is owner only!' }]),
    }, { quoted: m });
  }

  const stages = [
    { text: 'Initializing hack protocol...', pct: 10 },
    { text: 'Scanning target IP...', pct: 25 },
    { text: 'Bypassing firewall...', pct: 40 },
    { text: 'Injecting payload...', pct: 55 },
    { text: 'Extracting data...', pct: 70 },
    { text: 'Covering tracks...', pct: 85 },
    { text: 'Access granted!', pct: 100 },
  ];

  const sent = await conn.sendMessage(from, {
    text: boxWithFooter('HACK', [
      { raw: 'Starting hack...' },
      { raw: '' },
      { label: 'Status', value: 'BOOTING' },
      { label: 'Progress', value: progressBar(0) },
    ]),
  }, { quoted: m });

  const msgId = sent.key;

  for (const stage of stages) {
    await sleep(1000);
    await conn.relayMessage(from, {
      protocolMessage: {
        key: msgId,
        type: 14,
        editedMessage: {
          conversation: boxWithFooter('HACK', [
            { raw: stage.text },
            { raw: '' },
            { label: 'Target', value: '@owner' },
            { label: 'Status', value: 'RUNNING' },
            { label: 'Progress', value: progressBar(stage.pct) },
            { raw: '' },
            { label: 'Percentage', value: `${stage.pct}%` },
          ]),
        },
      },
    }, {});
  }

  await sleep(1000);
  await conn.relayMessage(from, {
    protocolMessage: {
      key: msgId,
      type: 14,
      editedMessage: {
        conversation: boxWithFooter('HACK', [
          { raw: '✅ Hack completed successfully!' },
          { raw: '' },
          { label: 'Target', value: '@owner' },
          { label: 'Status', value: 'COMPLETE' },
          { label: 'Progress', value: progressBar(100) },
          { raw: '' },
          { label: 'Result', value: 'All data extracted' },
        ]),
      },
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED EMOJI EDITS
// ═══════════════════════════════════════════════════════════════════════════

async function animatedEmojiEdit(conn, from, m, emoji, phrases) {
  const sent = await conn.sendMessage(from, {
    text: boxWithFooter(emoji + ' REACTION', [{ raw: phrases[0] }]),
  }, { quoted: m });

  const msgId = sent.key;

  for (let i = 1; i < phrases.length; i++) {
    await sleep(1500);
    await conn.relayMessage(from, {
      protocolMessage: {
        key: msgId,
        type: 14,
        editedMessage: {
          conversation: boxWithFooter(emoji + ' REACTION', [{ raw: phrases[i] }]),
        },
      },
    }, {});
  }
}

cmd({
  pattern: 'happy',
  desc: 'Animated happy emoji edit',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const phrases = [
    '😊 Spreading happiness...',
    '😊 Happiness level increasing!',
    '😊 You are awesome!',
    '😊 Keep smiling!',
    '😊 Happiness MAXED OUT! 😄',
  ];
  await animatedEmojiEdit(conn, from, m, '😊', phrases);
});

cmd({
  pattern: 'sad',
  desc: 'Animated sad emoji edit',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const phrases = [
    '😢 Loading sadness...',
    '😢 Why so sad?',
    '😢 Sending virtual hugs...',
    '😢 It will be okay...',
    '😢 Stay strong! 💪',
  ];
  await animatedEmojiEdit(conn, from, m, '😢', phrases);
});

cmd({
  pattern: 'angry',
  desc: 'Animated angry emoji edit',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const phrases = [
    '😡愤怒 loading...',
    '😡 Anger level rising!',
    '😡 Take a deep breath...',
    '😡 Calming down...',
    '😡怒气已消散 🧘',
  ];
  await animatedEmojiEdit(conn, from, m, '😡', phrases);
});

cmd({
  pattern: 'heart',
  desc: 'Animated heart emoji edit',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const phrases = [
    '❤️ Heart loading...',
    '❤️❤️ Double heartbeat!',
    '❤️❤️❤️ Love overload!',
    '❤️❤️❤️❤️ Heart full!',
    '❤️ You are loved! 💕',
  ];
  await animatedEmojiEdit(conn, from, m, '❤️', phrases);
});

// ═══════════════════════════════════════════════════════════════════════════
// SHIP / MATCH
// ═══════════════════════════════════════════════════════════════════════════

cmd({
  pattern: 'ship',
  alias: ['match'],
  desc: 'Randomly pair two members in the group',
  category: 'fun',
  onlyGroup: true,
  filename: __filename,
}, async (conn, m, args, { from }) => {
  const groupMeta = await conn.groupMetadata(from).catch(() => null);
  if (!groupMeta) {
    return conn.sendMessage(from, {
      text: boxWithFooter('SHIP', [{ raw: 'Failed to fetch group info.' }]),
    }, { quoted: m });
  }

  const participants = groupMeta.participants.map((p) => p.id);
  if (participants.length < 2) {
    return conn.sendMessage(from, {
      text: boxWithFooter('SHIP', [{ raw: 'Need at least 2 members to ship!' }]),
    }, { quoted: m });
  }

  const pick = () => participants[Math.floor(Math.random() * participants.length)];
  let person1 = pick();
  let person2 = pick();
  while (person2 === person1) person2 = pick();

  const percent = Math.floor(Math.random() * 100) + 1;
  const bar = progressBar(percent);
  const user1 = person1.split('@')[0];
  const user2 = person2.split('@')[0];

  let verdict;
  if (percent >= 90) verdict = 'PERFECT MATCH!';
  else if (percent >= 70) verdict = 'Great match!';
  else if (percent >= 50) verdict = 'Potential couple!';
  else if (percent >= 30) verdict = 'Just friends...';
  else verdict = 'Not meant to be.';

  await conn.sendMessage(from, {
    text: boxWithFooter('SHIP', [
      { raw: '💕 Random pairing 💕' },
      { raw: '' },
      { label: 'Couple', value: `@${user1} & @${user2}` },
      { raw: '' },
      { label: '💗 Match', value: `${percent}%` },
      { label: 'Progress', value: bar },
      { raw: '' },
      { label: 'Verdict', value: verdict },
    ]),
    mentions: [person1, person2],
  }, { quoted: m });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUOTE
// ═══════════════════════════════════════════════════════════════════════════
