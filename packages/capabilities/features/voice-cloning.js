import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet } from '../../infrastructure/database/database.js';
import { genererVocal } from '../../ainoria-intelligence/core/voice-persona.js';

const log = createLogger('VCLONE');

export async function creerCloneVocal(ownerJid, echantillonAudio, consentementConfirme) {
  if (!consentementConfirme) throw new Error('Consentement requis pour le clonage vocal');
  rawRun(`CREATE TABLE IF NOT EXISTS voix_clonees (
    owner_jid TEXT PRIMARY KEY,
    voice_id TEXT NOT NULL,
    echantillon_hash TEXT,
    cree_le INTEGER NOT NULL,
    actif INTEGER NOT NULL DEFAULT 1
  )`);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY non configurée');
  const form = new FormData();
  form.append('name', `clone_${ownerJid.split('@')[0]}_${Date.now()}`);
  form.append('files', new Blob([echantillonAudio], { type: 'audio/ogg' }), 'sample.ogg');
  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);
  const data = await res.json();
  if (!data.voice_id) throw new Error('Aucun voice_id reçu');
  rawRun('INSERT OR REPLACE INTO voix_clonees (owner_jid, voice_id, echantillon_hash, cree_le, actif) VALUES (?, ?, ?, ?, 1)',
    ownerJid, data.voice_id, String(echantillonAudio.length), Date.now());
  log.info(`Clone vocal créé pour ${ownerJid}`);
  return { success: true, voice_id: data.voice_id };
}

export async function genererVocalAvecCloneOwner(ownerJid, texte, destinataireJid, verifierEstOwner) {
  const isOwner = verifierEstOwner ? verifierEstOwner(ownerJid) : true;
  if (!isOwner) throw new Error('Seul le propriétaire peut utiliser son clone vocal');
  const clone = rawGet('SELECT * FROM voix_clonees WHERE owner_jid = ? AND actif = 1', ownerJid);
  if (!clone) {
    log.warn(`Aucun clone vocal trouvé pour ${ownerJid}, fallback voix standard`);
    return genererVocal(texte, 'homme');
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY non configurée');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${clone.voice_id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: texte,
      model_id: 'eleven_v3',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`TTS clone error HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function desactiverCloneVocal(ownerJid) {
  const clone = rawGet('SELECT * FROM voix_clonees WHERE owner_jid = ? AND actif = 1', ownerJid);
  if (!clone) return { success: false, message: 'Aucun clone vocal actif' };
  rawRun('UPDATE voix_clonees SET actif = 0 WHERE owner_jid = ?', ownerJid);
  log.info(`Clone vocal désactivé pour ${ownerJid}`);
  return { success: true };
}
