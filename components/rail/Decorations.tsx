import { memo } from 'react';
import { site } from '@/config/content';
import type { RailEngine } from '@/lib/rail/engine';

/** Kick pattern of the 16-step sequencer strip (1 = hit). */
const STEPS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];

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

      {/* Audio — Teenage Engineering-style instrument: product label, speaker grille, LCD, live 16-step sequencer */}
      <div ref={engine.bindLayer('deco', 'audio')} className="deco deco-audio">
        <div className="te-label">
          <span className="te-label-name">R.A.I.L. Ⅰ</span>
          <span className="te-label-jp">サウンド</span>
          <span className="te-label-sub">16 step rail sequencer</span>
        </div>
        <span className="te-grille" />
        <div className="te-lcd">
          <span className="te-lcd-bar">bar</span>
          <span className="te-lcd-num">120.0</span>
          <span className="te-lcd-rec" />
          <span className="te-lcd-play" />
          <span className="te-lcd-fx">fx</span>
        </div>
        <div className="te-seq">
          <span className="te-seq-title">sequencer</span>
          <div className="te-seq-steps">
            {STEPS.map((hit, i) => (
              <span key={i} className="te-step" data-hit={hit ? '' : undefined}>
                <span className="te-step-n">{i + 1}</span>
              </span>
            ))}
            <span className="te-seq-head" />
          </div>
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
