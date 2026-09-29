/**
 * A tropical tank. A school of neon tetras sweeps round as one, turning all together; a
 * clownfish, an angelfish, a goldfish, a blue tang and a betta cruise at their own pace, hover,
 * turn; a snail works its way along the sand and a crab scuttles sideways. Flakes of food drift
 * down now and then and everyone rises for them. Touch a pufferfish and it blows itself up.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { fishSprite, snailSprite, crabSprite, FISH_BOX, type FishKind } from '../sprites/fish';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { Agent, flock, noise1 } from '../core/steer';
import { dist } from './util';

interface Swimmer {
  kind: FishKind;
  x: number; y: number; vx: number; vy: number;
  face: 1 | -1;
  cruise: number;
  t: number;
  hover: number;
  puff: number;
  seed: number;
  anim: number;
  food: Flake | null;
}
interface Flake { x: number; y: number; vy: number; eaten: boolean; c: string }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const [top, bottom] = loc.water || [8, H * 0.8];
  const sand = loc.floorBand ? loc.floorBand[0] : bottom;
  const fish: Swimmer[] = [];
  const school: Agent[] = [];
  const flakes: Flake[] = [];
  let leader = { x: W / 2, y: (top + bottom) / 2, seed: rng.range(0, 99) };
  let time = 0;
  let nextFood = rng.range(14, 26);
  const snail = { x: rng.range(W * 0.2, W * 0.8), dir: rng.sign(), f: 0 };
  const crab = { x: rng.range(W * 0.3, W * 0.7), dir: 1, t: 2, walk: 0, claws: 0 };

  const kinds: FishKind[] = ['clown', 'angel', 'gold', 'tang', 'betta', 'puffer', 'clown', 'gold'];
  const nFish = Math.round(clamp(3 + opts.density * 3, 3, 8));
  for (let i = 0; i < nFish; i++) {
    const kind = kinds[i % kinds.length];
    fish.push({ kind, x: rng.range(W * 0.1, W * 0.9), y: rng.range(top + 20, bottom - 20), vx: 0, vy: 0, face: rng.chance(0.5) ? 1 : -1, cruise: { clown: 26, angel: 12, gold: 18, tang: 30, betta: 10, puffer: 14, neon: 30 }[kind] * rng.range(0.8, 1.2), t: rng.range(1, 4), hover: 0, puff: 0, seed: rng.range(0, 99), anim: rng.range(0, 3), food: null });
  }
  const nNeon = Math.round(clamp(8 + opts.density * 5, 6, 18));
  for (let i = 0; i < nNeon; i++) {
    const a = new Agent(W / 2 + rng.range(-30, 30), (top + bottom) / 2 + rng.range(-20, 20), 42 * opts.speed, 70, rng.range(0, 99));
    a.vx = rng.range(-10, 10);
    school.push(a);
  }

  function update(dt: number) {
    time += dt;
    // Food now and then.
    nextFood -= dt;
    if (nextFood <= 0) {
      nextFood = rng.range(20, 40);
      const cx = rng.range(W * 0.2, W * 0.8);
      for (let i = 0; i < 12; i++) flakes.push({ x: cx + rng.range(-24, 24), y: top + rng.range(0, 4), vy: rng.range(6, 12), eaten: false, c: rng.pick(['#e8a040', '#d86a3a', '#f4d06a']) });
      sfx.plop();
    }
    for (const f of flakes) { f.y += f.vy * dt; f.x += Math.sin(time * 2 + f.y * 0.1) * 4 * dt; }
    for (let i = flakes.length - 1; i >= 0; i--) if (flakes[i].eaten || flakes[i].y > sand) flakes.splice(i, 1);

    // The school follows a wandering leader, tightly, turning together.
    leader.x = W / 2 + noise1(time * 0.08, leader.seed) * W * 0.4;
    leader.y = (top + bottom) / 2 + noise1(time * 0.11, leader.seed + 9) * (bottom - top) * 0.35;
    flock(school, { sep: 9, align: 0.7, cohere: 0.35, radius: 44, sepRadius: 13 });
    for (const a of school) {
      a.arrive(leader.x, leader.y, 60, 0.35);
      a.contain(6, top + 8, W - 6, bottom - 6, 24, 1);
      a.step(dt, 0.5);
    }
    for (const f of fish) step(f, dt);
    // The snail and the crab on the sand.
    snail.f += dt * 1.5;
    snail.x += snail.dir * 2.2 * dt;
    if (snail.x < 10 || snail.x > W - 10) snail.dir = -snail.dir;
    crab.t -= dt;
    if (crab.claws > 0) crab.claws -= dt;
    if (crab.t <= 0) { crab.t = rng.range(1, 4); crab.dir = rng.chance(0.5) ? crab.dir : -crab.dir; if (rng.chance(0.3)) crab.claws = 1.2; }
    if (crab.t > 0.8 && crab.claws <= 0) { crab.x += crab.dir * 22 * opts.speed * dt; crab.walk += dt; }
    crab.x = clamp(crab.x, 12, W - 12);
  }

  function step(f: Swimmer, dt: number) {
    f.anim += dt * (f.hover > 0 ? 3 : 8);
    if (f.puff > 0) { f.puff -= dt; f.vx *= 0.95; f.vy = -4; f.x += f.vx * dt; f.y += f.vy * dt; f.y = clamp(f.y, top + 10, bottom - 8); return; }
    f.t -= dt;
    // Food first.
    if (!f.food && flakes.length && rng.chance(dt * 0.7)) f.food = flakes.find((q) => !q.eaten) || null;
    if (f.food) {
      const q = f.food;
      if (q.eaten) f.food = null;
      else {
        const dx = q.x - f.x, dy = q.y - f.y, d = Math.hypot(dx, dy);
        f.vx += ((dx / (d || 1)) * f.cruise * 1.6 - f.vx) * dt * 2;
        f.vy += ((dy / (d || 1)) * f.cruise * 1.2 - f.vy) * dt * 2;
        if (d < 5) { q.eaten = true; f.food = null; fx.add({ x: q.x, y: q.y, kind: 'ring', max: 0.3, c: '#d8f4ff', size: 1 }); }
      }
    } else if (f.hover > 0) {
      f.hover -= dt;
      f.vx *= Math.exp(-dt * 2); f.vy *= Math.exp(-dt * 2);
    } else {
      const wantY = (top + bottom) / 2 + noise1(time * 0.15, f.seed) * (bottom - top) * 0.4;
      f.vx += (f.face * f.cruise * opts.speed - f.vx) * dt * 1.2;
      f.vy += ((wantY - f.y) * 0.3 - f.vy) * dt;
      if (f.t <= 0) {
        f.t = rng.range(2, 6);
        const r = rng.next();
        if (r < 0.3) f.hover = rng.range(1, 3);
        else if (r < 0.45) f.face = (-f.face) as 1 | -1;
        else if (r < 0.55) { f.vx = f.face * f.cruise * 3; }
      }
    }
    f.x += f.vx * dt; f.y += f.vy * dt;
    const bw = FISH_BOX[f.kind].w / 2;
    if (f.x < bw + 4 && f.vx < 0) { f.face = 1; f.vx = Math.abs(f.vx) * 0.3; }
    if (f.x > W - bw - 4 && f.vx > 0) { f.face = -1; f.vx = -Math.abs(f.vx) * 0.3; }
    if (Math.abs(f.vx) > 3) f.face = f.vx > 0 ? 1 : -1;
    f.y = clamp(f.y, top + 10, bottom - 8);
  }

  function paw(x: number, y: number) {
    fx.burst(x, y, 5, ['#d8f4ff', '#ffffff'], { speed: 30, g: -30, max: 0.5 });
    for (const f of fish) {
      const d = dist(x, y, f.x, f.y);
      const r = FISH_BOX[f.kind].w * 0.45 + 4;
      if (d < r * opts.reach) {
        ctx.caught('fish', f.x, f.y, '#ffe08a');
        if (f.kind === 'puffer') { f.puff = 3; sfx.pop(); }
      }
      if (d < 70 && f.puff <= 0) { const a = Math.atan2(f.y - y, f.x - x); f.vx = Math.cos(a) * 90; f.vy = Math.sin(a) * 60; f.hover = 0; f.t = 1; }
    }
    for (const a of school) {
      const d = dist(x, y, a.x, a.y);
      if (d < 7 * opts.reach) ctx.caught('fish', a.x, a.y, '#9fe8ff');
      if (d < 60) { const an = Math.atan2(a.y - y, a.x - x); a.vx = Math.cos(an) * 120; a.vy = Math.sin(an) * 120; }
    }
    if (dist(x, y, crab.x, sand + 6) < 14) { crab.claws = 1.5; crab.dir = x < crab.x ? 1 : -1; crab.t = 2; if (dist(x, y, crab.x, sand + 6) < 10 * opts.reach) ctx.caught('crab', crab.x, sand + 2, '#ff9a7a'); }
  }

  function draw(g: CanvasRenderingContext2D) {
    blit(g, snailSprite(Math.floor(snail.f)), snail.x, sand + 4, 8, 10, snail.dir < 0);
    blit(g, crabSprite(Math.floor(crab.walk * 10), crab.claws > 0), crab.x, sand + 8, 10, 15);
    for (const q of flakes) { g.fillStyle = col(q.c); g.fillRect(Math.round(q.x), Math.round(q.y), 2, 1); }
    for (const a of school) blit(g, fishSprite('neon', Math.floor(time * 9 + a.seed) % 3), a.x, a.y, 6, 3, a.vx < 0);
    for (const f of fish) {
      const box = FISH_BOX[f.kind];
      blit(g, fishSprite(f.kind, Math.floor(f.anim) % 3, f.puff > 0), f.x, f.y, Math.floor(box.w / 2), Math.floor(box.h / 2), f.face < 0);
    }
  }

  return { update, draw, paw };
}

export const aquarium: SceneDef = {
  id: 'aquarium',
  name: { uk: 'Акваріум', en: 'Aquarium' },
  about: {
    uk: 'Зграйка неонів повертає як одна, риба-клоун, скалярія й півник пливуть кожна своїм темпом, крабик бігає боком. Торкнись риби-їжака, і вона надується.',
    en: 'A school of neons turns as one, a clownfish, an angelfish and a betta cruise at their own pace, a crab scuttles sideways. Touch the puffer and it blows up.',
  },
  energy: 0.3,
  locations: ['aquarium'],
  kind: 'fish',
  icon: 'fish',
  create,
};
