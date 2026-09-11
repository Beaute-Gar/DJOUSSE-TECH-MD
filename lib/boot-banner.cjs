'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   boot-banner.cjs — Écran de démarrage style hacker DJOUSSE-TECH-MD
   Aucune dépendance externe (pure ANSI). À require() dans ton fichier
   de démarrage principal (index.js / app.js) à la place des console.log bruts.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Palette ANSI ──────────────────────────────────────────────────────────
const R  = '\x1b[0m';
const B  = '\x1b[1m';
const DIM = '\x1b[2m';
const G  = '\x1b[32m';
const BG = '\x1b[92m';
const CY = '\x1b[96m';
const MG = '\x1b[95m';
const YE = '\x1b[93m';
const RD = '\x1b[91m';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── Bannière ASCII avec effet glitch ──────────────────────────────────────
const ASCII = [
'  ______      __                              ______        __  ',
' / ____ \\    / _|                            |____  |      | |  ',
'| |    | |  | |_  ___  _   _  ___ ___  ___       / /___  ___| |__ ',
'| |    | |  |  _|/ _ \\| | | |/ __/ __|/ _ \\     / // _ \\/ __| \'_ \\',
'| |____| |  | | | (_) | |_| |\\__ \\__ \\  __/    / /|  __/ (__| | | |',
' \\______/   |_|  \\___/ \\__,_||___/___/\\___|   /_/  \\___|\\___|_| |_|',
];

function printGlitchBanner() {
    console.log('');
    for (const line of ASCII) {
        console.log(`${MG}${DIM}${line}${R}`);
    }
    console.log(`${BG}${B}`);
    for (const line of ASCII) {
        console.log(line);
    }
    console.log(R);
}

function line80(char = '═') {
    return char.repeat(66);
}

function box(title, rows) {
    const top = `${G}┏━⍟「 ${BG}${B}☣ ${title} ☣${R}${G} 」⍟━┓${R}`;
    const bottom = `${G}┗${'━'.repeat(38)}⍟${R}`;
    console.log(top);
    console.log(`${G}┃${R}`);
    for (const r of rows) console.log(`${G}┃${R} ${r}`);
    console.log(`${G}┃${R}`);
    console.log(bottom);
}

// ─── En-tête système ────────────────────────────────────────────────────────
function printHeader({ botName = 'DJOUSSE-TECH-MD', folder }) {
    const now = new Date();
    const date = now.toLocaleString('fr-FR');
    console.log(`${G}${line80()}${R}`);
    console.log(`  ${BG}${B}${botName}${R}  ${DIM}-${R}  ${CY}WhatsApp Bot${R}`);
    console.log(`${G}${line80()}${R}`);
    console.log(`  ${DIM}Date${R}    : ${YE}${date}${R}`);
    console.log(`  ${DIM}Dossier${R} : ${DIM}${folder}${R}`);
    console.log(`${G}${line80()}${R}`);
}

// ─── Ligne de statut avec icône colorée ────────────────────────────────────
function statusLine(icon, color, text) {
    console.log(`${color}${icon}${R} ${text}`);
}

async function printBootSequence(data) {
    const {
        botName = 'DJOUSSE-TECH-MD',
        folder = process.cwd(),
        missingKeys = [],
        dbType = 'Local JSON storage',
        dbOk = true,
        pluginsLoaded = 0,
        pluginsErrors = 0,
        commandsLoaded = 0,
        port = 3000,
    } = data;

    printGlitchBanner();
    printHeader({ botName, folder });
    console.log('');
    await sleep(150);

    if (missingKeys.length) {
        statusLine('⚠ ', YE, `${DIM}[config-djousse]${R} Clés optionnelles absentes: ${YE}${B}${missingKeys.join(', ')}${R} ${DIM}(fonctionnalités concernées désactivées)${R}`);
    }
    await sleep(150);

    if (dbOk) {
        statusLine('✔', BG, `${DIM}Database:${R} ${G}${B}${dbType}${R}`);
    } else {
        statusLine('✖', RD, `${DIM}Database:${R} ${RD}connexion échouée${R}`);
    }
    await sleep(150);

    statusLine('▸', CY, `${DIM}[PLUGINS]${R} Chargés: ${BG}${B}${pluginsLoaded}${R} ${DIM}|${R} Erreurs: ${pluginsErrors > 0 ? RD : G}${B}${pluginsErrors}${R}`);
    statusLine('▸', CY, `${DIM}Commandes chargées:${R} ${BG}${B}${commandsLoaded}${R}`);
    statusLine('▸', CY, `${DIM}Modules fonctionnels:${R} ${BG}${B}${pluginsLoaded}${R}/${pluginsLoaded}`);
    console.log('');
    await sleep(200);

    box('NOUVELLE CONNEXION', [
        `${BG}[1]${R} QR Code`,
        `${BG}[2]${R} Code de jumelage ${DIM}(8 caractères)${R}`,
    ]);
    console.log(`${G}┃${R} ${DIM}▸ Choisis (1 ou 2):${R}`);
    console.log('');
    await sleep(200);

    box('BOOT SEQUENCE', [
        `${BG}🤖 Bot${R}       : ${B}${botName}${R}`,
        `${BG}📡 Port${R}      : ${YE}${port}${R}`,
        `${BG}📦 Commandes${R} : ${BG}${B}${commandsLoaded}${R}`,
        `${BG}🗄  Database${R}  : ${dbType}`,
        `${BG}🌐 Dashboard${R} : ${CY}http://localhost:${port}${R}`,
        `${BG}🔗 Pair${R}      : ${CY}http://localhost:${port}/pair${R}`,
        `${BG}📊 API${R}       : ${CY}http://localhost:${port}/api/status${R}`,
    ]);
    console.log('');
    console.log(`${DIM}> root@${botName.toLowerCase()}:~$ ${BG}_${R}`);
}

module.exports = { printBootSequence, printGlitchBanner, printHeader, box, statusLine };
