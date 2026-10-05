'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { RailEngine } from './engine';
import type { RailGeometry } from './geometry';

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** One engine per mounted rail. Create it first so the sizes hook can read `engine.dom.stations`. */
export function useEngineInstance() {
  const [engine] = useState(() => new RailEngine());
  return engine;
}

/** Starts/stops the engine and feeds it new geometry. */
export function useRailEngine(engine: RailEngine, geo: RailGeometry) {
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    engine.setGeometry(geo);
  }, [engine, geo]);
}
