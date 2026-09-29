/**
 * Things that stand on the floor between the wall and the viewer — a sack of flour, a cat bowl,
 * a basket, a pot plant, a pair of boots. They are drawn like the creatures, outlined and lit
 * from above, because a mouse runs behind them: they belong to the same layer of the picture.
 */
import { Pix, sprite } from '../core/pix';
import { BASE, O, U } from '../sprites/common';
import { bayer } from '../game/art';
import type { Prop } from '../game/types';
import { shadow } from '../game/art';

const P = (cs: string[]) => [...BASE, ...cs];

export function sackSprite(): HTMLCanvasElement {
  return sprite('prop:sack', 34, 30, (p) => {
    const B = 5, L = 6, D = 7, T = 8, PA = 9, PD = 10;
    p.ellipse(17, 19, 14, 10, B);
    p.capsule([17, 12], [17, 5], 5, B);
    p.ellipse(17, 4.5, 6, 3, B);
    // The weave: a dither of darker threads.
    for (let y = 0; y < 30; y++) for (let x = 0; x < 34; x++) if (p.get(x, y) === B && bayer(x, y) < 0.22) p.set(x, y, D);
    p.rect(12, 8, 22, 9, T);
    p.rect(8, 16, 13, 21, PA);
    for (let y = 16; y <= 21; y += 2) { p.set(8, y, PD); p.set(13, y + 1, PD); }
    p.rim([[B, L, D], [PA, 0, PD]]);
    p.outline(O, U);
  }, P(['#c9a46c', '#e3c48f', '#9d7a49', '#6e4f2c', '#b8674a', '#83432e']));
}

export function bowlSprite(c = '#4a78c9'): HTMLCanvasElement {
  return sprite('prop:bowl' + c, 24, 11, (p) => {
    const B = 5, L = 6, D = 7, K = 8, KL = 9;
    for (let y = 3; y < 10; y++) { const k = (y - 3) / 7; const hw = 10.5 - k * 3; p.rect(12 - hw, y, 12 + hw - 1, y, B); }
    p.rect(2, 3, 21, 4, L);
    for (const [x, y] of [[6, 2], [8, 1], [10, 2], [12, 1], [14, 2], [16, 1], [18, 2], [9, 2], [13, 2], [11, 1], [15, 1], [7, 2], [17, 2]]) p.set(x, y, (x + y) % 3 ? K : KL);
    p.rect(8, 6, 15, 6, 10);
    p.rim([[B, 0, D]]);
    p.outline(O, U);
  }, P([c, '#ffffff', '#2c4f8f', '#9a5b2e', '#c98a4a', '#e8f0ff']));
}

export function basketSprite(): HTMLCanvasElement {
  return sprite('prop:basket', 36, 24, (p) => {
    const B = 5, L = 6, D = 7, H = 8;
    for (let y = 6; y < 23; y++) { const k = (y - 6) / 17; const hw = 16 - k * 3; p.rect(18 - hw, y, 18 + hw - 1, y, (x: number) => ((x + (y >> 1)) % 4 < 2 ? B : L)); }
    for (let y = 8; y < 23; y += 4) p.rect(4, y, 31, y, D);
    p.rect(1, 5, 34, 7, H);
    // A cloth spilling over the rim.
    p.ellipse(22, 5, 8, 3, 9);
    p.ellipse(12, 4, 5, 2.5, 10);
    p.rim([[B, 0, D], [H, 6, D], [9, 11, 0]]);
    p.outline(O, U);
  }, P(['#c7925a', '#dcae74', '#8e6034', '#a87441', '#e86a6a', '#5c9ed6', '#ff9d9d']));
}

export function bootsSprite(): HTMLCanvasElement {
  return sprite('prop:boots', 30, 26, (p) => {
    const B = 5, L = 6, D = 7, S = 8;
    for (const ox of [0, 13]) {
      p.rect(3 + ox, 2, 11 + ox, 20, B);
      p.ellipse(10 + ox, 21, 8, 3.5, B);
      p.rect(2 + ox, 23, 16 + ox, 24, S);
      p.rect(3 + ox, 2, 11 + ox, 4, L);
    }
    p.rim([[B, L, D]]);
    p.outline(O, U);
  }, P(['#f2c14e', '#ffe08a', '#c28f2a', '#6b4a2c']));
}

export type PlantKind = 'monstera' | 'fern' | 'cactus';

export function plantSprite(kind: PlantKind): HTMLCanvasElement {
  const H = kind === 'cactus' ? 34 : 46;
  return sprite('prop:plant' + kind, 36, H, (p) => {
    const PT = 5, PL = 6, PD = 7, G1 = 8, G2 = 9, G3 = 10;
    // The pot.
    for (let y = H - 14; y < H - 1; y++) { const k = (y - (H - 14)) / 13; const hw = 8.5 - k * 2; p.rect(18 - hw, y, 18 + hw - 1, y, PT); }
    p.rect(8, H - 15, 27, H - 13, PL);
    if (kind === 'monstera') {
      const leaves: [number, number, number, number][] = [[18, 14, 8, -0.2], [9, 20, 7, -0.9], [27, 21, 7, 0.8], [14, 8, 6, -0.5], [24, 10, 6, 0.4]];
      for (const [x, y, r, a] of leaves) {
        p.capsule([18, H - 15], [x, y + 3], 0.8, G3);
        p.ellipse(x, y, r, r * 0.72, (_x, _y, u, v) => (Math.abs(v) < 0.12 ? G3 : (Math.abs(u) > 0.35 && Math.abs(v * 7 % 2) < 0.5) ? 0 : u < -0.2 ? G2 : G1), a);
      }
    } else if (kind === 'fern') {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.34;
        const len = 20 - Math.abs(i - 4) * 1.5;
        for (let r = 0; r < len; r++) {
          const x = 18 + Math.cos(a) * r + Math.sin(r * 0.2) * (i - 4) * 0.3, y = H - 15 + Math.sin(a) * r + (r * r) * 0.012 * Math.abs(i - 4);
          p.set(x, y, G3);
          if (r > 3 && r % 2 === 0) { p.set(x - 1, y, r > len * 0.6 ? G1 : G2); p.set(x + 1, y, r > len * 0.6 ? G1 : G2); }
        }
      }
    } else {
      p.capsule([18, H - 15], [18, 6], 5, G2);
      p.capsule([11, H - 20], [11, 13], 3, G2);
      p.capsule([12, H - 18], [17, H - 18], 2, G2);
      p.capsule([25, H - 22], [25, 16], 3, G2);
      p.capsule([19, H - 23], [24, H - 23], 2, G2);
      for (let y = 8; y < H - 16; y += 3) { p.set(16, y, G1); p.set(20, y + 1, G3); }
      p.disc(18, 5, 2.4, 11);
    }
    p.rim([[PT, PL, PD], [G2, G1, G3]]);
    p.outline(O, U);
  }, P(['#c9643d', '#e38556', '#8f3f22', '#8fd16a', '#4f9a4a', '#2e6a3a', '#ff7aa2']));
}

export function boxSprite(w: number, h: number, open = false): HTMLCanvasElement {
  return sprite('prop:box' + w + 'x' + h + (open ? 'o' : ''), w + 2, h + (open ? 6 : 2), (p) => {
    const B = 5, L = 6, D = 7, T = 8;
    const oy = open ? 5 : 1;
    p.rect(1, oy, w, oy + h - 1, B);
    p.rect(Math.round(w / 2) - 2, oy, Math.round(w / 2) + 3, oy + h - 1, T);
    if (open) { p.tri([1, oy], [8, 0], [12, oy], L); p.tri([w, oy], [w - 7, 0], [w - 11, oy], L); }
    p.rect(4, oy + 4, 11, oy + 5, D);
    p.rim([[B, L, D], [T, L, D]]);
    p.outline(O, U);
  }, P(['#c89a5e', '#e4b97c', '#8f6a3c', '#d9b27a']));
}

export function gnomeSprite(): HTMLCanvasElement {
  return sprite('prop:gnome', 20, 30, (p) => {
    const HAT = 5, HL = 6, HD = 7, SK = 8, BD = 9, BDD = 10, SH = 11, SHD = 12, BT = 13, NS = 14;
    p.ellipse(10, 24, 6.5, 5, SH);
    p.rect(4, 27, 8, 29, BT); p.rect(11, 27, 15, 29, BT);
    p.disc(10, 15, 4.5, SK);
    p.tri([4, 14], [16, 14], [13, 1], HAT);
    p.ellipse(10, 20, 5, 5.5, BD);
    p.disc(10, 16.5, 1.6, NS);
    p.rect(9, 25, 11, 25, SHD);
    p.rim([[HAT, HL, HD], [SH, 0, SHD], [BD, 0, BDD]]);
    p.outline(O, U);
    p.set(8, 14, 3); p.set(12, 14, 3);
  }, P(['#d9443a', '#f07a5a', '#9a2a26', '#f5c9a0', '#f4f1ea', '#c9c3b6', '#3c6fc4', '#274f94', '#5a3a2a', '#e8907a']));
}

export function snowmanSprite(): HTMLCanvasElement {
  return sprite('prop:snowman', 30, 44, (p) => {
    const S = 5, SL = 6, SD = 7, HT = 8, HTL = 9, SC = 10, SCD = 11, CR = 12, BR = 13;
    p.disc(15, 34, 10, S);
    p.disc(15, 19, 7.5, S);
    p.disc(15, 9, 5.5, S);
    p.rect(9, 0, 21, 3, HT); p.rect(7, 4, 23, 5, HT); p.rect(9, 1, 21, 1, HTL);
    p.rect(8, 13, 22, 15, SC); p.rect(18, 15, 21, 22, SC); p.rect(18, 20, 21, 20, SCD);
    p.capsule([6, 18], [0.5, 12], 0.7, BR); p.capsule([24, 18], [29, 13], 0.7, BR); p.set(1, 11, BR); p.set(28, 12, BR);
    p.rim([[S, SL, SD], [SC, 0, SCD]]);
    p.outline(O, U);
    p.set(13, 8, 3); p.set(17, 8, 3);
    p.tri([15, 9.5], [15, 11], [21, 10.5], CR);
    for (const y of [19, 23, 28, 33]) p.set(15, y, 3);
  }, P(['#f4f8ff', '#ffffff', '#b9c8e0', '#2a2430', '#4a4452', '#d9443a', '#9a2a26', '#f08a3c', '#6b4a32']));
}

export function logSprite(): HTMLCanvasElement {
  return sprite('prop:log', 64, 22, (p) => {
    const B = 5, L = 6, D = 7, END = 8, RING = 9, MOSS = 10, MOSSL = 11;
    p.capsule([8, 12], [56, 12], 8.5, B);
    for (let x = 12; x < 54; x += 5) p.line(x, 5, x + 2, 19, D);
    p.ellipse(56, 12, 5.5, 8.5, END);
    p.ellipse(56, 12, 3.5, 5.8, RING); p.ellipse(56, 12, 2, 3.5, END); p.set(56, 12, RING);
    for (let x = 14; x < 46; x++) if (Math.sin(x * 0.7) > -0.2) p.set(x, 4 + (Math.sin(x * 1.3) > 0.5 ? 1 : 0), MOSS);
    for (let x = 16; x < 44; x += 3) p.set(x, 3, MOSSL);
    p.rim([[B, L, D]]);
    p.outline(O, U);
  }, P(['#7a5236', '#9a6e48', '#523520', '#d9b07a', '#b0875a', '#5a9a3e', '#8fcf5a']));
}

/** A prop standing with its middle-bottom at (x, y). */
export function prop(img: HTMLCanvasElement, x: number, y: number, shadowW = img.width * 0.9): Prop {
  const X = Math.round(x - img.width / 2), Y = Math.round(y - img.height + 1);
  return {
    x0: X, x1: X + img.width, y, top: Y,
    draw(g) {
      shadow(g, x, y, shadowW, 4, 0.26);
      g.drawImage(img, X, Y);
    },
  };
}
