// DJOUSSE TECH MD — espace de travail (workspace)
// Fichier externe (CSP script-src 'self') : aucun script inline.
// Routeur de pages + formulaire de jumelage (API optionnelle du bot) +
// installation PWA + état réseau. Tout se dégrade proprement sans serveur.

(function () {
  'use strict';

  /* ──────────────── routeur de pages (hash) ──────────────── */
  var TITLES = {
    overview: 'Aperçu',
    pairing: 'Connexion',
    commands: 'Commandes',
    guard: 'DJOUSSE Guard',
    deploy: 'Hébergement',
    community: 'Communauté'
  };
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('backdrop');
  var crumb = document.getElementById('crumb');

  function closeDrawer() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('on');
  }

  function route() {
    var id = (location.hash.replace(/^#\//, '') || 'overview');
    if (!TITLES[id]) id = 'overview';
    document.querySelectorAll('.page').forEach(function (s) {
      s.classList.toggle('on', s.dataset.page === id);
    });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === id);
    });
    crumb.textContent = TITLES[id];
    document.title = 'DJOUSSE TECH MD — ' + TITLES[id];
    closeDrawer();
    if (id === 'pairing') checkServer();
    if (id === 'overview') runCounters();
  }
  window.addEventListener('hashchange', route);

  document.getElementById('burger').addEventListener('click', function () {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('on');
  });
  backdrop.addEventListener('click', closeDrawer);

  /* ──────────────── compteurs de l'aperçu ──────────────── */
  var counted = false;
  function runCounters() {
    if (counted) return;
    var els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    counted = true;
    els.forEach(function (el) {
      var target = +el.dataset.count, start = performance.now(), dur = 900;
      function tick(now) {
        var p = Math.min((now - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ──────────────── API de jumelage du bot ────────────────
     Le bot expose (optionnellement, PAIRING_API=on) :
       GET  /status → { ok, connected, sessions, active }
       POST /pair   → { code }  ou  { error }
     Sans serveur configuré, on tente la même origine ; en cas d'échec,
     la page reste utilisable en mode console (instructions). */
  var net = document.getElementById('net');
  var statTotal = document.getElementById('stat-total');
  var statActive = document.getElementById('stat-active');
  var codeBox = document.getElementById('code');
  var pstatus = document.getElementById('pstatus');
  var getCodeBtn = document.getElementById('getcode');
  var apiInput = document.getElementById('api');
  var apiStatus = document.getElementById('apistatus');
  var pollTimer = null;
  var awaitingLink = false;

  function base() {
    var saved = (localStorage.getItem('djApi') || '').replace(/\/+$/, '');
    return saved || location.origin;
  }
  apiInput.value = localStorage.getItem('djApi') || '';

  function setNet(state, label) {
    net.className = 'net' + (state ? ' ' + state : '');
    net.innerHTML = '<span class="dot"></span> ' + label;
  }
  function setStatus(text, cls) {
    pstatus.className = 'pstatus' + (cls ? ' ' + cls : '');
    pstatus.textContent = text;
  }

  function fetchJSON(url, opts, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 6000);
    opts = opts || {};
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try {
          j = txt ? JSON.parse(txt) : null;
        } catch (e) {
          throw new Error('réponse non-JSON (' + r.status + ') — cette URL sert-elle bien le bot ?');
        }
        if (!r.ok) throw new Error(j && j.error ? j.error : 'HTTP ' + r.status);
        return j;
      });
    }).finally(function () { clearTimeout(t); });
  }

  function checkServer() {
    fetchJSON(base() + '/status', {}, 6000).then(function (j) {
      setNet('ok', 'Serveur OK');
      statTotal.textContent = j.sessions != null ? j.sessions : '—';
      statActive.textContent = j.active != null ? j.active : (j.connected ? '1' : '0');
      if (awaitingLink && j.connected) {
        awaitingLink = false;
        setStatus('✅ Lien établi — le bot est en ligne. Tu peux fermer cette page.', 'ok');
      }
    }).catch(function () {
      setNet('ko', 'Serveur injoignable');
      statTotal.textContent = '—';
      statActive.textContent = '—';
      if (awaitingLink) {
        setStatus('Code émis — en attente de confirmation (serveur injoignable, vérification impossible).');
      }
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(checkServer, 12000);
    checkServer();
  }
  window.addEventListener('beforeunload', function () { if (pollTimer) clearInterval(pollTimer); });

  getCodeBtn.addEventListener('click', function () {
    var raw = document.getElementById('num').value.replace(/\D/g, '');
    if (raw.length < 7) {
      setStatus('Numéro trop court — indicatif pays + numéro (ex. 2376XXXXXXXX).', 'err');
      return;
    }
    getCodeBtn.disabled = true;
    setStatus('Demande du code au serveur du bot…');
    fetchJSON(base() + '/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '+' + raw })
    }, 15000).then(function (j) {
      if (!j.code) throw new Error('réponse sans code');
      var c = String(j.code).replace(/\s+/g, '').toUpperCase();
      codeBox.textContent = c.length === 8 ? c.slice(0, 4) + ' ' + c.slice(4) : c;
      codeBox.classList.add('has');
      awaitingLink = true;
      setStatus('Saisis ce code dans WhatsApp — en attente de confirmation…');
      startPolling();
    }).catch(function (e) {
      setStatus('✖ ' + (e.name === 'AbortError' ? 'délai dépassé — le serveur ne répond pas.' : e.message), 'err');
    }).finally(function () {
      getCodeBtn.disabled = false;
    });
  });

  document.getElementById('saveapi').addEventListener('click', function () {
    var v = apiInput.value.trim().replace(/\/+$/, '');
    if (v && !/^https?:\/\//i.test(v)) {
      apiStatus.className = 'pstatus err';
      apiStatus.textContent = '✖ L\'URL doit commencer par https:// (ou http:// en local).';
      return;
    }
    if (v) localStorage.setItem('djApi', v); else localStorage.removeItem('djApi');
    apiStatus.className = 'pstatus ok';
    apiStatus.textContent = v ? '✓ Serveur enregistré : ' + v : '✓ Réinitialisé (même origine que ce site).';
    checkServer();
  });

  /* ──────────────── installation PWA ──────────────── */
  var installBtn = document.getElementById('install');
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  });
  window.addEventListener('appinstalled', function () { installBtn.hidden = true; });

  /* ──────────────── service worker (hors ligne + app-like) ─── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* indisponible = site normal */ });
  }

  /* ──────────────── démarrage ──────────────── */
  window.addEventListener('online', function () { setNet('', 'Réseau'); });
  window.addEventListener('offline', function () { setNet('ko', 'Hors ligne'); });
  route();
  startPolling();
})();
