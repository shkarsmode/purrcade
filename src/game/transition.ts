/**
 * Between one scene and the next: never a cut. An iris closing to a point and opening on the new
 * place, a dissolve in dithered squares, or blinds — the screen is never left black for more than
 * a moment, since a black screen is when a cat walks away.
 */
import { col } from '../core/color';
import { bayer } from './art';

export type TransitionKind = 'iris' | 'dissolve' | 'blinds';

export class Transition {
  kind: TransitionKind;
  /** 0 → fully showing the scene, 1 → fully covered. */
  cover = 0;
  private dir = 0;
  private cb: (() => void) | null = null;
  private dur: number;

  constructor(kind: TransitionKind = 'iris', dur = 0.7) {
    this.kind = kind;
    this.dur = dur;
  }

  get busy() { return this.dir !== 0; }

  /** Cover the screen, call `midway` while it is covered, then uncover it. */
  run(midway: () => void, kind?: TransitionKind) {
    if (kind) this.kind = kind;
    this.cb = midway;
    this.dir = 1;
  }

  update(dt: number) {
    if (!this.dir) return;
    this.cover += (this.dir * dt) / this.dur;
    if (this.dir > 0 && this.cover >= 1) {
      this.cover = 1;
      const cb = this.cb; this.cb = null;
      if (cb) cb();
      this.dir = -1;
    } else if (this.dir < 0 && this.cover <= 0) {
      this.cover = 0;
      this.dir = 0;
    }
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, cx = W / 2, cy = H / 2) {
    const k = this.cover;
    if (k <= 0) return;
    const c = col('#120d1c');
    g.fillStyle = c;
    if (this.kind === 'iris') {
      const R = Math.hypot(W, H) * 0.6 * (1 - k * k * (3 - 2 * k));
      if (R <= 0.5) { g.fillRect(0, 0, W, H); return; }
      for (let y = 0; y < H; y++) {
        const dy = y - cy;
        if (Math.abs(dy) >= R) { g.fillRect(0, y, W, 1); continue; }
        const hw = Math.sqrt(R * R - dy * dy);
        g.fillRect(0, y, Math.max(0, Math.round(cx - hw)), 1);
        g.fillRect(Math.round(cx + hw), y, W, 1);
      }
      // A rim of light just inside the iris.
      g.fillStyle = col('#ffe7a8');
      for (let a = 0; a < Math.PI * 2; a += 1.5 / Math.max(10, R)) g.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 1, 1);
    } else if (this.kind === 'dissolve') {
      const S = 4;
      for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) if (bayer(x / S, y / S) < k) g.fillRect(x, y, S, S);
    } else {
      const band = 12;
      for (let y = 0; y < H; y += band) g.fillRect(0, y, W, Math.ceil(band * k));
    }
  }
}
