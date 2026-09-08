/* Auto-détection DJOUSSE-TECH : transforme un texte libre en commande jetable */

const LINK_RULES = [
  { re: /https?:\/\/(?:[a-z0-9-]+\.)*youtube\.com\/\S+|https?:\/\/youtu\.be\/\S+/i, cmd: 'ytdl' },
  { re: /https?:\/\/(?:www\.)?(?:vt|v|vm)\.tiktok\.com\/\S+|https?:\/\/(?:www\.)?tiktok\.com\/\S+/i, cmd: 'tt' },
  { re: /https?:\/\/(?:www\.)?(?:instagram\.com\/\S+|instagr\.am\/\S+)/i, cmd: 'ig' },
  { re: /https?:\/\/(?:www\.)?(?:facebook\.com\/\S+|fb\.watch\/\S+|fb\.com\/\S+|m\.facebook\.com\/\S+)/i, cmd: 'fb' },
  { re: /https?:\/\/(?:www\.)?(?:twitter\.com\/\S+|x\.com\/\S+|t\.co\/\S+)/i, cmd: 'twitter' },
  { re: /https?:\/\/(?:www\.)?soundcloud\.com\/\S+/i, cmd: 'soundcloud' },
  { re: /https?:\/\/(?:open\.|www\.)?spotify\.com\/\S+|https?:\/\/spotify\.link\/\S+/i, cmd: 'spotify' },
  { re: /https?:\/\/(?:[a-z-]+\.)?pinterest\.\w+\/\S+/i, cmd: 'pinterest' },
  { re: /https?:\/\/(?:www\.)?mediafire\.com\/\S+/i, cmd: 'mediafire' },
  { re: /https?:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=)\S+/i, cmd: 'gdrive' },
];

const STATS_WORDS = ['stats', 'statistics', 'users', 'groups', 'members', 'messages'];

function extractUrl(text) {
  /* URL avec schéma, ou domaine nu de type <sous-domaine>.<domaine>/<chemin> (tiktok.com/..., instagram.com/...) */
  const withScheme = text.match(/https?:\/\/[^\s]+/i);
  if (withScheme) return withScheme[0].replace(/[.,;:!?)\]"']$/g, '');
  const bare = text.match(/(?:^|\s)((?:[a-z0-9-]+\.){1,}[a-z]{2,}\/[^\s]+)/i);
  if (bare) return bare[1].trim().replace(/[.,;:!?)\]"']$/g, '');
  return null;
}

function detect(text) {
  const str = String(text || '').trim();
  if (!str) return null;

  /* 1. Lien de plateforme → téléchargement automatique */
  const url = (extractUrl(str) || '').trim();
  if (url) {
    const urlWithScheme = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    for (const rule of LINK_RULES) {
      if (rule.re.test(urlWithScheme)) {
        return { kind: 'link', cmd: rule.cmd, arg: urlWithScheme, source: rule.cmd };
      }
    }
  }

  /* 2. Préfixe « ! » : jeu / émotion / logo / stats / conversion rapide */
  if (str.startsWith('!')) {
    const parts = str.slice(1).trim().split(/\s+/);
    const name = (parts[0] || '').toLowerCase();
    const arg = parts.slice(1).join(' ').trim();
    if (!name) return null;
    if (STATS_WORDS.includes(name)) {
      return { kind: 'stats', cmd: name, arg };
    }
    return { kind: 'bang', cmd: name, arg };
  }

  return null;
}

module.exports = { detect, LINK_RULES, STATS_WORDS };