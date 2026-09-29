/**
 * A red squirrel and its oak. Acorns drop out of the crown and bounce in the grass; the squirrel
 * bounds out for them in spurts, freezing with a flick of the tail between, sits up to nibble one,
 * buries another with a flurry of earth, or carries it up the trunk. It runs up and down the
 * trunk head first, goes round the back of it and peeks out from the other side — the oldest game
 * a squirrel plays with anything that watches it — and out along the branches, jumping between them.
 */
import type { SceneDef, SceneCtx, SceneInstance, Ledge } from '../game/types';
import { squirrelSprite, acornSprite, SQ } from '../sprites/squirrel';
import { blit } from '../core/pix';
import { shadow } from '../game/art';
import { clamp } from '../core/rng';
import { depthDraw, dist, type Drawable } from './util';

type Mode = 'ground' | 'trunk' | 'branch' | 'air';
type St = 'go' | 'wait' | 'eat' | 'dig' | 'climb' | 'round' | 'hide' | 'peek' | 'jump';

interface Acorn { x: number; y: number; z: number; vz: number; floor: number; taken: boolean }
interface Trunk { x: number; w: number; top: number; bottom: number }

interface Sq {
  mode: Mode;
  x: number; y: number; face: 1 | -1;
  tr: number; side: -1 | 0 | 1; h: number; up: boolean; hTo: number;
  ledge: Ledge | null;
  st: St; t: number;
  tx: number; ty: number;
  goal: 'acorn' | 'roam' | 'trunk' | 'none';
  acorn: Acorn | null; nut: boolean;
  anim: number; step: number; leg: number;
  jx0: number; jy0: number; jx1: number; jy1: number; jt: number; jd: number; jumpTo: Mode;
  peek: -1 | 1; scared: number;
  /** A pause in the middle of a run or a climb carries on with this afterwards. */
  resume: St | null;
}

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.7, H - 8];
  const trunks: Trunk[] = loc.trunks && loc.trunks.length ? loc.trunks : [{ x: W * 0.3, w: 20, top: H * 0.2, bottom: band[0] + 6 }];
  const branches = (loc.perches || []).filter((l) => l.y < band[0] - 20);
  const props = loc.props || [];
  const acorns: Acorn[] = [];
  let nextDrop = rng.range(1, 3);
  let time = 0;
  const sqs: Sq[] = [];
  const n = opts.density > 1.2 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    sqs.push({ mode: 'ground', x: rng.range(W * 0.2, W * 0.8), y: rng.range(band[0] + 6, band[1] - 4), face: rng.chance(0.5) ? 1 : -1, tr: 0, side: 1, h: 0, up: true, hTo: 0, ledge: null, st: 'wait', t: rng.range(0.5, 2), tx: 0, ty: 0, goal: 'none', acorn: null, nut: false, anim: 0, step: 0, leg: 0, jx0: 0, jy0: 0, jx1: 0, jy1: 0, jt: 0, jd: 1, jumpTo: 'ground', peek: 1, scared: 0, resume: null });
  }

  const sp = (s: Sq) => (s.scared > 0 ? 150 : 95) * opts.speed;
  const baseOf = (tr: Trunk, side: number): [number, number] => [tr.x + side * (tr.w / 2 + 3), tr.bottom - 1];

  function decide(s: Sq) {
    s.goal = 'none';
    s.resume = null;
    if (s.mode === 'ground') {
      const free = acorns.filter((a) => !a.taken && a.z <= 0);
      const r = rng.next();
      if (s.nut) {
        if (r < 0.45) { s.st = 'eat'; s.t = rng.range(2.5, 5); return; }
        if (r < 0.75) { s.st = 'dig'; s.t = rng.range(1.5, 2.5); return; }
        toTrunk(s); return;
      }
      if (free.length && r < 0.55) { const a = free.reduce((b, x) => (dist(x.x, x.floor, s.x, s.y) < dist(b.x, b.floor, s.x, s.y) ? x : b)); s.goal = 'acorn'; s.acorn = a; a.taken = true; go(s, a.x - 6 * Math.sign(a.x - s.x || 1), a.floor); return; }
      if (r < 0.8) { toTrunk(s); return; }
      s.goal = 'roam'; go(s, rng.range(W * 0.08, W * 0.92), rng.range(band[0] + 4, band[1] - 3)); return;
    }
    if (s.mode === 'trunk') {
      const tr = trunks[s.tr];
      const r = rng.next();
      // A branch at this height, reaching out from this side?
      const br = branches.find((l) => Math.abs(l.y - s.h) < 10 && (s.side > 0 ? Math.abs(l.x0 - (tr.x + tr.w / 2)) < 16 : Math.abs(l.x1 - (tr.x - tr.w / 2)) < 16));
      if (br && r < 0.4) { s.mode = 'branch'; s.ledge = br; s.x = s.side > 0 ? br.x0 + 2 : br.x1 - 2; s.y = br.y; s.face = s.side > 0 ? 1 : -1; go(s, s.side > 0 ? br.x1 - 4 : br.x0 + 4, br.y); return; }
      if (r < 0.62) { s.st = 'round'; s.t = rng.range(0.35, 0.7); return; }
      if (r < 0.82 || s.h < tr.top + 30) { s.up = false; s.hTo = tr.bottom - 4; s.st = 'climb'; s.leg = rng.range(20, 50); return; }
      s.up = true; s.hTo = clamp(s.h - rng.range(20, 70), tr.top + 10, tr.bottom - 10); s.st = 'climb'; s.leg = rng.range(20, 50); return;
    }
    if (s.mode === 'branch' && s.ledge) {
      const l = s.ledge;
      const other = branches.filter((b) => b !== l && Math.abs((b.x0 + b.x1) / 2 - s.x) < 110 && Math.abs(b.y - l.y) < 60);
      const r = rng.next();
      if (r < 0.35 && s.nut) { s.st = 'eat'; s.t = rng.range(2, 4); return; }
      if (r < 0.55 && other.length) { const b = rng.pick(other); jump(s, rng.range(b.x0 + 4, b.x1 - 4), b.y, 'branch', b); return; }
      if (r < 0.7) { s.st = 'wait'; s.t = rng.range(1, 3); return; }
      // Back along to the trunk.
      const tr = trunks.reduce((b, t, i) => (Math.abs(t.x - s.x) < Math.abs(trunks[b].x - s.x) ? i : b), 0);
      s.tr = tr; s.goal = 'trunk';
      const T = trunks[tr];
      go(s, s.x > T.x ? T.x + T.w / 2 + 2 : T.x - T.w / 2 - 2, l.y);
    }
  }

  function go(s: Sq, x: number, y: number) {
    s.resume = null;
    s.st = 'go'; s.tx = x; s.ty = y; s.leg = rng.range(30, 90);
  }

  function toTrunk(s: Sq) {
    const tr = trunks.reduce((b, t, i) => (Math.abs(t.x - s.x) < Math.abs(trunks[b].x - s.x) ? i : b), 0);
    s.tr = tr; s.goal = 'trunk';
    const side = s.x < trunks[tr].x ? -1 : 1;
    const [bx, by] = baseOf(trunks[tr], side);
    go(s, bx, by);
  }

  function jump(s: Sq, x: number, y: number, to: Mode, ledge: Ledge | null) {
    s.mode = 'air'; s.st = 'jump';
    s.jx0 = s.x; s.jy0 = s.y; s.jx1 = x; s.jy1 = y; s.jt = 0; s.jd = clamp(dist(s.x, s.y, x, y) / 160, 0.35, 0.8);
    s.jumpTo = to; s.ledge = ledge; s.face = x > s.x ? 1 : -1;
  }

  function scare(s: Sq, x: number, y: number) {
    s.scared = 3;
    ctx.sfx.chatter();
    s.resume = null;
    fx.text(s.x, s.y - 26, '!', '#ffe066');
    if (s.mode === 'ground') toTrunk(s);
    else if (s.mode === 'trunk') { s.st = 'round'; s.t = 0.3; s.peek = x < trunks[s.tr].x ? 1 : -1; }
    else if (s.mode === 'branch') { const tr = trunks[s.tr] || trunks[0]; go(s, s.x > tr.x ? tr.x + tr.w / 2 + 2 : tr.x - tr.w / 2 - 2, s.y); s.goal = 'trunk'; }
    void y;
  }

  function update(dt: number) {
    time += dt;
    nextDrop -= dt;
    if (nextDrop <= 0) {
      nextDrop = rng.range(4, 9);
      if (acorns.filter((a) => !a.taken).length < 4) {
        const tr = rng.pick(trunks);
        acorns.push({ x: clamp(tr.x + rng.range(-70, 70), 8, W - 8), y: 0, z: band[0] - tr.top + rng.range(0, 30), vz: 0, floor: rng.range(band[0] + 4, band[1] - 4), taken: false });
      }
    }
    for (const a of acorns) {
      if (a.z > 0 || a.vz > 0) {
        a.vz -= 300 * dt; a.z += a.vz * dt;
        if (a.z <= 0) { a.z = 0; if (a.vz < -60) { a.vz = -a.vz * 0.35; fx.burst(a.x, a.floor, 2, ['#8a6a3a'], { speed: 12, g: 60, max: 0.3 }); } else a.vz = 0; }
      }
    }
    for (const s of sqs) step(s, dt);
  }

  function step(s: Sq, dt: number) {
    s.anim += dt;
    if (s.scared > 0) s.scared -= dt;
    s.t -= dt;
    switch (s.st) {
      case 'wait':
        if (s.t <= 0) { if (s.resume) { s.st = s.resume; s.resume = null; } else decide(s); }
        break;
      case 'eat':
        if (rng.chance(dt * 3)) fx.burst(s.x + s.face * 5, s.y - 10, 1, ['#8a5a2a', '#c9a060'], { speed: 16, g: 90, max: 0.5 });
        if (s.t <= 0) { s.nut = false; s.st = 'wait'; s.t = rng.range(0.4, 1.2); }
        break;
      case 'dig':
        if (rng.chance(dt * 12)) fx.burst(s.x + s.face * 7, s.y, 2, ['#6a4a2a', '#8a6a3a', '#4a8a3a'], { speed: 30, g: 120, max: 0.5 });
        if (s.t <= 0) { s.nut = false; s.st = 'wait'; s.t = rng.range(0.5, 1.5); }
        break;
      case 'go': {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) s.face = dx > 0 ? 1 : -1;
        const v = sp(s) * (s.mode === 'branch' ? 0.7 : 1);
        const m = Math.min(d, v * dt);
        s.x += (dx / (d || 1)) * m; s.y += (dy / (d || 1)) * m;
        s.step += m; s.leg -= m;
        if (d - m < 0.8) arrive(s);
        else if (s.leg <= 0 && s.scared <= 0) { s.st = 'wait'; s.t = rng.range(0.25, 0.9); s.leg = rng.range(30, 90); s.resume = 'go'; }
        break;
      }
      case 'climb': {
        const tr = trunks[s.tr];
        const v = (s.scared > 0 ? 110 : 55) * opts.speed;
        const d = s.hTo - s.h;
        const m = Math.min(Math.abs(d), v * dt);
        s.h += Math.sign(d) * m; s.step += m; s.leg -= m;
        if (Math.abs(d) - m < 0.5) {
          if (!s.up && s.h >= tr.bottom - 6) { s.mode = 'ground'; const [bx, by] = baseOf(tr, s.side || 1); s.x = bx; s.y = by; s.face = (s.side || 1) as 1 | -1; s.st = 'wait'; s.t = rng.range(0.3, 1); }
          else if (s.scared > 0) { s.st = 'round'; s.t = 0.3; }
          else { s.st = 'wait'; s.t = rng.range(0.5, 2); }
        } else if (s.leg <= 0 && s.scared <= 0) { s.leg = rng.range(20, 50); s.st = 'wait'; s.t = rng.range(0.3, 1.2); s.resume = 'climb'; }
        break;
      }
      case 'round':
        // Round the back of the trunk: gone a moment, then out the other side (or peeking).
        if (s.side !== 0) { s.peek = (-s.side) as 1 | -1; s.side = 0; s.t = s.scared > 0 ? rng.range(1.5, 3) : rng.range(0.35, 0.8); break; }
        if (s.t <= 0) {
          if (s.scared > 0 || rng.chance(0.35)) { s.st = 'peek'; s.t = rng.range(1, 2.2); }
          else { s.side = s.peek; s.st = 'wait'; s.t = rng.range(0.3, 1); }
        }
        break;
      case 'peek':
        if (s.t <= 0) { if (rng.chance(0.5) && s.scared <= 0) { s.side = s.peek; s.st = 'wait'; s.t = 0.6; } else { s.peek = (-s.peek) as 1 | -1; s.st = 'round'; s.t = rng.range(0.5, 1.2); } }
        break;
      case 'jump': {
        s.jt += dt;
        const k = Math.min(1, s.jt / s.jd);
        s.x = s.jx0 + (s.jx1 - s.jx0) * k;
        s.y = s.jy0 + (s.jy1 - s.jy0) * k - Math.sin(k * Math.PI) * 24;
        if (k >= 1) { s.mode = s.jumpTo; s.x = s.jx1; s.y = s.jy1; s.st = 'wait'; s.t = rng.range(0.4, 1.2); }
        break;
      }
      default:
        if (s.t <= 0) decide(s);
    }
  }

  function arrive(s: Sq) {
    if (s.goal === 'acorn' && s.acorn) {
      const a = s.acorn;
      const i = acorns.indexOf(a);
      if (i >= 0) acorns.splice(i, 1);
      s.acorn = null; s.nut = true;
      s.st = 'wait'; s.t = rng.range(0.3, 0.8);
      return;
    }
    if (s.goal === 'trunk') {
      const tr = trunks[s.tr];
      s.mode = 'trunk'; s.side = s.x < tr.x ? -1 : 1; s.h = s.y; s.up = true;
      s.hTo = clamp(tr.bottom - rng.range(40, (tr.bottom - tr.top) * 0.8), tr.top + 8, tr.bottom - 20);
      if (s.scared > 0) s.hTo = clamp(tr.bottom - (tr.bottom - tr.top) * 0.6, tr.top + 8, tr.bottom - 20);
      s.st = 'climb'; s.leg = rng.range(20, 60); s.goal = 'none';
      return;
    }
    if (s.goal === 'roam') { s.st = 'eat'; s.t = rng.range(1.2, 2.5); s.nut = false; s.goal = 'none'; return; }
    s.st = 'wait'; s.t = rng.range(0.5, 1.5);
  }

  function paw(x: number, y: number) {
    for (const s of sqs) {
      const [sx, sy] = where(s);
      const d = dist(x, y, sx, sy - 10);
      const visible = !(s.mode === 'trunk' && s.side === 0 && s.st !== 'peek');
      if (visible && d < 13 * opts.reach) ctx.caught('squirrel', sx, sy - 10, '#ffb070');
      if (d < 90) scare(s, x, y);
    }
    for (const a of acorns) if (!a.taken && dist(x, y, a.x, a.floor - a.z - 3) < 10) { a.vz = 120; a.x = clamp(a.x + rng.range(-20, 20), 8, W - 8); }
  }

  function where(s: Sq): [number, number] {
    if (s.mode !== 'trunk') return [s.x, s.y];
    const tr = trunks[s.tr];
    return [tr.x + (s.side || s.peek) * (tr.w / 2), s.h];
  }

  function drawSq(g: CanvasRenderingContext2D, s: Sq) {
    if (s.mode === 'trunk') {
      const tr = trunks[s.tr];
      const img = squirrelSprite('climb', Math.floor(s.step / 5));
      const side = s.side !== 0 ? s.side : s.peek;
      const x = tr.x + side * (tr.w / 2), y = s.h;
      const flipX = side < 0;
      g.save();
      if (s.side === 0) {
        if (s.st !== 'peek') { g.restore(); return; }
        // Only what sticks out past the edge of the trunk shows.
        g.beginPath();
        if (side > 0) g.rect(Math.round(tr.x + tr.w / 2), 0, W, H); else g.rect(0, 0, Math.round(tr.x - tr.w / 2), H);
        g.clip();
      }
      const peekShift = s.side === 0 ? -side * 6 : 0;
      g.translate(Math.round(x + peekShift), Math.round(y));
      if (!s.up && s.st === 'climb') g.scale(1, -1);
      if (flipX) g.scale(-1, 1);
      g.drawImage(img, -8, -SQ.h + 4);
      g.restore();
      return;
    }
    const pose = s.st === 'eat' ? 'sit' : s.st === 'dig' ? 'dig' : s.st === 'go' || s.st === 'jump' ? 'run' : 'sit';
    const f = s.st === 'go' ? Math.floor(s.step / 7) : s.st === 'jump' ? 0 : s.st === 'eat' ? Math.floor(s.anim * 6) : s.st === 'dig' ? Math.floor(s.anim * 10) : 0;
    if (s.mode === 'ground') shadow(g, s.x, s.y, 18, 3, 0.24);
    blit(g, squirrelSprite(pose, f), s.x, s.y, SQ.ax, SQ.ay, s.face < 0);
    if (s.nut && pose === 'run') blit(g, acornSprite(), s.x + s.face * 11, s.y - 11, 3, 4);
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    const items: Drawable[] = [];
    for (const a of acorns) if (!a.taken && a.z <= 0) items.push({ y: a.floor, draw: () => { shadow(g, a.x, a.floor, 6, 2, 0.2); blit(g, acornSprite(), a.x, a.floor, 3, 7); } });
    for (const s of sqs) {
      if (s.mode === 'ground') items.push({ y: s.y, draw: () => drawSq(g, s) });
    }
    depthDraw(g, t, items, props);
    for (const s of sqs) if (s.mode === 'trunk' || s.mode === 'branch') drawSq(g, s);
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const a of acorns) if (!a.taken && a.z > 0) blit(g, acornSprite(), a.x, a.floor - a.z, 3, 7);
    for (const s of sqs) if (s.mode === 'air') drawSq(g, s);
  }

  return { update, draw, drawTop, paw };
}

export const squirrel: SceneDef = {
  id: 'squirrel',
  name: { uk: 'Білка на дубі', en: 'Squirrel in the oak' },
  about: {
    uk: 'Білка збирає жолуді, що падають з дуба, гризе їх, закопує, бігає по стовбуру, ховається за ним і визирає з іншого боку.',
    en: 'A squirrel gathers falling acorns, nibbles and buries them, runs up the trunk, hides behind it and peeks out from the other side.',
  },
  energy: 0.6,
  locations: ['park', 'forest'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'squirrel',
  icon: 'squirrel',
  create,
};
