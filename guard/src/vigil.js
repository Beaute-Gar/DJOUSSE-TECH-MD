'use strict';
/**
 * Client Vigil — le « deuxième avis » de DJOUSSE GUARD.
 *
 * Quand une protection de contenu se déclenche, Vigil dit si c'est
 * *réellement* une infraction et renvoie la règle qui a décidé, sa
 * sévérité et son action. Le bot se contente d'exécuter.
 *
 * ── Trois règles, dans cet ordre ────────────────────────────────────
 *
 * 1. JAMAIS d'exception. Une console de modération hors ligne ne doit
 *    pas pouvoir faire tomber un bot WhatsApp : tout renvoie `null`.
 *
 * 2. Échec = on garde l'avis LOCAL. Si Vigil est muet, la protection
 *    continue avec sa propre détection. On échoue du côté de la
 *    protection, jamais du côté du silence.
 *
 * 3. Pas de temps mort caché : délai court, et un cooldown après un
 *    échec pour ne pas marteler un serveur déjà mort.
 *
 * ── Mode ────────────────────────────────────────────────────────────
 *
 *   enrich (défaut) — Vigil ajoute le nom de règle, la sévérité et
 *                     l'action, mais NE PEUT PAS annuler une protection
 *                     locale. Brancher Vigil ne rend jamais la
 *                     modération plus faible.
 *
 *   veto            — si Vigil répond « propre », la protection passe
 *                     son chemin. C'est la lecture « Vigil est
 *                     l'autorité sur le contenu » ; elle suppose que
 *                     des règles existent côté Vigil, sinon elle
 *                     désignerait silencieusement la protection.
 *
 * ── Authentification ────────────────────────────────────────────────
 *
 * Vigil protège ses endpoints par cookie de session : on se connecte une
 * fois, on garde le cookie, on se reconnecte sur 401. C'est du vol
 * d'essence — une clé d'API dédiée serait le vrai dispositif.
 */

const config = require('./config');

/** Après un échec réseau, on n'insiste pas pendant 1 minute. */
const OFFLINE_MS = 60 * 1000;
/** La connexion coûte un hachage scrypt : on lui laisse plus que l'appel. */
const LOGIN_MS = 5000;

let cookie = null;
let offlineUntil = 0;
const warned = new Set();

const cfg = () => config.vigil || {};
const enabled = () => Boolean(cfg().url && cfg().email && cfg().password);
const vetoEnabled = () => cfg().mode === 'veto';

/** Logue une condition UNE seule fois : un problème répété ne doit pas noyer le journal. */
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[VIGIL] ${message}`);
}

function forgetOnce(key) {
  warned.delete(key);
}

/** `set-cookie` arrive avec ses attributs ; seul `name=value` s'envoie. */
function readCookie(res) {
  let raw = [];
  if (typeof res.headers.getSetCookie === 'function') {
    raw = res.headers.getSetCookie();
  } else {
    const single = res.headers.get('set-cookie');
    if (single) raw = [single];
  }
  if (!raw.length) return null;
  return String(raw[0]).split(';')[0].trim() || null;
}

async function post(path, body, { auth = false, timeoutMs } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && cookie) headers.Cookie = cookie;

  const res = await fetch(cfg().url + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs || cfg().timeoutMs || 1200),
  });
  return res;
}

async function login() {
  const res = await post(
    '/api/auth/login',
    { email: cfg().email, password: cfg().password },
    { timeoutMs: LOGIN_MS },
  );
  if (!res.ok) {
    cookie = null;
    warnOnce('auth', `identifiants refusés (${res.status}) — pont désactivé`);
    return false;
  }
  cookie = readCookie(res);
  if (!cookie) {
    warnOnce('auth', 'connexion acceptée mais aucun cookie renvoyé — pont désactivé');
    return false;
  }
  forgetOnce('auth');
  return true;
}

function markOffline(err) {
  offlineUntil = Date.now() + OFFLINE_MS;
  warnOnce('offline', `injoignable (${err && err.name ? err.name : err}) — nouvel essai dans 1 min`);
}

/**
 * Demande à Vigil de juger un message.
 *
 * @returns {null | {clean:boolean, rule:object|null, severity:string|null, action:string|null}}
 *   `null` = Vigil n'a pas répondu → on garde l'avis local.
 */
async function judge(content, meta = {}) {
  if (!enabled()) return null;
  if (Date.now() < offlineUntil) return null;

  const payload = {
    content: String(content || '').slice(0, 2000),
    channel: String(meta.channel || '#general').slice(0, 120),
    subject: String(meta.subject || '@anonyme').slice(0, 60),
  };
  if (!payload.content) return null;

  try {
    // Pas encore de session ? On en ouvre une AVANT de payer un aller-retour
    // de trop : Vigil répond 401 sur tout appel sans cookie.
    if (!cookie && !(await login())) {
      markOffline(new Error('connexion refusée'));
      return null;
    }

    let res = await post('/api/incidents/detect', payload, { auth: true });

    // Cookie expirée entre-temps : une seule reconnexion, pas de boucle.
    if (res.status === 401) {
      cookie = null;
      if (await login()) {
        res = await post('/api/incidents/detect', payload, { auth: true });
      }
    }

    if (res.status === 401) {
      markOffline(new Error('session refusée'));
      return null;
    }
    if (!res.ok) {
      markOffline(new Error(`HTTP ${res.status}`));
      return null;
    }

    const data = await res.json();
    forgetOnce('offline');

    return {
      clean: data.clean === true,
      rule: data.rule || null,
      severity: data.severity || null,
      action: data.action || null,
      invalidRules: Array.isArray(data.invalidRules) ? data.invalidRules : [],
    };
  } catch (err) {
    markOffline(err);
    return null;
  }
}

/** Pour les tests : remet l'état (cookie, cooldown, avertissements). */
function reset() {
  cookie = null;
  offlineUntil = 0;
  warned.clear();
}

module.exports = { judge, login, reset, enabled, vetoEnabled, _state: () => ({ cookie, offlineUntil }) };
