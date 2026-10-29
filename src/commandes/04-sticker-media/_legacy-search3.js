'use strict';

const axios  = require('axios');
const playdl = require('play-dl');
const { fmt } = require('../_partage/theme');

// Dead APIs removed (2026-06): siputzx (all search endpoints), unsplash anon key (no quota)
// Replacements: DuckDuckGo instant answers for google, play-dl for YouTube search

module.exports = {
    commands: [
        'google', 'npm', 'apkmirror', 'happymod',
        'ggleimage', 'unsplash', 'wallpapers', 'wattpad',
        'yts', 'spotifysearch'
    ],
    description: 'Extended search commands',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const cmd  = (message.message?.extendedTextMessage?.text
            || message.message?.conversation || '').trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();
        const query = args.join(' ').trim();
        const send  = (t) => sock.sendMessage(jid, { text: fmt(t), contextInfo }, { quoted: message });

        if (!query && !['wallpapers'].includes(cmd)) {
            return send(`❌ *Usage:* \`.${cmd} <search query>\``);
        }

        await sock.sendPresenceUpdate('composing', jid);

        if (cmd === 'google') {
            try {
                // Essai Serper (recherche Google officielle) si clé configurée
                if (config.serperKey) {
                    const res = await axios.post(
                        'https://google.serper.dev/search',
                        { q: query },
                        { headers: { 'X-API-KEY': config.serperKey }, timeout: 15000 }
                    );
                    const j = res.data;
                    const items = j?.organic || [];
                    if (items.length > 0) {
                        let text = `🔍 *Google Serper : "${query}"*\n\n`;
                        items.slice(0, 5).forEach((item, i) => {
                            const title = item.title || '';
                            const link = item.link || '';
                            const snippet = item.snippet || '';
                            text += `*${i + 1}.* ${title.slice(0, 100)}\n   🔗 ${link}\n   ${snippet.slice(0, 200)}\n\n`;
                        });
                        return await sock.sendMessage(jid, { text: text }, { quoted: message });
                    }
                }
                const abstract = d?.AbstractText || d?.Answer || '';
                const topics = (d?.RelatedTopics || [])
                    .filter(t => t.Text && t.FirstURL)
                    .slice(0, 5);

                if (!abstract && !topics.length) throw new Error('no results');

                let text = `🔍 *Google / DuckDuckGo: "${query}"*\n\n`;
                if (abstract) text += `📝 ${abstract.slice(0, 300)}\n\n`;
                if (topics.length) {
                    text += topics.map((t, i) =>
                        `*${i + 1}.* ${t.Text?.slice(0, 100)}\n   🔗 ${t.FirstURL}`
                    ).join('\n\n');
                }
                return send(text);
            } catch {
                return send(
                    `🔍 *Google: "${query}"*\n\n` +
                    `🔗 https://google.com/search?q=${encodeURIComponent(query)}\n` +
                    `🔗 https://duckduckgo.com/?q=${encodeURIComponent(query)}`
                );
            }
        }

        if (cmd === 'npm') {
            try {
                const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(query)}`, { timeout: 10000 });
                const d   = res.data;
                const latest = d?.['dist-tags']?.latest;
                return send(
                    `📦 *NPM: ${d.name}*\n\n` +
                    `📝 ${d.description?.slice(0, 200) || 'No description'}\n\n` +
                    `🏷️ *Latest:* ${latest}\n` +
                    `📅 *Modified:* ${d.time?.[latest]?.split('T')[0] || 'N/A'}\n` +
                    `📥 *Install:* \`npm install ${d.name}\`\n` +
                    `🔗 https://npmjs.com/package/${d.name}`
                );
            } catch { return send(`❌ Package \`${query}\` not found on npm.`); }
        }

        if (cmd === 'apkmirror') {
            /* Aptoide : API publique réelle (vérifiée le 2026-10-29) —
               recherche JSON + APK direct (HTTP 206, application/vnd.android.package-archive).
               APKMirror/APKPure n'exposent aucune API (403 / bloqué). */
            const APTOIDE = 'https://ws75.aptoide.com/api/7';
            const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

            if (!query) {
                return send(
                    `📱 *Téléchargeur APK*\n\n` +
                    `• \`.apkmirror whatsapp\` — rechercher\n` +
                    `• \`.apkmirror com.whatsapp\` — télécharger par nom de paquet\n\n` +
                    `_Source : Aptoide_`
                );
            }

            const looksPackage = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(query);
            try {
                let app = null;

                if (looksPackage) {
                    const g = await axios.get(
                        `${APTOIDE}/app/get/package_name=${encodeURIComponent(query)}`,
                        { headers: { 'User-Agent': UA }, timeout: 15000 }
                    );
                    app = g.data?.nodes?.meta?.data || null;
                } else {
                    const s = await axios.get(
                        `${APTOIDE}/apps/search?query=${encodeURIComponent(query)}&limit=6`,
                        { headers: { 'User-Agent': UA }, timeout: 15000 }
                    );
                    const list = s.data?.datalist?.list || [];
                    if (list.length > 1) {
                        const lines = list.map((a, i) => {
                            const size = Number(a.size) > 0 ? `${(Number(a.size) / 1048576).toFixed(1)} Mo` : 'taille ?';
                            return `${i + 1}. *${a.name}*\n   \`${a.package}\` · v${a.file?.vername || '?'} · ${size}`;
                        });
                        return send(
                            `📱 *APK : "${query}"*  (${list.length} résultats)\n\n` +
                            `${lines.join('\n')}\n\n` +
                            `📥 Télécharger : \`.apkmirror <nom.de.paquet>\`\n` +
                            `_ex. \`.apkmirror ${list[0].package}\`_`
                        );
                    }
                    app = list[0] || null;
                }

                if (!app) throw new Error('application introuvable');

                const apk = app.file?.path;
                if (!apk) throw new Error('aucun APK disponible');

                await sock.sendMessage(jid, {
                    document: { url: apk },
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: `${app.package}-${app.file.vername || 'latest'}.apk`,
                    caption:
                        `📱 *${app.name}*\n` +
                        `📦 \`${app.package}\`\n` +
                        `🏷️ v${app.file.vername || '?'}  ·  ${(Number(app.size) / 1048576).toFixed(1)} Mo\n\n` +
                        `_Source : Aptoide_`,
                    contextInfo,
                }, { quoted: message });
                return;
            } catch (e) {
                return send(
                    `📱 *APK : "${query}"* — introuvable sur Aptoide.\n\n` +
                    `🔗 https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(query)}\n` +
                    `🔗 https://search.f-droid.org/?q=${encodeURIComponent(query)}&lang=en\n\n` +
                    `_${String(e.message).slice(0, 60)}_`
                );
            }
        }

        if (cmd === 'happymod') {
            return send(`🎮 *HappyMod: "${query}"*\n\n🔗 https://www.happymod.com/search.html?q=${encodeURIComponent(query)}\n\n_Click to search HappyMod_`);
        }

        if (cmd === 'ggleimage') {
            // siputzx image search is dead — provide Google Images link
            return send(
                `🖼️ *Google Images: "${query}"*\n\n` +
                `🔗 https://www.google.com/images?q=${encodeURIComponent(query)}\n` +
                `🔗 https://www.pexels.com/search/${encodeURIComponent(query)}/\n\n` +
                `_Click a link to browse images online_`
            );
        }

        if (cmd === 'unsplash') {
            // Unsplash public API requires a valid app key; provide link fallback
            return send(
                `📷 *Unsplash: "${query}"*\n\n` +
                `🔗 https://unsplash.com/s/photos/${encodeURIComponent(query)}\n\n` +
                `_Browse high-quality free photos on Unsplash_`
            );
        }

        if (cmd === 'wallpapers') {
            /* Wallhaven : API publique sans clé, vérifiée HTTP 200 le
               2026-10-29. Remplace les liens morts Pexels/Unsplash. */
            const q = query || 'nature 4k';
            try {
                const res = await axios.get(
                    `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(q)}&categories=111&purity=100&sorting=relevance`,
                    { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }
                );
                const items = (res.data?.data || []).slice(0, 8);
                if (!items.length) throw new Error('aucun résultat');
                const lines = items.map((w, i) => `${i + 1}. ${w.resolution}\n   ${w.path}`);
                return send(
                    `🖼️ *Wallpapers : "${q}"* — Wallhaven\n\n` +
                    `${lines.join('\n')}\n\n` +
                    `🔗 https://wallhaven.cc/search?q=${encodeURIComponent(q)}`
                );
            } catch {
                return send(
                    `🖼️ *Wallpapers : "${q}"*\n\n` +
                    `🔗 https://wallhaven.cc/search?q=${encodeURIComponent(q)}`
                );
            }
        }

        if (cmd === 'wattpad') {
            try {
                const res = await axios.get(
                    `https://www.wattpad.com/api/v3/stories?query=${encodeURIComponent(query)}&limit=5&fields=id,title,description,mainCategory,readCount`,
                    { timeout: 10000 }
                );
                const stories = res.data?.stories || [];
                if (!stories.length) return send(`📚 No Wattpad stories found for: *${query}*`);
                const list = stories.map((s, i) =>
                    `*${i + 1}.* ${s.title}\n   📖 ${s.mainCategory || 'Fiction'} | 👁 ${(s.readCount || 0).toLocaleString()} reads\n   ${s.description?.slice(0, 80) || ''}`
                ).join('\n\n');
                return send(`📚 *Wattpad: "${query}"*\n\n${list}\n\n🔗 https://www.wattpad.com/stories/${encodeURIComponent(query)}`);
            } catch {
                return send(`📚 *Wattpad: "${query}"*\n\n🔗 https://www.wattpad.com/stories/${encodeURIComponent(query)}`);
            }
        }

        if (cmd === 'yts') {
            try {
                // play-dl YouTube search — no external API key needed
                const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });
                if (!results?.length) return send(`▶️ No YouTube results for: *${query}*`);
                const list = results.map((v, i) =>
                    `*${i + 1}.* ${v.title}\n   ⏱ ${v.durationRaw || 'N/A'} | 👤 ${v.channel?.name || 'N/A'}\n   🔗 ${v.url}`
                ).join('\n\n');
                return send(`▶️ *YouTube: "${query}"*\n\n${list}`);
            } catch {
                return send(`▶️ *YouTube: "${query}"*\n\n🔗 https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
            }
        }

        if (cmd === 'spotifysearch') {
            // Spotify search API requires OAuth — provide link instead
            return send(
                `🎵 *Spotify: "${query}"*\n\n` +
                `🔗 https://open.spotify.com/search/${encodeURIComponent(query)}\n\n` +
                `_Click to search on Spotify_\n` +
                `_To download a song as audio, use: \`.spotify ${query}\`_`
            );
        }
    }
};
