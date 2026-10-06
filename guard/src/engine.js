'use strict';
/**
 * Group Protection Engine : chaque message de groupe passe UNE fois ici.
 * Ordre : passifs → exemptions (bot, owner, admins) → mute → protections actives → sanction.
 */
const config = require('./config');
const { db } = require('./db');
const perms = require('./utils/perms');
const { send } = require('../../lib/wa-send');
const sanctions = require('./sanctions');
const journal = require('./journal');
const ui = require('./ui');
const vigil = require('./vigil');
const PROTECTIONS = require('./protections');

const notified = new Map();       // gid → dernier avis « bot non admin »
const deletedByGuard = new Map(); // id message → ts (pour que l'antidelete ne re-poste pas nos suppressions)

/** Événements qui ne sont PAS du contenu : réactions, révocations, votes… (sinon flood à tort). */
const PASSIVE = new Set(['', 'reactionMessage', 'encReactionMessage', 'protocolMessage', 'pollUpdateMessage', 'keepInChatMessage', 'senderKeyDistributionMessage', 'messageContextInfo']);

const safe = async (p) => { try { return await p; } catch (e) { return null; } };

function markDeleted(id) {
  if (!id) return;
  deletedByGuard.set(id, Date.now());
  if (deletedByGuard.size > 500) deletedByGuard.delete(deletedByGuard.keys().next().value);
}
const wasDeleted = (id) => deletedByGuard.has(id);

async function del(sock, msg, from) {
  markDeleted(msg.key && msg.key.id);
  return safe(send(sock, from, { delete: msg.key }));
}

/**
 * Avis « le bot n'est pas admin ».
 *
 * `extra` sert à rendre le message utile : quand Vigil a répondu, on sait
 * *quelle règle* a décidé et avec quelle sévérité — l'avis cesse d'être
 * un simple « je suis cassé » et devient un vrai constat d'infraction.
 */
async function notifyNotOperational(sock, gid, label, extra = []) {
  const last = notified.get(gid) || 0;
  const cooldown = extra.length ? config.noticeCooldownMs || 60 * 1000 : config.notifyCooldownMs;
  if (Date.now() - last < cooldown) return false;
  notified.set(gid, Date.now());
  await safe(send(sock, gid, {
    text: ui.frame(`${label.toUpperCase()} INACTIF`, [
      '⚠️ INFRACTION DÉTECTÉE, SUPPRESSION IMPOSSIBLE',
      ui.kv('CAUSE', "LE BOT N'EST PAS ADMIN"),
      ...extra,
      ui.kv('SOLUTION', 'PROMOUVEZ LE BOT (REPRISE AUTO)'),
    ]),
  }));
  return true;
}

async function runProtections(ctx) {
  const { sock, msg, from, sender } = ctx;
  if (!from.endsWith('@g.us')) return { handled: false, reason: 'not-group' };
  if (ctx.isBotSelf) return { handled: false, reason: 'bot' };
  if (PASSIVE.has(ctx.type || '') && !ctx.isStatusMention) return { handled: false, reason: 'passive' };

  const g = db().getGroup(from);
  g.stats.messages++;

  const active = PROTECTIONS.filter((p) => g[p.key]);
  const muted = sanctions.isMuted(from, sender);
  if (!active.length && !muted) return { handled: false, reason: 'nothing-active' };

  const meta = ctx.meta || (await perms.groupMeta(sock, from));
  const botAdmin = perms.botIsAdmin(sock, meta);
  if (perms.isParticipantAdmin(meta, sender) || ctx.isOwner) return { handled: false, reason: 'exempt' };

  // Membre muet : tout est supprimé, sans sanction supplémentaire.
  if (muted) {
    if (botAdmin) await del(sock, msg, from);
    return { handled: botAdmin, reason: 'muted' };
  }

  /* ── Second avis : Vigil ──────────────────────────────────────────
     Le moteur local dit « il y a un lien » ; Vigil dit si c'est
     *réellement* une infraction, avec quelle règle et quelle sévérité.
     `null` = Vigil muet (inactif, éteint, timeout) → on repart de
     l'avis local, sans délai ajouté.

     Mémorisé : au plus UN appel réseau par message, même si plusieurs
     protections se déclenchent en mode `veto`.                       */
  let verdict = null;
  let verdictAsked = false;

  for (const p of active) {
    const v = p.detect(ctx, g);
    if (!v) continue;

    if (!verdictAsked) {
      verdictAsked = true;
      verdict = await vigil.judge(ctx.text, { channel: from, subject: ctx.senderNum });
      // En mode `veto`, un « propre » signifie qu'on s'était trompé :
      // la protection locale n'a pas à sanctionner.
      if (verdict && verdict.clean && vigil.vetoEnabled()) continue;
    }

    // Ce qu'on peut afficher quand Vigil a vraiment décidé.
    const vigiLines = verdict && verdict.rule
      ? [
          ui.kv('RÈGLE', `${verdict.rule.name} (#${verdict.rule.priority})`),
          ui.kv('SÉVÉRITÉ', String(verdict.severity || '—').toUpperCase()),
        ]
      : [];

    if (!botAdmin) {
      // Sans admin on ne supprime rien — mais on n'est plus muet : on dit
      // au moins *quelle règle* est tombée, et pourquoi on n'a rien fait.
      await notifyNotOperational(sock, from, p.label, vigiLines);
      return { handled: false, reason: 'bot-not-admin', protection: p.key };
    }

    await del(sock, msg, from);
    g.stats[p.key]++;
    g.stats.deleted++;

    const mode = (g.sanctions && g.sanctions[p.key]) || p.defaultSanction || g.sanction;
    const lines = [
      `👤 @${ctx.senderNum}`,
      ui.kv('INFRACTION', v.reason),
      // La règle Vigil et sa sévérité, quand le pont a répondu.
      ...vigiLines,
      ui.kv('ACTION', 'MESSAGE SUPPRIMÉ'),
    ];
    let kicked = false;
    if (mode === 'warn') {
      const r = await sanctions.warn(sock, from, sender, g, botAdmin);
      lines.push(ui.kv('AVERTISSEMENT', `${Math.min(r.count, r.limit)}/${r.limit}`));
      if (r.escalated === 'kick') { lines.push(ui.kv('SANCTION', 'EXPULSION')); kicked = true; }
      if (r.escalated === 'mute') lines.push(ui.kv('SANCTION', `MUET ${g.muteMinutes} MIN`));
    } else if (mode === 'kick') {
      await safe(sock.groupParticipantsUpdate(from, [sender], 'remove'));
      g.stats.kicked++;
      lines.push(ui.kv('SANCTION', 'EXPULSION'));
      kicked = true;
    }
    db().saveGroup(from, g);

    await safe(send(sock, from, { text: ui.frame(p.label.toUpperCase(), lines), mentions: [sender] }));
    if (kicked) {
      await journal.notifyOwner(sock, [
        ui.kv('GROUPE', (meta && meta.subject) || from),
        ui.kv('MEMBRE', `+${ctx.senderNum}`),
        ui.kv('MOTIF', p.label),
        ui.kv('SANCTION', 'EXPULSION'),
      ]);
    }
    /* Base locale : la sanction reste consultable via .journal même
       si GUARD_LOG est éteint (pas de DM au owner). */
    journal.record('protect', from, ctx.senderNum,
      `${p.label} · ${kicked ? 'EXPULSION' : mode.toUpperCase()}`);
    return { handled: true, protection: p.key, reason: v.reason };
  }

  db().saveGroup(from, g);
  return { handled: false, reason: 'clean' };
}

module.exports = { runProtections, PROTECTIONS, markDeleted, wasDeleted, _notified: notified };
