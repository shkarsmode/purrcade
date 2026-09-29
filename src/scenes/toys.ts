/**
 * Toys on the floor, with real bounces: a ball of yarn that unrolls a thread behind it as it
 * goes, a jingle ball that hops, a felt mouse that skids, a paper ball, and a "smart" ball that
 * rolls about on its own and changes its mind. An unseen hand tosses things in now and then;
 * a paw bats whatever it lands near across the room.
 */
import type { SceneDef, SceneCtx, SceneInstance } from '../game/types';
import { yarnSprite, jingleSprite, feltMouseSprite, paperSprite, smartBallSprite, YARN_COLORS } from '../sprites/toys';
import { blit } from '../core/pix';
import { col, mix } from '../core/color';
import { shadow } from '../game/art';
import { clamp } from '../core/rng';
import { depthDraw, dist, type Drawable } from './util';

type Kind = 'yarn' | 'jingle' | 'felt' | 'paper' | 'smart';

interface Toy {
  kind: Kind;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number;
  roll: number;
  bounce: number;       // how much it keeps on a bounce
  grip: number;         // floor friction
  ci: number;
  face: 1 | -1;
  thread: [number, number][];
  mind: number;         // smart ball: seconds until it changes course
  hitAt: number;
}

const INFO: Record<Kind, { r: number; bounce: number; grip: number }> = {
  yarn: { r: 8, bounce: 0.35, grip: 0.8 },
  jingle: { r: 5.5, bounce: 0.72, grip: 0.55 },
  felt: { r: 6, bounce: 0.2, grip: 2.2 },
  paper: { r: 5.5, bounce: 0.3, grip: 1.4 },
  smart: { r: 6.5, bounce: 0.4, grip: 1.2 },
};

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [Math.round(H * 0.66), H - 6];
  const props = loc.props || [];
  const toys: Toy[] = [];
  let toss = rng.range(0.6, 1.4);
  let time = 0;

  function add(kind: Kind, from: 'side' | 'drop' | 'here', x?: number, y?: number) {
    const inf = INFO[kind];
    const t: Toy = {
      kind, x: x ?? rng.range(W * 0.2, W * 0.8), y: y ?? rng.range(band[0] + 6, band[1] - 6), z: 0,
      vx: 0, vy: 0, vz: 0, r: inf.r, roll: 0, bounce: inf.bounce, grip: inf.grip, ci: rng.int(0, YARN_COLORS.length - 1),
      face: 1, thread: [], mind: rng.range(1, 3), hitAt: -9,
    };
    if (from === 'side') {
      const s = rng.sign();
      t.x = s < 0 ? -10 : W + 10;
      t.vx = -s * rng.range(140, 220) * opts.speed; t.vy = rng.range(-20, 20); t.z = rng.range(10, 30); t.vz = rng.range(40, 90);
    } else if (from === 'drop') {
      t.z = rng.range(60, 110); t.vz = 0; t.vx = rng.range(-30, 30);
    }
    toys.push(t);
    return t;
  }

  // What is on the floor to start with.
  add('yarn', 'side');
  add(rng.chance(0.5) ? 'jingle' : 'paper', 'here');
  add('felt', 'here');
  add('smart', 'here');

  function kick(t: Toy, ax: number, ay: number, power: number) {
    const a = Math.atan2(t.y - ay, t.x - ax) + rng.range(-0.3, 0.3);
    t.vx += Math.cos(a) * power * 1.6; t.vy += Math.sin(a) * power * 0.6;
    t.vz += power * rng.range(0.25, 0.6);
  }

  function update(dt: number) {
    time += dt;
    toss -= dt;
    if (toss <= 0) {
      toss = rng.range(1.6, 4.5) / Math.max(0.5, opts.intensity + 0.4);
      const r = rng.next();
      if (toys.length < 3 + Math.round(opts.density * 2) && r < 0.5) add(rng.pick<Kind>(['yarn', 'jingle', 'paper', 'felt', 'smart']), rng.chance(0.7) ? 'side' : 'drop');
      else if (toys.length) {
        // The hand gives something a flick.
        const t = rng.pick(toys);
        kick(t, t.x + rng.range(-20, 20), t.y + rng.range(-6, 6), rng.range(80, 200) * opts.speed);
      }
    }
    for (const t of toys) step(t, dt);
    // Toys knock into each other.
    for (let i = 0; i < toys.length; i++) for (let j = i + 1; j < toys.length; j++) {
      const a = toys[i], b = toys[j];
      if (Math.abs(a.z - b.z) > 8) continue;
      const dx = b.x - a.x, dy = (b.y - a.y) * 2, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0 && d < m) {
        const nx = dx / d, ny = dy / d, push = (m - d) / 2;
        a.x -= nx * push; b.x += nx * push; a.y -= (ny * push) / 2; b.y += (ny * push) / 2;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const imp = -rv * 0.9; a.vx -= nx * imp; a.vy -= ny * imp; b.vx += nx * imp; b.vy += ny * imp; if (Math.abs(rv) > 30) sfx.bounce(); }
      }
    }
    // Things that rolled off too far away are tidied (they will be tossed back in).
    for (let i = toys.length - 1; i >= 0; i--) { const t = toys[i]; if (t.x < -40 || t.x > W + 40) toys.splice(i, 1); }
  }

  function step(t: Toy, dt: number) {
    if (t.kind === 'smart') {
      t.mind -= dt;
      if (t.mind <= 0) {
        t.mind = rng.range(0.8, 3);
        if (rng.chance(0.3)) { t.vx *= 0.2; t.vy *= 0.2; t.mind = rng.range(0.6, 1.5); }
        else { const a = rng.range(0, Math.PI * 2); const s = rng.range(50, 110) * opts.speed; t.vx = Math.cos(a) * s; t.vy = Math.sin(a) * s * 0.4; }
      } else if (Math.hypot(t.vx, t.vy) > 5) {
        // Keep itself going.
        const s = Math.hypot(t.vx, t.vy);
        const want = 70 * opts.speed;
        t.vx *= 1 + (want - s) / want * dt * 2; t.vy *= 1 + (want - s) / want * dt * 2;
      }
    }
    // Height.
    if (t.z > 0 || t.vz > 0) {
      t.vz -= 420 * dt; t.z += t.vz * dt;
      if (t.z <= 0) {
        t.z = 0;
        if (t.vz < -40) { t.vz = -t.vz * t.bounce; if (t.kind === 'jingle') { sfx.bounce(); fx.burst(t.x, t.y - 2, 2, ['#fff4b0'], { speed: 20, g: 40, max: 0.35 }); } }
        else t.vz = 0;
      }
    }
    // Floor friction (only when touching the floor).
    const onFloor = t.z <= 0.5;
    if (onFloor && t.kind !== 'smart') { const k = Math.exp(-t.grip * dt); t.vx *= k; t.vy *= k; }
    if (onFloor && t.kind === 'smart' && t.mind > 0 && Math.hypot(t.vx, t.vy) < 5) { t.vx *= 0.9; t.vy *= 0.9; }
    t.x += t.vx * dt; t.y += t.vy * dt;
    // Walls: the skirting at the back, the edge of the screen at the front and sides.
    if (t.y < band[0] + t.r * 0.5) { t.y = band[0] + t.r * 0.5; t.vy = Math.abs(t.vy) * 0.6; }
    if (t.y > band[1]) { t.y = band[1]; t.vy = -Math.abs(t.vy) * 0.6; }
    if (t.x < t.r && t.vx < 0 && time > 1) { t.x = t.r; t.vx = Math.abs(t.vx) * 0.7; }
    if (t.x > W - t.r && t.vx > 0 && time > 1) { t.x = W - t.r; t.vx = -Math.abs(t.vx) * 0.7; }
    const sp = Math.hypot(t.vx, t.vy);
    t.roll += (sp * dt) / t.r * Math.sign(t.vx || 1);
    if (Math.abs(t.vx) > 3) t.face = t.vx > 0 ? 1 : -1;
    if (t.kind === 'yarn' && onFloor) {
      const last = t.thread[t.thread.length - 1];
      if (!last || dist(last[0], last[1], t.x, t.y) > 3) {
        t.thread.push([t.x, t.y]);
        if (t.thread.length > 160) t.thread.shift();
      }
    }
  }

  function paw(x: number, y: number) {
    for (const t of toys) {
      const d = dist(x, y, t.x, t.y - t.z - t.r);
      if (d < t.r + 22 * opts.reach) {
        kick(t, x, y, (1 - d / (t.r + 26)) * 260 + 60);
        if (d < t.r + 10 * opts.reach && time - t.hitAt > 1.2) {
          t.hitAt = time;
          ctx.caught('toy', t.x, t.y - t.z - t.r, '#ffd6f0');
        } else sfx.bounce();
      }
    }
  }

  function drawToy(g: CanvasRenderingContext2D, t: Toy) {
    const lift = Math.max(0, t.z);
    shadow(g, t.x, t.y, Math.max(4, t.r * 2 - lift * 0.08), 3, clamp(0.3 - lift * 0.003, 0.08, 0.3));
    const f = Math.floor(t.roll * 1.3);
    let img: HTMLCanvasElement;
    switch (t.kind) {
      case 'yarn': img = yarnSprite(t.ci, f); break;
      case 'jingle': img = jingleSprite(['#f25a4a', '#f2c14e', '#5c9ed6'][t.ci % 3]); break;
      case 'felt': img = feltMouseSprite(['#7fb2e5', '#e59ac0', '#9ad08a', '#c9a0e8'][t.ci], Math.floor(time * 6)); break;
      case 'paper': img = paperSprite(f); break;
      default: img = smartBallSprite(Math.floor(time * 3) % 2 ? '#ff4a6a' : '#6affc0');
    }
    blit(g, img, t.x, t.y - lift, Math.floor(img.width / 2), img.height - 1, t.kind === 'felt' && t.face < 0);
  }

  function draw(g: CanvasRenderingContext2D, tt: number) {
    // Threads first, lying on the floor under everything.
    for (const t of toys) {
      if (t.kind !== 'yarn' || t.thread.length < 2) continue;
      const c = col(mix(YARN_COLORS[t.ci % YARN_COLORS.length][0], '#000000', 0.15));
      g.fillStyle = c;
      const n = t.thread.length;
      for (let i = 1; i < n; i++) {
        const [x0, y0] = t.thread[i - 1], [x1, y1] = t.thread[i];
        if (i < 30 && (i % 2)) continue;          // the oldest end thins out
        const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let k = 0; k < steps; k++) g.fillRect(Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps), 1, 1);
      }
      const [lx, ly] = t.thread[n - 1];
      const steps = Math.max(1, Math.round(dist(lx, ly, t.x, t.y)));
      for (let k = 0; k < steps; k++) g.fillRect(Math.round(lx + ((t.x - lx) * k) / steps), Math.round(ly + ((t.y - ly) * k) / steps), 1, 1);
    }
    const items: Drawable[] = toys.map((t) => ({ y: t.y, draw: () => drawToy(g, t) }));
    depthDraw(g, tt, items, props);
  }

  return { update, draw, paw };
}

export const toys: SceneDef = {
  id: 'toys',
  name: { uk: 'Іграшки й клубок', en: 'Toys and yarn' },
  about: {
    uk: 'Клубок розмотує нитку по підлозі, дзвіночок стрибає, фетрова мишка ковзає, а розумний м’ячик котиться сам.',
    en: 'A ball of yarn unrolls across the floor, a jingle ball hops, a felt mouse skids and a smart ball rolls on its own.',
  },
  energy: 0.55,
  locations: ['livingroom', 'attic', 'kitchen'],
  kind: 'toy',
  icon: 'yarn',
  create,
};
