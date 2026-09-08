const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const config = require('../config-djousse.cjs');

const BOT_NAME_BOX = (config.BOT_NAME || 'DJOUSSE TECH').replace(/-MD$/i, '').replace(/-/g, ' ');

/* ══════════════════════════════════════════════════════════════════════════
   Baileys-style media decryption — copie fidèle du pipeline Baileys :
     1. normalizeMessageContent() → déballe viewOnceMessage/ephemeral/etc.
     2. getMediaKeys(mediaKey, type) → HKDF 112 octets, info par type
     3. downloadEncryptedContent() → HTTP GET mmg.whatsapp.net + AES-CBC
   Fonctionne pour les médias vue-unique ET les médias classiques quand
   l'API native de wwebjs échoue.
   ══════════════════════════════════════════════════════════════════════════ */

const MEDIA_CDN = 'https://mmg.whatsapp.net';
const DEFAULT_ORIGIN = 'web.whatsapp.net';

/* ─── Mapping type média → info string HKDF (identique à Baileys) ─── */
const MEDIA_HKDF_KEY_MAPPING = {
  audio:       'Audio',
  document:    'Document',
  gif:         'Video',
  image:       'Image',
  ptt:         'Audio',
  sticker:     'Image',
  video:       'Video',
  ptv:         'Video',
  'thumbnail-link': 'Image',
};

/**
 * Retourne l'info string HKDF pour un type média donné.
 * Baileys : "WhatsApp Image Keys", "WhatsApp Video Keys", etc.
 */
function hkdfInfoKey(mediaType) {
  const mapped = MEDIA_HKDF_KEY_MAPPING[mediaType] || 'Media';
  return `WhatsApp ${mapped} Keys`;
}

/**
 * Déduit le mediaType depuis le nom du contenu protobuf.
 * "imageMessage" → "image", "videoMessage" → "video", etc.
 */
function contentTypeToMediaType(contentType) {
  if (!contentType) return 'media';
  return contentType.replace('Message', '').toLowerCase();
}

/* ─── Téléchargement buffer depuis URL (avec redirects) ─── */
function downloadBuffer(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location, maxRedirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`CDN HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('CDN timeout')); });
  });
}

/* ─── normalizeMessageContent — déballe les enveloppes (Baileys) ─── */
function normalizeMessageContent(content) {
  if (!content) return undefined;
  for (let i = 0; i < 5; i++) {
    const inner = getFutureProofMessage(content);
    if (!inner) break;
    content = inner.message;
  }
  return content;

  function getFutureProofMessage(msg) {
    return (
      msg?.ephemeralMessage ||
      msg?.viewOnceMessage ||
      msg?.documentWithCaptionMessage ||
      msg?.viewOnceMessageV2 ||
      msg?.viewOnceMessageV2Extension ||
      msg?.editedMessage ||
      msg?.associatedChildMessage ||
      msg?.groupStatusMessage ||
      msg?.groupStatusMessageV2
    );
  }
}

/**
 * Extrait le vrai contenu média depuis un message Baileys.
 * Normalise puis retourne { contentType, mediaObject, mediaType }
 */
function extractMediaFromProto(messageProto) {
  if (!messageProto || typeof messageProto !== 'object') return null;
  const normalized = normalizeMessageContent(messageProto);
  if (!normalized) return null;
  const mediaContentKeys = [
    'imageMessage', 'videoMessage', 'audioMessage',
    'documentMessage', 'stickerMessage',
  ];
  for (const k of mediaContentKeys) {
    if (normalized[k] && (normalized[k].directPath || normalized[k].mediaKey)) {
      return {
        contentType: k,
        mediaType: contentTypeToMediaType(k),
        media: normalized[k],
      };
    }
  }
  return null;
}

/**
 * getMediaKeys — HKDF 112 octets, exactement comme Baileys.
 * mediaKey (32 octets) → HKDF → iv[0:16] + cipherKey[16:48] + macKey[48:80]
 */
async function getMediaKeys(mediaKeyBuffer, mediaType) {
  if (!mediaKeyBuffer || mediaKeyBuffer.length === 0) {
    throw new Error('mediaKey invalide (vide)');
  }
  const info = hkdfInfoKey(mediaType);
  /* hkdfSync retourne un ArrayBuffer en Node.js 15+ */
  const expanded = Buffer.from(
    crypto.hkdfSync('sha256', mediaKeyBuffer, Buffer.alloc(32, 0), info, 112)
  );
  return {
    iv:         expanded.subarray(0, 16),    // IV = octets 0-15
    cipherKey:  expanded.subarray(16, 48),   // Clé AES = octets 16-47
    macKey:     expanded.subarray(48, 80),   // Clé HMAC = octets 48-79 (non utilisé en CBC)
  };
}

/**
 * decryptWaMedia — déchiffre un buffer complet via AES-256-CBC.
 * Identique à downloadEncryptedContent() de Baileys mais pour un buffer.
 */
function decryptWaMedia(mediaKeyBuffer, encBuffer, mediaType) {
  if (!mediaKeyBuffer || mediaKeyBuffer.length === 0) throw new Error('mediaKey invalide');
  if (!encBuffer || encBuffer.length < 32) throw new Error('Buffer chiffré trop court');

  const keys = getMediaKeysSync(mediaKeyBuffer, mediaType || 'image');

  const decipher = crypto.createDecipheriv('aes-256-cbc', keys.cipherKey, keys.iv);
  const decrypted = Buffer.concat([decipher.update(encBuffer), decipher.final()]);
  return decrypted;
}

/**
 * Version synchrone de getMediaKeys (pour les appels non-async).
 */
function getMediaKeysSync(mediaKeyBuffer, mediaType) {
  if (!mediaKeyBuffer || mediaKeyBuffer.length === 0) {
    throw new Error('mediaKey invalide');
  }
  const info = hkdfInfoKey(mediaType);
  const expanded = Buffer.from(
    crypto.hkdfSync('sha256', mediaKeyBuffer, Buffer.alloc(32, 0), info, 112)
  );
  return {
    iv:         expanded.subarray(0, 16),
    cipherKey:  expanded.subarray(16, 48),
    macKey:     expanded.subarray(48, 80),
  };
}

/**
 * downloadFromCDN — télécharge depuis mmg.whatsapp.net + déchiffre.
 * @param {string} directPath  - chemin relatif CDN
 * @param {Buffer|string} mediaKey - clé média (32 octets)
 * @param {string} mediaType  - "image", "video", "audio", etc.
 * @param {string} [encFilehash] - hash SHA-256 (optionnel, vérification)
 */
async function downloadFromCDN(directPath, mediaKey, mediaType, encFilehash) {
  if (!directPath) return null;
  const mk = Buffer.isBuffer(mediaKey) ? mediaKey
    : (mediaKey ? Buffer.from(String(mediaKey), 'base64') : null);
  if (!mk || mk.length === 0) return null;
  const type = mediaType || 'image';
  try {
    const url = `${MEDIA_CDN}${directPath}`;
    console.log(`📥 [CDN] Téléchargement ${type}: ${url.slice(0, 80)}...`);
    const encBuf = await downloadBuffer(url);
    if (encBuf.length < 32) return null;
    return decryptWaMedia(mk, encBuf, type);
  } catch (e) {
    console.error(`❌ [CDN download] ${type}: ` + (e.message || e));
    return null;
  }
}

/* ─── extractMediaInfo — extraction robuste depuis tout type de proto ─── */
function extractMediaInfo(messageProto) {
  if (!messageProto || typeof messageProto !== 'object') return null;
  /* Essai 1 : normalisation Baileys complète */
  const extracted = extractMediaFromProto(messageProto);
  if (extracted) {
    return {
      mediaKey:    extracted.media.mediaKey || null,
      directPath:  extracted.media.directPath || null,
      encFilehash: extracted.media.encFilehash || extracted.media.fileEncSha256 || null,
      mimetype:    extracted.media.mimetype || null,
      mediaType:   extracted.mediaType,
    };
  }
  /* Essai 2 : recherche brute dans les clés média */
  const mediaKeys = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
  for (const k of mediaKeys) {
    if (messageProto[k] && (messageProto[k].directPath || messageProto[k].mediaKey)) {
      return {
        mediaKey:    messageProto[k].mediaKey || null,
        directPath:  messageProto[k].directPath || null,
        encFilehash: messageProto[k].encFilehash || messageProto[k].fileEncSha256 || null,
        mimetype:    messageProto[k].mimetype || null,
        mediaType:   contentTypeToMediaType(k),
      };
    }
  }
  /* Essai 3 : directPath au niveau racine */
  if (messageProto.directPath) {
    return {
      mediaKey:    messageProto.mediaKey || null,
      directPath:  messageProto.directPath || null,
      encFilehash: messageProto.encFilehash || null,
      mimetype:    messageProto.mimetype || null,
      mediaType:   'media',
    };
  }
  return null;
}

const wrapBox = (text) => {
	const str = String(text ?? '');
	if (str.includes('『') || str.includes('╭───')) return str;
	const lines = str.split('\n').map(l => (l ? '┃ ' + l : '┃'));
	return `╭───『 *${BOT_NAME_BOX}* 』───●●►\n${lines.join('\n')}\n╰─────────────❖●►`;
};

function getContentType(message) {
	if (!message || typeof message !== 'object') return '';
	const keys = Object.keys(message);
	if (keys.length === 0) return '';
	return keys[0];
}

const downloadMediaMessage = async (m, filename) => {
	try {
		/* 1) Essai natif wwebjs : m._raw.downloadMedia() ou m.msg._be_raw.downloadMedia() */
		const raw = m && m._wwebjs && m._raw
			? m._raw
			: m && m.msg && m.msg._be_raw
				? m.msg._be_raw
				: m && m._be_raw
					? m._be_raw
					: (() => {
						/* Chercher _be_raw plus profondément (ex: m.msg.imageMessage._be_raw) */
						if (m && m.msg) {
							for (const k of Object.keys(m.msg)) {
								if (m.msg[k] && m.msg[k]._be_raw) return m.msg[k]._be_raw;
							}
						}
						return null;
					})();
		if (raw && typeof raw.downloadMedia === 'function') {
			let media = null;
			try { media = await raw.downloadMedia(); } catch {}
			if (!media || !media.data) {
				/* Essai via page Puppeteer (WAWebDownloadManager) */
				try { media = await pageDownloadMedia(raw); } catch {}
			}
			if (!media || !media.data) {
				/* 2) Fallback Baileys-style : extraction mediaKey+directPath → CDN + déchiffrement local */
				media = await cdnFallback(m, raw);
			}
			if (!media || !media.data) return null;
			const buf = Buffer.from(media.data, 'base64');
			if (filename) {
				const ext = String(media.mimetype || '').split('/').pop() || 'bin';
				fs.writeFileSync(`${filename}.${ext}`, buf);
			}
			return buf;
		}

		/* 3) Pas de _raw (objet cache généré par targetFromCache) : CDN direct */
		const cdnMedia = await cdnFallback(m, null);
		if (cdnMedia && cdnMedia.data) {
			const buf = Buffer.from(cdnMedia.data, 'base64');
			if (filename) {
				const ext = String(cdnMedia.mimetype || '').split('/').pop() || 'bin';
				fs.writeFileSync(`${filename}.${ext}`, buf);
			}
			return buf;
		}

		if (!m || !m.msg || !m.type) return null;
		return null;
	} catch (err) {
		console.error('❌ Media download error:', err);
		return null;
	}
};

/* Téléchargement « page » pour les médias où l'API native échoue :
   messages vue-unique (👁️), sticklers animés, médias pas encore résolus.
   Réplique la logique interne de whatsapp-web.js (WAWebDownloadManager) en
   contournant le garde `hasMedia` qui est faux sur les médias vue-unique. */
const pageDownloadMedia = async (raw) => {
	try {
		const client = raw.client;
		if (!client || typeof client.pupPage?.evaluate !== 'function') return null;
		const msgId = raw.id?._serialized || raw.id?.id;
		if (!msgId) return null;
		const result = await client.pupPage.evaluate(async (msgId) => {
			const getMsg = async () => {
				try {
					return window.require('WAWebCollections').Msg.get(msgId) || null;
				} catch { return null; }
			};
			let msg = await getMsg();
			if (!msg) {
				try {
					const byIds = await window.require('WAWebCollections').Msg.getMessagesById([msgId]);
					msg = byIds?.messages?.[0] || null;
				} catch {}
			}
			if (!msg) return null;
			for (let i = 0; i < 3; i++) {
				const st = msg.mediaData?.mediaStage;
				if (st === 'RESOLVED') break;
				if (st === 'REUPLOADING') return null;
				try {
					if (typeof msg.downloadMedia === 'function') {
						await msg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1 });
					}
				} catch {}
				await new Promise(r => setTimeout(r, 1500));
			}
			const st = msg.mediaData?.mediaStage || '';
			/* On baisse les bras seulement si mediaData existe ET signale une erreur/
			   un fetch en cours ; si mediaData est absent on tente quand même
			   downloadAndMaybeDecrypt (directPath peut déjà être présent). */
			if (msg.mediaData && (st.includes('ERROR') || st === 'FETCHING')) return null;
			const mockQpl = { addAnnotations() { return this; }, addPoint() { return this; } };
			try {
				const decryptedMedia = await window.require('WAWebDownloadManager').downloadManager.downloadAndMaybeDecrypt({
					directPath: msg.directPath || msg.mediaData?.fullDirectPath,
					encFilehash: msg.encFilehash,
					filehash: msg.filehash,
					mediaKey: msg.mediaKey,
					mediaKeyTimestamp: msg.mediaKeyTimestamp,
					type: msg.type,
					signal: new AbortController().signal,
					downloadQpl: mockQpl,
				});
				const data = await window.WWebJS.arrayBufferToBase64Async(decryptedMedia);
				return {
					data,
					mimetype: msg.mimetype || msg.mediaData?.mimetype_str || 'application/octet-stream',
					filename: msg.filename || undefined,
					filesize: msg.size || undefined,
				};
			} catch (e) {
				if (e && e.status && e.status === 404) return undefined;
				throw e;
			}
		}, msgId);
		return result || null;
	} catch (err) {
		console.error('❌ Page media download error:', err?.message || err);
		return null;
	}
};

/* ═══ Fallback CDN Baileys-style : extrait mediaKey+directPath du message
      wwebjs (_raw ou proto) et déchiffre depuis mmg.whatsapp.net ═══ */
const cdnFallback = async (m, raw) => {
	try {
		let info = null;

		/* Source A : wwebjs Message object — mediaKey sur l'objet, directPath dans _data */
		if (raw && raw.mediaKey && raw._data && raw._data.directPath) {
			info = {
				mediaKey: raw.mediaKey,
				directPath: raw._data.directPath,
				encFilehash: raw._data.encFilehash || null,
				mimetype: raw._data.mimetype || raw.mimetype || null,
				mediaType: contentTypeToMediaType(raw._data.type || raw.type || ''),
			};
		}

		/* Source B : raw wwebjs (_raw = objet Message interne WA proto) */
		if (!info && raw) {
			const mp = raw.message || raw;
			info = extractMediaInfo(mp);
		}

		/* Source C : le target généré par .vv (targetFromCache) —
		   le proto Baileys est dans m.msg ou m.message */
		if (!info) {
			const proto = m && m.msg ? m.msg : (m && m.message ? m.message : null);
			info = extractMediaInfo(proto);
		}

		/* Source D : tenter via le Store Puppeteer si on a un client */
		if (!info && raw && raw.client && raw.client.pupPage) {
			try {
				const msgId = raw.id?._serialized || raw.id?.id;
				if (msgId) {
					const storeInfo = await raw.client.pupPage.evaluate((msgId) => {
						try {
							const Msg = window.require('WAWebCollections')?.Msg;
							if (!Msg) return null;
							const msg = Msg.get(msgId) || null;
							if (!msg) return null;
							return {
								mediaKey: msg.mediaKey || msg.mediaData?.mediaKey || null,
								directPath: msg.directPath || msg.mediaData?.fullDirectPath || null,
								encFilehash: msg.encFilehash || null,
								type: msg.type || null,
							};
						} catch { return null; }
					}, msgId);
					if (storeInfo && storeInfo.directPath && storeInfo.mediaKey) {
						info = {
							mediaKey: storeInfo.mediaKey,
							directPath: storeInfo.directPath,
							encFilehash: storeInfo.encFilehash || null,
							mimetype: null,
							mediaType: contentTypeToMediaType(storeInfo.type || ''),
						};
					}
				}
			} catch {}
		}

		if (!info || !info.directPath || !info.mediaKey) return null;

		const mediaType = info.mediaType || 'image';
		const decryptedBuf = await downloadFromCDN(info.directPath, info.mediaKey, mediaType, info.encFilehash);
		if (!decryptedBuf || decryptedBuf.length === 0) return null;

		/* Convertir en base64 comme l'attend le pipeline wwebjs */
		const data = decryptedBuf.toString('base64');
		return {
			data,
			mimetype: info.mimetype || 'application/octet-stream',
		};
	} catch (e) {
		console.error('❌ [CDN fallback] ' + (e.message || e));
		return null;
	}
};

const sms = (conn, m) => {
	try {
		if (m.key) {
			m.id = m.key.id;
			m.chat = m.key.remoteJid;
			m.fromMe = m.key.fromMe;
			m.isGroup = m.chat.endsWith('@g.us');
			m.sender = m.fromMe
				? conn.user.id.split(':')[0] + '@s.whatsapp.net'
				: m.isGroup
					? m.key.participant
					: m.key.remoteJid;

			/* ══════════════════════════════════════════════════════════════════
			   RÉSOLUTION LID — voir cahier des charges "routing" §3 et §20.

			   RÈGLE D'OR : m.chat (destination des réponses) et m.sender
			   (identité de l'expéditeur) sont deux informations INDÉPENDANTES.
			   L'une ne doit JAMAIS servir de solution de repli pour l'autre —
			   c'est précisément ce genre de substitution qui provoquait des
			   réponses envoyées dans le chat de l'owner : pour un message
			   `fromMe` (l'owner qui écrit depuis son téléphone), m.sender vaut
			   TOUJOURS le numéro de l'owner. Un ancien fallback faisait
			   `m.chat = m.sender` dès que le LID du destinataire réel ne
			   pouvait pas être résolu → la réponse partait alors chez l'owner
			   lui-même au lieu de partir chez le contact visé.

			   Si la résolution échoue et qu'aucune correspondance fiable
			   n'existe, on ne devine RIEN : on marque le message comme
			   `_routingUnresolved` et on laisse l'appelant (index.cjs) décider
			   de ne PAS envoyer de réponse, conformément à la règle #20
			   ("mieux vaut ne pas répondre que répondre au mauvais endroit"). */
			m._routingUnresolved = false;
			if (!m._wwebjs) {
				const lidMap = global.__lidToPn || (global.__lidToPn = new Map());
				const cleanPn = (v) => (v ? String(v).replace(/@s\.whatsapp\.net$/, '') : null);
				const toPnJid = (num) => (String(num).includes('@') ? String(num) : String(num) + '@s.whatsapp.net');

				const senderPnClean = cleanPn(m.key?.senderPn);
				const participantPnClean = cleanPn(m.key?.participantPn);

				if (m.isGroup) {
					/* GROUPE : m.chat reste TOUJOURS le @g.us du groupe — jamais
					   touché par la résolution LID. Seul le participant (sender)
					   est concerné. */
					if (participantPnClean && m.key?.participant?.endsWith('@lid')) {
						lidMap.set(String(m.key.participant), participantPnClean);
					}
					if (String(m.sender).endsWith('@lid')) {
						const mapped = participantPnClean || lidMap.get(String(m.sender));
						if (mapped) m.sender = toPnJid(mapped);
						/* Pas de mapping fiable : m.sender reste en @lid (dégradation
						   gracieuse pour l'affichage/permissions), mais le CHAT du
						   groupe n'est JAMAIS remplacé — on ne route qu'à partir du
						   remoteJid du groupe. */
					}
				} else {
					/* DM : à l'origine (hors fromMe), m.chat === m.sender. On les
					   résout tous les deux depuis LA MÊME source (senderPn du
					   message reçu) — jamais l'un à partir de l'autre. */
					const pnClean = senderPnClean || participantPnClean;
					if (pnClean) {
						if (String(m.chat).endsWith('@lid')) lidMap.set(String(m.chat), pnClean);
						if (String(m.sender).endsWith('@lid')) lidMap.set(String(m.sender), pnClean);
					}

					if (String(m.chat).endsWith('@lid')) {
						const mapped = pnClean || lidMap.get(String(m.chat));
						if (mapped) {
							m.chat = toPnJid(mapped);
						} else {
							/* Aucune résolution fiable disponible : on NE DEVINE PAS
							   (ni via m.sender, ni via l'owner, ni via un dernier chat
							   connu). Le message est marqué non-routable. */
							m._routingUnresolved = true;
						}
					}
					if (!m.fromMe && String(m.sender).endsWith('@lid')) {
						const mapped = pnClean || lidMap.get(String(m.sender));
						if (mapped) m.sender = toPnJid(mapped);
					}
				}
			}

			console.log(`[ROUTING] id=${m.id} chat=${m.chat} sender=${m.sender} isGroup=${m.isGroup} fromMe=${m.fromMe} unresolved=${m._routingUnresolved}`);
		}

		if (m.message) {
			m.type = getContentType(m.message);

			m.msg =
				(m.type === 'viewOnceMessage' || m.type === 'viewOnceMessageV2')
					? m.message[m.type]?.message?.[getContentType(m.message[m.type].message)]
					: m.message[m.type];

			if (m.msg) {
				if (m.type === 'viewOnceMessage' || m.type === 'viewOnceMessageV2') m.msg.type = getContentType(m.message[m.type].message);

				const ctx = m.msg.contextInfo || {};
				const mentioned = ctx.mentionedJid || [];
				const quotedMention = ctx.participant || '';

				const mentionArray = Array.isArray(mentioned)
					? mentioned
					: typeof mentioned === 'string'
						? [mentioned]
						: [];

				if (quotedMention) mentionArray.push(quotedMention);
				m.mention = mentionArray.filter(Boolean).length > 0 ? mentionArray.filter(Boolean) : undefined;
				m.mentionUser = m.mention;

				m.body =
					m.type === 'conversation' ? m.msg :
					m.type === 'extendedTextMessage' ? m.msg.text :
					m.type === 'imageMessage' && m.msg.caption ? m.msg.caption :
					m.type === 'videoMessage' && m.msg.caption ? m.msg.caption :
					m.type === 'templateButtonReplyMessage' ? m.msg.selectedId :
					m.type === 'buttonsResponseMessage' ? m.msg.selectedButtonId :
					'';

				m.prefix = m.body.charAt(0) || '';
				m.command = m.body.slice(1).trim().split(' ')[0] || '';

				m.quoted = ctx.quotedMessage || null;

				if (m.quoted) {
					m.quoted.type = getContentType(m.quoted);
					m.quoted.id = ctx.stanzaId;
					m.quoted.sender = ctx.participant || m.sender || '';
					m.quoted.fromMe = (m.quoted.sender || '').split('@')[0] === conn.user.id.split(':')[0];

				m.quoted.msg =
					(m.quoted.type === 'viewOnceMessage' || m.quoted.type === 'viewOnceMessageV2')
						? m.quoted[m.quoted.type]?.message?.[getContentType(m.quoted[m.quoted.type].message)]
						: m.quoted[m.quoted.type];

				if (m.quoted.msg && (m.quoted.type === 'viewOnceMessage' || m.quoted.type === 'viewOnceMessageV2')) {
					m.quoted.msg.type = getContentType(m.quoted[m.quoted.type].message);
				}

					const qCtx = m.quoted.msg?.contextInfo || {};
					const qMentioned = qCtx.mentionedJid || [];
					const qParticipant = qCtx.participant || '';

					const qMentionArr = Array.isArray(qMentioned)
						? qMentioned
						: typeof qMentioned === 'string'
							? [qMentioned]
							: [];

					if (qParticipant) qMentionArr.push(qParticipant);
					m.quoted.mentionUser = qMentionArr.filter(Boolean);
					m.quoted.mention = m.quoted.mentionUser;

					m.quoted.key = {
						remoteJid: m.chat,
						fromMe: m.quoted.fromMe,
						id: m.quoted.id,
						participant: m.quoted.sender,
					};

					m.quoted.fakeObj = {
						key: m.quoted.key,
						message: m.quoted,
					};

					m.quoted.download = (filename) => downloadMediaMessage(m.quoted, filename);
					m.quoted.delete = () => conn.sendMessage(m.chat, { delete: m.quoted.fakeObj.key });
					m.quoted.react = (emoji) =>
						conn.sendMessage(m.chat, { react: { text: emoji, key: m.quoted.fakeObj.key } });
				}
			}

			m.download = (filename) => downloadMediaMessage(m, filename);
		}

		m.reply = (text, id = m.chat, option = { mentions: [m.sender] }) => {
			if (m._routingUnresolved && id === m.chat) {
				console.error(`[ROUTING-ABORT] destination non résolue (LID) — réponse NON envoyée. messageId=${m.id} remoteJid=${m.key?.remoteJid}`);
				return Promise.resolve(null);
			}
			console.log(`[ROUTING] Sending response messageId=${m.id} sendTarget=${id}`);
			return conn.sendMessage(id, { text: wrapBox(text), contextInfo: { mentionedJid: option.mentions } }, { quoted: m });
		};

		m.replyS = (sticker, id = m.chat, option = { mentions: [m.sender] }) =>
			conn.sendMessage(id, { sticker, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });

		m.replyImg = (img, text, id = m.chat, option = { mentions: [m.sender] }) =>
			conn.sendMessage(id, { image: img, caption: text ? wrapBox(text) : undefined, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });

		m.replyVid = (vid, text, id = m.chat, option = { mentions: [m.sender], gif: false }) =>
			conn.sendMessage(id, { video: vid, caption: text ? wrapBox(text) : undefined, gifPlayback: option.gif, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });

		m.replyAud = (aud, id = m.chat, option = { mentions: [m.sender], ptt: false }) =>
			conn.sendMessage(id, { audio: aud, ptt: option.ptt, mimetype: 'audio/mpeg', contextInfo: { mentionedJid: option.mentions } }, { quoted: m });

		m.replyDoc = (doc, id = m.chat, option = { mentions: [m.sender], filename: 'undefined.pdf', mimetype: 'application/pdf' }) =>
			conn.sendMessage(id, { document: doc, mimetype: option.mimetype, fileName: option.filename, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });

		m.replyContact = (name, info, number) => {
			const vcard =
				'BEGIN:VCARD\n' +
				'VERSION:3.0\n' +
				`FN:${name}\n` +
				`ORG:${info};\n` +
				`TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
				'END:VCARD';
			conn.sendMessage(m.chat, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: m });
		};

		m.react = (emoji) =>
			conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } });

		return m;
	} catch (e) {
		console.error('❌ sms error:', e);
		return m;
	}
};

module.exports = { sms, downloadMediaMessage, wrapBox, getContentType, downloadFromCDN, decryptWaMedia, extractMediaInfo, normalizeMessageContent, extractMediaFromProto, getMediaKeys: getMediaKeysSync, hkdfInfoKey, contentTypeToMediaType };