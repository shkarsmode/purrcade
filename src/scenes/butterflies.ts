/**
 * Butterflies and bees over flowers. A butterfly never flies straight: it bobs and slides and
 * changes its mind, drifts to a flower, lands with its wings slowly opening and closing, and
 * lifts off again; two of them now and then spiral up around each other. Bees go in quick
 * straight runs from flower to flower with a hover between. A paw sends them up and away.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { butterflySprite, beeSprite, type Wing } from '../sprites/insects';
import { blit } from '../core/pix';
import { shadow } from '../game/art';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { dist } from './util';

type St = 'fly' | 'land' | 'rest' | 'dance' | 'flee';

interface Fly {
  wing: Wing;
  x: number; y: number; vx: number; vy: number;
  st: St; t: number;
  tx: number; ty: number;
  bloom: number;
  flap: number; seed: number;
  partner: Fly | null;
  ang: number; cx: number; cy: number;
}
interface Bee { x: number; y: number; tx: number; ty: number; t: number; hover: number; flap: number; face: 1 | -1 }

const WINGS: Wing[] = ['monarch', 'morpho', 'white', 'swallowtail', 'admiral', 'pink'];

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.7, H - 8];
  const blooms = loc.blooms && loc.blooms.length ? loc.blooms : Array.from({ length: 12 }, () => ({ x: rng.range(W * 0.1, W * 0.9), y: rng.range(band[0], band[1] - 10), c: '#ffffff' }));
  const nb = Math.round(clamp(3 + opts.density * 3, 2, 9));
  const flies: Fly[] = [];
  const bees: Bee[] = [];
  let time = 0;

  const skyPoint = (): [number, number] => [rng.range(W * 0.05, W * 0.95), rng.range(H * 0.15, band[1] - 20)];

  for (let i = 0; i < nb; i++) {
    const [x, y] = skyPoint();
    flies.push({ wing: rng.pick(WINGS), x, y, vx: 0, vy: 0, st: 'fly', t: rng.range(2, 6), tx: x, ty: y, bloom: -1, flap: rng.range(0, 10), seed: rng.range(0, 100), partner: null, ang: 0, cx: 0, cy: 0 });
  }
  for (let i = 0; i < Math.round(1 + opts.density * 1.5); i++) {
    const b = rng.pick(blooms);
    bees.push({ x: b.x, y: b.y - 6, tx: b.x, ty: b.y - 6, t: rng.range(1, 3), hover: 0, flap: 0, face: 1 });
  }

  function pickBloom(f: Fly) {
    const free = blooms.map((b, i) => i).filter((i) => !flies.some((o) => o !== f && o.bloom === i));
    if (!free.length) { [f.tx, f.ty] = skyPoint(); f.bloom = -1; return; }
    f.bloom = rng.pick(free);
    f.tx = blooms[f.bloom].x; f.ty = blooms[f.bloom].y - 1;
  }

  function update(dt: number) {
    time += dt;
    for (const f of flies) stepFly(f, dt);
    for (const b of bees) stepBee(b, dt);
  }

  function stepFly(f: Fly, dt: number) {
    f.t -= dt;
    const flapRate = f.st === 'rest' ? 1.2 : f.st === 'flee' ? 22 : 13;
    f.flap += dt * flapRate;
    const sp = opts.speed;
    switch (f.st) {
      case 'fly': {
        // Toward the goal, but on a wobbling, bobbing line.
        const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
        const wob = noise1(time * 1.3, f.seed) * 60;
        const bob = Math.sin(f.flap * 0.9) * 26;
        f.vx += ((dx / (d || 1)) * 38 * sp + wob * 0.4 - f.vx) * Math.min(1, dt * 2);
        f.vy += ((dy / (d || 1)) * 30 * sp + bob - f.vy) * Math.min(1, dt * 3);
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (d < 12 && f.bloom >= 0) { f.st = 'land'; f.t = 0.6; }
        else if (d < 10 || f.t <= 0) {
          f.t = rng.range(3, 7);
          if (rng.chance(0.7)) pickBloom(f); else { [f.tx, f.ty] = skyPoint(); f.bloom = -1; }
          // Sometimes two meet and spiral up together.
          const o = flies.find((x) => x !== f && x.st === 'fly' && dist(x.x, x.y, f.x, f.y) < 50);
          if (o && rng.chance(0.25)) { for (const q of [f, o]) { q.st = 'dance'; q.t = rng.range(2.5, 4); q.cx = (f.x + o.x) / 2; q.cy = (f.y + o.y) / 2; q.partner = q === f ? o : f; } f.ang = 0; o.ang = Math.PI; }
        }
        break;
      }
      case 'land': {
        const b = blooms[f.bloom];
        f.x += (b.x - f.x) * Math.min(1, dt * 6); f.y += (b.y - 1 - f.y) * Math.min(1, dt * 6);
        if (f.t <= 0) { f.st = 'rest'; f.t = rng.range(2.5, 7); f.x = b.x; f.y = b.y - 1; }
        break;
      }
      case 'rest':
        if (f.t <= 0) { f.st = 'fly'; f.t = rng.range(2, 5); [f.tx, f.ty] = skyPoint(); f.bloom = -1; f.vy = -30; }
        break;
      case 'dance':
        f.ang += dt * 5;
        f.cy -= dt * 14;
        f.x = f.cx + Math.cos(f.ang) * 10; f.y = f.cy + Math.sin(f.ang) * 6;
        if (f.t <= 0 || f.cy < H * 0.08) { f.st = 'fly'; f.t = rng.range(2, 5); pickBloom(f); f.partner = null; }
        break;
      case 'flee':
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 10 * dt;
        if (f.t <= 0) { f.st = 'fly'; f.t = rng.range(2, 4); pickBloom(f); }
        break;
    }
    // Come back if blown off the screen.
    if (f.x < -20 || f.x > W + 20 || f.y < -20) { f.tx = clamp(f.x, 20, W - 20); f.ty = H * 0.4; f.bloom = -1; if (f.st === 'flee') f.t = Math.min(f.t, 0.2); }
  }

  function stepBee(b: Bee, dt: number) {
    b.flap += dt * 30;
    b.t -= dt;
    if (b.hover > 0) {
      b.hover -= dt;
      b.x += Math.sin(time * 9 + b.tx) * 6 * dt; b.y += Math.cos(time * 11 + b.ty) * 5 * dt;
      if (b.hover <= 0) { const bl = rng.pick(blooms); b.tx = bl.x; b.ty = bl.y - 4; }
      return;
    }
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1) b.face = dx > 0 ? 1 : -1;
    const s = Math.min(d, 90 * opts.speed * dt);
    b.x += (dx / (d || 1)) * s; b.y += (dy / (d || 1)) * s;
    if (d < 1.5) { b.hover = rng.range(0.8, 2.5); if (rng.chance(0.3)) sfx.buzz(); }
  }

  function paw(x: number, y: number) {
    for (const f of flies) {
      const d = dist(x, y, f.x, f.y);
      if (d < 10 * opts.reach && f.st !== 'flee') {
        ctx.caught('butterfly', f.x, f.y, '#ffe6f6');
        fx.burst(f.x, f.y, 6, ['#ffffff', '#fff0a0'], { speed: 30, g: 10, max: 0.6 });
      }
      if (d < 70) {
        f.st = 'flee'; f.t = rng.range(0.8, 1.4); f.bloom = -1;
        const a = Math.atan2(f.y - y, f.x - x) - 0.6;
        f.vx = Math.cos(a) * 90; f.vy = Math.min(-40, Math.sin(a) * 90);
      }
    }
    for (const b of bees) {
      const d = dist(x, y, b.x, b.y);
      if (d < 9 * opts.reach) ctx.caught('bug', b.x, b.y, '#ffe066');
      if (d < 60) { b.hover = 0; b.tx = clamp(b.x + (b.x - x) * 2, 10, W - 10); b.ty = clamp(b.y - 40, 10, H - 20); }
    }
  }

  function draw(g: CanvasRenderingContext2D) {
    for (const f of flies) {
      if (f.st === 'rest' || f.st === 'land') {
        const f2 = f.st === 'rest' ? [0, 1, 2, 1][Math.floor(f.flap) % 4] : Math.floor(f.flap);
        blit(g, butterflySprite(f.wing, f2), f.x, f.y, 10, 12);
      }
    }
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const f of flies) {
      if (f.st === 'rest' || f.st === 'land') continue;
      // A faint shadow on the grass below, far down if it is high up.
      if (f.y > band[0] - 60) shadow(g, f.x, clamp(f.y + 30, band[0], band[1]), 8, 2, 0.12);
      blit(g, butterflySprite(f.wing, Math.floor(f.flap)), f.x, f.y, 10, 8);
    }
    for (const b of bees) blit(g, beeSprite(Math.floor(b.flap)), b.x, b.y, 5, 5, b.face < 0);
  }

  return { update, draw, drawTop, paw };
}

export const butterflies: SceneDef = {
  id: 'butterflies',
  name: { uk: 'Метелики', en: 'Butterflies' },
  about: {
    uk: 'Метелики пурхають від квітки до квітки, сідають і повільно складають крила, а бджоли снують між ними.',
    en: 'Butterflies flutter from flower to flower and settle with slow wingbeats, while bees dart among them.',
  },
  energy: 0.4,
  locations: ['meadow', 'garden'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'butterfly',
  icon: 'butterfly',
  create,
};
