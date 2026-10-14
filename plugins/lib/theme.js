'use strict';
/**
 * Shim SILVA → DJOUSSE : '../lib/theme'
 * Autonome (aucune dépendance) : fournit l'API utilisée par les plugins
 * silva — getStr, fmt, getActiveTheme, setActiveTheme, listThemes.
 */

const THEME = {
  prefix: '.',
  bot: 'DJOUSSE TECH',
  owner: 'DJOUSSE',
  strs: {
    ok: '✅',
    err: '❌',
    wait: '⏳',
    done: 'Terminé',
    ownerOnly: 'Réservé au propriétaire.',
    adminOnly: 'Réservé aux administrateurs.',
    groupOnly: 'Commande de groupe uniquement.',
    botAdmin: 'Le bot doit être administrateur.',
    loading: 'Traitement en cours…',
    noMedia: 'Réponds à un média.',
    error: 'Une erreur est survenue.',
  },
};

let actif = 'djousse';

function cadre(titre, lignes) {
  const traits = '-'.repeat(28);
  return [`== ${titre} ==`, traits, ...lignes].join('\n');
}

module.exports = {
  listThemes: () => ['djousse'],
  loadTheme: () => THEME,
  getActiveTheme: () => ({ name: actif, ...THEME }),
  setActiveTheme: (n) => { actif = n; return actif; },
  getStr: (k, d) => (k in THEME.strs ? THEME.strs[k] : d),
  fmt: (t) => cadre('DJOUSSE', [String(t)]),
  cadre,
  bullet: (k, v) => `${k} : ${v}`,
};
