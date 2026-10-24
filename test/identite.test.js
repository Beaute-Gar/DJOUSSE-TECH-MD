'use strict';
/* Mission identité DJOUSE-TECH-MD — garde-fous REPRODUCTIBLES :
   1. aucune marque tierce (Silva/TEDDY/SilvaTech…) visible par l'utilisateur ;
   2. commandes tierces dangereuses/identitaires neutralisées côté chargeur ;
   3. commandes maison .repo / .support / .ia en place, silva hors menus ;
   4. URLs tierces réécrites vers les destinations officielles ;
   5. slogan + chiffres du README cohérents avec le registre réel ;
   6. ancien logo tierce en repli réécrit vers le logo officiel maison. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.HACKTOOLS_PASSWORD = 'test-identite';
const h = require('../handler');
const { toUnicode } = require('../style');
const {
  retirerSignatureTierce, BLOQUES_IDENTITE, INTERDITS,
  normaliserContenu, URL_LOGO_TIERCE, URL_LOGO_OFFICIEL,
} = require('../lib/silva-loader');

const MARQUE = /\bSilva\b|SilvaTech|Silvatech|SILVA MD|TEDDY-XMD|Chez TEDDY|silva\.tech|SilvaTechB/i;
const site = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

/* ── 1. Rendus visibles : zéro marque tierce ── */
test('menus et sous-menus : aucune marque tierce affichée', () => {
  const base = { isOwner: true, isAdmin: true };
  const rendus = [h.renderMainMenu(base)];
  for (const c of h.CATEGORIES) {
    rendus.push(h.renderCategory(c.n, base));
    rendus.push(h.renderCategory(c.n, { isOwner: false }));
  }
  rendus.push(h.renderGroupMenu());
  rendus.push(h.renderArchives(base));
  const tout = rendus.join('\n');
  assert.ok(!MARQUE.test(tout), `marque tierce dans un rendu : ${(tout.match(MARQUE) || [])[0]}`);
});

test('descriptions du registre : aucune marque tierce', () => {
  const vus = new Set();
  for (const e of h.commands.values()) {
    if (vus.has(e)) continue;
    vus.add(e);
    const d = String(e.desc || '');
    assert.ok(!MARQUE.test(d), `desc « ${e.name} » : ${d.slice(0, 60)}`);
  }
});

test('README : identité, slogan et chiffres cohérents', () => {
  assert.ok(!/\bSilva\b|SilvaTech|TEDDY-XMD/i.test(site), 'README sans marque tierce');
  assert.ok(site.includes('Des solutions fiables pour un avenir sans limites'), 'slogan présent');
  assert.ok(site.includes('Beaute-Gar/DJOUSSE-TECH-MD'), 'dépôt officiel cité');
  assert.ok(!site.includes('237693978044'), 'numéro owner non exposé');
  assert.ok(!/11 catégories|commandes-855|lines=363/.test(site), 'chiffres mis à jour (12 catégories)');
});

/* ── 2. Blocages (chargeur silva, fichier source intact) ── */
test('commandes tierces dangereuses/identitaires ABSENTES du registre', () => {
  /* serveur de session tiers (fuite de numéros + pair-code) */
  for (const n of ['getcode', 'paircode', 'sessioncode', 'connectbot',
    'lend', 'approvelend', 'rejectlend', 'lendlist', 'lendstatus', 'revokelend']) {
    assert.ok(!h.commands.has(n), `${n} (serveur de session tiers) ne doit pas exister`);
  }
  /* anciens dépôts d'un autre auteur + support tiers */
  for (const n of ['silvatech', 'silvarepos', 'silvafiles', 'svrepo', 'call']) {
    assert.ok(!h.commands.has(n), `${n} (ancienne identité) ne doit pas exister`);
  }
  assert.ok(BLOQUES_IDENTITE.test('getcode') && BLOQUES_IDENTITE.test('svrepo'));
  assert.ok(!BLOQUES_IDENTITE.test('play') && !BLOQUES_IDENTITE.test('menu'));
});

test('versions tierces remplacées : .repo/.support/.ia maison', () => {
  for (const n of ['repo', 'repository']) {
    const e = h.commands.get(n);
    assert.ok(e, `.${n} enregistrée`);
    assert.match(e.desc, /Dépôt officiel/);
    assert.notEqual(e.cat, 99, '.repo visible au menu');
  }
  assert.match(h.commands.get('support').desc, /Support & signalement/);
  assert.equal(h.commands.get('ia').cat, 6, '.ia visible en IA');
  /* l'historique reste joignable en direct mais sort des menus */
  const silva = h.commands.get('silva');
  assert.ok(silva, '.silva toujours joignable (aucun usage cassé)');
  assert.equal(silva.cat, 99, '.silva retiré des menus');
});

/* ── 3. Nettoyage des textes tierces ── */
test('retirerSignatureTierce : URLs tierces → destinations officielles', () => {
  assert.equal(
    retirerSignatureTierce('Repo: https://github.com/SilvaTechB/silva-md-bot'),
    'Repo: https://github.com/Beaute-Gar/DJOUSSE-TECH-MD',
  );
  assert.ok(retirerSignatureTierce('https://silvatech.co.ke').includes('djousse-tech-md.vercel.app'));
  assert.ok(retirerSignatureTierce('https://session.silvatech.co.ke').includes('djousse-tech-md.vercel.app'));
  assert.ok(retirerSignatureTierce('Support: https://wa.me/254700143167').includes('/issues'));
  assert.ok(!/silva/i.test(retirerSignatureTierce('© 2025 Silvatech Inc · SILVA MD · Powered by Silva Tech Inc')));
});

test('retirerSignatureTierce : aides de commandes en minuscules intactes', () => {
  const s = '• "silva play <song>" • "silva silvatech repos"';
  assert.equal(retirerSignatureTierce(s), s, 'références de commandes préservées');
});

test('INTERDITS (crash/NSFW) inchangés', () => {
  assert.ok(INTERDITS.test('loccrash') && INTERDITS.test('hentai'));
  assert.ok(!INTERDITS.test('menu'));
});

test('logo maison : repli visuel tierce réécrit (11 plugins couverts)', () => {
  /* envoi d'image direct (alive, menu, repo, music, getpp…) */
  const c1 = normaliserContenu({ image: { url: URL_LOGO_TIERCE }, caption: 'test' });
  assert.equal(c1.image.url, URL_LOGO_OFFICIEL, 'image d’envoi → logo officiel');
  /* vignette de lien (facebook, instagram, statussave, owner) */
  const c2 = normaliserContenu({
    contextInfo: { externalAdReply: { thumbnailUrl: URL_LOGO_TIERCE, title: 'x' } },
  });
  assert.equal(c2.contextInfo.externalAdReply.thumbnailUrl, URL_LOGO_OFFICIEL,
    'vignette externalAdReply → logo officiel');
  /* aucune autre image n'est touchée */
  const c3 = normaliserContenu({ image: { url: 'https://example.com/photo.jpg' } });
  assert.equal(c3.image.url, 'https://example.com/photo.jpg');
  assert.notEqual(URL_LOGO_TIERCE, URL_LOGO_OFFICIEL);
});

/* ── 4. config : identité + slogan ── */
test('config : identité officielle + slogan + liens', () => {
  const config = require('../config');
  /* BOT_NAME / OWNER_NAME / SLOGAN sont surchargeables par .env :
     on exige la cohérence d'identité, pas la valeur littérale. */
  assert.match(String(config.botName), /^DJOUSSE/, 'botName DJOUSE');
  assert.ok(String(config.botOwnerName).length >= 3, 'botOwnerName défini');
  assert.match(config.slogan, /avenir sans limites/, 'slogan officiel');
  assert.equal(config.social.github, 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD');
  assert.equal(config.social.website, 'https://djousse-tech-md.vercel.app');
});

/* ── 5. hacktools : plus de marque tierce dans l'alerte affichée ── */
test('alerte hacktools sans ancienne marque', () => {
  const { GROUPES } = require('../lib/hacktools');
  const alertes = GROUPES.map((g) => g.alerte || '').join('\n');
  assert.ok(!/TEDDY|Silva/i.test(alertes), 'alerte sans marque tierce');
  assert.ok(alertes.includes('clé API tierce') || alertes.includes('.env'), 'message conservé');
});

/* ── 6. Le registre total reste cohérent (pas de commande fantôme) ── */
test('chiffres du registre : totaux README vérifiables', () => {
  const vus = new Set(h.commands.values());
  assert.equal(vus.size, 852, '852 commandes distinctes (README)');
  assert.equal(h.commands.size, 1603, '1603 noms au registre (README)');
});
