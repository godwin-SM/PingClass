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

    // ── The product, in motion ──
    // The dash-card is the institute "core". Glow-nodes on the rings are
    // students & parents orbiting your institute. The sweeping bright arc is
    // the LIVE collection percentage read straight off the card next to it.
    // Amber pulses are fee payments arriving on autopilot. Every element maps
    // to the product — nothing here is abstract decoration.
    var coreGroup = new THREE.Group();
    coreGroup.position.set(1.0, 0, 0);
    group.add(coreGroup);

    var halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x0d9488,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreGroup.add(halo);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.015, 12, 100),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.4 })
    );
    coreGroup.add(ring);

    var amberRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.012, 12, 100),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.3 })
    );
    amberRing.rotation.x = 1.25;
    coreGroup.add(amberRing);

    // Nodes on each ring = students/parents connected to the institute.
    function buildOrbitNodes(count, radius, color, size, opacity, tilt) {
      var geo = new THREE.BufferGeometry();
      var arr = new Float32Array(count * 3);
      for (var n = 0; n < count; n++) {
        var a = (n / count) * Math.PI * 2;
        arr[n * 3] = Math.cos(a) * radius;
        arr[n * 3 + 1] = Math.sin(a) * radius;
        arr[n * 3 + 2] = 0;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      var pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: color,
        size: size,
        map: glowTex,
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      }));
      if (tilt) pts.rotation.x = tilt;
      coreGroup.add(pts);
      return pts;
    }
    var tealNodes = buildOrbitNodes(22, 1.9, 0x5eead4, 0.18, 0.95, 0);
    var amberNodes = buildOrbitNodes(12, 2.5, 0xfbbf24, 0.22, 0.75, 1.25);

    // Collection gauge — the bright arc mirrors the card's real percentage.
    var gaugeFrac = 0.88;
    var gaugeLabel = document.querySelector('.dash-card-progress-head strong');
    if (gaugeLabel) {
      var gaugeVal = parseFloat(String(gaugeLabel.textContent || '').replace(/[^0-9.]/g, ''));
      if (isFinite(gaugeVal)) gaugeFrac = Math.min(1, Math.max(0, gaugeVal / 100));
    }
    var GAUGE_R = 1.9, GSEGS = 100;
    var gaugePos = new Float32Array(GSEGS * 3);
    for (var g = 0; g < GSEGS; g++) {
      var ga = (g / GSEGS) * Math.PI * 2;
      gaugePos[g * 3] = Math.cos(ga) * GAUGE_R;
      gaugePos[g * 3 + 1] = Math.sin(ga) * GAUGE_R;
      gaugePos[g * 3 + 2] = 0.02;
    }
    var gaugeGeo = new THREE.BufferGeometry();
    gaugeGeo.setAttribute('position', new THREE.BufferAttribute(gaugePos, 3));
    gaugeGeo.setDrawRange(0, Math.round(GSEGS * gaugeFrac));
    var gaugeGroup = new THREE.Group();
    var gaugeLine = new THREE.Line(gaugeGeo, new THREE.LineBasicMaterial({
      color: 0x5eead4, transparent: true, opacity: 0.9
    }));
    gaugeGroup.add(gaugeLine);
    var gaugeTip = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x5eead4, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    var tipA = gaugeFrac * Math.PI * 2;
    gaugeTip.position.set(Math.cos(tipA) * GAUGE_R, Math.sin(tipA) * GAUGE_R, 0.02);
    gaugeGroup.add(gaugeTip);
    coreGroup.add(gaugeGroup);

    // Payment pulses — amber sparks spiral into the core ("fee received").
    var sparks = [];
    for (var s = 0; s < 6; s++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xfbbf24, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.userData.phase = s / 6;
      sp.scale.setScalar(0.6);
      coreGroup.add(sp);
      sparks.push(sp);
    }

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

      // Students/parents orbit the institute, the gauge sweeps, payments flow in.
      tealNodes.rotation.z = t * 0.35;
      amberNodes.rotation.z = -t * 0.22;
      gaugeGroup.rotation.z = t * 0.15;
      gaugeTip.scale.setScalar(0.55 + Math.sin(t * 6) * 0.12);
      for (var s = 0; s < sparks.length; s++) {
        var sp = sparks[s];
        var f = (t * 0.14 + sp.userData.phase) % 1;
        var ang = f * Math.PI * 2 * 1.6;
        var rr = 3.1 - f * 3.0;
        sp.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr, 0.3);
        sp.material.opacity = Math.sin(f * Math.PI) * 0.85;
      }

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