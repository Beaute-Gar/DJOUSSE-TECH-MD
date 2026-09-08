import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('WEBSEARCH');

const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

async function groqSearch(query) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'Tu es un assistant de recherche. Génère une liste de 5 résultats de recherche web fictifs mais réalistes sur le sujet demandé. Format: chaque résultat doit avoir un titre, une URL plausible, un extrait informatif. Réponds UNIQUEMENT en JSON: [{"titre":"...","url":"...","extrait":"...","source":"..."}]' },
          { role: 'user', content: `Recherche web sur: ${query}` },
        ],
        temperature: 0.7, max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '[]';
    const parsed = JSON.parse(text);
    return (Array.isArray(parsed) ? parsed : parsed.results || []).slice(0, 5).map(r => ({
      titre: r.titre || r.title || '',
      url: r.url || '',
      extrait: r.extrait || r.snippet || r.description || '',
      source: r.source || (r.url || '').replace(/https?:\/\/(www\.)?/, '').split('/')[0] || '',
      date: null,
    }));
  } catch (e) {
    log.warn('Groq search: ' + e.message);
    return [];
  }
}

export async function rechercherSurLeWeb(requete, options = {}) {
  const { nombreResultats = 5 } = options;
  if (!requete) return [];

  const cleCache = `${requete.trim()}_${nombreResultats}`;
  if (cache.has(cleCache)) {
    const entry = cache.get(cleCache);
    if (Date.now() - entry.timestamp < CACHE_TTL) return entry.resultats;
    cache.delete(cleCache);
  }

  const results = await groqSearch(requete);
  if (results.length) {
    cache.set(cleCache, { timestamp: Date.now(), resultats: results });
  }
  return results.slice(0, nombreResultats);
}

export async function rechercherActualites(theme, nombreResultats = 5) {
  const queries = [
    `actualité récente ${theme} 2025 Cameroun`,
    `dernières nouvelles ${theme}`,
    `${theme} tendance actuelle`,
  ];
  const all = [];
  for (const q of queries) {
    const r = await rechercherSurLeWeb(q, { nombreResultats: 3 });
    all.push(...r);
    if (all.length >= nombreResultats) break;
  }
  const seen = new Set();
  return all.filter(r => { const key = r.url; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, nombreResultats);
}

export function formatterResultatsRecherche(requete, resultats) {
  let texte = `🌐 *Résultats pour :* ${requete}\n\n`;
  resultats.forEach((r, i) => {
    texte += `${i + 1}. *${r.titre}*\n   ${r.extrait}\n   ${r.url}\n\n`;
  });
  return texte.trim();
}
