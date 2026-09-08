const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getVoiceProfile, touchProfile } = require('./voice-profiles.cjs');

/* ══════════════════════════════════════════════════════════════════════════════
   voice-responder.cjs — Moteur de réponse voix/tekse naturel
   
   Le bot varie ses réponses :
   - Parfois par texte (écrit)
   - Parfois par voix (audio avec la voix clonée)
   
   La décision est aléatoire mais peut être contrôlée :
   - Si l'utilisateur n'a pas de profil vocal → toujours texte
   - Si le quota ElevenLabs est épuisé → toujours texte
   - Sinon → aléatoire (60% texte, 40% voix par défaut)
   ══════════════════════════════════════════════════════════════════════════════ */

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const TMP_DIR = path.join(__dirname, '..', 'tmp');

// Ratio texte/voix (ajustable)
const VOICE_RATIO = 0.4; // 40% de chance de répondre par voix

function getApiKey() {
  return process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_KEY || '';
}

/**
 * Convertir texte en audio avec la voix clonée
 */
async function textToSpeech(apiKey, voiceId, text, modelId = 'eleven_multilingual_v2') {
  const res = await axios.post(
    ELEVENLABS_API + '/text-to-speech/' + voiceId,
    {
      text: text.slice(0, 5000),
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      timeout: 60000,
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(res.data);
}

/**
 * Déterminer si la réponse doit être en voix
 * @returns {boolean} true si voix, false si texte
 */
function shouldRespondWithVoice(userId) {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  const profile = getVoiceProfile(userId);
  if (!profile) return false;

  // Aléatoire basé sur le ratio
  return Math.random() < VOICE_RATIO;
}

/**
 * Envoyer une réponse (voix ou texte) de manière naturelle
 * @param {object} conn - Connexion WhatsApp
 * @param {object} m - Message original
 * @param {string} text - Texte de la réponse
 * @param {object} options - Options supplémentaires
 */
async function sendSmartReply(conn, m, text, options = {}) {
  const userId = m.sender?.split(':')[0]?.split('@')[0] || '';
  const useVoice = options.forceVoice || shouldRespondWithVoice(userId);

  if (useVoice) {
    const apiKey = getApiKey();
    const profile = getVoiceProfile(userId);

    if (apiKey && profile) {
      try {
        const speechBuffer = await textToSpeech(apiKey, profile.voiceId, text);
        touchProfile(userId);

        await conn.sendMessage(m.chat, {
          audio: speechBuffer,
          mimetype: 'audio/mpeg',
          ptt: true,
        }, { quoted: m });

        return { sent: true, mode: 'voice' };
      } catch (e) {
        console.error('Voice reply failed, falling back to text:', e.message);
        // Fallback vers texte en cas d'erreur
      }
    }
  }

  // Réponse texte
  await conn.sendMessage(m.chat, { text }, { quoted: m });
  return { sent: true, mode: 'text' };
}

/**
 * Générer une réponse IA et l'envoyer intelligemment
 */
async function aiSmartReply(conn, m, aiResponse, options = {}) {
  if (!aiResponse || aiResponse.trim().length === 0) {
    return sendSmartReply(conn, m, "Je n'ai pas pu générer de réponse.", options);
  }
  return sendSmartReply(conn, m, aiResponse, options);
}

module.exports = {
  sendSmartReply,
  aiSmartReply,
  shouldRespondWithVoice,
  textToSpeech,
  VOICE_RATIO
};
