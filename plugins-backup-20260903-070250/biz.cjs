const { cmd } = require('../command.cjs');
const { fetchJson } = require('../lib/functions.cjs');
cmd({ pattern: 'biz', desc: 'Afficher les infos business d\'un numéro', category: 'business', filename: __filename }, async (conn, m, commands, config) => {
const num = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : m.body.split(' ')[1]);
const jid = num ? (num.includes('@') ? num : `${num}@s.whatsapp.net`) : m.sender;
try {
const biz = await conn.getBusinessProfile(jid);
if (!biz) return m.reply('❌ Ce numéro n\'a pas de profil business.');
let msg = `🏢 Profil Business\n\n📛 Nom: ${biz.name || 'Non défini'}\n📝 Description: ${biz.description || 'Non définie'}\n🌐 Site: ${biz.website || 'Non défini'}\n📍 Adresse: ${biz.address || 'Non définie'}`;
if (biz.email) msg += `\n📧 Email: ${biz.email}`;
if (biz.categories?.length) msg += `\n🏷️ Catégories: ${biz.categories.join(', ')}`;
m.reply(msg);
} catch { m.reply('❌ Impossible de récupérer les infos business.'); }
});