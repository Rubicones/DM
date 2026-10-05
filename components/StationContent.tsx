/**
 * One renderer per station `kind`. Shared by rail view and plain view.
 * Structure is fixed; every visual property comes from theme tokens via the
 * `t-*` / `tag` / `btn` / `card-pad` classes in globals.css.
 */
import type { AccentKey, ProjectStation, Station } from '@/config/content';
import { pad } from '@/lib/rail/format';
import { Visual } from './visuals';

interface Props {
  station: Station;
  chapterTitle: string;
  number: number;
  /** Index within its chapter (1-based) and chapter length — for "01 / 05" counters. */
  local: { index: number; count: number };
}

const accentBlock: Record<AccentKey, string> = {
  accent1: 'accent-block-1',
  accent2: 'accent-block-2',
  accent3: 'accent-block-3',
};

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

function ProjectVisual({ p, index }: { p: ProjectStation; index: number }) {
  if (p.image) {
    // eslint-disable-next-line @next/next/no-img-element -- placeholder slot, swap for next/image when real assets land
    return <img src={p.image} alt="" className="visual aspect-[16/7] w-full object-cover" />;
  }
  // Deterministic "waveform" placeholder.
  const bars = Array.from({ length: 28 }, (_, i) => 18 + Math.abs(Math.sin(i * 0.9 + index * 1.7) * Math.cos(i * 0.31)) * 82);
  return (
    <div className={`visual relative aspect-[16/7] w-full overflow-hidden ${accentBlock[p.accent]}`} aria-hidden>
      <span className="t-label absolute left-3 top-3 text-[10px]">Selected work / {pad(index)}</span>
      <span className="t-display absolute bottom-2 left-3 text-5xl leading-none opacity-90 md:text-6xl">{pad(index)}</span>
      <div className="absolute bottom-3 right-3 flex h-1/2 items-end gap-[3px]">
        {bars.map((h, i) => (
          <span key={i} className="w-[4px] bg-current" style={{ height: `${Math.round(h)}%` }} />
        ))}
      </div>
    </div>
  );
}

export function StationContent({ station: s, chapterTitle, number, local }: Props) {
  const titleId = `${s.id}-title`;
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
            <span className="ml-[0.04em] inline-block size-[0.16em] bg-accent-2 align-baseline" aria-hidden />
          </h1>
          <p className="mt-6 font-body text-xl leading-snug md:text-2xl">
            {s.role.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="t-body-sm mt-4 text-muted">{s.tagline}</p>
          <p className="t-label mt-10 flex items-center gap-3 text-[10px] md:text-[11px]">
            <span aria-hidden>↓</span>
            {s.hint}
            <span className="h-px w-10 bg-fg" aria-hidden />
          </p>
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
            <ProjectVisual p={s} index={local.index} />
          </div>
          <p className="t-body mt-5">{s.description}</p>
          <div className="mt-4">
            <Tags items={s.stack} label="Stack" />
          </div>
          <a href={s.link.href} className="btn btn-ghost t-label mt-6 inline-flex items-center gap-2 px-3 py-2 text-[11px] font-bold">
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
