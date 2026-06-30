import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';
import { api } from '../cognitive-api.js';
import { executor, ACTION_TYPES } from '../action-executor.js';
import { workspaceManager } from './workspace-manager.js';
import { discovery } from './auto-discovery.js';
import { groupFactory } from './group-agent-factory.js';
import { orchestrator } from '../agents/agent-framework.js';
import { trust, audit, approval, policy } from '../governance/index.js';
import { planner } from '../planning-engine.js';
import { semanticMemory } from '../semantic-memory.js';

const log = createLogger('OSCMD');

const HANDLERS = {
  'aide':         cmdHelp,
  'help':         cmdHelp,
  'groups':       cmdGroups,
  'groupes':      cmdGroups,
  'groupe':       cmdGroupDetail,
  'agents':       cmdAgents,
  'stats':        cmdStats,
  'statistiques': cmdStats,
  'missions':     cmdMissions,
  'resume':       cmdResume,
  'resumé':       cmdResume,
  'memory':       cmdMemory,
  'mémoire':      cmdMemory,
  'recherche':    cmdSearch,
  'search':       cmdSearch,
  'sante':        cmdHealth,
  'santé':        cmdHealth,
  'health':       cmdHealth,
  'confiance':    cmdTrust,
  'audit':        cmdAudit,
  'politique':    cmdPolicy,
  'autonomie':    cmdAutonomy,
  'sync':         cmdSync,
  'synchronisation': cmdSync,
  'cleanup':      cmdCleanup,
};

export async function handleOSCommand(ctx, sock) {
  const text = ctx.cleanText || ctx.text || '';
  const args = text.replace(/^\.os\s*/i, '').trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  const param = args.join(' ');

  if (!command) return cmdHelp(ctx, sock);

  const handler = HANDLERS[command];
  if (!handler) {
    await sendReply(ctx, sock, '❓ Commande .OS inconnue : *' + command + '*.\n\n.OS aide pour voir les commandes disponibles.');
    return;
  }

  const ws = workspaceManager.getByJid(ctx.jid) || workspaceManager.getByJid(ctx.senderJid);
  if (!ws) {
    await sendReply(ctx, sock, `⚠️ Aucun workspace trouvé. Assurez-vous d'être connecté.`);
    return;
  }

  workspaceManager.touch(ws.ownerJid);
  log.info(`[OSCMD] ${ctx.senderJid} → .OS ${command} ${param}`);

  try {
    await handler(ctx, sock, ws, command, param);
  } catch (err) {
    log.error(`[OSCMD] ${command}: ${err.message}`);
    await sendReply(ctx, sock, `❌ Erreur: ${err.message}`);
  }
}

async function cmdHelp(ctx, sock) {
  const lines = [
    '╔══ *COGNITIVE OS — Commandes* ══╗\n',
    '📋 *Général*',
    '  .OS aide           — Cette aide',
    '  .OS santé          — État du système',
    '  .OS stats          — Statistiques globales',
    '  .OS résumé         — Résumé intelligent',
    '',
    '👥 *Groupes & Contacts*',
    '  .OS groupes        — Liste des groupes',
    '  .OS groupe <nom>   — Détail d\'un groupe',
    '',
    '🎯 *Missions*',
    '  .OS missions       — Missions actives',
    '',
    '🧠 *Connaissances*',
    '  .OS recherche <q>  — Recherche intelligente',
    '  .OS mémoire        — Mémoire récente',
    '',
    '🤖 *Agents*',
    '  .OS agents         — Statut des agents',
    '  .OS confiance      — Scores de confiance',
    '  .OS audit          — Dernières actions',
    '',
    '⚙️ *Administration*',
    '  .OS autonomie <niveau> — Observation/Suggestion/Assisté/Autonome',
    '  .OS politique      — Politiques actives',
    '  .OS sync           — Forcer la découverte',
    '  .OS cleanup        — Nettoyer le workspace',
    '',
    '╚══ *Utilisation dans un groupe = contexte automatique* ══╝',
  ];
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdGroups(ctx, sock, ws) {
  const groups = Array.from(ws.groups.values());
  if (groups.length === 0) {
    await sendReply(ctx, sock, '📭 Aucun groupe découvert. Lance `.OS sync` pour scanner.');
    return;
  }
  const adminGroups = groups.filter(g => g.isAdmin);
  const memberGroups = groups.filter(g => !g.isAdmin);
  const lines = [`📋 *${groups.length} groupes découverts*`];
  lines.push(`👑 Admin: ${adminGroups.length} | 👤 Membre: ${memberGroups.length}\n`);
  if (adminGroups.length > 0) {
    lines.push('*👑 Administration:*');
    for (const g of adminGroups.slice(0, 10)) {
      lines.push(`  • ${g.subject} (${g.size || '?'} membres)`);
    }
  }
  if (memberGroups.length > 0) {
    lines.push('\n*👤 Simple membre:*');
    for (const g of memberGroups.slice(0, 10)) {
      lines.push(`  • ${g.subject} (${g.size || '?'} membres)`);
    }
  }
  if (groups.length > 20) lines.push(`\n📌 ${groups.length - 20} groupes supplémentaires...`);
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdGroupDetail(ctx, sock, ws, cmd, param) {
  if (!param) {
    await sendReply(ctx, sock, 'Indique le nom du groupe : `.OS groupe "Nom du groupe"`');
    return;
  }
  const groups = Array.from(ws.groups.values());
  const match = groups.find(g => g.subject?.toLowerCase().includes(param.toLowerCase()));
  if (!match) {
    await sendReply(ctx, sock, `❌ Aucun groupe trouvé pour "${param}"`);
    return;
  }
  const lines = [
    `📁 *${match.subject}*`,
    `  JID: ${match.jid}`,
    `  Membres: ${match.size || '?'}`,
    `  Admin: ${match.isAdmin ? '✅ Oui' : '❌ Non'}`,
    `  Découvert: ${new Date(match.addedAt).toLocaleDateString()}`,
    `  Dernière activité: ${match.lastActive ? new Date(match.lastActive).toLocaleDateString() : 'N/A'}`,
  ];
  const groupContext = await api.remember('', { jid: match.jid }).catch(() => ({}));
  if (groupContext?.semantic?.length > 0) {
    lines.push(`  Messages en mémoire: ${groupContext.semantic.length}`);
  }
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdAgents(ctx, sock, ws) {
  const agents = await orchestrator.list();
  const lines = ['🤖 *Agents Cognitifs*\n'];
  for (const a of agents) {
    const trustScore = a.trustScore != null ? (a.trustScore * 100).toFixed(0) : 'N/A';
    const autonomy = a.autonomy != null ? (a.autonomy * 100).toFixed(0) : 'N/A';
    lines.push(`• *${a.name}*`);
    lines.push(`  État: ${a.state} | Confiance: ${trustScore}% | Autonomie: ${autonomy}%`);
    lines.push(`  Exécutions: ${a.executions} | Erreurs: ${a.errors}`);
  }
  lines.push(`\n📊 Workspace: ${ws.id} | Mode: ${ws.autonomy}`);
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdStats(ctx, sock, ws) {
  const wsStats = ws.getStats();
  const trustSummary = trust.getSummary();
  const auditSummary = audit.summary();
  const approvalStats = approval.getStats();
  const missionStats = planner.getStats();

  const lines = [
    '📊 *Djousse-Tech MD — Statistiques*\n',
    `🧠 *Workspace*`,
    `  ID: ${wsStats.groupsTotal}g / ${wsStats.contactsTotal}c`,
    `  Mode: ${wsStats.autonomy}`,
    `  Uptime: ${Math.floor(wsStats.uptime / 3600000)}h`,
    '',
    `🎯 *Missions*`,
    `  Actives: ${missionStats.active || 0} | Retard: ${missionStats.overdue || 0}`,
    '',
    `🤖 *Agents*`,
    `  Confiance moyenne: ${trustSummary.averageScore ? (trustSummary.averageScore * 100).toFixed(0) : 'N/A'}%`,
    `  Fiables: ${trustSummary.trusted} | Critiques: ${trustSummary.critical}`,
    '',
    `📋 *Gouvernance*`,
    `  Audit (24h): ${auditSummary.total} | Erreurs: ${auditSummary.errors}`,
    `  Approbations en attente: ${approvalStats.pending}`,
  ];
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdMissions(ctx, sock, ws) {
  const missions = planner.getAllMissions();
  const active = missions.filter(m => m.status === 'active' || m.status === 'pending');
  const lines = ['🎯 *Missions*\n'];
  if (active.length === 0) {
    lines.push('Aucune mission active.');
  } else {
    for (const m of active.slice(0, 10)) {
      lines.push(`• *${m.title}*`);
      lines.push(`  Progrès: ${m.progress || 0}% | Priorité: ${m.priority || 'N/A'}`);
      if (m.tags?.length) lines.push(`  Tags: ${m.tags.join(', ')}`);
    }
    if (active.length > 10) lines.push(`\n📌 +${active.length - 10} missions...`);
  }
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdResume(ctx, sock, ws) {
  const recentAudit = audit.getRecent(10);
  const pendingApprovals = approval.listPending();
  const missionStats = planner.getStats();
  const agents = await orchestrator.list();

  const lines = ['📋 *Résumé Cognitif*\n'];
  const urgentTasks = missionStats.overdue > 0 ? `⚠️ ${missionStats.overdue} missions en retard` : '✅ Aucune mission en retard';
  lines.push(`*Urgent:* ${urgentTasks}`);
  lines.push(`*Missions:* ${missionStats.active || 0} actives, ${missionStats.completed || 0} terminées`);
  lines.push(`*Agents:* ${agents.length} actifs`);
  if (pendingApprovals.length > 0) {
    lines.push(`*Approbations:* ${pendingApprovals.length} en attente`);
    for (const a of pendingApprovals) lines.push(`  ⏳ ${a.action.type || 'action'} par ${a.context?.agent || '?'}`);
  }
  lines.push(`\n*Dernières activités:*`);
  for (const e of recentAudit.slice(-5).reverse()) {
    lines.push(`  • ${e.agent}: ${e.action} → ${e.result}`);
  }
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdMemory(ctx, sock, ws) {
  const jid = ctx.jid;
  const recent = await api.remember('', { jid, limit: 5 });
  const lines = ['🧠 *Mémoire récente*\n'];
  if (recent.semantic?.length > 0) {
    for (const s of recent.semantic.slice(0, 5)) {
      lines.push(`• ${typeof s === 'string' ? s.slice(0, 120) : JSON.stringify(s).slice(0, 120)}`);
    }
  } else {
    lines.push('Aucune mémoire récente pour ce contexte.');
  }
  lines.push(`\n📌 Contextes mémoire: ${recent.timeline?.length || 0} entrées`);
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdSearch(ctx, sock, ws, cmd, param) {
  if (!param) {
    await sendReply(ctx, sock, 'Indique ta recherche : `.OS recherche "sujet"`');
    return;
  }
  const results = await api.search(param, { includeMissions: true });
  const lines = [`🔍 *Recherche: "${param}"*\n`];
  let count = 0;
  if (results.objects?.length > 0) {
    lines.push(`*Objets:* ${results.objects.length}`);
    for (const o of results.objects.slice(0, 3)) lines.push(`  • ${o.summary || o.id}`);
    count += results.objects.length;
  }
  if (results.missions?.length > 0) {
    lines.push(`*Missions:* ${results.missions.length}`);
    for (const m of results.missions.slice(0, 3)) lines.push(`  • ${m.title} (${m.status})`);
    count += results.missions.length;
  }
  if (results.concepts?.length > 0) {
    lines.push(`*Concepts:* ${results.concepts.slice(0, 5).map(c => c.name).join(', ')}`);
    count += results.concepts.length;
  }
  if (count === 0) lines.push('Aucun résultat trouvé.');
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdHealth(ctx, sock, ws) {
  const agents = await orchestrator.list();
  const errors = agents.reduce((s, a) => s + a.errors, 0);
  const totalExec = agents.reduce((s, a) => s + a.executions, 0);
  const failedAgents = agents.filter(a => a.state === 'error');
  const lines = [
    '🩺 *Santé du Djousse-Tech MD*\n',
    `🟢 Runtime: actif`,
    `🧠 Analyseurs: 14 actifs`,
    `🤖 Agents: ${agents.length} (${failedAgents.length} en erreur)`,
    `📊 Exécutions: ${totalExec} | Erreurs: ${errors}`,
    `💾 Audit: ${audit.size} entrées`,
    `🔄 Workspaces: ${workspaceManager.list().length}`,
  ];
  if (failedAgents.length > 0) {
    lines.push(`\n⚠️ *Agents en erreur:*`);
    for (const a of failedAgents) lines.push(`  • ${a.name}: ${a.errors} erreurs`);
  }
  const pending = approval.listPending();
  if (pending.length > 0) lines.push(`\n⏳ ${pending.length} approbation(s) en attente`);
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdTrust(ctx, sock, ws) {
  const summary = trust.getSummary();
  const lines = ['🔐 *Confiance des Agents*\n'];
  if (summary.all) {
    for (const a of summary.all) {
      const bar = '█'.repeat(Math.floor(a.score * 20)) + '░'.repeat(20 - Math.floor(a.score * 20));
      const pct = (a.score * 100).toFixed(0);
      lines.push(`• *${a.agent}* [${bar}] ${pct}%`);
      lines.push(`  Succès: ${a.successRate || 0}% | Autonomie: ${(a.autonomy * 100).toFixed(0)}%`);
    }
  }
  lines.push(`\n📊 Moyenne: ${summary.averageScore ? (summary.averageScore * 100).toFixed(0) : 'N/A'}%`);
  lines.push(`✅ Fiables: ${summary.trusted} | ⚠️ Critiques: ${summary.critical}`);
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdAudit(ctx, sock, ws) {
  const recent = audit.getRecent(10);
  const lines = ['📋 *Audit — Dernières actions*\n'];
  for (const e of recent.reverse()) {
    const icon = e.result === 'success' ? '✅' : e.result === 'error' ? '❌' : '⚠️';
    const time = new Date(e.timestamp).toLocaleTimeString();
    lines.push(`${icon} [${time}] *${e.agent}*: ${e.action} sur ${e.resource || '?'}`);
    if (e.reason) lines.push(`   → ${e.reason}`);
  }
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdPolicy(ctx, sock, ws) {
  const policies = policy.list();
  const lines = ['📜 *Politiques actives*\n'];
  for (const p of policies) {
    const icon = p.enabled ? '✅' : '⛔';
    const matches = p.matchCount || 0;
    lines.push(`${icon} *${p.name}* (${p.effect})`);
    lines.push(`   Déclenché ${matches} fois | Priorité ${p.priority}`);
  }
  await sendReply(ctx, sock, lines.join('\n'));
}

async function cmdAutonomy(ctx, sock, ws, cmd, param) {
  const levels = ['observation', 'suggestion', 'assisted', 'autonomous'];
  if (!param || !levels.includes(param.toLowerCase())) {
    await sendReply(ctx, sock,
      `Niveau actuel: *${ws.autonomy}*\n\nNiveaux disponibles:\n` +
      levels.map(l => `  • ${l === ws.autonomy ? '➡️' : ' '} ${l}`).join('\n') +
      `\n\nUtilisation: .OS autonomie <niveau>`
    );
    return;
  }
  workspaceManager.setAutonomy(ws.ownerJid, param.toLowerCase());
  await sendReply(ctx, sock, `✅ Autonomie passée à *${param}*`);
}

async function cmdSync(ctx, sock, ws) {
  await sendReply(ctx, sock, '🔄 Lancement de la découverte...');
  try {
    const result = await discovery.discoverAll(sock, ws.ownerJid);
    if (result) {
      await sendReply(ctx, sock,
        `✅ Découverte terminée.\n📁 ${result.groups.length} groupes | 👥 ${result.contacts.length} contacts`
      );
    }
  } catch (err) {
    await sendReply(ctx, sock, `❌ Erreur: ${err.message}`);
  }
}

async function cmdCleanup(ctx, sock, ws) {
  await sendReply(ctx, sock, '🧹 Nettoyage du workspace...');
  try {
    const groups = Array.from(ws.groups.values());
    for (const g of groups) {
      try {
        const meta = await sock.groupMetadata(g.jid);
        if (!meta) ws.removeGroup(g.jid);
      } catch {
        ws.removeGroup(g.jid);
      }
    }
    await sendReply(ctx, sock, `✅ Nettoyage terminé. ${groups.length - ws.groups.size} groupes retirés.`);
  } catch (err) {
    await sendReply(ctx, sock, `❌ Erreur: ${err.message}`);
  }
}

async function sendReply(ctx, sock, text) {
  try {
    if (ctx.m?.reply) {
      await ctx.m.reply(text);
    } else if (sock?.sendMessage) {
      await executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid: ctx.jid, text },
        source: 'os-commands:sendReply',
      });
    }
  } catch (err) {
    log.error(`[OSCMD] sendReply: ${err.message}`);
  }
}
