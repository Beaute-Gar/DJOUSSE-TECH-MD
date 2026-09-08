import { rawGet, rawRun } from '../../infrastructure/database/database.js';

const cache = new Map();
const CACHE_MAX = 5000;

export async function traduireMessage(texte, userId) {
  const langueCible = await getLanguePreferee(userId);
  const cleCache = `${texte}|${langueCible}`;

  if (cache.has(cleCache)) return cache.get(cleCache);

  const prompt = `Tu es un moteur de traduction. Analyse ce texte :
"${texte}"

Réponds UNIQUEMENT avec un JSON, sans texte autour :
{
  "langue_source": "code ISO 639-1 détecté (ex: fr, en, es, pt...)",
  "traduction_necessaire": true ou false (false si le texte est déjà dans la langue cible "${langueCible}"),
  "texte_traduit": "le texte traduit en ${langueCible}, ou le texte original si traduction_necessaire est false"
}`;

  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        max_tokens: 400,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'translation_result',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                langue_source: { type: 'string' },
                traduction_necessaire: { type: 'boolean' },
                texte_traduit: { type: 'string' },
              },
              required: ['langue_source', 'traduction_necessaire', 'texte_traduit'],
            },
          },
        },
      }),
    });

    const data = await reponse.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());

    const resultat = {
      texteTraduit: parsed.traduction_necessaire ? parsed.texte_traduit : texte,
      langueSource: parsed.langue_source || 'inconnue',
      langueCible,
      traduit: !!parsed.traduction_necessaire,
    };

    ajouterAuCache(cleCache, resultat);
    return resultat;
  } catch (error) {
    console.error('[Traducteur] Erreur:', error.message);
    return { texteTraduit: texte, langueSource: 'inconnue', langueCible, traduit: false, erreur: true };
  }
}

export async function traduirePourGroupe(texte, membresUserIds, expediteurUserId) {
  const resultats = new Map();
  await Promise.all(membresUserIds.map(async (userId) => {
    if (userId === expediteurUserId) {
      resultats.set(userId, { texteTraduit: texte, traduit: false });
      return;
    }
    const resultat = await traduireMessage(texte, userId);
    resultats.set(userId, resultat);
  }));
  return resultats;
}

export async function definirLanguePreferee(userId, langue) {
  const maintenant = Date.now();
  const existant = await rawGet('SELECT user_id FROM preferences_langue WHERE user_id = ?', [userId]);
  if (existant) {
    await rawRun('UPDATE preferences_langue SET langue = ?, maj_le = ? WHERE user_id = ?', [langue, maintenant, userId]);
  } else {
    await rawRun('INSERT INTO preferences_langue (user_id, langue, maj_le) VALUES (?, ?, ?)', [userId, langue, maintenant]);
  }
}

export async function getLanguePreferee(userId) {
  const ligne = await rawGet('SELECT langue FROM preferences_langue WHERE user_id = ?', [userId]);
  return ligne?.langue || 'fr';
}

function ajouterAuCache(cle, valeur) {
  if (cache.size >= CACHE_MAX) {
    const premiereCle = cache.keys().next().value;
    cache.delete(premiereCle);
  }
  cache.set(cle, valeur);
}

export function viderCache() {
  cache.clear();
}
