export class AutoSuggest {
  constructor(options = {}) {
    this.cooldowns = new Map();
    this.suggestionHistory = new Map();
    this.kg = options.knowledgeGraph || null;
    this.swarm = options.swarmEngine || null;
    this.learning = options.learningLoop || null;
  }

  THROTTLE = {
    protection:   { maxPerHour: Infinity, maxPerDay: Infinity, suggest: false },
    task:         { maxPerHour: 1, maxPerDay: 5, suggest: true },
    broadcast:    { maxPerHour: 1, maxPerDay: 3, suggest: true },
    schedule:     { maxPerHour: 1, maxPerDay: 5, suggest: true },
    backup:       { maxPerHour: 0, maxPerDay: 1, suggest: true },
    resume:       { maxPerHour: 0, maxPerDay: 1, suggest: true },
    report:       { maxPerHour: 0, maxPerDay: 1, suggest: true },
    export:       { maxPerHour: 0, maxPerDay: 1, suggest: true },
    rpg:          { maxPerHour: 0, maxPerDay: 0, suggest: false },
    sticker:      { maxPerHour: 0, maxPerDay: 0, suggest: false },
    poll:         { maxPerHour: 0, maxPerDay: 0, suggest: false },
    everyone:     { maxPerHour: 0, maxPerDay: 0, suggest: false },
    translate:    { maxPerHour: 0, maxPerDay: 3, suggest: true },
    ai:           { maxPerHour: 0, maxPerDay: 2, suggest: true },
  };

  canSuggest(jid, category) {
    const rules = this.THROTTLE[category];
    if (!rules || !rules.suggest) return false;

    const now = Date.now();
    const key = `${jid}_${category}`;

    if (!this.cooldowns.has(key)) {
      this.cooldowns.set(key, { hour: 0, day: 0, lastHour: now, lastDay: now });
    }

    const cd = this.cooldowns.get(key);

    if (now - cd.lastHour > 3600000) { cd.hour = 0; cd.lastHour = now; }
    if (now - cd.lastDay > 86400000) { cd.day = 0; cd.lastDay = now; }

    if (rules.maxPerHour !== Infinity && cd.hour >= rules.maxPerHour) return false;
    if (rules.maxPerDay !== Infinity && cd.day >= rules.maxPerDay) return false;

    return true;
  }

  recordSuggestion(jid, category) {
    const key = `${jid}_${category}`;
    const cd = this.cooldowns.get(key);
    if (cd) { cd.hour++; cd.day++; }

    if (!this.suggestionHistory.has(jid)) {
      this.suggestionHistory.set(jid, {});
    }
    const history = this.suggestionHistory.get(jid);
    if (!history[category]) {
      history[category] = { hourly: [], daily: [] };
    }
    const now = Date.now();
    history[category].hourly.push(now);
    history[category].daily.push(now);
  }

  async _isRedundant(type, text) {
    if (!this.kg) return false;
    try {
      if (type === 'task' || type === 'tache') {
        const { graphData } = await this.kg.query('system', `Tâches en cours: ${text}`);
        const tasks = graphData || [];
        for (const item of tasks) {
          const desc = item.entity?.description || item.entity?.name || '';
          if (this._similarity(text, desc) > 0.6) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  _similarity(a, b) {
    const wa = a.toLowerCase().split(/\s+/);
    const wb = b.toLowerCase().split(/\s+/);
    const common = wa.filter(w => wb.includes(w));
    return common.length / Math.max(wa.length, wb.length);
  }

  async evaluate(jid, detection) {
    const { type, confidence } = detection;

    if (['spam', 'arnaque', 'insulte', 'lien_suspect', 'faux_compte'].includes(type)) {
      return { action: 'EXECUTE_SILENTLY', message: null, reason: 'Protection automatique' };
    }

    if (await this._isRedundant(type, detection.text || '')) {
      return { action: 'SILENCE', reason: 'Suggestion redondante (KG)' };
    }

    if (['tache', 'deadline', 'rappel', 'promesse'].includes(type)) {
      if (this.canSuggest(jid, 'task')) {
        this.recordSuggestion(jid, 'task');
        return { action: 'SUGGEST', message: this.formatSuggestion(type, detection), category: 'task' };
      }
      return { action: 'SILENCE', reason: 'Quota tâche épuisé' };
    }

    if (['resume', 'backup', 'report'].includes(type)) {
      if (this.canSuggest(jid, 'resume')) {
        this.recordSuggestion(jid, 'resume');
        return { action: 'SUGGEST', message: this.formatSuggestion(type, detection), category: 'resume' };
      }
      return { action: 'SILENCE', reason: 'Quota info épuisé' };
    }

    if (['jeu', 'sticker', 'sondage', 'divertissement'].includes(type)) {
      return { action: 'SILENCE', reason: 'Fun jamais suggéré' };
    }

    if (['langue_etrangere', 'traduction'].includes(type)) {
      if (this.canSuggest(jid, 'translate')) {
        this.recordSuggestion(jid, 'translate');
        return { action: 'SUGGEST', message: this.formatSuggestion(type, detection), category: 'translate' };
      }
      return { action: 'SILENCE', reason: 'Quota traduction épuisé' };
    }

    return { action: 'SILENCE', reason: 'Non prioritaire' };
  }

  formatSuggestion(type, detection) {
    const templates = {
      tache:       '💡 Rappel possible pour cette tâche.',
      deadline:    '📅 Échéance détectée — rappel ?',
      promesse:    '🤝 Promesse détectée — suivi ?',
      resume:      '📋 Résumé du groupe disponible.',
      backup:      '💾 Sauvegarde de cette conversation ?',
      report:      '📊 Rapport quotidien disponible.',
      traduction:  '🌍 Traduire ce message ?',
      broadcast:   '📢 Cette annonce semble importante — diffuser ?',
    };
    return templates[type] || '💡 Action possible.';
  }

  getStats() {
    const stats = { totalSuggestions: 0, byType: {}, quotaUsage: {} };
    for (const [jid, history] of this.suggestionHistory.entries()) {
      for (const [type, th] of Object.entries(history)) {
        stats.totalSuggestions += th.daily.length;
        stats.byType[type] = (stats.byType[type] || 0) + th.daily.length;
      }
    }
    for (const [type, quota] of Object.entries(this.THROTTLE)) {
      stats.quotaUsage[type] = { maxPerHour: quota.maxPerHour, maxPerDay: quota.maxPerDay };
    }
    return stats;
  }
}

let instance = null;
export function getAutoSuggest(options) {
  if (!instance) instance = new AutoSuggest(options);
  return instance;
}
