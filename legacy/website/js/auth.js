// ===== DJOUSSE TECH — Auth UI Module =====
// Gère les formulaires login/signup/forgot-password

function showAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideAuthError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.display = 'none';
  }
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

// ===== LOGIN =====
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError('authError');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAuthError('authError', 'Veuillez remplir tous les champs.');
      return;
    }

    showLoading('loginBtn', true);

    const result = await db.signIn(email, password);

    showLoading('loginBtn', false);

    if (result.error) {
      const messages = {
        'Invalid login credentials': 'Email ou mot de passe incorrect.',
        'Email not confirmed': 'Veuillez confirmer votre email avant de vous connecter.',
        'Too many requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
      };
      showAuthError('authError', messages[result.error] || result.error);
      return;
    }

    // Succès — rediriger vers le dashboard
    await db.logActivity(result.data.user.id, 'login');
    window.location.href = 'dashboard.html';
  });
}

// ===== SIGNUP =====
function initSignupForm() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError('authError');
    hideAuthError('authSuccess');

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const terms = document.getElementById('terms').checked;

    if (!name || !email || !password) {
      showAuthError('authError', 'Veuillez remplir tous les champs.');
      return;
    }

    if (!terms) {
      showAuthError('authError', 'Veuillez accepter les conditions générales.');
      return;
    }

    if (password.length < 6) {
      showAuthError('authError', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    showLoading('signupBtn', true);

    const result = await db.signUp(email, password, name);

    showLoading('signupBtn', false);

    if (result.error) {
      const messages = {
        'User already registered': 'Un compte existe déjà avec cet email.',
        'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
        'Unable to validate email address: invalid format': 'Adresse email invalide.',
      };
      showAuthError('authError', messages[result.error] || result.error);
      return;
    }

    // Succès
    if (result.data?.user?.identities?.length === 0) {
      showAuthError('authError', 'Un compte existe déjà avec cet email.');
      return;
    }

    showAuthError('authSuccess', 'Compte créé avec succès ! Vérifiez votre email pour confirmer votre compte.');
    form.reset();
  });
}

// ===== FORGOT PASSWORD =====
function initForgotForm() {
  const form = document.getElementById('resetForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError('authError');
    hideAuthError('authSuccess');

    const email = document.getElementById('email').value.trim();

    if (!email) {
      showAuthError('authError', 'Veuillez entrer votre adresse email.');
      return;
    }

    showLoading('resetBtn', true);

    const result = await db.resetPassword(email);

    showLoading('resetBtn', false);

    if (result.error) {
      showAuthError('authError', result.error);
      return;
    }

    showAuthError('authSuccess', 'Un lien de réinitialisation a été envoyé à votre adresse email.');
    form.reset();
  });
}

// ===== CHECK AUTH STATE =====
async function requireAuth() {
  const session = await db.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

async function requireGuest() {
  const session = await db.getSession();
  if (session) {
    window.location.href = 'dashboard.html';
    return true;
  }
  return false;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Page detection
  const page = window.location.pathname.split('/').pop();

  if (page === 'login.html' || page === 'login') {
    initLoginForm();
    requireGuest();
  } else if (page === 'signup.html' || page === 'signup') {
    initSignupForm();
    requireGuest();
  } else if (page === 'forgot-password.html' || page === 'forgot-password') {
    initForgotForm();
    requireGuest();
  }
});
