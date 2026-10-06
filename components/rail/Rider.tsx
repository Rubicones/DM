import { memo } from 'react';

/** Same DOM for every theme; shape, size, glow, pulse and label case come from tokens. */
export const Rider = memo(function Rider({ riderRef }: { riderRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={riderRef} className="rider" data-side="left" aria-hidden>
      <span className="rider-ring" />
      <span className="rider-dot" />
    </div>
  );
});
