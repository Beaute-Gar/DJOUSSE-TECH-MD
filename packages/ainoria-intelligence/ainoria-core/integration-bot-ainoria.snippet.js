/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  integration-bot-ainoria.snippet.js                          ║
 * ║  Snippet à fusionner dans bot.js pour intégrer AINORIA v2   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Remplace les appels directs à Groq/Gemini par le noyau AINORIA
 * qui utilise Provider Registry (OpenRouter > Puter > Groq).
 *
 * Variables d'environnement requises :
 *   OPENROUTER_API_KEY=sk-or-v1-xxxx   ← OBLIGATOIRE
 *   GROQ_API_KEY=gsk_xxxx              ← optionnel (fallback)
 *
 * Imports à ajouter en haut de bot.js :
 *
 *   import { initialiserAinoria, traiter } from './core/ainoria-core-v2.js';
 *   import { setSocketWhatsApp } from './core/whatsapp-tools.js';
 *   import { getPermissionsUtilisateur } from './core/permissions-engine.js';
 *
 * Dans la connexion WhatsApp (connection === 'open') :
 *
 *   await initialiserAinoria(sock);
 *
 * Dans le handler de messages (messages.upsert) :
 *
 *   const permissions = await getPermissionsUtilisateur(senderId);
 *   const { reponse, fournisseurUtilise } = await traiter(
 *     senderId, jid, texte, permissions
 *   );
 *   if (reponse) await sock.sendMessage(jid, { text: reponse });
 */
