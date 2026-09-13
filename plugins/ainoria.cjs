const { cmd } = require('../command.cjs');
const ainoria = require('../lib/ainoria.cjs');
const web = require('../lib/tools/web-search.cjs');
const finance = require('../lib/tools/finance.cjs');
const rag = require('../lib/tools/rag.cjs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Desktop', 'DJOUSSE-PDF');

function stripMd(s) {
  return String(s || '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/[_~`]/g, '').replace(/^#+\s*/gm, '').replace(/\|/g, ' | ').replace(/^[-–—]+\s*/gm, '• ').replace(/\$\$?/g, '');
}

function slugify(s) {
  const norm = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return norm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'fiche';
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

/* ══ .ainoria — le cerveau parle ══ */
cmd({ pattern: 'ainoria', alias: ['ainora', 'brain'], category: 'ai', filename: __filename, desc: 'AINORIA — cerveau IA central' }, async (conn, m, commands, { q, reply }) => {
  try {
    if (!q) return reply('AINORIA est actif. Pose-moi une question !');

    const t0 = Date.now();
    const elapsed = () => '⏱ ' + (Date.now() - t0) + 'ms';

    // ── Sous-commandes tools ──
    const [sub, ...rest] = q.trim().split(/\s+/);
    const arg = rest.join(' ').trim();
    const lower = sub.toLowerCase();

    // Recherche web
    if (lower === 'search' && arg) {
      const r = await web.searchWeb(arg, 5);
      if (!r.length) return reply('Aucun résultat pour « ' + arg + ' ».');
      return reply('🔍 *' + arg + '*\n\n' + r.map((x, i) => `${i + 1}. ${x.titre}\n${x.url}\n${x.extrait || ''}`).join('\n\n') + '\n\n' + elapsed());
    }

    // Finance
    if (lower === 'stock' && arg) {
      const r = await finance.stockQuote(arg);
      if (!r.ok) return reply(r.error);
      return reply(`📈 ${r.name} (${r.symbol})\nPrix: ${r.price} ${r.currency}\nVar: ${r.change}\nÉtat: ${r.marketState || '—'}`);
    }
    if (lower === 'crypto') {
      const r = await finance.cryptoQuote(arg || 'btc');
      if (!r.ok) return reply(r.error);
      return reply(`🪙 ${r.name} (${r.symbol})\nPrix: ${r.price_usd} $${r.price_xof ? ' (' + r.price_xof + ' FCFA)' : ''}\n24h: ${r.change24h}\n7j: ${r.change7d}`);
    }
    if (lower === 'or' || lower === 'gold') {
      const r = await finance.goldPrice();
      if (!r.ok) return reply(r.error);
      return reply(`🪙 ${r.name}\n${r.usd_per_oz} USD/oz`);
    }
    if ((lower === 'fx' || lower === 'forex') && arg) {
      const [from, to] = arg.split('-');
      if (!from || !to) return reply('Usage: .ainoria fx USD-XOF');
      const r = await finance.forexRate(from, to);
      if (!r.ok) return reply(r.error);
      return reply(`💱 1 ${r.from} = ${r.rate} ${r.to}`);
    }

    // RAG
    if (lower === 'rag' && arg) {
      const url = /^https?:\/\//.test(arg) ? arg : '';
      if (!url) return reply('Usage: .ainoria rag <url>');
      const r = await rag.ingestUrl(url, { maxChars: 20000 });
      return reply(`📥 Mémorisé: ${r.title.slice(0, 100)}\nChunks: ${r.chunks} | Source: ${r.source}`);
    }
    if (lower === 'ask' && arg) {
      const r = await rag.answer(arg);
      const sources = r.hits.length ? '\n\nSources:\n' + r.hits.map(h => '• ' + h.title.slice(0, 60)).join('\n') : '';
      return reply(r.answer + sources);
    }

    // Workflows
    if (lower === 'workflows') {
      const wf = require('../lib/tools/workflow-engine.cjs');
      const list = wf.listWorkflows();
      return reply('⚙️ Workflows: ' + (list.length ? list.map(w => w.name).join(', ') : 'aucun'));
    }

    // ── Question IA — AINORIA répond avec son cerveau ──
    const reponse = await ainoria.chat(q);
    if (!reponse) return reply('AINORIA est temporairement indisponible. Réessaie bientôt.');
    return reply(reponse + '\n\n' + elapsed());

  } catch (e) {
    reply('Erreur AINORIA: ' + e.message);
  }
});
