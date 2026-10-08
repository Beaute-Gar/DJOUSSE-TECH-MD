// DJOUSSE TECH MD — page de connexion WhatsApp : affichage de l'état réel du bot
// Fichier externe (script-src 'self' via la CSP) : aucun script inline.
// Les données viennent de /api/bot/public (proxy Vercel → état live du bot).
(function () {
  'use strict';
  var ENDPOINT = '/api/bot/public';   // proxy Vercel → console de statut (lecture publique minimale)
  var POLL_MS = 3000;
  var STATES = ['qrCard', 'okCard', 'waitCard', 'offCard', 'errCard'];
  var lastQr = null;
  var timer = null;

  function $(id) { return document.getElementById(id); }

  function show(id) {
    STATES.forEach(function (s) { $(s).hidden = (s !== id); });
  }

  function pill(text, cls) {
    $('pillText').textContent = text;
    $('pill').className = 'pill' + (cls ? ' ' + cls : '');
  }

  /** QR brut (Baileys) → SVG scannable ; data-URL déjà prêt → <img>. */
  function renderQr(text) {
    if (text === lastQr && $('qrBox').firstChild) return;
    lastQr = text;
    var box = $('qrBox');
    if (text.indexOf('data:image') === 0) {
      box.textContent = '';
      var img = document.createElement('img');
      img.src = text;
      img.alt = 'QR de connexion WhatsApp';
      box.appendChild(img);
      return;
    }
    try {
      var qr = qrcode(0, 'M');            // 0 = version auto
      qr.addData(text);
      qr.make();
      box.innerHTML = qr.createSvgTag({
        cellSize: 8,
        margin: 32,                       // 4 modules de marge blanche (spec)
        scalable: true,
        alt: 'QR de connexion WhatsApp',
      });
    } catch (e) {
      box.innerHTML = '<div class="qr-fallback">QR illisible — la page va le régénérer.</div>';
      lastQr = null;
    }
  }

  function apply(s) {
    if (!s || s.ok === false) {
      show('errCard');
      pill('Service injoignable', 'off');
      return;
    }
    if (s.online && s.qr) {
      show('qrCard');
      renderQr(String(s.qr));
      pill('QR en attente de scan', '');
      return;
    }
    if (s.online && s.connected) {
      show('okCard');
      $('okDetail').textContent = s.numberMasked
        ? 'Connecté en tant que ' + s.numberMasked
        : 'Le bot est en ligne';
      pill('Connecté', '');
      return;
    }
    if (s.online) {
      show('waitCard');
      pill('Préparation du QR…', 'wait');
      return;
    }
    show('offCard');
    pill('Bot hors ligne', 'off');
  }

  function tick() {
    fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(apply)
      .catch(function () { apply(null); })
      .then(function () { timer = setTimeout(tick, POLL_MS); });
  }

  function restart() { clearTimeout(timer); lastQr = null; tick(); }

  $('retry').addEventListener('click', restart);
  $('retry2').addEventListener('click', restart);
  tick();
})();
