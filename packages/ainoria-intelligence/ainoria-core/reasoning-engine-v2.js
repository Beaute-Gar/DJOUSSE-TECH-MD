/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  reasoning-engine-v2.js — Moteur de raisonnement v2       ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { router } from './provider-registry.js';
import { rappelerContexte, ajouterTourCourtTerme } from './memory-engine.js';
import { decomposerEnEtapes, executerPlan } from './planning-engine.js';
import { verifierPermissions } from './permissions-engine.js';
import { PROMPT_SYSTEME_AINORIA } from './ainoria-core-v2.js';

async function analyserIntention(message, contexteMemoire) {
  const contexteCourt = contexteMemoire.courtTerme
    .slice(-5)
    .map(t => `${t.role}: ${t.contenu}`)
    .join('\n');

  const prompt = `${PROMPT_SYSTEME_AINORIA}

Analyse ce message et classe son intention.
${contexteCourt ? `\nContexte récent:\n${contexteCourt}` : ''}

Message : "${message}"

Réponds UNIQUEMENT avec un JSON :
{
  "intention": "question_simple" | "demande_action" | "conversation_sociale" | "demande_complexe_multi_etapes",
  "sujet": "résumé court du sujet en 5 mots max",
  "necessite_outil": true ou false,
  "langue_detectee": "fr" | "en" | "es" | autre code ISO 639-1,
  "urgence": "normale" | "urgente"
}`;

  const { resultat } = await router('classification', prompt, { jsonMode: true, temperature: 0.1 });
  return JSON.parse(resultat);
}

async function synthetiserReponse(message, contexteMemoire, resultatsOutils, configBot = null) {
  const contexteSystme = configBot?.promptSysteme || PROMPT_SYSTEME_AINORIA;

  const partiesContexte = [];

  if (contexteMemoire.preferences && Object.keys(contexteMemoire.preferences).length) {
    partiesContexte.push(`Préférences connues de cet utilisateur :\n${JSON.stringify(contexteMemoire.preferences)}`);
  }
  if (contexteMemoire.faitsLongTerme.length) {
    partiesContexte.push(`Faits mémorisés sur cet utilisateur :\n${contexteMemoire.faitsLongTerme.map(f => `- ${f.fait}`).join('\n')}`);
  }
  if (contexteMemoire.resultatsSemantiques.length) {
    partiesContexte.push(`Éléments pertinents retrouvés en mémoire :\n${contexteMemoire.resultatsSemantiques.map(r => `- ${r.texte}`).join('\n')}`);
  }
  if (resultatsOutils) {
    partiesContexte.push(`Résultats des actions que tu viens d'effectuer :\n${JSON.stringify(resultatsOutils, null, 2)}`);
  }

  const messages = [
    { role: 'system', content: contexteSystme },
    ...contexteMemoire.courtTerme.slice(-12).map(t => ({ role: t.role, content: t.contenu })),
    ...(partiesContexte.length ? [{ role: 'system', content: partiesContexte.join('\n\n') }] : []),
    { role: 'user', content: message },
  ];

  const { resultat, fournisseurUtilise, modele } = await router('conversation', null, {
    messages,
    temperature: 0.8,
    maxTokens: 600,
  });

  return { reponse: resultat, fournisseurUtilise, modele };
}

export async function raisonner(userId, sessionId, message, contexteUtilisateur) {
  const { autorise } = await verifierPermissions(userId, []);
  if (!autorise) return { reponse: 'Accès refusé.', erreur: 'permission_refusee' };

  const contexteMemoire = await rappelerContexte(userId, sessionId, message);

  const intention = await analyserIntention(message, contexteMemoire);

  let resultatsOutils = null;

  if (intention.necessite_outil || intention.intention === 'demande_complexe_multi_etapes') {
    const permissionsUtilisateur = contexteUtilisateur.permissions || [];
    const plan = await decomposerEnEtapes(message, { ...contexteUtilisateur, userId });
    resultatsOutils = await executerPlan(plan, { ...contexteUtilisateur, userId, permissions: permissionsUtilisateur });

    if (!resultatsOutils.termine) {
      const messageEchec = `Je n'ai pas pu terminer cette demande complètement. L'étape ${resultatsOutils.etapeEchouee} a échoué. Veux-tu que je réessaie différemment ?`;
      await ajouterTourCourtTerme(sessionId, 'user', message);
      await ajouterTourCourtTerme(sessionId, 'assistant', messageEchec);
      return { reponse: messageEchec, intention, journal: resultatsOutils.journal };
    }
  }

  const { reponse, fournisseurUtilise, modele } = await synthetiserReponse(
    message, contexteMemoire, resultatsOutils, contexteUtilisateur.configBot
  );

  await ajouterTourCourtTerme(sessionId, 'user', message);
  await ajouterTourCourtTerme(sessionId, 'assistant', reponse);

  return { reponse, intention, fournisseurUtilise, modele, journal: resultatsOutils?.journal || null };
}
