// DJOUSSE TECH MD — comportements de la page d'accueil
// Fichier externe (script-src 'self' via la CSP) : aucun script inline.

// menu mobile
document.getElementById('burger').addEventListener('click', function () {
  document.getElementById('menu').classList.toggle('open');
});
document.querySelectorAll('#menu a').forEach(function (a) {
  a.addEventListener('click', function () { document.getElementById('menu').classList.remove('open'); });
});

// révélation au défilement
var io = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

// compteurs animés (valeurs réelles issues du bot)
var counted = false;
var statsIo = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) {
    if (!e.isIntersecting || counted) return;
    counted = true;
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = +el.dataset.count, start = performance.now(), dur = 900;
      function tick(now) {
        var p = Math.min((now - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  });
}, { threshold: .4 });
var firstStat = document.querySelector('.stats');
if (firstStat) statsIo.observe(firstStat);
