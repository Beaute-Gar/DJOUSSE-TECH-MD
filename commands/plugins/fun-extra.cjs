const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

function random(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const MOODS = {
  angry: ['😡', '🔴', '😤', '🤬', '💢'],
  happy: ['😄', '😊', '🎉', '🌟', '😁'],
  heart: ['❤️', '💖', '💕', '💗', '😍'],
  sad: ['😢', '😭', '💔', '😔', '🥺'],
  shy: ['😳', '☺️', '😊', '🙈', '🥰'],
  moon: ['🌙', '🌕', '🌑', '🌒', '⭐'],
  confused: ['🤔', '😕', '🙃', '🌀', '😵‍💫'],
};

const MOOD_TITLES = {
  angry: '💢 *HOP LÀ !*',
  happy: '🎉 *YOUHOU !*',
  heart: '💖 *AMOUR*',
  sad: '😢 *TRISTESSE*',
  shy: '🙈 *TIMIDE*',
  moon: '🌙 *BONNE NUIT*',
  confused: '🤔 *PERDU*',
};

const MOOD_TEXTS = {
  angry: (n) => `${random(MOODS.angry)} ${n || ''}, pourquoi tu me mets en colère ?!\n_Respire... c\'est bon je pardonne._ 🧘`,
  happy: (n) => `${random(MOODS.happy)} ${n || 'Toi'}, tu rends ma journée meilleure ! ✨`,
  heart: (s) => `@${s.split('@')[0]} est le meilleur ! 💕`,
  sad: (n) => `${random(MOODS.sad)} ${n || ''}, viens, je te fais un câlin virtuel. 🤗`,
  shy: (n) => `${random(MOODS.shy)} ${n || 'Toi'}, tu me fais rougir ! 😳`,
  moon: (n) => `${random(MOODS.moon)} Que la lune veille sur tes rêves, ${n || ''} ✨`,
  confused: (n) => `${random(MOODS.confused)} ${n || 'Toi'}, je suis complètement perdu là... 🌀`,
};

for (const mood of Object.keys(MOODS)) {
  cmd({ pattern: mood, desc: `Réaction ${mood}`, category: 'fun', filename: __filename }, async (conn, m) => {
    const name = m.pushName || '';
    if (mood === 'heart') {
      const text = box(MOOD_TITLES[mood], [
        { raw: MOOD_TEXTS[mood](m.sender) },
      ]);
      m.reply(text, m.chat, { mentions: [m.sender] });
      return;
    }
    m.reply(box(MOOD_TITLES[mood], [
      { raw: MOOD_TEXTS[mood](name) },
    ]));
  });
}

cmd({ pattern: 'roll', desc: 'Lancer un dé', category: 'fun', filename: __filename }, async (conn, m) => {
  const dice = Math.floor(Math.random() * 6) + 1;
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  m.reply(box('🎲 *DÉ*', [
    { label: 'Résultat', value: `${faces[dice - 1]} *${dice}*` },
    { label: 'Joueur', value: m.pushName || 'Toi' },
  ]));
});
cmd({ pattern: 'coin', desc: 'Pile ou face', category: 'fun', filename: __filename }, async (conn, m) => {
  const res = Math.random() < 0.5 ? 'PILE' : 'FACE';
  m.reply(box('🪙 *PILE OU FACE*', [
    { label: 'Résultat', value: `*${res}*` },
  ]));
});
cmd({ pattern: 'ship', desc: 'Test de compatibilité entre 2 personnes', category: 'fun', filename: __filename }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const name1 = args[0]?.replace('@', '').split('@')[0] || m.pushName || 'Toi';
  const name2 = args[1]?.replace('@', '').split('@')[0] || 'Inconnu';
  const score = Math.floor(Math.random() * 101);
  const hearts = score >= 80 ? '💖💖💖' : score >= 50 ? '💕💕' : score >= 25 ? '💔' : '💔💔💔';
  const verdict = score >= 80 ? 'Âmes sœurs ! 😍' : score >= 50 ? 'Un beau couple en devenir ! 💑' : score >= 25 ? 'Compliqués, mais pas impossible ! 😅' : 'Oubliez ça... 😬';
  m.reply(box('💘 *TEST D\'AMOUR*', [
    { raw: `👤 *${name1}* × *${name2}*` },
    { blank: true },
    { label: 'Compatibilité', value: `*${score}%*` },
    { raw: hearts },
    { blank: true },
    { raw: `💬 ${verdict}` },
  ]));
});
cmd({ pattern: 'pick', desc: 'Choisir entre plusieurs options', category: 'fun', filename: __filename }, async (conn, m) => {
  const options = m.body.split(' ').slice(1);
  if (options.length < 2) return m.reply(box('🎯 *CHOIX*', [
    { label: 'Utilisation', value: '.pick option1 option2 option3...' },
  ]));
  m.reply(box('🎯 *CHOIX*', [
    { label: 'Je choisis', value: `*${random(options)}*` },
  ]));
});
cmd({ pattern: 'rate', desc: 'Noter quelque chose sur 100', category: 'fun', filename: __filename }, async (conn, m) => {
  const text = m.body.split(' ').slice(1).join(' ') || 'ça';
  const score = Math.floor(Math.random() * 101);
  const note = score >= 80 ? 'Excellent ! 🔥' : score >= 50 ? 'Pas mal ! 👍' : score >= 25 ? 'Bof... 🤷' : 'Désolé... 😅';
  m.reply(box('📊 *NOTE*', [
    { label: 'Sujet', value: `*${text}*` },
    { label: 'Score', value: `*${score}/100*` },
    { label: 'Avis', value: note },
  ]));
});
cmd({ pattern: 'boom', desc: 'Mini animation explosion', category: 'fun', filename: __filename }, async (conn, m) => {
  m.reply(box('💥 *BOOM !*', [
    { raw: '💣💣💣' },
    { raw: '💥💥💥' },
    { raw: '🔥🔥🔥' },
    { blank: true },
    { raw: 'Tout a explosé ! 😱' },
  ]));
});
cmd({ pattern: 'bomb', desc: 'Mini animation bombe', category: 'fun', filename: __filename }, async (conn, m) => {
  m.reply(box('💣 *BOMBE LANCÉE !*', [
    { raw: '⏳ 3...' },
    { raw: '⏳ 2...' },
    { raw: '⏳ 1...' },
    { blank: true },
    { raw: '💥 BOOOM !!! 😵' },
  ]));
});
