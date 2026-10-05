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
  /** Optional image path (in /public). Falls back to a generated placeholder. */
  image?: string;
  accent: AccentKey;
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
export type FeatureVisual = 'dot-sphere' | 'dot-plane' | 'waveform' | 'spectrum' | 'amp' | 'blob' | 'none';

/** Generic "title + text + tags + visual" card — used by the themed chapters. */
export interface FeatureStation extends StationBase {
  kind: 'feature';
  title: string;
  text: string;
  tags?: string[];
  visual?: FeatureVisual;
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
  /** Half-width of the world the rail may wander in (x ∈ [−W, W]). */
  halfWidth: number;
  /** Min / max length of one straight leg of the base route. */
  minSeg: number;
  maxSeg: number;
  /** Longest allowed upward leg. */
  upMax: number;
  /** Probability that a vertical turn goes up instead of down. */
  upChance: number;
  /** Min distance between unrelated rail segments (beyond each segment's curve envelope). */
  railClearance: number;
  /** Min distance between rail and any card. */
  cardClearance: number;
  /** Min gap between two cards. */
  cardSpacing: number;
  /** First leg of every chapter is at least this long (chapter label sits on it). */
  chapterLead: number;
  /** Random candidates tried per station (more = better fits, slower build). */
  candidates: number;
  /** Bias: 0 = straight down, 1 = wild sideways wandering. */
  wanderiness: number;
}

export interface RailLayoutMode {
  /** Where the rider sits in the viewport, as fractions of width/height. */
  camera: { x: number; y: number };
  /** Camera leads toward the direction of travel by this fraction of min(vw, vh). */
  lookAhead: number;
  /** Gap between rail and card. */
  cardGap: number;
  /** Reveal a station when the rider is this far before it (fraction of viewport height). */
  revealAhead: number;
  /** Arc length of one rail chunk (own small SVG, culled when off-screen). */
  chunkLength: number;
  wander: WanderConfig;
  /** Default curve params per geometry type (overridable per chapter). */
  curves: ChapterGeometry;
}

export const railLayout: {
  breakpoint: number;
  scrollPerPx: number;
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
  /** Scroll distance per 1px of rail. <1 = faster travel. */
  scrollPerPx: 0.4,
  desktop: {
    camera: { x: 0.5, y: 0.5 },
    lookAhead: 0.2,
    cardGap: 72,
    revealAhead: 0.55,
    chunkLength: 1500,
    wander: {
      halfWidth: 1700,
      minSeg: 300,
      maxSeg: 760,
      upMax: 420,
      upChance: 0.34,
      railClearance: 110,
      cardClearance: 52,
      cardSpacing: 48,
      chapterLead: 420,
      candidates: 64,
      wanderiness: 0.6,
    },
    curves: { radius: 150, amplitude: 70, wavelength: 520 },
  },
  mobile: {
    camera: { x: 0.5, y: 0.45 },
    lookAhead: 0.12,
    cardGap: 36,
    revealAhead: 0.6,
    chunkLength: 1000,
    wander: {
      halfWidth: 520,
      minSeg: 170,
      maxSeg: 460,
      upMax: 240,
      upChance: 0.3,
      railClearance: 56,
      cardClearance: 26,
      cardSpacing: 28,
      chapterLead: 240,
      candidates: 64,
      wanderiness: 0.5,
    },
    curves: { radius: 80, amplitude: 22, wavelength: 300 },
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
        name: 'Dmitriy',
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
        id: 'project-sonicdesk',
        kind: 'project',
        size: 'md',
        title: 'Sonicdesk',
        type: 'Interactive Audio SaaS for Musicians',
        description:
          'An innovative "Git for music" workspace. Features a custom visual version-control tree, interactive audio mixer with visual diffs, and timeline-based comments tied to musical bars.',
        stack: ['Next.js', 'Web Audio API', 'Tone.js', 'Motion', 'Supabase'],
        link: { label: '[PROJECT LINK]', href: '#' },
        accent: 'accent1',
      },
      {
        id: 'project-vortex',
        kind: 'project',
        size: 'md',
        title: 'Vortex Foundation',
        type: 'High-Converting Web3 Corporate Platform',
        description:
          'A premium B2B platform for a crypto market maker. Features scroll-animated chronological timelines, dynamic data counters for business metrics, and ergonomic verification forms.',
        stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'GSAP'],
        link: { label: '[PROJECT LINK]', href: '#' },
        accent: 'accent2',
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
        link: { label: '[PROJECT LINK]', href: '#' },
        accent: 'accent3',
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
        link: { label: '[PROJECT LINK]', href: '#' },
        accent: 'accent1',
      },
      {
        id: 'project-brumberg',
        kind: 'project',
        size: 'md',
        title: 'Matvey Brumberg Portfolio',
        type: 'High-Performance 3D/Motion Designer Portfolio',
        description:
          'A visually expressive portfolio built for heavy media assets. Features optimized media grids with lazy-loading, seamless multi-level infinite marquees, and interactive local-time widgets.',
        stack: ['Next.js', 'Three.js', 'Spline', 'Tailwind CSS'],
        link: { label: '[PROJECT LINK]', href: '#' },
        accent: 'accent2',
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
        id: 'webgl-intro',
        kind: 'feature',
        size: 'md',
        visual: 'dot-sphere',
        title: '[PLACEHOLDER] Depth as information',
        text: '[PLACEHOLDER] What I do with WebGL and Three.js: scroll-reactive scenes, point clouds, shaders that carry meaning instead of decoration.',
        tags: ['Three.js', 'R3F', 'GLSL', 'Spline'],
      },
      {
        id: 'webgl-project',
        kind: 'feature',
        size: 'md',
        visual: 'dot-plane',
        title: '[PLACEHOLDER] 3D project title',
        text: '[PLACEHOLDER] One or two lines about a 3D project — what it does, why the third dimension matters there.',
        tags: ['[STACK]', '[STACK]'],
      },
      {
        id: 'webgl-perf',
        kind: 'feature',
        size: 'md',
        visual: 'dot-sphere',
        title: '[PLACEHOLDER] Heavy visuals, light pages',
        text: '[PLACEHOLDER] Lazy-loaded scenes, capped DPR, paused render loops — keeping 60fps and Lighthouse scores with WebGL on the page.',
        tags: ['Astro Islands', 'Next.js', 'Performance'],
      },
    ],
  },
  {
    id: 'audio',
    title: 'Audio',
    theme: 'audio',
    stations: [
      {
        id: 'audio-intro',
        kind: 'feature',
        size: 'md',
        visual: 'waveform',
        title: '[PLACEHOLDER] Interfaces that listen',
        text: '[PLACEHOLDER] Web Audio work: real-time mixers, visual diffs of takes, timeline comments tied to musical bars.',
        tags: ['Web Audio API', 'Tone.js', 'Resonance Audio'],
      },
      {
        id: 'audio-tools',
        kind: 'feature',
        size: 'md',
        visual: 'spectrum',
        title: '[PLACEHOLDER] Tools for musicians',
        text: '[PLACEHOLDER] Audio tools for musicians and educators — what they solve and who uses them.',
        tags: ['[TOOL]', '[TOOL]'],
      },
      {
        id: 'audio-spatial',
        kind: 'feature',
        size: 'md',
        visual: 'amp',
        title: '[PLACEHOLDER] Spatial sound in the browser',
        text: '[PLACEHOLDER] Room acoustics, spatial audio and how it becomes a teaching instrument.',
        tags: ['Spatial audio', '[STACK]'],
      },
    ],
  },
  {
    id: 'human',
    title: 'Human-first',
    theme: 'human',
    stations: [
      {
        id: 'human-a11y',
        kind: 'feature',
        size: 'md',
        visual: 'blob',
        title: '[PLACEHOLDER] Accessible by default',
        text: '[PLACEHOLDER] How accessibility shapes the work from the first sketch: contrast, focus, keyboard paths, readable type.',
        tags: ['WCAG AA', 'Keyboard', 'Screen readers'],
      },
      {
        id: 'human-neuro',
        kind: 'feature',
        size: 'md',
        visual: 'none',
        title: '[PLACEHOLDER] Calm, neuro-inclusive UI',
        text: '[PLACEHOLDER] Stress-free interfaces: predictable motion, gentle feedback, room to breathe.',
        tags: ['Reduced motion', 'Plain language'],
      },
      {
        id: 'human-approach',
        kind: 'feature',
        size: 'md',
        visual: 'none',
        title: '[PLACEHOLDER] People before pixels',
        text: '[PLACEHOLDER] My approach to human-centered design — research, empathy, and testing with real people.',
        tags: ['UX research', 'Empathy'],
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
