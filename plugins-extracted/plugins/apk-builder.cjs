const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/* ═══════════════════════════════════════════════════════════════════
   .apk — Build & Send APK via WhatsApp
   ═══════════════════════════════════════════════════════════════════
   Commandes :
     .apk build    → Compiler l'APK
     .apk send     → Envoyer l'APK existant
     .apk status   → Vérifier l'état du build
     .apk info     → Infos sur l'APK
   ═══════════════════════════════════════════════════════════════════ */

const APK_DIR = path.join(__dirname, '../android/app/build/outputs/apk/debug');
const APK_FILE = path.join(APK_DIR, 'app-debug.apk');
const BUILD_LOG = path.join(__dirname, '../data/build-apk.log');

// Owner check
function isOwner(sender) {
    const ownerNumbers = [
        config.OWNER_NUMBER,
        config.OWNER_NUMBER_2,
        process.env.OWNER_NUMBER,
    ].filter(Boolean).map(n => String(n).replace(/[^0-9]/g, ''));
    const senderNum = String(sender).split('@')[0].replace(/[^0-9]/g, '');
    return ownerNumbers.includes(senderNum);
}

// ══ .apk build ══
cmd({
    pattern: 'apk build',
    alias: ['build apk', 'compile apk', 'apk compile'],
    desc: 'Compiler le bot en APK Android',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    if (!isOwner(m.sender)) return m.reply('❌ Owner only.');

    const chat = m.chat;
    
    try {
        await m.reply('🔨 *Build APK en cours...*\n\n⏳ Cela peut prendre 2-5 minutes.\nNe fermez pas cette conversation.');

        const projectRoot = path.join(__dirname, '..');
        
        // Lancer le build en async
        const buildCmd = process.platform === 'win32' 
            ? 'scripts\\build-apk.bat'
            : 'bash scripts/build-apk.sh';
        
        exec(buildCmd, { 
            cwd: projectRoot, 
            timeout: 300000,  // 5 min max
            maxBuffer: 10 * 1024 * 1024,
        }, async (error, stdout, stderr) => {
            try {
                if (fs.existsSync(APK_FILE)) {
                    const stats = fs.statSync(APK_FILE);
                    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    
                    await conn.sendMessage(chat, {
                        text: `✅ *APK Build Réussi !*\n\n📱 Taille: *${sizeMB} MB*\n📁 Fichier: app-debug.apk\n\nTapez *.apk send* pour l'envoyer.`,
                    });
                } else {
                    const log = stderr || stdout || 'Erreur inconnue';
                    await conn.sendMessage(chat, {
                        text: `❌ *Build échoué*\n\n\`\`\`${log.slice(-500)}\`\`\``,
                    });
                }
            } catch (e) {
                console.error('[APK] Erreur callback:', e.message);
            }
        });

    } catch (e) {
        await m.reply(`❌ Erreur build: ${e.message}`);
    }
});

// ══ .apk send ══
cmd({
    pattern: 'apk send',
    alias: ['send apk', 'envoyer apk'],
    desc: 'Envoyer l\'APK compilé via WhatsApp',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    if (!isOwner(m.sender)) return m.reply('❌ Owner only.');

    const chat = m.chat;

    try {
        if (!fs.existsSync(APK_FILE)) {
            return m.reply('❌ Aucun APK trouvé.\nTapez *.apk build* pour compiler d\'abord.');
        }

        const stats = fs.statSync(APK_FILE);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        await m.reply(`📱 Envoi de l'APK (${sizeMB} MB)...`);

        // Envoyer l'APK en tant que document
        await conn.sendMessage(chat, {
            document: { url: APK_FILE },
            fileName: 'DJOUSSE-TECH-MD-v3.0.apk',
            mimetype: 'application/vnd.android.package-archive',
            caption: `🤖 *DJOUSSE-TECH-MD v3.0*\n\n📱 APK Android (${sizeMB} MB)\n\n*Installation:*\n1. Télécharger le fichier\n2. Ouvrir et autoriser l'installation\n3. Lancer l'application`,
        });

        console.log(`[APK] APK envoyé à ${chat} (${sizeMB} MB)`);
        
    } catch (e) {
        await m.reply(`❌ Erreur envoi: ${e.message}`);
    }
});

// ══ .apk status ══
cmd({
    pattern: 'apk status',
    alias: ['apk etat', 'apk info'],
    desc: 'Vérifier l\'état de l\'APK',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    if (!isOwner(m.sender)) return m.reply('❌ Owner only.');

    try {
        const exists = fs.existsSync(APK_FILE);
        let info = `📱 *APK Status*\n\n`;
        
        if (exists) {
            const stats = fs.statSync(APK_FILE);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            const date = new Date(stats.mtime).toLocaleString('fr-FR');
            
            info += `✅ *Existe:* Oui\n`;
            info += `📏 *Taille:* ${sizeMB} MB\n`;
            info += `📅 *Modifié:* ${date}\n`;
            info += `📁 *Chemin:* android/.../app-debug.apk\n\n`;
            info += `Tapez *.apk send* pour l'envoyer`;
        } else {
            info += `❌ *Existe:* Non\n\n`;
            info += `Tapez *.apk build* pour compiler`;
        }
        
        await m.reply(info);
    } catch (e) {
        await m.reply(`❌ Erreur: ${e.message}`);
    }
});

// ══ .apk install (instructions) ══
cmd({
    pattern: 'apk install',
    alias: ['installer apk'],
    desc: 'Instructions d\'installation de l\'APK',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    if (!isOwner(m.sender)) return m.reply('❌ Owner only.');

    const instructions = `📱 *Installation de l'APK*\n\n` +
        `*Étape 1:*\n` +
        `Téléchargez l'APK envoyé\n\n` +
        `*Étape 2:*\n` +
        `Ouvrez le fichier .apk\n` +
        `Si "Source inconnue" → Autoriser\n\n` +
        `*Étape 3:*\n` +
        `Cliquez "Installer"\n\n` +
        `*Étape 4:*\n` +
        `Lancez "DJOUSSE-TECH"\n\n` +
        `*⚠️ Note:*\n` +
        `L'app nécessite les permissions:\n` +
        `• Internet\n` +
        `• Notifications\n` +
        `• Arrière-plan`;
    
    await m.reply(instructions);
});

module.exports = {};
