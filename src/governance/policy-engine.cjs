/* Policy Engine — gouvernance de l'Action Executor (#40).
   Enregistre les politiques par défaut sur le pipeline Policy → Adapter :
   1) isolation owner/trust pour les actions sensibles,
   2) vérification des capacités du moteur.
   Audit : tampon circulaire des actions (utilisé par /api/health/compose). */

const { addPolicy, onAction } = require('../core/action-executor.cjs');

const SENSITIVE_ACTIONS = new Set([
  'GROUP_CREATE', 'GROUP_ADD', 'GROUP_KICK', 'GROUP_PROMOTE', 'GROUP_DEMOTE',
  'GROUP_SUBJECT', 'DELETE', 'EDIT', 'SEND_STATUS',
]);

const CAP_BY_ACTION = {
  SEND_TEXT: 'sendText', REPLY: 'reply', EDIT: 'editMessage', DELETE: 'deleteMessage',
  REACT: 'react', SEND_IMAGE: 'sendImage', SEND_VIDEO: 'sendVideo', SEND_AUDIO: 'sendAudio',
  SEND_STICKER: 'sendSticker', SEND_DOCUMENT: 'sendDocument', SEND_POLL: 'sendPoll',
  SEND_STATUS: 'sendStatus', GROUP_CREATE: 'groupCreate', GROUP_ADD: 'addParticipant',
  GROUP_KICK: 'removeParticipant', GROUP_PROMOTE: 'promote', GROUP_DEMOTE: 'demote',
};

const actionLog = [];
const logEntry = (a, status, ms) => {
  actionLog.push({ t: new Date().toLocaleTimeString('fr-FR', { hour12: false }), type: String(a.type || '?').toUpperCase(), status, ms: Math.round(ms) });
  if (actionLog.length > 50) actionLog.shift();
};

let installed = false;

function installDefaultGovernance() {
  if (installed) return installed;

  addPolicy(async (a, env) => {
    const type = String(a.type || '').toUpperCase();
    if (!SENSITIVE_ACTIONS.has(type)) return { allow: true };
    if (env && env.trusted === true) return { allow: true };
    if (env && env.isOwner === true) return { allow: true };
    return { allow: false, reason: `action réservée à l'owner / trust SCG (${type})` };
  });

  addPolicy(async (a, env) => {
    const cap = CAP_BY_ACTION[String(a.type || '').toUpperCase()];
    if (!cap) return { allow: true };
    const adapter = (env && env.wa) || null;
    if (adapter && !adapter.supports(cap)) {
      return { allow: false, reason: `capabilité manquante sur ce moteur: ${cap}` };
    }
    return { allow: true };
  });

  onAction(async (a, result, env) => {
    logEntry(a, 'ok', 0);
  });

  installed = true;
  return installed;
}

function recordRejected(action, reason) {
  logEntry({ type: action && action.type }, 'blocked', 0);
}

function getActionLog() {
  return actionLog.slice();
}

module.exports = { installDefaultGovernance, getActionLog, recordRejected, SENSITIVE_ACTIONS };