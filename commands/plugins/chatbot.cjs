const { cmd } = require('../command.cjs');
const fs = require('fs');
const { box } = require('../lib/djousse-ui.cjs');

const DB = require('path').join(__dirname, '..', 'database', 'chatbot.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return { enabled: false, api: 'gemini' }; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));

cmd({
  pattern: 'chatbot',
  alias: ['lydia', 'lydea', 'answer', 'automreply'],
  react: '🤖',
  desc: 'Configurer le chatbot IA',
  category: 'communication',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
  const cfg = load();
  const sub = (q || '').split(' ')[0].toLowerCase();

  if (sub === 'on') {
    cfg.enabled = true;
    save(cfg);
    return reply(box('🤖 *CHATBOT*', [
      { label: 'Statut', value: '✅ Activé' },
      { label: 'API', value: cfg.api },
    ]));
  }

  if (sub === 'off') {
    cfg.enabled = false;
    save(cfg);
    return reply(box('🤖 *CHATBOT*', [
      { label: 'Statut', value: '❌ Désactivé' },
    ]));
  }

  if (sub === 'api') {
    const api = (q || '').split(' ')[1];
    if (!['gemini', 'openai', 'nova'].includes(api)) {
      return reply('❌ APIs disponibles: gemini, openai, nova\nEx: .chatbot api gemini');
    }
    cfg.api = api;
    save(cfg);
    return reply('✅ API chatbot changée: ' + api);
  }

  reply(box('🤖 *CHATBOT*', [
    { label: 'Statut', value: cfg.enabled ? '✅ Activé' : '❌ Désactivé' },
    { label: 'API', value: cfg.api },
    { blank: true },
    { raw: 'Commandes :' },
    { raw: '.chatbot on — Activer' },
    { raw: '.chatbot off — Désactiver' },
    { raw: '.chatbot api <gemini|openai|nova>' },
    { blank: true },
    { raw: 'Alias : .lydia .lydea .answer .automreply' },
  ]));
});
