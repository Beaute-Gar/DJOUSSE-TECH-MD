import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('AI-PROVIDER');

export class AIProvider {
  constructor(config) {
    this.name = config.name;
    this.label = config.label || config.name;
    this.models = config.models || [];
    this.defaultModel = config.defaultModel || (config.models[0]?.id);
    this.baseUrl = config.baseUrl;
    this.keyEnv = config.keyEnv;
    this.priority = config.priority || 10;
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 15000;
    this.capabilities = config.capabilities || ['conversation'];
    this.headers = config.headers || {};
    this.formatRequest = config.formatRequest || this._defaultFormatRequest;
    this.formatResponse = config.formatResponse || this._defaultFormatResponse;
    if (config._authHeader) this._authHeader = config._authHeader.bind(this);
    if (config._buildUrl) this._buildUrl = config._buildUrl.bind(this);
    if (config.isAvailable) this.isAvailable = config.isAvailable.bind(this);
    if (config.getKey) this.getKey = config.getKey.bind(this);
  }

  getKey() {
    return process.env[this.keyEnv] || null;
  }

  isAvailable() {
    return this.enabled && !!this.getKey();
  }

  async query(model, systemPrompt, messages, opts = {}) {
    if (!this.isAvailable()) throw new Error(`${this.name}: cle API manquante`);
    const key = this.getKey();
    const body = this.formatRequest(model || this.defaultModel, systemPrompt, messages, opts);
    const auth = this._authHeader(key);
    const authHeader = typeof auth === 'string' ? { Authorization: auth } : {};
    const { default: axios } = await import('axios');
    const res = await axios.post(this._buildUrl(model), body, {
      headers: { ...this.headers, ...authHeader },
      timeout: opts.timeout || this.timeout,
    });
    return this.formatResponse(res.data);
  }

  _buildUrl(model) {
    return this.baseUrl.replace('{model}', model || this.defaultModel);
  }

  _authHeader(key) {
    return this.authHeader ? this.authHeader(key) : `Bearer ${key}`;
  }

  _defaultFormatRequest(model, systemPrompt, messages, opts) {
    return {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role || 'user', content: m.content })),
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1024,
    };
  }

  _defaultFormatResponse(data) {
    return data?.choices?.[0]?.message?.content || '';
  }
}

export const PROVIDER_DEFINITIONS = [
  {
    name: 'groq', label: 'Groq', priority: 1,
    keyEnv: 'GROQ_API_KEY',
    defaultModel: 'mixtral-8x7b-32768',
    models: [
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', capabilities: ['conversation', 'analyse', 'extraction', 'outil'], priority: 1 },
      { id: 'gemma2-9b-it', label: 'Gemma2 9B', capabilities: ['raisonnement', 'planification', 'code'], priority: 2 },
      { id: 'llama3-70b-8192', label: 'Llama3 70B', capabilities: ['analyse', 'raisonnement'], priority: 3 },
      { id: 'openai/gpt-oss-20b', label: 'Llama3.1 8B', capabilities: ['conversation', 'rapide'], priority: 4 },
    ],
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    timeout: 15000,
    capabilities: ['conversation', 'analyse', 'raisonnement', 'planification', 'extraction', 'resume', 'code', 'outil'],
  },
  {
    name: 'gemini', label: 'Gemini', priority: 5,
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', capabilities: ['conversation', 'analyse', 'vision', 'creative'], priority: 1 },
      { id: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro', capabilities: ['raisonnement', 'analyse'], priority: 2 },
    ],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    timeout: 20000,
    headers: { 'Content-Type': 'application/json' },
    capabilities: ['conversation', 'analyse', 'raisonnement', 'creative', 'extraction', 'resume', 'vision'],
    formatRequest(model, systemPrompt, messages, opts) {
      return {
        contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + messages.map(m => m.content).join('\n') }] }],
        generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 1024 },
      };
    },
    formatResponse(data) {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
    _authHeader(key) {
      return key;
    },
    _buildUrl(model) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${this.getKey()}`;
    },
  },
  {
    name: 'openai', label: 'OpenAI', priority: 10,
    keyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', capabilities: ['conversation', 'analyse', 'raisonnement'], priority: 1 },
      { id: 'gpt-4o', label: 'GPT-4o', capabilities: ['raisonnement', 'analyse'], priority: 2 },
    ],
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    timeout: 20000,
    capabilities: ['conversation', 'analyse', 'raisonnement', 'planification', 'code', 'creative'],
  },
  {
    name: 'ollama', label: 'Ollama', priority: 20,
    keyEnv: 'OLLAMA_HOST',
    defaultModel: 'llama3.2',
    models: [
      { id: 'llama3.2', label: 'Llama3.2', capabilities: ['conversation', 'analyse'], priority: 1 },
      { id: 'mistral', label: 'Mistral', capabilities: ['conversation', 'analyse'], priority: 2 },
    ],
    baseUrl: (process.env.OLLAMA_HOST || 'http://localhost:11434') + '/api/chat',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
    capabilities: ['conversation', 'analyse'],
    formatRequest(model, systemPrompt, messages, opts) {
      return {
        model: model || 'llama3.2',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role || 'user', content: m.content })),
        ],
        stream: false,
        options: { temperature: opts.temperature ?? 0.7, num_predict: opts.maxTokens ?? 1024 },
      };
    },
    formatResponse(data) {
      return data?.message?.content || '';
    },
    _authHeader() { return {}; },
    getKey() { return 'ollama-local'; },
    isAvailable() { return this.enabled; },
  },
  {
    name: 'openrouter', label: 'OpenRouter', priority: 15,
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', capabilities: ['conversation', 'analyse'], priority: 1 },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', capabilities: ['raisonnement', 'analyse'], priority: 2 },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', capabilities: ['conversation', 'vision'], priority: 3 },
    ],
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    timeout: 20000,
    headers: { 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000' },
    capabilities: ['conversation', 'analyse', 'raisonnement', 'code'],
  },
  {
    name: 'puter', label: 'Puter.js', priority: 3,
    keyEnv: null,
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', capabilities: ['conversation', 'raisonnement', 'analyse'], priority: 1 },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', capabilities: ['conversation', 'analyse'], priority: 2 },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', capabilities: ['conversation', 'rapide'], priority: 3 },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', capabilities: ['conversation', 'rapide'], priority: 4 },
      { id: 'gpt-5.3-codex', label: 'Codex', capabilities: ['code'], priority: 5 },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', capabilities: ['conversation', 'analyse'], priority: 6 },
      { id: 'gpt-4o', label: 'GPT-4o', capabilities: ['vision', 'analyse'], priority: 7 },
    ],
    baseUrl: 'https://api.puter.com/drivers/call',
    timeout: 30000,
    capabilities: ['conversation', 'analyse', 'raisonnement', 'code', 'vision', 'rapide', 'creative'],
    isAvailable() { return true; },
    getKey() { return 'puter-keyless'; },
    _authHeader() { return {}; },
    formatRequest(model, systemPrompt, messages, opts) {
      const msgs = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.role || 'user', content: m.content }))]
        : messages.map(m => ({ role: m.role || 'user', content: m.content }));
      return {
        interface: 'puter-chat-completion',
        driver: 'openai-completion',
        test_mode: false,
        call: {
          method: 'complete',
          args: {
            messages: msgs,
            model: model || 'gpt-4o-mini',
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.maxTokens ?? 1024,
          },
        },
      };
    },
    formatResponse(data) {
      return data?.result?.message?.content?.trim() || data?.result?.text?.trim() || '';
    },
    _buildUrl() { return 'https://api.puter.com/drivers/call'; },
  },
];

export class ProviderManager {
  constructor() {
    this.providers = [];
    this.capacityMap = {};
  }

  init() {
    for (const def of PROVIDER_DEFINITIONS) {
      const provider = new AIProvider(def);
      this.providers.push(provider);
    }
    this.providers.sort((a, b) => a.priority - b.priority);
    this._buildCapacityMap();
    log.info(`Provider Manager: ${this.providers.length} fournisseurs`);
  }

  _buildCapacityMap() {
    for (const provider of this.providers) {
      for (const cap of provider.capabilities) {
        if (!this.capacityMap[cap]) this.capacityMap[cap] = [];
        this.capacityMap[cap].push(provider);
      }
    }
  }

  getAvailableProviders() {
    return this.providers.filter(p => p.isAvailable());
  }

  getProvidersForCapacity(capacity) {
    return (this.capacityMap[capacity] || []).filter(p => p.isAvailable());
  }

  async query(capacity, systemPrompt, messages, opts = {}) {
    const chain = this.getProvidersForCapacity(capacity);
    if (chain.length === 0) {
      const fallback = this.getAvailableProviders();
      if (fallback.length === 0) throw new Error('Aucun fournisseur IA disponible');
      return this._tryChain(fallback, systemPrompt, messages, opts);
    }
    return this._tryChain(chain, systemPrompt, messages, opts);
  }

  async _tryChain(providers, systemPrompt, messages, opts) {
    let lastError = null;
    for (const provider of providers) {
      try {
        const model = opts.model || provider.defaultModel;
        const text = await provider.query(model, systemPrompt, messages, opts);
        if (text) return { text, provider: provider.name, model };
      } catch (err) {
        lastError = err;
        log.warn(`${provider.name} echec: ${err.message}`);
      }
    }
    throw lastError || new Error('Tous les fournisseurs ont echoue');
  }

  getStats() {
    const available = this.getAvailableProviders();
    return { total: this.providers.length, available: available.length, providers: available.map(p => ({ name: p.name, models: p.models.length })) };
  }
}

export const providerManager = new ProviderManager();
export default providerManager;
