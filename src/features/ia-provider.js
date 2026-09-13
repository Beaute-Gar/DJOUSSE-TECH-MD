/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  IA PROVIDER — Appel via AINORIA (identité injectée)       ║
 * ║  Délègue au cerveau central AINORIA au lieu d'appeler     ║
 * ║  directement les APIs. Fallback: Puter                     ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ainoria = require('../../lib/ainoria.cjs');

async function appelerAINORIA(prompt) {
  try {
    const result = await ainoria.chat(prompt);
    return result || '';
  } catch {
    return '';
  }
}

async function appelerPuter(prompt, { modele = 'gpt-4o-mini' } = {}) {
  try {
    if (!globalThis.puter?.ai?.chat) return '';
    const reponse = await globalThis.puter.ai.chat(prompt, { model: modele });
    return typeof reponse === 'string' ? reponse : reponse?.message?.content || '';
  } catch {
    return '';
  }
}

export function creerAppelIA(config = {}) {
  return async function appelerIA(prompt) {
    // 1) AINORIA (identité DJOUSSE TECH injectée automatiquement)
    try {
      const texte = await appelerAINORIA(prompt);
      if (texte && texte.trim()) return texte;
    } catch {}

    // 2) Fallback Puter
    try {
      const texte = await appelerPuter(prompt, config);
      if (texte && texte.trim()) return texte;
    } catch {}

    return '';
  };
}
