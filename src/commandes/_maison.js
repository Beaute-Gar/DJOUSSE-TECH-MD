'use strict';

const path = require('node:path');

module.exports = function chargerCommandes(env, fichiers) {
  for (const fichier of fichiers) {
    const chemin = path.join(__dirname, fichier);
    try {
      const enregistrer = require(chemin);
      if (typeof enregistrer !== 'function') {
        throw new TypeError('Le module maison doit exporter une fonction.');
      }
      enregistrer(env);
    } catch (error) {
      console.error(`[COMMANDES MAISON] Echec d'enregistrement de ${fichier}:`, error.stack || error.message);
      throw error;
    }
  }
};

module.exports.maison = true;
