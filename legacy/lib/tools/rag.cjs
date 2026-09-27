'use strict';

const fetch = globalThis.fetch || (() => { throw new Error('fetch not available'); });

const memory = [];

async function ingestUrl(url, opts = {}) {
  const maxChars = opts.maxChars || 20000;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);

  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || url;
  const chunkSize = 1000;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  const entry = { title, source: url, chunks, text, ts: Date.now() };
  memory.push(entry);

  return { title, source: url, chunks: chunks.length };
}

async function answer(question) {
  if (!memory.length) {
    return { answer: '📭 Aucune donnée en mémoire RAG. Utilisez `.ainoria rag <url>` pour ingérer du contenu.', hits: [] };
  }

  const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = memory.map(entry => {
    const lower = entry.text.toLowerCase();
    let score = 0;
    for (const w of qWords) {
      const matches = lower.split(w).length - 1;
      score += matches;
    }
    return { entry, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  if (!scored.length) {
    return { answer: '🔍 Aucune correspondance trouvée dans la mémoire RAG.', hits: [] };
  }

  const best = scored[0].entry;
  const hits = scored.map(s => ({ title: s.entry.title, source: s.entry.source }));
  const excerpt = best.text.slice(0, 1500);

  return { answer: `📖 *${best.title}*\n\n${excerpt}...`, hits };
}

module.exports = { ingestUrl, answer };
