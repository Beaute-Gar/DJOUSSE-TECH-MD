/* Émetteur d'actions SCG (#41) — SCG/features ne parlent plus WhatsApp directement.
   Ils émettent une action : emitAction({type:'SEND_POLL', chatId, question, options}).
   Le trust est injecté par un provider (pipeline SCG: policy/trust/approval/audit). */

const { executeAction } = require('./action-executor.cjs');

let trustProvider = null;

function setTrustProvider(fn) {
  trustProvider = fn;
  return trustProvider;
}

async function emitAction(action, env = {}) {
  let trusted = !!(env && env.isOwner === true);
  if (trustProvider) {
    try { trusted = !!await trustProvider(action, env); } catch (e) { trusted = false; }
  }
  return executeAction(action, { ...env, trusted });
}

module.exports = { emitAction, setTrustProvider };