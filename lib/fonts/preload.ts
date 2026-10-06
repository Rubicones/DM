'use client';

import type { ThemeId } from '@/config/themes';
import { atkinson, fraunces, interTight, marker, spaceMono, typewriter } from '@/app/fonts';

/** Families each non-default theme needs (brutalist fonts are preloaded by next/font). */
const THEME_FONTS: Partial<Record<ThemeId, { family: string; weights: string[] }[]>> = {
  dark3d: [{ family: interTight.style.fontFamily, weights: ['400', '700'] }],
  audio: [
    { family: marker.style.fontFamily, weights: ['400'] },
    { family: spaceMono.style.fontFamily, weights: ['400', '700'] },
    { family: typewriter.style.fontFamily, weights: ['400'] },
  ],
  human: [
    { family: atkinson.style.fontFamily, weights: ['400', '700'] },
    { family: fraunces.style.fontFamily, weights: ['500'] },
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
