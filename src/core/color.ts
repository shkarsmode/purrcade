/**
 * Colours, and the one place they are adjusted for how the screen is being watched.
 *
 * Every colour in the game goes through col() when a sprite or a background is built, so a
 * display mode is a change to that function and a rebuild of the caches — not a filter laid over
 * every frame. "Cat vision" leans the palette the way a cat's eye does: blues and yellows kept
 * strong, reds pulled toward the yellow-brown a cat actually sees them as, greens greyed.
 */
export type Mode = 'normal' | 'cat' | 'contrast';

let mode: Mode = 'normal';
let generation = 0;
const memo = new Map<string, string>();

export function setMode(m: Mode) {
  if (m === mode) return;
  mode = m;
  memo.clear();
  generation++;
}

export function colorMode(): Mode {
  return mode;
}

/** Changes whenever the colours do — caches keyed on it rebuild themselves. */
export function colorGeneration(): number {
  return generation;
}

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

export function shade(c: string, k: number): string {
  return k < 0 ? mix(c, '#000000', -k) : mix(c, '#ffffff', k);
}

function transform(c: string): string {
  if (mode === 'normal') return c;
  let [r, g, b] = rgb(c);
  if (mode === 'cat') {
    // A cat is a dichromat: red and green fall onto one yellow axis, blue stays blue. So red and
    // green both become the same yellow-olive at their brightness, blues keep their blue.
    const y = r * 0.45 + g * 0.55;
    r = y; g = y * 0.96;
    // A little less colour overall, a little more contrast — shape and movement matter more.
    const l = (r + g + b) / 3;
    r = l + (r - l) * 0.9; g = l + (g - l) * 0.9; b = l + (b - l) * 0.95;
    const c = (v: number) => (v - 128) * 1.12 + 128;
    r = c(r); g = c(g); b = c(b);
  } else if (mode === 'contrast') {
    const f = (v: number) => (v - 128) * 1.35 + 128;
    r = f(r); g = f(g); b = f(b);
  }
  return hex(r, g, b);
}

/** A colour, as the current display mode shows it. */
export function col(c: string): string {
  let v = memo.get(c);
  if (!v) { v = transform(c); memo.set(c, v); }
  return v;
}
