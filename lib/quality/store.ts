'use client';

import { useSyncExternalStore } from 'react';
import { QUALITY, TIERS, type QualityPreset, type Tier } from '@/config/quality';

/**
 * Tiny global quality store. The engine and the 3D scene read `quality.preset`
 * directly (no React); components subscribe with `useTier()`.
 */
class QualityStore {
  tier: Tier = 'medium';
  preset: QualityPreset = QUALITY.medium;
  /** Set by ?tier=… — disables auto detection and the runtime monitor. */
  forced = false;
  locked = false;
  switches = 0;
  private listeners = new Set<() => void>();

  set(tier: Tier, reason: 'init' | 'detect' | 'runtime' | 'force' = 'detect') {
    if (tier === this.tier) return;
    if (reason === 'runtime') {
      this.switches++;
      if (this.switches >= 3) this.locked = true;
    }
    this.tier = tier;
    this.preset = QUALITY[tier];
    this.listeners.forEach((l) => l());
  }

  step(dir: -1 | 1) {
    const i = TIERS.indexOf(this.tier);
    // runtime monitor never drops below 'low' (fallback = WebGL unavailable / lost)
    const next = TIERS[Math.max(1, Math.min(TIERS.length - 1, i + dir))];
    if (next !== this.tier) this.set(next, 'runtime');
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const quality = new QualityStore();

export function useTier(): Tier {
  return useSyncExternalStore(
    quality.subscribe,
    () => quality.tier,
    () => 'medium' as Tier,
  );
}
