import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

export async function activerGuardian(groupJid, adminJid) {
  const maintenant = Date.now();
  const existant = await rawGet('SELECT group_jid FROM groupes_guardian WHERE group_jid = ?', [groupJid]);
  if (existant) {
    await rawRun('UPDATE groupes_guardian SET active = 1, active_par = ?, active_le = ? WHERE group_jid = ?', [adminJid, maintenant, groupJid]);
  } else {
    await rawRun('INSERT INTO groupes_guardian (group_jid, active, active_par, active_le) VALUES (?, 1, ?, ?)', [groupJid, adminJid, maintenant]);
  }
}

export async function desactiverGuardian(groupJid) {
  await rawRun('UPDATE groupes_guardian SET active = 0 WHERE group_jid = ?', [groupJid]);
}

export async function estActifPourGroupe(groupJid) {
  const ligne = await rawGet('SELECT active FROM groupes_guardian WHERE group_jid = ?', [groupJid]);
  return !!ligne?.active;
}

export async function verifierLien(url, groupJid) {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return null;

  try {
    const reponse = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
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
    });

    const data = await reponse.json();
    const dangereux = Array.isArray(data.matches) && data.matches.length > 0;
    const verdict = { url, dangereux, typesMenace: dangereux ? data.matches.map(m => m.threatType) : [] };

    await enregistrerVerification(groupJid, 'lien_malveillant', url, dangereux ? 'dangereux' : 'sain', []);
    return verdict;
  } catch (error) {
    console.error('[Guardian] Erreur vérification lien:', error.message);
    return null;
  }
}

export function extraireUrls(texte) {
  return texte.match(/(https?:\/\/[^\s]+)/g) || [];
}

export function estFortementTransfere(messageEntrant) {
  const score = messageEntrant?.message?.extendedTextMessage?.contextInfo?.forwardingScore
    || messageEntrant?.contextInfo?.forwardingScore
    || 0;
  return score >= 2;
}

export async function verifierRumeur(texteMessage, groupJid, rechercherSurLeWeb) {
  const affirmation = await extraireAffirmationVerifiable(texteMessage);
  if (!affirmation) return null;

  const resultatsRecherche = await rechercherSurLeWeb(affirmation);
  if (!resultatsRecherche || resultatsRecherche.length === 0) {
    return { verdict: 'a_verifier', resume: 'Aucune source fiable trouvée.', sources: [] };
  }

  const verdict = await synthetiserVerdict(affirmation, resultatsRecherche);
  await enregistrerVerification(groupJid, 'rumeur_virale', texteMessage, verdict.verdict, verdict.sources);
  return verdict;
}

async function extraireAffirmationVerifiable(texte) {
  const prompt = `Message : "${texte}"

Réponds UNIQUEMENT avec un JSON :
{ "affirmation_verifiable": "l'affirmation factuelle vérifiable en une phrase, ou null si rien de vérifiable" }`;

  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        max_tokens: 150,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'affirmation_extraction',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                affirmation_verifiable: { type: ['string', 'null'] },
              },
              required: ['affirmation_verifiable'],
            },
          },
        },
      }),
    });
    const data = await reponse.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());
    return parsed.affirmation_verifiable || null;
  } catch {
    return null;
  }
}

async function synthetiserVerdict(affirmation, resultatsRecherche) {
  const sourcesTexte = resultatsRecherche.slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.titre} — ${r.extrait} (${r.url})`)
    .join('\n');

  const prompt = `Affirmation : "${affirmation}"

Sources :
${sourcesTexte}

Réponds UNIQUEMENT avec un JSON :
{
  "verdict": "probablement_vrai" | "probablement_faux" | "a_verifier" | "sujet_conteste",
  "resume": "2-3 phrases avec sources citées [1][2]...",
  "sources_utilisees": [numéros des sources citées]
}

RÈGLES : si sujet politique/religieux ou débat légitime → "sujet_conteste". Si sources contradictoires → "a_verifier". Jamais de conseil médical concret.`;

  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 350,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'verdict_result',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                verdict: { type: 'string', enum: ['probablement_vrai', 'probablement_faux', 'a_verifier', 'sujet_conteste'] },
                resume: { type: 'string' },
                sources_utilisees: { type: 'array', items: { type: 'integer' } },
              },
              required: ['verdict', 'resume', 'sources_utilisees'],
            },
          },
        },
      }),
    });
    const data = await reponse.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());

    const sourcesUtilisees = (parsed.sources_utilisees || [])
      .map(n => resultatsRecherche[n - 1])
      .filter(Boolean)
      .map(s => ({ titre: s.titre, url: s.url }));

    return {
      verdict: parsed.verdict || 'a_verifier',
      resume: parsed.resume || 'Impossible de trancher.',
      sources: sourcesUtilisees,
    };
  } catch {
    return { verdict: 'a_verifier', resume: 'Erreur lors de la vérification.', sources: [] };
  }
}

async function enregistrerVerification(groupJid, type, contenu, verdict, sources) {
  await rawRun(
    `INSERT INTO verifications_effectuees (group_jid, type, contenu_original, verdict, sources, cree_le)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [groupJid, type, contenu, verdict, JSON.stringify(sources), Date.now()]
  );
}

export function formaterAlerteLien(verdict) {
  if (!verdict.dangereux) return null;
  return `⚠️ *Lien potentiellement dangereux détecté*\n${verdict.url}\n\nType : ${verdict.typesMenace.join(', ')}\n\n_Évite de cliquer, surtout si on te demande des informations personnelles._`;
}

export function formaterVerdictRumeur(verdict) {
  const emojis = { probablement_vrai: '✅', probablement_faux: '❌', a_verifier: '❓', sujet_conteste: '⚖️' };
  let texte = `${emojis[verdict.verdict] || '❓'} *Vérification d'une info qui circule*\n\n${verdict.resume}`;
  if (verdict.sources.length) {
    texte += `\n\nSources :\n` + verdict.sources.map(s => `- ${s.titre}`).join('\n');
  }
  return texte;
}
