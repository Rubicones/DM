/**
 * Pre-baked hand-drawn geometry (replaces live SVG displacement filters).
 * Seeded jitter → plain path strings, generated once and cached by key.
 */
const cache = new Map<string, string>();

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (v: number) => Math.round(v * 100) / 100;

function memo(key: string, make: () => string) {
  let v = cache.get(key);
  if (v === undefined) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

/**
 * Jittered rectangle in a 0…100 box (use with preserveAspectRatio="none" +
 * vector-effect: non-scaling-stroke). Slight overshoot at the closing corner,
 * like a marker line drawn in one go.
 */
export function roughRect(seed: number, perEdge: number, amp = 0.55): string {
  return memo(`rect|${seed}|${perEdge}|${amp}`, () => {
    const r = rng(seed);
    const pts: [number, number][] = [];
    const edge = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i < perEdge; i++) {
        const t = i / perEdge;
        const nx = -(y1 - y0);
        const ny = x1 - x0;
        const nl = Math.hypot(nx, ny) || 1;
        const j = (r() - 0.5) * 2 * amp;
        pts.push([x0 + (x1 - x0) * t + (nx / nl) * j, y0 + (y1 - y0) * t + (ny / nl) * j]);
      }
    };
    edge(0, 0, 100, 0);
    edge(100, 0, 100, 100);
    edge(100, 100, 0, 100);
    edge(0, 100, 0, 0);
    pts.push([pts[0][0] + 1.2, pts[0][1] + (r() - 0.5) * amp]);
    return pts.map((p, i) => `${i ? 'L' : 'M'}${r2(p[0])} ${r2(p[1])}`).join('');
  });
}

/** Jittered box in absolute coordinates (bars in figures). */
export function roughBox(x: number, y: number, w: number, h: number, seed: number, amp = 1.6): string {
  return memo(`box|${x}|${y}|${w}|${h}|${seed}|${amp}`, () => {
    const r = rng(seed);
    const j = () => (r() - 0.5) * 2 * amp;
    const c = [
      [x + j(), y + j()],
      [x + w + j(), y + j()],
      [x + w + j(), y + h + j()],
      [x + j(), y + h + j()],
    ];
    const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2 + j() * 0.6, (a[1] + b[1]) / 2 + j() * 0.6];
    const pts = [c[0], mid(c[0], c[1]), c[1], mid(c[1], c[2]), c[2], mid(c[2], c[3]), c[3], mid(c[3], c[0])];
    return pts.map((p, i) => `${i ? 'L' : 'M'}${r2(p[0])} ${r2(p[1])}`).join('') + 'Z';
  });
}

/** Wobbly circle (knobs). */
export function roughCircle(cx: number, cy: number, rad: number, seed: number, amp = 1.4, n = 18): string {
  return memo(`circ|${cx}|${cy}|${rad}|${seed}|${amp}|${n}`, () => {
    const r = rng(seed);
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const rr = rad + (r() - 0.5) * 2 * amp + (i === n ? 1.2 : 0);
      pts.push(`${i ? 'L' : 'M'}${r2(cx + Math.cos(a) * rr)} ${r2(cy + Math.sin(a) * rr)}`);
    }
    return pts.join('');
  });
}
