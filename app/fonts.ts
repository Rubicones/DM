/**
 * All web fonts. Only the brutalist (first-screen) fonts are preloaded; every
 * other theme's fonts are fetched shortly before their chapter
 * (lib/fonts/preload.ts → document.fonts.load). Google fonts are subset to
 * latin, use font-display: swap, and next/font emits metric-adjusted fallback
 * faces (size-adjust / ascent-override) so swapping causes no layout shift.
 */
import {
  Archivo_Black,
  Atkinson_Hyperlegible,
  Fraunces,
  Inter_Tight,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  JetBrains_Mono,
  Michroma,
  Space_Grotesk,
} from 'next/font/google';

// brutalist — preloaded
export const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black', display: 'swap' });
export const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
export const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });
// dark3d
export const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap', preload: false });
// audio (FM synth): wide instrument-panel display, calm plex body + panel mono
export const michroma = Michroma({ weight: '400', subsets: ['latin'], variable: '--font-michroma', display: 'swap', preload: false });
export const plexSans = IBM_Plex_Sans({ weight: ['400', '500', '600'], subsets: ['latin'], variable: '--font-plex-sans', display: 'swap', preload: false });
export const plexMono = IBM_Plex_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-plex-mono', display: 'swap', preload: false });
// human-first
export const atkinson = Atkinson_Hyperlegible({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-atkinson', display: 'swap', preload: false });
export const fraunces = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'WONK', 'opsz'], variable: '--font-fraunces', display: 'swap', preload: false });

export const fontVariables = [archivo, grotesk, mono, interTight, michroma, plexSans, plexMono, atkinson, fraunces].map((f) => f.variable).join(' ');
