import { createLogger } from '../../infrastructure/logger.js';
import { providerManager } from './ai-provider-interface.js';

const log = createLogger('AI-ROUTER');

export class AiRouter {
  constructor() {
    this.stats = { total: 0, successes: 0, fallbacks: 0, failures: 0 };
  }

  async query(capacity, systemPrompt, messages, opts = {}) {
    this.stats.total++;
    try {
      const result = await providerManager.query(capacity, systemPrompt, messages, opts);
      this.stats.successes++;
      log.debug(`[AI] ${capacity} → ${result.provider}`);
      return { text: result.text, provider: result.provider, capacity };
    } catch (err) {
      this.stats.failures++;
      throw new Error(err.message || 'Aucun fournisseur disponible');
    }
  }

  async checkAvailable() {
    const available = providerManager.getAvailableProviders();
    const stats = providerManager.getStats();
    await Promise.resolve();
    return available.map(p => ({
      key: p.name,
      name: p.label,
      model: p.defaultModel,
    }));
  }

  getStats() {
    const pmStats = providerManager.getStats();
    return {
      ...this.stats,
      available: pmStats.available,
      providers: pmStats.providers,
    };
  }
}

export const aiRouter = new AiRouter();
export default aiRouter;
