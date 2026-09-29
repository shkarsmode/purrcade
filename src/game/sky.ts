/**
 * Skies for the outdoor places: the gradient for the hour, the sun or the moon, stars that
 * twinkle, clouds that drift across at their own pace, and at night now and then a star that
 * falls. The still part is painted once per place and hour; only what moves is drawn each frame.
 */
import { layer } from '../core/screen';
import { col } from '../core/color';
import type { Rng } from '../core/rng';
import type { TimeOfDay } from './types';
import { bands, cloud, lightSprite, px } from './art';

export const SKY: Record<TimeOfDay, string[]> = {
  dawn: ['#34305e', '#8a4d86', '#e9788a', '#ffc38f'],
  day: ['#3a78d6', '#5fa3ee', '#9fd3f6', '#d9f1ff'],
  dusk: ['#221c47', '#5c3478', '#c2577a', '#f6a05a'],
  night: ['#05081a', '#0c1535', '#18264f', '#243866'],
};

const CLOUD: Record<TimeOfDay, [string, string, string]> = {
  dawn: ['#ffe0d0', '#f3a8a8', '#b5728f'],
  day: ['#ffffff', '#e8f3fb', '#b9cfe3'],
  dusk: ['#ffd0a0', '#e0857f', '#8a4a7a'],
  night: ['#3a4a78', '#2a375e', '#1c2646'],
};

interface Drifter { img: HTMLCanvasElement; x: number; y: number; v: number }
interface Falling { x: number; y: number; vx: number; vy: number; life: number }

export class Sky {
  private still: HTMLCanvasElement;
  private clouds: Drifter[] = [];
  private stars: { x: number; y: number; p: number; b: number }[] = [];
  private falling: Falling[] = [];
  private nextFall: number;

  constructor(private W: number, private top: number, private bottom: number, private tod: TimeOfDay, private rng: Rng) {
    const h = Math.max(1, bottom - top);
    const [cv, g] = layer(W, h);
    bands(g, 0, 0, W, h, SKY[tod], 5);
    // Sun, moon.
    if (tod === 'night') {
      const mx = Math.round(W * 0.78), my = Math.round(h * 0.28);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5;
      g.drawImage(lightSprite(26, '#6f86c9', 0.7), mx - 26, my - 26);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      this.disc(g, mx, my, 7, '#f4f1d8', '#d8d3b0');
      px(g, mx - 2, my - 1, '#c9c29a'); px(g, mx + 2, my + 2, '#c9c29a'); px(g, mx + 1, my - 3, '#d0c9a4');
    } else {
      const sx = tod === 'dawn' ? W * 0.18 : tod === 'dusk' ? W * 0.8 : W * 0.82;
      const sy = tod === 'day' ? h * 0.22 : h * 0.78;
      const sc = tod === 'day' ? '#fff3b0' : tod === 'dawn' ? '#ffe3a0' : '#ffb35c';
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.55;
      g.drawImage(lightSprite(34, tod === 'day' ? '#fff6c9' : '#ffb070', 0.8), Math.round(sx) - 34, Math.round(sy) - 34);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      this.disc(g, Math.round(sx), Math.round(sy), tod === 'day' ? 8 : 11, sc, tod === 'day' ? '#ffe680' : '#ff8f4a');
    }
    this.still = cv;
    // Stars, at night and in the last of the dawn.
    if (tod === 'night' || tod === 'dawn') {
      const n = Math.round((W * h) / (tod === 'night' ? 180 : 700));
      for (let i = 0; i < n; i++) this.stars.push({ x: rng.int(0, W - 1), y: rng.int(0, Math.round(h * (tod === 'night' ? 0.9 : 0.4))), p: rng.range(0, 6), b: rng.next() });
    }
    // Clouds.
    const nc = tod === 'night' ? 3 : rng.int(3, 6);
    for (let i = 0; i < nc; i++) {
      const w = rng.int(28, 70);
      const [ci, cg] = layer(w + 8, 22);
      cloud(cg, rng, 4, 16, w, ...CLOUD[tod]);
      this.clouds.push({ img: ci, x: rng.range(-w, W), y: rng.range(h * 0.05, h * 0.55), v: rng.range(1.5, 5) * (tod === 'night' ? 0.5 : 1) });
    }
    this.nextFall = rng.range(4, 14);
  }

  private disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string, rimC: string) {
    g.fillStyle = col(rimC);
    for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - hw, cy + y, hw * 2, 1); }
    g.fillStyle = col(c);
    const r2 = r - 1;
    for (let y = -r2; y <= r2; y++) { const hw = Math.round(Math.sqrt(r2 * r2 - y * y)); g.fillRect(cx - hw, cy + y - 1, hw * 2, 1); }
  }

  update(dt: number) {
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > this.W + 10) { c.x = -c.img.width - this.rng.range(0, 60); c.y = this.rng.range(0, (this.bottom - this.top) * 0.5); }
    }
    if (this.tod === 'night') {
      this.nextFall -= dt;
      if (this.nextFall <= 0) {
        this.nextFall = this.rng.range(6, 22);
        this.falling.push({ x: this.rng.range(this.W * 0.1, this.W * 0.9), y: this.rng.range(0, (this.bottom - this.top) * 0.3), vx: this.rng.sign() * this.rng.range(90, 140), vy: this.rng.range(40, 70), life: 0 });
      }
      for (const f of this.falling) { f.x += f.vx * dt; f.y += f.vy * dt; f.life += dt; }
      this.falling = this.falling.filter((f) => f.life < 0.9);
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    g.drawImage(this.still, 0, this.top);
    for (const s of this.stars) {
      const tw = (Math.sin(t * (1.5 + s.b * 2) + s.p) + 1) / 2;
      if (tw < 0.25) continue;
      px(g, s.x, this.top + s.y, tw > 0.85 && s.b > 0.7 ? '#ffffff' : s.b > 0.5 ? '#c9d6ff' : '#8c9bd0');
    }
    for (const c of this.clouds) g.drawImage(c.img, Math.round(c.x), Math.round(this.top + c.y));
    for (const f of this.falling) {
      const k = f.life / 0.9;
      for (let i = 0; i < 7; i++) {
        const x = f.x - (f.vx / 140) * i * 2, y = f.y - (f.vy / 140) * i * 2;
        g.globalAlpha = (1 - k) * (1 - i / 7);
        px(g, x, this.top + y, i < 2 ? '#ffffff' : '#bcd0ff');
      }
      g.globalAlpha = 1;
    }
  }
}
