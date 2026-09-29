/**
 * Weather over a scene: rain with splashes where it lands, snow drifting on the wind, autumn
 * leaves tumbling, petals, and indoors the dust that hangs in a sunbeam. It all falls toward the
 * location's floor and knows nothing of the critters — it is the air between them and the cat.
 */
import { col } from '../core/color';
import type { Rng } from '../core/rng';
import type { Weather } from './types';

interface Flake { x: number; y: number; vx: number; vy: number; s: number; p: number; c: string; life?: number }

export class WeatherFx {
  private list: Flake[] = [];
  private splashes: { x: number; y: number; t: number }[] = [];
  private wind = 0;
  private gust = 0;

  constructor(private kind: Weather, private W: number, private H: number, private floor: number, private rng: Rng, private strength = 1) {
    const n = this.target();
    for (let i = 0; i < n; i++) this.list.push(this.spawn(true));
  }

  private target(): number {
    const area = (this.W * this.H) / (480 * 270);
    const base = { clear: 0, rain: 140, snow: 90, leaves: 22, motes: 40, petals: 26 }[this.kind];
    return Math.round(base * area * this.strength);
  }

  private spawn(anywhere: boolean): Flake {
    const r = this.rng;
    const x = r.range(-20, this.W + 20), y = anywhere ? r.range(-10, this.floor) : r.range(-30, -4);
    switch (this.kind) {
      case 'rain': return { x, y, vx: -30, vy: r.range(220, 300), s: r.int(3, 5), p: 0, c: r.chance(0.5) ? '#9fb8e0' : '#c9d8f0' };
      case 'snow': return { x, y, vx: 0, vy: r.range(10, 26), s: r.chance(0.3) ? 2 : 1, p: r.range(0, 6), c: r.chance(0.2) ? '#dbe8ff' : '#ffffff' };
      case 'leaves': return { x, y, vx: r.range(-10, 10), vy: r.range(18, 34), s: 1, p: r.range(0, 6), c: r.pick(['#e8743b', '#f2b134', '#c9412f', '#b8732e']) };
      case 'petals': return { x, y, vx: r.range(-6, 6), vy: r.range(12, 22), s: 1, p: r.range(0, 6), c: r.pick(['#f7b8cc', '#ffd6e2', '#f49ab8']) };
      case 'motes': return { x: r.range(0, this.W), y: r.range(0, this.floor), vx: r.range(-3, 3), vy: r.range(-3, 3), s: 1, p: r.range(0, 6), c: '#fff4c8', life: r.range(0, 20) };
      default: return { x, y, vx: 0, vy: 0, s: 1, p: 0, c: '#ffffff' };
    }
  }

  update(dt: number, t: number) {
    if (this.kind === 'clear') return;
    this.gust -= dt;
    if (this.gust <= 0) { this.gust = this.rng.range(3, 9); this.wind = this.rng.range(-1, 1); }
    for (let i = 0; i < this.list.length; i++) {
      const f = this.list[i];
      switch (this.kind) {
        case 'rain':
          f.x += (f.vx + this.wind * 20) * dt; f.y += f.vy * dt;
          if (f.y >= this.floor - this.rng.range(0, 30)) {
            if (this.rng.chance(0.4)) this.splashes.push({ x: f.x, y: f.y, t: 0 });
            this.list[i] = this.spawn(false);
          }
          break;
        case 'snow':
        case 'petals':
          f.x += (Math.sin(t * 1.3 + f.p) * 8 + this.wind * 14) * dt; f.y += f.vy * dt;
          if (f.y > this.floor + 4) this.list[i] = this.spawn(false);
          break;
        case 'leaves':
          f.p += dt * (2 + Math.abs(this.wind) * 3);
          f.x += (Math.sin(f.p) * 22 + this.wind * 30) * dt; f.y += (f.vy + Math.cos(f.p * 2) * 12) * dt;
          if (f.y > this.floor + 6) this.list[i] = this.spawn(false);
          break;
        case 'motes':
          f.life = (f.life || 0) + dt;
          f.x += (f.vx + Math.sin(t * 0.3 + f.p) * 2) * dt; f.y += (f.vy + Math.cos(t * 0.27 + f.p) * 2) * dt;
          if (f.life > 25 || f.x < -5 || f.x > this.W + 5 || f.y < -5 || f.y > this.floor) this.list[i] = this.spawn(true);
          break;
      }
      if (f.x < -30) f.x += this.W + 50; else if (f.x > this.W + 30) f.x -= this.W + 50;
    }
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter((s) => s.t < 0.25);
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    if (this.kind === 'clear') return;
    for (const f of this.list) {
      const X = Math.round(f.x), Y = Math.round(f.y);
      if (this.kind === 'rain') {
        g.fillStyle = col(f.c);
        g.globalAlpha = 0.75;
        for (let k = 0; k < f.s; k++) g.fillRect(X + Math.round(k * 0.15), Y - k, 1, 1);
        g.globalAlpha = 1;
      } else if (this.kind === 'motes') {
        const tw = (Math.sin(t * 2 + f.p * 3) + 1) / 2;
        const life = f.life || 0;
        g.globalAlpha = Math.min(1, life / 3, (25 - life) / 3) * (0.25 + tw * 0.5);
        g.fillStyle = col(f.c);
        g.fillRect(X, Y, 1, 1);
        g.globalAlpha = 1;
      } else if (this.kind === 'leaves' || this.kind === 'petals') {
        g.fillStyle = col(f.c);
        const flip = Math.sin(f.p) > 0;
        if (this.kind === 'leaves') {
          if (flip) { g.fillRect(X - 1, Y, 3, 1); g.fillRect(X, Y - 1, 2, 1); } else { g.fillRect(X, Y - 1, 1, 3); g.fillRect(X + 1, Y, 1, 1); }
        } else {
          g.fillRect(X, Y, flip ? 2 : 1, 1);
        }
      } else {
        g.fillStyle = col(f.c);
        g.fillRect(X, Y, f.s, f.s);
      }
    }
    if (this.splashes.length) {
      g.fillStyle = col('#c9d8f0');
      for (const s of this.splashes) {
        const r = Math.round(1 + s.t * 10);
        g.fillRect(Math.round(s.x - r), Math.round(s.y), 1, 1);
        g.fillRect(Math.round(s.x + r), Math.round(s.y), 1, 1);
        if (s.t < 0.1) g.fillRect(Math.round(s.x), Math.round(s.y - 2), 1, 1);
      }
    }
  }
}
