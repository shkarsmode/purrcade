/**
 * Cat toys: a ball of yarn that shows its turns as it rolls, a jingle ball full of holes, a
 * felt mouse on a string tail, a crumpled paper ball, and the self-rolling "smart" ball with a
 * light that blinks. Outlined and lit like everything else.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U } from './common';

const P = (cs: string[]) => [...BASE, ...cs];

export const YARN_COLORS: [string, string, string][] = [
  ['#e86a9a', '#ffa0c4', '#a8406a'],
  ['#5c9ed6', '#9fd0ff', '#3a6aa0'],
  ['#f2c14e', '#ffe08a', '#b88a24'],
  ['#8cc084', '#c0e8a8', '#5a8a54'],
];

/** A ball of yarn of radius 8, turned by `f` eighths. */
export function yarnSprite(ci: number, f: number): HTMLCanvasElement {
  const [b, l, d] = YARN_COLORS[ci % YARN_COLORS.length];
  const n = ((f % 8) + 8) % 8;
  return sprite('yarn' + ci + ':' + n, 19, 19, (p) => {
    const B = 5, L = 6, D = 7;
    p.disc(9.5, 9.5, 8, B);
    // Wraps of strand: a family of curves across the ball, slid along as it turns.
    for (let k = 0; k < 4; k++) {
      const ph = (n / 8) * Math.PI + k * 0.8;
      for (let a = -1.35; a <= 1.35; a += 0.09) {
        const x = 9.5 + Math.sin(a) * 7.2, y = 9.5 + Math.cos(a) * 7.2 * Math.sin(ph) * (k % 2 ? 1 : -1) * 0.9;
        if (p.get(x, y) === B) p.set(x, y, D);
      }
    }
    p.rim([[B, L, 0]]);
    p.outline(O, U);
  }, P([b, l, d]));
}

export function jingleSprite(c = '#f25a4a'): HTMLCanvasElement {
  return sprite('jingle' + c, 13, 13, (p) => {
    const B = 5, L = 6, D = 7, HOLE = 8;
    p.disc(6.5, 6.5, 5.4, B);
    for (const [x, y] of [[4, 5], [7, 3], [6, 7], [9, 7], [4, 8], [8, 10], [9, 4]]) p.set(x, y, HOLE);
    p.rim([[B, L, D]]);
    p.outline(O, U);
    p.set(4, 3, 4);
  }, P([c, '#ffb0a0', '#a8302a', '#2a1f2b']));
}

export function feltMouseSprite(c = '#7fb2e5', f = 0): HTMLCanvasElement {
  return sprite('felt' + c + (f & 1), 18, 10, (p) => {
    const B = 5, L = 6, D = 7, PK = 8, TL = 9;
    p.ellipse(9, 6.5, 5.5, 3, B, 0.05);
    p.tri([12, 4], [12, 9], [16, 7], B);
    p.disc(11, 3.4, 1.8, PK);
    p.rim([[B, L, D]]);
    p.outline(O, U);
    p.set(14, 5.6, 3);
    const w = f & 1 ? 1 : -1;
    for (let i = 0; i < 5; i++) p.set(3 - i, 7 + Math.round(Math.sin(i * 0.9) * w), TL);
  }, P([c, '#b8dcff', '#4f7fb5', '#f5a3ae', '#e0e0e0']));
}

export function paperSprite(f = 0): HTMLCanvasElement {
  return sprite('paper' + (f & 3), 11, 11, (p) => {
    const B = 5, L = 6, D = 7;
    const pts: [number, number][] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + (f & 3) * 0.7; const r = 3.6 + ((i * 7 + (f & 3)) % 3) * 0.6; pts.push([5.5 + Math.cos(a) * r, 5.5 + Math.sin(a) * r]); }
    for (let i = 0; i < pts.length; i++) p.tri([5.5, 5.5], pts[i], pts[(i + 1) % pts.length], B);
    for (let i = 0; i < 3; i++) { const [x, y] = pts[(i * 3 + (f & 3)) % pts.length]; p.line(5.5, 5.5, x, y, D); }
    p.rim([[B, L, 0]]);
    p.outline(O, U);
  }, P(['#eeeae0', '#ffffff', '#b9b2a2']));
}

export function smartBallSprite(led: string): HTMLCanvasElement {
  return sprite('smart' + led, 13, 13, (p) => {
    const T = 5, TL = 6, BOT = 7, BD = 8, LED = 9;
    p.disc(6.5, 6.5, 5.2, (_x, y) => (y < 6 ? T : BOT));
    p.rect(2, 6, 11, 6, BD);
    p.set(6, 3, LED); p.set(7, 3, LED);
    p.rim([[T, TL, 0], [BOT, 0, BD]]);
    p.outline(O, U);
  }, P(['#f4f4f8', '#ffffff', '#3ab0a0', '#237a70', led]));
}
