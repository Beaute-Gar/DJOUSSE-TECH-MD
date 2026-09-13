const axios = require('axios');

const CONFIG = {
  groupName: process.env.GROUP_NAME || 'DJOUSSE-TECH COMMUNITY',
  groupDescription: process.env.GROUP_DESCRIPTION ||
    '🤖 Groupe géré par DJOUSSE-TECH-MD\n' +
    '💡 Le bot est l\'unique administrateur\n' +
    '🔹 Discussions, débats et partages',
  aiProvider: process.env.AI_PROVIDER || 'groq',
  aiApiKey: process.env.AI_API_KEY || process.env.GROQ_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'openai/gpt-oss-120b',
  ttsProvider: process.env.TTS_PROVIDER || 'google',
  settings: { addMembers: false, editGroupInfo: false, leaveGroup: false, sendMessages: true },
};

class GroupCreator {
  constructor(sock) {
    this.sock = sock;
    this.groupId = null;
    this.members = [];
    this.isActive = false;
    this.debateInterval = null;
    this.activityInterval = null;
    this.lastActivity = Date.now();
    this.debateHistory = [];
  }

  async getAllMembers() {
    try {
      console.log('🔍 Parcours des groupes WhatsApp...');
      const groups = await this.sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups || {});
      console.log(`📊 ${groupIds.length} groupes trouvés`);
      const allMembers = new Set();
      const selfJids = new Set([String(this.sock.user?.id || '').split(':')[0]]);
      if (this.sock.user?.lid) selfJids.add(String(this.sock.user.lid).split(':')[0]);
      for (const [groupId, groupInfo] of Object.entries(groups || {})) {
        try {
          const participants = groupInfo?.participants || [];
          for (const p of participants) {
            const jid = String(p?.jid || p?.id || '').split(':')[0];
            if (!selfJids.has(jid)) allMembers.add(jid);
          }
        } catch (e) { console.error('❌ groupe ' + groupId + ':', e.message); }
      }
      this.members = Array.from(allMembers);
      console.log(`✅ ${this.members.length} membres uniques récupérés`);
      return this.members;
    } catch (e) {
      console.error('❌ Récupération membres:', e.message);
      return [];
    }
  }

  async createGroup() {
    try {
      const members = await this.getAllMembers();
      if (members.length === 0) return null;
      const participants = members.slice(0, 500);
      /* Création VIDE puis ajouts par lots: un groupCreate massif tue le stream
         (xml-not-well-formed / 500 / Connection Closed) — WhatsApp coupe la connexion */
      const group = await this.sock.groupCreate(CONFIG.groupName, []);
      const groupId = group?.id || group;
      console.log('✅ Groupe créé (vide): ' + groupId);
      await new Promise(r => setTimeout(r, 3000));
      const BATCH = 50;
      let added = 0;
      for (let i = 0; i < participants.length; i += BATCH) {
        const batch = participants.slice(i, i + BATCH);
        try {
          await this.sock.groupParticipantsUpdate(groupId, batch, 'add');
          added += batch.length;
          console.log(`➕ Membres ajoutés: ${added}/${participants.length}`);
        } catch (e) {
          console.error(`❌ Lot ${Math.floor(i / BATCH) + 1} (${batch.length} membres):`, e.message);
        }
        await new Promise(r => setTimeout(r, 2500));
      }
      await this.sock.groupUpdateDescription(groupId, CONFIG.groupDescription).catch(() => {});
      await this.lockGroupSettings(groupId);
      this.groupId = groupId;
      this.isActive = true;
      await this.sendWelcomeMessage();
      this.startAutomations();
      return { groupId, members: added, totalMembers: members.length };
    } catch (e) {
      console.error('❌ Création groupe:', e.message);
      return null;
    }
  }

  async fillGroup(groupId) {
    try {
      global.__groupDiag = { stage: 'scan', at: new Date().toISOString(), error: null };
      const members = await this.getAllMembers();
      const meta = await this.sock.groupMetadata(groupId).catch(() => null);
      const current = new Set((meta?.participants || []).map(p => String(p?.jid || p?.id || '').split(':')[0]));
      const toAdd = members.filter(j => !current.has(j));
      await this.sock.groupUpdateDescription(groupId, CONFIG.groupDescription).catch(() => {});
      global.__groupDiag = { stage: 'add', total: toAdd.length, current: current.size, at: new Date().toISOString(), error: null };
      console.log(`🔄 Remplissage ${groupId}: ${members.length} uniques, ${current.size} déjà présents, ${toAdd.length} à ajouter`);
      if (toAdd.length === 0) return { added: 0, total: members.length };
      const BATCH = 50;
      let added = 0;
      for (let i = 0; i < toAdd.length; i += BATCH) {
        const batch = toAdd.slice(i, i + BATCH);
        let ok = false;
        let lastErr = '';
        for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
          const update = this.sock.groupParticipantsUpdate(groupId, batch, 'add').catch(e => { if (attempt === 3) console.error('⏰ rejet tardif du lot:', e.message); });
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 20s (promesse pendue)')), 20000));
          try {
            await Promise.race([update, timeout]);
            ok = true;
            added += batch.length;
            global.__groupDiag = { stage: 'add', progress: `${added}/${toAdd.length}`, at: new Date().toISOString(), error: null };
            console.log(`➕ Membres ajoutés: ${added}/${toAdd.length}`);
          } catch (e) {
            lastErr = e.message;
            console.error(`❌ Lot ${Math.floor(i / BATCH) + 1} (${batch.length} membres) essai ${attempt}:`, e.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 5000));
          }
        }
        if (!ok) global.__groupDiag = { stage: 'add', progress: `${added}/${toAdd.length}`, at: new Date().toISOString(), error: `lot ${Math.floor(i / BATCH) + 1} -> ${lastErr}` };
        await new Promise(r => setTimeout(r, 2500));
      }
      return { added, total: members.length };
    } catch (e) {
      global.__groupDiag = { stage: 'fill-error', at: new Date().toISOString(), error: e.message };
      console.error('❌ Remplissage:', e.message);
      return null;
    }
  }

  async lockGroupSettings(groupId) {
    try {
      await this.sock.groupSettingUpdate(groupId, 'not_announcement').catch(() => {});
      await this.sock.groupSettingUpdate(groupId, 'locked').catch(() => {});
      console.log('🔒 Paramètres verrouillés');
      await this.sock.sendMessage(groupId, {
        text: '🔒 *Paramètres du groupe verrouillés*\n\n' +
          '🤖 Le bot est l\'unique administrateur.\n\n' +
          '❌ *Restrictions:*\n• Ajout de membres: ❌ Désactivé\n• Modification du nom: ❌ Désactivé\n\n' +
          '✅ *Autorisé:*\n• Envoyer des messages\n• Participer aux discussions',
      });
    } catch (e) { console.error('❌ Verrouillage:', e.message); }
  }

  async sendWelcomeMessage() {
    try {
      const welcome = '👋 *Bienvenue dans ' + CONFIG.groupName + ' !*\n\n' +
        '🤖 Je suis *DJOUSSE-TECH-MD*, votre administrateur.\n\n' +
        '📊 *Statistiques du groupe:*\n• 👥 Membres: ' + this.members.length +
        '\n• 📅 Créé le: ' + new Date().toLocaleDateString('fr-FR') + '\n\n' +
        '💡 *Règles:*\n• 🔹 Le bot est l\'unique administrateur\n• 🔹 Les paramètres sont verrouillés\n• 🔹 Profitez des discussions !\n\n' +
        '📝 Tapez *.menu* pour voir les commandes.';
      await this.sock.sendMessage(this.groupId, { text: welcome });
      await this.sendVoiceMessage(this.groupId, 'Bienvenue dans ' + CONFIG.groupName + '. Je suis votre administrateur automatique.').catch(() => {});
    } catch (e) { console.error('❌ Bienvenue:', e.message); }
  }

  async generateDebate() {
    try {
      const topics = [
        'Technologie: L\'IA va-t-elle remplacer les humains ?',
        'Philosophie: Le bonheur est-il une quête ou un état ?',
        'Société: Les réseaux sociaux nous rapprochent-ils ou nous éloignent-ils ?',
        'Économie: Le télétravail est-il l\'avenir ?',
        'Écologie: Peut-on encore sauver la planète ?',
        'Éducation: L\'école est-elle encore adaptée ?',
        'Santé: Le bien-être mental est-il plus important que le physique ?',
        'Culture: La diversité culturelle est-elle une richesse ?',
      ];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      let text = '🎯 *Débat du jour*\n\n📢 ' + topic + '\n\n💬 *Questions pour réfléchir:*\n• Qu\'en pensez-vous ?\n• Partagez votre expérience !';
      if (CONFIG.aiApiKey) {
        try {
          const ai = await this.callAI('Génère un débat structuré avec 3 questions stimulantes sur: ' + topic);
          if (ai) text = ai;
        } catch (e) { console.error('❌ IA:', e.message); }
      }
      await this.sock.sendMessage(this.groupId, { text });
      await this.sendVoiceMessage(this.groupId, topic).catch(() => {});
      this.debateHistory.push({ topic, date: new Date().toISOString(), text });
      console.log('📢 Débat envoyé: ' + topic.slice(0, 50) + '...');
    } catch (e) { console.error('❌ Débat:', e.message); }
  }

  async callAI(prompt) {
    try {
      const ainoria = require('../../lib/ainoria.cjs');
      const sys = 'Tu es un animateur de débat WhatsApp. Réponds en français, concis et engageant.';
      const result = await ainoria.chat(prompt, { system: sys, temperature: 0.9 });
      return result || null;
    } catch (e) {
      console.error('❌ callAI:', e.message);
      return null;
    }
  }

  async sendVoiceMessage(groupId, text) {
    try {
      const { voiceWithMusic } = require('../../lib/voice.cjs');
      const audio = await voiceWithMusic(String(text || ''));
      if (!audio) return;
      await this.sock.sendMessage(groupId, { audio, mimetype: 'audio/mpeg', ptt: true });
      console.log('🎵 Message vocal envoyé');
    } catch (e) { console.error('❌ Voice:', e.message); }
  }

  async generateAudio(text) {
    try {
      if (CONFIG.ttsProvider === 'google' && text) {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(text) + '&tl=fr&client=tw-ob';
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        return Buffer.from(response.data);
      }
      return null;
    } catch (e) {
      console.error('❌ TTS:', e.message);
      return null;
    }
  }

  startAutomations() {
    this.debateInterval = setInterval(() => this.generateDebate(), 6 * 60 * 60 * 1000);
    this.activityInterval = setInterval(() => {
      if (Date.now() - this.lastActivity > 30 * 60 * 1000) {
        this.lastActivity = Date.now();
        this.generateDebate();
      }
    }, 15 * 60 * 1000);
    console.log('✅ Automatisations démarrées');
  }

  async handleMessage(msg) {
    try {
      const from = msg.key?.remoteJid;
      if (from !== this.groupId) return;
      const text = this.extractText(msg.message);
      if (!text || msg.key?.fromMe) return;
      this.lastActivity = Date.now();
      if (this.isGreeting(text)) return this.replyToGreeting(msg, from);
      if (this.isQuestion(text)) return this.replyToQuestion(msg, from, text);
      if (this.isDebateRequest(text)) return this.generateDebate();
    } catch (e) { console.error('❌ handleMessage:', e.message); }
  }

  isGreeting(text) { return ['bonjour', 'salut', 'hello', 'hey', 'coucou'].some(g => String(text).toLowerCase().includes(g)); }
  isQuestion(text) { return String(text).includes('?') || ['pourquoi', 'comment', 'quand', 'où', 'qui', 'que'].some(q => String(text).toLowerCase().includes(q)); }
  isDebateRequest(text) {
    const t = String(text).toLowerCase();
    return t.includes('débat') || t.includes('sujet') || t === '!debate' || t === '!debate ';
  }

  async replyToGreeting(msg, from) {
    const name = msg.pushName || 'Utilisateur';
    const responses = [
      '👋 *Bonjour ' + name + ' !*\nBienvenue dans le groupe ! 🎉',
      '👋 *Salut ' + name + ' !*\nHeureux de vous voir ! 🌟',
      '👋 *Hello ' + name + ' !*\nÇa va aujourd\'hui ? 😊',
    ];
    await this.sock.sendMessage(from, { text: responses[Math.floor(Math.random() * responses.length)] });
  }

  async replyToQuestion(msg, from, text) {
    if (CONFIG.aiApiKey) {
      try {
        const r = await this.callAI('Réponds brièvement à cette question: ' + text);
        if (r) return await this.sock.sendMessage(from, { text: r });
      } catch (e) {}
    }
    await this.sock.sendMessage(from, {
      text: '🤔 *Question intéressante !*\n\n💡 ' + text + '\n\n📢 Je propose d\'en discuter ensemble.\n🔹 Que pensez-vous de ce sujet ?',
    });
  }

  extractText(message) {
    if (!message) return '';
    return message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption || '';
  }

  stop() {
    if (this.debateInterval) { clearInterval(this.debateInterval); this.debateInterval = null; }
    if (this.activityInterval) { clearInterval(this.activityInterval); this.activityInterval = null; }
    this.isActive = false;
    console.log('⏹️ Automatisations arrêtées');
  }
}

module.exports = GroupCreator;