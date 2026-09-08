import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { rawGet, rawRun } from '../../infrastructure/database/database.js';

const execFileAsync = promisify(execFile);

const VOICES = {
  homme:     { elevenlabs: 'JBFqnCBsd6RMkjVDRZzb', groq: 'Fritz-PlayAI' },
  femme:     { elevenlabs: 'XrExE9yKIg1WjnnlVkIz', groq: 'Lily-PlayAI' },
  jeune:     { elevenlabs: '21m00Tcm4TlvDq8ikWAM', groq: 'Ethan-PlayAI' },
  mature:    { elevenlabs: 'ODq5zmih8GrVes37Dizd', groq: 'Daniel-PlayAI' },
  dynamique: { elevenlabs: 'TxGEqnHWrfWFTfGW9XjX', groq: 'Fritz-PlayAI' },
  douce:     { elevenlabs: 'XU6kSs3xMo0kF5J8Dn8A', groq: 'Lily-PlayAI' },
};

export async function genererVocal(texte, voiceId, options = {}) {
  const { backgroundMusic = false } = options;
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY ou GROQ_API_KEY manquant dans .env');

  const voiceProfile = VOICES[voiceId] || VOICES.homme;
  const eId = process.env.ELEVENLABS_VOICE_ID || voiceProfile.elevenlabs;

  let audioBuf;

  try {
    const reponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${eId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texte,
        model_id: 'eleven_v3',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (reponse.ok) {
      const bufferMp3 = Buffer.from(await reponse.arrayBuffer());
      audioBuf = await convertirEnOggOpus(bufferMp3, 'mp3');
    } else if (reponse.status === 401 || reponse.status === 402) {
      console.warn('[Voice] ElevenLabs refusé, fallback Groq TTS');
    } else {
      throw new Error(`ElevenLabs erreur HTTP ${reponse.status}`);
    }
  } catch (err) {
    console.warn('[Voice] Fallback Groq TTS:', err.message);
  }

  if (!audioBuf) {
    const groqVoice = voiceProfile.groq;
    const reponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'playai-tts',
        voice: groqVoice,
        input: texte,
        response_format: 'wav',
      }),
    });
    if (!reponse.ok) throw new Error(`Groq TTS erreur HTTP ${reponse.status}`);
    const bufferWav = Buffer.from(await reponse.arrayBuffer());
    audioBuf = await convertirEnOggOpus(bufferWav, 'wav');
  }

  if (backgroundMusic && audioBuf && audioBuf.length > 100) {
    try {
      audioBuf = await ajouterFondMusical(audioBuf);
    } catch (e) {
      console.warn('[Voice] Fond musical ignoré:', e.message);
    }
  }

  return audioBuf;
}

async function convertirEnOggOpus(bufferAudio, ext) {
  const idTemp = Date.now();
  const cheminEntree = path.join(os.tmpdir(), `djousse_tts_${idTemp}.${ext}`);
  const cheminSortie = path.join(os.tmpdir(), `djousse_tts_${idTemp}.ogg`);

  try {
    await fs.writeFile(cheminEntree, bufferAudio);
    await execFileAsync('ffmpeg', [
      '-i', cheminEntree,
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-ar', '48000',
      '-ac', '1',
      cheminSortie,
    ]);
    return await fs.readFile(cheminSortie);
  } finally {
    await fs.unlink(cheminEntree).catch(() => {});
    await fs.unlink(cheminSortie).catch(() => {});
  }
}

async function ajouterFondMusical(voiceBuf) {
  const bgUrl = process.env.BG_MUSIC_URL || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  const tmpdir = os.tmpdir();
  const id = Date.now();
  const voiceFile = path.join(tmpdir, `dj_voice_${id}.ogg`);
  const musicFile = path.join(tmpdir, `dj_music_${id}.mp3`);
  const outFile = path.join(tmpdir, `dj_mixed_${id}.ogg`);

  try {
    await fs.writeFile(voiceFile, voiceBuf);

    const musicResp = await fetch(bgUrl);
    if (!musicResp.ok) throw new Error(`HTTP ${musicResp.status}`);
    await fs.writeFile(musicFile, Buffer.from(await musicResp.arrayBuffer()));

    const { stdout: durStr } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', voiceFile,
    ]);
    const voiceDur = parseFloat(durStr.trim()) || 30;

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', voiceFile,
      '-i', musicFile,
      '-filter_complex',
      `[1:a]volume=0.1,atrim=duration=${voiceDur}[bg];[0:a][bg]amix=inputs=2:duration=first[out]`,
      '-map', '[out]',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-ar', '48000',
      '-ac', '1',
      outFile,
    ]);

    return await fs.readFile(outFile);
  } finally {
    await fs.unlink(voiceFile).catch(() => {});
    await fs.unlink(musicFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});
  }
}

export function getAvailableVoices() {
  return Object.keys(VOICES);
}

export async function doitRepondreEnVocal(jid, texteReponse) {
  const preference = await getPreferenceVocal(jid);
  if (!preference) return false;
  const tropCourt = texteReponse.length < 25;
  const contientListeOuChiffres = /(\n-|\n\d\.|:\s*\d)/.test(texteReponse);
  return !tropCourt && !contientListeOuChiffres;
}

export async function activerVocal(jid, actif = true) {
  const maintenant = Date.now();
  const existant = await rawGet('SELECT jid FROM preferences_vocal WHERE jid = ?', [jid]);
  if (existant) {
    await rawRun('UPDATE preferences_vocal SET vocal_active = ?, maj_le = ? WHERE jid = ?', [actif ? 1 : 0, maintenant, jid]);
  } else {
    await rawRun('INSERT INTO preferences_vocal (jid, vocal_active, maj_le) VALUES (?, ?, ?)', [jid, actif ? 1 : 0, maintenant]);
  }
}

export async function getPreferenceVocal(jid) {
  const ligne = await rawGet('SELECT vocal_active FROM preferences_vocal WHERE jid = ?', [jid]);
  return !!ligne?.vocal_active;
}
