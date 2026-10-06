/**
 * CONTENT + RAIL CONFIG
 * ---------------------
 * Everything you'd want to edit without touching components:
 *   - site meta (header/footer labels)
 *   - railLayout (camera, gaps, scroll speed per breakpoint)
 *   - chapters: theme id, rail geometry params, stations (the content blocks)
 *
 * Station progress values are NOT hand-written: they are derived from the
 * generated path (lib/rail/geometry.ts), so they always line up with the rail.
 * The rail layout itself is generated from `railLayout.seed` + constraints.
 * Order of stations here = order along the rail = DOM reading order.
 */
import type { ThemeId } from './themes';

export type ChapterId =
  | 'intro'
  | 'about'
  | 'projects'
  | 'webgl'
  | 'audio'
  | 'human'
  | 'stack'
  | 'principles'
  | 'contact';
export type AccentKey = 'accent1' | 'accent2' | 'accent3';
/** Desktop card width bucket (see .station[data-size] in globals.css). Mobile is always full-width. */
export type CardSize = 'sm' | 'md' | 'lg';

interface StationBase {
  id: string;
  size?: CardSize;
  /** Mobile reading time override: scroll px of dwell (0 = none). Default: from text length. */
  dwell?: number;
}

export interface IntroStation extends StationBase {
  kind: 'intro';
  eyebrow: string;
  name: string;
  role: string[];
  tagline: string;
  hint: string;
}
export interface TextStation extends StationBase {
  kind: 'text';
  title: string;
  paragraphs: string[];
}
export interface ListStation extends StationBase {
  kind: 'list';
  title: string;
  items: { title: string; text: string }[];
}
export interface ProjectStation extends StationBase {
  kind: 'project';
  title: string;
  type: string;
  description: string;
  stack: string[];
  link: { label: string; href: string };
  /** Optional image path (in /public). Falls back to the brand tile: `color` + icon. */
  image?: string;
  /** Brand colour — background of the "Selected work" tile. */
  color: string;
  /** Optional icon path (in /public), shown inside the tile. Falls back to a square placeholder. */
  icon?: string;
}
export interface StackStation extends StationBase {
  kind: 'stack';
  title: string;
  groups: { label: string; items: string[] }[];
}
export interface PrincipleStation extends StationBase {
  kind: 'principle';
  title: string;
  text: string;
}
/** Inline illustration chosen by content (not by theme). */
export type FeatureVisual = 'dot-sphere' | 'dot-plane' | 'waveform' | 'spectrum' | 'amp' | 'blob' | 'objects-3d' | 'blur-blobs' | 'guitar' | 'none';

/** Generic "title + text + tags + visual" card — used by the themed chapters. */
export interface FeatureStation extends StationBase {
  kind: 'feature';
  title: string;
  text: string;
  tags?: string[];
  visual?: FeatureVisual;
  /** Technologies and the projects (station ids) they were used in. */
  skills?: { name: string; projects: string[] }[];
}
export interface ContactStation extends StationBase {
  kind: 'contact';
  title: string;
  subtitle: string;
  links: { label: string; value: string; href: string }[];
  footer: string;
}

export type Station =
  | IntroStation
  | TextStation
  | ListStation
  | ProjectStation
  | StackStation
  | PrincipleStation
  | FeatureStation
  | ContactStation;

/**
 * Optional per-chapter overrides of the curve params (defaults: railLayout.<mode>.curves).
 * Which ones matter depends on the chapter theme's `rail.geometry`.
 */
export interface ChapterGeometry {
  /** smooth / sine: corner fillet radius. */
  radius: number;
  /** sine: peak offset from the wandering base line. */
  amplitude: number;
  /** sine: full period, px of arc length. */
  wavelength: number;
  /** sine: also run the wave past the stations (default: straight beside each card). For small amplitudes. */
  continuous: boolean;
}

export interface Chapter {
  id: ChapterId;
  title: string;
  theme: ThemeId;
  geometry?: { desktop?: Partial<ChapterGeometry>; mobile?: Partial<ChapterGeometry> };
  /** Optional full-stage WebGL backdrop for this chapter (lazy-loaded). */
  scene?: 'sphere';
  stations: Station[];
}

/** Constraints for the wandering rail planner (lib/rail/geometry.ts). */
export interface WanderConfig {
  /** Half-width of the world the rail may wander in (x ∈ [−W, W]), pre-scale units. */
  halfWidth: number;
  /** Min / max length of one straight run of the base route. */
  minSeg: number;
  maxSeg: number;
  /** Longest allowed upward run. */
  upMax: number;
  /** Relative weights of turn directions (straight runs are decided by `persistence`). */
  dirWeights: { down: number; left: number; right: number; up: number };
  /** Probability that a station continues the current run without turning (0…1). */
  persistence: number;
  /** Hard cap of direction changes per chapter (relaxed only if no layout fits). */
  maxTurnsPerChapter: number;
  /** A run may not turn back into the opposite direction within this arc length (no zig-zag). */
  oscillationGap: number;
  /** Min distance between unrelated rail segments (beyond each segment's curve envelope). */
  railClearance: number;
  /** Min distance between rail and any card (mobile: station markers). */
  cardClearance: number;
  /** Min gap between two cards (mobile: markers). */
  cardSpacing: number;
  /** First run of every chapter is at least this long (chapter label sits on it). */
  chapterLead: number;
  /** Random candidates tried per station (more = better fits, slower build). */
  candidates: number;
  /** Cards taller than this sit beside a vertical run (left/right), never above/below a horizontal one — the rider stays in view. */
  tallCard: number;
}

/** Reading time: extra scroll distance per station during which the rider barely moves. */
export interface DwellConfig {
  enabled: boolean;
  /** Scroll px every station gets. */
  base: number;
  /** + scroll px per character of station text. */
  perChar: number;
  min: number;
  max: number;
  /** Rail px advanced per scroll px inside a dwell (keeps the rider moving, never frozen). */
  creep: number;
}

/**
 * Stops: the rider brakes into every station and pulls away after it (eased
 * scroll ↔ rail mapping), and the page scroll settles on a station when a
 * slow scroll ends near it (CSS scroll-snap, proximity). Fast flings still
 * carry past — snap points are never `scroll-snap-stop: always`.
 */
export interface StopConfig {
  /** Scroll px over which the rider decelerates into a station (0 = no braking). */
  brake: number;
  /** Scroll px over which it accelerates away again (after the reading dwell, if any). */
  release: number;
  /** Rail px per scroll px at the station when there is no dwell (dwell → dwell.creep). */
  creep: number;
  /** Snap the page scroll to stations (proximity — only when a scroll ends near one). */
  snap: boolean;
}

export interface RailLayoutMode {
  /** Where the rider sits in the viewport (mobile: pinned bottom-centre), as fractions of width/height. */
  camera: { x: number; y: number };
  /** Camera leads toward the direction of travel by this fraction of min(vw, vh). */
  lookAhead: number;
  /** Gap between rail and card. */
  cardGap: number;
  /** Reveal a station when the rider is this far before it (fraction of viewport height). */
  revealAhead: number;
  /** Arc length of one rail chunk (own small SVG, culled when off-screen). */
  chunkLength: number;
  /** Scroll distance per 1px of rail (outside dwell ranges). */
  scrollPerPx: number;
  /**
   * World zoom applied when the geometry is rendered (planner works in pre-scale
   * units). Mobile < 1 → the phone screen shows more of the path; stroke widths,
   * dots and markers keep their theme sizes.
   */
  worldScale: number;
  wander: WanderConfig;
  /** Default curve params per geometry type (overridable per chapter). Pre-scale units. */
  curves: ChapterGeometry;
  dwell: DwellConfig;
  stop: StopConfig;
}

/** Mobile layout: one full-screen world, rider bottom-centre, the current station as a centred card above it. CSS reads the sizes as --m-* variables. */
export const mobileLayout = {
  /** Media query that selects the mobile layout (width, portrait tablets, landscape phones). */
  query: '(max-width: 767px), (pointer: coarse) and (orientation: portrait) and (max-width: 1100px), (pointer: coarse) and (max-height: 499px)',
  topBar: '56px',
  /** Side margin of the station panel. */
  panelMargin: '16px',
  /** Max panel width (tablets in portrait). */
  panelMaxWidth: '560px',
  /** Gap between the bottom of the content zone (where cards are centred) and the rider. */
  panelGap: '28px',
  /** The panel fades in this much arc length (screen px) before the rider reaches the station… */
  panelLead: 40,
  /** …and fades out this much arc length after the reading dwell ends. */
  panelHold: 120,
};

export const railLayout: {
  breakpoint: number;
  /** PRNG seed of the wandering rail. Change it to get a different (but stable) layout. */
  seed: number;
  /** Width of the theme blend zone around each chapter boundary, in progress units (0.03 = 3%). */
  transitionZone: number;
  /** How far outside its chapter (progress units) a WebGL scene stays mounted. */
  sceneMargin: number;
  desktop: RailLayoutMode;
  mobile: RailLayoutMode;
} = {
  breakpoint: 768,
  seed: 1032,
  transitionZone: 0.03,
  sceneMargin: 0.04,
  desktop: {
    camera: { x: 0.5, y: 0.5 },
    lookAhead: 0.2,
    cardGap: 72,
    revealAhead: 0.55,
    chunkLength: 1500,
    scrollPerPx: 0.4,
    worldScale: 1,
    wander: {
      halfWidth: 6000,
      minSeg: 1100,
      maxSeg: 2400,
      upMax: 1300,
      dirWeights: { down: 0.4, left: 0.25, right: 0.25, up: 0.1 },
      persistence: 0.6,
      maxTurnsPerChapter: 4,
      oscillationGap: 2600,
      railClearance: 120,
      cardClearance: 56,
      cardSpacing: 48,
      chapterLead: 700,
      candidates: 64,
      tallCard: 400,
    },
    curves: { radius: 280, amplitude: 46, wavelength: 900, continuous: false },
    dwell: { enabled: false, base: 0, perChar: 0, min: 0, max: 0, creep: 1 },
    stop: { brake: 160, release: 140, creep: 0.7, snap: false },
  },
  mobile: {
    // rider pinned bottom-centre; panels open above it
    camera: { x: 0.5, y: 0.82 },
    lookAhead: 0,
    cardGap: 0,
    revealAhead: 0,
    chunkLength: 900,
    scrollPerPx: 0.6,
    worldScale: 0.5,
    wander: {
      halfWidth: 4500,
      minSeg: 1400,
      maxSeg: 3000,
      upMax: 1500,
      dirWeights: { down: 0.3, left: 0.3, right: 0.3, up: 0.1 }, // horizontal runs stay on screen around the pinned rider
      persistence: 0.68,
      maxTurnsPerChapter: 3,
      oscillationGap: 3200,
      railClearance: 220,
      cardClearance: 120,
      cardSpacing: 300,
      chapterLead: 900,
      candidates: 64,
      tallCard: Infinity, // mobile: cards open in the screen-fixed panel, not beside the rail
    },
    curves: { radius: 340, amplitude: 70, wavelength: 1100, continuous: false },
    dwell: { enabled: true, base: 140, perChar: 0.45, min: 160, max: 700, creep: 0.3 },
    stop: { brake: 150, release: 120, creep: 0.3, snap: false },
  },
};

export const site = {
  initials: 'DM',
  descriptor: 'Design & Code',
  issue: 'Portfolio — Vol. 01',
  sideLabel: 'Design × Engineering',
  cta: "Let's talk",
  /** Tiny lowercase caption block shown by the dark3d theme's decoration layer. */
  posterMeta: ['21.10.26', 'rail_poster | chapter no. 04', 'generative surface', 'designed & engineered by dmitriy'],
};

export const chapters: Chapter[] = [
  {
    id: 'intro',
    title: 'Intro',
    theme: 'brutalist',
    stations: [
      {
        id: 'intro',
        kind: 'intro',
        size: 'lg',
        eyebrow: 'Independent design engineer',
        name: 'Dmitriy Popov',
        role: ['Creative UI/UX &', 'High-Performance Frontend'],
        tagline: 'Human-centered design. Engineered to perform.',
        hint: 'Scroll to explore',
      },
    ],
  },
  {
    id: 'about',
    title: 'About',
    theme: 'brutalist',
    stations: [
      {
        id: 'about-bio',
        kind: 'text',
        size: 'lg',
        title: "Hi, I'm Dmitriy.",
        paragraphs: [
          'A Design Engineer and Creative Frontend Developer. I build digital products where high-end visual design meets complex technical architecture.',
          "As both the designer and developer of my projects, I don't just execute technical tasks. My process starts with deeply understanding your goals to find a visual language that reflects the core of your product.",
          'I strive to "humanize" digital experiences – making them empathetic, intuitive, and tactile through an obsessive attention to small details and micro-interactions.',
        ],
      },
      {
        id: 'about-bring',
        kind: 'list',
        size: 'lg',
        title: 'What I bring',
        items: [
          {
            title: 'End-to-End Design & Development',
            text: 'From UX research and Figma prototyping to pixel-perfect code implementation. I ensure the final product looks exactly as intended and feels alive.',
          },
          {
            title: 'Empathetic & Accessible UI',
            text: 'I am aware of a ton of AI-feeling interfaces and striving to humanize the design and UX. I have experience building neuro-inclusive, stress-free interfaces with optimized accessibility (A11y), ensuring your product is comfortable for every user.',
          },
          {
            title: 'Interactive 3D & Web Audio',
            text: 'I use WebGL, Three.js, and Web Audio API not just for decoration, but as meaningful parts of the user experience (e.g., scroll-reactive 3D elements, real-time audio mixers).',
          },
          {
            title: 'High-Performance Architecture',
            text: "Heavy visuals shouldn't mean slow websites. I use modern architectures like Astro (Partial Hydration / Islands) and Next.js to deliver 60FPS animations and Lighthouse 100 scores, even with heavy 3D assets and media grids.",
          },
          {
            title: 'Complex Web Apps',
            text: 'Beyond landing pages, I build robust architectures for SaaS and Web3 platforms (custom visual data trees, interactive timelines, dynamic dashboards).',
          },
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    theme: 'brutalist',
    stations: [
      {
        id: 'project-vortex',
        kind: 'project',
        size: 'md',
        title: 'Vortex Foundation',
        type: 'High-Converting Web3 Corporate Platform',
        description:
          'A premium B2B platform for a crypto market maker. Features scroll-animated chronological timelines, dynamic data counters for business metrics, and ergonomic verification forms.',
        stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'GSAP'],
        link: { label: 'vortex.foundation', href: 'https://vortex.foundation' },
        color: '#91eb44',
      },
      {
        id: 'project-bakery',
        kind: 'project',
        size: 'md',
        title: 'Basic Bakery',
        type: 'B2B E-commerce & Management Ecosystem',
        description:
          'An end-to-end wholesale bakery platform. Features a reactive stateful catalog, dynamic cart calculation, regional logistics validation widget, custom admin dashboard, and Telegram bot integration for staff.',
        stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Node.js'],
        link: { label: 'basicbakery.rs', href: 'https://basicbakery.rs' },
        color: '#e3735a',
      },
    ],
  },
  {
    id: 'webgl',
    title: '3D',
    theme: 'dark3d',
    scene: 'sphere',
    stations: [
      {
        id: 'webgl-tech',
        kind: 'feature',
        size: 'md',
        visual: 'objects-3d',
        title: 'Real-time 3D that stays fast',
        text: 'Scroll-driven scenes, point clouds and custom shaders — shipped with lazy-loaded scenes, capped pixel ratio and render-on-demand loops, so the page keeps 60 fps on phones.',
        skills: [
          { name: 'Three.js', projects: ['project-brumberg', 'project-foam'] },
          { name: 'React Three Fiber', projects: ['project-alevtyna'] },
          { name: 'Spline', projects: ['project-brumberg'] },
          { name: '3D audio scenes', projects: ['project-foam'] },
        ],
      },
      {
        id: 'project-brumberg',
        kind: 'project',
        size: 'md',
        title: 'Matvei Brumberg Portfolio',
        type: 'High-Performance 3D/Motion Designer Portfolio',
        description:
          'A visually expressive portfolio built for heavy media assets. Features optimized media grids with lazy-loading, seamless multi-level infinite marquees, and interactive local-time widgets.',
        stack: ['Next.js', 'Three.js', 'Spline', 'Tailwind CSS'],
        link: { label: 'matveibrumberg.vercel.app', href: 'https://matveibrumberg.vercel.app/' },
        color: '#f7db25',
      },
      {
        id: 'project-foam',
        kind: 'project',
        size: 'md',
        title: 'Foam',
        type: 'Interactive Acoustic & Spatial Audio Simulation & Ear-Training Platform',
        description:
          'Foam is a browser-based acoustic simulation platform that bridges the gap between theoretical spatial audio physics and practical sound production. Designed for sound engineers, producers, and students, the platform allows users to visualize and manipulate sound propagation in a 3D environment with high precision.',
        stack: ['Next.js', 'Supabase', 'Three.js', 'Tone.js', 'Resonance Audio'],
        link: { label: '[PROJECT LINK]', href: '#' },
        color: '#ffffff',
      },
    ],
  },
  {
    id: 'audio',
    title: 'Audio',
    theme: 'audio',
    // a tight, low-amplitude carrier wave
    geometry: { desktop: { amplitude: 15, wavelength: 210, continuous: true }, mobile: { amplitude: 22, wavelength: 260, continuous: true } },
    stations: [
      {
        id: 'audio-tech',
        kind: 'feature',
        size: 'md',
        visual: 'guitar',
        title: 'A musician who codes',
        text: 'I play guitar, so sound is not an abstraction to me: tone, dynamics, harmony, mixing and the feel of an instrument under the fingers. That ear goes into every audio interface I build — synths, mixers and generative scores on the Web Audio API.',
        skills: [
          { name: 'Web Audio API', projects: ['project-sonicdesk', 'project-foam'] },
          { name: 'Tone.js', projects: ['project-sonicdesk', 'project-tower', 'project-mono', 'project-foam'] },
          { name: 'Tonal.js', projects: ['project-tower'] },
          { name: 'Resonance Audio', projects: ['project-foam'] },
          { name: 'Svelte', projects: ['project-mono'] },
        ],
      },
      {
        id: 'project-sonicdesk',
        kind: 'project',
        size: 'md',
        title: 'Sonicdesk',
        type: 'Interactive Audio SaaS for Musicians',
        description:
          'An innovative "Git for music" workspace. Features a custom visual version-control tree, interactive audio mixer with visual diffs, and timeline-based comments tied to musical bars.',
        stack: ['Next.js', 'Web Audio API', 'Tone.js', 'Motion', 'Supabase'],
        link: { label: 'sonicdesk.studio', href: 'https://sonicdesk.studio' },
        color: '#dfff00',
      },
      {
        id: 'project-tower',
        kind: 'project',
        size: 'md',
        title: 'Tower',
        type: 'Generative Ambient Radio for Sleep & Focus',
        description:
          'A browser-based relaxation app that layers archival NASA mission and air-traffic-control radio under a generative ambient score. The aesthetic is a late-night airport: quiet, procedural, never quite silent. Built with Next.js and TypeScript, with a custom audio engine on Tone.js and Tonal.js.',
        stack: ['Next.js', 'TypeScript', 'Tone.js', 'Tonal.js'],
        link: { label: '[PROJECT LINK]', href: '#' },
        color: '#0e1728',
      },
      {
        id: 'project-mono',
        kind: 'project',
        size: 'md',
        title: 'Mono',
        type: 'ASCII Browser Synthesizer',
        description:
          'An ASCII-styled browser-based synthesizer that combines retro-inspired aesthetics with advanced sound design capabilities, allowing users to craft and visualize audio directly in their browser.',
        stack: ['Svelte', 'Tone.js', 'TypeScript'],
        link: { label: 'mono-steel-xi.vercel.app', href: 'https://mono-steel-xi.vercel.app/' },
        color: '#ffffff',
      },
    ],
  },
  {
    id: 'human',
    title: 'Human-first',
    theme: 'human',
    stations: [
      {
        id: 'human-tech',
        kind: 'feature',
        size: 'md',
        visual: 'blur-blobs',
        title: 'Built for people',
        text: 'Accessible, calm interfaces from the first sketch: semantic structure, keyboard paths, readable type and motion that respects the person using it.',
        skills: [
          { name: 'Accessible, neuro-inclusive UI', projects: ['project-alevtyna'] },
          { name: 'Astro Islands', projects: ['project-alevtyna'] },
          { name: 'Framer Motion', projects: ['project-alevtyna', 'project-vortex'] },
        ],
      },
      {
        id: 'project-alevtyna',
        kind: 'project',
        size: 'md',
        title: 'Alevtyna Yakovleva',
        type: 'Neuro-Inclusive Psychologist Website',
        description:
          'An empathetic, accessible landing page focusing on user psychological comfort. Features interactive 3D WebGL elements that react to scroll, built on Astro Islands architecture for 100% Lighthouse performance without sacrificing heavy visual graphics.',
        stack: ['Astro', 'Three.js (R3F)', 'Tailwind CSS', 'Framer Motion'],
        link: { label: 'alevtina-psy.com', href: 'https://alevtina-psy.com' },
        color: '#b097f9',
      },
    ],
  },
  {
    id: 'stack',
    title: 'Stack',
    theme: 'brutalist',
    stations: [
      {
        id: 'stack-core',
        kind: 'stack',
        size: 'md',
        title: 'Hard',
        groups: [
          { label: 'Languages', items: ['JavaScript', 'TypeScript', 'HTML5', 'CSS3'] },
          { label: 'Styling', items: ['Tailwind', 'SASS', 'CSS Modules'] },
          { label: 'Frameworks', items: ['React', 'Next.js', 'Svelte'] },
          { label: 'Data & CMS', items: ['RTK Query', 'React Query', 'Strapi'] },
        ],
      },
      {
        id: 'stack-creative',
        kind: 'stack',
        size: 'md',
        title: 'Creative',
        groups: [
          { label: '3D & Motion', items: ['Three.js', 'Spline', 'Lottie'] },
          { label: 'Audio', items: ['Tone.js', 'Resonance Audio', 'Web Audio API'] },
        ],
      },
      {
        id: 'stack-process',
        kind: 'stack',
        size: 'md',
        title: 'Process',
        groups: [
          { label: 'Testing', items: ['Jest', 'Cypress'] },
          { label: 'Tooling', items: ['ESLint', 'Prettier'] },
          { label: 'AI', items: ['Claude Code', 'Claude Design', 'Cursor', 'Lovable'] },
        ],
      },
    ],
  },
  {
    // DRAFT principles — derived from the bio. Replace with your own wording.
    id: 'principles',
    title: 'Principles',
    theme: 'brutalist',
    stations: [
      { id: 'principle-goals', kind: 'principle', size: 'sm', title: 'Goals before pixels', text: 'Every project starts with understanding what the product has to achieve — the visual language follows from that.' },
      { id: 'principle-human', kind: 'principle', size: 'sm', title: 'Humanize the interface', text: 'Empathetic, tactile and calm over generic, AI-feeling patterns.' },
      { id: 'principle-details', kind: 'principle', size: 'sm', title: 'Details are the product', text: 'Micro-interactions and small states are where trust is built.' },
      { id: 'principle-perf', kind: 'principle', size: 'sm', title: 'Performance is a feature', text: 'Heavy visuals, 60fps, Lighthouse 100. Not a trade-off.' },
      { id: 'principle-a11y', kind: 'principle', size: 'sm', title: 'Accessible by default', text: 'Neuro-inclusive, keyboard-friendly, readable. Comfortable for every user.' },
      { id: 'principle-craft', kind: 'principle', size: 'sm', title: 'Design and code are one craft', text: 'I design what I can build, and build exactly what I designed.' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    theme: 'brutalist',
    stations: [
      {
        id: 'contact',
        kind: 'contact',
        size: 'md',
        title: 'Let’s build something human.',
        subtitle: 'Good things start with a conversation.',
        links: [
          { label: 'Email', value: '[YOUR EMAIL]', href: 'mailto:you@example.com' },
          { label: 'GitHub', value: '[YOUR GITHUB]', href: '#' },
          { label: 'LinkedIn', value: '[YOUR LINKEDIN]', href: '#' },
          { label: 'Telegram', value: '[YOUR TELEGRAM]', href: '#' },
        ],
        footer: 'End of the rail. Start of something new.',
      },
    ],
  },
];
