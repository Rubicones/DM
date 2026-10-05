'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery } from '@/lib/rail/hooks';
import { PlainPage } from './PlainPage';
import { RailExperience } from './rail/RailExperience';

type View = 'rail' | 'plain';

export function Portfolio() {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [choice, setChoice] = useState<View | null>(null);

  // ?view=plain | ?view=rail overrides the reduced-motion default.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('view');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading URL only after hydration
    if (q === 'plain' || q === 'rail') setChoice(q);
  }, []);

  const view: View = choice ?? (reducedMotion ? 'plain' : 'rail');
  const toggle = () => {
    setChoice(view === 'rail' ? 'plain' : 'rail');
    window.scrollTo(0, 0);
  };

  return view === 'rail' ? <RailExperience onToggleView={toggle} /> : <PlainPage onToggleView={toggle} />;
}
