'use strict';
/**
 * Outils média & utilitaires — APIs gratuites + traitement local (sharp)
 * Sans boutons interactifs. Style via ctx.success / ctx.error / ctx.reply.
 */
const { httpGet } = require('./http-get');

function svgTextSticker(top, bottom, w = 512, h = 512) {
  const esc = (s) =>
    String(s || '')
      .slice(0, 40)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const t = esc(top);
  const b = esc(bottom);
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#000"/>
      <text x="50%" y="18%" text-anchor="middle" font-size="42" font-family="Arial Black, Arial, sans-serif" fill="#fff" stroke="#000" stroke-width="4" paint-order="stroke">${t}</text>
      <text x="50%" y="88%" text-anchor="middle" font-size="42" font-family="Arial Black, Arial, sans-serif" fill="#fff" stroke="#000" stroke-width="4" paint-order="stroke">${b}</text>
    </svg>`
  );
}

function registerTools(cmd, deps) {
  const {
    config,
    mediaInfo,
    downloadFrom,
    sharp,
    Sticker,
    StickerTypes,
    buildFrame,
    bullet,
  } = deps;

  async function needImage(ctx) {
    const info = mediaInfo(ctx.msg);
    if (!info || !String(info.mimetype || '').startsWith('image/')) {
      await ctx.error(['RÉPONDS À UNE IMAGE']);
      return null;
    }
    return info;
  }

  /* ── SMEME : texte sur image → sticker ── */
  cmd('smeme', ['stickermeme', 'memesticker'], {
    cat: 4, desc: 'Meme sticker (texte haut | bas)', usage: 'smeme haut | bas (répondre image)', icon: '😂',
  }, async (ctx) => {
    const info = await needImage(ctx);
    if (!info) return;
    const [top, bottom] = (ctx.q || ' | ').split('|').map((s) => s.trim());
    if (!top && !bottom) return ctx.error(['USAGE', `${config.prefix}SMEME HAUT | BAS`]);
    await ctx.reply(config.messages.wait);
    try {
      const img = await downloadFrom(ctx.sock, info);
      const base = await sharp(img).resize(512, 512, { fit: 'cover' }).png().toBuffer();
      const overlay = await sharp(svgTextSticker(top || ' ', bottom || ' ')).png().toBuffer();
      const composed = await sharp(base).composite([{ input: overlay, blend: 'over' }]).webp().toBuffer();
      const sticker = new Sticker(composed, {
        pack: config.packname,
        author: config.author,
        type: StickerTypes.FULL,
        quality: 80,
      });
      await send(ctx.sock, ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
    } catch (e) {
      await ctx.error(['SMEME ÉCHEC', e.message]);
    }
  });

  /* ── Filtres image (local sharp — gratuit) ── */
  async function filterCmd(name, transform) {
    cmd(name, { cat: 4, desc: `Filtre image : ${name}`, usage: `${name} (répondre image)`, icon: '🎨' }, async (ctx) => {
      const info = await needImage(ctx);
      if (!info) return;
      await ctx.reply(config.messages.wait);
      try {
        const buf = await downloadFrom(ctx.sock, info);
        const out = await transform(sharp(buf)).jpeg({ quality: 85 }).toBuffer();
        await send(ctx.sock, ctx.from, { image: out, caption: `🎨 ${name}` }, { quoted: ctx.msg });
      } catch (e) {
        await ctx.error([name.toUpperCase(), e.message]);
      }
    });
  }

  filterCmd('blur', (s) => s.resize(1024, 1024, { fit: 'inside' }).blur(8));
  filterCmd('grey', (s) => s.resize(1024, 1024, { fit: 'inside' }).greyscale());
  filterCmd('invert', (s) => s.resize(1024, 1024, { fit: 'inside' }).negate());
  filterCmd('sepia', (s) => s.resize(1024, 1024, { fit: 'inside' }).modulate({ saturation: 0.3 }).tint('#704214'));
  filterCmd('circle', (s) =>
    s.resize(512, 512, { fit: 'cover' }).composite([
      {
        input: Buffer.from(
          `<svg><circle cx="256" cy="256" r="256" fill="white"/></svg>`
        ),
        blend: 'dest-in',
      },
    ]).png()
  );

  /* ── REMOVEBG (API remove.bg — quota gratuit avec clé .env) ── */
  cmd('removebg', ['nobg', 'rmbg'], {
    cat: 4, desc: 'Supprimer le fond (remove.bg)', usage: 'removebg (répondre image)', icon: '🪄',
  }, async (ctx) => {
    const key = process.env.REMOVEBG_API_KEY || '';
    if (!key) return ctx.error(['CLÉ REMOVEBG_API_KEY MANQUANTE', 'AJOUTE-LA DANS .ENV (QUOTA GRATUIT)']);
    const info = await needImage(ctx);
    if (!info) return;
    await ctx.reply(config.messages.wait);
    try {
      const buf = await downloadFrom(ctx.sock, info);
      const FormData = require('form-data');
const { send } = require('./wa-send');
      let form;
      try {
        form = new FormData();
      } catch (_) {
        // sans form-data : envoi multipart manuel minimal
        const boundary = '----Djousse' + Date.now();
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image_file"; filename="img.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
          buf,
          Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\nauto\r\n--${boundary}--\r\n`),
        ]);
        const out = await new Promise((resolve, reject) => {
          const req = https.request(
            {
              hostname: 'api.remove.bg',
              path: '/v1.0/removebg',
              method: 'POST',
              headers: {
                'X-Api-Key': key,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
              },
              timeout: 60000,
            },
            (res) => {
              const chunks = [];
              res.on('data', (c) => chunks.push(c));
              res.on('end', () => {
                const b = Buffer.concat(chunks);
                if (res.statusCode !== 200) reject(new Error(b.toString().slice(0, 120) || `HTTP ${res.statusCode}`));
                else resolve(b);
              });
            }
          );
          req.on('error', reject);
          req.write(body);
          req.end();
        });
        await send(ctx.sock, ctx.from, { image: out, caption: '🪄 Fond retiré' }, { quoted: ctx.msg });
        return;
      }
      form.append('image_file', buf, { filename: 'img.jpg' });
      form.append('size', 'auto');
      const out = await new Promise((resolve, reject) => {
        form.submit(
          { host: 'api.remove.bg', path: '/v1.0/removebg', protocol: 'https:', headers: { 'X-Api-Key': key } },
          (err, res) => {
            if (err) return reject(err);
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              const b = Buffer.concat(chunks);
              if (res.statusCode !== 200) reject(new Error(b.toString().slice(0, 120)));
              else resolve(b);
            });
          }
        );
      });
      await send(ctx.sock, ctx.from, { image: out, caption: '🪄 Fond retiré' }, { quoted: ctx.msg });
    } catch (e) {
      await ctx.error(['REMOVEBG ÉCHEC', e.message, 'VÉRIFIE LA CLÉ / QUOTA GRATUIT']);
    }
  });

  /* ── TTS Google Translate (gratuit, sans clé) ── */
  cmd('tts', ['say', 'parle'], {
    cat: 5, desc: 'Texte → voix (TTS gratuit)', usage: 'tts [lang] <texte>', icon: '🔊',
  }, async (ctx) => {
    let lang = 'fr';
    let text = ctx.q;
    const first = (ctx.args[0] || '').toLowerCase();
    if (/^[a-z]{2}$/.test(first) && ctx.args.length > 1) {
      lang = first;
      text = ctx.args.slice(1).join(' ');
    }
    if (!text) return ctx.error(['USAGE', `${config.prefix}TTS FR BONJOUR`]);
    text = text.slice(0, 180);
    try {
      const url =
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}` +
        `&tl=${lang}&client=tw-ob`;
      const audio = await httpGet(url, {
        headers: { Referer: 'https://translate.google.com/', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!audio || audio.length < 100) throw new Error('Audio vide (bloqué ?)');
      await send(ctx.sock, 
        ctx.from,
        { audio, mimetype: 'audio/mpeg', ptt: true },
        { quoted: ctx.msg }
      );
    } catch (e) {
      await ctx.error(['TTS ÉCHEC', e.message]);
    }
  });

  /* ── EMOJIMIX (CDN Google Emoji Kitchen — gratuit) ── */
  cmd('emojimix', ['emix', 'mixemoji'], {
    cat: 7, desc: 'Mélanger 2 emojis', usage: 'emojimix 😀+🔥', icon: '😀',
  }, async (ctx) => {
    const raw = (ctx.q || '').replace(/\s/g, '');
    const parts = raw.split(/[+|]/);
    if (parts.length < 2) return ctx.error(['USAGE', `${config.prefix}EMOJIMIX 😀+🔥`]);
    const e1 = parts[0];
    const e2 = parts[1];
    try {
      // API communautaire gratuite (emoji.gg style fallback via tenorless)
      const code1 = [...e1].map((c) => c.codePointAt(0).toString(16)).join('-');
      const code2 = [...e2].map((c) => c.codePointAt(0).toString(16)).join('-');
      // Endpoint public souvent utilisé (peut évoluer)
      const url = `https://api.otakikode.com/emoji-mix?emoji1=${encodeURIComponent(e1)}&emoji2=${encodeURIComponent(e2)}`;
      let buf;
      try {
        buf = await httpGet(url);
        if (buf.length < 500 || buf.slice(0, 1).toString() === '{') throw new Error('json');
      } catch (_) {
        // Fallback sticker texte
        const svg = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
            <rect width="100%" height="100%" fill="#1a1a2e"/>
            <text x="50%" y="55%" text-anchor="middle" font-size="140">${e1}${e2}</text>
          </svg>`
        );
        buf = await sharp(svg).png().toBuffer();
      }
      const sticker = new Sticker(buf, {
        pack: config.packname,
        author: config.author,
        type: StickerTypes.FULL,
        quality: 80,
      });
      await send(ctx.sock, ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
    } catch (e) {
      await ctx.error(['EMOJIMIX ÉCHEC', e.message]);
    }
  });

  /* ── QUOTE (API gratuite quotable) ── */
  cmd('quote', ['citation'], {
    cat: 7, desc: 'Citation aléatoire (API gratuite)', icon: '💬',
  }, async (ctx) => {
    try {
      const data = await httpGet('https://api.quotable.io/random', { json: true });
      await ctx.reply(
        buildFrame('CITATION', [
          bullet('TEXTE', data.content),
          bullet('AUTEUR', data.author || '?'),
        ])
      );
    } catch (e) {
      await ctx.error(['QUOTE ÉCHEC', e.message]);
    }
  });

  /* ── SHORT URL (is.gd gratuit) ── */
  cmd('short', ['shorturl', 'tiny'], {
    cat: 5, desc: 'Raccourcir une URL (is.gd gratuit)', usage: 'short <url>', icon: '🔗',
  }, async (ctx) => {
    const url = (ctx.q || '').trim();
    if (!/^https?:\/\//i.test(url)) return ctx.error(['USAGE', `${config.prefix}SHORT HTTPS://...`]);
    try {
      const short = await httpGet(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
      await ctx.success(['LIEN COURT', short.toString('utf8').trim()]);
    } catch (e) {
      await ctx.error(['SHORT ÉCHEC', e.message]);
    }
  });

  /* ── IP / WHOIS simple (ip-api gratuit) ── */
  cmd('ip', {
    cat: 5, desc: 'Infos IP (ip-api gratuit)', usage: 'ip [adresse]', icon: '🌐',
  }, async (ctx) => {
    const q = (ctx.q || '').trim() || '';
    try {
      const data = await httpGet(`http://ip-api.com/json/${encodeURIComponent(q)}?fields=status,message,country,regionName,city,isp,query,timezone`, { json: true });
      if (data.status !== 'success') throw new Error(data.message || 'fail');
      await ctx.reply(
        buildFrame('IP', [
          bullet('IP', data.query),
          bullet('PAYS', data.country),
          bullet('VILLE', `${data.city || ''} ${data.regionName || ''}`.trim()),
          bullet('FAI', data.isp),
          bullet('TZ', data.timezone),
        ])
      );
    } catch (e) {
      await ctx.error(['IP ÉCHEC', e.message]);
    }
  });

  /* ── FACT / CHUCK (APIs gratuites) ── */
  cmd('fact', {
    cat: 7, desc: 'Fait aléatoire (API gratuite)', icon: '📚',
  }, async (ctx) => {
    try {
      const data = await httpGet('https://uselessfacts.jsph.pl/api/v2/facts/random', { json: true });
      await ctx.reply(`📚 ${data.text || data}`);
    } catch (e) {
      await ctx.error(['FACT ÉCHEC', e.message]);
    }
  });

  cmd('jokeen', {
    cat: 7, desc: 'Blague EN (API gratuite)', icon: '🤣',
  }, async (ctx) => {
    try {
      const data = await httpGet('https://official-joke-api.appspot.com/random_joke', { json: true });
      await ctx.reply(`🤣 *${data.setup}*\n\n_${data.punchline}_`);
    } catch (e) {
      await ctx.error(['JOKE ÉCHEC', e.message]);
    }
  });

  /* ── WANTED poster (local sharp) ── */
  cmd('wanted', {
    cat: 4, desc: 'Poster Wanted (répondre image)', usage: 'wanted [nom]', icon: '🤠',
  }, async (ctx) => {
    const info = await needImage(ctx);
    if (!info) return;
    const name = (ctx.q || 'WANTED').slice(0, 20).toUpperCase();
    await ctx.reply(config.messages.wait);
    try {
      const buf = await downloadFrom(ctx.sock, info);
      const face = await sharp(buf).resize(400, 400, { fit: 'cover' }).greyscale().png().toBuffer();
      const svg = Buffer.from(
        `<svg width="512" height="640" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f4e4bc"/>
          <text x="50%" y="48" text-anchor="middle" font-size="48" font-family="serif" font-weight="bold" fill="#3b1f0e">WANTED</text>
          <text x="50%" y="600" text-anchor="middle" font-size="36" font-family="serif" fill="#3b1f0e">${name.replace(/[<>&]/g, '')}</text>
        </svg>`
      );
      const bg = await sharp(svg).png().toBuffer();
      const out = await sharp(bg)
        .composite([{ input: face, top: 80, left: 56 }])
        .jpeg()
        .toBuffer();
      await send(ctx.sock, ctx.from, { image: out, caption: `🤠 ${name}` }, { quoted: ctx.msg });
    } catch (e) {
      await ctx.error(['WANTED ÉCHEC', e.message]);
    }
  });

  /* ── TOURL (upload temporaire gratuit file.io / 0x0) ── */
  cmd('tour', {
    cat: 5, desc: 'Upload média → lien temporaire (0x0.st)', usage: 'tour (répondre média)', icon: '☁️',
  }, async (ctx) => {
    const info = mediaInfo(ctx.msg);
    if (!info) return ctx.error(['RÉPONDS À UN MÉDIA']);
    await ctx.reply(config.messages.wait);
    try {
      const buf = await downloadFrom(ctx.sock, info);
      const boundary = '----Dj' + Date.now();
      const filename = `file.${(info.mimetype || 'bin').split('/')[1] || 'bin'}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${info.mimetype || 'application/octet-stream'}\r\n\r\n`),
        buf,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const link = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: '0x0.st',
            method: 'POST',
            path: '/',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': body.length,
              'User-Agent': 'curl/8.0',
            },
            timeout: 60000,
          },
          (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
          }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      if (!/^https?:\/\//i.test(link)) throw new Error(link.slice(0, 80) || 'upload fail');
      await ctx.success(['LIEN TEMPORAIRE', link]);
    } catch (e) {
      await ctx.error(['TOURL ÉCHEC', e.message]);
    }
  });

  /* ── RESIZE ── */
  cmd('resize', {
    cat: 4, desc: 'Redimensionner image', usage: 'resize 512 512 (répondre image)', icon: '📐',
  }, async (ctx) => {
    const info = await needImage(ctx);
    if (!info) return;
    const w = Math.min(2048, Math.max(16, parseInt(ctx.args[0] || '512', 10) || 512));
    const h = Math.min(2048, Math.max(16, parseInt(ctx.args[1] || String(w), 10) || w));
    try {
      const buf = await downloadFrom(ctx.sock, info);
      const out = await sharp(buf).resize(w, h, { fit: 'fill' }).jpeg().toBuffer();
      await send(ctx.sock, ctx.from, { image: out, caption: `📐 ${w}x${h}` }, { quoted: ctx.msg });
    } catch (e) {
      await ctx.error(['RESIZE ÉCHEC', e.message]);
    }
  });
}

module.exports = { registerTools };
