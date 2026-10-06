import type { Metadata } from 'next';
import { fontVariables } from './fonts';
import { chapters } from '@/config/content';
import { themeStylesheet } from '@/lib/theme/tokens';
import './globals.css';

const title = 'Dmitriy Popov — Web Engineer';
const description =
  'Independent web engineer: creative UI/UX and high-performance frontend — interactive, 3D and audio-driven web products. Human-centered design. Engineered to perform.';

export const metadata: Metadata = {
  title,
  description,
  applicationName: 'Dmitriy Popov',
  authors: [{ name: 'Dmitriy Popov', url: 'https://github.com/Rubicones' }],
  creator: 'Dmitriy Popov',
  keywords: ['web engineer', 'frontend developer', 'creative developer', 'Next.js', 'TypeScript', 'React', 'Three.js', 'Web Audio', 'UI/UX', 'portfolio'],
  openGraph: { type: 'website', title, description, siteName: 'Dmitriy Popov', locale: 'en_US' },
  twitter: { card: 'summary', title, description },
};

// Every theme as a `.theme-<id>` class of CSS variables (see lib/theme/tokens.ts).
const themeCss = themeStylesheet();

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${fontVariables} theme-${chapters[0].theme} antialiased`}>
      <head>
        <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
