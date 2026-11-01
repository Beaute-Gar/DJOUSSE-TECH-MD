'use strict';

module.exports = function enregistrer(env) {
  const { blank, buildFrame, cmd, groupMeta, row } = env;
cmd('groupinfo', ['ginfo'], {
  cat: 2,
  desc: 'Infos groupe; admins, stats, activité, historique, âge et export via sous-commandes',
  group: true,
}, async (ctx) => {
  const actions = {
    admins: 'adminlist',
    stats: 'groupstats',
    activity: 'groupstats',
    joinlog: 'joinlog',
    age: 'groupage',
    export: 'exportgroup',
    status: 'groupstatus',
  };
  const action = String(ctx.args?.[0] || '').toLowerCase();
  if (action) {
    const legacyCommand = actions[action];
    if (!legacyCommand) {
      return ctx.reply('Usage : `.groupinfo [admins|stats|activity|joinlog|age|export|status]`');
    }
    const meta = await groupMeta(ctx.sock, ctx.from);
    if (!meta) return ctx.reply('❌ Groupe introuvable.');
    if (action === 'stats') {
      const definitions = require('./_legacy-advanced-features');
      const definition = definitions.find((item) => item.commands?.includes('groupinfo2'));
      if (!definition?.run) throw new Error('Legacy group statistics command is unavailable.');
      return definition.run(ctx.sock, ctx.msg, ctx.args.slice(1), {
        jid: ctx.from,
        reply: ctx.reply,
        groupMetadata: meta,
        contextInfo: ctx.msg?.message?.extendedTextMessage?.contextInfo || {},
      });
    }
    const legacyText = `.${legacyCommand}`;
    const sourceMessage = ctx.msg?.message || {};
    const routedMessage = {
      ...ctx.msg,
      message: {
        ...sourceMessage,
        conversation: legacyText,
        ...(sourceMessage.extendedTextMessage
          ? { extendedTextMessage: { ...sourceMessage.extendedTextMessage, text: legacyText } }
          : {}),
      },
    };
    const contextInfo = sourceMessage.extendedTextMessage?.contextInfo || {};
    return require('./_legacy-groupstatus').run(ctx.sock, routedMessage, ctx.args.slice(1), {
      jid: ctx.from,
      groupMetadata: meta,
      contextInfo,
      isAdmin: ctx.isAdmin,
      isOwner: ctx.isOwner,
    });
  }

  const meta = await groupMeta(ctx.sock, ctx.from);
  if (!meta) return ctx.reply('❌ Groupe introuvable.');
  const admins = meta.participants.filter((p) => p.admin).length;
  await ctx.reply(
    buildFrame('GROUP INFO', [
      row(`*${meta.subject || 'Groupe'}*`),
      blank(),
      row(`ID : ${meta.id}`),
      row(`Membres : ${meta.participants.length}`),
      row(`Admins : ${admins}`),
      row(`Créé : ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('fr-FR') : '?'}`),
      row('Actions : admins | stats | activity | joinlog | age | export'),
    ])
  );
});
};
module.exports.maison = true;
