/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  BOUCLE TEMPORELLE — Moteur de personnalité              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import fs from 'fs/promises';
import path from 'path';

export const PERSONNALITES = {
  provocateur: {
    nom: '😈 Provocateur',
    description: "Tu doutes de tout, tu remets tout en question, tu adores semer le trouble.",
  },
  enqueteur: {
    nom: '🕵️ Enquêteur',
    description: "Tu creuses, tu cherches la vérité, tu recoupes les témoignages.",
  },
  blagueur: {
    nom: '😂 Blagueur',
    description: "Tu te moques gentiment, tu détends l'atmosphère, tu fais rire.",
  },
  allie: {
    nom: '🤝 Allié',
    description: "Tu prends parti pour un joueur, tu le défends contre les autres.",
  },
  juge: {
    nom: '💀 Juge',
    description: "Tu rends un verdict implacable, sans appel, froid et théâtral.",
  },
  imprevisible: {
    nom: '🎭 Imprévisible',
    description: "Tu changes d'avis en cours de route, personne ne sait sur quel pied danser avec toi.",
  },
};

const MODES = Object.keys(PERSONNALITES);

export class BouclePersonnalite {
  constructor(dataDir = './data/boucle') {
    this.dataDir = dataDir;
    this.fichierEtat = path.join(dataDir, 'personnalites', 'etat.txt');
  }

  nouvelEtat() {
    return {
      mode: this.tirerMode(),
      humeur: 'Neutre, curieux',
      intensite: 2,
      cibleFavorite: null,
      cibleRaisons: {},
      alliances: [],
      rancunes: [],
      prochainChangement: 5,
      tourActuel: 0,
    };
  }

  tirerMode(exclure = null) {
    const dispo = exclure ? MODES.filter((m) => m !== exclure) : MODES;
    return dispo[Math.floor(Math.random() * dispo.length)];
  }

  evoluer(etat, evenement = {}) {
    try {
      etat.tourActuel += 1;

      if (etat.tourActuel >= etat.prochainChangement) {
        etat.mode = this.tirerMode(etat.mode);
        etat.prochainChangement = etat.tourActuel + 3 + Math.floor(Math.random() * 4);
      }

      if (evenement.type === 'piege_reussi') etat.intensite = Math.min(10, etat.intensite + 2);
      else if (evenement.type === 'trahison') etat.intensite = Math.min(10, etat.intensite + 3);
      else if (evenement.type === 'debat_houleux') etat.intensite = Math.min(10, etat.intensite + 1);
      else etat.intensite = Math.max(1, etat.intensite - 0.5);

      etat.intensite = Math.round(etat.intensite * 10) / 10;
      etat.humeur = this.humeurDepuisIntensite(etat.intensite);

      if (evenement.joueur && (evenement.type === 'piege_reussi' || evenement.type === 'trahison')) {
        etat.cibleRaisons[evenement.joueur] = (etat.cibleRaisons[evenement.joueur] || 0) + 1;
        const top = Object.entries(etat.cibleRaisons).sort((a, b) => b[1] - a[1])[0];
        etat.cibleFavorite = top ? top[0] : null;
      }

      if (evenement.type === 'alliance' && evenement.entre) {
        const cle = evenement.entre.slice().sort().join('|');
        if (!etat.alliances.includes(cle)) etat.alliances.push(cle);
      }
      if (evenement.type === 'trahison' && evenement.entre) {
        const cle = evenement.entre.slice().sort().join('|');
        if (!etat.rancunes.includes(cle)) etat.rancunes.push(cle);
        etat.alliances = etat.alliances.filter((a) => a !== cle);
      }

      return etat;
    } catch {
      return etat || this.nouvelEtat();
    }
  }

  humeurDepuisIntensite(intensite) {
    if (intensite >= 8) return 'Électrique, impitoyable, ça chauffe fort';
    if (intensite >= 5) return 'Taquin, insistant, ça sent le piège';
    if (intensite >= 3) return 'Curieux, joueur, à l\'affût';
    return 'Neutre, détendu, encore en observation';
  }

  formaterPourPrompt(etat) {
    const p = PERSONNALITES[etat.mode] || PERSONNALITES.imprevisible;
    return {
      personnalite_nom: p.nom,
      personnalite_description: p.description,
      humeur: etat.humeur,
      intensite: String(etat.intensite),
      cible_favorite: etat.cibleFavorite ? `@${etat.cibleFavorite}` : 'aucune pour le moment',
      rancune: etat.rancunes.length ? etat.rancunes.join(', ') : 'aucune',
      alliances: etat.alliances.length ? etat.alliances.join(', ') : 'aucune détectée',
      rancunes: etat.rancunes.length ? etat.rancunes.join(', ') : 'aucune',
    };
  }

  async sauvegarder(etat, groupJid) {
    try {
      await fs.mkdir(path.dirname(this.fichierEtat), { recursive: true });
      const date = new Date().toISOString().split('T')[0];
      const p = PERSONNALITES[etat.mode] || PERSONNALITES.imprevisible;
      const contenu = [
        `${date} — ${groupJid || 'groupe inconnu'}`,
        `Mode actuel : ${p.nom}`,
        `Humeur : ${etat.humeur}`,
        `Intensité : ${etat.intensite}/10`,
        `Prochain changement : tour ${etat.prochainChangement}`,
        `Cible favorite : ${etat.cibleFavorite ? '@' + etat.cibleFavorite : 'aucune'}`,
        `Alliances : ${etat.alliances.join(', ') || 'aucune'}`,
        `Rancunes : ${etat.rancunes.join(', ') || 'aucune'}`,
        '---',
        '',
      ].join('\n');
      await fs.appendFile(this.fichierEtat, contenu);
      return true;
    } catch {
      return false;
    }
  }
}

export function getBouclePersonnalite(dataDir) {
  return new BouclePersonnalite(dataDir);
}
