/**
 * ARC-LENGTH LUT — the rail resampled every `step` px of arc length.
 * Lookup is O(1): index = floor(len / step), then lerp. No search, no DOM,
 * no allocation (writes into a caller-owned object).
 */
export interface RailLUT {
  step: number;
  /** Number of entries (last entry sits exactly at `total`). */
  n: number;
  total: number;
  x: Float32Array;
  y: Float32Array;
  /** Unit tangent of the polyline at each entry. */
  tx: Float32Array;
  ty: Float32Array;
  /** Normalised sine offset (−1…1), 0 outside sine chapters. */
  wave: Float32Array;
}

export interface LutSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  wave: number;
}

export function buildLUT(px: ArrayLike<number>, py: ArrayLike<number>, cum: ArrayLike<number>, wave: ArrayLike<number>, step = 3): RailLUT {
  const count = cum.length;
  const total = count ? cum[count - 1] : 0;
  const n = Math.max(2, Math.ceil(total / step) + 1);
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const tx = new Float32Array(n);
  const ty = new Float32Array(n);
  const w = new Float32Array(n);
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.min(total, i * step);
    while (seg < count - 2 && cum[seg + 1] < s) seg++;
    const a = seg;
    const b = Math.min(count - 1, seg + 1);
    const l = cum[b] - cum[a];
    const t = l > 0 ? (s - cum[a]) / l : 0;
    x[i] = px[a] + (px[b] - px[a]) * t;
    y[i] = py[a] + (py[b] - py[a]) * t;
    const dx = px[b] - px[a];
    const dy = py[b] - py[a];
    const dl = Math.hypot(dx, dy) || 1;
    tx[i] = dx / dl;
    ty[i] = dy / dl;
    w[i] = wave[a] + (wave[b] - wave[a]) * t;
  }
  return { step, n, total, x, y, tx, ty, wave: w };
}

export function sampleLUT(lut: RailLUT, len: number, out: LutSample): LutSample {
  const f = len <= 0 ? 0 : len >= lut.total ? lut.n - 1 : len / lut.step;
  const i = Math.min(lut.n - 2, f | 0);
  const t = Math.min(1, f - i);
  const j = i + 1;
  out.x = lut.x[i] + (lut.x[j] - lut.x[i]) * t;
  out.y = lut.y[i] + (lut.y[j] - lut.y[i]) * t;
  out.tx = t < 0.5 ? lut.tx[i] : lut.tx[j];
  out.ty = t < 0.5 ? lut.ty[i] : lut.ty[j];
  out.wave = lut.wave[i] + (lut.wave[j] - lut.wave[i]) * t;
  return out;
}
