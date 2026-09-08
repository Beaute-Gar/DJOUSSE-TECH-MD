/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  BOUCLE TEMPORELLE ⧖ — Moteur principal                   ║
 * ║  Quiz débat interactif WhatsApp — DJOUSSE TECH             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import fs from 'fs/promises';
import path from 'path';
import { getBouclePersonnalite } from './boucle-personnalite.js';
import { getBoucleQuestions, CATEGORIES } from './boucle-questions.js';
import { getBoucleDebat } from './boucle-debat.js';
import { bus, EVENTS } from '../../packages/ainoria-intelligence/core/event-bus.js';

const POINTS_VICTOIRE = 10;
const JOUEURS_MIN = 3;
const JOUEURS_MAX = 12;
const MAX_PIEGES_CASCADE = 3;

export class BoucleTemporelle {
  constructor(sock, { dataDir = './data/boucle', ia } = {}) {
    this.sock = sock;
    this.dataDir = dataDir;
    this.parties = {};

    this.personnaliteMoteur = getBouclePersonnalite(dataDir);
    this.questionsMoteur = getBoucleQuestions({ dataDir, ia });
    this.debatMoteur = getBoucleDebat({ dataDir, ia });
    this._reactionUnsub = bus.on(EVENTS.MESSAGE_REACTED, (data) => {
      this.gererReactionInscription(data.jid, data.senderJid, data.senderJid?.split('@')[0] || '', data.reaction);
    });
  }

  async handleCommande(msg, args, groupJid, expediteurJid, nomExpediteur) {
    try {
      const sous = (args[0] || '').toLowerCase();
      switch (sous) {
        case 'start':
          return await this.demarrerInscription(groupJid);
        case 'go':
          return await this.forcerLancement(groupJid);
        case 'stop':
          return await this.arreterPartie(groupJid);
        case 'scores':
          return await this.afficherScores(groupJid);
        case 'aide':
        case 'help':
          return await this.afficherAide(groupJid);
        default:
          return await this.envoyer(groupJid,
            "🎭 Commandes : .boucle start | .boucle go | .boucle stop | .boucle scores | .boucle aide");
      }
    } catch (err) {
      return await this.envoyer(groupJid, "⚠️ Petit bug côté Boucle Temporelle, on réessaie dans un instant.");
    }
  }

  async afficherAide(groupJid) {
    const texte = [
      '⧖ *BOUCLE TEMPORELLE* — Quiz débat interactif',
      '.start → lancer les inscriptions',
      '🎮 → rejoindre la partie',
      '🛑 → fermer et lancer la partie',
      '.me <réponse> → répondre à la question',
      '.stop → arrêter la partie en cours',
      '.boucle scores → voir les scores',
      `👥 ${JOUEURS_MIN} à ${JOUEURS_MAX} joueurs • Premier à ${POINTS_VICTOIRE}🏆`,
    ].join('\n');
    return await this.envoyer(groupJid, texte);
  }

  async demarrerInscription(groupJid) {
    if (this.parties[groupJid]?.phase === 'jeu' || this.parties[groupJid]?.phase === 'inscription') {
      return await this.envoyer(groupJid, "🚨 Une partie est déjà en cours ou en inscription ici !");
    }

    this.parties[groupJid] = {
      phase: 'inscription',
      joueurs: {},
      messageInscriptionId: null,
      inscritDepuis: Date.now(),
      round: 0,
      questionActuelle: null,
      joueurActuel: null,
      historiqueVotes: {},
      personnalite: this.personnaliteMoteur.nouvelEtat(),
      contexte: 'groupe WhatsApp francophone',
    };

    await this.envoyer(groupJid, "🚨 Salut à tous ! Voici un jeu : ⧖ *BOUCLE TEMPORELLE* ⧖ 🚨\nUn jeu où vos secrets seront révélés...");
    const msgReaction = await this.envoyer(groupJid, "🚨🚨 *Qui veut jouer ?* Réagissez avec 🎮 pour rejoindre la Boucle !\n🛑 pour fermer les inscriptions et lancer la partie.\n📝 Pour répondre, utilisez .me <votre réponse>");
    if (msgReaction?.key?.id) this.parties[groupJid].messageInscriptionId = msgReaction.key.id;

    if (this.parties[groupJid].timerProvocation) clearTimeout(this.parties[groupJid].timerProvocation);
    this.parties[groupJid].timerProvocation = setTimeout(() => this.provoquerAbsents(groupJid), 40000);

    return true;
  }

  async provoquerAbsents(groupJid) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'inscription') return;
    try {
      const meta = await this.sock.groupMetadata(groupJid);
      const inscrits = new Set(Object.keys(partie.joueurs));
      const absents = meta.participants
        .map((p) => p.id)
        .filter((jid) => !inscrits.has(jid))
        .slice(0, 3);

      if (absents.length) {
        const mentions = absents.map((jid) => `@${jid.split('@')[0]}`).join(' ');
        await this.envoyer(groupJid, `👀 ${mentions} t'as peur ou quoi ? 😏 Réagis avec 🎮 si t'es pas une poule mouillée 🐔`, absents);
      }
    } catch {}
  }

  async inscrireJoueur(groupJid, jid, nom) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'inscription') return;
    if (partie.joueurs[jid]) return;
    if (Object.keys(partie.joueurs).length >= JOUEURS_MAX) return;

    partie.joueurs[jid] = {
      jid,
      nom: nom || jid.split('@')[0],
      score: 0,
      pointsDebat: 0,
      questionsRecues: 0,
      piegesSubis: 0,
      piegesReussis: 0,
      risées: 0,
      votesRecus: {},
      categoriesVues: {},
      streak: 0,
    };

    await this.envoyer(groupJid, `🔥 @${partie.joueurs[jid].nom} a rejoint le jeu 🎮`, [jid]);
  }

  estJoueurActif(groupJid, jid) {
    const partie = this.parties[groupJid];
    return partie?.phase === 'jeu' && partie.joueurActuelJid === jid;
  }

  async gererReactionInscription(groupJid, jid, nom, emoji) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'inscription') return;
    if (emoji === '🛑') {
      return await this.cloturerInscription(groupJid);
    }
    if (emoji !== '🎮') return;
    return await this.inscrireJoueur(groupJid, jid, nom);
  }

  async forcerLancement(groupJid) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'inscription') {
      return await this.envoyer(groupJid, "🚨 Pas d'inscription en cours à lancer.");
    }
    return await this.cloturerInscription(groupJid);
  }

  async cloturerInscription(groupJid) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'inscription') return;

    const joueurs = Object.values(partie.joueurs);
    if (joueurs.length < JOUEURS_MIN) {
      delete this.parties[groupJid];
      return await this.envoyer(groupJid, `⏰ Inscriptions fermées, mais pas assez de monde (${joueurs.length}/${JOUEURS_MIN} minimum). Partie annulée.`);
    }

    partie.phase = 'jeu';
    const listeJoueurs = joueurs.map((j) => `@${j.nom}`).join(' ');
    const texte = [
      '⏰ Inscriptions fermées !',
      `🎮 Joueurs : ${listeJoueurs}`,
      `📊 ${joueurs.length} joueurs • Premier à ${POINTS_VICTOIRE}🏆`,
      '🎭 Le jeu commence !',
    ].join('\n');
    await this.envoyer(groupJid, texte, joueurs.map((j) => j.jid));

    return await this.lancerTour(groupJid);
  }

  async arreterPartie(groupJid) {
    if (!this.parties[groupJid]) {
      return await this.envoyer(groupJid, "🚨 Aucune partie en cours ici.");
    }
    await this.personnaliteMoteur.sauvegarder(this.parties[groupJid].personnalite, groupJid);
    delete this.parties[groupJid];
    return await this.envoyer(groupJid, "🛑 Partie arrêtée. Merci d'avoir joué à la Boucle Temporelle ⧖");
  }

  async afficherScores(groupJid) {
    const partie = this.parties[groupJid];
    if (!partie) return await this.envoyer(groupJid, "🚨 Aucune partie en cours ici.");

    const classement = Object.values(partie.joueurs).sort((a, b) => b.score - a.score);
    const texte = ['📊 *SCORES*', ...classement.map((j, i) => `${i + 1}. @${j.nom} — ${j.score}🏆`)].join('\n');
    return await this.envoyer(groupJid, texte, classement.map((j) => j.jid));
  }

  choisirJoueur(partie) {
    const joueurs = Object.values(partie.joueurs);
    const roll = Math.random();

    if (roll < 0.4) {
      return joueurs.reduce((min, j) => (j.score < min.score ? j : min), joueurs[0]);
    }
    if (roll < 0.65) {
      return joueurs[Math.floor(Math.random() * joueurs.length)];
    }
    if (roll < 0.85 && partie.joueurActuelJid) {
      const meme = partie.joueurs[partie.joueurActuelJid];
      if (meme) return meme;
    }
    return joueurs.reduce((max, j) => (j.questionsRecues > max.questionsRecues ? j : max), joueurs[0]);
  }

  async lancerTour(groupJid) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'jeu') return;

    partie.round += 1;
    const joueur = this.choisirJoueur(partie);
    partie.joueurActuelJid = joueur.jid;
    joueur.questionsRecues += 1;

    const categorie = this.questionsMoteur.choisirCategorie(joueur, partie.round);
    joueur.categoriesVues[categorie] = (joueur.categoriesVues[categorie] || 0) + 1;

    const pFormate = this.personnaliteMoteur.formaterPourPrompt(partie.personnalite);
    const question = await this.questionsMoteur.genererQuestion(
      joueur, categorie, { contexte: partie.contexte, jid: groupJid }, pFormate,
    );

    partie.questionActuelle = { texte: question, categorie, cascade: 0 };

    const emojiCat = CATEGORIES[categorie]?.emoji || '❓';
    const labelCat = CATEGORIES[categorie]?.label || categorie.toUpperCase();

    const suspensePhrases = [
      'Oups je sais pas... 😏',
      'Ah non je vais rien dire 🤭',
      'Hmm hmm... 👀',
      'Attends, je regarde... 🔮',
      'Toi là, prépare-toi... 😈',
      'Je vois je vois... 🤫',
    ];
    const phrase = suspensePhrases[Math.floor(Math.random() * suspensePhrases.length)];
    await this.envoyer(groupJid, `🎯 La prochaine question c'est...\n${phrase}`);

    await new Promise(r => setTimeout(r, 2000));

    await this.envoyer(groupJid, `👤 *${joueur.nom}* !`, [joueur.jid]);

    await new Promise(r => setTimeout(r, 1500));

    const texte = [
      `🚨 *TOUR ${partie.round}*`,
      `${emojiCat} ${labelCat}`,
      '',
      `👤 @${joueur.nom}, ${question}`,
      '',
      '⏱️ 1 phrase !',
    ].join('\n');

    return await this.envoyer(groupJid, texte, [joueur.jid]);
  }

  async gererReponseJoueur(groupJid, jid, texteReponse) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'jeu') return;
    if (jid !== partie.joueurActuelJid) return;

    const joueur = partie.joueurs[jid];
    if (!joueur || !partie.questionActuelle) return;

    joueur.score += 1;
    partie.derniereReponse = texteReponse;

    const pFormate = this.personnaliteMoteur.formaterPourPrompt(partie.personnalite);
    const messages = await this.debatMoteur.animerDebat({
      joueur,
      reponse: texteReponse,
      categorie: partie.questionActuelle.categorie,
      groupe: { jid: groupJid, contexte: partie.contexte },
      personnaliteFormatee: pFormate,
    });

    partie.phase = 'debat';
    partie.reactionsDebat = {};
    for (const m of messages) {
      await this.envoyer(groupJid, m, [jid]);
    }

    setTimeout(() => this.cloturerDebat(groupJid).catch(() => {}), 45_000);
  }

  gererVoteDebat(groupJid, votantJid, emoji) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'debat') return;
    partie.reactionsDebat ||= {};
    partie.reactionsDebat[emoji] ||= [];
    if (!partie.reactionsDebat[emoji].includes(votantJid)) {
      partie.reactionsDebat[emoji].push(votantJid);
    }

    const positif = ['👍', '🔥', '😈'].includes(emoji);
    const dynamique = this.debatMoteur.detecterDynamiques(
      partie.historiqueVotes, votantJid, partie.joueurActuelJid, positif,
    );
    if (dynamique) {
      partie.personnalite = this.personnaliteMoteur.evoluer(partie.personnalite, dynamique);
    }
  }

  async cloturerDebat(groupJid) {
    const partie = this.parties[groupJid];
    if (!partie || partie.phase !== 'debat') return;

    const joueur = partie.joueurs[partie.joueurActuelJid];
    const { points, total, pour, contre, houleux } = this.debatMoteur.calculerPoints(partie.reactionsDebat);

    joueur.score += points;
    joueur.pointsDebat += points;

    partie.personnalite = this.personnaliteMoteur.evoluer(partie.personnalite, {
      type: houleux ? 'debat_houleux' : 'calme',
      joueur: joueur.jid,
    });

    const texte = `📊 ${pour}👍 ${contre}👎 (${total} votes) | @${joueur.nom} +${points}🏆`;
    await this.envoyer(groupJid, texte, [joueur.jid]);

    const doitPieger = partie.questionActuelle.cascade < MAX_PIEGES_CASCADE && Math.random() < 0.35;
    if (doitPieger) {
      return await this.lancerPiege(groupJid);
    }

    return await this.terminerTourOuVictoire(groupJid);
  }

  async lancerPiege(groupJid) {
    const partie = this.parties[groupJid];
    const joueur = partie.joueurs[partie.joueurActuelJid];
    partie.questionActuelle.cascade += 1;

    const temoins = Object.values(partie.joueurs)
      .filter((j) => j.jid !== joueur.jid)
      .map((j) => j.nom);
    const pFormate = this.personnaliteMoteur.formaterPourPrompt(partie.personnalite);

    const piege = await this.debatMoteur.genererPiege({
      joueur,
      reponse: partie.derniereReponse || '',
      numeroPiege: partie.questionActuelle.cascade,
      temoins: temoins.slice(0, 2),
      personnaliteFormatee: pFormate,
    });

    joueur.piegesSubis += 1;
    partie.phase = 'jeu';
    await this.envoyer(groupJid, `😈 ${piege}`, [joueur.jid]);

    return true;
  }

  async terminerTourOuVictoire(groupJid) {
    const partie = this.parties[groupJid];
    const gagnant = Object.values(partie.joueurs).find((j) => j.score >= POINTS_VICTOIRE);

    if (gagnant) {
      await this.envoyer(groupJid, `🏆 *VICTOIRE* : @${gagnant.nom} remporte la Boucle Temporelle avec ${gagnant.score} points ! 🎭`, [gagnant.jid]);
      await this.personnaliteMoteur.sauvegarder(partie.personnalite, groupJid);
      delete this.parties[groupJid];
      return true;
    }

    partie.phase = 'jeu';
    partie.questionActuelle = null;
    return await this.lancerTour(groupJid);
  }

  async envoyer(groupJid, texte, mentions = []) {
    try {
      return await this.sock.sendMessage(groupJid, { text: texte, mentions });
    } catch {
      return null;
    }
  }
}

let instance = null;
export function getBoucleTemporelle(sock, options) {
  if (!instance) instance = new BoucleTemporelle(sock, options);
  return instance;
}

export { creerAppelIA } from './ia-provider.js';
