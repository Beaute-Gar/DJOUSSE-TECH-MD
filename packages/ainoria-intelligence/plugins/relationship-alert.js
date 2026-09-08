import { createLogger } from '../../infrastructure/logger.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { executor, ACTION_TYPES } from '../actions/action-executor.js';
import { clock } from '../core/cognitive-clock.js';
import { getAllPersons } from '../identity/identity-engine.js';
import { getAllTwins } from '../core/digital-twin.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

const log = createLogger('PLUGIN:RELATIONSHIP');
const _alerted = new Set();

export function registerRelationshipAlerts(pipeline) {
  pipeline.on('heartbeat:day', async () => {
    const ownerJid = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!ownerJid) return;

    try {
      const persons = getAllPersons();
      const twins = getAllTwins();
      const now = Date.now();
      let alerts = [];

      for (const person of persons) {
        if (!person.lastSeen) continue;
        const twin = twins.find(t => t.jid === person.jid);
        if (!twin || !twin.scores) continue;
        const name = person.name || person.jid.split('@')[0];
        const key = `rel:${person.jid}`;

        if (_alerted.has(key)) {
          if (person.lastSeen > now - 86400000) _alerted.delete(key);
          continue;
        }

        const daysSince = clock.daysSince(person.lastSeen);
        const oldActivity = twin.scores.activity || 0.5;
        const weeksSince = Math.max(1, daysSince / 7);
        const estimatedDrop = 1 - (1 / weeksSince);

        if (daysSince >= 5 && estimatedDrop > 0.6 && oldActivity > 0.3) {
          let severity = '💛';
          let msg = `*${name}* ${daysSince}j sans contact.`;
          if (daysSince >= 14) { severity = '❤️‍🩹'; msg = `*${name}* — ${daysSince}j sans contact. Relation en danger.`; }
          if (daysSince >= 30) { severity = '💔'; msg = `*${name}* — ${daysSince}j sans contact. Risque de perte définitive.`; }

          alerts.push(`${severity} ${msg}`);
          _alerted.add(key);
        }
      }

      if (alerts.length > 0) {
        const text = `╔══════════════════════════════════╗\n║        💞 RELATIONS             ║\n╚══════════════════════════════════╝\n\n${alerts.slice(0, 5).join('\n')}\n\n💡 Pense à prendre des nouvelles.`;
        await executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid: ownerJid, text },
          source: 'relationship-alert',
        });
        log.info(`[RELATIONSHIP] ${alerts.length} alertes envoyées`);
      }
    } catch (err) {
      log.warn(`[RELATIONSHIP] Erreur: ${err.message}`);
    }
  }, { priority: 15, description: 'relationship-alert' });
}
