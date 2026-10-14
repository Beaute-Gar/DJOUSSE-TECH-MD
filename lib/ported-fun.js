'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDES PORTÉES DE TEDDY-XMD — familles « fun » & « weeb »
 * ──────────────────────────────────────────────────────────────────
 * Animations : happi · heart · angry · sad · shy · moon
 * Weeb       : waifu · neko · shinobu · megumin · cosplay · couplepp
 * (nikal et hand volontairement exclus : contenu vulgaire / sexuel.)
 *
 * Les animations sont le mécanisme Baileys officiel d'édition de message
 * (protocolMessage type 14) : un message est envoyé puis édité en boucle.
 * Les images weeb viennent de l'API publique api.waifu.pics (endpoints
 * SFW uniquement, sans clé, gratuite).
 * ══════════════════════════════════════════════════════════════════
 */

const ANIMS = {
  happi: { titre: 'DJOUSSE HAPPY', frames: ['😃', '😄', '😁', '😊', '😎', '🥳', '😸', '😹', '🌞', '🌈', '😃', '😄', '😁', '😊', '😎', '🥳', '😸', '😹', '🌞', '🌈', '😃', '😄', '😁', '😊'] },
  heart: { titre: 'DJOUSSE HEART', frames: ['💖', '💗', '💕', '❤️', '💛', '💚', '🫀', '💙', '💜', '🖤', '♥️', '🤍', '🤎', '💗', '💞', '💓', '💘', '💝', '♥️', '💟', '🫀', '❤️'] },
  angry: { titre: 'DJOUSSE ANGRY', frames: ['😡', '😠', '🤬', '😤', '😾', '😡', '😠', '🤬', '😤', '😾'] },
  sad: { titre: 'DJOUSSE SAD', frames: ['🥺', '😟', '😕', '😖', '😫', '🙁', '😩', '😥', '😓', '😪', '😢', '😔', '😞', '😭', '💔', '😭', '😿'] },
  shy: { titre: 'DJOUSSE SHY', frames: ['😳', '😊', '😶', '🙈', '🙊', '😳', '😊', '😶', '🙈', '🙊'] },
  moon: { titre: 'DJOUSSE MOON', frames: ['🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌚🌝'] },
};

/* Réactions anime via l'API publique otakugifs (gratuite, sans clé, SFW).
   L'API waifu.pics utilisée par TEDDY est HORS SERVICE (DNS disparu) :
   on utilise celle-ci, testée en réel. */
const REACTIONS = ['hug', 'kiss', 'cuddle', 'dance', 'pat', 'wave', 'smile', 'wink',
  'blush', 'cry', 'happy', 'facepalm', 'laugh', 'shrug', 'stare', 'thumbsup'];

const DELAI = Number(process.env.PORTED_ANIM_MS) > 0 ? Number(process.env.PORTED_ANIM_MS) : 1000;

/* état module : send injecté au register (aucun sendMessage direct) */
let sendFn = null;
const defaultSend = require('./wa-send').send;

/* joue une animation : message initial (via lib/wa-send) puis éditions */
async function playAnim(sock, jid, frames, titre, quoted) {
  const envoyer = sendFn || defaultSend;
  const sent = await envoyer(sock, jid, { text: `${titre}…` }, { quoted });
  const key = sent?.key || sent?.messages?.[0]?.key;
  for (const frame of frames) {
    await new Promise((r) => setTimeout(r, DELAI));
    try {
      await sock.relayMessage(jid, {
        protocolMessage: {
          key: { remoteJid: jid, fromMe: true, id: key?.id },
          type: 14, // 14 = editedMessage
          editedMessage: { conversation: frame },
        },
      }, {});
    } catch { /* une édition ratée ne doit pas arrêter l'animation */ }
  }
}

function registerPortedFun(cmd, deps) {
  const { config, send } = deps;
  sendFn = send;

  for (const [nom, a] of Object.entries(ANIMS)) {
    cmd(nom, {
      cat: 7, desc: `Animation « ${nom} » (message animé)`, usage: nom, icon: '✨',
    }, async (c) => {
      try {
        await playAnim(c.sock, c.from, a.frames, a.titre, c.msg);
      } catch (e) {
        await c.error([`${nom.toUpperCase()} ÉCHEC`, e.message]);
      }
    });
  }

  for (const nom of REACTIONS) {
    cmd(`a${nom}`, {
      cat: 7, desc: `Réaction anime « ${nom} » (GIF, otakugifs)`, usage: `a${nom}`, icon: '🌸',
    }, async (c) => {
      try {
        const r = await fetch(`https://api.otakugifs.xyz/gif?reaction=${nom}`, {
          headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) return c.error(['API INDISPONIBLE', String(r.status)]);
        const data = await r.json();
        if (!data?.url) return c.error(['AUCUN GIF REÇU']);
        await send(c.sock, c.from, { video: { url: data.url }, gifPlayback: true, caption: `${nom} — DJOUSSE TECH` }, { quoted: c.msg });
      } catch (e) {
        await c.error([`A${nom.toUpperCase()} ÉCHEC`, e.message]);
      }
    });
  }
}

module.exports = { registerPortedFun, ANIMS, REACTIONS, playAnim };
