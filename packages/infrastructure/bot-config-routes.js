import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');
import { createLogger } from './logger.js';
import { genererConfigDepuisPrompt, construirePromptSystemeDepuisConfig } from './bot-config-generator.js';
import { getDB } from './database/database.js';

const log = createLogger('BOT_CONFIG_API');
const router = express.Router();

let _sharp = null;
async function getSharp() {
  if (_sharp !== null) return _sharp;
  try { _sharp = (await import('sharp')).default; } catch { _sharp = false; }
  return _sharp;
}

function parseMultipart(req, maxSize = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const boundary = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundary) return reject(new Error('No boundary'));
    const delim = `--${boundary[1] || boundary[2]}`;
    const chunks = [];
    const fields = {};
    req.on('data', c => { chunks.push(c); if (Buffer.concat(chunks).length > maxSize) { req.destroy(); reject(new Error('Fichier trop volumineux')); } });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const raw = buf.toString('binary');
      const parts = raw.split(delim).filter(s => s.includes('\r\n\r\n') && !s.includes('--\r\n'));
      let file = null;
      for (const part of parts) {
        const headers = part.slice(0, part.indexOf('\r\n\r\n'));
        const body = part.slice(part.indexOf('\r\n\r\n') + 4);
        const bodyEnd = body.lastIndexOf('\r\n');
        const data = bodyEnd > 0 ? body.slice(0, bodyEnd) : body;
        const nameMatch = headers.match(/name="([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : '';
        const filenameMatch = headers.match(/filename="([^"]*)"/);
        const hasFile = !!filenameMatch && filenameMatch[1];
        if (hasFile) {
          const mimeMatch = headers.match(/Content-Type:\s*(\S+)/i);
          const binData = Buffer.from(data, 'binary');
          const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const types = ['image/jpeg', 'image/png', 'image/webp'];
          if (!types.includes(mime)) return reject(new Error('Format non supporté (jpg, png, webp).'));
          file = { fieldname: name, buffer: binData, mimetype: mime, originalname: filenameMatch[1] };
        } else {
          fields[name] = Buffer.from(data, 'binary').toString('utf8').trim();
        }
      }
      req.fields = fields;
      if (file) return resolve(file);
      reject(new Error('Aucun fichier trouvé'));
    });
    req.on('error', reject);
  });
}

async function convertirEnBase64(buffer, mimetype) {
  let buf = buffer;
  let mime = mimetype;
  const s = await getSharp();
  if (s) {
    try {
      buf = await s(buffer).resize(512, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
      mime = 'image/jpeg';
    } catch (e) { log.warn(`sharp resize: ${e.message}`); }
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function db() { return getDB(); }

router.post('/api/bot-config/avatar', async (req, res) => {
  try {
    const file = await parseMultipart(req);
    const session_id = req.fields?.session_id || '';
    if (!file) return res.status(400).json({ erreur: 'Aucune image reçue.' });
    if (!session_id) return res.status(400).json({ erreur: 'session_id manquant.' });

    const avatarBase64 = await convertirEnBase64(file.buffer, file.mimetype);
    const maintenant = Date.now();
    const existant = await db().get('SELECT session_id FROM bot_configs WHERE session_id = ?', session_id);

    if (existant) {
      await db().run('UPDATE bot_configs SET avatar_base64 = ?, maj_le = ? WHERE session_id = ?', avatarBase64, maintenant, session_id);
    } else {
      await db().run('INSERT INTO bot_configs (session_id, avatar_base64, config_json, prompt_systeme, cree_le, maj_le) VALUES (?, ?, \'{}\', \'\', ?, ?)', session_id, avatarBase64, maintenant, maintenant);
    }

    res.json({ avatar_base64: avatarBase64 });
  } catch (error) {
    log.error(`/api/bot-config/avatar: ${error.message}`);
    res.status(500).json({ erreur: 'Erreur lors de l\'upload.' });
  }
});

router.post('/api/bot-config/generate', async (req, res) => {
  try {
    const { prompt, session_id } = req.body;
    if (!prompt || prompt.trim().length < 5) return res.status(400).json({ erreur: 'Décris un peu plus ton bot.' });
    if (!session_id) return res.status(400).json({ erreur: 'session_id manquant.' });

    const generated = await genererConfigDepuisPrompt(prompt.trim());
    const existant = await db().get('SELECT avatar_base64 FROM bot_configs WHERE session_id = ?', session_id);
    if (existant?.avatar_base64) generated.identite.avatar_base64 = existant.avatar_base64;

    const promptSysteme = construirePromptSystemeDepuisConfig(generated);
    const maintenant = Date.now();
    const json = JSON.stringify(generated);

    if (existant) {
      await db().run('UPDATE bot_configs SET prompt_original = ?, config_json = ?, prompt_systeme = ?, statut = \'brouillon\', maj_le = ? WHERE session_id = ?', prompt.trim(), json, promptSysteme, maintenant, session_id);
    } else {
      await db().run('INSERT INTO bot_configs (session_id, prompt_original, config_json, prompt_systeme, statut, cree_le, maj_le) VALUES (?, ?, ?, ?, \'brouillon\', ?, ?)', session_id, prompt.trim(), json, promptSysteme, maintenant, maintenant);
    }

    res.json({ config: generated });
  } catch (error) {
    log.error(`/api/bot-config/generate: ${error.message}`);
    res.status(500).json({ erreur: 'Erreur lors de la génération.' });
  }
});

router.post('/api/bot-config/confirm', async (req, res) => {
  try {
    const { session_id, config: cfg } = req.body;
    if (!session_id || !cfg) return res.status(400).json({ erreur: 'Données manquantes.' });

    const promptSysteme = construirePromptSystemeDepuisConfig(cfg);
    const maintenant = Date.now();

    await db().run('UPDATE bot_configs SET config_json = ?, prompt_systeme = ?, statut = \'confirme\', maj_le = ? WHERE session_id = ?', JSON.stringify(cfg), promptSysteme, maintenant, session_id);
    res.json({ ok: true });
  } catch (error) {
    log.error(`/api/bot-config/confirm: ${error.message}`);
    res.status(500).json({ erreur: 'Erreur lors de la sauvegarde.' });
  }
});

router.get('/api/bot-config/by-numero/:numero', async (req, res) => {
  const ligne = await db().get('SELECT config_json, avatar_base64 FROM bot_configs WHERE numero_telephone = ? AND statut = \'lie\' ORDER BY maj_le DESC LIMIT 1', req.params.numero);
  if (!ligne) return res.status(404).json({ erreur: 'Aucune config trouvée.' });
  res.json({ config: JSON.parse(ligne.config_json), avatar_base64: ligne.avatar_base64 });
});

router.put('/api/bot-config/by-numero/:numero', async (req, res) => {
  const { config: cfg } = req.body;
  const promptSysteme = construirePromptSystemeDepuisConfig(cfg);
  const maintenant = Date.now();
  await db().run('UPDATE bot_configs SET config_json = ?, prompt_systeme = ?, maj_le = ? WHERE numero_telephone = ? AND statut = \'lie\'', JSON.stringify(cfg), promptSysteme, maintenant, req.params.numero);
  res.json({ ok: true });
});

export async function lierConfigAuNumero(sessionId, numeroTelephone) {
  const maintenant = Date.now();
  await db().run('UPDATE bot_configs SET numero_telephone = ?, statut = \'lie\', maj_le = ? WHERE session_id = ?', numeroTelephone, maintenant, sessionId);
  return getConfigParNumero(numeroTelephone);
}

export async function appliquerAvatarSurWhatsApp(sock, jid, avatarBase64) {
  if (!avatarBase64) return;
  try {
    const pur = avatarBase64.split(',')[1];
    const buffer = Buffer.from(pur, 'base64');
    await sock.updateProfilePicture(jid, buffer);
  } catch (error) {
    log.error(`Impossible d'appliquer l'avatar: ${error.message}`);
  }
}

export async function getConfigParNumero(numeroTelephone) {
  const ligne = await db().get('SELECT config_json, prompt_systeme, avatar_base64 FROM bot_configs WHERE numero_telephone = ? AND statut = \'lie\' ORDER BY maj_le DESC LIMIT 1', numeroTelephone);
  if (!ligne) return null;
  return { config: JSON.parse(ligne.config_json), promptSysteme: ligne.prompt_systeme, avatarBase64: ligne.avatar_base64 };
}

export default router;
