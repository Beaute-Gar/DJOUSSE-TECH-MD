'use strict';
/**
 * Fonctionnalités Baileys avancées (sans boutons interactifs)
 * Communities, Channels, Albums, Sticker pack, Catalog, Scheduler, Multi-session, Appels
 */
const fs = require('fs');
const path = require('path');
const { parseWhen, getScheduler } = require('./scheduler');
const { send } = require('./wa-send');

function registerExtras(cmd, ctx) {
  const {
    config,
    mediaInfo,
    downloadFrom,
    sharp,
    Sticker,
    StickerTypes,
    renderSuccess,
    renderError,
    buildFrame,
    bullet,
    toUnicode,
    note,
    ctxInfo,
    unwrap,
  } = ctx;

  /* ── ALBUM multi-médias ─────────────────────────────────── */
  cmd('album', {
    cat: 4, desc: 'Envoyer un album (répondre à plusieurs images ou une image)',
    usage: 'album (répondre image) | envoie plusieurs images puis .album',
    icon: '🖼️',
  }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info || !info.mimetype?.startsWith('image/')) {
      return c.error(['RÉPONDS À UNE IMAGE', `LÉGENDE ${config.prefix}ALBUM POSSIBLE`]);
    }
    try {
      const buf = await downloadFrom(c.sock, info);
      // Tentative album natif (Baileys récents) puis fallback image
      try {
        const { key: albumKey } = await send(c.sock, c.from, {
          album: { expectedImageCount: 1, expectedVideoCount: 0 },
        });
        await send(c.sock, c.from, { image: buf, caption: c.q || '', albumKey }, { quoted: c.msg });
        return c.success(['ALBUM ENVOYÉ']);
      } catch (_) {
        await send(c.sock, c.from, { image: buf, caption: c.q || '🖼️' }, { quoted: c.msg });
        await c.success(['IMAGE ENVOYÉE', 'ALBUM NATIF NON SUPPORTÉ PAR CE BAILEYS']);
      }
    } catch (e) {
      await c.error(['ALBUM ÉCHEC', e.message]);
    }
  });

  /* ── STICKER PACK ───────────────────────────────────────── */
  cmd('stickerpack', ['spack', 'pack'], {
    cat: 4, desc: 'Pack de stickers (répondre à une image = cover+1 sticker)',
    usage: 'stickerpack [nom]',
    icon: '📦',
  }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info || !info.mimetype?.startsWith('image/')) {
      return c.error(['RÉPONDS À UNE IMAGE', `${config.prefix}STICKERPACK NOM`]);
    }
    try {
      const buf = await downloadFrom(c.sock, info);
      const webp = await sharp(buf).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
      const name = (c.q || config.packname || 'DJOUSSE PACK').slice(0, 32);
      try {
        await send(c.sock, c.from, {
          stickerPack: {
            name,
            publisher: config.author || 'DJOUSSE TECH',
            description: config.botName,
            cover: webp,
            stickers: [{ data: webp }],
          },
        }, { quoted: c.msg });
        return c.success([`PACK « ${name} » ENVOYÉ`]);
      } catch (e1) {
        // Fallback : un sticker simple
        const sticker = new Sticker(buf, {
          pack: name,
          author: config.author || 'DJOUSSE TECH',
          type: StickerTypes.FULL,
        });
        await send(c.sock, c.from, { sticker: await sticker.toBuffer() }, { quoted: c.msg });
        await c.success(['STICKER ENVOYÉ', 'PACK NATIF INDISPONIBLE', e1.message.slice(0, 60)]);
      }
    } catch (e) {
      await c.error(['PACK ÉCHEC', e.message]);
    }
  });

  /* ── CHANNELS / NEWSLETTERS ─────────────────────────────── */
  cmd('chfollow', ['newsletterfollow', 'cfollow'], {
    cat: 9, desc: 'Suivre un channel WhatsApp', usage: 'chfollow <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.reply(`❌ Usage : ${config.prefix}chfollow 1234567890@newsletter`);
    try {
      if (typeof c.sock.newsletterFollow === 'function') {
        await c.sock.newsletterFollow(id);
      } else if (c.sock.newsletter?.follow) {
        await c.sock.newsletter.follow(id);
      } else {
        return c.reply('❌ newsletterFollow non dispo dans cette version de Baileys.');
      }
      await c.success([`CHANNEL SUIVI : ${id}`]);
    } catch (e) {
      await c.reply(`❌ ${e.message}`);
    }
  });

  cmd('chunfollow', ['newsletterunfollow'], {
    cat: 9, desc: 'Ne plus suivre un channel', usage: 'chunfollow <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.reply(`❌ Usage : ${config.prefix}chunfollow 123@newsletter`);
    try {
      if (typeof c.sock.newsletterUnfollow === 'function') await c.sock.newsletterUnfollow(id);
      else if (c.sock.newsletter?.unfollow) await c.sock.newsletter.unfollow(id);
      else return c.reply('❌ API newsletter absente.');
      await c.success([`CHANNEL QUITTÉ : ${id}`]);
    } catch (e) {
      await c.reply(`❌ ${e.message}`);
    }
  });

  cmd('chmsg', ['newslettermsg', 'chsend'], {
    cat: 9, desc: 'Poster un texte sur un channel (admin)', usage: 'chmsg <id@newsletter> | <texte>', owner: true, icon: '📢',
  }, async (c) => {
    const parts = c.q.split('|').map((s) => s.trim());
    if (parts.length < 2 || !parts[0].includes('@newsletter')) {
      return c.reply(`❌ Usage : ${config.prefix}chmsg 123@newsletter | Mon message`);
    }
    try {
      await send(c.sock, parts[0], { text: parts[1].slice(0, 4000) });
      await c.success(['MESSAGE CHANNEL ENVOYÉ']);
    } catch (e) {
      await c.reply(`❌ ${e.message}`);
    }
  });

  cmd('chcreate', ['newslettercreate'], {
    cat: 9, desc: 'Créer un channel (si API dispo)', usage: 'chcreate <nom>', owner: true, icon: '📢',
  }, async (c) => {
    if (!c.q) return c.reply(`❌ Usage : ${config.prefix}chcreate Nom du channel`);
    try {
      let res;
      if (typeof c.sock.newsletterCreate === 'function') res = await c.sock.newsletterCreate(c.q.slice(0, 60));
      else return c.reply('❌ newsletterCreate non supporté par ce Baileys.');
      await c.reply(buildFrame('CHANNEL', [
        bullet('NOM', c.q.slice(0, 60)),
        bullet('ID', String(res?.id || res?.jid || JSON.stringify(res).slice(0, 80))),
      ]));
    } catch (e) {
      await c.reply(`❌ ${e.message}`);
    }
  });

  /* ── COMMUNITIES ────────────────────────────────────────── */
  cmd('community', ['communaute', 'com'], {
    cat: 2, desc: 'Infos / création communauté (si supporté)', usage: 'community create <nom> | community link',
    group: true, admin: true, icon: '🏘️',
  }, async (c) => {
    const sub = (c.args[0] || '').toLowerCase();
    if (sub === 'create') {
      const name = c.args.slice(1).join(' ') || c.q.replace(/^create\s*/i, '');
      if (!name) return c.reply(`❌ ${config.prefix}community create Nom`);
      try {
        // Certaines versions : groupCreate avec options community
        if (typeof c.sock.groupCreate === 'function') {
          const meta = await c.sock.groupCreate(name.slice(0, 40), []);
          await c.reply(`✅ Groupe/communauté créé : ${meta?.id || '?'}\nNom : ${meta?.subject || name}`);
        } else return c.reply('❌ groupCreate indisponible.');
      } catch (e) {
        await c.reply(`❌ ${e.message}`);
      }
      return;
    }
    if (sub === 'link' || sub === 'invite') {
      try {
        const code = await c.sock.groupInviteCode(c.from);
        await c.reply(`🔗 Lien : https://chat.whatsapp.com/${code}`);
      } catch (e) {
        await c.reply(`❌ ${e.message}`);
      }
      return;
    }
    await c.reply(
      `🏘️ *Communauté / groupe*\n` +
      `• ${config.prefix}community create <nom>\n` +
      `• ${config.prefix}community link\n` +
      `Note : les super-communautés WA dépendent de la version Baileys.`
    );
  });

  /* ── CATALOG / BUSINESS / PRODUIT ───────────────────────── */
  cmd('product', ['catalog', 'produit'], {
    cat: 10, desc: 'Envoyer une carte produit (business)', usage: 'product <titre> | <prix> | <desc>',
    icon: '🛒',
  }, async (c) => {
    const parts = c.q.split('|').map((s) => s.trim());
    if (parts.length < 2) {
      return c.reply(`❌ Usage : ${config.prefix}product Titre | 1500 XAF | Description`);
    }
    const [title, price, description] = parts;
    const info = mediaInfo(c.msg);
    try {
      let jpegThumbnail;
      if (info?.mimetype?.startsWith('image/')) {
        const buf = await downloadFrom(c.sock, info);
        jpegThumbnail = await sharp(buf).resize(100, 100).jpeg().toBuffer();
      }
      await send(c.sock, c.from, {
        text: `🛒 *${title}*\n💰 ${price}\n${description || ''}`.trim(),
      }, { quoted: c.msg });
      // Tentative productMessage si supporté
      try {
        await send(c.sock, c.from, {
          product: {
            productImage: info ? await downloadFrom(c.sock, info) : undefined,
            title: title.slice(0, 60),
            description: (description || '').slice(0, 200),
            currencyCode: 'XAF',
            priceAmount1000: Math.round(parseFloat(String(price).replace(/[^\d.]/g, '')) || 0) * 1000,
            retailerId: config.botName,
            productId: `dj_${Date.now()}`,
          },
          businessOwnerJid: c.sock.user?.id,
        });
      } catch (_) {
        /* texte déjà envoyé */
      }
      if (jpegThumbnail) { /* reserved */ }
      await c.success(['PRODUIT ENVOYÉ']);
    } catch (e) {
      await c.reply(`❌ ${e.message}`);
    }
  });

  cmd('pix', {
    cat: 10, desc: 'Envoyer un code PIX / paiement texte', usage: 'pix <clé> | <montant> | [label]',
    icon: '💳',
  }, async (c) => {
    const parts = c.q.split('|').map((s) => s.trim());
    if (!parts[0]) return c.reply(`❌ Usage : ${config.prefix}pix clé@pix | 1000 | Label`);
    const [key, amount, label] = parts;
    await send(c.sock, c.from, {
      text:
        `💳 *PAIEMENT / PIX*\n` +
        `Clé : \`${key}\`\n` +
        (amount ? `Montant : *${amount}*\n` : '') +
        (label ? `Libellé : ${label}\n` : '') +
        `\n_${config.botName}_`,
    }, { quoted: c.msg });
  });

  /* ── SCHEDULER ──────────────────────────────────────────── */
  cmd('schedule', ['planifier', 'sched'], {
    cat: 9, desc: 'Planifier un message', usage: 'schedule 5m Texte  |  schedule 18:30 Texte',
    owner: true, icon: '⏰',
  }, async (c) => {
    const sched = getScheduler();
    if (!sched) return c.reply('❌ Scheduler non initialisé.');
    const whenStr = c.args[0];
    const text = c.args.slice(1).join(' ');
    if (!whenStr || !text) {
      return c.reply(`❌ Usage :\n${config.prefix}schedule 5m Bonjour\n${config.prefix}schedule 18:30 Rappel\n${config.prefix}schedule 28/09/2026 20:00 Texte`);
    }
    const when = parseWhen(whenStr);
    if (!when) return c.reply('❌ Date/délai invalide.');
    const job = sched.add({ jid: c.from, text, when, from: c.from });
    await c.success([
      `JOB ${job.id}`,
      `QUAND ${new Date(when).toLocaleString('fr-FR')}`,
      `TEXTE ${text.slice(0, 60)}`,
    ]);
  });

  cmd('schedules', ['jobs'], {
    cat: 9, desc: 'Liste des messages planifiés', owner: true, icon: '⏰',
  }, async (c) => {
    const sched = getScheduler();
    const list = sched?.list() || [];
    if (!list.length) return c.reply('Aucun job planifié.');
    const lines = list.slice(0, 20).map(
      (j) => `• ${j.id.slice(-8)} | ${new Date(j.when).toLocaleString('fr-FR')} | ${j.text.slice(0, 40)}`
    );
    await c.reply(`⏰ *Jobs (${list.length})*\n${lines.join('\n')}`);
  });

  cmd('unschedule', ['unsched'], {
    cat: 9, desc: 'Annuler un job', usage: 'unschedule <id>', owner: true, icon: '⏰',
  }, async (c) => {
    const sched = getScheduler();
    if (!c.q) return c.reply(`❌ ${config.prefix}unschedule <id>`);
    const ok = sched?.remove(c.q.trim());
    await c.reply(ok ? '✅ Job supprimé.' : '❌ Job introuvable.');
  });

  /* ── MULTI-SESSION (info + chemins) ─────────────────────── */
  cmd('sessions', {
    cat: 9, desc: 'Info multi-session', owner: true, icon: '📱',
  }, async (c) => {
    const root = path.join(process.cwd());
    const sessionDir = path.join(root, config.sessionDir || 'session');
    const multi = path.join(root, 'sessions');
    let extra = [];
    try {
      if (fs.existsSync(multi)) {
        extra = fs.readdirSync(multi).filter((d) => fs.statSync(path.join(multi, d)).isDirectory());
      }
    } catch (_) {}
    await c.reply(
      buildFrame('SESSIONS', [
        bullet('ACTIVE', sessionDir),
        bullet('BOT', String(c.sock.user?.id || '?')),
        bullet('MULTI_DIR', multi),
        bullet('AUTRES', extra.length ? extra.join(', ') : 'aucune'),
        note('Pour multi-compte : lance une 2e instance avec SESSION_DIR=sessions/compte2'),
      ])
    );
  });

  /* ── APPELS (risqué — limité) ───────────────────────────── */
  cmd('callinfo', {
    cat: 9, desc: 'Info appels (API limitée / risquée)', owner: true, icon: '📞',
  }, async (c) => {
    await c.reply(
      `📞 *Appels Baileys*\n` +
      `• Rejet auto : REJECT_CALL dans .env\n` +
      `• Appels sortants natifs : support partiel selon le fork, risque de ban élevé.\n` +
      `• Non recommandé en production.\n` +
      `• Utilise plutôt un message texte ou un lien d'appel WhatsApp.`
    );
  });

  cmd('calllink', {
    cat: 5, desc: 'Lien d\'appel WhatsApp (sans appel sortant bot)', usage: 'calllink [vidéo]',
    icon: '📞',
  }, async (c) => {
    const num = (config.ownerNumber[0] || '').replace(/\D/g, '');
    const video = /vid/i.test(c.q || '');
    const link = video
      ? `https://wa.me/call/${num}?type=video`
      : `https://wa.me/${num}`;
    await c.reply(`📞 Contact / appel :\n${link}`);
  });

  /* ═══════════════ BAILEYS — clés de contenu manquantes (G2) ═══════════════
     Ces six commandes exploitent les six clés d'AnyMessageContent/AnyRegular-
     MessageContent que le bot n'utilisait pas (document, location, forward,
     groupInvite, sharePhoneNumber, requestPhoneNumber). Chaque envoi passe
     par le service unique lib/wa-send.js. */

  /* ── forward : transférer le message cité ───────────────────────── */
  cmd('fwd', ['transfert', 'transfer'], {
    cat: 4, desc: 'Transférer le message cité vers un destinataire',
    usage: 'fwd @user|numéro (répondre au message)', icon: '↪️',
  }, async (c) => {
    const ci = ctxInfo(unwrap(c.msg.message))
      || c.msg.message?.extendedTextMessage?.contextInfo;
    if (!ci?.quotedMessage) return c.error(['RÉPONDS À UN MESSAGE', `${config.prefix}FWD @USER`]);
    const targets = [...(ci.mentionedJid || [])];
    for (const a of c.args) {
      const n = String(a).replace(/\D/g, '');
      if (n.length >= 8) targets.push(`${n}@s.whatsapp.net`);
    }
    const unique = [...new Set(targets)];
    if (!unique.length) return c.error(['DESTINATAIRE MANQUANT', `${config.prefix}FWD @USER`]);
    const original = {
      key: {
        remoteJid: c.from,
        id: ci.stanzaId,
        participant: ci.participant || undefined,
        fromMe: false,
      },
      message: ci.quotedMessage,
    };
    try {
      for (const t of unique) await send(c.sock, t, { forward: original }, { quoted: c.msg });
      return c.success(['MESSAGE TRANSFÉRÉ', `${unique.length} destinataire(s)`]);
    } catch (e) {
      return c.error(['FWD ÉCHEC', e.message]);
    }
  });

  /* ── document : envoyer un média cité en fichier (qualité d'origine) ── */
  cmd('senddoc', ['doc', 'document'], {
    cat: 4, desc: 'Envoyer le média cité en document (qualité préservée)',
    usage: 'senddoc [légende] (répondre à un média)', icon: '📄',
  }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info) return c.error(['RÉPONDS À UN MÉDIA', `${config.prefix}SENDDOC [LÉGENDE]`]);
    try {
      const buf = await downloadFrom(c.sock, info);
      const node = info.content[info.type] || {};
      const sub = String(node.mimetype || info.mimetype || 'application/octet-stream')
        .split('/')[1].split(';')[0] || 'bin';
      const fileName = node.fileName || `media-${Date.now()}.${sub}`;
      await send(c.sock, c.from, {
        document: buf,
        mimetype: String(info.mimetype || 'application/octet-stream'),
        fileName,
        caption: c.q || '',
      }, { quoted: c.msg });
      return c.success(['DOCUMENT ENVOYÉ', fileName]);
    } catch (e) {
      return c.error(['SENDDOC ÉCHEC', e.message]);
    }
  });

  /* ── location : position GPS ────────────────────────────────────── */
  cmd('loc', ['position', 'localisation'], {
    cat: 4, desc: 'Envoyer une position GPS', usage: 'loc <lat> <lng> [nom]', icon: '📍',
  }, async (c) => {
    const parts = (c.q || '').split(/[\s,]+/).filter(Boolean);
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return c.error(['COORDONNÉES INVALIDES', `${config.prefix}LOC -3.87 15.27 Douala`]);
    }
    const name = parts.slice(2).join(' ');
    try {
      await send(c.sock, c.from, {
        location: { degreesLatitude: lat, degreesLongitude: lng, ...(name ? { name } : {}) },
      }, { quoted: c.msg });
      return c.success(['POSITION ENVOYÉE', `${lat}, ${lng}${name ? ` (${name})` : ''}`]);
    } catch (e) {
      return c.error(['LOC ÉCHEC', e.message]);
    }
  });

  /* ── sharePhoneNumber / requestPhoneNumber ──────────────────────── */
  cmd('sharenum', ['monnum'], {
    cat: 10, desc: 'Partager son numéro dans la discussion', usage: 'sharenum', icon: '📇',
  }, async (c) => {
    try {
      await send(c.sock, c.from, { sharePhoneNumber: true }, { quoted: c.msg });
      return c.success(['NUMÉRO PARTAGÉ']);
    } catch (e) {
      return c.error(['SHARENUM ÉCHEC', e.message]);
    }
  });

  cmd('asknum', ['demander-num'], {
    cat: 10, desc: 'Demander le numéro du destinataire', usage: 'asknum [@user|numéro]', icon: '📇',
  }, async (c) => {
    const ci = ctxInfo(unwrap(c.msg.message));
    const digits = (c.args[0] || '').replace(/\D/g, '');
    const target = (ci?.mentionedJid || [])[0]
      || (digits.length >= 8 ? `${digits}@s.whatsapp.net` : c.from);
    try {
      await send(c.sock, target, { requestPhoneNumber: true }, { quoted: c.msg });
      return c.success(['DEMANDE ENVOYÉE', target]);
    } catch (e) {
      return c.error(['ASKNUM ÉCHEC', e.message]);
    }
  });

  /* ── groupInvite : invitation de groupe en message natif ────────── */
  cmd('ginvite', ['invite', 'inviter'], {
    cat: 2, desc: "Envoyer l'invitation du groupe en message natif",
    usage: 'ginvite', group: true, icon: '🔗',
  }, async (c) => {
    try {
      const [code, meta] = await Promise.all([
        c.sock.groupInviteCode(c.from),
        c.sock.groupMetadata(c.from),
      ]);
      const text = `Rejoins « ${meta.subject} » : https://chat.whatsapp.com/${code}`;
      await send(c.sock, c.from, {
        groupInvite: {
          inviteCode: code,
          /* expiration : horodatage epoch (ms), 7 jours — champ proto
             GroupInviteMessage.inviteExpiration */
          inviteExpiration: Date.now() + 7 * 86400000,
          text,
          jid: c.from,
          subject: meta.subject,
        },
      }, { quoted: c.msg });
      return c.success(['INVITATION ENVOYÉE', code]);
    } catch (e) {
      return c.error(['GINVITE ÉCHEC', e.message]);
    }
  });
}

module.exports = { registerExtras };
