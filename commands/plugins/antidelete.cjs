/* Anti-suppression — implémentation NATIVE dans index.cjs :
   cacheMessage(m, msg) (cache recentMessages, téléchargements wwebjs inclus)
   + handleAntiDelete / handleAntiEdit (restauration texte+média sur REVOKE/EDITE).
   L'ancien plugin obfusqué importait l'engine Baileys legacy à chaque boot et
   n'était consommé par aucun chargeur (ses hooks onMessage/onDelete ne sont
   appelés nulle part). Ce fichier reste pour compatibilité de contrat. */
module.exports = {
  name: 'antidelete',
  enabled: false,
  onMessage() {},
  onDelete() {},
};