const { cmd } = require('../command.cjs');
const { addMember, removeMember, listMembers, getMemberInfo, normalizeNumber } = require('../lib/member-access.cjs');

/* ══════════════════════════════════════════════════════════════════════
   member-access.cjs — Gestion des membres autorisés à utiliser le bot
   
   .accept @membre1 @membre2  → Autoriser des membres (owner only)
   .deny @membre1 @membre2    → Retirer l'accès (owner only)
   .listusers                  → Liste des membres autorisés (owner only)
   .checkuser @membre          → Vérifier si un membre est autorisé
   ══════════════════════════════════════════════════════════════════════ */

function extractNumbers(m, q) {
  const numbers = [];
  // From mentions
  if (m.mentionedJid && m.mentionedJid.length) {
    for (const jid of m.mentionedJid) {
      const num = normalizeNumber(jid);
      if (num && num.length >= 7) numbers.push(num);
    }
  }
  // From text (phone numbers after @ or standalone)
  if (q) {
    const matches = q.match(/\d{7,15}/g) || [];
    for (const n of matches) {
      if (!numbers.includes(n)) numbers.push(n);
    }
  }
  return numbers;
}

cmd({
  pattern: 'accept',
  alias: ['adduser', 'authorize'],
  category: 'owner',
  fromMe: true,
  desc: 'Autoriser des membres à utiliser le bot',
  filename: __filename
}, async (conn, m, commands, { q, reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');
  
  const numbers = extractNumbers(m, q);
  if (!numbers.length) {
    return reply(
      '📋 *Utilisation :*\n' +
      '.accept @membre1 @membre2\n\n' +
      '💡 Tu peux aussi coller un numéro :\n' +
      '.accept 237693978044'
    );
  }

  let added = 0;
  let already = 0;
  let invalid = 0;
  const results = [];

  for (const num of numbers) {
    const result = addMember(num, m.sender, '');
    if (result.ok) {
      added++;
      results.push('✅ +' + num);
    } else if (result.reason === 'Déjà autorisé') {
      already++;
      results.push('ℹ️ +' + num + ' (déjà autorisé)');
    } else {
      invalid++;
      results.push('❌ +' + num + ' (invalide)');
    }
  }

  const summary = '🔐 *Résultat :*\n\n' + results.join('\n') +
    '\n\n📊 Total : ' + added + ' ajouté(s), ' + already + ' déjà autorisé(s), ' + invalid + ' invalide(s)';
  
  reply(summary);
});

cmd({
  pattern: 'deny',
  alias: ['removeuser', 'deauthorize', 'ban'],
  category: 'owner',
  fromMe: true,
  desc: 'Retirer l\'accès de membres',
  filename: __filename
}, async (conn, m, commands, { q, reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');
  
  const numbers = extractNumbers(m, q);
  if (!numbers.length) {
    return reply(
      '📋 *Utilisation :*\n' +
      '.deny @membre1 @membre2\n\n' +
      '💡 Tu peux aussi coller un numéro :\n' +
      '.deny 237693978044'
    );
  }

  let removed = 0;
  let notFound = 0;
  const results = [];

  for (const num of numbers) {
    const result = removeMember(num);
    if (result.ok) {
      removed++;
      results.push('🗑️ +' + num + ' retiré');
    } else {
      notFound++;
      results.push('ℹ️ +' + num + ' (non trouvé)');
    }
  }

  const summary = '🔐 *Résultat :*\n\n' + results.join('\n') +
    '\n\n📊 Total : ' + removed + ' retiré(s), ' + notFound + ' non trouvé(s)';
  
  reply(summary);
});

cmd({
  pattern: 'listusers',
  alias: ['users', 'listuser', 'membres'],
  category: 'owner',
  fromMe: true,
  desc: 'Liste des membres autorisés',
  filename: __filename
}, async (conn, m, commands, { reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');
  
  const members = listMembers();
  if (!members.length) {
    return reply('📋 Aucun membre autorisé.\n\nUtilise *.accept @membre* pour en ajouter.');
  }

  let text = '👥 *Membres autorisés* (' + members.length + ')\n\n';
  for (let i = 0; i < members.length; i++) {
    const mb = members[i];
    const date = mb.addedAt ? new Date(mb.addedAt).toLocaleDateString('fr-FR') : '?';
    text += (i + 1) + '. +' + mb.number + (mb.name ? ' (' + mb.name + ')' : '') + '\n';
    text += '   📅 Ajouté le ' + date + '\n';
  }
  text += '\n💡 Tapez *.accept @membre* pour ajouter';
  text += '\n💡 Tapez *.deny @membre* pour retirer';
  
  reply(text);
});

cmd({
  pattern: 'checkuser',
  alias: ['check', 'verifier'],
  category: 'owner',
  fromMe: true,
  desc: 'Vérifier si un membre est autorisé',
  filename: __filename
}, async (conn, m, commands, { q, reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');
  
  const numbers = extractNumbers(m, q);
  if (!numbers.length) {
    return reply('📋 *Utilisation :* .checkuser @membre ou .checkuser 237693978044');
  }

  let text = '🔍 *Vérification :*\n\n';
  
  for (const num of numbers) {
    const info = getMemberInfo(num);
    if (info) {
      const date = info.addedAt ? new Date(info.addedAt).toLocaleDateString('fr-FR') : '?';
      text += '✅ +' + num + ' — *AUTORISÉ*\n';
      text += '   📅 Ajouté le ' + date + '\n';
      if (info.addedBy) text += '   👤 Par +' + info.addedBy + '\n';
    } else {
      text += '❌ +' + num + ' — *NON AUTORISÉ*\n';
    }
  }
  
  reply(text);
});
