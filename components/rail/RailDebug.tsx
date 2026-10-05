import { memo } from 'react';
import type { RailGeometry } from '@/lib/rail/geometry';

/**
 * DEV ONLY: waypoints, base legs with their curve envelopes + rail clearance,
 * card bounding boxes + card clearance zones. Toggle from the HUD ("debug").
 */
export const RailDebug = memo(function RailDebug({ geo }: { geo: RailGeometry }) {
  const { legs, cards, railClearance, cardClearance, fallbacks } = geo.debug;
  const pad = 400;
  const { minX, minY, maxX, maxY } = geo.bounds;
  const x = minX - pad;
  const y = minY - pad;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute overflow-visible"
      style={{ left: x, top: y, width: w, height: h, zIndex: 30 }}
      viewBox={`${x} ${y} ${w} ${h}`}
    >
      {legs.map((l, i) => (
        <g key={i}>
          {/* envelope + half clearance = no other leg's zone may overlap this */}
          <line
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            stroke={l.kind === 'station' ? 'rgba(0,160,255,0.12)' : 'rgba(255,0,80,0.1)'}
            strokeWidth={(l.e + railClearance / 2) * 2}
            strokeLinecap="round"
          />
          <line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#ff0050" strokeWidth={1.5} strokeDasharray="6 4" />
          <circle cx={l.a.x} cy={l.a.y} r={5} fill="#ff0050" />
          <text x={l.a.x + 8} y={l.a.y - 8} fontSize={11} fill="#ff0050" fontFamily="monospace">
            {i}
          </text>
        </g>
      ))}
      {cards.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x - cardClearance}
            y={r.y - cardClearance}
            width={r.w + cardClearance * 2}
            height={r.h + cardClearance * 2}
            fill="none"
            stroke="rgba(0,160,255,0.6)"
            strokeDasharray="4 4"
          />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(0,160,255,0.08)" stroke="#00a0ff" />
        </g>
      ))}
      <text x={0} y={-40} fontSize={14} fill="#ff0050" fontFamily="monospace">
        legs {legs.length} · fallbacks {fallbacks} · clearance rail {railClearance} / card {cardClearance}
      </text>
    </svg>
  );
});
