'use client';

import { useEffect, useRef, useState } from 'react';
import type { RailEngine } from '@/lib/rail/engine';
import { LOOKAHEAD } from './dsp';
import type { SoundSystem } from './SoundSystem';

export interface SoundControl {
  on: boolean;
  /** Turn sound on. Call from inside a user gesture (autoplay policy) — e.g. "Start journey". */
  start: () => void;
  toggle: () => void;
  /** Rider latches onto the rail (end of the "Start journey" jump). No-op while sound is off. */
  latch: () => void;
  /** Rising whoosh over the jump (call right after `start`, inside the same gesture). */
  rise: (seconds: number) => void;
  /**
   * The start jump in reverse (rider back into the intro's full stop): reversed latch whose
   * snap lands `liftOffMs` in, then a falling whoosh over `seconds`. Only if sound is running.
   */
  reverseJump: (liftOffMs: number, seconds: number) => void;
}

/**
 * Owns the SoundSystem for the rail view. Sound starts with the journey (the
 * "Start journey" tap is the user gesture browsers require) and can be
 * switched off from the header. The whole audio stack (system + engines +
 * buffer rendering) is a lazy chunk, warmed on mount.
 */
export function useRailSound(engine: RailEngine): SoundControl {
  const [on, setOn] = useState(false);
  const sys = useRef<SoundSystem | null>(null);

  /**
   * Created synchronously inside the gesture (autoplay policy), reused afterwards.
   * A one-sample silent buffer started in the same gesture unlocks older iOS WebKit.
   */
  const unlock = () => {
    const c = new AudioContext({ latencyHint: 'interactive' });
    void c.resume().catch(() => undefined);
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, c.sampleRate);
      src.connect(c.destination);
      src.start(0);
    } catch {
      /* not needed on current engines */
    }
    return c;
  };

  const ensure = async () => {
    if (!sys.current) {
      const { SoundSystem } = await import('./SoundSystem');
      sys.current ??= new SoundSystem(engine);
    }
    return sys.current;
  };

  useEffect(() => {
    // warm the lazy audio chunk so "Start journey" starts sound instantly
    void import('./SoundSystem');
    return () => {
      void sys.current?.stop();
      sys.current = null;
    };
  }, [engine]);

  const start = () => {
    setOn(true);
    if (sys.current?.running) return sys.current.resume();
    const ctx = unlock();
    void ensure().then((s) => s.start(ctx));
  };

  const toggle = () => {
    if (sys.current?.running) {
      setOn(false);
      void sys.current.stop();
    } else start();
  };

  const latch = () => sys.current?.playLatch();
  // queued behind start()'s ensure() → the context exists by the time it runs
  const rise = (seconds: number) => void ensure().then((s) => s.playRise(seconds));

  const reverseJump = (liftOffMs: number, seconds: number) => {
    const s = sys.current;
    if (!s?.running) return;
    window.setTimeout(() => s.playLatch(true), Math.max(0, liftOffMs + 45 - s.latchSeconds * 1000));
    // playRise schedules LOOKAHEAD ahead → take it off so the sweep ends exactly with the flight
    s.playRise(seconds, true, Math.max(0, liftOffMs / 1000 - LOOKAHEAD));
  };

  return { on, start, toggle, latch, rise, reverseJump };
}
