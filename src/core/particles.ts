/**
 * Small bits of life: dust kicked up, a sparkle when something is caught, splashes, a feather
 * drifting down, a puff of sand. Pixel-sized and short-lived — a few hundred at most — and drawn
 * as squares of their own colour, so they sit in the same world as everything else.
 */
import { col } from './color';
import type { Rng } from './rng';

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  c: string; c2?: string;
  size: number;
  g: number;          // gravity
  drag: number;
  kind: 'dot' | 'spark' | 'ring' | 'star' | 'heart' | 'text' | 'streak' | 'leaf' | 'feather';
  text?: string;
  spin?: number; a?: number;
  glow?: boolean;
}

export class Particles {
  list: Particle[] = [];
  constructor(private rng: Rng) {}

  add(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length > 900) this.list.shift();
    this.list.push({ vx: 0, vy: 0, life: 0, max: 1, c: '#ffffff', size: 1, g: 0, drag: 0, kind: 'dot', ...p } as Particle);
  }

  /** A burst of dots. */
  burst(x: number, y: number, n: number, colors: string[], o: { speed?: number; up?: number; g?: number; max?: number; size?: number; spread?: number } = {}) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r.range(-Math.PI, Math.PI) * (o.spread ?? 1) - (o.spread != null ? Math.PI / 2 : 0);
      const s = r.range(0.4, 1) * (o.speed ?? 40);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up ?? 0), g: o.g ?? 60, drag: 1.5,
        max: r.range(0.4, 1) * (o.max ?? 0.8), c: r.pick(colors), size: o.size ?? 1 });
    }
  }

  /** The celebration when a paw lands on something: a ring, stars, sparkles. */
  catch(x: number, y: number, tint = '#ffe066') {
    this.add({ x, y, kind: 'ring', max: 0.45, c: '#ffffff', size: 3 });
    const r = this.rng;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r.range(-0.2, 0.2);
      const s = r.range(40, 75);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, drag: 3.2, max: r.range(0.45, 0.7),
        c: i % 3 ? tint : '#ffffff', kind: i % 2 ? 'star' : 'spark', size: 1 });
    }
  }

  pawPrint(x: number, y: number) {
    this.add({ x, y, kind: 'ring', max: 0.35, c: '#ffffff', size: 2 });
  }

  text(x: number, y: number, text: string, c = '#ffffff') {
    this.add({ x, y, vy: -18, drag: 1.2, kind: 'text', text, max: 1.1, c });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life += dt;
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.spin) p.a = (p.a || 0) + p.spin * dt;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }

  draw(g: CanvasRenderingContext2D, font?: (g: CanvasRenderingContext2D, s: string, x: number, y: number, c: string) => void) {
    for (const p of this.list) {
      const k = p.life / p.max;
      const a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
      g.globalAlpha = Math.max(0, Math.min(1, a));
      const X = Math.round(p.x), Y = Math.round(p.y);
      const c = col(p.c);
      if (p.glow) g.globalCompositeOperation = 'lighter';
      switch (p.kind) {
        case 'ring': {
          const r = Math.round(2 + k * 9 * (p.size / 2));
          g.fillStyle = c;
          for (let i = 0; i < 16; i++) {
            const t = (i / 16) * Math.PI * 2;
            g.fillRect(Math.round(X + Math.cos(t) * r), Math.round(Y + Math.sin(t) * r * 0.8), 1, 1);
          }
          break;
        }
        case 'star':
          g.fillStyle = c;
          g.fillRect(X, Y - 1, 1, 3); g.fillRect(X - 1, Y, 3, 1);
          break;
        case 'spark':
          g.fillStyle = c;
          g.fillRect(X, Y, 1, 1);
          if (k < 0.5) { g.fillRect(X - 1, Y, 1, 1); g.fillRect(X + 1, Y, 1, 1); }
          break;
        case 'heart':
          g.fillStyle = c;
          g.fillRect(X - 2, Y - 1, 2, 2); g.fillRect(X + 1, Y - 1, 2, 2); g.fillRect(X - 1, Y, 3, 2); g.fillRect(X, Y + 2, 1, 1);
          break;
        case 'streak':
          g.fillStyle = c;
          g.fillRect(X, Y, 1, Math.max(1, Math.round(p.size)));
          break;
        case 'leaf': {
          g.fillStyle = c;
          const s = Math.sin(p.a || 0) > 0;
          if (s) { g.fillRect(X - 1, Y, 3, 1); g.fillRect(X, Y - 1, 1, 1); } else { g.fillRect(X, Y - 1, 1, 3); g.fillRect(X + 1, Y, 1, 1); }
          break;
        }
        case 'feather':
          g.fillStyle = c;
          g.fillRect(X - 1, Y, 3, 1);
          g.fillStyle = col(p.c2 || p.c);
          g.fillRect(X, Y - 1, 1, 1);
          break;
        case 'text':
          if (font) font(g, p.text || '', X, Y, p.c);
          break;
        default:
          g.fillStyle = c;
          g.fillRect(X, Y, p.size, p.size);
      }
      if (p.glow) g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }
}
