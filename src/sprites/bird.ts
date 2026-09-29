/**
 * Small garden birds, side on, facing right: a round body, a round head, a short beak, a tail
 * cocked or trailing. Species differ in colour and in a mark or two — a blue cap, a red breast,
 * a black bib — which is all it takes at sixteen pixels. They perch, flick their tails, peck,
 * hop, and fly in the bounding way finches do: a few beats, then wings shut and a dip.
 * The pigeon is bigger, walks rather than hops, and nods as it goes.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U, E, G } from './common';

export type Species = 'sparrow' | 'bluetit' | 'robin' | 'bullfinch' | 'goldfinch' | 'pigeon';
export type BirdPose = 'perch' | 'peck' | 'hop' | 'fly' | 'ball' | 'walk';

//                         body       light      dark       belly      cap        wing       wingbar    cheek      beak
const LOOK: Record<Species, string[]> = {
  sparrow: ['#a9794a', '#c99a66', '#7a5230', '#e8d6b6', '#8a6a55', '#86592f', '#f1e2c4', '#f3ebdc', '#3a2a20'],
  bluetit: ['#8fb84a', '#b5d86a', '#5f8a2e', '#f6d93a', '#3c7ad8', '#4a86d8', '#ffffff', '#ffffff', '#2a2430'],
  robin: ['#8a6a4a', '#a88a66', '#5f4630', '#f07a3a', '#8a6a4a', '#6e5238', '#b39270', '#f07a3a', '#2a2430'],
  bullfinch: ['#6e7486', '#8e95a8', '#4a4f5e', '#ec5a44', '#1e1a24', '#26242e', '#e9e6ee', '#ec5a44', '#1e1a24'],
  goldfinch: ['#c9a36c', '#e0bf8a', '#9a7648', '#f4ead8', '#1e1a24', '#1e1a24', '#f6d21e', '#ffffff', '#e9d2b0'],
  pigeon: ['#9098ab', '#b2b9ca', '#666d80', '#aab1c2', '#7c849a', '#7a8196', '#3c4152', '#6fa392', '#3a3440'],
};
const B = 5, L = 6, D = 7, BE = 8, CAP = 9, WG = 10, WB = 11, CH = 12, BK = 13, LEG = 14, IRI = 15, MASK = 16, PEYE = 17;

function palette(s: Species): string[] {
  return [...BASE, ...LOOK[s], '#b8845a', '#b27ac0', '#e23a3a', '#e8702a'];
}

export const BIRD = { w: 20, h: 16, ax: 9, ay: 15 };
export const PIGEON = { w: 30, h: 24, ax: 14, ay: 23 };

function songbird(p: Pix, s: Species, pose: BirdPose, f: number) {
  const fly = pose === 'fly' || pose === 'ball';
  const peck = pose === 'peck';
  const hop = pose === 'hop';
  // Body, and where the head sits on it.
  const by = fly ? 8 : hop ? 8.6 : 9.2;
  const brot = fly ? 0 : peck ? 0.45 : -0.28 + (f === 1 && pose === 'perch' ? 0.08 : 0);
  let hx = 13.2, hy = fly ? 6 : 5.8;
  if (peck) { hx = 14; hy = 10 + (f ? 1.2 : 0); }
  if (hop) hy = 5.4;
  // Tail.
  const tailDown = pose === 'perch' && f === 1 ? -2.5 : 0;
  if (fly) p.tri([5, by - 1], [0.5, by - 0.5], [1, by + 1.8], WG);
  else if (peck) p.tri([5, by - 1], [0.5, by - 4.5], [1.5, by - 2.8], WG);
  else p.tri([5.5, by + 0.5], [1, by + 5 + tailDown], [2.4, by + 6 + tailDown], WG);
  // Legs (before the body so it covers their tops).
  if (!fly) {
    const ly = hop ? 13.4 : 14.6;
    p.line(8.5, by + 3, 8.5, ly, LEG); p.line(10, by + 3, 10.4, ly, LEG);
  }
  p.ellipse(8.4, by, 5.2, 3.9, (_x, _y, _u, v) => (v > 0.12 ? BE : B), brot);
  // Head: cap on top, cheek below the eye.
  p.disc(hx, hy, 3.1, (_x, _y, _u, v) => (v < -0.25 ? CAP : B));
  if (s === 'bluetit' || s === 'sparrow' || s === 'goldfinch' || s === 'bullfinch') p.ellipse(hx + 0.4, hy + 1, 1.8, 1.2, CH);
  if (s === 'bullfinch') p.disc(hx + 1.5, hy + 0.2, 1.5, CAP);
  if (s === 'goldfinch') p.ellipse(hx + 1.9, hy + 0.2, 1.3, 1.7, MASK);
  if (s === 'robin') p.ellipse(hx - 0.6, hy + 1.8, 2.8, 2, BE);
  // Beak.
  const bx = hx + 2.6, bY = hy + 0.2;
  p.tri([bx, bY - 1.1], [bx, bY + 1], [bx + 2.4, bY + 0.1], BK);
  // Wing.
  if (!fly) {
    p.ellipse(7.6, by - 0.2, 4.2, 2.4, WG, brot + 0.1);
    p.line(5.6, by + 0.4 + (peck ? 1 : 0), 9.4, by + (peck ? 1.2 : -0.4), WB);
  } else if (pose === 'ball') {
    p.ellipse(7.8, by - 0.5, 4, 2.2, WG, 0.05);
    p.line(6, by, 9.6, by - 0.6, WB);
  } else {
    const k = f & 3;
    if (k === 0) { p.tri([6, by - 1], [11, by - 1.5], [4.5, 0.5], WG); p.line(6, by - 3, 8, by - 2, WB); }
    else if (k === 2) { p.tri([6, by + 0.5], [11, by], [5, 15], WG); p.line(7, by + 3, 8.5, by + 2, WB); }
    else { p.ellipse(7.5, by - 1.4, 5.8, 1.6, WG, -0.08); p.line(3, by - 1.4, 9, by - 1.8, WB); }
  }
  p.rim([[B, L, D], [BE, 0, 0], [CAP, 0, 0], [MASK, 0, 0]]);
  p.outline(O, U);
  // The eye, after the outline so it sits in the face.
  p.set(hx + 1, hy - 0.4, E);
  if (s !== 'bullfinch' && s !== 'goldfinch') p.set(hx + 0.2, hy - 1.2, G);
}

function pigeon(p: Pix, pose: BirdPose, f: number) {
  const fly = pose === 'fly' || pose === 'ball';
  const peck = pose === 'peck';
  // A pigeon walks with its head going forward and back.
  const nod = pose === 'walk' ? [0, 1.8, 2.8, 1.2][f & 3] : 0;
  const by = fly ? 12 : 14;
  if (fly) p.tri([8, by - 1], [1, by - 2], [1.5, by + 2.5], WG);
  else p.tri([8.5, by], [1, by + 3.5], [2.5, by + 5.5], WG);
  if (!fly) {
    const st = pose === 'walk' ? [[0, 0], [1, -1], [0, 0], [-1, 1]][f & 3] : [0, 0];
    p.line(13 + st[0], by + 4, 13 + st[0], 22.6, LEG); p.line(16 + st[1], by + 4, 16.4 + st[1], 22.6, LEG);
    p.set(14 + st[0], 22.6, LEG); p.set(17.4 + st[1], 22.6, LEG);
  }
  p.ellipse(14, by, 8.6, 5.6, (_x, _y, _u, v) => (v > 0.3 ? BE : B), fly ? 0 : peck ? 0.35 : -0.12);
  const hx = peck ? 23 : 21 + nod, hy = peck ? 16 : fly ? 8.6 : 7.4;
  p.capsule([18, by - 3], [hx - 1, hy + 1.5], 3.2, (_x, _y, u) => (u > 0.2 && u < 0.8 ? IRI : B));
  p.disc(hx, hy, 3.4, CAP);
  p.tri([hx + 2.8, hy - 0.6], [hx + 2.8, hy + 1.3], [hx + 5.4, hy + 0.8], BK);
  p.set(hx + 3, hy - 0.8, 7);
  if (!fly) {
    p.ellipse(12.5, by - 0.8, 7, 3.6, WG, -0.12);
    p.line(9, by + 0.2, 15, by - 0.6, WB); p.line(10, by + 2, 16, by + 1.2, WB);
  } else {
    const k = f & 3;
    if (k === 0) p.tri([10, by - 2], [18, by - 2], [8, 0.5], WG);
    else if (k === 2) p.tri([10, by + 1], [18, by], [9, 23], WG);
    else p.ellipse(12, by - 2, 9.5, 2.2, WG, -0.05);
    if (k === 0) p.line(9, 2, 11, 8, WB);
  }
  p.rim([[B, L, D], [CAP, L, 0], [WG, 0, D]]);
  p.outline(O, U);
  p.set(hx + 0.8, hy - 0.8, PEYE);
}

export function birdSprite(s: Species, pose: BirdPose, f = 0): HTMLCanvasElement {
  const n = pose === 'fly' || pose === 'walk' ? f & 3 : f & 1;
  if (s === 'pigeon') return sprite('pigeon:' + pose + n, PIGEON.w, PIGEON.h, (p) => pigeon(p, pose, n), palette(s));
  return sprite('bird:' + s + pose + n, BIRD.w, BIRD.h, (p) => songbird(p, s, pose, n), palette(s));
}

export function birdBox(s: Species) {
  return s === 'pigeon' ? PIGEON : BIRD;
}

/** A herring gull, side on: white, grey mantle, black wingtips, yellow bill with the red spot. */
export function gullSprite(pose: 'stand' | 'walk' | 'fly' | 'glide', f = 0): HTMLCanvasElement {
  const n = pose === 'walk' ? f & 1 : pose === 'fly' ? f & 3 : 0;
  return sprite('gull:' + pose + n, 36, 24, (p) => {
    const W = 5, WL = 6, WD = 7, GR = 8, GL = 9, K = 10, BK = 11, RD = 12, LG = 13;
    const fly = pose === 'fly' || pose === 'glide';
    const by = fly ? 12 : 13;
    if (!fly) {
      const st = pose === 'walk' ? (n ? 1.5 : -1.5) : 0;
      p.line(15 + st, by + 4, 15 + st, 22.6, LG); p.line(18 - st, by + 4, 18 - st, 22.6, LG);
      p.set(16 + st, 22.6, LG); p.set(19 - st, 22.6, LG);
    }
    p.tri([9, by - 1], [2, by - 2.5 + (fly ? 1 : 2)], [3, by + 1.5], W);
    p.ellipse(15, by, 8, 4.4, W, fly ? 0 : -0.1);
    p.disc(23.5, by - 4 + (fly ? 1.5 : 0), 3.6, W);
    const hy = by - 4 + (fly ? 1.5 : 0);
    p.tri([26.5, hy - 0.6], [26.5, hy + 1.2], [31, hy + 0.4], BK);
    p.set(29.6, hy + 1, RD);
    if (!fly) {
      p.ellipse(13.5, by - 1.2, 7.6, 3, GR, -0.12);
      p.rect(5, by - 1, 8, by + 1, K);
    } else if (pose === 'glide') {
      p.tri([10, by - 2], [20, by - 2], [15, by - 11], GR); p.tri([13, by - 9], [17, by - 9], [15, by - 12], K);
    } else {
      const k = n;
      if (k === 0) { p.tri([10, by - 2], [20, by - 2], [12, 0], GR); p.rect(11, 0, 13, 2, K); }
      else if (k === 2) { p.tri([10, by], [20, by], [13, 23], GR); p.rect(12, 21, 14, 23, K); }
      else { p.ellipse(14, by - 2, 11, 2.2, GR); p.rect(2, by - 3, 5, by - 1, K); }
    }
    p.rim([[W, WL, WD], [GR, GL, 0]]);
    p.outline(O, U);
    p.set(24.5, hy - 1, E);
  }, [...BASE, '#fbfbf8', '#ffffff', '#c9cfd8', '#9aa8b8', '#c0cad6', '#2a2430', '#f4c430', '#e8442e', '#f0b890']);
}

/** A sandpiper: a little wader on long legs that runs after the waves. */
export function piperSprite(pose: 'stand' | 'run' | 'peck', f = 0): HTMLCanvasElement {
  const n = pose === 'run' ? f & 1 : 0;
  return sprite('piper:' + pose + n, 18, 15, (p) => {
    const B = 5, L = 6, D = 7, BE = 8, BK = 9, LG = 10;
    const peck = pose === 'peck';
    if (pose === 'run') { p.line(8, 9, n ? 5 : 11, 14, LG); p.line(9, 9, n ? 11 : 6, 14, LG); }
    else { p.line(8, 9, 7.6, 14, LG); p.line(9.6, 9, 10, 14, LG); }
    p.ellipse(8.5, 7, 5, 3, (_x, _y, _u, v) => (v > 0.1 ? BE : B), peck ? 0.5 : -0.15);
    const hx = peck ? 13 : 12.5, hy = peck ? 9 : 4;
    p.disc(hx, hy, 2.2, B);
    p.line(hx + 2, hy + 0.4, hx + 5, hy + (peck ? 3 : 1.2), BK);
    p.rim([[B, L, D], [BE, 0, 0]]);
    p.outline(O, U);
    p.set(hx + 0.6, hy - 0.6, E);
  }, [...BASE, '#a08a70', '#c0a888', '#6a5a48', '#fbf8f0', '#2a2430', '#3a3440']);
}
