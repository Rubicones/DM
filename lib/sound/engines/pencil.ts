/**
 * HUMAN-FIRST — graphite on textured paper: looped band-passed noise whose
 * level and brightness follow velocity. Noise only (no clicks / crackles). Soft, never harsh.
 */
import { clamp01, holdThenRelease } from '../dsp';
import type { EngineFactory } from '../types';

export const pencil: EngineFactory = ({ ctx, out, bank }) => {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);

  const src = ctx.createBufferSource();
  src.buffer = bank.noise;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.value = 1800;
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 6000;
  const amp = ctx.createGain();
  amp.gain.value = 0;
  src.connect(bp).connect(soft).connect(amp).connect(bus);
  src.start();

  return {
    onDash() {},
    onMove(_distance, velocity) {
      const n = clamp01(velocity / 1800);
      bp.frequency.setTargetAtTime(1500 + n * 2800, ctx.currentTime, 0.06);
      holdThenRelease(amp.gain, 0.11 * clamp01(velocity / 220), ctx, 0.04);
    },
    setGain(x) {
      bus.gain.setTargetAtTime(x, ctx.currentTime, 0.04);
    },
    dispose() {
      src.stop();
      bus.disconnect();
    },
  };
};
