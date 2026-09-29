/**
 * The PURRCADE logo, drawn in pixels: chunky letters in a sunset gradient with a dark outline,
 * a drop shadow and a pair of cat ears on the P. Built once into a small canvas that CSS scales
 * up without smoothing.
 */
import { Pix } from '../core/pix';

const GLYPHS: Record<string, string[]> = {
  P: ['#####.', '##..##', '##..##', '#####.', '##....', '##....', '##....'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  R: ['#####.', '##..##', '##..##', '#####.', '##.##.', '##..##', '##..##'],
  C: ['.####.', '##..##', '##....', '##....', '##....', '##..##', '.####.'],
  A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  D: ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
  E: ['######', '##....', '##....', '#####.', '##....', '##....', '######'],
};

//                 0 empty  outline    shadow     rows of the gradient, top to bottom                               ear pink   glint
const PAL = ['', '#1a1024', '#3a2254', '#fff3a0', '#ffe066', '#ffc94a', '#ffab40', '#ff8a4a', '#ff6a6a', '#f05a8a', '#ff9ab8', '#ffffff'];

export function logoCanvas(word = 'PURRCADE'): HTMLCanvasElement {
  const gw = 6, gh = 7, gap = 1;
  const W = word.length * (gw + gap) - gap + 4, H = gh + 7;
  const p = new Pix(W, H);
  const oy = 4;
  const at = (i: number) => 2 + i * (gw + gap);
  // Shadow first, one pixel down and right.
  for (let i = 0; i < word.length; i++) {
    const g = GLYPHS[word[i]];
    if (!g) continue;
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (g[r][c] === '#') p.set(at(i) + c + 1, oy + r + 1, 2);
  }
  for (let i = 0; i < word.length; i++) {
    const g = GLYPHS[word[i]];
    if (!g) continue;
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (g[r][c] === '#') p.set(at(i) + c, oy + r, 3 + Math.min(6, r));
  }
  // Cat ears on the P, with pink inside.
  const x0 = at(0);
  p.tri([x0 - 0.5, oy + 0.5], [x0 + 2.5, oy + 0.5], [x0 + 0.5, oy - 3.2], 3);
  p.tri([x0 + 2.5, oy + 0.5], [x0 + 5.5, oy + 0.5], [x0 + 4.5, oy - 3.2], 3);
  p.set(x0 + 1, oy - 1, 10); p.set(x0 + 4, oy - 1, 10);
  p.outline(1, 1);
  // A glint on the first letters.
  p.set(at(0) + 1, oy + 1, 11); p.set(at(2) + 1, oy + 1, 11);
  return p.canvas(PAL);
}
