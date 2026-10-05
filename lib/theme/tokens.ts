/**
 * THEME TOKENS — the single place where themes become CSS variables.
 *
 *   Theme ──flatten──▶ TokenSet {num, color, str} ──render──▶ { '--t-…': value }
 *                          │
 *                blend(a, b, t)   ← driven by rider progress (engine)
 *
 * - num:   lerped (widths, radii, shadow offsets, durations, weights)
 * - color: mixed with `color-mix(in oklch, …)`
 * - str:   non-interpolable (fonts, dash patterns, shapes, animation names…)
 *          switch at t = 0.5 — the engine's veil masks that moment.
 *
 * `--t-w-<themeId>` and `--t-tex-<texture>` are blend weights (0…1), used for
 * cross-fading decoration layers, textures and the 3D canvas by opacity.
 */
import { THEME_IDS, TEXTURES, themes, type StrokeStyle, type Theme, type ThemeId } from '@/config/themes';

export interface TokenSet {
  num: Record<string, number>;
  color: Record<string, string>;
  str: Record<string, string>;
}

const UNITS: Record<string, string> = {
  'display-tracking': 'em',
  'label-tracking': 'em',
  'body-leading': '',
  'rail-glow-opacity': '',
  'rail-node-opacity': '',
  'passed-opacity': '',
  'rail-sketch-opacity': '',
  tilt: 'deg',
  'tag-tilt': 'deg',
  'anim-duration': 'ms',
  duration: 'ms',
};
const unitOf = (k: string) => UNITS[k] ?? (k.startsWith('w-') || k.startsWith('tex-') ? '' : 'px');

const RIDER_RADIUS = { square: '0', circle: '50%', blob: '46% 54% 52% 48% / 55% 45% 55% 45%' } as const;
const RING_ANIM = {
  blink: 'rider-blink 1.4s steps(1, end) infinite',
  'glow-pulse': 'rider-pulse 2.2s ease-out infinite',
  breathe: 'rider-halo 5s ease-in-out infinite',
  jitter: 'none',
  none: 'none',
} as const;
const DOT_ANIM = {
  blink: 'none',
  'glow-pulse': 'none',
  breathe: 'rider-breathe 5s ease-in-out infinite',
  jitter: 'rider-jitter 0.42s steps(3, end) infinite',
  none: 'none',
} as const;
const STATION_ANIM = {
  glitch: { name: 'station-glitch', timing: 'steps(1, end)', hidden: 'none', durationScale: 1.6 },
  snap: { name: 'none', timing: 'linear', hidden: 'translate3d(0, 16px, 0)', durationScale: 1 },
  'fade-glow': { name: 'station-neon', timing: 'linear', hidden: 'translate3d(0, 8px, 0)', durationScale: 1.4 },
  'soft-rise': { name: 'none', timing: 'linear', hidden: 'translate3d(0, 24px, 0)', durationScale: 1 },
  stamp: { name: 'station-stamp', timing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', hidden: 'none', durationScale: 1.2 },
} as const;

const CHAMFER_CLIP =
  'polygon(var(--t-chamfer) 0, 100% 0, 100% calc(100% - var(--t-chamfer)), calc(100% - var(--t-chamfer)) 100%, 0 100%, 0 var(--t-chamfer))';
const CHAMFER_LINE =
  'linear-gradient(135deg, transparent calc(50% - 0.75px), var(--t-border) calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px))';
const CHAMFER_BG = `${CHAMFER_LINE} top left / var(--t-chamfer) var(--t-chamfer) no-repeat, ${CHAMFER_LINE} bottom right / var(--t-chamfer) var(--t-chamfer) no-repeat`;

const PENCIL_DASH = [9, 4, 2, 5];

function dashArray(style: StrokeStyle, width: number, spacing: number): number[] {
  if (style === 'dashed') return [Math.round(width * 2.6), Math.round(width * 1.6)];
  if (style === 'dotted') return [0, spacing];
  if (style === 'pencil') return PENCIL_DASH;
  return [];
}
function dash(style: StrokeStyle, width: number, spacing: number) {
  const a = dashArray(style, width, spacing);
  return a.length ? a.join(' ') : 'none';
}

/**
 * Period (px of arc length) of the rail's visible pattern — dashes for
 * brutalist, dots for dotted-matrix. Sound engines fire once per period.
 * Uses the pattern the rider rolls over: done style if patterned, else ahead.
 */
export function dashPeriod(t: Theme): number {
  const r = t.rail;
  const done: StrokeStyle = r.render === 'dotted-matrix' ? 'dotted' : r.doneStyle;
  const ahead: StrokeStyle = r.render === 'dotted-matrix' ? 'dotted' : r.aheadStyle;
  const a = dashArray(done, r.width, r.dotSpacing);
  const b = a.length ? a : dashArray(ahead, r.aheadWidth, r.dotSpacing);
  return b.reduce((x, y) => x + y, 0);
}

export function flatten(t: Theme): TokenSet {
  const { colors: c, type: ty, surface: s, rail: r, rider: rd, motion: m } = t;
  const doneStyle: StrokeStyle = r.render === 'dotted-matrix' ? 'dotted' : r.doneStyle;
  const aheadStyle: StrokeStyle = r.render === 'dotted-matrix' ? 'dotted' : r.aheadStyle;
  const anim = STATION_ANIM[m.stationAnimation];

  const num: Record<string, number> = {
    'display-tracking': ty.displayTracking,
    'body-size': ty.bodySize,
    'body-leading': ty.bodyLeading,
    'label-tracking': ty.labelTracking,
    'border-width': s.borderWidth,
    radius: s.radius,
    chamfer: s.chamfer,
    'sh-x': s.shadow.x,
    'sh-y': s.shadow.y,
    'sh-blur': s.shadow.blur,
    'sh-spread': s.shadow.spread,
    'ig-blur': s.insetGlow.blur,
    'shs-x': s.shadowSmall.x,
    'shs-y': s.shadowSmall.y,
    'shs-blur': s.shadowSmall.blur,
    'shs-spread': s.shadowSmall.spread,
    'rule-width': s.ruleWidth,
    'tag-radius': s.tagRadius,
    'tag-border-width': s.tagBorderWidth,
    'tag-glow': s.tagGlow,
    'btn-radius': s.btnRadius,
    'rail-width': r.width,
    'rail-ahead-width': r.aheadWidth,
    'rail-glow-width': r.width + r.glow * 2,
    'rail-glow-opacity': doneStyle === 'glow' ? r.glowOpacity : 0,
    'rail-node-opacity': r.nodeOpacity,
    'rider-size': rd.size,
    'rider-outline-width': rd.outlineWidth,
    'rider-sh-x': rd.shadow.x,
    'rider-sh-y': rd.shadow.y,
    'rider-sh-blur': rd.shadow.blur,
    'rider-glow-blur': rd.glow.blur,
    'rider-glow-spread': rd.glow.spread,
    'ring-size': rd.ringSize,
    'ring-width': rd.ringWidth,
    'rider-label-size': rd.labelSize,
    duration: m.durationMs,
    'anim-duration': m.durationMs * anim.durationScale,
    'passed-opacity': m.passedOpacity,
    tilt: s.tilt,
    'tag-tilt': s.tagTilt,
    'sketch-border-width': s.sketch ? s.borderWidth : 0,
    'rail-sketch-opacity': r.sketch ? 0.5 : 0,
  };
  for (const id of THEME_IDS) num[`w-${id}`] = id === t.id ? 1 : 0;
  for (const tex of TEXTURES) num[`tex-${tex}`] = s.texture === tex ? 1 : 0;

  const color: Record<string, string> = {
    bg: c.bg,
    fg: c.fg,
    muted: c.muted,
    'accent-1': c.accent1,
    'accent-2': c.accent2,
    'accent-3': c.accent3,
    'accent-text': c.accentText,
    'on-accent-1': c.onAccent1,
    'on-accent-2': c.onAccent2,
    'on-accent-3': c.onAccent3,
    'card-bg': c.cardBg,
    border: c.border,
    /** Real CSS border of cards; transparent when the sketch outline replaces it. */
    'card-border': s.sketch ? 'rgba(0,0,0,0)' : c.border,
    rule: c.rule,
    texture: c.texture,
    frame: c.frame,
    'chip-bg': c.chipBg,
    'chip-fg': c.chipFg,
    'index-bg': c.indexBg,
    'index-fg': c.indexFg,
    'tag-border': c.tagBorder,
    'tag-bg': c.tagBg,
    'tag-fg': c.tagFg,
    'tag-filled-bg': c.tagFilledBg,
    'tag-filled-fg': c.tagFilledFg,
    'tag-glow-color': c.tagGlow,
    'btn-bg': c.btnBg,
    'btn-fg': c.btnFg,
    'nav-active-bg': c.navActiveBg,
    'nav-active-fg': c.navActiveFg,
    'nav-active-border': c.navActiveBorder,
    'sh-color': s.shadow.color,
    'ig-color': s.insetGlow.color,
    'shs-color': s.shadowSmall.color,
    'rail-color': r.color,
    'rail-ahead-color': r.aheadColor,
    'rider-fill': rd.fill,
    'rider-outline': rd.outline,
    'rider-sh-color': rd.shadow.color,
    'rider-glow-color': rd.glow.color,
    'ring-color': rd.ringColor,
    'ring-fill': rd.ringFill,
    'rider-label-color': rd.labelColor,
  };

  const str: Record<string, string> = {
    theme: t.id,
    readout: t.readout,
    'font-display': ty.display,
    'font-body': ty.body,
    'font-mono': ty.mono,
    'display-weight': String(ty.displayWeight),
    'display-variation': ty.displayVariation,
    'body-weight': String(ty.bodyWeight),
    'mono-weight': String(ty.monoWeight),
    'label-case': ty.labelCase,
    'border-style': s.borderStyle,
    clip: s.corner === 'chamfer' ? CHAMFER_CLIP : 'none',
    'card-bg-image': s.corner === 'chamfer' ? CHAMFER_BG : 'none',
    backdrop: s.backdropBlur > 0 ? `blur(${s.backdropBlur}px) saturate(1.2)` : 'none',
    'card-pad': s.cardPadding,
    'rail-dash': dash(doneStyle, r.width, r.dotSpacing),
    'rail-ahead-dash': dash(aheadStyle, r.aheadWidth, r.dotSpacing),
    'rail-cap': doneStyle === 'dotted' ? 'round' : r.cap,
    'rail-ahead-cap': aheadStyle === 'dotted' ? 'round' : r.cap,
    'rail-join': r.join,
    'plain-rail-style': doneStyle === 'dotted' ? 'dotted' : doneStyle === 'dashed' ? 'dashed' : 'solid',
    'rider-radius': RIDER_RADIUS[rd.shape],
    'ring-anim': RING_ANIM[rd.effect],
    'dot-anim': DOT_ANIM[rd.effect],
    /** Pre-baked hand-drawn outline layer (no live SVG filters). */
    'sketch-display': s.sketch ? 'block' : 'none',
    'rider-label-case': rd.labelCase,
    'anim-name': anim.name,
    'anim-timing': anim.timing,
    'hidden-transform': anim.hidden,
    easing: m.easing,
  };

  return { num, color, str };
}

const cache = new Map<ThemeId, TokenSet>();
export function tokensOf(id: ThemeId): TokenSet {
  let ts = cache.get(id);
  if (!ts) {
    ts = flatten(themes[id]);
    cache.set(id, ts);
  }
  return ts;
}

/**
 * Tokens that are expensive to repaint while changing (shadows, glows, blurs).
 * On medium/low tiers they switch at the zone midpoint instead of lerping.
 */
const EXPENSIVE = new Set([
  'sh-x', 'sh-y', 'sh-blur', 'sh-spread', 'sh-color',
  'ig-blur', 'ig-color',
  'shs-x', 'shs-y', 'shs-blur', 'shs-spread', 'shs-color',
  'rider-sh-x', 'rider-sh-y', 'rider-sh-blur', 'rider-sh-color',
  'rider-glow-blur', 'rider-glow-spread', 'rider-glow-color',
  'rail-glow-width', 'rail-glow-opacity', 'tag-glow', 'tag-glow-color',
]);

/** Blend two token sets. t ∈ [0, 1]. `interpolateExpensive=false` steps shadows/glows at 0.5. */
export function blend(a: TokenSet, b: TokenSet, t: number, interpolateExpensive = true): TokenSet {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const num: Record<string, number> = {};
  for (const k in a.num) {
    num[k] = !interpolateExpensive && EXPENSIVE.has(k) ? (t < 0.5 ? a.num[k] : b.num[k]) : a.num[k] + (b.num[k] - a.num[k]) * t;
  }
  const color: Record<string, string> = {};
  const pct = Math.round(t * 1000) / 10;
  for (const k in a.color) {
    const ca = a.color[k];
    const cb = b.color[k];
    if (!interpolateExpensive && EXPENSIVE.has(k)) color[k] = t < 0.5 ? ca : cb;
    else color[k] = ca === cb ? ca : `color-mix(in oklch, ${cb} ${pct}%, ${ca})`;
  }
  return { num, color, str: t < 0.5 ? a.str : b.str };
}

export interface BlendFrame {
  vars: Record<string, string>;
  /** Keys of `vars`, pre-extracted so the hot loop doesn't allocate. */
  keys: string[];
  weights: Record<ThemeId, number>;
  tex: Record<string, number>;
  readout: string;
  theme: string;
}

const blendCache = new Map<string, BlendFrame>();

/**
 * Quantised, cached blend → rendered CSS vars. After the first pass through a
 * zone every step is a Map lookup: zero allocation in the frame loop.
 */
export function blendFrame(from: ThemeId, to: ThemeId, t: number, steps: number, interpolateExpensive: boolean): BlendFrame {
  const q = from === to ? 0 : Math.round(Math.max(0, Math.min(1, t)) * steps);
  const key = `${from}|${to}|${q}|${steps}|${interpolateExpensive ? 1 : 0}`;
  let f = blendCache.get(key);
  if (!f) {
    const ts = q === 0 ? tokensOf(from) : blend(tokensOf(from), tokensOf(to), q / steps, interpolateExpensive);
    const vars = render(ts);
    const weights = {} as Record<ThemeId, number>;
    for (const id of THEME_IDS) weights[id] = ts.num[`w-${id}`];
    const tex: Record<string, number> = {};
    for (const x of TEXTURES) tex[x] = ts.num[`tex-${x}`];
    f = { vars, keys: Object.keys(vars), weights, tex, readout: ts.str.readout, theme: ts.str.theme };
    blendCache.set(key, f);
  }
  return f;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** TokenSet → CSS custom properties (incl. composite shadows). */
export function render(ts: TokenSet): Record<string, string> {
  const out: Record<string, string> = {};
  const { num: n, color: c, str: s } = ts;
  for (const k in n) out[`--t-${k}`] = `${r3(n[k])}${unitOf(k)}`;
  for (const k in c) out[`--t-${k}`] = c[k];
  for (const k in s) if (k !== 'theme' && k !== 'readout') out[`--t-${k}`] = s[k];

  out['--t-shadow'] =
    `${r3(n['sh-x'])}px ${r3(n['sh-y'])}px ${r3(n['sh-blur'])}px ${r3(n['sh-spread'])}px ${c['sh-color']}, ` +
    `inset 0 0 ${r3(n['ig-blur'])}px ${c['ig-color']}`;
  out['--t-shadow-sm'] = `${r3(n['shs-x'])}px ${r3(n['shs-y'])}px ${r3(n['shs-blur'])}px ${r3(n['shs-spread'])}px ${c['shs-color']}`;
  out['--t-rider-shadow'] =
    `${r3(n['rider-sh-x'])}px ${r3(n['rider-sh-y'])}px ${r3(n['rider-sh-blur'])}px ${c['rider-sh-color']}, ` +
    `0 0 ${r3(n['rider-glow-blur'])}px ${r3(n['rider-glow-spread'])}px ${c['rider-glow-color']}`;
  out['--t-tag-shadow'] = `0 0 ${r3(n['tag-glow'])}px ${c['tag-glow-color']}`;
  return out;
}

export function themeVars(id: ThemeId): Record<string, string> {
  return render(tokensOf(id));
}

/** `.theme-<id> { --t-…: … }` for every theme — injected once in app/layout.tsx. */
export function themeStylesheet(): string {
  return THEME_IDS.map((id) => {
    const vars = themeVars(id);
    const body = Object.keys(vars)
      .map((k) => `${k}:${vars[k]}`)
      .join(';');
    return `.theme-${id}{${body}}`;
  }).join('\n');
}
