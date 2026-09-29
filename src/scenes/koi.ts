/**
 * Koi, seen from above. Each fish is a spine of points that follows its head, so the body bends
 * as it turns and the tail sweeps; it is drawn fresh each frame as a chain of discs — outline
 * first, then the body, then the patches that make a kohaku or a showa or an ogon. Fish cruise,
 * turn lazily, sink and rise; they slip under the lily pads; a tap on the water sends a ring out
 * and the nearest ones bolting; now and then food lands and they crowd to it.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { col, mix } from '../core/color';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { dist } from './util';
import { drawPad, padAt, type PondInstance } from '../world/water';

interface Patch { seg: number; side: number; r: number; c: string }
interface Look { name: string; base: string; fin: string; patches: Patch[]; dots?: string }

const N = 12;
const PROFILE = [0.62, 0.86, 0.98, 1, 0.97, 0.9, 0.8, 0.68, 0.55, 0.42, 0.32, 0.25];

function looks(rng: SceneCtx['rng']): Look {
  const red = '#e8442e', white = '#fbf6ee', black = '#1c1a22', gold = '#f5b82e', orange = '#f07a2a';
  const p = (seg: number, side: number, r: number, c: string): Patch => ({ seg, side, r, c });
  const kinds: Look[] = [
    { name: 'kohaku', base: white, fin: '#fff4ee', patches: [p(1, 0, 0.8, red), p(2, 0.2, 0.7, red), p(5, -0.3, 0.75, red), p(6, 0, 0.7, red), p(8, 0.3, 0.55, red)] },
    { name: 'tancho', base: white, fin: '#ffffff', patches: [p(1, 0, 0.62, red)] },
    { name: 'showa', base: black, fin: '#3a3440', patches: [p(1, 0.2, 0.8, red), p(3, -0.3, 0.8, white), p(4, 0.3, 0.7, red), p(6, -0.2, 0.7, white), p(7, 0.1, 0.6, red)] },
    { name: 'sanke', base: white, fin: '#fff4ee', patches: [p(1, 0, 0.75, red), p(4, 0.2, 0.8, red), p(5, -0.4, 0.4, black), p(7, 0.35, 0.35, black), p(8, -0.1, 0.5, red)] },
    { name: 'ogon', base: gold, fin: '#ffe08a', patches: [p(2, 0, 0.5, '#ffe08a'), p(5, 0, 0.45, '#ffe08a')] },
    { name: 'kigoi', base: orange, fin: '#ffb070', patches: [p(3, 0, 0.4, '#ffa050')] },
    { name: 'asagi', base: '#7a92b0', fin: '#a8c0d8', patches: [p(0, 0, 0.7, '#dfe6ee'), p(9, 0, 0.8, red), p(10, 0, 0.8, red)], dots: '#5a6f8c' },
    { name: 'chagoi', base: '#a8743e', fin: '#c89a60', patches: [], dots: '#8a5a2a' },
  ];
  return rng.weighted(kinds, (k) => ({ kohaku: 3, tancho: 1, showa: 2, sanke: 2, ogon: 2, kigoi: 1.5, asagi: 1, chagoi: 1 }[k.name] || 1));
}

type St = 'cruise' | 'dart' | 'feed' | 'dive';

interface Koi {
  pts: [number, number][];
  a: number;              // heading
  v: number; want: number;
  len: number; w: number;
  look: Look;
  depth: number; wantDepth: number;
  st: St; t: number;
  wig: number;
  seed: number;
  gulp: number;
  target: Pellet | null;
}
interface Pellet { x: number; y: number; t: number; eaten: boolean }
interface Fly { x: number; y: number; vx: number; vy: number; land: number; pad: number; t: number; st: 'fly' | 'rest' | 'off' }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, fx, sfx, opts, W, H } = ctx;
  const pond = ctx.loc as PondInstance;
  const pads = pond.pads || [];
  const deep = pond.deep || (() => 1);
  const n = Math.round(clamp(4 + opts.density * 3, 3, 10));
  const fish: Koi[] = [];
  const pellets: Pellet[] = [];
  let nextFood = rng.range(10, 20);
  let fly: Fly | null = null;
  let nextFly = rng.range(8, 20);
  let time = 0;

  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    for (let k = 0; k < 30; k++) { x = rng.range(W * 0.2, W * 0.8); y = rng.range(H * 0.2, H * 0.8); if (deep(x, y) > 0.2) break; }
    const len = rng.range(34, 50);
    const a = rng.range(0, Math.PI * 2);
    const seg = len / (N - 1);
    const pts: [number, number][] = [];
    for (let j = 0; j < N; j++) pts.push([x - Math.cos(a) * seg * j, y - Math.sin(a) * seg * j]);
    fish.push({ pts, a, v: 0, want: rng.range(10, 22), len, w: len * 0.13, look: looks(rng), depth: rng.range(0, 0.6), wantDepth: rng.range(0, 0.6), st: 'cruise', t: rng.range(2, 6), wig: rng.range(0, 6), seed: rng.range(0, 100), gulp: 0, target: null });
  }

  function steerTo(f: Koi, x: number, y: number, rate: number, dt: number) {
    const want = Math.atan2(y - f.pts[0][1], x - f.pts[0][0]);
    let d = want - f.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    f.a += clamp(d, -rate * dt, rate * dt);
  }

  function update(dt: number) {
    time += dt;
    nextFood -= dt;
    if (nextFood <= 0) {
      nextFood = rng.range(18, 34);
      const cx = rng.range(W * 0.25, W * 0.75), cy = rng.range(H * 0.25, H * 0.75);
      for (let i = 0; i < rng.int(5, 9); i++) {
        const p = { x: cx + rng.range(-18, 18), y: cy + rng.range(-12, 12), t: 0, eaten: false };
        pellets.push(p);
        fx.add({ x: p.x, y: p.y, kind: 'ring', max: 0.5, c: '#d8f4ff', size: 1 });
      }
      sfx.plop();
    }
    for (const p of pellets) p.t += dt;
    for (let i = pellets.length - 1; i >= 0; i--) if (pellets[i].eaten || pellets[i].t > 40) pellets.splice(i, 1);
    for (const f of fish) step(f, dt);
    // A dragonfly now and then, down onto a pad and off again.
    nextFly -= dt;
    if (!fly && nextFly <= 0 && pads.length) {
      const pi = rng.int(0, pads.length - 1);
      const side = rng.sign();
      fly = { x: side < 0 ? -10 : W + 10, y: rng.range(10, H * 0.5), vx: 0, vy: 0, land: 0, pad: pi, t: 0, st: 'fly' };
    }
    if (fly) stepFly(fly, dt);
  }

  function stepFly(d: Fly, dt: number) {
    d.t += dt;
    if (d.st === 'fly') {
      const [px, py] = padAt(pads[d.pad], time);
      const dx = px - d.x, dy = py - 2 - d.y, dd = Math.hypot(dx, dy);
      // Darting flight: fast straight runs with sudden hovers.
      const hover = Math.sin(d.t * 3) > 0.6;
      const s = hover ? 10 : 140;
      if (dd > 2) { d.x += (dx / dd) * s * dt + Math.sin(d.t * 17) * 0.4; d.y += (dy / dd) * s * dt; }
      else { d.st = 'rest'; d.land = rng.range(4, 10); }
    } else if (d.st === 'rest') {
      const [px, py] = padAt(pads[d.pad], time);
      d.x = px; d.y = py - 2;
      d.land -= dt;
      if (d.land <= 0) { d.st = 'off'; d.vx = rng.sign() * 150; d.vy = -rng.range(40, 80); }
    } else {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x < -20 || d.x > W + 20 || d.y < -20) { fly = null; nextFly = rng.range(15, 35); }
    }
  }

  function step(f: Koi, dt: number) {
    const head = f.pts[0];
    f.t -= dt;
    // Where to go.
    if (f.st === 'cruise') {
      f.a += noise1(time * 0.25, f.seed) * 0.9 * dt;
      if (f.t <= 0) { f.want = rng.range(8, 24) * opts.speed; f.t = rng.range(2, 7); f.wantDepth = rng.range(0, 0.7); if (rng.chance(0.15)) { f.st = 'dart'; f.t = rng.range(0.5, 1); f.want = rng.range(55, 80) * opts.speed; } }
      const food = pellets.filter((p) => !p.eaten);
      if (food.length && rng.chance(dt * 0.8)) {
        let best: Pellet | null = null, bd = Infinity;
        for (const p of food) { const d = dist(p.x, p.y, head[0], head[1]); if (d < bd) { bd = d; best = p; } }
        if (best && bd < 220) { f.st = 'feed'; f.target = best; f.t = 12; }
      }
    } else if (f.st === 'dart') {
      if (f.t <= 0) { f.st = 'cruise'; f.t = rng.range(2, 5); f.want = rng.range(10, 20) * opts.speed; }
    } else if (f.st === 'feed') {
      const p = f.target;
      if (!p || p.eaten || f.t <= 0) { f.st = 'cruise'; f.target = null; f.t = rng.range(1, 3); }
      else {
        steerTo(f, p.x, p.y, 2.6, dt);
        f.want = 26 * opts.speed;
        f.wantDepth = 0;
        if (dist(p.x, p.y, head[0], head[1]) < 5) {
          p.eaten = true; f.gulp = 0.3; f.target = null; f.st = 'cruise'; f.t = rng.range(1, 3);
          fx.add({ x: p.x, y: p.y, kind: 'ring', max: 0.4, c: '#ffffff', size: 1 });
          sfx.plop();
        }
      }
    } else if (f.st === 'dive') {
      f.wantDepth = 1;
      if (f.t <= 0) { f.st = 'cruise'; f.t = rng.range(2, 5); f.want = 14; }
    }
    // Stay off the stones: turn toward the middle when the water gets shallow ahead.
    const ax = head[0] + Math.cos(f.a) * 20, ay = head[1] + Math.sin(f.a) * 20;
    if (deep(ax, ay) < 0.1) steerTo(f, W / 2 + noise1(time * 0.1, f.seed) * 60, H / 2, 2.4, dt);
    // Keep apart.
    for (const o of fish) {
      if (o === f) continue;
      const d = dist(o.pts[0][0], o.pts[0][1], head[0], head[1]);
      if (d < 16 && Math.abs(o.depth - f.depth) < 0.4) f.a += (Math.sign(Math.sin(Math.atan2(o.pts[0][1] - head[1], o.pts[0][0] - head[0]) - f.a)) || 1) * -1.4 * dt;
    }
    f.v += (f.want - f.v) * Math.min(1, dt * (f.st === 'dart' ? 6 : 1.2));
    f.depth += (f.wantDepth - f.depth) * Math.min(1, dt * 0.5);
    f.wig += dt * (3 + f.v * 0.18);
    if (f.gulp > 0) f.gulp -= dt;
    // Move the head, sway it a little, and let the spine follow.
    const sway = Math.sin(f.wig) * (0.25 + f.v * 0.012);
    head[0] += Math.cos(f.a) * f.v * dt + Math.cos(f.a + Math.PI / 2) * sway * dt * 10;
    head[1] += Math.sin(f.a) * f.v * dt + Math.sin(f.a + Math.PI / 2) * sway * dt * 10;
    const seg = f.len / (N - 1);
    for (let i = 1; i < N; i++) {
      const [px, py] = f.pts[i - 1];
      const p = f.pts[i];
      const dx = p[0] - px, dy = p[1] - py, d = Math.hypot(dx, dy) || 1;
      p[0] = px + (dx / d) * seg; p[1] = py + (dy / d) * seg;
    }
  }

  function paw(x: number, y: number) {
    fx.add({ x, y, kind: 'ring', max: 0.7, c: '#e8fbff', size: 4 });
    fx.add({ x, y, kind: 'ring', max: 0.45, c: '#ffffff', size: 2 });
    fx.burst(x, y, 6, ['#ffffff', '#bfe6ff', '#8fd0ff'], { speed: 40, g: 0, max: 0.4 });
    sfx.plop();
    for (const f of fish) {
      let near = Infinity;
      for (let i = 0; i < 6; i++) near = Math.min(near, dist(x, y, f.pts[i][0], f.pts[i][1]));
      if (near < (f.w + 6) * opts.reach && f.depth < 0.6) {
        ctx.caught('fish', x, y, '#ffe08a');
        f.st = 'dive'; f.t = rng.range(3, 5);
        f.a = Math.atan2(f.pts[0][1] - y, f.pts[0][0] - x); f.v = 90 * opts.speed; f.want = 30;
      } else if (near < 70) {
        f.st = 'dart'; f.t = rng.range(0.6, 1.1);
        f.a = Math.atan2(f.pts[0][1] - y, f.pts[0][0] - x) + rng.range(-0.4, 0.4);
        f.want = rng.range(70, 100) * opts.speed; f.v = f.want * 0.7;
      }
    }
    if (fly && fly.st !== 'off' && dist(x, y, fly.x, fly.y) < 40) {
      if (dist(x, y, fly.x, fly.y) < 10 * opts.reach) ctx.caught('bug', fly.x, fly.y, '#9fe0ff');
      fly.st = 'off'; fly.vx = (fly.x < x ? -1 : 1) * 170; fly.vy = -90;
    }
  }

  // --- drawing ---------------------------------------------------------------------------

  function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const R = Math.max(0.5, r);
    for (let yy = -Math.ceil(R); yy <= Math.ceil(R); yy++) {
      const hw = Math.sqrt(Math.max(0, R * R - yy * yy));
      if (hw <= 0.2) continue;
      g.fillRect(Math.round(x - hw), Math.round(y + yy), Math.max(1, Math.round(hw * 2)), 1);
    }
  }

  function drawFish(g: CanvasRenderingContext2D, f: Koi) {
    const water = '#135064';
    const k = f.depth;
    const shade = (c: string) => col(mix(c, water, k * 0.55));
    const pts = f.pts;
    const w = f.w;
    // Shadow on the bottom when near the surface.
    if (k < 0.5) {
      g.globalAlpha = 0.18 * (1 - k * 2);
      g.fillStyle = '#000';
      for (let i = 1; i < N; i += 2) disc(g, pts[i][0] + 4, pts[i][1] + 5, w * PROFILE[i]);
      g.globalAlpha = 1;
    }
    // Fins: the tail fan and two pectoral fins, a little see-through.
    const tail = pts[N - 1], pre = pts[N - 3];
    const ta = Math.atan2(tail[1] - pre[1], tail[0] - pre[0]);
    const beat = Math.sin(f.wig) * 0.45;
    g.globalAlpha = 0.85;
    g.fillStyle = shade(f.look.fin);
    for (const s of [-1, 1]) {
      const a = ta + s * 0.5 + beat;
      for (let r = 1; r < w * 1.6; r += 0.7) disc(g, tail[0] + Math.cos(a) * r, tail[1] + Math.sin(a) * r, Math.max(0.6, 1.6 - r * 0.12));
    }
    const sh = pts[2], hh = pts[1];
    const ba = Math.atan2(hh[1] - sh[1], hh[0] - sh[0]);
    const flap = Math.sin(f.wig * 1.3) * 0.3;
    for (const s of [-1, 1]) {
      // Pectoral fins: short fans at the shoulders, sweeping back.
      const a = ba + Math.PI + s * (2.2 + flap);
      for (let r = w * 0.4; r < w * 1.25; r += 0.6) disc(g, sh[0] + Math.cos(a) * r, sh[1] + Math.sin(a) * r, 1.4 - (r / (w * 1.25)) * 0.6);
    }
    g.globalAlpha = 1;
    // Outline, then body.
    g.fillStyle = shade('#10222a');
    for (let i = N - 1; i >= 0; i--) disc(g, pts[i][0], pts[i][1], w * PROFILE[i] + 1);
    g.fillStyle = shade(f.look.base);
    for (let i = N - 1; i >= 0; i--) disc(g, pts[i][0], pts[i][1], w * PROFILE[i]);
    // Patches and scales.
    for (const p of f.look.patches) {
      const i = Math.min(N - 2, p.seg);
      const a = Math.atan2(pts[i][1] - pts[i + 1][1], pts[i][0] - pts[i + 1][0]) + Math.PI / 2;
      const off = p.side * w * PROFILE[i];
      g.fillStyle = shade(p.c);
      disc(g, pts[i][0] + Math.cos(a) * off, pts[i][1] + Math.sin(a) * off, w * PROFILE[i] * p.r);
    }
    if (f.look.dots) {
      g.fillStyle = shade(f.look.dots);
      for (let i = 2; i < N - 2; i++) if (i % 2 === 0) g.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]), 1, 1);
    }
    // A shine along the back, and the eyes.
    g.fillStyle = shade('#ffffff');
    g.globalAlpha = 0.5;
    for (let i = 1; i < 6; i++) g.fillRect(Math.round(pts[i][0] - 1), Math.round(pts[i][1] - 1), 1, 1);
    g.globalAlpha = 1;
    const h0 = pts[0], h1 = pts[1];
    const ha = Math.atan2(h0[1] - h1[1], h0[0] - h1[0]);
    g.fillStyle = shade('#1a1216');
    for (const s of [-1, 1]) g.fillRect(Math.round(h0[0] + Math.cos(ha + s * 1.1) * w * 0.55), Math.round(h0[1] + Math.sin(ha + s * 1.1) * w * 0.55), 1, 1);
    if (f.gulp > 0) { g.fillStyle = col('#3a1a1a'); g.fillRect(Math.round(h0[0] + Math.cos(ha) * w * 0.5), Math.round(h0[1] + Math.sin(ha) * w * 0.5), 2, 2); }
  }

  function drawDragonfly(g: CanvasRenderingContext2D, d: Fly) {
    const X = Math.round(d.x), Y = Math.round(d.y);
    const flap = d.st === 'rest' ? 0 : Math.floor(time * 30) % 2;
    // Wings: two pairs, glassy.
    g.globalAlpha = d.st === 'rest' ? 0.75 : 0.5;
    g.fillStyle = col('#d8f4ff');
    const s = flap ? 1 : 0;
    g.fillRect(X - 7, Y - 2 - s, 6, 2); g.fillRect(X + 2, Y - 2 - s, 6, 2);
    g.fillRect(X - 6, Y + 1 + s, 5, 2); g.fillRect(X + 2, Y + 1 + s, 5, 2);
    g.globalAlpha = 1;
    g.fillStyle = col('#1a1a2a');
    g.fillRect(X - 1, Y - 4, 3, 3);
    g.fillStyle = col('#3ab0d0');
    g.fillRect(X, Y - 2, 1, 11);
    g.fillStyle = col('#5fe0f0');
    g.fillRect(X, Y - 1, 1, 4);
    g.fillStyle = col('#7ad05a');
    g.fillRect(X - 1, Y - 4, 1, 1); g.fillRect(X + 1, Y - 4, 1, 1);
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    // Food on the water.
    for (const p of pellets) {
      if (p.eaten) continue;
      const bob = Math.sin(p.t * 3 + p.x) * 0.5;
      g.fillStyle = col('#8a5a2a'); g.fillRect(Math.round(p.x), Math.round(p.y + bob), 2, 2);
      g.fillStyle = col('#c98a4a'); g.fillRect(Math.round(p.x), Math.round(p.y + bob), 1, 1);
    }
    // Deep fish first, then the ones near the surface.
    const order = fish.slice().sort((a, b) => b.depth - a.depth);
    for (const f of order) drawFish(g, f);
    for (const p of pads) drawPad(g, p, t);
    if (fly) drawDragonfly(g, fly);
    // The sky on the water: a slow glint.
    g.globalAlpha = 0.08;
    g.fillStyle = col('#ffffff');
    const gx = (t * 6) % (W + 200) - 100;
    for (let i = 0; i < 40; i++) g.fillRect(Math.round(gx + i * 3), Math.round(H * 0.3 + i * 2), 22, 1);
    g.globalAlpha = 1;
  }

  return { update, draw, paw };
}

export const koi: SceneDef = {
  id: 'koi',
  name: { uk: 'Коропи кої', en: 'Koi pond' },
  about: {
    uk: 'Великі кої ліниво плавають, пірнають під латаття і збираються до корму. Торкнися води, і по ній кола, а риби врозтіч.',
    en: 'Big koi drift about, slip under lily pads and crowd to the food. Touch the water: ripples, and the fish scatter.',
  },
  energy: 0.35,
  locations: ['koi'],
  kind: 'fish',
  icon: 'fish',
  create,
};
