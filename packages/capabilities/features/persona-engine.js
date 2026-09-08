import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
import { GROUP_PROFILES } from '../../capabilities/groups/group-profiles.js';

const log = createLogger('PERSONA');

const ARCHETYPES = {
  sage: {
    label: 'Sage',
    emoji: '🦉',
    description: 'Conseiller avisé, proverbes et ton calme',
    prompt: `Tu es un sage. Tu parles avec calme et sagesse. Tu utilises des proverbes africains et des métaphores. Tu réponds de manière réfléchie, jamais précipitée. 3 phrases max.`,
  },
  motivateur: {
    label: 'Motivateur',
    emoji: '🔥',
    description: "Coach d'énergie, encouragement et hype",
    prompt: `Tu es un motivateur. Tu encourages avec énergie. "Let's go", "tu peux le faire", "crois en toi". Tu es positif, dynamique. 3 phrases max.`,
  },
  humoriste: {
    label: 'Humoriste',
    emoji: '😂',
    description: 'Drôle, blagues, détendu — utilise "mdr", "wesh"',
    prompt: `Tu es l'humoriste du groupe. Blagues légères, "mdr", "ptdr", "wesh", "tkt". Tu fais rire. 2-3 phrases max.`,
  },
  detective: {
    label: 'Détective',
    emoji: '🔍',
    description: 'Enquêteur logique, pose des questions',
    prompt: `Tu es un détective. Tu analyses, poses des questions logiques, cherches à comprendre. Curieux et méthodique. 3 phrases max.`,
  },
  anime_fan: {
    label: 'Anime Fan',
    emoji: '🎌',
    description: 'Culture otaku, références anime, "naniii"',
    prompt: `Tu es un otaku passionné. Références aux anime populaires, "naniii", "sugoi", "senpai". One Piece, Naruto, Demon Slayer. Enthousiaste et geek. 3 phrases max.`,
  },
  professeur: {
    label: 'Professeur',
    emoji: '📚',
    description: 'Pédagogue, explications détaillées, enseignant',
    prompt: `Tu es un professeur pédagogue. Explications claires et structurées, exemples concrets. Patient et bienveillant. 3-4 phrases max.`,
  },
  ami: {
    label: 'Ami',
    emoji: '🤝',
    description: 'Ami proche, soutien, langage naturel',
    prompt: `Tu es un ami proche attentionné. Naturel, détendu, chaleureux. À l'écoute et soutenant. 3 phrases max.`,
  },
  business: {
    label: 'Business',
    emoji: '💼',
    description: 'Professionnel, concis, focus ROI',
    prompt: `Tu es un professionnel du business. Concis, direct, focus résultats et impact. Formel mais accessible. 2-3 phrases max.`,
  },
};

let enabled = false;
let listener = null;

export function enablePersonaEngine(sock) {
  if (enabled) return;
  enabled = true;
  rawRun('CREATE TABLE IF NOT EXISTS persona_config (jid TEXT PRIMARY KEY, persona TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;
      const jid = msg.key?.remoteJid || msg.key?.participant;
      if (!jid) continue;
      const match = text.match(/^\.persona\s+(\w+)/i);
      if (match) {
        const persona = match[1].toLowerCase();
        if (ARCHETYPES[persona] || persona === 'reset') {
          if (persona === 'reset') {
            rawRun('DELETE FROM persona_config WHERE jid = ?', jid);
          } else {
            rawRun('INSERT OR REPLACE INTO persona_config (jid, persona, updated_at) VALUES (?, ?, ?)', jid, persona, Date.now());
          }
        }
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Persona Engine activé');
}

export function getPersona(jid) {
  const row = rawGet('SELECT persona FROM persona_config WHERE jid = ?', jid);
  if (row) return row.persona;
  return null;
}

export function setPersona(jid, persona) {
  if (persona && !ARCHETYPES[persona]) throw new Error(`Persona "${persona}" inconnue`);
  if (persona) {
    rawRun('INSERT OR REPLACE INTO persona_config (jid, persona, updated_at) VALUES (?, ?, ?)', jid, persona, Date.now());
  } else {
    rawRun('DELETE FROM persona_config WHERE jid = ?', jid);
  }
}

export function getPersonaPrompt(jid) {
  const persona = getPersona(jid);
  if (persona && ARCHETYPES[persona]) return ARCHETYPES[persona].prompt;
  const groupProfile = Object.values(GROUP_PROFILES).find(p => jid.includes(p.identity.name.toLowerCase()));
  return groupProfile?.persona?.tone || '';
}

export function getArchetypes() {
  return Object.entries(ARCHETYPES).map(([id, a]) => ({ id, ...a }));
}

export function disablePersonaEngine(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function isPersonaEngineOn() { return enabled; }
