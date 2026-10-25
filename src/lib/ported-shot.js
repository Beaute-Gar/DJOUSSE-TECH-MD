'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDE PORTÉE DE TEDDY-XMD — « screenshot d'un site web »
 * ──────────────────────────────────────────────────────────────────
 * TEDDY divisait ça en 15 commandes (screenswidth, screenscrop, maxage,
 * png, noanimate, wait, viewportwidth, iphone5/6/6plus/x/12pro/14promax,
 * galaxys5, screenshot). Ici UNE commande avec des options — même
 * service, même API (image.thum.io), testée en réel.
 *
 * Référence TEDDY : plugins/hentae.js:478
 * ══════════════════════════════════════════════════════════════════
 */

/* presets d'appareils (repris de TEDDY) */
const DEVICES = {
  iphone5: [320, 568], iphone6: [375, 667], iphone6plus: [414, 736],
  iphonex: [375, 812], iphone12pro: [390, 844], iphone14promax: [430, 932],
  galaxys5: [360, 640],
};

function buildThum(url, opts) {
  const parts = [];
  const device = String(opts.device || '').toLowerCase();
  if (device && DEVICES[device]) {
    const [w, h] = DEVICES[device];
    parts.push('width', String(w), 'crop', String(h));
  }
  if (opts.width) parts.push('width', String(opts.width));
  if (opts.full) parts.push('fullpage');
  if (opts.crop && !opts.device) parts.push('crop', String(opts.crop));
  if (opts.png) parts.push('png');
  if (opts.noanimate) parts.push('noanimate');
  if (opts.wait) parts.push('wait', String(opts.wait));
  if (opts.maxage) parts.push('maxAge', String(opts.maxage));
  return `https://image.thum.io/get/${[...parts, url].join('/')}`;
}

function registerPortedShot(cmd, deps) {
  const { config, send } = deps;

  cmd('screenshot', ['ss'], {
    cat: 5, desc: "Capture d'écran d'un site web", usage: 'screenshot <url> [full|width=N|crop=N|wait=N|png|iphoneX|…]', icon: '📸',
  }, async (c) => {
    const raw = (c.q || '').trim();
    if (!raw) {
      await c.error(['URL MANQUANTE', `${config.prefix}SCREENSHOT <URL> [full]`]);
      return c.reply(`Options : full · width=1200 · crop=900 · wait=5 · png · noanimate · iphone5/6/6plus/x/12pro/14promax · galaxys5\nExemple : ${config.prefix}ss https://exemple.com full`);
    }
    const tokens = raw.split(/\s+/);
    const opts = { raw, width: null, crop: null, wait: null, maxage: null, full: false, png: false, noanimate: false, device: null };
    const urlParts = [];
    for (const t of tokens) {
      const low = t.toLowerCase();
      if (low === 'full' || low === 'fullpage') opts.full = true;
      else if (low === 'png') opts.png = true;
      else if (low === 'noanimate') opts.noanimate = true;
      else if (DEVICES[low]) opts.device = low;
      else {
        const m = t.match(/^(width|crop|wait|maxage|maxAge)=(-?\d+)$/);
        if (m) {
          if (m[1] === 'width') opts.width = Number(m[2]);
          else if (m[1] === 'crop') opts.crop = Number(m[2]);
          else if (m[1] === 'wait') opts.wait = Number(m[2]);
          else opts.maxage = Number(m[2]);
        } else urlParts.push(t);
      }
    }
    const url = urlParts.join(' ');
    let cible = url;
    if (!/^https?:\/\//i.test(cible)) cible = `https://${cible}`;
    try { new URL(cible); } catch { return c.error(['URL INVALIDE', url]); }

    const image = buildThum(cible, opts);
    try {
      await send(c.sock, c.from, { image: { url: image }, caption: `📸 ${cible} — DJOUSSE TECH` }, { quoted: c.msg });
    } catch (e) {
      await c.error(['CAPTURE ÉCHEC', e.message]);
    }
  });
}

module.exports = { registerPortedShot, buildThum, DEVICES };
