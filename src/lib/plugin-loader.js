'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * CHARGEUR DES PLUGINS TIERS — dossier plugins/core/ (ex-code Silva MD,
 * conservé tel quel : l'attribution complète est dans NOTICE)
 * ──────────────────────────────────────────────────────────────────
 * Les plugins tiers sont chargés tels quels depuis plugins/core/ puis
 * ADAPTÉS au registre DJOUSE (cmd()) :
 *   · leur export ({ commands:[…], run }) devient une commande DJOUSE ;
 *   · leur contexte (sock, message, args, {sender, groupId}) est adapté ;
 *   · leurs envois sont ROUTÉS via lib/wa-send.js par un proxy — la règle
 *     « envois centralisés » reste vraie à l'exécution, même si le code
 *     source des plugins tiers appelle sock.sendMessage.
 *
 * ROBUSTESSE : un plugin illisible, en échec de chargement ou sans export
 * valide est IGNORÉ avec un log — jamais le bot entier.
 *
 * SÉCURITÉ : les commandes interdites (crash / arme anti-compte / NSFW)
 * ne sont PAS enregistrées, même présentes dans un plugin silva.
 * ══════════════════════════════════════════════════════════════════
 */
const fs = require('fs');
const path = require('path');

/* Commandes refusées (règle de sécurité, non négociable) */
const INTERDITS = /^(loccrash|crashbug|amountbug|pmbug|delaybug|docubug|unlimitedbug|bombug|lagbug|trollybug|terminate|hentai|hwaifu|trap|hneko|hentaivid|blowjobs|waifues|bug|crash|hack|xcrash)$/i;

/* BLOQUES IDENTITÉ / SÉCURITÉ — garde-fou DU CHARGEUR (les fichiers
   sources concernés ont été supprimés, les commandes bloquées restent
   interdites par sécurité — filet anti-réintroduction) :
   · getcode/lend (+alias) : réclamaient un code de pairage à un serveur
     TIERS (session.silvatech.co.ke) en y envoyant des numéros de
     téléphone → fuite de données + session hors de notre contrôle.
     L'API de jumelage locale du projet (lib/pairing-api.js) fait le
     même travail sans rien externaliser.
   · silvatech/svrepo/… : parcouraient les dépôts d'un autre auteur.
   · call : panneau de support d'un tiers (réseaux sociaux tierces +
     numéro WhatsApp personnel). Notre .support maison le remplace. */
const BLOQUES_IDENTITE = /^(getcode|paircode|getpair|sessioncode|connectbot|lend|approvelend|rejectlend|lendlist|lendstatus|revokelend|silvatech|silvarepos|silvafiles|svrepo|call)$/i;

/* Fichiers dont les commandes restent JOIGNABLES en direct mais sortent
   des menus : l'assistant garde son nom historique en alias (ne rien
   casser chez les utilisateurs) — la porte d'entrée visible est .ia
   (maison), le nom principal est .djousse. */
const HORS_MENUS = { 'agent.js': true };

/* Plugins qui écoutent les ÉVÉNEMENTS du socket : refusés.
   Raison : index.js écoute déjà (messages.upsert, presence.update, call…).
   Deux écoutes du même événement = doubles réponses et conflits. */
const LISTENER_RE = /(?:sock|zk|sock\.|\bclient)\s*\.\s*ev\s*\.\s*on\s*\(|\.ev\s*\.\s*on\s*\(\s*['"`](?:messages\.upsert|presence\.update|call|creds\.update|connection\.update|message)/;

/* Déduction de catégorie DJOUSE (1..11) par mots-clés.
   Le motif s'applique au nom + description + NOM DE FICHIER (« …​.js ») :
   tout motif court doit être borné, sinon « s\b » par exemple matcherait le
   « s » de « .js » et basculerait toutes les commandes en cat. 4. */
const MAP_CAT = [
  { cat: 7, rx: /(anime|waifu|neko|reaction)/i },
  { cat: 3, rx: /(antilink|antibad|antifake|antiflood|antispam|antibot|antidelete|antivv|anticall|antidemote|antigm|antiscam|autojoin|autobio|guard)/i },
  { cat: 2, rx: /(group|groupe|admin|kick|promote|demote|tagall|hidetag|welcome|bye|mute|lock|unlock|invite)/i },
  { cat: 4, rx: /(sticker|stkr|(^|\W)s(\W|$)|\btake\b|toimg|toaudio|tomp3|topng|\btts\b|emojimix|photo|image|media|\bvv\b|viewonce|\bgif\b|album|smeme|removebg|screenshot)/i },
  { cat: 6, rx: /(ai\b|gemini|gpt|chatgpt|openai|\bbot\b|imagine|lydia|\btalk\b)/i },
  { cat: 11, rx: /(play|music|song|spotify|ytmp3|ytmp4|video|download|\bdl\b|mediafire|\bapk\b|tiktok|ig\b|facebook|twitter|snapchat|pinterest|reddit|threads|soundcloud|capcut|torrent|shorts|youtu)/i },
  { cat: 7, rx: /(game|jeu|quiz|trivia|truth|dare|tictactoe|hangman|riddle|8ball|\bcoin\b|\broll\b|\bdice\b|\bslot\b|\bship\b|\brate\b|joke|\bfun|meme|couple|anime|waifu|neko|\bhug\b|\bpat\b|\bslap\b|\bkiss\b|\bpoke\b|cuddle|fact|roast|advice|affirm|horoscope|fortune|\bpoem\b|pickup|compliment|insult|wouldyou|neverhave)/i },
  { cat: 9, rx: /(owner|sudo|setvar|allvar|setprefix|broadcast|eval|exec|shell|restart|update|vars)/i },
  { cat: 8, rx: /(search|find|wiki|google|imdb|lyrics|define|translate|urban|npm|github|weather|news)/i },
  { cat: 10, rx: /(afk|notes|todo|reminder|remind|timer|base64|hash|encode|decode|calc|convert|qr|short|paste|tempmail|password)/i },
];
function deduireCat(nom, desc, fichier) {
  const s = `${nom} ${desc} ${fichier}`;
  for (const m of MAP_CAT) if (m.rx.test(s)) return m.cat;
  return 5; // OUTILS par défaut
}

/* Proxy d'envoi : tout sendMessage d'un plugin tiers passe par wa-send,
   ET son style est normalisé dans le style DJOUSE (cadre + alphabet). */
function wrapSock(sock, send, style) {
  return new Proxy(sock, {
    get(t, prop) {
      if (prop === 'sendMessage') {
        return async (jid, content, opts) => {
          const contenu = normaliserContenu(content, style);
          try { return await send(sock, jid, contenu, opts); }
          catch { return t.sendMessage(jid, contenu, opts); } // repli brut
        };
      }
      const v = t[prop];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

/* Marque tierce des plugins silva (« Powered by Silva MD », « Silva Tech
   Inc », « I'm *Silva* »…) → identité maison. Un SEUL endroit : tout
   texte/légende qui sort d'un plugin tiers passe par ici. */
const NOM_MAISON = 'DJOUSSE-TECH-MD';
function retirerSignatureTierce(txt, nom) {
  if (typeof txt !== 'string' || !txt) return txt;
  const n = nom || NOM_MAISON;
  /* CASSE SENSIBLE volontairement : la marque tierce est toujours
     capitalisée (« Silva », « Silva MD », « SilvaTech »…), alors que les
     RÉFÉRENCES DE COMMANDES sont en minuscules (`"silva play <song>"`).
     On réécrit donc la marque sans casser l'aide des commandes. */
  return txt
    /* ── 1. URLs tierces → destinations officielles AVANT toute marque
       (sinon il resterait des liens cassés vers l'ancien écosystème) ── */
    .replace(/https?:\/\/(?:www\.)?github\.com\/SilvaTechB\/silva-md-bot\/?/gi,
      'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD')
    .replace(/(?:https?:\/\/)?(?:session\.)?(?:www\.)?silvatech\.co\.ke\/?/gi,
      'https://djousse-tech-md.vercel.app')
    .replace(/https?:\/\/(?:www\.)?whatsapp\.com\/channel\/0029VaksrRh6GcGnT0J05n0j\/?/gi,
      'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD')
    .replace(/https?:\/\/chat\.whatsapp\.com\/GzCZZxVnAHMINWdPQkGwJR\/?/gi,
      'https://djousse-tech-md.vercel.app')
    .replace(/https?:\/\/wa\.me\/254700143167(?:\/\S*)?/gi,
      'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD/issues')
    /* ── 2. restes d'ancienne identité (cas stricte : les références de
       commandes en minuscules — « silva play », « silvatech repos » —
       restent intactes, cf. test loader-style) ── */
    .replace(/silva-md-bot/g, 'DJOUSSE-TECH-MD')
    .replace(/Silvatech/g, 'DJOUSSE TECH')
    .replace(/\bSILVA\b/g, 'DJOUSSE-TECH-MD')
    /* ── 3. marque tierce historique ── */
    .replace(/Silva\s*Tech\s*Inc\.?/g, 'DJOUSSE TECH')
    .replace(/SILVA\s*TECH\s*INC\.?/g, 'DJOUSSE TECH')
    .replace(/SilvaTechB/g, n)
    .replace(/Silva\s*Tech\b/g, 'DJOUSSE TECH')
    .replace(/Silva\s*MD\b/g, n)
    .replace(/SILVA\s*MD\b/g, n)
    .replace(/\bSilva\b/g, n);
}

/* ── Identité : logo officiel maison ────────────────────────────────
   Les plugins tierces utilisent en repli un logo hébergé par un
   tiers (« SILVA MD », filigrane Meta AI). On réécrit cette URL
   unique vers NOTRE logo (icône officielle du site, mêmes URL et
   hébergeur que l'ancien) : un seul point de vérité, les 11 plugins
   concernés restent intacts. */
const URL_LOGO_TIERCE = 'https://files.catbox.moe/5uli5p.jpeg';
const URL_LOGO_OFFICIEL = 'https://files.catbox.moe/h6zdty.png';

function remplacerLogoTierce(url) {
  return typeof url === 'string' && url.includes(URL_LOGO_TIERCE)
    ? URL_LOGO_OFFICIEL
    : url;
}

/* Normalise un contenu d'envoi : le TEXTE passe par la charte complète
   (erreur/succès encadrés), les LÉGENDES ne reçoivent que le nettoyage de
   marque tierce (pas de cadre dans une légende d'image). */
function normaliserContenu(content, style) {
  if (!content || typeof content !== 'object') return content;
  let c = content;
  if (typeof c.text === 'string') c = { ...c, text: normaliserStyle(c.text, style) };
  if (typeof c.caption === 'string') {
    c = { ...c, caption: retirerSignatureTierce(c.caption, style && style.botName) };
  }
  /* logo : l'ancien repli tierce est réécrit vers le logo officiel
     (image d'envoi directe + vignette externalAdReply des liens) */
  if (c.image && typeof c.image.url === 'string') {
    c = { ...c, image: { ...c.image, url: remplacerLogoTierce(c.image.url) } };
  }
  const ext = c.contextInfo && c.contextInfo.externalAdReply;
  if (ext && typeof ext.thumbnailUrl === 'string') {
    c = {
      ...c,
      contextInfo: {
        ...c.contextInfo,
        externalAdReply: { ...ext, thumbnailUrl: remplacerLogoTierce(ext.thumbnailUrl) },
      },
    };
  }
  return c;
}

/* Normalisation du style d'un texte tiers vers la charte DJOUSSE.
   On ne touche PAS au contenu utile : seuls les messages d'erreur et de
   succès sont encadrés dans le style maison (renderError / renderSuccess),
   ce sont ceux qui se voient le plus. Le reste passe en texte propre. */
function normaliserStyle(txt, style) {
  if (!style || typeof txt !== 'string') return txt;
  const propre = retirerSignatureTierce(txt, style.botName);
  const t = propre.trim();
  if (!t) return propre;

  /* les 3 premières lignes servent au diagnostic */
  const debut = t.slice(0, 120).toLowerCase();

  /* ERREUR : préfixes usuels + mots-clés anglais des plugins */
  const estErreur = /^(?:❌|⚠|🚫|⛔|✖|error|erreur|failed|échec)/i.test(t)
    || /(?:not found|invalid|unavailable|erreur|error|failed|please|must |required|usage|try again)/i.test(debut);
  if (estErreur) {
    const lignes = t.split('\n').map((l) => l.replace(/\*([^*\n]+)\*/g, '$1').trim()).filter(Boolean).slice(0, 6);
    if (lignes.length && typeof style.renderError === 'function') return style.renderError(lignes);
  }

  /* SUCCÈS */
  const estSucces = /^(?:✅|☑|✔|done|success|succès|correct|completed|saved|added|removed|sent|updated|created)/i.test(t);
  if (estSucces) {
    const lignes = t.split('\n').map((l) => l.replace(/\*([^*\n]+)\*/g, '$1').trim()).filter(Boolean).slice(0, 6);
    if (lignes.length && typeof style.renderSuccess === 'function') return style.renderSuccess(lignes);
  }

  /* sinon : on nettoie juste le markdown lourd des plugins (*Trash* → Trash) */
  return propre.replace(/\*([^*\n]{2,40})\*/g, '$1').replace(/`([^`\n]{2,40})`/g, '$1');
}

/* Adapte le run() d'un plugin silva au ctx DJOUSE.
   Le 4e argument est le contexte attendu par les plugins silva
   (`const { jid, reply, safeSend, … } = ctx`). On fournit TOUTES les clés
   qu'ils déstructurent réellement, sinon `safeSend is not a function`. */
function adapterRun(plugin, send, config, style, deps = {}) {
  return async (ctx) => {
    const wrapped = wrapSock(ctx.sock, send, style);
    const args = Array.isArray(ctx.args) ? ctx.args : [];
    const ci = ctx.msg?.message?.extendedTextMessage?.contextInfo
      || ctx.msg?.message?.imageMessage?.contextInfo
      || {};
    const nettoyer = (t) => (typeof t === 'string' ? retirerSignatureTierce(t, config.botName) : t);
    const envoyer = (contenu, opts) => wrapped.sendMessage(ctx.from, contenu, opts);
    const extra = {
      /* identité / cible du chat */
      jid: ctx.from,
      chat: ctx.from,
      chatId: ctx.from,
      from: ctx.from,
      sender: ctx.sender,
      senderNum: ctx.senderNum,
      groupId: ctx.isGroup ? ctx.from : null,
      pushName: ctx.msg?.pushName || '',
      /* objet du message & médias */
      message: ctx.msg,
      m: ctx.msg,
      quoted: ctx.msg,
      contextInfo: ci,
      mentionedJid: ci.mentionedJid || [],
      groupMetadata: null, // les plugins retombent sur sock.groupMetadata(jid)
      download: deps.download,
      /* envoi (toujours routé via lib/wa-send.js par le proxy) */
      sock: wrapped,
      socket: wrapped,
      safeSend: envoyer,
      send: envoyer,
      reply: (txt, mentions) => ctx.reply(nettoyer(txt), mentions),
      react: ctx.react,
      /* style / config maison */
      prefix: config.prefix,
      config,
      botName: config.botName,
      isOwner: !!ctx.isOwner,
      isAdmin: !!ctx.isAdmin,
      isGroup: !!ctx.isGroup,
      isBotAdmin: !!ctx.isBotAdmin,
      theme: {
        admin: '⛔ COMMANDE RÉSERVÉE AUX ADMINISTRATEURS DU GROUPE.',
        botAdmin: '⛔ IL FAUT QUE JE SOIS ADMINISTRATEUR DU GROUPE.',
        owner: '⛔ COMMANDE RÉSERVÉE AU PROPRIÉTAIRE DU BOT.',
      },
      body: ctx.q || args.join(' '),
      args,
      /* Commande invoquée (transmise par executeCommand) — les plugins
         tiers qui dispatchent sur `command` en dépendent. */
      command: ctx.command,
    };
    await plugin.run(wrapped, ctx.msg, args, { ...extra, ...extraExtra(ctx) });
  };
}
/* certains plugins déstructurent d'autres clés : on complète sans écraser */
function extraExtra(ctx) {
  return {
    isGroup: !!ctx.isGroup,
    isBotAdmin: !!ctx.isBotAdmin,
    senderNum: ctx.senderNum,
    quoted: ctx.msg,
    m: ctx.msg,
    q: ctx.q,
    text: ctx.q,
  };
}

/* ══════════ chargement ══════════ */
function loadCorePlugins(cmd, deps) {
  const { config, send, dir, exists, style, download } = deps;
  const cible = dir || path.join(process.cwd(), 'src', 'plugins', 'core');
  const rapport = { charges: 0, ignores: 0, commandes: 0, echecs: [], fichiers: [] };
  if (!fs.existsSync(cible)) return rapport;
  const fichiers = fs.readdirSync(cible).filter((f) => f.endsWith('.js')).sort();
  for (const f of fichiers) {
    const fp = path.join(cible, f);
    let src;
    try {
      src = fs.readFileSync(fp, 'utf8');
    } catch {
      rapport.ignores += 1;
      rapport.echecs.push(`${f}: illisible`);
      continue;
    }
    /* ── REFUS : un plugin qui écoute les événements du socket créerait
       une deuxième écoute de messages.upsert / presence.update / call…,
       donc des réponses en double. Ce n'est pas négociable. ── */
    if (LISTENER_RE.test(src)) {
      rapport.ignores += 1;
      rapport.echecs.push(`${f}: pose des listeners d'événements (refusé — index.js écoute déjà)`);
      continue;
    }
    let plugin;
    try {
      plugin = require(fp);
    } catch (e) {
      rapport.ignores += 1;
      rapport.echecs.push(`${f}: chargement (${String(e.message).slice(0, 60)})`);
      continue;
    }
    /* formes d'export acceptées */
    let defs = null;
    if (typeof plugin === 'function') defs = [{ run: plugin, commands: [] }];
    else if (Array.isArray(plugin)) defs = plugin;                       // [{commands, run}, …]
    else if (plugin && typeof plugin === 'object') defs = [plugin];      // {commands, run}
    else defs = [];

    for (const def of defs) {
      if (!def || typeof def !== 'object') continue;
      const run = def.run || def.execute || def.handler;
      const names = def.commands || def.command || [];
      const aliasesRaw = def.aliases || def.alias || [];
      if (!run || (typeof run !== 'function') || !Array.isArray(names) || !names.length) {
        rapport.ignores += 1;
        rapport.echecs.push(`${f}: export incompatible`);
        continue;
      }
      /* desc nettoyée ICI : c'est elle qui s'affiche dans les menus */
      const desc = retirerSignatureTierce(
        String(def.description || def.desc || '').slice(0, 120),
        config && config.botName,
      );
      const cat = HORS_MENUS[f] ? 99 : deduireCat(names.join(' '), desc, f);
      const owner = /owner|sudo/i.test(String(def.permission || ''));
      const admin = /admin/i.test(String(def.permission || ''));
      const groupOnly = !!def.group;
      const runAdapte = adapterRun(def, send, config, style, { download });
      const noms = [...names, ...aliasesRaw]
        .filter((n) => typeof n === 'string' && n.trim())
        .map((n) => n.trim().toLowerCase())
        /* RÈGLE DE SÉCURITÉ : pas d'arme anti-compte ni de contenu interdit,
           même présente dans un plugin silva. */
        .filter((n) => !INTERDITS.test(n))
        /* SÉCURITÉ/IDENTITÉ : serveur de session tiers, dépôts d'un autre
           auteur, support tiers — voir BLOQUES_IDENTITE. */
        .filter((n) => !BLOQUES_IDENTITE.test(n))
        /* PAS D'ÉCRASEMENT : si le nom existe déjà (commande maison, ou
           commande protégée hacktools en cat 99), la version existante
           gagne. Le chargeur ne remplace jamais notre code. */
        .filter((n) => !(exists && exists(n)));
      if (!noms.length) { rapport.ignores += 1; rapport.echecs.push(`${f}: commandes déjà présentes ou filtrées`); continue; }
      try {
        cmd(noms, {
          cat, desc: desc || 'Commande silva', usage: noms[0],
          owner: owner || undefined, admin: admin || undefined,
          group: groupOnly || undefined,
        }, runAdapte);
        rapport.charges += 1;
        rapport.commandes += noms.length;
        if (!rapport.fichiers.includes(f)) rapport.fichiers.push(f);
      } catch (e) {
        rapport.ignores += 1;
        rapport.echecs.push(`${f}: enregistrement (${String(e.message).slice(0, 60)})`);
      }
    }
  }
  return rapport;
}

/* Compte les commandes réellement enregistrées depuis silva */
function compterSilva(rapport) {
  let n = 0;
  for (const f of rapport.fichiers) {
    try {
      const p = require(path.join(rapport.dir || path.join(process.cwd(), 'src', 'plugins', 'silva'), f));
      const names = p.commands || p.command || [];
      const al = p.aliases || p.alias || [];
      n += (Array.isArray(names) ? names.length : 1) + (Array.isArray(al) ? al.length : 0);
    } catch {}
  }
  return n;
}

module.exports = {
  loadCorePlugins, INTERDITS, BLOQUES_IDENTITE, HORS_MENUS, deduireCat,
  wrapSock, normaliserStyle, normaliserContenu, retirerSignatureTierce,
  remplacerLogoTierce, URL_LOGO_TIERCE, URL_LOGO_OFFICIEL,
};
