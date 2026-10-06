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
  const safari = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent);
  if (cores >= 8 && mem >= 8 && !safari) return 'high';
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
      // 'fallback' (no WebGL) ONLY when WebGL is really missing. Tier 0 also comes back for
      // blocklisted / slow-benchmark matches — and Firefox hides the unmasked renderer, so its
      // GPU often matches a weak or wrong entry (Firefox Android landed on the static sphere
      // while WebGL worked fine). Those get 'low': WebGL on the lightest preset, and the
      // runtime monitor still steps down if frames really are slow.
      if (r.type === 'WEBGL_UNSUPPORTED') {
        if (!quality.locked) quality.set('fallback', 'detect');
        return;
      }
      const gpu: Tier = r.tier <= 1 ? 'low' : r.tier === 2 ? 'medium' : 'high';
      // mobile GPUs at tier 3 still get 'medium' unless the CPU side looks strong too
      const mobileCap: Tier = r.isMobile && (navigator.hardwareConcurrency || 4) < 8 ? 'medium' : 'high';
      // Safari: WebGL point rendering is much slower than Chrome on the same GPU → at most 'medium'
      const ua = navigator.userAgent;
      const safariCap: Tier = /AppleWebKit/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/.test(ua) ? 'medium' : 'high';
      const t = minTier(minTier(minTier(gpu, mobileCap), safariCap), guess === 'low' ? 'low' : 'high');
      if (!quality.locked) quality.set(t, 'detect');
    } catch {
      /* keep heuristic */
    }
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(() => void run(), { timeout: 2500 });
  else setTimeout(() => void run(), 1200);
}
