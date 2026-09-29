/**
 * Water places. The koi pond is seen from straight above: stones round the edge, the bottom
 * showing through the shallows, light rippling over it, lily pads floating on top — the pads
 * are drawn by the scene over the fish, so a fish can slip under one and vanish.
 */
import { layer } from '../core/screen';
import { col, mix } from '../core/color';
import type { Rng } from '../core/rng';
import type { LocationDef, LocationInstance } from '../game/types';
import { bayer, oval, px, shadow } from '../game/art';

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
