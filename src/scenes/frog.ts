/**
 * The frog on the lily pad. It sits dead still with its eyes on the flies buzzing over the
 * water, and when one strays close enough — snap — the tongue is out and back and the fly is
 * gone. Now and then it puffs its throat and croaks, or leaps to another pad with a splash.
 * Dragonflies dash and hover, pond skaters flick across the surface, and every so often a fish
 * jumps clean out of the water.
 */
import type { SceneDef, SceneCtx, SceneInstance, Ledge } from '../game/types';
import { frogSprite } from '../sprites/critters';
import { fishSprite } from '../sprites/fish';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { dist } from './util';

interface Fly { x: number; y: number; vx: number; vy: number; seed: number; alive: boolean; t: number }
interface Skater { x: number; y: number; vx: number; t: number }
interface Dragon { x: number; y: number; tx: number; ty: number; t: number; hover: number; face: 1 | -1 }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const [waterY] = loc.water || [H * 0.6, H];
  const pads: Ledge[] = (loc.perches || []).filter((l) => l.y > waterY - 6);
  let time = 0;
  const home = pads.length ? rng.pick(pads) : { x0: W * 0.4, x1: W * 0.5, y: waterY + 20 };
  const frog = { x: (home.x0 + home.x1) / 2, y: home.y, face: 1 as 1 | -1, st: 'sit' as 'sit' | 'croak' | 'tongue' | 'jump', t: 1, pad: home, tx: 0, ty: 0, tl: 0, target: null as Fly | null, jx0: 0, jy0: 0, jt: 0, jd: 0.5, next: rng.range(6, 14), croak: rng.range(5, 12) };
  const flies: Fly[] = [];
  const nFly = Math.round(clamp(3 + opts.density * 3, 3, 9));
  const spawnFly = (): Fly => ({ x: rng.chance(0.5) ? -6 : W + 6, y: rng.range(waterY - 60, waterY + 10), vx: 0, vy: 0, seed: rng.range(0, 99), alive: true, t: 0 });
  for (let i = 0; i < nFly; i++) { const f = spawnFly(); f.x = rng.range(0, W); flies.push(f); }
  const skaters: Skater[] = [];
  for (let i = 0; i < 3; i++) skaters.push({ x: rng.range(W * 0.2, W * 0.8), y: rng.range(waterY + 8, H - 10), vx: 0, t: rng.range(0.5, 2) });
  const dragons: Dragon[] = [{ x: rng.range(0, W), y: waterY - 40, tx: 0, ty: 0, t: 0, hover: 0, face: 1 }];
  let jumpFish: { x: number; y0: number; t: number; dir: number } | null = null;
  let nextFish = rng.range(6, 14);

  function leap(to: Ledge) {
    frog.st = 'jump'; frog.jx0 = frog.x; frog.jy0 = frog.y; frog.jt = 0;
    frog.tx = rng.range(to.x0 + 3, to.x1 - 3); frog.ty = to.y; frog.pad = to;
    frog.jd = clamp(dist(frog.x, frog.y, frog.tx, frog.ty) / 180, 0.35, 0.8);
    frog.face = frog.tx > frog.x ? 1 : -1;
    splash(frog.x, frog.y, 6);
  }

  function splash(x: number, y: number, n: number) {
    fx.add({ x, y: y + 1, kind: 'ring', max: 0.6, c: '#d8f4ff', size: 3 });
    fx.burst(x, y, n, ['#d8f4ff', '#ffffff', '#8fd0e8'], { speed: 50, up: 30, g: 180, max: 0.6 });
    sfx.plop();
  }

  function update(dt: number) {
    time += dt;
    // Flies: fast, twitchy, never straight for long.
    for (const f of flies) {
      if (!f.alive) { f.t -= dt; if (f.t <= 0) Object.assign(f, spawnFly()); continue; }
      const sp = 70 * opts.speed;
      f.vx += (noise1(time * 3, f.seed) * sp - f.vx) * dt * 6;
      f.vy += (noise1(time * 3.3, f.seed + 7) * sp * 0.7 - f.vy) * dt * 6;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 8) f.vx += 90 * dt; if (f.x > W - 8) f.vx -= 90 * dt;
      if (f.y < waterY - 80) f.vy += 60 * dt; if (f.y > waterY + 20) f.vy -= 60 * dt;
    }
    // The frog.
    frog.t -= dt;
    switch (frog.st) {
      case 'sit': {
        let best: Fly | null = null, bd = Infinity;
        for (const f of flies) { if (!f.alive) continue; const d = dist(f.x, f.y, frog.x + frog.face * 10, frog.y - 8); if (d < bd) { bd = d; best = f; } }
        if (best) frog.face = best.x > frog.x ? 1 : -1;
        if (best && bd < 42 && frog.t <= 0) { frog.st = 'tongue'; frog.target = best; frog.tl = 0; frog.t = 0.3; sfx.snap(); break; }
        frog.next -= dt; frog.croak -= dt;
        if (frog.croak <= 0) { frog.croak = rng.range(6, 14); frog.st = 'croak'; frog.t = 1.2; fx.text(frog.x + frog.face * 8, frog.y - 22, '♪', '#ffffff'); sfx.croak(); break; }
        if (frog.next <= 0 && pads.length > 1) { frog.next = rng.range(7, 16); leap(rng.pick(pads.filter((p) => p !== frog.pad))); }
        break;
      }
      case 'croak':
        if (frog.t <= 0) { frog.st = 'sit'; frog.t = 0.4; }
        break;
      case 'tongue': {
        frog.tl += dt;
        const f = frog.target;
        if (f && f.alive && frog.tl > 0.08) { f.alive = false; f.t = rng.range(1, 3); fx.add({ x: frog.x + frog.face * 12, y: frog.y - 10, kind: 'heart', c: '#8fe070', vy: -12, max: 0.7 }); }
        if (frog.t <= 0) { frog.st = 'sit'; frog.t = rng.range(0.6, 1.5); frog.target = null; }
        break;
      }
      case 'jump': {
        frog.jt += dt;
        const k = Math.min(1, frog.jt / frog.jd);
        frog.x = frog.jx0 + (frog.tx - frog.jx0) * k;
        frog.y = frog.jy0 + (frog.ty - frog.jy0) * k - Math.sin(k * Math.PI) * 34;
        if (k >= 1) { frog.st = 'sit'; frog.t = 0.8; splash(frog.x, frog.y, 8); }
        break;
      }
    }
    // Pond skaters: a flick, a glide, a stop.
    for (const s of skaters) {
      s.t -= dt;
      s.x += s.vx * dt; s.vx *= Math.exp(-dt * 3);
      if (s.t <= 0) { s.t = rng.range(0.4, 1.8); s.vx = rng.sign() * rng.range(40, 90); fx.add({ x: s.x, y: s.y + 1, kind: 'ring', max: 0.35, c: '#d8f4ff', size: 1 }); }
      if (s.x < 10 || s.x > W - 10) s.vx = -s.vx;
    }
    // Dragonflies: a dash, a hover.
    for (const d of dragons) {
      d.t -= dt;
      if (d.hover > 0) { d.hover -= dt; d.x += Math.sin(time * 20) * 0.3; }
      else {
        const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy);
        if (dd < 3 || d.t <= 0) { d.hover = rng.range(0.4, 1.6); d.tx = rng.range(20, W - 20); d.ty = rng.range(waterY - 70, waterY - 10); d.t = 2; }
        else { const s = Math.min(dd, 200 * dt); d.x += (dx / dd) * s; d.y += (dy / dd) * s; d.face = dx > 0 ? 1 : -1; }
      }
    }
    // A fish jumps now and then.
    nextFish -= dt;
    if (!jumpFish && nextFish <= 0) { nextFish = rng.range(8, 20); jumpFish = { x: rng.range(W * 0.25, W * 0.75), y0: rng.range(waterY + 14, H - 14), t: 0, dir: rng.sign() }; splash(jumpFish.x, jumpFish.y0, 5); }
    if (jumpFish) { jumpFish.t += dt; if (jumpFish.t > 0.8) { splash(jumpFish.x + jumpFish.dir * 30, jumpFish.y0, 7); jumpFish = null; } }
  }

  function paw(x: number, y: number) {
    if (y > waterY) { fx.add({ x, y, kind: 'ring', max: 0.7, c: '#e8fbff', size: 4 }); sfx.plop(); }
    if (frog.st !== 'jump' && dist(x, y, frog.x, frog.y - 8) < 16 * opts.reach) {
      ctx.caught('frog', frog.x, frog.y - 8, '#8fe070');
      const others = pads.filter((p) => p !== frog.pad);
      if (others.length) leap(others.reduce((b, p) => (Math.abs((p.x0 + p.x1) / 2 - x) > Math.abs((b.x0 + b.x1) / 2 - x) ? p : b)));
    }
    for (const f of flies) if (f.alive && dist(x, y, f.x, f.y) < 8 * opts.reach) { f.alive = false; f.t = rng.range(1, 2); ctx.caught('bug', f.x, f.y, '#c8ff9a'); }
    for (const s of skaters) if (dist(x, y, s.x, s.y) < 50) { s.vx = (s.x > x ? 1 : -1) * 120; s.t = 1; }
    for (const d of dragons) if (dist(x, y, d.x, d.y) < 12 * opts.reach) { ctx.caught('bug', d.x, d.y, '#9fe8ff'); d.hover = 0; d.tx = rng.range(20, W - 20); d.ty = waterY - 80; }
  }

  function draw(g: CanvasRenderingContext2D) {
    // Skaters on the surface.
    for (const s of skaters) {
      const X = Math.round(s.x), Y = Math.round(s.y);
      g.fillStyle = col('#2a2430'); g.fillRect(X - 1, Y - 1, 3, 1);
      g.fillStyle = col('#4a4452'); for (const [dx, dy] of [[-4, 0], [4, 0], [-3, -2], [3, -2], [-2, 1], [2, 1]]) g.fillRect(X + dx, Y + dy, 1, 1);
    }
    // The jumping fish, and the frog.
    if (jumpFish) {
      const k = jumpFish.t / 0.8;
      blit(g, fishSprite('gold', Math.floor(time * 10) % 3), jumpFish.x + jumpFish.dir * 30 * k, jumpFish.y0 - Math.sin(k * Math.PI) * 30, 10, 6, jumpFish.dir < 0);
    }
    const hy = frog.st === 'jump' ? frog.y : frog.y + 1;
    blit(g, frogSprite(frog.st === 'croak' ? 'croak' : frog.st === 'tongue' ? 'tongue' : frog.st === 'jump' ? 'jump' : 'sit', Math.floor(time * 5)), frog.x, hy, 13, 17, frog.face < 0);
    if (frog.st === 'tongue') {
      // The tongue: out to where the fly was, then back.
      const k = frog.tl < 0.08 ? frog.tl / 0.08 : Math.max(0, 1 - (frog.tl - 0.08) / 0.18);
      const mx = frog.x + frog.face * 11, my = frog.y - 9;
      const tx = frog.target ? frog.target.x : mx + frog.face * 30, ty = frog.target ? frog.target.y : my;
      const ex = mx + (tx - mx) * k, ey = my + (ty - my) * k;
      g.fillStyle = col('#ff7a9a');
      const n = Math.max(1, Math.round(dist(mx, my, ex, ey)));
      for (let i = 0; i <= n; i++) g.fillRect(Math.round(mx + ((ex - mx) * i) / n), Math.round(my + ((ey - my) * i) / n), 1, 2);
      g.fillStyle = col('#ffb0c0'); g.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
    }
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const f of flies) {
      if (!f.alive) continue;
      const X = Math.round(f.x), Y = Math.round(f.y);
      g.fillStyle = col('#1a1420'); g.fillRect(X, Y, 2, 2);
      g.globalAlpha = 0.6; g.fillStyle = col('#e8f4ff');
      if (Math.floor(time * 30) % 2) { g.fillRect(X - 1, Y - 1, 1, 1); g.fillRect(X + 2, Y - 1, 1, 1); } else { g.fillRect(X, Y - 1, 2, 1); }
      g.globalAlpha = 1;
    }
    for (const d of dragons) {
      const X = Math.round(d.x), Y = Math.round(d.y);
      g.fillStyle = col('#2a8ad0'); g.fillRect(X - d.face * 8, Y, 12, 1); g.fillRect(X + (d.face > 0 ? 3 : -5), Y - 1, 3, 3);
      g.fillStyle = col('#7ad05a'); g.fillRect(X + (d.face > 0 ? 5 : -5), Y - 1, 1, 1);
      g.globalAlpha = 0.55; g.fillStyle = col('#e8f8ff');
      const up = Math.floor(time * 34) % 2 ? -1 : 0;
      g.fillRect(X - 5, Y - 3 + up, 5, 2); g.fillRect(X + 1, Y - 3 - up, 5, 2);
      g.globalAlpha = 1;
    }
  }

  return { update, draw, drawTop, paw };
}

export const frog: SceneDef = {
  id: 'frog',
  name: { uk: 'Жабка на лататті', en: 'Frog on a lily pad' },
  about: {
    uk: 'Жабка стежить за мухами й хап! ловить їх язиком, квакає, перестрибує з листка на листок. Бабки шугають, водомірки ковзають, риба вистрибує з води.',
    en: 'A frog watches the flies and snap! catches them with its tongue, croaks, hops from pad to pad. Dragonflies dart, skaters glide, a fish leaps.',
  },
  energy: 0.5,
  locations: ['pond'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'frog',
  icon: 'frog',
  create,
};
