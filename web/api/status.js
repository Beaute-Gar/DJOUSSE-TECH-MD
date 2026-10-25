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

module.exports = async function status(req, res) {
  const originHeader = String(req.headers.origin || '');
  const expected = expectedOrigin(req);
  const origin = originHeader && normalizedOrigin(originHeader) === expected ? expected : '';
  if (originHeader && !origin) return sendJson(res, 403, { error: 'Origine refusée.' });
  if (req.method === 'OPTIONS') {
    if (!origin) return sendJson(res, 403, { error: 'Origine refusée.' });
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    });
    return res.end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Méthode non autorisée.' }, origin);
  if (!process.env.PAIRING_API_URL) return sendJson(res, 503, { error: 'Service de jumelage indisponible pour le moment.' }, origin);

  let target;
  try {
    const base = new URL(process.env.PAIRING_API_URL);
    const local = ['localhost', '127.0.0.1'].includes(base.hostname);
    if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) throw new Error('invalid-protocol');
    base.pathname = '/status';
    base.search = '';
    base.hash = '';
    target = base;
  } catch {
    return sendJson(res, 503, { error: 'Service de jumelage indisponible pour le moment.' }, origin);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const headers = { 'Accept': 'application/json' };
    if (process.env.PAIRING_API_TOKEN) headers['x-api-token'] = process.env.PAIRING_API_TOKEN;
    const response = await fetch(target, { headers, cache: 'no-store', signal: controller.signal });
    if (!response.ok) return sendJson(res, 503, { error: 'Service de jumelage indisponible pour le moment.' }, origin);
    const body = await response.json();
    return sendJson(res, 200, {
      ok: true,
      connected: Boolean(body?.connected),
      connection: typeof body?.connection === 'string' ? body.connection.slice(0, 40) : 'INCONNU',
      sessions: Number.isFinite(Number(body?.sessions)) ? Number(body.sessions) : 0,
      active: Number.isFinite(Number(body?.active)) ? Number(body.active) : 0,
    }, origin);
  } catch {
    return sendJson(res, 503, { error: 'Service de jumelage indisponible pour le moment.' }, origin);
  } finally {
    clearTimeout(timer);
  }
};
