'use strict';
/**
 * scripts/envoi-statut.js — SALLE DE CONTRÔLE EN LIGNE DE COMMANDE
 * ────────────────────────────────────────────────────────────────────
 * Lit l'état réel du contrôle d'envoi (mêmes données que le dashboard).
 *
 *   node scripts/envoi-statut.js                  état complet lisible
 *   node scripts/envoi-statut.js --json           sortie machine (monitoring)
 *   node scripts/envoi-statut.js --historique +2376XXXXXXXX
 *   node scripts/envoi-statut.js --consentir +2376XXXXXXXX   opt-in explicite
 *   node scripts/envoi-statut.js --revoquer +2376XXXXXXXX
 *   node scripts/envoi-statut.js --retablir       sortie du mode dégradé
 *   node scripts/envoi-statut.js --alertes 20     dernières alertes (fichier)
 *
 * Les numéros sont hachés en HMAC : `--historique` recalcule l'empreinte
 * à partir du numéro fourni, il n'existe donc aucun index en clair.
 */

const fs = require('fs');
const path = require('path');
const envoi = require(path.join(__dirname, '..', 'src', 'lib', 'envoi'));
const { instantane } = require(path.join(__dirname, '..', 'src', 'lib', 'envoi', 'tableau-bord'));

const args = process.argv.slice(2);
const a = (nom) => args.includes(nom);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : null;
};

const heure = (ms) => (ms ? new Date(Number(ms)).toLocaleString('fr-FR') : '—');
const barre = (n, max, largeur = 20) => {
  const plein = Math.max(0, Math.min(largeur, Math.round((Number(n) || 0) / (max || 1) * largeur)));
  return '█'.repeat(plein) + '░'.repeat(largeur - plein);
};

function afficherEtat() {
  const e = instantane();
  if (e.erreur) {
    console.error('État indisponible :', e.erreur);
    process.exitCode = 1;
    return;
  }

  console.log('\n═══ CONTRÔLE D\'ENVOI — ÉTAT ═══\n');
  console.log(`Actif              : ${e.actif ? 'OUI' : 'NON (ENVOI_ACTIF=0)'}`);
  console.log(`Mode dégradé       : ${e.degrade ? `OUI — ${e.degradeRaison}` : 'non'}`);
  console.log(`Pause après erreur : ${e.pauseJusqua ? `jusqu'à ${heure(e.pauseJusqua)}` : 'aucune'}`);
  console.log(`Allowlist          : mode ${e.allowlist.mode} · ${e.allowlist.consentements} consentement(s)`);

  console.log('\n── Qualité (proxy local, PAS le Quality Rating officiel) ──');
  console.log(`Score 7 jours      : ${e.qualite.score}/100  ${barre(e.qualite.score, 100)}`);
  console.log(`Succès / échecs    : ${e.qualite.ok} / ${e.qualite.echec} (${e.qualite.refus} refus)`);

  console.log('\n── Fenêtres glissantes ──');
  console.log(`Seconde            : ${e.fenetres.parSeconde}/${e.plafonds.parSeconde}  ${barre(e.fenetres.parSeconde, e.plafonds.parSeconde)}`);
  console.log(`Minute             : ${e.fenetres.parMinute}/${e.plafonds.parMinute}  ${barre(e.fenetres.parMinute, e.plafonds.parMinute)}`);
  console.log(`Heure              : ${e.fenetres.parHeure}/${e.plafonds.parHeure}  ${barre(e.fenetres.parHeure, e.plafonds.parHeure)}`);
  console.log(`Jour               : ${e.fenetres.parJour}/${e.plafonds.parJour}  ${barre(e.fenetres.parJour, e.plafonds.parJour)}`);

  console.log('\n── Montée en charge ──');
  if (e.warmup.actif) {
    console.log(`Jour ${e.warmup.jour} · palier ${e.warmup.palier} · envoyés ${e.warmup.envoyesJour}`);
  } else {
    console.log('désactivée (ENVOI_WARMUP=0)');
  }

  console.log('\n── Journal d\'audit ──');
  console.log(`Chaîne             : ${e.audit.chaine.ok ? 'VALIDE' : 'ROMPUE'} (${e.audit.chaine.lignes} ligne(s))${e.audit.chaine.ok ? '' : ` — ${e.audit.chaine.motif}`}`);
  if (e.audit.dernier) {
    const d = e.audit.dernier;
    console.log(`Dernier événement  : ${heure(d.ts)} · ${d.type} · ${d.resultat}${d.raison ? ` · ${d.raison}` : ''}`);
    console.log(`Empreinte          : ${d.empreinte}`);
  }
}

function afficherHistorique(cible) {
  const lignes = envoi.store.historique(cible, 100);
  if (!lignes.length) {
    console.log(`Aucun événement pour ${cible} (ou numéro jamais consenti).`);
    return;
  }
  console.log(`\n═══ HISTORIQUE DE ${cible} ═══\n`);
  for (const l of lignes) {
    const em = l.empreinte ? l.empreinte.slice(0, 12) : '—';
    console.log(`${heure(l.ts)}  ${String(l.resultat).padEnd(6)} ${String(l.type).padEnd(8)} ${em}  ${l.raison || ''}`);
  }
}

function dernieresAlertes(n) {
  const cfg = envoi.config.charger();
  const f = path.join(require(path.join(__dirname, '..', 'src', 'lib', 'dataDir')).DATA_DIR, cfg.alertes.fichier);
  try {
    const lignes = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).filter(Boolean).slice(-Math.max(1, n));
    console.log(lignes.length ? lignes.join('\n') : 'Aucune alerte enregistrée.');
  } catch {
    console.log('Aucune alerte enregistrée (fichier absent).');
  }
}

/* ── commandes ─────────────────────────────────────────────────────── */
if (a('--json')) {
  console.log(JSON.stringify(instantane(), null, 2));
} else if (option('--historique')) {
  afficherHistorique(option('--historique'));
} else if (option('--consentir')) {
  const ok = envoi.consentir(option('--consentir'), 'manuel');
  console.log(ok ? `Consentement explicite enregistré pour ${option('--consentir')}.` : 'Numéro invalide.');
} else if (option('--revoquer')) {
  const ok = envoi.revoquer(option('--revoquer'));
  console.log(ok ? `Consentement révoqué pour ${option('--revoquer')} (historique conservé).` : 'Aucun consentement actif pour ce numéro.');
} else if (a('--retablir')) {
  envoi.qualite.retablir();
  console.log('Mode dégradé levé. Les envois reprennent au rythme normal.');
} else if (a('--alertes')) {
  dernieresAlertes(Number(option('--alertes')) || 20);
} else {
  afficherEtat();
}
