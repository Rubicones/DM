'use client';

import type { Tier } from '@/config/quality';
import { quality } from './store';

const RANK: Record<Tier, number> = { fallback: 0, low: 1, medium: 2, high: 3 };
const minTier = (a: Tier, b: Tier): Tier => (RANK[a] <= RANK[b] ? a : b);

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Synchronous first guess (no WebGL context, no network) — applied before first frame. */
export function heuristicTier(): Tier {
  const nav = navigator as Navigator & NavigatorExtras;
  const touch = matchMedia('(pointer: coarse)').matches;
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  if (nav.connection?.saveData) return 'low';
  if (touch) return cores <= 4 || mem <= 3 ? 'low' : 'medium';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'medium';
}

/** ?tier=low|medium|high|fallback */
export function forcedTier(): Tier | null {
  const q = new URLSearchParams(location.search).get('tier');
  return q === 'high' || q === 'medium' || q === 'low' || q === 'fallback' ? q : null;
}

/**
 * Init: forced tier wins; else heuristic now, then detect-gpu (lazy chunk,
 * self-hosted benchmarks in /public/detect-gpu) during idle time.
 */
export function initQuality() {
  const forced = forcedTier();
  if (forced) {
    quality.forced = true;
    quality.set(forced, 'force');
    return;
  }
  const guess = heuristicTier();
  quality.set(guess, 'init');

  const run = async () => {
    try {
      const { getGPUTier } = await import('detect-gpu');
      const r = await getGPUTier({ benchmarksURL: '/detect-gpu' });
      const gpu: Tier = r.tier <= 0 ? 'fallback' : r.tier === 1 ? 'low' : r.tier === 2 ? 'medium' : 'high';
      // mobile GPUs at tier 3 still get 'medium' unless the CPU side looks strong too
      const mobileCap: Tier = r.isMobile && (navigator.hardwareConcurrency || 4) < 8 ? 'medium' : 'high';
      const t = r.tier <= 0 ? 'fallback' : minTier(minTier(gpu, mobileCap), guess === 'low' ? 'low' : 'high');
      if (!quality.locked) quality.set(t, 'detect');
    } catch {
      /* keep heuristic */
    }
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(() => void run(), { timeout: 2500 });
  else setTimeout(() => void run(), 1200);
}
