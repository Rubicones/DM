/**
 * "Start journey" — the intro's blue full stop jumps onto the rail and
 * becomes the rider: an arc from the dot to the rider while it grows, turns
 * the rider's colour and gains its border + shadow, with a squash before
 * take-off and on landing. Runs on a fixed-position clone (Web Animations,
 * transform/colour only), so layout never moves; the real rider is revealed
 * when the clone lands on it. The target look is read from the rider's
 * computed style, so it follows the theme tokens.
 */
const DURATION = 1150;
/** Jump length and the moment (fraction) the clone touches the rail — sounds sync to these. */
export const JUMP_MS = DURATION;
export const LAND_AT = 0.84;

/** `reverse`: the same flight played backwards — the rider leaps off the rail back into the full stop. */
export function jumpIntoRider(dot: HTMLElement, riderDot: HTMLElement, reverse = false, dotRect?: DOMRectReadOnly): Promise<void> {
  // `dotRect`: where the full stop sat when the journey started (the way back lands exactly there)
  const a = dotRect ?? dot.getBoundingClientRect();
  const b = riderDot.getBoundingClientRect();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !a.width || !b.width || typeof dot.animate !== 'function') return Promise.resolve();

  const from = getComputedStyle(dot);
  const to = getComputedStyle(riderDot);
  const size = b.width; // the clone is rider-sized; it starts scaled down to the dot
  const s0 = a.width / size;
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - ax;
  const dy = b.top + b.height / 2 - ay;
  // apex: above both ends, higher for longer jumps
  const lift = Math.min(220, 90 + Math.hypot(dx, dy) * 0.25);
  const peakY = Math.min(0, dy) - lift;

  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: `${ax - size / 2}px`,
    top: `${ay - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    boxSizing: 'border-box',
    borderStyle: 'solid',
    borderRadius: to.borderRadius,
    zIndex: '60',
    pointerEvents: 'none',
    willChange: 'transform',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);

  const blue = from.backgroundColor;
  const red = to.backgroundColor;
  const borderColor = to.borderTopColor;
  const borderWidth = to.borderTopWidth;
  const shadow = to.boxShadow === 'none' ? '0 0 0 transparent' : to.boxShadow;
  const t = (x: number, y: number, sx: number, sy: number, r: number) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;

  const anim = el.animate(
    [
      // crouch
      { offset: 0, transform: t(0, 0, s0, s0, 0), backgroundColor: blue, borderWidth: '0px', borderColor, boxShadow: '0 0 0 transparent', easing: 'ease-in' },
      { offset: 0.14, transform: t(0, size * s0 * 0.15, s0 * 1.3, s0 * 0.65, 0), backgroundColor: blue, borderWidth: '0px', borderColor, boxShadow: '0 0 0 transparent', easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
      // take-off → apex (paint + border + grow mid-air)
      { offset: 0.5, transform: t(dx * 0.45, peakY, 1.25, 1.25, 200), backgroundColor: red, borderWidth, borderColor, boxShadow: shadow, easing: 'cubic-bezier(0.55, 0, 0.85, 0.4)' },
      // fall → land with a squash
      { offset: 0.84, transform: t(dx, dy, 1.15, 0.78, 360), backgroundColor: red, borderWidth, borderColor, boxShadow: shadow, easing: 'ease-out' },
      { offset: 0.93, transform: t(dx, dy, 0.94, 1.08, 360), backgroundColor: red, borderWidth, borderColor, boxShadow: shadow, easing: 'ease-in-out' },
      { offset: 1, transform: t(dx, dy, 1, 1, 360), backgroundColor: red, borderWidth, borderColor, boxShadow: shadow },
    ],
    { duration: DURATION, fill: 'forwards', direction: reverse ? 'reverse' : 'normal' },
  );

  return anim.finished
    .catch(() => undefined)
    .then(() => {
      // remove on the next frame, after the real rider has been revealed underneath
      requestAnimationFrame(() => el.remove());
    });
}
