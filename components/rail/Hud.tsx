import { memo } from 'react';
import { chapters } from '@/config/content';
import type { RailEngine } from '@/lib/rail/engine';

/** Text nodes here are written by the engine (no React state per frame). */
export const Hud = memo(function Hud({ engine, debug }: { engine: RailEngine; debug?: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-bg px-4 md:px-[14px]">
      <div className="t-rule-t md:flex md:h-[60px] md:items-center md:justify-between md:px-1">
        <div className="flex items-center justify-between gap-3 pt-3 md:w-60 md:justify-start md:pt-0">
          <p className="t-label flex items-center gap-2 text-[11px]">
            <span className="marker inline-block size-2" aria-hidden />
            <span ref={engine.bind('hudChapter')}>{chapters[0].title}</span>
            <span className="text-muted" aria-hidden>
              /
            </span>
            <span ref={engine.bind('hudPct')} aria-hidden>
              00%
            </span>
          </p>
          {debug}
        </div>
        <nav aria-label="Chapters" className="-mx-2 flex overflow-x-auto py-2 md:mx-0 md:py-0">
          {chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              ref={engine.bindNav(c.id)}
              onClick={() => engine.scrollToChapter(c.id)}
              className="nav-btn t-label shrink-0 px-2 py-2 text-[10px]"
            >
              {c.title}
            </button>
          ))}
        </nav>
        <p
          ref={engine.bind('hudReadout')}
          className="t-label hidden text-right text-[9px] tabular-nums md:block md:w-60"
          aria-hidden
        >
          X 00000 / Y 00000
        </p>
      </div>
    </div>
  );
});
