/**
 * Pixel art, drawn rather than shipped.
 *
 * Every creature and toy is painted into a small buffer of palette indices — ellipses for bodies,
 * capsules for limbs, triangles for ears and wings — then finished the same way: one dark outline
 * round the silhouette, a line of light along the upper edges and of shade along the lower ones.
 * That shared finish is what makes a mouse, a koi and a robot vacuum look like one game.
 * Buffers become canvases once, cached by name, and are blitted at whole pixels.
 */
import { col, colorGeneration } from './color';

export type Pt = [number, number];
export type Paint = number | ((x: number, y: number, u: number, v: number) => number);

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.px = new Uint8Array(w * h);
  }

  set(x: number, y: number, c: number) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    x = Math.floor(x); y = Math.floor(y);
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : 0;
  }

  private paint(p: Paint, x: number, y: number, u = 0, v = 0) {
    const c = typeof p === 'number' ? p : p(x, y, u, v);
    if (c) this.set(x, y, c);
  }

  rect(x0: number, y0: number, x1: number, y1: number, c: Paint) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) this.paint(c, x, y);
  }

  /** A filled ellipse, optionally turned; paint gets the point in the ellipse's own frame. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Paint, rot = 0) {
    const R = Math.max(rx, ry) + 1;
    const cs = Math.cos(-rot), sn = Math.sin(-rot);
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
        if ((lx / rx) ** 2 + (ly / ry) ** 2 <= 1) this.paint(c, x, y, lx / rx, ly / ry);
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: Paint) {
    this.ellipse(cx, cy, r, r, c);
  }

  /** A line with round ends and thickness 2r; paint gets how far along it the point is. */
  capsule(a: Pt, b: Pt, r: number, c: Paint) {
    const x0 = Math.floor(Math.min(a[0], b[0]) - r - 1), x1 = Math.ceil(Math.max(a[0], b[0]) + r + 1);
    const y0 = Math.floor(Math.min(a[1], b[1]) - r - 1), y1 = Math.ceil(Math.max(a[1], b[1]) + r + 1);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1e-6;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = ((px - a[0]) * dx + (py - a[1]) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (a[0] + dx * t), ey = py - (a[1] + dy * t);
        if (ex * ex + ey * ey <= r * r) this.paint(c, x, y, t, 0);
      }
    }
  }

  tri(p0: Pt, p1: Pt, p2: Pt, c: Paint) {
    const x0 = Math.floor(Math.min(p0[0], p1[0], p2[0])), x1 = Math.ceil(Math.max(p0[0], p1[0], p2[0]));
    const y0 = Math.floor(Math.min(p0[1], p1[1], p2[1])), y1 = Math.ceil(Math.max(p0[1], p1[1], p2[1]));
    const e = (a: Pt, b: Pt, x: number, y: number) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const a = e(p0, p1, px, py), b = e(p1, p2, px, py), c2 = e(p2, p0, px, py);
        if ((a >= 0 && b >= 0 && c2 >= 0) || (a <= 0 && b <= 0 && c2 <= 0)) this.paint(c, x, y);
      }
    }
  }

  /** A one-pixel line. */
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Every empty pixel touching the figure becomes outline — `under` below it, where the shadow is. */
  outline(out: number, under = out) {
    const { w, h, px } = this;
    const src = px.slice();
    const solid = (i: number) => src[i] !== 0 && src[i] !== out && src[i] !== under;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i]) continue;
        const up = y > 0 && solid(i - w), dn = y < h - 1 && solid(i + w);
        const lf = x > 0 && solid(i - 1), rt = x < w - 1 && solid(i + 1);
        if (up || dn || lf || rt) px[i] = up && !dn ? under : out;
      }
    }
  }

  /**
   * Light along the upper edge of each base colour and shade along the lower one — the look of
   * a thing lit from above. Pairs: [base, light, dark]; 0 skips that half.
   */
  rim(pairs: Array<[number, number, number]>) {
    const { w, h, px } = this;
    const src = px.slice();
    const map = new Map(pairs.map((p) => [p[0], p]));
    const edge = (v: number) => v === 0 || !map.has(v) && !pairs.some((p) => p[1] === v || p[2] === v);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const p = map.get(src[i]);
        if (!p) continue;
        const up = y === 0 ? 0 : src[i - w], dn = y === h - 1 ? 0 : src[i + w];
        if (p[1] && (up === 0 || edge(up) && up !== src[i])) px[i] = p[1];
        else if (p[2] && (dn === 0 || edge(dn) && dn !== src[i])) px[i] = p[2];
      }
    }
  }

  /** To a canvas, through a palette (index 0 is transparent; colours pass through col()). */
  canvas(pal: readonly string[]): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d')!;
    const img = g.createImageData(this.w, this.h);
    const rgbs = pal.map((h) => (h ? hexToRgb(col(h)) : null));
    for (let i = 0; i < this.px.length; i++) {
      const v = this.px[i];
      if (!v) continue;
      const p = rgbs[v];
      if (!p) continue;
      img.data[i * 4] = p[0]; img.data[i * 4 + 1] = p[1]; img.data[i * 4 + 2] = p[2]; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cache = new Map<string, HTMLCanvasElement>();
let cacheGen = -1;

/** A sprite, drawn once per name (and per display mode) and kept. */
export function sprite(key: string, w: number, h: number, draw: (p: Pix) => void, pal: readonly string[]): HTMLCanvasElement {
  if (cacheGen !== colorGeneration()) { cache.clear(); cacheGen = colorGeneration(); }
  let c = cache.get(key);
  if (!c) {
    const p = new Pix(w, h);
    draw(p);
    c = p.canvas(pal);
    cache.set(key, c);
    if (cache.size > 4000) cache.delete(cache.keys().next().value as string);
  }
  return c;
}

export function clearSprites() {
  cache.clear();
}

/** The same palette with every colour replaced by one — for a thing seen as a silhouette. */
export function solidPal(pal: readonly string[], c: string): string[] {
  return pal.map((p, i) => (i && p ? c : ''));
}

/** Draws a sprite with its anchor (ax, ay) at (x, y), whole pixels, mirrored if asked. */
export function blit(g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number },
  x: number, y: number, ax = 0, ay = 0, flip = false) {
  const X = Math.round(x), Y = Math.round(y);
  if (!flip) { g.drawImage(img, X - ax, Y - ay); return; }
  // Mirrored about the anchor: column ax lands on X, column ax+1 on X−1.
  g.save();
  g.translate(X + 1, Y);
  g.scale(-1, 1);
  g.drawImage(img, -ax, -ay);
  g.restore();
}
