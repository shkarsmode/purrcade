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
/** Now and then something goes across the sky: geese, a plane, a balloon — and, rarely, not a plane. */
interface Passer { kind: 'geese' | 'plane' | 'balloon' | 'ufo'; x: number; y: number; v: number; t: number; n: number; c: string }

export class Sky {
  private still: HTMLCanvasElement;
  private clouds: Drifter[] = [];
  private stars: { x: number; y: number; p: number; b: number }[] = [];
  private falling: Falling[] = [];
  private nextFall: number;
  private passers: Passer[] = [];
  private nextPass: number;

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
    this.nextPass = rng.range(12, 40);
  }

  private disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string, rimC: string) {
    g.fillStyle = col(rimC);
    for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - hw, cy + y, hw * 2, 1); }
    g.fillStyle = col(c);
    const r2 = r - 1;
    for (let y = -r2; y <= r2; y++) { const hw = Math.round(Math.sqrt(r2 * r2 - y * y)); g.fillRect(cx - hw, cy + y - 1, hw * 2, 1); }
  }

  update(dt: number) {
    this.nextPass -= dt;
    if (this.nextPass <= 0) {
      this.nextPass = this.rng.range(45, 110);
      const h = this.bottom - this.top;
      const dir = this.rng.sign();
      const night = this.tod === 'night';
      const kind: Passer['kind'] = night ? (this.rng.chance(0.25) ? 'ufo' : 'plane') : this.rng.weighted(['geese', 'plane', 'balloon'] as const, (k) => ({ geese: 3, plane: 2, balloon: 1 }[k]));
      const v = { geese: 16, plane: 22, balloon: 4, ufo: 30 }[kind] * dir;
      this.passers.push({ kind, x: dir > 0 ? -40 : this.W + 40, y: this.rng.range(h * 0.12, h * (kind === 'balloon' ? 0.45 : 0.4)), v, t: 0, n: this.rng.int(5, 9), c: this.rng.pick(['#e8544a', '#f4c430', '#5c9ed6', '#8cc084']) });
    }
    for (const p of this.passers) { p.t += dt; p.x += p.v * dt; if (p.kind === 'ufo') p.y += Math.sin(p.t * 1.7) * 6 * dt; }
    this.passers = this.passers.filter((p) => p.x > -80 && p.x < this.W + 80);
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

  private drawPassers(g: CanvasRenderingContext2D) {
    for (const p of this.passers) {
      const X = Math.round(p.x), Y = Math.round(this.top + p.y), d = Math.sign(p.v);
      if (p.kind === 'geese') {
        // A V: each bird a flapping tick, trailing back from the leader.
        g.fillStyle = col('#2a2436');
        for (let i = 0; i < p.n; i++) {
          const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
          const bx = X - d * k * 6, by = Y + side * k * 3;
          const up = Math.sin(p.t * 7 + i) > 0;
          g.fillRect(bx - 1, by - (up ? 1 : 0), 1, 1); g.fillRect(bx, by, 1, 1); g.fillRect(bx + 1, by - (up ? 1 : 0), 1, 1);
        }
      } else if (p.kind === 'plane') {
        g.fillStyle = col('#ffffff');
        g.globalAlpha = 0.55;
        for (let i = 4; i < 60; i++) { if (i % 9 < 7) g.fillRect(X - d * i, Y, 1, 1); }
        g.globalAlpha = 1;
        g.fillStyle = col(this.tod === 'night' ? '#8a90a8' : '#e8ecf4');
        g.fillRect(X - 2, Y, 5, 1); g.fillRect(X - d, Y - 1, 1, 1); g.fillRect(X, Y + 1, 1, 1);
        if (this.tod === 'night' && Math.floor(p.t * 2) % 2) { g.fillStyle = col('#ff4a4a'); g.fillRect(X - d * 2, Y, 1, 1); }
      } else if (p.kind === 'balloon') {
        for (let yy = -6; yy <= 5; yy++) {
          const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((yy + 0.5) / 6.5) ** 2)) * 5);
          for (let xx = -hw; xx <= hw; xx++) { g.fillStyle = col((xx + 20) % 4 < 2 ? p.c : '#fbf6ee'); g.fillRect(X + xx, Y + yy, 1, 1); }
        }
        g.fillStyle = col('#6a4a2a'); g.fillRect(X - 1, Y + 9, 3, 2);
        g.fillStyle = col('#3a2a20'); g.fillRect(X - 2, Y + 6, 1, 3); g.fillRect(X + 2, Y + 6, 1, 3);
      } else {
        // Well, it is not a plane.
        g.fillStyle = col('#9aa4b8'); g.fillRect(X - 6, Y, 13, 2); g.fillRect(X - 4, Y - 1, 9, 1);
        g.fillStyle = col('#bff0ff'); g.fillRect(X - 2, Y - 3, 5, 2);
        const on = Math.floor(p.t * 6) % 3;
        for (let i = 0; i < 3; i++) { g.fillStyle = col(i === on ? '#ffe066' : '#5a6478'); g.fillRect(X - 4 + i * 4, Y + 1, 1, 1); }
        if (Math.floor(p.t / 3) % 2 === 1) {
          g.globalAlpha = 0.18; g.fillStyle = col('#bff0ff');
          for (let yy = 3; yy < 40; yy++) { const w = Math.round(2 + yy * 0.25); g.fillRect(X - w, Y + yy, w * 2 + 1, 1); }
          g.globalAlpha = 1;
        }
      }
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    g.drawImage(this.still, 0, this.top);
    for (const s of this.stars) {
      const tw = (Math.sin(t * (1.5 + s.b * 2) + s.p) + 1) / 2;
      if (tw < 0.25) continue;
      px(g, s.x, this.top + s.y, tw > 0.85 && s.b > 0.7 ? '#ffffff' : s.b > 0.5 ? '#c9d6ff' : '#8c9bd0');
    }
    this.drawPassers(g);
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
