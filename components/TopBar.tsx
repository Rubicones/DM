import { site } from '@/config/content';
import type { SoundControl } from '@/lib/sound/useRailSound';

interface Props {
  view: 'rail' | 'plain';
  onTalk: () => void;
  onToggleView: () => void;
  /** null in plain view → the toggle is shown disabled with an explanation. */
  sound: SoundControl | null;
  className?: string;
}

function SoundButton({ sound }: { sound: SoundControl | null }) {
  if (!sound) {
    return (
      <span className="sound-btn-wrap">
        <button
          type="button"
          disabled
          aria-describedby="sound-why"
          title="Rail sounds play only in rail view"
          className="sound-btn t-label text-[10px]"
        >
          Sound off
        </button>
        <span id="sound-why" className="sr-only">
          Rail sounds play only in rail view.
        </span>
      </span>
    );
  }
  const label = sound.on ? 'Sound on' : 'Sound off';
  return (
    <button
      type="button"
      onClick={sound.toggle}
      aria-pressed={sound.on}
      title="Toggle rail sounds"
      className="sound-btn t-label text-[10px]"
      data-on={sound.on ? '' : undefined}
    >
      {label}
    </button>
  );
}

export function TopBar({ view, onTalk, onToggleView, sound, className = '' }: Props) {
  return (
    <header className={`z-20 bg-bg px-4 md:px-[14px] ${className}`}>
      <div className="t-rule-b flex h-[60px] items-center justify-between md:px-1">
        <div className="flex items-center gap-3">
          <span className="t-display text-3xl leading-none" aria-hidden>
            ✱
          </span>
          <span className="t-display text-lg leading-none">{site.initials}</span>
          <span className="t-label hidden text-[9px] md:inline">/ {site.descriptor}</span>
        </div>
        <p className="t-label hidden text-[10px] lg:block">{site.issue}</p>
        <div className="flex items-center gap-3 md:gap-5">
          <SoundButton sound={sound} />
          <button type="button" onClick={onToggleView} className="link-toggle t-label hidden text-[10px] sm:inline">
            {view === 'rail' ? 'Plain view' : 'Rail view'}
          </button>
          <button type="button" onClick={onTalk} className="btn t-label inline-flex items-center gap-2 px-3 py-2 text-[11px] font-bold">
            {site.cta} <span aria-hidden>↗</span>
          </button>
        </div>
      </div>
    </header>
  );
}
