export class ApiError extends Error {
  constructor(message, status = 0, kind = 'unavailable') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

/* Aucun secret dans le navigateur : le site appelle ses PROPRES routes
   (/api/pair, /api/status), qui gardent le jeton côté serveur Vercel.
   Un token écrit dans un fichier statique est lisible par n'importe qui. */

async function request(path, { method = 'GET', body, signal } = {}) {
  const targetUrl = path.startsWith('http') ? path : `/${path.replace(/^\/+/, '')}`;

  const headers = {
    'Content-Type': 'application/json'
  };

  let response;
  try {
    response = await fetch(targetUrl, {
      method,
      cache: 'no-store',
      headers,
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
    const kind = response.status === 401 ? 'unauthorized'
      : response.status === 409 ? 'session'
        : response.status === 429 ? 'rate-limit'
          : response.status === 400 ? 'invalid'
            : 'unavailable';
            
    const defaultMessage = kind === 'unauthorized'
      ? 'Erreur d\'authentification : Jeton API invalide ou manquant.'
      : kind === 'session'
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

export function getStatus({ signal } = {}) {
  return request('/api/status', { method: 'GET', signal });
}

export async function getPairingCode(number, { signal } = {}) {
  const cleanPhone = String(number || '').replace(/\D/g, '');

  const result = await request('/api/pair', {
    method: 'POST',
    body: { phone: cleanPhone },
    signal,
  });
  
  const code = String(result?.code || '').replace(/[\s-]+/g, '').toUpperCase();
  if (!code) throw new ApiError('Le serveur a répondu sans code de jumelage valide.');
  return code;
}