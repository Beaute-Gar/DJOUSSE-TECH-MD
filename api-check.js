#!/usr/bin/env node
'use strict';
/**
 * scripts/api-check.js — vérifie que les services externes utilisés par le bot
 * répondent VRAIMENT (à lancer sur ta machine / ton serveur, avec internet).
 *
 *   node scripts/api-check.js                 → tout tester
 *   node scripts/api-check.js --type=api      → api | image | site | cle | perso
 *   node scripts/api-check.js --only=weather,github
 *   node scripts/api-check.js --timeout=20000
 *
 * Lit les clés dans .env (GEMINI_API_KEY, OMDB_API_KEY…) et dans le code
 * (clés écrites en dur dans weather.js / virus.js). Aucune clé n'est affichée.
 *
 * Statuts :
 *   OK        le service répond et le format est celui attendu par le bot
 *   CHANGE    répond, mais le format n'est plus celui attendu → la commande casse
 *   BLOQUE    protégé (Cloudflare / 403 / 429) : le bot, depuis ton serveur, sera
 *             probablement refusé aussi (fréquent pour les sites « downloader »)
 *   CLE       clé absente de .env (non testé) ou clé refusée (401/403)
 *   MORT      DNS introuvable, connexion refusée, 404, 5xx, certificat invalide
 *   LENT      répond mais > 8 s (les commandes du bot risquent d'expirer)
 *
 * IMPORTANT — « site » : pour les sites de téléchargement (snapsave, fdown,
 * ssstik, igram…), le bot lit le HTML de la page : un site qui répond ne prouve
 * pas que son extraction fonctionne encore. Teste aussi la commande à la main.
 */
const fs = require('fs');
const path = require('path');

const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const TIMEOUT = Number(ARGS.timeout) || 15000;
const RACINE = process.cwd();
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

/* ── .env ── */
const ENV = { ...process.env };
try {
  for (const l of fs.readFileSync(path.join(RACINE, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in ENV && ENV[m[1]])) ENV[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* pas de .env */ }
const cle = (...noms) => { for (const n of noms) if (ENV[n]) return ENV[n]; return null; };

/* clés écrites en dur dans le code (on les teste, on ne les affiche pas) */
function cleDansCode(regex) {
  const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.js')) out.push(p); } return out; };
  try { for (const f of walk(path.join(RACINE, 'src'))) { const m = fs.readFileSync(f, 'utf8').match(regex); if (m) return m[1]; } } catch { /* ignore */ }
  return null;
}
const OWM = cleDansCode(/OWM_KEY\s*=\s*['"]([A-Za-z0-9]{16,})['"]/) || cleDansCode(/appid=([a-f0-9]{20,})/);
const VT = cleDansCode(/(?:VT_KEY|VT_API_KEY|VIRUSTOTAL\w*)\s*=\s*['"]([A-Za-z0-9]{32,})['"]/);

/* ── sondes ──
 * t: api | image | site | cle | perso     v: validation du JSON (facultatif)
 * k: clé requise (null = pas de clé) ; u peut être une fonction (clé → URL) */
const J = (f) => f; // lisibilité
const S = [
  /* — API JSON publiques — */
  { n: 'adviceslip', c: 'advice', t: 'api', u: 'https://api.adviceslip.com/advice', v: J((j) => j.slip) },
  { n: 'animechan', c: 'animequote', t: 'api', u: 'https://animechan.io/api/v1/quotes/random', v: J((j) => j.data || j.quote) },
  { n: 'coingecko', c: 'crypto', t: 'api', u: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', v: J((j) => j.bitcoin) },
  { n: 'datamuse', c: 'rhyme, synonym', t: 'api', u: 'https://api.datamuse.com/words?rel_rhy=love', v: J((j) => Array.isArray(j)) },
  { n: 'dictionaryapi.dev', c: 'define, dict', t: 'api', u: 'https://api.dictionaryapi.dev/api/v2/entries/en/hello', v: J((j) => Array.isArray(j)) },
  { n: 'duckduckgo (instant)', c: 'agent (recherche)', t: 'api', u: 'https://api.duckduckgo.com/?q=cameroon&format=json', v: J((j) => typeof j === 'object') },
  { n: 'frankfurter', c: 'currency', t: 'api', u: 'https://api.frankfurter.app/latest', v: J((j) => j.rates) },
  { n: 'open.er-api', c: 'convert', t: 'api', u: 'https://open.er-api.com/v6/latest/USD', v: J((j) => j.rates) },
  { n: 'fxtwitter', c: 'twitter', t: 'api', u: 'https://api.fxtwitter.com/twitter/status/20', v: J((j) => j.tweet || j.code) },
  { n: 'vxtwitter', c: 'twitter', t: 'api', u: 'https://api.vxtwitter.com/twitter/status/20', v: J((j) => j.text !== undefined || j.tweetID) },
  { n: 'api.github.com', c: 'github, githubstalk', t: 'api', u: 'https://api.github.com/repos/octocat/Hello-World', v: J((j) => j.full_name) },
  { n: 'imgflip', c: 'meme', t: 'api', u: 'https://api.imgflip.com/get_memes', v: J((j) => j.success) },
  { n: 'instagram oembed', c: 'instagram', t: 'api', u: 'https://api.instagram.com/oembed/?url=https://www.instagram.com/p/CUbHfhpswxt/', v: J((j) => j.html || j.title) },
  { n: 'jikan (MyAnimeList)', c: 'anime, topanime', t: 'api', u: 'https://api.jikan.moe/v4/anime/1', v: J((j) => j.data) },
  { n: 'mail.gw', c: 'tempmail', t: 'api', u: 'https://api.mail.gw/domains', v: J((j) => j['hydra:member'] || Array.isArray(j)) },
  { n: 'otakugifs', c: 'réactions anime', t: 'api', u: 'https://api.otakugifs.xyz/gif?reaction=hug', v: J((j) => j.url) },
  { n: 'popcat', c: 'chatbot', t: 'api', u: 'https://api.popcat.xyz/chatbot?msg=hi', v: J((j) => j.response) },
  { n: 'quotable', c: 'quote', t: 'api', u: 'https://api.quotable.io/random', v: J((j) => j.content) },
  { n: 'rss2json', c: 'news', t: 'api', u: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fsport%2Frss.xml', v: J((j) => j.items) },
  { n: 'sampleapis proverbs', c: 'proverb', t: 'api', u: 'https://api.sampleapis.com/proverbs/proverbs', v: J((j) => Array.isArray(j)) },
  { n: 'urbandictionary', c: 'urban', t: 'api', u: 'https://api.urbandictionary.com/v0/define?term=test', v: J((j) => j.list) },
  { n: 'waifu.pics', c: 'waifu, hug, kiss…', t: 'api', u: 'https://api.waifu.pics/sfw/waifu', v: J((j) => j.url) },
  { n: 'waifu.im', c: 'waifu', t: 'api', u: 'https://api.waifu.im/search', v: J((j) => j.images) },
  { n: 'worldbank', c: 'country', t: 'api', u: 'https://api.worldbank.org/v2/country/cm?format=json', v: J((j) => Array.isArray(j)) },
  { n: 'bible-api', c: 'bible', t: 'api', u: 'https://bible-api.com/john+3:16', v: J((j) => j.text) },
  { n: 'countriesnow', c: 'country', t: 'api', u: 'https://countriesnow.space/api/v0.1/countries/info?returns=currency&country=Cameroon', v: J((j) => j.data) },
  { n: 'dns.google', c: 'dns, extras', t: 'api', u: 'https://dns.google/resolve?name=example.com', v: J((j) => j.Answer || j.Status === 0) },
  { n: 'horoscope-app-api', c: 'horoscope', t: 'api', u: 'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=Aries&day=TODAY', v: J((j) => j.data) },
  { n: 'ip-api', c: 'ip, iplookup', t: 'api', u: 'http://ip-api.com/json/8.8.8.8', v: J((j) => j.status === 'success') },
  { n: 'ipapi.co', c: 'agent (ip)', t: 'api', u: 'https://ipapi.co/8.8.8.8/json/', v: J((j) => j.ip) },
  { n: 'is.gd', c: 'shorten', t: 'api', u: 'https://is.gd/create.php?format=simple&url=https://example.com', texte: /^https?:\/\//i },
  { n: 'v.gd', c: 'shorten', t: 'api', u: 'https://v.gd/create.php?format=simple&url=https://example.com', texte: /^https?:\/\//i },
  { n: 'tinyurl', c: 'tinyurl, shorten', t: 'api', u: 'https://tinyurl.com/api-create.php?url=https://example.com', texte: /^https?:\/\//i },
  { n: 'jokeapi', c: 'joke', t: 'api', u: 'https://v2.jokeapi.dev/joke/Any?safe-mode', v: J((j) => j.joke || j.setup) },
  { n: 'official-joke-api', c: 'joke, agent', t: 'api', u: 'https://official-joke-api.appspot.com/random_joke', v: J((j) => j.setup) },
  { n: 'lrclib', c: 'lyrics', t: 'api', u: 'https://lrclib.net/api/search?q=imagine', v: J((j) => Array.isArray(j)) },
  { n: 'rdap', c: 'whois', t: 'api', u: 'https://rdap.org/domain/example.com', v: J((j) => j.ldhName || j.handle) },
  { n: 'npm registry', c: 'npm (search3)', t: 'api', u: 'https://registry.npmjs.org/-/v1/search?text=express&size=1', v: J((j) => j.objects) },
  { n: 'saurav.tech news', c: 'news, sports', t: 'api', u: 'https://saurav.tech/NewsAPI/top-headlines/category/general/us.json', v: J((j) => j.articles) },
  { n: 'ESPN', c: 'sports, livescore', t: 'api', u: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', v: J((j) => j.events || j.leagues) },
  { n: 'thecolorapi', c: 'color', t: 'api', u: 'https://www.thecolorapi.com/id?hex=ff0000', v: J((j) => j.name) },
  { n: 'uselessfacts', c: 'fact', t: 'api', u: 'https://uselessfacts.jsph.pl/api/v2/facts/random', v: J((j) => j.text) },
  { n: 'wttr.in', c: 'weather (secours)', t: 'api', u: 'https://wttr.in/Douala?format=j1', v: J((j) => j.current_condition) },
  { n: 'yahoo finance', c: 'stock', t: 'api', u: 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d', v: J((j) => j.chart) },
  { n: 'zenquotes', c: 'advice, quote', t: 'api', u: 'https://zenquotes.io/api/random', v: J((j) => Array.isArray(j)) },
  { n: 'wikipedia EN', c: 'wiki, country', t: 'api', u: 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=cameroon', v: J((j) => j.query) },
  { n: 'wikipedia FR', c: 'wiki', t: 'api', u: 'https://fr.wikipedia.org/api/rest_v1/page/summary/Cameroun', v: J((j) => j.extract) },
  { n: 'text.pollinations (IA texte)', c: 'ai2, agent', t: 'api', u: 'https://text.pollinations.ai/hello', texte: /.+/ },
  { n: 'ch.at (IA texte)', c: 'ai2, agent', t: 'api', u: 'https://ch.at/', texte: /.+/ },
  { n: 'some-random-api lyrics', c: 'lyrics', t: 'api', u: 'https://some-random-api.com/lyrics?title=imagine', v: J((j) => j.lyrics || j.title) },
  { n: 'tikwm (TikTok)', c: 'tiktok, tiktokstalk', t: 'api', u: 'https://tikwm.com/api/?url=https://www.tiktok.com/@tiktok/video/7106594312292453675', v: J((j) => j.data || j.code !== undefined) },
  { n: 'tiklydown (TikTok)', c: 'tiktok', t: 'api', u: 'https://api.tiklydown.eu.org/api/download?url=https://www.tiktok.com/@tiktok/video/7106594312292453675', v: J((j) => typeof j === 'object') },
  { n: 'cobalt', c: 'facebook, instagram', t: 'api', u: 'https://api.cobalt.tools/', v: J((j) => typeof j === 'object') },
  { n: 'api.telegra.ph', c: 'hacktools', t: 'api', u: 'https://api.telegra.ph/createAccount?short_name=test&author_name=test', v: J((j) => j.ok) },
  { n: 'fabdl (SoundCloud)', c: 'soundcloud', t: 'api', u: 'https://api.fabdl.com/soundcloud/get?url=https://soundcloud.com/a/b', v: J((j) => typeof j === 'object') },
  { n: 'emoji-mix (otakikode)', c: 'emojimix', t: 'api', u: 'https://api.otakikode.com/emoji-mix?emoji1=%F0%9F%98%80&emoji2=%F0%9F%94%A5', v: J((j) => typeof j === 'object') },
  /* — API tierces « hobby » (souvent mortes) — */
  { n: 'davidcyriltech', c: 'music, converter3, hacktools', t: 'api', u: 'https://apis.davidcyriltech.my.id', texte: /.*/ },
  { n: 'api-rin-tohsaka', c: 'hacktools (ytmp4)', t: 'api', u: 'https://api-rin-tohsaka.vercel.app/', texte: /.*/ },
  { n: 'fantox001-scrappy-api', c: 'hacktools (technews)', t: 'api', u: 'https://fantox001-scrappy-api.vercel.app/technews/random', v: J((j) => typeof j === 'object') },
  { n: 'levanter (emix)', c: 'hacktools', t: 'api', u: 'https://levanter.onrender.com/', texte: /.*/ },
  { n: 'lance-frank-asta (GPT)', c: 'ai', t: 'api', u: 'https://lance-frank-asta.onrender.com/api/gpt?q=hello', texte: /.+/ },
  { n: 'vapis.my.id (openai)', c: 'ai', t: 'api', u: 'https://vapis.my.id/api/openai?q=hello', texte: /.+/ },
  { n: 'quotly', c: 'quotly', t: 'api', u: 'https://quotly.ryzl.xyz/', texte: /.*/ },
  /* — images — */
  { n: 'qrserver', c: 'qr', t: 'image', u: 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=test' },
  { n: 'pollinations (image IA)', c: 'imagine, captionimage', t: 'image', u: 'https://image.pollinations.ai/prompt/cat?width=256&height=256&nologo=true' },
  { n: 'thum.io (capture écran)', c: 'screenshot, carbon', t: 'image', u: 'https://image.thum.io/get/https://example.com' },
  { n: 'ui-avatars', c: 'quotly', t: 'image', u: 'https://ui-avatars.com/api/?name=AB&size=128' },
  { n: 'singlecolorimage', c: 'color', t: 'image', u: 'https://singlecolorimage.com/get/ff0000/200x200' },
  { n: 'picsum', c: 'menu (fond)', t: 'image', u: 'https://picsum.photos/200' },
  { n: 'catbox (images du menu)', c: 'menu, getpp', t: 'image', u: 'https://files.catbox.moe/h6zdty.png' },
  { n: 'img.youtube', c: 'music', t: 'image', u: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
  { n: 'cloudflare speed', c: 'speedtest', t: 'image', u: 'https://speed.cloudflare.com/__down?bytes=100000', ct: null },
  /* — à clé — (non testés si la clé manque dans .env) */
  { n: 'Gemini (IA)', c: 'ai, agent', t: 'cle', k: 'GEMINI_API_KEY|GEMINI_KEY|GOOGLE_AI_KEY', u: (k) => `https://generativelanguage.googleapis.com/v1beta/models?key=${k}`, v: J((j) => j.models) },
  { n: 'OpenRouter (IA)', c: 'ai', t: 'cle', k: 'OPENROUTER_API_KEY', u: 'https://openrouter.ai/api/v1/auth/key', h: (k) => ({ Authorization: `Bearer ${k}` }), v: J((j) => j.data) },
  { n: 'Groq (IA)', c: 'ai', t: 'cle', k: 'GROQ_API_KEY', u: 'https://api.groq.com/openai/v1/models', h: (k) => ({ Authorization: `Bearer ${k}` }), v: J((j) => j.data) },
  { n: 'Serper (recherche Google)', c: 'google, search3', t: 'cle', k: 'SERPER_API_KEY', post: { q: 'cameroun' }, u: 'https://google.serper.dev/search', h: (k) => ({ 'X-API-KEY': k, 'Content-Type': 'application/json' }), v: J((j) => j.organic || j.searchParameters) },
  { n: 'GNews', c: 'news', t: 'cle', k: 'GNEWS_API_KEY', u: (k) => `https://gnews.io/api/v4/top-headlines?category=general&lang=en&max=1&apikey=${k}`, v: J((j) => j.articles) },
  { n: 'ElevenLabs (TTS)', c: 'speak', t: 'cle', k: 'ELEVENLABS_API_KEY', u: 'https://api.elevenlabs.io/v1/voices', h: (k) => ({ 'xi-api-key': k }), v: J((j) => j.voices) },
  { n: 'OMDb (films)', c: 'movie (hacktools)', t: 'cle', k: 'OMDB_API_KEY', u: (k) => `https://www.omdbapi.com/?apikey=${k}&t=matrix`, v: J((j) => j.Response === 'True') },
  { n: 'football-data.org', c: 'foot, ported-foot', t: 'cle', k: 'FOOTBALL_API_KEY', u: 'https://api.football-data.org/v4/competitions', h: (k) => ({ 'X-Auth-Token': k }), v: J((j) => j.competitions) },
  { n: 'Tenor (GIF/stickers)', c: 'stickersearch', t: 'cle', k: 'TENOR_API_KEY', u: (k) => `https://tenor.googleapis.com/v2/search?q=cat&key=${k}&limit=1`, v: J((j) => j.results) },
  { n: 'remove.bg', c: 'removebg', t: 'cle', k: 'REMOVEBG_API_KEY', u: 'https://api.remove.bg/v1.0/account', h: (k) => ({ 'X-Api-Key': k }), v: J((j) => j.data) },
  { n: 'GitHub (token)', c: 'uploader (github cdn)', t: 'cle', k: 'GITHUB_TOKEN', u: 'https://api.github.com/user', h: (k) => ({ Authorization: `Bearer ${k}` }), v: J((j) => j.login) },
  { n: 'imgbb', c: 'imgbb', t: 'cle', k: 'IMGBB_KEY', u: 'https://api.imgbb.com/', texte: /.*/ },
  { n: 'audd (Shazam)', c: 'shazam', t: 'cle', k: 'AUDD_API_KEY', u: (k) => `https://api.audd.io/getApiToken/?api_token=${k}`, v: J((j) => typeof j === 'object') },
  { n: 'OpenWeatherMap (clé du code)', c: 'weather', t: 'cle', fk: () => OWM, u: (k) => `https://api.openweathermap.org/data/2.5/weather?q=Douala&units=metric&appid=${k}`, v: J((j) => j.main) },
  { n: 'VirusTotal (clé du code)', c: 'virus', t: 'cle', fk: () => VT, u: 'https://www.virustotal.com/api/v3/users/current', h: (k) => ({ 'x-apikey': k }), v: J((j) => j.data) },
  /* — ton site (à confirmer : djousse-tech-md-web.vercel.app) — */
  { n: 'djousse-tech-md-web.vercel.app', c: 'agent, config', t: 'perso', u: 'https://djousse-tech-md-web.vercel.app', texte: /.*/ },
  /* — sites scrapés (HTML) : joignabilité seulement — */
  ...[['snapsave.app', 'facebook, instagram'], ['fdown.net', 'facebook'], ['fdownloader.net', 'facebook'], ['getvideourl.com', 'facebook'],
    ['silvatech.co.ke', 'menu (lien affiché) — site d\'un TIERS, pas le tien'], ['igram.world', 'instagram'], ['fastdl.app', 'instagram'], ['instadownload.net', 'instagram'], ['v3.saveinsta.app', 'threads'], ['savethreads.io', 'threads'],
    ['www.snapinsta.app', 'threads'], ['ssstik.io', 'tiktok, capcut'], ['capcutdownloader.io', 'capcut'], ['twitsave.com', 'twitter'],
    ['twittervideodownloader.com', 'twitter'], ['pinterestdownloader.com', 'pinterest'], ['pinterestvideodownloader.com', 'pinterest'],
    ['www.klickaud.co', 'soundcloud'], ['soundcloudmp3.io', 'soundcloud'], ['www.mediafire.com', 'mediafire'], ['textpro.me', 'logos (ported-logo)'],
    ['en.ephoto360.com', 'logos (ported-logo)'], ['www.flashscore.com', 'sports'], ['www.forebet.com', 'sports'], ['www.sofascore.com', 'sports'],
    ['www.goal.com', 'sports'], ['www.livescore.com', 'sports'], ['www.espn.com', 'sports'], ['www.whoscored.com', 'sports'],
    ['www.soccervista.com', 'sports'], ['www.betensured.com', 'sports'], ['genius.com', 'lyrics'], ['www.azlyrics.com', 'lyrics'],
    ['www.musixmatch.com', 'lyrics'], ['www.wattpad.com', 'search3'], ['wallhaven.cc', 'search3'], ['unsplash.com', 'search3'],
    ['www.pexels.com', 'search3'], ['www.apkmirror.com', 'search3 (apk)'], ['www.happymod.com', 'search3 (apk)'], ['www.reddit.com', 'meme, reddit'],
    ['www.threads.net', 'threads'], ['www.instagram.com', 'igstalk, instagram'], ['www.tiktok.com', 'tiktokstalk'],
    ['catbox.moe', 'catbox (upload)'], ['paste.rs', 'pastebin'], ['dpaste.org', 'pastebin'], ['cleanuri.com', 'shorten'],
    ['api.ocr.space', 'ocr'], ['ws75.aptoide.com', 'apk'], ['api.remini.ai', 'remini (tools3)'], ['api.api-ninjas.com', 'dns (tools3)'],
    ['api.truecaller.com', 'vcf-generator'], ['api.pixhost.to', 'uploader2'], ['carbon.now.sh', 'carbon'], ['duckduckgo.com', 'search3'],
    ['www.google.com', 'search3'], ['open.spotify.com', 'search3'], ['www.youtube.com', 'yt, search3']]
    .map(([h, c]) => ({ n: h, c, t: 'site', u: `https://${h}/`, texte: /.*/ })),
];

/* ── exécution ── */
async function sonde(s) {
  let url = s.u; let headers = { 'User-Agent': UA, Accept: '*/*' };
  let k = null;
  if (s.t === 'cle') {
    k = s.fk ? s.fk() : cle(...String(s.k).split('|'));
    if (!k) return { statut: 'CLE', note: s.fk ? 'clé introuvable dans le code' : `clé absente de .env (${String(s.k).split('|')[0]})` };
    if (typeof url === 'function') url = url(k);
    if (s.h) headers = { ...headers, ...s.h(k) };
  }
  const t0 = Date.now();
  try {
    const rep = await fetch(url, { method: s.post ? 'POST' : 'GET', headers, body: s.post ? JSON.stringify(s.post) : undefined, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT) });
    const ms = Date.now() - t0;
    const ct = (rep.headers.get('content-type') || '').toLowerCase();
    const serveur = (rep.headers.get('server') || '').toLowerCase();
    if (s.t === 'image') {
      const buf = Buffer.from(await rep.arrayBuffer());
      if (!rep.ok) return { statut: [401, 403, 429].includes(rep.status) ? 'BLOQUE' : 'MORT', http: rep.status, ms, note: `HTTP ${rep.status}` };
      if (s.ct !== null && !/^image\//.test(ct)) return { statut: 'CHANGE', http: rep.status, ms, note: `type reçu : ${ct || '?'} (image attendue)` };
      if (buf.length < 100) return { statut: 'CHANGE', http: rep.status, ms, note: `réponse vide (${buf.length} octets)` };
      return { statut: ms > 8000 ? 'LENT' : 'OK', http: rep.status, ms, note: `${buf.length} octets` };
    }
    const corps = await rep.text();
    if (!rep.ok) {
      const cf = /cloudflare/.test(serveur) || /just a moment|cf-chl|attention required/i.test(corps.slice(0, 2000));
      if (s.t === 'cle' && [401, 403].includes(rep.status)) return { statut: 'CLE', http: rep.status, ms, note: 'clé refusée / expirée / quota' };
      if (cf || [403, 429, 503].includes(rep.status)) return { statut: 'BLOQUE', http: rep.status, ms, note: cf ? 'protection Cloudflare / anti-bot' : `HTTP ${rep.status}` };
      return { statut: 'MORT', http: rep.status, ms, note: `HTTP ${rep.status}` };
    }
    let ok = true; let note = `HTTP ${rep.status}`;
    if (s.v) {
      let j; try { j = JSON.parse(corps); } catch { return { statut: 'CHANGE', http: rep.status, ms, note: 'réponse non JSON (format changé ?)' }; }
      try { ok = !!s.v(j); } catch { ok = false; }
      if (!ok) { note = 'JSON reçu mais champ attendu absent (format changé)'; }
    } else if (s.texte) {
      ok = s.texte.test(corps.trim());
      if (!ok) note = 'contenu inattendu';
    }
    if (!ok) return { statut: 'CHANGE', http: rep.status, ms, note };
    return { statut: ms > 8000 ? 'LENT' : 'OK', http: rep.status, ms, note };
  } catch (e) {
    const m = String((e.cause && (e.cause.code || e.cause.message)) || e.message || e);
    if (/abort|timeout/i.test(e.name + m)) return { statut: 'MORT', ms: Date.now() - t0, note: `pas de réponse en ${TIMEOUT / 1000}s` };
    if (/ENOTFOUND|EAI_AGAIN/.test(m)) return { statut: 'MORT', ms: Date.now() - t0, note: 'domaine introuvable (DNS) — service supprimé ?' };
    if (/CERT|SSL|TLS/i.test(m)) return { statut: 'MORT', ms: Date.now() - t0, note: `certificat invalide (${m})` };
    return { statut: 'MORT', ms: Date.now() - t0, note: m.slice(0, 100) };
  }
}

(async () => {
  /* internet OK ? */
  const test = await sonde({ n: 'test', t: 'api', u: 'https://dns.google/resolve?name=example.com', v: (j) => j.Status === 0 });
  if (test.statut !== 'OK') {
    console.log(`❌ Pas de connexion internet exploitable (${test.note}). Connecte-toi puis relance : les résultats seraient faux.`);
    process.exit(1);
  }
  let liste = S;
  if (ARGS.type) liste = liste.filter((s) => s.t === ARGS.type);
  if (ARGS.only) { const o = String(ARGS.only).split(','); liste = liste.filter((s) => o.some((x) => (s.c + ' ' + s.n).toLowerCase().includes(x.toLowerCase()))); }
  console.log(`Test de ${liste.length} services (délai ${TIMEOUT / 1000}s)…\n`);
  const res = new Array(liste.length); let i = 0, fait = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < liste.length) {
      const idx = i++; const s = liste[idx];
      const r = await sonde(s);
      res[idx] = { service: s.n, type: s.t, commandes: s.c, ...r };
      fait += 1;
      console.log(`[${String(fait).padStart(3)}/${liste.length}] ${r.statut.padEnd(7)} ${s.n.padEnd(34)} ${r.note || ''}`);
    }
  }));
  const compte = {}; for (const r of res) compte[r.statut] = (compte[r.statut] || 0) + 1;
  const out = [`RAPPORT SERVICES EXTERNES — ${new Date().toISOString()}`, JSON.stringify(compte), ''];
  const ACTION = { MORT: 'Service mort : remplacer l’API ou retirer la commande', CHANGE: 'Format changé : corriger le code qui lit la réponse', BLOQUE: 'Anti-bot : fonctionnera mal depuis un serveur ; chercher une alternative', CLE: 'Ajouter / renouveler la clé dans .env', LENT: 'Augmenter le délai ou changer de service', OK: '' };
  for (const st of ['MORT', 'CHANGE', 'BLOQUE', 'CLE', 'LENT', 'OK']) {
    const l = res.filter((r) => r.statut === st); if (!l.length) continue;
    out.push(`=== ${st} (${l.length}) — ${ACTION[st]} ===`);
    for (const r of l) out.push(`  ${r.service}  [${r.commandes}]${r.note && st !== 'OK' ? ' — ' + r.note : ''}`);
    out.push('');
  }
  fs.writeFileSync(path.join(RACINE, 'api-report.txt'), out.join('\n'));
  fs.writeFileSync(path.join(RACINE, 'api-report.json'), JSON.stringify(res, null, 2));
  console.log('\n' + out.slice(0, 2).join('\n') + '\n→ détails : api-report.txt / api-report.json');
})();
