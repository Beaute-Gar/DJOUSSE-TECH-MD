'use strict';

/* Assainissement des entrées utilisateur — à utiliser avant toute requête
   SQL, commande shell ou stockage. Jamais de concaténation brute. */

function sanitize(input, maxLen = 200) {
  const s = String(input == null ? '' : input);
  return s
    .replace(/[\u0000-\u001f\u007f]/g, ' ')   // contrôle / nul
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function onlyDigits(input) {
  return String(input == null ? '' : input).replace(/\D/g, '');
}

function onlyAlphaNum(input, maxLen = 100) {
  return String(input == null ? '' : input)
    .replace(/[^a-zA-Z0-9 _\-.]/g, '')
    .trim()
    .slice(0, maxLen);
}

function safeLabel(input, maxLen = 30) {
  return String(input == null ? '' : input)
    .replace(/[^\p{L}\p{N} _\-.]/gu, '')
    .trim()
    .slice(0, maxLen);
}

function escapeRegex(input) {
  return String(input == null ? '' : input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { sanitize, onlyDigits, onlyAlphaNum, safeLabel, escapeRegex };