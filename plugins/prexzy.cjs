const { cmd } = require('../command.cjs');
const { fetchJson, getBuffer } = require('../lib/functions.cjs');
const pz = require('../lib/prexzy.cjs');

const txt = m => (m.body || '').split(' ').slice(1).join(' ').trim();

cmd({ pattern: 'ttsv', desc: 'Lister les voix TTS Prexzy', category: 'convert', filename: __filename }, async (conn, m) => {
  try {
    const voices = await Promise.race([
      pz.ttsVoices(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API TTS indisponible')), 8000)),
    ]);
    const list = voices.map((v, i) => `${i + 1}. ${v}`).join('\n');
    m.reply(`🗣️ *Voix TTS disponibles (30)*\n\n${list}\n\nExemple: .tts2 mary Bonjour`);
  } catch (e) { m.reply('❌ Liste des voix TTS temporairement indisponible. Utilise directement `.tts2 <texte>`.'); }
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

cmd({ pattern: 'paroles', alias: ['lyricsprexzy'], desc: 'Paroles de chanson (Prexzy)', category: 'search', filename: __filename }, async (conn, m) => {
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
