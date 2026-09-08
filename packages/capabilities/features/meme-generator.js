import { createLogger } from '../../infrastructure/logger.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
const log = createLogger('MEME');

let enabled = false, listener = null;
const templateDir = './data/meme_templates';

export async function enableMemeGenerator(sock) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(templateDir, { recursive: true }).catch(() => {});
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      const lower = text.toLowerCase();
      if (!lower.startsWith('.meme ')) continue;
      const parts = text.slice(6).split('|').map(s => s.trim());
      if (parts.length < 2) return sock.sendMessage(jid, { text: '❌ Usage: .meme <texte_haut> | <texte_bas>' });
      const [top, bottom] = parts;
      try {
        const templates = await fs.readdir(templateDir).catch(() => []);
        let templatePath = path.join(templateDir, 'template.jpg');
        if (templates.length) templatePath = path.join(templateDir, templates[Math.floor(Math.random() * templates.length)]);
        const exists = await fs.access(templatePath).then(() => true).catch(() => false);
        if (!exists) {
          const svg = `<svg width="500" height="500"><rect width="500" height="500" fill="#1a1a2e"/><text x="250" y="100" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="Impact">${top}</text><text x="250" y="400" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="Impact">${bottom}</text></svg>`;
          const buf = await sharp(Buffer.from(svg)).png().toBuffer();
          return sock.sendMessage(jid, { image: buf, caption: '😂 *Meme généré*' });
        }
        const img = sharp(templatePath);
        const meta = await img.metadata();
        const w = meta.width || 500, h = meta.height || 500;
        const svgOverlay = `<svg width="${w}" height="${h}"><text x="${w / 2}" y="60" text-anchor="middle" fill="white" font-size="40" font-weight="bold" font-family="Impact" stroke="black" stroke-width="2">${top}</text><text x="${w / 2}" y="${h - 40}" text-anchor="middle" fill="white" font-size="40" font-weight="bold" font-family="Impact" stroke="black" stroke-width="2">${bottom}</text></svg>`;
        const buf = await img.composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }]).jpeg({ quality: 85 }).toBuffer();
        await sock.sendMessage(jid, { image: buf, caption: '😂 *Meme généré*' });
      } catch (e) { log.warn(`Meme error: ${e.message}`); sock.sendMessage(jid, { text: '❌ Erreur génération meme.' }); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Générateur de memes activé');
}

export function disableMemeGenerator(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isMemeGeneratorOn() { return enabled; }
