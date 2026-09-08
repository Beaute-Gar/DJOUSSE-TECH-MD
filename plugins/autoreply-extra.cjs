const { cmd } = require('../command.cjs');
const { getConfig, setConfig, resetCooldown, COOLDOWN_MS } = require('../lib/autoreply.cjs');

/* ─── Auto-réponse d'absence (DM / mention en groupe) ───
   .ar               → statut actuel
   .ar on|off        → activer/désactiver
   .ar set <texte>   → définir le message
   .ar dm on|off     → répondre en DM
   .ar group on|off  → répondre quand mentionné en groupe
   .ar schedule HH:MM-HH:MM | off → plage horaire (ex: 22:00-06:00)
   .ar reset         → vider les cooldowns (5 min/contact) */

const fmt = (cfg) =>
  [
    '🤖 *AUTO-REPLY*',
    '',
    `Status: ${cfg.enabled ? '✅ *Activé*' : '❌ *Désactivé*'}`,
    `DM: ${cfg.dm ? '✅' : '❌'}`,
    `Groupe (mention): ${cfg.groupMention ? '✅' : '❌'}`,
    `Plage horaire: ${cfg.schedule || 'Toujours'}`,
    `Cooldown: ${COOLDOWN_MS / 60000} min/contact`,
    '',
    `Message: ${cfg.message}`,
  ].join('\n');

cmd({ pattern: 'ar', alias: ['autoreply2'], desc: "Gérer l'auto-réponse d'absence (DM / mention groupe)", category: 'communication', filename: __filename, fromMe: true }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const sub = (args[0] || '').toLowerCase();

  if (!sub) return m.reply(fmt(getConfig()));

  if (sub === 'on' || sub === 'off') {
    const cfg = setConfig({ enabled: sub === 'on' });
    return m.reply(`✅ Auto-reply ${cfg.enabled ? 'activé' : 'désactivé'}.`);
  }

  if (sub === 'set' || sub === 'msg') {
    const message = args.slice(1).join(' ').trim();
    if (!message) return m.reply('❌ Usage: .ar set <votre message>');
    setConfig({ message });
    return m.reply('✅ Message mis à jour.');
  }

  if (sub === 'dm') {
    const v = (args[1] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return m.reply('❌ Usage: .ar dm on|off');
    const cfg = setConfig({ dm: v === 'on' });
    return m.reply(`✅ Réponse DM: ${cfg.dm ? 'activée' : 'désactivée'}.`);
  }

  if (sub === 'group') {
    const v = (args[1] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return m.reply('❌ Usage: .ar group on|off');
    const cfg = setConfig({ groupMention: v === 'on' });
    return m.reply(`✅ Réponse groupe (mention): ${cfg.groupMention ? 'activée' : 'désactivée'}.`);
  }

  if (sub === 'schedule') {
    const v = (args[1] || '').trim();
    if (!v || v === 'off') {
      setConfig({ schedule: null });
      return m.reply('✅ Plage horaire supprimée (toujours actif).');
    }
    if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(v)) {
      return m.reply('❌ Format: .ar schedule 22:00-06:00 (gère le passage minuit)');
    }
    const cfg = setConfig({ schedule: v });
    return m.reply(`✅ Plage horaire: ${cfg.schedule}.`);
  }

  if (sub === 'reset') {
    resetCooldown(m.chat);
    return m.reply('✅ Cooldowns réinitialisés.');
  }

  if (sub === 'info') return m.reply(fmt(getConfig()));

  m.reply('❌ Sous-commandes: on|off | set <texte> | dm on|off | group on|off | schedule HH:MM-HH:MM | reset | info');
});
