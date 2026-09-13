const { cmd } = require('../command.cjs');
const { transcribe } = require('../lib/ai.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');

cmd({ pattern: 'transcribe', alias: ['stt', 'voicetotext'], desc: 'Transcrire un message vocal en texte (Whisper Large v3)', category: 'ai', filename: __filename }, async (conn, m) => {
  try {
    const quoted = m.quoted || m;
    const isAudio = quoted?.msg?.audioMessage || quoted?.type === 'audioMessage' || quoted?.type === 'videoMessage';
    if (!isAudio) return m.reply('❌ Réponds à un *message vocal* avec .transcribe');
    await m.reply('🎙️ Transcription en cours... (Whisper Large v3)');
    const t0 = Date.now();
    const buf = await downloadMediaMessage(quoted, 'tts_' + Date.now());
    if (!buf) return m.reply('❌ Impossible de télécharger l\'audio.');
    const result = await transcribe(buf, { filename: 'audio.mp3' });
    if (!result || !result.text) return m.reply('❌ Aucune parole détectée.');
    const dur = Math.round(result.duration || 0);
    m.reply('📝 *TRANSCRIPTION (Whisper Large v3)*\n\n' + result.text +
      '\n\n⏱️ ' + (Date.now() - t0) + 'ms' + (dur ? ' | 🎧 ' + dur + 's' : '') + (result.language ? ' | 🌐 ' + result.language : ''));
  } catch (e) {
    m.reply('❌ Erreur transcription: ' + e.message);
  }
});
