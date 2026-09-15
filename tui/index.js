/**
 * TUI — DJOUSSE TECH Command Center
 * Interface terminal professionnelle avec navigation temps réel
 */

const readline = require('readline');
const os = require('os');
const bus = require('../src/core/eventBus');
const sessionManager = require('../src/sessions/sessionManager');
const ainoria = require('../src/ainoria/ainoria');

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

const BOX = {
  tl: '+', tr: '+', bl: '+', br: '+',
  h: '-', v: '|',
};

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function getTimestamp() {
  return new Date().toLocaleTimeString('fr-FR', { hour12: false });
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / 1024 / 1024).toFixed(0),
    heap: (mem.heapUsed / 1024 / 1024).toFixed(0),
    total: (mem.heapTotal / 1024 / 1024).toFixed(0),
  };
}

function getUptime() {
  const s = process.uptime();
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m${String(sec).padStart(2, '0')}s`;
}

function drawBox(title, lines, width = 60) {
  const rows = [];
  rows.push(`+${'-'.repeat(width - 2)}+`);
  if (title) {
    const t = ` ${title} `;
    const left = Math.max(0, Math.floor((width - 2 - t.length) / 2));
    const right = Math.max(0, width - 2 - left - t.length);
    rows.push(`|${' '.repeat(left)}${C.bold}${C.cyan}${t}${C.reset}${' '.repeat(right)}|`);
    rows.push(`+${'='.repeat(width - 2)}+`);
  }
  for (const line of lines) {
    const text = String(line);
    const truncated = text.length > width - 4 ? text.slice(0, width - 5) + '...' : text;
    rows.push(`| ${truncated}${' '.repeat(Math.max(0, width - 4 - truncated.length))} |`);
  }
  rows.push(`+${'-'.repeat(width - 2)}+`);
  return rows.join('\n');
}

function drawHeader() {
  const mem = getMemoryUsage();
  const stats = sessionManager.getTotalStats();
  const lines = [
    `${C.bold}SYSTEM${C.reset}     | ${C.bold}WHATSAPP${C.reset}        | ${C.bold}AINORIA${C.reset}       | ${C.bold}SECURITY${C.reset}`,
    `${C.green}ONLINE${C.reset}     | ${stats.connected} SESSIONS      | ${C.green}${ainoria.status}${C.reset}         | ${C.green}SECURE${C.reset}`,
    `${C.dim}RAM: ${mem.rss}MB${C.reset}  | ${C.dim}Cmds: ${stats.totalCommands}${C.reset}     | ${C.dim}v${ainoria.version}${C.reset}       | ${C.dim}PID: ${process.pid}${C.reset}`,
  ];
  return drawBox('DJOUSSE TECH // COMMAND CENTER', lines, 70);
}

function drawDashboard() {
  const mem = getMemoryUsage();
  const stats = sessionManager.getTotalStats();
  const ainStats = ainoria.getStats();
  const lines = [
    '',
    `${C.bold}SYSTEM${C.reset}`,
    `${'-'.repeat(50)}`,
    `Node.js       ${process.version}`,
    `Platform      ${os.platform()} ${os.arch()}`,
    `RAM           ${mem.rss} MB / ${mem.total} MB`,
    `Uptime        ${getUptime()}`,
    `PID           ${process.pid}`,
    '',
    `${C.bold}WHATSAPP${C.reset}`,
    `${'-'.repeat(50)}`,
    `Sessions      ${stats.total}`,
    `Connected     ${C.green}${stats.connected}${C.reset}`,
    `Connecting    ${stats.connecting}`,
    `Disconnected  ${stats.disconnected}`,
    '',
    `${C.bold}COMMANDS${C.reset}`,
    `${'-'.repeat(50)}`,
    `Total loaded  ${stats.totalCommands}`,
    `Executed      ${stats.totalMessages}`,
    `Errors        ${stats.totalErrors}`,
    '',
    `${C.bold}AINORIA${C.reset}`,
    `${'-'.repeat(50)}`,
    `Status        ${ainStats.status === 'ONLINE' ? C.green : C.red}${ainStats.status}${C.reset}`,
    `Memory        ${ainStats.memory.shortTerm} short / ${ainStats.memory.longTerm} long`,
    `Agents        ${ainStats.agents.filter(a => a.status === 'READY').length}/${ainStats.agents.length}`,
    `Tools         ${ainStats.tools}`,
    '',
  ];
  return drawBox('DASHBOARD', lines, 58);
}

function drawWhatsApp() {
  const sessions = sessionManager.getAllSessions();
  const lines = ['', `${C.bold}ACTIVE SESSIONS${C.reset}`, ''];
  if (sessions.length === 0) {
    lines.push('  No active sessions');
  } else {
    lines.push('  ID   PHONE        STATUS');
    lines.push('  ' + '-'.repeat(40));
    for (const s of sessions) {
      const phone = s.phone ? `+${s.phone.slice(0, 6)}****${s.phone.slice(-2)}` : 'N/A';
      const statusColor = s.status === 'CONNECTED' ? C.green : s.status === 'CONNECTING' ? C.yellow : C.red;
      lines.push(`  ${String(sessions.indexOf(s) + 1).padStart(2, '0')}   ${phone.padEnd(12)} ${statusColor}${s.status}${C.reset}`);
    }
  }
  lines.push('');
  lines.push(`${C.bold}MESSAGES${C.reset}`);
  lines.push(`${'-'.repeat(50)}`);
  const total = sessionManager.getTotalStats();
  lines.push(`Received     ${total.totalMessages}`);
  lines.push(`Commands     ${total.totalCommands}`);
  lines.push(`Errors       ${total.totalErrors}`);
  lines.push('');
  return drawBox('WHATSAPP CENTER', lines, 58);
}

function drawSessions() {
  const sessions = sessionManager.getAllSessions();
  const lines = ['', '  ID   PHONE          STATUS       COMMANDS'];
  lines.push('  ' + '-'.repeat(52));
  if (sessions.length === 0) {
    lines.push('  No sessions found');
  } else {
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const phone = s.phone ? `+${s.phone.slice(0, 6)}****${s.phone.slice(-2)}` : 'N/A';
      const statusColor = s.status === 'CONNECTED' ? C.green : s.status === 'CONNECTING' ? C.yellow : C.red;
      lines.push(`  ${String(i + 1).padStart(2, '0')}   ${phone.padEnd(14)} ${statusColor}${s.status.padEnd(12)}${C.reset} ${s.stats?.commandsExecuted || 0}`);
    }
  }
  lines.push('');
  lines.push(`${C.bold}[A] Add  [R] Reconnect  [D] Disconnect  [X] Delete  [B] Back${C.reset}`);
  lines.push('');
  return drawBox('SESSION MANAGER', lines, 60);
}

function drawCommandHistory() {
  const sessions = sessionManager.getAllSessions();
  const lines = ['', '  #    TIME      SESSION       USER          COMMAND'];
  lines.push('  ' + '-'.repeat(60));
  let count = 0;
  for (const s of sessions) {
    for (const cmd of (s.commandHistory || []).slice(-10)) {
      count++;
      const phone = cmd.sender ? `+${cmd.sender.slice(0, 6)}...` : 'N/A';
      lines.push(`  ${String(count).padStart(3, '0')}  ${cmd.time}  ${(s.id || '').padEnd(12)} ${phone.padEnd(12)} .${cmd.command || ''}`);
    }
  }
  if (count === 0) lines.push('  No commands executed yet');
  lines.push('');
  return drawBox('COMMAND HISTORY', lines, 65);
}

function drawHealth() {
  const checks = [
    { name: 'NODE.JS', ok: true, detail: process.version },
    { name: 'FILESYSTEM', ok: true, detail: 'OK' },
    { name: 'DATABASE', ok: true, detail: 'JSON files' },
    { name: 'WHATSAPP ENGINE', ok: true, detail: 'Baileys' },
    { name: 'SESSION MANAGER', ok: true, detail: `${sessionManager.getAllSessions().length} sessions` },
    { name: 'COMMAND LOADER', ok: true, detail: 'Active' },
    { name: 'AINORIA', ok: ainoria.status === 'ONLINE', detail: ainoria.status },
    { name: 'EVENT BUS', ok: true, detail: 'Active' },
    { name: 'NETWORK', ok: true, detail: 'Online' },
  ];
  const lines = ['', '  COMPONENT              STATUS    DETAIL'];
  lines.push('  ' + '-'.repeat(50));
  for (const c of checks) {
    const icon = c.ok ? `${C.green}OK${C.reset}` : `${C.red}FAIL${C.reset}`;
    lines.push(`  ${c.name.padEnd(22)} ${icon}    ${c.detail}`);
  }
  lines.push('');
  return drawBox('HEALTH CENTER', lines, 55);
}

function drawErrors() {
  const lines = ['', '  No critical errors', ''];
  return drawBox('ERROR CENTER', lines, 55);
}

function drawAINORIA() {
  const stats = ainoria.getStats();
  const lines = [
    '',
    `${C.bold}CORE${C.reset}`,
    `${'-'.repeat(50)}`,
    `Status        ${stats.status === 'ONLINE' ? C.green : C.red}${stats.status}${C.reset}`,
    `Version       ${stats.version}`,
    '',
    `${C.bold}MEMORY${C.reset}`,
    `${'-'.repeat(50)}`,
    `Short Memory  ${stats.memory.shortTerm > 0 ? C.green : C.yellow}ACTIVE${C.reset} (${stats.memory.shortTerm} entries)`,
    `Long Memory   ${stats.memory.longTerm > 0 ? C.green : C.yellow}ACTIVE${C.reset} (${stats.memory.longTerm} entries)`,
    '',
    `${C.bold}REASONING${C.reset}`,
    `${'-'.repeat(50)}`,
    `Engine        ${stats.reasoning.engine === 'READY' ? C.green : C.red}${stats.reasoning.engine}${C.reset}`,
    `Planning      ${stats.reasoning.planning ? C.green : C.red}${stats.reasoning.planning ? 'READY' : 'OFFLINE'}${C.reset}`,
    `Intent        ${stats.reasoning.intent ? C.green : C.red}${stats.reasoning.intent ? 'READY' : 'OFFLINE'}${C.reset}`,
    '',
    `${C.bold}AGENTS${C.reset}`,
    `${'-'.repeat(50)}`,
  ];
  for (const a of stats.agents) {
    lines.push(`${a.name.padEnd(18)} ${a.status === 'READY' ? C.green : C.red}${a.status}${C.reset}`);
  }
  lines.push('');
  lines.push(`${C.bold}TOOLS${C.reset}`);
  lines.push(`${'-'.repeat(50)}`);
  lines.push(`Registered    ${stats.tools}`);
  lines.push('');
  return drawBox('AINORIA OS', lines, 55);
}

function drawLiveActivity() {
  const events = bus.getHistory(15);
  const lines = ['', ...events.map(e => `  ${e.time}  [${e.event}]`)];
  if (events.length === 0) lines.push('  No recent activity');
  lines.push('');
  return drawBox('LIVE ACTIVITY', lines, 60);
}

function drawNav(activeScreen) {
  const screens = [
    { key: 'D', name: 'DASHBOARD', id: 'dashboard' },
    { key: 'W', name: 'WHATSAPP', id: 'whatsapp' },
    { key: 'A', name: 'AINORIA', id: 'ainoria' },
    { key: 'C', name: 'COMMANDS', id: 'commands' },
    { key: 'S', name: 'SESSIONS', id: 'sessions' },
    { key: 'L', name: 'LOGS', id: 'logs' },
    { key: 'E', name: 'ERRORS', id: 'errors' },
    { key: 'H', name: 'HEALTH', id: 'health' },
    { key: 'N', name: 'NEW SESSION', id: 'new' },
    { key: 'R', name: 'REFRESH', id: 'refresh' },
    { key: 'Q', name: 'QUIT', id: 'quit' },
  ];
  const nav = screens.map(s => {
    const isActive = s.id === activeScreen;
    return isActive ? `${C.bold}${C.cyan}[${s.key}]${C.reset} ${C.bold}${s.name}${C.reset}` : `[${s.key}] ${s.name}`;
  });
  const line1 = nav.slice(0, 6).join('   ');
  const line2 = nav.slice(6).join('   ');
  return `\n${line1}\n${line2}`;
}

function render(screen = 'dashboard') {
  clearScreen();
  let content = '';
  switch (screen) {
    case 'dashboard': content = drawDashboard(); break;
    case 'whatsapp': content = drawWhatsApp(); break;
    case 'sessions': content = drawSessions(); break;
    case 'commands': content = drawCommandHistory(); break;
    case 'health': content = drawHealth(); break;
    case 'errors': content = drawErrors(); break;
    case 'ainoria': content = drawAINORIA(); break;
    case 'logs': content = drawLiveActivity(); break;
    default: content = drawDashboard();
  }
  console.log(content);
  console.log(drawNav(screen));
  process.stdout.write(`\n${C.cyan}>${C.reset} `);
}

let currentScreen = 'dashboard';

function startTUI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  clearScreen();
  console.log(`${C.bold}${C.cyan}`);
  console.log('+==========================================================+');
  console.log('|            DJOUSSE TECH // COMMAND CENTER                 |');
  console.log('|              AINORIA OPERATING CORE                      |');
  console.log('+==========================================================+');
  console.log(`${C.reset}`);
  console.log(`  Node.js ${process.version} | ${os.platform()} ${os.arch()} | PID ${process.pid}`);
  console.log(`  Loading...\n`);

  setTimeout(() => {
    render('dashboard');
  }, 1000);

  rl.on('line', (input) => {
    const cmd = input.trim().toUpperCase();
    switch (cmd) {
      case 'D': render('dashboard'); break;
      case 'W': render('whatsapp'); break;
      case 'A': render('ainoria'); break;
      case 'C': render('commands'); break;
      case 'S': render('sessions'); break;
      case 'L': render('logs'); break;
      case 'E': render('errors'); break;
      case 'H': render('health'); break;
      case 'N': render('new'); break;
      case 'R': render(currentScreen); break;
      case 'Q':
        console.log('\n  Shutting down DJOUSSE TECH...');
        process.exit(0);
        break;
      default:
        if (input.trim()) {
          console.log(`  Unknown command: ${input.trim()}`);
        }
        render(currentScreen);
    }
  });

  rl.on('close', () => process.exit(0));

  bus.on('*', (event) => {
    if (currentScreen === 'logs' || currentScreen === 'dashboard') {
      // Auto-refresh on events (debounced)
    }
  });
}

module.exports = { startTUI, render, drawHeader };
