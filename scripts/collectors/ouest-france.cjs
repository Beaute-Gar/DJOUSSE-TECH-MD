const { normalizeQuote, quoteHash, detectLanguage, categorize, isValidQuote, fetchURL } = require('./utils.cjs');

const URLS = [
  'https://citations.ouest-france.fr/top/citations-motivation/',
  'https://citations.ouest-france.fr/top/citations-vie/',
  'https://citations.ouest-france.fr/top/citations-sagesse/',
];

async function collect() {
  const allQuotes = [];
  
  for (const url of URLS) {
    try {
      const html = await fetchURL(url, 20000);
      
      // Extract quotes from Ouest-France HTML
      // Pattern 1: Text in quote blocks
      const p1 = /class="[^"]*(?:quote|citation|text)[^"]*"[^>]*>\s*([«"]?[^<»"]{15,350}[»"]?)\s*<\/[^>]+>/gi;
      let m;
      while ((m = p1.exec(html)) !== null) {
        const text = normalizeQuote(m[1].replace(/^[«"]/, '').replace(/[»"]$/, ''));
        if (isValidQuote({ text }) && text.length >= 15) {
          // Try to find author nearby
          const afterText = html.substring(m.index + m[0].length, m.index + m[0].length + 500);
          const authorMatch = afterText.match(/class="[^"]*(?:author|auteur|name)[^"]*"[^>]*>\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)/i);
          const author = authorMatch ? normalizeQuote(authorMatch[1]) : 'Inconnu';
          
          allQuotes.push({
            id: `of_${quoteHash(text, author)}`,
            text,
            author,
            categories: categorize(text),
            language: detectLanguage(text),
            length: text.length,
            sources: [{ name: 'Ouest-France', url, license: 'Contenu éditorial' }],
            needsVerification: false,
          });
        }
      }
      
      // Pattern 2: Blockquotes
      const p2 = /<blockquote[^>]*>\s*(?:<[^>]+>)*\s*([«"]?[^<»"]{15,350}[»"]?)\s*(?:<[^>]+>)*\s*<\/blockquote>/gi;
      while ((m = p2.exec(html)) !== null) {
        const text = normalizeQuote(m[1].replace(/^[«"]/, '').replace(/[»"]$/, ''));
        if (isValidQuote({ text }) && text.length >= 15) {
          const afterText = html.substring(m.index + m[0].length, m.index + m[0].length + 500);
          const authorMatch = afterText.match(/<(?:cite|span|div|p)[^>]*>\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)/i);
          const author = authorMatch ? normalizeQuote(authorMatch[1]) : 'Inconnu';
          
          allQuotes.push({
            id: `of_${quoteHash(text, author)}`,
            text,
            author,
            categories: categorize(text),
            language: detectLanguage(text),
            length: text.length,
            sources: [{ name: 'Ouest-France', url, license: 'Contenu éditorial' }],
            needsVerification: false,
          });
        }
      }
    } catch (e) {
      console.error(`[OUEST-FRANCE] ${url}: ${e.message}`);
    }
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
