/**
 * A red squirrel, side on: bounding run in four frames with the tail streaming and arching, sitting
 * up with a nut in its paws and the tail curled up its back, clinging to a trunk head-up, and
 * digging. Ear tufts, a pale belly, a tail fluffier than the rest of it.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U, E, G } from './common';

export type SqPose = 'run' | 'sit' | 'climb' | 'dig';
const B = 5, L = 6, D = 7, BE = 8, T = 9, TL = 10, NUT = 11, NUTC = 12;
const PAL = [...BASE, '#c8602a', '#e88a4a', '#8a3a1a', '#f4e0c0', '#b8501f', '#e8904a', '#8a5a2a', '#5a3a1a'];

export const SQ = { w: 28, h: 24, ax: 14, ay: 23 };

function tailBlob(p: Pix, pts: [number, number][], r: number) {
  for (let i = 1; i < pts.length; i++) p.capsule(pts[i - 1], pts[i], r, T);
  const e = pts[pts.length - 1];
  p.disc(e[0], e[1], r + 0.6, T);
}

function head(p: Pix, x: number, y: number, up = false) {
  p.disc(x, y, 3.4, B);
  if (up) { p.ellipse(x, y - 3.2, 1.6, 1.8, B); p.tri([x + 1.2, y - 1.6], [x + 3.4, y - 1.2], [x + 3.6, y - 4.4], B); }
  else { p.ellipse(x + 3, y + 0.9, 1.9, 1.5, B); p.tri([x - 2.2, y - 2.2], [x - 0.2, y - 2.4], [x - 1.6, y - 5.8], B); }
}

function draw(p: Pix, pose: SqPose, f: number) {
  if (pose === 'run') {
    const k = f & 3;
    const bodies: [number, number, number, number, number][] = [[13, 16, 7, 3.4, -0.08], [13, 15.4, 5.2, 4.2, 0], [13, 16, 6.4, 3.6, -0.05], [13, 14.6, 6.2, 3.6, 0.05]];
    const [bx, by, rx, ry, rot] = bodies[k];
    const tails: [number, number][][] = [
      [[7, 15], [3, 11], [1.6, 7]],
      [[8, 13], [5.6, 7], [8, 3.4]],
      [[7, 15], [3.4, 10], [3, 5.6]],
      [[7, 14], [2.6, 12], [1.4, 9]],
    ];
    tailBlob(p, tails[k], 3.2);
    const legs: [number, number, number, number][][] = [
      [[18, 18, 22, 21.6], [9, 18, 5, 21.6]],
      [[16, 18, 15, 22], [10, 18, 12, 22]],
      [[17.6, 18, 20, 22], [9.4, 18, 7, 22]],
      [[17, 17, 19, 19.6], [10, 17, 8, 19.6]],
    ];
    for (const [x0, y0, x1, y1] of legs[k]) p.capsule([x0, y0], [x1, y1], 1.1, D);
    p.ellipse(bx, by, rx, ry, (_x, _y, _u, v) => (v > 0.35 ? BE : B), rot);
    head(p, k === 1 ? 18.6 : 20, by - 3.6);
    p.rim([[B, L, D], [T, TL, 0], [BE, 0, 0]]);
    p.outline(O, U);
    const hx = k === 1 ? 18.6 : 20;
    p.set(hx + 1, by - 4.4, E); p.set(hx + 0.2, by - 5, G);
    return;
  }
  if (pose === 'sit') {
    const d = f & 1 ? 0.8 : 0;
    tailBlob(p, [[10, 21], [6.4, 15], [6.4, 9], [9, 4.6]], 3.3);
    p.ellipse(14, 20.8, 3.4, 1.2, D);
    p.ellipse(14, 15.6, 4.4, 6, (_x, _y, u) => (u > 0.3 ? BE : B), 0.12);
    head(p, 16, 8 + d);
    p.disc(18.4, 12 + d * 0.5, 1.8, NUT); p.rect(17.4, 10.2 + d * 0.5, 19.4, 10.8 + d * 0.5, NUTC);
    p.capsule([15.4, 12.6], [17.6, 12.4 + d * 0.5], 0.9, B);
    p.rim([[B, L, D], [T, TL, 0], [BE, 0, 0]]);
    p.outline(O, U);
    p.set(17, 7.2 + d, E); p.set(16.2, 6.6 + d, G);
    return;
  }
  if (pose === 'climb') {
    const s = f & 1 ? 1 : -1;
    tailBlob(p, [[12.6, 19], [15, 21.4], [16.6, 21.2]], 2.7);
    for (const [y0, y1] of [[8, 7 + s], [17, 18 - s]]) p.capsule([11, y0], [8, y1], 1.1, D);
    p.ellipse(12, 14, 3.4, 6.6, (_x, _y, u) => (u < -0.35 ? BE : B));
    head(p, 12, 5.4, true);
    p.rim([[B, L, D], [T, TL, 0], [BE, 0, 0]]);
    p.outline(O, U);
    p.set(13.2, 4.4, E); p.set(13.6, 3.6, G);
    return;
  }
  // dig: head down, front paws scrabbling.
  const s = f & 1 ? 1 : -1;
  tailBlob(p, [[8, 16], [4.6, 10], [6, 5]], 3.2);
  p.capsule([17, 19], [20 + s, 22], 1.1, D); p.capsule([10, 19], [8, 22], 1.2, D);
  p.ellipse(13, 17, 5.6, 3.8, (_x, _y, _u, v) => (v > 0.35 ? BE : B), 0.3);
  head(p, 19, 19);
  p.rim([[B, L, D], [T, TL, 0], [BE, 0, 0]]);
  p.outline(O, U);
  p.set(20, 18.4, E);
}

export function squirrelSprite(pose: SqPose, f = 0): HTMLCanvasElement {
  const n = pose === 'run' ? f & 3 : f & 1;
  return sprite('sq:' + pose + n, SQ.w, SQ.h, (p) => draw(p, pose, n), PAL);
}

export function acornSprite(): HTMLCanvasElement {
  return sprite('acorn', 7, 8, (p) => {
    p.ellipse(3.5, 5, 2.4, 2.6, NUT);
    p.rect(1, 2, 6, 3, NUTC); p.set(3.5, 1, NUTC); p.set(3.5, 0, D);
    p.rim([[NUT, 10, 0]]);
    p.outline(O, U);
  }, PAL);
}
