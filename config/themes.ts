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
export type Decoration = 'none' | 'crosshairs' | 'instrument' | 'soft-blobs';
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

  // ───────────────────────────────────────────── 3. Audio / Teenage Engineering-style instrument
  // Warm aluminium grey, black keys, TE orange as the one loud colour; blue / yellow /
  // green only as small knob caps and pictograms.
  audio: {
    id: 'audio',
    label: 'Instrument',
    colors: {
      bg: '#E3E2DE',
      fg: '#1D1D1B',
      muted: '#6F6E69',
      accent1: '#FF5A1F',
      accent2: '#2F6FDE',
      accent3: '#F2BF2F',
      accentText: '#D9430E',
      onAccent1: '#1D1D1B',
      onAccent2: '#FFFFFF',
      onAccent3: '#1D1D1B',
      cardBg: '#F1F0EC',
      border: '#C4C3BE',
      rule: '#D2D1CC',
      texture: 'rgba(29, 29, 27, 0.11)',
      frame: 'rgba(29, 29, 27, 0.14)',
      chipBg: '#1D1D1B',
      chipFg: '#F1F0EC',
      indexBg: '#1D1D1B',
      indexFg: '#F1F0EC',
      tagBorder: '#1D1D1B',
      tagBg: '#2A2A28',
      tagFg: '#F1F0EC',
      tagFilledBg: '#FF5A1F',
      tagFilledFg: '#1D1D1B',
      tagGlow: 'rgba(0,0,0,0)',
      btnBg: '#FF5A1F',
      btnFg: '#1D1D1B',
      navActiveBg: '#FF5A1F',
      navActiveFg: '#1D1D1B',
      navActiveBorder: '#FF5A1F',
    },
    type: {
      display: 'var(--font-outfit), "Helvetica Neue", Arial, sans-serif',
      body: 'var(--font-inter-tight), "Helvetica Neue", Arial, sans-serif',
      mono: 'var(--font-dm-mono), ui-monospace, monospace',
      displayWeight: 300,
      displayTracking: -0.01,
      displayVariation: 'normal',
      bodyWeight: 400,
      bodySize: 15,
      bodyLeading: 1.55,
      monoWeight: 400,
      labelCase: 'uppercase',
      labelTracking: 0.08,
    },
    surface: {
      borderWidth: 1,
      borderStyle: 'solid',
      radius: 6,
      corner: 'square',
      chamfer: 0,
      shadow: { x: 0, y: 14, blur: 28, spread: -14, color: 'rgba(29, 29, 27, 0.32)' },
      insetGlow: { blur: 0, color: 'rgba(0,0,0,0)' },
      shadowSmall: { x: 0, y: 2, blur: 0, spread: 0, color: '#0B0B0A' },
      backdropBlur: 0,
      texture: 'dots',
      ruleWidth: 1,
      tagRadius: 3,
      tagBorderWidth: 1,
      tagGlow: 0,
      btnRadius: 3,
      cardPadding: 'clamp(20px, 2.4vw, 28px)',
      tilt: 0,
      tagTilt: 0,
      sketch: false,
    },
    rail: {
      geometry: 'sine',
      render: 'line',
      width: 3,
      color: '#1D1D1B',
      aheadWidth: 3,
      aheadColor: '#ABAAA5',
      doneStyle: 'solid',
      aheadStyle: 'dotted',
      cap: 'round',
      join: 'round',
      glow: 0,
      glowOpacity: 0,
      dotSpacing: 7,
      nodeOpacity: 0,
      sketch: false,
    },
    rider: {
      // the orange BPM knob
      shape: 'circle',
      size: 24,
      fill: '#FF5A1F',
      outline: '#1D1D1B',
      outlineWidth: 3,
      shadow: { x: 0, y: 3, blur: 6, spread: 0, color: 'rgba(29, 29, 27, 0.35)' },
      glow: none,
      ringColor: 'rgba(0,0,0,0)',
      ringFill: 'rgba(0,0,0,0)',
      ringSize: 40,
      ringWidth: 0,
      effect: 'none',
      labelCase: 'uppercase',
      labelSize: 10,
      labelColor: '#1D1D1B',
    },
    motion: { stationAnimation: 'snap', durationMs: 200, easing: 'steps(3, end)', passedOpacity: 0.45 },
    decoration: 'instrument',
    readout: 'frequency',
    sound: 'velocity-tone',
  },

  // ───────────────────────────────────────────── 4. Human-first / calm, premium
  // Warm cream, large soft colour blooms, frosted cards, an editorial serif,
  // small mono capitals for labels. Nothing sharp, nothing loud.
  human: {
    id: 'human',
    label: 'Human-first',
    colors: {
      bg: '#F6F0E7',
      fg: '#2B2733',
      muted: '#6F6979',
      accent1: '#F3A27C',
      accent2: '#B8A6F0',
      accent3: '#F4CF72',
      accentText: '#6A55B8',
      onAccent1: '#2B2733',
      onAccent2: '#2B2733',
      onAccent3: '#2B2733',
      cardBg: 'rgba(255, 252, 247, 0.78)',
      border: 'rgba(255, 255, 255, 0.85)',
      rule: 'rgba(43, 39, 51, 0.08)',
      texture: 'rgba(43, 39, 51, 0.04)',
      frame: 'rgba(0,0,0,0)',
      chipBg: 'rgba(255, 255, 255, 0.7)',
      chipFg: '#2B2733',
      indexBg: 'rgba(184, 166, 240, 0.22)',
      indexFg: '#4A3D80',
      tagBorder: 'rgba(43, 39, 51, 0.08)',
      tagBg: 'rgba(255, 255, 255, 0.62)',
      tagFg: '#4A4458',
      tagFilledBg: 'rgba(184, 166, 240, 0.28)',
      tagFilledFg: '#2B2733',
      tagGlow: 'rgba(0,0,0,0)',
      btnBg: '#FFFFFF',
      btnFg: '#2B2733',
      navActiveBg: '#FFFFFF',
      navActiveFg: '#2B2733',
      navActiveBorder: 'rgba(43, 39, 51, 0.08)',
    },
    type: {
      display: 'var(--font-fraunces), Georgia, serif',
      body: 'var(--font-atkinson), "Nunito", system-ui, sans-serif',
      mono: 'var(--font-dm-mono), ui-monospace, monospace',
      displayWeight: 400,
      displayTracking: -0.015,
      displayVariation: '"SOFT" 30, "WONK" 0, "opsz" 96',
      bodyWeight: 400,
      bodySize: 17,
      bodyLeading: 1.7,
      monoWeight: 400,
      labelCase: 'uppercase',
      labelTracking: 0.14,
    },
    surface: {
      borderWidth: 1,
      borderStyle: 'solid',
      radius: 22,
      corner: 'square',
      chamfer: 0,
      shadow: { x: 0, y: 24, blur: 60, spread: -18, color: 'rgba(120, 88, 60, 0.18)' },
      insetGlow: { blur: 0, color: 'rgba(0,0,0,0)' },
      shadowSmall: { x: 0, y: 8, blur: 24, spread: -8, color: 'rgba(120, 88, 60, 0.22)' },
      backdropBlur: 0,
      texture: 'none',
      ruleWidth: 1,
      tagRadius: 999,
      tagBorderWidth: 1,
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
      width: 4,
      color: '#EFA184',
      aheadWidth: 4,
      aheadColor: 'rgba(43, 39, 51, 0.09)',
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
      // a soft glowing orb
      shape: 'circle',
      size: 22,
      fill: '#C8B8F6',
      outline: 'rgba(255, 255, 255, 0.95)',
      outlineWidth: 3,
      shadow: { x: 0, y: 6, blur: 16, spread: 0, color: 'rgba(106, 85, 184, 0.25)' },
      glow: { x: 0, y: 0, blur: 28, spread: 6, color: 'rgba(184, 166, 240, 0.55)' },
      ringColor: 'rgba(0,0,0,0)',
      ringFill: 'rgba(184, 166, 240, 0.18)',
      ringSize: 54,
      ringWidth: 0,
      effect: 'breathe',
      labelCase: 'none',
      labelSize: 12,
      labelColor: '#4A4458',
    },
    motion: { stationAnimation: 'soft-rise', durationMs: 800, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', passedOpacity: 0.5 },
    decoration: 'soft-blobs',
    readout: 'friendly',
    sound: 'pencil',
  },
};
