'use strict';
/**
 * Pont système ⇄ Vigil — statut live, journal et commandes à distance.
 *
 * Alors que `guard/src/vigil.js` est une *demande d'avis* (le bot interroge
 * Vigil quand un message le mérite), celui-ci est l'*ève du bot* : toutes les
 * ~3 s il pousse son état et son journal, et repart avec les commandes que
 * l'opérateur a saisies dans la console web.
 *
 * ── Le contrat (défini une fois pour les deux côtés) ─────────────────
 *
 *   POST /api/bot/sync   { name, nodeId?, status, logs[], results[] }
 *                     →  { ok, nodeId, commands: [{ id, kind, payload }] }
 *
 *   logs    = file des lignes du journal non encore reconnues
 *   results = retours des commandes précédentes (le serveur a besoin de
 *             savoir qu'elles ont été exécutées : c'est lui qui les
 *             marquait « running »)
 *
 * Aucun WebSocket n'est possible : Vigil tourne sur Vercel (functions
 * serverless) → du polling HTTP régulier, court, et idempotent.
 *
 * ── Les trois règles (identiques au client de Guard) ─────────────────
 *
 * 1. JAMAIS d'exception : un pont qui casse fait tomber le bot.
 * 2. Jamais de temps mort caché : timeout court, cooldown après échec,
 *    avertissement émis UNE fois.
 * 3. Rien n'est perdu : logs et résultats ne sont retirés de la file
 *    qu'après un 200 — si Vigil est hors ligne, on les rejoue.
 */

const config = require('../config');
/* Transport unique des envois WhatsApp (règle G2) */
const { send } = require('./wa-send');

/** Après un échec, on n'insiste pas avant 15 s (3× le rythme nominal). */
const OFFLINE_MS = 15 * 1000;
/** scrypt + cold start Vercel : le login a le droit d'être lent. */
const LOGIN_MS = 8000;
/** Tampon local : Vigil garde lui-même 200 lignes, on ne lui envoie pas plus. */
const LOG_TAIL = 200;
/** … et jamais plus de 50 lignes par aller-retour. */
const LOG_PER_SYNC = 50;
const RESULTS_PER_SYNC = 50;
/** Limite de longueur par ligne, pour ne pas gonfler le JSON. */
const LOG_LINE_MAX = 400;
/** Nom du nœud par défaut dans la console Vigil. */
const NODE_NAME = 'DJOUSSE-TECH-MD';

/** La config de Vigil est logée sous `guard` (elle est partagée avec le
 *  client de modération : même instance, mêmes identifiants, même URL). */
const cfg = () => (config.guard && config.guard.vigil) || {};
/** Le pont ne s'active que si URL + identifiants sont présents. */
const instanceId = () => process.env.VIGIL_INSTANCE_ID || '';
const instanceToken = () => process.env.VIGIL_INSTANCE_TOKEN || '';
const isManagedInstance = () => Boolean(instanceId() && instanceToken());
const enabled = () => Boolean(cfg().url && (isManagedInstance() || (cfg().email && cfg().password)));

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

/**
 * Fabrique un pont. `getState`/`onCommand` sont fournis par l'appelant :
 * ce module ne connaît ni Baileys, ni le handler — ce qui le rend testable
 * seul avec un faux serveur HTTP.
 *
 * @param {object}   [opts]
 * @param {Function} [opts.getState]   () => statut à publier (ou null)
 * @param {Function} [opts.onCommand]  async (kind, payload) => texte du retour
 * @param {number}   [opts.intervalMs] rythme de polling (défaut 3000)
 * @param {Function} [opts.log]        traceur (défaut console.log)
 */
function createLink(opts = {}) {
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const nodeName = String(opts.nodeName || process.env.VIGIL_NODE_NAME || NODE_NAME).trim();
  /** Rythme : VIGIL_SYNC_MS dans .env, sinon 3 s. */
  const envMs = Number(process.env.VIGIL_SYNC_MS);
  const intervalMs = Number(opts.intervalMs || (envMs > 0 ? envMs : 0)) > 0
    ? Number(opts.intervalMs || envMs)
    : 3000;
  /** Cooldown après un échec (surchargeable en test : 0 = aucun). */
  const offlineMs = Number(opts.offlineMs) >= 0 ? Number(opts.offlineMs) : OFFLINE_MS;
  /**
   * Timeout du sync — DÉLIBÉRÉMENT plus large que `VIGIL_TIMEOUT_MS` (1200 ms,
   * calibré pour des détections à faible latence) : un cold start Vercel dépasse
   * largement 1,2 s, et un pont qui se déconnecte tout seul à chaque réveil ne
   * vaut pas mieux qu'aucun pont.
   */
  const envSyncTo = Number(process.env.VIGIL_SYNC_TIMEOUT_MS);
  const syncTimeoutMs = Number(opts.syncTimeoutMs || (envSyncTo > 0 ? envSyncTo : 0)) > 0
    ? Number(opts.syncTimeoutMs || envSyncTo)
    : 8000;
  /** Délai de la reprise immédiate (voir `postSync`). */
  const retryMs = Number(opts.retryMs) >= 0 ? Number(opts.retryMs) : 1200;

  let cookie = null;
  let nodeId = null;
  let offlineUntil = 0;
  let timer = null;
  let busy = false;
  const warned = new Set();

  /** Journal non encore acknowledge : [{t, line}] */
  const logs = [];
  /** Retours de commandes en attente : [{id, status, result}] */
  const results = [];

  /** Un problème répété ne doit pas noyer le journal. */
  function warnOnce(key, message) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[VIGIL LINK] ${message}`);
  }
  function forgetOnce(key) {
    warned.delete(key);
  }

  function markOffline(err) {
    const name = err && err.name ? err.name : '';
    // Un TIMEOUT est un coup de grisou passager : `postSync` a déjà repris le
    // paquet une fois, geler le pont 15 s de plus ne sert à rien et retarde
    // surtout la livraison des commandes (constaté le 08/10 : 14 s d'attente
    // avant qu'une commande soit même réclamée). On repart dans un quart de
    // la normale. Les vraies pannes (HTTP, auth) gardent le cooldown complet.
    const wait = offlineMs <= 0 ? 0
      : name === 'TimeoutError' ? Math.max(1000, Math.round(offlineMs / 4))
        : offlineMs;
    offlineUntil = Date.now() + wait;
    warnOnce('offline', `injoignable (${name || err}) — nouvel essai dans ${Math.max(1, Math.round(wait / 1000))} s`);
  }

  async function request(path, body, timeoutMs) {
    const headers = { 'Content-Type': 'application/json' };
    if (isManagedInstance()) headers.Authorization = `Bearer ${instanceToken()}`;
    else if (cookie) headers.Cookie = cookie;
    return fetch(cfg().url + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function login() {
    if (isManagedInstance()) return true;
    const res = await request(
      '/api/auth/login',
      { email: cfg().email, password: cfg().password },
      LOGIN_MS,
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

  /** Ajoute une ligne au journal (l'excès le plus ancien est jeté). */
  function pushLog(line) {
    if (line === undefined || line === null) return;
    const text = String(line).slice(0, LOG_LINE_MAX);
    if (!text.trim()) return;
    logs.push({ t: Date.now(), line: text });
    while (logs.length > LOG_TAIL) logs.shift();
  }

  /** Mémorise le retour d'une commande reçue (expédié au prochain cycle). */
  function pushResult(id, status, result) {
    if (!id) return;
    results.push({
      id: String(id),
      status: status === 'failed' ? 'failed' : 'done',
      result: String(result || '').slice(0, 500),
    });
    while (results.length > LOG_TAIL) results.shift();
  }

  /** Exécute une commande reçue — jamais de rejet (loggé, marqué failed). */
  async function dispatch(command) {
    const kind = String(command && command.kind || '');
    const payload = command && command.payload != null ? String(command.payload) : '';
    try {
      const text = opts.onCommand
        ? await opts.onCommand(kind, payload)
        : 'commande non prise en charge';
      pushResult(command.id, 'done', text);
      log(`[VIGIL LINK] commande ${kind} exécutée : ${String(text).slice(0, 120)}`);
    } catch (err) {
      pushResult(command.id, 'failed', err && err.message ? err.message : String(err));
      warnOnce(`cmd:${kind}`, `commande ${kind} en échec : ${err && err.message ? err.message : err}`);
    }
  }

  /**
   * Un aller-retour complet. Idempotent : on n' retire des files que ce que
   * le serveur a accepté, donc une panne rejoue tout au cycle suivant.
   *
   * @returns {Promise<{ok:boolean, sentLogs:number, sentResults:number, commands:number}>}
   */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Un envoi de sync, avec UNE reprise immédiate avant d'abandonner.
   *
   * Un timeout ou un réseau qui tombe brièvement ne doit JAMAIS coûter les
   * 15 s de pause du cooldown : le paquet est ré-idempotent côté serveur
   * (les logs et les résultats ne sont retirés des files qu'après accusé de
   * réception), donc on renvoie exactement le même corps une seconde fois.
   * C'est ce qui empêche une commande d'être réclamée puis perdue — cas
   * constaté le 07/10 : « Demander un QR » livré puis timeout → spinner éternel.
   */
  async function postSync(payload) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await request('/api/bot/sync', payload, syncTimeoutMs);
      } catch (err) {
        if (attempt >= 2) throw err;
        await sleep(retryMs);
      }
    }
  }

  async function syncOnce() {
    const summary = { ok: false, sentLogs: 0, sentResults: 0, commands: 0 };
    if (!enabled() || busy) return summary;
    if (Date.now() < offlineUntil) return summary;

    busy = true;
    try {
      if (!cookie && !(await login())) {
        markOffline(new Error('connexion refusée'));
        return summary;
      }

      const outLogs = logs.slice(0, LOG_PER_SYNC);
      const outResults = results.slice(0, RESULTS_PER_SYNC);
      let status = null;
      try {
        if (typeof opts.getState === 'function') status = opts.getState();
      } catch (_) {
        status = null; // un getState qui échoue ne doit pas bloquer le pont
      }

      const payload = { name: nodeName };
      if (isManagedInstance()) payload.sessionId = instanceId();
      if (nodeId) payload.nodeId = nodeId;
      if (status) payload.status = status;
      if (outLogs.length) payload.logs = outLogs;
      if (outResults.length) payload.results = outResults;

      let res = await postSync(payload);

      // Cookie expirée : une seule reconnexion, pas de boucle.
      if (res.status === 401) {
        cookie = null;
        if (await login()) res = await postSync(payload);
      }
      if (res.status === 401) {
        markOffline(new Error('session refusée'));
        return summary;
      }
      if (!res.ok) {
        markOffline(new Error(`HTTP ${res.status}`));
        return summary;
      }

      const data = await res.json();
      forgetOnce('offline');
      if (typeof data.nodeId === 'string' && data.nodeId) nodeId = data.nodeId;

      // Accusé de réception : on retire CE qui a été accepté, pas plus.
      if (outLogs.length) logs.splice(0, outLogs.length);
      if (outResults.length) results.splice(0, outResults.length);
      summary.sentLogs = outLogs.length;
      summary.sentResults = outResults.length;

      const commands = Array.isArray(data.commands) ? data.commands : [];
      summary.commands = commands.length;
      if (commands.length) {
        // En parallèle : une commande lente ne doit pas retarder le statut.
        await Promise.allSettled(commands.map(dispatch));
      }

      summary.ok = true;
      return summary;
    } catch (err) {
      markOffline(err);
      return summary;
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer) return;
    if (!enabled()) {
      warnOnce('cfg', 'désactivé — renseignez VIGIL_URL, VIGIL_EMAIL et VIGIL_PASSWORD');
      return;
    }
    timer = setInterval(() => {
      syncOnce().catch(() => {}); // syncOnce ne rejette déjà jamais, par sécurité
    }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    log(`[VIGIL LINK] pont armé (${cfg().url}, toutes les ${intervalMs} ms)`);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  /** Pour les tests et l'arrêt propre : purges. */
  function reset() {
    stop();
    cookie = null;
    nodeId = null;
    offlineUntil = 0;
    warned.clear();
    logs.length = 0;
    results.length = 0;
  }

  async function issueClaimCode(sock) {
    if (!isManagedInstance()) return false;
    let synchronized = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const outcome = await syncOnce();
      if (outcome.ok) {
        synchronized = true;
        break;
      }
      await sleep(1000);
    }
    if (!synchronized) throw new Error('Impossible de publier l’état du bot avant la vérification.');

    const id = encodeURIComponent(instanceId());
    const res = await request(`/api/host/sessions/${id}/claim-code`, {}, LOGIN_MS);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const phone = String(data.phoneNumber || '').replace(/\D/g, '');
    const code = String(data.code || '');
    if (!/^\d{8,15}$/.test(phone) || !/^\d{6}$/.test(code)) {
      throw new Error('Le serveur n’a pas renvoyé un code WhatsApp valide.');
    }
    await send(sock, `${phone}@s.whatsapp.net`, {
      text: `Votre code temporaire Vigil est : ${code}\nIl expire dans 10 minutes. Ne le partagez avec personne.`,
    });
    return true;
  }

  return {
    start,
    stop,
    reset,
    syncOnce,
    pushLog,
    pushResult,
    login,
    issueClaimCode,
    enabled,
    /** @internal pour les tests */
    _state: () => ({
      cookie,
      nodeId,
      offlineUntil,
      queuedLogs: logs.length,
      queuedResults: results.length,
      warned: [...warned],
    }),
  };
}

module.exports = { createLink, NODE_NAME, LOG_TAIL, LOG_PER_SYNC };
