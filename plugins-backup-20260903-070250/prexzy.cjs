const { cmd } = require('../command.cjs');
const { fetchJson, getBuffer } = require('../lib/functions.cjs');
const { freeChat } = require('../lib/ai.cjs');
const pz = require('../lib/prexzy.cjs');

const txt = m => (m.body || '').split(' ').slice(1).join(' ').trim();

async function chatOrFree(endpoint, prompt) {
  try {
    const ans = await pz.chat(prompt, endpoint);
    if (ans && !/invalid request/i.test(ans)) return ans;
  } catch { }
  try {
    const r = await freeChat(prompt);
    if (r) return r;
  } catch { }
  throw new Error('Aucune IA disponible pour le moment.');
}

async function imagenFree(prompt) {
  try {
    const buf = await getBuffer(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&model=flux`);
    if (buf && buf.length) return buf;
  } catch { }
  try {
    return await pz.aiImage(prompt);
  } catch { return null; }
}

cmd({ pattern: 'aiwriter', alias: ['aiw', 'pzai'], desc: 'Chat IA (gpt-4o-mini via Prexzy)', category: 'ai', filename: __filename }, async (conn, m) => {
  const q = txt(m) || m.quoted?.text || '';
  if (!q) return m.reply('❌ Usage: .aiwriter <question>');
  m.reply('⏳ Réflexion en cours...');
  try {
    const ans = await pz.chat(q, 'aiwriter-chat');
    const senderJid = m.sender ? [m.sender] : [];
    await conn.sendMessage(m.chat, { text: `🤖 *AI Writer*\n\n@${(m.pushName || '').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '')} ${ans}`, contextInfo: { mentionedJid: senderJid } }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'aiapp', alias: ['aiappchat'], desc: 'Chat IA AiApp (Prexzy)', category: 'ai', filename: __filename }, async (conn, m) => {
  const q = txt(m) || m.quoted?.text || '';
  if (!q) return m.reply('❌ Usage: .aiapp <question>');
  m.reply('⏳ Réflexion en cours...');
  try {
    const ans = await chatOrFree('aiappchat', q);
    const senderJid = m.sender ? [m.sender] : [];
    await conn.sendMessage(m.chat, { text: `🤖 *AiApp Chat*\n\n@${(m.pushName || '').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '')} ${ans}`, contextInfo: { mentionedJid: senderJid } }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'ai4chat', desc: 'Chat IA AI4Chat (Prexzy)', category: 'ai', filename: __filename }, async (conn, m) => {
  const q = txt(m) || m.quoted?.text || '';
  if (!q) return m.reply('❌ Usage: .ai4chat <question>');
  m.reply('⏳ Réflexion en cours...');
  try {
    const ans = await chatOrFree('ai4chat', q);
    const senderJid = m.sender ? [m.sender] : [];
    await conn.sendMessage(m.chat, { text: `🤖 *AI4Chat*\n\n@${(m.pushName || '').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '')} ${ans}`, contextInfo: { mentionedJid: senderJid } }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'aiart', alias: ['genimg'], desc: 'Générer une image IA (Prexzy)', category: 'ai', filename: __filename }, async (conn, m) => {
  const q = txt(m);
  if (!q) return m.reply('❌ Usage: .aiart <prompt>');
  m.reply('🎨 Génération en cours...');
  try {
    const buf = await imagenFree(q);
    if (!buf) return m.reply('❌ Impossible de générer l\'image actuellement.');
    await conn.sendMessage(m.chat, { image: buf, caption: `🎨 *AI Art*\n${q}` }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'aiwimg', alias: ['aiwriter-image'], desc: 'Image IA AI Writer (Prexzy)', category: 'ai', filename: __filename }, async (conn, m) => {
  const q = txt(m);
  if (!q) return m.reply('❌ Usage: .aiwimg <prompt>');
  m.reply('🎨 Génération en cours...');
  try {
    const buf = await imagenFree(q);
    if (!buf) return m.reply('❌ Impossible de générer l\'image actuellement.');
    await conn.sendMessage(m.chat, { image: buf, caption: `🎨 *AI Writer Image*\n${q}` }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'ttsv', desc: 'Lister les voix TTS Prexzy', category: 'convert', filename: __filename }, async (conn, m) => {
  try {
    const voices = await pz.ttsVoices();
    const list = voices.map((v, i) => `${i + 1}. ${v}`).join('\n');
    m.reply(`🗣️ *Voix TTS disponibles (30)*\n\n${list}\n\nExemple: .tts2 mary Bonjour`);
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'tts2', alias: ['parlez', 'voix'], desc: 'Text-to-Speech via Prexzy (30 voix)', category: 'convert', filename: __filename }, async (conn, m) => {
  const parts = txt(m).split(/\s+(.+)/);
  let voice = 'adult female 1';
  let text = '';
  if (parts.length > 1 && pz.VOICE_SLUGS && pz.VOICE_SLUGS[parts[0].toLowerCase()]) {
    voice = parts[0];
    text = parts[1];
  } else {
    text = txt(m) || m.quoted?.text || '';
  }
  if (!text) return m.reply('❌ Usage: .tts2 <texte> ou .tts2 <voix> <texte>\nListe: .ttsv');
  m.reply('🗣️ Génération de la voix...');
  try {
    const buf = await pz.tts(text, voice);
    await conn.sendMessage(m.chat, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'lyrics', alias: ['paroles'], desc: 'Paroles de chanson (Prexzy)', category: 'search', filename: __filename }, async (conn, m) => {
  const q = txt(m);
  if (!q) return m.reply('❌ Usage: .lyrics <titre>');
  m.reply('🔍 Recherche des paroles...');
  try {
    const res = await fetchJson(`https://prexzyapis.com/search/lyrics?title=${encodeURIComponent(q)}`);
    const d = res.data || res.result || res;
    const ly = d.lyrics || d.text || (Array.isArray(d) && d[0]?.lyrics);
    if (!ly) return m.reply('❌ Paroles introuvables.');
    const head = `${d.title ? '🎵 *' + d.title + '*' : ''}${d.artist ? '\n👤 ' + d.artist : ''}\n\n`;
    await conn.sendMessage(m.chat, { text: head + String(ly).slice(0, 4000) }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'aio', desc: 'Télécharger vidéo/média (TT, IG, FB, YT...) via Prexzy', category: 'download', filename: __filename }, async (conn, m) => {
  const url = txt(m) || m.quoted?.text || '';
  if (!/^https?:\/\//.test(url)) return m.reply('❌ Usage: .aio <url>\nExemple: .aio https://www.tiktok.com/...');
  m.reply('⬇️ Téléchargement en cours...');
  try {
    const media = await pz.aioDownload(url);
    m.reply('🔄 Envoi du fichier...');
    const buf = await getBuffer(media);
    const attempts = [
      { video: buf, caption: '⬇️ Téléchargé via Prexzy' },
      { image: buf, caption: '⬇️ Téléchargé via Prexzy' },
      { audio: buf, mimetype: 'audio/mpeg' },
    ];
    let sent = false;
    for (const content of attempts) {
      try { await conn.sendMessage(m.chat, content, { quoted: m }); sent = true; break; } catch (e) { /* essai suivant */ }
    }
    if (!sent) m.reply('❌ Impossible d\'envoyer le média.');
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'quiz', desc: 'Quiz aléatoire (Prexzy)', category: 'games', filename: __filename }, async (conn, m) => {
  try {
    const res = await fetchJson('https://prexzyapis.com/game/quizrandom');
    const items = res.data || res.result || [];
    if (!items.length) return m.reply('❌ Aucun quiz disponible.');
    const q = items[0];
    const opts = Array.isArray(q.options) ? q.options.map((o, i) => `${'ABCD'[i] || i + 1}. ${o}`).join('\n') : '';
    const level = q.level ? `\n📊 Niveau: ${q.level}` : '';
    await conn.sendMessage(m.chat, {
      text: `❓ *Quiz*\n\n${q.question}${opts ? '\n\n' + opts : ''}${level}\n\n🔒 Réponse: ||${q.answer || '?'}||`,
      contextInfo: { externalAdReply: { title: '🎮 Quiz Prexzy', body: 'Jouez !', mediaType: 1 } }
    }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'styles', alias: ['allstyles'], desc: 'Styles de texte (Prexzy)', category: 'tools', filename: __filename }, async (conn, m) => {
  const q = txt(m);
  if (!q) return m.reply('❌ Usage: .styles <texte>');
  try {
    const res = await fetchJson(`https://prexzyapis.com/tools/allstyles?text=${encodeURIComponent(q)}`);
    const styles = res.styles || [];
    if (!styles.length) return m.reply('❌ Aucun style trouvé.');
    const list = styles.slice(0, 15).map(s => `*${s.style_name}:*\n${s.styled_text}`).join('\n\n');
    await conn.sendMessage(m.chat, { text: `✨ *Styles de texte*\n\n${list}` }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'ytstalk', desc: 'Stalk chaîne YouTube (Prexzy)', category: 'search', filename: __filename }, async (conn, m) => {
  const q = txt(m);
  if (!q) return m.reply('❌ Usage: .ytstalk <username>');
  try {
    const res = await fetchJson(`https://prexzyapis.com/stalk/ytstalk?user=${encodeURIComponent(q)}`);
    const d = res.data || res.result || res;
    const lines = [];
    const keys = { name: '📛 Nom', username: '@', description: '📝 Description', subscribers: '👥 Abonnés', subCount: '👥 Abonnés', videoCount: '🎬 Vidéos', country: '🌍 Pays', created_at: '📅 Créée', total_views: '👁️ Vues' };
    for (const [k, label] of Object.entries(keys)) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
        lines.push(label.startsWith('@') ? `${label}${d[k]}` : `${label}: ${d[k]}`);
      }
    }
    const pic = d.thumbnail || d.avatar || d.imageUrl || '';
    const msg = lines.length ? lines.join('\n') : JSON.stringify(d).slice(0, 1500);
    if (pic && /^https?:\/\//.test(pic)) {
      try { await conn.sendMessage(m.chat, { image: await getBuffer(pic), caption: `📺 *YouTube Stalk*\n\n${msg}` }, { quoted: m }); } catch { m.reply(msg); }
    } else m.reply(`📺 *YouTube Stalk*\n\n${msg}`);
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'igstalk', desc: 'Stalk compte Instagram (Prexzy)', category: 'search', filename: __filename }, async (conn, m) => {
  const q = txt(m);
  if (!q) return m.reply('❌ Usage: .igstalk <username>');
  try {
    const res = await fetchJson(`https://prexzyapis.com/stalk/igstalkV2?user=${encodeURIComponent(q)}`);
    const d = res.data || res.result || res;
    const lines = [];
    for (const [k, label] of Object.entries({ username: '👤 Username', full_name: '📛 Nom', followers: '👥 Followers', following: '🔁 Suivis', biography: '📝 Bio', posts: '📸 Posts', is_verified: '✅ Vérifié' })) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') lines.push(`${label}: ${d[k]}`);
    }
    const pic = d.profile_pic_url || d.avatar || '';
    const msg = lines.length ? lines.join('\n') : JSON.stringify(d).slice(0, 1500);
    if (pic && /^https?:\/\//.test(pic)) {
      try { await conn.sendMessage(m.chat, { image: await getBuffer(pic), caption: `📸 *Instagram Stalk*\n\n${msg}` }, { quoted: m }); } catch { m.reply(msg); }
    } else m.reply(`📸 *Instagram Stalk*\n\n${msg}`);
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'ssweb', alias: ['screenshot'], desc: 'Screenshot d\'un site (Prexzy)', category: 'tools', filename: __filename }, async (conn, m) => {
  const url = txt(m) || m.quoted?.text || '';
  if (!/^https?:\/\//.test(url)) return m.reply('❌ Usage: .ssweb <url>');
  m.reply('📸 Capture en cours...');
  try {
    const buf = await pz.apiBuffer('/ssweb/webss', { url });
    await conn.sendMessage(m.chat, { image: buf, caption: `📸 *Screenshot*\n${url}` }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'prandom', desc: 'Images aléatoires (cat, dog, boypic, japangirl, profilepics...)', category: 'fun', filename: __filename }, async (conn, m) => {
  const types = ['cat', 'dog', 'boypic', 'japangirl', 'koreangirl', 'profilepics', 'car', 'bluearchive'];
  const t = (txt(m) || 'cat').toLowerCase();
  if (!types.includes(t)) return m.reply('❌ Types: ' + types.join(', '));
  try {
    const buf = await pz.apiBuffer(`/random/${t}`);
    await conn.sendMessage(m.chat, { image: buf, caption: `🎲 *Random: ${t}*` }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'pshort', desc: 'Raccourcir une URL (v.gd via Prexzy)', category: 'tools', filename: __filename }, async (conn, m) => {
  const url = txt(m) || m.quoted?.text || '';
  if (!/^https?:\/\//.test(url)) return m.reply('❌ Usage: .pshort <url>');
  try {
    const res = await fetchJson(`https://prexzyapis.com/tools/vgd?url=${encodeURIComponent(url)}`);
    const short = res.url || res.result?.url || res.shorturl || res.data?.url;
    if (!short) return m.reply('❌ Impossible de raccourcir.');
    await conn.sendMessage(m.chat, { text: `🔗 *Lien raccourci:*\n${short}` }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});
