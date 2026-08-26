// PingClass Admin Dashboard JS
// Works alongside shared.js — defines admin-specific page logic

// ── Natural Sort ──

function naturalNameSort(arr) {
  if (!arr) return arr;
  arr.sort((a, b) => {
    const nameA = (a.full_name || a.name || '').toLowerCase();
    const nameB = (b.full_name || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
  return arr;
}

// ── Skeleton Loading System ──

const _skeletonTemplates = {
  dashboard: () => `
    <div class="skeleton-stats-grid">
      ${Array(4).fill('').map(() => `
        <div class="skeleton-stat">
          <div class="skeleton skeleton-icon"></div>
          <div class="skeleton skeleton-label"></div>
          <div class="skeleton skeleton-value"></div>
        </div>`).join('')}
    </div>`,

  students: () => `
    <div class="skeleton-table-rows">
      ${Array(6).fill('').map((_, i) => `
        <div class="skeleton-table-row" style="animation-delay:${i * 0.05}s">
          <span class="skeleton"></span><span class="skeleton"></span>
          <span class="skeleton"></span><span class="skeleton"></span>
          <span class="skeleton"></span><span class="skeleton"></span>
        </div>`).join('')}
    </div>`,

  batches: () => `
    <div class="skeleton-cards-grid">
      ${Array(4).fill('').map((_, i) => `
        <div class="skeleton-card" style="animation-delay:${i * 0.06}s">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-subtitle"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>`).join('')}
    </div>`,

  fees: () => `
    <div style="display:flex;gap:16px;margin-bottom:24px">
      <div class="skeleton" style="width:140px;height:36px;border-radius:10px"></div>
      <div class="skeleton" style="width:140px;height:36px;border-radius:10px"></div>
    </div>
    <div class="skeleton-cards-grid">
      ${Array(3).fill('').map((_, i) => `
        <div class="skeleton-card" style="animation-delay:${i * 0.06}s">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>`).join('')}
    </div>`,

  attendance: () => `
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="skeleton" style="width:120px;height:36px;border-radius:10px"></div>
      <div class="skeleton" style="width:120px;height:36px;border-radius:10px"></div>
      <div class="skeleton" style="width:120px;height:36px;border-radius:10px"></div>
    </div>
    <div class="skeleton-cards-grid">
      ${Array(3).fill('').map((_, i) => `
        <div class="skeleton-card" style="animation-delay:${i * 0.06}s">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>`).join('')}
    </div>`,

  announcements: () => `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${Array(3).fill('').map((_, i) => `
        <div class="skeleton-announcement" style="animation-delay:${i * 0.06}s">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-body"></div>
          <div class="skeleton skeleton-body-sm"></div>
          <div class="skeleton skeleton-meta"></div>
        </div>`).join('')}
    </div>`,

  staff: () => `
    <div class="skeleton-table-rows">
      ${Array(4).fill('').map((_, i) => `
        <div class="skeleton-table-row" style="animation-delay:${i * 0.05}s;grid-template-columns:2fr 1.5fr 0.8fr 0.8fr 1fr 0.6fr">
          <span class="skeleton"></span><span class="skeleton"></span>
          <span class="skeleton"></span><span class="skeleton"></span>
          <span class="skeleton"></span><span class="skeleton"></span>
        </div>`).join('')}
    </div>`,

  parents: () => `
    <div class="skeleton-table-rows">
      ${Array(4).fill('').map((_, i) => `
        <div class="skeleton-table-row" style="animation-delay:${i * 0.05}s;grid-template-columns:2fr 1.5fr 1.2fr 0.8fr 1fr 0.6fr">
          <span class="skeleton"></span><span class="skeleton"></span>
          <span class="skeleton"></span><span class="skeleton"></span>
          <span class="skeleton"></span><span class="skeleton"></span>
        </div>`).join('')}
    </div>`,

  billing: () => `
    <div class="skeleton" style="width:100%;height:80px;border-radius:14px;margin-bottom:24px"></div>
    <div class="skeleton-usage" style="margin-bottom:32px">
      ${Array(3).fill('').map(() => `
        <div class="skeleton-usage-item">
          <div class="skeleton skeleton-label"></div>
          <div class="skeleton skeleton-bar"></div>
          <div class="skeleton skeleton-value"></div>
        </div>`).join('')}
    </div>
    <div class="skeleton-cards-grid" style="grid-template-columns:repeat(3,1fr)">
      ${Array(3).fill('').map((_, i) => `
        <div class="skeleton-billing-plan" style="animation-delay:${i * 0.06}s">
          <div class="skeleton skeleton-tag"></div>
          <div class="skeleton skeleton-price"></div>
          <div class="skeleton skeleton-feature"></div>
          <div class="skeleton skeleton-feature" style="width:60%"></div>
          <div class="skeleton skeleton-feature" style="width:70%"></div>
        </div>`).join('')}
    </div>`
};

function showSkeletons(pageName) {
  const page = document.getElementById('page-' + pageName);
  if (!page) return;
  const template = _skeletonTemplates[pageName];
  if (!template) return;

  let container = page.querySelector('.skeleton-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'skeleton-container';
    const contentWrap = page.querySelector('.page-table-wrap, .batches-grid, .announcements-list, .staff-table-wrap, .billing-usage, .fees-summary, .attendance-stats-row');
    if (contentWrap) {
      contentWrap.parentNode.insertBefore(container, contentWrap);
    } else {
      page.appendChild(container);
    }
  }
  container.innerHTML = template();
  container.classList.add('active');

  // Hide real content
  page.querySelectorAll('.page-table-wrap, .batches-grid, .announcements-list, .staff-table-wrap, .billing-usage, .fees-summary, .attendance-stats-row, .billing-current, .billing-plans, .billing-history, .billing-section-title, .stats-grid, .welcome, .page-empty').forEach(el => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.15s';
  });
}

function hideSkeletons(pageName) {
  const page = document.getElementById('page-' + pageName);
  if (!page) return;
  const container = page.querySelector('.skeleton-container');
  if (container) container.classList.remove('active');

  page.querySelectorAll('.page-table-wrap, .batches-grid, .announcements-list, .staff-table-wrap, .billing-usage, .fees-summary, .attendance-stats-row, .billing-current, .billing-plans, .billing-history, .billing-section-title, .stats-grid, .welcome, .page-empty').forEach(el => {
    el.style.opacity = '';
    el.style.transition = '';
  });
}

// ── Lazy Load Cache ──

const pageDataCache = {};

function invalidatePageCache(pageName) {
  delete pageDataCache[pageName];
}

// ── Overview Stats ──

async function loadStats() {
  clearSectionFallback('page-dashboard');

  // Demo mode: populate from demoData + mock analytics
  if (isDemoMode) {
    const skel = document.getElementById('dashboardSkeleton');
    const welcome = document.getElementById('dashboardWelcome');
    const stats = document.getElementById('dashboardStats');
    if (skel) skel.style.display = 'none';
    if (welcome) welcome.style.display = '';
    if (stats) stats.style.display = '';
    animateStatValue('totalStudents', demoData.stats.students || 0);
    animateStatValue('totalBatches', demoData.stats.batches || 0);
    animateStatValue('totalTeachers', demoData.stats.teachers || 0);
    renderFeeStats({
      duesThisMonth: demoData.stats.pending || 0,
      collectedThisMonth: demoData.stats.collected || 0,
      duesToday: demoData.stats.duesToday || 0
    });
    updateDashboardTrends({ students: 6, batches: 2, teachers: 1 });
    touchDashboardUpdated();
    scheduleDashboardAnalytics();
    return;
  }

  if (!userProfile?.institute_id) return;

  // Use cache if available
  if (pageDataCache['dashboard']) {
    const c = pageDataCache['dashboard'];
    animateStatValue('totalStudents', c.students || 0);
    animateStatValue('totalBatches', c.batches || 0);
    animateStatValue('totalTeachers', c.teachers || 0);
    renderFeeStats({
      duesThisMonth: c.duesThisMonth || 0,
      collectedThisMonth: c.collectedThisMonth || 0,
      duesToday: c.duesToday || 0
    });
    const skel = document.getElementById('dashboardSkeleton');
    const welcome = document.getElementById('dashboardWelcome');
    const stats = document.getElementById('dashboardStats');
    if (skel) skel.style.display = 'none';
    if (welcome) welcome.style.display = '';
    if (stats) stats.style.display = '';
    scheduleDashboardAnalytics();
    return;
  }

  const skel = document.getElementById('dashboardSkeleton');
  const welcome = document.getElementById('dashboardWelcome');
  const stats = document.getElementById('dashboardStats');
  if (skel) skel.style.display = '';
  if (welcome) welcome.style.display = 'none';
  if (stats) stats.style.display = 'none';

  const instituteId = userProfile.institute_id;

  const studentsRes = await safeQuery(() =>
    db.from('students').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).is('deleted_at', null)
  );
  if (!studentsRes.ok) {
    if (skel) skel.style.display = 'none';
    showSectionFallback('page-dashboard', studentsRes.error, { retry: () => loadStats(), retryLabel: 'Reload dashboard' });
    return;
  }
  const students = studentsRes.count || 0;

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).is('deleted_at', null)
  );
  const batches = batchesRes.ok ? (batchesRes.count || 0) : 0;

  const teachersRes = await safeQuery(() =>
    db.from('users').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).eq('role', 'teacher')
  );
  const teachers = teachersRes.ok ? (teachersRes.count || 0) : 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const studentsMonthRes = await safeQuery(() =>
    db.from('students').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).is('deleted_at', null).gte('created_at', monthStart.toISOString())
  );
  const studentsThisMonth = studentsMonthRes.ok ? (studentsMonthRes.count || 0) : 0;

  const batchesMonthRes = await safeQuery(() =>
    db.from('batches').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).is('deleted_at', null).gte('created_at', monthStart.toISOString())
  );
  const batchesThisMonth = batchesMonthRes.ok ? (batchesMonthRes.count || 0) : 0;

  const teachersMonthRes = await safeQuery(() =>
    db.from('users').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).eq('role', 'teacher').gte('created_at', monthStart.toISOString())
  );
  const teachersThisMonth = teachersMonthRes.ok ? (teachersMonthRes.count || 0) : 0;

  const studentRowsRes = await safeQuery(() =>
    db.from('students').select('id').eq('institute_id', instituteId).is('deleted_at', null)
  );
  const studentIds = (studentRowsRes.ok ? studentRowsRes.data : []).map(s => s.id);

  let pending = [];
  if (studentIds.length > 0) {
    const pendingRes = await safeQuery(() =>
      db.from('payments').select('amount, due_date').eq('status', 'pending').in('student_id', studentIds)
    );
    pending = pendingRes.ok ? pendingRes.data : [];
  }

  let collected = [];
  if (studentIds.length > 0) {
    const collectedRes = await safeQuery(() =>
      db.from('payments').select('amount, paid_at').eq('status', 'paid').in('student_id', studentIds)
    );
    collected = collectedRes.ok ? collectedRes.data : [];
  }

  let overdue = [];
  if (studentIds.length > 0) {
    const overdueRes = await safeQuery(() =>
      db.from('payments').select('amount, due_date').eq('status', 'overdue').in('student_id', studentIds)
    );
    overdue = overdueRes.ok ? overdueRes.data : [];
  }

  const pendingTotal = pending?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const collectedTotal = collected?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const overdueTotal = overdue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  // Fee overview: dues due this month, collected this month, dues due today.
  const now = new Date();
  const todayKey = toDateKey(now);
  const monthStartKey = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const nextMonthKey = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const unpaid = [...pending, ...overdue];
  const duesThisMonth = unpaid
    .filter(p => p.due_date && p.due_date.slice(0, 10) >= monthStartKey && p.due_date.slice(0, 10) < nextMonthKey)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const collectedThisMonth = (collected || [])
    .filter(p => p.paid_at && p.paid_at.slice(0, 10) >= monthStartKey && p.paid_at.slice(0, 10) < nextMonthKey)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const duesToday = unpaid
    .filter(p => p.due_date && p.due_date.slice(0, 10) === todayKey)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  animateStatValue('totalStudents', students || 0);
  animateStatValue('totalBatches', batches || 0);
  animateStatValue('totalTeachers', teachers || 0);
  renderFeeStats({ duesThisMonth, collectedThisMonth, duesToday });

  pageDataCache['dashboard'] = { students: students || 0, batches: batches || 0, teachers: teachers || 0, pendingTotal, collectedTotal, overdueTotal, duesThisMonth, collectedThisMonth, duesToday };

  updateDashboardTrends(
    { students: studentsThisMonth || 0, batches: batchesThisMonth || 0, teachers: teachersThisMonth || 0 }
  );

  if (skel) skel.style.display = 'none';
  if (welcome) welcome.style.display = '';
  if (stats) stats.style.display = '';
  touchDashboardUpdated();

  scheduleDashboardAnalytics();
}

let _dashboardAnalyticsScheduled = false;

function scheduleDashboardAnalytics() {
  const wrap = document.getElementById('dashboardAnalytics');
  if (!wrap) return;
  // Reveal the analytics section so it occupies layout space, but keep chart canvases empty.
  wrap.style.display = '';
  if (_dashboardAnalyticsScheduled) return;
  _dashboardAnalyticsScheduled = true;

  const run = () => {
    _dashboardAnalyticsScheduled = false;
    loadDashboardAnalytics();
  };

  // Start the charts as soon as the page is shown (right after the screen loader
  // fades out), so their animation plays as the dashboard loads — not on scroll.
  const loader = document.getElementById('screenLoader');
  const alreadyHidden = !loader || loader.classList.contains('screen-loader-hidden');
  if (alreadyHidden) {
    requestAnimationFrame(run);
    return;
  }
  window.addEventListener('screen-loader-hidden', run, { once: true });
}

function updateDashboardTrends({ students, batches, teachers }) {
  const setTrend = (id, count) => {
    const el = document.getElementById(id);
    if (!el) return;
    const textEl = el.querySelector('.stat-trend-text');
    const value = count || 0;
    const isUp = value > 0;
    const isNeutral = value === 0;
    el.classList.toggle('stat-trend--down', !isUp && !isNeutral);
    el.querySelector('svg').innerHTML = isUp || isNeutral
      ? '<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>'
      : '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>';
    if (textEl) {
      textEl.textContent = isNeutral
        ? 'No change this month'
        : (isUp ? '+' : '') + value + (isUp ? ' this month' : ' this month');
    }
  };
  setTrend('studentsTrend', students);
  setTrend('batchesTrend', batches);
  setTrend('teachersTrend', teachers);
}

let _dashboardUpdatedAt = null;
let _dashboardUpdatedTimer = null;

function touchDashboardUpdated() {
  const textEl = document.getElementById('dashboardUpdatedText');
  const wrap = document.getElementById('dashboardUpdated');
  if (!textEl || !wrap) return;
  _dashboardUpdatedAt = Date.now();
  wrap.style.display = 'inline-flex';
  const render = () => {
    if (!_dashboardUpdatedAt) return;
    const mins = Math.max(0, Math.floor((Date.now() - _dashboardUpdatedAt) / 60000));
    textEl.textContent = mins < 1 ? 'Updated just now' : `Updated ${mins} min ago`;
  };
  render();
  if (_dashboardUpdatedTimer) clearInterval(_dashboardUpdatedTimer);
  _dashboardUpdatedTimer = setInterval(render, 60000);
}

const _statAnimators = {};

function animateStatValue(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const duration = 800;
  if (_statAnimators[id]) cancelAnimationFrame(_statAnimators[id]);
  const t0 = performance.now();
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const frame = now => {
    const p = Math.min(1, (now - t0) / duration);
    const val = Math.round(start + (target - start) * ease(p));
    el.textContent = val;
    if (p < 1) _statAnimators[id] = requestAnimationFrame(frame);
    else delete _statAnimators[id];
  };
  _statAnimators[id] = requestAnimationFrame(frame);
}

/* ── Dashboard Analytics (charts, announcements, top students) ── */

const MONTH_LABELS = (() => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return d.toLocaleString('en-US', { month: 'short' });
  });
})();

async function buildMonthlyTrend(instituteId) {
  const months = MONTH_LABELS;
  const attendancePct = new Array(6).fill(0);
  const feesPct = new Array(6).fill(0);

  // Timezone-safe month key from a local Date (avoids toISOString UTC shift)
  const localMonthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Last 6 month boundaries
  const now = new Date();
  const monthStarts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthStarts.push(d);
  }
  const windowStart = localMonthKey(monthStarts[0]) + '-01';

  // Batch IDs for this institute
  const batchRes = await safeQuery(() =>
    db.from('batches').select('id').eq('institute_id', instituteId).is('deleted_at', null)
  );
  const batchIds = (batchRes.ok ? batchRes.data : []).map(b => b.id);
  if (batchIds.length === 0) return { months, attendancePct, feesPct };

  // Attendance — one query for the whole 6-month window
  const attRes = await safeQuery(() =>
    db.from('attendance').select('date, status').in('batch_id', batchIds).gte('date', windowStart)
  );
  const attRows = attRes.ok ? attRes.data : [];
  const attByMonth = {};  // { 'YYYY-MM': { total, present } }
  attRows.forEach(r => {
    const key = (r.date || '').slice(0, 7);
    if (!attByMonth[key]) attByMonth[key] = { total: 0, present: 0 };
    attByMonth[key].total++;
    if (r.status === 'present' || r.status === 'late') attByMonth[key].present++;
  });
  monthStarts.forEach((d, i) => {
    const key = localMonthKey(d);
    const m = attByMonth[key];
    if (m && m.total > 0) attendancePct[i] = Math.round(m.present / m.total * 100);
  });

  // Fees — pending by due_date, paid by paid_at (deduplicated)
  // Upper bound: last day of the final month in the window
  const lastWindowMonth = monthStarts[5];
  const sixMonthsEnd = `${lastWindowMonth.getFullYear()}-${String(lastWindowMonth.getMonth() + 1).padStart(2, '0')}-31`;
  const [pendingRes, paidRes] = await Promise.all([
    safeQuery(() =>
      db.from('payments').select('id, amount, status, due_date, paid_at').eq('institute_id', instituteId).in('status', ['pending', 'overdue']).gte('due_date', windowStart).lte('due_date', sixMonthsEnd)
    ),
    safeQuery(() =>
      db.from('payments').select('id, amount, status, due_date, paid_at').eq('institute_id', instituteId).eq('status', 'paid').gte('paid_at', windowStart)
    )
  ]);
  const payMap = new Map();
  (pendingRes.ok ? pendingRes.data : []).forEach(r => payMap.set(r.id, r));
  (paidRes.ok ? paidRes.data : []).forEach(r => payMap.set(r.id, r));
  const payRows = [...payMap.values()];
  const feeByMonth = {};  // { 'YYYY-MM': { due, collected } }
  payRows.forEach(r => {
    // Paid payments: use paid_at (when collection happened)
    // Pending/overdue: use due_date (when it's expected)
    const dateStr = (r.status === 'paid' && r.paid_at) ? r.paid_at : r.due_date;
    const key = (dateStr || '').slice(0, 7);
    if (!key) return;
    if (!feeByMonth[key]) feeByMonth[key] = { due: 0, collected: 0 };
    feeByMonth[key].due += r.amount || 0;
    if (r.status === 'paid') feeByMonth[key].collected += r.amount || 0;
  });
  monthStarts.forEach((d, i) => {
    const key = localMonthKey(d);
    const m = feeByMonth[key];
    if (m && m.due > 0) feesPct[i] = Math.round(m.collected / m.due * 100);
  });

  return { months, attendancePct, feesPct };
}

const DASHBOARD_BATCH_NAMES = ['Math', 'Science', 'English', 'Physics', 'Weekend'];
const DASHBOARD_BATCH_STUDENTS = [18, 22, 15, 20, 12];
const DASHBOARD_BATCH_ATTENDANCE = [87, 92, 78, 85, 90];

const DASHBOARD_TREND_MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const DASHBOARD_TREND_ATTENDANCE = [82, 85, 79, 88, 91, 87];
const DASHBOARD_TREND_FEES = [74, 78, 81, 77, 85, 83];

const DASHBOARD_TOP_STUDENTS = [
  { name: 'Aarav Mehta', batch: 'Math', attendance: 96, feeStatus: 'paid' },
  { name: 'Priya Sharma', batch: 'Science', attendance: 93, feeStatus: 'paid' },
  { name: 'Rohan Gupta', batch: 'English', attendance: 91, feeStatus: 'due' },
  { name: 'Sneha Iyer', batch: 'Physics', attendance: 88, feeStatus: 'paid' },
  { name: 'Kabir Khan', batch: 'Weekend', attendance: 84, feeStatus: 'overdue' }
];

const DASHBOARD_FEE_LABEL = {
  paid: 'Paid',
  due: 'Due soon',
  overdue: 'Overdue'
};

const DASHBOARD_AT_RISK_STUDENTS = [
  { name: 'Vikram Rao', batch: 'Science', attendance: 41, feeStatus: 'overdue' },
  { name: 'Ananya Verma', batch: 'Math', attendance: 48, feeStatus: 'due' },
  { name: 'Ishan Pillai', batch: 'English', attendance: 55, feeStatus: 'overdue' },
  { name: 'Meera Nair', batch: 'Physics', attendance: 62, feeStatus: 'due' },
  { name: 'Dev Patel', batch: 'Weekend', attendance: 45, feeStatus: 'paid' }
];

// Lazy-load Chart.js on first chart render so the ~205 KB library doesn't
// block the dashboard's startup scripts (supabase, shared, page logic).
let _chartJsPromise = null;
function loadChartJS() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (!_chartJsPromise) {
    _chartJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'chart.umd.min.js';
      s.onload = () => resolve();
      s.onerror = () => { _chartJsPromise = null; reject(new Error('Failed to load chart.umd.min.js')); };
      document.head.appendChild(s);
    });
  }
  return _chartJsPromise;
}

const dashboardCharts = {};

function destroyDashboardCharts() {
  Object.values(dashboardCharts).forEach(chart => {
    if (chart && typeof chart.destroy === 'function') chart.destroy();
  });
  dashboardCharts.trend = null;
  dashboardCharts.batch = null;
  dashboardCharts.fee = null;
}

function dashboardAnnExcerpt(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? clean.slice(0, 90) + '\u2026' : clean;
}

function renderDashboardAnnouncements(anns) {
  const list = document.getElementById('analyticsAnnouncements');
  if (!list) return;
  list.innerHTML = '';
  if (!anns || anns.length === 0) {
    const li = document.createElement('li');
    li.className = 'analytics-ann-item';
    li.innerHTML = '<p class="analytics-ann-excerpt" style="color:var(--text-muted)">No announcements yet.</p>';
    list.appendChild(li);
    return;
  }
  anns.slice(0, 3).forEach(ann => {
    const li = document.createElement('li');
    li.className = 'analytics-ann-item';
    const date = ann.created_at ? new Date(ann.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const audience = ann.target === 'all' ? 'Everyone' : ann.target === 'teachers' ? 'Teachers' : 'Parents';
    li.innerHTML = `
      <div class="analytics-ann-head">
        <p class="analytics-ann-title">${escapeHtml(ann.title || 'Untitled')}</p>
        <div class="analytics-ann-head-meta">
          <span class="analytics-ann-date">${date}</span>
          <span class="analytics-ann-cat">${audience}</span>
        </div>
      </div>
      <p class="analytics-ann-excerpt">${escapeHtml(dashboardAnnExcerpt(ann.message || ann.body || ann.content || ''))}</p>
    `;
    list.appendChild(li);
  });
}

function renderDashboardTopStudents(students) {
  const tbody = document.getElementById('analyticsStudentsBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = (students || []).slice(0, 5);
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px 10px">No student data yet.</td></tr>';
    return;
  }
  rows.forEach((s, i) => {
    const initials = escapeHtml((s.name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?');
    const pct = Math.min(100, Math.max(0, Math.round(s.attendance || 0)));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="analytics-rank">${i + 1}</span></td>
      <td><div class="analytics-student-cell"><span class="analytics-student-avatar">${initials}</span><span>${escapeHtml(s.name)}</span></div></td>
      <td><span class="analytics-batch-cell">${escapeHtml(s.batch || '\u2014')}</span></td>
      <td><div class="analytics-att-cell"><span class="analytics-att-bar"><span style="width:${pct}%;background:var(--secondary)"></span></span><span class="analytics-att-text">${pct}%</span></div></td>
      <td><span class="analytics-badge analytics-badge--${s.feeStatus === 'paid' ? 'paid' : s.feeStatus === 'due' ? 'due' : 'overdue'}">${escapeHtml(DASHBOARD_FEE_LABEL[s.feeStatus] || s.feeStatus || '\u2014')}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function riskLevelFor(student) {
  const att = student.attendance || 0;
  if (att < 50 || student.feeStatus === 'overdue') return { key: 'high-risk', label: 'High' };
  if (att < 70 || student.feeStatus === 'due') return { key: 'mid', label: 'Medium' };
  return { key: 'low', label: 'Low' };
}

function renderDashboardAtRiskStudents(students) {
  const tbody = document.getElementById('analyticsAtRiskBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = (students || []).slice(0, 6);
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px 10px">No at-risk students right now.</td></tr>';
    return;
  }
  rows.forEach(s => {
    const initials = escapeHtml((s.name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?');
    const pct = Math.min(100, Math.max(0, Math.round(s.attendance || 0)));
    const risk = riskLevelFor(s);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="analytics-student-cell"><span class="analytics-student-avatar">${initials}</span><span>${escapeHtml(s.name)}</span></div></td>
      <td><span class="analytics-batch-cell">${escapeHtml(s.batch || '\u2014')}</span></td>
      <td><div class="analytics-att-cell"><span class="analytics-att-bar"><span style="width:${pct}%;background:${pct <= 50 ? '#DC2626' : pct < 70 ? '#F59E0B' : '#2DD4BF'}"></span></span><span class="analytics-att-text">${pct}%</span></div></td>
      <td><span class="analytics-badge analytics-badge--${s.feeStatus === 'paid' ? 'paid' : s.feeStatus === 'due' ? 'due' : 'overdue'}">${escapeHtml(DASHBOARD_FEE_LABEL[s.feeStatus] || s.feeStatus || '\u2014')}</span></td>
      <td><span class="analytics-badge analytics-badge--risk-${risk.key}">${risk.label}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function analyticsLegendLabels(chart) {
  return chart.data.datasets.map((dataset, i) => {
    const isLine = dataset.type === 'line';
    return {
      text: dataset.label,
      fontColor: 'rgba(255,255,255,0.7)',
      fillStyle: isLine ? 'rgba(255,255,255,0)' : dataset.backgroundColor,
      strokeStyle: dataset.borderColor || dataset.borderColor,
      lineWidth: isLine ? 2 : 0,
      pointStyle: isLine ? 'line' : 'rectRounded',
      hidden: !chart.isDatasetVisible(i),
      boxWidth: isLine ? 20 : 10,
      boxHeight: 10
    };
  });
}

/* Shared tooltip config for the dashboard analytics charts. On small screens the
   canvas-drawn tooltip is clamped to the chart area, so it gets compact sizing
   (smaller fonts/padding/max-width) instead of covering the whole graph. */
function analyticsTooltipOptions(callbacks) {
  const mobile = window.matchMedia('(max-width: 768px)').matches;
  return {
    backgroundColor: 'rgba(4,26,23,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    titleColor: 'rgba(255,255,255,0.95)',
    bodyColor: 'rgba(255,255,255,0.85)',
    titleFont: { size: mobile ? 11 : 12 },
    bodyFont: { size: mobile ? 11 : 12 },
    titleSpacing: 2,
    titleMarginBottom: mobile ? 4 : 6,
    bodySpacing: mobile ? 2 : 4,
    footerMarginTop: mobile ? 4 : 6,
    padding: mobile ? 8 : 12,
    cornerRadius: mobile ? 8 : 10,
    displayColors: true,
    boxWidth: mobile ? 7 : 9,
    boxHeight: mobile ? 7 : 9,
    callbacks: callbacks
  };
}

async function renderDashboardTrendChart(months, attendance, fees) {
  try { await loadChartJS(); } catch (err) { return; }
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (dashboardCharts.trend) {
    dashboardCharts.trend.destroy();
    dashboardCharts.trend = null;
  }

  // Dashed "100% of target" reference line
  const trendTargetLine = {
    id: 'trendTargetLine',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const yScale = chart.scales.y;
      if (!yScale || !chartArea) return;
      const yPix = yScale.getPixelForValue(100);
      if (yPix === null || yPix === undefined) return;
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yPix);
      ctx.lineTo(chartArea.right, yPix);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Target: 100%', chartArea.right, yPix - 4);
      ctx.restore();
    }
  };

  dashboardCharts.trend = new Chart(ctx, {
    type: 'bar',
    plugins: [trendTargetLine],
    animation: {
      duration: 550,
      easing: 'easeOutQuart'
    },
    data: {
      labels: months,
      datasets: [
        {
          type: 'line',
          label: 'Attendance %',
          data: attendance,
          borderColor: '#2DD4BF',
          backgroundColor: 'rgba(45, 212, 191, 0.12)',
          fill: true,
          borderWidth: 2.5,
          pointRadius: 3.5,
          pointHoverRadius: 5.5,
          pointHitRadius: 12,
          pointBackgroundColor: '#2DD4BF',
          pointBorderWidth: 0,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Fees collected %',
          data: fees,
          backgroundColor: 'rgba(245, 158, 11, 0.5)',
          borderColor: 'rgba(245, 158, 11, 0.85)',
          borderWidth: 1.5,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          maxBarThickness: 22,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            generateLabels: analyticsLegendLabels,
            usePointStyle: true,
            color: 'rgba(255,255,255,0.7)',
            font: { size: 11, weight: '500' },
            padding: 16
          }
        },
        tooltip: analyticsTooltipOptions({
          label: ctx => {
            const pct = Math.round(ctx.parsed.y) + '%';
            const compact = window.innerWidth <= 768;
            return compact
              ? ' ' + (ctx.dataset.label === 'Attendance %' ? 'Attendance: ' : 'Fees: ') + pct
              : ' ' + ctx.dataset.label + ': ' + pct;
          },
          footer: items => {
            if (!items.length) return '';
            const i = items[0].dataIndex;
            const a = attendance[i];
            const f = fees[i];
            if (a == null || f == null) return '';
            const diff = Math.round(a - f);
            const compact = window.innerWidth <= 768;
            if (diff > 0) return compact ? 'Fees ' + diff + '% behind' : 'Fees are ' + diff + '% behind attendance';
            if (diff < 0) return compact ? 'Fees ' + (-diff) + '% ahead' : 'Fees are ' + (-diff) + '% ahead of attendance';
            return compact ? 'Aligned' : 'Attendance and fee collection are aligned';
          }
        })
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 110,
          grid: { color: 'rgba(255,255,255,0.06)' },
          border: { display: false },
          ticks: {
            color: 'rgba(255,255,255,0.45)',
            callback: value => value + '%',
            font: { size: 11 },
            stepSize: 20,
            maxTicksLimit: 7
          }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 11 } }
        }
      }
    }
  });
}

function showBatchChartEmpty(show) {
  const canvas = document.getElementById('batchChart');
  const empty = document.getElementById('batchChartEmpty');
  if (canvas) canvas.style.display = show ? 'none' : '';
  if (empty) empty.style.display = show ? '' : 'none';
}

function showTrendChartEmpty(show) {
  const canvas = document.getElementById('trendChart');
  const empty = document.getElementById('trendChartEmpty');
  if (canvas) canvas.style.display = show ? 'none' : '';
  if (empty) empty.style.display = show ? '' : 'none';
}

function showFeeChartEmpty(show) {
  const canvas = document.getElementById('feeChart');
  const empty = document.getElementById('feeChartEmpty');
  if (canvas) canvas.style.display = show ? 'none' : '';
  if (empty) empty.style.display = show ? '' : 'none';
}

async function renderDashboardBatchChart(batches) {
  try { await loadChartJS(); } catch (err) { return; }
  const canvas = document.getElementById('batchChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = batches.map(b => b.name);
  const students = batches.map(b => b.students);
  const attendance = batches.map(b => b.attendance);

  // Horizontal layout needs more height as batches grow; keep rows readable.
  const chartHeight = Math.max(280, Math.min(batches.length * 54 + 90, 560));
  canvas.parentElement.style.height = chartHeight + 'px';

  if (dashboardCharts.batch) {
    dashboardCharts.batch.destroy();
    dashboardCharts.batch = null;
  }
  const batchValueLabels = {
    id: 'batchValueLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      chart.data.datasets.forEach((dataset, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        const isAttendance = di === 1;
        const scale = chart.scales[isAttendance ? 'x1' : 'x'];
        if (!scale) return;
        const axisSpan = Math.max(scale.right - scale.left, 1);
        meta.data.forEach((el, i) => {
          const value = dataset.data[i];
          if (value === null || value === undefined || value <= 0) return;
          const barLen = Math.abs(el.x - el.base);
          const inside = barLen / axisSpan > 0.55;
          const text = isAttendance ? value + '%' : String(value);
          ctx.save();
          ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = inside
            ? 'rgba(255,255,255,0.92)'
            : (isAttendance ? 'rgba(45,212,191,0.95)' : 'rgba(255,255,255,0.78)');
          ctx.textAlign = inside ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, inside ? el.x - 6 : el.x + 6, el.y);
          ctx.restore();
        });
      });
    }
  };
  dashboardCharts.batch = new Chart(ctx, {
    plugins: [batchValueLabels],
    animation: {
      duration: 550,
      easing: 'easeOutQuart'
    },
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Students',
          data: students,
          backgroundColor: 'rgba(255, 255, 255, 0.16)',
          borderColor: 'rgba(255, 255, 255, 0.28)',
          borderWidth: 1,
          borderRadius: { topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0 },
          borderSkipped: false,
          maxBarThickness: 16,
          xAxisID: 'x'
        },
        {
          type: 'bar',
          label: 'Attendance %',
          data: attendance,
          backgroundColor: 'rgba(45, 212, 191, 0.85)',
          borderColor: '#2DD4BF',
          borderWidth: 0,
          borderRadius: { topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0 },
          borderSkipped: false,
          maxBarThickness: 16,
          xAxisID: 'x1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      interaction: { mode: 'index', axis: 'y', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            generateLabels: analyticsLegendLabels,
            usePointStyle: true,
            color: 'rgba(255,255,255,0.7)',
            font: { size: 11, weight: '500' },
            padding: 16
          }
        },
        tooltip: analyticsTooltipOptions({
          label: ctx => {
            const compact = window.innerWidth <= 768;
            const shortLabel = ctx.dataset.label === 'Students' ? 'Students' : 'Attendance';
            return compact
              ? ' ' + shortLabel + ': ' + ctx.parsed.x + (ctx.dataset.label === 'Students' ? '' : '%')
              : ' ' + ctx.dataset.label + ': ' + ctx.parsed.x + (ctx.dataset.label === 'Students' ? '' : '%');
          }
        })
      },
      scales: {
        x: {
          beginAtZero: true,
          position: 'bottom',
          grid: { color: 'rgba(255,255,255,0.06)' },
          border: { display: false },
          ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 11 } },
          title: { display: true, text: 'Students', color: 'rgba(255,255,255,0.4)', font: { size: 10, weight: '600' } }
        },
        x1: {
          beginAtZero: true,
          max: 100,
          position: 'top',
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: {
            color: 'rgba(45,212,191,0.75)',
            callback: value => value + '%',
            font: { size: 11 }
          },
          title: { display: true, text: 'Attendance %', color: 'rgba(45,212,191,0.7)', font: { size: 10, weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { display: false },
          ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 11 }, autoSkip: false }
        }
      }
    }
  });
}

function formatCurrencyINR(value) {
  return '\u20B9' + (value || 0).toLocaleString('en-IN');
}

function toDateKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

/* Render the fee overview stat row (dues this month, collected this month,
   dues today). Values are rupee amounts; the pill shows the current month /
   today's date so the numbers always have context. */
function renderFeeStats({ duesThisMonth = 0, collectedThisMonth = 0, duesToday = 0 } = {}) {
  const wrap = document.getElementById('dashboardFeeStats');
  if (wrap) wrap.style.display = '';
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const todayLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  setStatValue('duesThisMonth', formatCurrencyINR(duesThisMonth));
  setStatValue('collectedThisMonth', formatCurrencyINR(collectedThisMonth));
  setStatValue('duesToday', formatCurrencyINR(duesToday));
  const monthText = document.getElementById('duesThisMonthTrendText');
  if (monthText) monthText.textContent = monthName;
  const collectedText = document.getElementById('collectedThisMonthTrendText');
  if (collectedText) collectedText.textContent = monthName;
  const todayText = document.getElementById('duesTodayTrendText');
  if (todayText) todayText.textContent = todayLabel;
}

function setStatValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function renderDashboardFeeChart(paidTotal, pendingTotal, overdueTotal) {
  try { await loadChartJS(); } catch (err) { return; }
  const canvas = document.getElementById('feeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const values = [paidTotal || 0, pendingTotal || 0, overdueTotal || 0];
  const allZero = values.every(v => v <= 0);
  if (allZero) {
    if (dashboardCharts.fee) {
      dashboardCharts.fee.destroy();
      dashboardCharts.fee = null;
    }
    showFeeChartEmpty(true);
    return;
  }
  showFeeChartEmpty(false);

  if (dashboardCharts.fee) {
    dashboardCharts.fee.destroy();
    dashboardCharts.fee = null;
  }
  const feeDoughnutLabels = {
    id: 'feeDoughnutLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      const total = chart.data.datasets[0].data.reduce((s, v) => s + v, 0) || 1;
      if (!meta.hidden && meta.data.length) {
        meta.data.forEach((arc, i) => {
          const value = chart.data.datasets[0].data[i];
          const pct = Math.round(value / total * 100);
          if (pct <= 0) return;
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const radius = (arc.innerRadius + arc.outerRadius) / 2;
          const x = arc.x + Math.cos(angle) * radius;
          const y = arc.y + Math.sin(angle) * radius;
          ctx.save();
          ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#0A2E2A';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pct + '%', x, y);
          ctx.restore();
        });
      }
      const label = total.toLocaleString('en-IN');
      ctx.save();
      ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u20B9' + label, chart.chartArea ? (chart.chartArea.left + chart.chartArea.right) / 2 : meta.data[0].x, meta.data[0].y - 8);
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('Total', meta.data[0].x, meta.data[0].y + 14);
      ctx.restore();
    }
  };
  dashboardCharts.fee = new Chart(ctx, {
    plugins: [feeDoughnutLabels],
    type: 'doughnut',
    animation: {
      duration: 550,
      easing: 'easeOutQuart'
    },
    data: {
      labels: ['Collected', 'Pending', 'Overdue'],
      datasets: [{
        data: values,
        backgroundColor: ['#22C55E', '#F59E0B', '#DC2626'],
        borderColor: 'rgba(4,26,23,0.9)',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: 'rgba(255,255,255,0.7)',
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            padding: 14,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(4,26,23,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.95)',
          bodyColor: 'rgba(255,255,255,0.8)',
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0) || 1;
              const pct = Math.round(ctx.parsed / total * 100);
              return ` ${ctx.label}: \u20B9${ctx.parsed.toLocaleString('en-IN')} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

async function loadDashboardAnalytics() {
  const wrap = document.getElementById('dashboardAnalytics');
  if (!wrap) return;
  wrap.style.display = '';

  const annList = document.getElementById('analyticsAnnouncements');
  const studentsBody = document.getElementById('analyticsStudentsBody');

  if (isDemoMode) {
    renderDashboardTrendChart(DASHBOARD_TREND_MONTHS, DASHBOARD_TREND_ATTENDANCE, DASHBOARD_TREND_FEES);
    renderDashboardBatchChart(
      DASHBOARD_BATCH_NAMES.map((name, i) => ({
        name,
        students: DASHBOARD_BATCH_STUDENTS[i],
        attendance: DASHBOARD_BATCH_ATTENDANCE[i]
      }))
    );
    renderDashboardFeeChart(89000, 12500, 4600);
    renderDashboardAnnouncements([
      { title: 'Math final exam scheduled', created_at: '2025-07-28', category: 'Exam', message: 'The Math batch final exam is scheduled for August 15th at 10 AM. Please ensure all students reach on time.' },
      { title: 'Fee reminder for August', created_at: '2025-07-25', category: 'Fees', message: 'Fees for August are due by the 5th. Late submissions will incur a penalty.' },
      { title: 'New weekend batch starting', created_at: '2025-07-20', category: 'Batch', message: 'A new weekend science batch for class X is now open for registration.' }
    ]);
    renderDashboardTopStudents(DASHBOARD_TOP_STUDENTS);
    renderDashboardAtRiskStudents(DASHBOARD_AT_RISK_STUDENTS);
    return;
  }

  if (!userProfile?.institute_id) return;
  const instituteId = userProfile.institute_id;

  // Announcements (latest 5, role-visible — non-fatal if it fails)
  let announcements = [];
  const annRes = await safeQuery(() => db.rpc('get_announcements', { p_limit: 5 }));
  if (annRes.ok) announcements = annRes.data || [];
  renderDashboardAnnouncements(announcements);

  // Batches + students + attendance for batch comparison chart
  const batchRes = await safeQuery(() =>
    db.from('batches').select('id, name').eq('institute_id', instituteId).is('deleted_at', null).order('name', { ascending: true })
  );
  if (!batchRes.ok) {
    showSectionFallback('page-dashboard', batchRes.error, { retry: () => loadDashboardAnalytics(), retryLabel: 'Reload analytics' });
    return;
  }
  const batchRows = batchRes.data;

  const batchIds = (batchRows || []).map(b => b.id);
  let studentsPerBatch = {};
  let attendancePctPerBatch = {};
  let totalAttendanceCount = 0;
  let totalAttendancePresent = 0;

  if (batchIds.length > 0) {
    const sbRes = await safeQuery(() =>
      db.from('student_batches').select('batch_id, students!inner(deleted_at)').in('batch_id', batchIds).is('students.deleted_at', null)
    );
    const sbRows = sbRes.ok ? sbRes.data : [];
    const sbCounts = {};
    (sbRows || []).forEach(r => {
      sbCounts[r.batch_id] = (sbCounts[r.batch_id] || 0) + 1;
    });

    const attRes = await safeQuery(() =>
      db.from('attendance').select('batch_id, status').in('batch_id', batchIds)
    );
    const attRows = attRes.ok ? attRes.data : [];
    const attCounts = {};
    const attPresent = {};
    (attRows || []).forEach(r => {
      attCounts[r.batch_id] = (attCounts[r.batch_id] || 0) + 1;
      if (r.status === 'present' || r.status === 'late') attPresent[r.batch_id] = (attPresent[r.batch_id] || 0) + 1;
    });

    (batchRows || []).forEach(b => {
      studentsPerBatch[b.id] = sbCounts[b.id] || 0;
      attendancePctPerBatch[b.id] = attCounts[b.id] ? Math.round((attPresent[b.id] || 0) / attCounts[b.id] * 100) : 0;
      totalAttendanceCount += attCounts[b.id] || 0;
      totalAttendancePresent += attPresent[b.id] || 0;
    });
  }

  const hasBatches = batchRows && batchRows.length > 0;
  const hasMeaningfulData = hasBatches && (batchRows.some(b => (studentsPerBatch[b.id] || 0) > 0) || totalAttendanceCount > 0);

  if (hasMeaningfulData) {
    showBatchChartEmpty(false);
    renderDashboardBatchChart(
      batchRows.map(b => ({ name: b.name, students: studentsPerBatch[b.id] || 0, attendance: attendancePctPerBatch[b.id] || 0 }))
    );
  } else {
    if (dashboardCharts.batch) {
      dashboardCharts.batch.destroy();
      dashboardCharts.batch = null;
    }
    showBatchChartEmpty(true);
  }

  // Trend chart — real monthly attendance % and fee collection %
  const trend = await buildMonthlyTrend(instituteId);
  const hasTrendData = trend.attendancePct.some(v => v > 0) || trend.feesPct.some(v => v > 0);
  if (hasTrendData) {
    showTrendChartEmpty(false);
    renderDashboardTrendChart(trend.months, trend.attendancePct, trend.feesPct);
  } else {
    if (dashboardCharts.trend) {
      dashboardCharts.trend.destroy();
      dashboardCharts.trend = null;
    }
    showTrendChartEmpty(true);
  }

  // Fee status pie from cached dashboard totals
  const dashCache = pageDataCache['dashboard'];
  renderDashboardFeeChart(
    dashCache?.collectedTotal,
    dashCache?.pendingTotal,
    dashCache?.overdueTotal
  );

  // Top students from real student + attendance + payment data
  const studentRes = await safeQuery(() => db.from('students').select('id, full_name').eq('institute_id', instituteId).is('deleted_at', null).order('full_name').limit(200));
  const studentRows = studentRes.ok ? studentRes.data : [];
  const studentIds = (studentRows || []).map(s => s.id);

  const topStudents = await buildTopStudents(studentRows || [], studentIds, studentsPerBatch, batchIds.length ? batchIds : null);
  renderDashboardTopStudents(topStudents);

  const atRiskStudents = await buildAtRiskStudents(studentRows || [], studentIds, batchIds.length ? batchIds : null);
  renderDashboardAtRiskStudents(atRiskStudents);
}

async function buildTopStudents(students, studentIds, studentsPerBatch, batchIds) {
  if (!students || students.length === 0) return [];

  const [attRes, payRes, sbRes, batchRes] = await Promise.all([
    studentIds.length > 0 ? safeQuery(() => db.from('attendance').select('student_id, status').in('student_id', studentIds).limit(1000)) : Promise.resolve({ ok: true, data: [] }),
    studentIds.length > 0 ? safeQuery(() => db.from('payments').select('student_id, status').in('student_id', studentIds).limit(1000)) : Promise.resolve({ ok: true, data: [] }),
    batchIds && batchIds.length > 0 ? safeQuery(() => db.from('student_batches').select('student_id, batch_id').in('batch_id', batchIds).limit(2000)) : Promise.resolve({ ok: true, data: [] }),
    safeQuery(() => db.from('batches').select('id, name').eq('institute_id', userProfile.institute_id).limit(50))
  ]);

  const attendanceByStudent = {};
  const attRows = attRes.ok ? attRes.data : [];
  const counts = {};
  const present = {};
  attRows.forEach(r => {
    counts[r.student_id] = (counts[r.student_id] || 0) + 1;
    if (r.status === 'present' || r.status === 'late') present[r.student_id] = (present[r.student_id] || 0) + 1;
  });
  Object.keys(counts).forEach(id => {
    attendanceByStudent[id] = Math.round((present[id] || 0) / counts[id] * 100);
  });

  const feeByStudent = {};
  const payRows = payRes.ok ? payRes.data : [];
  payRows.forEach(r => {
    const s = feeByStudent[r.student_id] || {};
    s[r.status] = (s[r.status] || 0) + 1;
    feeByStudent[r.student_id] = s;
  });

  const batchNameByStudent = {};
  const sbRows = sbRes.ok ? sbRes.data : [];
  sbRows.forEach(r => {
    if (!batchNameByStudent[r.student_id]) batchNameByStudent[r.student_id] = r.batch_id;
  });

  const batchIdToName = {};
  const allBatches = batchRes.ok ? batchRes.data : [];
  allBatches.forEach(b => { batchIdToName[b.id] = b.name; });

  return students
    .map(s => {
      const name = (s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ')).trim() || 'Unnamed student';
      const pays = feeByStudent[s.id] || {};
      const totalPay = (pays.paid || 0) + (pays.pending || 0) + (pays.overdue || 0);
      const pct = (pays.paid || 0) / (totalPay || 1);
      let feeStatus = 'paid';
      if (pct < 1 && totalPay > 0) feeStatus = 'due';
      if ((pays.overdue || 0) > 0) feeStatus = 'overdue';
      if (totalPay === 0) feeStatus = 'paid';
      return {
        name,
        batch: batchIdToName[batchNameByStudent[s.id]] || '\u2014',
        attendance: attendanceByStudent[s.id] || 0,
        feeStatus
      };
    })
    .sort((a, b) => b.attendance - a.attendance)
    .slice(0, 5);
}

async function buildAtRiskStudents(students, studentIds, batchIds) {
  if (!students || students.length === 0) return [];

  const [attRes, payRes, sbRes, batchRes] = await Promise.all([
    studentIds.length > 0 ? safeQuery(() => db.from('attendance').select('student_id, status').in('student_id', studentIds).limit(1000)) : Promise.resolve({ ok: true, data: [] }),
    studentIds.length > 0 ? safeQuery(() => db.from('payments').select('student_id, status').in('student_id', studentIds).limit(1000)) : Promise.resolve({ ok: true, data: [] }),
    batchIds && batchIds.length > 0 ? safeQuery(() => db.from('student_batches').select('student_id, batch_id').in('batch_id', batchIds).limit(2000)) : Promise.resolve({ ok: true, data: [] }),
    safeQuery(() => db.from('batches').select('id, name').eq('institute_id', userProfile.institute_id).limit(50))
  ]);

  const attendanceByStudent = {};
  const attRows = attRes.ok ? attRes.data : [];
  const counts = {};
  const present = {};
  attRows.forEach(r => {
    counts[r.student_id] = (counts[r.student_id] || 0) + 1;
    if (r.status === 'present' || r.status === 'late') present[r.student_id] = (present[r.student_id] || 0) + 1;
  });
  Object.keys(counts).forEach(id => {
    attendanceByStudent[id] = Math.round((present[id] || 0) / counts[id] * 100);
  });

  const feeByStudent = {};
  const payRows = payRes.ok ? payRes.data : [];
  payRows.forEach(r => {
    const s = feeByStudent[r.student_id] || {};
    s[r.status] = (s[r.status] || 0) + 1;
    feeByStudent[r.student_id] = s;
  });

  const batchNameByStudent = {};
  const sbRows = sbRes.ok ? sbRes.data : [];
  sbRows.forEach(r => {
    if (!batchNameByStudent[r.student_id]) batchNameByStudent[r.student_id] = r.batch_id;
  });

  const batchIdToName = {};
  const allBatches = batchRes.ok ? batchRes.data : [];
  allBatches.forEach(b => { batchIdToName[b.id] = b.name; });

  return students
    .map(s => {
      const name = (s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ')).trim() || 'Unnamed student';
      const pays = feeByStudent[s.id] || {};
      const totalPay = (pays.paid || 0) + (pays.pending || 0) + (pays.overdue || 0);
      const pct = (pays.paid || 0) / (totalPay || 1);
      let feeStatus = 'paid';
      if (pct < 1 && totalPay > 0) feeStatus = 'due';
      if ((pays.overdue || 0) > 0) feeStatus = 'overdue';
      if (totalPay === 0) feeStatus = 'paid';
      return {
        name,
        batch: batchIdToName[batchNameByStudent[s.id]] || '\u2014',
        attendance: attendanceByStudent[s.id] || 0,
        feeStatus
      };
    })
    .map(s => ({ s, risk: riskLevelFor(s) }))
    .filter(s => s.risk.key !== 'low')
    .sort((a, b) => a.s.attendance - b.s.attendance)
    .slice(0, 6)
    .map(s => s.s);
}

// ── Billing Page ──

async function populateBillingPage() {
  if (isDemoMode) {
    renderDemoBilling();
    return;
  }

  const planConfig = Payment.getPlanConfig(currentPlan);

  document.getElementById('billingPlanName').textContent = planConfig.name;

  const limits = planConfig.limits;
  const detailParts = [];
  detailParts.push(limits.maxStudents === Infinity ? 'Unlimited students' : `${limits.maxStudents} students`);
  detailParts.push(limits.maxBatches === Infinity ? 'Unlimited batches' : `${limits.maxBatches} batches`);
  detailParts.push(limits.maxTeachers === Infinity ? 'Unlimited teachers' : `${limits.maxTeachers} teachers`);
  document.getElementById('billingPlanDetail').textContent = detailParts.join(' \u00B7 ');

  document.getElementById('billingExpiry').textContent = currentPlan === 'free' ? 'Free forever' : 'Renews monthly';

  const planOrder = ['free', 'basic', 'pro'];
  const currentIdx = planOrder.indexOf(currentPlan);

  document.querySelectorAll('.billing-plan-card').forEach(card => {
    const cardPlan = card.id.replace('billingCard-', '');
    const cardIdx = planOrder.indexOf(cardPlan);
    const btn = card.querySelector('.billing-plan-btn');

    card.classList.remove('billing-plan-card-current', 'billing-plan-card-lower');

    if (cardPlan === currentPlan) {
      card.classList.add('billing-plan-card-current');
      if (btn) {
        btn.textContent = 'Current Plan';
        btn.disabled = true;
        btn.classList.remove('billing-plan-btn-upgrade');
        btn.classList.add('billing-plan-btn-current');
      }
    } else if (cardIdx < currentIdx) {
      card.classList.add('billing-plan-card-lower');
      if (btn) {
        btn.textContent = 'Included in your plan';
        btn.disabled = true;
        btn.classList.remove('billing-plan-btn-upgrade');
        btn.classList.add('billing-plan-btn-current');
      }
    } else {
      if (btn) {
        btn.textContent = 'Upgrade to ' + Payment.getPlanConfig(cardPlan).name;
        btn.disabled = false;
        btn.classList.remove('billing-plan-btn-current');
        btn.classList.add('billing-plan-btn-upgrade');
      }
    }
  });

  await loadBillingUsage();
  await loadPaymentHistory();
}

async function loadBillingUsage() {
  if (!userProfile?.institute_id) return;

  const planConfig = Payment.getPlanConfig(currentPlan);
  const limits = planConfig.limits;

  const studentRes = await safeQuery(() =>
    db.from('students').select('*', { count: 'exact', head: true }).eq('institute_id', userProfile.institute_id).is('deleted_at', null)
  );
  const studentCount = studentRes.ok ? (studentRes.count || 0) : 0;

  const batchRes = await safeQuery(() =>
    db.from('batches').select('*', { count: 'exact', head: true }).eq('institute_id', userProfile.institute_id).is('deleted_at', null)
  );
  const batchCount = batchRes.ok ? (batchRes.count || 0) : 0;

  const maxStudents = limits.maxStudents === Infinity ? 100 : limits.maxStudents;
  const studentPct = Math.min(100, ((studentCount || 0) / maxStudents) * 100);
  document.getElementById('usageStudents').textContent = `${studentCount || 0} / ${limits.maxStudents === Infinity ? '\u221E' : limits.maxStudents}`;
  document.getElementById('usageStudentsBar').style.width = studentPct + '%';
  if (studentPct >= 90) document.getElementById('usageStudentsBar').classList.add('almost-full');
  else document.getElementById('usageStudentsBar').classList.remove('almost-full');

  const maxBatches = limits.maxBatches === Infinity ? 10 : limits.maxBatches;
  const batchPct = Math.min(100, ((batchCount || 0) / maxBatches) * 100);
  document.getElementById('usageBatches').textContent = `${batchCount || 0} / ${limits.maxBatches === Infinity ? '\u221E' : limits.maxBatches}`;
  document.getElementById('usageBatchesBar').style.width = batchPct + '%';
  if (batchPct >= 90) document.getElementById('usageBatchesBar').classList.add('almost-full');
  else document.getElementById('usageBatchesBar').classList.remove('almost-full');

  const teacherRes = await safeQuery(() =>
    db.from('users').select('*', { count: 'exact', head: true }).eq('institute_id', userProfile.institute_id).eq('role', 'teacher')
  );
  const teacherCount = teacherRes.ok ? (teacherRes.count || 0) : 0;

  const maxTeachers = limits.maxTeachers === Infinity ? 100 : limits.maxTeachers;
  const teacherPct = Math.min(100, ((teacherCount || 0) / maxTeachers) * 100);
  document.getElementById('usageTeachers').textContent = `${teacherCount || 0} / ${limits.maxTeachers === Infinity ? '\u221E' : limits.maxTeachers}`;
  document.getElementById('usageTeachersBar').style.width = teacherPct + '%';
  if (teacherPct >= 90) document.getElementById('usageTeachersBar').classList.add('almost-full');
  else document.getElementById('usageTeachersBar').classList.remove('almost-full');
}

async function loadPaymentHistory() {
  if (!currentUser) return;

  const historyEl = document.getElementById('billingHistoryList');
  if (!historyEl) return;

  try {
    const payRes = await safeQuery(() =>
      db.from('subscriptions').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false })
    );
    if (!payRes.ok) throw payRes.error;
    const payments = payRes.data;

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
      const amount = `\u20B9${(p.amount || planConfig.price).toLocaleString('en-IN')}/mo`;

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
        <span class="billing-history-id" title="${escapeHtml(p.razorpay_payment_id || '')}">${escapeHtml(p.razorpay_payment_id ? p.razorpay_payment_id.slice(0, 16) + '...' : 'Free plan')}</span>
      `;

      historyEl.appendChild(row);
    });
  } catch (err) {
    console.warn('Could not load payment history:', err);
  }
}

async function startBillingUpgrade(plan) {
  if (!currentUser) return;

  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'index.html?login=1';
    return;
  }

  await Payment.loadScript();

  const planDetails = {
    basic: { name: 'Basic Plan', description: 'PingClass Basic - Monthly' },
    pro: { name: 'Pro Plan', description: 'PingClass Pro - Monthly' }
  };

  const details = planDetails[plan];
  if (!details) return;

  const orderRes = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': CONFIG.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ plan_id: plan })
  });

  const orderData = await orderRes.json();
  if (!orderRes.ok || !orderData.order_id) {
    console.error('Could not start checkout:', orderData?.error);
    alert('Could not start checkout. Please try again.');
    return;
  }

  const options = {
    key: CONFIG.RAZORPAY_KEY_ID,
    order_id: orderData.order_id,
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
        const { data: { session } } = await db.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('No session');

        const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': CONFIG.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            plan_id: plan,
            payment_id: response.razorpay_payment_id,
            order_id: response.razorpay_order_id,
            signature: response.razorpay_signature
          })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || 'Verification failed');
      } catch (e) {
        console.warn('Subscription insert failed (payment still valid):', e);
      }

      currentPlan = plan;
      await fetchPlanLimits();
      if (typeof applyPlanGating === 'function') applyPlanGating();
      populateBillingPage();
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

// Attach upgrade click handlers
document.querySelectorAll('.billing-plan-btn-upgrade').forEach(btn => {
  btn.addEventListener('click', () => startBillingUpgrade(btn.dataset.plan));
});

// ── Staff Page ──

let allStaff = [];

async function populateStaffPage() {
  if (isDemoMode) {
    renderDemoStaff();
    return;
  }

  if (!currentInstitute?.id) return;

  if (pageDataCache['staff']) {
    allStaff = pageDataCache['staff'];
    renderStaffTable(allStaff);
    updateStaffLimitUI();
    return;
  }

  const usersRes = await safeQuery(() =>
    db.from('users').select('id, full_name, email, role, created_at').eq('institute_id', currentInstitute.id).eq('role', 'teacher')
  );
  if (!usersRes.ok) { showSectionFallback('page-staff', usersRes.error, { retry: () => populateStaffPage() }); return; }
  const users = usersRes.data;
  naturalNameSort(users || []);

  const tokensRes = await safeQuery(() =>
    db.from('invite_tokens').select('id, email, role, name, used, expires_at, created_at')
      .eq('institute_id', currentInstitute.id).eq('role', 'teacher').eq('used', false)
      .order('created_at', { ascending: false })
  );
  const tokens = tokensRes.ok ? tokensRes.data : [];

  allStaff = [];
  const staffEmails = new Set();

  if (users) {
    users.forEach(u => {
      staffEmails.add(u.email?.toLowerCase());
      allStaff.push({
        id: u.id, name: u.full_name || u.email?.split('@')[0] || '\u2014',
        email: u.email, role: u.role, status: 'active', joined: u.created_at
      });
    });
  }

  if (tokens) {
    tokens.forEach(t => {
      if (staffEmails.has(t.email?.toLowerCase())) return;
      const now = new Date();
      const expires = new Date(t.expires_at);
      let status = 'invited';
      if (t.used) status = 'active';
      else if (expires < now) status = 'expired';
      allStaff.push({
        id: t.id, name: t.name || t.email?.split('@')[0] || '\u2014',
        email: t.email, role: t.role, status, joined: t.created_at,
        isInvite: true, used: t.used, token: t.id
      });
    });
  }

  pageDataCache['staff'] = [...allStaff];
  renderStaffTable(allStaff);
  updateStaffLimitUI();
}

function updateStaffLimitUI() {
  const teacherCount = allStaff.filter(s => s.role === 'teacher').length;
  const maxDisplay = planLimits.max_teachers === 999999 ? '∞' : planLimits.max_teachers;
  const existing = document.getElementById('staffLimitBadge');
  if (existing) existing.remove();
  const badge = document.createElement('span');
  badge.id = 'staffLimitBadge';
  badge.style.cssText = 'font-size:0.75rem;font-weight:600;color:var(--text-muted);background:rgba(255,255,255,0.06);border:1px solid var(--card-border);border-radius:8px;padding:4px 10px;white-space:nowrap;';
  badge.textContent = `${teacherCount} / ${maxDisplay} teachers`;
  const header = document.querySelector('#page-staff .staff-header .welcome');
  if (header) header.appendChild(badge);
  const inviteBtn = document.getElementById('staffInviteBtn');
  const inviteBtnEmpty = document.getElementById('staffInviteBtnEmpty');
  const atLimit = teacherCount >= planLimits.max_teachers;
  if (inviteBtn) {
    inviteBtn.disabled = atLimit;
    inviteBtn.title = atLimit ? `Teacher limit reached (${maxDisplay}). Upgrade to invite more.` : '';
    inviteBtn.textContent = atLimit ? `Limit Reached (${maxDisplay})` : 'Invite Staff';
  }
  if (inviteBtnEmpty) {
    inviteBtnEmpty.disabled = atLimit;
    inviteBtnEmpty.title = atLimit ? `Teacher limit reached (${maxDisplay}). Upgrade to invite more.` : '';
    inviteBtnEmpty.textContent = atLimit ? `Limit Reached (${maxDisplay})` : 'Invite Staff';
  }
}

function renderStaffTable(staff) {
  const tbody = document.getElementById('staffTableBody');
  const empty = document.getElementById('staffEmpty');
  const table = document.querySelector('.staff-table');

  if (!tbody) return;

  if (staff.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.classList.add('visible');
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.classList.remove('visible');

  tbody.innerHTML = staff.map(s => {
    const initials = (s.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const roleClass = s.role === 'teacher' ? 'staff-role-teacher' : 'staff-role-parent';
    const avatarClass = s.role === 'teacher' ? 'staff-avatar-teacher' : 'staff-avatar-parent';
    const roleLabel = s.role.charAt(0).toUpperCase() + s.role.slice(1);
    const statusClass = 'staff-status-' + s.status;
    const statusLabel = s.status.charAt(0).toUpperCase() + s.status.slice(1);
    const dateStr = s.joined ? new Date(s.joined).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';

    let actionHtml = `<button class="staff-action-btn" onclick="editStaff('${s.id}')">Edit</button>`;
    if (s.status === 'invited') {
      actionHtml += ` <button class="staff-action-btn staff-action-btn-resend" onclick="resendInvite('${s.id}')">Resend</button>`;
    }
    actionHtml += ` <button class="staff-action-btn staff-action-btn-delete" onclick="confirmDeleteStaff('${escapeInlineJs(s.id)}','${escapeInlineJs(s.name)}','${s.isInvite ? 'invite' : 'user'}','${escapeInlineJs(s.role)}')">Remove</button>`;

    const searchText = [s.name, s.email].filter(Boolean).join(' ').toLowerCase();
    return `<tr data-status="${s.status}" data-search="${escapeHtml(searchText)}">
      <td data-label="Name">
        <div class="staff-name">
          <div class="staff-avatar ${avatarClass}">${escapeHtml(initials)}</div>
          ${escapeHtml(s.name)}
        </div>
      </td>
      <td data-label="Email"><span class="staff-email">${escapeHtml(s.email)}</span></td>
      <td data-label="Role"><span class="staff-role ${roleClass}">${roleLabel}</span></td>
      <td data-label="Status"><span class="staff-status ${statusClass}"><span class="staff-status-dot"></span>${statusLabel}</span></td>
      <td data-label="Added"><span class="staff-date">${dateStr}</span></td>
      <td class="staff-actions">${actionHtml}</td>
    </tr>`;
  }).join('');
}

// ── Parents Page ──

let allParents = [];

async function populateParentsPage() {
  if (isDemoMode) {
    renderDemoParents();
    return;
  }

  if (!currentInstitute?.id) return;

  if (pageDataCache['parents']) {
    allParents = pageDataCache['parents'];
    renderParentsTable(allParents);
    return;
  }

  const usersRes = await safeQuery(() =>
    db.from('users').select('id, full_name, email, role, created_at').eq('institute_id', currentInstitute.id).eq('role', 'parent')
  );
  if (!usersRes.ok) { showSectionFallback('page-parents', usersRes.error, { retry: () => populateParentsPage() }); return; }
  const users = usersRes.data;
  naturalNameSort(users || []);

  const tokensRes = await safeQuery(() =>
    db.from('invite_tokens').select('id, email, role, name, used, expires_at, created_at')
      .eq('institute_id', currentInstitute.id).eq('role', 'parent').eq('used', false)
      .order('created_at', { ascending: false })
  );
  const tokens = tokensRes.ok ? tokensRes.data : [];

  allParents = [];
  const parentEmails = new Set();

  if (users) {
    for (const u of users) {
      parentEmails.add(u.email?.toLowerCase());
      const linkRes = await safeQuery(() =>
        db.from('parent_student_links').select('student_id, students(full_name)').eq('parent_id', u.id).limit(1).maybeSingle()
      );
      const link = linkRes.ok ? linkRes.data : null;

      allParents.push({
        id: u.id, name: u.full_name || u.email?.split('@')[0] || '\u2014',
        email: u.email, role: 'parent',
        student: link?.students?.full_name || '\u2014',
        status: 'active', joined: u.created_at
      });
    }
  }

  if (tokens) {
    tokens.forEach(t => {
      if (parentEmails.has(t.email?.toLowerCase())) return;
      const now = new Date();
      const expires = new Date(t.expires_at);
      let status = 'invited';
      if (t.used) status = 'active';
      else if (expires < now) status = 'expired';
      allParents.push({
        id: t.id, name: t.name || t.email?.split('@')[0] || '\u2014',
        email: t.email, role: t.role, student: '\u2014',
        status, joined: t.created_at,
        isInvite: true, used: t.used, token: t.id
      });
    });
  }

  pageDataCache['parents'] = [...allParents];
  renderParentsTable(allParents);
}

function renderParentsTable(parents) {
  const tbody = document.getElementById('parentsTableBody');
  const empty = document.getElementById('parentsEmpty');
  const table = document.querySelector('#page-parents .staff-table');

  if (!tbody) return;

  if (parents.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.classList.add('visible');
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.classList.remove('visible');

  tbody.innerHTML = parents.map(p => {
    const initials = (p.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const statusClass = 'staff-status-' + p.status;
    const statusLabel = p.status.charAt(0).toUpperCase() + p.status.slice(1);
    const dateStr = p.joined ? new Date(p.joined).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';

    let actionHtml = `<button class="staff-action-btn" onclick="editParent('${p.id}')">Edit</button>`;
    if (p.status === 'invited') {
      actionHtml += ` <button class="staff-action-btn staff-action-btn-resend" onclick="resendInvite('${p.id}')">Resend</button>`;
    }
    actionHtml += ` <button class="staff-action-btn staff-action-btn-delete" onclick="confirmDeleteStaff('${escapeInlineJs(p.id)}','${escapeInlineJs(p.name)}','${p.isInvite ? 'invite' : 'user'}','parent')">Remove</button>`;

    const searchText = [p.name, p.email, p.student].filter(Boolean).join(' ').toLowerCase();
    return `<tr data-status="${p.status}" data-search="${escapeHtml(searchText)}">
      <td data-label="Name">
        <div class="staff-name">
          <div class="staff-avatar staff-avatar-parent">${escapeHtml(initials)}</div>
          ${escapeHtml(p.name)}
        </div>
      </td>
      <td data-label="Email"><span class="staff-email">${escapeHtml(p.email)}</span></td>
      <td data-label="Student"><span class="staff-email">${escapeHtml(p.student)}</span></td>
      <td data-label="Status"><span class="staff-status ${statusClass}"><span class="staff-status-dot"></span>${statusLabel}</span></td>
      <td data-label="Added"><span class="staff-date">${dateStr}</span></td>
      <td class="staff-actions">${actionHtml}</td>
    </tr>`;
  }).join('');
}

// ── Invite Modal ──

const inviteModal = document.getElementById('inviteModal');
const inviteForm = document.getElementById('inviteForm');
const inviteError = document.getElementById('inviteError');
const studentField = document.getElementById('studentField');
const linkModal = document.getElementById('linkModal');
const linkInput = document.getElementById('inviteLinkInput');
const linkCopyBtn = document.getElementById('inviteLinkCopy');

let inviteRole = 'teacher';

function openInviteModal(role) {
  inviteRole = role || 'teacher';
  document.getElementById('inviteRole').value = inviteRole;
  document.getElementById('inviteModalTitle').textContent = inviteRole === 'parent' ? 'Invite Parent' : 'Invite Staff Member';
  inviteModal.classList.add('open');
  inviteForm.reset();
  inviteError.classList.remove('visible');
  document.getElementById('inviteRole').value = inviteRole;
  if (inviteRole === 'parent') {
    studentField.style.display = '';
    loadStudentsForInvite();
  } else {
    studentField.style.display = 'none';
  }
  if (typeof fluidPause === 'function') fluidPause();
}

function closeInviteModal() {
  closeAllCustomSelects();
  inviteModal.classList.remove('open');
  if (typeof fluidResume === 'function') fluidResume();
}

function openLinkModal(token) {
  let baseUrl = window.location.href;
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
  if (typeof fluidResume === 'function') fluidResume();
}

async function loadStudentsForInvite() {
  setCustomSelectOptions('inviteStudent', [{value:'', label:'Loading...'}], '');

  const res = await safeQuery(() =>
    db.from('students').select('id, full_name').eq('institute_id', currentInstitute.id).is('deleted_at', null)
  );
  const data = res.ok ? res.data : [];
  naturalNameSort(data || []);

  const options = [{value:'', label:'Select student...'}];
  if (data) {
    data.forEach(s => {
      options.push({value:s.id, label:s.full_name});
    });
  }
  setCustomSelectOptions('inviteStudent', options, '');
}

// Submit invite
inviteForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('inviteName').value.trim();
  const email = document.getElementById('inviteEmail').value.trim();
  const role = inviteRole;
  const studentId = getCustomSelectValue('inviteStudent');

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

  // Check teacher limit for new invites (not parents)
  if (role === 'teacher') {
    const teachersRes = await safeQuery(() =>
      db.from('users').select('id').eq('institute_id', currentInstitute.id).eq('role', 'teacher')
    );
    const pendingRes = await safeQuery(() =>
      db.from('invite_tokens').select('id').eq('institute_id', currentInstitute.id).eq('role', 'teacher').eq('used', false).gt('expires_at', new Date().toISOString())
    );
    const totalCount = (teachersRes.ok ? teachersRes.data : []).length + (pendingRes.ok ? pendingRes.data : []).length;
    if (totalCount >= planLimits.max_teachers) {
      const maxDisplay = planLimits.max_teachers === 999999 ? '∞' : planLimits.max_teachers;
      inviteError.textContent = `Teacher limit reached (${maxDisplay}). Upgrade your plan to invite more.`;
      inviteError.classList.add('visible');
      return;
    }
  }

  await withLoading(submitBtn, async () => {
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
      return;
    }

    const token = crypto.randomUUID();
    let inviteData = null;
    let inviteErr = null;
    try {
      const result = await db
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
      inviteData = result.data;
      inviteErr = result.error;
    } catch (e) {
      inviteErr = e;
    }

    if (inviteErr) {
      const msg = (inviteErr.message || inviteErr.details || '').toLowerCase();
      if (msg.includes('teacher limit')) {
        inviteError.textContent = 'You have reached the teacher limit for your plan. Upgrade to invite more.';
      } else {
        inviteError.textContent = 'Failed to send invite. Please try again.';
      }
      inviteError.classList.add('visible');
      return;
    }

    openLinkModal(inviteData.id);
    if (inviteRole === 'parent') { invalidatePageCache('parents'); populateParentsPage(); }
    else { invalidatePageCache('staff'); populateStaffPage(); }
  }, { label: 'Sending...' });
});

// Copy invite link
linkCopyBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(linkInput.value).then(() => {
    linkCopyBtn.classList.add('copied');
    linkCopyBtn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Copied!`;
  });
});

// Resend invite
async function resendInvite(tokenId) {
  const old = allStaff.find(s => s.id === tokenId) || allParents.find(p => p.id === tokenId);
  if (!old) return;

  const { error: delErr } = await db.from('invite_tokens').delete().eq('id', tokenId);
  if (delErr) console.error('Delete old token failed:', delErr);

  const newToken = crypto.randomUUID();
  const { data: newData, error: insErr } = await db
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

  if (insErr) {
    console.error('Insert new token failed:', insErr);
    alert('Failed to resend invite: ' + (insErr.message || insErr.hint || 'Unknown error'));
    return;
  }

  if (newData) {
    openLinkModal(newData.id);
    if (old.role === 'parent') { invalidatePageCache('parents'); populateParentsPage(); }
    else { invalidatePageCache('staff'); populateStaffPage(); }
  }
}

// ── Delete Staff ──
let deleteTarget = null;

function confirmDeleteStaff(id, name, type, role) {
  deleteTarget = { id, name, type, role };
  document.getElementById('deleteStaffName').textContent = name;
  document.getElementById('deleteStaffModalTitle').textContent = role === 'parent' ? 'Remove Parent' : 'Remove Staff Member';
  document.getElementById('deleteStaffModal').classList.add('open');
}

function closeDeleteStaffModal() {
  document.getElementById('deleteStaffModal').classList.remove('open');
  deleteTarget = null;
}

document.getElementById('deleteStaffModalClose')?.addEventListener('click', closeDeleteStaffModal);
document.getElementById('deleteStaffCancel')?.addEventListener('click', closeDeleteStaffModal);
document.getElementById('deleteStaffModal')?.addEventListener('click', (e) => { if (e.target.id === 'deleteStaffModal') closeDeleteStaffModal(); });

document.getElementById('deleteStaffConfirm')?.addEventListener('click', async () => {
  if (!deleteTarget || !currentInstitute?.id) return;
  const btn = document.getElementById('deleteStaffConfirm');

  try {
    await withLoading(btn, async () => {
      const { id, type } = deleteTarget;

      if (type === 'invite') {
        // Pending invite — just delete the token
        await db.from('invite_tokens').delete().eq('id', id);
      } else {
        // Active user — remove profile + auth account server-side (authorized)
        const { data: { session } } = await db.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('No session');

        const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': CONFIG.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ user_id: id })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || 'Remove failed');
      }
    }, { label: 'Removing...' });
  } catch (err) {
    return;
  }

  const deletedRole = deleteTarget.role;
  closeDeleteStaffModal();
  if (deletedRole === 'parent') { invalidatePageCache('parents'); invalidatePageCache('batches'); invalidatePageCache('students'); invalidatePageCache('fees'); populateParentsPage(); }
  else { invalidatePageCache('staff'); invalidatePageCache('batches'); invalidatePageCache('students'); invalidatePageCache('fees'); populateStaffPage(); }
});

// Wire up invite buttons
document.getElementById('staffInviteBtn')?.addEventListener('click', () => {
  if (document.getElementById('staffInviteBtn').disabled) return;
  openInviteModal('teacher');
});
document.getElementById('staffInviteBtnEmpty')?.addEventListener('click', () => {
  if (document.getElementById('staffInviteBtnEmpty').disabled) return;
  openInviteModal('teacher');
});
document.getElementById('parentInviteBtn')?.addEventListener('click', () => openInviteModal('parent'));
document.getElementById('parentInviteBtnEmpty')?.addEventListener('click', () => openInviteModal('parent'));

// Close modals
document.getElementById('inviteModalClose')?.addEventListener('click', closeInviteModal);
document.getElementById('inviteModalCancel')?.addEventListener('click', closeInviteModal);
document.getElementById('linkModalClose')?.addEventListener('click', closeLinkModal);
document.getElementById('linkModalDone')?.addEventListener('click', closeLinkModal);

// Close modals on overlay click
inviteModal?.addEventListener('click', (e) => {
  if (e.target === inviteModal) {
    closeAllCustomSelects();
    closeInviteModal();
  }
});

// Safety net: when modal finishes closing, kill any detached dropdowns
inviteModal?.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'opacity' && !inviteModal.classList.contains('open')) {
    document.querySelectorAll('.custom-select-options').forEach(opts => {
      if (opts.parentElement !== opts.closest('.custom-select')) {
        opts.classList.remove('is-open');
        opts.style.display = 'none';
        const wrap = opts.closest('.custom-select') || document.querySelector('[data-select-id]');
        if (wrap) {
          wrap.appendChild(opts);
          requestAnimationFrame(() => { opts.style.display = ''; });
        }
      }
    });
  }
});
linkModal?.addEventListener('click', (e) => { if (e.target === linkModal) closeLinkModal(); });

// ── Students Page ──

async function populateStudentsPage() {
  if (isDemoMode) {
    renderDemoStudents();
    return;
  }

  if (!currentInstitute?.id) return;

  // Use cache if available
  if (pageDataCache['students']) {
    const c = pageDataCache['students'];
    window._studentsData = c.students;
    window._studentBatchIds = c.studentBatchIds;
    setCustomSelectOptions('studentBatchFilter', [{value:'', label:'All Batches'}, ...(c.instBatches || []).map(b => ({value:b.id, label:b.name}))], getCustomSelectValue('studentBatchFilter'));
    renderStudentsTable(c.students, c.studentBatchIds, c.batchMap);
    updateStudentLimitUI(c.students.length);
    return;
  }

  const studentsRes = await safeQuery(() =>
    db.from('students').select('id, full_name, phone, created_at').eq('institute_id', currentInstitute.id).is('deleted_at', null)
  );
  if (!studentsRes.ok) { showSectionFallback('page-students', studentsRes.error, { retry: () => populateStudentsPage() }); return; }
  const students = studentsRes.data;
  naturalNameSort(students || []);

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('id, name').eq('institute_id', currentInstitute.id).is('deleted_at', null).order('name')
  );
  if (!batchesRes.ok) { showSectionFallback('page-students', batchesRes.error, { retry: () => populateStudentsPage() }); return; }
  const instBatches = batchesRes.data;
  const batchIds = (instBatches || []).map(b => b.id);

  // Populate batch filter dropdown
  setCustomSelectOptions('studentBatchFilter', [{value:'', label:'All Batches'}, ...(instBatches || []).map(b => ({value:b.id, label:b.name}))], getCustomSelectValue('studentBatchFilter'));

  let links = [];
  if (batchIds.length > 0) {
    const sbRes = await safeQuery(() =>
      db.from('student_batches').select('student_id, batch_id, batches(name)').in('batch_id', batchIds)
    );
    links = sbRes.ok ? sbRes.data : [];
  }

  const batchMap = {};
  const studentBatchIds = {};
  (links || []).forEach(l => {
    if (!batchMap[l.student_id]) batchMap[l.student_id] = [];
    if (l.batches) batchMap[l.student_id].push(l.batches.name);
    if (!studentBatchIds[l.student_id]) studentBatchIds[l.student_id] = [];
    studentBatchIds[l.student_id].push(l.batch_id);
  });

  // Store in cache
  pageDataCache['students'] = { students: students || [], studentBatchIds, batchMap, instBatches };

  // Store data for filtering
  window._studentsData = students || [];
  window._studentBatchIds = studentBatchIds;

  renderStudentsTable(students || [], studentBatchIds, batchMap);
  updateStudentLimitUI(students?.length || 0);
}

function updateStudentLimitUI(count) {
  const maxDisplay = planLimits.max_students === 999999 ? '∞' : planLimits.max_students;
  const addBtn = document.getElementById('addStudentBtn');
  if (addBtn) {
    if (count >= planLimits.max_students) {
      addBtn.disabled = true;
      addBtn.title = `Student limit reached (${maxDisplay}). Upgrade to add more.`;
      addBtn.textContent = `Limit Reached (${maxDisplay})`;
    } else {
      addBtn.disabled = false;
      addBtn.title = '';
      addBtn.textContent = 'Add Student';
    }
  }
  const existing = document.getElementById('studentLimitBadge');
  if (existing) existing.remove();
  const badge = document.createElement('span');
  badge.id = 'studentLimitBadge';
  badge.style.cssText = 'font-size:0.75rem;font-weight:600;color:var(--text-muted);background:rgba(255,255,255,0.06);border:1px solid var(--card-border);border-radius:8px;padding:4px 10px;white-space:nowrap;';
  badge.textContent = `${count} / ${maxDisplay} students`;
  const header = document.querySelector('#page-students .page-header .welcome');
  if (header) header.appendChild(badge);
}

function renderStudentsTable(students, studentBatchIds, batchMap) {
  const filterBatchId = getCustomSelectValue('studentBatchFilter');
  const searchInput = document.querySelector('.section-search-input[data-filter="studentsTableBody"]');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = students.filter(s => {
    if (filterBatchId && !(studentBatchIds[s.id] || []).includes(filterBatchId)) return false;
    if (query) {
      if (!(s.full_name || '').toLowerCase().includes(query)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('studentsTableBody');
  const empty = document.getElementById('studentsEmpty');
  const table = document.querySelector('#page-students .page-table');

  if (filtered.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'flex';
  } else {
    if (table) table.style.display = '';
    if (empty) empty.style.display = 'none';
  }

  tbody.innerHTML = filtered.map(s => {
    const initials = (s.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const batches = batchMap[s.id] || [];
    const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
    return `<tr>
      <td data-label="Name">
        <div class="staff-name">
          <div class="staff-avatar staff-avatar-teacher">${escapeHtml(initials)}</div>
          ${escapeHtml(s.full_name || '\u2014')}
        </div>
      </td>
      <td data-label="Phone"><span class="staff-email">${escapeHtml(s.phone || '\u2014')}</span></td>
      <td data-label="Batches">${batches.length > 0 ? batches.map(b => `<span class="staff-role staff-role-teacher">${escapeHtml(b)}</span>`).join(' ') : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td data-label="Status"><span class="staff-status staff-status-active"><span class="staff-status-dot"></span>Active</span></td>
      <td data-label="Added"><span class="staff-date">${dateStr}</span></td>
      <td class="staff-actions">
        <button class="staff-action-btn" onclick="editStudent('${s.id}')">Edit</button>
        <button class="staff-action-btn staff-action-btn-resend" onclick="deleteStudent('${s.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Batches Page ──

// Demo mode batch data (with assigned teachers)
const demoBatchData = [
  {
    id: 'demo-b1',
    name: 'Class 9 — Mathematics',
    schedule: 'Mon, Wed, Fri \u00B7 4:00 PM',
    teacher_id: 'demo-t1',
    teacher: 'Rahul Sharma',
    fee: 2500,
    frequency: 'monthly',
    students: [
      { id: 'demo-s101', full_name: 'Arjun Mehta', phone: '98765 43210', created_at: '2025-04-12T00:00:00', attendance: 92 },
      { id: 'demo-s102', full_name: 'Ishita Gupta', phone: '98123 45678', created_at: '2025-04-15T00:00:00', attendance: 85 },
      { id: 'demo-s103', full_name: 'Kabir Khan', phone: '99603 11223', created_at: '2025-05-02T00:00:00', attendance: 74 },
      { id: 'demo-s104', full_name: 'Meera Nair', phone: '99000 88776', created_at: '2025-05-09T00:00:00', attendance: 96 }
    ]
  },
  {
    id: 'demo-b2',
    name: 'Class 10 — Physics',
    schedule: 'Tue, Thu, Sat \u00B7 5:00 PM',
    teacher_id: 'demo-t2',
    teacher: 'Priya Patel',
    fee: 2800,
    frequency: 'monthly',
    students: [
      { id: 'demo-s201', full_name: 'Rohan Joshi', phone: '98220 33441', created_at: '2025-04-08T00:00:00', attendance: 88 },
      { id: 'demo-s202', full_name: 'Ananya Rao', phone: '97531 86420', created_at: '2025-04-20T00:00:00', attendance: 79 },
      { id: 'demo-s203', full_name: 'Dev Patel', phone: '99887 66554', created_at: '2025-05-01T00:00:00', attendance: 67 }
    ]
  },
  {
    id: 'demo-b3',
    name: 'Class 8 — English',
    schedule: 'Mon, Tue, Thu \u00B7 3:00 PM',
    teacher_id: null,
    teacher: null,
    fee: 2200,
    frequency: 'monthly',
    students: [
      { id: 'demo-s301', full_name: 'Saanvi Kapoor', phone: '91234 56780', created_at: '2025-04-18T00:00:00', attendance: 95 },
      { id: 'demo-s302', full_name: 'Yash Malhotra', phone: '95544 12345', created_at: '2025-05-05T00:00:00', attendance: 81 }
    ]
  },
  {
    id: 'demo-b4',
    name: 'Class 11 — Chemistry',
    schedule: 'Wed, Fri \u00B7 6:30 PM',
    teacher_id: 'demo-t4',
    teacher: 'Sneha Iyer',
    fee: 3200,
    frequency: 'monthly',
    students: [
      { id: 'demo-s401', full_name: 'Aditya Verma', phone: '90012 34567', created_at: '2025-04-06T00:00:00', attendance: 72 },
      { id: 'demo-s402', full_name: 'Nisha Reddy', phone: '97890 12345', created_at: '2025-04-25T00:00:00', attendance: 90 }
    ]
  },
  {
    id: 'demo-b5',
    name: 'Class 12 — Biology',
    schedule: 'Sat, Sun \u00B7 10:00 AM',
    teacher_id: 'demo-t5',
    teacher: 'Vikram Singh',
    fee: 3500,
    frequency: 'monthly',
    students: [
      { id: 'demo-s501', full_name: 'Riya Sharma', phone: '98700 11223', created_at: '2025-04-03T00:00:00', attendance: 84 },
      { id: 'demo-s502', full_name: 'Tanmay Bhatt', phone: '93322 44556', created_at: '2025-04-28T00:00:00', attendance: 63 }
    ]
  }
];

function renderDemoBatches() {
  planLimits = { ...planLimits, max_batches: 999999 };

  const detail = document.getElementById('batchDetail');
  if (detail) detail.style.display = 'none';

  const batchSearch = document.querySelector('#page-batches .section-search-input');
  if (batchSearch) {
    batchSearch.dataset.filter = 'batchesGrid';
    batchSearch.placeholder = 'Search batches...';
    batchSearch.value = '';
  }

  const batches = demoBatchData.map(b => ({ id: b.id, name: b.name, schedule: b.schedule, teacher_id: b.teacher_id }));
  const feeMap = {};
  const countMap = {};
  const teacherMap = {};
  demoBatchData.forEach(b => {
    feeMap[b.id] = b.fee;
    countMap[b.id] = (b.students || []).length;
    teacherMap[b.teacher_id] = b.teacher;
  });

  pageDataCache['batches'] = { batches, feeMap, countMap, teacherMap };
  renderBatchCards(batches, feeMap, countMap, teacherMap);
  updateBatchLimitUI(batches.length);
}

function showDemoBatchDetail(batchId) {
  const grid = document.getElementById('batchesGrid');
  const empty = document.getElementById('batchesEmpty');
  const detail = document.getElementById('batchDetail');
  const batch = demoBatchData.find(b => b.id === batchId);
  if (!batch) return;

  if (grid) grid.style.display = 'none';
  if (empty) empty.style.display = 'none';
  if (detail) detail.style.display = '';

  const batchSearch = document.querySelector('#page-batches .section-search-input');
  if (batchSearch) {
    batchSearch.dataset.filter = 'batchDetailStudents';
    batchSearch.placeholder = 'Search students...';
    batchSearch.value = '';
  }

  const initials = batch.teacher ? batch.teacher.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') : '';

  const header = document.getElementById('batchDetailHeader');
  header.innerHTML = `
    <h2>${escapeHtml(batch.name)}</h2>
    <div class="batch-detail-meta">
      ${batch.schedule ? `<span class="batch-detail-meta-item"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>${escapeHtml(batch.schedule)}</span>` : ''}
      ${batch.fee ? `<span class="batch-detail-meta-item"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>\u20B9${batch.fee.toLocaleString('en-IN')}/mo</span>` : ''}
    </div>
    ${batch.teacher ? `
    <div class="batch-detail-teacher">
      <span class="batch-teacher-avatar">${initials}</span>
      <span class="batch-detail-teacher-label">Assigned Teacher</span>
      <span class="batch-detail-teacher-name">${escapeHtml(batch.teacher)}</span>
    </div>` : `
    <div class="batch-detail-teacher batch-detail-teacher-unassigned">
      <span class="batch-teacher-avatar"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg></span>
      <span class="batch-detail-teacher-label">Assigned Teacher</span>
      <span class="batch-detail-teacher-name batch-detail-teacher-unassigned-name">No teacher assigned</span>
    </div>`}
  `;

  const tbody = document.getElementById('batchDetailStudents');
  const emptyEl = document.getElementById('batchDetailEmpty');

  if (!batch.students || batch.students.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'flex';
  } else {
    emptyEl.style.display = 'none';
    tbody.innerHTML = batch.students.map(s => {
      const pct = s.attendance;
      const attColor = pct >= 75 ? '#4ADE80' : pct >= 50 ? '#FBBF24' : '#F87171';
      return `
      <tr>
        <td data-label="Name"><span class="page-table-name">${escapeHtml(s.full_name || '\u2014')}</span></td>
        <td data-label="Phone">${escapeHtml(s.phone || '\u2014')}</td>
        <td data-label="Joined">${s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'}</td>
        <td data-label="Attendance" style="color:${attColor};font-weight:600">${pct}%</td>
      </tr>
    `}).join('');
  }
}

// ── Demo mode: data for all other sections ──

const demoTeachersData = [
  { id: 'demo-t1', full_name: 'Rahul Sharma', email: 'rahul.sharma@demo.pingclass.com', role: 'teacher', status: 'active', created_at: '2025-03-18T00:00:00' },
  { id: 'demo-t2', full_name: 'Priya Patel', email: 'priya.patel@demo.pingclass.com', role: 'teacher', status: 'active', created_at: '2025-03-25T00:00:00' },
  { id: 'demo-t3', full_name: 'Amit Verma', email: 'amit.verma@demo.pingclass.com', role: 'teacher', status: 'active', created_at: '2025-04-02T00:00:00' },
  { id: 'demo-t4', full_name: 'Sneha Iyer', email: 'sneha.iyer@demo.pingclass.com', role: 'teacher', status: 'active', created_at: '2025-04-10T00:00:00' },
  { id: 'demo-t5', full_name: 'Vikram Singh', email: 'vikram.singh@demo.pingclass.com', role: 'teacher', status: 'active', created_at: '2025-04-22T00:00:00' },
  { id: 'demo-t6', full_name: 'Kavita Nair', email: 'kavita.nair@demo.pingclass.com', role: 'teacher', status: 'invited', created_at: '2025-05-01T00:00:00' }
];

const demoParentsData = [
  { id: 'demo-p1', full_name: 'Sunita Mehta', email: 'sunita.mehta@demo.pingclass.com', role: 'parent', student: 'Arjun Mehta', status: 'active', created_at: '2025-04-14T00:00:00' },
  { id: 'demo-p2', full_name: 'Rajesh Gupta', email: 'rajesh.gupta@demo.pingclass.com', role: 'parent', student: 'Ishita Gupta', status: 'active', created_at: '2025-04-16T00:00:00' },
  { id: 'demo-p3', full_name: 'Farah Khan', email: 'farah.khan@demo.pingclass.com', role: 'parent', student: 'Kabir Khan', status: 'active', created_at: '2025-05-03T00:00:00' },
  { id: 'demo-p4', full_name: 'Ganesh Nair', email: 'ganesh.nair@demo.pingclass.com', role: 'parent', student: 'Meera Nair', status: 'active', created_at: '2025-05-10T00:00:00' },
  { id: 'demo-p5', full_name: 'Manish Joshi', email: 'manish.joshi@demo.pingclass.com', role: 'parent', student: 'Rohan Joshi', status: 'active', created_at: '2025-04-09T00:00:00' },
  { id: 'demo-p6', full_name: 'Divya Rao', email: 'divya.rao@demo.pingclass.com', role: 'parent', student: 'Ananya Rao', status: 'active', created_at: '2025-04-21T00:00:00' },
  { id: 'demo-p7', full_name: 'Harish Patel', email: 'harish.patel@demo.pingclass.com', role: 'parent', student: 'Dev Patel', status: 'invited', created_at: '2025-05-02T00:00:00' },
  { id: 'demo-p8', full_name: 'Neha Kapoor', email: 'neha.kapoor@demo.pingclass.com', role: 'parent', student: 'Saanvi Kapoor', status: 'active', created_at: '2025-04-19T00:00:00' }
];

function demoAttStatusFor(studentId, date) {
  const key = studentId + '|' + date;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const r = h % 10;
  return r < 7 ? 'present' : r < 9 ? 'absent' : 'unmarked';
}

function buildDemoStudents() {
  const list = [];
  demoBatchData.forEach(b => {
    (b.students || []).forEach(s => {
      list.push({ id: s.id, full_name: s.full_name, phone: s.phone, created_at: s.created_at, batches: [b.name] });
    });
  });
  return list;
}

function buildDemoPayments() {
  const payments = [];
  demoBatchData.forEach(b => {
    (b.students || []).forEach((s, idx) => {
      const paid = idx % 2 === 0;
      payments.push({
        id: 'demo-pay-' + s.id,
        student_id: s.id,
        batch_id: b.id,
        amount: b.fee,
        status: paid ? 'paid' : 'pending',
        due_date: '2025-08-05T00:00:00',
        paid_at: paid ? '2025-07-25T10:00:00' : null
      });
    });
  });
  return payments;
}

function demoAttOverallPct(studentId) {
  let present = 0, marked = 0;
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const st = demoAttStatusFor(studentId, toDateKey(d));
    if (st === 'present' || st === 'absent') {
      marked++;
      if (st === 'present') present++;
    }
  }
  return marked > 0 ? Math.round((present / marked) * 100) : null;
}

function renderDemoStudents() {
  const students = buildDemoStudents();
  const instBatches = demoBatchData.map(b => ({ id: b.id, name: b.name }));
  const batchMap = {};
  const studentBatchIds = {};
  students.forEach(s => {
    batchMap[s.id] = s.batches;
    studentBatchIds[s.id] = demoBatchData.filter(b => (b.students || []).some(st => st.id === s.id)).map(b => b.id);
  });

  setCustomSelectOptions('studentBatchFilter', [{value:'', label:'All Batches'}, ...instBatches.map(b => ({value:b.id, label:b.name}))], getCustomSelectValue('studentBatchFilter'));

  pageDataCache['students'] = { students, studentBatchIds, batchMap, instBatches };
  window._studentsData = students;
  window._studentBatchIds = studentBatchIds;

  renderStudentsTable(students, studentBatchIds, batchMap);
  updateStudentLimitUI(students.length);
}

function renderDemoStaff() {
  allStaff = demoTeachersData.map(u => ({
    id: u.id, name: u.full_name, email: u.email, role: u.role, status: u.status, joined: u.created_at
  }));
  pageDataCache['staff'] = [...allStaff];
  renderStaffTable(allStaff);
  updateStaffLimitUI();
}

function renderDemoParents() {
  allParents = demoParentsData.map(p => ({
    id: p.id, name: p.full_name, email: p.email, role: 'parent', student: p.student, status: p.status, joined: p.created_at
  }));
  pageDataCache['parents'] = [...allParents];
  renderParentsTable(allParents);
}

function loadDemoFeesSummary(batchId) {
  let payments = buildDemoPayments();
  if (batchId) payments = payments.filter(p => p.batch_id === batchId);
  let pending = 0, collected = 0;
  payments.forEach(p => {
    if (p.status === 'paid') collected += p.amount || 0;
    else pending += p.amount || 0;
  });
  document.getElementById('feesPendingTotal').textContent = '\u20B9' + pending.toLocaleString('en-IN');
  document.getElementById('feesCollectedTotal').textContent = '\u20B9' + collected.toLocaleString('en-IN');
}

function renderDemoFees() {
  selectedFeeBatchId = null;
  document.getElementById('feesBatchList').style.display = '';
  document.getElementById('feesBatchDetail').style.display = 'none';
  document.getElementById('addFeeBtn').style.display = 'none';

  const feesSearch = document.querySelector('#page-fees .section-search-input');
  if (feesSearch) {
    feesSearch.dataset.filter = 'feesBatchesGrid';
    feesSearch.placeholder = 'Search batches...';
    feesSearch.value = '';
  }

  const batches = demoBatchData.map(b => ({ id: b.id, name: b.name, schedule: b.schedule }));
  const feeMap = {};
  const studentCountMap = {};
  demoBatchData.forEach(b => {
    feeMap[b.id] = b.fee;
    studentCountMap[b.id] = (b.students || []).length;
  });
  const allPayments = buildDemoPayments();

  pageDataCache['fees'] = { batches, feeMap, studentCountMap, allPayments };
  renderFeesBatchList(batches, feeMap, studentCountMap, allPayments);
  loadDemoFeesSummary(null);
}

function showDemoBatchFees(batchId) {
  selectedFeeBatchId = batchId;
  document.getElementById('feesBatchList').style.display = 'none';
  document.getElementById('feesBatchDetail').style.display = '';
  document.getElementById('addFeeBtn').style.display = '';
  setCustomSelectValue('feesFilterSelect', 'all');

  const feesSearch = document.querySelector('#page-fees .section-search-input');
  if (feesSearch) {
    feesSearch.dataset.filter = 'feesTableBody';
    feesSearch.placeholder = 'Search students...';
    feesSearch.value = '';
  }

  const batch = demoBatchData.find(b => b.id === batchId);
  const feeRow = batch ? { amount: batch.fee, frequency: batch.frequency } : null;

  currentBatchNameMap = {};
  (batch?.students || []).forEach(s => { currentBatchNameMap[s.id] = s.full_name; });
  currentBatchPayments = buildDemoPayments()
    .filter(p => p.batch_id === batchId)
    .sort((a, b) => {
      const nameA = (currentBatchNameMap[a.student_id] || '').toLowerCase();
      const nameB = (currentBatchNameMap[b.student_id] || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

  const paidStudents = new Set(currentBatchPayments.filter(p => p.status === 'paid').map(p => p.student_id));
  const totalStudents = (batch?.students || []).length;
  const paidCount = paidStudents.size;
  const unpaidCount = totalStudents - paidCount;

  document.getElementById('feesBatchHeader').innerHTML = `
    <div class="fees-batch-header-info">
      <div class="fees-batch-header-name">${escapeHtml(batch?.name || '')}</div>
      <div class="fees-batch-header-meta">
        ${batch?.schedule ? '<span>' + escapeHtml(batch.schedule) + '</span>' : ''}
        ${feeRow ? '<span>\u20B9' + feeRow.amount.toLocaleString('en-IN') + '/' + feeRow.frequency + '</span>' : '<span>No fee set</span>'}
      </div>
    </div>
    <div class="fees-batch-header-stats">
      <span><strong>${totalStudents}</strong> students</span>
      <span style="color:#4ADE80"><strong>${paidCount}</strong> paid</span>
      <span style="color:#FBBF24"><strong>${unpaidCount}</strong> unpaid</span>
    </div>
  `;

  loadDemoFeesSummary(batchId);
  renderFeesTable();
}

function updateDemoAttDateDisplay() {
  const today = toDateKey(new Date());
  const display = document.getElementById('attDateDisplay');
  display.textContent = attCurrentDate === today ? 'Today' : new Date(attCurrentDate + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
}

function renderDemoAttendance() {
  attSelectedBatchId = null;
  document.getElementById('attBatchList').style.display = '';
  document.getElementById('attBatchDetail').style.display = 'none';

  const attSearch = document.querySelector('#page-attendance .section-search-input');
  if (attSearch) {
    attSearch.dataset.filter = 'attBatchesGrid';
    attSearch.placeholder = 'Search batches...';
    attSearch.value = '';
  }
  updateDemoAttDateDisplay();

  const batches = demoBatchData.map(b => ({ id: b.id, name: b.name, schedule: b.schedule }));
  const sbRows = [];
  const attMap = {};
  demoBatchData.forEach(b => {
    (b.students || []).forEach(s => {
      sbRows.push({ batch_id: b.id, student_id: s.id });
      attMap[s.id] = demoAttStatusFor(s.id, attCurrentDate);
    });
  });

  pageDataCache['attendance_' + attCurrentDate] = { batches, sbRows, attMap };
  renderAttBatchCards(batches, sbRows, attMap);
}

function showDemoAttBatchDetail(batchId) {
  attSelectedBatchId = batchId;
  document.getElementById('attBatchList').style.display = 'none';
  document.getElementById('attBatchDetail').style.display = '';
  setCustomSelectValue('attFilterSelect', 'all');

  const attSearch = document.querySelector('#page-attendance .section-search-input');
  if (attSearch) {
    attSearch.dataset.filter = 'attTableBody';
    attSearch.placeholder = 'Search students...';
    attSearch.value = '';
  }
  updateDemoAttDateDisplay();

  const batch = demoBatchData.find(b => b.id === batchId);
  attBatchStudents = (batch?.students || []).map(s => ({ id: s.id, full_name: s.full_name }));
  naturalNameSort(attBatchStudents);
  attBatchAttMap = {};
  attBatchStudents.forEach(s => { attBatchAttMap[s.id] = demoAttStatusFor(s.id, attCurrentDate); });

  // Overall attendance: per-student percentage + batch rate
  let batchMarked = 0, batchPresent = 0;
  attBatchStudents.forEach(s => {
    s.attPct = demoAttOverallPct(s.id);
    if (s.attPct != null) {
      batchMarked++;
      batchPresent += s.attPct;
    }
  });
  const batchOverallRate = batchMarked > 0 ? Math.round(batchPresent / batchMarked) : null;
  const rateColor = batchOverallRate == null ? '#94A3B8' : batchOverallRate >= 75 ? '#4ADE80' : batchOverallRate >= 50 ? '#FBBF24' : '#F87171';

  let present = 0, absent = 0, unmarked = 0;
  attBatchStudents.forEach(s => {
    const st = attBatchAttMap[s.id];
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else unmarked++;
  });
  const total = attBatchStudents.length;

  document.getElementById('attBatchHeader').innerHTML = `
    <div class="fees-batch-header-top">
      <div class="fees-batch-header-info">
        <div class="fees-batch-header-name">${escapeHtml(batch?.name || '')}</div>
        <div class="fees-batch-header-meta">
          ${batch?.schedule ? '<span>' + escapeHtml(batch.schedule) + '</span>' : ''}
          <span>${total} student${total !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="fees-batch-header-rate" style="color:${rateColor}" title="Overall attendance">${batchOverallRate != null ? batchOverallRate + '%' : '--'}</div>
    </div>
    <div class="fees-batch-header-stats">
      <div class="fees-batch-stat"><div class="fees-batch-stat-value" style="color:#4ADE80">${present}</div><div class="fees-batch-stat-label">Present</div></div>
      <div class="fees-batch-stat"><div class="fees-batch-stat-value" style="color:#F87171">${absent}</div><div class="fees-batch-stat-label">Absent</div></div>
      <div class="fees-batch-stat"><div class="fees-batch-stat-value" style="color:#94A3B8">${unmarked}</div><div class="fees-batch-stat-label">Unmarked</div></div>
    </div>
  `;

  renderAttTable();
}

function renderDemoAnnouncements() {
  resetAnnouncementsPager();
  setAnnouncementsLoadMore(false);
  pageDataCache['announcements'] = { list: demoAnnouncements, hasMore: false };
  renderAnnouncements(demoAnnouncements);
}

function renderDemoSettings() {
  document.getElementById('settingsInstName').value = 'Demo Institute';
  document.getElementById('settingsInstEmail').value = 'hello@demo.pingclass.com';
  document.getElementById('settingsInstPhone').value = '+91 98765 43210';
  document.getElementById('settingsInstAddress').value = '12, MG Road, Bengaluru, Karnataka 560001';
  document.getElementById('settingsAdminName').value = 'Demo User';
  document.getElementById('settingsAdminEmail').value = 'demo@pingclass.com';
  document.getElementById('settingsAdminRole').value = 'Admin';
  document.getElementById('settingsPlanBadge').textContent = 'Free';
  document.getElementById('settingsPlanDetail').textContent = 'Demo preview \u00B7 all features unlocked';
  document.getElementById('toggleFeeReminders').checked = true;
  document.getElementById('toggleAttendanceAlerts').checked = true;
  document.getElementById('toggleAnnouncements').checked = true;
}

function renderDemoBilling() {
  document.getElementById('billingPlanName').textContent = 'Free';
  document.getElementById('billingPlanDetail').textContent = 'Demo preview \u00B7 all features unlocked';
  document.getElementById('billingExpiry').textContent = 'Demo mode \u00B7 No subscription';
  const statusEl = document.getElementById('billingStatus');
  if (statusEl) statusEl.innerHTML = '<span class="billing-dot"></span>Demo';

  const studentCount = buildDemoStudents().length;
  document.getElementById('usageStudents').textContent = `${studentCount} / \u221E`;
  document.getElementById('usageStudentsBar').style.width = '42%';
  document.getElementById('usageBatches').textContent = `${demoBatchData.length} / \u221E`;
  document.getElementById('usageBatchesBar').style.width = '50%';
  document.getElementById('usageTeachers').textContent = `${demoTeachersData.length} / \u221E`;
  document.getElementById('usageTeachersBar').style.width = '60%';
}

async function populateBatchesPage() {
  if (isDemoMode) {
    renderDemoBatches();
    return;
  }

  if (!currentInstitute?.id) return;

  const detail = document.getElementById('batchDetail');
  if (detail) detail.style.display = 'none';

  // Restore search to batch card mode
  const batchSearch = document.querySelector('#page-batches .section-search-input');
  if (batchSearch) {
    batchSearch.dataset.filter = 'batchesGrid';
    batchSearch.placeholder = 'Search batches...';
    batchSearch.value = '';
  }

  const grid = document.getElementById('batchesGrid');
  const empty = document.getElementById('batchesEmpty');

  if (pageDataCache['batches']) {
    const c = pageDataCache['batches'];
    renderBatchCards(c.batches, c.feeMap, c.countMap, c.teacherMap);
    updateBatchLimitUI(c.batches.length);
    return;
  }

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('id, name, schedule, teacher_id').eq('institute_id', currentInstitute.id).is('deleted_at', null).order('name')
  );
  if (!batchesRes.ok) { showSectionFallback('page-batches', batchesRes.error, { retry: () => populateBatchesPage() }); return; }
  const batches = batchesRes.data;

  let feeMap = {};
  let countMap = {};
  let teacherMap = {};
  if (batches && batches.length > 0) {
    const batchIds = batches.map(b => b.id);
    const teacherIds = [...new Set(batches.map(b => b.teacher_id).filter(Boolean))];

    const feeRes = await safeQuery(() =>
      db.from('fees').select('batch_id, amount').in('batch_id', batchIds)
    );
    if (feeRes.ok) (feeRes.data || []).forEach(f => { feeMap[f.batch_id] = f.amount; });

    const countRes = await safeQuery(() =>
      db.from('student_batches').select('batch_id').in('batch_id', batchIds)
    );
    if (countRes.ok) (countRes.data || []).forEach(c => {
      countMap[c.batch_id] = (countMap[c.batch_id] || 0) + 1;
    });

    if (teacherIds.length > 0) {
      const teacherRes = await safeQuery(() =>
        db.from('users').select('id, full_name, email').in('id', teacherIds)
      );
      if (teacherRes.ok) (teacherRes.data || []).forEach(t => { teacherMap[t.id] = t.full_name || t.email; });
    }
  }

  pageDataCache['batches'] = { batches: batches || [], feeMap, countMap, teacherMap };

  renderBatchCards(batches || [], feeMap, countMap, teacherMap);
  updateBatchLimitUI(batches?.length || 0);
}

function renderBatchCards(batches, feeMap, countMap, teacherMap) {
  const grid = document.getElementById('batchesGrid');
  const empty = document.getElementById('batchesEmpty');

  if (!batches || batches.length === 0) {
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
  } else {
    if (grid) grid.style.display = '';
    if (empty) empty.style.display = 'none';
  }

  if (grid && batches.length > 0) {
    grid.innerHTML = batches.map(b => {
      const fee = feeMap[b.id] || 0;
      const teacherName = b.teacher_id ? teacherMap[b.teacher_id] : null;
      const initials = teacherName ? teacherName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') : '';
      return `
      <div class="batch-card" style="cursor:pointer" onclick="showBatchDetail('${b.id}')">
        <div class="batch-card-header">
          <h3>${escapeHtml(b.name)}</h3>
          <div class="batch-card-actions">
            <button class="staff-action-btn" onclick="event.stopPropagation();editBatch('${b.id}')">Edit</button>
            <button class="staff-action-btn staff-action-btn-resend" onclick="event.stopPropagation();deleteBatch('${b.id}')">Delete</button>
          </div>
        </div>
        <div class="batch-card-meta">
          ${b.schedule ? `<span class="batch-meta-item"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>${escapeHtml(b.schedule)}</span>` : ''}
          ${fee ? `<span class="batch-meta-item"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>\u20B9${fee.toLocaleString('en-IN')}/mo</span>` : ''}
        </div>
        ${teacherName ? `
        <div class="batch-card-teacher">
          <span class="batch-teacher-avatar">${escapeHtml(initials)}</span>
          <span class="batch-card-teacher-info">
            <span class="batch-card-teacher-label">Assigned Teacher</span>
            <span class="batch-card-teacher-name">${escapeHtml(teacherName)}</span>
          </span>
        </div>` : `
        <div class="batch-card-teacher batch-card-teacher-unassigned">
          <span class="batch-teacher-avatar"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg></span>
          <span class="batch-card-teacher-info">
            <span class="batch-card-teacher-label">Assigned Teacher</span>
            <span class="batch-card-teacher-name batch-card-teacher-unassigned-name">No teacher assigned</span>
          </span>
        </div>`}
        <div class="batch-card-count">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          ${countMap[b.id] || 0} students
        </div>
      </div>
    `}).join('');
  }
}

function updateBatchLimitUI(count) {
  const maxDisplay = planLimits.max_batches === 999999 ? '∞' : planLimits.max_batches;
  const addBtn = document.getElementById('addBatchBtn');
  if (addBtn) {
    if (count >= planLimits.max_batches) {
      addBtn.disabled = true;
      addBtn.title = `Batch limit reached (${maxDisplay}). Upgrade to add more.`;
      addBtn.textContent = `Limit Reached (${maxDisplay})`;
    } else {
      addBtn.disabled = false;
      addBtn.title = '';
      addBtn.textContent = 'Add Batch';
    }
  }
  const existing = document.getElementById('batchLimitBadge');
  if (existing) existing.remove();
  const badge = document.createElement('span');
  badge.id = 'batchLimitBadge';
  badge.style.cssText = 'font-size:0.75rem;font-weight:600;color:var(--text-muted);background:rgba(255,255,255,0.06);border:1px solid var(--card-border);border-radius:8px;padding:4px 10px;white-space:nowrap;';
  badge.textContent = `${count} / ${maxDisplay} batches`;
  const header = document.querySelector('#page-batches .page-header .welcome');
  if (header) header.appendChild(badge);
}

// ── Batch Detail View ──

async function showBatchDetail(batchId) {
  const grid = document.getElementById('batchesGrid');
  const empty = document.getElementById('batchesEmpty');
  const detail = document.getElementById('batchDetail');
  if (!detail) return;

  if (isDemoMode) {
    showDemoBatchDetail(batchId);
    return;
  }

  grid.style.display = 'none';
  if (empty) empty.style.display = 'none';
  detail.style.display = '';

  // Switch search to student mode
  const batchSearch = document.querySelector('#page-batches .section-search-input');
  if (batchSearch) {
    batchSearch.dataset.filter = 'batchDetailStudents';
    batchSearch.placeholder = 'Search students...';
    batchSearch.value = '';
  }

  const batchRes = await safeQuery(() =>
    db.from('batches').select('id, name, schedule, teacher_id').eq('id', batchId).single()
  );
  if (!batchRes.ok || !batchRes.data) return;
  const batch = batchRes.data;

  const feeRes = await safeQuery(() => db.from('fees').select('amount, frequency').eq('batch_id', batchId).single());
  const feeRow = feeRes.ok ? feeRes.data : null;

  let teacherName = null;
  if (batch.teacher_id) {
    const teacherRes = await safeQuery(() => db.from('users').select('full_name, email').eq('id', batch.teacher_id).single());
    if (teacherRes.ok) teacherName = teacherRes.data?.full_name || teacherRes.data?.email || null;
  }

  const header = document.getElementById('batchDetailHeader');
  header.innerHTML = `
    <h2>${escapeHtml(batch.name)}</h2>
    <div class="batch-detail-meta">
      ${batch.schedule ? `<span class="batch-detail-meta-item"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>${escapeHtml(batch.schedule)}</span>` : ''}
      ${feeRow ? `<span class="batch-detail-meta-item"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>\u20B9${feeRow.amount.toLocaleString('en-IN')}/${feeRow.frequency === 'yearly' ? 'yr' : feeRow.frequency === 'quarterly' ? 'qr' : 'mo'}</span>` : ''}
    </div>
    ${teacherName ? `
    <div class="batch-detail-teacher">
      <span class="batch-teacher-avatar">${escapeHtml(teacherName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''))}</span>
      <span class="batch-detail-teacher-label">Assigned Teacher</span>
      <span class="batch-detail-teacher-name">${escapeHtml(teacherName)}</span>
    </div>` : `
    <div class="batch-detail-teacher batch-detail-teacher-unassigned">
      <span class="batch-teacher-avatar"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg></span>
      <span class="batch-detail-teacher-label">Assigned Teacher</span>
      <span class="batch-detail-teacher-name batch-detail-teacher-unassigned-name">No teacher assigned</span>
    </div>`}
  `;

  const sbRes = await safeQuery(() => db.from('student_batches').select('student_id, enrolled_at').eq('batch_id', batchId));
  const sbRows = sbRes.ok ? sbRes.data : [];
  const studentIds = sbRows.map(r => r.student_id);
  const enrollMap = {};
  sbRows.forEach(r => { enrollMap[r.student_id] = r.enrolled_at; });

  const tbody = document.getElementById('batchDetailStudents');
  const emptyEl = document.getElementById('batchDetailEmpty');

  if (studentIds.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'flex';
  } else {
    emptyEl.style.display = 'none';
    const studentsRes = await safeQuery(() => db.from('students').select('id, full_name, phone, created_at').in('id', studentIds).is('deleted_at', null));
    const students = studentsRes.ok ? studentsRes.data : [];
    naturalNameSort(students || []);

    const attRes = await safeQuery(() =>
      db.from('attendance').select('student_id, status').in('student_id', studentIds).eq('batch_id', batchId)
    );
    const attMap = {};
    (attRes.ok ? attRes.data : []).forEach(a => {
      if (!attMap[a.student_id]) attMap[a.student_id] = { total: 0, present: 0 };
      attMap[a.student_id].total++;
      if (a.status === 'present' || a.status === 'late') attMap[a.student_id].present++;
    });

    tbody.innerHTML = (students || []).map(s => {
      const att = attMap[s.id];
      const pct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;
      const attColor = pct !== null ? (pct >= 75 ? '#4ADE80' : pct >= 50 ? '#FBBF24' : '#F87171') : 'var(--text-muted)';
      return `
      <tr>
        <td data-label="Name"><span class="page-table-name">${escapeHtml(s.full_name || '\u2014')}</span></td>
        <td data-label="Phone">${escapeHtml(s.phone || '\u2014')}</td>
        <td data-label="Joined">${s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'}</td>
        <td data-label="Attendance" style="color:${attColor};font-weight:600">${pct !== null ? pct + '%' : '\u2014'}</td>
      </tr>
    `}).join('');
  }
}

function hideBatchDetail() {
  document.getElementById('batchDetail').style.display = 'none';
  document.getElementById('batchesGrid').style.display = '';
  const empty = document.getElementById('batchesEmpty');
  if (empty && document.querySelectorAll('#batchesGrid .batch-card').length === 0) {
    empty.style.display = 'flex';
  }

  // Restore search to batch card mode
  const batchSearch = document.querySelector('#page-batches .section-search-input');
  if (batchSearch) {
    batchSearch.dataset.filter = 'batchesGrid';
    batchSearch.placeholder = 'Search batches...';
    batchSearch.value = '';
  }
}

document.getElementById('batchDetailBack')?.addEventListener('click', hideBatchDetail);

// ── Fees Page ──

let selectedFeeBatchId = null;

async function populateFeesPage() {
  if (isDemoMode) {
    renderDemoFees();
    return;
  }

  if (!currentInstitute?.id) return;

  selectedFeeBatchId = null;
  document.getElementById('feesBatchList').style.display = '';
  document.getElementById('feesBatchDetail').style.display = 'none';
  document.getElementById('addFeeBtn').style.display = 'none';

  // Restore search to batch card mode
  const feesSearch = document.querySelector('#page-fees .section-search-input');
  if (feesSearch) {
    feesSearch.dataset.filter = 'feesBatchesGrid';
    feesSearch.placeholder = 'Search batches...';
    feesSearch.value = '';
  }

  if (pageDataCache['fees']) {
    const c = pageDataCache['fees'];
    renderFeesBatchList(c.batches, c.feeMap, c.studentCountMap, c.allPayments);
    loadFeesSummary(null);
    return;
  }

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('id, name, schedule').eq('institute_id', currentInstitute.id).order('name')
  );
  if (!batchesRes.ok) { showSectionFallback('page-fees', batchesRes.error, { retry: () => populateFeesPage() }); return; }
  const batches = batchesRes.data;

  const grid = document.getElementById('feesBatchesGrid');
  const empty = document.getElementById('feesEmpty');

  if (!batches || batches.length === 0) {
    if (grid) { grid.innerHTML = ''; grid.style.display = 'none'; }
    if (empty) empty.style.display = 'flex';
    loadFeesSummary(null);
    return;
  }

  const batchIds = batches.map(b => b.id);

  const feeRes = await safeQuery(() => db.from('fees').select('batch_id, amount').in('batch_id', batchIds));
  const feeMap = {};
  if (feeRes.ok) (feeRes.data || []).forEach(f => { feeMap[f.batch_id] = f.amount; });

  const sbRes = await safeQuery(() => db.from('student_batches').select('batch_id, student_id').in('batch_id', batchIds));
  const studentCountMap = {};
  if (sbRes.ok) (sbRes.data || []).forEach(r => {
    studentCountMap[r.batch_id] = (studentCountMap[r.batch_id] || 0) + 1;
  });

  const payRes = await safeQuery(() => db.from('payments').select('amount, status, student_id, batch_id').eq('institute_id', currentInstitute.id).in('batch_id', batchIds));
  const allPayments = payRes.ok ? payRes.data : [];

  pageDataCache['fees'] = { batches, feeMap, studentCountMap, allPayments };
  renderFeesBatchList(batches, feeMap, studentCountMap, allPayments);
  loadFeesSummary(null);
}

function renderFeesBatchList(batches, feeMap, studentCountMap, allPayments) {
  const grid = document.getElementById('feesBatchesGrid');
  const empty = document.getElementById('feesEmpty');
  if (!grid) return;

  if (!batches || batches.length === 0) {
    grid.innerHTML = ''; grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  grid.style.display = '';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = batches.map(b => {
    const fee = feeMap[b.id] || 0;
    const studentCount = studentCountMap[b.id] || 0;
    let collected = 0, pending = 0;
    const paidStudents = new Set();
    allPayments.filter(p => p.batch_id === b.id).forEach(p => {
      if (p.status === 'paid') { collected += p.amount || 0; if (p.student_id) paidStudents.add(p.student_id); }
      else pending += p.amount || 0;
    });
    const paidCount = paidStudents.size;
    const unpaidCount = Math.max(0, studentCount - paidCount);
    return `
    <div class="fee-batch-card" onclick="showBatchFees('${b.id}')">
      <div class="fee-batch-card-name">${escapeHtml(b.name)}</div>
      <div class="fee-batch-card-fee">${fee ? '\u20B9' + fee.toLocaleString('en-IN') + '/month' : 'No fee set'}</div>
      <div class="fee-batch-card-stats">
        <span class="fee-batch-card-stat"><strong>${studentCount}</strong> students</span>
        <span class="fee-batch-card-stat" style="color:#4ADE80"><strong>${paidCount}</strong> paid</span>
        <span class="fee-batch-card-stat" style="color:#FBBF24"><strong>${unpaidCount}</strong> unpaid</span>
      </div>
    </div>`;
  }).join('');
}

async function loadFeesSummary(batchId) {
  if (!currentInstitute?.id) return;

  let query = db.from('payments').select('amount, status, batch_id').eq('institute_id', currentInstitute.id);
  if (batchId) query = query.eq('batch_id', batchId);
  const payRes = await safeQuery(() => query);
  const payments = payRes.ok ? payRes.data : [];

  let pending = 0, collected = 0;
  (payments || []).forEach(p => {
    if (p.status === 'paid') collected += p.amount || 0;
    else pending += p.amount || 0;
  });

  document.getElementById('feesPendingTotal').textContent = '\u20B9' + pending.toLocaleString('en-IN');
  document.getElementById('feesCollectedTotal').textContent = '\u20B9' + collected.toLocaleString('en-IN');
}

let currentBatchPayments = [];
let currentBatchNameMap = {};

async function showBatchFees(batchId, keepFilter) {
  if (isDemoMode) {
    showDemoBatchFees(batchId);
    return;
  }

  selectedFeeBatchId = batchId;
  document.getElementById('feesBatchList').style.display = 'none';
  document.getElementById('feesBatchDetail').style.display = '';
  document.getElementById('addFeeBtn').style.display = '';
  if (!keepFilter) setCustomSelectValue('feesFilterSelect', 'all');

  // Switch search to payment mode
  const feesSearch = document.querySelector('#page-fees .section-search-input');
  if (feesSearch) {
    feesSearch.dataset.filter = 'feesTableBody';
    feesSearch.placeholder = 'Search students...';
    feesSearch.value = '';
  }

  const batchRes = await safeQuery(() => db.from('batches').select('id, name, schedule').eq('id', batchId).single());
  if (!batchRes.ok) { showSectionFallback('page-fees', batchRes.error, { retry: () => showBatchFees(batchId) }); return; }
  const batch = batchRes.data;

  const feeRes = await safeQuery(() => db.from('fees').select('amount, frequency').eq('batch_id', batchId).single());
  const feeRow = feeRes.ok ? feeRes.data : null;

  const sbRes = await safeQuery(() => db.from('student_batches').select('student_id').eq('batch_id', batchId));
  const studentIds = (sbRes.ok ? sbRes.data : []).map(r => r.student_id);

  const namesRes = await safeQuery(() => db.from('students').select('id, full_name').in('id', studentIds).is('deleted_at', null));
  const studentNames = namesRes.ok ? namesRes.data : [];
  naturalNameSort(studentNames || []);
  currentBatchNameMap = {};
  (studentNames || []).forEach(s => { currentBatchNameMap[s.id] = s.full_name; });

  const payRes = await safeQuery(() => db.from('payments').select('id, student_id, amount, status, due_date, paid_at, batch_id').eq('batch_id', batchId));
  currentBatchPayments = (payRes.ok ? payRes.data : []).sort((a, b) => {
    const nameA = (currentBatchNameMap[a.student_id] || '').toLowerCase();
    const nameB = (currentBatchNameMap[b.student_id] || '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Count paid vs unpaid students
  const paidStudents = new Set();
  currentBatchPayments.forEach(p => { if (p.status === 'paid' && p.student_id) paidStudents.add(p.student_id); });
  const totalStudents = studentIds.length;
  const paidCount = paidStudents.size;
  const unpaidCount = totalStudents - paidCount;

  document.getElementById('feesBatchHeader').innerHTML = `
    <div class="fees-batch-header-info">
      <div class="fees-batch-header-name">${escapeHtml(batch?.name || '')}</div>
      <div class="fees-batch-header-meta">
        ${batch?.schedule ? '<span>' + escapeHtml(batch.schedule) + '</span>' : ''}
        ${feeRow ? '<span>\u20B9' + feeRow.amount.toLocaleString('en-IN') + '/' + feeRow.frequency + '</span>' : '<span>No fee set</span>'}
      </div>
    </div>
    <div class="fees-batch-header-stats">
      <span><strong>${totalStudents}</strong> students</span>
      <span style="color:#4ADE80"><strong>${paidCount}</strong> paid</span>
      <span style="color:#FBBF24"><strong>${unpaidCount}</strong> unpaid</span>
    </div>
  `;

  loadFeesSummary(batchId);
  renderFeesTable();
}

function renderFeesTable() {
  const filter = getCustomSelectValue('feesFilterSelect');
  const tbody = document.getElementById('feesTableBody');
  const empty = document.getElementById('feesDetailEmpty');
  const table = document.querySelector('#feesBatchDetail .page-table');

  let filtered = currentBatchPayments;
  if (filter === 'paid') filtered = filtered.filter(p => p.status === 'paid');
  else if (filter === 'pending') filtered = filtered.filter(p => p.status !== 'paid');

  if (filtered.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) {
      empty.style.display = 'flex';
      empty.innerHTML = `<div class="empty-state-icon" style="font-size:2.5rem;margin-bottom:0.5rem;">\u20B9</div><div>No ${filter === 'all' ? '' : filter + ' '}payment records found.</div>`;
    }
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(p => {
    const name = currentBatchNameMap[p.student_id] || '\u2014';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const isPaid = p.status === 'paid';
    const statusClass = isPaid ? 'staff-status-active' : 'staff-status-invited';
    const statusLabel = isPaid ? 'Paid' : 'Pending';
    const dueStr = p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
    const paidStr = p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';

    let actionHtml = '';
    if (!isPaid) {
      actionHtml = `<button class="staff-action-btn" onclick="markFeePaid('${p.id}')">Mark Paid</button>`;
    }

    return `<tr>
      <td data-label="Student">
        <div class="staff-name">
          <div class="staff-avatar staff-avatar-teacher">${escapeHtml(initials)}</div>
          ${escapeHtml(name)}
        </div>
      </td>
      <td data-label="Amount"><span style="font-weight:600">\u20B9${(p.amount || 0).toLocaleString('en-IN')}</span></td>
      <td data-label="Status"><span class="staff-status ${statusClass}"><span class="staff-status-dot"></span>${statusLabel}</span></td>
      <td data-label="Due"><span class="staff-date">${dueStr}</span></td>
      <td data-label="Paid"><span class="staff-date">${paidStr}</span></td>
      <td class="staff-actions">${actionHtml}</td>
    </tr>`;
  }).join('');
}

document.getElementById('feesBackBtn')?.addEventListener('click', () => populateFeesPage());

let pendingPaidId = null;

async function markFeePaid(id) {
  pendingPaidId = id;
  document.getElementById('confirmPaidModal').classList.add('open');
}

document.getElementById('confirmPaidYes')?.addEventListener('click', async () => {
  if (!pendingPaidId) return;
  const btn = document.getElementById('confirmPaidYes');
  await withLoading(btn, async () => {
    document.getElementById('confirmPaidModal').classList.remove('open');
    await db.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', pendingPaidId);
    pendingPaidId = null;
    invalidatePageCache('fees'); invalidatePageCache('billing');
    if (selectedFeeBatchId) showBatchFees(selectedFeeBatchId, true);
    if (typeof loadStats === 'function') { invalidatePageCache('dashboard'); loadStats(); }
    if (typeof loadDashboardAnalytics === 'function') loadDashboardAnalytics();
  }, { label: 'Marking...' });
});

document.getElementById('confirmPaidCancel')?.addEventListener('click', () => {
  pendingPaidId = null;
  document.getElementById('confirmPaidModal').classList.remove('open');
});

document.getElementById('confirmPaidModalClose')?.addEventListener('click', () => {
  pendingPaidId = null;
  document.getElementById('confirmPaidModal').classList.remove('open');
});

document.getElementById('confirmPaidModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'confirmPaidModal') {
    pendingPaidId = null;
    document.getElementById('confirmPaidModal').classList.remove('open');
  }
});

// ── Modal: Add Fee ──

document.getElementById('addFeeBtn')?.addEventListener('click', async () => {
  document.getElementById('feeForm').reset();
  document.getElementById('feeError').classList.remove('visible');
  await loadBatchesForFeeModal();
  if (selectedFeeBatchId) {
    setCustomSelectValue('feeBatch', selectedFeeBatchId);
    await loadStudentsForFeeSelect(selectedFeeBatchId);
  }
  document.getElementById('feeModal').classList.add('open');
});

async function loadBatchesForFeeModal() {
  setCustomSelectOptions('feeBatch', [{value:'', label:'Loading...'}], getCustomSelectValue('feeBatch'));
  const res = await safeQuery(() => db.from('batches').select('id, name').eq('institute_id', currentInstitute.id).order('name'));
  const data = res.ok ? res.data : [];
  const options = [{value:'', label:'Select batch...'}];
  (data || []).forEach(b => {
    options.push({value:b.id, label:b.name});
  });
  setCustomSelectOptions('feeBatch', options, getCustomSelectValue('feeBatch'));
}

async function loadStudentsForFeeSelect(batchId) {
  setCustomSelectOptions('feeStudent', [{value:'', label:'Loading...'}], '');
  const sbRes = await safeQuery(() => db.from('student_batches').select('student_id').eq('batch_id', batchId));
  const studentIds = (sbRes.ok ? sbRes.data : []).map(r => r.student_id);
  if (studentIds.length === 0) {
    setCustomSelectOptions('feeStudent', [{value:'', label:'No students in this batch'}], '');
    return;
  }
  const res = await safeQuery(() => db.from('students').select('id, full_name').in('id', studentIds));
  const data = res.ok ? res.data : [];
  naturalNameSort(data || []);
  const options = [{value:'', label:'Select student...'}];
  (data || []).forEach(s => {
    options.push({value:s.id, label:s.full_name});
  });
  setCustomSelectOptions('feeStudent', options, '');
}

document.getElementById('feeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const batchId = getCustomSelectValue('feeBatch');
  const studentId = getCustomSelectValue('feeStudent');
  const amount = parseInt(document.getElementById('feeAmount').value) || 0;
  const dueDate = document.getElementById('feeDueDate').value;
  const errEl = document.getElementById('feeError');

  if (!batchId || !studentId || !amount || !dueDate) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.classList.add('visible');
    return;
  }

  const btn = e.target.querySelector('.staff-modal-submit');
  await withLoading(btn, async () => {
    const res = await safeQuery(() => db.from('payments').insert({
      student_id: studentId,
      batch_id: batchId,
      amount,
      due_date: dueDate,
      status: 'pending',
      institute_id: currentInstitute.id
    }));
    if (!res.ok) throw res.error || new Error('Failed to save fee');

    document.getElementById('feeModal').classList.remove('open');
    invalidatePageCache('fees'); invalidatePageCache('billing');
    if (selectedFeeBatchId) showBatchFees(selectedFeeBatchId);
    if (typeof loadStats === 'function') { invalidatePageCache('dashboard'); loadStats(); }
  }, { label: 'Saving...' });
});

function closeFeeModal() {
  closeAllCustomSelects();
  document.getElementById('feeModal').classList.remove('open');
}
document.getElementById('feeModalClose')?.addEventListener('click', closeFeeModal);
document.getElementById('feeModalCancel')?.addEventListener('click', closeFeeModal);
document.getElementById('feeModal')?.addEventListener('click', (e) => { if (e.target.id === 'feeModal') closeFeeModal(); });

// ── Attendance Page ──

let attCurrentDate = toDateKey(new Date());
let attSelectedBatchId = null;

async function populateAttendancePage() {
  if (isDemoMode) {
    renderDemoAttendance();
    return;
  }

  if (!currentInstitute?.id) return;

  attSelectedBatchId = null;
  document.getElementById('attBatchList').style.display = '';
  document.getElementById('attBatchDetail').style.display = 'none';

  // Restore search to batch card mode
  const attSearch = document.querySelector('#page-attendance .section-search-input');
  if (attSearch) {
    attSearch.dataset.filter = 'attBatchesGrid';
    attSearch.placeholder = 'Search batches...';
    attSearch.value = '';
  }

  const today = toDateKey(new Date());
  const display = document.getElementById('attDateDisplay');
  display.textContent = attCurrentDate === today ? 'Today' : new Date(attCurrentDate + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

  const cacheKey = 'attendance_' + attCurrentDate;
  const cached = pageDataCache[cacheKey];

  const grid = document.getElementById('attBatchesGrid');
  const empty = document.getElementById('attEmpty');

  if (cached) {
    const { batches, sbRows, attMap } = cached;
    if (!batches || batches.length === 0) {
      if (grid) { grid.innerHTML = ''; grid.style.display = 'none'; }
      if (empty) empty.style.display = 'flex';
      updateAttSummary(0, 0, 0);
      return;
    }
    renderAttBatchCards(batches, sbRows || [], attMap || {});
    return;
  }

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('id, name, schedule').eq('institute_id', currentInstitute.id).order('name')
  );
  if (!batchesRes.ok) { showSectionFallback('page-attendance', batchesRes.error, { retry: () => populateAttendancePage() }); return; }
  const batches = batchesRes.data;

  if (!batches || batches.length === 0) {
    if (grid) { grid.innerHTML = ''; grid.style.display = 'none'; }
    if (empty) empty.style.display = 'flex';
    updateAttSummary(0, 0, 0);
    pageDataCache[cacheKey] = { batches: [], sbRows: [], attMap: {} };
    return;
  }

  const batchIds = batches.map(b => b.id);
  const sbRes = await safeQuery(() => db.from('student_batches').select('batch_id, student_id').in('batch_id', batchIds));
  const sbRows = sbRes.ok ? sbRes.data : [];
  const studentIdsArr = [...new Set(sbRows.map(r => r.student_id))];
  let attMap = {};
  if (studentIdsArr.length > 0) {
    const attRes = await safeQuery(() =>
      db.from('attendance').select('student_id, status').eq('date', attCurrentDate).in('student_id', studentIdsArr)
    );
    if (attRes.ok) (attRes.data || []).forEach(a => { attMap[a.student_id] = a.status; });
  }

  pageDataCache[cacheKey] = { batches, sbRows: sbRows || [], attMap };
  renderAttBatchCards(batches, sbRows || [], attMap);
}

function renderAttBatchCards(batches, sbRows, attMap) {
  const grid = document.getElementById('attBatchesGrid');
  const empty = document.getElementById('attEmpty');
  if (grid) grid.style.display = '';
  if (empty) empty.style.display = 'none';

  const studentCountMap = {};
  const allStudentIds = new Set();
  sbRows.forEach(r => {
    studentCountMap[r.batch_id] = (studentCountMap[r.batch_id] || 0) + 1;
    allStudentIds.add(r.student_id);
  });
  const allIds = [...allStudentIds];

  let totalPresent = 0, totalAbsent = 0, totalUnmarked = 0;
  allIds.forEach(id => {
    const st = attMap[id];
    if (st === 'present') totalPresent++;
    else if (st === 'absent') totalAbsent++;
    else totalUnmarked++;
  });
  updateAttSummary(totalPresent, totalAbsent, totalUnmarked);

  grid.innerHTML = batches.map(b => {
    const count = studentCountMap[b.id] || 0;
    let batchPresent = 0, batchAbsent = 0, batchUnmarked = 0;
    sbRows.filter(r => r.batch_id === b.id).forEach(r => {
      const st = attMap[r.student_id];
      if (st === 'present') batchPresent++;
      else if (st === 'absent') batchAbsent++;
      else batchUnmarked++;
    });
    const marked = batchPresent + batchAbsent;
    const rate = count > 0 ? Math.round((batchPresent / count) * 100) : 0;
    const rateColor = rate >= 75 ? '#4ADE80' : rate >= 50 ? '#FBBF24' : '#F87171';

    return `
    <div class="fee-batch-card" onclick="showAttBatchDetail('${b.id}')">
      <div class="fee-batch-card-top">
        <div class="fee-batch-card-name">${escapeHtml(b.name)}</div>
        <div class="fee-batch-card-rate" style="color:${rateColor}" title="Overall attendance">${marked > 0 ? rate + '%' : '--'}</div>
      </div>
      <div class="fee-batch-card-fee">${count} student${count !== 1 ? 's' : ''}${b.schedule ? ' &middot; ' + escapeHtml(b.schedule) : ''}</div>
      <div class="fee-batch-card-stats">
        <span class="fee-batch-card-stat" style="color:#4ADE80"><strong>${batchPresent}</strong> present</span>
        <span class="fee-batch-card-stat" style="color:#F87171"><strong>${batchAbsent}</strong> absent</span>
        <span class="fee-batch-card-stat" style="color:#94A3B8"><strong>${batchUnmarked}</strong> unmarked</span>
      </div>
    </div>`;
  }).join('');
}

function updateAttSummary(present, absent, unmarked) {
  document.getElementById('attPresentCount').textContent = present;
  document.getElementById('attAbsentCount').textContent = absent;
  document.getElementById('attUnmarkedCount').textContent = unmarked;
}

let attBatchStudents = [];
let attBatchAttMap = {};

async function showAttBatchDetail(batchId, keepFilter) {
  if (isDemoMode) {
    showDemoAttBatchDetail(batchId);
    return;
  }

  attSelectedBatchId = batchId;
  document.getElementById('attBatchList').style.display = 'none';
  document.getElementById('attBatchDetail').style.display = '';
  if (!keepFilter) setCustomSelectValue('attFilterSelect', 'all');

  // Switch search to student mode
  const attSearch = document.querySelector('#page-attendance .section-search-input');
  if (attSearch) {
    attSearch.dataset.filter = 'attTableBody';
    attSearch.placeholder = 'Search students...';
    attSearch.value = '';
  }

  const today = toDateKey(new Date());
  const display = document.getElementById('attDateDisplay');
  display.textContent = attCurrentDate === today ? 'Today' : new Date(attCurrentDate + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

  const batchRes = await safeQuery(() => db.from('batches').select('id, name, schedule').eq('id', batchId).single());
  if (!batchRes.ok) { showSectionFallback('page-attendance', batchRes.error, { retry: () => showAttBatchDetail(batchId) }); return; }
  const batch = batchRes.data;

  const sbRes = await safeQuery(() => db.from('student_batches').select('student_id').eq('batch_id', batchId));
  const studentIds = (sbRes.ok ? sbRes.data : []).map(r => r.student_id);

  const namesRes = await safeQuery(() => db.from('students').select('id, full_name').in('id', studentIds).is('deleted_at', null));
  const students = namesRes.ok ? namesRes.data : [];
  naturalNameSort(students || []);
  attBatchStudents = students || [];

  attBatchAttMap = {};
  if (studentIds.length > 0) {
    const attRes = await safeQuery(() =>
      db.from('attendance').select('student_id, status').eq('date', attCurrentDate).in('student_id', studentIds)
    );
    if (attRes.ok) (attRes.data || []).forEach(a => { attBatchAttMap[a.student_id] = a.status; });
  }

  // Overall attendance: per-student percentage + batch rate (all recorded days)
  let batchMarked = 0, batchPresent = 0;
  attBatchStudents.forEach(s => { s.attPct = null; });
  if (studentIds.length > 0) {
    const overallRes = await safeQuery(() =>
      db.from('attendance').select('student_id, status').in('student_id', studentIds)
    );
    const overallRows = overallRes.ok ? overallRes.data : [];
    const perStudent = {};
    (overallRows || []).forEach(r => {
      if (r.status !== 'present' && r.status !== 'absent') return;
      perStudent[r.student_id] = perStudent[r.student_id] || { present: 0, marked: 0 };
      perStudent[r.student_id].marked++;
      if (r.status === 'present') perStudent[r.student_id].present++;
    });
    attBatchStudents.forEach(s => {
      const rec = perStudent[s.id];
      if (rec && rec.marked > 0) {
        s.attPct = Math.round((rec.present / rec.marked) * 100);
        batchPresent += rec.present;
        batchMarked += rec.marked;
      }
    });
  }
  const batchOverallRate = batchMarked > 0 ? Math.round((batchPresent / batchMarked) * 100) : null;
  const rateColor = batchOverallRate == null ? '#94A3B8' : batchOverallRate >= 75 ? '#4ADE80' : batchOverallRate >= 50 ? '#FBBF24' : '#F87171';

  let present = 0, absent = 0, unmarked = 0;
  attBatchStudents.forEach(s => {
    const st = attBatchAttMap[s.id];
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else unmarked++;
  });
  const total = attBatchStudents.length;

  document.getElementById('attBatchHeader').innerHTML = `
    <div class="fees-batch-header-top">
      <div class="fees-batch-header-info">
        <div class="fees-batch-header-name">${escapeHtml(batch?.name || '')}</div>
        <div class="fees-batch-header-meta">
          ${batch?.schedule ? '<span>' + escapeHtml(batch.schedule) + '</span>' : ''}
          <span>${total} student${total !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="fees-batch-header-rate" style="color:${rateColor}" title="Overall attendance">${batchOverallRate != null ? batchOverallRate + '%' : '--'}</div>
    </div>
    <div class="fees-batch-header-stats">
      <div class="fees-batch-stat"><div class="fees-batch-stat-value" style="color:#4ADE80">${present}</div><div class="fees-batch-stat-label">Present</div></div>
      <div class="fees-batch-stat"><div class="fees-batch-stat-value" style="color:#F87171">${absent}</div><div class="fees-batch-stat-label">Absent</div></div>
      <div class="fees-batch-stat"><div class="fees-batch-stat-value" style="color:#94A3B8">${unmarked}</div><div class="fees-batch-stat-label">Unmarked</div></div>
    </div>
  `;

  renderAttTable();
}

function renderAttTable() {
  const filter = getCustomSelectValue('attFilterSelect');
  const tbody = document.getElementById('attTableBody');
  const empty = document.getElementById('attDetailEmpty');
  const table = document.querySelector('#attBatchDetail .page-table');

  let filtered = attBatchStudents;
  if (filter !== 'all') filtered = filtered.filter(s => (attBatchAttMap[s.id] || 'unmarked') === filter);

  if (filtered.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) {
      empty.style.display = 'flex';
      const msg = filter === 'all' ? 'No students in this batch' : 'No ' + filter + ' students';
      empty.innerHTML = `<svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><h3>${msg}</h3>`;
    }
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(s => {
    const name = s.full_name || '\u2014';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const status = attBatchAttMap[s.id] || 'unmarked';
    const pct = s.attPct;
    const pctColor = pct == null ? '#94A3B8' : pct >= 75 ? '#4ADE80' : pct >= 50 ? '#FBBF24' : '#F87171';

    return `<tr>
      <td data-label="Student">
        <div class="staff-name">
          <div class="staff-avatar staff-avatar-teacher">${escapeHtml(initials)}</div>
          ${escapeHtml(name)}
        </div>
      </td>
      <td data-label="Status">
        <div class="att-toggle-group">
          <button class="att-toggle ${status === 'present' ? 'att-toggle-active att-present' : ''}" onclick="markAtt('${s.id}','present', this)">Present</button>
          <button class="att-toggle ${status === 'absent' ? 'att-toggle-active att-absent' : ''}" onclick="markAtt('${s.id}','absent', this)">Absent</button>
        </div>
      </td>
      <td data-label="Attendance">
        <span class="att-pct" style="color:${pctColor};font-weight:600">${pct != null ? pct + '%' : '--'}</span>
      </td>
      <td class="staff-actions"></td>
    </tr>`;
  }).join('');
}

async function markAtt(studentId, status, btn) {
  try {
    await withLoading(btn, async () => {
      const { error } = await safeQuery(() =>
        db.from('attendance')
          .upsert({
            student_id: studentId,
            batch_id: attSelectedBatchId,
            date: attCurrentDate,
            status: status
          }, { onConflict: 'student_id,batch_id,date' })
      );
      if (error) throw error;
    }, { spinnerOnly: true });
  } catch (err) {
    if (handlePlanError(err)) return;
    return;
  }

  attBatchAttMap[studentId] = status;
  renderAttTable();
  if (attSelectedBatchId) showAttBatchDetail(attSelectedBatchId, true);
  else populateAttendancePage();
}

document.getElementById('attBackBtn')?.addEventListener('click', () => populateAttendancePage());

// ── Announcements Page ──

async function populateAnnouncementsPage() {
  if (isDemoMode) {
    renderDemoAnnouncements();
    return;
  }

  if (!currentInstitute?.id) return;

  // Serve from cache so re-opening the page (e.g. via the dashboard card)
  // doesn't flash the skeleton or hit the network again.
  const cached = pageDataCache['announcements'];
  if (cached) {
    renderAnnouncements(cached.list, cached.hasMore);
    setAnnouncementsLoadMore(cached.hasMore);
    return;
  }

  const addBtn = document.getElementById('addAnnouncementBtn');
  if (addBtn) {
    if (!planLimits.announcements_allowed) {
      addBtn.disabled = true;
      addBtn.title = 'Announcements require Basic or Pro plan. Upgrade to enable.';
      addBtn.textContent = 'Upgrade to Announce';
    } else {
      addBtn.disabled = false;
      addBtn.title = '';
      addBtn.textContent = 'New Announcement';
    }
  }

  resetAnnouncementsPager();
  const { data, done } = await fetchAnnouncementsPage();
  pageDataCache['announcements'] = { list: data, hasMore: !done };
  renderAnnouncements(data, !done);
}

function renderAnnouncements(announcements, hasMore = false) {
  const list = document.getElementById('announcementsList');
  const empty = document.getElementById('announcementsEmpty');

  if (!announcements || announcements.length === 0) {
    if (list) list.style.display = 'none';
    if (empty) empty.style.display = 'flex';
  } else {
    if (list) {
      list.style.display = '';
      list.innerHTML = announcements.map(a => announcementCardHTML(a, { canEdit: true, canDelete: true })).join('');
    }
    if (empty) empty.style.display = 'none';
  }

  setAnnouncementsLoadMore(hasMore);
}

async function deleteAnnouncement(id) {
  if (isDemoMode) { showToast('Announcements are not available in demo mode.', { danger: true }); return; }
  if (!confirm('Delete this announcement?')) return;
  if (isDemoMode) {
    const idx = demoAnnouncements.findIndex(a => a.id === id);
    if (idx > -1) demoAnnouncements.splice(idx, 1);
    invalidatePageCache('dashboard');
    renderDemoAnnouncements();
    return;
  }
  const { error } = await db.rpc('soft_delete_announcement', { p_announcement_id: id });
  if (error) {
    if (handlePlanError(error)) return;
    alert('Failed to delete the announcement. Please try again.');
    return;
  }
  invalidatePageCache('announcements');
  invalidatePageCache('dashboard');
  await populateAnnouncementsPage();
}

document.getElementById('announcementsLoadMore')?.addEventListener('click', async () => {
  const btn = document.getElementById('announcementsLoadMore');
  const { data, done } = await withLoading(btn, () => fetchAnnouncementsPage(), { label: 'Loading...' });
  const list = document.getElementById('announcementsList');
  if (list && data.length) {
    list.insertAdjacentHTML('beforeend', data.map(a => announcementCardHTML(a, { canEdit: true, canDelete: true })).join(''));
    const prev = pageDataCache['announcements'];
    pageDataCache['announcements'] = { list: [...(prev ? prev.list : []), ...data], hasMore: !done };
    applyAnnouncementFilters();
  }
  setAnnouncementsLoadMore(!done);
});

// ── Modal: Edit Staff / Parent ──

let editingStaffTarget = null;

function openEditStaffModal(target, roleLabel) {
  editingStaffTarget = target;
  document.getElementById('editStaffTitle').textContent = 'Edit ' + roleLabel;
  document.getElementById('editStaffName').value = (target.name && target.name !== '\u2014') ? target.name : '';
  const emailField = document.getElementById('editStaffEmailField');
  const emailInput = document.getElementById('editStaffEmail');
  if (target.isInvite) {
    emailField.style.display = '';
    emailInput.value = target.email || '';
    emailInput.required = true;
  } else {
    emailField.style.display = 'none';
    emailInput.value = '';
    emailInput.required = false;
  }
  document.getElementById('editStaffError').classList.remove('visible');
  document.getElementById('editStaffModal').classList.add('open');
  if (typeof fluidPause === 'function') fluidPause();
}

function editStaff(id) {
  const row = allStaff.find(s => s.id === id);
  if (row) openEditStaffModal(row, 'Teacher');
}

function editParent(id) {
  const row = allParents.find(p => p.id === id);
  if (row) openEditStaffModal(row, 'Parent');
}

document.getElementById('editStaffForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingStaffTarget) return;
  const btn = e.target.querySelector('.staff-modal-submit');
  const errEl = document.getElementById('editStaffError');
  const name = document.getElementById('editStaffName').value.trim();

  if (!name) {
    errEl.textContent = 'Please enter a name.';
    errEl.classList.add('visible');
    return;
  }

  const wasParent = editingStaffTarget.role === 'parent';

  try {
    await withLoading(btn, async () => {
      const t = editingStaffTarget;
      if (t.isInvite) {
        const updates = { name };
        const email = document.getElementById('editStaffEmail').value.trim();
        if (email && email !== t.email) updates.email = email;
        const { error } = await db.from('invite_tokens').update(updates).eq('id', t.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('users').update({ full_name: name }).eq('id', t.id);
        if (error) throw error;
      }
    }, { label: 'Saving...' });
  } catch (err) {
    errEl.textContent = 'Failed to save. Please try again.';
    errEl.classList.add('visible');
    return;
  }

  editingStaffTarget = null;
  document.getElementById('editStaffModal').classList.remove('open');
  if (wasParent) { invalidatePageCache('parents'); populateParentsPage(); }
  else { invalidatePageCache('staff'); populateStaffPage(); }
});

function closeEditStaffModal() {
  closeAllCustomSelects();
  document.getElementById('editStaffModal').classList.remove('open');
}
document.getElementById('editStaffModalClose')?.addEventListener('click', closeEditStaffModal);
document.getElementById('editStaffCancel')?.addEventListener('click', closeEditStaffModal);
document.getElementById('editStaffModal')?.addEventListener('click', (e) => { if (e.target.id === 'editStaffModal') closeEditStaffModal(); });

// ── Modal: Add Student ──

let editingStudentId = null;

document.getElementById('addStudentBtn')?.addEventListener('click', async () => {
  if (document.getElementById('addStudentBtn').disabled) return;
  editingStudentId = null;
  document.getElementById('studentModalTitle').textContent = 'Add Student';
  document.getElementById('studentForm').reset();
  document.getElementById('studentError').classList.remove('visible');
  await loadBatchesForSelect('studentBatch');
  document.getElementById('studentModal').classList.add('open');
});

async function editStudent(id) {
  editingStudentId = id;
  const { data: student } = await db.from('students').select('*').eq('id', id).single();
  if (!student) return;
  document.getElementById('studentModalTitle').textContent = 'Edit Student';
  document.getElementById('studentName').value = student.full_name || '';
  document.getElementById('studentPhone').value = student.phone || '';
  document.getElementById('studentParentName').value = student.parent_consent_by || '';
  document.getElementById('studentParentConsent').checked = !!student.parent_consent;
  await loadBatchesForSelect('studentBatch');
  document.getElementById('studentError').classList.remove('visible');
  document.getElementById('studentModal').classList.add('open');
}

async function deleteStudent(id) {
  if (!confirm('Delete this student? Their payment history will be preserved.')) return;
  const { error } = await db.rpc('soft_delete_student', { p_student_id: id, p_institute_id: currentInstitute.id });
  if (error) { alert('Failed to delete student: ' + error.message); return; }
  invalidatePageCache('students'); invalidatePageCache('batches'); invalidatePageCache('fees');
  populateStudentsPage();
  if (typeof loadStats === 'function') { invalidatePageCache('dashboard'); loadStats(); }
}

document.getElementById('studentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const batchId = getCustomSelectValue('studentBatch');
  const parentName = document.getElementById('studentParentName').value.trim();
  const parentConsent = document.getElementById('studentParentConsent').checked;
  const errEl = document.getElementById('studentError');

  if (!name) {
    errEl.textContent = 'Please enter a name.';
    errEl.classList.add('visible');
    return;
  }

  if (!editingStudentId && !parentConsent) {
    errEl.textContent = 'Please confirm that parent/guardian consent has been obtained for this student.';
    errEl.classList.add('visible');
    return;
  }

  // Pre-check limit client-side before hitting DB
  const currentCount = document.querySelectorAll('#studentsTableBody tr').length;
  if (!editingStudentId && currentCount >= planLimits.max_students) {
    showUpgradePrompt('more students');
    return;
  }

  try {
    const btn = e.target.querySelector('.staff-modal-submit');
    await withLoading(btn, async () => {
      if (editingStudentId) {
        const consentFields = { parent_consent_by: parentName || null };
        if (parentConsent) {
          consentFields.parent_consent = true;
          consentFields.parent_consent_at = new Date().toISOString();
        }
        await db.from('students').update({ full_name: name, phone: phone || null, ...consentFields }).eq('id', editingStudentId);
        if (batchId) {
          await db.from('student_batches').delete().eq('student_id', editingStudentId);
          const { error: sbEditErr } = await db.from('student_batches').insert({ student_id: editingStudentId, batch_id: batchId });
          if (sbEditErr) console.error('student_batches edit insert failed:', sbEditErr);
          const { data: existingPayment } = await db.from('payments').select('id')
            .eq('student_id', editingStudentId).eq('batch_id', batchId).eq('status', 'pending').limit(1).single();
          if (!existingPayment) {
            const { data: feeRow } = await db.from('fees').select('amount, frequency').eq('batch_id', batchId).single();
            if (feeRow) {
              const dueDate = new Date();
              if (feeRow.frequency === 'monthly') dueDate.setMonth(dueDate.getMonth() + 1);
              else if (feeRow.frequency === 'quarterly') dueDate.setMonth(dueDate.getMonth() + 3);
              else if (feeRow.frequency === 'yearly') dueDate.setFullYear(dueDate.getFullYear() + 1);
              await db.from('payments').insert({
                student_id: editingStudentId,
                amount: feeRow.amount,
                batch_id: batchId,
                institute_id: currentInstitute.id,
                due_date: toDateKey(dueDate),
                status: 'pending'
              });
            }
          }
        }
      } else {
        const { data: newStudent, error: insertErr } = await db
          .from('students')
          .insert({
            full_name: name,
            phone: phone || null,
            institute_id: currentInstitute.id,
            parent_consent: true,
            parent_consent_by: parentName || null,
            parent_consent_at: new Date().toISOString()
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        if (newStudent && batchId) {
          const { error: sbErr } = await db.from('student_batches').insert({ student_id: newStudent.id, batch_id: batchId });
          if (sbErr) {
            console.error('student_batches insert failed:', sbErr);
            errEl.textContent = 'Student saved but batch assignment failed. Please edit the student to retry.';
            errEl.classList.add('visible');
          }
          const { data: feeRow } = await db.from('fees').select('amount, frequency').eq('batch_id', batchId).single();
          if (feeRow) {
            const dueDate = new Date();
            if (feeRow.frequency === 'monthly') dueDate.setMonth(dueDate.getMonth() + 1);
            else if (feeRow.frequency === 'quarterly') dueDate.setMonth(dueDate.getMonth() + 3);
            else if (feeRow.frequency === 'yearly') dueDate.setFullYear(dueDate.getFullYear() + 1);
            await db.from('payments').insert({
              student_id: newStudent.id,
              amount: feeRow.amount,
              batch_id: batchId,
              institute_id: currentInstitute.id,
              due_date: toDateKey(dueDate),
              status: 'pending'
            });
          }
        }
      }
    }, { label: 'Saving...' });
  } catch (err) {
    if (handlePlanError(err)) return;
    errEl.textContent = 'Failed to save student. Please try again.';
    errEl.classList.add('visible');
    return;
  }

  document.getElementById('studentModal').classList.remove('open');
  invalidatePageCache('students'); invalidatePageCache('batches');
  await fetchPlanLimits();
  populateStudentsPage();
  if (typeof loadStats === 'function') { invalidatePageCache('dashboard'); loadStats(); }
});

function closeStudentModal() {
  closeAllCustomSelects();
  document.getElementById('studentModal').classList.remove('open');
}
document.getElementById('studentModalClose')?.addEventListener('click', closeStudentModal);
document.getElementById('studentModalCancel')?.addEventListener('click', closeStudentModal);
document.getElementById('studentModal')?.addEventListener('click', (e) => { if (e.target.id === 'studentModal') closeStudentModal(); });

// ── Modal: Add Batch ──

let editingBatchId = null;

// ── Teacher dropdown for batch form ──

async function loadBatchTeachers() {
  if (!currentInstitute?.id) return;
  const { data: teachers } = await db
    .from('users')
    .select('id, full_name, email')
    .eq('institute_id', currentInstitute.id)
    .eq('role', 'teacher');
  naturalNameSort(teachers || []);

  const options = [{value:'', label:'No teacher'}];
  (teachers || []).forEach(t => {
    options.push({value:t.id, label:t.full_name || t.email});
  });
  setCustomSelectOptions('batchTeacher', options, getCustomSelectValue('batchTeacher'));
}

document.getElementById('addBatchBtn')?.addEventListener('click', async () => {
  if (document.getElementById('addBatchBtn').disabled) return;
  editingBatchId = null;
  document.getElementById('batchModalTitle').textContent = 'Add Batch';
  document.getElementById('batchForm').reset();
  document.getElementById('batchError').classList.remove('visible');
  await loadBatchTeachers();
  document.getElementById('batchModal').classList.add('open');
});

async function editBatch(id) {
  editingBatchId = id;
  const { data: batch } = await db.from('batches').select('*').eq('id', id).single();
  if (!batch) return;
  const { data: feeRow } = await db.from('fees').select('amount').eq('batch_id', id).single();
  await loadBatchTeachers();
  document.getElementById('batchModalTitle').textContent = 'Edit Batch';
  document.getElementById('batchName').value = batch.name || '';
  document.getElementById('batchSchedule').value = batch.schedule || '';
  document.getElementById('batchFee').value = feeRow?.amount || '';
  setCustomSelectValue('batchTeacher', batch.teacher_id || '');
  document.getElementById('batchError').classList.remove('visible');
  document.getElementById('batchModal').classList.add('open');
}

async function deleteBatch(id) {
  if (!confirm('Delete this batch? Students will be unassigned and pending fees removed.')) return;
  const { error } = await db.rpc('soft_delete_batch', { p_batch_id: id, p_institute_id: currentInstitute.id });
  if (error) { alert('Failed to delete batch: ' + error.message); return; }
  invalidatePageCache('batches'); invalidatePageCache('students'); invalidatePageCache('fees');
  populateBatchesPage();
  if (typeof loadStats === 'function') { invalidatePageCache('dashboard'); loadStats(); }
}

document.getElementById('batchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('batchName').value.trim();
  const schedule = document.getElementById('batchSchedule').value.trim();
  const teacherId = getCustomSelectValue('batchTeacher') || null;
  const fee = parseInt(document.getElementById('batchFee').value) || 0;
  const errEl = document.getElementById('batchError');

  if (!name) {
    errEl.textContent = 'Please enter a batch name.';
    errEl.classList.add('visible');
    return;
  }

  // Pre-check limit client-side before hitting DB
  const currentCount = document.querySelectorAll('#batchesGrid .batch-card').length;
  if (!editingBatchId && currentCount >= planLimits.max_batches) {
    showUpgradePrompt('more batches');
    return;
  }

  try {
    const btn = e.target.querySelector('.staff-modal-submit');
    await withLoading(btn, async () => {
      if (editingBatchId) {
        await db.from('batches').update({ name, schedule: schedule || null, teacher_id: teacherId }).eq('id', editingBatchId);
        if (fee > 0) {
          const { data: existingFee } = await db.from('fees').select('id').eq('batch_id', editingBatchId).single();
          if (existingFee) {
            await db.from('fees').update({ amount: fee }).eq('id', existingFee.id);
          } else {
            await db.from('fees').insert({ batch_id: editingBatchId, amount: fee, frequency: 'monthly' });
          }
        }
      } else {
        const { data: newBatch, error: insertErr } = await db.from('batches').insert({ name, schedule: schedule || null, teacher_id: teacherId, institute_id: currentInstitute.id }).select('id').single();
        if (insertErr) throw insertErr;
        if (fee > 0 && newBatch) {
          await db.from('fees').insert({ batch_id: newBatch.id, amount: fee, frequency: 'monthly' });
        }
      }
    }, { label: 'Saving...' });
  } catch (err) {
    if (handlePlanError(err)) return;
    errEl.textContent = 'Failed to save batch. Please try again.';
    errEl.classList.add('visible');
    return;
  }

  document.getElementById('batchModal').classList.remove('open');
  invalidatePageCache('batches'); invalidatePageCache('students'); invalidatePageCache('fees');
  await fetchPlanLimits();
  populateBatchesPage();
  if (typeof loadStats === 'function') { invalidatePageCache('dashboard'); loadStats(); }
});

function closeBatchModal() {
  closeAllCustomSelects();
  document.getElementById('batchModal').classList.remove('open');
}
document.getElementById('batchModalClose')?.addEventListener('click', closeBatchModal);
document.getElementById('batchModalCancel')?.addEventListener('click', closeBatchModal);
document.getElementById('batchModal')?.addEventListener('click', (e) => { if (e.target.id === 'batchModal') closeBatchModal(); });

// ── Attendance date navigation ──

document.getElementById('attPrevDay')?.addEventListener('click', () => {
  const [y, m, d] = attCurrentDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  attCurrentDate = toDateKey(dt);
  if (attSelectedBatchId) showAttBatchDetail(attSelectedBatchId);
  else populateAttendancePage();
});

document.getElementById('attNextDay')?.addEventListener('click', () => {
  const [y, m, d] = attCurrentDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  attCurrentDate = toDateKey(dt);
  if (attSelectedBatchId) showAttBatchDetail(attSelectedBatchId);
  else populateAttendancePage();
});

// ── Modal: Announcement ──

let editingAnnouncementId = null;

function openAnnouncementModal() {
  if (isDemoMode) { showToast('Announcements are not available in demo mode.', { danger: true }); return; }
  editingAnnouncementId = null;
  document.getElementById('announcementForm').reset();
  document.getElementById('announcementModalTitle').textContent = 'New Announcement';
  const submit = document.getElementById('announcementSubmit');
  if (submit) submit.textContent = 'Send Announcement';
  document.getElementById('announcementError').classList.remove('visible');
  document.getElementById('announcementModal').classList.add('open');
  if (typeof fluidPause === 'function') fluidPause();
}

function editAnnouncement(id) {
  if (isDemoMode) { showToast('Announcements are not available in demo mode.', { danger: true }); return; }
  const cached = pageDataCache['announcements'];
  const ann = cached && cached.list.find(a => a.id === id);
  if (!ann) return;
  editingAnnouncementId = id;
  document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
  document.getElementById('announcementTitle').value = ann.title || '';
  document.getElementById('announcementBody').value = ann.message || ann.body || ann.content || '';
  setCustomSelectValue('announcementAudience', ann.target || 'all');
  const submit = document.getElementById('announcementSubmit');
  if (submit) submit.textContent = 'Save Changes';
  document.getElementById('announcementError').classList.remove('visible');
  document.getElementById('announcementModal').classList.add('open');
  if (typeof fluidPause === 'function') fluidPause();
}

document.getElementById('addAnnouncementBtn')?.addEventListener('click', () => {
  openAnnouncementModal();
});

document.getElementById('announcementForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('announcementTitle').value.trim();
  const body = document.getElementById('announcementBody').value.trim();
  const audience = getCustomSelectValue('announcementAudience');
  const errEl = document.getElementById('announcementError');

  if (!title || !body) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.classList.add('visible');
    return;
  }

  // Pre-check: announcements require paid plan
  if (!planLimits.announcements_allowed && !editingAnnouncementId) {
    showUpgradePrompt('announcements');
    return;
  }

  // Demo mode: mutate the demo array in memory
  if (isDemoMode) {
    if (editingAnnouncementId) {
      const ann = demoAnnouncements.find(a => a.id === editingAnnouncementId);
      if (ann) {
        ann.title = title;
        ann.message = body;
        ann.target = audience;
      }
    } else {
      demoAnnouncements.unshift({
        id: 'demo-a' + Date.now(),
        title,
        message: body,
        target: audience,
        created_at: new Date().toISOString()
      });
    }
    editingAnnouncementId = null;
    document.getElementById('announcementModal').classList.remove('open');
    invalidatePageCache('dashboard');
    renderDemoAnnouncements();
    return;
  }

  try {
    const btn = e.target.querySelector('.staff-modal-submit');
    await withLoading(btn, async () => {
      if (editingAnnouncementId) {
        const { error: updateErr } = await db.from('announcements').update({
          title,
          message: body,
          target: audience
        }).eq('id', editingAnnouncementId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await db.from('announcements').insert({
          title,
          message: body,
          target: audience,
          institute_id: currentInstitute.id,
          created_by: currentUser.id
        });
        if (insertErr) throw insertErr;
      }
    }, { label: editingAnnouncementId ? 'Saving...' : 'Sending...' });
  } catch (err) {
    if (handlePlanError(err)) return;
    errEl.textContent = editingAnnouncementId ? 'Failed to update announcement. Please try again.' : 'Failed to post announcement. Please try again.';
    errEl.classList.add('visible');
    return;
  }

  editingAnnouncementId = null;
  document.getElementById('announcementModal').classList.remove('open');
  invalidatePageCache('announcements');
  invalidatePageCache('dashboard');
  await populateAnnouncementsPage();
});

function closeAnnouncementModal() {
  closeAllCustomSelects();
  document.getElementById('announcementModal').classList.remove('open');
}
document.getElementById('announcementModalClose')?.addEventListener('click', closeAnnouncementModal);
document.getElementById('announcementModalCancel')?.addEventListener('click', closeAnnouncementModal);
document.getElementById('announcementModal')?.addEventListener('click', (e) => { if (e.target.id === 'announcementModal') closeAnnouncementModal(); });

// ── Helper: load batches for select ──

async function loadBatchesForSelect(selectId) {
  if (!document.querySelector(`[data-select-id="${selectId}"]`)) return;
  setCustomSelectOptions(selectId, [{value:'', label:'Loading...'}], getCustomSelectValue(selectId));
  const res = await safeQuery(() => db.from('batches').select('id, name').eq('institute_id', currentInstitute.id).order('name'));
  const data = res.ok ? res.data : [];
  const options = [{value:'', label:'Select batch...'}];
  (data || []).forEach(b => {
    options.push({value:b.id, label:b.name});
  });
  setCustomSelectOptions(selectId, options, getCustomSelectValue(selectId));
}

// ── Batch Filter ──
// Filter onChange handled by initCustomSelect in onReady

// Re-run batch filter when search is typed (already handled by renderStudentsTable)

// ── Section Search ──

function applyStaffParentsFilter(filterId) {
  const container = document.getElementById(filterId);
  if (!container) return;
  const searchInput = document.querySelector(`.section-search-input[data-filter="${filterId}"]`);
  const filterWrap = document.querySelector(`.section-filter-select[data-filter="${filterId}"]`);
  const filterInput = filterWrap?.querySelector('input[type="hidden"]');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusFilter = filterInput ? filterInput.value : '';
  container.querySelectorAll('tr').forEach(row => {
    const rowSearch = (row.dataset.search || row.textContent || '').toLowerCase();
    const matchesQuery = !query || rowSearch.includes(query);
    const matchesStatus = !statusFilter || row.dataset.status === statusFilter;
    row.style.display = (matchesQuery && matchesStatus) ? '' : 'none';
  });
}

// Filter onChange handled by initCustomSelect in onReady

document.querySelectorAll('.section-search-input').forEach(input => {
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filterId = input.dataset.filter;
    if (!filterId) return;

    // Special handling for students (has batch filter)
    if (filterId === 'studentsTableBody' && window._studentsData) {
      const c = pageDataCache['students'];
      renderStudentsTable(window._studentsData, window._studentBatchIds || {}, c ? c.batchMap : {});
      return;
    }

    if (filterId === 'staffTableBody' || filterId === 'parentsTableBody') {
      applyStaffParentsFilter(filterId);
      return;
    }

    const container = document.getElementById(filterId);
    if (!container) return;

    if (filterId.endsWith('Grid')) {
      container.querySelectorAll('.batch-card, .fee-batch-card').forEach(card => {
        const nameEl = card.matches('.fee-batch-card') ? card.querySelector('.fee-batch-card-name') : card.querySelector('h3');
        const nameText = nameEl ? nameEl.textContent.toLowerCase() : '';
        card.style.display = (!query || nameText.includes(query)) ? '' : 'none';
      });
    } else if (filterId.endsWith('List')) {
      container.querySelectorAll('.announcement-card').forEach(card => {
        card.style.display = (!query || card.textContent.toLowerCase().includes(query)) ? '' : 'none';
      });
    } else if (filterId === 'batchDetailStudents' || filterId === 'attTableBody' || filterId === 'feesTableBody' || filterId === 'studentsTableBody') {
      container.querySelectorAll('tr').forEach(row => {
        const nameCell = row.querySelector('td:first-child .page-table-name, td:first-child');
        const nameText = nameCell ? nameCell.textContent.toLowerCase() : row.textContent.toLowerCase();
        row.style.display = (!query || nameText.includes(query)) ? '' : 'none';
      });
    } else {
      container.querySelectorAll('tr').forEach(row => {
        row.style.display = (!query || row.textContent.toLowerCase().includes(query)) ? '' : 'none';
      });
    }
  });
});

// ── Settings Page ──

let settingsCache = null;

const NAME_CHANGE_INTERVAL_DAYS = 14;

function renderNameChangeHint(hintEl, lastChangedAt, label) {
  if (!hintEl) return;
  const next = lastChangedAt
    ? new Date(new Date(lastChangedAt).getTime() + NAME_CHANGE_INTERVAL_DAYS * 86400000)
    : null;
  const locked = !!next && Date.now() < next.getTime();
  hintEl.textContent = locked
    ? `${label} can be changed again on ${next.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.`
    : `${label} can be changed once every ${NAME_CHANGE_INTERVAL_DAYS} days.`;
  hintEl.classList.toggle('settings-field-hint--warn', locked);
}

async function populateSettingsPage() {
  if (isDemoMode) {
    renderDemoSettings();
    return;
  }

  if (!currentInstitute?.id) return;

  // Clear stale messages
  document.querySelectorAll('#page-settings .settings-form-msg').forEach(el => {
    el.classList.remove('visible');
    el.style.color = '';
  });

  // Fill institute profile
  document.getElementById('settingsInstName').value = currentInstitute.name || '';
  document.getElementById('settingsInstEmail').value = currentInstitute.email || '';
  document.getElementById('settingsInstPhone').value = currentInstitute.phone || '';
  document.getElementById('settingsInstAddress').value = currentInstitute.address || '';

  // Fill admin profile
  document.getElementById('settingsAdminName').value = userProfile?.full_name || '';
  document.getElementById('settingsAdminEmail').value = currentUser?.email || '';
  document.getElementById('settingsAdminRole').value = (userProfile?.role || 'admin').charAt(0).toUpperCase() + (userProfile?.role || 'admin').slice(1);

  // Name change cooldown hints (server-enforced; reflects the stored timestamps)
  renderNameChangeHint(document.getElementById('instNameHint'), currentInstitute?.name_changed_at, 'Institute name');
  renderNameChangeHint(document.getElementById('adminNameHint'), userProfile?.full_name_changed_at, 'Profile name');

  // Fill plan info (keep it up-to-date)
  const planLabels = { free: 'Free', basic: 'Basic', pro: 'Pro' };
  const planDetails = {
    free: '20 students · 1 batch · 1 teacher',
    basic: '100 students · 5 batches · 5 teachers',
    pro: 'Unlimited students, batches & teachers'
  };
  document.getElementById('settingsPlanBadge').textContent = planLabels[currentPlan] || 'Free';
  document.getElementById('settingsPlanDetail').textContent = planDetails[currentPlan] || planDetails.free;

  // Load notification preferences
  const settingsRes = await safeQuery(() =>
    db.from('institute_settings').select('notify_fee_reminders, notify_attendance_alerts, notify_announcements')
      .eq('institute_id', currentInstitute.id).maybeSingle()
  );
  const settings = settingsRes.ok ? settingsRes.data : null;
  settingsCache = settings || {};
  document.getElementById('toggleFeeReminders').checked = settings?.notify_fee_reminders !== false;
  document.getElementById('toggleAttendanceAlerts').checked = settings?.notify_attendance_alerts !== false;
  document.getElementById('toggleAnnouncements').checked = settings?.notify_announcements !== false;
}

// Institute form save
document.getElementById('instituteSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('.settings-save-btn');
  const msg = document.getElementById('instSaveMsg');

  const limit = checkRateLimit('settings.institute', 5, 60000);
  if (!limit.allowed) {
    showRateLimitMsg(msg, limit.retryAfterMs);
    return;
  }

  try {
    await withLoading(btn, async () => {
      const updates = {
        name: document.getElementById('settingsInstName').value.trim(),
        email: document.getElementById('settingsInstEmail').value.trim() || null,
        phone: document.getElementById('settingsInstPhone').value.trim() || null,
        address: document.getElementById('settingsInstAddress').value.trim() || null
      };

      const prevName = currentInstitute.name;

      const { error } = await db
        .from('institutes')
        .update(updates)
        .eq('id', currentInstitute.id);

      if (error) throw error;

      Object.assign(currentInstitute, updates);

      if (updates.name !== prevName) {
        currentInstitute.name_changed_at = new Date().toISOString();
        renderNameChangeHint(document.getElementById('instNameHint'), currentInstitute.name_changed_at, 'Institute name');
      }
    }, { label: 'Saving...' });

    msg.textContent = 'Institute profile saved!';
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 3000);
  } catch (err) {
    msg.textContent = 'Error saving: ' + err.message;
    msg.style.color = '#EF4444';
    msg.classList.add('visible');
    setTimeout(() => { msg.classList.remove('visible'); msg.style.color = ''; }, 4000);
  }
});

// Admin profile form save
document.getElementById('adminProfileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('.settings-save-btn');
  const msg = document.getElementById('adminSaveMsg');

  const limit = checkRateLimit('settings.adminProfile', 5, 60000);
  if (!limit.allowed) {
    showRateLimitMsg(msg, limit.retryAfterMs);
    return;
  }

  try {
    await withLoading(btn, async () => {
      const name = document.getElementById('settingsAdminName').value.trim();
      if (!name) throw new Error('Name is required');

      const prevName = userProfile.full_name;

      const { error } = await db
        .from('users')
        .update({ full_name: name })
        .eq('id', currentUser.id);

      if (error) throw error;

      userProfile.full_name = name;

      if (name !== prevName) {
        userProfile.full_name_changed_at = new Date().toISOString();
        renderNameChangeHint(document.getElementById('adminNameHint'), userProfile.full_name_changed_at, 'Profile name');
      }
    }, { label: 'Saving...' });

    msg.textContent = 'Profile updated!';
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 3000);
  } catch (err) {
    msg.textContent = 'Error saving: ' + err.message;
    msg.style.color = '#EF4444';
    msg.classList.add('visible');
    setTimeout(() => { msg.classList.remove('visible'); msg.style.color = ''; }, 4000);
  }
});

// Notification preferences save
document.getElementById('saveNotifBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveNotifBtn');
  const msg = document.getElementById('notifSaveMsg');

  const data = {
    notify_fee_reminders: document.getElementById('toggleFeeReminders').checked,
    notify_attendance_alerts: document.getElementById('toggleAttendanceAlerts').checked,
    notify_announcements: document.getElementById('toggleAnnouncements').checked
  };

  try {
    await withLoading(btn, async () => {
      if (settingsCache && Object.keys(settingsCache).length > 0) {
        const { error } = await db
          .from('institute_settings')
          .update(data)
          .eq('institute_id', currentInstitute.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('institute_settings')
          .insert({ ...data, institute_id: currentInstitute.id });
        if (error) throw error;
        settingsCache = data;
      }
    }, { label: 'Saving...' });

    msg.textContent = 'Preferences saved!';
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 3000);
  } catch (err) {
    msg.textContent = 'Error saving: ' + err.message;
    msg.style.color = '#EF4444';
    msg.classList.add('visible');
    setTimeout(() => { msg.classList.remove('visible'); msg.style.color = ''; }, 4000);
  }
});

// Settings page logout
document.getElementById('settingsLogoutBtn').addEventListener('click', async () => {
  await db.auth.signOut();
});

/* ── Privacy & Data ── */

async function gatherExportPayload() {
  const instId = currentInstitute?.id;
  const tables = [
    { name: 'institutes', filter: instId ? ['id', instId] : null },
    { name: 'users', filter: instId ? ['institute_id', instId] : null },
    { name: 'students', filter: instId ? ['institute_id', instId] : null },
    { name: 'batches', filter: instId ? ['institute_id', instId] : null },
    { name: 'fees', filter: instId ? ['institute_id', instId] : null },
    { name: 'payments', filter: instId ? ['institute_id', instId] : null },
    { name: 'announcements', filter: instId ? ['institute_id', instId] : null },
    { name: 'invite_tokens', filter: instId ? ['institute_id', instId] : null },
    { name: 'institute_settings', filter: instId ? ['institute_id', instId] : null },
    { name: 'subscriptions', filter: instId ? ['institute_id', instId] : null },
    { name: 'attendance', filter: null },
    { name: 'student_batches', filter: null },
    { name: 'parent_student_links', filter: null }
  ];
  const out = {};
  for (const t of tables) {
    try {
      let q = db.from(t.name).select('*');
      if (t.filter) q = q.eq(t.filter[0], t.filter[1]);
      const { data, error } = await q;
      out[t.name] = error ? [] : (data || []);
    } catch (e) {
      out[t.name] = [];
    }
  }
  return {
    generated_at: new Date().toISOString(),
    format: 'PingClass data export v1',
    account: {
      email: currentUser?.email || null,
      full_name: userProfile?.full_name || null,
      role: userProfile?.role || null
    },
    institute: currentInstitute || null,
    data: out
  };
}

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

// Admin export + delete-account confirmation modals (reuses shared initConfirmModals)
{
  const msg = document.getElementById('privacyMsg');
  const { openExportModal, openDeleteModal } = initConfirmModals({
    exportFn: gatherExportPayload,
    deleteDesc: 'This will permanently delete your account, institute, and ALL associated data (students, batches, payments, attendance, announcements, and all staff/parent accounts). This cannot be undone.',
    deleteFn: async () => {
      const { data: { session } } = await db.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No session');
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': CONFIG.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({})
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Deletion failed');
    },
    privacyMsg: msg
  });
  document.getElementById('exportDataBtn')?.addEventListener('click', openExportModal);
  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
    const isOwner = currentInstitute?.owner_id ? currentInstitute.owner_id === currentUser?.id : true;
    openDeleteModal(isOwner
      ? 'This will permanently delete your account, institute, and ALL associated data (students, batches, payments, attendance, announcements, and all staff/parent accounts). This cannot be undone.'
      : 'This will permanently delete your account and your personal data. This cannot be undone.');
  });
}

/* ── Init hooks ── */

function navigateToPage(page) {
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.click();
}

// ── Alerts / notifications bell ──

function buildDemoAlerts() {
  const alerts = [];
  const today = toDateKey(new Date());

  const students = buildDemoStudents();
  const unmarkedCount = students.filter(s => demoAttStatusFor(s.id, today) === 'unmarked').length;
  if (unmarkedCount > 0) {
    alerts.push({
      id: 'att-today',
      severity: 'warning',
      title: `${unmarkedCount} student${unmarkedCount !== 1 ? 's' : ''} have unmarked attendance today`,
      detail: 'Mark attendance in the Attendance section.',
      page: 'attendance'
    });
  }

  const duesToday = demoData.stats.duesToday || 0;
  if (duesToday > 0) {
    alerts.push({
      id: 'fee-today',
      severity: 'critical',
      title: `Fee due today: ${formatCurrencyINR(duesToday)}`,
      detail: 'Collect pending fees before the end of the day.',
      page: 'fees'
    });
  }

  const overdue = demoData.stats.overdue || 0;
  if (overdue > 0) {
    alerts.push({
      id: 'fee-overdue',
      severity: 'critical',
      title: `Overdue fees worth ${formatCurrencyINR(overdue)}`,
      detail: 'Follow up on overdue payments in the Fees section.',
      page: 'fees'
    });
  }

  const pending = demoData.stats.pending || 0;
  if (pending > 0) {
    alerts.push({
      id: 'fee-month',
      severity: 'info',
      title: `${formatCurrencyINR(pending)} in pending dues this month`,
      detail: 'Track collection in the Fees section.',
      page: 'fees'
    });
  }

  const invited = demoTeachersData.filter(u => u.status === 'invited').length + demoParentsData.filter(p => p.status === 'invited').length;
  if (invited > 0) {
    alerts.push({
      id: 'invites',
      severity: 'warning',
      title: `${invited} staff invitation${invited !== 1 ? 's' : ''} pending`,
      detail: 'Review pending invites in the Staff section.',
      page: 'staff'
    });
  }

  return alerts;
}

async function buildAlerts() {
  if (isDemoMode) return buildDemoAlerts();

  const alerts = [];
  const instituteId = userProfile?.institute_id;
  if (!instituteId) return alerts;

  const today = toDateKey(new Date());

  // Attendance check — non-fatal
  const batchRes = await safeQuery(() => db.from('batches').select('id').eq('institute_id', instituteId).is('deleted_at', null));
  if (batchRes.ok) {
    const batchIds = (batchRes.data || []).map(b => b.id);
    let studentIds = [];
    if (batchIds.length > 0) {
      const sbRes = await safeQuery(() => db.from('student_batches').select('student_id').in('batch_id', batchIds));
      if (sbRes.ok) studentIds = [...new Set((sbRes.data || []).map(r => r.student_id))];
    }
    if (studentIds.length > 0) {
      const attRes = await safeQuery(() =>
        db.from('attendance').select('student_id, status').eq('date', today).in('student_id', studentIds)
      );
      if (attRes.ok) {
        const attMap = {};
        (attRes.data || []).forEach(r => { attMap[r.student_id] = r.status; });
        const unmarked = studentIds.filter(id => !attMap[id] || attMap[id] === 'unmarked').length;
        if (unmarked > 0) {
          alerts.push({
            id: 'att-today', severity: 'warning',
            title: `${unmarked} student${unmarked !== 1 ? 's' : ''} have unmarked attendance today`,
            detail: 'Mark attendance in the Attendance section.', page: 'attendance'
          });
        }
      }
    }
  }

  // Fee check — non-fatal
  const studentRes = await safeQuery(() => db.from('students').select('id, full_name').eq('institute_id', instituteId).is('deleted_at', null));
  if (studentRes.ok) {
    const studentIds = (studentRes.data || []).map(s => s.id);
    const nameMap = {};
    (studentRes.data || []).forEach(s => { nameMap[s.id] = s.full_name; });

    if (studentIds.length > 0) {
      const dueRes = await safeQuery(() =>
        db.from('payments').select('student_id, amount, due_date').eq('status', 'pending').in('student_id', studentIds)
      );
      if (dueRes.ok) {
        const dueToday = (dueRes.data || []).filter(p => p.due_date && p.due_date.slice(0, 10) === today);
        if (dueToday.length > 0) {
          const total = dueToday.reduce((sum, p) => sum + (p.amount || 0), 0);
          alerts.push({
            id: 'fee-today', severity: 'critical',
            title: `Fee due today: ${formatCurrencyINR(total)}`,
            detail: dueToday.length === 1 && nameMap[dueToday[0].student_id]
              ? `${nameMap[dueToday[0].student_id]} has a fee due today.`
              : `${dueToday.length} students have fees due today.`, page: 'fees'
          });
        }
      }

      const overdueRes = await safeQuery(() =>
        db.from('payments').select('student_id, amount').eq('status', 'overdue').in('student_id', studentIds)
      );
      if (overdueRes.ok && (overdueRes.data || []).length > 0) {
        const total = overdueRes.data.reduce((sum, p) => sum + (p.amount || 0), 0);
        alerts.push({
          id: 'fee-overdue', severity: 'critical',
          title: `${overdueRes.data.length} overdue payment${overdueRes.data.length !== 1 ? 's' : ''} worth ${formatCurrencyINR(total)}`,
          detail: 'Follow up on overdue fees in the Fees section.', page: 'fees'
        });
      }
    }
  }

  // Invites check — non-fatal
  const inviteRes = await safeQuery(() =>
    db.from('invite_tokens').select('expires_at').eq('institute_id', instituteId).eq('role', 'teacher').eq('used', false)
  );
  if (inviteRes.ok) {
    const now = Date.now();
    const pendingInvites = (inviteRes.data || []).filter(t => !t.expires_at || new Date(t.expires_at).getTime() > now).length;
    if (pendingInvites > 0) {
      alerts.push({
        id: 'invites', severity: 'warning',
        title: `${pendingInvites} staff invitation${pendingInvites !== 1 ? 's' : ''} pending`,
        detail: 'Review pending invites in the Staff section.', page: 'staff'
      });
    }
  }

  return alerts;
}

function renderAlerts() {
  const list = document.getElementById('alertList');
  const empty = document.getElementById('alertEmpty');
  const badge = document.getElementById('alertBadge');
  const meta = document.getElementById('alertPanelMeta');
  if (!list) return;

  buildAlerts().then(alerts => {
    const count = alerts.length;
    if (badge) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.hidden = count === 0;
    }
    if (meta) meta.textContent = count > 0 ? `${count} action${count !== 1 ? 's' : ''} needed` : '';
    if (empty) empty.hidden = count > 0;
    list.innerHTML = alerts.map(a => `
      <li class="alert-item alert-item--${a.severity || 'info'}" ${a.page ? `onclick="navigateToPage('${a.page}')"` : ''}>
        <span class="alert-item-dot" aria-hidden="true"></span>
        <div class="alert-item-body">
          <div class="alert-item-title">${escapeHtml(a.title)}</div>
          ${a.detail ? `<div class="alert-item-detail">${escapeHtml(a.detail)}</div>` : ''}
        </div>
      </li>`).join('');
  }).catch(e => console.warn('renderAlerts failed', e));
}

function initAlerts() {
  const bell = document.getElementById('alertBell');
  const panel = document.getElementById('alertPanel');
  if (!bell || !panel) return;

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const willShow = panel.hidden;
    panel.hidden = !willShow;
    bell.setAttribute('aria-expanded', String(willShow));
    if (willShow) renderAlerts();
  });

  document.addEventListener('click', (e) => {
    if (!panel.hidden && !e.target.closest('.alert-wrap')) {
      panel.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
    }
  });

  renderAlerts();
}

function onReady() {
  initAlerts();
  document.body.classList.add('page-dashboard');

  // Init all custom selects
  initCustomSelect('studentBatchFilter', [{value:'', label:'All Batches'}], '', () => {
    if (window._studentsData) {
      const c = pageDataCache['students'];
      renderStudentsTable(window._studentsData, window._studentBatchIds || {}, c ? c.batchMap : {});
    }
  });
  initCustomSelect('feesFilterSelect', [{value:'all', label:'All'},{value:'paid', label:'Paid'},{value:'pending', label:'Pending'}], 'all', () => renderFeesTable());
  initCustomSelect('attFilterSelect', [{value:'all', label:'All'},{value:'present', label:'Present'},{value:'absent', label:'Absent'},{value:'unmarked', label:'Unmarked'}], 'all', () => renderAttTable());
  initCustomSelect('announcementFilter', [{value:'', label:'Everyone'},{value:'teacher', label:'Teachers'},{value:'parent', label:'Parents'}], '', () => { if (typeof applyAnnouncementFilters === 'function') applyAnnouncementFilters(); });
  initCustomSelect('staffStatusFilter', [{value:'', label:'All'},{value:'active', label:'Active'},{value:'invited', label:'Pending'}], '', () => applyStaffParentsFilter('staffTableBody'));
  initCustomSelect('parentsStatusFilter', [{value:'', label:'All'},{value:'active', label:'Active'},{value:'invited', label:'Pending'}], '', () => applyStaffParentsFilter('parentsTableBody'));
  initCustomSelect('inviteStudent', [{value:'', label:'Select student...'}], '');
  initCustomSelect('studentBatch', [{value:'', label:'Select batch...'}], '');
  initCustomSelect('batchTeacher', [{value:'', label:'No teacher'}], '');
  initCustomSelect('feeBatch', [{value:'', label:'Select batch...'}], '', (batchId) => {
    if (batchId) loadStudentsForFeeSelect(batchId);
    else setCustomSelectOptions('feeStudent', [{value:'', label:'Select student...'}], '');
  });
  initCustomSelect('feeStudent', [{value:'', label:'Select student...'}], '');
  initCustomSelect('announcementAudience', [{value:'all', label:'Everyone'},{value:'teachers', label:'Teachers Only'},{value:'parents', label:'Parents Only'}], 'all');

  const announcementsViewAll = document.getElementById('announcementsViewAll');
  if (announcementsViewAll) {
    announcementsViewAll.addEventListener('click', () => navigateToPage('announcements'));
  }

  // Refresh dashboard analytics on window resize (Chart.js needs re-render after layout changes)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Object.keys(dashboardCharts).some(k => dashboardCharts[k])) {
        destroyDashboardCharts();
        scheduleDashboardAnalytics();
      }
    }, 250);
  });

  // First-login onboarding tour (admin only). Runs after the dashboard has painted.
  if (typeof maybeStartOnboarding === 'function') {
    setTimeout(maybeStartOnboarding, 900);
  }
}

// ── Init ──
sharedInit('admin');
