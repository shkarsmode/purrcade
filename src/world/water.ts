/**
 * Water places. The koi pond is seen from straight above: stones round the edge, the bottom
 * showing through the shallows, light rippling over it, lily pads floating on top — the pads
 * are drawn by the scene over the fish, so a fish can slip under one and vanish.
 */
import { layer } from '../core/screen';
import { col, mix } from '../core/color';
import type { Rng } from '../core/rng';
import type { LocationDef, LocationInstance } from '../game/types';
import { bands, bayer, oval, px, rect, shadow } from '../game/art';
import { sprite } from '../core/pix';
import { BASE, O, U } from '../sprites/common';

export interface Pad { x: number; y: number; r: number; a: number; flower: boolean; drift: number; ph: number }

/** A pond seen from above. `pads` is handed to the scene so it can draw them over the fish. */
export interface PondInstance extends LocationInstance { pads: Pad[]; deep: (x: number, y: number) => number }

export const koiPond: LocationDef = {
  id: 'koi',
  name: { uk: 'Ставок з кої', en: 'Koi pond' },
  indoor: false,
  weathers: ['clear', 'clear', 'rain', 'petals', 'leaves'],
  build(W, H, tod, rng): PondInstance {
    const [cv, g] = layer(W, H);
    // Depth: 0 at the stony edge, 1 in the middle of the pond.
    const cx = W / 2, cy = H / 2;
    const edge = (x: number, y: number) => {
      const nx = (x - cx) / (W * 0.56), ny = (y - cy) / (H * 0.62);
      const wob = Math.sin(Math.atan2(ny, nx) * 5 + 1.3) * 0.05 + Math.sin(Math.atan2(ny, nx) * 3) * 0.04;
      return 1 - Math.hypot(nx, ny) - wob;
    };
    const deepC = ['#0f3a44', '#135064', '#1b6678', '#2a8290', '#4aa0a0', '#79b8a4'];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const e = edge(x, y);
        if (e < 0) continue;
        const k = Math.min(0.999, e * 2.2);
        const f = (1 - k) * (deepC.length - 1);
        const i = Math.floor(f), fr = f - i;
        g.fillStyle = col(bayer(x, y) < fr ? deepC[Math.min(deepC.length - 1, i + 1)] : deepC[i]);
        g.fillRect(x, y, 1, 1);
      }
    }
    // Pebbles on the bottom in the shallows.
    for (let i = 0; i < W * H / 60; i++) {
      const x = rng.int(0, W), y = rng.int(0, H);
      const e = edge(x, y);
      if (e < 0.02 || e > 0.22) continue;
      oval(g, x, y, rng.range(1, 2.5), rng.range(1, 2), mix(rng.pick(['#8a8a6a', '#6a7a5a', '#9a8a70']), deepC[4], Math.min(1, e * 4)));
    }
    // The stone rim and the grass beyond it.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const e = edge(x, y);
        if (e >= 0) continue;
        g.fillStyle = col(e > -0.035 ? '#8a8578' : e > -0.06 ? '#a39d8e' : bayer(x, y) < 0.3 ? '#4f8a3e' : '#5e9a48');
        g.fillRect(x, y, 1, 1);
      }
    }
    // Big stones on the rim.
    for (let a = 0; a < Math.PI * 2; a += rng.range(0.18, 0.32)) {
      const r = 1.0;
      const x = cx + Math.cos(a) * W * 0.56 * r * 1.02, y = cy + Math.sin(a) * H * 0.62 * r * 1.02;
      const s = rng.range(6, 11);
      oval(g, x + 1, y + 2, s, s * 0.75, '#5a564c');
      oval(g, x, y, s, s * 0.75, rng.pick(['#a39d8e', '#b3ad9e', '#948e80']));
      oval(g, x - s * 0.3, y - s * 0.3, s * 0.45, s * 0.3, '#cfc9ba');
    }
    // Reeds and grass tufts in the corners.
    for (let i = 0; i < 60; i++) {
      const x = rng.int(0, W), y = rng.int(0, H);
      if (edge(x, y) > -0.09) continue;
      for (let k = 0; k < 4; k++) px(g, x + rng.int(-2, 2), y - k, k > 2 ? '#8fcf5a' : '#3e7a34');
    }
    // Lily pads, handed over to the scene.
    const pads: Pad[] = [];
    for (let i = 0; i < Math.round((W * H) / 9000); i++) {
      for (let k = 0; k < 10; k++) {
        const x = rng.range(W * 0.12, W * 0.88), y = rng.range(H * 0.12, H * 0.88);
        if (edge(x, y) < 0.08) continue;
        if (pads.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + 16)) continue;
        pads.push({ x, y, r: rng.range(8, 14), a: rng.range(0, Math.PI * 2), flower: rng.chance(0.35), drift: rng.range(0.4, 1.2), ph: rng.range(0, 6) });
        break;
      }
    }
    // Caustics: a few frames of light wriggling over the bottom, drawn faintly over the water.
    const frames: HTMLCanvasElement[] = [];
    for (let f = 0; f < 8; f++) {
      const [fc, fg] = layer(W, H);
      fg.fillStyle = col(tod === 'night' ? '#6a8ac0' : '#bff0e0');
      const ph = (f / 8) * Math.PI * 2;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          if (edge(x, y) < 0.03) continue;
          const v = Math.sin(x * 0.11 + Math.sin(y * 0.07 + ph) * 2.2) + Math.sin(y * 0.13 + Math.sin(x * 0.05 - ph) * 2.0);
          if (Math.abs(v) < 0.09) fg.fillRect(x, y, 1, 1);
        }
      }
      frames.push(fc);
    }
    return {
      indoor: false,
      floor: H,
      water: [0, H],
      pads,
      deep: (x, y) => edge(x, y),
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        gg.globalAlpha = tod === 'night' ? 0.08 : 0.13;
        gg.drawImage(frames[Math.floor(t * 5) % frames.length], 0, 0);
        gg.globalAlpha = 1;
      },
    };
  },
};

/** A little castle for the bottom of a tank. */
function castleSprite(): HTMLCanvasElement {
  return sprite('castle', 44, 46, (p) => {
    const S = 5, SL = 6, SD = 7, DK = 8, FL = 9, MS = 10;
    p.rect(4, 16, 39, 45, S);
    p.rect(0, 8, 11, 45, S); p.rect(32, 8, 43, 45, S); p.rect(16, 2, 27, 45, S);
    for (const [x0, x1, y] of [[0, 11, 8], [32, 43, 8], [16, 27, 2], [4, 39, 16]] as [number, number, number][]) for (let x = x0; x <= x1; x += 3) p.rect(x, y - 2, x + 1, y - 1, S);
    p.rect(18, 33, 25, 45, DK); p.disc(21.5, 33, 3.5, DK);
    p.rect(4, 20, 7, 24, DK); p.rect(36, 20, 39, 24, DK); p.rect(20, 10, 23, 14, DK);
    for (let y = 20; y < 45; y += 5) for (let x = 1 + ((y / 5) % 2) * 2; x < 43; x += 5) p.set(x, y, SD);
    for (let x = 0; x < 44; x += 2) p.set(x, 44 - (x % 4 ? 0 : 1), MS);
    p.rect(21, -4, 21, 1, SD); p.tri([22, -4], [28, -2.5], [22, -1], FL);
    p.rim([[S, SL, SD]]);
    p.outline(O, U);
  }, [...BASE, '#b8a8c8', '#dcd0e8', '#8a7a9a', '#2a1f3a', '#e8543a', '#5a9a3e']);
}

export const aquarium: LocationDef = {
  id: 'aquarium',
  name: { uk: 'Акваріум', en: 'Aquarium' },
  indoor: true,
  weathers: ['clear'],
  build(W, H, tod, rng): LocationInstance {
    const sandY = Math.round(H * 0.8);
    const [cv, g] = layer(W, H);
    bands(g, 0, 0, W, sandY + 6, ['#3aa0c0', '#1f7aa0', '#135a80', '#0c3a5a'], 5);
    // Shafts of light from the lamp above, faint and slanting.
    g.globalAlpha = 0.07;
    for (let i = 0; i < 7; i++) {
      const x0 = rng.range(-40, W);
      for (let y = 0; y < sandY; y++) rect(g, x0 + y * 0.3, y, rng.int(6, 16), 1, '#e8fbff');
    }
    g.globalAlpha = 1;
    // Rocks at the back, the sand, pebbles.
    for (let i = 0; i < Math.round(W / 60); i++) { const rx = rng.range(0, W), rr = rng.range(14, 30); oval(g, rx, sandY - rr * 0.3, rr, rr * 0.7, '#4a5a6a'); oval(g, rx - rr * 0.2, sandY - rr * 0.5, rr * 0.6, rr * 0.35, '#6a7a8a'); }
    for (let y = sandY; y < H; y++) {
      const k = (y - sandY) / (H - sandY);
      for (let x = 0; x < W; x++) {
        const wave = Math.sin(x * 0.05) * 2 + Math.sin(x * 0.13 + 1) * 1;
        if (y < sandY + wave) continue;
        g.fillStyle = col(bayer(x, y) < 0.18 ? '#c8a878' : k < 0.1 ? '#f0dcb0' : '#e8d0a0');
        g.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < W / 3; i++) px(g, rng.int(0, W), rng.int(sandY + 3, H), rng.pick(['#b86a4a', '#6a8ac0', '#f0f0f0', '#8a8a8a', '#d89a5a']));
    // Shells.
    for (let i = 0; i < W / 70; i++) { const sx = rng.int(10, W - 10), sy = rng.int(sandY + 6, H - 4); oval(g, sx, sy, 3, 2, '#fbe0d0'); px(g, sx - 1, sy, '#e8a890'); px(g, sx + 1, sy, '#e8a890'); }
    const castle = castleSprite();
    const cx = Math.round(W * 0.7);
    g.drawImage(castle, cx - 22, sandY - 40);
    // The rim of the tank: dark along the top, a lit edge on the glass.
    rect(g, 0, 0, W, 4, '#1a2a30'); rect(g, 0, 4, W, 1, '#8ad0e8');
    g.globalAlpha = 0.25; rect(g, 2, 5, 2, H - 8, '#ffffff'); rect(g, W - 4, 5, 1, H - 8, '#ffffff'); g.globalAlpha = 1;
    // Plants: strands rooted in the sand that sway.
    const strands: { x: number; h: number; c: string; ph: number }[] = [];
    for (let i = 0; i < W / 9; i++) {
      const clump = rng.chance(0.5) ? rng.range(W * 0.02, W * 0.3) : rng.range(W * 0.8, W * 0.98);
      strands.push({ x: clump + rng.range(-10, 10), h: rng.range(H * 0.2, H * 0.55), c: rng.pick(['#3a9a4a', '#5ab85a', '#2a7a3a', '#7ad06a']), ph: rng.range(0, 6) });
    }
    // Bubbles from a stone on the left, and from the castle door.
    const bubbles: { x: number; y: number; r: number; v: number; ph: number }[] = [];
    const stoneX = Math.round(W * 0.14);
    let nextB = 0, nextC = rng.range(4, 9);
    const surface = 6;
    return {
      indoor: true,
      floor: sandY + 6,
      floorBand: [sandY + 2, H - 6],
      water: [surface, sandY],
      lights: [{ x: W / 2, y: 0, r: Math.round(W * 0.35), c: '#9fe8ff', a: 0.7 }],
      update(dt) {
        nextB -= dt;
        if (nextB <= 0) { nextB = rng.range(0.08, 0.25); bubbles.push({ x: stoneX + rng.range(-2, 2), y: sandY - 2, r: rng.chance(0.3) ? 2 : 1, v: rng.range(30, 50), ph: rng.range(0, 6) }); }
        nextC -= dt;
        if (nextC <= 0) { nextC = rng.range(6, 12); for (let i = 0; i < 8; i++) bubbles.push({ x: cx + rng.range(-3, 3), y: sandY - 6 - i * 3, r: rng.chance(0.4) ? 2 : 1, v: rng.range(25, 40), ph: rng.range(0, 6) }); }
        for (const b of bubbles) { b.y -= b.v * dt; b.ph += dt * 5; }
        for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].y < surface + 2) bubbles.splice(i, 1);
      },
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        for (const s of strands) {
          for (let y = 0; y < s.h; y++) {
            const k = y / s.h;
            const x = s.x + Math.sin(t * 0.9 + s.ph + y * 0.04) * k * k * 9;
            gg.fillStyle = col(k > 0.85 ? mix(s.c, '#ffffff', 0.25) : s.c);
            gg.fillRect(Math.round(x), Math.round(sandY + 2 - y), 2, 1);
          }
        }
        // The stone the air comes out of.
        oval(gg, stoneX, sandY + 1, 5, 3, '#6a6a7a'); oval(gg, stoneX - 1, sandY, 3, 1.5, '#9a9aaa');
      },
      drawFront(gg, t) {
        for (const b of bubbles) {
          const x = Math.round(b.x + Math.sin(b.ph) * 1.5), y = Math.round(b.y);
          gg.fillStyle = col('#d8f4ff');
          if (b.r > 1) { gg.fillRect(x - 1, y - 2, 3, 1); gg.fillRect(x - 1, y + 2, 3, 1); gg.fillRect(x - 2, y - 1, 1, 3); gg.fillRect(x + 2, y - 1, 1, 3); gg.fillStyle = col('#ffffff'); gg.fillRect(x - 1, y - 1, 1, 1); }
          else { gg.fillRect(x, y, 1, 1); }
        }
        // Light playing on the surface.
        gg.globalAlpha = 0.35;
        gg.fillStyle = col('#e8fbff');
        for (let x = 0; x < W; x += 2) if (Math.sin(x * 0.08 + t * 1.6) + Math.sin(x * 0.031 - t) > 1.1) gg.fillRect(x, surface, 2, 1);
        gg.globalAlpha = 1;
      },
    };
  },
};

const padCache = new WeakMap<Pad, { cv: HTMLCanvasElement; gen: string }>();

function padSprite(p: Pad): HTMLCanvasElement {
  const key = col('#4f9a4a');
  const hit = padCache.get(p);
  if (hit && hit.gen === key) return hit.cv;
  const r = p.r, R = Math.ceil(r) + 2;
  const [cv, g] = layer(R * 2 + 1, R * 2 + 1);
  for (let yy = -R; yy <= R; yy++) {
    for (let xx = -R; xx <= R; xx++) {
      const d = Math.hypot(xx, yy);
      if (d > r + 1) continue;
      let da = Math.atan2(yy, xx) - p.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.28 && d > 1) continue;
      const vein = Math.abs(Math.sin(Math.atan2(yy, xx) * 4)) < 0.12 && d > 2;
      const c = d > r ? '#1f4a2a' : d > r - 1.2 ? '#6fb85a' : vein ? '#3e8a3e' : (xx + yy < -r * 0.3 ? '#8fd16a' : '#4f9a4a');
      g.fillStyle = col(c);
      g.fillRect(R + xx, R + yy, 1, 1);
    }
  }
  if (p.flower) {
    const fx = Math.round(R - r * 0.25), fy = Math.round(R - r * 0.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.fillStyle = col(i % 2 ? '#ff9ab8' : '#ffd0e0');
      g.fillRect(Math.round(fx + Math.cos(a) * 3), Math.round(fy + Math.sin(a) * 3), 2, 2);
    }
    g.fillStyle = col('#ffffff'); g.fillRect(fx - 1, fy - 1, 1, 1);
    g.fillStyle = col('#ffe066'); g.fillRect(fx, fy, 2, 2);
  }
  padCache.set(p, { cv, gen: key });
  return cv;
}

/** Where a pad is now: they drift a little on the current. */
export function padAt(p: Pad, t: number): [number, number] {
  return [p.x + Math.sin(t * 0.2 * p.drift + p.ph) * 2, p.y + Math.cos(t * 0.17 * p.drift + p.ph) * 1.5];
}

export function drawPad(g: CanvasRenderingContext2D, p: Pad, t: number) {
  const [x, y] = padAt(p, t);
  const cv = padSprite(p);
  shadow(g, x + 1.5, y + 2.5, p.r * 2, p.r * 1.8, 0.22);
  g.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height / 2));
}
