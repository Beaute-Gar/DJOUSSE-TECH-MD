const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const VV_CAPTION = `╭───『 DJOUSSE TECH 』───●●►
┃ 🔓 *VUE UNIQUE INTERCEPTÉE*
┃ ┃ ⚡ Média récupéré avec succès
┃ ┃ 🛡️ Protection : activée
┃ ┃ 💀 Accès : compromis
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

cmd({
    pattern: 'vv',
    alias: ['sendme', 'viewonce', 'vu', 'once'],
    react: '👻',
    desc: 'Récupérer un média vue-unique et le renvoyer dans la discussion',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { from, reply }) => {
    try {
        const quoted = m.quoted;
        if (!quoted) {
            return reply(box('VV', [
                '❌ Réponds à un message vue-unique avec .vv',
                '',
                '📌 Usage: .vv (répondre à un view-once)'
            ]));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let mediaData;
        try {
            mediaData = await quoted.download();
        } catch (err) {
            return reply(boxWithFooter('ERREUR', [{ raw: `❌ Échec du téléchargement: ${err.message}` }]));
        }

        const messageType = quoted.mtype || 'textMessage';
        const caption = VV_CAPTION;
        let forwardData = {};

        switch (messageType) {
            case 'imageMessage':
                forwardData = {
                    image: mediaData,
                    caption,
                    mimetype: quoted.mimetype || 'image/jpeg'
                };
                break;
            case 'videoMessage':
                forwardData = {
                    video: mediaData,
                    caption,
                    mimetype: quoted.mimetype || 'video/mp4'
                };
                break;
            case 'audioMessage':
                forwardData = {
                    audio: mediaData,
                    mimetype: 'audio/mp4',
                    ptt: quoted.ptt || false
                };
                break;
            case 'stickerMessage':
                forwardData = { sticker: mediaData };
                break;
            case 'documentMessage':
                forwardData = {
                    document: mediaData,
                    mimetype: quoted.mimetype || 'application/octet-stream',
                    fileName: quoted.fileName || 'document'
                };
                break;
            default:
                return reply(boxWithFooter('ERREUR', [{ raw: '❌ Type de média non supporté' }]));
        }

        await conn.sendMessage(from, forwardData, { quoted: m });
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('VV ERROR:', error);
        return reply(boxWithFooter('ERREUR', [{ raw: `❌ Erreur: ${error.message}` }]));
    }
});

cmd({
    pattern: 'tovv',
    alias: ['toviewonce'],
    react: '📥',
    desc: 'Convertir un média cité en vue-unique',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { from, reply }) => {
    try {
        const quoted = m.quoted;
        if (!quoted) {
            return reply(box('TOVV', [
                '❌ Réponds à un média avec .tovv',
                '',
                '📌 Usage: .tovv (image/vidéo/audio)'
            ]));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let mediaData;
        try {
            mediaData = await quoted.download();
        } catch (err) {
            return reply(boxWithFooter('ERREUR', [{ raw: `❌ Échec du téléchargement: ${err.message}` }]));
        }

        const messageType = quoted.mtype || 'textMessage';
        let forwardData = {};

        switch (messageType) {
            case 'imageMessage':
                forwardData = {
                    image: mediaData,
                    caption: quoted.text || '',
                    mimetype: quoted.mimetype || 'image/jpeg',
                    viewOnce: true
                };
                break;
            case 'videoMessage':
                forwardData = {
                    video: mediaData,
                    caption: quoted.text || '',
                    mimetype: quoted.mimetype || 'video/mp4',
                    viewOnce: true
                };
                break;
            case 'audioMessage':
                forwardData = {
                    audio: mediaData,
                    mimetype: 'audio/mp4',
                    ptt: quoted.ptt || false,
                    viewOnce: true
                };
                break;
            default:
                return reply(boxWithFooter('ERREUR', [{ raw: '❌ Seuls image, vidéo et audio sont supportés.' }]));
        }

        await conn.sendMessage(from, forwardData, { quoted: m });
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('TOVV ERROR:', error);
        return reply(boxWithFooter('ERREUR', [{ raw: `❌ Erreur: ${error.message}` }]));
    }
});
