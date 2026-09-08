import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const PATTERNS_ENGAGEMENT = /(je (t'|vous )?(envoie|fais|regarde|termine|prep.re|r.ponds|confirme)|je m'en occupe|c'est (pr.vu|pour) (demain|ce soir|cette semaine|vendredi|lundi))/i;

export async function activerSuivi(groupJid, adminJid) {
  const maintenant = Date.now();
  const existant = await rawGet('SELECT group_jid FROM groupes_suivi_proactif WHERE group_jid = ?', [groupJid]);
  if (existant) {
    await rawRun('UPDATE groupes_suivi_proactif SET active = 1, active_par = ?, active_le = ? WHERE group_jid = ?', [adminJid, maintenant, groupJid]);
  } else {
    await rawRun('INSERT INTO groupes_suivi_proactif (group_jid, active, active_par, active_le) VALUES (?, 1, ?, ?)', [groupJid, adminJid, maintenant]);
  }
}

export async function desactiverSuivi(groupJid) {
  await rawRun('UPDATE groupes_suivi_proactif SET active = 0 WHERE group_jid = ?', [groupJid]);
}

export async function estActifPourGroupe(groupJid) {
  const ligne = await rawGet('SELECT active FROM groupes_suivi_proactif WHERE group_jid = ?', [groupJid]);
  return !!ligne?.active;
}

export async function analyserMessagePourEngagement(groupJid, messageTexte, senderJid, senderNom) {
  const active = await estActifPourGroupe(groupJid);
  if (!active) return;
  if (!PATTERNS_ENGAGEMENT.test(messageTexte)) return;

  const prompt = `Message : "${messageTexte}"

Réponds UNIQUEMENT avec un JSON :
{
  "est_un_engagement": true ou false,
  "promesse_resumee": "résumé court de ce qui est promis, ou null",
  "echeance_relative": "aujourd_hui" | "demain" | "cette_semaine" | "flou" | null
}`;

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
            name: 'engagement_extraction',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                est_un_engagement: { type: 'boolean' },
                promesse_resumee: { type: ['string', 'null'] },
                echeance_relative: { type: ['string', 'null'], enum: ['aujourd_hui', 'demain', 'cette_semaine', 'flou', null] },
              },
              required: ['est_un_engagement', 'promesse_resumee', 'echeance_relative'],
            },
          },
        },
      }),
    });
    const data = await reponse.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());
    if (!parsed.est_un_engagement || !parsed.promesse_resumee) return;

    const echeance = calculerEcheance(parsed.echeance_relative);
    await rawRun(
      `INSERT INTO engagements_detectes (group_jid, personne_jid, personne_nom, promesse, echeance_estimee, message_source, detecte_le)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [groupJid, senderJid, senderNom, parsed.promesse_resumee, echeance, messageTexte, Date.now()]
    );
  } catch (error) {
    console.error('[Suivi] Erreur extraction engagement:', error.message);
  }
}

function calculerEcheance(echeanceRelative) {
  const maintenant = Date.now();
  const JOUR = 86400000;
  switch (echeanceRelative) {
    case 'aujourd_hui': return maintenant + JOUR;
    case 'demain': return maintenant + 2 * JOUR;
    case 'cette_semaine': return maintenant + 7 * JOUR;
    default: return maintenant + 3 * JOUR;
  }
}

export async function verifierEngagementsEnRetard(envoyerMessagePrive) {
  const maintenant = Date.now();
  const enRetard = await rawAll(
    `SELECT * FROM engagements_detectes WHERE statut = 'en_attente' AND echeance_estimee < ?`,
    [maintenant]
  );

  for (const engagement of enRetard) {
    const texte = `👋 Petit rappel discret : tu avais mentionné "${engagement.promesse}" — c'est fait, ou tu as besoin d'un coup de main ?\n\n_(Je ne relance qu'en privé.)_`;
    await envoyerMessagePrive(engagement.personne_jid, texte);
    await rawRun(
      `UPDATE engagements_detectes SET statut = 'relance_envoyee', derniere_relance_le = ? WHERE id = ?`,
      [maintenant, engagement.id]
    );
  }
  return enRetard.length;
}

export async function confirmerEngagement(engagementId) {
  await rawRun(`UPDATE engagements_detectes SET statut = 'confirme' WHERE id = ?`, [engagementId]);
}

export async function detecterBlocages(groupJid, messagesRecents) {
  const active = await estActifPourGroupe(groupJid);
  if (!active || messagesRecents.length < 20) return null;

  const transcript = messagesRecents.slice(-100).map(m => `${m.sender}: ${m.message}`).join('\n');

  const prompt = `Messages récents d'un groupe de travail. Détecte si un sujet reste en attente de décision depuis plusieurs jours, bloquant d'autres choses.

${transcript}

Réponds UNIQUEMENT avec un JSON :
{
  "blocage_detecte": true ou false,
  "description": "résumé du sujet bloqué, sans nommer de personne",
  "taches_impactees": ["ce que ça bloque"]
}`;

  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        max_tokens: 250,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'blockage_detection',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                blocage_detecte: { type: 'boolean' },
                description: { type: 'string' },
                taches_impactees: { type: 'array', items: { type: 'string' } },
              },
              required: ['blocage_detecte', 'description', 'taches_impactees'],
            },
          },
        },
      }),
    });
    const data = await reponse.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());
    if (!parsed.blocage_detecte) return null;

    const maintenant = Date.now();
    const existant = await rawGet(
      `SELECT id FROM blocages_detectes WHERE group_jid = ? AND description = ? AND statut != 'resolu'`,
      [groupJid, parsed.description]
    );

    if (!existant) {
      await rawRun(
        `INSERT INTO blocages_detectes (group_jid, description, taches_impactees, bloque_depuis, derniere_alerte_le)
         VALUES (?, ?, ?, ?, ?)`,
        [groupJid, parsed.description, JSON.stringify(parsed.taches_impactees || []), maintenant, 0]
      );
    }
    return parsed;
  } catch (error) {
    console.error('[Suivi] Erreur détection blocage:', error.message);
    return null;
  }
}

export async function alerterBlocagesAnciens(envoyerMessagePrive, getAdminDuGroupe) {
  const maintenant = Date.now();
  const seuilMs = 5 * 86400000;
  const blocagesAnciens = await rawAll(
    `SELECT * FROM blocages_detectes WHERE statut = 'ouvert' AND bloque_depuis < ?`,
    [maintenant - seuilMs]
  );

  const parGroupe = new Map();
  for (const b of blocagesAnciens) {
    if (!parGroupe.has(b.group_jid)) parGroupe.set(b.group_jid, []);
    parGroupe.get(b.group_jid).push(b);
  }

  for (const [groupJid, blocages] of parGroupe) {
    const adminJid = await getAdminDuGroupe(groupJid);
    if (!adminJid) continue;

    const texte = `⚠️ *Points en attente depuis plus de 5 jours*\n\n` +
      blocages.map(b => `- ${b.description}`).join('\n') +
      `\n\n_Rapport privé pour toi en tant qu'admin._`;

    await envoyerMessagePrive(adminJid, texte);
    await rawRun(
      `UPDATE blocages_detectes SET statut = 'signale', derniere_alerte_le = ? WHERE group_jid = ? AND statut = 'ouvert'`,
      [maintenant, groupJid]
    );
  }
  return blocagesAnciens.length;
}

let _timerEngagements = null;
let _timerBlocages = null;

export function demarrerCycles(envoyerMessagePrive, getAdminDuGroupe) {
  arreterCycles();
  _timerEngagements = setInterval(() => {
    verifierEngagementsEnRetard(envoyerMessagePrive).catch(() => {});
  }, 3600000);
  _timerBlocages = setInterval(() => {
    alerterBlocagesAnciens(envoyerMessagePrive, getAdminDuGroupe).catch(() => {});
  }, 86400000);
}

export function arreterCycles() {
  if (_timerEngagements) { clearInterval(_timerEngagements); _timerEngagements = null; }
  if (_timerBlocages) { clearInterval(_timerBlocages); _timerBlocages = null; }
}
