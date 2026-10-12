'use client';

import { useState } from 'react';
import type { BioStation } from '@/config/content';
import { pad } from '@/lib/rail/format';

/** Keep every panel in the grid so switching modes preserves the rail's measured card size. */
export function BioCard({ station, titleId }: { station: BioStation; titleId: string }) {
  const [active, setActive] = useState(0);

  return (
    <div className="bio-card">
      <div className="bio-heading">
        <h3 id={titleId} className="t-display">{station.title}</h3>
        <span className="bio-hello t-display" aria-hidden>✳</span>
      </div>
      <p className="t-body-sm text-muted mt-2">{station.subtitle}</p>

      <div className="bio-modes" role="group" aria-label="Discover a side of Dmitriy">
        {station.facets.map((facet, i) => (
          <button
            key={facet.visual}
            type="button"
            className="bio-mode t-label"
            aria-pressed={active === i}
            aria-controls={`${titleId}-facet-${i}`}
            onClick={() => setActive(i)}
          >
            <span className="bio-mode-index" aria-hidden>{pad(i + 1)}</span>
            {facet.label}
            <span className="bio-mode-mark" aria-hidden>{active === i ? '↙' : '+'}</span>
          </button>
        ))}
      </div>

      <div className="bio-panels" aria-live="polite" aria-atomic="true">
        {station.facets.map((facet, i) => (
          <div
            key={facet.visual}
            id={`${titleId}-facet-${i}`}
            className="bio-panel"
            data-mode={facet.visual}
            data-active={active === i ? '' : undefined}
            aria-hidden={active !== i}
          >
            <div className="bio-figure" aria-hidden>
              <BioDrawing mode={facet.visual} />
              <span className="bio-figure-caption t-label">{['Idea → identity', 'Pixels → product', 'Screen → feeling'][i]}</span>
            </div>
            <div className="bio-story">
              <p className="t-label bio-kicker">{pad(i + 1)} / The {facet.label.toLowerCase()} in me</p>
              <p className="t-display bio-headline">{facet.headline}</p>
              <p className="t-body-sm bio-copy">{facet.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bio-footer t-label">
        <span><span className="bio-status" aria-hidden /> Same person. All three.</span>
        <span aria-hidden>Try another mode ↑</span>
      </div>
    </div>
  );
}

function BioDrawing({ mode }: { mode: BioStation['facets'][number]['visual'] }) {
  return (
    <svg viewBox="0 0 180 160" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      {mode === 'design' ? (
        <>
          <path d="M24 25h120v94H24z" fill="var(--t-card-bg)" transform="rotate(-7 84 72)" />
          <path d="M20 41l119-15M38 55l45-5M40 65l32-4" />
          <path d="M43 82l33-4 3 24-33 4z" fill="var(--t-accent-2)" />
          <circle cx="108" cy="88" r="17" fill="var(--t-accent-3)" />
          <path d="M119 105l8 42 10-14 16 2z" fill="var(--t-fg)" stroke="var(--t-card-bg)" />
          <path d="M151 49v16m-8-8h16M14 112v12m-6-6h12" />
        </>
      ) : mode === 'code' ? (
        <>
          <rect x="17" y="29" width="146" height="103" fill="var(--t-card-bg)" />
          <path d="M17 48h146" />
          <circle cx="28" cy="38" r="2" fill="currentColor" stroke="none" />
          <circle cx="37" cy="38" r="2" fill="currentColor" stroke="none" />
          <circle cx="46" cy="38" r="2" fill="currentColor" stroke="none" />
          <path d="M62 69L42 88l20 19m56-38l20 19-20 19M102 62l-23 52" strokeWidth="5" />
          <path d="M128 122h39v25h-39z" fill="var(--t-accent-3)" />
          <path d="M137 134l6 6 15-14" />
          <path d="M32 12v10m-5-5h10" />
        </>
      ) : (
        <>
          <path d="M90 126S29 92 29 58c0-30 40-38 61-8 21-30 61-22 61 8 0 34-61 68-61 68z" fill="var(--t-accent-2)" />
          <path d="M68 66v10m43-10v10m-40 12q19 23 38 0" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M14 39l-8-6m14 38H7m151-35l10-8m-5 43h11M38 125l-7 8m110-10l8 8" />
          <path d="M77 140h26m-20 9h14" />
        </>
      )}
    </svg>
  );
}
