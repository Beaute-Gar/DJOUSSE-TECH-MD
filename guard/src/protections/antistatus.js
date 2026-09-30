'use strict';
// Membre qui identifie le groupe dans son statut : le groupe reçoit un message système "mention de statut".
module.exports = {
  key: 'antistatus',
  label: 'Anti-Status-Mention',
  defaultSanction: 'kick', // surchargeable : .sanction antistatus warn|delete|kick
  detect: (ctx) => (ctx.isStatusMention ? { reason: 'Identifier le groupe dans un statut est interdit.' } : null),
};
