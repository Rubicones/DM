/**
 * PERF MONITOR (dev / NEXT_PUBLIC_PERF=1 only — loaded via dynamic import).
 * Ring buffers over the last 120 frames; formatted into the overlay at 4 Hz.
 */
export const SUBSYSTEMS = ['progress', 'camera', 'rail', 'stations', 'theme', '3d', 'sound'] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];
const N = 120;

export interface PerfExtras {
  tier: string;
  chapter: string;
  stationsMounted: number;
  stationsTotal: number;
  chunksVisible: number;
  chunksTotal: number;
  gl: string | null;
  idle: boolean;
}

export class PerfMonitor {
  private frames = new Float32Array(N);
  private work = new Float32Array(N);
  private subs = SUBSYSTEMS.map(() => new Float32Array(N));
  private cur = new Float32Array(SUBSYSTEMS.length);
  private i = 0;
  private count = 0;
  private lastPaint = 0;
  private stamps: number[] = [];

  begin() {
    this.cur.fill(0);
  }

  add(sub: number, ms: number) {
    this.cur[sub] += ms;
  }

  end(frameMs: number, workMs: number, now: number) {
    this.frames[this.i] = frameMs;
    this.work[this.i] = workMs;
    for (let k = 0; k < this.subs.length; k++) this.subs[k][this.i] = this.cur[k];
    this.i = (this.i + 1) % N;
    this.count++;
    this.stamps.push(now);
    while (this.stamps.length && now - this.stamps[0] > 1000) this.stamps.shift();
  }

  /** Writes the overlay text at most 4×/s. */
  paint(el: HTMLElement | null, now: number, x: PerfExtras) {
    if (!el || now - this.lastPaint < 250) return;
    this.lastPaint = now;
    const n = Math.min(N, this.count);
    let sum = 0;
    let worst = 0;
    let wsum = 0;
    for (let k = 0; k < n; k++) {
      sum += this.frames[k];
      wsum += this.work[k];
      if (this.frames[k] > worst) worst = this.frames[k];
    }
    const avg = n ? sum / n : 0;
    const lines = [
      `fps     ${this.stamps.length}${x.idle ? ' (idle)' : ''}`,
      `frame   avg ${avg.toFixed(1)} · worst ${worst.toFixed(1)} ms`,
      `main    avg ${(n ? wsum / n : 0).toFixed(2)} ms/frame`,
      ...SUBSYSTEMS.map((s, k) => {
        let t = 0;
        let w = 0;
        for (let j = 0; j < n; j++) {
          t += this.subs[k][j];
          if (this.subs[k][j] > w) w = this.subs[k][j];
        }
        return `  ${s.padEnd(9)}${(n ? t / n : 0).toFixed(3)} · max ${w.toFixed(2)}`;
      }),
      `tier    ${x.tier}`,
      `chapter ${x.chapter}`,
      `station ${x.stationsMounted}/${x.stationsTotal} rendered`,
      `chunks  ${x.chunksVisible}/${x.chunksTotal} visible`,
      x.gl ? `gl      ${x.gl}` : 'gl      —',
    ];
    el.textContent = lines.join('\n');
  }
}
