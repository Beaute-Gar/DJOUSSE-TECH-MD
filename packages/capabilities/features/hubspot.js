import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('HUBSPOT');

const CRM_PATTERNS = [/ajoute contact/i, /(?:nouveau\s+)?client/i, /lead/i, /deals?/i, /contact/i, /crm/i];
let listener = null;
let enabled = false;

async function ensureTable() {
  rawRun(`CREATE TABLE IF NOT EXISTS crm_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT NOT NULL UNIQUE,
    name TEXT,
    phone TEXT,
    email TEXT,
    company TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
}

export async function addContact(jid, data) {
  await ensureTable();
  const now = Date.now();
  rawRun(`INSERT OR REPLACE INTO crm_contacts (jid, name, phone, email, company, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM crm_contacts WHERE jid = ?), ?), ?)`,
    jid, data.name || '', data.phone || '', data.email || '', data.company || '', data.notes || '', jid, now, now);
  const contact = rawGet('SELECT * FROM crm_contacts WHERE jid = ?', jid);
  if (process.env.HUBSPOT_API_KEY) syncToHubspot(contact).catch(() => {});
  return contact;
}

export function getContact(jid) {
  return rawGet('SELECT * FROM crm_contacts WHERE jid = ?', jid);
}

export function listContacts() {
  return rawAll('SELECT * FROM crm_contacts ORDER BY updated_at DESC');
}

export function searchContacts(query) {
  const p = `%${query}%`;
  return rawAll('SELECT * FROM crm_contacts WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ?', p, p, p, p);
}

export async function syncToHubspot(contact) {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) return;
  try {
    const body = { properties: {} };
    if (contact.name) body.properties.firstname = contact.name.split(' ')[0];
    if (contact.name) body.properties.lastname = contact.name.split(' ').slice(1).join(' ');
    if (contact.email) body.properties.email = contact.email;
    if (contact.phone) body.properties.phone = contact.phone;
    if (contact.company) body.properties.company = contact.company;
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(body),
    });
    if (res.ok) log.info(`Contact ${contact.name} sync HubSpot`);
    else log.warn(`HubSpot sync fail: ${res.status}`);
  } catch (e) { log.warn(`HubSpot error: ${e.message}`); }
}

export function enableHubspot(sock) {
  if (enabled) return;
  enabled = true;
  ensureTable();
  listener = (m) => {
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      if (!text) continue;
      if (CRM_PATTERNS.some(p => p.test(text))) {
        const jid = msg.key.remoteJid;
        const pushName = msg.pushName || '';
        addContact(jid, { name: pushName, phone: jid.replace(/[^0-9]/g, '').slice(0, 15), notes: text }).catch(() => {});
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('HubSpot CRM activé' + (process.env.HUBSPOT_API_KEY ? ' (online)' : ' (offline)'));
}

export function disableHubspot(sock) {
  enabled = false;
  if (listener && sock) { try { sock.ev.off('messages.upsert', listener); } catch {} }
}

export function isHubspotOn() { return enabled; }
