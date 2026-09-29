/**
 * The shoreline. Crabs scuttle sideways in quick bursts, stop, raise their claws, and dive into
 * their holes; sandpipers run down the wet sand after each wave as it slides back and race up
 * the beach ahead of the next one, pecking as they go; gulls stroll, stand on the posts, and
 * glide out over the sea. The waves themselves keep the whole beach moving.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { crabSprite } from '../sprites/fish';
import { gullSprite, piperSprite } from '../sprites/bird';
import { blit } from '../core/pix';
import { shadow } from '../game/art';
import { clamp } from '../core/rng';
import { depthDraw, dist, type Drawable } from './util';
import type { Coast } from '../world/coast';

interface Crab { x: number; y: number; dir: number; t: number; st: 'walk' | 'stop' | 'claws' | 'hide' | 'gone'; walk: number; hole: number; c: string }
interface Piper { x: number; y: number; face: 1 | -1; run: number; peck: number; t: number }
interface Gull { x: number; y: number; face: 1 | -1; st: 'stand' | 'walk' | 'fly' | 'post'; t: number; tx: number; ty: number; f: number; fx: number; fy: number; fp: number; fd: number; post: number }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, fx, sfx, opts, W, H } = ctx;
  const coast = ctx.loc as Coast;
  const band: [number, number] = coast.floorBand || [H * 0.64, H - 6];
  const wash = coast.wash || (() => band[0]);
  const holes = coast.holes || [];
  const posts = coast.perches || [];
  let time = 0;
  const crabs: Crab[] = [];
  for (let i = 0; i < Math.round(2 + opts.density * 2); i++) {
    const h = holes.length ? rng.int(0, holes.length - 1) : -1;
    crabs.push({ x: h >= 0 ? holes[h].x : rng.range(W * 0.1, W * 0.9), y: h >= 0 ? holes[h].y : rng.range(band[0] + 10, band[1]), dir: rng.sign(), t: rng.range(0.5, 3), st: 'gone', walk: 0, hole: h, c: rng.pick(['#e8543a', '#f08a3a', '#d84a6a']) });
  }
  const pipers: Piper[] = [];
  for (let i = 0; i < Math.round(2 + opts.density * 1.5); i++) pipers.push({ x: rng.range(W * 0.1, W * 0.6), y: 0, face: 1, run: rng.range(0, 2), peck: 0, t: 0 });
  const gulls: Gull[] = [];
  for (let i = 0; i < Math.round(1 + opts.density); i++) {
    const g: Gull = { x: rng.range(W * 0.1, W * 0.9), y: rng.range(band[0] + 30, band[1] - 4), face: rng.chance(0.5) ? 1 : -1, st: 'stand', t: rng.range(1, 4), tx: 0, ty: 0, f: 0, fx: 0, fy: 0, fp: 0, fd: 1, post: -1 };
    gulls.push(g);
  }

  function fly(g: Gull, x: number, y: number, post = -1) {
    g.st = 'fly'; g.fx = g.x; g.fy = g.y; g.tx = x; g.ty = y; g.fp = 0; g.post = post;
    g.fd = Math.max(1.5, dist(g.x, g.y, x, y) / 70);
    g.face = x > g.x ? 1 : -1;
    if (rng.chance(0.5)) sfx.chirp(1);
  }

  function update(dt: number) {
    time += dt;
    const edge = wash(time);
    for (const c of crabs) {
      c.t -= dt;
      switch (c.st) {
        case 'gone':
          if (c.t <= 0) { c.st = 'stop'; c.t = rng.range(0.6, 1.5); if (c.hole >= 0) { c.x = holes[c.hole].x; c.y = holes[c.hole].y; } fx.burst(c.x, c.y, 4, ['#d8b47a', '#c8a068'], { speed: 20, g: 60, max: 0.4 }); }
          break;
        case 'walk':
          c.x += c.dir * 34 * opts.speed * dt; c.walk += dt;
          // The wave coming up: run from it.
          if (c.y < edge + 6) c.y += 30 * dt;
          if (c.x < 8 || c.x > W - 8) c.dir = -c.dir;
          if (c.t <= 0) { c.st = rng.chance(0.3) ? 'claws' : 'stop'; c.t = rng.range(0.4, 1.4); }
          break;
        case 'stop':
        case 'claws':
          if (c.y < edge + 4) { c.st = 'walk'; c.t = 0.6; break; }
          if (c.t <= 0) {
            const r = rng.next();
            if (r < 0.2 && holes.length) { c.st = 'hide'; c.hole = holes.reduce((b, h, i) => (dist(h.x, h.y, c.x, c.y) < dist(holes[b].x, holes[b].y, c.x, c.y) ? i : b), 0); c.t = 3; }
            else { c.st = 'walk'; c.t = rng.range(0.3, 1.2); c.dir = rng.chance(0.6) ? c.dir : -c.dir; c.y = clamp(c.y + rng.range(-6, 6), band[0] + 6, band[1] - 2); }
          }
          break;
        case 'hide': {
          const h = holes[c.hole];
          const dx = h.x - c.x, dy = h.y - c.y, d = Math.hypot(dx, dy);
          const s = Math.min(d, 50 * dt);
          c.x += (dx / (d || 1)) * s; c.y += (dy / (d || 1)) * s; c.walk += dt;
          if (d < 1 || c.t <= 0) { c.st = 'gone'; c.t = rng.range(2, 6); }
          break;
        }
      }
    }
    // Sandpipers keep just ahead of the water: down after it, up away from it.
    for (const p of pipers) {
      p.t += dt;
      const want = edge + 3 + Math.sin(p.t * 0.7 + p.run * 3) * 2;
      if (p.y === 0) p.y = want;
      const dy = want - p.y;
      if (Math.abs(dy) > 1.5) { p.y += clamp(dy, -60 * dt, 60 * dt); p.run += dt * 12; p.peck = 0; }
      else if (p.peck <= 0 && rng.chance(dt * 1.5)) p.peck = rng.range(0.3, 0.8);
      if (p.peck > 0) p.peck -= dt;
      p.x += Math.sin(p.t * 0.3 + p.run) * 6 * dt;
      p.x = clamp(p.x, 10, W * 0.62);
      p.face = Math.sin(p.t * 0.3 + p.run) > 0 ? 1 : -1;
    }
    for (const g of gulls) {
      g.f += dt;
      if (g.st === 'fly') {
        g.fp = Math.min(1, g.fp + dt / g.fd);
        const k = g.fp;
        g.x = g.fx + (g.tx - g.fx) * k; g.y = g.fy + (g.ty - g.fy) * k - Math.sin(k * Math.PI) * 50;
        if (k >= 1) { g.st = g.post >= 0 ? 'post' : g.tx < -20 || g.tx > W + 20 ? 'stand' : 'stand'; g.t = rng.range(3, 8); if (g.tx < -20 || g.tx > W + 20) { g.x = g.tx < 0 ? -30 : W + 30; fly(g, rng.range(W * 0.2, W * 0.8), rng.range(band[0] + 30, band[1] - 4)); } }
        continue;
      }
      g.t -= dt;
      if (g.st === 'walk') { g.x += g.face * 12 * dt; if (g.x < 10 || g.x > W - 10) g.face = (-g.face) as 1 | -1; }
      if (g.t <= 0) {
        g.t = rng.range(2, 6);
        const r = rng.next();
        if (g.st === 'post' || r < 0.2) {
          if (rng.chance(0.4) && posts.length) { const pi = rng.int(0, posts.length - 1); if (!gulls.some((o) => o !== g && o.post === pi && o.st === 'post')) { fly(g, (posts[pi].x0 + posts[pi].x1) / 2, posts[pi].y, pi); continue; } }
          fly(g, rng.range(W * 0.1, W * 0.9), rng.range(band[0] + 30, band[1] - 4));
        } else if (r < 0.55) { g.st = 'walk'; g.face = rng.chance(0.5) ? 1 : -1; }
        else { g.st = 'stand'; if (rng.chance(0.4)) g.face = (-g.face) as 1 | -1; }
      }
    }
  }

  function paw(x: number, y: number) {
    for (const c of crabs) {
      if (c.st === 'gone') continue;
      const d = dist(x, y, c.x, c.y - 5);
      if (d < 11 * opts.reach) ctx.caught('crab', c.x, c.y - 5, '#ff9a7a');
      if (d < 60) { c.st = holes.length && rng.chance(0.6) ? 'hide' : 'walk'; c.dir = c.x > x ? 1 : -1; c.t = c.st === 'hide' ? 3 : 1.2; if (c.st === 'hide') c.hole = holes.reduce((b, h, i) => (dist(h.x, h.y, c.x, c.y) < dist(holes[b].x, holes[b].y, c.x, c.y) ? i : b), 0); }
    }
    for (const p of pipers) {
      const d = dist(x, y, p.x, p.y - 6);
      if (d < 9 * opts.reach) ctx.caught('bird', p.x, p.y - 6, '#ffffff');
      if (d < 50) { p.x = clamp(p.x + (p.x > x ? 40 : -40), 10, W * 0.62); p.run += 3; }
    }
    for (const g of gulls) {
      if (g.st === 'fly') continue;
      const d = dist(x, y, g.x, g.y - 10);
      if (d < 14 * opts.reach) ctx.caught('bird', g.x, g.y - 10, '#ffffff');
      if (d < 80) fly(g, g.x < W / 2 ? W + 40 : -40, rng.range(10, H * 0.3));
    }
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    const items: Drawable[] = [];
    for (const c of crabs) {
      if (c.st === 'gone') continue;
      items.push({ y: c.y, draw: () => { shadow(g, c.x, c.y, 16, 3, 0.22); blit(g, crabSprite(Math.floor(c.walk * 12), c.st === 'claws', c.c), c.x, c.y, 10, 15); } });
    }
    for (const p of pipers) items.push({ y: p.y, draw: () => { shadow(g, p.x, p.y, 8, 2, 0.2); blit(g, piperSprite(p.peck > 0 ? 'peck' : Math.abs(p.run % 1) > 0.02 ? 'run' : 'stand', Math.floor(p.run * 2)), p.x, p.y, 9, 14, p.face < 0); } });
    for (const gl of gulls) {
      if (gl.st === 'fly') continue;
      if (gl.st === 'post') { blit(g, gullSprite('stand'), gl.x, gl.y, 17, 23, gl.face < 0); continue; }
      items.push({ y: gl.y, draw: () => { shadow(g, gl.x, gl.y, 20, 3, 0.22); blit(g, gullSprite(gl.st === 'walk' ? 'walk' : 'stand', Math.floor(gl.f * 4)), gl.x, gl.y, 17, 23, gl.face < 0); } });
    }
    depthDraw(g, t, items, coast.props);
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const gl of gulls) {
      if (gl.st !== 'fly') continue;
      const glide = Math.sin(gl.f * 1.3) > 0.2;
      blit(g, gullSprite(glide ? 'glide' : 'fly', Math.floor(gl.f * 10)), gl.x, gl.y, 17, 12, gl.face < 0);
    }
  }

  return { update, draw, drawTop, paw };
}

export const beachScene: SceneDef = {
  id: 'beach',
  name: { uk: 'Морський берег', en: 'Seashore' },
  about: {
    uk: 'Крабики бігають боком і ховаються в нірки, кулики бігають за хвилею й тікають від неї, чайки ходять берегом і ширяють над морем.',
    en: 'Crabs scuttle sideways into their holes, sandpipers chase each wave down and run from the next, gulls stroll and glide over the sea.',
  },
  energy: 0.5,
  locations: ['beach'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'crab',
  icon: 'crab',
  create,
};
