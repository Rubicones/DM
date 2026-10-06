# Portfolio — rail

Scroll doesn't scroll the page: it moves a rider along a rail that wanders across a 2D world. Everything on screen is derived from one `progress ∈ [0, 1]` (= arc length). The rail passes through four visual worlds: brutalist → 3D (dark generative) → audio (gig-poster zine) → human-first (soft) → brutalist.

```bash
npm run dev      # http://localhost:3000  (?view=plain forces the flat page)
```

## Where things live

| File | What |
|---|---|
| `config/content.ts` | Content, chapter order, `railLayout`: **seed**, wander constraints, curve defaults, camera/look-ahead, `transitionZone`, `sceneMargin` |
| `config/themes.ts` | `Theme` type + 4 themes (colors, type, surfaces, rail, rider, motion, decoration, readout, **sound**) |
| `config/sound.ts` | Master volume, trigger rate limit, release timing, storage key |
| `lib/theme/tokens.ts` | Theme → CSS variables (`flatten` / `blend` / `render`), `dashPeriod()` |
| `lib/rail/geometry.ts` | **Planner** (seeded, constraint-checked base route) + **renderer** (orthogonal / filleted smooth / sine-along-normal) |
| `lib/rail/engine.ts` | rAF loop: progress → rider, camera (framing + look-ahead), rail mask, stations, HUD, theme blending, frame events |
| `lib/sound/` | `SoundSystem` (one global system, crossfade, limiter, rate limiting), `engines/*` (one per theme), `useRailSound` |
| `lib/scene/sphere.ts`, `lib/scene/sphereChoreography.ts` | 3D chapter sphere fly-through + its keyframes |
| `components/rail/RailDebug.tsx` | Dev-only overlay (HUD → "debug"): legs, envelopes, card boxes, clearance zones |

## Rail planner
- Change `railLayout.seed` for another (stable) layout. Constraints per breakpoint in `railLayout.desktop|mobile.wander`.
- Each leg carries a curve **envelope** (sine amplitude + fillet cut), and clearances are checked with envelopes included, so rendered curves keep the guarantees.
- In dev, a console warning `[rail] no clean fit for <station>` means the best-effort candidate was used — try another seed or loosen constraints.
- Calm wandering: `wander.minSeg/maxSeg` (run lengths), `dirWeights` (down/left/right/up), `persistence` (keep going straight), `maxTurnsPerChapter`, `oscillationGap` (no L-R-L within this distance), `upMax`. Curves: `curves.radius` (smooth fillets), `curves.amplitude/wavelength` (sine).

## Mobile layout
- Switch: `mobileLayout.query` in `config/content.ts` (width < 768, portrait touch tablets, landscape phones with height < 500). Media-query based → flips only on width/orientation changes.
- One full-screen world: the camera pins the rider bottom-centre (`railLayout.mobile.camera`, y = 0.82, no look-ahead). World pre-scaled by `railLayout.mobile.worldScale`.
- Content zone: screen-fixed, from the top bar to `panelGap` above the rider; the current station's card is centred in it (max height = the zone). Visible window per station = [arrival − `panelLead`, arrival + dwell + `panelHold`] (arc px) — engine `updatePanels`.
- Dwell (reading time): `railLayout.mobile.dwell` → scroll px per station = clamp(base + perChar × text length, min, max); the rider creeps `creep` of it in arc length. Per station: `dwell: <px>` (0 = none). Built into `geo.scrollMap` (`lib/rail/scrollmap.ts`).
- Long content: panels never scroll; overflow is detected with a ResizeObserver → clipped + "Read more" opens a `<dialog>` bottom sheet with its own scroll (page scroll locked).
- UI: `components/rail/MobileRail.tsx`; CSS: "mobile layout" section of `app/globals.css`.

## Sound
- Engines: `ratchet` (brutalist), `bass-dots` (3D), `velocity-tone` (audio), `pencil` (human-first) — `lib/sound/engines/*.ts`, chosen by `theme.sound`.
- Discrete engines fire once per rail dash/dot (period = `dashPeriod(theme)`), rate-limited by `soundConfig.minTriggerMs`.

## Performance
- **Perf overlay** (dev builds, or production built with `NEXT_PUBLIC_PERF=1`): add `?perf` to the URL or press **Alt+Shift+P**. Shows FPS, avg/worst frame time (last 120 frames), main-thread ms per subsystem (progress, camera, rail, stations, theme, 3d, sound), `renderer.info`, tier, chapter, rendered stations, visible rail chunks.
- **Quality tiers**: `config/quality.ts` (presets + runtime budget). Detection in `lib/quality/detect.ts` (heuristics + lazy `detect-gpu` with self-hosted data in `public/detect-gpu`). Force with `?tier=high|medium|low|fallback`.
- One ticker: `RailEngine.tick` (`lib/rail/engine.ts`). Geometry is planned time-sliced (`buildRailAsync`), sampled through an O(1) arc-length LUT (`lib/rail/lut.ts`), rendered as culled chunks (`components/rail/RailSvg.tsx`).

## Project icons
- `icon: '/projects/<name>.png'` — static logo in the project tile. `iconModel: '/projects/<name>.glb'` — animated 3D icon (`components/ModelIcon.tsx` + lazy `lib/scene/modelIcon.ts`): mounts near the viewport, renders on demand, plays the GLB's clips forward on hover / focus (tap on touch) and back on leave; no-WebGL tier → first letter.
