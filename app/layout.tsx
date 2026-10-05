import type { Metadata } from 'next';
import { fontVariables } from './fonts';
import { chapters } from '@/config/content';
import { themeStylesheet } from '@/lib/theme/tokens';
import './globals.css';


export const metadata: Metadata = {
  title: 'Dmitriy — Design Engineer',
  description: 'Creative UI/UX & High-Performance Frontend. Human-centered design. Engineered to perform.',
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
