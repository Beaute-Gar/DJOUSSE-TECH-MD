'use strict';
/**
 * Fonctionnalités Baileys encore manquantes (SAUF boutons / listes interactives)
 * Chaque commande tente l’API native ; si absente → message d’erreur clair.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { send } = require('./wa-send');

function registerMissing(cmd, deps) {
  const {
    config,
    mediaInfo,
    downloadFrom,
    sharp,
    Sticker,
    StickerTypes,
    buildFrame,
    bullet,
    toUnicode,
    note,
  } = deps;

  /* ═══════════════ CHANNELS / NEWSLETTERS (complet) ═══════════════ */

  cmd('chmute', {
    cat: 9, desc: 'Mute un channel', usage: 'chmute <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHMUTE ID@NEWSLETTER`]);
    try {
      if (typeof c.sock.newsletterMute === 'function') await c.sock.newsletterMute(id);
      else if (c.sock.newsletter?.mute) await c.sock.newsletter.mute(id);
      else return c.error(['API NEWSLETTERMUTE ABSENTE']);
      await c.success(['CHANNEL MUET', id]);
    } catch (e) {
      await c.error(['CHMUTE', e.message]);
    }
  });

  cmd('chunmute', {
    cat: 9, desc: 'Unmute un channel', usage: 'chunmute <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHUNMUTE ID@NEWSLETTER`]);
    try {
      if (typeof c.sock.newsletterUnmute === 'function') await c.sock.newsletterUnmute(id);
      else if (c.sock.newsletter?.unmute) await c.sock.newsletter.unmute(id);
      else return c.error(['API ABSENTE']);
      await c.success(['CHANNEL RÉACTIVÉ', id]);
    } catch (e) {
      await c.error(['CHUNMUTE', e.message]);
    }
  });

  cmd('chinfo', {
    cat: 9, desc: 'Infos d’un channel', usage: 'chinfo <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHINFO ID@NEWSLETTER`]);
    try {
      let meta;
      if (typeof c.sock.newsletterMetadata === 'function') meta = await c.sock.newsletterMetadata('jid', id);
      else if (c.sock.newsletter?.metadata) meta = await c.sock.newsletter.metadata(id);
      else return c.error(['API NEWSLETTERMETADATA ABSENTE']);
      await c.reply(
        buildFrame('CHANNEL', [
          bullet('ID', id),
          bullet('NOM', meta?.name || meta?.subject || '?'),
          bullet('DESC', String(meta?.description || meta?.desc || '—').slice(0, 120)),
          bullet('ABONNÉS', String(meta?.subscribersCount || meta?.subscribers || '?')),
        ])
      );
    } catch (e) {
      await c.error(['CHINFO', e.message]);
    }
  });

  cmd('chreact', {
    cat: 9, desc: 'Réagir à un message channel', usage: 'chreact <id@newsletter> <serverId> <emoji>', owner: true, icon: '📢',
  }, async (c) => {
    const [id, serverId, emoji] = c.args;
    if (!id || !serverId || !emoji) {
      return c.error(['USAGE', `${config.prefix}CHREACT ID@NEWSLETTER SERVERID 💚`]);
    }
    try {
      if (typeof c.sock.newsletterReactMessage === 'function') {
        await c.sock.newsletterReactMessage(id, serverId, emoji);
      } else return c.error(['API ABSENTE']);
      await c.success(['RÉACTION CHANNEL ENVOYÉE']);
    } catch (e) {
      await c.error(['CHREACT', e.message]);
    }
  });

  /* ═══════════════ COMMUNITIES AVANCÉES ═══════════════ */

  cmd('comminfo', {
    cat: 2, desc: 'Métadonnées communauté / groupe', usage: 'comminfo', group: true, icon: '🏘️',
  }, async (c) => {
    try {
      const meta = await c.sock.groupMetadata(c.from);
      await c.reply(
        buildFrame('COMMUNAUTÉ / GROUPE', [
          bullet('ID', meta.id),
          bullet('NOM', meta.subject),
          bullet('OWNER', meta.owner || meta.subjectOwner || '?'),
          bullet('MEMBRES', String(meta.participants?.length || 0)),
          bullet('DESC', String(meta.desc || '—').slice(0, 100)),
          bullet('ANNONCES', meta.announce ? 'OUI' : 'NON'),
          bullet('RESTREINT', meta.restrict ? 'OUI' : 'NON'),
        ])
      );
    } catch (e) {
      await c.error(['COMMINFO', e.message]);
    }
  });

  cmd('comminvite', {
    cat: 2, desc: 'Code / lien d’invitation', usage: 'comminvite', group: true, admin: true, icon: '🔗',
  }, async (c) => {
    try {
      const code = await c.sock.groupInviteCode(c.from);
      await c.success(['LIEN', `https://chat.whatsapp.com/${code}`, `CODE ${code}`]);
    } catch (e) {
      await c.error(['COMMINVITE', e.message]);
    }
  });

  cmd('commrevoke', {
    cat: 2, desc: 'Révoquer le lien d’invitation', usage: 'commrevoke', group: true, admin: true, botAdmin: true, icon: '♻️',
  }, async (c) => {
    try {
      const code = await c.sock.groupRevokeInvite(c.from);
      await c.success(['LIEN RÉVOQUÉ', `NOUVEAU CODE ${code}`]);
    } catch (e) {
      await c.error(['COMMREVOKE', e.message]);
    }
  });

  cmd('commrequests', {
    cat: 2, desc: 'Demandes d’adhésion en attente', usage: 'commrequests', group: true, admin: true, botAdmin: true, icon: '📥',
  }, async (c) => {
    try {
      let list = [];
      if (typeof c.sock.groupRequestParticipantsList === 'function') {
        list = await c.sock.groupRequestParticipantsList(c.from);
      } else return c.error(['API GROUPREQUEST ABSENTE SUR CE BAILEYS']);
      if (!list?.length) return c.success(['AUCUNE DEMANDE EN ATTENTE']);
      const lines = list.slice(0, 20).map((p) => `• ${p.jid || p.id || p}`);
      await c.reply(`📥 *Demandes (${list.length})*\n${lines.join('\n')}\n\n.commapprove @user | .commreject @user`);
    } catch (e) {
      await c.error(['COMMREQUESTS', e.message]);
    }
  });

  cmd('commapprove', {
    cat: 2, desc: 'Approuver une demande d’adhésion', usage: 'commapprove @user|num', group: true, admin: true, botAdmin: true, icon: '✅',
  }, async (c) => {
    const jids = [];
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    jids.push(...mention);
    for (const a of c.args) {
      const n = a.replace(/\D/g, '');
      if (n.length >= 8) jids.push(`${n}@s.whatsapp.net`);
    }
    if (!jids.length) return c.error(['MENTIONNE OU DONNE UN NUMÉRO']);
    try {
      if (typeof c.sock.groupRequestParticipantsUpdate === 'function') {
        await c.sock.groupRequestParticipantsUpdate(c.from, jids, 'approve');
      } else return c.error(['API ABSENTE']);
      await c.success(['DEMANDE(S) APPROUVÉE(S)', String(jids.length)]);
    } catch (e) {
      await c.error(['COMMAPPROVE', e.message]);
    }
  });

  cmd('commreject', {
    cat: 2, desc: 'Refuser une demande d’adhésion', usage: 'commreject @user|num', group: true, admin: true, botAdmin: true, icon: '❌',
  }, async (c) => {
    const jids = [];
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    jids.push(...mention);
    for (const a of c.args) {
      const n = a.replace(/\D/g, '');
      if (n.length >= 8) jids.push(`${n}@s.whatsapp.net`);
    }
    if (!jids.length) return c.error(['MENTIONNE OU DONNE UN NUMÉRO']);
    try {
      if (typeof c.sock.groupRequestParticipantsUpdate === 'function') {
        await c.sock.groupRequestParticipantsUpdate(c.from, jids, 'reject');
      } else return c.error(['API ABSENTE']);
      await c.success(['DEMANDE(S) REFUSÉE(S)', String(jids.length)]);
    } catch (e) {
      await c.error(['COMMREJECT', e.message]);
    }
  });

  /* ═══════════════ ALBUM MULTI-IMAGES ═══════════════ */

  // Buffer temporaire par chat pour assembler un album
  const albumBuf = new Map(); // jid -> { images: Buffer[], ts }

  cmd('albumadd', {
    cat: 4, desc: 'Ajouter une image au buffer album', usage: 'albumadd (répondre image)', icon: '🖼️',
  }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info || !String(info.mimetype || '').startsWith('image/')) {
      return c.error(['RÉPONDS À UNE IMAGE']);
    }
    try {
      const buf = await downloadFrom(c.sock, info);
      const slot = albumBuf.get(c.from) || { images: [], ts: Date.now() };
      if (slot.images.length >= 10) return c.error(['MAX 10 IMAGES PAR ALBUM']);
      slot.images.push(buf);
      slot.ts = Date.now();
      albumBuf.set(c.from, slot);
      await c.success([`IMAGE ${slot.images.length}/10 AJOUTÉE`, `ENVOIE ${config.prefix}ALBUMSEND POUR PUBLIER`]);
    } catch (e) {
      await c.error(['ALBUMADD', e.message]);
    }
  });

  cmd('albumsend', {
    cat: 4, desc: 'Envoyer le buffer comme album', usage: 'albumsend [légende]', icon: '🖼️',
  }, async (c) => {
    const slot = albumBuf.get(c.from);
    if (!slot?.images?.length) {
      return c.error(['BUFFER VIDE', `${config.prefix}ALBUMADD SUR CHAQUE IMAGE`]);
    }
    const caption = c.q || '';
    await c.reply(config.messages.wait);
    try {
      // Tentative API album native
      try {
        const { key: albumKey } = await send(c.sock, c.from, {
          album: {
            expectedImageCount: slot.images.length,
            expectedVideoCount: 0,
          },
        });
        for (let i = 0; i < slot.images.length; i++) {
          await send(c.sock, c.from, {
            image: slot.images[i],
            caption: i === 0 ? caption : undefined,
            albumKey,
          });
        }
      } catch (_) {
        // Fallback : envoi séquentiel
        for (let i = 0; i < slot.images.length; i++) {
          await send(c.sock, c.from, {
            image: slot.images[i],
            caption: i === 0 ? caption || `🖼️ ${i + 1}/${slot.images.length}` : `${i + 1}/${slot.images.length}`,
          });
        }
      }
      albumBuf.delete(c.from);
      await c.success(['ALBUM ENVOYÉ', `${slot.images.length} IMAGE(S)`]);
    } catch (e) {
      await c.error(['ALBUMSEND', e.message]);
    }
  });

  cmd('albumclear', {
    cat: 4, desc: 'Vider le buffer album', icon: '🖼️',
  }, async (c) => {
    albumBuf.delete(c.from);
    await c.success(['BUFFER ALBUM VIDÉ']);
  });

  /* ═══════════════ PRIVACY / PRÉSENCE / BUSINESS ═══════════════ */

  cmd('presence', {
    cat: 9, desc: 'Présence bot (available/composing/unavailable)', usage: 'presence available|unavailable', owner: true, icon: '👁️',
  }, async (c) => {
    const p = (c.args[0] || 'available').toLowerCase();
    try {
      await c.sock.sendPresenceUpdate(p, c.from);
      await c.success(['PRÉSENCE', p.toUpperCase()]);
    } catch (e) {
      await c.error(['PRESENCE', e.message]);
    }
  });

  cmd('privacy', {
    cat: 9, desc: 'Lire les réglages privacy (si API)', owner: true, icon: '🔒',
  }, async (c) => {
    try {
      if (typeof c.sock.fetchPrivacySettings !== 'function') {
        return c.error(['API FETCHPRIVACYSETTINGS ABSENTE']);
      }
      const p = await c.sock.fetchPrivacySettings(true);
      await c.reply(buildFrame('PRIVACY', [
        bullet('LAST', String(p?.last || '?')),
        bullet('ONLINE', String(p?.online || '?')),
        bullet('PHOTO', String(p?.profile || p?.profilePicture || '?')),
        bullet('STATUS', String(p?.status || '?')),
        bullet('READ', String(p?.readreceipts || p?.readReceipts || '?')),
      ]));
    } catch (e) {
      await c.error(['PRIVACY', e.message]);
    }
  });

  cmd('bizprofile', {
    cat: 10, desc: 'Profil business d’un numéro', usage: 'bizprofile <numéro>', icon: '💼',
  }, async (c) => {
    const n = (c.args[0] || c.q || '').replace(/\D/g, '');
    if (!n) return c.error(['USAGE', `${config.prefix}BIZPROFILE 2376...`]);
    const jid = `${n}@s.whatsapp.net`;
    try {
      if (typeof c.sock.getBusinessProfile !== 'function') {
        return c.error(['API GETBUSINESSPROFILE ABSENTE']);
      }
      const p = await c.sock.getBusinessProfile(jid);
      await c.reply(
        buildFrame('BUSINESS', [
          bullet('NUM', `+${n}`),
          bullet('DESC', String(p?.description || '—').slice(0, 150)),
          bullet('CAT', String(p?.category || p?.business_hours || '?')),
          bullet('EMAIL', String(p?.email || '—')),
          bullet('WEB', String(p?.website?.[0] || p?.website || '—')),
        ])
      );
    } catch (e) {
      await c.error(['BIZPROFILE', e.message]);
    }
  });

  cmd('fetchstatus', {
    cat: 9, desc: 'Lire le status texte d’un contact', usage: 'fetchstatus <numéro>', owner: true, icon: '💬',
  }, async (c) => {
    const n = (c.args[0] || '').replace(/\D/g, '');
    if (!n) return c.error(['USAGE', `${config.prefix}FETCHSTATUS 2376...`]);
    try {
      if (typeof c.sock.fetchStatus !== 'function') return c.error(['API FETCHSTATUS ABSENTE']);
      const st = await c.sock.fetchStatus(`${n}@s.whatsapp.net`);
      await c.success(['STATUS', String(st?.status || st || '—').slice(0, 200)]);
    } catch (e) {
      await c.error(['FETCHSTATUS', e.message]);
    }
  });

  cmd('onwa', {
    cat: 5, desc: 'Vérifier si un numéro a WhatsApp', usage: 'onwa <numéro>', icon: '✅',
  }, async (c) => {
    const n = (c.args[0] || c.q || '').replace(/\D/g, '');
    if (!n) return c.error(['USAGE', `${config.prefix}ONWA 2376...`]);
    try {
      const res = await c.sock.onWhatsApp(`${n}@s.whatsapp.net`);
      const ok = Array.isArray(res) ? res[0]?.exists : res?.exists;
      const jid = Array.isArray(res) ? res[0]?.jid : res?.jid;
      await c.success([
        ok ? 'OUI — SUR WHATSAPP' : 'NON — PAS SUR WHATSAPP',
        jid ? String(jid) : `+${n}`,
      ]);
    } catch (e) {
      await c.error(['ONWA', e.message]);
    }
  });

  /* ═══════════════ MULTI-SESSION (gestion dossiers) ═══════════════ */

  cmd('sessionnew', {
    cat: 9, desc: 'Créer un dossier multi-session', usage: 'sessionnew <nom>', owner: true, icon: '📱',
  }, async (c) => {
    const name = (c.args[0] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!name) return c.error(['USAGE', `${config.prefix}SESSIONNEW COMPTE2`]);
    const dir = path.join(process.cwd(), 'sessions', name);
    fs.mkdirSync(dir, { recursive: true });
    await c.success([
      'DOSSIER CRÉÉ',
      dir,
      `LANCE : set SESSION_DIR=sessions/${name} && npm start`,
      '(2e terminal = 2e numéro)',
    ]);
  });

  cmd('sessionlist', {
    cat: 9, desc: 'Lister les sessions multi', owner: true, icon: '📱',
  }, async (c) => {
    const root = path.join(process.cwd(), 'sessions');
    let names = [];
    try {
      if (fs.existsSync(root)) {
        names = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
      }
    } catch (_) {}
    await c.reply(
      buildFrame('MULTI-SESSION', [
        bullet('ACTIVE', config.sessionDir || 'session'),
        bullet('AUTRES', names.length ? names.join(', ') : 'aucune'),
        note(toUnicode('CHAQUE SESSION = UN PROCESS NODE')),
      ])
    );
  });

  /* ═══════════════ STICKER PACK AMÉLIORÉ (multi) ═══════════════ */

  const packBuf = new Map(); // jid -> webp buffers

  cmd('packadd', {
    cat: 4, desc: 'Ajouter un sticker au pack en construction', usage: 'packadd (répondre image/sticker)', icon: '📦',
  }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info) return c.error(['RÉPONDS À UNE IMAGE OU UN STICKER']);
    try {
      const buf = await downloadFrom(c.sock, info);
      const webp = await sharp(buf)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp()
        .toBuffer();
      const slot = packBuf.get(c.from) || [];
      if (slot.length >= 30) return c.error(['MAX 30 STICKERS']);
      slot.push(webp);
      packBuf.set(c.from, slot);
      await c.success([`STICKER ${slot.length}/30`, `${config.prefix}PACKSEND NOM`]);
    } catch (e) {
      await c.error(['PACKADD', e.message]);
    }
  });

  cmd('packsend', {
    cat: 4, desc: 'Envoyer le pack construit', usage: 'packsend [nom]', icon: '📦',
  }, async (c) => {
    const slot = packBuf.get(c.from);
    if (!slot?.length) return c.error(['PACK VIDE', `${config.prefix}PACKADD`]);
    const name = (c.q || config.packname || 'DJOUSSE PACK').slice(0, 32);
    await c.reply(config.messages.wait);
    try {
      try {
        await send(c.sock, c.from, {
          stickerPack: {
            name,
            publisher: config.author || 'DJOUSSE TECH',
            description: config.botName,
            cover: slot[0],
            stickers: slot.map((data) => ({ data })),
          },
        }, { quoted: c.msg });
      } catch (e1) {
        // Fallback : envoi un par un
        for (const data of slot.slice(0, 10)) {
          await send(c.sock, c.from, { sticker: data });
        }
        await c.reply(`ℹ️ Pack natif indisponible — ${Math.min(10, slot.length)} stickers envoyés (${e1.message})`);
      }
      packBuf.delete(c.from);
      await c.success(['PACK ENVOYÉ', name, `${slot.length} STICKER(S)`]);
    } catch (e) {
      await c.error(['PACKSEND', e.message]);
    }
  });

  /* ═══════════════ APPEL — volontairement limité ═══════════════ */

  cmd('rejectcall', {
    cat: 9, desc: 'Info rejet d’appels (REJECT_CALL=.env)', owner: true, icon: '📞',
  }, async (c) => {
    await c.reply(
      buildFrame('APPELS', [
        bullet('REJECT_CALL', String(process.env.REJECT_CALL || config.rejectCall || false)),
        note(toUnicode('APPELS SORTANTS BOT : NON (RISQUE BAN)')),
        note(toUnicode('UTILISE .CALLLINK POUR UN LIEN HUMAIN')),
      ])
    );
  });
}

module.exports = { registerMissing };
