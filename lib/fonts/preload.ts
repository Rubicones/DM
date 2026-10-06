'use client';

import type { ThemeId } from '@/config/themes';
import { atkinson, dmMono, fraunces, interTight, outfit } from '@/app/fonts';

/** Families each non-default theme needs (brutalist fonts are preloaded by next/font). */
const THEME_FONTS: Partial<Record<ThemeId, { family: string; weights: string[] }[]>> = {
  dark3d: [{ family: interTight.style.fontFamily, weights: ['400', '700'] }],
  audio: [
    { family: outfit.style.fontFamily, weights: ['300', '400'] },
    { family: interTight.style.fontFamily, weights: ['400', '700'] },
    { family: dmMono.style.fontFamily, weights: ['400', '500'] },
  ],
  human: [
    { family: atkinson.style.fontFamily, weights: ['400', '700'] },
    { family: fraunces.style.fontFamily, weights: ['400'] },
    { family: dmMono.style.fontFamily, weights: ['400'] },
  ],
};

const requested = new Set<ThemeId>();

/** Fire-and-forget: fetch a theme's fonts ahead of its chapter. */
export function preloadThemeFonts(theme: ThemeId) {
  if (requested.has(theme) || typeof document === 'undefined' || !document.fonts) return;
  requested.add(theme);
  for (const f of THEME_FONTS[theme] ?? []) {
    for (const w of f.weights) void document.fonts.load(`${w} 16px ${f.family}`).catch(() => undefined);
  }
}
