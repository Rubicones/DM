/**
 * Inline illustrations for stations. Chosen by CONTENT (`visual` field), coloured
 * by the active theme via CSS variables / currentColor. Pure SVG, deterministic,
 * no runtime cost — WebGL is reserved for the single shared stage canvas.
 */
import type { FeatureVisual } from '@/config/content';
import { roughBox, roughCircle } from '@/lib/sketch/rough';
import { SketchOutline } from './SketchOutline';

const r1 = (v: number) => Math.round(v * 10) / 10;
const noise = (x: number, y: number, s = 0) =>
  Math.sin(x * 1.7 + y * 0.9 + s) * 0.6 + Math.cos(x * 0.7 - y * 1.4 + s * 2.1) * 0.4;

// ───────────────────────────── dot sphere (fibonacci)
const SPHERE = (() => {
  const n = 260;
  const pts: { x: number; y: number; r: number; o: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tilt = 0.45;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * rad;
    const z = Math.sin(th) * rad;
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    const depth = (z2 + 1) / 2;
    pts.push({ x: r1(200 + x * 70), y: r1(88 + y2 * 70), r: r1(0.6 + depth * 1.9), o: r1(0.15 + depth * 0.85) });
  }
  return pts.sort((a, b) => a.o - b.o);
})();

// ───────────────────────────── dot plane (perspective terrain)
function terrain(n: number, seed: number, cx: number, cy: number, scale: number) {
  const pts: { x: number; y: number; r: number; o: number }[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const v = (j / (n - 1)) * 2 - 1;
      const edge = 1 - Math.max(Math.abs(u), Math.abs(v));
      const env = Math.min(1, edge / 0.5);
      const h = noise(u * 2, v * 2, seed) * env * 0.35 - (1 - env) * 0.1;
      // isometric-ish projection of a square rotated 45°
      const x = (u - v) * 0.71;
      const zd = (u + v) * 0.71;
      const depth = (zd + 1.42) / 2.84;
      pts.push({
        x: r1(cx + x * scale),
        y: r1(cy + zd * scale * 0.38 - h * scale),
        r: r1(0.5 + depth * 1.6 + Math.max(0, h) * 2),
        o: r1(Math.min(1, 0.12 + depth * 0.7 + Math.max(0, h) * 0.8) * Math.min(1, edge * 6 + 0.1)),
      });
    }
  }
  return pts;
}
const PLANE = terrain(22, 1.3, 200, 92, 120);

// ───────────────────────────── audio motifs (hand-drawn: jitter baked into the geometry, no filters)
const scribble = (seed: number, amp: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = 12 + i * 4.7;
    const t = i / 80;
    const y =
      88 +
      Math.sin(t * Math.PI * 5 + seed) * amp * Math.sin(t * Math.PI) +
      Math.sin(i * 1.9 + seed * 3) * 3.5 +
      Math.sin(t * Math.PI * 17 + seed) * 6;
    pts.push(`${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`);
  }
  return pts.join(' ');
};
const WAVES = [scribble(0, 40), scribble(0.35, 36), scribble(-0.3, 30)];
const BARS = Array.from({ length: 14 }, (_, i) => ({
  h: r1(28 + Math.abs(Math.sin(i * 0.8) * Math.cos(i * 0.21)) * 105),
  tilt: r1(Math.sin(i * 2.3) * 3),
}));
const STAR = (cx: number, cy: number, R: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? R * 0.45 : R;
    pts.push(`${r1(cx + Math.cos(a) * rr)},${r1(cy + Math.sin(a) * rr)}`);
  }
  return pts.join(' ');
};

function Frame({ children, label, seed = 11 }: { children: React.ReactNode; label?: string; seed?: number }) {
  return (
    <div className="visual relative aspect-[16/7] w-full overflow-hidden md:aspect-[16/5]" aria-hidden>
      <SketchOutline seed={seed} />
      {label && <span className="t-label absolute left-3 top-3 text-[10px] text-muted">{label}</span>}
      {children}
    </div>
  );
}

export function Visual({ kind, label }: { kind: FeatureVisual; label?: string }) {
  switch (kind) {
    case 'dot-sphere':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full text-fg" preserveAspectRatio="xMidYMid meet">
            {SPHERE.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="currentColor" opacity={p.o} />
            ))}
          </svg>
        </Frame>
      );
    case 'dot-plane':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full text-fg" preserveAspectRatio="xMidYMid meet">
            {PLANE.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="currentColor" opacity={p.o} />
            ))}
          </svg>
        </Frame>
      );
    case 'waveform':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full" preserveAspectRatio="none">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={WAVES[2]} stroke="var(--t-accent-2)" strokeWidth={2} opacity={0.6} />
              <path d={WAVES[1]} stroke="var(--t-accent-1)" strokeWidth={5} />
              <path d={WAVES[0]} stroke="var(--t-fg)" strokeWidth={2.2} />
              <path d="M10 92 L390 86" stroke="var(--t-fg)" strokeWidth={1.2} strokeDasharray="6 5" opacity={0.5} />
            </g>
          </svg>
        </Frame>
      );
    case 'spectrum':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full" preserveAspectRatio="none">
            <g stroke="var(--t-fg)" strokeWidth={2.2} strokeLinejoin="round">
              {BARS.map((b, i) => (
                <path
                  key={i}
                  d={roughBox(26 + i * 26, 158 - b.h, 17, b.h, i + 3)}
                  fill={i % 4 === 1 ? 'var(--t-accent-2)' : i % 3 === 0 ? 'var(--t-accent-3)' : 'var(--t-accent-1)'}
                  transform={`rotate(${b.tilt} ${34 + i * 26} 158)`}
                />
              ))}
              <path d="M16 160 L120 159.2 L250 160.4 L388 158" fill="none" strokeWidth={3} />
            </g>
          </svg>
        </Frame>
      );
    case 'amp':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <g stroke="var(--t-fg)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              {[0, 1, 2].map((i) => {
                const cx = 70 + i * 82;
                const a = -2.3 + i * 1.6;
                return (
                  <g key={i}>
                    <path d={roughCircle(cx, 78, 28, i + 1)} fill="var(--t-card-bg)" />
                    <path d={roughCircle(cx, 78, 18, i + 7, 1)} fill={i === 1 ? 'var(--t-accent-3)' : 'var(--t-accent-1)'} />
                    <path d={`M${cx} 78 L${r1(cx + Math.cos(a) * 17)} ${r1(78 + Math.sin(a) * 17)}`} />
                  </g>
                );
              })}
              <path d="M300 40 C 340 34, 372 44, 368 70 C 364 98, 336 126, 326 138 C 312 124, 290 96, 290 70 C 290 52, 294 44, 300 40 Z" fill="var(--t-accent-2)" />
              <polygon points={STAR(330, 78, 11)} fill="var(--t-accent-3)" />
            </g>
            {['vol', 'tone', 'gain'].map((t, i) => (
              <text key={t} x={70 + i * 82} y={134} textAnchor="middle" className="t-label" fontSize={12} fill="var(--t-fg)">
                {t}
              </text>
            ))}
          </svg>
        </Frame>
      );
    case 'blob':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
            <ellipse cx={160} cy={96} rx={92} ry={70} fill="var(--t-accent-2)" opacity={0.75} />
            <ellipse cx={238} cy={82} rx={80} ry={64} fill="var(--t-accent-1)" opacity={0.75} />
            <ellipse cx={206} cy={124} rx={70} ry={46} fill="var(--t-accent-3)" opacity={0.8} />
          </svg>
        </Frame>
      );
    case 'objects-3d':
      // CSS 3D (composited transforms, no WebGL): a wireframe cube, a globe of rings, a small cube
      return (
        <Frame label={label}>
          <div className="obj3d-stage">
            <Cube className="obj3d obj3d-a" />
            <Globe className="obj3d obj3d-b" />
            <Cube className="obj3d obj3d-c" />
          </div>
        </Frame>
      );
    case 'blur-blobs':
      return (
        <Frame label={label}>
          <div className="blur-blobs">
            <span className="bb bb-1" />
            <span className="bb bb-2" />
            <span className="bb bb-3" />
            <span className="bb bb-4" />
          </div>
        </Frame>
      );
    case 'guitar':
      return (
        <Frame label={label}>
          <svg viewBox="0 0 400 175" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <g stroke="var(--t-fg)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              {/* sound coming off the strings */}
              <path d="M178 46 c 9 -13 18 13 27 0 s 18 13 27 0 s 18 13 27 0 s 18 13 27 0" fill="none" stroke="var(--t-accent-2)" strokeWidth={3} />
              <path d="M196 132 c 7 -9 14 9 21 0 s 14 9 21 0 s 14 9 21 0" fill="none" stroke="var(--t-accent-3)" strokeWidth={2.4} opacity={0.8} />
              {/* body, pickguard */}
              <path
                d="M42 70 C 30 40, 72 28, 97 47 C 112 58, 126 52, 141 45 C 154 40, 162 52, 152 66 C 147 74, 147 102, 152 110 C 162 124, 154 136, 141 131 C 126 125, 112 119, 97 130 C 72 148, 30 138, 42 106 C 46 96, 46 80, 42 70 Z"
                fill="var(--t-accent-3)"
              />
              <path d="M84 62 C 104 56, 128 62, 134 74 L 134 104 C 120 116, 100 118, 84 112 C 76 100, 76 74, 84 62 Z" fill="var(--t-card-bg)" />
              {/* neck, frets, headstock */}
              <path d="M146 81 L 322 82 L 322 95 L 146 96 Z" fill="var(--t-accent-1)" />
              {[170, 192, 212, 231, 249, 266, 282, 297, 311].map((x) => (
                <path key={x} d={`M${x} 82 L${x} 95`} strokeWidth={1.4} />
              ))}
              <path d="M320 80 L 374 72 C 384 71, 388 78, 383 84 L 374 101 L 320 97 Z" fill="var(--t-card-bg)" />
              {[334, 348, 362].map((x) => (
                <circle key={x} cx={x} cy={70 - (x - 334) * 0.12} r={3.4} fill="var(--t-fg)" />
              ))}
              {/* pickups, bridge, knobs */}
              <rect x={98} y={77} width={8} height={22} fill="var(--t-fg)" />
              <rect x={116} y={77} width={8} height={22} fill="var(--t-fg)" />
              <rect x={66} y={78} width={10} height={20} fill="var(--t-card-bg)" />
              <circle cx={74} cy={122} r={5} fill="var(--t-card-bg)" />
              <circle cx={90} cy={128} r={5} fill="var(--t-card-bg)" />
            </g>
            {/* strings */}
            <g stroke="var(--t-fg)" strokeWidth={0.9} opacity={0.85}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <path key={i} d={`M71 ${80.5 + i * 3} L 322 ${83 + i * 2.2} L ${378 - i * 2} ${76 + i * 4}`} fill="none" />
              ))}
            </g>
          </svg>
        </Frame>
      );
    case 'none':
      return null;
  }
}

function Cube({ className }: { className: string }) {
  return (
    <span className={className}>
      <span className="obj3d-spin">
        {['front', 'back', 'left', 'right', 'top', 'bottom'].map((f) => (
          <span key={f} className={`cube-face cube-${f}`} />
        ))}
      </span>
    </span>
  );
}

function Globe({ className }: { className: string }) {
  return (
    <span className={className}>
      <span className="obj3d-spin">
        {[0, 30, 60, 90, 120, 150].map((a) => (
          <span key={a} className="globe-ring" style={{ transform: `rotateY(${a}deg)` }} />
        ))}
        <span className="globe-ring globe-eq" />
      </span>
    </span>
  );
}

// static dotted sphere (plain view / reduced motion)
const SPHERE_STATIC = (() => {
  const n = 900;
  const pts: { x: number; y: number; r: number; o: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * rad;
    const z = Math.sin(th) * rad;
    const y2 = y * Math.cos(0.35) - z * Math.sin(0.35);
    const z2 = y * Math.sin(0.35) + z * Math.cos(0.35);
    const depth = (z2 + 1) / 2;
    pts.push({ x: r1(200 + x * 150), y: r1(170 + y2 * 150), r: r1(0.5 + depth * 1.8), o: r1(0.1 + depth * 0.9) });
  }
  return pts.sort((a, b) => a.o - b.o);
})();

/** Static stand-in for the WebGL sphere (plain view / reduced motion). */
export function DotSphereStatic({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 340" className={`w-full text-fg ${className}`} aria-hidden>
      {SPHERE_STATIC.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="currentColor" opacity={p.o} />
      ))}
    </svg>
  );
}
