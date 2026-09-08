const { cmd } = require('../command.cjs');
const baileysDl = (() => { try { return require('@whiskeysockets/baileys').downloadMediaMessage; } catch { return null; } })();
const fallbackDl = require('../lib/msg.cjs').downloadMediaMessage;
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { saveVoiceProfile, getVoiceProfile, touchProfile, deleteVoiceProfile, hasVoiceProfile } = require('../lib/voice-profiles.cjs');

async function dlMedia(m, filename) {
  if (baileysDl) {
    try { return await baileysDl(m, filename, {}); } catch {}
  }
  return fallbackDl(m, filename);
}

/* ══════════════════════════════════════════════════════════════════════════════
   clonevoice.cjs — Clonage vocal IA persistant
   
   .clonevoice <texte>         → Clone la voix et répond avec cette voix
   .clonevoicesave             → Sauvegarde le clone comme profil permanent
   .voiceclone <texte>         → Alias
   .cloneset <elevenlabs_key>  → Configurer la clé API ElevenLabs
   .voiceinfo                  → Voir le profil vocal
   .voicedel                   → Supprimer le profil vocal
   
   Le bot répond parfois par voix, parfois par texte (aléatoire).
   Quand il répond par voix, il utilise la voix clonée de l'utilisateur.
   ══════════════════════════════════════════════════════════════════════════════ */

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const TMP_DIR = path.join(__dirname, '..', 'tmp');
const CLONE_CACHE = new Map(); // chatId → { voiceId, expiresAt }
const CLONE_TTL = 10 * 60 * 1000; // 10 minutes

// S'assurer que le dossier tmp existe
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function getApiKey() {
  return process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_KEY || '';
}

async function downloadAudio(msg, filename) {
  try {
    const buf = await dlMedia(msg, filename);
    if (buf) {
      const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(filename));
      if (files.length) return path.join(TMP_DIR, files[0]);
      const filePath = path.join(TMP_DIR, filename + '.ogg');
      fs.writeFileSync(filePath, buf);
      return filePath;
    }
  } catch {}
  throw new Error('Impossible de télécharger l\'audio');
}

async function createVoiceClone(apiKey, audioPath, name) {
  const FormData = require('form-data');
  const fd = new FormData();
  fd.append('name', name);
  fd.append('files', fs.createReadStream(audioPath));

  const res = await axios.post(ELEVENLABS_API + '/voices/add', fd, {
    headers: {
      'xi-api-key': apiKey,
      ...fd.getHeaders(),
    },
    timeout: 30000,
  });

  return res.data; // { voice_id, name, ... }
}

async function deleteVoiceClone(apiKey, voiceId) {
  try {
    await axios.delete(ELEVENLABS_API + '/voices/' + voiceId, {
      headers: { 'xi-api-key': apiKey },
      timeout: 10000,
    });
  } catch {}
}

async function textToSpeech(apiKey, voiceId, text, modelId = 'eleven_multilingual_v2') {
  const res = await axios.post(
    ELEVENLABS_API + '/text-to-speech/' + voiceId,
    {
      text: text.slice(0, 5000), // Limite ElevenLabs
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

function cleanupTemp() {
  const now = Date.now();
  for (const [key, val] of CLONE_CACHE) {
    if (val.expiresAt < now) {
      CLONE_CACHE.delete(key);
      if (val.voiceId) {
        const apiKey = getApiKey();
        if (apiKey) deleteVoiceClone(apiKey, val.voiceId).catch(() => {});
      }
    }
  }
}

// Nettoyage toutes les 5 minutes
setInterval(cleanupTemp, 5 * 60 * 1000).unref();

cmd({
  pattern: 'cloneset',
  alias: ['setvoicekey', 'elevenlabs'],
  category: 'owner',
  fromMe: true,
  desc: 'Configurer la clé API ElevenLabs pour le voice cloning',
  filename: __filename
}, async (conn, m, commands, { q, reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');
  if (!q) return reply('❌ Usage: .cloneset <clé_api_elevenlabs>\n\n📥 Obtiens ta clé sur https://elevenlabs.io');

  process.env.ELEVENLABS_API_KEY = q.trim();
  reply('✅ Clé API ElevenLabs configurée!\n\n🧪 Teste avec .clonevoice en répondant à un message vocal.');
});

cmd({
  pattern: 'clonevoice',
  alias: ['voiceclone', 'clonemimic', 'clonage'],
  category: 'ai',
  desc: 'Cloner la voix d\'un message vocal et répondre avec cette voix',
  filename: __filename
}, async (conn, m, commands, { q, reply }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return reply(
      '❌ *Clé API ElevenLabs requise*\n\n' +
      '📥 Obtiens ta clé gratuite sur :\nhttps://elevenlabs.io\n\n' +
      '🔑 Puis configure-la avec :\n.cloneset <ta_clé>'
    );
  }

  // Vérifier qu'on répond à un message vocal
  const quoted = m.quoted;
  if (!quoted) {
    return reply(
      '🎤 *Usage :*\n' +
      'Réponds à un message vocal avec :\n' +
      '.clonevoice <texte à dire>\n\n' +
      'Exemple :\n' +
      '1. Quelqu\'un envoie un message vocal\n' +
      '2. Tu réponds au message avec : .clonevoice Bonjour comment ça va ?\n' +
      '3. Le bot reproduit la voix et dit le texte!'
    );
  }

  const isAudio = quoted?.msg?.audioMessage || quoted?.type === 'audioMessage' || quoted?.type === 'ptt' || quoted?._data?.mimetype?.startsWith('audio');
  if (!isAudio) {
    return reply('❌ Le message cité n\'est pas un message vocal.\nRéponds à un message vocal avec .clonevoice <texte>');
  }

  if (!q || q.trim().length < 2) {
    return reply('❌ Ajoute le texte à dire après .clonevoice\nEx: .clonevoice Bonjour tout le monde');
  }

  // Télécharger l'audio source
  const audioMsg = quoted.msg || quoted._raw || quoted;
  let audioPath;
  try {
    const filename = 'clone_src_' + Date.now();
    audioPath = await downloadAudio(audioMsg, filename);
  } catch (e) {
    return reply('❌ Impossible de télécharger l\'audio: ' + e.message);
  }

  const statusMsg = await reply('🎤 *Clonage vocal en cours...*\n\n⏳ Analyse de la voix...');

  try {
    // 1. Créer le clone vocal
    const cloneName = 'clone_' + Date.now();
    const cloneResult = await createVoiceClone(apiKey, audioPath, cloneName);
    const voiceId = cloneResult.voice_id;

    // Mettre en cache temporaire
    CLONE_CACHE.set(m.chat, { voiceId, expiresAt: Date.now() + CLONE_TTL });

    // 2. Générer la parole dans la voix clonée
    const speechBuffer = await textToSpeech(apiKey, voiceId, q.trim());

    // 3. Envoyer l'audio
    await conn.sendMessage(m.chat, {
      audio: speechBuffer,
      mimetype: 'audio/mpeg',
      ptt: true,
    }, { quoted: m });

    // 4. Sauvegarder le profil vocal de manière permanente
    const senderNum = m.sender?.split(':')[0]?.split('@')[0] || m.chat?.split(':')[0]?.split('@')[0];
    if (senderNum) {
      saveVoiceProfile(senderNum, voiceId, cloneName);
      console.log(`🎤 Voice profile saved for ${senderNum}: ${voiceId}`);
    }

    // 5. Nettoyer le clone temporaire après 30 secondes (mais garder le profil)
    setTimeout(() => {
      // On ne supprime PAS le clone ElevenLabs car on veut le garder pour le profil
      CLONE_CACHE.delete(m.chat);
    }, 30000);

    // 6. Supprimer le message de statut
    try { await conn.sendMessage(m.chat, { delete: statusMsg.key }); } catch {}

  } catch (e) {
    const errMsg = e.response?.data?.detail?.message || e.message;
    if (errMsg.includes('quota') || errMsg.includes('limit')) {
      reply('❌ *Quota ElevenLabs épuisé*\n\n📊 Limite gratuite: 10K caractères/mois\n💡 Réessaie plus tard ou passe au plan premium.');
    } else if (errMsg.includes('voice')) {
      reply('❌ Erreur de clonage vocal: ' + errMsg + '\n\n💡 Assure-toi que l\'audio est clair et d\'au moins 3 secondes.');
    } else {
      reply('❌ Erreur: ' + errMsg);
    }
  } finally {
    // Supprimer le fichier temporaire
    try { fs.unlinkSync(audioPath); } catch {}
  }
});

cmd({
  pattern: 'voiceinfo',
  alias: ['cloneinfo'],
  category: 'ai',
  desc: 'Informations sur le voice cloning',
  filename: __filename
}, async (conn, m, commands, { reply }) => {
  const apiKey = getApiKey();
  const hasKey = !!apiKey;

  let text = '🎤 *VOICE CLONING — DJOUSSE TECH*\n\n';
  text += '┌─────────────────────────────────┐\n';
  text += '│ 🔑 API: ElevenLabs\n';
  text += '│ ✅ Clé: ' + (hasKey ? 'Configurée' : 'Non configurée') + '\n';
  text += '│ 📊 Quota: ' + (hasKey ? '10K chars/mois (gratuit)' : 'N/A') + '\n';
  text += '└─────────────────────────────────┘\n\n';

  text += '📝 *Comment utiliser :*\n\n';
  text += '1. Quelqu\'un envoie un message vocal\n';
  text += '2. Tu réponds au message avec :\n';
  text += '   .clonevoice Bonjour comment ça va ?\n';
  text += '3. Le bot reproduit la voix et dit le texte!\n\n';

  text += '🔑 *Configurer la clé API :*\n';
  text += '1. Va sur https://elevenlabs.io\n';
  text += '2. Crée un compte gratuit\n';
  text += '3. Copie ta clé API\n';
  text += '4. Tape .cloneset <ta_clé>\n\n';

  text += '⚠️ *Limites :*\n';
  text += '• Quota gratuit: 10K caractères/mois\n';
  text += '• Audio source: 3-30 secondes recommandé\n';
  text += '• Cloned voices: durée limitée (10 min)\n';
  text += '• Meilleur résultat: voix claire, sans bruit';

  reply(text);
});

cmd({
  pattern: 'clonevoicesave',
  alias: ['savevoice', 'voiceperso'],
  category: 'ai',
  desc: 'Sauvegarder le clone vocal comme profil permanent',
  filename: __filename
}, async (conn, m, commands, { q, reply }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return reply('❌ Clé API ElevenLabs requise.\nConfigure-la avec .cloneset <clé>');
  }

  const quoted = m.quoted;
  if (!quoted) {
    return reply(
      '🎤 *Sauvegarder ta voix*\n\n' +
      '1. Envoie un message vocal (ta voix)\n' +
      '2. Réponds au message avec :\n' +
      '   .clonevoicesave\n\n' +
      'Le bot va sauvegarder ta voix pour toujours.\n' +
      'Il pourra ensuite répondre avec ta voix !'
    );
  }

  const isAudio = quoted?.msg?.audioMessage || quoted?.type === 'audioMessage' || quoted?.type === 'ptt' || quoted?._data?.mimetype?.startsWith('audio');
  if (!isAudio) {
    return reply('❌ Le message cité n\'est pas un message vocal.');
  }

  const statusMsg = await reply('🎤 *Sauvegarde de ta voix...*\n\n⏳ Analyse en cours...');

  try {
    // Adapter le message pour le téléchargement (Baileys ou wwebjs)
    const audioMsg = quoted.msg || quoted._raw || quoted;
    const filename = 'profile_' + Date.now();
    const audioPath = await downloadAudio(audioMsg, filename);

    const cloneName = 'owner_voice_' + Date.now();
    const cloneResult = await createVoiceClone(apiKey, audioPath, cloneName);
    const voiceId = cloneResult.voice_id;

    const senderNum = m.sender?.split(':')[0]?.split('@')[0];
    if (!senderNum) {
      return reply('❌ Impossible de récupérer ton numéro.');
    }

    saveVoiceProfile(senderNum, voiceId, cloneName);

    await conn.sendMessage(m.chat, { delete: statusMsg.key }).catch(() => {});
    reply(
      '✅ *Voix sauvegardée !*\n\n' +
      '🎤 Le bot peut maintenant répondre avec ta voix.\n\n' +
      '📝 *Comment ça marche :*\n' +
      '• Parfois il répond par texte\n' +
      '• Parfois il répond par voix (avec ta voix clonée)\n' +
      '• C\'est aléatoire pour un rendu naturel\n\n' +
      '🗑️ Pour supprimer : .voicedel'
    );

    try { fs.unlinkSync(audioPath); } catch {}

  } catch (e) {
    await conn.sendMessage(m.chat, { delete: statusMsg.key }).catch(() => {});
    const errMsg = e.response?.data?.detail?.message || e.message;
    reply('❌ Erreur: ' + errMsg);
  }
});

cmd({
  pattern: 'voicedel',
  alias: ['deletevoice', 'removevoice'],
  category: 'ai',
  desc: 'Supprimer le profil vocal sauvegardé',
  filename: __filename
}, async (conn, m, commands, { reply }) => {
  const senderNum = m.sender?.split(':')[0]?.split('@')[0];
  if (!senderNum) return reply('❌ Impossible de récupérer ton numéro.');

  if (!hasVoiceProfile(senderNum)) {
    return reply('❌ Tu n\'as pas de profil vocal sauvegardé.\nUtilise .clonevoicesave d\'abord.');
  }

  deleteVoiceProfile(senderNum);
  reply('✅ Profil vocal supprimé.\nLe bot ne répondra plus par voix avec ta voix clonée.');
});

cmd({
  pattern: 'myvoice',
  alias: ['monvoice', 'monprofil'],
  category: 'ai',
  desc: 'Voir ton profil vocal sauvegardé',
  filename: __filename
}, async (conn, m, commands, { reply }) => {
  const senderNum = m.sender?.split(':')[0]?.split('@')[0];
  if (!senderNum) return reply('❌ Impossible de récupérer ton numéro.');

  const profile = getVoiceProfile(senderNum);
  if (!profile) {
    return reply(
      '🎤 *Tu n\'as pas de profil vocal*\n\n' +
      'Pour en créer un :\n' +
      '1. Envoie un message vocal\n' +
      '2. Réponds avec .clonevoicesave\n\n' +
      'Le bot pourra ensuite répondre avec ta voix !'
    );
  }

  const created = new Date(profile.createdAt).toLocaleDateString('fr-FR');
  const used = profile.lastUsed ? new Date(profile.lastUsed).toLocaleDateString('fr-FR') : 'Jamais';

  reply(
    '🎤 *TON PROFIL VOCAL*\n\n' +
    '┌─────────────────────────────────┐\n' +
    '│ 📝 Nom: ' + (profile.name || 'N/A') + '\n' +
    '│ 🆔 Voice ID: ' + profile.voiceId.slice(0, 12) + '...\n' +
    '│ 📅 Créé: ' + created + '\n' +
    '│ 🔄 Dernière utilisation: ' + used + '\n' +
    '│ 📊 Utilisé: ' + (profile.useCount || 0) + ' fois\n' +
    '└─────────────────────────────────┘\n\n' +
    '✅ Le bot peut répondre avec ta voix !\n' +
    '🗑️ Pour supprimer : .voicedel'
  );
});
