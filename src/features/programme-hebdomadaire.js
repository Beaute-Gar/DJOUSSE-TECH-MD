import fs from 'fs/promises';
import path from 'path';

export const PROGRAMME = {
  1: { nom: 'DEUX MENSONGES, UNE VÉRITÉ', emoji: '🎭' },
  2: { nom: 'DÉFI PHOTO', emoji: '📸' },
  3: { nom: 'QUIZ & DEVINETTES', emoji: '🧠' },
  4: { nom: 'BATAILLE DES ÉQUIPES', emoji: '⚔️' },
  5: { nom: 'HUMOUR À VOLONTÉ', emoji: '😂' },
  6: { nom: 'VÉRITÉ OU ACTION', emoji: '🔥' },
  0: { nom: 'SOUVENIRS INOUBLIABLES', emoji: '💭' },
};

const MOTS_SENSIBLES = ['con', 'idiot', 'stupide', 'ferme ta gueule', 'nul', 'débile'];

export class ProgrammeHebdomadaire {
  constructor({ dataDir = './data/communaute', ia } = {}) {
    this.dataDir = dataDir;
    this.promptsDir = path.join(dataDir, 'prompts');
    this.ia = ia || null;
    this.groupes = {};
    this.sock = null;
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

  async handleCommande(args, groupJid, expediteurJid, nomExpediteur) {
    try {
      const sous = (args[0] || '').toLowerCase();
      switch (sous) {
        case 'start':
          return await this.activerGroupe(groupJid);
        case 'stop':
          return await this.desactiverGroupe(groupJid);
        case 'equipe':
          return await this.rejoindreEquipe(groupJid, expediteurJid, nomExpediteur, args[1]);
        case 'jour':
          return await this.declencherJour(groupJid, true);
        case 'scores':
          return await this.afficherScores(groupJid);
        case 'regles':
          return await this.afficherRegles(groupJid);
        default:
          return await this.envoyer(groupJid,
            "🎭 Commandes : .programme start | .programme equipe rouge/noire | .programme jour | .programme scores | .programme regles");
      }
    } catch {
      return await this.envoyer(groupJid, "⚠️ Petit souci côté Programme Hebdomadaire, on réessaie.");
    }
  }

  async activerGroupe(groupJid) {
    if (!this.groupes[groupJid]) {
      this.groupes[groupJid] = {
        actif: true,
        membres: {},
        scoreRouge: 0,
        scoreNoire: 0,
        dernierJourDeclenche: null,
        avertissements: {},
        contexte: 'communauté WhatsApp francophone',
      };
    } else {
      this.groupes[groupJid].actif = true;
    }
    await this.envoyer(groupJid, "✅ Programme hebdomadaire activé pour ce groupe ! Rejoignez une équipe avec `.programme equipe rouge` ou `.programme equipe noire` 🔴⚫");
    return true;
  }

  async desactiverGroupe(groupJid) {
    if (this.groupes[groupJid]) this.groupes[groupJid].actif = false;
    return await this.envoyer(groupJid, "🛑 Programme hebdomadaire désactivé pour ce groupe.");
  }

  async rejoindreEquipe(groupJid, jid, nom, equipe) {
    const g = this.groupes[groupJid];
    if (!g || !g.actif) return await this.envoyer(groupJid, "🚨 Active d'abord le programme avec `.programme start`.");

    const choix = (equipe || '').toLowerCase();
    if (!['rouge', 'noire', 'noir'].includes(choix)) {
      return await this.envoyer(groupJid, "🎭 Choisis ton camp : `.programme equipe rouge` ou `.programme equipe noire`");
    }
    const equipeFinale = choix === 'rouge' ? 'rouge' : 'noire';
    g.membres[jid] = { nom: nom || jid.split('@')[0], equipe: equipeFinale };

    const emoji = equipeFinale === 'rouge' ? '🔴' : '⚫';
    return await this.envoyer(groupJid, `${emoji} @${g.membres[jid].nom} a rejoint l'Équipe ${equipeFinale === 'rouge' ? 'Rouge' : 'Noire'} !`, [jid]);
  }

  async afficherScores(groupJid) {
    const g = this.groupes[groupJid];
    if (!g) return await this.envoyer(groupJid, "🚨 Programme non activé ici.");
    return await this.envoyer(groupJid, `🏆 *SCORES DE LA SEMAINE*\n🔴 Équipe Rouge : ${g.scoreRouge} pts\n⚫ Équipe Noire : ${g.scoreNoire} pts`);
  }

  async afficherRegles(groupJid) {
    const texte = [
      '📜 *RÈGLES D\'OR*',
      '1️⃣ Respect & bienveillance obligatoires',
      '2️⃣ Zéro insulte, uniquement de la bonne vibe',
      '3️⃣ Participation active pour garantir le fun',
      '4️⃣ Bonne humeur constante 🎉',
    ].join('\n');
    return await this.envoyer(groupJid, texte);
  }

  async declencherJour(groupJid, force = false) {
    const g = this.groupes[groupJid];
    if (!g || !g.actif) return force ? await this.envoyer(groupJid, "🚨 Active d'abord le programme.") : null;

    const aujourdHui = new Date().toISOString().split('T')[0];
    if (!force && g.dernierJourDeclenche === aujourdHui) return null;

    const jourSemaine = new Date().getDay();
    const activite = PROGRAMME[jourSemaine];
    g.dernierJourDeclenche = aujourdHui;

    const rouge = Object.values(g.membres).filter((m) => m.equipe === 'rouge').map((m) => m.nom);
    const noire = Object.values(g.membres).filter((m) => m.equipe === 'noire').map((m) => m.nom);

    const annonce = await this.genererAnnonce({
      jour: this.nomJour(jourSemaine),
      activite,
      rouge,
      noire,
      scoreRouge: g.scoreRouge,
      scoreNoire: g.scoreNoire,
      contexte: g.contexte,
    });

    await this.enregistrer(groupJid, `[${aujourdHui}] Thème déclenché : ${activite.nom}`);
    return await this.envoyer(groupJid, `${activite.emoji} ${annonce}`);
  }

  async genererAnnonce({ jour, activite, rouge, noire, scoreRouge, scoreNoire, contexte }) {
    try {
      if (!this.ia) return this.annonceSecours(jour, activite);

      const template = await this.lireFichier(path.join(this.promptsDir, 'programme-system.txt'));
      const prompt = template
        .replaceAll('{jour}', jour)
        .replaceAll('{activite_jour}', activite.nom)
        .replaceAll('{equipe_rouge}', rouge.join(', ') || 'personne pour l\'instant')
        .replaceAll('{equipe_noire}', noire.join(', ') || 'personne pour l\'instant')
        .replaceAll('{score_rouge}', String(scoreRouge))
        .replaceAll('{score_noire}', String(scoreNoire))
        .replaceAll('{contexte_groupe}', contexte);

      const reponse = await this.ia(prompt);
      return reponse?.trim() || this.annonceSecours(jour, activite);
    } catch {
      return this.annonceSecours(jour, activite);
    }
  }

  annonceSecours(jour, activite) {
    return `C'est ${jour} ! Aujourd'hui : *${activite.nom}* 🎉 Lancez-vous, participez, on veut du fun dans ce groupe aujourd'hui !`;
  }

  nomJour(index) {
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return jours[index];
  }

  attribuerPoint(groupJid, jid, points = 1) {
    const g = this.groupes[groupJid];
    if (!g) return null;
    const membre = g.membres[jid];
    if (!membre) return null;

    if (membre.equipe === 'rouge') g.scoreRouge += points;
    else g.scoreNoire += points;

    return { equipe: membre.equipe, scoreRouge: g.scoreRouge, scoreNoire: g.scoreNoire };
  }

  async cloturerSemaine(groupJid) {
    const g = this.groupes[groupJid];
    if (!g) return null;

    let texte;
    if (g.scoreRouge === g.scoreNoire) {
      texte = `🤝 Égalité parfaite cette semaine : ${g.scoreRouge} partout ! Les deux équipes sont LÉGENDES DE LA SEMAINE 🏆`;
    } else {
      const gagnante = g.scoreRouge > g.scoreNoire ? 'Rouge 🔴' : 'Noire ⚫';
      texte = `🏆 L'Équipe ${gagnante} est proclamée *LÉGENDE DE LA SEMAINE* avec ${Math.max(g.scoreRouge, g.scoreNoire)} points !`;
    }

    await this.envoyer(groupJid, texte);
    g.scoreRouge = 0;
    g.scoreNoire = 0;
    return texte;
  }

  async moderer(groupJid, jid, nom, texteMessage) {
    const g = this.groupes[groupJid];
    if (!g || !g.actif) return null;

    const contientMotSensible = MOTS_SENSIBLES.some((mot) =>
      texteMessage.toLowerCase().includes(mot),
    );
    if (!contientMotSensible) return null;

    g.avertissements[jid] = (g.avertissements[jid] || 0) + 1;

    const message = await this.genererModeration({
      message: texteMessage,
      membre: nom,
      regle: 'Zéro insulte, uniquement de la bonne vibe',
      avertissements: g.avertissements[jid],
    });

    await this.enregistrer(groupJid, `Avertissement #${g.avertissements[jid]} pour ${nom}`);
    return await this.envoyer(groupJid, message, [jid]);
  }

  async genererModeration({ message, membre, regle, avertissements }) {
    try {
      if (!this.ia) return this.moderationSecours(membre, avertissements);

      const template = await this.lireFichier(path.join(this.promptsDir, 'moderation.txt'));
      const prompt = template
        .replaceAll('{message}', message)
        .replaceAll('{membre}', membre)
        .replaceAll('{regle}', regle)
        .replaceAll('{avertissements}', String(avertissements));

      const reponse = await this.ia(prompt);
      return reponse?.trim() || this.moderationSecours(membre, avertissements);
    } catch {
      return this.moderationSecours(membre, avertissements);
    }
  }

  moderationSecours(membre, avertissements) {
    if (avertissements <= 1) {
      return `😅 @${membre}, on garde la bonne vibe ici, ok ?`;
    }
    return `⚠️ @${membre}, c'est le ${avertissements}e rappel : respect obligatoire dans ce groupe, merci.`;
  }

  async enregistrer(groupJid, ligne) {
    const date = new Date().toISOString().split('T')[0];
    const fichier = path.join(this.dataDir, 'journal', `${date}.txt`);
    const heure = new Date().toLocaleTimeString('fr-FR');
    await this.ajouterFichier(fichier, `[${heure}] ${groupJid} ${ligne}`);
  }

  async envoyer(groupJid, texte, mentions = []) {
    try {
      if (!this.sock) return null;
      return await this.sock.sendMessage(groupJid, { text: texte, mentions });
    } catch {
      return null;
    }
  }
}

let instance = null;
export function getProgrammeHebdomadaire(sock, options) {
  if (!instance) {
    instance = new ProgrammeHebdomadaire(options);
    instance.sock = sock;
  }
  return instance;
}
