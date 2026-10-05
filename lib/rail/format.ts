export const pad = (n: number, len = 2) => String(Math.max(0, Math.round(n))).padStart(len, '0');

export const coord = (n: number) => {
  const r = Math.round(n);
  return (r < 0 ? '-' : '') + String(Math.abs(r)).padStart(5, '0');
};

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export const smoothstep = (t: number) => t * t * (3 - 2 * t);
