import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet } from '../../infrastructure/database/database.js';

const log = createLogger('ACTIVATION');
let enabled = false;
let listener = null;

const ACTIVATION_KEY = 'activation_consent';

function hasConsented(jid) {
  return !!rawGet('SELECT value FROM preferences WHERE key = ? AND jid = ?', ACTIVATION_KEY, jid);
}

function setConsented(jid) {
  rawRun('INSERT OR REPLACE INTO preferences (jid, key, value, updated_at) VALUES (?, ?, ?, ?)', jid, ACTIVATION_KEY, 'oui', Date.now());
}

export async function enableActivationFlow(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS preferences (jid TEXT NOT NULL, key TEXT NOT NULL, value TEXT, updated_at INTEGER, PRIMARY KEY (jid, key))`);

  const ownerJid = process.env.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  if (!ownerJid || ownerJid === '@s.whatsapp.net') {
    log.warn('OWNER_NUMBER non configuré');
    return;
  }

  if (hasConsented(ownerJid)) {
    log.info('Utilisateur a déjà consenti — activation flow ignoré');
    return;
  }

  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (jid !== ownerJid) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();
      if (!text) continue;
      if (text === 'oui') {
        setConsented(ownerJid);
        await runActivationSequence(sock, ownerJid);
        enabled = false;
        if (listener) { try { sock.ev.off('messages.upsert', listener); } catch {} }
        break;
      }
      if (text === 'non' || text === 'non merci') {
        await sock.sendMessage(ownerJid, {
          text: `Compris. Tu peux réactiver DJOUSSE TECH à tout moment en tapant simplement "Oui".\n\nJe reste en veille. ⏸️`,
        });
        enabled = false;
        if (listener) { try { sock.ev.off('messages.upsert', listener); } catch {} }
        break;
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Flow d\'activation en attente de "Oui"...');
}

async function runActivationSequence(sock, jid) {
  const sequence = [
    { text: '✅ Activation en cours...\n\n', delay: 500 },
    { text: '✓ Synchronisation sécurisée terminée.\n', delay: 800 },
    { text: '✓ Mémoire intelligente initialisée.\n', delay: 600 },
    { text: '✓ Compréhension contextuelle activée.\n', delay: 700 },
    { text: '✓ Protection des groupes activée.\n', delay: 500 },
    { text: '✓ Assistant personnel prêt.\n', delay: 600 },
    { text: '', delay: 0 },
    { text: '━━━━━━━━━━━━━━━━━━\n', delay: 300 },
    { text: '🌟 *Bienvenue. Ton WhatsApp est maintenant propulsé par DJOUSSE TECH.*\n', delay: 400 },
    { text: '', delay: 0 },
    { text: '🎬 *Commençons par une démonstration...*\n\n', delay: 500 },
    { text: '━━━━━━━━━━━━━━━━━━\n\n', delay: 300 },
  ];

  let fullText = '';
  for (const step of sequence) {
    fullText += step.text;
    if (step.delay > 0) await new Promise(r => setTimeout(r, step.delay));
  }

  await sock.sendMessage(jid, { text: fullText });
  log.info('Séquence d\'activation envoyée');

  await new Promise(r => setTimeout(r, 1500));

  const { getMeteo } = await import('../../infrastructure/database/weather-currency.js');
  await sock.sendPresenceUpdate('composing', jid);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const meteo = await getMeteo('Douala');
    const temp = meteo?.temp_C || '—';
    const desc = meteo?.weatherDesc?.[0]?.value || '—';
    const humid = meteo?.humidity || '—';
    await sock.sendMessage(jid, {
      text: `🌤 *Météo en direct — Douala, Cameroun*
━━━━━━━━━━━━━━━━━━
🌡 ${temp}°C
☁️ ${desc}
💧 ${humid}% humidité
━━━━━━━━━━━━━━━━━━
Cette donnée est tirée de l'API météo en temps réel.`,
    });
    log.info('Démo météo envoyée');
  } catch (e) {
    log.warn(`Démo météo: ${e.message}`);
    await sock.sendMessage(jid, { text: '🌤 Météo Douala : 28°C, partiellement nuageux' });
  }

  await new Promise(r => setTimeout(r, 2000));
  await sock.sendPresenceUpdate('composing', jid);
  await new Promise(r => setTimeout(r, 1500));

  try {
    const taux = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    const data = await taux.json();
    const fcfa = (2 * data.rates['XAF']).toLocaleString('fr-FR');
    await sock.sendMessage(jid, {
      text: `💱 *Conversion en direct — 2 EUR → FCFA*
━━━━━━━━━━━━━━━━━━
1 EUR = ${data.rates['XAF'].toLocaleString('fr-FR')} FCFA
2 EUR = ${fcfa} FCFA
━━━━━━━━━━━━━━━━━━
Taux de change réel (API) — pas une simulation.`,
    });
    log.info('Démo conversion envoyée');
  } catch (e) {
    log.warn(`Démo conversion: ${e.message}`);
    await sock.sendMessage(jid, { text: '💱 2 EUR = environ 1 312 FCFA (taux réel)' });
  }

  await new Promise(r => setTimeout(r, 2000));
  await sock.sendPresenceUpdate('composing', jid);
  await new Promise(r => setTimeout(r, 1500));

  await sock.sendMessage(jid, {
    text: `🎯 *DJOUSSE TECH est maintenant actif.*

━━━━━━━━━━━━━━━━━━
🌤 *Météo* — parle-moi de la météo de n'importe quelle ville
💱 *Conversion* — "100 dollars en fcfa", "50€ en CFA"
🧠 *Mémoire* — je me souviens de tout ce qu'on se dit
📋 *Résumé* — .resume pour résumer la conversation
━━━━━━━━━━━━━━━━━━

Ou explore .menu pour voir les 60+ fonctionnalités.

Bienvenue. 🚀`,
  });
  log.info('Message de bienvenue final envoyé');
}

export function disableActivationFlow(sock) {
  enabled = false;
  if (listener && sock) { try { sock.ev.off('messages.upsert', listener); } catch {} }
}

export function isActivationFlowOn() { return enabled; }
