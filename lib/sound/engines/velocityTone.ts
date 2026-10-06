/**
 * AUDIO — continuous warm tone: detuned sine/triangle pair + a quiet sine an octave above,
 * through a soft low-pass that tracks the pitch (never past ~2 kHz → no edge).
 * Pitch follows SMOOTHED scroll velocity, quantised to an A-minor pentatonic
 * (A3…A5), with a slow glide; silent when the rider stops.
 */
import { clamp01, holdThenRelease } from '../dsp';
import type { EngineFactory } from '../types';

const PENTATONIC = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
/** px/s that maps to the top of the scale. */
const TOP_SPEED = 2600;

export const velocityTone: EngineFactory = ({ ctx, out }) => {
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const high = ctx.createOscillator();
  o1.type = 'sine';
  o2.type = 'triangle';
  high.type = 'sine';
  o1.detune.value = -6;
  o2.detune.value = 6;
  const highGain = ctx.createGain();
  highGain.gain.value = 0.3; // octave-up shimmer — kept quiet so the tone stays warm
  const triGain = ctx.createGain();
  triGain.gain.value = 0.45; // a little triangle for harmonics, tamed by the filter
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.5;
  lp.frequency.value = 600;
  const amp = ctx.createGain();
  amp.gain.value = 0;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  o1.connect(lp);
  o2.connect(triGain).connect(lp);
  high.connect(highGain).connect(lp);
  lp.connect(amp).connect(bus).connect(out);
  o1.frequency.value = o2.frequency.value = PENTATONIC[0];
  high.frequency.value = PENTATONIC[0] * 2;
  o1.start();
  o2.start();
  high.start();

  let vs = 0;
  return {
    onDash() {},
    onMove(_distance, velocity) {
      vs += (velocity - vs) * 0.12;
      const n = clamp01(vs / TOP_SPEED);
      const f = PENTATONIC[Math.round(n * (PENTATONIC.length - 1))];
      const now = ctx.currentTime;
      o1.frequency.setTargetAtTime(f, now, 0.14);
      o2.frequency.setTargetAtTime(f, now, 0.14);
      high.frequency.setTargetAtTime(f * 2, now, 0.14);
      lp.frequency.setTargetAtTime(600 + n * 1400, now, 0.12);
      holdThenRelease(amp.gain, 0.2 * clamp01(velocity / 300), ctx, 0.07);
    },
    setGain(x) {
      bus.gain.setTargetAtTime(x, ctx.currentTime, 0.03);
    },
    dispose() {
      o1.stop();
      o2.stop();
      high.stop();
      bus.disconnect();
    },
  };
};
