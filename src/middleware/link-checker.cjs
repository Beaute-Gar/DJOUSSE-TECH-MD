/**
 * Link Safety Checker — DJOUSSE-TECH-MD
 * 
 * Vérifie les liens contenus dans les messages WhatsApp.
 * 
 * Sources:
 * 1. Liste noire de domaines (URL shorteners, fichiers dangereux)
 * 2. Patterns suspects (phishing, spam)
 * 3. Google Safe Browsing (si clé API configurée)
 * 
 * Classification: SAFE | SUSPICIOUS | MALICIOUS | UNKNOWN
 */

const crypto = require('crypto');

const LINK_CONFIG = {
  // Domaines toujours bloqués (URL shorteners dangereux)
  BLACKLISTED_DOMAINS: [
    'bit.ly', 'tinyurl.com', 't.co', 'short.io', 'is.gd', 'shorturl.at',
    'cutt.ly', 'rb.gy', 'dwz.cn', 'v.gd', 'qr.ae', 'adf.ly',
    'bc.vc', 'fc.lc', 'sh.st', 'adfly.com', 'linkbucks.com',
  ],
  
  // Extensions de fichiers suspectes
  SUSPICIOUS_EXTENSIONS: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.msi', '.jar', '.vbs', '.js'],
  
  // Domaines whitelistés (jamais bloqués)
  WHITELISTED_DOMAINS: [
    'youtube.com', 'youtu.be', 'github.com', 'google.com', 'whatsapp.com',
    'instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com',
    'wikipedia.org', 'reddit.com', 'linkedin.com', 'microsoft.com',
    'apple.com', 'amazon.com', 'netflix.com', 'spotify.com',
  ],
  
  // Patterns de phishing
  PHISHING_PATTERNS: [
    /login.*verify/i, /account.*suspend/i, /click.*here.*urgent/i,
    /won.*prize/i, /congratulations.*won/i, /free.*iphone/i,
    /investment.*guaranteed/i, /make.*money.*fast/i,
    /whatsapp.*gold/i, /whatsapp.*premium/i, /gb.*whatsapp/i,
    /hotspot.*shield/i, /free.*vpn/i,
  ],
};

/**
 * Extraire toutes les URLs d'un texte
 */
function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi;
  return (text.match(urlRegex) || []).map(url => {
    try {
      // Normaliser: ajouter https:// si nécessaire
      if (url.startsWith('www.')) return 'https://' + url;
      return url;
    } catch { return url; }
  });
}

/**
 * Extraire le domaine d'une URL
 */
function extractDomain(url) {
  try {
    const u = new URL(url.startsWith('www.') ? 'https://' + url : url);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.split('/')[2]?.toLowerCase()?.replace(/^www\./, '') || '';
  }
}

/**
 * Vérifier un lien contre les listes de patterns
 * @returns {{ classification: string, reason: string, details: object }}
 */
function checkLink(url) {
  const domain = extractDomain(url);
  
  // 1. Vérifier whitelist
  if (LINK_CONFIG.WHITELISTED_DOMAINS.some(d => domain.endsWith(d))) {
    return { classification: 'SAFE', reason: 'Domaine whitelisté', details: { domain } };
  }
  
  // 2. Vérifier blacklist (URL shorteners)
  if (LINK_CONFIG.BLACKLISTED_DOMAINS.some(d => domain.endsWith(d))) {
    return { classification: 'SUSPICIOUS', reason: 'URL shortener détecté', details: { domain, type: 'shortener' } };
  }
  
  // 3. Vérifier extensions suspectes
  const ext = domain.split('.').pop();
  const pathExt = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  if (LINK_CONFIG.SUSPICIOUS_EXTENSIONS.some(e => pathExt?.endsWith(e.replace('.', '')))) {
    return { classification: 'MALICIOUS', reason: 'Extension dangereuse', details: { domain, extension: pathExt } };
  }
  
  // 4. Vérifier patterns de phishing
  for (const pattern of LINK_CONFIG.PHISHING_PATTERNS) {
    if (pattern.test(url)) {
      return { classification: 'MALICIOUS', reason: 'Pattern de phishing détecté', details: { domain, pattern: pattern.source } };
    }
  }
  
  // 5. Vérifier domaines suspects ( caractères aléatoires, typosquatting)
  if (domain.length > 50 || /^[a-z0-9]{20,}\./.test(domain)) {
    return { classification: 'SUSPICIOUS', reason: 'Domaine suspect (longueur/caractères)', details: { domain } };
  }
  
  // 6. Domaine inconnu
  return { classification: 'UNKNOWN', reason: 'Domaine non reconnu', details: { domain } };
}

/**
 * Vérifier tous les liens d'un message
 * @param {string} text - Texte du message
 * @param {string} groupJid - JID du groupe (pour logging)
 * @returns {{ overallClassification: string, links: Array, shouldDelete: boolean, shouldWarn: boolean }}
 */
function verifyMessageLinks(text, groupJid) {
  const urls = extractUrls(text);
  if (urls.length === 0) {
    return { overallClassification: 'SAFE', links: [], shouldDelete: false, shouldWarn: false };
  }
  
  const results = urls.map(url => ({
    url,
    ...checkLink(url),
  }));
  
  // Déterminer la classification globale (pire cas)
  const classifications = results.map(r => r.classification);
  let overallClassification = 'SAFE';
  let shouldDelete = false;
  let shouldWarn = false;
  
  if (classifications.includes('MALICIOUS')) {
    overallClassification = 'MALICIOUS';
    shouldDelete = true;
    shouldWarn = true;
  } else if (classifications.includes('SUSPICIOUS')) {
    overallClassification = 'SUSPICIOUS';
    shouldDelete = false;
    shouldWarn = true;
  } else if (classifications.includes('UNKNOWN')) {
    overallClassification = 'UNKNOWN';
    shouldWarn = false; // Ne pas avertir pour les domaines inconnus
  }
  
  return {
    overallClassification,
    links: results,
    shouldDelete,
    shouldWarn,
    groupJid,
    timestamp: Date.now(),
  };
}

/**
 * Vérification Google Safe Browsing (si clé API disponible)
 */
async function checkGoogleSafeBrowsing(url) {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return null;
  
  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'djousse-tech', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    
    const data = await response.json();
    const isDangerous = Array.isArray(data.matches) && data.matches.length > 0;
    
    return {
      url,
      dangerous: isDangerous,
      threatTypes: isDangerous ? data.matches.map(m => m.threatType) : [],
      source: 'Google Safe Browsing',
    };
  } catch (error) {
    console.error('[LinkChecker] Google Safe Browsing error:', error.message);
    return null;
  }
}

/**
 * Vérification complète d'un lien (patterns + Google Safe Browsing)
 */
async function fullCheck(url, groupJid) {
  const patternResult = checkLink(url);
  
  // Si déjà identifié comme dangereux par les patterns, pas besoin de Google
  if (patternResult.classification === 'MALICIOUS') {
    return { ...patternResult, googleCheck: null };
  }
  
  // Vérifier avec Google Safe Browsing
  const googleCheck = await checkGoogleSafeBrowsing(url);
  if (googleCheck?.dangerous) {
    return {
      classification: 'MALICIOUS',
      reason: `Menace détectée: ${googleCheck.threatTypes.join(', ')}`,
      details: { domain: extractDomain(url), source: 'Google Safe Browsing' },
      googleCheck,
    };
  }
  
  return { ...patternResult, googleCheck };
}

module.exports = {
  extractUrls,
  extractDomain,
  checkLink,
  verifyMessageLinks,
  checkGoogleSafeBrowsing,
  fullCheck,
  LINK_CONFIG,
};
