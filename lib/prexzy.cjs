const { fetchJson, getBuffer } = require('./functions.cjs');

const BASE = 'https://prexzyapis.com';

async function api(path, params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const url = BASE + path + (qs ? '?' + qs : '');
  const res = await fetchJson(url);
  if (res && res.status === false) throw new Error(res.message || 'Erreur API Prexzy');
  return res;
}

async function apiBuffer(path, params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const url = BASE + path + (qs ? '?' + qs : '');
  return getBuffer(url);
}

function walk(obj, depth = 0) {
  const found = { text: null, url: null };
  if (!obj || typeof obj !== 'object' || depth > 6) return found;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      if (!found.text && k.toLowerCase().includes('text') && !k.toLowerCase().includes('url')) found.text = v;
      if (!found.url && /^https?:\/\//.test(v)) found.url = v;
    } else if (Array.isArray(v)) {
      if (!found.text) found.text = v.filter(x => typeof x === 'string').join('\n');
      for (const item of v.slice(0, 5)) {
        const r = walk(item, depth + 1);
        if (!found.text && r.text) found.text = r.text;
        if (!found.url && r.url) found.url = r.url;
      }
    } else if (v && typeof v === 'object') {
      const r = walk(v, depth + 1);
      if (!found.text && r.text) found.text = r.text;
      if (!found.url && r.url) found.url = r.url;
    }
  }
  return found;
}

const VOICE_SLUGS = {
  'adult female 1': 'tts-adult-female--1-american-english-truvoice',
  'adult female 2': 'tts-adult-female--2-american-english-truvoice',
  'adult male 1': 'tts-adult-male--1-american-english-truvoice',
  'adult male 2': 'tts-adult-male--2-american-english-truvoice',
  'male 3': 'tts-adult-male--3-american-english-truvoice',
  'male 4': 'tts-adult-male--4-american-english-truvoice',
  'male 5': 'tts-adult-male--5-american-english-truvoice',
  'male 6': 'tts-adult-male--6-american-english-truvoice',
  'male 7': 'tts-adult-male--7-american-english-truvoice',
  'male 8': 'tts-adult-male--8-american-english-truvoice',
  'whisper female': 'tts-female-whisper',
  'whisper male': 'tts-male-whisper',
  'female whisper': 'tts-female-whisper',
  'male whisper': 'tts-male-whisper',
  'whisper': 'tts-female-whisper',
  'mary': 'tts-mary',
  'mary telephone': 'tts-mary-for-telephone',
  'mary hall': 'tts-mary-in-hall',
  'mary space': 'tts-mary-in-space',
  'mary stadium': 'tts-mary-in-stadium',
  'mike': 'tts-mike',
  'mike telephone': 'tts-mike-for-telephone',
  'mike hall': 'tts-mike-in-hall',
  'mike space': 'tts-mike-in-space',
  'mike stadium': 'tts-mike-in-stadium',
  'robo 1': 'tts-robosoft-one',
  'robo 2': 'tts-robosoft-two',
  'robo 3': 'tts-robosoft-three',
  'robo 4': 'tts-robosoft-four',
  'robo 5': 'tts-robosoft-five',
  'robo 6': 'tts-robosoft-six',
  'bonzi': 'tts-bonzi',
  'sam': 'tts-sam',
};

async function tts(text, voice = 'adult female 1') {
  const slug = VOICE_SLUGS[(voice || '').toLowerCase()] || VOICE_SLUGS['adult female 1'];
  const res = await api(`/tts/${slug}`, { text });
  const audioUrl = res.audio_url?.result || res.result?.url || res.url;
  if (!audioUrl) throw new Error('Aucun audio trouvé dans la réponse TTS');
  return getBuffer(audioUrl);
}

async function ttsVoices() {
  const res = await api('/tts/tts-voices');
  return res.voices || [];
}

async function chat(prompt, endpoint = 'aiwriter-chat') {
  const res = await api(`/ai/${endpoint}`, { prompt });
  const { text } = walk(res);
  if (!text) throw new Error('Réponse vide de l\'IA');
  return text;
}

async function aiImage(prompt, endpoint = 'aiart') {
  const res = await api(`/ai/${endpoint}`, { prompt });
  const { url } = walk(res);
  if (!url) throw new Error('Aucune image générée');
  return getBuffer(url);
}

async function aioDownload(url) {
  const res = await api('/download/aio', { url });
  const media = res.url || res.result?.url;
  if (!media) throw new Error('Lien non trouvé (vidéo privée ou erreur)');
  return media;
}

module.exports = { BASE, api, apiBuffer, walk, tts, ttsVoices, chat, aiImage, aioDownload };
