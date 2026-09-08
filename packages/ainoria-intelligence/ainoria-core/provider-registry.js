/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  provider-registry.js — Registre dynamique de fournisseurs ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import db from '../../infrastructure/database/database.js';

const FOURNISSEURS_PAR_DEFAUT = [
  {
    nom: 'openrouter',
    type: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    priorite: 1,
    modeles: {
      conversation: 'openai/gpt-4o-mini',
      raisonnement_complexe: 'deepseek/deepseek-r1',
      code: 'deepseek/deepseek-coder',
      vision: 'openai/gpt-4o',
      long_contexte: 'google/gemini-2.0-flash-exp',
      traduction: 'deepseek/deepseek-chat',
      resume: 'openai/gpt-4o-mini',
      classification: 'openai/gpt-4o-mini',
      extraction: 'deepseek/deepseek-chat',
      planification: 'deepseek/deepseek-r1',
      embeddings: null,
    },
  },
  {
    nom: 'puter',
    type: 'puter',
    endpoint: 'https://api.puter.com/drivers/call',
    apiKeyEnv: null,
    priorite: 2,
    modeles: {
      conversation: 'gpt-4o-mini',
      vision: 'gpt-4o',
      code: 'gpt-4o',
    },
  },
  {
    nom: 'groq_fallback',
    type: 'groq',
    endpoint: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    priorite: 3,
    modeles: {
      conversation: 'openai/gpt-oss-20b',
      raisonnement_complexe: 'openai/gpt-oss-120b',
      code: 'openai/gpt-oss-120b',
      traduction: 'openai/gpt-oss-20b',
      resume: 'openai/gpt-oss-20b',
      classification: 'openai/gpt-oss-20b',
      extraction: 'openai/gpt-oss-20b',
      planification: 'openai/gpt-oss-120b',
    },
  },
];

export async function initialiserRegistry() {
  for (const f of FOURNISSEURS_PAR_DEFAUT) {
    await db.run(
      `INSERT INTO ainoria_providers (nom, type, endpoint, api_key_env, actif, priorite, cree_le, maj_le)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(nom) DO UPDATE SET priorite = excluded.priorite, actif = excluded.actif, maj_le = excluded.maj_le`,
      [f.nom, f.type, f.endpoint, f.apiKeyEnv || null, f.priorite, Date.now(), Date.now()]
    );

    for (const [capacite, modele] of Object.entries(f.modeles)) {
      if (!modele) continue;
      const id = `${f.nom}/${modele}/${capacite}`;
      await db.run(
        `INSERT INTO ainoria_modeles (id, provider_nom, nom_modele, capacites, actif)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(id) DO NOTHING`,
        [id, f.nom, modele, JSON.stringify([capacite])]
      );
    }
  }
}

async function choisirFournisseur(capacite) {
  const fournisseursActifs = FOURNISSEURS_PAR_DEFAUT
    .filter(f => !f.apiKeyEnv || process.env[f.apiKeyEnv])
    .filter(f => f.modeles[capacite])
    .sort((a, b) => a.priorite - b.priorite);

  if (fournisseursActifs.length === 0) {
    throw new Error(`Aucun fournisseur disponible pour la capacité "${capacite}"`);
  }

  return fournisseursActifs;
}

async function appelerOpenRouter(fournisseur, capacite, messages, options) {
  const modele = fournisseur.modeles[capacite];
  const debut = Date.now();

  const reponse = await fetch(`${fournisseur.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env[fournisseur.apiKeyEnv]}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'https://djousse-tech.com',
      'X-Title': 'AINORIA',
    },
    body: JSON.stringify({
      model: modele,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 800,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

  if (!reponse.ok) {
    const erreur = await reponse.json().catch(() => ({}));
    throw new Error(`OpenRouter HTTP ${reponse.status}: ${erreur.error?.message || 'erreur inconnue'}`);
  }

  const data = await reponse.json();
  const latenceMs = Date.now() - debut;

  await enregistrerMetrique(`${fournisseur.nom}/${modele}/${capacite}`, latenceMs, data.usage, true);

  return data.choices[0].message.content.trim();
}

async function appelerPuter(fournisseur, capacite, messages, options) {
  const modele = fournisseur.modeles[capacite];
  const debut = Date.now();

  const reponse = await fetch('https://api.puter.com/drivers/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interface: 'puter-chat-completion',
      driver: 'openai-completion',
      test_mode: false,
      call: {
        method: 'complete',
        args: {
          messages,
          model: modele,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 800,
        },
      },
    }),
  });

  if (!reponse.ok) throw new Error(`Puter HTTP ${reponse.status}`);

  const data = await reponse.json();
  const latenceMs = Date.now() - debut;

  if (!data.success) throw new Error(`Puter erreur : ${data.error?.message || 'échec'}`);

  await enregistrerMetrique(`${fournisseur.nom}/${modele}/${capacite}`, latenceMs, null, true);

  return data.result?.message?.content?.trim() || data.result?.text?.trim();
}

async function appelerGroq(fournisseur, capacite, messages, options) {
  const modele = fournisseur.modeles[capacite];
  const debut = Date.now();

  const reponse = await fetch(`${fournisseur.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env[fournisseur.apiKeyEnv]}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modele,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 800,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

  if (!reponse.ok) throw new Error(`Groq HTTP ${reponse.status}`);

  const data = await reponse.json();
  const latenceMs = Date.now() - debut;

  await enregistrerMetrique(`${fournisseur.nom}/${modele}/${capacite}`, latenceMs, data.usage, true);

  return data.choices[0].message.content.trim();
}

export async function router(capacite, prompt, options = {}) {
  const fournisseurs = await choisirFournisseur(capacite);

  const messages = Array.isArray(prompt)
    ? prompt
    : options.messages || [{ role: 'user', content: prompt }];

  if (options.image && messages.length > 0) {
    const dernierMessage = messages[messages.length - 1];
    if (dernierMessage.role === 'user') {
      dernierMessage.content = [
        { type: 'text', text: typeof dernierMessage.content === 'string' ? dernierMessage.content : prompt },
        { type: 'image_url', image_url: { url: `data:${options.image.mimeType};base64,${options.image.base64}` } },
      ];
    }
  }

  let derniereErreur;

  for (const fournisseur of fournisseurs) {
    try {
      let resultat;

      switch (fournisseur.type) {
        case 'openrouter':
          resultat = await appelerOpenRouter(fournisseur, capacite, messages, options);
          break;
        case 'puter':
          resultat = await appelerPuter(fournisseur, capacite, messages, options);
          break;
        case 'groq':
          resultat = await appelerGroq(fournisseur, capacite, messages, options);
          break;
        default:
          throw new Error(`Type de fournisseur inconnu : ${fournisseur.type}`);
      }

      return { resultat, fournisseurUtilise: fournisseur.nom, modele: fournisseur.modeles[capacite] };

    } catch (erreur) {
      console.warn(`⚠️ [Provider Registry] ${fournisseur.nom} échoué pour "${capacite}": ${erreur.message}`);
      await enregistrerMetrique(`${fournisseur.nom}/${fournisseur.modeles[capacite]}/${capacite}`, 0, null, false, erreur.message);
      derniereErreur = erreur;
    }
  }

  throw new Error(`Tous les fournisseurs ont échoué pour "${capacite}": ${derniereErreur?.message}`);
}

async function enregistrerMetrique(modeleId, latenceMs, usage, succes, erreur = null) {
  await db.run(
    `INSERT INTO ainoria_metriques_modeles (modele_id, latence_ms, tokens_prompt, tokens_completion, succes, erreur, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [modeleId, latenceMs, usage?.prompt_tokens || 0, usage?.completion_tokens || 0, succes ? 1 : 0, erreur, Date.now()]
  );
}

export async function getMetriquesParModele(depuisMs = Date.now() - 7 * 24 * 60 * 60 * 1000) {
  return db.all(
    `SELECT modele_id,
            COUNT(*) as nb_appels,
            AVG(latence_ms) as latence_moyenne_ms,
            SUM(CASE WHEN succes = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as taux_succes_pct,
            SUM(tokens_prompt + tokens_completion) as tokens_total
     FROM ainoria_metriques_modeles
     WHERE cree_le > ?
     GROUP BY modele_id
     ORDER BY nb_appels DESC`,
    [depuisMs]
  );
}

export function listerCapacitesDisponibles() {
  const capacites = new Set();
  FOURNISSEURS_PAR_DEFAUT.forEach(f =>
    Object.keys(f.modeles).forEach(c => capacites.add(c))
  );
  return [...capacites];
}
