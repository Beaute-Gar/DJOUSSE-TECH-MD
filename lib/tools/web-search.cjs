'use strict';

const fetch = globalThis.fetch || (() => { throw new Error('fetch not available'); });

async function searchWeb(query, limit = 5) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const results = [];
    const regex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) && results.length < limit) {
      let href = match[1];
      try {
        const u = new URL(href, 'https://duckduckgo.com');
        href = u.searchParams.get('uddg') || href;
      } catch (_) {}
      const titre = match[2].replace(/<[^>]+>/g, '').trim();
      const extrait = match[3].replace(/<[^>]+>/g, '').trim();
      if (titre) results.push({ titre, url: href, extrait, source: 'DuckDuckGo' });
    }
    return results;
  } catch (e) {
    return [];
  }
}

module.exports = { searchWeb };
