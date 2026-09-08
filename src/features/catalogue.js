import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CATALOGUE');

const triggers = [/catalogue/i, /catalog/i, /produits/i, /shop/i, /boutique/i, /magasin/i, /list.*produit/i];

export function enableCatalogue(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      try {
        const catalog = await sock.getProductCatalog(chat).catch(() => null);
        if (catalog?.data?.products?.length) {
          const list = catalog.data.products.slice(0, 10);
          let response = '🏪 *Catalogue*:\n\n';
          list.forEach((p, i) => {
            response += `${i + 1}. *${p.name}*\n`;
            if (p.price) response += `   💰 ${p.price} ${p.currency || 'XOF'}\n`;
            if (p.description) response += `   ${p.description.slice(0, 100)}\n`;
            response += '\n';
          });
          await sock.sendMessage(chat, { text: response });
        } else {
          await sock.sendMessage(chat, {
            text: '📭 Aucun produit dans le catalogue.\n💡 Ajoute des produits depuis WhatsApp Business.'
          });
        }
        log.info('Catalogue consulté');
      } catch {
        await sock.sendMessage(chat, { text: '❌ Fonctionnalité catalogue non disponible.\nUtilise WhatsApp Business pour configurer.' }).catch(() => {});
      }
    }
  });

  log.info('Module catalogue actif');
}
