'use client';

import { chapters } from '@/config/content';
import { stationEntries, tiltSeed } from '@/lib/content-index';
import { pad } from '@/lib/rail/format';
import { StationContent } from './StationContent';
import { TopBar } from './TopBar';
import { SketchOutline } from './SketchOutline';
import { DotSphereStatic } from './visuals';

/**
 * Normal vertical page. Each chapter is a full-width section scoped to its own
 * theme (class `theme-<id>`), static: no rail animation, no WebGL — scene
 * chapters get a static SVG dotted sphere instead.
 * Used for prefers-reduced-motion, and via the "Plain view" toggle.
 */
export function PlainPage({ onToggleView }: { onToggleView: () => void }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <TopBar
        view="plain"
        className="sticky top-0"
        onTalk={() => document.getElementById('chapter-contact')?.scrollIntoView()}
        onToggleView={onToggleView}
        sound={null}
      />
      <main>
        {chapters.map((ch, ci) => (
          <section
            key={ch.id}
            id={`chapter-${ch.id}`}
            aria-labelledby={ci === 0 ? undefined : `plain-${ch.id}`}
            className={`theme-${ch.theme} plain-section relative scroll-mt-16 overflow-hidden bg-bg text-fg`}
          >
            <div className="plain-texture pointer-events-none absolute inset-0" aria-hidden>
              <span className="tex tex-grid" />
              <span className="tex tex-dots" />
              <span className="tex tex-scanlines" />
              <span className="tex tex-halftone" />
            </div>
            <div className="relative mx-auto max-w-[720px] px-4 pb-16 pt-12 md:pb-20">
              <div aria-hidden className="plain-rail absolute bottom-0 left-4 top-0 md:-left-8" />
              <div className="pl-8 md:pl-0">
                {ci > 0 && (
                  <h2 id={`plain-${ch.id}`} className="chapter-chip t-label mb-8 inline-block px-3 py-1.5 text-[11px] font-bold">
                    Ch.{pad(ci + 1)} — {ch.title}
                  </h2>
                )}
                {ch.scene === 'sphere' && <DotSphereStatic className="mx-auto mb-10 max-w-[420px]" />}
                <div className="space-y-10">
                  {stationEntries
                    .filter((e) => e.chapterIndex === ci)
                    .map((e) => (
                      <article
                        key={e.station.id}
                        id={e.station.id}
                        aria-labelledby={`${e.station.id}-title`}
                        className={e.station.kind === 'intro' ? '' : 'card'}
                        style={{ '--seed': tiltSeed(e.number) } as React.CSSProperties}
                      >
                        {e.station.kind !== 'intro' && <SketchOutline seed={e.number * 13} />}
                        <StationContent station={e.station} chapterTitle={e.chapter.title} number={e.number} local={e.local} />
                      </article>
                    ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
