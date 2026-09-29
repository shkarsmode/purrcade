/**
 * Small lives: butterflies seen from above with their wings in four stages of a beat, bees,
 * ladybirds and beetles from above, ants, a spider on its thread, a green caterpillar, a
 * grasshopper, and two night visitors — an owl on a branch and a hedgehog on its rounds.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U, E, G } from './common';

const P = (cs: string[]) => [...BASE, ...cs];

export type Wing = 'monarch' | 'morpho' | 'white' | 'swallowtail' | 'admiral' | 'pink';
//                      main       dark edge  spot       lower      body
const WINGS: Record<Wing, string[]> = {
  monarch: ['#f08a2a', '#2a1f2b', '#ffffff', '#e0701a', '#2a1f2b'],
  morpho: ['#3a86f0', '#1a2a5a', '#9fd0ff', '#2a6ad0', '#2a1f2b'],
  white: ['#f6f4ea', '#3a3440', '#3a3440', '#e8e4d4', '#4a4452'],
  swallowtail: ['#f4d23a', '#2a1f2b', '#5c9ed6', '#f0b82a', '#2a1f2b'],
  admiral: ['#2a2430', '#e8442e', '#ffffff', '#3a3440', '#2a1f2b'],
  pink: ['#f7a1c4', '#b8508a', '#ffffff', '#f48ab8', '#5a3a4a'],
};

/** Wingspan 19, facing up the screen; f: 0 open, 1 half, 2 edge-on, 3 half. */
export function butterflySprite(w: Wing, f: number): HTMLCanvasElement {
  const n = f & 3;
  return sprite('bfly:' + w + n, 21, 15, (p) => {
    const M = 5, DK = 6, SP = 7, LO = 8, BD = 9;
    const s = [1, 0.6, 0.14, 0.6][n];
    const cx = 10;
    for (const d of [-1, 1]) {
      const X = (v: number) => cx + d * (0.5 + v * s);
      // Forewing: a broad triangle swept up and out, its outer corner rounded.
      p.tri([X(0), 3.2], [X(8.8), 0.6], [X(8.2), 6.8], M);
      p.tri([X(0), 3.2], [X(8.2), 6.8], [X(0), 7.4], M);
      if (s > 0.3) p.disc(X(7.2), 2.6, 1.9 * s, M);
      // Hindwing: smaller, rounder, hanging down and out.
      p.tri([X(0), 7.2], [X(6.6), 7.6], [X(5.2), 12.6], LO);
      p.tri([X(0), 7.2], [X(5.2), 12.6], [X(0.8), 11.8], LO);
      if (s > 0.3) p.disc(X(4.4), 10.4, 1.9 * s, LO);
      if (s > 0.3) {
        // Marks: a dark tip, spots along the edge, the species' own pattern.
        p.set(X(8.4), 1.2, DK); p.set(X(8.6), 2.2, DK); p.set(X(7.6), 1.2, DK); p.set(X(8.4), 5.6, DK);
        p.set(X(7.4), 4, SP); p.set(X(6.2), 6, SP);
        if (w === 'admiral') { for (let k = 0; k < 5; k++) p.set(X(2.6 + k * 1.1), 4.8 - k * 0.6, DK); p.set(X(7.6), 2.4, SP); }
        if (w === 'monarch') { p.line(X(1.5), 4, X(6), 2.6, DK); p.line(X(1.5), 8.6, X(4.2), 11.2, DK); p.set(X(5.8), 11.6, SP); }
        if (w === 'swallowtail') { p.line(X(2.4), 2.8, X(2.8), 6.4, DK); p.line(X(4.8), 2, X(5.4), 6.4, DK); p.set(X(4.6), 12.8, SP); p.set(X(5), 13.6, DK); }
        if (w === 'morpho') { p.line(X(7.6), 1.6, X(7.8), 6.2, DK); p.line(X(5.4), 11.4, X(6.2), 8.4, DK); }
        if (w === 'white') p.set(X(5), 4.4, DK);
        if (w === 'pink') { p.set(X(3.6), 9.6, SP); p.set(X(5.6), 3.4, SP); }
      }
    }
    p.rect(cx, 3, cx, 12.4, BD);
    p.disc(cx, 2.2, 1, BD);
    p.outline(O, U);
    p.set(cx - 1, 0.6, BD); p.set(cx + 1, 0.6, BD);
  }, P(WINGS[w]));
}

export function beeSprite(f: number): HTMLCanvasElement {
  const n = f & 1;
  return sprite('bee' + n, 11, 9, (p) => {
    const Y = 5, K = 6, WG = 7;
    p.ellipse(5, 5.5, 3.6, 2.4, (x) => ((x | 0) % 3 === 1 ? K : Y));
    p.disc(8.6, 5, 1.6, K);
    p.outline(O, U);
    if (n) { p.ellipse(4, 2, 2, 1.2, WG); p.ellipse(6, 2, 1.6, 1, WG); }
    else { p.ellipse(4, 3, 2.2, 0.8, WG); }
    p.set(1, 6, K);
  }, P(['#f6d21e', '#2a1f2b', '#e8f6ff']));
}

/** A ladybird from above, facing up; `open` spreads the wing cases for flight. */
export function ladybugSprite(f: number, open = false): HTMLCanvasElement {
  const n = f & 1;
  return sprite('lady' + n + (open ? 'o' : ''), 11, 11, (p) => {
    const R = 5, K = 6, L = 7, WG = 8;
    if (open) {
      p.ellipse(3, 6, 2.6, 4, WG, 0.4); p.ellipse(8, 6, 2.6, 4, WG, -0.4);
      p.ellipse(3.6, 6, 2, 3.4, R, 0.5); p.ellipse(7.4, 6, 2, 3.4, R, -0.5);
    } else {
      p.disc(5.5, 6, 4, R);
      p.line(5.5, 3, 5.5, 9.6, K);
      for (const [x, y] of [[3.5, 5], [7.5, 5], [3.4, 8], [7.6, 8]]) p.set(x, y, K);
    }
    p.ellipse(5.5, 2.4, 2.2, 1.4, K);
    p.rim([[R, L, 0]]);
    p.outline(O, U);
    // Legs, alternating.
    for (const [x, y] of n ? [[1, 5], [10, 7], [1, 9]] : [[10, 5], [1, 7], [10, 9]]) p.set(x, y, K);
    p.set(4.6, 0.6, K); p.set(6.4, 0.6, K);
  }, P(['#e8332a', '#1a1420', '#ff8a7a', '#d8e8f0']));
}

export function beetleSprite(f: number): HTMLCanvasElement {
  const n = f & 1;
  return sprite('beetle' + n, 13, 16, (p) => {
    const B = 5, L = 6, D = 7, K = 8;
    p.ellipse(6.5, 9.5, 4.4, 5.4, B);
    p.line(6.5, 5, 6.5, 14.6, D);
    p.ellipse(6.5, 4, 3, 2, B);
    p.disc(6.5, 2.2, 1.8, K);
    p.rim([[B, L, D]]);
    p.outline(O, U);
    for (const [x, y] of n ? [[1, 6], [12, 9], [1, 12], [12, 4]] : [[12, 6], [1, 9], [12, 12], [1, 4]]) p.set(x, y, K);
    p.set(5, 0, K); p.set(8, 0, K);
  }, P(['#3aa06a', '#7ae0a0', '#1f6a44', '#1a1420']));
}

export function antSprite(f: number, carry: string | null): HTMLCanvasElement {
  const n = f & 1;
  return sprite('ant' + n + (carry || ''), 7, 9, (p) => {
    const K = 5, L = 6, C = 7;
    p.disc(3.5, 7, 1.6, K); p.set(3.5, 5, K); p.disc(3.5, 3.6, 1.2, K); p.disc(3.5, 1.6, 1.1, K);
    for (const [x, y] of n ? [[1, 3], [6, 5], [1, 6]] : [[6, 3], [1, 5], [6, 6]]) p.set(x, y, K);
    p.set(3, 6.4, L);
    if (carry) { p.rect(2, 0, 4, 1, C); }
  }, P(['#2a1a14', '#6a4a3a', carry || '#7ad05a']));
}

export function spiderSprite(f: number): HTMLCanvasElement {
  const n = f & 1;
  return sprite('spider' + n, 15, 12, (p) => {
    const B = 5, L = 6, K = 7;
    for (let i = 0; i < 4; i++) {
      const y = 3 + i * 1.6, d = n ? (i % 2 ? 1 : -1) : (i % 2 ? -1 : 1);
      p.line(7, y + 1, 1, y + d, K); p.line(8, y + 1, 14, y - d, K);
    }
    p.disc(7.5, 7, 3, B);
    p.disc(7.5, 3.4, 2, B);
    p.rim([[B, L, 0]]);
    p.outline(O, U);
    p.set(6.5, 3, E); p.set(8.5, 3, E); p.set(6.5, 2, G);
  }, P(['#4a3a5a', '#7a6a8a', '#2a1f2b']));
}

export function caterpillarSprite(f: number): HTMLCanvasElement {
  const n = f % 4;
  return sprite('cat-pil' + n, 22, 10, (p) => {
    const B = 5, L = 6, D = 7, S = 8;
    // An inchworm: the middle humps up and flattens as it goes.
    const hump = [0, 2, 4, 2][n];
    for (let i = 0; i < 8; i++) {
      const x = 3 + i * 2.2 - (hump > 2 && i < 4 ? 1 : 0);
      const k = Math.sin((i / 7) * Math.PI);
      p.disc(x, 7 - k * hump, 2.2, B);
      if (i % 2) p.set(x, 7 - k * hump + 1.6, S);
    }
    p.disc(20, 6, 2.6, B);
    p.rim([[B, L, D]]);
    p.outline(O, U);
    p.set(21, 5, E); p.set(20, 3, D); p.set(21, 2, D);
  }, P(['#7ad05a', '#b8f08a', '#3e8a3a', '#f4d23a']));
}

export function grasshopperSprite(jump: boolean): HTMLCanvasElement {
  return sprite('hopper' + (jump ? 'j' : ''), 20, 12, (p) => {
    const B = 5, L = 6, D = 7;
    p.ellipse(9, 6, 6, 2.4, B, -0.08);
    p.disc(15.5, 5, 2.4, B);
    p.ellipse(8, 4.6, 5, 1.2, D, -0.1);
    if (jump) { p.line(6, 7, 1, 10, D); p.line(8, 7, 4, 11, D); }
    else { p.line(6, 6, 3, 2, D); p.line(3, 2, 1, 9, D); p.line(12, 8, 13, 11, D); }
    p.rim([[B, L, D]]);
    p.outline(O, U);
    p.set(16, 4, E);
    p.line(17, 3, 19, 0, D);
  }, P(['#8cc84a', '#c0f07a', '#4f8a2e']));
}

export function fireflySprite(lit: boolean): HTMLCanvasElement {
  return sprite('ffly' + (lit ? 'l' : ''), 5, 5, (p) => {
    p.set(2, 1, 6); p.set(2, 2, 6);
    p.set(1, 1, 7); p.set(3, 1, 7);
    p.set(2, 3, lit ? 8 : 5);
  }, P(['#6a6a3a', '#2a2430', '#c9d6ff', '#f4ff9a']));
}

export function owlSprite(f: number): HTMLCanvasElement {
  // f: 0 look left, 1 front, 2 look right, 3 blink
  const n = f & 3;
  return sprite('owl' + n, 18, 22, (p) => {
    const B = 5, L = 6, D = 7, F = 8, BK = 9, TL = 10;
    p.ellipse(9, 14, 6.5, 7.5, B);
    p.ellipse(9, 16, 4, 5, F);
    p.disc(9, 6.5, 5.6, B);
    p.tri([4, 3], [6.6, 3], [4.4, -0.4], B); p.tri([11.4, 3], [14, 3], [13.6, -0.4], B);
    const lx = n === 0 ? -1 : n === 2 ? 1 : 0;
    p.disc(6.6 + lx, 6.5, 2.2, F); p.disc(11.4 + lx, 6.5, 2.2, F);
    p.tri([8.2 + lx, 8], [9.8 + lx, 8], [9 + lx, 10], BK);
    for (let y = 14; y < 20; y += 2) for (let x = 7; x < 12; x += 2) p.set(x + (y % 4 ? 1 : 0), y, D);
    p.rim([[B, L, D]]);
    p.outline(O, U);
    p.rect(6, 21, 7, 21, TL); p.rect(11, 21, 12, 21, TL);
    if (n === 3) { p.rect(5 + lx, 6.5, 8 + lx, 6.5, D); p.rect(10 + lx, 6.5, 13 + lx, 6.5, D); }
    else { p.disc(6.6 + lx, 6.5, 1.1, 11); p.disc(11.4 + lx, 6.5, 1.1, 11); p.set(6.6 + lx, 6.5, E); p.set(11.4 + lx, 6.5, E); }
  }, P(['#8a6a4a', '#b08a66', '#5a4230', '#e8d8b8', '#e8a21a', '#e8a21a', '#ffd23f']));
}

export function hedgehogSprite(f: number): HTMLCanvasElement {
  const n = f & 3;
  return sprite('hog' + n, 24, 15, (p) => {
    const SP = 5, SL = 6, SD = 7, FC = 8, NS = 9;
    const bob = n % 2 ? 0.4 : 0;
    p.ellipse(11, 8.5 - bob, 9, 5.6, SP);
    for (let i = 0; i < 16; i++) { const a = Math.PI + (i / 15) * Math.PI; p.set(11 + Math.cos(a) * 9.6, 8.5 - bob + Math.sin(a) * 6.2, SP); }
    p.ellipse(19, 10.5, 4, 2.8, FC, 0.25);
    p.set(22.6, 11.4, NS);
    const st = [[0, 0], [1, -1], [0, 0], [-1, 1]][n];
    p.rect(7 + st[0], 13, 8 + st[0], 14, FC); p.rect(15 + st[1], 13, 16 + st[1], 14, FC);
    for (let y = 4; y < 12; y += 2) for (let x = 4 + (y % 4 ? 1 : 0); x < 17; x += 3) p.set(x, y - bob, SD);
    p.rim([[SP, SL, SD], [FC, 0, 0]]);
    p.outline(O, U);
    p.set(20, 9.6, E);
  }, P(['#8a7a6a', '#c9b8a0', '#5a4a3a', '#d9b890', '#2a1f2b']));
}
