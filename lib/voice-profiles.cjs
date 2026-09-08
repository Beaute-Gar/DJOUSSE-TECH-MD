const fs = require('fs');
const path = require('path');

/* ══════════════════════════════════════════════════════════════════════════════
   voice-profiles.cjs — Gestion des profils vocaux clonés
   
   Stocke les voice IDs ElevenLabs par utilisateur de manière persistante.
   Permet au bot de répondre avec la voix de l'utilisateur.
   ══════════════════════════════════════════════════════════════════════════════ */

const PROFILES_DIR = path.join(process.cwd(), 'database', 'voice-profiles.json');

function loadProfiles() {
  try { return JSON.parse(fs.readFileSync(PROFILES_DIR, 'utf8')); }
  catch { return {}; }
}

function saveProfiles(data) {
  try {
    fs.mkdirSync(path.dirname(PROFILES_DIR), { recursive: true });
    fs.writeFileSync(PROFILES_DIR, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('❌ voice-profiles: save failed:', err.message);
    return false;
  }
}

function normalizeNumber(num) {
  return String(num || '').replace(/[^0-9]/g, '').split('@')[0].split(':')[0];
}

/**
 * Sauvegarder le profil vocal d'un utilisateur
 * @param {string} userId - Numéro de téléphone de l'utilisateur
 * @param {string} voiceId - ID de la voix clonée sur ElevenLabs
 * @param {string} name - Nom du clone
 * @returns {boolean} true si sauvegardé
 */
function saveVoiceProfile(userId, voiceId, name) {
  const profiles = loadProfiles();
  const num = normalizeNumber(userId);
  profiles[num] = {
    voiceId,
    name: name || 'owner_voice',
    createdAt: Date.now(),
    lastUsed: Date.now(),
    useCount: 0
  };
  return saveProfiles(profiles);
}

/**
 * Récupérer le profil vocal d'un utilisateur
 * @param {string} userId - Numéro de téléphone
 * @returns {object|null} profil vocal ou null
 */
function getVoiceProfile(userId) {
  const profiles = loadProfiles();
  const num = normalizeNumber(userId);
  return profiles[num] || null;
}

/**
 * Mettre à jour le compteur d'utilisation
 */
function touchProfile(userId) {
  const profiles = loadProfiles();
  const num = normalizeNumber(userId);
  if (profiles[num]) {
    profiles[num].lastUsed = Date.now();
    profiles[num].useCount = (profiles[num].useCount || 0) + 1;
    saveProfiles(profiles);
  }
}

/**
 * Supprimer le profil vocal d'un utilisateur
 */
function deleteVoiceProfile(userId) {
  const profiles = loadProfiles();
  const num = normalizeNumber(userId);
  if (profiles[num]) {
    delete profiles[num];
    return saveProfiles(profiles);
  }
  return false;
}

/**
 * Lister tous les profils vocaux
 */
function listVoiceProfiles() {
  const profiles = loadProfiles();
  return Object.entries(profiles).map(([num, info]) => ({
    number: num,
    name: info.name,
    createdAt: info.createdAt,
    lastUsed: info.lastUsed,
    useCount: info.useCount || 0
  }));
}

/**
 * Vérifier si un utilisateur a un profil vocal
 */
function hasVoiceProfile(userId) {
  return !!getVoiceProfile(userId);
}

module.exports = {
  saveVoiceProfile,
  getVoiceProfile,
  touchProfile,
  deleteVoiceProfile,
  listVoiceProfiles,
  hasVoiceProfile,
  normalizeNumber
};
