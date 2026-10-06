'use client';

import type { ThemeId } from '@/config/themes';
import { atkinson, dmMono, fraunces, interTight, outfit } from '@/app/fonts';

type NextFont = typeof interTight;

/** Fonts each non-default theme needs (brutalist fonts are preloaded by next/font). */
const THEME_FONTS: Partial<Record<ThemeId, { font: NextFont; weights: string[] }[]>> = {
  dark3d: [{ font: interTight, weights: ['400', '700'] }],
  audio: [
    { font: outfit, weights: ['300', '400'] },
    { font: interTight, weights: ['400', '700'] },
    { font: dmMono, weights: ['400', '500'] },
  ],
  human: [
    { font: atkinson, weights: ['400', '700'] },
    { font: fraunces, weights: ['400'] },
    { font: dmMono, weights: ['400'] },
  ],
};

const requested = new Set<ThemeId>();

/**
 * Fire-and-forget: switch a theme's `--font-*` variables on (see app/fonts.ts —
 * they are off in the server HTML) and fetch its fonts ahead of its chapter.
 */
export function preloadThemeFonts(theme: ThemeId) {
  if (requested.has(theme) || typeof document === 'undefined') return;
  requested.add(theme);
  const root = document.documentElement;
  for (const f of THEME_FONTS[theme] ?? []) {
    root.classList.add(f.font.variable);
    if (!document.fonts) continue;
    for (const w of f.weights) void document.fonts.load(`${w} 16px ${f.font.style.fontFamily}`).catch(() => undefined);
  }
}

/** Every theme at once (plain view shows all chapters on one page). */
export function preloadAllThemeFonts() {
  (Object.keys(THEME_FONTS) as ThemeId[]).forEach(preloadThemeFonts);
}
