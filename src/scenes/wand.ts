/**
 * The feather wand, the toy every cat knows: a stick reaching in from off the top of the picture,
 * a string, and at the end a tuft of feathers with a little bell. The string is a real rope —
 * points joined by sticks, pulled down, knocking along the floor — so the feathers swing, whip,
 * drag and settle the way the real thing does. The unseen hand plays like a good player: swoops,
 * drags along the floor, hides the lure behind the sack and twitches it, lets it dangle, jerks it.
 * A paw on the feathers pins them a moment — got it! — before the hand tugs them away again.
 */
import type { SceneDef, SceneCtx, SceneInstance, Prop } from '../game/types';
import { col } from '../core/color';
import { clamp } from '../core/rng';
import { dist } from './util';

type Move = 'swoop' | 'drag' | 'hide' | 'dangle' | 'jerk' | 'circle' | 'hop';

interface Pt { x: number; y: number; px: number; py: number }

const N = 16;
const SEG = 5.2;

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.66, H - 6];
  // The line on the floor the lure lies along: the middle of the floor, or just behind a prop.
  const mid = band[0] + (band[1] - band[0]) * 0.5;
  let floorLine = mid;
  const floorY = (_x: number) => floorLine;
  const props: Prop[] = loc.props || [];
  const pts: Pt[] = [];
  const hand = { x: W * 0.5, y: 40, tx: W * 0.5, ty: 40, v: 200 };
  for (let i = 0; i < N; i++) pts.push({ x: hand.x, y: hand.y + i * SEG, px: hand.x, py: hand.y + i * SEG });
  let move: Move = 'dangle';
  let t = 0, mt = 1.5;
  let time = 0;
  let pin = 0, pinX = 0, pinY = 0;
  let circ = 0;
  let hideProp: Prop | null = null;
  let twitch = 0;
  let caughtAt = -9;
  const colors = rng.pick([['#3ad0c0', '#ff6a9a', '#ffd23f'], ['#6a8aff', '#ff8a3a', '#f4f4f4'], ['#ff5a5a', '#5aff9a', '#ffe066']]);

  function next() {
    const k = opts.intensity;
    move = rng.weighted<Move>(['swoop', 'drag', 'hide', 'dangle', 'jerk', 'circle', 'hop'], (m) => ({
      swoop: 3, drag: 3.2, hide: props.length ? 1.6 : 0, dangle: 2.2 - k, jerk: 1 + k * 1.5, circle: 1, hop: 1.4,
    }[m]));
    t = 0;
    switch (move) {
      case 'swoop': mt = rng.range(1.6, 2.6); hand.tx = rng.range(W * 0.1, W * 0.9); hand.ty = rng.range(-10, 40); break;
      case 'drag': mt = rng.range(2.5, 4.5); hand.tx = rng.chance(0.5) ? W * 0.12 : W * 0.88; hand.ty = mid - N * SEG * 0.55; break;
      case 'hide': { mt = rng.range(3.5, 5.5); hideProp = rng.pick(props); hand.tx = (hideProp.x0 + hideProp.x1) / 2; hand.ty = hideProp.y - N * SEG * 0.8; twitch = 0; break; }
      case 'dangle': mt = rng.range(1.8, 3.5); hand.tx = hand.x + rng.range(-40, 40); hand.ty = mid - N * SEG + rng.range(-10, 20); break;
      case 'jerk': mt = rng.range(0.4, 0.8); hand.tx = clamp(hand.x + rng.sign() * rng.range(60, 140), 20, W - 20); hand.ty = hand.y + rng.range(-40, 10); break;
      case 'circle': mt = rng.range(2, 3.5); circ = 0; break;
      case 'hop': mt = rng.range(2, 3); break;
    }
    hand.tx = clamp(hand.tx, 10, W - 10);
  }

  function update(dt: number) {
    time += dt;
    t += dt;
    const wantFloor = move === 'hide' && hideProp ? hideProp.y - 3 : mid;
    floorLine += (wantFloor - floorLine) * Math.min(1, dt * 1.5);
    const sp = opts.speed;
    // Where the hand goes this frame.
    switch (move) {
      case 'swoop': case 'jerk': case 'dangle': {
        const k = move === 'jerk' ? 12 : move === 'swoop' ? 2.2 : 1.5;
        hand.x += (hand.tx - hand.x) * Math.min(1, dt * k * sp);
        hand.y += (hand.ty - hand.y) * Math.min(1, dt * k * sp);
        if (move === 'dangle' && rng.chance(dt * 2)) { hand.x += rng.range(-5, 5); hand.y += rng.range(-4, 2); }
        break;
      }
      case 'drag': {
        // Low and slow along the floor, in fits and starts.
        const go = Math.sin(t * 4) > -0.3 ? 1 : 0.1;
        hand.x += (hand.tx - hand.x) * Math.min(1, dt * 0.9 * sp * go);
        hand.y += (hand.ty - hand.y) * Math.min(1, dt * 2);
        break;
      }
      case 'hide': {
        hand.x += (hand.tx - hand.x) * Math.min(1, dt * 2 * sp);
        hand.y += (hand.ty - hand.y) * Math.min(1, dt * 2);
        twitch -= dt;
        if (t > 1.5 && twitch <= 0) { twitch = rng.range(0.4, 1.2); hand.x += rng.range(-9, 9); hand.y -= rng.range(0, 8); }
        break;
      }
      case 'circle': {
        circ += dt * 4 * sp;
        const cx = hand.tx, cy = 30;
        hand.x += (cx + Math.cos(circ) * 50 - hand.x) * Math.min(1, dt * 6);
        hand.y += (cy + Math.sin(circ) * 20 - hand.y) * Math.min(1, dt * 6);
        break;
      }
      case 'hop': {
        // Bounce the lure along: down, up, down, a step further each time.
        const ph = (t * 2.2) % 1;
        hand.x += (hand.tx - hand.x) * Math.min(1, dt * 0.8);
        hand.y = mid - N * SEG * 0.5 - Math.sin(ph * Math.PI) * 40;
        if (Math.floor(t * 2.2) !== Math.floor((t - dt) * 2.2)) hand.tx = clamp(hand.x + rng.range(-50, 50), 20, W - 20);
        break;
      }
    }
    if (t >= mt && pin <= 0) next();
    simulate(dt);
    if (pin > 0) {
      pin -= dt;
      if (pin <= 0) { move = 'jerk'; t = 0; mt = 0.5; hand.tx = clamp(pinX + rng.sign() * 120, 20, W - 20); hand.ty = -20; }
    }
  }

  function simulate(dt: number) {
    const g = 420;
    const d2 = dt * dt;
    for (let i = 1; i < N; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g * d2 * (i === N - 1 ? 1.4 : 1);
    }
    pts[0].x = hand.x; pts[0].y = hand.y; pts[0].px = hand.x; pts[0].py = hand.y;
    for (let it = 0; it < 6; it++) {
      for (let i = 1; i < N; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
        const diff = (d - SEG) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
      pts[0].x = hand.x; pts[0].y = hand.y;
      if (pin > 0) { const e = pts[N - 1]; e.x = pinX; e.y = pinY; }
      // The floor: things lie on it and slide with friction.
      for (let i = 1; i < N; i++) {
        const p = pts[i];
        const fy = floorY(p.x) + (i === N - 1 ? 0 : 0);
        if (p.y > fy) { p.y = fy; p.px = p.x - (p.x - p.px) * 0.6; }
      }
    }
    // Feathers brushing the floor kick up a little dust; the bell rings when the lure is whipped about.
    const e = pts[N - 1];
    const lureSpeed = Math.hypot(e.x - e.px, e.y - e.py);
    if (lureSpeed > 2.2 && rng.chance(Math.min(0.5, lureSpeed * 0.06))) sfx.ting();
    if (e.y >= floorY(e.x) - 0.5 && Math.abs(e.x - e.px) > 1.2 && rng.chance(0.3)) fx.add({ x: e.x, y: e.y, vx: -(e.x - e.px) * 10, vy: -6, max: 0.35, c: '#e8dcc8', g: 20 });
  }

  function paw(x: number, y: number) {
    const e = pts[N - 1];
    const d = dist(x, y, e.x, e.y - 3);
    if (d < 16 * opts.reach && pin <= 0) {
      pin = 0.55; pinX = e.x; pinY = e.y;
      if (time - caughtAt > 0.8) { ctx.caught('feather', e.x, e.y - 3, '#fff0f8'); caughtAt = time; }
      for (let i = 0; i < 5; i++) fx.add({ x: e.x, y: e.y - 3, kind: 'feather', vx: rng.range(-30, 30), vy: rng.range(-40, -10), g: 20, drag: 2, max: rng.range(0.8, 1.4), c: colors[i % 3], c2: '#ffffff', spin: rng.range(-5, 5) });
      sfx.pop();
    } else if (d < 70) {
      // A near miss: the hand whips it away.
      move = 'jerk'; t = 0; mt = 0.45;
      hand.tx = clamp(e.x + (e.x - x) * 2.5, 20, W - 20); hand.ty = clamp(hand.y - 20, -30, 60);
    }
  }

  function draw(g: CanvasRenderingContext2D) {
    // Things hidden behind a prop: nothing to do here, props are background for this scene.
    void g;
  }

  function drawTop(g: CanvasRenderingContext2D) {
    // The stick, reaching in from above the picture.
    const sx = hand.x < W / 2 ? hand.x - 70 : hand.x + 70;
    g.fillStyle = col('#8a5a36');
    const n = Math.max(1, Math.round(dist(sx, -40, hand.x, hand.y)));
    for (let i = 0; i <= n; i++) { const k = i / n; g.fillRect(Math.round(sx + (hand.x - sx) * k), Math.round(-40 + (hand.y + 40) * k), 2, 2); }
    g.fillStyle = col('#c9955e');
    for (let i = 0; i <= n; i += 2) { const k = i / n; g.fillRect(Math.round(sx + (hand.x - sx) * k), Math.round(-40 + (hand.y + 40) * k), 1, 1); }
    // The string.
    g.fillStyle = col('#f4efe6');
    for (let i = 1; i < N; i++) {
      const a = pts[i - 1], b = pts[i];
      const m = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
      for (let k = 0; k < m; k++) g.fillRect(Math.round(a.x + ((b.x - a.x) * k) / m), Math.round(a.y + ((b.y - a.y) * k) / m), 1, 1);
    }
    // The lure: three feathers fanned along the last bit of string, and the bell.
    const e = pts[N - 1], p = pts[N - 3];
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    const flutter = Math.sin(time * 18) * 0.12 * Math.min(1, Math.hypot(e.x - e.px, e.y - e.py));
    for (let f = 0; f < 3; f++) {
      const a = ang + (f - 1) * 0.45 + flutter;
      const L = 19 + (f === 1 ? 5 : 0);
      for (let r = 0; r < L; r++) {
        const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
        const w = r < 2 ? 0 : Math.round(Math.sin((r / L) * Math.PI) * 3.2);
        g.fillStyle = col(r % 3 === 0 ? '#ffffff' : colors[f]);
        g.fillRect(Math.round(x - Math.sin(a) * w), Math.round(y + Math.cos(a) * w), 1, 1);
        g.fillRect(Math.round(x + Math.sin(a) * w), Math.round(y - Math.cos(a) * w), 1, 1);
        g.fillStyle = col(colors[f]);
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    // A pompom where the feathers are tied, and the bell.
    g.fillStyle = col(colors[1]);
    g.fillRect(Math.round(e.x) - 3, Math.round(e.y) - 2, 6, 4); g.fillRect(Math.round(e.x) - 2, Math.round(e.y) - 3, 4, 6);
    g.fillStyle = col('#ffffff'); g.fillRect(Math.round(e.x) - 2, Math.round(e.y) - 2, 2, 1);
    g.fillStyle = col('#c9a040'); g.fillRect(Math.round(e.x) - 2, Math.round(e.y) + 2, 4, 4);
    g.fillStyle = col('#ffe08a'); g.fillRect(Math.round(e.x) - 2, Math.round(e.y) + 2, 2, 2);
    g.fillStyle = col('#2a1f2b'); g.fillRect(Math.round(e.x), Math.round(e.y) + 5, 1, 1);
    // A prop in front of a hidden lure hides it: redraw the one it went behind.
    if (move === 'hide' && hideProp && e.y <= hideProp.y && e.x > hideProp.x0 && e.x < hideProp.x1) hideProp.draw(g, time);
  }

  return { update, draw, drawTop, paw };
}

export const wand: SceneDef = {
  id: 'wand',
  name: { uk: 'Вудочка з пір’ям', en: 'Feather wand' },
  about: {
    uk: 'Та сама дражнилка на мотузці: пір’я літає, волочиться підлогою, ховається за мішок і смикається, а від лапи тікає.',
    en: 'The classic teaser on a string: feathers swoop, drag along the floor, hide behind the sack and twitch, and dart away from a paw.',
  },
  energy: 0.9,
  locations: ['livingroom', 'kitchen', 'attic'],
  kind: 'feather',
  icon: 'feather',
  create,
};
