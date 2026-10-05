/**
 * 3D — one electronic, bassy pluck per DOT of the dotted-matrix rail
 * (pre-rendered variants, ±3% rate variation per trigger).
 */
import { playBuffer } from '../dsp';
import type { EngineFactory } from '../types';

export const bassDots: EngineFactory = ({ ctx, out, rng, bank }) => {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(bus).connect(out);

  return {
    onDash(index, gain) {
      const v = bank.bass[(index + Math.floor(rng() * 2)) % bank.bass.length];
      playBuffer(ctx, v, lp, 1 + (rng() - 0.5) * 0.06, 0.55 * gain * (0.85 + rng() * 0.3));
    },
    onMove() {},
    setGain(x) {
      bus.gain.setTargetAtTime(x, ctx.currentTime, 0.03);
    },
    dispose() {
      lp.disconnect();
      bus.disconnect();
    },
  };
};
