/**
 * Outdoor places: a garden with a feeder and a birdbath, an autumn park, a meadow under the
 * mountains, a forest, a snowy yard. Each paints its still layer once over a sky of its own
 * hour and hands the scenes its perches, trunks, flower heads and burrows.
 */
import { layer } from '../core/screen';
import { mix } from '../core/color';
import type { Rng } from '../core/rng';
import type { LocationDef, LocationInstance, Ledge, Light, Prop, Hole } from '../game/types';
import { oval, px, rect, bands, speckle, drawHole, bayer } from '../game/art';
import { Sky } from '../game/sky';
import { hills, mountains, lawn, crown, trunk, branch, fence, daisy, tulip, bush, pine, frontGrass, lampPost, LEAVES } from './scenery';
import { prop, gnomeSprite, snowmanSprite, logSprite } from './props';

type Bloom = { x: number; y: number; c: string };

/** A hanging bird table on a pole: a tray of seed under a little roof. */
function feeder(g: CanvasRenderingContext2D, x: number, trayY: number, bottom: number): Ledge[] {
  rect(g, x - 1, trayY, 3, bottom - trayY, '#7a5236'); rect(g, x - 1, trayY, 1, bottom - trayY, '#9a6e48');
  g.globalAlpha = 0.25; oval(g, x, bottom, 7, 1.5, '#000000'); g.globalAlpha = 1;
  rect(g, x - 17, trayY, 35, 3, '#9a6e48'); rect(g, x - 17, trayY, 35, 1, '#c9955e'); rect(g, x - 17, trayY + 3, 35, 1, '#5a3a24');
  rect(g, x - 17, trayY - 2, 1, 2, '#9a6e48'); rect(g, x + 17, trayY - 2, 1, 2, '#9a6e48');
  for (let i = 0; i < 26; i++) px(g, x - 14 + ((i * 7) % 29), trayY - 1 - (i % 3 === 0 ? 1 : 0), ['#e9d08a', '#c9a45a', '#f4e6b0', '#8a6a3a'][i % 4]);
  rect(g, x - 14, trayY - 14, 2, 14, '#7a5236'); rect(g, x + 13, trayY - 14, 2, 14, '#7a5236');
  for (let i = 0; i < 8; i++) {
    const w = 20 - i * 2.4;
    rect(g, x - w, trayY - 14 - i, w * 2 + 1, 1, i % 2 ? '#c9443a' : '#d9564a');
  }
  rect(g, x - 20, trayY - 14, 41, 1, '#8a2a22');
  return [{ x0: x - 15, x1: x + 15, y: trayY - 1, kind: 'food' }, { x0: x - 4, x1: x + 4, y: trayY - 22 }];
}

/** A stone birdbath; returns its rim. */
function birdbath(g: CanvasRenderingContext2D, x: number, bottom: number, h: number): Ledge {
  const top = bottom - h;
  rect(g, x - 9, bottom - 4, 19, 4, '#9a9aa6'); rect(g, x - 9, bottom - 4, 19, 1, '#c4c4ce');
  rect(g, x - 4, top + 5, 9, h - 8, '#a9a9b4'); rect(g, x - 4, top + 5, 2, h - 8, '#cfcfd8'); rect(g, x + 3, top + 5, 2, h - 8, '#86868f');
  oval(g, x, top + 2, 18, 5, '#8e8e99');
  oval(g, x, top, 17, 4, '#c4c4ce');
  oval(g, x, top, 14, 2.6, '#6fb2e0');
  rect(g, x - 8, top - 1, 5, 1, '#bfe6ff'); px(g, x + 6, top + 1, '#bfe6ff');
  g.globalAlpha = 0.25; oval(g, x, bottom, 12, 2, '#000000'); g.globalAlpha = 1;
  return { x0: x - 15, x1: x + 15, y: top - 2, kind: 'bath' };
}

function wildflowers(g: CanvasRenderingContext2D, rng: Rng, x0: number, x1: number, y0: number, y1: number, n: number, blooms?: Bloom[]) {
  for (let i = 0; i < n; i++) {
    const x = rng.int(x0, x1), y = rng.int(y0, y1);
    const k = (y - y0) / Math.max(1, y1 - y0);
    const h = Math.round(3 + k * 7 * rng.range(0.6, 1));
    const r = rng.next();
    if (r < 0.35) daisy(g, x, y, h);
    else if (r < 0.55) daisy(g, x, y, h, '#e8433a', '#2a1f2b');               // poppy
    else if (r < 0.72) daisy(g, x, y, h, '#5c8ee6', '#f4f0ff');               // cornflower
    else if (r < 0.88) daisy(g, x, y, h, '#f6d23a', '#e8a21a');               // buttercup
    else tulip(g, x, y, h, rng.pick(['#e84a5f', '#f7a1c4', '#b87ae0']));
    if (blooms && k > 0.3 && rng.chance(0.18)) blooms.push({ x, y: y - h - 1, c: '#ffffff' });
  }
}

export const garden: LocationDef = {
  id: 'garden',
  name: { uk: 'Сад', en: 'Garden' },
  indoor: false,
  weathers: ['clear', 'clear', 'rain', 'petals', 'leaves'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.5);
    const sky = new Sky(W, 0, hor + 20, tod, rng);
    const [cv, g] = layer(W, H);
    hills(g, W, hor + 4, 18, '#a9d69a', 1.3, hor + 40, 1, '#c4e6b0');
    for (let x = 0; x < W; x += rng.int(5, 11)) oval(g, x, hor + 8 - rng.int(0, 6), rng.int(4, 8), rng.int(4, 7), '#79b56c');
    hills(g, W, hor + 14, 10, '#8cc47c', 4.1, hor + 40, 1.6);
    const lawnY = Math.round(H * 0.66);
    const fenceTop = Math.round(H * 0.46);
    const perches: Ledge[] = [];
    perches.push(fence(g, rng, 0, W, fenceTop, lawnY + 2));
    lawn(g, rng, 0, lawnY, W, H - lawnY, '#9ad276', '#4f9a3e', '#b4e68a', '#3e7a34');
    // Flower bed along the fence.
    const blooms: Bloom[] = [];
    for (let x = 3; x < W - 3; x += rng.int(4, 8)) {
      const r = rng.next();
      const y = lawnY + rng.int(1, 5);
      if (r < 0.4) daisy(g, x, y, rng.int(4, 9));
      else if (r < 0.85) { const h = rng.int(5, 11); tulip(g, x, y, h, rng.pick(['#e84a5f', '#f7a1c4', '#f4c430', '#b87ae0', '#ff8a3d'])); if (rng.chance(0.4)) blooms.push({ x, y: y - h - 2, c: '#ffffff' }); }
    }
    for (let i = 0; i < Math.round(W / 90); i++) bush(g, rng, rng.int(20, W - 20), lawnY + 4, rng.int(12, 18), rng.int(8, 11), LEAVES.spring, rng.chance(0.5) ? '#e8433a' : undefined);
    // The tree, its branches and its crown.
    const tx = Math.max(30, Math.round(W * 0.11));
    const crownY = Math.round(H * 0.15);
    trunk(g, rng, tx, crownY + 10, lawnY + 10, 14);
    perches.push(branch(g, tx + 5, Math.round(H * 0.37), tx + 64, Math.round(H * 0.33), 6));
    if (tx > 40) perches.push(branch(g, tx - 5, Math.round(H * 0.3), tx - 40, Math.round(H * 0.27), 5));
    perches.push(branch(g, tx + 4, Math.round(H * 0.25), tx + 42, Math.round(H * 0.2), 4));
    crown(g, rng, tx + 4, crownY, 56, 36, LEAVES.summer);
    crown(g, rng, tx + 66, Math.round(H * 0.31), 12, 8, LEAVES.summer);
    // Apples in the tree.
    for (let i = 0; i < 7; i++) { const ax = tx + rng.int(-40, 50), ay = crownY + rng.int(-14, 22); oval(g, ax, ay, 2, 2, '#e04848'); px(g, ax - 1, ay - 1, '#ff9a8a'); }
    // The bird table and the birdbath.
    const fx = Math.round(W * 0.7);
    perches.push(...feeder(g, fx, Math.round(H * 0.44), Math.round(H * 0.84)));
    perches.push(birdbath(g, Math.round(W * 0.43), Math.round(H * 0.8), 28));
    // Fairy lights along the fence, lit at night.
    const lights: Light[] = [];
    const bulbs = ['#ff6a6a', '#ffd23f', '#6ad0ff', '#8aff8a', '#ff9af0'];
    for (let x = 6, i = 0; x < W; x += 16, i++) {
      const sag = Math.round(Math.sin(((x % 48) / 48) * Math.PI) * 3);
      px(g, x, fenceTop + 5 + sag, '#2a2430');
      const c = bulbs[i % bulbs.length];
      rect(g, x, fenceTop + 6 + sag, 1, 2, tod === 'night' || tod === 'dusk' ? mix(c, '#ffffff', 0.5) : c);
      if (tod === 'night' || tod === 'dusk') lights.push({ x, y: fenceTop + 7 + sag, r: 10, c, a: 0.9 });
    }
    for (let x = 0; x < W; x++) px(g, x, fenceTop + 5 + Math.round(Math.sin(((x % 48) / 48) * Math.PI) * 3), '#2a2430');
    const props: Prop[] = [];
    if (W > 300) props.push(prop(gnomeSprite(), Math.round(W * 0.88), Math.round(H * 0.84), 16));
    const grass = frontGrass(W, H, rng, 14, ['#3e7a34', '#4f9a3e', '#2f6a2e', '#5aa84a']);
    return {
      indoor: false,
      floor: Math.round(H * 0.84),
      floorBand: [lawnY + 10, H - 8],
      perches,
      props,
      blooms,
      sky: [0, hor],
      lights,
      update: (dt) => sky.update(dt),
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack: (gg) => gg.drawImage(cv, 0, 0),
      drawFront: grass,
    };
  },
};

export const park: LocationDef = {
  id: 'park',
  name: { uk: 'Осінній парк', en: 'Autumn park' },
  indoor: false,
  weathers: ['leaves', 'leaves', 'clear', 'rain'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.52);
    const sky = new Sky(W, 0, hor + 20, tod, rng);
    const [cv, g] = layer(W, H);
    hills(g, W, hor + 4, 14, '#c9b58a', 2.2, hor + 40, 1);
    for (let x = 0; x < W; x += rng.int(8, 16)) crown(g, rng, x, hor - rng.int(0, 6), rng.int(7, 12), rng.int(6, 10), rng.pick([LEAVES.autumn, LEAVES.red, LEAVES.spring]));
    const groundY = Math.round(H * 0.64);
    lawn(g, rng, 0, groundY, W, H - groundY, '#b8b86a', '#7a8a3a', '#d0c47a', '#5e6a2e');
    // A gravel path across.
    const py0 = Math.round(H * 0.76), py1 = Math.round(H * 0.86);
    for (let y = py0; y < py1; y++) rect(g, 0, y, W, 1, y === py0 || y === py1 - 1 ? '#a88a62' : '#d9c4a0');
    speckle(g, rng, 0, py0 + 1, W, py1 - py0 - 2, '#b9a07a', 0.12);
    speckle(g, rng, 0, py0 + 1, W, py1 - py0 - 2, '#efe0c0', 0.06);
    // Fallen leaves everywhere.
    for (let i = 0; i < W * 1.2; i++) { const x = rng.int(0, W), y = rng.int(groundY, H); px(g, x, y, rng.pick(['#e0842e', '#c9442e', '#f6b84a', '#b8541f'])); if (rng.chance(0.4)) px(g, x + 1, y, '#e0842e'); }
    const perches: Ledge[] = [];
    // The big oak: the squirrel's tree.
    const ox = Math.round(W * 0.26), oTop = Math.round(H * 0.16), ow = 22;
    trunk(g, rng, ox, oTop, groundY + 12, ow, '#6b4a32');
    perches.push(branch(g, ox + 8, Math.round(H * 0.34), ox + 70, Math.round(H * 0.3), 7));
    perches.push(branch(g, ox - 8, Math.round(H * 0.4), ox - 60, Math.round(H * 0.36), 6));
    perches.push(branch(g, ox + 6, Math.round(H * 0.22), ox + 46, Math.round(H * 0.15), 5));
    crown(g, rng, ox, Math.round(H * 0.12), 62, 34, LEAVES.autumn);
    crown(g, rng, ox + 72, Math.round(H * 0.28), 14, 9, LEAVES.autumn);
    crown(g, rng, ox - 62, Math.round(H * 0.34), 13, 8, LEAVES.red);
    // A hollow in the trunk.
    oval(g, ox + 2, Math.round(H * 0.44), 3.5, 5, '#2a1a12');
    // A bench.
    const bx = Math.round(W * 0.6), by = Math.round(H * 0.75);
    rect(g, bx - 30, by - 22, 60, 3, '#8a5a36'); rect(g, bx - 30, by - 22, 60, 1, '#b07a4c');
    rect(g, bx - 30, by - 16, 60, 3, '#8a5a36'); rect(g, bx - 30, by - 16, 60, 1, '#b07a4c');
    rect(g, bx - 32, by - 9, 64, 3, '#9a6a40'); rect(g, bx - 32, by - 9, 64, 1, '#c28a58');
    for (const lx of [bx - 28, bx + 25]) { rect(g, lx, by - 24, 3, 24, '#2e2a33'); }
    g.globalAlpha = 0.25; oval(g, bx, by, 32, 2, '#000000'); g.globalAlpha = 1;
    perches.push({ x0: bx - 28, x1: bx + 28, y: by - 23 }, { x0: bx - 30, x1: bx + 30, y: by - 10 });
    const lights: Light[] = [];
    if (W > 320) {
      const lp = lampPost(g, Math.round(W * 0.87), Math.round(H * 0.8), 70);
      perches.push({ x0: lp.x - 4, x1: lp.x + 4, y: lp.y - 9 });
      lights.push({ x: lp.x, y: lp.y, r: 80, c: '#ffd89a', flicker: 0.03 });
    }
    const grass = frontGrass(W, H, rng, 10, ['#6a7a30', '#7a8a3a', '#8a6a2a', '#5e6a2e']);
    return {
      indoor: false,
      floor: Math.round(H * 0.82),
      floorBand: [groundY + 8, H - 8],
      perches,
      trunks: [{ x: ox, w: ow, top: oTop + 18, bottom: groundY + 10 }],
      sky: [0, hor],
      lights,
      update: (dt) => sky.update(dt),
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack: (gg) => gg.drawImage(cv, 0, 0),
      drawFront: grass,
    };
  },
};

export const meadow: LocationDef = {
  id: 'meadow',
  name: { uk: 'Лука', en: 'Meadow' },
  indoor: false,
  weathers: ['clear', 'clear', 'petals', 'rain'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.56);
    const sky = new Sky(W, 0, hor + 20, tod, rng);
    const [cv, g] = layer(W, H);
    mountains(g, rng, W, hor - 6, 46, '#9fb2d0', '#f4f8ff', hor + 30);
    hills(g, W, hor + 2, 12, '#a6d18e', 0.7, hor + 40, 1.2, '#c0e2a8');
    // A windmill on the far hill (its sails turn in drawBack).
    const mx = Math.round(W * 0.78), my = hor - 6;
    for (let y = 0; y < 22; y++) { const hw = 3 + y * 0.15; rect(g, mx - hw, my + y - 16, hw * 2, 1, y < 2 ? '#c9443a' : '#f4efe6'); }
    rect(g, mx - 1, my + 1, 2, 4, '#6b4a32');
    hills(g, W, hor + 14, 10, '#8cc47c', 3.3, hor + 40, 1.6);
    const groundY = hor + 12;
    lawn(g, rng, 0, groundY, W, H - groundY, '#a6d884', '#58a040', '#c0ec94', '#43803a');
    const blooms: Bloom[] = [];
    wildflowers(g, rng, 0, W, groundY + 6, H - 4, Math.round(W * 0.5), blooms);
    // Sunflowers at the sides: big faces for butterflies to land on.
    for (const sx of [Math.round(W * 0.07), Math.round(W * 0.93), Math.round(W * 0.2)]) {
      if (sx > W - 10) continue;
      const base = H - 6, h = rng.int(58, 76);
      for (let k = 0; k < h; k++) rect(g, sx, base - k, 2, 1, '#3d8a3a');
      for (const [ly, dir] of [[base - h * 0.4, -1], [base - h * 0.62, 1]] as [number, number][]) { oval(g, sx + dir * 6, ly, 6, 2.5, '#4f9a4a'); px(g, sx + dir * 9, ly - 1, '#86c95e'); }
      const cy = base - h;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) oval(g, sx + 1 + Math.cos(a) * 7, cy + Math.sin(a) * 6, 2.6, 2.6, a < Math.PI ? '#f4c430' : '#f6d23a');
      oval(g, sx + 1, cy, 5, 4.5, '#6b3e1e');
      for (let i = 0; i < 8; i++) px(g, sx + 1 + rng.int(-3, 3), cy + rng.int(-2, 2), '#8a5a2a');
      blooms.push({ x: sx + 1, y: cy - 5, c: '#f4c430' });
    }
    const grass = frontGrass(W, H, rng, 24, ['#3e7a34', '#58a040', '#2f6a2e', '#6fb85a', '#86c95e']);
    return {
      indoor: false,
      floor: Math.round(H * 0.84),
      floorBand: [groundY + 10, H - 8],
      blooms,
      sky: [0, hor],
      update: (dt) => sky.update(dt),
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        // The windmill's sails.
        const a0 = t * 0.6;
        for (let i = 0; i < 4; i++) {
          const a = a0 + (i * Math.PI) / 2;
          for (let r = 1; r < 13; r++) px(gg, mx + Math.cos(a) * r, my - 14 + Math.sin(a) * r, r > 4 ? '#e9e1d2' : '#6b4a32');
        }
        px(gg, mx, my - 14, '#3a2a20');
      },
      drawFront: grass,
    };
  },
};

export const forest: LocationDef = {
  id: 'forest',
  name: { uk: 'Ліс', en: 'Forest' },
  indoor: false,
  weathers: ['clear', 'clear', 'rain', 'leaves', 'motes'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.5);
    const sky = new Sky(W, 0, hor, tod, rng);
    const [cv, g] = layer(W, H);
    // Three depths of trunks, each darker and hazier than the one in front of it.
    const depth = [
      { c: '#6f8a78', leaf: '#86a88e', w: [5, 9], n: W / 16, top: 0 },
      { c: '#4a6656', leaf: '#5e8a6a', w: [8, 13], n: W / 26, top: 0 },
    ];
    bands(g, 0, Math.round(H * 0.18), W, Math.round(H * 0.5), ['#8fb8a0', '#6f9a82', '#557a66'], 3);
    for (const d of depth) {
      for (let i = 0; i < d.n; i++) {
        const x = rng.int(0, W), w = rng.int(d.w[0], d.w[1]);
        rect(g, x - w / 2, 0, w, Math.round(H * 0.68), d.c);
        rect(g, x - w / 2, 0, 1, Math.round(H * 0.68), mix(d.c, '#ffffff', 0.1));
      }
      for (let x = 0; x < W; x += rng.int(10, 20)) oval(g, x, rng.int(0, Math.round(H * 0.12)), rng.int(14, 24), rng.int(8, 14), d.leaf);
    }
    const groundY = Math.round(H * 0.66);
    lawn(g, rng, 0, groundY, W, H - groundY, '#6a7a4a', '#4a3e2a', '#7a8a52', '#3a3020');
    for (let i = 0; i < W; i++) px(g, rng.int(0, W), rng.int(groundY, H), rng.pick(['#8a5a2a', '#a8742e', '#5a7a3a', '#c9a060']));
    const perches: Ledge[] = [];
    const trunks: { x: number; w: number; top: number; bottom: number }[] = [];
    const near = W > 320 ? [0.1, 0.42, 0.82] : [0.15, 0.75];
    for (const f of near) {
      const x = Math.round(W * f + rng.int(-10, 10)), w = rng.int(20, 26);
      trunk(g, rng, x, 0, groundY + 12, w, '#5a3e2c');
      // Moss up one side.
      for (let y = groundY - 40; y < groundY + 10; y++) if (rng.chance(0.7)) rect(g, x - w / 2, y, rng.int(1, 4), 1, rng.chance(0.5) ? '#5a9a3e' : '#7ab84a');
      trunks.push({ x, w, top: 16, bottom: groundY + 8 });
      const dir = f < 0.5 ? 1 : -1;
      perches.push(branch(g, x + dir * (w / 2 - 2), Math.round(H * 0.3), x + dir * rng.int(40, 60), Math.round(H * 0.27), 6, '#5a3e2c'));
      crown(g, rng, x + dir * 52, Math.round(H * 0.24), 16, 9, LEAVES.summer);
    }
    // The canopy across the top.
    for (let x = -20; x < W + 20; x += rng.int(26, 40)) crown(g, rng, x, rng.int(-6, 10), rng.int(30, 44), rng.int(18, 26), LEAVES.summer);
    // Mushrooms at the trunk feet, stones, ferns.
    const lights: Light[] = [];
    for (const tr of trunks) {
      for (let i = 0; i < 3; i++) {
        const mx = tr.x + rng.int(-tr.w, tr.w), my = groundY + rng.int(8, 16);
        const glow = tod === 'night' || tod === 'dusk';
        const cap = glow && i % 2 ? '#5fe0d0' : '#d9443a';
        rect(g, mx, my - 3, 2, 3, '#f4efe6');
        oval(g, mx + 1, my - 4, 3.5, 2, cap);
        px(g, mx, my - 5, '#ffffff'); px(g, mx + 2, my - 4, '#ffffff');
        if (glow && i % 2) lights.push({ x: mx + 1, y: my - 4, r: 16, c: '#5fe0d0', a: 1 });
      }
    }
    for (let i = 0; i < W / 70; i++) { const sx = rng.int(10, W - 10), sy = rng.int(groundY + 10, H - 20); oval(g, sx, sy, rng.int(5, 9), rng.int(3, 5), '#8a8a94'); oval(g, sx - 1, sy - 1, 4, 2, '#b4b4be'); rect(g, sx - 3, sy - 3, 5, 1, '#5a9a3e'); }
    const props: Prop[] = [prop(logSprite(), Math.round(W * 0.6), Math.round(groundY + (H - groundY) * 0.55), 60)];
    const grass = frontGrass(W, H, rng, 20, ['#2f6a2e', '#3e7a34', '#4f9a3e', '#1f4d28']);
    return {
      indoor: false,
      floor: Math.round(H * 0.82),
      floorBand: [groundY + 8, H - 8],
      perches,
      trunks,
      props,
      sky: [0, hor],
      lights,
      update: (dt) => sky.update(dt),
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        // Shafts of light through the canopy by day.
        if (tod === 'day' || tod === 'dawn') {
          gg.globalAlpha = 0.09;
          for (let i = 0; i < 3; i++) {
            const x0 = W * (0.2 + i * 0.3) + Math.sin(t * 0.1 + i) * 6;
            for (let y = 10; y < groundY + 20; y++) rect(gg, x0 + (y - 10) * 0.35, y, 14 + (y - 10) * 0.08, 1, '#fff6c8');
          }
          gg.globalAlpha = 1;
        }
      },
      drawFront: grass,
    };
  },
};

export const winter: LocationDef = {
  id: 'winter',
  name: { uk: 'Зимове подвір’я', en: 'Snowy yard' },
  indoor: false,
  weathers: ['snow', 'snow', 'clear'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.5);
    const sky = new Sky(W, 0, hor + 20, tod, rng);
    const [cv, g] = layer(W, H);
    hills(g, W, hor + 4, 20, '#dfe8f6', 2.1, hor + 40, 1, '#ffffff');
    for (let x = 0; x < W; x += rng.int(10, 18)) pine(g, rng, x, hor + 14 - rng.int(0, 6), rng.int(16, 26), LEAVES.pine, true);
    hills(g, W, hor + 16, 8, '#eef3fb', 5.2, hor + 40, 1.5, '#ffffff');
    const groundY = Math.round(H * 0.64);
    // Snow: white, with blue in the hollows.
    for (let y = groundY; y < H; y++) {
      const k = (y - groundY) / (H - groundY);
      rect(g, 0, y, W, 1, mix('#e6eef9', '#f7faff', k));
    }
    for (let i = 0; i < W / 8; i++) { const x = rng.int(0, W), y = rng.int(groundY + 4, H - 2); oval(g, x, y, rng.int(6, 16), rng.int(1, 3), '#d4def0'); }
    // Footprints across the snow.
    for (let x = 10, i = 0; x < W; x += 9, i++) { const y = Math.round(H * 0.86 + Math.sin(x * 0.02) * 6 + (i % 2 ? 3 : 0)); rect(g, x, y, 2, 1, '#b9c8e0'); px(g, x + 1, y - 1, '#c9d4e8'); }
    // The drift along the back, with burrows in it.
    for (let x = 0; x < W; x++) { const top = groundY - 8 + Math.round(Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 1.5); rect(g, x, top, 1, groundY - top + 4, '#f4f8ff'); px(g, x, top, '#ffffff'); }
    const perches: Ledge[] = [];
    // A cabin on the right with a warm window.
    const lights: Light[] = [];
    let smoke: { x: number; y: number } | null = null;
    if (W > 300) {
      const cx = Math.round(W * 0.78), cw = Math.min(110, Math.round(W * 0.26)), cTop = Math.round(H * 0.34);
      for (let y = cTop; y < groundY; y += 5) { rect(g, cx, y, cw, 5, '#8a5a36'); rect(g, cx, y, cw, 1, '#b07a4c'); rect(g, cx, y + 4, cw, 1, '#5a3a24'); }
      for (let i = 0; i < 16; i++) { const w = cw / 2 + 10 - i * (cw / 32 + 0.3); rect(g, cx + cw / 2 - w, cTop - i, w * 2, 1, i < 3 ? '#ffffff' : '#6a3a2a'); }
      for (let x = cx - 8; x < cx + cw + 8; x++) px(g, x, cTop - 1, '#ffffff');
      rect(g, cx + cw - 22, cTop - 22, 8, 12, '#7a4a3a'); rect(g, cx + cw - 23, cTop - 23, 10, 2, '#ffffff');
      smoke = { x: cx + cw - 18, y: cTop - 24 };
      const wx = cx + 14, wy = cTop + 12;
      rect(g, wx - 2, wy - 2, 26, 22, '#5a3a24');
      rect(g, wx, wy, 22, 18, tod === 'day' ? '#9fd3f6' : '#ffd27a'); rect(g, wx + 10, wy, 2, 18, '#5a3a24'); rect(g, wx, wy + 8, 22, 2, '#5a3a24');
      rect(g, wx - 3, wy + 20, 28, 3, '#ffffff');
      if (tod !== 'day') lights.push({ x: wx + 11, y: wy + 9, r: 50, c: '#ffc870', flicker: 0.05 });
      perches.push({ x0: cx - 6, x1: cx + cw + 6, y: cTop - 2 }, { x0: wx - 2, x1: wx + 24, y: wy + 19 });
    }
    // A birdhouse on a pole, a fence with snow on it.
    const hx = Math.round(W * 0.5), hy = Math.round(H * 0.44);
    rect(g, hx - 1, hy, 3, groundY - hy + 6, '#6b4a32');
    rect(g, hx - 9, hy - 16, 19, 16, '#a86a3a'); oval(g, hx, hy - 8, 2.5, 3, '#2a1a12'); rect(g, hx - 1, hy - 3, 3, 1, '#6b4a32');
    for (let i = 0; i < 7; i++) rect(g, hx - 11 + i, hy - 17 - i, 23 - i * 2, 1, i < 2 ? '#c9443a' : '#ffffff');
    perches.push({ x0: hx - 3, x1: hx + 3, y: hy - 24 }, { x0: hx - 4, x1: hx + 4, y: hy - 3 });
    const fTop = Math.round(H * 0.56);
    const fl = fence(g, rng, 0, Math.round(W * 0.36), fTop, groundY - 6, '#9a7050');
    for (let x = fl.x0; x < fl.x1; x++) { rect(g, x, fTop - 2 - (x % 7 === 0 ? 1 : 0), 1, 3, '#ffffff'); }
    perches.push({ ...fl, y: fTop - 3 });
    for (const px0 of [W * 0.1, W * 0.62]) if (px0 < W - 20) pine(g, rng, Math.round(px0), groundY + 2, rng.int(60, 80), LEAVES.pine, true);
    const holes: Hole[] = [];
    for (const f of [0.22, 0.4, 0.58]) holes.push({ x: Math.round(W * f), y: groundY - 1, w: 13, h: 10, kind: 'arch' });
    for (const h of holes) drawHole(g, h, '#f4f8ff');
    const props: Prop[] = [];
    if (W > 280) props.push(prop(snowmanSprite(), Math.round(W * 0.66), Math.round(groundY + (H - groundY) * 0.55), 26));
    // Soft blue shade in the snow near the front edge.
    g.fillStyle = '#c9d6ec';
    for (let y = H - 6; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < (y - (H - 6)) / 8) g.fillRect(x, y, 1, 1);
    return {
      indoor: false,
      floor: Math.round(H * 0.84),
      floorBand: [groundY + 3, H - 8],
      perches,
      holes,
      props,
      sky: [0, hor],
      lights,
      update: (dt) => sky.update(dt),
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        if (smoke) {
          gg.globalAlpha = 0.5;
          for (let i = 0; i < 6; i++) {
            const k = (t * 0.25 + i / 6) % 1;
            const r = 1 + k * 3;
            oval(gg, smoke.x + Math.sin(k * 5 + i) * 3 + k * 10, smoke.y - k * 30, r, r, '#e8ecf4');
          }
          gg.globalAlpha = 1;
        }
      },
    };
  },
};

