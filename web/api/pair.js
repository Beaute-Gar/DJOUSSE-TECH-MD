const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const BODY_MAX = 2048;
const hits = new Map();

function sendJson(res, status, payload, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function normalizedOrigin(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function expectedOrigin(req) {
  if (process.env.SITE_ORIGIN) return normalizedOrigin(process.env.SITE_ORIGIN);
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return forwardedHost ? normalizedOrigin(`${forwardedProto}://${forwardedHost}`) : '';
}

function clientIp(req) {
  const direct = req.headers['x-real-ip'];
  const forwarded = req.headers['x-forwarded-for'];
  return String(direct || forwarded || 'unknown').split(',')[0].trim().slice(0, 100) || 'unknown';
}

function overLimit(ip) {
  const now = Date.now();
  const current = (hits.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (current.length >= RATE_MAX) {
    hits.set(ip, current);
    return true;
  }
  current.push(now);
  hits.set(ip, current);
  if (hits.size > 2000) {
    for (const [key, times] of hits) if (!times.length || now - times[times.length - 1] >= RATE_WINDOW_MS) hits.delete(key);
  }
  return false;
}

async function readPayload(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > BODY_MAX) throw new Error('too-large');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('invalid-json'); }
}

function pairingApiUrl(pathname) {
  const configured = process.env.PAIRING_API_URL || 'https://djousse-tech-md.onrender.com';
  const base = new URL(configured);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) throw new Error('invalid-protocol');
  base.pathname = pathname;
  base.search = '';
  base.hash = '';
  return base;
}

module.exports = async function pair(req, res) {
  const originHeader = String(req.headers.origin || '');
  const expected = expectedOrigin(req);
  const origin = originHeader ? (normalizedOrigin(originHeader) === expected ? expected : originHeader) : '*';
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-token',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    });
    return res.end();
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Méthode non autorisée.' }, origin);

  let payload;
  try { payload = await readPayload(req); } catch (error) {
    return sendJson(res, 400, { error: error.message === 'too-large' ? 'Requête trop volumineuse.' : 'Données invalides.' }, origin);
  }
  
  const rawNumber = String(payload?.phone || payload?.number || '');
  const cleanPhone = rawNumber.replace(/\D/g, '');
  
  if (!/^\d{8,15}$/.test(cleanPhone)) {
    return sendJson(res, 400, { error: 'Numéro invalide. Saisis un numéro international de 8 à 15 chiffres.' }, origin);
  }

  const ip = clientIp(req);
  if (overLimit(ip)) return sendJson(res, 429, { error: 'Trop de tentatives. Réessaie plus tard.' }, origin);

  let target;
  try { target = pairingApiUrl('/pair'); } catch {
    return sendJson(res, 503, { error: 'Service de jumelage indisponible pour le moment.' }, origin);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  
  try {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const apiToken = process.env.PAIRING_API_TOKEN || 'Djousse@123';
    if (apiToken) headers['x-api-token'] = apiToken;

    // Envoi du numéro et d'un identifiant de session unique basé sur le numéro
    const response = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        phone: cleanPhone,
        sessionId: `session_${cleanPhone}` // Crée un espace isolé pour ce numéro précis
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    let body = {};
    try { body = await response.json(); } catch { body = {}; }

    if (response.status === 401) return sendJson(res, 401, { error: 'Erreur d\'authentification : Jeton API invalide.' }, origin);
    if (response.status === 409) return sendJson(res, 409, { error: 'Une session est déjà enregistrée pour ce numéro.' }, origin);
    if (response.status === 429) return sendJson(res, 429, { error: 'Trop de tentatives. Réessaie plus tard.' }, origin);
    if (response.status === 400) return sendJson(res, 400, { error: body.error || 'Numéro invalide.' }, origin);
    if (!response.ok) return sendJson(res, 503, { error: body.error || 'Service de jumelage indisponible pour le moment.' }, origin);

    const code = String(body?.code || '').replace(/[\s-]+/g, '').toUpperCase();
    if (!code) return sendJson(res, 503, { error: 'Le serveur a répondu sans code valide.' }, origin);

    return sendJson(res, 200, { code }, origin);
  } catch (error) {
    return sendJson(res, 503, { error: 'Service de jumelage indisponible pour le moment.' }, origin);
  } finally {
    clearTimeout(timer);
  }
};