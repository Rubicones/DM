/**
 * RAIL ENGINE — the site's single ticker.
 * ---------------------------------------
 * Exactly one rAF loop. Scroll / resize listeners only store values. Each
 * frame runs subsystems in a fixed order:
 *
 *   progress → camera → rail (chunks) → stations → theme → 3D → sound
 *
 * Zero React state per frame, zero allocations in the hot path (reused
 * objects, cached blend frames, O(1) LUT sampling). The loop sleeps when
 * everything has settled and no subsystem asked for another frame.
 */
import { chapters as chapterConfig, mobileLayout, railLayout } from '@/config/content';
import { PERF_ALLOWED, PERF_BUDGET } from '@/config/quality';
import { THEME_IDS, TEXTURES, themes, type ThemeId } from '@/config/themes';
import { quality } from '@/lib/quality/store';
import { blendFrame } from '@/lib/theme/tokens';
import type { PerfMonitor } from '@/lib/perf/monitor';
import { clamp, coord, pad, smoothstep } from './format';
import type { CardSide, RailGeometry, Vec2 } from './geometry';
import { sampleLUT, type LutSample } from './lut';
import { lenToScroll, scrollToLen } from './scrollmap';

interface ChunkDom {
  svg: SVGSVGElement;
  done: SVGGElement | null;
  mask: SVGPathElement | null;
}

export interface EngineDom {
  stage: HTMLElement | null;
  world: HTMLElement | null;
  texture: HTMLElement | null;
  veil: HTMLElement | null;
  rider: HTMLElement | null;
  hudChapter: HTMLElement | null;
  hudPct: HTMLElement | null;
  hudReadout: HTMLElement | null;
  perf: HTMLElement | null;
  stations: Map<string, HTMLElement>;
  /** Mobile: station markers on the rail. */
  markers: Map<string, HTMLElement>;
  nav: Map<string, HTMLElement>;
  chunks: Map<number, ChunkDom>;
  textures: Map<string, HTMLElement>;
  decos: Map<string, HTMLElement>;
}

type SingleKey = 'stage' | 'world' | 'texture' | 'veil' | 'rider' | 'hudChapter' | 'hudPct' | 'hudReadout' | 'perf';

/** Shared per-frame state handed to frame listeners (sound). Reused object. */
export interface FrameState {
  progress: number;
  /** Rider position along the rail, px of arc length. */
  len: number;
  /** Signed rider speed along the rail, px/s. */
  velocity: number;
  /** Frame duration, s. */
  dt: number;
  x: number;
  y: number;
  chapterIndex: number;
  /** −1…1 position across the sine wave when inside a sine chapter, else null. */
  wave: number | null;
}

/** A per-frame subscriber (3D scene). Return true to request another frame. */
export type SceneTicker = (now: number, dt: number) => boolean;

type StationState = 'hidden' | 'active' | 'passed';
type Listener<T> = (v: T) => void;

const PROGRESS_LERP = 0.14;
const CAMERA_LERP = 0.16;
/** All textures share this cell size so the camera offset modulo works for each. */
export const TEXTURE_CELL = 44;
/** Scene stays mounted this far (progress) before its chapter, to preload + compile shaders. */
const SCENE_PRELOAD = 0.1;
const S_PROGRESS = 0, S_CAMERA = 1, S_RAIL = 2, S_STATIONS = 3, S_THEME = 4, S_3D = 5, S_SOUND = 6;

interface Boundary { at: number; from: ThemeId; to: ThemeId }
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export class RailEngine {
  private geo: RailGeometry | null = null;

  readonly dom: EngineDom = {
    stage: null,
    world: null,
    texture: null,
    veil: null,
    rider: null,
    hudChapter: null,
    hudPct: null,
    hudReadout: null,
    perf: null,
    stations: new Map(),
    markers: new Map(),
    nav: new Map(),
    chunks: new Map(),
    textures: new Map(),
    decos: new Map(),
  };
  private readonly refCache = new Map<string, (el: never) => void>();

  // progress
  private rawTarget = 0;
  private target = 0;
  private current = 0;
  private spikeHeld = false;
  private lastAcceptedDir = 0;
  private dirty = true;

  // camera
  private readonly cam: Vec2 = { x: 0, y: 0 };
  private camReady = false;
  private readonly s: LutSample = { x: 0, y: 0, tx: 0, ty: 0, wave: 0 };
  private readonly sa: LutSample = { x: 0, y: 0, tx: 0, ty: 0, wave: 0 };
  private readonly sb: LutSample = { x: 0, y: 0, tx: 0, ty: 0, wave: 0 };
  private readonly look: Vec2 = { x: 0, y: 0 };
  private wx = 0;
  private wy = 0;

  private vw = 1;
  private vh = 1;
  private lastWidth = 0;
  private scrollLength = 1;
  private raf = 0;
  private lastT = 0;
  private running = false;

  // stations / chapters / HUD
  private stationStates: StationState[] = [];
  private framingIdx = 0;
  private chapterIdx = -1;
  private riderSide: CardSide | '' = '';
  private lastPct = -1;
  private lastReadout = '';
  private lastReadoutAt = 0;

  // rail chunks
  private chunkVisible = new Int8Array(0);
  private chunkState = new Int8Array(0);
  private curChunk = -1;
  private lastMask = -1;
  private chunksVisibleCount = 0;

  // theme blending
  private boundaries: Boundary[] = [];
  private blendKey = '';
  private readonly varCache = new Map<string, string>();
  private readout = 'coords';
  private dominantTheme = '';
  private lastVeil = -1;
  private readonly weights: Record<string, number> = {};
  private readonly layerShown = new Map<string, boolean>();

  // listeners
  private readonly frameListeners: Listener<FrameState>[] = [];
  private readonly frame: FrameState = { progress: 0, len: 0, velocity: 0, dt: 0, x: 0, y: 0, chapterIndex: 0, wave: null };
  private lastLen = 0;
  private readonly sceneTickers: SceneTicker[] = [];
  private readonly sceneListeners = new Map<string, Set<Listener<boolean>>>();
  private readonly sceneActive = new Map<string, boolean>();
  private readonly chapterListeners: Listener<number>[] = [];
  private sceneInfo: (() => string) | null = null;

  // quality monitor
  private frameEma = 16.7;
  private workEma = 2;
  private overMs = 0;
  private comfyMs = 0;
  private startedAt = 0;

  // perf overlay
  private perf: PerfMonitor | null = null;
  private perfOn = false;
  private readonly skipped = new Set<string>();

  // ───────────────────────── stable callback refs

  bind<K extends SingleKey>(key: K): (el: EngineDom[K]) => void {
    return this.cached(`k:${key}`, (el: EngineDom[K]) => {
      this.dom[key] = el;
    });
  }

  bindStation(id: string) {
    return this.cached(`s:${id}`, (el: HTMLElement | null) => {
      const prev = this.dom.stations.get(id);
      if (prev) prev.removeEventListener('contentvisibilityautostatechange', this.onVisibilityState);
      if (el) {
        this.dom.stations.set(id, el);
        el.addEventListener('contentvisibilityautostatechange', this.onVisibilityState);
      } else this.dom.stations.delete(id);
    });
  }

  bindMarker(id: string) {
    return this.cached(`m:${id}`, (el: HTMLElement | null) => {
      if (el) this.dom.markers.set(id, el);
      else this.dom.markers.delete(id);
    });
  }

  bindNav(id: string) {
    return this.cached(`n:${id}`, (el: HTMLElement | null) => {
      if (el) this.dom.nav.set(id, el);
      else this.dom.nav.delete(id);
    });
  }

  bindChunk(i: number) {
    return this.cached(`c:${i}`, (el: SVGSVGElement | null) => {
      if (el) {
        this.dom.chunks.set(i, {
          svg: el,
          done: el.querySelector<SVGGElement>('.rail-done-group'),
          mask: el.querySelector<SVGPathElement>('.rail-mask-path'),
        });
        if (i < this.chunkState.length) {
          this.chunkState[i] = 9; // force re-apply
          this.chunkVisible[i] = -1;
        }
        this.dirty = true;
        this.kick();
      } else this.dom.chunks.delete(i);
    });
  }

  bindLayer(kind: 'tex' | 'deco', id: string) {
    return this.cached(`${kind}:${id}`, (el: HTMLElement | null) => {
      const map = kind === 'tex' ? this.dom.textures : this.dom.decos;
      if (el) map.set(id, el);
      else map.delete(id);
      this.layerShown.delete(`${kind}:${id}`);
      this.blendKey = '';
    });
  }

  private cached<T>(key: string, fn: (el: T) => void): (el: T) => void {
    let f = this.refCache.get(key) as ((el: T) => void) | undefined;
    if (!f) {
      f = fn;
      this.refCache.set(key, f as (el: never) => void);
    }
    return f;
  }

  private onVisibilityState = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    const id = el.getAttribute('data-station');
    if (!id) return;
    if ((e as Event & { skipped?: boolean }).skipped) this.skipped.add(id);
    else this.skipped.delete(id);
  };

  // ───────────────────────── lifecycle

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('focusin', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.measure();
    this.rawTarget = this.target = this.current = this.readScroll();
    if (PERF_ALLOWED && new URLSearchParams(location.search).has('perf')) void this.togglePerf(true);
    this.kick();
  }

  stop() {
    this.running = false;
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('focusin', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Called whenever geometry is (re)built. Keeps progress. */
  setGeometry(geo: RailGeometry) {
    const keep = this.target;
    const wasComplete = !!this.geo?.complete;
    this.geo = geo;
    this.stationStates = [];
    this.framingIdx = 0;
    this.chapterIdx = -1;
    this.riderSide = '';
    this.camReady = false;
    this.blendKey = '';
    // mobile panel windows: [arrival − lead, arrival + dwell + hold], never overlapping the next one
    const S = geo.stations;
    this.panelIn = new Float64Array(S.length);
    this.panelOut = new Float64Array(S.length);
    for (let i = 0; i < S.length; i++) {
      this.panelIn[i] = i === 0 ? -Infinity : S[i].len - mobileLayout.panelLead;
      this.panelOut[i] = i === S.length - 1 ? Infinity : S[i].len + S[i].dwellLen + mobileLayout.panelHold;
    }
    for (let i = 0; i < S.length - 1; i++) this.panelOut[i] = Math.min(this.panelOut[i], this.panelIn[i + 1]);
    this.chunkVisible = new Int8Array(geo.chunks.length).fill(-1);
    this.chunkState = new Int8Array(geo.chunks.length).fill(9);
    this.curChunk = -1;
    this.lastMask = -1;
    this.boundaries = [];
    for (let i = 1; i < geo.chapters.length; i++) {
      const a = geo.chapters[i - 1];
      const b = geo.chapters[i];
      if (a.theme !== b.theme) this.boundaries.push({ at: b.startProgress, from: a.theme, to: b.theme });
    }
    this.measure();
    if (geo.complete && wasComplete) {
      // rebuild (resize / remeasure): keep the rider where it was
      const top = lenToScroll(geo.scrollMap, keep * geo.total);
      if (Math.abs(window.scrollY - top) > 1) window.scrollTo(0, top);
      this.rawTarget = this.target = this.current = keep;
    } else {
      // boot → full: progress comes from the real scroll position
      this.rawTarget = this.target = this.current = this.readScroll();
    }
    this.lastLen = this.current * geo.total;
    this.dirty = true;
    this.kick();
  }

  // ───────────────────────── public controls & queries

  scrollToProgress(p: number) {
    const g = this.geo;
    if (!g) return;
    window.scrollTo({ top: lenToScroll(g.scrollMap, clamp(p) * g.total), behavior: 'auto' });
  }

  scrollToStation(id: string) {
    const s = this.geo?.stations.find((st) => st.id === id);
    if (s) this.scrollToProgress(s.progress);
  }

  scrollToChapter(id: string) {
    const c = this.geo?.chapters.find((ch) => ch.id === id);
    if (c) this.scrollToProgress(c.entryProgress);
  }

  step(dir: 1 | -1) {
    const S = this.geo?.stations;
    if (!S?.length) return;
    const eps = 1e-4;
    const cur = this.target;
    let next: number | null = null;
    if (dir > 0) {
      for (let i = 0; i < S.length; i++) if (S[i].progress > cur + eps) { next = S[i].progress; break; }
    } else {
      for (let i = S.length - 1; i >= 0; i--) if (S[i].progress < cur - eps) { next = S[i].progress; break; }
    }
    this.scrollToProgress(next ?? (dir > 0 ? 1 : 0));
  }

  /** Chapter-local progress (unclamped) of the smoothed rider — read by WebGL scenes. */
  chapterProgress(chapterId: string): number {
    const c = this.geo?.chapters.find((ch) => ch.id === chapterId);
    if (!c) return -1;
    return (this.current - c.startProgress) / Math.max(1e-6, c.endProgress - c.startProgress);
  }

  themeWeight(id: ThemeId): number {
    return this.weights[id] ?? 0;
  }

  get chapterIndex() {
    return this.chapterIdx;
  }

  addFrameListener(fn: Listener<FrameState>): () => void {
    this.frameListeners.push(fn);
    fn(this.frame);
    return () => {
      const i = this.frameListeners.indexOf(fn);
      if (i >= 0) this.frameListeners.splice(i, 1);
    };
  }

  /** 3D scenes tick inside the single loop (after theme, before sound). */
  addSceneTicker(fn: SceneTicker): () => void {
    this.sceneTickers.push(fn);
    this.kick();
    return () => {
      const i = this.sceneTickers.indexOf(fn);
      if (i >= 0) this.sceneTickers.splice(i, 1);
    };
  }

  setSceneInfo(fn: (() => string) | null) {
    this.sceneInfo = fn;
  }

  onChapter(fn: Listener<number>): () => void {
    this.chapterListeners.push(fn);
    if (this.chapterIdx >= 0) fn(this.chapterIdx);
    return () => {
      const i = this.chapterListeners.indexOf(fn);
      if (i >= 0) this.chapterListeners.splice(i, 1);
    };
  }

  /** true while the rider is within ±1 chapter of `chapterId` (or ~10% before it). */
  onSceneActive(chapterId: string, fn: Listener<boolean>): () => void {
    let set = this.sceneListeners.get(chapterId);
    if (!set) this.sceneListeners.set(chapterId, (set = new Set()));
    set.add(fn);
    fn(this.sceneActive.get(chapterId) ?? false);
    this.dirty = true;
    this.kick();
    return () => set.delete(fn);
  }

  async togglePerf(force?: boolean) {
    if (!PERF_ALLOWED) return;
    this.perfOn = force ?? !this.perfOn;
    if (this.perfOn && !this.perf) {
      const { PerfMonitor } = await import('@/lib/perf/monitor');
      this.perf = new PerfMonitor();
    }
    if (this.dom.perf) this.dom.perf.hidden = !this.perfOn;
    this.kick();
  }

  // ───────────────────────── events (store values only)

  private onScroll = () => {
    this.rawTarget = this.readScroll();
    this.dirty = true;
    this.kick();
  };

  private onResize = () => {
    const w = window.innerWidth;
    // touch: address-bar show/hide only changes height — ignore (stage uses svh)
    if (IS_TOUCH && w === this.lastWidth) return;
    this.measure();
    this.dirty = true;
    this.kick();
  };

  private onVisibility = () => {
    if (!document.hidden) {
      this.lastT = 0;
      this.dirty = true;
      this.kick();
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (PERF_ALLOWED && e.altKey && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      void this.togglePerf();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'PageDown':
        this.step(1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'PageUp':
        this.step(-1);
        break;
      case 'Home':
        this.scrollToProgress(0);
        break;
      case 'End':
        this.scrollToProgress(1);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  /** Tabbing into a card moves the rider to it. */
  private onFocus = (e: FocusEvent) => {
    const el = (e.target as Element | null)?.closest?.('[data-station]');
    if (!el || !this.geo) return;
    const id = el.getAttribute('data-station');
    const i = this.geo.stations.findIndex((s) => s.id === id);
    if (i >= 0 && this.stationStates[i] !== 'active') this.scrollToProgress(this.geo.stations[i].progress);
  };

  // ───────────────────────── internals

  private measure() {
    const stage = this.dom.stage;
    this.vw = stage?.clientWidth || window.innerWidth;
    this.vh = stage?.clientHeight || window.innerHeight;
    this.lastWidth = window.innerWidth;
    // progress maps to a fixed scroll length (independent of innerHeight → no jumps when the toolbar hides)
    this.scrollLength = Math.max(1, this.geo?.scrollMap.total ?? 1);
  }

  /** Scroll px → arc length (through reading-time dwells) → progress. */
  private readScroll() {
    const g = this.geo;
    if (!g) return 0;
    return clamp(scrollToLen(g.scrollMap, window.scrollY) / g.total);
  }

  private kick() {
    if (this.running && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (t: number) => {
    this.raf = 0;
    const geo = this.geo;
    const d = this.dom;
    if (!geo || !d.world) return;
    const workStart = performance.now();
    const perf = this.perfOn ? this.perf : null;
    this.activePerf = perf;
    perf?.begin();
    this.mark = workStart;
    const lap = this.lapFn;

    const dtMs = this.lastT ? Math.min(100, t - this.lastT) : 16.67;
    this.lastT = t;
    const f = dtMs / 16.67;
    const wasDirty = this.dirty;
    let keepGoing = false;

    if (wasDirty) {
      // ── progress (with single-frame backward-spike filter for iOS)
      const raw = this.rawTarget;
      const back = (this.target - raw) * this.scrollLength;
      if (IS_TOUCH && this.lastAcceptedDir > 0 && back > 60 && !this.spikeHeld) {
        this.spikeHeld = true;
      } else {
        if (raw !== this.target) this.lastAcceptedDir = Math.sign(raw - this.target);
        this.spikeHeld = false;
        this.target = raw;
      }
      const kp = 1 - Math.pow(1 - PROGRESS_LERP, f);
      this.current += (this.target - this.current) * kp;
      if (Math.abs(this.target - this.current) * geo.total < 0.25) this.current = this.target;
      const len = this.current * geo.total;
      lap(S_PROGRESS);

      // ── camera: rider + framing + look-ahead
      const p = sampleLUT(geo.lut, len, this.s);
      const frame = this.framing(geo, len);
      const L = railLayout[geo.mode];
      sampleLUT(geo.lut, len + 60, this.sa);
      sampleLUT(geo.lut, len - 60, this.sb);
      const dxT = this.sa.x - this.sb.x;
      const dyT = this.sa.y - this.sb.y;
      const dl = Math.hypot(dxT, dyT) || 1;
      const reach = L.lookAhead * Math.min(this.vw, this.vh) * frame.free;
      const kl = 1 - Math.pow(1 - 0.06, f);
      this.look.x += ((dxT / dl) * reach - this.look.x) * kl;
      this.look.y += ((dyT / dl) * reach - this.look.y) * kl;
      const tx = p.x + frame.x + this.look.x;
      const ty = p.y + frame.y + this.look.y;
      if (!this.camReady) {
        this.cam.x = tx;
        this.cam.y = ty;
        this.camReady = true;
      } else {
        const kc = 1 - Math.pow(1 - CAMERA_LERP, f);
        this.cam.x += (tx - this.cam.x) * kc;
        this.cam.y += (ty - this.cam.y) * kc;
      }
      this.wx = this.vw * L.camera.x - this.cam.x;
      this.wy = this.vh * L.camera.y - this.cam.y;
      d.world.style.transform = `translate3d(${this.wx.toFixed(1)}px,${this.wy.toFixed(1)}px,0)`;
      if (d.texture) {
        const gs = TEXTURE_CELL;
        const gx = ((this.wx % gs) + gs) % gs;
        const gy = ((this.wy % gs) + gs) % gs;
        d.texture.style.transform = `translate3d(${(gx - gs).toFixed(1)}px,${(gy - gs).toFixed(1)}px,0)`;
      }
      if (d.rider) {
        d.rider.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
        if (frame.side !== this.riderSide) {
          this.riderSide = frame.side;
          d.rider.dataset.side = frame.side;
        }
      }
      lap(S_CAMERA);

      // ── rail chunks
      this.updateChunks(geo, d, len);
      lap(S_RAIL);

      // ── stations + chapter + HUD
      this.updateStations(geo, d, len);
      this.updateChapter(geo, d, len);
      this.updateHud(geo, d, p, t);
      lap(S_STATIONS);

      // ── theme
      this.updateTheme(d);
      lap(S_THEME);

      this.updateFrameState(len, p.x, p.y, this.s.wave, dtMs / 1000, geo);
      this.updateScenes(geo);

      const settled =
        this.current === this.target &&
        !this.spikeHeld &&
        Math.abs(tx - this.cam.x) < 0.1 &&
        Math.abs(ty - this.cam.y) < 0.1;
      this.dirty = !settled;
    }

    // ── 3D (may ask for frames on its own: camera easing / idle drift)
    for (let i = 0; i < this.sceneTickers.length; i++) if (this.sceneTickers[i](t, dtMs)) keepGoing = true;
    lap(S_3D);

    // ── sound
    if (wasDirty) for (let i = 0; i < this.frameListeners.length; i++) this.frameListeners[i](this.frame);
    lap(S_SOUND);

    const work = performance.now() - workStart;
    if (wasDirty) this.monitorQuality(dtMs, work, t);
    if (perf) {
      perf.end(dtMs, work, t);
      perf.paint(d.perf, t, {
        tier: `${quality.tier}${quality.forced ? ' (forced)' : quality.locked ? ' (locked)' : ''}`,
        chapter: geo.chapters[this.chapterIdx]?.title ?? '—',
        stationsMounted: d.stations.size - this.skipped.size,
        stationsTotal: d.stations.size,
        chunksVisible: this.chunksVisibleCount,
        chunksTotal: geo.chunks.length,
        gl: this.sceneInfo ? this.sceneInfo() : null,
        idle: !wasDirty && !keepGoing,
      });
    }

    if (this.dirty || keepGoing || this.perfOn) this.kick();
    else this.lastT = 0;
  };

  private activePerf: PerfMonitor | null = null;
  private mark = 0;
  /** Subsystem timer — a bound method, so no closure is created per frame. */
  private readonly lapFn = (sub: number) => {
    const perf = this.activePerf;
    if (!perf) return;
    const n = performance.now();
    perf.add(sub, n - this.mark);
    this.mark = n;
  };

  /** Runtime tier monitor: step down after ~2s over budget, up after a long calm. */
  private monitorQuality(dtMs: number, workMs: number, now: number) {
    if (quality.forced || now - this.startedAt < 3000) return;
    this.frameEma += (dtMs - this.frameEma) * 0.05;
    this.workEma += (workMs - this.workEma) * 0.05;
    // iOS Low Power Mode caps rAF at 30 Hz: steady ~33 ms with little work is not "slow"
    const capped = this.frameEma > 31 && this.frameEma < 35.5 && this.workEma < 5;
    if (this.frameEma > PERF_BUDGET.frameMs && !capped) {
      this.overMs += dtMs;
      this.comfyMs = 0;
      if (this.overMs > (IS_TOUCH ? PERF_BUDGET.touchDowngradeAfterMs : PERF_BUDGET.downgradeAfterMs) && !quality.locked) {
        quality.step(-1);
        this.overMs = 0;
        this.blendKey = '';
      }
    } else {
      this.overMs = Math.max(0, this.overMs - dtMs * 0.5);
      if (this.frameEma < PERF_BUDGET.comfortableMs) {
        this.comfyMs += dtMs;
        if (this.comfyMs > PERF_BUDGET.upgradeAfterMs && !quality.locked) {
          quality.step(1);
          this.comfyMs = 0;
          this.blendKey = '';
        }
      }
    }
  }

  /** `free` = 0 at a station, 1 midway between stations (look-ahead weight). */
  private readonly frameOut: Vec2 & { side: CardSide; free: number } = { x: 0, y: 0, side: 'left', free: 0 };

  private framing(geo: RailGeometry, len: number) {
    const S = geo.stations;
    const out = this.frameOut;
    if (!S.length) {
      out.x = out.y = 0;
      out.free = 1;
      return out;
    }
    let i = Math.min(this.framingIdx, S.length - 1);
    while (i > 0 && S[i].len > len) i--;
    while (i < S.length - 1 && S[i + 1].len <= len) i++;
    this.framingIdx = i;
    const a = S[i];
    const b = S[i + 1];
    if (!b || len <= a.len) {
      out.x = a.frame.x;
      out.y = a.frame.y;
      out.side = a.side;
      out.free = 0;
      return out;
    }
    const t = (len - a.len) / (b.len - a.len);
    const near = Math.min(len - a.len, b.len - len);
    out.free = smoothstep(clamp((near - this.vh * 0.15) / (this.vh * 0.45)));
    const e = smoothstep(clamp((t - 0.3) / 0.4));
    out.x = a.frame.x + (b.frame.x - a.frame.x) * e;
    out.y = a.frame.y + (b.frame.y - a.frame.y) * e;
    out.side = e < 0.5 ? a.side : b.side;
    return out;
  }

  /**
   * Chunked rail: off-screen chunks get display:none; past chunks show the
   * solid "done" layer, future chunks only "ahead"; only the chunk under the
   * rider has a mask whose dashoffset changes per frame (small repaint).
   */
  private updateChunks(geo: RailGeometry, d: EngineDom, len: number) {
    const C = geo.chunks;
    if (!C.length) return;
    const margin = 0.5 * Math.max(this.vw, this.vh) + 60;
    const x0 = -this.wx - margin;
    const x1 = this.vw - this.wx + margin;
    const y0 = -this.wy - margin;
    const y1 = this.vh - this.wy + margin;

    let cur = this.curChunk < 0 ? 0 : this.curChunk;
    while (cur > 0 && C[cur].start > len) cur--;
    while (cur < C.length - 1 && C[cur].end <= len) cur++;

    let visible = 0;
    for (let i = 0; i < C.length; i++) {
      const b = C[i].bbox;
      const vis = b.maxX >= x0 && b.minX <= x1 && b.maxY >= y0 && b.minY <= y1 ? 1 : 0;
      visible += vis;
      const dom = d.chunks.get(i);
      if (!dom) continue;
      if (this.chunkVisible[i] !== vis) {
        this.chunkVisible[i] = vis;
        dom.svg.style.display = vis ? '' : 'none';
      }
      const st = i < cur ? 1 : i === cur ? 0 : -1;
      if (this.chunkState[i] !== st && dom.done) {
        this.chunkState[i] = st;
        dom.done.style.display = st < 0 ? 'none' : '';
        if (st === 0) dom.done.setAttribute('mask', `url(#rail-mask-${i})`);
        else dom.done.removeAttribute('mask');
        if (st === 0) this.lastMask = -1;
      }
    }
    this.chunksVisibleCount = visible;
    this.curChunk = cur;

    const cd = d.chunks.get(cur);
    if (cd?.mask) {
      const c = C[cur];
      const local = clamp((len - c.start) / Math.max(1e-6, c.end - c.start));
      const off = Math.round((1 - local) * 10000) / 10000;
      if (off !== this.lastMask) {
        this.lastMask = off;
        cd.mask.style.strokeDashoffset = String(off);
      }
    }
  }

  private panelIn = new Float64Array(0);
  private panelOut = new Float64Array(0);

  private updateStations(geo: RailGeometry, d: EngineDom, len: number) {
    if (geo.mode === 'mobile') return this.updatePanels(geo, d, len);
    const L = railLayout[geo.mode];
    const reveal = this.vh * L.revealAhead;
    const passBase = Math.min(this.vw, this.vh) * 0.35;
    const S = geo.stations;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const state: StationState = len < s.len - reveal ? 'hidden' : len > s.len + s.extent / 2 + passBase ? 'passed' : 'active';
      if (this.stationStates[i] !== state) {
        this.stationStates[i] = state;
        const el = d.stations.get(s.id);
        if (el) el.dataset.state = state;
      }
    }
  }

  /**
   * Mobile: a station's panel is shown while the rider is inside its window —
   * from just before the marker, through the reading dwell, a little beyond —
   * then it leaves ('passed'); later ones are 'hidden'. Markers mirror it.
   */
  private updatePanels(geo: RailGeometry, d: EngineDom, len: number) {
    const S = geo.stations;
    for (let i = 0; i < S.length; i++) {
      const state: StationState = len < this.panelIn[i] ? 'hidden' : len >= this.panelOut[i] ? 'passed' : 'active';
      if (this.stationStates[i] !== state) {
        this.stationStates[i] = state;
        const id = S[i].id;
        const el = d.stations.get(id);
        if (el) el.dataset.state = state;
        const m = d.markers.get(id);
        if (m) m.dataset.state = state;
      }
    }
  }

  private updateChapter(geo: RailGeometry, d: EngineDom, len: number) {
    const C = geo.chapters;
    let idx = 0;
    while (idx < C.length - 1 && C[idx + 1].startLen <= len && C[idx + 1].startLen > 0) idx++;
    if (idx === this.chapterIdx) return;
    this.chapterIdx = idx;
    const ch = C[idx];
    if (d.hudChapter) d.hudChapter.textContent = ch.title;
    d.nav.forEach((el, id) => {
      if (id === ch.id) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
    if (d.stage) d.stage.dataset.chapter = ch.id;
    for (let i = 0; i < this.chapterListeners.length; i++) this.chapterListeners[i](idx);
  }

  /**
   * Theme blending by the rider's progress. Writes CSS variables on the stage
   * only inside transition zones and only those whose (cached, quantised)
   * value changed. Off-zone frames return after one string compare.
   */
  private updateTheme(d: EngineDom) {
    const stage = d.stage;
    if (!stage || this.chapterIdx < 0) return;
    const q = quality.preset;
    const half = railLayout.transitionZone / 2;
    const p = this.current;

    let from: ThemeId = chapterConfig[this.chapterIdx]?.theme ?? chapterConfig[0].theme;
    let to: ThemeId = from;
    let t = 0;
    for (let i = 0; i < this.boundaries.length; i++) {
      const b = this.boundaries[i];
      if (p > b.at - half && p < b.at + half) {
        from = b.from;
        to = b.to;
        t = (p - (b.at - half)) / (2 * half);
        break;
      }
    }
    // cheap early-out (no string building) when nothing changed since last frame
    const step = from === to ? 0 : Math.round(t * q.themeSteps);
    if (
      this.blendKey === 'ok' &&
      from === this.bFrom &&
      to === this.bTo &&
      step === this.bStep &&
      q.themeSteps === this.bSteps &&
      q.interpolateExpensive === this.bInterp
    )
      return;
    this.blendKey = 'ok';
    this.bFrom = from;
    this.bTo = to;
    this.bStep = step;
    this.bSteps = q.themeSteps;
    this.bInterp = q.interpolateExpensive;
    const bf = blendFrame(from, to, step / q.themeSteps, q.themeSteps, q.interpolateExpensive);

    const keys = bf.keys;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = bf.vars[k];
      if (this.varCache.get(k) !== v) {
        this.varCache.set(k, v);
        stage.style.setProperty(k, v);
      }
    }
    for (let i = 0; i < THEME_IDS.length; i++) {
      const id = THEME_IDS[i];
      this.weights[id] = bf.weights[id];
      this.showLayer('deco', id, d.decos.get(id), bf.weights[id] > 0.001);
    }
    for (let i = 0; i < TEXTURES.length; i++) {
      const x = TEXTURES[i];
      this.showLayer('tex', x, d.textures.get(x), bf.tex[x] > 0.001);
    }
    this.readout = bf.readout;
    if (bf.theme !== this.dominantTheme) {
      this.dominantTheme = bf.theme;
      stage.dataset.theme = bf.theme;
      this.lastReadout = '';
    }
    const tq = step / q.themeSteps;
    const veil = from === to ? 0 : Math.round(clamp(1 - Math.abs(tq - 0.5) / 0.2) * 0.9 * 50) / 50;
    if (veil !== this.lastVeil && d.veil) {
      this.lastVeil = veil;
      d.veil.style.opacity = String(veil);
    }
  }
  private bFrom = '';
  private bTo = '';
  private bStep = -1;
  private bSteps = 0;
  private bInterp = true;

  /** Layers with zero weight are display:none — not painted, no GPU memory. */
  private showLayer(kind: 'tex' | 'deco', id: string, el: HTMLElement | undefined, show: boolean) {
    if (!el) return;
    const k = `${kind}:${id}`;
    if (this.layerShown.get(k) === show) return;
    this.layerShown.set(k, show);
    el.style.display = show ? '' : 'none';
  }

  private updateFrameState(len: number, x: number, y: number, wave: number, dt: number, geo: RailGeometry) {
    const fr = this.frame;
    fr.velocity = dt > 0 ? (len - this.lastLen) / dt : 0;
    if (Math.abs(fr.velocity) < 1) fr.velocity = 0;
    this.lastLen = len;
    fr.len = len;
    fr.dt = dt;
    fr.progress = this.current;
    fr.x = x;
    fr.y = y;
    fr.chapterIndex = this.chapterIdx;
    const ch = geo.chapters[this.chapterIdx];
    fr.wave = ch && themes[ch.theme].rail.geometry === 'sine' ? wave : null;
  }

  private updateHud(geo: RailGeometry, d: EngineDom, p: Vec2, now: number) {
    const pct = Math.round(this.current * 100);
    if (pct !== this.lastPct && d.hudPct) {
      this.lastPct = pct;
      d.hudPct.textContent = `${pad(pct)}%`;
    }
    if (!d.hudReadout || now - this.lastReadoutAt < 1000 / quality.preset.readoutHz) return;
    this.lastReadoutAt = now;
    let text: string;
    if (this.readout === 'frequency') {
      const n = this.frame.wave ?? 0;
      const hz = Math.round(440 * Math.pow(2, n * 0.5));
      const db = Math.round(-24 + 12 * Math.abs(n));
      text = `${hz} Hz · −${Math.abs(db)} dB`;
    } else if (this.readout === 'friendly') {
      text = `You're here · chapter ${this.chapterIdx + 1} of ${geo.chapters.length}`;
    } else {
      text = `X ${coord(p.x)} / Y ${coord(p.y)}`;
    }
    if (text !== this.lastReadout) {
      this.lastReadout = text;
      d.hudReadout.textContent = text;
    }
  }

  private updateScenes(geo: RailGeometry) {
    if (!this.sceneListeners.size) return;
    this.sceneListeners.forEach(this.checkScene, this);
    void geo;
  }

  private checkScene(set: Set<Listener<boolean>>, id: string) {
    const geo = this.geo;
    if (!geo) return;
    let ci = -1;
    for (let i = 0; i < geo.chapters.length; i++) if (geo.chapters[i].id === id) ci = i;
    if (ci < 0) return;
    const c = geo.chapters[ci];
    const p = this.current;
    const near = this.chapterIdx >= ci - 1 && this.chapterIdx <= ci + 1;
    const active = geo.complete && (near || (p > c.startProgress - SCENE_PRELOAD && p < c.endProgress));
    if (this.sceneActive.get(id) !== active) {
      this.sceneActive.set(id, active);
      set.forEach((fn) => fn(active));
    }
  }
}
