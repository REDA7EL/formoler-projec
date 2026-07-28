const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

class WhatsAppWebService extends EventEmitter {
  constructor() {
    super();
    this.authPath = path.resolve(__dirname, '../.wwebjs_auth');
    this.client = null;
    this.initializing = null;
    // Every outbound message goes through this one queue. This prevents two
    // campaigns (or a manual send) from reaching recipients at the same time.
    this.outboundQueue = Promise.resolve();
    this.nextOutboundAt = 0;
    this.state = { status: 'not_connected', qr: null, phoneNumber: null, profileName: null, error: null };
  }
  getStatus() { return { ...this.state, connected: this.state.status === 'connected' }; }
  async initialize() {
    if (this.client) return this.getStatus();
    // Starting Chromium may take several seconds.  Do not make the HTTP request
    // wait for the QR event: the UI polls /status and will display the QR as soon
    // as WhatsApp emits it.
    if (this.initializing) return this.getStatus();

    const client = new Client({ authStrategy: new LocalAuth({ dataPath: this.authPath, clientId: 'formoler' }), puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] } });
    this.client = client;
    this.state = { ...this.state, status: 'initializing', qr: null, error: null };
    this.emit('status', this.getStatus());
    client.on('qr', qr => { this.state = { ...this.state, status: 'qr_ready', qr, error: null }; this.emit('status', this.getStatus()); });
    client.on('ready', () => { const info = client.info || {}; this.state = { status: 'connected', qr: null, phoneNumber: info.wid?.user ? `+${info.wid.user}` : null, profileName: info.pushname || info.me?.name || null, error: null }; this.emit('status', this.getStatus()); });
    client.on('message', message => this.emit('message', message));
    client.on('auth_failure', message => this.resetSession(`Authentication failed: ${message}`));
    client.on('disconnected', reason => reason === 'LOGOUT' ? this.setDisconnected() : this.restart(`Disconnected: ${reason}`));
    this.initializing = client.initialize()
      .catch(error => {
        this.client = null;
        this.state = { ...this.state, status: 'error', qr: null, error: error.message };
        this.emit('status', this.getStatus());
      })
      .finally(() => { this.initializing = null; });
    return this.getStatus();
  }
  setDisconnected() { this.client = null; this.state = { status: 'not_connected', qr: null, phoneNumber: null, profileName: null, error: null }; this.emit('status', this.getStatus()); }
  async restart(error) { const client = this.client; this.client = null; if (client) await client.destroy().catch(() => {}); this.state = { ...this.state, status: 'not_connected', qr: null, error }; this.emit('status', this.getStatus()); setTimeout(() => this.initialize().catch(() => {}), 1000); }
  async resetSession(error) { const client = this.client; this.client = null; if (client) await client.destroy().catch(() => {}); fs.rmSync(this.authPath, { recursive: true, force: true }); this.state = { status: 'not_connected', qr: null, phoneNumber: null, profileName: null, error }; this.emit('status', this.getStatus()); setTimeout(() => this.initialize().catch(() => {}), 1000); }
  async disconnect() { if (this.client) await this.client.logout().catch(() => {}); await this.resetSession(null); return this.getStatus(); }
  queueOutbound(send, minimumDelayMs = 15000, maximumDelayMs = 45000) {
    const minimum = Math.max(15000, Number(minimumDelayMs) || 15000);
    const maximum = Math.max(minimum, Number(maximumDelayMs) || minimum);
    const run = async () => {
      const waitMs = Math.max(0, this.nextOutboundAt - Date.now());
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      try {
        return await send();
      } finally {
        const pause = Math.round(minimum + Math.random() * (maximum - minimum));
        this.nextOutboundAt = Date.now() + pause;
      }
    };
    const task = this.outboundQueue.then(run, run);
    // Keep the queue alive even if one recipient cannot receive a message.
    this.outboundQueue = task.catch(() => {});
    return task;
  }
  async sendTextMessage(phone, message, minimumDelayMs, maximumDelayMs) {
    return this.queueOutbound(async () => {
      if (!this.client || this.state.status !== 'connected') throw new Error('WhatsApp is not connected.');
      const sent = await this.client.sendMessage(formatPhone(phone), message);
      return { success: true, messageId: sent.id?._serialized || null, to: formatPhone(phone) };
    }, minimumDelayMs, maximumDelayMs);
  }
  async sendMediaMessage(phone, filePath, caption = '', minimumDelayMs, maximumDelayMs) {
    return this.queueOutbound(async () => {
      if (!this.client || this.state.status !== 'connected') throw new Error('WhatsApp is not connected.');
      if (!fs.existsSync(filePath)) throw new Error('Media file not found.');
      const sent = await this.client.sendMessage(formatPhone(phone), MessageMedia.fromFilePath(filePath), { caption });
      return { success: true, messageId: sent.id?._serialized || null, to: formatPhone(phone) };
    }, minimumDelayMs, maximumDelayMs);
  }
  async sendCampaign(customers, message, media, minimumDelayMs = 15000, maximumDelayMs = minimumDelayMs, onProgress) {
    let sent = 0, failed = 0, skipped = 0;
    const minimum = Math.max(15000, Number(minimumDelayMs) || 15000);
    const maximum = Math.max(minimum, Number(maximumDelayMs) || minimum);
    for (let index = 0; index < customers.length; index += 1) {
      const customer = customers[index];
      if (customer.status === 'Opt-out') { skipped++; onProgress?.({ success: false, skipped: true, customerId: customer.id }); continue; }
      const body = String(message || '').replace(/\{name\}/gi, customer.name || 'Friend').replace(/\{phone\}/gi, customer.phone || '');
      try {
        const first = media?.[0];
        const result = first
          ? await this.sendMediaMessage(customer.phone, path.resolve(__dirname, '../uploads', first.filename), body, minimum, maximum)
          : await this.sendTextMessage(customer.phone, body, minimum, maximum);
        result.customerId = customer.id; result.customerName = customer.name; sent++;
        if (onProgress?.(result) === false) break;
      } catch (error) {
        failed++;
        if (onProgress?.({ success: false, customerId: customer.id, customerName: customer.name, error: error.message }) === false) break;
      }
    }
    return { sent, failed, skipped };
  }
}
function formatPhone(value) { const number = String(value || '').replace(/\D/g, ''); if (!number) throw new Error('A valid phone number is required.'); return `${number.startsWith('0') ? `212${number.slice(1)}` : number}@c.us`; }
const service = new WhatsAppWebService();
service.formatPhone = formatPhone;
module.exports = service;
