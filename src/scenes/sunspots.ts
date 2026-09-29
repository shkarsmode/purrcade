/**
 * Light that moves. By day, a sunny spot thrown by a mirror dances over the wall and the floor —
 * gliding, trembling, darting, stopping dead — with a small rainbow from a crystal in the window
 * drifting slowly beside it. At night a disco ball turns under the ceiling and a whole flock of
 * coloured spots sweeps round the room.
 */
import type { SceneDef, SceneCtx, SceneInstance, Light } from '../game/types';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { dist } from './util';

interface Spot { x: number; y: number; tx: number; ty: number; r: number; mode: 'glide' | 'hold' | 'dart' | 'tremble'; t: number; seed: number; hidden: number }
interface Disco { a: number; y: number; r: number; c: string; speed: number; hit: number }

const DISCO = ['#ffffff', '#ff9ad8', '#9ad8ff', '#fff09a', '#9affc8', '#ffb08a'];

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, opts, W, H, tod } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.66, H - 6];
  const top = Math.round(H * 0.08);
  const night = tod === 'night';
  let time = 0;
  const spots: Spot[] = [];
  const disco: Disco[] = [];
  const ballX = W * 0.5, ballY = Math.round(H * 0.16);
  const rainbow = { x: W * 0.3, y: H * 0.35, vx: 3 };

  if (night) {
    for (let i = 0; i < Math.round(24 + opts.density * 16); i++) disco.push({ a: rng.range(0, Math.PI * 2), y: rng.range(top + 10, band[1] - 4), r: rng.range(1.5, 3), c: rng.pick(DISCO), speed: rng.range(0.25, 0.4), hit: 0 });
  } else {
    for (let i = 0; i < (opts.intensity > 0.6 ? 2 : 1); i++) spots.push({ x: W * rng.range(0.3, 0.7), y: H * rng.range(0.3, 0.8), tx: 0, ty: 0, r: rng.range(10, 13), mode: 'hold', t: 1, seed: rng.range(0, 99), hidden: 0 });
  }

  const onFloor = (y: number) => y > band[0];

  function next(s: Spot) {
    const r = rng.next();
    if (r < 0.35) { s.mode = 'glide'; s.tx = rng.range(20, W - 20); s.ty = rng.range(top + 10, band[1] - 6); s.t = rng.range(1.5, 3); }
    else if (r < 0.6) { s.mode = 'dart'; s.tx = clamp(s.x + rng.range(-120, 120), 10, W - 10); s.ty = clamp(s.y + rng.range(-60, 60), top, band[1] - 4); s.t = 0.5; }
    else if (r < 0.8) { s.mode = 'tremble'; s.t = rng.range(0.6, 1.5); s.tx = s.x; s.ty = s.y; }
    else { s.mode = 'hold'; s.t = rng.range(0.4, 1.5); }
  }

  function update(dt: number) {
    time += dt;
    for (const s of spots) {
      s.t -= dt;
      if (s.hidden > 0) { s.hidden -= dt; if (s.hidden <= 0) { s.x = rng.range(20, W - 20); s.y = rng.range(top + 10, band[1] - 6); } continue; }
      switch (s.mode) {
        case 'glide': s.x += (s.tx - s.x) * Math.min(1, dt * 1.6 * opts.speed); s.y += (s.ty - s.y) * Math.min(1, dt * 1.6 * opts.speed); break;
        case 'dart': s.x += (s.tx - s.x) * Math.min(1, dt * 12 * opts.speed); s.y += (s.ty - s.y) * Math.min(1, dt * 12 * opts.speed); break;
        case 'tremble': s.x = s.tx + noise1(time * 9, s.seed) * 3; s.y = s.ty + noise1(time * 8, s.seed + 5) * 2; break;
        default: break;
      }
      if (s.t <= 0) next(s);
    }
    rainbow.x += rainbow.vx * dt;
    if (rainbow.x > W * 0.8 || rainbow.x < W * 0.15) rainbow.vx = -rainbow.vx;
    for (const d of disco) { d.a += dt * d.speed * opts.speed; if (d.hit > 0) d.hit -= dt; }
  }

  const discoPos = (d: Disco): [number, number] => {
    // Spots go round the room as the ball turns; seen from inside, they slide across and wrap.
    const x = ((d.a / (Math.PI * 2)) % 1) * (W + 60) - 30;
    return [x, d.y + Math.sin(d.a * 3) * 3];
  };

  function paw(x: number, y: number) {
    for (const s of spots) {
      if (s.hidden > 0) continue;
      if (dist(x, y, s.x, s.y) < s.r + 8 * opts.reach) {
        ctx.caught('light', s.x, s.y, '#fff6c0');
        s.hidden = rng.range(0.6, 1.4);
      } else if (dist(x, y, s.x, s.y) < 70) { s.mode = 'dart'; s.tx = clamp(s.x + (s.x - x) * 2, 10, W - 10); s.ty = clamp(s.y + (s.y - y), top, band[1] - 4); s.t = 0.6; }
    }
    for (const d of disco) {
      const [dx, dy] = discoPos(d);
      if (d.hit <= 0 && dist(x, y, dx, dy) < 6 * opts.reach + d.r) { d.hit = 1; ctx.caught('light', dx, dy, d.c); }
    }
    void fx;
  }

  function soft(g: CanvasRenderingContext2D, x: number, y: number, r: number, flat: boolean, c: string, core: string) {
    const ry = flat ? r * 0.45 : r;
    for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++) {
      for (let xx = -Math.ceil(r); xx <= Math.ceil(r); xx++) {
        const d = Math.hypot(xx / r, yy / ry);
        if (d > 1) continue;
        // Dithered falloff: solid core, speckled edge.
        const k = 1 - d;
        const b = ((xx & 1) + (yy & 1) * 2) / 4;
        if (k < 0.35 && b > k * 2.4) continue;
        g.fillStyle = col(k > 0.55 ? core : c);
        g.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
      }
    }
  }

  function draw(g: CanvasRenderingContext2D) {
    if (!night) {
      // The rainbow from the crystal: a soft band of colours on the wall.
      const cols = ['#ff7a7a', '#ffb070', '#fff08a', '#9aff9a', '#8ad0ff', '#b89aff'];
      g.globalAlpha = 0.35;
      for (let i = 0; i < cols.length; i++) { g.fillStyle = col(cols[i]); g.fillRect(Math.round(rainbow.x + i * 2), Math.round(rainbow.y - 6 + i * 0.5), 2, 12); }
      g.globalAlpha = 1;
    }
  }

  function drawGlow(g: CanvasRenderingContext2D) {
    g.globalCompositeOperation = 'lighter';
    for (const s of spots) {
      if (s.hidden > 0) continue;
      g.globalAlpha = 0.55;
      soft(g, s.x, s.y, s.r, onFloor(s.y), '#fff0b8', '#fffdf0');
    }
    if (night) {
      for (const d of disco) {
        const [x, y] = discoPos(d);
        if (d.hit > 0) continue;
        g.globalAlpha = 0.8;
        soft(g, x, y, d.r + 1, onFloor(y), d.c, '#ffffff');
      }
      // The ball itself, glittering.
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = col('#3a3440'); g.fillRect(Math.round(ballX), 0, 1, ballY - 6);
      for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) {
        if (xx * xx + yy * yy > 36) continue;
        const tw = Math.sin(time * 6 + xx * 1.7 + yy * 2.3) > 0.6;
        g.fillStyle = col(tw ? '#ffffff' : (xx + yy + 20) % 2 ? '#9aa4b8' : '#d8dee8');
        g.fillRect(Math.round(ballX + xx), ballY + yy, 1, 1);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function lights(): Light[] {
    const out: Light[] = [];
    for (const s of spots) if (s.hidden <= 0) out.push({ x: s.x, y: s.y, r: 26, c: '#fff0c0', a: 0.8 });
    if (night) out.push({ x: ballX, y: ballY, r: 30, c: '#dfe6ff', a: 0.6 });
    return out;
  }

  return { update, draw, drawGlow, paw, lights };
}

export const sunspots: SceneDef = {
  id: 'sunspots',
  name: { uk: 'Сонячні зайчики', en: 'Sun spots' },
  about: {
    uk: 'Удень по стіні й підлозі стрибає сонячний зайчик і пливе веселка від кришталика, а вночі крутиться диско-куля і кімнатою біжать кольорові цятки.',
    en: 'By day a mirror’s sun spot leaps over the wall and floor beside a crystal’s rainbow; at night a disco ball sends coloured spots round the room.',
  },
  energy: 0.6,
  locations: ['livingroom', 'kitchen', 'attic'],
  kind: 'light',
  icon: 'light',
  create,
};
