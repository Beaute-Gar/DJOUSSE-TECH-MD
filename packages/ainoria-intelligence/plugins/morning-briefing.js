import { createLogger } from '../../infrastructure/logger.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { executor, ACTION_TYPES } from '../actions/action-executor.js';
import { clock } from '../core/cognitive-clock.js';
import { getAllPersons } from '../identity/identity-engine.js';
import { getAllTwins } from '../core/digital-twin.js';
import { semanticMemory } from '../memory/semantic-memory.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

const log = createLogger('PLUGIN:BRIEFING');
let _lastBriefingDay = 0;

export function registerMorningBriefing(pipeline) {
  pipeline.on('heartbeat:minute', async () => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const day = now.getDate();

    if (hour !== 7 || min > 5 || day === _lastBriefingDay) return;
    _lastBriefingDay = day;

    const ownerJid = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!ownerJid) return;

    try {
      const persons = await getAllPersons();
      const twins = getAllTwins();
      const msgsToday = _countTodayMessages();
      const contacts = _getRecentContacts(persons);
      const weakened = _checkWeakenedRelations(persons, twins);
      const mood = null;
      const topics = _getHotTopics();

      let brief = `╔══════════════════════════════════╗\n║        🌅 BONJOUR               ║\n╚══════════════════════════════════╝\n\n`;
      brief += `📬 ${msgsToday} messages depuis hier\n`;
      if (contacts.length) brief += `👥 ${contacts.slice(0, 5).join(' • ')}\n\n`;
      if (weakened.length) brief += `🔴 *Relations fragiles :*\n${weakened.slice(0, 3).map(w => `  • ${w.name} : ${w.days}j sans contact`).join('\n')}\n`;
      if (topics.length) brief += `💡 *Sujets récurrents :*\n${topics.slice(0, 3).map(t => `  • "${t}"`).join('\n')}\n`;
      if (mood) brief += `\n😊 Humeur générale : ${mood}`;
      brief += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n💡 .dashboard pour le rapport complet`;

      await executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid: ownerJid, text: brief },
        source: 'morning-briefing',
      });
      log.info('[BRIEFING] Envoyé avec succès');
    } catch (err) {
      log.warn(`[BRIEFING] Erreur: ${err.message}`);
    }
  }, { priority: 25, description: 'morning-briefing' });
}

function _countTodayMessages() {
  const since = clock.daysAgo(1);
  const episodes = semanticMemory.episodes.getTimeline(100);
  return episodes.filter(e => e.created_at > since).length;
}

function _getRecentContacts(persons) {
  try {
    return persons.filter(p => p.lastSeen > clock.daysAgo(1)).map(p => p.name || p.jid.split('@')[0]).slice(0, 5);
  } catch { return []; }
}

function _checkWeakenedRelations(persons, twins) {
  const results = [];
  try {
    for (const twin of twins) {
      const person = persons.find(p => p.jid === twin.jid);
      if (!person || !person.lastSeen) continue;
      const daysSince = clock.daysSince(person.lastSeen);
      if (daysSince > 3 && daysSince < 30) {
        results.push({ name: person.name || twin.jid.split('@')[0], days: daysSince });
      }
    }
  } catch {}
  return results;
}

function _getHotTopics() {
  try {
    const all = semanticMemory.concepts?.getAll() || [];
    return all.slice(0, 3).map(c => c.name);
  } catch { return []; }
}
