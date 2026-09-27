'use strict';

const { cmd } = require('../command.cjs');
const viewOnceSaver = require('../../lib/view-once.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'autoviewonce|avv',
    react: '👁️',
    desc: 'Activer/désactiver l\'auto-sauvegarde view-once',
    category: 'owner',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const st = viewOnceSaver.status();
    if (st.enabled) {
        viewOnceSaver.disable();
        await reply(boxWithFooter('SUCCÈS', [{ raw: '❌ Auto-View-Once désactivé' }]));
    } else {
        viewOnceSaver.enable();
        await reply(boxWithFooter('SUCCÈS', [{ raw: '✅ Auto-View-Once activé\nTous les messages view-once seront interceptés et renvoyés.' }]));
    }
});
