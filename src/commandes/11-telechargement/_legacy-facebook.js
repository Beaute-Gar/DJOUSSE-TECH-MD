'use strict';

const axios = require('axios');
const { getStr } = require('../_partage/theme');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── Strategy 1: cobalt.tools (primary — actively maintained public API) ───────
async function tryCobalt(url) {
    const res = await axios.post('https://api.cobalt.tools/', { url, downloadMode: 'auto' }, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': UA,
        },
        timeout: 20000,
    });
    const d = res.data;
    // status: 'redirect' | 'stream' → single video URL
    // status: 'picker' → array of items
    if (d?.status === 'redirect' || d?.status === 'stream') {
        if (!d.url) throw new Error('cobalt: no url in response');
        return { videoUrl: d.url, title: 'Facebook Video' };
    }
    if (d?.status === 'picker' && Array.isArray(d.picker)) {
        const video = d.picker.find(i => i.type === 'video') || d.picker[0];
        if (!video?.url) throw new Error('cobalt: picker has no url');
        return { videoUrl: video.url, title: 'Facebook Video' };
    }
    if (d?.error?.code) throw new Error(`cobalt: ${d.error.code}`);
    throw new Error('cobalt: unexpected response');
}

// ─── Strategy 2: snapsave.app (supports Facebook + Instagram) ─────────────────
/* snapsave renvoie du JS obfusqué (packer) dont l'exécution écrit le HTML des
   liens dans #download-section. On déballe le packer, on lit la chaîne
   innerHTML, puis on décode le JWT du proxy pour retrouver l'URL fbcdn
   directe. Vérifié le 2026-10-29 : HTTP 200, video/mp4, 5,1 Mo. */
function unpackSnapsave(raw) {
    if (!raw.includes('eval(')) return raw;
    // `eval(...)` → `return (...)` : la parenthèse fermante d'origine suffit.
    return new Function(`${raw.slice(raw.indexOf('var _0x')).replace(/eval\(/, 'return (')}`)();
}

function readInnerHtml(js) {
    const at = js.indexOf('.innerHTML');
    if (at < 0) return '';
    const q = js.indexOf('"', js.indexOf('=', at));
    if (q < 0) return '';
    let out = '';
    for (let k = q + 1; k < js.length; k += 1) {
        const ch = js[k];
        if (ch === '\\') { out += js[k + 1]; k += 1; continue; }
        if (ch === '"') break;
        out += ch;
    }
    return out;
}

function decodeToken(url) {
    const token = /token=([^&]+)/.exec(url)?.[1];
    if (!token) return null;
    try {
        const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(Buffer.from(part, 'base64').toString('utf8'))?.url || null;
    } catch {
        return null;
    }
}

async function trySnapsave(url) {
    const r1 = await axios.get('https://snapsave.app/', {
        headers: { 'User-Agent': UA },
        timeout: 12000,
    });
    const cookies = (r1.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const r2 = await axios.post('https://snapsave.app/action.php',
        new URLSearchParams({ url }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookies,
                'Referer': 'https://snapsave.app/',
                'Origin': 'https://snapsave.app',
                'User-Agent': UA,
            },
            timeout: 18000,
        }
    );

    const raw = typeof r2.data === 'string' ? r2.data : JSON.stringify(r2.data);
    if (raw.includes('Unable to connect') || raw.includes('error_api')) throw new Error('snapsave: blocked');

    let html = '';
    try {
        const js = unpackSnapsave(raw);
        html = readInnerHtml(js) || js;
    } catch (e) {
        throw new Error(`snapsave: unpack (${String(e.message).slice(0, 40)})`);
    }

    if (/video is private/i.test(html)) throw new Error('snapsave: vidéo privée');

    const links = [...html.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((l) => /^https?:/.test(l));

    for (const link of links) {
        const direct = decodeToken(link);
        if (direct) return { videoUrl: direct, fallbackUrl: link, title: 'Facebook Video' };
    }
    if (links.length) return { videoUrl: links[0], title: 'Facebook Video' };
    throw new Error('snapsave: no video url found');
}

// ─── Strategy 3: fdown.net ────────────────────────────────────────────────────
async function tryFdown(url) {
    const r = await axios.post('https://fdown.net/search.php',
        new URLSearchParams({ URLz: url }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://fdown.net/',
                'Origin': 'https://fdown.net',
                'User-Agent': UA,
            },
            timeout: 18000,
        }
    );
    const html = typeof r.data === 'string' ? r.data : '';
    const hd  = html.match(/id=["']?hdlink["']?[^>]*href=["']([^"']+)["']/i);
    const sd  = html.match(/id=["']?sdlink["']?[^>]*href=["']([^"']+)["']/i);
    // Also try generic mp4 link
    const any = html.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    const videoUrl = hd?.[1] || sd?.[1] || any?.[1];
    if (!videoUrl) throw new Error('fdown: no video url');
    return { videoUrl: videoUrl.replace(/&amp;/g, '&'), title: 'Facebook Video' };
}

// ─── Strategy 4: getvideourl.com ─────────────────────────────────────────────
async function tryGetVideoUrl(url) {
    const res = await axios.post('https://getvideourl.com/api/facebook',
        new URLSearchParams({ url }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
                'Referer': 'https://getvideourl.com/',
            },
            timeout: 15000,
        }
    );
    const d = res.data;
    const videoUrl = d?.hd || d?.sd || d?.url;
    if (!videoUrl) throw new Error('getvideourl: no url');
    return { videoUrl, title: d?.title || 'Facebook Video' };
}

// ─── Strategy 5: fdownloader.net ─────────────────────────────────────────────
async function tryFdownloader(url) {
    const res = await axios.post('https://fdownloader.net/api/ajaxSearch',
        `q=${encodeURIComponent(url)}&lang=en&web=facebook`,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://fdownloader.net/',
            },
            timeout: 15000,
        }
    );
    const d    = res.data;
    const html = typeof d === 'string' ? d : d?.data || JSON.stringify(d);
    const hd   = html.match(/href=["'](https?:\/\/[^"']*video[^"']*)\s*["'][^>]*>\s*(?:HD|High)/i);
    const sd   = html.match(/href=["'](https?:\/\/[^"']*video[^"']*)\s*["'][^>]*>\s*(?:SD|Normal)/i);
    const any  = html.match(/href=["'](https?:\/\/(?:video\.f?acdn|[^"']*fbcdn)[^"']+\.mp4[^"']*)/i);
    const videoUrl = hd?.[1] || sd?.[1] || any?.[1];
    if (!videoUrl) throw new Error('fdownloader: no video url');
    return { videoUrl, title: 'Facebook Video' };
}

module.exports = {
    commands:    ['facebook', 'fb', 'fbdl'],
    description: 'Download a Facebook video',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, { sender, prefix, contextInfo }) => {
        const url = args[0];
        if (!url) {
            return sock.sendMessage(sender, {
                text: `✳️ Please send a Facebook video link.\n\nExample: ${prefix}fb https://www.facebook.com/...`,
                contextInfo,
            }, { quoted: message });
        }

        const urlRegex = /^(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.watch|m\.facebook\.com|fb\.com)\b/i;
        if (!urlRegex.test(url)) {
            return sock.sendMessage(sender, {
                text: '⚠️ Please provide a valid Facebook URL.',
                contextInfo,
            }, { quoted: message });
        }

        await sock.sendMessage(sender, { text: '📥 Fetching Facebook video...', contextInfo }, { quoted: message });

        const STRATEGIES = [
            /* snapsave en tête : cobalt.tools exige désormais une clé
               (HTTP 400 vérifié le 2026-10-29) et les sites Cloudflare
               (fdown/fdownloader) refusent les IP de datacenter. */
            { name: 'snapsave',        fn: () => trySnapsave(url)      },
            { name: 'getvideourl',     fn: () => tryGetVideoUrl(url)   },
            { name: 'cobalt.tools',    fn: () => tryCobalt(url)       },
            { name: 'fdown.net',       fn: () => tryFdown(url)         },
            { name: 'fdownloader.net', fn: () => tryFdownloader(url)   },
        ];

        let videoUrl = null;
        let title    = 'Facebook Video';
        let fallbackUrl = null;
        const errors = [];

        for (const { name, fn } of STRATEGIES) {
            try {
                const r = await fn();
                if (r?.videoUrl) {
                    videoUrl    = r.videoUrl;
                    title       = r.title || title;
                    fallbackUrl = r.fallbackUrl || null;
                    console.log(`[FB] ✓ ${name}`);
                    break;
                }
            } catch (e) {
                const msg = String(e?.message || e).slice(0, 80);
                errors.push(`${name}: ${msg}`);
                console.warn(`[FB] ✗ ${name}: ${msg}`);
            }
        }

        if (!videoUrl) {
            return sock.sendMessage(sender, {
                text:
                    `❌ *Facebook Download Failed*\n\n` +
                    `All sources failed — this happens with private or restricted videos.\n\n` +
                    `_Last error: ${errors.slice(-1)[0] || 'unknown'}_\n\n` +
                    `🔗 Try manually:\nhttps://snapsave.app\nhttps://fdown.net`,
                contextInfo,
            }, { quoted: message });
        }

        const advert = {
            ...contextInfo,
            externalAdReply: {
                title:                 'Facebook Downloader',
                body:                  'Powered by ' + (getStr('botName') || 'Silva MD'),
                thumbnailUrl:          'https://files.catbox.moe/h6zdty.png',
                sourceUrl:             url,
                mediaType:             1,
                renderLargerThumbnail: true,
            },
        };
        const asVideo = (link) => sock.sendMessage(sender, {
            video:   { url: link },
            caption: `🦋 *Facebook*  •  📌 ${title}`,
            contextInfo: advert,
        }, { quoted: message });

        try {
            try {
                await asVideo(videoUrl);
            } catch {
                /* fbcdn direct peut refuser selon la région : proxy rapidcdn */
                if (!fallbackUrl) throw new Error('direct');
                await asVideo(fallbackUrl);
            }
        } catch {
            await sock.sendMessage(sender, {
                document: { url: fallbackUrl || videoUrl },
                mimetype: 'video/mp4',
                fileName: `facebook_${Date.now()}.mp4`,
                caption:  `🦋 *Facebook*  •  📌 ${title}`,
                contextInfo,
            }, { quoted: message });
        }
    },
};
