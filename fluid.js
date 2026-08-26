// Chromatic Fluid Background - WebGL Shader
(function() {
  const canvas = document.getElementById('fluidCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    canvas.style.background = 'linear-gradient(135deg, #134E4A 0%, #0D9488 50%, #2DD4BF 100%)';
    return;
  }

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  // Vertex shader
  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment shader
  const fragmentShaderSource = `
    precision mediump float;
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
      for (int i = 0; i < 5; i++) {
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
      
      // PingClass teal palette
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

  const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    canvas.style.background = 'linear-gradient(135deg, #134E4A 0%, #0D9488 50%, #2DD4BF 100%)';
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  // Full-screen quad
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1
  ]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

  let animId = null;
  let paused = false;

  function render(time) {
    if (paused) return;
    gl.uniform1f(timeLocation, time * 0.001);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    if (!prefersReducedMotion) {
      animId = requestAnimationFrame(render);
    }
  }

  window.fluidPause = () => { paused = true; if (animId) cancelAnimationFrame(animId); };
  window.fluidResume = () => { if (!prefersReducedMotion && paused) { paused = false; animId = requestAnimationFrame(render); } };

  if (prefersReducedMotion) {
    gl.uniform1f(timeLocation, 0);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } else {
    animId = requestAnimationFrame(render);
  }
})();
