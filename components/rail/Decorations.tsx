import { memo } from 'react';
import { site } from '@/config/content';
import type { RailEngine } from '@/lib/rail/engine';

const CROSS: [string, string][] = [
  ['5%', '22%'], ['95%', '22%'],
  ['5%', '50%'], ['95%', '50%'],
  ['5%', '78%'], ['95%', '78%'],
];

/**
 * Theme-controlled decoration layers. Always in the DOM, never affect layout
 * (absolute, pointer-events: none, aria-hidden). Each layer's opacity is its
 * theme's blend weight (--t-w-<id>), so they cross-fade with the rider.
 */
export const Decorations = memo(function Decorations({ engine }: { engine: RailEngine }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* 3D — poster registration marks, boxed X, tiny lowercase metadata */}
      <div ref={engine.bindLayer('deco', 'dark3d')} className="deco deco-dark3d">
        {CROSS.map(([l, t]) => (
          <span key={`${l}-${t}`} className="crosshair" style={{ left: l, top: t }} />
        ))}
        <span className="box-x" />
        <div className="poster-meta">
          {site.posterMeta.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </div>
      </div>

      {/* Audio — Teenage Engineering-style instrument: product label, record key, LCD */}
      <div ref={engine.bindLayer('deco', 'audio')} className="deco deco-audio">
        <span className="te-label">Rubicon</span>
        <span className="te-rec">
          <span className="te-rec-key" />
          <span className="te-rec-label">rec</span>
        </span>
        <div className="te-lcd">
          <span className="te-lcd-bar">bar</span>
          <span className="te-lcd-num">120.0</span>
          <span className="te-lcd-rec" />
          <span className="te-lcd-play" />
          <span className="te-lcd-fx">fx</span>
        </div>
      </div>

      {/* Human-first — large soft colour blooms, drifting slowly */}
      <div ref={engine.bindLayer('deco', 'human')} className="deco deco-human">
        <span className="soft-blob soft-blob-1" />
        <span className="soft-blob soft-blob-2" />
        <span className="soft-blob soft-blob-3" />
        <span className="soft-blob soft-blob-4" />
        <span className="soft-blob soft-blob-5" />
      </div>
    </div>
  );
});
