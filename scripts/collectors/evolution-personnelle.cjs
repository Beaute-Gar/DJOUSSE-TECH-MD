const { normalizeQuote, quoteHash, detectLanguage, categorize, isValidQuote, fetchURL } = require('./utils.cjs');

const URL = 'https://www.evolutionpersonnelle.fr/citations-courtes-inspirantes/';

function decodeHTMLEntities(text) {
  return text
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/&#\d+;/g, '');
}

async function collect() {
  const allQuotes = [];
  
  try {
    const rawHtml = await fetchURL(URL, 20000);
    const html = decodeHTMLEntities(rawHtml);
    
    // Extract all « ... » patterns
    const guillemetPattern = /\u00AB\s*([^]{10,350}?)\s*\u00BB/g;
    let m;
    while ((m = guillemetPattern.exec(html)) !== null) {
      let text = normalizeQuote(m[1]);
      if (!isValidQuote({ text })) continue;
      
      // Find author after the closing guillemet
      const afterMatch = html.substring(m.index + m[0].length, m.index + m[0].length + 300);
      // Look for author pattern: usually a name on the next line
      const authorPatterns = [
        /\n\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)+)/,
        /\s+([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)+)\s*$/,
        /\n\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)/,
      ];
      
      let author = 'Inconnu';
      for (const ap of authorPatterns) {
        const am = afterMatch.match(ap);
        if (am && am[1] && am[1].length > 3 && am[1].length < 50) {
          const candidate = normalizeQuote(am[1]);
          // Filter out common non-author strings
          if (!['Table des matières', 'Toggle', 'Les plus', 'Les meilleures', 'De courtes', 'Des citations', 'Votre évolution', 'Les citations', 'Ce qu\'il faut', 'Laisser un', 'Comment'].some(x => candidate.startsWith(x))) {
            author = candidate;
            break;
          }
        }
      }
      
      allQuotes.push({
        id: `ep_${quoteHash(text, author)}`,
        text,
        author,
        categories: categorize(text),
        language: detectLanguage(text),
        length: text.length,
        sources: [{ name: 'Evolution Personnelle', url: URL, license: 'Contenu éditorial' }],
        needsVerification: false,
      });
    }
  } catch (e) {
    console.error(`[EVOLUTION] Erreur: ${e.message}`);
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allQuotes.filter(q => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
  
  return { quotes: unique, count: unique.length };
}

module.exports = { collect };
