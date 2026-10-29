'use strict';
/**
 * Fonctionnalités Baileys avancées (sans boutons interactifs)
 * Communities, Channels, Albums, Sticker pack, Catalog, Scheduler, Multi-session, Appels
 */
const fs = require('fs');
const path = require('path');
const { parseWhen, getScheduler } = require('./scheduler');
const { send } = require('./wa-send');
const { parseEphemeral } = require('./ephemeral');
const { extractInviteCode } = require('./invite');

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
  cmd('stickerpack', ['pack'], {
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
  cmd('chfollow', ['cfollow'], {
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

  cmd('chmsg', ['chsend'], {
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

  /* ── COMMUNITIES (API community* natives, repli groupe) ──── */
  cmd('community', ['communaute'], {
    cat: 2, desc: 'Communautés WhatsApp (API native)',
    usage: 'community create|list|info|link|revoke|leave|join|inviteinfo|subject|desc|announce|lock|joinmode|addmode|ephemeral|requests|approve|reject|add|remove',
    group: true, admin: true, icon: '🏘️',
  }, async (c) => {
    const sub = (c.args[0] || '').toLowerCase();
    const rest = c.args.slice(1);
    const has = (fn) => typeof c.sock[fn] === 'function';
    const fail = (fn) => c.error(['API ABSENTE', fn.toUpperCase()]);
    const mentioned = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    try {
      switch (sub) {
        case 'create': {
          const name = (rest.join(' ') || c.q.replace(/^create\s*/i, '')).trim();
          if (!name) return c.error(['USAGE', `${config.prefix}COMMUNITY CREATE NOM`]);
          if (has('communityCreate')) {
            const meta = await c.sock.communityCreate(name.slice(0, 40), '');
            await c.success(['COMMUNAUTÉ CRÉÉE', meta?.id || '?']);
          } else if (has('groupCreate')) {
            const meta = await c.sock.groupCreate(name.slice(0, 40), []);
            await c.success(['GROUPE CRÉÉ (COMMUNAUTÉ NATIVE ABSENTE)', meta?.id || '?']);
          } else return fail('communityCreate');
          return;
        }
        case 'list': {
          if (!has('communityFetchAllParticipating')) return fail('communityFetchAllParticipating');
          const map = await c.sock.communityFetchAllParticipating();
          const items = Object.values(map || {});
          const lines = [bullet('TOTAL', String(items.length))];
          for (const g of items.slice(0, 30)) {
            lines.push(bullet(`${g.participants?.length || 0}👤`, `${g.subject || '?'} — ${String(g.id || '').split('@')[0]}`));
          }
          if (items.length > 30) lines.push(note(toUnicode(`+${items.length - 30} AUTRES`)));
          await c.reply(buildFrame('COMMUNAUTÉS', lines));
          return;
        }
        case 'info': {
          if (!has('communityMetadata')) return fail('communityMetadata');
          const meta = await c.sock.communityMetadata(c.from);
          await c.reply(buildFrame('COMMUNAUTÉ', [
            bullet('ID', meta.id || '?'),
            bullet('NOM', meta.subject || '?'),
            bullet('OWNER', meta.owner || meta.subjectOwner || '?'),
            bullet('MEMBRES', String(meta.participants?.length || 0)),
            bullet('DESC', String(meta.desc || '—').slice(0, 120)),
            bullet('ANNONCES', meta.announce ? 'OUI' : 'NON'),
          ]));
          return;
        }
        case 'link':
        case 'invite': {
          if (has('communityInviteCode')) {
            try {
              const code = await c.sock.communityInviteCode(c.from);
              await c.reply(`🔗 Lien : https://chat.whatsapp.com/${code}`);
              return;
            } catch (_) { /* pas une communauté → repli groupe */ }
          }
          if (has('groupInviteCode')) {
            const code = await c.sock.groupInviteCode(c.from);
            await c.reply(`🔗 Lien : https://chat.whatsapp.com/${code}`);
            return;
          }
          return fail('communityInviteCode');
        }
        case 'revoke': {
          if (!has('communityRevokeInvite')) return fail('communityRevokeInvite');
          const code = await c.sock.communityRevokeInvite(c.from);
          await c.success(['INVITATION RÉVOQUÉE', code ? `CODE ${code}` : '']);
          return;
        }
        case 'leave': {
          if (!has('communityLeave')) return fail('communityLeave');
          await c.sock.communityLeave(c.from);
          await c.success(['COMMUNAUTÉ QUITTÉE']);
          return;
        }
        case 'join': {
          const code = extractInviteCode(rest.join(' '));
          if (!code) return c.error(['USAGE', `${config.prefix}COMMUNITY JOIN HTTPS://CHAT.WHATSAPP.COM/XXX`]);
          if (!has('communityAcceptInvite')) return fail('communityAcceptInvite');
          const jid = await c.sock.communityAcceptInvite(code);
          await c.success(['INVITATION ACCEPTÉE', jid || '']);
          return;
        }
        case 'inviteinfo': {
          const code = extractInviteCode(rest.join(' '));
          if (!code) return c.error(['USAGE', `${config.prefix}COMMUNITY INVITEINFO <LIEN>`]);
          if (!has('communityGetInviteInfo')) return fail('communityGetInviteInfo');
          const meta = await c.sock.communityGetInviteInfo(code);
          await c.reply(buildFrame('COMMUNAUTÉ (INVITATION)', [
            bullet('NOM', meta.subject || '?'),
            bullet('ID', String(meta.id || '?')),
            bullet('MEMBRES', String(meta.participants?.length || 0)),
            bullet('DESC', String(meta.desc || '—').slice(0, 120)),
          ]));
          return;
        }
        case 'subject': {
          const name = rest.join(' ').trim();
          if (!name) return c.error(['USAGE', `${config.prefix}COMMUNITY SUBJECT NOUVEAU NOM`]);
          if (!has('communityUpdateSubject')) return fail('communityUpdateSubject');
          await c.sock.communityUpdateSubject(c.from, name.slice(0, 60));
          await c.success([`SUJET → ${name.slice(0, 60)}`]);
          return;
        }
        case 'desc': {
          const d = rest.join(' ').trim();
          if (!d) return c.error(['USAGE', `${config.prefix}COMMUNITY DESC TEXTE`]);
          if (!has('communityUpdateDescription')) return fail('communityUpdateDescription');
          await c.sock.communityUpdateDescription(c.from, d.slice(0, 500));
          await c.success(['DESCRIPTION MISE À JOUR']);
          return;
        }
        case 'announce': {
          const v = (rest[0] || '').toLowerCase();
          if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}COMMUNITY ANNOUNCE ON|OFF`]);
          if (!has('communitySettingUpdate')) return fail('communitySettingUpdate');
          await c.sock.communitySettingUpdate(c.from, v === 'on' ? 'announcement' : 'not_announcement');
          await c.success([`ANNONCES : ${v === 'on' ? 'ACTIVÉES' : 'DÉSACTIVÉES'}`]);
          return;
        }
        case 'lock': {
          const v = (rest[0] || '').toLowerCase();
          if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}COMMUNITY LOCK ON|OFF`]);
          if (!has('communitySettingUpdate')) return fail('communitySettingUpdate');
          await c.sock.communitySettingUpdate(c.from, v === 'on' ? 'locked' : 'unlocked');
          await c.success([`VERROUILLAGE : ${v === 'on' ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`]);
          return;
        }
        case 'joinmode': {
          const v = (rest[0] || '').toLowerCase();
          if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}COMMUNITY JOINMODE ON|OFF`]);
          if (!has('communityJoinApprovalMode')) return fail('communityJoinApprovalMode');
          await c.sock.communityJoinApprovalMode(c.from, v);
          await c.success([`ENTRÉE SUR APPROBATION : ${v === 'on' ? 'ACTIVÉE' : 'DÉSACTIVÉE'}`]);
          return;
        }
        case 'addmode': {
          const v = (rest[0] || '').toLowerCase();
          const mode = { all: 'all_member_add', admins: 'admin_add' }[v];
          if (!mode) return c.error(['USAGE', `${config.prefix}COMMUNITY ADDMODE ALL|ADMINS`]);
          if (!has('communityMemberAddMode')) return fail('communityMemberAddMode');
          await c.sock.communityMemberAddMode(c.from, mode);
          await c.success([`AJOUT DE MEMBRES : ${v === 'all' ? 'TOUS' : 'ADMINS SEULEMENT'}`]);
          return;
        }
        case 'ephemeral': {
          const seconds = parseEphemeral(rest[0] || '');
          if (seconds === null) return c.error(['USAGE', `${config.prefix}COMMUNITY EPHEMERAL OFF|24H|7D|90D`]);
          if (!has('communityToggleEphemeral')) return fail('communityToggleEphemeral');
          await c.sock.communityToggleEphemeral(c.from, seconds);
          await c.success([seconds === 0 ? 'ÉPHÉMÈRES DÉSACTIVÉS' : `ÉPHÉMÈRES : ${String(rest[0]).toUpperCase()}`]);
          return;
        }
        case 'requests': {
          if (!has('communityRequestParticipantsList')) return fail('communityRequestParticipantsList');
          const reqs = (await c.sock.communityRequestParticipantsList(c.from)) || [];
          const lines = [bullet('DEMANDES', String(reqs.length))];
          reqs.slice(0, 30).forEach((r, i) => lines.push(bullet(String(i + 1), String(r?.jid || JSON.stringify(r)))));
          await c.reply(buildFrame("DEMANDES D'ENTRÉE", lines));
          return;
        }
        case 'approve':
        case 'reject': {
          if (!mentioned.length) return c.error(['USAGE', `@USER ${config.prefix}COMMUNITY ${sub.toUpperCase()}`]);
          if (!has('communityRequestParticipantsUpdate')) return fail('communityRequestParticipantsUpdate');
          const res = await c.sock.communityRequestParticipantsUpdate(c.from, mentioned, sub === 'approve' ? 'approve' : 'reject');
          await c.success([`${res?.length || 0} RÉPONSE(S)`, sub === 'approve' ? 'APPROUVÉ(S)' : 'REFUSÉ(S)']);
          return;
        }
        case 'add':
        case 'remove': {
          if (!mentioned.length) return c.error(['USAGE', `@USER ${config.prefix}COMMUNITY ${sub.toUpperCase()}`]);
          if (!has('communityParticipantsUpdate')) return fail('communityParticipantsUpdate');
          const res = await c.sock.communityParticipantsUpdate(c.from, mentioned, sub === 'add' ? 'add' : 'remove');
          await c.success([`${res?.length || 0} RÉSULTAT(S)`]);
          return;
        }
        default:
          await c.reply(
            `🏘️ *${config.prefix}community <sub>*\n` +
            `• create <nom> · list · info · link · revoke · leave\n` +
            `• join <lien> · inviteinfo <lien>\n` +
            `• subject <nom> · desc <txt> · announce on|off · lock on|off\n` +
            `• joinmode on|off · addmode all|admins · ephemeral off|24h|7d|90d\n` +
            `• requests · approve @ · reject @ · add @ · remove @`
          );
      }
    } catch (e) {
      await c.reply(`❌ ${e.message}`);
    }
  });

  /* ── CATALOG / BUSINESS / PRODUIT ───────────────────────── */
  cmd('product', ['produit'], {
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
  cmd('schedule', ['planifier'], {
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
    const sessionDir = path.resolve(root, config.sessionDir || 'session');
    const multi = path.join(root, 'storage', 'sessions');
    let extra = [];
    try {
      if (fs.existsSync(multi)) {
        extra = fs.readdirSync(multi).filter((d) => fs.statSync(path.join(multi, d)).isDirectory());
      }
    } catch (_) {}
    await c.reply(
      buildFrame('SESSIONS', [
        bullet('ACTIVE', sessionDir),
        bullet('BASE_LOCALE', path.join(root, config.dataDir || 'data')),
        bullet('BOT', String(c.sock.user?.id || '?')),
        bullet('MULTI_DIR', multi),
        bullet('AUTRES', extra.length ? extra.join(', ') : 'aucune'),
        note('Pour multi-compte : lance une 2e instance avec SESSION_DIR=storage/sessions/compte2'),
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
  cmd('fwd', ['transfert'], {
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
  cmd('senddoc', ['doc'], {
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
  cmd('loc', ['localisation'], {
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
  cmd('ginvite', ['invite'], {
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

  /* ══════════════ JEUX (cat 7 — FUN) ══════════════ */

  /* ── HANGMAN / PENDU ── */
  const HANG_WORDS = ['BANANE', 'ELEPHANT', 'CROCODILE', 'MUSIQUE', 'ORDINATEUR', 'FENETRE', 'JARDIN', 'ROBOT', 'VOITURE', 'TÉLÉPHONE', 'PILULE', 'CHOCOLAT', 'MONTAGNE', 'PLAGE', 'SOLEIL', 'LUNAIRE', 'VOILE', 'GUITARE', 'PIANO', 'DANSER', 'CHAPEAU', 'BOUCHE', 'CHEVEUX', 'SOURIRE', 'AMITIÉ'];
  const hangGames = new Map();
  const gameAnswers = new Map();
  cmd('hangman', ['pendu'], { cat: 7, desc: 'Jeu du pendu — devine le mot', usage: 'hangman (puis lettre avec .hang <lettre>)', icon: '🎯' }, async (c) => {
    if (hangGames.has(c.from)) return c.error(['PARTIE EN COURS', `${config.prefix}HANG <LETTRE>`]);
    const word = HANG_WORDS[Math.floor(Math.random() * HANG_WORDS.length)];
    hangGames.set(c.from, { word, guessed: new Set(), wrong: 0, maxWrong: 6 });
    const display = '_ '.repeat(word.length).trim();
    await c.reply(buildFrame('PENDU', [
      `Mot : ${display}`,
      `Erreurs : 0/6`,
      `Envoie ${config.prefix}hang <lettre> pour deviner`,
    ]));
  });
  cmd('hang', { cat: 7, desc: 'Lettre du pendu', usage: 'hang <lettre>' }, async (c) => {
    const g = hangGames.get(c.from);
    if (!g) return c.error(['AUCUNE PARTIE', `${config.prefix}HANGMAN`]);
    const letter = (c.args[0] || '').toUpperCase()[0];
    if (!letter || !/[A-Z\u00C0-\u017F]/.test(letter)) return c.error(['USAGE', `${config.prefix}HANG <LETTRE>`]);
    if (g.guessed.has(letter)) return c.error(['LETTRE DÉJÀ PROPOSÉE']);
    g.guessed.add(letter);
    if (!g.word.includes(letter)) g.wrong += 1;
    const display = g.word.split('').map((ch) => g.guessed.has(ch) ? ch : '_').join(' ');
    if (display === g.word) { hangGames.delete(c.from); return c.success(['GAGNÉ !', `Le mot était ${g.word}`]); }
    if (g.wrong >= g.maxWrong) { hangGames.delete(c.from); return c.error(['PERDU !', `Le mot était ${g.word}`]); }
    await c.reply(buildFrame('PENDU', [
      `Mot : ${display}`,
      `Lettres proposées : ${[...g.guessed].join(' ')}`,
      `Erreurs : ${g.wrong}/${g.maxWrong}`,
    ]));
  });

  /* ── TRIVIA / QUIZ ── */
  const TRIVIA_Q = [
    ['Quelle est la capitale de la France ?', 'Paris'],
    ['Combien de continents y a-t-il ?', '7'],
    ['Quel est le plus grand océan ?', 'Pacifique'],
    ['Qui a peint la Joconde ?', 'Léonard de Vinci'],
    ['Quelle est la plus grande planète ?', 'Jupiter'],
    ["En quelle année l'homme a-t-il marché sur la Lune ?", '1969'],
    ['Quel est le plus long fleuve ?', 'Le Nil'],
    ['Combien de côtés a un hexagone ?', '6'],
    ['Quel gaz les plantes absorbent-elles ?', 'CO2'],
    ["Quelle est la devise de l'euro ?", '€'],
    ['Qui a écrit "Les Misérables" ?', 'Victor Hugo'],
    ['Quel est le plus grand désert ?', 'Sahara'],
  ];
  cmd('trivia', ['quiz'], { cat: 7, desc: 'Question de culture générale', usage: 'trivia', icon: '🧠' }, async (c) => {
    const [q, a] = TRIVIA_Q[Math.floor(Math.random() * TRIVIA_Q.length)];
    await c.reply(buildFrame('CULTURE GÉNÉRALE', [
      q,
      '',
      `Réponds avec ${config.prefix}answer <réponse>`,
    ]));
    gameAnswers.set(c.from, a.toLowerCase());
  });

  /* ── RIDDLE / ÉNIGME ── */
  const RIDDLES = [
    ['Je suis blanc, je tombe en hiver. Qui suis-je ?', 'la neige'],
    ["J'ai des doigts mais je ne peux pas toucher. Qui suis-je ?", 'un gant'],
    ['Plus je sèche, plus je suis mouillée. Qui suis-je ?', 'une serviette'],
    ['Je vole sans ailes, je pleure sans yeux. Qui suis-je ?', 'un nuage'],
    ["Qu'est-ce qui monte et descend sans bouger ?", "l'escalier"],
  ];
  cmd('riddle', ['enigme'], { cat: 7, desc: 'Une énigme à résoudre', usage: 'riddle', icon: '❓' }, async (c) => {
    const [r, a] = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    await c.reply(buildFrame('ÉNIGME', [
      r,
      '',
      `Réponds avec ${config.prefix}answer <réponse>`,
    ]));
    gameAnswers.set(c.from, a.toLowerCase());
  });

  /* ── ANSWER (commun trivia + riddle) ── */
  cmd('answer', ['repondre'], { cat: 7, desc: 'Répondre à une question', usage: 'answer <réponse>' }, async (c) => {
    const answer = gameAnswers.get(c.from);
    if (!answer) return c.error(['AUCUNE QUESTION', `${config.prefix}TRIVIA ou ${config.prefix}RIDDLE`]);
    gameAnswers.delete(c.from);
    const guess = (c.q || '').toLowerCase().trim();
    if (guess === answer || answer.includes(guess)) return c.success(['✅ BONNE RÉPONSE !']);
    return c.error(['❌ MAUVAISE RÉPONSE', `La bonne réponse : ${answer}`]);
  });

  /* ── TICTACTOE / MORPION ── */
  const tttGames = new Map();
  cmd('tictactoe', ['morpion'], { cat: 7, desc: 'Morpion à 2 joueurs (1v1)', usage: 'tictactoe @adversaire', icon: '❌⭕' }, async (c) => {
    if (tttGames.has(c.from)) return c.error(['PARTIE EN COURS']);
    const ci = ctxInfo(unwrap(c.msg.message));
    const opp = (ci?.mentionedJid || [])[0];
    if (!opp) return c.error(['ADVERSAIRE MANQUANT', `${config.prefix}TICTACTOE @USER`]);
    if (opp === c.sender) return c.error(['CHOISIS UN AUTRE JOUEUR']);
    tttGames.set(c.from, {
      players: [c.sender, opp], turn: 0,
      board: Array(9).fill(''), x: c.sender, o: opp,
    });
    await c.reply(buildFrame('MORPION', [
      `❌ ${c.sender.split('@')[0]} vs ⭕ ${opp.split('@')[0]}`,
      '',
      '1   2   3',
      '4   5   6',
      '7   8   9',
      '',
      `${c.sender.split('@')[0]} commence — ${config.prefix}tttmove <1-9>`,
    ]));
  });
  cmd('tttmove', ['tttm'], { cat: 7, desc: 'Coup au morpion', usage: 'tttmove <1-9>' }, async (c) => {
    const g = tttGames.get(c.from);
    if (!g) return c.error(['AUCUNE PARTIE', `${config.prefix}TICTACTOE @USER`]);
    const cur = g.players[g.turn];
    if (c.sender !== cur) return c.error(['PAS TON TOUR']);
    const pos = parseInt(c.args[0], 10);
    if (!pos || pos < 1 || pos > 9 || g.board[pos - 1]) return c.error(['CASE INVALIDE']);
    g.board[pos - 1] = g.turn === 0 ? 'X' : 'O';
    const L = (v) => (v === 'X' ? '❌' : '⭕');
    const b = g.board;
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const win = wins.find((w) => b[w[0]] && b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]);
    const draw = b.every(Boolean);
    if (win || draw) {
      tttGames.delete(c.from);
      if (win) {
        const winner = b[win[0]] === 'X' ? g.x : g.o;
        return c.success(['GAGNÉ !', `Le vainqueur : @${winner.split('@')[0]}`]);
      }
      return c.success(['MATCH NUL !']);
    }
    g.turn = 1 - g.turn;
    const next = g.players[g.turn];
    await c.reply(buildFrame('MORPION', [
      b.map((v) => v ? L(v) : '⬜').slice(0,3).join(' '),
      b.slice(3,6).map((v) => v ? L(v) : '⬜').join(' '),
      b.slice(6,9).map((v) => v ? L(v) : '⬜').join(' '),
      '',
      `Tour de @${next.split('@')[0]} — ${config.prefix}tttmove <1-9>`,
    ]));
  });

  /* ── NUMBERGUESS ── */
  const ngGames = new Map();
  cmd('numberguess', ['devinette'], { cat: 7, desc: 'Devine le nombre (1-100)', usage: 'numberguess', icon: '🔢' }, async (c) => {
    if (ngGames.has(c.from)) return c.error(['PARTIE EN COURS', `${config.prefix}nguess <nombre>`]);
    const target = Math.floor(Math.random() * 100) + 1;
    ngGames.set(c.from, { target, tries: 0 });
    await c.reply(buildFrame('DEVINETTE', [
      'Je pense à un nombre entre 1 et 100.',
      `Devine avec ${config.prefix}nguess <nombre>`,
    ]));
  });
  cmd('nguess', ['ng'], { cat: 7, desc: 'Ta devinette', usage: 'nguess <nombre>' }, async (c) => {
    const g = ngGames.get(c.from);
    if (!g) return c.error(['AUCUNE PARTIE', `${config.prefix}NUMBERGUESS`]);
    const n = parseInt(c.args[0], 10);
    if (!n || n < 1 || n > 100) return c.error(['USAGE', `${config.prefix}NGUESS <1-100>`]);
    g.tries += 1;
    if (n === g.target) { ngGames.delete(c.from); return c.success(['🎉 GAGNÉ !', `Le nombre était ${g.target} en ${g.tries} essais.`]); }
    if (g.tries >= 10) { ngGames.delete(c.from); return c.error(['💀 PERDU !', `Le nombre était ${g.target}.`]); }
    const hint = n < g.target ? '📈 Plus grand' : '📉 Plus petit';
    await c.reply(`${hint} — ${g.tries}/10 essais`);
  });

  /* ── WORDGAME ── */
  cmd('wordgame', ['motcache'], { cat: 7, desc: 'Devine le mot caché (lettres mélangées)', usage: 'wordgame', icon: '🔤' }, async (c) => {
    const words = ['CHAT', 'CHIEN', 'MAISON', 'VOITURE', 'SOLEIL', 'LUNE', 'ECOLE', 'LIVRE', 'TABLE', 'FENETRE'];
    const word = words[Math.floor(Math.random() * words.length)];
    const scrambled = word.split('').sort(() => Math.random() - 0.5).join(' ');
    await c.reply(buildFrame('MOT MÉLANGÉ', [
      `Déchiffre : ${scrambled}`,
      `${word.length} lettres`,
      `Réponds avec ${config.prefix}answer <mot>`,
    ]));
    gameAnswers.set(c.from, word.toLowerCase());
  });

  /* ══════════════ OUTILS (cat 5) ══════════════ */

  /* ── MORSE ── */
  const MORSE = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.' };
  cmd('morse', { cat: 5, desc: 'Texte → code morse', usage: 'morse <texte>', icon: '📡' }, async (c) => {
    const t = (c.q || '').toUpperCase();
    if (!t) return c.error(['USAGE', `${config.prefix}MORSE <TEXTE>`]);
    const out = t.split('').map((ch) => MORSE[ch] || '').join(' ').trim();
    await c.reply(out || 'Rien à traduire');
  });

  /* ── HASH ── */
  cmd('hash', { cat: 5, desc: 'Hasher un texte (MD5/SHA256)', usage: 'hash <texte>', icon: '🔐' }, async (c) => {
    const crypto = require('node:crypto');
    const t = c.q || '';
    if (!t) return c.error(['USAGE', `${config.prefix}HASH <TEXTE>`]);
    const md5 = crypto.createHash('md5').update(t).digest('hex');
    const sha256 = crypto.createHash('sha256').update(t).digest('hex');
    await c.reply(buildFrame('HASH', [
      bullet('MD5', md5),
      bullet('SHA256', sha256),
    ]));
  });

  /* ── COLOR ── */
  cmd('color', { cat: 5, desc: 'Couleur aléatoire ou par nom', usage: 'color [nom|hex]', icon: '🎨' }, async (c) => {
    const COLORS = { rouge:'#FF0000', vert:'#00FF00', bleu:'#0000FF', jaune:'#FFFF00', cyan:'#00FFFF', magenta:'#FF00FF', orange:'#FFA500', rose:'#FFC0CB', violet:'#800080', marron:'#A52A2A', noir:'#000000', blanc:'#FFFFFF', gris:'#808080', doré:'#FFD700', argent:'#C0C0C0', turquoise:'#40E0D0', corail:'#FF7F50', lavande:'#E6E6FA' };
    const q = (c.q || '').toLowerCase().trim();
    let hex = COLORS[q];
    let name = q;
    if (!hex) {
      if (/^#[0-9a-f]{6}$/.test(q)) { hex = q; name = q; }
      else { const keys = Object.keys(COLORS); name = keys[Math.floor(Math.random() * keys.length)]; hex = COLORS[name]; }
    }
    const svg = Buffer.from(`<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${hex}"/></svg>`);
    try {
      await send(c.sock, c.from, { image: svg, caption: `${name} — ${hex}` }, { quoted: c.msg });
    } catch { await c.reply(`${name} — ${hex}`); }
  });

  /* ── ASCII ── */
  cmd('ascii', { cat: 5, desc: 'Convertir en art ASCII (5 lignes)', usage: 'ascii <texte>', icon: '🔤' }, async (c) => {
    const t = c.q || '';
    if (!t) return c.error(['USAGE', `${config.prefix}ASCII <TEXTE>`]);
    await c.reply('```\n' + t.toUpperCase().split('').map((ch) => {
      const map = { A:'  █  \n █ █ \n█████\n█   █\n█   █', B:'████ \n█   █\n████ \n█   █\n████ ', C:' ████\n█    \n█    \n█    \n ████', D:'████ \n█   █\n█   █\n█   █\n████ ', E:'█████\n█    \n████ \n█    \n█████', F:'█████\n█    \n████ \n█    \n█    ', G:' ████\n█    \n█  ██\n█   █\n ████', H:'█   █\n█   █\n█████\n█   █\n█   █', I:'█████\n  █  \n  █  \n  █  \n█████', J:'█████\n    █\n    █\n█   █\n ███ ', K:'█   █\n█  █ \n███  \n█  █ \n█   █', L:'█    \n█    \n█    \n█    \n█████', M:'█   █\n██ ██\n█ █ █\n█   █\n█   █', N:'█   █\n██  █\n█ █ █\n█  ██\n█   █', O:' ███ \n█   █\n█   █\n█   █\n ███ ', P:'████ \n█   █\n████ \n█    \n█    ', Q:' ███ \n█   █\n█ █ █\n█  █ \n ██ █', R:'████ \n█   █\n████ \n█  █ \n█   █', S:' ████\n█    \n ███ \n    █\n████ ', T:'█████\n  █  \n  █  \n  █  \n  █  ', U:'█   █\n█   █\n█   █\n█   █\n ███ ', V:'█   █\n█   █\n █ █ \n █ █ \n  █  ', W:'█   █\n█   █\n█ █ █\n██ ██\n█   █', X:'█   █\n █ █ \n  █  \n █ █ \n█   █', Y:'█   █\n █ █ \n  █  \n  █  \n  █  ', Z:'█████\n   █ \n  █  \n █   \n█████', ' ':'     ' };
      return map[ch] || '     ';
    }).join('\n\n') + '\n```');
  });

  /* ── DEFINE ── */
  cmd('define', { cat: 5, desc: 'Définition d\'un mot (Wiktionnaire)', usage: 'define <mot>', icon: '📖' }, async (c) => {
    const w = (c.q || '').trim();
    if (!w) return c.error(['USAGE', `${config.prefix}DEFINE <MOT>`]);
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
      const res = await fetch(url);
      if (!res.ok) return c.error(['MOT INCONNU', w]);
      const data = await res.json();
      const entry = data[0];
      const defs = (entry.meanings || []).flatMap((m) => (m.definitions || []).slice(0, 2).map((d) => `• ${d.definition}`));
      await c.reply(buildFrame(`DÉFINITION — ${w.toUpperCase()}`, defs.slice(0, 5)));
    } catch (e) { await c.error(['DÉFINITION ÉCHEC', e.message]); }
  });

  /* ── LYRICS ── */
  cmd('lyrics', ['paroles'], { cat: 5, desc: 'Paroles d\'une chanson (lrclib.net)', usage: 'lyrics <artiste> <titre>', icon: '🎵' }, async (c) => {
    const q = (c.q || '').trim();
    if (!q) return c.error(['USAGE', `${config.prefix}LYRICS <ARTISTE> <TITRE>`]);
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return c.error(['AUCUN RÉSULTAT', q]);
      const data = await res.json();
      if (!data.length) return c.error(['AUCUN RÉSULTAT', q]);
      const s = data[0];
      const lyrics = (s.plainLyrics || '').slice(0, 3800);
      await c.reply(buildFrame(`${s.trackName.toUpperCase()} — ${s.artistName}`, lyrics.split('\n').slice(0, 40)));
    } catch (e) { await c.error(['LYRICS ÉCHEC', e.message]); }
  });

  /* ── PASSWORD ── */
  cmd('password', ['mdp'], { cat: 5, desc: 'Générer un mot de passe sécurisé', usage: 'password [longueur]', icon: '🔐' }, async (c) => {
    const len = Math.min(64, Math.max(8, parseInt(c.args[0], 10) || 16));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let pw = '';
    for (let i = 0; i < len; i += 1) pw += chars[Math.floor(Math.random() * chars.length)];
    await c.reply(buildFrame('MOT DE PASSE', [
      pw,
      '',
      `Longueur : ${len}`,
    ]));
  });

  /* ── REMIND / RAPPEL ── */
  cmd('remind', ['rappel'], { cat: 5, desc: 'Rappel simple', usage: 'remind 5m raison', icon: '⏰' }, async (c) => {
    const [timeStr, ...reason] = c.args;
    if (!timeStr || !reason.length) return c.error(['USAGE', `${config.prefix}REMIND 5m RAISON`]);
    const when = parseWhen(timeStr);
    if (!when) return c.error(['FORMAT INVALIDE', 'Ex: 5m, 1h, 30s, 2d']);
    const sched = getScheduler();
    if (!sched) return c.error(['PLANIFICATEUR INDISPONIBLE']);
    const job = sched.add({
      jid: c.from,
      from: c.sender,
      text: `⏰ RAPPEL pour @${c.sender.split('@')[0]} : ${reason.join(' ')}`,
      when,
    });
    await c.success(['RAPPEL PROGRAMMÉ', `${timeStr} — ${reason.join(' ')}`, `id: ${job.id}`]);
  });

  /* ── NOTES ── */
  const notesPlugin = require('../commandes/02-groupe/_legacy-notes');
  cmd('note', ['notes'], {
    cat: 2,
    desc: 'Notes personnelles et de groupe : add, list, get, update, delete, clear',
    usage: 'note add|list|get|update|delete|clear | note group list|get|update|delete|clear',
    icon: '📝',
  }, async (c) => notesPlugin.run(c.sock, c.msg, c.args, {
    jid: c.from,
    contextInfo: c.msg?.message?.extendedTextMessage?.contextInfo || {},
    isOwner: c.isOwner,
    isAdmin: c.isAdmin,
  }));

  /* ── BOOKMARK ── */
  const bookmarks = new Map();
  cmd('bookmark', { cat: 5, desc: 'Marque-pages de liens', usage: 'bookmark <lien> | bookmark list', icon: '🔖' }, async (c) => {
    const key = c.sender;
    if (!bookmarks.has(key)) bookmarks.set(key, []);
    const arr = bookmarks.get(key);
    const q = (c.q || '').trim();
    if (!q || q === 'list') {
      if (!arr.length) return c.reply('Aucun marque-page.');
      return c.reply(buildFrame(`MARQUE-PAGES (${arr.length})`, arr.map((n, i) => `${i + 1}. ${n}`)));
    }
    arr.push(q.slice(0, 500));
    await c.success(['MARQUE-PAGE AJOUTÉ', `Total : ${arr.length}`]);
  });

  /* ── CRYPTO / STOCK ── */
  cmd('crypto', { cat: 5, desc: 'Prix d\'une crypto (CoinGecko)', usage: 'crypto bitcoin', icon: '💰' }, async (c) => {
    const coin = (c.q || 'bitcoin').toLowerCase().trim();
    if (!coin) return c.error(['USAGE', `${config.prefix}CRYPTO <NOM>`]);
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=usd&include_24hr_change=true`);
      if (!res.ok) return c.error(['CRYPTO INCONNUE', coin]);
      const data = await res.json();
      const entry = data[coin];
      if (!entry) return c.error(['CRYPTO INCONNUE', coin]);
      const change = entry.usd_24h_change >= 0 ? `+${entry.usd_24h_change.toFixed(2)}` : entry.usd_24h_change.toFixed(2);
      await c.reply(buildFrame(`CRYPTO — ${coin.toUpperCase()}`, [
        bullet('PRIX', `$${entry.usd.toLocaleString()}`),
        bullet('24H', `${change}%`),
      ]));
    } catch (e) { await c.error(['CRYPTO ÉCHEC', e.message]); }
  });

  /* ── SPEEDTEST ── */
  cmd('speedtest', { cat: 5, desc: 'Vitesse de réponse du bot', usage: 'speedtest', icon: '⚡' }, async (c) => {
    const start = Date.now();
    await c.reply('Mesure en cours...');
    const ms = Date.now() - start;
    await c.success([`LATENCE : ${ms}ms`]);
  });

  /* ── TIMEZONE ── */
  cmd('timezone', ['heure'], { cat: 5, desc: 'Heure dans un fuseau', usage: 'timezone [ville]', icon: '🕐' }, async (c) => {
    const city = c.q || 'Paris';
    const now = new Date();
    const tz = { paris: 'Europe/Paris', london: 'Europe/London', newyork: 'America/New_York', tokyo: 'Asia/Tokyo', douala: 'Africa/Douala', yaounde: 'Africa/Yaounde', dubai: 'Asia/Dubai', moscow: 'Europe/Moscow' };
    const zone = tz[city.toLowerCase()] || city;
    try {
      const time = now.toLocaleTimeString('fr-FR', { timeZone: zone });
      const date = now.toLocaleDateString('fr-FR', { timeZone: zone });
      await c.reply(buildFrame(`HEURE — ${city.toUpperCase()}`, [date, time]));
    } catch { await c.error(['FUSEAU INCONNU', city]); }
  });

  /* ── DNS ── */
  cmd('dns', { cat: 5, desc: 'Enregistrements DNS', usage: 'dns <domaine>', icon: '🌐' }, async (c) => {
    const domain = (c.q || '').trim();
    if (!domain) return c.error(['USAGE', `${config.prefix}DNS <DOMAINE>`]);
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
      const data = await res.json();
      const answers = (data.Answer || []).map((a) => a.data).slice(0, 5);
      if (!answers.length) return c.error(['AUCUN ENREGISTREMENT', domain]);
      await c.reply(buildFrame(`DNS — ${domain}`, answers.map((a) => bullet('A', a))));
    } catch (e) { await c.error(['DNS ÉCHEC', e.message]); }
  });

  /* ══════════════ GROUPE (cat 2) ══════════════ */

  /* ── LISTADMINS ── */
  cmd('listadmins', { cat: 2, desc: 'Liste des admins du groupe', usage: 'listadmins', group: true, icon: '👑' }, async (c) => {
    try {
      const meta = await c.sock.groupMetadata(c.from);
      const admins = (meta.participants || []).filter((p) => p.admin).map((p) => `@${p.id.split('@')[0]}`);
      await c.reply(buildFrame(`ADMINS (${admins.length})`, admins));
    } catch (e) { await c.error(['LISTADMINS ÉCHEC', e.message]); }
  });

  /* ── LISTMEMBERS ── */
  cmd('listmembers', ['members'], { cat: 2, desc: 'Liste des membres (rôles + compteurs)', usage: 'listmembers', group: true, icon: '👥' }, async (c) => {
    try {
      const meta = await c.sock.groupMetadata(c.from);
      const parts = meta.participants || [];
      const admins = parts.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').length;
      const line = (p, i) => `${p.admin === 'superadmin' ? '👑' : p.admin === 'admin' ? '🛡️' : '👤'} ${i + 1}. @${p.id.split('@')[0]}`;
      const counters = `📊 Total : ${parts.length} · 🛡️ Admins : ${admins} · 👤 Membres : ${parts.length - admins}`;

      /* ≤ 200 membres : liste COMPLÈTE en groupe.
         > 200 : 50 premiers en groupe + liste COMPLÈTE en DM automatique
         au demandeur (paquets < 60 000 chars, repli LID → PN). */
      if (parts.length <= 200) {
        await c.reply(buildFrame(`MEMBRES (${parts.length})`, [...parts.map(line), '', counters]));
        return;
      }

      const rows = parts.map(line);
      const header = `👥 MEMBRES (${parts.length}) — liste complète\n\n`;
      const chunks = [];
      let cur = '';
      for (const r of rows) {
        if (cur.length + r.length + 1 > 60000) { chunks.push(cur); cur = ''; }
        cur += r + '\n';
      }
      if (cur) chunks.push(cur);

      const pn = c.msg?.key?.participantPn || c.msg?.key?.senderPn || null;
      let dmOk = false;
      for (const target of [c.sender, pn].filter(Boolean)) {
        let ok = true;
        for (let i = 0; i < chunks.length; i++) {
          const body =
            (i === 0 ? header : `👥 MEMBRES (${parts.length}) — suite ${i + 1}/${chunks.length}\n\n`) +
            chunks[i].trimEnd() +
            (i === chunks.length - 1 ? `\n\n${counters}` : '');
          try {
            await send(c.sock, target, { text: body });
            await new Promise((r) => setTimeout(r, 350));
          } catch { ok = false; break; }
        }
        if (ok) { dmOk = true; break; }
      }

      const rest = parts.length - 50;
      await c.reply(buildFrame(`MEMBRES (${parts.length})`, [
        ...rows.slice(0, 50),
        '',
        `… et ${rest} autres membres`,
        dmOk ? '📩 Liste complète envoyée en DM.' : '⚠️ DM indisponible — 50 premiers affichés ici.',
        '',
        counters,
      ]));
    } catch (e) { await c.error(['LISTMEMBERS ÉCHEC', e.message]); }
  });

  /* ── LOCK / UNLOCK ── */
  cmd('lock', { cat: 2, desc: 'Verrouiller le groupe (admins)', usage: 'lock', group: true, admin: true, botAdmin: true, icon: '🔒' }, async (c) => {
    try { await c.sock.groupSettingUpdate(c.from, 'locked'); await c.success(['GROUPE VERROUILLÉ']); } catch (e) { await c.error(['LOCK ÉCHEC', e.message]); }
  });
  cmd('unlock', { cat: 2, desc: 'Déverrouiller le groupe', usage: 'unlock', group: true, admin: true, botAdmin: true, icon: '🔓' }, async (c) => {
    try { await c.sock.groupSettingUpdate(c.from, 'unlocked'); await c.success(['GROUPE DÉVERROUILLÉ']); } catch (e) { await c.error(['UNLOCK ÉCHEC', e.message]); }
  });

  /* ── GROUPRULES ── */
  const groupRules = new Map();
  cmd('grouprules', { cat: 2, desc: 'Règles du groupe', usage: 'grouprules [définir|règles]', group: true, admin: true, icon: '📜' }, async (c) => {
    const q = (c.q || '').trim();
    if (q.startsWith('définir') || q.startsWith('set')) {
      const rules = q.replace(/^(définir|set)\s*/i, '').trim();
      if (!rules) return c.error(['USAGE', `${config.prefix}GROUPRULES DÉFINIR <RÈGLES>`]);
      groupRules.set(c.from, rules);
      return c.success(['RÈGLES ENREGISTRÉES']);
    }
    const r = groupRules.get(c.from);
    if (!r) return c.error(['AUCUNE RÈGLE', `${config.prefix}GROUPRULES DÉFINIR <RÈGLES>`]);
    await c.reply(buildFrame('RÈGLES DU GROUPE', [r]));
  });

  /* ── GROUPBACKUP ── */
  cmd('groupbackup', { cat: 2, desc: 'Sauvegarde des infos du groupe', usage: 'groupbackup', group: true, icon: '💾' }, async (c) => {
    try {
      const meta = await c.sock.groupMetadata(c.from);
      const admins = (meta.participants || []).filter((p) => p.admin).length;
      await c.reply(buildFrame('SAUVEGARDE GROUPE', [
        bullet('NOM', meta.subject || '?'),
        bullet('DESCRIPTION', (meta.desc || '—').slice(0, 200)),
        bullet('MEMBRES', String(meta.participants?.length || 0)),
        bullet('ADMINS', String(admins)),
        bullet('CRÉÉ', meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('fr-FR') : '?'),
      ]));
    } catch (e) { await c.error(['GROUPBACKUP ÉCHEC', e.message]); }
  });

  /* ══════════════ OWNER (cat 9) ══════════════ */

  /* ── SETPREFIX ── */
  cmd('setprefix', { cat: 9, desc: 'Changer le préfixe', usage: 'setprefix <caractère>', owner: true, icon: '🔤' }, async (c) => {
    const p = (c.args[0] || '').trim();
    if (!p || p.length > 2) return c.error(['USAGE', `${config.prefix}SETPREFIX <CARACTÈRE>`]);
    config.prefix = p;
    await c.success([`PRÉFIXE → ${p}`]);
  });

  /* ── DMALL ── */
  cmd('dmall', { cat: 9, desc: 'Message privé à tous les membres', usage: 'dmall <message>', group: true, owner: true, icon: '📩' }, async (c) => {
    const msg = c.q || '';
    if (!msg) return c.error(['USAGE', `${config.prefix}DMALL <MESSAGE>`]);
    try {
      const meta = await c.sock.groupMetadata(c.from);
      const members = (meta.participants || []).map((p) => p.id).filter((j) => j && j !== c.sock.user?.id);
      let sent = 0;
      for (const m of members) { try { await send(c.sock, m, { text: msg }); sent += 1; } catch {} }
      await c.success([`MESSAGE ENVOYÉ À ${sent}/${members.length} MEMBRES`]);
    } catch (e) { await c.error(['DMALL ÉCHEC', e.message]); }
  });

  /* ══════════════ MÉDIA (cat 4) ══════════════ */

  /* ── TOGIF ── */
  cmd('togif', { cat: 4, desc: 'Vidéo → GIF', usage: 'togif (répondre vidéo)', icon: '🎞️' }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info || !String(info.mimetype || '').startsWith('video/')) return c.error(['RÉPONDS À UNE VIDÉO']);
    try {
      const buf = await downloadFrom(c.sock, info);
      const gif = await sharp(buf, { animated: true }).gif().toBuffer();
      await send(c.sock, c.from, { gif, caption: '🎞️ GIF' }, { quoted: c.msg });
    } catch (e) { await c.error(['TOGIF ÉCHEC', e.message]); }
  });

  /* ── TOJPEG ── */
  cmd('tojpeg', { cat: 4, desc: 'Image → JPEG', usage: 'tojpeg (répondre image)', icon: '📷' }, async (c) => {
    const info = mediaInfo(c.msg);
    if (!info || !String(info.mimetype || '').startsWith('image/')) return c.error(['RÉPONDS À UNE IMAGE']);
    try {
      const buf = await downloadFrom(c.sock, info);
      const jpg = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
      await send(c.sock, c.from, { image: jpg, caption: '📷 JPEG' }, { quoted: c.msg });
    } catch (e) { await c.error(['TOJPEG ÉCHEC', e.message]); }
  });

  /* ── TEXTSTICKER ── */
  cmd('textsticker', ['tsticker'], { cat: 4, desc: 'Texte → sticker', usage: 'textsticker <texte>', icon: '✏️' }, async (c) => {
    const t = c.q || '';
    if (!t) return c.error(['USAGE', `${config.prefix}TEXTSTICKER <TEXTE>`]);
    const esc = (s) => String(s).slice(0, 40)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const svg = Buffer.from(
      `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#000"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="48" font-family="Arial Black, Arial, sans-serif" fill="#fff" stroke="#000" stroke-width="6" paint-order="stroke">${esc(t)}</text>
      </svg>`
    );
    try {
      const webp = await sharp(Buffer.from(svg)).webp().toBuffer();
      const sticker = new Sticker(webp, { pack: config.packname, author: config.author, type: StickerTypes.FULL, quality: 80 });
      await send(c.sock, c.from, { sticker: await sticker.toBuffer() }, { quoted: c.msg });
    } catch (e) { await c.error(['TEXTSTICKER ÉCHEC', e.message]); }
  });
}

module.exports = { registerExtras };
