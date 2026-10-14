'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * PONT — WhatsApp Agent Platform  ⇄  moteur DJOUSSE
 * ──────────────────────────────────────────────────────────────────
 * Deux sens :
 *   RÉCEPTION : GET /agent/v1/updates → message agent → objet façon
 *               Baileys → handler.handleMessage() (donc TOUTES tes
 *               commandes existantes fonctionnent telles quelles).
 *   ENVOI     : send() maison → appel API officiel (texte/média).
 *
 * ⚠️ Un agent ne parle qu'à son créateur (limite WhatsApp). Toute
 *    tentative vers un autre destinataire est refusée AVANT l'appel,
 *    avec un message clair — pas un 403 incompréhensible.
 * ══════════════════════════════════════════════════════════════════
 */
const { AgentClient, AgentError, limiteTaille, typeDepuisMime } = require('./wa-agent');

/* ══════════ réception : agent → façon Baileys ══════════ */
function messageAgentVersBaileys(m, contacts) {
  const profil = (contacts || []).find((c) => c.wa_id === m.from)?.profile?.name || '';
  const base = {
    key: {
      remoteJid: m.from,          // « user:123 » — utilisé comme identifiant de chat
      id: m.id,                   // wamid
      fromMe: false,
      participant: m.from,
    },
    messageTimestamp: Number(m.timestamp) || Math.floor(Date.now() / 1000),
    pushName: profil,
  };
  const payload = {};
  if (m.type === 'text') {
    if (m.context) {
      payload.extendedTextMessage = {
        text: m.text?.body || '',
        contextInfo: {
          stanzaId: m.context.id,
          participant: m.context.from,
          quotedMessage: m.context.from?.startsWith('agent:') ? { conversation: '…' } : { conversation: '…' },
        },
      };
    } else {
      payload.conversation = m.text?.body || '';
    }
  } else if (['image', 'video', 'document', 'audio', 'sticker'].includes(m.type)) {
    const p = m[m.type] || {};
    const cle = p.mime_type || (m.type === 'sticker' ? 'image/webp' : 'application/octet-stream');
    payload[`${m.type}Message`] = {
      mimetype: cle,
      caption: p.caption || undefined,
      fileName: p.filename || undefined,
      ptt: p.voice || undefined,
      /* handle média : le pont le résout via GET /agent/v1/media/<id> */
      _agentMediaId: p.id,
      _agentSha256: p.sha256,
    };
  } else if (m.type === 'reaction') {
    payload.reactionMessage = {
      key: { id: m.reaction?.message_id }, text: m.reaction?.emoji || '',
    };
  }
  return { ...base, message: payload, _agent: true, _type: m.type };
}

/* ══════════ envoi : contenu maison → API ══════════ */
/* content : même forme que lib/wa-send.js accepte ({text}, {image}, …) */
async function envoyerContenu(client, destinataire, content, opts = {}) {
  const createur = client.createur;
  if (createur && destinataire !== createur) {
    throw new AgentError(403, 131005,
      `Un agent ne peut écrire qu’à son créateur (${createur})`,
      `destinataire refusé : ${destinataire}`);
  }
  if (content.react) throw new AgentError(400, 131009, 'Les réactions sont en réception seule');
  if (content.text !== undefined) {
    return client.envoyer({
      to: destinataire, type: 'text', texte: content.text,
      citer: opts.quoted?.key?.id, apercuUrl: !!content.contextInfo,
    });
  }
  /* médias : on téléverse d'abord, puis on envoie l'id */
  const types = [
    ['image', 'image'], ['video', 'video'], ['audio', 'audio'],
    ['document', 'document'], ['sticker', 'sticker'],
  ];
  for (const [cle, typeApi] of types) {
    if (content[cle] === undefined) continue;
    const valeur = content[cle];
    let buffer = null;
    let mime = undefined;
    if (Buffer.isBuffer(valeur)) buffer = valeur;
    else if (valeur?.url) {
      const r = await fetch(valeur.url, { signal: AbortSignal.timeout(45000) });
      buffer = Buffer.from(await r.arrayBuffer());
      mime = r.headers.get('content-type');
    } else if (typeof valeur === 'string') {
      buffer = Buffer.from(valeur, 'base64');
    } else buffer = null;
    if (!buffer) continue;
    if (!mime) mime = typeApi === 'sticker' ? 'image/webp' : `${typeApi}/*`;
    const typeDetecte = typeDepuisMime(mime) === 'sticker' && typeApi !== 'sticker' ? typeApi : typeDepuisMime(mime);
    if (buffer.length > limiteTaille(typeDetecte)) {
      throw new AgentError(400, 131053,
        `Média trop gros (${(buffer.length / 1048576).toFixed(1)} Mo)`,
        `limite ${typeDetecte} : ${(limiteTaille(typeDetecte) / 1048576).toFixed(1)} Mo`);
    }
    const id = await client.televerser(buffer, { mime });
    return client.envoyer({
      to: destinataire, type: typeApi === 'image' && mime.includes('webp') ? 'sticker' : typeDetecte,
      mediaId: id, legende: content.caption, nomFichier: content.fileName,
      citer: opts.quoted?.key?.id,
    });
  }
  throw new AgentError(400, 131009, 'Type de contenu non envoyable par l’API agent');
}

/* ══════════ boucle de sondage ══════════ */
function demarrerBoucle(client, handler, opts = {}) {
  const { onMessage, prefix = '.', marquerLu = true, indicateur = true, log = () => {} } = opts;

  /* Compatibilité : tout le bot (handler, commandes, wa-send) appelle
     sock.sendMessage(jid, content, opts). On branche donc cette méthode
     sur le client pour qu'il soit un sock comme un autre — les envois
     passent alors par l'API officielle, avec les limites vérifiées. */
  if (typeof client.sendMessage !== 'function') {
    client.sendMessage = async (jid, content, o = {}) => envoyerContenu(client, jid, content, o);
  }

  let arrete = false;
  let offset = client.offset;

  async function unPoll() {
    const r = await client.mises({ offset, timeout: 20 });
    if (r.vide) return 0;
    offset = r.nextOffset ?? offset;
    let traites = 0;
    for (const m of r.messages || []) {
      traites += 1;
      try {
        if (indicateur) await client.marquerLu({ messageId: m.id, saisie: true }).catch(() => {});
        const msg = messageAgentVersBaileys(m, r.contacts);
        if (onMessage) await onMessage(msg);
        if (marquerLu) await client.marquerLu({ messageId: m.id }).catch(() => {});
      } catch (e) {
        log(`[AGENT] traitement message ${m.id} : ${e.message}`);
      }
    }
    return traites;
  }

  async function boucle() {
    while (!arrete) {
      try {
        const n = await unPoll();
        if (!n) { /* rien : on enchaîne immédiatement (le 20 s a servi d'attente) */ }
      } catch (e) {
        if (e instanceof AgentError) {
          log(`[AGENT] ${e.message} — ${e.conseil}`);
          if (e.code === 1752041) { /* un autre poll a pris la place */ }
          await new Promise((r) => setTimeout(r, e.status === 429 ? 20000 : 5000));
        } else {
          log(`[AGENT] boucle : ${e.message}`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  boucle(); // ne bloque pas (ne pas await ici)
  return () => { arrete = true; };
}

module.exports = {
  messageAgentVersBaileys,
  envoyerContenu,
  demarrerBoucle,
  AgentClient,
  AgentError,
};
