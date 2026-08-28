// Chromatic Fluid Background - WebGL Shader
(function() {
  const canvas = document.getElementById('fluidCanvas');
  if (!canvas) return;

  // The page/hero base colour. Every failure path degrades to THIS exact shade
  // so the hero never flashes bright/white - it just quietly goes static.
  const DARK_BG = '#051f1c';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Small screens get a lighter shader (fewer fbm octaves) so cheap mobile GPUs
  // don't stall/hitch; forces fewer per-pixel noise lookups.
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
  const OCTAVES = isSmallScreen ? 3 : 5;

  let gl = null;
  let program = null;
  let timeLocation = null;
  let resolutionLocation = null;
  let positionLocation = null;
  let running = false;
  let animId = null;
  let resumeTimer = null;

  function setFallback() {
    stopLoop();
    canvas.style.background = DARK_BG;
    canvas.classList.add('ready');
  }

  function stopLoop() {
    running = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function canvasInView() {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function startLoop() {
    if (running || !program || !gl || prefersReducedMotion) return;
    if (!canvasInView()) return;
    running = true;
    animId = requestAnimationFrame(render);
  }

  // ── Shaders ────────────────────────────────────────────────
  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  function fragmentShaderSource() {
    const precision = (() => {
      try {
        const p = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        return p && p.precision > 0 ? 'precision highp float;' : 'precision mediump float;';
      } catch (e) {
        return 'precision mediump float;';
      }
    })();
    const loop = OCTAVES;
    return `
      ${precision}
      uniform float u_time;
      uniform vec2 u_resolution;

      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
        vec2 i0 = floor(v + dot(v, C.yy));
        vec2 x0 = v - i0 + dot(i0, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i0 = mod(i0, 289.0);
        vec3 p = permute(permute(i0.y + vec3(0.0, i1.y, 1.0))
          + i0.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float f = 0.0;
        float w = 0.5;
        for (int i = 0; i < ${loop}; i++) {
          f += w * snoise(p);
          p *= 2.0;
          w *= 0.5;
        }
        return f;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float t = u_time * 0.25;

        vec2 q = vec2(
          fbm(uv + vec2(0.0, 0.0) + t * 0.1),
          fbm(uv + vec2(5.2, 1.3) + t * 0.12)
        );

        vec2 r = vec2(
          fbm(uv + 4.0 * q + vec2(1.7, 9.2) + t * 0.15),
          fbm(uv + 4.0 * q + vec2(8.3, 2.8) + t * 0.126)
        );

        float f = fbm(uv + 4.0 * r);

        vec3 deepTeal = vec3(0.051, 0.58, 0.533);
        vec3 darkTeal = vec3(0.075, 0.306, 0.29);
        vec3 lightTeal = vec3(0.18, 0.831, 0.796);
        vec3 amber = vec3(0.851, 0.467, 0.024);

        vec3 col = mix(darkTeal, deepTeal, clamp(f * f * 2.0, 0.0, 1.0));
        col = mix(col, lightTeal, clamp(length(q) * 0.7, 0.0, 1.0));
        col = mix(col, amber, clamp(length(r.x) * 0.3, 0.0, 1.0));

        float glint = pow(max(0.0, snoise(uv * 2.5 + t * 0.4)), 8.0);
        col += vec3(0.95, 0.98, 1.0) * glint * 0.25;

        float light = 1.0 - length(uv - vec2(0.5)) * 1.0;
        light = max(0.0, light);
        col *= 0.85 + light * 0.4;

        float grain = (fract(sin(dot(uv * u_time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.04;
        col += grain;

        float vignette = 1.0 - length(uv - 0.5) * 0.6;
        col *= vignette;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
  }

  // ── GL setup (re-runs on webglcontextrestored) ─────────────
  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function buildProgram() {
    const vert = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const frag = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource());
    if (!vert || !frag) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    return {
      program: prog,
      timeLocation: gl.getUniformLocation(prog, 'u_time'),
      resolutionLocation: gl.getUniformLocation(prog, 'u_resolution'),
      positionLocation: posLoc
    };
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(time) {
    if (!running) return;
    if (!program || !gl) return;
    gl.uniform1f(timeLocation, time * 0.001);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!canvas.classList.contains('ready')) canvas.classList.add('ready');
    animId = requestAnimationFrame(render);
  }

  function init() {
    stopLoop();
    gl = null;
    program = null;

    const attrs = {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    };
    const ctx = canvas.getContext('webgl2', attrs)
      || canvas.getContext('webgl', attrs)
      || canvas.getContext('experimental-webgl', attrs);
    if (!ctx) { setFallback(); return; }

    gl = ctx;
    resize();

    const built = buildProgram();
    if (!built) { setFallback(); return; }
    program = built.program;
    timeLocation = built.timeLocation;
    resolutionLocation = built.resolutionLocation;
    positionLocation = built.positionLocation;

    if (prefersReducedMotion) {
      // Reduced motion: render a single static frame, no loop.
      gl.uniform1f(timeLocation, 0);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.classList.add('ready');
      return;
    }

    if (canvasInView()) startLoop();
  }

  // ── Context loss/restore: a lost context is why the hero used to
  //    go white/garbage on mobile - we freeze to the dark base instead. ──
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    setFallback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    init();
  });

  // Pause while scrolling, resume ~150ms after the last scroll event and only
  // if the hero is actually on screen (frees the mobile main thread during
  // fast flicks AND stops rendering an invisible off-screen canvas).
  const scrollPause = () => {
    stopLoop();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (prefersReducedMotion) return;
      if (document.body.style.overflow === 'hidden') return; // auth modal open
      if (canvasInView()) startLoop();
    }, 150);
  };
  window.addEventListener('scroll', scrollPause, { passive: true });

  // Only render while the hero is in view at all.
  const viewObserver = new IntersectionObserver((entries) => {
    if (!program || prefersReducedMotion) return;
    if (entries[0].isIntersecting) startLoop();
    else stopLoop();
  }, { threshold: 0 });
  viewObserver.observe(canvas);

  window.addEventListener('resize', resize, { passive: true });

  window.fluidPause = () => { stopLoop(); };
  window.fluidResume = () => {
    if (prefersReducedMotion || !program) return;
    if (document.body.style.overflow === 'hidden') return;
    if (canvasInView()) startLoop();
  };

  init();
})();