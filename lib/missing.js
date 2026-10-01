'use strict';
/**
 * Fonctionnalités Baileys encore manquantes (SAUF boutons / listes interactives)
 * Chaque commande tente l’API native ; si absente → message d’erreur clair.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { send } = require('./wa-send');
const presence = require('./presence');
const { SETTERS, parseSet } = require('./privacy');
const { extractInviteCode } = require('./invite');
const labels = require('./labels');
const { textOf } = require('../guard/src/utils/message');

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
    cat: 9, desc: 'Infos d’un channel (live abonnés + admins)', usage: 'chinfo <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHINFO ID@NEWSLETTER`]);
    try {
      let meta;
      if (typeof c.sock.newsletterMetadata === 'function') meta = await c.sock.newsletterMetadata('jid', id);
      else if (c.sock.newsletter?.metadata) meta = await c.sock.newsletter.metadata(id);
      else return c.error(['API NEWSLETTERMETADATA ABSENTE']);
      let subs = String(meta?.subscribersCount || meta?.subscribers || '?');
      if (typeof c.sock.newsletterSubscribers === 'function') {
        try {
          const s = await c.sock.newsletterSubscribers(id);
          if (s?.subscribers !== undefined) subs = String(s.subscribers);
        } catch (_) { /* repli sur la métadonnée */ }
      }
      let admins = '—';
      if (typeof c.sock.newsletterAdminCount === 'function') {
        try { admins = String(await c.sock.newsletterAdminCount(id)); } catch (_) { /* affiché « — » */ }
      }
      let live = '—';
      if (typeof c.sock.subscribeNewsletterUpdates === 'function') {
        try {
          const u = await c.sock.subscribeNewsletterUpdates(id);
          live = String(u?.duration || '—');
        } catch (_) { /* affiché « — » */ }
      }
      await c.reply(
        buildFrame('CHANNEL', [
          bullet('ID', id),
          bullet('NOM', meta?.name || meta?.subject || '?'),
          bullet('DESC', String(meta?.description || meta?.desc || '—').slice(0, 120)),
          bullet('ABONNÉS', subs),
          bullet('ADMINS', admins),
          bullet('UPDATES', live),
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

  cmd('chrename', {
    cat: 9, desc: 'Renommer un channel', usage: 'chrename <id@newsletter> <nom>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    const name = c.args.slice(1).join(' ').trim();
    if (!id.includes('@newsletter') || !name) {
      return c.error(['USAGE', `${config.prefix}CHRENAME ID@NEWSLETTER NOUVEAU NOM`]);
    }
    try {
      if (typeof c.sock.newsletterUpdateName !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERUPDATENAME']);
      await c.sock.newsletterUpdateName(id, name.slice(0, 30));
      await c.success(['NOM DU CHANNEL →', name.slice(0, 30)]);
    } catch (e) {
      await c.error(['CHRENAME', e.message]);
    }
  });

  cmd('chdesc', {
    cat: 9, desc: 'Description du channel', usage: 'chdesc <id@newsletter> <texte>', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    const d = c.args.slice(1).join(' ').trim();
    if (!id.includes('@newsletter') || !d) {
      return c.error(['USAGE', `${config.prefix}CHDESC ID@NEWSLETTER TEXTE`]);
    }
    try {
      if (typeof c.sock.newsletterUpdateDescription !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERUPDATEDESCRIPTION']);
      await c.sock.newsletterUpdateDescription(id, d.slice(0, 500));
      await c.success(['DESCRIPTION MISE À JOUR']);
    } catch (e) {
      await c.error(['CHDESC', e.message]);
    }
  });

  cmd('chpic', {
    cat: 9, desc: 'Photo du channel (image en réponse) ou delete',
    usage: 'chpic <id@newsletter> (image) · chpic delete <id@newsletter>', owner: true, icon: '📢',
  }, async (c) => {
    if ((c.args[0] || '').toLowerCase() === 'delete') {
      const id = (c.args[1] || '').trim();
      if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHPIC DELETE ID@NEWSLETTER`]);
      try {
        if (typeof c.sock.newsletterRemovePicture !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERREMOVEPICTURE']);
        await c.sock.newsletterRemovePicture(id);
        await c.success(['PHOTO DU CHANNEL RETIRÉE']);
      } catch (e) {
        await c.error(['CHPIC', e.message]);
      }
      return;
    }
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHPIC ID@NEWSLETTER (IMAGE EN RÉPONSE)`]);
    const info = mediaInfo(c.msg);
    if (!info?.mimetype?.startsWith('image/')) return c.error(['RÉPONDS À UNE IMAGE']);
    try {
      if (typeof c.sock.newsletterUpdatePicture !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERUPDATEPICTURE']);
      const buf = await downloadFrom(c.sock, info);
      await c.sock.newsletterUpdatePicture(id, buf);
      await c.success(['PHOTO DU CHANNEL MISE À JOUR']);
    } catch (e) {
      await c.error(['CHPIC', e.message]);
    }
  });

  cmd('chdel', {
    cat: 9, desc: 'Supprimer un channel (irréversible)', usage: 'chdel <id@newsletter> confirm', owner: true, icon: '⚠️',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    if (!id.includes('@newsletter') || (c.args[1] || '').toLowerCase() !== 'confirm') {
      return c.error(['CONFIRMATION REQUISE', `${config.prefix}CHDEL ID@NEWSLETTER CONFIRM`]);
    }
    try {
      if (typeof c.sock.newsletterDelete !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERDELETE']);
      await c.sock.newsletterDelete(id);
      await c.success(['CHANNEL SUPPRIMÉ', id]);
    } catch (e) {
      await c.error(['CHDEL', e.message]);
    }
  });

  cmd('chowner', {
    cat: 9, desc: 'Transférer la propriété du channel', usage: 'chowner <id@newsletter> @user', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!id.includes('@newsletter') || !mention.length) {
      return c.error(['USAGE', `${config.prefix}CHOWNER ID@NEWSLETTER @USER`]);
    }
    try {
      if (typeof c.sock.newsletterChangeOwner !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERCHANGEOWNER']);
      await c.sock.newsletterChangeOwner(id, mention[0]);
      await c.success(['NOUVEAU PROPRIÉTAIRE', String(mention[0]).split('@')[0].split(':')[0]]);
    } catch (e) {
      await c.error(['CHOWNER', e.message]);
    }
  });

  cmd('chdemote', {
    cat: 9, desc: 'Rétrograder un admin du channel', usage: 'chdemote <id@newsletter> @user', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!id.includes('@newsletter') || !mention.length) {
      return c.error(['USAGE', `${config.prefix}CHDEMOTE ID@NEWSLETTER @USER`]);
    }
    try {
      if (typeof c.sock.newsletterDemote !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERDEMOTE']);
      await c.sock.newsletterDemote(id, mention[0]);
      await c.success(['ADMIN RÉTROGRADÉ']);
    } catch (e) {
      await c.error(['CHDEMOTE', e.message]);
    }
  });

  cmd('chfetch', {
    cat: 9, desc: 'Derniers messages d’un channel', usage: 'chfetch <id@newsletter> [1-20]', owner: true, icon: '📢',
  }, async (c) => {
    const id = (c.args[0] || '').trim();
    const n = Math.max(1, Math.min(20, parseInt(c.args[1], 10) || 5));
    if (!id.includes('@newsletter')) return c.error(['USAGE', `${config.prefix}CHFETCH ID@NEWSLETTER 5`]);
    try {
      if (typeof c.sock.newsletterFetchMessages !== 'function') return c.error(['API ABSENTE', 'NEWSLETTERFETCHMESSAGES']);
      const msgs = (await c.sock.newsletterFetchMessages(id, n, 0, 0)) || [];
      const lines = [bullet('MESSAGES', String(msgs.length))];
      msgs.slice(0, n).forEach((m, i) => {
        const t = textOf(m?.message).replace(/\s+/g, ' ').slice(0, 80) || '(média)';
        lines.push(bullet(String(i + 1), t));
      });
      await c.reply(buildFrame('CHANNEL — DERNIERS', lines));
    } catch (e) {
      await c.error(['CHFETCH', e.message]);
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
    cat: 9, desc: 'Réglages privacy : lecture + écriture', usage: 'privacy [set <clé> <valeur>]', owner: true, icon: '🔒',
  }, async (c) => {
    const sub = (c.args[0] || '').toLowerCase();

    /* .privacy set <clé> <valeur> → setter Baileys (update*Privacy) */
    if (sub === 'set') {
      const r = parseSet(c.args.slice(1));
      if (!r.ok) {
        if (r.error === 'MISSING') return c.error(['USAGE', `${config.prefix}PRIVACY SET LASTSEEN ALL`]);
        if (r.error === 'KEY') return c.error(['CLÉ INCONNUE', `CLÉS : ${r.allowed.join(', ')}`]);
        return c.error([`VALEUR « ${r.raw} » REFUSÉE POUR ${r.key}`, `ACCEPTÉ : ${r.allowed.join(', ')}`]);
      }
      try {
        if (typeof c.sock[r.entry.fn] !== 'function') return c.error(['API ABSENTE', r.entry.fn]);
        await c.sock[r.entry.fn](r.arg);
        await c.success([`${r.key.toUpperCase()} → ${String(r.raw).toUpperCase()}`]);
      } catch (e) {
        await c.error(['PRIVACY', e.message]);
      }
      return;
    }
    if (sub && sub !== 'get') {
      return c.error(['USAGE', `${config.prefix}PRIVACY  OU  ${config.prefix}PRIVACY SET ${Object.keys(SETTERS).join('|')} <VALEUR>`]);
    }
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
        note(toUnicode(`SET : ${Object.keys(SETTERS).join(', ')}`)),
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

  /* ═══════════════ INVITATIONS V4 / ORDRES / FAVORIS / BOTS ═══════════════ */

  cmd('joinv4', {
    cat: 2, desc: "Accepter une invitation V4 (répondre à la carte)",
    usage: "joinv4 (répondre à une carte d'invitation)", icon: '🚪',
  }, async (c) => {
    const q = c.msg.message?.extendedTextMessage?.contextInfo;
    const invite = q?.quotedMessage?.groupInviteMessage;
    if (!q?.stanzaId || !invite) {
      return c.error(['USAGE', `RÉPONDS À UNE CARTE D'INVITATION : ${config.prefix}JOINV4`]);
    }
    const key = { id: q.stanzaId, remoteJid: c.from, fromMe: false };
    try {
      if (typeof c.sock.groupAcceptInviteV4 === 'function') {
        const jid = await c.sock.groupAcceptInviteV4(key, invite);
        await c.success(['INVITATION ACCEPTÉE', jid ? String(jid) : '']);
        return;
      }
      if (typeof c.sock.communityAcceptInviteV4 === 'function') {
        const jid = await c.sock.communityAcceptInviteV4(key, invite);
        await c.success(['INVITATION ACCEPTÉE', jid ? String(jid) : '']);
        return;
      }
      return c.error(['API ABSENTE', 'ACCEPTINVITEV4']);
    } catch (e) {
      await c.error(['JOINV4', e.message]);
    }
  });

  cmd('revokev4', {
    cat: 2, desc: "Retirer l'invitation V4 d'un membre", usage: 'revokev4 @user',
    group: true, admin: true, icon: '🚪',
  }, async (c) => {
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mention.length) return c.error(['USAGE', `${config.prefix}REVOKEV4 @USER`]);
    try {
      let ok;
      if (typeof c.sock.groupRevokeInviteV4 === 'function') {
        ok = await c.sock.groupRevokeInviteV4(c.from, mention[0]);
      } else if (typeof c.sock.communityRevokeInviteV4 === 'function') {
        ok = await c.sock.communityRevokeInviteV4(c.from, mention[0]);
      } else {
        return c.error(['API ABSENTE', 'REVOKEINVITEV4']);
      }
      await c.success([ok === false ? 'INVITATION NON RETIRÉE' : 'INVITATION RETIRÉE']);
    } catch (e) {
      await c.error(['REVOKEV4', e.message]);
    }
  });

  cmd('orderinfo', {
    cat: 9, desc: 'Détails d’une commande (répondre à la carte)', usage: 'orderinfo (répondre à la carte de commande)',
    owner: true, icon: '📦',
  }, async (c) => {
    const q = c.msg.message?.extendedTextMessage?.contextInfo;
    const order = q?.quotedMessage?.orderMessage;
    if (!q?.stanzaId || !order?.orderId) {
      return c.error(['USAGE', `RÉPONDS À UNE CARTE DE COMMANDE : ${config.prefix}ORDERINFO`]);
    }
    try {
      const lines = [
        bullet('TITRE', String(order.orderTitle || '—')),
        bullet('ARTICLES', String(order.itemCount ?? '—')),
        bullet('ID', String(order.orderId)),
      ];
      if (typeof c.sock.getOrderDetails === 'function') {
        try {
          const d = await c.sock.getOrderDetails(String(order.orderId), String(order.token || ''));
          if (d?.price) lines.push(bullet('TOTAL', `${d.price.total} ${d.price.currency}`));
          if (d?.products?.length) {
            d.products.slice(0, 10).forEach((p, i) =>
              lines.push(bullet(String(i + 1), `${p.name || p.id || '?'} ×${p.quantity ?? '?'}`)));
          }
        } catch (de) {
          lines.push(note(toUnicode(`DÉTAILS INDISPONIBLES : ${String(de.message).slice(0, 60)}`)));
        }
      }
      await c.reply(buildFrame('COMMANDE', lines));
    } catch (e) {
      await c.error(['ORDERINFO', e.message]);
    }
  });

  const starSet = async (c, on) => {
    const q = c.msg.message?.extendedTextMessage?.contextInfo;
    if (!q?.stanzaId) {
      return c.error(['USAGE', `RÉPONDS À UN MESSAGE : ${config.prefix}${on ? 'STAR' : 'UNSTAR'}`]);
    }
    try {
      if (typeof c.sock.star !== 'function') return c.error(['API ABSENTE', 'STAR']);
      await c.sock.star(c.from, [{ id: q.stanzaId }], on);
      await c.success([on ? 'MESSAGE ÉPINGLÉ (FAVORI)' : 'MESSAGE DÉÉPINGLÉ']);
    } catch (e) {
      await c.error(['STAR', e.message]);
    }
  };

  cmd('star', {
    cat: 5, desc: 'Épingler un message en favori (répondre)', usage: 'star (répondre)', icon: '⭐',
  }, async (c) => starSet(c, true));

  cmd('unstar', {
    cat: 5, desc: 'Retirer un message des favoris (répondre)', usage: 'unstar (répondre)', icon: '⭐',
  }, async (c) => starSet(c, false));

  cmd('bots', {
    cat: 9, desc: 'Bots liés au compte (appareils liés)', owner: true, icon: '🤖',
  }, async (c) => {
    try {
      if (typeof c.sock.getBotListV2 !== 'function') return c.error(['API ABSENTE', 'GETBOTLISTV2']);
      const list = (await c.sock.getBotListV2()) || [];
      const lines = [bullet('BOTS', String(list.length))];
      list.slice(0, 20).forEach((b, i) =>
        lines.push(bullet(String(i + 1), `${b.botName || '?'} — ${String(b.jid || '').split('@')[0]}`)));
      await c.reply(buildFrame('BOTS LIÉS', lines));
    } catch (e) {
      await c.error(['BOTS', e.message]);
    }
  });

  /* ═══════════════ SESSION / LISTES / GROUPES (Baileys) ═══════════════ */

  cmd('logout', {
    cat: 9, desc: 'Déconnecter le bot du WhatsApp', usage: 'logout confirm', owner: true, icon: '⏏️',
  }, async (c) => {
    if ((c.args[0] || '').toLowerCase() !== 'confirm') {
      return c.error(['CONFIRMATION REQUISE', `${config.prefix}LOGOUT CONFIRM`]);
    }
    try {
      await c.sock.logout();
      await c.success([
        'SESSION TERMINÉE',
        'SUPPRIME LE DOSSIER SESSION/ PUIS REDÉMARRA LE BOT',
        'RESCANNE LE QR : WHATSAPP → APPAREILS LIÉS',
      ]);
    } catch (e) {
      await c.error(['LOGOUT', e.message]);
    }
  });

  cmd('blocklist', {
    cat: 9, desc: 'Numéros bloqués par le bot', owner: true, icon: '🚫',
  }, async (c) => {
    try {
      if (typeof c.sock.fetchBlocklist !== 'function') return c.error(['API ABSENTE', 'FETCHBLOCKLIST']);
      const list = (await c.sock.fetchBlocklist()) || [];
      const nums = list
        .filter(Boolean)
        .map((j) => String(j).split('@')[0].split(':')[0]);
      const lines = [bullet('TOTAL', String(nums.length))];
      for (const n of nums.slice(0, 50)) lines.push(bullet('NUM', n));
      if (nums.length > 50) lines.push(note(toUnicode(`+${nums.length - 50} AUTRES`)));
      await c.reply(buildFrame('BLOCKLIST', lines));
    } catch (e) {
      await c.error(['BLOCKLIST', e.message]);
    }
  });

  cmd('mygroups', {
    cat: 2, desc: 'Tous les groupes où est le bot', icon: '📋',
  }, async (c) => {
    try {
      if (typeof c.sock.groupFetchAllParticipating !== 'function') {
        return c.error(['API ABSENTE', 'GROUPFETCHALLPARTICIPATING']);
      }
      const map = await c.sock.groupFetchAllParticipating();
      const items = Object.values(map || {});
      const lines = [bullet('GROUPES', String(items.length))];
      for (const g of items.slice(0, 30)) {
        lines.push(bullet(`${g.participants?.length || 0}👤`, `${g.subject || '?'} — ${String(g.id || '').split('@')[0]}`));
      }
      if (items.length > 30) lines.push(note(toUnicode(`+${items.length - 30} AUTRES GROUPES`)));
      await c.reply(buildFrame('MES GROUPS', lines));
    } catch (e) {
      await c.error(['MYGROUPS', e.message]);
    }
  });

  cmd('inviteinfo', {
    cat: 2, desc: "Infos d'un lien d'invitation", usage: 'inviteinfo <lien|code>', icon: '🔍',
  }, async (c) => {
    const code = extractInviteCode(c.q);
    if (!code) return c.error(['USAGE', `${config.prefix}INVITEINFO HTTPS://CHAT.WHATSAPP.COM/XXX`]);
    try {
      if (typeof c.sock.groupGetInviteInfo !== 'function') return c.error(['API ABSENTE', 'GROUPGETINVITEINFO']);
      const meta = await c.sock.groupGetInviteInfo(code);
      await c.reply(buildFrame('INVITATION', [
        bullet('NOM', meta.subject || '?'),
        bullet('ID', String(meta.id || '?')),
        bullet('OWNER', meta.owner || meta.subjectOwner || '?'),
        bullet('MEMBRES', String(meta.participants?.length || 0)),
        bullet('DESC', String(meta.desc || '—').slice(0, 120)),
        bullet('ANNONCES', meta.announce ? 'OUI' : 'NON'),
        bullet('ENTRÉE', meta.joinApprovalMode === undefined ? '—' : (meta.joinApprovalMode ? 'SUR APPROBATION' : 'LIBRE')),
      ]));
    } catch (e) {
      await c.error(['INVITEINFO', e.message]);
    }
  });

  cmd('joinmode', {
    cat: 2, desc: 'Entrée des membres sur approbation', usage: 'joinmode on|off',
    group: true, admin: true, botAdmin: true, icon: '🚪',
  }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}JOINMODE ON|OFF`]);
    try {
      if (typeof c.sock.groupJoinApprovalMode !== 'function') return c.error(['API ABSENTE', 'GROUPJOINAPPROVALMODE']);
      await c.sock.groupJoinApprovalMode(c.from, v);
      await c.success([`ENTRÉE SUR APPROBATION : ${v === 'on' ? 'ACTIVÉE' : 'DÉSACTIVÉE'}`]);
    } catch (e) {
      await c.error(['JOINMODE', e.message]);
    }
  });

  cmd('addmode', {
    cat: 2, desc: 'Qui peut ajouter des membres', usage: 'addmode all|admins',
    group: true, admin: true, botAdmin: true, icon: '➕',
  }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    const map = { all: 'all_member_add', admins: 'admin_add' };
    if (!(v in map)) return c.error(['USAGE', `${config.prefix}ADDMODE ALL|ADMINS`]);
    try {
      if (typeof c.sock.groupMemberAddMode !== 'function') return c.error(['API ABSENTE', 'GROUPMEMBERADDMODE']);
      await c.sock.groupMemberAddMode(c.from, map[v]);
      await c.success([`AJOUT DE MEMBRES : ${v === 'all' ? 'TOUS' : 'ADMINS SEULEMENT'}`]);
    } catch (e) {
      await c.error(['ADDMODE', e.message]);
    }
  });

  /* ── Présence en direct : presence.subscribe + presence.update ── */
  cmd('seen', {
    cat: 5, desc: "Présence en direct d'un contact", usage: 'seen @mention|numéro', icon: '👁️',
  }, async (c) => {
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const num = String(c.args[0] || '').replace(/\D/g, '');
    const target = mention[0] || (num.length >= 8 ? `${num}@s.whatsapp.net` : null);
    if (!target) return c.error(['USAGE', `${config.prefix}SEEN @OU NUMERO`]);
    try {
      if (typeof c.sock.presenceSubscribe !== 'function') return c.error(['API ABSENTE', 'PRESENCESUBSCRIBE']);
      const waiter = presence.track(target, 8000);
      await c.sock.presenceSubscribe(target);
      const shown = String(target).split('@')[0].split(':')[0];
      await c.reply(`⏳ Abonnement à la présence de ${shown} (8 s max)…`);
      const state = await waiter;
      if (!state) {
        return c.error(['AUCUNE DONNÉE REÇUE', 'HORS LIGNE OU PRÉSENCE NON PARTAGÉE']);
      }
      await c.reply(buildFrame('PRÉSENCE', [
        bullet('NUMÉRO', shown),
        bullet('ÉTAT', presence.label(state)),
      ]));
    } catch (e) {
      await c.error(['SEEN', e.message]);
    }
  });

  /* ═══════════════ CATALOGUE BUSINESS (catalogue produits) ═══════════════ */

  cmd('mycatalog', {
    cat: 9, desc: 'Catalogue produits (WhatsApp Business)',
    usage: 'mycatalog · add <nom> | <prix> | <desc> · del <id> · edit <id> · collections',
    owner: true, icon: '🏷️',
  }, async (c) => {
    const sub = (c.args[0] || '').toLowerCase();
    const priceOf = (raw) => {
      const m = String(raw || '').match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-z]{3})?$/);
      return m ? { price: parseFloat(m[1].replace(',', '.')), currency: (m[2] || 'XAF').toUpperCase() } : null;
    };
    const imageOf = async () => {
      const info = mediaInfo(c.msg);
      if (!info?.mimetype?.startsWith('image/')) return [];
      return [await downloadFrom(c.sock, info)];
    };
    try {
      if (!sub || sub === 'list') {
        if (typeof c.sock.getCatalog !== 'function') return c.error(['API ABSENTE', 'GETCATALOG']);
        const res = await c.sock.getCatalog({ limit: 20 });
        const products = res?.products || [];
        if (!products.length) return c.reply('🏷️ Catalogue vide.');
        const lines = [bullet('TOTAL', String(products.length))];
        products.forEach((p, i) => lines.push(bullet(String(i + 1), `${p.name} — ${p.price} ${p.currency} (${p.id})`)));
        await c.reply(buildFrame('CATALOGUE', lines));
        return;
      }
      if (sub === 'add') {
        const parts = c.q.replace(/^\s*add\s+/i, '').split('|').map((s) => s.trim());
        if (parts.length < 3) return c.error(['USAGE', `${config.prefix}MYCATALOG ADD NOM | 1500 XAF | DESCRIPTION`]);
        const price = priceOf(parts[1]);
        if (!price) return c.error(['PRIX INVALIDE', 'EX : 1500 XAF']);
        if (typeof c.sock.productCreate !== 'function') return c.error(['API ABSENTE', 'PRODUCTCREATE']);
        const p = await c.sock.productCreate({
          name: parts[0].slice(0, 100),
          description: (parts[2] || '').slice(0, 500),
          price: price.price,
          currency: price.currency,
          images: await imageOf(),
          originCountryCode: undefined,
          retailerId: `dj_${Date.now()}`,
        });
        await c.success(['PRODUIT CRÉÉ', p?.id || '?']);
        return;
      }
      if (sub === 'del' || sub === 'delete') {
        const id = (c.args[1] || '').trim();
        if (!id) return c.error(['USAGE', `${config.prefix}MYCATALOG DEL ID`]);
        if (typeof c.sock.productDelete !== 'function') return c.error(['API ABSENTE', 'PRODUCTDELETE']);
        const r = await c.sock.productDelete([id]);
        await c.success(['PRODUIT SUPPRIMÉ', `TOTAL ${r?.deleted ?? 1}`]);
        return;
      }
      if (sub === 'edit') {
        const parts = c.q.replace(/^\s*edit\s+/i, '').split('|').map((s) => s.trim());
        if (parts.length < 4) {
          return c.error(['USAGE', `${config.prefix}MYCATALOG EDIT ID | NOM | 1500 XAF | DESCRIPTION`]);
        }
        const price = priceOf(parts[2]);
        if (!price) return c.error(['PRIX INVALIDE', 'EX : 1500 XAF']);
        if (typeof c.sock.productUpdate !== 'function') return c.error(['API ABSENTE', 'PRODUCTUPDATE']);
        const p = await c.sock.productUpdate(parts[0], {
          name: parts[1].slice(0, 100),
          description: (parts[3] || '').slice(0, 500),
          price: price.price,
          currency: price.currency,
          images: await imageOf(),
        });
        await c.success(['PRODUIT MODIFIÉ', p?.id || parts[0]]);
        return;
      }
      if (sub === 'collections') {
        if (typeof c.sock.getCollections !== 'function') return c.error(['API ABSENTE', 'GETCOLLECTIONS']);
        const res = await c.sock.getCollections();
        const cols = res?.collections || [];
        if (!cols.length) return c.reply('🏷️ Aucune collection.');
        const lines = [bullet('COLLECTIONS', String(cols.length))];
        cols.slice(0, 20).forEach((col, i) =>
          lines.push(bullet(String(i + 1), `${col.name || '?'} — ${(col.products || []).length} produit(s)`)));
        await c.reply(buildFrame('COLLECTIONS', lines));
        return;
      }
      await c.error(['USAGE', `${config.prefix}MYCATALOG [LIST|ADD|DEL|EDIT|COLLECTIONS]`]);
    } catch (e) {
      await c.error(['MYCATALOG', e.message]);
    }
  });

  /* ── Étiquettes (labels) — comptes WhatsApp Business ── */
  cmd('label', {
    cat: 9, desc: 'Étiquettes Business (chat / message)',
    usage: 'label list [@chat] · add|rem <@chat> <id> · msg|msgrem <id> (répondre) · create <id> <nom>',
    owner: true, icon: '🏷️',
  }, async (c) => {
    const sub = (c.args[0] || '').toLowerCase();
    const mention = c.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedId = c.msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    try {
      if (sub === 'create') {
        const [, id, name, color] = c.args;
        if (!id || !name) return c.error(['USAGE', `${config.prefix}LABEL CREATE 42 NOUVEAU 5`]);
        if (typeof c.sock.addLabel !== 'function') return c.error(['API ABSENTE', 'ADDLABEL']);
        await c.sock.addLabel(c.from, {
          id,
          name: name.slice(0, 40),
          color: Math.max(0, Math.min(19, (parseInt(color, 10) || 1) - 1)),
        });
        await c.success([`ÉTIQUETTE « ${name} » CRÉÉE`, `ID ${id}`]);
        return;
      }
      if (sub === 'add' || sub === 'rem') {
        const digits = String(c.args[1] || '').replace(/\D/g, '');
        const target = mention[0] || (digits.length >= 8 ? `${digits}@s.whatsapp.net` : null);
        const labelId = c.args[c.args.length - 1];
        if (!target || !labelId || labelId === sub) {
          return c.error(['USAGE', `${config.prefix}LABEL ${sub.toUpperCase()} @CHAT 42`]);
        }
        const fn = sub === 'add' ? 'addChatLabel' : 'removeChatLabel';
        if (typeof c.sock[fn] !== 'function') return c.error(['API ABSENTE', fn.toUpperCase()]);
        await c.sock[fn](target, labelId);
        await c.success([sub === 'add' ? 'ÉTIQUETTE AJOUTÉE AU CHAT' : 'ÉTIQUETTE RETIRÉE DU CHAT', `ID ${labelId}`]);
        return;
      }
      if (sub === 'msg' || sub === 'msgrem') {
        const labelId = c.args[1];
        if (!quotedId || !labelId) {
          return c.error(['USAGE', `RÉPONDS À UN MESSAGE : ${config.prefix}LABEL MSG 42`]);
        }
        const fn = sub === 'msg' ? 'addMessageLabel' : 'removeMessageLabel';
        if (typeof c.sock[fn] !== 'function') return c.error(['API ABSENTE', fn.toUpperCase()]);
        await c.sock[fn](c.from, quotedId, labelId);
        await c.success([sub === 'msg' ? 'ÉTIQUETTE POSÉE SUR LE MESSAGE' : 'ÉTIQUETTE RETIRÉE DU MESSAGE', `ID ${labelId}`]);
        return;
      }
      if (sub === 'list') {
        const chatJid = mention[0] || c.from;
        const items = labels.listFor(chatJid);
        const lines = [bullet('ÉTIQUETTES', String(items.length))];
        items.slice(0, 30).forEach((l, i) => lines.push(bullet(String(i + 1), `${l.name} (ID ${l.id})`)));
        if (!items.length) lines.push(note(toUnicode('CACHE VIDE — REMPLI PAR LES EVENTS LABELS')));
        await c.reply(buildFrame('ÉTIQUETTES', lines));
        return;
      }
      await c.error(['USAGE', `${config.prefix}LABEL LIST [@CHAT] · ADD @CHAT <ID> · MSG <ID> · CREATE <ID> <NOM>`]);
    } catch (e) {
      await c.error(['LABEL', e.message]);
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
