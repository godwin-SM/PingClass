// PingClass Teacher Dashboard JS
// Works alongside shared.js — defines teacher-specific page logic

function toDateKey(d) {
  var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

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

// ── Scope helpers: this teacher's assigned batches & students ──

// Batches where teacher_id === currentUser.id (RLS: batches_teacher_read).
async function getTeacherBatches() {
  if (!currentUser?.id) return [];
  const res = await safeQuery(() =>
    db.from('batches').select('id').eq('teacher_id', currentUser.id).is('deleted_at', null)
  );
  return (res.ok ? res.data : []).map(b => b.id);
}

// Distinct student IDs across this teacher's batches (via student_batches;
// RLS: student_batches_teacher_read).
async function getTeacherStudentIds() {
  const batchIds = await getTeacherBatches();
  if (batchIds.length === 0) return [];
  const res = await safeQuery(() =>
    db.from('student_batches').select('student_id').in('batch_id', batchIds)
  );
  return [...new Set((res.ok ? res.data : []).map(s => s.student_id))];
}

// ── Overview Stats ──

async function loadStats() {
  const skel = document.getElementById('dashboardSkeleton');
  const welcome = document.getElementById('dashboardWelcome');
  const stats = document.getElementById('dashboardStats');
  const analytics = document.getElementById('teacherAnalytics');
  const announcement = document.getElementById('teacherAnnouncement');

  // Demo mode: the stat cards are filled by loadDemoMode via [data-demo], so
  // skip all network calls here and only prep the Needs Attention popup sample.
  if (isDemoMode) {
    teacherAtRiskDetail = [
      { name: 'Aarav Sharma', batch: 'Class 9 A', attendance: 62 },
      { name: 'Priya Nair', batch: 'Class 9 A', attendance: 48 },
      { name: 'Rahul Verma', batch: 'Class 10 B', attendance: 71 }
    ];
    renderTeacherAtRisk(teacherAtRiskDetail);
    const el = document.getElementById('needsAttention');
    if (el) el.textContent = teacherAtRiskDetail.length;

    // Load announcements while skeleton is still visible.
    let annList = [];
    try {
      annList = demoAnnouncements
        .filter(a => a.target !== 'parents')
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, 3);
    } catch (_) { /* ignore */ }
    renderLatestAnnouncements(document.getElementById('teacherAnnouncementBody'), annList);
    if (announcement) announcement.style.display = '';

    // Now hide skeleton and show all content at once.
    if (skel) skel.style.display = 'none';
    if (welcome) welcome.style.display = '';
    if (stats) stats.style.display = '';
    return;
  }

  if (!userProfile?.institute_id) return;

  // Show skeleton while data loads.
  if (skel) skel.style.display = '';
  if (welcome) welcome.style.display = 'none';
  if (stats) stats.style.display = 'none';
  if (analytics) analytics.style.display = 'none';
  if (announcement) announcement.style.display = 'none';

  const teacherBatchIds = await getTeacherBatches();
  const studentIds = await getTeacherStudentIds();

  document.getElementById('totalStudents').textContent = studentIds.length || 0;
  document.getElementById('totalBatches').textContent = teacherBatchIds.length || 0;

  // Attendance analytics: per-batch chart + at-risk students list.
  try {
    await loadTeacherAnalytics();
  } catch (err) {
    console.warn('Teacher analytics failed:', err);
  }

  // Load announcements while skeleton is still visible.
  try {
    const annList = await fetchLatestAnnouncements();
    renderLatestAnnouncements(document.getElementById('teacherAnnouncementBody'), annList);
    if (announcement) announcement.style.display = '';
  } catch (e) {
    console.warn('Teacher latest announcements failed:', e);
  }

  // Everything loaded — hide skeleton and show all content at once.
  if (skel) skel.style.display = 'none';
  if (welcome) welcome.style.display = '';
  if (stats) stats.style.display = '';
  if (analytics) analytics.style.display = '';
}

// Scope: teachers have no RLS read on fees/payments, so the overview surfaces
// attendance instead — an at-risk list (students < 75%) and a per-batch
// attendance bar chart. Attendance rows are scoped to this teacher's batches
// through RLS (attendance_teacher_read via is_batch_teacher(batch_id)).

// Full at-risk list (id, name, batch, attendance) — used by the "Needs
// Attention" stat card popup so it can show reason + suggested action.
let teacherAtRiskDetail = [];

async function loadTeacherAnalytics() {
  const analyticsEl = document.getElementById('teacherAnalytics');
  if (!analyticsEl) return;

  // Demo mode intentionally gets no teacher/parent analytics data (no demo
  // dashboard is built for these roles). The Needs Attention card gets a
  // sample list from loadStats() instead.
  if (isDemoMode || !currentUser?.id) {
    analyticsEl.style.display = 'none';
    return;
  }

  const teacherBatchIds = await getTeacherBatches();
  if (teacherBatchIds.length === 0) {
    analyticsEl.style.display = 'none';
    return;
  }

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('id, name').in('id', teacherBatchIds).is('deleted_at', null)
  );
  if (!batchesRes.ok) throw batchesRes.error;
  const batchNameMap = {};
  (batchesRes.data || []).forEach(b => { batchNameMap[b.id] = b.name; });

  const attRes = await safeQuery(() =>
    db.from('attendance').select('student_id, batch_id, status').in('batch_id', teacherBatchIds)
  );
  const rows = attRes.ok ? attRes.data : [];

  // Per-batch attendance aggregates.
  const batchAgg = {};
  rows.forEach(r => {
    if (!batchAgg[r.batch_id]) batchAgg[r.batch_id] = { total: 0, present: 0 };
    batchAgg[r.batch_id].total++;
    if (r.status === 'present' || r.status === 'late') batchAgg[r.batch_id].present++;
  });

  // Per-student attendance aggregates (across this teacher's batches).
  const studentAgg = {};
  rows.forEach(r => {
    if (!studentAgg[r.student_id]) studentAgg[r.student_id] = { total: 0, present: 0 };
    studentAgg[r.student_id].total++;
    if (r.status === 'present' || r.status === 'late') studentAgg[r.student_id].present++;
  });

  // At-risk students: attendance below 75% (with at least one record).
  const atRiskIds = Object.keys(studentAgg).filter(id => {
    const a = studentAgg[id];
    return a.total > 0 && (a.present / a.total) * 100 < 75;
  });

  const atRiskAll = atRiskIds.map(id => {
    const a = studentAgg[id];
    const pct = Math.round((a.present / a.total) * 100);
    return { id, attendance: pct };
  });
  atRiskAll.sort((a, b) => a.attendance - b.attendance);

  // Needs Attention stat card = count of at-risk students.
  document.getElementById('needsAttention').textContent = atRiskAll.length || 0;

  // Fetch names + primary batch for ALL at-risk students (the analytics table
  // shows the top 6; the Needs Attention popup shows every at-risk student).
  let nameMap = {};
  let studentBatchMap = {};
  if (atRiskAll.length > 0) {
    const allIds = atRiskAll.map(s => s.id);
    const studentsRes = await safeQuery(() =>
      db.from('students').select('id, full_name').in('id', allIds)
    );
    if (studentsRes.ok) (studentsRes.data || []).forEach(s => { nameMap[s.id] = s.full_name; });
    const linksRes = await safeQuery(() =>
      db.from('student_batches').select('student_id, batch_id').in('batch_id', teacherBatchIds)
    );
    if (linksRes.ok) (linksRes.data || []).forEach(l => {
      if (!studentBatchMap[l.student_id] && batchNameMap[l.batch_id]) {
        studentBatchMap[l.student_id] = batchNameMap[l.batch_id];
      }
    });
  }

  teacherAtRiskDetail = atRiskAll.map(s => ({
    id: s.id,
    name: nameMap[s.id] || 'Unknown',
    batch: studentBatchMap[s.id] || '\u2014',
    attendance: s.attendance
  }));

  const atRisk = atRiskAll.slice(0, 6).map(s => ({
    name: nameMap[s.id] || 'Unknown',
    batch: studentBatchMap[s.id] || '\u2014',
    attendance: s.attendance
  }));

  renderTeacherAtRisk(atRisk);

  // Chart data: one point per batch (overall attendance %).
  const chartData = (batchesRes.data || []).map(b => {
    const a = batchAgg[b.id];
    return {
      name: b.name,
      attendance: a && a.total > 0 ? Math.round((a.present / a.total) * 100) : null
    };
  });
  renderTeacherBatchChart(chartData);
}

// ── Teacher dashboard chart (lazy-loaded Chart.js) ──

const teacherCharts = {};

function destroyTeacherCharts() {
  Object.values(teacherCharts).forEach(c => {
    if (c && typeof c.destroy === 'function') c.destroy();
  });
  teacherCharts.batch = null;
}

let _teacherChartJsPromise = null;
function loadTeacherChartJS() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (!_teacherChartJsPromise) {
    _teacherChartJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'chart.umd.min.js';
      s.onload = () => resolve();
      s.onerror = () => {
        _teacherChartJsPromise = null;
        reject(new Error('Failed to load chart.umd.min.js'));
      };
      document.head.appendChild(s);
    });
  }
  return _teacherChartJsPromise;
}

async function renderTeacherBatchChart(batches) {
  const canvas = document.getElementById('teacherBatchChart');
  const empty = document.getElementById('teacherBatchChartEmpty');
  if (!canvas) return;

  try { await loadTeacherChartJS(); } catch (err) { return; }

  destroyTeacherCharts();

  const withData = (batches || []).filter(b => b.attendance !== null);
  if (withData.length === 0) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = '';
    canvas.parentElement.style.height = '320px';
    return;
  }

  canvas.style.display = '';
  if (empty) empty.style.display = 'none';

  const labels = withData.map(b => b.name);
  const values = withData.map(b => b.attendance);
  const chartHeight = Math.max(280, Math.min(withData.length * 54 + 90, 560));
  canvas.parentElement.style.height = chartHeight + 'px';

  const ctx = canvas.getContext('2d');
  teacherCharts.batch = new Chart(ctx, {
    type: 'bar',
    animation: { duration: 550, easing: 'easeOutQuart' },
    data: {
      labels,
      datasets: [{
        label: 'Attendance %',
        data: values,
        backgroundColor: values.map(v => v < 75 ? 'rgba(245, 158, 11, 0.8)' : 'rgba(45, 212, 191, 0.85)'),
        borderColor: values.map(v => v < 75 ? '#F59E0B' : '#2DD4BF'),
        borderWidth: 0,
        borderRadius: { topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0 },
        borderSkipped: false,
        maxBarThickness: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      interaction: { mode: 'index', axis: 'y', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(4, 26, 23, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          titleColor: 'rgba(255, 255, 255, 0.95)',
          bodyColor: 'rgba(255, 255, 255, 0.85)',
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: ctx => ' Attendance: ' + ctx.parsed.x + '%'
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          border: { display: false },
          ticks: {
            color: 'rgba(255, 255, 255, 0.45)',
            callback: value => value + '%',
            font: { size: 11 },
            stepSize: 20,
            maxTicksLimit: 6
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          border: { display: false },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: { size: 11 },
            autoSkip: false
          }
        }
      }
    }
  });
}

function renderTeacherAtRisk(students) {
  const tbody = document.getElementById('teacherAtRiskBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!students || students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:24px 10px">No students below 75% attendance right now.</td></tr>';
    return;
  }
  students.forEach(s => {
    const initials = escapeHtml((s.name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?');
    const pct = Math.min(100, Math.max(0, Math.round(s.attendance || 0)));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Student"><div class="analytics-student-cell"><span class="analytics-student-avatar">${initials}</span><span>${escapeHtml(s.name)}</span></div></td>
      <td data-label="Batch"><span class="analytics-batch-cell">${escapeHtml(s.batch || '\u2014')}</span></td>
      <td data-label="Attendance"><div class="analytics-att-cell"><span class="analytics-att-bar"><span style="width:${pct}%;background:${pct <= 50 ? '#DC2626' : '#F59E0B'}"></span></span><span class="analytics-att-text">${pct}%</span></div></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Needs Attention card popup (reason + suggested action) ──

function attentionAdvice(pct) {
  if (pct < 40) {
    return { reason: 'Critically low attendance', action: 'Immediate action: contact the parents and schedule a meeting.' };
  }
  if (pct < 60) {
    return { reason: 'Very low attendance', action: 'Contact the parents to understand the reason and agree on an improvement plan.' };
  }
  return { reason: 'Attendance below the 75% minimum', action: 'Talk to the student and monitor attendance over the next few weeks.' };
}

function openAttentionModal() {
  const modal = document.getElementById('attentionModal');
  const list = document.getElementById('attentionList');
  if (!modal || !list) return;
  if (!teacherAtRiskDetail.length) {
    list.innerHTML = '<div class="attention-empty">No students below 75% attendance right now. Keep it up!</div>';
  } else {
    list.innerHTML = teacherAtRiskDetail.map(s => {
      const advice = attentionAdvice(s.attendance);
      const pct = Math.min(100, Math.max(0, Math.round(s.attendance || 0)));
      return (
        '<div class="attention-item">' +
          '<div class="attention-item-head">' +
            '<span class="attention-item-name">' + escapeHtml(s.name) + '</span>' +
            '<span class="attention-item-badge" style="color:' + (pct <= 50 ? '#F87171' : '#FBBF24') + '">' + pct + '%</span>' +
          '</div>' +
          '<div class="attention-item-batch">' + escapeHtml(s.batch || '\u2014') + '</div>' +
          '<div class="attention-item-reason"><span>Reason:</span> ' + escapeHtml(advice.reason) + '</div>' +
          '<div class="attention-item-action"><span>Action:</span> ' + escapeHtml(advice.action) + '</div>' +
        '</div>'
      );
    }).join('');
  }
  modal.classList.add('open');
}

function closeAttentionModal() {
  document.getElementById('attentionModal')?.classList.remove('open');
}

function initAttentionModal() {
  document.getElementById('attentionCard')?.addEventListener('click', openAttentionModal);
  document.getElementById('attentionCard')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openAttentionModal();
    }
  });
  document.getElementById('attentionModalClose')?.addEventListener('click', closeAttentionModal);
  document.getElementById('attentionModalDone')?.addEventListener('click', closeAttentionModal);
  document.getElementById('attentionModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'attentionModal') closeAttentionModal();
  });
}

// ── Students Page (read-only) ──

const pageDataCache = {};
function invalidatePageCache(pageName) { delete pageDataCache[pageName]; }

let teacherStudentsData = null;

async function populateStudentsPage() {
  if (!currentUser?.id) return;

  if (pageDataCache['students']) {
    teacherStudentsData = pageDataCache['students'];
    renderStudentsTable();
    return;
  }

  const teacherBatchIds = await getTeacherBatches();

  // Load the teacher's own batches to populate the batch filter.
  let batchOptions = [];
  if (teacherBatchIds.length > 0) {
    const batchesRes = await safeQuery(() =>
      db.from('batches').select('id, name').in('id', teacherBatchIds).is('deleted_at', null).order('name')
    );
    batchOptions = batchesRes.ok ? batchesRes.data : [];
  }

  // Batch filter — only shown when the teacher is assigned to more than one batch.
  const filterWrap = document.querySelector('[data-select-id="teacherBatchFilter"]');
  if (filterWrap) {
    const options = [{value:'', label:'All Batches'}, ...batchOptions.map(b => ({value:b.id, label:b.name}))];
    setCustomSelectOptions('teacherBatchFilter', options, '');
    filterWrap.style.display = batchOptions.length > 1 ? '' : 'none';
  }

  const searchInput = document.querySelector('#page-students .section-search-input');
  if (searchInput) searchInput.value = '';

  const teacherStudentIds = await getTeacherStudentIds();

  let students = [];
  if (teacherStudentIds.length > 0) {
    const studentsRes = await safeQuery(() =>
      db.from('students').select('id, full_name, phone, created_at').in('id', teacherStudentIds).is('deleted_at', null)
    );
    students = studentsRes.ok ? studentsRes.data : [];
  }
  naturalNameSort(students);

  const batchIds = teacherBatchIds;

  let links = [];
  if (batchIds.length > 0) {
    const linksRes = await safeQuery(() =>
      db.from('student_batches').select('student_id, batch_id, batches(name)').in('batch_id', batchIds)
    );
    links = linksRes.ok ? linksRes.data : [];
  }

  const batchMap = {};
  const studentBatchIds = {};
  (links || []).forEach(l => {
    if (!batchMap[l.student_id]) batchMap[l.student_id] = [];
    if (l.batches) batchMap[l.student_id].push(l.batches.name);
    if (!studentBatchIds[l.student_id]) studentBatchIds[l.student_id] = [];
    studentBatchIds[l.student_id].push(l.batch_id);
  });

  teacherStudentsData = { students: students || [], batchMap, studentBatchIds };
  pageDataCache['students'] = teacherStudentsData;
  renderStudentsTable();
}

function renderStudentsTable() {
  if (!teacherStudentsData) return;
  const { students, batchMap, studentBatchIds } = teacherStudentsData;

  const filterBatchId = getCustomSelectValue('teacherBatchFilter');
  const searchInput = document.querySelector('#page-students .section-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = students.filter(s => {
    if (filterBatchId && !(studentBatchIds[s.id] || []).includes(filterBatchId)) return false;
    // Search works on name only.
    if (query && !(s.full_name || '').toLowerCase().includes(query)) return false;
    return true;
  });

  const tbody = document.getElementById('studentsTableBody');
  const empty = document.getElementById('studentsEmpty');
  const table = document.querySelector('#page-students .page-table');

  if (!filtered || filtered.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(s => {
    const initials = (s.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const batches = batchMap[s.id] || [];
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
    </tr>`;
  }).join('');
}

document.querySelector('#page-students .section-search-input')?.addEventListener('input', renderStudentsTable);

// ── Batches Page (read-only) ──

async function populateBatchesPage() {
  if (!currentUser?.id) return;

  const detail = document.getElementById('batchDetail');
  if (detail) detail.style.display = 'none';

  // Restore search to batch card mode
  const batchSearch = document.querySelector('#page-batches .section-search-input');
  if (batchSearch) {
    batchSearch.dataset.filter = 'batchesGrid';
    batchSearch.placeholder = 'Search batches...';
    batchSearch.value = '';
  }

  if (pageDataCache['batches']) {
    renderBatchesPage(pageDataCache['batches']);
    return;
  }

  const batchesRes = await safeQuery(() =>
    db.from('batches').select('id, name, schedule').eq('teacher_id', currentUser.id).is('deleted_at', null).order('name')
  );
  if (!batchesRes.ok) throw batchesRes.error;
  const batches = batchesRes.data;

  const batchIds = (batches || []).map(b => b.id);

  let feeMap = {};
  if (batchIds.length > 0) {
    const feeRes = await safeQuery(() => db.from('fees').select('batch_id, amount').in('batch_id', batchIds));
    if (feeRes.ok) (feeRes.data || []).forEach(f => { feeMap[f.batch_id] = f.amount; });
  }

  let countMap = {};
  if (batchIds.length > 0) {
    const countRes = await safeQuery(() =>
      db.from('student_batches').select('batch_id').in('batch_id', batchIds)
    );
    if (countRes.ok) (countRes.data || []).forEach(c => {
      countMap[c.batch_id] = (countMap[c.batch_id] || 0) + 1;
    });
  }

  pageDataCache['batches'] = { batches: batches || [], feeMap, countMap };
  renderBatchesPage(pageDataCache['batches']);
}

function renderBatchesPage({ batches, feeMap, countMap }) {
  const grid = document.getElementById('batchesGrid');
  const empty = document.getElementById('batchesEmpty');

  if (!batches || batches.length === 0) {
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (grid) grid.style.display = '';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = batches.map(b => {
    const fee = feeMap[b.id] || 0;
    return `
    <div class="batch-card" style="cursor:pointer" onclick="showBatchDetail('${b.id}')">
      <div class="batch-card-header">
        <h3>${escapeHtml(b.name)}</h3>
      </div>
      <div class="batch-card-meta">
        ${b.schedule ? `<span class="batch-meta-item"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>${escapeHtml(b.schedule)}</span>` : ''}
        ${fee ? `<span class="batch-meta-item"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>\u20B9${fee.toLocaleString('en-IN')}/mo</span>` : ''}
      </div>
      <div class="batch-card-count">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
        ${countMap[b.id] || 0} students
      </div>
    </div>
  `}).join('');
}

// ── Batch Detail View (read-only) ──

// Only ever resolves for batches assigned to this teacher — the batched
// queries are additionally scoped by RLS (batches_teacher_read,
// student_batches_teacher_read, attendance_teacher_read).
async function showBatchDetail(batchId) {
  const grid = document.getElementById('batchesGrid');
  const empty = document.getElementById('batchesEmpty');
  const detail = document.getElementById('batchDetail');
  if (!detail) return;

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
    db.from('batches').select('id, name, schedule').eq('id', batchId).eq('teacher_id', currentUser?.id).maybeSingle()
  );
  const batch = batchRes.ok ? batchRes.data : null;
  if (!batch) {
    hideBatchDetail();
    return;
  }

  const header = document.getElementById('batchDetailHeader');
  header.innerHTML = `
    <h2>${escapeHtml(batch.name)}</h2>
    <div class="batch-detail-meta">
      ${batch.schedule ? `<span class="batch-detail-meta-item"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>${escapeHtml(batch.schedule)}</span>` : ''}
    </div>
  `;

  const sbRes = await safeQuery(() => db.from('student_batches').select('student_id').eq('batch_id', batchId));
  const studentIds = (sbRes.ok ? sbRes.data : []).map(r => r.student_id);

  const tbody = document.getElementById('batchDetailStudents');
  const emptyEl = document.getElementById('batchDetailEmpty');

  if (studentIds.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'flex';
  } else {
    emptyEl.style.display = 'none';
    const studentsRes = await safeQuery(() => db.from('students').select('id, full_name, phone, created_at').in('id', studentIds));
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
  const detail = document.getElementById('batchDetail');
  if (detail) detail.style.display = 'none';
  const grid = document.getElementById('batchesGrid');
  if (grid) grid.style.display = '';
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

// Batches page search: filters batch cards by name, or students within the
// open batch detail by name (teacher has no fees/collected view to scope).
document.querySelector('#page-batches .section-search-input')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filterId = e.target.dataset.filter;
  const container = document.getElementById(filterId);
  if (!container) return;

  if (filterId === 'batchDetailStudents') {
    container.querySelectorAll('tr').forEach(row => {
      const nameCell = row.querySelector('td:first-child');
      const nameText = nameCell ? nameCell.textContent.toLowerCase() : row.textContent.toLowerCase();
      row.style.display = (!query || nameText.includes(query)) ? '' : 'none';
    });
  } else {
    container.querySelectorAll('.batch-card').forEach(card => {
      const nameEl = card.querySelector('h3');
      const nameText = nameEl ? nameEl.textContent.toLowerCase() : '';
      card.style.display = (!query || nameText.includes(query)) ? '' : 'none';
    });
  }
});

// ── Attendance Page ──

let attCurrentDate = toDateKey(new Date());

let attSelectedBatchId = null;

async function populateAttendancePage() {
  if (!currentUser?.id) return;
  attSelectedBatchId = null;

  document.getElementById('attBatchList').style.display = '';
  document.getElementById('attBatchDetail').style.display = 'none';

  const attSearch = document.querySelector('#page-attendance .section-search-input');
  if (attSearch) {
    attSearch.dataset.filter = 'attBatchesGrid';
    attSearch.placeholder = 'Search batches...';
    attSearch.value = '';
  }

  const today = toDateKey(new Date());
  const display = document.getElementById('attDateDisplay');
  if (attCurrentDate === today) {
    display.textContent = 'Today';
  } else {
    display.textContent = new Date(attCurrentDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const cacheKey = 'attendance_' + attCurrentDate;
  if (pageDataCache[cacheKey]) {
    const c = pageDataCache[cacheKey];
    document.getElementById('attPresentCount').textContent = c.present;
    document.getElementById('attAbsentCount').textContent = c.absent;
    document.getElementById('attUnmarkedCount').textContent = c.unmarked;
    renderAttBatchCards(c.batches, c.links, c.attMap);
    return;
  }

  const teacherBatchIds = await getTeacherBatches();
  const teacherStudentIds = await getTeacherStudentIds();

  let students = [];
  if (teacherStudentIds.length > 0) {
    const studentsRes = await safeQuery(() =>
      db.from('students').select('id, full_name').in('id', teacherStudentIds).is('deleted_at', null)
    );
    students = studentsRes.ok ? studentsRes.data : [];
  }

  let links = [];
  if (teacherBatchIds.length > 0) {
    const linksRes = await safeQuery(() =>
      db.from('student_batches').select('student_id, batch_id, batches(name)').in('batch_id', teacherBatchIds)
    );
    links = linksRes.ok ? linksRes.data : [];
  }

  const batchNameMap = {};
  const batchStudentCount = {};
  (links || []).forEach(l => {
    if (l.batches) batchNameMap[l.batch_id] = l.batches.name;
    batchStudentCount[l.batch_id] = (batchStudentCount[l.batch_id] || 0) + 1;
  });

  const attRes = await safeQuery(() =>
    db.from('attendance').select('student_id, status').eq('date', attCurrentDate).in('student_id', (students || []).map(s => s.id))
  );

  const attMap = {};
  (attRes.ok ? attRes.data : []).forEach(a => { attMap[a.student_id] = a.status; });

  let present = 0, absent = 0, unmarked = 0;
  (students || []).forEach(s => {
    const st = attMap[s.id];
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else unmarked++;
  });

  document.getElementById('attPresentCount').textContent = present;
  document.getElementById('attAbsentCount').textContent = absent;
  document.getElementById('attUnmarkedCount').textContent = unmarked;

  const batches = teacherBatchIds.map(id => ({ id, name: batchNameMap[id] || 'Batch', count: batchStudentCount[id] || 0 }));
  pageDataCache[cacheKey] = { batches, links, attMap, present, absent, unmarked };
  renderAttBatchCards(batches, links, attMap);
}

function renderAttBatchCards(batches, sbRows, attMap) {
  const grid = document.getElementById('attBatchesGrid');
  const empty = document.getElementById('attEmpty');
  if (!grid) return;

  if (!batches || batches.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  grid.style.display = '';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = batches.map(b => {
    let batchPresent = 0, batchAbsent = 0, batchUnmarked = 0;
    sbRows.filter(r => r.batch_id === b.id).forEach(r => {
      const st = attMap[r.student_id];
      if (st === 'present') batchPresent++;
      else if (st === 'absent') batchAbsent++;
      else batchUnmarked++;
    });
    const count = b.count;
    const rate = count > 0 ? Math.round((batchPresent / count) * 100) : 0;
    const rateColor = rate >= 75 ? '#4ADE80' : rate >= 50 ? '#FBBF24' : '#F87171';
    const marked = batchPresent + batchAbsent;

    return `
    <div class="fee-batch-card" onclick="showAttBatchDetail('${b.id}')">
      <div class="fee-batch-card-top">
        <div class="fee-batch-card-name">${escapeHtml(b.name)}</div>
        <div class="fee-batch-card-rate" style="color:${rateColor}" title="Overall attendance">${marked > 0 ? rate + '%' : '--'}</div>
      </div>
      <div class="fee-batch-card-fee">${count} student${count !== 1 ? 's' : ''}</div>
      <div class="fee-batch-card-stats">
        <span class="fee-batch-card-stat" style="color:#4ADE80"><strong>${batchPresent}</strong> present</span>
        <span class="fee-batch-card-stat" style="color:#F87171"><strong>${batchAbsent}</strong> absent</span>
        <span class="fee-batch-card-stat" style="color:#94A3B8"><strong>${batchUnmarked}</strong> unmarked</span>
      </div>
    </div>`;
  }).join('');
}

async function showAttBatchDetail(batchId) {
  attSelectedBatchId = batchId;
  document.getElementById('attBatchList').style.display = 'none';
  document.getElementById('attBatchDetail').style.display = '';

  const attSearch = document.querySelector('#page-attendance .section-search-input');
  if (attSearch) {
    attSearch.dataset.filter = 'attTableBody';
    attSearch.placeholder = 'Search students...';
    attSearch.value = '';
  }

  const today = toDateKey(new Date());
  const display = document.getElementById('attDateDisplay');
  if (attCurrentDate === today) {
    display.textContent = 'Today';
  } else {
    display.textContent = new Date(attCurrentDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const cacheKey = 'attendance_detail_' + attCurrentDate + '_' + batchId;
  if (pageDataCache[cacheKey]) {
    renderAttBatchDetail(pageDataCache[cacheKey]);
    return;
  }

  const sbRes = await safeQuery(() =>
    db.from('student_batches').select('student_id').eq('batch_id', batchId)
  );

  const studentIds = (sbRes.ok ? sbRes.data : []).map(r => r.student_id);
  let students = [];
  if (studentIds.length > 0) {
    const studentsRes = await safeQuery(() =>
      db.from('students').select('id, full_name').in('id', studentIds).is('deleted_at', null)
    );
    students = studentsRes.ok ? studentsRes.data : [];
  }
  naturalNameSort(students);

  const batchRes = await safeQuery(() =>
    db.from('batches').select('name').eq('id', batchId).single()
  );
  const batchInfo = batchRes.ok ? batchRes.data : null;

  const attRes = await safeQuery(() =>
    db.from('attendance').select('student_id, status').eq('date', attCurrentDate).in('student_id', studentIds)
  );

  const attMap = {};
  (attRes.ok ? attRes.data : []).forEach(a => { attMap[a.student_id] = a.status; });

  let present = 0, absent = 0, unmarked = 0;
  students.forEach(s => {
    const st = attMap[s.id];
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else unmarked++;
  });

  pageDataCache[cacheKey] = { students, batchName: batchInfo?.name || '', attMap, present, absent, unmarked };
  renderAttBatchDetail(pageDataCache[cacheKey]);
}

function renderAttBatchDetail({ students, batchName, attMap, present, absent, unmarked }) {
  document.getElementById('attPresentCount').textContent = present;
  document.getElementById('attAbsentCount').textContent = absent;
  document.getElementById('attUnmarkedCount').textContent = unmarked;

  const rate = students.length > 0 ? Math.round((present / students.length) * 100) : null;
  const rateColor = rate == null ? '#94A3B8' : rate >= 75 ? '#4ADE80' : rate >= 50 ? '#FBBF24' : '#F87171';

  document.getElementById('attBatchHeader').innerHTML = `
    <div class="fees-batch-header-top">
      <div class="fees-batch-header-info">
        <div class="fees-batch-header-name">${escapeHtml(batchName)}</div>
        <div class="fees-batch-header-meta">${students.length} student${students.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="fees-batch-header-rate" style="color:${rateColor}" title="Overall attendance">${rate != null ? rate + '%' : '--'}</div>
    </div>`;

  const tbody = document.getElementById('attTableBody');
  const detailEmpty = document.getElementById('attDetailEmpty');
  const table = document.querySelector('#attBatchDetail .page-table');

  if (!students || students.length === 0) {
    if (table) table.style.display = 'none';
    if (detailEmpty) detailEmpty.style.display = 'flex';
    return;
  }

  if (table) table.style.display = '';
  if (detailEmpty) detailEmpty.style.display = 'none';

  tbody.innerHTML = students.map(s => {
    const name = s.full_name || '\u2014';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const status = attMap[s.id] || 'unmarked';

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
    </tr>`;
  }).join('');
}

document.getElementById('attBackBtn')?.addEventListener('click', () => populateAttendancePage());

async function markAtt(studentId, status, btn) {
  const cacheKey = 'attendance_' + attCurrentDate;

  // DB write FIRST — only update UI on success
  try {
    await withLoading(btn, async () => {
      const teacherBatchIds = await getTeacherBatches();

      let batchId = attSelectedBatchId;
      if (!batchId && teacherBatchIds.length > 0) {
        const { data: sbRows } = await safeQuery(() =>
          db.from('student_batches')
            .select('batch_id')
            .eq('student_id', studentId)
            .in('batch_id', teacherBatchIds)
        );
        batchId = (sbRows && sbRows.length > 0) ? sbRows[0].batch_id : null;
      }

      const { ok, error } = await safeQuery(() =>
        db.from('attendance')
          .upsert({
            student_id: studentId,
            batch_id: batchId,
            date: attCurrentDate,
            status: status,
            marked_by: currentUser?.id || null
          }, { onConflict: 'student_id,batch_id,date' })
      );
      if (!ok) throw error || new Error('Failed to mark attendance');
    }, { spinnerOnly: true });
  } catch (err) {
    return;
  }

  // DB write succeeded — now update local state and UI
  if (pageDataCache[cacheKey]) {
    pageDataCache[cacheKey].attMap[studentId] = status;
    const attMap = pageDataCache[cacheKey].attMap;
    let present = 0, absent = 0, unmarked = 0;
    Object.values(attMap).forEach(st => {
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else unmarked++;
    });
    pageDataCache[cacheKey].present = present;
    pageDataCache[cacheKey].absent = absent;
    pageDataCache[cacheKey].unmarked = unmarked;
    document.getElementById('attPresentCount').textContent = present;
    document.getElementById('attAbsentCount').textContent = absent;
    document.getElementById('attUnmarkedCount').textContent = unmarked;
  }

  if (attSelectedBatchId) {
    const detailKey = 'attendance_detail_' + attCurrentDate + '_' + attSelectedBatchId;
    if (pageDataCache[detailKey]) {
      pageDataCache[detailKey].attMap[studentId] = status;
      const dAttMap = pageDataCache[detailKey].attMap;
      let dp = 0, da = 0, du = 0;
      pageDataCache[detailKey].students.forEach(s => {
        const st = dAttMap[s.id];
        if (st === 'present') dp++;
        else if (st === 'absent') da++;
        else du++;
      });
      pageDataCache[detailKey].present = dp;
      pageDataCache[detailKey].absent = da;
      pageDataCache[detailKey].unmarked = du;
      renderAttBatchDetail(pageDataCache[detailKey]);
    }
  }

  if (typeof renderAlerts === 'function') renderAlerts();
}

document.getElementById('attPrevDay')?.addEventListener('click', () => {
  const [y, m, d] = attCurrentDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  attCurrentDate = toDateKey(dt);
  populateAttendancePage();
});

document.getElementById('attNextDay')?.addEventListener('click', () => {
  const [y, m, d] = attCurrentDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  attCurrentDate = toDateKey(dt);
  populateAttendancePage();
});

// ── Announcements Page (read-only) ──

let announcementsCache = null;

async function populateAnnouncementsPage() {
  if (isDemoMode) {
    renderAnnouncements(demoAnnouncements);
    setAnnouncementsLoadMore(false);
    applyTeacherAnnouncementGating();
    return;
  }
  if (!currentInstitute?.id) return;

  // Serve from cache so re-opening the page doesn't flash the skeleton or
  // hit the network again.
  if (announcementsCache) {
    renderAnnouncements(announcementsCache.list, announcementsCache.hasMore);
    setAnnouncementsLoadMore(announcementsCache.hasMore);
    applyTeacherAnnouncementGating();
    return;
  }

  resetAnnouncementsPager();
  const { data, done } = await fetchAnnouncementsPage();
  announcementsCache = { list: data, hasMore: !done };
  renderAnnouncements(data, !done);
  applyTeacherAnnouncementGating();
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

// ── Teacher Announcement Sending ──

async function openAnnouncementModal() {
  if (isDemoMode) { showPrivacyMsg('Announcements are not available in demo mode.'); return; }
  if (!planLimits.announcements_allowed) {
    showUpgradePrompt('announcements');
    return;
  }

  // Populate audience dropdown, then open modal
  const teacherBatchIds = await getTeacherBatches();
  let batchOptions = [];
  if (teacherBatchIds.length > 0) {
    const batchesRes = await safeQuery(() =>
      db.from('batches').select('id, name').in('id', teacherBatchIds).is('deleted_at', null).order('name')
    );
    batchOptions = batchesRes.ok ? batchesRes.data : [];
  }
  const allOptions = [{value:'all', label:'All Students (All Batches)'}, ...batchOptions.map(b => ({value:b.id, label:b.name}))];
  setCustomSelectOptions('announcementAudience', allOptions, 'all');

  document.getElementById('announcementForm').reset();
  setCustomSelectValue('announcementAudience', 'all');
  document.getElementById('announcementModalTitle').textContent = 'New Announcement';
  const submit = document.getElementById('announcementSubmit');
  if (submit) submit.textContent = 'Send Announcement';
  document.getElementById('announcementError').classList.remove('visible');

  document.getElementById('announcementModal').classList.add('open');
  if (typeof fluidPause === 'function') fluidPause();
}

function closeAnnouncementModal() {
  document.getElementById('announcementModal')?.classList.remove('open');
  if (typeof fluidResume === 'function') fluidResume();
}

document.getElementById('addAnnouncementBtn')?.addEventListener('click', openAnnouncementModal);
document.getElementById('announcementModalClose')?.addEventListener('click', closeAnnouncementModal);
document.getElementById('announcementModalCancel')?.addEventListener('click', closeAnnouncementModal);
document.getElementById('announcementModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'announcementModal') closeAnnouncementModal();
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

  if (!planLimits.announcements_allowed) {
    showUpgradePrompt('announcements');
    return;
  }

  const submitBtn = document.getElementById('announcementSubmit');
  try {
    await withLoading(submitBtn, async () => {
      // Determine target and optional batch targeting
      let target = 'parents';
      let targetBatchId = null;

      if (audience !== 'all') {
        // Specific batch selected
        target = 'parents';
        targetBatchId = audience;
      }

      const insertData = {
        title,
        message: body,
        target,
        institute_id: currentInstitute.id,
        created_by: currentUser.id
      };
      if (targetBatchId) insertData.target_batch_id = targetBatchId;

      const insertRes = await safeQuery(() => db.from('announcements').insert(insertData));
      if (!insertRes.ok) throw insertRes.error;
    });
  } catch (err) {
    if (handlePlanError(err)) return;
    errEl.textContent = err.message || 'Failed to send announcement.';
    errEl.classList.add('visible');
    return;
  }

  closeAnnouncementModal();
  // Invalidate announcement cache so the list refreshes
  announcementsCache = null;
  invalidatePageCache('announcements');
  invalidatePageCache('dashboard');
  await populateAnnouncementsPage();
});

function applyTeacherAnnouncementGating() {
  const btn = document.getElementById('addAnnouncementBtn');
  if (!btn) return;
  if (!planLimits.announcements_allowed) {
    btn.disabled = true;
    btn.title = 'Announcements require Basic or Pro plan. Upgrade to enable.';
    btn.classList.add('gated');
  } else {
    btn.disabled = false;
    btn.title = '';
    btn.classList.remove('gated');
  }
}

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

  const teacherBatchIds = await getTeacherBatches();

  if (teacherBatchIds.length > 0) {
    const batchRes = await safeQuery(() => db.from('batches').select('*').in('id', teacherBatchIds).is('deleted_at', null));
    out.batches = batchRes.ok ? batchRes.data : [];

    const sbRes = await safeQuery(() => db.from('student_batches').select('*').in('batch_id', teacherBatchIds));
    out.student_batches = sbRes.ok ? sbRes.data : [];
  }

  const studentIds = await getTeacherStudentIds();

  if (studentIds.length > 0) {
    const studentsRes = await safeQuery(() => db.from('students').select('*').in('id', studentIds).is('deleted_at', null));
    out.students = studentsRes.ok ? studentsRes.data : [];

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

// ── Navbar Alerts (unmarked attendance only) ──

// Teachers are alerted only when students in their assigned batches have
// unmarked attendance for today. Scoping is enforced by RLS on the batch
// chain (batches_teacher_read, student_batches_teacher_read).
async function buildTeacherAlerts() {
  const alerts = [];
  if (isDemoMode || !currentUser?.id) return alerts;

  const today = toDateKey(new Date());
  const teacherStudentIds = await getTeacherStudentIds();
  if (teacherStudentIds.length === 0) return alerts;

  try {
    const attRes = await safeQuery(() =>
      db.from('attendance').select('student_id, status').eq('date', today).in('student_id', teacherStudentIds)
    );
    const attMap = {};
    if (attRes.ok) (attRes.data || []).forEach(r => { attMap[r.student_id] = r.status; });
    // "Unmarked" = no attendance row for the day (or an explicit 'unmarked'
    // status) — same semantics as the Attendance page summary.
    const unmarked = teacherStudentIds.filter(id => !attMap[id] || attMap[id] === 'unmarked').length;
    if (unmarked > 0) {
      alerts.push({
        id: 'att-today',
        severity: 'warning',
        title: `${unmarked} student${unmarked !== 1 ? 's' : ''} ${unmarked === 1 ? 'has' : 'have'} unmarked attendance today`,
        detail: 'Mark attendance in the Attendance section.',
        page: 'attendance'
      });
    }
  } catch (e) {
    console.warn('Teacher alerts: attendance check failed', e);
  }

  return alerts;
}

function renderAlerts() {
  const list = document.getElementById('alertList');
  const empty = document.getElementById('alertEmpty');
  const badge = document.getElementById('alertBadge');
  const meta = document.getElementById('alertPanelMeta');
  if (!list) return;

  buildTeacherAlerts().then(alerts => {
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

// ── Init ──
setupPrivacyData(gatherExportPayload);
sharedInit('teacher');

// First-login onboarding tour. Runs after the dashboard has painted.
if (typeof maybeStartOnboarding === 'function') {
  setTimeout(maybeStartOnboarding, 900);
}

// Hook into sharedInit — fires after session + profile are loaded.
function onReady() {
  initAlerts();
  initAttentionModal();
  applyTeacherAnnouncementGating();
  initCustomSelect('teacherBatchFilter', [{value:'', label:'All Batches'}], '', () => renderStudentsTable());
  initCustomSelect('announcementAudience', [{value:'all', label:'All Students (All Batches)'}], 'all');
}
