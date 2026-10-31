'use strict';
/**
 * test/envoi.test.js — CONTRÔLE D'ENVOI (lib/envoi)
 * ────────────────────────────────────────────────────────────────────
 * Couvre les cinq couches : fenêtres glissantes, montée en charge,
 * allowlist/consentement (HMAC), classification d'erreurs, mode dégradé,
 * et l'intégrité du journal chaîné. Base SQLite isolée dans un dossier
 * temporaire : aucun test ne touche data/bot.db.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-envoi-'));
process.env.DATA_DIR = DIR;
process.env.ENVOI_SEL = 'sel-de-test-stable';
process.env.HUMAN_DELAY = '0';
process.env.ENVOI_DELAI_MIN = '0';
process.env.ENVOI_JITTER_MAX = '0';
process.env.ENVOI_WARMUP = '0';
process.env.ENVOI_MAX_MINUTE = '1000';
process.env.ENVOI_MAX_HEURE = '10000';
process.env.ENVOI_MAX_JOUR = '10000';

const envoi = require('../src/lib/envoi');
const { store, limites, warmup, allowlist, erreurs, qualite } = envoi;
const waSend = require('../src/lib/wa-send');
const db = require('../src/lib/db');

/* ── utilitaires ───────────────────────────────────────────────────── */
const ENV_KEYS = [
  'ENVOI_ACTIF', 'ENVOI_MODE', 'ENVOI_WARMUP', 'ENVOI_DEGRADE',
  'ENVOI_MAX_MINUTE', 'ENVOI_MAX_HEURE', 'ENVOI_MAX_JOUR',
  'ENVOI_DELAI_MIN', 'ENVOI_JITTER_MAX',
];

function regler(vars = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, {
    ENVOI_DELAI_MIN: '0',
    ENVOI_JITTER_MAX: '0',
    ENVOI_WARMUP: '0',
    ENVOI_MAX_MINUTE: '1000',
    ENVOI_MAX_HEURE: '10000',
    ENVOI_MAX_JOUR: '10000',
  }, vars);
  qualite.retablir();
  store.definirEtat('pause_jusqua', '0');
  return envoi.config.recharger();
}

const consenti = (jid, source = 'inbound') => allowlist.consentir(jid, source);

function makeSock() {
  const envois = [];
  return {
    envois,
    sock: {
      sendMessage: async (jid, content) => { envois.push({ jid, content }); return { ok: 1 }; },
      sendPresenceUpdate: async () => {},
    },
  };
}

test.after(() => {
  try { db.close(path.join(DIR, 'bot.db')); } catch { /* déjà fermée */ }
  fs.rmSync(DIR, { recursive: true, force: true });
});

/* ═══ 1. FENÊTRES GLISSANTES ════════════════════════════════════════ */

test('limiteur : le premier plafond dépassé refuse (seconde → minute → heure → jour)', () => {
  const limitesCfg = { parSeconde: 1, parMinute: 20, parHeure: 200, parJour: 500 };

  let v = limites.evaluer({ maintenant: 0, comptes: { parSeconde: 1, parMinute: 0, parHeure: 0, parJour: 0 }, limites: limitesCfg });
  assert.equal(v.ok, false);
  assert.equal(v.code, 'LIMITE_SECONDE');

  v = limites.evaluer({ maintenant: 0, comptes: { parSeconde: 0, parMinute: 20, parHeure: 0, parJour: 0 }, limites: limitesCfg });
  assert.equal(v.code, 'LIMITE_MINUTE');

  v = limites.evaluer({ maintenant: 0, comptes: { parSeconde: 0, parMinute: 0, parHeure: 200, parJour: 0 }, limites: limitesCfg });
  assert.equal(v.code, 'LIMITE_HEURE');

  v = limites.evaluer({ maintenant: 0, comptes: { parSeconde: 0, parMinute: 0, parHeure: 0, parJour: 500 }, limites: limitesCfg });
  assert.equal(v.code, 'LIMITE_JOUR');

  v = limites.evaluer({ maintenant: 0, comptes: { parSeconde: 0, parMinute: 19, parHeure: 199, parJour: 499 }, limites: limitesCfg });
  assert.deepEqual(v, { ok: true });
});

test('limiteur : un plafond à 0 est explicitement désactivé', () => {
  const v = limites.evaluer({
    maintenant: 0,
    comptes: { parSeconde: 5, parMinute: 5, parHeure: 5, parJour: 5 },
    limites: { parSeconde: 0, parMinute: 0, parHeure: 0, parJour: 0 },
  });
  assert.equal(v.ok, true);
});

test('limiteur : les refus ne consomment pas le budget (compterDepuis)', () => {
  regler();
  const jid = '237699000001@s.whatsapp.net';
  consenti(jid);
  store.journaliser({ jid, type: 'texte', resultat: 'ok' });
  store.journaliser({ jid, type: 'texte', resultat: 'refus', raison: 'test' });
  const n = store.compterDepuis(Date.now() - 60000);
  const refus = store.bilanDepuis(Date.now() - 60000).refus;
  assert.ok(refus >= 1, 'le refus est bien journalisé');
  assert.equal(store.compterDepuis(Date.now() - 60000, Date.now(), { inclureRefus: true }), n + refus);
});

/* ═══ 2. MONTÉE EN CHARGE (WARM-UP) ═════════════════════════════════ */

test('warm-up : palier du jour respecté, dépassement refusé avec un code clair', () => {
  const jour0 = new Date(2026, 0, 10, 9, 0, 0).getTime();
  const paliers = [50, 80, 120, 160, 200];

  const ok = warmup.evaluer({ maintenant: jour0 + 3600000, dateDebut: jour0, paliers, envoyesJour: 49 });
  assert.equal(ok.ok, true);
  assert.equal(ok.jour, 0);
  assert.equal(ok.palier, 50);

  const ko = warmup.evaluer({ maintenant: jour0 + 3600000, dateDebut: jour0, paliers, envoyesJour: 50 });
  assert.equal(ko.ok, false);
  assert.equal(ko.code, 'WARMUP_PALIER_DEPASSE');
  assert.match(ko.raison, /50\/50/);
});

test('warm-up : jour 4 = 5ᵉ palier ; après le plan, le dernier palier se répète', () => {
  const jour0 = new Date(2026, 0, 10, 9, 0, 0).getTime();
  const paliers = [50, 80, 120, 160, 200];
  const j4 = warmup.evaluer({
    maintenant: jour0 + 4 * 86400000 + 3600000, dateDebut: jour0, paliers, envoyesJour: 0,
  });
  assert.equal(j4.jour, 4);
  assert.equal(j4.palier, 200);

  assert.equal(warmup.palierPour(99, paliers), 200);
  assert.equal(warmup.palierPour(3, paliers), 160);
});

test('warm-up : date de début future = envois refusés ; plan inactif = aucune limite', () => {
  const maintenant = new Date(2026, 0, 10, 9, 0, 0).getTime();
  const futur = new Date(2026, 0, 12, 9, 0, 0).getTime();

  const bloque = warmup.evaluer({ maintenant, dateDebut: futur, paliers: [10], envoyesJour: 0 });
  assert.equal(bloque.ok, false);
  assert.equal(bloque.code, 'WARMUP_PAS_COMMENCE');

  const libre = warmup.evaluer({ maintenant, dateDebut: futur, paliers: [10], envoyesJour: 999, actif: false });
  assert.equal(libre.ok, true);
  assert.equal(libre.palier, Infinity);
});

/* ═══ 3. ALLOWLIST + HACHAGE ════════════════════════════════════════ */

test('allowlist : inconnu refusé, consentement puis révocation', () => {
  regler();
  const jid = '237699000002@s.whatsapp.net';

  assert.equal(allowlist.verifier(jid).ok, false);
  assert.equal(allowlist.verifier(jid).code, 'NON_AUTORISE');

  assert.equal(consenti(jid), true);
  assert.equal(allowlist.verifier(jid).ok, true);

  assert.equal(allowlist.revoquer(jid), true);
  assert.equal(allowlist.verifier(jid).ok, false);
});

test('allowlist : mode strict refuse même un numéro qui a écrit', () => {
  regler();
  const jid = '237699000003@s.whatsapp.net';
  consenti(jid);
  const v = allowlist.verifier(jid, { mode: 'strict' });
  assert.equal(v.ok, false);
  assert.match(v.raison, /strict/);
});

test('allowlist : le jid à appareil (:12@) et le jid nu partagent le même consentement', () => {
  regler();
  consenti('237699000004:12@s.whatsapp.net');
  assert.equal(allowlist.verifier('237699000004@s.whatsapp.net').ok, true);
  assert.equal(allowlist.verifier('237699000004:99@s.whatsapp.net').ok, true);
});

test('allowlist : le statut WhatsApp reste autorisé (pas de correspondant)', () => {
  assert.equal(allowlist.verifier('status@broadcast').ok, true);
});

test('confidentialité : la base ne contient QUE des HMAC, jamais le numéro', () => {
  regler();
  const numero = '237699000005';
  consenti(`${numero}@s.whatsapp.net`, 'test-hmac');
  const ligne = db.conn(path.join(DIR, 'bot.db'))
    .prepare("SELECT jid_hash FROM envoi_consentement WHERE source = 'test-hmac'").get();
  assert.ok(ligne, 'consentement enregistré');
  assert.match(ligne.jid_hash, /^[a-f0-9]{64}$/);
  assert.ok(!ligne.jid_hash.includes(numero), 'aucune trace du numéro en clair');
});

/* ═══ 4. INTÉGRATION wa-send : REFUS AVANT TOUT APPEL API ══════════ */

test('un numéro absent de l’allowlist est refusé AVANT sock.sendMessage', async () => {
  regler();
  const { sock, envois } = makeSock();
  const res = await waSend.send(sock, '237699999999@s.whatsapp.net', { text: 'inconnu' });
  assert.equal(res, undefined);
  assert.equal(envois.length, 0, 'aucun appel réseau pour un non-consenti');

  const hist = store.historique('237699999999@s.whatsapp.net');
  assert.ok(hist.some((l) => l.resultat === 'refus' && l.raison.startsWith('NON_AUTORISE')));
});

test('un numéro consenti est envoyé, journalisé « ok »', async () => {
  regler();
  const jid = '237699000006@s.whatsapp.net';
  consenti(jid);
  const { sock, envois } = makeSock();
  const res = await waSend.send(sock, jid, { text: 'bonjour' });
  assert.equal(res.ok, 1);
  assert.equal(envois.length, 1);
  assert.ok(store.historique(jid).some((l) => l.resultat === 'ok'));
});

test('fenêtre « par seconde » : attente au lieu d’un refus (le menu répond)', async () => {
  regler();
  const jid = '237699000007@s.whatsapp.net';
  consenti(jid);
  const { sock, envois } = makeSock();

  const premier = await waSend.send(sock, jid, { text: 'un' });
  assert.equal(premier.ok, 1);

  const t0 = Date.now();
  const second = await waSend.send(sock, jid, { text: 'deux' });
  const ecoule = Date.now() - t0;
  assert.equal(second.ok, 1, 'le 2ᵉ message doit partir, pas être refusé');
  assert.equal(envois.length, 2);
  assert.ok(ecoule >= 800, `attente de fenêtre attendue ≥800 ms, obtenu ${ecoule} ms`);
});

test('budget « par minute » : au-delà du plafond, refus explicite', async () => {
  const deja = store.compterDepuis(Date.now() - 60000);
  regler({ ENVOI_MAX_MINUTE: String(deja + 1) });
  const jid = '237699000008@s.whatsapp.net';
  consenti(jid);
  const { sock, envois } = makeSock();

  const ok = await waSend.send(sock, jid, { text: 'dans le budget' });
  assert.equal(ok.ok, 1);
  assert.equal(envois.length, 1);

  const refus = await waSend.send(sock, jid, { text: 'hors budget' });
  assert.equal(refus, undefined);
  assert.equal(envois.length, 1, 'aucun appel réseau au-delà du budget');
  const hist = store.historique(jid);
  assert.ok(hist.some((l) => l.raison.startsWith('LIMITE_MINUTE')));
});

/* ═══ 5. CLASSIFICATION DES ERREURS API ═════════════════════════════ */

test('erreurs : 429 → RATE_OVERLIMIT (pause 15 min, pas de retry)', () => {
  const c = erreurs.classer({ output: { statusCode: 429 }, message: 'too many requests' });
  assert.equal(c.code, 'RATE_OVERLIMIT');
  assert.equal(c.pauseMs, 15 * 60000);
  assert.equal(c.retenter, false);
  assert.equal(c.alerte, true);
});

test('erreurs : 463 et 403 → REACHOUT_RESTRICTED (pause 24 h)', () => {
  for (const statut of [403, 463]) {
    const c = erreurs.classer({ output: { statusCode: statut } });
    assert.equal(c.code, 'REACHOUT_RESTRICTED', `statut ${statut}`);
    assert.equal(c.pauseMs, 24 * 3600000);
  }
});

test('erreurs : 404/131026 → INVALID_RECIPIENT (aucune pause, pas de retry)', () => {
  for (const statut of [404, 131026]) {
    const c = erreurs.classer({ data: { code: statut } });
    assert.equal(c.code, 'INVALID_RECIPIENT', `code ${statut}`);
    assert.equal(c.pauseMs, 0);
    assert.equal(c.retenter, false);
  }
});

test('erreurs : réseau → NETWORK (retry possible) ; inconnu → UNKNOWN (alerte)', () => {
  const reseau = erreurs.classer({ message: 'socket hang up ECONNRESET' });
  assert.equal(reseau.code, 'NETWORK');
  assert.equal(reseau.retenter, true);

  const inconnu = erreurs.classer({ message: 'boom' });
  assert.equal(inconnu.code, 'UNKNOWN');
  assert.equal(inconnu.alerte, true);
  assert.equal(inconnu.retenter, false);
});

test('erreur API : pause globale appliquée puis levée', () => {
  regler();
  const jid = '237699000009@s.whatsapp.net';
  consenti(jid);

  const suivi = envoi.apresEnvoi({
    jid, correlation: 'corr-test', type: 'texte', succes: false,
    erreur: { output: { statusCode: 429 } },
  });
  assert.equal(suivi.code, 'RATE_OVERLIMIT');

  const bloque = envoi.avantEnvoi({ jid, contenu: { text: 'bloqué' } });
  assert.equal(bloque.ok, false);
  assert.equal(bloque.code, 'PAUSE_APRES_ERREUR');

  store.definirEtat('pause_jusqua', '0');
  const libre = envoi.avantEnvoi({ jid, contenu: { text: 'libre' } });
  assert.equal(libre.ok, true);
});

/* ═══ 6. MODE DÉGRADÉ (QUALITÉ) ════════════════════════════════════ */

test('mode dégradé : envois suspendus, puis rétablissement manuel', () => {
  regler();
  const jid = '237699000010@s.whatsapp.net';
  consenti(jid);

  qualite.basculerDegrade('test');
  const bloque = envoi.avantEnvoi({ jid, contenu: { text: 'suspendu' } });
  assert.equal(bloque.ok, false);
  assert.equal(bloque.code, 'QUALITE_DEGRADEE');

  qualite.retablir();
  const libre = envoi.avantEnvoi({ jid, contenu: { text: 'ok' } });
  assert.equal(libre.ok, true);
});

test('mode dégradé : ENVOI_DEGRADE=1 coupe les envois sans toucher la base', () => {
  regler({ ENVOI_DEGRADE: '1' });
  const jid = '237699000011@s.whatsapp.net';
  consenti(jid);
  const v = envoi.avantEnvoi({ jid, contenu: { text: 'x' } });
  assert.equal(v.ok, false);
  assert.equal(v.code, 'QUALITE_DEGRADEE');
  regler();
});

test('qualité : score proxy = succès / (succès + échecs), 100 sans historique', () => {
  const q = qualite.score({ maintenant: Date.now() + 10 * 86400000, fenetreJours: 7 });
  assert.equal(q.source, 'proxy-local');
  assert.equal(q.score, 100, 'fenêtre sans données = 100');

  qualite.enregistrer({ succes: true, cfg: {} });
  const apres = qualite.enregistrer({ succes: false, cfg: {} });
  assert.ok(apres.score < 100);
});

/* ═══ 7. JOURNAL D'AUDIT CHAÎNÉ ════════════════════════════════════ */

test('journal : chaîne valide, puis détection d’une ligne altérée', () => {
  regler();
  for (let i = 0; i < 4; i += 1) {
    store.journaliser({
      jid: `23769900002${i}@s.whatsapp.net`, type: 'texte', resultat: 'ok',
      correlation: `corr-${i}`, ts: Date.now() + i,
    });
  }
  const avant = store.verifierChaine();
  assert.equal(avant.ok, true, `chaîne attendue valide : ${JSON.stringify(avant)}`);

  const conn = db.conn(path.join(DIR, 'bot.db'));
  const ligne = conn.prepare('SELECT id, raison FROM envoi_journal ORDER BY id DESC LIMIT 1').get();
  conn.prepare('UPDATE envoi_journal SET raison = ? WHERE id = ?').run('falsifié', ligne.id);

  const apres = store.verifierChaine();
  assert.equal(apres.ok, false, 'une ligne modifiée doit rompre la chaîne');
  assert.match(apres.motif, /empreinte/);

  /* remise en état : les tests suivants ne doivent pas hériter d'une rupture */
  conn.prepare('UPDATE envoi_journal SET raison = ? WHERE id = ?').run(ligne.raison, ligne.id);
  assert.equal(store.verifierChaine().ok, true);
});

test('journal : historique complet d’un numéro, y compris après révocation', () => {
  regler();
  const jid = '237699000030@s.whatsapp.net';
  consenti(jid);
  store.journaliser({ jid, type: 'texte', resultat: 'ok', correlation: 'a' });
  store.journaliser({ jid, type: 'texte', resultat: 'refus', raison: 'LIMITE_MINUTE: test', correlation: 'b' });
  allowlist.revoquer(jid);

  const hist = store.historique(jid);
  assert.equal(hist.length, 2);
  assert.deepEqual(hist.map((l) => l.correlation).sort(), ['a', 'b']);
});

/* ═══ 8. VUE SYNTHÉTIQUE (DASHBOARD) ═══════════════════════════════ */

test('etatComplet expose les 5 couches sans jamais révéler un numéro', () => {
  regler();
  const e = envoi.etatComplet();
  assert.equal(typeof e.actif, 'boolean');
  assert.equal(typeof e.degrade, 'boolean');
  assert.ok(e.qualite && typeof e.qualite.score === 'number');
  assert.ok(e.fenetres && e.plafonds);
  assert.ok(e.warmup && Number.isFinite(e.warmup.jour));
  assert.ok(['reponse', 'strict'].includes(e.allowlist.mode));
  assert.ok(e.audit && typeof e.audit.chaine.ok === 'boolean');
  assert.equal(JSON.stringify(e).includes('2376'), false, 'aucun numéro en clair');
});
