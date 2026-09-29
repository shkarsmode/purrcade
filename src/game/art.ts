/**
 * The painter's kit for backgrounds: gradients laid in dithered bands the way 16-bit skies were,
 * textures for wood, tiles, carpet, grass and sand, and soft pools of light made of pixels.
 * All at world resolution, all through col(), so a display mode repaints the whole set.
 */
import { col, mix, rgb } from '../core/color';
import { layer } from '../core/screen';
import type { Rng } from '../core/rng';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = col(c);
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  g.fillStyle = col(c);
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** c1 with c2 dithered in at density k (0..1). */
export function dither(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string, k: number) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  rect(g, x, y, w, h, c1);
  if (k <= 0) return;
  g.fillStyle = col(c2);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (bayer(xx, yy) < k) g.fillRect(xx, yy, 1, 1);
}

/**
 * A vertical gradient through the given stops, in flat bands with a dithered seam between each
 * pair — the classic sky.
 */
export function bands(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stops: string[], steps = 4) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (h <= 0 || w <= 0) return;
  const n = stops.length - 1;
  for (let yy = 0; yy < h; yy++) {
    const t = (yy / Math.max(1, h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    const q = Math.floor(f * steps) / steps;       // flat band colour
    const next = Math.min(1, q + 1 / steps);
    const a = mix(stops[i], stops[i + 1], q), b = mix(stops[i], stops[i + 1], next);
    const k = (f - q) * steps;                     // how far into the band: dither the next one in
    g.fillStyle = col(a);
    g.fillRect(x, y + yy, w, 1);
    if (k > 0.05) {
      g.fillStyle = col(b);
      for (let xx = x; xx < x + w; xx++) if (bayer(xx, y + yy) < k) g.fillRect(xx, y + yy, 1, 1);
    }
  }
}

/** Speckles of a colour, for grit, grain and stars. */
export function speckle(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, c: string, density: number) {
  g.fillStyle = col(c);
  const n = Math.round(w * h * density);
  for (let i = 0; i < n; i++) g.fillRect(Math.round(x + rng.next() * w), Math.round(y + rng.next() * h), 1, 1);
}

/** Wooden planks with seams, knots and grain. */
export function planks(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, base: string, plankH = 7) {
  const dark = mix(base, '#000000', 0.28), light = mix(base, '#ffffff', 0.12), grain = mix(base, '#000000', 0.12);
  for (let yy = y, row = 0; yy < y + h; yy += plankH, row++) {
    const hh = Math.min(plankH, y + h - yy);
    const tint = row % 2 ? base : mix(base, '#000000', 0.05);
    rect(g, x, yy, w, hh, tint);
    rect(g, x, yy, w, 1, light);
    rect(g, x, yy + hh - 1, w, 1, dark);
    let xx = x - rng.int(0, 40);
    while (xx < x + w) {
      const L = rng.int(28, 60);
      rect(g, xx + L, yy, 1, hh, dark);
      for (let i = 0; i < 3; i++) rect(g, xx + rng.int(3, L - 3), yy + rng.int(2, Math.max(2, hh - 2)), rng.int(3, 9), 1, grain);
      if (rng.chance(0.15)) { px(g, xx + rng.int(4, L - 4), yy + Math.floor(hh / 2), dark); }
      xx += L + 1;
    }
  }
}

/** Floor tiles seen at a slant: rows get taller toward the viewer. */
export function tiles(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string, grout: string) {
  let yy = y, row = 0, th = 5;
  while (yy < y + h) {
    const hh = Math.min(Math.round(th), y + h - yy);
    const tw = Math.round(th * 2.6);
    for (let xx = x - (row % 2 ? tw / 2 : 0), i = 0; xx < x + w; xx += tw, i++) {
      rect(g, xx, yy, tw, hh, (i + row) % 2 ? a : b);
      rect(g, xx, yy, 1, hh, grout);
    }
    rect(g, x, yy, w, 1, grout);
    yy += hh; row++; th *= 1.18;
  }
}

/** Wallpaper: a quiet repeating motif. */
export function wallpaper(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, motif: string, kind: 'stripes' | 'dots' | 'diamonds' | 'floral' = 'stripes', accent?: string) {
  rect(g, x, y, w, h, base);
  g.fillStyle = col(motif);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (kind === 'stripes' && xx % 12 < 2) g.fillRect(xx, yy, 1, 1);
      else if (kind === 'dots' && xx % 10 === 0 && yy % 10 === 0) g.fillRect(xx, yy, 1, 1);
      else if (kind === 'diamonds' && (Math.abs((xx % 14) - 7) + Math.abs((yy % 14) - 7)) === 5) g.fillRect(xx, yy, 1, 1);
      else if (kind === 'floral' && xx % 16 === 0 && (yy % 3) === 0) g.fillRect(xx, yy, 1, 1);
    }
  }
  if (kind === 'floral') {
    // Little four-petal flowers between the stripes, every other row shifted.
    const pc = col(accent || motif);
    for (let yy = y + 6, row = 0; yy < y + h - 2; yy += 14, row++) {
      for (let xx = x + 8 + (row % 2) * 8; xx < x + w - 1; xx += 16) {
        g.fillStyle = pc;
        g.fillRect(xx - 1, yy, 3, 1); g.fillRect(xx, yy - 1, 1, 3);
        g.fillStyle = col(motif);
        g.fillRect(xx, yy, 1, 1);
      }
    }
  }
}

/** Upright boards, the way a wainscot or a fence is built: seams, a lit edge, a little grain. */
export function boards(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, base: string, bw = 9) {
  const dark = mix(base, '#000000', 0.3), light = mix(base, '#ffffff', 0.14), grain = mix(base, '#000000', 0.1);
  rect(g, x, y, w, h, base);
  for (let xx = x, i = 0; xx < x + w; xx += bw, i++) {
    if (i % 2) rect(g, xx, y, bw, h, mix(base, '#000000', 0.04));
    rect(g, xx, y, 1, h, dark);
    rect(g, xx + 1, y, 1, h, light);
    for (let k = 0; k < h / 10; k++) rect(g, xx + rng.int(3, bw - 2), y + rng.int(0, h - 6), 1, rng.int(3, 7), grain);
  }
}

/** A tuft of grass blades. */
export function grassTuft(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, h: number, c1: string, c2: string, sway = 0) {
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const bx = x + rng.int(-3, 3), bh = Math.round(h * rng.range(0.5, 1));
    const lean = rng.range(-1, 1) + sway;
    for (let k = 0; k < bh; k++) {
      const t = k / bh;
      px(g, bx + Math.round(lean * t * t * 3), y - k, t > 0.6 ? c2 : c1);
    }
  }
}

/** A flower on a stem. */
export function flower(g: CanvasRenderingContext2D, x: number, y: number, h: number, petal: string, center: string, stem = '#3d8a3a') {
  for (let k = 0; k < h; k++) px(g, x, y - k, stem);
  const cy = y - h;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(g, x + dx, cy + dy, petal);
  px(g, x, cy, center);
}

/**
 * A pool of light: rings of brightness, a few steps from the rim to the middle, with the seam
 * between two steps dithered — the way light was painted when a palette had eight shades of it.
 * Drawn with 'lighter' it brightens what is under it without blurring a pixel.
 */
const lightCache = new Map<string, HTMLCanvasElement>();
export function lightSprite(r: number, c: string, strength = 1, levels = 9): HTMLCanvasElement {
  r = Math.max(1, Math.round(r));
  const key = r + c + strength + ':' + levels + ':' + col(c);
  let s = lightCache.get(key);
  if (s) return s;
  const size = r * 2 + 1;
  const [cv, g] = layer(size, size);
  const [cr, cg, cb] = rgb(col(c));
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d >= 1) continue;
      const f = Math.min(1, (1 - d) * (1 - d) * strength) * levels;
      const lo = Math.floor(f);
      const lvl = lo + (bayer(x, y) < f - lo ? 1 : 0);
      if (!lvl) continue;
      const i = (y * size + x) * 4;
      img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = Math.round((lvl / levels) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  if (lightCache.size > 300) lightCache.clear();
  lightCache.set(key, cv);
  s = cv;
  return s;
}

/** A soft oval shadow to set something on the ground; drawn at partial alpha. */
const shadowCache = new Map<string, HTMLCanvasElement>();
export function shadowSprite(w: number, h: number): HTMLCanvasElement {
  w = Math.max(2, Math.round(w)); h = Math.max(1, Math.round(h));
  const key = w + 'x' + h;
  let s = shadowCache.get(key);
  if (s) return s;
  const [cv, g] = layer(w, h);
  g.fillStyle = '#000';
  const rx = w / 2, ry = h / 2;
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5 - ry) / ry;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)));
    if (hw > 0) g.fillRect(Math.round(rx - hw), y, hw * 2, 1);
  }
  shadowCache.set(key, cv);
  s = cv;
  return s;
}

export function shadow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h = 3, a = 0.28) {
  const s = shadowSprite(w, h);
  g.globalAlpha = a;
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
  g.globalAlpha = 1;
}

/** A filled ellipse in rows, for the painted backgrounds. */
export function oval(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.fillStyle = col(c);
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const k = 1 - (y / ry) ** 2;
    if (k < 0) continue;
    const hw = Math.round(rx * Math.sqrt(k));
    g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
  }
}

/**
 * The open part of a hole, as whole-pixel rows [y, x0, x1) from the top down: an arch is a
 * half-circle on straight sides, a slot is a plain dark gap.
 */
export function holeRows(h: { x: number; y: number; w: number; h: number; kind?: 'arch' | 'slot' }): [number, number, number][] {
  const rows: [number, number, number][] = [];
  const r = h.w / 2;
  for (let i = 0; i < h.h; i++) {
    const up = h.h - 1 - i;                               // rows above the bottom one
    let hw = r;
    if (h.kind !== 'slot' && up > h.h - 1 - r) {
      const dy = up - (h.h - 1 - r) + 0.5;
      hw = Math.sqrt(Math.max(0, r * r - dy * dy));
    }
    const x0 = Math.round(h.x - hw), x1 = Math.round(h.x + hw);
    if (x1 > x0) rows.push([Math.round(h.y - h.h + 1 + i), x0, x1]);
  }
  return rows;
}

/** A mouse hole in a skirting board: the dark inside, a worn rim, the lit inner edge. */
export function drawHole(g: CanvasRenderingContext2D, h: { x: number; y: number; w: number; h: number; kind?: 'arch' | 'slot' }, wall: string) {
  const rows = holeRows(h);
  const rim = mix(wall, '#000000', 0.45), lit = mix(wall, '#ffffff', 0.18);
  // Rim: one pixel round the opening, lighter on the right where the light falls in.
  for (const [y, x0, x1] of rows) { rect(g, x0 - 1, y, 1, 1, rim); rect(g, x1, y, 1, 1, lit); }
  if (rows.length) { const [y, x0, x1] = rows[0]; rect(g, x0, y - 1, x1 - x0, 1, rim); }
  for (let i = 0; i < rows.length; i++) {
    const [y, x0, x1] = rows[i];
    if (i > 0) {
      const [, p0, p1] = rows[i - 1];
      if (p0 > x0) rect(g, x0, y - 1, p0 - x0, 1, rim);
      if (p1 < x1) rect(g, p1, y - 1, x1 - p1, 1, lit);
    }
    rect(g, x0, y, x1 - x0, 1, '#140d12');
    rect(g, x1 - 1, y, 1, 1, '#2a1c22');
  }
  const last = rows[rows.length - 1];
  if (last) rect(g, last[1], last[0], last[2] - last[1], 1, '#2e2127');
}

/** A cloud: overlapping puffs with a lit top and a shaded belly. */
export function cloud(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, lit: string, body: string, shade: string) {
  const puffs = Math.max(3, Math.round(w / 10));
  const pts: [number, number, number][] = [];
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const r = (Math.sin(t * Math.PI) * 0.6 + 0.4) * (w / 5) * rng.range(0.8, 1.15);
    pts.push([x + t * w, y - r * 0.3, r]);
  }
  const fill = (c: string, dy: number, shrink: number) => {
    g.fillStyle = col(c);
    for (const [cx, cy, r] of pts) {
      const R = r - shrink;
      for (let yy = -R; yy <= R; yy++) {
        const half = Math.sqrt(Math.max(0, R * R - yy * yy));
        if (cy + yy > y + 2) continue;          // flat bottom
        g.fillRect(Math.round(cx - half), Math.round(cy + yy + dy), Math.round(half * 2), 1);
      }
    }
  };
  fill(shade, 1, 0);
  fill(body, 0, 0.5);
  fill(lit, -1, 2);
  fill(body, 0, 3.5);
}
