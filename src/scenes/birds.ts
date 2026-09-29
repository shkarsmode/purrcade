/**
 * Birds at the feeder. Small flocks come in over the fence in the bounding way finches fly,
 * land on the fence, the bird table, the branches and the birdbath rim; they look round, flick
 * their tails, peck seed, hop down to forage on the lawn, squabble over a good spot, splash in
 * the bath. A paw sends the nearest ones up and away and the rest of the flock after them; now
 * and then the shadow of a hawk sweeps over the grass and the whole garden empties at once.
 */
import type { SceneDef, SceneCtx, SceneInstance, Ledge } from '../game/types';
import { birdSprite, birdBox, type Species, type BirdPose } from '../sprites/bird';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { shadow } from '../game/art';
import { clamp } from '../core/rng';
import { depthDraw, dist, type Drawable } from './util';

type St = 'fly' | 'perch' | 'hop' | 'peck' | 'bathe' | 'flee' | 'daze';

interface Bird {
  sp: Species;
  x: number; y: number; face: 1 | -1;
  st: St; t: number;
  ledge: Ledge | null;            // standing on, or null for the ground
  ground: boolean;
  fx: number; fy: number;         // flight: from
  tx: number; ty: number;         // flight: to
  tLedge: Ledge | null; tGround: boolean;
  fp: number; fd: number;         // flight progress and duration
  leaving: boolean;
  flap: number; anim: number;
  hop: number; vh: number; hopTo: number;
  pecks: number;
  flick: number;
  flock: number;
  /** Seconds since it arrived: a bird stays a while before it thinks of leaving. */
  age: number;
  stay: number;
}

const SPECIES: Record<string, Species[]> = {
  garden: ['sparrow', 'bluetit', 'robin', 'goldfinch'],
  park: ['sparrow', 'robin', 'pigeon', 'bluetit'],
  winter: ['bullfinch', 'bluetit', 'sparrow'],
  rooftop: ['pigeon', 'pigeon', 'sparrow'],
  meadow: ['goldfinch', 'sparrow'],
  forest: ['robin', 'bluetit', 'bullfinch'],
};
const GROUNDER: Record<Species, number> = { sparrow: 0.55, robin: 0.6, pigeon: 0.8, bluetit: 0.12, goldfinch: 0.2, bullfinch: 0.15 };

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const perches = (loc.perches || []).filter((l) => l.x1 - l.x0 >= 6);
  const band: [number, number] = loc.floorBand || [loc.floor - 10, loc.floor + 10];
  const kinds = SPECIES[ctx.locId] || pickKinds();
  const maxBirds = Math.round(clamp(4 + opts.density * 4 + opts.intensity * 2, 3, 14));
  const birds: Bird[] = [];
  const seeds: { x: number; y: number }[] = [];
  let flockId = 0;
  let nextFlock = 0.3;
  let opening = 2;
  let hawk: { x: number; y: number; v: number } | null = null;
  let nextHawk = rng.range(50, 110) / Math.max(0.3, opts.intensity);

  function pickKinds(): Species[] {
    // A location we have no list for: garden birds, with pigeons if there is room to walk.
    return ['sparrow', 'bluetit', 'robin'];
  }

  for (let i = 0; i < 26; i++) seeds.push({ x: rng.range(W * 0.1, W * 0.9), y: rng.range(band[0] + 4, band[1] - 4) });

  const speed = (b: Bird) => (b.sp === 'pigeon' ? 85 : 115) * opts.speed;

  function freeSpot(l: Ledge): number | null {
    for (let k = 0; k < 6; k++) {
      const x = rng.range(l.x0 + 3, l.x1 - 3);
      if (!birds.some((b) => (b.ledge === l || b.tLedge === l) && Math.abs((b.st === 'fly' ? b.tx : b.x) - x) < 11)) return x;
    }
    return null;
  }

  /** Somewhere to land: a perch or the grass, by taste. */
  function chooseTarget(b: Bird): boolean {
    const toGround = perches.length === 0 || rng.chance(GROUNDER[b.sp]);
    if (!toGround) {
      for (let k = 0; k < 4; k++) {
        // The bird table is the draw, the bath next; branches and fence fill in.
        const l = rng.weighted(perches, (p) => (p.kind === 'food' ? 3 : p.kind === 'bath' ? 1.6 : 1));
        const x = freeSpot(l);
        if (x != null) { setFlight(b, x, l.y, l, false); return true; }
      }
    }
    const x = rng.range(W * 0.06, W * 0.94), y = rng.range(band[0] + 2, band[1] - 2);
    setFlight(b, x, y, null, true);
    return true;
  }

  function setFlight(b: Bird, x: number, y: number, l: Ledge | null, ground: boolean) {
    b.st = 'fly';
    b.fx = b.x; b.fy = b.y;
    b.tx = x; b.ty = y; b.tLedge = l; b.tGround = ground;
    const d = dist(b.x, b.y, x, y);
    b.fd = Math.max(0.5, d / speed(b));
    b.fp = 0;
    b.face = x > b.x ? 1 : -1;
    b.ledge = null; b.ground = false;
  }

  function leave(b: Bird, fast = false) {
    const side = b.x < W / 2 ? -1 : 1;
    setFlight(b, side < 0 ? -30 : W + 30, rng.range(-20, H * 0.25), null, false);
    b.leaving = true;
    if (fast) b.fd *= 0.6;
  }

  function spawnFlock() {
    const sp = rng.pick(kinds);
    const n = Math.min(maxBirds - birds.length, sp === 'pigeon' ? rng.int(2, 4) : rng.int(2, 5));
    const side = rng.sign();
    const id = ++flockId;
    for (let i = 0; i < n; i++) {
      const b: Bird = {
        sp, x: side < 0 ? -20 - i * 14 : W + 20 + i * 14, y: rng.range(10, H * 0.3), face: side < 0 ? 1 : -1,
        st: 'fly', t: 0, ledge: null, ground: false, fx: 0, fy: 0, tx: 0, ty: 0, tLedge: null, tGround: false,
        fp: 0, fd: 1, leaving: false, flap: rng.range(0, 1), anim: rng.range(0, 5), hop: 0, vh: 0, hopTo: 0, pecks: 0, flick: 0, flock: id, age: 0, stay: rng.range(18, 45),
      };
      chooseTarget(b);
      b.fd += i * 0.25;
      birds.push(b);
    }
    sfx.chirp(kinds.indexOf(sp));
  }

  function settle(b: Bird) {
    b.st = 'perch';
    b.t = rng.range(0.8, 3.2);
    b.x = b.tx; b.y = b.ty;
    b.ledge = b.tLedge; b.ground = b.tGround;
    b.hop = 0; b.vh = 26;                     // a little bounce on landing
    if (rng.chance(0.35)) { sfx.chirp(kinds.indexOf(b.sp)); fx.text(b.x + b.face * 4, b.y - 18, '♪', '#ffffff'); }
  }

  function scare(x: number, y: number, r: number) {
    const fled = new Set<number>();
    for (const b of birds) {
      if (b.st === 'daze' || b.leaving) continue;
      if (dist(b.x, b.y - 6, x, y) < r) { fled.add(b.flock); flee(b); }
    }
    // The rest of a startled flock follows a moment later.
    for (const b of birds) if (fled.has(b.flock) && !b.leaving && b.st !== 'flee' && rng.chance(0.8)) { b.st = 'perch'; b.t = rng.range(0.1, 0.5); b.pecks = -1; }
  }

  function flee(b: Bird) {
    fx.burst(b.x, b.y - 6, 3, ['#ffffff', '#e8e0d0'], { speed: 20, g: 30, max: 0.5 });
    if (rng.chance(0.4) && perches.length) {
      // Up to a high perch far from trouble, or away altogether.
      const far = perches.filter((l) => l.y < H * 0.4 && Math.abs((l.x0 + l.x1) / 2 - b.x) > 60);
      if (far.length) { const l = rng.pick(far); const x = freeSpot(l); if (x != null) { setFlight(b, x, l.y, l, false); b.fd *= 0.7; b.st = 'flee'; return; } }
    }
    leave(b, true);
    b.st = 'flee';
  }

  function update(dt: number) {
    nextFlock -= dt;
    if (nextFlock <= 0) {
      nextFlock = opening-- > 0 ? rng.range(0.8, 1.6) : rng.range(2.5, 8) / Math.max(0.5, opts.density);
      if (birds.length < maxBirds && !hawk) spawnFlock();
    }
    nextHawk -= dt;
    if (nextHawk <= 0 && !hawk) {
      nextHawk = rng.range(60, 140) / Math.max(0.3, opts.intensity);
      if (birds.length > 3) hawk = { x: -80, y: rng.range(band[0], band[1]), v: rng.range(160, 220) };
    }
    if (hawk) {
      hawk.x += hawk.v * dt;
      if (hawk.x > 20 && hawk.x < 40) for (const b of birds) if (!b.leaving && b.st !== 'daze') { flee(b); if (b.st !== 'flee') b.st = 'flee'; }
      if (hawk.x > W + 100) hawk = null;
    }
    for (const b of birds) step(b, dt);
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      if (b.leaving && b.fp >= 1) birds.splice(i, 1);
    }
  }

  function step(b: Bird, dt: number) {
    b.anim += dt;
    b.age += dt;
    if (b.vh || b.hop > 0) { b.hop += b.vh * dt; b.vh -= 320 * dt; if (b.hop <= 0) { b.hop = 0; b.vh = 0; } }
    if (b.flick > 0) b.flick -= dt;
    switch (b.st) {
      case 'fly':
      case 'flee': {
        b.fp = Math.min(1, b.fp + dt / b.fd);
        const k = b.fp;
        // Ease in the last stretch to land softly; arc a little above the straight line.
        const e = k < 0.8 ? k : 0.8 + (1 - Math.pow(1 - (k - 0.8) / 0.2, 2)) * 0.2;
        const arc = Math.sin(k * Math.PI) * Math.min(40, dist(b.fx, b.fy, b.tx, b.ty) * 0.25);
        b.x = b.fx + (b.tx - b.fx) * e;
        b.y = b.fy + (b.ty - b.fy) * e - arc;
        b.flap += dt;
        if (k >= 1 && !b.leaving) settle(b);
        break;
      }
      case 'perch': {
        b.t -= dt;
        if (rng.chance(dt * 0.9)) b.face = (-b.face) as 1 | -1;          // a look round
        if (rng.chance(dt * 0.6)) b.flick = 0.15;
        if (b.t > 0) break;
        if (b.pecks === -1) { b.pecks = 0; flee(b); break; }
        const r = rng.next();
        const onFood = b.ground || (b.ledge && isFood(b.ledge));
        if (onFood && r < 0.55) { b.st = 'peck'; b.pecks = rng.int(2, 6); b.t = 0.18; break; }
        if (b.ledge && isBath(b.ledge) && r < 0.4) { b.st = 'bathe'; b.t = rng.range(1.2, 2.4); b.y = b.ledge.y + 3; break; }
        if (r < 0.72 || (b.age < b.stay && r < 0.8)) { hopAlong(b); break; }
        if (b.age < b.stay || r < 0.93) { chooseTarget(b); break; }
        leave(b);
        break;
      }
      case 'hop': {
        const d = b.hopTo - b.x;
        b.x += Math.sign(d) * Math.min(Math.abs(d), 40 * dt);
        if (Math.abs(d) < 0.5 && b.hop === 0) { b.st = 'perch'; b.t = rng.range(0.3, 1.4); }
        break;
      }
      case 'peck':
        b.t -= dt;
        if (b.t <= 0) {
          b.pecks--;
          if (rng.chance(0.5)) fx.burst(b.x + b.face * 6, b.y - 1, 1, ['#e9d08a', '#c9a45a'], { speed: 16, g: 90, max: 0.35 });
          if (b.pecks <= 0) { b.st = 'perch'; b.t = rng.range(0.4, 1.5); }
          else b.t = rng.range(0.14, 0.3);
        }
        break;
      case 'bathe':
        b.t -= dt;
        if (rng.chance(dt * 14)) fx.add({ x: b.x + rng.range(-7, 7), y: b.y - 3, vx: rng.range(-30, 30), vy: rng.range(-50, -20), g: 160, max: 0.5, c: rng.pick(['#bfe6ff', '#ffffff', '#6fb2e0']) });
        b.face = Math.sin(b.anim * 9) > 0 ? 1 : -1;
        if (b.t <= 0) { b.y = b.ledge ? b.ledge.y : b.y; b.st = 'perch'; b.t = 0.6; b.hop = 0; b.vh = 40; }
        break;
      case 'daze':
        b.t -= dt;
        if (b.t <= 0) leave(b, true);
        break;
    }
    // Squabbles: two birds too close on the same perch, and one of them gives way.
    if (b.st === 'perch' && b.ledge) {
      for (const o of birds) {
        if (o === b || o.ledge !== b.ledge || o.st !== 'perch') continue;
        if (Math.abs(o.x - b.x) < 8 && rng.chance(dt * 1.5)) {
          b.vh = 60; b.face = o.x > b.x ? 1 : -1;
          fx.burst((o.x + b.x) / 2, b.y - 10, 4, ['#ffffff', '#f0e6d6'], { speed: 26, g: 40, max: 0.5 });
          sfx.chirp(3);
          chooseTarget(o);
        }
      }
    }
  }

  const isFood = (l: Ledge) => l.kind === 'food';
  const isBath = (l: Ledge) => l.kind === 'bath';

  function hopAlong(b: Bird) {
    const l = b.ledge;
    const lo = l ? l.x0 + 3 : W * 0.05, hi = l ? l.x1 - 3 : W * 0.95;
    const d = rng.range(4, 12) * rng.sign();
    b.hopTo = clamp(b.x + d, lo, hi);
    b.face = b.hopTo > b.x ? 1 : -1;
    b.st = 'hop'; b.vh = 50;
    if (b.ground) b.y = clamp(b.y + rng.range(-3, 3), band[0], band[1]);
  }

  function paw(x: number, y: number) {
    let hit: Bird | null = null, hd = Infinity;
    for (const b of birds) {
      if (b.leaving || b.st === 'daze') continue;
      const d = dist(x, y, b.x, b.y - 7 - b.hop);
      if (d < 11 * opts.reach && d < hd) { hit = b; hd = d; }
    }
    if (hit) {
      hit.st = 'daze'; hit.t = 0.35;
      for (let i = 0; i < 8; i++) fx.add({ x: hit.x, y: hit.y - 7, kind: 'feather', vx: rng.range(-40, 40), vy: rng.range(-50, 0), g: 25, drag: 2.5, max: rng.range(0.9, 1.6), c: '#ffffff', c2: '#c9b89a', spin: rng.range(-6, 6) });
      ctx.caught('bird', hit.x, hit.y - 7, '#9fe0ff');
    }
    scare(x, y, 75 * Math.max(1, opts.reach * 0.8));
  }

  function pose(b: Bird): [BirdPose, number] {
    switch (b.st) {
      case 'fly': case 'flee': {
        if (b.sp === 'pigeon' || b.st === 'flee' || b.fp > 0.85 || b.fp < 0.1) return ['fly', Math.floor(b.flap * 14)];
        const ph = (b.flap % 0.62) / 0.62;
        return ph < 0.6 ? ['fly', Math.floor(b.flap * 14)] : ['ball', 0];
      }
      case 'hop': return b.sp === 'pigeon' ? ['walk', Math.floor(b.anim * 8)] : ['hop', 0];
      case 'peck': return ['peck', b.t < 0.1 ? 1 : 0];
      case 'bathe': return ['fly', Math.floor(b.anim * 16)];
      case 'daze': return ['fly', Math.floor(b.anim * 20)];
      default: return ['perch', b.flick > 0 ? 1 : 0];
    }
  }

  function drawBird(g: CanvasRenderingContext2D, b: Bird) {
    const [ps, f] = pose(b);
    const box = birdBox(b.sp);
    if (b.ground && b.st !== 'fly' && b.st !== 'flee') shadow(g, b.x, b.y, b.sp === 'pigeon' ? 18 : 12, 3, 0.22);
    blit(g, birdSprite(b.sp, ps, f), b.x, b.y - b.hop, box.ax, box.ay, b.face < 0);
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    // Seed scattered on the lawn.
    g.fillStyle = col('#e9d08a');
    for (const s of seeds) g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    const items: Drawable[] = [];
    for (const b of birds) {
      if (b.st === 'fly' || b.st === 'flee' || b.st === 'daze') continue;
      if (b.ground) items.push({ y: b.y, draw: () => drawBird(g, b) });
      else drawBird(g, b);
    }
    depthDraw(g, t, items, loc.props);
    if (hawk) drawHawk(g, hawk.x, hawk.y);
  }

  function drawHawk(g: CanvasRenderingContext2D, x: number, y: number) {
    // The shadow of something big going over: wings spread, tail fanned.
    g.globalAlpha = 0.22;
    g.fillStyle = '#000';
    const X = Math.round(x), Y = Math.round(y);
    for (let i = -34; i <= 34; i++) {
      const w = Math.max(1, Math.round(5 - Math.abs(i) * 0.12 + (Math.abs(i) < 8 ? 3 : 0)));
      const sweep = Math.round(Math.abs(i) * 0.25);
      g.fillRect(X + i, Y - w / 2 + sweep, 1, w);
    }
    g.fillRect(X - 3, Y - 10, 7, 20);
    g.fillRect(X - 6, Y + 8, 13, 5);
    g.globalAlpha = 1;
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const b of birds) if (b.st === 'fly' || b.st === 'flee' || b.st === 'daze') drawBird(g, b);
  }

  return { update, draw, drawTop, paw };
}

export const birds: SceneDef = {
  id: 'birds',
  name: { uk: 'Пташина годівничка', en: 'Bird feeder' },
  about: {
    uk: 'Зграйки горобців, синиць і снігурів сідають на паркан, клюють зерно й купаються. Тінь яструба, і всі врозтіч.',
    en: 'Sparrows, tits and bullfinches land on the fence, peck seed and splash in the bath. A hawk’s shadow and they are gone.',
  },
  energy: 0.6,
  locations: ['garden', 'park', 'winter', 'forest', 'meadow'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'bird',
  icon: 'bird',
  create,
};
