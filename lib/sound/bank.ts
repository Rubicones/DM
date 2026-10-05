/**
 * All sample buffers, pre-rendered ONCE when sound is enabled. Engines only
 * create lightweight AudioBufferSourceNodes per event.
 */
import { renderBuffer } from './dsp';

export interface BufferBank {
  click: AudioBuffer;
  bass: AudioBuffer[];
  noise: AudioBuffer;
  grain: AudioBuffer;
}

export function renderBank(ctx: BaseAudioContext, rng: () => number): BufferBank {
  // ratchet click: crisp filtered noise burst + very short tick
  let hp = 0;
  let prev = 0;
  const click = renderBuffer(ctx, 0.03, (t) => {
    const n = rng() * 2 - 1;
    hp = 0.86 * (hp + n - prev);
    prev = n;
    const noise = hp * Math.exp(-t / 0.0022) * 0.9;
    const tick = Math.sin(2 * Math.PI * 2650 * t) * Math.exp(-t / 0.0007) * 0.7;
    const body = Math.sin(2 * Math.PI * 820 * t) * Math.exp(-t / 0.004) * 0.25;
    return noise + tick + body;
  });

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

  return { click, bass: [pluck(55), pluck(68), pluck(82)], noise, grain };
}
