/**
 * Soap bubbles, blown in from the side of the picture in bursts: they drift up and sideways on
 * the air, wobble, shine with a film of colour that slides round their rim, sink slowly, bounce
 * once on the ground and pop. Now and then a giant one comes by, wobbling, and bursts into a
 * shower of little ones. A paw pops them — the most satisfying thing in the world.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { dist } from './util';

interface Bubble { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number; seed: number; bounced: boolean; wob: number }

const FILM = ['#ff9ad8', '#9ad8ff', '#fff09a', '#9affc8', '#c8a0ff'];

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const ground = loc.floorBand ? (loc.floorBand[0] + loc.floorBand[1]) / 2 : loc.floor;
  const bubbles: Bubble[] = [];
  let time = 0;
  let nextBurst = 0.5;
  let side = rng.sign();
  let nextGiant = rng.range(20, 40);

  function blow(n: number) {
    const x0 = side < 0 ? -10 : W + 10;
    const y0 = rng.range(H * 0.25, H * 0.6);
    for (let i = 0; i < n; i++) {
      const r = Math.pow(rng.next(), 1.8) * 9 + 3;
      bubbles.push({ x: x0, y: y0 + rng.range(-10, 10), vx: -side * rng.range(30, 70) * opts.speed, vy: rng.range(-20, 10), r, life: rng.range(8, 16), age: -i * 0.08, seed: rng.range(0, 99), bounced: false, wob: 0 });
    }
  }

  function update(dt: number) {
    time += dt;
    nextBurst -= dt;
    if (nextBurst <= 0) {
      nextBurst = rng.range(2.5, 6) / Math.max(0.5, opts.density);
      if (rng.chance(0.3)) side = -side;
      if (bubbles.length < 40 * opts.density) blow(rng.int(3, 7));
    }
    nextGiant -= dt;
    if (nextGiant <= 0) {
      nextGiant = rng.range(30, 55);
      const s = rng.sign();
      bubbles.push({ x: s < 0 ? -30 : W + 30, y: H * 0.35, vx: -s * 22, vy: -3, r: 22, life: 30, age: 0, seed: rng.range(0, 99), bounced: false, wob: 0 });
    }
    for (const b of bubbles) {
      b.age += dt;
      if (b.age < 0) continue;
      // Air: a drift, a lazy wander, a little lift for the small ones and a slow sink for the big.
      b.vx += (noise1(time * 0.4, b.seed) * 14 - b.vx * 0.3) * dt;
      b.vy += (noise1(time * 0.35, b.seed + 40) * 10 + (b.r > 8 ? 4 : -2) - b.vy * 0.25) * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.wob += dt * (3 + 20 / b.r);
      if (b.y + b.r > ground && !b.bounced) { b.bounced = true; b.vy = -Math.abs(b.vy) * 0.5 - 6; b.life = Math.min(b.life, b.age + rng.range(0.6, 2)); }
      if (b.y < b.r) b.vy += 20 * dt;
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.age > b.life || b.x < -60 || b.x > W + 60) { if (b.age > b.life && b.x > 0 && b.x < W) burst(b, false); bubbles.splice(i, 1); }
    }
  }

  function burst(b: Bubble, byPaw: boolean) {
    const n = Math.round(6 + b.r);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      fx.add({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 + 10, g: 120, drag: 1, max: 0.4, c: FILM[i % FILM.length] });
    }
    fx.add({ x: b.x, y: b.y, kind: 'ring', max: 0.25, c: '#ffffff', size: Math.max(2, b.r / 3) });
    sfx.pop();
    if (b.r > 18) {
      // A giant one leaves a shower of little ones.
      for (let i = 0; i < 9; i++) bubbles.push({ x: b.x + rng.range(-10, 10), y: b.y + rng.range(-10, 10), vx: rng.range(-40, 40), vy: rng.range(-40, 10), r: rng.range(3, 6), life: rng.range(4, 8), age: 0, seed: rng.range(0, 99), bounced: false, wob: 0 });
    }
    void byPaw;
  }

  function paw(x: number, y: number) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.age < 0) continue;
      if (dist(x, y, b.x, b.y) < b.r + 6 * opts.reach) {
        ctx.caught('bubble', b.x, b.y, FILM[i % FILM.length]);
        burst(b, true);
        bubbles.splice(i, 1);
      } else if (dist(x, y, b.x, b.y) < b.r + 40) {
        // The air of a paw going by pushes them.
        const a = Math.atan2(b.y - y, b.x - x);
        b.vx += Math.cos(a) * 40; b.vy += Math.sin(a) * 40;
      }
    }
  }

  function drawBubble(g: CanvasRenderingContext2D, b: Bubble) {
    const R = b.r;
    const sx = 1 + Math.sin(b.wob) * (R > 15 ? 0.08 : 0.04), sy = 2 - sx;
    const n = Math.max(12, Math.round(R * 6));
    const turn = time * 0.8 + b.seed;
    // Faint fill, a film of colour sliding round the rim, and a bright glint.
    g.globalAlpha = 0.12;
    g.fillStyle = col('#dff6ff');
    for (let yy = -Math.floor(R * sy); yy <= Math.floor(R * sy); yy++) {
      const hw = Math.sqrt(Math.max(0, 1 - (yy / (R * sy)) ** 2)) * R * sx;
      g.fillRect(Math.round(b.x - hw), Math.round(b.y + yy), Math.round(hw * 2), 1);
    }
    g.globalAlpha = 0.9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = (Math.sin(a * 2 + turn) + 1) / 2;
      g.fillStyle = col(FILM[Math.floor(k * FILM.length) % FILM.length]);
      g.fillRect(Math.round(b.x + Math.cos(a) * R * sx), Math.round(b.y + Math.sin(a) * R * sy), 1, 1);
    }
    g.globalAlpha = 1;
    g.fillStyle = col('#ffffff');
    const gx = Math.round(b.x - R * 0.45), gy = Math.round(b.y - R * 0.5);
    g.fillRect(gx, gy, R > 6 ? 2 : 1, 1);
    if (R > 6) { g.fillRect(gx, gy + 1, 1, 1); g.fillRect(gx + 2, gy - 1, 1, 1); }
    if (R > 12) { g.globalAlpha = 0.6; g.fillRect(Math.round(b.x + R * 0.4), Math.round(b.y + R * 0.45), 2, 1); g.globalAlpha = 1; }
  }

  function draw(g: CanvasRenderingContext2D) {
    void g;
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const b of bubbles) if (b.age >= 0) drawBubble(g, b);
  }

  return { update, draw, drawTop, paw };
}

export const bubbles: SceneDef = {
  id: 'bubbles',
  name: { uk: 'Мильні бульбашки', en: 'Soap bubbles' },
  about: {
    uk: 'Райдужні бульбашки пливуть повітрям, погойдуються, м’яко відскакують від землі й лопаються. Іноді прилітає велетенська.',
    en: 'Rainbow bubbles drift on the air, wobble, bounce softly off the ground and pop. Now and then a giant one floats by.',
  },
  energy: 0.45,
  locations: ['garden', 'meadow', 'beach', 'livingroom'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'bubble',
  icon: 'bubble',
  create,
};
