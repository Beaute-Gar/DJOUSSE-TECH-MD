const { cmd } = require('../command.cjs');
const web = require('../lib/tools/web-search.cjs');
const finance = require('../lib/tools/finance.cjs');
const { runTask } = require('../lib/tools/agentic-engine.cjs');
const { runTeam } = require('../lib/tools/team-engine.cjs');
const wf = require('../lib/tools/workflow-engine.cjs');
const rag = require('../lib/tools/rag.cjs');
const ui = require('../lib/djousse-ui.cjs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const DESKTOP = path.join(os_home(), 'Desktop');
const PDF_DIR = path.join(DESKTOP, 'DJOUSSE-PDF');

function os_home() {
  return (process.env.USERPROFILE || process.env.HOME || 'C:/Users/USER');
}

function stripMd(s) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/[_~`]/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\|/g, ' | ')
    .replace(/^[-–—]+\s*/gm, '• ')
    .replace(/\$\$?/g, '');
}

function slugify(s) {
  const norm = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return norm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'fiche';
}

function runTeamPedagogique(goal) {
  const g = String(goal).toLowerCase();
  return /(cours|chapitre|fiche|révision|revision|exercice|élèves|eleves|leçon|lesson|enseigner|comprendre|bachelier|baccalauréat|bac\b|programme officiel|apprendre|explique-moi|explique moi)/.test(g);
}

async function generatePdf(title, text) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#050a12').text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor('#000000').text(stripMd(text), { align: 'left' });
  doc.moveDown();
  doc.fontSize(8).fillColor('#888888').text(`Généré par AINORIA le ${new Date().toLocaleString('fr-FR')} — © DJOUSSE TECH`, { align: 'center' });
  doc.end();
  await done;
  const buf = Buffer.concat(chunks);
  fs.mkdirSync(PDF_DIR, { recursive: true });
  const filePath = path.join(PDF_DIR, `${slugify(title)}-${Date.now()}.pdf`);
  fs.writeFileSync(filePath, buf);
  return { buf, filePath };
}

const HELP = `🧠 *AINORIA — Intelligence Augmentée*

Moteurs disponibles :
• .ainoria search <sujet> — recherche web réelle (DuckDuckGo/Google)
• .ainoria task <objectif> — boucle agentique autonome (plan→act→observe→réflexion)
• .ainoria team <objectif> — équipe de 5 experts (PM, Analyste, Stratège, Exécuteur, QA)
• .ainoria workflow <nom> [var=val] — exécute un workflow JSON
• .ainoria rag <lien> — ingère un article dans la mémoire
• .ainoria ask <question> — répond depuis la mémoire RAG
• .ainoria stock <symbole> — action boursière (ex: AAPL, ^GSPC)
• .ainoria crypto <symbole> — crypto (btc, eth, sol...)
• .ainoria or — prix de l'or
• .ainoria fx <de>-<vers> — taux de change (ex: USD-XOF)
• .ainoria workflows — liste des workflows disponibles

Workflows : ${wf.listWorkflows().map(w => w.name).join(', ') || 'aucun'}`;

cmd({ pattern: 'ainoria', alias: ['ainora', 'brain'], category: 'ai', filename: __filename, desc: 'Moteur AINORIA : recherche, agents, équipes, workflows, finance, RAG' }, async (conn, m, commands, { q, reply }) => {
  try {
    if (!q) return reply(HELP);
    const [sub, ...rest] = q.trim().split(/\s+/);
    const arg = rest.join(' ').trim();
    const t0 = Date.now();
    const elapsed = () => '⏱️ ' + (Date.now() - t0) + 'ms';

    switch (sub.toLowerCase()) {
      case 'search': {
        if (!arg) return reply('❌ Usage: .ainoria search <sujet>');
        const r = await web.searchWeb(arg, 5);
        if (!r.length) return reply('❌ Aucun résultat pour: ' + arg);
        reply('🔍 *Recherche: ' + arg + '*\n\n' + r.map((x, i) => `${i + 1}. *${x.titre}*\n${x.url}\n${x.extrait || ''} (${x.source})`).join('\n\n') + '\n\n' + elapsed());
        break;
      }
      case 'task': {
        if (!arg) return reply('❌ Usage: .ainoria task <objectif>');
        reply('🤖 AINORIA réfléchit à la tâche... (boucle autonome)');
        const r = await runTask(arg);
        const planText = (r.steps || []).map(p => '• ' + p.titre).join('\n');
        reply('🎯 *Tâche: ' + arg + '*\n\n' + (r.report || 'Aucun résultat') + (planText ? '\n\n_Plan:_\n' + planText : '') + '\n\n' + elapsed());
        break;
      }
      case 'team': {
        if (!arg) return reply('❌ Usage: .ainoria team <objectif>');
        reply('👥 ' + (runTeamPedagogique(arg) ? '2 experts AINORIA (Enseignant + Correcteur)' : '5 experts AINORIA') + ' travaillent... (~1 min)');
        const r = await runTeam(arg);
        const membres = r.team.map(t => t.emoji + ' ' + t.titre).join('\n');
        const corps = '_' + membres + '_\n\n' + r.report + '\n\n' + elapsed();
        const msgBox = ui.box('🧠 *AINORIA — ÉQUIPE*', corps.split('\n'), { footer: ui.FOOTER });
        reply(msgBox);
        if (arg.toLowerCase().includes('fiche') || arg.toLowerCase().includes('cours') || arg.toLowerCase().includes('chapitre') || arg.toLowerCase().includes('révision') || arg.toLowerCase().includes('revision')) {
          try {
            const { filePath } = await generatePdf('FICHE DE REVISION — ' + arg, r.report);
            await conn.sendMessage(m.chat, {
              document: fs.readFileSync(filePath),
              mimetype: 'application/pdf',
              fileName: path.basename(filePath),
              caption: '📚 *Fiche en PDF* — enregistrée aussi sur le Bureau (DJOUSSE-PDF)',
            }, { quoted: m });
          } catch (e) {
            reply('⚠️ PDF non généré: ' + e.message);
          }
        }
        break;
      }
      case 'workflow': {
        if (!arg) return reply('❌ Usage: .ainoria workflow <nom> [var=val]\n\nDisponibles: ' + wf.listWorkflows().map(w => w.name).join(', '));
        const [name, ...kv] = arg.split(/\s+/);
        const vars = {};
        for (const s of kv) {
          const eq = s.indexOf('=');
          if (eq > 0) vars[s.slice(0, eq)] = s.slice(eq + 1);
        }
        reply('⚙️ Exécution du workflow *' + name + '*...');
        const r = await wf.runWorkflow(name, vars);
        reply('⚙️ *Workflow: ' + name + '*\n\n' + r.output + '\n\n' + elapsed());
        break;
      }
      case 'rag': {
        const url = /^https?:\/\//.test(arg) ? arg : (arg.startsWith('http') ? arg : '');
        if (!url) return reply('❌ Usage: .ainoria rag <https://lien-article>');
        reply('📥 Ingestion de la page dans la mémoire...');
        const r = await rag.ingestUrl(url, { maxChars: 20000 });
        reply('📥 *Mémorisé:* ' + r.title.slice(0, 100) + '\n\n_Chunks:_ ' + r.chunks + '\n_Source:_ ' + r.source + '\n\n' + elapsed());
        break;
      }
      case 'ask': {
        if (!arg) return reply('❌ Usage: .ainoria ask <question>');
        reply('🧠 Interrogation de la mémoire RAG...');
        const r = await rag.answer(arg);
        const sources = r.hits.length ? '\n\n_Sources:_\n' + r.hits.map(h => '• ' + h.title.slice(0, 60) + ' (' + h.source + ')').join('\n') : '';
        reply('🧠 *Réponse RAG:*\n\n' + r.answer + sources + '\n\n' + elapsed());
        break;
      }
      case 'stock': {
        if (!arg) return reply('❌ Usage: .ainoria stock <symbole>');
        const r = await finance.stockQuote(arg);
        if (!r.ok) return reply('❌ ' + r.error);
        reply('📈 *' + r.name + ' (' + r.symbol + ')*\nPrix: ' + r.price + ' ' + r.currency + '\nVariation: ' + r.change + '\nÉtat: ' + (r.marketState || '—') + '\n\n' + elapsed());
        break;
      }
      case 'crypto': {
        const sym = arg || 'btc';
        const r = await finance.cryptoQuote(sym);
        if (!r.ok) return reply('❌ ' + r.error);
        reply('🪙 *' + r.name + ' (' + r.symbol + ')*\nPrix: ' + r.price_usd + ' $' + (r.price_xof ? ' (' + r.price_xof + ' FCFA)' : '') + '\nVariation 24h: ' + r.change24h + '\nVariation 7j: ' + r.change7d + '\nCap: ' + r.market_cap + '\nVol 24h: ' + r.vol24h + '\n\n' + elapsed());
        break;
      }
      case 'or':
      case 'gold': {
        const r = await finance.goldPrice();
        if (!r.ok) return reply('❌ ' + r.error);
        reply('🪙 *' + r.name + '*\n' + r.usd_per_oz + ' USD/oz\n\n' + elapsed());
        break;
      }
      case 'fx':
      case 'forex': {
        const [from, to] = arg.split('-');
        if (!from || !to) return reply('❌ Usage: .ainoria fx USD-XOF');
        const r = await finance.forexRate(from, to);
        if (!r.ok) return reply('❌ ' + r.error);
        reply('💱 1 ' + r.from + ' = ' + r.rate + ' ' + r.to + '\n\n' + elapsed());
        break;
      }
      case 'workflows': {
        const list = wf.listWorkflows();
        reply('⚙️ *Workflows disponibles:*\n\n' + (list.length ? list.map(w => '• *' + w.name + '* — ' + w.description).join('\n') : 'Aucun workflow.'));
        break;
      }
      default: {
        reply(HELP);
      }
    }
  } catch (e) {
    reply('❌ Erreur AINORIA: ' + e.message);
  }
});