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

      {/* Audio — gig-poster zine: tape, stars, scribbles, circled word, xerox smudge */}
      <div ref={engine.bindLayer('deco', 'audio')} className="deco deco-audio">
        <span className="tape tape-1" />
        <span className="tape tape-2" />
        <svg className="zine-star zine-star-1" viewBox="0 0 40 40">
          <polygon points="20,2 25,15 39,15 28,24 32,38 20,29 8,38 12,24 1,15 15,15" />
        </svg>
        <svg className="zine-star zine-star-2" viewBox="0 0 40 40">
          <polygon points="20,2 25,15 39,15 28,24 32,38 20,29 8,38 12,24 1,15 15,15" />
        </svg>
        <svg className="zine-scribble" viewBox="0 0 160 60" fill="none">
          <path d="M6 44 C 30 10, 60 54, 84 26 S 128 8, 142 30" />
          <path d="M130 20 L 144 31 L 128 38" />
        </svg>
        <div className="zine-circled">
          <span>live!</span>
          <svg viewBox="0 0 120 60" fill="none">
            <path d="M14 34 C 10 12, 104 6, 110 28 C 116 50, 22 58, 12 36 C 8 26, 40 14, 70 16" />
          </svg>
        </div>
      </div>

      {/* Human-first — soft pastel fields */}
      <div ref={engine.bindLayer('deco', 'human')} className="deco deco-human">
        <span className="soft-blob soft-blob-1" />
        <span className="soft-blob soft-blob-2" />
        <span className="soft-blob soft-blob-3" />
      </div>
    </div>
  );
});
