import { memo } from 'react';
import { site } from '@/config/content';
import type { RailEngine } from '@/lib/rail/engine';

/** Amplitude-modulated carrier (the "AM" waveform), pre-computed once. */
const SCOPE = (() => {
  let d = '';
  for (let x = 0; x <= 1600; x += 4) {
    const env = Math.pow(Math.abs(Math.sin((x / 1600) * Math.PI * 3)), 1.4);
    const y = 60 + Math.sin(x * 0.11) * 44 * env;
    d += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
  }
  return d;
})();
const SPARKS: [string, string, 'c' | 'p'][] = [
  ['8%', '24%', 'p'],
  ['91%', '38%', 'c'],
  ['14%', '66%', 'c'],
  ['84%', '72%', 'p'],
];

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

      {/* Audio — FM synth: oscilloscope AM wave along the bottom, a panel readout, a few sparks */}
      <div ref={engine.bindLayer('deco', 'audio')} className="deco deco-audio">
        <svg className="synth-scope" viewBox="0 0 1600 120" preserveAspectRatio="none">
          <path d={SCOPE} className="synth-scope-glow" />
          <path d={SCOPE} className="synth-scope-line" />
          <path d="M0 60 H1600" className="synth-scope-axis" />
        </svg>
        <div className="synth-panel">
          <span>fm · 4 op</span>
          <span>alg 05 · fb 6</span>
          <span className="synth-panel-patch">e.piano 1</span>
        </div>
        {SPARKS.map(([l, t, k]) => (
          <span key={`${l}-${t}`} className={`synth-spark synth-spark-${k}`} style={{ left: l, top: t }} />
        ))}
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
