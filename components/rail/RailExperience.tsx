'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { chapters, mobileLayout, railLayout, site } from '@/config/content';
import { PERF_ALLOWED } from '@/config/quality';
import { stationEntries, tiltSeed } from '@/lib/content-index';
import { preloadThemeFonts } from '@/lib/fonts/preload';
import { initQuality } from '@/lib/quality/detect';
import { buildRail, buildRailAsync, type LayoutMode, type RailGeometry, type Size } from '@/lib/rail/geometry';
import { useEngineInstance, useMediaQuery, useRailEngine } from '@/lib/rail/hooks';
import { jumpIntoRider } from '@/lib/rail/journey';
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

export function RailExperience({ onToggleView }: { onToggleView: () => void }) {
  // phones, portrait tablets and landscape phones → mobile layout (media-query
  // changes only fire on width/orientation/height-class changes, not on toolbar show/hide)
  const isMobile = useMediaQuery(mobileLayout.query, false);
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
  const [journey, setJourney] = useState<'idle' | 'jumping' | 'done'>('idle');
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
  const startJourney = () => {
    if (journey !== 'idle') return;
    sound.start();
    // rects are read now, before the dot is hidden by the state change
    const dot = engine.dom.stage?.querySelector<HTMLElement>('[data-station="intro"] .intro-dot');
    const riderDot = engine.dom.rider?.querySelector<HTMLElement>('.rider-dot');
    const landed = dot && riderDot ? jumpIntoRider(dot, riderDot) : Promise.resolve();
    setJourney('jumping');
    void landed.then(() => setJourney('done'));
  };
  const startButton = (
    <button
      type="button"
      className="journey-btn t-label"
      onClick={startJourney}
      tabIndex={journey === 'idle' ? 0 : -1}
      aria-hidden={journey === 'idle' ? undefined : true}
    >
      Start journey <span aria-hidden>→</span>
    </button>
  );

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
            <MobileRail engine={engine} geo={geo} sound={sound} onToggleView={onToggleView} introAction={startButton} />
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
                          data-state="hidden"
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
