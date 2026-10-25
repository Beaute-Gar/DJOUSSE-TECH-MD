'use strict';

function withNetworkTimeout(operation, timeoutMs = 15000, label = 'Requête réseau') {
  if (typeof operation !== 'function') {
    return Promise.reject(new TypeError('operation doit être une fonction.'));
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError('timeoutMs doit être un nombre positif.'));
  }

  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} : délai dépassé (${timeoutMs} ms).`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  const request = Promise.resolve().then(() => operation(controller.signal));

  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withNetworkTimeout };
