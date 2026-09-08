import { createLogger } from '../../infrastructure/logger.js';
import { getSocket } from '../../connectors/whatsapp/adapter-baileys/bot.js';
import { createRequire } from 'module';

const log = createLogger('VOICE:WELCOME');
const require = createRequire(import.meta.url);
let _welcomeSent = false;
const GROQ_KEY = process.env.GROQ_API_KEY || '';

async function groqGenerate(prompt) {
  if (!GROQ_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7, max_tokens: 600,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

export async function sendVoiceWelcome(stats = null) {
  if (_welcomeSent) return;
  _welcomeSent = true;

  const sock = getSocket();
  if (!sock) return;

  const config = require('../../../config.cjs');
  const ownerJid = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  if (!ownerJid || ownerJid === '@s.whatsapp.net') return;

  const userName = sock.user?.name || sock.user?.verifiedName || sock.user?.id?.split('@')[0] || '';

  let personalizedSection = '';
  if (stats) {
    const g = stats.totalGroups || 0;
    const c = stats.totalCommunities || 0;
    const p = stats.totalPrivateChats || 0;
    const tg = stats.topGroups?.length ? stats.topGroups.slice(0, 3).join(', ') : '';
    const tc = stats.topCommunities?.length ? stats.topCommunities.slice(0, 3).join(', ') : '';
    const tp = stats.topPrivateName || '';

    if (g === 0 && c === 0 && p === 0) {
      personalizedSection = `Je suis en train d'analyser ton compte WhatsApp. Dans quelques instants, j'aurai une vue complète de tes groupes, communautés et conversations. Patiente un peu, le temps que tout se synchronise.`;
    } else {
      const groqPrompt =
`Génère un paragraphe court et naturel (max 80 mots) en français parlé, comme si tu parlais à voix haute. 
Tu viens d'analyser le compte WhatsApp de l'utilisateur. Voici les données réelles :

- ${g} groupes, ${c} communautés, ${p} discussions privées
- Ses 3 groupes principaux : ${tg || 'non disponible'}
- Ses communautés : ${tc || 'non disponible'}
- Sa conversation privée la plus active : ${tp ? tp + ' (' + (stats.topPrivateMsgs || 0) + ' messages)' : 'non disponible'}

Le paragraphe doit annoncer ces chiffres de façon naturelle et impressionnante. 
Exemple de style : "Je viens d'analyser ton WhatsApp. Tu participes activement à ..."
Ne fais que le paragraphe, rien d'autre.`;

      const groqResult = await groqGenerate(groqPrompt);
      if (groqResult) {
        personalizedSection = groqResult;
      } else {
        personalizedSection = `Je viens d'analyser ton compte. Tu participes à ${g} groupes, ${c} communautés, et tu as ${p} conversations privées. ${tp ? 'Ta discussion la plus active est avec ' + tp + '. ' : ''}${tg ? 'Tes groupes principaux sont ' + tg + '.' : ''}`;
      }
    }
  }

  const voiceText =
`Salut ${userName || ''}.

Je suis Djoussé Tech.

Ton WhatsApp vient d'évoluer.

À partir de maintenant, WhatsApp devient bien plus qu'une application de messagerie. Il devient un espace intelligent capable de comprendre, d'organiser et d'agir pour toi.

${personalizedSection ? personalizedSection + '\n\n' : ''}Je peux retrouver instantanément une information oubliée, résumer des centaines de messages, organiser tes tâches, protéger tes groupes, créer des rappels, t'aider à prendre des décisions et automatiser de nombreuses actions du quotidien.

Je comprends le langage naturel. Tu n'as pas besoin d'apprendre des commandes compliquées. Parle-moi simplement comme tu parlerais à une personne.

Avant de commencer, quelques informations importantes.

Tu restes le seul propriétaire de ton compte WhatsApp.

Aucune action importante n'est effectuée sans ton autorisation.

Les informations que tu décides de me confier sont utilisées uniquement pour améliorer ton expérience.

Tu peux désactiver mes fonctionnalités ou supprimer tes données à tout moment.

En continuant, tu acceptes les Conditions d'utilisation ainsi que la Politique de confidentialité de Djoussé Tech.

Maintenant, je vais te montrer quelque chose que WhatsApp ne sait pas faire.

Après ton autorisation, j'activerai ton espace intelligent et je lancerai une première démonstration.

Tu comprendras immédiatement pourquoi Djoussé Tech n'est pas un simple bot.

Réponds simplement Oui.

Une fois ton accord reçu, toutes les fonctionnalités seront activées et la démonstration commencera.

Bienvenue dans la nouvelle génération de WhatsApp.

Bienvenue chez Djoussé Tech.`;

  try {
    const { genererVocal } = await import('./voice-persona.js');
    const audioBuf = await genererVocal(voiceText, 'dynamique', { backgroundMusic: true });
    if (audioBuf && audioBuf.length > 100) {
      await sock.sendMessage(ownerJid, { audio: audioBuf, mimetype: 'audio/ogg; codecs=opus', ptt: true });
      log.info('Message d\'accueil vocal personnalisé envoyé');
      return;
    }
  } catch (e) {
    log.warn(`Voice welcome echoué: ${e.message}`);
  }

  try {
    const fallback = `Salut 👋\n\nJe suis DJOUSSE TECH.\n\nTon WhatsApp vient d'évoluer.\n${personalizedSection ? '\n' + personalizedSection + '\n' : ''}\n[Message vocal non disponible — Réponds "Oui" pour activer]\n\nBienvenue chez DJOUSSE TECH. 🚀`;
    await sock.sendMessage(ownerJid, { text: fallback });
    log.info('Fallback texte envoyé');
  } catch (e) {
    log.warn(`Fallback echoué: ${e.message}`);
  }
}
