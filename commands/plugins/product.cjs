const { cmd } = require('../command.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
cmd({ pattern: 'product', desc: 'Gérer les produits du catalogue', category: 'business', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const isQuotedImage = m.quoted && (
  m.quoted.type === 'imageMessage' ||
  (m.quoted.msg && (m.quoted.msg.imageMessage || m.quoted.msg._be_raw || m.quoted.msg.mimetype))
);
if (sub === 'add' && isQuotedImage) {
const name = args.slice(1).join(' ') || 'Produit';
const img = await downloadMediaMessage(m.quoted, 'product');
if (!img) return m.reply('❌ Erreur téléchargement image.');
try {
await conn.addProduct(m.chat, img, name, 'Produit DJOUSSE TECH', 1000, 'XOF');
return conn.sendMessage(m.chat, { text: `✅ Produit "${name}" ajouté au catalogue.` }, { quoted: m });
} catch (e) { return conn.sendMessage(m.chat, { text: `❌ Erreur: ${e.message}` }, { quoted: m }); }
}
m.reply('📦 Gestion des produits\n\n.product add <nom> - (répondre à une image)\n.product list');
});