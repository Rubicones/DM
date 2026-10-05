/**
 * GENERAL / BRUTALIST — dry mechanical click per rail dash (ratchet / typewriter key).
 * Uses the pre-rendered click; each trigger gets a barely noticeable ±2.5%
 * pitch and brightness variation. One reused filter.
 */
import { playBuffer } from '../dsp';
import type { EngineFactory } from '../types';

export const ratchet: EngineFactory = ({ ctx, out, rng, bank }) => {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 6500;
  tone.Q.value = 0.7;
  tone.connect(bus).connect(out);

  return {
    onDash(_index, gain) {
      tone.frequency.setTargetAtTime(6500 * (1 + (rng() - 0.5) * 0.06), ctx.currentTime, 0.005);
      playBuffer(ctx, bank.click, tone, 1 + (rng() - 0.5) * 0.05, 0.5 * gain * (0.9 + rng() * 0.2));
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
