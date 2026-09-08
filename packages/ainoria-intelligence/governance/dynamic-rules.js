import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('RULES');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

async function groqGenerate(system, user) {
  const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.7, max_completion_tokens: 2048,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

function analyzeMessages(messages) {
  if (!messages?.length) return null;
  const analysis = { total: messages.length, topics: {}, spam: 0, insults: 0, scams: 0, questions: 0, links: 0, media: 0, hours: [] };
  for (const m of messages) {
    const text = (m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '').toLowerCase();
    if (!text) { analysis.media++; continue; }
    if (/https?:\/\//.test(text)) analysis.links++;
    if (/\?/.test(text)) analysis.questions++;
    if (/gagnez|gratuit|argent facile|cliquez ici|investissement|bit\.ly|tinyurl/.test(text)) analysis.scams++;
    if (/connard|salaud|idiot|débile|ta gueule|ferme ta|nul\b/.test(text)) analysis.insults++;
    if (/(?:http|www|gagnez|promo|offre|partagez.*group)/i.test(text) && (/\d{4,}/.test(text) || /💰|💸/.test(text))) analysis.spam++;
    const topics = { jeu: /jeu|game|play|niveau|score|tournoi/i, famille: /famille|maman|papa|frère|soeur/i, travail: /travail|bureau|job|projet/i, etude: /cours|devoir|examen|prof/i, tech: /code|app|site|software|programme/i, sport: /match|foot|basket|equipe/i, musique: /musique|rap|son|chant|album/i, actualite: /info|news|actualite|breaking/i };
    for (const [t, p] of Object.entries(topics)) { if (p.test(text)) analysis.topics[t] = (analysis.topics[t] || 0) + 1; }
    if (m.timestamp) analysis.hours.push(new Date(m.timestamp * 1000).getHours());
  }
  analysis.topics = Object.fromEntries(Object.entries(analysis.topics).sort((a, b) => b[1] - a[1]).slice(0, 5));
  const hourCount = {};
  analysis.hours.forEach(h => { hourCount[h] = (hourCount[h] || 0) + 1; });
  analysis.peakHours = Object.entries(hourCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => `${h}h`);
  return analysis;
}

export async function searchWebContext(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      return [d.Abstract, (d.RelatedTopics || []).slice(0, 3).map(t => t.Text || '').join(' ')].filter(Boolean).join('\n').slice(0, 600) || null;
    }
  } catch {}
  try {
    const url2 = `https://api.mojeek.com/search?q=${encodeURIComponent(query)}&fmt=json&t=3`;
    const res2 = await fetch(url2, { headers: { 'User-Agent': 'DjousseTechBot/3.0' }, signal: AbortSignal.timeout(5000) });
    if (res2.ok) {
      const d = await res2.json();
      return (d.response?.results || []).slice(0, 3).map(i => i.desc || i.title).filter(Boolean).join('\n').slice(0, 600) || null;
    }
  } catch {}
  return null;
}

export async function generateDynamicRules(groupName, groupDesc, members = 0, admins = 0, messages = []) {
  log.info(`Génération règles dynamiques pour: ${groupName}`);

  const msgAnalysis = analyzeMessages(messages);

  let webContext = null;
  try { webContext = await searchWebContext(`${groupName} groupe communauté reglement`); } catch {}

  const systemPrompt = `Tu es expert en modération de communautés WhatsApp en Afrique francophone.

Génère un règlement COMPLET, PERSONNALISÉ et STRUCTURÉ pour ce groupe spécifique.

Format EXIGÉ — respecte-le strictement, sans dévier :

TYPE: [gaming|commerce|education|famille|tech|sport|musique|religion|general]
---
📌 RÈGLES FONDAMENTALES
1. [règle avec exemple concret] — Sanction : [sanction]
2. [règle avec exemple concret] — Sanction : [sanction]
...

📢 CONTENU ET COMMUNICATION
X. [règle avec exemple concret] — Sanction : [sanction]
...

⚠️ SYSTÈME DE SANCTIONS PROGRESSIVES
• 1ère infraction : [action précise]
• 2e infraction : [action précise]
• 3e infraction : [action précise]
• Récidive : [action précise]

👑 MODÉRATION
• [règle sur le rôle des admins]
• [comment signaler un problème]

🌟 CONSEILS POUR BIEN PARTICIPER
• [conseil pratique 1]
• [conseil pratique 2]
• [conseil pratique 3]

RÈGLES :
- Sois SPÉCIFIQUE au groupe (si c'est un groupe gaming, parle de jeux, tournois, etc.)
- Donne des EXEMPLES CONCRETS dans chaque règle
- Les sanctions doivent être PROGRESSIVES et CLAIRES
- En français AFRICAIN naturels`;

  const problems = [];
  if (msgAnalysis) {
    if (msgAnalysis.spam > 0) problems.push(`Spam : ${msgAnalysis.spam} messages détectés`);
    if (msgAnalysis.insults > 0) problems.push(`Insultes : ${msgAnalysis.insults} messages détectés`);
    if (msgAnalysis.scams > 0) problems.push(`Arnaques : ${msgAnalysis.scams} tentatives détectées`);
  }

  const userPrompt = `Informations du groupe à règlementer :

📛 Nom : "${groupName}"
📝 Description : ${groupDesc || 'non fournie'}
👥 Membres : ${members} (dont ${admins} admins)
${msgAnalysis ? `💬 Messages analysés : ${msgAnalysis.total}
📊 Sujets dominants : ${Object.entries(msgAnalysis.topics).map(([t, c]) => `${t}(${c})`).join(', ')}
${problems.length ? `🚨 Problèmes détectés :\n${problems.join('\n')}` : '✅ Aucun problème majeur détecté'}` : '💬 Analyse de messages : non disponible (groupe fraîchement activé)'}
${webContext ? `\n🌐 Contexte web :\n${webContext.slice(0, 500)}` : ''}

Génère un règlement sur mesure pour ce groupe. Pas de règles génériques.`;

  let result = await groqGenerate(systemPrompt, userPrompt);
  if (!result || result.includes("pas grand chose")) return null;

  let type = 'general';
  const typeMatch = result.match(/TYPE:\s*(\w+)/);
  if (typeMatch) type = typeMatch[1].toLowerCase();
  if (!['gaming','commerce','education','famille','tech','sport','musique','religion','general'].includes(type)) type = 'general';

  const rulesPart = result.replace(/TYPE:\s*\w+\s*---\s*/i, '').trim();

  return { type, rules: rulesPart, webContext };
}
