/**
 * Three arcade games that play themselves on the neon board — something bright and busy to
 * paw at, and something for the people in the room to watch.
 *
 * Mouse maze: mice run a maze eating cheese crumbs, fleeing two cats that hunt them by the
 * shortest path; a big piece of cheese turns the tables and the cats run. Brick breaker: the
 * paddle plays itself and the ball knocks out bricks laid out as a heart, a cat, a fish.
 * Snake: a neon snake finds its way to the next treat without biting its own tail.
 */
import type { SceneDef, SceneCtx, SceneInstance, Light } from '../game/types';
import { col } from '../core/color';
import { clamp, type Rng } from '../core/rng';
import { pixelText } from '../core/font';
import { dist } from './util';
import type { Arcade } from '../world/arcade';
import { layer } from '../core/screen';

type Board = { x: number; y: number; w: number; h: number };

function boardOf(ctx: SceneCtx): Board {
  const a = ctx.loc as Arcade;
  return a.board || { x: 10, y: 10, w: ctx.W - 20, h: ctx.H - 20 };
}

/** The glowing frame and dark glass of the arcade board. */
function drawBoard(g: CanvasRenderingContext2D, b: Board, t: number, accent = '#4ae8ff') {
  g.globalAlpha = 0.82;
  g.fillStyle = col('#070312');
  g.fillRect(b.x, b.y, b.w, b.h);
  g.globalAlpha = 1;
  const pulse = 0.75 + Math.sin(t * 2) * 0.25;
  g.globalAlpha = pulse;
  g.fillStyle = col(accent);
  g.fillRect(b.x - 2, b.y - 2, b.w + 4, 1); g.fillRect(b.x - 2, b.y + b.h + 1, b.w + 4, 1);
  g.fillRect(b.x - 2, b.y - 2, 1, b.h + 4); g.fillRect(b.x + b.w + 1, b.y - 2, 1, b.h + 4);
  g.globalAlpha = 0.35;
  g.fillRect(b.x - 3, b.y - 3, b.w + 6, 1); g.fillRect(b.x - 3, b.y + b.h + 2, b.w + 6, 1);
  g.fillRect(b.x - 3, b.y - 3, 1, b.h + 6); g.fillRect(b.x + b.w + 2, b.y - 3, 1, b.h + 6);
  g.globalAlpha = 1;
}

function scoreText(g: CanvasRenderingContext2D, b: Board, s: number, c = '#fff07a') {
  pixelText(g, '★ ' + s, b.x + b.w / 2, b.y + 9, c);
}

// ------------------------------------------------------------------------------------------
// Mouse maze
// ------------------------------------------------------------------------------------------

/** A maze with loops: carved by a random walk, then some walls knocked through. Exported for tests. */
export function makeMaze(cols: number, rows: number, rng: Rng, loops = 0.14): Uint8Array {
  const m = new Uint8Array(cols * rows).fill(1);
  const at = (x: number, y: number) => y * cols + x;
  const stack: [number, number][] = [[1, 1]];
  m[at(1, 1)] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && m[at(nx, ny)] === 1;
    });
    if (!dirs.length) { stack.pop(); continue; }
    const [dx, dy] = rng.pick(dirs);
    m[at(x + dx / 2, y + dy / 2)] = 0;
    m[at(x + dx, y + dy)] = 0;
    stack.push([x + dx, y + dy]);
  }
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
    if (m[at(x, y)] !== 1) continue;
    const h = m[at(x - 1, y)] === 0 && m[at(x + 1, y)] === 0, v = m[at(x, y - 1)] === 0 && m[at(x, y + 1)] === 0;
    if ((h || v) && rng.chance(loops)) m[at(x, y)] = 0;
  }
  return m;
}

/** Steps from every open cell to the nearest of the sources (−1 for walls and unreachable). */
export function distField(m: Uint8Array, cols: number, rows: number, sources: [number, number][]): Int16Array {
  const d = new Int16Array(cols * rows).fill(-1);
  const q: number[] = [];
  for (const [x, y] of sources) { const i = y * cols + x; if (m[i] === 0 && d[i] < 0) { d[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (m[j] !== 0 || d[j] >= 0) continue;
      d[j] = d[i] + 1;
      q.push(j);
    }
  }
  return d;
}

interface Walker { x: number; y: number; nx: number; ny: number; p: number; dx: number; dy: number; speed: number; dead: number; scared?: number; dizzy?: number; c?: string }

function createMaze(ctx: SceneCtx): SceneInstance {
  const { rng, fx, sfx, opts } = ctx;
  const b = boardOf(ctx);
  const cell = 12;
  let cols = Math.floor(b.w / cell), rows = Math.floor((b.h - 12) / cell);
  if (cols % 2 === 0) cols--; if (rows % 2 === 0) rows--;
  const ox = b.x + Math.floor((b.w - cols * cell) / 2), oy = b.y + 12 + Math.floor((b.h - 12 - rows * cell) / 2);
  let maze = makeMaze(cols, rows, rng);
  let dots = new Uint8Array(cols * rows);
  let wallLayer: HTMLCanvasElement;
  let score = 0;
  let time = 0;
  let clearT = 0;
  const open: [number, number][] = [];
  const mice: Walker[] = [];
  const cats: Walker[] = [];

  function build() {
    maze = makeMaze(cols, rows, rng);
    open.length = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (maze[y * cols + x] === 0) open.push([x, y]);
    dots = new Uint8Array(cols * rows);
    for (const [x, y] of open) dots[y * cols + x] = 1;
    // Big cheese in the four corners.
    const corners: [number, number][] = [[1, 1], [cols - 2, 1], [1, rows - 2], [cols - 2, rows - 2]];
    for (const [x, y] of corners) if (maze[y * cols + x] === 0) dots[y * cols + x] = 2;
    const [cv, g] = layer(cols * cell, rows * cell);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (maze[y * cols + x] !== 1) continue;
      g.fillStyle = col('#141a5a');
      g.fillRect(x * cell, y * cell, cell, cell);
      g.fillStyle = col('#4ae8ff');
      const open2 = (dx: number, dy: number) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < cols && ny < rows && maze[ny * cols + nx] === 0; };
      if (open2(0, -1)) g.fillRect(x * cell, y * cell, cell, 1);
      if (open2(0, 1)) g.fillRect(x * cell, y * cell + cell - 1, cell, 1);
      if (open2(-1, 0)) g.fillRect(x * cell, y * cell, 1, cell);
      if (open2(1, 0)) g.fillRect(x * cell + cell - 1, y * cell, 1, cell);
    }
    wallLayer = cv;
    mice.length = 0; cats.length = 0;
    const nm = Math.round(clamp(2 + opts.density, 2, 4));
    for (let i = 0; i < nm; i++) { const [x, y] = rng.pick(open); mice.push({ x, y, nx: x, ny: y, p: 1, dx: 0, dy: 0, speed: 5.2 * opts.speed, dead: 0 }); }
    const cx = Math.floor(cols / 2) | 1, cy = Math.floor(rows / 2) | 1;
    const home = open.reduce((best, c) => (Math.abs(c[0] - cx) + Math.abs(c[1] - cy) < Math.abs(best[0] - cx) + Math.abs(best[1] - cy) ? c : best), open[0]);
    for (const c of ['#f0923a', '#3a3440', '#b8b0c0'].slice(0, opts.intensity > 0.5 ? 3 : 2)) cats.push({ x: home[0], y: home[1], nx: home[0], ny: home[1], p: 1, dx: 0, dy: 0, speed: 4.2 * opts.speed, dead: 0, scared: 0, dizzy: 0, c });
  }
  build();

  const nbrs = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => maze[(y + dy) * cols + x + dx] === 0);

  function choose(w: Walker, field: Int16Array, toward: boolean, jitter: number) {
    const opts2 = nbrs(w.nx, w.ny);
    let best: number[] | null = null, bv = toward ? Infinity : -Infinity;
    for (const [dx, dy] of opts2) {
      const reverse = dx === -w.dx && dy === -w.dy && opts2.length > 1;
      const v = field[(w.ny + dy) * cols + w.nx + dx] + (reverse ? (toward ? 3 : -3) : 0) + rng.range(0, jitter);
      if (toward ? v < bv : v > bv) { bv = v; best = [dx, dy]; }
    }
    if (!best) best = [0, 0];
    w.x = w.nx; w.y = w.ny;
    w.dx = best[0]; w.dy = best[1];
    w.nx = w.x + w.dx; w.ny = w.y + w.dy;
    w.p = 0;
  }

  function update(dt: number) {
    time += dt;
    if (clearT > 0) { clearT -= dt; if (clearT <= 0) build(); return; }
    const liveMice = mice.filter((m) => m.dead <= 0);
    const liveCats = cats.filter((c) => c.dead <= 0);
    const fromCats = distField(maze, cols, rows, liveCats.filter((c) => !(c.scared! > 0)).map((c) => [c.nx, c.ny]));
    const fromMice = distField(maze, cols, rows, liveMice.map((m) => [m.nx, m.ny]));
    const dotCells: [number, number][] = [];
    for (let i = 0; i < dots.length; i++) if (dots[i]) dotCells.push([i % cols, (i / cols) | 0]);
    if (!dotCells.length) { clearT = 2.5; fx.burst(b.x + b.w / 2, b.y + b.h / 2, 30, ['#fff07a', '#ff4ad8', '#4ae8ff'], { speed: 90, g: 40, max: 1.2 }); sfx.ding(); return; }
    const toDots = distField(maze, cols, rows, dotCells);
    for (const m of mice) {
      if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) { const [x, y] = rng.pick(open); m.x = m.nx = x; m.y = m.ny = y; m.p = 1; } continue; }
      m.p += dt * m.speed;
      if (m.p >= 1) {
        const i = m.ny * cols + m.nx;
        if (dots[i]) {
          if (dots[i] === 2) { for (const c of cats) c.scared = 7; sfx.ding(); } else sfx.blip();
          dots[i] = 0; score += 10;
        }
        const danger = fromCats[i] >= 0 && fromCats[i] < 5;
        if (danger) choose(m, fromCats, false, 0.5); else choose(m, toDots, true, 0.6);
      }
    }
    for (const c of cats) {
      if (c.dead > 0) { c.dead -= dt; continue; }
      if (c.dizzy! > 0) { c.dizzy! -= dt; continue; }
      if (c.scared! > 0) c.scared! -= dt;
      c.p += dt * c.speed * (c.scared! > 0 ? 0.6 : 1);
      if (c.p >= 1) {
        if (c.scared! > 0) choose(c, fromMice, false, 1.5);
        else choose(c, fromMice, true, rng.chance(0.2) ? 6 : 0.8);
      }
    }
    // Meetings in the corridors.
    for (const m of mice) {
      if (m.dead > 0) continue;
      const [mx, my] = pos(m);
      for (const c of cats) {
        if (c.dead > 0) continue;
        const [cx, cy] = pos(c);
        if (dist(mx, my, cx, cy) < cell * 0.7) {
          if (c.scared! > 0) { c.dead = 3; score += 200; fx.text(cx, cy - 6, '200', '#4ae8ff'); c.scared = 0; }
          else { m.dead = 2; fx.burst(mx, my, 10, ['#ffffff', '#b8b0c0'], { speed: 40, g: 0, max: 0.5 }); }
        }
      }
    }
  }

  const pos = (w: Walker): [number, number] => {
    const k = Math.min(1, w.p);
    return [ox + (w.x + (w.nx - w.x) * k) * cell + cell / 2, oy + (w.y + (w.ny - w.y) * k) * cell + cell / 2];
  };

  function paw(x: number, y: number) {
    for (const m of mice) {
      if (m.dead > 0) continue;
      const [mx, my] = pos(m);
      if (dist(x, y, mx, my) < 9 * opts.reach) { m.dead = 1.5; ctx.caught('arcade', mx, my, '#fff07a'); }
    }
    for (const c of cats) {
      if (c.dead > 0) continue;
      const [cx, cy] = pos(c);
      if (dist(x, y, cx, cy) < 9 * opts.reach) { c.dizzy = 2; fx.text(cx, cy - 8, '?', '#ffffff'); }
    }
  }

  function drawMouse(g: CanvasRenderingContext2D, m: Walker) {
    const [x, y] = pos(m);
    const X = Math.round(x), Y = Math.round(y);
    // A little mouse from above: body, snout, two round ears, a tail that whips.
    const dx = m.dx || 1, dy = m.dy;
    const hor = dy === 0;
    const wag = Math.floor(time * 8) % 2 ? 1 : -1;
    g.fillStyle = col('#2a1f2b');
    if (hor) g.fillRect(X - 5, Y - 3, 10, 7); else g.fillRect(X - 3, Y - 5, 7, 10);
    g.fillStyle = col('#c9c8d6');
    if (hor) { g.fillRect(X - 4, Y - 2, 8, 5); g.fillRect(X + dx * 4, Y - 1, 1, 3); }
    else { g.fillRect(X - 2, Y - 4, 5, 8); g.fillRect(X - 1, Y + dy * 4, 3, 1); }
    g.fillStyle = col('#ff9aa6');
    if (hor) { g.fillRect(X + dx * 2, Y - 3, 2, 1); g.fillRect(X + dx * 2, Y + 3, 2, 1); g.fillRect(X + dx * 5, Y, 1, 1); g.fillRect(X - dx * 6, Y + 1, 1, 1); g.fillRect(X - dx * 7, Y + 1 + wag, 1, 1); g.fillRect(X - dx * 8, Y + 1 + wag, 1, 1); }
    else { g.fillRect(X - 3, Y + dy * 2, 1, 2); g.fillRect(X + 3, Y + dy * 2, 1, 2); g.fillRect(X, Y + dy * 5, 1, 1); g.fillRect(X, Y - dy * 6, 1, 1); g.fillRect(X + wag, Y - dy * 7, 1, 1); g.fillRect(X + wag, Y - dy * 8, 1, 1); }
    g.fillStyle = col('#2a1f2b');
    if (hor) { g.fillRect(X + dx * 3, Y - 1, 1, 1); g.fillRect(X + dx * 3, Y + 1, 1, 1); } else { g.fillRect(X - 1, Y + dy * 3, 1, 1); g.fillRect(X + 1, Y + dy * 3, 1, 1); }
  }

  function drawCat(g: CanvasRenderingContext2D, c: Walker) {
    const [x, y] = pos(c);
    const X = Math.round(x), Y = Math.round(y);
    const scared = c.scared! > 0;
    const flash = scared && c.scared! < 2 && Math.floor(time * 6) % 2 === 0;
    const body = scared ? (flash ? '#ffffff' : '#3a5aff') : c.c!;
    g.fillStyle = col('#07030f');
    g.fillRect(X - 6, Y - 4, 13, 9); g.fillRect(X - 6, Y - 7, 4, 4); g.fillRect(X + 3, Y - 7, 4, 4);
    g.fillStyle = col(body);
    g.fillRect(X - 5, Y - 3, 11, 7); g.fillRect(X - 4, Y - 4, 9, 1);
    g.fillRect(X - 5, Y - 6, 2, 3); g.fillRect(X + 4, Y - 6, 2, 3);
    if (scared) { g.fillStyle = col('#ffffff'); g.fillRect(X - 2, Y - 1, 1, 1); g.fillRect(X + 2, Y - 1, 1, 1); for (let i = -3; i <= 3; i += 2) g.fillRect(X + i, Y + 2, 1, 1); return; }
    g.fillStyle = col('#ffffff');
    g.fillRect(X - 3, Y - 1, 2, 2); g.fillRect(X + 2, Y - 1, 2, 2);
    g.fillStyle = col('#2a1f2b');
    g.fillRect(X - 3 + (c.dx > 0 ? 1 : 0), Y - 1 + (c.dy > 0 ? 1 : 0), 1, 1); g.fillRect(X + 2 + (c.dx > 0 ? 1 : 0), Y - 1 + (c.dy > 0 ? 1 : 0), 1, 1);
    g.fillStyle = col('#ff8fa3'); g.fillRect(X, Y + 1, 1, 1);
    if (c.dizzy! > 0) { g.fillStyle = col('#fff07a'); g.fillRect(Math.round(X + Math.cos(time * 8) * 6), Math.round(Y - 7 + Math.sin(time * 8) * 2), 1, 1); }
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    drawBoard(g, b, t);
    g.drawImage(wallLayer, ox, oy);
    for (let i = 0; i < dots.length; i++) {
      if (!dots[i]) continue;
      const x = ox + (i % cols) * cell + cell / 2, y = oy + ((i / cols) | 0) * cell + cell / 2;
      if (dots[i] === 2) { if (Math.floor(t * 4) % 2) { g.fillStyle = col('#ffd23f'); g.fillRect(x - 3, y - 1, 6, 3); g.fillRect(x - 2, y - 2, 4, 1); g.fillStyle = col('#c98a1c'); g.fillRect(x - 1, y, 1, 1); } }
      else { g.fillStyle = col('#fff0a0'); g.fillRect(x - 1, y - 1, 2, 2); }
    }
    for (const m of mice) if (m.dead <= 0) drawMouse(g, m);
    for (const c of cats) if (c.dead <= 0) drawCat(g, c);
    scoreText(g, b, score);
  }

  function lights(): Light[] {
    return mice.filter((m) => m.dead <= 0).map((m) => { const [x, y] = pos(m); return { x, y, r: 8, c: '#ffffff', a: 0.4 }; });
  }

  return { update, draw, paw, lights };
}

// ------------------------------------------------------------------------------------------
// Brick breaker
// ------------------------------------------------------------------------------------------

const SHAPES: string[][] = [
  ['..##....##..', '.####..####.', '############', '############', '.##########.', '..########..', '....####....', '.....##.....'],
  ['.#........#.', '.##......##.', '.##########.', '.#..####..#.', '.#.#.##.#.#.', '.##########.', '..##.##.##..', '...######...'],
  ['....####....', '..########.#', '.##.#######.', '###########.', '###########.', '.##########.', '..########.#', '....####....'],
  ['.....##.....', '....####....', '############', '.##########.', '..########..', '..###..###..', '.##......##.', '##........##'],
  ['############', '############', '############', '############', '############', '############'],
];
const BRICK = ['#ff4a6a', '#ff8a3a', '#ffd23f', '#6aff8a', '#4ae8ff', '#6a8aff', '#c86aff', '#ff6ad8'];

interface Ball { x: number; y: number; vx: number; vy: number; trail: [number, number][] }

function createBreakout(ctx: SceneCtx): SceneInstance {
  const { rng, fx, sfx, opts } = ctx;
  const b = boardOf(ctx);
  const cols = 12;
  const bw = Math.floor((b.w - 20) / cols), bh = 7;
  const bx0 = b.x + Math.floor((b.w - bw * cols) / 2), by0 = b.y + 18;
  let bricks: { x: number; y: number; c: string; hp: number }[] = [];
  let shape = rng.int(0, SHAPES.length - 1);
  const pad = { x: b.x + b.w / 2, w: 38, y: b.y + b.h - 10 };
  const balls: Ball[] = [];
  let score = 0, time = 0, clearT = 0;
  const speed = () => (130 + opts.intensity * 60) * opts.speed;

  function level() {
    bricks = [];
    const s = SHAPES[shape % SHAPES.length];
    s.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') bricks.push({ x: bx0 + c * bw, y: by0 + r * (bh + 2), c: BRICK[r % BRICK.length], hp: 1 }); });
    shape++;
    balls.length = 0;
    serve();
  }
  function serve() {
    const a = -Math.PI / 2 + rng.range(-0.6, 0.6);
    balls.push({ x: pad.x, y: pad.y - 6, vx: Math.cos(a) * speed(), vy: Math.sin(a) * speed(), trail: [] });
  }
  level();

  function update(dt: number) {
    time += dt;
    if (clearT > 0) { clearT -= dt; if (clearT <= 0) level(); return; }
    // The paddle plays itself, a little behind the ball.
    const target = balls.length ? balls.reduce((a, c) => (c.y > a.y ? c : a)).x : b.x + b.w / 2;
    pad.x += clamp(target - pad.x, -160 * dt, 160 * dt);
    pad.x = clamp(pad.x, b.x + pad.w / 2, b.x + b.w - pad.w / 2);
    for (const ball of balls) {
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        ball.x += (ball.vx * dt) / steps; ball.y += (ball.vy * dt) / steps;
        if (ball.x < b.x + 2) { ball.x = b.x + 2; ball.vx = Math.abs(ball.vx); sfx.bounce(); }
        if (ball.x > b.x + b.w - 2) { ball.x = b.x + b.w - 2; ball.vx = -Math.abs(ball.vx); sfx.bounce(); }
        if (ball.y < b.y + 14) { ball.y = b.y + 14; ball.vy = Math.abs(ball.vy); sfx.bounce(); }
        if (ball.vy > 0 && ball.y > pad.y - 3 && ball.y < pad.y + 3 && Math.abs(ball.x - pad.x) < pad.w / 2 + 2) {
          const k = (ball.x - pad.x) / (pad.w / 2);
          const a = -Math.PI / 2 + k * 1.0;
          const sp = Math.hypot(ball.vx, ball.vy) * 1.01;
          ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
          sfx.bounce();
        }
        for (let i = bricks.length - 1; i >= 0; i--) {
          const br = bricks[i];
          if (ball.x > br.x - 1 && ball.x < br.x + bw && ball.y > br.y - 1 && ball.y < br.y + bh) {
            const fromSide = Math.min(Math.abs(ball.x - br.x), Math.abs(ball.x - br.x - bw)) < Math.min(Math.abs(ball.y - br.y), Math.abs(ball.y - br.y - bh));
            if (fromSide) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            smash(i);
            break;
          }
        }
      }
      ball.trail.push([ball.x, ball.y]);
      if (ball.trail.length > 6) ball.trail.shift();
    }
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].y > b.y + b.h + 4) balls.splice(i, 1);
    if (!balls.length) serve();
    if (!bricks.length) { clearT = 2; fx.burst(b.x + b.w / 2, b.y + b.h / 2, 40, BRICK, { speed: 110, g: 60, max: 1.3 }); sfx.ding(); }
  }

  function smash(i: number) {
    const br = bricks[i];
    bricks.splice(i, 1);
    score += 10;
    fx.burst(br.x + bw / 2, br.y + bh / 2, 8, [br.c, '#ffffff'], { speed: 60, g: 120, max: 0.6 });
    sfx.pop();
    // Now and then a brick lets out another ball.
    if (rng.chance(0.06) && balls.length < 3) { const a = -Math.PI / 2 + rng.range(-0.8, 0.8); balls.push({ x: br.x + bw / 2, y: br.y + bh, vx: Math.cos(a) * speed(), vy: -Math.sin(a) * speed(), trail: [] }); }
  }

  function paw(x: number, y: number) {
    for (const ball of balls) {
      if (dist(x, y, ball.x, ball.y) < 12 * opts.reach) {
        const a = -Math.PI / 2 + rng.range(-1, 1);
        ball.vx = Math.cos(a) * speed() * 1.2; ball.vy = Math.sin(a) * speed() * 1.2;
        ctx.caught('arcade', ball.x, ball.y, '#ffffff');
      }
    }
    for (let i = bricks.length - 1; i >= 0; i--) {
      const br = bricks[i];
      if (x > br.x - 2 && x < br.x + bw + 2 && y > br.y - 2 && y < br.y + bh + 2) { smash(i); ctx.caught('arcade', x, y, br.c); break; }
    }
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    drawBoard(g, b, t, '#ff4ad8');
    for (const br of bricks) {
      g.fillStyle = col(br.c); g.fillRect(br.x, br.y, bw - 1, bh);
      g.fillStyle = col('#ffffff'); g.globalAlpha = 0.45; g.fillRect(br.x, br.y, bw - 1, 1); g.globalAlpha = 1;
      g.fillStyle = col('#000000'); g.globalAlpha = 0.3; g.fillRect(br.x, br.y + bh - 1, bw - 1, 1); g.globalAlpha = 1;
    }
    g.fillStyle = col('#4ae8ff'); g.fillRect(Math.round(pad.x - pad.w / 2), pad.y, pad.w, 3);
    g.fillStyle = col('#ffffff'); g.fillRect(Math.round(pad.x - pad.w / 2) + 2, pad.y, pad.w - 4, 1);
    for (const ball of balls) {
      ball.trail.forEach(([x, y], i) => { g.globalAlpha = (i + 1) / ball.trail.length * 0.4; g.fillStyle = col('#ffd23f'); g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); });
      g.globalAlpha = 1;
      g.fillStyle = col('#ffffff'); g.fillRect(Math.round(ball.x) - 1, Math.round(ball.y) - 1, 3, 3);
    }
    scoreText(g, b, score, '#ff9ad8');
  }

  function lights(): Light[] {
    return balls.map((ball) => ({ x: ball.x, y: ball.y, r: 12, c: '#ffffff', a: 0.5 }));
  }

  return { update, draw, paw, lights };
}

// ------------------------------------------------------------------------------------------
// Snake
// ------------------------------------------------------------------------------------------

function createSnake(ctx: SceneCtx): SceneInstance {
  const { rng, fx, sfx, opts } = ctx;
  const b = boardOf(ctx);
  const cell = 8;
  const cols = Math.floor((b.w - 4) / cell), rows = Math.floor((b.h - 16) / cell);
  const ox = b.x + Math.floor((b.w - cols * cell) / 2), oy = b.y + 14 + Math.floor((b.h - 14 - rows * cell) / 2);
  let snake: [number, number][] = [];
  let fruit: [number, number] = [0, 0];
  let fruitKind = 0;
  let acc = 0, time = 0, dead = 0, score = 0;
  const rate = () => (9 + opts.intensity * 5) * opts.speed;

  function reset() {
    const x = Math.floor(cols / 2), y = Math.floor(rows / 2);
    snake = [[x, y], [x - 1, y], [x - 2, y], [x - 3, y]];
    place();
  }
  function place() {
    for (let k = 0; k < 200; k++) {
      const p: [number, number] = [rng.int(0, cols - 1), rng.int(0, rows - 1)];
      if (!snake.some(([x, y]) => x === p[0] && y === p[1])) { fruit = p; fruitKind = rng.int(0, 2); return; }
    }
  }
  reset();

  function blockedGrid(): Uint8Array {
    const m = new Uint8Array(cols * rows);
    for (let i = 0; i < snake.length - 1; i++) m[snake[i][1] * cols + snake[i][0]] = 1;
    return m;
  }

  function reachable(m: Uint8Array, sx: number, sy: number): number {
    const seen = new Uint8Array(cols * rows);
    const q = [sy * cols + sx]; seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % cols, y = (i / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (m[j] || seen[j]) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return q.length;
  }

  function nextMove(): [number, number] {
    const [hx, hy] = snake[0];
    const m = blockedGrid();
    // Shortest path to the fruit.
    const prev = new Int32Array(cols * rows).fill(-1);
    const q = [hy * cols + hx]; prev[q[0]] = q[0];
    let found = -1;
    for (let h = 0; h < q.length && found < 0; h++) {
      const i = q[h], x = i % cols, y = (i / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (m[j] || prev[j] >= 0) continue;
        prev[j] = i; q.push(j);
        if (nx === fruit[0] && ny === fruit[1]) { found = j; break; }
      }
    }
    const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const nx = hx + dx, ny = hy + dy; return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !m[ny * cols + nx]; });
    if (found >= 0) {
      let j = found;
      while (prev[j] !== hy * cols + hx) j = prev[j];
      const step: [number, number] = [(j % cols) - hx, ((j / cols) | 0) - hy];
      // Only take it if there is room to live afterwards.
      if (reachable(m, hx + step[0], hy + step[1]) > snake.length + 2) return step;
    }
    // Otherwise the move that leaves the most room.
    let best: [number, number] = [1, 0], bv = -1;
    for (const [dx, dy] of moves) { const v = reachable(m, hx + dx, hy + dy); if (v > bv) { bv = v; best = [dx, dy]; } }
    return best;
  }

  function update(dt: number) {
    time += dt;
    if (dead > 0) { dead -= dt; if (dead <= 0) { reset(); score = 0; } return; }
    acc += dt * rate();
    while (acc >= 1) {
      acc -= 1;
      const [dx, dy] = nextMove();
      const [hx, hy] = snake[0];
      const nx = hx + dx, ny = hy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || snake.slice(0, -1).some(([x, y]) => x === nx && y === ny)) {
        dead = 2;
        for (const [x, y] of snake) fx.burst(ox + x * cell + 4, oy + y * cell + 4, 2, ['#6aff8a', '#ffffff'], { speed: 60, g: 80, max: 0.8 });
        sfx.bounce();
        return;
      }
      snake.unshift([nx, ny]);
      if (nx === fruit[0] && ny === fruit[1]) { score += 10; sfx.pop(); fx.burst(ox + nx * cell + 4, oy + ny * cell + 4, 8, ['#ffd23f', '#ff4a6a'], { speed: 40, g: 40, max: 0.5 }); place(); }
      else snake.pop();
    }
  }

  function paw(x: number, y: number) {
    const fx0 = ox + fruit[0] * cell + 4, fy0 = oy + fruit[1] * cell + 4;
    if (dist(x, y, fx0, fy0) < 10 * opts.reach) { ctx.caught('arcade', fx0, fy0, '#ffd23f'); place(); }
    const [hx, hy] = snake[0];
    if (dead <= 0 && dist(x, y, ox + hx * cell + 4, oy + hy * cell + 4) < 10 * opts.reach) ctx.caught('arcade', x, y, '#6aff8a');
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    drawBoard(g, b, t, '#6aff8a');
    g.globalAlpha = 0.12;
    g.fillStyle = col('#6aff8a');
    for (let x = 0; x <= cols; x++) g.fillRect(ox + x * cell, oy, 1, rows * cell);
    for (let y = 0; y <= rows; y++) g.fillRect(ox, oy + y * cell, cols * cell, 1);
    g.globalAlpha = 1;
    // The treat: a fish, a mouse, a cheese.
    const fx0 = ox + fruit[0] * cell, fy0 = oy + fruit[1] * cell;
    if (fruitKind === 0) { g.fillStyle = col('#4ae8ff'); g.fillRect(fx0 + 1, fy0 + 3, 5, 3); g.fillRect(fx0 + 6, fy0 + 2, 1, 5); g.fillStyle = col('#2a1f2b'); g.fillRect(fx0 + 2, fy0 + 3, 1, 1); }
    else if (fruitKind === 1) { g.fillStyle = col('#c9c8d6'); g.fillRect(fx0 + 1, fy0 + 3, 5, 3); g.fillRect(fx0 + 5, fy0 + 2, 2, 2); g.fillStyle = col('#ff9aa6'); g.fillRect(fx0, fy0 + 5, 1, 1); }
    else { g.fillStyle = col('#ffd23f'); g.fillRect(fx0 + 1, fy0 + 3, 6, 4); g.fillRect(fx0 + 3, fy0 + 2, 4, 1); g.fillStyle = col('#c98a1c'); g.fillRect(fx0 + 3, fy0 + 4, 1, 1); }
    if (dead > 0 && Math.floor(t * 8) % 2) return;
    snake.forEach(([x, y], i) => {
      const k = i / snake.length;
      g.fillStyle = col(i === 0 ? '#b8ffc8' : k < 0.5 ? '#6aff8a' : '#3ad06a');
      g.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2);
      if (i === 0) { g.fillStyle = col('#2a1f2b'); g.fillRect(ox + x * cell + 2, oy + y * cell + 2, 1, 1); g.fillRect(ox + x * cell + 5, oy + y * cell + 2, 1, 1); }
    });
    scoreText(g, b, score, '#b8ffc8');
  }

  return { update, draw, paw };
}

const ARCADE_TODS: SceneDef['tods'] = ['day'];

export const maze: SceneDef = {
  id: 'maze',
  name: { uk: 'Мишачий лабіринт', en: 'Mouse maze' },
  about: {
    uk: 'Мишки бігають неоновим лабіринтом і збирають сирні крихти, тікаючи від котів. З’їли великий шматок сиру, і тепер тікають коти.',
    en: 'Mice run a neon maze eating cheese crumbs and fleeing the cats. After the big cheese, the cats run instead.',
  },
  energy: 0.75,
  locations: ['arcade'],
  tods: ARCADE_TODS,
  kind: 'arcade',
  icon: 'maze',
  create: createMaze,
};

export const breakout: SceneDef = {
  id: 'breakout',
  name: { uk: 'Цеглинки', en: 'Brick breaker' },
  about: {
    uk: 'М’ячик вибиває цеглинки, складені сердечком, котиком і рибкою. Лапою можна відбити м’ячик або розбити цеглинку.',
    en: 'A ball knocks out bricks laid out as a heart, a cat, a fish. A paw can bat the ball or smash a brick.',
  },
  energy: 0.7,
  locations: ['arcade'],
  tods: ARCADE_TODS,
  kind: 'arcade',
  icon: 'bricks',
  create: createBreakout,
};

export const snake: SceneDef = {
  id: 'snake',
  name: { uk: 'Змійка', en: 'Snake' },
  about: {
    uk: 'Неонова змійка сама знаходить шлях до рибки, мишки чи сиру й намагається не вкусити себе за хвіст. Лапа може поцупити смаколик.',
    en: 'A neon snake finds its own way to a fish, a mouse or cheese and tries not to bite its tail. A paw can steal the treat.',
  },
  energy: 0.6,
  locations: ['arcade'],
  tods: ARCADE_TODS,
  kind: 'arcade',
  icon: 'snake',
  create: createSnake,
};
