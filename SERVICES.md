# Services externes utilisés par le bot (analyse du code — non testés en ligne)

172 domaines distincts appelés dans `src/` et `index.js`. Ce document est une analyse du code, pas un résultat de test :
lance `node scripts/api-check.js` sur ta machine pour savoir lesquels répondent vraiment.

## Répartition
| Type | Nombre | Risque |
|---|---|---|
| API JSON publiques (météo, wiki, blagues, crypto, anime…) | ~55 | moyen : gratuites, peuvent changer ou limiter |
| API tierces « hobby » (davidcyriltech, levanter/onrender, vapis.my.id, lance-frank-asta, quotly.ryzl…) | ~9 | **élevé** : hébergements gratuits, souvent supprimés |
| Services à clé (Gemini, OpenRouter, Groq, Serper, GNews, ElevenLabs, OMDb, football-data, Tenor, remove.bg, GitHub, imgbb, audd) | 13 | clé requise dans `.env` |
| Sites de téléchargement scrapés (snapsave, fdown, ssstik, igram, fastdl, savethreads, twitsave…) | ~20 | **très élevé** : le bot lit leur HTML, cassent à chaque refonte, souvent anti-bot |
| Sites sportifs scrapés (flashscore, forebet, sofascore, goal, livescore, whoscored…) | ~9 | **très élevé** (anti-bot, HTML qui change) |
| Moteurs de logos (textpro.me, ephoto360) | 2 | élevé (scraping de formulaires) |
| Hébergeurs de fichiers (catbox, pixhost, imgbb, paste.rs, dpaste) | 5 | moyen |
| Ton site (djousse-tech-md-web.vercel.app — à confirmer que c'est bien le tien) | 1 | à vérifier |
| Site d'un tiers (silvatech.co.ke, l'ancien auteur du bot) : seulement un lien affiché dans `menu.js` et un exemple dans `qrcode.js` | 1 | aucun appel d'API ; à remplacer par ton site |
| Liens WhatsApp / GitHub (chat.whatsapp.com, wa.me, github.com) | — | liens statiques, pas d'API |

## À corriger en priorité (constaté dans le code, sans test réseau)
1. **Clés en dur** : une clé OpenWeatherMap dans `weather.js` et une clé VirusTotal dans `virus.js`. Clés partagées/publiques : quota souvent épuisé ou révoquées, et visibles par quiconque lit le code. Mets les tiennes dans `.env`.
2. **Truecaller** (`vcf-generator.js`) : appel à l'API non officielle, avec jeton. Contraire aux conditions d'utilisation et peut exposer des données de tiers : à retirer ou à remplacer.
3. **Instagram / Threads** (`i.instagram.com`, `www.threads.net/api/graphql`, oembed) : exigent maintenant une session/jeton ; les appels anonymes échouent le plus souvent.
4. **API hobby** : si leur hébergeur gratuit a supprimé le service, les commandes concernées (ai, music, hacktools, quotly) tombent. Prévois une alternative ou un message clair.
5. **Sites scrapés** : une page qui répond (HTTP 200) ne prouve PAS que l'extraction marche encore. Teste la commande réelle (`.fb <lien>`, `.ig <lien>`, `.tiktok <lien>`).

## Variables `.env` utilisées pour des services externes
GEMINI_API_KEY (ou GEMINI_KEY / GOOGLE_AI_KEY), OPENROUTER_API_KEY, GROQ_API_KEY, SERPER_API_KEY, GNEWS_API_KEY,
ELEVENLABS_API_KEY, OMDB_API_KEY, FOOTBALL_API_KEY, TENOR_API_KEY, REMOVEBG_API_KEY, GITHUB_TOKEN (+ GITHUB_REPO),
IMGBB_KEY, AUDD_API_KEY, TECHNEWS_API, MONGO_URI (+ MONGO_DB), PAIRING_API_TOKEN.

## Comment tester
- `node scripts/api-check.js` → tout ; `--type=api|image|site|cle|perso` ; `--only=weather,github`.
- Résultat dans `api-report.txt` : MORT / CHANGE / BLOQUE / CLE / LENT / OK, avec l'action recommandée.
- Puis `node scripts/smoke-test.js` pour exécuter les commandes elles-mêmes.
