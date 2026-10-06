import { NextResponse, userAgent, type NextRequest } from 'next/server';

/**
 * Phones get the mobile-layout prerender (app/m) for "/" — the URL stays "/".
 * Both variants are static; this only picks one, so phones paint the right
 * layout from the server HTML instead of swapping after hydration (LCP).
 * Tablets/desktops (and unknown UAs) get the desktop prerender; the client
 * still corrects the layout from the real viewport if the guess was wrong.
 */
export function proxy(request: NextRequest) {
  if (userAgent(request).device.type === 'mobile') {
    const url = request.nextUrl.clone();
    url.pathname = '/m';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: '/' };
