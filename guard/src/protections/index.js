'use strict';
// Ordre = priorité d'évaluation. Ajouter une protection = ajouter un fichier + une ligne ici.
module.exports = [
  require('./antilink'),
  require('./antibad'),
  require('./antitag'),
  require('./antispam'),
  require('./antiflood'),
  require('./antimedia'),
  require('./antisticker'),
  require('./antivoice'),
  require('./antistatus'),
  require('./antiforward'),
  require('./antivirtex'),
  require('./anticontact'),
  require('./antipoll'),
];
