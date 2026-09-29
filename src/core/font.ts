/**
 * A tiny bitmap font for the few words drawn inside the world — "+1", a score, a clock — so they
 * are made of the same pixels as the scene. Everything a person reads at length is HTML.
 */
import { col } from './color';

const G: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '×': ['...', '#.#', '.#.', '#.#', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['###', '..#', '.##', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'],
  '♥': ['.....', '##.##', '#####', '.###.', '..#..'],
  '★': ['..#..', '.###.', '#####', '.###.', '.#.#.'],
  '♪': ['.##', '.#.', '.#.', '##.', '##.'],
  'z': ['...', '###', '.#.', '#..', '###'],
  'Z': ['###', '..#', '.#.', '#..', '###'],
};

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (G[ch] || G[' '])[0].length + 1;
  return Math.max(0, w - 1);
}

/** Centred on x, baseline at y, with a one-pixel dark shadow so it reads on anything. */
export function pixelText(g: CanvasRenderingContext2D, s: string, x: number, y: number, c = '#ffffff', shadow = '#1a1420') {
  const w = textWidth(s);
  let X = Math.round(x - w / 2);
  const Y = Math.round(y - 5);
  const cc = col(c), sh = col(shadow);
  for (const ch of s) {
    const gl = G[ch] || G[' '];
    for (let r = 0; r < gl.length; r++) {
      for (let q = 0; q < gl[r].length; q++) {
        if (gl[r][q] !== '#') continue;
        g.fillStyle = sh; g.fillRect(X + q + 1, Y + r + 1, 1, 1);
        g.fillStyle = cc; g.fillRect(X + q, Y + r, 1, 1);
      }
    }
    X += gl[0].length + 1;
  }
}
