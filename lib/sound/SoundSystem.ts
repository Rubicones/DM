/**
 * ONE global rail-sound system (one AudioContext for the whole site).
 *
 *   RailEngine frame (len, velocity) ──▶ engines of the themes within ±1 chapter
 *        • discrete: one onDash() per crossed dash/dot (period from the theme's
 *          rail pattern, measured on the same arc length as the LUT),
 *          rate-limited — skipped, never queued; scheduled with a look-ahead
 *        • continuous: onMove(distance, velocity) → setTargetAtTime params
 *   engine gains = theme blend weights (same crossfade as the visuals)
 *   all engines → master gain → compressor/limiter → speakers
 *
 * Buffers are pre-rendered once on enable. Engines further than ±1 chapter
 * are disposed (oscillators/noise loops stopped). The context is suspended
 * when the tab is hidden or (mouse devices) the rider has been still for a few
 * seconds.
 *
 * Mobile: a scroll is not a user activation, so iOS / Android only let a
 * context (re)start inside a tap. Touch devices therefore never idle-suspend,
 * and while sound is on every tap / key re-resumes a context that is
 * suspended or 'interrupted' (iOS: calls, Siri, app switch, first touch that
 * turned out to be a scroll).
 */
import { chapters } from '@/config/content';
import { soundConfig } from '@/config/sound';
import { themes, type SoundEngineId, type ThemeId } from '@/config/themes';
import type { FrameState, RailEngine } from '@/lib/rail/engine';
import { dashPeriod } from '@/lib/theme/tokens';
import { LOOKAHEAD, playBuffer } from './dsp';
import { renderBank, type BufferBank } from './bank';
import { bassDots } from './engines/bassDots';
import { pencil } from './engines/pencil';
import { ratchet } from './engines/ratchet';
import { velocityTone } from './engines/velocityTone';
import type { ChapterSoundEngine, EngineFactory } from './types';

const FACTORIES: Record<SoundEngineId, EngineFactory> = {
  ratchet,
  'bass-dots': bassDots,
  'velocity-tone': velocityTone,
  pencil,
};

/** Suspend the AudioContext after this long without movement (ms). Mouse devices only. */
const SUSPEND_AFTER_MS = 3500;
/** Events that count as user activation (audio unlock) — touchstart / pointerdown on touch do not. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
const IS_TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

interface Slot {
  id: ThemeId;
  engine: ChapterSoundEngine;
  /** Vibration pulse per tick (ms), 0 = none. */
  haptic: number;
  period: number;
  lastIndex: number;
  lastTrigger: number;
  lastWeight: number;
}

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private bank: BufferBank | null = null;
  private rng: () => number = Math.random;
  /** Active engines (themes of chapters current−1 … current+1). Array → no per-frame allocation. */
  private slots: Slot[] = [];
  private lastChapter = -2;
  private unsubscribe: (() => void) | null = null;
  private suspendTimer = 0;
  private lastMoveAt = 0;

  constructor(private readonly rail: RailEngine) {}

  get running() {
    return !!this.ctx;
  }

  /**
   * Must originate from a user gesture. Pass a context created synchronously
   * inside the gesture handler (Safari only unlocks audio there); the module
   * itself is a lazy chunk that may arrive a moment later.
   */
  async start(existing?: AudioContext) {
    if (this.ctx) {
      if (existing && existing !== this.ctx) void existing.close(); // duplicate unlock from a double gesture
      this.resume();
      return;
    }
    const ctx = existing ?? new AudioContext({ latencyHint: 'interactive' });
    const master = ctx.createGain();
    master.gain.value = soundConfig.masterVolume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 6;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);

    let seed = 0x9e3779b9;
    this.rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    this.bank = renderBank(ctx, this.rng);
    this.ctx = ctx;
    this.master = master;
    this.limiter = limiter;
    this.lastChapter = -2;
    // wire everything first: resume() stays pending (never rejects) until a real activation
    // — awaiting it here would leave sound dead after a gesture that turned out to be a scroll
    document.addEventListener('visibilitychange', this.onVisibility);
    GESTURES.forEach((ev) => window.addEventListener(ev, this.onGesture, { capture: true, passive: true }));
    this.unsubscribe = this.rail.addFrameListener(this.onFrame);
    this.resume();
  }

  /**
   * Rising whoosh for the start jump — the human-first pencil noise (same looped
   * pink noise) through a band-pass sweeping up while it swells, cut at landing.
   */
  playRise(seconds: number) {
    const ctx = this.ctx;
    const master = this.master;
    const bank = this.bank;
    if (!ctx || !master || !bank) return;
    const t0 = ctx.currentTime + LOOKAHEAD;
    const t1 = t0 + seconds;
    const src = ctx.createBufferSource();
    src.buffer = bank.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(400, t0);
    bp.frequency.exponentialRampToValueAtTime(5200, t1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + seconds * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.05);
    src.connect(bp).connect(g).connect(master);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
    src.start(t0, Math.random() * 1.5);
    src.stop(t1 + 0.08);
  }

  /** One-shot "latch" — the rider snapping onto the rail at the end of the start jump. */
  playLatch() {
    const ctx = this.ctx;
    const master = this.master;
    const bank = this.bank;
    if (!ctx || !master || !bank) return;
    this.resume(false);
    playBuffer(ctx, bank.latch, master, 1, 0.7);
  }

  /**
   * Resume if suspended / interrupted. Inside a gesture handler this also
   * unlocks iOS — so gestures always call it; per-frame calls only retry once
   * the previous attempt has settled.
   */
  resume(fromGesture = true) {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || document.hidden) return;
    if (!fromGesture && this.resuming) return;
    this.resuming = true;
    void ctx
      .resume()
      .catch(() => undefined)
      .finally(() => {
        this.resuming = false;
      });
  }

  private resuming = false;
  private onGesture = () => this.resume();

  async stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    GESTURES.forEach((ev) => window.removeEventListener(ev, this.onGesture, { capture: true }));
    window.clearTimeout(this.suspendTimer);
    const ctx = this.ctx;
    if (!ctx) return;
    this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    await new Promise((r) => setTimeout(r, 120));
    for (const s of this.slots) s.engine.dispose();
    this.slots = [];
    this.master?.disconnect();
    this.limiter?.disconnect();
    this.ctx = this.master = this.limiter = null;
    this.bank = null;
    await ctx.close();
  }

  /** One pending timer at most (no per-frame timer churn). */
  private checkIdle = () => {
    const idle = performance.now() - this.lastMoveAt;
    if (idle >= SUSPEND_AFTER_MS) {
      this.suspendTimer = 0;
      void this.ctx?.suspend();
    } else {
      this.suspendTimer = window.setTimeout(this.checkIdle, SUSPEND_AFTER_MS - idle + 20);
    }
  };

  private onVisibility = () => {
    if (document.hidden) void this.ctx?.suspend();
    else this.resume(false);
  };

  /** Keep only engines for themes within ±1 chapter. Runs on chapter change only. */
  private syncEngines(chapterIndex: number) {
    const ctx = this.ctx;
    const bank = this.bank;
    const master = this.master;
    if (!ctx || !bank || !master) return;
    const want = new Set<ThemeId>();
    for (let i = chapterIndex - 1; i <= chapterIndex + 1; i++) if (chapters[i]) want.add(chapters[i].theme);
    this.slots = this.slots.filter((s) => {
      if (want.has(s.id)) return true;
      s.engine.dispose();
      return false;
    });
    want.forEach((id) => {
      if (this.slots.some((s) => s.id === id)) return;
      this.slots.push({
        id,
        engine: FACTORIES[themes[id].sound]({ ctx, out: master, rng: this.rng, bank }),
        haptic: soundConfig.haptics[themes[id].sound] ?? 0,
        period: dashPeriod(themes[id]),
        lastIndex: NaN,
        lastTrigger: -Infinity,
        lastWeight: -1,
      });
    });
  }

  /** Vibration API: feature-detected once; needs a prior user gesture ("Start journey" is one). */
  private readonly canVibrate =
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private lastPulse = 0;

  private pulse(ms: number, now: number) {
    if (!this.canVibrate || document.hidden || now - this.lastPulse < soundConfig.hapticMinMs) return;
    this.lastPulse = now;
    try {
      navigator.vibrate(ms);
    } catch {
      /* blocked (no user activation yet) — ignore */
    }
  }

  private onFrame = (f: FrameState) => {
    const ctx = this.ctx;
    if (!ctx) return;
    const speed = Math.abs(f.velocity);
    if (speed > 0) {
      this.lastMoveAt = performance.now();
      if (ctx.state !== 'running') this.resume(false);
      if (!IS_TOUCH && !this.suspendTimer) this.suspendTimer = window.setTimeout(this.checkIdle, SUSPEND_AFTER_MS);
    }
    if (ctx.state !== 'running') return;
    if (f.chapterIndex !== this.lastChapter) {
      this.lastChapter = f.chapterIndex;
      this.syncEngines(f.chapterIndex);
    }

    const now = performance.now();
    const distance = speed * f.dt;
    const cap = 1000 / soundConfig.minTriggerMs;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const w = this.rail.themeWeight(s.id);
      if (s.lastWeight !== w) {
        s.lastWeight = w;
        s.engine.setGain(w);
      }
      const idx = s.period > 0 ? Math.floor(f.len / s.period) : 0;
      const prev = s.lastIndex;
      s.lastIndex = idx;
      if (w < 0.001) continue;
      if (s.period > 0 && prev === prev && idx !== prev && now - s.lastTrigger >= soundConfig.minTriggerMs) {
        const crossingsPerSec = Math.abs(idx - prev) / Math.max(f.dt, 1e-3);
        s.engine.onDash(idx, crossingsPerSec > cap ? soundConfig.fastScrollGain : 1);
        s.lastTrigger = now;
        if (s.haptic && w >= 0.5) this.pulse(s.haptic, now);
      }
      s.engine.onMove(distance, speed);
    }
  };
}
