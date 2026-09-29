/**
 * The laser dot, moved the way a good player moves it: never smoothly for long. It darts and
 * stops dead, trembles, creeps along the skirting, zigzags across the floor, runs up the wall,
 * ducks behind the sack or into a mouse hole and peeks out again, leaves the screen and comes
 * back from the other side. On the floor it is squashed flat by the angle; on the wall it is round.
 * When a paw lands on it, it stays pinned under the paw a moment — a catch, and a treat pops
 * out, because a hunt with no catch at the end only frustrates a cat.
 */
import type { SceneDef, SceneCtx, SceneInstance, Light } from '../game/types';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { dist } from './util';

type Move = 'dart' | 'freeze' | 'wiggle' | 'creep' | 'zigzag' | 'hide' | 'climb' | 'circle' | 'away';

interface Dot {
  x: number; y: number;
  vx: number; vy: number;
  move: Move; t: number;
  tx: number; ty: number;
  hidden: number;
  pinned: number;
  trail: [number, number][];
  zig: number; ang: number; cx: number; cy: number;
  c: string;
  steps: number;
}

const COLORS = ['#ff2a3a', '#ff2a3a', '#ff2a3a', '#39ff6a', '#4a8cff'];

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [Math.round(H * 0.66), H - 6];
  const wallTop = Math.round(H * 0.18);
  const props = loc.props || [];
  const holes = loc.holes || [];
  const sp = opts.speed;
  const dots: Dot[] = [mk(rng.pick(COLORS))];
  let second = rng.range(40, 80);
  const treats: { x: number; y: number; vy: number; t: number }[] = [];

  function mk(c: string): Dot {
    return { x: W * 0.5, y: (band[0] + band[1]) / 2, vx: 0, vy: 0, move: 'freeze', t: 0.6, tx: 0, ty: 0, hidden: 0, pinned: 0, trail: [], zig: 0, ang: 0, cx: 0, cy: 0, c, steps: 0 };
  }

  const onFloor = (y: number) => y >= band[0] - 1;
  const floorPt = (): [number, number] => [rng.range(W * 0.06, W * 0.94), rng.range(band[0] + 3, band[1] - 3)];

  function next(d: Dot) {
    d.steps++;
    const k = opts.intensity;
    const m = rng.weighted<Move>(['dart', 'freeze', 'wiggle', 'creep', 'zigzag', 'hide', 'climb', 'circle', 'away'], (x) => ({
      dart: 5 + k * 3, freeze: 3.2 - k, wiggle: 2, creep: 2.2 - k * 0.8, zigzag: 1 + k, hide: props.length || holes.length ? 1.6 : 0,
      climb: 1.1, circle: 0.8, away: d.steps > 6 ? 0.5 : 0,
    }[x]));
    d.move = m;
    switch (m) {
      case 'dart': {
        const [x, y] = rng.chance(0.8) ? floorPt() : [rng.range(W * 0.1, W * 0.9), rng.range(wallTop, band[0] - 6)];
        d.tx = x; d.ty = y; d.t = 2;
        break;
      }
      case 'freeze': d.t = rng.range(0.35, 1.6) * (1.3 - k * 0.5); break;
      case 'wiggle': d.t = rng.range(0.5, 1.4); d.cx = d.x; d.cy = d.y; break;
      case 'creep': {
        const [x, y] = floorPt();
        const dd = dist(d.x, d.y, x, y);
        d.tx = d.x + (x - d.x) * Math.min(1, 90 / Math.max(1, dd)); d.ty = d.y + (y - d.y) * Math.min(1, 90 / Math.max(1, dd));
        d.t = 4;
        break;
      }
      case 'zigzag': d.t = rng.range(1.2, 2.2); d.zig = 0; d.tx = rng.sign(); d.ty = rng.range(-1, 1); break;
      case 'hide': {
        // Behind something on the floor, or into a hole.
        if (props.length && (rng.chance(0.6) || !holes.length)) {
          const p = rng.pick(props);
          d.tx = rng.range(p.x0 + 4, p.x1 - 4); d.ty = p.y - 3;
        } else {
          const h = rng.pick(holes);
          d.tx = h.x; d.ty = h.y - 3;
        }
        d.t = 3;
        break;
      }
      case 'climb': d.tx = clamp(d.x + rng.range(-60, 60), 10, W - 10); d.ty = rng.range(wallTop, band[0] - 20); d.t = 3; break;
      case 'circle': d.cx = d.x; d.cy = d.y; d.ang = 0; d.t = rng.range(1.2, 2.4); break;
      case 'away': { const side = d.x < W / 2 ? -1 : 1; d.tx = side < 0 ? -20 : W + 20; d.ty = d.y; d.t = 3; break; }
    }
  }

  function goTo(d: Dot, dt: number, v: number): boolean {
    const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy);
    if (dd < 1) return true;
    const s = Math.min(dd, v * sp * dt);
    d.x += (dx / dd) * s; d.y += (dy / dd) * s;
    return dd - s < 1;
  }

  function update(dt: number) {
    if (opts.intensity > 0.5) {
      second -= dt;
      if (second <= 0 && dots.length === 1) { const d = mk(dots[0].c === '#39ff6a' ? '#ff2a3a' : '#39ff6a'); d.x = -10; d.y = floorPt()[1]; d.move = 'dart'; [d.tx, d.ty] = floorPt(); dots.push(d); second = rng.range(14, 24); }
      else if (second <= 0 && dots.length > 1) { dots[1].move = 'away'; dots[1].tx = W + 30; dots[1].t = 3; second = rng.range(50, 90); }
    }
    for (const d of dots) step(d, dt);
    for (let i = dots.length - 1; i > 0; i--) if (dots[i].x > W + 25 || dots[i].x < -25) { if (dots[i].move === 'away') dots.splice(i, 1); }
    for (const t of treats) { t.t += dt; t.y += t.vy * dt; t.vy += 160 * dt; }
    for (let i = treats.length - 1; i >= 0; i--) if (treats[i].t > 1.4) treats.splice(i, 1);
  }

  function step(d: Dot, dt: number) {
    const px = d.x, py = d.y;
    if (d.pinned > 0) { d.pinned -= dt; if (d.pinned <= 0) { d.move = 'dart'; [d.tx, d.ty] = floorPt(); d.t = 2; } return; }
    if (d.hidden > 0) {
      d.hidden -= dt;
      if (d.hidden <= 0) { d.move = 'freeze'; d.t = rng.range(0.3, 0.8); }
      return;
    }
    d.t -= dt;
    switch (d.move) {
      case 'dart':
        if (goTo(d, dt, rng.range(320, 460)) || d.t <= 0) { d.move = 'freeze'; d.t = rng.range(0.2, 0.9); }
        break;
      case 'freeze':
        // A hand is never quite still.
        if (rng.chance(dt * 20)) { d.x += rng.range(-0.6, 0.6); d.y += rng.range(-0.4, 0.4); }
        if (d.t <= 0) next(d);
        break;
      case 'wiggle':
        d.x = d.cx + Math.sin(d.t * 31) * 3 + rng.range(-0.7, 0.7);
        d.y = d.cy + Math.cos(d.t * 23) * (onFloor(d.cy) ? 1.5 : 3);
        if (d.t <= 0) next(d);
        break;
      case 'creep':
        if (goTo(d, dt, 26) || d.t <= 0) next(d);
        break;
      case 'zigzag':
        d.zig += dt;
        d.x += d.tx * 210 * sp * dt;
        d.y += Math.sign(Math.sin(d.zig * 9)) * 70 * sp * dt + d.ty * 10 * dt;
        d.y = clamp(d.y, band[0] + 2, band[1] - 2);
        if (d.x < 12 || d.x > W - 12) { d.tx = -d.tx; d.x = clamp(d.x, 12, W - 12); }
        if (d.t <= 0) next(d);
        break;
      case 'hide':
        if (goTo(d, dt, 300) || d.t <= 0) { d.hidden = rng.range(0.6, 2.2); }
        break;
      case 'climb':
        if (goTo(d, dt, 240) || d.t <= 0) { d.move = 'wiggle'; d.cx = d.x; d.cy = d.y; d.t = rng.range(0.3, 0.8); }
        break;
      case 'circle': {
        d.ang += dt * 9 * sp;
        const r = 8 + d.ang * 1.5;
        d.x = d.cx + Math.cos(d.ang) * r;
        d.y = d.cy + Math.sin(d.ang) * r * (onFloor(d.cy) ? 0.45 : 1);
        if (d.t <= 0) next(d);
        break;
      }
      case 'away':
        if (goTo(d, dt, 380) || d.t <= 0) {
          // Back in from the other side after a beat.
          d.x = d.x < W / 2 ? W + 15 : -15;
          d.hidden = rng.range(0.6, 1.4);
          d.move = 'dart'; [d.tx, d.ty] = floorPt(); d.t = 2;
          d.hidden = 0.8;
        }
        break;
    }
    d.x = clamp(d.x, -30, W + 30); d.y = clamp(d.y, wallTop - 10, band[1]);
    const moved = Math.hypot(d.x - px, d.y - py);
    if (moved > 2.5) d.trail.push([px, py]);
    else if (d.trail.length) d.trail.shift();
    if (d.trail.length > 4) d.trail.shift();
  }

  function paw(x: number, y: number) {
    for (const d of dots) {
      if (d.hidden > 0 || d.pinned > 0) continue;
      if (dist(x, y, d.x, d.y) < 16 * opts.reach) {
        d.pinned = 0.55; d.x = x; d.y = y; d.trail = [];
        ctx.caught('laser', x, y, d.c === '#39ff6a' ? '#9dffb5' : '#ffd0d0');
        treats.push({ x, y: y - 4, vy: -90, t: 0 });
        sfx.pop();
      } else if (dist(x, y, d.x, d.y) < 60) {
        // Near miss: it bolts.
        d.move = 'dart';
        const a = Math.atan2(d.y - y, d.x - x);
        d.tx = clamp(d.x + Math.cos(a) * 120, 10, W - 10); d.ty = clamp(d.y + Math.sin(a) * 60, wallTop, band[1] - 3); d.t = 1.5;
      }
    }
    void fx;
  }

  function drawDot(g: CanvasRenderingContext2D, d: Dot) {
    if (d.hidden > 0) return;
    const X = Math.round(d.x), Y = Math.round(d.y);
    const flat = onFloor(d.y);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < d.trail.length; i++) {
      const [tx, ty] = d.trail[i];
      g.globalAlpha = 0.18 * (i + 1) / d.trail.length;
      g.fillStyle = col(d.c);
      g.fillRect(Math.round(tx) - 1, Math.round(ty), 3, 1);
    }
    // Halo, then body, then the white-hot middle.
    g.globalAlpha = 0.35;
    g.fillStyle = col(d.c);
    if (flat) { g.fillRect(X - 4, Y - 1, 9, 3); g.fillRect(X - 3, Y - 2, 7, 5); }
    else { g.fillRect(X - 3, Y - 3, 7, 7); g.fillRect(X - 4, Y - 2, 9, 5); g.fillRect(X - 2, Y - 4, 5, 9); }
    // The body is painted solid, so it stays red even on a pale floor in daylight.
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    if (flat) { g.fillRect(X - 2, Y - 1, 5, 3); g.fillRect(X - 1, Y - 2, 3, 5); }
    else { g.fillRect(X - 2, Y - 2, 5, 5); g.fillRect(X - 3, Y - 1, 7, 3); g.fillRect(X - 1, Y - 3, 3, 7); }
    g.fillStyle = col(d.c === '#ff2a3a' ? '#ff8a8a' : '#d8ffd8');
    if (flat) g.fillRect(X - 1, Y - 1, 3, 2); else g.fillRect(X - 1, Y - 1, 3, 3);
    g.fillStyle = col('#ffffff');
    if (flat) g.fillRect(X, Y - 1, 1, 1); else g.fillRect(X, Y - 1, 1, 2);
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    void g; void t;
  }

  function drawGlow(g: CanvasRenderingContext2D) {
    // Light, not paint: drawn after the hour's tint so it burns just as bright at night.
    for (const d of dots) drawDot(g, d);
  }

  function drawTop(g: CanvasRenderingContext2D) {
    // The treat that pops out of a catch: a little fish biscuit.
    for (const tr of treats) {
      const X = Math.round(tr.x), Y = Math.round(tr.y);
      g.globalAlpha = Math.min(1, (1.4 - tr.t) * 2);
      g.fillStyle = col('#c9803a'); g.fillRect(X - 3, Y - 1, 5, 3); g.fillRect(X + 2, Y - 2, 1, 1); g.fillRect(X + 2, Y + 2, 1, 1); g.fillRect(X + 3, Y - 1, 1, 3);
      g.fillStyle = col('#f0b060'); g.fillRect(X - 2, Y - 1, 3, 1);
      g.fillStyle = col('#2a1f2b'); g.fillRect(X - 2, Y, 1, 1);
      g.globalAlpha = 1;
    }
  }

  function lights(): Light[] {
    return dots.filter((d) => d.hidden <= 0).map((d) => ({ x: d.x, y: d.y, r: 22, c: d.c, a: 0.9 }));
  }

  return { update, draw, drawTop, drawGlow, paw, lights };
}

export const laser: SceneDef = {
  id: 'laser',
  name: { uk: 'Лазерна точка', en: 'Laser dot' },
  about: {
    uk: 'Точка, що поводиться як здобич: завмирає, тремтить, ховається за мішок, лізе по стіні. Спіймав, і вискакує смаколик.',
    en: 'A dot that behaves like prey: freezes, trembles, hides behind the sack, runs up the wall. Catch it and a treat pops out.',
  },
  energy: 0.95,
  locations: ['kitchen', 'livingroom', 'attic'],
  kind: 'laser',
  icon: 'laser',
  create,
};
