// ===== DJOUSSE TECH — Admin Panel Module =====

let adminProfile = null;
let currentTab = 'overview';

// ===== INIT =====
async function initAdmin() {
  const user = await requireAuth();
  if (!user) return;

  adminProfile = await db.getProfile(user.id);
  if (!adminProfile || !adminProfile.is_admin) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;">
        <div style="text-align:center;">
          <p style="font-size:64px;margin-bottom:16px;">🔒</p>
          <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">Accès refusé</h1>
          <p style="color:var(--slate-500);margin-bottom:24px;">Vous n'avez pas les droits administrateur.</p>
          <a href="dashboard.html" class="btn btn-primary">Retour au Dashboard</a>
        </div>
      </div>
    `;
    return;
  }

  renderAdminNav();
  loadTab('overview');
}

// ===== NAVIGATION =====
function renderAdminNav() {
  const nav = document.getElementById('adminNav');
  if (!nav) return;

  nav.innerHTML = `
    <button class="admin-tab active" onclick="loadTab('overview')" data-tab="overview">📊 Vue d'ensemble</button>
    <button class="admin-tab" onclick="loadTab('users')" data-tab="users">👥 Utilisateurs</button>
    <button class="admin-tab" onclick="loadTab('bots')" data-tab="bots">🤖 Bots</button>
    <button class="admin-tab" onclick="loadTab('payments')" data-tab="payments">💰 Paiements</button>
    <button class="admin-tab" onclick="loadTab('logs')" data-tab="logs">📋 Logs</button>
  `;
}

function loadTab(tab) {
  currentTab = tab;

  // Update active tab
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const content = document.getElementById('adminContent');
  content.innerHTML = '<div style="text-align:center;padding:48px;color:var(--slate-500);">Chargement...</div>';

  switch(tab) {
    case 'overview': loadOverview(); break;
    case 'users': loadUsers(); break;
    case 'bots': loadBots(); break;
    case 'payments': loadPayments(); break;
    case 'logs': loadLogs(); break;
  }
}

// ===== OVERVIEW =====
async function loadOverview() {
  const stats = await db.adminGetStats();
  const content = document.getElementById('adminContent');

  content.innerHTML = `
    <div class="dashboard-grid">
      <div class="dash-card">
        <h3>Utilisateurs totaux</h3>
        <div class="value">${stats.totalUsers}</div>
        <div class="sub">Inscrits sur la plateforme</div>
      </div>
      <div class="dash-card">
        <h3>Bots actifs</h3>
        <div class="value">${stats.onlineBots}</div>
        <div class="sub">En ligne maintenant</div>
      </div>
      <div class="dash-card">
        <h3>Bots total</h3>
        <div class="value">${stats.totalBots}</div>
        <div class="sub">Créés sur la plateforme</div>
      </div>
      <div class="dash-card">
        <h3>Paiements validés</h3>
        <div class="value">${stats.totalPayments}</div>
        <div class="sub">Transactions complétées</div>
      </div>
    </div>

    <div style="margin-top:40px;">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:20px;">Actions rapides</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <button onclick="loadTab('users')" class="btn btn-primary">Gérer les utilisateurs</button>
        <button onclick="loadTab('bots')" class="btn btn-outline">Voir les bots</button>
        <button onclick="loadTab('payments')" class="btn btn-outline">Voir les paiements</button>
      </div>
    </div>
  `;
}

// ===== USERS =====
async function loadUsers() {
  const users = await db.adminGetAllUsers();
  const content = document.getElementById('adminContent');

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <h2 style="font-size:20px;font-weight:700;">Utilisateurs (${users.length})</h2>
      <div style="display:flex;gap:8px;">
        <input type="text" id="userSearch" placeholder="Rechercher..." oninput="searchUsers(this.value)"
          style="padding:8px 16px;border:1px solid var(--slate-200);border-radius:10px;font-size:14px;outline:none;">
      </div>
    </div>
    <div class="dash-card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid var(--slate-200);text-align:left;">
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Nom</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Email</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Plan</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Admin</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Inscrit le</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Actions</th>
          </tr>
        </thead>
        <tbody id="usersTableBody">
          ${users.map(u => renderUserRow(u)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserRow(u) {
  const planColors = { free: 'var(--slate-500)', premium: 'var(--brand-600)', pro: 'var(--violet-600)' };
  return `
    <tr style="border-bottom:1px solid var(--slate-100);" data-user-id="${u.id}">
      <td style="padding:12px 8px;font-weight:500;">${escapeHtml(u.full_name || '—')}</td>
      <td style="padding:12px 8px;color:var(--slate-600);">${escapeHtml(u.email)}</td>
      <td style="padding:12px 8px;">
        <span style="color:${planColors[u.plan] || planColors.free};font-weight:600;text-transform:uppercase;font-size:12px;">
          ${u.plan}
        </span>
      </td>
      <td style="padding:12px 8px;">${u.is_admin ? '👑' : '—'}</td>
      <td style="padding:12px 8px;color:var(--slate-500);font-size:13px;">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
      <td style="padding:12px 8px;">
        <div style="display:flex;gap:6px;">
          <button onclick="toggleAdmin('${u.id}', ${!u.is_admin})" style="padding:4px 8px;border:1px solid var(--slate-200);border-radius:6px;background:white;cursor:pointer;font-size:12px;" title="${u.is_admin} ? 'Retirer admin' : 'Rendre admin'">
            ${u.is_admin ? '👤' : '👑'}
          </button>
          <button onclick="changeUserPlan('${u.id}', '${u.plan}')" style="padding:4px 8px;border:1px solid var(--slate-200);border-radius:6px;background:white;cursor:pointer;font-size:12px;" title="Changer le plan">
            💳
          </button>
          <button onclick="deleteUser('${u.id}', '${escapeHtml(u.full_name || u.email)}')" style="padding:4px 8px;border:1px solid var(--red-500);border-radius:6px;background:white;color:var(--red-500);cursor:pointer;font-size:12px;" title="Supprimer">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}

async function searchUsers(query) {
  if (!query || query.length < 2) {
    loadUsers();
    return;
  }
  const users = await db.adminSearchUsers(query);
  const tbody = document.getElementById('usersTableBody');
  if (tbody) {
    tbody.innerHTML = users.map(u => renderUserRow(u)).join('');
  }
}

async function toggleAdmin(userId, makeAdmin) {
  const action = makeAdmin ? 'rendre admin' : 'retirer les droits admin';
  if (!confirm(`Voulez-vous vraiment ${action} cet utilisateur ?`)) return;

  const result = await db.adminUpdateUser(userId, { is_admin: makeAdmin });
  if (result.error) {
    alert('Erreur: ' + result.error);
    return;
  }
  await db.logActivity(adminProfile.id, makeAdmin ? 'admin_grant' : 'admin_revoke', null, { target_user: userId });
  loadUsers();
}

async function changeUserPlan(userId, currentPlan) {
  const plans = ['free', 'premium', 'pro'];
  const currentIndex = plans.indexOf(currentPlan);
  const nextPlan = plans[(currentIndex + 1) % plans.length];

  let expiresAt = null;
  if (nextPlan === 'premium') {
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (nextPlan === 'pro') {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const result = await db.adminUpdateUser(userId, { plan: nextPlan, plan_expires_at: expiresAt });
  if (result.error) {
    alert('Erreur: ' + result.error);
    return;
  }
  await db.logActivity(adminProfile.id, 'admin_plan_change', null, { target_user: userId, new_plan: nextPlan });
  loadUsers();
}

async function deleteUser(userId, name) {
  if (!confirm(`Supprimer l'utilisateur "${name}" et tous ses bots ? Cette action est irréversible.`)) return;

  const result = await db.adminDeleteUser(userId);
  if (result.error) {
    alert('Erreur: ' + result.error);
    return;
  }
  await db.logActivity(adminProfile.id, 'admin_delete_user', null, { target_user: userId, name });
  loadUsers();
}

// ===== BOTS =====
async function loadBots() {
  const bots = await db.adminGetAllBots();
  const content = document.getElementById('adminContent');

  content.innerHTML = `
    <h2 style="font-size:20px;font-weight:700;margin-bottom:24px;">Bots (${bots.length})</h2>
    <div class="dash-card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid var(--slate-200);text-align:left;">
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Nom</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Propriétaire</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Statut</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Messages</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Membres</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Créé le</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${bots.map(b => `
            <tr style="border-bottom:1px solid var(--slate-100);">
              <td style="padding:12px 8px;font-weight:500;">${escapeHtml(b.bot_name)}</td>
              <td style="padding:12px 8px;color:var(--slate-600);font-size:13px;">
                ${b.profiles ? escapeHtml(b.profiles.full_name || b.profiles.email) : '—'}
              </td>
              <td style="padding:12px 8px;">
                <span class="status-badge ${b.status === 'online' ? 'status-online' : 'status-offline'}">
                  ● ${b.status}
                </span>
              </td>
              <td style="padding:12px 8px;">${b.messages_today || 0}</td>
              <td style="padding:12px 8px;">${b.members_count || 0}</td>
              <td style="padding:12px 8px;color:var(--slate-500);font-size:13px;">${new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
              <td style="padding:12px 8px;">
                <button onclick="adminDeleteBot('${b.id}', '${escapeHtml(b.bot_name)}')" style="padding:4px 8px;border:1px solid var(--red-500);border-radius:6px;background:white;color:var(--red-500);cursor:pointer;font-size:12px;">
                  🗑️
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminDeleteBot(botId, name) {
  if (!confirm(`Supprimer le bot "${name}" ?`)) return;
  const sb = window.db._sb || null;
  // Use raw supabase call for admin delete
  const { getSupabase } = window;
  const sbClient = getSupabase();
  if (!sbClient) return;

  const { error } = await sbClient.from('bots').delete().eq('id', botId);
  if (error) { alert('Erreur: ' + error.message); return; }
  await db.logActivity(adminProfile.id, 'admin_delete_bot', botId, { bot_name: name });
  loadBots();
}

// ===== PAYMENTS =====
async function loadPayments() {
  const payments = await db.adminGetAllPayments();
  const content = document.getElementById('adminContent');

  const statusColors = {
    pending: 'var(--slate-500)',
    completed: 'var(--emerald-500)',
    failed: 'var(--red-500)',
    refunded: 'var(--brand-600)',
  };

  content.innerHTML = `
    <h2 style="font-size:20px;font-weight:700;margin-bottom:24px;">Paiements (${payments.length})</h2>
    <div class="dash-card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid var(--slate-200);text-align:left;">
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Utilisateur</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Plan</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Montant</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Méthode</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Statut</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Date</th>
            <th style="padding:12px 8px;color:var(--slate-500);font-weight:500;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${payments.length === 0 ? `
            <tr><td colspan="7" style="padding:32px;text-align:center;color:var(--slate-500);">Aucun paiement enregistré</td></tr>
          ` : payments.map(p => `
            <tr style="border-bottom:1px solid var(--slate-100);">
              <td style="padding:12px 8px;font-weight:500;">
                ${p.profiles ? escapeHtml(p.profiles.full_name || p.profiles.email) : '—'}
              </td>
              <td style="padding:12px 8px;text-transform:uppercase;font-weight:600;font-size:12px;">${p.plan}</td>
              <td style="padding:12px 8px;font-weight:600;">${p.amount.toLocaleString()} ${CONFIG.app.currencySymbol}</td>
              <td style="padding:12px 8px;color:var(--slate-600);">${p.method}</td>
              <td style="padding:12px 8px;">
                <span style="color:${statusColors[p.status]};font-weight:600;text-transform:uppercase;font-size:12px;">${p.status}</span>
              </td>
              <td style="padding:12px 8px;color:var(--slate-500);font-size:13px;">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
              <td style="padding:12px 8px;">
                <div style="display:flex;gap:6px;">
                  ${p.status === 'pending' ? `
                    <button onclick="validatePayment('${p.id}', '${p.user_id}', '${p.plan}')" style="padding:4px 8px;border:1px solid var(--emerald-500);border-radius:6px;background:white;color:var(--emerald-500);cursor:pointer;font-size:12px;">
                      ✓ Valider
                    </button>
                    <button onclick="rejectPayment('${p.id}')" style="padding:4px 8px;border:1px solid var(--red-500);border-radius:6px;background:white;color:var(--red-500);cursor:pointer;font-size:12px;">
                      ✕ Rejeter
                    </button>
                  ` : '—'}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function validatePayment(paymentId, userId, plan) {
  const duration = plan === 'pro' ? 30 : 7;
  const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

  const [paymentResult, userResult] = await Promise.all([
    db.adminUpdatePayment(paymentId, 'completed'),
    db.adminUpdateUser(userId, { plan, plan_expires_at: expiresAt })
  ]);

  if (paymentResult.error || userResult.error) {
    alert('Erreur: ' + (paymentResult.error || userResult.error));
    return;
  }

  await db.logActivity(adminProfile.id, 'admin_validate_payment', null, { payment_id: paymentId, plan, user_id: userId });
  loadPayments();
}

async function rejectPayment(paymentId) {
  const result = await db.adminUpdatePayment(paymentId, 'failed');
  if (result.error) { alert('Erreur: ' + result.error); return; }
  await db.logActivity(adminProfile.id, 'admin_reject_payment', null, { payment_id: paymentId });
  loadPayments();
}

// ===== LOGS =====
async function loadLogs() {
  const logs = await db.adminGetAllLogs();
  const content = document.getElementById('adminContent');

  const actionIcons = {
    login: '🔑',
    create_bot: '🤖',
    delete_bot: '🗑️',
    admin_grant: '👑',
    admin_revoke: '👤',
    admin_plan_change: '💳',
    admin_delete_user: '⚠️',
    admin_validate_payment: '💰',
    admin_reject_payment: '❌',
    admin_delete_bot: '🗑️',
  };

  content.innerHTML = `
    <h2 style="font-size:20px;font-weight:700;margin-bottom:24px;">Journal d'activité (${logs.length})</h2>
    <div class="dash-card">
      ${logs.length === 0 ? `
        <p style="color:var(--slate-500);padding:24px 0;text-align:center;">Aucune activité enregistrée</p>
      ` : logs.map(log => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--slate-100);">
          <span style="font-size:20px;">${actionIcons[log.action] || '📌'}</span>
          <div style="flex:1;">
            <div style="font-weight:500;font-size:14px;">
              ${log.profiles ? escapeHtml(log.profiles.full_name || log.profiles.email) : 'Système'}
              — ${log.action}
            </div>
            ${log.details ? `<div style="font-size:12px;color:var(--slate-500);margin-top:2px;">${escapeHtml(JSON.stringify(log.details))}</div>` : ''}
          </div>
          <span style="font-size:12px;color:var(--slate-400);white-space:nowrap;">${new Date(log.created_at).toLocaleString('fr-FR')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== UTILS =====
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', initAdmin);
