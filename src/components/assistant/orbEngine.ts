// Fluid orb engine for the Master Agent presence.
// Plain WebGL (no extra dependency): one full-screen quad, one fragment shader.
// The fluid surface and the face are separate sets of uniforms, so blinking,
// gaze and expression change without restarting the fluid animation.

export type OrbState =
  | 'boot'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'delegating'
  | 'speaking'
  | 'success'
  | 'error';

export interface OrbHandle {
  setState: (state: OrbState) => void;
  /** Voice loudness 0..1 while speaking. Pass null when no audio data exists. */
  setLevel: (level: number | null) => void;
  setReducedMotion: (reduced: boolean) => void;
  destroy: () => void;
}

interface Look {
  speed: number;
  bright: number;
  deep: number;
  orange: number;
  scale: number;
  flash: number;
  warn: number;
  open: number;
  narrow: number;
  happy: number;
  concern: number;
  face: number;
}

const BASE: Look = { speed: 0.55, bright: 1, deep: 0, orange: 0.04, scale: 1, flash: 0, warn: 0, open: 1, narrow: 0, happy: 0, concern: 0, face: 1 };

const LOOKS: Record<OrbState, Look> = {
  boot: { ...BASE, speed: 0.4, bright: 0.72, open: 0, face: 0 },
  idle: BASE,
  listening: { ...BASE, speed: 0.7, bright: 1.16, scale: 1.035, open: 1.12 },
  thinking: { ...BASE, speed: 1.9, bright: 0.96, deep: 0.6, narrow: 0.3 },
  delegating: { ...BASE, speed: 1.35, bright: 1.04, orange: 1 },
  speaking: { ...BASE, speed: 1, bright: 1.08 },
  success: { ...BASE, speed: 0.8, bright: 1.12, flash: 1, happy: 1 },
  error: { ...BASE, speed: 0.38, bright: 0.86, warn: 1, concern: 1, narrow: 0.25 },
};

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Simplex noise by Ian McEwan and Stefan Gustavson (Ashima Arts), MIT licence.
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uBright;
uniform float uDeep;
uniform float uOrange;
uniform float uScale;
uniform float uFlash;
uniform float uWarn;
uniform float uOpen;
uniform float uNarrow;
uniform float uHappy;
uniform float uConcern;
uniform float uFace;
uniform vec2 uGaze;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 2; i++) { s += a * snoise(p); p = p * 1.9 + vec3(17.1, 3.7, 9.2); a *= 0.35; }
  return s;
}

float fbm4(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * snoise(p); p = p * 1.9 + vec3(11.3, 23.9, 5.4); a *= 0.32; }
  return s;
}

float eyeShape(vec2 p, float side) {
  vec2 e = p - vec2(side * 0.2, 0.03) - uGaze * vec2(0.075, 0.06);
  float ang = -side * uConcern * 0.3;
  float c = cos(ang);
  float s = sin(ang);
  e = vec2(c * e.x - s * e.y, s * e.x + c * e.y);
  float w = 0.058;
  float h = max(0.15 * uOpen * (1.0 - 0.35 * uNarrow), 0.011);
  float rr = min(w, h);
  float capsule = length(max(abs(e) - vec2(w - rr, h - rr), 0.0)) - rr;
  vec2 a = e - vec2(0.0, -0.075);
  float arc = max(abs(length(a) - 0.125) - 0.034, 0.03 - a.y);
  return mix(capsule, arc, uHappy);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float R = 0.72 * uScale;
  vec2 p = uv / R;
  float r = length(p);
  float px = 2.0 / (R * uRes.x);

  vec3 haloTint = mix(vec3(0.10, 0.42, 1.0), vec3(1.0, 0.5, 0.14), uOrange * 0.3);
  haloTint = mix(haloTint, vec3(0.95, 0.3, 0.16), uWarn * 0.45);
  float halo = exp(-max(r - 1.0, 0.0) * 6.0) * 0.5 * clamp(uBright + uFlash * 0.4, 0.0, 1.6);
  halo *= smoothstep(1.0, 0.84, length(uv));

  vec3 col = vec3(0.0);
  if (r < 1.0 + px) {
    float z = sqrt(max(1.0 - r * r, 0.0));
    vec2 q = p / (0.6 + 0.4 * z);
    float t = uTime;
    vec3 P = vec3(q * 0.7, t * 0.2);
    float w1 = fbm3(P);
    float w2 = fbm3(P + vec3(5.2, 1.3, 2.8));
    float f = fbm4(vec3(q * 0.75 + vec2(w1, w2) * 0.8 + vec2(t * 0.05, -t * 0.04), t * 0.15 + 7.0));
    f = clamp(f * 0.85 + 0.5, 0.0, 1.0);

    float body = smoothstep(0.1, 0.6, f);
    float cloud = smoothstep(0.42, 0.88, f);
    vec3 deep = mix(vec3(0.01, 0.07, 0.46), vec3(0.0, 0.02, 0.30), uDeep);
    vec3 electric = mix(vec3(0.04, 0.32, 1.0), vec3(0.03, 0.17, 0.92), uDeep);
    col = mix(deep, electric, body);
    col = mix(col, vec3(0.72, 0.9, 1.0), cloud * 0.85);
    col = mix(col, vec3(1.0), smoothstep(0.72, 1.0, f) * 0.55);

    float ember = smoothstep(0.1, 0.55, w2) * (1.0 - cloud * 0.6);
    col = mix(col, vec3(1.0, 0.5, 0.12), ember * uOrange * 0.42);

    vec3 n = vec3(p, z);
    float light = dot(n, normalize(vec3(-0.35, 0.5, 0.8)));
    col *= 0.68 + 0.42 * light;
    float fres = pow(1.0 - z, 2.5);
    col += vec3(0.35, 0.65, 1.0) * fres * 0.55;
    col += vec3(0.5, 0.7, 1.0) * smoothstep(0.55, 0.0, length(p - vec2(-0.38, 0.45))) * 0.12;

    col = mix(col, vec3(dot(col, vec3(0.3, 0.6, 0.1))), uWarn * 0.22);
    col += vec3(0.95, 0.28, 0.12) * fres * uWarn * 0.75;
    col += vec3(0.55, 0.75, 1.0) * uFlash * 0.32 * (0.4 + 0.6 * z);
    col *= uBright;

    float veil = smoothstep(0.66, 0.12, length(p - vec2(0.0, 0.02))) * 0.55 * uFace;
    col = mix(col, col * 0.42 + vec3(0.0, 0.03, 0.2), veil);
    float d = min(eyeShape(p, -1.0), eyeShape(p, 1.0));
    float core = smoothstep(px, -px, d) * uFace;
    float glow = exp(-max(d, 0.0) * 20.0) * 0.5 * uFace;
    col += vec3(0.25, 0.85, 1.0) * glow * (1.0 - core);
    col = mix(col, vec3(0.92, 0.98, 1.0), core);
  }

  float inside = smoothstep(1.0 + px, 1.0 - px, r);
  vec3 outCol = mix(haloTint * halo, col, inside);
  float alpha = mix(halo, 1.0, inside);
  gl_FragColor = vec4(outCol, alpha);
}
`;

const UNIFORMS = ['uRes', 'uTime', 'uBright', 'uDeep', 'uOrange', 'uScale', 'uFlash', 'uWarn', 'uOpen', 'uNarrow', 'uHappy', 'uConcern', 'uFace', 'uGaze'] as const;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function createOrb(canvas: HTMLCanvasElement, options: { reducedMotion?: boolean } = {}): OrbHandle {
  const attributes: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
  const gl = (canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes)) as WebGLRenderingContext | null;
  if (!gl) throw new Error('WebGL is not available');

  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let locations: Record<string, WebGLUniformLocation | null> = {};

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Shader compile failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  };

  const setup = () => {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram();
    if (!program) throw new Error('Could not create program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    locations = {};
    UNIFORMS.forEach((name) => { locations[name] = gl.getUniformLocation(program as WebGLProgram, name); });
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
  };
  setup();

  let state: OrbState = 'boot';
  let reduced = Boolean(options.reducedMotion);
  let level: number | null = null;
  const current: Look = { ...LOOKS.boot };
  const gaze = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let extraNarrow = 0;
  let extraNarrowTarget = 0;
  let fluidTime = rand(0, 400);
  let clock = 0;
  let nextGaze = 1.2;
  let nextBlink = rand(1.5, 3);
  let blinkStart = -1;
  let doubleBlink = false;
  let last = 0;
  let frame = 0;
  let visible = true;
  let onScreen = true;
  let destroyed = false;
  let contextLost = false;

  const resize = () => {
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const ratio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    const side = Math.max(64, Math.round(canvas.clientWidth * ratio));
    if (canvas.width !== side || canvas.height !== side) {
      canvas.width = side;
      canvas.height = side;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const pickGaze = () => {
    extraNarrowTarget = 0;
    if (reduced || state === 'listening' || state === 'success' || state === 'boot') {
      gaze.targetX = 0; gaze.targetY = 0; nextGaze = clock + 2;
    } else if (state === 'error') {
      gaze.targetX = 0; gaze.targetY = -0.45; nextGaze = clock + 2;
    } else if (state === 'thinking') {
      gaze.targetX = (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.9); gaze.targetY = rand(0.35, 0.85); nextGaze = clock + rand(0.9, 1.8);
    } else if (state === 'delegating') {
      gaze.targetX = (gaze.targetX > 0 ? -1 : 1) * rand(0.7, 1); gaze.targetY = rand(-0.15, 0.15); nextGaze = clock + rand(0.7, 1.2);
    } else if (state === 'speaking') {
      gaze.targetX = rand(-0.3, 0.3); gaze.targetY = rand(-0.15, 0.2); nextGaze = clock + rand(0.8, 1.6);
    } else if (Math.random() < 0.55) {
      gaze.targetX = 0; gaze.targetY = 0; nextGaze = clock + rand(2.2, 4.6);
      if (Math.random() < 0.2) extraNarrowTarget = 0.4;
    } else {
      gaze.targetX = rand(-0.85, 0.85); gaze.targetY = rand(-0.4, 0.55); nextGaze = clock + rand(1.1, 2.4);
    }
  };

  const blinkAmount = () => {
    if (reduced || state === 'boot') return 0;
    if (blinkStart < 0 && clock >= nextBlink) blinkStart = clock;
    if (blinkStart < 0) return 0;
    const progress = (clock - blinkStart) / 0.17;
    if (progress >= 1) {
      blinkStart = -1;
      if (!doubleBlink && Math.random() < 0.2) { doubleBlink = true; nextBlink = clock + 0.11; }
      else { doubleBlink = false; nextBlink = clock + (state === 'thinking' ? rand(1.5, 3.2) : rand(2.4, 5.8)); }
      return 0;
    }
    return Math.pow(Math.sin(Math.PI * progress), 0.7);
  };

  const render = (now: number) => {
    frame = 0;
    if (destroyed || contextLost || !visible || !onScreen) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    clock += dt;

    const target = LOOKS[state];
    const ease = 1 - Math.exp(-dt * 4.2);
    (Object.keys(current) as (keyof Look)[]).forEach((key) => { current[key] += (target[key] - current[key]) * ease; });
    fluidTime += dt * current.speed * (reduced ? 0.2 : 1);

    if (clock >= nextGaze) pickGaze();
    const gazeEase = 1 - Math.exp(-dt * 6.5);
    gaze.x += (gaze.targetX - gaze.x) * gazeEase;
    gaze.y += (gaze.targetY - gaze.y) * gazeEase;
    extraNarrow += (extraNarrowTarget - extraNarrow) * ease;

    let scale = current.scale;
    let bright = current.bright;
    if (!reduced) {
      if (state === 'listening') scale += 0.008 * Math.sin(clock * 2.2);
      if (state === 'speaking') {
        const voice = level !== null ? Math.max(0, Math.min(1, level)) : (0.5 + 0.5 * Math.sin(clock * 7.3)) * (0.55 + 0.45 * Math.sin(clock * 2.1 + 1));
        scale += 0.032 * voice;
        bright += 0.09 * voice;
      }
    }

    resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(locations.uRes, canvas.width, canvas.height);
    gl.uniform1f(locations.uTime, fluidTime);
    gl.uniform1f(locations.uBright, bright);
    gl.uniform1f(locations.uDeep, current.deep);
    gl.uniform1f(locations.uOrange, current.orange);
    gl.uniform1f(locations.uScale, scale);
    gl.uniform1f(locations.uFlash, current.flash);
    gl.uniform1f(locations.uWarn, current.warn);
    gl.uniform1f(locations.uOpen, current.open * (1 - blinkAmount()));
    gl.uniform1f(locations.uNarrow, Math.min(1, current.narrow + extraNarrow));
    gl.uniform1f(locations.uHappy, current.happy);
    gl.uniform1f(locations.uConcern, current.concern);
    gl.uniform1f(locations.uFace, current.face);
    gl.uniform2f(locations.uGaze, gaze.x, gaze.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(render);
  };

  const wake = () => {
    if (!frame && !destroyed && !contextLost && visible && onScreen) {
      last = 0;
      frame = requestAnimationFrame(render);
    }
  };

  const onVisibility = () => { visible = document.visibilityState !== 'hidden'; wake(); };
  const onLost = (event: Event) => { event.preventDefault(); contextLost = true; };
  const onRestored = () => { try { setup(); contextLost = false; wake(); } catch { contextLost = true; } };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => { onScreen = entries[0]?.isIntersecting ?? true; wake(); });
    observer.observe(canvas);
  }
  wake();

  return {
    setState: (next) => {
      if (next === state) return;
      state = next;
      nextGaze = clock;
      if (next === 'listening' || next === 'thinking') nextBlink = Math.min(nextBlink, clock + 0.25);
    },
    setLevel: (next) => { level = next; },
    setReducedMotion: (next) => { reduced = next; },
    destroy: () => {
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (!contextLost) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
      }
    },
  };
}
