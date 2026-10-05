/**
 * AUDIO — continuous soft tone: detuned triangle pair → gentle low-pass.
 * Pitch follows SMOOTHED scroll velocity, quantised to an A-minor pentatonic
 * (glide between targets); cutoff opens with speed; silent when the rider stops.
 */
import { clamp01, holdThenRelease } from '../dsp';
import type { EngineFactory } from '../types';

const PENTATONIC = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
/** px/s that maps to the top of the scale. */
const TOP_SPEED = 2600;

export const velocityTone: EngineFactory = ({ ctx, out }) => {
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'triangle';
  o2.type = 'triangle';
  o1.detune.value = -7;
  o2.detune.value = 8;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.value = 420;
  const amp = ctx.createGain();
  amp.gain.value = 0;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(amp).connect(bus).connect(out);
  o1.frequency.value = o2.frequency.value = PENTATONIC[0];
  o1.start();
  o2.start();

  let vs = 0;
  return {
    onDash() {},
    onMove(_distance, velocity) {
      vs += (velocity - vs) * 0.12;
      const n = clamp01(vs / TOP_SPEED);
      const f = PENTATONIC[Math.round(n * (PENTATONIC.length - 1))];
      const now = ctx.currentTime;
      o1.frequency.setTargetAtTime(f, now, 0.09);
      o2.frequency.setTargetAtTime(f, now, 0.09);
      lp.frequency.setTargetAtTime(380 + n * 2800, now, 0.08);
      holdThenRelease(amp.gain, 0.16 * clamp01(velocity / 300), ctx, 0.05);
    },
    setGain(x) {
      bus.gain.setTargetAtTime(x, ctx.currentTime, 0.03);
    },
    dispose() {
      o1.stop();
      o2.stop();
      bus.disconnect();
    },
  };
};
