'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * CHARGEUR DES PLUGINS SILVA-MD (222 fichiers, 1431 commandes)
 * ──────────────────────────────────────────────────────────────────
 * Les plugins silva sont chargés tels quels depuis plugins/silva/ puis
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

/* Plugins qui écoutent les ÉVÉNEMENTS du socket : refusés.
   Raison : index.js écoute déjà (messages.upsert, presence.update, call…).
   Deux écoutes du même événement = doubles réponses et conflits. */
const LISTENER_RE = /(?:sock|zk|sock\.|\bclient)\s*\.\s*ev\s*\.\s*on\s*\(|\.ev\s*\.\s*on\s*\(\s*['"`](?:messages\.upsert|presence\.update|call|creds\.update|connection\.update|message)/;

/* Déduction de catégorie DJOUSE (1..11) par mots-clés */
const MAP_CAT = [
  { cat: 3, rx: /(antilink|antibad|antifake|antiflood|antispam|antibot|antidelete|antivv|anticall|antidemote|antigm|antiscam|autojoin|autobio|antifake|guard)/i },
  { cat: 2, rx: /(group|groupe|admin|kick|promote|demote|tagall|hidetag|welcome|bye|mute|lock|unlock|invite)/i },
  { cat: 4, rx: /(sticker|stkr|s\b|take|toimg|toaudio|tts|emojimix|photo|image|media|vv|viewonce|gif)/i },
  { cat: 6, rx: /(ai\b|gemini|gpt|chatgpt|openai|bot|imagine|lydia|talk)/i },
  { cat: 7, rx: /(game|jeu|play|quiz|trivia|truth|dare|tictactoe|hangman|riddle|8ball|coin|roll|dice|slot|ship|rate|joke|fun|meme|couple|emojimix)/i },
  { cat: 9, rx: /(owner|sudo|setvar|allvar|setprefix|broadcast|eval|exec|shell|restart|update|vars)/i },
  { cat: 11, rx: /(play|music|song|spotify|ytmp3|ytmp4|video|download|dl|mediafire|apk|tiktok|ig\b|facebook)/i },
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
          let contenu = content;
          if (contenu && typeof contenu.text === 'string') {
            contenu = { ...contenu, text: normaliserStyle(contenu.text, style) };
          }
          try { return await send(sock, jid, contenu, opts); }
          catch { return t.sendMessage(jid, contenu, opts); } // repli brut
        };
      }
      const v = t[prop];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

/* Normalisation du style d'un texte tiers vers la charte DJOUSSE.
   On ne touche PAS au contenu utile : seuls les messages d'erreur et de
   succès sont encadrés dans le style maison (renderError / renderSuccess),
   ce sont ceux qui se voient le plus. Le reste passe en texte propre. */
function normaliserStyle(txt, style) {
  if (!style || typeof txt !== 'string') return txt;
  const t = txt.trim();
  if (!t) return txt;

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
  return txt.replace(/\*([^*\n]{2,40})\*/g, '$1').replace(/`([^`\n]{2,40})`/g, '$1');
}

/* Adapte le run() d'un plugin silva au ctx DJOUSE */
function adapterRun(plugin, send, config, style) {
  return async (ctx) => {
    const wrapped = wrapSock(ctx.sock, send, style);
    const args = Array.isArray(ctx.args) ? ctx.args : [];
    const extra = {
      sender: ctx.sender,
      groupId: ctx.isGroup ? ctx.from : null,
      contextInfo: ctx.msg?.message?.extendedTextMessage?.contextInfo || {},
      isOwner: !!ctx.isOwner,
      isAdmin: !!ctx.isAdmin,
      from: ctx.from,
      reply: ctx.reply,
      prefix: config.prefix,
      body: ctx.q || args.join(' '),
      args,
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
function loadSilvaPlugins(cmd, deps) {
  const { config, send, dir, exists, style } = deps;
  const cible = dir || path.join(process.cwd(), 'plugins', 'silva');
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
      const desc = String(def.description || def.desc || '').slice(0, 120);
      const cat = deduireCat(names.join(' '), desc, f);
      const owner = /owner|sudo/i.test(String(def.permission || ''));
      const admin = /admin/i.test(String(def.permission || ''));
      const groupOnly = !!def.group;
      const runAdapte = adapterRun(def, send, config, style);
      const noms = [...names, ...aliasesRaw]
        .filter((n) => typeof n === 'string' && n.trim())
        .map((n) => n.trim().toLowerCase())
        /* RÈGLE DE SÉCURITÉ : pas d'arme anti-compte ni de contenu interdit,
           même présente dans un plugin silva. */
        .filter((n) => !INTERDITS.test(n))
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
      const p = require(path.join(rapport.dir || path.join(process.cwd(), 'plugins', 'silva'), f));
      const names = p.commands || p.command || [];
      const al = p.aliases || p.alias || [];
      n += (Array.isArray(names) ? names.length : 1) + (Array.isArray(al) ? al.length : 0);
    } catch {}
  }
  return n;
}

module.exports = { loadSilvaPlugins, INTERDITS, deduireCat, wrapSock, normaliserStyle };
