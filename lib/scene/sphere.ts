/**
 * SPHERE FLY-THROUGH (Three.js) — lazy chunk, driven by the site's single ticker.
 *
 * Fill-rate rules (flying INSIDE a point cloud is the expensive part):
 *   - gl_PointSize clamped (device px, DPR-scaled), points shrink + fade near
 *     the camera and collapse to 0 under a near threshold
 *   - round points via gl_PointCoord + discard (no textures), mediump fragment
 *   - additive (order-independent) blending, depthTest/depthWrite off → no sorting
 *   - one Points object, one draw call
 * CPU never writes attributes per frame — only camera/uniforms. Renders on
 * demand: when progress/camera changed, or at the tier's idle-drift rate.
 * Mobile: lower DPR cap / idle rate / max point size (QualityPreset.mobile*),
 * and dynamic resolution — sustained slow frames shrink the drawing buffer
 * (instant, no geometry rebuild) before the engine drops a whole tier.
 * Choreography keyframes: lib/scene/sphereChoreography.ts
 */
import * as THREE from 'three';
import type { QualityPreset } from '@/config/quality';
import { SPHERE, sampleKeys, type SphereKey } from './sphereChoreography';

export interface SphereOptions {
  mobile: boolean;
  preset: QualityPreset;
  /** Chapter-local progress (unclamped). */
  getProgress: () => number;
  /** dark3d theme blend weight (0…1) — the scene fades through a uniform, never CSS opacity. */
  getWeight: () => number;
  onContextLost: () => void;
  onContextRestored: () => void;
}

export interface SceneHandle {
  /** Subscribe this to RailEngine.addSceneTicker. Returns true while it wants frames. */
  tick: (now: number, dtMs: number) => boolean;
  /** Resolves after shaders are compiled (no hitch on chapter entry). */
  ready: Promise<void>;
  info: () => string;
  setPreset: (p: QualityPreset) => void;
  dispose: () => void;
}

const VERTEX = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aKind;
attribute vec3 aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform float uFade;
uniform float uMaxSize;
varying float vAlpha;
void main(){
  vec3 pos = position;
  if (aKind > 1.5) {
    pos += vec3(
      sin(uTime * 0.11 + aSeed.x * 6.28),
      cos(uTime * 0.09 + aSeed.y * 6.28),
      sin(uTime * 0.07 + aSeed.z * 6.28)
    ) * 0.45;
  }
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float d = -mv.z;
  gl_Position = projectionMatrix * mv;
  float nearFade = smoothstep(0.35, 2.6, d);           // fade + shrink near the lens
  float depth = 1.0 - smoothstep(6.0, 75.0, d) * 0.8;   // far = dim
  float size = aSize * uPixelRatio * (26.0 / max(d, 0.01));
  gl_PointSize = d < 0.35 ? 0.0 : min(size, uMaxSize) * nearFade;
  vAlpha = aBright * depth * nearFade * uFade;
}`;

const FRAGMENT = /* glsl */ `
precision mediump float;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(vec3(0.94), vAlpha);
}`;

function fibonacciShell(n: number, r: number, out: Float32Array, offset: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const o = (offset + i) * 3;
    out[o] = Math.cos(th) * rad * r;
    out[o + 1] = y * r;
    out[o + 2] = Math.sin(th) * rad * r;
  }
}

function buildGeometry(mobile: boolean, factor: number): THREE.BufferGeometry {
  const cfg = mobile ? SPHERE.points.mobile : SPHERE.points.desktop;
  const outer = Math.max(200, Math.round(cfg.outer * factor));
  const shells = cfg.shells.map((n) => Math.max(80, Math.round(n * factor)));
  const field = Math.max(60, Math.round(cfg.field * factor));
  const total = outer + shells.reduce((a, b) => a + b, 0) + field;
  const pos = new Float32Array(total * 3);
  const size = new Float32Array(total);
  const bright = new Float32Array(total);
  const kind = new Float32Array(total);
  const seed = new Float32Array(total * 3);
  let s = 12345;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let at = 0;
  const attrs = (count: number, k: number, sz: number, br: number) => {
    for (let i = 0; i < count; i++) {
      const j = at + i;
      size[j] = sz * (0.75 + rnd() * 0.5);
      bright[j] = br * (0.7 + rnd() * 0.3);
      kind[j] = k;
      seed[j * 3] = rnd();
      seed[j * 3 + 1] = rnd();
      seed[j * 3 + 2] = rnd();
    }
    at += count;
  };
  fibonacciShell(outer, SPHERE.radius, pos, at);
  attrs(outer, 0, 1.0, 1.0);
  shells.forEach((n, i) => {
    fibonacciShell(n, SPHERE.radius * SPHERE.shells[i], pos, at);
    attrs(n, 1, 0.8, 0.75 - i * 0.12);
  });
  for (let i = 0; i < field; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = SPHERE.radius * 0.92 * Math.cbrt(rnd());
    const q = Math.sqrt(1 - u * u);
    const o = (at + i) * 3;
    pos[o] = Math.cos(th) * q * r;
    pos[o + 1] = u * r;
    pos[o + 2] = Math.sin(th) * q * r;
  }
  attrs(field, 2, 0.6, 0.55);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  return g;
}

/** Dynamic resolution: scale range and thresholds (avg frame interval while rendering, ms). */
const RES_MIN = 0.6;
const RES_STEP = 0.85;
const RES_SLOW_MS = 20;
const RES_FAST_MS = 14;
const IS_SAFARI =
  typeof navigator !== 'undefined' && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent);

export function createSphere(canvas: HTMLCanvasElement, opts: SphereOptions): SceneHandle {
  let preset = opts.preset;
  const dprCap = (p: QualityPreset) => (opts.mobile ? p.mobileDprMax : p.dprMax);
  const idleFps = (p: QualityPreset) => (opts.mobile ? p.mobileIdleFps : p.idleFps);
  const maxPoint = opts.mobile ? 4.5 : 5.5;
  let resScale = 1;
  // Safari's WebGL (ANGLE→Metal) pays heavily for fill rate with this many additive point
  // sprites on a full-screen retina canvas, and its rAF timing hides it from the dynamic-resolution
  // monitor → hard cap the resolution there (points stay crisp; they're tiny either way)
  const safariCap = IS_SAFARI ? 1.25 : Infinity;
  const targetDpr = () =>
    Math.max(0.5, Math.round(Math.min(dprCap(preset), safariCap, window.devicePixelRatio || 1) * resScale * 100) / 100);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
    depth: false,
  });
  let dpr = targetDpr();
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);

  let geometry = buildGeometry(opts.mobile, preset.pointsFactor);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    // rgb += c·a, alpha += a  → identical to normal blending for a lone dot,
    // additive where dots overlap; order-independent, so no sorting needed
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uFade: { value: 0 },
      uMaxSize: { value: maxPoint * dpr },
    },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.rotation.x = 0.35;
  group.add(points);
  scene.add(group);

  let width = 0;
  let height = 0;
  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    // mobile toolbar show/hide changes only height by a little — ignore tiny height changes
    if (w === width && Math.abs(h - height) < 120 && width !== 0) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  if (canvas.parentElement) ro.observe(canvas.parentElement);

  let lost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    opts.onContextLost();
  };
  const onRestored = () => opts.onContextRestored();
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const key: SphereKey = { p: 0, camX: 0, camY: 0, camZ: 60, spin: 0, fade: 1 };
  sampleKeys(opts.getProgress(), key);
  camera.position.set(key.camX, key.camY, key.camZ);
  let spin = key.spin;
  let idleTime = 0;
  let lastRender = -Infinity;
  let lastFade = -1;
  let dirty = true;
  let ready = false;
  let disposed = false;
  // dynamic resolution bookkeeping (only frames rendered back-to-back count)
  let renderedLast = false;
  let frameEma = 16.7;
  let slowMs = 0;
  let fastMs = 0;

  const applyDpr = () => {
    const next = targetDpr();
    if (next === dpr) return;
    dpr = next;
    renderer.setPixelRatio(dpr);
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uMaxSize.value = maxPoint * dpr;
    width = 0;
    resize();
  };

  const adapt = (dtMs: number) => {
    frameEma += (dtMs - frameEma) * 0.1;
    // iOS Low Power Mode: a steady ~33 ms is the rAF cap, not GPU load
    const capped = frameEma > 31 && frameEma < 35.5;
    if (frameEma > RES_SLOW_MS && !capped) {
      slowMs += dtMs;
      fastMs = 0;
      if (slowMs > 500 && resScale > RES_MIN) {
        resScale = Math.max(RES_MIN, resScale * RES_STEP);
        slowMs = 0;
        frameEma = 16.7;
        applyDpr();
      }
    } else if (frameEma < RES_FAST_MS) {
      slowMs = 0;
      fastMs += dtMs;
      if (fastMs > 5000 && resScale < 1) {
        resScale = Math.min(1, resScale / RES_STEP);
        fastMs = 0;
        applyDpr();
      }
    } else slowMs = Math.max(0, slowMs - dtMs);
  };

  resize();
  const readyP = renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      ready = true;
    });

  const tick = (now: number, dtMs: number) => {
    if (disposed || lost || !ready || document.hidden) return !ready && !disposed;
    const w = opts.getWeight();
    if (w <= 0.001) {
      if (lastFade !== 0) {
        material.uniforms.uFade.value = 0;
        renderer.clear();
        lastFade = 0;
      }
      return false;
    }
    const f = dtMs / 16.67;
    const k = 1 - Math.pow(1 - SPHERE.cameraLerp, f);
    sampleKeys(opts.getProgress(), key);
    const dx = key.camX - camera.position.x;
    const dy = key.camY - camera.position.y;
    const dz = key.camZ - camera.position.z;
    const ds = key.spin - spin;
    const moving = Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-3 || Math.abs(ds) > 1e-4;
    if (moving) {
      camera.position.x += dx * k;
      camera.position.y += dy * k;
      camera.position.z += dz * k;
      spin += ds * k;
    }
    const fps = idleFps(preset);
    const idle = fps > 0;
    const idleDue = idle && now - lastRender >= 1000 / fps - 1;
    if (idle) idleTime += dtMs / 1000;
    const fade = Math.round(key.fade * w * 0.92 * 1000) / 1000;

    if (moving || idleDue || dirty || fade !== lastFade) {
      camera.lookAt(camera.position.x * 0.3, camera.position.y * 0.3, camera.position.z - 10);
      group.rotation.y = spin + idleTime * SPHERE.idleSpin;
      material.uniforms.uTime.value = idleTime;
      material.uniforms.uFade.value = fade;
      if (renderedLast && moving) adapt(dtMs);
      renderer.render(scene, camera);
      lastRender = now;
      lastFade = fade;
      dirty = false;
      renderedLast = true;
    } else renderedLast = false;
    return moving || idle;
  };

  return {
    tick,
    ready: readyP,
    info: () => {
      const i = renderer.info;
      return `calls ${i.render.calls} · points ${i.render.points} · geo ${i.memory.geometries} · tex ${i.memory.textures} · dpr ${dpr}`;
    },
    setPreset(p) {
      if (p.pointsFactor !== preset.pointsFactor) {
        const old = geometry;
        geometry = buildGeometry(opts.mobile, p.pointsFactor);
        points.geometry = geometry;
        old.dispose();
      }
      preset = p;
      resScale = 1; // a new tier starts from its own cap
      slowMs = fastMs = 0;
      applyDpr();
      dirty = true;
    },
    dispose() {
      disposed = true;
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (!lost) renderer.forceContextLoss();
    },
  };
}
