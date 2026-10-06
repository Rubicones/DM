/**
 * RAIL GEOMETRY — wandering planner + renderer
 * --------------------------------------------
 * 1. PLAN (deterministic, seeded): a base route of axis-aligned legs that
 *    wanders across a 2D world — long sideways runs, limited climbs, turns in
 *    all four directions. For every station the planner tries many random
 *    candidates ("lead legs" + a "station leg" the card sits beside) and keeps
 *    the best one that satisfies all constraints:
 *      - legs never come closer than `railClearance` (+ curve envelopes)
 *      - legs keep `cardClearance` from every card, cards keep `cardSpacing`
 *      - min/max leg length, max upward leg, world half-width
 *    The card side (left/right/above/below) is chosen per candidate.
 *
 * 2. RENDER (one continuous pass over all legs, so chapters always connect):
 *      orthogonal → legs as-is (hard 90° corners)
 *      smooth     → corners rounded with cubic fillets (radius per chapter)
 *      sine       → filleted base + sine offset along the base NORMAL, so the
 *                   wave follows the path direction; flattens near stations
 *    Each leg carries an "envelope" (max deviation of its rendered curve from
 *    the base leg), and the planner checks clearances with envelopes included,
 *    so the rendered curves inherit the guarantees.
 *
 * Progress = arc length of the rendered polyline (`cum`), so every direction
 * moves at the same speed. Recomputed only when card sizes / layout change.
 */
import { railLayout, type Chapter, type ChapterGeometry, type RailLayoutMode, type Station } from '@/config/content';
import { themes, type PathGeometry, type ThemeId } from '@/config/themes';
import { buildLUT, sampleLUT, type RailLUT } from './lut';
import type { ScrollMap } from './scrollmap';


export type LayoutMode = 'desktop' | 'mobile';
export interface Vec2 { x: number; y: number }
export interface Size { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }
export type CardSide = 'left' | 'right' | 'above' | 'below';

export interface StationPlacement {
  id: string;
  chapterIndex: number;
  /** 1-based global station number (used in "[07] PROJECTS" labels). */
  number: number;
  /** Index of the polyline vertex the station is anchored to. */
  vertex: number;
  len: number;
  progress: number;
  anchor: Vec2;
  side: CardSide;
  rect: Rect;
  /** Camera offset that frames rider + card together. */
  frame: Vec2;
  /** Card extent along the rail — drives "passed" timing. */
  extent: number;
  /** Mobile: arc length the rider creeps through during this station's reading dwell. */
  dwellLen: number;
}

export interface ChapterPlacement {
  id: string;
  index: number;
  title: string;
  theme: ThemeId;
  startLen: number;
  startProgress: number;
  endProgress: number;
  /** Progress of the chapter's first station — where nav jumps to. */
  entryProgress: number;
  divider: Vec2 | null;
  /** Arc length of the divider label (chunk assignment). */
  dividerLen: number;
}

/** A slice of the rail (≈1–2 viewports of arc length) rendered as its own small SVG. */
export interface RailChunk {
  index: number;
  i0: number;
  i1: number;
  start: number;
  end: number;
  d: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface RailCorner extends Vec2 {
  len: number;
}

type Dir = 0 | 1 | 2 | 3; // right, down, left, up
const RIGHT: Dir = 0, DOWN: Dir = 1, LEFT: Dir = 2, UP: Dir = 3;
const DV: Vec2[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const isVert = (d: Dir) => d === DOWN || d === UP;

export type LegKind = 'lead' | 'station';
export interface PlanLeg {
  a: Vec2;
  b: Vec2;
  dir: Dir;
  chapter: number;
  kind: LegKind;
  /** Max deviation of the rendered curve from this base leg. */
  e: number;
}

export interface RailDebug {
  legs: PlanLeg[];
  cards: Rect[];
  railClearance: number;
  cardClearance: number;
  /** Stations where no candidate satisfied every constraint (best effort used). */
  fallbacks: number;
}

export interface RailGeometry {
  mode: LayoutMode;
  /** false for the tiny synchronous boot geometry (intro only). */
  complete: boolean;
  points: Vec2[];
  cum: number[];
  total: number;
  /** Arc-length lookup table (O(1) sampling in the frame loop). */
  lut: RailLUT;
  /** Scroll px ↔ arc length (linear + reading-time dwells). */
  scrollMap: ScrollMap;
  chunks: RailChunk[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Sharp corners (orthogonal chapters) — node markers + coordinates. */
  corners: RailCorner[];
  /** Normalised sine offset (−1…1) per point; 0 outside sine chapters. */
  wave: number[];
  stations: StationPlacement[];
  chapters: ChapterPlacement[];
  debug: RailDebug;
}

// ───────────────────────────────────────────── math helpers

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth01 = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const move = (p: Vec2, d: Dir, len: number): Vec2 => ({ x: p.x + DV[d].x * len, y: p.y + DV[d].y * len });
const legLen = (l: PlanLeg) => Math.abs(l.b.x - l.a.x) + Math.abs(l.b.y - l.a.y);

function pointSeg(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
const orient = (a: Vec2, b: Vec2, c: Vec2) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
function segsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
function segSeg(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  if (segsCross(a, b, c, d)) return 0;
  return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b));
}
function pointRect(p: Vec2, r: Rect) {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
function segRect(a: Vec2, b: Vec2, r: Rect) {
  const da = pointRect(a, r);
  const db = pointRect(b, r);
  if (da === 0 || db === 0) return 0;
  const c = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
  for (let i = 0; i < 4; i++) if (segsCross(a, b, c[i], c[(i + 1) % 4])) return 0;
  return Math.min(da, db, ...c.map((p) => pointSeg(p, a, b)));
}
function rectGap(r1: Rect, r2: Rect) {
  const dx = Math.max(r1.x - (r2.x + r2.w), r2.x - (r1.x + r1.w), 0);
  const dy = Math.max(r1.y - (r2.y + r2.h), r2.y - (r1.y + r1.h), 0);
  return Math.hypot(dx, dy);
}

function placeRect(anchor: Vec2, side: CardSide, size: Size, gap: number): Rect {
  switch (side) {
    case 'left':
      return { x: anchor.x - gap - size.w, y: anchor.y - size.h / 2, w: size.w, h: size.h };
    case 'right':
      return { x: anchor.x + gap, y: anchor.y - size.h / 2, w: size.w, h: size.h };
    case 'above':
      return { x: anchor.x - size.w / 2, y: anchor.y - gap - size.h, w: size.w, h: size.h };
    case 'below':
      return { x: anchor.x - size.w / 2, y: anchor.y + gap, w: size.w, h: size.h };
  }
}

/** Offset from the anchor to the centre of (anchor ∪ card) — frames both. */
function frameFor(anchor: Vec2, r: Rect): Vec2 {
  const minX = Math.min(anchor.x, r.x);
  const maxX = Math.max(anchor.x, r.x + r.w);
  const minY = Math.min(anchor.y, r.y);
  const maxY = Math.max(anchor.y, r.y + r.h);
  return { x: (minX + maxX) / 2 - anchor.x, y: (minY + maxY) / 2 - anchor.y };
}

const geometryOf = (ch: Chapter): PathGeometry => themes[ch.theme].rail.geometry;
const curvesOf = (ch: Chapter, mode: LayoutMode): ChapterGeometry => ({ ...railLayout[mode].curves, ...(ch.geometry?.[mode] ?? {}) });

function envelope(geom: PathGeometry, kind: LegKind, cp: ChapterGeometry) {
  if (geom === 'orthogonal') return 0;
  const cut = 0.3 * cp.radius; // fillet cuts the corner by ≤ (1 − 1/√2)·r
  return geom === 'sine' && kind === 'lead' ? cp.amplitude + cut + 4 : cut;
}

/** Card sizes are bucketed for planning so tiny reflows (font swap) don't reshuffle the whole rail. */
const bucket = (s: Size): Size => ({ w: Math.ceil(s.w / 8) * 8, h: Math.ceil(s.h / 32) * 32 });

// ───────────────────────────────────────────── 1. planner

interface PlannedStation {
  id: string;
  chapterIndex: number;
  legIndex: number;
  /** Anchor position along the station leg (0 = start, 0.5 = middle, 1 = end). */
  t: number;
  side: CardSide;
  rect: Rect;
  extent: number;
}

interface Candidate {
  legs: PlanLeg[];
  rect: Rect;
  side: CardSide;
  t: number;
  extent: number;
  violation: number;
  score: number;
  /** Direction changes this candidate adds. */
  turns: number;
}

interface PlanResult {
  legs: PlanLeg[];
  cards: Rect[];
  stations: PlannedStation[];
  chapterFirstLeg: number[];
  fallbacks: number;
  cps: ChapterGeometry[];
  geoms: PathGeometry[];
}

/**
 * Planner as a generator: yields after every station so the async builder can
 * time-slice it (no long tasks). `maxStations` limits planning (boot geometry).
 */
function* planRouteSteps(
  chapters: Chapter[],
  mode: LayoutMode,
  sizeOf: (id: string) => Size,
  maxStations = Infinity,
): Generator<undefined, PlanResult, void> {
  const L: RailLayoutMode = railLayout[mode];
  const W = L.wander;
  const rng = mulberry32(railLayout.seed * 2 + (mode === 'mobile' ? 1 : 0));
  const legs: PlanLeg[] = [];
  const cards: Rect[] = [];
  const stations: PlannedStation[] = [];
  const chapterFirstLeg: number[] = [];
  const cps = chapters.map((c) => curvesOf(c, mode));
  const geoms = chapters.map(geometryOf);
  let P: Vec2 = { x: 0, y: 0 };
  let dir: Dir = DOWN;
  let fallbacks = 0;

  /** Sum of constraint violations (0 = valid). Stops early once `limit` is reached. */
  const violation = (newLegs: PlanLeg[], rect: Rect, stationLeg: number, limit: number) => {
    let v = 0;
    const n = legs.length;
    for (let i = 0; i < newLegs.length; i++) {
      const l = newLegs[i];
      for (const p of [l.a, l.b]) v += Math.max(0, Math.abs(p.x) - W.halfWidth);
      const lx0 = Math.min(l.a.x, l.b.x), lx1 = Math.max(l.a.x, l.b.x);
      const ly0 = Math.min(l.a.y, l.b.y), ly1 = Math.max(l.a.y, l.b.y);
      for (let k = 0; k < n; k++) {
        if (i === 0 && k === n - 1) continue; // shared joint
        const o = legs[k];
        const need = l.e + o.e + W.railClearance;
        // cheap bbox reject
        if (Math.min(o.a.x, o.b.x) > lx1 + need || Math.max(o.a.x, o.b.x) < lx0 - need) continue;
        if (Math.min(o.a.y, o.b.y) > ly1 + need || Math.max(o.a.y, o.b.y) < ly0 - need) continue;
        const dd = segSeg(l.a, l.b, o.a, o.b);
        if (dd < need) v += need - dd;
      }
      if (v >= limit) return v;
      for (let j = 0; j < i - 1; j++) {
        const o = newLegs[j];
        const need = l.e + o.e + W.railClearance;
        const dd = segSeg(l.a, l.b, o.a, o.b);
        if (dd < need) v += need - dd;
      }
      for (const c of cards) {
        const need = l.e + W.cardClearance;
        const dd = segRect(l.a, l.b, c);
        if (dd < need) v += need - dd;
      }
      if (i !== stationLeg) {
        const need = l.e + W.cardClearance;
        const dd = segRect(l.a, l.b, rect);
        if (dd < need) v += need - dd;
      }
      if (v >= limit) return v;
    }
    v += Math.max(0, -W.halfWidth - 240 - rect.x) + Math.max(0, rect.x + rect.w - W.halfWidth - 240);
    for (const leg of legs) {
      const need = leg.e + W.cardClearance;
      const dd = segRect(leg.a, leg.b, rect);
      if (dd < need) v += need - dd;
    }
    for (const c of cards) {
      const g = rectGap(c, rect);
      if (g < W.cardSpacing) v += W.cardSpacing - g + (g === 0 ? 200 : 0);
    }
    return v;
  };

  // ── calm wandering: few, long runs; weighted turns; no zig-zag oscillation
  const dw = W.dirWeights;
  /** Weighted pick among the two perpendicular directions (never straight, never back). */
  const pickTurn = (d: Dir, p: Vec2): Dir => {
    if (isVert(d)) {
      const bias = Math.max(-0.45, Math.min(0.45, (p.x / W.halfWidth) * 0.6)); // drift back toward the centre
      const wl = dw.left * (1 + bias);
      const wr = dw.right * (1 - bias);
      return rng() * (wl + wr) < wl ? LEFT : RIGHT;
    }
    return rng() * (dw.down + dw.up) < dw.up ? UP : DOWN;
  };
  /** Next run direction: any but reverse; staying is boosted by persistence; UP never "stays". */
  const pickNext = (d: Dir, p: Vec2): Dir => {
    const bias = Math.max(-0.45, Math.min(0.45, (p.x / W.halfWidth) * 0.6));
    const base = [dw.right * (1 - bias), dw.down, dw.left * (1 + bias), dw.up];
    // staying weight is direction-neutral, so persistence doesn't turn into a downward bias
    const stay = W.persistence * 2 * Math.max(dw.left, dw.right, dw.down * 0.6);
    let sum = 0;
    const w = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      if (k === (d + 2) % 4) continue;
      w[k] = k === d ? (k === UP ? 0 : stay) : base[k];
      sum += w[k];
    }
    let r = rng() * sum;
    for (let k = 0; k < 4; k++) {
      r -= w[k];
      if (r <= 0 && w[k] > 0) return k as Dir;
    }
    return d;
  };
  const randomLen = (d: Dir, relax: number) => {
    if (d === UP) return lerp(Math.min(W.minSeg, W.upMax * 0.5), W.upMax, rng());
    // vertical runs a bit shorter than horizontal ones: long sideways journeys, no endless drop
    const max = isVert(d) ? lerp(W.minSeg, W.maxSeg, 0.55) : W.maxSeg;
    return lerp(W.minSeg, max * relax, Math.pow(rng(), 1.3));
  };

  let frontierY = 0;
  let arc = 0;
  /** Arc length at which the last run in each direction ended (oscillation guard). */
  const runEnd = [-Infinity, -Infinity, -Infinity, -Infinity];
  const turnsUsed = chapters.map(() => 0);

  const makeCandidate = (
    ci: number,
    id: string,
    last: boolean,
    chapterFirst: boolean,
    relax: number,
    nextCi: number,
    limit: number,
    budgetHard: boolean,
  ): Candidate | null => {
    const size = mode === 'mobile' ? { w: 0, h: 0 } : bucket(sizeOf(id));
    const eLead = envelope(geoms[ci], 'lead', cps[ci]);
    const eStation = envelope(geoms[ci], 'station', cps[ci]);
    // the next station's lead legs leave from this station leg's end
    const eNext = envelope(geoms[nextCi], 'lead', cps[nextCi]);

    // plan the run directions: weighted by dirWeights, the current direction
    // boosted by `persistence` (so most stations continue the run), rarely two turns
    let plan: Dir[];
    if (last) plan = dir === DOWN ? [DOWN] : dir === UP ? [pickTurn(dir, P), DOWN] : [DOWN];
    else {
      const first = pickNext(dir, P);
      plan = first !== dir && rng() < 0.1 ? [first, pickTurn(first, P)] : [first];
    }

    const stationLegLen = (sd: Dir) => {
      if (last) return W.minSeg * 0.6;
      if (mode === 'mobile') return W.minSeg * 0.5;
      const ext = isVert(sd) ? size.h : size.w;
      return Math.max(W.minSeg * 0.5, ext + 2 * (W.cardClearance + Math.max(eStation, eLead, eNext) + 8));
    };
    const newLegs: PlanLeg[] = [];
    let d = dir;
    let p = P;
    let turns = 0;
    let localArc = arc;
    for (let j = 0; j < plan.length; j++) {
      const nd = plan[j];
      if (nd !== d) {
        // no left-right-left / up-down-up within a short distance
        if (localArc - runEnd[(nd + 2) % 4] < W.oscillationGap) return null;
        turns++;
      }
      let len = nd === d ? lerp(W.minSeg * 0.4, W.maxSeg * 0.6 * relax, rng()) : randomLen(nd, relax);
      if (chapterFirst && j === 0) len = Math.max(len, W.chapterLead);
      if (nd === UP) {
        // the station leg continues the climb → leave room for it inside upMax
        const room = W.upMax - stationLegLen(nd);
        if (room < 120) return null;
        len = lerp(120, room, rng());
      }
      const b = move(p, nd, len);
      newLegs.push({ a: p, b, dir: nd, chapter: ci, kind: 'lead', e: eLead });
      localArc += len;
      p = b;
      d = nd;
    }
    if (budgetHard && turnsUsed[ci] + turns > W.maxTurnsPerChapter) return null;

    // station leg continues the last run (no extra turn)
    const sdir = d;
    const horiz = !isVert(sdir);
    const extent = horiz ? size.w : size.h;
    // leg overhangs the card by clearance + curve envelope, so the next turn can pass the card
    const slen = stationLegLen(sdir);
    if (sdir === UP) {
      const upRun = newLegs.length ? Math.abs(newLegs[newLegs.length - 1].b.y - newLegs[newLegs.length - 1].a.y) : 0;
      if (upRun + slen > W.upMax) return null;
    }
    const stationLeg: PlanLeg = { a: p, b: move(p, sdir, slen), dir: sdir, chapter: ci, kind: 'station', e: eStation };
    const all = [...newLegs, stationLeg];
    const t = last ? 1 : 0.5;
    const anchor = { x: lerp(stationLeg.a.x, stationLeg.b.x, t), y: lerp(stationLeg.a.y, stationLeg.b.y, t) };
    const sides: CardSide[] = last ? ['below'] : horiz ? ['above', 'below'] : ['left', 'right'];
    if (rng() < 0.5) sides.reverse();

    const end = stationLeg.b;
    let lateral = 0;
    for (const l of all) lateral += Math.abs(l.b.x - l.a.x);
    const overBudget = Math.max(0, turnsUsed[ci] + turns - W.maxTurnsPerChapter);
    // Direction preferences live in the candidate distribution (dirWeights,
    // persistence); the score only breaks ties randomly and keeps away from the
    // world edges, so valid candidates are picked in proportion to the weights.
    void lateral;
    const baseScore = rng() * 1000 - Math.max(0, Math.abs(end.x) / W.halfWidth - 0.7) * 1500 - overBudget * 1500;

    // stay near the frontier: never end far above the lowest point reached so far
    const floorV = Math.max(0, frontierY - W.upMax * 0.8 - end.y);
    // trap avoidance: count how many onward directions (straight, left/right turn, down)
    // still have a free run of ~1.2·minSeg from the end of this candidate
    const openness = () => {
      const probeLen = W.minSeg * 1.2;
      const dirs: Dir[] = isVert(sdir) ? [sdir, LEFT, RIGHT] : [sdir, DOWN];
      let free = 0;
      for (const pd of dirs) {
        if (pd === UP) continue;
        const a = move(end, pd, eLead + 20);
        const b = move(end, pd, probeLen);
        let ok = Math.abs(b.x) <= W.halfWidth;
        for (let k = 0; ok && k < legs.length; k++) {
          const o = legs[k];
          if (segSeg(a, b, o.a, o.b) < W.railClearance + eLead + o.e) ok = false;
        }
        for (let k = 0; ok && k < all.length - 1; k++) {
          const o = all[k];
          if (segSeg(a, b, o.a, o.b) < W.railClearance + eLead + o.e) ok = false;
        }
        if (ok) free++;
      }
      return free;
    };
    let best: Candidate | null = null;
    for (const side of sides) {
      const rect = mode === 'mobile' ? { x: anchor.x, y: anchor.y, w: 0, h: 0 } : placeRect(anchor, side, size, L.cardGap);
      const v = floorV + violation(all, rect, all.length - 1, Math.max(0, limit - floorV));
      const open = v === 0 && !last ? openness() : 2;
      const c: Candidate = { legs: all, rect, side, t, extent, violation: v, score: baseScore + rng() * 40 - (2 - Math.min(2, open)) * 700, turns };
      if (!best || v < best.violation || (v === best.violation && c.score > best.score)) best = c;
    }
    return best;
  };

  const commit = (chosen: Candidate, ci: number) => {
    let prevDir = legs.length ? legs[legs.length - 1].dir : dir;
    for (const l of chosen.legs) {
      if (l.dir !== prevDir) runEnd[prevDir] = arc;
      arc += Math.abs(l.b.x - l.a.x) + Math.abs(l.b.y - l.a.y);
      prevDir = l.dir;
      frontierY = Math.max(frontierY, l.a.y, l.b.y);
    }
    turnsUsed[ci] += chosen.turns;
  };

  outer: for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    for (let si = 0; si < ch.stations.length; si++) {
      const st = ch.stations[si];
      if (stations.length >= maxStations) break outer;
      const first = ci === 0 && si === 0;
      const last = ci === chapters.length - 1 && si === ch.stations.length - 1;

      if (first) {
        // Intro: anchor at the very start of the rail.
        const mobile = mode === 'mobile';
        const size = mobile ? { w: 0, h: 0 } : bucket(sizeOf(st.id));
        const sdir: Dir = mobile ? RIGHT : DOWN;
        const extent = mobile ? 0 : size.h;
        const slen = mobile ? W.minSeg : Math.max(W.minSeg, size.h / 2 + W.cardClearance + 40);
        const leg: PlanLeg = { a: P, b: move(P, sdir, slen), dir: sdir, chapter: 0, kind: 'station', e: envelope(geoms[0], 'station', cps[0]) };
        const side: CardSide = mobile ? 'below' : 'left';
        const rect = mobile ? { x: P.x, y: P.y, w: 0, h: 0 } : placeRect(P, side, size, L.cardGap);
        legs.push(leg);
        cards.push(rect);
        chapterFirstLeg[0] = 0;
        stations.push({ id: st.id, chapterIndex: 0, legIndex: 0, t: 0, side, rect, extent });
        arc += slen;
        frontierY = Math.max(frontierY, leg.b.y);
        P = leg.b;
        dir = sdir;
        yield;
        continue;
      }

      const chapterFirst = si === 0;
      const nextCi = si < ch.stations.length - 1 || ci === chapters.length - 1 ? ci : ci + 1;
      let chosen: Candidate | null = null;
      let fallback: Candidate | null = null;
      // [length relax, hard turn budget, candidate multiplier] — later rounds search harder
      const rounds: [number, boolean, number][] = [[1, true, 1], [1.4, true, 1], [0.8, false, 2], [2, false, 2], [0.6, false, 4], [2.6, false, 4]];
      for (const [relax, budgetHard, mult] of rounds) {
        let bestValid: Candidate | null = null;
        let valid = 0;
        for (let a = 0; a < W.candidates * mult; a++) {
          const c = makeCandidate(ci, st.id, last, chapterFirst, relax, nextCi, fallback ? fallback.violation : Infinity, budgetHard);
          if (!c) continue;
          if (c.violation === 0) {
            valid++;
            if (!bestValid || c.score > bestValid.score) bestValid = c;
            if (valid >= 14) break;
          } else if (!fallback || c.violation < fallback.violation) {
            fallback = c;
          }
        }
        if (bestValid) {
          chosen = bestValid;
          break;
        }
      }
      if (!chosen) {
        fallbacks++;
        if (process.env.NODE_ENV !== 'production') console.warn(`[rail] no clean fit for ${st.id} (violation ${fallback?.violation.toFixed(0)})`);
        chosen = fallback!;
      }

      if (chapterFirst) chapterFirstLeg[ci] = legs.length;
      commit(chosen, ci);
      legs.push(...chosen.legs);
      cards.push(chosen.rect);
      stations.push({ id: st.id, chapterIndex: ci, legIndex: legs.length - 1, t: chosen.t, side: chosen.side, rect: chosen.rect, extent: chosen.extent });
      const lastLeg = legs[legs.length - 1];
      P = lastLeg.b;
      dir = lastLeg.dir;
      yield;
    }
  }

  return { legs, cards, stations, chapterFirstLeg, fallbacks, cps, geoms };
}

// ───────────────────────────────────────────── 2. renderer

interface BaseSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  s: number;
  on: boolean;
  A: number;
  lam: number;
  wobble: boolean;
}

const K = 0.5523; // cubic Bézier quarter-circle constant

/** Synchronous build (tests, boot geometry). `maxStations` plans only the first N stations. */
export function buildRail(
  chapters: Chapter[],
  mode: LayoutMode,
  sizeOf: (id: string) => Size,
  maxStations = Infinity,
): RailGeometry {
  const gen = planRouteSteps(chapters, mode, sizeOf, maxStations);
  let r = gen.next();
  while (!r.done) r = gen.next();
  return renderRail(chapters, mode, r.value, maxStations === Infinity);
}

const yieldToMain = (): Promise<void> => {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(0);
  });
};

/**
 * Time-sliced build: plans station by station, yielding to the main thread
 * whenever a slice exceeds `sliceMs`, so geometry rebuilds never create long
 * tasks. Returns null if `cancelled()` turns true meanwhile.
 */
export async function buildRailAsync(
  chapters: Chapter[],
  mode: LayoutMode,
  sizeOf: (id: string) => Size,
  cancelled: () => boolean,
  sliceMs = 8,
): Promise<RailGeometry | null> {
  const gen = planRouteSteps(chapters, mode, sizeOf, Infinity);
  let sliceStart = performance.now();
  let r = gen.next();
  while (!r.done) {
    if (performance.now() - sliceStart > sliceMs) {
      await yieldToMain();
      if (cancelled()) return null;
      sliceStart = performance.now();
    }
    r = gen.next();
  }
  await yieldToMain();
  if (cancelled()) return null;
  return renderRail(chapters, mode, r.value, true);
}

function renderRail(chapters: Chapter[], mode: LayoutMode, plan: PlanResult, complete: boolean): RailGeometry {
  /** World zoom: everything below is emitted in scaled px (mobile < 1). */
  const S = railLayout[mode].worldScale;
  const scaleRect = (r: Rect): Rect => ({ x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S });
  const L = railLayout[mode];
  const { legs, cps, geoms } = plan;
  const n = legs.length;
  const V: Vec2[] = [legs[0].a, ...legs.map((l) => l.b)];

  // fillet radius per corner k (between leg k−1 and leg k)
  const r: number[] = new Array(n + 1).fill(0);
  for (let k = 1; k < n; k++) {
    const A = legs[k - 1];
    const B = legs[k];
    if (A.dir === B.dir) continue;
    const gA = geoms[A.chapter];
    const gB = geoms[B.chapter];
    if (gA === 'orthogonal' && gB === 'orthogonal') continue;
    const R = gB !== 'orthogonal' ? cps[B.chapter].radius : cps[A.chapter].radius;
    r[k] = Math.max(0, Math.min(R, legLen(A) / 2 - 1, legLen(B) / 2 - 1));
  }

  const base: BaseSample[] = [];
  const pushBase = (x: number, y: number, tx: number, ty: number, on: boolean, A: number, lam: number, wobble: boolean) => {
    const prev = base[base.length - 1];
    if (prev && Math.abs(prev.x - x) < 1e-6 && Math.abs(prev.y - y) < 1e-6) {
      prev.on = prev.on || on;
      return base.length - 1;
    }
    const s = prev ? prev.s + Math.hypot(x - prev.x, y - prev.y) : 0;
    base.push({ x, y, tx, ty, s, on, A, lam, wobble });
    return base.length - 1;
  };

  const stationAt = new Map<number, { t: number; idx: number }>();
  plan.stations.forEach((s) => stationAt.set(s.legIndex, { t: s.t, idx: -1 }));
  const chapterFirstLegSet = new Map<number, number>(); // legIndex → chapter
  plan.chapterFirstLeg.forEach((li, ci) => chapterFirstLegSet.set(li, ci));
  const chapterStartBase: number[] = [0];
  const dividerBase: (number | null)[] = chapters.map(() => null);
  const filletMid: number[] = [];
  const sharpCornerBase: number[] = [];

  for (let k = 0; k < n; k++) {
    const l = legs[k];
    const d = DV[l.dir];
    const len = legLen(l);
    const r0 = r[k];
    const r1 = k < n - 1 ? r[k + 1] : 0;
    const geom = geoms[l.chapter];
    const cp = cps[l.chapter];
    const sineOn = geom === 'sine' && l.kind === 'lead';
    const wobble = themes[chapters[l.chapter].theme].rail.sketch;
    const sA = { x: l.a.x + d.x * r0, y: l.a.y + d.y * r0 };
    const straight = len - r0 - r1;

    if (k === 0) pushBase(sA.x, sA.y, d.x, d.y, sineOn, cp.amplitude, cp.wavelength, wobble);
    else {
      if (r0 === 0 && geoms[legs[k - 1].chapter] === 'orthogonal' && geom === 'orthogonal' && legs[k - 1].dir !== l.dir) sharpCornerBase.push(base.length - 1);
      const ci = chapterFirstLegSet.get(k);
      if (ci !== undefined && ci > 0) chapterStartBase[ci] = r0 > 0 ? filletMid[k] : base.length - 1;
    }

    // sample distances along the straight part
    const dense = sineOn || wobble;
    const step = dense ? Math.min(14, cp.wavelength / 28) : Infinity;
    const us: number[] = [];
    for (let u = step; u < straight - 0.5; u += step) us.push(u);
    us.push(straight);
    const st = stationAt.get(k);
    const anchorU = st ? len * st.t - r0 : -1;
    if (st && anchorU > 0.5) us.push(anchorU);
    const divCh = chapterFirstLegSet.get(k);
    const divU = divCh !== undefined && divCh > 0 ? len / 2 - r0 : -1;
    if (divU > 0) us.push(divU);
    us.sort((a, b) => a - b);

    if (st && anchorU <= 0.5) st.idx = base.length - 1;
    for (const u of us) {
      const idx = pushBase(sA.x + d.x * u, sA.y + d.y * u, d.x, d.y, sineOn, cp.amplitude, cp.wavelength, wobble);
      if (st && Math.abs(u - anchorU) < 1e-6) st.idx = idx;
      if (divCh !== undefined && Math.abs(u - divU) < 1e-6) dividerBase[divCh] = idx;
    }

    // fillet into the next leg
    if (k < n - 1 && r1 > 0) {
      const C = V[k + 1];
      const nx = legs[k + 1];
      const d2 = DV[nx.dir];
      const P0 = { x: C.x - d.x * r1, y: C.y - d.y * r1 };
      const P1 = { x: P0.x + d.x * K * r1, y: P0.y + d.y * K * r1 };
      const P3 = { x: C.x + d2.x * r1, y: C.y + d2.y * r1 };
      const P2 = { x: P3.x - d2.x * K * r1, y: P3.y - d2.y * K * r1 };
      const nextGeom = geoms[nx.chapter];
      const on = sineOn && nextGeom === 'sine' && nx.kind === 'lead' && nx.chapter === l.chapter;
      const m = 12;
      for (let i = 1; i <= m; i++) {
        const t = i / m;
        const mt = 1 - t;
        const x = mt * mt * mt * P0.x + 3 * mt * mt * t * P1.x + 3 * mt * t * t * P2.x + t * t * t * P3.x;
        const y = mt * mt * mt * P0.y + 3 * mt * mt * t * P1.y + 3 * mt * t * t * P2.y + t * t * t * P3.y;
        let tx = 3 * mt * mt * (P1.x - P0.x) + 6 * mt * t * (P2.x - P1.x) + 3 * t * t * (P3.x - P2.x);
        let ty = 3 * mt * mt * (P1.y - P0.y) + 6 * mt * t * (P2.y - P1.y) + 3 * t * t * (P3.y - P2.y);
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const idx = pushBase(x, y, tx, ty, on, cp.amplitude, cp.wavelength, wobble);
        if (i === m / 2) filletMid[k + 1] = idx;
      }
    }
  }

  // sine envelope: contiguous runs of `on` samples, eased in/out over λ/4
  const env = new Float64Array(base.length);
  const runStart = new Float64Array(base.length);
  for (let i = 0; i < base.length; ) {
    if (!base[i].on) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < base.length && base[j + 1].on) j++;
    const s0 = base[i].s;
    const s1 = base[j].s;
    for (let q = i; q <= j; q++) {
      env[q] = smooth01(Math.min(base[q].s - s0, s1 - base[q].s) / (base[q].lam / 4));
      runStart[q] = s0;
    }
    i = j + 1;
  }

  // offset along the normal → final polyline
  const points: Vec2[] = [];
  const wave: number[] = [];
  const toFinal = new Int32Array(base.length);
  for (let i = 0; i < base.length; i++) {
    const b = base[i];
    const nx = -b.ty;
    const ny = b.tx;
    const w = env[i] ? env[i] * Math.sin((2 * Math.PI * (b.s - runStart[i])) / b.lam) : 0;
    // marker wobble is specified in screen px → divide by the world zoom
    const wob = b.wobble ? (1.8 * Math.sin(b.s * 0.045 + 1.3) + 1.1 * Math.sin(b.s * 0.13 + 0.4)) / S : 0;
    const off = b.A * w + wob;
    const p = { x: (b.x + nx * off) * S, y: (b.y + ny * off) * S };
    const prev = points[points.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 1e-6 && Math.abs(prev.y - p.y) < 1e-6) {
      toFinal[i] = points.length - 1;
      continue;
    }
    points.push(p);
    wave.push(w);
    toFinal[i] = points.length - 1;
  }

  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = Math.max(1, cum[cum.length - 1]);

  let number = 0;
  const stations: StationPlacement[] = plan.stations.map((s) => {
    const baseIdx = stationAt.get(s.legIndex)!.idx;
    const vertex = toFinal[Math.max(0, baseIdx)];
    const anchor = points[vertex];
    return {
      id: s.id,
      chapterIndex: s.chapterIndex,
      number: ++number,
      vertex,
      len: cum[vertex],
      progress: cum[vertex] / total,
      anchor,
      side: s.side,
      rect: scaleRect(s.rect),
      frame: frameFor(anchor, scaleRect(s.rect)),
      dwellLen: 0,
      extent: s.extent * S,
    };
  });

  const startLens = chapters.map((_, ci) => cum[toFinal[chapterStartBase[ci] ?? 0]]);
  const chapterPlacements: ChapterPlacement[] = chapters.map((ch, i) => {
    const startLen = startLens[i];
    const nextStart = i < chapters.length - 1 ? startLens[i + 1] : total;
    const firstStation = stations.find((s) => s.chapterIndex === i);
    const db = dividerBase[i];
    const dv = db !== null ? toFinal[db] : -1;
    return {
      id: ch.id,
      index: i,
      title: ch.title,
      theme: ch.theme,
      startLen,
      startProgress: startLen / total,
      endProgress: nextStart / total,
      entryProgress: firstStation ? firstStation.progress : startLen / total,
      divider: dv >= 0 ? points[dv] : null,
      dividerLen: dv >= 0 ? cum[dv] : -1,
    };
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // chunks: vertex-aligned slices of ~chunkLength arc length (each shares its end vertex with the next)
  const f = (v: number) => Math.round(v * 10) / 10;
  const chunks: RailChunk[] = [];
  let c0 = 0;
  for (let i = 1; i < points.length; i++) {
    const lastPoint = i === points.length - 1;
    if (cum[i] - cum[c0] >= L.chunkLength || lastPoint) {
      let parts = '';
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let q = c0; q <= i; q++) {
        const p = points[q];
        parts += `${q === c0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`;
        if (p.x < bx0) bx0 = p.x;
        if (p.y < by0) by0 = p.y;
        if (p.x > bx1) bx1 = p.x;
        if (p.y > by1) by1 = p.y;
      }
      chunks.push({ index: chunks.length, i0: c0, i1: i, start: cum[c0], end: cum[i], d: parts, bbox: { minX: bx0, minY: by0, maxX: bx1, maxY: by1 } });
      c0 = i;
    }
  }

  const corners: RailCorner[] = sharpCornerBase.map((b) => {
    const fi = toFinal[b];
    return { x: points[fi].x, y: points[fi].y, len: cum[fi] };
  });

  const lut = buildLUT(
    points.map((p) => p.x),
    points.map((p) => p.y),
    cum,
    wave,
  );

  return {
    mode,
    complete,
    points,
    cum,
    total,
    lut,
    scrollMap: buildScrollMap(chapters, mode, stations, total),
    chunks,
    bounds: { minX, minY, maxX, maxY },
    corners,
    wave,
    stations,
    chapters: chapterPlacements,
    debug: {
      legs: S === 1 ? legs : legs.map((l) => ({ ...l, a: { x: l.a.x * S, y: l.a.y * S }, b: { x: l.b.x * S, y: l.b.y * S }, e: l.e * S })),
      cards: plan.cards.map(scaleRect),
      railClearance: L.wander.railClearance * S,
      cardClearance: L.wander.cardClearance * S,
      fallbacks: plan.fallbacks,
    },
  };
}

// ───────────────────────────────────────────── 3. scroll map (reading time)

/** Characters of readable text in a station — drives the default dwell. */
export function stationTextLength(st: Station): number {
  switch (st.kind) {
    case 'intro':
      return st.eyebrow.length + st.name.length + st.role.join(' ').length + st.tagline.length;
    case 'text':
      return st.title.length + st.paragraphs.join(' ').length;
    case 'list':
      return st.title.length + st.items.reduce((a, i) => a + i.title.length + i.text.length, 0);
    case 'project':
      return st.title.length + st.type.length + st.description.length + st.stack.join(' ').length;
    case 'stack':
      return st.title.length + st.groups.reduce((a, g) => a + g.label.length + g.items.join(' ').length, 0);
    case 'principle':
      return st.title.length + st.text.length;
    case 'feature':
      return st.title.length + st.text.length + (st.tags?.join(' ').length ?? 0) + (st.skills?.reduce((a, k) => a + k.name.length + k.projects.length * 14, 0) ?? 0);
    case 'contact':
      return st.title.length + st.subtitle.length + st.links.reduce((a, l) => a + l.label.length + l.value.length, 0);
  }
}

/** Knots per brake / release ramp (piecewise-linear approximation of the eased curve). */
const RAMP_KNOTS = 8;

/**
 * Piecewise-linear scroll ↔ arc-length map. Strictly monotonic → invertible.
 *
 *   cruise ── brake ──▶ station ── dwell ── release ── cruise …
 *
 * cruise:  `scrollPerPx` scroll px per rail px
 * brake:   over `stop.brake` scroll px the rider's speed eases (smoothstep)
 *          from cruise down to the station creep — it "amortises" into the stop
 * dwell:   (mobile) D scroll px advance the rider only `creep·D` rail px —
 *          reading time without ever freezing the rider
 * release: the mirror of the brake, back up to cruise speed
 * Ramps shrink to fit when stations are close together.
 */
function buildScrollMap(chapters: Chapter[], mode: LayoutMode, stations: StationPlacement[], total: number): ScrollMap {
  const L = railLayout[mode];
  const dw = L.dwell;
  const stop = L.stop;
  const v0 = 1 / L.scrollPerPx; // rail px per scroll px while cruising
  const vd = Math.min(v0, dw.enabled ? dw.creep : stop.creep); // …at the station
  const avg = (v0 + vd) / 2; // mean speed over a ramp
  const byId = new Map<string, Station>();
  for (const ch of chapters) for (const st of ch.stations) byId.set(st.id, st);
  const ks: number[] = [0];
  const kl: number[] = [0];
  const stops: number[] = [];
  let S = 0;
  let l = 0;
  const knot = () => {
    ks.push(S);
    kl.push(l);
  };
  const cruiseTo = (target: number) => {
    if (target <= l) return;
    S += (target - l) * L.scrollPerPx;
    l = target;
    knot();
  };
  /** Scroll px of a ramp limited to `room` rail px. */
  const fit = (scroll: number, room: number) => (scroll > 0 && room > 0 && v0 > vd ? Math.min(scroll, room / avg) : 0);
  /** Eased ramp over `scroll` px; speed(u) = vd + (v0 − vd)·(1 − smoothstep(u)) when braking, mirrored when releasing. */
  const ramp = (scroll: number, release: boolean) => {
    const S0 = S;
    const l0 = l;
    for (let k = 1; k <= RAMP_KNOTS; k++) {
      const u = k / RAMP_KNOTS;
      const g = u * u * u - (u * u * u * u) / 2; // ∫₀ᵘ smoothstep
      const cover = release ? vd * u + (v0 - vd) * g : v0 * u - (v0 - vd) * g;
      S = S0 + scroll * u;
      l = l0 + scroll * cover;
      knot();
    }
  };

  stations.forEach((st, i) => {
    // ── approach: cruise, then brake so the rider arrives exactly at the marker
    const brake = fit(stop.brake, (st.len - l) * 0.45);
    cruiseTo(st.len - brake * avg);
    if (brake > 0) {
      ramp(brake, false);
      kl[kl.length - 1] = l = st.len; // float drift → land exactly on the station
    } else cruiseTo(st.len);
    stops.push(S);

    const isLast = i === stations.length - 1;
    if (isLast) return;
    const next = stations[i + 1].len;
    // ── reading dwell (mobile)
    const cfg = byId.get(st.id);
    if (dw.enabled && cfg) {
      const D = cfg.dwell ?? Math.max(dw.min, Math.min(dw.max, dw.base + dw.perChar * stationTextLength(cfg)));
      if (D > 0) {
        const delta = Math.max(0.5, Math.min(D * dw.creep, (next - l) * 0.4));
        S += D;
        l += delta;
        st.dwellLen = delta;
        knot();
      }
    }
    // ── pull away
    const release = fit(stop.release, (next - l) * 0.35);
    if (release > 0) ramp(release, true);
  });
  cruiseTo(total);
  return { s: Float64Array.from(ks), l: Float64Array.from(kl), total: Math.max(1, S), stops };
}

const tmpSample = { x: 0, y: 0, tx: 0, ty: 0, wave: 0 };

/** Point at a given distance along the rail (O(1) via the LUT). Writes into `out`. */
export function pointAt(g: RailGeometry, len: number, out: Vec2): Vec2 {
  sampleLUT(g.lut, len, tmpSample);
  out.x = tmpSample.x;
  out.y = tmpSample.y;
  return out;
}

/** Normalised sine offset at a distance along the rail (0 outside sine chapters). */
export function waveAt(g: RailGeometry, len: number): number {
  return sampleLUT(g.lut, len, tmpSample).wave;
}
