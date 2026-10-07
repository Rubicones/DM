'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { chapters, mobileLayout, railLayout, site } from '@/config/content';
import { PERF_ALLOWED } from '@/config/quality';
import { stationEntries, tiltSeed } from '@/lib/content-index';
import { preloadThemeFonts } from '@/lib/fonts/preload';
import { initQuality } from '@/lib/quality/detect';
import { buildRail, buildRailAsync, type LayoutMode, type RailGeometry, type Size } from '@/lib/rail/geometry';
import { useEngineInstance, useMediaQuery, useRailEngine } from '@/lib/rail/hooks';
import { JUMP_MS, LAND_AT, jumpIntoRider } from '@/lib/rail/journey';
import { useRailSound } from '@/lib/sound/useRailSound';
import { SketchOutline } from '../SketchOutline';
import { StationContent } from '../StationContent';
import { TopBar } from '../TopBar';
import { Decorations } from './Decorations';
import { Hud } from './Hud';
import { MobileRail } from './MobileRail';
import { RailDebug } from './RailDebug';
import { RailSvg } from './RailSvg';
import { Rider } from './Rider';
import { SceneLayer } from './SceneLayer';

const DEV = process.env.NODE_ENV !== 'production';
const fallbackSize = (mode: LayoutMode) => () => ({ w: mode === 'desktop' ? 520 : 343, h: 380 });
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RailExperience({ onToggleView, initialMobile = false }: { onToggleView: () => void; initialMobile?: boolean }) {
  // phones, portrait tablets and landscape phones → mobile layout (media-query
  // changes only fire on width/orientation/height-class changes, not on toolbar show/hide)
  // server snapshot = layout guessed from the user agent (proxy.ts → /m) so phones hydrate the mobile markup directly
  const isMobile = useMediaQuery(mobileLayout.query, initialMobile);
  const mode: LayoutMode = isMobile ? 'mobile' : 'desktop';
  const mobile = mode === 'mobile';
  const engine = useEngineInstance();
  const L = railLayout[mode];

  useEffect(() => initQuality(), []);

  // Boot geometry: intro only — synchronous, < 1 ms, identical on server and
  // client (hydration-safe). The full rail is planned time-sliced below.
  const boot = useMemo(() => buildRail(chapters, mode, fallbackSize(mode), 1), [mode]);
  const [full, setFull] = useState<{ geo: RailGeometry; sizes: Record<string, Size> } | null>(null);
  const geo = full && full.geo.mode === mode ? full.geo : boot;
  const placements = useMemo(() => new Map(geo.stations.map((s) => [s.id, s])), [geo]);

  // measure → plan. Re-runs on mode change, width/orientation change, and once after fonts settle.
  const [measureKey, setMeasureKey] = useState(0);
  const [measuring, setMeasuring] = useState(true);
  const generation = useRef(0);

  useEffect(() => {
    let lastW = window.innerWidth;
    let timer = 0;
    const onResize = () => {
      if (window.innerWidth === lastW) return; // height-only (mobile toolbar) → ignore
      lastW = window.innerWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setMeasuring(true);
        setMeasureKey((k) => k + 1);
      }, 180);
    };
    window.addEventListener('resize', onResize, { passive: true });
    // brutalist fonts are preloaded; once they're in, re-measure the first time
    void document.fonts?.ready.then(() => {
      setMeasuring(true);
      setMeasureKey((k) => k + 1);
    });
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);

  // a plan for another mode (hydration renders desktop first; a build finishing after the
  // switch to mobile would otherwise leave the mobile rail on the boot geometry) → rebuild
  const needsPlan = measuring || full?.geo.mode !== mode;
  useIsoLayoutEffect(() => {
    if (!needsPlan) return;
    // one batch of layout reads, no writes in between
    const sizes: Record<string, Size> = {};
    // mobile: panels open above the pinned rider, not beside the rail → card sizes don't shape the route
    if (mode === 'desktop') {
      engine.dom.stations.forEach((el, id) => {
        const inner = el.firstElementChild as HTMLElement | null;
        sizes[id] = { w: inner?.offsetWidth ?? 0, h: inner?.offsetHeight ?? 0 };
      });
    }
    // same (bucketed) sizes as the current plan → nothing to rebuild
    const prev = full?.sizes;
    if (prev && full?.geo.mode === mode) {
      const same = Object.keys(sizes).every((k) => prev[k] && Math.abs(prev[k].w - sizes[k].w) < 2 && Math.abs(prev[k].h - sizes[k].h) < 2);
      if (same) {
        setMeasuring(false);
        return;
      }
    }
    const gen = ++generation.current;
    void buildRailAsync(chapters, mode, (id) => sizes[id] ?? fallbackSize(mode)(), () => gen !== generation.current).then((g) => {
      if (!g || gen !== generation.current) return;
      setFull({ geo: g, sizes });
      setMeasuring(false);
    });
  }, [needsPlan, measureKey, mode, engine]);

  // mode switch → measure again
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    setMeasuring(true);
  }, [mode]);

  useRailEngine(engine, geo);
  const sound = useRailSound(engine);
  const [debug, setDebug] = useState(false);

  // ── "Start journey": the page is locked on the intro until the visitor taps it; the tap
  // turns sound on (the gesture browsers require) and the intro's full stop jumps onto the rail
  // idle → jumping → done; and back: done → returning → idle (scrolling up at the start, see below)
  const [journey, setJourney] = useState<'idle' | 'jumping' | 'done' | 'returning'>('idle');
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const locked = journey !== 'done';
    engine.setLocked(locked);
    document.documentElement.classList.toggle('journey-locked', locked);
    return () => document.documentElement.classList.remove('journey-locked');
  }, [journey, engine]);
  const dotHome = useRef<DOMRect | null>(null);
  useEffect(() => {
    // a remembered position is only valid for this layout
    let w = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== w) dotHome.current = null;
      w = window.innerWidth;
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // no scrolling while the full stop is in flight (either way)
  const flying = journey === 'jumping' || journey === 'returning';
  useEffect(() => {
    if (!flying) return;
    const block = (e: Event) => e.cancelable && e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.preventDefault();
    };
    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', block);
      window.removeEventListener('touchmove', block);
      window.removeEventListener('keydown', onKey);
    };
  }, [flying]);

  const startJourney = () => {
    if (journey !== 'idle') return;
    sound.start();
    // rects are read now, before the dot is hidden by the state change
    const dot = engine.dom.stage?.querySelector<HTMLElement>('[data-station="intro"] .intro-dot');
    const riderDot = engine.dom.rider?.querySelector<HTMLElement>('.rider-dot');
    // remember where the full stop sits — the way back lands exactly here
    dotHome.current = dot?.getBoundingClientRect() ?? null;
    const landed = dot && riderDot ? jumpIntoRider(dot, riderDot) : null;
    // (reduced motion: jumpIntoRider resolves at once, no flight → no flight sounds)
    if (landed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // whoosh rising over the flight; the latch fires a touch before contact so it feels tactile
      const land = JUMP_MS * LAND_AT;
      sound.rise(land / 1000);
      window.setTimeout(sound.latch, land - 45);
    }
    setJourney('jumping');
    void (landed ?? Promise.resolve()).then(() => setJourney('done'));
  };
  // navigating before "Start journey" (footer nav, menu, chips, "Let's talk") starts it on the spot:
  // the rider appears where it is (no jump — the camera is about to move) and the scroll goes through
  useEffect(() => {
    engine.setLockedNavigate(() => {
      if (journey === 'idle') sound.start();
      engine.setLocked(false);
      document.documentElement.classList.remove('journey-locked');
      setJourney('done');
    });
    return () => engine.setLockedNavigate(null);
  }, [engine, journey, sound]);
  // ── Back to the start: only when the journey is running, the visitor has already been further
  // down, the page is back at the very top, and they keep scrolling UP (wheel, trackpad incl. momentum,
  // a finger dragging down, ↑/PageUp/Home) — a casual scroll up past the top is enough. The flight plays in reverse into
  // the full stop, the start buttons come back and the sounds play backwards.
  const leftStart = useRef(false);
  useEffect(
    () =>
      engine.addFrameListener((f) => {
        if (f.progress > 0.003) leftStart.current = true;
      }),
    [engine],
  );
  useEffect(() => {
    if (journey !== 'done') return;
    const returnToStart = () => {
      leftStart.current = false;
      // land exactly where the dot rests: lock the page now (scrollbar change happens before we
      // measure) and finish the intro card's in-flight transitions (it is still sliding back from
      // its 'passed' state when the visitor scrolls up right away), then read the rects
      engine.setLocked(true);
      document.documentElement.classList.add('journey-locked');
      const intro = engine.dom.stage?.querySelector<HTMLElement>('[data-station="intro"]');
      intro?.getAnimations?.({ subtree: true }).forEach((a) => {
        try {
          if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish();
        } catch {
          /* not finishable */
        }
      });
      const dot = intro?.querySelector<HTMLElement>('.intro-dot');
      const riderDot = engine.dom.rider?.querySelector<HTMLElement>('.rider-dot');
      const back = dot && riderDot ? jumpIntoRider(dot, riderDot, true, dotHome.current ?? undefined) : null;
      if (back && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // reversed timeline: the lift-off happens (1 − LAND_AT) into the flight
        const liftOff = JUMP_MS * (1 - LAND_AT);
        sound.reverseJump(liftOff, (JUMP_MS - liftOff) / 1000);
      }
      setJourney('returning');
      void (back ?? Promise.resolve()).then(() => setJourney('idle'));
    };
    const standing = () => leftStart.current && engine.atStart;
    let baseY = -1;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && standing()) returnToStart();
    };
    const onTouchStart = (e: TouchEvent) => {
      baseY = standing() ? (e.touches[0]?.clientY ?? -1) : -1;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      // the drag may reach the top mid-gesture: measure from the moment the page hit the top
      if (!standing()) {
        baseY = -1;
        return;
      }
      if (baseY < 0) baseY = y;
      if (y - baseY > 16) {
        baseY = -1;
        returnToStart();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') && standing()) returnToStart();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [journey, engine, sound]);

  const idle = journey === 'idle';
  const startButton = (
    <div className="journey-actions" aria-hidden={idle ? undefined : true}>
      <button type="button" className="journey-btn t-label" onClick={startJourney} tabIndex={idle ? 0 : -1}>
        Start journey <span aria-hidden>→</span>
      </button>
      <button type="button" className="journey-plain t-label" onClick={onToggleView} tabIndex={idle ? 0 : -1}>
        Plain view (boring)
      </button>
    </div>
  );
  // project chips in the themed chapters' cards → ride to that project
  const goTo = (id: string) => engine.scrollToStation(id);

  // fetch the next chapters' theme fonts ahead of time (≈10% of progress before they appear)
  useEffect(
    () =>
      engine.onChapter((idx) => {
        for (let i = idx; i <= idx + 2 && i < chapters.length; i++) preloadThemeFonts(chapters[i].theme);
      }),
    [engine],
  );

  // scroll distance = scroll map total (arc length + station brakes + mobile reading dwells)
  const scrollLength = Math.round(geo.scrollMap.total);
  // stops: page scroll settles on a station when a slow scroll ends near it (proximity snap; flings pass)
  const snap = L.stop.snap && geo.complete;
  useEffect(() => {
    if (!snap) return;
    const html = document.documentElement;
    html.classList.add('rail-snap');
    return () => html.classList.remove('rail-snap');
  }, [snap]);
  const sizes = full?.sizes;
  const stageVars = mobile
    ? ({
        '--m-top': mobileLayout.topBar,
        '--m-margin': mobileLayout.panelMargin,
        '--m-panel-max': mobileLayout.panelMaxWidth,
        '--m-gap': mobileLayout.panelGap,
        '--m-rider-y': `${railLayout.mobile.camera.y * 100}svh`,
      } as CSSProperties)
    : undefined;

  const page = (
    // Tall spacer: provides scroll distance only (lvh → the full range is reachable with or without the mobile toolbar).
    <main className="relative" style={{ height: `calc(${scrollLength}px + ${mobile ? '100dvh' : '100lvh'})` }}>
      {snap && geo.scrollMap.stops.map((top, i) => <div key={i} className="snap-stop" style={{ top: Math.round(top) }} aria-hidden />)}
      <div
        ref={engine.bind('stage')}
        className={`stage sticky top-0 h-svh w-full overflow-clip bg-bg text-fg ${measuring ? 'measuring' : ''}`}
        data-theme={chapters[0].theme}
        data-layout={mode}
        data-journey={journey}
        style={stageVars}
      >
        {/* Background textures — composited layer moved with the camera; zero-weight layers are display:none. */}
        <div ref={engine.bind('texture')} className="texture-layer pointer-events-none absolute left-0 top-0" aria-hidden>
          <span ref={engine.bindLayer('tex', 'grid')} className="tex tex-grid" />
          <span ref={engine.bindLayer('tex', 'dots')} className="tex tex-dots" />
          <span ref={engine.bindLayer('tex', 'scanlines')} className="tex tex-scanlines" />
          <span ref={engine.bindLayer('tex', 'halftone')} className="tex tex-halftone" />
        </div>

        {chapters
          .filter((c) => c.scene)
          .map((c) => (
            <SceneLayer key={c.id} engine={engine} chapterId={c.id} mobile={mobile} />
          ))}

        <Decorations engine={engine} />

        {mobile ? (
          <>
            <MobileRail engine={engine} geo={geo} sound={sound} onToggleView={onToggleView} introAction={startButton} onGoTo={goTo} />
            <div ref={engine.bind('veil')} className="veil pointer-events-none absolute inset-0 bg-bg" style={{ opacity: 0 }} aria-hidden />
          </>
        ) : (
          <>

            <TopBar
              view="rail"
              className="absolute inset-x-0 top-0"
              onTalk={() => engine.scrollToChapter('contact')}
              onToggleView={onToggleView}
              sound={sound}
            />

            {/* WORLD — one translate3d per frame (camera). Content stays in DOM reading order. */}
            <div
              ref={engine.bind('world')}
              className="world absolute left-0 top-0"
              style={{ '--card-gap': `${L.cardGap}px`, '--station-pad': `${L.cardGap + 40}px` } as CSSProperties}
            >
              <RailSvg geo={geo} engine={engine} />
              {DEV && debug && <RailDebug geo={geo} />}
              <Rider riderRef={engine.bind('rider')} />

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
                      const p = placements.get(e.station.id);
                      const id = e.station.id;
                      const size = sizes?.[id];
                      return (
                        <section
                          key={id}
                          ref={engine.bindStation(id)}
                          data-station={id}
                          data-state={e.station.kind === 'intro' ? 'active' : 'hidden'}
                          data-side={p?.side ?? 'left'}
                          data-size={e.station.size ?? 'md'}
                          data-kind={e.station.kind}
                          aria-labelledby={`${id}-title`}
                          className={`station absolute theme-${chapter.theme} ${p ? '' : 'unplaced'}`}
                          style={
                            {
                              left: p?.rect.x ?? 0,
                              top: p?.rect.y ?? 0,
                              '--seed': tiltSeed(e.number),
                              '--ciw': size ? `${size.w}px` : undefined,
                              '--cih': size ? `${size.h}px` : undefined,
                            } as CSSProperties
                          }
                        >
                          {/* station-inner animates (transform/opacity) + draws the connector; card shapes */}
                          <div className="station-inner">
                            <div className={e.station.kind === 'intro' ? '' : 'card'}>
                              {e.station.kind !== 'intro' && <SketchOutline seed={e.number * 13} />}
                              <StationContent
                                station={e.station}
                                chapterTitle={e.chapter.title}
                                number={e.number}
                                local={e.local}
                                introAction={e.station.kind === 'intro' ? startButton : undefined}
                                onGoTo={goTo}
                              />
                            </div>
                          </div>
                        </section>
                      );
                    })}
                </section>
              ))}
            </div>

            {/* Veil: peaks at each transition midpoint to mask non-interpolable swaps. */}
            <div ref={engine.bind('veil')} className="veil pointer-events-none absolute inset-0 bg-bg" style={{ opacity: 0 }} aria-hidden />

            <div className="frame-lines pointer-events-none absolute inset-y-0 left-4 right-4 z-10 md:left-[14px] md:right-[14px]" aria-hidden />
            <p
              className="t-label pointer-events-none absolute bottom-[110px] left-[2px] z-10 hidden rotate-180 text-[9px] [writing-mode:vertical-rl] md:block"
              aria-hidden
            >
              {site.sideLabel}
            </p>

            <Hud
              engine={engine}
              debug={
                DEV ? (
                  <button type="button" onClick={() => setDebug((d) => !d)} aria-pressed={debug} className="link-toggle t-label text-[10px]">
                    debug
                  </button>
                ) : null
              }
            />

          </>
        )}

        {PERF_ALLOWED && <pre ref={engine.bind('perf')} className="perf-overlay" hidden aria-hidden />}
      </div>
    </main>
  );

  // mobile: scroll inside a fixed container, not the document → the browser toolbar never collapses
  return mobile ? (
    <div ref={engine.bindScroller()} className="rail-scroller">
      {page}
    </div>
  ) : (
    page
  );
}
