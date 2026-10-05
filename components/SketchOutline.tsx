'use client';

import { QUALITY } from '@/config/quality';
import { roughRect } from '@/lib/sketch/rough';
import { useTier } from '@/lib/quality/store';

/**
 * Hand-drawn card outline: two pre-baked jittered paths (cached by seed +
 * detail), no live filters. Hidden unless the theme sets
 * --t-sketch-display: block. Size-independent (0…100 viewBox, non-scaling stroke),
 * so it never needs regenerating on resize.
 */
export function SketchOutline({ seed }: { seed: number }) {
  const detail = QUALITY[useTier()].sketchDetail;
  return (
    <svg className="sketch-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
      <path d={roughRect(seed, detail)} />
      <path d={roughRect(seed + 97, detail, 0.8)} className="sketch-outline-2" />
    </svg>
  );
}
