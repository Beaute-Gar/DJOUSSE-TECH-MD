/* src/services/status-auto.cjs — Publication automatique de statuts sur le compte owner.
   Au démarrage : 1) présentation image+texte du bot, 2) note vocale de présentation,
   3) publications périodiques d'infos (APIs gratuites) — tout en "mode silencieux"
   (aucun message privé, uniquement le statut WhatsApp du propriétaire). */

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { fetchJson, getBuffer } = require('../../lib/functions.cjs');
const { voiceWithMusic, mp3ToVoiceNote } = require('../../lib/voice.cjs');
const config = require('../../config-djousse.cjs');

const STATUS_JID = 'status@broadcast';
const BOT_IMG = path.join(__dirname, '..', '..', 'media', 'djousse.jpg');
const INFO_INTERVAL_MS = 5 * 60 * 60 * 1000; /* 1 publication d'info toutes les 5 h */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const INTRO_CAPTION =
  '*🤖 DJOUSSE-TECH MD v2.1*\n\n' +
  '👑 *C\'est moi, DJOUSSE TECH, qui contrôle ce compte !*\n\n' +
  '👀 *Jette un œil à TON statut* 👇\n' +
  '➡️ Nouvelle fonctionnalité : je *like tes statuts* avec des *ÉMOJIS variés* ' +
  '(🔥 😂 ❤️ 👍 ...) au lieu du simple cœur vert de WhatsApp.\n\n' +
  '✨ Réactions ultra-rapides dès que tu publies.\n' +
  '📢 Le *prochain statut* sera ma présentation *vocale* 🎙️';

const VOICE_SCRIPT =
  'Salut ! Moi, c\'est DJOUSSE TECH, ton assistant personnel WhatsApp. Mon objectif : te faciliter la vie ' +
  'en automatisant tout, avec une intelligence intégrée. Et je peux faire des choses que WhatsApp refuse ' +
  'ou interdit normalement. Par exemple : lire une photo à vue unique, la télécharger après lecture, ' +
  'voir les messages supprimés, surveiller tes statuts automatiquement, et bien plus encore. ' +
  'Tape le point suivi du mot menu pour découvrir toutes mes capacités. Reste à l\'écoute, je publie ' +
  'régulièrement ici des infos exclusives et des nouveautés. À très vite !';

/* ─────────────────────────── Sources d'infos gratuites ─────────────────────────── */

const INFO_SOURCES = [
  {
    name: 'Hacker News',
    async fetch() {
      const top = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', { timeout: 15000 });
      const ids = Array.isArray(top.data) ? top.data.slice(0, 4) : [];
      for (const id of ids) {
        try {
          const { data } = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 10000 });
          if (data && data.title && data.type === 'story') {
            return {
              title: data.title,
              source: 'Hacker News',
              url: data.url || `https://news.ycombinator.com/item?id=${id}`,
            };
          }
        } catch {}
      }
      return null;
    },
  },
  {
    name: 'Actualité tech (Reddit r/technology)',
    async fetch() {
      const { data } = await axios.get('https://www.reddit.com/r/technology/hot.json?limit=5', {
        headers: { 'User-Agent': UA },
        timeout: 15000,
      });
      const posts = (data?.data?.children || [])
        .map(c => c?.data)
        .filter(p => p && p.title && !p.stickied && !p.title.toLowerCase().startsWith('[removed]'))
        .slice(0, 1);
      const p = posts[0];
      if (!p) return null;
      return {
        title: p.title,
        source: 'Reddit r/technology',
        url: 'https://www.reddit.com' + (p.permalink || ''),
      };
    },
  },
  {
    name: 'Espace (SpaceX)',
    async fetch() {
      const { data } = await axios.get('https://api.spacexdata.com/v4/launches/latest', { timeout: 15000 });
      if (!data || !data.name) return null;
      return {
        title: `${data.name} — ${data.details || 'Lancement SpaceX récent.'}`,
        source: 'SpaceX',
        url: data.links?.webcast || data.links?.article || 'https://www.spacex.com',
      };
    },
  },
];

async function fetchFreeInfo() {
  for (const src of INFO_SOURCES) {
    try {
      const info = await src.fetch();
      if (info && info.title) return info;
    } catch (e) {
      console.log('⚠️ [status-auto] source ' + src.name + ': ' + e.message);
    }
  }
  return null;
}

function buildInfoCaption(info) {
  return (
    '*📰 INFO FLASH · DJOUSSE TECH*\n\n' +
    info.title +
    '\n\n' +
    '📡 Source : ' + info.source +
    (info.url ? '\n🔗 ' + info.url : '') +
    '\n\n> ✦ Publié automatiquement par DJOUSSE-TECH-MD'
  );
}

/* ─────────────────────────── Publication ─────────────────────────── */

function isSockAlive(sock) {
  return sock && typeof sock.sendMessage === 'function' && global.isConnected === true;
}

async function publishIntroStatus(sock) {
  if (!isSockAlive(sock)) return false;
  try {
    let img = null;
    try { if (fs.existsSync(BOT_IMG)) img = fs.readFileSync(BOT_IMG); } catch {}
    if (!img) {
      try { img = await getBuffer(config.ALIVE_IMG); } catch {}
    }
    if (img) {
      await sock.sendMessage(STATUS_JID, { image: img, caption: INTRO_CAPTION });
    } else {
      await sock.sendMessage(STATUS_JID, { text: INTRO_CAPTION });
    }
    console.log('📤 [status-auto] Statut de présentation publié.');
    return true;
  } catch (e) {
    console.error('❌ [status-auto] Intro:', e.message);
    return false;
  }
}

async function publishVoiceStatus(sock) {
  if (!isSockAlive(sock)) return false;
  try {
    const mixed = await voiceWithMusic(VOICE_SCRIPT, { voice: 'google', music: 'synth' });
    if (!mixed) return false;
    const vn = mp3ToVoiceNote(mixed);
    if (vn) {
      await sock.sendMessage(STATUS_JID, { audio: vn.audio, mimetype: vn.mimetype, ptt: true, seconds: vn.seconds });
    } else {
      await sock.sendMessage(STATUS_JID, { audio: mixed, mimetype: 'audio/mpeg', ptt: true });
    }
    console.log('🎙️ [status-auto] Statut vocal de présentation publié.');
    return true;
  } catch (e) {
    console.error('❌ [status-auto] Voix:', e.message);
    return false;
  }
}

async function publishInfoStatus(sock) {
  if (!isSockAlive(sock)) return false;
  try {
    const info = await fetchFreeInfo();
    if (!info) return false;
    await sock.sendMessage(STATUS_JID, { text: buildInfoCaption(info) });
    console.log('📰 [status-auto] Info publiée : ' + info.source);
    return true;
  } catch (e) {
    console.error('❌ [status-auto] Info:', e.message);
    return false;
  }
}

/* ─────────────────────────── Cycle complet ───────────────────────────
   initStatusAuto(sock) est appelé à chaque connexion 'open'.
   La garde global.__statusAutoStarted empêche les doublons multi-connexions. */

function initStatusAuto(sock) {
  if (!sock || global.__statusAutoStarted) return;
  global.__statusAutoStarted = true;

  const phase = global.__statusAutoPhase || 0;

  /* Phase 0 : présentation image + texte (au boot), puis voix ~30 s après. */
  if (phase === 0) {
    publishIntroStatus(sock);
    setTimeout(() => publishVoiceStatus(sock), 30 * 1000);
  } else {
    /* Les connexions suivantes ne re-spamment pas la présentation. */
  }

  /* Publication périodique d'infos (toutes les 5 h, pas de spam). */
  const timer = setInterval(() => publishInfoStatus(sock), INFO_INTERVAL_MS);
  if (timer.unref) timer.unref();

  setTimeout(() => publishInfoStatus(sock), 2 * 60 * 60 * 1000); /* 1ère info 2 h après boot */
}

module.exports = { initStatusAuto, publishIntroStatus, publishVoiceStatus, publishInfoStatus, fetchFreeInfo };
