import { supabase } from './supabase.js'

function redirectToMain() {
  window.location.href = 'index.html';
}

function isAuthLink(link, pageName) {
  const href = link.getAttribute('href');
  return href && href.split('#')[0].endsWith(`${pageName}.html`);
}

function getAuthLinks() {
  const anchors = Array.from(document.querySelectorAll('a'));
  const loginLinks = anchors.filter((link) => isAuthLink(link, 'login'));
  const signupLinks = anchors.filter((link) => isAuthLink(link, 'signup'));
  return { loginLinks, signupLinks };
}

function storeDefaultAuthLabels() {
  const { loginLinks, signupLinks } = getAuthLinks();
  [...loginLinks, ...signupLinks].forEach((link) => {
    if (!link.dataset.defaultLabel) {
      const href = link.getAttribute('href') || '';
      link.dataset.defaultLabel = link.textContent.trim() || (href.includes('signup.html') ? 'Register' : 'Login');
    }
  });
}

function updateAuthUI(currentUser) {
  storeDefaultAuthLabels();

  const { loginLinks, signupLinks } = getAuthLinks();
  const displayName = currentUser ? currentUser.fullName || currentUser.email || 'Me' : null;

  loginLinks.forEach((link) => {
    if (currentUser) {
      link.textContent = displayName;
      link.setAttribute('href', 'me.html');
    } else {
      link.textContent = link.dataset.defaultLabel || 'Login';
      link.setAttribute('href', 'login.html#login');
    }
    link.style.display = '';
  });

  signupLinks.forEach((link) => {
    if (currentUser) {
      link.style.display = 'none';
    } else {
      link.style.display = '';
      link.textContent = link.dataset.defaultLabel || 'Register';
      link.setAttribute('href', 'signup.html#register');
    }
  });

  const authUserSpans = Array.from(document.querySelectorAll('[data-auth-user]'));
  authUserSpans.forEach((span) => {
    span.textContent = currentUser ? displayName : '';
  });
}

function scrollToAuthSectionFromHash() {
  const hash = window.location.hash;
  if (!hash) return;

  const target = document.querySelector(hash);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setupLogoutButtons() {
  const logoutButtons = Array.from(document.querySelectorAll('[data-action="logout"], [data-action="sign-out"], .logout-link, .sign-out'));
  logoutButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      await supabase.auth.signOut();
      window.__zellaCurrentUser = null;
      updateAuthUI(null);
      window.location.href = 'login.html';
    });
  });
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || user.email
  };
}

async function restoreSessionState() {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session ? normalizeUser(session.user) : null;
  window.__zellaCurrentUser = user;
  updateAuthUI(user);
  return user;
}

function setFormMessage(form, message, type = 'error') {
  const messageEl = form.querySelector('.form-message');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.className = `form-message ${type}`;
}

function clearFormMessage(form) {
  setFormMessage(form, '', 'success');
}

function getCurrentPageName() {
  return window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
}

function getPageNameFromHref(href) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
  const normalized = href.split('#')[0].split('?')[0];
  const match = normalized.match(/([^/]+\.html)$/i);
  return match ? match[1] : null;
}

function isProtectedPage(pageName) {
  const protectedPages = new Set([
    'me.html', 'wallet.html', 'checkin.html', 'calculator.html',
    'funding_details.html', 'history.html', 'recharge.html', 'contract.html',
  ]);
  return protectedPages.has(pageName);
}

function isProtectedButtonLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  const protectedButtons = [
    'wallet', 'check in', 'redeem bonus', 'funding details',
    'calculator', 'recharge', 'deposit', 'join now', 'buy now',
  ];
  return protectedButtons.some((keyword) => normalized.includes(keyword));
}

function interceptProtectedNavigation() {
  document.addEventListener('click', (event) => {
    const control = event.target.closest('a, button, [role="button"]');
    if (!control) return;

    const currentUser = window.__zellaCurrentUser || null;
    if (currentUser) return;

    const href = control.getAttribute('href') || '';
    const targetPage = getPageNameFromHref(href);
    const label = (control.textContent || control.getAttribute('aria-label') || '').trim().toLowerCase();
    const isProtectedLink = targetPage && isProtectedPage(targetPage);
    const isProtectedButton = control.matches('button, [role="button"]') && !control.hasAttribute('data-allow-guest') && isProtectedButtonLabel(label);

    if (isProtectedLink || isProtectedButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = 'login.html';
    }
  }, true);
}

async function bootstrapAuthGuard() {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session ? normalizeUser(session.user) : null;
  window.__zellaCurrentUser = currentUser || null;

  if (!currentUser && isProtectedPage(getCurrentPageName())) {
    window.location.replace('login.html');
    return true;
  }
  return false;
}

bootstrapAuthGuard();

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await restoreSessionState();
  setupLogoutButtons();
  interceptProtectedNavigation();

  if (!currentUser && isProtectedPage(getCurrentPageName())) {
    window.location.replace('login.html');
    return;
  }

  if (currentUser && ['login.html', 'signup.html', 'forgot.html'].includes(getCurrentPageName())) {
    redirectToMain();
    return;
  }

  scrollToAuthSectionFromHash();
});

function enforceRegisterVisibility() {
  const page = getCurrentPageName();
  const registerEl = document.getElementById('register');
  if (!registerEl) return;
  registerEl.style.display = page !== 'signup.html' ? 'none' : '';
}

document.addEventListener('DOMContentLoaded', enforceRegisterVisibility);

function showOnlyRegisterOnSignup() {
  const page = getCurrentPageName();
  if (page !== 'signup.html') return;

  const registerEl = document.getElementById('register');
  if (!registerEl) return;

  document.body.classList.add('signup-only');
  const pageShell = registerEl.closest('.page-shell');
  if (pageShell) {
    Array.from(pageShell.children).forEach((child) => {
      child.style.display = child === registerEl ? '' : 'none';
    });
  } else {
    Array.from(document.body.children).forEach((child) => {
      child.style.display = child.contains(registerEl) ? 'block' : 'none';
    });
  }
  registerEl.style.display = '';
}

document.addEventListener('DOMContentLoaded', showOnlyRegisterOnSignup, { once: true });

// ============================================
// LOGIN FORM
// ============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormMessage(loginForm);

    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      return;
    }

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setFormMessage(loginForm, 'No account matches those details. Try signing up first or check your credentials.', 'error');
      return;
    }

    window.__zellaCurrentUser = normalizeUser(data.user);
    updateAuthUI(window.__zellaCurrentUser);
    redirectToMain();
  });
}

// ============================================
// SIGNUP FORM — FIXED: Always redirects on success
// ============================================
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  function validatePasswords() {
    const passwordInput = document.getElementById('signupPassword');
    const confirmInput = document.getElementById('confirmPassword');
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const messageEl = signupForm.querySelector('.form-message');

    if (confirm && password !== confirm) {
      confirmInput.setCustomValidity('Passwords do not match.');
      if (messageEl) {
        messageEl.textContent = 'Password does not match';
        messageEl.className = 'form-message error';
      }
    } else {
      confirmInput.setCustomValidity('');
      if (messageEl && !messageEl.dataset.success) {
        messageEl.textContent = '';
        messageEl.className = 'form-message';
      }
    }
  }

  document.getElementById('signupPassword')?.addEventListener('input', validatePasswords);
  document.getElementById('confirmPassword')?.addEventListener('input', validatePasswords);

  document.querySelectorAll('.toggle-password-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormMessage(signupForm);
    validatePasswords();

    if (!signupForm.checkValidity()) {
      signupForm.reportValidity();
      return;
    }

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) {
      setFormMessage(signupForm, error.message, 'error');
      return;
    }

    // FIXED: Always redirect on successful sign-up
    window.__zellaCurrentUser = normalizeUser(data.user);
    updateAuthUI(window.__zellaCurrentUser);
    const messageEl = signupForm.querySelector('.form-message');
    if (messageEl) {
      messageEl.dataset.success = 'true';
      setFormMessage(signupForm, 'Account created successfully', 'success');
    }
    window.setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);
  });
}