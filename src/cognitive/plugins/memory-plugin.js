import { createLogger } from '../../core/logger.js';
import { EVENTS } from '../event-bus.js';
import { addToContext } from '../context-engine.js';
import { evaluate } from '../decision-engine.js';
import { observeInteraction } from '../digital-twin.js';
import { addNode, NODE_TYPES } from '../knowledge-graph.js';
import { trust } from '../governance/trust-engine.js';
import { groupStore } from '../workspace/group-cognitive-object.js';

const log = createLogger('PLUGIN:MEMORY');
const PIPELINE_PRIORITY = 80;

export function registerMemoryPlugin(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup, episode } = data;
    if (!text || text.startsWith('.') || text.toUpperCase().startsWith('.OS')) return;

    addToContext(jid, senderJid, text, 'text');
    if (isGroup) addToContext(jid, senderJid, text, 'text');

    evaluate(data).catch(() => {});

    observeInteraction(senderJid, 'message', text.slice(0, 200));
    trust.record('memory-plugin', 'success', { type: 'context_update', jid });

    addNode(`msg:${episode?.id || Date.now()}`, NODE_TYPES.MESSAGE, {
      summary: text.slice(0, 200), source: senderJid,
      group: isGroup ? jid : null, timestamp: Date.now(),
    }).catch(() => {});
  }, { priority: PIPELINE_PRIORITY, description: 'memory-plugin' });

  pipeline.on(EVENTS.GROUP_JOIN, async (data) => {
    const { groupJid, participantJid, episode } = data;
    const groupObj = groupStore.get(groupJid);
    if (groupObj) {
      groupObj.recordMessage('system', `${participantJid} a rejoint`, 'join');
    }
    observeInteraction(participantJid, 'group_join', groupJid);
  }, { priority: PIPELINE_PRIORITY, description: 'memory-plugin' });

  pipeline.on(EVENTS.GROUP_LEAVE, async (data) => {
    const { groupJid, participantJid } = data;
    const groupObj = groupStore.get(groupJid);
    if (groupObj) {
      groupObj.recordMessage('system', `${participantJid} a quitté`, 'leave');
    }
  }, { priority: PIPELINE_PRIORITY, description: 'memory-plugin' });

  pipeline.on(EVENTS.MESSAGE_REACTED, async (data) => {
    const { senderJid, reaction } = data;
    observeInteraction(senderJid, 'reaction', reaction);
    trust.record(senderJid, 'success', { type: 'reaction', value: reaction });
  }, { priority: PIPELINE_PRIORITY, description: 'memory-plugin' });

  pipeline.on(EVENTS.CALL_RECEIVED, async (data) => {
    const { from, status } = data;
    observeInteraction(from, 'call', status);
  }, { priority: PIPELINE_PRIORITY, description: 'memory-plugin' });

  log.info('[PLUGIN:MEMORY] Registered');
}
