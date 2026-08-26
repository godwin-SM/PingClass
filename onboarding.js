// PingClass Onboarding Tour — first-login guided walkthrough for all dashboards.
// Loaded by admin, teacher and parent dashboards. Uses globals from shared.js
// (userProfile, currentUser, db, isDemoMode, setScrollLock, navigateToPage).
//
// Triggers: window.maybeStartOnboarding() is called from each dashboard's JS
// after the dashboard has rendered. Skips demo mode unless ?tour=1 (testing/
// preview hook). Completion is persisted to users.onboarded_at (DB) with a
// localStorage fallback.

(function () {
  const LS_KEY = function () {
    return 'pc_onboarded_' + (typeof currentUser !== 'undefined' && currentUser && currentUser.id ? currentUser.id : '');
  };
  const FORCED = /[?&](?:tour|onboard)=1/.test(window.location.search);

  const ROLE_STEPS = {
    admin: [
      {
        page: 'dashboard',
        target: '#dashboardStats',
        title: 'Your dashboard',
        body: 'A live overview of your institute — total students, attendance and fee collection at a glance. This is your home base.'
      },
      {
        target: '#sidebar',
        title: 'Sidebar navigation',
        body: 'Everything lives here — Students, Batches, Fees, Attendance, Announcements, Staff, Parents and Billing. Click any item to jump to it.'
      },
      {
        page: 'students',
        target: '#addStudentBtn',
        title: 'Add students',
        body: 'This button is where your institute starts. Add each student with their name, batch, contact and guardian details.'
      },
      {
        target: '.nav-item[data-page="batches"]',
        title: 'Batches',
        body: 'Group students into batches (Math, English, Weekend classes…) and assign a teacher to each one.'
      },
      {
        target: '.nav-item[data-page="fees"]',
        title: 'Fees',
        body: 'See who has paid, who is pending, and who is overdue. Collect dues and send reminders right from here.'
      },
      {
        target: '.nav-item[data-page="attendance"]',
        title: 'Attendance',
        body: 'Mark daily attendance per batch in a couple of taps. Your dashboard updates automatically.'
      },
      {
        target: '.nav-item[data-page="settings"]',
        title: 'Settings & billing',
        body: 'Update your institute profile, invite staff and parents, and manage your subscription plan.'
      },
      {
        target: '#userName',
        title: "You're all set!",
        final: true,
        body: "That's the tour! Head to Students to add your first student — or explore at your own pace. Welcome aboard."
      }
    ],
    teacher: [
      {
        page: 'dashboard',
        target: '#dashboardStats',
        title: 'Your dashboard',
        body: 'Your teaching overview — the students and batches assigned to you, and pending fees, all in one place.'
      },
      {
        target: '#sidebar',
        title: 'Sidebar navigation',
        body: 'Your section lives here — Students, Batches, Attendance and Announcements. Click any item to jump to it.'
      },
      {
        page: 'batches',
        target: '.nav-item[data-page="batches"]',
        title: 'Your batches',
        body: 'The batches assigned to you by your admin appear here. Open one to see its students.'
      },
      {
        page: 'students',
        target: '.nav-item[data-page="students"]',
        title: 'Your students',
        body: 'Every student across your assigned batches — view their details and contact info.'
      },
      {
        target: '.nav-item[data-page="attendance"]',
        title: 'Attendance',
        body: 'Mark daily attendance for your batches in a couple of taps. Your admin sees updates instantly.'
      },
      {
        target: '.nav-item[data-page="settings"]',
        title: 'Settings & privacy',
        body: 'Manage your account, export your data, or delete your account from Settings.'
      },
      {
        target: '#userName',
        title: "You're all set!",
        final: true,
        body: "That's the tour! Head to Batches to start marking attendance. Welcome aboard."
      }
    ],
    parent: [
      {
        page: 'dashboard',
        target: '#dashboardStats',
        title: 'Your dashboard',
        body: 'A snapshot of your child — fees due, payments made and attendance, all in one place.'
      },
      {
        target: '#sidebar',
        title: 'Sidebar navigation',
        body: 'Fees, Attendance, Announcements and Settings all live here. Click any item to jump to it.'
      },
      {
        page: 'fees',
        target: '.nav-item[data-page="fees"]',
        title: 'Fees',
        body: 'See what\u2019s pending, what\u2019s paid, and your child\u2019s full payment history.'
      },
      {
        target: '.nav-item[data-page="attendance"]',
        title: 'Attendance',
        body: 'View your child\u2019s attendance record day by day, including any marked absences.'
      },
      {
        target: '.nav-item[data-page="announcements"]',
        title: 'Announcements',
        body: 'Important updates from your child\u2019s institute appear here.'
      },
      {
        target: '.nav-item[data-page="settings"]',
        title: 'Settings & privacy',
        body: 'Manage your account, export your data, or delete your account from Settings.'
      },
      {
        target: '#userName',
        title: "You're all set!",
        final: true,
        body: "That's the tour! You're all set to keep up with your child. Welcome aboard."
      }
    ]
  };

  let running = false;
  let STEPS = [];
  let overlay = null;
  let spotlight = null;
  let card = null;
  let dotsEl = null;
  let currentEl = null;
  let step = -1;
  let seq = 0;
  let openedSidebar = false;
  let rafId = 0;
  let observer = null;
  let posTimer = 0;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function completedOnboarding() {
    try {
      if (localStorage.getItem(LS_KEY())) return true;
    } catch (e) { /* ignore */ }
    return !!(userProfile && userProfile.onboarded_at);
  }

  async function markOnboarded() {
    try {
      localStorage.setItem(LS_KEY(), '1');
    } catch (e) { /* ignore */ }
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.id && typeof db !== 'undefined' && db) {
      try {
        await db.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', currentUser.id);
      } catch (e) {
        // Column not provisioned yet or RLS — localStorage fallback already covers it.
      }
    }
  }

  function shouldRun() {
    if (FORCED) return true;
    if (typeof isDemoMode !== 'undefined' && isDemoMode) return false;
    if (!(userProfile && (userProfile.role === 'admin' || userProfile.role === 'teacher' || userProfile.role === 'parent'))) return false;
    return !completedOnboarding();
  }

  function currentSteps() {
    const role = (userProfile && userProfile.role) || 'admin';
    return ROLE_STEPS[role] || ROLE_STEPS.admin;
  }

  // ── Welcome modal ──

  function showWelcome() {
    const firstName = (userProfile && userProfile.full_name)
      ? String(userProfile.full_name).trim().split(' ')[0]
      : 'there';

    const role = (userProfile && userProfile.role) || 'admin';
    const welcomeTexts = {
      admin: 'You\u2019ve set up your institute. Take a quick guided tour to see how everything works — it only takes a minute.',
      teacher: 'You\u2019ve been added as a teacher. Take a quick guided tour of your dashboard — it only takes a minute.',
      parent: 'You\u2019ve been added as a parent. Take a quick guided tour of your dashboard — it only takes a minute.'
    };

    const ov = document.createElement('div');
    ov.className = 'onb-overlay';
    ov.id = 'onbWelcome';
    ov.innerHTML =
      '<div class="onb-modal" role="dialog" aria-modal="true" aria-labelledby="onbWelcomeTitle">' +
        '<img class="onb-logo" src="logo-64.png" alt="PingClass" width="48" height="48">' +
        '<h2 class="onb-modal-title" id="onbWelcomeTitle">Welcome to PingClass, ' + esc(firstName) + '!</h2>' +
        '<p class="onb-modal-text">' + (welcomeTexts[role] || welcomeTexts.admin) + '</p>' +
        '<div class="onb-modal-actions">' +
          '<button type="button" class="onb-btn onb-btn-ghost" id="onbSkip">Skip for now</button>' +
          '<button type="button" class="onb-btn onb-btn-primary" id="onbStart">Take the tour</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    overlay = ov;

    ov.querySelector('#onbSkip').addEventListener('click', function () {
      teardown();
      finishOnboarding();
    });
    ov.querySelector('#onbStart').addEventListener('click', function () {
      ov.remove();
      startTour();
    });
    ov.querySelector('#onbStart').focus();
  }

  // ── Tour UI ──

  function startTour() {
    STEPS = currentSteps();
    overlay = document.createElement('div');
    overlay.className = 'onb-overlay';
    overlay.id = 'onbTour';
    overlay.innerHTML =
      '<div class="onb-spotlight" id="onbSpotlight"></div>' +
      '<div class="onb-card" id="onbCard" role="dialog" aria-modal="true" aria-labelledby="onbCardTitle">' +
        '<div class="onb-card-head"><img class="onb-logo onb-logo-sm" src="logo-64.png" alt="PingClass" width="30" height="30"></div>' +
      '<div class="onb-progress" id="onbProgress"></div>' +
        '<h3 class="onb-title" id="onbCardTitle"></h3>' +
        '<p class="onb-body" id="onbCardBody"></p>' +
        '<div class="onb-dots" id="onbDots"></div>' +
        '<div class="onb-actions">' +
          '<button type="button" class="onb-btn onb-btn-ghost" id="onbSkip">Skip</button>' +
          '<button type="button" class="onb-btn onb-btn-back" id="onbBack" aria-label="Previous step">Back</button>' +
          '<button type="button" class="onb-btn onb-btn-primary" id="onbNext">Next</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // The tour is modal — stop clicks inside it from bubbling to shared.js's
    // "close sidebar on outside click" handler, which would instantly close the
    // sidebar we open for nav steps on mobile.
    overlay.addEventListener('click', function (e) { e.stopPropagation(); });

    spotlight = overlay.querySelector('#onbSpotlight');
    card = overlay.querySelector('#onbCard');
    dotsEl = overlay.querySelector('#onbDots');

    for (let i = 0; i < STEPS.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'onb-dot';
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', 'Go to step ' + (i + 1));
      dot.addEventListener('click', (function (idx) { return function () { goToStep(idx); }; })(i));
      dot.addEventListener('keydown', (function (idx) {
        return function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToStep(idx); }
        };
      })(i));
      dotsEl.appendChild(dot);
    }

    overlay.querySelector('#onbSkip').addEventListener('click', function () {
      teardown();
      finishOnboarding();
    });
    overlay.querySelector('#onbBack').addEventListener('click', function () {
      goToStep(Math.max(0, step - 1));
    });
    overlay.querySelector('#onbNext').addEventListener('click', nextStep);

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    document.addEventListener('keydown', onKey);

    // Re-aim the spotlight whenever page content loads/reflows (e.g. the
    // Students page swaps its skeleton for real rows). Mutations made by the
    // tour's own overlay are filtered out so we don't self-trigger.
    observer = new MutationObserver(onTourMutation);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

    // Also chase the target periodically to cover layout shifts the observer
    // can't see (CSS transitions ending, fonts loading, etc.).
    posTimer = setInterval(function () {
      if (currentEl && document.contains(currentEl)) positionOverlay(currentEl);
    }, 250);

    goToStep(0);
  }

  function onTourMutation(mutations) {
    let dirty = false;
    for (let i = 0; i < mutations.length; i++) {
      const t = mutations[i].target;
      if (overlay && (t === overlay || overlay.contains(t))) continue;
      const welcome = document.getElementById('onbWelcome');
      if (welcome && (t === welcome || welcome.contains(t))) continue;
      dirty = true;
    }
    if (dirty) onViewportChange();
  }

  async function goToStep(i) {
    const mySeq = ++seq;
    step = i;
    const s = STEPS[i];
    updateCard(s);

    if (s.page && typeof navigateToPage === 'function') {
      navigateToPage(s.page);
    }

    if (s.target) {
      const needsSidebar = s.target === '#sidebar' || s.target.indexOf('.nav-item') === 0;
      if (needsSidebar) ensureSidebarOpen();
      const el = await waitForVisible(s.target);
      if (mySeq !== seq) return;
      if (el && document.contains(el)) {
        currentEl = el;
        positionOverlay(el);
      } else {
        currentEl = null;
        hideSpotlight();
        positionCardCentered();
      }
    } else {
      currentEl = null;
      hideSpotlight();
      positionCardCentered();
    }
  }

  function nextStep() {
    if (step >= STEPS.length - 1) {
      teardown();
      finishOnboarding();
      return;
    }
    goToStep(step + 1);
  }

  function updateCard(s) {
    const i = step;
    overlay.querySelector('#onbProgress').textContent = 'Step ' + (i + 1) + ' of ' + STEPS.length;
    overlay.querySelector('#onbCardTitle').textContent = s.title;
    overlay.querySelector('#onbCardBody').textContent = s.body;

    const dots = dotsEl.querySelectorAll('.onb-dot');
    dots.forEach(function (d, di) {
      d.classList.toggle('onb-dot-active', di === i);
    });

    const backBtn = overlay.querySelector('#onbBack');
    backBtn.disabled = i === 0;

    overlay.querySelector('#onbNext').textContent = s.final ? 'Finish' : 'Next';
  }

  // ── Positioning ──

  function waitForVisible(selector, timeout) {
    timeout = timeout || 6000;
    return new Promise(function (resolve) {
      const t0 = Date.now();
      (function poll() {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) { resolve(el); return; }
        if (Date.now() - t0 > timeout) { resolve(null); return; }
        setTimeout(poll, 100);
      })();
    });
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden';
  }

  function positionOverlay(el) {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
      hideSpotlight();
      return;
    }
    spotlight.style.display = 'block';
    spotlight.style.width = Math.max(r.width, 8) + 'px';
    spotlight.style.height = Math.max(r.height, 8) + 'px';
    spotlight.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    positionCard(r, vw, vh);
  }

  function hideSpotlight() {
    if (spotlight) spotlight.style.display = 'none';
  }

  function positionCard(r, vw, vh) {
    card.style.display = 'block';
    card.style.transform = 'none';
    card.style.left = '0px';
    card.style.top = '0px';
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const pad = vw <= 480 ? 14 : 18;
    let x;
    let y;

    const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(v, hi)); };

    if (r && r.width > 0 && r.height > 0) {
      // Prefer a placement that never covers the spotlighted element, scanning
      // the bands that fit fully on screen. Right/left when they fit, then
      // below/above (the realistic options on small phones).
      if (r.right + pad + cw <= vw - pad && ch <= vh - 2 * pad) {
        x = r.right + pad;
        y = clamp(r.top, pad, vh - ch - pad);
      } else if (r.left - pad - cw >= pad && ch <= vh - 2 * pad) {
        x = r.left - pad - cw;
        y = clamp(r.top, pad, vh - ch - pad);
      } else if (r.bottom + pad + ch <= vh - pad && cw <= vw - 2 * pad) {
        x = clamp(r.left + (r.width - cw) / 2, pad, Math.max(pad, vw - cw - pad));
        y = r.bottom + pad;
      } else if (r.top - pad - ch >= pad && cw <= vw - 2 * pad) {
        x = clamp(r.left + (r.width - cw) / 2, pad, Math.max(pad, vw - cw - pad));
        y = r.top - pad - ch;
      } else {
        // Nothing fits cleanly — push the card into the larger free band so
        // the rest of the screen stays visible behind it.
        const topSpace = r.top - pad;
        const bottomSpace = vh - r.bottom - pad;
        if (bottomSpace >= topSpace) {
          y = Math.min(vh - ch - pad, Math.max(pad, r.bottom + pad));
        } else {
          y = Math.max(pad, r.top - ch - pad);
        }
        x = clamp(r.left + (r.width - cw) / 2, pad, Math.max(pad, vw - cw - pad));
      }
    } else {
      x = Math.max(pad, (vw - cw) / 2);
      y = Math.max(pad, (vh - ch) / 2);
    }

    card.style.left = x + 'px';
    card.style.top = y + 'px';
  }

  function positionCardCentered() {
    card.style.display = 'block';
    card.style.transform = 'none';
    card.style.left = '0px';
    card.style.top = '0px';
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const pad = 18;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    card.style.left = Math.max(pad, (vw - cw) / 2) + 'px';
    card.style.top = Math.max(pad, (vh - ch) / 2) + 'px';
  }

  function onViewportChange() {
    if (!running) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      if (currentEl && document.contains(currentEl)) positionOverlay(currentEl);
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      teardown();
      finishOnboarding();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextStep();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToStep(Math.max(0, step - 1));
    }
  }

  // ── Mobile sidebar handling ──

  function ensureSidebarOpen() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const r = sb.getBoundingClientRect();
    const visible = r.width > 60 && r.right > 20 && r.left > -60;
    if (visible) return;

    if (!sb.classList.contains('open')) {
      sb.classList.add('open');
      openedSidebar = true;
    }
    const ov = document.getElementById('sidebarOverlay');
    if (ov && !ov.classList.contains('active')) ov.classList.add('active');
    if (typeof setScrollLock === 'function') setScrollLock(true);
  }

  function restoreSidebar() {
    if (!openedSidebar) return;
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
    const ov = document.getElementById('sidebarOverlay');
    if (ov) ov.classList.remove('active');
    if (typeof setScrollLock === 'function') setScrollLock(false);
    openedSidebar = false;
  }

  // ── Lifecycle ──

  function teardown() {
    seq++;
    running = false;
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange, true);
    document.removeEventListener('keydown', onKey);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (posTimer) {
      clearInterval(posTimer);
      posTimer = 0;
    }
    restoreSidebar();
    if (overlay) overlay.remove();
    overlay = null;
    spotlight = null;
    card = null;
    dotsEl = null;
    currentEl = null;
  }

  function finishOnboarding() {
    markOnboarded().catch(function () { /* ignore */ });
  }

  window.maybeStartOnboarding = function () {
    if (running) return;
    if (!shouldRun()) return;
    running = true;
    showWelcome();
  };
})();
