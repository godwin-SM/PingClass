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

  var THREE = null;

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
    threePromise.then(function (lib) {
      THREE = lib || null;
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

    // Soft round glow sprite (canvas-drawn radial gradient) so particles are
    // round and glowy instead of square pixels.
    function makeGlowTexture() {
      var size = 64;
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var ctx = c.getContext('2d');
      var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }
    var glowTex = makeGlowTexture();

    // Soft additive halo behind the dash-card — the product gets a "lit"
    // presence instead of abstract specks.
    var halo = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x0d9488,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.position.set(1.0, 0, -2.4);
    group.add(halo);

    // Glow-dust field across the whole hero volume.
    var DCOUNT = 900;
    var dust = new Float32Array(DCOUNT * 3);
    for (var i = 0; i < DCOUNT; i++) {
      dust[i * 3] = -3.2 + Math.random() * 6.4;
      dust[i * 3 + 1] = -2.4 + Math.random() * 4.8;
      dust[i * 3 + 2] = -2.5 + Math.random() * 5.0;
    }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    var dustPoints = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.12,
      map: glowTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    }));
    group.add(dustPoints);

    // Sparse larger amber glow accents.
    var GCOUNT = 110;
    var glows = new Float32Array(GCOUNT * 3);
    for (var k = 0; k < GCOUNT; k++) {
      glows[k * 3] = -0.4 + Math.random() * 3.2;
      glows[k * 3 + 1] = -2.2 + Math.random() * 4.4;
      glows[k * 3 + 2] = -1.8 + Math.random() * 3.6;
    }
    var glowsGeo = new THREE.BufferGeometry();
    glowsGeo.setAttribute('position', new THREE.BufferAttribute(glows, 3));
    var glowPoints = new THREE.Points(glowsGeo, new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.42,
      map: glowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    }));
    group.add(glowPoints);

    // Orbit rings wrapped around the dash-card.
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.02, 12, 90),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.5 })
    );
    ring.position.set(1.0, 0, 0);
    ring.rotation.x = 0.7;
    ring.rotation.z = 0.25;
    group.add(ring);

    var amberRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.016, 12, 90),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35 })
    );
    amberRing.position.set(1.1, 0.35, -0.9);
    amberRing.rotation.x = 1.15;
    amberRing.rotation.z = 0.5;
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
      ring.rotation.z = 0.25 + t * 0.45;
      ring.rotation.x = 0.7 + Math.sin(t * 0.3) * 0.08;
      amberRing.rotation.z = 0.5 - t * 0.25;
      dustPoints.rotation.y = t * 0.01;
      glowPoints.rotation.y = -t * 0.02;

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
    console.info('PingClass 3D hero active');
  }
})();