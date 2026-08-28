// Scroll-scrubbed 3D hero ambience — DESKTOP ONLY.
//
// Guarantees:
//  - Never runs on touch/small screens (pointer: coarse, <768px) or with
//    prefers-reduced-motion. Phones keep the static gradient + CSS parallax
//    from styles.css/main.js — nothing here ever loads on a phone.
//  - THREE is injected dynamically: the 669KB library is only downloaded by
//    devices that will actually use it.
//  - Every failure path (no WebGL, script load fail, init throw, context lost)
//    silently no-ops. The hero already has the fluid shader behind us, so
//    hiding this canvas is invisible.
(function () {
  'use strict';

  var hero = document.querySelector('.hero');
  if (!hero) return;

  var fine = window.matchMedia('(pointer: fine)').matches;
  var wideEnough = Math.max(document.documentElement.clientWidth, window.innerWidth) >= 768;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || !wideEnough || reduced) return;

  var supportsGL = (function () {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  })();
  if (!supportsGL) return;

  var threePromise = (function () {
    // ES module build (three r150+ removed the global UMD builds). The ~670KB
    // library is only fetched on desktop that will actually render it.
    // Absolute URL avoids module-specifier resolution quirks; the ->.catch()<-
    // swallows any load/parse failure so it can't surface as an uncaught
    // promise rejection. Filename carries the version (no ?v= on modules).
    try {
      return import(new URL('three.module.min.v160.js', document.baseURI).href)
        .then(function (m) { return m.default || m; })
        .catch(function () { return null; });
    } catch (e) {
      return null;
    }
  })();

  if (threePromise) {
    threePromise.then(function (THREE) {
      if (!THREE) return;
      try {
        init();
      } catch (e) {
        console.error('hero3d init failed:', e);
      }
    });
  }

  function init() {
    var canvas = document.createElement('canvas');
    canvas.id = 'hero3d';
    canvas.setAttribute('aria-hidden', 'true');
    hero.appendChild(canvas);

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    var group = new THREE.Group();
    scene.add(group);

    // Teal particle shell — concentrated on the right half where the
    // dash-card lives, so the 3D hangs around the product, not the text.
    var TCOUNT = 1400;
    var positions = new Float32Array(TCOUNT * 3);
    for (var i = 0; i < TCOUNT; i++) {
      positions[i * 3] = 1.1 + Math.random() * 3.4;
      positions[i * 3 + 1] = -2.4 + Math.random() * 4.8;
      positions[i * 3 + 2] = -2.5 + Math.random() * 5.0;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var points = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0x2dd4bf,
      size: 0.05,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true
    }));
    group.add(points);

    // Sparse amber accent particles.
    var ACOUNT = 320;
    var aPos = new Float32Array(ACOUNT * 3);
    for (var j = 0; j < ACOUNT; j++) {
      aPos[j * 3] = 0.9 + Math.random() * 3.8;
      aPos[j * 3 + 1] = -2.6 + Math.random() * 5.2;
      aPos[j * 3 + 2] = -1.6 + Math.random() * 3.2;
    }
    var aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    var aPoints = new THREE.Points(aGeo, new THREE.PointsMaterial({
      color: 0xd97706,
      size: 0.045,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true
    }));
    group.add(aPoints);

    // Wireframe orbit rings around the visual zone.
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.9, 0.025, 10, 80),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.28 })
    );
    ring.position.set(2.9, -0.2, -0.5);
    group.add(ring);

    var amberRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.6, 0.02, 10, 80),
      new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.18 })
    );
    amberRing.position.set(2.9, 0.1, -1.4);
    amberRing.rotation.x = 1.1;
    group.add(amberRing);

    // ── Scroll scrub: 0 (hero at top) → 1 (hero scrolled one full height) ──
    var progress = 0;
    var mouseX = 0, mouseY = 0, targetMX = 0, targetMY = 0;
    var running = false, raf = null, ticking = false;

    function scrub() {
      var r = hero.getBoundingClientRect();
      var h = hero.offsetHeight || 1;
      progress = Math.min(1, Math.max(0, -r.top / h));
    }
    scrub();

    function resize() {
      var w = canvas.clientWidth || hero.clientWidth || 1;
      var h = canvas.clientHeight || hero.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () { ticking = false; scrub(); });
      }
    }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('mousemove', function (e) {
      targetMX = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
      targetMY = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
    }, { passive: true });

    function render(time) {
      if (!running) return;
      mouseX += (targetMX - mouseX) * 0.05;
      mouseY += (targetMY - mouseY) * 0.05;
      var t = (time || 0) * 0.001;

      group.rotation.y = t * 0.05 + progress * -1.2 + mouseX * 0.18;
      group.rotation.x = 0.12 + progress * -0.55 + mouseY * 0.1;
      group.position.y = -progress * 1.5;
      camera.position.z = 11 - progress * 3.4;
      points.rotation.y = t * 0.02;
      aPoints.rotation.y = -t * 0.015;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    }

    function start() {
      if (!running) { running = true; raf = requestAnimationFrame(render); }
    }
    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0 }).observe(hero);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (canvas.style.display !== 'none') start();
    });

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      stop();
      canvas.style.display = 'none';
    });

    resize();
    start();
  }
})();