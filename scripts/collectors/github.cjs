const { normalizeQuote, quoteHash, detectLanguage, categorize, isValidQuote, fetchURL } = require('./utils.cjs');

const REPOS = [
  { url: 'https://raw.githubusercontent.com/vinitshahdeo/inspirational-quotes/master/data/data.json', name: 'vinitshahdeo/inspirational-quotes', license: 'MIT' },
];

async function collect() {
  const allQuotes = [];
  let reposInspected = 0;
  
  for (const repo of REPOS) {
    try {
      reposInspected++;
      const raw = await fetchURL(repo.url, 20000);
      const data = JSON.parse(raw);
      
      if (!Array.isArray(data)) continue;
      
      for (const item of data) {
        const text = normalizeQuote(item.text || item.quote || item.q || '');
        const author = normalizeQuote(item.from || item.author || item.a || 'Inconnu');
        
        if (!isValidQuote({ text })) continue;
        
        const lang = detectLanguage(text);
        const cats = categorize(text);
        
        allQuotes.push({
          id: `gh_${quoteHash(text, author)}`,
          text,
          author,
          categories: cats,
          language: lang,
          length: text.length,
          sources: [{ name: repo.name, url: repo.url, license: repo.license }],
          needsVerification: false,
        });
      }
    } catch (e) {
      console.error(`[GITHUB] Erreur ${repo.name}: ${e.message}`);
    }
  }
  
  return { quotes: allQuotes, reposInspected };
}

module.exports = { collect };
