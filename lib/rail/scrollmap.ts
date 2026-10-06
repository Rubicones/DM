/**
 * Scroll px ↔ rail arc length (monotonic knots). Lookups walk from a cached
 * knot index, so per-frame cost is O(1) and allocation-free.
 */
export interface ScrollMap {
  /** Scroll px at each knot. */
  s: Float64Array;
  /** Arc length at each knot. */
  l: Float64Array;
  /** Total scroll distance. */
  total: number;
  /** Scroll px at which the rider arrives at each station (scroll-snap points). */
  stops: number[];
}

let hintS = 0;
let hintL = 0;

export function scrollToLen(m: ScrollMap, px: number): number {
  const s = m.s;
  const n = s.length;
  if (n < 2) return 0;
  if (px <= 0) return m.l[0];
  if (px >= s[n - 1]) return m.l[n - 1];
  let i = Math.min(hintS, n - 2);
  while (i > 0 && s[i] > px) i--;
  while (i < n - 2 && s[i + 1] < px) i++;
  hintS = i;
  const t = (px - s[i]) / Math.max(1e-9, s[i + 1] - s[i]);
  return m.l[i] + (m.l[i + 1] - m.l[i]) * t;
}

export function lenToScroll(m: ScrollMap, len: number): number {
  const l = m.l;
  const n = l.length;
  if (n < 2) return 0;
  if (len <= 0) return 0;
  if (len >= l[n - 1]) return m.s[n - 1];
  let i = Math.min(hintL, n - 2);
  while (i > 0 && l[i] > len) i--;
  while (i < n - 2 && l[i + 1] < len) i++;
  hintL = i;
  const t = (len - l[i]) / Math.max(1e-9, l[i + 1] - l[i]);
  return m.s[i] + (m.s[i + 1] - m.s[i]) * t;
}
