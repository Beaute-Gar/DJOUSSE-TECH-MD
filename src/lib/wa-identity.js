'use strict';
/**
 * wa-identity.js — identité de session crédible et persistée
 * ─────────────────────────────────────────────────────────────────
 * WhatsApp profile la COHÉRENCE : un fingerprint qui change à chaque
 * reconnexion est un signal fort. Ce module génère donc une identité
 * UNE fois, la persiste sur disque, puis la réutilise à chaque démarrage.
 *
 *   const { SessionIdentity } = require('./wa-identity');
 *   const identity = new SessionIdentity({ stateFile: '.../identity.json' });
 *   makeWASocket({ ...identity.socketOptions() });
 *
 * Contenu persisté :
 *   - triplet « browser » attendu par Baileys (OS, navigateur, version) ;
 *   - persona comportemental (heures d'activité, biais de réaction/frappe) ;
 *   - vitesse de frappe propre au compte (cps), stable dans le temps.
 *
 * Rotation : `rotateDays: 0` (défaut) = jamais. Sinon, rotation DOUCE :
 * même plateforme et même persona, seule la version du navigateur avance,
 * comme une vraie mise à jour. On ne change jamais tout d'un coup.
 */

const fs = require('fs');
const path = require('path');

/* Triplets « browser » observés côté WhatsApp Web / Baileys. */
const PLATFORMS = [
  {
    os: 'ubuntu',
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    uaHints: { platform: 'Linux', versions: ['120.0', '121.0', '122.0', '123.0'] },
  },
  {
    os: 'windows',
    browser: ['Windows', 'Chrome', '10.0.0'],
    uaHints: { platform: 'Windows', versions: ['120.0', '121.0', '122.0', '123.0', '124.0'] },
  },
  {
    os: 'macos',
    browser: ['Mac OS', 'Chrome', '10.15.7'],
    uaHints: { platform: 'macOS', versions: ['121.0', '122.0', '123.0'] },
  },
];

/* Personas comportementaux : pondérés au premier lancement, puis figés. */
const PERSONAS = [
  { name: 'actif-journee', activeHours: [8, 23], reactionBias: 1.0, typingBias: 1.0, weight: 50 },
  { name: 'matinal', activeHours: [6, 22], reactionBias: 0.9, typingBias: 1.15, weight: 15 },
  { name: 'noctambule', activeHours: [10, 2], reactionBias: 1.1, typingBias: 0.85, weight: 15 },
  { name: 'occasionnel', activeHours: [17, 23], reactionBias: 1.4, typingBias: 0.8, weight: 20 },
];

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight || 1;
    if (roll <= 0) return item;
  }
  return items[0];
}

function writeAtomic(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error('[WA-ID] sauvegarde échouée:', e.message);
  }
}

class SessionIdentity {
  /**
   * @param {object} opts
   * @param {string} [opts.stateFile]  fichier de persistance
   * @param {number} [opts.rotateDays] 0 = jamais (recommandé au début)
   * @param {boolean} [opts.verbose]
   */
  constructor(opts = {}) {
    this.stateFile = opts.stateFile || null;
    this.rotateDays = Math.max(0, Number(opts.rotateDays) || 0);
    this.verbose = !!opts.verbose;
    this.data = this._loadOrCreate();
  }

  /* ─── Chargement / création ──────────────────────────────────── */

  _loadOrCreate() {
    if (this.stateFile) {
      try {
        if (fs.existsSync(this.stateFile)) {
          const saved = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
          if (saved.browser && saved.platform && saved.persona) {
            if (this._needsRotation(saved)) return this._create(true, saved);
            if (this.verbose) {
              console.log('[WA-ID] identité restaurée:', saved.browser.join(' '), '/', saved.persona.name);
            }
            return saved;
          }
        }
      } catch {
        /* fichier corrompu → on recrée une identité propre */
      }
    }
    return this._create(false, null);
  }

  _needsRotation(saved) {
    if (!this.rotateDays) return false;
    const ageDays = (Date.now() - Number(saved.createdAt || 0)) / 86400000;
    return ageDays >= this.rotateDays;
  }

  _create(soft, previous) {
    const platform = previous
      ? PLATFORMS.find((p) => p.os === previous.osName) || weightedPick(PLATFORMS)
      : weightedPick(PLATFORMS);

    const persona = previous
      ? PERSONAS.find((p) => p.name === previous.persona?.name) || weightedPick(PERSONAS)
      : weightedPick(PERSONAS);

    /* Rotation douce : on avance seulement la version, sans changer d'OS. */
    let chromeVersion;
    if (soft && previous?.uaHints?.chromeVersion) {
      const previousMajor = parseInt(previous.uaHints.chromeVersion, 10);
      chromeVersion = `${(Number.isFinite(previousMajor) ? previousMajor : 120) + 1 + Math.floor(Math.random() * 2)}.0`;
    } else {
      const pool = platform.uaHints.versions;
      chromeVersion = pool[Math.floor(Math.random() * pool.length)];
    }

    const created = {
      createdAt: Date.now(),
      osName: platform.os,
      platform: platform.uaHints.platform,
      browser: [...platform.browser],
      uaHints: { platform: platform.uaHints.platform, chromeVersion },
      persona: {
        name: persona.name,
        activeHours: [...persona.activeHours],
        reactionBias: persona.reactionBias,
        typingBias: persona.typingBias,
      },
      /* cps mobile réaliste (12–25) pondéré par le persona, figé pour le compte. */
      typingCps: Math.round((13 + Math.random() * 9) * persona.typingBias * 10) / 10,
    };

    writeAtomic(this.stateFile, created);
    if (this.verbose || !this.stateFile) {
      console.log(
        `[WA-ID] ${soft ? 'rotation douce' : 'nouvelle identité'}:`,
        created.browser.join(' '),
        '| persona:', created.persona.name,
        `| frappe ${created.typingCps} cps`,
      );
    }
    return created;
  }

  /* ─── API publique ───────────────────────────────────────────── */

  /** Options Baileys (triplet navigateur uniquement). */
  socketOptions() {
    return { browser: [...this.data.browser] };
  }

  /** Vitesse de frappe du compte, à injecter comme TYPE_CPS. */
  typingSpeed() {
    return this.data.typingCps;
  }

  /** Le compte est-il dans ses heures d'activité (fenêtre traversant minuit OK) ? */
  isActiveNow(now = new Date()) {
    const [start, end] = this.data.persona.activeHours;
    const hour = now.getHours();
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  /** Multiplicateur de délai propre au persona (occasionnel = plus lent). */
  reactionMultiplier() {
    return this.data.persona.reactionBias;
  }

  info() {
    return {
      browser: this.data.browser.join(' '),
      platform: this.data.platform,
      chromeVersion: this.data.uaHints.chromeVersion,
      persona: this.data.persona.name,
      activeHours: [...this.data.persona.activeHours],
      typingCps: this.data.typingCps,
      ageDays: Number(((Date.now() - this.data.createdAt) / 86400000).toFixed(2)),
    };
  }
}

module.exports = { SessionIdentity, PLATFORMS, PERSONAS };
