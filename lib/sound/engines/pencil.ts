/**
 * HUMAN-FIRST — graphite on textured paper: looped band-passed noise whose
 * level and brightness follow velocity, plus sparse random micro-crackles
 * (tiny grains). Soft, never harsh.
 */
import { clamp01, holdThenRelease, playBuffer } from '../dsp';
import type { EngineFactory } from '../types';

export const pencil: EngineFactory = ({ ctx, out, rng, bank }) => {
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

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  hp.connect(bus);

  let acc = 0;
  let lastGrain = 0;
  return {
    onDash() {},
    onMove(distance, velocity) {
      const n = clamp01(velocity / 1800);
      bp.frequency.setTargetAtTime(1500 + n * 2800, ctx.currentTime, 0.06);
      holdThenRelease(amp.gain, 0.11 * clamp01(velocity / 220), ctx, 0.04);
      acc += distance;
      while (acc > 28) {
        acc -= 28;
        const now = ctx.currentTime;
        if (rng() < 0.35 && now - lastGrain > 0.035) {
          lastGrain = now;
          playBuffer(ctx, bank.grain, hp, 0.8 + rng() * 0.6, 0.06 * (0.4 + rng()));
        }
      }
    },
    setGain(x) {
      bus.gain.setTargetAtTime(x, ctx.currentTime, 0.04);
    },
    dispose() {
      src.stop();
      hp.disconnect();
      bus.disconnect();
    },
  };
};
