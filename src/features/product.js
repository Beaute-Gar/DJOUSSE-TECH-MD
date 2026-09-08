import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('PRODUCT');

const triggers = [/produit/i, /fiche produit/i, /détails produit/i, /info produit/i, /product/i];

export function enableProduct(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      try {
        const catalog = await sock.getProductCatalog(chat).catch(() => null);
        const products = catalog?.data?.products || [];

        const productName = text.replace(/produit|fiche produit|détails|info product/gi, '').trim().toLowerCase();
        const match = products.find(p => p.name?.toLowerCase().includes(productName));

        if (match) {
          const response = [
            `📦 *${match.name}*`,
            match.price ? `💰 ${match.price} ${match.currency || 'XOF'}` : '',
            match.description ? `\n📝 ${match.description}` : '',
            match.url ? `\n🔗 ${match.url}` : '',
            `\n🆔 ${match.id || 'N/A'}`
          ].filter(Boolean).join('\n');

          if (match.imageUrl) {
            await sock.sendMessage(chat, { image: { url: match.imageUrl }, caption: response });
          } else {
            await sock.sendMessage(chat, { text: response });
          }
        } else if (products.length) {
          const list = products.slice(0, 10).map((p, i) => `${i + 1}. ${p.name} — ${p.price || '?'} ${p.currency || ''}`).join('\n');
          await sock.sendMessage(chat, { text: `📦 *Produits disponibles:*\n\n${list}\n\nDis "info produit <nom>" pour les détails.` });
        } else {
          await sock.sendMessage(chat, { text: '📭 Aucun produit trouvé.' });
        }
      } catch {
        await sock.sendMessage(chat, { text: '❌ Service produit indisponible.' }).catch(() => {});
      }
    }
  });

  log.info('Module product actif');
}
