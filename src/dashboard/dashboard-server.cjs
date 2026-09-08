/**
 * Dashboard Server — DJOUSSE-TECH-MD v3.0
 * 
 * Panel d'administration web avec :
 * - Statut temps réel (connecté, uptime, mémoire)
 * - Gestion des commandes (enable/disable)
 * - Logs en direct
 * - Statistiques (messages, erreurs, performance)
 * - Gestion des groupes
 * - Graphiques (Chart.js)
 * 
 * Express + EJS (templates), compatible CJS.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════ */
const DASHBOARD_CONFIG = {
    PORT: parseInt(process.env.DASHBOARD_PORT || '8080', 10),
    SECRET: process.env.DASHBOARD_SECRET || process.env.DASHBOARD_TOKEN || '',
    ENABLED: process.env.DASHBOARD_ENABLED === 'true',
    LOG_FILE: path.join(__dirname, '../../bot-live.log'),
    STATS_DIR: path.join(__dirname, '../../data/stats'),
};

/* ═══════════════════════════════════════════════════════════════════
   MIDDLEWARE — Auth simple
   ═══════════════════════════════════════════════════════════════════ */
function dashboardAuth(req, res, next) {
    const token = req.query.token || req.headers['x-dashboard-token'];
    if (token === DASHBOARD_CONFIG.SECRET) {
        return next();
    }
    // Page de login
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>DJOUSSE-TECH Dashboard - Login</title>
            <style>
                body { background: #0a0e14; color: #e0e0e0; font-family: 'Segoe UI', sans-serif; 
                       display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .login-box { background: #111820; padding: 40px; border-radius: 12px; 
                            box-shadow: 0 8px 32px rgba(0,200,255,0.1); text-align: center; }
                h1 { color: #00c8ff; margin-bottom: 30px; }
                input { background: #1a2030; border: 1px solid #333; color: #fff; padding: 12px 20px; 
                       border-radius: 8px; width: 250px; font-size: 16px; }
                button { background: #00c8ff; color: #000; border: none; padding: 12px 30px; 
                        border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 15px; }
                button:hover { background: #00e5ff; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <h1>🤖 DJOUSSE-TECH</h1>
                <p>Dashboard Admin</p>
                <form method="GET" action="/dashboard">
                    <input type="password" name="token" placeholder="Token secret..." autofocus>
                    <br>
                    <button type="submit">Connexion</button>
                </form>
            </div>
        </body>
        </html>
    `);
}

/* ═══════════════════════════════════════════════════════════════════
   ROUTES DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */
function createDashboardRouter(getBotState) {
    const router = express.Router();

    // Auth middleware
    router.use(dashboardAuth);

    // ── Page principale ──
    router.get('/', (req, res) => {
        const state = getBotState();
        res.send(generateDashboardHTML(state));
    });

    // ── API: Status JSON ──
    router.get('/api/status', (req, res) => {
        const state = getBotState();
        res.json({
            connected: state.connected,
            engine: state.engine,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            commands: state.commandCount,
            messages: state.messagesToday,
            errors: state.errorsToday,
            timestamp: Date.now(),
        });
    });

    // ── API: Logs récents ──
    router.get('/api/logs', (req, res) => {
        const lines = parseInt(req.query.lines || '50', 10);
        try {
            const content = fs.readFileSync(DASHBOARD_CONFIG.LOG_FILE, 'utf8');
            const allLines = content.split('\n').filter(Boolean);
            res.json({ logs: allLines.slice(-lines) });
        } catch {
            res.json({ logs: ['No logs available'] });
        }
    });

    // ── API: Commandes ──
    router.get('/api/commands', (req, res) => {
        const state = getBotState();
        res.json({ commands: state.commands || [] });
    });

    // ── API: Stats ──
    router.get('/api/stats', (req, res) => {
        const state = getBotState();
        res.json({
            messages: { today: state.messagesToday, total: state.messagesTotal },
            errors: { today: state.errorsToday },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            security: state.securityStats || {},
            android: state.androidStats || {},
        });
    });

    // ── API: Health check ──
    router.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: Date.now(),
        });
    });

    return router;
}

/* ═══════════════════════════════════════════════════════════════════
   GÉNÉRATEUR HTML — Dashboard moderne
   ═══════════════════════════════════════════════════════════════════ */
function generateDashboardHTML(state) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DJOUSSE-TECH Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #050a12; color: #e0e0e0; font-family: 'Segoe UI', sans-serif; }
        
        .header { background: linear-gradient(135deg, #0a1628 0%, #0d1f35 100%); 
                  padding: 20px 30px; border-bottom: 2px solid #00c8ff33; }
        .header h1 { color: #00c8ff; font-size: 24px; }
        .header .subtitle { color: #666; font-size: 14px; }
        
        .container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
                     gap: 20px; padding: 20px; max-width: 1400px; margin: 0 auto; }
        
        .card { background: #111820; border-radius: 12px; padding: 20px; 
                border: 1px solid #1a2535; }
        .card h2 { color: #00c8ff; font-size: 16px; margin-bottom: 15px; }
        
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .stat-item { background: #0a1220; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: bold; color: #39ff98; }
        .stat-label { font-size: 12px; color: #888; margin-top: 5px; }
        
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; 
                       font-size: 12px; font-weight: bold; }
        .status-connected { background: #39ff9820; color: #39ff98; }
        .status-disconnected { background: #ff444420; color: #ff4444; }
        
        .logs { background: #0a0e14; padding: 15px; border-radius: 8px; font-family: monospace; 
               font-size: 12px; max-height: 300px; overflow-y: auto; line-height: 1.6; }
        .log-entry { color: #888; }
        .log-entry.error { color: #ff4444; }
        .log-entry.success { color: #39ff98; }
        .log-entry.warning { color: #ffaa00; }
        
        .btn { background: #00c8ff; color: #000; border: none; padding: 8px 16px; 
              border-radius: 6px; cursor: pointer; font-size: 14px; }
        .btn:hover { background: #00e5ff; }
        .btn-danger { background: #ff4444; }
        .btn-danger:hover { background: #ff6666; }
        
        .refresh-btn { position: fixed; bottom: 20px; right: 20px; z-index: 100; }
        
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .pulse { animation: pulse 2s infinite; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 DJOUSSE-TECH DASHBOARD</h1>
        <div class="subtitle">Panel d'administration temps réel</div>
    </div>
    
    <div class="container">
        <!-- Statut -->
        <div class="card">
            <h2>📡 Statut</h2>
            <div style="text-align: center; padding: 20px;">
                <span class="status-badge ${state.connected ? 'status-connected' : 'status-disconnected'}">
                    ${state.connected ? '● CONNECTÉ' : '● DÉCONNECTÉ'}
                </span>
                <p style="margin-top: 10px; color: #888;">
                    Moteur: <strong style="color: #00c8ff;">${state.engine || 'N/A'}</strong>
                </p>
            </div>
        </div>
        
        <!-- Métriques -->
        <div class="card">
            <h2>📊 Métriques</h2>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-value">${state.messagesToday || 0}</div>
                    <div class="stat-label">Messages aujourd'hui</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${state.commandCount || 0}</div>
                    <div class="stat-label">Commandes chargées</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${Math.round(process.uptime() / 3600)}h</div>
                    <div class="stat-label">Uptime</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB</div>
                    <div class="stat-label">Mémoire</div>
                </div>
            </div>
        </div>
        
        <!-- Graphique mémoire -->
        <div class="card">
            <h2>📈 Mémoire (Live)</h2>
            <canvas id="memoryChart" height="150"></canvas>
        </div>
        
        <!-- Logs -->
        <div class="card" style="grid-column: span 2;">
            <h2>📝 Logs récents</h2>
            <div class="logs" id="logs">
                <div class="log-entry">Chargement des logs...</div>
            </div>
        </div>
    </div>
    
    <button class="btn refresh-btn" onclick="refreshAll()">🔄 Actualiser</button>
    
    <script>
        // Graphique mémoire
        const ctx = document.getElementById('memoryChart').getContext('2d');
        const memChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    label: 'Heap (MB)',
                    data: Array(20).fill(0),
                    borderColor: '#00c8ff',
                    backgroundColor: '#00c8ff20',
                    fill: true,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: '#1a2535' }, ticks: { color: '#888' } },
                    x: { grid: { display: false } }
                }
            }
        });
        
        async function refreshAll() {
            try {
                const res = await fetch('/dashboard/api/status${window.location.search.includes('token') ? '&token=' + new URLSearchParams(window.location.search).get('token') : ''}');
                const data = await res.json();
                
                // Update memory chart
                memChart.data.datasets[0].data.push(Math.round(data.memory.heapUsed / 1024 / 1024));
                memChart.data.datasets[0].data.shift();
                memChart.update();
            } catch {}
            
            // Refresh logs
            try {
                const logRes = await fetch('/dashboard/api/logs?lines=30${window.location.search.includes('token') ? '&token=' + new URLSearchParams(window.location.search).get('token') : ''}');
                const logData = await logRes.json();
                const logsEl = document.getElementById('logs');
                logsEl.innerHTML = logData.logs.map(l => {
                    let cls = '';
                    if (l.includes('❌') || l.includes('error')) cls = 'error';
                    else if (l.includes('✅') || l.includes('success')) cls = 'success';
                    else if (l.includes('⚠️') || l.includes('warning')) cls = 'warning';
                    return '<div class="log-entry ' + cls + '">' + l + '</div>';
                }).join('');
                logsEl.scrollTop = logsEl.scrollHeight;
            } catch {}
        }
        
        // Auto-refresh toutes les 5s
        setInterval(refreshAll, 5000);
        refreshAll();
    </script>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════ */
module.exports = {
    createDashboardRouter,
    DASHBOARD_CONFIG,
};
