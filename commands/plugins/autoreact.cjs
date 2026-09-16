'use strict';

const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');


/**
 * ============================================================
 * DJOUSSE TECH — AUTO REACT STATUS
 * ============================================================
 *
 * Activation :
 *   .autoreact
 *   .statusreact
 *   .ar
 *
 * Fonctionnement :
 *
 * - Surveille les nouveaux événements WhatsApp
 * - Détecte les statuts
 * - Peut réagir aux statuts des autres
 * - Peut réagir aux propres statuts
 * - Choisit UN emoji aléatoire
 * - Respecte le délai configuré
 * - Évite les doublons
 * - Affiche toutes les étapes dans la console
 *
 * ============================================================
 */


/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const DEFAULT_EMOJIS = [
    '❤️',
    '🔥',
    '😍',
    '😂',
    '👏',
    '💯',
    '✨'
];

const DEFAULT_DELAY = 1200;


/**
 * Statuts déjà traités
 */
const processedStatuses = new Map();


/**
 * Statuts actuellement en traitement
 */
const processingStatuses = new Set();


/**
 * Connexions ayant déjà reçu notre listener.
 *
 * WeakSet évite d'ajouter plusieurs fois
 * le même listener lorsque .autoreact est exécuté
 * plusieurs fois.
 */
const initializedConnections = new WeakSet();


/**
 * ============================================================
 * UTILITAIRES
 * ============================================================
 */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * ============================================================
 * RÉCUPÉRER LES EMOJIS
 * ============================================================
 */

function getEmojis() {

    if (Array.isArray(config.AUTO_REACT_EMOJIS)) {

        const emojis = config.AUTO_REACT_EMOJIS
            .filter(e => typeof e === 'string')
            .map(e => e.trim())
            .filter(Boolean);

        if (emojis.length > 0) {
            return emojis;
        }
    }

    return DEFAULT_EMOJIS;
}


/**
 * ============================================================
 * RÉCUPÉRER LE DÉLAI
 * ============================================================
 */

function getDelay() {

    const delay = Number(
        config.AUTO_REACT_DELAY
    );

    if (
        Number.isFinite(delay) &&
        delay >= 300
    ) {
        return delay;
    }

    return DEFAULT_DELAY;
}


/**
 * ============================================================
 * STATUT ACTIVÉ ?
 * ============================================================
 */

function isAutoReactEnabled() {

    return (
        config.AUTO_STATUS_REACT === true ||
        config.AUTO_STATUS_REACT === 'true' ||
        config.AUTO_STATUS_REACT === 1 ||
        config.AUTO_STATUS_REACT === '1'
    );
}


/**
 * ============================================================
 * EMOJI ALÉATOIRE
 * ============================================================
 */

function getRandomEmoji() {

    const emojis = getEmojis();

    if (!emojis.length) {
        return '❤️';
    }

    const index = Math.floor(
        Math.random() * emojis.length
    );

    return emojis[index];
}


/**
 * ============================================================
 * NETTOYAGE
 * ============================================================
 */

function cleanupCache() {

    const now = Date.now();

    const expiration =
        30 * 60 * 1000;

    for (
        const [id, timestamp]
        of processedStatuses.entries()
    ) {

        if (
            now - timestamp >
            expiration
        ) {

            processedStatuses.delete(id);
        }
    }
}


/**
 * ============================================================
 * TRAITEMENT D'UN STATUT
 * ============================================================
 */

async function autoReactStatus(
    conn,
    statusMessage
) {

    try {

        if (!conn) {

            console.error(
                '[AUTO-REACT] ❌ Connexion absente'
            );

            return false;
        }


        if (!statusMessage?.key) {

            console.log(
                '[AUTO-REACT] ⚠️ Événement sans clé WhatsApp'
            );

            return false;
        }


        const key =
            statusMessage.key;


        /**
         * ====================================================
         * VÉRIFICATION STATUT
         * ====================================================
         */

        if (
            key.remoteJid !==
            'status@broadcast'
        ) {

            return false;
        }


        const messageId =
            key.id;


        if (!messageId) {

            console.log(
                '[AUTO-REACT] ⚠️ Statut sans ID'
            );

            return false;
        }


        /**
         * ====================================================
         * DOUBLON
         * ====================================================
         */

        if (
            processedStatuses.has(
                messageId
            )
        ) {

            console.log(
                `[AUTO-REACT] ⏭️ Déjà traité : ${messageId}`
            );

            return false;
        }


        if (
            processingStatuses.has(
                messageId
            )
        ) {

            console.log(
                `[AUTO-REACT] ⏳ Déjà en traitement : ${messageId}`
            );

            return false;
        }


        processingStatuses.add(
            messageId
        );


        cleanupCache();


        /**
         * ====================================================
         * INFORMATIONS
         * ====================================================
         */

        const emoji =
            getRandomEmoji();

        const delay =
            getDelay();


        console.log('');
        console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        );

        console.log(
            '[AUTO-REACT] 👀 STATUT DÉTECTÉ'
        );

        console.log(
            `[AUTO-REACT] 🆔 ID : ${messageId}`
        );

        console.log(
            `[AUTO-REACT] 👤 fromMe : ${key.fromMe ? 'OUI' : 'NON'}`
        );

        console.log(
            `[AUTO-REACT] 📍 remoteJid : ${key.remoteJid}`
        );

        console.log(
            `[AUTO-REACT] 😊 Emoji choisi : ${emoji}`
        );

        console.log(
            `[AUTO-REACT] ⏱️ Délai : ${delay} ms`
        );


        /**
         * ====================================================
         * ATTENTE
         * ====================================================
         */

        await sleep(delay);


        console.log(
            '[AUTO-REACT] 📤 Envoi de la réaction...'
        );


        /**
         * ====================================================
         * RÉACTION
         * ====================================================
         */

        const result =
            await conn.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: key
                    }
                }
            );


        /**
         * ====================================================
         * SUCCÈS
         * ====================================================
         */

        processedStatuses.set(
            messageId,
            Date.now()
        );


        console.log(
            `[AUTO-REACT] ✅ Réaction envoyée : ${emoji}`
        );

        console.log(
            `[AUTO-REACT] 🆔 Statut traité : ${messageId}`
        );

        console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        );
        console.log('');


        return {
            success: true,
            emoji,
            messageId,
            result
        };


    } catch (error) {

        /**
         * ====================================================
         * ERREUR
         * ====================================================
         */

        console.error('');
        console.error(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        );

        console.error(
            '[AUTO-REACT] ❌ ÉCHEC'
        );

        console.error(
            '[AUTO-REACT] Message :',
            error?.message || error
        );

        console.error(
            '[AUTO-REACT] Code :',
            error?.output?.statusCode ||
            error?.statusCode ||
            'inconnu'
        );

        console.error(
            '[AUTO-REACT] Stack :',
            error?.stack || 'indisponible'
        );

        console.error(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        );
        console.error('');


        return {
            success: false,
            error:
                error?.message ||
                String(error)
        };


    } finally {

        if (
            statusMessage?.key?.id
        ) {

            processingStatuses.delete(
                statusMessage.key.id
            );
        }
    }
}


/**
 * ============================================================
 * INSTALLER LE LISTENER
 * ============================================================
 */

function initializeAutoReact(conn) {

    if (!conn) {

        console.error(
            '[AUTO-REACT] ❌ Impossible d\'initialiser : connexion absente'
        );

        return false;
    }


    /**
     * Déjà installé ?
     */

    if (
        initializedConnections.has(conn)
    ) {

        console.log(
            '[AUTO-REACT] ℹ️ Listener déjà actif'
        );

        return true;
    }


    /**
     * Vérifier l'event emitter Baileys
     */

    if (
        !conn.ev ||
        typeof conn.ev.on !== 'function'
    ) {

        console.error(
            '[AUTO-REACT] ❌ conn.ev.on() indisponible'
        );

        return false;
    }


    /**
     * ========================================================
     * LISTENER MESSAGES.UPSERT
     * ========================================================
     */

    conn.ev.on(
        'messages.upsert',
        async (update) => {

            try {

                if (!update) {
                    return;
                }


                const messages =
                    update.messages;


                if (
                    !Array.isArray(messages) ||
                    messages.length === 0
                ) {

                    return;
                }


                console.log(
                    `[AUTO-REACT] 📥 messages.upsert reçu : ${messages.length} message(s)`
                );


                for (
                    const message
                    of messages
                ) {

                    if (
                        !message?.key
                    ) {
                        continue;
                    }


                    /**
                     * ------------------------------------------------
                     * Affichage uniquement pour les statuts
                     * ------------------------------------------------
                     */

                    if (
                        message.key.remoteJid ===
                        'status@broadcast'
                    ) {

                        console.log(
                            '[AUTO-REACT] 🔎 Événement STATUS détecté dans messages.upsert'
                        );


                        if (
                            !isAutoReactEnabled()
                        ) {

                            console.log(
                                '[AUTO-REACT] ⏸️ AutoReact désactivé dans la configuration'
                            );

                            continue;
                        }


                        await autoReactStatus(
                            conn,
                            message
                        );
                    }
                }

            } catch (error) {

                console.error(
                    '[AUTO-REACT] ❌ Erreur messages.upsert :',
                    error?.message || error
                );
            }
        }
    );


    initializedConnections.add(
        conn
    );


    console.log('');
    console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    console.log(
        '[AUTO-REACT] 🟢 LISTENER ACTIVÉ'
    );

    console.log(
        '[AUTO-REACT] 👀 Surveillance des statuts : OUI'
    );

    console.log(
        `[AUTO-REACT] ⏱️ Délai : ${getDelay()} ms`
    );

    console.log(
        `[AUTO-REACT] 😊 Emojis : ${getEmojis().join(' ')}`
    );

    console.log(
        `[AUTO-REACT] 👤 Propre statut : OUI`
    );

    console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
    console.log('');


    return true;
}


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    autoReactStatus,
    initializeAutoReact,
    getEmojis,
    getDelay,
    getRandomEmoji
};


/**
 * ============================================================
 * COMMANDE .AUTOREACT
 * ============================================================
 */

cmd({

    pattern: 'autoreact',

    alias: [
        'statusreact',
        'ar'
    ],

    react: '❤️',

    desc:
        'Activer et afficher AutoReact',

    category: 'tools',

    filename: __filename

}, async (
    conn,
    m,
    commands,
    { reply }
) => {


    /**
     * ========================================================
     * INITIALISER LE LISTENER
     * ========================================================
     */

    const initialized =
        initializeAutoReact(conn);


    const emojis =
        getEmojis();

    const delay =
        getDelay();


    const enabled =
        isAutoReactEnabled();


    const status =
        enabled
            ? 'ACTIVÉ'
            : 'DÉSACTIVÉ';


    /**
     * ========================================================
     * RÉPONSE
     * ========================================================
     */

    return reply(

        `┏━⍟「 ☣️ AUTO REACT ☣️ 」⍟━┓\n` +
        `┃\n` +
        `┃ 📌 Statut : ${status}\n` +
        `┃ ⏱️ Délai  : ${delay} ms\n` +
        `┃ 😊 Emojis : ${emojis.join(' ')}\n` +
        `┃ 🎯 Mode   : 1 réaction / statut\n` +
        `┃ 👤 Propre statut : OUI\n` +
        `┃ 👀 Surveillance : ${initialized ? 'ACTIVE' : 'ERREUR'}\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━`

    );
});