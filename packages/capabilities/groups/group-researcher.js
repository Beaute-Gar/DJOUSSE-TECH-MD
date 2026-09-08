import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('RESEARCH');

class GroupResearcher {
  constructor(config = {}) {
    this.config = config;
    this.cache = new Map();

    this.searchSources = [
      { name: 'google', search: this.searchGoogle.bind(this) },
      { name: 'duckduckgo', search: this.searchDuckDuckGo.bind(this) },
      { name: 'mojeek', search: this.searchMojeek.bind(this) },
    ];
  }

  async researchGroup(groupName, groupDescription = '') {
    log.info(`Recherche multi-sources pour : "${groupName}"`);

    const cacheKey = groupName.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 86400000) {
      log.info('Résultat trouvé en cache (24h)');
      return cached.data;
    }

    const searchResults = await this.searchAllSources(groupName);
    const analysis = await this.analyzeWithAI(groupName, groupDescription, searchResults);
    const contentSuggestions = await this.generateContentSuggestions(analysis, groupName);

    const result = {
      groupName,
      analysis,
      contentSuggestions,
      searchResults,
      sourcesUsed: Object.keys(searchResults).filter(k => searchResults[k].length > 0),
      timestamp: Date.now(),
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

    log.info(`Recherche terminée — Sources : ${result.sourcesUsed.join(', ')}, Type : ${analysis.communityType}`);
    return result;
  }

  async searchAllSources(query) {
    const results = { google: [], duckduckgo: [], mojeek: [] };

    const searches = this.searchSources.map(async (source) => {
      try {
        log.info(`Recherche ${source.name}...`);
        const sourceResults = await source.search(query);
        results[source.name] = sourceResults;
        log.info(`${source.name} : ${sourceResults.length} résultats`);
      } catch (e) {
        log.warn(`${source.name} indisponible : ${e.message}`);
        results[source.name] = [];
      }
    });

    await Promise.allSettled(searches);

    const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    log.info(`Total : ${total} résultats combinés`);
    return results;
  }

  async searchGoogle(query) {
    try {
      const searchQuery = encodeURIComponent(`${query} groupe communauté whatsapp`);
      const url = `https://www.google.com/search?q=${searchQuery}&hl=fr&gl=CI&num=15`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const results = [];

      const resultRegex = /<div[^>]*class="[^"]*g[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div[^>]*class="[^"]*(?:VwiC3b|st)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      const matches = [...html.matchAll(resultRegex)];

      for (const m of matches) {
        const title = m[2].replace(/<[^>]*>/g, '').trim();
        const snippet = m[3].replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").trim();
        if (title && snippet && snippet.length > 20) {
          results.push({ title, snippet: snippet.substring(0, 300), link: m[1], source: 'google' });
        }
      }

      return results.slice(0, 10);
    } catch (e) {
      log.warn(`Google error: ${e.message}`);
      return [];
    }
  }

  async searchDuckDuckGo(query) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=fr-fr`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DJOUSSE-TECH/2.2)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const results = [];

      const blocks = html.split('class="result__body"');
      for (let i = 1; i < blocks.length; i++) {
        const b = blocks[i];
        const titleMatch = b.match(/class="result__title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        if (title && snippet && snippet.length > 10) {
          results.push({ title, snippet: snippet.substring(0, 300), link: '', source: 'duckduckgo' });
        }
      }

      return results.slice(0, 10);
    } catch (e) {
      log.warn(`DuckDuckGo error: ${e.message}`);
      return [];
    }
  }

  async searchMojeek(query) {
    try {
      const url = `https://www.mojeek.com/search?q=${encodeURIComponent(query)}&lang=fr`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DJOUSSE-TECH/2.2)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const results = [];

      const resultRegex = /<li[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<p[^>]*class="[^"]*s[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
      const matches = [...html.matchAll(resultRegex)];

      for (const m of matches) {
        results.push({
          title: m[2].replace(/<[^>]*>/g, '').trim(),
          snippet: m[3].replace(/<[^>]*>/g, '').trim().substring(0, 300),
          link: m[1],
          source: 'mojeek',
        });
      }

      return results.slice(0, 10);
    } catch {
      return [];
    }
  }

  async analyzeWithAI(groupName, description, allResults) {
    log.info('Analyse IA des résultats combinés...');

    const allSnippets = [];
    for (const [, results] of Object.entries(allResults)) {
      results.forEach(r => allSnippets.push(r.title + ': ' + r.snippet));
    }
    const uniqueSnippets = [...new Set(allSnippets)].slice(0, 15);
    const searchContext = uniqueSnippets.join('\n');

    const prompt = `Analyse ce groupe WhatsApp à partir de son nom et des résultats de recherche web.

NOM DU GROUPE : "${groupName}"
DESCRIPTION : "${description || 'Non fournie'}"

RÉSULTATS DE RECHERCHE (Google + DuckDuckGo) :
${searchContext.substring(0, 3000)}

ANALYSE DEMANDÉE (réponds UNIQUEMENT en JSON valide) :

{
  "mainTopic": "Sujet principal du groupe (1 phrase)",
  "communityType": "Type de communauté (ex: Gaming, Anime, Sport, Business, Education, Musique, Religion, Tech, Famille, Général)",
  "popularTopics": ["sujet1", "sujet2", "sujet3", "sujet4", "sujet5"],
  "trendingItems": [
    { "name": "Nom de l'item tendance", "reason": "Pourquoi c'est populaire", "details": "Détails supplémentaires" }
  ],
  "recentNews": ["actualité1", "actualité2", "actualité3"],
  "commonQuestions": ["question1", "question2", "question3"],
  "keywords": ["mot-clé1", "mot-clé2", "mot-clé3"],
  "suggestedContent": {
    "games": ["jeu1", "jeu2", "jeu3"],
    "topics": ["sujet1", "sujet2", "sujet3"],
    "challenges": ["défi1", "défi2"],
    "debates": ["débat1", "débat2"],
    "tips": ["astuce1", "astuce2"]
  }
}`;

    try {
      const aiResponse = await this.callAI(prompt);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        analysis.popularTopics = analysis.popularTopics || [];
        analysis.trendingItems = analysis.trendingItems || [];
        analysis.recentNews = analysis.recentNews || [];
        analysis.commonQuestions = analysis.commonQuestions || [];
        log.info(`Analyse IA réussie : ${analysis.communityType}`);
        return analysis;
      }
      throw new Error('JSON non trouvé');
    } catch (e) {
      log.warn(`Analyse IA échouée, fallback: ${e.message}`);
      return this.fallbackAnalysis(groupName, allResults);
    }
  }

  fallbackAnalysis(groupName, allResults) {
    const allText = Object.values(allResults).flat().map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
    const combined = `${groupName.toLowerCase()} ${allText}`;

    const patterns = [
      { pattern: /roblox|blox fruit|adopt me|brookhaven|jailbreak|tower of hell|robux/i, type: 'Gaming / Roblox', topics: ['Blox Fruits', 'Adopt Me!', 'Brookhaven RP', 'Jailbreak', 'Tower of Hell', 'Robux'], trending: [{ name: 'Blox Fruits', reason: 'Combats épiques', details: 'Jeu inspiré de One Piece' }, { name: 'Adopt Me!', reason: 'Collection d\'animaux', details: 'Jeu social le plus populaire' }] },
      { pattern: /anime|manga|otaku|naruto|one piece|demon slayer|jujutsu|attack on titan|dragon ball/i, type: 'Anime / Manga', topics: ['One Piece', 'Demon Slayer', 'Jujutsu Kaisen', 'Attack on Titan', 'Naruto', 'Dragon Ball'], trending: [{ name: 'Jujutsu Kaisen', reason: 'Arc Shibuya épique', details: 'Saison 2 combats intenses' }, { name: 'One Piece', reason: 'Saga finale', details: 'Le One Piece bientôt révélé' }] },
      { pattern: /foot|football|sport|match|can|champions league|mercato/i, type: 'Sport / Football', topics: ['CAN 2025', 'Champions League', 'Premier League', 'Ligue 1', 'Mercato'], trending: [{ name: 'CAN 2025', reason: 'Compétition africaine', details: 'Meilleures équipes d\'Afrique' }, { name: 'Champions League', reason: 'Phase finale', details: 'Plus grands clubs européens' }] },
      { pattern: /business|commerce|vente|entrepreneur|startup|investissement|marketing/i, type: 'Business / Commerce', topics: ['E-commerce', 'Marketing Digital', 'Investissement', 'Startups', 'Freelance'], trending: [{ name: 'E-commerce', reason: 'En pleine croissance en Afrique', details: 'Vendre en ligne depuis la CI' }, { name: 'Mobile Money', reason: 'Paiements facilités', details: 'Orange Money, MTN Money' }] },
      { pattern: /musique|music|rap|chant|son|beat|artiste|album|concert/i, type: 'Musique', topics: ['Rap Ivoire', 'Afrobeat', 'Coupé Décalé', 'RnB', 'Concerts'], trending: [{ name: 'Rap Ivoire', reason: 'Scène émergente', details: 'Nouveaux talents ivoiriens' }, { name: 'Afrobeat', reason: 'Succès mondial', details: 'Artistes africains à l\'international' }] },
      { pattern: /ecole|school|classe|cours|étude|formation|bac|examen|université/i, type: 'Éducation / Études', topics: ['BAC 2026', 'Orientation', 'Révisions', 'Méthodologie', 'Bourses'], trending: [{ name: 'BAC 2026', reason: 'Examens à venir', details: 'Préparations et révisions' }, { name: 'Orientation', reason: 'Choix d\'études', details: 'Filières et débouchés' }] },
      { pattern: /tech|code|dev|programmation|informatique|ia|intelligence artificielle/i, type: 'Technologie / Tech', topics: ['IA', 'Développement Web', 'Python', 'JavaScript', 'Cybersécurité'], trending: [{ name: 'IA Générative', reason: 'Révolution', details: 'ChatGPT, Groq, Gemini' }, { name: 'Développement Web', reason: 'Demande croissante', details: 'React, Node.js, Next.js' }] },
    ];

    for (const p of patterns) {
      if (p.pattern.test(combined)) {
        return {
          mainTopic: p.type.split(' / ')[0], communityType: p.type, popularTopics: p.topics,
          trendingItems: p.trending, recentNews: ['Tendances actuelles', 'Nouveautés', 'Événements récents'],
          commonQuestions: ['Comment débuter ?', 'Quel est le meilleur ?', 'Des conseils ?'],
          keywords: p.topics.slice(0, 5),
          suggestedContent: { games: p.type.includes('Gaming') ? p.topics : [], topics: p.topics, challenges: ['Défi du jour', 'Quiz'], debates: ['Débat du jour'], tips: ['Astuce du jour'] },
        };
      }
    }

    const words = combined.split(/\s+/).filter(w => w.length > 4);
    return {
      mainTopic: groupName, communityType: 'Général', popularTopics: [...new Set(words)].slice(0, 8),
      trendingItems: [], recentNews: [], commonQuestions: ['Quoi de neuf ?', 'Des suggestions ?'],
      keywords: [...new Set(words)], suggestedContent: { games: [], topics: [...new Set(words)].slice(0, 5), challenges: ['Question du jour'], debates: ['Sondage'], tips: ['Astuce du jour'] },
    };
  }

  async generateContentSuggestions(analysis, groupName) {
    const suggestions = { posts: [], quizzes: [], debates: [], challenges: [], tips: [] };

    if (analysis.trendingItems?.length > 0) {
      analysis.trendingItems.slice(0, 5).forEach((item, i) => {
        const type = analysis.communityType?.toLowerCase().includes('gaming') ? 'jeu' :
                     analysis.communityType?.toLowerCase().includes('anime') ? 'anime' :
                     analysis.communityType?.toLowerCase().includes('musique') ? 'son' : 'sujet';
        const emoji = type === 'jeu' ? '🎮' : type === 'anime' ? '🎌' : type === 'son' ? '🎵' : '💡';
        suggestions.posts.push({
          type: `${type}_du_jour_${i}`, title: `${emoji} ${item.name}`,
          searchQuery: item.name,
          content: `Aujourd'hui on parle de *${item.name}* !\n\n${item.reason}\n\n${item.details}\n\nQui connaît ? Vos avis ? 🎯\n\n@all`,
        });
      });
    }

    if (analysis.popularTopics?.length > 0) {
      analysis.popularTopics.slice(0, 3).forEach((topic, i) => {
        suggestions.posts.push({
          type: `topic_${i}`, title: `💬 ${topic}`, searchQuery: topic,
          content: `Parlons de *${topic}* !\n\nVos expériences, astuces, ou questions ?\n\n@all partagez ! 💬`,
        });
      });
    }

    if (analysis.trendingItems?.length > 0) {
      analysis.trendingItems.forEach(item => {
        suggestions.quizzes.push({ question: `Savez-vous qui a créé ${item.name} ?`, searchQuery: `${item.name} creator` });
      });
    }

    if (analysis.suggestedContent?.debates?.length > 0) suggestions.debates = analysis.suggestedContent.debates;
    if (analysis.suggestedContent?.challenges?.length > 0) suggestions.challenges = analysis.suggestedContent.challenges;
    if (analysis.suggestedContent?.tips?.length > 0) suggestions.tips = analysis.suggestedContent.tips;

    return suggestions;
  }

  async callAI(prompt) {
    const apiKey = this.config.GROQ_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY non configurée');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'Tu es un expert en analyse de communautés. Réponds UNIQUEMENT en JSON valide. Pas de texte avant ou après le JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7, max_tokens: 1500,
      }),
    });

    if (!res.ok) throw new Error(`Groq API: ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  clearCache() { this.cache.clear(); log.info('Cache de recherche vidé'); }
  getCacheSize() { return this.cache.size; }
}

export { GroupResearcher };
