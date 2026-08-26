// Supabase init
const SUPABASE_URL = 'https://evrqzgjksmidqhzvckhq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF6Z2prc21pZHFoenZja2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTE4MzksImV4cCI6MjEwMDEyNzgzOX0.UV4YLbfJwszr-zzzkpJgbLbQ4ZZhiGVYzlAHpst45mE';
let db = null;
try {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase failed to load:', e);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// If a password reset was started (OTP verified) but never completed, don't
// leave the user logged in — clear the session and reload clean.
if (db && localStorage.getItem('pcResetPending')) {
  localStorage.removeItem('pcResetPending');
  db.auth.signOut().then(() => window.location.reload()).catch(() => {});
}

// Navbar scroll effect
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

// Mobile menu toggle
const mobileToggle = document.getElementById('mobileToggle');
const mobileMenu = document.getElementById('mobileMenu');
let menuOpen = false;

mobileToggle.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('active', menuOpen);
  const svg = mobileToggle.querySelector('svg');
  svg.innerHTML = menuOpen
    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />'
    : '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />';
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    menuOpen = false;
    mobileMenu.classList.remove('active');
    mobileToggle.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />';
  });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#signup' || href === '#login' || href === '#demo') {
      e.preventDefault();
      if (href === '#signup') openAuth('signup');
      else if (href === '#login') openAuth('login');
      else if (href === '#demo') window.location.href = 'admin-dashboard.html?demo';
      return;
    }
    if (href === '#') { e.preventDefault(); return; }
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// Show/hide password toggle
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('.eye-open').classList.toggle('hidden', !isPassword);
    btn.querySelector('.eye-closed').classList.toggle('hidden', isPassword);
  });
});

// Auth Modal
const authOverlay = document.getElementById('authOverlay');
const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const authError = document.getElementById('authError');

function resetResetForm() {
  const rf = document.getElementById('resetForm');
  if (!rf) return;
  rf.classList.add('hidden');
  document.getElementById('resetRequest').classList.remove('hidden');
  document.getElementById('resetOtp').classList.add('hidden');
  document.getElementById('resetNewPw').classList.add('hidden');
  // Clear fields so a previously shown (possibly already used) code can't be
  // submitted again.
  rf.querySelectorAll('input').forEach(el => el.value = '');
  const requestBtn = document.getElementById('resetRequestBtn');
  requestBtn.disabled = false;
  requestBtn.textContent = 'Send code';
  const otpBtn = document.getElementById('resetOtpBtn');
  otpBtn.disabled = false;
  otpBtn.textContent = 'Verify';
  const pwBtn = document.getElementById('resetNewPwBtn');
  pwBtn.disabled = false;
  pwBtn.textContent = 'Set New Password';
}

function openAuth(mode) {
  authOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  authError.classList.add('hidden');
  if (window.fluidPause) window.fluidPause();
  // Reset OTP step
  document.getElementById('otpStep').classList.add('hidden');
  document.getElementById('signupSubmit').classList.remove('hidden');
  resetResetForm();
  if (mode === 'signup') {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  } else {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  }
}

function closeAuth() {
  authOverlay.classList.remove('active');
  document.body.style.overflow = '';
  if (window.fluidResume) window.fluidResume();
  // Clear all form fields
  document.querySelectorAll('#signupForm input, #loginForm input, #otpStep input, #resetForm input').forEach(el => el.value = '');
  authError.classList.add('hidden');
  // Reset OTP step
  document.getElementById('otpStep').classList.add('hidden');
  document.getElementById('signupSubmit').classList.remove('hidden');
  localStorage.removeItem('pcSignupExpiry');
  resetResetForm();
}

document.getElementById('authClose').addEventListener('click', closeAuth);

authOverlay.addEventListener('click', (e) => {
  if (e.target === authOverlay) closeAuth();
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  openAuth('login');
});

document.getElementById('showSignup').addEventListener('click', (e) => {
  e.preventDefault();
  openAuth('signup');
});

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function friendlyError(err) {
  const msg = (err.message || err || '').toLowerCase();
  if (msg.includes('already') && msg.includes('registered')) return 'An account with this email already exists.';
  if (msg.includes('already') && msg.includes('exist')) return 'An account with this email already exists.';
  if (msg.includes('different from the old password')) return 'New password must be different from your current password.';
  if (msg.includes('password') && msg.includes('at least')) return 'Password must be at least 6 characters.';
  if (msg.includes('password')) return 'Password must be at least 6 characters with a mix of letters and numbers.';
  if (msg.includes('valid email') || msg.includes('invalid email')) return 'Please enter a valid email address.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Network error. Check your connection and try again.';
  if (msg.includes('invalid login') || msg.includes('invalid email or password')) return 'Incorrect email or password.';
  if (msg.includes('email not confirmed')) return 'Please check your email and confirm your account first.';
  if (msg.includes('infinite recursion') || msg.includes('recursion')) return 'Setup error. Please try again.';
  if (msg.includes('connection') || msg.includes('refresh')) return 'Connection error. Please refresh the page.';
  return 'Something went wrong. Please try again.';
}

function validatePassword(pw) {
  if (pw.length < 6) return 'Password must be at least 6 characters.';
  if (!/[a-zA-Z]/.test(pw)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
  return null;
}

// Sign Up — creates auth account, sends OTP
document.getElementById('signupSubmit').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) { showError('Connection error. Please refresh.'); return; }
  const btn = document.getElementById('signupBtn');
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  authError.classList.add('hidden');

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const institute = document.getElementById('signup-institute').value.trim();
  const consentEl = document.getElementById('signup-consent');

  // Client-side validation
  if (!name) { showError('Please enter your name.'); btn.disabled = false; btn.textContent = 'Create Account'; return; }
  if (!institute) { showError('Please enter your institute name.'); btn.disabled = false; btn.textContent = 'Create Account'; return; }
  if (!consentEl || !consentEl.checked) { showError('Please accept the Privacy Policy and Terms of Service to continue.'); btn.disabled = false; btn.textContent = 'Create Account'; return; }
  const pwError = validatePassword(password);
  if (pwError) { showError(pwError); btn.disabled = false; btn.textContent = 'Create Account'; return; }

  try {
    let emailAlreadyExists = false;
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const result = await res.json();
        emailAlreadyExists = result?.exists === true;
      }
    } catch (e) {
      console.warn('check-email unavailable, continuing:', e);
    }
    if (emailAlreadyExists) {
      showError('An account with this email already exists. Try logging in instead.');
      return;
    }

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, institute_name: institute, consent_at: new Date().toISOString(), consent_version: '2026-08-14' }
      }
    });

    if (error) {
      showError(friendlyError(error));
      return;
    }

    // Show OTP step
    document.getElementById('signupSubmit').classList.add('hidden');
    document.getElementById('otpStep').classList.remove('hidden');
    document.getElementById('otpEmail').textContent = email;
    setOtpExpiry('pcSignupExpiry');
    authError.classList.add('hidden');
  } catch (err) {
    showError(friendlyError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});

// OTP Verification
document.getElementById('otpSubmit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('otpBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  authError.classList.add('hidden');

  const email = document.getElementById('signup-email').value.trim();
  const token = document.getElementById('otp-code').value.trim();

  if (token.length !== 6) {
    showError('Please enter the 6-digit code.');
    btn.disabled = false;
    btn.textContent = 'Verify';
    return;
  }

  // Client-side expiry check — a used or too-old code must not be accepted.
  if (otpExpired('pcSignupExpiry')) {
    localStorage.removeItem('pcSignupExpiry');
    showError('This code has expired. Please resend a new code.');
    btn.disabled = false;
    btn.textContent = 'Verify';
    return;
  }

  try {
    const { data, error } = await db.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (error) {
      showError('Invalid or expired code. Please try again.');
      return;
    }

    // Verified — close modal, stay on landing page
    window._pendingPlan = null;
    localStorage.removeItem('pcSignupExpiry');
    closeAuth();

    // Create user profile + institute so name shows correctly
    const { data: { session: otpSession } } = await db.auth.getSession();
    if (otpSession) {
      const user = otpSession.user;
      const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
      const instituteName = user.user_metadata?.institute_name || 'My Institute';

      // Try to find existing institute
      let { data: inst } = await db
        .from('institutes')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      // Create institute if missing
      if (!inst) {
        try {
          const { data: newInst } = await db.from('institutes').insert({
            name: instituteName,
            owner_id: user.id,
            email: user.email
          }).select().single();
          inst = newInst;
        } catch (e) {
          console.warn('Could not create institute:', e);
        }
      }

      // Create user profile if missing
      if (inst) {
        try {
          await db.from('users').insert({
            id: user.id,
            institute_id: inst.id,
            full_name: fullName,
            email: user.email,
            role: 'admin'
          });
        } catch (e) {
          // Profile may already exist — ignore
        }
      }

      // Check if user should go to dashboard (teacher/parent always, admin if paid)
      const dashUrl = await shouldGoToDashboard(user.id);
      if (dashUrl) {
        window.location.href = dashUrl;
        return;
      }
    }

    // Update nav based on subscription status
    updateNavForLoggedInUser();
  } catch (err) {
    showError('Verification failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
});

// Resend OTP
document.getElementById('otpResend').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const link = e.target;
  link.style.pointerEvents = 'none';
  link.textContent = 'Sending...';

  try {
    await db.auth.resend({ email, type: 'signup' });
    setOtpExpiry('pcSignupExpiry');
    link.textContent = 'Sent! Check your email';
    setTimeout(() => { link.textContent = 'Resend code'; link.style.pointerEvents = ''; }, 3000);
  } catch {
    link.textContent = 'Failed — try again';
    setTimeout(() => { link.textContent = 'Resend code'; link.style.pointerEvents = ''; }, 3000);
  }
});

// Login
document.getElementById('loginSubmit').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) { showError('Connection error. Please refresh.'); return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  authError.classList.add('hidden');

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      showError(friendlyError(error));
      return;
    }

    // Logged in — close modal, stay on landing page
    window._pendingPlan = null;
    closeAuth();
    // Check if user should go to dashboard (teacher/parent always, admin if paid)
    const { data: { session: freshSession } } = await db.auth.getSession();
    if (freshSession) {
      const dashUrl = await shouldGoToDashboard(freshSession.user.id);
      if (dashUrl) {
        window.location.href = dashUrl;
        return;
      }
    }
    updateNavForLoggedInUser();
  } catch (err) {
    showError(friendlyError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
});

// ── Forgot password (OTP-based reset) ──
const resetFormEl = document.getElementById('resetForm');
// Reset codes are only valid for 10 minutes — enforced client-side in addition
// to the server-side expiry configured in the Supabase dashboard.
const RESET_OTP_TTL_MS = 10 * 60 * 1000;

function setOtpExpiry(key) {
  localStorage.setItem(key, String(Date.now() + RESET_OTP_TTL_MS));
}

function otpExpired(key) {
  const t = Number(localStorage.getItem(key) || 0);
  return !t || Date.now() > t;
}

function showResetPhase(phaseId) {
  ['resetRequest', 'resetOtp', 'resetNewPw'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== phaseId);
  });
}

document.getElementById('forgotPassword').addEventListener('click', (e) => {
  e.preventDefault();
  resetResetForm();
  loginForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  document.getElementById('otpStep').classList.add('hidden');
  authError.classList.add('hidden');
  resetFormEl.classList.remove('hidden');
});

function resetBackToLogin(e) {
  e.preventDefault();
  resetFormEl.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authError.classList.add('hidden');
}
document.getElementById('resetBackLogin').addEventListener('click', resetBackToLogin);
document.getElementById('resetOtpBackLogin').addEventListener('click', resetBackToLogin);
document.getElementById('resetDoneLogin').addEventListener('click', resetBackToLogin);

// Phase 1 — request code
document.getElementById('resetRequestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) { showError('Connection error. Please refresh.'); return; }
  const btn = document.getElementById('resetRequestBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  authError.classList.add('hidden');

  const email = document.getElementById('reset-email').value.trim();

  try {
    await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  } catch (err) {
    // Never reveal whether the account exists — show the same next step.
  }

  setOtpExpiry('pcResetExpiry');
  document.getElementById('resetOtpEmail').textContent = email;
  showResetPhase('resetOtp');
  btn.disabled = false;
  btn.textContent = 'Send code';
});

// Resend code
document.getElementById('resetResend').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('reset-email').value.trim();
  const link = e.target;
  link.style.pointerEvents = 'none';
  link.textContent = 'Sending...';
  try {
    await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setOtpExpiry('pcResetExpiry');
    link.textContent = 'Sent! Check your email';
    setTimeout(() => { link.textContent = 'Resend code'; link.style.pointerEvents = ''; }, 3000);
  } catch {
    link.textContent = 'Failed — try again';
    setTimeout(() => { link.textContent = 'Resend code'; link.style.pointerEvents = ''; }, 3000);
  }
});

// Phase 2 — verify code
document.getElementById('resetOtpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('resetOtpBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  authError.classList.add('hidden');

  const email = document.getElementById('reset-email').value.trim();
  const token = document.getElementById('reset-otp').value.trim();

  if (token.length !== 6) {
    showError('Please enter the 6-digit code.');
    btn.disabled = false;
    btn.textContent = 'Verify';
    return;
  }

  // Client-side expiry check — a used or too-old code must not be accepted.
  if (otpExpired('pcResetExpiry')) {
    localStorage.removeItem('pcResetExpiry');
    document.getElementById('reset-otp').value = '';
    showError('This code has expired. Please request a new one.');
    showResetPhase('resetRequest');
    btn.disabled = false;
    btn.textContent = 'Verify';
    return;
  }

  try {
    const { error } = await db.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      showError('Invalid or expired code. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    localStorage.setItem('pcResetPending', '1');
    showResetPhase('resetNewPw');
  } catch (err) {
    showError(friendlyError(err));
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
});

// Phase 3 — set new password
document.getElementById('resetNewPwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) { showError('Connection error. Please refresh.'); return; }
  const btn = document.getElementById('resetNewPwBtn');
  authError.classList.add('hidden');

  const password = document.getElementById('reset-pw').value;
  const confirmPassword = document.getElementById('reset-pw-confirm').value;

  const pwError = validatePassword(password);
  if (pwError) { showError(pwError); return; }
  if (password !== confirmPassword) { showError('Passwords do not match.'); return; }

  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    const { error: pwErr } = await db.auth.updateUser({ password });
    if (pwErr) throw pwErr;

    localStorage.removeItem('pcResetPending');
    localStorage.removeItem('pcResetExpiry');
    closeAuth();

    // Same post-login path as the signup OTP flow
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      const dashUrl = await shouldGoToDashboard(session.user.id);
      if (dashUrl) { window.location.href = dashUrl; return; }
    }
    updateNavForLoggedInUser();
  } catch (err) {
    showError(friendlyError(err));
    btn.disabled = false;
    btn.textContent = 'Set New Password';
  }
});

// Helper: update nav for logged-in user
async function updateNavForLoggedInUser() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  const { data: { session } } = await db.auth.getSession();
  if (!session) return;

  // Get user name from DB
  let displayName = session.user.email.split('@')[0];
  try {
    const { data: profile } = await db
      .from('users')
      .select('full_name')
      .eq('id', session.user.id)
      .single();
    if (profile?.full_name) displayName = profile.full_name.split(' ')[0];
  } catch (e) {}
  displayName = escapeHtml(displayName);

  // Check if user has an active plan
  const activePlan = await Payment.getActivePlan(db, session.user.id);

  // Get user role
  let userRole = 'admin';
  try {
    const { data: roleData } = await db
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (roleData?.role) userRole = roleData.role;
  } catch (e) {}

  // Teachers and parents always see dashboard link; admin only if paid
  const hasDashboard = userRole === 'teacher' || userRole === 'parent' || (activePlan && activePlan !== 'free');

  if (hasDashboard) {
    // Show name linking to dashboard
    const dashUrl = getDashboardUrl(userRole) || 'index.html';
    navActions.innerHTML = `
      <a href="${dashUrl}" class="nav-user">
        Hey! ${displayName}
      </a>
      <button class="nav-cta" id="navLogoutBtn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);font-size:12px;padding:6px 16px;">Log Out</button>
    `;
  } else {
    // Free admin — show name + choose plan button
    navActions.innerHTML = `
      <span class="nav-user" style="cursor:default;">Hey! ${displayName}</span>
      <a href="#pricing" class="nav-cta" id="navChoosePlan" style="font-size:12px;padding:6px 16px;">Choose Plan</a>
      <button class="nav-cta" id="navLogoutBtn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);font-size:12px;padding:6px 16px;">Log Out</button>
    `;
    // Smooth scroll to pricing
    document.getElementById('navChoosePlan').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
    });
  }

  document.getElementById('navLogoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.reload();
  });
}

// Helper: get dashboard URL based on user role
function getDashboardUrl(role) {
  if (role === 'admin') return 'admin-dashboard.html';
  if (role === 'teacher') return 'teacher-dashboard.html';
  if (role === 'parent') return 'parent-dashboard.html';
  return null;
}

// Helper: should this user be redirected to dashboard? Returns dashboard URL or null
async function shouldGoToDashboard(userId) {
  try {
    const { data: profile } = await db
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    // Teachers and parents always go to dashboard
    if (profile?.role === 'teacher' || profile?.role === 'parent') return getDashboardUrl(profile.role);
    // Admin always goes to dashboard — plan limits are enforced inside
    if (profile?.role === 'admin') return getDashboardUrl('admin');
    return null;
  } catch (e) {
    return null;
  }
}

// Check if already logged in — redirect to dashboard if applicable, else update nav
if (db) {
  db.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) return;
    const dashUrl = await shouldGoToDashboard(session.user.id);
    if (dashUrl) {
      window.location.href = dashUrl;
    } else {
      updateNavForLoggedInUser();
    }
  });
}

// Pricing button clicks
let selectedPlan = null;
document.querySelectorAll('.plan-btn[data-plan]').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    selectedPlan = btn.dataset.plan;

    if (selectedPlan === 'free') {
      // Free plan: just sign up / go to dashboard
      if (db) {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
          const { data: profile } = await db.from('users').select('role').eq('id', session.user.id).single();
          window.location.href = getDashboardUrl(profile?.role) || 'index.html';
          return;
        }
      }
      openAuth('signup');
    } else {
      // Basic or Pro
      if (db) {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
          // Logged in — check if already has this plan
          const activePlan = await Payment.getActivePlan(db, session.user.id);
          if (activePlan === selectedPlan) {
            alert('You already have this plan active!');
            const { data: profile } = await db.from('users').select('role').eq('id', session.user.id).single();
            window.location.href = getDashboardUrl(profile?.role) || 'index.html';
            return;
          }
          // Open Razorpay checkout
          const { data: profile } = await db.from('users').select('role').eq('id', session.user.id).single();
          const dashUrl = getDashboardUrl(profile?.role) || 'index.html';
          Payment.openCheckout(selectedPlan, db, session.user).then(() => {
            window.location.href = dashUrl;
          }).catch(err => {
            if (err.message !== 'Payment cancelled') {
              console.error('Payment failed:', err);
              alert('Payment failed. Please try again.');
            }
          });
        } else {
          // Not logged in — open auth modal, set pending plan
          window._pendingPlan = selectedPlan;
          openAuth('signup');
        }
      }
    }
  });
});

// Scroll reveal
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const revealElements = document.querySelectorAll('.bento-item, .features-header, .step-card, .how-header, .pricing-card, .pricing-header');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, index * 80);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  revealElements.forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });
}

// Bento grid mouse glow
document.querySelectorAll('.bento-item').forEach(item => {
  item.addEventListener('mousemove', (e) => {
    const rect = item.getBoundingClientRect();
    item.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    item.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  });
});


