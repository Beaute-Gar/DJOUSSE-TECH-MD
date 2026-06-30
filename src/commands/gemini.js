import { geminiQuery, clearMemory } from '../core/agent.js';
import { truncate } from '../lib/utils.js';
import axios from 'axios';

export const name = 'gemini';
export const aliases = ['ai', 'ask', 'ia', 'gpt'];
export const category = 'IA';
export const desc = 'Pose une question à l\'IA Gemini.';
export const usage = '.gemini <question> | .gemini clear';
export const cooldown = 3;
export const premium = false;

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const VISION_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

export async function handler(m, ctx) {
  const { body, args } = ctx;

  if (!GEMINI_KEY) {
    return m.reply('⚠️ *GEMINI_API KEY* non configurée.');
  }

  if (args[0]?.toLowerCase() === 'clear') {
    clearMemory(ctx.senderJid);
    return m.reply('🧹 Mémoire effacée !');
  }

  const hasImage = m.type === 'imageMessage' || (m.quoted?.type === 'imageMessage');

  if (hasImage) {
    return _handleVision(m, body || 'Décris cette image.');
  }

  if (!body.trim()) {
    return m.reply('🤖 *Gemini AI*\n\nUsage: .gemini <question>\n\nEx: .gemini Quelle est la capitale du Cameroun ?');
  }

  try {
    await m.react('🤔');
    const reply = await geminiQuery(`Tu es DTE Bot. Réponds en français, concis (max 800 car.).\nQuestion: ${body}`);
    await m.react('✅');
    await m.reply(`🤖 *DTE AI*\n\n${reply}`);
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Erreur: ${err.message}`);
  }
}

async function _handleVision(m, prompt) {
  try {
    await m.react('👁️');
    const src = m.type === 'imageMessage' ? m : m.quoted;
    const buf = await src.download();
    if (!buf || buf.length === 0) return m.reply('❌ Impossible de télécharger l\'image.');
    const base64 = buf.toString('base64');
    const res = await axios.post(VISION_URL, {
      contents: [{ parts: [{ text: `${prompt}\nRéponds en français.` }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 });
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Aucune réponse.';
    await m.react('✅');
    await m.reply(`👁️ *DTE Vision*\n\n${text}`);
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Analyse image: ${err.message}`);
  }
}
