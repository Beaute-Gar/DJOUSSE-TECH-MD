// ===== DJOUSSE TECH — Supabase Client =====
// Charge Supabase via CDN, initialise le client

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const { url, anonKey } = CONFIG.supabase;

  if (!window.supabase) {
    console.error('Supabase SDK non chargé. Ajoute le script CDN.');
    return null;
  }

  supabaseClient = window.supabase.createClient(url, anonKey);
  return supabaseClient;
}

// ===== AUTH FUNCTIONS =====

async function signUp(email, password, fullName) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });

  if (error) return { error: error.message };
  return { data, error: null };
}

async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) return { error: error.message };
  return { data, error: null };
}

async function signOut() {
  const sb = getSupabase();
  if (!sb) return;

  await sb.auth.signOut();
  window.location.href = 'login.html';
}

async function resetPassword(email) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/dashboard.html'
  });

  if (error) return { error: error.message };
  return { data, error: null };
}

async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// ===== PROFILE FUNCTIONS =====

async function getProfile(userId) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erreur profil:', error);
    return null;
  }
  return data;
}

async function updateProfile(userId, updates) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data, error: null };
}

// ===== BOT FUNCTIONS =====

async function getBots(userId) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('bots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur bots:', error);
    return [];
  }
  return data || [];
}

async function createBot(userId, botData) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb
    .from('bots')
    .insert({
      user_id: userId,
      bot_name: botData.bot_name || 'DJOUSSE TECH',
      bot_image: botData.bot_image || null,
      session_id: botData.session_id || null,
      prefix: botData.prefix || '.',
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data, error: null };
}

async function updateBot(botId, updates) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb
    .from('bots')
    .update(updates)
    .eq('id', botId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data, error: null };
}

async function deleteBot(botId) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { error } = await sb
    .from('bots')
    .delete()
    .eq('id', botId);

  if (error) return { error: error.message };
  return { error: null };
}

// ===== ACTIVITY LOG =====

async function logActivity(userId, action, botId = null, details = null) {
  const sb = getSupabase();
  if (!sb) return;

  await sb
    .from('activity_logs')
    .insert({
      user_id: userId,
      bot_id: botId,
      action,
      details
    });
}

async function getRecentLogs(userId, limit = 10) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// ===== PAYMENT FUNCTIONS =====

async function createPayment(userId, plan, amount, method = 'mobile_money') {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb
    .from('payments')
    .insert({
      user_id: userId,
      plan,
      amount,
      method,
      status: 'pending'
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data, error: null };
}

async function getPayments(userId) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

// ===== PLAN CHECK =====

function isPlanActive(profile) {
  if (profile.plan === 'free') return true;
  if (!profile.plan_expires_at) return false;
  return new Date(profile.plan_expires_at) > new Date();
}

function getPlanFeatures(profile) {
  const plan = profile.plan || 'free';
  return CONFIG.plans[plan]?.features || CONFIG.plans.free.features;
}

// ===== ADMIN FUNCTIONS =====

async function isAdmin(userId) {
  const profile = await getProfile(userId);
  return profile?.is_admin === true;
}

async function adminGetAllUsers(limit = 50, offset = 0) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error('Admin users error:', error); return []; }
  return data || [];
}

async function adminGetAllBots(limit = 50, offset = 0) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('bots')
    .select('*, profiles!bots_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error('Admin bots error:', error); return []; }
  return data || [];
}

async function adminGetAllPayments(limit = 50, offset = 0) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('payments')
    .select('*, profiles!payments_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error('Admin payments error:', error); return []; }
  return data || [];
}

async function adminGetAllLogs(limit = 50, offset = 0) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('activity_logs')
    .select('*, profiles!activity_logs_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error('Admin logs error:', error); return []; }
  return data || [];
}

async function adminGetStats() {
  const sb = getSupabase();
  if (!sb) return null;

  const [users, bots, payments, onlineBots] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('bots').select('id', { count: 'exact', head: true }),
    sb.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    sb.from('bots').select('id', { count: 'exact', head: true }).eq('status', 'online'),
  ]);

  return {
    totalUsers: users.count || 0,
    totalBots: bots.count || 0,
    totalPayments: payments.count || 0,
    onlineBots: onlineBots.count || 0,
  };
}

async function adminUpdateUser(userId, updates) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data, error: null };
}

async function adminDeleteUser(userId) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  // Supprimer le profil (les bots seront supprimés en cascade)
  const { error } = await sb
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (error) return { error: error.message };
  return { error: null };
}

async function adminUpdatePayment(paymentId, status) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase non configuré' };

  const { data, error } = await sb
    .from('payments')
    .update({ status })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data, error: null };
}

async function adminSearchUsers(query) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return data || [];
}

// ===== EXPORTS =====
if (typeof window !== 'undefined') {
  window.db = {
    signUp, signIn, signOut, resetPassword,
    getCurrentUser, getSession,
    getProfile, updateProfile,
    getBots, createBot, updateBot, deleteBot,
    logActivity, getRecentLogs,
    createPayment, getPayments,
    isPlanActive, getPlanFeatures,
    isAdmin,
    adminGetAllUsers, adminGetAllBots, adminGetAllPayments, adminGetAllLogs,
    adminGetStats, adminUpdateUser, adminDeleteUser, adminUpdatePayment, adminSearchUsers
  };
}
