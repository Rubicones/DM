'use client';

import { useEffect, useRef, useState } from 'react';
import { soundConfig } from '@/config/sound';
import type { RailEngine } from '@/lib/rail/engine';
import type { SoundSystem } from './SoundSystem';

export interface SoundControl {
  on: boolean;
  /** Choice was "on" last visit; waiting for any click/key to start audio. */
  pending: boolean;
  toggle: () => void;
}

const read = () => {
  try {
    return window.localStorage.getItem(soundConfig.storageKey) === 'on';
  } catch {
    return false;
  }
};
const write = (on: boolean) => {
  try {
    window.localStorage.setItem(soundConfig.storageKey, on ? 'on' : 'off');
  } catch {
    /* storage unavailable — fine */
  }
};

/**
 * Owns the SoundSystem for the rail view. OFF by default; never autoplays.
 * The whole audio stack (system + engines + buffer rendering) is a lazy chunk,
 * loaded on the first sound gesture.
 */
export function useRailSound(engine: RailEngine): SoundControl {
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(false);
  const sys = useRef<SoundSystem | null>(null);

  /** Created synchronously inside the gesture (autoplay policy), reused afterwards. */
  const unlock = () => {
    const c = new AudioContext({ latencyHint: 'interactive' });
    void c.resume();
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
    let cleanupGesture: (() => void) | null = null;
    if (read()) {
      // Remembered "on": still needs a gesture (autoplay policy) — first click / key / touch starts it.
      const startOnGesture = () => {
        cleanupGesture?.();
        cleanupGesture = null;
        const ctx = unlock();
        void ensure()
          .then((s) => s.start(ctx))
          .then(() => {
            setPending(false);
            setOn(true);
          });
      };
      const events = ['pointerdown', 'keydown', 'touchstart'] as const;
      events.forEach((ev) => window.addEventListener(ev, startOnGesture, { once: true, passive: true }));
      cleanupGesture = () => events.forEach((ev) => window.removeEventListener(ev, startOnGesture));
      queueMicrotask(() => setPending(true));
      // warm the lazy audio chunk so the first gesture starts instantly
      void import('./SoundSystem');
    }
    return () => {
      cleanupGesture?.();
      void sys.current?.stop();
      sys.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ensure` only closes over refs + engine
  }, [engine]);

  const toggle = () => {
    if (pending) {
      setPending(false);
      if (sys.current?.running) return setOn(true);
      const ctx = unlock();
      void ensure()
        .then((s) => s.start(ctx))
        .then(() => setOn(true));
      return;
    }
    if (sys.current?.running) {
      write(false);
      setOn(false);
      void sys.current.stop();
    } else {
      write(true);
      const ctx = sys.current?.running ? undefined : unlock();
      void ensure()
        .then((s) => s.start(ctx))
        .then(() => setOn(true));
    }
  };

  return { on, pending, toggle };
}
