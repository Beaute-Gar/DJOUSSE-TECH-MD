import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('VV');

class ViewOnceSaver {
  constructor() {
    this.saved = new Map();
    this.saveDir = './cache/view_once';
    this.sock = null;
    this.ownerJid = null;
    this.ready = false;
  }

  async init(sock, ownerJid) {
    this.sock = sock;
    this.ownerJid = ownerJid ? String(ownerJid).replace(/:[0-9]+@/, '@').trim() : null;
    try {
      await fs.mkdir(this.saveDir, { recursive: true });
      await fs.mkdir(path.join(this.saveDir, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.saveDir, 'videos'), { recursive: true });
      await fs.mkdir(path.join(this.saveDir, 'audio'), { recursive: true });
      this.ready = true;
      log.info('ViewOnceSaver prêt');
    } catch (e) {
      log.warn(`init dossiers: ${e.message}`);
      this.ready = true;
    }
  }

  isOwner(jid) {
    if (!jid || !this.ownerJid) return false;
    const clean = String(jid).replace(/:[0-9]+@/, '@').trim();
    return clean === this.ownerJid || clean.includes(this.ownerJid) || this.ownerJid.includes(clean);
  }

  async autoSave(rawMsg) {
    if (!this.ready || !this.sock) return;
    try {
      const msg = rawMsg.message;
      if (!msg) return;

      let mediaType = null;
      if (msg.imageMessage?.viewOnce) mediaType = 'image';
      else if (msg.videoMessage?.viewOnce) mediaType = 'video';
      else if (msg.audioMessage?.viewOnce) mediaType = 'audio';
      if (!mediaType) return;

      const msgId = rawMsg.key?.id;
      const sender = rawMsg.key?.participant || rawMsg.key?.remoteJid || '';
      const chatId = rawMsg.key?.remoteJid || '';
      if (!msgId || !sender) return;

      const senderName = sender.split('@')[0];
      log.info(`👁️ Vue unique ${mediaType} de ${senderName}`);

      const buffer = await this.sock.downloadMediaMessage(rawMsg);
      if (!buffer || !buffer.length) return;

      const ts = Date.now();
      const ext = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'ogg' : 'jpg';
      const safeName = senderName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${ts}_${safeName}.${ext}`;
      const subDir = mediaType === 'video' ? 'videos' : mediaType === 'audio' ? 'audio' : 'images';
      const filepath = path.join(this.saveDir, subDir, filename);

      await fs.writeFile(filepath, buffer).catch(() => {});

      const key = `${chatId}||${msgId}`;
      this.saved.set(key, { buffer, type: mediaType, sender, senderName, chatId, ts, filepath, msgId });

      setTimeout(() => { this.saved.delete(key); }, 1800000);
      log.info(`   💾 ${filename}`);

      if (this.isOwner(sender)) return;

      try {
        const emoji = mediaType === 'image' ? '📸' : mediaType === 'video' ? '🎥' : '🎵';
        const shortId = msgId.slice(0, 8);
        const groupName = chatId.endsWith('@g.us')
          ? await this.sock.groupMetadata(chatId).then(m => m.subject).catch(() => 'Groupe')
          : 'Privé';
        await this.sock.sendMessage(this.ownerJid, {
          text: `${emoji} *Vue unique sauvegardée*\n👤 ${senderName}\n📍 ${groupName}\n🆔 ${shortId}\n💡 *.vv ${shortId}*`,
        });
      } catch {}
    } catch (e) {
      log.warn(`autoSave: ${e.message}`);
    }
  }

  find(query) {
    if (!query || !this.saved.size) return null;
    const q = String(query).trim();
    for (const [, media] of this.saved) {
      if (media.msgId?.includes(q) || media.chatId?.includes(q)) return media;
      if (media.msgId?.startsWith(q)) return media;
    }
    return null;
  }

  async handleCommand(sock, m) {
    try {
      const userId = m.key?.participant || m.key?.remoteJid;
      if (!this.isOwner(userId)) {
        await sock.sendMessage(m.key.remoteJid, { text: '🚫 *ACCÈS RÉSERVÉ*\nSeul le propriétaire du bot peut utiliser .vv' });
        return;
      }

      let quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId || '';
      if (!quotedId) {
        const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        quotedId = text.split(/\s+/)[1] || '';
      }
      if (!quotedId) {
        await sock.sendMessage(m.key.remoteJid, { text: '👁️ *.vv <id>*\nRéponds à un message vue unique ou utilise l\'ID reçu en notification.' });
        return;
      }

      const media = this.find(quotedId);
      if (!media?.buffer) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ *Média non disponible*\n• Expiré (>30 min)\n• Déjà ouvert\n• ID incorrect' });
        return;
      }

      const caption = `👁️ *Vue unique*\n📸 ${media.type}\n👤 ${media.senderName}\n📍 ${media.chatId?.endsWith('@g.us') ? 'Groupe' : 'Privé'}\n🕐 ${new Date(media.ts).toLocaleString('fr-FR')}`;
      const opts = { caption, viewOnce: false };
      if (media.type === 'image') opts.image = media.buffer;
      else if (media.type === 'video') opts.video = media.buffer;
      else if (media.type === 'audio') { opts.audio = media.buffer; opts.ptt = true; }
      else return;

      await sock.sendMessage(m.key.remoteJid, opts);
    } catch (e) {
      log.warn(`handleCommand: ${e.message}`);
    }
  }

  async cleanup() {
    const now = Date.now();
    const maxAge = 1800000;
    for (const [key, media] of this.saved) {
      if (now - media.ts > maxAge) this.saved.delete(key);
    }
    try {
      const dirs = ['images', 'videos', 'audio'];
      for (const dir of dirs) {
        const dirPath = path.join(this.saveDir, dir);
        const files = await fs.readdir(dirPath).catch(() => []);
        for (const file of files) {
          try {
            const fp = path.join(dirPath, file);
            const stat = await fs.stat(fp).catch(() => null);
            if (stat && now - stat.mtimeMs > maxAge) await fs.unlink(fp).catch(() => {});
          } catch {}
        }
      }
    } catch {}
  }
}

let instance = null;

export function getViewOnceSaver() {
  if (!instance) instance = new ViewOnceSaver();
  return instance;
}
