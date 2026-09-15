// ===== DJOUSSE TECH — Dashboard Module =====

let currentUser = null;
let userProfile = null;
let userBots = [];

// ===== INIT =====
async function initDashboard() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  userProfile = await db.getProfile(currentUser.id);
  if (!userProfile) {
    console.error('Profil introuvable');
    return;
  }

  userBots = await db.getBots(currentUser.id);

  renderUserInfo();
  renderStats();
  renderBotList();
  renderRecentCommands();
  renderPlanStatus();
}

// ===== RENDER USER INFO =====
function renderUserInfo() {
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const avatarEl = document.getElementById('userAvatar');

  if (nameEl) nameEl.textContent = userProfile.full_name || 'Utilisateur';
  if (emailEl) emailEl.textContent = userProfile.email;
  if (avatarEl) {
    const initials = (userProfile.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
    avatarEl.textContent = initials;
  }
}

// ===== RENDER STATS =====
function renderStats() {
  const totalMessages = userBots.reduce((sum, b) => sum + (b.messages_today || 0), 0);
  const totalMembers = userBots.reduce((sum, b) => sum + (b.members_count || 0), 0);
  const totalCommands = userBots.reduce((sum, b) => sum + (b.commands_used || 0), 0);
  const onlineBots = userBots.filter(b => b.status === 'online').length;

  setText('statMessages', totalMessages.toLocaleString());
  setText('statMembers', totalMembers.toLocaleString());
  setText('statCommands', totalCommands.toLocaleString());
  setText('statBots', onlineBots + '/' + userBots.length);
}

// ===== RENDER BOT LIST =====
function renderBotList() {
  const container = document.getElementById('botList');
  if (!container) return;

  if (userBots.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 24px;">
        <p style="font-size:48px;margin-bottom:16px;">🤖</p>
        <h3 style="font-size:18px;font-weight:600;margin-bottom:8px;">Aucun bot configuré</h3>
        <p style="color:var(--slate-500);margin-bottom:24px;">Créez votre premier bot WhatsApp en quelques clics.</p>
        <button onclick="showCreateBotModal()" class="btn btn-primary">Créer un bot</button>
      </div>
    `;
    return;
  }

  container.innerHTML = userBots.map(bot => `
    <div class="dash-card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--brand-500),var(--brand-700));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">
          ${bot.bot_image ? `<img src="${bot.bot_image}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : 'DT'}
        </div>
        <div>
          <div style="font-weight:600;">${escapeHtml(bot.bot_name)}</div>
          <div style="font-size:13px;color:var(--slate-500);">
            ${bot.phone_number ? bot.phone_number : 'Non connecté'} · Préfixe: ${escapeHtml(bot.prefix)}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="status-badge ${bot.status === 'online' ? 'status-online' : 'status-offline'}">
          ● ${bot.status === 'online' ? 'En ligne' : bot.status === 'connecting' ? 'Connexion...' : 'Hors ligne'}
        </span>
        <button onclick="deleteBot('${bot.id}')" style="background:none;border:none;color:var(--red-500);cursor:pointer;font-size:18px;" title="Supprimer">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ===== RENDER RECENT COMMANDS =====
function renderRecentCommands() {
  // Placeholder — sera alimenté par les logs Supabase
  const commands = [
    { cmd: '.ping', user: 'Vous', time: 'Maintenant' },
  ];

  setText('recentCmds', commands.map(c =>
    `<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--slate-100);">
      <span style="font-weight:500;">${escapeHtml(c.cmd)}</span>
      <span style="color:var(--slate-500);font-size:13px;">${escapeHtml(c.time)}</span>
    </div>`
  ).join(''));
}

// ===== RENDER PLAN STATUS =====
function renderPlanStatus() {
  const planEl = document.getElementById('planStatus');
  if (!planEl) return;

  const plan = userProfile.plan || 'free';
  const isActive = db.isPlanActive(userProfile);
  const planConfig = CONFIG.plans[plan];

  planEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <span style="font-size:24px;">${plan === 'pro' ? '👑' : plan === 'premium' ? '⭐' : '🆓'}</span>
      <div>
        <div style="font-weight:700;font-size:18px;">Plan ${planConfig.name}</div>
        <div style="font-size:13px;color:${isActive ? 'var(--emerald-500)' : 'var(--red-500)'};">
          ${isActive ? 'Actif' : 'Expiré'}
          ${userProfile.plan_expires_at ? ` — expire le ${new Date(userProfile.plan_expires_at).toLocaleDateString('fr-FR')}` : ''}
        </div>
      </div>
    </div>
    <div style="font-size:14px;color:var(--slate-600);">
      ${planConfig.features.customName ? '✓' : '✕'} Nom personnalisé<br>
      ${planConfig.features.customImage ? '✓' : '✕'} Image personnalisée<br>
      ${planConfig.features.customChannel ? '✓' : '✕'} Channel personnalisé
    </div>
    ${plan === 'free' ? '<a href="#pricing" class="btn btn-primary" style="margin-top:16px;width:100%;text-align:center;">Passer à Premium</a>' : ''}
  `;
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

  const botName = document.getElementById('newBotName').value.trim() || 'DJOUSSE TECH';
  const prefix = document.getElementById('newBotPrefix').value.trim() || '.';

  // Vérifier le plan
  const features = db.getPlanFeatures(userProfile);
  if (!features.customName && botName !== 'DJOUSSE TECH') {
    alert('Le nom personnalisé nécessite un plan Premium ou Pro.');
    return;
  }

  showLoading('createBotBtn', true);

  const result = await db.createBot(currentUser.id, {
    bot_name: botName,
    prefix: prefix,
  });

  showLoading('createBotBtn', false);

  if (result.error) {
    alert('Erreur: ' + result.error);
    return;
  }

  await db.logActivity(currentUser.id, 'create_bot', result.data.id, { bot_name: botName });

  hideCreateBotModal();
  userBots = await db.getBots(currentUser.id);
  renderBotList();
  renderStats();
  document.getElementById('createBotForm').reset();
}

// ===== DELETE BOT =====
async function deleteBot(botId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce bot ?')) return;

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

// ===== INIT ON LOAD =====
document.addEventListener('DOMContentLoaded', initDashboard);
