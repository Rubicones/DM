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
  DM_Mono,
  JetBrains_Mono,
  Outfit,
  Space_Grotesk,
} from 'next/font/google';

// brutalist — preloaded
export const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black', display: 'swap' });
export const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
export const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });
// dark3d
export const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap', preload: false });
// audio (Teenage Engineering-style): thin geometric display, mono panel labels; body reuses Inter Tight
export const outfit = Outfit({ weight: ['300', '400'], subsets: ['latin'], variable: '--font-outfit', display: 'swap', preload: false });
export const dmMono = DM_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-dm-mono', display: 'swap', preload: false });
// human-first
export const atkinson = Atkinson_Hyperlegible({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-atkinson', display: 'swap', preload: false });
export const fraunces = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'WONK', 'opsz'], variable: '--font-fraunces', display: 'swap', preload: false });

export const fontVariables = [archivo, grotesk, mono, interTight, outfit, dmMono, atkinson, fraunces].map((f) => f.variable).join(' ');
