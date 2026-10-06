/**
 * One renderer per station `kind`. Shared by rail view and plain view.
 * Structure is fixed; every visual property comes from theme tokens via the
 * `t-*` / `tag` / `btn` / `card-pad` classes in globals.css.
 */
import type { ReactNode } from 'react';
import type { FeatureStation, ProjectStation, Station } from '@/config/content';
import { projectNumber, stationById } from '@/lib/content-index';
import { pad } from '@/lib/rail/format';
import { Visual } from './visuals';

interface Props {
  station: Station;
  chapterTitle: string;
  number: number;
  /** Index within its chapter (1-based) and chapter length — for "01 / 05" counters. */
  local: { index: number; count: number };
  /** Appended to element ids — for a second copy (mobile "more" sheet). */
  idSuffix?: string;
  /** Intro only: shown in place of the scroll hint until the journey starts (rail view's "Start journey"). */
  introAction?: ReactNode;
}

function CardHeader({ number, chapterTitle, right }: { number: number; chapterTitle: string; right?: string }) {
  return (
    <div className="t-label flex items-center justify-between text-[10px] md:text-[11px]">
      <span>
        [{pad(number)}] {chapterTitle}
      </span>
      {right && <span aria-hidden>{right}</span>}
    </div>
  );
}

function Tags({ items, label, filledFirst }: { items: string[]; label: string; filledFirst?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="tag t-label px-2 py-1 text-[10px] md:text-[11px]" data-filled={filledFirst && i === 0 ? '' : undefined}>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Technology → the projects it was used in (project titles from the content index). */
function Skills({ items }: { items: NonNullable<FeatureStation['skills']> }) {
  return (
    <dl className="t-divide t-rule-y mt-5">
      {items.map((k) => (
        <div key={k.name} className="grid gap-2 py-3 md:grid-cols-[minmax(0,11em)_1fr] md:gap-4">
          <dt className="t-body-sm font-bold">{k.name}</dt>
          <dd>
            <span className="sr-only">Used in: </span>
            <ul className="flex flex-wrap gap-2">
              {k.projects.map((id) => {
                const p = stationById.get(id)?.station;
                return p ? (
                  <li key={id} className="tag t-label px-2 py-1 text-[10px] md:text-[11px]">
                    {p.kind === 'project' ? p.title : id}
                  </li>
                ) : null;
              })}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Readable ink on a brand colour (WCAG relative luminance). */
function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.22 ? '#0A0A0A' : '#F5F5F2';
}

/** Brand tile: project colour, its icon (square placeholder until real icons land), work number. */
function ProjectVisual({ p }: { p: ProjectStation }) {
  const n = projectNumber.get(p.id) ?? 0;
  if (p.image) {
    // eslint-disable-next-line @next/next/no-img-element -- placeholder slot, swap for next/image when real assets land
    return <img src={p.image} alt="" className="visual aspect-[16/7] w-full object-cover" />;
  }
  const ink = inkOn(p.color);
  return (
    <div
      className="visual project-tile relative aspect-[16/7] w-full overflow-hidden"
      style={{ background: p.color, color: ink, borderColor: ink === '#0A0A0A' ? undefined : p.color }}
      aria-hidden
    >
      <span className="t-label absolute left-3 top-3 text-[10px]">Selected work / {pad(n)}</span>
      <span className="project-icon absolute bottom-3 left-3">
        {p.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- small static icon
          <img src={p.icon} alt="" className="size-full object-contain" />
        ) : (
          <span className="t-display text-2xl leading-none">{p.title.charAt(0)}</span>
        )}
      </span>
      <span className="t-display absolute bottom-2 right-3 text-5xl leading-none opacity-90 md:text-6xl">{pad(n)}</span>
    </div>
  );
}

export function StationContent({ station: s, chapterTitle, number, local, idSuffix = '', introAction }: Props) {
  const titleId = `${s.id}-title${idSuffix}`;
  const counter = local.count > 1 ? `${pad(local.index)} / ${pad(local.count)}` : undefined;

  switch (s.kind) {
    case 'intro':
      return (
        <div className="py-2">
          <p className="t-label flex items-center gap-2 text-[10px] md:text-[11px]">
            <span className="marker inline-block size-2" aria-hidden />
            {s.eyebrow}
          </p>
          <h1 id={titleId} className="t-display mt-4 text-[clamp(56px,9vw,120px)] leading-[0.9]">
            {s.name}
            {/* the full stop — in the rail view it jumps onto the rail and becomes the rider */}
            <span className="intro-dot ml-[0.04em] inline-block size-[0.16em] bg-accent-2 align-baseline" aria-hidden />
          </h1>
          <p className="mt-6 font-body text-xl leading-snug md:text-2xl">
            {s.role.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="t-body-sm mt-4 text-muted">{s.tagline}</p>
          {/* action and hint share one grid cell → the card keeps its size when the journey starts */}
          <div className="intro-cta mt-10">
            {introAction}
            <p className="intro-hint t-label flex items-center gap-3 text-[10px] md:text-[11px]">
              <span aria-hidden>↓</span>
              {s.hint}
              <span className="h-px w-10 bg-fg" aria-hidden />
            </p>
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="card-pad">
          <CardHeader number={number} chapterTitle={chapterTitle} right={counter} />
          <h3 id={titleId} className="t-display mt-5 text-3xl leading-[1.02] md:text-5xl">
            {s.title}
          </h3>
          <div className="t-body mt-5 space-y-3">
            {s.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      );

    case 'list':
      return (
        <div className="card-pad">
          <CardHeader number={number} chapterTitle={chapterTitle} right={counter} />
          <h3 id={titleId} className="t-display mt-5 text-3xl leading-none md:text-4xl">
            {s.title}
          </h3>
          <ol className="t-divide t-rule-y mt-5">
            {s.items.map((item, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] gap-x-4 py-3">
                <span className="t-index t-label mt-0.5 px-1.5 text-[11px] font-bold leading-5" aria-hidden>
                  {pad(i + 1)}
                </span>
                <div>
                  <p className="t-body font-bold leading-tight">{item.title}</p>
                  <p className="t-body-sm mt-1 text-muted">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'project':
      return (
        <div className="card-pad">
          <CardHeader number={number} chapterTitle={chapterTitle} right={counter} />
          <h3 id={titleId} className="t-display mt-5 text-3xl leading-none md:text-[44px]">
            {s.title}
          </h3>
          <p className="t-label mt-3 text-[11px] font-bold md:text-xs">{s.type}</p>
          <div className="mt-5">
            <ProjectVisual p={s} />
          </div>
          <p className="t-body mt-5">{s.description}</p>
          <div className="mt-4">
            <Tags items={s.stack} label="Stack" />
          </div>
          <a
            href={s.link.href}
            {...(s.link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="btn btn-ghost t-label mt-6 inline-flex items-center gap-2 px-3 py-2 text-[11px] font-bold">
            View project <span aria-hidden>↗</span>
            <span className="sr-only">: {s.title}</span>
            <span className="text-muted">{s.link.label}</span>
          </a>
        </div>
      );

    case 'stack':
      return (
        <div className="card-pad">
          <CardHeader number={number} chapterTitle={chapterTitle} right={counter} />
          <h3 id={titleId} className="t-display t-caps mt-5 text-3xl leading-none md:text-5xl">
            {s.title}
          </h3>
          <div className="mt-5 space-y-4">
            {s.groups.map((g) => (
              <div key={g.label} className="grid gap-2 md:grid-cols-[120px_1fr] md:gap-4">
                <p className="t-label pt-1 text-[10px] text-muted md:text-[11px]">{g.label}</p>
                <Tags items={g.items} label={g.label} filledFirst />
              </div>
            ))}
          </div>
        </div>
      );

    case 'principle':
      return (
        <div className="card-pad relative">
          <span className="stripe absolute inset-y-0 left-0 w-2" aria-hidden />
          <div className="pl-3">
            <CardHeader number={number} chapterTitle={chapterTitle} right={counter} />
            <p className="t-display mt-4 text-5xl leading-none text-accent-text" aria-hidden>
              P/{pad(local.index)}
            </p>
            <h3 id={titleId} className="t-display mt-3 text-2xl leading-[1.05] md:text-[28px]">
              {s.title}
            </h3>
            <p className="t-body mt-2 text-muted">{s.text}</p>
          </div>
        </div>
      );

    case 'feature':
      return (
        <div className="card-pad">
          <CardHeader number={number} chapterTitle={chapterTitle} right={counter} />
          {s.visual && s.visual !== 'none' && (
            <div className="mt-5">
              <Visual kind={s.visual} label={`fig. ${pad(local.index)}`} />
            </div>
          )}
          <h3 id={titleId} className="t-display mt-5 text-3xl leading-[1.05] md:text-[40px]">
            {s.title}
          </h3>
          <p className="t-body mt-4">{s.text}</p>
          {s.skills && s.skills.length > 0 && <Skills items={s.skills} />}
          {s.tags && s.tags.length > 0 && (
            <div className="mt-5">
              <Tags items={s.tags} label="Tags" />
            </div>
          )}
        </div>
      );

    case 'contact':
      return (
        <div className="card-pad">
          <CardHeader number={number} chapterTitle={chapterTitle} right="+" />
          <h3 id={titleId} className="t-display mt-6 text-[34px] leading-[1.02] md:text-5xl">
            {s.title}
          </h3>
          <p className="mt-4 font-body text-lg">{s.subtitle}</p>
          <ul className="t-divide t-rule-y mt-6">
            {s.links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="contact-row t-label grid grid-cols-[88px_1fr_auto] items-center gap-3 py-4 text-[11px] md:grid-cols-[120px_1fr_auto]"
                >
                  <span className="normal-case">{l.label}</span>
                  <span className="truncate">{l.value}</span>
                  <span aria-hidden className="text-base">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="t-label mt-6 text-[10px] font-bold">{s.footer}</p>
        </div>
      );
  }
}
