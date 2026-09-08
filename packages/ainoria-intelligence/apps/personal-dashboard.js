import { createLogger } from '../../infrastructure/logger.js';
import { CognitiveApp } from './cognitive-app.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { executor, ACTION_TYPES } from '../actions/action-executor.js';
import { clock } from '../core/cognitive-clock.js';
import { getAllPersons } from '../identity/identity-engine.js';
import { getAllTwins } from '../core/digital-twin.js';
import { semanticMemory } from '../memory/semantic-memory.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

const log = createLogger('APP:DASHBOARD');
const WEEKLY_MS = 7 * 86400000;

export class PersonalDashboard extends CognitiveApp {
  constructor() {
    super({ name: 'personal-dashboard', version: '1.0.0', description: 'Tableau de bord personnel auto-alimenté' });
    this._lastWeekly = 0;
  }

  async start() {
    await super.start();
    bus.on('heartbeat:day', async () => this._checkWeekly());
    bus.on('command:dashboard', async (data) => {
      const jid = data?.senderJid || config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      if (jid) await this._sendDashboard(jid, 'hebdo');
    });
    log.info('[DASHBOARD] Prêt');
    return this;
  }

  async _checkWeekly() {
    const now = Date.now();
    const day = new Date().getDay();
    if (day !== 0 || now - this._lastWeekly < WEEKLY_MS * 0.8) return;
    this._lastWeekly = now;
    const ownerJid = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (ownerJid) await this._sendDashboard(ownerJid, 'hebdo');
  }

  async _sendDashboard(jid, period) {
    try {
      const persons = await getAllPersons();
      const twins = getAllTwins();
      const episodes = semanticMemory.episodes.getTimeline(500);
      const since = period === 'hebdo' ? clock.daysAgo(7) : clock.daysAgo(1);
      const recentEpisodes = episodes.filter(e => e.created_at > since);
      const msgCount = recentEpisodes.length;
      const contactsUp = twins.filter(t => (t.activityScore || 0) > 0.6).length;
      const contactsDown = twins.filter(t => (t.activityScore || 0) < 0.2).length;

      const contactCount = persons.filter(p => p.lastSeen > since).length;
      const moodEpisodes = recentEpisodes.filter(e => e.metadata?.sentiment);
      let mood = '😐 Neutre';
      if (moodEpisodes.length > 0) {
        const pos = moodEpisodes.filter(e => e.metadata?.sentiment === 'positif').length;
        const neg = moodEpisodes.filter(e => e.metadata?.sentiment === 'negatif').length;
        if (pos > neg * 2) mood = '😊 Positive';
        else if (neg > pos * 2) mood = '😟 Négative';
      }

      const topics = semanticMemory.concepts?.getAll() || [];
      const hotTopics = topics.slice(0, 5).map(t => t.name);

      const mostContacted = [...twins].sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0)).slice(0, 3);
      const leastContacted = [...persons].filter(p => p.lastSeen).sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0)).slice(0, 3);

      let text = `╔══════════════════════════════════╗\n║     📊 MA SEMAINE                ║\n╚══════════════════════════════════╝\n\n`;
      text += `👥 *${contactCount}* personnes contactées\n`;
      text += `💬 *${msgCount}* messages échangés\n`;
      if (moodEpisodes.length > 0) text += `😊 Humeur : ${mood}\n\n`;

      if (mostContacted.length) {
        text += `📈 *Plus actifs :*\n`;
        for (const t of mostContacted) {
          const p = persons.find(pp => pp.jid === t.jid);
          text += `  • ${p?.name || t.jid.split('@')[0]}\n`;
        }
      }
      if (leastContacted.length) {
        text += `📉 *En baisse :*\n`;
        for (const p of leastContacted) {
          const days = clock.daysSince(p.lastSeen);
          if (days > 3) text += `  • ${p.name || p.jid.split('@')[0]} (${days}j)\n`;
        }
      }

      if (hotTopics.length) text += `\n🎯 *Sujets chauds :*\n${hotTopics.map(t => `  • ${t}`).join('\n')}`;
      if (contactsDown > 0) text += `\n\n🔮 *Prédiction :* ${contactsDown} relation(s) risquent de s'éloigner.\n   .help pour voir comment réagir.`;

      text += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n💡 .about pour la vision DJOUSSE TECH`;

      await executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid, text },
        source: 'personal-dashboard',
      });
      log.info(`[DASHBOARD] Rapport ${period} envoyé`);
    } catch (err) {
      log.warn(`[DASHBOARD] Erreur: ${err.message}`);
    }
  }

  render() {
    return { ...super.render(), description: this.description };
  }
}

export const dashboardPerso = new PersonalDashboard();
