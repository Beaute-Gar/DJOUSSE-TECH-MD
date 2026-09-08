const cache = new Map();

export async function detectLang(text) {
  const patterns = {
    en: /\b(the|is|are|you|and|this|that|with|from|have)\b/i,
    es: /\b(el|la|los|es|son|usted|y|tener|este|con)\b/i,
    de: /\b(der|die|das|ist|sind|sie|und|haben|mit)\b/i,
    pt: /\b(o|a|os|é|são|você|e|ter|com)\b/i,
    ar: /[\u0600-\u06FF]/,
    zh: /[\u4E00-\u9FFF]/,
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,
    ru: /[\u0400-\u04FF]/,
    it: /\b(il|la|le|è|sono|tu|e|avere|questo|con)\b/i,
    nl: /\b(de|het|is|zijn|jij|en|hebben|dit|die|met)\b/i,
  };
  for (const [lang, rx] of Object.entries(patterns)) {
    if (rx.test(text)) return lang;
  }
  return 'fr';
}

export async function translateText(text, to = 'fr') {
  const key = `${to}_${text.slice(0, 100)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data?.[0]?.map?.(x => x[0]).join('') || text;
    cache.set(key, result);
    setTimeout(() => cache.delete(key), 3600000);
    return result;
  } catch { return null; }
}
