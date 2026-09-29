/**
 * The small world in the grass, each thing with its own way of moving: ladybirds wander on
 * wiggly paths and now and then open their wing cases and fly off; a beetle trundles; a line of
 * ants runs between the edge of the picture and their anthill, the ones coming home carrying bits
 * of leaf, and a paw on the trail scatters them until they find it again; a caterpillar inches
 * along; a grasshopper sits still for ages and then jumps a whole screen; a spider lets itself
 * down from a branch on its thread and climbs back up.
 */
import type { SceneDef, SceneCtx, SceneInstance, Ledge } from '../game/types';
import { ladybugSprite, beetleSprite, antSprite, spiderSprite, caterpillarSprite, grasshopperSprite } from '../sprites/insects';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { shadow, oval, rect } from '../game/art';
import { clamp } from '../core/rng';
import { noise1 } from '../core/steer';
import { depthDraw, dist, type Drawable } from './util';

interface Crawler {
  kind: 'lady' | 'beetle';
  x: number; y: number; a: number; v: number; seed: number;
  stop: number; walk: number;
  fly: number; fx0: number; fy0: number; fx1: number; fy1: number; ft: number;
}
interface Ant { s: number; dir: 1 | -1; carry: string | null; off: number; scatter: number; x: number; y: number; vx: number; vy: number; step: number }
interface Hopper { x: number; y: number; face: 1 | -1; t: number; jump: number; x0: number; y0: number; x1: number; y1: number; dur: number }
interface Spider { x: number; top: number; len: number; want: number; t: number; swing: number; st: 'down' | 'hang' | 'up' | 'gone'; wait: number }
interface Worm { x: number; y: number; dir: 1 | -1; f: number }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.7, H - 8];
  const props = loc.props || [];
  const crawlers: Crawler[] = [];
  let time = 0;
  const inBandY = (y: number) => clamp(y, band[0] + 2, band[1] - 2);

  for (let i = 0; i < Math.round(2 + opts.density * 2); i++) crawlers.push(mkCrawler('lady'));
  crawlers.push(mkCrawler('beetle'));

  function mkCrawler(kind: Crawler['kind']): Crawler {
    return { kind, x: rng.range(W * 0.1, W * 0.9), y: rng.range(band[0] + 4, band[1] - 4), a: rng.range(0, Math.PI * 2), v: kind === 'beetle' ? 9 : 15, seed: rng.range(0, 100), stop: rng.range(1, 4), walk: 0, fly: 0, fx0: 0, fy0: 0, fx1: 0, fy1: 0, ft: 0 };
  }

  // The ants' road: from off the left or right edge to the anthill.
  const hillX = rng.range(W * 0.35, W * 0.65), hillY = inBandY(rng.range(band[0] + 14, band[1] - 10));
  const fromLeft = rng.chance(0.5);
  const road: [number, number][] = [];
  {
    const x0 = fromLeft ? -12 : W + 12, y0 = inBandY(rng.range(band[0] + 6, band[1] - 6));
    const mx = (x0 + hillX) / 2, my = inBandY((y0 + hillY) / 2 + rng.range(-14, 14));
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      // A gentle curve through a middle point.
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * hillX;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * hillY;
      road.push([x, y]);
    }
  }
  const roadLen = road.reduce((a, p, i) => (i ? a + dist(p[0], p[1], road[i - 1][0], road[i - 1][1]) : 0), 0);
  function roadAt(s: number): [number, number, number] {
    s = clamp(s, 0, roadLen);
    let acc = 0;
    for (let i = 1; i < road.length; i++) {
      const d = dist(road[i][0], road[i][1], road[i - 1][0], road[i - 1][1]);
      if (acc + d >= s) {
        const k = (s - acc) / d;
        return [road[i - 1][0] + (road[i][0] - road[i - 1][0]) * k, road[i - 1][1] + (road[i][1] - road[i - 1][1]) * k, Math.atan2(road[i][1] - road[i - 1][1], road[i][0] - road[i - 1][0])];
      }
      acc += d;
    }
    const L = road[road.length - 1];
    return [L[0], L[1], 0];
  }
  const ants: Ant[] = [];
  const nAnts = Math.round(8 + opts.density * 6);
  for (let i = 0; i < nAnts; i++) {
    const dir = (i % 2 ? 1 : -1) as 1 | -1;
    ants.push({ s: rng.range(0, roadLen), dir, carry: dir > 0 && rng.chance(0.6) ? rng.pick(['#7ad05a', '#f4d23a', '#ffffff']) : null, off: rng.range(-2, 2), scatter: 0, x: 0, y: 0, vx: 0, vy: 0, step: 0 });
  }

  const hopper: Hopper = { x: rng.range(W * 0.15, W * 0.85), y: inBandY(rng.range(band[0], band[1])), face: rng.chance(0.5) ? 1 : -1, t: rng.range(3, 7), jump: 0, x0: 0, y0: 0, x1: 0, y1: 0, dur: 0.6 };
  const worm: Worm = { x: rng.range(W * 0.2, W * 0.8), y: inBandY(band[1] - 8), dir: rng.chance(0.5) ? 1 : -1, f: 0 };
  const hang: Ledge[] = (loc.perches || []).filter((p) => p.y < band[0] - 30 && p.x1 - p.x0 > 16);
  const spider: Spider | null = hang.length ? (() => { const p = rng.pick(hang); return { x: rng.range(p.x0 + 4, p.x1 - 4), top: p.y + 2, len: 0, want: 0, t: rng.range(3, 8), swing: 0, st: 'gone' as const, wait: rng.range(2, 6) }; })() : null;

  function hop(h: Hopper, away?: number) {
    h.x0 = h.x; h.y0 = h.y;
    const d = away ?? (rng.chance(0.5) ? 1 : -1);
    h.face = d > 0 ? 1 : -1;
    h.x1 = clamp(h.x + d * rng.range(50, 130), 10, W - 10);
    h.y1 = inBandY(h.y + rng.range(-16, 16));
    h.dur = rng.range(0.45, 0.7);
    h.jump = 0.0001;
    ctx.sfx.chirr();
  }

  function update(dt: number) {
    time += dt;
    for (const c of crawlers) {
      if (c.fly > 0) {
        c.ft += dt;
        const k = c.ft / c.fly;
        if (k >= 1) { c.fly = 0; c.x = c.fx1; c.y = c.fy1; c.stop = rng.range(0.5, 2); }
        else { c.x = c.fx0 + (c.fx1 - c.fx0) * k; c.y = c.fy0 + (c.fy1 - c.fy0) * k; }
        continue;
      }
      c.stop -= dt;
      if (c.stop > 0) continue;
      if (c.stop < -rng.range(2, 6)) {
        c.stop = rng.range(0.6, 2.5);
        if (c.kind === 'lady' && rng.chance(0.3)) startFly(c);
        continue;
      }
      c.a += noise1(time * 0.8, c.seed) * 3 * dt;
      if (c.y < band[0] + 4) c.a = Math.PI / 2; if (c.y > band[1] - 3) c.a = -Math.PI / 2;
      if (c.x < 6) c.a = 0; if (c.x > W - 6) c.a = Math.PI;
      c.x += Math.cos(c.a) * c.v * opts.speed * dt;
      c.y += Math.sin(c.a) * c.v * 0.6 * opts.speed * dt;
      c.walk += dt;
    }
    for (const a of ants) {
      if (a.scatter > 0) {
        a.scatter -= dt;
        a.x += a.vx * dt; a.y += a.vy * dt; a.vx *= 0.97; a.vy *= 0.97;
        a.step += dt;
        // Find the road again.
        if (a.scatter <= 0) { const [rx, ry] = roadAt(a.s); a.vx = (rx - a.x) * 1.5; a.vy = (ry - a.y) * 1.5; a.scatter = -1.2; }
        continue;
      }
      if (a.scatter < 0) {
        a.scatter = Math.min(0, a.scatter + dt);
        const [rx, ry] = roadAt(a.s);
        a.x += (rx - a.x) * Math.min(1, dt * 2); a.y += (ry - a.y) * Math.min(1, dt * 2); a.step += dt;
        continue;
      }
      a.s += a.dir * 16 * opts.speed * dt;
      a.step += dt;
      if (a.s > roadLen) { a.s = roadLen; a.dir = -1; a.carry = null; }
      if (a.s < 0) { a.s = 0; a.dir = 1; a.carry = rng.chance(0.7) ? rng.pick(['#7ad05a', '#f4d23a', '#ffffff']) : null; }
      const [x, y] = roadAt(a.s);
      a.x = x + Math.sin(time * 5 + a.s) * 0.6; a.y = y + a.off;
    }
    // Grasshopper: long stillness, then a leap.
    if (hopper.jump > 0) {
      hopper.jump += dt;
      const k = hopper.jump / hopper.dur;
      if (k >= 1) { hopper.jump = 0; hopper.x = hopper.x1; hopper.y = hopper.y1; hopper.t = rng.range(3, 9) / Math.max(0.5, opts.intensity + 0.5); }
    } else {
      hopper.t -= dt;
      if (hopper.t <= 0) hop(hopper);
    }
    worm.f += dt * 2.2 * opts.speed;
    if (Math.floor(worm.f) !== Math.floor(worm.f - dt * 2.2 * opts.speed) && Math.floor(worm.f) % 4 === 0) worm.x += worm.dir * 4;
    if (worm.x < 10 || worm.x > W - 10) worm.dir = (-worm.dir) as 1 | -1;
    if (spider) {
      spider.swing += dt;
      if (spider.st === 'gone') { spider.wait -= dt; if (spider.wait <= 0) { spider.st = 'down'; spider.want = rng.range(H * 0.18, band[0] - spider.top - 10); } }
      else if (spider.st === 'down') { spider.len += 24 * opts.speed * dt; if (spider.len >= spider.want) { spider.st = 'hang'; spider.t = rng.range(3, 8); } }
      else if (spider.st === 'hang') { spider.t -= dt; if (spider.t <= 0) spider.st = 'up'; if (rng.chance(dt * 0.4)) { spider.want = clamp(spider.want + rng.range(-20, 20), 10, band[0] - spider.top - 10); spider.st = 'down'; if (spider.len > spider.want) spider.st = 'up'; } }
      else { spider.len -= 30 * dt; if (spider.len <= 0) { spider.len = 0; spider.st = 'gone'; spider.wait = rng.range(5, 12); } else if (spider.st === 'up' && spider.len < spider.want - 30 && rng.chance(dt * 0.3)) { spider.st = 'hang'; spider.t = rng.range(1, 3); } }
    }
  }

  function startFly(c: Crawler) {
    c.fx0 = c.x; c.fy0 = c.y;
    c.fx1 = clamp(c.x + rng.range(-120, 120), 10, W - 10);
    c.fy1 = inBandY(c.y + rng.range(-20, 20));
    c.fly = rng.range(1, 1.8); c.ft = 0;
  }

  function paw(x: number, y: number) {
    for (const c of crawlers) {
      const d = dist(x, y, c.x, c.y);
      if (d < 9 * opts.reach && c.fly === 0) ctx.caught('bug', c.x, c.y, '#ff8a7a');
      if (d < 50 && c.fly === 0) { if (c.kind === 'lady') startFly(c); else { c.a = Math.atan2(c.y - y, c.x - x); c.stop = -0.01; } }
    }
    let hitAnt = false;
    for (const a of ants) {
      const d = dist(x, y, a.x, a.y);
      if (d < 40) {
        const ang = Math.atan2(a.y - y, a.x - x) + rng.range(-0.8, 0.8);
        a.scatter = rng.range(1.2, 2.2); a.vx = Math.cos(ang) * rng.range(25, 45); a.vy = Math.sin(ang) * rng.range(15, 30);
        if (d < 6 * opts.reach) hitAnt = true;
      }
    }
    if (hitAnt) ctx.caught('bug', x, y, '#ffd23f');
    const hd = dist(x, y, hopper.x, hopper.y - 4);
    if (hd < 12 * opts.reach && hopper.jump === 0) ctx.caught('bug', hopper.x, hopper.y - 4, '#b8f07a');
    if (hd < 70 && hopper.jump === 0) hop(hopper, hopper.x > x ? 1 : -1);
    if (dist(x, y, worm.x, worm.y - 3) < 12 * opts.reach) { ctx.caught('bug', worm.x, worm.y - 3, '#b8f07a'); worm.dir = (-worm.dir) as 1 | -1; }
    if (spider && spider.st !== 'gone') {
      const sx = spider.x + Math.sin(spider.swing * 1.3) * spider.len * 0.05, sy = spider.top + spider.len;
      if (dist(x, y, sx, sy) < 12 * opts.reach) ctx.caught('bug', sx, sy, '#c9b8ff');
      if (dist(x, y, sx, sy) < 60) { spider.st = 'up'; }
    }
    void fx;
  }

  function crawlerImg(c: Crawler): HTMLCanvasElement {
    const f = Math.floor(c.walk * 8);
    return c.kind === 'lady' ? ladybugSprite(f, c.fly > 0) : beetleSprite(f);
  }

  /** Draw a top-view sprite turned to the nearest quarter of its heading (exact pixels). */
  function drawTurned(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, a: number) {
    const q = ((Math.round((a + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;   // 0 up, 1 right, 2 down, 3 left
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.rotate(q * Math.PI / 2);
    g.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
    g.restore();
  }

  function drawHill(g: CanvasRenderingContext2D) {
    oval(g, hillX, hillY, 14, 5, '#8a6a4a');
    oval(g, hillX, hillY - 2, 11, 4, '#a8845a');
    oval(g, hillX - 2, hillY - 3, 6, 2, '#c09a6a');
    rect(g, hillX - 1, hillY - 3, 3, 2, '#2a1a12');
    for (let i = 0; i < 10; i++) { g.fillStyle = col('#6a4a2a'); g.fillRect(Math.round(hillX + Math.sin(i * 2.1) * 10), Math.round(hillY + Math.cos(i * 1.7) * 3), 1, 1); }
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    const items: Drawable[] = [{ y: hillY, draw: () => drawHill(g) }];
    for (const a of ants) {
      items.push({ y: a.y, draw: () => {
        const [, , ang] = roadAt(a.s);
        const heading = a.scatter > 0 ? Math.atan2(a.vy, a.vx) : a.dir > 0 ? ang : ang + Math.PI;
        drawTurned(g, antSprite(Math.floor(a.step * 10), a.carry), a.x, a.y, heading);
      } });
    }
    for (const c of crawlers) {
      if (c.fly > 0) continue;
      items.push({ y: c.y, draw: () => { shadow(g, c.x + 1, c.y + 2, c.kind === 'beetle' ? 12 : 9, 3, 0.2); drawTurned(g, crawlerImg(c), c.x, c.y, c.a); } });
    }
    items.push({ y: worm.y, draw: () => blit(g, caterpillarSprite(Math.floor(worm.f)), worm.x, worm.y, 11, 9, worm.dir < 0) });
    if (hopper.jump === 0) items.push({ y: hopper.y, draw: () => { shadow(g, hopper.x, hopper.y, 14, 3, 0.2); blit(g, grasshopperSprite(false), hopper.x, hopper.y, 10, 11, hopper.face < 0); } });
    depthDraw(g, t, items, props);
  }

  function drawTop(g: CanvasRenderingContext2D) {
    for (const c of crawlers) {
      if (c.fly <= 0) continue;
      const k = c.ft / c.fly;
      const lift = Math.sin(k * Math.PI) * 40;
      shadow(g, c.x, c.y, 7, 2, 0.15);
      drawTurned(g, ladybugSprite(Math.floor(time * 20), true), c.x, c.y - lift, Math.atan2(c.fy1 - c.fy0, c.fx1 - c.fx0));
    }
    if (hopper.jump > 0) {
      const k = Math.min(1, hopper.jump / hopper.dur);
      const x = hopper.x0 + (hopper.x1 - hopper.x0) * k, yb = hopper.y0 + (hopper.y1 - hopper.y0) * k;
      const lift = Math.sin(k * Math.PI) * 46;
      shadow(g, x, yb, 12, 3, 0.15);
      blit(g, grasshopperSprite(true), x, yb - lift, 10, 11, hopper.face < 0);
    }
    if (spider && spider.st !== 'gone') {
      const sx = spider.x + Math.sin(spider.swing * 1.3) * spider.len * 0.05, sy = spider.top + spider.len;
      g.fillStyle = col('#e8e8f0');
      g.globalAlpha = 0.7;
      for (let y = spider.top; y < sy - 4; y++) { const k = (y - spider.top) / Math.max(1, spider.len); g.fillRect(Math.round(spider.x + (sx - spider.x) * k), Math.round(y), 1, 1); }
      g.globalAlpha = 1;
      blit(g, spiderSprite(Math.floor(time * 3)), sx, sy, 7, 3);
    }
  }

  return { update, draw, drawTop, paw };
}

export const bugs: SceneDef = {
  id: 'bugs',
  name: { uk: 'Жучки в траві', en: 'Bugs in the grass' },
  about: {
    uk: 'Сонечка блукають і злітають, мурахи несуть листочки до мурашника, коник раптом стрибає через увесь екран, а павук спускається на павутинці.',
    en: 'Ladybirds wander and take off, ants carry leaves to their hill, a grasshopper suddenly leaps across the screen, a spider drops on its thread.',
  },
  energy: 0.5,
  locations: ['garden', 'meadow', 'forest'],
  tods: ['dawn', 'day', 'dusk'],
  kind: 'bug',
  icon: 'bug',
  create,
};
