'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   boot-banner.cjs (v3) — Banner simple et propre DJOUSSE-TECH-MD
   ═══════════════════════════════════════════════════════════════════════════ */

let figlet = null;
try { figlet = require('figlet'); } catch { /* fallback */ }

const R   = '\x1b[0m';
const B   = '\x1b[1m';
const DIM = '\x1b[2m';
const G   = '\x1b[32m';
const BG  = '\x1b[92m';
const CY  = '\x1b[96m';
const YE  = '\x1b[93m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR = '\x1b[2J\x1b[0f';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const cols = () => process.stdout.columns || 78;

function renderTitle(text) {
    if (figlet) {
        try { return figlet.textSync(text, { font: 'ANSI Shadow' }); } catch { /* fallback */ }
    }
    return `██  ${text}  ██`;
}

function dline(w) { return '═'.repeat(w); }

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

    const art1 = renderTitle('DJOUSSE');
    const art2 = renderTitle('TECH');
    const lines1 = art1.split('\n');
    const lines2 = art2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLines; i++) {
        const l1 = (lines1[i] || '').padEnd(50);
        const l2 = lines2[i] || '';
        console.log(`${BG}${B}${l1}  ${l2}${R}`);
    }
    console.log('');

    const w = Math.min(cols(), 78);
    const now = new Date().toLocaleString('fr-FR');
    console.log(`${G}${dline(w)}${R}`);
    console.log(`  ${BG}${B}${botName}${R}  ${DIM}— WhatsApp Bot${R}`);
    console.log(`${G}${dline(w)}${R}`);
    console.log(`  ${DIM}Date${R}    : ${YE}${now}${R}`);
    console.log(`  ${DIM}Dossier${R} : ${DIM}${folder}${R}`);
    console.log(`${G}${dline(w)}${R}`);

    if (missingKeys.length) {
        console.log(`\n${YE}⚠${R}  Clés absentes: ${YE}${B}${missingKeys.join(', ')}${R} ${DIM}(désactivé)${R}`);
    }
    console.log('');

    await progressBar('Base de données', 100, { color: dbOk ? BG : '\x1b[91m' });
    await progressBar('Plugins chargés', pluginsLoaded, { color: pluginsErrors ? YE : BG });
    await progressBar('Commandes indexées', commandsLoaded, { color: CY });
    console.log('');

    console.log(`${G}╔${dline(w)}╗${R}`);
    console.log(`${G}║${R} ${BG}${B}☣ BOOT SEQUENCE${R}${' '.repeat(Math.max(0, w - 16))}${G}║${R}`);
    console.log(`${G}╠${dline(w)}╣${R}`);
    const rows = [
        `Bot       : ${botName}`,
        `Port      : ${port}`,
        `Commandes : ${commandsLoaded}`,
        `Database  : ${dbType}`,
        `Dashboard : http://localhost:${port}`,
        `Pair      : http://localhost:${port}/pair`,
        `API       : http://localhost:${port}/api/status`,
    ];
    for (const r of rows) {
        const pad = Math.max(0, w - r.length - 1);
        console.log(`${G}║${R} ${r}${' '.repeat(pad)}${G}║${R}`);
    }
    console.log(`${G}╚${dline(w)}╝${R}`);
    console.log(`\n${DIM}> root@${botName.toLowerCase()}:~$ ${BG}_${R}`);
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

module.exports = { printBootSequence, progressBar, doubleBox, box: doubleBox };
