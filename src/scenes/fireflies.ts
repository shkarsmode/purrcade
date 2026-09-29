/**
 * Fireflies on a summer night. Dozens of them drift over the grass, each blinking on its own
 * rhythm — until now and then a wave of light runs across the whole field as they fall into step.
 * Near ones are bigger and slower-looking, far ones are single sparks. An owl sits on a branch
 * and turns its head; a hedgehog potters across the grass. The quietest scene of all.
 */
import type { SceneDef, SceneCtx, SceneInstance, Light } from '../game/types';
import { owlSprite, hedgehogSprite } from '../sprites/insects';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { shadow } from '../game/art';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { dist } from './util';

interface Bug { x: number; y: number; z: number; seed: number; ph: number; rate: number; lit: number; vx: number; vy: number; scare: number }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.65, H - 8];
  const n = Math.round(clamp(30 + opts.density * 26, 20, 80));
  const bugs: Bug[] = [];
  let time = 0;
  let wave = rng.range(12, 25);
  let waveX = 0, waveOn = false;
  const perch = (loc.perches || []).filter((p) => p.y < H * 0.5 && p.x1 - p.x0 > 20);
  const owl = perch.length && rng.chance(0.85) ? { p: rng.pick(perch), x: 0, f: 1, t: 2, hoot: rng.range(8, 20) } : null;
  if (owl) owl.x = rng.range(owl.p.x0 + 6, owl.p.x1 - 6);
  let hog: { x: number; y: number; dir: number; t: number; walk: number; stop: number } | null = null;
  let nextHog = rng.range(10, 30);

  for (let i = 0; i < n; i++) {
    const z = Math.pow(rng.next(), 1.6);             // 0 far … 1 near
    bugs.push({ x: rng.range(0, W), y: rng.range(H * 0.2, band[1]), z, seed: rng.range(0, 100), ph: rng.range(0, 1), rate: rng.range(0.3, 0.7), lit: 0, vx: 0, vy: 0, scare: 0 });
  }

  function update(dt: number) {
    time += dt;
    wave -= dt;
    if (wave <= 0) { wave = rng.range(15, 35); waveX = -40; waveOn = true; }
    if (waveOn) { waveX += dt * W * 0.45; if (waveX > W + 60) waveOn = false; }
    for (const b of bugs) {
      const sp = (4 + b.z * 8) * opts.speed;
      b.vx += (noise1(time * 0.3, b.seed) * sp - b.vx) * dt;
      b.vy += (noise1(time * 0.27, b.seed + 50) * sp * 0.6 - 1 - b.vy) * dt;
      if (b.scare > 0) { b.scare -= dt; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -10) b.x = W + 8; if (b.x > W + 10) b.x = -8;
      if (b.y < H * 0.12) b.vy += 10 * dt;
      if (b.y > band[1]) b.vy -= 12 * dt;
      // Blink: a quick flash, then dark; or lit by the passing wave.
      b.ph += dt * b.rate;
      const p = b.ph % 1;
      // A slow swell and fade, the way a firefly's light breathes.
      let lit = p < 0.34 ? Math.pow(Math.sin((p / 0.34) * Math.PI), 1.5) : 0;
      if (waveOn && Math.abs(b.x - waveX) < 22) lit = Math.max(lit, 1 - Math.abs(b.x - waveX) / 22);
      if (b.scare > 0) lit = Math.max(lit, Math.min(1, b.scare * 2));
      b.lit = lit;
    }
    if (owl) {
      owl.t -= dt;
      if (owl.t <= 0) {
        owl.t = rng.range(1, 3.5);
        const r = rng.next();
        owl.f = r < 0.35 ? 0 : r < 0.7 ? 2 : r < 0.85 ? 1 : 3;
        if (owl.f === 3) owl.t = 0.2;
      }
      owl.hoot -= dt;
      if (owl.hoot <= 0) { owl.hoot = rng.range(15, 30); ctx.fx.text(owl.x + 10, owl.p.y - 26, '♪ ♪', '#dfe6ff'); }
    }
    nextHog -= dt;
    if (!hog && nextHog <= 0) { const d = rng.sign(); hog = { x: d > 0 ? -20 : W + 20, y: rng.range(band[0] + 10, band[1] - 4), dir: d, t: 0, walk: 0, stop: rng.range(2, 5) }; }
    if (hog) {
      hog.t += dt;
      hog.stop -= dt;
      if (hog.stop > 0 || hog.stop < -1.5) { hog.x += hog.dir * 14 * opts.speed * dt; hog.walk += dt; if (hog.stop < -1.5) hog.stop = rng.range(2, 6); }
      if (hog.x < -30 || hog.x > W + 30) { hog = null; nextHog = rng.range(25, 50); }
    }
  }

  function paw(x: number, y: number) {
    for (const b of bugs) {
      const d = dist(x, y, b.x, b.y);
      if (d < (6 + b.z * 5) * opts.reach && b.lit > 0.2) ctx.caught('firefly', b.x, b.y, '#f4ff9a');
      if (d < 60) { b.scare = 0.8; b.vx += (b.x - x) * 0.8; b.vy -= 20; }
    }
    if (hog && dist(x, y, hog.x, hog.y - 6) < 30) { hog.stop = 3; ctx.fx.add({ x: hog.x, y: hog.y - 16, kind: 'heart', c: '#ff8fa3', vy: -10, max: 1 }); }
  }

  function draw(g: CanvasRenderingContext2D) {
    if (owl) blit(g, owlSprite(owl.f), owl.x, owl.p.y + 1, 9, 21);
    if (hog) {
      shadow(g, hog.x, hog.y, 20, 3, 0.25);
      blit(g, hedgehogSprite(hog.stop > 0 || hog.stop < -1.5 ? Math.floor(hog.walk * 6) : 0), hog.x, hog.y, 12, 14, hog.dir < 0);
    }
  }

  function drawGlow(g: CanvasRenderingContext2D) {
    // The fireflies themselves: a dark speck when unlit, a bright core when lit.
    for (const b of bugs) {
      const X = Math.round(b.x), Y = Math.round(b.y);
      const big = b.z > 0.6;
      if (b.lit < 0.05) {
        if (big) { g.fillStyle = col('#2a2a1a'); g.fillRect(X, Y, 1, 1); }
        continue;
      }
      g.globalAlpha = Math.min(1, b.lit * 1.2);
      g.fillStyle = col(b.lit > 0.7 ? '#fbffd0' : '#d8ff7a');
      g.fillRect(X, Y, big ? 2 : 1, big ? 2 : 1);
      if (big && b.lit > 0.5) { g.fillStyle = col('#b8f04a'); g.fillRect(X - 1, Y, 1, 1); g.fillRect(X + 2, Y + 1, 1, 1); g.fillRect(X, Y - 1, 1, 1); g.fillRect(X + 1, Y + 2, 1, 1); }
    }
    g.globalAlpha = 1;
  }

  function lights(): Light[] {
    const out: Light[] = [];
    for (const b of bugs) if (b.lit > 0.15) out.push({ x: b.x, y: b.y, r: Math.round(4 + b.z * 7), c: '#c8ff5a', a: b.lit * (0.8 + b.z * 0.6) });
    return out;
  }

  return { update, draw, drawGlow, paw, lights };
}

export const fireflies: SceneDef = {
  id: 'fireflies',
  name: { uk: 'Світлячки', en: 'Fireflies' },
  about: {
    uk: 'Нічне поле світлячків, що мерехтять кожен у своєму ритмі, аж поки по всьому полю не пробіжить хвиля світла. На гілці сова, у траві їжачок.',
    en: 'A night field of fireflies blinking to their own rhythm, until a wave of light runs across them all. An owl on a branch, a hedgehog in the grass.',
  },
  energy: 0.2,
  locations: ['forest', 'meadow', 'garden', 'park'],
  tods: ['night', 'dusk'],
  kind: 'firefly',
  icon: 'firefly',
  create,
};
