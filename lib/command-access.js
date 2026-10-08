'use strict';

function commandAccess(entry, context, options = {}) {
  if (options.selfMode && !context.isOwner && !context.fromMe) {
    return { allowed: false, silent: true };
  }

  if (!context.fromMe) {
    const canRun = typeof options.canRun === 'function' ? options.canRun() : options.canRun;
    if (!canRun) return { allowed: false, reason: 'PRIVATE' };
  }

  if (entry.owner && !context.isOwner) {
    return { allowed: false, reason: 'OWNER' };
  }
  if (entry.group && !context.isGroup) {
    return { allowed: false, reason: 'GROUP' };
  }
  if (entry.admin && context.isGroup && !context.isAdmin && !context.isOwner) {
    return { allowed: false, reason: 'ADMIN' };
  }
  if (entry.botAdmin && context.isGroup && !context.isBotAdmin) {
    return { allowed: false, reason: 'BOT_ADMIN' };
  }

  return { allowed: true };
}

module.exports = { commandAccess };
