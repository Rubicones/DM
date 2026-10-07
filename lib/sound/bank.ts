/**
 * All sample buffers, pre-rendered ONCE when sound is enabled. Engines only
 * create lightweight AudioBufferSourceNodes per event.
 */
import { renderBuffer } from './dsp';

export interface BufferBank {
  /** General tap — a few slightly different variants (picked at random per tick, like the 3D plucks). */
  clicks: AudioBuffer[];
  /** One-shot: the rider latching onto the rail at the end of the "Start journey" jump. */
  latch: AudioBuffer;
  bass: AudioBuffer[];
  noise: AudioBuffer;
  grain: AudioBuffer;
}

export function renderBank(ctx: BaseAudioContext, rng: () => number): BufferBank {
  // general click: soft tactile tap, set fairly high (~2.4 kHz) — a "tock" carries it, the press /
  // release edges are only a hint (double edge ~3.5 ms apart = tactile, but
  // low and quiet so it doesn't read as clicky). No low-mid body → still light.
  // Variants differ a little in tock pitch / ring and in the press→release gap.
  const edge = (t: number, a: number) => (t < 0 ? 0 : a);
  const tap = (tockHz: number, tockDecay: number, releaseAt: number) => {
    let hp = 0;
    let prev = 0;
    return renderBuffer(ctx, 0.018, (t) => {
      const n = rng() * 2 - 1;
      hp = 0.6 * (hp + n - prev); // steeper high-pass → only the "snap" of the noise
      prev = n;
      const press = hp * Math.exp(-t / 0.0004) * 0.3 + Math.sin(2 * Math.PI * 4400 * t) * Math.exp(-t / 0.0004) * 0.2;
      const tock = Math.sin(2 * Math.PI * tockHz * t) * Math.exp(-t / tockDecay) * 0.42;
      const r = t - releaseAt;
      const release = edge(r, 1) * (hp * Math.exp(-r / 0.0004) * 0.12 + Math.sin(2 * Math.PI * 5200 * r) * Math.exp(-r / 0.0003) * 0.1);
      return press + tock + release;
    });
  };
  const clicks = [tap(2400, 0.0018, 0.0035), tap(2250, 0.002, 0.0031), tap(2560, 0.0016, 0.0039), tap(2330, 0.0019, 0.0044)];

  // 3D: bassy plucks with a fast pitch drop + sub thump
  const sr = ctx.sampleRate;
  const pluck = (f0: number) => {
    let ph = 0;
    let sub = 0;
    return renderBuffer(ctx, 0.24, (t) => {
      const f = f0 * (1 + 0.9 * Math.exp(-t / 0.018));
      ph += (2 * Math.PI * f) / sr;
      sub += (2 * Math.PI * 42) / sr;
      const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
      const body = (Math.sin(ph) * 0.75 + tri * 0.25) * Math.exp(-t / 0.075);
      const thump = Math.sin(sub) * Math.exp(-t / 0.05) * Math.min(1, t / 0.004) * 0.55;
      return (body + thump) * 0.8;
    });
  };

  // human-first: 2 s of soft pinkish noise (looped) + a tiny grain
  let b0 = 0;
  let b1 = 0;
  const noise = renderBuffer(ctx, 2, () => {
    const w = rng() * 2 - 1;
    b0 = 0.97 * b0 + w * 0.15;
    b1 = 0.6 * b1 + w * 0.4;
    return (b0 + b1) * 0.6;
  });
  const grain = renderBuffer(ctx, 0.006, (t) => (rng() * 2 - 1) * Math.exp(-t / 0.0012));

  // latch: a crisp mechanical snap — bright transient, short metallic ring
  // (two inharmonic partials) and a small low "seat" thud as it locks in
  let lhp = 0;
  let lprev = 0;
  const latch = renderBuffer(ctx, 0.12, (t) => {
    const n = rng() * 2 - 1;
    lhp = 0.7 * (lhp + n - lprev);
    lprev = n;
    const snap = lhp * Math.exp(-t / 0.0009) * 0.8 + Math.sin(2 * Math.PI * 3800 * t) * Math.exp(-t / 0.0006) * 0.5;
    const ring = (Math.sin(2 * Math.PI * 2350 * t) * 0.18 + Math.sin(2 * Math.PI * 3710 * t) * 0.1) * Math.exp(-t / 0.028);
    const seat = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t / 0.018) * Math.min(1, t / 0.002) * 0.35;
    return snap + ring + seat;
  });

  return { clicks, latch, bass: [pluck(55), pluck(68), pluck(82)], noise, grain };
}
