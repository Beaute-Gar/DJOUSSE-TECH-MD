'use strict';

const http = require('http');
const https = require('https');

function httpGet(url, opts = {}) {
  const timeoutMs = opts.timeoutMs === undefined ? 25000 : Number(opts.timeoutMs);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError('timeoutMs doit être un nombre positif.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const activeRequests = new Set();
    const timer = setTimeout(() => {
      finish(new Error(`Requête HTTP : délai dépassé (${timeoutMs} ms).`));
    }, timeoutMs);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        for (const req of activeRequests) req.destroy(error);
        reject(error);
      } else {
        resolve(value);
      }
    }

    function request(currentUrl, redirectsLeft) {
      if (settled) return;
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (error) {
        finish(new Error(`URL invalide : ${error.message}`));
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        finish(new Error(`Protocole HTTP non pris en charge : ${parsed.protocol}`));
        return;
      }

      const transport = parsed.protocol === 'https:' ? https : http;
      const req = transport.get(parsed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 DJOUSSE-TECH-MD',
          ...(opts.headers || {}),
        },
      }, (res) => {
        const location = res.headers.location;
        if (res.statusCode >= 300 && res.statusCode < 400 && location) {
          res.resume();
          if (redirectsLeft <= 0) {
            finish(new Error('Requête HTTP : trop de redirections.'));
            return;
          }
          let nextUrl;
          try {
            nextUrl = new URL(location, parsed).toString();
          } catch (error) {
            finish(new Error(`Redirection HTTP invalide : ${error.message}`));
            return;
          }
          res.once('end', () => request(nextUrl, redirectsLeft - 1));
          res.once('error', (error) => finish(error));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.once('end', () => {
          const buffer = Buffer.concat(chunks);
          if (opts.json) {
            try {
              finish(null, JSON.parse(buffer.toString('utf8')));
            } catch (error) {
              finish(error);
            }
          } else {
            finish(null, buffer);
          }
        });
        res.once('error', (error) => finish(error));
      });

      activeRequests.add(req);
      req.once('close', () => activeRequests.delete(req));
      req.once('error', (error) => finish(error));
    }

    request(url, 5);
  });
}

module.exports = { httpGet };
