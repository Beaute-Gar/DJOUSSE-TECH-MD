'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * SECTION « HACKTOOLS » — commandes à risque, verrouillées
 * ──────────────────────────────────────────────────────────────────
 * Toutes les commandes de ce fichier sont en cat 99 : cette catégorie
 * n'existe PAS dans CATEGORIES (1→11), donc elles n'apparaissent dans
 * AUCUN menu (menu principal, sous-menus, .list).
 * L'unique point d'entrée est `.hacktools`, réservé au propriétaire et
 * protégé par un mot de passe défini dans .env (HACKTOOLS_PASSWORD).
 *
 * ⚠️ DISTINCTION ASSUMÉE :
 *   · les commandes UTILES mais qui violent une règle de sécurité
 *     (secret en dur, API tierce) ont été RÉPARÉES et sont portées ici :
 *       imdb, stickersearch, paste, technews, emomix, videodoc.
 *   · les commandes ARME ANTI-COMPTE (crash WhatsApp) et le contenu
 *     sexuel/vulgaire ne sont PAS implémentées : elles sont listées avec
 *     le statut NEUTRALISÉE et la raison. Faire planter l'application
 *     WhatsApp d'un tiers est une attaque, et le premier compte banni
 *     serait le tien.
 * ══════════════════════════════════════════════════════════════════
 */
const crypto = require('node:crypto');

/* Toutes les commandes de ce module partagent cette catégorie fantôme */
const CAT = 99;

const SESSION_MS = 10 * 60 * 1000; // 10 min après le bon mot de passe
const sessions = new Map(); // sender -> expiresAt

function hashPwd(p) {
  return crypto.createHash('sha256').update(String(p)).digest('hex');
}

function motDePasseAttendu() {
  return String(process.env.HACKTOOLS_PASSWORD || '').trim();
}

function estAutorise(sender) {
  const exp = sessions.get(sender);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(sender); return false; }
  sessions.set(sender, Date.now() + SESSION_MS); // glissant
  return true;
}

/* ══════════ contenu du menu ══════════ */
const GROUPES = [
  {
    cle: 'armes',
    titre: 'ARMES ANTI-COMPTE (NON IMPLÉMENTÉES)',
    alerte: 'Fait planter l’application WhatsApp d’autres personnes. Illégal dans la plupart des pays, et le premier compte banni sera le tien.',
    items: [
      ['loccrash', 'Crash par localisation piégée'],
      ['crashbug', 'Crash générique'],
      ['amountbug', 'Crash par montant'],
      ['pmbug', 'Crash message privé'],
      ['delaybug', 'Crash temporisé'],
      ['docubug', 'Crash par document'],
      ['unlimitedbug', 'Crash bouclé'],
      ['bombug', 'Crash bombe'],
      ['lagbug', 'Lag forcé'],
      ['trollybug', 'Crash trolley'],
      ['terminate', 'Vidage total d’un groupe (aliases : crash, kill, destroy, paralyze)'],
    ],
    statut: 'NEUTRALISÉE',
  },
  {
    cle: 'adulte',
    titre: 'CONTENU SEXUEL / VULGAIRE (NON IMPLÉMENTÉ)',
    alerte: 'Contenu réservé aux adultes : bannissement quasi certain du numéro et interdiction aux mineurs.',
    items: [
      ['nikal', 'Animation ASCII vulgaire'],
      ['hand', 'Animation à sous-entendu sexuel'],
      ['hentai', 'Hentai'],
      ['hwaifu', 'Waifu NSFW'],
      ['trap', 'Trap NSFW'],
      ['hneko', 'Neko NSFW'],
      ['hentaivid', 'Vidéo hentai'],
      ['blowjobs', 'Catégorie adulte explicite'],
      ['waifues', 'Waifu NSFW'],
    ],
    statut: 'NEUTRALISÉE',
  },
  {
    cle: 'secret',
    titre: 'SECRET EN DUR (RÉPARÉ — clé dans .env)',
    alerte: 'Ces commandes exposaient une clé API appartenant à quelqu’un d’autre. Ici la clé vient de ton .env : aucune n’est écrite dans le code.',
    items: [
      ['imdb', 'Film : note, casting, synopsis (OMDB_API_KEY)'],
      ['stickersearch', 'Recherche de GIF (TENOR_API_KEY)'],
      ['paste', 'Texte → page Telegraph (jeton créé à la volée, rien en dur)'],
      ['technews', 'Actu tech (API tierce, optionnel)'],
      ['emomix', 'Mélange de 2 emojis (API tierce)'],
      ['videodoc', 'Vidéo → document (APIs tierces)'],
    ],
    statut: 'PORTÉE',
  },
];

function registerHackTools(cmd, deps) {
  const { config, send, buildFrame, bullet, note } = deps;

  /* ══════════ point d'entrée unique ══════════ */
  cmd('hacktools', {
    cat: CAT, owner: true, desc: 'Section à risque (mot de passe requis)',
    usage: 'hacktools <mot de passe>', icon: '☠️',
  }, async (c) => {
    const attendu = motDePasseAttendu();
    if (!attendu) {
      return c.error([
        'SECTION VERROUILLÉE',
        'Aucun mot de passe défini.',
        'Ajoute HACKTOOLS_PASSWORD dans ton .env puis relance.',
      ]);
    }
    const fourni = (c.args.join(' ') || c.q || '').trim();
    if (!fourni) {
      return c.error([
        'MOT DE PASSE REQUIS',
        `${config.prefix}hacktools <mot de passe>`,
        'Cette section ne s’affiche nulle part ailleurs.',
      ]);
    }
    const a = Buffer.from(hashPwd(fourni));
    const b = Buffer.from(hashPwd(attendu));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return c.error(['MOT DE PASSE INCORRECT', 'Accès refusé.']);
    }
    sessions.set(c.sender, Date.now() + SESSION_MS);
    return c.reply(renderMenu(deps));
  });

  /* ══════════ commandes portées (toutes hors menu) ══════════ */

  /* imdb — clé dans .env */
  cmd('imdb', {
    cat: CAT, owner: true, desc: 'Film via OMDB (clé .env)',
    usage: 'imdb <titre>', icon: '🎬',
  }, async (c) => {
    const t = (c.q || '').trim();
    if (!t) return c.error(['TITRE MANQUANT', `${config.prefix}imdb <TITRE>`]);
    const key = String(process.env.OMDB_API_KEY || '').trim();
    if (!key) return c.error(['CLÉ REQUISE', 'Définis OMDB_API_KEY dans .env (gratuit : omdbapi.com/apikey.aspx)']);
    try {
      const r = await fetch(`https://www.omdbapi.com/?apikey=${key}&t=${encodeURIComponent(t)}&plot=short`, { signal: AbortSignal.timeout(15000) });
      const d = await r.json();
      if (d.Response === 'False') return c.error(['FILM INTROUVABLE', d.Error || t]);
      return c.reply(buildFrame(String(d.Title).toUpperCase(), [
        bullet('ANNÉE', String(d.Year)),
        bullet('GENRE', String(d.Genre)),
        bullet('RÉALISATEUR', String(d.Director)),
        bullet('ACTEURS', String(d.Actors).slice(0, 120)),
        bullet('NOTE', `${d.imdbRating}/10 (${d.imdbVotes} votes)`),
        bullet('SYNOPSIS', String(d.Plot).slice(0, 300)),
      ]));
    } catch (e) { return c.error(['IMDB ÉCHEC', e.message]); }
  });

  /* stickersearch — Tenor, clé dans .env */
  cmd('stickersearch', {
    cat: CAT, owner: true, desc: 'GIF Tenor (clé .env)',
    usage: 'stickersearch <recherche>', icon: '🔎',
  }, async (c) => {
    const t = (c.q || '').trim();
    if (!t) return c.error(['RECHERCHE MANQUANTE', `${config.prefix}stickersearch <MOTS>`]);
    const key = String(process.env.TENOR_API_KEY || '').trim();
    if (!key) return c.error(['CLÉ REQUISE', 'Définis TENOR_API_KEY dans .env (gratuit : tenor.com/gif-api)']);
    try {
      const r = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(t)}&key=${key}&limit=5`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return c.error(['TENOR INDISPONIBLE', String(r.status)]);
      const d = await r.json();
      const gifs = d?.results || [];
      if (!gifs.length) return c.error(['AUCUN GIF', t]);
      await send(c.sock, c.from, { video: { url: gifs[0].media_formats.gif.url }, gifPlayback: true, caption: `${t} — DJOUSSE` }, { quoted: c.msg });
    } catch (e) { return c.error(['STICKERSEARCH ÉCHEC', e.message]); }
  });

  /* paste — Telegraph, jeton créé à la volée (rien en dur) */
  cmd('paste', {
    cat: CAT, owner: true, desc: 'Texte → page Telegraph',
    usage: 'paste <texte>', icon: '📄',
  }, async (c) => {
    const t = (c.q || '').trim();
    if (!t) return c.error(['TEXTE MANQUANT', `${config.prefix}paste <TEXTE>`]);
    try {
      /* création d'un compte anonyme à la volée : PAS de jeton en dur */
      const acc = await fetch('https://api.telegra.ph/createAccount?short_name=DJOUSSE&author_name=DJOUSSE', { signal: AbortSignal.timeout(15000) });
      const accd = await acc.json();
      if (!accd?.result?.access_token) return c.error(['TELEGRAPH INDISPONIBLE', 'création de compte échouée']);
      const content = [{ tag: 'p', children: [String(t).slice(0, 8000)] }];
      const r = await fetch(`https://api.telegra.ph/createPage?access_token=${accd.result.access_token}&title=DJOUSSE%20-%20${Date.now()}&author_name=DJOUSSE&content=${encodeURIComponent(JSON.stringify(content))}&return_content=true`, { signal: AbortSignal.timeout(20000) });
      const d = await r.json();
      if (!d?.result?.url) return c.error(['CRÉATION ÉCHOUÉE', d?.error || 'inconnu']);
      return c.success(['PAGE CRÉÉE', d.result.url]);
    } catch (e) { return c.error(['PASTE ÉCHEC', e.message]); }
  });

  /* technews — API tierce, activable via .env */
  cmd('technews', {
    cat: CAT, owner: true, desc: 'Actu tech (API tierce)',
    usage: 'technews', icon: '📰',
  }, async (c) => {
    const base = String(process.env.TECHNEWS_API || 'https://fantox001-scrappy-api.vercel.app/technews/random').trim();
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(20000) });
      const d = await r.json();
      if (!d?.news) return c.error(['API TIERCE INDISPONIBLE', 'Change TECHNEWS_API dans .env']);
      return c.reply(buildFrame('ACTU TECH', [String(d.news).slice(0, 1200)]));
    } catch (e) { return c.error(['TECHNEWS ÉCHEC', e.message]); }
  });

  /* emomix — API tierce (levanter) */
  cmd('emomix', {
    cat: CAT, owner: true, desc: 'Mélange de 2 emojis (API tierce)',
    usage: 'emomix 😀+😍', icon: '🫂',
  }, async (c) => {
    const t = (c.q || '').replace(/[+\s]/g, '');
    const emojis = [...t].filter((ch) => ch.codePointAt(0) > 0x2000).slice(0, 2);
    if (emojis.length !== 2) return c.error(['USAGE', `${config.prefix}emomix 😀+😍`]);
    try {
      const r = await fetch(`https://levanter.onrender.com/emix?q=${emojis[0]}${emojis[1]}`, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) return c.error(['API TIERCE INDISPONIBLE', String(r.status)]);
      await send(c.sock, c.from, { sticker: Buffer.from(await r.arrayBuffer()) }, { quoted: c.msg });
    } catch (e) { return c.error(['EMOMIX ÉCHEC', e.message]); }
  });

  /* videodoc — APIs tierces multiples */
  cmd('videodoc', {
    cat: CAT, owner: true, desc: 'Vidéo → document (APIs tierces)',
    usage: 'videodoc <url>', icon: '🎞️',
  }, async (c) => {
    const t = (c.q || '').trim();
    if (!t) return c.error(['URL MANQUANTE', `${config.prefix}videodoc <URL>`]);
    const bases = [
      'https://api-rin-tohsaka.vercel.app/download/ytmp4?url=',
      'https://api.davidcyriltech.my.id/download/ytmp4?url=',
    ];
    for (const base of bases) {
      try {
        const r = await fetch(base + encodeURIComponent(t), { signal: AbortSignal.timeout(45000) });
        const d = await r.json();
        const url = d?.result?.url || d?.data?.url || d?.url;
        if (url) {
          const rr = await fetch(String(url), { signal: AbortSignal.timeout(60000) });
          if (rr.ok) {
            const buf = Buffer.from(await rr.arrayBuffer());
            await send(c.sock, c.from, { document: buf, mimetype: 'video/mp4', fileName: `video-${Date.now()}.mp4`, caption: 'DJOUSSE TECH' }, { quoted: c.msg });
            return;
          }
        }
      } catch { /* on tente l'API suivante */ }
    }
    return c.error(['TOUTES LES APIs TIERCES ONT ÉCHOUÉ']);
  });
}

/* ══════════ rendu du menu protégé ══════════ */
function renderMenu(deps) {
  const { buildFrame, bullet, note } = deps;
  const lignes = [];
  for (const g of GROUPES) {
    const lignesGroupe = [
      `Avertissement : ${g.alerte}`,
      `Statut : ${g.statut}`,
      ...g.items.map(([n, d]) => bullet(n, d)),
    ];
    lignes.push(buildFrame(g.titre, lignesGroupe), '');
  }
  lignes.push(buildFrame('SECTION HACKTOOLS', [
    bullet('ENTRÉE', '.hacktools <mot de passe>'),
    bullet('VISIBILITÉ', 'aucun menu — commande réservée owner'),
    bullet('SESSION', '10 minutes d’inactivité'),
    bullet('MOT DE PASSE', motDePasseAttendu() ? 'défini dans .env (comparaison hachée)' : 'NON DÉFINI — section désactivée'),
  ]));
  return note ? note(lignes.join('\n')) : lignes.join('\n');
}

module.exports = { registerHackTools, CAT, GROUPES, estAutorise };
