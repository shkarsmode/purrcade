/**
 * What scenes share: drawing back to front with the room's furniture slotted in at its depth,
 * clipping to whole-pixel rows so nothing gets a soft edge, and the reach of a paw.
 */
import type { Prop } from '../game/types';

export interface Drawable { y: number; draw(): void }

/** Draw things back to front, with the location's props slotted in at their depth. */
export function depthDraw(g: CanvasRenderingContext2D, t: number, items: Drawable[], props?: Prop[]) {
  const all: Drawable[] = items.slice();
  if (props) for (const p of props) all.push({ y: p.y, draw: () => p.draw(g, t) });
  all.sort((a, b) => a.y - b.y);
  for (const d of all) d.draw();
}

/** Clip to a set of rows [y, x0, x1) — crisp, where an arc path would be anti-aliased. */
export function clipRows(g: CanvasRenderingContext2D, rows: [number, number, number][]) {
  g.beginPath();
  for (const [y, x0, x1] of rows) g.rect(x0, y, x1 - x0, 1);
  g.clip();
}

/** Clip to everything but one rectangle. */
export function clipOut(g: CanvasRenderingContext2D, W: number, H: number, x0: number, y0: number, x1: number, y1: number) {
  g.beginPath();
  g.rect(0, 0, W, y0);
  g.rect(0, y1, W, H - y1);
  g.rect(0, y0, x0, y1 - y0);
  g.rect(x1, y0, W - x1, y1 - y0);
  g.clip();
}

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export function nearest<T extends { x: number; y: number }>(list: readonly T[], x: number, y: number, ok: (t: T) => boolean = () => true): T | null {
  let best: T | null = null, bd = Infinity;
  for (const t of list) {
    if (!ok(t)) continue;
    const d = dist(t.x, t.y, x, y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** A tiny star, the kind that circles a head after a bump. */
export function tinyStar(g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  g.fillStyle = c;
  const X = Math.round(x), Y = Math.round(y);
  g.fillRect(X, Y - 1, 1, 3); g.fillRect(X - 1, Y, 3, 1);
}
