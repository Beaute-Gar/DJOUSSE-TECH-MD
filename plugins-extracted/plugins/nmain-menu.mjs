import config from '../config.cjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const startTime = Date.now();

const formatRuntime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const menu = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  if (cmd !== 'menu') return;

  await m.React('📋');

  const now = Date.now();
  const runtime = formatRuntime(now - startTime);
  const user = m.sender.split('@')[0];

  /* Image du bot depuis le dossier media */
  const botImage = path.join(__dirname, '..', 'media', 'djousse.jpg');
  let profilePictureUrl = null;
  if (fs.existsSync(botImage)) {
    profilePictureUrl = botImage;
  }
  try {
    const pp = await sock.profilePictureUrl(m.sender, 'image');
    if (pp) profilePictureUrl = pp;
  } catch {}

  const menuText = `
╭━━━『 *DJOUSSE-TECH-MD* 』━━━╮
┃
┃ 👋 *Bonjour @${user}*
┃ 📡 *Runtime:* ${runtime}
┃ ⚡ *Version:* 3.0.0
┃ 🔧 *Prefix:* ${prefix}
┃ 👑 *Owner:* ${config.OWNER_NAME || 'DJOUSSSE'}
┃ 🌐 *Mode:* ${config.MODE || 'public'}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯

*╭─「 🤖 AI 」*
┃${prefix}bot
┃${prefix}gemini
┃${prefix}vision
┃${prefix}askai
┃${prefix}blackbox
┃${prefix}aiimg
┃${prefix}draw
┃${prefix}aitranslate
┃${prefix}aimemory
┃${prefix}ainoria
┃${prefix}inconnu-ai
╰─────────────❖●►

*╭─「 🎮 GAMES 」*
┃${prefix}dare
┃${prefix}truth
┃${prefix}tt
┃${prefix}quiz
┃${prefix}trivia
┃${prefix}connect4
┃${prefix}ttt
┃${prefix}economy
┃${prefix}balance
┃${prefix}daily
┃${prefix}work
┃${prefix}leaderboard
╰─────────────❖●►

*╭─「 🎌 ANIME 」*
┃${prefix}anime
┃${prefix}manga
┃${prefix}animefact
┃${prefix}animequote
┃${prefix}animequiz
┃${prefix}anigame
┃${prefix}aniroll
┃${prefix}animestyle
┃${prefix}animewallpaper
┃${prefix}animeimg
┃${prefix}megumin
┃${prefix}maid
┃${prefix}waifu2
╰─────────────❖●►

*╭─「 🛠️ TOOLS 」*
┃${prefix}calc
┃${prefix}base64
┃${prefix}dictionary
┃${prefix}translate
┃${prefix}trt
┃${prefix}fetch
┃${prefix}tts
┃${prefix}speak
┃${prefix}transcribe
┃${prefix}qrread
┃${prefix}toqr
┃${prefix}qrcode
┃${prefix}topdf
┃${prefix}pdf
┃${prefix}screenshot
┃${prefix}ss
┃${prefix}weather
┃${prefix}tempmail
┃${prefix}whois
┃${prefix}ipstalk
┃${prefix}url
┃${prefix}tourl
╰─────────────❖●►

*╭─「 📥 DOWNLOAD 」*
┃${prefix}facebook
┃${prefix}fb
┃${prefix}fbdl
┃${prefix}instagram
┃${prefix}ig
┃${prefix}tiktok
┃${prefix}mediafire
┃${prefix}mf
┃${prefix}song
┃${prefix}yts
┃${prefix}ytsearch
┃${prefix}playstore
┃${prefix}apk
┃${prefix}gitclone
┃${prefix}repo
╰─────────────❖●►

*╭─「 🔄 CONVERT 」*
┃${prefix}sticker
┃${prefix}s
┃${prefix}toimage
┃${prefix}tomp3
┃${prefix}mp3
┃${prefix}tovideo
┃${prefix}togif
┃${prefix}toaudio
┃${prefix}voicechanger
┃${prefix}enhance
┃${prefix}removebg
┃${prefix}nobg
┃${prefix}fancy
┃${prefix}font
┃${prefix}style
╰─────────────❖●►

*╭─「 👥 GROUP 」*
┃${prefix}add
┃${prefix}kick
┃${prefix}promote
┃${prefix}demote
┃${prefix}tagall
┃${prefix}hidetag
┃${prefix}tagadmin
┃${prefix}linkgc
┃${prefix}grouplink
┃${prefix}setname
┃${prefix}gname
┃${prefix}setdesc
┃${prefix}groupbio
┃${prefix}group
┃${prefix}kickall
┃${prefix}kickall2
┃${prefix}demoteall
┃${prefix}promoteall
┃${prefix}acceptall
┃${prefix}close
┃${prefix}open
┃${prefix}leave
┃${prefix}left
┃${prefix}disappear
┃${prefix}welcome
┃${prefix}setwelcome
┃${prefix}setgoodbye
┃${prefix}antisticker
┃${prefix}antibugs
╰─────────────❖●►

*╭─「 🛡️ ADMIN 」*
┃${prefix}block
┃${prefix}unblock
┃${prefix}ban
┃${prefix}unban
┃${prefix}warn
┃${prefix}unwarn
┃${prefix}warnings
┃${prefix}blacklist
┃${prefix}kick
┃${prefix}promote
┃${prefix}demote
┃${prefix}admin
┃${prefix}sudo
╰─────────────❖●►

*╭─「 📢 COMMUNICATION 」*
┃${prefix}broadcast
┃${prefix}contact
┃${prefix}vcf
┃${prefix}poll
┃${prefix}forward
┃${prefix}quote
┃${prefix}qc
┃${prefix}report
┃${prefix}bug
┃${prefix}request
╰─────────────❖●►

*╭─「 🎨 MEDIA 」*
┃${prefix}image
┃${prefix}img
┃${prefix}gimage
┃${prefix}bing
┃${prefix}texttoimg
┃${prefix}collage
┃${prefix}imagine
┃${prefix}logo
┃${prefix}ava
┃${prefix}pp
┃${prefix}getpp
┃${prefix}profile
┃${prefix}take
┃${prefix}takepic
╰─────────────❖●►

*╭─「 🎵 AUDIO 」*
┃${prefix}bass
┃${prefix}blown
┃${prefix}deep
┃${prefix}earrape
┃${prefix}fast
┃${prefix}fat
┃${prefix}nightcore
┃${prefix}reverse
┃${prefix}robot
┃${prefix}slow
┃${prefix}smooth
┃${prefix}tupai
┃${prefix}sounds
┃${prefix}shazam
┃${prefix}whatmusic
┃${prefix}lyrics
╰─────────────❖●►

*╭─「 💀 FUN 」*
┃${prefix}flirt
┃${prefix}roast
┃${prefix}insult
┃${prefix}joke
┃${prefix}fact
┃${prefix}love
┃${prefix}yesno
┃${prefix}question
┃${prefix}emix
┃${prefix}emojimix
┃${prefix}frilt
┃${prefix}zp
┃${prefix}ppcauple
┃${prefix}couples-dp
╰─────────────❖●►

*╭─「 📰 NEWS 」*
┃${prefix}news
┃${prefix}intlnews
┃${prefix}movie
╰─────────────❖●►

*╭─「 🏠 BOT 」*
┃${prefix}alive
┃${prefix}menu
┃${prefix}allmenu
┃${prefix}ping
┃${prefix}stats
┃${prefix}system
┃${prefix}uptime
┃${prefix}version
┃${prefix}owner
┃${prefix}developer
┃${prefix}repo
┃${prefix}restart
┃${prefix}config
┃${prefix}loglevel
┃${prefix}mode
┃${prefix}prefix
┃${prefix}setprefix
┃${prefix}personality
┃${prefix}about
┃${prefix}thanks
╰─────────────❖●►

*╭─「 🛡️ SECURITY 」*
┃${prefix}anticall
┃${prefix}autoblock
┃${prefix}autoreact
┃${prefix}autoread
┃${prefix}autorecording
┃${prefix}autostatus
┃${prefix}autosticker
┃${prefix}autotyping
┃${prefix}alwaysonline
┃${prefix}chatbot
┃${prefix}lydia
┃${prefix}antidelete
╰─────────────❖●►

*╭─「 🔧 OWNER 」*
┃${prefix}clonevoice
┃${prefix}cloneset
┃${prefix}clonevoicesave
┃${prefix}voiceinfo
┃${prefix}voicedel
┃${prefix}myvoice
┃${prefix}addpremium
┃${prefix}pair
┃${prefix}androidconnect
┃${prefix}androidpairing
┃${prefix}androidreset
┃${prefix}creategroup
┃${prefix}deldup
┃${prefix}confirm
┃${prefix}delall
┃${prefix}fix
┃${prefix}avt
┃${prefix}jouer
╰─────────────❖●►

*╭─「 🔍 SEARCH 」*
┃${prefix}google
┃${prefix}bing
┃${prefix}image
┃${prefix}gimage
┃${prefix}yts
┃${prefix}ytsearch
┃${prefix}githubstalk
┃${prefix}ghstalk
┃${prefix}ipstalk
┃${prefix}lookup
┃${prefix}playstore
┃${prefix}sapk
╰─────────────❖●►

*╭─「 📱 VV 」*
┃${prefix}vv
┃${prefix}vv2
┃${prefix}vv3
┃${prefix}save
┃${prefix}statussave
╰─────────────❖●►

> © DJOUSSE TECH EVOLUTION — ${Object.keys(global.__esmPlugins || []).length + (typeof commands !== 'undefined' ? commands.length : 0)} commandes chargées`;

  await sock.sendMessage(m.from, {
    image: { url: profilePictureUrl },
    caption: menuText.trim(),
    contextInfo: {
      forwardingScore: 5,
      isForwarded: true,
      mentionedJid: [m.sender],
    },
  }, { quoted: m });
};

export default menu;
