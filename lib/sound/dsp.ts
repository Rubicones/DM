import { soundConfig } from '@/config/sound';

/** Pre-render a mono buffer once from a sample generator. */
export function renderBuffer(ctx: BaseAudioContext, seconds: number, fn: (t: number) => number): AudioBuffer {
  const len = Math.max(1, Math.round(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = fn(i / ctx.sampleRate);
  return buf;
}

/** Small scheduling look-ahead so event timing doesn't wobble with frame drops. */
export const LOOKAHEAD = 0.025;

/** Fire-and-forget playback through a short-lived source + gain, scheduled on the audio clock. */
export function playBuffer(ctx: AudioContext, buffer: AudioBuffer, dest: AudioNode, rate = 1, gain = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(dest);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
  };
  src.start(ctx.currentTime + LOOKAHEAD);
}

/**
 * Drive a continuous engine's amplitude: go to `target` now, then fall to 0
 * shortly after. Each call cancels the pending fall, so sound only continues
 * while movement frames keep arriving — no timers needed.
 */
export function holdThenRelease(param: AudioParam, target: number, ctx: AudioContext, attack = 0.03) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(target, now, attack);
  param.setTargetAtTime(0, now + soundConfig.releaseDelay, soundConfig.releaseTau);
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
