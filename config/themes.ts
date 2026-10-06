/**
 * THEMES
 * ------
 * A theme controls styling only — never layout. Every value here becomes a
 * CSS variable (see lib/theme/tokens.ts). Components read variables, so the
 * same card / header / nav / rider restyle when the variables change.
 *
 * - Stage chrome (background, texture, rail, rider, header, HUD, decorations)
 *   gets a BLENDED set of variables that follows the rider's progress.
 * - Each station card is scoped to its own chapter's theme (class `theme-<id>`),
 *   so card sizes never change mid-scroll and positions stay stable.
 *
 * To add a theme: add the id to `THEME_IDS`, add an object to `themes`, load its
 * fonts in app/layout.tsx, point a chapter at it in config/content.ts.
 */

export const THEME_IDS = ['brutalist', 'dark3d', 'audio', 'human'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type PathGeometry = 'orthogonal' | 'sine' | 'smooth';
/** `dotted-matrix` draws the whole rail as a row of dots (traveled dots bigger/brighter). */
export type RailRender = 'line' | 'dotted-matrix';
/** 'pencil' = irregular sketchy dash. */
export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'glow' | 'pencil';
export type RiderShape = 'square' | 'circle' | 'blob';
export type RiderEffect = 'blink' | 'glow-pulse' | 'breathe' | 'jitter' | 'none';
export type StationAnimation = 'glitch' | 'snap' | 'fade-glow' | 'soft-rise' | 'stamp';
export type Texture = 'grid' | 'dots' | 'scanlines' | 'halftone' | 'none';
export type Corner = 'square' | 'chamfer';
export type Readout = 'coords' | 'frequency' | 'friendly';
export type Decoration = 'none' | 'crosshairs' | 'synth' | 'soft-blobs';
/** Rail sound engine (lib/sound/engines). */
export type SoundEngineId = 'ratchet' | 'bass-dots' | 'velocity-tone' | 'pencil';
export type TextCase = 'uppercase' | 'lowercase' | 'none';

export const TEXTURES = ['grid', 'dots', 'scanlines', 'halftone'] as const;

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  colors: {
    bg: string;
    fg: string;
    muted: string;
    accent1: string;
    accent2: string;
    accent3: string;
    /** Accent used for text — must pass AA on bg/cardBg. */
    accentText: string;
    onAccent1: string;
    onAccent2: string;
    onAccent3: string;
    cardBg: string;
    border: string;
    /** Thin rules: header/HUD lines, list dividers. */
    rule: string;
    /** Background texture ink. */
    texture: string;
    /** Vertical frame lines of the stage. */
    frame: string;
    /** Chapter chips (rail dividers, plain view headings). */
    chipBg: string;
    chipFg: string;
    /** Numbered index chips in lists. */
    indexBg: string;
    indexFg: string;
    tagBorder: string;
    tagBg: string;
    tagFg: string;
    tagFilledBg: string;
    tagFilledFg: string;
    tagGlow: string;
    btnBg: string;
    btnFg: string;
    navActiveBg: string;
    navActiveFg: string;
    navActiveBorder: string;
  };
  type: {
    display: string;
    body: string;
    mono: string;
    displayWeight: number;
    /** em */
    displayTracking: number;
    displayVariation: string;
    bodyWeight: number;
    /** px */
    bodySize: number;
    bodyLeading: number;
    monoWeight: number;
    labelCase: TextCase;
    /** em */
    labelTracking: number;
  };
  surface: {
    borderWidth: number;
    borderStyle: 'solid' | 'dashed' | 'dotted';
    radius: number;
    corner: Corner;
    chamfer: number;
    shadow: Shadow;
    /** Inner glow (survives the chamfer clip-path). */
    insetGlow: { blur: number; color: string };
    shadowSmall: Shadow;
    backdropBlur: number;
    texture: Texture;
    ruleWidth: number;
    tagRadius: number;
    tagBorderWidth: number;
    tagGlow: number;
    btnRadius: number;
    /** CSS length for card padding. */
    cardPadding: string;
    /** Max random rotation of cards / tags (deg) — sticker look. Transform only, layout unchanged. */
    tilt: number;
    tagTilt: number;
    /** Hand-drawn outlines: card border is redrawn through an SVG displacement filter. */
    sketch: boolean;
  };
  rail: {
    geometry: PathGeometry;
    render: RailRender;
    width: number;
    color: string;
    aheadWidth: number;
    aheadColor: string;
    doneStyle: StrokeStyle;
    aheadStyle: StrokeStyle;
    cap: 'butt' | 'round' | 'square';
    join: 'miter' | 'round' | 'bevel';
    /** Extra halo width each side (px) when doneStyle is 'glow'. */
    glow: number;
    glowOpacity: number;
    /** Gap between dots for dotted styles. */
    dotSpacing: number;
    /** Corner markers + coordinate labels (orthogonal chapters). */
    nodeOpacity: number;
    /** Marker look: geometry wobble + a second offset stroke. */
    sketch: boolean;
  };
  rider: {
    shape: RiderShape;
    size: number;
    fill: string;
    outline: string;
    outlineWidth: number;
    shadow: Shadow;
    glow: Shadow;
    ringColor: string;
    ringFill: string;
    ringSize: number;
    ringWidth: number;
    effect: RiderEffect;
    labelCase: TextCase;
    labelSize: number;
    labelColor: string;
  };
  motion: {
    stationAnimation: StationAnimation;
    durationMs: number;
    easing: string;
    passedOpacity: number;
  };
  decoration: Decoration;
  readout: Readout;
  sound: SoundEngineId;
}

const none: Shadow = { x: 0, y: 0, blur: 0, spread: 0, color: 'rgba(0,0,0,0)' };

export const themes: Record<ThemeId, Theme> = {
  // ───────────────────────────────────────────── 1. General / brutalist
  brutalist: {
    id: 'brutalist',
    label: 'Brutalist',
    colors: {
      bg: '#F1F0EC',
      fg: '#0A0A0A',
      muted: '#5C5C57',
      accent1: '#E8FF00',
      accent2: '#2B2BFF',
      accent3: '#FF3B00',
      accentText: '#2B2BFF',
      onAccent1: '#0A0A0A',
      onAccent2: '#F1F0EC',
      onAccent3: '#0A0A0A',
      cardBg: '#F1F0EC',
      border: '#0A0A0A',
      rule: '#0A0A0A',
      texture: 'rgba(10, 10, 10, 0.075)',
      frame: 'rgba(10, 10, 10, 0.6)',
      chipBg: '#0A0A0A',
      chipFg: '#E8FF00',
      indexBg: '#E8FF00',
      indexFg: '#0A0A0A',
      tagBorder: '#0A0A0A',
      tagBg: 'rgba(0,0,0,0)',
      tagFg: '#0A0A0A',
      tagFilledBg: '#0A0A0A',
      tagFilledFg: '#F1F0EC',
      tagGlow: 'rgba(0,0,0,0)',
      btnBg: '#E8FF00',
      btnFg: '#0A0A0A',
      navActiveBg: '#E8FF00',
      navActiveFg: '#0A0A0A',
      navActiveBorder: '#0A0A0A',
    },
    type: {
      display: 'var(--font-archivo-black), "Arial Black", Impact, sans-serif',
      body: 'var(--font-space-grotesk), system-ui, sans-serif',
      mono: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      displayWeight: 400,
      displayTracking: -0.01,
      displayVariation: 'normal',
      bodyWeight: 400,
      bodySize: 15,
      bodyLeading: 1.6,
      monoWeight: 400,
      labelCase: 'uppercase',
      labelTracking: 0.12,
    },
    surface: {
      borderWidth: 3,
      borderStyle: 'solid',
      radius: 0,
      corner: 'square',
      chamfer: 0,
      shadow: { x: 8, y: 8, blur: 0, spread: 0, color: '#0A0A0A' },
      insetGlow: { blur: 0, color: 'rgba(0,0,0,0)' },
      shadowSmall: { x: 4, y: 4, blur: 0, spread: 0, color: '#0A0A0A' },
      backdropBlur: 0,
      texture: 'grid',
      ruleWidth: 2,
      tagRadius: 0,
      tagBorderWidth: 2,
      tagGlow: 0,
      btnRadius: 0,
      cardPadding: 'clamp(20px, 2.4vw, 28px)',
      tilt: 0,
      tagTilt: 0,
      sketch: false,
    },
    rail: {
      geometry: 'orthogonal',
      render: 'line',
      width: 8,
      color: '#0A0A0A',
      aheadWidth: 6,
      aheadColor: '#B4B3AE',
      doneStyle: 'solid',
      aheadStyle: 'dashed',
      cap: 'butt',
      join: 'miter',
      glow: 0,
      glowOpacity: 0,
      dotSpacing: 14,
      nodeOpacity: 1,
      sketch: false,
    },
    rider: {
      shape: 'square',
      size: 22,
      fill: '#FF3B00',
      outline: '#0A0A0A',
      outlineWidth: 3,
      shadow: { x: 3, y: 3, blur: 0, spread: 0, color: '#0A0A0A' },
      glow: none,
      ringColor: 'rgba(180, 179, 174, 0)',
      ringFill: 'rgba(241, 240, 236, 0)',
      ringSize: 46,
      ringWidth: 2,
      effect: 'none',
      labelCase: 'uppercase',
      labelSize: 9,
      labelColor: '#0A0A0A',
    },
    motion: { stationAnimation: 'glitch', durationMs: 240, easing: 'steps(4, end)', passedOpacity: 0.4 },
    decoration: 'none',
    readout: 'coords',
    sound: 'ratchet',
  },

  // ───────────────────────────────────────────── 2. 3D / dark generative brutalism
  dark3d: {
    id: 'dark3d',
    label: 'Dark generative',
    colors: {
      bg: '#161616',
      fg: '#EDEDED',
      muted: '#8E8E8E',
      accent1: '#EDEDED',
      accent2: '#9A9A9A',
      accent3: '#5A5A5A',
      accentText: '#EDEDED',
      onAccent1: '#161616',
      onAccent2: '#161616',
      onAccent3: '#EDEDED',
      cardBg: 'rgba(22, 22, 22, 0.92)',
      border: 'rgba(237, 237, 237, 0.45)',
      rule: 'rgba(237, 237, 237, 0.22)',
      texture: 'rgba(237, 237, 237, 0.05)',
      frame: 'rgba(237, 237, 237, 0.14)',
      chipBg: '#EDEDED',
      chipFg: '#161616',
      indexBg: 'rgba(0,0,0,0)',
      indexFg: '#EDEDED',
      tagBorder: 'rgba(237, 237, 237, 0.35)',
      tagBg: 'rgba(0,0,0,0)',
      tagFg: '#CFCFCF',
      tagFilledBg: '#EDEDED',
      tagFilledFg: '#161616',
      tagGlow: 'rgba(0,0,0,0)',
      btnBg: 'rgba(0,0,0,0)',
      btnFg: '#EDEDED',
      navActiveBg: 'rgba(0,0,0,0)',
      navActiveFg: '#EDEDED',
      navActiveBorder: 'rgba(237, 237, 237, 0.7)',
    },
    type: {
      display: 'var(--font-inter-tight), "Helvetica Neue", Arial, sans-serif',
      body: 'var(--font-inter-tight), "Helvetica Neue", Arial, sans-serif',
      mono: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      displayWeight: 700,
      displayTracking: -0.035,
      displayVariation: 'normal',
      bodyWeight: 400,
      bodySize: 14,
      bodyLeading: 1.6,
      monoWeight: 400,
      labelCase: 'lowercase',
      labelTracking: 0.02,
    },
    surface: {
      borderWidth: 1,
      borderStyle: 'solid',
      radius: 0,
      corner: 'square',
      chamfer: 0,
      shadow: { x: 0, y: 0, blur: 0, spread: 0, color: 'rgba(0,0,0,0)' },
      insetGlow: { blur: 0, color: 'rgba(0,0,0,0)' },
      shadowSmall: { x: 0, y: 0, blur: 0, spread: 0, color: 'rgba(0,0,0,0)' },
      backdropBlur: 0,
      texture: 'none',
      ruleWidth: 1,
      tagRadius: 0,
      tagBorderWidth: 1,
      tagGlow: 0,
      btnRadius: 0,
      cardPadding: 'clamp(20px, 2.4vw, 28px)',
      tilt: 0,
      tagTilt: 0,
      sketch: false,
    },
    rail: {
      geometry: 'orthogonal',
      render: 'dotted-matrix',
      width: 6,
      color: '#F4F4F4',
      aheadWidth: 3,
      aheadColor: 'rgba(244, 244, 244, 0.28)',
      doneStyle: 'dotted',
      aheadStyle: 'dotted',
      cap: 'round',
      join: 'round',
      glow: 0,
      glowOpacity: 0,
      dotSpacing: 14,
      nodeOpacity: 0.45,
      sketch: false,
    },
    rider: {
      shape: 'square',
      size: 14,
      fill: 'rgba(0,0,0,0)',
      outline: '#F4F4F4',
      outlineWidth: 1.5,
      shadow: none,
      glow: none,
      ringColor: 'rgba(244, 244, 244, 0.5)',
      ringFill: 'rgba(0,0,0,0)',
      ringSize: 34,
      ringWidth: 1,
      effect: 'none',
      labelCase: 'lowercase',
      labelSize: 10,
      labelColor: '#BDBDBD',
    },
    motion: { stationAnimation: 'snap', durationMs: 220, easing: 'steps(3, end)', passedOpacity: 0.35 },
    decoration: 'crosshairs',
    readout: 'coords',
    sound: 'bass-dots',
  },

  // ───────────────────────────────────────────── 3. Audio / FM synth night
  // Minimal neon on near-black: cyan signal, a touch of pink, cream panel text (DX7 keys).
  audio: {
    id: 'audio',
    label: 'FM synth',
    colors: {
      bg: '#0A0C10',
      fg: '#E9E4D8',
      muted: '#808A96',
      accent1: '#2EF2DF',
      accent2: '#FF4DA6',
      accent3: '#8F7CFF',
      accentText: '#2EF2DF',
      onAccent1: '#0A0C10',
      onAccent2: '#0A0C10',
      onAccent3: '#0A0C10',
      cardBg: '#0F1318',
      border: 'rgba(46, 242, 223, 0.32)',
      rule: 'rgba(233, 228, 216, 0.12)',
      texture: 'rgba(46, 242, 223, 0.045)',
      frame: 'rgba(46, 242, 223, 0.18)',
      chipBg: '#0F1318',
      chipFg: '#2EF2DF',
      indexBg: 'rgba(46, 242, 223, 0.12)',
      indexFg: '#2EF2DF',
      tagBorder: 'rgba(46, 242, 223, 0.4)',
      tagBg: 'rgba(0, 0, 0, 0)',
      tagFg: '#2EF2DF',
      tagFilledBg: '#2EF2DF',
      tagFilledFg: '#0A0C10',
      tagGlow: 'rgba(46, 242, 223, 0.3)',
      btnBg: 'rgba(46, 242, 223, 0.1)',
      btnFg: '#2EF2DF',
      navActiveBg: 'rgba(46, 242, 223, 0.1)',
      navActiveFg: '#2EF2DF',
      navActiveBorder: '#2EF2DF',
    },
    type: {
      display: 'var(--font-michroma), "Eurostile", "Arial Black", sans-serif',
      body: 'var(--font-plex-sans), system-ui, sans-serif',
      mono: 'var(--font-plex-mono), ui-monospace, monospace',
      displayWeight: 400,
      displayTracking: 0.01,
      displayVariation: 'normal',
      bodyWeight: 400,
      bodySize: 15,
      bodyLeading: 1.6,
      monoWeight: 400,
      labelCase: 'uppercase',
      labelTracking: 0.2,
    },
    surface: {
      borderWidth: 1,
      borderStyle: 'solid',
      radius: 4,
      corner: 'square',
      chamfer: 0,
      shadow: { x: 0, y: 0, blur: 36, spread: 0, color: 'rgba(46, 242, 223, 0.09)' },
      insetGlow: { blur: 0, color: 'rgba(0,0,0,0)' },
      shadowSmall: { x: 0, y: 0, blur: 14, spread: 0, color: 'rgba(46, 242, 223, 0.22)' },
      backdropBlur: 0,
      texture: 'grid',
      ruleWidth: 1,
      tagRadius: 2,
      tagBorderWidth: 1,
      tagGlow: 0,
      btnRadius: 2,
      cardPadding: 'clamp(20px, 2.4vw, 28px)',
      tilt: 0,
      tagTilt: 0,
      sketch: false,
    },
    rail: {
      geometry: 'sine',
      render: 'line',
      width: 2.5,
      color: '#2EF2DF',
      aheadWidth: 1.5,
      aheadColor: 'rgba(46, 242, 223, 0.22)',
      doneStyle: 'glow',
      aheadStyle: 'solid',
      cap: 'round',
      join: 'round',
      glow: 5,
      glowOpacity: 0.2,
      dotSpacing: 10,
      nodeOpacity: 0,
      sketch: false,
    },
    rider: {
      shape: 'circle',
      size: 12,
      fill: '#E9E4D8',
      outline: '#2EF2DF',
      outlineWidth: 2,
      shadow: none,
      glow: { x: 0, y: 0, blur: 16, spread: 2, color: 'rgba(46, 242, 223, 0.75)' },
      ringColor: 'rgba(46, 242, 223, 0.55)',
      ringFill: 'rgba(0, 0, 0, 0)',
      ringSize: 30,
      ringWidth: 1,
      effect: 'glow-pulse',
      labelCase: 'uppercase',
      labelSize: 10,
      labelColor: '#2EF2DF',
    },
    motion: { stationAnimation: 'fade-glow', durationMs: 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', passedOpacity: 0.4 },
    decoration: 'synth',
    readout: 'frequency',
    sound: 'velocity-tone',
  },

  // ───────────────────────────────────────────── 4. Human-first / soft
  human: {
    id: 'human',
    label: 'Human-first',
    colors: {
      bg: '#FBF6EE',
      fg: '#2F2A3B',
      muted: '#5E586D',
      accent1: '#F6C9B4',
      accent2: '#CBBEF0',
      accent3: '#B9D8C2',
      accentText: '#5B4A9A',
      onAccent1: '#2F2A3B',
      onAccent2: '#2F2A3B',
      onAccent3: '#2F2A3B',
      cardBg: '#FFFDF9',
      border: '#EDE4F4',
      rule: '#E9E1D6',
      texture: 'rgba(91, 74, 154, 0.07)',
      frame: 'rgba(0,0,0,0)',
      chipBg: '#E6F0E8',
      chipFg: '#2F4A39',
      indexBg: '#EFE9FB',
      indexFg: '#4A3D80',
      tagBorder: 'rgba(0,0,0,0)',
      tagBg: '#F1ECFA',
      tagFg: '#3F3566',
      tagFilledBg: '#E3F0E6',
      tagFilledFg: '#2F4A39',
      tagGlow: 'rgba(0,0,0,0)',
      btnBg: '#F6C9B4',
      btnFg: '#2F2A3B',
      navActiveBg: '#EFE9FB',
      navActiveFg: '#2F2A3B',
      navActiveBorder: 'rgba(0,0,0,0)',
    },
    type: {
      display: 'var(--font-fraunces), Georgia, serif',
      body: 'var(--font-atkinson), "Nunito", system-ui, sans-serif',
      mono: 'var(--font-atkinson), "Nunito", system-ui, sans-serif',
      displayWeight: 500,
      displayTracking: -0.01,
      displayVariation: '"SOFT" 100, "WONK" 0',
      bodyWeight: 400,
      bodySize: 17,
      bodyLeading: 1.7,
      monoWeight: 400,
      labelCase: 'none',
      labelTracking: 0,
    },
    surface: {
      borderWidth: 1,
      borderStyle: 'solid',
      radius: 24,
      corner: 'square',
      chamfer: 0,
      shadow: { x: 0, y: 14, blur: 40, spread: -10, color: 'rgba(84, 64, 130, 0.16)' },
      insetGlow: { blur: 0, color: 'rgba(0,0,0,0)' },
      shadowSmall: { x: 0, y: 6, blur: 18, spread: -6, color: 'rgba(84, 64, 130, 0.22)' },
      backdropBlur: 0,
      texture: 'dots',
      ruleWidth: 1,
      tagRadius: 999,
      tagBorderWidth: 0,
      tagGlow: 0,
      btnRadius: 999,
      cardPadding: 'clamp(24px, 3vw, 36px)',
      tilt: 0,
      tagTilt: 0,
      sketch: false,
    },
    rail: {
      geometry: 'smooth',
      render: 'line',
      width: 7,
      color: '#A9CBB3',
      aheadWidth: 7,
      aheadColor: '#E3EEE5',
      doneStyle: 'solid',
      aheadStyle: 'solid',
      cap: 'round',
      join: 'round',
      glow: 0,
      glowOpacity: 0,
      dotSpacing: 14,
      nodeOpacity: 0,
      sketch: false,
    },
    rider: {
      shape: 'blob',
      size: 26,
      fill: '#F4B79F',
      outline: 'rgba(255,255,255,0.9)',
      outlineWidth: 3,
      shadow: { x: 0, y: 6, blur: 16, spread: 0, color: 'rgba(84, 64, 130, 0.22)' },
      glow: none,
      ringColor: 'rgba(0,0,0,0)',
      ringFill: 'rgba(244, 183, 159, 0.22)',
      ringSize: 56,
      ringWidth: 0,
      effect: 'breathe',
      labelCase: 'none',
      labelSize: 12,
      labelColor: '#4A4458',
    },
    motion: { stationAnimation: 'soft-rise', durationMs: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', passedOpacity: 0.55 },
    decoration: 'soft-blobs',
    readout: 'friendly',
    sound: 'pencil',
  },
};
