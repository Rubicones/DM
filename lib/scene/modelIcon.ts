/**
 * Animated 3D project icon (lazy chunk — three + GLTFLoader load only when a
 * card with `iconModel` comes near the viewport).
 *
 * Port of the header logo from the Matvei Brumberg site (mb_front LogoScene):
 * same lens (focal length 200), lights, tone mapping and
 * baked GLB clips — every clip plays forward (×1.5) on hover and back (×−1.5)
 * on leave. Differences for this site:
 *   • model centred and framed by its bounding sphere (fits any tile size);
 *   • renders on demand: one frame after load, then frames only while a clip
 *     is moving (no idle loop; the rAF stops as soon as every clip settles);
 *   • no shadow map (the 0.1-intensity spot's 2048² shadow was invisible at icon size);
 *   • DPR capped by the quality tier; context loss → caller falls back to a letter.
 */
import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  Clock,
  DirectionalLight,
  Group,
  HemisphereLight,
  LoopOnce,
  PerspectiveCamera,
  SpotLight,
  SRGBColorSpace,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ModelIconHandle {
  /** true → play the clips forward, false → back to the start. */
  setHover(on: boolean): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

interface Options {
  src: string;
  dprMax: number;
  /** Jump instead of animating (prefers-reduced-motion). */
  instant: boolean;
  onLost: () => void;
}

const SPEED = 1.5;

export function createModelIcon(canvas: HTMLCanvasElement, opts: Options): ModelIconHandle {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dprMax));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  camera.setFocalLength(200);
  camera.position.set(0, 0, 18);
  /** Bounding-sphere radius of the model (set on load) → camera distance that fits it. */
  let radius = 0;
  const frame = () => {
    if (!radius) return;
    // fit the sphere into the narrower of the two fields of view, ~8% margin
    const v = (camera.fov * Math.PI) / 360;
    const h = Math.atan(Math.tan(v) * camera.aspect);
    camera.position.set(0, 0, (radius * 1.08) / Math.sin(Math.min(v, h)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const clock = new Clock(false);
  const actions: AnimationAction[] = [];
  let mixer: AnimationMixer | null = null;
  let raf = 0;
  let disposed = false;
  let hover = false;

  const render = () => renderer.render(scene, camera);

  const settled = () => {
    for (const a of actions) if (!a.paused) return false;
    return true;
  };

  const loop = () => {
    raf = 0;
    if (disposed || !mixer) return;
    mixer.update(Math.min(clock.getDelta(), 0.05));
    render();
    if (settled()) clock.stop();
    else raf = requestAnimationFrame(loop);
  };

  const run = () => {
    if (raf || disposed) return;
    clock.start();
    raf = requestAnimationFrame(loop);
  };

  const apply = () => {
    if (!mixer || !actions.length) return;
    for (const a of actions) {
      const d = a.getClip().duration;
      if (opts.instant) {
        a.time = hover ? d : 0;
        a.paused = true;
      } else {
        a.timeScale = hover ? SPEED : -SPEED;
        a.paused = false;
        a.play();
      }
    }
    if (opts.instant) {
      mixer.update(0);
      render();
    } else run();
  };

  new GLTFLoader().load(
    opts.src,
    (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.scale.setScalar(1.8);
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3()).length();
      const center = box.getCenter(new Vector3());
      // centred on the origin and framed by its bounding sphere (the header version
      // was hand-placed for a 60×90 canvas and sat low/small in a square tile)
      const pivot = new Group();
      model.position.set(-center.x, -center.y, -center.z);
      pivot.add(model);
      scene.add(pivot);
      radius = new Box3().setFromObject(pivot).getBoundingSphere(new Sphere()).radius;
      frame();
      center.set(0, 0, 0);

      const dist = size * 1.5;
      const height = size * 0.6;
      const side = size * 1.2;
      const key = new SpotLight(0xffe2c6, 0.1, dist * 3, Math.PI / 6, 0.3, 1.5);
      key.position.set(center.x + side, center.y + height, center.z + dist);
      key.target.position.copy(center);
      const fill = new DirectionalLight(0xcfe6ff, 2.0);
      fill.position.set(center.x - side * 1.2, center.y + height * 0.3, center.z + dist * 0.8);
      fill.target.position.copy(center);
      const rim = new DirectionalLight(0xffffff, 0.2);
      rim.position.set(center.x, center.y + height * 1.2, center.z - dist);
      rim.target.position.copy(center);
      scene.add(key, key.target, fill, fill.target, rim, rim.target, new HemisphereLight(0xeaf2ff, 0x1b1b1b, 0.7));

      if (gltf.animations.length) {
        mixer = new AnimationMixer(model);
        for (const clip of gltf.animations) {
          const a = mixer.clipAction(clip);
          a.setLoop(LoopOnce, 1);
          a.clampWhenFinished = true;
          a.time = 0;
          a.play();
          a.paused = true;
          actions.push(a);
        }
        mixer.update(0);
      }
      render();
      if (hover) apply(); // hovered while loading
    },
    undefined,
    (err) => console.warn('[model-icon] failed to load', opts.src, err),
  );

  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onLost();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    setHover(on) {
      if (on === hover) return;
      hover = on;
      apply();
    },
    resize(w, h) {
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frame();
      if (!raf) render();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      mixer?.stopAllAction();
      scene.traverse((o) => {
        const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material?.dispose();
      });
      renderer.dispose();
    },
  };
}
