/* PONT TRANS-GROUPE — DJOUSSE-TECH-MD
   Le bot n'est PAS dans le groupe :
   - ignore toutes les discussions normales
   - répond UNIQUEMENT aux commandes autorisées (.menu, .help, .ping…)
   - .addbot fournit le lien d'invitation (ou indique si déjà présent) */

const CONFIG = {
  allowedCommands: [
    '.menu', '.help', '.ping', '.alive', '.jid', '.time', '.date',
    '.system', '.diagnostic', '.total', '.addbot',
  ],
  prefix: '.',
  responseDelay: 500,
  rateLimit: 5,
};

/* Numéro brut d'un jid (LID ou vrai numéro, avec ou sans :device) */
const normNum = (jid) => {
  const s = String(jid || '');
  if (!s || s === 'undefined') return '';
  return s.split('@')[0].split(':')[0].replace(/\D/g, '');
};

class CrossGroupBridge {
  constructor() {
    this.rateLimits = new Map();
    this.groupCache = new Map();
    this.botName = process.env.BOT_NAME || 'DJOUSSE-TECH';
  }

  /* API appelée par index.cjs pour chaque message de groupe.
     Retourne true = message géré (réponse ou silence), false = gestion normale du bot. */
  async detectAndRespond(sock, m, msg) {
    const chat = m && m.chat;
    if (!String(chat || '').endsWith('@g.us')) return false;
    const text = String(m.body || '').trim();
    if (!text) return false;
    if (msg?.key?.fromMe) return false;

    /* Le bot est-il membre du groupe ? Si oui → gestion normale (modération, commandes) */
    const botIn = await this.isBotInGroup(sock, chat);
    if (botIn) return false;

    /* Le bot n'est PAS dans le groupe → réponse UNIQUEMENT aux commandes autorisées */
    const command = text.split(' ')[0].toLowerCase();
    if (!CONFIG.allowedCommands.includes(command.toLowerCase())) {
      /* Commandes du jeu supprimé et autres qui exigent la présence du bot → explication claire */
      const gameOnly = ['.startgame', '.school', '.game', '.choice', '.mission', '.house', '.rank', '.karma', '.gamehelp'];
      if (gameOnly.includes(command)) {
        try {
          await sock.sendMessage(chat, { text: '❌ Le jeu École du Bien et du Mal a été supprimé.\n\n💡 Tapez `.menu` pour voir les commandes disponibles.' });
        } catch {}
        return true;
      }
      console.log(`🚫 Groupe sans bot, ignoré: ${text.slice(0, 40)}… (${chat})`);
      return true;
    }

    if (!this.checkRateLimit(chat)) {
      try { await sock.sendMessage(chat, { text: `⏳ *Rate Limit*\n🔄 Le bot répond à ${CONFIG.rateLimit} commandes par minute.\n⏱️ Patientez quelques secondes.` }); } catch {}
      return true;
    }

    await new Promise(r => setTimeout(r, CONFIG.responseDelay));
    const cmdName = command.substring(CONFIG.prefix.length).toLowerCase();
    console.log(`🌉 Commande ${command} reçue de ${chat} (bot absent du groupe)`);
    await this.handleCommand(sock, chat, cmdName, msg);
    return true;
  }

  async handleCommand(sock, chat, command, msg) {
    try {
      switch (command) {
        case 'menu': await sock.sendMessage(chat, { text: this.getMenu() }); break;
        case 'help': await sock.sendMessage(chat, { text: this.getHelp() }); break;
        case 'ping': {
          const start = Date.now();
          await sock.sendMessage(chat, { text: `🏓 *Pong !*\n📡 Latence: ${Date.now() - start}ms\n💡 Je ne suis pas dans ce groupe` });
          break;
        }
        case 'alive': {
          const up = process.uptime();
          await sock.sendMessage(chat, { text: `✅ *${this.botName}-MD v2.1.0*\n\n📡 Statut: 🟢 En ligne\n🕐 Uptime: ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m\n💾 RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n💡 Je ne suis pas dans ce groupe` });
          break;
        }
        case 'jid': {
          const userJid = msg?.key?.participant || msg?.key?.remoteJid;
          await sock.sendMessage(chat, { text: `🆔 *Votre JID*\n\n${userJid}\n\n💡 Je ne suis pas dans ce groupe` });
          break;
        }
        case 'time':
          await sock.sendMessage(chat, { text: `🕐 *Heure actuelle*\n\n${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala' })}\n\n💡 Je ne suis pas dans ce groupe` });
          break;
        case 'date':
          await sock.sendMessage(chat, { text: `📅 *Date actuelle*\n\n${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n💡 Je ne suis pas dans ce groupe` });
          break;
        case 'system': {
          const up = process.uptime();
          await sock.sendMessage(chat, { text: `📊 *Statistiques système*\n\n💾 RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n🕐 Uptime: ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m\n\n💡 Je ne suis pas dans ce groupe` });
          break;
        }
        case 'diagnostic': {
          const up = process.uptime();
          let groups = 0;
          try { groups = Object.keys(await sock.groupFetchAllParticipating()).length; } catch {}
          await sock.sendMessage(chat, { text: `📊 *Diagnostic complet*\n\n✅ Statut: En ligne\n📡 Socket: Open\n👥 Groupes: ${groups}\n💾 RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n🕐 Uptime: ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m\n🔹 Commandes: 47 essentielles\n\n💡 Je ne suis pas dans ce groupe` });
          break;
        }
        case 'total':
          await sock.sendMessage(chat, { text: `📊 *Total des commandes*\n\n📚 321 commandes disponibles\n🔹 47 dans le menu réduit\n🔸 274 automatiques\n\n💡 Je ne suis pas dans ce groupe` });
          break;
        case 'addbot': await this.addbot(sock, chat, msg); break;
        default:
          await sock.sendMessage(chat, { text: `⚠️ *Commande inconnue*\n\n📝 Tapez .menu pour voir les commandes` });
      }
    } catch (e) {
      console.error('❌ Bridge réponse:', e.message);
    }
  }

  /* .addbot — invite le bot dans le groupe si possible, sinon donne les instructions */
  async addbot(sock, chat, msg) {
    try {
      const botJid = sock.user?.id || '';
      const metadata = await sock.groupMetadata(chat).catch(() => null);
      const already = metadata?.participants?.some(p => String(p.id).split(':')[0] === String(botJid).split(':')[0]);
      if (already) {
        return await sock.sendMessage(chat, { text: '🤖 Je suis déjà dans ce groupe !\n📚 Tapez .menu pour voir les commandes.' });
      }
      let invite = '';
      try { invite = (await sock.groupInviteCode(chat)) ? 'https://chat.whatsapp.com/' + await sock.groupInviteCode(chat) : ''; } catch {}
      if (invite) {
        return await sock.sendMessage(chat, { text: `✅ *INVITATION PRÊTE*\n\n🔗 ${invite}\n\n🔹 Ajoutez le bot via ce lien (le bot doit être admin du groupe).\n📚 En attendant, je réponds à .menu, .ping, .time…` });
      }
      await sock.sendMessage(chat, { text: `🤖 *POUR M'AJOUTER:*\n\n1. Ajoutez le numéro du bot comme membre\n2. Rendez-le ADMIN (obligatoire pour mes fonctions groupe)\n3. Tapez .menu pour voir mes capacités\n\n💡 Je continue de répondre aux commandes (.menu, .ping, .time…) même hors du groupe.` });
    } catch (e) {
      try { await sock.sendMessage(chat, { text: '❌ Erreur addbot: ' + e.message }); } catch {}
    }
  }

  getMenu() {
    const up = process.uptime();
    const ram = Math.round(process.memoryUsage().rss / 1024 / 1024);
    return `👋 *${this.botName}-MD v2.1.0*\n` +
      `╭───『 📋 MENU RÉDUIT 』───●●►\n` +
      `┃ *📡 Uptime:* ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m\n` +
      `┃ *💾 RAM:* ${ram} MB\n` +
      `┃ *⚡ Commandes:* 47 essentielles\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 🏠 PRINCIPALES 」*\n` +
      `┃❖ .ping - Latence\n┃❖ .alive - Statut\n┃❖ .menu - Ce menu\n┃❖ .help - Aide\n┃❖ .jid - Mon ID\n┃❖ .time - Heure\n┃❖ .date - Date\n┃❖ .system - Stats\n┃❖ .diagnostic - Diagnostique\n┃❖ .total - Total commandes\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 🧮 MATH & CONVERSION 」*\n` +
      `┃❖ .calc - Calculatrice\n┃❖ .convert - Convertir\n┃❖ .base64 - Base64\n┃❖ .morse - Morse\n┃❖ .qrcode - QR Code\n┃❖ .shorturl - Raccourcir\n┃❖ .passgen - Mot de passe\n┃❖ .color - Couleur\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 🤖 IA & RECHERCHE 」*\n` +
      `┃❖ .ai - IA conversationnelle\n┃❖ .ask - Poser une question\n┃❖ .imagine - Générer image\n┃❖ .translate - Traduire\n┃❖ .google - Recherche\n┃❖ .movie - Film\n┃❖ .news - Actualités\n┃❖ .yts - Vidéos\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 🎨 MÉDIAS 」*\n` +
      `┃❖ .sticker - Sticker\n┃❖ .toimg - Sticker → Image\n┃❖ .waifu - Waifu\n┃❖ .animeimg - Anime\n┃❖ .quote - Citation\n┃❖ .tts - Text-to-Speech\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 👥 GROUPES 」*\n` +
      `┃❖ .tagall - @all\n┃❖ .setpp - Photo\n┃❖ .setname - Nom\n┃❖ .setwelcome - Bienvenue\n┃❖ .setgoodbye - Au revoir\n┃❖ .poll - Sondage\n┃❖ .addbot - Ajouter le bot\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 ⚙️ ADMIN 」*\n` +
      `┃❖ .config - Configuration\n┃❖ .mode - Mode\n┃❖ .prefix - Préfixe\n┃❖ .personality - Personnalité\n┃❖ .restart - Redémarrer\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 ⚡ ASTUCES 」*\n` +
      `┃ *🌉 Communication Trans-Groupe*\n` +
      `┃   - Je réponds SEULEMENT aux commandes\n` +
      `┃   - Les discussions normales sont ignorées\n` +
      `┃   - Tapez .menu pour ce menu\n` +
      `┃   - .addbot pour m'ajouter au groupe\n` +
      `╰─────────────❖●►\n\n` +
      `*╭─「 ᴀɪɴᴏʀɪᴀ ᴀɪ 」*\n` +
      `┃ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴅᴊᴏᴜꜱꜱᴇ ᴛᴇᴄʜ*\n` +
      `╰──────────❖✦►\n\n` +
      `> © ᴅᴇᴠᴇʟᴏᴘᴇʀ ʙʏ DJOUSSE TECH\n\n` +
      `*💡 Je ne suis pas dans ce groupe.*\n*🔹 Pour m'ajouter: .addbot*`;
  }

  getHelp() {
    return `📚 *Aide ${this.botName}-MD*\n\n` +
      `📌 .ping - Latence\n📌 .alive - Statut\n📌 .menu - Menu\n📌 .help - Cette aide\n📌 .jid - Votre ID\n📌 .time - Heure\n📌 .date - Date\n📌 .system - Stats système\n📌 .diagnostic - Diagnostique\n📌 .total - Total commandes\n\n` +
      `📌 .calc - Calculatrice\n📌 .convert - Convertir\n📌 .base64 - Base64\n📌 .qrcode - QR Code\n📌 .shorturl - Raccourcir\n📌 .passgen - Mot de passe\n\n` +
      `📌 .ai - IA conversationnelle\n📌 .ask - Question\n📌 .imagine - Image IA\n📌 .translate - Traduire\n📌 .google - Recherche\n📌 .movie - Film\n📌 .news - Actualités\n\n` +
      `📌 .sticker - Sticker\n📌 .waifu - Waifu\n📌 .quote - Citation\n📌 .tts - Text-to-Speech\n\n` +
      `📌 .tagall - Mentionner tous\n📌 .setpp - Photo\n📌 .setname - Nom\n📌 .setwelcome - Bienvenue\n📌 .poll - Sondage\n📌 .addbot - Ajouter le bot\n\n` +
      `💡 *Je ne réponds qu'aux commandes dans ce groupe.*\n🔹 Pour m'ajouter: .addbot`;
  }

  async isBotInGroup(sock, groupId) {
    if (this.groupCache.has(groupId)) return this.groupCache.get(groupId);
    try {
      const metadata = await sock.groupMetadata(groupId);
      const participants = metadata?.participants || [];
      /* Le bot peut être identifié par vrai numéro, LID ou me — couvre Baileys 6.7 */
      const botNums = new Set();
      for (const cand of [sock.user?.id, sock.user?.me, sock.user?.lid, sock.user?.verifiedName]) {
        const n = normNum(cand);
        if (n) botNums.add(n);
      }
      const inGroup = participants.some(p => botNums.has(normNum(p.jid)) || botNums.has(normNum(p.id)));
      this.groupCache.set(groupId, inGroup);
      setTimeout(() => this.groupCache.delete(groupId), inGroup ? 600000 : 60000);
      return inGroup;
    } catch {
      /* Incertitude réseau → traiter comme présent (gestion normale des commandes) */
      this.groupCache.set(groupId, true);
      setTimeout(() => this.groupCache.delete(groupId), 60000);
      return true;
    }
  }

  /* Invalidation du cache quand le bot rejoint/quitte un groupe */
  invalidate(groupId) {
    this.groupCache.delete(groupId);
  }

  checkRateLimit(groupId) {
    const now = Date.now();
    if (!this.rateLimits.has(groupId)) this.rateLimits.set(groupId, []);
    const recent = this.rateLimits.get(groupId).filter(t => now - t < 60000);
    if (recent.length >= CONFIG.rateLimit) return false;
    recent.push(now);
    this.rateLimits.set(groupId, recent);
    return true;
  }
}

module.exports = new CrossGroupBridge();