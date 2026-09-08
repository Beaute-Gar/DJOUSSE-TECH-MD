const { cmd } = require('../command.cjs');
const PDFDocument = require('pdfkit');

cmd({ pattern: 'pdf', desc: 'Générer un PDF à partir d\'un texte', category: 'tools', filename: __filename }, async (conn, m) => {
  const text = (m.body || '').split(' ').slice(1).join(' ').trim() || m.quoted?.text || '';
  if (!text) return m.reply('❌ Usage: .pdf <texte>\nOu réponds à un message avec .pdf');
  m.reply('📄 Génération du PDF...');
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    const done = new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#050a12').text('DJOUSSE TECH', { align: 'center' });
    doc.moveDown();
    doc.font('Helvetica').fontSize(11).fillColor('#000000').text(text, { align: 'left' });
    doc.moveDown();
    doc.fontSize(9).fillColor('#888888').text(`Généré le ${new Date().toLocaleString('fr-FR')} — © DJOUSSE TECH`, { align: 'center' });
    doc.end();
    await done;
    const buf = Buffer.concat(chunks);
    await conn.sendMessage(m.chat, {
      document: buf,
      mimetype: 'application/pdf',
      fileName: `DJOUSSE-${Date.now()}.pdf`,
      caption: '📄 Document généré',
    }, { quoted: m });
  } catch (e) { m.reply('❌ ' + e.message); }
});