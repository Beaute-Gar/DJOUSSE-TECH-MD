import { createLogger } from '../../core/logger.js';
import { bus, EVENTS } from '../event-bus.js';
import { reasoner } from '../reasoning-engine.js';
import { policy, POLICY_EFFECTS } from '../governance/policy-engine.js';
import { safety } from '../governance/safety-engine.js';
import { audit } from '../governance/audit-engine.js';
import { workspaceManager } from '../workspace/workspace-manager.js';
import { clock } from '../cognitive-clock.js';

const log = createLogger('PLUGIN:PROACTIVE');
const PIPELINE_PRIORITY = 30;
const RECENT_SUGGESTIONS = new Map();

export function registerProactivePlugin(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup, episode } = data;
    if (!text || text.startsWith('.') || text.toUpperCase().startsWith('.OS')) return;
    if (!isGroup || text.length < 20) return;

    const ws = workspaceManager.getByJid(jid) || workspaceManager.getByJid(senderJid);
    if (!ws || ws.autonomy === 'observation') return;

    const shouldReason = _shouldReason(text);
    if (!shouldReason) return;

    const trace = await reasoner.reason('proactive:message', {
      jid, senderJid, text, isGroup,
    }).catch(() => null);

    if (!trace || !trace.hypotheses?.length) return;
    const top = trace.hypotheses[0];
    if (top.probability <= 0.4) return;

    const chosenAction = trace.chosenAction;
    if (!chosenAction || chosenAction === 'Aucune action requise' || chosenAction === 'Surveiller et re-evaluer') return;
    if (_wasRecentlySuggested(senderJid, chosenAction)) return;

    const action = { type: 'suggest', reason: chosenAction, source: 'proactive-plugin' };
    const policyResult = policy.evaluate(action, { jid, agent: 'proactive-plugin' });
    if (policyResult.effect === POLICY_EFFECTS.DENY) return;

    const safetyResult = await safety.check('proactive-plugin', action, { resource: 'suggestion' }).catch(() => null);
    if (safetyResult && !safetyResult.allowed) return;

    bus.emit('proactive:suggestion', {
      jid, senderJid, text, trace, ws,
      suggestion: chosenAction,
      confidence: trace.confidence,
      autonomy: ws.autonomy,
    });
  }, { priority: PIPELINE_PRIORITY, description: 'proactive-plugin' });
}

function _shouldReason(text) {
  const triggers = ['?', 'quoi', 'pourquoi', 'comment', 'probleme', 'conflit',
    'decision', 'décision', 'important', 'urgent', 'mission', 'objectif',
    'lancer', 'creer', 'créer', 'organiser', 'planifier'];
  const lower = text.toLowerCase();
  return triggers.some(t => lower.includes(t)) || text.length > 100;
}

function _wasRecentlySuggested(jid, action) {
  const key = `${jid}:${action}`;
  const last = RECENT_SUGGESTIONS.get(key);
  if (last && clock.now() - last < 3600000) return true;
  RECENT_SUGGESTIONS.set(key, clock.now());
  return false;
}

export function registerSuggestionHandler(pipeline, sockProvider) {
  pipeline.on('proactive:suggestion', async (data) => {
    const { jid, senderJid, text, trace, ws, suggestion, confidence } = data;
    const autonomy = data.autonomy || 'assisted';

    try {
      const sock = typeof sockProvider === 'function' ? await sockProvider() : sockProvider;
      if (!sock) return;

      const pct = confidence ? Math.round(confidence * 100) : 50;

      if (autonomy === 'suggestion' || autonomy === 'assisted') {
        const msg = _buildSuggestion(text.slice(0, 100), suggestion, pct, trace);
        await sock.sendMessage(ws.ownerJid, { text: msg });
        audit.log({
          agent: 'proactive-plugin', action: 'suggest', resource: 'proactive',
          details: { suggestion, confidence: pct, jid }, result: 'sent',
        });
      }

      if (autonomy === 'autonomous') {
        await _executeAutonomous(sock, suggestion, jid, senderJid, ws);
        audit.log({
          agent: 'proactive-plugin', action: 'autonomous', resource: jid,
          details: { suggestion }, result: 'executed',
        });
      }
    } catch (err) {
      log.warn(`[PLUGIN:PROACTIVE] suggestion handler: ${err.message}`);
    }
  }, { priority: 50, description: 'suggestion-dispatcher' });
}

function _buildSuggestion(text, action, confidence, trace) {
  let msg = `💡 *Suggestion Cognitive OS*\n\n`;
  msg += `J'ai observé : "${text}"\n\n`;
  if (trace?.explanation) {
    const lines = trace.explanation.split('\n').filter(l =>
      l.includes('Risque') || l.includes('recommendation') || l.includes('Action')
    );
    if (lines.length > 0) msg += lines.slice(0, 2).join('\n') + '\n\n';
  }
  msg += `👉 *Suggestion :* ${action}\n`;
  msg += `🔍 Confiance : ${confidence}%\n`;
  return msg;
}

async function _executeAutonomous(sock, action, jid, senderJid, ws) {
  if (action.includes('suivi') || action.includes('Contacter')) {
    if (senderJid !== ws.ownerJid) {
      await sock.sendMessage(senderJid, {
        text: `👋 *Cognitive OS* — J'ai remarqué que tu avais besoin d'aide. Comment puis-je t'assister ?`,
      });
    }
  }
  await sock.sendMessage(ws.ownerJid, {
    text: `🤖 *Action autonome effectuée*\n\nAction : ${action}\nContexte : ${jid}`,
  });
}

export function registerProactiveCleanup(pipeline) {
  pipeline.on('heartbeat:hour', async () => {
    RECENT_SUGGESTIONS.clear();
  }, { priority: 1, description: 'proactive-cleanup' });
}


