// DJOUSSE TECH MD — service worker du site (PWA)
// Stratégie : coquille statique en cache-first (site quasi instantané,
// ouvrable hors ligne), tout le reste au réseau. Versionnée : l'activation
// nettoie les anciens caches.
'use strict';

var CACHE = 'djousse-site-v1';
var SHELL = [
  '/',
  '/index.html',
  '/js/site.js',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // POST /pair, /status : jamais de cache
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // appels API : réseau direct

  // Navigation : coquille HTML (SPA à routes de hachage).
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(function (hit) {
        return hit || fetch(req);
      })
    );
    return;
  }

  // Statique : cache-first, puis réseau (et mise en cache du nouveau).
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
