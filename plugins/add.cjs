// plugins/add.cjs — .add : ajout automatique des membres avec rapport détaillé
const { cmd } = require('../command.cjs');
const { normalizeJid } = require('../lib/jid.cjs');

const normJid = normalizeJid;
const memberJid = (p) => String(p?.jid || p?.id || '').split(':')[0];
const botJids = (sock) => {
    const list = new Set([normJid(sock.user?.id)]);
    const lid = sock.user?.lid || sock.lid;
    if (lid) list.add(String(lid).split(':')[0]);
    return list;
};

async function getAllMembers(sock) {
    const all = new Set();
    const scanFrom = async (groups) => {
        for (const groupId of Object.keys(groups || {})) {
            try {
                const groupInfo = groups[groupId];
                for (const p of (groupInfo?.participants || [])) {
                    const jid = memberJid(p);
                    if (!botJids(sock).has(jid)) all.add(jid);
                }
            } catch (e) { console.error(`❌ groupe ${groupId}:`, e.message); }
        }
    };
    const fromDb = async () => {
        try {
            const { getDB } = await import('../packages/infrastructure/database/database.js');
            const db = getDB();
            const rows = await db.all('SELECT id, participants FROM groupes_reels').catch(() => []);
            for (const row of rows || []) {
                try {
                    const parts = JSON.parse(row.participants || '[]');
                    for (const p of parts) {
                        const jid = memberJid(p);
                        if (jid && !botJids(sock).has(jid)) all.add(jid);
                    }
                } catch (e) { /* participant malformé */ }
            }
            console.log(`📦 DB fallback: ${all.size} membres (groupes_reels)`);
        } catch (e) {
            console.error('❌ DB fallback:', e.message);
        }
    };
    try {
        console.log('🔍 Parcours des groupes WhatsApp...');
        let groups = null;
        for (let attempt = 1; attempt <= 3 && !groups; attempt++) {
            groups = await sock.groupFetchAllParticipating().catch(() => null);
            if (!groups && attempt < 3) await new Promise(r => setTimeout(r, 8000));
        }
        if (groups && Object.keys(groups).length > 0) {
            console.log(`📊 ${Object.keys(groups).length} groupes trouvés (fetch)`);
            await scanFrom(groups);
        } else {
            console.log('⚠️ fetch vide → fallback DB');
            await fromDb();
        }
        console.log(`✅ ${all.size} membres uniques récupérés`);
    } catch (e) {
        console.error('❌ Récupération membres:', e.message);
    }
    return Array.from(all);
}

async function addWithTimeout(sock, groupId, batch, timeoutMs) {
    global.__lastAddError = null;
    const addPromise = sock.groupParticipantsUpdate(groupId, batch, 'add').catch((e) => {
        global.__lastAddError = String(e?.message || e);
        console.error('❌ groupParticipantsUpdate reject:', e?.message || e);
        return null;
    });
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            global.__lastAddError = global.__lastAddError || `TIMEOUT: groupParticipantsUpdate > ${timeoutMs}ms`;
            reject(new Error(`TIMEOUT: groupParticipantsUpdate > ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([addPromise, timeoutPromise]);
}

cmd({ pattern: 'add', desc: 'Ajouter tous les membres de vos groupes dans ce groupe (avec rapport)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
    const sock = conn;
    const from = m.chat;
    if (!from || !from.endsWith('@g.us')) {
        return m.reply('⚠️ Cette commande ne fonctionne qu\'en groupe.');
    }

    const targetMetadata = await sock.groupMetadata(from).catch(() => null);
    if (!targetMetadata) return m.reply('❌ Impossible de lire les infos du groupe.');

    const botJid = normJid(sock.user?.id);
    const ids = botJids(sock);
    const isAdmin = (targetMetadata.participants || []).some(p => ids.has(memberJid(p)) && (p.admin === 'admin' || p.admin === 'superadmin'));
    if (!isAdmin) {
        return m.reply('🔴 Le bot n\'est pas admin de ce groupe.\n➡️ Ajoutez le bot comme administrateur pour continuer.');
    }

    await m.reply('⏳ *AJOUT DES MEMBRES EN COURS...*\n\n📊 Analyse de vos groupes WhatsApp...\n🔄 Récupération des contacts...\n⏱️ Veuillez patienter.');

    const allMembers = await getAllMembers(sock);
    if (!allMembers || allMembers.length === 0) {
        return m.reply('❌ Aucun membre trouvé dans vos groupes.');
    }

    const existingMembers = new Set((targetMetadata.participants || []).map(p => memberJid(p)));
    const membersToAdd = allMembers.filter(member => !existingMembers.has(member));
    if (membersToAdd.length === 0) {
        return m.reply(`✅ *TOUS LES MEMBRES SONT DÉJÀ PRÉSENTS*\n\n👥 Total: ${allMembers.length} membres\n📊 Déjà dans le groupe: ${existingMembers.size}`);
    }

    const BATCH_SIZE = 20;
    const BATCH_PAUSE = 5000;
    const TIMEOUT = 30000;

    await m.reply(`📊 *AJOUT DE ${membersToAdd.length} MEMBRES*\n\n📦 Taille des lots: ${BATCH_SIZE}\n⏱️ Timeout: ${TIMEOUT / 1000}s par lot\n🔄 Pause: ${BATCH_PAUSE / 1000}s entre les lots\n\n📝 Un rapport sera envoyé à la fin.`);

    let added = 0;
    let failed = 0;
    const errors = [];
    const successList = [];
    const failedList = [];

    for (let i = 0; i < membersToAdd.length; i += BATCH_SIZE) {
        const batch = membersToAdd.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(membersToAdd.length / BATCH_SIZE);
        const percent = Math.round((i / membersToAdd.length) * 100);
        global.__groupDiag = { stage: 'add', progress: `${Math.min(i + BATCH_SIZE, membersToAdd.length)}/${membersToAdd.length}`, at: new Date().toISOString(), error: null };
        console.log(`📦 Lot ${batchNum}/${totalBatches} : ${batch.length} membres (${percent}%)`);

        let critical = false;
        try {
            const result = await addWithTimeout(sock, from, batch, TIMEOUT);
            if (result && Array.isArray(result)) {
                for (const r of result) {
                    const st = String(r?.status || '');
                    if (st === '200' || st.startsWith('2')) {
                        added++;
                        successList.push(r.jid);
                    } else {
                        failed++;
                        failedList.push({ jid: r.jid, status: st, error: r.error || 'Erreur inconnue' });
                        errors.push(`Échec ${r.jid}: ${st} - ${r.error || 'Inconnu'}`);
                        if (/not-authorized|privacy|invite/i.test(st + ' ' + (r.error || ''))) critical = true;
                    }
                }
                console.log(`✅ Lot ${batchNum}: ${result.filter(r => String(r?.status || '').startsWith('2')).length} ajoutés`);
            } else {
                failed += batch.length;
                for (const jid of batch) failedList.push({ jid, status: 'unknown', error: 'Aucune réponse' });
                errors.push(`Lot ${batchNum}: Aucune réponse`);
            }
        } catch (error) {
            const errorMsg = `Lot ${batchNum}: ${error.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
            failed += batch.length;
            for (const jid of batch) failedList.push({ jid, status: 'error', error: error.message });
            if (/not-authorized|privacy|invite/i.test(error.message)) {
                console.log('🛑 Erreur critique, arrêt du processus');
                critical = true;
            }
        }

        await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE));
        if (critical) break;
    }

    const rate = membersToAdd.length > 0 ? Math.round((added / membersToAdd.length) * 100) : 0;
    const summary =
        `📊 *RAPPORT D'AJOUT*\n\n` +
        `✅ *Ajoutés:* ${added}\n` +
        `❌ *Échecs:* ${failed}\n` +
        `📝 *Total:* ${membersToAdd.length}\n\n` +
        `📈 *Taux de succès:* ${rate}%\n\n` +
        (errors.length > 0 ? `⚠️ *Erreurs rencontrées:*\n${errors.slice(0, 5).map(e => `• ${e}`).join('\n')}\n` : '') +
        (failed > 5 ? `\n... et ${failed - 5} autres erreurs dans le rapport.` : '');

    const fullReport =
        `╔══════════════════════════════════════════════╗\n` +
        `║       RAPPORT D'AJOUT — DJOUSSE-TECH-MD     ║\n` +
        `╚══════════════════════════════════════════════╝\n\n` +
        `📅 Date: ${new Date().toLocaleString()}\n` +
        `🆔 Groupe: ${from}\n\n` +
        `📊 STATISTIQUES\n` +
        `• Total à ajouter: ${membersToAdd.length}\n` +
        `• ✅ Ajoutés: ${added}\n` +
        `• ❌ Échecs: ${failed}\n` +
        `• 📈 Succès: ${rate}%\n\n` +
        `✅ AJOUTÉS (${added})\n${successList.length ? successList.map(j => `• ${j}`).join('\n') : 'Aucun'}\n\n` +
        `❌ ÉCHECS (${failed})\n${failedList.length ? failedList.map(f => `• ${f.jid} — ${f.status} : ${f.error}`).join('\n') : 'Aucun'}\n\n` +
        `⚠️ ERREURS (${errors.length})\n${errors.length ? errors.map((e, i) => `${i + 1}. ${e}`).join('\n') : 'Aucune'}\n\n` +
        `🤖 DJOUSSE-TECH-MD v2.1.0`;

    try {
        await sock.sendMessage(from, {
            document: Buffer.from(fullReport, 'utf8'),
            fileName: `rapport_ajout_${new Date().toISOString().slice(0, 10)}.txt`,
            mimetype: 'text/plain',
            caption: summary,
        });
    } catch (e) {
        await m.reply(summary).catch(() => {});
    }
    global.__groupDiag = null;
});

cmd({ pattern: 'addtest', desc: 'Tester l\'ajout d\'un membre — .addtest (auto) ou .addtest <numéro>', category: 'admin', filename: __filename, fromMe: true }, async (conn, m) => {
    const sock = conn;
    const from = m.chat;
    if (!from || !from.endsWith('@g.us')) return m.reply('⚠️ Cette commande ne fonctionne qu\'en groupe.');

    const metadata = await sock.groupMetadata(from).catch(() => null);
    if (!metadata) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botJidRaw = sock.user?.id || '';
    const parts = (metadata.participants || []).map(p => `${memberJid(p)}[${p.admin || 'membre'}]`).join(', ');
    await m.reply(`🧪 *DIAGNOSTIC GROUPE*\n\n🤖 Bot: ${botJidRaw}\n👑 Owner: ${metadata.owner || '?'}\n👥 Participants (${(metadata.participants || []).length}):\n${parts || 'aucun'}`);

    const body = String(m.body || '');
    const argNum = (body.split(' ').slice(1).join(' ').match(/\d{7,}/) || [null])[0];
    if (argNum) {
        const testJid = `${argNum}@s.whatsapp.net`;
        await m.reply(`🧪 *TEST DIRECT*\n\n👤 ${testJid}\n⏳ Tentative...`);
        try {
            const result = await addWithTimeout(sock, from, [testJid], 30000);
            const realErr = global.__lastAddError;
            const status = Array.isArray(result) && result[0]
                ? `${result[0].status}${result[0].error ? ' — ' + result[0].error : ''}`
                : (result === null ? `rejet: ${realErr || 'inconnu'}` : `inconnu (${JSON.stringify(result)})`);
            await m.reply(`📦 *RÉSULTAT:* ${status}\n\n👤 ${testJid}`);
        } catch (error) {
            await m.reply(`❌ *TEST ÉCHOUÉ*\n\n👤 ${testJid}\n📝 Erreur: ${error.message}`);
        }
        return;
    }

    const allMembers = await getAllMembers(sock);
    const existing = new Set((metadata.participants || []).map(p => memberJid(p)));
    const testMember = allMembers.find(member => !existing.has(member));
    if (!testMember) return m.reply(`📊 *Scan:* ${allMembers.length} membres récupérés (${(metadata.participants || []).length} déjà présents)\n❌ Aucun membre à tester — scan vide ou tous présents.`);

    await m.reply(`🧪 *TEST D'AJOUT (sans pré-check)*\n\n📊 Scan: ${allMembers.length} membres\n👤 Test JID: ${testMember}\n⏳ Tentative...`);
    try {
        const result = await addWithTimeout(sock, from, [testMember], 30000);
        const realErr = global.__lastAddError;
        const status = Array.isArray(result) && result[0]
            ? `${result[0].status}${result[0].error ? ' — ' + result[0].error : ''}`
            : (result === null ? `rejet: ${realErr || 'inconnu'}` : `inconnu (${JSON.stringify(result)})`);
        await m.reply(`📦 *RÉSULTAT:* ${status}\n\n👤 ${testMember}`);
    } catch (error) {
        await m.reply(`❌ *TEST ÉCHOUÉ*\n\n👤 ${testMember}\n📝 Erreur: ${error.message}`);
    }
});
