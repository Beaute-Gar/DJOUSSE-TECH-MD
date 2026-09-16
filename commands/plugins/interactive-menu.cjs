'use strict';

const { cmd } = require('../command.cjs');
const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

// ─── Helper : bouton Native Flow ─────────────────────────────────
function createButton(name, params) {
    return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
        name,
        buttonParamsJson: JSON.stringify(params)
    });
}

// ─── Helper : envoyer un menu interactif ──────────────────────────
async function sendInteractiveMenu(conn, jid) {
    const msg = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({
            text: '┏━⍟「 ☣ DJOUSSE TECH ☣ 」⍟━┓\n┃\n┃ WhatsApp transporte l\'information.\n┃ 🧠 DJOUSSE TECH la comprend.\n┃\n┃ Choisis une fonction ci-dessous.\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟'
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: '© DJOUSSE TECH EVOLUTION' }),
        header: proto.Message.InteractiveMessage.Header.create({
            title: 'DJOUSSE TECH',
            subtitle: 'Intelligence • Automation • WhatsApp',
            hasMediaAttachment: false
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            messageParamsJson: '',
            buttons: [
                createButton('quick_reply', { display_text: '🧠 AINORIA', id: 'djousse:ainoria' }),
                createButton('quick_reply', { display_text: '🛡️ GUARDIAN', id: 'djousse:guardian' }),
                createButton('quick_reply', { display_text: '📊 STATUS', id: 'djousse:status' }),
                createButton('single_select', {
                    title: '📋 Ouvrir le menu',
                    sections: [{
                        title: 'DJOUSSE TECH',
                        rows: [
                            { title: '🧠 AINORIA', description: 'Assistant intelligent', id: 'djousse:ainoria' },
                            { title: '💾 MÉMOIRE', description: 'Gérer tes informations', id: 'djousse:memory' },
                            { title: '🛡️ SÉCURITÉ', description: 'Guardian protection', id: 'djousse:guardian' },
                            { title: '👥 GROUPES', description: 'Gestion des groupes', id: 'djousse:groups' },
                            { title: '📱 STATUT', description: 'Outils de statut', id: 'djousse:status' },
                            { title: '⚙️ PARAMÈTRES', description: 'Configuration', id: 'djousse:settings' },
                            { title: '👑 DJOUSSE OS', description: 'Centre de contrôle', id: 'djousse:os' }
                        ]
                    }]
                })
            ]
        })
    });

    const waMsg = generateWAMessageFromContent(jid, { interactiveMessage: msg }, { userJid: conn.user?.id });
    await conn.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    return waMsg;
}

// ─── Sous-menu AINORIA ───────────────────────────────────────────
async function sendAinoriaMenu(conn, jid) {
    const msg = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({
            text: '┏━⍟「 ☣ AINORIA ☣ 」⍟━┓\n┃\n┃ 🧠 Le cerveau de DJOUSSE TECH\n┃\n┃ Que veux-tu faire ?\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟'
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: '© DJOUSSE TECH' }),
        header: proto.Message.InteractiveMessage.Header.create({ title: 'AINORIA', subtitle: 'Le cerveau', hasMediaAttachment: false }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            messageParamsJson: '',
            buttons: [
                createButton('quick_reply', { display_text: '💬 Poser une question', id: 'ainoria:ask' }),
                createButton('single_select', {
                    title: '🧠 Mémoire',
                    sections: [{
                        title: 'AINORIA',
                        rows: [
                            { title: '💾 Voir ma mémoire', description: 'Informations mémorisées', id: 'ainoria:memory' },
                            { title: '➕ Mémoriser', description: 'Ajouter une info', id: 'ainoria:remember' },
                            { title: '🗑️ Oublier', description: 'Supprimer une info', id: 'ainoria:forget' },
                            { title: '↩️ Menu principal', description: 'Retour', id: 'djousse:menu' }
                        ]
                    }]
                })
            ]
        })
    });

    const waMsg = generateWAMessageFromContent(jid, { interactiveMessage: msg }, { userJid: conn.user?.id });
    await conn.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    return waMsg;
}

// ─── Sous-menu OUTILS ────────────────────────────────────────────
async function sendToolsMenu(conn, jid) {
    const msg = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({
            text: '┏━⍟「 ☣ OUTILS ☣ 」⍟━┓\n┃\n┃ Sélectionne un outil.\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟'
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: '© DJOUSSE TECH' }),
        header: proto.Message.InteractiveMessage.Header.create({ title: 'OUTILS', subtitle: 'Outils WhatsApp', hasMediaAttachment: false }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            messageParamsJson: '',
            buttons: [
                createButton('single_select', {
                    title: '🛠️ Choisir',
                    sections: [{
                        title: 'Outils',
                        rows: [
                            { title: '🎨 Sticker', description: 'Créer un sticker', id: 'tools:sticker' },
                            { title: '📥 Télécharger', description: 'Télécharger un média', id: 'tools:download' },
                            { title: '🔎 Recherche', description: 'Recherche Internet', id: 'tools:search' },
                            { title: '↩️ Menu principal', description: 'Retour', id: 'djousse:menu' }
                        ]
                    }]
                })
            ]
        })
    });

    const waMsg = generateWAMessageFromContent(jid, { interactiveMessage: msg }, { userJid: conn.user?.id });
    await conn.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    return waMsg;
}

// ─── Extraire l'ID du bouton cliqué ──────────────────────────────
function getInteractiveId(m) {
    if (!m?.message) return null;

    // Native Flow response (Baileys 7)
    const interactiveResponse = m.message.interactiveResponseMessage;
    if (interactiveResponse) {
        const params = interactiveResponse.nativeFlowResponseMessage?.paramsJson;
        if (params) {
            try {
                const parsed = JSON.parse(params);
                return parsed.id || parsed.selected_id || parsed.button_id || null;
            } catch (_) {}
        }
    }

    // Anciennes réponses boutons
    const buttonResponse = m.message.buttonsResponseMessage;
    if (buttonResponse?.selectedButtonId) return buttonResponse.selectedButtonId;

    // List response
    const listResponse = m.message.listResponseMessage;
    if (listResponse?.singleSelectReply?.selectedRowId) return listResponse.singleSelectReply.selectedRowId;

    return null;
}

// ─── Les fonctions sont exportées pour le handler interactif dans index.cjs ───
// Pas de cmd() ici — le menu texte est géré par menu-hacker.cjs
module.exports = { sendInteractiveMenu, sendAinoriaMenu, sendToolsMenu, getInteractiveId };
