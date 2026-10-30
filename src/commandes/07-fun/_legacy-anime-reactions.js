'use strict';

const axios = require('axios');

// otakugifs.xyz — réactions anime SFW.
// waifu.pics (ENOTFOUND) et waifu.im (ENOTFOUND) sont morts : ne pas y revenir.
const API = 'https://api.otakugifs.xyz/gif';

// Commande locale → réaction otakugifs.
// Vérifié sur /gif/allreactions : « bonk », « nod » et « baka » n'existent pas
// côté otakugifs, d'où les équivalents ci-dessous.
const REACTIONS = {
    hug:    'hug',
    kiss:   'kiss',
    pat:    'pat',
    slap:   'slap',
    poke:   'poke',
    bite:   'bite',
    bonk:   'smack',
    cuddle: 'cuddle',
    wave:   'wave',
    blush:  'blush',
    smile:  'smile',
    cry:    'cry',
    laugh:  'laugh',
    dance:  'dance',
    wink:   'wink',
    happy:  'happy',
    baka:   'mad',
    nod:    'yes',
};

const REACTION_MESSAGES = {
    hug:    (sender, target) => target ? `🤗 *${sender}* hugs *${target}*!` : `🤗 *${sender}* wants a hug!`,
    kiss:   (sender, target) => target ? `😘 *${sender}* kisses *${target}*!` : `😘 *${sender}* blows a kiss!`,
    pat:    (sender, target) => target ? `😊 *${sender}* pats *${target}*!` : `😊 *${sender}* pats the air!`,
    slap:   (sender, target) => target ? `👋 *${sender}* slaps *${target}*!` : `👋 *${sender}* slaps the air!`,
    poke:   (sender, target) => target ? `👉 *${sender}* pokes *${target}*!` : `👉 *${sender}* pokes around!`,
    bite:   (sender, target) => target ? `😬 *${sender}* bites *${target}*!` : `😬 *${sender}* bites the air!`,
    bonk:   (sender, target) => target ? `🔨 *${sender}* bonks *${target}*! Go to horny jail!` : `🔨 *${sender}* bonks!`,
    cuddle: (sender, target) => target ? `🥰 *${sender}* cuddles with *${target}*!` : `🥰 *${sender}* wants cuddles!`,
    wave:   (sender, target) => target ? `👋 *${sender}* waves at *${target}*!` : `👋 *${sender}* waves hello!`,
    blush:  (sender, _)      => `😳 *${sender}* is blushing!`,
    smile:  (sender, _)      => `😊 *${sender}* smiles!`,
    cry:    (sender, _)      => `😢 *${sender}* is crying!`,
    laugh:  (sender, _)      => `😂 *${sender}* is laughing!`,
    dance:  (sender, _)      => `💃 *${sender}* is dancing!`,
    wink:   (sender, target) => target ? `😉 *${sender}* winks at *${target}*!` : `😉 *${sender}* winks!`,
    happy:  (sender, _)      => `🎉 *${sender}* is happy!`,
    baka:   (sender, target) => target ? `😤 *${sender}* calls *${target}* a baka!` : `😤 Baka!`,
    nod:    (sender, _)      => `🙂 *${sender}* nods!`,
};

async function fetchReactionGif(reaction) {
    const resp = await axios.get(API, {
        params: { reaction, format: 'gif' },
        timeout: 10000,
    });
    return resp.data?.url;
}

module.exports = {
    commands:   Object.keys(REACTIONS),
    description: 'Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, happy, baka, nod',
    usage:      '.hug @user | .kiss @user | .pat | .cry',
    permission: 'public',
    group:      true,
    private:    true,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo, sender } = ctx;

        const rawCmd = (message.message?.extendedTextMessage?.text
            || message.message?.conversation || '').trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();

        const reaction = REACTIONS[rawCmd];
        if (!reaction) return;

        // Resolve sender display name
        const senderName = ctx.pushName || sender?.split('@')[0] || 'Someone';

        // Resolve mentioned target name
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        let targetName = null;
        if (mentionedJid) {
            try {
                const meta = await sock.groupMetadata(jid).catch(() => null);
                const participant = meta?.participants?.find(p => p.id === mentionedJid);
                targetName = participant?.notify || participant?.name || mentionedJid.split('@')[0];
            } catch {
                targetName = mentionedJid.split('@')[0];
            }
        } else if (args.length > 0 && !args[0].startsWith('@')) {
            targetName = args.join(' ');
        }

        const caption = (REACTION_MESSAGES[rawCmd] || ((s, t) => `${s} ${rawCmd}s${t ? ` ${t}` : ''}!`))(senderName, targetName);

        try {
            await sock.sendPresenceUpdate('composing', jid);
            const gifUrl = await fetchReactionGif(reaction);

            if (gifUrl) {
                const imgResp = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 15000 });
                await sock.sendMessage(jid, {
                    video:    Buffer.from(imgResp.data),
                    caption,
                    gifPlayback: true,
                    contextInfo
                }, { quoted: message });
            } else {
                await sock.sendMessage(jid, { text: caption, contextInfo }, { quoted: message });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: caption, contextInfo }, { quoted: message });
        }
    }
};
