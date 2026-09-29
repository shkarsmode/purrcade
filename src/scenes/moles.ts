/**
 * Who's in the hole? Moles pop up out of a field of holes, look about, twitch their pink noses,
 * sometimes come up holding a flower, sometimes only half up and straight back down to tease;
 * now and then a rabbit comes up ears first, and very rarely a golden mole. A paw on one that is
 * up bonks it — stars go round its head — and it sinks away. The clearest game here for a cat
 * with a tablet under its paws.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { popperSprite, holeBack, holeFront, POP, type Popper, type PopFace } from '../sprites/critters';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { dist, tinyStar } from './util';

type St = 'down' | 'rise' | 'up' | 'sink' | 'bonk' | 'tease';

interface Hole {
  x: number; y: number;
  who: Popper; face: PopFace;
  st: St; t: number; k: number;    // k: 0 hidden … 1 fully out
  wait: number; look: number;
}

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.7, H - 8];
  const holes: Hole[] = [];
  const rows = band[1] - band[0] > 70 ? 3 : 2;
  const cols = clamp(Math.floor(W / 110), 3, 5);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = W * ((c + 0.5 + (r % 2 ? 0.25 : -0.1)) / cols);
      const y = band[0] + 18 + ((band[1] - band[0] - 24) * (r + 0.5)) / rows;
      if (x < 20 || x > W - 20) continue;
      holes.push({ x: Math.round(x), y: Math.round(y), who: 'mole', face: 'up', st: 'down', t: 0, k: 0, wait: rng.range(0.5, 4), look: 0 });
    }
  }
  const up = () => holes.filter((h) => h.st !== 'down').length;
  const maxUp = Math.round(clamp(1 + opts.intensity * 2 + (opts.density - 1), 1, 4));
  let time = 0;

  function pop(h: Hole) {
    const r = rng.next();
    h.who = r < 0.04 ? 'gold' : r < 0.2 ? 'bunny' : 'mole';
    h.face = rng.chance(0.15) ? 'flower' : 'up';
    h.st = rng.chance(0.18) ? 'tease' : 'rise';
    h.t = 0; h.look = rng.range(0.3, 0.8);
    fx.burst(h.x, h.y - 2, 4, ['#8a6a4a', '#6a4a2a'], { speed: 26, g: 90, max: 0.45 });
    sfx.boing();
  }

  function update(dt: number) {
    time += dt;
    const speed = opts.speed * (0.8 + opts.intensity * 0.5);
    for (const h of holes) {
      h.t += dt;
      switch (h.st) {
        case 'down':
          h.wait -= dt;
          if (h.wait <= 0) { if (up() < maxUp) pop(h); else h.wait = rng.range(0.3, 1); }
          break;
        case 'rise':
          h.k = Math.min(1, h.k + dt * 5 * speed);
          if (h.k >= 1) { h.st = 'up'; h.t = 0; h.wait = rng.range(0.9, 2.6) / speed; if (h.who === 'mole' && rng.chance(0.3)) sfx.squeak(); }
          break;
        case 'tease':
          // Half up, and straight back down.
          h.k = h.t < 0.3 ? Math.min(0.45, h.k + dt * 5) : Math.max(0, h.k - dt * 7);
          if (h.t > 0.3 && h.k <= 0) { h.st = 'rise'; h.t = 0; if (rng.chance(0.5)) { h.st = 'down'; h.wait = rng.range(0.4, 1.5); } }
          break;
        case 'up':
          h.look -= dt;
          if (h.look <= 0 && h.face !== 'flower') { h.look = rng.range(0.3, 0.8); h.face = rng.pick<PopFace>(['up', 'left', 'right', 'up']); }
          if (h.t >= h.wait) { h.st = 'sink'; h.t = 0; }
          break;
        case 'sink':
          h.k = Math.max(0, h.k - dt * 7 * speed);
          if (h.k <= 0) { h.st = 'down'; h.wait = rng.range(0.6, 3.5) / speed; }
          break;
        case 'bonk':
          if (h.t > 0.9) h.k = Math.max(0, h.k - dt * 2.5);
          if (h.k <= 0) { h.st = 'down'; h.wait = rng.range(1.5, 4); }
          break;
      }
    }
  }

  function paw(x: number, y: number) {
    let hit = false;
    for (const h of holes) {
      if (h.st === 'down' || h.st === 'bonk' || h.k < 0.35) continue;
      const hy = h.y - 12 * h.k;
      if (dist(x, y, h.x, hy) < 15 * opts.reach) {
        hit = true;
        h.st = 'bonk'; h.t = 0; h.face = 'dizzy';
        ctx.caught(h.who === 'gold' ? 'gold' : 'mole', h.x, hy - 8, h.who === 'gold' ? '#ffd23f' : '#ffe066');
        if (h.who === 'gold') fx.text(h.x, hy - 26, '★', '#ffd23f');
        sfx.squeak();
      } else if (dist(x, y, h.x, hy) < 40 && h.st === 'up') {
        h.st = 'sink'; h.t = 0;
      }
    }
    if (!hit) fx.burst(x, y, 5, ['#8a6a4a', '#6a4a2a', '#4f9a3e'], { speed: 30, g: 100, max: 0.4 });
  }

  function draw(g: CanvasRenderingContext2D) {
    const back = holeBack(), front = holeFront();
    const order = holes.slice().sort((a, b) => a.y - b.y);
    for (const h of order) {
      g.drawImage(back, h.x - 15, h.y - 8);
      if (h.k > 0) {
        const img = popperSprite(h.who, h.face);
        const rise = Math.round(h.k * (h.who === 'bunny' ? 24 : 21));
        // Only what is above the rim shows.
        g.save();
        g.beginPath();
        g.rect(h.x - 16, h.y - 60, 32, 60 - 1);
        g.clip();
        g.drawImage(img, h.x - POP.ax, h.y - 1 + (POP.h - rise) - POP.h);
        g.restore();
        if (h.st === 'bonk') {
          for (let i = 0; i < 3; i++) {
            const a = time * 6 + (i * Math.PI * 2) / 3;
            tinyStar(g, h.x + Math.cos(a) * 9, h.y - rise + 2 + Math.sin(a) * 2.5, col(i === 1 ? '#ffffff' : '#ffe066'));
          }
        }
        if (h.who === 'gold' && Math.floor(time * 8) % 3 === 0) { g.fillStyle = col('#fff6c0'); g.fillRect(h.x + Math.round(Math.sin(time * 5) * 10), h.y - rise + 4, 1, 1); }
      }
      g.drawImage(front, h.x - 15, h.y - 8);
    }
  }

  return { update, draw, paw };
}

export const moles: SceneDef = {
  id: 'moles',
  name: { uk: 'Хто в норі?', en: 'Who’s in the hole?' },
  about: {
    uk: 'Кроти вискакують з нірок, роззираються, дражняться і ховаються; інколи вилазить кролик, а зрідка золотий кріт. Влучна лапа, і зірочки над головою.',
    en: 'Moles pop out of their holes, look round, tease and duck; sometimes a rabbit, rarely a golden mole. A good paw and stars circle its head.',
  },
  energy: 0.85,
  locations: ['meadow', 'garden'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'mole',
  icon: 'mole',
  create,
};
