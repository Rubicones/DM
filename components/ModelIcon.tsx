'use client';

import { useEffect, useRef, useState } from 'react';
import { QUALITY } from '@/config/quality';
import { quality, useTier } from '@/lib/quality/store';
import type { ModelIconHandle } from '@/lib/scene/modelIcon';

interface Props {
  src: string;
  /** Shown until the model is ready, and instead of it without WebGL. */
  fallback: React.ReactNode;
}

/**
 * Animated 3D icon inside a project tile. The renderer is created only once
 * the tile is within ~1 viewport (IntersectionObserver) and torn down on
 * unmount. Hover target = the whole tile (`.project-tile`, falls back to the
 * icon); keyboard focus inside the card plays it too. (Touch: a tap on the tile
 * opens the site, so there is no tap toggle.)
 */
export function ModelIcon({ src, fallback }: Props) {
  const wrap = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tier = useTier();
  const webgl = QUALITY[tier].webgl;
  const [near, setNear] = useState(false);
  const [lost, setLost] = useState(false);

  // mount the scene only near the viewport
  useEffect(() => {
    const el = wrap.current;
    if (!el || near) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!near || !webgl || lost || !el || !cv) return;
    let handle: ModelIconHandle | null = null;
    let disposed = false;
    const target = (el.closest('.project-tile') as HTMLElement | null) ?? el;
    const card = el.closest('.card') ?? target;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hover = false;
    let focus = false;
    const sync = () => handle?.setHover(hover || focus);
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      hover = true;
      sync();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      hover = false;
      sync();
    };
    const onFocusIn = () => {
      focus = true;
      sync();
    };
    const onFocusOut = (e: Event) => {
      if (card.contains((e as FocusEvent).relatedTarget as Node | null)) return;
      focus = false;
      sync();
    };
    target.addEventListener('pointerenter', onEnter);
    target.addEventListener('pointerleave', onLeave);
    card.addEventListener('focusin', onFocusIn);
    card.addEventListener('focusout', onFocusOut);

    const ro = new ResizeObserver(() => handle?.resize(cv.clientWidth, cv.clientHeight));
    void import('@/lib/scene/modelIcon').then(({ createModelIcon }) => {
      if (disposed) return;
      try {
        handle = createModelIcon(cv, { src, dprMax: quality.preset.dprMax, instant: reduced, onLost: () => setLost(true) });
      } catch {
        setLost(true);
        return;
      }
      handle.resize(cv.clientWidth, cv.clientHeight);
      ro.observe(cv);
      sync();
    });

    return () => {
      disposed = true;
      ro.disconnect();
      target.removeEventListener('pointerenter', onEnter);
      target.removeEventListener('pointerleave', onLeave);
      card.removeEventListener('focusin', onFocusIn);
      card.removeEventListener('focusout', onFocusOut);
      handle?.dispose();
    };
  }, [near, webgl, lost, src]);

  const live = near && webgl && !lost;
  return (
    <span ref={wrap} className="model-icon relative block size-full">
      {!live && fallback}
      {live && <canvas ref={canvas} className="absolute inset-0 block size-full" />}
    </span>
  );
}
