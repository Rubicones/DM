import { memo } from 'react';
import { coord, pad } from '@/lib/rail/format';
import type { RailChunk, RailGeometry } from '@/lib/rail/geometry';
import type { RailEngine } from '@/lib/rail/engine';

const PAD = 60;
/** Mask dash length = chunk arc length (+ slack for the 0.1 px rounding of the path coordinates). */
const maskLen = (c: RailChunk) => Math.ceil(c.end - c.start) + 2;

interface Props {
  geo: RailGeometry;
  engine: RailEngine;
}

/**
 * CHUNKED RAIL — one small SVG per ~1–2 viewports of arc length.
 *   ahead  — upcoming style (dashed / dotted / pencil / pastel tint)
 *   done   — glow + solid/dotted + sketch strokes (display:none on future chunks)
 * Only the chunk under the rider carries a mask (pathLength=1 → the engine
 * writes dashoffset = 1 − local progress), so per-frame repaint is limited to
 * one small chunk. Off-screen chunks are display:none (engine).
 * `stroke-dashoffset: <chunk start>` keeps dash/dot patterns continuous
 * across chunk boundaries.
 */
export const RailSvg = memo(function RailSvg({ geo, engine }: Props) {
  return (
    <>
      {geo.chunks.map((c) => (
        <Chunk key={`${geo.total}-${c.index}`} c={c} geo={geo} engine={engine} />
      ))}
    </>
  );
});

function Chunk({ c, geo, engine }: { c: RailChunk; geo: RailGeometry; engine: RailEngine }) {
  const x = c.bbox.minX - PAD;
  const y = c.bbox.minY - PAD;
  const w = c.bbox.maxX - c.bbox.minX + PAD * 2;
  const h = c.bbox.maxY - c.bbox.minY + PAD * 2;
  const isLast = c.index === geo.chunks.length - 1;
  const end = geo.points[geo.points.length - 1];
  const offset = { strokeDashoffset: c.start };
  const corners = geo.corners.filter((k) => k.len >= c.start && (k.len < c.end || isLast));
  const dividers = geo.chapters.filter((ch) => ch.divider && ch.dividerLen >= c.start && (ch.dividerLen < c.end || isLast));

  return (
    <svg
      ref={engine.bindChunk(c.index)}
      aria-hidden
      className="rail-chunk pointer-events-none absolute overflow-visible"
      style={{ left: x, top: y, width: w, height: h, display: 'none' }}
      viewBox={`${x} ${y} ${w} ${h}`}
    >
      <defs>
        <mask id={`rail-mask-${c.index}`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
          <path
            className="rail-mask-path"
            d={c.d}
            fill="none"
            stroke="#fff"
            strokeWidth={40}
            strokeLinejoin="round"
            // real px lengths, not pathLength=1: Safari scales pathLength inconsistently between
            // dasharray and a CSS dashoffset → the "done" rail showed up in patches ahead of the rider
            strokeDasharray={`${maskLen(c)} ${maskLen(c) * 2}`}
            strokeDashoffset={maskLen(c)}
          />
        </mask>
      </defs>

      <path d={c.d} className="rail-ahead" style={offset} />
      <g className="rail-done-group" style={{ display: 'none' }}>
        <path d={c.d} className="rail-glow" />
        <path d={c.d} className="rail-done" style={offset} />
        <path d={c.d} className="rail-sketch" />
      </g>

      {corners.length > 0 && (
        <g className="rail-nodes">
          {corners.map((k, i) => (
            <g key={i} transform={`translate(${k.x} ${k.y})`}>
              <rect x={-7} y={-7} width={14} height={14} className="rail-node" />
              {i % 2 === 0 && (
                <text x={16} y={-14} className="rail-coord">
                  X {coord(k.x)} · Y {coord(k.y)}
                </text>
              )}
            </g>
          ))}
        </g>
      )}

      {dividers.map((ch) => {
        const label = `Ch.${pad(ch.index + 1)} — ${ch.title}`;
        const lw = label.length * 7.4 + 24;
        return (
          <g key={ch.id} transform={`translate(${ch.divider!.x} ${ch.divider!.y})`}>
            <rect x={-lw / 2} y={-14} width={lw} height={28} className="rail-chip" />
            <text x={0} y={4} textAnchor="middle" className="rail-chip-text">
              {label}
            </text>
          </g>
        );
      })}

      {isLast && geo.complete && <rect x={end.x - 12} y={end.y - 12} width={24} height={24} className="rail-end" />}
    </svg>
  );
}
