'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * CLIENT OFFICIEL — WhatsApp Agent Platform
 *   https://api.whatsapp.com/agent/v1
 * ──────────────────────────────────────────────────────────────────
 * Canal 100 % officiel (zéro risque de bannissement) en alternative à
 * Baileys. L'agent est créé dans WhatsApp : Paramètres → Agents →
 * Créer un agent → Chat info → Clé d'API.
 *
 * ⚠️ LIMITES OFFICIELLES (doc v1) — à connaître avant d'utiliser :
 *   · un agent ne parle QU'À son créateur (pas de groupe, pas de tierce
 *     personne, pas de broadcast libre) → envoi à un autre = 403 (131005)
 *   · réactions : réception seule (envoi refusé, 400)
 *   · quotas : 12 messages/min · 15 sondages/min · 12 req/min par média
 *   · médias : 5 Mo image · 500 Ko sticker · 16 Mo vidéo/audio/document
 *   · rétention : 30 jours
 *   Ces limites sont appliquées PAR WHATSAPP, pas par nous.
 *
 * Le jeton vient de .env (AGENT_API_TOKEN) — jamais écrit dans le code.
 * ══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://api.whatsapp.com/agent/v1';
const LIMITS = { messages: 12, updates: 15, media: 12, statuses: 12 };
const TAILLES = { image: 5 * 1024 * 1024, sticker: 500 * 1024, default: 16 * 1024 * 1024 };
const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;

/* ══════════ erreurs typées ══════════ */
class AgentError extends Error {
  constructor(status, code, message, details, fbtrace) {
    super(`[Agent ${status}] ${message}`);
    this.name = 'AgentError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.fbtraceId = fbtrace;
  }
  /* utile au bot : dire à l'utilisateur quoi faire */
  get conseil() {
    switch (this.code) {
      case 190: return 'Jeton absent ou mal formé — en-tête Authorization: Bearer <jeton>.';
      case 100: return this.status === 404
        ? 'Média inconnu ou expiré — redemande-le ou renvoie-le.'
        : 'Jeton invalide, média inconnu, ou texte/légende trop long.';
      case 131005: return 'Un agent ne peut écrire QU’À son créateur (limite officielle).';
      case 131009: return 'Champ manquant ou destinataire qui n’est pas user:<id>.';
      case 131016: return 'Message non accepté pour livraison — renvoie après une pause.';
      case 131053: return 'Média refusé : trop gros ou type MIME non accepté.';
      case 130429: return 'Quota dépassé (12/min envois, 15/min sondages) — backoff.';
      case 1752041: return 'Un sondage plus récent a pris ta place — un seul à la fois.';
      default: return 'Erreur inattendue.';
    }
  }
  get doitReessayer() {
    if (this.status === 429) return true;
    if (this.status === 503 && this.code === 131016) return true;
    if (this.status >= 500) return true;
    return false; // 4xx : corriger la requête, la réessayer identique échoue pareil
  }
}

/* ══════════ quota glissant 60 s, par méthode ══════════ */
class Quota {
  constructor() { this.j = new Map(); }
  ok(methode) {
    const now = Date.now();
    const arr = (this.j.get(methode) || []).filter((t) => now - t < 60000);
    if (arr.length >= LIMITS[methode]) {
      this.j.set(methode, arr);
      return { ok: false, attendreMs: 60000 - (now - arr[0]) + 100 };
    }
    arr.push(now);
    this.j.set(methode, arr);
    return { ok: true, attendreMs: 0 };
  }
  attendre(methode) {
    const r = this.ok(methode);
    return r.ok ? 0 : r.attendreMs;
  }
  reset() { this.j.clear(); }
}

/* ══════════ client ══════════ */
class AgentClient {
  constructor(opts = {}) {
    this.token = opts.token || process.env.AGENT_API_TOKEN || '';
    this.createur = opts.createur || process.env.AGENT_CREATOR_ID || '';
    this.fetchImpl = opts.fetchImpl || fetch;
    this.quota = new Quota();
    this.log = opts.log || (() => {});
    this.timeoutMs = opts.timeoutMs || 30000;
    this.maxTentatives = opts.maxTentatives || 4;
    /* offset absent = l'API commence au « head » actuel : on saute le
       backlog (sinon des centaines d'anciens messages tombent d'un coup au
       démarrage et consomment tout le quota — doc officielle). */
    this.offset = Number.isFinite(opts.offset) ? opts.offset : null;
    this.dors = opts.dors || null;
  }

  get configure() { return !!this.token; }

  async _requete(methode, chemin, { json, form, brute = false, quota = true } = {}) {
    if (!this.token) throw new AgentError(401, 190, 'Jeton absent', 'Définis AGENT_API_TOKEN dans .env');
    if (quota) {
      const attente = this.quota.attendre(this._methodeQuota(methode, chemin));
      if (attente > 0) throw new AgentError(429, 130429, `Quota ${methode} atteint`, `réessaie dans ${Math.ceil(attente / 1000)}s`);
    }
    const url = `${BASE}${chemin}`;
    const entetes = { Authorization: `Bearer ${this.token}` };
    let corps;
    if (json) { entetes['Content-Type'] = 'application/json'; corps = JSON.stringify(json); }
    else if (form) { corps = form; } // FormData gère son Content-Type

    let dernier = null;
    for (let t = 1; t <= this.maxTentatives; t += 1) {
      const ctl = AbortSignal.timeout(this.timeoutMs);
      let res;
      try {
        res = await this.fetchImpl(url, { method: methode, headers: entetes, body: corps, signal: ctl });
      } catch (e) {
        dernier = new AgentError(0, 0, `Réseau : ${e.message}`, 'timeout ou connexion coupée');
        dernier.reseau = true;
        if (t < this.maxTentatives) await this._backoff(t);
        continue;
      }
      /* 204 = rien à lire (fin de timeout du sondage) */
      if (res.status === 204) return { vide: true };
      const type = res.headers.get('content-type') || '';
      const brut = type.includes('application/json') ? await res.json() : await res.text();
      if (res.ok) return brut;

      const err = brut?.error || {};
      dernier = new AgentError(res.status, err.code || 0, err.message || `HTTP ${res.status}`, err.error_data?.details, err.fbtrace_id);
      /* 409 : un autre sondage a pris la place → on ne réessaie pas */
      if (res.status === 409) throw dernier;
      if (!dernier.doitReessayer) throw dernier;
      if (t < this.maxTentatives) await this._backoff(t);
    }
    throw dernier || new AgentError(0, 0, 'Échec inconnu');
  }

  async _backoff(tentative) {
    const ms = Math.min(30000, 500 * 2 ** (tentative - 1)) * (0.5 + Math.random());
    this.log(`[AGENT] tentative ${tentative} échouée → pause ${Math.round(ms)}ms`);
    if (this.dors) { await this.dors(ms); return; }
    await new Promise((r) => setTimeout(r, ms));
  }

  _methodeQuota(methode, chemin) {
    if (chemin.startsWith('/media')) return 'media';
    if (chemin.startsWith('/updates')) return 'updates';
    if (chemin.startsWith('/statuses')) return 'statuses';
    return 'messages';
  }

  /* ── 1. envoyer un message ── */
  async envoyer({ to, type = 'text', texte, legende, mediaId, mediaType, nomFichier, citer, apercuUrl }) {
    if (type === 'reaction') throw new AgentError(400, 131009, 'Les réactions sont en réception seule');
    const corps = { messaging_product: 'whatsapp', to, type };
    if (citer) corps.context = { message_id: citer };
    if (type === 'text') {
      if (!texte) throw new AgentError(400, 131009, 'texte manquant');
      corps.text = { body: String(texte).slice(0, MAX_TEXT) };
      if (apercuUrl) corps.text.preview_url = true;
    } else if (['image', 'video', 'document', 'sticker', 'audio'].includes(type)) {
      if (!mediaId) throw new AgentError(400, 131009, `id média manquant pour ${type}`);
      const m = { id: mediaId };
      if (legende && ['image', 'video', 'document'].includes(type)) m.caption = String(legende).slice(0, MAX_CAPTION);
      if (nomFichier && type === 'document') m.filename = nomFichier;
      corps[type] = m;
    } else {
      throw new AgentError(400, 131009, `type inconnu : ${type}`, 'text|image|audio|video|document|sticker');
    }
    const r = await this._requete('POST', '/messages', { json: corps });
    return { id: r?.messages?.[0]?.id, vers: r?.contacts?.[0]?.wa_id, brut: r };
  }

  /* ── 2. recevoir (sondage long) ──
     offset absent → l'API démarre au « head » (on saute le backlog). */
  async mises({ offset, limit = 50, timeout = 20 } = {}) {
    const o = offset !== undefined ? offset : this.offset;
    /* ⚠️ Les deux branches NE partagent PAS le même séparateur : sans
       offset l'URL commence par « ?limit=… » ; AVEC offset il faut
       « ?offset=…&limit=… ». Un seul « ? » au total (un second « ? »
       donne « ?offset=0?limit=… » → 400 #131009 Invalid parameter). */
    const params = `limit=${limit}&timeout=${timeout}`;
    const chemin = o === null || o === undefined
      ? `/updates?${params}`
      : `/updates?offset=${encodeURIComponent(o)}&${params}`;
    const r = await this._requete('GET', chemin, { quota: true });
    if (r?.vide) return { vide: true, offset: o };
    const entree = r?.entry?.[0] || {};
    const chg = entree?.changes?.[0]?.value || {};
    const messages = chg.messages || [];
    const statuses = chg.statuses || [];
    const contacts = chg.contacts || [];
    if (Number.isFinite(r?.next_offset)) this.offset = r.next_offset;
    return { vide: messages.length + statuses.length === 0, messages, statuses, contacts, nextOffset: r?.next_offset, agentId: entree.id };
  }

  /* ── 3. accusés de lecture + indicateur de saisie ── */
  async marquerLu({ messageId, saisie = false }) {
    const json = { messaging_product: 'whatsapp', status: 'read', message_id: messageId };
    if (saisie) json.typing_indicator = { type: 'text' };
    return this._requete('POST', '/statuses', { json });
  }

  /* ── 4. média : envoi / métadonnées / téléchargement / suppression ── */
  async televerser(fichierOuBuffer, { mime } = {}) {
    const fd = new FormData();
    fd.append('messaging_product', 'whatsapp');
    const buf = Buffer.isBuffer(fichierOuBuffer)
      ? fichierOuBuffer
      : fs.readFileSync(fichierOuBuffer);
    fd.append('file', new Blob([buf], { type: mime || 'application/octet-stream' }), 'fichier');
    if (mime) fd.append('type', mime);
    const r = await this._requete('POST', '/media', { form: fd });
    return r?.id;
  }

  async metaMedia(id) {
    return this._requete('GET', `/media/${encodeURIComponent(id)}`);
  }

  async telecharger(id) {
    const meta = await this.metaMedia(id);
    if (!meta?.url) throw new AgentError(404, 100, 'URL média absente');
    const res = await this.fetchImpl(meta.url, {
      headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new AgentError(res.status, 100, `Téléchargement média HTTP ${res.status}`);
    return { buffer: Buffer.from(await res.arrayBuffer()), mime: meta.mime_type, taille: meta.file_size };
  }

  async supprimerMedia(id) {
    return this._requete('DELETE', `/media/${encodeURIComponent(id)}`);
  }
}

/* ══════════ helpers ══════════ */
function limiteTaille(type) { return TAILLES[type] || TAILLES.default; }
function typeDepuisMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('image/')) return m.includes('webp') ? 'sticker' : 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  return 'document';
}

/* Devine le type MIME RÉEL depuis les octets (magic numbers).
   Indispensable : un Buffer n'a pas de MIME, et l'API Agent REFUSE les
   types génériques « image/* » (#131053 « The declared media type is not
   one WhatsApp can render »). Renvoie null si non reconnu. */
function mimeDepuisBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  const ascii = (debut, fin) => buf.toString('ascii', debut, fin);
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 3) === 'ID3') return 'audio/mpeg';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (ascii(0, 4) === 'BM') return 'image/bmp';
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  if (buf.length >= 12 && ascii(4, 8) === 'ftyp') {
    const marque = ascii(8, 12);
    if (marque.startsWith('qt')) return 'video/quicktime';
    if (marque.startsWith('3gp')) return 'video/3gpp';
    return 'video/mp4';
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}

/* MIME concret de repli par famille (jamais « * »). */
const MIME_DEFAUT = {
  image: 'image/jpeg', video: 'video/mp4', audio: 'audio/mpeg',
  document: 'application/pdf', sticker: 'image/webp',
};

module.exports = {
  AgentClient, AgentError, Quota,
  BASE, LIMITS, TAILLES, MAX_TEXT, MAX_CAPTION,
  limiteTaille, typeDepuisMime, mimeDepuisBuffer, MIME_DEFAUT,
};
