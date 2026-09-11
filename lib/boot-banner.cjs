'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   boot-banner.cjs (v2) — Dashboard hacker animé DJOUSSE-TECH-MD
   Dépendance : npm install figlet   (fallback texte simple si absent)
   ═══════════════════════════════════════════════════════════════════════════ */

let figlet = null;
try { figlet = require('figlet'); } catch { /* fallback plus bas */ }

// ─── Palette ANSI ──────────────────────────────────────────────────────────
const R   = '\x1b[0m';
const B   = '\x1b[1m';
const DIM = '\x1b[2m';
const G   = '\x1b[32m';
const BG  = '\x1b[92m';
const CY  = '\x1b[96m';
const MG  = '\x1b[95m';
const YE  = '\x1b[93m';
const RD  = '\x1b[91m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR = '\x1b[2J\x1b[0f';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const cols = () => process.stdout.columns || 78;

// ─── 1) Pluie "matrix" en intro ─────────────────────────────────────────────
async function matrixRain(durationMs = 1100) {
    const width = Math.min(cols(), 78);
    const chars = 'アカサタナ0123456789ABCDEF#$%&';
    const frames = Math.max(4, Math.floor(durationMs / 90));
    process.stdout.write(HIDE_CURSOR);
    for (let f = 0; f < frames; f++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            if (Math.random() < 0.045) {
                row += `${BG}${chars[Math.floor(Math.random() * chars.length)]}${R}`;
            } else if (Math.random() < 0.02) {
                row += `${G}${DIM}${chars[Math.floor(Math.random() * chars.length)]}${R}`;
            } else {
                row += ' ';
            }
        }
        console.log(row);
        await sleep(90);
    }
    process.stdout.write(SHOW_CURSOR);
}

// ─── 2) Titre ASCII réel (figlet) avec balayage couleur ────────────────────
function renderTitle(text) {
    if (figlet) {
        try { return figlet.textSync(text, { font: 'ANSI Shadow' }); } catch { /* fallback */ }
    }
    return `██  ${text}  ██`; // fallback minimal si figlet absent
}

async function printGlitchTitle() {
    const art1 = renderTitle('DJOUSSE');
    const art2 = renderTitle('TECH');
    const lines1 = art1.split('\n');
    const lines2 = art2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);

    // Passage 1 : silhouette magenta décalée (effet fantôme)
    for (let i = 0; i < maxLines; i++) {
        const l1 = (lines1[i] || '').padEnd(50);
        const l2 = lines2[i] || '';
        console.log(`${MG}${DIM}${l1}  ${l2}${R}`);
    }
    await sleep(120);
    // Passage 2 : le vrai titre en vert vif
    console.log('');
    for (let i = 0; i < maxLines; i++) {
        const l1 = (lines1[i] || '').padEnd(50);
        const l2 = lines2[i] || '';
        console.log(`${BG}${B}${l1}  ${l2}${R}`);
    }
}

// ─── 3) Barre de progression animée (sur la même ligne) ────────────────────
async function progressBar(label, total, { width = 28, stepMs = 6, color = BG } = {}) {
    for (let i = 0; i <= total; i += Math.max(1, Math.round(total / 40))) {
        const cur = Math.min(i, total);
        const filled = Math.round((cur / total) * width);
        const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
        process.stdout.write(`\r${DIM}▸${R} ${label.padEnd(24)} ${color}[${bar}]${R} ${B}${cur}${R}/${total}`);
        await sleep(stepMs);
    }
    process.stdout.write(`\r${G}✔${R} ${label.padEnd(24)} ${color}[${'█'.repeat(width)}]${R} ${B}${total}${R}/${total}   \n`);
}

// ─── 4) Scan réseau / sécurité simulé (flaveur visuelle uniquement) ────────
async function securityScan() {
    const steps = [
        'Initialisation du socket WhatsApp Web',
        'Vérification de l\'intégrité des plugins',
        'Chargement des clés de session locales',
        'Activation du pare-feu Guardian',
        'Synchronisation horloge système',
    ];
    for (const s of steps) {
        process.stdout.write(`${DIM}▸ ${s}...${R}`);
        await sleep(120);
        process.stdout.write(`\r${G}✔${R} ${s}${' '.repeat(10)}\n`);
    }
}

// ─── Boîtes double-ligne "dashboard" ────────────────────────────────────────
function dline(w) { return '═'.repeat(w); }

function headerBlock({ botName, folder }) {
    const w = Math.min(cols(), 78);
    const now = new Date().toLocaleString('fr-FR');
    console.log(`${G}${dline(w)}${R}`);
    console.log(`  ${BG}${B}${botName}${R}  ${DIM}—${R}  ${CY}WhatsApp Bot${R}  ${DIM}[MODE HACKER]${R}`);
    console.log(`${G}${dline(w)}${R}`);
    console.log(`  ${DIM}Date${R}    : ${YE}${now}${R}`);
    console.log(`  ${DIM}Dossier${R} : ${DIM}${folder}${R}`);
    console.log(`${G}${dline(w)}${R}`);
}

function doubleBox(title, rows) {
    const w = 56;
    console.log(`${G}╔${dline(w)}╗${R}`);
    console.log(`${G}║${R} ${BG}${B}☣ ${title}${R}${' '.repeat(Math.max(0, w - title.length - 3))}${G}║${R}`);
    console.log(`${G}╠${dline(w)}╣${R}`);
    for (const r of rows) {
        const plain = r.replace(/\x1b\[[0-9;]*m/g, '');
        const pad = Math.max(0, w - plain.length - 1);
        console.log(`${G}║${R} ${r}${' '.repeat(pad)}${G}║${R}`);
    }
    console.log(`${G}╚${dline(w)}╝${R}`);
}

// ─── Séquence complète ──────────────────────────────────────────────────────
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

    console.log(CLEAR);
    await matrixRain(900);
    console.log('');
    await printGlitchTitle();
    console.log('');
    headerBlock({ botName, folder });
    console.log('');

    if (missingKeys.length) {
        console.log(`${YE}⚠${R}  ${DIM}[config-djousse]${R} Clés absentes: ${YE}${B}${missingKeys.join(', ')}${R} ${DIM}(désactivé)${R}`);
    }
    console.log('');

    await securityScan();
    console.log('');

    await progressBar('Base de données', 100, { color: dbOk ? BG : RD });
    await progressBar('Plugins chargés', pluginsLoaded, { color: pluginsErrors ? YE : BG });
    await progressBar('Commandes indexées', commandsLoaded, { color: CY });
    console.log('');

    doubleBox('NOUVELLE CONNEXION', [
        `${BG}[1]${R} QR Code`,
        `${BG}[2]${R} Code de jumelage ${DIM}(8 caractères)${R}`,
    ]);
    console.log(`${DIM}▸ Choisis (1 ou 2):${R}`);
    console.log('');

    doubleBox('BOOT SEQUENCE', [
        `${BG}Bot${R}       : ${B}${botName}${R}`,
        `${BG}Port${R}      : ${YE}${port}${R}`,
        `${BG}Commandes${R} : ${B}${commandsLoaded}${R}`,
        `${BG}Database${R}  : ${dbType}`,
        `${BG}Dashboard${R} : ${CY}http://localhost:${port}${R}`,
        `${BG}Pair${R}      : ${CY}http://localhost:${port}/pair${R}`,
        `${BG}API${R}       : ${CY}http://localhost:${port}/api/status${R}`,
    ]);
    console.log('');
    console.log(`${DIM}> root@${botName.toLowerCase()}:~$ ${BG}_${R}`);
}

module.exports = { printBootSequence, matrixRain, progressBar, securityScan, printGlitchTitle, box: doubleBox };
