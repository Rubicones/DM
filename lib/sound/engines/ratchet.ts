/**
 * GENERAL / BRUTALIST — soft tactile tap per rail dash (muted tock, faint press + release).
 * Like the 3D plucks: a random pre-rendered variant per tick (never the same one
 * twice in a row), ±4% rate, ±15% level and a little brightness drift. One reused filter.
 */
import { playBuffer } from '../dsp';
import type { EngineFactory } from '../types';

export const ratchet: EngineFactory = ({ ctx, out, rng, bank }) => {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 8000;
  tone.Q.value = 0.7;
  tone.connect(bus).connect(out);

  let last = -1;
  return {
    onDash(_index, gain) {
      const n = bank.clicks.length;
      let k = Math.floor(rng() * n);
      if (k === last) k = (k + 1) % n;
      last = k;
      tone.frequency.setTargetAtTime(8000 * (1 + (rng() - 0.5) * 0.12), ctx.currentTime, 0.005);
      playBuffer(ctx, bank.clicks[k], tone, 1 + (rng() - 0.5) * 0.08, 0.38 * gain * (0.85 + rng() * 0.3));
    },
    onMove() {},
    setGain(x) {
      bus.gain.setTargetAtTime(x, ctx.currentTime, 0.03);
    },
    dispose() {
      tone.disconnect();
      bus.disconnect();
    },
  };
};
