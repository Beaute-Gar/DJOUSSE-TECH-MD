const GROQ_KEY = process.env.GROQ_API_KEY || '';

const memoryCache = new Map();

async function tryDb() {
  try {
    const db = await import('../../infrastructure/database/database.js');
    return db.default || db;
  } catch { return null; }
}

export async function getGroupMemory(jid) {
  const cached = memoryCache.get(jid);
  if (cached && (Date.now() - cached.ts) < 600000) return cached.data;

  const db = await tryDb();
  if (!db) return null;

  try {
    const row = await db.rawGet('cognitive_timeline', { jid });
    if (row) {
      memoryCache.set(jid, { data: JSON.parse(row.data || '{}'), ts: Date.now() });
      return JSON.parse(row.data || '{}');
    }
  } catch {}

  try {
    const row = await db.rawGet('cognitive_context_store', { key: `social_${jid}` });
    if (row) {
      memoryCache.set(jid, { data: JSON.parse(row.value || '{}'), ts: Date.now() });
      return JSON.parse(row.value || '{}');
    }
  } catch {}

  return null;
}

export async function updateGroupMemory(jid, summary) {
  const db = await tryDb();
  if (!db) return;

  const existing = await getGroupMemory(jid) || {};
  const updated = {
    ...existing,
    ...summary,
    lastUpdate: Date.now(),
    updateCount: (existing.updateCount || 0) + 1,
  };

  memoryCache.set(jid, { data: updated, ts: Date.now() });

  try {
    await db.rawRun(
      `INSERT INTO cognitive_context_store (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      [`social_${jid}`, JSON.stringify(updated), JSON.stringify(updated)]
    );
  } catch {}
}

export async function summarizeConversation(history, jid) {
  if (!GROQ_KEY || !history || history.length < 4) return null;

  const recentText = history.slice(-8).map(h => `${h.sender}: ${h.message}`).join('\n');
  const prompt = `Analyse cette conversation WhatsApp et résume-la en JSON :

Conversation :
${recentText}

Réponds UNIQUEMENT par ce JSON :
{
  "topics": ["sujet1", "sujet2"],
  "mood": "ambiance générale",
  "keyPoints": ["point1", "point2"],
  "unansweredQuestions": ["question1"] ou [],
  "participants": ["nom1", "nom2"]
}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, max_tokens: 250,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const summary = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    if (summary.topics) {
      const existing = await getGroupMemory(jid) || {};
      const allTopics = [...new Set([...(existing.topics || []), ...summary.topics])].slice(-20);
      await updateGroupMemory(jid, {
        topics: allTopics,
        lastMood: summary.mood,
        lastSummary: new Date().toISOString(),
        participantCount: summary.participants?.length || 0,
      });
    }
    return summary;
  } catch { return null; }
}

export async function getGroupCulture(jid, groupName, groupType) {
  const memory = await getGroupMemory(jid);
  if (!memory || !memory.topics || memory.topics.length === 0) return null;

  return {
    topics: memory.topics.slice(-10),
    mood: memory.lastMood || 'neutre',
    conversationsCount: memory.updateCount || 0,
    lastActive: memory.lastSummary || 'inconnu',
  };
}

export default { getGroupMemory, updateGroupMemory, summarizeConversation, getGroupCulture };
