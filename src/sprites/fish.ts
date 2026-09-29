/**
 * Aquarium fish, side on and facing right, each in three frames of a tail beat: neon tetras that
 * shine blue, a clownfish in its white bands, a tall striped angelfish, a fantailed goldfish, a
 * blue tang, a betta trailing its fins, and a pufferfish that blows itself up into a spiky ball.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U, E, G } from './common';

const P = (cs: string[]) => [...BASE, ...cs];
export type FishKind = 'neon' | 'clown' | 'angel' | 'gold' | 'tang' | 'betta' | 'puffer';

export const FISH_BOX: Record<FishKind, { w: number; h: number }> = {
  neon: { w: 12, h: 7 }, clown: { w: 17, h: 12 }, angel: { w: 16, h: 20 }, gold: { w: 20, h: 13 },
  tang: { w: 19, h: 13 }, betta: { w: 22, h: 17 }, puffer: { w: 17, h: 17 },
};

function tail(p: Pix, x: number, y: number, f: number, len: number, spread: number, c: number) {
  const sw = [0, 1, -1][f % 3];
  p.tri([x + 1, y], [x - len, y - spread + sw], [x - len + 1, y + spread + sw], c);
}

export function fishSprite(kind: FishKind, f: number, puffed = false): HTMLCanvasElement {
  const n = f % 3;
  const box = FISH_BOX[kind];
  return sprite('fish:' + kind + n + (puffed ? 'p' : ''), box.w, box.h, (p) => {
    switch (kind) {
      case 'neon': {
        const B = 5, ST = 6, RD = 7, FN = 8;
        tail(p, 3, 3.5, n, 3, 2, FN);
        p.ellipse(6.5, 3.5, 4.5, 1.9, B);
        p.rect(4, 3, 10, 3, ST);
        p.rect(3, 4, 6, 4, RD);
        p.outline(O, U);
        p.set(10, 3, E);
        break;
      }
      case 'clown': {
        const B = 5, L = 6, D = 7, W = 8, K = 9;
        tail(p, 4, 6, n, 4, 3.4, B);
        p.ellipse(9.5, 6, 6, 4, B);
        p.ellipse(8, 2.2, 3, 1.4, B);
        p.ellipse(8, 9.8, 2.4, 1.2, B);
        for (const x of [12.5, 8.5, 4.5]) { p.rect(x - 1, 2.5, x, 9.5, K); p.rect(x - 0.5, 2.5, x + 0.5, 9.5, W); }
        p.rim([[B, L, D]]);
        p.outline(O, U);
        p.set(13.5, 5, E); p.set(13.5, 4, G);
        break;
      }
      case 'angel': {
        const B = 5, L = 6, K = 7, FN = 8;
        tail(p, 3, 10, n, 3, 2.5, FN);
        p.tri([4, 10], [11, 1], [9, 10], FN);
        p.tri([4, 10], [11, 19], [9, 10], FN);
        p.ellipse(9, 10, 5, 5.5, B);
        for (const x of [7, 10]) p.rect(x, 5, x, 15, K);
        p.rim([[B, L, 0]]);
        p.outline(O, U);
        p.set(12, 9, E);
        break;
      }
      case 'gold': {
        const B = 5, L = 6, D = 7, FN = 8;
        const sw = [0, 1, -1][n];
        p.tri([6, 6.5], [0, 1 + sw], [2, 6.5], FN); p.tri([6, 6.5], [0, 12 + sw], [2, 6.5], FN);
        p.ellipse(11, 6.5, 6, 4.4, B);
        p.tri([9, 2.6], [13, 2.4], [10, 0.5], FN);
        p.rim([[B, L, D]]);
        p.outline(O, U);
        p.set(15, 5, E); p.set(15, 4, G);
        break;
      }
      case 'tang': {
        const B = 5, L = 6, K = 7, Y = 8;
        tail(p, 5, 6.5, n, 4, 3.6, Y);
        p.ellipse(11, 6.5, 6.5, 4.6, B);
        p.line(7, 4, 13, 3.6, K); p.line(13, 3.6, 10, 6, K); p.line(7, 7, 11, 6, K);
        p.rim([[B, L, 0]]);
        p.outline(O, U);
        p.set(15, 5, E); p.set(15, 4, G);
        break;
      }
      case 'betta': {
        const B = 5, L = 6, FN = 7, FL = 8;
        const sw = [0, 1, -1][n];
        // Great veils of fin above, below and behind.
        p.ellipse(5, 8.5 + sw * 0.5, 5.5, 6.5, FN, 0.2);
        p.tri([8, 6], [3, 0.5 + sw], [12, 4], FL);
        p.tri([8, 11], [3, 16.5 + sw], [12, 12], FL);
        p.ellipse(13, 8.5, 6, 3, B);
        p.rim([[B, L, 0], [FN, FL, 0]]);
        p.outline(O, U);
        p.set(17, 7.6, E);
        break;
      }
      case 'puffer': {
        const B = 5, L = 6, BE = 7, SP = 8, FN = 9;
        if (puffed) {
          p.disc(8.5, 8.5, 6.6, (_x, y) => (y > 10 ? BE : B));
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) p.set(8.5 + Math.cos(a) * 7.8, 8.5 + Math.sin(a) * 7.8, SP);
          for (const [x, y] of [[6, 6], [10, 5], [8, 8], [5, 10]]) p.set(x, y, SP);
          p.rim([[B, L, 0]]);
          p.outline(O, U);
          p.set(13, 7, E); p.set(12, 6, G); p.set(15, 9, SP);
        } else {
          tail(p, 5, 10, n, 3, 2.4, FN);
          p.ellipse(10, 10, 5.5, 4, (_x, y) => (y > 11 ? BE : B));
          for (const [x, y] of [[8, 8], [11, 7.6], [9, 10], [7, 10]]) p.set(x, y, SP);
          p.rim([[B, L, 0]]);
          p.outline(O, U);
          p.set(14, 9, E); p.set(14, 8, G);
        }
        break;
      }
    }
  }, P(kind === 'neon' ? ['#c9d6e0', '#3ab8ff', '#e8442e', '#dfe8f0']
    : kind === 'clown' ? ['#f07a1a', '#ffb060', '#c0501a', '#ffffff', '#2a1f2b']
      : kind === 'angel' ? ['#dcdce8', '#ffffff', '#3a3440', '#c9c9d8']
        : kind === 'gold' ? ['#f5a02a', '#ffd070', '#c86a1a', '#ffc070']
          : kind === 'tang' ? ['#2a6ae0', '#5a9aff', '#1a1a3a', '#f6d21e']
            : kind === 'betta' ? ['#d8303a', '#ff6a6a', '#b02a5a', '#e84a8a']
              : ['#d8b060', '#f0d890', '#f4ecd8', '#6a4a2a', '#e8c880']));
}

export function snailSprite(f: number): HTMLCanvasElement {
  return sprite('snail' + (f & 1), 16, 11, (p) => {
    const SH = 5, SL = 6, SD = 7, B = 8;
    p.ellipse(8, 9, 7, 1.8, B);
    p.disc(7, 5, 4.4, SH);
    p.disc(7, 5, 2.4, SL); p.disc(7, 5, 1, SD);
    p.rect(12, 5, 13, 8, B);
    p.rim([[SH, SL, SD]]);
    p.outline(O, U);
    p.set(13 + (f & 1), 2, B); p.set(12 + (f & 1), 3, B); p.set(14, 4, B);
  }, P(['#c98a4a', '#f0c080', '#8a5a2a', '#d8c8a8']));
}

/** A crab from the front: it walks sideways; claws go up when it is cross. Feet at the bottom row. */
export function crabSprite(f: number, claws = false, c = '#e8543a'): HTMLCanvasElement {
  const n = f & 3;
  return sprite('crab' + c + n + (claws ? 'c' : ''), 21, 16, (p) => {
    const B = 5, L = 6, D = 7, K = 8;
    const oy = 3;
    const st = [0, 1, 0, -1][n];
    for (let i = 0; i < 3; i++) {
      p.line(6 - i, 8 + oy, 2 - i + (i % 2 ? st : -st), 12 + oy, D);
      p.line(14 + i, 8 + oy, 18 + i - (i % 2 ? st : -st), 12 + oy, D);
    }
    p.ellipse(10.5, 8 + oy, 6.5, 3.6, B);
    const up = claws ? -3 : 0;
    p.capsule([5, 7 + oy], [3, 4 + up + oy], 1, B); p.capsule([16, 7 + oy], [18, 4 + up + oy], 1, B);
    p.disc(2.6, 2.8 + up + oy, 2.2, B); p.disc(18.4, 2.8 + up + oy, 2.2, B);
    p.set(2.6, 1.4 + up + oy, 0); p.set(18.4, 1.4 + up + oy, 0);
    p.rect(8, 3 + oy, 8, 5 + oy, K); p.rect(13, 3 + oy, 13, 5 + oy, K);
    p.rim([[B, L, D]]);
    p.outline(O, U);
    p.set(8, 2 + oy, E); p.set(13, 2 + oy, E);
  }, P([c, '#ff9a7a', '#a8301e', '#a8301e']));
}
