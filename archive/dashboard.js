// Supabase init
const SUPABASE_URL = 'https://evrqzgjksmidqhzvckhq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF6Z2prc21pZHFoenZja2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTE4MzksImV4cCI6MjEwMDEyNzgzOX0.UV4YLbfJwszr-zzzkpJgbLbQ4ZZhiGVYzlAHpst45mE';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let userProfile = null;
let isDemoMode = false;
let currentPlan = 'free';
let currentInstitute = null;

// Route guard: role → allowed pages
const ROLE_PAGES = {
  admin:    ['dashboard', 'students', 'batches', 'fees', 'attendance', 'announcements', 'staff', 'billing'],
  teacher:  ['dashboard', 'students', 'batches', 'attendance', 'announcements'],
  parent:   ['dashboard', 'fees', 'attendance', 'announcements']
};

function guardRoute(role, page) {
  const allowed = ROLE_PAGES[role] || ROLE_PAGES.admin;
  if (!allowed.includes(page)) {
    // Redirect to first allowed page
    return allowed[0];
  }
  return page;
}

// Demo data
const demoData = {
  user: { full_name: 'Demo User', email: 'demo@pingclass.com' },
  stats: { students: 47, batches: 5, pending: 12500, collected: 89000 }
};

// Check auth
async function init() {
  const params = new URLSearchParams(window.location.search);
  isDemoMode = params.has('demo');

  if (isDemoMode) {
    loadDemoMode();
    return;
  }

  const { data: { session } } = await db.auth.getSession();
  
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = session.user;

  // Get user profile (no join — avoid 406 from RLS on institutes)
  let { data } = await db
    .from('users')
    .select('*')
    .eq('id', currentUser.id)
    .single();

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

    // Try to find existing institute
    let { data: inst } = await db
      .from('institutes')
      .select('*')
      .eq('owner_id', currentUser.id)
      .maybeSingle();

    // Create institute if missing
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

    // Create user profile
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

      // Re-fetch user
      const { data: refreshed } = await db
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      data = refreshed;
      institute = inst;
    }

    // Fallback: build profile from what we have
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
  const displayName = userProfile?.full_name || currentUser.email;
  document.getElementById('userName').textContent = displayName;
  document.getElementById('welcomeName').textContent = displayName.split(' ')[0];

  // Check subscription plan
  currentPlan = await Payment.getActivePlan(db, currentUser.id);
  const planConfig = Payment.getPlanConfig(currentPlan);
  console.log('Current plan:', currentPlan, planConfig);

  loadStats();
  applyPlanGating();
  applyRoleGating();

  // Route guard: ensure current page is allowed for this role
  const role = userProfile?.role || 'admin';
  const activeNav = document.querySelector('.sidebar-nav .nav-item.active');
  const currentPage = activeNav?.dataset?.page || 'dashboard';
  const safePage = guardRoute(role, currentPage);
  if (safePage !== currentPage) {
    const defaultNav = document.querySelector(`.nav-item[data-page="${safePage}"]`);
    if (defaultNav) defaultNav.click();
  }
}

// Apply role-based UI gating
function applyRoleGating() {
  if (isDemoMode) return;

  const role = userProfile?.role || 'admin';
  const allowedRoles = { admin: 'admin', teacher: 'teacher', parent: 'parent' };

  // Update welcome subtitle based on role
  const welcomeSubtitle = document.querySelector('#page-dashboard .welcome p');
  if (welcomeSubtitle) {
    const roleMessages = {
      admin: 'Here\'s what\'s happening with your institute today.',
      teacher: 'Here\'s what\'s happening with your classes today.',
      parent: 'Here\'s what\'s happening with your child today.'
    };
    welcomeSubtitle.textContent = roleMessages[role] || roleMessages.admin;
  }

  // Hide/show sidebar nav items based on role
  document.querySelectorAll('.nav-item[data-role]').forEach(el => {
    const allowed = el.dataset.role.split(',').map(r => r.trim());
    if (allowed.includes('all') || allowed.includes(role)) {
      el.classList.remove('role-hidden');
    } else {
      el.classList.add('role-hidden');
    }
  });

  // Hide billing page content for non-admins
  const billingPage = document.getElementById('page-billing');
  if (billingPage) {
    if (role === 'admin') {
      billingPage.classList.remove('role-hidden');
    } else {
      billingPage.classList.add('role-hidden');
    }
  }

  // Update welcome name for teacher/parent context
  const welcomeH1 = document.querySelector('#page-dashboard .welcome h1');
  if (welcomeH1) {
    const firstName = (userProfile?.full_name || currentUser?.email || '').split(' ')[0] || 'there';
    if (role === 'teacher') {
      welcomeH1.innerHTML = `Welcome back, <span id="welcomeName">${firstName}</span>`;
    } else if (role === 'parent') {
      welcomeH1.innerHTML = `Welcome back, <span id="welcomeName">${firstName}</span>`;
    }
  }
}

function loadDemoMode() {
  document.getElementById('demoBanner').style.display = 'flex';
  document.getElementById('userName').textContent = 'Demo Mode';
  document.getElementById('welcomeName').textContent = 'there';
  
  document.getElementById('totalStudents').textContent = demoData.stats.students;
  document.getElementById('totalBatches').textContent = demoData.stats.batches;
  document.getElementById('pendingFees').textContent = `₹${demoData.stats.pending.toLocaleString('en-IN')}`;
  document.getElementById('collectedFees').textContent = `₹${demoData.stats.collected.toLocaleString('en-IN')}`;

  // Hide logout in demo mode
  document.getElementById('logoutBtn').style.display = 'none';
}

// Apply plan-based feature gating
function applyPlanGating() {
  if (isDemoMode) return;

  const planConfig = Payment.getPlanConfig(currentPlan);

  // Update plan badge in top bar
  const planBadge = document.getElementById('planBadge');
  if (planBadge) {
    planBadge.textContent = planConfig.name + ' Plan';
    planBadge.className = `plan-badge plan-badge-${currentPlan}`;
  }

  // Update welcome message with plan info (dashboard page only)
  const welcomeEl = document.querySelector('#page-dashboard .welcome p');
  if (welcomeEl) {
    const limits = planConfig.limits;
    const limitTexts = [];
    if (limits.maxStudents !== Infinity) limitTexts.push(`${limits.maxStudents} students`);
    else limitTexts.push('Unlimited students');
    if (limits.maxBatches !== Infinity) limitTexts.push(`${limits.maxBatches} batches`);
    else limitTexts.push('Unlimited batches');
    welcomeEl.textContent = `You're on the ${planConfig.name} plan — ${limitTexts.join(', ')}.`;
  }

  // Gate sidebar navigation items
  document.querySelectorAll('[data-gate]').forEach(el => {
    const feature = el.dataset.gate;
    if (!planConfig.access[feature]) {
      el.classList.add('gated');
      // Set the correct upgrade badge text
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

  // Gate stat cards
  document.querySelectorAll('[data-gate-stat]').forEach(el => {
    const feature = el.dataset.gateStat;
    if (!planConfig.access[feature]) {
      el.classList.add('gated');
    } else {
      el.classList.remove('gated');
    }
  });
}

// Show upgrade prompt
function showUpgrade(feature) {
  const planConfig = Payment.getPlanConfig(currentPlan);
  const requiredPlan = currentPlan === 'free' ? 'Basic' : 'Pro';
  const requiredPrice = currentPlan === 'free' ? '₹249' : '₹599';

  alert(`This feature requires the ${requiredPlan} plan (${requiredPrice}/month). Please upgrade to access ${feature}.`);
}

// Load stats
async function loadStats() {
  if (!userProfile?.institute_id) return;

  const instituteId = userProfile.institute_id;

  // Students count
  const { count: students } = await db
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('institute_id', instituteId);

  // Batches count
  const { count: batches } = await db
    .from('batches')
    .select('*', { count: 'exact', head: true })
    .eq('institute_id', instituteId);

  // Get student IDs for this institute
  const { data: studentRows } = await db
    .from('students')
    .select('id')
    .eq('institute_id', instituteId);
  const studentIds = (studentRows || []).map(s => s.id);

  // Pending fees
  let pending = [];
  if (studentIds.length > 0) {
    const { data } = await db
      .from('payments')
      .select('amount')
      .eq('status', 'pending')
      .in('student_id', studentIds);
    pending = data || [];
  }

  // Collected fees
  let collected = [];
  if (studentIds.length > 0) {
    const { data } = await db
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
      .in('student_id', studentIds);
    collected = data || [];
  }

  document.getElementById('totalStudents').textContent = students || 0;
  document.getElementById('totalBatches').textContent = batches || 0;
  
  const pendingTotal = pending?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const collectedTotal = collected?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  
  document.getElementById('pendingFees').textContent = `₹${pendingTotal.toLocaleString('en-IN')}`;
  document.getElementById('collectedFees').textContent = `₹${collectedTotal.toLocaleString('en-IN')}`;
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (isDemoMode) {
    window.location.href = 'index.html';
    return;
  }
  await db.auth.signOut();
  window.location.href = 'index.html';
});

// ========== PAGE SWITCHING ==========
document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (!page) return;

    // Skip if role-hidden
    if (item.classList.contains('role-hidden')) return;

    // Route guard: check if role allows this page
    const role = userProfile?.role || 'admin';
    const safePage = guardRoute(role, page);
    if (safePage !== page) {
      // Role doesn't allow this page — go to their default
      const defaultItem = document.querySelector(`.nav-item[data-page="${safePage}"]`);
      if (defaultItem) defaultItem.click();
      return;
    }

    // Update active nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    // Show correct page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('page-active');

    // Populate billing page if switching to it
    if (page === 'billing') populateBillingPage();
    // Populate staff page if switching to it
    if (page === 'staff') populateStaffPage();

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  });
});

// ========== BILLING PAGE ==========
function populateBillingPage() {
  if (isDemoMode) return;

  const planConfig = Payment.getPlanConfig(currentPlan);

  // Current plan card
  document.getElementById('billingPlanName').textContent = planConfig.name;

  const limits = planConfig.limits;
  const detailParts = [];
  detailParts.push(limits.maxStudents === Infinity ? 'Unlimited students' : `${limits.maxStudents} students`);
  detailParts.push(limits.maxBatches === Infinity ? 'Unlimited batches' : `${limits.maxBatches} batches`);
  detailParts.push(limits.maxTeachers === Infinity ? 'Unlimited teachers' : `${limits.maxTeachers} teachers`);
  document.getElementById('billingPlanDetail').textContent = detailParts.join(' \u00B7 ');

  // Status & expiry
  document.getElementById('billingExpiry').textContent = currentPlan === 'free' ? 'Free forever' : 'Renews monthly';

  // Usage bars (load from DB)
  loadBillingUsage();

  // Payment history
  loadPaymentHistory();

  // Plan card states
  const planOrder = ['free', 'basic', 'pro'];
  const currentIdx = planOrder.indexOf(currentPlan);

  document.querySelectorAll('.billing-plan-card').forEach(card => {
    const cardPlan = card.id.replace('billingCard-', '');
    const cardIdx = planOrder.indexOf(cardPlan);
    const btn = card.querySelector('.billing-plan-btn');

    card.classList.remove('billing-plan-card-current', 'billing-plan-card-lower');

    if (cardPlan === currentPlan) {
      // Current plan
      card.classList.add('billing-plan-card-current');
      if (btn) {
        btn.textContent = 'Current Plan';
        btn.disabled = true;
        btn.classList.remove('billing-plan-btn-upgrade');
        btn.classList.add('billing-plan-btn-current');
      }
    } else if (cardIdx < currentIdx) {
      // Lower plan — disable, no downgrade from billing page
      card.classList.add('billing-plan-card-lower');
      if (btn) {
        btn.textContent = 'Included in your plan';
        btn.disabled = true;
        btn.classList.remove('billing-plan-btn-upgrade');
        btn.classList.add('billing-plan-btn-current');
      }
    } else {
      // Higher plan — enable upgrade
      if (btn) {
        btn.textContent = 'Upgrade to ' + Payment.getPlanConfig(cardPlan).name;
        btn.disabled = false;
        btn.classList.remove('billing-plan-btn-current');
        btn.classList.add('billing-plan-btn-upgrade');
      }
    }
  });
}

// Attach upgrade click handlers once
document.querySelectorAll('.billing-plan-btn-upgrade').forEach(btn => {
  btn.addEventListener('click', () => startBillingUpgrade(btn.dataset.plan));
});

async function loadBillingUsage() {
  if (!userProfile?.institute_id) return;

  const planConfig = Payment.getPlanConfig(currentPlan);
  const limits = planConfig.limits;

  // Students count
  const { count: studentCount } = await db
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('institute_id', userProfile.institute_id);

  // Batches count
  const { count: batchCount } = await db
    .from('batches')
    .select('*', { count: 'exact', head: true })
    .eq('institute_id', userProfile.institute_id);

  // Students bar
  const maxStudents = limits.maxStudents === Infinity ? 100 : limits.maxStudents;
  const studentPct = Math.min(100, ((studentCount || 0) / maxStudents) * 100);
  document.getElementById('usageStudents').textContent = `${studentCount || 0} / ${limits.maxStudents === Infinity ? '\u221E' : limits.maxStudents}`;
  document.getElementById('usageStudentsBar').style.width = studentPct + '%';
  if (studentPct >= 90) document.getElementById('usageStudentsBar').classList.add('almost-full');
  else document.getElementById('usageStudentsBar').classList.remove('almost-full');

  // Batches bar
  const maxBatches = limits.maxBatches === Infinity ? 10 : limits.maxBatches;
  const batchPct = Math.min(100, ((batchCount || 0) / maxBatches) * 100);
  document.getElementById('usageBatches').textContent = `${batchCount || 0} / ${limits.maxBatches === Infinity ? '\u221E' : limits.maxBatches}`;
  document.getElementById('usageBatchesBar').style.width = batchPct + '%';
  if (batchPct >= 90) document.getElementById('usageBatchesBar').classList.add('almost-full');
  else document.getElementById('usageBatchesBar').classList.remove('almost-full');
}

async function loadPaymentHistory() {
  if (!currentUser) return;

  const historyEl = document.getElementById('billingHistoryList');
  if (!historyEl) return;

  try {
    const { data: payments, error } = await db
      .from('subscriptions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Hide empty state, show history
    document.getElementById('billingHistoryEmpty').style.display = 'none';
    historyEl.style.display = 'flex';

    if (!payments || payments.length === 0) {
      document.getElementById('billingHistoryEmpty').style.display = 'flex';
      historyEl.style.display = 'none';
      return;
    }

    historyEl.innerHTML = '';

    payments.forEach(p => {
      const row = document.createElement('div');
      row.className = 'billing-history-row';

      const date = new Date(p.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });

      const planConfig = Payment.getPlanConfig(p.plan_id);
      const amount = `₹${(p.amount || planConfig.price).toLocaleString('en-IN')}/mo`;

      const isActive = new Date(p.expires_at) > new Date();
      const statusClass = isActive ? 'active' : 'expired';
      const statusText = isActive ? 'Active' : 'Expired';

      row.innerHTML = `
        <div class="billing-history-info">
          <span class="billing-history-plan">${planConfig.name} Plan</span>
          <span class="billing-history-date">${date}</span>
        </div>
        <div class="billing-history-amount">${amount}</div>
        <span class="billing-history-status billing-history-status-${statusClass}">${statusText}</span>
        <span class="billing-history-id" title="${p.razorpay_payment_id || ''}">${p.razorpay_payment_id ? p.razorpay_payment_id.slice(0, 16) + '...' : 'Free plan'}</span>
      `;

      historyEl.appendChild(row);
    });
  } catch (err) {
    console.warn('Could not load payment history:', err);
  }
}

async function startBillingUpgrade(plan) {
  if (!currentUser) return;

  // Check if logged in
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'index.html?login=1';
    return;
  }

  // Ensure Razorpay script is loaded
  await Payment.loadScript();

  const planDetails = {
    basic: { name: 'Basic Plan', price: 24900, description: 'PingClass Basic - Monthly' },
    pro: { name: 'Pro Plan', price: 59900, description: 'PingClass Pro - Monthly' }
  };

  const details = planDetails[plan];
  if (!details) return;

  const options = {
    key: CONFIG.RAZORPAY_KEY_ID,
    amount: details.price,
    currency: 'INR',
    name: 'PingClass',
    description: details.description,
    prefill: {
      name: userProfile?.full_name || currentUser.email,
      email: currentUser.email
    },
    theme: { color: '#0D9488' },
    modal: {
      ondismiss: function() {
        console.log('Payment dismissed');
      }
    },
    handler: async function(response) {
      try {
        await db.from('subscriptions').insert({
          user_id: currentUser.id,
          plan_id: plan,
          razorpay_payment_id: response.razorpay_payment_id,
          amount: details.price / 100,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (e) {
        console.warn('Subscription insert failed (payment still valid):', e);
      }

      currentPlan = plan;
      applyPlanGating();
      populateBillingPage();
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

// Mobile sidebar toggle
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar.contains(e.target) && !toggle.contains(e.target) && !overlay.contains(e.target)) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }
});

// Close sidebar when clicking overlay
document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
});

/* ================================================================
   STAFF PAGE
   ================================================================ */
let allStaff = [];

async function populateStaffPage() {
  const tbody = document.getElementById('staffTableBody');
  const empty = document.getElementById('staffEmpty');
  const tableWrap = document.querySelector('.staff-table-wrap');

  // Fetch users in this institute
  const { data: users, error: usersErr } = await db
    .from('users')
    .select('id, full_name, email, role, created_at')
    .eq('institute_id', currentInstitute.id)
    .neq('role', 'admin');

  // Fetch pending invite tokens
  const { data: tokens, error: tokensErr } = await db
    .from('invite_tokens')
    .select('id, email, role, name, used, expires_at, created_at')
    .eq('institute_id', currentInstitute.id)
    .order('created_at', { ascending: false });

  // Combine into one list
  allStaff = [];

  if (users) {
    users.forEach(u => {
      allStaff.push({
        id: u.id,
        name: u.full_name || u.email?.split('@')[0] || '—',
        email: u.email,
        role: u.role,
        status: 'active',
        joined: u.created_at
      });
    });
  }

  if (tokens) {
    tokens.forEach(t => {
      const now = new Date();
      const expires = new Date(t.expires_at);
      let status = 'invited';
      if (t.used) status = 'active';
      else if (expires < now) status = 'expired';

      allStaff.push({
        id: t.id,
        name: t.name || t.email?.split('@')[0] || '—',
        email: t.email,
        role: t.role,
        status: status,
        joined: t.created_at,
        isInvite: true,
        used: t.used,
        token: t.id
      });
    });
  }

  renderStaffTable(allStaff);
}

function renderStaffTable(staff) {
  const tbody = document.getElementById('staffTableBody');
  const empty = document.getElementById('staffEmpty');
  const table = document.querySelector('.staff-table');

  if (staff.length === 0) {
    table.style.display = 'none';
    empty.classList.add('visible');
    return;
  }

  table.style.display = '';
  empty.classList.remove('visible');

  tbody.innerHTML = staff.map(s => {
    const initials = (s.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const roleClass = s.role === 'teacher' ? 'staff-role-teacher' : 'staff-role-parent';
    const avatarClass = s.role === 'teacher' ? 'staff-avatar-teacher' : 'staff-avatar-parent';
    const roleLabel = s.role.charAt(0).toUpperCase() + s.role.slice(1);
    const statusClass = 'staff-status-' + s.status;
    const statusLabel = s.status.charAt(0).toUpperCase() + s.status.slice(1);
    const dateStr = s.joined ? new Date(s.joined).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    let actionHtml = '';
    if (s.status === 'invited') {
      actionHtml = `<button class="staff-action-btn staff-action-btn-resend" onclick="resendInvite('${s.id}')">Resend</button>`;
    }

    return `<tr>
      <td>
        <div class="staff-name">
          <div class="staff-avatar ${avatarClass}">${initials}</div>
          ${escapeHtml(s.name)}
        </div>
      </td>
      <td><span class="staff-email">${escapeHtml(s.email)}</span></td>
      <td><span class="staff-role ${roleClass}">${roleLabel}</span></td>
      <td><span class="staff-status ${statusClass}"><span class="staff-status-dot"></span>${statusLabel}</span></td>
      <td><span class="staff-date">${dateStr}</span></td>
      <td class="staff-actions">${actionHtml}</td>
    </tr>`;
  }).join('');
}

// Filter tabs
document.querySelectorAll('.staff-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.staff-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    const filtered = filter === 'all' ? allStaff : allStaff.filter(s => s.role === filter);
    renderStaffTable(filtered);
  });
});

// ── Invite Modal ──
const inviteModal = document.getElementById('inviteModal');
const inviteForm = document.getElementById('inviteForm');
const inviteError = document.getElementById('inviteError');
const studentField = document.getElementById('studentField');
const linkModal = document.getElementById('linkModal');
const linkInput = document.getElementById('inviteLinkInput');
const linkCopyBtn = document.getElementById('inviteLinkCopy');

function openInviteModal() {
  inviteModal.classList.add('open');
  inviteForm.reset();
  inviteError.classList.remove('visible');
  studentField.style.display = 'none';
  fluidPause();
}

function closeInviteModal() {
  inviteModal.classList.remove('open');
  fluidResume();
}

function openLinkModal(token) {
  // Build absolute URL that works for both file:// and http://
  let baseUrl = window.location.href;
  // Strip filename (dashboard.html) to get directory path
  baseUrl = baseUrl.replace(/[^/]*$/, '');
  const url = `${baseUrl}accept-invite.html?token=${token}`;
  linkInput.value = url;
  linkCopyBtn.classList.remove('copied');
  linkCopyBtn.textContent = 'Copy';
  linkModal.classList.add('open');
  inviteModal.classList.remove('open');
}

function closeLinkModal() {
  linkModal.classList.remove('open');
  fluidResume();
}

// Show student field when role = parent
document.getElementById('inviteRole').addEventListener('change', async (e) => {
  if (e.target.value === 'parent') {
    studentField.style.display = '';
    await loadStudentsForInvite();
  } else {
    studentField.style.display = 'none';
  }
});

async function loadStudentsForInvite() {
  const sel = document.getElementById('inviteStudent');
  sel.innerHTML = '<option value="">Loading...</option>';

  const { data } = await db
    .from('students')
    .select('id, full_name')
    .eq('institute_id', currentInstitute.id)
    .order('full_name');

  sel.innerHTML = '<option value="">Select student...</option>';
  if (data) {
    data.forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${escapeHtml(s.full_name)}</option>`;
    });
  }
}

// Submit invite
inviteForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('inviteName').value.trim();
  const email = document.getElementById('inviteEmail').value.trim();
  const role = document.getElementById('inviteRole').value;
  const studentId = document.getElementById('inviteStudent').value;

  if (!name || !email || !role) {
    inviteError.textContent = 'Please fill in all fields.';
    inviteError.classList.add('visible');
    return;
  }

  if (role === 'parent' && !studentId) {
    inviteError.textContent = 'Please select a student for this parent.';
    inviteError.classList.add('visible');
    return;
  }

  const submitBtn = document.getElementById('inviteSubmit');
  submitBtn.disabled = true;

  // Check if email already exists as user or pending invite
  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1);

  const { data: existingToken } = await db
    .from('invite_tokens')
    .select('id')
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if ((existingUser && existingUser.length > 0) || (existingToken && existingToken.length > 0)) {
    inviteError.textContent = 'This email is already invited or has an account.';
    inviteError.classList.add('visible');
    submitBtn.disabled = false;
    return;
  }

  // Create invite token (expires in 7 days)
  const token = crypto.randomUUID();
  const { data: inviteData, error: inviteErr } = await db
    .from('invite_tokens')
    .insert({
      email: email,
      role: role,
      name: name,
      institute_id: currentInstitute.id,
      invited_by: currentUser.id,
      student_id: role === 'parent' ? studentId : null,
      token: token,
      used: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('id')
    .single();

  submitBtn.disabled = false;

  if (inviteErr) {
    inviteError.textContent = 'Failed to send invite. Please try again.';
    inviteError.classList.add('visible');
    return;
  }

  // Show invite link
  openLinkModal(inviteData.id);
  populateStaffPage();
});

// Copy invite link
linkCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(linkInput.value).then(() => {
    linkCopyBtn.classList.add('copied');
    linkCopyBtn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Copied!`;
  });
});

// Resend invite (regenerate token)
async function resendInvite(tokenId) {
  const old = allStaff.find(s => s.id === tokenId);
  if (!old) return;

  // Delete old token and create new one
  await db.from('invite_tokens').delete().eq('id', tokenId);

  const newToken = crypto.randomUUID();
  const { data: newData } = await db
    .from('invite_tokens')
    .insert({
      email: old.email,
      role: old.role,
      name: old.name,
      institute_id: currentInstitute.id,
      invited_by: currentUser.id,
      student_id: null,
      token: newToken,
      used: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('id')
    .single();

  if (newData) {
    openLinkModal(newData.id);
    populateStaffPage();
  }
}

// Wire up invite buttons
document.getElementById('staffInviteBtn').addEventListener('click', openInviteModal);
const emptyInviteBtn = document.getElementById('staffInviteBtnEmpty');
if (emptyInviteBtn) emptyInviteBtn.addEventListener('click', openInviteModal);

// Close modals
document.getElementById('inviteModalClose').addEventListener('click', closeInviteModal);
document.getElementById('inviteModalCancel').addEventListener('click', closeInviteModal);
document.getElementById('linkModalClose').addEventListener('click', closeLinkModal);
document.getElementById('linkModalDone').addEventListener('click', closeLinkModal);

// Close modals on overlay click
inviteModal.addEventListener('click', (e) => { if (e.target === inviteModal) closeInviteModal(); });
linkModal.addEventListener('click', (e) => { if (e.target === linkModal) closeLinkModal(); });

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();
