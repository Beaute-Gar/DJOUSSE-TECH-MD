/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  BOUCLE TEMPORELLE — Générateur de questions              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import fs from 'fs/promises';
import path from 'path';

export const CATEGORIES = {
  amour: { emoji: '💕', label: 'AMOUR' },
  culture: { emoji: '🧠', label: 'CULTURE' },
  absurde: { emoji: '🤪', label: 'ABSURDE' },
  confession: { emoji: '🤫', label: 'CONFESSION' },
  dilemme: { emoji: '⚖️', label: 'DILEMME' },
  roast: { emoji: '🔥', label: 'ROAST' },
};

const BANQUE_SECOURS = {
  amour: [
    "Si tu devais avouer un crush du groupe là, maintenant, ce serait qui ?",
    "C'est quoi le message le plus gênant que t'as jamais envoyé à un crush ?",
  ],
  culture: [
    "Cite un truc que tout le monde ici prétend connaître mais que t'as jamais vraiment compris.",
    "Quelle actu récente t'as commentée sans l'avoir lue en entier ?",
  ],
  absurde: [
    "Combat : 1 canard géant ou 100 canards miniatures ? Comment tu gagnes ?",
    "Tu préfères des mains à la place des pieds ou l'inverse ? Justifie.",
  ],
  confession: [
    "Quel est ton plus gros secret que personne ici ne connaît ?",
    "Raconte la dernière fois où tu as menti à quelqu'un du groupe.",
  ],
  dilemme: [
    "Tu dois choisir : perdre toutes tes photos ou toutes tes conversations. Tu prends quoi ?",
    "Sauver ton meilleur ami ou sauver ta réputation, tu choisis quoi ?",
  ],
  roast: [
    "Si le groupe devait élire la personne la plus en retard, ce serait toi ou quelqu'un d'autre ?",
    "Quel est ton défaut que tout le monde voit sauf toi ?",
  ],
};

export class BoucleQuestions {
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

  choisirCategorie(joueur, tourGlobal) {
    const cats = Object.keys(CATEGORIES);
    const stats = joueur.categoriesVues || {};
    const plusFaible = cats.reduce((min, c) => ((stats[c] || 0) < (stats[min] || 0) ? c : min), cats[0]);

    if (tourGlobal % 3 === 0) return plusFaible;
    if (Math.random() < 0.6) return plusFaible;
    return cats[Math.floor(Math.random() * cats.length)];
  }

  async genererQuestion(joueur, categorie, groupe, personnaliteFormatee) {
    try {
      const fichierQuestions = path.join(this.dataDir, 'questions', `${categorie}.txt`);
      const questionsExistantes = await this.lireFichier(fichierQuestions);

      if (!this.ia) {
        return this.piocherSecours(categorie, questionsExistantes);
      }

      const template = await this.lireFichier(path.join(this.promptsDir, 'question.txt'));
      const prompt = template
        .replaceAll('{joueur}', joueur.nom)
        .replaceAll('{categorie}', CATEGORIES[categorie]?.label || categorie)
        .replaceAll('{contexte_groupe}', groupe?.contexte || 'groupe WhatsApp francophone')
        .replaceAll('{stats_joueur}', JSON.stringify(joueur.stats || {}))
        .replaceAll('{intensite}', personnaliteFormatee?.intensite || '2')
        .replaceAll('{dernieres_questions}', questionsExistantes.split('\n').filter(Boolean).slice(-10).join(' | '));

      const reponseIA = await this.ia(prompt);
      const question = this.extraireQuestion(reponseIA);

      if (!question) return this.piocherSecours(categorie, questionsExistantes);

      await this.ajouterFichier(fichierQuestions, question);
      return question;
    } catch {
      return this.piocherSecours(categorie, '');
    }
  }

  piocherSecours(categorie, dejaPosees = '') {
    const banque = BANQUE_SECOURS[categorie] || BANQUE_SECOURS.absurde;
    const dispo = banque.filter((q) => !dejaPosees.includes(q));
    const choix = dispo.length ? dispo : banque;
    return choix[Math.floor(Math.random() * choix.length)];
  }

  extraireQuestion(texte) {
    if (!texte) return null;
    const match = texte.match(/Question\s*:\s*(.+)/i);
    if (match) return match[1].trim();
    const qmark = texte.match(/[^.!?]*\?\s*$/m);
    if (qmark && qmark[0].trim().length > 10) return qmark[0].trim();
    const lines = texte.trim().split('\n').filter(l => l.trim().length > 10 && l.includes('?'));
    if (lines.length > 0) return lines[0].trim();
    return texte.trim().split('\n')[0].replace(/^(Voici|Voilà|Généré|Une question)[^.]+/i, '').trim() || texte.trim().split('\n')[0];
  }
}

export function getBoucleQuestions(options) {
  return new BoucleQuestions(options);
}
