import { fetchJson } from '../lib/utils.js';

export const name = 'gemini';
export const aliases = ['ia', 'ai', 'ask', 'question'];
export const description = 'Pose une question à l\'IA Gemini';
export const category = 'ia';
export const level = 'user';

export async function handler(sock, m, { text }) {
  if (!text) {
    return m.reply(`❌ *Utilisation:* .gemini <votre question>\n\nExemple: .gemini Quelle est la capitale du Cameroun?`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return m.reply('⚠️ *Clé API Gemini manquante!*\n\nAjoutez `GEMINI_API_KEY=votre_clé` dans le fichier `.env`');
  }

  await m.react('🤖');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const data = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { contents: [{ parts: [{ text }] }] },
    });

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.error?.message || 'Pas de réponse';
    m.reply(`🤖 *Gemini IA*\n\n${answer.slice(0, 4000)}`);
  } catch (e) {
    m.reply(`❌ *Erreur IA:* ${e.message}`);
  }
}
