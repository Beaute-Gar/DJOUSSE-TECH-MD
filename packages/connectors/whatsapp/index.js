export class WhatsAppChannel {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async send(to, text) { return this.adapter.sendText(to, text); }
  async sendImage(to, url, caption) { return this.adapter.sendImage(to, url, caption); }
  async sendInteractive(to, interactive) { return this.adapter.sendInteractive(to, interactive); }
  async markRead(messageId) { return this.adapter.markRead(messageId); }
  onMessage(cb) { this.adapter.onMessage = cb; }
  onStatus(cb) { this.adapter.onStatus = cb; }
  getRouter() { return this.adapter.router; }
  async start() { return this.adapter.start?.(); }
  async stop() { return this.adapter.stop?.(); }
}
