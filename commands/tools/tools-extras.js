const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

cmd({
  pattern: 'gpass',
  fromMe: false,
  desc: 'Generate a strong password',
  category: 'tools',
  filename: __filename,
}, async (conn, msg, { args }) => {
  const len = parseInt(args[0]) || 12;
  const length = Math.max(8, Math.min(len, 64));
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars[crypto.randomInt(chars.length)];
  }
  return conn.sendMessage(msg.key.remoteJid, {
    text: boxWithFooter('🔐 Password Generator', [
      { raw: `Length: ${length}\n\n*${pass}*` }
    ])
  }, { quoted: msg });
});

cmd({
  pattern: 'define',
  fromMe: false,
  desc: 'Get word definition from dictionary',
  category: 'tools',
  filename: __filename,
}, async (conn, msg, { args }) => {
  const word = args.join(' ').trim();
  if (!word) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📖 Dictionary', [{ raw: 'Provide a word to define.\nUsage: .define <word>' }])
    }, { quoted: msg });
  }
  try {
    const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const entry = data[0];
    const phonetic = entry.phonetic || entry.phonetics?.[0]?.text || '';
    const meanings = entry.meanings.map(m => {
      const defs = m.definitions.slice(0, 2).map(d => `• ${d.definition}${d.example ? `\n  _Example: ${d.example}_` : ''}`).join('\n');
      const syns = m.definitions.flatMap(d => d.synonyms || []).slice(0, 3);
      return `*${m.partOfSpeech}*\n${defs}${syns.length ? `\n_Synonyms: ${syns.join(', ')}_` : ''}`;
    }).join('\n\n');
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter(`📖 ${entry.word}`, [
        { raw: `${phonetic ? `${phonetic}\n` : ''}\n${meanings}` }
      ])
    }, { quoted: msg });
  } catch {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📖 Dictionary', [{ raw: `No definition found for *"${word}"*` }])
    }, { quoted: msg });
  }
});

cmd({
  pattern: 'githubstalk',
  fromMe: false,
  desc: 'Stalk a GitHub profile',
  category: 'tools',
  filename: __filename,
}, async (conn, msg, { args }) => {
  const username = args[0]?.replace('@', '');
  if (!username) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('🐙 GitHub Stalk', [{ raw: 'Provide a username.\nUsage: .githubstalk <username>' }])
    }, { quoted: msg });
  }
  try {
    const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`);
    const info = [
      `*Name:* ${data.name || data.login}`,
      `*Bio:* ${data.bio || 'N/A'}`,
      `*Location:* ${data.location || 'N/A'}`,
      `*Company:* ${data.company || 'N/A'}`,
      `*Blog:* ${data.blog || 'N/A'}`,
      `*Followers:* ${data.followers} | *Following:* ${data.following}`,
      `*Public Repos:* ${data.public_repos}`,
      `*Public Gists:* ${data.public_gists}`,
      `*Account Created:* ${new Date(data.created_at).toLocaleDateString()}`
    ].join('\n');
    return conn.sendMessage(msg.key.remoteJid, {
      image: { url: data.avatar_url },
      caption: boxWithFooter(`🐙 ${data.login}`, [{ raw: info }])
    }, { quoted: msg });
  } catch {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('🐙 GitHub Stalk', [{ raw: `User *"${username}"* not found.` }])
    }, { quoted: msg });
  }
});

cmd({
  pattern: 'npm',
  fromMe: false,
  desc: 'Search npm packages',
  category: 'tools',
  filename: __filename,
}, async (conn, msg, { args }) => {
  const pkg = args[0];
  if (!pkg) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📦 NPM Search', [{ raw: 'Provide a package name.\nUsage: .npm <package>' }])
    }, { quoted: msg });
  }
  try {
    const { data } = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
    const latest = data['dist-tags']?.latest;
    const info = [
      `*Package:* ${data.name}`,
      `*Latest Version:* ${latest || 'N/A'}`,
      `*Description:* ${data.description || 'N/A'}`,
      `*Author:* ${data.author?.name || data.maintainers?.[0]?.name || 'N/A'}`,
      `*License:* ${typeof data.license === 'object' ? data.license.type : (data.license || 'N/A')}`,
      `*Homepage:* ${data.homepage || data.repository?.url || 'N/A'}`,
      `*Keywords:* ${data.keywords?.slice(0, 8).join(', ') || 'N/A'}`
    ].join('\n');
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📦 NPM Package', [{ raw: info }])
    }, { quoted: msg });
  } catch {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📦 NPM Search', [{ raw: `Package *"${pkg}"* not found.` }])
    }, { quoted: msg });
  }
});

cmd({
  pattern: 'news',
  fromMe: false,
  desc: 'Get latest news headlines',
  category: 'tools',
  filename: __filename,
}, async (conn, msg) => {
  try {
    const { data } = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=0f2c43ab11324578a7b1709651736382`);
    const articles = data.articles?.slice(0, 5);
    if (!articles?.length) {
      return conn.sendMessage(msg.key.remoteJid, {
        text: boxWithFooter('📰 News', [{ raw: 'No news articles found right now.' }])
      }, { quoted: msg });
    }
    const news = articles.map((a, i) => `*${i + 1}. ${a.title}*\n${a.source?.name || 'Unknown'} — ${a.url || ''}`).join('\n\n');
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📰 Top Headlines', [{ raw: news }])
    }, { quoted: msg });
  } catch {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('📰 News', [{ raw: 'Failed to fetch news. Try again later.' }])
    }, { quoted: msg });
  }
});

cmd({
  pattern: 'imgscan',
  fromMe: false,
  desc: 'AI image analysis',
  category: 'tools',
  filename: __filename,
}, async (conn, msg) => {
  const quoted = await msg.quoted?.download?.();
  const imgMsg = msg.message?.imageMessage;
  let buffer;
  if (quoted) {
    buffer = quoted;
  } else if (imgMsg) {
    buffer = await conn.downloadMediaMessage(msg);
  }
  if (!buffer) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('🔍 Image Scan', [{ raw: 'Reply to an image or send an image with .imgscan to scan it.' }])
    }, { quoted: msg });
  }
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: 'scan.jpg', contentType: 'image/jpeg' });
    const catRes = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders(), timeout: 30000 });
    const imageUrl = catRes.data;
    if (!imageUrl?.startsWith('http')) {
      throw new Error('Failed to upload image');
    }
    const { data: scanData } = await axios.get(`https://apis.davidcyriltech.my.id/imgscan?url=${encodeURIComponent(imageUrl)}`);
    const result = scanData.result || scanData.description || scanData.data || JSON.stringify(scanData);
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('🔍 Image Analysis', [{ raw: result }])
    }, { quoted: msg });
  } catch (err) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: boxWithFooter('🔍 Image Scan', [{ raw: `Scan failed: ${err.message}` }])
    }, { quoted: msg });
  }
});
