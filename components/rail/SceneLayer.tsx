'use client';

import { useEffect, useRef, useState } from 'react';
import { QUALITY } from '@/config/quality';
import type { RailEngine } from '@/lib/rail/engine';
import { quality, useTier } from '@/lib/quality/store';
import type { SceneHandle } from '@/lib/scene/sphere';
import { DotSphereStatic } from '../visuals';

interface Props {
  engine: RailEngine;
  chapterId: string;
  mobile: boolean;
}

/**
 * Shared full-stage canvas for the 3D chapter. Mounted while the rider is
 * within ±1 chapter of it (or ~10% of progress before it) — three.js is
 * imported, the scene built and shaders compiled before the chapter starts;
 * disposed beyond that. Fallback tier / lost context → static SVG sphere.
 */
export function SceneLayer({ engine, chapterId, mobile }: Props) {
  const [active, setActive] = useState(false);
  const tier = useTier();
  useEffect(() => engine.onSceneActive(chapterId, setActive), [engine, chapterId]);
  if (!active) return null;
  if (!QUALITY[tier].webgl) return <StaticSphere />;
  return <SceneCanvas engine={engine} chapterId={chapterId} mobile={mobile} />;
}

function StaticSphere() {
  return (
    <div className="scene-static pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      <DotSphereStatic className="max-w-[min(70vw,560px)]" />
      <div className="scene-vignette absolute inset-0" />
    </div>
  );
}

function SceneCanvas({ engine, chapterId, mobile }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const [lost, setLost] = useState(false);
  const [build, setBuild] = useState(0);
  const tier = useTier();

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    import('@/lib/scene/sphere').then(({ createSphere }) => {
      if (disposed || !ref.current) return;
      const handle = createSphere(ref.current, {
        mobile,
        preset: quality.preset,
        getProgress: () => engine.chapterProgress(chapterId),
        getWeight: () => engine.themeWeight('dark3d'),
        onContextLost: () => setLost(true),
        onContextRestored: () => {
          setLost(false);
          setBuild((b) => b + 1);
        },
      });
      handleRef.current = handle;
      engine.setSceneInfo(handle.info);
      void handle.ready.then(() => {
        if (!disposed) unsubscribe = engine.addSceneTicker(handle.tick);
      });
    });
    return () => {
      disposed = true;
      unsubscribe?.();
      engine.setSceneInfo(null);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [engine, chapterId, mobile, build]);

  useEffect(() => {
    handleRef.current?.setPreset(QUALITY[tier]);
  }, [tier]);

  return (
    <div className="scene-layer pointer-events-none absolute inset-0" aria-hidden>
      <canvas ref={ref} className="block h-full w-full" />
      {lost && <StaticSphere />}
      {/* keeps cards/text readable: dims the scene around the viewport centre */}
      <div className="scene-vignette absolute inset-0" />
    </div>
  );
}
