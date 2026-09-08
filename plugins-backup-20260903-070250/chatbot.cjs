const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/chatbot.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return { enabled: false, api: 'gemini' }; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'chatbot', desc: 'Configurer le chatbot IA', category: 'communication', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const cfg = load();
if (sub === 'on') { cfg.enabled = true; save(cfg); return m.reply('✅ Chatbot activé. Le bot répondra automatiquement aux messages privés.');
} else if (sub === 'off') { cfg.enabled = false; save(cfg); return m.reply('✅ Chatbot désactivé.');
} else if (sub === 'api') {
const api = args[1];
if (!['gemini','openai','nova'].includes(api)) return conn.sendMessage(m.chat, { text: '❌ API disponibles: gemini, openai, nova' }, { quoted: m });
cfg.api = api; save(cfg);
return conn.sendMessage(m.chat, { text: `✅ API chatbot changée: ${api}` }, { quoted: m });
}
conn.sendMessage(m.chat, { text: `🤖 Configuration Chatbot\n\nStatut: ${cfg.enabled ? '✅ Activé' : '❌ Désactivé'}\nAPI: ${cfg.api}\n\n.chatbot on/off\n.chatbot api <gemini|openai|nova>` }, { quoted: m });
});