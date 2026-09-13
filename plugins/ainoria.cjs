const { cmd } = require('../command.cjs');
const ainoria = require('../lib/ainoria.cjs');
const web = require('../lib/tools/web-search.cjs');
const finance = require('../lib/tools/finance.cjs');
const rag = require('../lib/tools/rag.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
const { getBuffer } = require('../lib/functions.cjs');
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

    // ── Recherche web ──
    if (lower === 'search' && arg) {
      const r = await web.searchWeb(arg, 5);
      if (!r.length) return reply('Aucun résultat pour « ' + arg + ' ».');
      return reply('🔍 *' + arg + '*\n\n' + r.map((x, i) => `${i + 1}. ${x.titre}\n${x.url}\n${x.extrait || ''}`).join('\n\n') + '\n\n' + elapsed());
    }

    // ── Finance ──
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

    // ── RAG ──
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

    // ── Workflows ──
    if (lower === 'workflows') {
      const wf = require('../lib/tools/workflow-engine.cjs');
      const list = wf.listWorkflows();
      return reply('⚙️ Workflows: ' + (list.length ? list.map(w => w.name).join(', ') : 'aucun'));
    }

    // ── Vision : analyser une image ──
    if (lower === 'image' || lower === 'vision' || lower === 'scan') {
      const quoted = m.quoted || m;
      const isImage = quoted?.msg?.imageMessage || quoted?.type === 'imageMessage';
      if (!isImage) return reply('Réponds à une *image* avec .ainoria image\n\nExemple: .ainoria image Que contient cette image ?');
      await m.react('👁️');
      const buf = await downloadMediaMessage(quoted, 'scan_' + Date.now());
      if (!buf) return reply('Impossible de télécharger l\'image.');
      const prompt = arg || 'Décris cette image en français, en détail. Si tu vois du texte, transcris-le.';
      const answer = await ainoria.describeImage(buf.toString('base64'), prompt);
      return reply(answer + '\n\n' + elapsed());
    }

    // ── Transcription : transcrire un vocal ──
    if (lower === 'vocal' || lower === 'transcribe' || lower === 'stt') {
      const quoted = m.quoted || m;
      const isAudio = quoted?.msg?.audioMessage || quoted?.type === 'audioMessage' || quoted?.type === 'videoMessage';
      if (!isAudio) return reply('Réponds à un *message vocal* avec .ainoria vocal');
      await m.react('🎙️');
      const buf = await downloadMediaMessage(quoted, 'tts_' + Date.now());
      if (!buf) return reply('Impossible de télécharger l\'audio.');
      const result = await ainoria.transcribe(buf, { filename: 'audio.mp3' });
      if (!result || !result.text) return reply('Aucune parole détectée.');
      const dur = Math.round(result.duration || 0);
      return reply('📝 *TRANSCRIPTION*\n\n' + result.text +
        '\n\n' + elapsed() + (dur ? ' | 🎧 ' + dur + 's' : '') + (result.language ? ' | 🌐 ' + result.language : ''));
    }

    // ── Image generation : générer une image ──
    if (lower === 'dessine' || lower === 'imagegen' || lower === 'genimg') {
      if (!arg) return reply('Usage: .ainoria dessine <prompt>\n\nExemple: .ainoria dessine Un chat portant des lunettes de soleil');
      await m.react('🎨');
      try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(arg)}?nologo=true&width=1024&model=flux`;
        const buf = await getBuffer(url);
        if (!buf || !buf.length) return reply('Impossible de générer l\'image.');
        await conn.sendMessage(m.chat, { image: buf, caption: `🎨 *${arg}*` }, { quoted: m });
        return reply(elapsed());
      } catch (e) {
        return reply('Erreur génération image: ' + e.message);
      }
    }

    // ── Question IA — AINORIA répond avec son cerveau ──
    const reponse = await ainoria.chat(q);
    if (!reponse) return reply('AINORIA est temporairement indisponible. Réessaie bientôt.');
    return reply(reponse + '\n\n' + elapsed());

  } catch (e) {
    reply('Erreur AINORIA: ' + e.message);
  }
});
