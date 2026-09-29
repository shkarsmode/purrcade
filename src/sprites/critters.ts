/**
 * Things that come up out of holes: a mole seen from the front with its pink nose and big
 * digging paws on the rim, a rabbit whose ears come up first, and the golden mole that is worth
 * a star. And the rim of the hole itself, drawn in front of whoever is coming out.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U, E, G } from './common';

export type Popper = 'mole' | 'gold' | 'bunny';
export type PopFace = 'up' | 'left' | 'right' | 'dizzy' | 'flower';

const MOLE = ['#6a5e70', '#8a7e92', '#4a4052', '#f59aa8', '#ffc0c8', '#f4d23a', '#3d8a3a', '#e8433a'];
const GOLD = ['#e8b030', '#ffe08a', '#b8801a', '#ffb0a0', '#ffd8d0', '#ffffff', '#3d8a3a', '#e8433a'];
const BUNNY = ['#e8e0d8', '#ffffff', '#b8aca0', '#f5a3b0', '#ffd0d8', '#f4d23a', '#3d8a3a', '#e8433a'];

export const POP = { w: 24, h: 26, ax: 12, ay: 25 };

function drawPopper(p: Pix, kind: Popper, face: PopFace) {
  const B = 5, L = 6, D = 7, PK = 8, PL = 9, Y = 10, GR = 11, RD = 12;
  const lx = face === 'left' ? -1.5 : face === 'right' ? 1.5 : 0;
  if (kind === 'bunny') {
    p.capsule([8.5 + lx, 12], [7 + lx, 1.6], 2.2, B); p.capsule([15.5 + lx, 12], [17 + lx, 1.6], 2.2, B);
    p.capsule([8.5 + lx, 11], [7.4 + lx, 3.6], 0.9, PK); p.capsule([15.5 + lx, 11], [16.6 + lx, 3.6], 0.9, PK);
    p.ellipse(12, 19, 8, 6.4, B);
    p.ellipse(12 + lx, 15.5, 6.6, 5.6, B);
    p.disc(12 + lx, 18, 1.3, PK);
    p.rect(8, 23, 10, 25, B); p.rect(14, 23, 16, 25, B);
  } else {
    p.ellipse(12, 18, 9, 8, B);
    p.ellipse(12 + lx, 15, 7, 6, B);
    // The long pink nose and the shovel paws on the rim of the hole.
    p.ellipse(12 + lx * 1.6, 18.4, 2.4, 1.8, PK);
    p.ellipse(5, 23, 3.6, 2.4, PK); p.ellipse(19, 23, 3.6, 2.4, PK);
    for (const x of [3, 5, 7]) p.set(x, 24.6, PL);
    for (const x of [17, 19, 21]) p.set(x, 24.6, PL);
  }
  if (face === 'flower') {
    p.line(17, 22, 20, 13, GR); p.set(19, 16, GR);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(20 + dx, 12 + dy, kind === 'gold' ? RD : Y);
    p.set(20, 12, kind === 'gold' ? Y : RD);
  }
  p.rim([[B, L, D], [PK, PL, 0]]);
  p.outline(O, U);
  if (face === 'dizzy') {
    for (const ex of [9 + lx, 15 + lx]) { p.set(ex - 1, 13, E); p.set(ex + 1, 13, E); p.set(ex, 14, E); p.set(ex - 1, 15, E); p.set(ex + 1, 15, E); }
  } else if (kind === 'bunny') {
    p.set(9 + lx, 14, E); p.set(15 + lx, 14, E); p.set(9 + lx, 13, G); p.set(15 + lx, 13, G);
  } else {
    p.set(9 + lx, 14, E); p.set(15 + lx, 14, E);
  }
}

export function popperSprite(kind: Popper, face: PopFace): HTMLCanvasElement {
  return sprite('pop:' + kind + face, POP.w, POP.h, (p) => drawPopper(p, kind, face), [...BASE, ...(kind === 'gold' ? GOLD : kind === 'bunny' ? BUNNY : MOLE)]);
}

/** The back and the front of a hole in the ground: the dark mouth behind, the earth lip in front. */
export function holeBack(): HTMLCanvasElement {
  return sprite('hole-back', 30, 12, (p) => {
    p.ellipse(15, 7, 14, 5, 5);
    p.ellipse(15, 7.5, 11, 3.6, 6);
    p.ellipse(15, 8, 9, 2.6, 7);
  }, [...BASE, '#8a6a4a', '#3a2818', '#1e140c']);
}

export function holeFront(): HTMLCanvasElement {
  return sprite('hole-front', 30, 12, (p) => {
    for (let x = 0; x < 30; x++) {
      const dx = (x - 15) / 14;
      const top = 7 + Math.sqrt(Math.max(0, 1 - dx * dx)) * 2.6;
      for (let y = Math.round(top); y < 12; y++) {
        const k = (y - top) / 3;
        if (Math.abs(dx) > 1) continue;
        p.set(x, y, k < 0.8 ? 6 : 5);
      }
    }
    for (let x = 4; x < 26; x += 3) p.set(x, 10, 7);
  }, [...BASE, '#8a6a4a', '#a8845a', '#6a4a2a']);
}

export type FrogPose = 'sit' | 'croak' | 'tongue' | 'jump';

/** A green frog, side on and facing right: goggle eyes on top, white throat, legs folded under. */
export function frogSprite(pose: FrogPose, f = 0): HTMLCanvasElement {
  return sprite('frog:' + pose + (f & 1), 26, 18, (p) => {
    const B = 5, L = 6, D = 7, BE = 8, EY = 9, SP = 10, TH = 11;
    const jump = pose === 'jump';
    if (jump) {
      p.capsule([8, 11], [1, 15], 1.6, B); p.capsule([9, 12], [2, 17], 1.3, B);
      p.ellipse(13, 9, 8, 4, (_x, _y, _u, v) => (v > 0.3 ? BE : B), -0.2);
      p.capsule([17, 12], [22, 15], 1.2, B);
    } else {
      p.ellipse(7, 13.5, 5, 3.4, B);                          // folded back leg
      p.ellipse(12.5, 11, 8, 5.4, (_x, _y, _u, v) => (v > 0.35 ? BE : B), -0.18);
      p.capsule([16.5, 14], [18.5, 17], 1.2, B);
      p.rect(3, 16, 9, 17, B);
    }
    const hy = jump ? 6 : 7;
    p.ellipse(19.5, hy + 1.5, 5, 3.4, B, 0.1);
    p.disc(17.6, hy - 1.4, 2.6, B); p.disc(21.8, hy - 1, 2.3, B);
    if (pose === 'croak') p.disc(20, hy + 5, 3.4 + (f & 1) * 0.8, TH);
    for (const [x, y] of [[9, 9], [12, 7.6], [7, 12], [14, 10.5]]) p.set(x, y, SP);
    p.rim([[B, L, D], [BE, 0, 0]]);
    p.outline(O, U);
    p.disc(17.8, hy - 1.8, 1.4, EY); p.set(18.2, hy - 1.8, E); p.set(17.4, hy - 2.6, G);
    p.disc(21.9, hy - 1.3, 1.1, EY); p.set(22.2, hy - 1.3, E);
    if (pose === 'tongue') { p.rect(23, hy + 2, 25, hy + 2, 12); }
    else p.line(21, hy + 2.6, 24, hy + 2, D);
  }, [...BASE, '#5ab84a', '#8fe070', '#357a33', '#e8f0c0', '#f4d23a', '#2e6a2a', '#f4f0d8', '#ff7a9a']);
}
