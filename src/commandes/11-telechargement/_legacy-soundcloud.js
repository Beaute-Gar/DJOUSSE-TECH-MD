'use strict';
const axios = require('axios');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* SoundCloud ne sert plus de flux progressif : uniquement du HLS.
   ffmpeg lit la playlist directement et écrit un MP3 sur stdout. */
function hlsToMp3(url, maxBytes = 64 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const ff = spawn(ffmpegPath, [
            '-hide_banner', '-loglevel', 'error',
            '-i', url, '-vn', '-b:a', '128k', '-f', 'mp3', 'pipe:1',
        ]);
        const chunks = [];
        let size = 0;
        let err = '';
        ff.stdout.on('data', (c) => {
            size += c.length;
            if (size > maxBytes) {
                try { ff.kill(); } catch { /* déjà mort */ }
                reject(new Error('fichier trop volumineux'));
            } else chunks.push(c);
        });
        ff.stderr.on('data', (c) => { err += c.toString().slice(0, 400); });
        ff.on('error', reject);
        ff.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err.trim() || `ffmpeg (code ${code})`))));
    });
}

/* ── API publique SoundCloud (api-v2) ────────────────────────────────
   SoundCloud n'ouvre plus son API aux applications tierces, mais son
   lecteur web utilise encore api-v2.soundcloud.com avec un client_id
   public. On le récupère dynamiquement dans les bundles JS (il change
   régulièrement) et on le met en cache pour la durée du process. */

let clientIdCache = null;
let clientIdAt = 0;
const CLIENT_ID_TTL = 6 * 60 * 60 * 1000;

async function soundcloudClientId() {
    if (clientIdCache && Date.now() - clientIdAt < CLIENT_ID_TTL) return clientIdCache;

    const page = await axios.get('https://soundcloud.com/', {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 15000,
    });
    const assets = [...String(page.data).matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)]
        .map((m) => m[1]);

    for (const asset of assets.slice(-10).reverse()) {
        try {
            const js = await axios.get(asset, { headers: { 'User-Agent': UA }, timeout: 15000 });
            const found = String(js.data).match(/client_id\s*[:=]\s*["']([A-Za-z0-9]{20,})["']/);
            if (found) {
                clientIdCache = found[1];
                clientIdAt = Date.now();
                return clientIdCache;
            }
        } catch { /* bundle suivant */ }
    }
    throw new Error('client_id SoundCloud introuvable');
}

/* Résolution officielle d'une piste puis lecture du transcodage progressif
   (le seul flux directement jouable par WhatsApp ; HLS nécessiterait ffmpeg). */
async function trySoundcloudApi(url) {
    const cid = await soundcloudClientId();
    const res = await axios.get(
        `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${cid}`,
        { headers: { 'User-Agent': UA }, timeout: 15000 }
    );
    const track = res.data;
    if (!track?.media) throw new Error(track?.kind === 'playlist' ? 'playlist non supportée' : 'piste introuvable');

    const transcodings = track.media.transcodings || [];
    const progressive = transcodings.find((x) => x.format?.protocol === 'progressive');
    const hls = transcodings.find((x) => x.format?.protocol === 'hls');

    /* 1. flux progressif (rare désormais) : URL directe, aucun transcodage */
    if (progressive?.url) {
        const stream = await axios.get(`${progressive.url}?client_id=${cid}`, {
            headers: { 'User-Agent': UA }, timeout: 15000,
        });
        const audioUrl = stream.data?.url;
        if (audioUrl) {
            return { audioUrl, title: track.title || 'SoundCloud Track', author: track.user?.username || 'Unknown' };
        }
    }

    /* 2. HLS (cas standard) : ffmpeg convertit la playlist en MP3 */
    if (hls?.url) {
        const stream = await axios.get(`${hls.url}?client_id=${cid}`, {
            headers: { 'User-Agent': UA }, timeout: 15000,
        });
        const playlist = stream.data?.url;
        if (!playlist) throw new Error('playlist HLS vide');
        const buffer = await hlsToMp3(playlist);
        return { buffer, title: track.title || 'SoundCloud Track', author: track.user?.username || 'Unknown' };
    }

    throw new Error('aucun flux exploitable');
}

module.exports = {
    commands:    ['soundcloud', 'scdl', 'sc'],
    description: 'Download SoundCloud audio',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, { sender, contextInfo }) => {
        const url = args[0];
        if (!url || !url.includes('soundcloud.com')) {
            return sock.sendMessage(sender, {
                text: '🎵 Please provide a valid SoundCloud URL.\nExample: `.sc https://soundcloud.com/artist/track`',
                contextInfo
            }, { quoted: message });
        }
        await sock.sendMessage(sender, { text: '⏳ Downloading SoundCloud audio...', contextInfo }, { quoted: message });

        const strategies = [
            // Strategy 1: API officielle api-v2 (client_id dynamique) — source primaire
            () => trySoundcloudApi(url),

            // Strategy 2: soundcloudmp3.io (scraper de secours)
            async () => {
                const res = await axios.get(
                    `https://soundcloudmp3.io/api/soundcloud?url=${encodeURIComponent(url)}`,
                    { headers: { 'User-Agent': UA }, timeout: 20000 }
                );
                const d = res.data;
                const audioUrl = d?.url || d?.download_url || d?.audio;
                if (!audioUrl) throw new Error('no url');
                return { audioUrl, title: d?.title || 'SoundCloud Track', author: d?.artist || 'Unknown' };
            },

            // Strategy 3: api.fabdl.com (scraper de secours)
            async () => {
                const res = await axios.get(
                    `https://api.fabdl.com/soundcloud/get?url=${encodeURIComponent(url)}`,
                    { headers: { 'User-Agent': UA }, timeout: 20000 }
                );
                const d = res.data?.result;
                const audioUrl = d?.download_url || d?.url;
                if (!audioUrl) throw new Error('no url');
                return { audioUrl, title: d?.title || 'SoundCloud Track', author: d?.artist || 'Unknown' };
            },
        ];

        for (const strat of strategies) {
            try {
                const { audioUrl, buffer, title, author } = await strat();
                await sock.sendMessage(sender, {
                    audio: buffer || { url: audioUrl }, mimetype: 'audio/mpeg', ptt: false, contextInfo
                }, { quoted: message });
                await sock.sendMessage(sender, {
                    text: `🎵 *${title}*\n👤 ${author}\n_Powered by Silva MD_`, contextInfo
                }, { quoted: message });
                return;
            } catch (e) {
                console.warn(`[SC] ✗ ${String(e?.message || e).slice(0, 120)}`);
            }
        }

        await sock.sendMessage(sender, {
            text:
                `❌ *SoundCloud Download Failed*\n\n` +
                `Use one of these free tools instead:\n\n` +
                `🔗 https://soundcloudmp3.io\n` +
                `🔗 https://www.klickaud.co\n\n` +
                `_Paste your SoundCloud link there_`,
            contextInfo
        }, { quoted: message });
    }
};
