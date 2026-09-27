// ===== DJOUSSE TECH — Dashboard Module =====

let currentUser = null;
let userProfile = null;
let userBots = [];

// ===== INIT =====
async function initDashboard() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  userProfile = await db.getProfile(currentUser.id);
  if (!userProfile) return;

  userBots = await db.getBots(currentUser.id);

  renderSidebar();
  renderWelcome();
  renderStats();
  renderBotList();
  renderPlanStatus();

  // Load admin stats if admin
  if (userProfile.is_admin) {
    loadAdminStats();
  }
}

// ===== SIDEBAR =====
function renderSidebar() {
  const avatar = document.getElementById('sidebarAvatar');
  const name = document.getElementById('sidebarName');
  const plan = document.getElementById('sidebarPlan');
  const adminLink = document.getElementById('adminSidebarLink');
  const adminQuick = document.getElementById('adminQuickAction');

  if (avatar) {
    const initials = (userProfile.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
    avatar.textContent = initials;
  }
  if (name) name.textContent = userProfile.full_name || 'Utilisateur';
  if (plan) plan.textContent = userProfile.plan === 'pro' ? 'Pro 👑' : userProfile.plan === 'premium' ? 'Premium ⭐' : 'Gratuit';
  if (adminLink && userProfile.is_admin) adminLink.style.display = 'flex';
  if (adminQuick && userProfile.is_admin) adminQuick.style.display = 'flex';
}

// ===== WELCOME BANNER =====
function renderWelcome() {
  const title = document.getElementById('welcomeTitle');
  if (!title) return;

  const hour = new Date().getHours();
  let greeting = 'Bonsoir';
  if (hour < 12) greeting = 'Bonjour';
  else if (hour < 17) greeting = 'Bon après-midi';

  const firstName = (userProfile.full_name || 'Utilisateur').split(' ')[0];
  title.textContent = `${greeting}, ${firstName} 👋`;
}

// ===== STATS =====
function renderStats() {
  const totalBots = userBots.length;
  const runningBots = userBots.filter(b => b.status === 'online').length;
  const totalMessages = userBots.reduce((sum, b) => sum + (b.messages_today || 0), 0);

  setText('statBots', totalBots);
  setText('statRunning', runningBots);
  setText('statMessages', totalMessages.toLocaleString());
}

// ===== PLAN STATUS =====
function renderPlanStatus() {
  const badge = document.getElementById('planBadge');
  const value = document.getElementById('statPlan');
  const sub = document.getElementById('statPlanSub');

  const plan = userProfile.plan || 'free';
  const planConfig = CONFIG.plans[plan];
  const isActive = db.isPlanActive(userProfile);

  if (badge) {
    badge.textContent = plan === 'pro' ? 'Pro 👑' : plan === 'premium' ? 'Premium ⭐' : 'Gratuit';
    badge.style.background = plan === 'pro' ? '#f5f3ff' : plan === 'premium' ? '#fffbeb' : '#ecfdf5';
    badge.style.color = plan === 'pro' ? '#7c3aed' : plan === 'premium' ? '#d97706' : '#059669';
  }
  if (value) value.textContent = planConfig.name;
  if (sub) {
    if (plan === 'free') {
      sub.textContent = 'Pas de plan actif';
    } else if (userProfile.plan_expires_at) {
      const expires = new Date(userProfile.plan_expires_at);
      const now = new Date();
      const days = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
      sub.textContent = isActive ? `Expire dans ${days}j` : 'Expiré';
    }
  }
}

// ===== BOT LIST =====
function renderBotList() {
  const container = document.getElementById('botList');
  if (!container) return;

  if (userBots.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <h3>Aucun bot configuré</h3>
        <p>Créez votre premier bot WhatsApp en quelques clics.</p>
        <button class="btn-new-bot" onclick="showCreateBotModal()" style="margin:0 auto;">+ Nouveau bot</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="bots-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Statut</th>
          <th>Préfixe</th>
          <th>Commandes</th>
          <th>Messages</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${userBots.map(bot => `
          <tr>
            <td style="font-weight:600;">${escapeHtml(bot.bot_name)}</td>
            <td><span class="status-dot ${bot.status === 'online' ? 'status-online' : bot.status === 'connecting' ? 'status-connecting' : 'status-offline'}">${formatBotStatus(bot.status)}</span></td>
            <td style="color:#6b7280;">${escapeHtml(bot.prefix)}</td>
            <td style="color:#2563eb;font-size:12px;">${bot.command_source === 'custom' ? 'Personnalisées' : 'Catalogue DJOUSSE TECH'}</td>
            <td style="color:#6b7280;">${bot.messages_today || 0}</td>
            <td>
              <button onclick="deleteBot('${bot.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;" title="Supprimer">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ===== ADMIN STATS =====
async function loadAdminStats() {
  const section = document.getElementById('adminSection');
  if (section) section.style.display = 'block';

  const stats = await db.adminGetStats();
  if (!stats) return;

  setText('adminUsers', stats.totalUsers);
  setText('adminBotsOnline', stats.onlineBots);
  setText('adminBotsTotal', stats.totalBots);
  setText('adminPayments', stats.totalPayments);
}

// ===== CREATE BOT =====
function showCreateBotModal() {
  const modal = document.getElementById('createBotModal');
  if (modal) modal.style.display = 'flex';
}

function hideCreateBotModal() {
  const modal = document.getElementById('createBotModal');
  if (modal) modal.style.display = 'none';
}

async function handleCreateBot(e) {
  e.preventDefault();

  const botName = document.getElementById('newBotName').value.trim();
  const prefix = document.getElementById('newBotPrefix').value.trim() || '.';
  const sessionId = document.getElementById('newBotSession').value.trim();

  if (!botName) {
    alert('Veuillez donner un nom à votre bot.');
    return;
  }
  if (!/^\S{1,3}$/.test(prefix)) {
    alert('Le préfixe doit contenir de 1 à 3 caractères sans espace.');
    return;
  }
  if (!sessionId || sessionId.length < 8) {
    alert('Le Session ID WhatsApp est obligatoire. Scannez le QR code puis collez le Session ID reçu.');
    return;
  }

  showLoading('createBotBtn', true);

  const result = await db.createBot(currentUser.id, {
    bot_name: botName,
    prefix: prefix,
    session_id: sessionId,
  });

  showLoading('createBotBtn', false);

  if (result.error) {
    alert('Erreur: ' + result.error);
    return;
  }

  await db.logActivity(currentUser.id, 'create_bot', result.data.id, {
    bot_name: botName,
    prefix,
    command_source: 'developer_catalog',
  });
  hideCreateBotModal();
  userBots = await db.getBots(currentUser.id);
  renderBotList();
  renderStats();
  document.getElementById('createBotForm').reset();
}

// ===== DELETE BOT =====
async function deleteBot(botId) {
  if (!confirm('Supprimer ce bot ?')) return;

  const result = await db.deleteBot(botId);
  if (result.error) {
    alert('Erreur: ' + result.error);
    return;
  }

  await db.logActivity(currentUser.id, 'delete_bot', botId);
  userBots = await db.getBots(currentUser.id);
  renderBotList();
  renderStats();
}

// ===== UTILS =====
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = text;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Chargement...';
    btn.style.opacity = '0.7';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.style.opacity = '1';
  }
}

function formatBotStatus(status) {
  const labels = { online: 'Connecté', connecting: 'Connexion…', error: 'Erreur', offline: 'Hors ligne' };
  return labels[status] || 'Donnée indisponible';
}

function toggleSessionVisibility() {
  const input = document.getElementById('newBotSession');
  const button = document.getElementById('toggleSessionBtn');
  if (!input || !button) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  button.textContent = visible ? 'Afficher' : 'Masquer';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', initDashboard);
