/**
 * THEMES
 * ------
 * Every visual decision that may change between chapters lives here as a token.
 * Tokens are pushed to CSS variables on the stage (see `themeToCssVars`), so a
 * chapter switch is just "write a new set of variables" — later this can be an
 * interpolation between two themes instead of a hard swap.
 *
 * To add a theme: add its id to `ThemeId`, add an object to `themes`,
 * reference it from a chapter in `config/content.ts`.
 */

export type ThemeId = 'brutalist'; // later: | 'soft' | 'sketch'

/** How the rail is generated for chapters using this theme (see lib/rail/geometry.ts). */
export type PathGeometry = 'orthogonal' | 'curved' | 'hand-drawn';

/** How stations enter when the rider approaches (see .station rules in app/globals.css). */
export type StationAnimation = 'snap' | 'slide' | 'glitch' | 'soft';

export interface Theme {
  id: ThemeId;
  label: string;
  colors: {
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    grid: string;
    accent1: string;
    accent2: string;
    accent3: string;
    rider: string;
  };
  fonts: { display: string; body: string; mono: string };
  line: {
    width: number;
    color: string;
    aheadWidth: number;
    aheadColor: string;
    /** SVG stroke-dasharray for the part of the rail not yet travelled. */
    aheadDash: string;
    cap: 'butt' | 'round' | 'square';
    join: 'miter' | 'round' | 'bevel';
  };
  border: { width: number; style: 'solid' | 'dashed' | 'dotted'; color: string };
  radius: number;
  shadow: string;
  shadowSmall: string;
  station: {
    animation: StationAnimation;
    durationMs: number;
    easing: string;
    passedOpacity: number;
  };
  geometry: PathGeometry;
  grid: { size: number; lineWidth: number };
}

export const themes: Record<ThemeId, Theme> = {
  brutalist: {
    id: 'brutalist',
    label: 'Brutalist',
    colors: {
      background: '#F1F0EC',
      surface: '#F1F0EC',
      foreground: '#0A0A0A',
      muted: '#5C5C57',
      grid: 'rgba(10, 10, 10, 0.075)',
      accent1: '#E8FF00',
      accent2: '#2B2BFF',
      accent3: '#FF3B00',
      rider: '#FF3B00',
    },
    fonts: {
      display: 'var(--font-archivo-black), "Arial Black", Impact, sans-serif',
      body: 'var(--font-space-grotesk), system-ui, sans-serif',
      mono: 'var(--font-jetbrains-mono), ui-monospace, monospace',
    },
    line: {
      width: 8,
      color: '#0A0A0A',
      aheadWidth: 6,
      aheadColor: '#B4B3AE',
      aheadDash: '16 10',
      cap: 'butt',
      join: 'miter',
    },
    border: { width: 3, style: 'solid', color: '#0A0A0A' },
    radius: 0,
    shadow: '8px 8px 0 #0A0A0A',
    shadowSmall: '4px 4px 0 #0A0A0A',
    station: { animation: 'glitch', durationMs: 240, easing: 'steps(4, end)', passedOpacity: 0.4 },
    geometry: 'orthogonal',
    grid: { size: 44, lineWidth: 1 },
  },
};

export function themeToCssVars(t: Theme): Record<string, string> {
  return {
    '--t-bg': t.colors.background,
    '--t-surface': t.colors.surface,
    '--t-fg': t.colors.foreground,
    '--t-muted': t.colors.muted,
    '--t-grid': t.colors.grid,
    '--t-accent-1': t.colors.accent1,
    '--t-accent-2': t.colors.accent2,
    '--t-accent-3': t.colors.accent3,
    '--t-rider': t.colors.rider,
    '--t-font-display': t.fonts.display,
    '--t-font-body': t.fonts.body,
    '--t-font-mono': t.fonts.mono,
    '--t-line-width': `${t.line.width}px`,
    '--t-line-color': t.line.color,
    '--t-line-ahead-width': `${t.line.aheadWidth}px`,
    '--t-line-ahead-color': t.line.aheadColor,
    '--t-line-ahead-dash': t.line.aheadDash,
    '--t-line-cap': t.line.cap,
    '--t-line-join': t.line.join,
    '--t-border-width': `${t.border.width}px`,
    '--t-border-style': t.border.style,
    '--t-border-color': t.border.color,
    '--t-radius': `${t.radius}px`,
    '--t-shadow': t.shadow,
    '--t-shadow-sm': t.shadowSmall,
    '--t-station-duration': `${t.station.durationMs}ms`,
    '--t-station-easing': t.station.easing,
    '--t-station-passed-opacity': String(t.station.passedOpacity),
    '--t-grid-size': `${t.grid.size}px`,
    '--t-grid-line': `${t.grid.lineWidth}px`,
  };
}

/** Imperatively apply a theme to an element (used by the engine on chapter change). */
export function applyTheme(el: HTMLElement, t: Theme): void {
  const vars = themeToCssVars(t);
  for (const key in vars) el.style.setProperty(key, vars[key]);
  el.dataset.theme = t.id;
  el.dataset.anim = t.station.animation;
}
