import type { BufferBank } from './bank';

export interface SoundContext {
  ctx: AudioContext;
  /** Pre-rendered buffers (created once when sound is enabled). */
  bank: BufferBank;
  /** Connect the engine's output here (master bus → limiter → speakers). */
  out: AudioNode;
  rng: () => number;
}

/** Shared interface of every chapter sound engine. */
export interface ChapterSoundEngine {
  /** Discrete event: the rider crossed pattern element `index` (a dash / a dot). `gain` is already rate-scaled. */
  onDash(index: number, gain: number): void;
  /** Every frame while the rider moves: px moved this frame, |velocity| in px/s. */
  onMove(distance: number, velocity: number): void;
  /** Chapter crossfade weight 0…1 (same blend factor as the visual theme). */
  setGain(x: number): void;
  dispose(): void;
}

export type EngineFactory = (c: SoundContext) => ChapterSoundEngine;
