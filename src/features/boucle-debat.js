/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  BOUCLE TEMPORELLE — Moteur de débat                      ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import fs from 'fs/promises';
import path from 'path';

export const EMOJIS_VOTE = ['👍', '👎', '😈', '💀', '🔥', '🤡'];

const POINTS_VOTE = {
  '👍': 1,
  '👎': 0,
  '😈': 1,
  '💀': 0,
  '🔥': 1,
  '🤡': 0,
};

export class BoucleDebat {
  constructor({ dataDir = './data/boucle', ia } = {}) {
    this.dataDir = dataDir;
    this.promptsDir = path.join(dataDir, 'prompts');
    this.ia = ia || null;
  }

  async lireFichier(chemin) {
    try {
      return await fs.readFile(chemin, 'utf8');
    } catch {
      return '';
    }
  }

  async ajouterFichier(chemin, contenu) {
    try {
      await fs.mkdir(path.dirname(chemin), { recursive: true });
      await fs.appendFile(chemin, contenu + '\n');
      return true;
    } catch {
      return false;
    }
  }

  async animerDebat({ joueur, reponse, categorie, groupe, personnaliteFormatee }) {
    try {
      await this.enregistrerDebat(groupe?.jid, `${joueur.nom} : ${reponse}`);

      if (!this.ia) {
        return this.debatSecours(joueur);
      }

      const template = await this.lireFichier(path.join(this.promptsDir, 'debat.txt'));
      const prompt = template
        .replaceAll('{joueur}', joueur.nom)
        .replaceAll('{reponse}', reponse)
        .replaceAll('{categorie}', categorie)
        .replaceAll('{contexte}', groupe?.contexte || '')
        .replaceAll('{intensite}', personnaliteFormatee?.intensite || '2')
        .replaceAll('{alliances}', personnaliteFormatee?.alliances || 'aucune')
        .replaceAll('{rancunes}', personnaliteFormatee?.rancunes || 'aucune');

      const reponseIA = await this.ia(prompt);
      const messages = this.parserMessages(reponseIA, ['MSG1', 'MSG2', 'MSG3']);
      return messages.length ? messages : this.debatSecours(joueur);
    } catch {
      return this.debatSecours(joueur);
    }
  }

  debatSecours(joueur) {
    return [
      `Intéressant, @${joueur.nom}... on va voir ce que le groupe en pense 👀`,
      `Les autres, votre avis ? 👍 Je valide 👎 Je crois pas 😈 Envoyez la suite 💀 C'est mort`,
    ];
  }

  async genererPiege({ joueur, reponse, numeroPiege, temoins = [], personnaliteFormatee }) {
    try {
      if (!this.ia) return this.piegeSecours(joueur, numeroPiege);

      const template = await this.lireFichier(path.join(this.promptsDir, 'piege.txt'));
      const ton = numeroPiege >= 3 ? 'implacable' : numeroPiege === 2 ? 'insistant' : 'taquin';
      const prompt = template
        .replaceAll('{joueur}', joueur.nom)
        .replaceAll('{reponse}', reponse)
        .replaceAll('{numero_piege}', String(numeroPiege))
        .replaceAll('{temoins}', temoins.map((t) => `@${t}`).join(', ') || 'aucun témoin direct')
        .replaceAll('{intensite}', personnaliteFormatee?.intensite || '2')
        .replaceAll('{ton_piege}', ton);

      const reponseIA = await this.ia(prompt);
      return reponseIA?.trim() || this.piegeSecours(joueur, numeroPiege);
    } catch {
      return this.piegeSecours(joueur, numeroPiege);
    }
  }

  piegeSecours(joueur, numeroPiege) {
    const options = [
      `@${joueur.nom}, t'es sûr de ce que tu viens de dire ? Prouve-le.`,
      `@${joueur.nom}, on a des doutes... quelqu'un peut confirmer ça ?`,
      `@${joueur.nom}, dernière chance de tout dire avant qu'on te démasque.`,
    ];
    return options[Math.min(numeroPiege, 3) - 1] || options[0];
  }

  compterReactions(reactions = {}) {
    let total = 0;
    let pour = 0;
    let contre = 0;
    for (const emoji of EMOJIS_VOTE) {
      const votants = reactions[emoji] || [];
      total += votants.length;
      if (emoji === '👍' || emoji === '🔥' || emoji === '😈') pour += votants.length;
      if (emoji === '👎' || emoji === '💀' || emoji === '🤡') contre += votants.length;
    }
    return { total, pour, contre, majoritePositive: pour > contre, houleux: pour > 0 && contre > 0 };
  }

  calculerPoints(reactions) {
    const r = this.compterReactions(reactions);
    let points = 0;
    if (r.total >= 3) points += 1;
    if (r.majoritePositive) points += 1;
    if (r.houleux) points += 1;
    return { points, ...r };
  }

  detecterDynamiques(historiqueVotes, votant, cible, positif) {
    historiqueVotes[votant] ||= {};
    historiqueVotes[votant][cible] ||= { positifs: 0, negatifs: 0 };
    if (positif) historiqueVotes[votant][cible].positifs += 1;
    else historiqueVotes[votant][cible].negatifs += 1;

    const stats = historiqueVotes[votant][cible];
    if (stats.positifs >= 3 && stats.positifs > stats.negatifs * 2) {
      return { type: 'alliance', entre: [votant, cible] };
    }
    if (stats.negatifs >= 3 && stats.negatifs > stats.positifs * 2) {
      return { type: 'trahison', entre: [votant, cible] };
    }
    return null;
  }

  parserMessages(texte, cles) {
    if (!texte) return [];
    const messages = [];
    for (const cle of cles) {
      const regex = new RegExp(`${cle}:\\s*(.+)`, 'i');
      const match = texte.match(regex);
      if (match && match[1] && !/^VIDE$/i.test(match[1].trim())) {
        messages.push(match[1].trim());
      }
    }
    return messages;
  }

  async enregistrerDebat(groupJid, ligne) {
    const date = new Date().toISOString().split('T')[0];
    const fichier = path.join(this.dataDir, 'debats', `${date}.txt`);
    const heure = new Date().toLocaleTimeString('fr-FR');
    await this.ajouterFichier(fichier, `[${heure}] ${groupJid || ''} ${ligne}`);
  }
}

export function getBoucleDebat(options) {
  return new BoucleDebat(options);
}
