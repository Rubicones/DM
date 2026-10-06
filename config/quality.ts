/**
 * QUALITY TIERS — the single place that decides how much work each device does.
 * Detection: lib/quality/detect.ts. Runtime downgrade: RailEngine (frame monitor).
 * Force a tier for testing with ?tier=high|medium|low|fallback
 */
export type Tier = 'high' | 'medium' | 'low' | 'fallback';
export const TIERS: Tier[] = ['fallback', 'low', 'medium', 'high'];

export interface QualityPreset {
  /** WebGL canvas device-pixel-ratio cap. */
  dprMax: number;
  /** …on the mobile layout (phones: 3× screens, weaker GPUs, the canvas is full-screen). */
  mobileDprMax: number;
  /** Fraction of the sphere's point counts. */
  pointsFactor: number;
  /** Idle drift of the 3D scene when the rider is still (fps). 0 = render only on scroll. */
  idleFps: number;
  /** …on the mobile layout. */
  mobileIdleFps: number;
  /** Interpolate shadows/glows/blurs across transition zones (else switch at the midpoint). */
  interpolateExpensive: boolean;
  /** Quantisation of theme blending inside a transition zone (distinct steps). */
  themeSteps: number;
  /** Vertices per edge of hand-drawn outlines. */
  sketchDetail: number;
  /** HUD coordinate/frequency readout refresh rate while moving (Hz). */
  readoutHz: number;
  /** false → static SVG sphere, no canvas. */
  webgl: boolean;
}

export const QUALITY: Record<Tier, QualityPreset> = {
  high: { dprMax: 2, mobileDprMax: 1.5, pointsFactor: 1, idleFps: 60, mobileIdleFps: 30, interpolateExpensive: true, themeSteps: 64, sketchDetail: 10, readoutHz: 30, webgl: true },
  medium: { dprMax: 1.5, mobileDprMax: 1.15, pointsFactor: 0.5, idleFps: 30, mobileIdleFps: 15, interpolateExpensive: false, themeSteps: 32, sketchDetail: 8, readoutHz: 20, webgl: true },
  low: { dprMax: 1, mobileDprMax: 0.85, pointsFactor: 0.25, idleFps: 0, mobileIdleFps: 0, interpolateExpensive: false, themeSteps: 16, sketchDetail: 5, readoutHz: 12, webgl: true },
  fallback: { dprMax: 1, mobileDprMax: 1, pointsFactor: 0, idleFps: 0, mobileIdleFps: 0, interpolateExpensive: false, themeSteps: 16, sketchDetail: 5, readoutHz: 12, webgl: false },
};

/** Runtime monitor: step down after `downgradeAfterMs` over budget, up after `upgradeAfterMs` comfortably under. */
export const PERF_BUDGET = {
  /** Average frame interval considered "over budget" (ms). */
  frameMs: 19,
  /** "Comfortable" average for stepping back up (ms). */
  comfortableMs: 13,
  downgradeAfterMs: 2000,
  /** Touch devices step down sooner (the 3D scene lowers its own resolution first). */
  touchDowngradeAfterMs: 1200,
  upgradeAfterMs: 20000,
  /** After this many switches the tier locks to the lower one (no oscillation). */
  maxSwitches: 3,
};

/** Perf overlay & timers are compiled in only in dev, or with NEXT_PUBLIC_PERF=1. */
export const PERF_ALLOWED = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_PERF === '1';
