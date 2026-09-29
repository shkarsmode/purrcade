/**
 * The outdoor painter's kit: hills that fade with distance, a lawn whose blades get longer the
 * nearer they are, trees built from lit and shaded clumps of leaves, fences, flowers, pines with
 * snow on their shoulders, and a row of grass in front of everything that sways in the wind.
 */
import { layer } from '../core/screen';
import { col, mix } from '../core/color';
import type { Rng } from '../core/rng';
import type { Ledge } from '../game/types';
import { bayer, oval, px, rect } from '../game/art';

/** A range of hills from y (the lowest valley) upward by amp, filled down to `bottom`. */
export function hills(g: CanvasRenderingContext2D, W: number, y: number, amp: number, c: string, seed: number, bottom: number, freq = 1, rim?: string) {
  for (let x = 0; x < W; x++) {
    const h = (Math.sin(x * 0.011 * freq + seed) * 0.55 + Math.sin(x * 0.027 * freq + seed * 2.3) * 0.3 + Math.sin(x * 0.061 * freq + seed * 4.1) * 0.15 + 1) / 2;
    const top = Math.round(y - h * amp);
    rect(g, x, top, 1, bottom - top, c);
    if (rim) px(g, x, top, rim);
  }
}

/** Jagged mountains with snow on the peaks. */
export function mountains(g: CanvasRenderingContext2D, rng: Rng, W: number, y: number, amp: number, c: string, snow: string, bottom: number) {
  const peaks: [number, number][] = [];
  for (let x = -40; x < W + 40; x += rng.int(40, 90)) peaks.push([x, y - rng.range(0.45, 1) * amp]);
  for (let x = 0; x < W; x++) {
    let top = bottom;
    for (const [px0, py] of peaks) top = Math.min(top, py + Math.abs(x - px0) * 0.9);
    top = Math.round(top);
    rect(g, x, top, 1, bottom - top, c);
    for (const [px0, py] of peaks) {
      const d = Math.abs(x - px0);
      if (py + d * 0.9 <= top + 0.5 && top < py + 12) rect(g, x, top, 1, Math.max(1, Math.round(py + 12 - top - d * 0.25)), snow);
    }
  }
}

/** Grass seen at a slant: paler and finer far off, richer and longer near. */
export function lawn(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, far: string, near: string, blade: string, dark: string) {
  for (let yy = 0; yy < h; yy++) {
    const k = yy / Math.max(1, h - 1);
    rect(g, x, y + yy, w, 1, mix(far, near, Math.floor(k * 5) / 5));
    const seam = (k * 5) % 1;
    if (seam > 0.6) {
      g.fillStyle = col(mix(far, near, Math.min(1, Math.floor(k * 5) / 5 + 0.2)));
      for (let xx = x; xx < x + w; xx++) if (bayer(xx, y + yy) < (seam - 0.6) * 2.2) g.fillRect(xx, y + yy, 1, 1);
    }
  }
  const n = Math.round(w * h * 0.045);
  for (let i = 0; i < n; i++) {
    const yy = y + Math.floor(Math.pow(rng.next(), 0.7) * h);
    const k = (yy - y) / h;
    const L = 1 + Math.round(k * 3.2 * rng.next());
    const xx = x + rng.int(0, w - 1);
    const c = rng.chance(0.5) ? blade : dark;
    for (let j = 0; j < L; j++) px(g, xx + (j === L - 1 && rng.chance(0.4) ? rng.sign() : 0), yy - j, c);
  }
}

export interface Leafy { base: string; light: string; dark: string; deep: string }
export const LEAVES: Record<string, Leafy> = {
  summer: { base: '#4f9a4a', light: '#86c95e', dark: '#2f6e3a', deep: '#1f4d2e' },
  spring: { base: '#6fb85a', light: '#a8e07a', dark: '#468a44', deep: '#2f6a36' },
  autumn: { base: '#e0842e', light: '#f6b84a', dark: '#b8541f', deep: '#86381a' },
  red: { base: '#c9442e', light: '#f07a4a', dark: '#8e2a22', deep: '#5e1c1c' },
  pine: { base: '#2f6e4a', light: '#4f9a6a', dark: '#1f4d38', deep: '#143528' },
  night: { base: '#2c5a52', light: '#4a8a78', dark: '#1a3a38', deep: '#0f2426' },
};

/** A crown of leaves: clumps, each shaded dark to the lower right and lit to the upper left. */
export function crown(g: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, rx: number, ry: number, c: Leafy) {
  const clumps: [number, number, number][] = [];
  const n = Math.round(6 + (rx * ry) / 90);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next());
    clumps.push([cx + Math.cos(a) * d * rx * 0.72, cy + Math.sin(a) * d * ry * 0.7, rng.range(0.32, 0.5) * Math.min(rx, ry) + 3]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of clumps) oval(g, x + 1.5, y + 2, r, r * 0.9, c.deep);
  for (const [x, y, r] of clumps) {
    oval(g, x, y, r, r * 0.9, c.dark);
    oval(g, x - r * 0.12, y - r * 0.14, r * 0.86, r * 0.76, c.base);
    oval(g, x - r * 0.3, y - r * 0.36, r * 0.46, r * 0.38, c.light);
  }
  // Leaf texture: little marks inside each clump, lit ones high, shaded ones low.
  for (const [x, y, r] of clumps) {
    for (let i = 0; i < r * 1.6; i++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * r * 0.8;
      const mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d * 0.9;
      const up = my < y - r * 0.2;
      px(g, mx, my, up ? c.light : c.dark);
      if (rng.chance(0.5)) px(g, mx + 1, my, up ? c.base : c.deep);
    }
  }
}

/** A trunk with bark and a flare at the root; returns nothing — branches are drawn separately. */
export function trunk(g: CanvasRenderingContext2D, rng: Rng, x: number, top: number, bottom: number, w: number, bark = '#6b4a32') {
  const dark = mix(bark, '#000000', 0.35), light = mix(bark, '#ffffff', 0.15);
  for (let y = top; y < bottom; y++) {
    const k = (y - top) / (bottom - top);
    const flare = k > 0.85 ? (k - 0.85) * 40 : 0;
    const ww = w + flare;
    const x0 = Math.round(x - ww / 2);
    rect(g, x0, y, ww, 1, bark);
    rect(g, x0, y, 2, 1, light);
    rect(g, x0 + ww - 3, y, 3, 1, dark);
  }
  for (let i = 0; i < (bottom - top) / 4; i++) {
    const bx = x + rng.range(-w / 2 + 3, w / 2 - 4), by = rng.range(top, bottom - 4);
    rect(g, bx, by, 1, rng.int(3, 8), dark);
  }
}

/** A branch from (x0,y0) to (x1,y1), tapering; returns the ledge along its top. */
export function branch(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, bark = '#6b4a32'): Ledge {
  const dark = mix(bark, '#000000', 0.35), light = mix(bark, '#ffffff', 0.15);
  const n = Math.max(1, Math.round(Math.abs(x1 - x0)));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    const t = Math.max(1, Math.round(w * (1 - k * 0.6)));
    rect(g, x, y - t / 2, 1, t, bark);
    px(g, x, y - t / 2, light);
    px(g, x, y + t / 2 - 1, dark);
  }
  return { x0: Math.min(x0, x1) + 4, x1: Math.max(x0, x1) - 3, y: Math.round(Math.min(y0, y1) - w / 2 + (Math.abs(y1 - y0) / 2)) };
}

export function fence(g: CanvasRenderingContext2D, rng: Rng, x0: number, x1: number, top: number, bottom: number, c = '#b98552'): Ledge {
  const dark = mix(c, '#000000', 0.32), light = mix(c, '#ffffff', 0.16), shade = mix(c, '#000000', 0.12);
  for (let x = x0; x < x1; x += 8) {
    rect(g, x, top + 3, 8, bottom - top - 3, (x / 8) % 2 ? c : shade);
    rect(g, x, top + 3, 1, bottom - top - 3, dark);
    rect(g, x + 1, top + 3, 1, bottom - top - 3, light);
    for (let k = 0; k < 2; k++) rect(g, x + rng.int(3, 6), top + rng.int(6, bottom - top - 8), 1, rng.int(3, 6), dark);
  }
  // Rails, and the cap board birds sit on.
  for (const ry of [top + 8, bottom - 9]) { rect(g, x0, ry, x1 - x0, 3, mix(c, '#000000', 0.2)); rect(g, x0, ry, x1 - x0, 1, light); }
  rect(g, x0, top, x1 - x0, 3, mix(c, '#ffffff', 0.1)); rect(g, x0, top, x1 - x0, 1, mix(c, '#ffffff', 0.3)); rect(g, x0, top + 3, x1 - x0, 1, dark);
  g.globalAlpha = 0.22; rect(g, x0, bottom, x1 - x0, 2, '#000000'); g.globalAlpha = 1;
  return { x0, x1, y: top };
}

export function daisy(g: CanvasRenderingContext2D, x: number, y: number, h: number, petal = '#ffffff', mid = '#f4c430', stem = '#3d8a3a') {
  for (let k = 0; k < h; k++) px(g, x, y - k, stem);
  px(g, x + 1, y - Math.round(h / 2), '#5aa84a');
  const cy = y - h;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) px(g, x + dx, cy + dy, (dx && dy) ? mix(petal, '#000000', 0.08) : petal);
  px(g, x, cy, mid);
}

export function tulip(g: CanvasRenderingContext2D, x: number, y: number, h: number, c: string) {
  for (let k = 0; k < h; k++) px(g, x, y - k, '#3d8a3a');
  px(g, x - 1, y - 2, '#5aa84a'); px(g, x - 2, y - 3, '#5aa84a');
  const cy = y - h;
  rect(g, x - 1, cy - 2, 3, 3, c);
  px(g, x - 1, cy - 3, c); px(g, x + 1, cy - 3, c);
  px(g, x, cy - 2, mix(c, '#ffffff', 0.35));
}

export function bush(g: CanvasRenderingContext2D, rng: Rng, cx: number, bottom: number, rx: number, ry: number, c: Leafy, berries?: string) {
  crown(g, rng, cx, bottom - ry * 0.8, rx, ry, c);
  if (berries) for (let i = 0; i < rx / 2; i++) px(g, cx + rng.range(-rx * 0.7, rx * 0.7), bottom - ry * rng.range(0.3, 1.4), berries);
}

/** A pine: tiers of drooping boughs, with snow laid along their tops if asked. */
export function pine(g: CanvasRenderingContext2D, rng: Rng, x: number, bottom: number, h: number, c: Leafy, snow = false) {
  rect(g, x - 2, bottom - Math.round(h * 0.18), 4, Math.round(h * 0.18), '#5a3e2a');
  const tiers = Math.max(3, Math.round(h / 14));
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const ty = bottom - h * 0.12 - (tiers - 1 - i) * (h * 0.82 / tiers) - h * 0.04;
    const w = (0.18 + k * 0.82) * h * 0.42;
    const th = h * 0.9 / tiers + 4;
    for (let yy = 0; yy < th; yy++) {
      const f = yy / th;
      const hw = Math.round(w * (0.15 + f * 0.85));
      const yRow = Math.round(ty - th + yy);
      rect(g, x - hw, yRow, hw * 2, 1, f > 0.75 ? c.dark : c.base);
      px(g, x - hw, yRow, c.deep);
      if (hw > 3) px(g, x - hw + 2, yRow, c.light);
      if (snow && yy < 3 + f * 0) { rect(g, x - hw, yRow, Math.max(1, Math.round(hw * 1.2)), 1, '#f4f8ff'); }
    }
    if (snow) for (let s = -w; s < w; s += 2) if (rng.chance(0.55)) px(g, x + s, ty - 1 - rng.int(0, 1), '#ffffff');
  }
}

/** Grass along the very front of the picture, pre-drawn in a few sway positions. */
export function frontGrass(W: number, H: number, rng: Rng, tall: number, colors: string[], seed = 1): (g: CanvasRenderingContext2D, t: number) => void {
  const blades: { x: number; h: number; c: string; lean: number; ph: number }[] = [];
  for (let x = -4; x < W + 4; x += rng.int(1, 3)) {
    if (rng.chance(0.25)) continue;
    blades.push({ x, h: Math.round(tall * rng.range(0.35, 1)), c: rng.pick(colors), lean: rng.range(-0.6, 0.6), ph: rng.range(0, 6) });
  }
  const frames: HTMLCanvasElement[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const [cv, g] = layer(W, tall + 2);
    const sway = Math.sin((f / N) * Math.PI * 2);
    for (const b of blades) {
      for (let k = 0; k < b.h; k++) {
        const t = k / b.h;
        const dx = Math.round((b.lean + sway * 0.9 * (0.6 + 0.4 * Math.sin(b.ph + seed))) * t * t * 4);
        px(g, b.x + dx, tall + 1 - k, t > 0.7 ? mix(b.c, '#ffffff', 0.12) : b.c);
      }
    }
    frames.push(cv);
  }
  return (g, t) => {
    const f = Math.floor(((t * 0.5) % 1) * N);
    g.drawImage(frames[f], 0, H - tall - 2);
  };
}

/** A lamp post, drawn in place; returns where its light is. */
export function lampPost(g: CanvasRenderingContext2D, x: number, bottom: number, h: number): { x: number; y: number } {
  rect(g, x - 1, bottom - h, 3, h, '#2e2a33'); rect(g, x - 1, bottom - h, 1, h, '#4a4552');
  rect(g, x - 4, bottom - 3, 9, 3, '#2e2a33');
  const top = bottom - h;
  rect(g, x - 5, top - 2, 11, 2, '#2e2a33');
  rect(g, x - 4, top - 10, 9, 8, '#f6e2a0'); rect(g, x - 4, top - 10, 1, 8, '#2e2a33'); rect(g, x + 4, top - 10, 1, 8, '#2e2a33'); rect(g, x, top - 10, 1, 8, '#c9a860');
  rect(g, x - 5, top - 12, 11, 2, '#2e2a33'); rect(g, x - 2, top - 14, 5, 2, '#2e2a33'); px(g, x, top - 15, '#2e2a33');
  return { x, y: top - 6 };
}
