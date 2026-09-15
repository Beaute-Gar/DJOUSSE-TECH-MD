const fs = require('fs');
const path = require('path');
const { normalizeQuote, quoteHash, detectLanguage, categorize, isValidQuote } = require('./utils.cjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'status');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const QUOTES_SHORT_FILE = path.join(DATA_DIR, 'quotes-short.json');
const SOURCES_FILE = path.join(DATA_DIR, 'sources.json');
const REPORT_FILE = path.join(DATA_DIR, 'collection-report.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function deduplicate(allQuotes) {
  const seen = new Map();
  for (const q of allQuotes) {
    const key = `${normalizeQuote(q.text).toLowerCase()}|${normalizeQuote(q.author).toLowerCase()}`;
    if (seen.has(key)) {
      // Merge sources
      const existing = seen.get(key);
      for (const src of q.sources) {
        if (!existing.sources.find(s => s.name === src.name)) {
          existing.sources.push(src);
        }
      }
    } else {
      seen.set(key, q);
    }
  }
  return Array.from(seen.values());
}

function categorizeAll(quotes) {
  for (const q of quotes) {
    if (!q.categories || q.categories.length === 0) {
      q.categories = categorize(q.text);
    }
    if (!q.language) {
      q.language = detectLanguage(text);
    }
    if (!q.length) {
      q.length = q.text.length;
    }
  }
  return quotes;
}

async function run() {
  console.log('');
  console.log('========================================');
  console.log('  DJOUSSE TECH QUOTE COLLECTOR');
  console.log('========================================');
  console.log('');
  
  ensureDir(DATA_DIR);
  
  const allQuotes = [];
  const sourceStats = {};
  
  // GitHub
  try {
    const github = require('./github.cjs');
    const result = await github.collect();
    allQuotes.push(...result.quotes);
    sourceStats.github = { reposInspected: result.reposInspected, count: result.quotes.length };
    console.log(`GitHub repositories inspected : ${result.reposInspected}`);
    console.log(`GitHub quotes collected       : ${result.quotes.length}`);
  } catch (e) {
    console.error(`GitHub error: ${e.message}`);
    sourceStats.github = { error: e.message };
  }
  
  // Evolution Personnelle
  try {
    const ep = require('./evolution-personnelle.cjs');
    const result = await ep.collect();
    allQuotes.push(...result.quotes);
    sourceStats.evolutionPersonnelle = { count: result.count };
    console.log(`Evolution Personnelle        : ${result.count}`);
  } catch (e) {
    console.error(`Evolution Personnelle error: ${e.message}`);
    sourceStats.evolutionPersonnelle = { error: e.message };
  }
  
  // Ouest-France
  try {
    const of = require('./ouest-france.cjs');
    const result = await of.collect();
    allQuotes.push(...result.quotes);
    sourceStats.ouestFrance = { count: result.count };
    console.log(`Ouest-France                 : ${result.count}`);
  } catch (e) {
    console.error(`Ouest-France error: ${e.message}`);
    sourceStats.ouestFrance = { error: e.message };
  }
  
  console.log('');
  
  // Stats
  const totalBrut = allQuotes.length;
  const categorized = categorizeAll(allQuotes);
  const deduplicated = deduplicate(categorized);
  const doublonsSupprimes = totalBrut - deduplicated.length;
  
  const fr = deduplicated.filter(q => q.language === 'fr');
  const en = deduplicated.filter(q => q.language === 'en');
  const valid350 = deduplicated.filter(q => q.length <= 350);
  const valid250 = deduplicated.filter(q => q.length <= 250);
  const valid150 = deduplicated.filter(q => q.length <= 150);
  
  // Filter valid quotes
  const finalQuotes = deduplicated.filter(isValidQuote);
  const invalidEntries = deduplicated.length - finalQuotes.length;
  
  console.log(`Total brut                   : ${totalBrut}`);
  console.log(`Doublons supprimés           : ${doublonsSupprimes}`);
  console.log(`Entrées invalides            : ${invalidEntries}`);
  console.log(`Citations françaises         : ${fr.length}`);
  console.log(`Citations anglaises          : ${en.length}`);
  console.log(`Citations <= 350 caractères  : ${valid350.length}`);
  console.log(`Citations <= 250 caractères  : ${valid250.length}`);
  console.log(`Citations <= 150 caractères  : ${valid150.length}`);
  console.log('');
  console.log(`TOTAL FINAL                  : ${finalQuotes.length}`);
  console.log('========================================');
  
  // Save files
  writeJSON(QUOTES_FILE, finalQuotes);
  writeJSON(QUOTES_SHORT_FILE, finalQuotes.filter(q => q.length <= 250));
  writeJSON(SOURCES_FILE, {
    sources: Object.entries(sourceStats).map(([name, stats]) => ({
      name,
      lastChecked: new Date().toISOString(),
      ...stats,
    })),
    lastFullCollection: new Date().toISOString(),
  });
  writeJSON(REPORT_FILE, {
    date: new Date().toISOString(),
    totalBrut,
    doublonsSupprimes,
    invalidEntries,
    totalFinal: finalQuotes.length,
    fr: fr.length,
    en: en.length,
    valid350: valid350.length,
    valid250: valid250.length,
    valid150: valid150.length,
    sources: sourceStats,
  });
  
  return finalQuotes;
}

if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { run };
