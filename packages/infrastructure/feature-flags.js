// Feature flags system (#155) — remote-config ready
class FeatureFlags {
  constructor(defaults = {}) {
    this._flags = { ...defaults };
    this._listeners = [];
  }

  get(key) {
    return this._flags[key] ?? false;
  }

  set(key, value) {
    this._flags[key] = value;
    this._notify(key, value);
  }

  all() {
    return { ...this._flags };
  }

  loadFromEnv(prefix = 'FF_') {
    Object.keys(process.env).filter(k => k.startsWith(prefix)).forEach(k => {
      const key = k.slice(prefix.length).toLowerCase();
      this._flags[key] = process.env[k] === 'true' || process.env[k] === '1';
    });
  }

  loadFromRemote = null; // Can be set to a fetch function later

  onChange(cb) {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(l => l !== cb); };
  }

  _notify(key, value) {
    this._listeners.forEach(cb => { try { cb(key, value); } catch {} });
  }

  get enabledFeatures() {
    return Object.entries(this._flags).filter(([, v]) => v).map(([k]) => k);
  }
}

export const flags = new FeatureFlags({
  whatsapp_bridge: true,
  auto_responder: true,
  bulk_send: true,
  message_scheduling: true,
  voice_to_text: true,
  sentiment_analysis: true,
  smart_reply: true,
  knowledge_graph: true,
  notes: true,
  search: true,
  export: true,
  birthday_reminder: true,
  campaign_preview: true,
  ab_testing: false,
  dark_mode: true,
  spotlight_tutorial: true,
});

export default flags;
