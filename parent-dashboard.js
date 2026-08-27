// PingClass Parent Dashboard JS
// Works alongside shared.js — defines parent-specific page logic

function toDateKey(d) {
  var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

// ── Helper: Get linked student IDs for this parent ──

async function getChildStudentIds() {
  if (!currentUser?.id) return [];
  const { data } = await safeQuery(() =>
    db.from('parent_student_links')
      .select('student_id')
      .eq('parent_id', currentUser.id)
  );
  return (data || []).map(l => l.student_id);
}

// ── Parent dashboard: child summary (fees + attendance + alerts) ──

function parentMonthRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    today: toDateKey(now),
    yearStart: now.getFullYear() + '-01-01',
    monthStart: toDateKey(monthStart),
    monthEnd: toDateKey(monthEnd),
    monthLabel: now.toLocaleDateString('en-IN', { month: 'short' }),
    yearLabel: String(now.getFullYear())
  };
}

function fmtParentDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function computeAttendancePct(rows, from, to) {
  const inRange = (rows || []).filter(a => a.date >= from && a.date <= to);
  const present = inRange.filter(a => a.status === 'present' || a.status === 'late').length;
  return {
    total: inRange.length,
    present,
    pct: inRange.length ? Math.round((present / inRange.length) * 100) : null
  };
}

// The child's fee situation: the payment relevant to the current month and any
// overdue installments (status pending with a due date before today).
function parentFeeInfo(payments, r) {
  const pending = (payments || []).filter(p => p.status === 'pending');
  const overdue = pending.filter(p => p.due_date && p.due_date < r.today);
  const overdueTotal = overdue.reduce((s, p) => s + (p.amount || 0), 0);
  let oldestDue = null;
  overdue.forEach(p => { if (!oldestDue || p.due_date < oldestDue) oldestDue = p.due_date; });

  let month = (payments || [])
    .filter(p => p.due_date && p.due_date >= r.monthStart && p.due_date <= r.monthEnd)
    .sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''))[0] || null;
  // If nothing is due this month, the child may have paid an installment this month.
  if (!month) {
    month = (payments || [])
      .filter(p => p.status === 'paid' && p.paid_at && p.paid_at.slice(0, 10) >= r.monthStart && p.paid_at.slice(0, 10) <= r.monthEnd)
      .sort((a, b) => (b.paid_at || '').localeCompare(a.paid_at || ''))[0] || null;
  }

  return { month, overdueTotal, overdueCount: overdue.length, oldestDue };
}

// Most recent attendance day (<= today): used to flag an absence.
function latestAbsentDay(att, r) {
  const rows = (att || []).filter(a => a.date <= r.today);
  if (!rows.length) return null;
  let latestDate = null;
  rows.forEach(a => { if (!latestDate || a.date > latestDate) latestDate = a.date; });
  if (rows.some(a => a.date === latestDate && a.status === 'absent')) return { date: latestDate };
  return null;
}

function setParentFeeCard(info, r) {
  const val = document.getElementById('parentMonthFee');
  const sub = document.getElementById('parentMonthFeeSub');
  const icon = document.getElementById('monthFeeIcon');
  if (!val || !sub) return;
  const m = info && info.month;
  if (m) {
    val.textContent = `\u20B9${(m.amount || 0).toLocaleString('en-IN')}`;
    if (m.status === 'paid') {
      sub.textContent = 'Paid this month';
      sub.style.color = '#4ADE80';
      if (icon) { icon.classList.add('collected'); icon.classList.remove('pending'); }
    } else {
      sub.textContent = m.due_date ? 'Due ' + fmtParentDate(m.due_date) : 'Due this month';
      sub.style.color = '#FBBF24';
      if (icon) { icon.classList.add('pending'); icon.classList.remove('collected'); }
    }
  } else {
    val.textContent = '\u20B90';
    sub.textContent = 'No fee due this month';
    sub.style.color = '';
    if (icon) { icon.classList.remove('pending', 'collected'); }
  }
}

function setParentOverdueCard(info) {
  const val = document.getElementById('parentOverdue');
  const sub = document.getElementById('parentOverdueSub');
  const icon = document.getElementById('overdueIcon');
  if (!val || !sub) return;
  if (info.overdueTotal > 0) {
    val.textContent = `\u20B9${info.overdueTotal.toLocaleString('en-IN')}`;
    sub.textContent = `${info.overdueCount} fee${info.overdueCount !== 1 ? 's' : ''} past due`;
    sub.style.color = '#F87171';
    if (icon) { icon.classList.add('pending'); icon.classList.remove('collected'); }
  } else {
    val.textContent = '\u20B90';
    sub.textContent = 'All fees paid';
    sub.style.color = '#4ADE80';
    if (icon) { icon.classList.add('collected'); icon.classList.remove('pending'); }
  }
}

function setParentAttCards(month, r) {
  const mVal = document.getElementById('parentAttMonth');
  const mSub = document.getElementById('parentAttMonthSub');
  if (mVal) mVal.textContent = month.pct === null ? '--' : month.pct + '%';
  if (mSub) mSub.textContent = month.pct === null ? r.monthLabel + ' \u00B7 no records' : `${r.monthLabel} \u00B7 ${month.present} of ${month.total} days`;
}

function renderParentAttRate(el, month, year) {
  if (!el) return;
  function row(label, info) {
    const pct = info.pct === null ? 0 : info.pct;
    const fillClass = pct < 50 ? ' att-rate-fill--critical' : pct < 75 ? ' att-rate-fill--low' : '';
    const color = pct < 50 ? '#F87171' : pct < 75 ? '#FBBF24' : '';
    const valText = info.pct === null ? '--' : info.pct + '%';
    const det = info.pct === null ? 'No records yet' : `${info.present} of ${info.total} days present`;
    return `<div class="att-rate-row">
      <div class="att-rate-head">
        <span class="att-rate-label">${label}</span>
        <span class="att-rate-value" style="color:${color}">${valText}</span>
      </div>
      <div class="att-rate-track"><div class="att-rate-fill${fillClass}" style="width:${pct}%"></div></div>
      <span class="att-rate-detail">${det}</span>
    </div>`;
  }
  el.innerHTML = row('This Month', month) + row('This Year', year);
}

const PARENT_ALERT_ICONS = {
  danger: '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>',
  warning: '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>',
  info: '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>'
};

function buildParentAlerts({ month, overdueTotal, overdueCount, oldestDue, att, latest, r }) {
  const alerts = [];
  const fmt = n => `\u20B9${(n || 0).toLocaleString('en-IN')}`;

  // Fee dues / overdue
  if (overdueTotal > 0) {
    alerts.push({
      severity: 'danger',
      title: `${fmt(overdueTotal)} overdue`,
      detail: `${overdueCount} fee${overdueCount !== 1 ? 's' : ''} past due${oldestDue ? ' \u00B7 oldest due ' + fmtParentDate(oldestDue) : ''}`,
      page: 'fees'
    });
  } else if (month && month.status === 'pending' && month.due_date && month.due_date >= r.today) {
    alerts.push({
      severity: 'warning',
      title: `${fmt(month.amount)} due this month`,
      detail: `Due ${fmtParentDate(month.due_date)} \u00B7 pay before the due date to avoid a late fee`,
      page: 'fees'
    });
  }

  // Absent on the child's most recent school day
  const absentInfo = latestAbsentDay(att, r);
  if (absentInfo) {
    alerts.push({
      severity: 'danger',
      title: `Absent on ${fmtParentDate(absentInfo.date)}`,
      detail: 'Your child was marked absent on their last school day',
      page: 'attendance'
    });
  }

  // New announcement (within the last 7 days)
  if (latest && latest.created_at) {
    const created = new Date(latest.created_at).getTime();
    if (created >= Date.now() - 7 * 24 * 60 * 60 * 1000) {
      alerts.push({
        severity: 'info',
        title: 'New announcement: ' + latest.title,
        detail: 'Tap to read the latest update from your child\u2019s institute',
        page: 'announcements'
      });
    }
  }

  return alerts;
}

function renderParentAlerts(alerts) {
  const wrap = document.getElementById('parentAlerts');
  if (!wrap) return;
  if (!alerts || alerts.length === 0) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = alerts.map(a => `
    <button type="button" class="parent-alert parent-alert--${a.severity}" onclick="navigateToPage('${a.page}'); return false;">
      <span class="parent-alert-icon">${PARENT_ALERT_ICONS[a.severity] || PARENT_ALERT_ICONS.info}</span>
      <span class="parent-alert-body">
        <span class="parent-alert-title">${escapeHtml(a.title)}</span>
        ${a.detail ? `<span class="parent-alert-detail">${escapeHtml(a.detail)}</span>` : ''}
      </span>
      <span class="parent-alert-cta">View</span>
    </button>`).join('');
  wrap.style.display = 'flex';
}

async function loadStats() {
  const skel = document.getElementById('dashboardSkeleton');
  const welcome = document.getElementById('dashboardWelcome');
  const stats = document.getElementById('dashboardStats');
  const analytics = document.querySelector('#page-dashboard .analytics-grid');
  const alerts = document.getElementById('parentAlerts');

  try {

  if (isDemoMode) {
    // Load demo data first.
    const r = parentMonthRange();
    const demoDue = new Date();
    demoDue.setDate(demoDue.getDate() + 5);
    const dueStr = toDateKey(demoDue);
    const month = { pct: 92, present: 23, total: 25 };
    const year = { pct: 88, present: 240, total: 273 };

    setParentFeeCard({ month: { amount: 2500, status: 'pending', due_date: dueStr } }, r);
    setParentOverdueCard({ overdueTotal: 0, overdueCount: 0 });
    setParentAttCards(month, r);
    renderParentAttRate(document.getElementById('parentAttRate'), month, year);

    _parentBellAlerts = [
      {
        severity: 'warning',
        title: '\u20B92,500 due this month',
        detail: `Due ${fmtParentDate(dueStr)} \u00B7 pay before the due date to avoid a late fee`,
        page: 'fees'
      },
      {
        severity: 'info',
        title: 'New announcement: Math final exam scheduled',
        detail: 'Tap to read the latest update from your child\u2019s institute',
        page: 'announcements'
      }
    ];
    renderParentAlerts(_parentBellAlerts);

    // Demo mode: use ephemeral alerts for bell icon
    _parentDbNotifications = _parentBellAlerts.map((a, i) => ({
      id: 'demo-' + i,
      type: a.severity === 'warning' ? 'fee_reminder' : 'fee_due_today',
      title: a.title,
      body: a.detail || '',
      read_at: null,
      created_at: new Date().toISOString()
    }));
    renderParentBellAlerts();

    // Load announcements while skeleton is still visible.
    const demoList = demoAnnouncements
      .filter(a => a.target !== 'teachers')
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 3);
    renderLatestAnnouncements(document.getElementById('parentAnnouncementBody'), demoList);

    // Now hide skeleton and show all content at once.
    if (skel) skel.style.display = 'none';
    if (welcome) welcome.style.display = '';
    if (stats) stats.style.display = '';
    if (alerts) alerts.style.display = '';
    if (analytics) analytics.style.display = '';
    return;
  }

  if (skel) skel.style.display = '';
  if (welcome) welcome.style.display = 'none';
  if (stats) stats.style.display = 'none';
  if (analytics) analytics.style.display = 'none';
  if (alerts) alerts.style.display = 'none';

  const r = parentMonthRange();
  const studentIds = await getChildStudentIds();

  let payments = [];
  let att = [];
  if (studentIds.length > 0) {
    const [payRes, attRes] = await Promise.all([
      db.from('payments').select('amount, status, due_date, paid_at').in('student_id', studentIds),
      db.from('attendance').select('status, date').in('student_id', studentIds).gte('date', r.yearStart)
    ]);
    payments = payRes.data || [];
    att = attRes.data || [];
  }

  const feeInfo = parentFeeInfo(payments, r);
  const attMonth = computeAttendancePct(att, r.monthStart, r.monthEnd);
  const attYear = computeAttendancePct(att, r.yearStart, r.today);

  setParentFeeCard(feeInfo, r);
  setParentOverdueCard(feeInfo);
  setParentAttCards(attMonth, r);
  renderParentAttRate(document.getElementById('parentAttRate'), attMonth, attYear);

  const latestList = await fetchLatestAnnouncements();
  const latest = latestList[0] || null;
  renderLatestAnnouncements(document.getElementById('parentAnnouncementBody'), latestList);
  _parentBellAlerts = buildParentAlerts({
    month: feeInfo.month,
    overdueTotal: feeInfo.overdueTotal,
    overdueCount: feeInfo.overdueCount,
    oldestDue: feeInfo.oldestDue,
    att,
    latest,
    r
  });
  renderParentAlerts(_parentBellAlerts);

  // Fetch DB-backed notifications for bell icon
  _parentDbNotifications = await fetchParentNotifications();
  renderParentBellAlerts();

  // Hide skeleton, show real content
  if (skel) skel.style.display = 'none';
  if (welcome) welcome.style.display = '';
  if (stats) stats.style.display = '';
  if (alerts) alerts.style.display = '';
  if (analytics) analytics.style.display = '';
  } catch (err) {
    // If anything fails, hide skeleton and show what we can
    if (skel) skel.style.display = 'none';
    if (welcome) welcome.style.display = '';
    if (stats) stats.style.display = '';
    if (analytics) analytics.style.display = '';
  }
}

// ── Fees Page ──

const pageDataCache = {};

async function populateFeesPage() {
  if (pageDataCache['fees']) {
    renderFeesTable(pageDataCache['fees']);
    return;
  }
  const studentIds = await getChildStudentIds();
  if (studentIds.length === 0) {
    document.querySelector('#page-fees .page-table-wrap .page-table').style.display = 'none';
    document.getElementById('feesEmpty').style.display = 'flex';
    return;
  }

  const { data: payments } = await safeQuery(() =>
    db.from('payments')
      .select('id, amount, status, due_date, paid_at')
      .in('student_id', studentIds)
      .order('due_date', { ascending: false })
  );

  let pendingTotal = 0;
  let paidTotal = 0;
  (payments || []).forEach(p => {
    if (p.status === 'pending') pendingTotal += p.amount || 0;
    else if (p.status === 'paid') paidTotal += p.amount || 0;
  });

  pageDataCache['fees'] = { payments: payments || [], pendingTotal, paidTotal };
  renderFeesTable(pageDataCache['fees']);
}

function renderFeesTable({ payments, pendingTotal, paidTotal }) {
  document.getElementById('feesPendingTotal').textContent = `\u20B9${pendingTotal.toLocaleString('en-IN')}`;
  document.getElementById('feesPaidTotal').textContent = `\u20B9${paidTotal.toLocaleString('en-IN')}`;

  const tbody = document.getElementById('feesTableBody');
  const empty = document.getElementById('feesEmpty');
  const table = document.querySelector('#page-fees .page-table');

  if (!payments || payments.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = payments.map(p => {
    const dueStr = p.due_date ? new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
    const paidStr = p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
    const statusClass = p.status === 'paid' ? 'staff-status-active' : 'staff-status-invited';
    const statusLabel = p.status === 'paid' ? 'Paid' : 'Pending';
    return `<tr>
      <td style="font-weight:600">\u20B9${(p.amount || 0).toLocaleString('en-IN')}</td>
      <td><span class="staff-status ${statusClass}"><span class="staff-status-dot"></span>${statusLabel}</span></td>
      <td><span class="staff-date">${dueStr}</span></td>
      <td><span class="staff-date">${paidStr}</span></td>
    </tr>`;
  }).join('');
}

// ── Attendance Page ──

async function populateAttendancePage() {
  if (pageDataCache['attendance']) {
    renderAttendanceTable(pageDataCache['attendance']);
    return;
  }
  const studentIds = await getChildStudentIds();
  if (studentIds.length === 0) {
    document.querySelector('#page-attendance .page-table-wrap .page-table').style.display = 'none';
    document.getElementById('attendanceEmpty').style.display = 'flex';
    return;
  }

  const { data: attendance } = await safeQuery(() =>
    db.from('attendance')
      .select('date, status')
      .in('student_id', studentIds)
      .order('date', { ascending: false })
      .limit(30)
  );

  const records = attendance || [];
  const present = records.filter(a => a.status === 'present').length;
  const absent = records.filter(a => a.status === 'absent').length;

  pageDataCache['attendance'] = { records, present, absent };
  renderAttendanceTable(pageDataCache['attendance']);
}

function renderAttendanceTable({ records, present, absent }) {
  document.getElementById('attPresentCount').textContent = present;
  document.getElementById('attAbsentCount').textContent = absent;

  const tbody = document.getElementById('attendanceTableBody');
  const empty = document.getElementById('attendanceEmpty');
  const table = document.querySelector('#page-attendance .page-table');

  if (records.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = records.map(a => {
    const dateStr = new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const statusClass = a.status === 'present' ? 'staff-status-active' : 'staff-status-expired';
    const statusLabel = a.status === 'present' ? 'Present' : 'Absent';
    return `<tr>
      <td><span class="staff-date">${dateStr}</span></td>
      <td><span class="staff-status ${statusClass}"><span class="staff-status-dot"></span>${statusLabel}</span></td>
    </tr>`;
  }).join('');
}

// ── Announcements Page (read-only) ──

let announcementsCache = null;

async function populateAnnouncementsPage() {
  if (isDemoMode) {
    renderAnnouncements(demoAnnouncements);
    setAnnouncementsLoadMore(false);
    return;
  }
  if (!currentInstitute?.id) return;

  // Serve from cache so re-opening the page doesn't flash the skeleton or
  // hit the network again.
  if (announcementsCache) {
    renderAnnouncements(announcementsCache.list, announcementsCache.hasMore);
    setAnnouncementsLoadMore(announcementsCache.hasMore);
    return;
  }

  resetAnnouncementsPager();
  const { data, done } = await fetchAnnouncementsPage();
  announcementsCache = { list: data, hasMore: !done };
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
      list.innerHTML = announcements.map(a => announcementCardHTML(a)).join('');
    }
    if (empty) empty.style.display = 'none';
  }

  setAnnouncementsLoadMore(hasMore);
}

document.getElementById('announcementsLoadMore')?.addEventListener('click', async () => {
  const btn = document.getElementById('announcementsLoadMore');
  const { data, done } = await withLoading(btn, () => fetchAnnouncementsPage(), { label: 'Loading...' });
  const list = document.getElementById('announcementsList');
  if (list && data.length) {
    list.insertAdjacentHTML('beforeend', data.map(a => announcementCardHTML(a)).join(''));
    announcementsCache = { list: [...(announcementsCache ? announcementsCache.list : []), ...data], hasMore: !done };
    applyAnnouncementFilters();
  }
  setAnnouncementsLoadMore(!done);
});

// ── Settings Page ──

// Settings is static (privacy/terms + export/delete), but the shared page
// router calls populateSettingsPage when present — keep it a no-op so the
// section resolves cleanly.
function populateSettingsPage() {}

// ── Privacy & Data export (DPDP) ──

async function gatherExportPayload() {
  const out = {};
  const uid = currentUser?.id;

  const userRes = await safeQuery(() => db.from('users').select('*').eq('id', uid).single());
  out.users = userRes.ok ? userRes.data : null;

  const studentIds = await getChildStudentIds();

  if (uid) {
    const linkRes = await safeQuery(() => db.from('parent_student_links').select('*').eq('parent_id', uid));
    out.parent_student_links = linkRes.ok ? linkRes.data : [];
  }

  if (studentIds.length > 0) {
    const studentsRes = await safeQuery(() => db.from('students').select('*').in('id', studentIds).is('deleted_at', null));
    out.students = studentsRes.ok ? studentsRes.data : [];

    const sbRes = await safeQuery(() => db.from('student_batches').select('*').in('student_id', studentIds));
    out.student_batches = sbRes.ok ? sbRes.data : [];

    const payRes = await safeQuery(() => db.from('payments').select('*').in('student_id', studentIds));
    out.payments = payRes.ok ? payRes.data : [];

    const attRes = await safeQuery(() => db.from('attendance').select('*').in('student_id', studentIds));
    out.attendance = attRes.ok ? attRes.data : [];
  }

  if (currentInstitute?.id) {
    const annRes = await safeQuery(() => db.from('announcements').select('*').eq('institute_id', currentInstitute.id));
    out.announcements = annRes.ok ? annRes.data : [];
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

// ── Skeleton Loading ──
const _parentSkeletonTemplates = {
  fees: () => `
    <div class="skeleton-table-rows">
      ${Array(5).fill('').map((_, i) => `
        <div class="skeleton-table-row" style="animation-delay:${i * 0.05}s">
          <span class="skeleton"></span>
          <span class="skeleton"></span>
          <span class="skeleton"></span>
          <span class="skeleton"></span>
          <span class="skeleton"></span>
          <span class="skeleton"></span>
        </div>`).join('')}
    </div>`,
  attendance: () => `
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="skeleton" style="width:120px;height:36px;border-radius:10px"></div>
      <div class="skeleton" style="width:120px;height:36px;border-radius:10px"></div>
    </div>
    <div class="skeleton" style="width:100%;height:200px;border-radius:var(--radius-lg)"></div>`,
  announcements: () => `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${Array(3).fill('').map((_, i) => `
        <div class="skeleton-announcement" style="animation-delay:${i * 0.06}s">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-body"></div>
          <div class="skeleton skeleton-body-sm"></div>
          <div class="skeleton skeleton-meta"></div>
        </div>`).join('')}
    </div>`
};

function showSkeletons(pageName) {
  const page = document.getElementById('page-' + pageName);
  if (!page) return;
  const template = _parentSkeletonTemplates[pageName];
  if (!template) return;

  let container = page.querySelector('.skeleton-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'skeleton-container';
    const contentWrap = page.querySelector('.page-table-wrap, .batches-grid, .announcements-list, .attendance-stats-row, .analytics-grid');
    if (contentWrap) {
      contentWrap.parentNode.insertBefore(container, contentWrap);
    } else {
      page.appendChild(container);
    }
  }
  container.innerHTML = template();
  container.classList.add('active');

  page.querySelectorAll('.page-table-wrap, .batches-grid, .announcements-list, .attendance-stats-row, .analytics-grid, .welcome, .stats-grid').forEach(el => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.15s';
  });
}

function hideSkeletons(pageName) {
  const page = document.getElementById('page-' + pageName);
  if (!page) return;
  const container = page.querySelector('.skeleton-container');
  if (container) container.classList.remove('active');

  page.querySelectorAll('.page-table-wrap, .batches-grid, .announcements-list, .attendance-stats-row, .analytics-grid, .welcome, .stats-grid').forEach(el => {
    el.style.opacity = '';
    el.style.transition = '';
  });
}

// ── Bell icon alerts (DB-backed) ──
let _parentDbNotifications = [];
let _parentBellRead = false;
let _lastBellCount = 0;

const NOTIF_ICONS = {
  fee_reminder: '💰',
  fee_due_today: '⏰',
  fee_overdue: '🔴',
  payment_confirmed: '✅'
};

const NOTIF_PAGES = {
  fee_reminder: 'fees',
  fee_due_today: 'fees',
  fee_overdue: 'fees',
  payment_confirmed: 'fees'
};

async function fetchParentNotifications() {
  if (isDemoMode || !currentUser?.id) return [];
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return [];
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.notifications || [];
  } catch (e) {
    return [];
  }
}

async function markNotificationsRead(ids) {
  if (isDemoMode || !currentUser?.id) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    await fetch(`${SUPABASE_URL}/functions/v1/notifications`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });
  } catch (e) { /* ignore */ }
}

async function markAllNotificationsRead() {
  if (isDemoMode || !currentUser?.id) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    await fetch(`${SUPABASE_URL}/functions/v1/notifications`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ markAll: true })
    });
  } catch (e) { /* ignore */ }
}

function renderParentBellAlerts() {
  const list = document.getElementById('alertList');
  const empty = document.getElementById('alertEmpty');
  const badge = document.getElementById('alertBadge');
  const meta = document.getElementById('alertPanelMeta');
  if (!list) return;

  const alerts = _parentDbNotifications;
  const count = alerts.length;

  if (count > 0 && _parentBellRead && _lastBellCount !== count) {
    _parentBellRead = false;
  }
  _lastBellCount = count;

  if (badge) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.hidden = count === 0 || _parentBellRead;
  }
  if (meta) meta.textContent = count > 0 ? `${count} alert${count !== 1 ? 's' : ''}` : '';
  if (empty) empty.hidden = count > 0;
  list.innerHTML = alerts.map(a => {
    const page = NOTIF_PAGES[a.type] || 'dashboard';
    const icon = NOTIF_ICONS[a.type] || '🔔';
    const timeAgo = getTimeAgo(a.created_at);
    return `
    <li class="alert-item alert-item--${a.type === 'fee_overdue' ? 'danger' : a.type === 'fee_due_today' ? 'warning' : 'info'}"
        onclick="navigateToPage('${page}'); window._notifMarkRead('${a.id}');">
      <span class="alert-item-dot" aria-hidden="true">${icon}</span>
      <div class="alert-item-body">
        <div class="alert-item-title">${escapeHtml(a.title)}</div>
        <div class="alert-item-detail">${escapeHtml(a.body)} · ${timeAgo}</div>
      </div>
    </li>`;
  }).join('');
}

window._notifMarkRead = async function(id) {
  await markNotificationsRead([id]);
  _parentDbNotifications = _parentDbNotifications.filter(n => n.id !== id);
  renderParentBellAlerts();
};

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function initParentAlerts() {
  const bell = document.getElementById('alertBell');
  const panel = document.getElementById('alertPanel');
  if (!bell || !panel) return;

  // Load notifications from DB (skip in demo mode — already set by loadStats)
  if (!isDemoMode) {
    _parentDbNotifications = await fetchParentNotifications();
  }
  renderParentBellAlerts();

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const willShow = panel.hidden;
    panel.hidden = !willShow;
    bell.setAttribute('aria-expanded', String(willShow));
    if (willShow) {
      _parentBellRead = true;
      markAllNotificationsRead();
      // Clear badge visually
      _parentDbNotifications.forEach(n => n.read_at = n.read_at || new Date().toISOString());
      renderParentBellAlerts();
    }
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
}

// ── Push notification subscription ──
async function initPushSubscription() {
  if (isDemoMode || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Check if already subscribed
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) return; // Already subscribed

    // Check notification permission
    if (Notification.permission === 'denied') return;

    // Request permission if not yet determined
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    // Subscribe to push
    const vapidKey = CONFIG.VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // Store subscription in DB
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;

    await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/push-subscribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: newSubscription.endpoint,
        p256dh: newSubscription.keys.p256dh,
        auth: newSubscription.keys.auth
      })
    });
  } catch (e) {
    // Push subscription failed silently — not critical
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Notification Preferences ──
const NOTIF_PREF_FIELDS = [
  'in_app_enabled', 'push_enabled', 'email_enabled',
  'fee_reminders', 'fee_due_today', 'fee_overdue', 'payment_confirmed'
];

const NOTIF_PREF_MAP = {
  prefInApp: 'in_app_enabled',
  prefPush: 'push_enabled',
  prefEmail: 'email_enabled',
  prefFeeReminders: 'fee_reminders',
  prefFeeDueToday: 'fee_due_today',
  prefFeeOverdue: 'fee_overdue',
  prefPaymentConfirmed: 'payment_confirmed'
};

async function loadNotifPrefs() {
  if (isDemoMode || !currentUser?.id) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notifications`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    // Use direct DB query instead
    const { data } = await db.from('notification_preferences')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (data) {
      Object.entries(NOTIF_PREF_MAP).forEach(([elId, field]) => {
        const el = document.getElementById(elId);
        if (el) el.checked = data[field] !== false;
      });
    }
  } catch (e) { /* ignore */ }
}

async function saveNotifPrefs() {
  if (isDemoMode || !currentUser?.id) return;
  const msgEl = document.getElementById('notifPrefsMsg');
  try {
    const prefs = {};
    Object.entries(NOTIF_PREF_MAP).forEach(([elId, field]) => {
      const el = document.getElementById(elId);
      prefs[field] = el ? el.checked : true;
    });

    const { error } = await db.from('notification_preferences').upsert({
      user_id: currentUser.id,
      ...prefs,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) throw error;
    if (msgEl) { msgEl.textContent = 'Saved!'; msgEl.style.color = '#4ADE80'; }
  } catch (e) {
    if (msgEl) { msgEl.textContent = 'Error saving'; msgEl.style.color = '#F87171'; }
  }
}

// ── Init ──
setupPrivacyData(gatherExportPayload);
sharedInit('parent');
initParentAlerts();
initPushSubscription();
loadNotifPrefs();

document.getElementById('saveNotifPrefs')?.addEventListener('click', saveNotifPrefs);

// First-login onboarding tour. Runs after the dashboard has painted.
if (typeof maybeStartOnboarding === 'function') {
  setTimeout(maybeStartOnboarding, 900);
}
