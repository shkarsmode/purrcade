/**
 * Mice. They live behind the skirting board and under the sofa, and they come out the way real
 * ones do: a nose first and a look round, then a dash along the wall, a freeze, another dash.
 * There is cheese to nibble and crumbs to carry home. A paw landing near sends them scattering
 * for the nearest hole with a squeak; one that lands on a mouse bowls it over — stars, a squeak,
 * and it stays home a while before it plucks up the courage to come out again.
 */
import type { SceneDef, SceneCtx, SceneInstance, Hole } from '../game/types';
import { mouseSprite, mouseShadow, cheeseSprite, MOUSE_AX, MOUSE_AY, type MouseCoat, type MousePose } from '../sprites/mouse';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { shadow, holeRows } from '../game/art';
import { clamp } from '../core/rng';
import { depthDraw, dist, nearest, tinyStar, type Drawable } from './util';

type St = 'home' | 'peek' | 'exit' | 'go' | 'wait' | 'eat' | 'flee' | 'in' | 'daze';
type Goal = 'cheese' | 'crumb' | 'roam' | 'hole' | 'cover' | 'friend';
type Hold = 'freeze' | 'sniff' | 'rear' | 'look';

interface Crumb { x: number; y: number; taken: boolean; c: string }
interface Cheese { x: number; y: number; left: number; pop: number }

interface Mouse {
  coat: MouseCoat;
  x: number; y: number; face: 1 | -1;
  st: St; t: number;
  hole: Hole;
  /** Going through a hole: which side the wall hides, and how far out it is (0 in … 1 out). */
  hs: 1 | -1; p: number;
  path: [number, number][];
  goal: Goal;
  crumbT: Crumb | null;
  friend: Mouse | null;
  v: number; top: number; bold: number;
  step: number; leg: number;
  hold: Hold; holdT: number;
  /** What a pause ends in: carry on, think again, or bolt. */
  after: 'next' | 'flee';
  crumb: boolean;
  out: number;
  hop: number; vh: number;
  anim: number;
}

const T = 16;              // how far a mouse walks going through a hole

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [loc.floor - 6, loc.floor + 20];
  const holes: Hole[] = loc.holes && loc.holes.length ? loc.holes : [{ x: -10, y: band[0], w: 12, h: 12 }, { x: W + 10, y: band[0], w: 12, h: 12 }];
  const props = loc.props || [];
  const wallY = band[0] + 2;
  const k = opts.intensity;
  const maxOut = Math.round(clamp(1.5 + k * 2.5 + (opts.density - 1) * 2, 1, 6));
  const total = maxOut + 2;
  const mice: Mouse[] = [];
  const crumbs: Crumb[] = [];
  let cheese: Cheese | null = null;
  let cheeseWait = 0;
  let scare = rng.range(25, 45);
  let crumbWait = rng.range(6, 12);

  const inBand = (y: number) => clamp(y, band[0] + 3, band[1] - 2);
  const spot = (): [number, number] => [rng.range(W * 0.1, W * 0.9), inBand(rng.range(band[0] + 8, band[1] - 6))];

  function coat(): MouseCoat {
    const r = rng.next();
    return r < 0.04 ? 'gold' : r < 0.15 ? 'white' : r < 0.55 ? 'brown' : 'grey';
  }

  for (let i = 0; i < total; i++) {
    mice.push({
      coat: coat(), x: 0, y: 0, face: 1, st: 'home', t: rng.range(0.5, 5) + i * 1.2,
      hole: rng.pick(holes), hs: 1, p: 0, path: [], goal: 'roam', crumbT: null, friend: null,
      v: 0, top: rng.range(75, 125), bold: rng.next(), step: 0, leg: 0, hold: 'freeze', holdT: 0, after: 'next',
      crumb: false, out: 0, hop: 0, vh: 0, anim: rng.range(0, 10),
    });
  }
  for (let i = 0; i < rng.int(3, 6); i++) { const [x, y] = spot(); crumbs.push({ x, y, taken: false, c: rng.pick(['#f4c95d', '#e8b04a', '#fff0c0']) }); }
  placeCheese();

  function placeCheese() {
    const [x, y] = spot();
    cheese = { x: clamp(x, W * 0.2, W * 0.8), y: inBand(y), left: 1, pop: 0.4 };
    fx.burst(cheese.x, cheese.y - 4, 8, ['#ffe066', '#ffffff'], { speed: 30, g: 20, max: 0.6 });
  }

  const outCount = () => mice.filter((m) => m.st !== 'home' && m.st !== 'daze').length;

  function speed(m: Mouse) { return m.top * opts.speed; }

  /** Pick what to do next and how to get there. */
  function decide(m: Mouse) {
    m.friend = null; m.crumbT = null;
    if (m.crumb || m.out > 14 + m.bold * 16) return goHome(m);
    const others = mice.filter((o) => o !== m && (o.st === 'go' || o.st === 'wait'));
    const free = crumbs.filter((c) => !c.taken);
    const r = rng.next();
    if (cheese && r < 0.38) { m.goal = 'cheese'; routeTo(m, cheese.x + rng.sign() * rng.range(9, 13), cheese.y + rng.range(-1, 2)); return; }
    if (free.length && r < 0.6) { const c = nearest(free, m.x, m.y)!; m.goal = 'crumb'; m.crumbT = c; routeTo(m, c.x - 6 * Math.sign(c.x - m.x || 1), c.y); return; }
    if (props.length && r < 0.7) { const p = rng.pick(props); m.goal = 'cover'; routeTo(m, rng.range(p.x0 + 6, p.x1 - 6), p.y - rng.range(2, 4)); return; }
    if (others.length && r < 0.78) { m.goal = 'friend'; m.friend = rng.pick(others); m.t = rng.range(3, 5); routeTo(m, m.friend.x, m.friend.y); return; }
    if (r < 0.86) { const h = rng.pick(holes); m.hole = h; goHome(m, h); return; }
    m.goal = 'roam';
    const [x, y] = spot();
    routeTo(m, x, y);
  }

  function goHome(m: Mouse, h?: Hole) {
    m.goal = 'hole';
    m.hole = h || nearest(holes, m.x, m.y) || holes[0];
    const side = m.x < m.hole.x ? -1 : 1;
    routeTo(m, m.hole.x + side * T, m.hole.y, true);
  }

  /** A route that hugs the wall for long runs, the way mice cross a room. */
  function routeTo(m: Mouse, x: number, y: number, toWall = false) {
    const path: [number, number][] = [];
    const dx = x - m.x;
    if (Math.abs(dx) > 110 && rng.chance(0.6 + m.bold * -0.3 + 0.2)) {
      const d = Math.sign(dx);
      path.push([m.x + d * rng.range(12, 30), wallY + rng.range(0, 3)]);
      path.push([x - d * rng.range(10, 30), wallY + rng.range(0, 3)]);
    }
    path.push([x, toWall ? y : inBand(y)]);
    m.path = path;
    m.st = 'go';
    m.leg = rng.range(28, 90) * (0.7 + m.bold * 0.6);
  }

  function hold(m: Mouse, h?: Hold, t?: number) {
    m.st = 'wait';
    m.hold = h || rng.weighted<Hold>(['freeze', 'sniff', 'rear', 'look'], (x) => ({ freeze: 3, sniff: 4, rear: 1.2 + m.bold, look: 1.5 }[x]));
    m.t = t ?? (m.hold === 'rear' ? rng.range(0.9, 1.8) : rng.range(0.25, 1.3) * (1.4 - m.bold * 0.6) / Math.max(0.6, opts.speed));
    m.holdT = 0;
    m.after = 'next';
    m.v = 0;
  }

  function flee(m: Mouse) {
    if (m.st === 'daze' || m.st === 'home' || m.st === 'in') return;
    // Still in the doorway: turn round and go back in.
    if (m.st === 'peek' || m.st === 'exit') { m.st = 'in'; m.face = (-m.face) as 1 | -1; return; }
    if (m.st !== 'flee') {
      m.hop = 0; m.vh = 55;
      fx.text(m.x, m.y - 17, '!', '#ffe066');
      sfx.squeak();
    }
    m.goal = 'hole';
    if (m.crumbT) m.crumbT = null;
    m.hole = nearest(holes, m.x, m.y) || holes[0];
    const side = m.x < m.hole.x ? -1 : 1;
    m.path = [[m.hole.x + side * T, m.hole.y]];
    m.st = 'flee';
    m.v = speed(m) * 0.8;
  }

  function enterHole(m: Mouse) {
    m.st = 'in';
    m.x = m.hole.x + (m.x < m.hole.x ? -T : T);
    m.y = m.hole.y;
    m.face = m.x < m.hole.x ? 1 : -1;
    m.hs = m.face;
    m.p = 1;
  }

  function comeOut(m: Mouse) {
    m.hole = m.bold > 0.6 && rng.chance(0.5) ? rng.pick(holes) : m.hole;
    const h = m.hole;
    // Face into the room, toward the middle of the screen more often than not.
    m.face = (h.x < W * 0.2 ? 1 : h.x > W * 0.8 ? -1 : rng.chance(0.5) ? 1 : -1) as 1 | -1;
    m.hs = (-m.face) as 1 | -1;
    m.p = 0;
    m.x = h.x + m.hs * T; m.y = h.y;
    m.st = 'peek'; m.t = rng.range(0.8, 2.6) * (1.3 - m.bold * 0.6);
    m.out = 0; m.crumb = false;
    if (m.coat !== 'gold' && rng.chance(0.03)) m.coat = 'gold';
  }

  function move(m: Mouse, dt: number, fast: boolean): boolean {
    const [tx, ty] = m.path[0];
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
    const top = speed(m) * (fast ? 1.9 : 1);
    m.v = Math.min(top, m.v + top * 9 * dt);
    const s = Math.min(d, m.v * dt);
    if (Math.abs(dx) > 0.5) m.face = dx > 0 ? 1 : -1;
    if (d > 0.01) { m.x += (dx / d) * s; m.y += (dy / d) * s; }
    m.step += s;
    m.leg -= s;
    if (d - s < 0.6) { m.path.shift(); return m.path.length === 0; }
    return false;
  }

  function update(dt: number) {
    // Cheese and crumbs come back.
    if (!cheese) { cheeseWait -= dt; if (cheeseWait <= 0) placeCheese(); }
    else if (cheese.pop > 0) cheese.pop -= dt;
    crumbWait -= dt;
    if (crumbWait <= 0) {
      crumbWait = rng.range(7, 14);
      if (crumbs.filter((c) => !c.taken).length < 5) {
        const [x, y] = spot();
        crumbs.push({ x, y, taken: false, c: rng.pick(['#f4c95d', '#e8b04a', '#fff0c0']) });
      }
    }
    // Now and then a noise from somewhere: everyone freezes, most of them bolt.
    scare -= dt;
    if (scare <= 0) {
      scare = rng.range(22, 50);
      for (const m of mice) {
        if (m.st === 'go' || m.st === 'wait' || m.st === 'eat') {
          if (rng.chance(0.55 - m.bold * 0.3)) { hold(m, 'freeze', rng.range(0.3, 0.7)); m.after = 'flee'; }
          else hold(m, 'rear', rng.range(0.8, 1.4));
        }
      }
    }
    for (const m of mice) step(m, dt);
    for (let i = crumbs.length - 1; i >= 0; i--) if (crumbs[i].taken && !mice.some((m) => m.crumbT === crumbs[i])) crumbs.splice(i, 1);
  }

  function step(m: Mouse, dt: number) {
    m.anim += dt;
    if (m.vh || m.hop > 0) { m.hop += m.vh * dt; m.vh -= 380 * dt; if (m.hop <= 0) { m.hop = 0; m.vh = 0; } }
    if (m.st !== 'home' && m.st !== 'daze') m.out += dt;
    switch (m.st) {
      case 'home':
        m.t -= dt;
        if (m.t <= 0) {
          if (outCount() < maxOut) comeOut(m);
          else m.t = rng.range(1, 3);
        }
        break;
      case 'peek': {
        // Nose out, look, then either come out or think better of it.
        m.p = Math.min(0.62, m.p + dt * 1.6);
        m.x = m.hole.x + m.hs * T * (1 - 2 * m.p);
        m.t -= dt;
        if (m.t <= 0) {
          if (rng.chance(0.12 * (1 - m.bold))) { m.st = 'in'; m.face = (-m.face) as 1 | -1; }
          else m.st = 'exit';
        }
        break;
      }
      case 'exit':
        m.p += (speed(m) * dt) / (2 * T);
        m.step += speed(m) * dt;
        if (m.p >= 1) { m.p = 1; m.x = m.hole.x + m.hs * T * -1; m.y = m.hole.y; decide(m); }
        else m.x = m.hole.x + m.hs * T * (1 - 2 * m.p);
        break;
      case 'in':
        m.p -= (speed(m) * 1.2 * dt) / (2 * T);
        m.step += speed(m) * dt;
        m.x = m.hole.x + m.hs * T * (1 - 2 * Math.max(0, m.p));
        if (m.p <= 0) {
          m.st = 'home'; m.t = rng.range(2, 7) * (1.4 - m.bold * 0.7);
          if (m.crumb) { m.crumb = false; if (rng.chance(0.5)) fx.add({ x: m.hole.x, y: m.hole.y - m.hole.h - 3, kind: 'heart', c: '#ff8fa3', vy: -10, max: 0.9 }); }
        }
        break;
      case 'go': {
        if (m.goal === 'friend' && m.friend) {
          m.t -= dt;
          const f = m.friend;
          if (f.st === 'home' || f.st === 'in' || f.st === 'daze' || m.t <= 0) { hold(m); break; }
          m.path = [[f.x - f.face * 16, inBand(f.y + 1)]];
          if (dist(m.x, m.y, f.x, f.y) < 20) {
            // They meet: noses touch, a heart, then off again.
            hold(m, 'sniff', 0.9); m.face = f.x > m.x ? 1 : -1;
            if (f.st === 'wait' || f.st === 'go') { hold(f, 'sniff', 0.9); f.face = (-m.face) as 1 | -1; }
            fx.add({ x: (m.x + f.x) / 2, y: m.y - 16, kind: 'heart', c: '#ff8fa3', vy: -12, max: 1 });
            break;
          }
        }
        const done = move(m, dt, false);
        if (done) arrive(m);
        else if (m.leg <= 0 && m.goal !== 'hole') hold(m);
        else if (m.leg <= 0) { m.leg = rng.range(40, 100); if (rng.chance(0.5)) hold(m, 'freeze', rng.range(0.15, 0.5)); }
        break;
      }
      case 'wait':
        m.t -= dt; m.holdT += dt;
        if (m.hold === 'look' && m.holdT > 0.35) { m.holdT = -rng.range(0.2, 0.6); m.face = (-m.face) as 1 | -1; }
        if (m.t <= 0) {
          if (m.after === 'flee') { flee(m); break; }
          if (m.path.length) { m.st = 'go'; m.leg = rng.range(28, 90) * (0.7 + m.bold * 0.6); }
          else decide(m);
        }
        break;
      case 'eat':
        m.t -= dt;
        if (cheese && Math.floor((m.t + dt) * 2.5) !== Math.floor(m.t * 2.5)) {
          cheese.left -= 0.035;
          if (rng.chance(0.3)) fx.burst(m.x + m.face * 9, m.y - 3, 1, ['#f5c842'], { speed: 14, g: 80, max: 0.4 });
          if (cheese.left <= 0) { cheese = null; cheeseWait = rng.range(5, 10); m.t = 0; }
        }
        if (m.t <= 0 || !cheese) { m.crumb = rng.chance(0.55); decide(m); }
        break;
      case 'flee':
        if (move(m, dt, true)) enterHole(m);
        break;
      case 'daze':
        m.t -= dt;
        if (m.t <= 0) {
          fx.burst(m.x, m.y - 5, 12, ['#ffffff', '#e8e4f0', '#c9c2d6'], { speed: 34, g: -10, max: 0.6 });
          m.st = 'home'; m.t = rng.range(5, 10);
          if (m.coat === 'gold') m.coat = coat();
        }
        break;
    }
    if (m.coat === 'gold' && m.st !== 'home' && rng.chance(dt * 6)) {
      fx.add({ x: m.x + rng.range(-8, 8), y: m.y - rng.range(2, 12), kind: 'spark', c: '#fff3b0', vy: -8, max: 0.5 });
    }
  }

  function arrive(m: Mouse) {
    switch (m.goal) {
      case 'cheese':
        if (cheese) { m.st = 'eat'; m.face = cheese.x > m.x ? 1 : -1; m.t = rng.range(1.8, 4); }
        else decide(m);
        break;
      case 'crumb': {
        const c = m.crumbT;
        if (c && !c.taken) { c.taken = true; m.crumb = true; m.crumbT = null; hold(m, 'sniff', 0.4); m.goal = 'hole'; m.path = []; }
        else decide(m);
        break;
      }
      case 'hole':
        enterHole(m);
        break;
      case 'cover':
        hold(m, rng.chance(0.5) ? 'freeze' : 'look', rng.range(1.2, 3.2));
        break;
      default:
        hold(m);
    }
  }

  function paw(x: number, y: number) {
    const reach = 12 * opts.reach;
    let hit: Mouse | null = null, hd = Infinity;
    for (const m of mice) {
      if (m.st === 'home' || m.st === 'daze') continue;
      const inHole = m.st === 'peek' || m.st === 'exit' || m.st === 'in';
      const d = dist(x, y, m.x + m.face * 3, m.y - 5 - m.hop);
      if (!inHole && d < reach && d < hd) { hit = m; hd = d; }
    }
    if (hit) {
      hit.st = 'daze'; hit.t = 1.1; hit.v = 0; hit.hop = 0; hit.vh = 0;
      if (hit.crumbT) hit.crumbT = null;
      sfx.squeak();
      ctx.caught(hit.coat === 'gold' ? 'gold' : 'mouse', hit.x, hit.y - 6, hit.coat === 'gold' ? '#ffd23f' : '#ffe066');
      if (hit.coat === 'gold') fx.text(hit.x, hit.y - 20, '★', '#ffd23f');
    }
    for (const m of mice) {
      if (m === hit) continue;
      const d = dist(x, y, m.x, m.y - 5);
      if (d < 80 * Math.max(1, opts.reach * 0.8)) flee(m);
    }
  }

  function pose(m: Mouse): [MousePose, number] {
    switch (m.st) {
      case 'go': case 'flee': case 'exit': case 'in':
        return ['run', Math.floor(m.step / 3.2)];
      case 'peek':
        return ['sit', Math.floor(m.anim * 4)];
      case 'eat':
        return ['eat', Math.floor(m.anim * 5)];
      case 'daze':
        return ['daze', Math.floor(m.anim * 6)];
      case 'wait':
        if (m.hold === 'rear') return ['rear', Math.floor(m.anim * 2.5)];
        if (m.hold === 'sniff') return ['sit', Math.floor(m.anim * 5)];
        return ['sit', 0];
      default:
        return ['sit', 0];
    }
  }

  function drawMouse(g: CanvasRenderingContext2D, m: Mouse) {
    const [ps, f] = pose(m);
    const img = mouseSprite(m.coat, ps, f, m.crumb && ps === 'run');
    const flip = m.face < 0;
    const X = m.x, Y = m.y - m.hop;
    const through = m.st === 'peek' || m.st === 'exit' || m.st === 'in';
    if (!through) {
      shadow(g, m.x + m.face, m.y, m.hop > 2 ? 10 : 15, 3, m.hop > 2 ? 0.16 : 0.24);
      blit(g, img, X, Y, MOUSE_AX, MOUSE_AY, flip);
      if (m.st === 'daze') {
        for (let i = 0; i < 3; i++) {
          const a = m.anim * 5 + (i * Math.PI * 2) / 3;
          tinyStar(g, m.x + 1 + Math.cos(a) * 7, m.y - 13 + Math.sin(a) * 2, col(i === 1 ? '#ffffff' : '#ffe066'));
        }
      }
      return;
    }
    // Half in the hole: the wall hides what is past the far edge, the dark of the hole shades
    // what is inside it.
    const h = m.hole;
    const rows = holeRows(h);
    const x0 = Math.round(h.x - h.w / 2), x1 = Math.round(h.x + h.w / 2);
    g.save();
    g.beginPath();
    if (m.hs > 0) g.rect(0, 0, x0, H); else g.rect(x1, 0, W - x1, H);
    for (const [y, a, b] of rows) g.rect(a, y, b - a, 1);
    g.rect(0, h.y + 1, W, H);
    g.clip();
    blit(g, img, X, Y, MOUSE_AX, MOUSE_AY, flip);
    g.restore();
    g.save();
    g.beginPath();
    for (const [y, a, b] of rows) g.rect(a, y, b - a, 1);
    g.clip();
    g.globalAlpha = h.kind === 'slot' ? 0.88 : 0.78;
    blit(g, mouseShadow(m.coat, ps, f, m.crumb && ps === 'run'), X, Y, MOUSE_AX, MOUSE_AY, flip);
    g.restore();
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    const items: Drawable[] = [];
    if (cheese) {
      const c = cheese;
      items.push({ y: c.y, draw: () => {
        const img = cheeseSprite(c.left);
        const s = c.pop > 0 ? Math.round(c.pop * 6) : 0;
        shadow(g, c.x, c.y, 16, 3, 0.22);
        g.drawImage(img, Math.round(c.x - 8), Math.round(c.y - 11 - s));
      } });
    }
    for (const c of crumbs) {
      if (c.taken) continue;
      items.push({ y: c.y, draw: () => { g.fillStyle = col(c.c); g.fillRect(Math.round(c.x), Math.round(c.y - 1), 2, 1); g.fillStyle = col('#b98a3a'); g.fillRect(Math.round(c.x), Math.round(c.y), 2, 1); } });
    }
    for (const m of mice) {
      if (m.st === 'home') continue;
      items.push({ y: m.st === 'peek' || m.st === 'exit' || m.st === 'in' ? m.hole.y - 100 : m.y, draw: () => drawMouse(g, m) });
    }
    depthDraw(g, t, items, props);
  }

  return { update, draw, paw };
}

export const mice: SceneDef = {
  id: 'mice',
  name: { uk: 'Мишача нора', en: 'Mouse hole' },
  about: {
    uk: 'Миші визирають з нір, гризуть сир і тягнуть крихти додому. Лапа поруч, і всі врозтіч.',
    en: 'Mice peek out of their holes, nibble cheese and carry crumbs home. A paw nearby and they scatter.',
  },
  energy: 0.7,
  locations: ['kitchen', 'livingroom', 'attic'],
  kind: 'mouse',
  icon: 'mouse',
  create,
};
