/**
 * 3D CHAPTER — sphere fly-through keyframes.
 * `p` is chapter-local progress (0 = chapter start, 1 = chapter end).
 * The outer shell has radius SPHERE.radius; the camera looks down −Z.
 * Between keys values are smoothstep-interpolated; the camera then eases
 * toward the result (lerp), so it's never tied 1:1 to raw scroll.
 */
export interface SphereKey {
  p: number;
  /** Camera position. Shell is crossed when |cam| ≈ radius. */
  camX: number;
  camY: number;
  camZ: number;
  /** Extra rotation of the cloud (radians) driven by scroll. */
  spin: number;
  /** Scene opacity multiplier. */
  fade: number;
}

export const SPHERE = {
  radius: 10,
  /** Nested inner shells, as fractions of the outer radius. */
  shells: [0.62, 0.36],
  points: {
    desktop: { outer: 5200, shells: [2000, 900], field: 900 },
    mobile: { outer: 2400, shells: [900, 420], field: 420 },
  },
  /** Idle rotation, rad/s — very slow. */
  idleSpin: 0.012,
  /** Camera easing per frame (60fps). */
  cameraLerp: 0.07,
};

export const SPHERE_KEYS: SphereKey[] = [
  // 0–0.3: far ahead, approaching — the sphere grows
  { p: 0.0, camX: 5, camY: 2.2, camZ: 62, spin: 0, fade: 1 },
  { p: 0.3, camX: 1.8, camY: 0.6, camZ: 17, spin: 0.6, fade: 1 },
  // 0.3–0.45: through the shell (near points fade/shrink in the shader)
  { p: 0.38, camX: 0.8, camY: 0.25, camZ: 10, spin: 0.8, fade: 1 },
  { p: 0.45, camX: 0.4, camY: 0, camZ: 6, spin: 0.95, fade: 1 },
  // 0.45–0.9: inside — dome around the viewer, inner shells + drifting field
  { p: 0.7, camX: -0.6, camY: -0.3, camZ: 1.5, spin: 1.5, fade: 1 },
  { p: 0.9, camX: -1.2, camY: -0.6, camZ: -3, spin: 2.0, fade: 1 },
  // 0.9–1: fade toward the next chapter (no fly-out)
  { p: 1.0, camX: -1.4, camY: -0.7, camZ: -4, spin: 2.2, fade: 0 },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

export function sampleKeys(p: number, out: SphereKey): SphereKey {
  const k = SPHERE_KEYS;
  const q = Math.max(k[0].p, Math.min(k[k.length - 1].p, p));
  let i = 0;
  while (i < k.length - 2 && k[i + 1].p <= q) i++;
  const a = k[i];
  const b = k[i + 1];
  const t = smooth(b.p > a.p ? (q - a.p) / (b.p - a.p) : 0);
  out.p = q;
  out.camX = a.camX + (b.camX - a.camX) * t;
  out.camY = a.camY + (b.camY - a.camY) * t;
  out.camZ = a.camZ + (b.camZ - a.camZ) * t;
  out.spin = a.spin + (b.spin - a.spin) * t;
  out.fade = a.fade + (b.fade - a.fade) * t;
  // before the chapter: fully faded in only once p ≥ 0
  if (p < 0) out.fade *= Math.max(0, 1 + p * 10);
  return out;
}
