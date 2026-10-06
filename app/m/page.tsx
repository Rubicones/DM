import type { Metadata } from 'next';
import { Portfolio } from '@/components/Portfolio';

/**
 * Same page, server-rendered in the mobile layout. Phones never visit /m directly:
 * proxy.ts rewrites "/" here by user agent, so the URL stays "/" and the HTML they
 * get already is the mobile markup (no desktop → mobile swap after hydration).
 */
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function MobilePage() {
  return <Portfolio initialMobile />;
}
