const translations = {
  'cmd.not_found': 'Commande introuvable.',
  'cmd.owner_only': 'Commande réservée au propriétaire.',
  'cmd.group_only': 'Commande disponible uniquement en groupe.',
  'cmd.admin_only': 'Commande réservée aux administrateurs.',
  'error.generic': 'Une erreur est survenue.',
  'success.done': 'Opération effectuée avec succès.',
};

function t(key, ...args) {
  let str = translations[key] || key;
  args.forEach((arg, i) => { str = str.replace(`{${i}}`, arg); });
  return str;
}

module.exports = { t, translations };
