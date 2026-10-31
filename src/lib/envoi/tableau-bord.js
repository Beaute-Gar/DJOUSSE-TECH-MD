'use strict';
/**
 * lib/envoi/tableau-bord.js — salle de contrôle minimale
 * ────────────────────────────────────────────────────────────────────
 * Aucune dépendance : un handler node:http (comme lib/pairing-api.js).
 * Montage dans la passerelle HTTP existante :
 *
 *   const tableau = require('./lib/envoi/tableau-bord');
 *   // dans le callback de http.createServer :
 *   if (await tableau.servir(req, res)) return;
 *
 * Routes (préfixe /envoi) :
 *   GET  /envoi/metriques          quotas, qualité, warm-up, alertes
 *   GET  /envoi/audit?limite=50    derniers événements (numéros hachés)
 *   GET  /envoi/audit/:empreinte   historique complet d'un numéro
 *   POST /envoi/retablir           sortie manuelle du mode dégradé
 *   GET  /envoi/sante              200 si sain, 503 si dégradé/suspendu
 *
 * Protection : jeton `ENVOI_DASH_TOKEN` (ou `PAIRING_API_TOKEN`), passé en
 * `x-api-token` ou `?token=`. Sans jeton configuré, les routes répondent
 * 403 : un tableau de bord public est une fuite d'information.
 */

const envoi = require('./index');

function jetonAttendu() {
  return process.env.ENVOI_DASH_TOKEN || process.env.PAIRING_API_TOKEN || '';
}

function autorise(req, url) {
  const attendu = jetonAttendu();
  if (!attendu) return false;
  const fourni = req.headers['x-api-token'] || url.searchParams.get('token') || '';
  return String(fourni) === attendu;
}

const json = (res, code, corps) => {
  const data = JSON.stringify(corps, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
};

/** Instantané complet (utilisé aussi par scripts/envoi-statut.js). */
function instantane() {
  try { return envoi.etatComplet(); } catch (e) {
    return { erreur: e.message };
  }
}

/**
 * @returns {Promise<boolean>} true si la requête a été traitée
 */
async function servir(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/envoi/')) return false;

  if (!autorise(req, url)) return json(res, 403, { erreur: 'jeton requis (ENVOI_DASH_TOKEN)' }), true;

  const m = req.method || 'GET';

  if (url.pathname === '/envoi/metriques' && m === 'GET') {
    json(res, 200, instantane());
    return true;
  }

  if (url.pathname === '/envoi/sante' && m === 'GET') {
    const e = instantane();
    const sain = e.actif !== false && !e.degrade && !e.pauseJusqua;
    json(res, sain ? 200 : 503, { sain, degrade: e.degrade, pauseJusqua: e.pauseJusqua, qualite: e.qualite?.score });
    return true;
  }

  if (url.pathname === '/envoi/audit' && m === 'GET') {
    const limite = Number(url.searchParams.get('limite') || 50);
    json(res, 200, { lignes: envoi.store.derniersEnvois(limite), chaine: envoi.store.verifierChaine() });
    return true;
  }

  const auditJid = url.pathname.match(/^\/envoi\/audit\/([^/]+)$/);
  if (auditJid && m === 'GET') {
    json(res, 200, { empreinte: auditJid[1], lignes: envoi.store.historique(decodeURIComponent(auditJid[1])) });
    return true;
  }

  if (url.pathname === '/envoi/retablir' && m === 'POST') {
    envoi.qualite.retablir();
    json(res, 200, { ok: true, etat: instantane() });
    return true;
  }

  json(res, 404, { erreur: 'route inconnue' });
  return true;
}

module.exports = { servir, instantane };
