export class ApiError extends Error {
  constructor(message, status = 0, kind = 'unavailable') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

// URL de secours directe vers Render si aucune variable d'environnement n'est détectée
const BACKEND_URL = (typeof window !== 'undefined' && window.ENV && window.ENV.PAIRING_API_URL) 
  ? window.ENV.PAIRING_API_URL 
  : 'https://djousse-tech-md.onrender.com';

async function request(path, { method = 'GET', body, signal } = {}) {
  let targetUrl = path;
  if (!path.startsWith('http')) {
    targetUrl = `${BACKEND_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      method,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Service de jumelage indisponible pour le moment.', 0, 'unavailable');
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = {};
  if (contentType.includes('application/json')) {
    try { payload = await response.json(); } catch { payload = {}; }
  }
  if (!response.ok) {
    const kind = response.status === 409 ? 'session'
      : response.status === 429 ? 'rate-limit'
        : response.status === 400 ? 'invalid'
          : 'unavailable';
    const defaultMessage = kind === 'session'
      ? 'Une session est déjà enregistrée sur ce bot. Le jumelage est refusé.'
      : kind === 'rate-limit'
        ? 'Trop de tentatives. Patiente un instant avant de réessayer.'
        : kind === 'invalid'
          ? (payload.error || 'Numéro invalide. Vérifie l’indicatif et les chiffres saisis.')
          : 'Service de jumelage indisponible pour le moment.';
    throw new ApiError(defaultMessage, response.status, kind);
  }
  if (!contentType.includes('application/json')) throw new ApiError('Service de jumelage indisponible pour le moment.');
  return payload;
}

async function requestWithFallback(primary, fallback, options) {
  try {
    return await request(primary, options);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (!(error instanceof ApiError) || ![404, 405, 503].includes(error.status)) throw error;
    return request(fallback, options);
  }
}

export function getStatus({ signal } = {}) {
  return requestWithFallback('status', './status', { method: 'GET', signal });
}

export async function getPairingCode(number, { signal } = {}) {
  const cleanPhone = String(number || '').replace(/\D/g, '');
  
  const result = await requestWithFallback('pair', './pair', {
    method: 'POST',
    body: { phone: cleanPhone },
    signal,
  });
  
  const code = String(result?.code || '').replace(/[\s-]+/g, '').toUpperCase();
  if (!code) throw new ApiError('Le serveur a répondu sans code de jumelage valide.');
  return code;
}