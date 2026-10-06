'use client';

import { useEffect, useRef, useState } from 'react';
import type { RailEngine } from '@/lib/rail/engine';
import type { SoundSystem } from './SoundSystem';

export interface SoundControl {
  on: boolean;
  /** Turn sound on. Call from inside a user gesture (autoplay policy) — e.g. "Start journey". */
  start: () => void;
  toggle: () => void;
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

  return { on, start, toggle };
}
