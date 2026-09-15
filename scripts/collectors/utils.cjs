const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Normalize quote text
function normalizeQuote(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u00A0/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
}

// Hash for dedup
function quoteHash(text, author) {
  const normalized = `${normalizeQuote(text).toLowerCase()}|${normalizeQuote(author).toLowerCase()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

// Detect language
function detectLanguage(text) {
  const frenchWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'est', 'sont', 'nous', 'vous', 'ils', 'elles', 'dans', 'pour', 'avec', 'qui', 'que', 'quoi', 'pas', 'ne', 'se', 'son', 'sa', 'ses', 'ma', 'mes', 'ta', 'tes', 'on', 'je', 'tu', 'il', 'elle', 'mais', 'ou', 'donc', 'car', 'ni', 'si', 'tout', 'tous', 'toute', 'toutes', 'cette', 'ces', 'mon', 'ton', 'notre', 'votre', 'leur', 'leurs', 'être', 'avoir', 'faire', 'aller', 'venir', 'dire', 'voir', 'pouvoir', 'vouloir', 'devoir', 'prendre', 'mettre', 'falloir', 'rester', 'paraître', 'croire', 'passer', 'suivre', 'partir', 'vivre'];
  const words = text.toLowerCase().split(/\s+/);
  const frenchCount = words.filter(w => frenchWords.includes(w)).length;
  return frenchCount >= 2 ? 'fr' : 'en';
}

// Categorize based on keywords
function categorize(text) {
  const lower = text.toLowerCase();
  const cats = [];
  const rules = [
    ['motivation', ['motivation', 'motiver', 'motivant', 'courage', 'ose', 'osé', 'osez', 'force', 'combattre', 'avancer', 'avance', 'agir', 'action', 'vouloir', 'pouvoir']],
    ['réussite', ['réussite', 'réussir', 'succès', 'gagner', 'victoire', 'objectif', 'but', 'atteindre', 'triompher', 'excellence']],
    ['échec', ['échec', 'échouer', 'échoué', 'erreur', 'tomber', 'défaite', 'perdre']],
    ['persévérance', ['persévérance', 'persévérer', 'continuer', 'jamais abandonner', 'tenace', 'persister', 'endurer', 'patience', 'attendre']],
    ['discipline', ['discipline', 'régulier', 'routine', 'habitude', 'constance', 'rigueur']],
    ['travail', ['travail', 'travailler', 'effort', 'mérite', 'labeur', 'entreprise', 'profession', 'métier', 'carrière']],
    ['études', ['école', 'étude', 'étudier', 'apprendre', 'savoir', 'connaissance', 'éducation', 'enseigner', 'professeur', 'université', 'diplôme', 'intelligence']],
    ['sagesse', ['sagesse', 'sage', 'wisdom', 'prudent', 'réfléchir', 'penser', 'réflexion', 'philosophie', 'proverbe']],
    ['vie', ['vie', 'vivre', 'exister', 'jour', 'temps', 'présent', 'moment', 'bonheur', 'destin', 'destinée', 'humanité']],
    ['amour', ['amour', 'aimer', 'passion', 'cœur', 'sentiment', 'tendresse', 'affection']],
    ['courage', ['courage', 'courageux', 'brave', 'hardi', 'intrépide', 'peur', 'franchir', 'affronter', 'combattre']],
    ['confiance', ['confiance', 'croire', 'croyance', 'espoir', 'foi', 'certitude', 'conviction']],
    ['leadership', ['leader', 'leadership', 'diriger', 'chef', 'commander', 'guide', 'inspirer', 'vision']],
    ['business', ['business', 'entreprise', 'entrepreneur', 'startup', 'innovation', 'marché', 'profit', 'vente', 'client']],
    ['technologie', ['technologie', 'digital', 'numérique', 'internet', 'ordinateur', 'programmation', 'code', 'robot', 'intelligence artificielle', 'ia']],
    ['créativité', ['créativité', 'créatif', 'créer', 'imagination', 'inventer', 'innover', 'originalité', 'art', 'artistique']],
    ['temps', ['temps', 'passé', 'futur', 'avenir', 'hier', 'demain', 'aujourd', 'heure', 'minute', 'seconde', 'âge', 'vieillir']],
    ['émotions', ['émotion', 'sentiment', 'joie', 'tristesse', 'colère', 'peur', 'surprise', 'bonheur', 'malheur', 'sourire', 'rire', 'pleurer']],
    ['voyage', ['voyage', 'voyager', 'découvrir', 'pays', 'monde', 'aventure', 'explorer', 'horizon', 'route', 'chemin']],
    ['spiritualité', ['âme', 'esprit', 'spirituel', 'méditer', 'prière', 'transcendant', 'univers', 'cosmos', 'destin', 'karma']],
    ['proverbe', ['proverbe', 'dicton', 'maxime', 'adage', 'sage dit', 'on dit', 'dit-on']],
  ];
  
  for (const [cat, keywords] of rules) {
    if (keywords.some(kw => lower.includes(kw))) {
      cats.push(cat);
    }
  }
  
  return cats.length > 0 ? cats : ['vie'];
}

// Validate quote
function isValidQuote(q) {
  if (!q || !q.text) return false;
  const text = normalizeQuote(q.text);
  if (text.length < 10) return false;
  if (['undefined', 'null', 'API error', 'citation introuvable', 'N/A', ''].includes(text)) return false;
  return true;
}

// Fetch URL with timeout
function fetchURL(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    const client = url.startsWith('https') ? https : http;
    const urlObj = new globalThis.URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    };
    const req = client.get(options, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(timer);
        // Strip BOM
        if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
        resolve(data);
      });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('Timeout')); });
  });
}

// Parse HTML to extract quotes (simple)
function extractQuotesFromHTML(html, sourceName, sourceUrl) {
  const quotes = [];
  // Match patterns like « ... » or "..." followed by author
  const patterns = [
    /[«"]([^»"]{15,350})[»"]\s*(?:\n\s*)?(?:—|–|-|de|by|,)\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)/g,
    /[""]([^""]{15,350})[""]\s*(?:\n\s*)?(?:—|–|-)\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = normalizeQuote(match[1]);
      const author = normalizeQuote(match[2]);
      if (isValidQuote({ text })) {
        quotes.push({
          text,
          author: author || 'Auteur inconnu',
          source: sourceName,
          sourceUrl,
        });
      }
    }
  }
  return quotes;
}

module.exports = {
  normalizeQuote,
  quoteHash,
  detectLanguage,
  categorize,
  isValidQuote,
  fetchURL,
  extractQuotesFromHTML,
};
