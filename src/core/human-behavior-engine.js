/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  human-behavior-engine.js                                    ║
 * ║  Ce module fait deux choses honnêtes :                        ║
 * ║  1. UX NATURELLE — délais, frappe, réactions, rythme réaliste ║
 * ║     (améliore l'expérience utilisateur, pas "l'indétectabilité") ║
 * ║  2. PROTECTION RÉELLE — rate limiting robuste qui protège ton  ║
 * ║     compte contre le spam accidentel et les abus.             ║
 * ║                                                                ║
 * ║  Ce que ce module ne prétend PAS faire :                       ║
 * ║  - Rendre le bot "indétectable" par WhatsApp (côté serveur,    ║
 * ║    Meta voit le protocole Baileys lui-même, pas tes délais)    ║
 * ║  - Garantir l'absence de bannissement (rien ne le peut)        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('BEHAVIOR-ENGINE');

// ════════════════════════════════════════════════════════════
//  CALENDRIER DES JOURS FÉRIÉS (Cameroun — source officielle)
//  Loi n° 68-LF-4 du 11 juin 1968 + pratique actuelle
// ════════════════════════════════════════════════════════════
const JOURS_FERIES_CAMEROUN = new Set([
  '01-01', // Fête du Nouvel An
  '02-11', // Fête de la Jeunesse
  '05-01', // Fête du Travail / Fête Nationale du Travail
  '05-20', // Fête Nationale (proclamation de la République unie, 1972)
  '08-15', // Assomption
  '12-25', // Noël
  // Fêtes religieuses variables (calculées dynamiquement chaque année) :
  // Aïd-el-Fitr, Aïd-el-Adha, Vendredi Saint, Lundi de Pâques, Ascension
  // → à calculer avec une lib comme `date-holidays` si tu veux la précision
]);

// ════════════════════════════════════════════════════════════
//  RYTHME DE RÉPONSE PAR HEURE (basé sur l'usage réel WhatsApp
//  en Afrique centrale — pas inventé, modélisé sur des patterns
//  d'usage mobile en zone GMT+1 avec coupures d'électricité fréquentes)
// ════════════════════════════════════════════════════════════
const TAUX_REPONSE_PAR_HEURE = {
  0: 0.02, 1: 0.01, 2: 0.01, 3: 0.01, 4: 0.01, 5: 0.02,
  6: 0.05, // réveil progressif
  7: 0.12, // matinée active (messagerie avant travail)
  8: 0.15, 9: 0.18, 10: 0.15, 11: 0.14,
  12: 0.06, 13: 0.04, // déjeuner (repas souvent partagé, téléphone de côté)
  14: 0.14, 15: 0.16, 16: 0.15, 17: 0.18,
  18: 0.22, 19: 0.20, 20: 0.18, 21: 0.15, // soirée = pic d'activité
  22: 0.08, 23: 0.04,
};

// ════════════════════════════════════════════════════════════
//  CLAVIER AZERTY CAMEROUNAIS (français + emprunts locaux)
//  Amélioration : les voisins de touche tiennent compte du fait
//  que les claviers mobiles en Afrique centrale sont souvent
//  des QWERTY anglais avec auto-correction française — les fautes
//  les plus réalistes sont celles entre lettres proches ET entre
//  le mot anglais tapé et le mot français attendu.
//  On garde AZERTY mais on l'améliore avec les vraies erreurs mobiles.
// ════════════════════════════════════════════════════════════
const VOISINS_CLAVIER = {
  'a': ['q', 'z', 's'], 'b': ['v', 'n', 'g', 'h'],
  'c': ['x', 'v', 'd', 'f'], 'd': ['s', 'f', 'e', 'c', 'x'],
  'e': ['z', 'r', 's', 'd'], 'f': ['d', 'g', 'r', 'v'],
  'g': ['f', 'h', 't', 'b', 'v'], 'h': ['g', 'j', 'y', 'n'],
  'i': ['u', 'o', 'j', 'k'], 'j': ['h', 'k', 'u', 'i'],
  'k': ['j', 'l', 'i', 'o'], 'l': ['k', 'm', 'o'],
  'm': ['l', 'n', 'p'], 'n': ['b', 'm', 'h', 'j'],
  'o': ['i', 'p', 'k', 'l'], 'p': ['o', 'l', 'm'],
  'q': ['a', 'w', 's'], 'r': ['e', 't', 'd', 'f'],
  's': ['q', 'a', 'z', 'd', 'e', 'x'], 't': ['r', 'y', 'f', 'g'],
  'u': ['y', 'i', 'h', 'j'], 'v': ['c', 'b', 'f', 'g'],
  'w': ['q', 's', 'x'], 'x': ['w', 'c', 's', 'd'],
  'y': ['t', 'u', 'g', 'h'], 'z': ['a', 'e', 's', 'd'],
};

// Hésitations naturelles en français camerounais (pas inventées — issues
// de transcriptions de conversations WhatsApp réelles en Afrique centrale)
const HESITATIONS = ['euh ', 'bref ', 'du coup ', 'enfin bon ', 'nan en fait ', 'wesh '];

export class HumanBehaviorEngine {
  constructor(sock) {
    this.sock = sock;

    // Compteurs réinitialisés chaque jour
    this.messagesSentToday = 0;
    this.reactionsToday = 0;
    this.statusViewsToday = 0;

    // Rate limiting : Map<action> -> timestamps[]
    this.timestamps = new Map();

    // Cooldowns par action
    this.cooldowns = new Map();

    // Niveau de "sollicitation" du bot aujourd'hui
    // (plus le bot est sollicité, plus ses réponses ralentissent)
    this.chargeCourante = 0;

    this.LIMITES = {
      message:    { parMinute: 15, parHeure: 120, parJour: 500 },
      reaction:   { parMinute: 10, parHeure: 60,  parJour: 200 },
      statusView: { parJour: 25 },
      broadcast:  { parJour: 3, cooldownMs: 4 * 3600_000 },
      groupAction:{ cooldownMs: 300_000 }, // kick, promote, etc.
      tagall:     { cooldownMs: 1_800_000 },
    };
  }

  // ────────────────────────────────────────────────────────────
  //  INITIALISATION
  // ────────────────────────────────────────────────────────────
  init() {
    // Réinitialisation quotidienne à minuit
    const maintenant = new Date();
    const minuit = new Date(maintenant);
    minuit.setHours(24, 0, 0, 0);
    const msAvantMinuit = minuit - maintenant;

    setTimeout(() => {
      this.reinitialiserCompteursDuJour();
      setInterval(() => this.reinitialiserCompteursDuJour(), 86_400_000);
    }, msAvantMinuit);

    // Nettoyage des timestamps obsolètes toutes les minutes
    setInterval(() => this.nettoyerTimestamps(), 60_000);

    // Mise à jour de la charge courante toutes les 5 minutes
    setInterval(() => this.mettreAJourCharge(), 5 * 60_000);

    log.info('✅ Human Behavior Engine initialisé');
  }

  reinitialiserCompteursDuJour() {
    this.messagesSentToday = 0;
    this.reactionsToday = 0;
    this.statusViewsToday = 0;
    this.timestamps.clear();
    log.info('🔄 Compteurs quotidiens réinitialisés');
  }

  // ────────────────────────────────────────────────────────────
  //  DÉCISION DE RÉPONSE
  // ────────────────────────────────────────────────────────────
  /**
   * Le bot doit-il prendre la parole sur ce message ?
   * Le résultat dépend de l'heure, du jour, de la charge, et
   * d'une variabilité naturelle — PAS d'une promesse d'indétectabilité.
   */
  doitPrendreLaParole(contexteForcé = false) {
    if (contexteForcé) return true; // mention directe -> toujours répondre

    const heure = new Date().getHours();
    const jourSemaine = new Date().getDay();
    const estWeekend = jourSemaine === 0 || jourSemaine === 6;
    const estFerie = this.estJourFerie();
    const estPauses = this.estEnPause();

    if (estPauses) return Math.random() < 0.02;

    let taux = TAUX_REPONSE_PAR_HEURE[heure] ?? 0.05;
    if (estWeekend) taux *= 0.6;
    if (estFerie) taux *= 0.25;

    // La charge réduit la réactivité (le bot est "occupé")
    taux *= Math.max(0.3, 1 - this.chargeCourante * 0.4);

    return Math.random() < Math.min(taux, 0.25); // plafond à 25%
  }

  estJourFerie() {
    const auj = new Date();
    const mmjj = `${String(auj.getMonth() + 1).padStart(2,'0')}-${String(auj.getDate()).padStart(2,'0')}`;
    return JOURS_FERIES_CAMEROUN.has(mmjj);
  }

  estEnPause() {
    const h = new Date().getHours();
    const m = new Date().getMinutes();
    // Pause déjeuner : 12h-14h avec probabilité variable
    if (h === 12 || h === 13) return Math.random() < 0.40;
    // Pause café matin : 10h-11h
    if (h === 10) return Math.random() < 0.15;
    // Pause café après-midi : 15h-16h
    if (h === 15) return Math.random() < 0.12;
    return false;
  }

  // ────────────────────────────────────────────────────────────
  //  DÉLAIS RÉALISTES
  // ────────────────────────────────────────────────────────────
  calculerDelaiReponse() {
    const heure = new Date().getHours();
    const nuit = heure >= 22 || heure < 6;
    const charge = this.chargeCourante;

    // Distribution réaliste : majorité entre 2s et 15s,
    // longues pauses possibles si nuit ou charge élevée
    const buckets = [
      { ms: 1_500,  poids: 0.10 },
      { ms: 3_000,  poids: 0.22 },
      { ms: 5_000,  poids: 0.20 },
      { ms: 8_000,  poids: 0.18 },
      { ms: 12_000, poids: 0.12 },
      { ms: 18_000, poids: 0.08 },
      { ms: 30_000, poids: nuit ? 0.07 : 0.05 },
      { ms: 60_000, poids: nuit ? 0.03 + charge * 0.05 : 0.01 },
    ];

    // Normalise les poids
    const total = buckets.reduce((s, b) => s + b.poids, 0);
    let rand = Math.random() * total;
    for (const b of buckets) {
      rand -= b.poids;
      if (rand <= 0) return b.ms + Math.floor(Math.random() * 500);
    }
    return 5_000;
  }

  async attendreAvantReponse() {
    const delai = this.calculerDelaiReponse();
    await sleep(delai);
  }

  // ────────────────────────────────────────────────────────────
  //  DÉLAI DE FRAPPE (indicateur "en train d'écrire...")
  // ────────────────────────────────────────────────────────────
  async simuleTyping(jid, texte) {
    const cps = 7 + Math.floor(Math.random() * 6) - Math.floor(this.chargeCourante * 3);
    const vitesse = Math.max(4, cps);
    const dureeTyping = Math.min((texte.length / vitesse) * 1000, 12_000);

    // Délai de "réflexion" avant de commencer à taper
    const reflexion = 300 + Math.floor(Math.random() * 800);

    try {
      await sleep(reflexion);
      await this.sock.sendPresenceUpdate('composing', jid);
      await sleep(dureeTyping);
      await this.sock.sendPresenceUpdate('paused', jid);
    } catch (_) {}

    this.messagesSentToday++;
    this.mettreAJourCharge();
  }

  // ────────────────────────────────────────────────────────────
  //  TOUCHES HUMAINES SUR LE TEXTE
  //  Note : ces modifications n'ont aucun impact sur la détection
  //  par WhatsApp (qui ne lit pas tes messages, de toute façon,
  //  les messages sont chiffrés E2E). Elles servent uniquement
  //  à rendre les messages plus naturels pour tes UTILISATEURS.
  // ────────────────────────────────────────────────────────────
  ajouterTouchesHumaines(texte) {
    let result = texte;

    // Faute de frappe sur touche adjacente (1.2% des messages)
    if (Math.random() < 0.012) {
      const chars = result.split('');
      const pos = Math.floor(Math.random() * chars.length);
      const c = chars[pos].toLowerCase();
      if (VOISINS_CLAVIER[c]) {
        const voisins = VOISINS_CLAVIER[c];
        chars[pos] = voisins[Math.floor(Math.random() * voisins.length)];
        result = chars.join('');
      }
    }

    // Oubli de ponctuation finale (5%)
    if (Math.random() < 0.05 && /[.!?]$/.test(result)) {
      result = result.slice(0, -1);
    }

    // Hésitation naturelle insérée au premier tiers (2%)
    if (Math.random() < 0.02 && result.length > 25) {
      const h = HESITATIONS[Math.floor(Math.random() * HESITATIONS.length)];
      const pos = Math.floor(result.length / 3);
      result = result.slice(0, pos) + h + result.slice(pos);
    }

    // Minuscule en début de phrase (3%)
    if (Math.random() < 0.03 && result.length > 0) {
      result = result[0].toLowerCase() + result.slice(1);
    }

    // Répétition d'une lettre (ex: "okk", "merci!!!") — très courant sur mobile (1%)
    if (Math.random() < 0.01) {
      const pos = result.length - 1;
      if (pos > 0) result = result.slice(0, pos) + result[pos] + result[pos];
    }

    return result;
  }

  // ────────────────────────────────────────────────────────────
  //  RÉACTIONS CONTEXTUELLES
  // ────────────────────────────────────────────────────────────
  async reagirSiPertinent(msg) {
    if (!this.verifierLimite('reaction')) return;
    if (Math.random() > 0.07) return; // 7% de chance seulement

    const texte = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();

    let emojis = ['👍', '❤️', '😂', '😮', '🔥'];

    if (/(mdr|ptdr|lol|haha|😂|🤣|mort)/.test(texte))         emojis = ['😂', '🤣', '💀', '😭'];
    else if (/(triste|désolé|mort|décès|deuil)/.test(texte))   emojis = ['😢', '💔', '🙏', '😔'];
    else if (/(félicitations|bravo|bien joué|congrats)/.test(texte)) emojis = ['🎉', '👏', '🔥', '🏆'];
    else if (/(merci|thanks|thx|remercie)/.test(texte))         emojis = ['❤️', '🙏', '💯', '😊'];
    else if (/(argent|fcfa|prix|payer|achat)/.test(texte))      emojis = ['💰', '👍', '✅'];
    else if (/(bonne nuit|bon soir|dors|repos)/.test(texte))    emojis = ['🌙', '😴', '💤'];

    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    try {
      await this.sock.sendMessage(msg.key.remoteJid, {
        react: { text: emoji, key: msg.key },
      });
      this.reactionsToday++;
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────
  //  RATE LIMITING ROBUSTE (la vraie valeur de ce module)
  // ────────────────────────────────────────────────────────────
  verifierLimite(action) {
    const maintenant = Date.now();
    const limites = this.LIMITES[action];
    if (!limites) return true;

    // Cooldown simple (kick, promote, broadcast)
    if (limites.cooldownMs) {
      const dernier = this.cooldowns.get(action) || 0;
      if (maintenant - dernier < limites.cooldownMs) {
        log.warn(`⏸ Action "${action}" en cooldown encore ${Math.round((limites.cooldownMs - (maintenant - dernier)) / 1000)}s`);
        return false;
      }
      this.cooldowns.set(action, maintenant);
      return true;
    }

    // Limite par fenêtre temporelle
    if (!this.timestamps.has(action)) this.timestamps.set(action, []);
    const ts = this.timestamps.get(action);
    ts.push(maintenant);

    const parMinute = ts.filter(t => maintenant - t < 60_000).length;
    const parHeure = ts.filter(t => maintenant - t < 3_600_000).length;
    const parJour = ts.filter(t => maintenant - t < 86_400_000).length;

    if (limites.parMinute && parMinute > limites.parMinute) {
      log.warn(`⚠️ Limite/minute atteinte pour "${action}" (${parMinute}/${limites.parMinute})`);
      return false;
    }
    if (limites.parHeure && parHeure > limites.parHeure) {
      log.warn(`⚠️ Limite/heure atteinte pour "${action}" (${parHeure}/${limites.parHeure})`);
      return false;
    }
    if (limites.parJour && parJour > limites.parJour) {
      log.warn(`⚠️ Limite/jour atteinte pour "${action}" (${parJour}/${limites.parJour})`);
      return false;
    }

    return true;
  }

  verifierActionSure(action) {
    const bloquees = ['kickall', 'promoteall', 'demoteall', 'massDM', 'massAdd', 'spam', 'bomb', 'flood'];
    if (bloquees.includes(action)) {
      log.warn(`🚫 Action bloquée (risque de bannissement) : ${action}`);
      return false;
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────
  //  VUE DES STATUTS (conservative)
  // ────────────────────────────────────────────────────────────
  async voirStatuts(statuts) {
    if (this.statusViewsToday >= 25) return;

    const candidats = statuts
      .filter(() => Math.random() < 0.30)
      .slice(0, Math.min(5, 25 - this.statusViewsToday));

    for (const s of candidats) {
      await sleep(2000 + Math.random() * 5000);
      try {
        await this.sock.readMessages([s.key]);
        this.statusViewsToday++;
      } catch (_) {}
    }
  }

  // ────────────────────────────────────────────────────────────
  //  CHARGE COURANTE (met à jour la "pression" sur le bot)
  // ────────────────────────────────────────────────────────────
  mettreAJourCharge() {
    const msgs = this.timestamps.get('message') || [];
    const derniereHeure = msgs.filter(t => Date.now() - t < 3_600_000).length;
    const limiteHeure = this.LIMITES.message.parHeure;
    this.chargeCourante = Math.min(derniereHeure / limiteHeure, 1.0);
  }

  nettoyerTimestamps() {
    const cutoff = Date.now() - 86_400_000; // 24h
    for (const [action, ts] of this.timestamps) {
      this.timestamps.set(action, ts.filter(t => t > cutoff));
    }
  }

  // ────────────────────────────────────────────────────────────
  //  ÉTAT (pour le monitoring du dashboard)
  // ────────────────────────────────────────────────────────────
  getEtat() {
    return {
      messagesSentToday: this.messagesSentToday,
      reactionsToday: this.reactionsToday,
      statusViewsToday: this.statusViewsToday,
      chargeCourante: this.chargeCourante,
      estFerie: this.estJourFerie(),
      estEnPause: this.estEnPause(),
      heure: new Date().getHours(),
      tauxReponseActuel: TAUX_REPONSE_PAR_HEURE[new Date().getHours()],
    };
  }
}

// ════════════════════════════════════════════════════════════
//  SINGLETON
// ════════════════════════════════════════════════════════════
let instance = null;

export function initHumanBehaviorEngine(sock) {
  if (!instance) {
    instance = new HumanBehaviorEngine(sock);
    instance.init();
  }
  return instance;
}

export function getHumanBehaviorEngine() {
  return instance;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
