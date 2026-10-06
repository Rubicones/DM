'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { chapters, site } from '@/config/content';
import { stationEntries, tiltSeed } from '@/lib/content-index';
import type { RailEngine } from '@/lib/rail/engine';
import type { RailGeometry } from '@/lib/rail/geometry';
import type { SoundControl } from '@/lib/sound/useRailSound';
import { SketchOutline } from '../SketchOutline';
import { StationContent } from '../StationContent';
import { RailSvg } from './RailSvg';
import { Rider } from './Rider';

interface Props {
  engine: RailEngine;
  geo: RailGeometry;
  sound: SoundControl;
  onToggleView: () => void;
  /** "Start journey" button for the intro card. */
  introAction: ReactNode;
  onGoTo: (id: string) => void;
}

/**
 * MOBILE LAYOUT — one full-screen world (same rail, zoomed out).
 * The camera pins the rider bottom-centre (railLayout.mobile.camera). Above
 * it, a screen-fixed content zone shows the current station as one centred
 * card: it opens as the rider reaches the marker, stays through the reading
 * dwell and leaves as the rider moves on (engine: updatePanels). Panels stay in the DOM in reading order
 * (keyboard / screen readers as on desktop); content taller than the space
 * above the rider is clipped and opens in a "more" bottom sheet.
 */
export function MobileRail({ engine, geo, sound, onToggleView, introAction, onGoTo }: Props) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const sheetRef = useModal(sheet !== null);
  const menuRef = useModal(menu);

  // Overflow: a panel whose content is taller than its clip box gets
  // data-clamp (fade + "more" button). ResizeObserver catches font swaps,
  // rotation and late theme fonts; no per-frame work.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || typeof ResizeObserver === 'undefined') return;
    const contents = Array.from(zone.querySelectorAll<HTMLElement>('.m-content'));
    const check = (content: HTMLElement) => {
      const clip = content.parentElement;
      const panel = content.closest<HTMLElement>('.m-panel');
      if (!clip || !panel) return;
      const clamped = panel.hasAttribute('data-clamp');
      const more = clamped ? (panel.querySelector<HTMLElement>('.m-more')?.offsetHeight ?? 0) : 0;
      // a few px of tolerance: sub-pixel rounding must not turn every card into "more"
      const over = content.offsetHeight > clip.clientHeight + more + 6;
      if (over !== clamped) panel.toggleAttribute('data-clamp', over);
    };
    // content resizes (fonts, width) and clip resizes (available height) both re-check
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const t = e.target as HTMLElement;
        check(t.classList.contains('m-content') ? t : (t.firstElementChild as HTMLElement));
      }
    });
    contents.forEach((c) => {
      ro.observe(c);
      if (c.parentElement) ro.observe(c.parentElement);
    });
    return () => ro.disconnect();
  }, []);

  const sheetEntry = sheet ? stationEntries.find((e) => e.station.id === sheet) : undefined;
  const goChapter = (id: string) => {
    setMenu(false);
    requestAnimationFrame(() => engine.scrollToChapter(id));
  };

  return (
    <>
      <header className="m-top absolute inset-x-0 top-0 z-20 bg-bg px-4">
        <div className="t-rule-b flex h-full items-center gap-3">
          <span className="t-display text-2xl leading-none" aria-hidden>
            ✱
          </span>
          <span className="t-display text-lg leading-none">{site.initials}</span>
          <p className="t-label flex min-w-0 flex-1 items-center justify-end gap-2 text-[10px]">
            <span ref={engine.bind('hudChapter')} className="truncate">
              {chapters[0].title}
            </span>
            <span className="text-muted" aria-hidden>
              /
            </span>
            <span ref={engine.bind('hudPct')} className="tabular-nums" aria-hidden>
              00%
            </span>
          </p>
          <button
            type="button"
            className="m-icon-btn m-sound-btn"
            onClick={sound.toggle}
            aria-pressed={sound.on}
            data-on={sound.on ? '' : undefined}
          >
            <SoundIcon on={sound.on} />
            <span className="sr-only">Sound</span>
          </button>
          <button
            type="button"
            className="m-icon-btn t-label text-[10px]"
            aria-haspopup="dialog"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <span aria-hidden className="m-burger" />
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </header>

      {/* WORLD — rail, markers, rider; the camera pins the rider bottom-centre. */}
      <div ref={engine.bind('world')} className="world absolute left-0 top-0">
        <RailSvg geo={geo} engine={engine} />
        {/* no marker at the very start of the path (the intro has no stop of its own) */}
        {geo.stations.slice(1).map((st) => (
          // decorative shortcut (the panels themselves are the accessible content)
          <button
            key={st.id}
            ref={engine.bindMarker(st.id)}
            type="button"
            tabIndex={-1}
            aria-hidden
            data-state="hidden"
            className="m-marker"
            style={{ left: st.anchor.x, top: st.anchor.y }}
            onClick={() => engine.scrollToStation(st.id)}
          >
            <span className="m-marker-dot" />
          </button>
        ))}
        <Rider riderRef={engine.bind('rider')} />
      </div>

      {/* CONTENT ZONE — screen-fixed, between the top bar and the rider; one card at a time, centred. */}
      <div ref={zoneRef} className="m-zone">
        {chapters.map((chapter, ci) => (
          <section key={chapter.id} aria-labelledby={ci === 0 ? undefined : `chapter-${chapter.id}`}>
            {ci > 0 && (
              <h2 id={`chapter-${chapter.id}`} className="sr-only">
                {chapter.title}
              </h2>
            )}
            {stationEntries
              .filter((e) => e.chapterIndex === ci)
              .map((e) => {
                const id = e.station.id;
                const intro = e.station.kind === 'intro';
                return (
                  <section
                    key={id}
                    ref={engine.bindStation(id)}
                    data-station={id}
                    data-state="hidden"
                    data-kind={e.station.kind}
                    aria-labelledby={`${id}-title`}
                    className={`m-panel theme-${chapter.theme}`}
                    style={{ '--seed': tiltSeed(e.number) } as CSSProperties}
                  >
                    <div className="m-panel-inner">
                      <div className={intro ? 'm-card m-card-intro' : 'card m-card'}>
                        {!intro && <SketchOutline seed={e.number * 13} />}
                        <div className="m-clip">
                          <div className="m-content">
                            <StationContent
                              station={e.station}
                              chapterTitle={e.chapter.title}
                              number={e.number}
                              local={e.local}
                              introAction={intro ? introAction : undefined}
                              onGoTo={onGoTo}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="m-more btn t-label text-[11px] font-bold"
                          aria-haspopup="dialog"
                          onClick={() => setSheet(id)}
                        >
                          Read more <span aria-hidden>↑</span>
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
          </section>
        ))}
      </div>

      <p className="m-hint t-label text-[10px]" aria-hidden>
        Scroll <span>↓</span>
      </p>

      {/* "More" sheet — own scroll, page scroll locked while open. */}
      <dialog
        ref={sheetRef}
        className={`m-sheet ${sheetEntry ? `theme-${sheetEntry.chapter.theme}` : ''}`}
        aria-labelledby={sheetEntry ? `${sheetEntry.station.id}-title-sheet` : undefined}
        onClose={() => setSheet(null)}
        onClick={(ev) => ev.target === ev.currentTarget && setSheet(null)}
      >
        {sheetEntry && (
          <div className="m-sheet-body card">
            <div className="m-sheet-head">
              <span className="m-sheet-grip" aria-hidden />
              <button type="button" className="m-icon-btn t-label text-[11px]" onClick={() => setSheet(null)}>
                Close <span aria-hidden>✕</span>
              </button>
            </div>
            <div className="m-sheet-scroll">
              <StationContent
                station={sheetEntry.station}
                chapterTitle={sheetEntry.chapter.title}
                number={sheetEntry.number}
                local={sheetEntry.local}
                idSuffix="-sheet"
                onGoTo={(id) => {
                  setSheet(null);
                  requestAnimationFrame(() => onGoTo(id));
                }}
              />
            </div>
          </div>
        )}
      </dialog>

      {/* Menu sheet — chapters, sound, plain view, contact. */}
      <dialog
        ref={menuRef}
        className="m-sheet"
        aria-label="Menu"
        onClose={() => setMenu(false)}
        onClick={(ev) => ev.target === ev.currentTarget && setMenu(false)}
      >
        <div className="m-sheet-body m-menu bg-bg">
          <div className="m-sheet-head">
            <span className="m-sheet-grip" aria-hidden />
            <button type="button" className="m-icon-btn t-label text-[11px]" onClick={() => setMenu(false)}>
              Close <span aria-hidden>✕</span>
            </button>
          </div>
          <div className="m-sheet-scroll">
            <nav aria-label="Chapters">
              <ul className="space-y-1">
                {chapters.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      ref={engine.bindNav(c.id)}
                      onClick={() => goChapter(c.id)}
                      className="nav-btn m-menu-item t-label text-[12px]"
                    >
                      <span className="text-muted" aria-hidden>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {c.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="t-rule-t mt-5 flex flex-wrap items-center gap-3 pt-5">
              <button
                type="button"
                onClick={sound.toggle}
                aria-pressed={sound.on}
                className="sound-btn m-menu-chip t-label text-[11px]"
                data-on={sound.on ? '' : undefined}
              >
                {sound.on ? 'Sound on' : 'Sound off'}
              </button>
              <button type="button" onClick={onToggleView} className="link-toggle m-menu-chip t-label text-[11px]">
                Plain view
              </button>
              <button
                type="button"
                onClick={() => goChapter('contact')}
                className="btn m-menu-chip t-label inline-flex items-center gap-2 px-3 text-[11px] font-bold"
              >
                {site.cta} <span aria-hidden>↗</span>
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Speaker; waves when on, a cross when off. currentColor → follows the theme. */
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden>
      <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
      {on ? (
        <>
          <path d="M16 9.5c.8.7 1.2 1.6 1.2 2.5s-.4 1.8-1.2 2.5" />
          <path d="M18.6 6.8c1.5 1.4 2.3 3.2 2.3 5.2s-.8 3.8-2.3 5.2" />
        </>
      ) : (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      )}
    </svg>
  );
}

/** Native <dialog> as a modal bottom sheet; locks page scroll while open. */
function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    if (!d.open) d.showModal();
    const html = document.documentElement;
    html.classList.add('scroll-locked');
    return () => {
      html.classList.remove('scroll-locked');
      if (d.open) d.close();
    };
  }, [open]);
  return ref;
}
