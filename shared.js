// PingClass Shared Dashboard Logic
// Supabase init
const SUPABASE_URL = 'https://evrqzgjksmidqhzvckhq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF6Z2prc21pZHFoenZja2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTE4MzksImV4cCI6MjEwMDEyNzgzOX0.UV4YLbfJwszr-zzzkpJgbLbQ4ZZhiGVYzlAHpst45mE';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// If a password reset was started (OTP verified) but never completed, don't
// leave the user logged in — clear the session.
if (localStorage.getItem('pcResetPending')) {
  localStorage.removeItem('pcResetPending');
  db.auth.signOut().catch(() => {});
}

// ── Network failure handling ──
function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true; // fetch rejects with TypeError on network failure
  const msg = String(err && (err.message || err.code || err.name) || err).toLowerCase();
  return /failed to fetch|networkerror|network error|err_name_not_resolved|load failed|getaddr|fetch_failed|offline|socket/i.test(msg);
}

function makeNetworkError(message) {
  const e = new Error(message || 'Network error. Please check your connection and try again.');
  e.name = 'NetworkError';
  e.isNetworkError = true;
  return e;
}

let networkDownSince = 0;

function handleNetworkFailure(err) {
  if (!isNetworkError(err)) return;
  networkDownSince = networkDownSince || Date.now();
  setOfflineUI(true);
}

// Wrap a supabase builder chain so network failures resolve as { data: null, error }
// instead of an unhandled rejection that freezes the page.
function guardBuilder(builder) {
  if (!builder || typeof builder !== 'object') return builder;
  const originalThen = typeof builder.then === 'function' ? builder.then : null;
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === 'then' && originalThen) {
        return function (onFulfilled, onRejected) {
          // If the browser already knows we're offline, don't fire the request at all.
          // Prevents the ERR_NAME_NOT_RESOLVED spam + supabase-js retries while offline.
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            handleNetworkFailure(makeNetworkError());
            const result = { data: null, error: makeNetworkError() };
            if (onFulfilled) return onFulfilled(result);
            return result;
          }
          try {
            return originalThen.call(target, (res) => {
              // supabase-js resolves fetch failures as { data: null, error } — flag them
              if (res && res.error && isNetworkError(res.error)) handleNetworkFailure(res.error);
              if (onFulfilled) return onFulfilled(res);
              return res;
            }, (err) => {
              handleNetworkFailure(err);
              const result = { data: null, error: normalizeError(err) };
              if (onRejected) return onRejected(result);
              return result;
            });
          } catch (err) {
            handleNetworkFailure(err);
            const result = { data: null, error: normalizeError(err) };
            if (onRejected) return onRejected(result);
            return result;
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (...args) {
          const result = value.apply(target, args);
          if (result && typeof result === 'object') return guardBuilder(result);
          return result;
        };
      }
      return value;
    }
  });
}

function normalizeError(err) {
  if (isNetworkError(err)) {
    handleNetworkFailure(err);
    return makeNetworkError();
  }
  return err;
}

// Guard every DB access point so all dashboards inherit the same behavior.
const _origFrom = db.from.bind(db);
const _origRpc = db.rpc.bind(db);
db.from = (table) => guardBuilder(_origFrom(table));
db.rpc = (fn, args) => guardBuilder(_origRpc(fn, args));

// Stop requests from hitting the network once we know we're offline.
// Without this, supabase-js retries every query ~4x and floods the console
// with net::ERR_NAME_NOT_RESOLVED / Failed to load resource errors.
const realFetch = window.fetch.bind(window);
{
  function isOffline() {
    return (typeof navigator !== 'undefined' && navigator.onLine === false) || networkDownSince > 0;
  }
  window.fetch = function (input, init) {
    if (isOffline()) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    return realFetch(input, init).catch((err) => {
      // First real failure — flip the offline flag so supabase-js's retries
      // are cut off instead of hammering the network.
      if (isNetworkError(err)) handleNetworkFailure(err);
      throw err;
    });
  };
}

// supabase-js lets the rejection of a failed session-refresh fetch surface as
// an unhandled promise rejection on an internal chain we can't reach. We
// already handle that failure gracefully (offline screen / retry section), so
// quiet the noise for network-level rejections only — real bugs still log.
window.addEventListener('unhandledrejection', (e) => {
  const r = e && e.reason;
  if (r instanceof TypeError && /failed to fetch|network/i.test(String(r.message || r))) {
    e.preventDefault();
    return;
  }
  if (isNetworkError(r)) e.preventDefault();
});

// ── Offline screen (full-page, like a browser's offline page) ──
let offlineScreenEl = null;
let reconnectTimer = null;
let reloadingAfterRecovery = false;

function ensureOfflineScreen() {
  if (offlineScreenEl) return offlineScreenEl;
  offlineScreenEl = document.createElement('div');
  offlineScreenEl.id = 'offlineScreen';
  offlineScreenEl.className = 'offline-screen';
  offlineScreenEl.setAttribute('role', 'status');
  offlineScreenEl.innerHTML = `
    <div class="offline-screen-inner">
      <div class="offline-screen-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      </div>
      <div class="offline-screen-title">You&rsquo;re offline</div>
      <div class="offline-screen-text">Check your internet connection.<br>Reconnecting automatically<span class="offline-screen-dot"></span><span class="offline-screen-dot"></span><span class="offline-screen-dot"></span></div>
      <button class="offline-screen-retry" type="button">Try again</button>
    </div>
  `;
  document.body.appendChild(offlineScreenEl);
  const btn = offlineScreenEl.querySelector('.offline-screen-retry');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Reconnecting\u2026';
    const ok = await checkConnectivity();
    if (ok) {
      handleNetworkRecovered();
      window.location.reload();
    } else {
      btn.disabled = false;
      btn.textContent = 'Try again';
      startReconnectCheck();
    }
  });
  return offlineScreenEl;
}

// Probe connectivity directly (bypasses the fetch guard). Uses Supabase's
// /auth/v1/health endpoint, which returns 200 + CORS headers while online, so
// the check succeeds cleanly (no CORS block, no console 404/401 noise).
// Only a real network failure rejects.
async function checkConnectivity() {
  // Don't trust navigator.onLine here — it can lag behind the real network
  // state (e.g. right after reconnecting), which would make a manual retry
  // fail without ever probing. Always run the probe and let it decide.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await realFetch(SUPABASE_URL + '/auth/v1/health', {
        method: 'GET',
        cache: 'no-store',
        headers: { apikey: SUPABASE_KEY },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res && res.ok) return true;
    } catch (e) {
      // Network still warming up (DNS/routing) — try once more before giving up.
    }
  }
  return false;
}

function startReconnectCheck() {
  stopReconnectCheck();
  // Probe immediately so a recovery right after a manual retry isn't delayed
  // by the full interval, then keep checking every 5s.
  const probe = async () => {
    // When the browser already reports offline, don't probe — the 'online'
    // event + handleOnlineEvent() will trigger a probe the moment the
    // interface returns, so polling here would only spam DNS failures.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const ok = await checkConnectivity();
    if (ok) {
      handleNetworkRecovered();
      window.location.reload();
    }
  };
  probe();
  reconnectTimer = setInterval(probe, 5000);
}

function stopReconnectCheck() {
  if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
}

function setOfflineUI(offline) {
  if (offline) {
    ensureOfflineScreen();
    offlineScreenEl.classList.add('offline-screen-show');
    document.body.classList.add('is-offline');
    hideScreenLoader();
    // Pause supabase's auto token-refresh while offline — otherwise the
    // visibilitychange handler fires a real /token?grant_type=refresh_token
    // request every time the tab becomes visible, spamming the console with
    // net::ERR_NAME_NOT_RESOLVED. startAutoRefresh() restores it on recovery.
    try { db.auth.stopAutoRefresh(); } catch (e) {}
    startReconnectCheck();
  } else {
    if (offlineScreenEl) offlineScreenEl.classList.remove('offline-screen-show');
    document.body.classList.remove('is-offline');
    stopReconnectCheck();
    try { db.auth.startAutoRefresh(); } catch (e) {}
  }
}

function handleNetworkRecovered() {
  const wasOffline = networkDownSince > 0 || (offlineScreenEl && offlineScreenEl.classList.contains('offline-screen-show'));
  networkDownSince = 0;
  networkDownToastShown = false;
  stopReconnectCheck();
  if (offlineScreenEl) offlineScreenEl.classList.remove('offline-screen-show');
  document.body.classList.remove('is-offline');
  try { db.auth.startAutoRefresh(); } catch (e) {}
  if (wasOffline && !reloadingAfterRecovery) {
    reloadingAfterRecovery = true;
    window.location.reload();
  }
}

let onlineRecoveryTimer = null;

// The browser's 'online' event fires the moment the interface is back, but the
// network may not be usable yet (DNS/routing still settling). Reloading right
// away can land on a page that immediately fails and shows the offline screen
// again. Debounce + probe first, and only recover once a real probe succeeds.
function handleOnlineEvent() {
  if (onlineRecoveryTimer) clearTimeout(onlineRecoveryTimer);
  onlineRecoveryTimer = setTimeout(async () => {
    onlineRecoveryTimer = null;
    const ok = await checkConnectivity();
    if (ok) {
      handleNetworkRecovered();
    } else {
      // Still not reachable — keep the offline screen and let the reconnect
      // check keep trying instead of reloading into another failed page.
      startReconnectCheck();
    }
  }, 1500);
}

window.addEventListener('online', handleOnlineEvent);
window.addEventListener('offline', () => setOfflineUI(true));

// Last-resort: surface any stray unhandled rejection as a visible notice instead of silent breakage
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;
  if (err && isNetworkError(err)) handleNetworkFailure(err);
});

// ── Toast + section error helpers ──
let toastEl = null;
function showToast(message, opts = {}) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'sharedToast';
    toastEl.className = 'shared-toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.className = 'shared-toast shared-toast-show' + (opts.danger ? ' shared-toast-danger' : '');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => {
    toastEl.classList.remove('shared-toast-show');
  }, opts.duration || 3500);
}

let currentUser = null;
let userProfile = null;
let isDemoMode = false;
let currentPlan = 'free';
let currentInstitute = null;

// Demo data
const demoData = {
  user: { full_name: 'Demo User', email: 'demo@pingclass.com' },
  stats: { students: 47, batches: 5, teachers: 6, pending: 12500, collected: 89000, duesToday: 4600, overdue: 8400 }
};

// Demo announcements shown on every dashboard in demo mode.
const demoAnnouncements = [
  { id: 'demo-a1', title: 'Math final exam scheduled', target: 'all', created_at: '2025-07-28T10:00:00', message: 'The Class 9 Math final exam is scheduled for August 15th at 10 AM. Please ensure all students reach on time with their stationery.' },
  { id: 'demo-a2', title: 'Fee reminder for August', target: 'parents', created_at: '2025-07-25T09:30:00', message: 'Fees for August are due by the 5th. Late submissions will incur a penalty. Pay via the Parent app for a smooth experience.' },
  { id: 'demo-a3', title: 'New weekend batch starting', target: 'all', created_at: '2025-07-20T15:00:00', message: 'A new weekend Physics batch for Class 10 is now open for registration. Seats are limited — contact the front desk.' },
  { id: 'demo-a4', title: 'Staff meeting this Friday', target: 'teachers', created_at: '2025-07-22T18:00:00', message: 'All teachers are requested to attend the monthly staff meeting this Friday at 4 PM in the conference room.' }
];

// Full-screen loader helpers
let screenLoaderShownAt = Date.now();
let screenLoaderHidden = false;
function setScreenLoaderText(text) {
  const el = document.getElementById('screenLoaderText');
  if (el) el.textContent = text;
}
function showScreenLoader(text) {
  if (text) setScreenLoaderText(text);
  screenLoaderShownAt = Date.now();
  screenLoaderHidden = false;
  const el = document.getElementById('screenLoader');
  if (el) el.classList.remove('screen-loader-hidden');
}
function hideScreenLoader() {
  const el = document.getElementById('screenLoader');
  if (!el || screenLoaderHidden) return;
  screenLoaderHidden = true;
  // Always show the loader for at least 800ms so the animation is perceptible
  const delay = Math.max(0, 800 - (Date.now() - screenLoaderShownAt));
  setTimeout(() => {
    el.classList.add('screen-loader-hidden');
    window.dispatchEvent(new Event('screen-loader-hidden'));
  }, delay);
}
// Safety net: never let the loader get stuck on screen
window.addEventListener('load', () => {
  setTimeout(hideScreenLoader, 10000);
});

// Role-aware redirect guard. Each dashboard calls sharedInit('<role>') and
// completeInit bounces a session whose stored role doesn't match that page to
// their own dashboard, so e.g. a teacher can never land on the admin UI.
function getDashboardUrl(role) {
  if (role === 'admin') return 'admin-dashboard.html';
  if (role === 'teacher') return 'teacher-dashboard.html';
  if (role === 'parent') return 'parent-dashboard.html';
  return null;
}

// Check auth — called by each role-specific JS after defining loadStats()
async function sharedInit(expectedRole) {
  const params = new URLSearchParams(window.location.search);
  isDemoMode = params.has('demo');

  if (isDemoMode) {
    setScreenLoaderText('Demo mode');
    loadDemoMode();
    if (typeof loadStats === 'function') loadStats();
    if (typeof onReady === 'function') onReady();
    hideScreenLoader();
    return;
  }

  setScreenLoaderText('Checking connection...');

  // Probe before firing any data queries — if we're offline, show the
  // offline page instead of a wall of failed network requests.
  const isConnected = await checkConnectivity();
  if (!isConnected) {
    handleNetworkFailure(makeNetworkError());
    return;
  }

  setScreenLoaderText('Checking session...');

  try {
    const { data: { session } } = await db.auth.getSession();

    if (!session) {
      window.location.href = 'index.html';
      return;
    }

    await completeInit(session, expectedRole);
  } catch (err) {
    console.error('Init failed:', err);
    if (isNetworkError(err)) handleNetworkFailure(err);
    hideScreenLoader();
    const msg = isNetworkError(err)
      ? 'We couldn\u2019t reach the server. Check your internet connection and try again.'
      : 'Something went wrong while loading your dashboard.';
    showSectionError('dashboard', msg, { retry: () => window.location.reload(), retryLabel: 'Reload page' });
  }
}

async function completeInit(session, expectedRole) {
  currentUser = session.user;

  // Get user profile (no join — avoid 406 from RLS on institutes)
  let { data, error: profileErr } = await db
    .from('users')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  // Abort early on network failure so we don't fabricate an empty dashboard
  if (profileErr && isNetworkError(profileErr)) {
    handleNetworkFailure(profileErr);
    throw makeNetworkError();
  }

  // Fetch institute separately
  let institute = null;

  if (data && data.institute_id) {
    const { data: inst } = await db
      .from('institutes')
      .select('*')
      .eq('id', data.institute_id)
      .single();
    institute = inst;
  }

  // First time — create institute + profile
  if (!data) {
    const instituteName = currentUser.user_metadata?.institute_name || 'My Institute';
    const fullName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];

    let { data: inst } = await db
      .from('institutes')
      .select('*')
      .eq('owner_id', currentUser.id)
      .maybeSingle();

    if (!inst) {
      try {
        const { data: newInst } = await db.from('institutes').insert({
          name: instituteName,
          owner_id: currentUser.id,
          email: currentUser.email
        }).select().single();
        inst = newInst;
      } catch (e) {
        console.warn('Could not create institute:', e);
      }
    }

    if (inst) {
      try {
        await db.from('users').insert({
          id: currentUser.id,
          institute_id: inst.id,
          full_name: fullName,
          email: currentUser.email,
          role: 'admin'
        });
      } catch (e) {
        console.warn('Could not create user profile:', e);
      }

      const { data: refreshed } = await db
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      data = refreshed;
      institute = inst;
    }

    if (!data) {
      data = {
        id: currentUser.id,
        institute_id: inst?.id,
        full_name: fullName,
        email: currentUser.email,
        role: 'admin'
      };
      institute = inst || { name: instituteName };
    }
  }

  userProfile = { ...data, institutes: institute };
  currentInstitute = institute;

  // Role gate: this page is for a specific role, so send anyone else to their
  // own dashboard before any data loads or UI paint.
  if (expectedRole && userProfile?.role && userProfile.role !== expectedRole) {
    const target = getDashboardUrl(userProfile.role) || 'index.html';
    window.location.href = target;
    return;
  }

  const displayName = userProfile?.full_name || currentUser.email;
  document.getElementById('userName').textContent = displayName;
  document.getElementById('welcomeName').textContent = displayName.split(' ')[0];

  setScreenLoaderText('Loading your data...');

  // Check subscription plan
  currentPlan = await Payment.getActivePlan(db, currentUser.id);
  const planConfig = Payment.getPlanConfig(currentPlan);

  // Fetch server-side enforced plan limits
  await fetchPlanLimits();

  // Update institute name in top bar
  const instituteNameEl = document.getElementById('instituteName');
  if (instituteNameEl && currentInstitute) {
    instituteNameEl.textContent = currentInstitute.name || '';
  }

// Update plan badge (all dashboards)
const planBadge = document.getElementById('planBadge');
if (planBadge) {
  planBadge.textContent = planConfig.name + ' Plan';
  planBadge.className = `plan-badge plan-badge-${currentPlan}`;
}

  syncSidebarUser();

  if (typeof loadStats === 'function') Promise.resolve(loadStats()).catch(err => {
    console.error('loadStats failed:', err);
    if (isNetworkError(err)) handleNetworkFailure(err);
    showSectionError('dashboard',
      isNetworkError(err)
        ? 'We couldn\u2019t reach the server. Check your internet connection and try again.'
        : 'Something went wrong while loading your dashboard.',
      { retry: () => loadStats() });
  });
  if (typeof onReady === 'function') Promise.resolve(onReady()).catch(err => console.error('onReady failed:', err));
  hideScreenLoader();
}

// Apply plan-based feature gating
function applyPlanGating() {
  if (isDemoMode) return;

  const planConfig = Payment.getPlanConfig(currentPlan);

  document.querySelectorAll('[data-gate]').forEach(el => {
    const feature = el.dataset.gate;
    if (!planConfig.access[feature]) {
      el.classList.add('gated');
      const badge = el.querySelector('.gate-badge');
      if (badge) {
        badge.textContent = currentPlan === 'free' ? 'BASIC' : 'PRO';
      }
      el.title = `Upgrade to ${currentPlan === 'free' ? 'Basic' : 'Pro'} to access ${feature}`;
    } else {
      el.classList.remove('gated');
      el.title = '';
    }
  });
}

// Run an async fn with a spinner on a button; restores the button after.
// opts: { label, dark } — label = text shown next to spinner (default: existing textContent), dark = use dark spinner on light buttons
async function withLoading(btn, fn, opts = {}) {
  if (!btn) return fn();
  const original = btn.dataset.loadingOrig ?? btn.innerHTML;
  btn.dataset.loadingOrig = original;
  const label = opts.label || btn.textContent.trim();
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spinner${opts.dark ? ' btn-spinner-dark' : ''}"></span>${opts.spinnerOnly ? '' : label}`;
  const started = performance.now();
  try {
    const result = await fn();
    const elapsed = performance.now() - started;
    const minDuration = opts.minDuration ?? 500;
    if (elapsed < minDuration) {
      await new Promise(r => setTimeout(r, minDuration - elapsed));
    }
    return result;
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// Sliding-window rate limiter: allows up to `max` calls per `windowMs` per key.
// Returns { allowed, retryAfterMs } — retryAfterMs is 0 when allowed.
const rateLimitBuckets = new Map();
function checkRateLimit(key, max = 5, windowMs = 60000) {
  const now = performance.now();
  const times = (rateLimitBuckets.get(key) || []).filter(t => now - t < windowMs);
  if (times.length >= max) {
    rateLimitBuckets.set(key, times);
    return { allowed: false, retryAfterMs: Math.ceil(windowMs - (now - times[0])) };
  }
  times.push(now);
  rateLimitBuckets.set(key, times);
  return { allowed: true, retryAfterMs: 0 };
}

// Show a settings-form rate-limit message, reusing the existing msg element pattern.
function showRateLimitMsg(msg, retryAfterMs) {
  const seconds = Math.ceil(retryAfterMs / 1000);
  msg.textContent = `Too many saves. Please wait ${seconds}s.`;
  msg.style.color = '#EF4444';
  msg.classList.add('visible');
  setTimeout(() => { msg.classList.remove('visible'); msg.style.color = ''; }, 4000);
}

function loadDemoMode() {
  const demoBanner = document.getElementById('demoBanner');
  if (demoBanner) demoBanner.style.display = 'flex';
  const userName = document.getElementById('userName');
  if (userName) userName.textContent = 'Demo Mode';
  syncSidebarUser();
  const welcomeName = document.getElementById('welcomeName');
  if (welcomeName) welcomeName.textContent = 'there';
  
  document.querySelectorAll('[data-demo]').forEach(el => {
    const key = el.dataset.demo;
    if (demoData.stats[key] !== undefined) {
      el.textContent = demoData.stats[key];
    }
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'none';

  // Unlock all plan features for the demo preview
  planLimits = { plan_id: 'demo', max_students: 999999, max_batches: 999999, max_teachers: 999999, announcements_allowed: true };

  // In demo mode, block mutating actions (add/edit/delete/save/upgrade) so the
  // real handlers never run. Keep the UI identical to live mode — just block the
  // click/submit and show a small notice instead of hitting the backend.
  const demoBlockedSelector = [
    '.page-action-btn:not(.back-btn)',
    '.staff-action-btn',
    '.att-toggle',
    '.billing-plan-btn-upgrade',
    '.settings-save-btn:not(.settings-save-btn--danger)',
    '.staff-modal-submit',
    '.batch-card-actions button'
  ].join(', ');
  const demoBlockedForms = [
    '#inviteForm', '#editStaffForm', '#studentForm',
    '#feeForm', '#batchForm',
    '#instituteSettingsForm', '#adminProfileForm'
  ].join(', ');

  document.addEventListener('click', function (e) {
    const el = e.target.closest ? e.target.closest(demoBlockedSelector) : null;
    if (!el) return;
    // Export and delete account buttons open confirmation modals (which
    // then check isDemoMode and show a notice). Let them through the guard.
    if (el.id === 'exportDataBtn' || el.id === 'deleteAccountBtn') return;
    if (el.classList.contains('staff-action-btn') &&
        /^(editAnnouncement|deleteAnnouncement)\(/.test(el.getAttribute('onclick') || '')) {
      return;
    }
    // The announcement modal's submit is also demo-supported.
    if (el.id === 'announcementSubmit' || el.id === 'addAnnouncementBtn' || (el.closest && el.closest('#announcementForm'))) {
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    showDemoToast('Not available in demo mode.');
  }, true);

  document.addEventListener('submit', function (e) {
    if (!e.target.matches || !e.target.matches(demoBlockedForms)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showDemoToast('Not available in demo mode.');
  }, true);

  function showDemoToast(message) {
    let toast = document.getElementById('demoToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'demoToast';
      toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0F172A;color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:99999;opacity:0;transition:opacity .25s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
  }
}

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (isDemoMode) {
    window.location.href = 'index.html';
    return;
  }
  await db.auth.signOut();
  window.location.href = 'index.html';
});

// Logout from settings page
document.getElementById('settingsLogoutBtn')?.addEventListener('click', async () => {
  if (isDemoMode) {
    window.location.href = 'index.html';
    return;
  }
  await db.auth.signOut();
  window.location.href = 'index.html';
});

/* ── Privacy & Data (DPDP) — shared for non-admin dashboards ── */

// Download a JSON payload as a file. Admin defines its own copy in
// admin-dashboard.js; parent/teacher use this shared one.
function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Sets up the export + delete-account confirmation modals.
// Returns { openExportModal, openDeleteModal, showPrivacyMsg } so callers
// can open the modals from their own button handlers.
function initConfirmModals({ exportFn, deleteDesc, deleteFn, privacyMsg }) {
  const msg = privacyMsg;

  function showPrivacyMsg(text) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 5000);
  }

  /* ── Export modal ── */
  function closeExportModal() {
    document.getElementById('exportConfirmModal')?.classList.remove('open');
  }
  document.getElementById('exportConfirmModalClose')?.addEventListener('click', closeExportModal);
  document.getElementById('exportConfirmCancel')?.addEventListener('click', closeExportModal);
  document.getElementById('exportConfirmModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'exportConfirmModal') closeExportModal();
  });
  document.getElementById('exportConfirmBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('exportConfirmBtn');
    try {
      await withLoading(btn, async () => {
        const payload = await exportFn();
        downloadJson(payload, `pingclass-export-${new Date().toISOString().split('T')[0]}.json`);
      }, { label: 'Preparing...' });
      closeExportModal();
      showPrivacyMsg('Export downloaded.');
    } catch (err) {
      closeExportModal();
      showPrivacyMsg('Export failed. Please try again.');
    }
  });

  /* ── Delete modal ── */
  const deleteInput = document.getElementById('deleteConfirmInput');
  const deleteBtn = document.getElementById('deleteConfirmBtn');
  function closeDeleteModal() {
    document.getElementById('deleteConfirmModal')?.classList.remove('open');
  }
  deleteInput?.addEventListener('input', () => {
    if (deleteBtn) deleteBtn.disabled = deleteInput.value !== 'DELETE';
  });
  document.getElementById('deleteConfirmModalClose')?.addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmCancel')?.addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'deleteConfirmModal') closeDeleteModal();
  });
  // Escape key closes either open modal
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('deleteConfirmModal')?.classList.contains('open')) closeDeleteModal();
    else if (document.getElementById('exportConfirmModal')?.classList.contains('open')) closeExportModal();
  });
  deleteBtn?.addEventListener('click', async () => {
    if (deleteInput.value !== 'DELETE') return;
    try {
      await withLoading(deleteBtn, async () => { await deleteFn(); }, { label: 'Deleting...' });
    } catch (err) {
      closeDeleteModal();
      showPrivacyMsg('Deletion failed. Please try again or contact pingclassoff@gmail.com.');
      return;
    }
    closeDeleteModal();
    try { await db.auth.signOut(); } catch (e) { /* ignore */ }
    window.location.href = 'index.html';
  });

  return {
    openExportModal: () => {
      if (isDemoMode) { showPrivacyMsg('Data export is not available in demo mode.'); return; }
      document.getElementById('exportConfirmModal')?.classList.add('open');
    },
    openDeleteModal: (descOverride) => {
      if (isDemoMode) { showPrivacyMsg('Account deletion is not available in demo mode.'); return; }
      const descEl = document.getElementById('deleteConfirmDesc');
      if (descOverride && descEl) descEl.textContent = descOverride;
      deleteInput.value = '';
      deleteBtn.disabled = true;
      document.getElementById('deleteConfirmModal')?.classList.add('open');
      deleteInput.focus();
    },
    showPrivacyMsg
  };
}

// Binds the settings-page Privacy & Data controls (export + delete account).
// payloadFn must be an async function returning the role-appropriate export
// object. Called by parent/teacher dashboards; admin uses initConfirmModals directly.
function setupPrivacyData(payloadFn) {
  const msg = document.getElementById('privacyMsg');
  const { openExportModal, openDeleteModal } = initConfirmModals({
    exportFn: payloadFn,
    deleteDesc: 'This will permanently delete your account and your personal data. This cannot be undone.',
    deleteFn: async () => {
      const { data: { session } } = await db.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No session');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({})
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Deletion failed');
    },
    privacyMsg: msg
  });
  document.getElementById('exportDataBtn')?.addEventListener('click', openExportModal);
  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => openDeleteModal());
}

// Active-nav indicator — one bar that tracks the active nav item. It lives
// inside .sidebar-nav so it's clipped to the nav area and can never spill over
// the header (logo) or footer (settings) borders, even when the nav scrolls.
// It's positioned with an absolute translate and scrolls with the nav content,
// so it always stays glued to its item. Only nav items get an indicator —
// footer items (settings) have none.
const _navIndicatorEl = document.querySelector('.nav-indicator');

function computeIndicatorY() {
  const active = document.querySelector('.sidebar .nav-item.active');
  if (!active || !active.closest('.sidebar-nav')) return null;
  const barHeight = 20;
  return active.offsetTop + (active.offsetHeight - barHeight) / 2;
}

function positionNavIndicator() {
  if (!_navIndicatorEl) return;
  const y = computeIndicatorY();
  if (y === null) {
    _navIndicatorEl.style.opacity = '0';
    return;
  }
  _navIndicatorEl.style.transform = `translateY(${y}px)`;
  _navIndicatorEl.style.opacity = '1';
}

window.addEventListener('resize', positionNavIndicator);

// When the sidebar expands/collapses its layout settles (header reflows), so
// re-align the indicator once the width transition finishes.
const _sidebarEl = document.getElementById('sidebar');
if (_sidebarEl) {
  _sidebarEl.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'width') positionNavIndicator();
  });
}

positionNavIndicator();

// Auto-hide scrollbars — the page and nav-rail scrollbars fade out when idle
// and only reappear while the user is actually scrolling (or hovering the
// rail). A short debounce keeps them visible for a beat after the last wheel
// flick so they don't strobe while scrolling.
const _navScrollEl = document.querySelector('.sidebar-nav');
let _pageScrollTimer = null;
let _navScrollTimer = null;

function flashPageScrollbar() {
  document.documentElement.classList.add('is-scrolling');
  clearTimeout(_pageScrollTimer);
  _pageScrollTimer = setTimeout(() => {
    document.documentElement.classList.remove('is-scrolling');
  }, 900);
}

function flashNavScrollbar() {
  document.documentElement.classList.add('is-nav-scrolling');
  clearTimeout(_navScrollTimer);
  _navScrollTimer = setTimeout(() => {
    document.documentElement.classList.remove('is-nav-scrolling');
  }, 900);
}

document.addEventListener('scroll', (e) => {
  const t = e.target;
  if (t && t === _navScrollEl) flashNavScrollbar();
  else flashPageScrollbar();
}, { capture: true, passive: true });

// Page switching
function navigateToPage(page) {
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.click();
}

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', async (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (!page) return;

    // Close the mobile sidebar immediately so the tapped link doesn't sit on
    // the open drawer while the section loads behind it.
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    setScrollLock(false);

    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    // Make sure the item is fully in view inside a scrollable nav so its
    // indicator bar is visible too (e.g. the last item on short screens).
    item.scrollIntoView({ block: 'nearest' });
    positionNavIndicator();

    document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('page-active');

    // Start each section at the top instead of keeping the previous scroll offset
    const scrollEl = document.querySelector('.content-scroll');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'instant' });

    // Track active page so per-page layout tweaks (e.g. hiding the global search on dashboard) can apply
    document.body.classList.toggle('page-dashboard', page === 'dashboard');

    // Show skeleton loading instantly (skip dashboard — uses inline skeleton)
    if (typeof showSkeletons === 'function' && page !== 'dashboard') showSkeletons(page);

    // Call page-specific populate functions if they exist
    const pageFns = {
      dashboard: typeof loadStats === 'function' ? loadStats : undefined,
      billing: typeof populateBillingPage === 'function' ? populateBillingPage : undefined,
      staff: typeof populateStaffPage === 'function' ? populateStaffPage : undefined,
      parents: typeof populateParentsPage === 'function' ? populateParentsPage : undefined,
      students: typeof populateStudentsPage === 'function' ? populateStudentsPage : undefined,
      batches: typeof populateBatchesPage === 'function' ? populateBatchesPage : undefined,
      fees: typeof populateFeesPage === 'function' ? populateFeesPage : undefined,
      attendance: typeof populateAttendancePage === 'function' ? populateAttendancePage : undefined,
      announcements: typeof populateAnnouncementsPage === 'function' ? populateAnnouncementsPage : undefined,
      settings: typeof populateSettingsPage === 'function' ? populateSettingsPage : undefined
    };
    const fn = pageFns[page];
    if (typeof fn === 'function') {
      try {
        await fn();
      } catch (err) {
        console.error('Failed to load page:', page, err);
        if (typeof hideSkeletons === 'function') hideSkeletons(page);
        if (isNetworkError(err)) handleNetworkFailure(err);
        showSectionError(page,
          isNetworkError(err)
            ? 'We couldn\u2019t reach the server. Check your internet connection and try again.'
            : 'Something went wrong while loading this section. Please try again.',
          { retry: () => fn(), retryLabel: 'Try again' });
        return;
      }
    }

    // Hide skeleton after data loads (skip dashboard — uses inline skeleton)
    if (typeof hideSkeletons === 'function' && page !== 'dashboard') hideSkeletons(page);

    // Clear section search inputs
    document.querySelectorAll('.section-search-input').forEach(inp => { inp.value = ''; });
    // Clear section filter selects
    document.querySelectorAll('.section-filter-select').forEach(sel => {
      // Announcements filter has no blank option — keep the default "Everyone"
      sel.value = (sel.dataset.filter === 'announcementsList') ? 'all' : '';
    });
    // Hide any announcement "no results" message from a previous search
    const annNoResults = document.getElementById('announcementsNoResults');
    if (annNoResults) annNoResults.style.display = 'none';
    // Also reset filtered items
    document.querySelectorAll('.section-search-input').forEach(inp => {
      const filterId = inp.dataset.filter;
      if (!filterId) return;
      const container = document.getElementById(filterId);
      if (!container) return;
      container.querySelectorAll('.batch-card, .fee-batch-card, .announcement-card, tr').forEach(el => { el.style.display = ''; });
    });
  });
});

// Mobile sidebar toggle
function setScrollLock(locked) {
  document.body.classList.toggle('page-locked', !!locked);
}

// Copy the top-bar name + plan into the mobile sidebar user block
function syncSidebarUser() {
  const topName = document.getElementById('userName');
  const topPlan = document.getElementById('planBadge');
  const nameEl = document.getElementById('sidebarUserName');
  const planEl = document.getElementById('sidebarUserPlan');
  if (nameEl && topName) nameEl.textContent = topName.textContent || '';
  if (planEl && topPlan) {
    planEl.textContent = topPlan.textContent || '';
    const planCls = (topPlan.className || '').split(/\s+/).find(c => c.startsWith('plan-badge-'));
    planEl.className = 'sidebar-user-plan ' + (planCls || 'plan-badge-free');
  }
}

document.getElementById('menuToggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
  setScrollLock(sidebar.classList.contains('open'));
});

// Back button inside the mobile nav popup — close it without navigating
document.getElementById('sidebarBack')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  setScrollLock(false);
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !toggle || !overlay) return;
  if (!sidebar.contains(e.target) && !toggle.contains(e.target) && !overlay.contains(e.target)) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    setScrollLock(false);
  }
});

// Close sidebar when clicking overlay
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  setScrollLock(false);
});

// ========== Sidebar: adjustable width, minimize (icon-only) toggle ==========
// Works on dashboards that include the collapse button + resize handle markup.
(function () {
  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebarCollapse');
  const resizer = document.getElementById('sidebarResizer');
  if (!sidebar || !collapseBtn) return;

  const root = document.documentElement;
  const MIN_W = 64;
  const MAX_W = 340;
  const COLLAPSED_W = 74;
  const DEFAULT_W = 260;
  const ICON_BREAKPOINT = 170;
  const isMobile = () => window.innerWidth <= 768;

  const savedWidth = parseInt(localStorage.getItem('pingclass.sidebarWidth') || '', 10);
  const savedCollapsed = localStorage.getItem('pingclass.sidebarCollapsed') === '1';

  function setWidth(w) {
    root.style.setProperty('--sidebar-width', w + 'px');
  }

  function currentWidth() {
    return parseInt(root.style.getPropertyValue('--sidebar-width'), 10);
  }

  function applyIconOnly() {
    const w = currentWidth();
    sidebar.classList.toggle('icon-only', !sidebar.classList.contains('collapsed') && w < ICON_BREAKPOINT);
  }

  function syncCollapseTip() {
    const isMinimized = sidebar.classList.contains('collapsed') || sidebar.classList.contains('icon-only');
    collapseBtn.setAttribute('data-tooltip', isMinimized ? 'Open sidebar' : 'Close sidebar');
  }

  if (savedCollapsed) {
    sidebar.classList.add('collapsed');
    setWidth(COLLAPSED_W);
  } else {
    const w = savedWidth >= MIN_W && savedWidth <= MAX_W ? savedWidth : DEFAULT_W;
    sidebar.dataset.rememberedWidth = String(w);
    setWidth(w);
    applyIconOnly();
  }
  syncCollapseTip();

  collapseBtn.addEventListener('click', () => {
    const isMinimized = sidebar.classList.contains('collapsed') || sidebar.classList.contains('icon-only');
    if (!isMinimized) {
      const cur = currentWidth();
      sidebar.dataset.rememberedWidth = String(cur >= MIN_W ? cur : DEFAULT_W);
      sidebar.classList.add('collapsed');
      setWidth(COLLAPSED_W);
    } else {
      sidebar.classList.remove('collapsed');
      sidebar.classList.remove('icon-only');
      sidebar.dataset.rememberedWidth = String(DEFAULT_W);
      setWidth(DEFAULT_W);
      localStorage.setItem('pingclass.sidebarWidth', String(DEFAULT_W));
    }
    localStorage.setItem('pingclass.sidebarCollapsed', isMinimized ? '0' : '1');
    syncCollapseTip();
  });

  if (!resizer) return;

  let dragging = false;
  let activePointerId = null;
  let pendingWidth = null;
  let rafId = null;

  const startDrag = (e) => {
    if (isMobile()) return;
    dragging = true;
    activePointerId = e.pointerId;
    document.body.classList.add('resizing');
    resizer.setPointerCapture(e.pointerId);
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      localStorage.setItem('pingclass.sidebarCollapsed', '0');
      setWidth(parseInt(sidebar.dataset.rememberedWidth, 10) || 260);
      syncCollapseTip();
    }
    e.preventDefault();
  };

  const moveDrag = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    pendingWidth = Math.max(MIN_W, Math.min(MAX_W, Math.round(e.clientX)));
    sidebar.dataset.rememberedWidth = String(pendingWidth);
    localStorage.setItem('pingclass.sidebarWidth', String(pendingWidth));
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (pendingWidth === null) return;
      setWidth(pendingWidth);
      sidebar.classList.toggle('icon-only', pendingWidth < ICON_BREAKPOINT);
      syncCollapseTip();
      pendingWidth = null;
    });
  };

  const endDrag = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    document.body.classList.remove('resizing');
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pendingWidth !== null) {
      setWidth(pendingWidth);
      sidebar.classList.toggle('icon-only', pendingWidth < ICON_BREAKPOINT);
      syncCollapseTip();
      pendingWidth = null;
    }
  };

  resizer.addEventListener('pointerdown', startDrag);
  document.addEventListener('pointermove', moveDrag);
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
})();

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, c => map[c]);
}

/* ── Custom Select Helper ──────────────────────────────────────────
   Usage:
     HTML: <div class="custom-select" data-select-id="myFilter">
             <button type="button" class="custom-select-trigger"><span></span><svg>...</svg></button>
             <div class="custom-select-options"></div>
           </div>
     JS:   initCustomSelect('myFilter', [
             { value: 'all', label: 'All' },
             { value: 'paid', label: 'Paid' },
           ], 'all');
     Read: document.querySelector('[data-select-id="myFilter"] input[type="hidden"]').value
     Set:  setCustomSelectValue('myFilter', 'paid')
   ───────────────────────────────────────────────────────────────── */
function initCustomSelect(id, options, defaultValue, onChange) {
  const wrap = document.querySelector('[data-select-id="' + id + '"]');
  if (!wrap) return;
  let input = wrap.querySelector('input[type="hidden"]');
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    wrap.prepend(input);
  }
  const btn = wrap.querySelector('.custom-select-trigger span');
  const optsEl = wrap.querySelector('.custom-select-options');
  if (!btn || !optsEl) return;

  input.value = defaultValue || '';
  const defaultOpt = options.find(o => o.value === defaultValue);
  btn.textContent = defaultOpt ? defaultOpt.label : (options[0]?.label || '');

  optsEl.innerHTML = options.map(o =>
    '<div class="custom-select-option' + (o.value === defaultValue ? ' selected' : '') + '" data-value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</div>'
  ).join('');

  // Event delegation – survives innerHTML replacement in setCustomSelectOptions
  optsEl.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    input.value = opt.dataset.value;
    btn.textContent = opt.textContent;
    optsEl.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    wrap.classList.remove('open');
    optsEl.style.display = '';
    optsEl._wrap = null;
    if (optsEl.parentElement !== wrap) wrap.appendChild(optsEl);
    if (typeof onChange === 'function') onChange(opt.dataset.value);
  });

  wrap.querySelector('.custom-select-trigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = wrap.classList.contains('open');

    // Close all other dropdowns first
    document.querySelectorAll('.custom-select.open').forEach(el => {
      if (el !== wrap) {
        el.classList.remove('open');
        const o = el.querySelector('.custom-select-options');
        if (o) { o.style.display = ''; }
      }
    });

    wrap.classList.toggle('open', !wasOpen);

    // If inside a modal with overflow:hidden, detach dropdown to body
    const inModal = wrap.closest('.staff-modal');
    if (inModal) {
      if (!wasOpen) {
        optsEl._wrap = wrap; // store reference for cleanup
        document.body.appendChild(optsEl);
        const rect = wrap.getBoundingClientRect();
        optsEl.style.display = 'block';
        optsEl.style.position = 'fixed';
        optsEl.style.top = (rect.bottom + 4) + 'px';
        optsEl.style.left = rect.left + 'px';
        optsEl.style.width = rect.width + 'px';
        optsEl.style.zIndex = '1000';
      } else {
        optsEl.style.display = '';
        optsEl._wrap = null;
        wrap.appendChild(optsEl);
        optsEl.style.position = '';
        optsEl.style.top = '';
        optsEl.style.left = '';
        optsEl.style.width = '';
        optsEl.style.zIndex = '';
      }
    } else {
      optsEl.style.display = wasOpen ? '' : 'block';
    }
  });

  wrap._options = options;
  wrap._input = input;
  wrap._btn = btn;
  wrap._optsEl = optsEl;
}

// Type-ahead: pressing a letter key scrolls to the first matching option
document.addEventListener('keydown', (e) => {
  const openSelect = document.querySelector('.custom-select.open');
  if (!openSelect) return;
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  const letter = e.key.toLowerCase();
  // Use _optsEl (attached to wrap) so detached dropdowns still work
  const optsEl = openSelect._optsEl;
  if (!optsEl) return;
  const opts = optsEl.querySelectorAll('.custom-select-option');
  for (const opt of opts) {
    if (opt.textContent.trim().toLowerCase().startsWith(letter)) {
      opt.scrollIntoView({ block: 'start' });
      opts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      break;
    }
  }
});

function setCustomSelectValue(id, value) {
  const wrap = document.querySelector('[data-select-id="' + id + '"]');
  if (!wrap || !wrap._input) return;
  wrap._input.value = value;
  const opt = wrap._optsEl?.querySelector('[data-value="' + CSS.escape(value) + '"]');
  if (opt) {
    if (wrap._btn) wrap._btn.textContent = opt.textContent;
    wrap._optsEl.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  }
}

function getCustomSelectValue(id) {
  const wrap = document.querySelector('[data-select-id="' + id + '"]');
  return wrap?._input?.value || '';
}

function closeAllCustomSelects() {
  // Close all open wrappers — re-parent options that are still inside them
  document.querySelectorAll('.custom-select.open').forEach(el => {
    el.classList.remove('open');
    const opts = el.querySelector('.custom-select-options');
    if (opts) {
      opts.style.display = '';
      if (opts.parentElement !== el) el.appendChild(opts);
    }
  });
  // Also clean up orphaned options detached to body (from modal dropdowns)
  document.querySelectorAll('body > .custom-select-options').forEach(opts => {
    opts.style.display = '';
    const wrap = opts._wrap;
    if (wrap) {
      wrap.appendChild(opts);
      wrap.classList.remove('open');
      opts._wrap = null;
    }
  });
}

function setCustomSelectOptions(id, options, defaultValue) {
  const wrap = document.querySelector('[data-select-id="' + id + '"]');
  if (!wrap || !wrap._optsEl) return;
  wrap._options = options;
  const val = defaultValue !== undefined ? defaultValue : (wrap._input?.value || '');
  wrap._input.value = val;
  const defaultOpt = options.find(o => o.value === val);
  if (wrap._btn) wrap._btn.textContent = defaultOpt ? defaultOpt.label : (options[0]?.label || '');
  wrap._optsEl.innerHTML = options.map(o =>
    '<div class="custom-select-option' + (o.value === val ? ' selected' : '') + '" data-value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</div>'
  ).join('');
}

document.addEventListener('click', () => {
  closeAllCustomSelects();
});

// Safe for a single-quoted JS string inside a double-quoted HTML attribute
// (e.g. onclick="fn('...')"). Escapes HTML attribute characters first, then
// backslashes and single quotes for the JS string context. Self-contained
// (the app's escapeHtml leaves quotes untouched, which would break the
// attribute, so this must not depend on it).
function escapeInlineJs(value) {
  const s = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Announcements: shared card renderer + pagination ──
// Reads go through the get_announcements() RPC so audience targeting
// (all/teachers/parents) is enforced server-side per role + institute.

const ANNOUNCEMENTS_PAGE_SIZE = 20;
let announcementsCursor = null;
let announcementsLoading = false;

function resetAnnouncementsPager() {
  announcementsCursor = null;
  announcementsLoading = false;
}

async function fetchAnnouncementsPage(limit = ANNOUNCEMENTS_PAGE_SIZE) {
  if (announcementsLoading) return { data: [], done: true };
  announcementsLoading = true;
  try {
    const params = { p_limit: limit };
    if (announcementsCursor) {
      params.p_cursor = announcementsCursor.created_at;
      params.p_cursor_id = announcementsCursor.id;
    }
    const res = await safeQuery(() => db.rpc('get_announcements', params));
    if (!res.ok) throw res.error;
    const rows = res.data || [];
    if (rows.length) {
      const last = rows[rows.length - 1];
      announcementsCursor = { created_at: last.created_at, id: last.id };
    }
    return { data: rows, done: rows.length < limit };
  } finally {
    announcementsLoading = false;
  }
}

function announcementCardHTML(a, opts = {}) {
  const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  let target = a.target === 'teachers' || a.target === 'parents' ? a.target : 'all';
  let audienceLabel = target === 'all' ? 'Everyone' : target === 'teachers' ? 'Teachers' : 'Parents';
  // Batch-level targeting: show batch name
  if (a.target_batch_id) {
    audienceLabel = a.batch_name || 'Specific Batch';
  }
  const editBtn = opts.canEdit
    ? `<button class="staff-action-btn" onclick="editAnnouncement('${escapeInlineJs(a.id)}')">Edit</button>`
    : '';
  const deleteBtn = opts.canDelete
    ? `<button class="staff-action-btn staff-action-btn-resend" onclick="deleteAnnouncement('${escapeInlineJs(a.id)}')">Delete</button>`
    : '';
  const roleBadge = opts.showBadge === false ? '' : `<span class="staff-role staff-role-teacher">${audienceLabel}</span>`;
  const actions = (editBtn || deleteBtn)
    ? `<div class="announcement-card-actions">
        ${editBtn}
        ${deleteBtn}
      </div>`
    : '';
  return `<div class="announcement-card" data-audience="${target}">
    <div class="announcement-card-header">
      <h3>${escapeHtml(a.title)}</h3>
      <div class="announcement-card-meta">
        ${roleBadge}
        <span class="staff-date">${dateStr}</span>
        ${editBtn}
        ${deleteBtn}
      </div>
    </div>
    <p class="announcement-card-body">${escapeHtml(a.message || '')}</p>
    ${actions}
  </div>`;
}

function setAnnouncementsLoadMore(visible) {
  const btn = document.getElementById('announcementsLoadMore');
  if (btn) btn.style.display = visible ? '' : 'none';
}

// ── Announcements search + audience filter ──
// Works on every dashboard (admin/teacher/parent). Search matches only the
// announcement title and body (never the audience badge, date, or buttons);
// the audience filter matches each card's data-audience attribute.
// Cards fetched later via "Load more" are re-filtered so results stay
// consistent. A "no results" message appears only when cards exist but none
// match the active search/filter (the empty state is handled separately).
function announcementCardSearchText(card) {
  const title = card.querySelector('.announcement-card-header h3');
  const body = card.querySelector('.announcement-card-body');
  return ((title ? title.textContent : '') + ' ' + (body ? body.textContent : '')).toLowerCase();
}

function applyAnnouncementFilters() {
  document.querySelectorAll('.page').forEach(page => {
    if (!page.id || page.id !== 'page-announcements') return;
    const queryEl = page.querySelector('.section-search-input[data-filter="announcementsList"]');
    const filterWrap = page.querySelector('.section-filter-select[data-filter="announcementsList"]');
    const container = document.getElementById('announcementsList');
    if (!container) return;
    const query = (queryEl ? queryEl.value : '').toLowerCase().trim();
    const filterEl = filterWrap?.querySelector('input[type="hidden"]');
    const filterVal = filterEl ? filterEl.value : '';
    let visible = 0;
    container.querySelectorAll('.announcement-card').forEach(card => {
      const matchesQuery = !query || announcementCardSearchText(card).includes(query);
      const matchesFilter = !filterVal || card.dataset.audience === filterVal;
      const show = matchesQuery && matchesFilter;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const noResults = document.getElementById('announcementsNoResults');
    if (noResults) {
      const hasCards = container.querySelectorAll('.announcement-card').length > 0;
      noResults.style.display = (hasCards && visible === 0) ? '' : 'none';
    }
  });
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.matches && e.target.matches('.section-search-input[data-filter="announcementsList"]')) {
    applyAnnouncementFilters();
  }
});

// ── Latest announcements (dashboard sections) ──
// Role-aware via the get_announcements RPC — shared by the parent and teacher
// dashboards so the "Latest announcements" card shows the same list the
// Announcements page would. One fetch per session is cached.
let latestAnnouncementsPromise = null;

async function fetchLatestAnnouncements(limit = 3) {
  if (!currentInstitute?.id) return [];
  if (latestAnnouncementsPromise) return latestAnnouncementsPromise;
  latestAnnouncementsPromise = (async () => {
    try {
      resetAnnouncementsPager();
      const { data } = await fetchAnnouncementsPage(1);
      return (data || []).slice(0, limit);
    } catch (e) {
      console.warn('Latest announcements fetch failed:', e);
      return [];
    } finally {
      resetAnnouncementsPager();
    }
  })();
  return latestAnnouncementsPromise;
}

function renderLatestAnnouncements(el, list) {
  if (!el) return;
  const items = (list || []).slice(0, 3);
  if (!items.length) {
    el.innerHTML =
      '<div class="latest-announcement-empty">' +
        '<svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />' +
        '</svg>' +
        '<h3>No announcements yet</h3>' +
        '<p>Announcements from the institute will appear here.</p>' +
      '</div>';
    return;
  }
  el.innerHTML =
    '<div class="latest-announcements">' +
    items.map(a => {
      const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const target = a.target === 'teachers' || a.target === 'parents' ? a.target : 'all';
      const audienceLabel = target === 'all' ? 'Everyone' : target === 'teachers' ? 'Teachers' : 'Parents';
      return (
        '<div class="announcement-card latest-announcement-card">' +
          '<div class="announcement-card-header">' +
            '<h3>' + escapeHtml(a.title) + '</h3>' +
            '<div class="announcement-card-meta">' +
              '<span class="staff-role staff-role-teacher">' + audienceLabel + '</span>' +
              '<span class="staff-date">' + dateStr + '</span>' +
            '</div>' +
          '</div>' +
          '<p class="announcement-card-body">' + escapeHtml(a.message || '') + '</p>' +
        '</div>'
      );
    }).join('') +
    '</div>';
}

// ── Server-side plan limit enforcement ──

// Cached plan limits — refreshed on init and after mutations
let planLimits = { plan_id: 'free', max_students: 20, max_batches: 1, max_teachers: 1, announcements_allowed: false };

async function fetchPlanLimits() {
  if (!currentInstitute?.id) return planLimits;
  const res = await safeQuery(() => db.rpc('get_plan_limits', { inst_id: currentInstitute.id }));
  if (res.ok && res.data && res.data.length > 0) {
    planLimits = res.data[0];
  } else {
    console.warn('Failed to fetch plan limits from server:', res.error);
    // Fallback to client-side config
    const cfg = Payment.getPlanConfig(currentPlan);
    planLimits = {
      plan_id: currentPlan,
      max_students: cfg.limits.maxStudents === Infinity ? 999999 : cfg.limits.maxStudents,
      max_batches: cfg.limits.maxBatches === Infinity ? 999999 : cfg.limits.maxBatches,
      max_teachers: cfg.limits.maxTeachers === Infinity ? 999999 : cfg.limits.maxTeachers,
      announcements_allowed: cfg.features.announcements || false
    };
  }
  return planLimits;
}

function isAtLimit(type) {
  if (type === 'students') return planLimits.max_students <= 20 && currentPlan === 'free';
  if (type === 'batches') return planLimits.max_batches <= 1 && currentPlan === 'free';
  if (type === 'teachers') return planLimits.max_teachers <= 1 && currentPlan === 'free';
  return false;
}

function getLimitDisplay(type) {
  if (type === 'students') {
    const max = planLimits.max_students === 999999 ? '∞' : planLimits.max_students;
    return max;
  }
  if (type === 'batches') {
    const max = planLimits.max_batches === 999999 ? '∞' : planLimits.max_batches;
    return max;
  }
  return '∞';
}

function showUpgradePrompt(feature) {
  const requiredPlan = currentPlan === 'free' ? 'Basic' : 'Pro';
  const planKey = currentPlan === 'free' ? 'basic' : 'pro';
  const requiredPrice = '₹' + (CONFIG.PLANS[planKey].amount / 100);
  const msg = `This feature requires the ${requiredPlan} plan (${requiredPrice}/month).\n\nUpgrade to unlock ${feature}.`;
  if (confirm(msg)) {
    window.location.hash = '#billing';
    document.querySelector('[data-page="billing"]')?.click();
  }
}

function handlePlanError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('student_limit_reached') || msg.includes('student limit')) {
    showUpgradePrompt('more students');
    return true;
  }
  if (msg.includes('batch_limit_reached') || msg.includes('batch limit')) {
    showUpgradePrompt('more batches');
    return true;
  }
  if (msg.includes('teacher_limit_reached') || msg.includes('teacher limit')) {
    showUpgradePrompt('more teachers');
    return true;
  }
  if (msg.includes('announcements_not_allowed') || msg.includes('announcements require')) {
    showUpgradePrompt('announcements');
    return true;
  }
  return false;
}

// ── Tooltips ──
// Any element with a data-tooltip attribute gets a shared hover bubble.
// Direction: data-tooltip-pos = top (default) | bottom | left | right.
// Uses event delegation so dynamically rendered rows/buttons work too.
let _tipEl = null;
let _tipTimer = null;
let _tipTarget = null;

function getTipEl() {
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.className = 'tooltip';
    _tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(_tipEl);
  }
  return _tipEl;
}

function positionTip(el, pos) {
  const tip = getTipEl();
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const gap = 8;
  let x, y;

  if (pos === 'bottom') {
    x = r.left + r.width / 2 - tw / 2;
    y = r.bottom + gap;
  } else if (pos === 'left') {
    x = r.left - tw - gap;
    y = r.top + r.height / 2 - th / 2;
  } else if (pos === 'right') {
    x = r.right + gap;
    y = r.top + r.height / 2 - th / 2;
  } else {
    x = r.left + r.width / 2 - tw / 2;
    y = r.top - th - gap;
  }

  x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - th - 8));
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

function showTip(el) {
  const text = el.getAttribute('data-tooltip');
  if (!text) return;
  const pos = el.getAttribute('data-tooltip-pos') || 'top';
  const tip = getTipEl();
  tip.textContent = text;
  tip.setAttribute('data-pos', pos);
  tip.classList.add('tooltip-visible');
  positionTip(el, pos);
  _tipTarget = el;
}

function hideTip() {
  clearTimeout(_tipTimer);
  if (_tipEl) _tipEl.classList.remove('tooltip-visible');
  _tipTarget = null;
}

document.addEventListener('mouseover', (e) => {
  clearTimeout(_tipTimer);
  if (recentTouch()) return;
  const target = e.target.closest('[data-tooltip]');
  if (!target) return;
  if (target === _tipTarget) return;
  _tipTimer = setTimeout(() => showTip(target), 300);
}, true);

document.addEventListener('mouseout', (e) => {
  const target = e.target.closest('[data-tooltip]');
  clearTimeout(_tipTimer);
  if (!target || target !== _tipTarget) return;
  // Stay visible while moving between children of the same element
  const to = e.relatedTarget;
  if (to && to.closest && to.closest('[data-tooltip]') === target) return;
  hideTip();
}, true);

document.addEventListener('focusin', (e) => {
  if (recentTouch()) return;
  const target = e.target.closest('[data-tooltip]');
  if (target) {
    clearTimeout(_tipTimer);
    showTip(target);
  }
});

document.addEventListener('focusout', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target && target === _tipTarget) hideTip();
});

// A tooltip left open becomes stale the moment the page scrolls or resizes
document.addEventListener('scroll', hideTip, { capture: true, passive: true });
window.addEventListener('resize', hideTip);

// ── Mobile long-press tooltips ──
// On touch devices a tooltip only appears after pressing and holding the
// element for 1.5s, and disappears the moment the finger is lifted. A quick
// tap never shows a tooltip and still activates the element as normal.
const LONG_PRESS_MS = 1500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

let _longPressTimer = null;
let _longPressTarget = null;
let _longPressTouchId = null;
let _longPressStartX = 0;
let _longPressStartY = 0;
let _tipLongPressActive = false;
let _suppressNextClick = false;
let _lastTouchTs = 0;

// True if a touch interaction happened within the last ~500ms. Used to ignore
// the synthetic mouse events (mouseover/mouseup/click) that browsers fire
// after a tap, so a quick tap can never trigger the hover tooltip.
function recentTouch(ms) {
  return performance.now() - _lastTouchTs < (ms || 500);
}

document.addEventListener('touchstart', (e) => {
  _lastTouchTs = performance.now();
  if (e.touches.length !== 1) return;
  const target = e.target.closest('[data-tooltip]');
  if (!target) return;
  const t = e.touches[0];
  clearTimeout(_longPressTimer);
  _longPressTarget = target;
  _longPressTouchId = t.identifier;
  _longPressStartX = t.clientX;
  _longPressStartY = t.clientY;
  _tipLongPressActive = false;
  _suppressNextClick = false;
  _longPressTimer = setTimeout(() => {
    _tipLongPressActive = true;
    showTip(target);
  }, LONG_PRESS_MS);
}, { capture: true, passive: true });

document.addEventListener('touchmove', (e) => {
  _lastTouchTs = performance.now();
  if (_longPressTouchId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== _longPressTouchId) continue;
    const dx = Math.abs(t.clientX - _longPressStartX);
    const dy = Math.abs(t.clientY - _longPressStartY);
    if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
      // The finger is dragging/scrollling — not a long-press.
      clearTimeout(_longPressTimer);
      _longPressTouchId = null;
      _longPressTarget = null;
      _tipLongPressActive = false;
      hideTip();
    }
  }
}, { capture: true, passive: true });

document.addEventListener('touchend', (e) => {
  _lastTouchTs = performance.now();
  clearTimeout(_longPressTimer);
  if (_longPressTouchId === null) return;
  _longPressTouchId = null;
  if (_tipLongPressActive) {
    // Long-press completed — hide the tooltip now that the finger is lifted,
    // and swallow the click that follows so the feature isn't triggered.
    hideTip();
    _tipLongPressActive = false;
    _suppressNextClick = true;
    // Safety net in case the browser doesn't fire a click afterwards.
    setTimeout(() => { _suppressNextClick = false; _longPressTarget = null; }, 1000);
  }
}, { capture: true, passive: true });

document.addEventListener('touchcancel', () => {
  clearTimeout(_longPressTimer);
  _longPressTouchId = null;
  _longPressTarget = null;
  _tipLongPressActive = false;
  _suppressNextClick = false;
  hideTip();
}, { capture: true, passive: true });

// Swallow the click that immediately follows a completed long-press so the
// element's action doesn't fire. Keyboard-triggered clicks (detail === 0) pass.
document.addEventListener('click', (e) => {
  if (!_suppressNextClick) return;
  _suppressNextClick = false;
  if (_longPressTarget && _longPressTarget.contains(e.target) && e.detail >= 1) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  _longPressTarget = null;
}, true);

// ============================================
// ERROR BOUNDARY: safeQuery + section fallbacks
// ============================================

/**
 * safeQuery wraps a Supabase query function and returns { data, error, ok }.
 * On network error, returns { data: null, error: <normalized>, ok: false }.
 * On success, returns { data, error: null, ok: true }.
 *
 * Usage:
 *   const { data, error, ok } = await safeQuery(() =>
 *     db.from('students').select('*').eq('institute_id', instId)
 *   );
 *   if (!ok) { showSectionFallback('students', error); return; }
 */
async function safeQuery(queryFn) {
  try {
    const result = await queryFn();
    // supabase-js resolves as { data, error, count }
    if (result && result.error) {
      return { data: null, error: result.error, ok: false, count: null };
    }
    return { data: result?.data ?? null, error: null, ok: true, count: result?.count ?? null };
  } catch (err) {
    const normalized = isNetworkError(err) ? makeNetworkError() : err;
    return { data: null, error: normalized, ok: false, count: null };
  }
}

/**
 * showSectionFallback shows a retryable error card inside a section.
 * Similar to showSectionError but designed for page-level sections
 * (not the full-page error card).
 *
 * @param {string} sectionId - The page/section element ID (e.g. 'page-students')
 * @param {Error|string} error - The error to display
 * @param {object} opts - { retry: Function, retryLabel: string }
 */
function showSectionFallback(sectionId, error, opts = {}) {
  const page = typeof sectionId === 'string'
    ? (document.getElementById(sectionId) || document.getElementById('page-' + sectionId))
    : sectionId;
  if (!page) return;
  clearSectionFallback(sectionId);
  const msg = error?.message || String(error) || 'Something went wrong.';
  const isNetwork = isNetworkError(error);
  const el = document.createElement('div');
  el.className = 'section-fallback';
  el.innerHTML = `
    <div class="section-fallback-icon">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${isNetwork
          ? '<path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
          : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
      </svg>
    </div>
    <div class="section-fallback-title">${isNetwork ? 'You appear to be offline' : 'Couldn\'t load data'}</div>
    <div class="section-fallback-msg">${escapeHtml(msg)}</div>
    ${opts.retry ? `<button class="section-fallback-retry" type="button">${escapeHtml(opts.retryLabel || 'Try again')}</button>` : ''}
  `;
  const retryBtn = el.querySelector('.section-fallback-retry');
  if (retryBtn && opts.retry) {
    retryBtn.addEventListener('click', async () => {
      retryBtn.disabled = true;
      retryBtn.innerHTML = '<span class="btn-spinner btn-spinner-dark"></span>Retrying&hellip;';
      try {
        await opts.retry();
      } finally {
        clearSectionFallback(sectionId);
      }
    });
  }
  page.prepend(el);
}

/**
 * clearSectionFallback removes all fallback cards from a section.
 */
function clearSectionFallback(sectionId) {
  const page = typeof sectionId === 'string'
    ? (document.getElementById(sectionId) || document.getElementById('page-' + sectionId))
    : sectionId;
  if (!page) return;
  page.querySelectorAll('.section-fallback').forEach(el => el.remove());
}
